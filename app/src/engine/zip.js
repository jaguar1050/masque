// engine/zip.js — store-only zip writer and a small reader (design 03 §4.15, §5.8). Owner: WP11.
//
// zipStore writes method 0 (stored) entries with the UTF-8 name flag and a fixed DOS timestamp
// (1980-01-01 00:00), in the order given, so identical inputs give identical bytes. unzip
// reads what zipStore writes and ordinary archives from other tools: method 0, and method 8
// where the browser offers DecompressionStream("deflate-raw"). It verifies every CRC-32,
// refuses names that could escape a folder, refuses ZIP64, encryption and archives larger
// than the upload limit, and never touches the file system. Pure; no side effects.
import { LIMITS } from "./policy.js";

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const FLAG_UTF8 = 0x0800;
const FLAG_ENCRYPTED = 0x0001;
const VERSION = 20;                 // 2.0: what every unzip tool reads
const MAX_ENTRIES = 0xfffe;         // ZIP64 starts at 0xFFFF
const MAX_SIZE = 0xfffffffe;        // ZIP64 starts at 0xFFFFFFFF
/** Decompressed bytes accepted from one archive (a guard against zip bombs). */
const MAX_UNZIPPED = 5 * LIMITS.zipBytes;

/** Every zip error carries this name, so a caller can tell it from a programming error. */
export class ZipError extends Error {
  constructor(message) { super(message); this.name = "ZipError"; }
}

let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}

/**
 * CRC-32 (IEEE 802.3, the zip checksum) of a byte array, as an unsigned 32-bit number.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {number}
 */
export function crc32(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const utf8 = (s) => new TextEncoder().encode(String(s));

function toBytes(x, name) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  if (typeof x === "string") return utf8(x);
  throw new TypeError(`zipStore: entry "${name}" has no bytes`);
}

/** A name zipStore and unzip both accept: relative, forward slashes, no "." or ".." segment. */
export function safeEntryName(name) {
  const n = String(name);
  if (!n || n.length > 1024) return false;
  if (n.startsWith("/") || n.startsWith("\\") || /^[A-Za-z]:/.test(n)) return false;
  if (n.includes("\\") || n.includes("\u0000")) return false;
  const segs = n.replace(/\/$/, "").split("/");
  return segs.every((s) => s !== "" && s !== "." && s !== "..");
}

/**
 * A store-only zip (method 0): local headers, central directory and end record, every name
 * flagged UTF-8 (bit 11), every timestamp the fixed DOS date and time, entries in the order
 * given. The same entries always give the same bytes.
 * @param {Array<{name:string, bytes:(Uint8Array|ArrayBuffer|string)}>} entries
 * @param {{dosDate?:number, dosTime?:number}} [opts]  default 0x0021 / 0 = 1980-01-01 00:00
 * @returns {Uint8Array}
 */
