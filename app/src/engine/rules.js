// engine/rules.js — routing, phenotype, activation, gap signals, referral and CDS preview
// (design 03 §3.3, §4.5). Owner: WP3.
//
// The gates run first and are engine-owned: an open red flag withholds routing, an
// unsettled index issues no result, the Scribe routes nothing before the safety review, and
// a module rule that throws withholds routing behind an engine error card (D6). Only then
// are the module's routing rules evaluated. The safety-critical sentences below are moved
// verbatim from the baseline Screener (override and incomplete cards, CDS safety card); the
// module supplies only the noun-phrase slots ({gate.patternPhrase}, {indexName}).
//
// Every state handed to a module closure is a fresh object, deep-frozen. Pure; no React.
import { BANDS, HIGHEST_BAND, LOWEST_BAND } from "./vocab.js";
import { evaluateRules, renderTpl } from "./evaluate.js";
import { computeScore } from "./scoring.js";

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
/** An own entry of a lookup table, never an inherited property ("toString", "__proto__"). */
const ownEntry = (table, key) => (isObj(table) && typeof key === "string" && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined);
/**
 * Whether `complaint` is one of the module's declared phenotype values (decision F11). The
 * referral and the CDS index card key on the complaint; one nobody entered ("" included) or
 * one the module does not declare is never resolved through the default.
 */
export function isDeclaredPhenotype(module, complaint) {
  const values = module && module.phenotypes && Array.isArray(module.phenotypes.values) ? module.phenotypes.values : [];
  return typeof complaint === "string" && complaint !== "" && values.some(v => isObj(v) && v.value === complaint);
}
const arr = (x) => (Array.isArray(x) ? x : []);

function freeze(x) {
  if (x === null || typeof x !== "object" || Object.isFrozen(x)) return x;
  for (const k of Object.keys(x)) freeze(x[k]);
  return Object.freeze(x);
}

function plainCopy(x) {
  if (Array.isArray(x)) return x.map(plainCopy);
  if (isObj(x)) {
    const out = {};
    for (const k of Object.keys(x)) out[k] = plainCopy(x[k]);
    return out;
  }
  return x;
}

/** Answers as closures see them: unanswered keys absent, "unsure" never present. */
function normalisedAnswers(answers) {
  const out = {};
  if (!isObj(answers)) return out;
  for (const k of Object.keys(answers)) {
    const v = answers[k];
    if (v === undefined || v === "unsure") continue;
    out[k] = v;
  }
  return out;
}

function definedOnly(obj) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/** The predicate helpers every closure state carries (F5: isAnswered is the per-item helper). */
export function stateHelpers(answers) {
  return {
    yes: (id) => answers[id] === "yes",
    no: (id) => answers[id] === "no",
    isAnswered: (id) => answers[id] !== undefined,
    scale: (id) => (typeof answers[id] === "number" ? answers[id] : null),
  };
}

function flagRecord(f) {
  return { id: f.id, tier: f.tier, group: f.group, text: f.text, points: f.points, action: f.action };
}

/** Active flags as {id,tier,group,text,points,action}, in rubric order. Accepts flag objects, ids, or an rf map. */
export function activeFlagsOf(module, active) {
  if (isObj(active)) return module.redFlags.filter(f => active[f.id]).map(flagRecord);
  const out = [];
  for (const f of arr(active)) {
    const flag = typeof f === "string" ? module.flagById[f] : f;
    if (flag) out.push(flagRecord(flag));
  }
  return out;
}

/** domain key → {label, max, negative, items} from the rubric (Scr L944 `ITEMS.<key>.items`). */
function domainItems(module) {
  const out = {};
  for (const d of module.domains) {
    out[d.key] = { label: d.label, max: d.max, negative: !!d.negative, items: plainCopy(d.items) };
  }
  return out;
}

/**
 * The state routing closures receive (§3.3, F5), frozen.
 * `answered` is the numeric count of answered items (as in computeScore); the per-item
 * predicate is `isAnswered(id)`.
 */
