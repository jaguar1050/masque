// engine/lineage.js — lineage records, classification on load, the family version rule and
// provenance wording (design 03 §3.11, §4.16). Owner: WP3.
//
// Integrity, not authentication: every check compares hashes against modules this browser
// has actually loaded. Nothing in a file's `provenance` block is trusted until it verifies,
// and `origin` is never read from a file. Pure; no side effects.
import { KIN_FIELDS } from "./contract.js";
import { CAVEATS } from "./policy.js";
import { canonicalJson, rubricHashes, sha256Hex } from "./hash.js";

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const HEX64 = /^[0-9a-f]{64}$/;
const LOCAL_TAG = /-local(?:[.-]|$)/;

/** A loaded module from a Module or a RegistryEntry-like {module}. */
function asModule(x) {
  if (x && x.module && x.module.hashes) return x.module;
  return x && x.hashes ? x : null;
}
const modulesOf = (xs) => arr(xs).map(asModule).filter(Boolean);

function getPath(obj, path) {
  let v = obj;
  for (const k of String(path).split(".")) {
    if (v === null || typeof v !== "object") return undefined;
    v = v[k];
  }
  return v;
}

/** The AncestorRecord of a bound module (§3.2). */
export function ancestorRecord(module) {
  const h = module.hashes || {};
  return {
    moduleId: module.id,
    label: module.label,
    origin: module.origin,
    instrumentVersion: module.instrumentVersion,
    lexiconVersion: module.lexicon && typeof module.lexicon.version === "string" ? module.lexicon.version : null,
    rubricSha256: h.rubricSha256 ?? null,
    logicSha256: h.logicSha256 ?? null,
    instrumentHash: h.instrumentHash ?? null,
    scoringHash: h.scoringHash ?? null,
    lexiconHash: h.lexiconHash ?? null,
  };
}

const RECORD_KEYS = ["moduleId", "label", "origin", "instrumentVersion", "lexiconVersion", "rubricSha256",
  "logicSha256", "instrumentHash", "scoringHash", "lexiconHash"];

/** Problems with one recorded AncestorRecord, as messages (empty = complete). */
export function recordProblems(rec) {
  if (!isObj(rec)) return ["is not an object"];
  const out = [];
  for (const k of ["moduleId", "label", "instrumentVersion"]) if (typeof rec[k] !== "string" || !rec[k]) out.push(`${k} missing`);
  if (!["builtin", "uploaded", "derived"].includes(rec.origin)) out.push("origin must be builtin, uploaded or derived");
  if (!(rec.lexiconVersion === null || typeof rec.lexiconVersion === "string")) out.push("lexiconVersion must be a string or null");
  for (const k of ["rubricSha256", "instrumentHash", "scoringHash"]) if (typeof rec[k] !== "string" || !HEX64.test(rec[k])) out.push(`${k} must be 64 hex digits`);
  for (const k of ["logicSha256", "lexiconHash"]) if (!(rec[k] === null || (typeof rec[k] === "string" && HEX64.test(rec[k])))) out.push(`${k} must be 64 hex digits or null`);
  return out;
}

const sameRecord = (a, b) => isObj(a) && isObj(b) && RECORD_KEYS.every(k => (a[k] ?? null) === (b[k] ?? null));

/**
 * Lineage well-formedness (V52 structure): root, derivedFrom and lineage complete, root equal
 * to lineage[0], derivedFrom equal to the last entry. Returns [{path, msg}] (paths are JSON
 * pointers into the rubric).
 */
export function lineageProblems(provenance) {
  const out = [];
  if (!isObj(provenance)) return [{ path: "/provenance", msg: "provenance is missing" }];
  for (const p of recordProblems(provenance.root)) out.push({ path: "/provenance/root", msg: `root record: ${p}` });
  for (const p of recordProblems(provenance.derivedFrom)) out.push({ path: "/provenance/derivedFrom", msg: `derivedFrom record: ${p}` });
  const lin = provenance.lineage;
  if (!Array.isArray(lin) || !lin.length) {
    out.push({ path: "/provenance/lineage", msg: "lineage must list every ancestor, root first" });
  } else {
    lin.forEach((rec, i) => { for (const p of recordProblems(rec)) out.push({ path: `/provenance/lineage/${i}`, msg: `lineage record: ${p}` }); });
    if (!sameRecord(lin[0], provenance.root)) out.push({ path: "/provenance/root", msg: "root must equal lineage[0]" });
    if (!sameRecord(lin[lin.length - 1], provenance.derivedFrom)) out.push({ path: "/provenance/derivedFrom", msg: "derivedFrom must equal the last lineage entry" });
  }
  if (typeof provenance.contentHash !== "string" || !HEX64.test(provenance.contentHash)) {
    out.push({ path: "/provenance/contentHash", msg: "contentHash must be 64 hex digits" });
  }
  return out;
}

