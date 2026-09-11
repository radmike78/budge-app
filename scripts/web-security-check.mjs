/**
 * Serves the exported web build with exactly the headers from deploy/nginx/default.conf,
 * opens it in headless Chromium, and fails if the Content-Security-Policy blocks anything
 * the app needs (scripts, the SQLite WebAssembly worker, styles) or if the page throws.
 * It also checks the headers themselves against the OWASP Secure Headers list.
 *
 *   npm run build:web && node scripts/web-security-check.mjs [dist]
 *
 * Needs Playwright (npm i -g playwright, or as a dev dependency) and a Chromium build.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const dist = path.resolve(process.argv[2] || 'dist');
const conf = fs.readFileSync(path.resolve('deploy/nginx/default.conf'), 'utf8');
const serverBlock = conf.split('location ')[0];
const headers = Object.fromEntries([...serverBlock.matchAll(/add_header\s+([\w-]+)\s+"([^"]+)"/g)].map((m) => [m[1], m[2]]));

const REQUIRED = ['Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy'];
const missing = REQUIRED.filter((h) => !headers[h]);
if (missing.length) { console.error('Missing headers in nginx config:', missing.join(', ')); process.exit(1); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

let playwright;
try {
  playwright = createRequire(import.meta.url)('playwright');
} catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  playwright = createRequire(import.meta.url)(path.join(globalRoot, 'playwright'));
}

const browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
const violations = [];
const errors = [];
page.on('console', (msg) => { if (/Content Security Policy|Refused to/.test(msg.text())) violations.push(msg.text()); else if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('requestfailed', (req) => errors.push(`request failed: ${req.url()} ${req.failure()?.errorText ?? ''}`));

await page.goto(origin + '/', { waitUntil: 'load' });
// The onboarding screen only renders after SQLite (WebAssembly worker) opened the database.
let rendered = false;
try {
  await page.waitForFunction(() => document.body && document.body.innerText.includes('OnlyBudget') && !document.querySelector('[data-testid="open-error"]'), { timeout: 30000 });
  rendered = true;
} catch {
  rendered = false;
}
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
const isolated = await page.evaluate(() => window.crossOriginIsolated === true);
await browser.close();
server.close();

const report = { origin, headers: Object.keys(headers), rendered, crossOriginIsolated: isolated, cspViolations: violations, errors, preview: bodyText.replace(/\s+/g, ' ').slice(0, 160) };
console.log(JSON.stringify(report, null, 2));
if (!rendered || violations.length || errors.length) {
  console.error('Web security check FAILED');
  process.exit(1);
}
console.log('Web security check passed: page renders under CSP with all secure headers, no violations.');