export function buildRoutingState(module, {
  surface, answers = {}, ctx = {}, complaint = "", phenotypeError = null, score = null, activeFlags = [], safetyReviewed = false,
} = {}) {
  const a = normalisedAnswers(answers);
  const sc = score || computeScore(module, a);
  const flags = activeFlagsOf(module, activeFlags);
  const override = flags.length > 0;
  const state = {
    surface,
    answers: a,
    ctx: definedOnly(ctx),
    complaint: typeof complaint === "string" ? complaint : "",
    phenotypeError: phenotypeError || null,
    band: sc.band,
    total: sc.total,
    floor: sc.floor,
    ceiling: sc.ceiling,
    coverage: sc.coverage,
    scorable: sc.scorable,
    answered: sc.answered,
    count: sc.count,
    domains: plainCopy(sc.domains),
    items: domainItems(module),
    activeFlags: flags,
    override,
    emergent: flags.some(f => f.tier === "emergent"),
    routingCleared: !override && !!safetyReviewed,
    lowestBand: LOWEST_BAND,
    highestBand: HIGHEST_BAND,
    scaleMax: module.scaleMax,
    ...stateHelpers(a),
  };
  return freeze(state);
}

/** The copy variables every engine sentence and module template may use (§3.6). */
export function copyVars(module) {
  return {
    name: module.name,
    id: module.id,
    instrument: module.instrumentVersion,
    scaleMax: module.scaleMax,
    indexName: module.copy && module.copy.indexName,
  };
}

function slot(module, path) {
  let v = module.copy;
  for (const k of path.split(".")) v = isObj(v) ? v[k] : undefined;
  return typeof v === "string" ? renderTpl(v, null, copyVars(module)) : "";
}

// ---- engine-owned cards (Scr L895-913 verbatim, slots filled; D6 error card) ----

function overrideCard(module, state) {
  return {
    id: "engine:override",
    h: `Red flag present — screening routing withheld (${state.emergent ? "emergent" : "urgent"})`,
    p: `One or more findings need evaluation on their own terms before this presentation is treated as a ${slot(module, "gate.patternPhrase")}. `
     + `The ${slot(module, "indexName")} below is retained for the record but issues no referral, no CDS prompt, and no reassurance while this is open.`,
    chips: state.activeFlags.map(f => f.action),
  };
}

function incompleteCard(module, state) {
  const { answered, floor, ceiling, domains } = state;
  return {
    id: "engine:incomplete",
    h: "Screen incomplete — no result issued",
    p: `The ${answered} answered item${answered === 1 ? "" : "s"} place the index between ${floor} and ${ceiling}/${module.scaleMax}, which spans more than one band. `
     + `Complete the outstanding items before acting on this screen — an unfinished screen is not a negative screen, and no rule-out is implied.`,
    chips: module.domainOrder.filter(k => domains[k].openPts > 0)
      .map(k => `${domains[k].label} · ${domains[k].openPts} pts unanswered`),
  };
}

/** The engine rule-error card (D6, §3.6). */
export function ruleErrorCard(module, error) {
  return {
    id: "engine:rule-error",
    h: "Module rule error — no routing issued",
    p: `Rule "${error.ruleId}" in module ${module.id} failed (${error.message}). Routing is withheld rather than issued from a partial rule set; the index is unaffected.`,
    chips: [],
  };
}

function noRoutingCard() {
  return {
    id: "engine:no-routing",
    h: "No routing rules in this module",
    p: "This module defines no routing rules, so no next step is suggested from the index.",
    chips: [],
  };
}

function messageOf(err) {
  return err && typeof err.message === "string" && err.message ? err.message : String(err);
}

function renderRec(module, rule, surface, state) {
  const c = rule.copy[surface];
  const vars = copyVars(module);
  const h = renderTpl(c.h, state, vars);
  const p = renderTpl(c.p, state, vars);
  const chips = renderTpl(c.chips, state, vars);
  return { id: rule.id, h: String(h), p: String(p), chips: Array.isArray(chips) ? chips.map(String) : [] };
}

/**
 * Routing recommendations for one surface (§4.5). Engine order:
 *  1 override → screener [withheld card], scribe []                       gate "override"
 *  2 not scorable → screener [incomplete card], scribe []                 gate "incomplete"
 *  3 scribe without routingCleared → []                                   gate "uncleared"
 *  4 phenotype-derivation error → [rule-error card] on both surfaces       gate "error"
 *  5 module routing rules; a throw (in `when` or in function copy) →
 *    [rule-error card] on both surfaces                                    gate "error"
 *  6 nothing fired on the screener of a module with no routing rules → the engine card.
 * `error` is the RoutingError every consumer takes as `routingError`: the phenotype error
 * whatever the gate, otherwise the rule error of step 5.
 * @returns {{recs: Array<{id,h,p,chips}>, gate: (null|"override"|"incomplete"|"uncleared"|"error"), error: (null|Object)}}
 */
