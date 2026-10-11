// engine/contract.js — the module contract: constants and JSDoc typedefs (design 03 §3, §4.2).
//
// This is the only shared interface definition of screenAIr. An interface change goes
// through a change to this file that names every affected work package (design §9.0).
// Plain data, no imports, no side effects. No string here names a module, its ids or its
// brand (t-ids, design §4.1).

/** Contract version a rubric and a logic file must declare (`contractVersion`). */
export const CONTRACT_VERSION = 1;

/** `format` values of every screenAIr file kind. */
export const FORMAT = {
  rubric: "screenair-rubric",
  logic: "screenair-logic",
  module: "screenair-module",
  export: "screenair-export",
  registry: "screenair-registry",
};

/** Locales accepted in contract 1. Adding one means PATIENT_CHROME and CAVEATS entries too. */
export const SUPPORTED_LOCALES = ["en", "es"];

/**
 * The closure whitelist (design §3.1, validator V40). A function value is allowed in a logic
 * object only at these paths; the rubric may contain no function at all (V4).
 *
 * Glob syntax: `.` separates keys; `[]` is any array index; `*` is any one object key;
 * `**` is any depth (one or more further keys or indices).
 */
export const LOGIC_PATHS = [
  "phenotypes.derive[].when",
  "phenotypes.activation[].when",
  "routing[].when",
  "routing[].copy.screener.h",
  "routing[].copy.screener.p",
  "routing[].copy.screener.chips",
  "routing[].copy.scribe.h",
  "routing[].copy.scribe.p",
  "routing[].copy.scribe.chips",
  "patientSummary.derived.*",
  "patientSummary.said[].when",
  "patientSummary.said[].text",
  "patientSummary.ask[].when",
  "patientSummary.ask[].text",
  "locales.*.sum.**",
  "probes.list[].when",
];

/**
 * Rubric fields that are identity templates over `{id}` and `{instrument}` (design §3.10, V9).
 * Every value must contain `{id}`; `fhir.questionnaireUrl` must also contain `{instrument}`.
 */
export const IDENTITY_TEMPLATE_FIELDS = [
  "fhir.questionnaireUrl", "fhir.codeSystem", "fhir.answerSystem", "fhir.criteriaSystem",
  "fhir.weightExtension", "fhir.indexCode", "fhir.screenIdPrefix", "fhir.filePrefix",
  "cds.serviceId", "cds.safetyCardUuid", "cds.indexCardUuid", "cds.source.url",
];

/** Fields whose reuse makes an upload kin to a built-in (design §3.11 row 5). */
export const KIN_FIELDS = [
  "name", "fhir.questionnaireName", "fhir.questionnaireTitle", "fhir.publisher", "cds.title", "cds.source.label",
];

/** Top-level rubric keys (validator V3 warns on any other key). */
export const RUBRIC_KEYS = {
  required: [
    "format", "contractVersion", "id", "label", "name", "instrumentVersion", "logicBinding",
    "domains", "bands", "redFlags", "changelog",
  ],
  optional: [
    "icon", "contextItems", "gapRule", "steps", "phenotypes", "infoPrompts", "sampleCases", "demo",
    "lexicon", "defaultLocale", "locales", "research", "fhir", "cds", "copy", "emrTemplate", "provenance",
  ],
};

/** Placeholders allowed in every copy slot (design §3.6). */
export const GLOBAL_PLACEHOLDERS = ["name", "id", "instrument", "scaleMax", "indexName"];

/**
 * The rubric copy slots (design §3.6) and the placeholders each one allows IN ADDITION to
 * GLOBAL_PLACEHOLDERS (validator V39: any other `{placeholder}` is an error). Keys ending in a
 * list (`screener.emrDetails`, `scribe.about`) apply to every entry of the array.
 * `locales.en.ui.clinicianLede` lives in the locale data, not under `copy`, but obeys the
 * same rule.
 */
export const COPY_SLOTS = {
  "indexName": [],
  "gate.patternPhrase": [],
  "screener.title": [],
  "screener.subtitle": [],
  "screener.bandSuffix": [],
  "screener.gapAlert.title": [],
  "screener.gapAlert.body": [],
  "screener.disclaimer": [],
  "screener.emrDetails": [],
  "screener.specIntro": [],
  "scribe.title": [],
  "scribe.subtitle": [],
  "scribe.gapAlert.title": [],
  "scribe.gapAlert.body": [],
  "scribe.vmpathiDisclaimer": [],
  "scribe.about": [],
  "note.title": [],
  "note.screenHeading": [],
  "note.likelihoodOf": [],
  "note.patternPhrase": [],
  "note.infoCovered": [],
  "note.gapLine": [],
  "note.supportingFooter": [],
  "note.noDriver": [],
  "note.signOff": [],
  "cds.preview.safetyTitle": [],
  "cds.preview.indexTitle": ["cdsTerm"],
  "cds.preview.indexBody": ["total", "scaleMax", "bandLabel"],
  "locales.en.ui.clinicianLede": [],
};

/** Upper bound of lexicon.scale[i].carry (following patient replies that may supply a value). */
export const LEXICON_CARRY_MAX = 3;
/**
 * The pending slot of extractInContext (engine/extraction.js, which declares the same shape): at
 * most one, for a scale entry with heard: true and carry. A normal slot lets the next turnsLeft
 * patient replies supply the entry's value. yieldOnly: true (design 05, round 3b) marks a yield-only
 * slot: armed by an utterance that states the entry's band but whose value is withheld, or turned
 * from a normal slot by such an utterance; each such utterance renews its window to the entry's
 * full carry (round 3c). It still counts as pending for yieldTo and is validated, consumed and
 * expired like any slot, but no value is ever carried into it. A line that withholds its entry's
 * value also ends a normal slot of another entry, unless that entry is withheld on the same line too
 * (round 3d, design 05 §13.12), so no later reply is carried into that entry. That holds when no cue
 * on the line awaits a value: rules 1 and 2 of the "Slots" header decide first, so that entry's cue
 * heard again with no band re-opens its normal slot (follow-up F-3D-1). Absent or false: the
 * slot may carry. A yieldOnly that is present and not a boolean makes the slot invalid (dropped).
 * The arming precedence is the "Slots" section of engine/extraction.js.
 * @typedef {{id:string, cue:string, cueText:string, evidence:string, cueIndex:number, turnsLeft:number, yieldOnly?:boolean}} PendingCue
 */
