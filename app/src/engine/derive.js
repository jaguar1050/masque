// engine/derive.js — drafts, change classification and derived modules (design 03 §3.11, §4.15,
// §5.7). Owner: WP11.
//
// The Rubric Editor and "Load as derived" share one pipeline:
//   createDraft(module)                       a structured clone of the rubric; the module is never mutated
//   diffRubrics(parent.rubric, draft)         JSON-pointer changes, stable order (the Changes pane)
//   lockViolations(parent, draft)             edits the editor may not make (ids, domain structure …)
//   acknowledgePaths(module, readsObserved)   wording the logic reads (needs an acknowledgement)
//   classifyChanges(parent, draft, {root})    instrument / scoring / lexicon changes vs parent and root
//   proposeIdentity(…)                        id, label and versions per the family version rule
//   deriveRubric(parent, draft, {…})          the derived rubric with every §3.11 rule applied
//   bindDerived(rubric, parent, {loaded})     bind + classify + validate it like an upload would
// plus the structural helpers the editor's forms call (add or delete an item or flag, create a
// lexicon or English patient wording, set max = Σw) and the impact preview.
//
// Nothing here names a module, an item or a flag: everything comes from the module passed in.
// Pure apart from hashing (async SHA-256); no side effects at import time.
import { canonicalJson, rubricHashes, sha256Hex, sha256HexSync, utf8Bytes } from "./hash.js";
import { bindModule, serializeRubric } from "./bind.js";
import { validateModule } from "./validate.js";
import { ancestorRecord, classifyLineage } from "./lineage.js";
import { computeScore } from "./scoring.js";
import { buildRoutingState, derivePhenotype, gapSignals, routingRecs } from "./rules.js";
import { buildPatientSummary, projectForPatient } from "./patient.js";

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const isPrimitive = (x) => x === null || (typeof x !== "object" && typeof x !== "function");
const ID_RE = /^[a-z][a-z0-9_]*$/;
const MODULE_ID_RE = /^[a-z][a-z0-9-]{1,47}$/;
const LOCAL_TAG = /-local(?:[.-]|$)/;
const LOCALE_META = new Set(["reviewed", "editedLocally", "stale"]);
const GENERIC_ID = "*generic";

// ------------------------------------------------------------------------- JSON pointers

/** "a/b" → "a~1b" (RFC 6901). */
export function ptrEscape(seg) {
  return String(seg).replace(/~/g, "~0").replace(/\//g, "~1");
}

/** "/domains/0/items" → ["domains", "0", "items"]; "" → []. */
export function ptrParse(ptr) {
  const p = String(ptr);
  if (p === "") return [];
  if (p[0] !== "/") throw new Error(`not a JSON pointer: "${p}"`);
  return p.slice(1).split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** ["domains", 0] → "/domains/0". */
export function ptrJoin(segs) {
  return segs.length ? "/" + segs.map(ptrEscape).join("/") : "";
}

/** Value at a JSON pointer, or undefined. */
export function getAt(obj, ptr) {
  let v = obj;
  for (const k of ptrParse(ptr)) {
    if (v === null || typeof v !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(v, k)) return undefined;
    v = v[k];
  }
  return v;
}

/**
 * Set the value at a JSON pointer in place, creating missing objects on the way (arrays are
 * created when the next segment is an index). `undefined` deletes the key (or splices the
 * array element out).
 */
export function setAt(obj, ptr, value) {
  const segs = ptrParse(ptr);
  if (!segs.length) throw new Error("setAt: cannot replace the root");
  let v = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    if (v[k] === null || typeof v[k] !== "object") v[k] = /^\d+$/.test(segs[i + 1]) ? [] : {};
    v = v[k];
  }
  const last = segs[segs.length - 1];
  if (value === undefined) {
    if (Array.isArray(v) && /^\d+$/.test(last)) v.splice(Number(last), 1);
    else delete v[last];
  } else {
    v[last] = value;
  }
  return obj;
}

/** P touches A when one is the other or lies inside it. */
export function ptrOverlaps(p, a) {
  return p === a || p.startsWith(a + "/") || a.startsWith(p + "/");
}

// --------------------------------------------------------------------------------- draft

/**
 * A draft of `module`: a structured clone of its rubric. The module is never changed.
 * @returns {{parentKey: string, rubric: Object}}
 */
export function createDraft(module) {
  return { parentKey: module.key, rubric: structuredClone(module.rubric) };
}

// ---------------------------------------------------------------------------------- diff

/** Structural equality of JSON data (object key order ignored; undefined members skipped). */
function deepEqual(a, b) {
  if (a === b) return true;
  if (isPrimitive(a) || isPrimitive(b)) return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEqual(a[k], b[k])) return false;
  return true;
}

/** Keys of an array of objects that all carry a unique string `id` (or `key`), else null. */
function arrayKeys(xs) {
  if (!xs.length) return [];
  const field = xs.every((x) => isObj(x) && typeof x.id === "string") ? "id"
    : xs.every((x) => isObj(x) && typeof x.key === "string") ? "key" : null;
  if (!field) return null;
  const keys = xs.map((x) => x[field]);
  return new Set(keys).size === keys.length ? keys : null;
}

function diffInto(a, b, segs, out) {
  if (deepEqual(a, b)) return;
  const path = ptrJoin(segs);
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.every(isPrimitive) && b.every(isPrimitive) && a.length !== b.length) {
      out.push({ path, from: clone(a), to: clone(b) });
      return;
    }
    const ka = arrayKeys(a), kb = arrayKeys(b);
    if (ka && kb && ka.join("\u0000") !== kb.join("\u0000")) {
      const inB = new Set(kb), aIndex = new Map(ka.map((k, i) => [k, i]));
      ka.forEach((k, i) => {
        if (!inB.has(k)) out.push({ path: ptrJoin([...segs, i]), from: clone(a[i]), to: undefined, op: "remove", key: k });
      });
      const commonA = ka.filter((k) => inB.has(k)), commonB = kb.filter((k) => aIndex.has(k));
      if (commonA.join("\u0000") !== commonB.join("\u0000")) out.push({ path, from: commonA, to: commonB, op: "order" });
      kb.forEach((k, j) => {
        if (aIndex.has(k)) diffInto(a[aIndex.get(k)], b[j], [...segs, j], out);
        else out.push({ path: ptrJoin([...segs, j]), from: undefined, to: clone(b[j]), op: "add", key: k });
      });
      return;
    }
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (i >= a.length) out.push({ path: ptrJoin([...segs, i]), from: undefined, to: clone(b[i]), op: "add" });
      else if (i >= b.length) out.push({ path: ptrJoin([...segs, i]), from: clone(a[i]), to: undefined, op: "remove" });
      else diffInto(a[i], b[i], [...segs, i], out);
    }
    return;
  }
  if (isObj(a) && isObj(b)) {
    const keys = [...Object.keys(a), ...Object.keys(b).filter((k) => !Object.prototype.hasOwnProperty.call(a, k))];
    for (const k of keys) {
      const ha = Object.prototype.hasOwnProperty.call(a, k) && a[k] !== undefined;
      const hb = Object.prototype.hasOwnProperty.call(b, k) && b[k] !== undefined;
      if (ha && !hb) out.push({ path: ptrJoin([...segs, k]), from: clone(a[k]), to: undefined, op: "remove" });
      else if (!ha && hb) out.push({ path: ptrJoin([...segs, k]), from: undefined, to: clone(b[k]), op: "add" });
      else if (ha && hb) diffInto(a[k], b[k], [...segs, k], out);
    }
    return;
  }
  out.push({ path, from: clone(a), to: clone(b) });
}

/**
 * The changes from rubric `a` to rubric `b` as JSON pointers into `b` (removals point into
 * `a`), in a stable order: object keys in `a`'s order then `b`'s new keys; arrays of objects
 * with ids matched by id (op "add" / "remove" / "order"); arrays of strings or numbers whose
 * length changed reported whole.
 * @returns {Array<{path:string, from:*, to:*, op?:("add"|"remove"|"order"), key?:string}>}
 */
export function diffRubrics(a, b) {
  const out = [];
  diffInto(a, b, [], out);
  return out;
}

/**
 * Undo one change of diffRubrics(parentRubric, draft) on a copy of the draft.
 * @returns {Object} the new draft rubric
 */
export function revertChange(draft, parentRubric, change) {
  const d = clone(draft);
  if (change.op === "order") {
    setAt(d, change.path, clone(getAt(parentRubric, change.path)));
    return d;
  }
  if (change.op === "remove" || (change.from !== undefined && change.to === undefined)) {
    const segs = ptrParse(change.path);
    const last = segs[segs.length - 1];
    const container = getAt(d, ptrJoin(segs.slice(0, -1)));
    if (Array.isArray(container) && /^\d+$/.test(last)) {
      container.splice(Math.min(Number(last), container.length), 0, clone(change.from));
      return d;
    }
    if (container === undefined) setAt(d, change.path, clone(change.from));
    else container[last] = clone(change.from);
    return d;
  }
  if (change.op === "add" || change.from === undefined) {
    setAt(d, change.path, undefined);
    return d;
  }
  setAt(d, change.path, clone(change.from));
  return d;
}