export function routingRecs(module, state) {
  const surface = state.surface;
  const phenoErr = state.phenotypeError || null;
  if (state.override) return { recs: surface === "screener" ? [overrideCard(module, state)] : [], gate: "override", error: phenoErr };
  if (!state.scorable) return { recs: surface === "screener" ? [incompleteCard(module, state)] : [], gate: "incomplete", error: phenoErr };
  if (surface === "scribe" && !state.routingCleared) return { recs: [], gate: "uncleared", error: phenoErr };
  if (phenoErr) return { recs: [ruleErrorCard(module, phenoErr)], gate: "error", error: phenoErr };

  const rules = arr(module.logic && module.logic.routing);
  const { fired, error } = evaluateRules(rules, state, { surface });
  if (error) {
    const e = { family: "routing", ruleId: error.ruleId, message: error.message };
    return { recs: [ruleErrorCard(module, e)], gate: "error", error: e };
  }
  const recs = [];
  for (const rule of fired) {
    try {
      recs.push(renderRec(module, rule, surface, state));
    } catch (err) {
      const e = { family: "routing", ruleId: rule.id, message: messageOf(err) };
      return { recs: [ruleErrorCard(module, e)], gate: "error", error: e };
    }
  }
  if (!recs.length && surface === "screener" && rules.length === 0) recs.push(noRoutingCard());
  return { recs, gate: null, error: null };
}

/** The state phenotype-derivation closures receive (§3.3, F5), frozen. */
export function buildPhenotypeState(module, answers) {
  const a = normalisedAnswers(answers);
  return freeze({ answers: a, ...stateHelpers(a) });
}

function deriveRuleId(rule, index) {
  if (rule && typeof rule.id === "string" && rule.id) return rule.id;
  return rule && typeof rule.value === "string" ? `derive:${rule.value}` : `derive:#${index}`;
}

/**
 * The complaint (phenotype value) derived from the answers (§4.5): the first matching derive
 * rule; none → phenotypes.scribeDefault; no phenotypes → "". A throw gives {value: "", error}
 * — "" is for display and the cohort row only; the caller passes `error` on as
 * phenotypeError, which withholds routing (§3.3).
 * @returns {{value: string, error: (null|{family:"phenotype", ruleId:string, message:string})}}
 */
export function derivePhenotype(module, answers) {
  if (!module.phenotypes) return { value: "", error: null };
  const fallback = typeof module.phenotypes.scribeDefault === "string" ? module.phenotypes.scribeDefault : "";
  const rules = arr(module.logic && module.logic.phenotypes && module.logic.phenotypes.derive);
  if (!rules.length) return { value: fallback, error: null };
  const state = buildPhenotypeState(module, answers);
  const { fired, error } = evaluateRules(rules, state, { mode: "first" });
  if (error) {
    return { value: "", error: { family: "phenotype", ruleId: deriveRuleId(rules[error.index], error.index), message: error.message } };
  }
  return { value: fired.length && typeof fired[0].value === "string" ? fired[0].value : fallback, error: null };
}

/** The state activation closures receive (§3.3, F5), frozen. */
export function buildActivationState(module, { answers = {}, complaint = "" } = {}) {
  const a = normalisedAnswers(answers);
  return freeze({ answers: a, complaint: typeof complaint === "string" ? complaint : "", ...stateHelpers(a) });
}

/**
 * The domains active for the Scribe suggestion pool (§4.5): phenotypes.alwaysActive (default
 * every domain) plus the domains of each firing activation rule. A phenotypeError or an
 * activation error gives every domain (a superset is safe: the pool only widens).
 * @returns {{domains: Set<string>, error: (null|{family:"activation", ruleId:string, message:string})}}
 */
export function activeDomains(module, { answers = {}, complaint = "", phenotypeError = null } = {}) {
  const all = module.domainOrder.slice();
  if (phenotypeError || !module.phenotypes) return { domains: new Set(all), error: null };
  const always = Array.isArray(module.phenotypes.alwaysActive) ? module.phenotypes.alwaysActive : all;
  const rules = arr(module.logic && module.logic.phenotypes && module.logic.phenotypes.activation);
  const out = new Set(always);
  if (!rules.length) return { domains: out, error: null };
  const state = buildActivationState(module, { answers, complaint });
  const { fired, error } = evaluateRules(rules, state);
  if (error) return { domains: new Set(all), error: { family: "activation", ruleId: error.ruleId, message: error.message } };
  for (const r of fired) for (const k of arr(r.domains)) out.add(k);
  return { domains: out, error: null };
}

/**
 * The gap-rule markers present in a context answer set (§4.5). Works for both vocabularies
 * (the signal values are identical in the clinician and Patient sets).
 *   hits       markers that are present, in contextItems order (Scr L873-877)
 *   flags      one boolean per marker, in gapRule.markers order (Pat L957; sum.gap's arguments)
 *   noteLabels note labels of the hits, in gapRule.noteOrder (Scb L1345-1349)
 * Without a gap rule nothing is ever flagged.
 */
