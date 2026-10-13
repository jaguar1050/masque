// tests/suites/patient.js — Patient Companion summary parity (design 03 §8.3 `patient`, §8.5).
// Owner: WP13; accepts WP6 (with WP1's locales and WP2's summary logic).
//
// Over 20,000 Patient states (2,000 with ?quick=1; §8.5: each item undefined .15 / "unsure" .10
// / a value .75, Patient-vocabulary context, red flags, loc ∈ {en, es}):
//   - baseline buildSummary({a, ctx, flags, urgent, loc}) vs
//     buildPatientSummary(projectForPatient(masque), loc, {a, ctx, flags: rf, urgent}) on
//     said, ask, gapLine, unsureList, clin (deep-equal, key order) and urgent;
//   - the summary's flags vs the baseline's rfFor(loc, f): id, q, say, and the tier through
//     TIER_DISPLAY (emergent → now, urgent → soon);
//   - summaryText: the baseline's (summary, UI[loc]) vs the engine's, with AD4 (release
//     string) and AD10 (the final dated caveat line) in English, AD14 (release 0.4.2, the Spanish
//     completion) before AD10 in es, and last in both AD16 (release 0.4.3: the thin warning and the
//     not-sure lede) as the only normalisations; the dated line is expected on every export, and
//     AD16 on every thin summary or "Not sure" list ("expected difference missing" otherwise).
// Exhaustively: askForm × every item id × {en, es}; list/joinList for 1-5 words × {en, es};
// flagCopy for every flag × {en, es}.
// Thin summaries × {en, es} (AD16): nothing answered, and every yes/no item "Not sure". The .txt
// vs the baseline as above, then directly: PATIENT_CHROME[loc].thinTitle (as a heading) and
// .thin right after the header, before every section, the not-sure lede right under its
// heading, and the same strings in summaryHtml. No double excuse: without AD16 each of these
// comparisons stays a difference (in es AD14 does not excuse the thin block or the lede), and the
// AD16 lines hold no AD14 source. AD16 self-checks: crafted .txt pairs it must excuse and pairs
// it must not (the block at another index, other words, the English strings in an es export, the
// lede under another heading).
//
// Release 0.4.2 (the Spanish completion): the es comparisons allow AD14 only, and every AD14 rule
// is expected wherever its source occurs (tests/harness/spanish.js ad14Tally): "¿" on the 18
// baseline statement-questions (askForm, the .txt "not sure" list), "e" before an /i/ sound in the
// summary sentences, each es clinician entry {w, neg, t, lang: "es"} with the locale's clin line,
// and the companion of the prototype marker on every es dated line. Direct assertions: the 18
// question forms and nothing else open with "¿"; joinList "e" / "y" cases; es clin lines and
// their lang; English clin entries carry no lang; the dated line in es only carries the companion.
// AD14 self-checks: crafted pairs it must excuse (one per rule) and pairs it must not (an English
// comparison, a different Spanish string, a changed value code, a "¿" on a question that already
// has one, "e" before "hielo", the companion instead of the English marker, a clin entry with the
// wrong language, and more). Every comparison passes its own locale as ctx.loc, and AD14 applies
// only where ctx.loc is "es": each pair it excuses is re-run in English mode and with no ctx.loc,
// and must then NOT be excused.
//
// Release 0.4.8 (the clinical lead's request of 2026-10-12: the Spanish printout gives the findings
// in English too): every es summary carries `english`, which equals the baseline's English summary
// of the same answers, context and flags (said, ask, gapLine, unsureList, clin, urgent and the
// flags), and whose English .txt equals the baseline's English .txt (AD4, AD10, AD16); the es .txt
// inserts that English .txt's findings under the two englishVersion titles right before the footer
// rule, which AD20 (listed right after AD4) excuses exactly and is expected on every es export; an
// English summary carries no `english` and its .txt no English version block. AD20 self-checks:
// crafted .txt pairs it must excuse and pairs it must not (the block elsewhere, twice, with other
// lines, in English mode, with no ctx.loc, malformed parameters).
// Release 0.4.8, final review: (1) the English version carries the English caveat lines English
// output prints for the same view (englishVersionNotices = ad20EnglishNotices of the English .txt):
// for the built-in none; for an uploaded module, a derivation with an edited English, and a
// derivation of an upload with an edited English and a stale es, the provenance and edited-wording
// lines, right under the titles in the .txt (then a blank) and first in the .html section (untagged
// p.notice, as the English .html prints them before its title), while the Spanish notices stay
// Spanish and in place; (2) the English .html's stylesheet is release 0.4.7's EXPORT_CSS byte for byte
// (SHA-256 pinned) and holds no .enver rule, while a bilingual .html appends the .enver rules, among
// them @media print .enver-title{break-inside:avoid;break-after:avoid} (the title's two lines never
// part and it never ends a printed page alone);
// (3) AD20 self-checks with caveat lines (excused only with exactly the lines its block names) and
// ad20EnglishNotices.
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { flatItems, patientStream, sizes } from "../harness/matrix.js";
import { AD14_MARKER_JOIN, AD20_FOOTER_RULE, ad14Explain, ad14ISound, ad14Params, ad16Params, ad20Block, ad20EnglishBody, ad20EnglishNotices, allowedDifference, deepDiff } from "../harness/diff.js";
import { LOCALE_DELTA } from "../harness/locale-delta.js";
import { ad14Context, ad14Tally } from "../harness/spanish.js";

const GENERATED_AT = "2026-10-01T12:00:00.000Z";
/** SHA-256 of the <style> text of every .html export in release 0.4.7 ("\n" + EXPORT_CSS of b516872). */
const EXPORT_STYLE_047_SHA256 = "74440b2f7a2e9012072c31432d05d5ee45f4c7ad60038a7f752638f6661ed27a";
const LOCALES = ["en", "es"];
const SUMMARY_KEYS = ["said", "ask", "gapLine", "unsureList", "clin", "urgent"];

const pickKeys = (o, keys) => Object.fromEntries(keys.map((k) => [k, o ? o[k] : undefined]));

/** The text of an .html export's one <style> element, or null. */
const styleOf = (html) => { const m = /<style>([\s\S]*?)<\/style>/.exec(html); return m ? m[1] : null; };

/** The declarations of `selector` inside the @media print rules of a stylesheet text (CSSOM), or null. */
function printRule(cssText, selector) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  for (const r of sheet.cssRules) {
    if (!(r instanceof CSSMediaRule) || !/\bprint\b/.test(r.media.mediaText)) continue;
    for (const x of r.cssRules) if (x.selectorText === selector) return x.style;
  }
  return null;
}

/** The text of a parsed .html export's body, without its style and script elements. */
function htmlBodyText(doc) {
  const d = doc.cloneNode(true);
  for (const el of d.querySelectorAll("style, script")) el.remove();
  return d.body ? d.body.textContent : "";
}

