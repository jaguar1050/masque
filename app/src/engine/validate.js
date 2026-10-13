// engine/validate.js — the module validator, V1-V61 (design 03 §4.14; V61, the EMR template data,
// release 0.4.3). Owner: WP3.
//
// validateModule({module, loaded, root, upload}) → Promise<ValidationReport>. It never throws.
// Every finding is path-addressed: `path` is a JSON pointer into the rubric ("/domains/0/w"),
// into the logic ("/logic/routing/2/when"), or into the upload ("/upload/logic"). An error
// (E) keeps the module from mounting; a warning (W) is shown and passes.
//
// The logic checks run every closure behind recording proxies over immutable smoke states
// (V46-V48, §3.3): each proxy wraps an unfrozen shadow copy and its write traps throw, the
// helpers record the ids they are asked about, and the `s.S` proxy records the sum keys a
// summary text reads (V44). What the closures read is compared with `logic.reads` (V47).
//
// validateRubricShape(rubric, opts) runs the rubric-only checks synchronously for the
// editor's live feedback. formatReport(report) renders a report as path-addressed lines.
// Pure apart from timing; imports only engine files.
import {
  COPY_SLOTS, CONTRACT_VERSION, FORMAT, GLOBAL_PLACEHOLDERS, IDENTITY_TEMPLATE_FIELDS, LEXICON_ASK_SOURCES, LEXICON_CARRY_MAX,
  LEXICON_CLARIFY_KEYS, LEXICON_CLAUSE_LISTS, LEXICON_CLAUSES_KEYS, LEXICON_NORMALIZE_KEYS, LEXICON_SCALE_KEYS,
  LEXICON_SECTION_KINDS, LEXICON_SOURCES, LOGIC_PATHS, RUBRIC_KEYS, SUPPORTED_LOCALES,
} from "./contract.js";
import { BANDS, HIGHEST_BAND, LOWEST_BAND, PROBE_KIND, TIERS } from "./vocab.js";
import { CAVEATS, LIMITS, OMISSION_PATTERNS } from "./policy.js";
import { canonicalJson } from "./hash.js";
import { bandFor, computeScore, negativeValueOf, scaleMaxOf } from "./scoring.js";
import { checkBindable, getPath, mergeLocales, renderIdentity } from "./bind.js";
import { GENERIC_LOGIC, isGenericSummary } from "./generic.js";
import { checkVersionFamily, familyOf, kinKey, lineageProblems } from "./lineage.js";
import { mulberry32 } from "./prng.js";
import * as probeEngine from "./probes.js";
import { CANONICAL_FIELDS } from "./cohort.js";

// ------------------------------------------------------------------------------ helpers

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const nonEmpty = (x) => typeof x === "string" && x.trim().length > 0;
const esc = (s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1");
/** JSON pointer from segments: ptr("domains", 0, "w") → "/domains/0/w". */
const ptr = (...segs) => segs.length ? "/" + segs.map(esc).join("/") : "";
const ID_RE = /^[a-z][a-z0-9_]*$/;
const MODULE_ID_RE = /^[a-z][a-z0-9-]{1,47}$/;
const VERSION_RE = /^\d+(\.\d+)*(-[a-z0-9.-]+)?$/;
const HEX64 = /^[0-9a-f]{64}$/;
const LOCAL_TAG = /-local(?:[.-]|$)/;
const ABS_URL = /^[a-z][a-z0-9+.-]*:\/\/[^\s{}]+$/i;
const PLACEHOLDER_RE = /\{([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)\}/g;
const SMOKE_SEED = 0x5A1C;
const SMOKE_RANDOM_STATES = 256;
const PROTO_KEYS = new Set([...Object.getOwnPropertyNames(Object.prototype), "then", "toJSON", "length", "constructor", "$$typeof"]);
// Ids and domain keys index plain objects (answers, flag maps, score rows): a name inherited from
// Object.prototype ("constructor") would read as present when nothing was recorded (V10, V11).
const isProtoName = (k) => Object.prototype.hasOwnProperty.call(Object.prototype, k);
// Lookup tables keyed by a referenced id have no prototype, so an id the rubric does not define
// ("constructor", "toString") reads as absent instead of as an inherited function.
const dict = () => Object.create(null);
const ownGet = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);

function messageOf(err) {
  return err && typeof err.message === "string" && err.message ? err.message : String(err);
}

function makeCollector() {
  const errors = [];
  const warnings = [];
  const seen = new Set();
  const add = (list, sev, code, path, msg) => {
    const key = `${sev}|${code}|${path}|${msg}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ path, code, msg });
  };
  return {
    errors, warnings,
    E: (code, path, msg) => add(errors, "E", code, path, msg),
    W: (code, path, msg) => add(warnings, "W", code, path, msg),
    has: (code, path) => errors.some(e => e.code === code && e.path === path),
  };
}

/** Every string leaf of a value, with its JSON pointer (functions and non-plain values skipped). */
function walkStrings(x, base, fn, seen = new Set()) {
  if (typeof x === "string") { fn(x, base); return; }
  if (x === null || typeof x !== "object" || seen.has(x)) return;
  seen.add(x);
  if (Array.isArray(x)) x.forEach((v, i) => walkStrings(v, `${base}/${i}`, fn, seen));
  else for (const k of Object.keys(x)) walkStrings(x[k], `${base}/${esc(k)}`, fn, seen);
}

// ----------------------------------------------------------------- rubric-only checks

function checkV1Rubric(r, c) {
  const fatal = checkBindable(r);
  if (fatal) c.E("V1", fatal.path, fatal.message);
}

function checkV2(r, c) {
  if (typeof r.id !== "string" || !MODULE_ID_RE.test(r.id) || r.id.endsWith("-")) {
    c.E("V2", "/id", 'id must match /^[a-z][a-z0-9-]{1,47}$/ and not end in "-"');
  }
  if (!nonEmpty(r.name)) c.E("V2", "/name", "name must be a non-empty string");
  if (!nonEmpty(r.label)) c.E("V2", "/label", "label must be a non-empty string");
  else if (r.label.length > 80) c.E("V2", "/label", `label is ${r.label.length} characters; the limit is 80`);
}

function checkV3(r, c) {
  const known = new Set([...RUBRIC_KEYS.required, ...RUBRIC_KEYS.optional]);
  for (const k of Object.keys(r)) if (!known.has(k)) c.W("V3", ptr(k), `unknown top-level key "${k}" (a typo?)`);
  // Every other required key has its own code (V1, V2, V5, V6, V10, V16, V21); the change
  // log has none, so a missing or malformed one is reported here.
  if (!Array.isArray(r.changelog)) c.E("V3", "/changelog", "changelog is required (a list; it may be empty)");
}

function checkV4(r, c) {
  const stack = new Set();
  const walk = (x, path) => {
    const t = typeof x;
    if (t === "function") { c.E("V4", path, "a rubric holds data only: functions belong in the logic file"); return; }
    if (t === "undefined") { c.E("V4", path, "undefined is not JSON"); return; }
    if (t === "symbol" || t === "bigint") { c.E("V4", path, `a ${t} is not JSON`); return; }
    if (t === "number") { if (!Number.isFinite(x)) c.E("V4", path, `${x} is not a JSON number`); return; }
    if (x === null || t !== "object") return;
    if (stack.has(x)) { c.E("V4", path, "the rubric contains a cycle"); return; }
    const proto = Object.getPrototypeOf(x);
    if (!Array.isArray(x) && proto !== Object.prototype && proto !== null) {
      c.E("V4", path, `a ${x instanceof Date ? "Date" : (x.constructor && x.constructor.name) || "non-plain object"} is not JSON`);
      return;
    }
    stack.add(x);
    if (Array.isArray(x)) {
      for (let i = 0; i < x.length; i++) {
        if (!(i in x)) c.E("V4", `${path}/${i}`, "an array hole is not JSON");
        else walk(x[i], `${path}/${i}`);
      }
    } else {
      for (const k of Object.keys(x)) walk(x[k], `${path}/${esc(k)}`);
    }
    stack.delete(x);
  };
  walk(r, "");
}

function checkV6Rubric(r, c, { origin }) {
  const check = (v, path, what) => {
    if (v === undefined) return;
    if (typeof v !== "string" || !VERSION_RE.test(v)) { c.E("V6", path, `${what} must match /^\\d+(\\.\\d+)*(-[a-z0-9.-]+)?$/`); return; }
    if (origin === "builtin" && LOCAL_TAG.test(v)) c.E("V6", path, `a built-in ${what} may not carry the "-local" tag (it marks derived instruments)`);
  };
  if (r.instrumentVersion === undefined) c.E("V6", "/instrumentVersion", "instrumentVersion is required");
  check(r.instrumentVersion, "/instrumentVersion", "instrument version");
  if (isObj(r.lexicon)) {
    if (r.lexicon.version === undefined) c.E("V6", "/lexicon/version", "lexicon.version is required");
    check(r.lexicon.version, "/lexicon/version", "lexicon version");
  }
}

function checkV7(r, c, identity) {
  if (!nonEmpty(r.label)) return;
  const label = r.label.trim().toLowerCase();
  if (label.length < 3) return;
  const hit = (v) => typeof v === "string" && v.toLowerCase().includes(label);
  if (hit(r.id)) c.W("V7", "/id", "the label text appears in the module id; the label is display text only");
  for (const f of IDENTITY_TEMPLATE_FIELDS) if (hit(getPath(identity, f))) c.W("V7", "/" + f.split(".").map(esc).join("/"), "the label text appears in an identifier");
  arr(r.domains).forEach((d, i) => arr(isObj(d) && d.items).forEach((it, j) => {
    if (isObj(it) && hit(it.id)) c.W("V7", ptr("domains", i, "items", j, "id"), "the label text appears in an item id");
  }));
  if (isObj(r.research) && hit(r.research.projectKey)) c.W("V7", "/research/projectKey", "the label text appears in a cohort-facing value");
}

function checkV9(r, c) {
  for (const f of IDENTITY_TEMPLATE_FIELDS) {
    const v = getPath(r, f);
    if (v === undefined) continue;
    const path = "/" + f.split(".").map(esc).join("/");
    if (typeof v !== "string" || !v.includes("{id}")) c.E("V9", path, `${f} must be a template containing {id}, so another module never shares its identifiers`);
    else if (f === "fhir.questionnaireUrl" && !v.includes("{instrument}")) c.E("V9", path, "fhir.questionnaireUrl must also contain {instrument}");
  }
}

function checkInstrument(r, c) {
  // V10
  const domains = r.domains;
  if (!Array.isArray(domains) || !domains.length) { c.E("V10", "/domains", "at least one domain is required"); return; }
  const keys = new Set();
  domains.forEach((d, i) => {
    const dp = ptr("domains", i);
    if (!isObj(d)) { c.E("V10", dp, "a domain must be an object"); return; }
    if (typeof d.key !== "string" || !ID_RE.test(d.key)) c.E("V10", dp + "/key", "domain key must match /^[a-z][a-z0-9_]*$/");
    else if (isProtoName(d.key)) c.E("V10", dp + "/key", `domain key "${d.key}" is reserved: it names a property every JavaScript object inherits`);
    else if (keys.has(d.key)) c.E("V10", dp + "/key", `duplicate domain key "${d.key}"`);
    keys.add(d.key);
    if (!nonEmpty(d.label)) c.E("V10", dp + "/label", "domain label must be non-empty");
    if (!Array.isArray(d.items) || !d.items.length) c.E("V10", dp + "/items", "a domain needs at least one item");
    if (d.negative !== undefined && typeof d.negative !== "boolean") c.E("V15", dp + "/negative", "negative must be a boolean");
    let sum = 0;
    let signOk = true;
    arr(d.items).forEach((it, j) => {
      const ip = `${dp}/items/${j}`;
      if (!isObj(it)) { c.E("V12", ip, "an item must be an object"); return; }
      // V12
      if (typeof it.w !== "number" || !Number.isFinite(it.w) || it.w === 0) c.E("V12", ip + "/w", "w must be a finite number other than 0");
      else {
        sum += it.w;
        if ((d.negative === true && it.w > 0) || (d.negative !== true && it.w < 0)) { signOk = false; c.E("V15", ip + "/w", d.negative === true ? "an item of a negative domain must have w < 0" : "an item of a positive domain must have w > 0"); }
      }
      if (!nonEmpty(it.text)) c.E("V12", ip + "/text", "item text must be non-empty");
      if (it.short === undefined) c.W("V12", ip + "/short", `no short label; the Scribe shows the id "${it.id}" instead`);
      else if (!nonEmpty(it.short)) c.E("V12", ip + "/short", "short must be a non-empty string when present");
      for (const k of ["ask", "tag", "ref", "patientClin"]) if (it[k] !== undefined && typeof it[k] !== "string") c.E("V12", `${ip}/${k}`, `${k} must be a string`);
      // V13 / V14
      if (it.scale !== undefined) {
        if (!Array.isArray(it.scale)) c.E("V14", ip + "/scale", "scale must be a list of options; a boolean item has no scale key");
        else {
          if (it.scale.length < 2) c.E("V13", ip + "/scale", "a scale needs at least 2 options");
          let zero = false;
          it.scale.forEach((o, k) => {
            const op = `${ip}/scale/${k}`;
            if (!isObj(o)) { c.E("V13", op, "a scale option must be {label, f}"); return; }
            if (!nonEmpty(o.label)) c.E("V13", op + "/label", "option label must be non-empty");
            if (typeof o.f !== "number" || !Number.isFinite(o.f) || o.f < 0 || o.f > 1) c.E("V13", op + "/f", "f must be a number in [0, 1]");
            if (o.f === 0) zero = true;
          });
          if (it.scale.length >= 1 && !zero) c.E("V13", ip + "/scale", "at least one option must have f = 0 (the scale's negative answer)");
        }
      }
      if (it.type !== undefined && it.type === "boolean" && it.scale !== undefined) c.E("V14", ip + "/scale", "a boolean item has no scale");
    });
    // V15
    if (typeof d.max !== "number" || !Number.isFinite(d.max)) c.E("V15", dp + "/max", "max must be a finite number");
    else {
      if (signOk && arr(d.items).every(it => isObj(it) && typeof it.w === "number" && Number.isFinite(it.w)) && Math.abs(sum - d.max) >= 1e-9) {
        c.E("V15", dp + "/max", `Σw of the items is ${Math.round(sum * 1e6) / 1e6} but max is ${d.max}`);
      }
      if (d.negative === true && d.max >= 0) c.E("V15", dp + "/max", "a negative domain's max must be negative");
      if (d.negative !== true && d.max <= 0) c.E("V15", dp + "/max", "a positive domain's max must be positive");
    }
  });
  // V16 / V17
  const scaleMax = scaleMaxOf({ domains: domains.filter(isObj) });
  if (!(scaleMax > 0)) c.E("V16", "/domains", "the scale maximum (Σ max of the positive domains) must be > 0");
  const cuts = isObj(r.bands) ? r.bands.cuts : undefined;
  if (!isObj(cuts)) c.E("V16", "/bands/cuts", "bands.cuts {moderate, high} is required");
  else {
    const { moderate, high } = cuts;
    if (!Number.isInteger(moderate)) c.E("V16", "/bands/cuts/moderate", "moderate must be an integer");
    if (!Number.isInteger(high)) c.E("V16", "/bands/cuts/high", "high must be an integer");
    if (Number.isInteger(moderate) && Number.isInteger(high)) {
      if (!(moderate > 0)) c.E("V16", "/bands/cuts/moderate", "moderate must be > 0");
      if (!(moderate < high)) c.E("V16", "/bands/cuts/high", "high must be > moderate");
      if (scaleMax > 0 && high > scaleMax) c.E("V16", "/bands/cuts/high", `high (${high}) must be ≤ the scale maximum (${scaleMax})`);
    }
  }
  if (scaleMax > 0 && scaleMax !== 100) {
    c.W("V17", "/domains", `the scale maximum is ${scaleMax}, not 100: the meter, the CDS example and the illustrative calibration were written for 0–100`);
  }
}

function idNamespace(r, c) {
  // V11: one id namespace across items, context items, flags and info prompts.
  const seen = new Map();
  const visit = (id, path, what) => {
    if (typeof id !== "string" || !ID_RE.test(id)) { c.E("V11", path, `${what} id must match /^[a-z][a-z0-9_]*$/`); return; }
    if (isProtoName(id)) { c.E("V11", path, `${what} id "${id}" is reserved: it names a property every JavaScript object inherits, so a lookup by it would read as present when the data is absent`); return; }
    if (seen.has(id)) c.E("V11", path, `id "${id}" is already used by ${seen.get(id)}`);
    else seen.set(id, `${what} ${path}`);
  };
  // An item id is also a cohort column (cohort.js appends one column per item after
  // CANONICAL_FIELDS), so it must not name a canonical column: an item called `label` would
  // write the answer into the reference-standard column at capture time (a fabricated outcome
  // where the column must stay empty until follow-up), one called `score` would replace the
  // index total, and so on.
  const reserved = new Set(CANONICAL_FIELDS);
  arr(r.domains).forEach((d, i) => arr(isObj(d) && d.items).forEach((it, j) => {
    if (!isObj(it)) return;
    const path = ptr("domains", i, "items", j, "id");
    if (typeof it.id === "string" && reserved.has(it.id)) { c.E("V11", path, `item id "${it.id}" is reserved: it names a canonical cohort column, so the item's answer would overwrite that column in every captured row`); return; }
    visit(it.id, path, "item");
  }));
  arr(r.contextItems).forEach((ci, i) => { if (isObj(ci)) visit(ci.id, ptr("contextItems", i, "id"), "context item"); });
  arr(r.redFlags).forEach((f, i) => { if (isObj(f)) visit(f.id, ptr("redFlags", i, "id"), "red flag"); });
  if (isObj(r.infoPrompts)) arr(r.infoPrompts.prompts).forEach((p, i) => { if (isObj(p)) visit(p.id, ptr("infoPrompts", "prompts", i, "id"), "info prompt"); });
}

function checkContext(r, c) {
  // V18
  const ctx = r.contextItems;
  if (ctx !== undefined && !Array.isArray(ctx)) { c.E("V18", "/contextItems", "contextItems must be a list"); return; }
  arr(ctx).forEach((ci, i) => {
    const cp = ptr("contextItems", i);
    if (!isObj(ci)) { c.E("V18", cp, "a context item must be an object"); return; }
    if (!nonEmpty(ci.text)) c.E("V18", cp + "/text", "context text must be non-empty");
    if (!Array.isArray(ci.options) || ci.options.length < 2) { c.E("V18", cp + "/options", "a context item needs at least 2 options"); return; }
    const vals = new Set();
    ci.options.forEach((o, k) => {
      const op = `${cp}/options/${k}`;
      if (!Array.isArray(o) || o.length !== 2 || typeof o[0] !== "string" || !o[0]) { c.E("V18", op, "an option is [value, label] with a non-empty value"); return; }
      if (vals.has(o[0])) c.E("V18", op, `duplicate option value "${o[0]}"`);
      vals.add(o[0]);
      if (!nonEmpty(o[1])) c.E("V18", op + "/1", "option label must be non-empty");
    });
    if (ci.signal !== undefined) {
      if (!isObj(ci.signal)) c.E("V19", cp + "/signal", "signal must be {value, screenerLabel, scribeLabel, noteLabel}");
      else for (const k of ["value", "screenerLabel", "scribeLabel", "noteLabel"]) if (!nonEmpty(ci.signal[k])) c.E("V19", `${cp}/signal/${k}`, `signal.${k} must be non-empty`);
    }
  });
  // V19
  const g = r.gapRule;
  if (g === undefined) return;
  if (!isObj(g)) { c.E("V19", "/gapRule", "gapRule must be {threshold, markers, noteOrder?}"); return; }
  const byId = dict();
  arr(ctx).forEach(ci => { if (isObj(ci)) byId[ci.id] = ci; });
  const markers = g.markers;
  if (!Array.isArray(markers) || !markers.length) { c.E("V19", "/gapRule/markers", "markers must be a non-empty list of context ids"); return; }
  markers.forEach((m, i) => {
    const ci = byId[m];
    if (!ci) c.E("V19", `/gapRule/markers/${i}`, `"${m}" is not a context item`);
    else if (!isObj(ci.signal)) c.E("V19", `/gapRule/markers/${i}`, `context item "${m}" has no signal`);
    else if (!arr(ci.options).some(o => Array.isArray(o) && o[0] === ci.signal.value)) c.E("V19", `/gapRule/markers/${i}`, `the signal value of "${m}" is not one of its options`);
  });
  if (new Set(markers).size !== markers.length) c.E("V19", "/gapRule/markers", "markers must be distinct");
  if (!Number.isInteger(g.threshold) || g.threshold < 1 || g.threshold > markers.length) c.E("V19", "/gapRule/threshold", `threshold must be an integer between 1 and ${markers.length}`);
  if (g.noteOrder !== undefined) {
    const no = g.noteOrder;
    if (!Array.isArray(no) || no.length !== markers.length || !markers.every(m => no.includes(m))) c.E("V19", "/gapRule/noteOrder", "noteOrder must be a permutation of markers");
  }
}

function checkPatientContext(r, c) {
  // V20: every patient context option set contains the signal value (no realignment).
  const signals = dict();
  arr(r.contextItems).forEach(ci => { if (isObj(ci) && isObj(ci.signal)) signals[ci.id] = ci.signal.value; });
  const locales = isObj(r.locales) ? r.locales : {};
  for (const loc of Object.keys(locales)) {
    const ci = isObj(locales[loc]) && isObj(locales[loc].contextItems) ? locales[loc].contextItems : null;
    if (!ci) continue;
    for (const id of Object.keys(ci)) {
      const p = ptr("locales", loc, "contextItems", id);
      const e = ci[id];
      if (!isObj(e)) { c.E("V20", p, "a patient context entry is {q, opts}"); continue; }
      if (!Array.isArray(e.opts)) { c.E("V20", p + "/opts", "opts must be a list of [value, label]"); continue; }
      if (signals[id] !== undefined && !e.opts.some(o => Array.isArray(o) && o[0] === signals[id])) {
        c.E("V20", p + "/opts", `the patient options must contain the signal value "${signals[id]}"`);
      }
    }
  }
}

