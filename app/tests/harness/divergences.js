// tests/harness/divergences.js — the secondary oracle's pins and the divergence audit
// (design 03 §8.1). Plain data plus a line diff; no imports, no side effects.
//
// FIXED_SRC_SHA256 pins every reference/fixed-src file. HUNKS pins, per file, the exact
// line-diff hunks between tests/baseline/src/<file> (new side) and reference/fixed-src/<file>
// (old side), as listed in docs/refactor/02-app-divergences.md. The integrity suite recomputes
// the diff and requires it to equal this list hunk for hunk (header and content hash). Any
// other hunk, or a missing one, means the baseline is not what the design assumes: INVALID.
// MANIFEST_SHA256 pins tests/baseline/MANIFEST.sha256 itself, so the manifest cannot attest to
// itself: editing a baseline file and rewriting its manifest line is still INVALID. This also
// covers the four baseline files with no fixed-src twin (Voice, Population, PopulationArtifact,
// SchemaCheck), which the divergence audit cannot see.

/** SHA-256 of tests/baseline/MANIFEST.sha256 (sha256sum of the bytes) as committed by WP0. */
export const MANIFEST_SHA256 = "3f1958403400be00b56dd05083360bb69295ea26a3f7a0226ed2fed9a42a0ab8";

/** SHA-256 of each reference/fixed-src file (sha256sum of the bytes). */
export const FIXED_SRC_SHA256 = {
  "MASQUE_Screener_v0_3.jsx": "b8f07ab2b7eac01679e5e9ed6547d9d7a02939474110b2fb514ed243cb2b7a4f",
  "MASQUE_Scribe_v0_3.jsx": "fab61a5ec4d4a4e68f997846865c036ce69f86bb20e9c8909a94a53f3db58682",
  "MASQUE_Patient_v0_3.jsx": "dacdbfff7f722e2f81f61d9763cae0e256ce0ef44878ff4e765a20d6869a02a6",
  "MASQUE_Simulator.jsx": "bef25d1a61809b17c0dac3b28043c49087e49e4ecbd0ac0131fca645e7477d4f",
  "MASQUE_Extraction.js": "3849c0e86ba3e9cdbf05bc48c781bcb1900e13a0ca3ccc49a433e750fb1fe8c5",
  "MASQUE_Probes.js": "e34f5976889323b52260eb343363cbfa985502d5ae6b2888e9df87aea735e711",
  "ResearchReadinessPanel.jsx": "1125c97ba363ccb77054a3ed2464d601aebc7a49fed78b8682ec64441313aeb7",
};

/**
 * The pinned hunks. `header` is the normal-format diff header (old range, op, new range;
 * old = fixed-src, new = baseline), `sha256` hashes JSON.stringify({del, add}) of the hunk's
 * lines, and `why` names the 02-app-divergences.md row. Files not listed here must be identical.
 * The headers are this file's minimal Myers diff; GNU `diff` may place an equal-cost hunk
 * boundary elsewhere (it agrees on the Screener and on the identical files), so compare
 * with lineDiff, not with `diff`, when re-deriving a pin.
 */
