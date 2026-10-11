// tests/suites/emr.js — the EMR Friendly Template engine, release 0.4.3 (engine/emr.js:
// buildEmrTemplate, emrFrameDoc, EMR_UI). Owner: release 0.4.3. The panels that show it are checked
// by render-screener and render-scribe; the module data by values (the delta) and validate (V61).
//
// Expectations are computed here from the module data and the other engine builders (computeScore,
// activeFlagsOf, routingRecs, buildBundle, derivePhenotype, buildPhenotypeState, routingGate),
// never read back from engine/emr.js:
//   matrix     every state of the gating matrix (content basis §1), on both surfaces: red flag open;
//              Scribe safety review not recorded; not scorable; a rule error (a throwing routing rule
//              on both surfaces, a throwing derive rule on the Scribe); the lowest band
//              ("Referral: [clinician decision]"); a settled higher band with the referral open, for
//              every complaint (the vestibular references only where showFor names the complaint).
//              The plan's gate line, the screen result's safety line, the references (present only
//              with the referral) and the checklist (present in every state) are asserted per state;
//              with the referral, the band headline is the screen's, labelled illustrative, and the
//              bundle's reason line is followed by the index's illustrative label.
//   flags      each red flag alone on both surfaces: its module action with its points, then its
//              "Ref:" lines in the data's order, then its data placeholder (rf_systemic); one line
//              saying that Ref lines are background reading, never the source of an action or its
//              timing; the tier lines (emergent / urgent / mixed); the workup placeholder and the
//              routing-withheld line; no referral, no references, the checklist kept; on the Scribe
//              the capture source (heard in encounter / marked by clinician / from <kind> probe /
//              from probe), on the Screener none. The sudden-hearing-loss block cites no AAO-HNSF
//              guideline and the orbital block no acute-rhinosinusitis review (round 1).
//   referral   the template's referral and reason lines equal the bundle's referral ServiceRequest
//              (code.text and reasonCode) in every state, or are absent with it.
//   traps      absent data is never negative (content basis §7 risk 6): x_lowfreq "no" ticks no
//              audiogram box, and when the Scribe's probe wrote it the probe's answer follows it;
//              r_abx "yes" is context ("agent/route not recorded"), never a tick; "unsure" is
//              unanswered (the same text as no answer); "Never tried" lives only in the Scribe's
//              probe answers (and is ignored on the Screener); a probe answer in the checklist is
//              "recorded by clinician via probe", never "recorded on screen"; a deferred or skipped
//              exam probe is a placeholder, a recorded one is labelled as recorded; an empty screen
//              ticks nothing and reads "not recorded"; the checklist key line says an unticked row
//              is not confirmed as not offered; the stewardship row is a status line, no box.
//   identity   a synthetic (demo) patient is never copied into the text (placeholders); a real
//              patient object is printed.
//   picture    the Screener prints the picked picture; the Scribe prints a placeholder, followed by
//              the module rule's category only when a derive rule fired: an empty encounter is a
//              bare placeholder, never the default picture, and a rule firing on a denied answer
//              reads as the screen's computed category to confirm.
//   chips      routing chips print as "Instruments:" only for the rules emrTemplate.instrumentRecs
//              lists, as "Named on screen:" for other fixed chips, and not at all when a rule
//              computes them from the answers (the competing-findings chips, cut from item text).
//   probes     the Scribe's probe notes by kind: supporting (phenotype) notes with the module footer;
//              notes of kinds that may write a scored item under their own heading, no footer.
//   text       no "{" or "}"; square brackets only as the engine's and the data's placeholders and
//              the checklist boxes; CAVEATS.prototype first and last; LF only; the version footer
//              with separate axes (the Scribe adds lexicon, probe set and gold set); no item's
//              criterion ref and no scale item's patientClin anywhere (round 2: no criteria list).
//   round 2    the checklist and exam rows name their own numbered sources ("(sources 1, 3)"); an
//              onlyWithSignal row (the stewardship line) prints only when its signal holds; a history
//              row's qualifier follows a negative answer no probe wrote (x_lowfreq / x_objective
//              "testing not recorded"); an item a Scribe probe wrote carries the probe's answer in the
//              review of systems too; a probe's context note reads "(context only)", and the row the
//              Dix–Hallpike probe informs names the treatment only; a checklist signal whose render
//              contradicts its answer's polarity never prints (and V61 reports it); a computed-chips
//              rule listed in instrumentRecs prints no chips (and V61 reports it); the Scribe's
//              instruction sentence names the encounter.
//   round 3    a checklist item answer a Scribe probe wrote reads "recorded by clinician via probe"
//              ("..., answered no"), with the probe's answer after the item wording, never "recorded
//              on screen" (the oracle mirrors it); the review of systems is headed as screen answers,
//              not today's examination; the exam rows' and the checklist's citations share one
//              numbering, listed once after the plan; the module's gap line prints only when every
//              marker hit, a rule firing on fewer prints the encounter note's context line; a
//              domain with nothing answered reads "not answered" and a partly answered one carries
//              its denominator; an unrecorded Scribe review is said under open flags; an open Scribe
//              referral says which computed picture its destination follows (by rule, by the
//              module's default, or as passed); the r_normal / r_lesion qualifiers; the SI1, AL3 and
//              AHA26 data; the acute-medication history row; the chips oracle tests computed chips
//              first, as the engine does, and the computed-listed fixture goes through verify.
//   round 4    the SI1 row: pr_scan_detail's "Genuinely clear", recorded by the clinician, ticks it
//              ("recorded by clinician via probe: Genuinely clear"; its own probe signal, first), never
//              a screen answer or the Screener; the other option ticks it through the item it wrote;
//              the r_normal note reads "(context only; modality not recorded)"; EMR_UI's rebuild
//              sentences say that leaving the view discards edits too.
//   neutral    a module without emrTemplate (the shape fixture, and MASQUE rebound without it) gets
//              the neutral template: placeholders, the screen result, red-flag module actions and the
//              recs; no references, no "Ref:" line, no checklist, no sources, no condition word.
//   frame      emrFrameDoc: one textarea whose parsed value is the text exactly (a leading newline
//              and "</textarea>" included), every character escaped, no script; EMR_UI's strings.
//   0.4.5      the clinical lead's referral rule for dizziness cases (phenotypes.referral.clinicianRules;
//              no automatic escalation): the referral's destination is computed here from the module
//              data (byPhenotype or default, nothing else) and must be the bundle's in every state,
//              the bundle being built with the state's probe answers on both surfaces (both must
//              ignore them); with a referral line or the clinician placeholder of a phenotype a rule
//              names (otologic and both), the rule block sits between the consultant placeholders
//              and the recommendations, and nowhere else; no evidence line and no escalation words
//              anywhere. Line-exact, written out here: the rule and the clarification verbatim, the
//              definition as the lead amended it on 2026-10-10 under the source label "clinical
//              lead, 2026-10-07; definition amended 2026-10-10" (no definition line names swaying
//              or bobbing, and the 2026-10-07 internal-vertigo line prints nowhere) and the two [ ]
//              placeholders, for otologic and both, on both surfaces, whatever pr_internal_vertigo
//              records, at the lowest band, for the derived Scribe pictures, for sinonasal and the
//              default (no rule) and under the gates (no rule).
//   0.4.6      the clinical lead's answers of 2026-10-10: under open red flags the plan prints, after
//              the workup and the routing-withheld line, the heading saying the FHIR bundle withholds
//              them and then exactly what the plan prints with no flag open, minus the routing
//              recommendations (the referral line = the bundle's without the flags, or the gate's
//              sentence or placeholder; the consultant lines, the rule block, the references only where
//              the gate would open), while the bundle itself keeps no referral; the assessment's
//              "Considerations:" line lists the headings of the module recommendations the plan
//              prints (never an engine card, never under a flag or a gate); the past-history section
//              (the modifying-conditions row after the pregnancy line, the family-history-of-migraine
//              line with its recorded state before "Other family history: [ ]", the item out of the
//              review of systems); the HINTS placeholder under the exam row only when the Scribe
//              records the central option. Every state of the matrix, the flags and the fuzz.
//   fuzz       seeded random states (1,500 per surface; 300 with ?quick=1): no throw, deterministic,
//              inputs untouched, every invariant above, the referral equal to the bundle's; since
//              release 0.4.5 pr_internal_vertigo is answered often (Scribe, and Screener to prove
//              it is ignored), and referrals of otologic and both must be drawn on both surfaces.
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";

const NOW = "2026-10-01T12:00:00.000Z";
const SURFACES = ["screener", "scribe"];
const INJECTED = "injected by the emr suite";
const MARKER = "Prototype · not for clinical use";
/** What may stand between square brackets: the engine's placeholders and the checklist boxes. */
const PLACEHOLDERS = new Set([" ", "x", "date of birth", "date", "name / practice", "name", "referrer's question",
  "HPI narrative: onset, course, character, timing, triggers, associated symptoms", "Additional review of systems",
  "Additional examination findings", "Workup ordered / ED or same-day referral made — details, time", "clinician decision",
  "agent, dose - or not offered, reason", "Clinician name, credentials, date / time"]);
/** The condition words of the static t-emr rule: none may appear in a neutral template. */
const CONDITION_WORDS = /\b(?:migrain|vestibul|vertig|dizz|headache|tinnit|hearing|rhinit|rhinosinus|sinus|sinonasal|otolog|otitis|intranasal|nasal|aural|cochle|labyrinth|m[eé]ni[eè]re|bppv|nystagm|hallpike|epley|hints\b|corticosteroid|steroid|antibiot|antihistamin|triptan|cgrp|audiogra|audiometr|b[aá]r[aá]ny|ichd|aafp|aan\b|stroke|arteritis|papill|neuro|syncope|seizure|epilep)/i;
const REFS_HEADING = "Empiric treatment references (for use before specialist review):";
const CHECKLIST_HEADING = "Medical management not yet offered — checklist (allergy / sinusitis / dizziness):";
const CHECKLIST_KEY = "Key: ticked = recorded as done; unticked = not recorded (not confirmed as not offered).";
/** The one numbered list of the exam rows' and the checklist's citations, after the plan (round 3). */
const SOURCES_HEADING = "REFERENCES (cited by number in the exam rows and checklist)";
const ROS_HEADING = "REVIEW OF SYSTEMS (screen items, as answered; not today's examination)";
const REF_NOTE = "Actions are the module's own wording; Ref lines are background reading, not the source of an action or its timing.";
const RECORDED = "recorded by clinician via probe";
const PATIENT_PLACEHOLDER = "Patient: [name]   Age / sex: [ ]   MRN: [ ]";
const PICTURE_PLACEHOLDER = "Presenting picture: [ ]";
const SUPPORTING = "Supporting features (recorded, not scored):";
const PROBE_NOTES = "Probe notes (recorded by clinician):";
const OFFERED = ["Acute (abortive) treatment offered today: [agent, dose - or not offered, reason]",
  "Preventive treatment offered today: [agent, dose - or not offered, reason]", "Lifestyle / non-drug measures discussed: [ ]"];
const CONSULTANT = ["Specific question for the consultant: [ ]", "Urgency / preferred clinic: [ ]"];
const WORKUP = "[Workup ordered / ED or same-day referral made — details, time]";
const WITHHELD = "Screening routing withheld — red flag present";
const SAFETY_NOT_RECORDED = "Safety review not recorded — no screening routing issued.";
const NOT_SCORABLE = "Screen not scorable — complete the outstanding items before acting on this screen.";
const REVIEW_DONE = "Red-flag review completed; none present.";
const REVIEW_MISSING = "NOT YET REVIEWED — no routing issued. Complete the red-flag review before signing.";
const ruleWithheld = (id) => `Screening routing withheld: module rule "${id}" failed, so no referral was issued.`;
const tierLine = (emergent) => `RED FLAGS PRESENT — ${emergent ? "EMERGENT" : "URGENT"}. Screening routing withheld.`;
const tierNext = (emergent) => (emergent ? "At least one needs same-day assessment." : "Expedited workup — days, not weeks.");
const BAND_LABEL = { low: "Low likelihood", moderate: "Moderate likelihood", high: "High likelihood" };
/** Release 0.4.6: the heading of the screen-based referral block under open red flags. */
const ALSO = "Screen-based referral and references (the FHIR bundle withholds the referral while a red flag is open):";
/** Release 0.4.6: the engine's past-history placeholders around the data's rows. */
const PAST_MEDICAL = ["Past medical history: [ ]", "Pregnancy status / childbearing potential: [ ]"];
const PAST_OTHER = ["Current medications and doses: [ ]", "Drug allergies — agent and reaction: [ ]",
  "Environmental / inhalant allergies; prior allergy testing — date, result: [ ]", "Social history: [ ]"];
/** Release 0.4.6: the lead's approved wording, written out here (not read from the module). */
const MODIFYING_ROW = "Modifying conditions (asthma, cystic fibrosis, immunocompromise, aspirin-exacerbated respiratory disease, ciliary dyskinesia): [ ]";
const HINTS_PLACEHOLDER = "  [clinician interpretation of HINTS and any imaging decision]";
/**
 * Release 0.4.5: the clinical lead's referral rule for dizziness cases as the note must print it,
 * written out here (not read from the module): the rule and the clarification verbatim, the
 * definition as the lead amended it on 2026-10-10 (the internal-vertigo line without "swaying,
 * bobbing, "; the source label names the amendment), and the two placeholders.
 */
const LEAD_RULE_BLOCK = [
  "Referral rule (clinical lead, 2026-10-07; definition amended 2026-10-10): dizziness cases should be referred to neurology, and neuro-otology if there is a true vertiginous component or a history of ear or brain surgeries.",
  "Definition (clinical lead, 2026-10-07; definition amended 2026-10-10):",
  "• Internal Vertigo: A false sensation of self-motion. The person feels like they are spinning clockwise/counter-clockwise, tilting, or being pulled in a specific direction.",
  "• External Vertigo: A false sensation that the surrounding environment is moving, spinning, or whirling around them.",
  "The direction is often predictable (e.g. \"always to the right\")",
  "Clarification (clinical lead, 2026-10-09):",
  "Vertigo episodes that last between 30 min and 12 hours should count as vertigo for purposes of ruling out meniere's disease, transient vertigo (true room spinning for a few seconds can count as vertigo which can be consistent with migrainous vertigo). A rocking or bobbing sensation is not true vertigo but a dizziness morphology that can be consistent with migrainous symptoms. Also some people describe \"the floor falling out from underneath them\".",
  "True vertigo (internal or external): [ ]",
  "Prior ear or brain surgery: [ ]",
];
/** The block's definition lines (between the "Definition (" label and the "Clarification (" label). */
const LEAD_DEFINITION_LINES = LEAD_RULE_BLOCK.slice(2, 5);
/** The internal-vertigo line as the lead first gave it (2026-10-07), before the amendment: printed nowhere. */
const SUPERSEDED_INTERNAL_VERTIGO = "• Internal Vertigo: A false sensation of self-motion. The person feels like they are spinning clockwise/counter-clockwise, tilting, swaying, bobbing, or being pulled in a specific direction.";
/** Release 0.4.5: the dizziness cases and their referral line (Neurology, each with its own reason). */
const DIZZINESS = [
  ["otologic", "Referral: Neurology — evaluate for vestibular migraine"],
  ["both", "Referral: Neurology — evaluate for mid-facial / migrainous cause"],
];

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const nonEmpty = (x) => typeof x === "string" && x.trim().length > 0;
const linesOf = (t) => t.split("\n");
/** The lines of a section: from its heading to the next blank line (heading excluded). */
function sectionOf(lines, heading) {
  const i = lines.indexOf(heading);
  if (i < 0) return null;
  const out = [];
  for (let k = i + 1; k < lines.length && lines[k] !== ""; k++) out.push(lines[k]);
  return out;
}
/** The placeholders a module's text may hold: the engine's and the ones its emrTemplate carries. */
function placeholdersOf(mod) {
  const out = new Set(PLACEHOLDERS);
  const t = mod.emrTemplate;
  if (isObj(t)) {
    for (const r of arr(t.checklist)) if (isObj(r) && nonEmpty(r.placeholder)) out.add(r.placeholder);
    for (const v of Object.values(isObj(t.redFlagPlaceholders) ? t.redFlagPlaceholders : {})) if (nonEmpty(v)) out.add(v);
    // release 0.4.6: the placeholders an exam row keys to a recorded option
    for (const r of arr(t.examRows)) for (const h of arr(isObj(r) && r.optionPlaceholders)) if (isObj(h) && nonEmpty(h.placeholder)) out.add(h.placeholder);
  }
  return out;
}
/** Bracket problems of a text: contents outside the allowed placeholders, an [x] not opening a line, stray brackets. */
function bracketProblems(text, allowed) {
  const bad = [];
  for (const line of linesOf(text)) {
    for (const m of line.matchAll(/\[([^[\]]*)\]/g)) {
      if (!allowed.has(m[1])) bad.push(`[${m[1]}]`);
      if (m[1] === "x" && m.index !== 0) bad.push(`[x] inside "${line.slice(0, 60)}"`);
    }
    if (/[[\]]/.test(line.replace(/\[[^[\]]*\]/g, ""))) bad.push(`stray bracket in "${line.slice(0, 60)}"`);
  }
  return bad;
}
/** The referral lines of a template ("Referral: …" that is not the placeholder, and the line after it), or null. */
function noteReferral(lines) {
  const i = lines.findIndex((l) => /^Referral: (?!\[)/.test(l));
  return i < 0 ? null : { code: lines[i], reason: lines[i + 1] };
}
/** The referral ServiceRequest of a bundle as the two lines a template prints, or null. */
function bundleReferral(bundle) {
  const sr = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === "ServiceRequest" && r.priority === "routine");
  return sr ? { code: sr.code.text, reason: `  Reason: ${sr.reasonCode[0].text}` } : null;
}
/** probe id → probe of a module's logic. */
const probesOf = (mod) => Object.fromEntries(arr(mod.logic && mod.logic.probes && mod.logic.probes.list).filter(isObj).map((p) => [p.id, p]));