function checkFlags(r, c) {
  // V21 / V22
  const flags = r.redFlags;
  if (!Array.isArray(flags) || !flags.length) { c.E("V21", "/redFlags", "at least one red flag is required (the safety step is mandatory)"); return; }
  const ids = new Set();
  flags.forEach((f, i) => {
    const fp = ptr("redFlags", i);
    if (!isObj(f)) { c.E("V21", fp, "a red flag must be an object"); return; }
    if (ids.has(f.id)) c.E("V21", fp + "/id", `duplicate red-flag id "${f.id}"`);
    ids.add(f.id);
    if (!TIERS.includes(f.tier)) c.E("V21", fp + "/tier", `tier must be one of ${TIERS.join(", ")}`);
    for (const k of ["group", "text", "points", "action"]) if (!nonEmpty(f[k])) c.E("V21", `${fp}/${k}`, `${k} must be non-empty`);
    for (const k of ["w", "weight", "f", "scale", "score"]) if (f[k] !== undefined) c.E("V22", `${fp}/${k}`, "red flags sit outside the score: a flag carries no weight, f, scale or score");
  });
}

function checkPatientFlags(r, c) {
  const locales = isObj(r.locales) ? r.locales : {};
  const flags = arr(r.redFlags).filter(isObj);
  const en = isObj(locales.en) ? locales.en : null;
  // V23
  if (en && isObj(en.items)) {
    for (const f of flags) {
      const e = isObj(en.redFlags) ? en.redFlags[f.id] : undefined;
      const p = ptr("locales", "en", "redFlags", f.id);
      if (!isObj(e)) c.E("V23", p, `no English patient wording for red flag "${f.id}"`);
      else for (const k of ["q", "say"]) if (!nonEmpty(e[k])) c.E("V23", `${p}/${k}`, `${k} must be non-empty`);
    }
    for (const loc of Object.keys(locales)) {
      if (loc === "en" || !isObj(locales[loc])) continue;
      for (const f of flags) {
        const e = isObj(locales[loc].redFlags) ? locales[loc].redFlags[f.id] : undefined;
        if (!isObj(e) || !nonEmpty(e.q) || !nonEmpty(e.say)) c.W("V23", ptr("locales", loc, "redFlags", f.id), `red flag "${f.id}" falls back to English in "${loc}"`);
      }
    }
  }
  // V24: patient wording never carries the clinician's points/action, nor the clinician text.
  for (const loc of Object.keys(locales)) {
    const rf = isObj(locales[loc]) && isObj(locales[loc].redFlags) ? locales[loc].redFlags : null;
    if (!rf) continue;
    for (const id of Object.keys(rf)) {
      const e = rf[id];
      if (!isObj(e)) continue;
      for (const k of ["q", "say"]) {
        if (typeof e[k] !== "string") continue;
        const s = e[k].toLowerCase();
        for (const f of flags) {
          const pts = nonEmpty(f.points) ? f.points.toLowerCase() : null;
          const act = nonEmpty(f.action) ? f.action.toLowerCase() : null;
          if ((pts && s.includes(pts)) || (act && s.includes(act)) || (nonEmpty(f.text) && s === f.text.toLowerCase())) {
            c.E("V24", ptr("locales", loc, "redFlags", id, k), `patient wording repeats the clinician wording of red flag "${f.id}"`);
            break;
          }
        }
      }
    }
  }
}

function checkSteps(r, c) {
  const domainKeys = arr(r.domains).filter(isObj).map(d => d.key);
  const hasPhen = isObj(r.phenotypes);
  const hasCtx = Array.isArray(r.contextItems) && r.contextItems.length > 0;
  const steps = isObj(r.steps) ? r.steps : null;
  if (r.steps !== undefined && !steps) { c.E("V25", "/steps", "steps must be {screener?, patient?}"); return; }
  // V25
  if (steps && steps.screener !== undefined) {
    const s = steps.screener;
    if (!Array.isArray(s) || s.length < 2) c.E("V25", "/steps/screener", "screener steps need a safety step first and a result step last");
    else {
      const count = { safety: 0, result: 0 };
      const seen = new Map();
      s.forEach((st, i) => {
        const p = ptr("steps", "screener", i);
        if (!isObj(st)) { c.E("V25", p, "a step must be an object"); return; }
        if (!nonEmpty(st.key)) c.E("V25", p + "/key", "step key must be non-empty");
        if (!["safety", "domain", "result"].includes(st.kind)) c.E("V25", p + "/kind", "kind must be safety, domain or result");
        if (st.kind in count) count[st.kind]++;
        if (!isObj(st.rail) || typeof st.rail.eyebrow !== "string" || !nonEmpty(st.rail.title)) c.E("V25", p + "/rail", "rail {eyebrow, title} is required");
        if (st.domainKeys !== undefined && (st.kind !== "domain" || !Array.isArray(st.domainKeys))) c.E("V25", p + "/domainKeys", "domainKeys belong to a domain step and must be a list");
        arr(st.domainKeys).forEach((k, j) => {
          if (!domainKeys.includes(k)) c.E("V25", `${p}/domainKeys/${j}`, `"${k}" is not a domain`);
          else if (seen.has(k)) c.E("V25", `${p}/domainKeys/${j}`, `domain "${k}" is already in step ${seen.get(k)}`);
          else seen.set(k, i);
        });
        arr(st.extras).forEach((x, j) => {
          const xp = `${p}/extras/${j}`;
          if (!["complaintPicker", "context"].includes(x)) c.E("V25", xp, "extras ⊆ {complaintPicker, context}");
          if (x === "complaintPicker" && !hasPhen) c.E("V25", xp, "a complaint picker needs phenotypes");
          if (x === "context" && !hasCtx) c.E("V25", xp, "context extras need context items");
        });
        if (st.requires !== undefined) {
          if (st.requires !== "complaint") c.E("V25", p + "/requires", 'requires may only be "complaint"');
          else if (!hasPhen) c.E("V25", p + "/requires", "requires: complaint needs phenotypes");
        }
      });
      if (!isObj(s[0]) || s[0].kind !== "safety") c.E("V25", "/steps/screener/0", "the first screener step must be the safety step");
      if (!isObj(s[s.length - 1]) || s[s.length - 1].kind !== "result") c.E("V25", `/steps/screener/${s.length - 1}`, "the last screener step must be the result step");
      if (count.safety !== 1) c.E("V25", "/steps/screener", "exactly one safety step is required");
      if (count.result !== 1) c.E("V25", "/steps/screener", "exactly one result step is required");
      for (const k of domainKeys) if (!seen.has(k)) c.E("V25", "/steps/screener", `domain "${k}" is in no screener step`);
    }
  }
  // V26
  if (steps && steps.patient !== undefined) {
    const s = steps.patient;
    if (!Array.isArray(s)) c.E("V26", "/steps/patient", "patient steps must be a list");
    else {
      const seen = new Map();
      let ctxCount = 0;
      s.forEach((st, i) => {
        const p = ptr("steps", "patient", i);
        if (!isObj(st)) { c.E("V26", p, "a step must be an object"); return; }
        if (!nonEmpty(st.key)) c.E("V26", p + "/key", "step key must be non-empty");
        if (!["story", "domain"].includes(st.kind)) c.E("V26", p + "/kind", "patient step kinds are story and domain");
        if (!Array.isArray(st.domainKeys)) c.E("V26", p + "/domainKeys", "domainKeys must be a list");
        arr(st.domainKeys).forEach((k, j) => {
          if (!domainKeys.includes(k)) c.E("V26", `${p}/domainKeys/${j}`, `"${k}" is not a domain`);
          else if (seen.has(k)) c.E("V26", `${p}/domainKeys/${j}`, `domain "${k}" is already in step ${seen.get(k)}`);
          else seen.set(k, i);
        });
        arr(st.extras).forEach((x, j) => {
          if (x !== "context") c.E("V26", `${p}/extras/${j}`, 'the only patient extra is "context"');
          else { ctxCount++; if (!hasCtx) c.E("V26", `${p}/extras/${j}`, "context extras need context items"); }
        });
      });
      if (ctxCount > 1) c.E("V26", "/steps/patient", "the context questions may appear at most once");
      for (const k of domainKeys) if (!seen.has(k)) c.E("V26", "/steps/patient", `domain "${k}" is in no patient step`);
    }
  }
}

// V27, the clinician rules of the referral table (release 0.4.5): the fields engine/emr.js reads.
const CLINICIAN_RULE_FIELDS = ["phenotypes", "source", "rule", "definition", "clarificationSource", "clarification", "confirm"];
const CLINICIAN_RULE_BRACKETS = /[[\]{}]/;

/**
 * V27, phenotypes.referral.clinicianRules (release 0.4.5). A list of rules printed for the
 * clinician in the EMR template, never acted on by the engine:
 * {phenotypes, source?, rule?, definition?, clarificationSource?, clarification?, confirm?}.
 * phenotypes a non-empty list of distinct phenotype values; source, rule and clarificationSource
 * non-empty strings; definition, clarification and confirm non-empty lists of non-empty strings;
 * at least one of rule, definition, clarification or confirm (a rule that prints nothing is an
 * error); a source whenever the rule or a definition is shown, and a clarificationSource whenever
 * a clarification is; no string carries [ ] { } (the EMR template's placeholders and template
 * syntax). A field the engine never reads (an escalation destination or evidence among them: the
 * engine escalates nothing) is a warning, and so is a clarificationSource without a clarification.
 */
function checkClinicianRules(ph, values, c) {
  const ref = ph.referral;
  if (!isObj(ref) || ref.clinicianRules === undefined) return;
  if (!Array.isArray(ref.clinicianRules)) { c.E("V27", "/phenotypes/referral/clinicianRules", "clinicianRules must be a list of clinician rules"); return; }
  ref.clinicianRules.forEach((e, i) => {
    const p = ptr("phenotypes", "referral", "clinicianRules", i);
    if (!isObj(e)) { c.E("V27", p, "a clinician rule is {phenotypes, source?, rule?, definition?, clarificationSource?, clarification?, confirm?}"); return; }
    for (const k of Object.keys(e)) if (!CLINICIAN_RULE_FIELDS.includes(k)) c.W("V27", `${p}/${esc(k)}`, `unknown clinician-rule field "${k}" (it is never read; the engine prints these rules and escalates nothing)`);
    walkStrings(e, p, (s, sp) => {
      if (CLINICIAN_RULE_BRACKETS.test(s)) c.E("V27", sp, "clinician-rule strings may not contain [ ] { }: square brackets are the EMR template's placeholders");
    });
    if (!Array.isArray(e.phenotypes) || !e.phenotypes.length) c.E("V27", `${p}/phenotypes`, "phenotypes must be a non-empty list of phenotype values");
    else {
      const seen = new Set();
      e.phenotypes.forEach((v, j) => {
        if (!values.includes(v)) c.E("V27", `${p}/phenotypes/${j}`, `${JSON.stringify(v)} is not a phenotype value`);
        else if (seen.has(v)) c.E("V27", `${p}/phenotypes/${j}`, `duplicate phenotype value "${v}"`);
        seen.add(v);
      });
    }
    for (const k of ["source", "rule", "clarificationSource"]) if (e[k] !== undefined && !nonEmpty(e[k])) c.E("V27", `${p}/${k}`, `${k} must be a non-empty string`);
    for (const k of ["definition", "clarification", "confirm"]) {
      if (e[k] === undefined) continue;
      if (!Array.isArray(e[k]) || !e[k].length) c.E("V27", `${p}/${k}`, `${k} must be a non-empty list of strings`);
      else e[k].forEach((s, j) => { if (!nonEmpty(s)) c.E("V27", `${p}/${k}/${j}`, "must be a non-empty string"); });
    }
    if (["rule", "definition", "clarification", "confirm"].every((k) => e[k] === undefined)) {
      c.E("V27", p, "a clinician rule prints nothing: it needs a rule, a definition, a clarification or a confirm list");
    }
    if ((e.rule !== undefined || e.definition !== undefined) && e.source === undefined) {
      c.E("V27", `${p}/source`, "a rule or definition that is shown needs its source (who stated it, and when)");
    }
    if (e.clarification !== undefined && e.clarificationSource === undefined) {
      c.E("V27", `${p}/clarificationSource`, "a clarification that is shown needs its source (who stated it, and when)");
    }
    if (e.clarificationSource !== undefined && e.clarification === undefined) {
      c.W("V27", `${p}/clarificationSource`, "clarificationSource without a clarification (it is never read)");
    }
  });
}

function checkPhenotypes(r, c) {
  // V27
  const ph = r.phenotypes;
  if (ph === undefined) return;
  if (!isObj(ph)) { c.E("V27", "/phenotypes", "phenotypes must be an object"); return; }
  const domainKeys = arr(r.domains).filter(isObj).map(d => d.key);
  const values = [];
  if (!Array.isArray(ph.values) || !ph.values.length) c.E("V27", "/phenotypes/values", "values must be a non-empty list");
  arr(ph.values).forEach((v, i) => {
    const p = ptr("phenotypes", "values", i);
    if (!isObj(v) || !nonEmpty(v.value)) { c.E("V27", p, "a phenotype value is {value, h, d}"); return; }
    if (values.includes(v.value)) c.E("V27", p + "/value", `duplicate phenotype value "${v.value}"`);
    values.push(v.value);
    for (const k of ["h", "d"]) if (typeof v[k] !== "string") c.E("V27", `${p}/${k}`, `${k} must be a string`);
  });
  if (!values.includes(ph.scribeDefault)) c.E("V27", "/phenotypes/scribeDefault", "scribeDefault must be one of the values");
  if (ph.alwaysActive !== undefined) {
    if (!Array.isArray(ph.alwaysActive)) c.E("V27", "/phenotypes/alwaysActive", "alwaysActive must be a list of domain keys");
    arr(ph.alwaysActive).forEach((k, i) => { if (!domainKeys.includes(k)) c.E("V27", `/phenotypes/alwaysActive/${i}`, `"${k}" is not a domain`); });
  }
  if (ph.tagBoostDomain !== undefined && !domainKeys.includes(ph.tagBoostDomain)) c.E("V27", "/phenotypes/tagBoostDomain", `"${ph.tagBoostDomain}" is not a domain`);
  const table = (name, check) => {
    const t = ph[name];
    if (t === undefined) return;
    if (!isObj(t) || !isObj(t.byPhenotype)) { c.E("V27", `/phenotypes/${name}`, `${name} must be {byPhenotype, default}`); return; }
    for (const k of Object.keys(t.byPhenotype)) {
      if (!values.includes(k)) c.E("V27", ptr("phenotypes", name, "byPhenotype", k), `"${k}" is not a phenotype value`);
      else if (!check(t.byPhenotype[k])) c.E("V27", ptr("phenotypes", name, "byPhenotype", k), "malformed entry");
    }
    if (t.default === undefined || !check(t.default)) c.E("V27", `/phenotypes/${name}/default`, `${name} needs a default`);
  };
  table("referral", (e) => isObj(e) && nonEmpty(e.specialty) && nonEmpty(e.reason));
  table("cdsTerm", (e) => nonEmpty(e));
  checkClinicianRules(ph, values, c);
}

function lexiconPhrases(lex) {
  // Every phrase and cue list of a lexicon, with its pointer.
  const out = [];
  const list = (xs, p) => arr(xs).forEach((s, i) => out.push([s, `${p}/${i}`]));
  for (const k of ["negation", "thirdParty", "historical"]) if (isObj(lex[k])) list(lex[k].cues, `/lexicon/${k}/cues`);
  arr(lex.bool).forEach((e, i) => isObj(e) && list(e.ph, `/lexicon/bool/${i}/ph`));
  arr(lex.ctx).forEach((e, i) => isObj(e) && list(e.ph, `/lexicon/ctx/${i}/ph`));
  arr(lex.scale).forEach((e, i) => {
    if (!isObj(e)) return;
    list(e.cue, `/lexicon/scale/${i}/cue`);
    arr(e.bands).forEach((b, j) => isObj(b) && list(b.ph, `/lexicon/scale/${i}/bands/${j}/ph`));
    list(e.anchor, `/lexicon/scale/${i}/anchor`);
  });
  arr(lex.multi).forEach((e, i) => isObj(e) && list(e.ph, `/lexicon/multi/${i}/ph`));
  if (isObj(lex.redFlags)) for (const k of Object.keys(lex.redFlags)) list(lex.redFlags[k], ptr("lexicon", "redFlags", k));
  list(lex.carryRefuse, "/lexicon/carryRefuse");
  // Release 0.4.7: the chart-reading lists ({ph, source} rows) and the clarification phrases.
  const rows = (xs, p) => arr(xs).forEach((e, i) => { if (isObj(e)) out.push([e.ph, `${p}/${i}/ph`]); });
  const cl = lex.clauses;
  if (isObj(cl)) {
    for (const k of LEXICON_CLAUSE_LISTS) rows(cl[k], `/lexicon/clauses/${k}`);
    if (isObj(cl.sections)) for (const k of LEXICON_SECTION_KINDS) rows(cl.sections[k], `/lexicon/clauses/sections/${k}`);
    if (isObj(cl.redFlags)) for (const k of Object.keys(cl.redFlags)) rows(cl.redFlags[k], ptr("lexicon", "clauses", "redFlags", k));
  }
  arr(lex.clarify).forEach((e, i) => { if (isObj(e)) { list(e.ph, `/lexicon/clarify/${i}/ph`); list(e.unless, `/lexicon/clarify/${i}/unless`); } });
  return out;
}

// Chart-reading cues may carry one boundary space at either end (" negative", ": no", "no "), never
// more, and no tab or line break; a cue made only of punctuation ("?", "***") is never matched
// inside a word, so the short-phrase warning does not apply to it (V29, release 0.4.7). Nor does it
// apply to a clauses cue list matched as whole words (every list but mask, a substring, and
// chartIgnoreThirdParty, the lexicon's own word-start cues) or to a section word, matched as a whole
// header (review round 1: scopeEnd "so", "is", "to").
const CLAUSE_PHRASE_PTR_RE = /^\/lexicon\/clauses\//;
const CLAUSE_SUBSTRING_PTR_RE = /^\/lexicon\/clauses\/(?:mask|chartIgnoreThirdParty)\//;
const CLAUSE_SPACING_RE = /^\s{2,}|\s{2,}$|[\t\r\n]/;
const HAS_WORD_CHAR_RE = /[\p{L}\p{N}]/u;

/**
 * lexicon.clauses (release 0.4.7; contract LEXICON_CLAUSES_KEYS), V28: an object of known keys;
 * wordStart and redFlagNegation booleans; each list a non-empty list of {ph, source} rows, source one
 * of LEXICON_SOURCES, a phrase once per list; sections an object of LEXICON_SECTION_KINDS lists, a
 * header word in one kind only; examItems unique item ids, possibly none (a warning without
 * sections.exam); redFlags an object whose keys are red flags of the module, each a non-empty list of
 * {ph, source} rows (review round 2: chart-register red-flag phrases);
 * placeholderAsk {text, source} (warned when placeholder and placeholderAsk come apart);
 * chartIgnoreThirdParty rows naming cues of lexicon.thirdParty.cues; strictConflict unique yes/no
 * item ids of a negative (rule-out) domain (a warning for one with no lexicon.bool entry). The
 * phrases themselves are V29's (lexiconPhrases).
 */
