import React, { useState, useMemo, useEffect } from "react";
import {
  Stethoscope, Activity, ArrowRight, ArrowLeft, RotateCcw, ShieldCheck,
  TriangleAlert, ChevronDown, Copy, Check, Send, User, FileJson, Info, Plus, Download
} from "lucide-react";
import ResearchReadinessPanel from "./ResearchReadinessPanel.jsx";

/*  Project MASQUE — clinical screening prototype
    Migraine And Sensory-neuropathy Quantification in Underdiagnosed ENT presentations
    -------------------------------------------------------------------------------
    A SMART on FHIR-style decision-support app. It screens patients with recalcitrant
    sinonasal / otologic symptoms for a masked migrainous or neuropathic driver, then
    routes to the licensed confirmatory instruments and (optionally) a referral.

    Honesty notes intentionally surfaced in the UI:
      • Screening aid, not a diagnosis.
      • The item set below is authored for this prototype; it is NOT the validated
        instruments (VM-PATHI, SNOT-22, DHI, HIT-6, ID Migraine), which are named as
        the confirmatory step and administered under their own licenses.
      • The weighted model is interpretable and illustrative, pending validation on
        the open-data sources named in the Project MASQUE proposal §6 (NHANES, NHIS,
        MEPS, CMS PUF, HCUPnet, openFDA, CDC WONDER/BRFSS, All of Us). Bridge2AI-Voice
        belongs to VOICED and is not a MASQUE source.
      • No PHI leaves the browser; a real deployment extracts features at the edge and
        writes structured results back via FHIR.
*/

// ----------------------------- model config -----------------------------------

/*  Two version numbers, deliberately distinct — this is not drift.

    INSTRUMENT_VERSION identifies the item set: the 21 questions, their wording, and
    their weights. It is what the FHIR Questionnaire canonical URL points at. It has
    NOT moved, because no item has been added, removed, or reweighted. Bumping it
    without changing an item would break comparability with responses already
    recorded against it.

    APP_VERSION identifies this build's scoring interpretation, routing, and safety
    logic. It HAS moved: an incomplete screen can now withhold a band, a red flag can
    now suppress a referral, and the ingestion layer no longer imputes absent values.
    Those change what the same answers produce, so the app version must say so.

    Every version string in this file derives from one of these two.
*/
const INSTRUMENT_VERSION = "0.2";   // v0.2: ICHD/Bárány-compatible items + rule-out discriminators
const APP_VERSION = "0.3.0";

/*  Pseudonymisation for the pilot cohort.

    Everything longitudinal in §8 — test-retest, responsiveness, MCID validation —
    needs two screens linked to one person. Everything in §11 says no unauthorised
    PII leaves the browser. Those are reconcilable only through a pseudonym: a
    one-way, site-local hash of the medical record number that is stable across
    sessions but carries nothing back to the patient.

    The salt MUST be replaced per site and kept with the site's other study secrets.
    An unchanged salt makes the pseudonym reversible by anyone holding this source
    and a list of MRNs, so the export UI refuses to pretend otherwise and labels the
    rows unpseudonymised until it is set.

    This is a prototype-grade construction. A real deployment should use a keyed
    hash (HMAC-SHA-256) via SubtleCrypto and hold the key in the site's secret
    store, not in a source file — the interface here is the same shape, so that is
    a substitution rather than a redesign.
*/
const SITE_SALT = "CHANGE-ME-PER-SITE";
const SALT_IS_DEFAULT = SITE_SALT === "CHANGE-ME-PER-SITE";

function subjectPseudonym(mrn) {
  if (!mrn) return "";
  const input = `${SITE_SALT}::${String(mrn).trim().toUpperCase()}`;
  // FNV-1a over two offsets for a wider output. Not cryptographic — see above.
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= input.charCodeAt(input.length - 1 - i); h2 = Math.imul(h2, 0x811c9dc5) >>> 0;
  }
  return "s-" + h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
const QUESTIONNAIRE_URL = `http://masque.example/Questionnaire/masque-screener-v${INSTRUMENT_VERSION}`;

const STEPS = [
  { key: "safety", title: "Safety check", eyebrow: "00" },
  { key: "intake", title: "Intake & recalcitrance", eyebrow: "01" },
  { key: "migraine", title: "Migrainous features", eyebrow: "02" },
  { key: "vestibular", title: "Otologic / vestibular", eyebrow: "03" },
  { key: "neuro", title: "Neuropathic overlay", eyebrow: "04" },
  { key: "impact", title: "Impact & context", eyebrow: "05" },
  { key: "discriminators", title: "Rule-out findings", eyebrow: "06" },
  { key: "result", title: "Screen result", eyebrow: "07" },
];
const LAST_STEP = STEPS.length - 1;

/*  Red flags — the safety gate that runs BEFORE any screening.

    MASQUE's whole premise is that a recalcitrant ENT picture is often a migraine
    or neuropathy hiding in plain sight. That premise is dangerous in exactly one
    direction: the same complaints are also the presenting picture of a vestibular
    schwannoma, a subarachnoid haemorrhage, giant cell arteritis, an invasive
    sinonasal process, or raised intracranial pressure. A screen that says
    "consider vestibular migraine" over any of those is worse than no screen.

    So these are not scored, weighted, or traded off against the index. Any one of
    them overrides the screen outright: no band-based routing, no CDS prompt, no
    referral to headache medicine, until it is addressed.

    tier: "emergent" — same-day / emergency evaluation
          "urgent"   — expedited, days not weeks; do not defer behind ENT follow-up
*/
const RED_FLAGS = [
  { id: "rf_thunderclap", tier: "emergent", group: "Neurologic",
    text: "Headache that reached maximum intensity within seconds to a minute",
    points: "Subarachnoid haemorrhage / vascular event", action: "Emergency imaging today" },
  { id: "rf_focal", tier: "emergent", group: "Neurologic",
    text: "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision",
    points: "Central or cranial-nerve lesion", action: "Emergency neurologic evaluation" },
  { id: "rf_vision", tier: "emergent", group: "Neurologic",
    text: "Progressive vision loss, transient visual obscurations, or known papilloedema",
    points: "Raised intracranial pressure / IIH", action: "Same-day fundoscopy and neuro-imaging" },
  { id: "rf_gca", tier: "emergent", group: "Systemic",
    text: "Age over 50 with scalp tenderness, jaw claudication, or visual symptoms",
    points: "Giant cell arteritis", action: "Same-day ESR/CRP and rheumatology — do not wait for biopsy" },
  { id: "rf_orbital", tier: "emergent", group: "Systemic",
    text: "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement",
    points: "Orbital complication of sinusitis / invasive fungal disease", action: "Emergency ENT and imaging" },
  { id: "rf_ssnhl", tier: "emergent", group: "Otologic",
    text: "Hearing dropped suddenly, over hours to a day, within the last 30 days",
    points: "Sudden sensorineural hearing loss — a closing steroid window", action: "Same-day audiogram" },
  { id: "rf_asym", tier: "urgent", group: "Otologic",
    text: "Hearing loss or tinnitus consistently in one ear only",
    points: "Retrocochlear lesion / vestibular schwannoma", action: "MRI internal auditory canals" },
  { id: "rf_pulsatile", tier: "urgent", group: "Otologic",
    text: "Tinnitus that pulses in time with the heartbeat",
    points: "Vascular lesion, dural AV fistula, or raised ICP", action: "Vascular imaging" },
  { id: "rf_progressive", tier: "urgent", group: "Neurologic",
    text: "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat",
    points: "Raised intracranial pressure / mass lesion", action: "Neuro-imaging" },
  { id: "rf_new50", tier: "urgent", group: "Neurologic",
    text: "First-ever severe headache beginning after age 50",
    points: "Secondary headache until proven otherwise", action: "Neuro-imaging and inflammatory markers" },
  { id: "rf_mass", tier: "urgent", group: "Sinonasal",
    text: "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness",
    points: "Sinonasal or skull-base malignancy", action: "Endoscopy and cross-sectional imaging" },
  { id: "rf_systemic", tier: "urgent", group: "Systemic",
    text: "Fever, night sweats, unintended weight loss, immunosuppression, or known malignancy",
    points: "Infection, inflammatory disease, or metastatic disease", action: "Directed workup before symptomatic management" },
];
const RF_BY_ID = Object.fromEntries(RED_FLAGS.map(f => [f.id, f]));
const RF_GROUPS = [...new Set(RED_FLAGS.map(f => f.group))];

