import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Play, Pause, RotateCcw, ArrowRight, ArrowLeft, Stethoscope,
  Activity, ShieldCheck, TriangleAlert, HelpCircle, Check, Copy, FileJson,
  FileText, Sparkles, User, MessageSquare, ChevronDown, Info, Plus, Download
} from "lucide-react";
import ResearchReadinessPanel from "./ResearchReadinessPanel.jsx";
import { extract, LEXICON_VERSION, RF_PHRASES } from "./MASQUE_Extraction.js";
import { liveProbes, validateProbes, PROBE_KIND, PROBE_SET_VERSION } from "./MASQUE_Probes.js";
import { createVoiceCapture, isVoiceSupported, VOICE_ENGINE, VOICE_LANG, VOICE_ERRORS } from "./MASQUE_Voice.js";

/*  Project MASQUE — Ambient Scribe prototype
    ------------------------------------------------------------------
    An ambient AI scribe that listens to the ENT encounter, captures symptoms into the
    MASQUE screen automatically, tracks coverage, and prompts the physician with the
    highest-yield questions still unasked — including the VM-PATHI vestibular-migraine
    domains when the otologic pathway lights up.

    Copyright-safe: the on-screen prompts are authored for this prototype and mirror the
    VM-PATHI *domains* (motion sensitivity, disequilibrium, headache equivalents,
    cognition, affect). They are NOT the VM-PATHI items themselves — the validated
    instrument is named as the licensed confirmatory step.

    Prototype only. Screening aid, not a diagnosis. The transcript comes from the
    scripted demo, from typed statements, or live from the microphone through the
    browser's own speech recognition (MASQUE_Voice.js). A deployment plugs in ambient
    ASR at the edge with no raw audio retained.
*/

// ------------------------- MASQUE model (shared with the screener) -------------

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

/*  Does an unrecorded safety review block SIGNING, or only routing?

    This was left implicit and it should not have been. The screener's safety gate is
    mandatory — you cannot reach a result without it — because a form can be made to
    wait. An ambient scribe cannot: you cannot hard-stop a clinician mid-encounter,
    so its gate has always been a persistent nag that blocks routing while letting the
    encounter proceed.

    Signing is the point where that asymmetry has to resolve, because a signed note is
    a clinical record. Default is to block: the note already prints "NOT YET REVIEWED"
    in capitals, and signing a note that says that about itself is a worse outcome than
    an extra click. Sites that need signing available regardless — a scribe used for
    documentation only, with safety handled in a separate workflow — set this false and
    the note keeps saying what happened either way.
*/
const REQUIRE_SAFETY_REVIEW_TO_SIGN = true;
const QUESTIONNAIRE_URL = `http://masque.example/Questionnaire/masque-screener-v${INSTRUMENT_VERSION}`;

const DOMAIN_ORDER = ["recalcitrance","migraine","vestibular","neuro","impact","discriminators"];
const ALL_ITEMS = DOMAIN_ORDER.flatMap(k => ITEMS[k].items.map(it => ({ ...it, domain: k })));
const ALL_ITEM_IDS = ALL_ITEMS.map(it => it.id);
const ITEM_BY_ID = Object.fromEntries(ALL_ITEMS.map(it => [it.id, it]));

/*  Red flags — the safety gate, mirrored from the screener.

    Two rules govern them here, and both matter more than the capture itself:

    1. Ambient capture may only ever RAISE a flag. It can never clear one, and the
       absence of a cue phrase is never evidence of absence. Safety is not a
       recall problem you hand to a phrase list.
    2. The clinician must record the safety review explicitly. Until they do, the
       scribe issues no routing, regardless of what the index says.
*/
const RED_FLAGS = [
  { id: "rf_thunderclap", tier: "emergent", group: "Neurologic",
    text: "Headache peaking within seconds to a minute",
    points: "Subarachnoid haemorrhage", action: "Emergency imaging today",
    ask: "Did the worst headache come on all at once, in seconds?" },
  { id: "rf_focal", tier: "emergent", group: "Neurologic",
    text: "New focal deficit — weakness, numbness, speech or swallowing change, or persistent double vision",
    points: "Central or cranial-nerve lesion", action: "Emergency neurologic evaluation",
    ask: "Any new weakness, numbness, slurred speech, or double vision?" },
  { id: "rf_vision", tier: "emergent", group: "Neurologic",
    text: "Progressive vision loss or transient visual obscurations",
    points: "Raised intracranial pressure", action: "Same-day fundoscopy and imaging",
    ask: "Has your vision greyed out or dimmed, even briefly?" },
  { id: "rf_gca", tier: "emergent", group: "Systemic",
    text: "Scalp tenderness, jaw claudication, or visual symptoms over age 50",
    points: "Giant cell arteritis", action: "Same-day ESR/CRP and rheumatology",
    ask: "Does your jaw ache when chewing, or is your scalp tender to touch?" },
  { id: "rf_orbital", tier: "emergent", group: "Systemic",
    text: "Orbital swelling, proptosis, eye pain, or restricted eye movement",
    points: "Orbital complication / invasive fungal disease", action: "Emergency ENT and imaging",
    ask: "Any eye swelling, eye pain, or trouble moving the eye?" },
  { id: "rf_ssnhl", tier: "emergent", group: "Otologic",
    text: "Hearing dropped over hours to a day within the last 30 days",
    points: "Sudden sensorineural hearing loss — closing steroid window", action: "Same-day audiogram",
    ask: "Did your hearing drop suddenly rather than gradually?" },
  { id: "rf_asym", tier: "urgent", group: "Otologic",
    text: "Hearing loss or tinnitus consistently in one ear only",
    points: "Retrocochlear lesion / vestibular schwannoma", action: "MRI internal auditory canals",
    ask: "Is the ear trouble always the same ear?" },
  { id: "rf_pulsatile", tier: "urgent", group: "Otologic",
    text: "Tinnitus pulsing in time with the heartbeat",
    points: "Vascular lesion or raised ICP", action: "Vascular imaging",
    ask: "Does the ringing pulse along with your heartbeat?" },
  { id: "rf_progressive", tier: "urgent", group: "Neurologic",
    text: "Headache worsening, or worse on waking, coughing, straining, or lying flat",
    points: "Raised intracranial pressure / mass lesion", action: "Neuro-imaging",
    ask: "Is it worse when you lie down, cough, or first wake up?" },
  { id: "rf_new50", tier: "urgent", group: "Neurologic",
    text: "First-ever severe headache beginning after age 50",
    points: "Secondary headache until proven otherwise", action: "Imaging and inflammatory markers",
    ask: "Is this the first time you've had headaches like this?" },
  { id: "rf_mass", tier: "urgent", group: "Sinonasal",
    text: "One-sided obstruction with bleeding, a visible mass, or new facial numbness",
    points: "Sinonasal or skull-base malignancy", action: "Endoscopy and imaging",
    ask: "Any one-sided blockage, nosebleeds, or numbness in the cheek?" },
  { id: "rf_systemic", tier: "urgent", group: "Systemic",
    text: "Fever, night sweats, weight loss, immunosuppression, or known malignancy",
    points: "Infection, inflammatory or metastatic disease", action: "Directed workup first",
    ask: "Any fevers, night sweats, or unintended weight loss?" },
];
const RF_BY_ID = Object.fromEntries(RED_FLAGS.map(f => [f.id, f]));

// physician-facing question for each item (authored)
const ASK = {
  r_dur: "How long has this been going on?",
  r_abx: "Have antibiotics or steroids been tried — did they help lastingly?",
  r_surg: "Any prior sinus procedure? Did it resolve things?",
  r_lesion: "For the dizziness — has any vestibular or structural cause been found?",
  r_normal: "Have scans or exams looked normal despite how you feel?",
  m_head: "Do you get recurrent headaches or facial pressure? How often?",
  m_photo: "During episodes, are you bothered by light or sound?",
  m_nausea: "Do the episodes come with nausea?",
  m_disable: "Do the episodes stop you from your usual activities?",
  m_aura: "Any visual changes — spots, shimmering, zigzags — around the episodes?",
  m_trig: "Do weather, poor sleep, missed meals, or your cycle set them off?",
  m_fhx: "Any personal or family history of migraine?",
  m_dur: "When an attack is untreated, how long does it last — under 4 hours, 4 to 72 hours, or longer?",
  v_vertigo: "When the spinning or imbalance comes, how long does one episode last?",
  v_count: "Roughly how many separate episodes have you had — more or fewer than five?",
  v_migfeat: "Do at least half the episodes come with headache, light sensitivity, or visual changes?",
  v_motion: "Are you sensitive to motion or busy visual scenes — scrolling, aisles, driving?",
  v_aural: "Any ear fullness or ringing that comes and goes with the episodes?",
  v_head: "Do certain head positions or movements trigger it?",
  n_burn: "Any burning, tingling, or electric feelings in the face, mouth, or throat?",
  n_otalgia: "Any deep ear or throat pain, even when the ear looks normal?",
  n_auto: "Any dry eyes or mouth, lightheadedness on standing, or changes in sweating or digestion?",
  n_viral: "Did this start after a viral illness or COVID?",
  n_allo: "Do light touch or normal sensations feel unusually intense?",
  i_days: "About how many days a month are you affected?",
  i_role: "How much does this affect work or daily life?",
  x_purulent: "During the bad spells, is there thick discharge, or has a sinus culture ever come back positive?",
  x_objective: "Has a CT or scope during a symptomatic period shown actual sinus inflammation?",
  x_lowfreq: "Has an audiogram shown hearing that drops and recovers, in the low frequencies?",
  x_anosmia: "Is your sense of smell reduced even between the episodes?",
};
// which item prompts also belong to a VM-PATHI domain (label only; not the instrument text)
const VMPATHI_TAG = {
  v_motion: "VM-PATHI · motion sensitivity",
  v_vertigo: "VM-PATHI · disequilibrium",
  v_head: "VM-PATHI · disequilibrium",
  m_photo: "VM-PATHI · headache equivalents",
};
// informational VM-PATHI domains not in the numeric model (authored, unscored)
const VMPATHI_INFO = [
  { id: "vmp_cog", tag: "VM-PATHI · cognition", ask: "During the episodes, any brain fog or trouble concentrating?" },
  { id: "vmp_affect", tag: "VM-PATHI · anxiety / emotion", ask: "Do the attacks bring anxiety or feel overwhelming?" },
];