export const HUNKS = {
  "MASQUE_Screener_v0_3.jsx": {
    why: "screenToCohortRow takes ctx; captureScreen passes it (Scr L572, L961)",
    hunks: [
      { header: "572c572", sha256: "5418ef5ae409148118c3c4c9a5c55695ffabf17695d88ac3142d0b741c45b0b3" },
      { header: "961c961", sha256: "612e6cfb99c772c2a9fbf6f237c914464291e4c096da984d015bf7c669ff357a" },
    ],
  },
  "MASQUE_Scribe_v0_3.jsx": {
    why: "voice capture (MASQUE_Voice.js), skipPrompt records a skip instead of writing \"no\", and the header comment",
    hunks: [
      { header: "1c1", sha256: "6322e8fbafa0d971ff65273cedc9fde13f53881f2177a1143e9f5eb5cf701561" },
      { header: "9a10", sha256: "b050406ea7cc4c426775747496be80ddaee1b521d92fa794c687e889ccf23c63" },
      { header: "23,24c24,27", sha256: "0db851938b9398dfd2ce53b63db4c2aa23707087dc157acf4cf9cf565a806d59" },
      { header: "690a694,714", sha256: "706fa3ec4a64da9d517cfffa71840c1e948ac488bc4ae060aefb8ef8341b5745" },
      { header: "710a735", sha256: "00bcb815ed97750b2870ebea07a6697dd9fd161f845ae45a3a8673aec5c8514a" },
      { header: "720a746,760", sha256: "45c025c25d605fef7c23acc56c52f0f8b2c5fc860efe21222b556ae225fe732f" },
      { header: "725c765,767", sha256: "9a38b3e58235e489f2fd696daf051c30a4df373a0e0e99a6f9f293af0efbbeb5" },
      { header: "727,728c769,772", sha256: "82e28c14653bdc47d6cc57feccaae76aec96c9c2033baff6297e01286d4a5b21" },
      { header: "730a775,776", sha256: "a240e33f36a42b51218c8356bfef7af317f13cf7174d814c1c87ef89186bc29c" },
      { header: "737c783", sha256: "f87a2fe44592eabdcffcc54bd1407b11baec8c2003a877087c217dfc5811bc05" },
      { header: "738a785", sha256: "99445593c77e74baa962c06ab3737d77681a1b7b6434ce0fc7cb23a88e38f893" },
      { header: "739a787,814", sha256: "6131e6f9f98132081be7901d3bae118ddac94ee535c80a174d24b0d996a4373c" },
      { header: "759a835", sha256: "3e4070fcc5331c39358b266dba90b15acf75659cb7bd302b462f41b14f8da750" },
      { header: "761c837", sha256: "90388ac1ed892d2339b7cfe58b01544746e9b9e256bf0cba39f22edeaed15fc2" },
      { header: "767c843", sha256: "bd8e1df51442a33247ee426ed6f21776bad992578ffa4598af74783b6667c1ba" },
      { header: "784c860", sha256: "a3d61872667b4e1167c76ae4dac691ceed3de7b1f4c0886ba4653bd213f74c13" },
      { header: "803c879", sha256: "b52d79ac04b0c8ffdd93486ac91da0d0e974b89b9ab6607b1c956c3a48808376" },
      { header: "827a904,908", sha256: "d351254fe07189cde4f2bb911e6ccac4703c228a1887861178228b0aca326198" },
      { header: "830c911", sha256: "d4ba952a1c5ede26f1570c862a1c8081b4c07b8a8ea60e6ce751245e7a66fa77" },
      { header: "868,869c949,951", sha256: "c0640a7567df8b97f7dc919ae2ca77d47dd0f64551a9ae2cd941855605af851e" },
      { header: "885a968,972", sha256: "554046b8ccedf12d9e0f107ed23992bbc51bb57a62ae72fcae3afff26be9550e" },
      { header: "892a980,998", sha256: "52677a406cf8e3b1f84c1cb33f2abacac793a8eb07436eae578e00d953b55c4a" },
      { header: "894c1000,1002", sha256: "2a66b1aec70d42b722f58783e4f9ae52aecd4996dcaff7aed69bd2e6b17fc103" },
      { header: "899c1007", sha256: "3445725ec63c2b36bb2821c28b40fd77b6dead92d8ed1d5d4ddd94b655e9b91f" },
      { header: "909a1018,1030", sha256: "bc25ba82a93e4590eb3afaf5e1efa0e502e86461ba62326b0e1a10374be11f99" },
      { header: "917c1038,1042", sha256: "d14a7abdd5786fd07b4083b3cf4f333460582d58aa1b975ada24c97a74fb1c17" },
      { header: "925c1050", sha256: "3e63aaf07ed8dfa3590abcfe663b2138da2dd65c56777a5a6494361b2e67cdf5" },
      { header: "943c1068", sha256: "1c00d4afac780fdbb7432b89d7b5b0cf7f80853ad5a27f5acd744d7f3d8ecd2d" },
      { header: "1134c1259", sha256: "17d9563c62b10481550a52332967528888880edc6f8e684158482cb1dccba553" },
      { header: "1148c1273,1275", sha256: "91bb6be6e5b48611e9ed4262e1fbd77204f0316a0c3051142372255bf1d052f2" },
      { header: "1156a1284,1298", sha256: "1363e59663d91b1006751b26bc670f15f13abf944a811df5fc3b1f61e9f02bf8" },
    ],
  },
  "ResearchReadinessPanel.jsx": {
    why: "PopulationArtifact imported from its own file; the population-tab hint names app/etl/ and the Population page",
    hunks: [
      { header: "5a6", sha256: "03de27cc7a720345885aa33deee5a0459b899a2919331c4fbb413703051221c8" },
      { header: "402c403,406", sha256: "604673c35da1fe324ff6c64ce293c50dc2da22f5f5cbe6b16f484bd0175057ea" },
      { header: "404,432d407", sha256: "ca4205d4740a0c4d062467404cc4a541ebae4885eacdd41cbd652710742ed561" },
      { header: "991c966", sha256: "62170c8d23fb1797d03e1dbe09f8ef817841ea8aef2138e53550516832b814b1" },
    ],
  },
  "MASQUE_Patient_v0_3.jsx": { why: "identical", hunks: [] },
  "MASQUE_Simulator.jsx": { why: "identical", hunks: [] },
  "MASQUE_Extraction.js": { why: "identical", hunks: [] },
  "MASQUE_Probes.js": { why: "identical", hunks: [] },
};