// ------------------------------------------------------------------------- locks (§5.7)

/** What the editor never changes, with the reason it shows next to the lock. */
const LOCKS = [
  ["/format", "The file format is fixed."],
  ["/contractVersion", "The contract version is fixed."],
  ["/id", "The module id is set in the Apply dialog."],
  ["/instrumentVersion", "Versions are set only in the Apply dialog (family version rule)."],
  ["/lexicon/version", "Versions are set only in the Apply dialog (family version rule)."],
  ["/logicBinding", "Logic is code; edit it as a .js file and upload it."],
  ["/provenance", "Written by Apply."],
  ["/changelog", "Written by Apply."],
  ["/icon", "Not editable in the Rubric Editor."],
  ["/defaultLocale", "Not editable in the Rubric Editor."],
  ["/domains/*/key", "Ids are identifiers (FHIR linkIds, cohort columns, rule references); they cannot change."],
  ["/domains/*/negative", "Whether a domain is negative is part of the domain structure."],
  ["/domains/*/shortTag", "Not editable in the Rubric Editor."],
  ["/domains/*/items/*/id", "Ids are identifiers (FHIR linkIds, cohort columns, rule references); they cannot change."],
  ["/domains/*/items/*/tag", "Not editable in the Rubric Editor."],
  ["/redFlags/*/id", "Ids are identifiers; they cannot change."],
  ["/redFlags/*/ask", "Kept as data; not editable in the Rubric Editor."],
  ["/contextItems/*/id", "Ids are identifiers; they cannot change."],
  ["/contextItems/*/options/*/0", "Option values are stored answers; they cannot change."],
  ["/contextItems/*/captureLabel", "Not editable in the Rubric Editor."],
  ["/contextItems/*/signal/value", "The gap-rule marker value cannot change."],
  ["/gapRule/markers", "The gap-rule markers are read by the logic in this order."],
  ["/gapRule/noteOrder", "The note order of the gap rule is fixed."],
  ["/steps", "Step structure is fixed; patient step wording is under Patient wording."],
  ["/phenotypes", "Not editable in the Rubric Editor."],
  ["/infoPrompts", "Not editable in the Rubric Editor."],
  ["/sampleCases", "Not editable in the Rubric Editor."],
  ["/demo", "Not editable in the Rubric Editor."],
  ["/research", "Research configuration is carried unchanged from the root (§3.11)."],
  ["/fhir", "FHIR identity follows the module id."],
  ["/cds", "CDS identity follows the module id; preview wording is under Copy."],
  ["/lexicon/goldSet", "The gold set belongs to the lexicon it was run against."],
  ["/lexicon/lang", "The voice-capture language is fixed."],
  ["/locales/*/reviewed", "Managed by screenAIr: edited wording is marked unreviewed."],
  ["/locales/*/editedLocally", "Managed by screenAIr."],
  ["/locales/*/stale", "Managed by screenAIr."],
];

/** Fields the editor may change (anything else is read-only). `**` = any depth below. */
const EDITABLE = [
  "/label", "/name", "/copy", "/copy/**",
  "/domains/*/label", "/domains/*/max",
  "/domains/*/items/*",
  "/domains/*/items/*/text", "/domains/*/items/*/short", "/domains/*/items/*/ask", "/domains/*/items/*/ref",
  "/domains/*/items/*/patientClin", "/domains/*/items/*/w",
  "/domains/*/items/*/scale/*/label", "/domains/*/items/*/scale/*/f",
  "/bands/cuts/moderate", "/bands/cuts/high",
  "/redFlags/*", "/redFlags/*/text", "/redFlags/*/points", "/redFlags/*/action", "/redFlags/*/group", "/redFlags/*/tier",
  "/contextItems/*/text", "/contextItems/*/options/*/1",
  "/contextItems/*/signal/screenerLabel", "/contextItems/*/signal/scribeLabel", "/contextItems/*/signal/noteLabel",
  "/gapRule/threshold",
  "/locales/en",
  "/locales/*/items", "/locales/*/items/*", "/locales/*/items/*/q", "/locales/*/items/*/opts", "/locales/*/items/*/opts/*",
  "/locales/*/items/*/ask", "/locales/*/items/*/help",
  "/locales/*/redFlags", "/locales/*/redFlags/*", "/locales/*/redFlags/*/q", "/locales/*/redFlags/*/say",
  "/locales/*/contextItems/*/q", "/locales/*/contextItems/*/opts/*/1",
  "/locales/*/steps/*/title", "/locales/*/steps/*/heading", "/locales/*/steps/*/lede", "/locales/*/steps/*/intro",
  "/locales/*/steps/*", "/locales/*/steps",
  "/locales/*/ui/sub", "/locales/*/ui/forYouIf", "/locales/*/ui/forYouIf/*", "/locales/*/ui/clinicianLede", "/locales/*/ui",
  "/lexicon",
  "/lexicon/negation/window", "/lexicon/negation/cues", "/lexicon/negation/cues/*",
  "/lexicon/thirdParty/cues", "/lexicon/thirdParty/cues/*", "/lexicon/historical/cues", "/lexicon/historical/cues/*",
  "/lexicon/bool", "/lexicon/bool/*", "/lexicon/bool/*/ph", "/lexicon/bool/*/ph/*",
  "/lexicon/ctx", "/lexicon/ctx/*", "/lexicon/ctx/*/ph", "/lexicon/ctx/*/ph/*",
  "/lexicon/scale", "/lexicon/scale/*", "/lexicon/scale/*/cue", "/lexicon/scale/*/cue/*",
  "/lexicon/scale/*/bands/*/ph", "/lexicon/scale/*/bands/*/ph/*",
  "/lexicon/multi/*/ph", "/lexicon/multi/*/ph/*",
  "/lexicon/redFlags", "/lexicon/redFlags/*", "/lexicon/redFlags/*/*",
];

function patternMatches(pattern, path) {
  const ps = ptrParse(pattern), xs = ptrParse(path);
  for (let i = 0; i < ps.length; i++) {
    if (ps[i] === "**") return xs.length >= i + 1;
    if (i >= xs.length) return false;
    if (ps[i] !== "*" && ps[i] !== xs[i]) return false;
  }
  return xs.length === ps.length;
}

/** True when `path` (or a parent of it) is one of the locked patterns. */
function lockedBy(path) {
  for (const [pattern, reason] of LOCKS) {
    const ps = ptrParse(pattern), xs = ptrParse(path);
    if (xs.length < ps.length) continue;
    if (ps.every((p, i) => p === "*" || p === xs[i])) return { pattern, reason };
  }
  return null;
}

/**
 * JSON-pointer patterns (`*` = any one segment) the editor renders read-only (§5.7). Patterns
 * are prefixes: everything below a listed pointer is locked too. Items the logic reads also
 * keep their option count and order, and cannot be deleted (see lockViolations).
 * @returns {string[]}
 */
export function lockedPaths(module) {
  const out = LOCKS.map(([p]) => p);
  // Items the logic reads keep their option count: their scale arrays are locked as a whole
  // structure (labels and f stay editable, see EDITABLE).
  const reads = readsOf(module);
  for (const [id, hit] of itemsById(module.rubric)) {
    if (Object.prototype.hasOwnProperty.call(reads.items, id) && Array.isArray(hit.item.scale)) out.push(`/domains/${hit.di}/items/${hit.ii}/scale#length`);
  }
  return out;
}

/** Why `path` is read-only in the editor, or null when it is editable. */
export function lockReason(path) {
  const hit = lockedBy(path);
  if (hit) return hit.reason;
  if (EDITABLE.some((p) => patternMatches(p, path))) return null;
  return "Not editable in the Rubric Editor.";
}

/** True when the editor may change the field at `path`. */
export function isEditablePath(path) {
  return lockReason(path) === null;
}

function readsOf(module) {
  const logic = module && module.logic;
  if (!logic || logic.moduleId === GENERIC_ID || !isObj(logic.reads)) return { items: {}, domains: {}, redFlags: [], context: {} };
  const r = logic.reads;
  return {
    items: isObj(r.items) ? r.items : {},
    domains: isObj(r.domains) ? r.domains : {},
    redFlags: arr(r.redFlags),
    context: isObj(r.context) ? r.context : {},
  };
}

function itemsById(rubric) {
  const out = new Map();
  arr(rubric && rubric.domains).forEach((d, di) => arr(d && d.items).forEach((it, ii) => {
    if (isObj(it) && typeof it.id === "string" && !out.has(it.id)) out.set(it.id, { item: it, di, ii, domain: d });
  }));
  return out;
}

