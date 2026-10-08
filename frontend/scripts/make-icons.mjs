import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits per channel
  header[9] = 6; // RGBA
  const rowLength = size * 4 + 1;
  const raw = Buffer.alloc(rowLength * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLength] = 0; // no filter
    rgba.copy(raw, y * rowLength + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const cover = (d) => clamp(0.5 - d, 0, 1); // distance in pixels -> how much of the pixel is covered

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// A white stopwatch on a peach-to-coral gradient
function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size * 0.54;
  const radius = 0.3 * size;
  const ringWidth = 0.06 * size;
  const start = [255, 184, 140];
  const end = [255, 111, 77];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = (px + py) / (2 * size);
      const colour = start.map((s, i) => s + (end[i] - s) * t);

      const dist = Math.hypot(px - cx, py - cy);
      const ring = Math.abs(dist - (radius - ringWidth / 2)) - ringWidth / 2;
      const minuteHand = segmentDistance(px, py, cx, cy, cx, cy - 0.2 * size) - 0.032 * size;
      const hourHand = segmentDistance(px, py, cx, cy, cx + 0.13 * size, cy + 0.07 * size) - 0.032 * size;
      const stem = segmentDistance(px, py, cx, cy - radius, cx, cy - radius - 0.03 * size) - 0.02 * size;
      const button =
        segmentDistance(
          px, py,
          cx - 0.035 * size, cy - radius - 0.05 * size,
          cx + 0.035 * size, cy - radius - 0.05 * size
        ) - 0.028 * size;
      const centre = dist - 0.045 * size;

      const a = Math.max(cover(ring), cover(minuteHand), cover(hourHand), cover(stem), cover(button), cover(centre));
      const i = (y * size + x) * 4;
      pixels[i] = Math.round(colour[0] * (1 - a) + 255 * a);
      pixels[i + 1] = Math.round(colour[1] * (1 - a) + 255 * a);
      pixels[i + 2] = Math.round(colour[2] * (1 - a) + 255 * a);
      pixels[i + 3] = 255;
    }
  }
  return encodePng(size, pixels);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-512.png", drawIcon(512));
writeFileSync("public/icons/icon-192.png", drawIcon(192));
writeFileSync("public/icons/apple-touch-icon.png", drawIcon(180));
console.log("Icons created in public/icons");
