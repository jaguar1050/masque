// engine/bind.js — binding a rubric and its logic into a frozen Module (design 03 §3.4, §4.13).
// Owner: WP3.
//
// bindModule(rubric, logic, meta) is the one way a module comes to exist: built-ins, uploads,
// derived modules and restored modules all go through it (D3). It
//   1. refuses only what cannot be bound at all (not an object, wrong format, wrong or newer
//      contractVersion, a bound logic that is missing or not an object) with a BindError;
//      everything else is left for validateModule to report by path;
//   2. resolves the logic ("generic" → GENERIC_LOGIC);
//   3. lays the engine defaults under the rubric (copy, fhir/cds, steps, demo patient);
//   4. renders the identity templates ({id}, {instrument});
//   5. derives the lookups (domain order, items, flags, scale maximum, bands, locales);
//   6. hashes (hash.js rubricHashes, the only implementation, plus the source SHA-256s);
//   7. takes origin and classification from `meta` — never from the file;
//   8. deep-freezes the whole object, logic included.
// No side effects; the rubric passed in is cloned, never frozen or changed.
import { CONTRACT_VERSION, FORMAT, IDENTITY_TEMPLATE_FIELDS } from "./contract.js";
import { canonicalJson, rubricHashes, sha256Hex } from "./hash.js";
import {
  DEFAULT_DEMO_PATIENT, DEFAULT_FHIR, ENGINE_COPY_DEFAULTS, GENERIC_LOGIC,
  defaultPatientSteps, defaultScreenerSteps,
} from "./generic.js";
import { bandRangeText, meterTicks, meterZones, negativeMinOf, scaleMaxOf } from "./scoring.js";

/** A rubric or logic that cannot be bound at all. `code` is the validator code, `path` a JSON pointer. */
export class BindError extends Error {
  constructor(code, path, message) {
    super(message);
    this.name = "BindError";
    this.code = code;
    this.path = path;
  }
}

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x) => (typeof x === "string" ? x : "");

/**
 * Freeze an object graph in place (functions included; typed arrays, Maps and Sets are left
 * as they are, since they cannot be frozen meaningfully). Cycles are fine.
 * @returns {*} the same object
 */
export function deepFreeze(obj) {
  const seen = new WeakSet();
  const walk = (x) => {
    if (x === null || (typeof x !== "object" && typeof x !== "function")) return;
    if (seen.has(x)) return;
    seen.add(x);
    if (ArrayBuffer.isView(x) || x instanceof ArrayBuffer || x instanceof Map || x instanceof Set) return;
    for (const k of Reflect.ownKeys(x)) {
      const d = Object.getOwnPropertyDescriptor(x, k);
      if (d && "value" in d) walk(d.value);
    }
    Object.freeze(x);
  };
  walk(obj);
  return obj;
}

/**
 * Deep copy of plain data: plain objects and arrays are copied, everything else (functions,
 * dates, …) is kept by reference, cycles are preserved. Never throws on non-JSON content, so
 * the validator can report it (V4) instead of the binder crashing on it.
 */
export function cloneData(x, seen = new Map()) {
  if (x === null || typeof x !== "object") return x;
  if (seen.has(x)) return seen.get(x);
  if (Array.isArray(x)) {
    const out = [];
    seen.set(x, out);
    for (let i = 0; i < x.length; i++) out[i] = cloneData(x[i], seen);
    return out;
  }
  const proto = Object.getPrototypeOf(x);
  if (proto !== Object.prototype && proto !== null) return x;
  const out = {};
  seen.set(x, out);
  for (const k of Object.keys(x)) out[k] = cloneData(x[k], seen);
  return out;
}

/** a under b: a deep copy of `base` with `over` merged on top (objects merge, arrays and scalars replace). */
export function mergeUnder(base, over) {
  if (over === undefined) return cloneData(base);
  if (!isObj(base) || !isObj(over)) return cloneData(over);
  const out = cloneData(base);
  for (const k of Object.keys(over)) {
    out[k] = isObj(out[k]) && isObj(over[k]) ? mergeUnder(out[k], over[k]) : cloneData(over[k]);
  }
  return out;
}

/** Value at a dotted path ("fhir.codeSystem"), or undefined. */
export function getPath(obj, path) {
  let v = obj;
  for (const k of String(path).split(".")) {
    if (v === null || typeof v !== "object") return undefined;
    v = v[k];
  }
  return v;
}

function setPath(obj, path, value) {
  const keys = String(path).split(".");
  let v = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!isObj(v[keys[i]])) v[keys[i]] = {};
    v = v[keys[i]];
  }
  v[keys[keys.length - 1]] = value;
}

