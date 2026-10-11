// tests/harness/spanish.js — shared checks of the Spanish patient completion (release 0.4.2) for
// the patient, golden, render-patient and omissions suites. Nothing happens at import time; every
// engine value, oracle and DOM node arrives as an argument.
//
//   ad14Context({delta, pat, patient, policy, view, loc})
//        ctx.AD14 for a translated locale: ad14Params (tests/harness/diff.js) fed with the locale
//        delta, PATIENT_CHROME.en / [loc], the baseline's question forms that the "¿" fix opens
//        (pat.askForm results ending in "?" with no "¿"), the list elements of the baseline's
//        SUM[loc] word maps (for the "e" rule) and the prototype marker with its companion line.
//   ad14Tally()
//        per-rule accounting for h.expect: a rule whose source occurs in a baseline value must
//        have acted on every such source (ad14Explain); the dated-line rule M wherever the caller
//        says an export must carry the companion marker.
//   englishCorpus({...}) / englishScan(root, {...})
//        the es-mode DOM scan: no element with lang="en" except the ones a caller allows, and no
//        English (function words, or a known English source string) in any text whose nearest
//        lang is not "en".
import { ad14Explain, ad14Params } from "./diff.js";

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** ctx.AD14 for `loc` (see the header). Throws when ad14Params refuses its input. */
export function ad14Context({ delta, pat, patient, policy, view, loc = "es" }) {
  const questions = Object.keys(pat.P).map((id) => pat.askForm(id, loc))
    .filter((q) => typeof q === "string" && q.endsWith("?") && !q.includes("¿"));
  const sum = (pat.SUM && pat.SUM[loc]) || {};
  const listElements = Object.values(sum).filter(isObj).flatMap((m) => Object.values(m)).filter((s) => typeof s === "string");
  const companion = policy.CAVEATS.prototypeCompanion ? policy.CAVEATS.prototypeCompanion[loc] : undefined;
  return ad14Params({
    delta,
    chromeEn: patient.PATIENT_CHROME.en,
    chromeLoc: patient.PATIENT_CHROME[loc] || {},
    vars: { name: view.name, id: view.id, instrument: view.instrumentVersion, appVersion: policy.APP_VERSION },
    questions,
    listElements,
    marker: { en: policy.CAVEATS.prototype, companion },
  });
}

export const AD14_RULES = ["P", "C", "Q", "J", "M"];
const RULE_NAMES = {
  P: "delta / chrome English → Spanish",
  C: "clinician lines → the locale's clin",
  Q: "\"¿\" opens the statement-questions",
  J: "\"y\" → \"e\" before an /i/ sound",
  M: "the companion of the prototype marker on the dated line",
};

/**
 * Per-rule AD14 accounting. add(p, a, b, {marker}) records one comparison (a = the baseline as AD14
 * receives it, i.e. after AD4); for P, C, Q and J the comparison counts as a precondition when the
 * rule's source occurs in `a`, and as observed when the rule acted on every such source; with
 * `marker: true` (an export that must carry the companion) M counts, observed when it acted.
 * expect(h, c, where, {need}) turns each rule into an h.expect("AD14", …) and a named check, and
 * fails a rule in `need` that never had a precondition (it must occur in that suite).
 */
export function ad14Tally() {
  const t = Object.fromEntries(AD14_RULES.map((k) => [k, { pre: 0, seen: 0 }]));
  return {
    t,
    add(p, a, b, { marker = false } = {}) {
      const x = ad14Explain(p, a, b);
      if (!x) return null;
      for (const k of ["P", "C", "Q", "J"]) {
        const present = x.present[k];
        if (!present.length) continue;
        t[k].pre += 1;
        if (present.every((s) => x.fired[k].includes(s))) t[k].seen += 1;
      }
      if (marker) {
        t.M.pre += 1;
        if (x.fired.M) t.M.seen += 1;
      }
      return x;
    },
    expect(h, c, where, { need = [] } = {}) {
      for (const k of AD14_RULES) {
        const { pre, seen } = t[k];
        if (pre > 0) h.expect("AD14", { precondition: true, observed: seen === pre });
        c.check(seen === pre, `${where}/AD14/${k}`, { rule: RULE_NAMES[k] }, `observed wherever its source occurs (${pre})`, `observed ${seen} of ${pre}`);
        if (need.includes(k)) c.check(pre > 0, `${where}/AD14/${k}/@occurs`, { rule: RULE_NAMES[k] }, "occurs at least once", "never occurred");
      }
    },
    note() {
      return AD14_RULES.map((k) => `${k} ${t[k].seen}/${t[k].pre}`).join(", ");
    },
  };
}

