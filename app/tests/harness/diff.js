// tests/harness/diff.js — path-reporting deep diff and the allowed-difference table
// (design 03 §8.0, §8.4, §8.7). No imports; nothing happens at import time.
//
// deepDiff(a, b, {allow, at, keyOrder, input, ctx}) → {diffs, observed, truncated}
//   a = oracle (baseline) value, b = new value. Paths are RFC 6901 JSON pointers relative to
//   `at` (default ""): the whole document is "" and "/" would be the key "". `allow` names the
//   allowed differences (AD ids) whose normalisers may apply; `observed` is the set of AD ids
//   whose difference was actually seen (normalised away). Nothing outside ALLOWED_DIFFERENCES
//   can widen a comparison: an unknown AD id throws instead of silently comparing less.
//
// Each allowed difference is {id, ready, owner, what, appliesTo(path, ctx), normalise(a, b, ctx)
// → [a2, b2], detector(input) → boolean}. A normaliser returns its inputs unchanged (the same
// references) when it does not apply; a changed pair counts as observed. Every normaliser is
// exact: it rewrites only the one documented difference, at the one documented place, and only
// when the new side shows exactly the documented new form. Anything else stays a difference.
//
// Parameters travel in `ctx`, keyed by AD id (ctx.AD1 = {total, floor} …); a normaliser whose
// parameters are absent never applies. The parameter object of each AD is documented on it.
// `detector(input)` answers "does this input exhibit the AD's precondition?" for h.expect: a
// precondition that occurs while the difference is not observed is "expected difference
// missing" → FAIL (§8.4).

/** The release string the frozen baseline prints, and the one screenAIr prints (AD4). */
export const BASELINE_RELEASE = "0.3.0";
export const NEW_RELEASE = "0.4.0";
const RELEASE_RE = /(?<![\d.])0\.3\.0(?![\d.])/g;

/** The dated caveat line that closes every Patient .txt export (AD10, §4.12). */
export const DATED_CAVEAT_RE = /^Prototype · not for clinical use · \d{4}-\d{2}-\d{2}$/;

const unchanged = (a, b) => [a, b];
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x) && !(x instanceof Date);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

function withoutKeys(obj, keys) {
  const out = {};
  for (const k of Object.keys(obj)) if (!keys.includes(k)) out[k] = obj[k];
  return out;
}

// ------------------------------------------------------------------------------- CSV helpers

/** Split one CSV line (RFC 4180 quoting as rowsToCsv writes it) into raw cells. */
function csvCells(line) {
  const cells = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '""'; i++; }
      else if (ch === '"') { q = false; cur += ch; }
      else cur += ch;
    } else if (ch === '"') { q = true; cur += ch; }
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}

/** CSV text → array of lines (rowsToCsv joins with "\n"; quoted cells may contain "\n"). */
function csvLines(text) {
  const lines = [];
  let cur = "", q = false;
  for (const ch of text) {
    if (ch === '"') q = !q;
    if (ch === "\n" && !q) { lines.push(cur); cur = ""; } else cur += ch;
  }
  lines.push(cur);
  return lines;
}

function dropCsvColumns(text, names) {
  const lines = csvLines(text);
  const header = csvCells(lines[0]);
  const drop = new Set(names.map((n) => header.indexOf(n)).filter((i) => i >= 0));
  return lines.map((l) => csvCells(l).filter((_, i) => !drop.has(i)).join(",")).join("\n");
}

const looksLikeCohortCsv = (s) => typeof s === "string" && /^screen_id,/.test(s);

// ------------------------------------------------------------------------------- AD2 rows

/** The engine row's extra columns relative to a baseline row, for AD2 (null = not the AD2 shape). */
function ad2Extra(xKeys, yKeys, p) {
  if (xKeys.includes("module_id")) return null;
  const iApp = yKeys.indexOf("app_version");
  if (iApp < 0 || yKeys[iApp + 1] !== "module_id") return null;
  const extra = ["module_id"];
  if (p.scribe) {
    // Scribe rows lacked subject_id, visit_label and gender (Scb L497); the engine row has them.
    for (const k of ["subject_id", "visit_label", "gender"]) if (!xKeys.includes(k) && yKeys.includes(k)) extra.push(k);
  }
  return extra;
}

