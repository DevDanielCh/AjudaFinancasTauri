use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use reqwest::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tokio::task::JoinHandle;

use super::credential;
use super::http_server;

#[derive(Debug, Clone)]
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: std::time::Instant,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
    #[allow(dead_code)]
    token_type: String,
}

#[derive(Debug, Deserialize)]
struct TokenError {
    error_description: Option<String>,
}

pub struct PendingAuth {
    pub verifier: String,
    pub client_secret: String,
    pub port: u16,
    pub handle: JoinHandle<http_server::CallbackResult>,
}

async fn exchange_code(
    client: &Client,
    client_secret: &str,
    params: Vec<(&str, String)>,
) -> Result<TokenResponse, String> {
    let mut all_params: Vec<(String, String)> = params
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();
    all_params.push(("client_secret".into(), client_secret.to_string()));

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&all_params)
        .send()
        .await
        .map_err(|e| format!("falha na requisição token: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        let msg = serde_json::from_str::<TokenError>(&text)
            .ok()
            .and_then(|e| e.error_description)
            .unwrap_or(text);
        return Err(format!("Google token API {status}: {msg}"));
    }

    serde_json::from_str(&text)
        .map_err(|e| format!("resposta inválida do Google: {e} — body: {text}"))
}

pub async fn start_auth(client_id: &str, client_secret: &str) -> Result<(String, PendingAuth), String> {
    let verifier = generate_code_verifier();
    let challenge = code_challenge(&verifier);

    let (port, server_handle) = http_server::start_callback_server().await?;
    let auth_url = http_server::build_auth_url(client_id, port, &challenge);

    Ok((auth_url, PendingAuth { verifier, client_secret: client_secret.to_string(), port, handle: server_handle }))
}

pub async fn complete_auth(
    client_id: &str,
    client_secret: &str,
    pending: PendingAuth,
) -> Result<OAuthTokens, String> {
    let result = pending
        .handle
        .await
        .map_err(|e| format!("servidor callback falhou: {e}"))?;

    let code = result
        .code
        .ok_or_else(|| result.error.unwrap_or("autenticação cancelada".into()))?;

    let client = Client::new();
    let body = exchange_code(
        &client,
        client_secret,
        vec![
            ("code", code),
            ("client_id", client_id.to_string()),
            ("code_verifier", pending.verifier),
            ("grant_type", "authorization_code".to_string()),
            ("redirect_uri", format!("http://127.0.0.1:{}/callback", pending.port)),
        ],
    )
    .await?;

    if let Some(ref rt) = body.refresh_token {
        credential::store_refresh_token(rt)?;
    }
    credential::store_access_token(&body.access_token)?;

    Ok(OAuthTokens {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: std::time::Instant::now() + std::time::Duration::from_secs(body.expires_in - 300),
    })
}

pub async fn refresh_access_token(
    client_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> Result<OAuthTokens, String> {
    let client = Client::new();
    let body = exchange_code(
        &client,
        client_secret,
        vec![
            ("refresh_token", refresh_token.to_string()),
            ("client_id", client_id.to_string()),
            ("grant_type", "refresh_token".to_string()),
        ],
    )
    .await?;

    credential::store_access_token(&body.access_token)?;

    Ok(OAuthTokens {
        access_token: body.access_token,
        refresh_token: Some(refresh_token.to_string()),
        expires_at: std::time::Instant::now() + std::time::Duration::from_secs(body.expires_in - 300),
    })
}

fn generate_code_verifier() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..64).map(|_| rng.gen()).collect();
    URL_SAFE_NO_PAD.encode(&bytes)
}

fn code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}
