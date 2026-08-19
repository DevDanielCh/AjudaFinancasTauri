use async_trait::async_trait;
use std::fmt;

#[derive(Debug, Clone)]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub modified_time: String,
}

#[derive(Debug)]
pub enum DriveError {
    Auth(String),
    Network(String),
    NotFound(String),
    Quota(String),
    Io(String),
    Encryption(String),
    Other(String),
}

impl fmt::Display for DriveError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DriveError::Auth(e) => write!(f, "autenticação: {e}"),
            DriveError::Network(e) => write!(f, "rede: {e}"),
            DriveError::NotFound(e) => write!(f, "não encontrado: {e}"),
            DriveError::Quota(e) => write!(f, "quota: {e}"),
            DriveError::Io(e) => write!(f, "I/O: {e}"),
            DriveError::Encryption(e) => write!(f, "criptografia: {e}"),
            DriveError::Other(e) => write!(f, "erro: {e}"),
        }
    }
}

impl std::error::Error for DriveError {}

#[async_trait]
pub trait DriveProvider: Send + Sync {
    async fn authenticate(&mut self) -> Result<(), DriveError>;
    async fn is_authenticated(&self) -> bool;
    async fn upload(&self, path: &str, data: &[u8], mime_type: &str) -> Result<(), DriveError>;
    async fn download(&self, path: &str) -> Result<Vec<u8>, DriveError>;
    async fn exists(&self, path: &str) -> Result<bool, DriveError>;
    async fn delete(&self, path: &str) -> Result<(), DriveError>;
    async fn list(&self, prefix: &str) -> Result<Vec<FileInfo>, DriveError>;
    async fn metadata(&self, path: &str) -> Result<FileInfo, DriveError>;
    async fn disconnect(&mut self) -> Result<(), DriveError>;
}
