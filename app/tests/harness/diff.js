// tests/harness/diff.js — path-reporting deep diff and the allowed-difference table
// (design 03 §8.0, §8.4, §8.7). No imports; nothing happens at import time.
//
// deepDiff(a, b, {allow, at, keyOrder}) → {diffs, observed}
//   a = oracle (baseline) value, b = new value. Paths are RFC 6901 JSON pointers relative to
//   `at` (default ""): the whole document is "" and "/" would be the key "". `allow` names the
//   allowed differences (AD ids) whose normalisers may apply; `observed` is the set of AD ids
//   whose difference was actually seen (normalised away). Nothing outside ALLOWED_DIFFERENCES
//   can widen a comparison: an unknown AD id, or one whose normaliser is not written yet,
//   throws instead of silently comparing less.
//
// Each allowed difference is {id, ready, appliesTo(path), normalise(a, b, ctx) → [a2, b2],
// detector(input) → boolean}. A normaliser returns its inputs unchanged (the same references)
// when it does not apply; a changed pair counts as observed.

/** The release string the frozen baseline prints, and the one screenAIr prints (AD4). */
export const BASELINE_RELEASE = "0.3.0";
export const NEW_RELEASE = "0.4.0";
const RELEASE_RE = /(?<![\d.])0\.3\.0(?![\d.])/g;

const unchanged = (a, b) => [a, b];
const pending = (id, owner) => ({
  id,
  ready: false,
  owner,
  appliesTo: () => false,
  normalise: unchanged,
  detector: () => false,
});

/**
 * The §8.4 table. Only AD4 has a normaliser on day 1; the others are declared so the ids
 * are reserved, and become `ready` when the suite that needs them is written (WP13).
 */
export const ALLOWED_DIFFERENCES = [
  pending("AD1", "golden (WP4)"),          // Screener bundle attainable-range low = floor
  pending("AD2", "golden (WP4)"),          // cohort row module_id; Scribe uses the engine row
  pending("AD3", "golden (WP4)"),          // data dictionary module_id / complaint / {indexName}
  {
    id: "AD4",
    ready: true,
    owner: "WP13",
    // Every printed release string: 0.3.0 → 0.4.0. Only a standalone "0.3.0" token is
    // rewritten (not 0.3.1, 10.3.0 or 0.3.0.1), and only when the new side prints 0.4.0.
    appliesTo: () => true,
    normalise(a, b) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      if (!RELEASE_RE.test(a)) { RELEASE_RE.lastIndex = 0; return [a, b]; }
      RELEASE_RE.lastIndex = 0;
      if (!b.includes(NEW_RELEASE)) return [a, b];
      const a2 = a.replace(RELEASE_RE, NEW_RELEASE);
      return a2 === a ? [a, b] : [a2, b];
    },
    detector: () => true,
  },
  pending("AD5", "rules (WP5)"),           // Scribe "re-asking {id}" → itemShort
  pending("AD6", "golden/rules (WP5)"),    // Scribe red-flag wording → canonical Screener wording
  pending("AD7", "render-screener (WP7)"), // meter zones 34/33/33
  pending("AD8", "research-parity (WP10)"),// panel moved, gated, module_id / scoring_hash
  pending("AD9", "research-parity (WP10)"),// population page embedded
  pending("AD10", "patient (WP6/WP9)"),    // Patient banner printed, es ledes, .txt caveat line
  pending("AD11", "render-screener (WP7)"),// 9 sample buttons
  pending("AD12", "render (WP7-WP9)"),     // chrome around the apps
];

const AD_BY_ID = new Map(ALLOWED_DIFFERENCES.map((d) => [d.id, d]));

export function allowedDifference(id) {
  const d = AD_BY_ID.get(id);
  if (!d) throw new Error(`unknown allowed difference "${id}" (design §8.4 lists AD1-AD12)`);
  return d;
}

/** JSON-pointer token escaping (RFC 6901). */
export function pointerToken(key) {
  return String(key).replace(/~/g, "~0").replace(/\//g, "~1");
}

function kind(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (v instanceof Date) return "date";
  return typeof v;
}

function show(v) {
  if (typeof v === "function") return `[function ${v.name || "anonymous"}]`;
  if (v === undefined) return "[undefined]";
  if (typeof v === "number" && !Number.isFinite(v)) return `[number ${v}]`;
  return v;
}

const MAX_DIFFS = 1000;

/**
 * @param {any} a  oracle value
 * @param {any} b  new value
 * @param {{allow?: string[], at?: string, keyOrder?: boolean, input?: any, ctx?: object}} [opts]
 *   keyOrder: also report objects whose own keys appear in a different order (path + "/@keys").
 *   input: the replayable input recorded on every Diff.
 * @returns {{diffs: Array<{path: string, input: any, a: any, b: any}>, observed: Set<string>, truncated: boolean}}
 */
export function deepDiff(a, b, { allow = [], at = "", keyOrder = false, input = null, ctx = {} } = {}) {
  const ads = allow.map((id) => {
    const d = allowedDifference(id);
    if (!d.ready) throw new Error(`allowed difference ${id} has no normaliser yet (owner: ${d.owner}); it cannot be applied`);
    return d;
  });
  const diffs = [];
  const observed = new Set();
  let truncated = false;

  const push = (path, x, y) => {
    if (diffs.length >= MAX_DIFFS) { truncated = true; return; }
    diffs.push({ path, input, a: show(x), b: show(y) });
  };

  const walk = (x, y, path) => {
    if (truncated) return;
    for (const d of ads) {
      if (!d.appliesTo(path)) continue;
      const [x2, y2] = d.normalise(x, y, ctx);
      if (x2 !== x || y2 !== y) { observed.add(d.id); x = x2; y = y2; }
    }
    if (x === y) return;
    if (typeof x === "number" && typeof y === "number" && Number.isNaN(x) && Number.isNaN(y)) return;
    const kx = kind(x), ky = kind(y);
    if (kx !== ky) { push(path, x, y); return; }
    if (kx === "array") {
      if (x.length !== y.length) push(`${path}/length`, x.length, y.length);
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i++) walk(x[i], y[i], `${path}/${i}`);
      for (let i = n; i < x.length; i++) push(`${path}/${i}`, x[i], undefined);
      for (let i = n; i < y.length; i++) push(`${path}/${i}`, undefined, y[i]);
      return;
    }
    if (kx === "date") {
      if (x.getTime() !== y.getTime()) push(path, x.toISOString(), y.toISOString());
      return;
    }
    if (kx === "object") {
      // `undefined`-valued keys count as absent, as they would after JSON serialisation.
      const kxs = Object.keys(x).filter((k) => x[k] !== undefined);
      const kys = Object.keys(y).filter((k) => y[k] !== undefined);
      if (keyOrder) {
        const common = kxs.filter((k) => kys.includes(k));
        const commonY = kys.filter((k) => kxs.includes(k));
        if (common.join("\u0000") !== commonY.join("\u0000")) push(`${path}/@keys`, common, commonY);
      }
      const seen = new Set();
      for (const k of kxs) {
        seen.add(k);
        walk(x[k], y[k], `${path}/${pointerToken(k)}`);
      }
      for (const k of kys) if (!seen.has(k)) walk(undefined, y[k], `${path}/${pointerToken(k)}`);
      return;
    }
    // Different primitives, or two distinct functions.
    push(path, x, y);
  };

  walk(a, b, at);
  return { diffs, observed, truncated };
}