// scored items grouped by domain. weights within a domain sum to the domain max;
// domain maxima sum to 100 → the raw MASQUE index is already 0–100.
/*  Item set v0.2 — aligned to the criteria the proposal names as anchor labels.

    Two structural changes from v0.1, both from the conformance audit:

    1. ICHD-3 and Barany criteria are now expressible. v0.1 could not be crosswalked
       to them: "minutes to hours" excluded Barany's 5-minute floor and 72-hour
       ceiling, and there was no episode-count item and no attack-duration item.
       Since proposal 7.2 generates its training labels from those criteria, the
       old item set could not have supported the modeling plan.

    2. Discriminators carry NEGATIVE weight. Every v0.1 item added points, so the
       screen could only accumulate evidence for its own hypothesis — and that
       inflation lands hardest on the group with the highest base rate of these
       complaints, which is the opposite of the equity goal. Proposal 5 assigns
       SNOT-22 the job of separating true sinus disease from migrainous facial
       pressure; nothing in v0.1 implemented it.

    Positive domains still sum to 100. Discriminators subtract up to 29.
*/
const ITEMS = {
  recalcitrance: {
    label: "Recalcitrance",
    max: 15,
    items: [
      { id: "r_dur", w: 3, text: "Symptoms have persisted or recurred for more than 3 months" },
      { id: "r_abx", w: 3, text: "Two or more antibiotic or steroid courses without lasting relief" },
      { id: "r_surg", w: 3, text: "Prior sinus procedure or surgery without resolution of symptoms" },
      { id: "r_lesion", w: 3, text: "Recurrent dizziness / aural symptoms without a diagnosed structural or vestibular lesion" },
      { id: "r_normal", w: 3, text: "Exam or imaging is normal or minimal relative to symptom burden" },
    ],
  },
  migraine: {
    label: "Migrainous",
    max: 30,
    items: [
      { id: "m_head", w: 6, text: "Recurrent headache or mid-facial pressure / pain episodes", scale: [
        { label: "None", f: 0 }, { label: "Occasional", f: 0.5 }, { label: "Frequent", f: 1 }] },
      // ICHD-3 1.1 criterion B — untreated attack duration.
      { id: "m_dur", w: 4, text: "Untreated attacks typically last between 4 and 72 hours", scale: [
        { label: "No attacks", f: 0 }, { label: "Under 4 h", f: 0.2 }, { label: "4–72 h", f: 1 },
        { label: "Over 72 h", f: 0.2 }, { label: "Varies", f: 0.5 }], ref: "ICHD-3 1.1 criterion B" },
      { id: "m_photo", w: 4, text: "Light and/or sound sensitivity during episodes" },
      { id: "m_nausea", w: 4, text: "Nausea accompanies the episodes" },
      { id: "m_disable", w: 3, text: "Episodes limit normal activity" },
      { id: "m_aura", w: 3, text: "Visual aura or transient neurologic symptoms" },
      { id: "m_trig", w: 3, text: "Clear triggers — weather / pressure change, sleep, skipped meals, hormonal" },
      { id: "m_fhx", w: 3, text: "Personal or family history of migraine" },
    ],
  },
  vestibular: {
    label: "Otologic / vestibular",
    max: 25,
    items: [
      // Barany vestibular migraine criterion B — 5 minutes to 72 hours.
      { id: "v_vertigo", w: 6, text: "Episodic vertigo or imbalance — how long does an episode last?", scale: [
        { label: "None", f: 0 }, { label: "Under 5 min", f: 0.2 }, { label: "5 min – 72 h", f: 1 }, { label: "Over 72 h", f: 0.2 }], ref: "Bárány VM criterion B" },
      // Barany criterion A — at least 5 episodes.
      { id: "v_count", w: 4, text: "At least five separate vestibular episodes to date", ref: "Bárány VM criterion A" },
      // Barany criterion C — migrainous features in at least half of episodes.
      { id: "v_migfeat", w: 4, text: "At least half of the episodes carry headache, light/sound sensitivity, or visual aura", ref: "Bárány VM criterion C" },
      { id: "v_motion", w: 4, text: "Motion or visual-motion sensitivity (busy patterns, scrolling, driving)" },
      { id: "v_aural", w: 4, text: "Fluctuating aural fullness or tinnitus tied to the episodes" },
      { id: "v_head", w: 3, text: "Head-motion or positional intolerance" },
    ],
  },
  neuro: {
    label: "Neuropathic",
    max: 15,
    items: [
      { id: "n_burn", w: 4, text: "Burning, tingling, or shooting facial / oral / throat sensations" },
      // Cranial neuralgiform pain with a normal ear — proposal 3.1, phenotype 4.
      { id: "n_otalgia", w: 3, text: "Deep ear or throat pain with a normal ear examination" },
      // Autonomic domain — the cue that routes to COMPASS-31.
      { id: "n_auto", w: 3, text: "Autonomic symptoms — dry eyes or mouth, lightheadedness on standing, sweating or GI changes" },
      { id: "n_viral", w: 3, text: "Symptoms began after a viral illness" },
      { id: "n_allo", w: 2, text: "Sensitivity out of proportion to exam findings" },
    ],
  },
  impact: {
    label: "Impact",
    max: 15,
    items: [
      { id: "i_days", w: 8, text: "Days per month affected", scale: [
        { label: "0", f: 0 }, { label: "1–3", f: 0.33 }, { label: "4–9", f: 0.66 }, { label: "10+", f: 1 }] },
      { id: "i_role", w: 7, text: "Impact on work or daily roles", scale: [
        { label: "None", f: 0 }, { label: "Mild", f: 0.33 }, { label: "Moderate", f: 0.66 }, { label: "Severe", f: 1 }] },
    ],
  },
  discriminators: {
    label: "Discriminators (rule-out)",
    max: -29,
    negative: true,
    items: [
      { id: "x_purulent", w: -8, text: "Purulent drainage or a positive sinus culture documented during symptomatic episodes" },
      { id: "x_objective", w: -8, text: "Objective sinus inflammation on endoscopy or CT during a symptomatic period (e.g. Lund-Mackay ≥ 4)" },
      // Documented fluctuating low-frequency SNHL is the Meniere discriminator, not
      // a cochlear-migraine feature. Subjective fullness stays positive (v_aural);
      // an audiogram that moves points somewhere else.
      { id: "x_lowfreq", w: -8, text: "Audiometry documents low-frequency sensorineural loss that fluctuates with episodes" },
      { id: "x_anosmia", w: -5, text: "Persistent reduction or loss of smell that continues between episodes" },
    ],
  },
};

const DOMAIN_ORDER = ["recalcitrance", "migraine", "vestibular", "neuro", "impact", "discriminators"];
const ALL_ITEM_IDS = DOMAIN_ORDER.flatMap(k => ITEMS[k].items.map(it => it.id));

// sample cases for instant demo
const SAMPLE_CASES = {
  sinonasal: {
    label: "Recalcitrant facial pressure",
    complaint: "sinonasal",
    ctx: { c_clin: "3+", c_dur: ">12mo", c_dismiss: "yes" },
    a: { r_dur: "yes", r_abx: "yes", r_surg: "yes", r_normal: "yes", r_lesion: "no",
      m_head: 2, m_dur: 2, m_photo: "yes", m_nausea: "yes", m_disable: "yes", m_aura: "no", m_trig: "yes", m_fhx: "yes",
      v_vertigo: 0, v_count: "no", v_migfeat: "no", v_motion: "yes", v_aural: "no", v_head: "no",
      n_burn: "no", n_otalgia: "no", n_auto: "no", n_viral: "no", n_allo: "yes",
      i_days: 2, i_role: 2,
      x_purulent: "no", x_objective: "no", x_lowfreq: "no", x_anosmia: "no" },
  },
  otologic: {
    label: "Recurrent dizziness, normal workup",
    complaint: "otologic",
    ctx: { c_clin: "3+", c_dur: ">12mo", c_dismiss: "yes" },
    a: { r_dur: "yes", r_abx: "no", r_surg: "no", r_lesion: "yes", r_normal: "yes",
      m_head: 1, m_dur: 2, m_photo: "yes", m_nausea: "yes", m_disable: "yes", m_aura: "no", m_trig: "yes", m_fhx: "yes",
      v_vertigo: 2, v_count: "yes", v_migfeat: "yes", v_motion: "yes", v_aural: "yes", v_head: "yes",
      n_burn: "no", n_otalgia: "no", n_auto: "no", n_viral: "no", n_allo: "no",
      i_days: 3, i_role: 3,
      x_purulent: "no", x_objective: "no", x_lowfreq: "no", x_anosmia: "no" },
  },
  // Same migrainous picture as above, but one-sided aural findings. Without the
  // safety gate this scores high and routes to "consider vestibular migraine".
  redflag: {
    label: "High index, one-sided aural findings",
    complaint: "otologic",
    ctx: { c_clin: "3+", c_dur: ">12mo", c_dismiss: "yes" },
    rf: { rf_asym: true },
    a: { r_dur: "yes", r_abx: "no", r_surg: "no", r_lesion: "yes", r_normal: "yes",
      m_head: 1, m_dur: 2, m_photo: "yes", m_nausea: "yes", m_disable: "yes", m_aura: "no", m_trig: "yes", m_fhx: "yes",
      v_vertigo: 2, v_count: "yes", v_migfeat: "yes", v_motion: "yes", v_aural: "yes", v_head: "yes",
      n_burn: "no", n_otalgia: "no", n_auto: "no", n_viral: "no", n_allo: "no",
      i_days: 3, i_role: 3,
      x_purulent: "no", x_objective: "no", x_lowfreq: "no", x_anosmia: "no" },
  },
  // The case v0.1 could not represent: a strong migrainous picture with objective
  // sinus disease documented alongside it. Under v0.1 this scored identically to
  // the sinonasal case above, because nothing could argue against the hypothesis.
  competing: {
    label: "Migrainous features WITH objective sinus disease",
    complaint: "sinonasal",
    ctx: { c_clin: "3+", c_dur: ">12mo", c_dismiss: "no" },
    a: { r_dur: "yes", r_abx: "yes", r_surg: "yes", r_normal: "no", r_lesion: "no",
      m_head: 2, m_dur: 2, m_photo: "yes", m_nausea: "yes", m_disable: "yes", m_aura: "no", m_trig: "yes", m_fhx: "yes",
      v_vertigo: 0, v_count: "no", v_migfeat: "no", v_motion: "yes", v_aural: "no", v_head: "no",
      n_burn: "no", n_otalgia: "no", n_auto: "no", n_viral: "no", n_allo: "no",
      i_days: 2, i_role: 2,
      x_purulent: "yes", x_objective: "yes", x_lowfreq: "no", x_anosmia: "yes" },
  },
};

const DEMO_PATIENT = {
  id: "masque-demo-1042", given: "Dana", family: "Herrera", sex: "female", gender: "woman",
  age: 41, mrn: "SANDBOX-77-2210", synthetic: true,   // no DOB: an age plus a birth date is a date of birth
};

// ----------------------------- scoring ----------------------------------------

function scoreItem(item, val) {
  if (item.scale) {
    if (typeof val !== "number") return 0;
    return item.w * (item.scale[val]?.f ?? 0);
  }
  return val === "yes" ? item.w : 0;
}

// Band cutpoints. The answered items bound the index; the unanswered ones define
// how far it could still move in either direction (see itemBounds below). If that
// range straddles a cutpoint the screen has not determined a band and MUST NOT
// report one — least of all "low", which is a rule-out the data does not support.
// An unfinished screen is not a negative screen.
const BAND_CUTS = { moderate: 34, high: 67 };

