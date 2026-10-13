// tests/suites/values.js — the MASQUE module's data vs the baseline constants (design 03 §8.3
// `values`, §3.6-§3.8). Owner: WP13; accepts WP1 (rubric), WP2 (logic) and WP6 (chrome split).
//
// Structural comparisons (deep-equal, key order where the order is the data):
//   instrument   domains/items vs Screener ITEMS (key, label, max, negative; id, w, text, scale,
//                ref, in order); items[].short vs Scribe shortLabel (n_allo absent); ask vs ASK;
//                tag vs VMPATHI_TAG; patientClin vs Patient ITEMS[].c; infoPrompts vs VMPATHI_INFO;
//                bands.cuts vs BAND_CUTS; instrumentVersion vs INSTRUMENT_VERSION
//   safety       redFlags vs Screener RED_FLAGS (+ Scribe `ask`); contextItems vs the Screener's
//                ContextQ rows (pinned slice) and the Scribe capLabel; steps.screener rail vs STEPS
//   phenotypes   values vs the Screener picker (pinned slice)
//   patient      locales.{en,es}.items vs P / ES_P (P key order = item order); redFlags vs the
//                Patient flags / ES_RF; contextItems vs CONTEXT_Q; step titles vs UI.sections;
//                ledes vs BLURB / BLURB_ES; PATIENT_CHROME ∪ locales.*.ui ∪ CAVEATS vs UI (§3.7).
//                Release 0.4.2: the shipped locales.es is exactly the baseline-extracted es plus
//                the Spanish completion of tests/harness/locale-delta.js (revertLocaleDelta must
//                succeed and re-apply to the same bytes, key order included), so the baseline
//                Spanish pins above read the reverted es and stay byte for byte; every delta row's
//                `en` is the English at its path (an item's clin: its patientClin); the context
//                option values are the English ones, in order; every item has a clin;
//                PATIENT_CHROME.es carries exactly the baseline UI.es keys and the delta's chrome
//                keys, each chrome row's `en` being PATIENT_CHROME.en[key]
//   logic        locales.*.sum vs SUM (strings and word maps deep-equal; template functions by
//                output over every reachable argument); probes.list vs ALL_PROBES (every
//                non-function field, in order); probes.version vs PROBE_SET_VERSION
//   lexicon      vs the Extraction constants (version, negation, thirdParty, historical, bool,
//                ctx, scale, multi, redFlags); the shipped lexicon may differ from them only by
//                the clinical-lead-approved delta of tests/harness/lexicon-delta.js (AD13, design
//                05 §7.1) and, since release 0.4.7, the 0.3.2 → 0.3.3 delta of
//                tests/harness/lexicon-delta-033.js (AD18; chart reading and clarification, signed off
//                by the clinical lead on 2026-10-12): revertLexiconChain must succeed, and the /lexicon
//                and /module/versions diffs allow AD18 then AD13 and expect each whenever the lexicon is
//                at (or past) that delta's `to` version; the 0.3.3 record (the lead's request and
//                answers, and the sign-off: totals, the 19 Part D answers and the D8 follow-up answers)
//                and the lead-sourced words are pinned; the sign-off is complete and applied
//                (lexicon033SignOffProblems: no plain draft, every struck row absent, every approved row
//                "lead-approved", the sign-off's additions and removed qualifiers in place) and mutated
//                records are refused; its change-log entry is the last, dated as the sign-off
//   change log   (release 0.4.7 review round 3) app/modules/masque/CHANGELOG.md quotes every rubric
//                change-log entry verbatim, once ("- **kind** (paths): note")
//   records      (release 0.4.7, after the sign-off) while LEXICON_DELTA_033.signOff is recorded, the
//                deployed records and source comments (CHANGELOG, README, SOURCES, policy.js, Scribe.jsx)
//                say nowhere that the 0.4.7 rows await the sign-off, and the README does not keep "+/-"
//                to typed text; each detector is shown to catch the statement it guards against;
//                (release 0.4.8, final review) every hash the latest release entry of the CHANGELOG
//                quotes ("`contentHash` `7674bf7d…`", "`instrumentHash` (`b06dfaad…`)") begins the
//                shipped rubric's own value (the 0.4.8 records had quoted a contentHash it never had)
//   samples      sampleCases vs SAMPLE_CASES + the rail buttons (Scr L994-997) + the Simulator
//                SCENARIOS / FULL_HIGH; demo vs DEMO_PATIENT / Scribe PATIENT / SCRIPT
//   research     vs PROJECTS.MASQUE; demoCohorts vs COHORTS
//   identity     rendered fhir/cds identifiers and strings vs what the baseline builders print
//   calibration  calibrationGate(masque) === true; the stored scoringHash equals rubricHashes
//   emr          release 0.4.3: rubric.emrTemplate is exactly EMR_DELTA.value of
//                tests/harness/emr-delta.js, key order included, inserted just before changelog
//                (revertEmrDelta must give the rubric without it, and applyEmrDelta of that must give
//                the shipped rubric back byte for byte); the delta was drafted on 2026-10-06 and,
//                since release 0.4.4, is reviewed with the clinical lead's signOff of 2026-10-07
//                (pinned exactly; emrSignOffComplete refuses incomplete records and impossible
//                dates, and applyEmrDelta refuses a delta carrying one), and the block is byte for byte the one signed off (its SHA-256,
//                pinned); its emr-template changelog entry is the rubric's third last and its
//                sign-off entry the second last (release 0.4.5 appends one entry after them), both
//                verbatim; bindModule exposes the block as module.emrTemplate
//   referral     release 0.4.5: rubric.phenotypes.referral is exactly the baseline-extracted table +
//                tests/harness/referral-delta.js (revertReferralDelta must give the rubric without it,
//                and applyReferralDelta of that the shipped rubric back byte for byte); the
//                destinations (otologic: Neuro-otology → Neurology; both: Headache medicine /
//                Neurology → Neurology; reasons unchanged) are exactly the differences from the
//                baseline; the clinician rule (no escalation fields), the decision record and the
//                lead's words are pinned; the rule's text is the lead's sentence without its reply
//                word, the clarification the lead's words (unchanged), the definition the lead's of
//                2026-10-07 (kept verbatim in quotes) as the lead amended it on 2026-10-10 (exactly
//                "swaying, bobbing, " removed; no line names swaying or bobbing); pr_internal_vertigo and
//                the vestibular-migraine recommendation are unchanged; its change-log entry is the
//                last, verbatim; the delta's leaves are exempt from the sweep like the other deltas'
//                (pointer and value)
//   question     release 0.4.8: the rubric is the one before tests/harness/question-delta-048.js plus
//                exactly that delta (revertQuestionDelta must give it back, and applyQuestionDelta of
//                that the shipped rubric byte for byte); the baseline ASK pin above reads the reverted
//                rubric, so every other item's question stays the baseline's; r_dur's question is the
//                clinical lead's sentence of 2026-10-12, verbatim, and the request and record are
//                pinned; apply refuses a wrong `from` or item; the instrument and scoring hashes of
//                the shipped and the reverted rubric are equal; its change-log entry is the last,
//                verbatim; its leaf is exempt from the sweep (pointer and value)
//   emr plan     release 0.4.8, follow-up: the rubric is the one before tests/harness/emr-plan-delta-048.js
//                plus exactly that delta (revertEmrDecisionsDelta must give it back, and
//                applyEmrDecisionsDelta of that the shipped rubric byte for byte), so every emrTemplate
//                check above reads the rubric without it: the signed-off block (fb63a2b9…) under every
//                delta and the block of release 0.4.6 (0152cfd8…) under this one; planAdvice is the
//                clinical lead's sentence of 2026-10-12, verbatim, and the request, the answers and the
//                record are pinned; the shipped block's hash is pinned; the instrument, scoring and
//                lexicon hashes do not move; its change-log entry is the last, verbatim; its leaves are
//                exempt from the sweep (pointer and value)
// Provenance sweep: every other string in the rubric and every string datum of the logic must
// occur in the baseline sources (whitespace, JSX tags and `**` markup normalised; placeholders
// split out), except the hand-written fields WP1 done-when 6 lists and the leaves of the approved
// lexicon delta and of the locale delta (release 0.4.2: the Spanish text it adds, never the
// context option values, which are swept like any baseline string) and of the EMR template delta
// (release 0.4.3: every string leaf of EMR_DELTA.value under /rubric/emrTemplate, once the revert
// proves it exact). A delta leaf is skipped only
// when its JSON pointer AND its value both match (an
// appended phrase at its exact appended index, a string under a delta field's `to`), never by a
// pattern over a whole list, so a later unapproved phrase in the same list is still checked; the
// fields include the per-entry scale lists (anchor, yieldTo, carryExclude). Every delta leaf outside
// the hand-written paths must be met at its pointer with its value, so an exemption never goes
// unused silently. Release 0.4.7: the 0.3.3 delta's leaves likewise (its appended negation cues at
// their 0.3.2 lengths, every string leaf of its clauses, clarify and version rows); a 0.3.2 leaf the
// 0.3.3 delta replaces (the version) is no longer expected. A string found nowhere is invented
// content and FAILS.
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import {
  applyEmrDecisionsDelta, applyEmrDelta, applyLocaleDelta, applyQuestionDelta, applyReferralDelta, emrSignOffComplete, lexicon033SignOffProblems, pointerToken, revertEmrDecisionsDelta, revertEmrDelta,
  revertLexiconChain, revertLexiconDelta, revertLocaleDelta, revertQuestionDelta, revertReferralDelta,
} from "../harness/diff.js";
import { LEXICON_DELTA } from "../harness/lexicon-delta.js";
import { LEXICON_DELTA_033 } from "../harness/lexicon-delta-033.js";
import { LOCALE_DELTA } from "../harness/locale-delta.js";
import { EMR_DELTA } from "../harness/emr-delta.js";
import { REFERRAL_DELTA } from "../harness/referral-delta.js";
import { EMR_DECISIONS_DELTA } from "../harness/emr-decisions-delta.js";
import { QUESTION_DELTA } from "../harness/question-delta-048.js";
import { EMR_PLAN_DELTA } from "../harness/emr-plan-delta-048.js";
import { PATIENT_CHROME_048 } from "../harness/patient-chrome-048.js";

const LOCALES = ["en", "es"];
const UI_SECTION_KEYS = ["intro", "safety", "story", "migraine", "vestibular", "neuro", "impact", "discriminators", "summary"];

