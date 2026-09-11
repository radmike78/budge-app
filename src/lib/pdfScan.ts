/**
 * Active-content check for PDFs before anything opens them (OWASP MASVS-CODE /
 * "malicious file upload"). A statement is text and tables; it never needs
 * scripts, launch actions, embedded files, forms or media. If a file carries
 * any of those, the app refuses it instead of trusting a parser to ignore them.
 *
 * Two layers: a byte scan here (cheap, catches the plain and hex-escaped names),
 * and the parsed-object inspection in pdfInspect.ts after pdf.js has decoded
 * compressed object streams (catches what a byte scan cannot see).
 */

/** PDF name keys that mean "this file can do something", with what they are for. */
export const ACTIVE_CONTENT_MARKERS: Record<string, string> = {
  JavaScript: 'script',
  JS: 'script',
  Launch: 'launch',
  EmbeddedFile: 'attachment',
  EmbeddedFiles: 'attachment',
  FileAttachment: 'attachment',
  RichMedia: 'media',
  XFA: 'form',
  AcroForm: 'form',
  SubmitForm: 'form',
  ImportData: 'form',
  GoToR: 'remote',
  GoToE: 'remote',
  Sound: 'media',
  Movie: 'media',
  Screen: 'media',
  '3D': 'media',
  Rendition: 'media',
};

export interface PdfScanResult {
  /** True when the file must not be opened. */
  blocked: boolean;
  /** Marker names found, e.g. ["JavaScript", "Launch"]. */
  markers: string[];
  /** Password-protected file. */
  encrypted: boolean;
}

const MARKER_NAMES = Object.keys(ACTIVE_CONTENT_MARKERS);
// Name objects can hide letters as #xx hex escapes ("/J#61vaScript"), so decode before matching.
const NAME_RE = /\/((?:[A-Za-z0-9#]|[^\s\/\[\]<>()]){1,32})/g;

function decodeName(raw: string): string {
  return raw.replace(/#([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Latin-1 view of the bytes; PDF syntax is ASCII, so this is enough for name matching. */
function latin1(bytes: Uint8Array, max: number): string {
  const n = Math.min(bytes.length, max);
  let s = '';
  for (let i = 0; i < n; i += 1) s += String.fromCharCode(bytes[i]);
  return s;
}

/**
 * Scans the raw bytes of a PDF for active-content markers. `AcroForm` on its own
 * (a plain fillable form) is reported but does not block; everything else does.
 */
export function scanPdfBytes(bytes: Uint8Array, maxBytes = 30 * 1024 * 1024): PdfScanResult {
  const text = latin1(bytes, maxBytes);
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  NAME_RE.lastIndex = 0;
  while ((m = NAME_RE.exec(text)) !== null) {
    const name = decodeName(m[1]);
    if (MARKER_NAMES.includes(name)) found.add(name);
  }
  const encrypted = /\/Encrypt\b/.test(text);
  const markers = [...found];
  const blocked = markers.some((k) => k !== 'AcroForm');
  return { blocked, markers, encrypted };
}