function checkClauses(lex, items, c, r) {
  const cl = lex.clauses;
  if (cl === undefined) return;
  const P = "/lexicon/clauses";
  if (!isObj(cl)) { c.E("V28", P, "clauses must be an object of chart-reading lists and switches"); return; }
  for (const k of Object.keys(cl)) {
    if (!LEXICON_CLAUSES_KEYS.includes(k)) c.E("V28", ptr("lexicon", "clauses", k), `"${k}" is not a clauses field (${LEXICON_CLAUSES_KEYS.join(", ")})`);
  }
  for (const k of ["wordStart", "redFlagNegation"]) {
    if (cl[k] !== undefined && typeof cl[k] !== "boolean") c.E("V28", `${P}/${k}`, `${k} must be true or false`);
  }
  const quoted = (xs) => xs.map((x) => `"${x}"`).join(", ");
  const rowList = (xs, p, what) => {
    if (!Array.isArray(xs) || !xs.length) { c.E("V28", p, `${what} must be a non-empty list of {ph, source}`); return []; }
    const seen = new Set();
    const phrases = [];
    xs.forEach((e, i) => {
      const ep = `${p}/${i}`;
      if (!isObj(e) || typeof e.ph !== "string") { c.E("V28", ep, "an entry is {ph, source}: the phrase and where it comes from"); return; }
      for (const k of Object.keys(e)) if (k !== "ph" && k !== "source") c.E("V28", `${ep}/${esc(k)}`, `"${k}" is not a field of a {ph, source} entry`);
      if (!LEXICON_SOURCES.includes(e.source)) c.E("V28", `${ep}/source`, `source must be one of ${quoted(LEXICON_SOURCES)}`);
      if (seen.has(e.ph)) c.E("V28", `${ep}/ph`, `"${e.ph}" is listed twice`);
      seen.add(e.ph);
      phrases.push([e.ph, `${ep}/ph`]);
    });
    return phrases;
  };
  const lists = {};
  for (const k of LEXICON_CLAUSE_LISTS) if (cl[k] !== undefined) lists[k] = rowList(cl[k], `${P}/${k}`, k);
  // chartIgnoreThirdParty: the lexicon's own attribution cues that do not gate in typed chart text.
  const tpCues = isObj(lex.thirdParty) && Array.isArray(lex.thirdParty.cues) ? lex.thirdParty.cues : [];
  for (const [ph, pp] of lists.chartIgnoreThirdParty || []) {
    if (!tpCues.includes(ph)) c.E("V28", pp, `"${ph}" is not a cue of lexicon.thirdParty.cues; chartIgnoreThirdParty names the lexicon's attribution cues that do not gate in chart text`);
  }
  if (cl.sections !== undefined) {
    if (!isObj(cl.sections)) c.E("V28", `${P}/sections`, `sections must be an object of header-word lists by kind (${LEXICON_SECTION_KINDS.join(", ")})`);
    else {
      const kindOfWord = new Map();
      for (const k of Object.keys(cl.sections)) {
        if (!LEXICON_SECTION_KINDS.includes(k)) { c.E("V28", ptr("lexicon", "clauses", "sections", k), `"${k}" is not a section kind (${LEXICON_SECTION_KINDS.join(", ")})`); continue; }
        for (const [w, wp] of rowList(cl.sections[k], ptr("lexicon", "clauses", "sections", k), `sections.${k}`)) {
          const key = w.toLowerCase().replace(/\s+/g, " ").trim();
          const other = kindOfWord.get(key);
          if (other !== undefined && other !== k) c.E("V28", wp, `"${w}" is already a ${other} section word; a header word names one kind`);
          else kindOfWord.set(key, k);
        }
      }
    }
  }
  if (cl.redFlags !== undefined) {
    if (!isObj(cl.redFlags)) c.E("V28", `${P}/redFlags`, "redFlags must be an object of chart-register phrase lists by red-flag id");
    else {
      const flagIds = new Set(arr(r && r.redFlags).filter(isObj).map((f) => f.id));
      for (const k of Object.keys(cl.redFlags)) {
        const fp = ptr("lexicon", "clauses", "redFlags", k);
        if (!flagIds.has(k)) c.E("V28", fp, `"${k}" is not a red flag of the module`);
        rowList(cl.redFlags[k], fp, `redFlags.${k}`);
      }
    }
  }
  if (cl.examItems !== undefined) {
    if (!Array.isArray(cl.examItems)) c.E("V28", `${P}/examItems`, "examItems must be a list of item ids (empty: nothing is captured inside an exam section)");
    else if (cl.examItems.length) {
      cl.examItems.forEach((id, i) => {
        if (typeof id !== "string" || !ownGet(items, id)) c.E("V28", `${P}/examItems/${i}`, `${JSON.stringify(id)} is not an item`);
        else if (cl.examItems.indexOf(id) < i) c.E("V28", `${P}/examItems/${i}`, `"${id}" is listed twice`);
      });
      if (!(isObj(cl.sections) && cl.sections.exam !== undefined)) c.W("V28", `${P}/examItems`, "examItems has no effect without sections.exam (no text is ever read as an exam)");
    }
  }
  // strictConflict: the rule-out items, for which any affirmed and any denied mention is a conflict.
  if (cl.strictConflict !== undefined) {
    const sc = cl.strictConflict;
    if (!Array.isArray(sc) || !sc.length) c.E("V28", `${P}/strictConflict`, "strictConflict must be a non-empty list of item ids");
    else {
      const negative = new Set();
      arr(r && r.domains).forEach((d) => { if (isObj(d) && d.negative === true) arr(d.items).forEach((it) => { if (isObj(it)) negative.add(it.id); }); });
      const boolIds = new Set(arr(lex.bool).filter(isObj).map((e) => e.id));
      sc.forEach((id, i) => {
        const ip = `${P}/strictConflict/${i}`;
        if (typeof id !== "string" || !ownGet(items, id)) c.E("V28", ip, `${JSON.stringify(id)} is not an item`);
        else if (sc.indexOf(id) < i) c.E("V28", ip, `"${id}" is listed twice`);
        else if (Array.isArray(items[id].scale)) c.E("V28", ip, `"${id}" is a scale item; strictConflict lists yes/no items`);
        else if (!negative.has(id)) c.E("V28", ip, `"${id}" is not an item of a negative (rule-out) domain; strictConflict lists the rule-out items, whose "yes" lowers the index`);
        else if (!boolIds.has(id)) c.W("V28", ip, `"${id}" has no yes/no entry in lexicon.bool, so strictConflict has no effect for it`);
      });
    }
  }
  if (cl.placeholderAsk !== undefined) {
    const a = cl.placeholderAsk;
    if (!isObj(a)) c.E("V28", `${P}/placeholderAsk`, "placeholderAsk must be {text, source}");
    else {
      if (!nonEmpty(a.text)) c.E("V28", `${P}/placeholderAsk/text`, "placeholderAsk.text must be a non-empty string (the question of the placeholder card)");
      if (!LEXICON_ASK_SOURCES.includes(a.source)) c.E("V28", `${P}/placeholderAsk/source`, `source must be one of ${quoted(LEXICON_ASK_SOURCES)}`);
      for (const k of Object.keys(a)) if (k !== "text" && k !== "source") c.E("V28", `${P}/placeholderAsk/${esc(k)}`, `"${k}" is not a field of placeholderAsk`);
    }
    if (cl.placeholder === undefined) c.W("V28", `${P}/placeholderAsk`, "placeholderAsk has no effect without placeholder (no placeholder card is ever shown)");
  } else if (cl.placeholder !== undefined) {
    c.W("V28", `${P}/placeholder`, "placeholder without placeholderAsk: a placeholder clause records nothing, but no card can ask about it");
  }
}

/**
 * lexicon.clarify (release 0.4.7; contract LEXICON_CLARIFY_KEYS), V28, rubric half: a non-empty
 * list of entries with known keys, an id matching ID_RE and unique, a non-empty ph list, a
 * non-empty unless list when present, exactly one of probe (a non-empty string; checked against the
 * logic by checkClarifyProbes) or item (an item), an ask {text, source} when present, and a source.
 */
function checkClarify(lex, items, c) {
  const list = lex.clarify;
  if (list === undefined) return;
  const P = "/lexicon/clarify";
  if (!Array.isArray(list) || !list.length) { c.E("V28", P, "clarify must be a non-empty list of clarification entries"); return; }
  const quoted = (xs) => xs.map((x) => `"${x}"`).join(", ");
  const ids = new Set();
  list.forEach((e, i) => {
    const p = `${P}/${i}`;
    if (!isObj(e)) { c.E("V28", p, "a clarification entry is {id, ph, unless?, probe | item, ask?, source}"); return; }
    for (const k of Object.keys(e)) if (!LEXICON_CLARIFY_KEYS.includes(k)) c.E("V28", `${p}/${esc(k)}`, `"${k}" is not a clarify field (${LEXICON_CLARIFY_KEYS.join(", ")})`);
    if (typeof e.id !== "string" || !ID_RE.test(e.id)) c.E("V28", `${p}/id`, "id must match /^[a-z][a-z0-9_]*$/");
    else if (ids.has(e.id)) c.E("V28", `${p}/id`, `duplicate clarify id "${e.id}"`);
    else ids.add(e.id);
    if (!Array.isArray(e.ph) || !e.ph.length) c.E("V28", `${p}/ph`, "ph must be a non-empty list of trigger phrases");
    if (e.unless !== undefined && (!Array.isArray(e.unless) || !e.unless.length)) c.E("V28", `${p}/unless`, "unless must be a non-empty list of qualifier phrases when present");
    if ((e.probe === undefined) === (e.item === undefined)) c.E("V28", p, "a clarification entry names exactly one of probe or item");
    else if (e.item !== undefined && !(typeof e.item === "string" && ownGet(items, e.item))) c.E("V28", `${p}/item`, `${JSON.stringify(e.item)} is not an item`);
    else if (e.probe !== undefined && !nonEmpty(e.probe)) c.E("V28", `${p}/probe`, "probe must be a probe id");
    if (e.ask !== undefined) {
      if (!isObj(e.ask)) c.E("V28", `${p}/ask`, "ask must be {text, source}");
      else {
        if (!nonEmpty(e.ask.text)) c.E("V28", `${p}/ask/text`, "ask.text must be a non-empty string");
        if (!LEXICON_ASK_SOURCES.includes(e.ask.source)) c.E("V28", `${p}/ask/source`, `ask.source must be one of ${quoted(LEXICON_ASK_SOURCES)}`);
        for (const k of Object.keys(e.ask)) if (k !== "text" && k !== "source") c.E("V28", `${p}/ask/${esc(k)}`, `"${k}" is not a field of ask`);
      }
    }
    if (!LEXICON_SOURCES.includes(e.source)) c.E("V28", `${p}/source`, `source must be one of ${quoted(LEXICON_SOURCES)}`);
  });
}

/** lexicon.clarify, V28, logic half (release 0.4.7): every probe an entry names is a probe of the module's logic. */
function checkClarifyProbes(module, c) {
  const lex = module.rubric && module.rubric.lexicon;
  if (!isObj(lex) || !Array.isArray(lex.clarify)) return;
  const pr = module.logic && module.logic.probes;
  const ids = new Set((Array.isArray(pr) ? pr : isObj(pr) ? arr(pr.list) : []).filter(isObj).map((x) => x.id));
  lex.clarify.forEach((e, i) => {
    if (!isObj(e) || !nonEmpty(e.probe) || e.item !== undefined) return;
    if (!ids.has(e.probe)) c.E("V28", `/lexicon/clarify/${i}/probe`, `"${e.probe}" is not a probe of this module's logic`);
  });
}

// lexicon.normalize (contract LEXICON_NORMALIZE_KEYS): the characters apostrophes: true folds to
// "'" before matching, and a standalone integer token that numbers: "en" spells out as a word
// (0–20 and the round tens 30–90; bounded by anything but a letter, a digit or . : / , % -, where
// a "." followed by whitespace or the end is sentence punctuation). A phrase holding a folded
// apostrophe can never match (V29 warning, every phrase list). Numbers are spelled out only for
// band phrase matching, so only a band phrase holding such a token can never match (V29 warning);
// every other phrase list matches typed digits as digits.
const FOLDED_APOSTROPHE_RE = /[\u2018\u2019\u02BC\u2032]/;
const NUMBER_TOKEN_RE = /(?<![\p{L}\p{N}.:\/,%-])(\d+)(?![\p{L}\p{N}:\/,%-])(?!\.\S)/gu;
const BAND_PHRASE_PTR_RE = /^\/lexicon\/scale\/\d+\/bands\/\d+\/ph\/\d+$/;
const spelledNumber = (tok) => {
  const n = Number(tok);
  return tok === String(n) && (n <= 20 || (n <= 90 && n % 10 === 0));
};

/** The id cycles among scale entries through `yieldTo`, each once, as index lists starting at its lowest index. */
function yieldCycles(scale) {
  const n = scale.length;
  const edges = scale.map((e, i) => {
    if (!isObj(e) || !Array.isArray(e.yieldTo)) return [];
    const out = [];
    scale.forEach((t, j) => {
      if (j !== i && isObj(t) && typeof t.id === "string" && t.id !== e.id && e.yieldTo.includes(t.id)) out.push(j);
    });
    return out;
  });
  const cycles = [];
  let budget = 20000;
  for (let s = 0; s < n && cycles.length < 20 && budget > 0; s++) {
    const path = [s];
    const onPath = new Set(path);
    const walk = (u) => {
      for (const v of edges[u]) {
        if (cycles.length >= 20 || --budget <= 0) return;
        if (v === s) { cycles.push(path.slice()); continue; }
        if (v < s || onPath.has(v)) continue;
        path.push(v); onPath.add(v);
        walk(v);
        path.pop(); onPath.delete(v);
      }
    };
    walk(s);
  }
  return cycles;
}

function checkLexicon(r, c, { origin }) {
  const lex = r.lexicon;
  if (lex === undefined || lex === null) return;
  if (!isObj(lex)) { c.E("V28", "/lexicon", "lexicon must be an object"); return; }
  const items = dict();
  arr(r.domains).forEach(d => arr(isObj(d) && d.items).forEach(it => { if (isObj(it)) items[it.id] = it; }));
  const ctxById = dict();
  arr(r.contextItems).forEach(ci => { if (isObj(ci)) ctxById[ci.id] = ci; });
  const flagIds = arr(r.redFlags).filter(isObj).map(f => f.id);
  const ctxValueOk = (id, v) => !!ctxById[id] && arr(ctxById[id].options).some(o => Array.isArray(o) && o[0] === v);
  const itemValueOk = (it, v) => (Array.isArray(it.scale) ? Number.isInteger(v) && v >= 0 && v < it.scale.length : v === "yes" || v === "no");
  // Ids a yieldTo may name: every scale and yes/no entry of this lexicon.
  const entryIds = new Set([...arr(lex.scale), ...arr(lex.bool)].filter((e) => isObj(e) && typeof e.id === "string").map((e) => e.id));
  // V28
  for (const k of ["bool", "ctx", "scale", "multi"]) if (!Array.isArray(lex[k])) c.E("V28", `/lexicon/${k}`, `lexicon.${k} must be a list`);
  arr(lex.bool).forEach((e, i) => {
    const p = `/lexicon/bool/${i}`;
    if (!isObj(e) || !items[e.id]) c.E("V28", p + "/id", `"${isObj(e) ? e.id : e}" is not an item`);
    else if (Array.isArray(items[e.id].scale)) c.E("V28", p + "/id", `"${e.id}" is a scale item; boolean phrases need a boolean item`);
    if (isObj(e) && (!Array.isArray(e.ph) || !e.ph.length)) c.E("V28", p + "/ph", "phrase list must be non-empty");
  });
  arr(lex.ctx).forEach((e, i) => {
    const p = `/lexicon/ctx/${i}`;
    if (!isObj(e) || !ctxById[e.id]) c.E("V28", p + "/id", `"${isObj(e) ? e.id : e}" is not a context item`);
    else if (!ctxValueOk(e.id, e.val)) c.E("V28", p + "/val", `"${e.val}" is not an option of "${e.id}"`);
    if (isObj(e) && (!Array.isArray(e.ph) || !e.ph.length)) c.E("V28", p + "/ph", "phrase list must be non-empty");
  });
  arr(lex.scale).forEach((e, i) => {
    const p = `/lexicon/scale/${i}`;
    const it = isObj(e) ? items[e.id] : undefined;
    if (!it || !Array.isArray(it.scale)) { c.E("V28", p + "/id", `"${isObj(e) ? e.id : e}" is not a scale item`); return; }
    if (!Array.isArray(e.cue) || !e.cue.length) c.E("V28", p + "/cue", "cue list must be non-empty");
    if (!Array.isArray(e.bands)) c.E("V28", p + "/bands", "bands must be a list (it may be empty when a fallback is given)");
    else if (!e.bands.length && (e.fallback === null || e.fallback === undefined)) c.E("V28", p + "/bands", `"${e.id}" has no bands and no fallback, so a cue can never set a value`);
    arr(e.bands).forEach((b, j) => {
      if (!isObj(b) || !Number.isInteger(b.v) || b.v < 0 || b.v >= it.scale.length) c.E("V28", `${p}/bands/${j}/v`, `v must be an option index of "${e.id}" (0–${it.scale.length - 1})`);
      if (isObj(b) && (!Array.isArray(b.ph) || !b.ph.length)) c.E("V28", `${p}/bands/${j}/ph`, "phrase list must be non-empty");
    });
    if (!(e.fallback === null || (Number.isInteger(e.fallback) && e.fallback >= 0 && e.fallback < it.scale.length))) {
      c.E("V28", p + "/fallback", `fallback must be null or an option index of "${e.id}"`);
    }
    // Heard signal, carry-over and the yield rule (contract Lexicon typedef; all optional).
    if (e.heard !== undefined && typeof e.heard !== "boolean") c.E("V28", p + "/heard", "heard must be true or false");
    if (e.heard === true && e.fallback !== null && e.fallback !== undefined) {
      c.W("V28", p + "/heard", `"${e.id}" has a fallback, so its cue always sets a value and is never heard without one`);
    }
    if (e.carry !== undefined) {
      if (!Number.isInteger(e.carry) || e.carry < 1 || e.carry > LEXICON_CARRY_MAX) {
        c.E("V28", p + "/carry", `carry must be an integer from 1 to ${LEXICON_CARRY_MAX}: how many following patient replies may supply the value`);
      }
      if (e.heard !== true) c.E("V28", p + "/carry", "carry needs heard: true (carry-over starts from a cue heard without its value)");
      arr(e.bands).forEach((b, j) => {
        const o = isObj(b) && Number.isInteger(b.v) && b.v >= 0 ? it.scale[b.v] : undefined;
        if (isObj(o) && o.f === 0) {
          c.E("V28", p + "/carry", `band ${j} of "${e.id}" records option ${b.v} ("${o.label}", f = 0): a follow-up reply must never record a negative answer, so carry cannot be used on this entry`);
        }
      });
    }
    if (e.yieldTo !== undefined) {
      if (!Array.isArray(e.yieldTo) || !e.yieldTo.length) c.E("V28", p + "/yieldTo", "yieldTo must be a non-empty list of lexicon entry ids");
      else e.yieldTo.forEach((x, k) => {
        const xp = `${p}/yieldTo/${k}`;
        if (x === e.id) c.E("V28", xp, "an entry cannot yield to itself");
        else if (typeof x !== "string" || !entryIds.has(x)) c.E("V28", xp, `"${x}" is not the id of another scale or yes/no entry of this lexicon`);
        else if (e.yieldTo.indexOf(x) < k) c.E("V28", xp, `"${x}" is listed twice`);
      });
    }
    if (e.anchor !== undefined) {
      if (e.yieldTo === undefined) c.E("V28", p + "/anchor", "anchor has no effect without yieldTo");
      if (!Array.isArray(e.anchor) || !e.anchor.length) c.E("V28", p + "/anchor", "anchor must be a non-empty phrase list");
    }
    if (e.carryExclude !== undefined) {
      if (e.carry === undefined) c.E("V28", p + "/carryExclude", "carryExclude needs carry on the same entry (it names band phrases that never supply a carried value)");
      if (!Array.isArray(e.carryExclude) || !e.carryExclude.length) c.E("V28", p + "/carryExclude", "carryExclude must be a non-empty list of this entry's band phrases");
      else e.carryExclude.forEach((x, k) => {
        const xp = `${p}/carryExclude/${k}`;
        if (typeof x !== "string" || !x.trim()) c.E("V28", xp, "a carryExclude phrase must be a non-empty string");
        else if (x !== x.toLowerCase()) c.E("V28", xp, "carryExclude phrases name band phrases, which are matched against lowercased text, so they must be lowercase");
        else if (!arr(e.bands).some((b) => isObj(b) && Array.isArray(b.ph) && b.ph.includes(x))) {
          c.E("V28", xp, `"${x}" is not a band phrase of "${e.id}" (carryExclude must name this entry's band phrases verbatim, so a band phrase it names cannot be removed)`);
        } else if (e.carryExclude.indexOf(x) < k) c.E("V28", xp, `"${x}" is listed twice`);
      });
    }
    for (const k of Object.keys(e)) {
      if (!LEXICON_SCALE_KEYS.includes(k)) c.W("V28", ptr("lexicon", "scale", i, k), `"${k}" is not a lexicon scale field and is ignored (a misspelt heard, carry, yieldTo, anchor or carryExclude?)`);
    }
  });
  for (const cyc of yieldCycles(arr(lex.scale))) {
    const names = cyc.map((j) => String(lex.scale[j].id));
    c.E("V28", `/lexicon/scale/${cyc[0]}/yieldTo`, `yield cycle ${[...names, names[0]].join(" → ")}: an utterance that names all of them captures none of them`);
  }
  if (lex.carryRefuse !== undefined) {
    if (!Array.isArray(lex.carryRefuse) || !lex.carryRefuse.length) c.E("V28", "/lexicon/carryRefuse", "carryRefuse must be a non-empty phrase list");
    // It acts on carried replies (an entry with carry) and, for an entry with heard: true, on the
    // cue's own utterance (no band value is taken there); with neither it is inert.
    if (!arr(lex.scale).some((e) => isObj(e) && (e.heard === true || e.carry !== undefined))) {
      c.W("V28", "/lexicon/carryRefuse", "carryRefuse has no effect: no scale entry has heard: true or carry");
    }
  }
  const norm = lex.normalize;
  if (norm !== undefined) {
    if (!isObj(norm)) c.E("V28", "/lexicon/normalize", 'normalize must be an object: {apostrophes?: true or false, numbers?: "en"}');
    else {
      for (const k of Object.keys(norm)) {
        if (!LEXICON_NORMALIZE_KEYS.includes(k)) c.E("V28", ptr("lexicon", "normalize", k), `"${k}" is not a normalize option (${LEXICON_NORMALIZE_KEYS.join(", ")})`);
      }
      if (norm.apostrophes !== undefined && typeof norm.apostrophes !== "boolean") {
        c.E("V28", "/lexicon/normalize/apostrophes", "apostrophes must be true or false");
      }
      if (norm.numbers !== undefined) {
        const lang = lex.lang === undefined ? "en-US" : lex.lang;
        if (norm.numbers !== "en") c.E("V28", "/lexicon/normalize/numbers", 'numbers must be "en" (English number words, the only set the extractor knows)');
        else if (typeof lang !== "string" || !/^en(?:-|$)/.test(lang)) {
          c.E("V28", "/lexicon/normalize/numbers", `numbers "en" spells numbers as English words, so it needs an English lexicon lang ("en" or "en-…"), not "${lang}"`);
        }
      }
    }
  }
  checkClauses(lex, items, c, r);
  checkClarify(lex, items, c);
  arr(lex.multi).forEach((e, i) => {
    const p = `/lexicon/multi/${i}`;
    if (!isObj(e) || !Array.isArray(e.ids) || !e.ids.length) { c.E("V28", p + "/ids", "ids must be a non-empty list"); return; }
    e.ids.forEach((x, j) => {
      const xp = `${p}/ids/${j}`;
      if (!isObj(x)) { c.E("V28", xp, "an entry is {id, value, kind}"); return; }
      if (x.kind === "item") {
        if (!items[x.id]) c.E("V28", xp + "/id", `"${x.id}" is not an item`);
        else if (!itemValueOk(items[x.id], x.value)) c.E("V28", xp + "/value", `"${x.value}" is not a valid answer of "${x.id}"`);
      } else if (x.kind === "ctx") {
        if (!ctxById[x.id]) c.E("V28", xp + "/id", `"${x.id}" is not a context item`);
        else if (!ctxValueOk(x.id, x.value)) c.E("V28", xp + "/value", `"${x.value}" is not an option of "${x.id}"`);
      } else c.E("V28", xp + "/kind", 'kind must be "item" or "ctx"');
    });
    if (!Array.isArray(e.ph) || !e.ph.length) c.E("V28", p + "/ph", "phrase list must be non-empty");
  });
  if (!isObj(lex.redFlags)) c.E("V28", "/lexicon/redFlags", "redFlags must map every red-flag id to its cue phrases");
  else {
    for (const id of flagIds) {
      if (!(id in lex.redFlags)) c.E("V28", ptr("lexicon", "redFlags", id), `red flag "${id}" has no cue phrases, so it could never be raised from speech`);
      else if (!Array.isArray(lex.redFlags[id]) || !lex.redFlags[id].length) c.E("V28", ptr("lexicon", "redFlags", id), `red flag "${id}" needs at least one cue phrase`);
    }
    for (const id of Object.keys(lex.redFlags)) if (!flagIds.includes(id)) c.E("V28", ptr("lexicon", "redFlags", id), `"${id}" is not a red flag`);
  }
  // V29
  const foldsApostrophes = isObj(norm) && norm.apostrophes === true;
  const spellsNumbers = isObj(norm) && norm.numbers === "en";
  for (const [s, p] of lexiconPhrases(lex)) {
    const clausePhrase = CLAUSE_PHRASE_PTR_RE.test(p);
    if (typeof s !== "string" || !s.trim()) c.E("V29", p, "a phrase must be a non-empty string");
    else if (s !== s.toLowerCase()) c.E("V29", p, "phrases are matched against lowercased text, so they must be lowercase");
    else if (clausePhrase && CLAUSE_SPACING_RE.test(s)) c.E("V29", p, `the cue "${s}" has more than one space at an end, a tab or a line break; one boundary space at either end is the most a cue may carry`);
    else if (s.length < 3 && !(clausePhrase && (!HAS_WORD_CHAR_RE.test(s) || !CLAUSE_SUBSTRING_PTR_RE.test(p)))) c.W("V29", p, `the phrase "${s}" is under 3 characters and may match inside other words`);
    if (typeof s !== "string") continue;
    if (foldsApostrophes && FOLDED_APOSTROPHE_RE.test(s)) {
      c.W("V29", p, `the phrase "${s}" holds a typographic apostrophe, which normalize.apostrophes folds to ' before matching, so the phrase can never match; write ' instead`);
    }
    if (spellsNumbers && BAND_PHRASE_PTR_RE.test(p)) {
      const tok = [...s.matchAll(NUMBER_TOKEN_RE)].map((m) => m[1]).find(spelledNumber);
      if (tok !== undefined) c.W("V29", p, `the band phrase "${s}" holds the number ${tok}, which normalize.numbers spells out as a word before band matching, so the phrase can never match; spell the number out`);
    }
  }
  // V30
  for (const k of ["negation", "thirdParty", "historical"]) {
    const g = lex[k];
    if (!isObj(g)) { c.E("V30", `/lexicon/${k}`, `${k} {window, cues} is required`); continue; }
    if (!Number.isInteger(g.window) || g.window <= 0) c.E("V30", `/lexicon/${k}/window`, "window must be an integer > 0");
    if (!Array.isArray(g.cues) || !g.cues.length) c.E("V30", `/lexicon/${k}/cues`, "cues must be a non-empty list");
  }
  if (lex.goldSet !== undefined && lex.goldSet !== null) {
    if (!isObj(lex.goldSet)) c.E("V30", "/lexicon/goldSet", "goldSet must be {version, lexiconVersion, file?} or null");
    else for (const k of ["version", "lexiconVersion"]) if (!nonEmpty(lex.goldSet[k])) c.E("V30", `/lexicon/goldSet/${k}`, `goldSet.${k} is required`);
  } else if (origin === "builtin") c.E("V30", "/lexicon/goldSet", "a built-in lexicon names its gold set");
  if (lex.lang !== undefined && (typeof lex.lang !== "string" || !/^[a-z]{2}(-[A-Z]{2})?$/.test(lex.lang))) c.E("V30", "/lexicon/lang", 'lang must look like "en" or "en-US"');
}

