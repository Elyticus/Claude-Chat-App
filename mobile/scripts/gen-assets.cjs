// Generates the app's PNG assets (icon / adaptive-icon / splash / favicon) as
// valid PNGs so Expo + EAS builds don't choke on placeholder files. The art is
// a simple indigo "loop" ring on the dark brand background — no external deps.
//
//   node scripts/gen-assets.cjs
//
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x0f, 0x17, 0x2a]; // #0f172a brand background
const FG = [0x63, 0x66, 0xf1]; // #6366f1 brand primary (indigo)

// CRC32 (PNG chunk checksums)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Draw a centered ring; `ringScale` shrinks it (Android adaptive-icon safe zone).
function makePng(size, ringScale = 1) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.34 * ringScale;
  const innerR = size * 0.20 * ringScale;
  const stride = size * 4 + 1; // +1 filter byte per scanline
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter type 0 (none)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const inRing = d <= outerR && d >= innerR;
      const [r, g, b] = inRing ? FG : BG;
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'assets');
const targets = [
  ['icon.png', 1024, 1],
  ['adaptive-icon.png', 1024, 0.62], // foreground kept inside the mask safe zone
  ['splash.png', 1024, 1],
  ['favicon.png', 48, 1],
];
for (const [name, size, scale] of targets) {
  fs.writeFileSync(path.join(outDir, name), makePng(size, scale));
  console.log(`wrote assets/${name} (${size}x${size})`);
}