/** AD14 self-checks: [label, a, b, path, excused?]. `P` is ctx.AD14; `X` the companion line. */
function selfCheckPairs(P, { prototype, companion, q, clinEn, clinEs, iWord }) {
  const date = "2026-10-01";
  const dated = (m) => `X\n${m} · ${date}`;
  const pairEn = P.pairs[0][0], pairEs = P.pairs[0][1];
  return [
    // Each rule acts on its documented form (positive controls).
    ["P: a delta/chrome English → its Spanish", `«${pairEn}»`, `«${pairEs}»`, "/t", true],
    ["C: a clin English → the locale's clin", `+ ${clinEn} [x]`, `+ ${clinEs} [x]`, "/t", true],
    ["Q: an unopened question → ¿…?", q, `¿${q}`, "/t", true],
    ["J: y → e before an /i/ sound", `a y ${iWord}`, `a e ${iWord}`, "/t", true],
    ["M: the dated line with its companion", "X", dated(`${prototype}${AD14_MARKER_JOIN}${companion}`), "/t", "M"],
    ["clin entry: es line, lang es", { w: 2, neg: false, t: `${clinEn} [x]` }, { w: 2, neg: false, t: `${clinEs} [x]`, lang: "es" }, "/clin/0", true],
    ["clin entry: no own line, lang en, unchanged", { w: 2, neg: false, t: `${clinEn} [x]` }, { w: 2, neg: false, t: `${clinEn} [x]`, lang: "en" }, "/clin/0", true],
    // …and nothing else.
    ["a different Spanish string", `«${pairEn}»`, `«${pairEs} (otra)»`, "/t", false],
    ["Spanish → English (reversed)", `«${pairEs}»`, `«${pairEn}»`, "/t", false],
    ["an English text that is no delta or chrome source", "Prototype · not for clinical use", "Prototipo · no apto para uso clínico", "/t", false],
    ["\"¿\" twice", `¿${q}`, `¿¿${q}`, "/t", false],
    ["\"¿\" on a question that already has one", "Cuando le da un episodio, ¿cuánto dura?", "¿Cuando le da un episodio, ¿cuánto dura?", "/t", false],
    ["\"¿\" without the closing mark", q.slice(0, -1) + ".", `¿${q.slice(0, -1)}.`, "/t", false],
    ["\"e\" before \"hielo\"", "agua y hielo", "agua e hielo", "/t", false],
    ["\"e\" before a word that is no list element", "dolor y inflamable", "dolor e inflamable", "/t", false],
    ["\"e\" for \"y\" before an iWord but another change too", `a y ${iWord}`, `b e ${iWord}`, "/t", false],
    ["the companion instead of the English marker", "X", dated(companion), "/t", false],
    ["the companion with other words", "X", dated(`${prototype}${AD14_MARKER_JOIN}Prototipo · no para uso clínico`), "/t", false],
    ["the companion before the English marker", "X", dated(`${companion}${AD14_MARKER_JOIN}${prototype}`), "/t", false],
    ["clin entry: es line, lang en", { w: 2, neg: false, t: `${clinEn} [x]` }, { w: 2, neg: false, t: `${clinEs} [x]`, lang: "en" }, "/clin/0", false],
    ["clin entry: English line, lang es", { w: 2, neg: false, t: `${clinEn} [x]` }, { w: 2, neg: false, t: `${clinEn} [x]`, lang: "es" }, "/clin/0", false],
    ["clin entry: another language", { w: 2, neg: false, t: `${clinEn} [x]` }, { w: 2, neg: false, t: `${clinEs} [x]`, lang: "fr" }, "/clin/0", false],
    ["clin entry: a different option", { w: 2, neg: false, t: `${clinEn} [x]` }, { w: 2, neg: false, t: `${clinEs} [y]`, lang: "es" }, "/clin/0", false],
    ["clin entry: a different weight", { w: 2, neg: false, t: `${clinEn} [x]` }, { w: 3, neg: false, t: `${clinEs} [x]`, lang: "es" }, "/clin/0", false],
    ["clin entry: away from the clin path", { w: 2, neg: false, t: `${clinEn} [x]` }, { w: 2, neg: false, t: `${clinEs} [x]`, lang: "es" }, "/said/0", false],
  ];
}

