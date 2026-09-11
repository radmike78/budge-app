# Security

OnlyBudget holds personal money data on the phone and nowhere else. This page lists what the app does to protect it, mapped to the OWASP Mobile Top 10 (2024) and the OWASP Mobile Application Security Verification Standard (MASVS), and how each point is tested.

The short version: there is no server, no account, no bank link and no analytics, so the classic remote attacks have nothing to reach. What remains is the phone itself, files the user imports, the optional Smart Assist reply, and the web build's browser sandbox. Each of those is a trust boundary with validation on it and a test behind it.

## Threat model

| Asset | Where it lives | Who could reach it |
|---|---|---|
| Entries, goals, reminders, settings | SQLite file in the app's private sandbox | Another app cannot. Someone holding the unlocked phone can, unless the app lock is on. |
| Optional API key for Smart Assist | iOS Keychain / Android Keystore, device-only, unlocked-only | Only this app, only on this device. |
| Backups the user exports | Wherever they save them | Anyone with the file. Encrypted backups need the passphrase. |
| Web build data | Browser origin storage (OPFS) | Scripts on that origin. The CSP allows only the app's own scripts. |

## Controls, by OWASP category

**M1 Improper credential usage / MASVS-STORAGE.** The app never asks for bank credentials. The only secret is the user's optional Anthropic key, stored with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` and never logged or exported. On the web build it lives in `localStorage` for the app's origin only, protected by the CSP below. Backups never contain it.

**M2 Supply chain.** Dependencies are pinned to Expo's SDK set. `npm audit` is run in CI. The Kubernetes manifests run the web image as a non-root user with a read-only filesystem.

**M3 Authentication / MASVS-AUTH.** The optional **app lock** (Settings → Lock the app) asks for Face ID, fingerprint or the device passcode when the app opens and again after 30 seconds in the background. While the lock is on, the app also covers its content in the app switcher so amounts do not appear in screenshots. The OS answers yes or no; the app stores no PIN of its own. Turning the lock on requires a successful unlock first, and a restored backup can never switch it off or on.

**M4 Input validation / MASVS-CODE.** Everything that crosses a trust boundary is validated in `src/lib/validate.ts`:

- Typed or spoken entries are capped at 400 characters and stripped of control, zero-width and bidi-override characters before parsing. The parser only ever treats input as text; it never builds a regular expression from user data (learned words and category names are matched as plain strings). It is fuzzed in the tests with the OWASP injection strings, ReDoS patterns and 10,000-character inputs, in all eight languages, with a 500 ms budget each.
- Backup files are rebuilt row by row from scratch: ids must match `[A-Za-z0-9_-]{1,64}`, amounts must be finite, non-negative and below 10^12, dates must be real calendar dates, enums must be one of the known values, references to missing categories are dropped, duplicates and row counts above 200,000 are refused, files above 50 MB are refused before parsing, and unknown fields (including prototype keys) never reach SQLite. Security-sensitive settings (Smart Assist, app lock) are never taken from a file.
- Smart Assist replies are validated the same way: type and kind must be from the fixed enums, amounts are bounded, text is cleaned and capped, and anything else makes the app fall back to "please check the fields".
- All SQL uses bound parameters. A test scans the repository module and fails on any interpolated SQL.

**Statement import (PDF).** A PDF the user picks is untrusted input. It is checked for the `%PDF-` header and a 25 MB cap before parsing, and pdf.js is run with `isEvalSupported: false`, capped at 300 pages and 200,000 text items. On the phone pdf.js runs inside a hidden WebView whose own Content-Security-Policy is `default-src 'none'` with no network, no file access, no storage and no window opening; the only way in is base64 chunks of the file and the only way out is the JSON list of text items. On the web it runs in the page's same-origin worker under the site CSP. The parsed text is then plain data: every line is rebuilt as a typed entry with bounded amounts, real dates and capped descriptions, and shown on a review screen before anything is saved. `__tests__/security.test.ts` feeds the OWASP injection strings and 50,000-item malformed layouts through the statement and credit-report parsers with a time budget.

**M5 Insecure communication / MASVS-NETWORK.** The only outbound host is `api.anthropic.com`, and only when the user has turned Smart Assist on. Android has `usesCleartextTraffic: false`; iOS App Transport Security is at its default (HTTPS only). A test scans the source for any other URL or `fetch` call.

**M6 Privacy.** No identifiers, no analytics, no crash reporting that leaves the device. Voice is processed on-device where the platform supports it. Android auto-backup to Google is switched off (`allowBackup: false`) because the app has its own encrypted backup. The Android build declares no permissions beyond microphone (voice), notifications (reminders) and biometrics (app lock).

**M7 Binary protections.** No secrets in the source tree (tested), no debug logging of user data (tested), Hermes bytecode on device.

**M8 Security misconfiguration.** The web image sends the OWASP Secure Headers on every response: `Content-Security-Policy` (`default-src 'self'`, scripts from self plus `wasm-unsafe-eval` for SQLite, `connect-src` limited to self and the Anthropic API, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Strict-Transport-Security`, plus the cross-origin isolation headers. The page contains no inline scripts, so the CSP forbids them. `scripts/web-security-check.mjs` serves the real build with exactly these headers, loads it in headless Chromium, and fails on any CSP violation, page error or failure to open the database.

**M9 Insecure data storage.** SQLite sits in the app sandbox; no copies are made to shared storage. Exports go through the OS share sheet to a destination the user picks. Encrypted backups are the recommended way to move data.

**M10 Insufficient cryptography / MASVS-CRYPTO.** Encrypted backups use scrypt (N=2^15, r=8, p=1, 16-byte random salt) to derive a 256-bit key, and XChaCha20-Poly1305 with a 24-byte random nonce. Passphrases are NFKC-normalised and must be at least 8 characters. A file is decrypted only if it declares exactly this format and its scrypt cost is within safe bounds, so a hostile file cannot ask the phone to burn gigabytes of memory. Tests check that salt and nonce are fresh on every export, that a wrong passphrase, a flipped byte or a swapped nonce all fail, and that no plaintext appears in the file.

## Running the checks

```bash
npm test                              # includes __tests__/security.test.ts
npm run build:web && npm run check:web-security   # headless Chromium under the real headers
npm audit --omit=dev
```

## Reporting

If you find a problem, open an issue marked "security" or email the maintainer. Please do not include real budget data in reports.
