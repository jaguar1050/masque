// engine/vocab.js — engine vocabulary shared by every app (design 03 §4.2).
// Plain data and two pure helpers; no imports, no side effects.

/** Band keys in ascending order. */
export const BANDS = ["low", "moderate", "high"];
export const LOWEST_BAND = "low";
export const HIGHEST_BAND = "high";
/** The value a screen carries when the answered items span more than one band. */
export const INDETERMINATE = "indeterminate";

/** FHIR ObservationInterpretation code per band (Scr L1450, Scb L1398). */
export const BAND_INTERP = { low: "L", moderate: "N", high: "H" };

/** Red-flag tiers, most urgent first. */
export const TIERS = ["emergent", "urgent"];
export const TIER_RANK = { emergent: 0, urgent: 1 };

/** Boolean-item answer values. "unsure" exists only in the Patient Companion. */
export const ANSWER = { YES: "yes", NO: "no", UNSURE: "unsure" };

/** Kinds of a Scribe capture. */
export const CAPTURE_KIND = { ITEM: "item", CTX: "ctx", REDFLAG: "redflag" };

/**
 * Probe kinds. rank/label/c/bg are moved verbatim from Prb L47-54; caption is the Scribe's
 * group caption (Scb L1160-1162, "" where the Scribe shows none); truncate is false for the
 * kinds the Scribe never slices to two (Scb L1155); mayWrite is false for the kind whose
 * options may only record notes (supporting probes never write a scored item).
 */
export const PROBE_KIND = {
  safety:    { rank:0, label:"Safety",    c:"var(--coral)",  bg:"var(--coralbg)", caption:" · could surface a red flag", truncate:false, mayWrite:true },
  rescue:    { rank:1, label:"Re-ask",    c:"#7A4DA8",       bg:"#F0EAF7", caption:" · alternate phrasing, not a repeated question", truncate:false, mayWrite:true },
  criteria:  { rank:2, label:"Criteria",  c:"var(--petrol)", bg:"#E4EFED", caption:"", truncate:true, mayWrite:true },
  ruleout:   { rank:3, label:"Rule-out",  c:"var(--amber)",  bg:"var(--amberbg)", caption:"", truncate:true, mayWrite:true },
  phenotype: { rank:4, label:"Supporting",c:"#2A6E8A",       bg:"#E3EFF4", caption:" · supporting features, recorded not scored", truncate:true, mayWrite:false },
  exam:      { rank:5, label:"Exam",      c:"var(--slate)",  bg:"#E9EEED", caption:"", truncate:true, mayWrite:true },
};

/** Display order of probe groups (Scb L1152). */
export const PROBE_KIND_ORDER = ["safety", "rescue", "criteria", "ruleout", "phenotype", "exam"];

/** Step kinds across the Screener and the Patient Companion. */
export const STEP_KIND = { SAFETY: "safety", DOMAIN: "domain", STORY: "story", RESULT: "result" };

/** An answer counts only when present and not "unsure" (absent data is never negative data). */
export function isAnswered(v) { return v !== undefined && v !== "unsure"; }

/** "unsure" scores as unanswered. */
export function normalizeAnswer(v) { return v === "unsure" ? undefined : v; }