/** Keys a lexicon scale entry may carry (validator V28 warns on any other). */
export const LEXICON_SCALE_KEYS = ["id", "cue", "bands", "fallback", "heard", "carry", "yieldTo", "anchor", "carryExclude"];
/**
 * Keys of lexicon.normalize and the values each accepts (validator V28 rejects any other key or
 * value). apostrophes: true folds typographic apostrophes to "'" before matching; numbers: "en"
 * spells standalone small integers as English words before band phrase matching only (scale bands,
 * direct and carried; needs an English lang). Every other phrase family and every gate window runs
 * on the apostrophe-folded text, so digits typed there are matched as digits.
 */
export const LEXICON_NORMALIZE_KEYS = ["apostrophes", "numbers"];

// ---------------------------------------------------------------------------------------
// Rubric (JSON layer, design §3.2). R = required, O = optional; §3.5 gives the engine
// behaviour for an absent optional field.
// ---------------------------------------------------------------------------------------

/**
 * @typedef {Object} Rubric
 * @property {"screenair-rubric"} format        R
 * @property {1} contractVersion                 R
 * @property {string} id                         R /^[a-z][a-z0-9-]{1,47}$/, not ending in "-". Module id: cohort `module_id`,
 *                                                 `{id}` in identity templates (a host name label in the systems), file names,
 *                                                 modelVersion. A non-built-in id may not equal a built-in id or start with
 *                                                 "<built-in id>-" (V8, §3.10).
 * @property {string} label                      R Dropdown and page-title text only. Never in any identifier (V7). A non-built-in
 *                                                 label may not equal a built-in label (V8).
 * @property {string} name                       R Display name used by copy and engine chrome via {name}.
 * @property {string} [icon]                     O lucide icon name; default "Stethoscope". Unknown → warning, falls back to "Info".
 * @property {string} instrumentVersion          R Instrument axis. Questionnaire.version, {instrument}, cohort `instrument_version`.
 * @property {"generic"|{moduleId:string, logicSha256?:string}} logicBinding  R (§3.9)
 * @property {Domain[]} domains                  R ordered; the order is the domain order everywhere
 * @property {{cuts:{moderate:number, high:number}}} bands  R integers, 0 < moderate < high ≤ scaleMax
 * @property {ContextItem[]} [contextItems]      O
 * @property {{threshold:number, markers:string[], noteOrder?:string[]}} [gapRule]  O markers = context ids in the positional
 *                                                 order the logic's sum.gap expects; noteOrder = Scribe note order
 * @property {RedFlag[]} redFlags                R ≥ 1
 * @property {{screener?:ScreenerStep[], patient?:PatientStep[]}} [steps]  O
 * @property {PhenotypeData} [phenotypes]        O
 * @property {{gateDomain:string, tagPrefix:string, maxScored:number, maxTotal:number,
 *             prompts:Array<{id:string, tag:string, ask:string}>}} [infoPrompts]  O
 * @property {SampleCase[]} [sampleCases]        O
 * @property {{patient?:DemoPatient, transcript?:Array<["md"|"pt", string]>}} [demo]  O
 * @property {Lexicon} [lexicon]                 O
 * @property {string} [defaultLocale]            O "en" (the only value accepted in contract 1)
 * @property {Object<string, LocaleData>} [locales]  O patient-facing wording; keys ⊆ SUPPORTED_LOCALES
 * @property {Research} [research]               O
 * @property {FhirData} [fhir]                   O
 * @property {CdsData} [cds]                     O
 * @property {Copy} [copy]                       O
 * @property {EmrTemplate} [emrTemplate]         O clinician-only consult-note data (release 0.4.3, V61); never patient-facing
 * @property {Provenance} [provenance]           O (required when the module is derived)
 * @property {ChangelogEntry[]} changelog        R (may be [])
 */

/**
 * The EMR friendly consult-note data of a module (release 0.4.3, validator V61). Read only by
 * engine/emr.js on the clinician surfaces; locked in the Rubric Editor. Every id-bearing rule of
 * the template lives here, never in the engine. No string may carry "[", "]", "{" or "}": square
 * brackets are the engine's placeholders. A module without it gets the engine's neutral template
 * (placeholders, screen result, red-flag actions and routing recs; no references, no checklist).
 * @typedef {Object} EmrTemplate
 * @property {Object<string, EmrCitation>} [citations]   key /^[A-Z0-9][A-Za-z0-9-]*$/ → citation metadata; every key is used
 * @property {EmrReference[]} [references]       printed where the referral gate opens and, under an open red flag (release
 *                                                 0.4.6), where it would open with the flags removed, under the screen-based
 *                                                 heading (the FHIR bundle withholds the referral; it never carries references)
 * @property {string[]} [instrumentRecs]         routing rule ids whose fixed chips are all instruments ("Instruments: a; b");
 *                                                 a listed rule may not compute its chips on any surface (V61); other fixed
 *                                                 chips print as "Named on screen: a; b", computed chips never
 * @property {Object<string, string[]>} [redFlagRefs]  red-flag id → citation keys ("Ref:" lines under its action)
 * @property {Object<string, string>} [redFlagPlaceholders]  red-flag id → a placeholder the engine brackets under its action
 * @property {Array<{item:string, qualifier?:string}|{label:string, probe?:string}>} [history]  treatment and workup
 *                                                 to date: an item's own wording and its recorded state (qualifier follows
 *                                                 a negative answer no probe wrote), or a placeholder heading (a probe's
 *                                                 recorded answer follows it, labelled as recorded); no citations (V61)
 * @property {EmrChecklistRow[]} [checklist]     management not yet offered; never ticked from missing data
 * @property {Array<{label:string, citations?:string[], probe?:string, optionPlaceholders?:Array<{option:number, placeholder:string}>}>} [examRows]
 *                                                 placeholders; a probe's recorded answer is shown as recorded by the
 *                                                 clinician (an exam-kind probe only); optionPlaceholders (release 0.4.6):
 *                                                 a placeholder the engine brackets under the row when the probe was
 *                                                 answered with that option (one per option, a row with a probe only)
 * @property {Array<{item:string, group:("medical"|"family")}|{label:string, group:("medical"|"family")}>} [pastHistory]
 *                                                 release 0.4.6: past-history rows, an item's own wording and its
 *                                                 recorded state or a placeholder heading; "medical" after the pregnancy
 *                                                 line, "family" before the family-history placeholder (which then reads
 *                                                 "Other family history"); an item listed here leaves the review of
 *                                                 systems and may not also be a history row (V61)
 */
