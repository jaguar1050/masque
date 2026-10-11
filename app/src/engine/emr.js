// engine/emr.js — the EMR friendly consult-note template of the clinician surfaces (release 0.4.3).
//
// buildEmrTemplate(module, state, {surface}) returns plain text (LF line endings, no markdown) for
// pasting into an EMR: a pre-populated, unformatted consult note whose patient-specific fields are
// [bracketed] placeholders. Every line is one of:
//   - an engine sentence the encounter note, the bundle or the Screener already prints, copied here
//     verbatim (buildNote and buildBundle are neither changed nor called; the source is named at
//     each constant);
//   - module text read from `module` at run time (items, red flags, phenotypes, context items, copy
//     slots, routing recs, probe options), moved verbatim;
//   - module emrTemplate data (validator V61): citations printed as metadata and a link only,
//     short labels that carry citation keys, and every id-bearing rule (flag → citations, checklist
//     signals keyed by item or probe id, phenotype → reference selection, exam rows tied to probes);
//   - a structural label or a [placeholder] of this file.
// A module without emrTemplate gets the neutral template: placeholders, the screen result, the
// red-flag module actions and the routing recs; no references and no checklist.
//
// Gates are the bundle's: with no red flag open the referral line is printed only when
// referralGate opens (then in the bundle's own words, "Referral: <specialty> — evaluate for
// <reason>"), otherwise the engine sentence of the gate that closed it, or "Referral: [clinician
// decision]" at the lowest band. Release 0.4.5: wherever the plan prints a referral line or that
// placeholder, the module's clinician rules for the picture (phenotypes.referral.clinicianRules)
// print right above the recommendations: the rule, its definition lines and its clarification
// lines, each verbatim under its source, and a [ ] placeholder for each condition the clinician
// confirms. They are printed for the clinician to apply; they never change the referral line,
// which stays the bundle's.
// Open red flags come first in the plan, one module action per flag with its "Ref:" lines
// (background reading, said so once, never the source of the action or its timing) and its data
// placeholder, then the workup placeholder and the bundle's routing-withheld line. Release 0.4.6
// (the clinical lead's reading of "also", 2026-10-10): under them the plan also prints the
// screen-based referral block and the empiric-treatment references exactly as it would with no
// flag open (the referral line, or the clinician placeholder or the engine sentence of the gate
// that would close it, the consultant lines, the clinician rules; references only where the gate
// would open), headed by a line saying that the FHIR bundle withholds the referral while a red
// flag is open (the bundle never carries the references; release 0.4.6 review round 1). That is the one place the note and the bundle differ: the bundle, the routing
// recommendations and the band headline still follow the override. The management checklist is
// history, not routing, and stays in every state.
//
// Absent data is never negative: an unanswered or "unsure" item reads "not recorded", never "no";
// a skipped probe writes nothing; a deferred exam probe keeps its [ ] placeholder and is labelled
// "(recorded by clinician via probe: <its option label>)", never as a finding; no checklist box is
// ticked from missing data, and a key line under the checklist heading says that an unticked row
// is not recorded, not confirmed as not offered; no exam finding is pre-filled, and a probe answer
// the clinician recorded is labelled as recorded: an item a probe wrote carries that label too,
// in the treatment-and-workup rows, in the review of systems and in the checklist (round 3). A
// negative answer of a history row may carry the data's qualifier (for example that testing is not
// recorded) when no probe wrote it. A domain with no answered item reads "not answered", never
// zero points, and a partly answered one carries its denominator (round 3). A checklist signal
// whose polarity contradicts its render (a negative answer as done or context, a positive one as
// answered no, an item as never tried) is skipped, so data that bypassed validation (V61) still
// fails closed. Under open flags on the Scribe, an unrecorded review is said (round 3): the flags
// listed are the ones raised, not the result of a completed review.
// A synthetic (demo) patient is never copied into the text: the identity line is a placeholder.
// On the Scribe the presenting picture is a placeholder, followed by the module rule's category
// only when a derive rule fired (never the default picture), and an open referral says which
// computed picture its destination follows (round 3). The module's gap line prints only when every
// gap marker hit; a rule that fired on fewer prints the encounter note's context line instead
// (round 3). The citations of the exam rows and the checklist share one numbering, by first use,
// and are listed once after the plan as metadata and a link only; each row names its own sources
// by those numbers ("(sources 1, 3)").
// Placeholders use square brackets only (curly braces are template syntax), so routing chips never
// sit in brackets: chips a routing rule computes from the answers are not repeated (those answers
// are in the note), whatever the data lists; the fixed chips of a rule the data lists in
// instrumentRecs print as "Instruments: a; b", other fixed chips as "Named on screen: a; b". The
// text opens and closes with CAVEATS.prototype; the index, the band headline and the referral
// reason carry CAVEATS.illustrative; the version axes stay separate in the footer line (the
// Screener prints the release and the instrument, the Scribe all five: with lexicon, probe set and
// gold set). No criteria list is assembled: an item's criterion ref is never printed (the items
// themselves are in the review of systems).
// Release 0.4.6 (the clinical lead, 2026-10-10): the assessment names the headings of the routing
// recommendations the plan prints ("Considerations: a; b"); the data's past-history rows
// (emrTemplate.pastHistory: a placeholder heading, or an item with its recorded state) print in the
// past-history section, a "medical" row after the pregnancy line and a "family" row before the
// family-history placeholder, which then reads "Other family history: [ ]"; an item listed there
// leaves the review of systems; and an exam row's optionPlaceholders put a [placeholder] under the
// row when its probe was answered with that option.
//
// Characters: module text is moved verbatim (≥, en and em dashes, accented letters); the structure
// this file generates (bullets, separators, joiners) is ASCII "-", ":" and "|", apart from the
// verbatim engine sentences and the headings the implementation spec gives verbatim. Some legacy
// EMRs mangle non-ASCII characters on paste; module text is still never ASCII-folded (decision D11).
//
// Pure: no React, no clock (the date of service is a placeholder), no side effects at import time.
// Names no module, item, flag, context id or phenotype value (t-ids), and no condition of any
// module: its own placeholders are generic consult-note headings (history, medications,
// allergies, pregnancy status, vitals, treatment offered today).
import { APP_VERSION, CAVEATS } from "./policy.js";
import { PROBE_KIND, TIER_RANK, normalizeAnswer } from "./vocab.js";
import { evaluateRules, renderTpl } from "./evaluate.js";
import { computeScore } from "./scoring.js";
import { activeFlagsOf, buildPhenotypeState, buildRoutingState, copyVars, derivePhenotype, gapSignals, referralFor, routingRecs } from "./rules.js";
import { referralGate, routingGate } from "./gates.js";
import { provenanceLines } from "./lineage.js";
import { ENGINE_COPY_DEFAULTS } from "./generic.js";

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const obj = (x) => (isObj(x) ? x : {});
const nonEmpty = (x) => typeof x === "string" && x.trim().length > 0;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const SURFACES = ["screener", "scribe"];
/** The PROBE_KIND key of manoeuvre (examination) probes. */
const EXAM_KIND = "exam";