function checkLocales(r, c, merged) {
  const locales = r.locales;
  if (r.defaultLocale !== undefined && r.defaultLocale !== "en") c.E("V31", "/defaultLocale", 'defaultLocale must be "en" in contract 1');
  if (locales === undefined) return;
  if (!isObj(locales)) { c.E("V31", "/locales", "locales must be an object"); return; }
  const items = [];
  arr(r.domains).forEach(d => arr(isObj(d) && d.items).forEach(it => { if (isObj(it)) items.push(it); }));
  const itemById = Object.assign(dict(), Object.fromEntries(items.map(it => [it.id, it])));
  for (const loc of Object.keys(locales)) {
    const L = locales[loc];
    const lp = ptr("locales", loc);
    // V31
    if (!SUPPORTED_LOCALES.includes(loc)) c.E("V31", lp, `locale "${loc}" is not supported (${SUPPORTED_LOCALES.join(", ")})`);
    if (!isObj(L)) { c.E("V31", lp, "a locale must be an object"); continue; }
    if (typeof L.reviewed !== "boolean") c.E("V31", lp + "/reviewed", "reviewed must be true or false");
    // V32
    if (L.items !== undefined) {
      if (!isObj(L.items)) { c.E("V32", lp + "/items", "items must map item ids to {q, opts?, ask?, help?, clin?}"); continue; }
      for (const id of Object.keys(L.items)) {
        const e = L.items[id], it = itemById[id], ip = ptr("locales", loc, "items", id);
        if (!it) { c.E("V32", ip, `"${id}" is not an item`); continue; }
        if (!isObj(e)) { c.E("V32", ip, "an entry is {q, opts?, ask?, help?, clin?}"); continue; }
        if (!nonEmpty(e.q)) c.E("V32", ip + "/q", "q must be non-empty");
        if (Array.isArray(it.scale)) {
          if (e.opts !== undefined && (!Array.isArray(e.opts) || e.opts.length !== it.scale.length)) c.E("V32", ip + "/opts", `opts must have exactly ${it.scale.length} entries (the item's scale)`);
          if (e.opts === undefined && loc === "en") c.E("V32", ip + "/opts", `a scale item needs opts (${it.scale.length})`);
        } else if (e.opts !== undefined) c.E("V32", ip + "/opts", "a boolean item has no opts");
        // Release 0.4.2: an optional translated clinician line (the "For my clinician" block). English
        // has none: its clinician line is the item's patientClin. V60 checks it like every locale string.
        if (e.clin !== undefined) {
          if (loc === "en") c.E("V32", ip + "/clin", "English takes its clinician line from the item's patientClin; clin is for translations");
          else if (!nonEmpty(e.clin)) c.E("V32", ip + "/clin", "clin must be a non-empty string when present");
        }
      }
    }
  }
  const en = isObj(locales.en) ? locales.en : null;
  if (en && isObj(en.items)) {
    for (const it of items) if (!isObj(en.items[it.id])) c.E("V32", ptr("locales", "en", "items", it.id), `no English patient wording for item "${it.id}"`);
  }
  // V33
  for (const loc of Object.keys(merged)) {
    const fb = merged[loc].fallbacks;
    if (!fb.length) continue;
    const reviewed = isObj(locales[loc]) && locales[loc].reviewed === true;
    for (const p of fb) {
      if (reviewed) c.E("V33", p, `"${loc}" is marked reviewed but this text falls back to English`);
      else c.W("V33", p, `falls back to English in "${loc}"`);
    }
  }
  // V34
  for (const loc of Object.keys(locales)) {
    const walk = (x, p, seen) => {
      if (x === null || typeof x !== "object" || seen.has(x)) return;
      seen.add(x);
      if (Array.isArray(x)) { x.forEach((v, i) => walk(v, `${p}/${i}`, seen)); return; }
      for (const k of Object.keys(x)) {
        if (["points", "action", "differential"].includes(k)) c.E("V34", `${p}/${esc(k)}`, `"${k}" is clinician-only and never belongs in patient wording`);
        walk(x[k], `${p}/${esc(k)}`, seen);
      }
    };
    walk(locales[loc], ptr("locales", loc), new Set());
  }
}

function checkIdentityAndResearch(r, c, identity, { origin, classification }) {
  // V35
  const fieldPath = (f) => "/" + f.split(".").map(esc).join("/");
  for (const f of ["fhir.questionnaireUrl", "fhir.codeSystem", "fhir.answerSystem", "fhir.criteriaSystem", "fhir.weightExtension", "cds.source.url"]) {
    const v = getPath(identity, f);
    if (typeof v !== "string" || !ABS_URL.test(v)) c.E("V35", fieldPath(f), `${f} must render to an absolute URL (got ${JSON.stringify(v)})`);
  }
  for (const f of IDENTITY_TEMPLATE_FIELDS) {
    const v = getPath(identity, f);
    if (typeof v !== "string" || !v.trim() || /[{}]/.test(v) || /\s/.test(v)) c.E("V35", fieldPath(f), `${f} must render to a non-empty identifier without spaces or braces (got ${JSON.stringify(v)})`);
  }
  for (const f of ["questionnaireName", "questionnaireTitle", "publisher", "description", "safetyGroupText", "indexDisplay", "documentType", "documentTitle"]) {
    if (!nonEmpty(identity.fhir[f])) c.E("V35", `/fhir/${f}`, `fhir.${f} must be non-empty`);
  }
  if (typeof identity.fhir.questionnaireName === "string" && !/^[A-Z][A-Za-z0-9_]{0,254}$/.test(identity.fhir.questionnaireName)) {
    c.E("V35", "/fhir/questionnaireName", "questionnaireName must be a FHIR name ([A-Z][A-Za-z0-9_]*)");
  }
  // V36
  const scaleMax = scaleMaxOf({ domains: arr(r.domains).filter(isObj) });
  const flagIds = arr(r.redFlags).filter(isObj).map(f => f.id);
  const ex = isObj(identity.cds.examples) ? identity.cds.examples : null;
  if (!ex || !isObj(ex.redFlagPresent)) c.E("V36", "/cds/examples/redFlagPresent", "cds.examples.redFlagPresent {flagId, summary} is required");
  else {
    if (!flagIds.includes(ex.redFlagPresent.flagId)) c.E("V36", "/cds/examples/redFlagPresent/flagId", `"${ex.redFlagPresent.flagId}" is not a red flag`);
    if (!nonEmpty(ex.redFlagPresent.summary)) c.E("V36", "/cds/examples/redFlagPresent/summary", "summary must be non-empty");
  }
  if (ex && ex.settled !== undefined) {
    const s = ex.settled;
    const cuts = isObj(r.bands) && isObj(r.bands.cuts) ? r.bands.cuts : null;
    if (!isObj(s) || typeof s.score !== "number" || s.score < 0 || s.score > scaleMax) c.E("V36", "/cds/examples/settled/score", `score must be within 0–${scaleMax}`);
    else if (!["moderate", "high"].includes(s.band)) c.E("V36", "/cds/examples/settled/band", 'band must be "moderate" or "high"');
    else if (cuts && bandFor(cuts, s.score) !== s.band) c.E("V36", "/cds/examples/settled/band", `a score of ${s.score} is in band "${bandFor(cuts, s.score)}", not "${s.band}"`);
  }
  // V37
  const rs = r.research;
  if (rs === undefined) return;
  if (!isObj(rs)) { c.E("V37", "/research", "research must be an object"); return; }
  for (const k of ["projectKey", "title", "target", "artifactKey", "etlScript"]) if (!nonEmpty(rs[k])) c.E("V37", `/research/${k}`, `research.${k} is required`);
  for (const k of ["sources", "expected", "demo", "scoreAliases", "fairnessAxes"]) if (!Array.isArray(rs[k])) c.E("V37", `/research/${k}`, `research.${k} must be a list`);
  if (typeof rs.threshold !== "number" || !(rs.threshold > 0 && rs.threshold < 1)) c.E("V37", "/research/threshold", "threshold must be in (0, 1)");
  const cal = rs.calibration;
  if (!isObj(cal)) c.E("V37", "/research/calibration", "calibration {midpoint, slope, appliesTo} is required");
  else {
    for (const k of ["midpoint", "slope"]) if (typeof cal[k] !== "number" || !Number.isFinite(cal[k])) c.E("V37", `/research/calibration/${k}`, `${k} must be a finite number`);
    if (!isObj(cal.appliesTo) || typeof cal.appliesTo.scoringHash !== "string" || !HEX64.test(cal.appliesTo.scoringHash)) {
      c.E("V37", "/research/calibration/appliesTo/scoringHash", "appliesTo.scoringHash must be 64 hex digits");
    }
  }
  const fpo = rs.fairnessPolicyOverride;
  if (fpo !== undefined) {
    if (!isObj(fpo)) c.E("V37", "/research/fairnessPolicyOverride", "must be an object");
    else {
      const allowed = ["selectionGapTolerance", "sensitivityGapTolerance", "specificityGapTolerance", "toleranceSetBy", "toleranceRationale", "toleranceSetOn"];
      for (const k of Object.keys(fpo)) if (!allowed.includes(k)) c.E("V37", ptr("research", "fairnessPolicyOverride", k), `only the three gap tolerances may be overridden (not "${k}")`);
      for (const k of ["toleranceSetBy", "toleranceRationale", "toleranceSetOn"]) if (!nonEmpty(fpo[k])) c.E("V37", `/research/fairnessPolicyOverride/${k}`, `an override needs ${k}`);
      for (const k of allowed.slice(0, 3)) if (fpo[k] !== undefined && (typeof fpo[k] !== "number" || !(fpo[k] >= 0 && fpo[k] <= 1))) c.E("V37", `/research/fairnessPolicyOverride/${k}`, `${k} must be a number in [0, 1]`);
    }
  }
  if (Array.isArray(rs.fairnessAxes) && Array.isArray(rs.expected)) {
    rs.fairnessAxes.forEach((a, i) => { if (!rs.expected.includes(a)) c.E("V37", `/research/fairnessAxes/${i}`, `"${a}" is not an expected column`); });
  }
  if (rs.population !== undefined) {
    const pop = rs.population;
    if (!isObj(pop)) c.E("V37", "/research/population", "population must be {index, schema, map}");
    else for (const k of ["index", "schema", "map"]) {
      const v = pop[k];
      if (typeof v !== "string" || !/^\.\/(data|etl)\/[^\s]+$/.test(v) || v.includes("..")) c.E("V37", `/research/population/${k}`, "population paths must lie under ./data/ or ./etl/");
    }
    const kind = classification && classification.kind;
    const rootBuiltin = !!(classification && classification.root && classification.root.origin === "builtin");
    if (origin !== undefined && !(origin === "builtin" || (kind === "verified" && rootBuiltin))) {
      c.E("V37", "/research/population", "Population estimates are accepted only for built-in modules and verified derivations of one; remove `research.population`");
    }
  }
}

function caveatStrings() {
  // Release 0.4.2: the Spanish patient caveats and the Spanish companion of the prototype marker
  // are engine-owned too.
  const P = CAVEATS.patient || {};
  const es = [
    P.edited && P.edited.es, P.edited && P.edited.esShort, P.uploaded && P.uploaded.es, P.uploaded && P.uploaded.esShort,
    CAVEATS.editedWording && CAVEATS.editedWording.es, CAVEATS.staleTranslation && CAVEATS.staleTranslation.es,
    CAVEATS.prototypeCompanion && CAVEATS.prototypeCompanion.es, "no apto para uso clínico",
  ];
  return [CAVEATS.prototype, "not for clinical use", CAVEATS.unreviewed.es.title, CAVEATS.unreviewed.es.body, CAVEATS.unreviewed.es.txt, CAVEATS.illustrative, ...es]
    .filter(nonEmpty).map(caveatKey);
}

/**
 * The form both sides of the V38 match take, in every language: canonical decomposition (NFD),
 * combining marks U+0300-U+036F removed, lower case. So a caveat typed without its accents
 * ("uso clinico") or stored decomposed still matches (release 0.4.2).
 */