export function zipStore(entries, { dosDate = 0x0021, dosTime = 0 } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length > MAX_ENTRIES) throw new ZipError(`too many entries for a zip without ZIP64 (${list.length})`);
  const seen = new Set();
  const prepared = list.map((e) => {
    const name = String(e && e.name);
    if (!safeEntryName(name)) throw new ZipError(`entry name "${name}" is not a safe relative path`);
    if (seen.has(name)) throw new ZipError(`duplicate entry "${name}"`);
    seen.add(name);
    const data = toBytes(e.bytes, name);
    if (data.length > MAX_SIZE) throw new ZipError(`entry "${name}" is too large for a zip without ZIP64`);
    const nameBytes = utf8(name);
    if (nameBytes.length > 0xffff) throw new ZipError(`entry name "${name}" is too long`);
    return { name, nameBytes, data, crc: crc32(data) };
  });

  let localSize = 0, centralSize = 0;
  for (const p of prepared) {
    localSize += 30 + p.nameBytes.length + p.data.length;
    centralSize += 46 + p.nameBytes.length;
  }
  if (localSize + centralSize + 22 > MAX_SIZE) throw new ZipError("archive is too large for a zip without ZIP64");
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let o = 0;
  const offsets = [];
  for (const p of prepared) {
    offsets.push(o);
    view.setUint32(o, SIG_LOCAL, true);
    view.setUint16(o + 4, VERSION, true);
    view.setUint16(o + 6, FLAG_UTF8, true);
    view.setUint16(o + 8, 0, true);                 // method 0: stored
    view.setUint16(o + 10, dosTime, true);
    view.setUint16(o + 12, dosDate, true);
    view.setUint32(o + 14, p.crc, true);
    view.setUint32(o + 18, p.data.length, true);    // compressed size
    view.setUint32(o + 22, p.data.length, true);    // uncompressed size
    view.setUint16(o + 26, p.nameBytes.length, true);
    view.setUint16(o + 28, 0, true);                // extra field length
    out.set(p.nameBytes, o + 30);
    out.set(p.data, o + 30 + p.nameBytes.length);
    o += 30 + p.nameBytes.length + p.data.length;
  }
  const cdStart = o;
  prepared.forEach((p, i) => {
    view.setUint32(o, SIG_CENTRAL, true);
    view.setUint16(o + 4, VERSION, true);           // made by: 2.0, MS-DOS attributes
    view.setUint16(o + 6, VERSION, true);
    view.setUint16(o + 8, FLAG_UTF8, true);
    view.setUint16(o + 10, 0, true);
    view.setUint16(o + 12, dosTime, true);
    view.setUint16(o + 14, dosDate, true);
    view.setUint32(o + 16, p.crc, true);
    view.setUint32(o + 20, p.data.length, true);
    view.setUint32(o + 24, p.data.length, true);
    view.setUint16(o + 28, p.nameBytes.length, true);
    view.setUint16(o + 30, 0, true);                // extra
    view.setUint16(o + 32, 0, true);                // comment
    view.setUint16(o + 34, 0, true);                // disk number start
    view.setUint16(o + 36, 0, true);                // internal attributes
    view.setUint32(o + 38, 0, true);                // external attributes
    view.setUint32(o + 42, offsets[i], true);
    out.set(p.nameBytes, o + 46);
    o += 46 + p.nameBytes.length;
  });
  view.setUint32(o, SIG_EOCD, true);
  view.setUint16(o + 4, 0, true);
  view.setUint16(o + 6, 0, true);
  view.setUint16(o + 8, prepared.length, true);
  view.setUint16(o + 10, prepared.length, true);
  view.setUint32(o + 12, o - cdStart, true);
  view.setUint32(o + 16, cdStart, true);
  view.setUint16(o + 20, 0, true);
  return out;
}

function findEocd(view) {
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) return i;
  }
  return -1;
}

