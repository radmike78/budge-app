/**
 * Reading a PDF the user picked, with limits so a hostile or huge file cannot
 * exhaust memory: at most MAX_PDF_BYTES, and the extractor stops at MAX_PDF_PAGES.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { scanPdfBytes } from './pdfScan';

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 300;

export class PdfTooLargeError extends Error {
  constructor() {
    super('PDF too large');
    this.name = 'PdfTooLargeError';
  }
}

/** The file carries scripts, launch actions, attachments, forms or media, and is refused. */
export class PdfBlockedError extends Error {
  constructor(public readonly reasons: string[]) {
    super(`PDF blocked: ${reasons.join(', ')}`);
    this.name = 'PdfBlockedError';
  }
}

export class PdfEncryptedError extends Error {
  constructor() {
    super('PDF is password-protected');
    this.name = 'PdfEncryptedError';
  }
}

export interface PickedPdf {
  name: string;
  bytes: Uint8Array;
}

/** Opens the system file picker for a PDF and returns its bytes, or null if cancelled. */
export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (asset.size != null && asset.size > MAX_PDF_BYTES) throw new PdfTooLargeError();
  let buffer: ArrayBuffer;
  if (Platform.OS === 'web') {
    const webFile = (asset as { file?: Blob }).file;
    buffer = webFile ? await webFile.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
    if (asset.uri.startsWith('blob:')) { try { URL.revokeObjectURL(asset.uri); } catch { /* already gone */ } }
  } else {
    // The picker copies the PDF into the app cache. Read it once, then delete that copy
    // straight away: the statement itself is never kept, only the entries the user approves.
    const file = new File(asset.uri);
    try {
      buffer = await file.arrayBuffer();
    } finally {
      deleteQuietly(file);
    }
  }
  if (buffer.byteLength > MAX_PDF_BYTES) throw new PdfTooLargeError();
  const bytes = new Uint8Array(buffer);
  if (!looksLikePdf(bytes)) throw new Error('Not a PDF');
  const scan = scanPdfBytes(bytes);
  if (scan.blocked) { bytes.fill(0); throw new PdfBlockedError(scan.markers); }
  if (scan.encrypted) { bytes.fill(0); throw new PdfEncryptedError(); }
  return { name: asset.name, bytes };
}

function deleteQuietly(entry: File | Directory): void {
  try {
    if (entry.exists) entry.delete();
  } catch {
    // Best effort; the sweep on next launch tries again.
  }
}

/**
 * Removes any PDF (or picker copy) left in the app cache, for example after the
 * app was closed in the middle of an import. Runs at every launch.
 */
export async function sweepImportCache(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  let removed = 0;
  const walk = (dir: Directory, depth: number) => {
    if (depth > 3) return;
    let entries: (Directory | File)[] = [];
    try {
      entries = dir.list();
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name.toLowerCase();
      if (entry instanceof Directory) {
        if (name === 'documentpicker') { deleteQuietly(entry); removed += 1; } else walk(entry, depth + 1);
      } else if (name.endsWith('.pdf')) {
        deleteQuietly(entry);
        removed += 1;
      }
    }
  };
  try {
    walk(Paths.cache, 0);
  } catch {
    // nothing to sweep
  }
  return removed;
}

/** "%PDF-" within the first kilobyte (some writers add a byte-order mark or a comment first). */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.slice(0, Math.min(1024, bytes.length)));
  return head.includes('%PDF-');
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 without relying on a global btoa (Hermes has it, but this keeps the lib free of platform assumptions). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((i + 1 < bytes.length ? bytes[i + 1] : 0) << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + '=';
  }
  return out;
}
