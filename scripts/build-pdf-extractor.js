/**
 * Builds assets/pdf/extractor.html: a self-contained page with pdf.js inlined
 * that reads a PDF (sent in as base64) and posts back every text item with its
 * position. On the phone it runs inside a sandboxed WebView with no network,
 * so statements never leave the device. Re-run after upgrading pdfjs-dist:
 *
 *   node scripts/build-pdf-extractor.js
 */
const fs = require('fs');
const path = require('path');

const dist = path.dirname(require.resolve('pdfjs-dist/package.json'));
const lib = fs.readFileSync(path.join(dist, 'build/pdf.min.mjs'), 'utf8');
const worker = fs.readFileSync(path.join(dist, 'build/pdf.worker.min.mjs'), 'utf8');
const version = require('pdfjs-dist/package.json').version;

const app = `
window.__ob = { chunks: [], ready: false };
const post = (obj) => (window.ReactNativeWebView || { postMessage: (s) => console.log(s) }).postMessage(JSON.stringify(obj));
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
window.__ob.addChunk = (chunk) => { window.__ob.chunks.push(chunk); };
// Same rules as src/lib/pdfInspect.ts: scripts, attachments, media and launch links are refused.
const MEDIA_SUBTYPES = new Set(['FileAttachment', 'RichMedia', 'Screen', 'Movie', 'Sound', '3D']);
const SAFE_URL = /^(?:https?:|mailto:|tel:)/i;
async function inspect(doc, maxPages) {
  const reasons = new Set();
  const docJs = await doc.getJSActions().catch(() => null);
  if (docJs && Object.keys(docJs).length) reasons.add('script');
  const attachments = await doc.getAttachments().catch(() => null);
  if (attachments && Object.keys(attachments).length) reasons.add('attachment');
  const pages = Math.min(doc.numPages, maxPages);
  for (let p = 1; p <= pages; p += 1) {
    const page = await doc.getPage(p);
    const js = await page.getJSActions().catch(() => null);
    if (js && Object.keys(js).length) reasons.add('script');
    const annots = await page.getAnnotations().catch(() => []);
    for (const a of annots) {
      if (a.subtype && MEDIA_SUBTYPES.has(a.subtype)) reasons.add(a.subtype === 'FileAttachment' ? 'attachment' : 'media');
      if (a.file || a.richMedia) reasons.add('attachment');
      const target = a.unsafeUrl != null ? a.unsafeUrl : a.url;
      if (typeof target === 'string' && target && !SAFE_URL.test(target)) reasons.add('launch');
    }
    if (reasons.size >= 3) break;
  }
  return [...reasons];
}
window.__ob.run = async (maxPages) => {
  try {
    const data = b64ToBytes(window.__ob.chunks.join(''));
    window.__ob.chunks = [];
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false, enableXfa: false }).promise;
    const pages = Math.min(doc.numPages, maxPages || 300);
    const reasons = await inspect(doc, pages);
    if (reasons.length) { post({ type: 'blocked', reasons }); await doc.destroy(); return; }
    const items = [];
    outer: for (let p = 1; p <= pages; p += 1) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      for (const it of tc.items) {
        if (!('str' in it) || !it.str) continue;
        items.push({ str: String(it.str).slice(0, 500), x: Math.round(it.transform[4] * 10) / 10, y: Math.round(it.transform[5] * 10) / 10, w: Math.round(it.width * 10) / 10, page: p });
        if (items.length >= 200000) break outer;
      }
    }
    post({ type: 'done', numPages: doc.numPages, items });
    await doc.destroy();
  } catch (e) {
    const name = e && e.name ? String(e.name) : '';
    post({ type: 'error', code: name === 'PasswordException' ? 'password' : 'parse', message: String(e && e.message ? e.message : e).slice(0, 200) });
  }
};
post({ type: 'ready' });
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; style-src 'unsafe-inline'"><title>OnlyBudget PDF text</title></head><body>
<script id="pdfjs-worker" type="text/plain">${worker.replace(/<\/script/gi, '<\\/script')}</script>
<script type="module">
${lib.replace(/<\/script/gi, '<\\/script')}
const workerText = document.getElementById('pdfjs-worker').textContent;
GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerText], { type: 'text/javascript' }));
window.pdfjsLib = { getDocument, version: '${version}' };
${app}
</script>
</body></html>`;

const out = path.resolve(__dirname, '../assets/pdf/extractor.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB, pdfjs ${version})`);
