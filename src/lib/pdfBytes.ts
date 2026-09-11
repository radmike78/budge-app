/**
 * Reading a PDF the user picked, with limits so a hostile or huge file cannot
 * exhaust memory: at most MAX_PDF_BYTES, and the extractor stops at MAX_PDF_PAGES.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 300;

export class PdfTooLargeError extends Error {
  constructor() {
    super('PDF too large');
    this.name = 'PdfTooLargeError';
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
  } else {
    buffer = await new File(asset.uri).arrayBuffer();
  }
  if (buffer.byteLength > MAX_PDF_BYTES) throw new PdfTooLargeError();
  const bytes = new Uint8Array(buffer);
  if (!looksLikePdf(bytes)) throw new Error('Not a PDF');
  return { name: asset.name, bytes };
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
