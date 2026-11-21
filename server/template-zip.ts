import { inflateRawSync } from "node:zlib";
import PizZip from "pizzip";

const expandedLimit = 40 * 1024 * 1024;

/** Validate actual expanded bytes, not just the untrusted ZIP size metadata.
 * ZIP64, encryption and split archives are not supported Word templates.
 */
export function boundedTemplateZip(bytes: Buffer): PizZip {
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557)) {
    if (
      bytes.readUInt32LE(end) === 0x06054b50 &&
      end + 22 + bytes.readUInt16LE(end + 20) === bytes.length
    )
      break;
    end--;
  }
  if (end < Math.max(0, bytes.length - 65557))
    throw new Error("Archivio Word non valido.");
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  if (
    bytes.readUInt32LE(end + 4) !== 0 ||
    count === 0xffff ||
    count !== bytes.readUInt16LE(end + 8) ||
    offset + bytes.readUInt32LE(end + 12) !== end
  )
    throw new Error("Archivio Word non supportato.");
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Archivio Word non valido.");
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const expanded = bytes.readUInt32LE(offset + 24);
    const local = bytes.readUInt32LE(offset + 42);
    if (expanded > expandedLimit - total)
      throw new Error("Template Word decompresso troppo grande.");
    if (
      bytes.readUInt16LE(offset + 8) & 1 ||
      bytes.readUInt32LE(local) !== 0x04034b50
    )
      throw new Error("Archivio Word non supportato.");
    const start =
      local +
      30 +
      bytes.readUInt16LE(local + 26) +
      bytes.readUInt16LE(local + 28);
    if (start + compressed > offset)
      throw new Error("Archivio Word non valido.");
    const content = bytes.subarray(start, start + compressed);
    const length =
      method === 0
        ? content.length
        : method === 8
          ? inflateRawSync(content, {
              maxOutputLength: Math.max(1, expandedLimit - total),
            }).length
          : -1;
    if (length !== expanded || length > expandedLimit - total)
      throw new Error("Dimensione archivio Word non valida.");
    total += length;
    offset +=
      46 +
      bytes.readUInt16LE(offset + 28) +
      bytes.readUInt16LE(offset + 30) +
      bytes.readUInt16LE(offset + 32);
  }
  if (offset !== end) throw new Error("Archivio Word non valido.");
  return new PizZip(bytes);
}
