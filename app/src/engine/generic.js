// engine/generic.js — engine defaults for the optional module families (design 03 §3.5, §4.13).
// Owner: WP3.
//
// A data-only rubric (logicBinding "generic") runs on GENERIC_LOGIC: no phenotypes, every
// domain active, no module routing (the engine gates plus one neutral fallback card), a
// patient summary that only quotes the module's own item wording, no probes, no referral.
// Nothing here invents clinical content: every default either rearranges the module's own
// text or is neutral engine chrome that names the module only as {name} and never names a
// condition, an item or a treatment (reviewed in Q10).
//
// Plain data and pure functions; no side effects. Imports only engine files.
import { CONTRACT_VERSION, FORMAT } from "./contract.js";

/**
 * The generic patient summary (§3.5). It carries no rules: `generic: true` tells the patient
 * engine to build `said` from the module itself, for each item in module order —
 *   answered "yes"           → the item's own locale question, verbatim;
 *   a scale answer v > 0     → `${q} — ${opts[v]}`;
 * where "v > 0" means an option that scores (f > 0): V13 only guarantees that SOME option has
 * f === 0, not that it is option 0, so the f === 0 options are what say nothing.
 * with `ask = []` and `gapLine = null`. The rule has a single implementation, genericSaid() in
 * patient.js (the Patient engine may import only evaluate/vocab/policy, and it alone builds `said`).
 */
export const GENERIC_SUMMARY = Object.freeze({
  generic: true,
  groups: Object.freeze({}),
  derived: Object.freeze({}),
  said: Object.freeze([]),
  ask: Object.freeze([]),
});

/** True for the generic summary (or a module without logic.patientSummary). */
export function isGenericSummary(ps) {
  return !ps || ps.generic === true;
}

/** The logic of a data-only rubric (§3.5). Deep-frozen. */
export const GENERIC_LOGIC = Object.freeze({
  format: FORMAT.logic,
  contractVersion: CONTRACT_VERSION,
  moduleId: "*generic",
  reads: Object.freeze({ items: Object.freeze({}) }),
  routing: Object.freeze([]),
  phenotypes: null,
  patientSummary: GENERIC_SUMMARY,
  locales: Object.freeze({}),
  probes: null,
});

/**
 * Neutral defaults for every rubric copy slot (§3.6). Rubric keys win (bind merges these
 * under rubric.copy). They name the module only as {name} and never name a condition.
 */
export const ENGINE_COPY_DEFAULTS = {
  indexName: "{name} index",
  gate: {
    patternPhrase: "presentation the {name} screen looks for",
  },
  screener: {
    title: "{name} Screener",
    subtitle: "Clinician screen built from the {name} module",
    bandSuffix: "on the {indexName}",
    gapAlert: {
      title: "Context markers flagged",
      body: "These context answers reached the module's alert threshold. Review them before interpreting the screen.",
    },
    disclaimer: "Screening aid, not a diagnosis. The items, weights and cut-points of this module have not been validated; the index is illustrative.",
    emrDetails: [
      "**Capture.** The clinician completes the screen; nothing is sent anywhere while answering.",
      "**Write-back.** Results can be written to the chart as FHIR resources, shown in the bundle above.",
      "**Codes.** The code systems in the generated files are placeholders and are illustrative.",
    ],
    specIntro: "These files are generated from the running module, so they describe the instrument this screen actually scores with.",
  },
  scribe: {
    title: "{name} Ambient Scribe",
    subtitle: "Ambient capture into the {name} screen",
    gapAlert: {
      title: "Context markers flagged",
      body: "These context answers reached the module's alert threshold.",
    },
    vmpathiDisclaimer: "",
    about: [
      "Captured statements fill the screen only where the module's lexicon matches them; the clinician confirms every answer.",
    ],
  },
  note: {
    title: "ENCOUNTER NOTE — {name} ambient screen (DRAFT)",
    screenHeading: "{name} SCREEN",
    likelihoodOf: "likelihood on the {indexName}",
    patternPhrase: "presentation the {name} screen looks for",
    infoCovered: "Additional prompts covered:",
    gapLine: "Context markers flagged.",
    supportingFooter: "Recorded, not scored; contribute nothing to the index.",
    noDriver: "No routing suggested by this module.",
    signOff: "Screening aid, not a diagnosis.",
  },
  cds: {
    preview: {
      safetyTitle: "{name}: red flag present — evaluate before screening routing",
    },
  },
};

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Screener steps for a rubric without steps.screener (§3.5):
 * [safety, one domain step per domain (rail {"0n", label}, card {"0n · label", label}), result].
 */
