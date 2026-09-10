/**
 * Generates the app icon set without any native image dependencies:
 * a calm green field with a white speech-bubble-plus mark.
 *
 *   node scripts/generate-icons.js
 *
 * Writes assets/icon.png, android-icon-foreground.png, android-icon-background.png,
 * android-icon-monochrome.png, splash-icon.png and favicon.png.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GREEN = [0x3d, 0x6b, 0x5e];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- signed distance fields (in unit coordinates, 0..1) ----
function sdRoundedRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - hw + r;
  const dy = Math.abs(py - cy) - hh + r;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - r;
}
function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/** The mark: a rounded speech bubble with a plus sign cut out of it. Returns coverage 0..1. */
function markCoverage(u, v, scale, aa) {
  const cx = 0.5, cy = 0.47;
  const s = scale;
  let d = sdRoundedRect(u, v, cx, cy + 0.02 * s, 0.27 * s, 0.21 * s, 0.11 * s);
  // tail
  const tail = Math.max(
    sdRoundedRect(u, v, cx - 0.14 * s, cy + 0.27 * s, 0.07 * s, 0.07 * s, 0.015 * s),
    -(u - (cx - 0.21 * s)) - (v - (cy + 0.2 * s)) + 0.0 * s, // diagonal cut
  );
  d = Math.min(d, tail);
  // plus cut-out
  const bar1 = sdRoundedRect(u, v, cx, cy + 0.02 * s, 0.12 * s, 0.028 * s, 0.02 * s);
  const bar2 = sdRoundedRect(u, v, cx, cy + 0.02 * s, 0.028 * s, 0.12 * s, 0.02 * s);
  const plus = Math.min(bar1, bar2);
  d = Math.max(d, -plus);
  return Math.max(0, Math.min(1, 0.5 - d / aa));
}

function render(size, { background, foreground, markScale, transparentBg, fgAlphaOnly }) {
  const buf = Buffer.alloc(size * size * 4);
  const aa = 1.2 / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const cov = markCoverage(u, v, markScale, aa);
      let r, g, b, a;
      if (fgAlphaOnly) {
        r = foreground[0]; g = foreground[1]; b = foreground[2]; a = Math.round(cov * 255);
      } else if (transparentBg) {
        r = foreground[0]; g = foreground[1]; b = foreground[2]; a = Math.round(cov * 255);
      } else {
        r = Math.round(background[0] + (foreground[0] - background[0]) * cov);
        g = Math.round(background[1] + (foreground[1] - background[1]) * cov);
        b = Math.round(background[2] + (foreground[2] - background[2]) * cov);
        a = 255;
      }
      const i = (y * size + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
    }
  }
  return encodePng(size, size, buf);
}

function solid(size, color) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    buf[i * 4] = color[0]; buf[i * 4 + 1] = color[1]; buf[i * 4 + 2] = color[2]; buf[i * 4 + 3] = 255;
  }
  return encodePng(size, size, buf);
}

const out = path.join(__dirname, '..', 'assets');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.png'), render(1024, { background: GREEN, foreground: WHITE, markScale: 1.0 }));
fs.writeFileSync(path.join(out, 'android-icon-foreground.png'), render(1024, { background: GREEN, foreground: WHITE, markScale: 0.66, transparentBg: true }));
fs.writeFileSync(path.join(out, 'android-icon-background.png'), solid(1024, GREEN));
fs.writeFileSync(path.join(out, 'android-icon-monochrome.png'), render(1024, { background: GREEN, foreground: WHITE, markScale: 0.66, fgAlphaOnly: true }));
fs.writeFileSync(path.join(out, 'splash-icon.png'), render(1024, { background: GREEN, foreground: GREEN, markScale: 1.0, transparentBg: true }));
fs.writeFileSync(path.join(out, 'favicon.png'), render(64, { background: GREEN, foreground: WHITE, markScale: 1.0 }));
console.log('Icons written to', out);