function bandFor(v) {
  if (v >= BAND_CUTS.high) return "high";
  if (v >= BAND_CUTS.moderate) return "moderate";
  return "low";
}

/*  Attainable range with two-sided items.

    Fix #1 relied on every item only ever ADDING points, so unanswered items could
    only raise the index and the floor was simply the current total. The v0.2
    discriminators subtract, which breaks that invariant: an unanswered rule-out can
    now pull the index DOWN as well.

    So each unanswered item contributes its best case to the ceiling and its worst
    case to the floor, and a band is issued only when the whole range lands in one
    band. With no negative items the negative headroom is zero and this reduces
    exactly to the previous behaviour.

    The clinically important consequence: a high index can no longer be issued while
    the discriminators are unanswered. "High likelihood of masked migraine" without
    having asked whether there is objective sinus disease was never a finding — it
    was an assumption. Affirmative evidence still resolves early within a domain;
    it just no longer outruns the rule-outs.
*/
function itemBounds(item) {
  if (item.scale) {
    const fs = item.scale.map(s => s.f);
    const a = item.w * Math.min(...fs), b = item.w * Math.max(...fs);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return item.w >= 0 ? { min: 0, max: item.w } : { min: item.w, max: 0 };
}

function useScore(answers) {
  return useMemo(() => {
    const domains = {};
    let total = 0, posHead = 0, negHead = 0, answered = 0, count = 0;
    const open = [];
    for (const key of DOMAIN_ORDER) {
      const d = ITEMS[key];
      let sum = 0, dOpen = 0;
      for (const it of d.items) {
        count++;
        if (answers[it.id] === undefined) {
          const b = itemBounds(it);
          posHead += b.max; negHead += -b.min; dOpen += Math.abs(it.w);
          open.push({ ...it, domain: key, domainLabel: d.label });
        } else {
          answered++;
          sum += scoreItem(it, answers[it.id]);
        }
      }
      sum = Math.round(sum * 10) / 10;
      domains[key] = {
        pts: sum, max: d.max, pct: Math.round((sum / d.max) * 100),
        label: d.label, openPts: dOpen, negative: !!d.negative,
      };
      total += sum;
    }
    total = Math.max(0, Math.min(100, Math.round(total)));
    const ceiling = Math.max(total, Math.min(100, Math.round(total + posHead)));
    const floor   = Math.min(total, Math.max(0,   Math.round(total - negHead)));
    const coverage = count ? Math.round((answered / count) * 100) : 0;

    const scorable = bandFor(floor) === bandFor(ceiling);

    return {
      domains, total, floor, ceiling, coverage, scorable, answered, count,
      band: scorable ? bandFor(total) : "indeterminate",
      open: open.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)),
    };
  }, [answers]);
}

// ----------------------------- published artifacts ----------------------------
/*  Proposal §7.3 promises "an open-source screener and risk calculator (web tool +
    FHIR-deployable specification for EHR integration)" and "a methods repository
    (code, data dictionaries, model cards)".

    v0.2 shipped a QuestionnaireResponse that pointed at a Questionnaire URL which
    resolved to nothing, and a CDS Hooks "card" that was a styled div. The word
    deployable was doing work no artifact backed up. These builders emit the real
    resources, generated from the same ITEMS the app scores with — so they cannot
    drift from the running instrument the way a hand-maintained spec would.
*/
const ANSWER_SYSTEM = "http://masque.example/answer";
const WEIGHT_EXT = "http://masque.example/StructureDefinition/item-weight";

function buildQuestionnaire() {
  return {
    resourceType: "Questionnaire",
    url: QUESTIONNAIRE_URL,
    version: INSTRUMENT_VERSION,
    name: "MASQUEScreener",
    title: "MASQUE — screen for a masked migrainous or neuropathic driver in recalcitrant ENT presentations",
    status: "draft",
    experimental: true,
    date: new Date().toISOString().slice(0, 10),
    publisher: "Project MASQUE — TOPx prototype",
    description:
      "Authored screening item set. NOT a validated instrument: the confirmatory instruments named in the " +
      "recommendations (VM-PATHI, SNOT-22, DHI, HIT-6, MIDAS, ID Migraine, THI/TFI, SFN-SIQ, COMPASS-31) are " +
      "administered separately under their own licenses. Item weights are illustrative pending validation.",
    subjectType: ["Patient"],
    item: [
      {
        linkId: "safety",
        text: "Red flags — evaluated before screening; not scored",
        type: "group",
        item: RED_FLAGS.map(f => ({
          linkId: f.id, text: f.text, type: "boolean",
          code: [{ system: "http://masque.example/codes", code: f.id, display: f.points }],
        })),
      },
      ...DOMAIN_ORDER.map(k => ({
        linkId: k,
        text: ITEMS[k].label,
        type: "group",
        item: ITEMS[k].items.map(it => ({
          linkId: it.id,
          text: it.text,
          type: it.scale ? "choice" : "boolean",
          ...(it.scale
            ? { answerOption: it.scale.map((s, i) => ({
                valueCoding: { system: ANSWER_SYSTEM, code: String(i), display: s.label },
                ...(s.f === Math.max(...it.scale.map(x => x.f)) ? { initialSelected: false } : {}),
              })) }
            : {}),
          // The scoring weight travels with the item so an implementer cannot
          // reimplement the index from the item text and get a different number.
          extension: [{ url: WEIGHT_EXT, valueDecimal: it.w }],
          ...(it.ref ? { code: [{ system: "http://masque.example/criteria", code: it.ref, display: it.ref }] } : {}),
        })),
      })),
    ],
  };
}

function buildCdsHooks() {
  return {
    discovery: {
      services: [{
        hook: "order-select",
        id: "masque-screen",
        title: "MASQUE — masked migrainous / neuropathic driver screen",
        description:
          "Fires when a repeat sinus or vestibular order is selected for a patient with a recalcitrant ENT " +
          "course. Surfaces the MASQUE index, or a safety card when a red flag is recorded.",
        prefetch: {
          patient: "Patient/{{context.patientId}}",
          priorScreens: "Observation?patient={{context.patientId}}&code=http://masque.example/codes|masque-index&_sort=-date&_count=1",
          activeFlags: "Flag?patient={{context.patientId}}&status=active",
        },
      }],
    },
    // Three example responses, one per state the app can be in. An implementer can
    // diff these against their own service output.
    exampleResponses: {
      redFlagPresent: {
        cards: [{
          uuid: "masque-safety",
          summary: "Red flag present — do not attribute to migraine before evaluation",
          indicator: "critical",
          detail: "MRI internal auditory canals. The screening index is withheld from routing.",
          source: { label: "Project MASQUE", url: "http://masque.example" },
          suggestions: [],
          selectionBehavior: "any",
        }],
      },
      settledNonLowBand: {
        cards: [{
          uuid: "masque-index",
          summary: "MASQUE index 78/100 — high likelihood of a masked migrainous driver",
          indicator: "warning",
          detail: "Consider vestibular migraine. Administer VM-PATHI and DHI before repeating vestibular testing.",
          source: { label: "Project MASQUE", url: "http://masque.example" },
        }],
      },
      // The state that matters most: no card at all. An incomplete screen must not
      // emit a reassuring card, and an empty cards array is the correct response.
      notScorable: { cards: [] },
    },
  };
}

function buildDataDictionary() {
  const typeOf = it => (it.scale ? `choice (0–${it.scale.length - 1})` : "boolean");
  return {
    instrument: { url: QUESTIONNAIRE_URL, instrumentVersion: INSTRUMENT_VERSION, appVersion: APP_VERSION },
    scoring: {
      positiveMax: 100,
      discriminatorMin: ITEMS.discriminators.max,
      bands: { low: "< 34", moderate: "34–66", high: "≥ 67" },
      rule: "A band is issued only when the attainable range — current total plus the best and worst cases of every unanswered item — falls inside a single band. Unanswered items are never scored as denials.",
    },
    canonicalCohortFields: [
      { name: "score", type: "number 0–100", note: "MASQUE index at time of capture" },
      { name: "label", type: "0 | 1 | empty", note: "Reference standard. EMPTY means no reference standard yet — it is never imputed to 0." },
      { name: "reference_diagnosis", type: "free text | empty", note: "Filled at follow-up; the source for `label`." },
      { name: "subject_id", type: "string", note: "Site-local one-way pseudonym of the MRN, stable across sessions. The key that makes test-retest, responsiveness, and MCID validation possible; without it every screen is an unlinkable cross-section. Never contains or reveals the identifier it was derived from." },
      { name: "visit_label", type: "string", note: "Optional protocol visit name (baseline, 6-week). Order is derived from captured_at, not from this field." },
      { name: "sex", type: "string", note: "Fairness axis. Recorded and audited separately from gender — neither substitutes for the other, and rows missing this field are excluded from sex-stratified results rather than pooled into an unknown group." },
      { name: "gender", type: "string", note: "Fairness axis, independent of sex. Free text rather than a fixed enumeration; small strata are suppressed by the reporting minimum, not dropped." },
      { name: "age", type: "number" },
      { name: "weight", type: "number", note: "Analytic or survey weight; defaults to 1 at computation only" },
      { name: "annual_cost", type: "number USD" },
      { name: "avoidable_cost", type: "number USD" },
      { name: "coverage", type: "number 0–100", note: "Proportion of items answered" },
      { name: "scorable", type: "0 | 1", note: "Whether the attainable range settled into one band" },
      { name: "band", type: "low | moderate | high | indeterminate" },
      { name: "red_flags", type: "pipe-delimited ids", note: "Red flags recorded at the safety step" },
    ],
    items: DOMAIN_ORDER.flatMap(k =>
      ITEMS[k].items.map(it => ({
        id: it.id, domain: k, domainLabel: ITEMS[k].label,
        text: it.text, type: typeOf(it), weight: it.w,
        direction: it.w < 0 ? "reverse — evidence against the hypothesis" : "forward",
        options: it.scale ? it.scale.map((s, i) => ({ code: i, label: s.label, factor: s.f })) : [true, false],
        ...(it.ref ? { criterion: it.ref } : {}),
      }))),
    redFlags: RED_FLAGS.map(f => ({ id: f.id, tier: f.tier, group: f.group, text: f.text, points: f.points, action: f.action, scored: false })),
  };
}