function caveatKey(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function checkCaveats(x, base, c) {
  // V38
  const cav = caveatStrings();
  walkStrings(x, base, (s, p) => {
    const l = caveatKey(s);
    if (cav.some(k => l.includes(k))) c.E("V38", p, "caveat strings are engine-owned and never appear in module data");
  });
}

function checkCopy(r, c) {
  // V39
  const checkString = (s, path, slotKey) => {
    const allowed = new Set([...GLOBAL_PLACEHOLDERS, ...(COPY_SLOTS[slotKey] || [])]);
    for (const m of s.matchAll(PLACEHOLDER_RE)) {
      if (!allowed.has(m[1])) c.E("V39", path, `placeholder {${m[1]}} is not allowed in ${slotKey} (allowed: ${[...allowed].map(x => `{${x}}`).join(" ")})`);
    }
    if (((s.match(/\*\*/g) || []).length) % 2 !== 0) c.E("V39", path, "unbalanced ** (bold markers come in pairs)");
  };
  const walk = (x, segs, base) => {
    if (typeof x === "string") {
      const key = segs.filter(s => typeof s === "string").join(".");
      if (!(key in COPY_SLOTS)) { c.W("V39", base + ptr(...segs), `"${key}" is not a copy slot; it is never shown`); return; }
      checkString(x, base + ptr(...segs), key);
      return;
    }
    if (Array.isArray(x)) { x.forEach((v, i) => walk(v, [...segs, i], base)); return; }
    if (isObj(x)) { for (const k of Object.keys(x)) walk(x[k], [...segs, k], base); return; }
    if (x !== undefined) c.E("V39", base + ptr(...segs), "copy values are strings");
  };
  if (r.copy !== undefined) {
    if (!isObj(r.copy)) c.E("V39", "/copy", "copy must be an object of slots");
    else walk(r.copy, [], "/copy");
  }
  if (isObj(r.cds) && isObj(r.cds.preview)) {
    for (const k of Object.keys(r.cds.preview)) {
      const v = r.cds.preview[k];
      const slotKey = `cds.preview.${k}`;
      if (typeof v !== "string") c.E("V39", ptr("cds", "preview", k), "copy values are strings");
      else if (!(slotKey in COPY_SLOTS)) c.W("V39", ptr("cds", "preview", k), `"${slotKey}" is not a copy slot`);
      else checkString(v, ptr("cds", "preview", k), slotKey);
    }
  }
  if (isObj(r.locales)) {
    for (const loc of Object.keys(r.locales)) {
      const v = isObj(r.locales[loc]) && isObj(r.locales[loc].ui) ? r.locales[loc].ui.clinicianLede : undefined;
      if (typeof v === "string") checkString(v, ptr("locales", loc, "ui", "clinicianLede"), "locales.en.ui.clinicianLede");
    }
  }
}

function checkSamples(r, c) {
  const items = dict();
  arr(r.domains).forEach(d => arr(isObj(d) && d.items).forEach(it => { if (isObj(it)) items[it.id] = it; }));
  const ctxById = dict();
  arr(r.contextItems).forEach(ci => { if (isObj(ci)) ctxById[ci.id] = ci; });
  const flagIds = new Set(arr(r.redFlags).filter(isObj).map(f => f.id));
  const values = isObj(r.phenotypes) ? arr(r.phenotypes.values).filter(isObj).map(v => v.value) : [];
  // V49
  const ids = new Set();
  const samples = r.sampleCases;
  if (samples !== undefined && !Array.isArray(samples)) c.E("V49", "/sampleCases", "sampleCases must be a list");
  arr(samples).forEach((s, i) => {
    const p = ptr("sampleCases", i);
    if (!isObj(s)) { c.E("V49", p, "a sample case must be an object"); return; }
    if (!nonEmpty(s.id)) c.E("V49", p + "/id", "id is required");
    else if (ids.has(s.id)) c.E("V49", p + "/id", `duplicate sample id "${s.id}"`);
    ids.add(s.id);
    for (const k of ["label", "buttonLabel"]) if (!nonEmpty(s[k])) c.E("V49", `${p}/${k}`, `${k} is required`);
    if (s.group !== undefined && !["sample", "scenario"].includes(s.group)) c.E("V49", p + "/group", 'group is "sample" or "scenario"');
    if (!isObj(s.a)) c.E("V49", p + "/a", "a (the answers) is required");
    else for (const id of Object.keys(s.a)) {
      const v = s.a[id], it = items[id], ap = ptr("sampleCases", i, "a", id);
      if (!it) { c.E("V49", ap, `"${id}" is not an item`); continue; }
      if (v === "unsure") { c.E("V49", ap, '"unsure" is a Patient answer; a sample answers or leaves the item out'); continue; }
      const ok = Array.isArray(it.scale) ? Number.isInteger(v) && v >= 0 && v < it.scale.length : v === "yes" || v === "no";
      if (!ok) c.E("V49", ap, `${JSON.stringify(v)} is not a valid answer of "${id}"`);
    }
    if (s.ctx !== undefined) {
      if (!isObj(s.ctx)) c.E("V49", p + "/ctx", "ctx must be an object");
      else for (const id of Object.keys(s.ctx)) {
        const ci = ctxById[id];
        if (!ci) c.E("V49", ptr("sampleCases", i, "ctx", id), `"${id}" is not a context item`);
        else if (!arr(ci.options).some(o => Array.isArray(o) && o[0] === s.ctx[id])) c.E("V49", ptr("sampleCases", i, "ctx", id), `"${s.ctx[id]}" is not a clinician option of "${id}"`);
      }
    }
    if (s.rf !== undefined) {
      if (!isObj(s.rf)) c.E("V49", p + "/rf", "rf must be an object of flag ids");
      else for (const id of Object.keys(s.rf)) if (!flagIds.has(id) || s.rf[id] !== true) c.E("V49", ptr("sampleCases", i, "rf", id), `"${id}" is not a red flag (or not true)`);
    }
    if (s.complaint !== undefined && s.complaint !== "" && !values.includes(s.complaint)) c.E("V49", p + "/complaint", `"${s.complaint}" is not a phenotype value`);
    if (s.safetyReviewed !== undefined && typeof s.safetyReviewed !== "boolean") c.E("V49", p + "/safetyReviewed", "safetyReviewed must be a boolean");
  });
  // V50
  if (r.demo !== undefined) {
    if (!isObj(r.demo)) c.E("V50", "/demo", "demo must be an object");
    else {
      const pt = r.demo.patient;
      if (pt !== undefined) {
        if (!isObj(pt)) c.E("V50", "/demo/patient", "demo.patient must be an object");
        else {
          for (const k of ["id", "mrn"]) if (!nonEmpty(pt[k])) c.E("V50", `/demo/patient/${k}`, `${k} is required`);
          if (pt.synthetic !== true) c.E("V50", "/demo/patient/synthetic", "a demo patient is marked synthetic: true");
          for (const k of ["dob", "birthDate"]) if (pt[k] !== undefined) c.E("V50", `/demo/patient/${k}`, "no date of birth: an age plus a birth date is a date of birth");
        }
      }
      if (r.demo.transcript !== undefined) {
        if (!Array.isArray(r.demo.transcript)) c.E("V50", "/demo/transcript", "transcript must be a list");
        else r.demo.transcript.forEach((t, i) => {
          if (!Array.isArray(t) || t.length !== 2 || !["md", "pt"].includes(t[0]) || typeof t[1] !== "string") c.E("V50", `/demo/transcript/${i}`, 'a transcript entry is ["md" | "pt", text]');
        });
      }
    }
  }
}

// ---- V61: the EMR template data (release 0.4.3) --------------------------------------------

const EMR_KEYS = ["citations", "references", "instrumentRecs", "redFlagRefs", "redFlagPlaceholders", "history", "checklist", "examRows", "pastHistory", "planAdvice"];
/** The past-history groups of engine/emr.js (release 0.4.6): after the pregnancy line, or before the family-history placeholder. */
const EMR_PAST_GROUPS = ["medical", "family"];
const EMR_CITATION_FIELDS = ["title", "publisher", "citation", "url", "accessed"];
const EMR_CITE_KEY_RE = /^[A-Z0-9][A-Za-z0-9-]*$/;
const EMR_HTTPS_URL = /^https:\/\/[^\s[\]{}<>"]+$/;
const EMR_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A YYYY-MM-DD string that is a real calendar date (release 0.4.8: a plan-advice line's `decided`). */
const emrRealDate = (s) => {
  if (typeof s !== "string" || !EMR_DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const EMR_RENDERS = ["done", "answeredNo", "note", "neverTried"];
/**
 * The fields engine/emr.js reads on each kind of emrTemplate row (review round 4); any other key is
 * never read (V61 W). A checklist row's `id` is the validator's (unique row ids). A history row's
 * `citations` has its own error, so it is not reported twice.
 */
const EMR_ROW_FIELDS = {
  reference: ["label", "note", "citations", "showFor"],
  history: ["item", "qualifier", "label", "probe", "citations"],
  checklist: ["id", "group", "label", "citations", "placeholder", "box", "onlyWithSignal", "signals"],
  "item signal": ["item", "value", "render", "qualifier"],
  "probe signal": ["probe", "option", "render", "qualifier"],
  "exam row": ["label", "citations", "probe", "optionPlaceholders"],
  "option placeholder": ["option", "placeholder"],
  "past history": ["item", "label", "group"],
  // release 0.4.8: text is printed; source and decided are the line's record (checked, never printed)
  "plan advice": ["text", "source", "decided"],
};
const EMR_BRACKETS = /[[\]{}]/;
const SQUARE_BRACKETS = /[[\]]/;
/** The PROBE_KIND key of manoeuvre (examination) probes: the only kind an exam row may name. */
const EMR_EXAM_KIND = "exam";

/**
 * V61, rubric half. The template prints module strings next to its own `[placeholders]`, so:
 *   - every string of emrTemplate is free of [ ] { } (E), and the module strings the template prints
 *     (domains and items, red flags, context items, phenotypes, info-prompt tags, the note and title
 *     copy, the document title, the demo patient) carry no square bracket (W);
 *   - shape: known keys, and on every row only the fields engine/emr.js reads (W otherwise: references
 *     label, note, citations, showFor; history item, qualifier, label, probe; checklist id, group,
 *     label, citations, placeholder, box, onlyWithSignal, signals; item signals item, value, render,
 *     qualifier; probe signals probe, option, render, qualifier; exam rows label, citations, probe;
 *     review round 4; release 0.4.6: exam rows also optionPlaceholders {option, placeholder}, and
 *     pastHistory rows item, label, group); citations {title, publisher, citation, https url, accessed
 *     YYYY-MM-DD} under keys /^[A-Z0-9][A-Za-z0-9-]*$/; every citation key named exists (E) and every
 *     citation is used (W); every red flag, item, answer value and phenotype named exists (E);
 *     labels, placeholders and qualifiers are non-empty strings; box and onlyWithSignal are
 *     booleans (an onlyWithSignal row without signals is never printed: W); checklist ids are
 *     unique ids and renders are known; an item signal's render matches its answer's polarity
 *     ("done" and "note" print the item's positive wording, so they need a positive answer;
 *     "answeredNo" needs a negative one: "no" or a scale option with f 0; "neverTried" comes from a
 *     probe answer only) (E); instrumentRecs is a list of distinct rule ids; redFlagPlaceholders
 *     maps red flags to non-empty strings; a history row carries no citations (they are never
 *     printed), and only an item row a qualifier (E). Release 0.4.6: a pastHistory row has exactly
 *     one of item or label and a group of medical or family, and its item is not also a history
 *     row's or another pastHistory row's (it would print twice); an exam row's optionPlaceholders
 *     is a list of {option: a probe option index, placeholder: a non-empty string}, on a row with a
 *     probe only, one per option (E). Release 0.4.8: planAdvice is a list of {text, source, decided}:
 *     text a non-empty string (printed verbatim as a plan line beside the references), source a
 *     non-empty string and decided a real YYYY-MM-DD date (who decided the line and when; never
 *     printed) (E); any other field is never read (W).
 * V38 (caveat strings) covers emrTemplate like all module data; V60 does not apply (clinician
 * surface). Probe and routing references, and the logic strings the template prints, are checked
 * against the logic in checkV61Probes.
 */
function checkEmrTemplate(r, c) {
  const warnBrackets = (x, base) => walkStrings(x, base, (s, p) => {
    if (SQUARE_BRACKETS.test(s)) c.W("V61", p, "square brackets read as a placeholder in the EMR template; use parentheses");
  });
  warnBrackets(r.domains, "/domains");
  warnBrackets(r.redFlags, "/redFlags");
  warnBrackets(r.contextItems, "/contextItems");
  warnBrackets(r.phenotypes, "/phenotypes");
  warnBrackets(r.infoPrompts, "/infoPrompts");
  if (isObj(r.copy)) {
    warnBrackets(r.copy.indexName, "/copy/indexName");
    warnBrackets(r.copy.note, "/copy/note");
    for (const s of ["screener", "scribe"]) if (isObj(r.copy[s])) warnBrackets(r.copy[s].title, ptr("copy", s, "title"));
    if (isObj(r.copy.screener)) warnBrackets(r.copy.screener.bandSuffix, "/copy/screener/bandSuffix");
  }
  if (isObj(r.fhir)) warnBrackets(r.fhir.documentTitle, "/fhir/documentTitle");
  if (isObj(r.demo)) warnBrackets(r.demo.patient, "/demo/patient");

  const t = r.emrTemplate;
  if (t === undefined) return;
  if (!isObj(t)) { c.E("V61", "/emrTemplate", "emrTemplate must be an object"); return; }
  for (const k of Object.keys(t)) if (!EMR_KEYS.includes(k)) c.W("V61", ptr("emrTemplate", k), `unknown emrTemplate key "${k}" (it is never read)`);
  walkStrings(t, "/emrTemplate", (s, p) => {
    if (EMR_BRACKETS.test(s)) c.E("V61", p, "emrTemplate strings may not contain [ ] { }: square brackets are the template's placeholders");
  });

  const citeKeys = new Set();
  if (t.citations !== undefined) {
    if (!isObj(t.citations)) c.E("V61", "/emrTemplate/citations", "citations must be an object of citation records");
    else for (const k of Object.keys(t.citations)) {
      const p = ptr("emrTemplate", "citations", k);
      const v = t.citations[k];
      if (!EMR_CITE_KEY_RE.test(k)) c.E("V61", p, "a citation key matches /^[A-Z0-9][A-Za-z0-9-]*$/");
      if (!isObj(v)) { c.E("V61", p, "a citation is {title, publisher, citation, url, accessed}"); continue; }
      citeKeys.add(k);
      for (const f of ["title", "publisher", "citation"]) if (!nonEmpty(v[f])) c.E("V61", `${p}/${f}`, `${f} is required`);
      if (typeof v.url !== "string" || !EMR_HTTPS_URL.test(v.url)) c.E("V61", `${p}/url`, "url must be an https URL");
      if (typeof v.accessed !== "string" || !EMR_DATE.test(v.accessed)) c.E("V61", `${p}/accessed`, "accessed must be a YYYY-MM-DD date");
      for (const f of Object.keys(v)) if (!EMR_CITATION_FIELDS.includes(f)) c.W("V61", `${p}/${esc(f)}`, `unknown citation field "${f}"`);
    }
  }
  const used = new Set();
  const keysOk = (keys, p, required) => {
    if (keys === undefined && !required) return;
    if (!Array.isArray(keys) || (required && !keys.length)) { c.E("V61", p, "citations must be a non-empty list of citation keys"); return; }
    keys.forEach((k, i) => {
      if (typeof k !== "string" || !citeKeys.has(k)) c.E("V61", `${p}/${i}`, `${JSON.stringify(k)} is not a key of emrTemplate.citations`);
      else used.add(k);
    });
  };
  const label = (v, p, what) => { if (!nonEmpty(v)) c.E("V61", p, `${what} must be a non-empty string`); };
  /** W for every key of a row that engine/emr.js never reads (review round 4). */
  const knownFields = (row, kind, p) => {
    for (const k of Object.keys(row)) if (!EMR_ROW_FIELDS[kind].includes(k)) c.W("V61", `${p}/${esc(k)}`, `unknown ${kind} field "${k}" (it is never read)`);
  };
  const list = (v, p) => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) { c.E("V61", p, "must be a list"); return []; }
    return v;
  };
  const items = dict();
  arr(r.domains).forEach(d => arr(isObj(d) && d.items).forEach(it => { if (isObj(it)) items[it.id] = it; }));
  const flagIds = new Set(arr(r.redFlags).filter(isObj).map(f => f.id));
  const phenoValues = isObj(r.phenotypes) ? arr(r.phenotypes.values).filter(isObj).map(v => v.value) : [];
  const showForOk = (sf, p) => {
    if (sf === undefined) return;
    if (!isObj(sf) || !Array.isArray(sf.phenotypes) || !sf.phenotypes.length) { c.E("V61", p, "showFor is {phenotypes: [phenotype values]}"); return; }
    sf.phenotypes.forEach((v, i) => { if (!phenoValues.includes(v)) c.E("V61", `${p}/phenotypes/${i}`, `${JSON.stringify(v)} is not a phenotype value`); });
  };

  list(t.references, "/emrTemplate/references").forEach((row, i) => {
    const p = ptr("emrTemplate", "references", i);
    if (!isObj(row)) { c.E("V61", p, "a reference is {label | note, citations, showFor?}"); return; }
    knownFields(row, "reference", p);
    if ((row.label === undefined) === (row.note === undefined)) c.E("V61", p, "a reference has exactly one of label or note");
    else if (row.label !== undefined) label(row.label, p + "/label", "label");
    else label(row.note, p + "/note", "note");
    keysOk(row.citations, p + "/citations", true);
    showForOk(row.showFor, p + "/showFor");
  });
  if (t.instrumentRecs !== undefined) {
    const seenRecs = new Set();
    list(t.instrumentRecs, "/emrTemplate/instrumentRecs").forEach((id, i) => {
      const p = ptr("emrTemplate", "instrumentRecs", i);
      if (!nonEmpty(id)) c.E("V61", p, "an instrumentRecs entry is a routing rule id");
      else if (seenRecs.has(id)) c.E("V61", p, `duplicate routing rule id "${id}"`);
      seenRecs.add(id);
    });
  }
  if (t.redFlagRefs !== undefined) {
    if (!isObj(t.redFlagRefs)) c.E("V61", "/emrTemplate/redFlagRefs", "redFlagRefs must be an object of red-flag ids");
    else for (const id of Object.keys(t.redFlagRefs)) {
      const p = ptr("emrTemplate", "redFlagRefs", id);
      if (!flagIds.has(id)) c.E("V61", p, `"${id}" is not a red flag`);
      keysOk(t.redFlagRefs[id], p, true);
    }
  }
  if (t.redFlagPlaceholders !== undefined) {
    if (!isObj(t.redFlagPlaceholders)) c.E("V61", "/emrTemplate/redFlagPlaceholders", "redFlagPlaceholders must be an object of red-flag ids");
    else for (const id of Object.keys(t.redFlagPlaceholders)) {
      const p = ptr("emrTemplate", "redFlagPlaceholders", id);
      if (!flagIds.has(id)) c.E("V61", p, `"${id}" is not a red flag`);
      else label(t.redFlagPlaceholders[id], p, "a red-flag placeholder");
    }
  }
  list(t.history, "/emrTemplate/history").forEach((row, i) => {
    const p = ptr("emrTemplate", "history", i);
    if (!isObj(row)) { c.E("V61", p, "a history row is {item, qualifier?} or {label, probe?}"); return; }
    knownFields(row, "history", p);
    if ((row.item === undefined) === (row.label === undefined)) c.E("V61", p, "a history row has exactly one of item or label");
    else if (row.item !== undefined && !(typeof row.item === "string" && ownGet(items, row.item))) c.E("V61", p + "/item", `${JSON.stringify(row.item)} is not an item`);
    else if (row.label !== undefined) label(row.label, p + "/label", "label");
    if (row.probe !== undefined && (row.item !== undefined || !nonEmpty(row.probe))) c.E("V61", p + "/probe", "probe is a probe id, on a label row only");
    if (row.qualifier !== undefined) {
      if (row.item === undefined) c.E("V61", p + "/qualifier", "qualifier follows an item's negative answer; on an item row only");
      else label(row.qualifier, p + "/qualifier", "qualifier");
    }
    if (row.citations !== undefined) c.E("V61", p + "/citations", "history rows carry no citations (the template never prints them); cite on a checklist or exam row");
  });
  const checklistIds = new Set();
  list(t.checklist, "/emrTemplate/checklist").forEach((row, i) => {
    const p = ptr("emrTemplate", "checklist", i);
    if (!isObj(row)) { c.E("V61", p, "a checklist row is {id, group, label, citations, signals?}"); return; }
    knownFields(row, "checklist", p);
    if (typeof row.id !== "string" || !ID_RE.test(row.id)) c.E("V61", p + "/id", "id must match /^[a-z][a-z0-9_]*$/");
    else if (checklistIds.has(row.id)) c.E("V61", p + "/id", `duplicate checklist id "${row.id}"`);
    checklistIds.add(row.id);
    label(row.group, p + "/group", "group");
    label(row.label, p + "/label", "label");
    if (row.placeholder !== undefined) label(row.placeholder, p + "/placeholder", "placeholder");
    if (row.box !== undefined && typeof row.box !== "boolean") c.E("V61", p + "/box", "box is true or false (false: a status line without a box)");
    if (row.onlyWithSignal !== undefined && typeof row.onlyWithSignal !== "boolean") c.E("V61", p + "/onlyWithSignal", "onlyWithSignal is true or false (true: the row prints only when a signal holds)");
    else if (row.onlyWithSignal === true && !(Array.isArray(row.signals) && row.signals.length)) c.W("V61", p + "/onlyWithSignal", "an onlyWithSignal row without signals is never printed");
    keysOk(row.citations, p + "/citations", true);
    list(row.signals, p + "/signals").forEach((s, j) => {
      const sp = `${p}/signals/${j}`;
      if (!isObj(s)) { c.E("V61", sp, "a signal is {item, value, render} or {probe, option, render}"); return; }
      if (!EMR_RENDERS.includes(s.render)) c.E("V61", sp + "/render", `render must be one of ${EMR_RENDERS.join(", ")}`);
      if (s.qualifier !== undefined) label(s.qualifier, sp + "/qualifier", "qualifier");
      if ((s.item === undefined) === (s.probe === undefined)) { c.E("V61", sp, "a signal names exactly one of item or probe"); return; }
      knownFields(s, s.item !== undefined ? "item signal" : "probe signal", sp);
      if (s.item !== undefined) {
        const it = typeof s.item === "string" ? ownGet(items, s.item) : undefined;
        if (!it) { c.E("V61", sp + "/item", `${JSON.stringify(s.item)} is not an item`); return; }
        const ok = Array.isArray(it.scale) ? Number.isInteger(s.value) && s.value >= 0 && s.value < it.scale.length : s.value === "yes" || s.value === "no";
        if (!ok) { c.E("V61", sp + "/value", `${JSON.stringify(s.value)} is not a valid answer of "${s.item}"`); return; }
        // The render must match the answer's polarity: done and note print the item's positive
        // wording; answeredNo is for a negative answer; never tried comes from a probe only.
        const opt = Array.isArray(it.scale) ? it.scale[s.value] : null;
        const neg = s.value === "no" || (isObj(opt) && opt.f === 0);
        if (s.render === "neverTried") c.E("V61", sp + "/render", "neverTried comes from a probe answer only, never from an item");
        else if ((s.render === "done" || s.render === "note") && neg) c.E("V61", sp + "/render", `render "${s.render}" prints the item's positive wording; ${JSON.stringify(s.value)} is a negative answer of "${s.item}" (use answeredNo)`);
        else if (s.render === "answeredNo" && !neg) c.E("V61", sp + "/render", `render "answeredNo" needs a negative answer; ${JSON.stringify(s.value)} is a positive answer of "${s.item}"`);
      } else {
        if (!nonEmpty(s.probe)) c.E("V61", sp + "/probe", "probe must be a probe id");
        if (!Number.isInteger(s.option) || s.option < 0) c.E("V61", sp + "/option", "option must be a probe option index");
      }
    });
  });
  list(t.examRows, "/emrTemplate/examRows").forEach((row, i) => {
    const p = ptr("emrTemplate", "examRows", i);
    if (!isObj(row)) { c.E("V61", p, "an exam row is {label, citations?, probe?, optionPlaceholders?}"); return; }
    knownFields(row, "exam row", p);
    label(row.label, p + "/label", "label");
    keysOk(row.citations, p + "/citations", false);
    if (row.probe !== undefined && !nonEmpty(row.probe)) c.E("V61", p + "/probe", "probe must be a probe id");
    // Release 0.4.6: a placeholder under the row for a recorded option of its probe.
    if (row.optionPlaceholders !== undefined) {
      if (row.probe === undefined) c.E("V61", p + "/optionPlaceholders", "optionPlaceholders key placeholders to the options of the row's probe; on a row with a probe only");
      const seenOpts = new Set();
      list(row.optionPlaceholders, p + "/optionPlaceholders").forEach((h, j) => {
        const hp = `${p}/optionPlaceholders/${j}`;
        if (!isObj(h)) { c.E("V61", hp, "an option placeholder is {option, placeholder}"); return; }
        knownFields(h, "option placeholder", hp);
        if (!Number.isInteger(h.option) || h.option < 0) c.E("V61", hp + "/option", "option must be a probe option index");
        else if (seenOpts.has(h.option)) c.E("V61", hp + "/option", `option ${h.option} already has a placeholder on this row`);
        else seenOpts.add(h.option);
        label(h.placeholder, hp + "/placeholder", "placeholder");
      });
    }
  });
  // Release 0.4.6: the past-history rows (a placeholder heading, or an item with its recorded state).
  const historyRowItems = new Set(arr(t.history).filter((row) => isObj(row) && typeof row.item === "string").map((row) => row.item));
  const pastItems = new Set();
  list(t.pastHistory, "/emrTemplate/pastHistory").forEach((row, i) => {
    const p = ptr("emrTemplate", "pastHistory", i);
    if (!isObj(row)) { c.E("V61", p, "a past-history row is {item, group} or {label, group}"); return; }
    knownFields(row, "past history", p);
    if (!EMR_PAST_GROUPS.includes(row.group)) c.E("V61", p + "/group", `group must be one of ${EMR_PAST_GROUPS.join(", ")}`);
    if ((row.item === undefined) === (row.label === undefined)) c.E("V61", p, "a past-history row has exactly one of item or label");
    else if (row.label !== undefined) label(row.label, p + "/label", "label");
    else if (!(typeof row.item === "string" && ownGet(items, row.item))) c.E("V61", p + "/item", `${JSON.stringify(row.item)} is not an item`);
    else if (historyRowItems.has(row.item) || pastItems.has(row.item)) c.E("V61", p + "/item", `"${row.item}" is already a history or past-history row (it would print twice)`);
    else pastItems.add(row.item);
  });
  // Release 0.4.8: the plan-advice lines (printed beside the empiric-treatment references, with no red
  // flag open), each with its record.
  list(t.planAdvice, "/emrTemplate/planAdvice").forEach((row, i) => {
    const p = ptr("emrTemplate", "planAdvice", i);
    if (!isObj(row)) { c.E("V61", p, "a plan-advice line is {text, source, decided}"); return; }
    knownFields(row, "plan advice", p);
    label(row.text, p + "/text", "text");
    if (!nonEmpty(row.source)) c.E("V61", p + "/source", "source must name who decided the line");
    if (!emrRealDate(row.decided)) c.E("V61", p + "/decided", "decided must be the YYYY-MM-DD date the line was decided");
  });
  for (const k of citeKeys) if (!used.has(k)) c.W("V61", ptr("emrTemplate", "citations", k), `citation "${k}" is never used`);
}

/**
 * V61, logic half. The logic strings the template prints carry no square bracket (W): probe say,
 * option labels and notes, and the routing copy (h, p, chips; strings only, a computed one is not
 * read). With emrTemplate: the probes it names exist in the module's probe list, with that option;
 * an exam row names an exam-kind probe (a probe of any other kind would print under the exam
 * heading as a recorded examination); every instrumentRecs id is a routing rule whose chips, on
 * every surface it has copy for, are a fixed list of strings (E: computed chips are cut from the
 * answers, never instruments, and would otherwise print under "Instruments:").
 */
function checkV61Probes(module, c) {
  const probes = module.logic && isObj(module.logic.probes) ? arr(module.logic.probes.list) : [];
  const warnBrackets = (x, base) => walkStrings(x, base, (s, p) => {
    if (SQUARE_BRACKETS.test(s)) c.W("V61", p, "square brackets read as a placeholder in the EMR template; use parentheses");
  });
  probes.forEach((p, i) => {
    if (!isObj(p)) return;
    const base = ptr("logic", "probes", "list", i);
    warnBrackets(p.say, base + "/say");
    arr(p.opts).forEach((o, j) => { if (isObj(o)) { warnBrackets(o.l, `${base}/opts/${j}/l`); warnBrackets(o.note, `${base}/opts/${j}/note`); } });
  });
  const routing = module.logic ? arr(module.logic.routing) : [];
  routing.forEach((rule, i) => {
    if (!isObj(rule) || !isObj(rule.copy)) return;
    for (const surface of Object.keys(rule.copy)) {
      const cp = rule.copy[surface];
      if (!isObj(cp)) continue;
      for (const f of ["h", "p", "chips"]) warnBrackets(cp[f], ptr("logic", "routing", i, "copy", surface, f));
    }
  });
  const t = module.rubric && module.rubric.emrTemplate;
  if (!isObj(t)) return;
  const byId = dict();
  for (const p of probes) if (isObj(p) && typeof p.id === "string") byId[p.id] = p;
  arr(t.checklist).forEach((row, i) => arr(isObj(row) && row.signals).forEach((s, j) => {
    if (!isObj(s) || s.probe === undefined) return;
    const sp = ptr("emrTemplate", "checklist", i, "signals", j);
    const pr = typeof s.probe === "string" ? ownGet(byId, s.probe) : undefined;
    if (!pr) c.E("V61", sp + "/probe", `${JSON.stringify(s.probe)} is not a probe of this module's logic`);
    else if (Number.isInteger(s.option) && !(s.option < arr(pr.opts).length)) c.E("V61", sp + "/option", `probe "${s.probe}" has no option ${s.option}`);
  }));
  arr(t.examRows).forEach((row, i) => {
    if (!isObj(row) || row.probe === undefined) return;
    const pr = typeof row.probe === "string" ? ownGet(byId, row.probe) : undefined;
    if (!pr) c.E("V61", ptr("emrTemplate", "examRows", i, "probe"), `${JSON.stringify(row.probe)} is not a probe of this module's logic`);
    else if (pr.kind !== EMR_EXAM_KIND) c.E("V61", ptr("emrTemplate", "examRows", i, "probe"), `probe "${row.probe}" is a ${JSON.stringify(pr.kind)} probe; an exam row names an exam probe`);
    // Release 0.4.6: each option placeholder names an option the probe has.
    if (pr) arr(row.optionPlaceholders).forEach((h, j) => {
      if (isObj(h) && Number.isInteger(h.option) && h.option >= 0 && !(h.option < arr(pr.opts).length)) c.E("V61", ptr("emrTemplate", "examRows", i, "optionPlaceholders", j, "option"), `probe "${row.probe}" has no option ${h.option}`);
    });
  });
  arr(t.history).forEach((row, i) => {
    if (!isObj(row) || row.probe === undefined || row.item !== undefined) return;
    if (!(typeof row.probe === "string" && ownGet(byId, row.probe))) c.E("V61", ptr("emrTemplate", "history", i, "probe"), `${JSON.stringify(row.probe)} is not a probe of this module's logic`);
  });
  const ruleById = dict();
  for (const x of routing) if (isObj(x) && typeof x.id === "string") ruleById[x.id] = x;
  arr(t.instrumentRecs).forEach((id, i) => {
    if (!nonEmpty(id)) return;
    const rule = ownGet(ruleById, id);
    if (!rule) { c.E("V61", ptr("emrTemplate", "instrumentRecs", i), `"${id}" is not a routing rule of this module's logic`); return; }
    const copy = isObj(rule.copy) ? rule.copy : {};
    const bad = Object.keys(copy).filter((surface) => {
      const chips = isObj(copy[surface]) ? copy[surface].chips : undefined;
      return chips !== undefined && !(Array.isArray(chips) && chips.every((ch) => typeof ch === "string"));
    });
    if (bad.length) c.E("V61", ptr("emrTemplate", "instrumentRecs", i), `routing rule "${id}" computes its chips (or they are not a list of strings) on ${bad.join(", ")}; only fixed instrument chips may be listed`);
  });
}

function checkGateRehearsal(r, c) {
  // V51 (W): the sample rail rehearses every gate.
  const samples = arr(r.sampleCases).filter(isObj);
  if (!samples.length || !Array.isArray(r.domains)) return;
  const shim = { domains: r.domains.filter(isObj).map(d => ({ ...d, items: arr(d.items).filter(isObj) })), bands: r.bands };
  if (!isObj(shim.bands) || !isObj(shim.bands.cuts)) return;
  const negItems = shim.domains.filter(d => d.negative === true).flatMap(d => d.items);
  const neg = negItems.map(it => it.id);
  // A positive answer: anything but absent, "no" and a negative scale option (f === 0, wherever
  // it sits — V13 does not pin it to option 0; a value with no option keeps the `!== 0` reading).
  const answeredPositive = (it, v) => {
    if (v === undefined || v === "no") return false;
    const o = Array.isArray(it.scale) && typeof v === "number" ? it.scale[v] : undefined;
    return isObj(o) && typeof o.f === "number" ? o.f !== 0 : v !== 0;
  };
  let flag = false, unscorable = false, negPos = false;
  for (const s of samples) {
    if (isObj(s.rf) && Object.keys(s.rf).length) flag = true;
    try { if (!computeScore(shim, isObj(s.a) ? s.a : {}).scorable) unscorable = true; } catch (_) { /* malformed: other codes report it */ }
    if (isObj(s.a) && negItems.some(it => answeredPositive(it, s.a[it.id]))) negPos = true;
  }
  if (!flag) c.W("V51", "/sampleCases", "no sample case carries a red flag, so the override gate is never rehearsed");
  if (!unscorable) c.W("V51", "/sampleCases", "no sample case is unscorable, so the incomplete-screen gate is never rehearsed");
  if (neg.length && !negPos) c.W("V51", "/sampleCases", "no sample case answers a rule-out item positively");
}

/** The rubric-only checks (V1-V4, V6, V7, V9-V39, V49-V51, the rubric half of V61). */
function rubricChecks(r, c, opts) {
  checkV1Rubric(r, c);
  if (!isObj(r)) return { merged: {}, identity: null };
  checkV2(r, c);
  checkV3(r, c);
  checkV4(r, c);
  checkV6Rubric(r, c, opts);
  const identity = renderIdentity(r);
  checkV7(r, c, identity);
  checkV9(r, c);
  checkInstrument(r, c);
  idNamespace(r, c);
  checkContext(r, c);
  checkPatientContext(r, c);
  checkFlags(r, c);
  checkPatientFlags(r, c);
  checkSteps(r, c);
  checkPhenotypes(r, c);
  checkLexicon(r, c, opts);
  const merged = mergeLocales(r);
  checkLocales(r, c, merged);
  checkIdentityAndResearch(r, c, identity, opts);
  checkCaveats(r, "", c);
  checkCopy(r, c);
  checkSamples(r, c);
  checkGateRehearsal(r, c);
  checkEmrTemplate(r, c);
  return { merged, identity };
}

function report(c, info = {}) {
  return { ok: c.errors.length === 0, errors: c.errors, warnings: c.warnings, info };
}

/**
 * The rubric-only checks, synchronously (the editor's live feedback, §4.14). V5, V8 and the
 * logic, provenance and upload checks need validateModule.
 * @param {Object} rubric
 * @param {{origin?:string, classification?:Object}} [opts]  origin enables the built-in rules of V6/V30 and the V37 population gate
 * @returns {{ok:boolean, errors:Array, warnings:Array, info:Object}}
 */
export function validateRubricShape(rubric, opts = {}) {
  const c = makeCollector();
  try {
    const { merged } = rubricChecks(rubric, c, opts || {});
    return report(c, { fallbacks: Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, v.fallbacks])) });
  } catch (err) {
    c.E("V0", "", `validator failure: ${messageOf(err)}`);
    return report(c, {});
  }
}