// Latin look-alikes from the Cyrillic and Greek blocks (lowercase; kinKey lowercases first).
const CONFUSABLE = {
  // Cyrillic
  "\u0430": "a", "\u0432": "b", "\u0435": "e", "\u043a": "k", "\u043c": "m", "\u043d": "h", "\u043e": "o",
  "\u0440": "p", "\u0441": "c", "\u0442": "t", "\u0443": "y", "\u0445": "x", "\u0455": "s", "\u0456": "i",
  "\u0458": "j", "\u04bb": "h", "\u0501": "d", "\u051b": "q", "\u051d": "w",
  // Greek
  "\u03b1": "a", "\u03b2": "b", "\u03b5": "e", "\u03b6": "z", "\u03b7": "h", "\u03b9": "i", "\u03ba": "k",
  "\u03bc": "m", "\u03bd": "n", "\u03bf": "o", "\u03c1": "p", "\u03c4": "t", "\u03c5": "y", "\u03c7": "x",
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLE).join("")}]`, "gu");

/**
 * The comparison key for identity text (kin fields, built-in labels): NFKC, diacritics and
 * invisible characters dropped, case folded, Cyrillic/Greek look-alikes mapped to Latin, and
 * every character that is not a letter or digit removed — so a name followed by U+200B, with
 * U+00A0 for its spaces, in fullwidth letters or with a trailing "_" compares equal to the name.
 * Returns "" for a non-string. Display text is never altered; this is for comparison only.
 */
export function kinKey(s) {
  if (typeof s !== "string") return "";
  return s.normalize("NFKC").normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(CONFUSABLE_RE, (c) => CONFUSABLE[c])
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Whether `rubric` is kin to a loaded built-in (§3.11 row 5): its id or bound logic moduleId
 * is the built-in's, or it reuses one of the built-in's KIN_FIELDS values. Values are compared
 * by kinKey, so invisible characters, spacing, punctuation, case and look-alike letters do not
 * hide a reused value.
 * @returns {{builtin: Object, reasons: string[]} | null}
 */
export function kinOf(rubric, builtins) {
  if (!isObj(rubric)) return null;
  for (const b of modulesOf(builtins)) {
    const reasons = [];
    if (typeof rubric.id === "string" && rubric.id === b.id) reasons.push("id");
    const lb = rubric.logicBinding;
    if (isObj(lb) && typeof lb.moduleId === "string" && b.logic && lb.moduleId === b.logic.moduleId && b.hashes.logicSha256) reasons.push("logic");
    for (const f of KIN_FIELDS) {
      const k = kinKey(getPath(rubric, f));
      if (k && k === kinKey(getPath(b.rubric, f))) reasons.push(f);
    }
    if (reasons.length) return { builtin: b, reasons };
  }
  return null;
}

function rootIdOf(module) {
  const p = module.provenance;
  if (isObj(p) && isObj(p.root) && typeof p.root.moduleId === "string") return p.root.moduleId;
  return module.origin === "builtin" ? module.id : null;
}

/**
 * The family of a module (§3.11): its root record, every record in its lineage, every loaded
 * module with the same root, and the root module itself when it is loaded. Deduplicated by
 * (moduleId, rubricSha256); the module itself is not included.
 * @returns {Array<Object>} AncestorRecord[]
 */
export function familyOf(module, loaded) {
  const rootId = rootIdOf(module);
  if (!rootId) return [];
  const out = [];
  const seen = new Set();
  const add = (rec) => {
    if (!isObj(rec)) return;
    const key = `${rec.moduleId}\u0000${rec.rubricSha256}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(rec);
  };
  const self = `${module.id}\u0000${module.hashes && module.hashes.rubricSha256}`;
  seen.add(self);
  const p = module.provenance;
  if (isObj(p)) {
    add(p.root);
    for (const rec of arr(p.lineage)) add(rec);
  }
  for (const m of modulesOf(loaded)) {
    if (m === module) continue;
    if (m.id === rootId && m.origin === "builtin") add(ancestorRecord(m));
    else if (rootIdOf(m) === rootId && m.origin !== "builtin") add(ancestorRecord(m));
  }
  return out;
}