/** @typedef {{title:string, publisher:string, citation:string, url:string, accessed:string}} EmrCitation  url https, accessed YYYY-MM-DD */
/**
 * Either a reference line (label + its citations) or a note line (note + "Ref:" citations).
 * showFor.phenotypes limits it to those complaints (phenotype values).
 * @typedef {{label?:string, note?:string, citations:string[], showFor?:{phenotypes:string[]}}} EmrReference
 */
/**
 * render: "done" ticks the row ([x], recorded on screen; a probe, or an item answer a Scribe probe
 * wrote: recorded by clinician via probe), "answeredNo" adds "screen answered no" (probe: "recorded
 * by clinician via probe, answered no"), "note" adds context only, "neverTried" (a probe signal
 * only) reads "patient reports never tried". An item signal's render matches its answer's polarity:
 * done and note a positive answer, answeredNo a negative one (V61). qualifier is added to the
 * signal's source in parentheses; placeholder is printed in square brackets after the row; box
 * false prints a status line without a box; onlyWithSignal true prints the row only when one of
 * its signals holds. Each printed row names its own sources by number; the exam rows and the
 * checklist share one numbered list, printed once after the plan (review round 3).
 * @typedef {{id:string, group:string, label:string, citations:string[], placeholder?:string, box?:boolean, onlyWithSignal?:boolean,
 *            signals?:Array<{item:string, value:(string|number), render:string, qualifier?:string}|
 *                           {probe:string, option:number, render:string, qualifier?:string}>}} EmrChecklistRow
 */

/**
 * @typedef {Object} Domain
 * @property {string} key                        R /^[a-z][a-z0-9_]*$/. FHIR group linkId and `domain-{key}` code.
 * @property {string} label                      R clinician label
 * @property {number} max                        R declared max; Σ item w must equal it (V15); negative for a negative domain
 * @property {boolean} [negative]                O
 * @property {string} [shortTag]                 O Scribe suggestion tag when the item has no tag (default label.toLowerCase())
 * @property {Item[]} items                      R ≥ 1, instrument order
 */

/**
 * @typedef {Object} Item
 * @property {string} id                         R unique across items, context items, flags and info prompts
 * @property {number} w                          R ≠ 0; sign must match the domain
 * @property {string} text                       R clinician text (Questionnaire item text, Screener question, chips)
 * @property {string} [short]                    O Scribe short label (capture tags, note lines, "re-asking"). Absent → the id.
 * @property {string} [ask]                      O physician phrasing for Scribe suggestions. Absent → text.
 * @property {string} [tag]                      O full tag string ("<instrument> · <domain>")
 * @property {string} [ref]                      O criterion code, emitted to fhir.criteriaSystem
 * @property {Array<{label:string, f:number}>} [scale]  O present ⇒ choice item (answer = option index); absent ⇒ "yes"/"no"
 * @property {string} [patientClin]              O clinical line in the patient summary's "For my clinician" block. Absent → text.
 */

/**
 * Unscored; not in the Questionnaire; not a cohort column.
 * @typedef {Object} ContextItem
 * @property {string} id                         R
 * @property {string} text                       R clinician question
 * @property {Array<[string,string]>} options    R [[value,label]], the Screener vocabulary
 * @property {string} [captureLabel]             O Scribe capture-tag text for any captured value
 * @property {{value:string, screenerLabel:string, scribeLabel:string, noteLabel:string}} [signal]  O gap-rule marker
 */

/**
 * Clinician wording only; patient wording lives in locales. Validator V22: a flag has no
 * w / weight / f / scale / score key.
 * @typedef {Object} RedFlag
 * @property {string} id                         R
 * @property {"emergent"|"urgent"} tier          R
 * @property {string} group                      R order of first appearance = display order
 * @property {string} text                       R
 * @property {string} points                     R clinician only; never reaches the patient projection
 * @property {string} action                     R clinician only
 * @property {string} [ask]                      O kept as data, unread (Q6)
 */

/**
 * Safety first and result last, exactly one of each (V25).
 * @typedef {Object} ScreenerStep
 * @property {string} key                        R
 * @property {"safety"|"domain"|"result"} kind   R
 * @property {string[]} [domainKeys]             O rendered in order (domain kind only)
 * @property {Array<"complaintPicker"|"context">} [extras]  O fixed render order: picker → domains → context
 * @property {"complaint"} [requires]            O Next is disabled until a complaint is picked
 * @property {{eyebrow:string, title:string}} rail  R
 * @property {{eyebrow:string, heading:string, sub?:string}} [card]  O
 * @property {Object<string,string>} [domainIntro]  O domain key → intro line
 */