// ------------------------------------------------------------------- module-level checks

function checkV1Logic(module, c) {
  const logic = module.logic;
  if (logic === GENERIC_LOGIC) return;
  if (logic.format !== FORMAT.logic) c.E("V1", "/logic/format", `the logic's format must be "${FORMAT.logic}"`);
  if (logic.contractVersion !== CONTRACT_VERSION) c.E("V1", "/logic/contractVersion", `the logic's contractVersion must be ${CONTRACT_VERSION}`);
}

function checkV5(module, c) {
  for (const issue of arr(module.bindIssues)) c.E(issue.code, issue.path, issue.msg);
  const lb = module.rubric.logicBinding;
  if (module.logic === GENERIC_LOGIC) return;
  if (!isObj(lb)) return;
  if (module.logic.moduleId !== lb.moduleId) c.E("V5", "/logicBinding/moduleId", `the rubric binds logic '${lb.moduleId}' but the logic file is '${module.logic.moduleId}'`);
  if (lb.logicSha256 !== undefined) {
    if (typeof lb.logicSha256 !== "string" || !HEX64.test(lb.logicSha256)) c.E("V5", "/logicBinding/logicSha256", "logicSha256 must be 64 hex digits");
    else if (module.hashes.logicSha256 && lb.logicSha256 !== module.hashes.logicSha256) {
      c.W("V5", "/logicBinding/logicSha256", `this rubric was created against logic ${lb.logicSha256.slice(0, 8)}, binding to ${module.hashes.logicSha256.slice(0, 8)}`);
    }
  }
}

function checkV6Logic(module, c) {
  const pr = module.logic && module.logic.probes;
  if (!isObj(pr)) return;
  if (typeof pr.version !== "string" || !VERSION_RE.test(pr.version)) c.E("V6", "/logic/probes/version", "probes.version must match /^\\d+(\\.\\d+)*(-[a-z0-9.-]+)?$/");
  else if (module.origin === "builtin" && LOCAL_TAG.test(pr.version)) c.E("V6", "/logic/probes/version", 'a built-in probe-set version may not carry the "-local" tag');
}

const sameLabel = (a, b) => typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
// A built-in's label may not be reused even disguised (invisible characters, spacing, look-alikes).
const builtinLabel = (a, b) => sameLabel(a, b) || (kinKey(a) !== "" && kinKey(a) === kinKey(b));

function checkV8(module, loaded, c) {
  const others = arr(loaded).filter(m => m && m !== module && m.key !== module.key);
  const builtin = module.origin === "builtin";
  for (const m of others) {
    if (m.id === module.id) {
      c.E("V8", "/id", m.origin === "builtin" ? `Module id '${module.id}' is reserved for the built-in module` : `Module id '${module.id}' is already loaded`);
    }
    if (m.origin === "builtin" && !builtin && typeof module.id === "string" && module.id.startsWith(`${m.id}-`)) {
      c.E("V8", "/id", `a module id may not start with "${m.id}-", the prefix of a built-in module`);
    }
    if (m.origin === "builtin" && m.logic !== GENERIC_LOGIC && module.logic !== GENERIC_LOGIC && !builtin
      && module.logic.moduleId === m.logic.moduleId && module.logic !== m.logic && module.hashes.logicSha256 !== m.hashes.logicSha256) {
      c.E("V8", "/logicBinding/moduleId", `Logic id '${module.logic.moduleId}' is reserved for the built-in logic`);
    }
    if (!builtin && m.origin === "builtin" && builtinLabel(module.label, m.label)) c.E("V8", "/label", `Label '${module.label}' belongs to a built-in module`);
    else if (sameLabel(module.label, m.label)) c.W("V8", "/label", `another loaded module is also labelled '${m.label}'`);
  }
}

function checkV56(module, loaded, c) {
  if (module.origin === "builtin") return;
  const mine = IDENTITY_TEMPLATE_FIELDS.map(f => [f, getPath(module, f)]);
  for (const m of arr(loaded)) {
    if (!m || m === module || m.key === module.key) continue;
    const theirs = new Set(IDENTITY_TEMPLATE_FIELDS.map(f => getPath(m, f)).filter(v => typeof v === "string"));
    for (const [f, v] of mine) {
      if (typeof v === "string" && theirs.has(v)) c.E("V56", "/" + f.split(".").map(esc).join("/"), `the identifier "${v}" belongs to the loaded module ${m.label}`);
    }
  }
}

// ---- V40: functions only at LOGIC_PATHS -------------------------------------------------

const GLOBS = LOGIC_PATHS.map(g => {
  const toks = [];
  for (const part of g.split(".")) {
    if (part.endsWith("[]")) { toks.push(part.slice(0, -2)); toks.push("[]"); }
    else toks.push(part);
  }
  return toks;
});

function globMatch(glob, path, gi = 0, pi = 0) {
  if (gi === glob.length) return pi === path.length;
  const g = glob[gi];
  if (g === "**") {
    for (let k = pi + 1; k <= path.length; k++) if (globMatch(glob, path, gi + 1, k)) return true;
    return false;
  }
  if (pi >= path.length) return false;
  const seg = path[pi];
  if (g === "[]") return typeof seg === "number" && globMatch(glob, path, gi + 1, pi + 1);
  if (g === "*") return typeof seg === "string" && globMatch(glob, path, gi + 1, pi + 1);
  return seg === g && globMatch(glob, path, gi + 1, pi + 1);
}

const atLogicPath = (segs) => GLOBS.some(g => globMatch(g, segs));

function checkV40(logic, c) {
  const stack = new Set();
  const walk = (x, segs) => {
    const p = "/logic" + ptr(...segs);
    if (typeof x === "function") {
      if (!atLogicPath(segs)) c.E("V40", p, "functions are allowed only at the closure paths of the contract (LOGIC_PATHS); everything else is plain data");
      return;
    }
    if (typeof x === "symbol" || typeof x === "bigint") { c.E("V40", p, `a ${typeof x} is not plain data`); return; }
    if (typeof x === "number" && !Number.isFinite(x)) { c.E("V40", p, `${x} is not plain data`); return; }
    if (x === null || typeof x !== "object") return;
    if (stack.has(x)) { c.E("V40", p, "the logic data contains a cycle"); return; }
    const proto = Object.getPrototypeOf(x);
    if (!Array.isArray(x) && proto !== Object.prototype && proto !== null) { c.E("V40", p, "only plain objects and arrays are data"); return; }
    stack.add(x);
    if (Array.isArray(x)) x.forEach((v, i) => walk(v, [...segs, i]));
    else for (const k of Object.keys(x)) walk(x[k], [...segs, k]);
    stack.delete(x);
  };
  walk(logic, []);
}

// ---- V41-V45: the logic's declarations against the rubric --------------------------------

function contextValues(module, id) {
  const out = new Set();
  const ci = module.contextItems.find(x => isObj(x) && x.id === id);
  if (ci) for (const o of arr(ci.options)) if (Array.isArray(o)) out.add(o[0]);
  for (const loc of Object.keys(module.locales)) {
    const e = module.locales[loc].data && isObj(module.locales[loc].data.contextItems) ? module.locales[loc].data.contextItems[id] : null;
    if (isObj(e)) for (const o of arr(e.opts)) if (Array.isArray(o)) out.add(o[0]);
  }
  return ci ? out : null;
}

function phenotypeValues(module) {
  return module.phenotypes ? arr(module.phenotypes.values).filter(isObj).map(v => v.value) : [];
}

function checkV41(module, c) {
  const logic = module.logic;
  const reads = logic.reads;
  if (!isObj(reads) || !isObj(reads.items)) { c.E("V41", "/logic/reads", "the logic must declare what it reads: reads.items (and domains, redFlags, phenotypes, context, gapMarkers as used)"); return; }
  for (const id of Object.keys(reads.items)) {
    const decl = reads.items[id], it = module.itemById[id], p = ptr("logic", "reads", "items", id);
    if (!it) { c.E("V41", p, `the logic reads item "${id}", which the rubric does not have`); continue; }
    const isScale = Array.isArray(it.scale);
    if (decl === "boolean") { if (isScale) c.E("V41", p, `"${id}" is declared boolean but is a scale item`); }
    else if (isObj(decl) && Number.isInteger(decl.scale)) {
      if (!isScale) c.E("V41", p, `"${id}" is declared a ${decl.scale}-option scale but is a boolean item`);
      else if (it.scale.length !== decl.scale) c.E("V41", p, `"${id}" is declared with ${decl.scale} options but has ${it.scale.length}`);
    } else c.E("V41", p, 'an item read is declared "boolean" or {scale: n}');
  }
  if (reads.domains !== undefined) {
    if (!isObj(reads.domains)) c.E("V41", "/logic/reads/domains", "reads.domains maps domain keys to {negative?}");
    else for (const k of Object.keys(reads.domains)) {
      const d = module.domains.find(x => isObj(x) && x.key === k), decl = reads.domains[k], p = ptr("logic", "reads", "domains", k);
      if (!d) c.E("V41", p, `the logic reads domain "${k}", which the rubric does not have`);
      else if (isObj(decl) && decl.negative !== undefined && !!decl.negative !== !!d.negative) c.E("V41", p, `domain "${k}" is declared ${decl.negative ? "negative" : "positive"} but is not`);
    }
  }
  const flagIds = module.redFlags.filter(isObj).map(f => f.id);
  if (reads.redFlags !== undefined) {
    if (!Array.isArray(reads.redFlags)) c.E("V41", "/logic/reads/redFlags", "reads.redFlags is a list of flag ids");
    else reads.redFlags.forEach((id, i) => { if (!flagIds.includes(id)) c.E("V41", `/logic/reads/redFlags/${i}`, `"${id}" is not a red flag`); });
  }
  const values = phenotypeValues(module);
  if (reads.phenotypes !== undefined) {
    if (!Array.isArray(reads.phenotypes)) c.E("V41", "/logic/reads/phenotypes", "reads.phenotypes is a list of phenotype values");
    else reads.phenotypes.forEach((v, i) => { if (!values.includes(v)) c.E("V41", `/logic/reads/phenotypes/${i}`, `"${v}" is not a phenotype value`); });
  }
  if (reads.context !== undefined) {
    if (!isObj(reads.context)) c.E("V41", "/logic/reads/context", "reads.context maps context ids to the values read");
    else for (const id of Object.keys(reads.context)) {
      const vals = contextValues(module, id), p = ptr("logic", "reads", "context", id);
      if (!vals) { c.E("V41", p, `"${id}" is not a context item`); continue; }
      arr(reads.context[id]).forEach((v, i) => { if (!vals.has(v)) c.E("V41", `${p}/${i}`, `"${v}" is not a value of "${id}"`); });
    }
  }
  const markers = module.gapRule ? module.gapRule.markers : undefined;
  if (reads.gapMarkers !== undefined || (markers !== undefined && logic.patientSummary && !isGenericSummary(logic.patientSummary))) {
    if (canonicalJson(reads.gapMarkers ?? null) !== canonicalJson(markers ?? null)) {
      c.E("V41", "/logic/reads/gapMarkers", "reads.gapMarkers must equal gapRule.markers (the positional order sum.gap expects)");
    }
  }
  const ph = logic.phenotypes;
  if (ph !== undefined && ph !== null) {
    if (!isObj(ph)) c.E("V41", "/logic/phenotypes", "logic.phenotypes is {derive?, activation?}");
    else {
      if ((ph.derive || ph.activation) && !module.phenotypes) c.E("V41", "/logic/phenotypes", "phenotype rules need rubric phenotypes");
      arr(ph.derive).forEach((d, i) => {
        if (!isObj(d) || !values.includes(d.value)) c.E("V41", `/logic/phenotypes/derive/${i}/value`, `"${isObj(d) ? d.value : d}" is not a phenotype value`);
        if (isObj(d) && typeof d.when !== "function") c.E("V41", `/logic/phenotypes/derive/${i}/when`, "a derive rule needs a when function");
      });
      const ids = new Set();
      arr(ph.activation).forEach((a, i) => {
        const p = `/logic/phenotypes/activation/${i}`;
        if (!isObj(a)) { c.E("V41", p, "an activation rule is {id, domains, when}"); return; }
        if (!nonEmpty(a.id) || ids.has(a.id)) c.E("V41", p + "/id", "activation ids are unique and non-empty");
        ids.add(a.id);
        if (typeof a.when !== "function") c.E("V41", p + "/when", "an activation rule needs a when function");
        if (!Array.isArray(a.domains)) c.E("V41", p + "/domains", "domains must be a list");
        arr(a.domains).forEach((k, j) => { if (!module.domainOrder.includes(k)) c.E("V41", `${p}/domains/${j}`, `"${k}" is not a domain`); });
      });
    }
  }
}

function checkV42(logic, c) {
  const routing = logic.routing;
  if (routing === undefined || routing === null) return;
  if (!Array.isArray(routing)) { c.E("V42", "/logic/routing", "routing must be a list of rules"); return; }
  const ids = new Set();
  const fallbacks = { screener: 0, scribe: 0 };
  routing.forEach((rule, i) => {
    const p = `/logic/routing/${i}`;
    if (!isObj(rule)) { c.E("V42", p, "a routing rule is {id, when, copy}"); return; }
    if (!nonEmpty(rule.id)) c.E("V42", p + "/id", "a routing rule needs an id");
    else if (ids.has(rule.id)) c.E("V42", p + "/id", `duplicate routing id "${rule.id}"`);
    ids.add(rule.id);
    if (rule.fallback !== undefined && rule.fallback !== true) c.E("V42", p + "/fallback", "fallback is true or absent");
    if (typeof rule.when !== "function" && !(rule.fallback === true && rule.when === undefined)) c.E("V42", p + "/when", "when must be a function (only a fallback rule may omit it)");
    if (!isObj(rule.copy)) { c.E("V42", p + "/copy", "copy {screener?, scribe?} is required"); return; }
    const surfaces = Object.keys(rule.copy);
    if (!surfaces.length) c.E("V42", p + "/copy", "copy needs at least one surface");
    for (const s of surfaces) {
      const cp = `${p}/copy/${esc(s)}`;
      if (!["screener", "scribe"].includes(s)) { c.E("V42", cp, 'surfaces are "screener" and "scribe"'); continue; }
      const cc = rule.copy[s];
      if (!isObj(cc)) { c.E("V42", cp, "a surface's copy is {h, p, chips}"); continue; }
      for (const k of ["h", "p"]) if (!(typeof cc[k] === "string" || typeof cc[k] === "function")) c.E("V42", `${cp}/${k}`, `${k} must be a string or a function`);
      if (!(typeof cc.chips === "function" || (Array.isArray(cc.chips) && cc.chips.every(x => typeof x === "string")))) c.E("V42", `${cp}/chips`, "chips must be a list of strings or a function");
      if (rule.fallback === true) {
        fallbacks[s]++;
        if (fallbacks[s] > 1) c.E("V42", p + "/fallback", `more than one fallback rule on the ${s}`);
      }
    }
  });
}

function checkV43(module, c) {
  const ps = module.logic.patientSummary;
  if (ps === undefined || ps === null || isGenericSummary(ps)) return;
  if (!isObj(ps)) { c.E("V43", "/logic/patientSummary", "patientSummary is {groups, derived, said, ask}"); return; }
  if (ps.groups !== undefined) {
    if (!isObj(ps.groups)) c.E("V43", "/logic/patientSummary/groups", "groups map a name to item ids");
    else for (const g of Object.keys(ps.groups)) {
      const ids = ps.groups[g];
      if (!Array.isArray(ids)) { c.E("V43", ptr("logic", "patientSummary", "groups", g), "a group is a list of item ids"); continue; }
      ids.forEach((id, i) => { if (!module.itemById[id]) c.E("V43", ptr("logic", "patientSummary", "groups", g, i), `"${id}" is not an item`); });
    }
  }
  if (ps.derived !== undefined) {
    if (!isObj(ps.derived)) c.E("V43", "/logic/patientSummary/derived", "derived maps a name to a function");
    else for (const k of Object.keys(ps.derived)) if (typeof ps.derived[k] !== "function") c.E("V43", ptr("logic", "patientSummary", "derived", k), "a derived value is a function");
  }
  for (const list of ["said", "ask"]) {
    const rules = ps[list];
    if (!Array.isArray(rules)) { c.E("V43", `/logic/patientSummary/${list}`, `${list} must be a list of rules`); continue; }
    const ids = new Set();
    rules.forEach((rule, i) => {
      const p = `/logic/patientSummary/${list}/${i}`;
      if (!isObj(rule)) { c.E("V43", p, "a summary rule is {id, when?, text}"); return; }
      if (!nonEmpty(rule.id) || ids.has(rule.id)) c.E("V43", p + "/id", "summary rule ids are unique and non-empty");
      ids.add(rule.id);
      if (typeof rule.text !== "function") c.E("V43", p + "/text", "text must be a function");
      if (rule.when !== undefined && typeof rule.when !== "function") c.E("V43", p + "/when", "when must be a function when present");
    });
    if (list === "ask" && rules.length && isObj(rules[rules.length - 1]) && rules[rules.length - 1].when !== undefined) {
      c.E("V43", `/logic/patientSummary/ask/${rules.length - 1}/when`, "the last ask rule has no when: the summary always ends with a question to bring");
    }
  }
}

