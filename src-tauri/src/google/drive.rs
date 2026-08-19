use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;

use crate::sync::provider::{DriveError, DriveProvider, FileInfo};

use super::{auth, credential};

const API_BASE: &str = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE: &str = "https://www.googleapis.com/upload/drive/v3";

#[derive(Debug, Deserialize)]
struct DriveFile {
    id: Option<String>,
    name: Option<String>,
    size: Option<String>,
    #[serde(rename = "modifiedTime")]
    modified_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FileList {
    files: Option<Vec<DriveFile>>,
}

#[derive(Debug, Deserialize)]
struct GoogleError {
    error: Option<GoogleErrorDetail>,
}

#[derive(Debug, Deserialize)]
struct GoogleErrorDetail {
    message: Option<String>,
}

async fn check_response(resp: reqwest::Response) -> Result<reqwest::Response, DriveError> {
    let status = resp.status();
    if status.is_success() {
        return Ok(resp);
    }
    let body = resp.text().await.unwrap_or_default();
    let msg = serde_json::from_str::<GoogleError>(&body)
        .ok()
        .and_then(|e| e.error?.message)
        .unwrap_or(body);
    Err(DriveError::Other(format!("Google API {status}: {msg}")))
}

pub struct GoogleDriveProvider {
    client_id: String,
    client_secret: String,
    tokens: Option<auth::OAuthTokens>,
    http: Client,
}

impl GoogleDriveProvider {
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self {
            client_id,
            client_secret,
            tokens: None,
            http: Client::new(),
        }
    }

    fn ensure_tokens(&self) -> Result<&auth::OAuthTokens, DriveError> {
        self.tokens
            .as_ref()
            .ok_or_else(|| DriveError::Auth("não autenticado".into()))
    }

    #[allow(dead_code)]
    async fn ensure_fresh_token(&mut self) -> Result<(), DriveError> {
        if let Some(ref tokens) = self.tokens {
            if tokens.expires_at > std::time::Instant::now() {
                return Ok(());
            }
            if let Some(ref rt) = tokens.refresh_token {
                let new_tokens = auth::refresh_access_token(&self.client_id, &self.client_secret, rt)
                    .await
                    .map_err(|e| DriveError::Auth(e))?;
                self.tokens = Some(new_tokens);
                return Ok(());
            }
        }
        Err(DriveError::Auth("token expirado e sem refresh_token".into()))
    }

    fn appdata_folder_id() -> &'static str {
        "appDataFolder"
    }

    async fn find_file(&self, name: &str) -> Result<Option<String>, DriveError> {
        let tokens = self.ensure_tokens()?;
        let resp = self
            .http
            .get(format!("{API_BASE}/files"))
            .bearer_auth(&tokens.access_token)
            .query(&[
                ("q", format!("name='{name}' and trashed=false").as_str()),
                ("spaces", "appDataFolder"),
                ("fields", "files(id,name)"),
            ])
            .send()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        let resp = check_response(resp).await?;
        let body: FileList = resp
            .json()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        Ok(body
            .files
            .unwrap_or_default()
            .into_iter()
            .next()
            .and_then(|f| f.id))
    }

    async fn find_or_create_folder(&self, name: &str) -> Result<String, DriveError> {
        if let Some(id) = self.find_file(name).await? {
            return Ok(id);
        }

        let tokens = self.ensure_tokens()?;
        let body = serde_json::json!({
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [Self::appdata_folder_id()]
        });

        let resp = self
            .http
            .post(format!("{API_BASE}/files"))
            .bearer_auth(&tokens.access_token)
            .query(&[("fields", "id")])
            .json(&body)
            .send()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        let resp = check_response(resp).await?;
        let file: DriveFile = resp
            .json()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        file.id
            .ok_or_else(|| DriveError::Other("falha ao criar pasta".into()))
    }
}

#[async_trait]
impl DriveProvider for GoogleDriveProvider {
    async fn authenticate(&mut self) -> Result<(), DriveError> {
        if let Some(rt) = credential::load_refresh_token() {
            let tokens = auth::refresh_access_token(&self.client_id, &self.client_secret, &rt)
                .await
                .map_err(|e| DriveError::Auth(e))?;
            self.tokens = Some(tokens);
            return Ok(());
        }

        Err(DriveError::Auth("não conectado ao Google".into()))
    }

    async fn is_authenticated(&self) -> bool {
        if self.tokens.is_none() {
            return credential::load_refresh_token().is_some();
        }
        self.tokens.is_some()
    }

