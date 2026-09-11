/**
 * Drives the real web build (the same React Native components as the phone apps)
 * in headless Chromium at phone and tablet sizes, walks through onboarding, adds
 * a few entries by typing, and screenshots every screen. Output goes to the
 * directory given as the second argument.
 *
 *   npm run build:web && node scripts/ui-screenshots.mjs dist out/shots
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const dist = path.resolve(process.argv[2] || 'dist');
const out = path.resolve(process.argv[3] || 'shots');
fs.mkdirSync(out, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); } catch {
  playwright = createRequire(import.meta.url)(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { devices } = playwright;

const PROFILES = [
  { name: 'iphone-15', ...devices['iPhone 15'] },
  { name: 'pixel-7', ...devices['Pixel 7'] },
  { name: 'iphone-se', ...devices['iPhone SE'] },
  { name: 'ipad-portrait', ...devices['iPad (gen 7)'] },
  { name: 'ipad-landscape', ...devices['iPad (gen 7) landscape'] },
  { name: 'galaxy-tab', viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['Galaxy Tab S4'].userAgent },
];

const ENTRIES = [
  'got paid 2400',
  'spent 12 on lunch',
  'gas 40 yesterday',
  'netflix 15.49',
  "I spent $67.99 at Macy's and $121.53 at Fleming's Steakhouse",
  'goal: save 3000 for a trip to Japan by June',
  'Make a plan to pay down $5,000 of debt within 12 months',
  'remind me to pay rent on the 1st at 9am',
];

const browser = await playwright.chromium.launch({ headless: true });
const results = {};

for (const profile of PROFILES) {
  const { name, ...device } = profile;
  const context = await browser.newContext({ ...device, colorScheme: 'light', locale: 'en-US' });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  const shots = [];
  const shot = async (label) => {
    const file = path.join(out, `${name}--${label}.png`);
    await page.waitForTimeout(350);
    await page.screenshot({ path: file, fullPage: false });
    shots.push({ label, file });
  };
  const clickText = async (text, timeout = 8000) => {
    const el = page.getByText(text, { exact: true }).first();
    await el.waitFor({ state: 'visible', timeout });
    await el.click();
  };
  const goto = async (route) => { await page.goto(origin + route, { waitUntil: 'load' }); await page.waitForTimeout(800); };

  try {
    await goto('/');
    await page.getByText('OnlyBudget').first().waitFor({ timeout: 30000 });
    await shot('01-onboarding');
    await clickText('Next');
    await shot('02-onboarding-2');
    await clickText('Next');
    await shot('03-onboarding-3');
    await clickText('Start');
    await page.waitForTimeout(800);
    await shot('04-today-empty');

    const input = page.getByRole('textbox').first();
    for (const [i, text] of ENTRIES.entries()) {
      await input.click();
      await input.fill(text);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(700);
      if (i === 1) await shot('05-confirmation-card');
      if (i === 4) await shot('06-multi-entry-card');
      if (i === 5) await shot('07-goal-card');
      if (i === 7) await shot('08-reminder-card');
      const button = page.getByRole('button', { name: /^(Save|Save all|Set goal|Set reminder)$/ }).first();
      await button.waitFor({ state: 'visible', timeout: 8000 });
      await button.click();
      await page.waitForTimeout(700);
    }
    await shot('09-today');
    await goto('/budget'); await shot('10-budget');
    await goto('/goals'); await shot('11-goals');
    await goto('/history'); await shot('12-history');
    await goto('/settings'); await shot('13-settings');
    await goto('/debts'); await shot('14-debts');
    await goto('/import'); await shot('15-import');
    await goto('/settings/reminders'); await shot('16-reminders');
    await goto('/goal/new'); await shot('17-goal-editor');
    await context.close();
    results[name] = { ok: true, viewport: device.viewport, shots: shots.map((s) => path.basename(s.file)) };
  } catch (e) {
    await shot('99-error').catch(() => {});
    results[name] = { ok: false, error: String(e).slice(0, 300), shots: shots.map((s) => path.basename(s.file)) };
    await context.close();
  }
}
await browser.close();
server.close();
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