function itemAnswerOk(it, v) {
  return Array.isArray(it.scale) ? Number.isInteger(v) && v >= 0 && v < it.scale.length : v === "yes" || v === "no";
}

function checkV45(module, c) {
  const pr = module.logic.probes;
  if (pr === undefined || pr === null) return;
  if (!isObj(pr)) { c.E("V45", "/logic/probes", "probes is {version, list}"); return; }
  if (!nonEmpty(pr.version)) c.E("V45", "/logic/probes/version", "probes.version (the probe-set axis) is required");
  if (!Array.isArray(pr.list)) { c.E("V45", "/logic/probes/list", "probes.list must be a list"); return; }
  const flagIds = new Set(module.redFlags.filter(isObj).map(f => f.id));
  const ids = new Set();
  let local = 0;
  const E = (p, msg) => { local++; c.E("V45", p, msg); };
  pr.list.forEach((p, i) => {
    const pp = `/logic/probes/list/${i}`;
    if (!isObj(p)) { E(pp, "a probe is {id, kind, when, say, why, opts}"); return; }
    if (!nonEmpty(p.id)) E(pp + "/id", "a probe needs an id");
    else if (ids.has(p.id)) E(pp + "/id", `duplicate probe id ${p.id}`);
    ids.add(p.id);
    const kind = ownGet(PROBE_KIND, p.kind);
    if (!kind) E(pp + "/kind", `${p.id}: unknown kind ${p.kind}`);
    if (typeof p.when !== "function") E(pp + "/when", `${p.id}: no trigger`);
    if (!nonEmpty(p.say) || !nonEmpty(p.why)) E(pp, `${p.id}: missing wording or rationale`);
    if (!Array.isArray(p.opts) || !p.opts.length) E(pp + "/opts", `${p.id}: no options`);
    if (p.target !== undefined && !module.itemById[p.target]) E(pp + "/target", `${p.id}: target ${p.target} not in instrument`);
    if (p.rescues !== undefined && !module.itemById[p.rescues]) E(pp + "/rescues", `${p.id}: rescues ${p.rescues} not in instrument`);
    if (p.kind === "rescue") {
      if (p.rescues === undefined) E(pp + "/rescues", `${p.id}: a rescue names the item it rescues`);
      if (p.target !== undefined) E(pp + "/target", `${p.id}: a rescue has no target (it must not retire when its item is answered negatively)`);
    } else if (p.rescues !== undefined) E(pp + "/rescues", `${p.id}: only a rescue probe carries rescues`);
    arr(p.opts).forEach((o, j) => {
      const op = `${pp}/opts/${j}`;
      if (!isObj(o) || !nonEmpty(o.l)) { E(op, `${p.id}: an option needs a label`); return; }
      if (o.rf !== undefined && !flagIds.has(o.rf)) E(op + "/rf", `${p.id}: raises unknown red flag ${o.rf}`);
      if (o.note !== undefined && typeof o.note !== "string") E(op + "/note", `${p.id}: a note is text`);
      if (o.a !== undefined) {
        if (!isObj(o.a)) { E(op + "/a", `${p.id}: a is a map of item answers`); return; }
        for (const k of Object.keys(o.a)) {
          const it = module.itemById[k];
          if (!it) E(`${op}/a/${esc(k)}`, `${p.id}: writes to unknown item ${k}`);
          else if (!itemAnswerOk(it, o.a[k])) E(`${op}/a/${esc(k)}`, `${p.id}: ${JSON.stringify(o.a[k])} is not a valid answer of ${k}`);
          if (kind && kind.mayWrite === false) E(`${op}/a/${esc(k)}`, `${p.id}: ${p.kind} probe writes to scored item ${k} — supporting features must not score`);
        }
      }
    });
  });
  // The probe engine's own check (WP5) as a backstop. A throw is reported, never swallowed:
  // a backstop that cannot run has not passed the list (gate, don't warn).
  if (!local) {
    let errs;
    try {
      errs = probeEngine.validateProbes(pr.list, module.allItems.map(it => it.id), [...flagIds]);
    } catch (err) {
      c.E("V45", "/logic/probes/list", `the probe engine's own check threw: ${messageOf(err)}`);
      return;
    }
    for (const msg of arr(errs)) c.E("V45", "/logic/probes/list", String(msg));
  }
}

// ---- V46-V48, V44, V60: smoke evaluation behind recording proxies -------------------------

const READONLY = () => { throw new TypeError("smoke states are read-only: a closure must not change its state"); };

function lockedProxy(target, onRead) {
  return new Proxy(target, {
    get(t, k, recv) { if (onRead && typeof k === "string") onRead(k); return Reflect.get(t, k, recv); },
    has(t, k) { if (onRead && typeof k === "string") onRead(k); return Reflect.has(t, k); },
    set: READONLY, defineProperty: READONLY, deleteProperty: READONLY, setPrototypeOf: READONLY,
  });
}

/** An immutable view of plain data: shadow copies, proxied bottom-up (§3.3). */
function immutable(x, cache = null) {
  if (x === null || typeof x !== "object") return x;
  if (cache && cache.has(x)) return cache.get(x);
  let shadow;
  if (Array.isArray(x)) shadow = x.map(v => immutable(v, cache));
  else {
    shadow = {};
    for (const k of Object.keys(x)) shadow[k] = immutable(x[k], cache);
  }
  const p = lockedProxy(shadow, null);
  if (cache) cache.set(x, p);
  return p;
}

class Recorder {
  // Reads are bucketed per running closure (one Set.add per read); `obs` inverts them once.
  constructor() {
    this.byClosure = new Map();
    this._current = null;
    this.cur = this.bucket("");
    this._obs = null;
  }
  bucket(id) {
    let b = this.byClosure.get(id);
    if (!b) this.byClosure.set(id, (b = { items: new Set(), domains: new Set(), redFlags: new Set(), context: new Set(), sum: new Set() }));
    return b;
  }
  set current(id) { this._current = id; this.cur = this.bucket(id || ""); this._obs = null; }
  get current() { return this._current; }
  note(kind, id) { this.cur[kind].add(id); }
  /** kind → Map(id → Set(closure ids)). */
  get obs() {
    if (this._obs) return this._obs;
    const out = { items: new Map(), domains: new Map(), redFlags: new Map(), context: new Map(), sum: new Map() };
    for (const [closure, b] of this.byClosure) {
      for (const kind of Object.keys(out)) {
        for (const id of b[kind]) {
          if (PROTO_KEYS.has(id)) continue;
          let s = out[kind].get(id);
          if (!s) out[kind].set(id, (s = new Set()));
          if (closure) s.add(closure);
        }
      }
    }
    return (this._obs = out);
  }
  toJSON() {
    const obs = this.obs;
    const out = {};
    for (const k of Object.keys(obs)) {
      out[k] = {};
      for (const [id, s] of [...obs[k].entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) out[k][id] = [...s].sort();
    }
    return out;
  }
}

function sameResult(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  try { return canonicalJson(a) === canonicalJson(b); } catch (_) { return false; }
}

const isBooleanish = (v) => v === null || ["boolean", "number", "string", "undefined"].includes(typeof v);

function randomAnswerSets(module, { patient = false } = {}) {
  const rng = mulberry32(SMOKE_SEED + (patient ? 1 : 0));
  const items = module.allItems;
  const strata = [0, 0.15, 0.3, 0.6];
  const sets = [];
  for (let n = 0; n < SMOKE_RANDOM_STATES; n++) {
    const pUn = strata[n % strata.length];
    const a = {};
    for (const it of items) {
      const r = rng();
      if (r < pUn) continue;
      if (patient && rng() < 0.1) { a[it.id] = "unsure"; continue; }
      if (Array.isArray(it.scale)) a[it.id] = Math.floor(rng() * it.scale.length);
      else a[it.id] = rng() < 0.5 ? "yes" : "no";
    }
    sets.push({ a, rng: rng() });
  }
  return sets;
}

function extremeAnswerSets(module) {
  const max = {}, zero = {};
  for (const it of module.allItems) {
    if (Array.isArray(it.scale)) {
      let best = 0;
      it.scale.forEach((o, i) => { if (isObj(o) && isObj(it.scale[best]) && o.f > it.scale[best].f) best = i; });
      max[it.id] = best;
      const z = negativeValueOf(it);
      zero[it.id] = z === null ? 0 : z;
    } else { max[it.id] = "yes"; zero[it.id] = "no"; }
  }
  return [{}, max, zero];
}

function clinicianCtx(module, rng) {
  const ctx = {};
  for (const ci of module.contextItems) {
    if (!isObj(ci) || !Array.isArray(ci.options) || !ci.options.length) continue;
    if (rng() < 0.2) continue;
    const o = ci.options[Math.floor(rng() * ci.options.length)];
    if (Array.isArray(o)) ctx[ci.id] = o[0];
  }
  return ctx;
}

function patientCtx(module, loc, rng) {
  const ctx = {};
  const data = module.locales[loc] && module.locales[loc].data;
  for (const ci of module.contextItems) {
    if (!isObj(ci)) continue;
    const e = data && isObj(data.contextItems) ? data.contextItems[ci.id] : null;
    const opts = isObj(e) && Array.isArray(e.opts) ? e.opts : arr(ci.options);
    if (!opts.length || rng() < 0.2) continue;
    const o = opts[Math.floor(rng() * opts.length)];
    if (Array.isArray(o)) ctx[ci.id] = o[0];
  }
  return ctx;
}

function joinList(xs, loc) {
  // The Patient list joiner (Pat L988-994), for the smoke states' s.L.
  const and = loc === "es" ? "y" : "and";
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} ${and} ${xs[1]}`;
  const tail = loc === "es" ? ` ${and} ` : `, ${and} `;
  return `${xs.slice(0, -1).join(", ")}${tail}${xs[xs.length - 1]}`;
}

function normalised(a) {
  const out = {};
  for (const k of Object.keys(a)) if (a[k] !== undefined && a[k] !== "unsure") out[k] = a[k];
  return out;
}

function omissionHit(s) {
  return typeof s === "string" && OMISSION_PATTERNS.some(re => re.test(s));
}

const V60_MSG = "patient-facing text may not name a score, likelihood or probability";

/**
 * V60, module-specific half: the clinician-facing phrases this module itself defines for its
 * index and bands, which OMISSION_PATTERNS cannot know. Matched case-insensitively as whole
 * phrases (no letter or digit directly before or after; runs of whitespace match any
 * whitespace). The phrases are, from the bound (rendered) copy:
 *   - copy.indexName (the default is "{name} index");
 *   - each full band label the Screener pill renders, "<band> likelihood <screener.bandSuffix>";
 *   - copy.screener.bandSuffix on its own (the module's interpretation of a band, the phrase
 *     after "<band> likelihood") and copy.note.likelihoodOf, when multi-word.
 * The bare band words (vocab BANDS: "low", "moderate", "high") are NOT matched on their own:
 * they are ordinary words in patient questions and options ("high-pitched", "a low hum"), so a
 * band is recognised only inside its full phrase. Likewise a single-word bandSuffix counts only
 * inside its full band label, and "index" alone is not flagged — only the module's indexName.
 * Returns (s) → the matched phrase, or null.
 */
function modulePhraseMatcher(module) {
  const copy = isObj(module.copy) ? module.copy : {};
  const scr = isObj(copy.screener) ? copy.screener : {};
  const note = isObj(copy.note) ? copy.note : {};
  const clean = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
  const words = (s) => s.split(" ").filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  const suffix = clean(scr.bandSuffix);
  const phrases = new Set();
  const add = (s, minWords) => { s = clean(s); if (s && words(s) >= minWords) phrases.add(s); };
  add(copy.indexName, 1);
  for (const b of BANDS) add(`${b} likelihood ${suffix}`, 2);
  add(suffix, 2);
  add(note.likelihoodOf, 2);
  const reEsc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const res = [...phrases].map(p => [p, new RegExp(
    "(?<![\\p{L}\\p{N}])" + p.split(" ").map(reEsc).join("\\s+") + "(?![\\p{L}\\p{N}])", "iu")]);
  return (s) => {
    if (typeof s !== "string") return null;
    for (const [p, re] of res) if (re.test(s)) return p;
    return null;
  };
}

/** A V60 reason reworded for a closure's output ("produces …"). */
function smokeV60(why) {
  return why === V60_MSG
    ? "patient text that names a score, likelihood or probability"
    : why.replace(/^patient-facing text may not name/, "patient text that names");
}

/** The V60 reason for one patient-facing string, or null: OMISSION_PATTERNS, then the module's own phrases. */
function v60Reason(s, phraseHit) {
  if (omissionHit(s)) return V60_MSG;
  const p = phraseHit ? phraseHit(s) : null;
  return p ? `patient-facing text may not name the module's index or band label ("${p}")` : null;
}

function runSmoke(module, c, rec) {
  const logic = module.logic;
  const reported = new Set();
  const once = (code, path, msg) => {
    const k = `${code}|${path}`;
    if (reported.has(k)) return;
    reported.add(k);
    c.E(code, path, msg);
  };
  let states = 0;
  const phraseHit = modulePhraseMatcher(module);

  /** Call a closure twice (V48), check its result type (V46). Returns {ok, value}. */
  const call = (closureId, path, fn, args, check) => {
    rec.current = closureId;
    let r1, r2;
    try { r1 = fn(...args); }
    catch (err) { rec.current = null; once("V46", path, `throws during smoke evaluation: ${messageOf(err)}`); return { ok: false }; }
    try { r2 = fn(...args); }
    catch (err) { rec.current = null; once("V48", path, `throws on a second call with the same state: ${messageOf(err)}`); return { ok: false }; }
    rec.current = null;
    if (!sameResult(r1, r2)) { once("V48", path, "returns a different result when called twice on the same state (closures must be pure)"); return { ok: false }; }
    if (check) {
      const bad = check(r1);
      if (bad) { once("V46", path, `returns ${bad}`); return { ok: false }; }
    }
    return { ok: true, value: r1 };
  };
  const whenCheck = (v) => (isBooleanish(v) ? null : `${Array.isArray(v) ? "a list" : `a ${typeof v}`} where a true/false value is expected`);
  const strCheck = (v) => (typeof v === "string" ? null : `${v === null ? "null" : typeof v} where text is expected`);
  const chipsCheck = (v) => (Array.isArray(v) && v.every(x => typeof x === "string") ? null : "something other than a list of strings for chips");

  const onItem = (k) => rec.note("items", k);
  const onCtx = (k) => rec.note("context", k);
  const onFlag = (k) => rec.note("redFlags", k);
  const onDomain = (k) => rec.note("domains", k);
  /** Proxies take ownership of a fresh object; pass a copy when the object is shared. */
  const answersProxy = (fresh) => lockedProxy(fresh, onItem);
  const recordingHelpers = (a) => ({
    yes: (id) => { onItem(id); return a[id] === "yes"; },
    no: (id) => { onItem(id); return a[id] === "no"; },
    isAnswered: (id) => { onItem(id); return a[id] !== undefined; },
    scale: (id) => { onItem(id); return typeof a[id] === "number" ? a[id] : null; },
  });
  const ctxProxy = (ctx) => lockedProxy({ ...ctx }, onCtx);
  const rfProxy = (rf) => lockedProxy({ ...rf }, onFlag);

  // Answer sets: empty, every sample case, all-max, all-zero, 256 seeded random states.
  const rng = mulberry32(SMOKE_SEED + 7);
  const base = [];
  const extremes = extremeAnswerSets(module);
  base.push({ a: extremes[0], ctx: {}, complaint: null, rf: {} });
  for (const s of module.sampleCases) {
    if (!isObj(s) || !isObj(s.a)) continue;
    base.push({ a: { ...s.a }, ctx: isObj(s.ctx) ? { ...s.ctx } : {}, complaint: typeof s.complaint === "string" ? s.complaint : null, rf: isObj(s.rf) ? { ...s.rf } : {} });
  }
  base.push({ a: extremes[1], ctx: clinicianCtx(module, rng), complaint: null, rf: {} });
  base.push({ a: extremes[2], ctx: clinicianCtx(module, rng), complaint: null, rf: {} });
  for (const { a } of randomAnswerSets(module)) base.push({ a, ctx: clinicianCtx(module, rng), complaint: null, rf: {} });

  const fixedStates = base.length - SMOKE_RANDOM_STATES;
  for (const st of base) {
    st.aN = normalised(st.a);
    st.aP = answersProxy({ ...st.aN });
    st.helpers = recordingHelpers(st.aN);
  }

  const values = phenotypeValues(module);
  const complaints = module.phenotypes ? ["", ...values] : [""];
  const flags = module.redFlags.filter(isObj);
  const itemsCache = new WeakMap();
  const itemsShadow = {};
  for (const d of module.domains) if (isObj(d)) itemsShadow[d.key] = immutable({ label: d.label, max: d.max, negative: !!d.negative, items: d.items }, itemsCache);
  const itemsProxy = lockedProxy(itemsShadow, onDomain);

  // ---- phenotype derive and activation
  const ph = isObj(logic.phenotypes) ? logic.phenotypes : null;
  const derive = ph ? arr(ph.derive) : [];
  const activation = ph ? arr(ph.activation) : [];
  const deriveCalls = derive.map((d, i) => (isObj(d) && typeof d.when === "function" ? [`derive:${d.value}`, `/logic/phenotypes/derive/${i}/when`, d.when] : null)).filter(Boolean);
  const activationCalls = activation.map((r, i) => (isObj(r) && typeof r.when === "function" ? [`activation:${r.id}`, `/logic/phenotypes/activation/${i}/when`, r.when] : null)).filter(Boolean);
  for (const st of base) {
    if (deriveCalls.length) {
      states++;
      const s = lockedProxy({ answers: st.aP, ...st.helpers }, null);
      for (const [id, path, fn] of deriveCalls) call(id, path, fn, [s], whenCheck);
    }
    if (activationCalls.length) {
      for (const complaint of complaints) {
        states++;
        const s = lockedProxy({ answers: st.aP, complaint, ...st.helpers }, null);
        for (const [id, path, fn] of activationCalls) call(id, path, fn, [s], whenCheck);
      }
    }
  }

  // ---- routing (only on states the engine would route: no flag, scorable, Scribe reviewed)
  const routing = arr(logic.routing);
  const routeCalls = { screener: [], scribe: [] };
  routing.forEach((rule, i) => {
    if (!isObj(rule) || !isObj(rule.copy)) return;
    const p = `/logic/routing/${i}`;
    for (const surface of ["screener", "scribe"]) {
      const cc = rule.copy[surface];
      if (!isObj(cc)) continue;
      const copy = [];
      for (const k of ["h", "p"]) if (typeof cc[k] === "function") copy.push([`routing:${rule.id}.copy.${surface}.${k}`, `${p}/copy/${surface}/${k}`, cc[k], strCheck]);
      if (typeof cc.chips === "function") copy.push([`routing:${rule.id}.copy.${surface}.chips`, `${p}/copy/${surface}/chips`, cc.chips, chipsCheck]);
      routeCalls[surface].push({ when: typeof rule.when === "function" ? [`routing:${rule.id}.when`, `${p}/when`, rule.when] : null, copy });
    }
  });
  if (routeCalls.screener.length || routeCalls.scribe.length) {
    for (const st of base) {
      let score;
      try { score = computeScore(module, st.aN); } catch (_) { break; }
      if (!score.scorable) continue;
      const domainsShadow = {};
      for (const k of Object.keys(score.domains)) domainsShadow[k] = immutable(score.domains[k]);
      const cs = st.complaint !== null ? [st.complaint] : complaints;
      for (const surface of ["screener", "scribe"]) {
        for (const complaint of cs) {
          states++;
          const s = lockedProxy({
            surface, answers: st.aP, ctx: ctxProxy(st.ctx), complaint, phenotypeError: null,
            band: score.band, total: score.total, floor: score.floor, ceiling: score.ceiling, coverage: score.coverage,
            scorable: score.scorable, answered: score.answered, count: score.count,
            domains: lockedProxy({ ...domainsShadow }, onDomain), items: itemsProxy,
            activeFlags: immutable([]), override: false, emergent: false, routingCleared: true,
            lowestBand: LOWEST_BAND, highestBand: HIGHEST_BAND, scaleMax: module.scaleMax,
            ...st.helpers,
          }, null);
          for (const rc of routeCalls[surface]) {
            let fires = true;
            if (rc.when) {
              const r = call(rc.when[0], rc.when[1], rc.when[2], [s], whenCheck);
              if (!r.ok) continue;
              fires = !!r.value;
            }
            if (!fires) continue;
            for (const [id, path, fn, check] of rc.copy) call(id, path, fn, [s], check);
          }
        }
      }
    }
  }

  // ---- probes: when(answers, redFlags), and the rescue property
  const probeCalls = [];
  if (isObj(logic.probes)) arr(logic.probes.list).forEach((p, i) => {
    if (!isObj(p) || typeof p.when !== "function") return;
    const rescued = p.kind === "rescue" && typeof p.rescues === "string" ? module.itemById[p.rescues] : null;
    const neg = rescued ? negativeValueOf(rescued) : null;
    probeCalls.push({ p, id: `probe:${p.id}.when`, path: `/logic/probes/list/${i}/when`, rescue: rescued && neg !== null ? { item: p.rescues, neg } : null });
  });
  if (probeCalls.length) {
    const rfSets = [{}];
    base.forEach((st, n) => {
      if (Object.keys(st.rf).length) rfSets.push(st.rf);
      if (flags.length && n % 16 === 0) {
        rfSets.push({ [flags[n % flags.length].id]: true });
        if (flags.length > 1) rfSets.push({ [flags[n % flags.length].id]: true, [flags[(n + 1) % flags.length].id]: true });
      }
    });
    base.forEach((st, n) => {
      const rfs = [{}, rfSets[n % rfSets.length], flags.length ? { [flags[n % flags.length].id]: true } : {}];
      for (const rf of rfs) {
        states++;
        const rfP = rfProxy(rf);
        for (const pc of probeCalls) {
          call(pc.id, pc.path, pc.p.when, [st.aP, rfP], whenCheck);
          if (!pc.rescue) continue;
          // The rescue property (V46): `when` with the rescued item unset must equal `when`
          // with it set to its negative answer, so a negative reading never retires it.
          const unset = { ...st.aN }; delete unset[pc.rescue.item];
          const negative = { ...st.aN, [pc.rescue.item]: pc.rescue.neg };
          let w1, w2;
          rec.current = pc.id;
          try { w1 = !!pc.p.when(answersProxy(unset), rfP); w2 = !!pc.p.when(answersProxy(negative), rfP); }
          catch (err) { rec.current = null; once("V46", pc.path, `throws during smoke evaluation: ${messageOf(err)}`); continue; }
          rec.current = null;
          if (w1 !== w2) {
            once("V46", pc.path, `rescue "${pc.p.id}" must stay live while ${pc.rescue.item} reads negative: its when gives ${w1} with ${pc.rescue.item} unanswered but ${w2} with ${pc.rescue.item} = ${JSON.stringify(pc.rescue.neg)}`);
          }
        }
      }
    });
  }

  // ---- patient summary: derived, said, ask, and the sum templates they call; V44; V60
  const ps = logic.patientSummary;
  const sumRead = new Set();
  if (isObj(ps) && !isGenericSummary(ps)) {
    const locs = Object.keys(module.locales);
    const sumProxies = {};
    const sumProxy = (obj, prefix) => {
      if (!isObj(obj)) return obj;
      const shadow = {};
      for (const k of Object.keys(obj)) shadow[k] = isObj(obj[k]) ? sumProxy(obj[k], `${prefix}${k}.`) : obj[k];
      return lockedProxy(shadow, k => { if (!PROTO_KEYS.has(k)) { sumRead.add(prefix + k); rec.note("sum", prefix + k); } });
    };
    for (const loc of locs) sumProxies[loc] = sumProxy(module.locales[loc].sum, "");
    const groups = isObj(ps.groups) ? ps.groups : {};
    const derivedFns = isObj(ps.derived) ? ps.derived : {};
    const patientSets = randomAnswerSets(module, { patient: true });
    const prng = mulberry32(SMOKE_SEED + 11);
    // Patient states: empty, every sample case, all-max, all-zero, then 256 random states with "unsure".
    const pBase = [...base.slice(0, fixedStates).map(st => ({ a: st.a })), ...patientSets.map(x => ({ a: x.a }))];
    const derivedCalls = Object.keys(derivedFns).filter(k => typeof derivedFns[k] === "function")
      .map(k => [k, `summary.derived:${k}`, ptr("logic", "patientSummary", "derived", k), derivedFns[k]]);
    const ruleCalls = [];
    for (const list of ["said", "ask"]) arr(ps[list]).forEach((rule, i) => {
      if (!isObj(rule) || typeof rule.text !== "function") return;
      const p = `/logic/patientSummary/${list}/${i}`;
      ruleCalls.push({
        when: typeof rule.when === "function" ? [`summary.${list}:${rule.id}.when`, `${p}/when`, rule.when] : null,
        text: [`summary.${list}:${rule.id}.text`, `${p}/text`, rule.text],
      });
    });
    for (const loc of locs) {
      const S = sumProxies[loc];
      if (S === undefined || S === null) continue;
      for (const st of pBase) {
        states++;
        const a = st.a;
        const ctx = patientCtx(module, loc, prng);
        const g = {};
        for (const name of Object.keys(groups)) g[name] = arr(groups[name]).filter(id => a[id] === "yes");
        const shadow = {
          a: answersProxy({ ...a }), ctx: ctxProxy(ctx), loc, S,
          yes: (id) => { onItem(id); return a[id] === "yes"; },
          scale: (id) => { onItem(id); return typeof a[id] === "number" ? a[id] : null; },
          unsure: (id) => { onItem(id); return a[id] === "unsure"; },
          L: (xs) => joinList(Array.from(xs), loc),
          groups: immutable(g),
        };
        let failed = false;
        for (const [name, id, path, fn] of derivedCalls) {
          const r = call(id, path, fn, [lockedProxy({ ...shadow }, null)], null);
          if (!r.ok) { failed = true; break; }
          shadow[name] = r.value;
        }
        if (failed) continue;
        const s = lockedProxy(shadow, null);
        for (const rc of ruleCalls) {
          let fires = true;
          if (rc.when) {
            const r = call(rc.when[0], rc.when[1], rc.when[2], [s], whenCheck);
            if (!r.ok) continue;
            fires = !!r.value;
          }
          if (!fires) continue;
          const r = call(rc.text[0], rc.text[1], rc.text[2], [s], strCheck);
          const why = r.ok ? v60Reason(r.value, phraseHit) : null;
          if (why) once("V60", rc.text[1], `produces ${smokeV60(why)}: "${r.value.slice(0, 80)}"`);
        }
      }
      // sum.gap is called by the engine with the marker booleans (gapRule.markers order).
      const markers = module.gapRule ? arr(module.gapRule.markers) : [];
      if (markers.length) {
        const gap = module.locales[loc].sum && module.locales[loc].sum.gap;
        const gp = `/logic/locales/${esc(loc)}/sum/gap`;
        if (typeof gap !== "function") once("V44", gp, `the module has a gap rule, so sum.gap must be a template function in "${loc}"`);
        else {
          sumRead.add("gap");
          const n = Math.min(markers.length, 8);
          for (let mask = 0; mask < (1 << n); mask++) {
            const bools = markers.map((_, k) => k < n && !!(mask & (1 << k)));
            const r = call("sum.gap", gp, gap, bools, strCheck);
            if (!r.ok) break;
            const why = v60Reason(r.value, phraseHit);
            if (why) { once("V60", gp, `produces ${smokeV60(why)}: "${r.value.slice(0, 80)}"`); break; }
          }
        }
      }
    }
    // V44: every key a summary text reads through s.S exists in every locale's sum.
    const logicLocales = isObj(logic.locales) ? logic.locales : {};
    for (const key of [...sumRead].sort()) {
      for (const loc of Object.keys(logicLocales)) {
        const sum = isObj(logicLocales[loc]) ? logicLocales[loc].sum : undefined;
        let v = sum;
        for (const k of key.split(".")) v = isObj(v) ? v[k] : undefined;
        if (v === undefined) once("V44", `/logic/locales/${esc(loc)}/sum/${key.split(".").map(esc).join("/")}`, `the summary reads S.${key}, which "${loc}" does not define`);
      }
    }
  }
  // sum.clinNote: the engine calls it with the instrument version for the patient summary's
  // clinician block (generic or not), so its output is patient-facing text too (V46, V48, V60).
  const clinLocales = isObj(logic.locales) ? logic.locales : {};
  for (const loc of Object.keys(clinLocales)) {
    const sum = isObj(clinLocales[loc]) ? clinLocales[loc].sum : undefined;
    const fn = isObj(sum) ? sum.clinNote : undefined;
    if (typeof fn !== "function") continue;
    const p = `/logic/locales/${esc(loc)}/sum/clinNote`;
    const r = call("sum.clinNote", p, fn, [module.instrumentVersion], strCheck);
    const why = r.ok ? v60Reason(r.value, phraseHit) : null;
    if (why) once("V60", p, `produces ${smokeV60(why)}: "${r.value.slice(0, 80)}"`);
  }
  return states;
}

