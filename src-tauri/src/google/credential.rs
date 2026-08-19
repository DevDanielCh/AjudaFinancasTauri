use std::fs;
use std::path::PathBuf;
use std::sync::LazyLock;

const SERVICE: &str = "ajudafinancas";
const ACCOUNT_REFRESH: &str = "google_refresh_token";
const ACCOUNT_ACCESS: &str = "google_access_token";
const ACCOUNT_PASSPHRASE: &str = "sync_passphrase";

static CACHED_REFRESH: LazyLock<std::sync::Mutex<Option<String>>> =
    LazyLock::new(|| std::sync::Mutex::new(None));

fn fallback_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(SERVICE)
}

fn fallback_path(key: &str) -> PathBuf {
    fallback_dir().join(format!("{key}.txt"))
}

fn fallback_store(key: &str, value: &str) -> Result<(), String> {
    let dir = fallback_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("falha ao criar dir: {e}"))?;
    fs::write(fallback_path(key), value).map_err(|e| format!("falha ao salvar: {e}"))
}

fn fallback_load(key: &str) -> Option<String> {
    fs::read_to_string(fallback_path(key)).ok()
}

fn try_keyring_store(account: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, account).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())
}

fn try_keyring_load(account: &str) -> Option<String> {
    let entry = keyring::Entry::new(SERVICE, account).ok()?;
    entry.get_password().ok()
}

fn store(account: &str, value: &str) -> Result<(), String> {
    if try_keyring_store(account, value).is_ok() {
        return Ok(());
    }
    fallback_store(account, value)
}

fn load(account: &str) -> Option<String> {
    try_keyring_load(account).or_else(|| fallback_load(account))
}

pub fn store_refresh_token(token: &str) -> Result<(), String> {
    store(ACCOUNT_REFRESH, token)?;
    if let Ok(mut c) = CACHED_REFRESH.lock() {
        *c = Some(token.to_string());
    }
    Ok(())
}

pub fn load_refresh_token() -> Option<String> {
    if let Ok(c) = CACHED_REFRESH.lock() {
        if let Some(ref t) = *c {
            return Some(t.clone());
        }
    }
    let val = load(ACCOUNT_REFRESH);
    if let Some(ref v) = val {
        if let Ok(mut c) = CACHED_REFRESH.lock() {
            *c = Some(v.clone());
        }
    }
    val
}

pub fn store_access_token(token: &str) -> Result<(), String> {
    store(ACCOUNT_ACCESS, token)
}

pub fn load_access_token() -> Option<String> {
    load(ACCOUNT_ACCESS)
}

pub fn store_passphrase(passphrase: &str) -> Result<(), String> {
    store(ACCOUNT_PASSPHRASE, passphrase)
}

pub fn load_passphrase() -> Option<String> {
    load(ACCOUNT_PASSPHRASE)
}

pub fn clear_credentials() -> Result<(), String> {
    for account in [ACCOUNT_REFRESH, ACCOUNT_ACCESS, ACCOUNT_PASSPHRASE] {
        if let Ok(entry) = keyring::Entry::new(SERVICE, account) {
            let _ = entry.delete_credential();
        }
        let _ = fs::remove_file(fallback_path(account));
    }
    Ok(())
}