/**
 * Edits the editor may not make, comparing the draft with the parent's rubric: a change to a
 * locked field; adding, removing or reordering domains; a boolean↔scale switch; a changed
 * option count or order on an item the logic reads; deleting an item the logic reads; deleting
 * every red flag, or a flag the logic reads. (Load as derived does not use this: a hand-edited
 * file may change anything, and the validator guards it.)
 * @returns {Array<{path:string, code:"LOCK", msg:string}>}
 */
export function lockViolations(parent, draftRubric) {
  const out = [];
  const pr = parent.rubric, dr = draftRubric;
  const add = (path, msg) => { if (!out.some((x) => x.path === path && x.msg === msg)) out.push({ path, code: "LOCK", msg }); };
  const reads = readsOf(parent);

  const pd = arr(pr.domains).map((d) => d && d.key), dd = arr(dr.domains).map((d) => d && d.key);
  if (pd.join("\u0000") !== dd.join("\u0000")) {
    add("/domains", "Domains cannot be added, removed or reordered in the editor: change the domain structure in a rubric JSON and upload it.");
  }
  const pItems = itemsById(pr), dItems = itemsById(dr);
  for (const [id, p] of pItems) {
    const d = dItems.get(id);
    const ip = `/domains/${p.di}/items/${p.ii}`;
    if (!d) {
      if (Object.prototype.hasOwnProperty.call(reads.items, id)) add(ip, `Item "${id}" is read by the module's logic and cannot be deleted.`);
      continue;
    }
    const dp = `/domains/${d.di}/items/${d.ii}`;
    if (d.domain.key !== p.domain.key) add(dp, `Item "${id}" cannot move to another domain.`);
    if (Array.isArray(p.item.scale) !== Array.isArray(d.item.scale)) add(dp + "/scale", `Item "${id}" cannot switch between yes/no and a scale.`);
    else if (Array.isArray(p.item.scale) && Object.prototype.hasOwnProperty.call(reads.items, id) && p.item.scale.length !== d.item.scale.length) {
      add(dp + "/scale", `Item "${id}" is read by the module's logic: its option count and order cannot change.`);
    }
  }
  // Order of the surviving items inside each domain.
  arr(pr.domains).forEach((p, di) => {
    const d = arr(dr.domains).find((x) => x && p && x.key === p.key);
    if (!d) return;
    const keep = new Set(arr(d.items).map((x) => x && x.id));
    const before = arr(p.items).map((x) => x && x.id).filter((id) => keep.has(id));
    const after = arr(d.items).map((x) => x && x.id).filter((id) => before.includes(id));
    if (before.join("\u0000") !== after.join("\u0000")) add(`/domains/${di}/items`, "Items cannot be reordered in the editor.");
  });
  const pFlags = arr(pr.redFlags).map((f) => f && f.id), dFlags = new Set(arr(dr.redFlags).map((f) => f && f.id));
  if (!dFlags.size) add("/redFlags", "At least one red flag stays enforced.");
  pFlags.forEach((id, i) => {
    if (!dFlags.has(id) && reads.redFlags.includes(id)) add(`/redFlags/${i}`, `Red flag "${id}" is read by the module's logic and cannot be deleted.`);
  });
  const pCtx = arr(pr.contextItems).map((c) => c && c.id).join("\u0000"), dCtx = arr(dr.contextItems).map((c) => c && c.id).join("\u0000");
  if (pCtx !== dCtx) add("/contextItems", "Context items cannot be added, removed or reordered in the editor.");
  arr(pr.contextItems).forEach((c, i) => {
    const d = arr(dr.contextItems)[i];
    if (!isObj(c) || !isObj(d)) return;
    if (arr(c.options).length !== arr(d.options).length) add(`/contextItems/${i}/options`, "Context options cannot be added or removed in the editor.");
  });
  // Every other change must land on an editable field. Removing the entries that depended on
  // a deleted item or flag (sample answers, multi-answer phrases) goes with the deletion.
  const gone = new Set([...[...pItems.keys()].filter((id) => !dItems.has(id)), ...pFlags.filter((id) => !dFlags.has(id))]);
  const dependentOfGone = (p) => {
    const segs = ptrParse(p);
    if (segs[0] === "sampleCases" && (segs[2] === "a" || segs[2] === "rf") && gone.has(segs[3]) && segs.length === 4) return true;
    return segs[0] === "lexicon" && segs[1] === "multi" && gone.size > 0;
  };
  for (const ch of diffRubrics(pr, dr)) {
    if (ch.op === "order") continue;
    if (ch.path === "/domains" || ch.path === "/redFlags" || ch.path === "/contextItems") continue;
    if (dependentOfGone(ch.path)) continue;
    const reason = lockReason(ch.path);
    if (reason) add(ch.path, `Read-only: ${reason}`);
  }
  return out;
}

// ------------------------------------------------------------- acknowledgements (§5.7)

function closuresFor(observed, kind, id) {
  const m = isObj(observed) && isObj(observed[kind]) ? observed[kind][id] : null;
  return Array.isArray(m) && m.length ? m.slice() : ["logic.reads (declared)"];
}

/**
 * The wording the logic depends on (§5.7): the clinician text, option labels and patient
 * wording of every item, option, flag and context value in `logic.reads`, each with the
 * closure ids that read it (from validateModule's info.readsObserved; the declaration when
 * nothing was observed). Such a field stays editable, but an edit needs an acknowledgement.
 * @returns {Array<{path:string, dependents:string[], kind:("item"|"flag"|"context"), id:string}>}
 */
export function acknowledgePaths(module, readsObserved) {
  const out = [];
  const rubric = module.rubric;
  const reads = readsOf(module);
  const locs = isObj(rubric.locales) ? Object.keys(rubric.locales) : [];
  const items = itemsById(rubric);
  for (const id of Object.keys(reads.items)) {
    const hit = items.get(id);
    if (!hit) continue;
    const deps = closuresFor(readsObserved, "items", id);
    const base = `/domains/${hit.di}/items/${hit.ii}`;
    const push = (path) => out.push({ path, dependents: deps, kind: "item", id });
    push(base + "/text");
    const n = Array.isArray(hit.item.scale) ? hit.item.scale.length : 0;
    for (let k = 0; k < n; k++) push(`${base}/scale/${k}/label`);
    for (const loc of locs) {
      const lb = `/locales/${ptrEscape(loc)}/items/${ptrEscape(id)}`;
      push(lb + "/q");
      for (let k = 0; k < n; k++) push(`${lb}/opts/${k}`);
      const own = getAt(rubric, lb);
      if (isObj(own) && own.ask !== undefined) push(lb + "/ask");
      if (isObj(own) && own.help !== undefined) push(lb + "/help");
    }
  }
  arr(rubric.redFlags).forEach((f, i) => {
    if (!isObj(f) || !reads.redFlags.includes(f.id)) return;
    const deps = closuresFor(readsObserved, "redFlags", f.id);
    out.push({ path: `/redFlags/${i}/text`, dependents: deps, kind: "flag", id: f.id });
    for (const loc of locs) {
      for (const k of ["q", "say"]) out.push({ path: `/locales/${ptrEscape(loc)}/redFlags/${ptrEscape(f.id)}/${k}`, dependents: deps, kind: "flag", id: f.id });
    }
  });
  arr(rubric.contextItems).forEach((c, i) => {
    if (!isObj(c) || !Object.prototype.hasOwnProperty.call(reads.context, c.id)) return;
    const values = arr(reads.context[c.id]);
    const deps = closuresFor(readsObserved, "context", c.id);
    out.push({ path: `/contextItems/${i}/text`, dependents: deps, kind: "context", id: c.id });
    arr(c.options).forEach((o, k) => {
      if (Array.isArray(o) && (!values.length || values.includes(o[0]))) out.push({ path: `/contextItems/${i}/options/${k}/1`, dependents: deps, kind: "context", id: c.id });
    });
    for (const loc of locs) {
      const lb = `/locales/${ptrEscape(loc)}/contextItems/${ptrEscape(c.id)}`;
      out.push({ path: lb + "/q", dependents: deps, kind: "context", id: c.id });
      arr(getAt(rubric, lb + "/opts")).forEach((o, k) => out.push({ path: `${lb}/opts/${k}/1`, dependents: deps, kind: "context", id: c.id }));
    }
  });
  return out;
}

/** "summary.said:durTypical.when" → {family:"summary.said", rule:"durTypical", part:"when"}. */
export function parseClosureId(cid) {
  const m = /^([^:]+):([^.]+)(?:\.(.+))?$/.exec(String(cid));
  if (!m) return { family: String(cid), rule: null, part: null };
  return { family: m[1], rule: m[2], part: m[3] || null };
}

/** "summary.said:durTypical.when" → "summary.said · durTypical" (the editor's "Read by" line). */
export function closureLabel(cid) {
  const p = parseClosureId(cid);
  return p.rule ? `${p.family} · ${p.rule}` : p.family;
}

// ---------------------------------------------------------------- classification (§4.15)

