use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    XChaCha20Poly1305, XNonce,
};
use argon2::Argon2;
use hkdf::Hkdf;
use rand::RngCore;
use sha2::Sha256;

const SALT: &[u8] = b"ajudafinancas-sync-salt-v1";
const NONCE_LEN: usize = 24;
const KEY_LEN: usize = 32;

#[derive(Debug)]
pub enum CryptoError {
    Encrypt(String),
    Decrypt(String),
    KeyDerivation(String),
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CryptoError::Encrypt(e) => write!(f, "criptografia: {e}"),
            CryptoError::Decrypt(e) => write!(f, "descriptografia: {e}"),
            CryptoError::KeyDerivation(e) => write!(f, "derivação de chave: {e}"),
        }
    }
}

impl std::error::Error for CryptoError {}

fn derive_key(passphrase: &str) -> Result<[u8; KEY_LEN], CryptoError> {
    let argon2 = Argon2::default();
    let mut ikm = [0u8; KEY_LEN];
    argon2
        .hash_password_into(passphrase.as_bytes(), SALT, &mut ikm)
        .map_err(|e| CryptoError::KeyDerivation(e.to_string()))?;

    let hk = Hkdf::<Sha256>::new(Some(SALT), &ikm);
    let mut key = [0u8; KEY_LEN];
    hk.expand(b"chacha20poly1305-key", &mut key)
        .map_err(|e| CryptoError::KeyDerivation(e.to_string()))?;
    Ok(key)
}

pub fn encrypt(data: &[u8], passphrase: &str) -> Result<Vec<u8>, CryptoError> {
    let key = derive_key(passphrase)?;
    let cipher = XChaCha20Poly1305::new(&key.into());

    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = XNonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| CryptoError::Encrypt(e.to_string()))?;

    let mut output = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

pub fn decrypt(data: &[u8], passphrase: &str) -> Result<Vec<u8>, CryptoError> {
    if data.len() < NONCE_LEN {
        return Err(CryptoError::Decrypt("dados muito curtos".into()));
    }

    let key = derive_key(passphrase)?;
    let cipher = XChaCha20Poly1305::new(&key.into());

    let nonce = XNonce::from_slice(&data[..NONCE_LEN]);
    let ciphertext = &data[NONCE_LEN..];

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| CryptoError::Decrypt(e.to_string()))
}

pub fn is_encrypted(data: &[u8]) -> bool {
    data.len() > NONCE_LEN
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let plaintext = b"hello world sync data";
        let pass = "minha-senha-secreta";

        let encrypted = encrypt(plaintext, pass).unwrap();
        assert_ne!(encrypted, plaintext);
        assert!(is_encrypted(&encrypted));

        let decrypted = decrypt(&encrypted, pass).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn different_passphrase_fails() {
        let data = encrypt(b"secret", "correct").unwrap();
        let result = decrypt(&data, "wrong");
        assert!(result.is_err());
    }

    #[test]
    fn short_data_fails() {
        let result = decrypt(&[0u8; 5], "pass");
        assert!(result.is_err());
    }

    #[test]
    fn empty_data_roundtrip() {
        let data = encrypt(b"", "pass").unwrap();
        let dec = decrypt(&data, "pass").unwrap();
        assert!(dec.is_empty());
    }

    #[test]
    fn is_encrypted_true_for_valid() {
        let data = encrypt(b"test", "p").unwrap();
        assert!(is_encrypted(&data));
    }

    #[test]
    fn is_encrypted_false_for_short() {
        assert!(!is_encrypted(&[0u8; 10]));
    }

    #[test]
    fn large_data_roundtrip() {
        let big = vec![42u8; 100_000];
        let enc = encrypt(&big, "big-data-pass").unwrap();
        let dec = decrypt(&enc, "big-data-pass").unwrap();
        assert_eq!(dec, big);
    }
}