/** Chrome of the EMR template panel, shared by the Screener and the Scribe (engine-owned, English). */
export const EMR_UI = Object.freeze({
  button: "EMR Friendly Template",
  frameTitle: "EMR friendly consult note template",
  instruction: "Plain text for pasting into an EMR. Complete every [bracketed] field; edits here are not saved.",
  // the second sentence of the instruction line, by surface (the Scribe's text follows the encounter);
  // the panel unmounts when the user leaves its view, so that discards edits too (round 4)
  regenerates: "The text is rebuilt whenever the screen changes or you leave this view, which discards edits made here.",
  regeneratesScribe: "The text is rebuilt whenever the encounter changes or you leave this view, which discards edits made here.",
  copy: "Copy text",
  download: "Download .txt",
  copied: "EMR template copied",
  copyFailed: "Copy failed: select the text in the box and copy it",
});

// ---- engine sentences, verbatim from their sources ------------------------------------------
const S = {
  // engine/scribe.js buildNote L304 (SAFETY REVIEW and the A&P red-flag header)
  redFlags: (emergent) => `RED FLAGS PRESENT — ${emergent ? "EMERGENT" : "URGENT"}. Screening routing withheld.`,
  // engine/scribe.js L307, L308
  reviewDone: "Red-flag review completed; none present.",
  reviewMissing: "NOT YET REVIEWED — no routing issued. Complete the red-flag review before signing.",
  // apps/Screener.jsx L689 (the override box)
  sameDay: "At least one needs same-day assessment.",
  expedited: "Expedited workup — days, not weeks.",
  // engine/fhir.js L343 (the routing-override component display). Only the Screener's bundle emits
  // that component; the content basis (§1, §2.10b) prints the line on both surfaces, so on the
  // Scribe it is the Screener bundle's wording (the Scribe bundle has no referral either way).
  routingWithheld: "Screening routing withheld — red flag present",
  // engine/scribe.js L332, L334
  safetyNotRecorded: "Safety review not recorded — no screening routing issued.",
  notScorable: "Screen not scorable — complete the outstanding items before acting on this screen.",
  // engine/fhir.js L361 (the withheld-routing Observation note)
  ruleWithheld: (ruleId) => `Screening routing withheld: module rule "${ruleId}" failed, so no referral was issued.`,
  // engine/scribe.js L315
  incompleteSuffix: " — INCOMPLETE, NO RESULT ISSUED",
  // engine/scribe.js L317; CAVEATS.illustrative inserted after the index (decision D10)
  index: (total, scaleMax, band, likelihoodOf) => `Index ${total}/${scaleMax} (${CAVEATS.illustrative}) — ${band.toUpperCase()} ${likelihoodOf}.`,
  // engine/scribe.js L318-319
  incomplete: (coverage, floor, ceiling, scaleMax) => [
    `Screen incomplete: ${coverage}% of scored items answered. Index bounded to ${floor}–${ceiling}/${scaleMax}, which spans more than one band.`,
    "No likelihood band is reported. Unanswered items are NOT recorded as denials, and no rule-out is implied.",
  ],
  // engine/scribe.js L320
  domains: (parts) => `Domains — ${parts.join(" · ")}`,
  // engine/scribe.js L295, L312 (the context line: the note labels of the gap markers that hit)
  context: (labels) => `Context: ${labels.join("; ")}.`,
  // engine/scribe.js L329
  override: (phrase) => `Red flag present — evaluate on its own terms before treating this as a ${phrase}.`,
  // engine/fhir.js L394, L397, L398 (the referral ServiceRequest code and reason)
  referral: (specialty, reason) => `Referral: ${specialty} — evaluate for ${reason}`,
  reasonScreener: (indexName, total, scaleMax, band) => `${indexName} ${total}/${scaleMax} (${band} likelihood); administer confirmatory instrument.`,
  reasonScribe: (indexName, total, scaleMax, band) => `${indexName} ${total}/${scaleMax} (${band}); administer confirmatory instrument.`,
  // apps/Screener.jsx L740-742 (the outstanding-items note, as text)
  notDenials: "Unanswered items are not counted as denials.",
  // apps/Scribe.jsx L840 (a red flag raised by ambient capture)
  heard: "heard in encounter",
};

/** Band headline labels: apps/Screener.jsx L240-245 (BAND_META) = engine/rules.js L340. */
const BAND_LABEL = { low: "Low likelihood", moderate: "Moderate likelihood", high: "High likelihood" };

// ---- placeholders and structural labels of this file ----------------------------------------
const P = {
  // a synthetic (demo) patient is never copied into text meant for a real chart
  patient: "Patient: [name]   Age / sex: [ ]   MRN: [ ]",
  picture: "Presenting picture: [ ]",
  header: ["DOB: [date of birth]", "Date of service: [date]", "Referring clinician: [name / practice]",
    "Consultant / specialty: [name]", "Encounter type / location: [ ]"],
  reason: "Reason for consult: [referrer's question]",
  hpi: "[HPI narrative: onset, course, character, timing, triggers, associated symptoms]",
  historyNone: "Treatment and investigations to date: [ ]",
  // decisions D8 (allergies, verbatim) and D13 (pregnancy status, verbatim); the data's "medical"
  // past-history rows follow pastMedical, its "family" rows follow pastOther (release 0.4.6)
  pastMedical: ["Past medical history: [ ]", "Pregnancy status / childbearing potential: [ ]"],
  pastOther: ["Current medications and doses: [ ]", "Drug allergies — agent and reaction: [ ]",
    "Environmental / inhalant allergies; prior allergy testing — date, result: [ ]",
    "Social history: [ ]"],
  family: "Family history: [ ]",
  // the content basis §2.6 heading, once a family-history row of the data prints above it
  familyOther: "Other family history: [ ]",
  ros: "[Additional review of systems]",
  exam: ["Vitals: BP [ ] HR [ ] Temp [ ] Wt [ ]", "General: [ ]"],
  examMore: "[Additional examination findings]",
  assessment: "Clinician assessment / differential: [ ]",
  // the red-flag decision of the implementation spec, verbatim
  workup: "[Workup ordered / ED or same-day referral made — details, time]",
  referralOpen: "Referral: [clinician decision]",
  consultant: ["Specific question for the consultant: [ ]", "Urgency / preferred clinic: [ ]"],
  offered: ["Acute (abortive) treatment offered today: [agent, dose - or not offered, reason]",
    "Preventive treatment offered today: [agent, dose - or not offered, reason]",
    "Lifestyle / non-drug measures discussed: [ ]"],
  followUp: "Follow-up / safety-net advice: [ ]",
  signature: "[Clinician name, credentials, date / time]",
};

