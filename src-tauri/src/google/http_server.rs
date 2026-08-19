use std::collections::HashMap;

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::TcpListener;

pub struct CallbackResult {
    pub code: Option<String>,
    pub error: Option<String>,
}

pub async fn start_callback_server() -> Result<(u16, tokio::task::JoinHandle<CallbackResult>), String>
{
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("falha ao criar servidor callback: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let handle = tokio::spawn(async move {
        let (stream, _) = match listener.accept().await {
            Ok(v) => v,
            Err(_) => return CallbackResult { code: None, error: Some("accept failed".into()) },
        };

        let mut reader = BufReader::new(stream);
        let mut first_line = String::new();
        let _ = reader.read_line(&mut first_line).await;

        let uri = first_line
            .split_whitespace()
            .nth(1)
            .unwrap_or("");

        let (_path, query) = if let Some(pos) = uri.find('?') {
            (&uri[..pos], &uri[pos + 1..])
        } else {
            (uri, "")
        };

        let params: HashMap<&str, &str> = query
            .split('&')
            .filter_map(|p| {
                let mut parts = p.splitn(2, '=');
                Some((parts.next()?, parts.next()?))
            })
            .collect();

        let code = params.get("code").map(|s| s.to_string());
        let error = params.get("error").map(|s| s.to_string());

        let body = if code.is_some() {
            "<html><body><h1>Ajuda Finan&ccedil;as</h1><p>Conta Google conectada! Pode fechar esta janela.</p></body></html>"
        } else {
            "<html><body><h1>Ajuda Finan&ccedil;as</h1><p>Erro na autentica&ccedil;&atilde;o. Tente novamente.</p></body></html>"
        };

        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );

        let _ = tokio::io::AsyncWriteExt::write_all(&mut reader.into_inner(), response.as_bytes()).await;

        CallbackResult { code, error }
    });

    Ok((port, handle))
}

pub fn build_auth_url(client_id: &str, port: u16, code_challenge: &str) -> String {
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
         client_id={client_id}&\
         redirect_uri=http://127.0.0.1:{port}/callback&\
         response_type=code&\
         scope=https://www.googleapis.com/auth/drive.appdata&\
         code_challenge={code_challenge}&\
         code_challenge_method=S256&\
         access_type=offline&\
         prompt=consent"
    )
}