const proj = (obj, keys) => (obj && typeof obj === "object" ? Object.fromEntries(keys.map((k) => [k, obj[k]])) : obj);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** Baseline source text with JSX and JS-literal noise removed, for the provenance sweep. */
export function normaliseSource(text, { keepTags = false } = {}) {
  return text
    .replace(/(["'])\s*\+\s*\1/g, "")                // "abc " + "def" → abc def
    .replace(/\{"\s*"\}/g, " ")                        // {" "}
    .replace(keepTags ? /$^/ : /<\/?[A-Za-z][A-Za-z0-9.]*(\s[^<>]*?)?\/?>/g, " ") // JSX tags (attribute values kept with keepTags)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, " ")
    .replace(/\s+/g, " ");
}

/** The literal fragments of a module string (placeholders and `**` markup removed). */
export function fragments(s) {
  return s.replace(/\*\*/g, "").split(/\{[A-Za-z][A-Za-z0-9]*\}/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Every string leaf of a JSON-like value as [pointer, string]. Functions are skipped. */
function stringLeaves(x, path = "", out = []) {
  if (typeof x === "string") out.push([path, x]);
  else if (Array.isArray(x)) x.forEach((v, i) => stringLeaves(v, `${path}/${i}`, out));
  else if (isObj(x)) for (const k of Object.keys(x)) stringLeaves(x[k], `${path}/${pointerToken(k)}`, out);
  return out;
}

/** The value at an RFC 6901 pointer under `root` (own keys and in-range indices only), or undefined. */
function valueAtPointer(root, pointer) {
  let n = root;
  for (const raw of pointer.slice(1).split("/")) {
    const t = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(n)) n = /^(?:0|[1-9]\d*)$/.test(t) && Number(t) < n.length ? n[Number(t)] : undefined;
    else n = isObj(n) && Object.prototype.hasOwnProperty.call(n, t) ? n[t] : undefined;
    if (n === undefined) return undefined;
  }
  return n;
}

/**
 * The provenance-sweep exemptions of the approved lexicon delta (design 05 §7.2): rubric JSON
 * pointer → the exact string the delta put there. `lex031` is the reverted lexicon, which gives
 * each list's length before the delta; rows that append to the same list continue its indices.
 *   /rubric/lexicon<path>/<len031 + k> = phrases[k]   for each appended row
 *   every string leaf of each fields[].to, under /rubric/lexicon<path>
 */
function deltaLeaves(delta, lex031) {
  const leaves = new Map();
  const next = new Map();
  for (const row of delta.appended || []) {
    const list = valueAtPointer(lex031, row.path);
    let n = next.has(row.path) ? next.get(row.path) : Array.isArray(list) ? list.length : 0;
    for (const ph of row.phrases || []) leaves.set(`/rubric/lexicon${row.path}/${n++}`, ph);
    next.set(row.path, n);
  }
  for (const row of delta.fields || []) {
    for (const [p, s] of stringLeaves(row.to, `/rubric/lexicon${row.path}`)) leaves.set(p, s);
  }
  return leaves;
}

/**
 * The provenance-sweep exemptions of the locale delta (release 0.4.2): rubric JSON pointer → the
 * exact Spanish string the delta put there, for every string leaf of each `added` row's value
 * except a context option's value code (/opts/<i>/0), which is the English one and is swept.
 */
function localeDeltaLeaves(delta) {
  const leaves = new Map();
  for (const row of delta.added || []) {
    for (const [p, s] of stringLeaves(row.value, `/rubric${row.path}`)) {
      if (/^\/rubric\/locales\/[^/]+\/contextItems\/[^/]+\/opts\/\d+\/0$/.test(p)) continue;
      leaves.set(p, s);
    }
  }
  return leaves;
}

/**
 * The provenance-sweep exemptions of the EMR template delta (release 0.4.3): rubric JSON pointer →
 * the exact string the delta put there, for every string leaf of EMR_DELTA.value under
 * /rubric<delta.path>. Cited metadata and labels drafted from verified sources (decision D1), not
 * baseline text.
 */
function emrDeltaLeaves(delta) {
  return new Map(stringLeaves(delta.value, `/rubric${delta.path}`));
}

/**
 * The provenance-sweep exemptions of the referral delta (release 0.4.5): rubric JSON pointer → the
 * exact string the delta put there, for each changed row's `to` and every string leaf of each added
 * row's value. The clinical lead's decisions (chat, 2026-10-07 to 2026-10-10), not baseline text.
 */
function referralDeltaLeaves(delta) {
  const leaves = new Map();
  for (const row of delta.changed || []) leaves.set(`/rubric${row.path}`, row.to);
  for (const row of delta.added || []) for (const [p, s] of stringLeaves(row.value, `/rubric${row.path}`)) leaves.set(p, s);
  return leaves;
}

/**
 * The provenance-sweep exemptions of the EMR decisions delta (release 0.4.6): rubric JSON pointer →
 * the exact string the delta put there, for every string leaf of each added row's value. The
 * clinical lead's answers (chat, 2026-10-10), not baseline text.
 */
function emrDecisionsDeltaLeaves(delta) {
  const leaves = new Map();
  for (const row of delta.added || []) for (const [p, s] of stringLeaves(row.value, `/rubric${row.path}`)) leaves.set(p, s);
  return leaves;
}

/**
 * Rubric paths whose values are hand-written by design (WP1 done-when 6; §3.8), so the
 * provenance sweep does not look for them in the baseline. Each entry is a RegExp over the
 * JSON pointer.
 */
const HAND_WRITTEN = [
  [/^\/logic\/(routing\/\d+\/id|phenotypes\/(derive\/\d+\/value|activation\/\d+\/(id|domains\/\d+))|patientSummary\/(said|ask)\/\d+\/id|patientSummary\/groups\/[^/]+\/\d+)$/, "logic rule ids and group members (§3.8)"],
  [/^\/rubric\/label$/, "the dropdown label (user requirement 2026-10-02)"],
  [/^\/rubric\/(id|name|icon|format)$/, "module identity"],
  [/^\/rubric\/logicBinding\//, "pairing"],
  [/^\/rubric\/changelog\//, "change-log notes"],
  [/^\/rubric\/research\/population\//, "population paths (Pop L31-33)"],
  [/^\/rubric\/research\/calibration\/appliesTo\//, "computed by the extractor with rubricHashes"],
  [/^\/rubric\/research\/(projectKey|scoreAliases\/\d+|artifactKey|etlScript|fairnessAxes\/\d+)$/, "research knobs (§3.8)"],
  [/^\/rubric\/lexicon\/goldSet\//, "gold-set reference"],
  [/^\/rubric\/lexicon\/lang$/, "BCP-47 tag (Voice L47)"],
  [/^\/rubric\/(fhir|cds)\/(questionnaireUrl|codeSystem|answerSystem|criteriaSystem|weightExtension|indexCode|screenIdPrefix|filePrefix|serviceId|safetyCardUuid|indexCardUuid)$/, "identity template"],
  [/^\/rubric\/cds\/source\/url$/, "identity template"],
  [/^\/rubric\/cds\/examples\/redFlagPresent\/flagId$/, "flag id"],
  [/^\/rubric\/sampleCases\/\d+\/(id|group|icon)$/, "sample ids, groups and lucide icon names"],
  [/^\/rubric\/steps\/(screener|patient)\/\d+\/(kind|extras\/\d+|requires|domainKeys\/\d+)$/, "step structure"],
  [/^\/rubric\/phenotypes\/(scribeDefault|tagBoostDomain|alwaysActive\/\d+)$/, "phenotype structure (ids)"],
  [/^\/rubric\/infoPrompts\/(gateDomain)$/, "domain key"],
  [/^\/rubric\/gapRule\//, "context ids"],
];

export default {
  name: "values",
  owner: "WP13",
  run: guarded("values", async (h) => {
    const { module, validation } = await loadMasque(h);
    const [gates, hash, policy, patient] = await Promise.all([h.engine("gates.js"), h.engine("hash.js"), h.engine("policy.js"), h.engine("patient.js")]);
    const [scr, scb, pat, sim, prb, ext, rrp] = await Promise.all([
      h.oracle("MASQUE_Screener_v0_3.jsx"), h.oracle("MASQUE_Scribe_v0_3.jsx"), h.oracle("MASQUE_Patient_v0_3.jsx"),
      h.oracle("MASQUE_Simulator.jsx"), h.oracle("MASQUE_Probes.js"), h.oracle("MASQUE_Extraction.js"),
      h.oracle("ResearchReadinessPanel.jsx"),
    ]);
    const c = collector(h);
    c.note(validationNote(validation));
    const R = module.rubric;
    need(R && Array.isArray(R.domains), "waits on WP1/WP3: module.rubric");
    const L = module.logic || {};
    const d = (a, b, at, opts = {}) => c.diff(a, b, { at, keyOrder: true, ...opts });
    // Release 0.4.8: the rubric without the clinical lead's question for r_dur (RQ), which
    // revertQuestionDelta proves exact (pinned under "the question delta" below). The baseline ASK
    // pin reads it, so every other item's question is still the baseline Scribe's.
    const QD = QUESTION_DELTA;
    const Rq0 = revertQuestionDelta(R, QD);
    const qLanded = Rq0 !== null && Rq0 !== R;
    const RQ = qLanded ? Rq0 : R;

    // ------------------------------------------------------------------ instrument
    d(scr.DOMAIN_ORDER, R.domains.map((x) => x.key), "/domains/@order");
    const shortOf = (id) => { const s = scb.shortLabel({ id }); return s === id ? undefined : s; };
    const patientC = {};
    for (const k of pat.DOMAIN_ORDER) for (const it of pat.ITEMS[k].items) patientC[it.id] = it.c;
    for (const key of scr.DOMAIN_ORDER) {
      const base = scr.ITEMS[key];
      const mine = R.domains.find((x) => x.key === key);
      if (!c.check(!!mine, `/domains/${key}`, null, "present", "absent")) continue;
      const domainKeys = Object.keys(base).filter((k) => k !== "items");
      d(proj(base, domainKeys), proj(mine, domainKeys), `/domains/${key}`);
      c.check(mine.negative === base.negative, `/domains/${key}/negative`, null, base.negative, mine.negative);
      c.check(mine.items.length === base.items.length, `/domains/${key}/items/length`, null, base.items.length, mine.items.length);
      base.items.forEach((it, i) => {
        const m = mine.items[i] || {};
        const at = `/domains/${key}/items/${i}`;
        d(it, proj(m, Object.keys(it)), at);
        c.check(m.short === shortOf(it.id), `${at}/short`, { id: it.id }, shortOf(it.id) ?? "[absent]", m.short ?? "[absent]");
        const mq = ((RQ.domains.find((x) => x.key === key) || {}).items || [])[i] || {};
        c.check(mq.ask === scb.ASK[it.id], `${at}/ask`, { id: it.id }, scb.ASK[it.id] ?? "[absent]", mq.ask ?? "[absent]");
        c.check(m.tag === scb.VMPATHI_TAG[it.id], `${at}/tag`, { id: it.id }, scb.VMPATHI_TAG[it.id] ?? "[absent]", m.tag ?? "[absent]");
        c.check(m.patientClin === patientC[it.id], `${at}/patientClin`, { id: it.id }, patientC[it.id] ?? "[absent]", m.patientClin ?? "[absent]");
        // The Scribe's own copy of the item (w, scale, ref) must agree (its text is the Screener's, Inv §2).
        const sb = scb.ITEM_BY_ID[it.id];
        if (c.check(!!sb, `${at}/scribe`, { id: it.id }, "in the Scribe", "absent")) {
          d({ w: sb.w, scale: sb.scale, ref: sb.ref }, { w: m.w, scale: m.scale, ref: m.ref }, `${at}/@scribe`);
        }
      });
    }
    const shorts = R.domains.flatMap((x) => x.items).filter((it) => it.short !== undefined).length;
    c.check(shorts === 29, "/domains/*/items/*/short/@count", null, 29, shorts);
    d(scb.VMPATHI_INFO, (R.infoPrompts || {}).prompts, "/infoPrompts/prompts");
    for (const p of (R.infoPrompts || {}).prompts || []) c.check(p.tag.startsWith(R.infoPrompts.tagPrefix), `/infoPrompts/tagPrefix`, { id: p.id }, p.tag, R.infoPrompts.tagPrefix);
    d(scr.BAND_CUTS, R.bands && R.bands.cuts, "/bands/cuts");
    c.check(R.instrumentVersion === scr.INSTRUMENT_VERSION, "/instrumentVersion", null, scr.INSTRUMENT_VERSION, R.instrumentVersion);
    c.check(module.instrumentVersion === scr.INSTRUMENT_VERSION, "/module/instrumentVersion", null, scr.INSTRUMENT_VERSION, module.instrumentVersion);
    // The version axes stay distinct and each comes from its owner (CLAUDE.md, §4.13).
    const V = module.versions || {};
    // The lexicon axis may move only by the approved delta (AD13, design 05 §7.1) and the 0.3.3
    // delta (AD18, release 0.4.7), in that chain; AD18's full = the whole shipped lexicon and AD13's
    // the 0.3.2-equivalent one, which the /lexicon normalisers revert and so prove exact.
    const lex032 = revertLexiconDelta(R.lexicon || {}, LEXICON_DELTA_033);
    const ad13 = { allow: ["AD18", "AD13"], ctx: { AD18: { delta: LEXICON_DELTA_033, full: R.lexicon }, AD13: { delta: LEXICON_DELTA, full: lex032 || R.lexicon } } };
    const rVersions = d({ instrument: scr.INSTRUMENT_VERSION, lexicon: ext.LEXICON_VERSION, probeSet: prb.PROBE_SET_VERSION },
      { instrument: V.instrument, lexicon: V.lexicon, probeSet: V.probeSet }, "/module/versions", ad13);

    // ------------------------------------------------------------------ safety, context, steps
    const scbRf = Object.fromEntries(scb.RED_FLAGS.map((f) => [f.id, f]));
    d(scr.RED_FLAGS.map((f) => ({ ...f, ask: scbRf[f.id] && scbRf[f.id].ask })), R.redFlags, "/redFlags");
    d(scr.RF_GROUPS, module.redFlagGroups, "/module/redFlagGroups");
    const rows = (await h.slice("screener.contextRows")).fn();
    d(rows.map((r) => ({ id: r.id, text: r.t, options: r.opts })), (R.contextItems || []).map((ci) => ({ id: ci.id, text: ci.text, options: ci.options })), "/contextItems");
    for (const ci of R.contextItems || []) c.check(ci.captureLabel === scb.capLabel({ id: ci.id }), `/contextItems/${ci.id}/captureLabel`, null, scb.capLabel({ id: ci.id }), ci.captureLabel);
    d(scr.STEPS.map((s) => ({ key: s.key, rail: { eyebrow: s.eyebrow, title: s.title } })),
      ((R.steps || {}).screener || []).map((s) => ({ key: s.key, rail: s.rail })), "/steps/screener/@rail");
    d(pat.SECTIONS.slice(2, -1).map((s) => s.key), ((R.steps || {}).patient || []).map((s) => s.key), "/steps/patient/@keys");
    const picker = (await h.slice("screener.phenotypePicker")).fn();
    d(picker.map((o) => ({ value: o.k, h: o.h, d: o.d })), ((R.phenotypes || {}).values || []), "/phenotypes/values");

    // ------------------------------------------------------------------ patient wording
    const itemOrder = R.domains.flatMap((x) => x.items.map((it) => it.id));
    d(Object.keys(pat.P), itemOrder, "/@P-key-order");
    const loc = R.locales || {};
    // Release 0.4.2: locales.es = the baseline-extracted es + LOCALE_DELTA, exactly. The pins of the
    // baseline Spanish read the reverted es (es0); the revert, proven by re-applying to the same
    // bytes, guarantees that the shipped es holds that Spanish unchanged plus only the delta's rows.
    const es0 = revertLocaleDelta(loc.es, LOCALE_DELTA);
    const esLanded = es0 !== null && es0 !== loc.es;
    c.check(es0 !== null, "/locales/es/@delta", null, "the baseline-extracted es, exactly + tests/harness/locale-delta.js (revertLocaleDelta)", "revertLocaleDelta returned null");
    c.check(esLanded, "/locales/es/@delta/landed", null, "the Spanish completion of release 0.4.2 has landed", "not landed");
    if (es0 !== null) {
      let reapplied = null;
      try { reapplied = JSON.stringify(applyLocaleDelta(es0, LOCALE_DELTA)); } catch (e) { reapplied = `throws: ${e.message}`; }
      c.check(reapplied === JSON.stringify(loc.es), "/locales/es/@delta/reapply", null, "applyLocaleDelta(revert) gives the shipped es byte for byte (key order)", reapplied && reapplied.slice(0, 120));
    }
    const esBase = es0 || {};
    d(pat.P, (loc.en || {}).items, "/locales/en/items");
    d(pat.ES_P, esBase.items, "/locales/es/items");
    d(Object.fromEntries(pat.RED_FLAGS.map((f) => [f.id, { q: f.q, say: f.say }])), (loc.en || {}).redFlags, "/locales/en/redFlags");
    d(pat.ES_RF, (loc.es || {}).redFlags, "/locales/es/redFlags");
    d(Object.fromEntries(pat.CONTEXT_Q.map((q) => [q.id, { q: q.q, opts: q.opts }])), (loc.en || {}).contextItems, "/locales/en/contextItems");
    for (const l of LOCALES) {
      const ui = pat.UI[l];
      const steps = (loc[l] || {}).steps || {};
      const blurb = l === "es" ? pat.BLURB_ES : pat.BLURB;
      UI_SECTION_KEYS.forEach((key, i) => {
        if (["intro", "safety", "summary"].includes(key)) {
          const chrome = patient.PATIENT_CHROME[l] || {};
          c.check((chrome.sections || {})[key] === ui.sections[i], `/PATIENT_CHROME/${l}/sections/${key}`, null, ui.sections[i], (chrome.sections || {})[key]);
        } else {
          c.check((steps[key] || {}).title === ui.sections[i], `/locales/${l}/steps/${key}/title`, null, ui.sections[i], (steps[key] || {}).title);
        }
      });
      for (const key of Object.keys(blurb)) c.check((steps[key] || {}).lede === blurb[key], `/locales/${l}/steps/${key}/lede`, null, blurb[key], (steps[key] || {}).lede);
      c.check(((loc[l] || {}).ui || {}).sub === ui.sub, `/locales/${l}/ui/sub`, null, ui.sub, ((loc[l] || {}).ui || {}).sub);
      c.check((loc[l] || {}).reviewed === pat.REVIEWED[l], `/locales/${l}/reviewed`, null, pat.REVIEWED[l], (loc[l] || {}).reviewed);
      // §3.7: every other UI key is PATIENT_CHROME[loc], verbatim; the caveats are policy's.
      const chrome = patient.PATIENT_CHROME[l] || {};
      for (const [k, v] of Object.entries(ui)) {
        if (k === "sub" || k === "sections") continue;
        if (k === "reviewBanner") {
          const want = v || null;
          const got = l === "es" ? policy.CAVEATS.unreviewed.es.body : null;
          c.check(want === got, `/CAVEATS/unreviewed/${l}/body`, null, want, got);
          continue;
        }
        if (k === "txtUnreviewed") {
          const want = v || "";
          const got = l === "es" ? policy.CAVEATS.unreviewed.es.txt : "";
          c.check(want === got, `/CAVEATS/unreviewed/${l}/txt`, null, want, got);
          continue;
        }
        c.check(chrome[k] === v, `/PATIENT_CHROME/${l}/${k}`, null, v, chrome[k]);
      }
    }
    c.check(policy.LOCALE_NAMES && policy.LOCALE_NAMES.en === pat.LOCALE_NAMES.en && policy.LOCALE_NAMES.es === pat.LOCALE_NAMES.es, "/LOCALE_NAMES", null, pat.LOCALE_NAMES, policy.LOCALE_NAMES);

    // ------------------------------------------------------------------ the locale delta (release 0.4.2)
    const patientClinOf = Object.fromEntries(R.domains.flatMap((x) => x.items).map((it) => [it.id, it.patientClin]));
    const esPrefix = `/locales/${LOCALE_DELTA.locale}`;
    c.check(LOCALE_DELTA.locale === "es" && LOCALE_DELTA.translated && LOCALE_DELTA.translated.reviewed === false, "/@localeDelta/translated", null,
      "es, an unreviewed translation", LOCALE_DELTA.translated);
    for (const row of LOCALE_DELTA.added) {
      const rel = row.path.slice(esPrefix.length);
      const clin = /^\/items\/([^/]+)\/clin$/.exec(rel);
      const en = clin ? patientClinOf[clin[1]] : valueAtPointer(R, `/locales/en${rel}`);
      d(en, row.en, `/@localeDelta${row.path}/en`);
      c.check(es0 === null || valueAtPointer(es0, rel) === undefined, `/@localeDelta${row.path}/@new`, null,
        "absent from the baseline-extracted es (the delta only adds)", "present");
      d(row.value, valueAtPointer(R, row.path), `/@localeDelta${row.path}/value`);
    }
    const ctxEn = (loc.en || {}).contextItems || {}, ctxEs = (loc.es || {}).contextItems || {};
    d(Object.keys(ctxEn), Object.keys(ctxEs), "/locales/es/contextItems/@ids");
    for (const id of Object.keys(ctxEn)) {
      d((ctxEn[id].opts || []).map(([v]) => v), ((ctxEs[id] || {}).opts || []).map(([v]) => v), `/locales/es/contextItems/${id}/opts/@values`);
    }
    for (const id of itemOrder) {
      const e = ((loc.es || {}).items || {})[id] || {};
      c.check(typeof e.clin === "string" && e.clin.trim() !== "", `/locales/es/items/${id}/clin`, null, "a Spanish clinician line", e.clin ?? "[absent]");
      c.check(!Object.prototype.hasOwnProperty.call(((loc.en || {}).items || {})[id] || {}, "clin"), `/locales/en/items/${id}/clin`, null, "[absent] (English uses patientClin)", "present");
    }
    // PATIENT_CHROME.es = the baseline UI.es keys (minus the module-owned and caveat keys) ∪ the delta's chrome keys
    // ∪ (release 0.4.8) the keys of tests/harness/patient-chrome-048.js, exactly.
    const chromeEs = patient.PATIENT_CHROME.es || {}, chromeEn = patient.PATIENT_CHROME.en || {};
    const C48 = PATIENT_CHROME_048;
    const wantKeys = [...Object.keys(pat.UI.es).filter((k) => !["sub", "reviewBanner", "txtUnreviewed"].includes(k)), ...LOCALE_DELTA.chrome.map((r) => r.key),
      ...C48.rows.map((r) => r.key)];
    d([...wantKeys].sort(), Object.keys(chromeEs).sort(), "/PATIENT_CHROME/es/@keys");
    c.check(new Set(wantKeys).size === wantKeys.length, "/@localeDelta/chrome/@disjoint", null, "no delta chrome key is a baseline UI.es key, and no 0.4.8 key is either", wantKeys);
    // Release 0.4.8: each new key, in English and Spanish, byte for byte as recorded; an AI translation, unreviewed.
    c.check(C48.release === "0.4.8" && C48.translated && C48.translated.reviewed === false && C48.requested && C48.requested.by === "clinical lead" && C48.requested.date === "2026-10-12",
      "/@patientChrome048/record", null, "release 0.4.8, requested by the clinical lead on 2026-10-12, an unreviewed translation", { release: C48.release, translated: C48.translated, requested: C48.requested });
    for (const row of C48.rows) {
      c.check(chromeEn[row.key] === row.en, `/PATIENT_CHROME/en/${row.key}`, null, row.en, chromeEn[row.key]);
      c.check(chromeEs[row.key] === row.es && row.es !== row.en, `/PATIENT_CHROME/es/${row.key}`, null, row.es, chromeEs[row.key]);
      c.check(typeof row.basis === "string" && row.basis.trim() !== "", `/@patientChrome048/${row.key}/basis`, null, "a basis", row.basis);
      c.check(!Object.prototype.hasOwnProperty.call(pat.UI.en, row.key), `/@patientChrome048/${row.key}/@new`, null, "not a baseline UI key (new in 0.4.8)", "a baseline key");
    }
    for (const row of LOCALE_DELTA.chrome) {
      c.check(chromeEn[row.key] === row.en, `/@localeDelta/chrome/${row.key}/en`, null, chromeEn[row.key], row.en);
      c.check(typeof chromeEs[row.key] === "string" && chromeEs[row.key] !== "" && chromeEs[row.key] !== chromeEn[row.key], `/PATIENT_CHROME/es/${row.key}`, null, "a Spanish string", chromeEs[row.key]);
    }
    const fb = patient.chromeFor("es").fallbackKeys || [];
    c.check(fb.length === 0, "/chromeFor/es/fallbackKeys", null, [], fb);

    // ------------------------------------------------------------------ logic: SUM
    const words = ["alpha", "beta", "gamma", "delta", "epsilon"];
    for (const l of LOCALES) {
      const base = pat.SUM[l];
      const mine = L.locales && L.locales[l] && L.locales[l].sum;
      if (!c.check(!!mine, `/logic/locales/${l}/sum`, null, "present", "absent")) continue;
      d(Object.keys(base), Object.keys(mine), `/logic/locales/${l}/sum/@keys`);
      const args = [[1], [2], [0], [3], ["0.2"], ...base.vertigoT.map((x) => [x]), ...base.daysT.map((x) => [x]), ...base.roleT.map((x) => [x]),
        ...[1, 2, 3, 4, 5].map((k) => [pat.list(words.slice(0, k), l)])];
      for (const [k, v] of Object.entries(base)) {
        const at = `/logic/locales/${l}/sum/${k}`;
        const m = mine[k];
        if (typeof v === "function") {
          if (!c.check(typeof m === "function", at, null, "function", typeof m)) continue;
          if (v.length === 3) {
            for (let mask = 0; mask < 8; mask++) {
              const bits = [!!(mask & 4), !!(mask & 2), !!(mask & 1)];
              d(v(...bits), m(...bits), `${at}(${bits.join(",")})`);
            }
          } else {
            for (const a of args) d(v(...a), m(...a), `${at}(${JSON.stringify(a[0])})`);
          }
        } else {
          d(v, m, at);
        }
      }
    }

    // ------------------------------------------------------------------ logic: probes
    const list = (L.probes && L.probes.list) || [];
    const dataOf = (p) => Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v !== "function"));
    d(prb.ALL_PROBES.map(dataOf), list.map(dataOf), "/logic/probes/list");
    c.check(L.probes && L.probes.version === prb.PROBE_SET_VERSION, "/logic/probes/version", null, prb.PROBE_SET_VERSION, L.probes && L.probes.version);
    c.check(L.moduleId === (R.logicBinding || {}).moduleId, "/logic/moduleId", null, (R.logicBinding || {}).moduleId, L.moduleId);

    // ------------------------------------------------------------------ lexicon
    const lex = R.lexicon || {};
    // The shipped lexicon is exactly 0.3.1 + the delta chain (each delta landed, or not yet, as
    // revertLexiconDelta allows), key order included; anything else FAILS here as well as in the
    // diff below.
    const lex031 = revertLexiconChain(lex, [LEXICON_DELTA, LEXICON_DELTA_033]);
    c.check(lex031 !== null, "/lexicon/@delta", { version: lex.version },
      `lexicon ${LEXICON_DELTA.from} + tests/harness/lexicon-delta.js + tests/harness/lexicon-delta-033.js, exactly (revertLexiconChain)`,
      "revertLexiconChain returned null");
    const rLexicon = d({
      version: ext.LEXICON_VERSION, negation: ext.NEGATION, thirdParty: ext.THIRD_PARTY, historical: ext.HISTORICAL,
      bool: ext.BOOL_EX, ctx: ext.CTX_EX, scale: ext.SCALE_EX, multi: ext.MULTI_EX, redFlags: ext.RF_PHRASES,
    }, {
      version: lex.version, negation: lex.negation, thirdParty: lex.thirdParty, historical: lex.historical,
      bool: lex.bool, ctx: lex.ctx, scale: lex.scale, multi: lex.multi, redFlags: lex.redFlags,
    }, "/lexicon", ad13);
    const deltaLanded = lex032 !== null && lex032.version === LEXICON_DELTA.to;
    const delta033Landed = lex.version === LEXICON_DELTA_033.to;
    const seen = (id) => rLexicon.observed.has(id) && rVersions.observed.has(id);
    h.expect("AD13", { precondition: deltaLanded, observed: seen("AD13") });
    h.expect("AD18", { precondition: delta033Landed, observed: seen("AD18") });
    c.note(deltaLanded
      ? `lexicon ${lex.version} ${lex031 !== null ? "=" : "is NOT exactly"} ${LEXICON_DELTA.from} + the approved delta${delta033Landed ? ` + the ${LEXICON_DELTA_033.from} → ${LEXICON_DELTA_033.to} delta (AD18 ${seen("AD18") ? "observed" : "NOT observed"})` : ""} (AD13 ${seen("AD13") ? "observed" : "NOT observed"} at /lexicon and /module/versions)`
      : `lexicon ${lex.version}: the ${LEXICON_DELTA.from} → ${LEXICON_DELTA.to} delta has not landed`);

    // ------------------------------------------------------------------ samples and demo
    const scrText = await h.baselineText("MASQUE_Screener_v0_3.jsx");
    const buttons = {};
    for (const m of scrText.matchAll(/loadSample\("(\w+)"\)\}><(\w+) size=\{14\}\/> ([^<]+)<\/button>/g)) buttons[m[1]] = { icon: m[2], buttonLabel: m[3] };
    const want = Object.entries(scr.SAMPLE_CASES).map(([id, s]) => {
      const o = { id, label: s.label, buttonLabel: buttons[id] && buttons[id].buttonLabel, icon: buttons[id] && buttons[id].icon, complaint: s.complaint, ctx: s.ctx };
      if (s.rf) o.rf = s.rf;
      o.a = s.a;
      return o;
    });
    for (const s of sim.SCENARIOS) {
      const ap = s.apply();
      const o = { id: `sim-${s.id}`, label: s.label, group: "scenario", why: s.why, complaint: "", a: ap.answers };
      if (Object.keys(ap.rf || {}).length) o.rf = ap.rf;
      if (ap.safety !== true) o.safetyReviewed = !!ap.safety;
      want.push(o);
    }
    const cases = R.sampleCases || [];
    c.check(cases.length === want.length, "/sampleCases/length", null, want.length, cases.length);
    for (const w of want) {
      const m = cases.find((x) => x.id === w.id);
      if (!c.check(!!m, `/sampleCases/${w.id}`, null, "present", "absent")) continue;
      d(w, proj(m, Object.keys(w)), `/sampleCases/${w.id}`, { keyOrder: false });
      if (m.rf && !w.rf) c.check(Object.keys(m.rf).length === 0, `/sampleCases/${w.id}/rf`, null, "none", m.rf);
      if (w.group === "scenario") c.check(typeof m.buttonLabel === "string" && m.buttonLabel.length > 0, `/sampleCases/${w.id}/buttonLabel`, null, "non-empty", m.buttonLabel);
    }
    d(sim.FULL_HIGH, (cases.find((x) => x.id === "sim-high") || {}).a, "/sampleCases/sim-high/a/@FULL_HIGH");
    d(scr.DEMO_PATIENT, (R.demo || {}).patient, "/demo/patient");
    d(scb.PATIENT, (R.demo || {}).patient, "/demo/patient/@scribe");
    d(scb.SCRIPT, (R.demo || {}).transcript, "/demo/transcript");

    // ------------------------------------------------------------------ research
    const P = rrp.PROJECTS.MASQUE;
    const res = R.research || {};
    d(P, proj({ ...res, calibration: res.calibration && { midpoint: res.calibration.midpoint, slope: res.calibration.slope } }, Object.keys(P)), "/research");
    d(sim.COHORTS, (res.demoCohorts || []).map((x) => proj(x, ["id", "label", "why"])), "/research/demoCohorts");
    c.check(res.projectKey === "MASQUE" && Object.prototype.hasOwnProperty.call(rrp.PROJECTS, res.projectKey), "/research/projectKey", null, "MASQUE (a PROJECTS key)", res.projectKey);

    // ------------------------------------------------------------------ identity
    const q = h.withFixedClock("2026-10-01T12:00:00.000Z", () => scr.buildQuestionnaire());
    const cds = scr.buildCdsHooks();
    const svc = cds.discovery.services[0];
    const ex = cds.exampleResponses;
    const firstRef = scr.DOMAIN_ORDER.flatMap((k) => scr.ITEMS[k].items).find((it) => it.ref);
    const refItem = q.item.flatMap((g) => g.item || []).find((it) => it.linkId === firstRef.id);
    const prior = /code=([^&|]+)\|([^&]+)&/.exec(svc.prefetch.priorScreens);
    const row = h.withSeededRandom(1, () => scr.screenToCohortRow({ patient: scr.DEMO_PATIENT, answers: {}, total: 0, coverage: 0, scorable: false, band: "indeterminate", activeFlags: [], complaint: "" }));
    const bundle = h.withFixedClock("2026-10-01T12:00:00.000Z", () => scb.buildBundle({ patient: scb.PATIENT, answers: {}, total: 0, floor: 0, ceiling: 0, coverage: 0, scorable: false, band: "indeterminate", domains: scb.computeScore({}).domains, complaint: "", note: "", activeFlags: [] }));
    const obs = bundle.entry.find((e) => e.resource.resourceType === "Observation").resource;
    const doc = bundle.entry.find((e) => e.resource.resourceType === "DocumentReference").resource;
    const flagForDetail = scr.RED_FLAGS.find((f) => ex.redFlagPresent.cards[0].detail.startsWith(`${f.action}. `));
    const settled = ex.settledNonLowBand.cards[0];
    const settledScore = Number((/ (\d+)\/100 /.exec(settled.summary) || [])[1]);
    const F = module.fhir || {}, C = module.cds || {};
    d({
      questionnaireUrl: scr.QUESTIONNAIRE_URL, questionnaireName: q.name, questionnaireTitle: q.title, publisher: q.publisher,
      description: q.description, safetyGroupText: q.item[0].text, codeSystem: q.item[0].item[0].code[0].system,
      answerSystem: scr.ANSWER_SYSTEM, criteriaSystem: refItem && refItem.code[0].system, weightExtension: scr.WEIGHT_EXT,
      indexCode: prior && prior[2], indexDisplay: obs.code.coding[0].display, documentType: doc.type.text,
      documentTitle: doc.content[0].attachment.title, screenIdPrefix: (/^(.*-)[0-9a-z]+-[0-9a-z]*$/.exec(row.screen_id) || [])[1],
      filePrefix: (/downloadText\(`([a-z0-9-]+)-pilot-cohort-/.exec(scrText) || [])[1],
    }, proj(F, ["questionnaireUrl", "questionnaireName", "questionnaireTitle", "publisher", "description", "safetyGroupText", "codeSystem",
      "answerSystem", "criteriaSystem", "weightExtension", "indexCode", "indexDisplay", "documentType", "documentTitle", "screenIdPrefix", "filePrefix"]), "/fhir");
    c.check(prior && prior[1] === F.codeSystem, "/fhir/codeSystem/@prefetch", null, prior && prior[1], F.codeSystem);
    d({
      serviceId: svc.id, hook: svc.hook, title: svc.title, description: svc.description, source: ex.redFlagPresent.cards[0].source,
      safetyCardUuid: ex.redFlagPresent.cards[0].uuid, indexCardUuid: settled.uuid,
      examples: {
        redFlagPresent: { flagId: flagForDetail && flagForDetail.id, summary: ex.redFlagPresent.cards[0].summary },
        settled: { score: settledScore, band: scr.bandFor(settledScore), summary: settled.summary, detail: settled.detail },
      },
    }, proj(C, ["serviceId", "hook", "title", "description", "source", "safetyCardUuid", "indexCardUuid", "examples"]), "/cds");
    d(settled.source, C.source, "/cds/source/@settled");

    // ------------------------------------------------------------------ calibration
    c.check(gates.calibrationGate(module) === true, "/calibrationGate", null, true, gates.calibrationGate(module));
    const hs = await hash.rubricHashes(R);
    c.check(hs.scoringHash === (res.calibration && res.calibration.appliesTo && res.calibration.appliesTo.scoringHash), "/research/calibration/appliesTo/scoringHash",
      null, hs.scoringHash, res.calibration && res.calibration.appliesTo && res.calibration.appliesTo.scoringHash);
    c.check(module.hashes && module.hashes.scoringHash === hs.scoringHash, "/module/hashes/scoringHash", null, hs.scoringHash, module.hashes && module.hashes.scoringHash);

    // ------------------------------------------------------------------ the EMR template delta (release 0.4.3)
    // Release 0.4.8 (follow-up): the clinical lead's plan line adds one key under emrTemplate
    // (tests/harness/emr-plan-delta-048.js, pinned below). Every emrTemplate check before it runs on
    // the rubric without it (RP), which revertEmrDecisionsDelta proves exact.
    const PD = EMR_PLAN_DELTA;
    const Rp0 = revertEmrDecisionsDelta(R, PD);
    const planLanded = Rp0 !== null && Rp0 !== R;
    const RP = planLanded ? Rp0 : R;
    // Release 0.4.6: the clinical lead's answers add two keys under emrTemplate (tests/harness/
    // emr-decisions-delta.js, pinned below). The checks of the signed-off block run on the rubric
    // without them (Rd), which revertEmrDecisionsDelta proves exact.
    const ED = EMR_DECISIONS_DELTA;
    const Rd0 = revertEmrDecisionsDelta(RP, ED);
    const decLanded = Rd0 !== null && Rd0 !== RP;
    const Rd = decLanded ? Rd0 : RP;
    const emrKey = EMR_DELTA.path.slice(1);
    c.check(EMR_DELTA.release === "0.4.3" && emrKey === "emrTemplate" && EMR_DELTA.before === "changelog", "/@emrDelta/where", null,
      "release 0.4.3, /emrTemplate, before changelog", { release: EMR_DELTA.release, path: EMR_DELTA.path, before: EMR_DELTA.before });
    c.check(EMR_DELTA.drafted && EMR_DELTA.drafted.reviewed === true && EMR_DELTA.drafted.date === "2026-10-06", "/@emrDelta/drafted", null,
      "drafted 2026-10-06; reviewed (release 0.4.4: signed off by the clinical lead)", EMR_DELTA.drafted);
    // Release 0.4.4: reviewed only together with the clinical lead's complete sign-off record, pinned.
    d({ by: "clinical lead", date: "2026-10-07",
      scope: "emrTemplate content and the generated note as implemented in release 0.4.3 (decisions D1-D16, review rounds 1-4)",
      channel: "chat" }, EMR_DELTA.signOff, "/@emrDelta/signOff");
    {
      // The completeness test applyEmrDelta and the extractor share: the committed record passes; a
      // missing field or a date that is not a real calendar date does not, and applyEmrDelta refuses
      // such a delta before it looks at the rubric.
      const so = EMR_DELTA.signOff || {};
      const bad = [["no by", { ...so, by: " " }], ["no channel", { ...so, channel: undefined }],
        ["month 13", { ...so, date: "2026-13-45" }], ["30 February", { ...so, date: "2026-02-30" }],
        ["not padded", { ...so, date: "2026-1-07" }], ["not a record", "2026-10-07"]];
      const passed = bad.filter(([, s]) => emrSignOffComplete(s)).map(([n]) => n);
      c.check(emrSignOffComplete(EMR_DELTA.signOff) && passed.length === 0, "/@emrDelta/signOff/@complete", null,
        "the committed record is complete; incomplete records and impossible dates are refused", { committed: emrSignOffComplete(EMR_DELTA.signOff), wronglyAccepted: passed });
      let refused;
      try { applyEmrDelta(R, { ...EMR_DELTA, signOff: { ...so, date: "2026-02-30" } }); refused = "not refused"; } catch (e) { refused = e.message; }
      c.check(/signOff/.test(refused), "/@emrDelta/signOff/@refused", null, "applyEmrDelta refuses a reviewed delta whose signOff date is 2026-02-30", refused);
    }
    const rubric0 = revertEmrDelta(Rd, EMR_DELTA);
    const emrLanded = rubric0 !== null && rubric0 !== Rd;
    c.check(emrLanded, "/emrTemplate/@delta", null, "the rubric without emrTemplate + tests/harness/emr-delta.js, exactly (revertEmrDelta)", rubric0 === null ? "revertEmrDelta returned null" : "not landed");
    if (emrLanded) {
      let reapplied = null;
      try { reapplied = JSON.stringify(applyEmrDelta(rubric0, EMR_DELTA)); } catch (e) { reapplied = `throws: ${e.message}`; }
      c.check(reapplied === JSON.stringify(Rd), "/emrTemplate/@delta/reapply", null, "applyEmrDelta(revert) gives the shipped rubric without the 0.4.6 decisions byte for byte (key order)", reapplied && reapplied.slice(0, 120));
      const keys = Object.keys(R);
      c.check(keys.indexOf(emrKey) >= 0 && keys[keys.indexOf(emrKey) + 1] === EMR_DELTA.before, "/emrTemplate/@place", null, `just before ${EMR_DELTA.before}`, keys);
    }
    d(EMR_DELTA.value, Rd.emrTemplate, "/emrTemplate");
    // Release 0.4.4: the block the clinical lead signed off on 2026-10-07 is the one release 0.4.3
    // shipped (bafb576): SHA-256 of JSON.stringify(rubric.emrTemplate), key order included. Any
    // change to an emrTemplate string, row or citation is new content outside that sign-off, so it
    // fails here until a new sign-off is recorded in EMR_DELTA.signOff and this pin moves with it.
    // Release 0.4.6: the block under the clinical lead's added keys (Rd), which must still be it.
    const SIGNED_OFF_EMR_SHA256 = "fb63a2b9d3a20d84298947ba4b8099755867b5e63a289142f21ce6b0cb667c52";
    const emrSha = Rd.emrTemplate === undefined ? null : await hash.sha256Hex(JSON.stringify(Rd.emrTemplate));
    c.check(emrSha === SIGNED_OFF_EMR_SHA256, "/emrTemplate/@signedOff", null, `the signed-off block (SHA-256 ${SIGNED_OFF_EMR_SHA256})`, emrSha);
    c.check(module.emrTemplate !== null && JSON.stringify(module.emrTemplate) === JSON.stringify(R.emrTemplate), "/module/emrTemplate", null, "rubric.emrTemplate, as is", module.emrTemplate === null ? null : "differs");
    const logAt = (k) => (R.changelog || [])[(R.changelog || []).length - k];
    d(EMR_DELTA.changelog, logAt(7), "/changelog/@emrDelta");
    // Release 0.4.4: the sign-off entry right after it, verbatim, dated as the sign-off; it is
    // followed by the referral entry (release 0.4.5), the emr-decisions entry (release 0.4.6), the
    // lexicon 0.3.3 entry (release 0.4.7) and the question and emr-plan entries (release 0.4.8),
    // each pinned below.
    d(EMR_DELTA.signOffChangelog, logAt(6), "/changelog/@emrSignOff");
    c.check(!!EMR_DELTA.signOffChangelog && !!EMR_DELTA.signOff && EMR_DELTA.signOffChangelog.kind === "sign-off" && EMR_DELTA.signOffChangelog.date === EMR_DELTA.signOff.date,
      "/changelog/@emrSignOff/kind", null, "kind sign-off, dated as the signOff", EMR_DELTA.signOffChangelog && { kind: EMR_DELTA.signOffChangelog.kind, date: EMR_DELTA.signOffChangelog.date });
    {
      // One basis per entry, exactly (review round 2; the extractor's eighth EMR check, here too):
      // every citation, reference, the instrument-recs list, every red-flag list and placeholder,
      // history row, checklist row and exam row has a non-empty basis, and no basis names anything else.
      const v = EMR_DELTA.value || {};
      const entries = [
        ...Object.keys(v.citations || {}).map((k) => `/citations/${k}`),
        ...(v.references || []).map((_, i) => `/references/${i}`),
        ...(v.instrumentRecs ? ["/instrumentRecs"] : []),
        ...Object.keys(v.redFlagRefs || {}).map((k) => `/redFlagRefs/${k}`),
        ...Object.keys(v.redFlagPlaceholders || {}).map((k) => `/redFlagPlaceholders/${k}`),
        ...(v.history || []).map((_, i) => `/history/${i}`),
        ...(v.checklist || []).map((_, i) => `/checklist/${i}`),
        ...(v.examRows || []).map((_, i) => `/examRows/${i}`),
      ];
      const basis = EMR_DELTA.basis || {};
      const missing = entries.filter((p) => typeof basis[p] !== "string" || !basis[p].trim());
      const stray = Object.keys(basis).filter((p) => !entries.includes(p));
      c.check(entries.length > 0 && !missing.length && !stray.length, "/@emrDelta/basis", null, `exactly one non-empty basis per entry (${entries.length})`, { missing, stray });
    }

    // ------------------------------------------------------------------ the referral delta (release 0.4.5)
    // The clinical lead's referral rule for dizziness cases (chat, 2026-10-07 to 2026-10-10), applied
    // under /phenotypes/referral only. The revert, proven by re-applying to the same bytes, guarantees
    // the shipped table is the baseline-extracted one plus exactly this delta.
    const RD = REFERRAL_DELTA;
    const rubricR0 = revertReferralDelta(R, RD);
    const refLanded = rubricR0 !== null && rubricR0 !== R;
    c.check(refLanded, "/phenotypes/referral/@delta", null, "the baseline-extracted referral table + tests/harness/referral-delta.js, exactly (revertReferralDelta)",
      rubricR0 === null ? "revertReferralDelta returned null" : "not landed");
    if (refLanded) {
      let reapplied = null;
      try { reapplied = JSON.stringify(applyReferralDelta(rubricR0, RD)); } catch (e) { reapplied = `throws: ${e.message}`; }
      c.check(reapplied === JSON.stringify(R), "/phenotypes/referral/@delta/reapply", null, "applyReferralDelta(revert) gives the shipped rubric byte for byte (key order)", reapplied && reapplied.slice(0, 120));
      // The reverted table is the one the baseline bundles print (the rules suite compares referralFor with them under AD17).
      const r0 = rubricR0.phenotypes.referral;
      d({ byPhenotype: { otologic: { specialty: "Neuro-otology", reason: "vestibular migraine" } }, default: { specialty: "Headache medicine / Neurology", reason: "mid-facial / migrainous cause" } },
        r0, "/phenotypes/referral/@delta/baseline");
      d(Object.keys(rubricR0), Object.keys(R), "/phenotypes/referral/@delta/keys");
      // destinations is exactly the set of destinations that differ from the baseline (AD17 excuses it).
      const destOf = (r, v) => (v && r.byPhenotype && Object.prototype.hasOwnProperty.call(r.byPhenotype, v) ? r.byPhenotype[v] : r.default);
      const moved = [];
      for (const v of [...(R.phenotypes.values || []).map((x) => x.value), ""]) {
        const a = destOf(r0, v), b = destOf(R.phenotypes.referral, v);
        if (a.reason !== b.reason) moved.push({ phenotype: v, reason: `${a.reason} → ${b.reason}` });
        else if (a.specialty !== b.specialty) moved.push({ phenotype: v, reason: b.reason, from: a.specialty, to: b.specialty });
      }
      d(RD.destinations, moved, "/phenotypes/referral/@delta/destinations");
    }
    // The decision record and the lead's words, pinned (quotes.definition is the lead's definition
    // of 2026-10-07 verbatim, kept as history; quotes.amendment the lead's two messages of 2026-10-10).
    d({ release: "0.4.5", decided: { by: "clinical lead", channel: "chat", dates: ["2026-10-07", "2026-10-09", "2026-10-10"] },
      quotes: {
        referral: { date: "2026-10-07", text: "Yes, dizziness cases should be referred to neurology, and neuro-otology if there is a true vertiginous component or a history of ear or brain surgeries." },
        definition: { date: "2026-10-07", text: [
          "• Internal Vertigo: A false sensation of self-motion. The person feels like they are spinning clockwise/counter-clockwise, tilting, swaying, bobbing, or being pulled in a specific direction.",
          "• External Vertigo: A false sensation that the surrounding environment is moving, spinning, or whirling around them.",
          "The direction is often predictable (e.g. \"always to the right\")",
        ] },
        checklist: { date: "2026-10-07", text: "Yes, checklist showing even when red flag is open is okay to proceed" },
        both: { date: "2026-10-09", text: "both cases should follow the dizziness rule" },
        clarification: { date: "2026-10-09", text: "Vertigo episodes that last between 30 min and 12 hours should count as vertigo for purposes of ruling out meniere's disease, transient vertigo (true room spinning for a few seconds can count as vertigo which can be consistent with migrainous vertigo). A rocking or bobbing sensation is not true vertigo but a dizziness morphology that can be consistent with migrainous symptoms. Also some people describe \"the floor falling out from underneath them\"." },
        checklistUnreviewed: { date: "2026-10-09", text: "The checklist can be shown regardless if the safety screen is done, the user should be able to see progress and alerted if red flags pop up." },
        amendment: { date: "2026-10-10", text: [
          "classify rocking or bobbing as dizziness and not true vertigo, it counts toward the vestibular score still as it is imbalance",
          "Swaying is imbalance also",
        ] },
      },
      amendments: [{ path: "/phenotypes/referral/clinicianRules/0/definition/0", quote: "amendment", removed: "swaying, bobbing, " }],
      changed: [{ path: "/phenotypes/referral/byPhenotype/otologic/specialty", from: "Neuro-otology", to: "Neurology" }],
      destinations: [
        { phenotype: "otologic", reason: "vestibular migraine", from: "Neuro-otology", to: "Neurology" },
        { phenotype: "both", reason: "mid-facial / migrainous cause", from: "Headache medicine / Neurology", to: "Neurology" },
      ] },
    { release: RD.release, decided: RD.decided, quotes: RD.quotes, amendments: RD.amendments, changed: RD.changed, destinations: RD.destinations }, "/@referralDelta/record");
    {
      const ref = (R.phenotypes || {}).referral || {};
      d({ specialty: "Neurology", reason: "vestibular migraine" }, (ref.byPhenotype || {}).otologic, "/phenotypes/referral/byPhenotype/otologic");
      d({ specialty: "Neurology", reason: "mid-facial / migrainous cause" }, (ref.byPhenotype || {}).both, "/phenotypes/referral/byPhenotype/both");
      d({ specialty: "Headache medicine / Neurology", reason: "mid-facial / migrainous cause" }, ref.default, "/phenotypes/referral/default");
      d(["otologic", "both"], Object.keys(ref.byPhenotype || {}), "/phenotypes/referral/byPhenotype/@keys");
      // No automatic escalation: the table holds its destinations and the clinician rules only.
      d(["byPhenotype", "default", "clinicianRules"], Object.keys(ref), "/phenotypes/referral/@keys");
      const rulesList = ref.clinicianRules || [];
      const addedRules = (RD.added.find((row) => row.path === "/phenotypes/referral/clinicianRules") || {}).value;
      d(addedRules, rulesList, "/phenotypes/referral/clinicianRules");
      d([{ path: "/phenotypes/referral/byPhenotype/both", value: { specialty: "Neurology", reason: "mid-facial / migrainous cause" } }],
        RD.added.filter((row) => row.path !== "/phenotypes/referral/clinicianRules"), "/@referralDelta/added/both");
      const e = rulesList[0] || {};
      d(["phenotypes", "source", "rule", "definition", "clarificationSource", "clarification", "confirm"], Object.keys(e), "/phenotypes/referral/clinicianRules/0/@fields");
      // The source names the definition's amendment (one source prints after "Referral rule" and after
      // "Definition"; the rule itself is unchanged since 2026-10-07).
      d({ phenotypes: ["otologic", "both"], source: "clinical lead, 2026-10-07; definition amended 2026-10-10", clarificationSource: "clinical lead, 2026-10-09" },
        { phenotypes: e.phenotypes, source: e.source, clarificationSource: e.clarificationSource }, "/phenotypes/referral/clinicianRules/0/@rule");
      c.check(rulesList.length === 1 && `Yes, ${e.rule}` === RD.quotes.referral.text, "/phenotypes/referral/clinicianRules/0/rule", null, "the lead's sentence without its reply word \"Yes, \"", e.rule);
      // The definition as the lead amended it on 2026-10-10, pinned line by line: the internal-vertigo
      // line without "swaying, bobbing, ", the external-vertigo and direction lines verbatim.
      d([
        "• Internal Vertigo: A false sensation of self-motion. The person feels like they are spinning clockwise/counter-clockwise, tilting, or being pulled in a specific direction.",
        "• External Vertigo: A false sensation that the surrounding environment is moving, spinning, or whirling around them.",
        "The direction is often predictable (e.g. \"always to the right\")",
      ], e.definition, "/phenotypes/referral/clinicianRules/0/definition");
      // ... which is the lead's definition of 2026-10-07 (quotes.definition, still verbatim, "swaying,
      // bobbing, " in it exactly once) with exactly that one removal, on words the amendment names.
      const def07 = Array.isArray(RD.quotes.definition.text) ? RD.quotes.definition.text : [];
      c.check(def07.length === 3 && def07[0].split("swaying, bobbing, ").length === 2, "/@referralDelta/quotes/definition/@original", null,
        "the 2026-10-07 definition kept verbatim: its internal-vertigo line still lists \"swaying, bobbing, \" (once)", def07[0]);
      d([def07[0] && def07[0].replace("swaying, bobbing, ", ""), def07[1], def07[2]], e.definition, "/phenotypes/referral/clinicianRules/0/definition/@amendment");
      const amendmentSaid = [].concat(RD.quotes.amendment && RD.quotes.amendment.text).join(" ").toLowerCase();
      c.check(/\bswaying\b/.test(amendmentSaid) && /\bbobbing\b/.test(amendmentSaid), "/@referralDelta/quotes/amendment/@names", null,
        "the lead's amendment names swaying and bobbing (the words removed)", amendmentSaid);
      // The printed definition no longer names swaying or bobbing, on any line.
      c.check(Array.isArray(e.definition) && e.definition.length === 3 && !e.definition.some((l) => /swaying|bobbing/i.test(l)),
        "/phenotypes/referral/clinicianRules/0/definition/@no-swaying-bobbing", null, "no line of the printed definition contains swaying or bobbing", e.definition);
      // The clarification of 2026-10-09 is unchanged by the amendment and still printed verbatim.
      d([RD.quotes.clarification.text], e.clarification, "/phenotypes/referral/clinicianRules/0/clarification");
      d(["Vertigo episodes that last between 30 min and 12 hours should count as vertigo for purposes of ruling out meniere's disease, transient vertigo (true room spinning for a few seconds can count as vertigo which can be consistent with migrainous vertigo). A rocking or bobbing sensation is not true vertigo but a dizziness morphology that can be consistent with migrainous symptoms. Also some people describe \"the floor falling out from underneath them\"."],
        e.clarification, "/phenotypes/referral/clinicianRules/0/clarification/@unchanged");
      d(["True vertigo (internal or external)", "Prior ear or brain surgery"], e.confirm, "/phenotypes/referral/clinicianRules/0/confirm");
      // The instrument's own texts are unchanged (masque.logic.js is not touched): pr_internal_vertigo
      // (its options and its why, the Bárány vestibular-migraine reading) and the routing recommendation.
      const vm = list.find((pr) => pr.id === "pr_internal_vertigo");
      d(["Yes — rocking or bobbing", "Yes, but only seconds at a time", "No sensation of self-motion"], vm ? vm.opts.map((o) => o.l) : null, "/logic/probes/pr_internal_vertigo/@options");
      c.check(!!vm && vm.why.startsWith("Internal vertigo — a false sense of self-motion — qualifies under Bárány exactly as spinning does"), "/logic/probes/pr_internal_vertigo/@why",
        null, "the probe's why unchanged (the instrument's Bárány reading)", vm && vm.why.slice(0, 80));
      const vmRule = (L.routing || []).find((r) => r.id === "vestibular_migraine");
      c.check(!!vmRule && /Refer neuro-otology \/ vestibular therapy\./.test(vmRule.copy.screener.p) && /Refer neuro-otology \/ vestibular therapy;/.test(vmRule.copy.scribe.p),
        "/logic/routing/vestibular_migraine/@unchanged", null, "the recommendation still names neuro-otology / vestibular therapy (unchanged, by the lead's choice)", vmRule && vmRule.copy.screener.p);
      // One basis per changed path, per added byPhenotype row and per field of the rule, exactly.
      const entries = [...RD.changed.map((row) => row.path), ...RD.added.filter((row) => row.path !== "/phenotypes/referral/clinicianRules").map((row) => row.path),
        ...rulesList.flatMap((x, i) => Object.keys(x).map((k) => `/phenotypes/referral/clinicianRules/${i}/${k}`))];
      const missing = entries.filter((p) => typeof RD.basis[p] !== "string" || !RD.basis[p].trim());
      const stray = Object.keys(RD.basis).filter((p) => !entries.includes(p));
      c.check(entries.length > 0 && !missing.length && !stray.length, "/@referralDelta/basis", null, `exactly one non-empty basis per entry (${entries.length})`, { missing, stray });
    }
    // The referral entry, verbatim, dated as the last decision; since release 0.4.6 the emr-decisions
    // entry follows it, since release 0.4.7 the lexicon 0.3.3 entry and since release 0.4.8 the
    // question and emr-plan entries.
    d(RD.changelog, logAt(5), "/changelog/@referralDelta");
    c.check(RD.changelog.kind === "referral" && RD.changelog.date === RD.decided.dates[RD.decided.dates.length - 1], "/changelog/@referralDelta/kind", null,
      "kind referral, dated as the last decision", { kind: RD.changelog.kind, date: RD.changelog.date });

    // ------------------------------------------------------------------ the EMR decisions delta (release 0.4.6)
    // The clinical lead's answers on the EMR template's open items (chat, 2026-10-10). The revert,
    // proven by re-applying to the same bytes, guarantees the shipped emrTemplate is the signed-off
    // block of release 0.4.3 (pinned above, on Rd) plus exactly these two keys.
    c.check(decLanded, "/emrTemplate/@decisions", null, "the signed-off emrTemplate + tests/harness/emr-decisions-delta.js, exactly (revertEmrDecisionsDelta)",
      Rd0 === null ? "revertEmrDecisionsDelta returned null" : "not landed");
    if (decLanded) {
      let reapplied = null;
      try { reapplied = JSON.stringify(applyEmrDecisionsDelta(Rd, ED)); } catch (e) { reapplied = `throws: ${e.message}`; }
      c.check(reapplied === JSON.stringify(RP), "/emrTemplate/@decisions/reapply", null, "applyEmrDecisionsDelta(revert) gives the shipped rubric without the 0.4.8 plan line byte for byte (key order)", reapplied && reapplied.slice(0, 120));
      d(Object.keys(Rd), Object.keys(RP), "/emrTemplate/@decisions/keys");
      d([...Object.keys(Rd.emrTemplate || {}), "pastHistory"], Object.keys(RP.emrTemplate || {}), "/emrTemplate/@decisions/emrKeys");
    }
    // The decision record and the lead's answers, pinned (the questions and options are in the delta, verbatim).
    d({ release: "0.4.6", decided: { by: "clinical lead", channel: "chat", date: "2026-10-10" },
      answers: { also: "Workup + referral + references", dz4: "Keep the clause (Recommended)",
        addBack: "Modifying conditions,Family history of migraine,Assessment 'Considerations'", hints: "Add a clinician line (Recommended)" },
      dates: ["2026-10-10", "2026-10-10", "2026-10-10", "2026-10-10"],
      paths: ["/emrTemplate/pastHistory", "/emrTemplate/examRows/14/optionPlaceholders"] },
    { release: ED.release, decided: ED.decided, answers: Object.fromEntries(Object.entries(ED.quotes || {}).map(([k, v]) => [k, v.answer])),
      dates: Object.values(ED.quotes || {}).map((v) => v.date), paths: (ED.added || []).map((r) => r.path) }, "/@emrDecisionsDelta/record");
    {
      const E = RP.emrTemplate || {};
      // The added data, pinned.
      d([{ label: "Modifying conditions (asthma, cystic fibrosis, immunocompromise, aspirin-exacerbated respiratory disease, ciliary dyskinesia)", group: "medical" },
        { item: "m_fhx", group: "family" }], E.pastHistory, "/emrTemplate/pastHistory");
      d({ label: "Head impulse / nystagmus / test of skew (HINTS)", citations: ["AFP-DIZZ23", "GRACE3-23"], probe: "pr_head_impulse",
        optionPlaceholders: [{ option: 0, placeholder: "clinician interpretation of HINTS and any imaging decision" }] }, (E.examRows || [])[14], "/emrTemplate/examRows/14");
      // Option 0 of pr_head_impulse is the central pattern (the instrument, unchanged), and m_fhx is
      // the item whose own wording the family-history line prints.
      const hi = list.find((pr) => pr.id === "pr_head_impulse");
      d(["Normal impulse (points central)", "Corrective saccade (peripheral)", "Deferred"], hi ? hi.opts.map((o) => o.l) : null, "/logic/probes/pr_head_impulse/@options");
      const fhx = module.itemById && module.itemById.m_fhx;
      d({ text: "Personal or family history of migraine", patientClin: "Personal or family history of migraine" }, fhx ? { text: fhx.text, patientClin: fhx.patientClin } : null, "/domains/m_fhx/@wording");
      // The approved wording: the label and the placeholder are the strings the chosen options quote.
      const optionOf = (x, label) => ((x && x.options) || []).find((o) => o.label === label) || { description: "" };
      const modLabel = E.pastHistory && E.pastHistory[0] ? E.pastHistory[0].label : null;
      const hintsText = E.examRows && E.examRows[14] && E.examRows[14].optionPlaceholders ? E.examRows[14].optionPlaceholders[0].placeholder : null;
      c.check(!!modLabel && optionOf(ED.quotes.addBack, "Modifying conditions").description.includes(`'${modLabel}: [ ]'`), "/emrTemplate/pastHistory/0/@approved", null,
        "the label the lead approved (quoted in the chosen option)", modLabel);
      c.check(!!hintsText && optionOf(ED.quotes.hints, "Add a clinician line (Recommended)").description.includes(`'[${hintsText}]'`), "/emrTemplate/examRows/14/optionPlaceholders/@approved", null,
        "the placeholder the lead approved (quoted in the chosen option)", hintsText);
      // The block of release 0.4.6 (the signed-off block plus the lead's 0.4.6 additions), under the
      // 0.4.8 plan line (RP); the shipped block is pinned with the plan delta below.
      const EMR_046_SHA256 = "0152cfd832471aef8723a08ed578e7274c3ea8af8754671663c40494f804e16d";
      const sha046 = RP.emrTemplate === undefined ? null : await hash.sha256Hex(JSON.stringify(RP.emrTemplate));
      c.check(sha046 === EMR_046_SHA256, "/emrTemplate/@release046", null, `the signed-off block plus the lead's 0.4.6 additions (SHA-256 ${EMR_046_SHA256})`, sha046);
      // One basis per past-history row and per option placeholder, exactly.
      const entries = [...(E.pastHistory || []).map((_, i) => `/pastHistory/${i}`),
        ...((E.examRows && E.examRows[14] && E.examRows[14].optionPlaceholders) || []).map((_, j) => `/examRows/14/optionPlaceholders/${j}`)];
      const basis = ED.basis || {};
      const missing = entries.filter((p) => typeof basis[p] !== "string" || !basis[p].trim());
      const stray = Object.keys(basis).filter((p) => !entries.includes(p));
      c.check(entries.length === 3 && !missing.length && !stray.length, "/@emrDecisionsDelta/basis", null, `exactly one non-empty basis per entry (${entries.length})`, { missing, stray });
    }
    // The emr-decisions entry, verbatim, dated as the decision; since release 0.4.7 the lexicon 0.3.3
    // entry follows it, and since release 0.4.8 the question entry.
    d(ED.changelog, logAt(4), "/changelog/@emrDecisionsDelta");
    c.check(ED.changelog.kind === "emr-decisions" && ED.changelog.date === ED.decided.date, "/changelog/@emrDecisionsDelta/kind", null,
      "kind emr-decisions, dated as the decision", { kind: ED.changelog.kind, date: ED.changelog.date });

    // ------------------------------------------------------------------ the lexicon 0.3.3 delta (release 0.4.7)
    // The lexicon entry is the last change-log entry but the 0.4.8 question and emr-plan entries,
    // verbatim, dated as the lead's sign-off (2026-10-12);
    // the record (request, the three answers, the sign-off) and the lead-sourced words are pinned, and
    // the sign-off is complete and applied (lexicon033SignOffProblems): no plain draft left, every struck
    // row absent, every approved row present as "lead-approved", the rows added and the qualifiers removed
    // at the sign-off in place. Mutations (a struck row put back, a draft tag, a record without its
    // author, a Part D answer that was no option) are refused.
    const D3 = LEXICON_DELTA_033;
    d(D3.changelog, logAt(3), "/changelog/@lexiconDelta033");
    c.check(D3.changelog.kind === "lexicon" && !!D3.signOff && D3.changelog.date === D3.signOff.date, "/changelog/@lexiconDelta033/kind", null,
      "kind lexicon, dated as the lead's sign-off", { kind: D3.changelog.kind, date: D3.changelog.date });
    const so3 = D3.signOff || {};
    d({ release: "0.4.7", from: "0.3.2", to: "0.3.3", request: { date: "2026-10-11", channel: "chat", by: "clinical lead" },
      answers: { redFlags: "Don't raise, no listing", answers: "Clickable answers (Recommended)", wording: "Draft, you sign off (Recommended)" },
      signOff: { by: "clinical lead", date: "2026-10-12", channel: "sign-off page + chat", totals: { rows: 306, approved: 278, struck: 18, leadOwnWords: 10 },
        partD: ["Confirm the four conditions (recommended)", "Keep \"of\" out (recommended)", "No, keep release 0.4.6's reach (recommended)", "Accept (recommended)",
          "Accept (recommended)", "Every card (recommended)", "Treat \"+/-\" as a hedge (a new draft row)", "Supply or approve wording for some items before upload", "Yes",
          "No: nothing is captured inside an exam section (recommended)", "Approve all (recommended)", "Accept (recommended)", "Approve (recommended)", "Accept (recommended)",
          "Approve (recommended)", "Accept (recommended)", "Keep (recommended)", "No for 0.4.7 (recommended)", "Accept (recommended)"],
        d8: ["More chart denials,Progressive & one-ear,No gap markers from charts", "Ear-pain card stays,Safety cards stay,Rule-out cards stay", "Keep it struck"] } },
    { release: D3.release, from: D3.from, to: D3.to, request: { date: D3.request.date, channel: D3.request.channel, by: D3.request.by },
      answers: Object.fromEntries(Object.entries(D3.decisions || {}).map(([k, v]) => [k, v.answer])),
      signOff: { by: so3.by, date: so3.date, channel: so3.channel, totals: so3.totals, partD: (so3.partD || []).map((q) => q && q.answer),
        d8: [so3.d8FollowUp && so3.d8FollowUp.part1 && so3.d8FollowUp.part1.answer, so3.d8FollowUp && so3.d8FollowUp.part2 && so3.d8FollowUp.part2.answer, so3.auralMask && so3.auralMask.answer] } },
    "/@lexiconDelta033/record");
    {
      const probs = lexicon033SignOffProblems(D3, lex);
      c.check(probs.length === 0, "/@lexiconDelta033/signOff/@complete", null, "the sign-off of 2026-10-12 complete and applied (no plain draft, every struck row absent, every approved row lead-approved)", probs);
      const cl0 = lex.clauses || {};
      const firstStruck = (so3.struck || [])[0] || {};
      const mutants = [
        ["struck-row-back", D3, { ...lex, clauses: { ...cl0, mask: [{ ph: firstStruck.ph, source: "lead-approved" }, ...(cl0.mask || [])] } }],
        ["draft-tag", D3, { ...lex, clauses: { ...cl0, affirm: (cl0.affirm || []).map((r, i) => (i === 5 ? { ...r, source: "draft" } : r)) } }],
        ["no-author", { ...D3, signOff: { ...so3, by: "" } }, lex],
        ["answer-not-an-option", { ...D3, signOff: { ...so3, partD: (so3.partD || []).map((q, i) => (i === 8 ? { ...q, answer: "Maybe" } : q)) } }, lex],
        ["unsigned", { ...D3, signOff: null }, lex],
      ];
      const accepted = mutants.filter(([, dd, ll]) => lexicon033SignOffProblems(dd, ll).length === 0).map(([k]) => k);
      c.check(firstStruck.ph === "aural" && accepted.length === 0, "/@lexiconDelta033/signOff/@refused", null, "every mutated record or lexicon refused", accepted);
    }
    {
      const cl = lex.clauses || {};
      const leadOf = (k) => (Array.isArray(cl[k]) ? cl[k] : []).filter((r) => r && r.source === "lead").map((r) => r.ph);
      const rh = (lex.clarify || []).find((x) => x && x.id === "cl_rhinorrhea");
      d({ affirm: ["endorses", "reports", "has ", "yes"], deny: ["denies", "no ", "lacks", "doesn't have"], redFlagNegation: true,
        rhinorrhea: { probe: "pr_purulence", ask: { text: "is the rhinorrhea clear or purulent?", source: "lead" } } },
      { affirm: leadOf("affirm"), deny: leadOf("deny"), redFlagNegation: cl.redFlagNegation, rhinorrhea: rh ? { probe: rh.probe, ask: rh.ask } : null },
      "/lexicon/clauses/@lead");
    }

    // ------------------------------------------------------------------ the question delta (release 0.4.8)
    // The clinical lead's question for item r_dur (chat, 2026-10-12). The revert, proven by re-applying
    // to the same bytes, guarantees that the shipped rubric is the 0.4.7 one plus exactly this change.
    c.check(qLanded, "/domains/@questionDelta", null, "the rubric before release 0.4.8 + tests/harness/question-delta-048.js, exactly (revertQuestionDelta)",
      Rq0 === null ? "revertQuestionDelta returned null" : "not landed");
    if (qLanded) {
      let reapplied = null;
      try { reapplied = JSON.stringify(applyQuestionDelta(RQ, QD)); } catch (e) { reapplied = `throws: ${e.message}`; }
      c.check(reapplied === JSON.stringify(R), "/domains/@questionDelta/reapply", null, "applyQuestionDelta(revert) gives the shipped rubric byte for byte (key order)", reapplied && reapplied.slice(0, 120));
      // Outside the instrument (Q11): the instrument and scoring hashes do not see an item's ask.
      const [hq, h0] = await Promise.all([hash.rubricHashes(R), hash.rubricHashes(RQ)]);
      c.check(hq.instrumentHash === h0.instrumentHash && hq.scoringHash === h0.scoringHash && hq.lexiconHash === h0.lexiconHash && hq.contentHash !== h0.contentHash,
        "/domains/@questionDelta/hashes", null, "instrumentHash, scoringHash and lexiconHash unchanged by the question; contentHash changed",
        { instrument: [h0.instrumentHash, hq.instrumentHash], scoring: [h0.scoringHash, hq.scoringHash], content: [h0.contentHash, hq.contentHash] });
    }
    // The record and the lead's words, pinned.
    d({ release: "0.4.8", requested: { by: "clinical lead", channel: "chat", date: "2026-10-12" },
      request: ["Fix 2: Question: recalcitrance", "How long has this been going on? ",
        "Is a yes/no, if phrasing it as such it should ask \"Have symptoms persisted over 3 months despite trials of medical management?\""],
      changed: [{ path: "/domains/0/items/0/ask", item: "r_dur", from: "How long has this been going on?",
        to: "Have symptoms persisted over 3 months despite trials of medical management?" }] },
    { release: QD.release, requested: QD.requested, request: QD.request, changed: QD.changed }, "/@questionDelta/record");
    {
      const rdur = module.itemById && module.itemById.r_dur;
      d({ ask: "Have symptoms persisted over 3 months despite trials of medical management?", text: "Symptoms have persisted or recurred for more than 3 months",
        w: 3, short: ">3 mo", patientClin: "Symptoms persisting or recurring > 3 months", scale: undefined },
      rdur ? { ask: rdur.ask, text: rdur.text, w: rdur.w, short: rdur.short, patientClin: rdur.patientClin, scale: rdur.scale } : null, "/module/itemById/r_dur/@question");
      const req = (QD.request || []).join("\n");
      c.check(QD.changed.every((row) => req.includes(`"${row.to}"`) && req.includes(row.from)), "/@questionDelta/verbatim", null,
        "each new question is a sentence the lead quoted, verbatim, and the request quotes the old one", QD.changed.map((row) => row.to));
      // apply refuses a delta whose `from` is not the shipped-before value, or whose item is another.
      const refusedBy = (dd) => { try { applyQuestionDelta(RQ, dd); return "not refused"; } catch (e) { return e.message; } };
      const row0 = QD.changed[0] || {};
      const wrongFrom = refusedBy({ ...QD, changed: [{ ...row0, from: "How long has it been going on?" }] });
      const wrongItem = refusedBy({ ...QD, changed: [{ ...row0, item: "r_abx" }] });
      const wrongPath = refusedBy({ ...QD, changed: [{ ...row0, path: "/domains/0/items/0/text" }] });
      c.check(wrongFrom !== "not refused" && wrongItem !== "not refused" && wrongPath !== "not refused", "/@questionDelta/@refused", null,
        "applyQuestionDelta refuses a wrong from, a wrong item and a path that is not an ask", { wrongFrom, wrongItem, wrongPath });
      c.check(revertQuestionDelta({ ...R, domains: [] }, QD) === null, "/@questionDelta/@revertRefused", null, "revertQuestionDelta refuses a rubric that shows neither side", "accepted");
      const entries = QD.changed.map((row) => row.path);
      const basis = QD.basis || {};
      const missing = entries.filter((pp) => typeof basis[pp] !== "string" || !basis[pp].trim());
      const stray = Object.keys(basis).filter((pp) => !entries.includes(pp));
      c.check(entries.length === 1 && !missing.length && !stray.length, "/@questionDelta/basis", null, `exactly one non-empty basis per entry (${entries.length})`, { missing, stray });
    }
    // The question entry, verbatim, dated as the request; since the follow-up the emr-plan entry follows it.
    d(QD.changelog, logAt(2), "/changelog/@questionDelta");
    c.check(QD.changelog.kind === "question" && QD.changelog.date === QD.requested.date, "/changelog/@questionDelta/kind", null,
      "kind question, dated as the request", { kind: QD.changelog.kind, date: QD.changelog.date });

    // ------------------------------------------------------------------ the EMR plan delta (release 0.4.8, follow-up)
    // The clinical lead's plan line for the EMR template (chat, 2026-10-12). The revert, proven by
    // re-applying to the same bytes, guarantees that the shipped rubric is the one before it (RP, on
    // which every emrTemplate check above runs) plus exactly this key.
    c.check(planLanded, "/emrTemplate/@planDelta", null, "the rubric before the 0.4.8 plan line + tests/harness/emr-plan-delta-048.js, exactly (revertEmrDecisionsDelta)",
      Rp0 === null ? "revertEmrDecisionsDelta returned null" : "not landed");
    if (planLanded) {
      let reapplied = null;
      try { reapplied = JSON.stringify(applyEmrDecisionsDelta(RP, PD)); } catch (e) { reapplied = `throws: ${e.message}`; }
      c.check(reapplied === JSON.stringify(R), "/emrTemplate/@planDelta/reapply", null, "applyEmrDecisionsDelta(revert) gives the shipped rubric byte for byte (key order)", reapplied && reapplied.slice(0, 120));
      d(Object.keys(RP), Object.keys(R), "/emrTemplate/@planDelta/keys");
      d([...Object.keys(RP.emrTemplate || {}), "planAdvice"], Object.keys(R.emrTemplate || {}), "/emrTemplate/@planDelta/emrKeys");
      // Outside the instrument: emrTemplate is in contentHash only.
      const [hp, h0] = await Promise.all([hash.rubricHashes(R), hash.rubricHashes(RP)]);
      c.check(hp.instrumentHash === h0.instrumentHash && hp.scoringHash === h0.scoringHash && hp.lexiconHash === h0.lexiconHash && hp.contentHash !== h0.contentHash,
        "/emrTemplate/@planDelta/hashes", null, "instrumentHash, scoringHash and lexiconHash unchanged by the plan line; contentHash changed",
        { instrument: [h0.instrumentHash, hp.instrumentHash], scoring: [h0.scoringHash, hp.scoringHash], content: [h0.contentHash, hp.contentHash] });
    }
    // The record, the lead's words and answers, and the line, pinned (written out here).
    const PLAN_LINE = "recommend a trial of migraine abortives if not contra-indicated due to other conditions.";
    d({ release: "0.4.8", requested: { by: "clinical lead", channel: "chat", date: "2026-10-12" },
      request: ["Also recommendations in the plan should also add \"recommend a trial of migraine abortives if not contra-indicated due to other conditions.\" so that a primary doctor can offer this as an option to the patient for relief in the interim."],
      answers: { when: "With the treatment refs, no red flag (Recommended)", outputs: "EMR template note (Recommended)" },
      descriptions: { when: "In the EMR note's plan, beside the empiric-treatment references, whenever they print and no red flag is open (screen points to a migrainous driver).",
        outputs: "The EMR Friendly Template plan, on both the Screener and the Scribe." },
      dates: ["2026-10-12", "2026-10-12"],
      added: [{ path: "/emrTemplate/planAdvice", value: [{ text: PLAN_LINE, source: "lead", decided: "2026-10-12" }] }] },
    { release: PD.release, requested: PD.requested, request: PD.request,
      answers: Object.fromEntries(Object.entries(PD.quotes || {}).map(([k, v]) => [k, v.answer])),
      descriptions: Object.fromEntries(Object.entries(PD.quotes || {}).map(([k, v]) => [k, v.answerDescription])),
      dates: Object.values(PD.quotes || {}).map((v) => v.date), added: PD.added }, "/@emrPlanDelta/record");
    {
      d([{ text: PLAN_LINE, source: "lead", decided: "2026-10-12" }], (R.emrTemplate || {}).planAdvice, "/emrTemplate/planAdvice");
      c.check((PD.request || []).join("\n").includes(`"${PLAN_LINE}"`) && (PD.quotes && PD.quotes.when && PD.quotes.when.question || "").includes(`"${PLAN_LINE}"`),
        "/emrTemplate/planAdvice/@verbatim", null, "the line is the sentence the lead quoted (request and question), verbatim", PLAN_LINE);
      // The shipped block: any later change to emrTemplate fails here until it is recorded.
      const SHIPPED_EMR_SHA256 = "5f74085393b4ab5e0c076bba8257fbfd85e135b948a9dbc735141fe3975dd75d";
      const shippedSha = R.emrTemplate === undefined ? null : await hash.sha256Hex(JSON.stringify(R.emrTemplate));
      c.check(shippedSha === SHIPPED_EMR_SHA256, "/emrTemplate/@shipped", null, `the signed-off block plus the lead's 0.4.6 additions and 0.4.8 plan line (SHA-256 ${SHIPPED_EMR_SHA256})`, shippedSha);
      // apply refuses the delta on the shipped rubric (the key exists); revert refuses a rubric whose
      // line differs from the delta's.
      let refused;
      try { applyEmrDecisionsDelta(R, PD); refused = "not refused"; } catch (e) { refused = e.message; }
      const altered = JSON.parse(JSON.stringify(R));
      if (altered.emrTemplate && Array.isArray(altered.emrTemplate.planAdvice) && altered.emrTemplate.planAdvice[0]) altered.emrTemplate.planAdvice[0].text = "Recommend a trial of migraine abortives if not contra-indicated due to other conditions.";
      c.check(refused !== "not refused" && revertEmrDecisionsDelta(altered, PD) === null, "/@emrPlanDelta/@refused", null,
        "apply refuses a rubric that already has planAdvice; revert refuses a re-cased line", { refused, revert: revertEmrDecisionsDelta(altered, PD) === null ? "refused" : "accepted" });
      const entries = ((R.emrTemplate || {}).planAdvice || []).map((_, i) => `/planAdvice/${i}`);
      const basis = PD.basis || {};
      const missing = entries.filter((pp) => typeof basis[pp] !== "string" || !basis[pp].trim());
      const stray = Object.keys(basis).filter((pp) => !entries.includes(pp));
      c.check(entries.length === 1 && !missing.length && !stray.length, "/@emrPlanDelta/basis", null, `exactly one non-empty basis per entry (${entries.length})`, { missing, stray });
    }
    // The emr-plan entry, verbatim, dated as the request, is the last.
    d(PD.changelog, logAt(1), "/changelog/@emrPlanDelta");
    c.check(PD.changelog.kind === "emr-plan" && PD.changelog.date === PD.requested.date && PD.changelog.note.includes(`"${PLAN_LINE}"`), "/changelog/@emrPlanDelta/kind", null,
      "kind emr-plan, dated as the request, quoting the line", { kind: PD.changelog.kind, date: PD.changelog.date });

    // ------------------------------------------------------------------ provenance sweep
    const corpus = [];
    for (const f of ["MASQUE_Screener_v0_3.jsx", "MASQUE_Scribe_v0_3.jsx", "MASQUE_Patient_v0_3.jsx", "MASQUE_Simulator.jsx",
      "MASQUE_Extraction.js", "MASQUE_Probes.js", "ResearchReadinessPanel.jsx", "MASQUE_Voice.js", "MASQUE_Population.jsx"]) {
      const text = await h.baselineText(f);
      corpus.push(normaliseSource(text), normaliseSource(text, { keepTags: true }));
    }
    const all = corpus.join("\n");
    const missing = [];
    let swept = 0;
    // Delta leaves are exempt only once the delta has landed and is proven exact (lex031 !== null).
    // Release 0.4.7: a 0.3.2 leaf that a 0.3.3 field row replaces (the version) is superseded, and the
    // 0.3.3 leaves are counted from the 0.3.2-equivalent lexicon's lengths.
    const superseded = (p) => delta033Landed && LEXICON_DELTA_033.fields.some((row) => Object.prototype.hasOwnProperty.call(row, "from")
      && (p === `/rubric/lexicon${row.path}` || p.startsWith(`/rubric/lexicon${row.path}/`)));
    const leaves = deltaLanded && lex031 !== null ? new Map([...deltaLeaves(LEXICON_DELTA, lex031)].filter(([p]) => !superseded(p))) : new Map();
    const leaves033 = delta033Landed && lex031 !== null ? deltaLeaves(LEXICON_DELTA_033, lex032) : new Map();
    // Locale-delta leaves likewise, once the delta has landed and is proven exact (es0).
    const esLeaves = esLanded ? localeDeltaLeaves(LOCALE_DELTA) : new Map();
    // EMR-delta leaves likewise (release 0.4.3), once the revert proves the block exact.
    const emrLeaves = emrLanded ? emrDeltaLeaves(EMR_DELTA) : new Map();
    // Referral-delta leaves likewise (release 0.4.5), once the revert proves the change exact.
    const refLeaves = refLanded ? referralDeltaLeaves(RD) : new Map();
    // EMR-decisions leaves likewise (release 0.4.6), once the revert proves the addition exact.
    const decLeaves = decLanded ? emrDecisionsDeltaLeaves(ED) : new Map();
    // The question leaf likewise (release 0.4.8): each changed row's `to` at its pointer.
    const qLeaves = qLanded ? new Map(QD.changed.map((row) => [`/rubric${row.path}`, row.to])) : new Map();
    // The plan-line leaves likewise (release 0.4.8, follow-up), once the revert proves the addition exact.
    const planLeaves = planLanded ? emrDecisionsDeltaLeaves(PD) : new Map();
    let exempted = 0, ex033 = 0, esExempted = 0, emrExempted = 0, refExempted = 0, decExempted = 0, qExempted = 0, planExempted = 0;
    const met = new Set(), met033 = new Set(), esMet = new Set(), emrMet = new Set(), refMet = new Set(), decMet = new Set(), qMet = new Set(), planMet = new Set();
    const sweep = (root, value) => {
      for (const [path, s] of stringLeaves(value)) {
        const full = root + path;
        if (HAND_WRITTEN.some(([re]) => re.test(full))) continue;
        if (leaves.has(full) && leaves.get(full) === s) { exempted++; met.add(full); continue; }
        if (leaves033.has(full) && leaves033.get(full) === s) { ex033++; met033.add(full); continue; }
        if (esLeaves.has(full) && esLeaves.get(full) === s) { esExempted++; esMet.add(full); continue; }
        if (emrLeaves.has(full) && emrLeaves.get(full) === s) { emrExempted++; emrMet.add(full); continue; }
        if (refLeaves.has(full) && refLeaves.get(full) === s) { refExempted++; refMet.add(full); continue; }
        if (decLeaves.has(full) && decLeaves.get(full) === s) { decExempted++; decMet.add(full); continue; }
        if (qLeaves.has(full) && qLeaves.get(full) === s) { qExempted++; qMet.add(full); continue; }
        if (planLeaves.has(full) && planLeaves.get(full) === s) { planExempted++; planMet.add(full); continue; }
        swept++;
        for (const frag of fragments(s)) {
          if (!all.includes(frag)) { missing.push({ path: full, text: s, fragment: frag }); break; }
        }
      }
    };
    sweep("/rubric", R);
    const logicData = {};
    for (const k of Object.keys(L)) if (!["locales", "probes", "reads", "format", "contractVersion", "moduleId", "logicVersion"].includes(k)) logicData[k] = L[k];
    sweep("/logic", logicData);
    for (const m of missing) c.check(false, `/@provenance${m.path}`, { text: m.text }, "a string moved from the baseline", `not found in the baseline: "${m.fragment}"`);
    // Every delta leaf the sweep does not skip as hand-written (the goldSet reference) must have been
    // met at its pointer with its value: appended phrases, and every field's `to` strings (heard /
    // carry / yieldTo / anchor / carryExclude, carryRefuse, normalize, version).
    let leafSkipped = 0;
    for (const [p, s] of leaves) {
      if (HAND_WRITTEN.some(([re]) => re.test(p))) { leafSkipped++; continue; }
      c.check(met.has(p), `/@provenance/@delta${p}`, { text: s }, "the delta leaf at its pointer, with its value", "not met in the shipped rubric");
    }
    let leaf033Skipped = 0;
    for (const [p, s] of leaves033) {
      if (HAND_WRITTEN.some(([re]) => re.test(p))) { leaf033Skipped++; continue; }
      c.check(met033.has(p), `/@provenance/@delta033${p}`, { text: s }, "the 0.3.3 delta leaf at its pointer, with its value", "not met in the shipped rubric");
    }
    c.check(!delta033Landed || leaves033.size > 0, "/@provenance/@delta033", null, "the 0.3.3 delta's leaves", "none");
    for (const [p, s] of esLeaves) c.check(esMet.has(p), `/@provenance/@localeDelta${p}`, { text: s }, "the locale-delta leaf at its pointer, with its value", "not met in the shipped rubric");
    c.check(!esLanded || esLeaves.size > 0, "/@provenance/@localeDelta", null, "the locale delta's Spanish leaves", "none");
    // Every EMR-delta leaf must have been met at its pointer with its value (none goes unused).
    for (const [p, s] of emrLeaves) c.check(emrMet.has(p), `/@provenance/@emrDelta${p}`, { text: s }, "the EMR-delta leaf at its pointer, with its value", "not met in the shipped rubric");
    c.check(emrLeaves.size > 0, "/@provenance/@emrDelta", null, "the EMR delta's leaves", "none");
    // Every referral-delta leaf must have been met at its pointer with its value (none goes unused).
    for (const [p, s] of refLeaves) c.check(refMet.has(p), `/@provenance/@referralDelta${p}`, { text: s }, "the referral-delta leaf at its pointer, with its value", "not met in the shipped rubric");
    c.check(refLeaves.size > 0, "/@provenance/@referralDelta", null, "the referral delta's leaves", "none");
    // Every EMR-decisions leaf must have been met at its pointer with its value (none goes unused).
    for (const [p, s] of decLeaves) c.check(decMet.has(p), `/@provenance/@emrDecisionsDelta${p}`, { text: s }, "the EMR-decisions leaf at its pointer, with its value", "not met in the shipped rubric");
    c.check(decLeaves.size > 0, "/@provenance/@emrDecisionsDelta", null, "the EMR decisions delta's leaves", "none");
    // Every question leaf must have been met at its pointer with its value (none goes unused).
    for (const [pp, s] of qLeaves) c.check(qMet.has(pp), `/@provenance/@questionDelta${pp}`, { text: s }, "the question-delta leaf at its pointer, with its value", "not met in the shipped rubric");
    c.check(qLeaves.size > 0, "/@provenance/@questionDelta", null, "the question delta's leaves", "none");
    // Every plan-line leaf must have been met at its pointer with its value (none goes unused).
    for (const [pp, s] of planLeaves) c.check(planMet.has(pp), `/@provenance/@emrPlanDelta${pp}`, { text: s }, "the plan-delta leaf at its pointer, with its value", "not met in the shipped rubric");
    c.check(planLeaves.size > 0, "/@provenance/@emrPlanDelta", null, "the plan delta's leaves", "none");
    // The module CHANGELOG quotes every rubric change-log entry verbatim, once (release 0.4.7 review round
    // 3: the 0.4.7 records had replaced the quote of the approved 0.3.2 entry with the 0.4.7 one).
    {
      let md = null;
      try { md = await h.fetchText("modules/masque/CHANGELOG.md"); } catch (err) { c.check(false, "/changelog/@CHANGELOG.md", null, "readable", String(err && err.message)); }
      if (md !== null) {
        (Array.isArray(R.changelog) ? R.changelog : []).forEach((e, i) => {
          const paths = Array.isArray(e.paths) && e.paths.length ? ` (${e.paths.map((q) => "`" + q + "`").join(", ")})` : "";
          const n = md.split(`- **${e.kind}**${paths}: ${e.note}`).length - 1;
          c.check(n === 1, `/changelog/${i}/quoted-in-CHANGELOG.md`, { kind: e.kind, date: e.date }, "quoted verbatim, once", `${n} times`);
        });
      }
    }
    // Release 0.4.7, the records fixes after the sign-off: once the lead's sign-off is recorded
    // (LEXICON_DELTA_033.signOff), no deployed record or source comment may still say the 0.4.7 rows
    // await it, or keep the D9-superseded claims; and the README must not keep "+/-" (a hedge row,
    // read in every line since D9) to typed text. Each detector is first shown to catch the
    // statement it guards against, verbatim as it shipped before the fix.
    {
      const STALE_047 = [
        [/draft rows await/i, "its draft rows await the clinical\nlead's sign-off"],
        [/\(awaiting the (?:clinical )?lead's sign-off\)/i, "Its note marks the draft rows (awaiting the lead's sign-off)"],
        [/for the lead's\s+(?:\/\/\s*)?approval/i, "draft wording, generic, for the lead's\n// approval with the 0.4.7 sign-off list"],
        [/\bit is not deployed\b/i, "and it is not deployed; see the 0.4.7 entry"],
        [/supersedes nothing/i, "stands and gold set 0.4.0 supersedes nothing"],
      ];
      const PLUS_MINUS_TYPED = /stays? with typed|typed (?:chart )?text only|typed only/i;
      const plusMinusTypedOnly = (md) => md.split(/(?<=[.;])\s+/).filter((s) => s.includes("\"+/-\"") && PLUS_MINUS_TYPED.test(s));
      for (const [re, was] of STALE_047) c.check(re.test(was), "/records/@stale047/detector", { pattern: String(re) }, "catches the pre-fix statement", "misses it");
      c.check(plusMinusTypedOnly("the pronoun exception, the Clarify section and the\n\"+/-\" notation stay with typed text. Typed text sets").length === 1,
        "/records/@stale047/detector", { pattern: "README \"+/-\" typed-only" }, "catches the pre-fix statement", "misses it");
      if (LEXICON_DELTA_033.signOff) {
        for (const file of ["modules/masque/CHANGELOG.md", "modules/masque/README.md", "modules/masque/SOURCES.md", "src/engine/policy.js", "src/apps/Scribe.jsx"]) {
          let text = null;
          try { text = await h.fetchText(file); } catch (err) { c.check(false, `/records/${file}`, null, "readable", String(err && err.message)); }
          if (text === null) continue;
          for (const [re] of STALE_047) {
            const m = text.match(re);
            c.check(!m, `/records/${file}/@stale047`, { pattern: String(re) }, "no statement that the 0.4.7 rows await the sign-off (signed off 2026-10-12)", m && m[0]);
          }
          if (file.endsWith("README.md")) {
            const bad = plusMinusTypedOnly(text);
            c.check(bad.length === 0, `/records/${file}/@plusMinus`, null, "\"+/-\" not kept to typed text (a hedge in every line since D9)", bad[0]);
          }
        }
      }
    }
    // Release 0.4.8, final review: the latest release entry of the module CHANGELOG quotes the shipped
    // rubric's hashes. The 0.4.8 records had quoted a contentHash (58745f31…) that the rubric never had:
    // the extractor's, taken before the calibration's scoringHash was stored. Every "`<name>` `<hex>…`" or
    // "`<name>` (`<hex>…`)" in that entry must begin the shipped rubric's value of that hash.
    {
      const QUOTE_RE = /`(contentHash|instrumentHash|scoringHash|lexiconHash)`\s+\(?`([0-9a-f]{8,64})…?`/g;
      const quotes = (text) => [...text.matchAll(QUOTE_RE)].map((x) => [x[1], x[2]]);
      const was = "`contentHash` (`58745f31…`) and the rubric's bytes change; `contentHash` `58745f31…`.";
      const hsR = await hash.rubricHashes(R);
      c.check(JSON.stringify(quotes(was)) === JSON.stringify([["contentHash", "58745f31"], ["contentHash", "58745f31"]]) && !hsR.contentHash.startsWith("58745f31"),
        "/records/@hashes/detector", null, "reads both quote forms and rejects the pre-fix contentHash 58745f31…", quotes(was));
      let md = null;
      try { md = await h.fetchText("modules/masque/CHANGELOG.md"); } catch (err) { c.check(false, "/records/CHANGELOG.md/@hashes", null, "readable", String(err && err.message)); }
      if (md !== null) {
        const lines = md.split("\n");
        const head = lines.findIndex((l) => l.startsWith("## ") && l.includes(`release ${policy.APP_VERSION}`));
        const next = lines.findIndex((l, i) => i > head && l.startsWith("## "));
        const q = head < 0 ? [] : quotes(lines.slice(head, next < 0 ? lines.length : next).join("\n"));
        c.check(head >= 0 && q.some(([k]) => k === "contentHash"), "/records/CHANGELOG.md/@hashes", { release: policy.APP_VERSION }, "the latest release entry quotes the rubric's contentHash", q);
        for (const [k, hex] of q) c.check(typeof hsR[k] === "string" && hsR[k].startsWith(hex), `/records/CHANGELOG.md/@hashes/${k}`, { quoted: hex }, hsR[k], hex);
      }
    }
    c.n += swept;
    c.note(`provenance sweep: ${swept} rubric/logic strings checked against the baseline sources; ${missing.length} not found; ${exempted} of ${leaves.size} lexicon-delta leaves exempted (pointer and value matched; ${leafSkipped} under hand-written paths); ${ex033} of ${leaves033.size} lexicon-delta-033 leaves exempted (pointer and value matched; ${leaf033Skipped} under hand-written paths); ${esExempted} of ${esLeaves.size} locale-delta leaves exempted (pointer and value matched); ${emrExempted} of ${emrLeaves.size} EMR-delta leaves exempted (pointer and value matched); ${refExempted} of ${refLeaves.size} referral-delta leaves exempted (pointer and value matched); ${decExempted} of ${decLeaves.size} EMR-decisions leaves exempted (pointer and value matched); ${qExempted} of ${qLeaves.size} question-delta leaves exempted (pointer and value matched); ${planExempted} of ${planLeaves.size} plan-delta leaves exempted (pointer and value matched)`);
    return c.result();
  }),
};
