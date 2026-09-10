/**
 * Adds the PWA bits to the exported web build (dist/index.html): manifest,
 * icons, theme colours and the service-worker registration. Expo's "single"
 * output uses its own HTML template, so this runs after `expo export`.
 *
 *   node scripts/postbuild-web.js [dist]
 */
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] || 'dist');
const file = path.join(dist, 'index.html');
let html = fs.readFileSync(file, 'utf8');

const head = `
    <meta name="description" content="Only a budget. Nothing else. No bank linking, no ads, no accounts." />
    <meta name="application-name" content="OnlyBudget" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="OnlyBudget" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F7F6F3" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141412" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <style>html,body{background:#F7F6F3}@media(prefers-color-scheme:dark){html,body{background:#141412}}</style>
    <script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>
`;

if (!html.includes('manifest.webmanifest')) {
  html = html.replace('</head>', `${head}</head>`);
  html = html.replace('<link rel="icon" href="/favicon.ico"/>', '<link rel="icon" href="/favicon.ico"/><link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png"/>');
  html = html.replace('viewport-fit=cover', 'viewport-fit=cover').replace('shrink-to-fit=no"', 'shrink-to-fit=no, viewport-fit=cover"');
  fs.writeFileSync(file, html);
  console.log('PWA tags added to', file);
} else {
  console.log('PWA tags already present in', file);
}