function checkV47(module, c, rec) {
  const logic = module.logic;
  const reads = isObj(logic.reads) ? logic.reads : null;
  if (!reads || !isObj(reads.items)) return;
  const observed = rec.obs;
  const referenced = { items: new Map(), redFlags: new Map(), domains: new Map() };
  const ref = (kind, id, where) => { if (!referenced[kind].has(id)) referenced[kind].set(id, where); };
  const ps = logic.patientSummary;
  if (isObj(ps) && !isGenericSummary(ps) && isObj(ps.groups)) for (const g of Object.keys(ps.groups)) for (const id of arr(ps.groups[g])) ref("items", id, `patientSummary.groups.${g}`);
  if (isObj(logic.phenotypes)) for (const a of arr(logic.phenotypes.activation)) {
    if (isObj(a)) for (const k of arr(a.domains)) ref("domains", k, `activation ${a.id}`);
  }
  if (isObj(logic.probes)) for (const p of arr(logic.probes.list)) {
    if (!isObj(p)) continue;
    if (typeof p.target === "string") ref("items", p.target, `probe ${p.id} target`);
    if (typeof p.rescues === "string") ref("items", p.rescues, `probe ${p.id} rescues`);
    for (const o of arr(p.opts)) {
      if (!isObj(o)) continue;
      if (isObj(o.a)) for (const k of Object.keys(o.a)) ref("items", k, `probe ${p.id} option "${o.l}"`);
      if (typeof o.rf === "string") ref("redFlags", o.rf, `probe ${p.id} option "${o.l}"`);
    }
  }
  const declared = {
    items: new Set(Object.keys(reads.items)),
    domains: new Set(isObj(reads.domains) ? Object.keys(reads.domains) : []),
    redFlags: new Set(arr(reads.redFlags)),
    context: new Set(isObj(reads.context) ? Object.keys(reads.context) : []),
  };
  const where = { items: "/logic/reads/items", domains: "/logic/reads/domains", redFlags: "/logic/reads/redFlags", context: "/logic/reads/context" };
  for (const kind of ["items", "domains", "redFlags", "context"]) {
    const seen = new Map();
    for (const [id, closures] of observed[kind]) seen.set(id, [...closures].sort().join(", ") || "a closure");
    if (referenced[kind]) for (const [id, w] of referenced[kind]) if (!seen.has(id)) seen.set(id, w);
    for (const [id, by] of seen) {
      if (!declared[kind].has(id)) c.E("V47", `${where[kind]}/${esc(id)}`, `${by} reads ${kind === "items" ? "item" : kind === "domains" ? "domain" : kind === "redFlags" ? "red flag" : "context item"} "${id}", which logic.reads does not declare`);
    }
    for (const id of declared[kind]) {
      if (!seen.has(id)) c.W("V47", `${where[kind]}/${esc(id)}`, `"${id}" is declared in logic.reads but no closure or probe reads it`);
    }
  }
}

function checkV60Static(module, c) {
  // Every patient-facing module string: rubric locales (minus their review metadata), the
  // string values of every logic sum, and the rubric strings projectForPatient carries onto
  // patient surfaces — the module name (patient page header, export footers, the {name}
  // placeholder), each item's patientClin or, without one, its text (the "For my clinician"
  // block and the exports), and the label of each domain a patient domain step falls back to
  // when English has no title for that step (§3.5).
  // Each is checked against OMISSION_PATTERNS and the module's own index and band phrases
  // (modulePhraseMatcher).
  const r = module.rubric;
  const phraseHit = modulePhraseMatcher(module);
  const v60 = (s, p) => { const why = v60Reason(s, phraseHit); if (why) c.E("V60", p, why); };
  v60(r.name, "/name");
  arr(r.domains).forEach((d, i) => {
    if (!isObj(d)) return;
    arr(d.items).forEach((it, j) => {
      if (!isObj(it)) return;
      if (typeof it.patientClin === "string") v60(it.patientClin, ptr("domains", i, "items", j, "patientClin"));
      else v60(it.text, ptr("domains", i, "items", j, "text"));
    });
  });
  const steps = isObj(module.steps) ? arr(module.steps.patient) : [];
  const enLoc = isObj(module.locales) && isObj(module.locales.en) && isObj(module.locales.en.data) ? module.locales.en.data : null;
  const enSteps = enLoc && isObj(enLoc.steps) ? enLoc.steps : {};
  const fallbackKeys = new Set();
  for (const st of steps) {
    if (!isObj(st) || st.kind !== "domain") continue;
    const own = isObj(enSteps[st.key]) ? enSteps[st.key].title : undefined;
    if (typeof own === "string") continue;
    for (const k of arr(st.domainKeys)) fallbackKeys.add(k);
  }
  arr(r.domains).forEach((d, i) => {
    if (isObj(d) && fallbackKeys.has(d.key)) v60(d.label, ptr("domains", i, "label"));
  });
  if (isObj(r.locales)) {
    for (const loc of Object.keys(r.locales)) {
      const L = r.locales[loc];
      if (!isObj(L)) continue;
      for (const k of Object.keys(L)) {
        if (k === "reviewed" || k === "editedLocally" || k === "stale") continue;
        walkStrings(L[k], ptr("locales", loc, k), v60);
      }
    }
  }
  const ll = module.logic.locales;
  if (isObj(ll)) {
    for (const loc of Object.keys(ll)) {
      walkStrings(isObj(ll[loc]) ? ll[loc].sum : undefined, `/logic/locales/${esc(loc)}/sum`, v60);
    }
  }
}

// ---- V52-V55: derived modules ------------------------------------------------------------

function checkDerived(module, c, { loaded, root }) {
  const kind = module.classification && module.classification.kind;
  const rootModule = root || ((kind === "verified" || kind === "derived-from-upload") ? module.classification.root : null);
  const derived = module.origin === "derived" || !!root;
  const prov = module.provenance;
  if (derived) {
    // V52
    if (!isObj(prov)) c.E("V52", "/provenance", "a derived module records its provenance (root, derivedFrom, lineage, contentHash)");
    else {
      for (const pb of lineageProblems(prov)) c.E("V52", pb.path, pb.msg);
      if (typeof prov.contentHash === "string" && HEX64.test(prov.contentHash) && prov.contentHash !== module.hashes.contentHash) {
        c.E("V52", "/provenance/contentHash", "the rubric was changed after it was derived (contentHash does not match)");
      }
      if (typeof prov.createdAt !== "string" || !prov.createdAt) c.E("V52", "/provenance/createdAt", "createdAt is required");
    }
    const log = module.changelog;
    const last = log.length ? log[log.length - 1] : null;
    const lp = `/changelog/${Math.max(0, log.length - 1)}`;
    if (!isObj(last) || last.kind !== "derived") c.E("V52", lp, 'the last change-log entry of a derived module is of kind "derived"');
    else {
      if (!nonEmpty(last.note)) c.E("V52", lp + "/note", "the derivation needs a change note");
      if (!Array.isArray(last.paths)) c.E("V52", lp + "/paths", "the derivation lists the changed paths");
    }
  }
  // V53: every non-built-in with a root (recorded or given).
  if (module.origin !== "builtin" && ((isObj(prov) && isObj(prov.root)) || rootModule)) {
    const family = familyOf(module, loaded);
    if (rootModule && !family.some(rec => rec.moduleId === rootModule.id)) family.unshift({
      moduleId: rootModule.id, label: rootModule.label, instrumentVersion: rootModule.instrumentVersion,
      lexiconVersion: rootModule.versions ? rootModule.versions.lexicon : null,
      instrumentHash: rootModule.hashes.instrumentHash, lexiconHash: rootModule.hashes.lexiconHash,
    });
    for (const e of checkVersionFamily(module, family, { rootModule })) c.E("V53", e.path, e.msg);
  }
  if (!derived || !rootModule) return;
  // V54
  const rr = rootModule.research, mr = module.research;
  const cal = (x) => canonicalJson(x && x.calibration !== undefined ? x.calibration : null);
  const pop = (x) => canonicalJson(x && x.population !== undefined ? x.population : null);
  if (cal(mr) !== cal(rr)) c.E("V54", "/research/calibration", "a derived module keeps its root's calibration unchanged (the calibration gate decides whether it applies)");
  if (pop(mr) !== pop(rr)) c.E("V54", "/research/population", "a derived module keeps its root's population estimates unchanged");
  const settled = module.cds && module.cds.examples ? module.cds.examples.settled : undefined;
  if (module.hashes.scoringHash !== rootModule.hashes.scoringHash && settled !== undefined) {
    c.E("V54", "/cds/examples/settled", "the settled CDS example was written for the root's scoring; remove it when the scoring changes");
  }
  // V55
  const strip = (L) => {
    if (!isObj(L)) return null;
    const out = {};
    for (const k of Object.keys(L)) if (!["reviewed", "editedLocally", "stale"].includes(k)) out[k] = L[k];
    return canonicalJson(out);
  };
  const locs = isObj(module.rubric.locales) ? module.rubric.locales : {};
  const rootLocs = isObj(rootModule.rubric.locales) ? rootModule.rubric.locales : {};
  for (const loc of Object.keys(locs)) {
    const L = locs[loc];
    if (!isObj(L)) continue;
    if (strip(L) !== strip(rootLocs[loc])) {
      if (L.reviewed !== false) c.E("V55", ptr("locales", loc, "reviewed"), `the "${loc}" wording differs from the root's, so it is not reviewed (reviewed: false)`);
      if (L.editedLocally !== true) c.E("V55", ptr("locales", loc, "editedLocally"), `the "${loc}" wording differs from the root's, so it is marked editedLocally: true`);
    }
    if (Array.isArray(L.stale) && L.stale.length && L.reviewed !== false) c.E("V55", ptr("locales", loc, "reviewed"), `"${loc}" has stale translations, so it is not reviewed`);
  }
}

// ---- V57-V59: upload --------------------------------------------------------------------

const API_RE = /(?<![.\w$])(window|document|globalThis|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|navigator|eval|Function)(?![\w$])|\bimport\s*\.\s*meta\b/g;

/** Source text with comments and string/template literals blanked (a signal scanner, not a parser). */
function codeOnly(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i], nx = src[i + 1];
    if (ch === "/" && nx === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (ch === "/" && nx === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; out += " "; continue; }
    if (ch === "'" || ch === '"' || ch === "`") {
      const q = ch; i++;
      while (i < n && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      i++; out += '""'; continue;
    }
    out += ch; i++;
  }
  return out;
}

export function apiReferences(src) {
  const found = new Set();
  for (const m of codeOnly(String(src)).matchAll(API_RE)) found.add(m[1] || "import.meta");
  return [...found];
}

function checkUpload(module, upload, c) {
  const u = isObj(upload) ? upload : {};
  // V58
  for (const [which, limit] of [["rubric", LIMITS.rubricBytes], ["logic", LIMITS.logicBytes]]) {
    const f = u[which];
    if (!isObj(f)) continue;
    const size = f.bytes && typeof f.bytes.byteLength === "number" ? f.bytes.byteLength : f.byteLength;
    if (typeof size === "number" && size > limit) c.E("V58", `/upload/${which}`, `Too large (${size} > ${limit})`);
    if (f.bytes && typeof TextDecoder !== "undefined") {
      try { new TextDecoder("utf-8", { fatal: true }).decode(f.bytes); }
      catch (_) { c.E("V58", `/upload/${which}`, "Not valid UTF-8"); }
    }
  }
  // V57
  const insp = isObj(u.inspect) ? u.inspect : null;
  if (insp && arr(insp.importSites).length) {
    c.E("V57", "/upload/logic", `imports other files (${arr(insp.importSites).join(", ")}): logic files must be self-contained`);
  }
  if (typeof u.importError === "string" && /\bimport/i.test(u.importError)) c.E("V57", "/upload/logic", u.importError);
  // V59
  let apis = insp && Array.isArray(insp.apiRefs) ? insp.apiRefs : null;
  if (!apis) {
    const text = isObj(u.logic) && typeof u.logic.text === "string" ? u.logic.text
      : (module && module.origin !== "builtin" && module.logic !== GENERIC_LOGIC ? module.sources.logicText : null);
    if (typeof text === "string") apis = apiReferences(text);
  }
  if (apis && apis.length) c.W("V59", "/upload/logic", `the logic references page or network APIs: ${apis.join(", ")} (shown in the consent box; this is a signal, not a sandbox)`);
}

/**
 * Validate a bound module (§4.14). Never throws.
 * @param {{module: Object, loaded?: Object[], root?: (Object|null), upload?: (Object|null)}} args
 *   loaded  BoundModule[] already loaded (F4); the module itself may be among them
 *   root    the loaded root module of a derivation (V52-V55 compare against it)
 *   upload  {rubric?:{bytes?, byteLength?}, logic?:{bytes?, byteLength?, text?}, inspect?: inspectSource result, importError?}
 * @returns {Promise<{ok:boolean, errors:Array<{path,code,msg}>, warnings:Array<{path,code,msg}>,
 *                    info:{hashes:Object, readsObserved:Object, fallbacks:Object, smokeStates:number, elapsedMs:number}}>}
 */
export async function validateModule({ module, loaded = [], root = null, upload = null } = {}) {
  const c = makeCollector();
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const info = { hashes: null, readsObserved: {}, fallbacks: {}, smokeStates: 0, elapsedMs: 0 };
  try {
    if (!module || !isObj(module.rubric)) {
      c.E("V1", "", "no bound module to validate");
      return report(c, info);
    }
    info.hashes = module.hashes;
    const origin = module.origin;
    const { merged } = rubricChecks(module.rubric, c, { origin, classification: module.classification });
    info.fallbacks = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, v.fallbacks]));
    const others = arr(loaded).filter(Boolean);
    checkV1Logic(module, c);
    checkV5(module, c);
    checkV6Logic(module, c);
    checkV61Probes(module, c);
    checkClarifyProbes(module, c);
    checkV8(module, others, c);
    checkV56(module, others, c);
    if (module.logic !== GENERIC_LOGIC) {
      checkV40(module.logic, c);
      checkCaveats(module.logic, "/logic", c);
      checkV41(module, c);
      checkV42(module.logic, c);
      checkV43(module, c);
      checkV45(module, c);
      checkV60Static(module, c);
      const rec = new Recorder();
      info.smokeStates = runSmoke(module, c, rec);
      checkV47(module, c, rec);
      info.readsObserved = rec.toJSON();
    } else {
      checkV60Static(module, c);
    }
    checkDerived(module, c, { loaded: others, root });
    if (upload || module.origin !== "builtin") checkUpload(module, upload, c);
  } catch (err) {
    c.E("V0", "", `validator failure: ${messageOf(err)}`);
  }
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  info.elapsedMs = Math.round((t1 - t0) * 10) / 10;
  return report(c, info);
}

/**
 * A report as path-addressed lines, errors first.
 * @returns {Array<{severity:"E"|"W", code:string, path:string, msg:string, line:string}>}
 */
export function formatReport(rep) {
  const out = [];
  for (const [sev, list] of [["E", rep && rep.errors], ["W", rep && rep.warnings]]) {
    for (const e of arr(list)) out.push({ severity: sev, code: e.code, path: e.path, msg: e.msg, line: `${e.code} · ${e.path || "/"} · ${e.msg}` });
  }
  return out;
}
