// API Key encryption store
// Simple XOR + base64 encoding for local storage.
// In production, use OS-level keychain (Windows Credential Manager, macOS Keychain).

use std::collections::HashMap;
use std::sync::Mutex;

static KEY_STORE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

const KEY_PREFIX: &str = "lak_";

fn get_store() -> std::sync::MutexGuard<'static, Option<HashMap<String, String>>> {
    KEY_STORE.lock().unwrap()
}

pub fn save_api_key(provider: &str, key: &str) {
    let cipher = xor_encrypt(key, KEY_PREFIX);
    let encoded = base64_encode(cipher.as_bytes());
    let mut store = get_store();
    if store.is_none() {
        *store = Some(HashMap::new());
    }
    store.as_mut().unwrap().insert(provider.to_string(), encoded);
}

pub fn get_api_key(provider: &str) -> Option<String> {
    let store = get_store();
    let encoded = store.as_ref()?.get(provider)?;
    let decoded = base64_decode(encoded).ok()?;
    let plain = xor_decrypt(&decoded, KEY_PREFIX);
    Some(plain)
}

pub fn remove_api_key(provider: &str) {
    let mut store = get_store();
    if let Some(map) = store.as_mut() {
        map.remove(provider);
    }
}

fn xor_encrypt(plain: &str, key: &str) -> Vec<u8> {
    plain
        .bytes()
        .zip(key.bytes().cycle())
        .map(|(p, k)| p ^ k)
        .collect()
}

fn xor_decrypt(cipher: &[u8], key: &str) -> String {
    cipher
        .iter()
        .zip(key.bytes().cycle())
        .map(|(c, k)| (c ^ k) as char)
        .collect()
}

const B64_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn base64_encode(input: &[u8]) -> String {
    let mut result = String::new();
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let combined = (b0 << 16) | (b1 << 8) | b2;
        for i in 0..4 {
            if chunk.len() < i + 1 && i >= chunk.len() {
                result.push('=');
            } else {
                let idx = ((combined >> (18 - i * 6)) & 0x3F) as usize;
                result.push(B64_CHARS[idx] as char);
            }
        }
    }
    result
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    let input = input.trim_end_matches('=');
    let mut result = Vec::new();
    let bytes: Vec<u8> = input
        .bytes()
        .map(|c| B64_CHARS.iter().position(|&b| b == c).unwrap_or(0) as u8)
        .collect();

    for chunk in bytes.chunks(4) {
        if chunk.len() < 2 {
            break;
        }
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let b3 = chunk.get(3).copied().unwrap_or(0) as u32;
        let combined = (b0 << 18) | (b1 << 12) | (b2 << 6) | b3;
        result.push((combined >> 16) as u8);
        if chunk.len() > 2 {
            result.push((combined >> 8) as u8);
        }
        if chunk.len() > 3 {
            result.push(combined as u8);
        }
    }
    Ok(result)
}
