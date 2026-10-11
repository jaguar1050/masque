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
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { flatItems, patientStream, sizes } from "../harness/matrix.js";
import { AD14_MARKER_JOIN, ad14Explain, ad14ISound, ad14Params, ad16Params, allowedDifference, deepDiff } from "../harness/diff.js";
import { LOCALE_DELTA } from "../harness/locale-delta.js";
import { ad14Context, ad14Tally } from "../harness/spanish.js";

const GENERATED_AT = "2026-10-01T12:00:00.000Z";
const LOCALES = ["en", "es"];
const SUMMARY_KEYS = ["said", "ask", "gapLine", "unsureList", "clin", "urgent"];

const pickKeys = (o, keys) => Object.fromEntries(keys.map((k) => [k, o ? o[k] : undefined]));

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
    const txtAllow = (loc) => (loc === "es" ? ["AD4", "AD14", "AD10", "AD16"] : ["AD4", "AD10", "AD16"]);
    const txtCtx = (want, loc) => {
      const p = ad16Params(want, pat.UI[loc]);
      return { AD10: { notices: [], date: GENERATED_AT.slice(0, 10) }, ...ctxFor(loc), ...(p ? { AD16: p } : {}) };
    };
    let ad16Pre = 0, ad16Seen = 0;

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
      const r = c.diff(wantText, gotText, { at: `${at}/summaryText`, input, allow: txtAllow(loc), ctx: txtCtx(want, loc) });
      if (AD16.detector(want)) { ad16Pre++; if (r.observed.has("AD16")) ad16Seen++; }
      // No double excuse: without AD16 the same comparison stays a difference (in es, AD14 and
      // AD10 do not excuse the thin block or the lede).
      const rx = deepDiff(wantText, gotText, { at: `${at}/summaryText`, allow: txtAllow(loc).filter((id) => id !== "AD16"), ctx: txtCtx(want, loc) });
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
        const x = ad14Explain(P14, [up(T.thinTitle), "  " + T.thin, up(T.notSure), "  " + T.notSureLede].join("\n"), gotText);
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
      const r = c.diff(wantText, gotText, { at: "/summaryText", input, allow: txtAllow(s.loc), ctx: txtCtx(want, s.loc) });
      if (r.observed.has("AD10")) caveatSeen++;
      if (AD16.detector(want)) { ad16Pre++; if (r.observed.has("AD16")) ad16Seen++; }
      if (s.loc === "es") tText.add(P14, after4(wantText, gotText), gotText, { marker: true });
      // D9: the dated line carries the Spanish companion in es only.
      const last = gotText.split("\n").pop();
      const wantLast = s.loc === "es" ? `${CAV.prototype}${AD14_MARKER_JOIN}${CAV.prototypeCompanion.es} · ${date}` : `${CAV.prototype} · ${date}`;
      if (last !== wantLast) c.check(false, `/summaryText/${s.loc}/dated`, input, wantLast, last);
      if (n % 2000 === 0) await new Promise((res) => setTimeout(res, 0));
    }
    h.expect("AD10", { precondition: n > errors, observed: caveatSeen === n - errors });
    h.expect("AD16", { precondition: ad16Pre > 0, observed: ad16Seen === ad16Pre });
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
