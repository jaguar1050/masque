// tests/harness/patient-chrome-048.js — the patient chrome keys release 0.4.8 adds, in English and
// Spanish. Plain data only: no imports, no logic, nothing happens at import time. Local-only, never
// deployed.
//
// The strings themselves live in src/engine/patient.js (PATIENT_CHROME), which the engine cannot
// read from tests/; this file is their record, as tests/harness/locale-delta.js `chrome` is for the
// keys of release 0.4.2. tests/suites/values.js checks that PATIENT_CHROME.es carries exactly the
// baseline UI.es keys, the 0.4.2 chrome keys and these keys, and that each row's `en` and `es` are
// PATIENT_CHROME.en[key] and PATIENT_CHROME.es[key] byte for byte.
//
// Why. The clinical lead asked on 2026-10-12 (chat, verbatim):
//   "Fix 1: For the Spanish patient companion, the print out in the end should print findings in
//    both spanish and English so an English speaking clinician can analyze it as well."
//   "Fix 3: Add the attached video above the patient companion instructions, make it a
//    collapsible/hideable iframe. Feel free to compress it if needed."
// The English version of the findings needs a title (englishVersion); the video panel needs a
// toggle and a frame title in each locale of the companion. These are interface
// labels, not clinical content: the English was written by the team (it names what the video is,
// a one-minute introduction, and that the panel hides it); the Spanish is an AI translation
// (Claude), NOT reviewed by a qualified medical translator or a bilingual clinician, like the 0.4.2
// Spanish (CHANGELOG.md, release 0.4.2). The video's captions are English, so the Spanish toggle
// and title say so. locales.es.reviewed stays false and the "Traducción sin revisar" banner stays.
//
// Rows: {key, en, es, basis}.

/** The patient chrome keys of release 0.4.8 (English and Spanish), with the translation record. */
export const PATIENT_CHROME_048 = {
  release: "0.4.8",
  requested: { by: "clinical lead", channel: "chat", date: "2026-10-12" },
  translated: { by: "screenAIr team (Claude, AI translation)", date: "2026-10-12", reviewed: false },
  rows: [
    {
      key: "videoShow",
      en: "Watch a 1-minute introduction",
      es: "Ver una introducción de 1 minuto (video en inglés)",
      basis: "Fix 3: the toggle while the video is hidden. The video runs 60 s; its captions are English, which the Spanish adds in brackets (\"video en inglés\")."
    },
    {
      key: "videoHide",
      en: "Hide the video",
      es: "Ocultar el video",
      basis: "Fix 3: the toggle while the video is shown (\"collapsible/hideable\")."
    },
    {
      key: "videoTitle",
      en: "Introduction video",
      es: "Video de introducción (en inglés)",
      basis: "Fix 3: the iframe's title (its accessible name). The Spanish says the video is in English."
    },
    {
      key: "englishVersion",
      en: "English version, for an English-speaking clinician",
      es: "Versión en inglés, para un médico de habla inglesa",
      basis: "Fix 1 (\"the print out in the end should print findings in both spanish and English so an English speaking clinician can analyze it as well\"): the title of the English version of the findings in a Spanish summary, printed in Spanish and in English (screen, print, .txt upper-cased, .html). Never shown in an English summary."
    }
  ]
};