function vOf(rec, kind) {
  return kind === "instrument" ? (rec.instrumentVersion ?? null) : (rec.lexiconVersion ?? null);
}
function hOf(rec, kind) {
  return kind === "instrument" ? (rec.instrumentHash ?? null) : (rec.lexiconHash ?? null);
}

/**
 * The family version rule (V53, §3.11) for one module against its family (familyOf):
 *  1. within the family, equal version ⇔ equal hash (instrument; and lexicon, "no lexicon"
 *     counting as one value);
 *  2. a hash that differs from the root's needs a version carrying the "-local" tag.
 * `rootModule` (optional, the loaded root) adds 3. lexicon.goldSet equal to the root's.
 * @returns {Array<{path:string, code:"V53", msg:string}>}
 */
export function checkVersionFamily(module, family, { rootModule = null } = {}) {
  const out = [];
  const me = ancestorRecord(module);
  const recs = arr(family).filter(isObj);
  const root = (isObj(module.provenance) && isObj(module.provenance.root)) ? module.provenance.root
    : (rootModule ? ancestorRecord(rootModule) : (recs[0] || null));
  const kinds = [
    ["instrument", "/instrumentVersion", "instrument version"],
    ["lexicon", "/lexicon/version", "lexicon version"],
  ];
  for (const [kind, path, what] of kinds) {
    const v = vOf(me, kind), h = hOf(me, kind);
    for (const rec of recs) {
      const rv = vOf(rec, kind), rh = hOf(rec, kind);
      if (v === rv && h !== rh) {
        out.push({ path, code: "V53", msg: `${what} "${v ?? "none"}" is already used in this family by ${rec.label || rec.moduleId} for different content; equal versions must mean equal content` });
        break;
      }
      if (h === rh && v !== rv) {
        out.push({ path, code: "V53", msg: `content identical to ${rec.label || rec.moduleId} must carry its ${what} "${rv ?? "none"}", not "${v ?? "none"}"` });
        break;
      }
    }
    if (root && h !== hOf(root, kind) && !(typeof v === "string" && LOCAL_TAG.test(v))) {
      out.push({ path, code: "V53", msg: `the ${what} differs from the root's (${root.label || root.moduleId}), so it must carry the "-local" tag (e.g. "${vOf(root, kind) ?? "0.1"}-local.${String(h || "").slice(0, 6)}")` });
    }
  }
  if (rootModule) {
    const g = (m) => (m.lexicon && m.lexicon.goldSet !== undefined ? m.lexicon.goldSet : null);
    if (canonicalJson(g(module)) !== canonicalJson(g(rootModule))) {
      out.push({ path: "/lexicon/goldSet", code: "V53", msg: "lexicon.goldSet must equal the root's (the gold set was not re-run for this lexicon)" });
    }
  }
  return out;
}

const builtinsFrom = (builtins, loaded) => {
  const out = [];
  const seen = new Set();
  for (const m of [...modulesOf(builtins), ...modulesOf(loaded).filter(m => m.origin === "builtin")]) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
};

async function contentSha(rubric) {
  return sha256Hex(canonicalJson(rubric));
}

function bindingMatches(rubric, b) {
  const lb = rubric.logicBinding;
  if (!b.hashes.logicSha256 || !b.logic || b.logic.moduleId === "*generic") return lb === "generic";
  return isObj(lb) && lb.moduleId === b.logic.moduleId && lb.logicSha256 === b.hashes.logicSha256;
}

/**
 * Classify a non-built-in rubric on load (§3.11 table; the first matching row wins). Never
 * reads `origin` from the file. `contentHash` is the recomputed content hash of the rubric
 * (computed here when null); `logicSha256` the SHA-256 of the logic file that came with it
 * (null when none); `rubricSha256` (optional) the SHA-256 of the rubric bytes.
 * `sameUpload`: other modules of the same upload (Modules, or {rubric, rubricSha256}).
 * @returns {Promise<{kind:("duplicate"|"verified"|"derived-from-upload"|"rederive"|"uploaded"),
 *                    root:(Object|null), origin:("builtin"|"uploaded"|"derived"), row:number, reasons:string[]}>}
 */