const VAR_RE = /\{(id|instrument|name)\}/g;
function renderVars(s, vars) {
  return s.replace(VAR_RE, (whole, k) => (typeof vars[k] === "string" ? vars[k] : whole));
}
function renderDeep(x, vars) {
  if (typeof x === "string") return renderVars(x, vars);
  if (Array.isArray(x)) return x.map(v => renderDeep(v, vars));
  if (isObj(x)) {
    const out = {};
    for (const k of Object.keys(x)) out[k] = renderDeep(x[k], vars);
    return out;
  }
  return x;
}

/** "local-shape-3f9a1c" → "LocalShape3f9a1cScreener": a FHIR `name` generated from the id. */
function questionnaireNameFor(id) {
  const parts = String(id || "module").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const pascal = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("") || "Module";
  return (/^[A-Z]/.test(pascal) ? pascal : "M" + pascal) + "Screener";
}

/**
 * The rendered FHIR and CDS identity of a rubric: DEFAULT_FHIR under rubric.fhir / rubric.cds
 * (the defaults' {id}/{instrument}/{name} rendered first), then {id} and {instrument}
 * substituted in every IDENTITY_TEMPLATE_FIELDS value. Every other rubric string is kept as
 * written.
 * @returns {{fhir: Object, cds: Object}}
 */
export function renderIdentity(rubric) {
  const r = isObj(rubric) ? rubric : {};
  const vars = { id: str(r.id), instrument: str(r.instrumentVersion), name: str(r.name) };
  const fhir = mergeUnder(renderDeep(DEFAULT_FHIR.fhir, vars), isObj(r.fhir) ? r.fhir : undefined);
  const cds = mergeUnder(renderDeep(DEFAULT_FHIR.cds, vars), isObj(r.cds) ? r.cds : undefined);
  if (!(isObj(r.fhir) && typeof r.fhir.questionnaireName === "string")) fhir.questionnaireName = questionnaireNameFor(r.id);
  const rf = isObj(cds.examples) && isObj(cds.examples.redFlagPresent) ? cds.examples.redFlagPresent : null;
  if (rf && (rf.flagId === null || rf.flagId === undefined)) {
    const first = arr(r.redFlags).find(f => isObj(f) && typeof f.id === "string");
    rf.flagId = first ? first.id : null;
  }
  const out = { fhir, cds };
  for (const field of IDENTITY_TEMPLATE_FIELDS) {
    const v = getPath(out, field);
    if (typeof v === "string") setPath(out, field, v.replace(/\{id\}/g, vars.id).replace(/\{instrument\}/g, vars.instrument));
  }
  return out;
}

/**
 * Parse rubric text. A leading U+FEFF is stripped with a warning; invalid JSON throws a
 * BindError ("Not valid JSON: …").
 * @returns {{rubric: Object, warnings: string[]}}
 */
export function parseRubricText(text) {
  const warnings = [];
  let t = String(text);
  if (t.charCodeAt(0) === 0xfeff) {
    t = t.slice(1);
    warnings.push("The file starts with a byte-order mark (U+FEFF); it was removed. Save it as UTF-8 without BOM.");
  }
  let rubric;
  try { rubric = JSON.parse(t); }
  catch (e) { throw new BindError("V1", "", `Not valid JSON: ${e && e.message ? e.message : e}`); }
  return { rubric, warnings };
}

/** The canonical file form of a rubric: 2-space JSON, key order preserved, LF, final newline. */
export function serializeRubric(rubric) {
  return JSON.stringify(rubric, null, 2) + "\n";
}