/** Structural lines of this file: they make no clinical claim. */
const LBL = {
  // printed once above the red-flag actions when any of them carries a reference
  refNote: "Actions are the module's own wording; Ref lines are background reading, not the source of an action or its timing.",
  // printed under the checklist heading: an unticked row is unknown, never "not offered"
  checklistKey: "Key: ticked = recorded as done; unticked = not recorded (not confirmed as not offered).",
  // the one numbered list of the exam rows' and the checklist's citations, after the plan (round 3)
  sources: "REFERENCES (cited by number in the exam rows and checklist)",
  supporting: "Supporting features (recorded, not scored):",
  probeNotes: "Probe notes (recorded by clinician):",
  recorded: "recorded by clinician via probe",
  // the review-of-systems heading: screen answers, never today's examination (round 3)
  ros: "REVIEW OF SYSTEMS (screen items, as answered; not today's examination)",
  // the Scribe's referral destination follows the computed picture, never one the clinician picked
  // (round 3): by a fired derive rule, by the module's default, or as passed in
  destinationRule: (picture) => `  (destination from the screen phenotype by module rule: ${picture}; confirm)`,
  destinationDefault: (picture) => `  (destination from the module's default phenotype: ${picture}; confirm)`,
  destination: (picture) => `  (destination from the screen phenotype: ${picture}; confirm)`,
  // the module's clinician rules, above the recommendations (release 0.4.5): the rule, and the
  // headings of its definition and clarification lines, each with the module's source in parentheses
  referralRule: "Referral rule",
  definition: "Definition",
  clarification: "Clarification",
  // under open red flags, the heading of the screen-based referral block and references (release
  // 0.4.6): the note prints them; the bundle withholds the referral (it never carries references)
  alsoScreen: "Screen-based referral and references (the FHIR bundle withholds the referral while a red flag is open):",
  // the assessment's list of the recommendation headings the plan prints (release 0.4.6)
  considerations: (hs) => `Considerations: ${hs.join("; ")}`,
  domainNone: (label) => `${label} not answered`,
  domainPart: (answered, count) => ` (${answered} of ${count} items answered)`,
};

// ---- small readers -------------------------------------------------------------------------

/** Note variables: copyVars with {indexName} rendered (as the encounter note does). */
function noteVars(module) {
  const base = copyVars(module);
  const indexName = typeof base.indexName === "string" ? renderTpl(base.indexName, null, base) : base.indexName;
  return { ...base, indexName };
}

/** module.copy at a dotted path, rendered; the engine default when the module has none. */
function slotOf(module, vars) {
  const at = (root, path) => path.split(".").reduce((x, k) => (isObj(x) ? x[k] : undefined), root);
  return (path) => {
    const fromModule = at(module.copy, path);
    const v = typeof fromModule === "string" ? fromModule : at(ENGINE_COPY_DEFAULTS, path);
    return renderTpl(typeof v === "string" ? v : "", null, vars);
  };
}

const scaleOption = (it, v) => (Array.isArray(it.scale) && typeof v === "number" ? it.scale[v] : undefined);

/** A negative answer: "no", or a scale option with f === 0 (engine/scribe.js L281-285). */
function isNegative(it, v) {
  if (v === "no") return true;
  if (Array.isArray(it.scale)) {
    const o = scaleOption(it, v);
    return isObj(o) && typeof o.f === "number" ? o.f === 0 : v === 0;
  }
  return v === 0;
}

/** A positive answer: answered (not "unsure"), not negative. */
const isPositive = (it, v) => v !== undefined && !isNegative(it, v);

/** The item's clinician wording: patientClin (else text) for a yes/no item; short (else text) for a scale item. */
function itemWording(it) {
  return Array.isArray(it.scale) ? (it.short ?? it.text) : (it.patientClin ?? it.text);
}

/** "<wording> (<option label>)" for a scale answer, the wording alone otherwise. */
function answerLabel(it, v) {
  if (!Array.isArray(it.scale)) return itemWording(it);
  const o = scaleOption(it, v);
  return `${itemWording(it)} (${isObj(o) && o.label !== undefined ? o.label : v})`;
}

/** The recorded state of an item: yes / answered no / the option label / not recorded. */
function stateWord(it, v) {
  if (v === undefined) return "not recorded";
  if (Array.isArray(it.scale)) {
    const o = scaleOption(it, v);
    return isObj(o) && o.label !== undefined ? String(o.label) : String(v);
  }
  return v === "yes" ? "yes" : v === "no" ? "answered no" : String(v);
}

/** probe id → probe, from the module's logic (no prototype, so an unknown id reads absent). */
function probeIndex(module) {
  const out = Object.create(null);
  const list = module.logic && isObj(module.logic.probes) ? arr(module.logic.probes.list) : [];
  for (const p of list) if (isObj(p) && typeof p.id === "string") out[p.id] = p;
  return out;
}

/** {probe, index, opt} for a probe the clinician answered, or null. */
function answered(byId, probeAns, id) {
  if (typeof id !== "string" || !own(probeAns, id)) return null;
  const p = byId[id];
  const index = probeAns[id];
  const opt = p && Number.isInteger(index) ? arr(p.opts)[index] : undefined;
  return isObj(opt) ? { probe: p, index, opt } : null;
}

const noteOf = (o) => (typeof o.note === "string" && o.note ? o.note : null);
/** The probe answer as recorded: its option label, then its note. */
const recordedAnswer = (o) => [o.l, noteOf(o)].filter((x) => x !== null && x !== undefined && x !== "").join("; ");
/** " (recorded by clinician via probe: <label; note>)" for an answered probe. */
const recordedSuffix = (a) => ` (${LBL.recorded}: ${recordedAnswer(a.opt)})`;

/**
 * The answered Scribe probe whose chosen option wrote this item's current answer ({probe, index,
 * opt}), or null: no probe answers (the Screener), or no option that wrote this value. Used by the
 * history rows, the review of systems and the checklist alike, so a probe-written answer is
 * labelled as recorded by the clinician wherever it prints.
 */
function probeWriter(byId, probeAns, answers, itemId) {
  for (const id of Object.keys(probeAns)) {
    const a = answered(byId, probeAns, id);
    if (a && isObj(a.opt.a) && own(a.opt.a, itemId) && a.opt.a[itemId] === answers[itemId]) return a;
  }
  return null;
}

/**
 * The value of the first module derive rule that fires on these answers, or null when none fires
 * (derivePhenotype then falls back to the module's default picture) or a rule throws. The same
 * evaluation derivePhenotype makes; that function's result shape is left unchanged.
 */
