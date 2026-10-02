// engine/probes.js — live-probe selection, probe-set validation and rail truncation
// (design 03 §4.10). Owner: WP5.
//
// The probe list is module content (logic.probes.list, §3.3) and is injected; the rules
// that keep it honest are engine rules and live here, so no module can opt out of them:
//
//   - A probe of kind "rescue" re-asks an item whose first answer may be a false negative.
//     It names that item with `rescues`, never with `target`, and is never retired through
//     a target: retiring it on its own item's answer would let the very answer it exists to
//     correct silently disable it. It retires only when answered (or when its own `when`
//     turns false).
//   - A kind whose PROBE_KIND entry says mayWrite === false (the supporting / phenotype
//     kind) records notes only: an option that writes an item is a validation error.
//   - Membership checks (target, rescues, written items, raised flags) always run.
//
// liveProbes and validateProbes are Prb L301-345 with the list passed in; truncateProbes is
// the Scribe rail's grouping and slicing (Scb L1152-1162). Pure; no React; no console output;
// no import-time side effects.
import { PROBE_KIND, PROBE_KIND_ORDER } from "./vocab.js";

const arr = (x) => (Array.isArray(x) ? x : []);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const RESCUE = "rescue";

/** The list itself, or the list of a `{version, list}` probe set; anything else is empty. */
function listOf(probes) {
  if (Array.isArray(probes)) return probes;
  if (isObj(probes) && Array.isArray(probes.list)) return probes.list;
  return [];
}

function freezeCopy(x) {
  if (Array.isArray(x)) return Object.freeze(x.map(freezeCopy));
  if (isObj(x)) {
    const out = {};
    for (const k of Object.keys(x)) out[k] = freezeCopy(x[k]);
    return Object.freeze(out);
  }
  return x;
}

const rankOf = (kind) => (Object.prototype.hasOwnProperty.call(PROBE_KIND, kind) ? PROBE_KIND[kind].rank : PROBE_KIND_ORDER.length);

/**
 * The probes to show now, most urgent kind first (Prb L301-307).
 *   - `when(answers, redFlags)` is called with frozen copies. A `when` that throws keeps the
 *     probe in the list (a safety question surfacing is the safe direction) and reports
 *     onError(probeId, err); it never throws to the caller.
 *   - A probe answered in `answered` (probe id → option index) is retired.
 *   - A non-rescue probe whose `target` item is answered is retired; a rescue never is.
 * The sort is stable, so list order holds within a kind.
 * @param {Array|{list:Array}} probes   logic.probes.list
 * @returns {Object[]} the probe objects themselves
 */
export function liveProbes(probes, answers = {}, redFlags = {}, answered = {}, { onError } = {}) {
  const a = isObj(answers) ? answers : {};
  const rf = isObj(redFlags) ? redFlags : {};
  const done = isObj(answered) ? answered : {};
  const fa = freezeCopy(a);
  const frf = freezeCopy(rf);
  return listOf(probes)
    .filter(p => {
      let on;
      try {
        on = p.when(fa, frf);
      } catch (err) {
        if (typeof onError === "function") { try { onError(p && p.id, err); } catch { /* reporter must not break selection */ } }
        return true;
      }
      return !!on;
    })
    .filter(p => done[p.id] === undefined)
    .filter(p => p.kind === RESCUE || !(p.target && a[p.target] !== undefined))
    .sort((x, y) => rankOf(x.kind) - rankOf(y.kind));
}

/**
 * Referential integrity and the engine's probe rules (Prb L322-345 plus §4.10). Returns the
 * error strings; [] means valid. Never logs.
 * @param {Array|{list:Array}} probes   logic.probes.list
 * @param {string[]} itemIds            scored item ids of the rubric
 * @param {string[]} flagIds            red-flag ids of the rubric
 */
export function validateProbes(probes, itemIds = [], flagIds = []) {
  const items = new Set(arr(itemIds)), flags = new Set(arr(flagIds));
  const errs = [];
  if (probes !== undefined && probes !== null && !Array.isArray(probes) && !(isObj(probes) && Array.isArray(probes.list))) {
    errs.push("probe list is not an array");
    return errs;
  }
  const seen = new Set();
  for (const p of listOf(probes)) {
    if (!isObj(p)) { errs.push("probe entry is not an object"); continue; }
    if (seen.has(p.id)) errs.push(`duplicate probe id ${p.id}`);
    seen.add(p.id);
    const kind = Object.prototype.hasOwnProperty.call(PROBE_KIND, p.kind) ? PROBE_KIND[p.kind] : null;
    if (!kind) errs.push(`${p.id}: unknown kind ${p.kind}`);
    if (typeof p.when !== "function") errs.push(`${p.id}: no trigger`);
    if (!p.say || !p.why) errs.push(`${p.id}: missing wording or rationale`);
    if (!p.opts?.length) errs.push(`${p.id}: no options`);
    if (p.target && !items.has(p.target)) errs.push(`${p.id}: target ${p.target} not in instrument`);
    if (p.rescues && !items.has(p.rescues)) errs.push(`${p.id}: rescues ${p.rescues} not in instrument`);
    if (p.kind === RESCUE) {
      if (!p.rescues) errs.push(`${p.id}: rescue probe names no item to re-ask (rescues)`);
      if (p.target !== undefined) errs.push(`${p.id}: rescue probe carries a target (${p.target}) — a rescue names its item with rescues and is never retired through a target`);
    } else if (p.rescues !== undefined) {
      errs.push(`${p.id}: rescues ${p.rescues} on a ${p.kind} probe — only rescue probes re-ask an item`);
    }
    for (const o of arr(p.opts)) {
      if (!isObj(o)) { errs.push(`${p.id}: option is not an object`); continue; }
      if (o.rf && !flags.has(o.rf)) errs.push(`${p.id}: raises unknown red flag ${o.rf}`);
      for (const k of Object.keys(isObj(o.a) ? o.a : {})) {
        if (!items.has(k)) errs.push(`${p.id}: writes to unknown item ${k}`);
        if (kind && kind.mayWrite === false) errs.push(`${p.id}: ${p.kind} probe writes to scored item ${k} — supporting features must not score`);
      }
    }
  }
  return errs;
}

/**
 * The Scribe rail's groups (Scb L1152-1162): one entry per kind that has live probes, in
 * PROBE_KIND_ORDER; kinds with `truncate` show their first two, the rest show all.
 * Probes of a kind outside PROBE_KIND_ORDER are not shown (validateProbes reports them).
 * @param {Object[]} live  the liveProbes result
 * @returns {Array<{kind:string, shown:Object[], total:number}>}
 */
export function truncateProbes(live) {
  const list = arr(live);
  const out = [];
  for (const kind of PROBE_KIND_ORDER) {
    const grp = list.filter(x => x && x.kind === kind);
    if (!grp.length) continue;
    const shown = PROBE_KIND[kind].truncate ? grp.slice(0, 2) : grp;
    out.push({ kind, shown, total: grp.length });
  }
  return out;
}
