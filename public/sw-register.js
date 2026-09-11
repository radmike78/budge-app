// Registers the service worker. Kept in its own file so the page can run under a
// Content-Security-Policy that forbids inline scripts.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