// ----------------------------------------------------------------------------- the DOM scan

/**
 * English function words that are never Spanish words, matched whole and case-insensitively. A
 * text in a Spanish context that holds one is English the scan reports.
 */
const ENGLISH_WORDS = ["the", "and", "you", "your", "with", "what", "this", "that", "have", "been", "for", "are", "is", "it",
  "of", "to", "not", "or", "on", "from", "please", "print", "download", "summary", "step", "back", "next", "start", "patient",
  "clinician", "questionnaire", "loaded", "changed", "reviewed", "release", "instrument", "prototype", "research", "device",
  "today", "week", "none", "apply", "seen", "sure", "worth", "doesn't", "don't", "it's", "isn't", "you've", "I've"];
const ENGLISH_RE = new RegExp(`(?<![\\p{L}\\p{N}'])(?:${ENGLISH_WORDS.map((w) => w.replace(/'/g, "['’]")).join("|")})(?![\\p{L}\\p{N}'])`, "iu");

/** The literal fragments (12 characters or more) of English source strings, minus any that also occur in Spanish. */
export function englishCorpus({ english = [], spanish = [] } = {}) {
  const frags = (s) => String(s).replace(/\*\*/g, "").split(/\{[A-Za-z][A-Za-z0-9]*\}/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.length >= 12);
  const es = spanish.filter((s) => typeof s === "string").join("\n");
  return [...new Set(english.filter((s) => typeof s === "string").flatMap(frags))].filter((f) => !es.includes(f));
}

/** Every string leaf of a JSON-like value. */
export function stringLeaves(x, out = []) {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) for (const v of x) stringLeaves(v, out);
  else if (isObj(x)) for (const k of Object.keys(x)) stringLeaves(x[k], out);
  return out;
}

function snippet(el) {
  const html = el.outerHTML || "";
  return html.length > 160 ? `${html.slice(0, 160)}…` : html;
}

/**
 * Scan `root` as shown in a non-English locale:
 *   langEn   every element with lang="en" (root included) that `allowEn(el)` does not allow;
 *   english  every visible text node (no <style>/<script>, no <noscript>, whose content is raw text
 *            never rendered while scripts run, no [hidden] subtree) whose nearest lang
 *            (the root's ancestors included; `docLang` when there is none) is not "en" and that
 *            holds an English function word (ENGLISH_WORDS) or a `corpus` fragment.
 * Returns {langEn: string[], english: [{text, lang, why}], texts: number}.
 */
export function englishScan(root, { corpus = [], allowEn = () => false, docLang = "en" } = {}) {
  const langEn = [];
  const english = [];
  let texts = 0;
  if (!root) return { langEn: ["no root"], english, texts };
  const all = [root, ...root.querySelectorAll("[lang]")].filter((el) => el.getAttribute && el.getAttribute("lang") !== null);
  for (const el of all) {
    if (el.getAttribute("lang") === "en" && !el.closest("[hidden]") && !allowEn(el)) langEn.push(snippet(el));
  }
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue;
    if (!text || !text.trim()) continue;
    const parent = n.parentElement;
    if (!parent || parent.closest("style, script, noscript, [hidden]")) continue;
    texts += 1;
    const host = parent.closest("[lang]");
    const lang = host ? host.getAttribute("lang") : docLang;
    if (lang === "en" || /^en-/i.test(lang)) continue;
    const m = ENGLISH_RE.exec(text);
    if (m) { english.push({ text: text.trim().slice(0, 160), lang, why: `English word "${m[0]}"` }); continue; }
    const f = corpus.find((s) => text.includes(s));
    if (f) english.push({ text: text.trim().slice(0, 160), lang, why: `English source "${f.slice(0, 60)}"` });
  }
  return { langEn, english, texts };
}
