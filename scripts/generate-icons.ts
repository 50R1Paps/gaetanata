// Dependency-free raster icon: a white G on a teal rounded square.
// Run: node --experimental-strip-types scripts/generate-icons.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([head, body, tail]);
}

const size = 256;
const pixels = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const dx = x - 128;
    const dy = y - 128;
    const radius = Math.hypot(dx, dy);
    const letter =
      (radius > 57 && radius < 83 && !(dx > 25 && dy < -14)) ||
      (x >= 130 && x <= 210 && y >= 123 && y <= 147) ||
      (x >= 184 && x <= 210 && y >= 123 && y <= 179);
    const rounded =
      Math.hypot(Math.max(24 - x, 0, x - 231), Math.max(24 - y, 0, y - 231)) <=
      24;
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    pixels.set(
      letter ? [255, 255, 255, 255] : [15, 118, 110, rounded ? 255 : 0],
      offset,
    );
  }
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(pixels)),
  chunk("IEND", Buffer.alloc(0)),
]);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
const icns = Buffer.alloc(16);
icns.write("icns", 0);
icns.writeUInt32BE(png.length + 16, 4);
icns.write("ic08", 8);
icns.writeUInt32BE(png.length + 8, 12);
mkdirSync("assets", { recursive: true });
mkdirSync("public", { recursive: true });
writeFileSync("assets/gaetanata.png", png);
writeFileSync("assets/gaetanata.ico", Buffer.concat([ico, png]));
writeFileSync("assets/gaetanata.icns", Buffer.concat([icns, png]));
writeFileSync("public/favicon.png", png);