function ruleDerivedValue(module, answers) {
  const rules = arr(module.logic && module.logic.phenotypes && module.logic.phenotypes.derive);
  if (!module.phenotypes || !rules.length) return null;
  const { fired, error } = evaluateRules(rules, buildPhenotypeState(module, answers), { mode: "first" });
  return !error && fired.length && typeof fired[0].value === "string" ? fired[0].value : null;
}

/** Whether a routing rule computes its chips from the answers on this surface (a function in the logic). */
function computedChips(module, id, surface) {
  const rule = arr(module.logic && module.logic.routing).find((x) => isObj(x) && x.id === id);
  const c = rule && isObj(rule.copy) ? rule.copy[surface] : null;
  return isObj(c) && typeof c.chips === "function";
}

/**
 * The lines of the module's clinician rules for this picture (release 0.4.5), printed right above
 * the recommendations whenever the plan prints a referral line or the clinician placeholder. Per
 * rule naming the phenotype (phenotypes.referral.clinicianRules, data order): "Referral rule
 * (<source>): <rule>"; "Definition (<source>):" and the definition lines; "Clarification
 * (<clarificationSource>):" and the clarification lines; and "<condition>: [ ]" for each condition
 * the clinician confirms (nothing is pre-filled: an unrecorded condition stays a placeholder,
 * never a no). Module text is moved verbatim; the labels are this file's. The rules never change
 * the referral. Nothing prints for a picture no rule names.
 */
function clinicianRuleLines(module, complaint) {
  const ref = module.phenotypes && module.phenotypes.referral;
  if (!isObj(ref) || !nonEmpty(complaint)) return [];
  const out = [];
  for (const e of arr(ref.clinicianRules)) {
    if (!isObj(e) || !arr(e.phenotypes).includes(complaint)) continue;
    const src = nonEmpty(e.source) ? ` (${e.source})` : "";
    if (nonEmpty(e.rule)) out.push(`${LBL.referralRule}${src}: ${e.rule}`);
    const defs = arr(e.definition).filter(nonEmpty);
    if (defs.length) out.push(`${LBL.definition}${src}:`, ...defs);
    const clar = arr(e.clarification).filter(nonEmpty);
    if (clar.length) out.push(`${LBL.clarification}${nonEmpty(e.clarificationSource) ? ` (${e.clarificationSource})` : ""}:`, ...clar);
    for (const label of arr(e.confirm)) if (nonEmpty(label)) out.push(`${label}: [ ]`);
  }
  return out;
}

// ---- the template ---------------------------------------------------------------------------

/**
 * The EMR friendly consult-note template (release 0.4.3).
 * @param {Object} module  bound module
 * @param {{patient?:Object, answers?:Object, ctx?:Object, complaint?:string, phenotypeError?:(Object|null),
 *          rf?:Object, safetyReviewed?:boolean, probeAns?:Object, vmp?:Object, appVersion?:string}} state
 *   rf          red-flag id → truthy (the Scribe's "nlp" | "md" | "probe" names the capture source)
 *   complaint   the phenotype value; on the Scribe, when omitted, derivePhenotype(module, answers)
 *   probeAns    probe id → chosen option index (Scribe only; the Screener runs no probes)
 *   safetyReviewed, vmp, phenotypeError: Scribe only (the Screener routes past its safety step)
 * @param {{surface:("screener"|"scribe")}} opts
 * @returns {string} plain text, LF line endings, starting and ending with CAVEATS.prototype
 */