export function gapSignals(module, ctx) {
  const c = isObj(ctx) ? ctx : {};
  const rule = module.gapRule;
  if (!rule) return { hits: [], count: 0, alert: false, flags: [], noteLabels: [] };
  const markers = arr(rule.markers);
  const byId = {};
  for (const ci of module.contextItems) byId[ci.id] = ci;
  const isHit = (id) => {
    const ci = byId[id];
    return !!(ci && ci.signal && c[id] !== undefined && c[id] === ci.signal.value);
  };
  const hits = module.contextItems
    .filter(ci => markers.includes(ci.id) && isHit(ci.id))
    .map(ci => ({ id: ci.id, value: ci.signal.value, screenerLabel: ci.signal.screenerLabel, scribeLabel: ci.signal.scribeLabel, noteLabel: ci.signal.noteLabel }));
  const flags = markers.map(isHit);
  const order = Array.isArray(rule.noteOrder) ? rule.noteOrder : markers;
  const noteLabels = order.filter(isHit).map(id => byId[id].signal.noteLabel);
  return { hits, count: hits.length, alert: hits.length >= rule.threshold, flags, noteLabels };
}

/**
 * The referral a settled screen proposes (§4.5): null when routingError is set, the module
 * has no referral table, or the complaint is not a declared phenotype value ("" included,
 * decision F11, AD15); otherwise the own entry byPhenotype[complaint] ?? default. Callers still
 * apply referralGate.
 */
export function referralFor(module, complaint, { routingError = null } = {}) {
  if (routingError) return null;
  const ref = module.phenotypes && module.phenotypes.referral;
  if (!ref) return null;
  if (!isDeclaredPhenotype(module, complaint)) return null;
  const hit = ownEntry(ref.byPhenotype, complaint) || ref.default;
  return hit ? { specialty: hit.specialty, reason: hit.reason } : null;
}

/** Screener band labels (Scr L866-869), used for {bandLabel} unless the caller passes one. */
const BAND_LABEL = { low: "Low likelihood", moderate: "Moderate likelihood", high: "High likelihood" };

/**
 * The CDS Hooks preview cards (§4.5, Scr L1329-1349). The safety card pre-empts the index
 * card whatever routingError says; the index card needs no override, no routing error (the
 * routingError argument or the state's own phenotypeError), a
 * scorable non-lowest band, an index title and body, and a resolvable CDS term.
 * @returns {{safety: (null|{src,title,body}), index: (null|{src,title,body})}}
 */
export function cdsPreview(module, state, { routingError = null, bandLabel = null } = {}) {
  const vars = copyVars(module);
  const preview = (module.copy && module.copy.cds && module.copy.cds.preview) || {};
  if (state.override) {
    return {
      safety: {
        src: `CDS Hooks card · ${state.emergent ? "critical" : "warning"} · order-select`,
        title: typeof preview.safetyTitle === "string" ? renderTpl(preview.safetyTitle, null, vars) : "",
        body: `${state.activeFlags.map(f => f.action).join(" · ")}. The screening index is withheld from routing.`,
      },
      index: null,
    };
  }
  // Fail closed (§3.3, D6): the RoutingState's own phenotypeError withholds the index card
  // even when the caller omits routingError.
  const err = routingError || state.phenotypeError || null;
  if (err || !state.scorable || state.band === LOWEST_BAND || !BANDS.includes(state.band)) return { safety: null, index: null };
  if (typeof preview.indexTitle !== "string" || typeof preview.indexBody !== "string") return { safety: null, index: null };
  // No index card for a complaint nobody entered or the module does not declare (F11, AD15):
  // the default term would name a phenotype the clinician never chose.
  if (!isDeclaredPhenotype(module, state.complaint)) return { safety: null, index: null };
  const term = module.phenotypes && module.phenotypes.cdsTerm;
  const cdsTerm = term ? (ownEntry(term.byPhenotype, state.complaint) || term.default) : null;
  if (typeof cdsTerm !== "string" || !cdsTerm) return { safety: null, index: null };
  return {
    safety: null,
    index: {
      src: "CDS Hooks card · order-select",
      title: renderTpl(preview.indexTitle, null, { ...vars, cdsTerm }),
      body: renderTpl(preview.indexBody, null, { ...vars, total: state.total, scaleMax: module.scaleMax, bandLabel: bandLabel || BAND_LABEL[state.band] }),
    },
  };
}