export default {
  name: "patient",
  owner: "WP13",
  run: guarded("patient", async (h) => {
    const { module, validation } = await loadMasque(h);
    const [patient, policy] = await Promise.all([h.engine("patient.js"), h.engine("policy.js")]);
    need(typeof patient.projectForPatient === "function" && typeof patient.buildPatientSummary === "function", "waits on WP6: patient.js");
    const [pat, scr] = await Promise.all([h.oracle("MASQUE_Patient_v0_3.jsx"), h.oracle("MASQUE_Screener_v0_3.jsx")]);
    const c = collector(h);
    c.note(validationNote(validation));
    const view = patient.projectForPatient(module);
    const tierKey = (t) => (patient.TIER_DISPLAY[t] ? patient.TIER_DISPLAY[t].key : `?${t}`);
    const CAV = policy.CAVEATS;
    const AD4 = allowedDifference("AD4");
    const after4 = (a, b) => AD4.normalise(a, b)[0];

    // AD14 for es (release 0.4.2), from the locale delta, the chrome and the baseline.
    const P14 = ad14Context({ delta: LOCALE_DELTA, pat, patient, policy, view, loc: "es" });
    // Every comparison names its own locale (ctx.loc): AD14 excuses only where that is "es".
    const ctxFor = (loc) => (loc === "es" ? { AD14: P14, loc } : { loc });
    const allowFor = (loc, ...rest) => (loc === "es" ? ["AD14", ...rest] : rest);
    c.check(P14.questions.length === 18, "/AD14/questions", P14.questions, "the 18 baseline statement-questions", P14.questions.length);
    c.check(P14.iWords.length > 0 && P14.iWords.every((w) => /^inflamación /.test(w)), "/AD14/iWords", P14.iWords, "the SUM.es list elements that start with an /i/ sound", P14.iWords);
    c.check(CAV.prototypeCompanion && CAV.prototypeCompanion.es === "Prototipo · no apto para uso clínico", "/CAVEATS/prototypeCompanion/es", null,
      "Prototipo · no apto para uso clínico", CAV.prototypeCompanion && CAV.prototypeCompanion.es);
    c.check(CAV.prototype === "Prototype · not for clinical use", "/CAVEATS/prototype", null, "Prototype · not for clinical use (English on every surface)", CAV.prototype);

    // askForm × every item id × locale.
    const ids = Object.keys(pat.P);
    const tAsk = ad14Tally();
    for (const loc of LOCALES) for (const id of ids) {
      const want = pat.askForm(id, loc), got = patient.askForm(view, loc, id);
      c.diff(want, got, { at: `/askForm/${loc}/${id}`, input: { id, loc }, allow: allowFor(loc), ctx: ctxFor(loc) });
      if (loc === "es") tAsk.add(P14, want, got);
    }
    tAsk.expect(h, c, "/askForm/es", { need: ["Q"] });
    // Decision D4: exactly the transform-made questions open with "¿"; every es question form is
    // opened somewhere; none opens twice; English is untouched (compared above without AD14).
    for (const id of ids) {
      const base = pat.askForm(id, "es"), got = patient.askForm(view, "es", id);
      const made = P14.questions.includes(base);
      c.check(made ? got === `¿${base}` : got === base, `/askForm/es/${id}/@D4`, { id }, made ? `¿${base}` : base, got);
      c.check(got.includes("¿") && !got.includes("¿¿"), `/askForm/es/${id}/@opened`, { id }, "an opened question (one \"¿\" per question)", got);
      c.check(patient.askFormLang(view, "es", id) === null && patient.askFormLang(view, "en", id) === null, `/askFormLang/${id}`, { id },
        "null in es and en (the built-in es has its own wording for every item)", [patient.askFormLang(view, "es", id), patient.askFormLang(view, "en", id)]);
    }
    // An item whose es `q` is English standing in for a translation (a derived module's new item,
    // V33) takes the English transform, never the Spanish grammar (no "¿"), and is tagged "en".
    {
      const fbIds = ids.filter((id) => { const w = view.locales.en.data.items[id]; return w && !w.ask && /^I(?:'ve)? /.test(w.q) && w.q.endsWith("."); });
      c.check(fbIds.length > 0, "/askForm/es-fallback/@occurs", null, "an English statement item", fbIds.length);
      c.note(`askForm with an English fallback q in es: ${Math.min(3, fbIds.length)} of ${fbIds.length} English statement items (the English transform, no "¿", lang "en" in the .html)`);
      for (const id of fbIds.slice(0, 3)) {
        const es = view.locales.es;
        const fv = { ...view, locales: { ...view.locales, es: { ...es,
          data: { ...es.data, items: { ...es.data.items, [id]: { ...es.data.items[id], q: view.locales.en.data.items[id].q } } },
          fallbacks: [...es.fallbacks, `/locales/es/items/${id}/q`] } } };
        const got = patient.askForm(fv, "es", id), want = patient.askForm(view, "en", id);
        c.check(got === want && !got.includes("¿"), `/askForm/es-fallback/${id}`, { id }, want, got);
        c.check(patient.askFormLang(fv, "es", id) === "en", `/askFormLang/es-fallback/${id}`, { id }, "en", patient.askFormLang(fv, "es", id));
        const { summary } = patient.buildPatientSummary(fv, "es", { a: { [id]: "unsure" }, ctx: {}, flags: {}, urgent: false });
        const html = summary ? patient.summaryHtml(fv, "es", summary, { generatedAt: GENERATED_AT }) : "";
        c.check(html.includes(`<li lang="en">${want.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")}</li>`),
          `/summaryHtml/es-fallback/${id}`, { id }, `<li lang="en">${want}</li>`, (/<div class="sum unsure">.*?<\/ul>/.exec(html) || ["absent"])[0]);
        const txt = summary ? patient.summaryText(fv, "es", summary, { generatedAt: GENERATED_AT }) : "";
        c.check(txt.includes(`  - ${want}`) && !txt.includes(`¿${want}`), `/summaryText/es-fallback/${id}`, { id }, `  - ${want}`, txt.split("\n").filter((l) => l.startsWith("  - ")));
      }
    }

    // list / joinList, lengths 1-5.
    const words = ["alpha", "beta y gamma", "delta, epsilon", "zeta", "eta"];
    for (const loc of LOCALES) for (let k = 1; k <= 5; k++) {
      const xs = words.slice(0, k);
      c.diff(pat.list(xs, loc), patient.joinList(loc, xs), { at: `/list/${loc}/${k}`, input: { xs, loc }, allow: allowFor(loc), ctx: ctxFor(loc) });
    }
    // Decision D5: "e" for "y" before a final element with an /i/ sound, "y" before "hie…"; English unchanged.
    const JOINS = [
      ["es", ["ardor", "inflamación"], "ardor e inflamación"],
      ["es", ["ardor", "Inflamación"], "ardor e Inflamación"],
      ["es", ["a", "b", "hiperacusia"], "a, b e hiperacusia"],
      ["es", ["a", "ícono"], "a e ícono"],
      ["es", ["agua", "hielo"], "agua y hielo"],
      ["es", ["a", "hierba"], "a y hierba"],
      ["es", ["inflamación", "ardor"], "inflamación y ardor"],
      ["es", ["a", "b", "c"], "a, b y c"],
      ["en", ["burning", "inflammation"], "burning and inflammation"],
      ["en", ["a", "b", "inflammation"], "a, b, and inflammation"],
    ];
    for (const [loc, xs, want] of JOINS) c.check(patient.joinList(loc, xs) === want, `/joinList/${loc}/@D5`, { xs }, want, patient.joinList(loc, xs));
    for (const [w, want] of [["inflamación", true], ["Íntimo", true], ["hiperacusia", true], ["hielo", false], ["hierba", false], ["huevo", false], ["ardor", false]]) {
      c.check(ad14ISound(w) === want, `/AD14/ad14ISound/${w}`, null, want, ad14ISound(w));
    }
    // Every list the baseline's SUM.es word maps can end with: only an /i/-sound element changes "y".
    for (const w of Object.values(pat.SUM.es).filter((m) => m && typeof m === "object" && !Array.isArray(m)).flatMap(Object.values)) {
      const base = pat.list(["primero", w], "es"), got = patient.joinList("es", ["primero", w]);
      const want = P14.iWords.includes(w) ? base.replace(` y ${w}`, ` e ${w}`) : base;
      c.check(got === want, "/joinList/es/@SUM-words", { w }, want, got);
    }

    // flagCopy.
    for (const loc of LOCALES) {
      const want = pat.RED_FLAGS.map((f) => pat.rfFor(loc, f)).map((f) => ({ id: f.id, tier: f.tier, q: f.q, say: f.say }));
      const got = patient.flagCopy(view, loc).map((f) => ({ id: f.id, tier: tierKey(f.tier), q: f.q, say: f.say }));
      c.diff(want, got, { at: `/flagCopy/${loc}`, input: { loc }, keyOrder: true });
    }

    // summaryText vs the baseline's: AD4, AD14 before AD10 in es, AD10 and, where the baseline
    // summary is thin or lists a "Not sure", AD16 last with the baseline's own UI[loc] strings.
    const AD16 = allowedDifference("AD16");
    const AD20 = allowedDifference("AD20");
    const txtAllow = (loc) => (loc === "es" ? ["AD4", "AD20", "AD14", "AD10", "AD16"] : ["AD4", "AD10", "AD16"]);
    // Release 0.4.8: in es the exact English version block (AD20) is built from the summary's own
    // English twin: its English .txt's caveat lines (none for the built-in) and findings under the two
    // englishVersion titles.
    const enBlock = (summary) => {
      if (!summary || !summary.english) return null;
      const enTxt = patient.summaryText(view, "en", summary.english, { generatedAt: GENERATED_AT });
      const body = ad20EnglishBody(enTxt);
      return body ? ad20Block(patient.PATIENT_CHROME.es.englishVersion, patient.PATIENT_CHROME.en.englishVersion, body, ad20EnglishNotices(enTxt) || []) : null;
    };
    const txtCtx = (want, loc, summary = null) => {
      const p = ad16Params(want, pat.UI[loc]);
      const block = loc === "es" ? enBlock(summary) : null;
      return { AD10: { notices: [], date: GENERATED_AT.slice(0, 10) }, ...ctxFor(loc), ...(p ? { AD16: p } : {}), ...(block ? { AD20: { locale: "es", block } } : {}) };
    };
    // The es .txt without its English version block (for the per-rule AD14 tally and direct checks).
    const withoutEnglish = (txt, summary) => {
      const block = enBlock(summary);
      return block ? AD20.normalise("", txt, { AD20: { locale: "es", block }, loc: "es" })[1] : txt;
    };
    let ad16Pre = 0, ad16Seen = 0, ad20Pre = 0, ad20Seen = 0, enTwins = 0;
    /**
     * Release 0.4.8: an es summary's English twin vs the baseline's English summary of the same
     * answers (and its English .txt vs the baseline's English .txt); an en summary has no twin.
     */
    const twinChecks = (at, input, summary, loc, { a, ctx, rf, urgent }) => {
      if (loc !== "es") {
        c.check(!Object.prototype.hasOwnProperty.call(summary, "english"), `${at}/english/@none`, input, "no English twin in English", "present");
        return;
      }
      if (!c.check(!!summary.english && summary.english.loc === "en" && !Object.prototype.hasOwnProperty.call(summary.english, "english"), `${at}/english`, input,
        "the English twin (loc en, no twin of its own)", summary.english ? summary.english.loc : "absent")) return;
      enTwins++;
      const flagsEn = pat.RED_FLAGS.filter((f) => rf[f.id]).map((f) => pat.rfFor("en", f));
      const wantEn = pat.buildSummary({ a, ctx, flags: flagsEn, urgent, loc: "en" });
      c.diff(pickKeys(wantEn, SUMMARY_KEYS), pickKeys(summary.english, SUMMARY_KEYS), { at: `${at}/english/summary`, input, keyOrder: true, allow: allowFor("en"), ctx: ctxFor("en") });
      c.diff(wantEn.flags.map((f) => ({ id: f.id, tier: f.tier, q: f.q, say: f.say })),
        (summary.english.flags || []).map((f) => ({ id: f.id, tier: tierKey(f.tier), q: f.q, say: f.say })), { at: `${at}/english/flags`, input, keyOrder: true });
      const enTxt = patient.summaryText(view, "en", summary.english, { generatedAt: GENERATED_AT });
      c.diff(pat.summaryText(wantEn, pat.UI.en), enTxt, { at: `${at}/english/summaryText`, input, allow: txtAllow("en"), ctx: txtCtx(wantEn, "en") });
    };

    // Thin summaries × {en, es} (AD16).
    const items = flatItems(scr.ITEMS, scr.DOMAIN_ORDER);
    const up = (x) => String(x).toUpperCase();
    const thinCases = [
      { name: "empty", a: {} },
      { name: "unsure", a: Object.fromEntries(items.filter((it) => !it.scale).map((it) => [it.id, "unsure"])) },
    ];
    for (const tc of thinCases) for (const loc of LOCALES) {
      const at = `/thin/${tc.name}/${loc}`;
      const input = { a: tc.a, ctx: {}, rf: {}, loc };
      const want = pat.buildSummary({ a: tc.a, ctx: {}, flags: [], urgent: false, loc });
      const { summary, error } = patient.buildPatientSummary(view, loc, { a: tc.a, ctx: {}, flags: {}, urgent: false });
      if (!c.check(!error && !!summary, `${at}/buildPatientSummary/error`, input, "a summary", error ? `${error.ruleId}: ${error.message}` : "null")) continue;
      c.diff(pickKeys(want, SUMMARY_KEYS), pickKeys(summary, SUMMARY_KEYS), { at: `${at}/summary`, input, keyOrder: true, allow: allowFor(loc), ctx: ctxFor(loc) });
      const unsure = tc.name === "unsure";
      c.check(!want.said.length && !want.clin.length && !want.flags.length && (want.unsureList.length > 0) === unsure, `${at}/@case`, input,
        `thin (Pat L1001), ${unsure ? "with" : "without"} a "Not sure" list`, { said: want.said.length, clin: want.clin.length, flags: want.flags.length, unsure: want.unsureList.length });
      const wantText = pat.summaryText(want, pat.UI[loc]);
      const gotText = patient.summaryText(view, loc, summary, { generatedAt: GENERATED_AT });
      const r = c.diff(wantText, gotText, { at: `${at}/summaryText`, input, allow: txtAllow(loc), ctx: txtCtx(want, loc, summary) });
      if (AD16.detector(want)) { ad16Pre++; if (r.observed.has("AD16")) ad16Seen++; }
      if (loc === "es") { ad20Pre++; if (r.observed.has("AD20")) ad20Seen++; }
      twinChecks(at, input, summary, loc, { a: tc.a, ctx: {}, rf: {}, urgent: false });
      // No double excuse: without AD16 the same comparison stays a difference (in es, AD14 and
      // AD10 do not excuse the thin block or the lede).
      const rx = deepDiff(wantText, gotText, { at: `${at}/summaryText`, allow: txtAllow(loc).filter((id) => id !== "AD16"), ctx: txtCtx(want, loc, summary) });
      c.check(rx.diffs.length > 0 && !rx.observed.has("AD16"), `${at}/summaryText/@AD16-only`, input, "a difference without AD16", "excused without AD16");
      // Directly, in the engine's own chrome: the header as the baseline prints it (title, rule,
      // blank, and the unreviewed line with a blank when present), then the thin block.
      const T = patient.PATIENT_CHROME[loc];
      const lines = gotText.split("\n");
      const headLen = pat.UI[loc].txtUnreviewed ? 5 : 3;
      c.diff(wantText.split("\n").slice(0, headLen), lines.slice(0, headLen), { at: `${at}/txt/header`, input });
      c.diff([up(T.thinTitle), "  " + T.thin, ""], lines.slice(headLen, headLen + 3), { at: `${at}/txt/thin`, input });
      const j = lines.indexOf(up(T.notSure));
      if (unsure) c.diff([up(T.notSure), "  " + T.notSureLede], j > headLen ? lines.slice(j, j + 2) : ["[no heading after the thin block]"], { at: `${at}/txt/notSureLede`, input });
      else c.check(j < 0 && !gotText.includes(T.notSureLede), `${at}/txt/notSure`, input, "no not-sure section", "present");
      // The .html carries the same strings in the same places: the thin box first after the
      // title, the lede first in the not-sure box.
      const doc = new DOMParser().parseFromString(patient.summaryHtml(view, loc, summary, { generatedAt: GENERATED_AT }), "text/html");
      const first = doc.querySelector("h1") && doc.querySelector("h1").nextElementSibling;
      const box = (el) => (el ? [el.querySelector("h3") && el.querySelector("h3").textContent, el.querySelector("p") && el.querySelector("p").textContent] : null);
      c.diff([T.thinTitle, T.thin], box(first), { at: `${at}/html/thin`, input });
      if (unsure) c.diff([T.notSure, T.notSureLede], box(doc.querySelector(".sum.unsure")), { at: `${at}/html/notSureLede`, input });
      // The AD16 lines hold no AD14 source: AD14 never rewrites them.
      if (loc === "es") {
        const x = ad14Explain(P14, [up(T.thinTitle), "  " + T.thin, up(T.notSure), "  " + T.notSureLede].join("\n"), withoutEnglish(gotText, summary));
        c.check(!!x && Object.values(x.present).every((xs) => !xs.length), `${at}/@AD14-disjoint`, input, "no AD14 source in the thin block or the lede", x && x.present);
      }
    }

    // The §8.5 Patient matrix.
    const rng = h.rng(h.seed ^ 0x50415449); // "PATI"
    const spec = {
      items,
      contextOptions: Object.fromEntries(pat.CONTEXT_Q.map((q) => [q.id, q.opts.map(([v]) => v)])),
      flagIds: pat.RED_FLAGS.map((f) => f.id),
      locales: LOCALES,
    };
    const clinOf = Object.fromEntries(LOCALE_DELTA.added.filter((r) => /\/items\/[^/]+\/clin$/.test(r.path)).map((r) => [r.path.split("/")[4], r.value]));
    const itemById = Object.fromEntries(view.domains.flatMap((d) => d.items).map((it) => [it.id, it]));
    const tSum = ad14Tally(), tText = ad14Tally();
    let n = 0, errors = 0, caveatSeen = 0, esClin = 0;
    const date = GENERATED_AT.slice(0, 10);
    for (const s of patientStream(rng, spec, sizes(h.quick).patient)) {
      const flags = pat.RED_FLAGS.filter((f) => s.rf[f.id]).map((f) => pat.rfFor(s.loc, f));
      const urgent = flags.some((f) => f.tier === "now");
      const input = { a: s.a, ctx: s.ctx, rf: s.rf, loc: s.loc };
      const want = pat.buildSummary({ a: s.a, ctx: s.ctx, flags, urgent, loc: s.loc });
      const { summary, error } = patient.buildPatientSummary(view, s.loc, { a: s.a, ctx: s.ctx, flags: s.rf, urgent });
      n++;
      if (error || !summary) {
        errors++;
        c.check(false, "/buildPatientSummary/error", input, "a summary", error ? `${error.ruleId}: ${error.message}` : "null");
        continue;
      }
      c.diff(pickKeys(want, SUMMARY_KEYS), pickKeys(summary, SUMMARY_KEYS), { at: "/summary", input, keyOrder: true, allow: allowFor(s.loc), ctx: ctxFor(s.loc) });
      c.diff(want.flags.map((f) => ({ id: f.id, tier: f.tier, q: f.q, say: f.say })),
        (summary.flags || []).map((f) => ({ id: f.id, tier: tierKey(f.tier), q: f.q, say: f.say })), { at: "/summary/flags", input, keyOrder: true });
      if (s.loc === "es") {
        for (const k of ["said", "ask"]) (want[k] || []).forEach((x, i) => tSum.add(P14, x, (summary[k] || [])[i]));
        (want.clin || []).forEach((x, i) => tSum.add(P14, x, (summary.clin || [])[i]));
        // D3: every es clinician entry is the item's Spanish clin line (+ the es option), lang "es".
        for (const e of summary.clin || []) {
          esClin++;
          const id = Object.keys(clinOf).find((k) => e.t === clinOf[k] || e.t.startsWith(`${clinOf[k]} [`));
          c.check(!!id && e.lang === "es" && Math.abs(itemById[id].w) === e.w, "/summary/clin/@es", { t: e.t }, "the item's es clin line, lang es", { t: e.t, lang: e.lang });
        }
      } else {
        for (const e of summary.clin || []) c.check(!Object.prototype.hasOwnProperty.call(e, "lang"), "/summary/clin/@en-no-lang", { t: e.t }, "{w, neg, t} (no lang in English)", Object.keys(e));
      }
      const wantText = pat.summaryText(want, pat.UI[s.loc]);
      const gotText = patient.summaryText(view, s.loc, summary, { generatedAt: GENERATED_AT });
      const r = c.diff(wantText, gotText, { at: "/summaryText", input, allow: txtAllow(s.loc), ctx: txtCtx(want, s.loc, summary) });
      if (r.observed.has("AD10")) caveatSeen++;
      if (AD16.detector(want)) { ad16Pre++; if (r.observed.has("AD16")) ad16Seen++; }
      if (s.loc === "es") {
        ad20Pre++; if (r.observed.has("AD20")) ad20Seen++;
        tText.add(P14, after4(wantText, gotText), withoutEnglish(gotText, summary), { marker: true });
      } else if (gotText.includes(patient.PATIENT_CHROME.en.englishVersion.toUpperCase())) {
        c.check(false, "/summaryText/en/@noEnglishVersion", input, "no English version block in English", "present");
      }
      twinChecks("/summary", input, summary, s.loc, { a: s.a, ctx: s.ctx, rf: s.rf, urgent });
      // D9: the dated line carries the Spanish companion in es only.
      const last = gotText.split("\n").pop();
      const wantLast = s.loc === "es" ? `${CAV.prototype}${AD14_MARKER_JOIN}${CAV.prototypeCompanion.es} · ${date}` : `${CAV.prototype} · ${date}`;
      if (last !== wantLast) c.check(false, `/summaryText/${s.loc}/dated`, input, wantLast, last);
      if (n % 2000 === 0) await new Promise((res) => setTimeout(res, 0));
    }
    h.expect("AD10", { precondition: n > errors, observed: caveatSeen === n - errors });
    h.expect("AD16", { precondition: ad16Pre > 0, observed: ad16Seen === ad16Pre });
    h.expect("AD20", { precondition: ad20Pre > 0, observed: ad20Seen === ad20Pre });
    c.check(ad20Pre > 0 && ad20Seen === ad20Pre && enTwins === ad20Pre, "/summaryText/es/@AD20", null, "every es export carries the English version (AD20) of its English twin",
      { exports: ad20Pre, excused: ad20Seen, twins: enTwins });
    c.note(`release 0.4.8: ${enTwins} es summaries carry an English twin equal to the baseline's English summary; AD20 on ${ad20Seen}/${ad20Pre} es exports`);
    tSum.expect(h, c, "/summary/es", { need: ["C", "J"] });
    tText.expect(h, c, "/summaryText/es", { need: ["C", "Q", "M"] });
    c.check(esClin > 0, "/summary/clin/@es/occurs", null, "es clinician entries checked", esClin);
    c.note(`${n} Patient states (seed 0x${h.seed.toString(16)}); ${errors} withheld summaries; the dated caveat line closed ${caveatSeen} exports`);
    c.note(`AD14 (es) per rule, observed/where its source occurs — askForm: ${tAsk.note()}; summary: ${tSum.note()}; summaryText: ${tText.note()}; ${esClin} es clinician entries`);
    c.note(`AD16 (thin warning / not-sure lede in the .txt) seen ${ad16Seen}/${ad16Pre}, ${thinCases.length * LOCALES.length} of them the thin cases`);

    // ------------------------------------------------------------------ AD14 self-checks
    const clinRow = LOCALE_DELTA.added.find((r) => r.path === "/locales/es/items/m_head/clin");
    const crafted = selfCheckPairs(P14, {
      prototype: CAV.prototype, companion: CAV.prototypeCompanion.es, q: P14.questions[0],
      clinEn: clinRow.en, clinEs: clinRow.value, iWord: P14.iWords[0],
    });
    let wrongLoc = 0;
    for (const [label, a, b, path, excused] of crafted) {
      // AD10 rides along (as in the suites) so that the dated-line cases test AD14 alone.
      const r = deepDiff(a, b, { at: path, allow: ["AD14", "AD10"], ctx: { AD14: P14, AD10: { notices: [] }, loc: "es" } });
      const ok = excused ? r.diffs.length === 0 && r.observed.has("AD14") : r.diffs.length > 0;
      c.check(ok, "/AD14/self-check", { label }, excused ? "excused by AD14" : "NOT excused", excused ? r.diffs.slice(0, 2) : "excused");
      if (!excused) continue;
      // The same comparison in English mode, or naming no locale, is never excused, although it
      // carries the same parameters: AD14 acts only where ctx.loc is its locale.
      for (const [what, ctx] of [["English mode (ctx.loc \"en\")", { AD14: P14, AD10: { notices: [] }, loc: "en" }], ["no ctx.loc", { AD14: P14, AD10: { notices: [] } }]]) {
        const rx = deepDiff(a, b, { at: path, allow: ["AD14", "AD10"], ctx });
        c.check(rx.diffs.length > 0 && !rx.observed.has("AD14"), "/AD14/self-check/loc", { label, what }, "NOT excused", rx.observed.has("AD14") ? "excused" : rx.diffs);
        wrongLoc += 1;
      }
    }
    // An English comparison is never touched, even with a crafted parameter object.
    const enP = { ...P14, locale: "en" };
    const rEn = deepDiff(P14.pairs[0][0], P14.pairs[0][1], { allow: ["AD14"], ctx: { AD14: enP, loc: "en" } });
    c.check(rEn.diffs.length > 0 && !rEn.observed.has("AD14"), "/AD14/self-check", { label: "an English-mode difference" }, "NOT excused", "excused");
    const AD14 = allowedDifference("AD14");
    c.check(AD14.appliesTo("/t", {}) === false, "/AD14/self-check", { label: "no parameters" }, "does not apply", "applies");
    for (const [label, ctx, want] of [
      ["parameters, no ctx.loc", { AD14: P14 }, false],
      ["parameters, ctx.loc \"en\"", { AD14: P14, loc: "en" }, false],
      ["parameters, another locale", { AD14: P14, loc: "fr" }, false],
      ["parameters, ctx.loc \"es\"", { AD14: P14, loc: "es" }, true],
    ]) c.check(AD14.appliesTo("/t", ctx) === want, "/AD14/self-check/appliesTo", { label }, want ? "applies" : "does not apply", AD14.appliesTo("/t", ctx));
    // ad14Params refuses what would widen AD14.
    const refuse = (label, mutate) => {
      const d = JSON.parse(JSON.stringify(LOCALE_DELTA));
      const input = mutate(d) || { delta: d };
      let threw = false;
      try { ad14Params({ chromeEn: patient.PATIENT_CHROME.en, chromeLoc: patient.PATIENT_CHROME.es, ...input }); } catch (e) { threw = true; }
      c.check(threw, "/AD14/self-check/ad14Params", { label }, "refused (throws)", "accepted");
    };
    refuse("a changed context value code", (d) => { d.added[0].value.c_dur.opts[2][0] = ">1y"; });
    refuse("a context option dropped", (d) => { d.added[0].value.c_clin.opts.pop(); });
    refuse("another context item", (d) => { d.added[0].value.c_other = d.added[0].value.c_dur; });
    refuse("a forYouIf line dropped", (d) => { d.added.find((r) => r.path.endsWith("/forYouIf")).value.pop(); });
    refuse("a chrome row whose English is not PATIENT_CHROME.en", (d) => { d.chrome[0].en += " (edited)"; });
    refuse("a delta for English", (d) => { d.locale = "en"; d.added.forEach((r) => { r.path = r.path.replace("/locales/es/", "/locales/en/"); }); });
    refuse("an already opened question", (d) => ({ delta: d, questions: ["¿Ya abierta?"] }));
    refuse("a statement offered as a question", (d) => ({ delta: d, questions: ["No es pregunta."] }));
    refuse("a marker without its companion", (d) => ({ delta: d, marker: { en: CAV.prototype, companion: "" } }));
    let accepted = null;
    try { accepted = ad14Params({ delta: LOCALE_DELTA, chromeEn: patient.PATIENT_CHROME.en, chromeLoc: patient.PATIENT_CHROME.es }); } catch (e) { accepted = String(e.message); }
    c.check(accepted && typeof accepted === "object" && accepted.pairs.length > 0, "/AD14/self-check/ad14Params", { label: "the shipped delta" }, "accepted", accepted);
    c.note(`AD14 self-checks: ${crafted.length + 1 + wrongLoc} crafted comparisons (${crafted.filter((x) => !x[4]).length + 1 + wrongLoc} that must not be excused, ${wrongLoc} of them an excusable es pair re-run in English mode or with no ctx.loc), 5 appliesTo contexts, 10 ad14Params inputs`);

    // ------------------------------------------------------------------ the bilingual exports (release 0.4.8)
    // A full Spanish summary (every item answered, some "Not sure", every flag, the gap markers): its
    // .txt and .html carry the Spanish findings, then the English version, titled in Spanish and in
    // English, whose findings are exactly the English export's of the same answers; the English
    // export carries none. No score, band or probability is added (OMISSION_PATTERNS).
    {
      const a = {};
      items.forEach((it, i) => { a[it.id] = it.scale ? it.scale.length - 1 : (i % 5 === 0 ? "unsure" : "yes"); });
      const ctx = Object.fromEntries(pat.CONTEXT_Q.map((q) => [q.id, q.opts[q.opts.length - 1][0]]));
      const rf = Object.fromEntries(pat.RED_FLAGS.map((f) => [f.id, true]));
      const es = patient.buildPatientSummary(view, "es", { a, ctx, flags: rf });
      const en = patient.buildPatientSummary(view, "en", { a, ctx, flags: rf });
      if (c.check(!es.error && !en.error && !!es.summary && !!en.summary, "/bilingual/summaries", null, "both summaries", [es.error, en.error])) {
        const T = patient.PATIENT_CHROME, up = (x) => String(x).toUpperCase();
        c.diff(JSON.parse(JSON.stringify(en.summary)), JSON.parse(JSON.stringify(es.summary.english)), { at: "/bilingual/english/@twin" });
        const esTxt = patient.summaryText(view, "es", es.summary, { generatedAt: GENERATED_AT });
        const enTxt = patient.summaryText(view, "en", en.summary, { generatedAt: GENERATED_AT });
        const L = esTxt.split("\n");
        const t0 = L.indexOf(up(T.es.englishVersion));
        c.check(t0 > 0 && L[t0 - 1] === "=".repeat(40) && L[t0 + 1] === up(T.en.englishVersion) && L[t0 + 2] === "=".repeat(40) && L[t0 + 3] === "", "/bilingual/txt/title", null,
          "rule, the Spanish and the English title, rule, blank", L.slice(Math.max(0, t0 - 1), t0 + 4));
        const enBody = ad20EnglishBody(enTxt);
        c.diff(enBody, L.slice(t0 + 4, L.lastIndexOf(AD20_FOOTER_RULE)), { at: "/bilingual/txt/english" });
        c.check(L.indexOf(up(T.es.forClinician)) > 0 && L.indexOf(up(T.es.forClinician)) < t0 && L.indexOf(up(T.en.forClinician)) > t0, "/bilingual/txt/order", null,
          "the Spanish clinician block, then the English version with its own clinician block", [L.indexOf(up(T.es.forClinician)), t0, L.indexOf(up(T.en.forClinician))]);
        c.check(L[L.length - 1].startsWith(`${CAV.prototype}${AD14_MARKER_JOIN}${CAV.prototypeCompanion.es}`) && L.includes(`${view.name} v${policy.APP_VERSION} — ${T.es.txtFooter}`), "/bilingual/txt/footer", null,
          "the Spanish footer and the dated marker with its companion, last", L.slice(-3));
        c.check(!enTxt.includes(up(T.en.englishVersion)) && !enTxt.includes(up(T.es.englishVersion)), "/bilingual/txt/en-unchanged", null, "no English version in an English export", "present");
        // .html: one section lang="en", after the Spanish clinician block and before the disclaimer,
        // titled in Spanish (lang es) and English, holding exactly the English export's findings.
        const esDoc = new DOMParser().parseFromString(patient.summaryHtml(view, "es", es.summary, { generatedAt: GENERATED_AT }), "text/html");
        const enDoc = new DOMParser().parseFromString(patient.summaryHtml(view, "en", en.summary, { generatedAt: GENERATED_AT }), "text/html");
        const secs = [...esDoc.querySelectorAll("section.enver")];
        const sec = secs[0];
        const blocksOf = (root, from) => { const out = []; for (let el = from; el && !el.matches(".disc"); el = el.nextElementSibling) out.push(el.outerHTML); return out; };
        const enBlocks = blocksOf(enDoc, enDoc.querySelector("h1").nextElementSibling);
        const secBlocks = sec ? [...sec.children].slice(1).map((el) => el.outerHTML) : [];
        const h2 = sec ? sec.querySelector(":scope > h2") : null;
        c.check(secs.length === 1 && sec.getAttribute("lang") === "en" && !!h2 && JSON.stringify([...h2.children].map((x) => [x.textContent, x.getAttribute("lang")])) === JSON.stringify([[T.es.englishVersion, "es"], [T.en.englishVersion, null]])
          && sec.nextElementSibling && sec.nextElementSibling.matches(".disc") && sec.previousElementSibling && sec.previousElementSibling.matches(".sum.clin"),
        "/bilingual/html/section", null, "one section lang en, titled in Spanish (lang es) and English, between the Spanish clinician block and the disclaimer", sec ? sec.outerHTML.slice(0, 200) : "absent");
        c.diff(enBlocks, secBlocks, { at: "/bilingual/html/english" });
        c.check(!enDoc.querySelector("section.enver"), "/bilingual/html/en-unchanged", null, "no English version in an English export", "present");
        for (const [kind, text] of [["txt", esTxt], ["html", htmlBodyText(esDoc)]]) {
          for (const re of policy.OMISSION_PATTERNS) {
            const hit = re.exec(text);
            c.check(!hit, `/bilingual/${kind}/@pattern`, { pattern: String(re) }, "no match", hit && text.slice(Math.max(0, hit.index - 40), hit.index + 40));
          }
        }
        // Withheld together: if the English summary fails, the Spanish one is withheld too (no
        // bilingual summary without its English part).
        const thrower = () => { throw new Error("injected English failure"); };
        const enOnly = { ...view, locales: { ...view.locales, en: { ...view.locales.en, sum: { ...view.locales.en.sum, clinNote: thrower } } } };
        const wv = patient.buildPatientSummary(enOnly, "es", { a, ctx, flags: rf });
        c.check(wv.summary === null && !!wv.error && wv.error.family === "patient", "/bilingual/withheld-together", null, "the es summary withheld with the English error", wv.error);
      }
    }

    // ------------------------------------------------------------------ the English version's caveats (release 0.4.8, final review)
    // The English version repeats the caveat lines English output prints for the same view, so an
    // English-speaking clinician reading only the English part is told, in English, that the
    // questionnaire was uploaded or changed locally and that its English wording was edited. The final
    // review found them in Spanish only (provenanceKinds ["uploaded"]: the es .txt tail and the es .html
    // notices Spanish, no notice in section.enver).
    {
      const T = patient.PATIENT_CHROME, up = (x) => String(x).toUpperCase();
      const a = {};
      items.forEach((it, i) => { a[it.id] = it.scale ? it.scale.length - 1 : (i % 4 === 0 ? "unsure" : "yes"); });
      const rf = { [pat.RED_FLAGS[0].id]: true };
      const withEn = (v, en) => ({ ...v, locales: { ...v.locales, en: { ...v.locales.en, ...en } } });
      const withEs = (v, es) => ({ ...v, locales: { ...v.locales, es: { ...v.locales.es, ...es } } });
      const variants = [
        ["the built-in module", view, [], []],
        ["an uploaded module", { ...view, provenanceKinds: ["uploaded"] }, [CAV.patient.uploaded.en], [CAV.patient.uploaded.es]],
        ["a derivation with an edited English", withEn({ ...view, provenanceKinds: ["edited"] }, { editedLocally: true, reviewed: false }),
          [CAV.patient.edited.en, CAV.editedWording.en], [CAV.patient.edited.es]],
        ["a derivation of an upload, English edited, es stale", withEs(withEn({ ...view, provenanceKinds: ["edited", "uploaded"] }, { editedLocally: true, reviewed: false }), { stale: true }),
          [CAV.patient.edited.en, CAV.patient.uploaded.en, CAV.editedWording.en], [CAV.patient.edited.es, CAV.patient.uploaded.es, CAV.staleTranslation.es]],
      ];
      let caveatCases = 0;
      for (const [label, v, wantEn, wantEs] of variants) {
        const at = `/englishCaveats/${label}`;
        const es = patient.buildPatientSummary(v, "es", { a, ctx: {}, flags: rf });
        const en = patient.buildPatientSummary(v, "en", { a, ctx: {}, flags: rf });
        if (!c.check(!es.error && !en.error && !!es.summary && !!en.summary, `${at}/summaries`, null, "both summaries", [es.error, en.error])) continue;
        caveatCases++;
        c.diff(wantEn, patient.englishVersionNotices(v), { at: `${at}/englishVersionNotices` });
        const enTxt = patient.summaryText(v, "en", en.summary, { generatedAt: GENERATED_AT });
        const esTxt = patient.summaryText(v, "es", es.summary, { generatedAt: GENERATED_AT });
        // The lines English output prints for this view are exactly these (its .txt, after the footer line).
        c.diff(wantEn, ad20EnglishNotices(enTxt), { at: `${at}/en/txt/notices` });
        // .txt: rule, the two titles, rule, blank, the English caveat lines and a blank (when any), then
        // the English findings, right before the footer rule; AD20 excuses exactly that block.
        const L = esTxt.split("\n");
        const t0 = L.indexOf(up(T.es.englishVersion));
        const block = ad20Block(T.es.englishVersion, T.en.englishVersion, ad20EnglishBody(enTxt), wantEn);
        c.diff(block, L.slice(t0 - 1, L.lastIndexOf(AD20_FOOTER_RULE)), { at: `${at}/es/txt/block` });
        const under = wantEn.length ? [...wantEn, ""] : [];
        c.diff(under, L.slice(t0 + 4, t0 + 4 + under.length), { at: `${at}/es/txt/under-title` });
        c.check(L[t0 + 4 + under.length] !== "" && !wantEn.includes(L[t0 + 4 + under.length]), `${at}/es/txt/then-findings`, null, "the English findings follow", L[t0 + 4 + under.length]);
        c.check(AD20.detector({ p: { locale: "es", block }, text: esTxt }), `${at}/es/txt/@AD20`, null, "AD20 holds the block where it belongs", "not held");
        // Outside the English version the Spanish notices stay Spanish, after the Spanish footer line.
        const rest = AD20.normalise("", esTxt, { AD20: { locale: "es", block }, loc: "es" })[1].split("\n");
        const fr = rest.lastIndexOf(AD20_FOOTER_RULE);
        c.diff(wantEs, rest.slice(fr + 2, -1), { at: `${at}/es/txt/spanishNotices` });
        c.check(wantEn.every((l) => !rest.includes(l)), `${at}/es/txt/noEnglishOutside`, null, "no English caveat line outside the English version", rest.filter((l) => wantEn.includes(l)));
        // .html: the section holds the English caveat lines first (untagged p.notice, as the English
        // .html prints them before its title), then the English .html's findings; the Spanish notices
        // before the Spanish title stay Spanish and tagged es.
        const esHtml = patient.summaryHtml(v, "es", es.summary, { generatedAt: GENERATED_AT });
        const enHtml = patient.summaryHtml(v, "en", en.summary, { generatedAt: GENERATED_AT });
        const esDoc = new DOMParser().parseFromString(esHtml, "text/html");
        const enDoc = new DOMParser().parseFromString(enHtml, "text/html");
        const sec = esDoc.querySelector("section.enver");
        const kids = sec ? [...sec.children].slice(1) : [];
        const secNotes = kids.filter((el) => el.matches("p.notice"));
        c.check(!!sec && kids.slice(0, wantEn.length).every((el) => el.matches("p.notice") && !el.hasAttribute("lang")) && secNotes.length === wantEn.length,
          `${at}/es/html/section/notices`, null, "the English caveat lines first in the section, untagged", kids.slice(0, 3).map((el) => el.outerHTML.slice(0, 80)));
        c.diff(wantEn, secNotes.map((el) => el.textContent), { at: `${at}/es/html/section/notices/text` });
        c.diff([...enDoc.querySelectorAll("p.notice")].map((el) => el.textContent), secNotes.map((el) => el.textContent), { at: `${at}/es/html/section/notices/=en` });
        const blocksOf = (from) => { const out = []; for (let el = from; el && !el.matches(".disc"); el = el.nextElementSibling) out.push(el.outerHTML); return out; };
        c.diff(blocksOf(enDoc.querySelector("h1").nextElementSibling), kids.slice(wantEn.length).map((el) => el.outerHTML), { at: `${at}/es/html/section/findings` });
        const outside = [...esDoc.querySelectorAll("p.notice")].filter((el) => !el.closest("section.enver"));
        c.diff(wantEs.map((t) => [t, "es"]), outside.map((el) => [el.textContent, el.getAttribute("lang")]), { at: `${at}/es/html/spanishNotices` });
        // English output carries no English version.
        c.check(!enHtml.includes("enver") && !enTxt.includes(up(T.en.englishVersion)), `${at}/en/@noEnglishVersion`, null, "no English version (and no .enver rule) in English output", "present");
      }
      c.check(caveatCases === variants.length, "/englishCaveats/@cases", null, variants.length, caveatCases);
      c.note(`release 0.4.8 final review: the English version's caveat lines checked on ${caveatCases} views (built-in, upload, edited English, derivation of an upload with an edited English and a stale es), .txt and .html`);
    }

    // ------------------------------------------------------------------ the .html stylesheets (release 0.4.8, final review)
    // An English .html keeps release 0.4.7's stylesheet byte for byte (the final review found four unused
    // .enver rules in it); a bilingual .html appends the English version's rules, whose print rule keeps
    // the title with the block under it.
    {
      const hash = await h.engine("hash.js");
      const a = {};
      items.forEach((it) => { a[it.id] = it.scale ? 0 : "no"; });
      const sets = [["thin", {}, {}], ["answered", a, {}], ["flagged", a, { [pat.RED_FLAGS[0].id]: true }]];
      for (const [label, ans, rf] of sets) {
        const en = patient.buildPatientSummary(view, "en", { a: ans, ctx: {}, flags: rf });
        const es = patient.buildPatientSummary(view, "es", { a: ans, ctx: {}, flags: rf });
        if (!c.check(!!en.summary && !!es.summary, `/htmlStyle/${label}/summaries`, null, "both summaries", [en.error, es.error])) continue;
        const enStyle = styleOf(patient.summaryHtml(view, "en", en.summary, { generatedAt: GENERATED_AT }));
        const esStyle = styleOf(patient.summaryHtml(view, "es", es.summary, { generatedAt: GENERATED_AT }));
        const got = enStyle === null ? null : await hash.sha256Hex(enStyle);
        c.check(got === EXPORT_STYLE_047_SHA256 && !/enver/.test(enStyle), `/htmlStyle/${label}/en`, null, `release 0.4.7's stylesheet (sha256 ${EXPORT_STYLE_047_SHA256.slice(0, 8)}…), no .enver rule`, got);
        c.check(esStyle !== null && enStyle !== null && esStyle.startsWith(enStyle) && /^\.enver\{/.test(esStyle.slice(enStyle.length)), `/htmlStyle/${label}/es`, null,
          "the English stylesheet, then the English version's rules", esStyle && esStyle.slice(enStyle ? enStyle.length : 0, (enStyle ? enStyle.length : 0) + 60));
        const tr = esStyle ? printRule(esStyle, ".enver-title") : null;
        const sc = esStyle ? printRule(esStyle, ".sum, .call") : null;
        c.check(!!tr && tr.getPropertyValue("break-after") === "avoid" && tr.getPropertyValue("break-inside") === "avoid" && !!sc && sc.getPropertyValue("break-inside") === "avoid", `/htmlStyle/${label}/es/print`, null,
          "@media print: .enver-title{break-inside:avoid;break-after:avoid}; .sum,.call{break-inside:avoid}", { title: tr && tr.cssText, blocks: sc && sc.cssText });
      }
    }

    // ------------------------------------------------------------------ AD20 self-checks (release 0.4.8)
    // Crafted .txt pairs: AD20 removes the exact English version block right before the footer rule,
    // and nothing else; never in English or without ctx.loc; malformed parameters excuse nothing.
    {
      const R = AD20_FOOTER_RULE;
      const T = patient.PATIENT_CHROME;
      const enBody = ["WHAT I WANT TO DESCRIBE", "  - a", ""];
      const block = ad20Block(T.es.englishVersion, T.en.englishVersion, enBody);
      const head = ["MI RESUMEN", "=".repeat(40), "", "LO QUE QUIERO DESCRIBIR", "  - b", ""];
      const base = [...head, R, "F"].join("\n");
      const good = [...head, ...block, R, "F"].join("\n");
      const P = (extra = {}) => ({ AD20: { locale: "es", block, ...extra }, loc: "es" });
      const cases20 = [
        ["the block right before the footer rule", base, good, true, P()],
        ["the block at the top", base, [...block, ...head, R, "F"].join("\n"), false, P()],
        ["the block after the footer rule", base, [...head, R, ...block, "F"].join("\n"), false, P()],
        ["the block twice", base, [...head, ...block, ...block, R, "F"].join("\n"), false, P()],
        ["other English lines", base, good.replace("  - a", "  - z"), false, P()],
        ["a line missing", base, [...head, ...block.slice(0, -1), R, "F"].join("\n"), false, P()],
        ["the block plus another change", base, good.replace("  - b", "  - c"), false, P()],
        ["English mode (ctx.loc en)", base, good, false, { AD20: { locale: "es", block }, loc: "en" }],
        ["no ctx.loc", base, good, false, { AD20: { locale: "es", block } }],
        ["a parameter object for English", base, good, false, { AD20: { locale: "en", block }, loc: "en" }],
        ["a malformed block (no rules)", base, [...head, ...block.slice(1), R, "F"].join("\n"), false, { AD20: { locale: "es", block: block.slice(1) }, loc: "es" }],
        ["both forms at once", base, good, false, P({ text: "x", before: "y" })],
        ["no parameters", base, good, false, { loc: "es" }],
      ];
      for (const [label, a, b, excused, ctx] of cases20) {
        const r = deepDiff(a, b, { at: "/t", allow: ["AD20"], ctx });
        const ok = excused ? r.diffs.length === 0 && r.observed.has("AD20") : r.diffs.length > 0;
        c.check(ok, "/AD20/self-check", { label }, excused ? "excused by AD20" : "NOT excused", excused ? r.diffs.slice(0, 2) : "excused");
      }
      // The rendered form: the section's text right before the disclaimer, once.
      const textCases = [
        ["the section before the disclaimer", "AB DISC", "AB EN DISC", true],
        ["the section elsewhere", "AB DISC", "EN AB DISC", false],
        ["the section twice", "AB DISC", "AB EN EN DISC", false],
        ["other English text", "AB DISC", "AB EX DISC", false],
      ];
      for (const [label, a, b, excused] of textCases) {
        const r = deepDiff(a, b, { at: "/t", allow: ["AD20"], ctx: { AD20: { locale: "es", text: "EN ", before: "DISC" }, loc: "es" } });
        const ok = excused ? r.diffs.length === 0 && r.observed.has("AD20") : r.diffs.length > 0;
        c.check(ok, "/AD20/self-check/rendered", { label }, excused ? "excused by AD20" : "NOT excused", excused ? r.diffs.slice(0, 2) : "excused");
      }
      c.check(AD20.detector({ p: { locale: "es", block }, text: good }) && !AD20.detector({ p: { locale: "es", block }, text: base }) && !AD20.detector({ p: { locale: "en", block }, text: good }),
        "/AD20/detector", null, "the precondition only for a new side holding the block where it belongs", null);
      // ad20EnglishBody cuts an English .txt between its header and its footer rule.
      c.diff(["S", "  - x", ""], ad20EnglishBody(["T", "=".repeat(40), "", "S", "  - x", "", R, "F"].join("\n")), { at: "/AD20/ad20EnglishBody" });
      c.check(ad20EnglishBody("no rule") === null, "/AD20/ad20EnglishBody/no-rule", null, null, ad20EnglishBody("no rule"));
      // Release 0.4.8, final review: a block headed by the English caveat lines (then a blank) is excused
      // only with exactly those lines; ad20EnglishNotices reads them from an English .txt (after the
      // footer line, before the dated caveat line).
      const notes = [CAV.patient.uploaded.en];
      const blockN = ad20Block(T.es.englishVersion, T.en.englishVersion, enBody, notes);
      c.diff(["=".repeat(40), T.es.englishVersion.toUpperCase(), T.en.englishVersion.toUpperCase(), "=".repeat(40), "", notes[0], "", ...enBody], blockN, { at: "/AD20/ad20Block/notices" });
      c.diff(block, ad20Block(T.es.englishVersion, T.en.englishVersion, enBody, []), { at: "/AD20/ad20Block/no-notices" });
      const goodN = [...head, ...blockN, R, "F"].join("\n");
      const casesN = [
        ["the block with its caveat lines", goodN, blockN, true],
        ["caveat lines the parameter does not name", goodN, block, false],
        ["the parameter's caveat lines missing", good, blockN, false],
        ["other caveat lines", goodN.replace(notes[0], CAV.patient.edited.en), blockN, false],
      ];
      for (const [label, b, blk, excused] of casesN) {
        const r = deepDiff(base, b, { at: "/t", allow: ["AD20"], ctx: { AD20: { locale: "es", block: blk }, loc: "es" } });
        const ok = excused ? r.diffs.length === 0 && r.observed.has("AD20") : r.diffs.length > 0;
        c.check(ok, "/AD20/self-check/notices", { label }, excused ? "excused by AD20" : "NOT excused", excused ? r.diffs.slice(0, 2) : "excused");
      }
      const DATED = `${CAV.prototype} · 2026-10-01`;
      c.diff(["N1", "N2"], ad20EnglishNotices(["T", "=".repeat(40), "", "S", "", R, "FOOT", "N1", "N2", DATED].join("\n")), { at: "/AD20/ad20EnglishNotices" });
      c.diff([], ad20EnglishNotices(["T", "=".repeat(40), "", "S", "", R, "FOOT", DATED].join("\n")), { at: "/AD20/ad20EnglishNotices/none" });
      c.check(ad20EnglishNotices(["T", R, "FOOT", "N1"].join("\n")) === null && ad20EnglishNotices("no rule") === null, "/AD20/ad20EnglishNotices/malformed", null, "null without a dated last line or a footer rule", null);
      c.note(`AD20 self-checks: ${cases20.length} crafted .txt comparisons (${cases20.filter((x) => !x[3]).length} that must not be excused), ${textCases.length} rendered ones, ${casesN.length} with caveat lines (${casesN.filter((x) => !x[3]).length} not excused), the detector, ad20EnglishBody and ad20EnglishNotices`);
    }

    // ------------------------------------------------------------------ AD16 self-checks
    // Crafted .txt pairs built from the baseline's own es strings: AD16 inserts the thin block right
    // after the header and the lede right under the one not-sure heading, and nothing else.
    {
      const ui = pat.UI.es, en = pat.UI.en, U = (x) => String(x).toUpperCase();
      const rule = "-".repeat(40);
      const head = [U(ui.summaryTitle), "=".repeat(40), "", ui.txtUnreviewed, ""];
      const block = [U(ui.thinTitle), "  " + ui.thin, ""];
      const lede = "  " + ui.notSureLede;
      const base = [...head, U(ui.notSure), "  - q", "", rule, "F"].join("\n");
      const good = [...head, ...block, U(ui.notSure), lede, "  - q", "", rule, "F"].join("\n");
      const thinUnsure = ad16Params({ said: [], clin: [], flags: [], unsureList: ["x"] }, ui);
      const cases16 = [
        // [label, a, b, excused?, parameters]
        ["the thin block and the lede where the screen has them", base, good, true, thinUnsure],
        ["the thin block only (no not-sure list)", [...head, rule, "F"].join("\n"), [...head, ...block, rule, "F"].join("\n"), true,
          ad16Params({ said: [], clin: [], flags: [], unsureList: [] }, ui)],
        ["the lede only (a summary that is not thin)", base, [...head, U(ui.notSure), lede, "  - q", "", rule, "F"].join("\n"), true,
          ad16Params({ said: ["s"], clin: [], flags: [], unsureList: ["x"] }, ui)],
        ["the block before the unreviewed line", base, [...head.slice(0, 3), ...block, ...head.slice(3), U(ui.notSure), lede, "  - q", "", rule, "F"].join("\n"), false, thinUnsure],
        ["the block at the end", base, [...head, U(ui.notSure), lede, "  - q", "", rule, "F", ...block].join("\n"), false, thinUnsure],
        ["other words in the block", base, good.replace(ui.thin, `${ui.thin} (más)`), false, thinUnsure],
        ["the English strings in an es export", base, [...head, U(en.thinTitle), "  " + en.thin, "", U(ui.notSure), "  " + en.notSureLede, "  - q", "", rule, "F"].join("\n"), false, thinUnsure],
        ["the lede under another heading", [...head, U(ui.notSure), "  - q", "", "OTRA", "  - r", "", rule, "F"].join("\n"),
          [...head, ...block, U(ui.notSure), "  - q", "", "OTRA", lede, "  - r", "", rule, "F"].join("\n"), false, thinUnsure],
        ["the block on a summary that is not thin", base, good, false, ad16Params({ said: ["s"], clin: [], flags: [], unsureList: ["x"] }, ui)],
        ["an extra line besides the block and the lede", base, good.replace("  - q", "  - q\n  - r"), false, thinUnsure],
      ];
      for (const [label, a, b, excused, P] of cases16) {
        const r = deepDiff(a, b, { at: "/t", allow: ["AD16"], ctx: P ? { AD16: P } : {} });
        const ok = excused ? r.diffs.length === 0 && r.observed.has("AD16") : r.diffs.length > 0;
        c.check(ok, "/AD16/self-check", { label }, excused ? "excused by AD16" : "NOT excused", excused ? r.diffs.slice(0, 2) : "excused");
      }
      const AD16x = allowedDifference("AD16");
      c.check(AD16x.appliesTo("/t", {}) === false, "/AD16/self-check", { label: "no parameters" }, "does not apply", "applies");
      c.check(ad16Params({ said: ["s"], clin: [], flags: [], unsureList: [] }, ui) === null, "/AD16/self-check/ad16Params", { label: "not thin, no Not sure" }, null, "parameters");
      c.note(`AD16 self-checks: ${cases16.length} crafted .txt comparisons (${cases16.filter((x) => !x[3]).length} that must not be excused), no parameters, a summary with neither difference`);
    }
    return c.result();
  }),
};