export async function classifyLineage(rubric, { builtins = [], loaded = [], sameUpload = [], logicSha256 = null, contentHash = null, rubricSha256 = null } = {}) {
  const r = isObj(rubric) ? rubric : {};
  const all = modulesOf(loaded);
  const bins = builtinsFrom(builtins, loaded);
  const candidates = [...new Set([...bins, ...all])];
  const content = contentHash || (await rubricHashes(r)).contentHash;
  const fullSha = await contentSha(r);
  const logicSha = logicSha256 ?? null;

  // Row 1: byte-identical to a loaded module (rubric and logic).
  const lb = r.logicBinding;
  for (const m of candidates) {
    const sameRubric = (rubricSha256 && rubricSha256 === m.hashes.rubricSha256) || fullSha === (await contentSha(m.rubric));
    if (!sameRubric) continue;
    // The logic this rubric would run: the file that came with it, else its pin, else (an
    // unpinned binding) the loaded logic with that moduleId.
    let cand;
    if (lb === "generic") cand = null;
    else if (logicSha) cand = logicSha;
    else if (isObj(lb) && typeof lb.logicSha256 === "string") cand = lb.logicSha256;
    else if (isObj(lb) && m.logic && lb.moduleId === m.logic.moduleId) cand = m.hashes.logicSha256 ?? null;
    else cand = undefined;
    if (cand === (m.hashes.logicSha256 ?? null)) {
      return { kind: "duplicate", root: m, origin: m.origin, row: 1, reasons: [`already loaded: ${m.label}`] };
    }
  }

  // Row 2: a built-in id with other bytes.
  const sameId = bins.find(b => typeof r.id === "string" && r.id === b.id);
  if (sameId) {
    return { kind: "rederive", root: sameId, origin: "uploaded", row: 2, reasons: [`Module id '${r.id}' is reserved for the built-in module`] };
  }

  const prov = isObj(r.provenance) ? r.provenance : null;
  const claimedRoot = prov && isObj(prov.root) && typeof prov.root.moduleId === "string" ? prov.root.moduleId : null;

  // Rows 3 and 4: the claimed root is a loaded built-in.
  const rootB = claimedRoot ? bins.find(b => b.id === claimedRoot) : null;
  if (rootB) {
    const failed = [];
    const cur = ancestorRecord(rootB);
    for (const k of ["moduleId", "instrumentVersion", "lexiconVersion", "instrumentHash", "scoringHash", "lexiconHash", "logicSha256"]) {
      if ((prov.root[k] ?? null) !== (cur[k] ?? null)) failed.push(`root record ${k}`);
    }
    const reasons = [];
    if (!failed.length && prov.root.rubricSha256 !== cur.rubricSha256) reasons.push("the built-in's rubric bytes changed since this module was derived (scoring, instrument and lexicon unchanged)");
    if (!bindingMatches(r, rootB)) failed.push("logic binding");
    if (logicSha && logicSha !== rootB.hashes.logicSha256) failed.push("logic file");
    if (prov.contentHash !== content) failed.push("contentHash");
    if (lineageProblems(prov).length) failed.push("lineage");
    if (!failed.length) return { kind: "verified", root: rootB, origin: "derived", row: 3, reasons };
    return {
      kind: "rederive", root: rootB, origin: "uploaded", row: 4,
      reasons: [`This file was changed after it was created in screenAIr (${failed.join(", ")} does not match)`],
    };
  }

  // Row 5: kin to a loaded built-in.
  const kin = kinOf(r, bins);
  if (kin) {
    return {
      kind: "rederive", root: kin.builtin, origin: "uploaded", row: 5,
      reasons: [`Shares ${kin.reasons.join(", ")} with the built-in module ${kin.builtin.label}`],
    };
  }

  // Row 6: the claimed root is a non-built-in that is loaded or in the same upload.
  if (claimedRoot) {
    const pool = [...all.filter(m => m.origin !== "builtin"), ...arr(sameUpload).map(x => asModule(x) || x)];
    const R = pool.find(x => {
      if (!isObj(x)) return false;
      const id = x.hashes ? x.id : (isObj(x.rubric) ? x.rubric.id : undefined);
      const sha = x.hashes ? x.hashes.rubricSha256 : x.rubricSha256;
      return id === claimedRoot && sha === prov.root.rubricSha256;
    });
    if (R) {
      const rootModule = R.hashes ? R : null;
      if (prov.contentHash === content && !lineageProblems(prov).length) {
        return { kind: "derived-from-upload", root: rootModule, origin: "derived", row: 6, reasons: [] };
      }
      return {
        kind: "rederive", root: rootModule, origin: "uploaded", row: 6,
        reasons: [`This file was changed after it was created in screenAIr (${prov.contentHash !== content ? "contentHash" : "lineage"} does not match)`],
      };
    }
  }

  // Row 7.
  const reasons = [];
  if (prov) {
    const label = isObj(prov.derivedFrom) && prov.derivedFrom.label ? prov.derivedFrom.label : (prov.root && prov.root.label) || claimedRoot || "an unknown module";
    reasons.push(`claims derivation from ${label}; not verified`);
  }
  return { kind: "uploaded", root: null, origin: "uploaded", row: 7, reasons };
}