/**
 * Between the shell-fixed intro+safety and summary sections.
 * @typedef {Object} PatientStep
 * @property {string} key                        R
 * @property {"story"|"domain"} kind             R
 * @property {string[]} domainKeys               R
 * @property {Array<"context">} [extras]         O
 */

/**
 * @typedef {Object} PhenotypeData
 * @property {Array<{value:string, h:string, d:string}>} values  R picker order
 * @property {string} scribeDefault              R value when no derive rule fires
 * @property {string[]} [alwaysActive]           O domains always in the Scribe pool; default all domains
 * @property {string} [tagBoostDomain]           O items with a tag rank first while this domain is active
 * @property {{byPhenotype:Object<string,{specialty:string, reason:string}>, default:{specialty:string, reason:string},
 *            clinicianRules?:ClinicianRule[]}} [referral]  O  clinicianRules: release 0.4.5 (V27)
 * @property {{byPhenotype:Object<string,string>, default:string}} [cdsTerm]  O
 */

/**
 * A clinician rule of the referral table (release 0.4.5; engine/emr.js, V27): text a clinician
 * applies, printed in the EMR template's plan right above the recommendations whenever it prints a
 * referral line or the clinician placeholder for a phenotype value the rule names: "Referral rule
 * (<source>): <rule>", "Definition (<source>):" and the definition lines, "Clarification
 * (<clarificationSource>):" and the clarification lines, and "<confirm>: [ ]" for each condition
 * the clinician confirms. The engine never acts on it: the referral stays byPhenotype / default.
 * No string carries [ ] { }. A rule or definition needs its source, a clarification its own.
 * @typedef {Object} ClinicianRule
 * @property {string[]} phenotypes               R non-empty, distinct phenotype values
 * @property {string} [source]                   O who stated the rule and definition, and when; R with rule or definition
 * @property {string} [rule]                     O the rule, verbatim
 * @property {string[]} [definition]             O definition lines, verbatim
 * @property {string} [clarificationSource]      O who stated the clarification, and when; R with clarification
 * @property {string[]} [clarification]          O clarification lines, verbatim
 * @property {string[]} [confirm]                O the conditions a clinician confirms (each a [ ] placeholder)
 */

/**
 * @typedef {Object} SampleCase
 * @property {string} id                         R
 * @property {string} label                      R
 * @property {string} buttonLabel                R
 * @property {"sample"|"scenario"} [group]       O rail group (default "sample")
 * @property {string} [icon]                     O
 * @property {string} [why]                      O → button title
 * @property {string} [complaint]                O "" or a phenotype value
 * @property {Object<string,string>} [ctx]       O Screener vocabulary
 * @property {Object<string,true>} [rf]          O
 * @property {Object<string,("yes"|"no"|number)>} a  R never "unsure" (V49)
 * @property {boolean} [safetyReviewed]          O default true
 */

/**
 * V50: never a dob/birthDate key.
 * @typedef {{id:string, given:string, family:string, sex?:string, gender?:string, age?:number, mrn:string, synthetic:true}} DemoPatient
 */