/**
 * The root record a derivation of `parent` records: the parent's recorded root when it has a
 * verified one (copied forward, §3.11), else the parent's own record. `root` may name it
 * explicitly as a module or an AncestorRecord.
 */
function resolveRootRecord(parent, root) {
  const info = rootOf(parent);
  if (!root) return info.record;
  if (root.hashes) {
    if (root === parent) return ancestorRecord(parent);
    return info.record.moduleId === root.id ? info.record : ancestorRecord(root);
  }
  return typeof root.moduleId === "string" && typeof root.instrumentHash === "string" ? root : info.record;
}

/** The root of a module's lineage: {record, module|null}. A module without a verified root is its own root. */
export function rootOf(module) {
  const prov = module.provenance;
  if (module.origin === "derived" && isObj(prov) && isObj(prov.root)) {
    const c = module.classification;
    const rm = c && c.root && c.root.hashes ? c.root : null;
    return { record: prov.root, module: rm && rm.id === prov.root.moduleId ? rm : null };
  }
  return { record: ancestorRecord(module), module };
}

function stripLocale(L) {
  if (!isObj(L)) return null;
  const out = {};
  for (const k of Object.keys(L)) if (!LOCALE_META.has(k)) out[k] = L[k];
  return canonicalJson(out);
}

function localesEdited(parentRubric, draftRubric) {
  const pl = isObj(parentRubric.locales) ? parentRubric.locales : {};
  const dl = isObj(draftRubric.locales) ? draftRubric.locales : {};
  return [...new Set([...Object.keys(pl), ...Object.keys(dl)])].filter((loc) => isObj(dl[loc]) && stripLocale(pl[loc]) !== stripLocale(dl[loc]));
}

const isMetaPath = (p) => /^\/locales\/[^/]+\/(reviewed|editedLocally|stale)(\/|$)/.test(p);

/**
 * Classify the draft's changes against the parent and the root (§4.15).
 * @param {Object} parent        bound module the draft was taken from
 * @param {Object} draftRubric
 * @param {{root?: Object, readsObserved?: Object}} [opts]  root: the root module (default: the
 *        parent's verified root, or the parent itself); readsObserved: the parent's
 *        validation.info.readsObserved (for the acknowledgement dependents)
 */
export async function classifyChanges(parent, draftRubric, { root = null, readsObserved = null } = {}) {
  const rootModule = root && root.hashes ? root : rootOf(parent).module;
  const rootRecord = resolveRootRecord(parent, root);
  const dh = await rubricHashes(draftRubric);
  const ph = parent.hashes;
  const cmp = (h) => ({
    instrumentChanged: dh.instrumentHash !== h.instrumentHash,
    scoringChanged: dh.scoringHash !== h.scoringHash,
    lexiconChanged: (dh.lexiconHash ?? null) !== (h.lexiconHash ?? null),
  });
  const diff = diffRubrics(parent.rubric, draftRubric);
  const paths = diff.map((d) => d.path);
  const englishEditedPaths = paths.filter((p) => (p === "/locales/en" || p.startsWith("/locales/en/")) && !isMetaPath(p));
  const changed = new Set(paths);
  const staleRedFlagPaths = [];
  const dl = isObj(draftRubric.locales) ? draftRubric.locales : {};
  for (const p of englishEditedPaths) {
    const m = /^\/locales\/en\/redFlags\/([^/]+)(?:\/(q|say))?$/.exec(p);
    if (!m) continue;
    const keys = m[2] ? [m[2]] : ["q", "say"];
    for (const loc of Object.keys(dl)) {
      if (loc === "en") continue;
      for (const k of keys) {
        const lp = `/locales/${ptrEscape(loc)}/redFlags/${m[1]}/${k}`;
        if (getAt(draftRubric, lp) !== undefined && ![...changed].some((c) => ptrOverlaps(c, lp)) && !staleRedFlagPaths.includes(lp)) staleRedFlagPaths.push(lp);
      }
    }
  }
  const ack = acknowledgePaths(parent, readsObserved);
  const needsAcknowledgement = ack.filter((a) => paths.some((p) => ptrOverlaps(p, a.path))
    && !deepEqual(getAt(parent.rubric, a.path), getAt(draftRubric, a.path))).map((a) => a.path);
  const safety = [];
  const pf = new Map(arr(parent.rubric.redFlags).filter(isObj).map((f, i) => [f.id, { f, i }]));
  const df = new Map(arr(draftRubric.redFlags).filter(isObj).map((f, i) => [f.id, { f, i }]));
  for (const [id, { f, i }] of df) {
    const p = pf.get(id);
    if (!p) safety.push({ kind: "add", id, path: `/redFlags/${i}` });
    else if (p.f.tier !== f.tier) safety.push({ kind: "tier", id, path: `/redFlags/${i}/tier`, from: p.f.tier, to: f.tier });
  }
  for (const [id, { i }] of pf) if (!df.has(id)) safety.push({ kind: "delete", id, path: `/redFlags/${i}` });
  return {
    vsParent: cmp(ph),
    vsRoot: cmp({ instrumentHash: rootRecord.instrumentHash, scoringHash: rootRecord.scoringHash, lexiconHash: rootRecord.lexiconHash }),
    localesEdited: localesEdited(parent.rubric, draftRubric),
    englishEditedPaths,
    staleRedFlagPaths,
    paths,
    needsAcknowledgement,
    // Beyond the §4.15 minimum: what the Apply dialog and deriveRubric reuse.
    safety,
    diff,
    rootRecord,
    rootModule: rootModule || null,
    draftHashes: dh,
  };
}

// ------------------------------------------------------------------- identity (§3.11)

const modulesOf = (xs) => arr(xs).map((x) => (x && x.module && x.module.hashes ? x.module : x)).filter((m) => m && m.hashes);

function draftHex6(draftRubric) {
  const r = {};
  for (const k of Object.keys(draftRubric)) if (!["id", "label", "provenance", "changelog"].includes(k)) r[k] = draftRubric[k];
  return sha256HexSync(utf8Bytes(canonicalJson(r))).slice(0, 6);
}

function isoDate(now) {
  return String(now || new Date().toISOString()).slice(0, 10);
}

