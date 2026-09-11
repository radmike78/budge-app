/**
 * Runs the real pdf.js against the test fixtures with the same inspection the app
 * uses, and fails if a PDF carrying JavaScript, an embedded file and a launch link
 * is not refused, or if a clean statement is.
 *
 *   node --experimental-strip-types scripts/pdf-security-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { inspectPdfDocument } from '../src/lib/pdfInspect.ts';
import { scanPdfBytes } from '../src/lib/pdfScan.ts';

const require = createRequire(import.meta.url);
const pdfjs = await import(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
const fonts = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts/');

async function check(file) {
  const bytes = new Uint8Array(fs.readFileSync(path.resolve('__tests__/fixtures', file)));
  const scan = scanPdfBytes(bytes);
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, enableXfa: false, standardFontDataUrl: fonts }).promise;
  const reasons = await inspectPdfDocument(doc, 300);
  await doc.destroy();
  return { scan, reasons };
}

const bad = await check('active-content.pdf');
const clean = await check('bank.pdf');
console.log(JSON.stringify({ bad, clean }, null, 2));
const ok = bad.scan.blocked && ['script', 'attachment', 'launch'].every((r) => bad.reasons.includes(r)) && !clean.scan.blocked && clean.reasons.length === 0;
if (!ok) { console.error('PDF security check FAILED'); process.exit(1); }
console.log('PDF security check passed: active content is refused by both layers; a clean statement is not.');