/**
 * Keys renamed only from the baseline extractor constants.
 * @typedef {Object} Lexicon
 * @property {string} version                    R lexicon axis
 * @property {string} [lang]                     O BCP-47 tag for voice capture; default "en-US"
 * @property {{window:number, cues:string[]}} negation    R
 * @property {{window:number, cues:string[]}} thirdParty  R
 * @property {{window:number, cues:string[]}} historical  R
 * @property {Array<{id:string, ph:string[], thirdPartyExempt?:true}>} bool  R
 * @property {Array<{id:string, val:string, ph:string[]}>} ctx  R
 * @property {Array<{id:string, cue:string[], bands:Array<{ph:string[], v:number}>, fallback:(number|null),
 *             heard?:true, carry?:number, yieldTo?:string[], anchor?:string[], carryExclude?:string[]}>} scale  R
 *                                                 keys ⊆ LEXICON_SCALE_KEYS (V28 warns on any other). All five
 *                                                 additions are optional, per entry, and inert when absent:
 *                                                 heard   F1: true shows the cue when it is heard without a value
 *                                                         (no band matched, no fallback); a heard cue never sets an
 *                                                         answer. Needs fallback null (V28 warns otherwise).
 *                                                         heard: true also changes the scored value of this entry
 *                                                         in the cue's own utterance (design 05, round 3, R9):
 *                                                         every band phrase hit is collected (on the number-
 *                                                         normalised view; carryExclude phrases only in the cue's
 *                                                         sentence) and hits contained in a longer hit are
 *                                                         dropped. Then any hit negated within the negation
 *                                                         window, any carryRefuse phrase in the utterance, or two
 *                                                         or more distinct band values → no value: the cue is shown
 *                                                         heard but does NOT arm carry-over. Exactly one value →
 *                                                         that value. No hit at all → heard, and carry-over may
 *                                                         arm. Without heard the first band, in array order, with
 *                                                         any hit wins (unchanged).
 *                                                 carry   F2: integer 1..LEXICON_CARRY_MAX, needs heard: true; that
 *                                                         many following patient replies may supply the value from
 *                                                         a band of this entry. Never on an entry with a band that
 *                                                         records an f = 0 option (V28).
 *                                                 yieldTo F4: ids of other scale or bool entries; the entry captures
 *                                                         nothing (no value, no heard) in an utterance where one of
 *                                                         them is present (any of its phrases, negated or not) or
 *                                                         pending, unless an anchor phrase occurs unnegated. No
 *                                                         self-reference, duplicate or cycle (V28).
 *                                                 anchor  F4: phrases that keep the entry capturing despite yieldTo;
 *                                                         only meaningful with yieldTo (V28); lowercase (V29).
 *                                                 carryExclude F2: band phrases of this entry that never supply a
 *                                                         carried value. In the cue's own utterance one supplies
 *                                                         a value only in a cue sentence, one holding a cue hit
 *                                                         that is not negated and passes the attribution and
 *                                                         history gates (sentences end at . ! ? or ; followed by
 *                                                         whitespace or the end of the text); elsewhere it still
 *                                                         counts for the negation and disagreement tests and as
 *                                                         a stated band. In a carried reply it is still
 *                                                         collected, so it can make the
 *                                                         reply negated or ambiguous, and a reply whose only hits
 *                                                         are excluded phrases is refused. Needs carry on the
 *                                                         entry; each a non-empty lowercase string found verbatim
 *                                                         in one of the entry's band phrase lists; no duplicates
 *                                                         (V28).
 * @property {Array<{ids:Array<{id:string, value:(string|number), kind:("item"|"ctx")}>, ph:string[]}>} multi  R
 * @property {Object<string,string[]>} redFlags  R keys === flag ids, both ways, and every list non-empty (V28)
 * @property {string[]} [carryRefuse]            O phrases that withhold a band value (F2). In a carried reply one refuses
 *                                                 the carry. In the own utterance of a scale entry with heard:
 *                                                 true it withholds that entry's band value, and no carry-over
 *                                                 opens from that utterance. It can only prevent a capture,
 *                                                 never cause one: where it withholds a value nothing is armed,
 *                                                 where no band phrase matched it changes nothing, and it never
 *                                                 opens a carry-over window itself (a refused reply only uses
 *                                                 up one reply of a window an earlier utterance opened, like any
 *                                                 other refused reply). Non-empty when present; warned when no
 *                                                 scale entry has heard: true or carry (V28).
 * @property {{apostrophes?:boolean, numbers?:"en"}} [normalize]  O text normalization before matching; absent = none
 *                                                 (keys ⊆ LEXICON_NORMALIZE_KEYS, V28). apostrophes: true folds
 *                                                 U+2018, U+2019, U+02BC and U+2032 to "'" (same length). numbers:
 *                                                 "en" rewrites standalone integers 0–20 and the round tens 30–90 as
 *                                                 English words for band phrase matching only (scale bands, direct
 *                                                 and carried); cues, bool, ctx, multi, red flags, anchors,
 *                                                 carryRefuse and every gate window run on the apostrophe-folded
 *                                                 text. Needs lang "en" or "en-…" (absent lang = "en-US").
 *                                                 Reported indices stay in original-text coordinates.
 * @property {({version:string, lexiconVersion:string, file?:string}|null)} goldSet  R for built-ins; O otherwise (a lexicon
 *                                                 created in the editor has none: footer "gold set — (not benchmarked)")
 */

/**
 * @typedef {Object} LocaleData
 * @property {boolean} reviewed                  R en true, es false; forced false on edit and while `stale` is non-empty (V55)
 * @property {boolean} [editedLocally]           O set by derive (§3.11)
 * @property {string[]} [stale]                  O JSON paths whose English source changed after this translation (§3.11)
 * @property {Object<string,{q:string, opts?:string[], ask?:string, help?:string, clin?:string}>} items  R when the Patient tab is wanted;
 *                                                 clin (release 0.4.2) O, translations only: the item's clinician line
 *                                                 in this language for the patient summary ("For my clinician"); absent →
 *                                                 the item's patientClin (English). Never in en (V32); V60 applies
 * @property {Object<string,{q:string, say:string}>} redFlags  R when items is present
 * @property {Object<string,{q:string, opts:Array<[string,string]>}>} [contextItems]  O the Patient's own value vocabulary
 * @property {Object<string,{title?:string, heading?:string, lede?:string, intro?:string}>} [steps]  O keyed by patient step key
 * @property {{sub?:string, forYouIf?:string[], clinicianLede?:string}} [ui]  O
 */

/**
 * Consumed only by the Research tab.
 * @typedef {Object} Research
 * @property {string} projectKey                 R
 * @property {string} title                      R
 * @property {string} target                     R
 * @property {number} threshold                  R
 * @property {{midpoint:number, slope:number, appliesTo:{scoringHash:string}}} calibration  R
 * @property {Array<[string,string]>} sources    R
 * @property {string[]} expected                 R
 * @property {Object[]} demo                     R rows, verbatim
 * @property {string[]} scoreAliases             R
 * @property {string} artifactKey                R
 * @property {string} etlScript                  R
 * @property {string[]} fairnessAxes             R
 * @property {{selectionGapTolerance?:number, sensitivityGapTolerance?:number, specificityGapTolerance?:number,
 *             toleranceSetBy:string, toleranceRationale:string, toleranceSetOn:string}} [fairnessPolicyOverride]  O
 * @property {Array<{id:string, label:string, why:string, spec:CohortSpec}>} [demoCohorts]  O
 * @property {{index:string, schema:string, map:string}} [population]  O paths relative to app/ (resolved against
 *                                                 env.appBase), under ./data/ or ./etl/; only on a built-in or a verified
 *                                                 derivation of one (V37, V54)
 */

/**
 * @typedef {{seed:number, prevalence:number, hi:{pos:[number,number], neg:[number,number]},
 *            lo:{pos:[number,number], neg:[number,number]},
 *            groups:Array<{sex:string, gender:string, n:number, hi:boolean, labeled:boolean}>,
 *            extraRows?:Object[]}} CohortSpec
 */