export function buildEmrTemplate(module, state = {}, { surface } = {}) {
  if (!SURFACES.includes(surface)) throw new Error(`buildEmrTemplate: unknown surface "${surface}"`);
  const st = obj(state);
  const scribe = surface === "scribe";
  const tpl = isObj(module.emrTemplate) ? module.emrTemplate : null;
  const patient = isObj(st.patient) ? st.patient : obj(module.demo && module.demo.patient);
  const answers = {};
  for (const [k, v] of Object.entries(obj(st.answers))) { const n = normalizeAnswer(v); if (n !== undefined) answers[k] = n; }
  const ctx = obj(st.ctx);
  const rf = obj(st.rf);
  const probeAns = scribe ? obj(st.probeAns) : {};
  const vmp = scribe ? obj(st.vmp) : {};
  const safetyReviewed = scribe ? st.safetyReviewed === true : true;
  let complaint = typeof st.complaint === "string" ? st.complaint : "";
  let phenotypeError = scribe ? (st.phenotypeError || null) : null;
  if (scribe && st.complaint === undefined) {
    const d = derivePhenotype(module, answers);
    complaint = d.value;
    phenotypeError = d.error;
  }
  const appVersion = nonEmpty(st.appVersion) ? st.appVersion : APP_VERSION;

  const vars = noteVars(module);
  const slot = slotOf(module, vars);
  const scaleMax = module.scaleMax;
  const score = computeScore(module, answers);
  const band = score.band;
  const flags = activeFlagsOf(module, rf);
  const override = flags.length > 0;
  const emergent = flags.some((f) => TIER_RANK[f.tier] === 0);
  const routing = routingRecs(module, buildRoutingState(module, {
    surface, answers, ctx, complaint, phenotypeError, score, activeFlags: flags, safetyReviewed,
  }));
  const routingError = routing.error;
  const routingCleared = scribe ? routingGate({ override, safetyReviewed }) : true;
  const gateOpen = referralGate({ surface, override, routingCleared, score, routingError });
  const referral = gateOpen ? referralFor(module, complaint, { routingError }) : null;
  const gap = gapSignals(module, ctx);
  const byId = probeIndex(module);
  const itemById = module.itemById || {};
  const itemOf = (id) => (typeof id === "string" && own(itemById, id) ? itemById[id] : null);
  const domainLabel = {};
  for (const d of arr(module.domains)) domainLabel[d.key] = d.label;
  const cites = tpl && isObj(tpl.citations) ? tpl.citations : {};
  const accessed = new Set();
  const citeLine = (key) => {
    const c = own(cites, key) ? cites[key] : null;
    if (!isObj(c)) return null;
    if (nonEmpty(c.accessed)) accessed.add(c.accessed);
    return `${c.citation} ${c.url}`;
  };
  const citeLines = (keys) => arr(keys).map(citeLine).filter(Boolean);
  /**
   * One numbering for the citations of the exam rows and the checklist rows (round 3): each key
   * gets the next number the first time a printed row names it, and the numbered list prints once,
   * after the plan (metadata and a link only). sourceMark(row) is the row's " (sources 1, 3)".
   */
  const sourceNum = new Map();
  const sourceLines = [];
  const sourceMark = (r) => {
    const ns = [];
    for (const k of arr(isObj(r) && r.citations)) {
      if (typeof k !== "string") continue;
      if (!sourceNum.has(k)) {
        const line = citeLine(k);
        if (line === null) continue;
        sourceNum.set(k, sourceNum.size + 1);
        sourceLines.push(`${sourceNum.get(k)}. ${line}`);
      }
      if (!ns.includes(sourceNum.get(k))) ns.push(sourceNum.get(k));
    }
    return ns.length ? ` (${ns.length === 1 ? "source" : "sources"} ${ns.join(", ")})` : "";
  };

  const L = [];
  const section = (title) => {
    if (L.length && L[L.length - 1] !== "") L.push("");
    L.push(title);
  };

  // ---- marker, provenance, title, header
  L.push(CAVEATS.prototype);
  for (const line of arr(provenanceLines(module, "clinician"))) L.push(line);
  L.push([module.fhir && module.fhir.documentTitle, slot(scribe ? "scribe.title" : "screener.title")].filter(nonEmpty).join(" - "));
  // A synthetic (demo) identity is never pre-filled into text meant for a real chart.
  if (patient.synthetic === true || !nonEmpty(patient.family)) L.push(P.patient);
  else L.push(`Patient: ${patient.family}, ${patient.given ?? ""}  ${patient.age ?? ""}${patient.sex?.[0] ?? ""}  ${patient.mrn ?? ""}`);
  L.push(...P.header);

  // ---- reason for consult
  section("REASON FOR CONSULT");
  // The Screener prints the picture the clinician picked. The Scribe's picture is computed by the
  // module's derive rules, which can fire on a denied answer, and falls back to the module default
  // when none fires: it prints a placeholder, followed by the rule's category only when a rule fired.
  const pv = !phenotypeError && module.phenotypes && nonEmpty(complaint) ? arr(module.phenotypes.values).find((v) => isObj(v) && v.value === complaint) : null;
  const picture = pv ? [pv.h, pv.d].filter(nonEmpty).join(" - ") : "";
  const byRule = scribe ? ruleDerivedValue(module, answers) : null;
  if (!scribe) L.push(picture ? `Presenting picture: ${picture}` : P.picture);
  else if (picture && byRule === complaint) L.push(`${P.picture} (screen phenotype by module rule: ${picture}; confirm)`);
  else L.push(P.picture);
  L.push(P.reason);

  // ---- history of present illness
  section("HISTORY OF PRESENT ILLNESS");
  L.push(P.hpi);
  for (const ci of arr(module.contextItems)) {
    if (!isObj(ci) || ctx[ci.id] === undefined) continue;
    const o = arr(ci.options).find((x) => Array.isArray(x) && x[0] === ctx[ci.id]);
    L.push(`${ci.text}: ${o ? o[1] : ctx[ci.id]}`);
  }
  // The module's gap line names every marker, so it prints only when every marker hit; when the
  // rule fires on fewer (its threshold), the encounter note's context line lists the ones that did,
  // so the note never states a marker the line above records as answered otherwise (round 3).
  if (gap.alert) {
    const every = arr(gap.flags).length > 0 && arr(gap.flags).every(Boolean);
    if (every) L.push(slot("note.gapLine"));
    else if (arr(gap.noteLabels).length) L.push(S.context(gap.noteLabels));
  }
  if (scribe) {
    // engine/scribe.js L291-294: the info prompts answered yes or no, by tag
    const info = module.infoPrompts || null;
    const prompts = info ? arr(info.prompts) : [];
    const tagPrefix = info && typeof info.tagPrefix === "string" ? info.tagPrefix : "";
    const covered = Object.entries(vmp).filter(([, v]) => v === "yes" || v === "no")
      .map(([k]) => (prompts.find((i) => i.id === k)?.tag || k).replace(tagPrefix, ""));
    if (covered.length) L.push(`${slot("note.infoCovered")}: ${covered.join(", ")}.`);
    // Probe notes, by kind: manoeuvres go to the exam, probes the template places elsewhere
    // (exam rows, history rows, checklist signals) are printed there. The notes of kinds that may
    // not write a scored item (PROBE_KIND mayWrite false) are the supporting features, with the
    // module's footer; the notes of kinds that may write one are listed apart, without that footer.
    const placed = new Set();
    if (tpl) {
      for (const row of [...arr(tpl.examRows), ...arr(tpl.history)]) if (isObj(row) && typeof row.probe === "string") placed.add(row.probe);
      for (const row of arr(tpl.checklist)) for (const s of arr(isObj(row) && row.signals)) if (isObj(s) && typeof s.probe === "string") placed.add(s.probe);
    }
    const supporting = [];
    const writing = [];
    for (const id of Object.keys(probeAns)) {
      const a = answered(byId, probeAns, id);
      if (!a || a.probe.kind === EXAM_KIND || placed.has(id) || !noteOf(a.opt)) continue;
      const kind = own(PROBE_KIND, a.probe.kind) ? PROBE_KIND[a.probe.kind] : null;
      (kind && kind.mayWrite === false ? supporting : writing).push(noteOf(a.opt));
    }
    if (supporting.length) {
      L.push(LBL.supporting);
      for (const n of supporting) L.push(`- ${n}`);
      L.push(slot("note.supportingFooter"));
    }
    if (writing.length) {
      L.push(LBL.probeNotes);
      for (const n of writing) L.push(`- ${n}`);
    }
  }

  // ---- treatment and workup to date
  section("TREATMENT AND WORKUP TO DATE (from screen)");
  const history = tpl ? arr(tpl.history).filter(isObj) : [];
  const historyItems = new Set();
  // A Scribe probe the clinician answered that wrote this item's current answer: its option label
  // follows the state, so "answered no" never reads as a test that was done (Screener: none).
  const writtenBy = (itemId) => {
    const a = probeWriter(byId, probeAns, answers, itemId);
    return a ? recordedSuffix(a) : "";
  };
  let historyLines = 0;
  for (const row of history) {
    if (row.item !== undefined) {
      const it = itemOf(row.item);
      if (!it) continue;
      historyItems.add(it.id);
      const v = answers[it.id];
      // The probe that wrote the answer, else the row's qualifier after a negative answer (for
      // example that a "no" does not record whether testing was done).
      let tail = v !== undefined ? writtenBy(it.id) : "";
      if (!tail && v !== undefined && isNegative(it, v) && nonEmpty(row.qualifier)) tail = ` (${row.qualifier})`;
      L.push(`${itemWording(it)}: ${stateWord(it, v)}${tail}`);
      historyLines++;
    } else if (nonEmpty(row.label)) {
      const a = typeof row.probe === "string" ? answered(byId, probeAns, row.probe) : null;
      L.push(`${row.label}: [ ]${a ? recordedSuffix(a) : ""}`);
      historyLines++;
    }
  }
  if (!historyLines) L.push(P.historyNone);

  // ---- past history, medications, allergies. Release 0.4.6: the data's past-history rows, a
  // "medical" row after the pregnancy line, a "family" row before the family-history placeholder;
  // an item row prints its recorded state (a probe that wrote it follows, as in the rows above)
  // and leaves the review of systems.
  section("PAST HISTORY / MEDICATIONS / ALLERGIES");
  const pastRows = tpl ? arr(tpl.pastHistory).filter(isObj) : [];
  const pastLines = (group) => {
    const out = [];
    for (const row of pastRows) {
      if (row.group !== group) continue;
      if (row.item !== undefined) {
        const it = itemOf(row.item);
        if (!it || historyItems.has(it.id)) continue;
        historyItems.add(it.id);
        const v = answers[it.id];
        out.push(`${itemWording(it)}: ${stateWord(it, v)}${v !== undefined ? writtenBy(it.id) : ""}`);
      } else if (nonEmpty(row.label)) {
        out.push(`${row.label}: [ ]`);
      }
    }
    return out;
  };
  L.push(...P.pastMedical, ...pastLines("medical"), ...P.pastOther);
  const familyLines = pastLines("family");
  L.push(...familyLines, familyLines.length ? P.familyOther : P.family);

  // ---- review of systems (the screen items not listed above): screen answers, so an item that
  // presumes an examination never reads as one documented today (round 3)
  section(LBL.ros);
  const rosItems = arr(module.allItems).filter((it) => !historyItems.has(it.id));
  // an item a Scribe probe wrote carries that probe's recorded answer, as in the rows above
  const rosLabel = (it) => `${answerLabel(it, answers[it.id])}${writtenBy(it.id)}`;
  const endorsed = arr(module.domainOrder).map((k) => {
    const rows = rosItems.filter((it) => it.domain === k && isPositive(it, answers[it.id]));
    return rows.length ? `- ${domainLabel[k]}: ${rows.map(rosLabel).join("; ")}` : null;
  }).filter(Boolean);
  L.push(endorsed.length ? "Endorsed:" : "Endorsed: none recorded");
  L.push(...endorsed);
  const denied = rosItems.filter((it) => answers[it.id] !== undefined && isNegative(it, answers[it.id])).map(rosLabel);
  L.push(`Answered no: ${denied.length ? denied.join("; ") : "none recorded"}`);
  L.push(`Not answered: ${score.count - score.answered} of ${score.count} scored items. ${S.notDenials}`);
  L.push(P.ros);

  // ---- physical exam (placeholders; a probe answer only as the clinician recorded it)
  section("PHYSICAL EXAM");
  L.push(...P.exam);
  const rowProbes = new Set();
  const examRows = tpl ? arr(tpl.examRows).filter((row) => isObj(row) && nonEmpty(row.label)) : [];
  for (const row of examRows) {
    let line = `${row.label}${sourceMark(row)}: [ ]`;
    const a = typeof row.probe === "string" ? answered(byId, probeAns, row.probe) : null;
    if (typeof row.probe === "string") rowProbes.add(row.probe);
    if (a) line += recordedSuffix(a);
    L.push(line);
    // Release 0.4.6 (the clinical lead, 2026-10-10): a placeholder the data keys to the option the
    // clinician recorded, under the row.
    if (a) for (const h of arr(row.optionPlaceholders)) if (isObj(h) && h.option === a.index && nonEmpty(h.placeholder)) L.push(`  [${h.placeholder}]`);
  }
  for (const id of Object.keys(probeAns)) {
    const a = answered(byId, probeAns, id);
    if (!a || a.probe.kind !== EXAM_KIND || rowProbes.has(id)) continue;
    L.push(`Exam ${LBL.recorded}: ${a.probe.say} Answer: ${recordedAnswer(a.opt)}`);
  }
  L.push(P.examMore);

  // ---- screen result
  section("SCREEN RESULT");
  L.push(`${slot("note.screenHeading")}${score.scorable ? "" : S.incompleteSuffix}`);
  if (score.scorable) L.push(S.index(score.total, scaleMax, String(band), slot("note.likelihoodOf")));
  else L.push(...S.incomplete(score.coverage, score.floor, score.ceiling, scaleMax));
  L.push(`${score.answered}/${score.count} scored items answered (${score.coverage}%)`);
  // The encounter note's domain points, with each domain's denominator when not every item in it
  // was answered, and "<domain> not answered" when none was: an unanswered domain never reads as
  // zero points (round 3).
  const domainItems = {};
  for (const d of arr(module.domains)) if (isObj(d)) domainItems[d.key] = arr(d.items);
  L.push(S.domains(arr(module.domainOrder).map((k) => {
    const items = arr(domainItems[k]);
    const n = items.filter((it) => isObj(it) && answers[it.id] !== undefined).length;
    if (items.length && n === 0) return LBL.domainNone(domainLabel[k]);
    const pts = `${domainLabel[k]} ${score.domains[k]?.pts}/${score.domains[k]?.max}`;
    return n < items.length ? `${pts}${LBL.domainPart(n, items.length)}` : pts;
  })));
  if (override) {
    L.push(S.redFlags(emergent));
    for (const f of flags) L.push(`- ${f.text} — ${f.points}.`);
    // On the Scribe the review ("none of these apply") may still be unrecorded: the flags listed are
    // the ones raised, the rest were never confirmed absent (round 3).
    if (!safetyReviewed) L.push(S.reviewMissing);
  } else {
    L.push(safetyReviewed ? S.reviewDone : S.reviewMissing);
  }

  // ---- assessment
  section("ASSESSMENT");
  // The screen's category, said to be the screen's and illustrative (never the clinician's assessment).
  if (gateOpen && own(BAND_LABEL, band)) L.push(`Screen: ${BAND_LABEL[band]} ${slot("screener.bandSuffix")} (${CAVEATS.illustrative})`);
  // Release 0.4.6 (the clinical lead, 2026-10-10): the headings of the module recommendations the
  // plan prints, once each; only when the module's routing rules ran (no gate, no error), so never
  // an engine card.
  const moduleRecs = routing.gate === null && arr(module.logic && module.logic.routing).length > 0 ? routing.recs : [];
  const headings = [];
  for (const r of moduleRecs) if (nonEmpty(r.h) && !headings.includes(r.h)) headings.push(r.h);
  if (headings.length) L.push(LBL.considerations(headings));
  if (override) L.push(S.override(slot("note.patternPhrase")));
  L.push(P.assessment);

  // ---- plan
  section("PLAN");
  /**
   * The referral block: the referral line in the bundle's words with its reason, the index label
   * and (Scribe) the destination's source, or the clinician placeholder when `ref` is null; then
   * the consultant placeholders and the module's clinician rules for this picture (release 0.4.5).
   */
  const referralBlock = (ref) => {
    const out = [];
    if (ref) {
      out.push(S.referral(ref.specialty, ref.reason));
      const reason = scribe ? S.reasonScribe : S.reasonScreener;
      out.push(`  Reason: ${reason(module.copy.indexName, score.total, scaleMax, band)}`);
      // the reason line is the bundle's, byte for byte; the label of its index follows it
      out.push(`  (${[slot("indexName"), CAVEATS.illustrative].filter(nonEmpty).join(": ")})`);
      // On the Scribe the destination follows the computed picture (a derive rule can fire on a
      // denied answer, and the module default stands in when none fires); the referral line stays
      // the bundle's, and this line says where its destination came from (round 3).
      if (scribe && picture) {
        const fallback = byRule === null && !phenotypeError ? derivePhenotype(module, answers) : null;
        out.push(byRule === complaint ? LBL.destinationRule(picture)
          : fallback && !fallback.error && fallback.value === complaint ? LBL.destinationDefault(picture) : LBL.destination(picture));
      }
    } else {
      out.push(P.referralOpen);
    }
    out.push(...P.consultant);
    // The module's clinician rules for this picture, right above the recommendations (release
    // 0.4.5), with the referral line or the clinician placeholder.
    out.push(...clinicianRuleLines(module, complaint));
    return out;
  };
  /** The empiric-treatment references for this picture and the treatment-offered lines, only with the referral (D4; F11: none for an undeclared complaint). */
  const referenceBlock = (open) => {
    const refs = open && tpl ? arr(tpl.references).filter((r) => isObj(r) && showsFor(r.showFor, complaint)) : [];
    const refLines = [];
    for (const r of refs) {
      const cs = citeLines(r.citations);
      if (nonEmpty(r.label)) {
        if (cs.length === 1) refLines.push(`- ${r.label}: ${cs[0]}`);
        else { refLines.push(`- ${r.label}:`); for (const c of cs) refLines.push(`  ${c}`); }
      } else if (nonEmpty(r.note)) {
        refLines.push(`- ${r.note}`);
        for (const c of cs) refLines.push(`  Ref: ${c}`);
      }
    }
    return refLines.length ? ["Empiric treatment references (for use before specialist review):", ...refLines, ...P.offered] : [];
  };
  if (override) {
    // Red flags first (the routing override, as in the bundle): one module action per flag,
    // with its references, the workup placeholder and the bundle's routing-withheld line.
    L.push(S.redFlags(emergent));
    L.push(emergent ? S.sameDay : S.expedited);
    const refs = tpl && isObj(tpl.redFlagRefs) ? tpl.redFlagRefs : {};
    const holders = tpl && isObj(tpl.redFlagPlaceholders) ? tpl.redFlagPlaceholders : {};
    const refsOf = (id) => citeLines(own(refs, id) ? refs[id] : []);
    if (flags.some((f) => refsOf(f.id).length)) L.push(LBL.refNote);
    for (const f of flags) {
      const source = scribe ? flagSource(byId, probeAns, rf[f.id], f.id) : null;
      L.push(`- ${f.action} (${f.points}).${source ? ` Source: ${source}.` : ""}`);
      for (const c of refsOf(f.id)) L.push(`  Ref: ${c}`);
      if (own(holders, f.id) && nonEmpty(holders[f.id])) L.push(`  [${holders[f.id]}]`);
    }
    L.push(P.workup);
    L.push(S.routingWithheld);
    // Release 0.4.6 (the clinical lead's reading of "also", 2026-10-10): the screen-based referral
    // block and references, as the plan would print them with no flag open, under a heading saying
    // that the bundle withholds the referral. The gates are re-run without the flags only (the same rule
    // evaluation, safety review, coverage and band); the routing recommendations stay withheld.
    L.push(LBL.alsoScreen);
    const plain = routingRecs(module, buildRoutingState(module, {
      surface, answers, ctx, complaint, phenotypeError, score, activeFlags: [], safetyReviewed,
    }));
    const plainCleared = scribe ? routingGate({ override: false, safetyReviewed }) : true;
    const plainOpen = referralGate({ surface, override: false, routingCleared: plainCleared, score, routingError: plain.error });
    if (!safetyReviewed) L.push(S.safetyNotRecorded);
    else if (!score.scorable) L.push(S.notScorable);
    else if (plain.error) L.push(S.ruleWithheld(plain.error.ruleId));
    else {
      const plainRef = plainOpen ? referralFor(module, complaint, { routingError: null }) : null;
      L.push(...referralBlock(plainRef));
      L.push(...referenceBlock(plainOpen && plainRef !== null));
    }
  } else if (!safetyReviewed) {
    L.push(S.safetyNotRecorded);
  } else if (!score.scorable) {
    L.push(S.notScorable);
  } else if (routingError) {
    L.push(S.ruleWithheld(routingError.ruleId));
    for (const r of routing.recs) L.push(`- ${r.h}. ${r.p}`);
  } else {
    L.push(...referralBlock(referral));
    if (routing.recs.length) {
      // Chips never claim more than they are: computed chips (cut from answered items) are never
      // repeated, whatever the data lists (checked first); "Instruments:" only for the fixed chips
      // of the rules the data lists; other fixed chips as named on screen.
      const instrumentRecs = new Set(tpl ? arr(tpl.instrumentRecs).filter((x) => typeof x === "string") : []);
      for (const r of routing.recs) {
        L.push(`- ${r.h}. ${r.p}`);
        const chips = arr(r.chips);
        if (!chips.length || computedChips(module, r.id, surface)) continue;
        L.push(`  ${instrumentRecs.has(r.id) ? "Instruments" : "Named on screen"}: ${chips.join("; ")}`);
      }
    } else {
      L.push(`- ${slot("note.noDriver")}`);
    }
    // Empiric-treatment references only with the referral (decision D4): the gate is open and a
    // referral is issued (F11: none for a complaint that is not a declared phenotype value).
    L.push(...referenceBlock(gateOpen && referral !== null));
  }
  // The management checklist documents history, not routing: it stays in every state (decision D7).
  // A row the data marks onlyWithSignal prints only when one of its signals holds.
  const shown = (tpl ? arr(tpl.checklist).filter(isObj) : [])
    .map((row) => ({ row, st: checklistState(row, { answers, itemOf, byId, probeAns }) }))
    .filter(({ row, st }) => !(row.onlyWithSignal === true && !st.matched));
  if (shown.length) {
    const groups = [];
    for (const { row } of shown) if (nonEmpty(row.group) && !groups.includes(row.group)) groups.push(row.group);
    L.push(`Medical management not yet offered — checklist${groups.length ? ` (${groups.join(" / ")})` : ""}:`);
    L.push(LBL.checklistKey);
    for (const { row, st } of shown) L.push(checklistLine(row, st, sourceMark(row)));
  }
  L.push(P.followUp);

  // ---- the numbered citations of the exam rows and the checklist, once, after the plan (round 3)
  if (sourceLines.length) {
    section(LBL.sources);
    L.push(...sourceLines);
  }

  // ---- sign-off
  L.push("");
  L.push(slot("note.signOff"));
  L.push(P.signature);
  if (accessed.size) L.push(`Reference links accessed: ${[...accessed].sort().join(", ")}`);
  const versions = module.versions || {};
  const axes = [`app ${appVersion}`, `instrument ${versions.instrument ?? module.instrumentVersion}`];
  if (scribe) {
    // the Scribe's footer axes, each its own field: lexicon, probe set and the benchmark's gold set
    // (with the lexicon it was run on when that is not the current one)
    const goldLexicon = versions.goldSetLexicon && versions.goldSetLexicon !== versions.lexicon ? ` (lexicon ${versions.goldSetLexicon})` : "";
    axes.push(`extraction lexicon ${versions.lexicon ?? "not set"}`, `probe set ${versions.probeSet ?? "not set"}`,
      versions.goldSet ? `gold set ${versions.goldSet}${goldLexicon}` : "gold set not benchmarked");
  }
  L.push(axes.join(" | "));
  L.push(CAVEATS.prototype);
  return L.join("\n");
}