const rootRecordOf = (module) => (isObj(module.provenance) && isObj(module.provenance.root) ? module.provenance.root : null);

/**
 * Provenance wording (§3.11 "Provenance display"). Built-ins have none.
 *  clinician: CAVEATS.uploaded / CAVEATS.edited (both for a derivation from an upload), plus
 *             CAVEATS.scoringChanged when the scoring differs from the ROOT's;
 *  patient:   CAVEATS.patient.edited / .uploaded, plus — with {locale} — editedWording for an
 *             edited locale and staleTranslation for a stale one. Never CAVEATS.scoringChanged.
 * @returns {string[]}
 */
export function provenanceLines(module, audience = "clinician", { locale = null } = {}) {
  if (!module || module.origin === "builtin") return [];
  const kind = module.classification && module.classification.kind;
  const derived = module.origin === "derived";
  const fromUpload = kind === "derived-from-upload";
  const out = [];
  if (audience === "patient") {
    out.push(derived ? CAVEATS.patient.edited.en : CAVEATS.patient.uploaded.en);
    if (fromUpload) out.push(CAVEATS.patient.uploaded.en);
    const loc = locale && module.locales && module.locales[locale];
    const data = loc && loc.data;
    if (data && data.editedLocally === true) out.push(CAVEATS.editedWording.en);
    if (data && Array.isArray(data.stale) && data.stale.length) out.push(CAVEATS.staleTranslation.en);
    return out;
  }
  if (derived) out.push(CAVEATS.edited.en);
  if (!derived || fromUpload) out.push(CAVEATS.uploaded.en);
  const root = rootRecordOf(module);
  if (derived && root && module.hashes && root.scoringHash !== module.hashes.scoringHash) {
    const rootModule = module.classification && module.classification.root;
    const rootName = (rootModule && rootModule.name) || root.label || root.moduleId;
    out.push(CAVEATS.scoringChanged.en.replace("{root}", rootName).replace("{rootVersion}", root.instrumentVersion));
  }
  return out;
}

/**
 * The per-tab availability summary (§4.16, §5.2).
 * @returns {{screener:true, scribe:{voice:boolean, probes:boolean, reason?:string},
 *            patient:{available:boolean, reason?:string}, research:{population:boolean, readiness:boolean, reason?:string}}}
 */
export function availability(module) {
  const voice = !!module.lexicon;
  const probes = !!(module.logic && isObj(module.logic.probes) && arr(module.logic.probes.list).length);
  const scribe = { voice, probes };
  if (!voice) scribe.reason = "no voice capture (no lexicon)";
  else if (!probes) scribe.reason = "no probes";
  const en = module.locales && module.locales.en && module.locales.en.data;
  const patientOk = !!(en && isObj(en.items) && Object.keys(en.items).length);
  const patient = patientOk ? { available: true } : { available: false, reason: "no patient wording" };
  const kind = module.classification && module.classification.kind;
  const rootIsBuiltin = !!(module.classification && module.classification.root && module.classification.root.origin === "builtin");
  const popAllowed = module.origin === "builtin" || (kind === "verified" && rootIsBuiltin);
  const research = {
    population: !!(module.research && module.research.population && popAllowed),
    readiness: !!module.research,
  };
  if (!module.research) research.reason = "no research configuration";
  return { screener: true, scribe, patient, research };
}
