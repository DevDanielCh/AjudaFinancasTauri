use serde::{Deserialize, Serialize};

/// Conta do usuário (equivalente a um "servidor" no Discord).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountRow {
    pub id: i64,
    pub uuid: Option<String>,
    pub name: String,
    pub color: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AccountInfo {
    pub uuid: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
    pub active: bool,
    #[serde(skip)]
    pub id: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AccountInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
}

const MAX_NAME_LEN: usize = 60;

pub fn validate_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("nome da conta é obrigatório".into());
    }
    if trimmed.len() > MAX_NAME_LEN {
        return Err(format!("nome da conta deve ter até {MAX_NAME_LEN} caracteres"));
    }
    Ok(())
}

pub fn validate_color(color: &str) -> Result<(), String> {
    let bytes = color.as_bytes();
    if color.len() != 7 || bytes[0] != b'#' {
        return Err("cor deve estar no formato #rrggbb".into());
    }
    if !color[1..].chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("cor deve estar no formato #rrggbb".into());
    }
    Ok(())
}