/** A reference row shows for every complaint, or only for the phenotype values of showFor. */
function showsFor(showFor, complaint) {
  if (showFor === undefined) return true;
  return isObj(showFor) && arr(showFor.phenotypes).includes(complaint);
}

/**
 * Where an open flag came from on the Scribe (decision D16): the app's own wording for ambient
 * capture, else a structural label; a probe names its PROBE_KIND label. Null when unknown.
 */
function flagSource(byId, probeAns, how, flagId) {
  if (how === "nlp") return S.heard;
  if (how === "md") return "marked by clinician";
  if (how === "probe") {
    for (const id of Object.keys(probeAns)) {
      const a = answered(byId, probeAns, id);
      if (!a || a.opt.rf !== flagId) continue;
      const k = a.probe.kind;
      return own(PROBE_KIND, k) ? `from ${String(PROBE_KIND[k].label).toLowerCase()} probe` : "from probe";
    }
    return "from probe";
  }
  return null;
}

/**
 * Whether an item signal's render agrees with the polarity of the answer it names (V61 checks the
 * data; this keeps data that bypassed validation fail-closed): "done" and "note" need a positive
 * answer (their text is the item's positive wording), "answeredNo" a negative one, and "neverTried"
 * comes only from a probe answer, never from an item.
 */
