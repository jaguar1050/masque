// engine/policy.js — shell and site policy (design 03 §4.2). Nothing here is module-overridable,
// and no caveat string may appear in module data (validator V38).
// Plain data; no imports, no side effects.

/** Release axis (D9, D21; pending the lead, Q2). 0.4.2: the Spanish patient companion completed (2026-10-06). 0.4.3: the EMR Friendly Template (2026-10-06). 0.4.4: the clinical-lead sign-off of the EMR template content recorded (2026-10-07). 0.4.5: the clinical-lead referral rule for dizziness cases (decided 2026-10-07 to 2026-10-10). 0.4.6: the clinical lead's answers on the EMR template's open items (2026-10-10). 0.4.7: chart-text capture and the clarification prompts, from the clinical lead's request and decisions of 2026-10-11 (lexicon 0.3.3 and gold set 0.4.0), signed off by the clinical lead on 2026-10-12. 0.4.8: the clinical lead's three fixes of 2026-10-12 (a module's clinician question reworded as data, the Patient Companion's introduction video, the English version of a non-English summary); and, the same day, the clinical lead's two follow-up requests (the lead's plan line for the EMR template, as data, and the Ambient Scribe's Question review). */
export const APP_VERSION = "0.4.8";

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
 *
 * Release 0.4.2 (2026-10-06, user request; an unreviewed team translation, recorded in
 * the built-in module's SOURCES.md): the patient caveats carry Spanish (`es` for a line, `esShort` for
 * a marker), chosen by the patient locale and tagged lang="es"; English stays the fallback.
 * prototypeCompanion.es is the Spanish line shown NEXT TO the English `prototype` marker on a
 * Spanish patient surface, never instead of it. Every Spanish caveat is engine-owned like the
 * English ones (V38). The two `esShort` markers name their noun ("cuestionario …"), revised after
 * the rendered-Spanish review (round 3), so they read right next to "Traducción sin revisar".
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
      es: "Esta versión del cuestionario se modificó localmente y no ha sido revisada.",
      esShort: "cuestionario modificado localmente, sin revisar",
    },
    uploaded: {
      en: "This questionnaire was loaded from a file and has not been reviewed.",
      short: "loaded from a file, not reviewed",
      es: "Este cuestionario se cargó desde un archivo y no ha sido revisado.",
      esShort: "cuestionario cargado desde un archivo, sin revisar",
    },
  },
  editedWording: {
    en: "Wording in this language was edited locally and has not been reviewed.",
    es: "El texto en este idioma se editó localmente y no ha sido revisado.",
  },
  staleTranslation: {
    en: "The English wording was changed locally; this translation has not been updated to match it.",
    es: "El texto en inglés se modificó localmente; esta traducción no se ha actualizado para que coincida.",
  },
  prototypeCompanion: { es: "Prototipo · no apto para uso clínico" },
};

/**
 * Patterns no patient-facing string may match (V60 and the omissions suite); Spanish forms included.
 * Beyond score / likelihood / probability and an "NN/NNN" figure: a band word, a percentage figure
 * (a threshold written with a comparison sign, such as a criterion's "≥50%", is not a result and is
 * allowed), the words percent / percentage, and chance / odds / risk.
 */
export const OMISSION_PATTERNS = [
  /\bscor(?:e|es|ed|ing)\b/i,
  /likelihood/i,
  /probabil/i,
  /\b\d{1,3}\s*\/\s*\d{2,3}\b/,
  /\bpuntuaci[oó]n|\bpuntaje\b/i,
  /\bbands?\b|\bbandas?\b/i,
  /(?<![≥≤<>=]\s*[\d.,]*)\d\s*[%％]/,
  /\bper\s?cent(?:age)?s?\b|\bporcentajes?\b|\bpor\s+ciento\b/i,
  /\bchances?\b|\bodds\b/i,
  /\brisks?\b|\briesgos?\b/i,
];

/** Upload and module size limits (bytes / file count). */
export const LIMITS = { rubricBytes: 2_000_000, logicBytes: 512_000, zipBytes: 20_000_000, uploadFiles: 20 };

/** Locale display names (Pat L295). */
export const LOCALE_NAMES = { en: "English", es: "Español" };