// ------------------------------------------------------------------------------- AD6 wording

const ad6Cache = new WeakMap();
function ad6Regex(p) {
  if (ad6Cache.has(p)) return ad6Cache.get(p);
  const map = new Map();
  for (const [from, to] of p.pairs) {
    if (typeof from !== "string" || typeof to !== "string" || !from) continue;
    if (map.has(from) && map.get(from) !== to) throw new Error(`AD6: "${from}" maps to two canonical strings`);
    map.set(from, to);
  }
  // Canonical strings map to themselves, so a canonical string that contains a Scribe
  // abbreviation as a prefix is matched whole (longest first) and never rewritten.
  for (const [, to] of p.pairs) if (typeof to === "string" && to && !map.has(to)) map.set(to, to);
  const keys = [...map.keys()].sort((x, y) => y.length - x.length);
  const re = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const r = { re, map };
  ad6Cache.set(p, r);
  return r;
}

/** Map every Scribe red-flag string in `s` to the canonical Screener wording (AD6). */
export function ad6Canonical(s, p) {
  const { re, map } = ad6Regex(p);
  return s.replace(re, (m) => map.get(m));
}

/**
 * Build the AD6 parameter object from the two baseline red-flag tables (by id): every field
 * the Scribe prints (text, points, action) paired with the Screener's.
 */
export function ad6Pairs(scribeFlags, screenerFlags) {
  const byId = new Map(screenerFlags.map((f) => [f.id, f]));
  const pairs = [];
  for (const f of scribeFlags) {
    const c = byId.get(f.id);
    if (!c) continue;
    for (const k of ["text", "points", "action"]) pairs.push([f[k], c[k]]);
  }
  return { pairs };
}

// ------------------------------------------------------------------------------- the table

/**
 * The §8.4 table. Owners name the suites that exercise each AD; the normalisers themselves
 * all live here (WP13).
 */
