// Copies the pdf.js worker into public/ so the web dev server can serve it (public/ is copied into dist by expo export).
const fs = require('fs');
const path = require('path');
const src = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'build/pdf.worker.min.mjs');
fs.copyFileSync(src, path.resolve(__dirname, '../public/pdf.worker.min.mjs'));