function scoreItem(it, v) {
  if (it.scale) return typeof v === "number" ? it.w * (it.scale[v]?.f ?? 0) : 0;
  return v === "yes" ? it.w : 0;
}
// Items only ever ADD points, so answered items bound the index from below while
// unanswered items define how far it could still rise. A band is reported only when
// that range sits inside one band. Mid-encounter the screen is legitimately
// "not yet scorable" — it must never read as a completed negative screen.
const BAND_CUTS = { moderate: 34, high: 67 };
function bandFor(v) { return v >= BAND_CUTS.high ? "high" : v >= BAND_CUTS.moderate ? "moderate" : "low"; }

// Two-sided: v0.2 discriminators subtract, so an unanswered item can move the index
// down as well as up. Each contributes its best case to the ceiling and its worst to
// the floor. See the screener for the full rationale.
function itemBounds(item) {
  if (item.scale) {
    const fs = item.scale.map(s => s.f);
    const a = item.w * Math.min(...fs), b = item.w * Math.max(...fs);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return item.w >= 0 ? { min: 0, max: item.w } : { min: item.w, max: 0 };
}
function computeScore(answers) {
  const domains = {}; let total = 0, posHead = 0, negHead = 0, answered = 0;
  const open = [];
  for (const k of DOMAIN_ORDER) {
    let sum = 0, dOpen = 0;
    for (const it of ITEMS[k].items) {
      if (answers[it.id] === undefined) {
        const bd = itemBounds(it);
        posHead += bd.max; negHead += -bd.min; dOpen += Math.abs(it.w);
        open.push({ ...it, domain: k });
      } else { answered++; sum += scoreItem(it, answers[it.id]); }
    }
    sum = Math.round(sum * 10) / 10;
    domains[k] = { pts: sum, max: ITEMS[k].max, pct: Math.round(sum / ITEMS[k].max * 100),
      label: ITEMS[k].label, openPts: dOpen, negative: !!ITEMS[k].negative };
    total += sum;
  }
  total = Math.max(0, Math.min(100, Math.round(total)));
  const ceiling = Math.max(total, Math.min(100, Math.round(total + posHead)));
  const floor   = Math.min(total, Math.max(0,   Math.round(total - negHead)));
  const coverage = Math.round(answered / ALL_ITEMS.length * 100);
  const scorable = bandFor(floor) === bandFor(ceiling);
  return {
    domains, total, floor, ceiling, coverage, scorable, answered,
    band: scorable ? bandFor(total) : "indeterminate",
    open: open.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)),
  };
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
      { name: "sex", type: "string", note: "Subgroup field for the fairness audit" },
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
function screenToCohortRow({ patient, answers, total, coverage, scorable, band, activeFlags, complaint }) {
  const row = {
    screen_id: `masque-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    captured_at: new Date().toISOString(),
    instrument_version: INSTRUMENT_VERSION,
    app_version: APP_VERSION,
    score: total,
    label: "",                    // no reference standard at screening time
    reference_diagnosis: "",      // filled at follow-up — this is the §8 outcome column
    sex: patient.sex ?? "",
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

// ------------------------- extraction engine (rule-based, transparent) ---------

/*  The extraction engine now lives in MASQUE_Extraction.js.

    It was moved out of this component so it could be benchmarked: rules embedded in
    a React file cannot be swept, versioned, or run against a corpus, which is why
    proposal §7.2's benchmarking commitment had gone unmet. MASQUE_Extraction_Benchmark.mjs
    imports the same module this file does, so the reported figures describe the rules
    that actually ship rather than a copy of them.

    Drift guard: every red flag defined here must have cue phrases in the lexicon.
*/
(function assertRedFlagCues() {
  const missing = RED_FLAGS.map(f => f.id).filter(id => !RF_PHRASES[id]?.length);
  if (missing.length) console.error("[MASQUE scribe] red flags with no cue phrases", missing);
})();

// Probes reference item and red-flag ids by string. A typo fails silently at runtime —
// the clinician answers and nothing records — so it is checked at load instead.
validateProbes(ALL_ITEMS.map(i => i.id), RED_FLAGS.map(f => f.id));

// ------------------------- simulated encounter --------------------------------

const SCRIPT = [
  ["md", "What brings you in today?"],
  ["pt", "It's my sinuses. I've had facial pressure and headaches behind my eyes for over a year now."],
  ["md", "Have you been treated for it?"],
  ["pt", "So many times — like four rounds of antibiotics and a steroid spray. Nothing helps for long."],
  ["md", "Any imaging done?"],
  ["pt", "They did a CT and said it looked basically normal, which was frustrating."],
  ["pt", "And lately I've been getting really dizzy too — kind of spinning, it comes and goes and lasts a while."],
  ["md", "Tell me more about the dizziness."],
  ["pt", "Bright lights and busy places make it worse — grocery store aisles, scrolling on my phone. And my ear feels full and rings when it happens."],
  ["pt", "My mom had migraines, if that matters."],
  ["md", "Has anyone looked into the dizziness?"],
  ["pt", "They didn't find anything wrong. One doctor said it was probably just anxiety and stress."],
  ["pt", "I've seen three or four different doctors about all of this."],
  ["md", "Thank you — that's really helpful."],
];

// Synthetic sandbox record. No DOB is carried: an age plus a birth date is a date of birth.
const PATIENT = { id: "masque-demo-1042", given: "Dana", family: "Herrera", sex: "female", gender: "woman", age: 41, mrn: "SANDBOX-77-2210", synthetic: true };

// ------------------------- styles ---------------------------------------------

const CSS = `
:root{--ink:#0C2B2F;--petrol:#0F5C61;--petrol2:#137A80;--surface:#EDF3F1;--panel:#FFFFFF;
--line:#D7E1DF;--muted:#5C6E6C;--amber:#B26C1F;--amberbg:#F6ECD9;--coral:#B84A33;--coralbg:#F6E1DA;
--green:#2C7A57;--greenbg:#E0EEE7;--slate:#4F6466;
--mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
*{box-sizing:border-box}
.mq{font-family:var(--sans);color:var(--ink);background:var(--surface);min-height:100%;-webkit-font-smoothing:antialiased;line-height:1.45}
.wrap{max-width:1080px;margin:0 auto;padding:16px 16px 64px}
.mq h1,.mq h2,.mq h3,.mq h4{margin:0;font-weight:650;letter-spacing:-.01em}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.banner{background:var(--ink);color:#EAF3F1;border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:13px;flex-wrap:wrap}
.avatar{width:36px;height:36px;border-radius:10px;background:var(--petrol2);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.banner .name{font-size:15.5px;font-weight:650}.banner .meta{font-size:11.5px;color:#9FC1BE}
.badge{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.28);color:#BFE0DC;white-space:nowrap;display:inline-flex;gap:5px;align-items:center}
.badge.live{color:#0C2B2F;background:#7BE0B0;border-color:#7BE0B0}
.dot{width:7px;height:7px;border-radius:50%;background:#0C2B2F;animation:pulse 1.1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.spacer{flex:1 1 auto}
.gbtn{font:inherit;font-size:12.5px;cursor:pointer;border-radius:9px;padding:7px 11px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#EAF3F1;display:inline-flex;align-items:center;gap:6px}
.gbtn:hover{background:rgba(255,255,255,.08)}
.brandrow{display:flex;align-items:center;gap:12px;margin:18px 2px 4px}
.mark{width:34px;height:34px;border-radius:9px;background:var(--petrol);color:#fff;display:flex;align-items:center;justify-content:center}
.brandrow .t1{font-size:18px;font-weight:700;letter-spacing:-.02em}.brandrow .t2{font-size:12.5px;color:var(--muted)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px;align-items:start}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
.chdr{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.chdr .ct{font-size:13px;font-weight:660}.chdr .ce{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--petrol);font-weight:600}
.transport{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.tbtn{font:inherit;font-size:13px;font-weight:600;cursor:pointer;border-radius:9px;padding:8px 13px;border:1px solid var(--petrol);background:var(--petrol);color:#fff;display:inline-flex;align-items:center;gap:7px}
.tbtn:hover{background:var(--petrol2);border-color:var(--petrol2)}
.tbtn.ghost{background:#fff;color:var(--ink);border-color:var(--line)}.tbtn.ghost:hover{border-color:var(--petrol2)}
.tbtn:disabled{opacity:.4;cursor:not-allowed}
.tsc{max-height:340px;overflow:auto;padding-right:4px}
.row{display:flex;margin:8px 0}
.row.pt{justify-content:flex-start}.row.md{justify-content:flex-end}
.bub{max-width:82%;padding:9px 12px;border-radius:13px;font-size:13.5px}
.row.pt .bub{background:#F1F5F4;border:1px solid var(--line);border-bottom-left-radius:4px}
.row.md .bub{background:var(--petrol);color:#fff;border-bottom-right-radius:4px}
.who{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 4px 2px}
.cap{font-family:var(--mono);font-size:10px;color:var(--green);margin-top:5px;display:flex;gap:5px;flex-wrap:wrap}
.captag{background:var(--greenbg);border-radius:6px;padding:2px 6px;color:#1E5A40}
.rf{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:7px;background:#fff;display:flex;gap:10px;align-items:flex-start;cursor:pointer;transition:.12s}
.rf:hover{border-color:#C98476}
.rf.on{border-color:var(--coral);background:#FDF4F1;box-shadow:inset 0 0 0 1px var(--coral)}
.rf .box{width:17px;height:17px;border-radius:5px;border:1.5px solid #B7C4C2;flex:0 0 auto;margin-top:1px;display:flex;align-items:center;justify-content:center;background:#fff}
.rf.on .box{background:var(--coral);border-color:var(--coral);color:#fff}
.rf .rt{font-size:12.5px;line-height:1.35}.rf .rm{font-size:11px;color:var(--muted);margin-top:3px}
.tier{font-family:var(--mono);font-size:9px;letter-spacing:.07em;text-transform:uppercase;border-radius:5px;padding:2px 5px;margin-left:6px;white-space:nowrap}
.tier.emergent{background:var(--coralbg);color:#8E3520}.tier.urgent{background:var(--amberbg);color:#7A4E12}
.tier.heard{background:var(--greenbg);color:#1E5A40}
.override{border:1.5px solid var(--coral);background:var(--coralbg);border-radius:12px;padding:13px 14px;margin-top:12px}
.override .ot{font-size:13.5px;font-weight:700;color:#8E3520;display:flex;gap:8px;align-items:center}
.override .os{font-size:11.5px;color:#6E3020;margin-top:4px}
.override .oitem{background:#fff;border-radius:8px;padding:8px 10px;margin-top:7px;font-size:11.5px}
.override .oitem b{display:block;font-size:12px;margin-bottom:2px}.override .oact{color:#8E3520;font-weight:600}
.entry{display:flex;gap:7px;margin-top:12px}
.entry input{flex:1;font:inherit;font-size:13px;padding:9px 11px;border:1px solid var(--line);border-radius:9px}
.entry input:focus{outline:2px solid var(--petrol2);outline-offset:1px}
.mini{font:inherit;font-size:12.5px;cursor:pointer;border-radius:8px;padding:9px 11px;border:1px solid var(--petrol);background:var(--petrol);color:#fff;display:inline-flex;gap:5px;align-items:center}

/* right column */
.score{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:600;font-size:52px;line-height:.9;letter-spacing:-.03em}
.readout{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:650;padding:5px 11px;border-radius:999px}
.covrow{display:flex;align-items:center;gap:10px;margin-top:12px}
.covtrack{flex:1;height:8px;border-radius:6px;background:var(--line);overflow:hidden}
.covfill{height:100%;background:var(--petrol2);border-radius:6px;transition:width .4s ease}
.dbar{display:grid;grid-template-columns:118px 1fr 48px;gap:9px;align-items:center;padding:5px 0}
.dbar .dl{font-size:12px}.dtrack{height:7px;border-radius:5px;background:var(--line);overflow:hidden}
.dfill{height:100%;border-radius:5px;background:var(--petrol2);transition:width .4s}
.dpts{font-family:var(--mono);font-size:11px;text-align:right;color:var(--muted)}
.prompt{border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:0 11px 11px 0;background:#FffdF8;padding:11px 13px;margin-top:9px}
.prompt .qtag{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--amber);font-weight:700;margin-bottom:3px;display:flex;gap:6px;align-items:center}
.prompt .qq{font-size:13.5px;font-weight:560;margin-bottom:8px}
.prow{display:flex;gap:6px;flex-wrap:wrap}
.pbtn{font:inherit;font-size:12px;cursor:pointer;border-radius:8px;padding:6px 12px;border:1px solid var(--line);background:#fff}
.pbtn:hover{border-color:var(--petrol2)}
.pbtn.y{background:var(--petrol);color:#fff;border-color:var(--petrol)}
.pbtn.n{background:var(--slate);color:#fff;border-color:var(--slate)}
.pbtn.skip{color:var(--muted)}
.alert{display:flex;gap:11px;background:var(--amberbg);border:1px solid #E4C88E;border-radius:12px;padding:12px 13px;margin-top:12px}
.alert .at{font-size:12.5px;font-weight:660;color:#7A4E12;margin-bottom:2px}.alert .ap{font-size:12px;color:#6B4A18}
.rec{border-left:3px solid var(--petrol);background:#F4F8F7;border-radius:0 10px 10px 0;padding:11px 13px;margin-top:9px}
.rec h4{font-size:12.5px;margin:0 0 3px}.rec p{font-size:12px;color:#33474A}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.chip{font-family:var(--mono);font-size:10px;border:1px solid var(--line);background:#fff;border-radius:6px;padding:3px 7px;color:var(--slate)}
.note{font-family:var(--mono);font-size:11.5px;line-height:1.55;white-space:pre-wrap;background:#0C2B2F;color:#CFE6E2;border-radius:11px;padding:14px;max-height:320px;overflow:auto}
.code{font-family:var(--mono);font-size:11px;line-height:1.5;background:#0C2B2F;color:#CFE6E2;border-radius:11px;padding:13px;overflow:auto;max-height:280px;white-space:pre}
.code .k{color:#8FD3CC}.code .s{color:#E7C08A}.code .n{color:#F0A992}
.btnrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.act{font:inherit;font-size:13px;font-weight:600;cursor:pointer;border-radius:9px;padding:9px 13px;border:1px solid var(--petrol);background:var(--petrol);color:#fff;display:inline-flex;gap:7px;align-items:center}
.act.ghost{background:#fff;color:var(--ink);border-color:var(--line)}.act.ghost:hover{border-color:var(--petrol2)}
.notew{font-size:11.5px;color:var(--muted);display:flex;gap:7px;margin-top:12px;align-items:flex-start}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#EAF3F1;padding:10px 17px;border-radius:11px;font-size:13px;display:flex;gap:8px;align-items:center;z-index:40;box-shadow:0 8px 30px rgba(0,0,0,.22)}
.empty{font-size:12.5px;color:var(--muted);text-align:center;padding:18px 8px}
.foot{font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.04em;text-align:center;margin-top:22px}
details.about summary{cursor:pointer;font-size:12.5px;font-weight:600;color:var(--petrol);display:flex;gap:6px;align-items:center;list-style:none}
details.about summary::-webkit-details-marker{display:none}
details.about[open] .chev{transform:rotate(180deg)}.chev{transition:.2s}
.abgrid{font-size:12px;color:#33474A;margin-top:9px;display:grid;gap:7px}
:focus-visible{outline:2px solid var(--petrol2);outline-offset:2px;border-radius:6px}
@media (max-width:820px){.grid{grid-template-columns:1fr}}

/* voice capture */
.tbtn.rec{background:var(--coral);border-color:var(--coral)}.tbtn.rec:hover{background:#A03F2A;border-color:#A03F2A}
.voice{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:-4px 0 12px;background:#F7FAF9}
.vrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.vstate{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.vstate.on{color:var(--coral)}
.vstate.on::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--coral);animation:pulse 1.1s infinite}
.vmeter{flex:1 1 80px;min-width:60px;height:6px;border-radius:4px;background:var(--line);overflow:hidden}
.vfill{height:100%;background:var(--green);border-radius:4px;transition:width .08s linear}
.spk{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-left:auto}
.spkb{font:inherit;font-size:11.5px;cursor:pointer;padding:5px 9px;border:0;background:#fff;color:var(--muted);display:inline-flex;align-items:center;gap:5px}
.spkb.on{background:var(--petrol);color:#fff}
.verr{font-size:11.5px;color:#8E3520;display:flex;gap:6px;align-items:flex-start;margin-top:6px}
.vhint{font-size:11px;color:var(--muted);margin-top:5px}
.bub.interim{opacity:.72;border-style:dashed}
.row.md .bub.interim{border:1px dashed rgba(255,255,255,.6)}
.captag.pending{background:#fff;border:1px dashed var(--green);color:var(--green)}
.dbar.hit .dl{color:var(--green);font-weight:650}.dbar.hit .dfill{background:var(--green)}
@keyframes scorepop{0%{transform:scale(1.05)}100%{transform:scale(1)}}
.score{animation:scorepop .3s ease-out;transform-origin:left bottom}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

function fhirHtml(obj){
  return JSON.stringify(obj,null,2).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/"([^"]+)":/g,'<span class="k">"$1"</span>:')
    .replace(/: "([^"]*)"/g,': <span class="s">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g,': <span class="n">$1</span>');
}

// ------------------------- component ------------------------------------------

export default function MasqueScribe() {
  const [transcript, setTranscript] = useState([]);   // {id, role, text, caps:[{id,value}]}
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState({});
  const [ctx, setCtx] = useState({});
  const [vmp, setVmp] = useState({});                  // informational VM-PATHI coverage
  const [asked, setAsked] = useState({});              // items the MD explicitly addressed via prompts
  const [skipped, setSkipped] = useState({});          // prompts dismissed without an answer — NOT denials
  const [cohort, setCohort] = useState([]);            // captured screens (pilot loop, §8)
  const [rf, setRf] = useState({});                    // id -> "nlp" | "md"
  const [safetyReviewed, setSafetyReviewed] = useState(false);
  const [probeAns, setProbeAns] = useState({});   // probe id -> chosen option index
  const [probeNotes, setProbeNotes] = useState([]);
  const [input, setInput] = useState("");
  const [view, setView] = useState("safety");          // safety | prompts | note | fhir
  const [toast, setToast] = useState("");
  const scrollRef = useRef(null);

  // native voice capture — see MASQUE_Voice.js
  const [voiceState, setVoiceState] = useState("idle"); // idle | starting | listening | restarting | stopped | error
  const [voiceErr, setVoiceErr] = useState(null);
  const [voiceUsed, setVoiceUsed] = useState(false);
  const [interim, setInterim] = useState("");           // text the recogniser has not committed yet
  const [speaker, setSpeaker] = useState("pt");         // who the microphone is hearing: pt | md
  const [pulse, setPulse] = useState({ domains: [], at: 0 }); // domains touched by the latest capture
  const voiceRef = useRef(null);
  const ingestRef = useRef(null);
  const speakerRef = useRef("pt");
  const levelSink = useRef(null);
  const voiceSupported = useMemo(() => isVoiceSupported(), []);
  const listening = voiceState === "starting" || voiceState === "listening" || voiceState === "restarting";
  speakerRef.current = speaker;

  const { domains, total, floor, ceiling, coverage, scorable, band } =
    useMemo(() => computeScore(answers), [answers]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2400); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [transcript, interim]);
  useEffect(() => { if (!pulse.at) return; const t = setTimeout(() => setPulse({ domains: [], at: 0 }), 1800); return () => clearTimeout(t); }, [pulse]);
  useEffect(() => () => { if (voiceRef.current) voiceRef.current.destroy(); }, []);

  // ingest one utterance: run extraction, update state, return captures.
  // src records where the utterance came from — demo | typed | voice — for the transcript only;
  // capture rules are identical for all three.
  function ingest(role, text, src = "demo") {
    const caps = role === "pt" ? extract(text) : [];
    if (caps.length) {
      const touched = [...new Set(caps.map(c => ITEM_BY_ID[c.id]?.domain).filter(Boolean))];
      if (touched.length) setPulse({ domains: touched, at: Date.now() });
      setAnswers(a => { const n = { ...a }; caps.filter(c => c.kind === "item").forEach(c => { if (n[c.id] === undefined) n[c.id] = c.value; }); return n; });
      setCtx(c => { const n = { ...c }; caps.filter(x => x.kind === "ctx").forEach(x => { n[x.id] = x.value; }); return n; });
      // Only ever additive, and only ever marked as heard — a clinician decision
      // already on the record is not downgraded by a later phrase match.
      setRf(v => { const n = { ...v }; caps.filter(x => x.kind === "redflag").forEach(x => { if (!n[x.id]) n[x.id] = "nlp"; }); return n; });
    }
    setTranscript(t => [...t, { id: t.length, role, text, src, caps: caps.map(c => ({ id: c.id, value: c.value })) }]);
  }
  ingestRef.current = ingest;

  /*  Microphone. The capture object lives outside React state; its callbacks reach the
      current ingest and speaker through refs so a session started minutes ago does not
      write through a stale closure. Final segments are ingested exactly like a typed
      statement; interim text is only previewed (see MASQUE_Voice.js for why).
  */
  const bindLevel = useCallback((fn) => { levelSink.current = fn; }, []);
  function startVoice() {
    if (voiceRef.current) voiceRef.current.destroy();
    setVoiceErr(null); setInterim(""); setPlaying(false); setVoiceUsed(true);
    const vc = createVoiceCapture({
      lang: VOICE_LANG,
      onState: setVoiceState,
      onInterim: setInterim,
      onError: setVoiceErr,
      onLevel: (v) => { if (levelSink.current) levelSink.current(v); },
      onFinal: (text) => ingestRef.current(speakerRef.current, text, "voice"),
    });
    voiceRef.current = vc;
    vc.start();
  }
  function stopVoice() { if (voiceRef.current) voiceRef.current.stop(); }

  // What the extractor would capture from the words still being recognised. Preview only —
  // nothing is written until the recogniser commits the segment.
  const previewCaps = useMemo(
    () => (interim && speaker === "pt") ? extract(interim).map(c => ({ id: c.id, value: c.value })) : [],
    [interim, speaker]);

  // playback
  useEffect(() => {
    if (!playing) return;
    if (cursor >= SCRIPT.length) { setPlaying(false); return; }
    const [role, text] = SCRIPT[cursor];
    const delay = role === "md" ? 850 : 1500;
    const t = setTimeout(() => { ingest(role, text); setCursor(c => c + 1); }, delay);
    return () => clearTimeout(t);
  }, [playing, cursor]); // eslint-disable-line

  function stepOnce() {
    if (cursor >= SCRIPT.length) return;
    const [role, text] = SCRIPT[cursor]; ingest(role, text); setCursor(c => c + 1);
  }
  function captureScreen() {
    setCohort(c => [...c, screenToCohortRow({ patient: PATIENT, answers, total, coverage, scorable, band, activeFlags, complaint })]);
    setToast(`Screen appended — ${cohort.length + 1} in session cohort`);
  }

  function reset() {
    stopVoice(); setInterim(""); setVoiceErr(null);
    setTranscript([]); setCursor(0); setPlaying(false); setAnswers({}); setCtx({});
    setVmp({}); setAsked({}); setSkipped({}); setRf({}); setSafetyReviewed(false); setView("safety");
    setProbeAns({}); setProbeNotes([]); setCohort([]);
    setToast("Encounter cleared");
  }
  function submitInput() {
    const v = input.trim(); if (!v) return;
    ingest("pt", v, "typed"); setInput("");
  }

  const complaint = useMemo(() => {
    const sin = ["r_abx","r_surg"].some(id => answers[id] === "yes") || answers.m_head !== undefined;
    const oto = ["v_vertigo","v_motion","v_aural","v_head"].some(id => answers[id] !== undefined && answers[id] !== "no");
    if (sin && oto) return "both"; if (oto) return "otologic"; return "sinonasal";
  }, [answers]);

  // suggested questions: unanswered items, prioritized by active pathway + weight.
  // While the screen is unscorable the pool widens to every unanswered item —
  // otherwise headroom parked in an inactive domain could hold the screen
  // indeterminate with nothing left on screen to resolve it.
  const suggestions = useMemo(() => {
    const active = new Set(["migraine","impact","recalcitrance","discriminators"]);
    if (complaint === "otologic" || complaint === "both") active.add("vestibular");
    if ((answers.n_burn ?? "no") !== "no" || answers.n_viral === "yes") active.add("neuro");
    const open = ALL_ITEMS.filter(it => answers[it.id] === undefined && !skipped[it.id] && (scorable || active.has(it.domain)));
    // rank: active pathway first, then VM-PATHI-tagged when vestibular active, then weight
    const vestActive = active.has("vestibular");
    open.sort((a, b) => {
      const aa = active.has(a.domain) ? 1 : 0, ba = active.has(b.domain) ? 1 : 0;
      if (aa !== ba) return ba - aa;
      const av = vestActive && VMPATHI_TAG[a.id] ? 1 : 0;
      const bv = vestActive && VMPATHI_TAG[b.id] ? 1 : 0;
      if (av !== bv) return bv - av;
      return b.w - a.w;
    });
    const items = open.slice(0, 4).map(it => ({
      id: it.id, ask: ASK[it.id], tag: VMPATHI_TAG[it.id] || (it.domain === "vestibular" ? "vestibular" : ITEMS[it.domain].label.toLowerCase()),
      scale: it.scale, kind: "scored",
    }));
    // add up to 2 informational VM-PATHI domain prompts when vestibular active
    if (vestActive) for (const info of VMPATHI_INFO) if (vmp[info.id] === undefined && items.length < 6)
      items.push({ id: info.id, ask: info.ask, tag: info.tag, kind: "info" });
    return items;
  }, [answers, complaint, vmp, scorable, skipped]);

  /*  Contextual probes — what to ask or do next, ranked by what the answer could change.

      The item list above ranks unanswered items by weight, which is right for filling in
      a questionnaire and wrong for a live encounter: the highest-weight unanswered item is
      almost never the most urgent thing to say. These are triggered by what has already
      been captured and ordered safety → re-ask → criteria → rule-out → supporting → exam,
      so a question that could surface a red flag outranks one that could add six points.
  */
  const probes = useMemo(() => liveProbes(answers, rf, probeAns), [answers, rf, probeAns]);

  function answerProbe(p, idx) {
    const o = p.opts[idx];
    setProbeAns(v => ({ ...v, [p.id]: idx }));
    // A probe may only ever RAISE a red flag, never clear one — same rule as ambient capture.
    if (o.rf) setRf(v => (v[o.rf] ? v : { ...v, [o.rf]: "probe" }));
    if (o.a) { setAnswers(a2 => ({ ...a2, ...o.a })); setAsked(k => ({ ...k, ...Object.fromEntries(Object.keys(o.a).map(x => [x, true])) })); }
    if (o.note) setProbeNotes(n => [...n, o.note]);
  }

  function answerPrompt(s, value) {
    if (s.kind === "info") { setVmp(v => ({ ...v, [s.id]: value })); }
    else { setAnswers(a => ({ ...a, [s.id]: value })); setAsked(k => ({ ...k, [s.id]: true })); }
  }
  // Skipping a prompt hides it; it never writes an answer. A skipped item stays
  // unanswered — it keeps its headroom in the attainable range, is not counted toward
  // coverage, and is absent from the note and the QuestionnaireResponse. Recording it
  // as "no" would turn "the physician chose not to ask" into "the patient denied it",
  // which is the absent-data-as-negative-data error the whole codebase is built against.
  function skipPrompt(s) {
    if (s.kind === "info") setVmp(v => ({ ...v, [s.id]: "skip" }));
    else setSkipped(k => ({ ...k, [s.id]: true }));
  }

  const bandMeta = { low:{c:"var(--green)",bg:"var(--greenbg)",l:"Low"}, moderate:{c:"var(--amber)",bg:"var(--amberbg)",l:"Moderate"}, high:{c:"var(--coral)",bg:"var(--coralbg)",l:"High"}, indeterminate:{c:"var(--slate)",bg:"#E3EAE9",l:"Not scorable"} }[band];

  const gapFlags = [
    ctx.c_clin === "3+" && "3+ clinicians",
    ctx.c_dur === ">12mo" && ">12 months",
    ctx.c_dismiss === "yes" && "prior “anxiety/stress” attribution",
  ].filter(Boolean);
  const gapAlert = gapFlags.length >= 2;

  const activeFlags = useMemo(() => RED_FLAGS.filter(f => rf[f.id]), [rf]);
  const override = activeFlags.length > 0;
  const emergent = activeFlags.some(f => f.tier === "emergent");
  // Routing requires BOTH: no open red flag, and a clinician who has actually
  // recorded the safety review. An unreviewed encounter routes nothing.
  const routingCleared = !override && safetyReviewed;

  const recs = useMemo(() => buildRecs(band, complaint, domains, scorable && routingCleared, answers), [band, complaint, domains, scorable, routingCleared, answers]);
  const note = useMemo(() => buildNote({ patient: PATIENT, answers, ctx, vmp, total, floor, ceiling, coverage, scorable, band, complaint, domains, recs, gapAlert, activeFlags, safetyReviewed, emergent, probeNotes }), [answers, ctx, vmp, total, floor, ceiling, coverage, scorable, band, complaint, domains, recs, gapAlert, activeFlags, safetyReviewed, emergent, probeNotes]);
  const bundle = useMemo(() => buildBundle({ patient: PATIENT, answers, total, floor, ceiling, coverage, scorable, band, domains, complaint, note, activeFlags, emergent, routingCleared }), [answers, total, floor, ceiling, coverage, scorable, band, domains, complaint, note, activeFlags, emergent, routingCleared]);

  const hasContent = transcript.length > 0;

  return (
    <div className="mq">
      <style>{CSS}</style>
      <div className="wrap">

        {/* banner */}
        <div className="banner">
          <div className="avatar"><User size={18} color="#EAF3F1" /></div>
          <div>
            <div className="name">{PATIENT.family}, {PATIENT.given}</div>
            <div className="meta num">{PATIENT.age} yr · {PATIENT.sex} · {PATIENT.mrn} · synthetic sandbox record</div>
          </div>
          <div className="spacer" />
          {listening ? <span className="badge live"><span className="dot" /> Listening · microphone</span>
           : playing ? <span className="badge live"><span className="dot" /> Listening · demo</span>
                     : <span className="badge">Ambient scribe · {voiceUsed ? "browser speech" : "on-device"}</span>}
          <span className="badge">SMART on FHIR · sandbox</span>
        </div>

        <div className="brandrow">
          <div className="mark"><Sparkles size={18} /></div>
          <div>
            <div className="t1">MASQUE Scribe <span className="num" style={{fontSize:12,color:"var(--muted)",fontWeight:400}}>v{APP_VERSION}</span></div>
            <div className="t2">Ambient capture of the ENT encounter with live migraine / neuropathy screening prompts</div>
          </div>
        </div>

        <div className="grid">
          {/* LEFT — live encounter */}
          <div className="card">
            <div className="chdr"><MessageSquare size={16} color="var(--petrol)" /><div><div className="ce">Live</div><div className="ct">Encounter</div></div></div>
            <div className="transport">
              {listening
                ? <button className="tbtn rec" onClick={stopVoice}><Square size={15} /> Stop listening</button>
                : <button className="tbtn" onClick={startVoice} disabled={!voiceSupported}
                          title={voiceSupported ? "Capture the encounter from this device's microphone" : VOICE_ERRORS.unsupported}>
                    <Mic size={15} /> Listen</button>}
              {!playing
                ? <button className="tbtn" onClick={() => setPlaying(true)} disabled={cursor >= SCRIPT.length}><Play size={15} /> {cursor === 0 ? "Play demo visit" : "Resume"}</button>
                : <button className="tbtn" onClick={() => setPlaying(false)}><Pause size={15} /> Pause</button>}
              <button className="tbtn ghost" onClick={stepOnce} disabled={cursor >= SCRIPT.length || playing}><ArrowRight size={15} /> Step</button>
              <button className="tbtn ghost" onClick={reset}><RotateCcw size={15} /> Reset</button>
            </div>

            {(listening || voiceErr) && (
              <div className="voice" aria-live="polite">
                <div className="vrow">
                  <span className={"vstate" + (listening ? " on" : "")}>
                    {voiceState === "starting" ? "Starting microphone…" : listening ? `Listening · ${VOICE_LANG}` : "Stopped"}
                  </span>
                  {listening && <VoiceMeter bind={bindLevel} />}
                  <div className="spk" role="radiogroup" aria-label="Who is speaking">
                    <button className={"spkb" + (speaker === "pt" ? " on" : "")} role="radio" aria-checked={speaker === "pt"} onClick={() => setSpeaker("pt")}><User size={13} /> Patient</button>
                    <button className={"spkb" + (speaker === "md" ? " on" : "")} role="radio" aria-checked={speaker === "md"} onClick={() => setSpeaker("md")}><Stethoscope size={13} /> Physician</button>
                  </div>
                </div>
                {voiceErr && <div className="verr"><TriangleAlert size={13} style={{flex:"0 0 auto",marginTop:2}} /><span>{voiceErr.message}</span></div>}
                {listening && !voiceErr && (speaker === "md"
                  ? <div className="vhint">Physician turn — transcribed, not captured. Switch to Patient before they answer.</div>
                  : <div className="vhint">Patient turn — each committed phrase is captured as it lands. Switch to Physician while you speak so your questions are not read as their symptoms.</div>)}
              </div>
            )}

            <div className="tsc" ref={scrollRef}>
              {!hasContent && !interim && <div className="empty">
                {voiceSupported ? <>Press <b>Listen</b> to capture the encounter from the microphone, </> : <>Press </>}
                <b>Play demo visit</b> to watch a scripted one — or type what the patient says below.</div>}
              {transcript.map(m => (
                <div key={m.id}>
                  <div className={"row " + m.role}>
                    <div style={{maxWidth:"82%"}}>
                      <div className="who" style={{textAlign: m.role === "md" ? "right" : "left"}}>{m.role === "md" ? "Physician" : "Patient"}{m.src === "voice" ? " · voice" : ""}</div>
                      <div className="bub">{m.text}</div>
                      {m.caps.length > 0 && (
                        <div className="cap">
                          {m.caps.map((c, i) => <span className="captag" key={i}>+ {capLabel(c)}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {interim && (
                <div className={"row " + speaker}>
                  <div style={{maxWidth:"82%"}}>
                    <div className="who" style={{textAlign: speaker === "md" ? "right" : "left"}}>{speaker === "md" ? "Physician" : "Patient"} · hearing…</div>
                    <div className="bub interim">{interim}</div>
                    {previewCaps.length > 0 && (
                      <div className="cap">
                        {previewCaps.map((c, i) => <span className="captag pending" key={i}>? {capLabel(c)}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="entry">
              <input value={input} placeholder="Type a patient statement…" onChange={e => setInput(e.target.value)}
                     onKeyDown={e => e.key === "Enter" && submitInput()} />
              <button className="mini" onClick={submitInput}><Plus size={14} /> Capture</button>
            </div>
            <div className="notew"><Info size={13} style={{flex:"0 0 auto",marginTop:1}} /><span>
              Rule-based capture for the prototype. With the microphone on, transcription is the browser's own speech
              recognition ({VOICE_ENGINE.split(" — ")[0]}): Chrome and Edge send audio to the vendor's speech service for that step,
              Safari may process on-device. This app retains no audio — only text and structured findings, in this tab.
              A deployment plugs in ambient ASR + clinical NLP at the edge.</span></div>
          </div>

          {/* RIGHT — screen + prompts */}
          <div className="card">
            <div className="chdr"><Activity size={16} color="var(--petrol)" /><div><div className="ce">Live screen</div><div className="ct">MASQUE index</div></div></div>

            <div className="readout">
              <div><div className="score" key={scorable ? `t${total}` : `r${floor}-${ceiling}`} style={{color:bandMeta.c,fontSize:scorable?undefined:38}}>
                {scorable ? total : `${floor}–${ceiling}`}
              </div></div>
              <div style={{flex:"1 1 auto"}}>
                <span className="pill" style={{color:bandMeta.c,background:bandMeta.bg}}>
                  {scorable
                    ? <><Activity size={13} /> {bandMeta.l} likelihood</>
                    : <><TriangleAlert size={13} /> {bandMeta.l} yet — range spans a cutpoint</>}
                </span>
                <div className="covrow">
                  <span className="num" style={{fontSize:11,color:"var(--muted)"}}>coverage {coverage}%</span>
                  <div className="covtrack"><div className="covfill" style={{width:coverage+"%"}} /></div>
                </div>
              </div>
            </div>

            <div style={{marginTop:12}}>
              {DOMAIN_ORDER.map(k => (
                <div className={"dbar" + (pulse.domains.includes(k) ? " hit" : "")} key={k}>
                  <div className="dl">{domains[k].label}</div>
                  <div className="dtrack"><div className="dfill" style={{width:domains[k].pct+"%"}} /></div>
                  <div className="dpts num">{domains[k].pts}/{domains[k].max}</div>
                </div>
              ))}
            </div>

            {gapAlert && (
              <div className="alert">
                <TriangleAlert size={17} color="#B26C1F" style={{flex:"0 0 auto",marginTop:1}} />
                <div><div className="at">Diagnostic-gap pattern</div><div className="ap">{gapFlags.join(" · ")}. Weigh pretest probability rather than attributing symptoms to stress.</div></div>
              </div>
            )}

            {override && (
              <div className="override">
                <div className="ot"><TriangleAlert size={18} /> Red flag — routing withheld</div>
                <div className="os">
                  {emergent ? "Needs same-day evaluation." : "Expedited workup — days, not weeks."} The index is retained but proposes nothing.
                </div>
                {activeFlags.map(f => (
                  <div className="oitem" key={f.id}>
                    <b>{f.text}</b>{f.points} — <span className="oact">{f.action}</span>
                  </div>
                ))}
              </div>
            )}
            {!override && !safetyReviewed && (
              <div className="alert" style={{marginTop:10}}>
                <ShieldCheck size={17} color="#B26C1F" style={{flex:"0 0 auto",marginTop:1}} />
                <div><div className="at">Safety check outstanding</div>
                  <div className="ap">No routing is issued until the red-flag review is recorded. Open the Safety tab.</div></div>
              </div>
            )}

            {/* view switch */}
            <div className="btnrow" style={{marginTop:14}}>
              <button className={"act" + (view === "safety" ? "" : " ghost")} onClick={() => setView("safety")}>
                {override ? <TriangleAlert size={15} /> : <ShieldCheck size={15} />} Safety {override ? `(${activeFlags.length})` : safetyReviewed ? "✓" : "!"}
              </button>
              <button className={"act" + (view === "prompts" ? "" : " ghost")} onClick={() => setView("prompts")}><HelpCircle size={15} /> Ask next {suggestions.length ? `(${suggestions.length})` : ""}</button>
              <button className={"act" + (view === "note" ? "" : " ghost")} onClick={() => setView("note")}><FileText size={15} /> Note</button>
              <button className={"act" + (view === "fhir" ? "" : " ghost")} onClick={() => setView("fhir")}><FileJson size={15} /> FHIR</button>
            </div>

            {view === "safety" && (
              <div style={{marginTop:6}}>
                <div className="notew" style={{marginTop:0}}><Info size={13} style={{flex:"0 0 auto",marginTop:1}} />
                  <span>Ambient capture can raise a flag but never clear one. Absence of a cue is not evidence of absence — confirm the review yourself.</span></div>
                {RED_FLAGS.map(f => (
                  <div key={f.id} className={"rf" + (rf[f.id] ? " on" : "")}
                       role="checkbox" aria-checked={!!rf[f.id]} tabIndex={0}
                       onClick={() => setRf(v => { const n = { ...v }; if (n[f.id]) delete n[f.id]; else n[f.id] = "md"; return n; })}
                       onKeyDown={e => (e.key === "Enter" || e.key === " ") && setRf(v => { const n = { ...v }; if (n[f.id]) delete n[f.id]; else n[f.id] = "md"; return n; })}>
                    <div className="box">{rf[f.id] && <Check size={12} />}</div>
                    <div>
                      <div className="rt">{f.text}<span className={"tier " + f.tier}>{f.tier}</span>
                        {rf[f.id] === "nlp" && <span className="tier heard">heard in encounter</span>}</div>
                      <div className="rm">{f.points} · {f.action}</div>
                    </div>
                  </div>
                ))}
                {!override && (
                  <div className="btnrow" style={{marginTop:12}}>
                    <button className={"act" + (safetyReviewed ? "" : " ghost")} onClick={() => setSafetyReviewed(v => !v)}>
                      {safetyReviewed ? <Check size={14} /> : <ShieldCheck size={14} />} {safetyReviewed ? "Review recorded" : "Record: none of these apply"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {view === "prompts" && (
              <div style={{marginTop:6}}>
                {suggestions.length === 0 && (
                  <div className="empty">{scorable
                    ? "No high-yield questions outstanding for the active pathway. Screen looks well covered."
                    : "Every scored item is answered but the index still spans a cutpoint — review the captured answers before issuing a result."}</div>
                )}
                {/* contextual probes first — a question that could surface a red flag
                    outranks one that could add six points */}
                {probes.length > 0 && (
                  <div style={{marginBottom:12}}>
                    {["safety","rescue","criteria","ruleout","phenotype","exam"].map(kind => {
                      const grp = probes.filter(x => x.kind === kind);
                      if (!grp.length) return null;
                      const shown = (kind === "safety" || kind === "rescue") ? grp : grp.slice(0, 2);
                      return (
                        <div key={kind}>
                          <div className="qtag" style={{color:PROBE_KIND[kind].c,margin:"10px 0 4px"}}>
                            {PROBE_KIND[kind].label}
                            {kind === "safety" && " · could surface a red flag"}
                            {kind === "rescue" && " · alternate phrasing, not a repeated question"}
                            {kind === "phenotype" && " · supporting features, recorded not scored"}
                          </div>
                          {shown.map(pr => (
                            <div className="prompt" key={pr.id}
                              style={{borderLeft:`3px solid ${PROBE_KIND[pr.kind].c}`}}>
                              {pr.rescues && answers[pr.rescues] !== undefined && (
                                <div className="qtag" style={{color:PROBE_KIND.rescue.c}}>
                                  re-asking {pr.rescues} — recorded as {String(answers[pr.rescues]) === "no" ? "denied" : `"${String(answers[pr.rescues])}"`}
                                </div>
                              )}
                              <div className="qq">{pr.say}</div>
                              <div className="qtag" style={{textTransform:"none",letterSpacing:0,marginTop:4}}>{pr.why}</div>
                              <div className="prow">
                                {pr.opts.map((o, i) => (
                                  <button key={i} className={"pbtn" + (o.rf ? " n" : "")} onClick={() => answerProbe(pr, i)}>{o.l}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {shown.length < grp.length && (
                            <div className="empty" style={{padding:"4px 0"}}>
                              +{grp.length - shown.length} more — answer one and the next moves up.
                              Safety and re-ask probes are never truncated.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {suggestions.map(s => (
                  <div className="prompt" key={s.id}>
                    <div className="qtag"><HelpCircle size={11} /> {s.tag}{s.kind === "info" ? " · not scored" : ""}</div>
                    <div className="qq">{s.ask}</div>
                    <div className="prow">
                      {s.scale
                        ? s.scale.map((o, i) => <button key={i} className="pbtn" onClick={() => answerPrompt(s, i)}>{o.label}</button>)
                        : (<>
                            <button className="pbtn y" onClick={() => answerPrompt(s, "yes")}>Yes</button>
                            <button className="pbtn n" onClick={() => answerPrompt(s, "no")}>No</button>
                          </>)}
                      <button className="pbtn skip" onClick={() => skipPrompt(s)}>Skip</button>
                    </div>
                  </div>
                ))}
                {/* routing recommendations — cleared safety, settled non-low band only */}
                {routingCleared && scorable && band !== "low" && (
                  <div style={{marginTop:14}}>
                    {recs.map((r, i) => (
                      <div className="rec" key={i}>
                        <h4>{r.h}</h4><p>{r.p}</p>
                        {r.chips.length > 0 && <div className="chips">{r.chips.map((c, j) => <span className="chip" key={j}>{c}</span>)}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === "note" && (
              <div style={{marginTop:8}}>
                <div className="note">{note}</div>
                <div className="btnrow">
                  <button className="act ghost" onClick={() => { try { navigator.clipboard.writeText(note); } catch(_){} setToast("Note copied"); }}><Copy size={14} /> Copy note</button>
                  <button className="act" disabled={REQUIRE_SAFETY_REVIEW_TO_SIGN && !safetyReviewed}
                    title={REQUIRE_SAFETY_REVIEW_TO_SIGN && !safetyReviewed ? "Record the red-flag review first — the note currently states that it is outstanding" : ""}
                    onClick={() => setToast("Signed to chart (simulated)")}><Check size={14} /> Sign to chart</button>
                  {REQUIRE_SAFETY_REVIEW_TO_SIGN && !safetyReviewed &&
                    <span className="empty" style={{padding:"0 4px",alignSelf:"center"}}>Safety review outstanding — the note says so, so signing is blocked.</span>}
                </div>
              </div>
            )}

            {view === "fhir" && (<>
              <div className="btnrow" style={{marginBottom:10,flexWrap:"wrap"}}>
                <button className="act ghost" onClick={captureScreen}><Plus size={14}/> Append screen to cohort</button>
                <button className="act ghost" disabled={!cohort.length} onClick={()=>downloadText(`masque-pilot-cohort-${new Date().toISOString().slice(0,10)}.csv`, rowsToCsv(cohort), "text/csv")}><Download size={14}/> Export ({cohort.length})</button>
                <button className="act ghost" onClick={()=>downloadJsonFile(`masque-questionnaire-v${INSTRUMENT_VERSION}.json`, buildQuestionnaire())}><Download size={14}/> Questionnaire</button>
                <button className="act ghost" onClick={()=>downloadJsonFile("masque-cds-hooks.json", buildCdsHooks())}><Download size={14}/> CDS Hooks</button>
                <button className="act ghost" onClick={()=>downloadJsonFile(`masque-data-dictionary-v${INSTRUMENT_VERSION}.json`, buildDataDictionary())}><Download size={14}/> Dictionary</button>
              </div>
              <div style={{marginTop:8}}>
                <pre className="code" dangerouslySetInnerHTML={{ __html: fhirHtml(bundle) }} />
                <div className="btnrow">
                  <button className="act ghost" onClick={() => { try { navigator.clipboard.writeText(JSON.stringify(bundle,null,2)); } catch(_){} setToast("FHIR bundle copied"); }}><Copy size={14} /> Copy bundle</button>
                  <button className="act" onClick={() => setToast("Posted to FHIR server (simulated)")}><FileJson size={14} /> Post bundle</button>
                </div>
              </div>
            </>)}

            <div className="notew"><ShieldCheck size={13} style={{flex:"0 0 auto",marginTop:1}} /><span>Screening aid, not a diagnosis. Prompts are authored and mirror the VM-PATHI domains; the validated VM-PATHI is administered under license for confirmation.</span></div>
          </div>
        </div>

        <details className="about card" style={{marginTop:14}}>
          <summary><Info size={14} /> How the scribe fits the visit <ChevronDown className="chev" size={14} /></summary>
          <div className="abgrid">
            <div><b>Listen.</b> In this prototype the browser's own speech recognition transcribes the microphone (a deployment runs ambient ASR on-device); rule-based extraction maps what the patient says to MASQUE items as each phrase lands (shown as green capture tags — dashed while a phrase is still being recognised).</div>
            <div><b>Prompt.</b> The scribe computes coverage and surfaces only the highest-yield unasked questions for the active pathway — pulling in the VM-PATHI vestibular domains once otologic symptoms appear — so the physician asks what matters without reading a 25-item form aloud.</div>
            <div><b>Document.</b> Captured findings, the MASQUE index, and the plan assemble into a draft note and a FHIR bundle (QuestionnaireResponse, Observation, ServiceRequest, DocumentReference) for one-tap sign-off.</div>
            <div><b>Protect.</b> No raw audio is retained; only structured findings persist.</div>
          </div>
        </details>

        <ResearchReadinessPanel project="MASQUE" score={total} ceiling={ceiling} scorable={scorable}
          band={band} domains={domains} coverage={coverage} sex={PATIENT.sex} gender={PATIENT.gender} phenotype={complaint}
          redFlags={activeFlags.map(f => f.points)}
          itemIds={ALL_ITEM_IDS} capturedRows={cohort}
          instrumentVersion={INSTRUMENT_VERSION}
          modelVersion={`masque-scribe-prototype-${APP_VERSION}`} />

        <p className="foot">PROTOTYPE · not for clinical use · {voiceUsed
          ? "microphone capture via the browser's speech service · this app stores no audio and no PHI"
          : "ambient capture is simulated · no PHI leaves this browser"}<br/>app {APP_VERSION} · instrument {INSTRUMENT_VERSION} · extraction lexicon {LEXICON_VERSION} · probe set {PROBE_SET_VERSION} — benchmarked in-sample only, see EXTRACTION_BENCHMARK</p>
      </div>
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </div>
  );
}

// ------------------------- helpers --------------------------------------------

/*  Microphone level bar. Holds its own state so the ~15 Hz level ticks re-render this
    one element rather than the whole scribe. `bind` hands it the setter; MASQUE_Voice
    sends null once if the meter cannot run, and the bar simply disappears.
*/
function VoiceMeter({ bind }) {
  const [level, setLevel] = useState(0);
  useEffect(() => { bind(setLevel); return () => bind(null); }, [bind]);
  if (level === null) return null;
  return (
    <div className="vmeter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      <div className="vfill" style={{width: Math.round(level * 100) + "%"}} />
    </div>
  );
}

function capLabel(c) {
  if (c.id.startsWith("rf_")) return "RED FLAG: " + (RF_BY_ID[c.id]?.points || c.id);
  if (c.id.startsWith("c_")) {
    const m = { c_dismiss: "prior dismissal", c_dur: "duration >12 mo", c_clin: "3+ clinicians" };
    return m[c.id] || c.id;
  }
  const it = ITEM_BY_ID[c.id]; if (!it) return c.id;
  if (it.scale) return `${shortLabel(it)}: ${it.scale[c.value]?.label ?? c.value}`;
  return (c.value === "no" ? "no " : "") + shortLabel(it);
}
function shortLabel(it) {
  const m = {
    m_head:"headache/pressure", m_photo:"light/sound sensitivity", m_nausea:"nausea", m_disable:"activity-limiting",
    m_aura:"aura", m_trig:"triggers", m_fhx:"migraine hx", m_dur:"attack duration",
    v_vertigo:"episode duration", v_count:"≥5 episodes", v_migfeat:"migrainous features ≥50%", v_motion:"motion sensitivity",
    n_otalgia:"otalgia, normal exam", n_auto:"autonomic features",
    x_purulent:"purulence/positive culture", x_objective:"objective sinus inflammation",
    x_lowfreq:"fluctuating low-frequency SNHL", x_anosmia:"persistent hyposmia",
    v_aural:"aural fullness/tinnitus", v_head:"positional", n_burn:"neuropathic sensation", n_viral:"post-viral onset",
    r_abx:"failed antibiotics", r_surg:"prior sinus surgery", r_normal:"normal imaging", r_lesion:"no lesion found",
    r_dur:">3 mo", i_days:"days/mo", i_role:"role impact",
  };
  return m[it.id] || it.id;
}

function buildRecs(band, complaint, domains, scorable = true, answers = {}) {
  if (!scorable) return [];
  const out = []; const strong = band !== "low";
  const sinus = complaint === "sinonasal" || complaint === "both";
  const oto = complaint === "otologic" || complaint === "both";
  if (sinus && strong) out.push({ h:"Consider mid-facial (“sinus”) migraine", p:"Reassess before further antibiotics, steroids, or sinus surgery.", chips:["SNOT-22 (0–110)","ID Migraine (≥2/3)","HIT-6 (≥60)","MIDAS"] });
  if (oto && (strong || domains.vestibular.pct >= 50)) out.push({ h:"Consider vestibular migraine", p:"Refer neuro-otology / vestibular therapy; administer the confirmatory instrument.", chips:["VM-PATHI (25-item, MCID ≥6)","DHI (0–100)","MIDAS"] });
  if (domains.neuro.pct >= 50) out.push({ h:"Cranial / small-fiber neuropathic overlay", p:"Consider neurology and small-fiber / autonomic evaluation, especially if post-viral.", chips:["SFN-SIQ","COMPASS-31"] });
  if (answers?.v_aural === "yes") out.push({ h:"Characterise the tinnitus before attributing it", p:"Migrainous and otologic tinnitus are managed differently and neither is assessed by the vestibular instruments above.", chips:["THI (0–100)","TFI (0–100)"] });
  if (domains.discriminators.pts < 0) out.push({ h:"Competing objective findings recorded", p:`Rule-out items subtracted ${Math.abs(domains.discriminators.pts)} points. Treat what is demonstrable on its own terms rather than reattributing it.`, chips:[] });
  return out;
}

function buildNote({ patient, answers, ctx, vmp, total, floor, ceiling, coverage, scorable, band, complaint, domains, recs, gapAlert, activeFlags = [], safetyReviewed, emergent, probeNotes = [] }) {
  const pos = ALL_ITEMS.filter(it => answers[it.id] !== undefined && answers[it.id] !== "no" && answers[it.id] !== 0);
  const line = (it) => "  • " + shortLabel(it) + (it.scale ? ` (${it.scale[answers[it.id]]?.label})` : "");
  const posByDom = DOMAIN_ORDER.map(k => {
    const rows = pos.filter(p => p.domain === k);
    return rows.length ? `${ITEMS[k].label}:\n` + rows.map(line).join("\n") : null;
  }).filter(Boolean);
  const vmpCov = Object.entries(vmp).filter(([,v]) => v === "yes" || v === "no").map(([k]) => (VMPATHI_INFO.find(i=>i.id===k)?.tag||k).replace("VM-PATHI · ",""));
  const ctxLine = [
    ctx.c_dur === ">12mo" && "duration >12 months",
    ctx.c_clin === "3+" && "seen by 3+ clinicians",
    ctx.c_dismiss === "yes" && "previously attributed to anxiety/stress",
  ].filter(Boolean).join("; ");

  return (
`ENT ENCOUNTER — MASQUE ambient screen (DRAFT)
Patient: ${patient.family}, ${patient.given}  ${patient.age}${patient.sex[0]}  ${patient.mrn}

SAFETY REVIEW
${activeFlags.length
  ? `  RED FLAGS PRESENT — ${emergent ? "EMERGENT" : "URGENT"}. Screening routing withheld.\n`
    + activeFlags.map(f => `  • ${f.text} — ${f.points}. ${f.action}.`).join("\n")
  : safetyReviewed
    ? "  Red-flag review completed; none present."
    : "  NOT YET REVIEWED — no routing issued. Complete the red-flag review before signing."}

SUBJECTIVE — captured symptoms
${posByDom.length ? posByDom.join("\n") : "  (none captured yet)"}
${ctxLine ? "\nContext: " + ctxLine + "." : ""}
${vmpCov.length ? "VM-PATHI domains additionally covered: " + vmpCov.join(", ") + "." : ""}

MASQUE SCREEN${scorable ? "" : " — INCOMPLETE, NO RESULT ISSUED"}
${scorable
  ? `  Index ${total}/100 — ${band.toUpperCase()} likelihood of a masked migrainous / neuropathic driver.`
  : `  Screen incomplete: ${coverage}% of scored items answered. Index bounded to ${floor}–${ceiling}/100, which spans more than one band.
  No likelihood band is reported. Unanswered items are NOT recorded as denials, and no rule-out is implied.`}
  Domains — ${DOMAIN_ORDER.map(k => `${ITEMS[k].label} ${domains[k].pts}/${domains[k].max}`).join(" · ")}
${gapAlert ? "  Diagnostic-gap pattern flagged (repeat visits + prior dismissal)." : ""}

${probeNotes.length ? `SUPPORTING FEATURES AND EXAM (recorded, not scored)
${probeNotes.map(x => "  - " + x).join("\n")}
  Not Barany criteria; contribute nothing to the index. Instrument v0.3 candidates.

` : ""}ASSESSMENT & PLAN
${activeFlags.length
  ? "  • Red flag present — evaluate on its own terms before treating this as a masked migrainous / neuropathic driver.\n"
    + activeFlags.map(f => `  • ${f.action} (${f.points}).`).join("\n")
  : !safetyReviewed
    ? "  • Safety review not recorded — no screening routing issued."
    : !scorable
      ? "  • Screen not scorable — complete the outstanding items before acting on this screen."
      : recs.length
        ? recs.map(r => `  • ${r.h}. ${r.p}${r.chips.length ? " [" + r.chips.join("; ") + "]" : ""}`).join("\n")
        : "  • No masked driver flagged; continue standard ENT management."}

Screening aid, not a diagnosis. Confirmatory instruments administered under license.`
  );
}

function buildBundle({ patient, answers, total, floor, ceiling, coverage, scorable, band, domains, complaint, note, activeFlags = [], emergent, routingCleared = true }) {
  const now = new Date().toISOString();
  const interp = { low:"L", moderate:"N", high:"H" }[band];
  const override = activeFlags.length > 0;
  const referral = routingCleared && scorable && band !== "low";
  const specialty = complaint === "otologic" ? "Neuro-otology" : "Headache medicine / Neurology";
  const entries = [];
  for (const f of activeFlags) {
    entries.push({ resource: { resourceType:"Flag", status:"active",
      category:[{coding:[{system:"http://terminology.hl7.org/CodeSystem/flag-category",code:"clinical"}]}],
      code:{coding:[{system:"http://masque.example/codes",code:f.id,display:f.points}],text:f.text},
      subject:{reference:`Patient/${patient.id}`}, period:{start:now} } });
  }
  entries.push({ resource: { resourceType:"QuestionnaireResponse", status: scorable ? "completed" : "in-progress",
    questionnaire:QUESTIONNAIRE_URL, subject:{reference:`Patient/${patient.id}`}, authored:now,
    // Item-level capture: asked-and-denied carries valueBoolean:false; never-asked
    // carries no answer element. Collapsing those into a zero is the same error as #1.
    item: DOMAIN_ORDER.map(k => ({ linkId:k, text:domains[k].label, answer:[{valueInteger:domains[k].pts}],
      item: ITEMS[k].items.map(it => {
        const v = answers?.[it.id];
        const node = { linkId: it.id, text: it.text };
        if (v === undefined) return node;
        node.answer = [ it.scale
          ? { valueCoding:{ system:"http://masque.example/answer", code:String(v), display: it.scale[v]?.label } }
          : { valueBoolean: v === "yes" } ];
        return node;
      }) })) } });
  entries.push({ resource: { resourceType:"Observation", status: scorable ? "final" : "preliminary",
    category:[{coding:[{system:"http://terminology.hl7.org/CodeSystem/observation-category",code:"survey"}]}],
    code:{coding:[{system:"http://masque.example/codes",code:"masque-index",display:"MASQUE migraine/neuropathy screen index"}]},
    subject:{reference:`Patient/${patient.id}`}, effectiveDateTime:now,
    // No value or interpretation until the band settles — a partial index reads
    // downstream as a completed negative screen.
    ...(scorable
      ? { valueQuantity:{value:total,unit:"score",system:"http://unitsofmeasure.org",code:"{score}"},
          interpretation:[{coding:[{system:"http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",code:interp,display:`${band} likelihood`}]}] }
      : { dataAbsentReason:{coding:[{system:"http://terminology.hl7.org/CodeSystem/data-absent-reason",code:"temp-unknown",display:"Temporarily Unknown"}]},
          note:[{text:`Screen incomplete (${coverage}% of items answered). Index bounded to ${floor}–${ceiling}/100, spanning more than one band. No result issued.`}] }),
    component:[
      ...DOMAIN_ORDER.map(k => ({
        code:{coding:[{system:"http://masque.example/codes",code:`domain-${k}`,display:domains[k].label}]},
        valueQuantity:{value:domains[k].pts,unit:"score",code:"{score}"} })),
      { code:{coding:[{system:"http://masque.example/codes",code:"screen-coverage",display:"Proportion of scored items answered"}]},
        valueQuantity:{value:coverage,unit:"%",system:"http://unitsofmeasure.org",code:"%"} },
      ...(scorable ? [] : [{
        code:{coding:[{system:"http://masque.example/codes",code:"attainable-range",display:"Attainable index range given unanswered items"}]},
        valueRange:{ low:{value:floor,unit:"score",code:"{score}"}, high:{value:ceiling,unit:"score",code:"{score}"} } }]),
    ] } });
  entries.push({ resource: { resourceType:"DocumentReference", status:"current",
    type:{text:"ENT encounter note — MASQUE ambient screen"}, subject:{reference:`Patient/${patient.id}`}, date:now,
    content:[{attachment:{contentType:"text/plain", title:"MASQUE encounter note (draft)"}}] } });
  if (override) entries.push({ resource: { resourceType:"ServiceRequest", status:"draft", intent:"proposal",
    priority: emergent ? "stat" : "urgent",
    code:{text:`Red-flag evaluation: ${activeFlags.map(f => f.action).join("; ")}`},
    subject:{reference:`Patient/${patient.id}`}, authoredOn:now,
    reasonCode:activeFlags.map(f => ({text:`${f.text} — ${f.points}`})) } });
  if (referral) entries.push({ resource: { resourceType:"ServiceRequest", status:"draft", intent:"proposal", priority:"routine",
    code:{text:`Referral: ${specialty} — evaluate for ${complaint==="otologic"?"vestibular migraine":"mid-facial / migrainous cause"}`},
    subject:{reference:`Patient/${patient.id}`}, authoredOn:now,
    reasonCode:[{text:`MASQUE index ${total}/100 (${band}); administer confirmatory instrument.`}] } });
  return { resourceType:"Bundle", type:"transaction", timestamp:now,
    entry: entries.map(e => ({ ...e, request:{ method:"POST", url:e.resource.resourceType } })) };
}