function itemSignalHolds(it, s) {
  const neg = isNegative(it, s.value);
  if (s.render === "answeredNo") return neg;
  if (s.render === "done" || s.render === "note") return !neg;
  return false;
}

/**
 * The signals of a checklist row that hold on this screen: the "done" text (the first "done"
 * signal that matches), whether a "neverTried" signal matched, the "answeredNo" and "note" texts,
 * and whether any signal matched at all. The source of a screen answer is "recorded on screen" /
 * "screen answered no" / "screen records (context only)". A Scribe probe answer is always
 * "recorded by clinician via probe" ("..., answered no"; a note: "... (context only)"), never
 * presented as a screen record: a probe signal's answer, and an item answer a probe wrote (round 3;
 * the probe's recorded answer then follows the item's wording in parentheses, as in the history
 * rows). A signal's qualifier is added to its source in parentheses (for a note: "context only;
 * <qualifier>"). An item signal whose polarity contradicts its render never holds.
 */
function checklistState(row, { answers, itemOf, byId, probeAns }) {
  let done = null;
  let never = false;
  let matched = false;
  const extras = [];
  for (const s of arr(row.signals)) {
    if (!isObj(s)) continue;
    let text = null;
    let viaProbe = false;
    if (s.item !== undefined) {
      const it = itemOf(s.item);
      const v = it ? answers[it.id] : undefined;
      if (it && v !== undefined && v === s.value && itemSignalHolds(it, s)) {
        text = answerLabel(it, v);
        const w = probeWriter(byId, probeAns, answers, it.id);
        if (w) { viaProbe = true; text += ` (${recordedAnswer(w.opt)})`; }
      }
    } else if (s.probe !== undefined) {
      const a = answered(byId, probeAns, s.probe);
      if (a && a.index === s.option) { text = noteOf(a.opt) ?? String(a.opt.l ?? ""); viaProbe = true; }
    }
    if (text === null) continue;
    const q = nonEmpty(s.qualifier) ? s.qualifier : null;
    const source = (words, probeWords = LBL.recorded) => (viaProbe ? probeWords : words) + (q ? ` (${q})` : "");
    if (s.render === "done") { if (done === null) done = `${source("recorded on screen")}: ${text}`; }
    else if (s.render === "neverTried") never = true;
    else if (s.render === "answeredNo") extras.push(`${source("screen answered no", `${LBL.recorded}, answered no`)}: ${text}`);
    else if (s.render === "note") extras.push(`${viaProbe ? LBL.recorded : "screen records"} (context only${q ? `; ${q}` : ""}): ${text}`);
    else continue;
    matched = true;
  }
  return { done, never, extras, matched };
}

