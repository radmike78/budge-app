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
window.__ob.run = async (maxPages) => {
  try {
    const data = b64ToBytes(window.__ob.chunks.join(''));
    window.__ob.chunks = [];
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false }).promise;
    const pages = Math.min(doc.numPages, maxPages || 300);
    const items = [];
    for (let p = 1; p <= pages; p += 1) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      for (const it of tc.items) {
        if (!('str' in it) || !it.str) continue;
        items.push({ str: it.str, x: Math.round(it.transform[4] * 10) / 10, y: Math.round(it.transform[5] * 10) / 10, w: Math.round(it.width * 10) / 10, page: p });
      }
      if (items.length > 200000) break;
    }
    post({ type: 'done', numPages: doc.numPages, items });
  } catch (e) {
    post({ type: 'error', message: String(e && e.message ? e.message : e) });
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