export const ALLOWED_DIFFERENCES = [
  {
    id: "AD1",
    ready: true,
    owner: "golden (WP4)",
    what: "Screener-surface bundle: attainable-range low and the incomplete note use floor, not total (Scr L1526, L1549)",
    // ctx.AD1 = {total, floor}: the screen's computeScore total and floor. Only the
    // attainable-range low value and the Observation note are touched.
    appliesTo: (path, ctx) => !!(ctx && ctx.AD1) && (/\/valueRange\/low\/value$/.test(path) || /\/note\/\d+\/text$/.test(path)),
    normalise(a, b, ctx) {
      const { total, floor } = ctx.AD1;
      if (total === floor) return [a, b];
      if (typeof a === "number" && typeof b === "number") {
        return a === total && b === floor ? [b, b] : [a, b];
      }
      if (typeof a === "string" && typeof b === "string") {
        const a2 = a.replace(`bounded to ${total}–`, `bounded to ${floor}–`);
        return a2 !== a && a2 === b ? [b, b] : [a, b];
      }
      return [a, b];
    },
    // input = {surface, score:{scorable, total, floor}}
    detector: (input) => !!(input && input.surface === "screener" && input.score && !input.score.scorable && input.score.floor < input.score.total),
  },
  {
    id: "AD2",
    ready: true,
    owner: "golden (WP4)",
    what: "cohort rows and CSV: module_id after app_version; the Scribe uses the engine (Screener) row",
    // ctx.AD2 = {moduleId, scribe?: boolean}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD2),
    normalise(a, b, ctx) {
      const p = ctx.AD2;
      if (isObj(a) && isObj(b) && "app_version" in b) {
        if (b.module_id !== p.moduleId) return [a, b];
        const extra = ad2Extra(Object.keys(a), Object.keys(b), p);
        return extra ? [a, withoutKeys(b, extra)] : [a, b];
      }
      if (looksLikeCohortCsv(a) && looksLikeCohortCsv(b)) {
        const xh = csvCells(csvLines(a)[0]), yh = csvCells(csvLines(b)[0]);
        const extra = ad2Extra(xh, yh, p);
        if (!extra) return [a, b];
        // Every data row carries the module id in that column.
        const iMod = yh.indexOf("module_id");
        if (!csvLines(b).slice(1).every((l) => csvCells(l)[iMod] === p.moduleId)) return [a, b];
        return [a, dropCsvColumns(b, extra)];
      }
      return [a, b];
    },
    // input = a cohort row or CSV text from the new engine: always carries module_id.
    detector: () => true,
  },
  {
    id: "AD3",
    ready: true,
    owner: "golden (WP4)",
    what: "data dictionary: module_id first and complaint before coverage in canonicalCohortFields",
    // ctx.AD3 = {} (presence enables it)
    appliesTo: (path, ctx) => !!(ctx && ctx.AD3),
    normalise(a, b) {
      if (!isObj(a) || !isObj(b) || !Array.isArray(a.canonicalCohortFields) || !Array.isArray(b.canonicalCohortFields)) return [a, b];
      const xs = a.canonicalCohortFields, ys = b.canonicalCohortFields;
      const names = (l) => l.map((f) => f && f.name);
      const xn = names(xs), yn = names(ys);
      if (xn.includes("module_id") || xn.includes("complaint")) return [a, b];
      if (yn[0] !== "module_id") return [a, b];
      const iC = yn.indexOf("complaint");
      if (iC < 0 || yn[iC + 1] !== "coverage") return [a, b];
      const ys2 = ys.filter((f) => f.name !== "module_id" && f.name !== "complaint");
      return [a, { ...b, canonicalCohortFields: ys2 }];
    },
    detector: () => true,
  },
  {
    id: "AD4",
    ready: true,
    owner: "WP13",
    what: "every printed release string: 0.3.0 → 0.4.0",
    // Only a standalone "0.3.0" token is rewritten (not 0.3.1, 10.3.0 or 0.3.0.1), and only
    // when the new side prints 0.4.0.
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
  {
    id: "AD5",
    ready: true,
    owner: "render-scribe (WP8)",
    what: "Scribe probe rail “re-asking {id}” prints itemShort(item) instead of the raw id (Scb L1169)",
    // ctx.AD5 = {short: {itemId: itemShort(item)}}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD5),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const short = ctx.AD5.short || {};
      const a2 = a.replace(/re-asking ([a-z][a-z0-9_]*)/g, (m, id) => (Object.prototype.hasOwnProperty.call(short, id) ? `re-asking ${short[id]}` : m));
      return a2 !== a && a2 === b ? [b, b] : [a, b];
    },
    // input = {rescues: id, short} — the id differs from its short label
    detector: (input) => !!(input && input.short && input.short !== input.rescues),
  },
  {
    id: "AD6",
    ready: true,
    owner: "golden / rules (WP5)",
    what: "Scribe red-flag wording (Scb L189-240) → the canonical Screener wording",
    // ctx.AD6 = ad6Pairs(scribe RED_FLAGS, screener RED_FLAGS)
    appliesTo: (path, ctx) => !!(ctx && ctx.AD6),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const a2 = ad6Canonical(a, ctx.AD6);
      return a2 === a ? [a, b] : [a2, b];
    },
    // input = {strings: [baseline strings], pairs} — some baseline string carries Scribe wording
    detector: (input) => !!(input && Array.isArray(input.strings) && input.pairs &&
      input.strings.some((s) => typeof s === "string" && ad6Canonical(s, input.pairs) !== s)),
  },
  {
    id: "AD7",
    ready: true,
    owner: "render-screener (WP7)",
    what: "Screener meter zones 33/33/34 → 34/33/33 derived from the cuts (visual only)",
    // ctx.AD7 = {from: [33,33,34], to: [34,33,33]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD7),
    normalise(a, b, ctx) {
      const { from, to } = ctx.AD7;
      return same(a, from) && same(b, to) ? [b, b] : [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD8",
    ready: true,
    owner: "research-parity (WP10)",
    what: "research panel: module_id / scoring_hash in manifest and model card; modelVersion default; file names",
    // ctx.AD8 = {moduleId, scoringHash, modelVersion?: {from, to}, fileNames?: [[from, to]]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD8),
    normalise(a, b, ctx) {
      const p = ctx.AD8;
      if (isObj(a) && isObj(b)) {
        const extra = [];
        if (!("module_id" in a) && b.module_id === p.moduleId) extra.push("module_id");
        if (!("scoring_hash" in a) && p.scoringHash !== undefined && b.scoring_hash === p.scoringHash) extra.push("scoring_hash");
        return extra.length ? [a, withoutKeys(b, extra)] : [a, b];
      }
      if (typeof a === "string" && typeof b === "string") {
        if (p.modelVersion && a === p.modelVersion.from && b === p.modelVersion.to) return [b, b];
        for (const [from, to] of p.fileNames || []) if (a === from && b === to) return [b, b];
      }
      return [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD9",
    ready: true,
    owner: "research-parity (WP10)",
    what: "population page: its own brand row and footer, absent when embedded in Research",
    // ctx.AD9 = {regions: [baseline textContent of the brand row, of the footer, …]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD9),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      let a2 = a;
      for (const r of ctx.AD9.regions || []) if (r && a2.includes(r)) a2 = a2.replace(r, "");
      return a2 !== a && a2 === b ? [b, b] : [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD10",
    ready: true,
    owner: "patient / golden (WP6, WP9)",
    what: "Patient: the .txt closes with the dated caveat line (after any patient provenance lines); es ledes from UI.es",
    // ctx.AD10 = {notices?: string[] (patient provenance / edited / stale lines, in order),
    //             date?: "YYYY-MM-DD", ledes?: [[englishLiteral, esString]]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD10),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const p = ctx.AD10;
      let a2 = a, b2 = b;
      for (const [en, es] of p.ledes || []) if (en && a2.includes(en)) a2 = a2.split(en).join(es);
      const lines = b2.split("\n");
      const last = lines[lines.length - 1];
      if (DATED_CAVEAT_RE.test(last) && (!p.date || last.endsWith(` · ${p.date}`))) {
        const notices = p.notices || [];
        const head = lines.slice(0, lines.length - 1 - notices.length);
        const mid = lines.slice(lines.length - 1 - notices.length, lines.length - 1);
        if (same(mid, notices)) b2 = head.join("\n");
      }
      return a2 === a && b2 === b ? [a, b] : [a2, b2];
    },
    // input = a Patient .txt export: always closes with the dated caveat line
    detector: () => true,
  },
  {
    id: "AD11",
    ready: true,
    owner: "render-screener (WP7)",
    what: "Screener sample rail: 4 buttons → 9 (4 unchanged + 5 sim-* scenarios)",
    // ctx.AD11 = {added: [the five scenario button labels]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD11),
    normalise(a, b, ctx) {
      if (!Array.isArray(a) || !Array.isArray(b)) return [a, b];
      const added = ctx.AD11.added || [];
      if (b.length !== a.length + added.length) return [a, b];
      const rest = [];
      let k = 0;
      for (const x of b) {
        if (k < added.length && same(x, added[k])) { k++; continue; }
        rest.push(x);
      }
      return k === added.length && same(rest, a) ? [b, b] : [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD12",
    ready: true,
    owner: "render (WP7-WP9)",
    what: "chrome around the apps: per-page back link and pill (baseline) vs the shell chrome (new)",
    // ctx.AD12 = {baseline: [strings removed from the baseline text], current: [strings removed from the new text]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD12),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      let a2 = a, b2 = b;
      for (const s of ctx.AD12.baseline || []) if (s && a2.includes(s)) a2 = a2.replace(s, "");
      for (const s of ctx.AD12.current || []) if (s && b2.includes(s)) b2 = b2.replace(s, "");
      return (a2 !== a || b2 !== b) && a2 === b2 ? [a2, b2] : [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD13",
    ready: true,
    owner: "rules (WP5)",
    what: "Scribe suggestions: the pool widens to every unanswered item while the screen is NOT scorable (Scb L856-860 comment); the baseline code tests `scorable ||` (decision F12)",
    // ctx.AD13 = {intended}: the baseline `suggestions` slice evaluated with the scorable flag
    // inverted, i.e. the filter its own comment describes. The new list is accepted only when it
    // equals that list exactly.
    appliesTo: (path, ctx) => !!(ctx && ctx.AD13),
    normalise(a, b, ctx) {
      if (!Array.isArray(a) || !Array.isArray(b)) return [a, b];
      return !same(a, b) && same(b, ctx.AD13.intended) ? [b, b] : [a, b];
    },
    // input = {baseline, intended}: the two filters disagree on this state
    detector: (input) => !!(input && !same(input.baseline, input.intended)),
  },
  {
    id: "AD14",
    ready: true,
    owner: "golden (WP4)",
    what: "QuestionnaireResponse domain group answer: valueDecimal for fractional points (the baseline writes valueInteger with a non-integer value) (decision F13)",
    // ctx.AD14 = {} (presence enables it). Only {valueInteger: x} → {valueDecimal: x} with the
    // same non-integer x, at a QuestionnaireResponse group's answer.
    appliesTo: (path, ctx) => !!(ctx && ctx.AD14) && /\/item\/\d+\/answer\/\d+$/.test(path),
    normalise(a, b) {
      if (!isObj(a) || !isObj(b)) return [a, b];
      const ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== 1 || kb.length !== 1 || ka[0] !== "valueInteger" || kb[0] !== "valueDecimal") return [a, b];
      const x = a.valueInteger, y = b.valueDecimal;
      return typeof x === "number" && x === y && !Number.isInteger(y) ? [b, b] : [a, b];
    },
    // input = {domains: computeScore domains} — some domain's points are fractional
    detector: (input) => !!(input && input.domains && Object.values(input.domains).some((d) => typeof d.pts === "number" && !Number.isInteger(d.pts))),
  },
  {
    id: "AD15",
    ready: true,
    owner: "golden / rules (WP3, WP4)",
    what: "no referral ServiceRequest and no CDS index card when the complaint is not a declared phenotype value (\"\" included); the baseline fell back to the default phenotype (decision F11)",
    // ctx.AD15 = {complaint, declared: [phenotype values], indexSrc: the index card's src,
    //            cardText?: the baseline index card's rendered text, cardShape?: its DOM shape
    //            (the list of tag.class entries a rendered region reports)}.
    // Applies only when the complaint is not declared. Exact forms: the bundle entry array
    // without its one routine ServiceRequest; the CDS preview text "" where the baseline rendered
    // the index card (never the safety card); referralFor's undefined where the baseline issued
    // a referral; and, for a rendered region, the baseline text with `cardText` removed once and
    // the baseline shape with the contiguous `cardShape` run removed once.
    appliesTo: (path, ctx) => !!(ctx && ctx.AD15) && !(ctx.AD15.declared || []).includes(ctx.AD15.complaint),
    normalise(a, b, ctx) {
      const p = ctx.AD15;
      const isRef = (e) => !!(e && e.resource && e.resource.resourceType === "ServiceRequest" && e.resource.priority === "routine");
      if (Array.isArray(a) && Array.isArray(b) && a.every((x) => typeof x === "string") && b.every((x) => typeof x === "string")) {
        const run = p.cardShape;
        if (!Array.isArray(run) || !run.length || a.length !== b.length + run.length) return [a, b];
        for (let i = 0; i + run.length <= a.length; i++) {
          if (!same(a.slice(i, i + run.length), run)) continue;
          const a2 = [...a.slice(0, i), ...a.slice(i + run.length)];
          if (same(a2, b)) return [b, b];
        }
        return [a, b];
      }
      if (Array.isArray(a) && Array.isArray(b)) {
        if (b.some(isRef) || a.filter(isRef).length !== 1 || a.length !== b.length + 1) return [a, b];
        return [a.filter((e) => !isRef(e)), b];
      }
      if (typeof a === "string" && b === "") {
        const src = p.indexSrc;
        return typeof src === "string" && src && a.startsWith(src) ? [b, b] : [a, b];
      }
      if (typeof a === "string" && typeof b === "string" && typeof p.cardText === "string" && p.cardText && p.cardText.startsWith(p.indexSrc || "\u0000")) {
        const i = a.indexOf(p.cardText);
        return i >= 0 && a.slice(0, i) + a.slice(i + p.cardText.length) === b ? [b, b] : [a, b];
      }
      if (isObj(a) && b === undefined && Object.keys(a).length === 1 && typeof a.text === "string" && a.text.startsWith("Referral: ")) return [b, b];
      return [a, b];
    },
    // input = {complaint, declared, baselineIssued}: the baseline issued a referral or an index
    // card for a complaint that is not declared
    detector: (input) => !!(input && input.baselineIssued && !(input.declared || []).includes(input.complaint)),
  },
];

const AD_BY_ID = new Map(ALLOWED_DIFFERENCES.map((d) => [d.id, d]));

export function allowedDifference(id) {
  const d = AD_BY_ID.get(id);
  if (!d) throw new Error(`unknown allowed difference "${id}" (design §8.4 lists AD1-AD12; the orchestrator decisions F11-F13 add AD13-AD15)`);
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
  if (v instanceof Set) return "set";
  return typeof v;
}

function show(v) {
  if (typeof v === "function") return `[function ${v.name || "anonymous"}]`;
  if (v === undefined) return "[undefined]";
  if (typeof v === "number" && !Number.isFinite(v)) return `[number ${v}]`;
  if (v instanceof Set) return [...v];
  return v;
}

const MAX_DIFFS = 1000;

/**
 * @param {any} a  oracle value
 * @param {any} b  new value
 * @param {{allow?: string[], at?: string, keyOrder?: boolean, input?: any, ctx?: object}} [opts]
 *   keyOrder: also report objects whose own keys appear in a different order (path + "/@keys").
 *   input: the replayable input recorded on every Diff.
 *   ctx: the AD parameters, keyed by AD id.
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
      if (!d.appliesTo(path, ctx)) continue;
      const [x2, y2] = d.normalise(x, y, ctx);
      if (x2 !== x || y2 !== y) { observed.add(d.id); x = x2; y = y2; }
    }
    if (x === y) return;
    if (typeof x === "number" && typeof y === "number" && Number.isNaN(x) && Number.isNaN(y)) return;
    const kx = kind(x), ky = kind(y);
    if (kx !== ky) { push(path, x, y); return; }
    if (kx === "set") { walk([...x].sort(), [...y].sort(), path); return; }
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

/** A line-by-line diff of two texts as Diff-ready entries (for long strings: notes, .txt exports). */
export function textLineDiff(a, b, { at = "", input = null, max = 20 } = {}) {
  const xs = String(a).split("\n"), ys = String(b).split("\n");
  const out = [];
  const n = Math.max(xs.length, ys.length);
  for (let i = 0; i < n && out.length < max; i++) {
    if (xs[i] !== ys[i]) out.push({ path: `${at}/line/${i + 1}`, input, a: xs[i] === undefined ? "[no line]" : xs[i], b: ys[i] === undefined ? "[no line]" : ys[i] });
  }
  return out;
}