async function inflateRaw(data, name) {
  if (typeof DecompressionStream !== "function") {
    throw new ZipError("this zip is compressed and this browser cannot decompress it; re-download it from screenAIr");
  }
  let ds;
  try { ds = new DecompressionStream("deflate-raw"); }
  catch (_) { throw new ZipError("this zip is compressed and this browser cannot decompress it; re-download it from screenAIr"); }
  try {
    const stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (err) {
    throw new ZipError(`"${name}" could not be decompressed (${err && err.message ? err.message : err})`);
  }
}

/**
 * Read a zip. Method 0 and method 8 (DecompressionStream("deflate-raw") when present);
 * every CRC-32 is verified; names with a ".." segment, a leading "/" or "\", a drive letter
 * or a backslash are refused; ZIP64, encrypted entries and multi-disk archives are refused.
 * Directory entries are skipped. Throws ZipError.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {Promise<Array<{name:string, bytes:Uint8Array}>>}  in central-directory order
 */
export async function unzip(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 22) throw new ZipError("not a zip file (too short)");
  if (b.length > LIMITS.zipBytes) throw new ZipError(`Too large (${b.length} > ${LIMITS.zipBytes})`);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const eocd = findEocd(view);
  if (eocd < 0) throw new ZipError("not a zip file (no end-of-central-directory record)");
  if (eocd >= 20 && view.getUint32(eocd - 20, true) === SIG_ZIP64_LOCATOR) throw new ZipError("ZIP64 archives are not supported");
  const disk = view.getUint16(eocd + 4, true);
  const cdDisk = view.getUint16(eocd + 6, true);
  const countDisk = view.getUint16(eocd + 8, true);
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ZipError("ZIP64 archives are not supported");
  if (disk !== 0 || cdDisk !== 0 || countDisk !== count) throw new ZipError("multi-part zip archives are not supported");
  if (cdOffset + cdSize > eocd) throw new ZipError("the zip's central directory is out of bounds");

  const decoderUtf8 = new TextDecoder("utf-8", { fatal: true });
  const out = [];
  const names = new Set();
  let total = 0;
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > eocd || view.getUint32(p, true) !== SIG_CENTRAL) throw new ZipError("the zip's central directory is damaged");
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const csize = view.getUint32(p + 20, true);
    const usize = view.getUint32(p + 24, true);
    const nlen = view.getUint16(p + 28, true);
    const xlen = view.getUint16(p + 30, true);
    const clen = view.getUint16(p + 32, true);
    const lho = view.getUint32(p + 42, true);
    const nameBytes = b.subarray(p + 46, p + 46 + nlen);
    let name;
    try { name = decoderUtf8.decode(nameBytes); }
    catch (_) { name = Array.from(nameBytes, (c) => String.fromCharCode(c)).join(""); }
    // ZIP64 extended information (header id 0x0001) in the central extra field.
    for (let x = p + 46 + nlen; x + 4 <= p + 46 + nlen + xlen;) {
      const id = view.getUint16(x, true);
      const len = view.getUint16(x + 2, true);
      if (id === 0x0001) throw new ZipError("ZIP64 archives are not supported");
      x += 4 + len;
    }
    p += 46 + nlen + xlen + clen;
    if (csize === 0xffffffff || usize === 0xffffffff || lho === 0xffffffff) throw new ZipError("ZIP64 archives are not supported");
    if (!safeEntryName(name)) throw new ZipError(`zip entry "${name}" is not allowed: names must be relative paths without ".."`);
    if (flags & FLAG_ENCRYPTED) throw new ZipError(`zip entry "${name}" is encrypted`);
    if (name.endsWith("/")) continue;                 // a directory entry
    if (names.has(name)) throw new ZipError(`zip entry "${name}" appears twice`);
    names.add(name);
    if (lho + 30 > b.length || view.getUint32(lho, true) !== SIG_LOCAL) throw new ZipError(`zip entry "${name}" has no local header`);
    const lnlen = view.getUint16(lho + 26, true);
    const lxlen = view.getUint16(lho + 28, true);
    for (let x = lho + 30 + lnlen; x + 4 <= lho + 30 + lnlen + lxlen;) {
      const id = view.getUint16(x, true);
      const len = view.getUint16(x + 2, true);
      if (id === 0x0001) throw new ZipError("ZIP64 archives are not supported");
      x += 4 + len;
    }
    const start = lho + 30 + lnlen + lxlen;
    if (start + csize > b.length) throw new ZipError(`zip entry "${name}" is truncated`);
    const raw = b.subarray(start, start + csize);
    total += usize;
    if (total > MAX_UNZIPPED) throw new ZipError(`the zip expands to more than ${MAX_UNZIPPED} bytes`);
    let data;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflateRaw(raw, name);
    else throw new ZipError(`zip entry "${name}" uses compression method ${method}, which screenAIr cannot read`);
    if (data.length !== usize) throw new ZipError(`zip entry "${name}" has the wrong size (${data.length} ≠ ${usize})`);
    if (crc32(data) !== crc) throw new ZipError(`zip entry "${name}" failed its CRC-32 check (the file is damaged)`);
    out.push({ name, bytes: data });
  }
  return out;
}

/** True when the bytes start like a zip (local header or an empty archive's end record). */
export function looksLikeZip(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 4) return false;
  const sig = (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
  return sig === SIG_LOCAL || sig === SIG_EOCD;
}

// The record signatures, for tests and readers of the format.
export const ZIP_SIGNATURES = Object.freeze({ SIG_LOCAL, SIG_CENTRAL, SIG_EOCD, SIG_ZIP64_LOCATOR, SIG_ZIP64_EOCD });