/** The family records a draft of `parent` is checked against (§3.11 "Family"). */
export function familyRecords(parent, loaded, rootRecord) {
  const out = [];
  const seen = new Set();
  const add = (rec, name) => {
    if (!isObj(rec)) return;
    const k = `${rec.moduleId}\u0000${rec.rubricSha256}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ ...rec, displayName: name || rec.label || rec.moduleId });
  };
  const rootId = rootRecord.moduleId;
  const mods = modulesOf(loaded);
  const rootLoaded = mods.find((m) => m.id === rootId && m.hashes.rubricSha256 === rootRecord.rubricSha256);
  add(rootRecord, rootLoaded ? rootLoaded.name : null);
  const prov = parent.origin === "derived" && isObj(parent.provenance) ? parent.provenance : null;
  if (prov) for (const rec of arr(prov.lineage)) add(rec);
  add(ancestorRecord(parent), parent.id === rootId ? parent.name : null);
  for (const m of mods) {
    if (m === parent) continue;
    const r = rootOf(m);
    if (m.id === rootId || (r.record && r.record.moduleId === rootId && m.origin === "derived")) add(ancestorRecord(m), m.id === rootId ? m.name : null);
  }
  return out;
}

function trimmedRootId(rootId, suffixLen) {
  let base = String(rootId);
  const room = 48 - "local-".length - suffixLen;
  if (base.length > room) base = base.slice(0, room).replace(/-+$/, "");
  return base;
}

/**
 * Default identity for a derived module (§3.11, §5.7): id `local-<root id>-<hex6>` (hex6 from
 * SHA-256 over the draft without id, label, provenance and changelog; `-2`, `-3` … on a
 * collision); label `<root label> — edited <YYYY-MM-DD>` (` (2)` … on a collision), or the
 * label typed in the editor when the draft changed it and it is free; versions
 * by the family rule — locked to a family member's version when the draft's hash equals that
 * member's, otherwise `<root version>-local.<hash6>` (`0.1-local.<hash6>` for a lexicon the
 * root does not have).
 * @param {Object} parent
 * @param {Object} draftRubric
 * @param {Object} classification  classifyChanges(parent, draftRubric)
 * @param {Array} loaded           loaded modules (or registry entries)
 * @param {{now?: string}} [opts]
 * @returns {{id:string, label:string, instrumentVersion:string, lexiconVersion:(string|null),
 *            versionLocked:{instrument:(string|null), lexicon:(string|null)}, family:Object[]}}
 */
export function proposeIdentity(parent, draftRubric, classification, loaded, { now = null } = {}) {
  const rootRecord = classification.rootRecord || rootOf(parent).record;
  const mods = modulesOf(loaded);
  const dh = classification.draftHashes;
  const ids = new Set(mods.map((m) => m.id));
  const hex6 = draftHex6(draftRubric);
  const base = `local-${trimmedRootId(rootRecord.moduleId, hex6.length + 1 + 3)}-${hex6}`;
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
  const labels = new Set(mods.map((m) => String(m.label || "").trim().toLowerCase()));
  // A label the user typed in the editor wins over the default, unless it is taken.
  const typed = typeof draftRubric.label === "string" && draftRubric.label.trim() && draftRubric.label !== parent.label ? draftRubric.label.trim() : null;
  const lbase = typed && !labels.has(typed.toLowerCase()) ? typed : `${rootRecord.label} — edited ${isoDate(now)}`;
  let label = lbase;
  for (let n = 2; labels.has(label.trim().toLowerCase()); n++) label = `${lbase} (${n})`;

  const family = familyRecords(parent, loaded, rootRecord);
  const versionFor = (kind) => {
    const hashKey = kind === "instrument" ? "instrumentHash" : "lexiconHash";
    const verKey = kind === "instrument" ? "instrumentVersion" : "lexiconVersion";
    const h = kind === "instrument" ? dh.instrumentHash : (dh.lexiconHash ?? null);
    if (kind === "lexicon" && h === null) {
      const same = family.find((rec) => (rec.lexiconHash ?? null) === null);
      return { version: null, locked: same ? `${same.displayName} (no lexicon)` : null };
    }
    const same = family.find((rec) => (rec[hashKey] ?? null) === h);
    if (same && (same[verKey] ?? null) !== null) return { version: same[verKey], locked: `${same.displayName} ${same[verKey]}` };
    const rootV = rootRecord[verKey] ?? (kind === "lexicon" ? "0.1" : "0.1");
    const used = new Set(family.map((rec) => rec[verKey]).filter((v) => typeof v === "string"));
    let n = 6, v = `${rootV}-local.${String(h).slice(0, n)}`;
    while (used.has(v) && n < 64) { n += 2; v = `${rootV}-local.${String(h).slice(0, n)}`; }
    return { version: v, locked: null };
  };
  const inst = versionFor("instrument");
  const lex = draftRubric.lexicon ? versionFor("lexicon") : { version: null, locked: null };
  return {
    id, label,
    instrumentVersion: inst.version,
    lexiconVersion: lex.version,
    versionLocked: { instrument: inst.locked, lexicon: lex.locked },
    family,
  };
}

/**
 * Problems with a chosen identity before deriving (§5.7 Apply dialog): id pattern and
 * uniqueness, label rules, the `-local` tag and family uniqueness of a changed version.
 * @returns {Array<{field:string, msg:string}>}
 */
export function identityProblems({ id, label, instrumentVersion, lexiconVersion }, { classification, identity, loaded = [], hasLexicon = true }) {
  const out = [];
  const mods = modulesOf(loaded);
  const builtinLabels = new Set(mods.filter((m) => m.origin === "builtin").map((m) => String(m.label).trim().toLowerCase()));
  if (!MODULE_ID_RE.test(String(id || "")) || String(id).endsWith("-")) out.push({ field: "id", msg: "The id must be 2–48 characters: lowercase letters, digits and hyphens, starting with a letter and not ending in a hyphen." });
  else if (mods.some((m) => m.id === id)) out.push({ field: "id", msg: `Module id '${id}' is already loaded` });
  else {
    const b = mods.find((m) => m.origin === "builtin" && String(id).startsWith(m.id + "-"));
    if (b) out.push({ field: "id", msg: `A module id may not start with the built-in id '${b.id}-'` });
  }
  const l = String(label || "").trim();
  if (!l) out.push({ field: "label", msg: "The label is required." });
  else if (l.length > 80) out.push({ field: "label", msg: "The label may have at most 80 characters." });
  else if (builtinLabels.has(l.toLowerCase())) out.push({ field: "label", msg: `Label '${l}' belongs to a built-in module` });
  const family = identity ? identity.family : [];
  const check = (field, v, locked, changedFromRoot, verKey) => {
    if (locked) return;
    if (field === "lexiconVersion" && !hasLexicon) return;
    if (typeof v !== "string" || !/^\d+(\.\d+)*(-[a-z0-9.-]+)?$/.test(v)) { out.push({ field, msg: "A version looks like 0.2 or 0.2-local.3f9a1c." }); return; }
    if (changedFromRoot && !LOCAL_TAG.test(v)) out.push({ field, msg: "This version changed from the root's, so it must carry the -local tag (e.g. 0.2-local.3f9a1c)." });
    const clash = family.find((rec) => rec[verKey] === v);
    if (clash) out.push({ field, msg: `Version ${v} is already used by ${clash.displayName} for different content.` });
  };
  const c = classification || { vsRoot: {} };
  check("instrumentVersion", instrumentVersion, identity && identity.versionLocked.instrument, c.vsRoot.instrumentChanged, "instrumentVersion");
  check("lexiconVersion", lexiconVersion, identity && identity.versionLocked.lexicon, c.vsRoot.lexiconChanged, "lexiconVersion");
  return out;
}

// ------------------------------------------------------------------- derivation (§3.11)

/** The logic binding every generation keeps: the root's logic, pinned by hash (§3.11). */
export function bindingOf(parent) {
  if (parent.origin === "derived" && parent.rubric.logicBinding !== undefined) return clone(parent.rubric.logicBinding);
  if (!parent.logic || parent.logic.moduleId === GENERIC_ID || parent.rubric.logicBinding === "generic") return "generic";
  return { moduleId: parent.logic.moduleId, logicSha256: parent.hashes.logicSha256 };
}

const IDENTITY_PATHS = /^\/(id|label|instrumentVersion|logicBinding|provenance|changelog)(\/|$)|^\/lexicon\/version$/;

function withKeyBefore(obj, key, value, beforeKey) {
  const out = {};
  let placed = false;
  for (const k of Object.keys(obj)) {
    if (k === key) continue;
    if (k === beforeKey && !placed) { out[key] = value; placed = true; }
    out[k] = obj[k];
  }
  if (!placed) out[key] = value;
  return out;
}

/**
 * The derived rubric (§3.11): new id, label and versions; patient locales marked
 * (edited → reviewed:false, editedLocally:true; an English edit → the matching path in every
 * other locale's `stale[]` and that locale reviewed:false); research calibration and
 * population carried unchanged; the settled CDS example removed when the scoring differs from
 * the root's; logicBinding = the root's logic pinned by hash; one `derived` change-log entry;
 * provenance {root, derivedFrom, lineage, contentHash, createdAt, source?}. Serves Apply and
 * "Load as derived" (parent = the root there).
 * @returns {Promise<Object>} Rubric
 */
export async function deriveRubric(parent, draftRubric, {
  root = null, id, label, instrumentVersion, lexiconVersion = null, note, author = null,
  acknowledged = [], now = null, source = null,
} = {}) {
  if (typeof note !== "string" || !note.trim()) throw new Error("A change note is required.");
  const createdAt = now || new Date().toISOString();
  const pr = parent.rubric;
  const rootRecord = resolveRootRecord(parent, root);
  const parentRecord = ancestorRecord(parent);
  const hasRoot = parent.origin === "derived" && isObj(parent.provenance) && isObj(parent.provenance.root);
  const lineage = hasRoot ? [...arr(parent.provenance.lineage).map(clone), parentRecord] : [parentRecord];

  const diff = diffRubrics(pr, draftRubric);
  const changed = diff.map((d) => d.path);
  let r = clone(draftRubric);
  delete r.provenance;
  r.id = id;
  r.label = label;
  r.instrumentVersion = instrumentVersion;
  if (isObj(r.lexicon) && typeof lexiconVersion === "string") r.lexicon.version = lexiconVersion;
  r.logicBinding = bindingOf(parent);

  // Patient locales.
  const edited = localesEdited(pr, draftRubric);
  const locs = isObj(r.locales) ? r.locales : {};
  for (const loc of edited) {
    if (!isObj(locs[loc])) continue;
    locs[loc].reviewed = false;
    locs[loc].editedLocally = true;
  }
  const enPaths = changed.filter((p) => p.startsWith("/locales/en/") && !isMetaPath(p));
  for (const loc of Object.keys(locs)) {
    if (loc === "en" || !isObj(locs[loc])) continue;
    const L = locs[loc];
    let stale = arr(L.stale).filter((p) => typeof p === "string");
    // A translation updated in this edit is no longer stale.
    stale = stale.filter((p) => !changed.some((c) => ptrOverlaps(c, p)));
    for (const p of enPaths) {
      const lp = `/locales/${ptrEscape(loc)}/` + p.slice("/locales/en/".length);
      if (getAt(r, lp) === undefined) continue;                  // falls back to English: not a stale translation
      if (changed.some((c) => ptrOverlaps(c, lp))) continue;     // updated together with the English
      if (!stale.includes(lp)) stale.push(lp);
    }
    if (stale.length) { L.stale = stale; L.reviewed = false; }
    else if (L.stale !== undefined) L.stale = [];
  }

  // Research: calibration and population carried unchanged (V54).
  if (isObj(r.research) && isObj(pr.research)) {
    for (const k of ["calibration", "population"]) {
      if (pr.research[k] !== undefined) r.research[k] = clone(pr.research[k]);
      else delete r.research[k];
    }
  }

  // Settled CDS example: written for the root's scoring.
  const removed = [];
  const mid = await rubricHashes(r);
  if (mid.scoringHash !== rootRecord.scoringHash && isObj(r.cds) && isObj(r.cds.examples) && r.cds.examples.settled !== undefined) {
    delete r.cds.examples.settled;
    removed.push("/cds/examples/settled");
  }

  // Change log.
  const axes = {};
  if (pr.instrumentVersion !== instrumentVersion) axes.instrument = [pr.instrumentVersion, instrumentVersion];
  const pLex = isObj(pr.lexicon) ? pr.lexicon.version : null;
  const dLex = isObj(r.lexicon) ? r.lexicon.version : null;
  if ((pLex ?? null) !== (dLex ?? null)) axes.lexicon = [pLex ?? "—", dLex ?? "—"];
  const entry = { date: isoDate(createdAt), kind: "derived", note: note.trim() };
  if (author && String(author).trim()) entry.author = String(author).trim();
  entry.paths = [...changed.filter((p) => !IDENTITY_PATHS.test(p) && !isMetaPath(p)), ...removed.filter((p) => !changed.includes(p))];
  entry.axes = axes;
  const ack = arr(acknowledged).filter((p) => typeof p === "string");
  if (ack.length) entry.acknowledged = ack.slice();
  if (removed.length) entry.removed = removed;
  r.changelog = [...arr(r.changelog).map(clone), entry];

  // Provenance last: contentHash seals everything else.
  const { contentHash } = await rubricHashes(r);
  const provenance = { root: clone(rootRecord), derivedFrom: parentRecord, lineage, contentHash, createdAt };
  if (source && typeof source.name === "string") provenance.source = { name: source.name, sha256: String(source.sha256 || "") };
  r = withKeyBefore(r, "provenance", provenance, "changelog");
  return r;
}

/**
 * Bind, classify and validate a derived rubric the way an upload of it would be (§3.9,
 * §3.11): classifyLineage against the loaded modules, bindModule with the parent's logic
 * (the root's, pinned by hash), validateModule against the root. Returns a registry entry the
 * shell can register as is.
 * @returns {Promise<{module:Object, validation:Object, classification:Object, entry:Object}>}
 */
export async function bindDerived(rubric, parent, { loaded = [], now = null } = {}) {
  const at = now || new Date().toISOString();
  const mods = modulesOf(loaded);
  const generic = rubric.logicBinding === "generic";
  const logic = generic ? null : parent.logic;
  const logicSha256 = generic ? null : parent.hashes.logicSha256;
  const builtins = mods.filter((m) => m.origin === "builtin");
  const classification = await classifyLineage(rubric, { builtins, loaded: mods, sameUpload: [], logicSha256 });
  const rubricText = serializeRubric(rubric);
  const logicText = generic ? null
    : (parent.sources && typeof parent.sources.logicText === "string" ? parent.sources.logicText
      : (parent.files && parent.files.logic && typeof parent.files.logic.text === "string" ? parent.files.logic.text : null));
  const files = {
    rubric: { name: `${rubric.id}.rubric.json`, text: rubricText, sha256: await sha256Hex(rubricText) },
    logic: generic ? null : { name: `${rubric.id}.logic.js`, text: logicText, sha256: logicSha256 },
  };
  const key = `derived:${rubric.id}`;
  const module = await bindModule(rubric, logic, {
    origin: classification.origin, classification, key, sources: { rubricText, logicText }, files, loadedAt: at,
  });
  const rootModule = classification.root && classification.root.hashes ? classification.root : null;
  const validation = await validateModule({ module, loaded: mods, root: rootModule });
  if (classification.origin !== "derived") {
    validation.ok = false;
    validation.errors = [...validation.errors, {
      path: "/provenance", code: "V52",
      msg: `the derived module does not verify against its root (${classification.reasons.join("; ") || `row ${classification.row}`})`,
    }];
  }
  const entry = { key, origin: classification.origin, classification, module, validation, files, loadedAt: at };
  return { module, validation, classification, entry };
}

/**
 * The whole Apply pipeline for a preview or a test: classify, propose the identity, derive
 * and bind. `overrides` replaces any proposed identity field.
 * @returns {Promise<{changes:Object, identity:Object, chosen:Object, rubric:Object, module:Object,
 *                    validation:Object, classification:Object, entry:Object}>}
 *          changes = classifyChanges(…); classification = classifyLineage of the result
 */
export async function deriveAndBind(parent, draftRubric, {
  loaded = [], readsObserved = null, now = null, note = "preview", author = null, acknowledged = [], source = null, overrides = {},
} = {}) {
  const changes = await classifyChanges(parent, draftRubric, { readsObserved });
  const identity = proposeIdentity(parent, draftRubric, changes, loaded, { now });
  const chosen = { id: identity.id, label: identity.label, instrumentVersion: identity.instrumentVersion, lexiconVersion: identity.lexiconVersion, ...overrides };
  const rubric = await deriveRubric(parent, draftRubric, {
    ...chosen, note, author, acknowledged: acknowledged.length ? acknowledged : changes.needsAcknowledgement, now, source,
  });
  const bound = await bindDerived(rubric, parent, { loaded, now });
  return { changes, identity, chosen, rubric, ...bound };
}

// ---------------------------------------------------------- structural edits (the forms)

/** Where an id lives in a rubric: {kind, path, index…} or null. */
export function findId(rubric, id) {
  const it = itemsById(rubric).get(id);
  if (it) return { kind: "item", path: `/domains/${it.di}/items/${it.ii}`, di: it.di, ii: it.ii };
  const fi = arr(rubric.redFlags).findIndex((f) => isObj(f) && f.id === id);
  if (fi >= 0) return { kind: "flag", path: `/redFlags/${fi}`, index: fi };
  const ci = arr(rubric.contextItems).findIndex((c) => isObj(c) && c.id === id);
  if (ci >= 0) return { kind: "context", path: `/contextItems/${ci}`, index: ci };
  const pi = arr(rubric.infoPrompts && rubric.infoPrompts.prompts).findIndex((p) => isObj(p) && p.id === id);
  if (pi >= 0) return { kind: "info prompt", path: `/infoPrompts/prompts/${pi}`, index: pi };
  return null;
}

/** Σw of a domain's items (numbers only). */
export function domainSum(domain) {
  return arr(domain && domain.items).reduce((s, it) => s + (isObj(it) && typeof it.w === "number" && Number.isFinite(it.w) ? it.w : 0), 0);
}

/** "set max = Σw" on domain `di` (changes the scale, hence the instrument). Returns a new rubric. */
export function setMaxToSum(rubric, di) {
  const r = clone(rubric);
  const d = r.domains[di];
  d.max = Math.round(domainSum(d) * 1e9) / 1e9;
  return r;
}

/**
 * Problems with an Add item form (§5.7): V11 id pattern and the single id namespace, an
 * existing domain, a scale with ≥ 2 labelled options, f in [0,1] and at least one f of 0,
 * w ≠ 0 with the domain's sign, clinician text, and English patient wording when the module
 * has it. Field-addressed so the form can show each next to its input.
 * @returns {Array<{field:string, code:string, msg:string}>}
 */
export function newItemProblems(rubric, spec) {
  const out = [];
  const s = spec || {};
  const id = String(s.id || "");
  if (!ID_RE.test(id)) out.push({ field: "id", code: "V11", msg: "The id must match /^[a-z][a-z0-9_]*$/ (lowercase letters, digits and _; a letter first)." });
  else if (Object.prototype.hasOwnProperty.call(Object.prototype, id)) out.push({ field: "id", code: "V11", msg: `"${id}" is reserved.` });
  else {
    const hit = findId(rubric, id);
    if (hit) out.push({ field: "id", code: "V11", msg: `"${id}" is already used by a ${hit.kind}.` });
  }
  const d = arr(rubric.domains).find((x) => isObj(x) && x.key === s.domain);
  if (!d) out.push({ field: "domain", code: "V10", msg: "Choose an existing domain." });
  const w = typeof s.w === "number" ? s.w : Number(s.w);
  if (!Number.isFinite(w) || w === 0) out.push({ field: "w", code: "V12", msg: "w must be a number other than 0." });
  else if (d && ((d.negative === true && w > 0) || (d.negative !== true && w < 0))) {
    out.push({ field: "w", code: "V15", msg: d.negative === true ? "This is a negative domain: w must be below 0." : "w must be above 0 in this domain." });
  }
  if (!String(s.text || "").trim()) out.push({ field: "text", code: "V12", msg: "The clinician text is required." });
  if (s.type === "scale") {
    const opts = arr(s.options);
    if (opts.length < 2) out.push({ field: "options", code: "V13", msg: "A scale needs at least 2 options." });
    opts.forEach((o, k) => {
      if (!String(o && o.label || "").trim()) out.push({ field: `options/${k}/label`, code: "V13", msg: "Each option needs a label." });
      const f = typeof (o && o.f) === "number" ? o.f : Number(o && o.f);
      if (!Number.isFinite(f) || f < 0 || f > 1) out.push({ field: `options/${k}/f`, code: "V13", msg: "f must be a number from 0 to 1." });
    });
    if (opts.length && !opts.some((o) => Number(o && o.f) === 0)) out.push({ field: "options", code: "V13", msg: "At least one option must have f = 0 (the scale's negative answer)." });
  }
  const en = rubric.locales && rubric.locales.en;
  if (isObj(en) && isObj(en.items)) {
    if (!String(s.q || "").trim()) out.push({ field: "q", code: "V32", msg: "This module has English patient wording, so the new item needs its patient question." });
    if (s.type === "scale") {
      const po = arr(s.patientOpts);
      if (po.length !== arr(s.options).length || po.some((x) => !String(x || "").trim())) out.push({ field: "patientOpts", code: "V32", msg: "Give one patient answer label per option." });
    }
  }
  const lx = s.lexicon || null;
  if (lx && rubric.lexicon) {
    const lists = s.type === "scale" ? [...arr(lx.cue), ...arr(lx.bands).flatMap((b) => arr(b && b.ph))] : arr(lx.ph);
    if (lists.some((p) => String(p) !== String(p).toLowerCase())) out.push({ field: "lexicon", code: "V29", msg: "Phrases are lowercase." });
  }
  return out;
}

/**
 * Add a new item (Add item form) to a copy of the rubric: the item at the end of its domain,
 * its English patient wording when the module has it, and an optional lexicon entry.
 * @returns {Object} the new rubric
 */
export function addItem(rubric, spec) {
  const r = clone(rubric);
  const d = r.domains.find((x) => x.key === spec.domain);
  const item = { id: spec.id, w: Number(spec.w), text: String(spec.text).trim() };
  for (const k of ["short", "ask", "ref", "patientClin"]) if (String(spec[k] || "").trim()) item[k] = String(spec[k]).trim();
  if (spec.type === "scale") item.scale = arr(spec.options).map((o) => ({ label: String(o.label).trim(), f: Number(o.f) }));
  d.items.push(item);
  const en = r.locales && r.locales.en;
  if (isObj(en) && isObj(en.items) && String(spec.q || "").trim()) {
    const w = { q: String(spec.q).trim() };
    if (spec.type === "scale") w.opts = arr(spec.patientOpts).map((x) => String(x).trim());
    en.items[spec.id] = w;
  }
  const lx = spec.lexicon;
  if (lx && isObj(r.lexicon)) {
    const lower = (xs) => arr(xs).map((p) => String(p).trim().toLowerCase()).filter(Boolean);
    if (spec.type === "scale") {
      const cue = lower(lx.cue);
      if (cue.length) {
        const bands = arr(lx.bands).map((b) => ({ ph: lower(b.ph), v: Number(b.v) })).filter((b) => b.ph.length);
        r.lexicon.scale.push({ id: spec.id, cue, bands, fallback: lx.fallback === undefined ? null : lx.fallback });
      }
    } else {
      const ph = lower(lx.ph);
      if (ph.length) r.lexicon.bool.push({ id: spec.id, ph });
    }
  }
  return r;
}

/** Entries that depend on an item (lexicon phrases, sample answers, demo, patient wording). */
export function itemDependents(rubric, id) {
  const out = [];
  const lx = rubric.lexicon;
  if (isObj(lx)) {
    arr(lx.bool).forEach((e, i) => { if (isObj(e) && e.id === id) out.push({ path: `/lexicon/bool/${i}`, what: "lexicon phrases" }); });
    arr(lx.scale).forEach((e, i) => { if (isObj(e) && e.id === id) out.push({ path: `/lexicon/scale/${i}`, what: "lexicon cue and bands" }); });
    arr(lx.multi).forEach((e, i) => {
      if (isObj(e) && arr(e.ids).some((x) => isObj(x) && x.kind === "item" && x.id === id)) out.push({ path: `/lexicon/multi/${i}`, what: "a multi-answer lexicon phrase" });
    });
  }
  arr(rubric.sampleCases).forEach((s, i) => { if (isObj(s) && isObj(s.a) && s.a[id] !== undefined) out.push({ path: `/sampleCases/${i}/a/${ptrEscape(id)}`, what: `the answer in sample case "${s.id}"` }); });
  const locs = isObj(rubric.locales) ? rubric.locales : {};
  for (const loc of Object.keys(locs)) {
    if (isObj(locs[loc]) && isObj(locs[loc].items) && locs[loc].items[id] !== undefined) out.push({ path: `/locales/${ptrEscape(loc)}/items/${ptrEscape(id)}`, what: `patient wording (${loc})` });
  }
  return out;
}

/** Whether an item may be deleted (§5.7): only when the logic does not read it. */
export function canDeleteItem(module, id) {
  return !Object.prototype.hasOwnProperty.call(readsOf(module).items, id);
}

/** Delete an item and every dependent entry; returns the new rubric. */
export function deleteItem(rubric, id) {
  const r = clone(rubric);
  const deps = itemDependents(r, id).filter((d) => !d.path.startsWith("/lexicon/multi/"));
  // Later paths first, so an earlier index in the same list stays valid.
  for (const d of deps.sort((a, b) => (a.path < b.path ? 1 : -1))) setAt(r, d.path, undefined);
  if (isObj(r.lexicon)) {
    r.lexicon.multi = arr(r.lexicon.multi).map((e) => ({ ...e, ids: arr(e.ids).filter((x) => !(x.kind === "item" && x.id === id)) })).filter((e) => e.ids.length);
  }
  for (const d of r.domains) d.items = arr(d.items).filter((it) => !(isObj(it) && it.id === id));
  return r;
}

/** Problems with an Add red flag form (V21, V11, V23, V28). */
export function newFlagProblems(rubric, spec) {
  const out = [];
  const s = spec || {};
  const id = String(s.id || "");
  if (!ID_RE.test(id)) out.push({ field: "id", code: "V11", msg: "The id must match /^[a-z][a-z0-9_]*$/." });
  else if (findId(rubric, id)) out.push({ field: "id", code: "V11", msg: `"${id}" is already used.` });
  if (!["emergent", "urgent"].includes(s.tier)) out.push({ field: "tier", code: "V21", msg: "Choose a tier." });
  for (const k of ["group", "text", "points", "action"]) if (!String(s[k] || "").trim()) out.push({ field: k, code: "V21", msg: `${k} is required.` });
  const en = rubric.locales && rubric.locales.en;
  if (isObj(en) && isObj(en.items)) for (const k of ["q", "say"]) if (!String(s[k] || "").trim()) out.push({ field: k, code: "V23", msg: `English patient ${k} is required.` });
  if (isObj(rubric.lexicon) && !arr(s.cues).map((x) => String(x).trim()).filter(Boolean).length) {
    out.push({ field: "cues", code: "V28", msg: "Every red flag needs at least one cue phrase, or speech can never raise it." });
  }
  return out;
}

/** Add a red flag (behind the safety confirmation in the UI); returns the new rubric. */
export function addFlag(rubric, spec) {
  const r = clone(rubric);
  r.redFlags.push({ id: spec.id, tier: spec.tier, group: String(spec.group).trim(), text: String(spec.text).trim(), points: String(spec.points).trim(), action: String(spec.action).trim() });
  const en = r.locales && r.locales.en;
  if (isObj(en) && isObj(en.items)) {
    if (!isObj(en.redFlags)) en.redFlags = {};
    en.redFlags[spec.id] = { q: String(spec.q || "").trim(), say: String(spec.say || "").trim() };
  }
  if (isObj(r.lexicon)) {
    if (!isObj(r.lexicon.redFlags)) r.lexicon.redFlags = {};
    r.lexicon.redFlags[spec.id] = arr(spec.cues).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  }
  return r;
}

/** Whether a red flag may be deleted, and what goes with it. */
export function flagDeletePlan(module, rubric, id) {
  const reads = readsOf(module);
  const flags = arr(rubric.redFlags);
  if (flags.length <= 1) return { allowed: false, reason: "At least one red flag stays enforced.", removes: [] };
  if (reads.redFlags.includes(id)) return { allowed: false, reason: "This flag is read by the module's logic, so it cannot be deleted.", removes: [] };
  const removes = [];
  if (isObj(rubric.lexicon) && isObj(rubric.lexicon.redFlags) && rubric.lexicon.redFlags[id] !== undefined) removes.push({ path: `/lexicon/redFlags/${ptrEscape(id)}`, what: "its cue phrases" });
  const locs = isObj(rubric.locales) ? rubric.locales : {};
  for (const loc of Object.keys(locs)) if (isObj(locs[loc]) && isObj(locs[loc].redFlags) && locs[loc].redFlags[id] !== undefined) removes.push({ path: `/locales/${ptrEscape(loc)}/redFlags/${ptrEscape(id)}`, what: `patient wording (${loc})` });
  arr(rubric.sampleCases).forEach((s, i) => { if (isObj(s) && isObj(s.rf) && s.rf[id] !== undefined) removes.push({ path: `/sampleCases/${i}/rf/${ptrEscape(id)}`, what: `sample case "${s.id}"` }); });
  const ex = rubric.cds && rubric.cds.examples && rubric.cds.examples.redFlagPresent;
  if (isObj(ex) && ex.flagId === id) return { allowed: false, reason: "The CDS red-flag example names this flag.", removes: [] };
  return { allowed: true, reason: null, removes };
}

/** Delete a red flag with its cue phrases, patient wording and sample references. */
export function deleteFlag(module, rubric, id) {
  const plan = flagDeletePlan(module, rubric, id);
  if (!plan.allowed) throw new Error(plan.reason);
  const r = clone(rubric);
  for (const d of plan.removes) setAt(r, d.path, undefined);
  r.redFlags = r.redFlags.filter((f) => f.id !== id);
  return r;
}

/**
 * Create lexicon (§5.7): lang "en-US", the negation, third-party and historical cue lists and
 * windows copied verbatim from a built-in's lexicon, empty item lists, one empty phrase list
 * per flag, goldSet null. The version is set in the Apply dialog.
 */
export function createLexicon(rubric, fromLexicon) {
  if (!isObj(fromLexicon)) throw new Error("Create lexicon needs a built-in lexicon to copy the cue lists from.");
  const r = clone(rubric);
  const lex = { version: "0.1", lang: "en-US" };
  for (const k of ["negation", "thirdParty", "historical"]) lex[k] = clone(fromLexicon[k]);
  lex.bool = []; lex.ctx = []; lex.scale = []; lex.multi = [];
  lex.redFlags = {};
  for (const f of arr(r.redFlags)) if (isObj(f)) lex.redFlags[f.id] = [];
  lex.goldSet = null;
  r.lexicon = lex;
  return r;
}

/**
 * Create English patient wording (§5.7): the `en` locale with reviewed:false and
 * editedLocally:true and empty item and flag maps; the editor offers one row per item and
 * flag, and V23 / V32 list what is still missing.
 */
export function createEnglishPatientWording(rubric) {
  const r = clone(rubric);
  if (!isObj(r.locales)) r.locales = {};
  r.locales.en = { reviewed: false, editedLocally: true, items: {}, redFlags: {} };
  return r;
}

// ------------------------------------------------------------------ impact preview (§5.7)

/** The cases the impact preview runs: the module's sample cases, else empty, all-yes and all-no. */
export function impactCases(module) {
  const cases = arr(module.sampleCases).filter(isObj).map((s) => ({
    id: s.id, label: s.label || s.buttonLabel || s.id, a: { ...(s.a || {}) }, ctx: { ...(s.ctx || {}) },
    rf: { ...(s.rf || {}) }, complaint: typeof s.complaint === "string" ? s.complaint : "",
    safetyReviewed: s.safetyReviewed !== false,
  }));
  if (cases.length) return cases;
  const yes = {}, no = {};
  for (const it of arr(module.allItems)) {
    if (Array.isArray(it.scale)) { yes[it.id] = it.scale.length - 1; no[it.id] = 0; }
    else { yes[it.id] = "yes"; no[it.id] = "no"; }
  }
  return [
    { id: "__empty", label: "Empty screen", a: {}, ctx: {}, rf: {}, complaint: "", safetyReviewed: true },
    { id: "__all_yes", label: "All yes / highest option", a: yes, ctx: {}, rf: {}, complaint: "", safetyReviewed: true },
    { id: "__all_no", label: "All no / lowest option", a: no, ctx: {}, rf: {}, complaint: "", safetyReviewed: true },
  ];
}

/** A current Screener or Scribe snapshot (§5.1 session) as an impact case. */
export function caseFromSnapshot(module, snap, label) {
  const points = new Set(arr(snap && snap.redFlags));
  const rf = {};
  for (const f of arr(module.redFlags)) if (points.has(f.points)) rf[f.id] = true;
  return {
    id: `__screen_${snap.source}`, label, a: { ...(snap.answers || {}) }, ctx: { ...(snap.ctx || {}) }, rf,
    complaint: typeof snap.phenotype === "string" ? snap.phenotype : "", safetyReviewed: snap.safetyReviewed !== false, current: true,
  };
}

function patientLocales(module) {
  const L = isObj(module.locales) ? module.locales : {};
  const en = L.en && L.en.data;
  if (!(en && isObj(en.items) && Object.keys(en.items).length)) return [];
  return Object.keys(L);
}

/**
 * One impact row for one module and case: total, floor–ceiling, band; routing recs per
 * surface as {id, h}; gap alert; the patient summary's said/ask sentences per locale.
 */
export function impactRow(module, kase) {
  const out = { total: null, floor: null, ceiling: null, band: null, recs: { screener: [], scribe: [] }, gap: false, patient: {}, errors: [] };
  try {
    const score = computeScore(module, kase.a);
    Object.assign(out, { total: score.total, floor: score.floor, ceiling: score.ceiling, band: score.band, scorable: score.scorable });
    const flags = Object.keys(kase.rf || {}).filter((k) => kase.rf[k]);
    const sc = buildRoutingState(module, { surface: "screener", answers: kase.a, ctx: kase.ctx, complaint: kase.complaint, score, activeFlags: flags, safetyReviewed: kase.safetyReviewed });
    out.recs.screener = routingRecs(module, sc).recs.map((r) => ({ id: r.id, h: r.h }));
    const ph = derivePhenotype(module, kase.a);
    const sb = buildRoutingState(module, { surface: "scribe", answers: kase.a, ctx: kase.ctx, complaint: ph.value, phenotypeError: ph.error, score, activeFlags: flags, safetyReviewed: kase.safetyReviewed });
    out.recs.scribe = routingRecs(module, sb).recs.map((r) => ({ id: r.id, h: r.h }));
    out.gap = gapSignals(module, kase.ctx).alert;
  } catch (err) {
    out.errors.push(String(err && err.message ? err.message : err));
  }
  const locs = patientLocales(module);
  if (locs.length) {
    const view = projectForPatient(module);
    for (const loc of locs) {
      try {
        const r = buildPatientSummary(view, loc, { a: kase.a, ctx: {}, flags: kase.rf || {} });
        out.patient[loc] = r.summary ? { said: r.summary.said.slice(), ask: r.summary.ask.slice() } : { said: [], ask: [], error: r.error && r.error.message };
      } catch (err) {
        out.patient[loc] = { said: [], ask: [], error: String(err && err.message ? err.message : err) };
      }
    }
  }
  return out;
}

/**
 * The sentences or headings one closure contributes to a case (the acknowledgement panel's
 * "these rules produce …"): a `routing:<id>` closure → the rule's rendered heading on each
 * surface where it fires; a `summary.said:<id>` / `summary.ask:<id>` closure → that rule's
 * patient sentence per locale (null when it does not fire).
 */
export function closureOutput(module, closureId, kase) {
  const p = parseClosureId(closureId);
  if (!p.rule) return null;
  if (p.family === "routing") {
    const row = impactRow(module, kase);
    const out = {};
    for (const s of ["screener", "scribe"]) {
      const hit = row.recs[s].find((r) => r.id === p.rule);
      if (hit) out[s] = hit.h;
    }
    return Object.keys(out).length ? { kind: "routing", rule: p.rule, headings: out } : null;
  }
  if (p.family === "summary.said" || p.family === "summary.ask") {
    const locs = patientLocales(module);
    if (!locs.length) return null;
    const view = projectForPatient(module);
    const ps = view.summaryLogic;
    if (!isObj(ps)) return null;
    const list = p.family === "summary.said" ? arr(ps.said) : arr(ps.ask);
    const rule = list.find((r) => r && r.id === p.rule);
    if (!rule) return null;
    const one = { ...view, summaryLogic: { ...ps, said: p.family === "summary.said" ? [rule] : [], ask: p.family === "summary.ask" ? [rule] : [] } };
    const sentences = {};
    for (const loc of locs) {
      try {
        const r = buildPatientSummary(one, loc, { a: kase.a, ctx: {}, flags: kase.rf || {} });
        const xs = r.summary ? (p.family === "summary.said" ? r.summary.said : r.summary.ask) : [];
        if (xs.length) sentences[loc] = xs[0];
      } catch (_) { /* a throwing rule shows nothing here; validation reports it */ }
    }
    return Object.keys(sentences).length ? { kind: "summary", rule: p.rule, sentences } : null;
  }
  return null;
}