// ----------------------------- pilot cohort capture ---------------------------
/*  Proposal §8's clinician-in-the-loop pilot needs flag rate, agreement, and
    downstream diagnostic change. v0.2 could produce none of them: the app made
    screens, the panel read external files, and nothing connected the two.

    A captured screen is a row in the same canonical schema the panel ingests.
    Two columns are deliberately left EMPTY rather than filled: `label` and
    `reference_diagnosis`. At capture time there is no reference standard — writing
    a 0 there is exactly the fabrication fix #3 removed, and with that fix in place
    an exported cohort correctly reports "validation withheld" until a clinician
    fills the diagnosis in at follow-up. The empty column IS the pilot instrument.
*/
function screenToCohortRow({ patient, answers, total, coverage, scorable, band, activeFlags, complaint, ctx = {} }) {
  const row = {
    screen_id: `masque-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    captured_at: new Date().toISOString(),
    instrument_version: INSTRUMENT_VERSION,
    app_version: APP_VERSION,
    score: total,
    label: "",                    // no reference standard at screening time
    reference_diagnosis: "",      // filled at follow-up — this is the §8 outcome column
    // Sequence is derived at analysis time by sorting a subject's rows on
    // captured_at, so no row has to claim a visit number the app cannot know
    // across sessions.
    subject_id: subjectPseudonym(patient.mrn),
    visit_label: ctx.visit_label ?? "",
    sex: patient.sex ?? "",
    gender: patient.gender ?? "",     // audited as a separate axis; never a fallback for sex
    age: patient.age ?? "",
    weight: "",
    annual_cost: "",
    avoidable_cost: "",
    complaint: complaint ?? "",
    coverage,
    scorable: scorable ? 1 : 0,
    band,
    red_flags: (activeFlags || []).map(f => f.id).join("|"),
  };
  for (const k of DOMAIN_ORDER) {
    for (const it of ITEMS[k].items) {
      const v = answers[it.id];
      // unanswered stays empty, not 0 — same invariant as the ingestion layer
      row[it.id] = v === undefined ? "" : (it.scale ? v : (v === "yes" ? 1 : 0));
    }
  }
  return row;
}

function rowsToCsv(rows) {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = v => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
const downloadJsonFile = (filename, obj) => downloadText(filename, JSON.stringify(obj, null, 2), "application/json");

// ----------------------------- design tokens ----------------------------------

const CSS = `
:root{
  --ink:#0C2B2F; --petrol:#0F5C61; --petrol2:#137A80; --surface:#EDF3F1;
  --panel:#FFFFFF; --line:#D7E1DF; --muted:#5C6E6C;
  --amber:#B26C1F; --amberbg:#F6ECD9; --coral:#B84A33; --coralbg:#F6E1DA;
  --green:#2C7A57; --greenbg:#E0EEE7; --slate:#4F6466;
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
.mq{font-family:var(--sans);color:var(--ink);background:var(--surface);
  min-height:100%;line-height:1.45;-webkit-font-smoothing:antialiased}
.mq-wrap{max-width:960px;margin:0 auto;padding:18px 18px 60px}
.mq h1,.mq h2,.mq h3{margin:0;font-weight:650;letter-spacing:-.01em}
.mq p{margin:0}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}

/* banner */
.banner{background:var(--ink);color:#EAF3F1;border-radius:14px;padding:14px 16px;
  display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.banner .who{display:flex;align-items:center;gap:11px;min-width:0}
.avatar{width:38px;height:38px;border-radius:10px;background:var(--petrol2);
  display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.banner .meta{font-size:12px;color:#9FC1BE;letter-spacing:.02em}
.banner .name{font-size:16px;font-weight:650}
.badge{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;
  padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.28);color:#Bfe0dc;white-space:nowrap}
.spacer{flex:1 1 auto}
.gbtn{font:inherit;font-size:12.5px;cursor:pointer;border-radius:9px;padding:7px 11px;
  border:1px solid rgba(255,255,255,.28);background:transparent;color:#EAF3F1;display:inline-flex;
  align-items:center;gap:6px}
.gbtn:hover{background:rgba(255,255,255,.08)}

/* header row */
.brandrow{display:flex;align-items:center;gap:12px;margin:20px 2px 6px}
.mark{width:34px;height:34px;border-radius:9px;background:var(--petrol);color:#fff;
  display:flex;align-items:center;justify-content:center}
.brandrow .t1{font-size:19px;font-weight:700;letter-spacing:-.02em}
.brandrow .t2{font-size:12.5px;color:var(--muted)}

/* progress */
.rail{display:flex;gap:6px;margin:14px 2px 20px;flex-wrap:wrap}
.rail .seg{flex:1 1 120px;min-width:96px}
.rail .lab{font-family:var(--mono);font-size:10.5px;color:var(--muted);letter-spacing:.04em;
  display:flex;gap:6px;align-items:center;margin-bottom:5px}
.rail .bar{height:4px;border-radius:3px;background:var(--line)}
.rail .bar.on{background:var(--petrol)}
.rail .bar.cur{background:var(--petrol2)}
.rail .seg.cur .lab{color:var(--ink);font-weight:650}

/* card + questions */
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px}
.card + .card{margin-top:14px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--petrol);font-weight:600}
.steptitle{font-size:20px;margin:4px 0 2px}
.stepsub{font-size:13px;color:var(--muted);margin-bottom:6px}
.q{padding:15px 0;border-top:1px solid var(--line)}
.q:first-of-type{border-top:0}
.q .qtext{font-size:14.5px;margin-bottom:10px;font-weight:520}
.opts{display:flex;gap:7px;flex-wrap:wrap}
.opt{font:inherit;font-size:13px;cursor:pointer;border:1px solid var(--line);background:#fff;
  color:var(--ink);border-radius:9px;padding:8px 14px;min-width:58px;text-align:center;transition:.12s}
.opt:hover{border-color:var(--petrol2)}
.opt.sel{background:var(--petrol);border-color:var(--petrol);color:#fff;font-weight:600}
.opt.selno{background:var(--slate);border-color:var(--slate);color:#fff}

/* segmented single-select big */
.pick{display:flex;gap:8px;flex-wrap:wrap}
.pick .p{flex:1 1 150px;border:1px solid var(--line);border-radius:11px;padding:13px 14px;cursor:pointer;background:#fff;transition:.12s}
.pick .p:hover{border-color:var(--petrol2)}
.pick .p.sel{border-color:var(--petrol);background:#F1F7F5;box-shadow:inset 0 0 0 1px var(--petrol)}
.pick .p .ph{font-weight:640;font-size:14px;margin-bottom:2px}
.pick .p .pd{font-size:12px;color:var(--muted)}

/* footer nav */
.nav{display:flex;gap:10px;align-items:center;margin-top:18px}
.btn{font:inherit;font-size:14px;font-weight:600;cursor:pointer;border-radius:10px;padding:11px 18px;
  border:1px solid var(--petrol);background:var(--petrol);color:#fff;display:inline-flex;align-items:center;gap:8px}
.btn:hover{background:var(--petrol2);border-color:var(--petrol2)}
.btn.ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.btn.ghost:hover{border-color:var(--petrol2);background:#fff}
.btn:disabled{opacity:.45;cursor:not-allowed}

/* result readout */
.readout{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end}
.score{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:600;
  font-size:74px;line-height:.9;letter-spacing:-.03em}
.scorecap{font-family:var(--mono);font-size:12px;color:var(--muted);letter-spacing:.06em;margin-bottom:8px}
.pill{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:650;
  padding:7px 13px;border-radius:999px}
.meter{margin:20px 0 6px;position:relative;height:14px;border-radius:8px;overflow:hidden;display:flex}
.meter .z{height:100%}
.meterticks{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10.5px;color:var(--muted);margin-top:6px}
.needle{position:absolute;top:-5px;width:3px;height:24px;background:var(--ink);border-radius:2px;transform:translateX(-1.5px);transition:left .5s cubic-bezier(.2,.7,.2,1)}
.rangeband{position:absolute;top:0;height:100%;border-left:2px solid var(--ink);border-right:2px solid var(--ink);
  background:repeating-linear-gradient(135deg,rgba(12,43,47,.30) 0 4px,rgba(12,43,47,.10) 4px 9px);transition:left .5s ease,width .5s ease}
.scorerange{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:600;
  font-size:50px;line-height:.95;letter-spacing:-.03em}
.scorerange .sep{font-size:32px;color:var(--muted);padding:0 4px}
.openlist{margin-top:14px;border:1px dashed var(--line);border-radius:11px;padding:13px 15px;background:#FAFCFB}
.openlist .oh{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:9px}
.openlist .oi{display:flex;gap:10px;align-items:baseline;font-size:12.5px;padding:3px 0;color:#33474A}
.openlist .ow{font-family:var(--mono);font-size:11px;color:var(--petrol);font-weight:650;flex:0 0 auto}
.openlist .om{font-size:11.5px;color:var(--muted);margin-top:8px}

/* domain bars */
.dbar{display:grid;grid-template-columns:150px 1fr 62px;gap:12px;align-items:center;padding:8px 0}
.dbar .dl{font-size:13px}
.dtrack{height:9px;border-radius:6px;background:var(--line);overflow:hidden}
.dfill{height:100%;border-radius:6px;background:var(--petrol2);transition:width .5s ease}
.dpts{font-family:var(--mono);font-size:12px;text-align:right;color:var(--muted)}

/* rec cards */
.rec{border-left:3px solid var(--petrol);background:#F4F8F7;border-radius:0 11px 11px 0;padding:13px 15px;margin-top:10px}
.rec h4{font-size:13.5px;margin:0 0 4px}
.rec p{font-size:13px;color:#33474A}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
.chip{font-family:var(--mono);font-size:11px;border:1px solid var(--line);background:#fff;border-radius:7px;padding:4px 8px;color:var(--slate)}

.alert{display:flex;gap:12px;background:var(--amberbg);border:1px solid #E4C88E;border-radius:12px;padding:14px 15px;margin-top:6px}
.alert .at{font-size:13.5px;font-weight:660;color:#7A4E12;margin-bottom:2px}
.alert .ap{font-size:12.5px;color:#6B4A18}

/* safety gate + red-flag override */
.rf{border:1px solid var(--line);border-radius:11px;padding:12px 14px;margin-top:8px;background:#fff;display:flex;gap:11px;
  align-items:flex-start;cursor:pointer;transition:.12s}
.rf:hover{border-color:#C98476}
.rf.on{border-color:var(--coral);background:#FDF4F1;box-shadow:inset 0 0 0 1px var(--coral)}
.rf .box{width:19px;height:19px;border-radius:5px;border:1.5px solid #B7C4C2;flex:0 0 auto;margin-top:1px;
  display:flex;align-items:center;justify-content:center;background:#fff}
.rf.on .box{background:var(--coral);border-color:var(--coral);color:#fff}
.rf .rt{font-size:13.5px;font-weight:520;line-height:1.35}
.rf .rm{font-size:11.5px;color:var(--muted);margin-top:4px}
.rf .tier{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;
  border-radius:5px;padding:2px 6px;margin-left:7px;vertical-align:1px}
.tier.emergent{background:var(--coralbg);color:#8E3520}
.tier.urgent{background:var(--amberbg);color:#7A4E12}
.rfgroup{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);margin:18px 0 2px}
.override{border:1.5px solid var(--coral);background:var(--coralbg);border-radius:13px;padding:16px 17px;margin-bottom:18px}
.override .ot{font-size:15px;font-weight:700;color:#8E3520;display:flex;gap:9px;align-items:center}
.override .os{font-size:12.5px;color:#6E3020;margin-top:5px}
.override .oitem{background:#fff;border-radius:9px;padding:10px 12px;margin-top:9px;font-size:12.5px}
.override .oitem b{display:block;font-size:13px;margin-bottom:3px}
.override .oact{color:#8E3520;font-weight:600}
.capture{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-top:16px;padding:14px 15px;
  border:1px dashed var(--line);border-radius:12px;background:#FAFCFB}
.capture .ct{font-size:13px;font-weight:660;margin-bottom:3px}
.capture .cp{font-size:12px;color:var(--muted);max-width:52ch;line-height:1.45}
.safetybar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}
.safetybar .sm{font-size:12.5px;color:var(--muted);flex:1 1 200px}

/* fhir */
.code{font-family:var(--mono);font-size:11.5px;line-height:1.5;background:#0C2B2F;color:#CFE6E2;
  border-radius:11px;padding:15px;overflow:auto;max-height:340px;white-space:pre;margin-top:10px}
.code .k{color:#8FD3CC}.code .s{color:#E7C08A}.code .n{color:#F0A992}

.cds{border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:0 11px 11px 0;background:#fff;padding:13px 15px;margin-top:10px}
.cds .src{font-family:var(--mono);font-size:10.5px;color:var(--muted);letter-spacing:.05em;text-transform:uppercase}

.note{font-size:12px;color:var(--muted);display:flex;gap:8px;margin-top:14px;align-items:flex-start}
.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--ink);color:#EAF3F1;
  padding:11px 18px;border-radius:11px;font-size:13.5px;display:flex;gap:9px;align-items:center;z-index:40;
  box-shadow:0 8px 30px rgba(0,0,0,.22)}
.disc{background:#fff;border:1px dashed var(--line);border-radius:11px;padding:12px 14px;font-size:12px;color:var(--muted);margin-top:14px}
.foot{font-family:var(--mono);font-size:10.5px;color:var(--muted);letter-spacing:.04em;text-align:center;margin-top:26px}
.about summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--petrol);display:flex;gap:7px;align-items:center;list-style:none}
.about summary::-webkit-details-marker{display:none}
.about[open] .chev{transform:rotate(180deg)}
.chev{transition:.2s}
.abgrid{font-size:12.5px;color:#33474A;margin-top:10px;display:grid;gap:8px}

:focus-visible{outline:2px solid var(--petrol2);outline-offset:2px;border-radius:6px}
@media (max-width:640px){
  .score{font-size:58px}
  .scorerange{font-size:38px}
  .scorerange .sep{font-size:25px}
  .dbar{grid-template-columns:110px 1fr 52px;gap:9px}
  .readout{gap:14px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

// syntax-light JSON for the code block
function fhirHtml(obj) {
  const j = JSON.stringify(obj, null, 2);
  return j
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="s">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>');
}

// ----------------------------- component --------------------------------------

export default function MasqueScreener() {
  const [step, setStep] = useState(0);
  const [cohort, setCohort] = useState([]);              // captured screens (pilot loop, §8)
  const [rf, setRf] = useState({});                      // red-flag checkboxes
  const [safetyReviewed, setSafetyReviewed] = useState(false);
  const [patient, setPatient] = useState(DEMO_PATIENT);
  const [complaint, setComplaint] = useState("");        // sinonasal | otologic | both
  const [answers, setAnswers] = useState({});
  const [ctx, setCtx] = useState({});                    // c_clin, c_dur, c_dismiss
  const [showJson, setShowJson] = useState(false);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  const { domains, total, floor, ceiling, coverage, scorable, answered, band, open } = useScore(answers);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const set = (id, v) => setAnswers(a => ({ ...a, [id]: a[id] === v ? undefined : v }));
  const setC = (id, v) => setCtx(c => ({ ...c, [id]: c[id] === v ? undefined : v }));

  function loadSample(kind) {
    const s = SAMPLE_CASES[kind];
    setComplaint(s.complaint);
    setAnswers(s.a);
    setCtx(s.ctx);
    setPatient(DEMO_PATIENT);
    setRf(s.rf || {});
    setSafetyReviewed(true);          // sample cases carry an explicit safety review
    setStep(LAST_STEP);
    setToast("Sample case loaded");
  }
  function reset() {
    setAnswers({}); setCtx({}); setComplaint(""); setStep(0); setShowJson(false);
    setRf({}); setSafetyReviewed(false);
    setToast("Screen cleared");
  }

  const bandMeta = {
    low:      { c: "var(--green)",  bg: "var(--greenbg)",  label: "Low likelihood" },
    moderate: { c: "var(--amber)",  bg: "var(--amberbg)",  label: "Moderate likelihood" },
    high:     { c: "var(--coral)",  bg: "var(--coralbg)",  label: "High likelihood" },
    indeterminate: { c: "var(--slate)", bg: "#E3EAE9", label: "Not scorable — screen incomplete" },
  }[band];

  // gap alert: sex-neutral markers of a probable missed diagnosis
  const gapFlags = [
    ctx.c_clin === "3+" && "Seen by 3+ clinicians for this problem",
    ctx.c_dur === ">12mo" && "Symptoms present over 12 months",
    ctx.c_dismiss === "yes" && "Previously attributed to anxiety / stress or “normal”",
  ].filter(Boolean);
  const gapAlert = gapFlags.length >= 2;

  const activeFlags = useMemo(() => RED_FLAGS.filter(f => rf[f.id]), [rf]);
  const override = activeFlags.length > 0;
  const emergent = activeFlags.some(f => f.tier === "emergent");
  // The safety step must be dealt with explicitly — either a flag is checked, or the
  // clinician actively records that none apply. Defaulting to "no red flags" because
  // nobody looked is the failure this gate exists to prevent.
  const safetyDone = safetyReviewed || override;
  const stepKey = STEPS[step].key;
  const canContinue = stepKey === "safety" ? safetyDone : stepKey === "intake" ? !!complaint : true;

  // routing recommendations
  const recs = useMemo(() => {
    const out = [];
    // Safety first, unconditionally. The index still computes and is still shown,
    // but it does not get to propose a destination while a red flag is open.
    if (override) {
      out.push({
        h: `Red flag present — screening routing withheld (${emergent ? "emergent" : "urgent"})`,
        p: "One or more findings need evaluation on their own terms before this presentation is treated as a masked migrainous or neuropathic driver. "
         + "The MASQUE index below is retained for the record but issues no referral, no CDS prompt, and no reassurance while this is open.",
        chips: activeFlags.map(f => f.action),
      });
      return out;
    }
    if (!scorable) {
      out.push({
        h: "Screen incomplete — no result issued",
        p: `The ${answered} answered item${answered === 1 ? "" : "s"} place the index between ${floor} and ${ceiling}/100, which spans more than one band. `
         + `Complete the outstanding items before acting on this screen — an unfinished screen is not a negative screen, and no rule-out is implied.`,
        chips: DOMAIN_ORDER.filter(k => domains[k].openPts > 0)
          .map(k => `${domains[k].label} · ${domains[k].openPts} pts unanswered`),
      });
      return out;
    }
    const strong = band !== "low";
    const sinus = complaint === "sinonasal" || complaint === "both";
    const oto = complaint === "otologic" || complaint === "both";
    if (sinus && strong) out.push({
      h: "Consider mid-facial (“sinus”) migraine",
      p: "The recalcitrant sinonasal picture carries migrainous features. Reassess before further antibiotics, steroids, or sinus surgery.",
      chips: ["SNOT-22  (0–110)", "ID Migraine  (≥2 of 3)", "HIT-6  (≥60 severe)", "MIDAS  (disability grade)"],
    });
    if (oto && (strong || domains.vestibular.pct >= 50)) out.push({
      h: "Consider vestibular migraine",
      p: "Episodic vestibular symptoms without a fixed lesion, with migrainous features. Refer neuro-otology / vestibular therapy.",
      chips: ["VM-PATHI  (25-item, MCID ≥6)", "DHI  (0–100)", "MIDAS  (disability grade)"],
    });
    if (domains.neuro.pct >= 50) out.push({
      h: "Cranial / small-fiber neuropathic overlay",
      p: "Sensory features suggest a neuropathic contribution — consider neurology and small-fiber / autonomic evaluation, particularly if post-viral.",
      chips: ["SFN-SIQ", "COMPASS-31", "Neurology"],
    });
    // Proposal §5 lists a tinnitus instrument to characterise migrainous vs otologic
    // tinnitus. v0.1 scored tinnitus but routed it nowhere.
    if (answers.v_aural === "yes") out.push({
      h: "Characterise the tinnitus before attributing it",
      p: "Tinnitus tied to episodes needs its own baseline — migrainous and otologic tinnitus are managed differently, and neither is assessed by the vestibular instruments above.",
      chips: ["THI  (0–100)", "TFI  (0–100)"],
    });
    // Objective findings pulling the other way. Not a rule-out of migraine — the two
    // coexist — but the screen must not present a masked driver as the whole story.
    if (domains.discriminators.pts < 0) out.push({
      h: "Competing objective findings recorded",
      p: `Rule-out items subtracted ${Math.abs(domains.discriminators.pts)} points. Objective disease is documented alongside the migrainous picture; treat what is demonstrable on its own terms rather than reattributing it.`,
      chips: ITEMS.discriminators.items.filter(it => answers[it.id] === "yes").map(it => it.text.split(/[—(]/)[0].trim().slice(0, 46)),
    });
    if (!out.length) out.push({
      h: "No masked driver flagged on screening",
      p: "Features do not currently suggest an underlying migrainous or neuropathic driver. Continue standard ENT management and re-screen if the course changes.",
      chips: [],
    });
    return out;
  }, [band, complaint, domains, answers, scorable, answered, floor, ceiling, override, emergent, activeFlags]);

  // FHIR write-back bundle (illustrative)
  const bundle = useMemo(
    () => buildBundle({ patient, answers, total, floor, ceiling, coverage, scorable, band, domains, complaint, ctx, recs, activeFlags, emergent }),
    [patient, answers, total, floor, ceiling, coverage, scorable, band, domains, complaint, ctx, recs, activeFlags, emergent]
  );

  function captureScreen() {
    const row = screenToCohortRow({ patient, answers, total, coverage, scorable, band, activeFlags, complaint, ctx });
    setCohort(c => [...c, row]);
    setToast(`Screen appended — ${cohort.length + 1} in session cohort`);
  }
  function downloadCohort() {
    downloadText(`masque-pilot-cohort-${new Date().toISOString().slice(0,10)}.csv`, rowsToCsv(cohort), "text/csv");
  }

  async function copyBundle() {
    try { await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2)); }
    catch (_) {}
    setCopied(true); setToast("FHIR bundle copied");
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mq">
      <style>{CSS}</style>
      <div className="mq-wrap">

        {/* patient banner — SMART on FHIR launch context */}
        <div className="banner">
          <div className="who">
            <div className="avatar"><User size={19} color="#EAF3F1" /></div>
            <div>
              <div className="name">{patient.family}, {patient.given}</div>
              <div className="meta num">
                {patient.age} yr · {patient.sex} · {patient.mrn}{patient.synthetic && " · synthetic sandbox record"}
              </div>
            </div>
          </div>
          <div className="spacer" />
          <span className="badge">SMART on FHIR · sandbox</span>
          <button className="gbtn" onClick={() => loadSample("sinonasal")}><Activity size={14}/> Sample: sinus</button>
          <button className="gbtn" onClick={() => loadSample("otologic")}><Activity size={14}/> Sample: dizziness</button>
          <button className="gbtn" onClick={() => loadSample("redflag")}><TriangleAlert size={14}/> Sample: red flag</button>
          <button className="gbtn" onClick={() => loadSample("competing")}><Activity size={14}/> Sample: competing</button>
          <button className="gbtn" onClick={reset}><RotateCcw size={14}/> Clear</button>
        </div>

        {/* brand */}
        <div className="brandrow">
          <div className="mark"><Stethoscope size={19} /></div>
          <div>
            <div className="t1">MASQUE Screener <span className="num" style={{fontSize:12,color:"var(--muted)",fontWeight:400}}>v{APP_VERSION}</span></div>
            <div className="t2">Migraine &amp; sensory-neuropathy screen for recalcitrant sinonasal / otologic presentations</div>
          </div>
        </div>

        {/* progress rail */}
        <div className="rail">
          {STEPS.map((s, i) => (
            <div className={"seg" + (i === step ? " cur" : "")} key={s.key}>
              <div className="lab"><span>{s.eyebrow}</span>{s.title}</div>
              <div className={"bar" + (i < step ? " on" : i === step ? " cur" : "")} />
            </div>
          ))}
        </div>

        {/* step body */}
        {stepKey === "safety" && (
          <div className="card">
            <div className="eyebrow">00 · Safety</div>
            <h2 className="steptitle">Before screening — red flags</h2>
            <p className="stepsub">
              Tick anything present. These are not scored and are not weighed against the index — any one of them
              stops the screen from routing this patient as a masked migraine or neuropathy.
            </p>
            {RF_GROUPS.map(g => (
              <div key={g}>
                <div className="rfgroup">{g}</div>
                {RED_FLAGS.filter(f => f.group === g).map(f => (
                  <div key={f.id} className={"rf" + (rf[f.id] ? " on" : "")}
                       role="checkbox" aria-checked={!!rf[f.id]} tabIndex={0}
                       onClick={() => setRf(v => ({ ...v, [f.id]: !v[f.id] }))}
                       onKeyDown={e => (e.key === "Enter" || e.key === " ") && setRf(v => ({ ...v, [f.id]: !v[f.id] }))}>
                    <div className="box">{rf[f.id] && <Check size={13} />}</div>
                    <div>
                      <div className="rt">{f.text}<span className={"tier " + f.tier}>{f.tier}</span></div>
                      <div className="rm">{f.points} · {f.action}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div className="safetybar">
              {override
                ? <span className="pill" style={{color:"var(--coral)",background:"var(--coralbg)"}}>
                    <TriangleAlert size={15}/> {activeFlags.length} red flag{activeFlags.length === 1 ? "" : "s"} — screening routing will be withheld
                  </span>
                : <>
                    <button className={"btn" + (safetyReviewed ? "" : " ghost")}
                            onClick={() => setSafetyReviewed(v => !v)}>
                      {safetyReviewed ? <Check size={16}/> : <ShieldCheck size={16}/>} None of these apply
                    </button>
                    <span className="sm">
                      {safetyReviewed
                        ? "Recorded as reviewed. This is written to the chart alongside the screen."
                        : "Confirm the review to continue — the screen will not proceed on an unexamined safety step."}
                    </span>
                  </>}
            </div>
          </div>
        )}

        {stepKey === "intake" && (
          <div className="card">
            <div className="eyebrow">01 · Intake</div>
            <h2 className="steptitle">Presenting picture</h2>
            <p className="stepsub">What is the dominant, treatment-refractory complaint?</p>
            <div className="pick" style={{margin:"12px 0 4px"}}>
              {[
                { k: "sinonasal", h: "Sinonasal", d: "Facial pressure, “sinus headache”, congestion" },
                { k: "otologic", h: "Otologic / vestibular", d: "Dizziness, aural fullness, tinnitus, fluctuating hearing" },
                { k: "both", h: "Both", d: "Mixed sinonasal and otologic" },
              ].map(o => (
                <div key={o.k} className={"p" + (complaint === o.k ? " sel" : "")}
                     role="button" tabIndex={0}
                     onClick={() => setComplaint(o.k)}
                     onKeyDown={e => (e.key === "Enter" || e.key === " ") && setComplaint(o.k)}>
                  <div className="ph">{o.h}</div><div className="pd">{o.d}</div>
                </div>
              ))}
            </div>
            <div style={{height:6}} />
            <QGroup domainKey="recalcitrance" answers={answers} set={set} intro="Recalcitrance markers — the premise of the screen" />
          </div>
        )}

        {stepKey === "migraine" && <StepCard dk="migraine" eyebrow="02 · Migrainous features" title="Trigeminovascular pattern" sub="Features suggesting a migraine mechanism, wherever the pain is felt." answers={answers} set={set} />}
        {stepKey === "vestibular" && <StepCard dk="vestibular" eyebrow="03 · Otologic / vestibular" title="Audiovestibular pattern" sub="Features suggesting vestibular migraine or migrainous aural symptoms." answers={answers} set={set} />}
        {stepKey === "neuro" && <StepCard dk="neuro" eyebrow="04 · Neuropathic overlay" title="Sensory / neuropathic pattern" sub="Features suggesting a cranial small-fiber or post-viral contribution." answers={answers} set={set} />}

        {stepKey === "discriminators" && <StepCard dk="discriminators" eyebrow="06 · Rule-out findings" title="Evidence against a masked driver" sub="Objective findings that point somewhere other than migraine or neuropathy. These subtract from the index — a screen that can only accumulate evidence for its own hypothesis is not a screen." answers={answers} set={set} />}

        {stepKey === "impact" && (
          <div className="card">
            <div className="eyebrow">05 · Impact &amp; context</div>
            <h2 className="steptitle">Burden and diagnostic history</h2>
            <p className="stepsub">Impact is scored. The history items below are not scored — they flag a possible missed diagnosis.</p>
            <QGroup domainKey="impact" answers={answers} set={set} />
            <div style={{height:4}} />
            <ContextQ ctx={ctx} setC={setC} />
          </div>
        )}

        {stepKey === "result" && (
          <ResultView
            total={total} floor={floor} ceiling={ceiling} coverage={coverage} scorable={scorable} open={open}
            band={band} bandMeta={bandMeta} domains={domains}
            activeFlags={activeFlags} override={override} emergent={emergent} safetyReviewed={safetyReviewed}
            cohort={cohort} captureScreen={captureScreen} downloadCohort={downloadCohort}
            recs={recs} gapAlert={gapAlert} gapFlags={gapFlags} patient={patient}
            complaint={complaint} bundle={bundle} showJson={showJson} setShowJson={setShowJson}
            copyBundle={copyBundle} copied={copied} setToast={setToast}
          />
        )}

        {/* nav */}
        <div className="nav">
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(s => s - 1)}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <div style={{flex:1}} />
          {step < LAST_STEP && (
            <button className="btn" disabled={!canContinue} onClick={() => setStep(s => s + 1)}>
              {step === LAST_STEP - 1 ? "See screen result" : "Continue"} <ArrowRight size={16} />
            </button>
          )}
          {step === LAST_STEP && (
            <button className="btn ghost" onClick={reset}><RotateCcw size={16} /> New screen</button>
          )}
        </div>

        <ResearchReadinessPanel project="MASQUE" score={total} ceiling={ceiling} scorable={scorable}
          band={band} domains={domains} coverage={coverage} sex={patient.sex} gender={patient.gender} phenotype={complaint}
          redFlags={activeFlags.map(f => f.points)}
          itemIds={ALL_ITEM_IDS} capturedRows={cohort}
          instrumentVersion={INSTRUMENT_VERSION}
          modelVersion={`masque-prototype-${APP_VERSION}`} />

        <p className="foot">PROTOTYPE · not for clinical use · screening aid, not a diagnosis · no PHI leaves this browser</p>
      </div>

      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </div>
  );
}

// ----------------------------- sub-components ----------------------------------

function StepCard({ dk, eyebrow, title, sub, answers, set }) {
  return (
    <div className="card">
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="steptitle">{title}</h2>
      <p className="stepsub">{sub}</p>
      <QGroup domainKey={dk} answers={answers} set={set} />
    </div>
  );
}

function QGroup({ domainKey, answers, set, intro }) {
  const d = ITEMS[domainKey];
  return (
    <div>
      {intro && <p className="stepsub" style={{marginTop:6}}>{intro}</p>}
      {d.items.map(it => (
        <div className="q" key={it.id}>
          <div className="qtext">{it.text}</div>
          <div className="opts">
            {it.scale
              ? it.scale.map((o, i) => (
                  <button key={i} className={"opt" + (answers[it.id] === i ? " sel" : "")}
                          onClick={() => set(it.id, i)}>{o.label}</button>))
              : (["no", "yes"].map(v => (
                  <button key={v}
                    className={"opt" + (answers[it.id] === v ? (v === "yes" ? " sel" : " selno") : "")}
                    onClick={() => set(it.id, v)}>{v === "yes" ? "Yes" : "No"}</button>)))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContextQ({ ctx, setC }) {
  const rows = [
    { id: "c_clin", t: "Clinicians seen for this problem", opts: [["0-1","0–1"],["2","2"],["3+","3+"]] },
    { id: "c_dur", t: "Total symptom duration", opts: [["<3mo","<3 mo"],["3-12mo","3–12 mo"],[">12mo",">12 mo"]] },
    { id: "c_dismiss", t: "Previously told it was anxiety / stress, or “nothing wrong”", opts: [["no","No"],["yes","Yes"]] },
  ];
  return (
    <div>
      {rows.map(r => (
        <div className="q" key={r.id}>
          <div className="qtext">{r.t}</div>
          <div className="opts">
            {r.opts.map(([v, l]) => (
              <button key={v} className={"opt" + (ctx[r.id] === v ? " sel" : "")}
                      onClick={() => setC(r.id, v)}>{l}</button>))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultView(props) {
  const { total, floor, ceiling, coverage, scorable, open, band, bandMeta, domains, recs, gapAlert, gapFlags,
          activeFlags = [], override, emergent, safetyReviewed,
          cohort = [], captureScreen, downloadCohort,
          complaint, bundle, showJson, setShowJson, copyBundle, copied, setToast } = props;
  const zones = [
    { w: 33, c: "var(--green)" }, { w: 33, c: "var(--amber)" }, { w: 34, c: "var(--coral)" },
  ];
  return (
    <div className="card">
      <div className="eyebrow">07 · Result</div>

      {/* safety override — always first, above the index */}
      {override && (
        <div className="override" style={{marginTop:12}}>
          <div className="ot"><TriangleAlert size={20} /> Red flag — evaluate before screening routing</div>
          <div className="os">
            {activeFlags.length} finding{activeFlags.length === 1 ? "" : "s"} require
            {activeFlags.length === 1 ? "s" : ""} evaluation on {activeFlags.length === 1 ? "its" : "their"} own terms.
            {emergent ? " At least one needs same-day assessment." : " Expedited workup — days, not weeks."}
            {" "}The MASQUE index is shown below for the record; it proposes no referral and no reassurance while this is open.
          </div>
          {activeFlags.map(f => (
            <div className="oitem" key={f.id}>
              <b>{f.text}</b>
              {f.points} — <span className="oact">{f.action}</span>
              <span className={"tier " + f.tier}>{f.tier}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="steptitle" style={{marginBottom:14}}>MASQUE index</h2>

      <div className="readout">
        <div>
          <div className="scorecap">{scorable ? "SCORE / 100" : `POSSIBLE RANGE · ${coverage}% ANSWERED`}</div>
          {scorable
            ? <div className="score" style={{color:bandMeta.c}}>{total}</div>
            : <div className="scorerange" style={{color:bandMeta.c}}>{floor}<span className="sep">–</span>{ceiling}</div>}
        </div>
        <div style={{flex:"1 1 260px",minWidth:220}}>
          <span className="pill" style={{color:bandMeta.c,background:bandMeta.bg}}>
            {scorable
              ? <><Activity size={15}/> {bandMeta.label} of a masked migrainous / neuropathic driver</>
              : <><TriangleAlert size={15}/> {bandMeta.label}</>}
          </span>
          <div className="meter">
            {zones.map((z, i) => <div key={i} className="z" style={{width:z.w+"%",background:z.c,opacity:.28}} />)}
            {scorable
              ? <div className="needle" style={{left:total+"%"}} />
              : <div className="rangeband" style={{left:floor+"%",width:Math.max(1,ceiling-floor)+"%"}} />}
          </div>
          <div className="meterticks"><span>0</span><span>34</span><span>67</span><span>100</span></div>
        </div>
      </div>

      {/* outstanding items — what would resolve the screen */}
      {!scorable && (
        <div className="openlist">
          <div className="oh">Outstanding items · {open.length} unanswered</div>
          {open.slice(0, 6).map(it => (
            <div className="oi" key={it.id}>
              <span className="ow">+{it.w}</span>
              <span>{it.text}</span>
            </div>
          ))}
          {open.length > 6 && <div className="om">…and {open.length - 6} more. Highest-weight items are listed first.</div>}
          <div className="om">
            No band, referral, or CDS prompt is issued until the answered items settle the index into a single band.
            Unanswered items are <b>not</b> counted as denials.
          </div>
        </div>
      )}

      {/* domain contributions */}
      <div style={{marginTop:20}}>
        <div className="eyebrow" style={{marginBottom:6}}>Contribution by domain</div>
        {DOMAIN_ORDER.map(k => (
          <div className="dbar" key={k}>
            <div className="dl">{domains[k].label}</div>
            <div className="dtrack"><div className="dfill" style={{width:Math.abs(domains[k].pct)+"%",background:domains[k].negative?"var(--coral)":"var(--petrol2)"}} /></div>
            <div className="dpts num">{domains[k].pts}/{domains[k].max}</div>
          </div>
        ))}
      </div>

      {/* gap alert */}
      {gapAlert && (
        <div className="alert" style={{marginTop:18}}>
          <TriangleAlert size={20} color="#B26C1F" style={{flex:"0 0 auto",marginTop:1}} />
          <div>
            <div className="at">Diagnostic-gap pattern detected</div>
            <div className="ap">
              {gapFlags.join(" · ")}. This pattern of repeated visits and prior dismissal is disproportionately
              documented in women with migraine and vestibular migraine — weigh pretest probability accordingly rather
              than attributing symptoms to stress.
            </div>
          </div>
        </div>
      )}

      {/* recommendations / routing */}
      <div style={{marginTop:20}}>
        <div className="eyebrow" style={{marginBottom:2}}>Recommended next steps</div>
        {recs.map((r, i) => (
          <div className="rec" key={i}>
            <h4>{r.h}</h4>
            <p>{r.p}</p>
            {r.chips.length > 0 && (
              <div className="chips">
                {r.chips.map((c, j) => <span className="chip" key={j}>{c}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CDS Hooks preview — safety card pre-empts the screening card */}
      {override ? (
        <div className="cds" style={{borderLeftColor:"var(--coral)"}}>
          <div className="src">CDS Hooks card · {emergent ? "critical" : "warning"} · order-select</div>
          <div style={{fontSize:13.5,fontWeight:640,margin:"5px 0 3px",color:"#8E3520"}}>
            MASQUE: red flag present — do not attribute to migraine before evaluation
          </div>
          <div style={{fontSize:12.5,color:"#33474A"}}>
            {activeFlags.map(f => f.action).join(" · ")}. The screening index is withheld from routing.
          </div>
        </div>
      ) : scorable && band !== "low" && (
        <div className="cds">
          <div className="src">CDS Hooks card · order-select</div>
          <div style={{fontSize:13.5,fontWeight:640,margin:"5px 0 3px"}}>
            MASQUE: consider a migrainous / neuropathic driver before escalating {complaint === "otologic" ? "otologic" : "sinonasal"} therapy
          </div>
          <div style={{fontSize:12.5,color:"#33474A"}}>
            Screen index {total}/100 ({bandMeta.label}). Suggested action: administer the confirmatory instrument and
            place the indicated referral.
          </div>
        </div>
      )}

      {/* FHIR write-back */}
      <div style={{marginTop:20}}>
        <div className="eyebrow" style={{marginBottom:8}}>Write back to chart</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button className="btn" onClick={() => setToast(scorable ? "Written to chart (simulated)" : "Partial screen written as in-progress (simulated)")}>
            <Send size={16}/> {scorable ? "Write result to chart" : "Write partial screen to chart"}
          </button>
          <button className="btn ghost" onClick={() => setShowJson(v => !v)}>
            <FileJson size={16}/> {showJson ? "Hide" : "View"} FHIR bundle
          </button>
          {showJson && (
            <button className="btn ghost" onClick={copyBundle}>
              {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>

        {/* pilot capture — §8's clinician-in-the-loop loop, closed */}
        <div className="capture">
          <div>
            <div className="ct">Pilot capture</div>
            <div className="cp">
              Appends this screen to a session cohort in the canonical import schema, then loads or exports it
              for the research panel. <b>Reference label and diagnosis are left empty</b> — there is no reference
              standard at screening time, and an empty column is what the follow-up visit fills in.
              Rows carry a site-local pseudonym so repeat screens on the same patient link across sessions,
              which is what makes test-retest and responsiveness measurable at all.
            </div>
            {SALT_IS_DEFAULT && (
              <div className="alert" style={{marginTop:10}}>
                <TriangleAlert size={17} color="#B26C1F" style={{flex:"0 0 auto",marginTop:1}}/>
                <div><div className="at">Pseudonymisation salt not configured</div>
                  <div className="ap">
                    <code>SITE_SALT</code> is still the shipped default, so <code>subject_id</code> is reversible by
                    anyone holding this source and a list of MRNs. Set a site-specific salt and keep it with your
                    other study secrets before capturing real patients.
                  </div></div>
              </div>
            )}
          </div>
          <div className="spacer"/>
          <button className="btn ghost" onClick={captureScreen}><Plus size={15}/> Append this screen</button>
          <button className="btn ghost" disabled={!cohort.length} onClick={downloadCohort}>
            <Download size={15}/> Export cohort ({cohort.length})
          </button>
        </div>

        {/* §7.3 deployable specification — real resources, generated from the same ITEMS */}
        <details className="about" style={{marginTop:14}}>
          <summary><FileJson size={15}/> Published specification <ChevronDown size={14} className="chev"/></summary>
          <div className="abgrid">
            <div>These are generated from the running item set, so they cannot drift from the instrument the app
            actually scores with. The Questionnaire is what this screen's QuestionnaireResponse resources point at.</div>
            <div className="nav" style={{marginTop:2,flexWrap:"wrap"}}>
              <button className="btn ghost" onClick={()=>downloadJsonFile(`masque-questionnaire-v${INSTRUMENT_VERSION}.json`, buildQuestionnaire())}>
                <Download size={15}/> FHIR Questionnaire
              </button>
              <button className="btn ghost" onClick={()=>downloadJsonFile("masque-cds-hooks.json", buildCdsHooks())}>
                <Download size={15}/> CDS Hooks service
              </button>
              <button className="btn ghost" onClick={()=>downloadJsonFile(`masque-data-dictionary-v${INSTRUMENT_VERSION}.json`, buildDataDictionary())}>
                <Download size={15}/> Data dictionary
              </button>
            </div>
          </div>
        </details>
        {showJson && (
          <pre className="code" dangerouslySetInnerHTML={{ __html: fhirHtml(bundle) }} />
        )}
      </div>

      <div className="note">
        <ShieldCheck size={15} style={{flex:"0 0 auto",marginTop:1}} />
        <span>Screening aid, not a diagnosis. The item set is authored for this prototype and is not the validated
        instruments named above, which are administered under their own licenses. The weighted model is interpretable
        and illustrative, pending validation on the open-data sources named in the Project MASQUE proposal (NHANES, NHIS,
        MEPS, CMS, HCUP, openFDA, CDC, All of Us).</span>
      </div>

      <details className="about" style={{marginTop:16}}>
        <summary><Info size={15}/> How EMR integration works <ChevronDown className="chev" size={15}/></summary>
        <div className="abgrid">
          <div><b>Launch.</b> The app opens from the chart via a SMART on FHIR EHR launch; the patient banner above is populated from the launch context (here, a sandbox Patient resource).</div>
          <div><b>Capture.</b> The clinician or patient completes the short screen; nothing is sent anywhere while answering.</div>
          <div><b>Write-back.</b> Results post as FHIR resources — a QuestionnaireResponse, an Observation carrying the MASQUE index and band, and a conditional ServiceRequest for referral — shown in the bundle above.</div>
          <div><b>Prompt.</b> A CDS Hooks card surfaces the recommendation in the ordering workflow.</div>
          <div><b>Privacy.</b> In deployment, acoustic / free-text features are extracted at the edge and raw identifiable data is not centralized; codes shown here use a placeholder system and are illustrative.</div>
        </div>
      </details>
    </div>
  );
}

// ----------------------------- FHIR bundle builder ----------------------------

function buildBundle({ patient, answers, total, ceiling, coverage, scorable, band, domains, complaint, ctx, recs, activeFlags = [], emergent }) {
  const now = new Date().toISOString();
  const interp = { low: "L", moderate: "N", high: "H" }[band];
  const override = activeFlags.length > 0;
  // A referral is only proposed from a settled, non-low band — and never from the
  // screen at all while a red flag is open, where the indicated request is the
  // safety workup, not headache medicine.
  const referral = !override && scorable && band !== "low";
  const specialty = complaint === "otologic" ? "Neuro-otology" : "Headache medicine / Neurology";

  const entries = [];

  // Red flags post as Flag resources so they are visible in the chart independently
  // of whether anyone opens the screening result.
  for (const f of activeFlags) {
    entries.push({
      resource: {
        resourceType: "Flag",
        status: "active",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/flag-category", code: "clinical" }] }],
        code: { coding: [{ system: "http://masque.example/codes", code: f.id, display: f.points }], text: f.text },
        subject: { reference: `Patient/${patient.id}` },
        period: { start: now },
      },
    });
  }

  entries.push({
    resource: {
      resourceType: "QuestionnaireResponse",
      status: scorable ? "completed" : "in-progress",
      questionnaire: QUESTIONNAIRE_URL,
      subject: { reference: `Patient/${patient.id}` },
      authored: now,
      /*  Item-level capture (audit 3.5 / 3.6).

          v0.1 wrote only five domain subtotals, which threw away everything needed
          for psychometrics — Cronbach's alpha, item-total correlations, factor
          structure — and everything needed for the clinician-in-the-loop pilot.
          Every item now appears with its own linkId. An item that was ASKED AND
          DENIED carries valueBoolean:false; an item that was NEVER ASKED carries no
          answer element at all. Collapsing those two into a zero is the same error
          as #1 and #3, one layer down.
      */
      item: DOMAIN_ORDER.map(k => ({
        linkId: k, text: domains[k].label,
        answer: [{ valueInteger: domains[k].pts }],
        item: ITEMS[k].items.map(it => {
          const v = answers[it.id];
          const node = { linkId: it.id, text: it.text };
          if (v === undefined) return node;                       // asked-not-answered stays empty
          node.answer = [ it.scale
            ? { valueCoding: { system: "http://masque.example/answer", code: String(v), display: it.scale[v]?.label } }
            : { valueBoolean: v === "yes" } ];
          return node;
        }),
      })),
    },
  });

  const components = DOMAIN_ORDER.map(k => ({
    code: { coding: [{ system: "http://masque.example/codes", code: `domain-${k}`, display: domains[k].label }] },
    valueQuantity: { value: domains[k].pts, unit: "score", code: "{score}" },
  }));
  components.push({
    code: { coding: [{ system: "http://masque.example/codes", code: "screen-coverage", display: "Proportion of scored items answered" }] },
    valueQuantity: { value: coverage, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
  });
  if (override) {
    components.push({
      code: { coding: [{ system: "http://masque.example/codes", code: "routing-override", display: "Screening routing withheld — red flag present" }] },
      valueString: activeFlags.map(f => f.points).join("; "),
    });
  }
  if (!scorable) {
    components.push({
      code: { coding: [{ system: "http://masque.example/codes", code: "attainable-range", display: "Attainable index range given unanswered items" }] },
      valueRange: {
        low:  { value: total,   unit: "score", code: "{score}" },
        high: { value: ceiling, unit: "score", code: "{score}" },
      },
    });
  }

  entries.push({
    resource: {
      resourceType: "Observation",
      status: scorable ? "final" : "preliminary",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey" }] }],
      code: { coding: [{ system: "http://masque.example/codes", code: "masque-index", display: "MASQUE migraine/neuropathy screen index" }] },
      subject: { reference: `Patient/${patient.id}` },
      effectiveDateTime: now,
      // No value and no interpretation while the screen is unsettled: a partial
      // index would be read downstream as a completed negative screen.
      ...(scorable
        ? {
            valueQuantity: { value: total, unit: "score", system: "http://unitsofmeasure.org", code: "{score}" },
            interpretation: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: interp, display: `${band} likelihood` }] }],
          }
        : {
            dataAbsentReason: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/data-absent-reason", code: "temp-unknown", display: "Temporarily Unknown" }] },
            note: [{ text: `Screen incomplete (${coverage}% of items answered). Index is bounded to ${total}–${ceiling}/100, which spans more than one band. No result issued.` }],
          }),
      component: components,
    },
  });

  if (override) {
    entries.push({
      resource: {
        resourceType: "ServiceRequest",
        status: "draft",
        intent: "proposal",
        priority: emergent ? "stat" : "urgent",
        code: { text: `Red-flag evaluation: ${activeFlags.map(f => f.action).join("; ")}` },
        subject: { reference: `Patient/${patient.id}` },
        authoredOn: now,
        reasonCode: activeFlags.map(f => ({ text: `${f.text} — ${f.points}` })),
      },
    });
  }

  if (referral) {
    entries.push({
      resource: {
        resourceType: "ServiceRequest",
        status: "draft",
        intent: "proposal",
        priority: "routine",
        code: { text: `Referral: ${specialty} — evaluate for ${complaint === "otologic" ? "vestibular migraine" : "mid-facial / migrainous cause"}` },
        subject: { reference: `Patient/${patient.id}` },
        authoredOn: now,
        reasonCode: [{ text: `MASQUE index ${total}/100 (${band} likelihood); administer confirmatory instrument.` }],
      },
    });
  }

  return {
    resourceType: "Bundle",
    type: "transaction",
    timestamp: now,
    entry: entries.map(e => ({ ...e, request: { method: "POST", url: e.resource.resourceType } })),
  };
}
