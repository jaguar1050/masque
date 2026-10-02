// engine/policy.js — shell and site policy (design 03 §4.2). Nothing here is module-overridable,
// and no caveat string may appear in module data (validator V38).
// Plain data; no imports, no side effects.

/** Release axis (D9, D21; pending the lead, Q2). */
export const APP_VERSION = "0.4.0";

/**
 * Site switches. REQUIRE_SAFETY_REVIEW_TO_SIGN: Scb L171. SITE_SALT / SALT_IS_DEFAULT: Scr L66-67.
 * ALLOW_JS_UPLOAD: whether uploaded JavaScript modules may run on this deployment (Q20).
 */
export const SITE = {
  REQUIRE_SAFETY_REVIEW_TO_SIGN: true,
  SITE_SALT: "CHANGE-ME-PER-SITE",
  SALT_IS_DEFAULT: true,
  ALLOW_JS_UPLOAD: true,
};

/**
 * Engine- and shell-owned caveats (design §3.11 "Provenance display", §4.2).
 * Clinician surfaces use uploaded / edited / scoringChanged; patient-facing surfaces use
 * patient.* / editedWording / staleTranslation, which never name a score, band or probability.
 * unreviewed.es moves Pat L411 (body), Pat L421 (txt) and the heading literal of Pat L685 (title).
 */
export const CAVEATS = {
  prototype: "Prototype · not for clinical use",
  illustrative: "illustrative—replace after validation",
  unreviewed: {
    es: {
      title: "Traducción sin revisar",
      body: "Traducción preliminar. Este texto en español todavía no ha sido revisado por un profesional de salud bilingüe. Úselo como apoyo, no como texto final.",
      txt: "TRADUCCIÓN PRELIMINAR — no revisada por un profesional de salud bilingüe.",
    },
  },
  uploaded: {
    en: "Uploaded module — not reviewed. It runs in this page exactly as written in the file.",
    short: "uploaded, not reviewed",
  },
  edited: {
    en: "Edited module — derived locally and not reviewed.",
    short: "derived locally, not reviewed",
  },
  scoringChanged: {
    en: "Scoring differs from {root} instrument {rootVersion}; scores are not comparable with it.",
  },
  patient: {
    edited: {
      en: "This version of the questionnaire was changed locally and has not been reviewed.",
      short: "changed locally, not reviewed",
    },
    uploaded: {
      en: "This questionnaire was loaded from a file and has not been reviewed.",
      short: "loaded from a file, not reviewed",
    },
  },
  editedWording: { en: "Wording in this language was edited locally and has not been reviewed." },
  staleTranslation: { en: "The English wording was changed locally; this translation has not been updated to match it." },
};

/**
 * Patterns no patient-facing string may match (V60 and the omissions suite); Spanish forms included.
 */
export const OMISSION_PATTERNS = [
  /\bscor(?:e|es|ed|ing)\b/i,
  /likelihood/i,
  /probabil/i,
  /\b\d{1,3}\s*\/\s*\d{2,3}\b/,
  /\bpuntuaci[oó]n|\bpuntaje\b/i,
];

/** Upload and module size limits (bytes / file count). */
export const LIMITS = { rubricBytes: 2_000_000, logicBytes: 512_000, zipBytes: 20_000_000, uploadFiles: 20 };

/** Locale display names (Pat L295). */
export const LOCALE_NAMES = { en: "English", es: "Español" };