/**
 * Every IDENTITY_TEMPLATE_FIELDS value, the systems included, contains {id} (V9).
 * @typedef {Object} FhirData
 * @property {string} questionnaireUrl           template with {id} and {instrument}
 * @property {string} questionnaireName
 * @property {string} questionnaireTitle
 * @property {string} publisher
 * @property {string} description
 * @property {string} safetyGroupText
 * @property {string} codeSystem                 template with {id}
 * @property {string} answerSystem               template with {id}
 * @property {string} criteriaSystem             template with {id}
 * @property {string} weightExtension            template with {id}
 * @property {string} indexCode                  "{id}-index"
 * @property {string} indexDisplay
 * @property {string} documentType
 * @property {string} documentTitle
 * @property {string} screenIdPrefix             "{id}-"
 * @property {string} filePrefix                 "{id}"
 */

/**
 * @typedef {Object} CdsData
 * @property {string} serviceId                  "{id}-screen"
 * @property {string} hook
 * @property {string} title
 * @property {string} description
 * @property {{label:string, url:string}} source   url is a template containing {id}
 * @property {string} safetyCardUuid             "{id}-safety"
 * @property {string} indexCardUuid              "{id}-index"
 * @property {{redFlagPresent:{flagId:string, summary:string},
 *             settled?:{score:number, band:("moderate"|"high"), summary:string, detail:string}}} examples
 * @property {{safetyTitle:string, indexTitle:string, indexBody:string}} [preview]
 */

/**
 * The rubric copy slots (design §3.6). Every key is optional and falls back to
 * ENGINE_COPY_DEFAULTS; COPY_SLOTS lists the placeholders each allows.
 * @typedef {Object} Copy
 * @property {string} [indexName]
 * @property {{patternPhrase?:string}} [gate]
 * @property {{title?:string, subtitle?:string, bandSuffix?:string, gapAlert?:{title?:string, body?:string},
 *             disclaimer?:string, emrDetails?:string[], specIntro?:string}} [screener]
 * @property {{title?:string, subtitle?:string, gapAlert?:{title?:string, body?:string}, vmpathiDisclaimer?:string,
 *             about?:string[]}} [scribe]
 * @property {{title?:string, screenHeading?:string, likelihoodOf?:string, patternPhrase?:string, infoCovered?:string,
 *             gapLine?:string, supportingFooter?:string, noDriver?:string, signOff?:string}} [note]
 * @property {{preview?:{safetyTitle?:string, indexTitle?:string, indexBody?:string}}} [cds]
 */

/**
 * Written only by deriveRubric (§3.11); verified on every load, never trusted.
 * @typedef {Object} Provenance
 * @property {AncestorRecord} root               the first module of the lineage (a built-in for a built-in's derivations)
 * @property {AncestorRecord} derivedFrom        the immediate parent (equal to root for a first-generation derivation)
 * @property {AncestorRecord[]} lineage          root first … immediate parent last (V52)
 * @property {string} contentHash                SHA-256 of canonicalJson(rubric without `provenance`), taken at Apply
 * @property {string} createdAt                  ISO date of Apply
 * @property {{name:string, sha256:string}} [source]   the uploaded file a "Load as derived" started from
 */

/**
 * @typedef {{moduleId:string, label:string, origin:("builtin"|"uploaded"|"derived"), instrumentVersion:string,
 *            lexiconVersion:(string|null), rubricSha256:string, logicSha256:(string|null),
 *            instrumentHash:string, scoringHash:string, lexiconHash:(string|null)}} AncestorRecord
 */

/**
 * `acknowledged` = JSON pointers confirmed in the Apply dialog (§5.7).
 * @typedef {{date:string, kind:("reconciliation"|"extraction"|"derived"|"note"|"lexicon"|"translation"|"emr-template"|"sign-off"|"referral"|"emr-decisions"), note:string,
 *            author?:string, paths?:string[], axes?:Object<string,[string,string]>,
 *            acknowledged?:string[]}} ChangelogEntry
 */

// ---------------------------------------------------------------------------------------
// Logic (JS layer, design §3.3)
// ---------------------------------------------------------------------------------------

/**
 * `export default` of <id>.logic.js. Imports nothing; functions only at LOGIC_PATHS.
 * @typedef {Object} Logic
 * @property {"screenair-logic"} format          R
 * @property {1} contractVersion                  R
 * @property {string} moduleId                    R must equal rubric.logicBinding.moduleId
 * @property {string} [logicVersion]              O informational; not a version axis (the logic SHA-256 identifies it)
 * @property {Reads} reads                        R
 * @property {{derive?:Array<{value:string, when:function(PhenotypeState):boolean}>,
 *             activation?:Array<{id:string, domains:string[], when:function(ActivationState):boolean}>}} [phenotypes]
 * @property {RoutingRule[]} [routing]            ordered; evaluated only after the engine gates (§4.5)
 * @property {{groups:Object<string,string[]>, derived:Object<string,function(PatientState):*>,
 *             said:SummaryRule[], ask:SummaryRule[]}} [patientSummary]   last ask rule has no `when` (V43)
 * @property {Object<string,{sum:Object}>} [locales]   SUM[loc] verbatim: strings, arrays, word maps and template functions
 * @property {{version:string, list:Probe[]}} [probes]  probe-set axis + the verbatim probe list
 */

/**
 * What the closures depend on; checked against the rubric (V41) and for completeness (V47).
 * @typedef {Object} Reads
 * @property {Object<string, ("boolean"|{scale:number})>} items   every item id any closure or probe reads/writes, with type
 *                                                 and exact option count
 * @property {Object<string, {negative?:boolean}>} [domains]    domain keys read via s.domains / s.items
 * @property {string[]} [redFlags]                flag ids read by closures or written by probe options
 * @property {string[]} [phenotypes]              phenotype values compared by closures
 * @property {Object<string,string[]>} [context]  context ids and values read by closures
 * @property {string[]} [gapMarkers]              exact order sum.gap expects its positional booleans; = rubric.gapRule.markers
 */

