/**
 * Passphrase-protected backups. The file holds only salt, nonce and ciphertext,
 * so it is safe to keep in any cloud drive. Key derivation is scrypt, the
 * cipher is XChaCha20-Poly1305 (authenticated; a wrong passphrase fails loudly).
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import { scrypt } from '@noble/hashes/scrypt.js';

export interface EncryptedBackupFile {
  app: 'onlybudget';
  format: 'encrypted-backup';
  version: 1;
  kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string };
  cipher: 'xchacha20poly1305';
  nonce: string;
  ciphertext: string;
}

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64[(triple >> 18) & 63] + B64[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[triple & 63] : '=';
  }
  return out;
}

export function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    buffer = (buffer << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 255);
    }
  }
  return new Uint8Array(out);
}

export function encryptBackup(plaintextJson: string, passphrase: string, randomBytes: (n: number) => Uint8Array): EncryptedBackupFile {
  if (!passphrase) throw new Error('A passphrase is required.');
  const salt = randomBytes(16);
  const nonce = randomBytes(24);
  const key = scrypt(utf8ToBytes(passphrase.normalize('NFKC')), salt, SCRYPT);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(utf8ToBytes(plaintextJson));
  return {
    app: 'onlybudget',
    format: 'encrypted-backup',
    version: 1,
    kdf: { name: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt: bytesToBase64(salt) },
    cipher: 'xchacha20poly1305',
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
  };
}

export function isEncryptedBackupFile(x: unknown): x is EncryptedBackupFile {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.app === 'onlybudget' && o.format === 'encrypted-backup' && typeof o.ciphertext === 'string' && typeof o.nonce === 'string';
}

/** Throws if the passphrase is wrong or the file was tampered with. */
export function decryptBackup(file: EncryptedBackupFile, passphrase: string): string {
  const salt = base64ToBytes(file.kdf.salt);
  const key = scrypt(utf8ToBytes(passphrase.normalize('NFKC')), salt, { N: file.kdf.N, r: file.kdf.r, p: file.kdf.p, dkLen: 32 });
  const nonce = base64ToBytes(file.nonce);
  const plaintext = xchacha20poly1305(key, nonce).decrypt(base64ToBytes(file.ciphertext));
  return bytesToUtf8(plaintext);
}