export function defaultScreenerSteps(rubric) {
  const domains = Array.isArray(rubric && rubric.domains) ? rubric.domains : [];
  const taken = new Set(["safety", "result"]);
  const steps = [{ key: "safety", kind: "safety", rail: { eyebrow: "00", title: "Safety check" } }];
  domains.forEach((d, i) => {
    const n = pad2(i + 1);
    const label = d && typeof d.label === "string" ? d.label : String(d && d.key);
    let key = d && typeof d.key === "string" ? d.key : `domain-${i + 1}`;
    if (taken.has(key)) key = `domain-${key}`;
    taken.add(key);
    steps.push({
      key, kind: "domain", domainKeys: [d && d.key],
      rail: { eyebrow: n, title: label },
      card: { eyebrow: `${n} · ${label}`, heading: label },
    });
  });
  steps.push({ key: "result", kind: "result", rail: { eyebrow: pad2(domains.length + 1), title: "Screen result" } });
  return steps;
}

/**
 * Patient steps for a rubric without steps.patient (§3.5): a "story" step carrying the
 * context questions (only when there are context items), then one step per domain.
 * Step titles come from locales.<loc>.steps when present, otherwise the domain labels.
 */
export function defaultPatientSteps(rubric) {
  const domains = Array.isArray(rubric && rubric.domains) ? rubric.domains : [];
  const steps = [];
  const taken = new Set();
  if (Array.isArray(rubric && rubric.contextItems) && rubric.contextItems.length) {
    steps.push({ key: "story", kind: "story", domainKeys: [], extras: ["context"] });
    taken.add("story");
  }
  domains.forEach((d, i) => {
    let key = d && typeof d.key === "string" ? d.key : `domain-${i + 1}`;
    if (taken.has(key)) key = `domain-${key}`;
    taken.add(key);
    steps.push({ key, kind: "domain", domainKeys: [d && d.key] });
  });
  return steps;
}

/** Demo patient when the rubric has none (§3.5); `{id}` is rendered by bindModule. */
export const DEFAULT_DEMO_PATIENT = {
  id: "{id}-demo", given: "Synthetic", family: "Patient", mrn: "SANDBOX-0000", synthetic: true,
};

/**
 * FHIR and CDS identity and strings when the rubric has none (§3.5). Bind merges these under
 * rubric.fhir / rubric.cds, renders {id}, {instrument} and {name}, and generates
 * fhir.questionnaireName from the id when the rubric has none. Every identity template
 * contains {id} (V9); the namespace is screenair.example, never a built-in's.
 */
export const DEFAULT_FHIR = {
  fhir: {
    questionnaireUrl: "http://screenair.example/{id}/Questionnaire/{id}-screener-v{instrument}",
    questionnaireTitle: "{name} screening questionnaire",
    publisher: "Module author (not stated)",
    description: "Screening item set generated by screenAIr from the {name} module. Not a validated instrument; item weights are illustrative.",
    safetyGroupText: "Red flags — evaluated before screening; not scored",
    codeSystem: "http://screenair.example/{id}/codes",
    answerSystem: "http://screenair.example/{id}/answer",
    criteriaSystem: "http://screenair.example/{id}/criteria",
    weightExtension: "http://screenair.example/{id}/StructureDefinition/item-weight",
    indexCode: "{id}-index",
    indexDisplay: "{name} index",
    documentType: "Encounter note — {name} screen",
    documentTitle: "{name} encounter note (draft)",
    screenIdPrefix: "{id}-",
    filePrefix: "{id}",
  },
  cds: {
    serviceId: "{id}-screen",
    hook: "order-select",
    title: "{name} screen",
    description: "Surfaces the {name} index, or a safety card when a red flag is recorded.",
    source: { label: "{name} (screenAIr module)", url: "http://screenair.example/{id}" },
    safetyCardUuid: "{id}-safety",
    indexCardUuid: "{id}-index",
    examples: {
      redFlagPresent: { flagId: null, summary: "Red flag present — evaluate before screening routing" },
    },
  },
};