/**
 * @typedef {Object} RoutingRule
 * @property {string} id                          R unique
 * @property {function(RoutingState):boolean} [when]   O absent = always (only meaningful with fallback)
 * @property {true} [fallback]                    O emitted on a surface only if no non-fallback rule fired there
 * @property {{screener?:RecCopy, scribe?:RecCopy}} copy   R; a missing surface key = rule not shown on that surface
 */

/**
 * @typedef {{h:(string|function(RoutingState):string), p:(string|function(RoutingState):string),
 *            chips:(string[]|function(RoutingState):string[])}} RecCopy
 */

/** @typedef {{id:string, when?:function(PatientState):boolean, text:function(PatientState):string}} SummaryRule */

/**
 * Probe shape of the baseline probe file, unchanged. `when` receives frozen copies.
 * @typedef {{id:string, kind:string, when:function(Object, Object):boolean, target?:string, rescues?:string,
 *            say:string, why:string, opts:Array<{l:string, rf?:string, a?:Object, note?:string}>}} Probe
 */

// ---------------------------------------------------------------------------------------
// States handed to closures (design §3.3). Built fresh by the engine and deep-frozen.
// ---------------------------------------------------------------------------------------

/**
 * @typedef {Object} StateHelpers
 * @property {function(string):boolean} yes        answers[id] === "yes"
 * @property {function(string):boolean} no         answers[id] === "no"
 * @property {function(string):boolean} isAnswered  the item has an answer (F5: the per-item helper is isAnswered,
 *                                                 never `answered`, which on RoutingState is the numeric count)
 * @property {function(string):(number|null)} scale  the scale index, or null
 */

/**
 * @typedef {Object} RoutingState
 * @property {"screener"|"scribe"} surface
 * @property {Object} answers                     copy; unanswered keys absent; "unsure" never present
 * @property {Object} ctx
 * @property {string} complaint                   "" if none
 * @property {(RoutingError|null)} phenotypeError
 * @property {(string|null)} band
 * @property {number} total
 * @property {number} floor
 * @property {number} ceiling
 * @property {number} coverage
 * @property {boolean} scorable
 * @property {number} answered                   the number of answered items (computeScore's count). Decision F5
 *                                                 (design 03, "Orchestrator decisions"): the per-item predicate is
 *                                                 isAnswered(id), on this state and on every other predicate state.
 * @property {number} count
 * @property {Object} domains                     computeScore output per domain
 * @property {Object<string,{label:string, max:number, negative:boolean, items:Item[]}>} items  domain key → rubric domain
 * @property {Array<{id:string, tier:string, group:string, text:string, points:string, action:string}>} activeFlags
 * @property {boolean} override
 * @property {boolean} emergent
 * @property {boolean} routingCleared
 * @property {string} lowestBand
 * @property {string} highestBand
 * @property {number} scaleMax
 * @property {function(string):boolean} yes
 * @property {function(string):boolean} no
 * @property {function(string):boolean} isAnswered
 * @property {function(string):(number|null)} scale
 */

/** @typedef {{answers:Object} & StateHelpers} PhenotypeState */

/** @typedef {{answers:Object, complaint:string} & StateHelpers} ActivationState */

/**
 * @typedef {Object} PatientState
 * @property {Object} a                           raw answers, may hold "unsure"
 * @property {Object} ctx                         Patient vocabulary
 * @property {string} loc
 * @property {Object} S                           logic.locales[loc].sum ?? logic.locales.en.sum
 * @property {function(string):boolean} yes
 * @property {function(string):(number|null)} scale
 * @property {function(string):boolean} unsure
 * @property {function(string[]):string} L        locale list joiner
 * @property {Object<string,string[]>} groups     name → ids answered "yes", in group order
 *   …then every `patientSummary.derived` value spread onto the state in key order.
 */

/** @typedef {{family:("routing"|"phenotype"), ruleId:string, message:string}} RoutingError */

/** @typedef {{family:string, ruleId:string, message:string}} ModuleError */

// ---------------------------------------------------------------------------------------
// Bound module and its satellites (design §3.4, §4.12-§4.16, §5)
// ---------------------------------------------------------------------------------------

/**
 * The bound module, deep-frozen (design §3.4, §4.13). Apps receive it as `module`; the Patient
 * app receives a PatientView instead.
 * @typedef {Object} Module
 * @property {string} id
 * @property {string} label
 * @property {string} name
 * @property {string} icon
 * @property {string} instrumentVersion
 * @property {("builtin"|"uploaded"|"derived")} origin
 * @property {(Classification|null)} classification   the classifyLineage result (null for built-ins)
 * @property {string} key                         registry key
 * @property {Domain[]} domains
 * @property {string[]} domainOrder
 * @property {Array<Item & {domain:string}>} allItems
 * @property {Object<string, Item & {domain:string}>} itemById
 * @property {number} scaleMax                    Σ max over positive domains
 * @property {number} negativeMin                 Σ max over negative domains
 * @property {string[]} negativeDomainKeys
 * @property {{cuts:{moderate:number, high:number}, rangeText:Object<string,string>,
 *             zones:Array<{band:string, w:number}>, ticks:number[]}} bands
 * @property {ContextItem[]} contextItems
 * @property {(Object|null)} gapRule
 * @property {RedFlag[]} redFlags
 * @property {string[]} redFlagGroups             first-appearance order
 * @property {Object<string, RedFlag>} flagById
 * @property {{screener:ScreenerStep[], patient:PatientStep[]}} steps
 * @property {(PhenotypeData|null)} phenotypes
 * @property {(Object|null)} infoPrompts
 * @property {SampleCase[]} sampleCases
 * @property {{patient:DemoPatient, transcript?:Array<["md"|"pt", string]>}} demo
 * @property {(Lexicon|null)} lexicon
 * @property {Object<string,{data:LocaleData, sum:(Object|null), fallbacks:string[]}>} locales
 * @property {(Research|null)} research
 * @property {FhirData} fhir                      rendered identity
 * @property {CdsData} cds                        rendered identity
 * @property {Copy} copy                          ENGINE_COPY_DEFAULTS merged under rubric.copy
 * @property {(EmrTemplate|null)} emrTemplate     rubric.emrTemplate as is, or null (release 0.4.3)
 * @property {Logic} logic                       the frozen logic object or GENERIC_LOGIC
 * @property {{rubricSha256:string, logicSha256:(string|null), instrumentHash:string, scoringHash:string,
 *             lexiconHash:(string|null), contentHash:string}} hashes
 * @property {{instrument:string, lexicon:(string|null), probeSet:(string|null), goldSet:(string|null),
 *             goldSetLexicon:(string|null)}} versions
 * @property {(Provenance|null)} provenance       the rubric's block; privileges follow `classification`, never this
 * @property {ChangelogEntry[]} changelog
 * @property {string[]} docs                      built-ins: the registry.json docs list
 * @property {Rubric} rubric                      the original JSON, frozen
 * @property {{rubricText:(string|null), logicText:(string|null)}} sources
 */

