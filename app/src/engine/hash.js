// engine/hash.js — hashing and canonical JSON (design 03 §3.10, §4.3).
//
// rubricHashes() is the ONLY implementation of the rubric hashes: the rubric extractor (WP1)
// and the binder, validator and deriver (WP3, WP11) all import it from here.
// Pure; no imports, no side effects.

const encoder = () => new TextEncoder();

/** UTF-8 bytes of a string. */
export function utf8Bytes(str) {
  return encoder().encode(String(str));
}

/** djb2 over UTF-16 code units, as unsigned hex (the loader's cache-key hash). Not cryptographic. */
export function djb2(str) {
  const text = String(str);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

// ---------------------------------------------------------------------------------------
// SHA-256, FIPS 180-4, pure JS
// ---------------------------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * SHA-256 of a byte array, as lowercase hex. Synchronous; used where crypto.subtle is
 * unavailable (non-secure contexts) and cross-checked against it in the tests.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function sha256HexSync(bytes) {
  const msg = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const n = msg.length;
  const total = Math.ceil((n + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[n] = 0x80;
  const view = new DataView(buf.buffer);
  // Message length in bits as a 64-bit big-endian integer.
  const bitsHi = Math.floor(n / 0x20000000);
  const bitsLo = (n * 8) >>> 0;
  view.setUint32(total - 8, bitsHi);
  view.setUint32(total - 4, bitsLo);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(off + t * 4);
    for (let t = 16; t < 64; t++) {
      const w15 = W[t - 15], w2 = W[t - 2];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  let hex = "";
  for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, "0");
  return hex;
}

function toBytes(input) {
  if (typeof input === "string") return utf8Bytes(input);
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError("sha256Hex: expected a string, ArrayBuffer or Uint8Array");
}

/**
 * SHA-256 as lowercase hex. A string is hashed as its UTF-8 bytes. Uses crypto.subtle in a
 * secure context, otherwise sha256HexSync; both give the same digest.
 * @param {string|ArrayBuffer|Uint8Array} input
 * @returns {Promise<string>}
 */
export async function sha256Hex(input) {
  const bytes = toBytes(input);
  const subtle = globalThis.isSecureContext && globalThis.crypto && globalThis.crypto.subtle;
  if (subtle) {
    const digest = new Uint8Array(await subtle.digest("SHA-256", bytes));
    let hex = "";
    for (let i = 0; i < digest.length; i++) hex += digest[i].toString(16).padStart(2, "0");
    return hex;
  }
  return sha256HexSync(bytes);
}

// ---------------------------------------------------------------------------------------
// Canonical JSON
// ---------------------------------------------------------------------------------------

/**
 * Canonical JSON: object keys sorted (code-unit order), array order kept, scalars as
 * JSON.stringify writes them, no whitespace. Like JSON.stringify, an object property whose
 * value is undefined or a function is omitted, and such an array element becomes null.
 * Throws on a cycle.
 * @param {*} value
 * @returns {string}
 */
export function canonicalJson(value) {
  const stack = new Set();
  const enc = (v) => {
    if (v === null || typeof v !== "object") {
      if (v === undefined || typeof v === "function" || typeof v === "symbol") return undefined;
      return JSON.stringify(v);
    }
    if (typeof v.toJSON === "function") return enc(v.toJSON());
    if (stack.has(v)) throw new TypeError("canonicalJson: cyclic structure");
    stack.add(v);
    let out;
    if (Array.isArray(v)) {
      out = "[" + v.map((x) => { const s = enc(x); return s === undefined ? "null" : s; }).join(",") + "]";
    } else {
      const parts = [];
      for (const k of Object.keys(v).sort()) {
        const s = enc(v[k]);
        if (s !== undefined) parts.push(JSON.stringify(k) + ":" + s);
      }
      out = "{" + parts.join(",") + "}";
    }
    stack.delete(v);
    return out;
  };
  const s = enc(value);
  return s === undefined ? "null" : s;
}

// ---------------------------------------------------------------------------------------
// Hash projections (design §3.10)
// ---------------------------------------------------------------------------------------

// Copy the listed keys of `src` whose value is not undefined; never default one.
// `map` optionally transforms a copied value (only called when it is defined).
function pick(src, keys, map = {}) {
  const out = {};
  if (src === null || typeof src !== "object") return out;
  for (const k of keys) {
    if (src[k] === undefined) continue;
    out[k] = map[k] ? map[k](src[k]) : src[k];
  }
  return out;
}

const mapArray = (fn) => (xs) => (Array.isArray(xs) ? xs.map(fn) : xs);

function bandsCuts(rubric) {
  const out = {};
  if (rubric.bands !== undefined) {
    out.bands = rubric.bands !== null && typeof rubric.bands === "object" ? pick(rubric.bands, ["cuts"]) : rubric.bands;
  }
  return out;
}

/**
 * The four projections behind rubricHashes, as plain objects. A listed key is copied only
 * when its value is not undefined and is never defaulted, except a domain's `negative`, which
 * is always emitted as `d.negative === true`.
 */
export const hashProjections = {
  /** What buildQuestionnaire and computeScore read, minus the rendered identity. */
  instrument(rubric) {
    const r = rubric || {};
    const out = {};
    if (r.domains !== undefined) {
      out.domains = mapArray((d) => ({
        ...pick(d, ["key", "label", "max"]),
        negative: !!d && d.negative === true,
        ...pick(d, ["items"], {
          items: mapArray((it) => pick(it, ["id", "w", "text", "ref", "scale"], {
            scale: mapArray((o) => pick(o, ["label", "f"])),
          })),
        }),
      }))(r.domains);
    }
    Object.assign(out, bandsCuts(r));
    if (r.redFlags !== undefined) {
      out.redFlags = mapArray((f) => pick(f, ["id", "tier", "group", "text", "points"]))(r.redFlags);
    }
    if (r.fhir !== undefined) {
      out.fhir = pick(r.fhir, ["questionnaireName", "questionnaireTitle", "publisher", "description", "safetyGroupText"]);
    }
    return out;
  },

  /** Calibration applicability and the "scores not comparable" statement. */
  scoring(rubric) {
    const r = rubric || {};
    const out = {};
    if (r.domains !== undefined) {
      out.domains = mapArray((d) => ({
        ...pick(d, ["key", "max"]),
        negative: !!d && d.negative === true,
        ...pick(d, ["items"], {
          items: mapArray((it) => pick(it, ["id", "w", "scale"], {
            scale: mapArray((o) => (o !== null && typeof o === "object" ? o.f : o)),
          })),
        }),
      }))(r.domains);
    }
    Object.assign(out, bandsCuts(r));
    return out;
  },

  /** The lexicon minus version, lang and goldSet; null without a lexicon. */
  lexicon(rubric) {
    const lex = rubric ? rubric.lexicon : undefined;
    if (lex === undefined || lex === null) return null;
    if (typeof lex !== "object") return lex;
    const out = {};
    for (const k of Object.keys(lex)) {
      if (k === "version" || k === "lang" || k === "goldSet") continue;
      if (lex[k] !== undefined) out[k] = lex[k];
    }
    return out;
  },

  /** The whole rubric minus provenance. */
  content(rubric) {
    const r = rubric || {};
    const out = {};
    for (const k of Object.keys(r)) {
      if (k === "provenance") continue;
      if (r[k] !== undefined) out[k] = r[k];
    }
    return out;
  },
};

/**
 * SHA-256 hex over canonicalJson of each projection. lexiconHash is null without a lexicon.
 * @param {Object} rubric
 * @returns {Promise<{instrumentHash:string, scoringHash:string, lexiconHash:(string|null), contentHash:string}>}
 */
export async function rubricHashes(rubric) {
  const lex = hashProjections.lexicon(rubric);
  const [instrumentHash, scoringHash, lexiconHash, contentHash] = await Promise.all([
    sha256Hex(canonicalJson(hashProjections.instrument(rubric))),
    sha256Hex(canonicalJson(hashProjections.scoring(rubric))),
    lex === null ? Promise.resolve(null) : sha256Hex(canonicalJson(lex)),
    sha256Hex(canonicalJson(hashProjections.content(rubric))),
  ]);
  return { instrumentHash, scoringHash, lexiconHash, contentHash };
}