/**
 * One checklist line: "[x] <label><mark> - <done text>" only when a "done" signal holds; otherwise
 * "[ ] <label><mark> - patient reports never tried" (a "neverTried" signal) or "- not recorded";
 * then the "answeredNo" and "note" texts, "; "-joined. Missing data never ticks a box. `mark` is
 * the row's " (sources 1, 3)"; a row's placeholder follows the line in square brackets; a row with
 * box false is a status line ("<label><mark>: …") with no box.
 */
function checklistLine(row, st, mark) {
  const status = st.done !== null ? st.done : st.never ? "patient reports never tried" : "not recorded";
  const tail = `${[status, ...st.extras].join("; ")}${nonEmpty(row.placeholder) ? ` [${row.placeholder}]` : ""}`;
  if (row.box === false) return `${row.label}${mark}: ${tail}`;
  return `[${st.done !== null ? "x" : " "}] ${row.label}${mark} - ${tail}`;
}

// ---- the panel document ------------------------------------------------------------------------

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
const FRAME_CSS = "html,body{margin:0;height:100%;background:#fff}"
  + "textarea{box-sizing:border-box;display:block;width:100%;height:100%;margin:0;padding:12px 14px;border:0;resize:none;"
  + "font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#0C2B2F;background:#fff}"
  + "textarea:focus{outline:2px solid #2A8C86;outline-offset:-2px}";

/**
 * The iframe document (srcdoc) of the EMR template panel: one full-size monospace <textarea>
 * prefilled with `text`, every character escaped (a "</textarea>" in the text stays text), and no
 * script. The leading newline after <textarea> is the one the HTML parser drops, so the text keeps
 * its own first line exactly.
 * @param {string} text
 * @returns {string}
 */
export function emrFrameDoc(text) {
  const title = escapeHtml(EMR_UI.frameTitle);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${FRAME_CSS}</style></head>`
    + `<body><textarea aria-label="${title}" spellcheck="false">\n${escapeHtml(text)}</textarea></body></html>`;
}