/**
 * The only object the Patient Companion receives (design §4.12). No flag text/points/action,
 * no item text beyond patientClin, no fhir, cds, research, routing, probes, lexicon or copy.
 * @typedef {Object} PatientView
 * @property {string} id
 * @property {string} name
 * @property {string} label
 * @property {string} instrumentVersion
 * @property {("builtin"|"uploaded"|"derived")} origin
 * @property {string[]} provenanceLines           the PATIENT set only
 * @property {{available:boolean, reason?:string}} available
 * @property {Array<{key:string, negative:boolean, items:Array<{id:string, w:number, scaleLen:(number|null), patientClin:string}>}>} domains
 * @property {PatientStep[]} steps
 * @property {Array<{id:string, signalValue:(string|null)}>} contextItems
 * @property {(Object|null)} gapRule
 * @property {Array<{id:string, tier:string}>} redFlags
 * @property {Object<string,{reviewed:boolean, editedLocally:boolean, stale:boolean,
 *             data:{items:Object, redFlags:Object, contextItems:Object, steps:Object, ui:Object}, sum:(Object|null),
 *             fallbacks?:string[]}>} locales
 * @property {(Object|"generic")} summaryLogic    logic.patientSummary | "generic"
 */

/**
 * What a clinician app publishes to the session (design §5.3).
 * @typedef {Object} ScreenSnapshot
 * @property {("screener"|"scribe")} source
 * @property {string} at                          ISO time
 * @property {string} moduleKey
 * @property {number} score                       total
 * @property {number} floor
 * @property {number} ceiling
 * @property {boolean} scorable
 * @property {(string|null)} band
 * @property {Object} domains
 * @property {number} coverage
 * @property {(string|null)} sex
 * @property {(string|null)} gender
 * @property {string} phenotype                   the complaint ("" = none)
 * @property {string[]} redFlags                  activeFlags.map(f => f.points)
 * @property {boolean} safetyReviewed
 * @property {boolean} routingCleared
 * @property {Object} answers                     feeds only the editor's impact rows; never persisted
 * @property {Object} ctx
 */

/**
 * @typedef {Object} ValidationReport
 * @property {boolean} ok
 * @property {Array<{path:string, code:string, msg:string}>} errors
 * @property {Array<{path:string, code:string, msg:string}>} warnings
 * @property {{hashes:Object, readsObserved:Object, fallbacks:Object, smokeStates:number}} info
 */

/**
 * The classifyLineage result (design §3.11, §4.16).
 * @typedef {Object} Classification
 * @property {("duplicate"|"verified"|"derived-from-upload"|"rederive"|"uploaded"|"builtin")} kind
 * @property {(Module|null)} root
 * @property {("builtin"|"uploaded"|"derived")} origin
 * @property {(1|2|3|4|5|6|7|null)} row           §3.11 table row (null for built-ins)
 * @property {string[]} reasons
 */

/**
 * The per-tab availability summary (design §4.16).
 * @typedef {{screener:true, scribe:{voice:boolean, probes:boolean, reason?:string},
 *            patient:{available:boolean, reason?:string}, research:{population:boolean, readiness:boolean}}} Availability
 */

/**
 * @typedef {Object} RegistryEntry
 * @property {string} key
 * @property {("builtin"|"uploaded"|"derived")} origin
 * @property {(Classification|null)} classification
 * @property {(Module|null)} module
 * @property {(ValidationReport|null)} validation
 * @property {{rubric:{name:string, text:string, sha256:string}, logic:({name:string, text:string, sha256:string}|null)}} files
 * @property {string} loadedAt
 * @property {string} [savedAt]
 * @property {string} [downloadedAt]
 * @property {string[]} [sourceFileNames]
 */

/**
 * Injected by every page through `boot` (design D25, §6.4). Created once per page.
 * @typedef {Object} Env
 * @property {{importModule:function(string, Object=):Promise<Object>,
 *             importSource:function(string, Object=):Promise<Object>,
 *             inspectSource:function(string, Object=):Object}} loader
 * @property {string} appBase                     absolute URL of the app/ folder; every module-data path resolves against it
 */

/**
 * `useSession()` (ui/common.jsx, design §5.1). Reset with the shell's module key.
 * @typedef {Object} SessionApi
 * @property {{screener:(ScreenSnapshot|null), scribe:(ScreenSnapshot|null)}} screens
 * @property {{screener:Object[], scribe:Object[]}} cohorts
 * @property {function(ScreenSnapshot):void} publish
 * @property {function(("screener"|"scribe"), Object):void} addRow
 * @property {function(("screener"|"scribe")):void} clearRows   drops that source's captured rows (Scribe Reset)
 */