    async fn upload(&self, path: &str, data: &[u8], mime_type: &str) -> Result<(), DriveError> {
        let tokens = self.ensure_tokens()?;

        let parts: Vec<&str> = path.splitn(2, '/').collect();
        let folder_name = parts[0];
        let file_name = parts.get(1).unwrap_or(&path);

        let folder_id = self.find_or_create_folder(folder_name).await?;

        if let Some(existing_id) = self.find_file(file_name).await? {
            self.http
                .delete(format!("{API_BASE}/files/{existing_id}"))
                .bearer_auth(&tokens.access_token)
                .send()
                .await
                .map_err(|e| DriveError::Network(e.to_string()))?;
        }

        let boundary = "ajudafinancas_boundary_2026";
        let metadata = serde_json::json!({
            "name": file_name,
            "parents": [folder_id]
        });
        let meta_json = serde_json::to_string(&metadata)
            .map_err(|e| DriveError::Other(e.to_string()))?;

        let mut body = Vec::new();
        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        body.extend_from_slice(b"Content-Type: application/json; charset=UTF-8\r\n\r\n");
        body.extend_from_slice(meta_json.as_bytes());
        body.extend_from_slice(b"\r\n");
        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        body.extend_from_slice(format!("Content-Type: {mime_type}\r\n\r\n").as_bytes());
        body.extend_from_slice(data);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

        let resp = self.http
            .post(format!(
                "{UPLOAD_BASE}/files?uploadType=multipart&fields=id"
            ))
            .bearer_auth(&tokens.access_token)
            .header(
                reqwest::header::CONTENT_TYPE,
                format!("multipart/related; boundary={boundary}"),
            )
            .body(body)
            .send()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;
        check_response(resp).await?;

        Ok(())
    }

    async fn download(&self, path: &str) -> Result<Vec<u8>, DriveError> {
        let tokens = self.ensure_tokens()?;
        let file_id = self
            .find_file(
                path.rsplit('/')
                    .next()
                    .unwrap_or(path),
            )
            .await?
            .ok_or_else(|| DriveError::NotFound(path.to_string()))?;

        let resp = self
            .http
            .get(format!("{API_BASE}/files/{file_id}?alt=media"))
            .bearer_auth(&tokens.access_token)
            .send()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        let resp = check_response(resp).await?;
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        Ok(bytes.to_vec())
    }

    async fn exists(&self, path: &str) -> Result<bool, DriveError> {
        let file_name = path.rsplit('/').next().unwrap_or(path);
        Ok(self.find_file(file_name).await?.is_some())
    }

    async fn delete(&self, path: &str) -> Result<(), DriveError> {
        let tokens = self.ensure_tokens()?;
        let file_name = path.rsplit('/').next().unwrap_or(path);
        let file_id = self
            .find_file(file_name)
            .await?
            .ok_or_else(|| DriveError::NotFound(path.to_string()))?;

        let resp = self.http
            .delete(format!("{API_BASE}/files/{file_id}"))
            .bearer_auth(&tokens.access_token)
            .send()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;
        check_response(resp).await?;

        Ok(())
    }

    async fn list(&self, prefix: &str) -> Result<Vec<FileInfo>, DriveError> {
        let tokens = self.ensure_tokens()?;
        let resp = self
            .http
            .get(format!("{API_BASE}/files"))
            .bearer_auth(&tokens.access_token)
            .query(&[
                ("q", format!("name contains '{prefix}' and trashed=false").as_str()),
                ("spaces", "appDataFolder"),
                ("fields", "files(id,name,size,modifiedTime)"),
            ])
            .send()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        let resp = check_response(resp).await?;
        let body: FileList = resp
            .json()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        Ok(body
            .files
            .unwrap_or_default()
            .into_iter()
            .filter_map(|f| {
                Some(FileInfo {
                    name: f.name?,
                    size: f.size?.parse().unwrap_or(0),
                    modified_time: f.modified_time.unwrap_or_default(),
                })
            })
            .collect())
    }

    async fn metadata(&self, path: &str) -> Result<FileInfo, DriveError> {
        let tokens = self.ensure_tokens()?;
        let file_name = path.rsplit('/').next().unwrap_or(path);
        let resp = self
            .http
            .get(format!("{API_BASE}/files"))
            .bearer_auth(&tokens.access_token)
            .query(&[
                ("q", format!("name='{file_name}' and trashed=false").as_str()),
                ("spaces", "appDataFolder"),
                ("fields", "files(name,size,modifiedTime)"),
            ])
            .send()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        let resp = check_response(resp).await?;
        let body: FileList = resp
            .json()
            .await
            .map_err(|e| DriveError::Network(e.to_string()))?;

        let f = body
            .files
            .unwrap_or_default()
            .into_iter()
            .next()
            .ok_or_else(|| DriveError::NotFound(path.to_string()))?;

        Ok(FileInfo {
            name: f.name.unwrap_or_default(),
            size: f.size.unwrap_or_default().parse().unwrap_or(0),
            modified_time: f.modified_time.unwrap_or_default(),
        })
    }

    async fn disconnect(&mut self) -> Result<(), DriveError> {
        self.tokens = None;
        credential::clear_credentials().map_err(|e| DriveError::Other(e))?;
        Ok(())
    }
}