export default {
  name: "emr",
  owner: "release 0.4.3",
  run: guarded("emr", async (h) => {
    const { module: M, validation } = await loadMasque(h);
    const names = ["emr.js", "scoring.js", "rules.js", "gates.js", "fhir.js", "bind.js", "vocab.js", "policy.js", "validate.js"];
    const mods = await Promise.all(names.map((n) => h.engine(n)));
    const E = Object.fromEntries(names.map((n, i) => [n.replace(".js", ""), mods[i]]));
    const { emr, scoring, rules, gates, fhir, bind, vocab, policy, validate } = E;
    need(typeof emr.buildEmrTemplate === "function" && typeof emr.emrFrameDoc === "function", "src/engine/emr.js has no buildEmrTemplate / emrFrameDoc");
    const c = collector(h);
    c.note(validationNote(validation));
    const T = M.emrTemplate;
    need(isObj(T), "the built-in module carries no emrTemplate (release 0.4.3)");
    const CAV = policy.CAVEATS;
    c.check(CAV.prototype === MARKER, "/marker", null, MARKER, CAV.prototype);
    const cites = T.citations;
    const probeById = probesOf(M);
    const allItems = M.allItems;

    // ------------------------------------------------------------------ the oracle
    /** The first module derive rule that fires (its value), or null when none fires or one throws first. */
    function firedDerive(mod, answers) {
      const list = arr(mod.logic && mod.logic.phenotypes && mod.logic.phenotypes.derive);
      const st = rules.buildPhenotypeState(mod, answers);
      for (const r of list) {
        if (!r || r.fallback === true) continue;
        try { if (typeof r.when !== "function" || r.when(st)) return typeof r.value === "string" ? r.value : null; } catch (_) { return null; }
      }
      return null;
    }
    /** Everything the template must agree with, from the other engine builders. */
    function expectFor(mod, surface, s) {
      const scribe = surface === "scribe";
      const answers = {};
      for (const [k, v] of Object.entries(s.answers || {})) { const n = vocab.normalizeAnswer(v); if (n !== undefined) answers[k] = n; }
      let complaint = typeof s.complaint === "string" ? s.complaint : "";
      let phenotypeError = scribe ? (s.phenotypeError || null) : null;
      if (scribe && s.complaint === undefined) { const d = rules.derivePhenotype(mod, answers); complaint = d.value; phenotypeError = d.error; }
      const safetyReviewed = scribe ? s.safetyReviewed === true : true;
      const score = scoring.computeScore(mod, answers);
      const flags = rules.activeFlagsOf(mod, s.rf || {});
      const override = flags.length > 0;
      const emergent = flags.some((f) => vocab.TIER_RANK[f.tier] === 0);
      const routing = rules.routingRecs(mod, rules.buildRoutingState(mod, { surface, answers, ctx: s.ctx || {}, complaint, phenotypeError, score, activeFlags: flags, safetyReviewed }));
      const routingCleared = scribe ? gates.routingGate({ override, safetyReviewed }) : true;
      const gateOpen = gates.referralGate({ surface, override, routingCleared, score, routingError: routing.error });
      // Release 0.4.5: the bundle gets the state's probe answers on both surfaces (no surface may
      // read them for the referral: nothing escalates).
      const bundle = fhir.buildBundle(mod, { patient: mod.demo.patient, answers, score, complaint, activeFlags: flags, emergent, routingCleared, routingError: routing.error,
        probeAns: isObj(s.probeAns) ? s.probeAns : {} }, { surface, now: NOW });
      // Release 0.4.6: under open flags the plan also prints what it prints with no flag open; the
      // bundle built without the flags gives its referral (the bundle itself keeps none).
      const plainRouting = override ? rules.routingRecs(mod, rules.buildRoutingState(mod, { surface, answers, ctx: s.ctx || {}, complaint, phenotypeError, score, activeFlags: [], safetyReviewed })) : routing;
      const plainCleared = scribe ? gates.routingGate({ override: false, safetyReviewed }) : true;
      const plainGateOpen = gates.referralGate({ surface, override: false, routingCleared: plainCleared, score, routingError: plainRouting.error });
      const plainBundle = override ? fhir.buildBundle(mod, { patient: mod.demo.patient, answers, score, complaint, activeFlags: [], emergent: false, routingCleared: plainCleared,
        routingError: plainRouting.error, probeAns: isObj(s.probeAns) ? s.probeAns : {} }, { surface, now: NOW }) : bundle;
      let plainState;
      if (!safetyReviewed) plainState = "unreviewed";
      else if (!score.scorable) plainState = "unscorable";
      else if (plainRouting.error) plainState = "error";
      else if (bundleReferral(plainBundle)) plainState = "open";
      else plainState = "closed";
      let state;
      if (override) state = "flag";
      else if (!safetyReviewed) state = "unreviewed";
      else if (!score.scorable) state = "unscorable";
      else if (routing.error) state = "error";
      else if (bundleReferral(bundle)) state = "open";
      else state = "closed";
      const pv = !phenotypeError && mod.phenotypes && nonEmpty(complaint) ? arr(mod.phenotypes.values).find((v) => isObj(v) && v.value === complaint) : null;
      const picture = pv ? [pv.h, pv.d].filter(nonEmpty).join(" - ") : "";
      const fired = scribe ? firedDerive(mod, answers) : null;
      const probeAns = scribe ? (s.probeAns || {}) : {};
      // Release 0.4.5: the destination the module data gives, computed here (never by rules.js):
      // byPhenotype[complaint] or default; no probe answer changes it (no automatic escalation).
      const dest = destinationOf(mod, complaint);
      return { scribe, answers, complaint, phenotypeError, picture, fired, score, flags, override, emergent, routing, gateOpen, bundle, state, safetyReviewed,
        probeAns, dest, plainRouting, plainGateOpen, plainBundle, plainState };
    }
    /** The clinician rules of phenotypes.referral naming this complaint (data order). */
    const clinicianRulesOf = (mod, complaint) => {
      const ref = mod.phenotypes && mod.phenotypes.referral;
      return isObj(ref) && Array.isArray(ref.clinicianRules) && nonEmpty(complaint) ? ref.clinicianRules.filter((e) => isObj(e) && arr(e.phenotypes).includes(complaint)) : [];
    };
    /** {specialty, reason} the module data gives for this complaint, or null without a referral table. */
    function destinationOf(mod, complaint) {
      const ref = mod.phenotypes && mod.phenotypes.referral;
      if (!isObj(ref)) return null;
      const base = (isObj(ref.byPhenotype) && own(ref.byPhenotype, complaint) ? ref.byPhenotype[complaint] : null) || ref.default;
      return isObj(base) ? { specialty: base.specialty, reason: base.reason } : null;
    }
    /** The referral-rule block (release 0.4.5) a plan prints right above its recommendations, with the referral line or the clinician placeholder. */
    function ruleBlockWant(mod, x) {
      const out = [];
      for (const e of clinicianRulesOf(mod, x.complaint)) {
        const src = nonEmpty(e.source) ? ` (${e.source})` : "";
        if (nonEmpty(e.rule)) out.push(`Referral rule${src}: ${e.rule}`);
        const defs = arr(e.definition).filter(nonEmpty);
        if (defs.length) out.push(`Definition${src}:`, ...defs);
        const clar = arr(e.clarification).filter(nonEmpty);
        if (clar.length) out.push(`Clarification${nonEmpty(e.clarificationSource) ? ` (${e.clarificationSource})` : ""}:`, ...clar);
        for (const cf of arr(e.confirm)) if (nonEmpty(cf)) out.push(`${cf}: [ ]`);
      }
      return out;
    }
    /** {probe, opt} for a probe answered in x.probeAns, or null. */
    const answeredIn = (x, probes, id) => {
      if (!own(x.probeAns, id)) return null;
      const p = probes[id];
      const idx = x.probeAns[id];
      const opt = p && Number.isInteger(idx) ? arr(p.opts)[idx] : undefined;
      return isObj(opt) ? { p, idx, opt } : null;
    };
    const wordingOf = (it) => (Array.isArray(it.scale) ? (it.short ?? it.text) : (it.patientClin ?? it.text));
    const answerLabelOf = (it, v) => (Array.isArray(it.scale) ? `${wordingOf(it)} (${it.scale[v] && it.scale[v].label !== undefined ? it.scale[v].label : v})` : wordingOf(it));
    const stateWord = (it, v) => (v === undefined ? "not recorded" : Array.isArray(it.scale) ? String(it.scale[v] ? it.scale[v].label : v) : v === "yes" ? "yes" : v === "no" ? "answered no" : String(v));
    const recorded = (o) => [o.l, typeof o.note === "string" && o.note ? o.note : null].filter((x) => x !== null && x !== undefined && x !== "").join("; ");
    /** The answered probe whose option wrote this item's current answer ({p, idx, opt}), or null. */
    const writerOf = (x, probes, itemId) => {
      for (const id of Object.keys(x.probeAns)) {
        const a = answeredIn(x, probes, id);
        if (a && isObj(a.opt.a) && own(a.opt.a, itemId) && a.opt.a[itemId] === x.answers[itemId]) return a;
      }
      return null;
    };
    const citeOf = (tpl, k) => `${tpl.citations[k].citation} ${tpl.citations[k].url}`;
    /** The citations of some rows, each once, in first-use order, numbered ("1. …"), and each row's " (sources 1, 3)". */
    const sourcesOf = (tpl, rows) => {
      const keys = [];
      for (const r of rows) for (const k of arr(r.citations)) if (!keys.includes(k)) keys.push(k);
      const mark = (r) => {
        const ns = [...new Set(arr(r.citations).map((k) => keys.indexOf(k) + 1))];
        return ns.length ? ` (${ns.length === 1 ? "source" : "sources"} ${ns.join(", ")})` : "";
      };
      return { lines: keys.map((k, i) => `${i + 1}. ${citeOf(tpl, k)}`), mark };
    };
    /** A negative answer: "no", or a scale option with f 0. */
    const negativeOf = (it, v) => v === "no" || (Array.isArray(it.scale) ? (it.scale[v] ? it.scale[v].f === 0 : v === 0) : v === 0);
    /** Whether an item signal's render agrees with its answer's polarity (round 2). */
    const polarityHolds = (it, sig) => (sig.render === "answeredNo" ? negativeOf(it, sig.value) : (sig.render === "done" || sig.render === "note") ? !negativeOf(it, sig.value) : false);
    /** What a checklist row's signals say on a screen: done text, never tried, extras, and whether any held. */
    function checklistRead(mod, x, row, probes) {
      let done = null, never = false, matched = false;
      const extras = [];
      for (const sig of arr(row.signals)) {
        let text = null, viaProbe = false;
        if (sig.item !== undefined) {
          const it = mod.itemById[sig.item];
          const v = x.answers[sig.item];
          if (it && v !== undefined && v === sig.value && polarityHolds(it, sig)) {
            text = answerLabelOf(it, v);
            // Round 3: an item answer a Scribe probe wrote is the clinician's record, with the probe's answer.
            const w = writerOf(x, probes, sig.item);
            if (w) { viaProbe = true; text += ` (${recorded(w.opt)})`; }
          }
        } else {
          const a = answeredIn(x, probes, sig.probe);
          if (a && a.idx === sig.option) { text = typeof a.opt.note === "string" && a.opt.note ? a.opt.note : String(a.opt.l ?? ""); viaProbe = true; }
        }
        if (text === null) continue;
        const q = nonEmpty(sig.qualifier) ? sig.qualifier : null;
        const src = (w, pw = RECORDED) => (viaProbe ? pw : w) + (q ? ` (${q})` : "");
        if (sig.render === "done") { if (done === null) done = `${src("recorded on screen")}: ${text}`; }
        else if (sig.render === "neverTried") never = true;
        else if (sig.render === "answeredNo") extras.push(`${src("screen answered no", `${RECORDED}, answered no`)}: ${text}`);
        else if (sig.render === "note") extras.push(`${viaProbe ? RECORDED : "screen records"} (context only${q ? `; ${q}` : ""}): ${text}`);
        else continue;
        matched = true;
      }
      return { done, never, extras, matched };
    }
    /** The checklist rows a screen prints (an onlyWithSignal row only when a signal holds), with what each says. */
    const checklistShown = (mod, x, probes) => arr(mod.emrTemplate && mod.emrTemplate.checklist)
      .map((row) => ({ row, st: checklistRead(mod, x, row, probes) })).filter(({ row, st }) => !(row.onlyWithSignal === true && !st.matched));
    /** The checklist line a row must print, with its sources mark. */
    function checklistWant(row, st, mark) {
      const status = st.done !== null ? st.done : st.never ? "patient reports never tried" : "not recorded";
      const tail = `${[status, ...st.extras].join("; ")}${nonEmpty(row.placeholder) ? ` [${row.placeholder}]` : ""}`;
      return row.box === false ? `${row.label}${mark}: ${tail}` : `[${st.done !== null ? "x" : " "}] ${row.label}${mark} - ${tail}`;
    }
    /** The routing recommendations' lines (rec, then its chips line by kind) a scorable, unflagged plan prints. */
    function recsWant(mod, x, surface) {
      if (!x.routing.recs.length) return [`- ${mod.copy.note.noDriver}`];
      const tpl = mod.emrTemplate;
      const instrumentRecs = new Set(tpl ? arr(tpl.instrumentRecs) : []);
      const computed = (id) => {
        const rule = arr(mod.logic && mod.logic.routing).find((r) => isObj(r) && r.id === id);
        const cp = rule && isObj(rule.copy) ? rule.copy[surface] : null;
        return isObj(cp) && typeof cp.chips === "function";
      };
      const out = [];
      for (const r of x.routing.recs) {
        out.push(`- ${r.h}. ${r.p}`);
        const chips = arr(r.chips);
        // Computed chips are never printed, whatever instrumentRecs lists (checked first, as the engine does).
        if (!chips.length || computed(r.id)) continue;
        out.push(`  ${instrumentRecs.has(r.id) ? "Instruments" : "Named on screen"}: ${chips.join("; ")}`);
      }
      return out;
    }
    /** The Scribe's destination line under an open referral (round 3), or null (the Screener, or no picture). */
    function destinationWant(mod, x) {
      if (!x.scribe || !x.picture) return null;
      if (x.fired === x.complaint) return `  (destination from the screen phenotype by module rule: ${x.picture}; confirm)`;
      const d = x.fired === null && !x.phenotypeError ? rules.derivePhenotype(mod, x.answers) : null;
      return d && !d.error && d.value === x.complaint ? `  (destination from the module's default phenotype: ${x.picture}; confirm)`
        : `  (destination from the screen phenotype: ${x.picture}; confirm)`;
    }

    /**
     * Every invariant of one template against the oracle. `full` adds the line-exact checks of
     * the module's data (identity, picture, history, exam rows, checklist, references, footer).
     */
    function verify(mod, surface, s, text, at, input, { full = true } = {}) {
      const x = expectFor(mod, surface, s);
      const L = linesOf(text);
      const tpl = mod.emrTemplate;
      const probes = probesOf(mod);
      const ok = (cond, path, want, got) => c.check(cond, `${at}${path}`, input, want, got);
      ok(typeof text === "string" && !text.includes("\r"), "/lf", "LF only", "CR present");
      ok(!/[{}]/.test(text), "/braces", "no { or }", (text.match(/.{0,30}[{}].{0,30}/) || [])[0]);
      const bp = bracketProblems(text, placeholdersOf(mod));
      ok(!bp.length, "/brackets", "square brackets only as placeholders and checklist boxes", bp.slice(0, 5));
      ok(L[0] === MARKER && L[L.length - 1] === MARKER, "/marker", "the marker first and last", [L[0], L[L.length - 1]]);
      const plan = sectionOf(L, "PLAN") || [];
      ok(plan.length > 0, "/plan", "a PLAN section", "none");
      // Referral = the bundle's, in every state; under open flags (release 0.4.6) the bundle's
      // without the flags, while the bundle itself carries none.
      c.diff(bundleReferral(x.state === "flag" ? x.plainBundle : x.bundle), noteReferral(L), { at: `${at}/referral`, input });
      if (x.state === "flag") ok(bundleReferral(x.bundle) === null, "/referral/bundle-withheld", "no referral in the bundle under an open flag", bundleReferral(x.bundle));
      // Release 0.4.5: the bundle's destination is the module data's for this complaint, whatever the
      // probe answers (no automatic escalation, on either surface).
      if (x.state === "open") {
        const br = bundleReferral(x.bundle);
        const want = x.dest ? `Referral: ${x.dest.specialty} — evaluate for ${x.dest.reason}` : null;
        ok(!!br && br.code === want, "/referral/destination", want, br && br.code);
      }
      // No line of the superseded automatic escalation, in any state.
      const escLines = L.filter((l) => l.startsWith("True vertigo recorded") || l.includes("escalated by the module's referral rule") || l.startsWith("Escalation evidence"));
      ok(!escLines.length, "/no-escalation", "no evidence line and no escalation words", escLines);
      // The referral-rule block only with a referral line or the clinician placeholder (open, closed).
      const block = ruleBlockWant(mod, x);
      const blockState = x.state === "flag" ? x.plainState : x.state;
      if (blockState !== "open" && blockState !== "closed") {
        ok(!L.some((l) => l.startsWith("Referral rule")), "/plan/no-rule-block", "no referral rule while the plan prints no referral line or placeholder", L.filter((l) => l.startsWith("Referral rule")));
      } else {
        ok(L.filter((l) => l.startsWith("Referral rule")).length === block.filter((l) => l.startsWith("Referral rule")).length, "/plan/rule-block/count",
          block.filter((l) => l.startsWith("Referral rule")), L.filter((l) => l.startsWith("Referral rule")));
      }
      const hasRefs = plan.includes(REFS_HEADING);
      let alsoEnd = -1;
      // The gate line of each state.
      const result = sectionOf(L, "SCREEN RESULT") || [];
      if (x.state === "flag") {
        ok(plan[0] === tierLine(x.emergent) && plan[1] === tierNext(x.emergent), "/plan/tier", [tierLine(x.emergent), tierNext(x.emergent)], plan.slice(0, 2));
        const refsOf = (id) => (tpl && isObj(tpl.redFlagRefs) && own(tpl.redFlagRefs, id) ? arr(tpl.redFlagRefs[id]) : []);
        let k = 2;
        if (x.flags.some((f) => refsOf(f.id).length)) {
          ok(plan[k] === REF_NOTE, "/plan/ref-note", REF_NOTE, plan[k]);
          k++;
        }
        for (const f of x.flags) {
          const src = !x.scribe ? "" : s.rf[f.id] === "nlp" ? " Source: heard in encounter." : s.rf[f.id] === "md" ? " Source: marked by clinician."
            : s.rf[f.id] === "probe" ? null : "";
          const head = plan[k] || "";
          if (src === null) ok(head.startsWith(`- ${f.action} (${f.points}). Source: from `) && head.endsWith(" probe."), `/plan/flag/${f.id}`, `- ${f.action} (${f.points}). Source: from … probe.`, head);
          else ok(head === `- ${f.action} (${f.points}).${src}`, `/plan/flag/${f.id}`, `- ${f.action} (${f.points}).${src}`, head);
          k++;
          const want = refsOf(f.id).map((key) => `  Ref: ${citeOf(tpl, key)}`);
          const holder = tpl && isObj(tpl.redFlagPlaceholders) && own(tpl.redFlagPlaceholders, f.id) ? tpl.redFlagPlaceholders[f.id] : null;
          if (nonEmpty(holder)) want.push(`  [${holder}]`);
          c.diff(want, plan.slice(k, k + want.length), { at: `${at}/plan/flag/${f.id}/refs`, input });
          k += want.length;
        }
        ok(plan[k] === WORKUP && plan[k + 1] === WITHHELD && plan[k + 2] === ALSO, "/plan/withheld", [WORKUP, WITHHELD, ALSO], plan.slice(k, k + 3));
        // Release 0.4.6 (the reading of "also"): under the heading, what the plan prints with no flag
        // open, without the routing recommendations.
        k += 3;
        const ps = x.plainState;
        if (ps === "unreviewed") { ok(plan[k] === SAFETY_NOT_RECORDED, "/plan/also/unreviewed", SAFETY_NOT_RECORDED, plan[k]); k++; }
        else if (ps === "unscorable") { ok(plan[k] === NOT_SCORABLE, "/plan/also/unscorable", NOT_SCORABLE, plan[k]); k++; }
        else if (ps === "error") { ok(plan[k] === ruleWithheld(x.plainRouting.error.ruleId), "/plan/also/error", ruleWithheld(x.plainRouting.error.ruleId), plan[k]); k++; }
        else {
          const want = [];
          if (ps === "open") {
            const br = bundleReferral(x.plainBundle);
            want.push(br.code, br.reason, `  (${mod.copy.indexName}: ${CAV.illustrative})`);
            const dest = destinationWant(mod, x);
            if (dest !== null) want.push(dest);
          } else want.push("Referral: [clinician decision]");
          want.push(...CONSULTANT, ...block);
          c.diff(want, plan.slice(k, k + want.length), { at: `${at}/plan/also`, input });
          k += want.length;
          const recShown = x.plainRouting.recs.filter((r) => plan.includes(`- ${r.h}. ${r.p}`));
          ok(!recShown.length, "/plan/also/no-recs", "the routing recommendations stay withheld", recShown.map((r) => r.h));
        }
        alsoEnd = k;
        // Review round 1: where the plain gate closes on the review, coverage or a rule error, the
        // sentence stands alone: no referral line or placeholder and no consultant line anywhere.
        if (ps === "unreviewed" || ps === "unscorable" || ps === "error") {
          ok(!L.some((l) => /^Referral: /.test(l)) && !CONSULTANT.some((l) => L.includes(l)), "/plan/also/closed-alone", "no referral line or placeholder and no consultant line",
            L.filter((l) => /^Referral: /.test(l) || CONSULTANT.includes(l)));
        }
        ok(L.filter((l) => /^Referral: /.test(l)).every((l) => plan.indexOf(l) > plan.indexOf(ALSO)), "/plan/also/referral-after-heading", "a referral line only under the heading",
          L.filter((l) => /^Referral: /.test(l)));
        ok(!L.some((l) => l.startsWith("Screen: ")), "/assessment/no-headline", "no band headline under an open flag", L.filter((l) => l.startsWith("Screen: ")));
        ok(result.includes(tierLine(x.emergent)) && x.flags.every((f) => result.includes(`- ${f.text} — ${f.points}.`)), "/result/flags", "the tier and each flag's text and points", result);
        // Round 3: an unrecorded Scribe review is said after the flags (the flags listed are the raised ones).
        const wantMissing = x.scribe && !x.safetyReviewed;
        ok((result[result.length - 1] === REVIEW_MISSING) === wantMissing && result.filter((l) => l === REVIEW_MISSING).length === (wantMissing ? 1 : 0) && !result.includes(REVIEW_DONE),
          "/result/flags/review", wantMissing ? `${REVIEW_MISSING} (last)` : "no review sentence under open flags", result.slice(-2));
        const phrase = mod.copy && mod.copy.note && mod.copy.note.patternPhrase;
        ok(!phrase || L.includes(`Red flag present — evaluate on its own terms before treating this as a ${phrase}.`), "/assessment/override", "the override sentence", null);
      } else {
        ok(result.includes(x.safetyReviewed ? REVIEW_DONE : REVIEW_MISSING), "/result/safety", x.safetyReviewed ? REVIEW_DONE : REVIEW_MISSING, result.filter((l) => /review/i.test(l)));
        if (x.state === "unreviewed") ok(plan[0] === SAFETY_NOT_RECORDED, "/plan/unreviewed", SAFETY_NOT_RECORDED, plan[0]);
        if (x.state === "unscorable") {
          ok(plan[0] === NOT_SCORABLE, "/plan/unscorable", NOT_SCORABLE, plan[0]);
          ok(result[0] === `${mod.copy.note.screenHeading} — INCOMPLETE, NO RESULT ISSUED`, "/result/incomplete", `${mod.copy.note.screenHeading} — INCOMPLETE, NO RESULT ISSUED`, result[0]);
        }
        if (x.state === "error") ok(plan[0] === ruleWithheld(x.routing.error.ruleId), "/plan/error", ruleWithheld(x.routing.error.ruleId), plan[0]);
        // Release 0.4.5: the referral-rule block sits between the consultant placeholders and the
        // recommendations, so it is right above them.
        if (x.state === "closed") {
          ok(plan[0] === "Referral: [clinician decision]", "/plan/closed", "Referral: [clinician decision]", plan[0]);
          const want = [...CONSULTANT, ...block, ...recsWant(mod, x, surface)];
          c.diff(want, plan.slice(1, 1 + want.length), { at: `${at}/plan/recs`, input });
        }
        if (x.state === "open") {
          const br = bundleReferral(x.bundle);
          const label = `  (${mod.copy.indexName}: ${CAV.illustrative})`;
          ok(plan[0] === br.code && plan[1] === br.reason && plan[2] === label, "/plan/open", [br.code, br.reason, label], plan.slice(0, 3));
          // Round 3: on the Scribe, where the destination came from (the bundle's referral line unchanged).
          const dest = destinationWant(mod, x);
          if (dest !== null) ok(plan[3] === dest, "/plan/open/destination", dest, plan[3]);
          const k0 = dest !== null ? 4 : 3;
          const want = [...CONSULTANT, ...block, ...recsWant(mod, x, surface)];
          c.diff(want, plan.slice(k0, k0 + want.length), { at: `${at}/plan/recs`, input });
        }
        // The band headline follows the referral gate (a module without a referral table opens the
        // gate and prints the referral placeholder): the screen's category, labelled illustrative.
        if (x.gateOpen) {
          const headline = `Screen: ${BAND_LABEL[x.score.band]} ${mod.copy.screener.bandSuffix} (${CAV.illustrative})`;
          ok(L.includes(headline), "/assessment/headline", headline, (sectionOf(L, "ASSESSMENT") || [])[0]);
        } else {
          ok(!L.some((l) => l.startsWith("Screen: ")), "/assessment/no-headline", "no band headline while the referral gate is closed", L.filter((l) => l.startsWith("Screen: ")));
        }
        if (x.state === "unreviewed" || x.state === "unscorable" || x.state === "error") ok(!L.some((l) => /^Referral: /.test(l)), "/plan/no-referral", "no referral line", L.filter((l) => /^Referral: /.test(l)));
      }
      // Empiric-treatment references only with the referral (decision D4); under open flags (release
      // 0.4.6) where the referral would be open without them, right after the referral block.
      const refsOpen = x.state === "open" || (x.state === "flag" && x.plainState === "open");
      const wantRefs = refsOpen && tpl ? arr(tpl.references).filter((r) => r.showFor === undefined || arr(r.showFor.phenotypes).includes(x.complaint)) : [];
      ok(hasRefs === (wantRefs.length > 0), "/plan/references", wantRefs.length > 0 ? "the references" : "no references (gate, don't warn)", hasRefs);
      if (x.state === "flag" && hasRefs) ok(plan.indexOf(REFS_HEADING) === alsoEnd, "/plan/also/references", `the references right after the referral block (line ${alsoEnd})`, plan.indexOf(REFS_HEADING));
      // Release 0.4.6: the assessment names the headings of the module recommendations the plan
      // prints, once each, in their order; nowhere else, and never an engine card.
      const modRecs = x.routing.gate === null && arr(mod.logic && mod.logic.routing).length > 0 ? x.routing.recs : [];
      const heads = [...new Set(modRecs.map((r) => r.h).filter(nonEmpty))];
      const assessment = sectionOf(L, "ASSESSMENT") || [];
      c.diff(heads.length ? [`Considerations: ${heads.join("; ")}`] : [], L.filter((l) => l.startsWith("Considerations: ")), { at: `${at}/assessment/considerations`, input });
      if (heads.length) {
        ok(assessment.includes(`Considerations: ${heads.join("; ")}`) && heads.every((hd) => plan.some((l) => l.startsWith(`- ${hd}. `))), "/assessment/considerations/in-plan",
          "in the assessment, each heading a recommendation the plan prints", heads);
      }
      if (full && wantRefs.length) {
        const want = [REFS_HEADING];
        for (const r of wantRefs) {
          const cs = arr(r.citations).map((k) => citeOf(tpl, k));
          if (r.label !== undefined) { if (cs.length === 1) want.push(`- ${r.label}: ${cs[0]}`); else { want.push(`- ${r.label}:`); for (const l of cs) want.push(`  ${l}`); } }
          else { want.push(`- ${r.note}`); for (const l of cs) want.push(`  Ref: ${l}`); }
        }
        want.push(...OFFERED);
        const i = plan.indexOf(REFS_HEADING);
        c.diff(want, plan.slice(i, i + want.length), { at: `${at}/plan/references/lines`, input });
      }
      // The checklist: every state, its key line, one line per printed row (ticked only by a "done"
      // signal that holds; an onlyWithSignal row only when a signal holds), each with its sources
      // mark, then its numbered sources.
      const shown = checklistShown(mod, x, probes);
      // Round 3: one numbering for the exam rows' and the printed checklist rows' citations, by first
      // use (the exam rows print first), listed once after the plan.
      const examRowsOf = tpl ? arr(tpl.examRows).filter((r) => isObj(r) && nonEmpty(r.label)) : [];
      const src = sourcesOf(tpl, [...examRowsOf, ...shown.map(({ row }) => row)]);
      const ci = plan.indexOf(CHECKLIST_HEADING);
      if (shown.length) {
        if (ok(ci >= 0, "/plan/checklist", CHECKLIST_HEADING, "absent")) {
          ok(plan[ci + 1] === CHECKLIST_KEY, "/plan/checklist/key", CHECKLIST_KEY, plan[ci + 1]);
          const want = shown.map(({ row, st }) => checklistWant(row, st, src.mark(row)));
          want.push("Follow-up / safety-net advice: [ ]");
          if (full) c.diff(want, plan.slice(ci + 2, ci + 2 + want.length), { at: `${at}/plan/checklist/lines`, input });
          else ok(want.every((l, i) => plan[ci + 2 + i] === l), "/plan/checklist/lines", want.slice(0, 3), plan.slice(ci + 2, ci + 5));
          ok(plan[plan.length - 1] === "Follow-up / safety-net advice: [ ]", "/plan/end", "the plan ends with the follow-up placeholder", plan.slice(-1));
        }
      } else {
        ok(ci < 0 && !L.some((l) => /^Medical management not yet offered/.test(l)), "/plan/no-checklist", "no checklist without emrTemplate rows to print", "present");
      }
      const refsSection = sectionOf(L, SOURCES_HEADING);
      if (src.lines.length) {
        c.diff(src.lines, refsSection || [], { at: `${at}/references/sources`, input });
        const iR = L.indexOf(SOURCES_HEADING), iF = L.indexOf("Follow-up / safety-net advice: [ ]"), iS = L.lastIndexOf(mod.copy && mod.copy.note ? mod.copy.note.signOff : "");
        ok(iR > iF && iF >= 0 && (iS < 0 || iR < iS), "/references/position", "after the plan's follow-up line, before the sign-off", { iR, iF, iS });
      } else {
        ok(refsSection === null, "/references/none", "no numbered source list without cited rows", refsSection);
      }
      ok(!L.some((l) => l === "Checklist sources:" || l === "Exam row sources:"), "/references/no-section-lists", "no per-section source lists (round 3)", L.filter((l) => /sources:$/.test(l)));
      if (!full) return x;
      // Round 2: no criteria list. No item's criterion ref, and no scale item's patientClin (which
      // embeds its qualifying option and criterion letter), is printed anywhere.
      const refs = arr(mod.allItems).filter((it) => nonEmpty(it.ref) && text.includes(it.ref)).map((it) => it.ref);
      ok(!refs.length && !text.includes("Criteria items recorded"), "/no-criteria-refs", "no criteria list and no criterion ref", refs);
      const scaleClin = arr(mod.allItems).filter((it) => Array.isArray(it.scale) && nonEmpty(it.patientClin) && text.includes(it.patientClin)).map((it) => it.id);
      ok(!scaleClin.length, "/no-scale-patientClin", "no scale item's patientClin", scaleClin);
      // Identity: a synthetic patient is never copied into the text.
      const patient = isObj(s.patient) ? s.patient : mod.demo.patient;
      const wantPatient = patient.synthetic === true || !nonEmpty(patient.family) ? PATIENT_PLACEHOLDER
        : `Patient: ${patient.family}, ${patient.given ?? ""}  ${patient.age ?? ""}${patient.sex?.[0] ?? ""}  ${patient.mrn ?? ""}`;
      ok(L.filter((l) => l.startsWith("Patient: ")).join("\n") === wantPatient, "/patient", wantPatient, L.filter((l) => l.startsWith("Patient: ")));
      // The presenting picture.
      const wantPicture = !x.scribe ? (x.picture ? `Presenting picture: ${x.picture}` : PICTURE_PLACEHOLDER)
        : x.picture && x.fired === x.complaint ? `${PICTURE_PLACEHOLDER} (screen phenotype by module rule: ${x.picture}; confirm)` : PICTURE_PLACEHOLDER;
      ok((sectionOf(L, "REASON FOR CONSULT") || [])[0] === wantPicture, "/picture", wantPicture, (sectionOf(L, "REASON FOR CONSULT") || [])[0]);
      // Round 3: the module's gap line only when every marker hit; a rule firing on fewer prints the
      // encounter note's context line (the markers that hit), never a line naming one that did not.
      const gap = rules.gapSignals(mod, s.ctx || {});
      const gapLine = mod.copy && mod.copy.note ? mod.copy.note.gapLine : undefined;
      const everyMarker = gap.flags.length > 0 && gap.flags.every(Boolean);
      const wantGap = !gap.alert ? [] : everyMarker ? [gapLine] : gap.noteLabels.length ? [`Context: ${gap.noteLabels.join("; ")}.`] : [];
      c.diff(wantGap, (sectionOf(L, "HISTORY OF PRESENT ILLNESS") || []).filter((l) => l === gapLine || l.startsWith("Context: ")), { at: `${at}/hpi/gap`, input });
      // Round 3: the review of systems is headed as screen answers, not today's examination.
      ok(L.includes(ROS_HEADING) && !L.includes("REVIEW OF SYSTEMS (screen items)"), "/ros/heading", ROS_HEADING, L.filter((l) => l.startsWith("REVIEW OF SYSTEMS")));
      // Round 3: domain points with their denominators; a domain with nothing answered is "not answered".
      const wantDomains = `Domains — ${arr(mod.domainOrder).map((k) => {
        const d = arr(mod.domains).find((q) => q.key === k) || {};
        const items = arr(d.items);
        const n = items.filter((it) => x.answers[it.id] !== undefined).length;
        if (items.length && n === 0) return `${d.label} not answered`;
        const pts = `${d.label} ${x.score.domains[k].pts}/${x.score.domains[k].max}`;
        return n < items.length ? `${pts} (${n} of ${items.length} items answered)` : pts;
      }).join(" · ")}`;
      ok(L.includes(wantDomains), "/result/domains", wantDomains, L.find((l) => l.startsWith("Domains — ")));
      // Treatment and workup to date (a probe that wrote an item's answer, or a history row's probe, follows as recorded).
      const writtenBy = (itemId) => {
        const a = writerOf(x, probes, itemId);
        return a ? ` (${RECORDED}: ${recorded(a.opt)})` : "";
      };
      const hist = sectionOf(L, "TREATMENT AND WORKUP TO DATE (from screen)") || [];
      const histRows = tpl ? arr(tpl.history) : [];
      const wantHist = histRows.length ? histRows.map((r) => {
        if (r.item !== undefined) {
          const it = mod.itemById[r.item];
          const v = x.answers[r.item];
          let tail = v !== undefined ? writtenBy(r.item) : "";
          if (!tail && v !== undefined && negativeOf(it, v) && nonEmpty(r.qualifier)) tail = ` (${r.qualifier})`;
          return `${wordingOf(it)}: ${stateWord(it, v)}${tail}`;
        }
        const a = r.probe !== undefined ? answeredIn(x, probes, r.probe) : null;
        return `${r.label}: [ ]${a ? ` (${RECORDED}: ${recorded(a.opt)})` : ""}`;
      }) : ["Treatment and investigations to date: [ ]"];
      c.diff(wantHist, hist, { at: `${at}/history`, input });
      // Release 0.4.6: the past-history section: the data's medical rows after the pregnancy line,
      // its family rows before the family placeholder ("Other family history" once one prints); an
      // item listed there is not repeated in the review of systems.
      const pastRows = tpl ? arr(tpl.pastHistory).filter(isObj) : [];
      const pastLine = (r) => {
        if (r.item === undefined) return `${r.label}: [ ]`;
        const it = mod.itemById[r.item];
        const v = x.answers[r.item];
        return `${wordingOf(it)}: ${stateWord(it, v)}${v !== undefined ? writtenBy(r.item) : ""}`;
      };
      const pastMed = pastRows.filter((r) => r.group === "medical").map(pastLine);
      const pastFam = pastRows.filter((r) => r.group === "family").map(pastLine);
      c.diff([...PAST_MEDICAL, ...pastMed, ...PAST_OTHER, ...pastFam, pastFam.length ? "Other family history: [ ]" : "Family history: [ ]"],
        sectionOf(L, "PAST HISTORY / MEDICATIONS / ALLERGIES"), { at: `${at}/past-history`, input });
      const rosLines = sectionOf(L, ROS_HEADING) || [];
      const pastItems = pastRows.filter((r) => r.item !== undefined).map((r) => mod.itemById[r.item]).filter(Boolean);
      ok(!pastItems.some((it) => rosLines.some((l) => l.includes(wordingOf(it)))), "/ros/no-past-items", "a past-history item is not repeated in the review of systems",
        rosLines.filter((l) => pastItems.some((it) => l.includes(wordingOf(it)))));
      // Review of systems: the denominator.
      ok(L.includes(`Not answered: ${x.score.count - x.score.answered} of ${x.score.count} scored items. Unanswered items are not counted as denials.`), "/ros/not-answered",
        `Not answered: ${x.score.count - x.score.answered} of ${x.score.count} scored items. …`, L.find((l) => l.startsWith("Not answered:")));
      // Physical exam: placeholders; a probe answer only as recorded by the clinician; the rows' sources.
      const exam = sectionOf(L, "PHYSICAL EXAM") || [];
      const wantExam = ["Vitals: BP [ ] HR [ ] Temp [ ] Wt [ ]", "General: [ ]"];
      for (const r of examRowsOf) {
        const a = r.probe !== undefined ? answeredIn(x, probes, r.probe) : null;
        wantExam.push(`${r.label}${src.mark(r)}: [ ]${a ? ` (${RECORDED}: ${recorded(a.opt)})` : ""}`);
        // release 0.4.6: the placeholder the data keys to the recorded option, under the row
        if (a) for (const hp of arr(r.optionPlaceholders)) if (isObj(hp) && hp.option === a.idx && nonEmpty(hp.placeholder)) wantExam.push(`  [${hp.placeholder}]`);
      }
      for (const id of Object.keys(x.probeAns)) {
        const a = answeredIn(x, probes, id);
        if (!a || a.p.kind !== "exam" || (tpl && arr(tpl.examRows).some((r) => r.probe === id))) continue;
        wantExam.push(`Exam ${RECORDED}: ${a.p.say} Answer: ${recorded(a.opt)}`);
      }
      wantExam.push("[Additional examination findings]");
      c.diff(wantExam, exam, { at: `${at}/exam`, input });
      // The footer: separate version axes (the Scribe's include the gold set).
      const V = mod.versions || {};
      const footer = [`app ${policy.APP_VERSION}`, `instrument ${V.instrument ?? mod.instrumentVersion}`];
      if (x.scribe) {
        const goldLexicon = V.goldSetLexicon && V.goldSetLexicon !== V.lexicon ? ` (lexicon ${V.goldSetLexicon})` : "";
        footer.push(`extraction lexicon ${V.lexicon ?? "not set"}`, `probe set ${V.probeSet ?? "not set"}`, V.goldSet ? `gold set ${V.goldSet}${goldLexicon}` : "gold set not benchmarked");
      }
      ok(L[L.length - 2] === footer.join(" | "), "/footer", footer.join(" | "), L[L.length - 2]);
      return x;
    }

    const build = (mod, surface, s) => emr.buildEmrTemplate(mod, s, { surface });
    const sample = (id) => M.sampleCases.find((x) => x.id === id);
    const stateOf = (sc, over = {}) => ({ patient: M.demo.patient, answers: { ...sc.a }, ctx: { ...(sc.ctx || {}) }, complaint: sc.complaint ?? "", rf: { ...(sc.rf || {}) }, safetyReviewed: true, ...over });
    const run = (mod, surface, s, at, input, opts) => {
      let text;
      try { text = build(mod, surface, s); } catch (err) { c.check(false, `${at}/throws`, input, "a template", String(err && err.stack || err)); return null; }
      return { text, x: verify(mod, surface, s, text, at, input, opts) };
    };

    // ------------------------------------------------------------------ strings
    c.diff({ button: "EMR Friendly Template", frameTitle: "EMR friendly consult note template",
      instruction: "Plain text for pasting into an EMR. Complete every [bracketed] field; edits here are not saved.",
      regenerates: "The text is rebuilt whenever the screen changes or you leave this view, which discards edits made here.",
      regeneratesScribe: "The text is rebuilt whenever the encounter changes or you leave this view, which discards edits made here." },
    { button: emr.EMR_UI.button, frameTitle: emr.EMR_UI.frameTitle, instruction: emr.EMR_UI.instruction,
      regenerates: emr.EMR_UI.regenerates, regeneratesScribe: emr.EMR_UI.regeneratesScribe }, { at: "/EMR_UI" });
    {
      let threw = false;
      try { emr.buildEmrTemplate(M, {}, { surface: "patient" }); } catch (_) { threw = true; }
      c.check(threw, "/surface/unknown", null, "an unknown surface throws (never a patient template)", "no throw");
    }

    // ------------------------------------------------------------------ the gating matrix
    const allNegative = {};
    for (const it of allItems) {
      if (Array.isArray(it.scale)) { const i = it.scale.findIndex((o) => o.f === 0); allNegative[it.id] = i >= 0 ? i : 0; } else allNegative[it.id] = "no";
    }
    const routed = M.sampleCases.find((x) => !x.rf && (() => { const s = scoring.computeScore(M, x.a); return s.scorable && s.band !== vocab.LOWEST_BAND; })());
    need(!!routed, "no routed sample case");
    const seenStates = { screener: new Set(), scribe: new Set() };
    const throwing = () => { throw new Error(INJECTED); };
    const meta = (key) => ({ origin: "builtin", classification: "builtin", key, sources: M.sources, loadedAt: NOW });
    const badRouting = await bind.bindModule(M.rubric, { ...M.logic, routing: [
      { id: "emr_suite_throwing_route", when: throwing, copy: { screener: { h: "x", p: "x", chips: [] }, scribe: { h: "x", p: "x", chips: [] } } }, ...M.logic.routing] }, meta("fixture:emr-throwing-routing"));
    const badDerive = await bind.bindModule(M.rubric, { ...M.logic, phenotypes: { ...M.logic.phenotypes, derive: [
      { id: "emr_suite_throwing_derive", value: (M.logic.phenotypes.derive[0] || {}).value, when: throwing }, ...M.logic.phenotypes.derive] } }, meta("fixture:emr-throwing-derive"));
    const matrix = [];
    for (const surface of SURFACES) {
      const scribe = surface === "scribe";
      for (const v of M.phenotypes.values) matrix.push([surface, `open/${v.value}`, M, stateOf(routed, { complaint: v.value }), "open"]);
      // Release 0.4.5: the dizziness cases with pr_internal_vertigo answered (no option escalates).
      for (const v of ["otologic", "both"]) for (const idx of [0, 1, 2]) matrix.push([surface, `open/${v}/pr_internal_vertigo-${idx}`, M, stateOf(routed, { complaint: v, probeAns: { pr_internal_vertigo: idx } }), "open"]);
      matrix.push([surface, "closed/all-negative", M, { answers: allNegative, ctx: {}, complaint: M.phenotypes.values[0].value, rf: {}, safetyReviewed: true }, "closed"]);
      for (const v of ["otologic", "both"]) matrix.push([surface, `closed/all-negative/${v}`, M, { answers: allNegative, ctx: {}, complaint: v, rf: {}, safetyReviewed: true, probeAns: { pr_internal_vertigo: 0 } }, "closed"]);
      matrix.push([surface, "unscorable/empty", M, { answers: {}, ctx: {}, complaint: "", rf: {}, safetyReviewed: true }, "unscorable"]);
      matrix.push([surface, "unscorable/partial", M, stateOf(sample("sim-partial") || { a: {} }), "unscorable"]);
      matrix.push([surface, "flag/redflag", M, stateOf(sample("redflag")), "flag"]);
      matrix.push([surface, "error/routing", badRouting, stateOf(routed), "error"]);
      if (scribe) {
        matrix.push([surface, "unreviewed/routed", M, stateOf(routed, { safetyReviewed: false }), "unreviewed"]);
        matrix.push([surface, "error/derive", badDerive, { ...stateOf(routed), complaint: undefined }, "error"]);
      }
    }
    for (const [surface, name, mod, s, want] of matrix) {
      const at = `/matrix/${surface}/${name}`;
      const r = run(mod, surface, s, at, { surface, state: name });
      if (!r) continue;
      seenStates[surface].add(r.x.state);
      c.check(r.x.state === want, `${at}/@state`, { surface, state: name }, want, r.x.state);
      if (want === "error") c.check(linesOf(r.text).includes(ruleWithheld(name === "error/derive" ? "emr_suite_throwing_derive" : "emr_suite_throwing_route")), `${at}/rule-line`, null, "the rule's withheld-routing line", null);
    }
    for (const surface of SURFACES) {
      const want = surface === "scribe" ? ["flag", "unreviewed", "unscorable", "error", "closed", "open"] : ["flag", "unscorable", "error", "closed", "open"];
      c.diff(want, want.filter((s) => seenStates[surface].has(s)), { at: `/matrix/${surface}/@covered` });
    }

    // ------------------------------------------------------------------ red flags, one by one
    const base = stateOf(routed);
    for (const surface of SURFACES) {
      for (const f of M.redFlags) {
        const how = surface === "scribe" ? "md" : true;
        run(M, surface, { ...base, rf: { [f.id]: how } }, `/flags/${surface}/${f.id}`, { surface, flag: f.id });
      }
      const emergentFlag = M.redFlags.find((f) => vocab.TIER_RANK[f.tier] === 0);
      const urgentFlag = M.redFlags.find((f) => vocab.TIER_RANK[f.tier] !== 0);
      const mixed = run(M, surface, { ...base, rf: { [urgentFlag.id]: surface === "scribe" ? "nlp" : true, [emergentFlag.id]: surface === "scribe" ? "md" : true } }, `/flags/${surface}/@mixed`, { surface });
      if (mixed) c.check(sectionOf(linesOf(mixed.text), "PLAN")[0] === tierLine(true), `/flags/${surface}/@mixed/tier`, null, tierLine(true), sectionOf(linesOf(mixed.text), "PLAN")[0]);
    }
    {
      // Round 1: no reference may read as the source of a module action's timing or claim the
      // verifier could not find (sudden hearing loss: no AAO-HNSF guideline; orbital: no AFP review).
      const blockOf = (text, f) => {
        const plan = sectionOf(linesOf(text), "PLAN") || [];
        const i = plan.findIndex((l) => l.startsWith(`- ${f.action} (`));
        const out = [];
        for (let k = i + 1; i >= 0 && k < plan.length && plan[k].startsWith("  "); k++) out.push(plan[k]);
        return out;
      };
      for (const [id, forbidden] of [["rf_ssnhl", "Otolaryngol Head Neck Surg"], ["rf_orbital", "Acute Rhinosinusitis"]]) {
        const f = M.redFlags.find((x) => x.id === id);
        if (!c.check(!!f, `/flags/refs/${id}/flag`, null, "the flag", null)) continue;
        const block = blockOf(build(M, "screener", { ...base, rf: { [id]: true } }), f);
        c.check(block.length > 0 && !block.some((l) => l.includes(forbidden)), `/flags/refs/${id}`, { flag: id }, `Ref lines without "${forbidden}"`, block);
      }
      const sys = M.redFlags.find((x) => x.id === "rf_systemic");
      if (c.check(!!sys && isObj(T.redFlagPlaceholders) && nonEmpty(T.redFlagPlaceholders.rf_systemic), "/flags/placeholder/data", null, "rf_systemic carries a workup placeholder", null)) {
        const block = blockOf(build(M, "scribe", { ...base, rf: { rf_systemic: "md" } }), sys);
        c.check(block[block.length - 1] === `  [${T.redFlagPlaceholders.rf_systemic}]`, "/flags/placeholder/rf_systemic", null, `  [${T.redFlagPlaceholders.rf_systemic}]`, block[block.length - 1]);
      }
    }
    {
      // The Scribe's capture sources (decision D16), one flag at a time.
      const tapFlag = M.redFlags.find((f) => arr(probeById.pr_temporal_artery && probeById.pr_temporal_artery.opts).some((o) => o.rf === f.id));
      const gca = tapFlag ? probeById.pr_temporal_artery.opts.findIndex((o) => o.rf === tapFlag.id) : -1;
      if (c.check(!!tapFlag && gca >= 0, "/flags/source/@probe-flag", null, "a red flag an exam probe raises", null)) {
        const t1 = build(M, "scribe", { ...base, rf: { [tapFlag.id]: "probe" }, probeAns: { pr_temporal_artery: gca } });
        c.check(linesOf(t1).includes(`- ${tapFlag.action} (${tapFlag.points}). Source: from ${vocab.PROBE_KIND.exam.label.toLowerCase()} probe.`), "/flags/source/probe", { probe: "pr_temporal_artery", option: gca },
          `- ${tapFlag.action} (${tapFlag.points}). Source: from exam probe.`, linesOf(t1).filter((l) => l.startsWith(`- ${tapFlag.action}`)));
        const t2 = build(M, "scribe", { ...base, rf: { [tapFlag.id]: "probe" } });
        c.check(linesOf(t2).includes(`- ${tapFlag.action} (${tapFlag.points}). Source: from probe.`), "/flags/source/probe-unknown", null, "Source: from probe.", linesOf(t2).filter((l) => l.startsWith(`- ${tapFlag.action}`)));
        const t3 = build(M, "scribe", { ...base, rf: { [tapFlag.id]: "nlp" } });
        c.check(linesOf(t3).includes(`- ${tapFlag.action} (${tapFlag.points}). Source: heard in encounter.`), "/flags/source/nlp", null, "Source: heard in encounter.", null);
        const t4 = build(M, "screener", { ...base, rf: { [tapFlag.id]: "probe" }, probeAns: { pr_temporal_artery: gca } });
        c.check(linesOf(t4).includes(`- ${tapFlag.action} (${tapFlag.points}).`), "/flags/source/screener", null, "no source on the Screener", linesOf(t4).filter((l) => l.startsWith(`- ${tapFlag.action}`)));
      }
    }

    // ------------------------------------------------------------------ absent is never negative
    const empty = { answers: {}, ctx: {}, complaint: "", rf: {}, safetyReviewed: true };
    {
      const rowWith = (pred) => arr(T.checklist).find((r) => arr(r.signals).some(pred));
      // A checklist row's line with its sources mark taken out (the line-exact checks above cover the marks).
      const lineOf = (text, label) => {
        for (const l of linesOf(text)) for (const pre of [`[x] ${label}`, `[ ] ${label}`, label]) {
          if (!l.startsWith(pre)) continue;
          const rest = l.slice(pre.length).replace(/^ \(sources? \d+(?:, \d+)*\)/, "");
          if (rest.startsWith(" - ") || rest.startsWith(": ")) return pre + rest;
        }
        return undefined;
      };
      // The key line: an unticked row is not confirmed as not offered.
      for (const surface of SURFACES) {
        const L = linesOf(build(M, surface, empty));
        const i = L.indexOf(CHECKLIST_HEADING);
        c.check(i >= 0 && L[i + 1] === CHECKLIST_KEY, `/traps/${surface}/checklist-key`, null, CHECKLIST_KEY, i >= 0 ? L[i + 1] : "no checklist");
      }
      // x_lowfreq "no" does not prove testing.
      const audio = rowWith((s) => s.item === "x_lowfreq" && s.render === "done");
      // Round 2: a "no" that does not record testing carries the history row's qualifier when no probe wrote it.
      const qualOf = (id) => { const r = arr(T.history).find((x) => x.item === id); return r && nonEmpty(r.qualifier) ? r.qualifier : null; };
      c.check(qualOf("x_lowfreq") === "testing not recorded" && qualOf("x_objective") === "testing not recorded", "/traps/history-qualifiers", null,
        "x_lowfreq and x_objective qualified testing not recorded (content basis §2.5)", { x_lowfreq: qualOf("x_lowfreq"), x_objective: qualOf("x_objective") });
      for (const surface of SURFACES) {
        const ob = M.itemById.x_objective;
        const t = build(M, surface, { ...empty, answers: { x_objective: "no", x_lowfreq: "yes" } });
        c.check(linesOf(t).includes(`${ob.patientClin}: answered no (testing not recorded)`) && linesOf(t).includes(`${M.itemById.x_lowfreq.patientClin}: yes`),
          `/traps/${surface}/x_objective/no/history`, { x_objective: "no" }, `${ob.patientClin}: answered no (testing not recorded); a yes unqualified`, linesOf(t).filter((l) => l.startsWith(ob.patientClin) || l.startsWith(M.itemById.x_lowfreq.patientClin)));
      }
      if (c.check(!!audio, "/traps/x_lowfreq/row", null, "the checklist row x_lowfreq ticks", null)) {
        const it = M.itemById.x_lowfreq;
        for (const surface of SURFACES) {
          const no = build(M, surface, { ...empty, answers: { x_lowfreq: "no" } });
          c.check(lineOf(no, audio.label) === `[ ] ${audio.label} - not recorded`, `/traps/${surface}/x_lowfreq/no`, { x_lowfreq: "no" }, `[ ] ${audio.label} - not recorded`, lineOf(no, audio.label));
          c.check(linesOf(no).includes(`${it.patientClin}: answered no (testing not recorded)`), `/traps/${surface}/x_lowfreq/no/history`, null, `${it.patientClin}: answered no (testing not recorded)`,
            linesOf(no).filter((l) => l.startsWith(`${it.patientClin}:`)));
          const yes = build(M, surface, { ...empty, answers: { x_lowfreq: "yes" } });
          c.check(lineOf(yes, audio.label) === `[x] ${audio.label} - recorded on screen: ${it.patientClin}`, `/traps/${surface}/x_lowfreq/yes`, { x_lowfreq: "yes" }, `[x] ${audio.label} - recorded on screen: ${it.patientClin}`, lineOf(yes, audio.label));
          const none = build(M, surface, empty);
          c.check(lineOf(none, audio.label) === `[ ] ${audio.label} - not recorded` && linesOf(none).includes(`${it.patientClin}: not recorded`), `/traps/${surface}/x_lowfreq/unanswered`, null, "not recorded", lineOf(none, audio.label));
        }
        // On the Scribe, the probe that wrote "no" follows the state, verbatim (round 1).
        const pa = Object.values(probeById).find((p) => p.target === "x_lowfreq");
        const oi = pa ? arr(pa.opts).findIndex((o) => isObj(o.a) && o.a.x_lowfreq === "no") : -1;
        if (c.check(oi >= 0, "/traps/x_lowfreq/probe", null, "the probe option that writes x_lowfreq no", null)) {
          const t = build(M, "scribe", { ...empty, answers: { x_lowfreq: "no" }, probeAns: { [pa.id]: oi } });
          const want = `${it.patientClin}: answered no (${RECORDED}: ${pa.opts[oi].l})`;
          c.check(linesOf(t).includes(want) && lineOf(t, audio.label) === `[ ] ${audio.label} - not recorded`, "/traps/scribe/x_lowfreq/no-by-probe", { probe: pa.id, option: oi }, want,
            linesOf(t).filter((l) => l.startsWith(`${it.patientClin}:`)));
        }
      }
      // r_abx "yes" is context, never an intranasal-steroid tick; the stewardship row is a status line.
      const abxRows = arr(T.checklist).filter((r) => arr(r.signals).some((s) => s.item === "r_abx"));
      if (c.check(abxRows.length > 0, "/traps/r_abx/rows", null, "checklist rows r_abx informs", 0)) {
        for (const surface of SURFACES) {
          const t = build(M, surface, { ...empty, answers: { r_abx: "yes" } });
          for (const r of abxRows) {
            const sig = r.signals.find((s) => s.item === "r_abx");
            const ctxWords = `screen records (context only${nonEmpty(sig.qualifier) ? `; ${sig.qualifier}` : ""}): ${M.itemById.r_abx.patientClin}`;
            const want = r.box === false ? `${r.label}: not recorded; ${ctxWords}` : `[ ] ${r.label} - not recorded; ${ctxWords}`;
            c.check(lineOf(t, r.label) === want, `/traps/${surface}/r_abx/${r.id}`, { r_abx: "yes" }, want, lineOf(t, r.label));
          }
        }
        c.check(abxRows.every((r) => arr(r.signals).filter((s) => s.item === "r_abx").every((s) => s.qualifier === "agent/route not recorded")), "/traps/r_abx/qualifier", null,
          "every r_abx signal qualified agent/route not recorded (content basis §4 AL1)", abxRows.map((r) => r.signals.map((s) => s.qualifier)));
      }
      const statusRows = arr(T.checklist).filter((r) => r.box === false);
      c.check(statusRows.length === 1 && statusRows[0].id === "si4" && statusRows[0].onlyWithSignal === true, "/traps/status-rows", null,
        "the stewardship row (si4) alone is a status line, printed only with its signal (round 2)", statusRows.map((r) => [r.id, r.onlyWithSignal]));
      for (const surface of SURFACES) {
        const L = linesOf(build(M, surface, empty));
        const ta = build(M, surface, { ...empty, answers: { r_abx: "yes" } });
        for (const r of statusRows) {
          c.check(!L.some((l) => l.includes(r.label)), `/traps/${surface}/status/${r.id}/absent`, null, `no ${r.label} line without its signal`, L.filter((l) => l.includes(r.label)));
          const la = lineOf(ta, r.label);
          c.check(la !== undefined && la.startsWith(`${r.label}: not recorded; `) && !linesOf(ta).some((l) => l.includes(`] ${r.label}`)),
            `/traps/${surface}/status/${r.id}`, { r_abx: "yes" }, `${r.label}: not recorded; … (no box)`, linesOf(ta).filter((l) => l.includes(r.label)));
        }
      }
      // "unsure" is unanswered.
      const unsure = Object.fromEntries(allItems.map((it) => [it.id, "unsure"]));
      for (const surface of SURFACES) {
        const a = build(M, surface, { ...empty, answers: unsure }), b = build(M, surface, empty);
        c.check(a === b, `/traps/${surface}/unsure`, null, "the same text as no answer at all", a === b ? null : "differs");
        const L = linesOf(b);
        c.check(!L.some((l) => l.startsWith("[x] ")) && L.includes("Answered no: none recorded") && L.includes("Endorsed: none recorded")
          && L.includes(`Not answered: ${M.allItems.length} of ${M.allItems.length} scored items. Unanswered items are not counted as denials.`), `/traps/${surface}/empty`, null,
          "nothing ticked, nothing denied, every item not answered", L.filter((l) => /^\[x\]|^Answered no|^Endorsed|^Not answered/.test(l)));
      }
      // "Never tried" lives only in the Scribe's probe answers; a probe answer is never a screen record.
      const trial = rowWith((s) => s.probe === "pr_treatment_trial" && s.render === "neverTried");
      const never = arr(probeById.pr_treatment_trial && probeById.pr_treatment_trial.opts).findIndex((o) => o.l === "Never tried");
      if (c.check(!!trial && never >= 0, "/traps/never-tried/row", null, "the row and the option", { row: !!trial, option: never })) {
        const tN = build(M, "scribe", { ...empty, probeAns: { pr_treatment_trial: never } });
        c.check(lineOf(tN, trial.label) === `[ ] ${trial.label} - patient reports never tried`, "/traps/scribe/never-tried", { option: never }, `[ ] ${trial.label} - patient reports never tried`, lineOf(tN, trial.label));
        c.check(lineOf(build(M, "scribe", empty), trial.label) === `[ ] ${trial.label} - not recorded`, "/traps/scribe/never-tried/unanswered", null, "not recorded", null);
        c.check(lineOf(build(M, "screener", { ...empty, probeAns: { pr_treatment_trial: never } }), trial.label) === `[ ] ${trial.label} - not recorded`, "/traps/screener/never-tried", null,
          "not recorded (the Screener runs no probes)", null);
        const improved = probeById.pr_treatment_trial.opts[0];
        const tI = build(M, "scribe", { ...empty, probeAns: { pr_treatment_trial: 0 } });
        c.check(lineOf(tI, trial.label) === `[x] ${trial.label} - ${RECORDED}: ${improved.note}`, "/traps/scribe/tried", { option: 0 }, `[x] ${trial.label} - ${RECORDED}: ${improved.note}`, lineOf(tI, trial.label));
        // The same answer echoes in the treatment-and-workup row of the probe (round 1).
        const hrow = arr(T.history).find((r) => r.probe === "pr_treatment_trial");
        if (c.check(!!hrow, "/traps/never-tried/history-row", null, "a history row tied to pr_treatment_trial", null)) {
          c.check(linesOf(tN).includes(`${hrow.label}: [ ] (${RECORDED}: Never tried)`), "/traps/scribe/never-tried/history", { option: never }, `${hrow.label}: [ ] (${RECORDED}: Never tried)`,
            linesOf(tN).filter((l) => l.startsWith(hrow.label)));
          c.check(linesOf(build(M, "screener", { ...empty, probeAns: { pr_treatment_trial: never } })).includes(`${hrow.label}: [ ]`), "/traps/screener/never-tried/history", null, `${hrow.label}: [ ]`, null);
        }
      }
      const dz1 = rowWith((s) => s.probe === "pr_dix_hallpike" && s.render === "note");
      if (c.check(!!dz1, "/traps/dix-hallpike/row", null, "a checklist row the Dix–Hallpike probe informs", null)) {
        for (const sig of dz1.signals.filter((s) => s.probe === "pr_dix_hallpike")) {
          const t = build(M, "scribe", { ...empty, probeAns: { pr_dix_hallpike: sig.option } });
          const want = `[ ] ${dz1.label} - not recorded; ${RECORDED} (context only): ${probeById.pr_dix_hallpike.opts[sig.option].note}`;
          c.check(lineOf(t, dz1.label) === want, `/traps/scribe/dix-hallpike/${sig.option}`, { option: sig.option }, want, lineOf(t, dz1.label));
        }
        // Round 2: the row names the treatment only; the test itself is the exam row the probe fills,
        // so a recorded test never sits next to "not recorded".
        const examRow = arr(T.examRows).find((r) => r.probe === "pr_dix_hallpike");
        const testName = examRow ? examRow.label.split(" (")[0] : null;
        c.check(!!testName && !dz1.label.includes(testName), "/traps/dix-hallpike/label", null, `the checklist label does not name the exam row's test ("${testName}")`, dz1.label);
      }
      // Round 2: an item a Scribe probe wrote carries that probe's answer in the review of systems too.
      {
        const pos = probeById.pr_positional, cnt = probeById.pr_episode_count;
        const noIdx = pos ? arr(pos.opts).findIndex((o) => isObj(o.a) && o.a.v_head === "no") : -1;
        const yesIdx = cnt ? arr(cnt.opts).findIndex((o) => isObj(o.a) && o.a.v_count === "yes") : -1;
        if (c.check(noIdx >= 0 && yesIdx >= 0, "/traps/ros/@setup", null, "probe options that write v_head no and v_count yes", { noIdx, yesIdx })) {
          const st = { ...empty, answers: { v_head: "no", v_count: "yes" }, probeAns: { pr_positional: noIdx, pr_episode_count: yesIdx } };
          const L = linesOf(build(M, "scribe", st));
          const denied = L.find((l) => l.startsWith("Answered no: ")) || "";
          const endorsedLines = L.filter((l) => l.startsWith("- ") && l.includes(M.itemById.v_count.patientClin));
          const wantNo = `${M.itemById.v_head.patientClin} (${RECORDED}: ${recorded(pos.opts[noIdx])})`;
          const wantYes = `${M.itemById.v_count.patientClin} (${RECORDED}: ${recorded(cnt.opts[yesIdx])})`;
          c.check(denied.includes(wantNo), "/traps/scribe/ros/denied-by-probe", { probe: "pr_positional", option: noIdx }, wantNo, denied);
          c.check(endorsedLines.some((l) => l.includes(wantYes)), "/traps/scribe/ros/endorsed-by-probe", { probe: "pr_episode_count", option: yesIdx }, wantYes, endorsedLines);
          const Ls = linesOf(build(M, "screener", st));
          c.check(!Ls.some((l) => l.includes(RECORDED)), "/traps/screener/ros/no-probe-label", null, "no probe label on the Screener", Ls.filter((l) => l.includes(RECORDED)));
          // Without the probe answers the review of systems carries no probe label.
          const Lb = linesOf(build(M, "scribe", { ...st, probeAns: {} }));
          c.check(!Lb.some((l) => l.includes(RECORDED)), "/traps/scribe/ros/no-probe", null, "no probe label without a probe answer", Lb.filter((l) => l.includes(RECORDED)));
        }
      }
      // A deferred or skipped exam probe is a placeholder; a recorded one is labelled as recorded.
      const tap = arr(T.examRows).find((r) => r.probe === "pr_temporal_artery");
      if (c.check(!!tap, "/traps/exam/row", null, "the exam row of pr_temporal_artery", null)) {
        const opts = probeById.pr_temporal_artery.opts;
        const deferred = opts.findIndex((o) => o.l === "Deferred"), normal = opts.findIndex((o) => o.l === "Normal");
        const exLine = (t) => linesOf(t).find((l) => l.startsWith(`${tap.label}:`));
        c.check(exLine(build(M, "scribe", empty)) === `${tap.label}: [ ]`, "/traps/exam/skipped", null, `${tap.label}: [ ]`, exLine(build(M, "scribe", empty)));
        const d = exLine(build(M, "scribe", { ...empty, probeAns: { pr_temporal_artery: deferred } }));
        c.check(d === `${tap.label}: [ ] (${RECORDED}: Deferred)` && !/Normal/.test(d), "/traps/exam/deferred", { option: deferred }, `${tap.label}: [ ] (${RECORDED}: Deferred)`, d);
        const n = exLine(build(M, "scribe", { ...empty, probeAns: { pr_temporal_artery: normal } }));
        c.check(n === `${tap.label}: [ ] (${RECORDED}: Normal)`, "/traps/exam/normal-recorded", { option: normal }, "the placeholder kept, the answer labelled as recorded", n);
        c.check(exLine(build(M, "screener", { ...empty, probeAns: { pr_temporal_artery: normal } })) === `${tap.label}: [ ]`, "/traps/exam/screener", null, "a placeholder on the Screener", null);
        const unknown = build(M, "scribe", { ...empty, probeAns: { pr_temporal_artery: 99, pr_no_such_probe: 0 } });
        c.check(exLine(unknown) === `${tap.label}: [ ]`, "/traps/exam/invalid-answer", null, "an invalid probe answer records nothing", exLine(unknown));
      }
      c.check(arr(T.examRows).every((r) => r.probe === undefined || (probeById[r.probe] && probeById[r.probe].kind === "exam")), "/traps/exam/kind", null,
        "every exam row names an exam-kind probe", arr(T.examRows).filter((r) => r.probe !== undefined).map((r) => [r.probe, probeById[r.probe] && probeById[r.probe].kind]));
    }

    // ------------------------------------------------------------------ probe notes by kind (Scribe)
    {
      const placed = new Set([...arr(T.examRows).map((r) => r.probe), ...arr(T.history).map((r) => r.probe), ...arr(T.checklist).flatMap((r) => arr(r.signals).map((s) => s.probe))].filter(Boolean));
      const pheno = Object.values(probeById).find((p) => vocab.PROBE_KIND[p.kind] && vocab.PROBE_KIND[p.kind].mayWrite === false && !placed.has(p.id) && arr(p.opts).some((o) => o.note));
      if (c.check(!!pheno, "/probes/supporting/probe", null, "an unplaced supporting probe with a note", null)) {
        const oi = pheno.opts.findIndex((o) => o.note);
        const L = linesOf(build(M, "scribe", { ...empty, probeAns: { [pheno.id]: oi } }));
        const i = L.indexOf(SUPPORTING);
        c.diff([SUPPORTING, `- ${pheno.opts[oi].note}`, M.copy.note.supportingFooter], i < 0 ? [] : L.slice(i, i + 3), { at: "/probes/supporting/scribe", input: { probe: pheno.id, option: oi } });
        c.check(!L.includes(PROBE_NOTES), "/probes/supporting/no-writing-heading", null, `no "${PROBE_NOTES}"`, "present");
        c.check(!build(M, "screener", { ...empty, probeAns: { [pheno.id]: oi } }).includes("Supporting features"), "/probes/supporting/screener", null, "none on the Screener", "present");
      }
      // A note of a kind that may write a scored item (rescue, criteria, safety) is not a supporting
      // feature: its own heading, and never the module's "contribute nothing to the index" footer.
      const writer = Object.values(probeById).find((p) => p.kind !== "exam" && vocab.PROBE_KIND[p.kind] && vocab.PROBE_KIND[p.kind].mayWrite === true && !placed.has(p.id) && arr(p.opts).some((o) => o.note));
      if (c.check(!!writer, "/probes/writing/probe", null, "an unplaced probe of a writing kind with a note", null)) {
        const oi = writer.opts.findIndex((o) => o.note);
        const L = linesOf(build(M, "scribe", { ...empty, probeAns: { [writer.id]: oi } }));
        const i = L.indexOf(PROBE_NOTES);
        c.diff([PROBE_NOTES, `- ${writer.opts[oi].note}`], i < 0 ? [] : L.slice(i, i + 2), { at: "/probes/writing/scribe", input: { probe: writer.id, option: oi } });
        c.check(!L.includes(SUPPORTING) && !L.includes(M.copy.note.supportingFooter), "/probes/writing/no-footer", { probe: writer.id }, "no supporting heading or footer", L.filter((l) => l === SUPPORTING || l === M.copy.note.supportingFooter));
      }
    }

    // ------------------------------------------------------------------ identity and presenting picture
    {
      for (const surface of SURFACES) {
        const t = build(M, surface, stateOf(routed));
        c.check(linesOf(t).includes(PATIENT_PLACEHOLDER) && !t.includes(M.demo.patient.family) && !t.includes(M.demo.patient.mrn) && !t.includes("synthetic sandbox record"),
          `/identity/${surface}/synthetic`, null, "the demo patient is never copied: placeholders only", linesOf(t).filter((l) => l.startsWith("Patient:")));
        const real = { given: "Pat", family: "Example", sex: "male", age: 50, mrn: "EXAMPLE-1" };
        const tr = build(M, surface, stateOf(routed, { patient: real }));
        c.check(linesOf(tr).includes("Patient: Example, Pat  50m  EXAMPLE-1"), `/identity/${surface}/real`, null, "Patient: Example, Pat  50m  EXAMPLE-1", linesOf(tr).filter((l) => l.startsWith("Patient:")));
      }
      const pic = (t) => (sectionOf(linesOf(t), "REASON FOR CONSULT") || [])[0];
      // An empty encounter: no rule fires, so the default picture is never printed.
      c.check(pic(build(M, "scribe", { ...empty, complaint: undefined })) === PICTURE_PLACEHOLDER, "/picture/scribe/empty", null, PICTURE_PLACEHOLDER, pic(build(M, "scribe", { ...empty, complaint: undefined })));
      // A rule firing on a denied answer reads as the screen's computed category, to confirm.
      const denied = { m_head: 0, v_vertigo: 2 };
      const head = M.itemById.m_head;
      const fv = firedDerive(M, denied);
      const pv = M.phenotypes.values.find((v) => v.value === fv);
      if (c.check(!!pv && Array.isArray(head.scale) && head.scale[0].f === 0, "/picture/scribe/denied/@setup", null, "a derive rule fires on m_head None + v_vertigo", { fired: fv })) {
        const want = `${PICTURE_PLACEHOLDER} (screen phenotype by module rule: ${pv.h} - ${pv.d}; confirm)`;
        c.check(pic(build(M, "scribe", { ...empty, answers: denied, complaint: undefined })) === want, "/picture/scribe/denied", { answers: denied }, want, pic(build(M, "scribe", { ...empty, answers: denied, complaint: undefined })));
      }
      c.check(!linesOf(build(M, "scribe", stateOf(routed, { complaint: undefined }))).some((l) => l.includes("derived from captured answers")), "/picture/scribe/label", null,
        "no claim that the picture was derived from captured answers", null);
      c.check(pic(build(M, "screener", stateOf(routed))) === `Presenting picture: ${M.phenotypes.values.find((v) => v.value === routed.complaint).h} - ${M.phenotypes.values.find((v) => v.value === routed.complaint).d}`,
        "/picture/screener", null, "the picked complaint", pic(build(M, "screener", stateOf(routed))));
    }

    // ------------------------------------------------------------------ routing chips
    {
      const competing = sample("competing");
      if (c.check(!!competing, "/chips/competing/sample", null, "the competing sample", null)) {
        const s = stateOf(competing);
        const x = expectFor(M, "screener", s);
        const rec = x.routing.recs.find((r) => arr(r.chips).length && !arr(T.instrumentRecs).includes(r.id)
          && typeof (M.logic.routing.find((q) => q.id === r.id) || {}).copy?.screener?.chips === "function");
        if (c.check(!!rec, "/chips/competing/rec", null, "a recommendation with computed chips", x.routing.recs.map((r) => r.id))) {
          const L = linesOf(build(M, "screener", s));
          const i = L.indexOf(`- ${rec.h}. ${rec.p}`);
          c.check(i >= 0 && !/^ {2}(Instruments|Named on screen): /.test(L[i + 1] || ""), "/chips/competing/none", { rec: rec.id }, "no chips line under computed chips", L[i + 1]);
          c.check(!L.some((l) => /^ {2}(Instruments|Named on screen): /.test(l) && rec.chips.some((ch) => l.includes(ch))), "/chips/competing/not-elsewhere", null,
            "the cut item texts appear on no chips line", L.filter((l) => /^ {2}(Instruments|Named on screen): /.test(l)));
        }
      }
      // A fixed chip list outside instrumentRecs reads "Named on screen", never "Instruments".
      // Every neuropathic item yes (the neuropathic-overlay rule reads that domain), the rest no.
      const neuroAll = { ...allNegative };
      for (const it of allItems) if (it.domain === "neuro" && !Array.isArray(it.scale)) neuroAll[it.id] = "yes";
      const xs = expectFor(M, "screener", { answers: neuroAll, ctx: {}, complaint: M.phenotypes.values[0].value, rf: {}, safetyReviewed: true });
      const named = xs.routing.recs.find((r) => arr(r.chips).length && !arr(T.instrumentRecs).includes(r.id) && Array.isArray((M.logic.routing.find((q) => q.id === r.id) || {}).copy?.screener?.chips));
      if (c.check(!!named, "/chips/named/rec", null, "a recommendation with fixed chips outside instrumentRecs", xs.routing.recs.map((r) => r.id))) {
        const L = linesOf(build(M, "screener", { answers: neuroAll, ctx: {}, complaint: M.phenotypes.values[0].value, rf: {}, safetyReviewed: true }));
        const i = L.indexOf(`- ${named.h}. ${named.p}`);
        c.check(L[i + 1] === `  Named on screen: ${named.chips.join("; ")}`, "/chips/named", { rec: named.id }, `  Named on screen: ${named.chips.join("; ")}`, L[i + 1]);
      }
      c.check(arr(T.instrumentRecs).every((id) => M.logic.routing.some((r) => r.id === id)), "/chips/instrumentRecs/exist", null, "every instrumentRecs id is a routing rule", T.instrumentRecs);
      // Round 2: a computed-chips rule listed in instrumentRecs still prints no chips (computed chips
      // are checked first), and V61 reports the listing.
      const compRule = M.logic.routing.find((r) => isObj(r.copy) && Object.values(r.copy).some((cp) => isObj(cp) && typeof cp.chips === "function"));
      if (c.check(!!compRule && !!competing, "/chips/computed-listed/@setup", null, "a computed-chips rule and the competing sample", compRule && compRule.id)) {
        const listed = await bind.bindModule({ ...M.rubric, emrTemplate: { ...T, instrumentRecs: [...arr(T.instrumentRecs), compRule.id] } }, M.logic, meta("fixture:emr-computed-chips-listed"));
        const vr = await validate.validateModule({ module: listed, loaded: [] });
        const at = `/emrTemplate/instrumentRecs/${arr(T.instrumentRecs).length}`;
        c.check(vr.errors.some((e) => e.code === "V61" && e.path === at), "/chips/computed-listed/V61", null, `E V61 ${at}`, vr.errors.map((e) => `${e.code} ${e.path}`));
        const L = linesOf(build(listed, "screener", stateOf(competing)));
        const rec = expectFor(listed, "screener", stateOf(competing)).routing.recs.find((r) => r.id === compRule.id);
        const i = rec ? L.indexOf(`- ${rec.h}. ${rec.p}`) : -1;
        c.check(i >= 0 && !/^ {2}(Instruments|Named on screen): /.test(L[i + 1] || ""), "/chips/computed-listed/none", { rec: compRule.id }, "no chips line under computed chips, even when listed", L[i + 1]);
        // Round 3: the same data through the whole oracle (recsWant tests computed chips first, as the engine).
        for (const surface of SURFACES) run(listed, surface, stateOf(competing), `/chips/computed-listed/${surface}/verify`, { rec: compRule.id, surface });
      }
    }

    // ------------------------------------------------------------------ signal polarity (round 2)
    {
      // Data that names a negative answer as "done" or "note", or a positive one as "answeredNo", is
      // reported by V61 and never prints: the row stays unticked, with no contradictory text.
      const audio = arr(T.checklist).find((r) => arr(r.signals).some((s) => s.item === "x_lowfreq" && s.render === "done"));
      const objRow = arr(T.checklist).find((r) => arr(r.signals).some((s) => s.item === "x_objective" && s.render === "done"));
      if (c.check(!!audio && !!objRow, "/polarity/@setup", null, "the rows x_lowfreq and x_objective tick", null)) {
        const iA = T.checklist.indexOf(audio), iO = T.checklist.indexOf(objRow);
        const checklist = T.checklist.map((r, i) => (i === iA ? { ...r, signals: [{ item: "x_lowfreq", value: "no", render: "done" }] }
          : i === iO ? { ...r, signals: [{ item: "x_objective", value: "yes", render: "answeredNo" }, { item: "x_objective", value: "no", render: "note" }] } : r));
        const bad = await bind.bindModule({ ...M.rubric, emrTemplate: { ...T, checklist } }, M.logic, meta("fixture:emr-polarity"));
        const vr = await validate.validateModule({ module: bad, loaded: [] });
        const want = [`/emrTemplate/checklist/${iA}/signals/0/render`, `/emrTemplate/checklist/${iO}/signals/0/render`, `/emrTemplate/checklist/${iO}/signals/1/render`];
        c.diff(want, want.filter((p) => vr.errors.some((e) => e.code === "V61" && e.path === p)), { at: "/polarity/V61" });
        for (const surface of SURFACES) {
          for (const answers of [{ x_lowfreq: "no", x_objective: "yes" }, { x_lowfreq: "no", x_objective: "no" }]) {
            const t = build(bad, surface, { ...empty, answers });
            const la = linesOf(t).find((l) => l.startsWith(`[x] ${audio.label}`) || l.startsWith(`[ ] ${audio.label}`)) || "";
            const lo = linesOf(t).find((l) => l.startsWith(`[x] ${objRow.label}`) || l.startsWith(`[ ] ${objRow.label}`)) || "";
            c.check(la.startsWith("[ ] ") && la.endsWith(" - not recorded") && lo.startsWith("[ ] ") && lo.endsWith(" - not recorded"), `/polarity/${surface}/${answers.x_objective}`, answers,
              "both rows unticked and not recorded (no positive wording for a negative answer)", [la, lo]);
          }
        }
      }
    }

    // ------------------------------------------------------------------ review round 3
    {
      const e3 = { answers: {}, ctx: {}, complaint: "", rf: {}, safetyReviewed: true };
      const L3 = (t) => linesOf(t);
      // A checklist row's line with its sources mark taken out.
      const rowLine = (text, label) => {
        for (const l of L3(text)) for (const pre of [`[x] ${label}`, `[ ] ${label}`, label]) {
          if (!l.startsWith(pre)) continue;
          const rest = l.slice(pre.length).replace(/^ \(sources? \d+(?:, \d+)*\)/, "");
          if (rest.startsWith(" - ") || rest.startsWith(": ")) return pre + rest;
        }
        return undefined;
      };
      // (1) An item answer a Scribe probe wrote reads as the clinician's record in the checklist too.
      const pa = Object.values(probeById).find((p) => p.target === "x_lowfreq");
      const yesIdx = pa ? arr(pa.opts).findIndex((o) => isObj(o.a) && o.a.x_lowfreq === "yes") : -1;
      const audio = arr(T.checklist).find((r) => arr(r.signals).some((sg) => sg.item === "x_lowfreq" && sg.render === "done"));
      if (c.check(yesIdx >= 0 && !!audio, "/round3/probe-written/dz4/@setup", null, "the probe option writing x_lowfreq yes, and its checklist row", { yesIdx, row: !!audio })) {
        const it = M.itemById.x_lowfreq;
        const st = { ...e3, answers: { v_aural: "yes", x_lowfreq: "yes" }, probeAns: { [pa.id]: yesIdx } };
        const t = build(M, "scribe", st);
        const want = `[x] ${audio.label} - ${RECORDED}: ${it.patientClin} (${recorded(pa.opts[yesIdx])})`;
        c.check(rowLine(t, audio.label) === want, "/round3/scribe/probe-written/dz4", { probe: pa.id, option: yesIdx }, want, rowLine(t, audio.label));
        const hist = `${it.patientClin}: yes (${RECORDED}: ${recorded(pa.opts[yesIdx])})`;
        c.check(L3(t).includes(hist), "/round3/scribe/probe-written/dz4/history", null, hist, L3(t).filter((l) => l.startsWith(it.patientClin)));
        const wantS = `[x] ${audio.label} - recorded on screen: ${it.patientClin}`;
        c.check(rowLine(build(M, "screener", st), audio.label) === wantS, "/round3/screener/probe-written/dz4", null, wantS, rowLine(build(M, "screener", st), audio.label));
        const tn = build(M, "scribe", { ...st, probeAns: {} });
        c.check(rowLine(tn, audio.label) === wantS, "/round3/scribe/no-probe/dz4", null, wantS, rowLine(tn, audio.label));
      }
      const ps = Object.values(probeById).find((p) => p.target === "x_objective");
      const noIdx = ps ? arr(ps.opts).findIndex((o) => isObj(o.a) && o.a.x_objective === "no") : -1;
      const si1 = arr(T.checklist).find((r) => arr(r.signals).some((sg) => sg.item === "x_objective" && sg.render === "answeredNo"));
      if (c.check(noIdx >= 0 && !!si1, "/round3/probe-written/si1/@setup", null, "the probe option writing x_objective no, and its checklist row", { noIdx, row: !!si1 })) {
        const xo = M.itemById.x_objective, rn = M.itemById.r_normal;
        const st = { ...e3, answers: { r_normal: "yes", x_objective: "no" }, probeAns: { [ps.id]: noIdx } };
        const t = build(M, "scribe", st);
        // Round 4: the probe's "Genuinely clear" option also ticks the row (its own probe signal, first),
        // and the r_normal note carries the qualifier "modality not recorded".
        const want = `[x] ${si1.label} - ${RECORDED}: ${ps.opts[noIdx].l}; ${RECORDED}, answered no: ${xo.patientClin} (${recorded(ps.opts[noIdx])}); screen records (context only; modality not recorded): ${rn.patientClin}`;
        c.check(rowLine(t, si1.label) === want, "/round3/scribe/probe-written/si1", { probe: ps.id, option: noIdx }, want, rowLine(t, si1.label));
        const wantS = `[ ] ${si1.label} - not recorded; screen answered no: ${xo.patientClin}; screen records (context only; modality not recorded): ${rn.patientClin}`;
        c.check(rowLine(build(M, "screener", st), si1.label) === wantS, "/round3/screener/probe-written/si1", null, wantS, rowLine(build(M, "screener", st), si1.label));
      }
      // (2) Under open flags an unrecorded Scribe review is said, last in the screen result.
      const base3 = stateOf(routed);
      const flag3 = M.redFlags[0];
      for (const [surface, reviewed, wantMissing] of [["scribe", false, true], ["scribe", true, false], ["screener", false, false]]) {
        const res = sectionOf(L3(build(M, surface, { ...base3, rf: { [flag3.id]: surface === "scribe" ? "nlp" : true }, safetyReviewed: reviewed })), "SCREEN RESULT") || [];
        c.check((res[res.length - 1] === REVIEW_MISSING) === wantMissing && res.filter((l) => l === REVIEW_MISSING).length === (wantMissing ? 1 : 0),
          `/round3/${surface}/flags/review-${reviewed ? "recorded" : "not-recorded"}`, { flag: flag3.id, reviewed }, wantMissing ? `${REVIEW_MISSING} (last)` : "no review sentence", res.slice(-2));
      }
      // (3) The gap line only when every marker hit; otherwise the context line of the markers that did.
      const gl = M.copy.note.gapLine;
      const gapCases = [
        [{ c_clin: "3+", c_dur: ">12mo", c_dismiss: "no" }, "context"],
        [{ c_clin: "0-1", c_dur: ">12mo", c_dismiss: "yes" }, "context"],
        [{ c_clin: "3+", c_dur: "<3mo", c_dismiss: "yes" }, "context"],
        [{ c_clin: "3+", c_dur: ">12mo", c_dismiss: "yes" }, "gapLine"],
        [{ c_clin: "3+", c_dur: "<3mo", c_dismiss: "no" }, "none"],
      ];
      for (const [ctx3, kind] of gapCases) {
        const g = rules.gapSignals(M, ctx3);
        c.check(g.alert === (kind !== "none"), `/round3/gap/${Object.values(ctx3).join(",")}/@alert`, ctx3, kind !== "none", g.alert);
        const want = kind === "gapLine" ? [gl] : kind === "context" ? [`Context: ${g.noteLabels.join("; ")}.`] : [];
        for (const surface of SURFACES) {
          const hpi = sectionOf(L3(build(M, surface, { ...e3, ctx: ctx3 })), "HISTORY OF PRESENT ILLNESS") || [];
          c.diff(want, hpi.filter((l) => l === gl || l.startsWith("Context: ")), { at: `/round3/${surface}/gap/${Object.values(ctx3).join(",")}`, input: ctx3 });
        }
      }
      c.check(L3(build(M, "screener", { ...e3, ctx: gapCases[0][0] })).includes("Context: duration >12 months; seen by 3+ clinicians."), "/round3/gap/example", gapCases[0][0],
        "Context: duration >12 months; seen by 3+ clinicians.", null);
      // (4) Domain points with denominators; nothing answered is "not answered", never zero points.
      const dl = (t) => L3(t).find((l) => l.startsWith("Domains — ")) || "";
      for (const surface of SURFACES) {
        const e = dl(build(M, surface, e3));
        c.check(M.domainOrder.every((k) => e.includes(`${M.domains.find((d) => d.key === k).label} not answered`)) && !/\d+\/-?\d+/.test(e), `/round3/${surface}/domains/empty`, null,
          "every domain not answered, no points", e);
        const sc = scoring.computeScore(M, allNegative);
        const plain = `Domains — ${M.domainOrder.map((k) => `${sc.domains[k].label} ${sc.domains[k].pts}/${sc.domains[k].max}`).join(" · ")}`;
        c.check(dl(build(M, surface, { ...e3, answers: allNegative })) === plain, `/round3/${surface}/domains/all-answered`, null, plain, dl(build(M, surface, { ...e3, answers: allNegative })));
        const mig = M.domains.find((d) => d.items.some((it) => it.id === "m_head"));
        const part = dl(build(M, surface, { ...e3, answers: { m_head: 2 } }));
        c.check(part.includes(`${mig.label} `) && part.includes(` (1 of ${mig.items.length} items answered)`), `/round3/${surface}/domains/partial`, { m_head: 2 },
          `${mig.label} x/${mig.max} (1 of ${mig.items.length} items answered)`, part);
      }
      // (5) The Scribe's destination line: a derive rule firing on a denied answer, and the module default.
      const best = (it) => it.scale.reduce((bi, o, i, a) => (o.f > a[bi].f ? i : bi), 0);
      const posAll = {};
      for (const d of M.domains) for (const it of d.items) {
        posAll[it.id] = d.negative ? (Array.isArray(it.scale) ? Math.max(0, it.scale.findIndex((o) => o.f === 0)) : "no") : (Array.isArray(it.scale) ? best(it) : "yes");
      }
      const head = M.itemById.m_head;
      const quirk = { answers: { ...posAll, m_head: head.scale.findIndex((o) => o.f === 0) }, ctx: {}, rf: {}, safetyReviewed: true };
      const xq = expectFor(M, "scribe", quirk);
      if (c.check(xq.state === "open" && xq.fired !== null && xq.fired === xq.complaint, "/round3/destination/rule/@setup", null, "an open referral whose picture a derive rule set on a denied m_head",
        { state: xq.state, fired: xq.fired, complaint: xq.complaint })) {
        const r = run(M, "scribe", quirk, "/round3/destination/rule", { answers: "positive, m_head None" });
        const plan = r ? sectionOf(L3(r.text), "PLAN") || [] : [];
        const want = `  (destination from the screen phenotype by module rule: ${xq.picture}; confirm)`;
        c.check(plan[3] === want && plan[0] === bundleReferral(xq.bundle).code, "/round3/destination/rule", null, [bundleReferral(xq.bundle).code, want], [plan[0], plan[3]]);
        const ts = build(M, "screener", { ...quirk, complaint: xq.complaint });
        c.check(!ts.includes("(destination from"), "/round3/destination/screener", null, "no destination line on the Screener (the clinician picked the picture)", null);
      }
      const noRule = { ...posAll };
      for (const id of ["v_motion", "v_aural", "v_head"]) noRule[id] = "no";
      delete noRule.v_vertigo;
      const fb = { answers: noRule, ctx: {}, rf: {}, safetyReviewed: true };
      const xf = expectFor(M, "scribe", fb);
      if (c.check(xf.state === "open" && xf.fired === null && !xf.phenotypeError, "/round3/destination/default/@setup", null, "an open referral on the module's default picture (no derive rule fired)",
        { state: xf.state, fired: xf.fired, complaint: xf.complaint })) {
        const r = run(M, "scribe", fb, "/round3/destination/default", { answers: "positive, no vestibular item" });
        const plan = r ? sectionOf(L3(r.text), "PLAN") || [] : [];
        const want = `  (destination from the module's default phenotype: ${xf.picture}; confirm)`;
        c.check(plan[3] === want, "/round3/destination/default", null, want, plan[3]);
        c.check((sectionOf(L3(r ? r.text : ""), "REASON FOR CONSULT") || [])[0] === PICTURE_PLACEHOLDER, "/round3/destination/default/picture", null, PICTURE_PLACEHOLDER, null);
      }
      // (6) Qualifiers on the two workup items: an answered no is not a found lesion or an abnormal workup.
      for (const id of ["r_normal", "r_lesion"]) {
        const row = arr(T.history).find((r) => r.item === id);
        c.check(!!row && row.qualifier === "workup not recorded", `/round3/history-qualifier/${id}`, null, "workup not recorded", row && row.qualifier);
        const it = M.itemById[id];
        for (const surface of SURFACES) {
          c.check(L3(build(M, surface, { ...e3, answers: { [id]: "no" } })).includes(`${it.patientClin}: answered no (workup not recorded)`), `/round3/${surface}/${id}/no`, { [id]: "no" },
            `${it.patientClin}: answered no (workup not recorded)`, L3(build(M, surface, { ...e3, answers: { [id]: "no" } })).filter((l) => l.startsWith(it.patientClin)));
          c.check(L3(build(M, surface, { ...e3, answers: { [id]: "yes" } })).includes(`${it.patientClin}: yes`), `/round3/${surface}/${id}/yes`, { [id]: "yes" }, `${it.patientClin}: yes`, null);
        }
      }
      // (7) The data changes of round 3.
      const si1Row = arr(T.checklist).find((r) => r.id === "si1"), al3Row = arr(T.checklist).find((r) => r.id === "al3");
      c.check(!!si1Row && si1Row.label === "Objective sinus evaluation (rhinoscopy, endoscopy or CT)", "/round3/data/si1", null, "Objective sinus evaluation (rhinoscopy, endoscopy or CT)", si1Row && si1Row.label);
      c.check(!!al3Row && al3Row.label === "Specific-IgE allergy testing (skin or serum)" && al3Row.placeholder === "date / result", "/round3/data/al3", null,
        "Specific-IgE allergy testing (skin or serum) [date / result]", al3Row && [al3Row.label, al3Row.placeholder]);
      c.check(!!T.citations.AHA26 && T.citations.AHA26.url === "https://doi.org/10.1161/STR.0000000000000513", "/round3/data/AHA26", null, "the verified register's DOI URL", T.citations.AHA26 && T.citations.AHA26.url);
      const mo = arr(T.history).find((r) => r.label === "Acute headache medication use — days per month, by class");
      c.check(!!mo && mo.probe === undefined && mo.item === undefined, "/round3/data/medication-days", null, "the acute-medication placeholder row (D13)", mo);
      for (const surface of SURFACES) {
        const t = build(M, surface, e3);
        c.check(L3(t).includes("Acute headache medication use — days per month, by class: [ ]"), `/round3/${surface}/medication-days`, null, "Acute headache medication use — days per month, by class: [ ]", null);
        // (8) One numbered source list after the plan; the first cited exam row is source 1.
        const L = L3(t);
        const firstCited = arr(T.examRows).find((r) => arr(r.citations).length);
        const exLine = L.find((l) => l.startsWith(`${firstCited.label} (source`));
        const refs = sectionOf(L, SOURCES_HEADING) || [];
        c.check(!!exLine && /^ ?\(sources? 1[,)]/.test(exLine.slice(firstCited.label.length + 1)) && refs.length > 0 && refs.every((l, i) => l.startsWith(`${i + 1}. `)),
          `/round3/${surface}/references`, null, "the first cited exam row is source 1; the list is numbered 1..n", { exLine, first: refs[0] });
      }
    }

    // ------------------------------------------------------------------ review round 4
    {
      const e4 = { answers: {}, ctx: {}, complaint: "", rf: {}, safetyReviewed: true };
      const si1 = arr(T.checklist).find((r) => r.id === "si1");
      // The row's line, with its sources mark taken out.
      const rowOf = (text) => {
        for (const l of linesOf(text)) for (const pre of [`[x] ${si1.label}`, `[ ] ${si1.label}`]) {
          if (l.startsWith(pre)) return pre + l.slice(pre.length).replace(/^ \(sources? \d+(?:, \d+)*\)/, "");
        }
        return undefined;
      };
      const scan = probeById.pr_scan_detail;
      const clearIdx = scan ? arr(scan.opts).findIndex((o) => o.l === "Genuinely clear") : -1;
      const realIdx = scan ? arr(scan.opts).findIndex((o) => isObj(o.a) && o.a.x_objective === "yes") : -1;
      if (c.check(!!si1 && clearIdx >= 0 && realIdx >= 0 && scan.target === "x_objective" && isObj(scan.opts[clearIdx].a) && scan.opts[clearIdx].a.x_objective === "no",
        "/round4/si1/@setup", null, "the SI1 row and pr_scan_detail's two options (Genuinely clear writes x_objective no)", { row: !!si1, clearIdx, realIdx })) {
        const xo = M.itemById.x_objective, rn = M.itemById.r_normal;
        // (1) The data: the probe signal comes first, before the item signals, and renders done.
        c.diff({ probe: "pr_scan_detail", option: clearIdx, render: "done" }, si1.signals[0], { at: "/round4/data/si1/probe-signal" });
        c.check(si1.signals.slice(1).every((sg) => sg.item !== undefined), "/round4/data/si1/order", null, "the probe signal before every item signal", si1.signals.map((sg) => sg.item || sg.probe));
        // (2) A clear scan the clinician recorded ticks the row, as recorded via probe; the item's
        // answered no (which the probe wrote) still follows, with the probe's answer.
        const clear = { ...e4, answers: { r_normal: "yes", x_objective: "no" }, probeAns: { pr_scan_detail: clearIdx } };
        const wantClear = `[x] ${si1.label} - ${RECORDED}: Genuinely clear; ${RECORDED}, answered no: ${xo.patientClin} (Genuinely clear); screen records (context only; modality not recorded): ${rn.patientClin}`;
        c.check(rowOf(build(M, "scribe", clear)) === wantClear, "/round4/scribe/si1/clear", { probe: "pr_scan_detail", option: clearIdx }, wantClear, rowOf(build(M, "scribe", clear)));
        // the probe alone, without its written answer in the state: the probe signal still ticks it
        const clearOnly = { ...e4, probeAns: { pr_scan_detail: clearIdx } };
        c.check(rowOf(build(M, "scribe", clearOnly)) === `[x] ${si1.label} - ${RECORDED}: Genuinely clear`, "/round4/scribe/si1/clear-probe-only", { probe: "pr_scan_detail", option: clearIdx },
          `[x] ${si1.label} - ${RECORDED}: Genuinely clear`, rowOf(build(M, "scribe", clearOnly)));
        // (3) Never from the screen: the same answers without the probe, or on the Screener (no probes),
        // leave the row unticked; a screen "no" is answered no, never done.
        const wantNo = `[ ] ${si1.label} - not recorded; screen answered no: ${xo.patientClin}; screen records (context only; modality not recorded): ${rn.patientClin}`;
        c.check(rowOf(build(M, "scribe", { ...clear, probeAns: {} })) === wantNo, "/round4/scribe/si1/no-probe", { x_objective: "no" }, wantNo, rowOf(build(M, "scribe", { ...clear, probeAns: {} })));
        c.check(rowOf(build(M, "screener", clear)) === wantNo, "/round4/screener/si1/probe-ignored", { probe: "pr_scan_detail", option: clearIdx }, wantNo, rowOf(build(M, "screener", clear)));
        // (4) The other option ticks it through the item it wrote, never through the probe signal.
        const real = { ...e4, answers: { r_normal: "yes", x_objective: "yes" }, probeAns: { pr_scan_detail: realIdx } };
        const wantReal = `[x] ${si1.label} - ${RECORDED}: ${xo.patientClin} (${recorded(scan.opts[realIdx])}); screen records (context only; modality not recorded): ${rn.patientClin}`;
        c.check(rowOf(build(M, "scribe", real)) === wantReal, "/round4/scribe/si1/real-inflammation", { probe: "pr_scan_detail", option: realIdx }, wantReal, rowOf(build(M, "scribe", real)));
        // (5) The r_normal note's qualifier, on both surfaces; an r_normal no prints no note.
        const q = si1.signals.find((sg) => sg.item === "r_normal");
        c.check(!!q && q.render === "note" && q.qualifier === "modality not recorded", "/round4/data/si1/r_normal-qualifier", null, "r_normal note, qualifier modality not recorded", q);
        for (const surface of SURFACES) {
          const ry = rowOf(build(M, surface, { ...e4, answers: { r_normal: "yes" } }));
          const wantRy = `[ ] ${si1.label} - not recorded; screen records (context only; modality not recorded): ${rn.patientClin}`;
          c.check(ry === wantRy, `/round4/${surface}/si1/r_normal/yes`, { r_normal: "yes" }, wantRy, ry);
          const rnNo = rowOf(build(M, surface, { ...e4, answers: { r_normal: "no" } }));
          c.check(rnNo === `[ ] ${si1.label} - not recorded`, `/round4/${surface}/si1/r_normal/no`, { r_normal: "no" }, `[ ] ${si1.label} - not recorded`, rnNo);
        }
        // the same states through the whole oracle
        for (const [name, st] of [["clear", clear], ["real", real]]) for (const surface of SURFACES) run(M, surface, st, `/round4/${surface}/si1/${name}/verify`, { name, surface });
      }
    }

    // ------------------------------------------------------------------ release 0.4.5: the referral rule for dizziness cases
    {
      const L5 = (t) => linesOf(t);
      const plan5 = (t) => sectionOf(L5(t), "PLAN") || [];
      const vm = probeById.pr_internal_vertigo;
      c.check(!!vm && vm.opts.length === 3, "/release045/@probe", null, "pr_internal_vertigo with three options", vm && vm.opts.length);
      const recLines = (x) => x.routing.recs.map((r) => `- ${r.h}. ${r.p}`);
      /** The block's lines and where they sit: right above the first recommendation line. */
      const blockAt = (text) => {
        const plan = plan5(text);
        const i = plan.indexOf(LEAD_RULE_BLOCK[0]);
        return { plan, i };
      };
      /** No line of the superseded automatic escalation, anywhere in the note. */
      const noEscalation = (text, at) => {
        const bad = L5(text).filter((l) => l.startsWith("True vertigo recorded") || l.includes("escalated by the module's referral rule") || l.startsWith("Escalation evidence"));
        c.check(!bad.length, `${at}/no-escalation`, null, "no evidence line and no escalation words", bad);
      };
      // The block written out above: its definition lines sit between the two labels, name neither
      // swaying nor bobbing (the lead's amendment of 2026-10-10), and the clarification is the
      // lead's of 2026-10-09, which still names rocking and bobbing as not true vertigo.
      c.check(LEAD_RULE_BLOCK[1].startsWith("Definition (") && LEAD_RULE_BLOCK[5].startsWith("Clarification (") && LEAD_DEFINITION_LINES.length === 3
        && !LEAD_DEFINITION_LINES.some((l) => /swaying|bobbing/i.test(l)) && LEAD_RULE_BLOCK[6].includes("A rocking or bobbing sensation is not true vertigo"),
        "/release045/@block", null, "three definition lines between the labels, none naming swaying or bobbing; the clarification unchanged", LEAD_DEFINITION_LINES);
      /** The printed definition is the amended one: its lines name neither swaying nor bobbing, and the 2026-10-07 line prints nowhere. */
      const amendedDefinition = (text, plan, i, at) => {
        const printed = i >= 0 ? plan.slice(i + 2, i + 2 + LEAD_DEFINITION_LINES.length) : [];
        c.check(printed.length === LEAD_DEFINITION_LINES.length && !printed.some((l) => /swaying|bobbing/i.test(l)) && !L5(text).includes(SUPERSEDED_INTERNAL_VERTIGO),
          `${at}/definition-amended`, null, "the definition as amended on 2026-10-10: no swaying or bobbing, the 2026-10-07 line nowhere", printed);
      };
      const PROBES = [["no-probe-answer", undefined], ["option-0", { pr_internal_vertigo: 0 }], ["option-1", { pr_internal_vertigo: 1 }], ["option-2", { pr_internal_vertigo: 2 }]];
      for (const surface of SURFACES) {
        for (const [complaint, code] of DIZZINESS) {
          const base = stateOf(routed, { complaint });
          for (const [name, probeAns] of PROBES) {
            const s = probeAns ? { ...base, probeAns } : base;
            const at = `/release045/${surface}/${complaint}/${name}`;
            const text = build(M, surface, s);
            const x = expectFor(M, surface, s);
            const { plan, i } = blockAt(text);
            c.check(x.state === "open", `${at}/@state`, null, "open", x.state);
            // the lead's rule, definition and clarification verbatim, then the two placeholders, nothing more
            c.diff(LEAD_RULE_BLOCK, i >= 0 ? plan.slice(i, i + LEAD_RULE_BLOCK.length) : null, { at: `${at}/block`, input: { surface, complaint, probeAns } });
            c.check(L5(text).filter((l) => l === LEAD_RULE_BLOCK[0]).length === 1, `${at}/block/once`, null, "the rule printed once", L5(text).filter((l) => l === LEAD_RULE_BLOCK[0]).length);
            amendedDefinition(text, plan, i, at);
            // right above the recommendations, under the consultant placeholders
            const recs = recLines(x);
            c.check(i >= 2 && plan[i - 1] === CONSULTANT[1] && (recs.length ? plan[i + LEAD_RULE_BLOCK.length] === recs[0] : plan[i + LEAD_RULE_BLOCK.length] === `- ${M.copy.note.noDriver}`), `${at}/place`, null,
              "after the consultant placeholders, right above the recommendations", { before: plan[i - 1], after: plan[i + LEAD_RULE_BLOCK.length] });
            // the referral line: Neurology, whatever the probe answers (no automatic escalation), the bundle's
            c.check(plan[0] === code && bundleReferral(x.bundle).code === code, `${at}/referral`, null, code, [plan[0], bundleReferral(x.bundle).code]);
            // the Scribe's destination line names the picture only
            const dest = plan.find((l) => l.startsWith("  (destination from"));
            if (surface === "scribe") c.check(!!dest && dest.endsWith("; confirm)"), `${at}/destination`, null, "the destination line, no escalation words", dest);
            else c.check(dest === undefined, `${at}/destination`, null, "no destination line on the Screener", dest);
            noEscalation(text, at);
            // the module's recommendation text is unchanged and still printed below the rule
            const vmRec = x.routing.recs.find((r) => r.p.includes("Refer neuro-otology / vestibular therapy"));
            if (vmRec) c.check(plan.indexOf(`- ${vmRec.h}. ${vmRec.p}`) > i, `${at}/recommendation-unchanged`, null, "the module's recommendation, verbatim, below the rule", null);
          }
          // Lowest band: the clinician placeholder, the rule above the recommendations, no evidence line.
          const low = { answers: allNegative, ctx: {}, complaint, rf: {}, safetyReviewed: true, probeAns: { pr_internal_vertigo: 0 } };
          const tl = build(M, surface, low);
          const { plan: pl, i: il } = blockAt(tl);
          c.check(pl[0] === "Referral: [clinician decision]", `/release045/${surface}/${complaint}/lowest-band/placeholder`, null, "Referral: [clinician decision]", pl[0]);
          c.diff(LEAD_RULE_BLOCK, il >= 0 ? pl.slice(il, il + LEAD_RULE_BLOCK.length) : null, { at: `/release045/${surface}/${complaint}/lowest-band/block`, input: { surface, complaint } });
          amendedDefinition(tl, pl, il, `/release045/${surface}/${complaint}/lowest-band`);
          noEscalation(tl, `/release045/${surface}/${complaint}/lowest-band`);
          // Release 0.4.6 (the reading of "also"): a red flag over this open screen prints the rule
          // block once, verbatim, under the heading saying the FHIR bundle withholds the referral.
          {
            const tf = build(M, surface, { ...base, rf: { rf_asym: surface === "scribe" ? "md" : true }, probeAns: { pr_internal_vertigo: 0 } });
            const { plan: pf, i: iff } = blockAt(tf);
            c.diff(LEAD_RULE_BLOCK, iff >= 0 ? pf.slice(iff, iff + LEAD_RULE_BLOCK.length) : null, { at: `/release045/${surface}/${complaint}/flag/block`, input: { surface, complaint } });
            c.check(iff > pf.indexOf(ALSO) && pf.indexOf(ALSO) >= 0 && L5(tf).filter((l) => l === LEAD_RULE_BLOCK[0]).length === 1, `/release045/${surface}/${complaint}/flag/under-heading`, null,
              "the rule once, under the 0.4.6 heading", { heading: pf.indexOf(ALSO), rule: iff });
            amendedDefinition(tf, pf, iff, `/release045/${surface}/${complaint}/flag`);
            noEscalation(tf, `/release045/${surface}/${complaint}/flag`);
          }
          // Gates first: an unscorable screen or (Scribe) an unrecorded review print no rule, flag or not.
          const closedStates = [["unscorable", { answers: {}, ctx: {}, complaint, rf: {}, safetyReviewed: true, probeAns: { pr_internal_vertigo: 0 } }],
            ["flag-unscorable", { answers: {}, ctx: {}, complaint, rf: { rf_asym: surface === "scribe" ? "md" : true }, safetyReviewed: true, probeAns: { pr_internal_vertigo: 0 } }]];
          if (surface === "scribe") closedStates.push(["unreviewed", { ...base, safetyReviewed: false, probeAns: { pr_internal_vertigo: 0 } }]);
          for (const [name, s] of closedStates) {
            const t = build(M, surface, s);
            c.check(!L5(t).some((l) => LEAD_RULE_BLOCK.includes(l) || l === SUPERSEDED_INTERNAL_VERTIGO || l.startsWith("Referral rule") || l.startsWith("Clarification")), `/release045/${surface}/${complaint}/${name}/no-rule`, null,
              "no referral rule (gate, don't warn)", L5(t).filter((l) => LEAD_RULE_BLOCK.includes(l)));
            noEscalation(t, `/release045/${surface}/${complaint}/${name}`);
          }
        }
        // Not a dizziness case: no rule, whatever the probe answers. For a declared non-dizziness
        // phenotype (sinonasal) the destination is the module's default (the lead's rule); with no
        // complaint, which is not a declared phenotype value, no referral is issued and the plan
        // prints the clinician placeholder, agreeing with the bundle (decision F11, AD20).
        for (const v of ["sinonasal", ""]) {
          if (v === "" && surface === "scribe") continue;
          const t = build(M, surface, stateOf(routed, { complaint: v, probeAns: { pr_internal_vertigo: 0 } }));
          c.check(!L5(t).some((l) => LEAD_RULE_BLOCK.includes(l) || l === SUPERSEDED_INTERNAL_VERTIGO || l.startsWith("Referral rule") || l.startsWith("Clarification")), `/release045/${surface}/${v || "(none)"}/no-rule`, null, "no referral rule",
            L5(t).filter((l) => LEAD_RULE_BLOCK.includes(l)));
          if (v === "") {
            c.check(plan5(t)[0] === "Referral: [clinician decision]", `/release045/${surface}/(none)/referral`, null,
              "Referral: [clinician decision] (no declared complaint, no referral; F11, AD20)", plan5(t)[0]);
            c.check(!L5(t).includes(REFS_HEADING), `/release045/${surface}/(none)/no-references`, null,
              "no references without a referral (F11, AD20)", L5(t).filter((l) => l === REFS_HEADING));
          } else {
            c.check(plan5(t)[0] === "Referral: Headache medicine / Neurology — evaluate for mid-facial / migrainous cause", `/release045/${surface}/${v}/referral`, null,
              "Referral: Headache medicine / Neurology — evaluate for mid-facial / migrainous cause", plan5(t)[0]);
          }
        }
      }
      // A Scribe complaint derived by the module's rule: the otologic sample without the answers that
      // make the derive rule give "both" derives otologic; the same encounter with headache severity
      // answered "None" derives both (D14). Both are dizziness cases: Neurology and the lead's rule,
      // whatever pr_internal_vertigo records. These explicit cases must run (a setup that no longer
      // derives what it should with the gate open is a failure, never a note).
      const da = { ...sample("otologic").a };
      delete da.m_head;
      for (const id of ["r_abx", "r_surg"]) if (da[id] === "yes") da[id] = "no";
      for (const [name, answers, want, code] of [["derived-otologic", da, "otologic", DIZZINESS[0][1]], ["derived-both", { ...da, m_head: 0 }, "both", DIZZINESS[1][1]]]) {
        for (const [pn, probeAns] of PROBES) {
          const derived = { ...stateOf(sample("otologic")), answers, complaint: undefined, ...(probeAns ? { probeAns } : {}) };
          const xd = expectFor(M, "scribe", derived);
          const at = `/release045/scribe/${name}/${pn}`;
          c.check(xd.complaint === want && xd.state === "open", `${at}/@setup`, null, `${want} / open`, `${xd.complaint} / ${xd.state}`);
          if (xd.complaint === want && xd.state === "open") {
            const td = build(M, "scribe", derived);
            const { plan, i } = blockAt(td);
            c.check(plan[0] === code && bundleReferral(xd.bundle).code === code, `${at}/referral`, null, code, [plan[0], bundleReferral(xd.bundle).code]);
            c.diff(LEAD_RULE_BLOCK, i >= 0 ? plan.slice(i, i + LEAD_RULE_BLOCK.length) : null, { at: `${at}/block`, input: { name, probeAns } });
            amendedDefinition(td, plan, i, at);
            noEscalation(td, at);
          }
        }
      }
      for (const [name, st] of [
        ["otologic/option-0", stateOf(routed, { complaint: "otologic", probeAns: { pr_internal_vertigo: 0 } })],
        ["both/option-1", stateOf(routed, { complaint: "both", probeAns: { pr_internal_vertigo: 1 } })],
        ["lowest/both", { answers: allNegative, ctx: {}, complaint: "both", rf: {}, safetyReviewed: true, probeAns: { pr_internal_vertigo: 1 } }]]) {
        for (const surface of SURFACES) run(M, surface, st, `/release045/${surface}/${name}/verify`, { name, surface });
      }
      // The signed-off emrTemplate block is untouched: the new strings live in phenotypes.referral.
      const emrJson = JSON.stringify(M.emrTemplate);
      c.check(!emrJson.includes("True vertigo") && !emrJson.includes("Referral rule") && !emrJson.includes("meniere") && !emrJson.includes("Clarification"), "/release045/emrTemplate-untouched", null,
        "no rule string in emrTemplate", null);
    }

    // ------------------------------------------------------------------ release 0.4.6: the clinical lead's answers on the open items
    {
      const urgent = M.redFlags.find((f) => vocab.TIER_RANK[f.tier] !== 0) || M.redFlags[0];
      for (const surface of SURFACES) {
        for (const complaint of ["otologic", "both", "sinonasal"]) {
          // (a) The reading of "also": the same screen with and without one open flag. Under the
          // heading the flagged plan prints the unflagged plan's referral block, references, checklist
          // and follow-up line, line for line, without its recommendations (and their chip lines).
          const at = `/release046/${surface}/${complaint}`;
          const s0 = stateOf(routed, { complaint });
          const s1 = { ...s0, rf: { [urgent.id]: surface === "scribe" ? "md" : true } };
          const t0 = build(M, surface, s0), t1 = build(M, surface, s1);
          const x0 = expectFor(M, surface, s0), x1 = expectFor(M, surface, s1);
          const p0 = sectionOf(linesOf(t0), "PLAN") || [], p1 = sectionOf(linesOf(t1), "PLAN") || [];
          c.check(x0.state === "open" && x1.state === "flag" && x1.plainState === "open", `${at}/@states`, null, "open, and flag over an open screen", [x0.state, x1.state, x1.plainState]);
          const iRecs = p0.findIndex((l) => x0.routing.recs.some((r) => l === `- ${r.h}. ${r.p}`));
          const iRefs = p0.indexOf(REFS_HEADING);
          c.check(iRecs > 0 && iRefs > iRecs, `${at}/@unflagged`, null, "recommendations, then the references, in the unflagged plan", { iRecs, iRefs });
          const want = [...p0.slice(0, iRecs), ...p0.slice(iRefs)];
          const iAlso = p1.indexOf(ALSO);
          c.diff(want, iAlso >= 0 ? p1.slice(iAlso + 1) : null, { at: `${at}/also`, input: { surface, complaint, flag: urgent.id } });
          c.check(iAlso >= 2 && p1[iAlso - 1] === WITHHELD && p1[iAlso - 2] === WORKUP, `${at}/also/heading`, null, [WORKUP, WITHHELD, ALSO], p1.slice(Math.max(0, iAlso - 2), iAlso + 1));
          c.check(bundleReferral(x1.bundle) === null && bundleReferral(x1.plainBundle) !== null && p1.includes(bundleReferral(x1.plainBundle).code), `${at}/also/bundle`, null,
            "the note prints the referral the bundle withholds", { bundle: bundleReferral(x1.bundle), note: noteReferral(linesOf(t1)) });
          // The dizziness cases print the lead's rule block under the flag too.
          if (complaint !== "sinonasal") c.check(p1.includes(LEAD_RULE_BLOCK[0]) && p1.indexOf(LEAD_RULE_BLOCK[0]) > iAlso, `${at}/also/rule`, null, "the lead's rule under the heading", null);
          // (b) Considerations: the unflagged assessment is the band headline, the recommendations'
          // headings and the clinician placeholder; under the flag, the override sentence and the placeholder.
          const heads = [...new Set(x0.routing.recs.map((r) => r.h))];
          c.diff([`Screen: ${BAND_LABEL[x0.score.band]} ${M.copy.screener.bandSuffix} (${CAV.illustrative})`, `Considerations: ${heads.join("; ")}`, "Clinician assessment / differential: [ ]"],
            sectionOf(linesOf(t0), "ASSESSMENT"), { at: `${at}/assessment` });
          c.diff([`Red flag present — evaluate on its own terms before treating this as a ${M.copy.note.patternPhrase}.`, "Clinician assessment / differential: [ ]"],
            sectionOf(linesOf(t1), "ASSESSMENT"), { at: `${at}/assessment/flag` });
        }
        // (c) An open flag with the Scribe's review unrecorded, an unscorable screen and the lowest band.
        if (surface === "scribe") {
          const t = build(M, surface, { ...stateOf(routed), rf: { [urgent.id]: "md" }, safetyReviewed: false });
          const p = sectionOf(linesOf(t), "PLAN") || [];
          c.check(p[p.indexOf(ALSO) + 1] === SAFETY_NOT_RECORDED && !p.some((l) => /^Referral: /.test(l)), `/release046/${surface}/unreviewed`, null, [ALSO, SAFETY_NOT_RECORDED], p.slice(p.indexOf(ALSO), p.indexOf(ALSO) + 2));
        }
        {
          const t = build(M, surface, { answers: {}, ctx: {}, complaint: "otologic", rf: { [urgent.id]: surface === "scribe" ? "md" : true }, safetyReviewed: true });
          const p = sectionOf(linesOf(t), "PLAN") || [];
          c.check(p[p.indexOf(ALSO) + 1] === NOT_SCORABLE && !p.includes(REFS_HEADING), `/release046/${surface}/unscorable`, null, [ALSO, NOT_SCORABLE], p.slice(p.indexOf(ALSO), p.indexOf(ALSO) + 2));
        }
        {
          const t = build(M, surface, { answers: allNegative, ctx: {}, complaint: "otologic", rf: { [urgent.id]: surface === "scribe" ? "md" : true }, safetyReviewed: true });
          const p = sectionOf(linesOf(t), "PLAN") || [];
          const i = p.indexOf(ALSO);
          c.diff([ALSO, "Referral: [clinician decision]", ...CONSULTANT, ...LEAD_RULE_BLOCK], p.slice(i, i + 4 + LEAD_RULE_BLOCK.length), { at: `/release046/${surface}/lowest-band` });
          c.check(!p.includes(REFS_HEADING), `/release046/${surface}/lowest-band/no-references`, null, "no references at the lowest band", null);
        }
        // (d) The past-history section, written out, for each state of the family-history item.
        for (const [v, word] of [["yes", "yes"], ["no", "answered no"], [undefined, "not recorded"], ["unsure", "not recorded"]]) {
          const answers = { ...routed.a };
          if (v === undefined) delete answers.m_fhx; else answers.m_fhx = v;
          const t = build(M, surface, stateOf(routed, { answers }));
          c.diff([...PAST_MEDICAL, MODIFYING_ROW, ...PAST_OTHER, `Personal or family history of migraine: ${word}`, "Other family history: [ ]"],
            sectionOf(linesOf(t), "PAST HISTORY / MEDICATIONS / ALLERGIES"), { at: `/release046/${surface}/past-history/${v === undefined ? "unanswered" : v}` });
          const ros = sectionOf(linesOf(t), ROS_HEADING) || [];
          c.check(!ros.some((l) => l.includes("Personal or family history of migraine") || l.includes("migraine hx")), `/release046/${surface}/past-history/${v === undefined ? "unanswered" : v}/ros`, null,
            "the item not repeated in the review of systems", ros.filter((l) => l.includes("family history")));
        }
        // (e) The HINTS placeholder: under the row only when the Scribe records the central option.
        const hi = probeById.pr_head_impulse;
        c.check(!!hi && hi.opts[0].l === "Normal impulse (points central)", `/release046/${surface}/hints/@probe`, null, "option 0 is the central pattern", hi && hi.opts[0].l);
        for (const idx of [0, 1, 2, null]) {
          const t = build(M, surface, idx === null ? stateOf(routed) : stateOf(routed, { probeAns: { pr_head_impulse: idx } }));
          const exam = sectionOf(linesOf(t), "PHYSICAL EXAM") || [];
          const i = exam.findIndex((l) => l.startsWith("Head impulse / nystagmus / test of skew (HINTS)"));
          const wantPlaceholder = surface === "scribe" && idx === 0;
          c.check(i >= 0 && (exam[i + 1] === HINTS_PLACEHOLDER) === wantPlaceholder && exam.filter((l) => l === HINTS_PLACEHOLDER).length === (wantPlaceholder ? 1 : 0),
            `/release046/${surface}/hints/${idx === null ? "unanswered" : idx}`, null, wantPlaceholder ? `the row, then ${HINTS_PLACEHOLDER.trim()}` : "no placeholder", exam.slice(i, i + 2));
        }
      }
      // (f) V61 on the new data: the shipped data passes; malformed rows are errors.
      const v61 = async (mutate, name, wantPath) => {
        const r = JSON.parse(JSON.stringify(M.rubric));
        mutate(r.emrTemplate);
        let errs = [];
        try {
          const mod = await bind.bindModule(r, M.logic, meta(`fixture:emr-046-${name}`));
          errs = (await validate.validateModule({ module: mod, loaded: [] })).errors.filter((e) => e.code === "V61");
        } catch (err) { errs = [{ path: "(bind threw)", msg: String(err && err.message || err) }]; }
        c.check(errs.some((e) => e.path.startsWith(wantPath)), `/release046/v61/${name}`, null, `a V61 error at ${wantPath}`, errs.map((e) => `${e.path}: ${e.msg}`).slice(0, 3));
      };
      c.check(!(validation.errors || []).some((e) => e.code === "V61") && !(validation.warnings || []).some((e) => e.code === "V61"), "/release046/v61/shipped", null, "no V61 finding on the shipped data",
        [...(validation.errors || []), ...(validation.warnings || [])].filter((e) => e.code === "V61").map((e) => `${e.path}: ${e.msg}`));
      await v61((t) => { t.pastHistory[0].group = "social"; }, "group", "/emrTemplate/pastHistory/0/group");
      await v61((t) => { t.pastHistory[1].item = "no_such_item"; }, "item", "/emrTemplate/pastHistory/1/item");
      await v61((t) => { t.pastHistory.push({ item: t.history.find((r) => r.item !== undefined).item, group: "family" }); }, "twice", "/emrTemplate/pastHistory/2/item");
      await v61((t) => { t.pastHistory[0].label = "Modifying [conditions]"; }, "brackets", "/emrTemplate/pastHistory/0/label");
      await v61((t) => { t.examRows[14].optionPlaceholders[0].option = 7; }, "option", "/emrTemplate/examRows/14/optionPlaceholders/0/option");
      await v61((t) => { t.examRows[14].optionPlaceholders.push({ option: 0, placeholder: "again" }); }, "option-twice", "/emrTemplate/examRows/14/optionPlaceholders/1/option");
      await v61((t) => { t.examRows[0].optionPlaceholders = [{ option: 0, placeholder: "x" }]; }, "no-probe", "/emrTemplate/examRows/0/optionPlaceholders");
    }

    // ------------------------------------------------------------------ determinism
    {
      const s = { ...stateOf(sample("redflag")), probeAns: { pr_temporal_artery: 1 }, vmp: {} };
      const before = JSON.stringify(s);
      for (const surface of SURFACES) {
        const a = h.withFixedClock("2026-10-01T12:00:00.000Z", () => build(M, surface, s));
        const b = h.withFixedClock("2031-01-02T03:04:05.000Z", () => build(M, surface, s));
        c.check(a === b && a === build(M, surface, s), `/determinism/${surface}`, null, "the same text whatever the clock, every time", "differs");
      }
      c.check(JSON.stringify(s) === before, "/determinism/inputs", null, "the state untouched", "mutated");
      const scribeDerived = build(M, "scribe", { ...stateOf(routed), complaint: undefined });
      const ph = rules.derivePhenotype(M, stateOf(routed).answers);
      c.check(scribeDerived === build(M, "scribe", { ...stateOf(routed), complaint: ph.value, phenotypeError: ph.error }), "/determinism/scribe-derived-complaint", null,
        "an omitted Scribe complaint is derivePhenotype's", "differs");
    }

    // ------------------------------------------------------------------ the neutral template
    {
      const { module: shape, validation: sv } = await h.loadFixture("shape", { builtins: [M], loaded: [M] });
      c.check(sv.ok && !shape.emrTemplate, "/neutral/shape/fixture", null, "a valid module without emrTemplate", { ok: sv.ok, emrTemplate: !!shape.emrTemplate });
      const { emrTemplate: _drop, ...rest } = M.rubric;
      const bare = await bind.bindModule(rest, M.logic, meta("fixture:emr-masque-without-template"));
      c.check(bare.emrTemplate === null, "/neutral/bare/bound", null, "module.emrTemplate null", bare.emrTemplate);
      const urls = Object.values(cites).map((x) => x.url);
      const answersAll = Object.fromEntries(shape.allItems.map((it) => [it.id, Array.isArray(it.scale) ? it.scale.length - 1 : "yes"]));
      const cases = [
        [shape, "shape/flag", { answers: answersAll, ctx: {}, complaint: "", rf: Object.fromEntries(shape.redFlags.map((f) => [f.id, true])), safetyReviewed: true }],
        [shape, "shape/all", { answers: answersAll, ctx: {}, complaint: "", rf: {}, safetyReviewed: true }],
        [shape, "shape/empty", { answers: {}, ctx: {}, complaint: "", rf: {}, safetyReviewed: false }],
        [bare, "bare/open", stateOf(routed)],
        [bare, "bare/flag", stateOf(sample("redflag"))],
      ];
      for (const [mod, name, s] of cases) {
        for (const surface of SURFACES) {
          const at = `/neutral/${name}/${surface}`;
          const r = run(mod, surface, s, at, { module: mod.id, surface }, { full: false });
          if (!r) continue;
          const L = linesOf(r.text);
          c.check(!L.includes(REFS_HEADING) && !L.some((l) => /^\s*Ref: /.test(l) || /^\[[ x]\] /.test(l) || /^Medical management not yet offered/.test(l) || l === REF_NOTE || l === SOURCES_HEADING),
            `${at}/no-module-data`, null, "no references, no Ref: line, no checklist, no sources", L.filter((l) => /Ref: |^\[[ x]\] |^Medical|^Empiric|sources:$/.test(l)).slice(0, 4));
          c.diff(["Treatment and investigations to date: [ ]"], sectionOf(L, "TREATMENT AND WORKUP TO DATE (from screen)"), { at: `${at}/history` });
          c.diff(["Vitals: BP [ ] HR [ ] Temp [ ] Wt [ ]", "General: [ ]", "[Additional examination findings]"], sectionOf(L, "PHYSICAL EXAM"), { at: `${at}/exam` });
          c.check(!urls.some((u) => r.text.includes(u)), `${at}/no-citation`, null, "no citation of the built-in", "a citation URL");
          c.check(!L.some((l) => l.startsWith("  Instruments: ")), `${at}/no-instruments-label`, null, "no Instruments: label without instrumentRecs", L.filter((l) => l.startsWith("  Instruments: ")));
          if (mod === shape) {
            const m = r.text.match(CONDITION_WORDS);
            c.check(!m, `${at}/condition-words`, null, "no condition word in the engine's own text", m && m[0]);
          }
          for (const f of r.x.flags) c.check(L.includes(`- ${f.action} (${f.points}).`), `${at}/flag/${f.id}`, null, `- ${f.action} (${f.points}).`, null);
          if (r.x.state === "open" || r.x.state === "closed") {
            const plan = sectionOf(L, "PLAN");
            const recLines = r.x.routing.recs.length ? r.x.routing.recs.map((x) => `- ${x.h}. ${x.p}`) : [`- ${mod.copy.note.noDriver}`];
            c.check(recLines.every((l) => plan.includes(l)), `${at}/recs`, null, recLines, plan);
          }
        }
      }
    }

    // ------------------------------------------------------------------ the frame document
    {
      const UI = emr.EMR_UI;
      const samples = [
        ["markup", `${MARKER}\n</textarea><script>alert(1)</script> & "double" 'single' <b>bold</b>\n${MARKER}`],
        ["leading-newline", "\nfirst line after a blank\n"],
        ["template", build(M, "scribe", { ...stateOf(sample("redflag")), probeAns: { pr_temporal_artery: 1 } })],
      ];
      for (const [name, text] of samples) {
        const doc = emr.emrFrameDoc(text);
        const parsed = new DOMParser().parseFromString(doc, "text/html");
        const tas = parsed.querySelectorAll("textarea");
        c.check(/^<!doctype html>/i.test(doc) && tas.length === 1 && !parsed.querySelector("script") && !/<script/i.test(doc.replace(/&lt;script/g, "")), `/frame/${name}/document`, null,
          "a doctype, one textarea, no script", { textareas: tas.length, script: !!parsed.querySelector("script") });
        c.check(tas.length === 1 && tas[0].value === text, `/frame/${name}/value`, null, "the parsed textarea value is the text exactly", tas[0] && tas[0].value.slice(0, 80));
        c.check(tas.length === 1 && tas[0].getAttribute("aria-label") === UI.frameTitle && parsed.title === UI.frameTitle, `/frame/${name}/labels`, null, UI.frameTitle, parsed.title);
      }
      const esc = emr.emrFrameDoc("& < > \" '");
      c.check(esc.includes("&amp; &lt; &gt; &quot; &#39;"), "/frame/escapes", null, "& < > \" ' escaped", esc.slice(esc.indexOf("<textarea"), esc.indexOf("</textarea>")));
    }

    // ------------------------------------------------------------------ the fuzz
    {
      const N = h.quick ? 300 : 1500;
      const rng = h.rng((h.seed ^ 0x454d5254) >>> 0); // "EMRT"
      const pick = (xs) => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
      const probeIds = Object.keys(probeById);
      const phenoValues = M.phenotypes.values.map((v) => v.value);
      const infoIds = arr(M.infoPrompts && M.infoPrompts.prompts).map((p) => p.id);
      const draw = (surface) => {
        const answers = {};
        // Half the states answer every item (so settled bands and the open referral are drawn often).
        const full = rng() < 0.5;
        const fill = full ? 1 : rng();
        for (const it of allItems) {
          if (rng() > fill) continue;
          const u = rng();
          answers[it.id] = u < (full ? 0.01 : 0.06) ? "unsure" : Array.isArray(it.scale) ? Math.min(it.scale.length - 1, Math.floor(rng() * it.scale.length)) : (u < 0.53 ? "yes" : "no");
        }
        const ctx = {};
        for (const ci of M.contextItems) if (rng() < 0.6) ctx[ci.id] = pick(ci.options)[0];
        const rf = {};
        const nf = rng() < 0.7 ? 0 : 1 + Math.floor(rng() * 3);
        for (let k = 0; k < nf; k++) rf[pick(M.redFlags).id] = surface === "scribe" ? pick(["nlp", "md", "probe"]) : true;
        const probeAns = {};
        if (surface === "scribe") for (const id of probeIds) if (rng() < 0.25) probeAns[id] = Math.floor(rng() * (arr(probeById[id].opts).length + (rng() < 0.1 ? 2 : 0)));
        // Release 0.4.5: pr_internal_vertigo answered often (each option, sometimes out of range), on
        // the Scribe and, to prove it is ignored there, on the Screener too; no option escalates.
        // Options 0 and 1 four times in five, else 2 or 3 (out of range).
        if (surface === "scribe" ? rng() < 0.7 : rng() < 0.3) probeAns.pr_internal_vertigo = rng() < 0.8 ? Math.floor(rng() * 2) : 2 + Math.floor(rng() * 2);
        else if (surface === "scribe" && rng() < 0.5) delete probeAns.pr_internal_vertigo;
        const vmp = {};
        for (const id of infoIds) if (rng() < 0.2) vmp[id] = pick(["yes", "no", "skip"]);
        const s = { patient: M.demo.patient, answers, ctx, rf, safetyReviewed: surface === "scribe" ? rng() < 0.75 : true, probeAns, vmp };
        // Release 0.4.5: a passed complaint is a dizziness case (otologic or both) more often.
        if (!(surface === "scribe" && rng() < 0.5)) s.complaint = rng() < 0.85 ? (rng() < 0.4 ? pick(["otologic", "both"]) : pick(phenoValues)) : pick(["", "not-a-phenotype"]);
        return s;
      };
      const tally = {};
      let n = 0;
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        for (const surface of SURFACES) {
          const s = draw(surface);
          const input = { i, surface, state: s };
          const before = JSON.stringify(s);
          let text = null, again = null;
          try { text = build(M, surface, s); again = build(M, surface, s); } catch (err) { c.check(false, `/fuzz/${surface}/throws`, input, "no throw", String(err && err.stack || err)); continue; }
          c.check(text === again, `/fuzz/${surface}/deterministic`, input, "the same text twice", "differs");
          c.check(JSON.stringify(s) === before, `/fuzz/${surface}/inputs`, input, "the state untouched", "mutated");
          const x = verify(M, surface, s, text, `/fuzz/${surface}`, input);
          tally[`${surface}:${x.state}`] = (tally[`${surface}:${x.state}`] || 0) + 1;
          // Release 0.4.5: the referrals of the dizziness cases (the referral = the bundle's and the
          // module data's, above), with the probe answered or not, the Scribe's derived ones apart.
          if (x.state === "open" && (x.complaint === "otologic" || x.complaint === "both")) {
            const k = `${surface}:${x.complaint}${surface === "scribe" && s.complaint === undefined ? "-derived" : ""}`;
            tally[k] = (tally[k] || 0) + 1;
            if (own(s.probeAns, "pr_internal_vertigo")) tally[`${surface}:dizziness-probe-answered`] = (tally[`${surface}:dizziness-probe-answered`] || 0) + 1;
          }
          n++;
        }
        if (i % 100 === 99) await new Promise((r) => setTimeout(r, 0));
      }
      for (const surface of SURFACES) {
        for (const st of surface === "scribe" ? ["flag", "unreviewed", "unscorable", "closed", "open"] : ["flag", "unscorable", "closed", "open"]) {
          c.check((tally[`${surface}:${st}`] || 0) > 0, `/fuzz/${surface}/@covers/${st}`, null, "drawn at least once", 0);
        }
      }
      // Release 0.4.5: FHIR = EMR = the module data on referrals of both dizziness cases, on both
      // surfaces, with pr_internal_vertigo answered, and on the Scribe's derived both.
      for (const k of ["screener:otologic", "scribe:otologic", "screener:both", "scribe:both", "scribe:both-derived", "screener:dizziness-probe-answered", "scribe:dizziness-probe-answered"]) {
        c.check((tally[k] || 0) > 0, `/fuzz/@covers/${k}`, null, "drawn at least once", 0);
      }
      c.note(`fuzz: ${n} templates over ${N} seeded states per surface in ${Math.round(performance.now() - t0)} ms; states ${Object.entries(tally).sort().map(([k, v]) => `${k} ${v}`).join(", ")}`);
    }

    c.note(`matrix: ${matrix.length} named states; red flags: ${M.redFlags.length} × 2 surfaces + mixed tiers; the clinical content was drafted by AI agents and signed off by the clinical lead on 2026-10-07 (release 0.4.4; EMR_DELTA.signOff)`);
    return c.result();
  }),
};