const LOCALE_META_KEYS = new Set(["reviewed", "editedLocally", "stale"]);
const ptr = (s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1");

function mergeLeaves(en, own, base, fallbacks) {
  // Per leaf: an own value wins; a leaf (string, number, boolean, array) present only in en
  // is taken from en and its path recorded.
  if (!isObj(en)) return own !== undefined ? cloneData(own) : cloneData(en);
  const out = {};
  const keys = new Set([...Object.keys(en), ...(isObj(own) ? Object.keys(own) : [])]);
  for (const k of keys) {
    const e = en[k], o = isObj(own) ? own[k] : undefined;
    const p = `${base}/${ptr(k)}`;
    if (isObj(e) && (o === undefined || isObj(o))) {
      out[k] = mergeLeaves(e, o, p, fallbacks);
    } else if (o !== undefined) {
      out[k] = cloneData(o);
    } else if (e !== undefined) {
      if (isObj(e)) out[k] = mergeLeaves(e, undefined, p, fallbacks);
      else { out[k] = cloneData(e); fallbacks.push(p); }
    }
  }
  return out;
}

/**
 * Patient locale data merged over English per leaf (§3.4 step 5). `fallbacks` lists the JSON
 * pointers (in rubric terms) a locale took from `en`; V33 reports them. The locale's own
 * reviewed / editedLocally / stale are never inherited.
 * @returns {Object<string, {data: Object, fallbacks: string[]}>}
 */
export function mergeLocales(rubric) {
  const locales = isObj(rubric) && isObj(rubric.locales) ? rubric.locales : {};
  const en = isObj(locales.en) ? locales.en : null;
  const enData = {};
  if (en) for (const k of Object.keys(en)) if (!LOCALE_META_KEYS.has(k)) enData[k] = en[k];
  const out = {};
  for (const loc of Object.keys(locales)) {
    const own = isObj(locales[loc]) ? locales[loc] : {};
    const fallbacks = [];
    let data;
    if (loc === "en" || !en) {
      data = cloneData(own);
    } else {
      const ownData = {};
      for (const k of Object.keys(own)) if (!LOCALE_META_KEYS.has(k)) ownData[k] = own[k];
      data = mergeLeaves(enData, ownData, `/locales/${ptr(loc)}`, fallbacks);
      for (const k of LOCALE_META_KEYS) if (own[k] !== undefined) data[k] = cloneData(own[k]);
    }
    out[loc] = { data, fallbacks };
  }
  return out;
}

const GLOBAL_COPY_RE = /\{(name|id|instrument|scaleMax|indexName)\}/g;
function renderCopyGlobals(x, vars) {
  if (typeof x === "string") return x.replace(GLOBAL_COPY_RE, (whole, k) => (vars[k] !== undefined ? String(vars[k]) : whole));
  if (Array.isArray(x)) return x.map(v => renderCopyGlobals(v, vars));
  if (isObj(x)) {
    const out = {};
    for (const k of Object.keys(x)) out[k] = renderCopyGlobals(x[k], vars);
    return out;
  }
  return x;
}

/**
 * ENGINE_COPY_DEFAULTS under rubric.copy (rubric keys win), with the CDS preview strings of
 * rubric.cds.preview folded into copy.cds.preview, and the global placeholders ({name},
 * {id}, {instrument}, {scaleMax}, {indexName}) rendered. Slot-specific placeholders
 * ({total}, {cdsTerm}, {bandLabel} …) are left for the consumer.
 */
export function mergeCopy(rubric, scaleMax) {
  const r = isObj(rubric) ? rubric : {};
  let copy = mergeUnder(ENGINE_COPY_DEFAULTS, isObj(r.copy) ? r.copy : undefined);
  if (isObj(r.cds) && isObj(r.cds.preview)) {
    const fromCds = mergeUnder(r.cds.preview, isObj(r.copy) && isObj(r.copy.cds) && isObj(r.copy.cds.preview) ? r.copy.cds.preview : undefined);
    copy = mergeUnder(copy, { cds: { preview: fromCds } });
  }
  const base = { name: str(r.name), id: str(r.id), instrument: str(r.instrumentVersion), scaleMax };
  const indexName = renderCopyGlobals(typeof copy.indexName === "string" ? copy.indexName : "", base);
  return renderCopyGlobals(copy, { ...base, indexName });
}

function fatalShapeProblem(rubric) {
  if (!isObj(rubric)) return new BindError("V1", "", "Not a screenAIr rubric: the file is not a JSON object");
  if (rubric.format !== FORMAT.rubric) return new BindError("V1", "/format", `Not a screenAIr file: format must be "${FORMAT.rubric}"`);
  if (typeof rubric.contractVersion === "number" && rubric.contractVersion > CONTRACT_VERSION) {
    return new BindError("V1", "/contractVersion", `Made for a newer screenAIr (contractVersion ${rubric.contractVersion}; this screenAIr reads ${CONTRACT_VERSION})`);
  }
  if (rubric.contractVersion !== CONTRACT_VERSION) {
    return new BindError("V1", "/contractVersion", `contractVersion must be ${CONTRACT_VERSION}`);
  }
  return null;
}

/** The fatal pre-check of bindModule (§3.4 step 1), exposed for the validator and the editor. */
export function checkBindable(rubric) {
  return fatalShapeProblem(rubric);
}

function normaliseClassification(c, origin) {
  if (c === "builtin" || (c == null && origin === "builtin")) {
    return { kind: "builtin", root: null, origin: "builtin", row: null, reasons: [] };
  }
  return c == null ? null : c;
}

async function shaOrNull(text) {
  return typeof text === "string" ? sha256Hex(text) : null;
}

/**
 * Bind a rubric and its logic into a deep-frozen Module (§3.4).
 * @param {Object} rubric             parsed rubric JSON (cloned, never changed)
 * @param {Object|null} logic         the logic object (`default` export) or null for "generic"
 * @param {{origin?:string, classification?:(Object|string), key?:string, sources?:{rubricText?:string, logicText?:string},
 *          files?:Object, docs?:string[], loadedAt?:string, logicSha256?:string}} [meta]
 * @returns {Promise<Object>} Module
 */
export async function bindModule(rubric, logic, meta = {}) {
  const fatal = fatalShapeProblem(rubric);
  if (fatal) throw fatal;
  const m = meta || {};
  const r = cloneData(rubric);
  const bindIssues = [];

  // 2. Logic resolution.
  const binding = r.logicBinding;
  let boundLogic;
  if (binding === "generic") {
    boundLogic = GENERIC_LOGIC;
    if (logic != null) bindIssues.push({ code: "V5", path: "/logicBinding", msg: "A generic rubric binds no logic, but a logic file was supplied; it was not used" });
  } else if (isObj(binding) && typeof binding.moduleId === "string") {
    if (logic == null) throw new BindError("V5", "/logicBinding/moduleId", `Needs the logic file for '${binding.moduleId}'`);
    if (typeof logic !== "object" || Array.isArray(logic)) throw new BindError("V1", "/logic", "The logic file's default export is not an object");
    boundLogic = logic;
  } else {
    bindIssues.push({ code: "V5", path: "/logicBinding", msg: 'logicBinding must be "generic" or {moduleId, logicSha256?}' });
    boundLogic = logic != null && typeof logic === "object" && !Array.isArray(logic) ? logic : GENERIC_LOGIC;
  }

  // 5. Instrument lookups (defensive: validateModule reports malformed shapes by path).
  const domains = arr(r.domains).map(d => (isObj(d) ? { ...d, items: arr(d.items) } : d));
  const okDomains = domains.filter(d => isObj(d));
  const domainOrder = okDomains.map(d => d.key);
  const allItems = [];
  // No prototype: a lookup by an id the rubric does not define ("constructor") reads as absent.
  const itemById = Object.create(null);
  for (const d of okDomains) {
    for (const it of d.items) {
      if (!isObj(it)) continue;
      const withDomain = { ...it, domain: d.key };
      allItems.push(withDomain);
      if (typeof it.id === "string" && !Object.prototype.hasOwnProperty.call(itemById, it.id)) itemById[it.id] = withDomain;
    }
  }
  const scaleMax = scaleMaxOf({ domains: okDomains });
  const negativeMin = negativeMinOf({ domains: okDomains });
  const negativeDomainKeys = okDomains.filter(d => d.negative === true).map(d => d.key);
  const cuts = isObj(r.bands) && isObj(r.bands.cuts) ? r.bands.cuts : null;
  let bands = { cuts, rangeText: null, zones: null, ticks: null };
  if (cuts && typeof cuts.moderate === "number" && typeof cuts.high === "number") {
    const shim = { bands: { cuts }, scaleMax, domains: okDomains };
    bands = { cuts, rangeText: bandRangeText(shim), zones: meterZones(shim), ticks: meterTicks(shim) };
  }

  const redFlags = arr(r.redFlags);
  const flagById = Object.create(null);
  for (const f of redFlags) if (isObj(f) && typeof f.id === "string" && !Object.prototype.hasOwnProperty.call(flagById, f.id)) flagById[f.id] = f;
  const redFlagGroups = [...new Set(redFlags.filter(isObj).map(f => f.group))];

  // 3. Defaults.
  const steps = {
    screener: isObj(r.steps) && Array.isArray(r.steps.screener) ? r.steps.screener : defaultScreenerSteps(r),
    patient: isObj(r.steps) && Array.isArray(r.steps.patient) ? r.steps.patient : defaultPatientSteps(r),
  };
  const idVars = { id: str(r.id), instrument: str(r.instrumentVersion), name: str(r.name) };
  const demo = {
    ...(isObj(r.demo) ? r.demo : {}),
    patient: isObj(r.demo) && isObj(r.demo.patient) ? r.demo.patient : renderDeep(DEFAULT_DEMO_PATIENT, idVars),
  };
  const copy = mergeCopy(r, scaleMax);

  // 4. Identity.
  const { fhir, cds } = renderIdentity(r);

  // 5. Locales.
  const merged = mergeLocales(r);
  const logicLocales = isObj(boundLogic.locales) ? boundLogic.locales : {};
  const enSum = isObj(logicLocales.en) ? logicLocales.en.sum : undefined;
  const locales = {};
  for (const loc of Object.keys(merged)) {
    const own = isObj(logicLocales[loc]) ? logicLocales[loc].sum : undefined;
    locales[loc] = { data: merged[loc].data, sum: own ?? enSum ?? null, fallbacks: merged[loc].fallbacks };
  }

  // 6. Hashes.
  const sources = isObj(m.sources) ? m.sources : {};
  const files = isObj(m.files) ? cloneData(m.files) : null;
  const isGeneric = boundLogic === GENERIC_LOGIC;
  const [h, rubricSha256, logicSha256] = await Promise.all([
    rubricHashes(r),
    (files && files.rubric && typeof files.rubric.sha256 === "string" && files.rubric.sha256)
      ? files.rubric.sha256
      : (typeof sources.rubricText === "string" ? sha256Hex(sources.rubricText) : sha256Hex(serializeRubric(r))),
    isGeneric ? null
      : (typeof m.logicSha256 === "string" ? m.logicSha256
        : (files && files.logic && typeof files.logic.sha256 === "string" && files.logic.sha256) ? files.logic.sha256
          : shaOrNull(sources.logicText)),
  ]);
  const hashes = { rubricSha256, logicSha256, ...h };

  const lexicon = isObj(r.lexicon) ? r.lexicon : null;
  const goldSet = lexicon && isObj(lexicon.goldSet) ? lexicon.goldSet : null;
  const probes = isObj(boundLogic.probes) ? boundLogic.probes : null;
  const versions = {
    instrument: typeof r.instrumentVersion === "string" ? r.instrumentVersion : null,
    lexicon: lexicon && typeof lexicon.version === "string" ? lexicon.version : null,
    probeSet: probes && typeof probes.version === "string" ? probes.version : null,
    goldSet: goldSet && typeof goldSet.version === "string" ? goldSet.version : null,
    goldSetLexicon: goldSet && typeof goldSet.lexiconVersion === "string" ? goldSet.lexiconVersion : null,
  };

  // 7. Origin and classification come from the caller (the registry), never from the file.
  const origin = m.origin === "builtin" || m.origin === "uploaded" || m.origin === "derived" ? m.origin : "uploaded";
  const classification = normaliseClassification(
    isObj(m.classification) ? { ...m.classification, reasons: arr(m.classification.reasons).slice() } : m.classification, origin);

  const module = {
    // identity
    id: r.id,
    label: r.label,
    name: r.name,
    icon: typeof r.icon === "string" && r.icon ? r.icon : "Stethoscope",
    instrumentVersion: r.instrumentVersion,
    origin,
    classification,
    key: typeof m.key === "string" ? m.key : `module:${str(r.id)}`,
    // instrument
    domains,
    domainOrder,
    allItems,
    itemById,
    scaleMax,
    negativeMin,
    negativeDomainKeys,
    bands,
    // safety and context
    contextItems: arr(r.contextItems),
    gapRule: isObj(r.gapRule) ? r.gapRule : null,
    redFlags,
    redFlagGroups,
    flagById,
    // flow
    steps,
    phenotypes: isObj(r.phenotypes) ? r.phenotypes : null,
    infoPrompts: isObj(r.infoPrompts) ? r.infoPrompts : null,
    sampleCases: arr(r.sampleCases),
    demo,
    lexicon,
    // text and research
    locales,
    research: isObj(r.research) ? r.research : null,
    fhir,
    cds,
    copy,
    // logic
    logic: boundLogic,
    // provenance
    hashes,
    versions,
    provenance: isObj(r.provenance) ? r.provenance : null,
    changelog: arr(r.changelog),
    docs: arr(m.docs).slice(),
    // sources
    rubric: r,
    sources: {
      rubricText: typeof sources.rubricText === "string" ? sources.rubricText : null,
      logicText: typeof sources.logicText === "string" ? sources.logicText : null,
    },
    files,
    loadedAt: typeof m.loadedAt === "string" ? m.loadedAt : null,
    bindIssues,
  };
  return deepFreeze(module);
}

/** canonicalJson of a bound module's data (functions omitted): the determinism probe of the tests. */
export function moduleFingerprint(module) {
  const { classification, ...rest } = module || {};
  return canonicalJson({ ...rest, classification: classification ? { ...classification, root: classification.root ? classification.root.key : null } : null });
}
