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

const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
/** Bounds on the key-derivation cost a file may ask for, so a hostile file cannot exhaust memory or time. */
const KDF_LIMITS = { minN: 2 ** 14, maxN: 2 ** 20, maxR: 16, maxP: 4 };

/**
 * True only for a well-formed file of the one format this app writes. Anything
 * else (other ciphers, missing salt, out-of-range scrypt cost) is not decrypted.
 */
export function isEncryptedBackupFile(x: unknown): x is EncryptedBackupFile {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.app !== 'onlybudget' || o.format !== 'encrypted-backup' || o.cipher !== 'xchacha20poly1305') return false;
  if (typeof o.ciphertext !== 'string' || !B64_RE.test(o.ciphertext) || o.ciphertext.length > 200 * 1024 * 1024) return false;
  if (typeof o.nonce !== 'string' || !B64_RE.test(o.nonce) || o.nonce.length !== 32) return false;
  const kdf = o.kdf as Record<string, unknown> | undefined;
  if (!kdf || typeof kdf !== 'object' || kdf.name !== 'scrypt') return false;
  if (typeof kdf.salt !== 'string' || !B64_RE.test(kdf.salt) || kdf.salt.length < 16 || kdf.salt.length > 64) return false;
  const { N, r, p } = kdf;
  if (typeof N !== 'number' || typeof r !== 'number' || typeof p !== 'number') return false;
  if (!Number.isInteger(N) || N < KDF_LIMITS.minN || N > KDF_LIMITS.maxN || (N & (N - 1)) !== 0) return false;
  if (!Number.isInteger(r) || r < 1 || r > KDF_LIMITS.maxR || !Number.isInteger(p) || p < 1 || p > KDF_LIMITS.maxP) return false;
  return true;
}

/** Throws if the passphrase is wrong or the file was tampered with. */
export function decryptBackup(file: EncryptedBackupFile, passphrase: string): string {
  if (!isEncryptedBackupFile(file)) throw new Error('Not an OnlyBudget encrypted backup');
  const salt = base64ToBytes(file.kdf.salt);
  const key = scrypt(utf8ToBytes(passphrase.normalize('NFKC')), salt, { N: file.kdf.N, r: file.kdf.r, p: file.kdf.p, dkLen: 32 });
  const nonce = base64ToBytes(file.nonce);
  const plaintext = xchacha20poly1305(key, nonce).decrypt(base64ToBytes(file.ciphertext));
  return bytesToUtf8(plaintext);
}
