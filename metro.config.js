// Metro config. Native builds need nothing special; the web build needs two
// things for expo-sqlite: the SQLite wasm file treated as an asset, and the
// dev server sending the cross-origin-isolation headers that SharedArrayBuffer
// requires (the production nginx config sets the same headers).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');
// The PDF text extractor page (assets/pdf/extractor.html) ships as an asset and runs in a WebView.
if (!config.resolver.assetExts.includes('html')) config.resolver.assetExts.push('html');

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    return middleware(req, res, next);
  },
};

module.exports = config;