/** Split text into lines the way `diff` does (a trailing newline ends the last line). */
export function splitLines(text) {
  const lines = String(text).split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * Myers O(ND) line diff. Returns hunks
 * `{header, aStart, aLen, bStart, bLen, del: string[], add: string[]}` (1-based starts),
 * where `a` is the old text and `b` the new one. Deterministic; prefers deletions first.
 */
export function lineDiff(aText, bText) {
  const a = Array.isArray(aText) ? aText : splitLines(aText);
  const b = Array.isArray(bText) ? bText : splitLines(bText);
  const n = a.length, m = b.length, max = n + m;
  const offset = max + 1;
  let v = new Int32Array(2 * max + 3);
  const trace = [];
  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
      else x = v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[offset + k] = x;
      if (x >= n && y >= m) { found = true; break; }
    }
  }
  // Backtrack into an edit script of 'eq' | 'del' | 'add'.
  const ops = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d > 0; d--) {
    const vv = trace[d];
    const k = x - y;
    let prevK;
    if (k === -d || (k !== d && vv[offset + k - 1] < vv[offset + k + 1])) prevK = k + 1;
    else prevK = k - 1;
    const prevX = vv[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.push("eq"); x--; y--; }
    if (x === prevX) { ops.push("add"); y--; } else { ops.push("del"); x--; }
  }
  while (x > 0 && y > 0) { ops.push("eq"); x--; y--; }
  ops.reverse();

  const hunks = [];
  let ai = 0, bi = 0, i = 0;
  while (i < ops.length) {
    if (ops[i] === "eq") { ai++; bi++; i++; continue; }
    const h = { aStart: ai + 1, bStart: bi + 1, del: [], add: [] };
    while (i < ops.length && ops[i] !== "eq") {
      if (ops[i] === "del") h.del.push(a[ai++]); else h.add.push(b[bi++]);
      i++;
    }
    h.aLen = h.del.length; h.bLen = h.add.length;
    h.header = hunkHeader(h);
    hunks.push(h);
  }
  return hunks;
}

function range(start, len) {
  if (len === 0) return String(start - 1);
  return len === 1 ? String(start) : `${start},${start + len - 1}`;
}

/** Normal-format header, as GNU diff prints it ("572c572", "9a10", "402,431c403,406"). */
export function hunkHeader(h) {
  const op = h.aLen === 0 ? "a" : h.bLen === 0 ? "d" : "c";
  return `${range(h.aStart, h.aLen)}${op}${range(h.bStart, h.bLen)}`;
}

/** The text hashed for a hunk pin. */
export function hunkPinText(h) {
  return JSON.stringify({ del: h.del, add: h.add });
}
