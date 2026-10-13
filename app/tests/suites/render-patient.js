// tests/suites/render-patient.js — the generic Patient Companion against the frozen baseline
// Patient, rendered (design 03 §8.3 `render`, §5.5, §7.3, §8.4, §9.10). Owner: WP9.
//
// Both components are mounted into detached containers (h.mount, outside StrictMode) and driven
// through their own buttons with flushSync, side by side, under a fixed clock.
//
//   parity    200 seeded Patient answer sets (40 with ?quick=1; the §8.5 Patient stream: each
//             item undefined .15 / "unsure" .10 / a value .75, Patient-vocabulary context, red
//             flags none .8 / one .15 / two .05, loc ∈ {en, es}). For each: pick the locale, then
//             the Intro, the Safety step before and after ticking the flags (or "None of these
//             apply"), every story/domain step after answering it, and the Summary are compared
//             as the textContent of the whole `.wrap` (header, banner, progress, card, nav and
//             footer). The only normalisations are AD4 (the footer's release) and AD10 (es thin /
//             not-sure ledes from UI.es), and in es AD14 between them (release 0.4.2, the Spanish
//             completion: the delta's and the chrome rows' English → Spanish, "¿" on the statement-
//             questions, "y" → "e", the es clinician lines), each of its rules expected wherever its
//             source occurs. The baseline offers no "Not sure" on a scale item, so a
//             drawn "unsure" there is unanswered on both sides. Every es checkpoint of the new side
//             is also DOM-scanned (release 0.4.2): no element tagged lang="en" but the "English"
//             locale button, no English text outside it, and each clinician line tagged lang="es".
//             The summary's action row is compared as its own region: the baseline's
//             [print, download, startOver] becomes [print, download (.txt), download (.html),
//             startOver] (AD10's new .html export; §5.5 labels), asserted exactly.
//             Release 0.4.8 (the clinical lead's request of 2026-10-12): an es summary adds, after its
//             findings, the English version of the same findings (section lang="en", titled in Spanish
//             and in English); its findings are the English summary of the same answers rendered by the
//             companion's own SummaryBody (innerHTML equal), and AD20 (right after AD4) excuses exactly
//             that section's text right before the disclaimer, expected on every es summary; an en
//             summary has no such section.
//   exports   for every parity set that reaches a summary, the .txt and .html files the buttons
//             save (URL.createObjectURL stubbed) are byte-equal to the engine's summaryText /
//             summaryHtml for that summary, dated by the fixed clock, and named t.fileName and
//             its .html twin; Print calls window.print once. The .txt closes with the dated
//             caveat line, which in es (only) carries the Spanish companion of the marker (D9).
// Beyond parity (§9.10 done-when):
//   errors    a summary rule that throws, and a throwing sum.gap: the rule-error card, Print and
//             both downloads disabled (Start over not), onModuleError called once (family
//             "patient"), no summary text rendered; in es the card is the Spanish engine card,
//             tagged lang="es" (D8);
//   print     onPrintContext on mount and on every locale change, incl. editedLocally/stale for
//             a derivation with an edited English and a stale es locale; patientPrintHeader() and
//             its parts (in es: the English marker lang en + its Spanish companion, the
//             unreviewed title and the patient markers in Spanish, lang es);
//   notices   the banner (printed: no `noprint`) carries the es caveat, the edited-wording and
//             stale-translation notices (in the locale's language since release 0.4.2, each
//             tagged); patient provenance lines for non-built-ins (Spanish in es, tagged lang es);
//             never a clinician provenance line;
//   omissions rendered text of Safety, every step and the Summary with every flag on and every
//             item answered, for MASQUE, the shape fixture (a plain upload) and the derivation, in
//             every locale: no flag text/points/action and no OMISSION_PATTERNS match (the
//             Intro's "What it isn't" box, data-testid patient-what-it-isnt, is excluded);
//             the PatientCompanion module graph excludes the scoring/clinician files;
//   other     the "not available" notice for a module without patient wording; onDirty.
//   video     (release 0.4.8, the clinical lead's request of 2026-10-12) with a `video`, en and es: the
//             panel right above the instructions card on the first step only, noprint; its button
//             (aria-expanded, aria-controls) reads the locale's videoHide / videoShow; the iframe is
//             the frame page, sandbox allow-same-origin (no scripts), allow fullscreen, titled with
//             videoTitle; hiding removes the iframe and is remembered for the tab (sessionStorage),
//             also across a remount, and showing forgets it; the es DOM scan passes; no panel without
//             a video; the print CSS hides it; the frame page holds one <video controls
//             preload="none" playsinline> (no autoplay) with its poster and the MP4, no script,
//             noindex and the English prototype marker; the MP4 and the poster are served (HEAD).
//   english   (release 0.4.8, final review) for the shape fixture (an upload) and the derivation, the es
//             summary's English version repeats, right under its title, the caveat lines English mode
//             shows for the same view (its provenance block and its banner notices), untagged inside the
//             section and printed; the built-in shows none; the companion's print stylesheet keeps the
//             English version's title whole and with the block under it (.mp .enver-title{break-inside:
//             avoid;break-after:avoid}) and its urgent box whole (.mp .enver .call{break-inside:avoid}),
//             read through the CSSOM.
import React from "react";
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { flatItems, patientStream } from "../harness/matrix.js";
import { bumpFirstWeight, derivedFixture } from "../harness/derivation.js";
import { allowedDifference } from "../harness/diff.js";
import { LOCALE_DELTA } from "../harness/locale-delta.js";
import { ad14Context, ad14Tally, englishCorpus, englishScan, stringLeaves } from "../harness/spanish.js";

const NOW = "2026-10-01T12:00:00.000Z";
const PAT = "MASQUE_Patient_v0_3.jsx";
const SETS = { full: 200, quick: 40 };
const FORBIDDEN_FILES = ["scoring.js", "fhir.js", "rules.js", "cohort.js", "probes.js", "extraction.js", "scribe.js", "ResearchReadinessPanel.jsx"];
const IMPORT_RE = /(?:^|[\s;}])(?:import|export)\s*(?:[\w*{}\s,$]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const BOOL_INDEX = { yes: 0, no: 1, unsure: 2 };

// ----------------------------------------------------------------------------- DOM helpers

const qa = (root, sel) => (root ? [...root.querySelectorAll(sel)] : []);
const click = (el) => flushSync(() => el.click());

function textOf(el, drop = []) {
  if (!el) return null;
  const c = el.cloneNode(true);
  for (const s of c.querySelectorAll(["style", ...drop].join(","))) s.remove();
  return c.textContent;
}

const wrapOf = (container) => container.querySelector(".mp .wrap");

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
/** The comparable page text: the whole .wrap minus the summary action row. */
const snap = (container) => textOf(wrapOf(container), [".card > .nav.noprint"]);
const actionLabels = (container) => qa(wrapOf(container), ".card > .nav.noprint button").map((b) => textOf(b).trim());
const cardOf = (container) => wrapOf(container).querySelector(":scope > .card");
const nextButton = (container) => {
  const bs = qa(wrapOf(container), ":scope > .nav button");
  return bs[bs.length - 1] || null;
};
const localeButton = (container, loc) => qa(wrapOf(container), ".top .opts button").find((b) => b.getAttribute("lang") === loc) || null;

// ----------------------------------------------------------------------------- driving

/**
 * The plan both components walk: per step, the questions in DOM order with the button index
 * that gives each answer. Built from the view (module order); the baseline renders the same
 * order (CONTEXT_Q then the domain items), which `qcount` checks.
 */
function planFor(view, loc, patient) {
  return view.steps.map((st) => {
    const qs = [];
    if ((st.extras || []).includes("context")) {
      for (const ci of view.contextItems) {
        const w = (view.locales[loc] || view.locales.en).data.contextItems[ci.id] || view.locales.en.data.contextItems[ci.id];
        if (!w) continue;
        qs.push({ kind: "ctx", id: ci.id, values: w.opts.map(([v]) => v) });
      }
    }
    for (const k of st.domainKeys) {
      const d = view.domains.find((x) => x.key === k);
      for (const it of d ? d.items : []) qs.push({ kind: it.scaleLen !== null ? "scale" : "bool", id: it.id });
    }
    return { key: st.key, title: patient.localeText(view, loc, `steps.${st.key}.title`), qs };
  });
}

/** Answer index for one question, or -1 to leave it unanswered. */
function answerIndex(q, s) {
  if (q.kind === "ctx") return s.ctx[q.id] === undefined ? -1 : q.values.indexOf(s.ctx[q.id]);
  const v = s.a[q.id];
  if (v === undefined) return -1;
  if (q.kind === "scale") return typeof v === "number" ? v : -1; // no "Not sure" on a scale (both sides)
  return BOOL_INDEX[v] ?? -1;
}

/**
 * Walk one mounted component through state `s`. Returns the checkpoints
 * [{at, text, actions?}] and any driving problem (a missing button) as `problems`.
 */
function walk(container, s, plan, flagIds, probe = null) {
  const out = [];
  const problems = [];
  const cp = (at, withActions = false) => {
    out.push({ at, text: snap(container), actions: withActions ? actionLabels(container) : undefined });
    if (probe) probe(at);
  };
  if (s.loc !== "en") {
    const b = localeButton(container, s.loc);
    if (!b) { problems.push(`no locale button ${s.loc}`); return { out, problems }; }
    click(b);
  }
  cp("intro");
  click(nextButton(container));
  cp("safety");
  const flagEls = qa(cardOf(container), ".flag");
  if (flagEls.length !== flagIds.length) problems.push(`safety: ${flagEls.length} flags, expected ${flagIds.length}`);
  const ticked = flagIds.filter((id) => s.rf[id]);
  for (const id of ticked) click(flagEls[flagIds.indexOf(id)]);
  if (!ticked.length) {
    const none = qa(cardOf(container), ".nav .btn")[0];
    if (!none) problems.push("safety: no 'none apply' button"); else click(none);
  }
  cp("safety/answered");
  for (const step of plan) {
    const nb = nextButton(container);
    if (!nb || nb.disabled) { problems.push(`cannot leave the step before ${step.key}`); return { out, problems }; }
    click(nb);
    const qEls = qa(cardOf(container), ".q");
    if (qEls.length !== step.qs.length) problems.push(`${step.key}: ${qEls.length} questions, expected ${step.qs.length}`);
    step.qs.forEach((q, i) => {
      const idx = answerIndex(q, s);
      if (idx < 0 || !qEls[i]) return;
      const btn = qa(qEls[i], ".opts button")[idx];
      if (!btn) { problems.push(`${step.key}/${q.id}: no button ${idx}`); return; }
      click(btn);
    });
    cp(`step/${step.key}`);
  }
  click(nextButton(container));
  cp("summary", true);
  return { out, problems };
}

// ----------------------------------------------------------------------------- download capture

/** Run `fn` with downloads and window.print captured; returns {files: [{name, blob}], prints}. */
function captureDownloads(fn) {
  const files = [];
  let prints = 0;
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
  const realClick = HTMLAnchorElement.prototype.click;
  const realPrint = window.print;
  let pending = null;
  URL.createObjectURL = (blob) => { pending = blob; return "blob:render-patient"; };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function captured() { files.push({ name: this.download, blob: pending }); pending = null; };
  window.print = () => { prints += 1; };
  try {
    fn();
  } finally {
    URL.createObjectURL = realCreate;
    HTMLAnchorElement.prototype.click = realClick;
    window.print = realPrint;
    // download.js revokes after 500 ms; keep the stub until then so the real revoke never sees our fake URL.
    setTimeout(() => { URL.revokeObjectURL = realRevoke; }, 600);
  }
  return { files, prints };
}

// ----------------------------------------------------------------------------- module graph

async function moduleGraph(h, entry) {
  const seen = new Set();
  const visit = async (url) => {
    if (seen.has(url)) return;
    seen.add(url);
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = (await res.text()).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1] || m[2];
      if (spec && (spec.startsWith("./") || spec.startsWith("../"))) await visit(new URL(spec, url).href);
    }
  };
  await visit(h.appUrl(entry));
  return [...seen].map((u) => decodeURIComponent(u.slice(u.lastIndexOf("/") + 1)));
}

// ----------------------------------------------------------------------------- the suite

export default {
  name: "render-patient",
  owner: "WP9",
  run: guarded("render-patient", async (h) => {
    const { module: masque, validation } = await loadMasque(h);
    const [patient, policy, bind] = await Promise.all([h.engine("patient.js"), h.engine("policy.js"), h.engine("bind.js")]);
    need(typeof patient.projectForPatient === "function" && typeof patient.summaryHtml === "function", "waits on WP6: patient.js");
    let ns;
    try {
      ns = await h.env.loader.importModule(h.appUrl("src/apps/PatientCompanion.jsx"));
    } catch (err) {
      throw Object.assign(new Error(`waits on WP9: src/apps/PatientCompanion.jsx does not compile: ${String(err.message).split("\n")[0]}`), { waits: true });
    }
    const App = ns.default;
    const [pat, scr] = await Promise.all([h.oracle(PAT), h.oracle("MASQUE_Screener_v0_3.jsx")]);
    const Base = pat.default;
    const c = collector(h);
    c.note(validationNote(validation));
    const view = patient.projectForPatient(masque);
    const flagIds = view.redFlags.map((f) => f.id);
    c.check(JSON.stringify(flagIds) === JSON.stringify(pat.RED_FLAGS.map((f) => f.id)), "/setup/flagOrder", null, pat.RED_FLAGS.map((f) => f.id), flagIds);
    const CAV = policy.CAVEATS;
    const clinicianLines = [CAV.uploaded.en, CAV.edited.en, CAV.scoringChanged.en.split("{root}")[0]];
    // Release 0.4.2: AD14 for es, the es DOM scan, and the Spanish companion of the marker.
    const AD4 = allowedDifference("AD4");
    const P14 = ad14Context({ delta: LOCALE_DELTA, pat, patient, policy, view, loc: "es" });
    const t14 = ad14Tally();
    const COMP = (CAV.prototypeCompanion || {}).es;
    const markerText = (loc) => (loc === "es" ? `${CAV.prototype} \u2014 ${COMP}` : CAV.prototype);
    const corpusFor = (v) => englishCorpus({
      english: [...stringLeaves(patient.PATIENT_CHROME.en), ...stringLeaves(v.locales.en ? v.locales.en.data : {}),
        ...v.domains.flatMap((d) => d.items).map((it) => it.patientClin), CAV.patient.edited.en, CAV.patient.uploaded.en,
        CAV.editedWording.en, CAV.staleTranslation.en, ns.SUMMARY_ERROR.en, ns.UNAVAILABLE_NOTICE.en],
      spanish: [...stringLeaves(patient.PATIENT_CHROME.es), ...stringLeaves(v.locales.es ? v.locales.es.data : {}),
        CAV.patient.edited.es, CAV.patient.uploaded.es, CAV.editedWording.es, CAV.staleTranslation.es],
    });
    const corpusMasque = corpusFor(view);
    let scans = 0, scanTexts = 0;
    /** The es DOM scan of a mounted companion (`container`), as a named check. */
    const scanEs = (at, container, corpus, input = null) => {
      // Release 0.4.8: the English version of the findings is a section tagged lang="en" (its own tag only).
      const r = englishScan(container, { corpus, docLang: "es", allowEn: (el) => el.matches('[data-testid="patient-locale-en"], [data-testid="patient-english-version"]') });
      scans += 1; scanTexts += r.texts;
      c.check(!r.langEn.length, `${at}/@scan/langEn`, input, "no lang=\"en\" inside the Companion but the English button and the English version", r.langEn.slice(0, 5));
      c.check(!r.english.length, `${at}/@scan/english`, input, "no English outside lang=\"en\"", r.english.slice(0, 5));
      return r;
    };
    /** The clinician lines of a summary on screen: tagged per line outside English, the list untagged (D3). */
    const clinLang = (at, container, loc, input = null) => {
      // Release 0.4.8: the English version's clinician lines (inside the section lang="en") are untagged.
      const enLis = qa(wrapOf(container), '[data-testid="patient-english-version"] .clin li');
      if (enLis.length) c.check(loc !== "en" && enLis.every((li) => !li.hasAttribute("lang")), `${at}/english/clin/li/@lang`, input, "untagged inside the English version (es only)", enLis.map((li) => li.getAttribute("lang")).slice(0, 4));
      const lis = qa(wrapOf(container), ".clin li").filter((li) => !li.closest('[data-testid="patient-english-version"]'));
      if (!lis.length) return;
      const ul = wrapOf(container).querySelector(".clin ul");
      c.check(!ul.hasAttribute("lang"), `${at}/clin/ul/@lang`, input, "no lang on the list", ul.getAttribute("lang"));
      const langs = lis.map((li) => li.getAttribute("lang"));
      c.check(loc === "en" ? langs.every((x) => x === null) : langs.every((x) => x === "es"), `${at}/clin/li/@lang`, input, loc === "en" ? "untagged" : "lang es on every line", langs);
    };
    // The scan itself: an untagged English text (a function word; a known English source) and a
    // stray lang="en" inside the Companion are found; the English locale button is allowed.
    {
      const box = document.createElement("div");
      const probeClin = view.domains.flatMap((d) => d.items).map((it) => it.patientClin).find((t) => !/\b(?:the|and|of|to|or|with|for)\b/i.test(t));
      box.innerHTML = '<div data-testid="patient-app"><div class="mp" lang="es"><p>Antes de su consulta</p><p>Before your appointment</p><p class="x"></p>'
        + '<span lang="en">Hello</span><button data-testid="patient-locale-en" lang="en">English</button><p lang="en">the English stays here</p></div></div>';
      box.querySelector("p.x").textContent = probeClin || "";
      const r = englishScan(box, { corpus: corpusMasque, docLang: "es", allowEn: (el) => el.matches('[data-testid="patient-locale-en"]') });
      c.check(!!probeClin && r.english.length === 2 && r.langEn.length === 2, "/scan/self-check", null,
        "2 English texts (a function word, a patientClin source) and 2 stray lang=\"en\" elements found", { english: r.english, langEn: r.langEn });
    }
    // D8: the engine cards carry Spanish; English stays byte for byte.
    c.check(ns.SUMMARY_ERROR && ns.SUMMARY_ERROR.en === "This summary could not be prepared because the module's summary rules failed. Nothing is shown rather than an incomplete summary."
      && typeof ns.SUMMARY_ERROR.es === "string" && ns.SUMMARY_ERROR.es !== "" && ns.SUMMARY_ERROR.es !== ns.SUMMARY_ERROR.en, "/engineCards/SUMMARY_ERROR", null, "{en (unchanged), es}", ns.SUMMARY_ERROR);
    c.check(ns.UNAVAILABLE_NOTICE && ns.UNAVAILABLE_NOTICE.en === "This module carries no patient wording, so the Patient Companion is not available for it."
      && typeof ns.UNAVAILABLE_NOTICE.es === "string" && ns.UNAVAILABLE_NOTICE.es !== "" && ns.UNAVAILABLE_NOTICE.es !== ns.UNAVAILABLE_NOTICE.en, "/engineCards/UNAVAILABLE_NOTICE", null, "{en (unchanged), es}", ns.UNAVAILABLE_NOTICE);
    for (const card of [ns.SUMMARY_ERROR, ns.UNAVAILABLE_NOTICE]) {
      for (const re of policy.OMISSION_PATTERNS) c.check(!card || !re.test(card.es), "/engineCards/@pattern", { pattern: String(re) }, "no match", card && card.es);
    }

    const mountNew = (v, extra = {}) => h.mount(React.createElement(App, { view: v, appVersion: policy.APP_VERSION, ...extra }));

    // ------------------------------------------------------------------ parity
    const nSets = h.quick ? SETS.quick : SETS.full;
    const rng = h.rng(h.seed ^ 0x52504154); // "RPAT"
    const spec = {
      items: flatItems(scr.ITEMS, scr.DOMAIN_ORDER),
      contextOptions: Object.fromEntries(pat.CONTEXT_Q.map((q) => [q.id, q.opts.map(([v]) => v)])),
      flagIds: pat.RED_FLAGS.map((f) => f.id),
      locales: ["en", "es"],
    };
    const plans = { en: planFor(view, "en", patient), es: planFor(view, "es", patient) };
    let sets = 0, checkpoints = 0, ad10Pre = 0, ad10Seen = 0, ad4Seen = 0, exportsChecked = 0, ad20Pre = 0, ad20Seen = 0, enSummaries = 0;
    const AD20 = allowedDifference("AD20");
    const tEsChrome = patient.chromeFor("es"), tEnChrome = patient.chromeFor("en");
    const ledes = { es: [[pat.UI.en.thin, pat.UI.es.thin], ["Worth checking my records or asking directly:", pat.UI.es.notSureLede]] };

    for (const s of patientStream(rng, spec, nSets)) {
      sets += 1;
      const input = { a: s.a, ctx: s.ctx, rf: s.rf, loc: s.loc };
      const at = `/parity/${s.label}`;
      await h.withFixedClock(NOW, async () => {
        const b = h.mount(React.createElement(Base));
        const prints = [];
        const n = mountNew(view, { onPrintContext: (pc) => prints.push(pc) });
        try {
          const wb = walk(b.container, s, plans[s.loc], flagIds);
          const wn = walk(n.container, s, plans[s.loc], flagIds, (cpAt) => {
            if (s.loc === "es") scanEs(`${at}/${cpAt}`, n.container, corpusMasque, input);
            if (cpAt === "summary") clinLang(`${at}/summary`, n.container, s.loc, input);
          });
          for (const p of wb.problems) c.check(false, `${at}/drive/baseline`, input, "drivable", p);
          for (const p of wn.problems) c.check(false, `${at}/drive/new`, input, "drivable", p);
          const built = patient.buildPatientSummary(view, s.loc, { a: Object.fromEntries(Object.entries(s.a).filter(([id, v]) => !(v === "unsure" && spec.items.find((it) => it.id === id && it.scale)))), ctx: s.ctx, flags: s.rf });
          // Release 0.4.8: the English version of an es summary, checked on the DOM and turned into
          // AD20's exact parameter (its text and the disclaimer that follows it).
          let p20 = null;
          const enSec = n.container.querySelector('.card [data-testid="patient-english-version"]');
          if (s.loc === "es" && built.summary && wn.out.some((x) => x.at === "summary")) {
            enSummaries += 1;
            const sb = h.mount(React.createElement(ns.SummaryBody, { view, summary: built.summary.english, t: tEnChrome, loc: "en", fbLang: () => undefined, txLang: () => undefined }));
            try {
              const want = sb.container.firstElementChild;
              const title = enSec ? enSec.querySelector(":scope > h3") : null;
              const spans = title ? [...title.children].map((x) => [x.textContent, x.getAttribute("lang")]) : [];
              const body = enSec ? enSec.querySelector(':scope > [data-testid="patient-summary-body"]') : null;
              c.check(!!enSec && enSec.getAttribute("lang") === "en" && !!want && !!body && body.innerHTML === want.innerHTML
                && JSON.stringify(spans) === JSON.stringify([[tEsChrome.englishVersion, "es"], [tEnChrome.englishVersion, null]])
                && enSec.nextElementSibling && enSec.nextElementSibling.matches(".nav.noprint"),
              `${at}/summary/english`, input, "a section lang en, titled in Spanish (lang es) and English, holding the English findings of the same answers, before the actions",
              enSec ? { lang: enSec.getAttribute("lang"), spans, same: !!body && !!want && body.innerHTML === want.innerHTML } : "absent");
              // The section's text: the two titles, English's caveat lines (none for the built-in), the findings.
              if (want) p20 = { locale: "es", text: tEsChrome.englishVersion + tEnChrome.englishVersion + patient.englishVersionNotices(view).join("") + textOf(want), before: tEsChrome.disclaimer };
            } finally {
              sb.unmount();
            }
          } else if (s.loc === "en") {
            c.check(!enSec, `${at}/summary/english/@none`, input, "no English version in English", "present");
          }
          const len = Math.min(wb.out.length, wn.out.length);
          c.check(wb.out.length === wn.out.length, `${at}/checkpoints`, input, wb.out.map((x) => x.at), wn.out.map((x) => x.at));
          for (let i = 0; i < len; i++) {
            const x = wb.out[i], y = wn.out[i];
            checkpoints += 1;
            const isSummary = x.at === "summary";
            const ctx = s.loc === "es" ? { AD10: { ledes: ledes.es }, AD14: P14, loc: s.loc, ...(isSummary && p20 ? { AD20: p20 } : {}) } : { loc: s.loc };
            const r = c.diff(x.text, y.text, { at: `${at}/${x.at}`, input, allow: s.loc === "es" ? ["AD4", "AD20", "AD14", "AD10"] : ["AD4"], ctx });
            if (r.observed.has("AD4")) ad4Seen += 1;
            if (isSummary && s.loc === "es") { ad20Pre += 1; if (r.observed.has("AD20")) ad20Seen += 1; }
            if (s.loc === "es" && typeof x.text === "string" && typeof y.text === "string") {
              const yEs = isSummary && p20 ? AD20.normalise("", y.text, { AD20: p20, loc: "es" })[1] : y.text;
              t14.add(P14, AD4.normalise(x.text, y.text)[0], yEs);
            }
            if (isSummary && s.loc === "es") {
              const hasLede = x.text.includes(pat.UI.en.thin) || x.text.includes("Worth checking my records or asking directly:");
              if (hasLede) { ad10Pre += 1; if (r.observed.has("AD10")) ad10Seen += 1; }
            }
            if (isSummary) {
              const t = patient.chromeFor(s.loc);
              c.diff([pat.UI[s.loc].print, pat.UI[s.loc].download, pat.UI[s.loc].startOver], x.actions, { at: `${at}/summary/actions/baseline`, input });
              c.diff([t.print, `${t.download} (.txt)`, `${t.download} (.html)`, t.startOver], y.actions, { at: `${at}/summary/actions`, input });
            }
          }
          // Exports from the buttons: byte-equal to the engine builders, dated, named.
          if (c.check(!built.error && !!built.summary, `${at}/exports/summary`, input, "a summary", built.error)) {
            const t = patient.chromeFor(s.loc);
            const btn = (id) => n.container.querySelector(`[data-testid="${id}"]`);
            const got = captureDownloads(() => { click(btn("patient-download-txt")); click(btn("patient-download-html")); click(btn("patient-print")); });
            c.check(got.prints === 1, `${at}/print`, input, 1, got.prints);
            c.check(got.files.length === 2, `${at}/exports/count`, input, 2, got.files.length);
            if (got.files.length === 2) {
              const [txt, html] = await Promise.all(got.files.map((f) => f.blob.text()));
              const wantTxt = patient.summaryText(view, s.loc, built.summary, { appVersion: policy.APP_VERSION, generatedAt: NOW });
              const wantHtml = patient.summaryHtml(view, s.loc, built.summary, { appVersion: policy.APP_VERSION, generatedAt: NOW });
              c.diff(wantTxt, txt, { at: `${at}/exports/txt`, input });
              c.diff(wantHtml, html, { at: `${at}/exports/html`, input });
              c.diff([t.fileName, t.fileName.replace(/\.txt$/, ".html")], got.files.map((f) => f.name), { at: `${at}/exports/names`, input });
              c.diff(["text/plain", "text/html"], got.files.map((f) => f.blob.type), { at: `${at}/exports/types`, input });
              // D9: the dated caveat line; in es (only) the English marker carries its Spanish companion.
              const dated = `${markerText(s.loc)} \u00b7 ${NOW.slice(0, 10)}`;
              c.check(txt.split("\n").pop() === dated, `${at}/exports/txt/dated`, input, dated, txt.split("\n").pop());
              exportsChecked += 1;
            }
          }
          c.diff(s.loc === "en" ? [{ loc: "en", reviewed: true, editedLocally: false, stale: false }]
            : [{ loc: "en", reviewed: true, editedLocally: false, stale: false }, { loc: "es", reviewed: false, editedLocally: false, stale: false }],
          prints, { at: `${at}/onPrintContext`, input });
        } finally {
          b.unmount();
          n.unmount();
        }
      });
      if (sets % 20 === 0) await new Promise((res) => setTimeout(res, 0));
    }
    h.expect("AD4", { precondition: checkpoints > 0, observed: ad4Seen === checkpoints });
    h.expect("AD10", { precondition: ad10Pre > 0, observed: ad10Seen === ad10Pre });
    h.expect("AD20", { precondition: ad20Pre > 0, observed: ad20Seen === ad20Pre });
    c.check(ad20Pre > 0 && ad20Pre === enSummaries, "/parity/es/@AD20", null, "every es summary checkpoint carries the English version", { checkpoints: ad20Pre, summaries: enSummaries, excused: ad20Seen });
    t14.expect(h, c, "/parity/es", { need: ["P", "C", "Q"] });
    c.note(`parity: ${sets} answer sets (seed 0x${(h.seed >>> 0).toString(16)}), ${checkpoints} checkpoints; AD4 on ${ad4Seen}; AD10 es ledes ${ad10Seen}/${ad10Pre}; AD20 (es English version) ${ad20Seen}/${ad20Pre}; AD14 (es) per rule ${t14.note()}; ${exportsChecked} .txt/.html export pairs byte-checked; ${scans} es DOM scans (${scanTexts} text nodes)`);

    // ------------------------------------------------------------------ errors (fail closed)
    const thrower = (msg) => () => { throw new Error(msg); };
    const ps = masque.logic.patientSummary;
    const injected = {
      summary: { ...masque.logic, patientSummary: { ...ps, said: [{ id: "suite-injected-said", when: thrower("injected"), text: () => "" }, ...ps.said] } },
      gap: { ...masque.logic, locales: Object.fromEntries(Object.entries(masque.logic.locales).map(([k, L]) => [k, { ...L, sum: { ...L.sum, gap: thrower("injected gap") } }])) },
    };
    for (const [kind, logic] of Object.entries(injected)) {
      const m = await bind.bindModule(masque.rubric, logic, { origin: "builtin", classification: "builtin", key: `${masque.key}+${kind}`, sources: masque.sources });
      const v = patient.projectForPatient(m);
      // D8 (release 0.4.2): in es the card is the Spanish engine card, tagged lang="es".
      {
        const ne = mountNew(v, { onModuleError: () => {} });
        try {
          const sig = Object.fromEntries(m.contextItems.filter((ci) => ci.signal).map((ci) => [ci.id, ci.signal.value]));
          walk(ne.container, { a: {}, ctx: sig, rf: {}, loc: "es" }, planFor(v, "es", patient), flagIds);
          const card = ne.container.querySelector('[data-testid="patient-summary-error"]');
          c.check(!!card && textOf(card) === ns.SUMMARY_ERROR.es && card.getAttribute("lang") === "es", `/errors/${kind}/es/card`, null, `${ns.SUMMARY_ERROR.es} (lang es)`, card ? `${textOf(card)} (lang ${card.getAttribute("lang")})` : "absent");
        } finally {
          ne.unmount();
        }
      }
      const errs = [];
      const n = mountNew(v, { onModuleError: (e) => errs.push(e) });
      try {
        // A state that reaches the failing rule: the gap needs two signal values in the context.
        const sig = Object.fromEntries(m.contextItems.filter((ci) => ci.signal).map((ci) => [ci.id, ci.signal.value]));
        const s = { a: {}, ctx: sig, rf: {}, loc: "en" };
        walk(n.container, s, planFor(v, "en", patient), flagIds);
        const at = `/errors/${kind}`;
        const card = n.container.querySelector('[data-testid="patient-summary-error"]');
        c.check(!!card && textOf(card) === "This summary could not be prepared because the module's summary rules failed. Nothing is shown rather than an incomplete summary.", `${at}/card`, null, "the rule-error card", card ? textOf(card) : "absent");
        c.check(!!card && card.getAttribute("lang") === "en", `${at}/card/@lang`, null, "en", card && card.getAttribute("lang"));
        for (const id of ["patient-print", "patient-download-txt", "patient-download-html"]) {
          const b = n.container.querySelector(`[data-testid="${id}"]`);
          c.check(!!b && b.disabled === true, `${at}/${id}/disabled`, null, true, b ? b.disabled : "absent");
        }
        const so = n.container.querySelector('[data-testid="patient-start-over"]');
        c.check(!!so && so.disabled === false, `${at}/start-over/enabled`, null, true, so ? !so.disabled : "absent");
        const got = captureDownloads(() => { for (const id of ["patient-print", "patient-download-txt", "patient-download-html"]) n.container.querySelector(`[data-testid="${id}"]`).click(); });
        c.check(got.files.length === 0 && got.prints === 0, `${at}/nothing-exported`, null, "no file, no print", got);
        c.check(errs.length === 1 && errs[0].family === "patient", `${at}/onModuleError`, null, "one patient error", errs);
        const card2 = cardOf(n.container);
        c.check(!card2.querySelector(".sum:not(.err)") && !card2.querySelector(".call"), `${at}/no-summary-text`, null, "no summary block", textOf(card2));
      } finally {
        n.unmount();
      }
    }

    // ------------------------------------------------------------------ subjects: shape, derivation, unavailable
    const subjects = [{ name: "masque", module: masque }];
    try {
      const shape = await h.loadFixture("shape", { builtins: [masque], loaded: [masque] });
      subjects.push({ name: "shape (uploaded)", module: shape.module });
    } catch (err) {
      c.check(false, "/subjects/shape", null, "the shape fixture", String(err.message).split("\n")[0]);
    }
    try {
      const EDIT = " (edited locally for the render-patient suite)";
      const d = await derivedFixture(h, masque, {
        id: `local-${masque.id}-render-patient`,
        mutate(r) {
          bumpFirstWeight(r);
          const first = r.domains[0].items[0].id;
          r.locales.en.items[first].q += EDIT;
          r.locales.en.reviewed = false;
          r.locales.en.editedLocally = true;
          r.locales.es.reviewed = false;
          r.locales.es.stale = [`/locales/en/items/${first}/q`];
        },
      });
      subjects.push({ name: "derived (scoring, en edited, es stale)", module: d.module, derived: true });
    } catch (err) {
      c.check(false, "/subjects/derived", null, "a verified derivation", String(err.message).split("\n")[0]);
    }

    for (const sub of subjects) {
      const m = sub.module;
      const v = patient.projectForPatient(m);
      const at = `/subjects/${sub.name}`;
      // Release 0.4.8, final review: the caveat lines English mode shows for this view (its provenance
      // block, then its banner notices), which the es summary's English version must repeat.
      let enModeLines = null;
      const flagStrings = (m.redFlags || []).flatMap((f) => [f.text, f.points, f.action]).filter(Boolean);
      const allA = {};
      for (const d of v.domains) for (const it of d.items) allA[it.id] = it.scaleLen !== null ? it.scaleLen - 1 : "yes";
      const ctxAll = {};
      for (const ci of m.contextItems || []) if (ci.signal) ctxAll[ci.id] = ci.signal.value;
      const rfAll = Object.fromEntries(v.redFlags.map((f) => [f.id, true]));
      for (const loc of Object.keys(v.locales)) {
        const prints = [];
        const dirty = [];
        const n = mountNew(v, { onPrintContext: (pc) => prints.push(pc), onDirty: (tab, s) => dirty.push([tab, s]) });
        try {
          const s = { a: allA, ctx: ctxAll, rf: rfAll, loc };
          const plan = planFor(v, loc, patient);
          const regions = [];
          // Walk, collecting the Safety, step and Summary sections as shown (omissions §8.3).
          if (loc !== "en") click(localeButton(n.container, loc));
          const banner = () => n.container.querySelector('[data-testid="patient-banner"]');
          const prov = () => n.container.querySelector('[data-testid="patient-provenance"]');
          click(nextButton(n.container));
          for (const fe of qa(cardOf(n.container), ".flag")) click(fe);
          regions.push(["safety", textOf(cardOf(n.container))]);
          const corpus = loc === "es" ? corpusFor(v) : null;
          if (corpus) scanEs(`${at}/${loc}/safety`, n.container, corpus);
          for (const step of plan) {
            click(nextButton(n.container));
            const qEls = qa(cardOf(n.container), ".q");
            step.qs.forEach((q, i) => { const idx = answerIndex(q, s); if (idx >= 0 && qEls[i]) click(qa(qEls[i], ".opts button")[idx]); });
            regions.push([`step/${step.key}`, textOf(cardOf(n.container))]);
            if (corpus) scanEs(`${at}/${loc}/step/${step.key}`, n.container, corpus);
          }
          click(nextButton(n.container));
          regions.push(["summary", textOf(cardOf(n.container), ['[data-testid="patient-what-it-isnt"]'])]);
          if (corpus) scanEs(`${at}/${loc}/summary`, n.container, corpus);
          clinLang(`${at}/${loc}/summary`, n.container, loc);
          if (banner()) regions.push(["banner", textOf(banner())]);
          if (prov()) regions.push(["provenance", textOf(prov())]);
          const pc = prints[prints.length - 1];
          regions.push(["print-header", ns.patientPrintHeader(v, pc)]);
          for (const [region, text] of regions) {
            for (const str of flagStrings) c.check(!text.includes(str), `${at}/${loc}/${region}/@flagText`, { text: str }, "absent", "present");
            for (const re of policy.OMISSION_PATTERNS) {
              const hit = re.exec(text);
              c.check(!hit, `${at}/${loc}/${region}/@pattern`, { pattern: String(re) }, "no match", hit && text.slice(Math.max(0, hit.index - 40), hit.index + 40));
            }
            for (const line of clinicianLines) c.check(!text.includes(line), `${at}/${loc}/${region}/@clinicianProvenance`, { line }, "absent", "present");
          }
          // The print context and header (§5.10).
          const L = v.locales[loc];
          c.diff({ loc, reviewed: L.reviewed, editedLocally: L.editedLocally, stale: L.stale }, pc, { at: `${at}/${loc}/onPrintContext`, input: { loc } });
          // Release 0.4.2: in es the English marker carries its Spanish companion (D9) and the patient
          // markers are Spanish (D7); English is unchanged. Each part carries its language.
          const shortIn = (mk) => {
            const cav = Object.values(CAV.patient).find((x) => x.short === mk);
            return loc !== "en" && cav && cav[`${loc}Short`] ? cav[`${loc}Short`] : mk;
          };
          const unrevTitle = !L.reviewed && CAV.unreviewed[loc] ? [CAV.unreviewed[loc].title] : [];
          const wantHeader = [markerText(loc), ...unrevTitle, ...v.provenanceMarkers.map(shortIn)].join(" · ");
          c.diff(wantHeader, ns.patientPrintHeader(v, pc), { at: `${at}/${loc}/printHeader`, input: { loc } });
          const hp = ns.patientPrintHeaderParts(v, pc).filter((x) => x.text !== " \u00b7 " && x.text !== " \u2014 ");
          const wantParts = loc === "en" ? [[CAV.prototype, null], ...v.provenanceMarkers.map((mk) => [mk, null])]
            : [[CAV.prototype, "en"], [COMP, loc], ...unrevTitle.map((x) => [x, loc]), ...v.provenanceMarkers.map((mk) => [shortIn(mk), shortIn(mk) === mk ? "en" : loc])];
          c.diff(wantParts, hp.map((x) => [x.text, x.lang]), { at: `${at}/${loc}/printHeader/parts`, input: { loc } });
          // Banner: printed, with its notices.
          const bn = banner();
          const wantBanner = !L.reviewed && (CAV.unreviewed[loc] || L.editedLocally || L.stale);
          c.check(!!bn === !!wantBanner, `${at}/${loc}/banner`, { loc }, !!wantBanner, !!bn);
          if (bn) {
            c.check(!bn.closest(".noprint"), `${at}/${loc}/banner/printed`, { loc }, "no noprint ancestor", "noprint");
            if (CAV.unreviewed[loc]) c.diff(`⚠︎ ${CAV.unreviewed[loc].title}${CAV.unreviewed[loc].body}`, textOf(bn).slice(0, `⚠︎ ${CAV.unreviewed[loc].title}${CAV.unreviewed[loc].body}`.length), { at: `${at}/${loc}/banner/text` });
            // The notices in the locale where the caveat has it (release 0.4.2), each tagged; never the other language's.
            const inLoc = (cav) => (loc !== "en" && cav[loc] ? cav[loc] : cav.en);
            for (const [on, cav, name] of [[L.editedLocally, CAV.editedWording, "edited"], [L.stale, CAV.staleTranslation, "stale"]]) {
              const want = inLoc(cav);
              c.check(textOf(bn).includes(want) === !!on, `${at}/${loc}/banner/${name}`, { loc }, !!on, textOf(bn));
              if (want !== cav.en) c.check(!textOf(bn).includes(cav.en), `${at}/${loc}/banner/${name}/notEnglish`, { loc }, `no "${cav.en}"`, textOf(bn));
              const pn = qa(bn, "p.notice").find((x) => x.textContent === want);
              if (on) c.check(!!pn && pn.getAttribute("lang") === (want === cav.en ? "en" : loc), `${at}/${loc}/banner/${name}/@lang`, { loc }, want === cav.en ? "en" : loc, pn ? pn.getAttribute("lang") : "absent");
            }
          }
          // Provenance: the patient lines for a non-built-in, printed; none for the built-in. In es
          // (release 0.4.2) each line is the Spanish caveat, tagged lang es.
          const pv = prov();
          const lineIn = (en) => {
            const cav = Object.values(CAV.patient).find((x) => x.en === en);
            return loc !== "en" && cav && cav[loc] ? cav[loc] : en;
          };
          c.diff(v.provenanceLines.map(lineIn), pv ? qa(pv, "p").map((p) => p.textContent) : [], { at: `${at}/${loc}/provenance` });
          if (pv && loc !== "en") {
            c.diff(v.provenanceLines.map((en) => (lineIn(en) === en ? "en" : loc)), qa(pv, "p").map((p) => p.getAttribute("lang")), { at: `${at}/${loc}/provenance/@lang` });
          }
          if (pv) c.check(!pv.closest(".noprint"), `${at}/${loc}/provenance/printed`, null, "printed", "noprint");
          c.check(m.origin === "builtin" ? v.provenanceLines.length === 0 : v.provenanceLines.length > 0, `${at}/provenance/expected`, null, m.origin, v.provenanceLines);
          // Release 0.4.8, final review: the English version of an es summary repeats, right under its
          // title, the caveat lines English mode shows for this view; English mode has no English version.
          const enSec = n.container.querySelector('[data-testid="patient-english-version"]');
          if (loc === "en") {
            enModeLines = [...(pv ? qa(pv, "p").map((x) => x.textContent) : []), ...(bn ? qa(bn, "p.notice").map((x) => x.textContent) : [])];
            c.check(!enSec, `${at}/en/english/@none`, null, "no English version in English", "present");
          } else {
            const enNotes = enSec ? enSec.querySelector(':scope > [data-testid="patient-english-notices"]') : null;
            c.check(!!enSec && enModeLines !== null, `${at}/${loc}/english`, null, "the English version, and English mode's caveat lines to compare", { section: !!enSec, enMode: enModeLines });
            c.diff(enModeLines || [], enNotes ? qa(enNotes, "p").map((x) => x.textContent) : [], { at: `${at}/${loc}/english/notices` });
            c.check(m.origin === "builtin" ? !enNotes : !!enNotes, `${at}/${loc}/english/notices/expected`, null, m.origin === "builtin" ? "none for the built-in" : "present", !!enNotes);
            if (enNotes) {
              const prev = enNotes.previousElementSibling;
              c.check(!!prev && prev.matches("h3.enver-title") && !enNotes.closest(".noprint") && !enNotes.hasAttribute("lang") && !qa(enNotes, "[lang]").length
                && enNotes.nextElementSibling && enNotes.nextElementSibling.matches('[data-testid="patient-summary-body"]'),
              `${at}/${loc}/english/notices/place`, null, "right under the title, before the findings, printed, untagged inside the section lang en",
              { prev: prev && prev.className, lang: enNotes.getAttribute("lang") });
            }
          }
          // Dirty: set by answering; cleared by Start over.
          c.check(dirty.length > 0 && dirty[dirty.length - 1][0] === "patient" && dirty[dirty.length - 1][1] === "answers in progress", `${at}/${loc}/onDirty`, null, "answers in progress", dirty.slice(-1));
          click(n.container.querySelector('[data-testid="patient-start-over"]'));
          c.check(dirty[dirty.length - 1][1] === null, `${at}/${loc}/onDirty/reset`, null, null, dirty.slice(-1));
        } finally {
          n.unmount();
        }
      }
    }

    // Not available: a module without patient wording.
    try {
      const rubric = await h.fixture("modules/shape.rubric.json");
      delete rubric.locales;
      delete rubric.defaultLocale;
      const m = await bind.bindModule(rubric, null, { origin: "uploaded", key: "fixture:shape-no-locales" });
      const v = patient.projectForPatient(m);
      const n = mountNew(v);
      try {
        const box = n.container.querySelector('[data-testid="patient-unavailable"]');
        c.check(v.available === false, "/unavailable/view", null, false, v.available);
        c.check(!!box && textOf(box) === "This module carries no patient wording, so the Patient Companion is not available for it.", "/unavailable/notice", null, "the §3.5 notice", box ? textOf(box) : "absent");
        c.check(!n.container.querySelector('[data-testid="patient-section"]') && !n.container.querySelector('[data-testid="patient-nav"]'), "/unavailable/no-sections", null, "no sections", "sections rendered");
      } finally {
        n.unmount();
      }
    } catch (err) {
      c.check(false, "/unavailable", null, "a module without locales binds", String(err.message).split("\n")[0]);
    }

    // ------------------------------------------------------------------ the introduction video (release 0.4.8)
    // The clinical lead's request of 2026-10-12 ("Add the attached video above the patient companion
    // instructions, make it a collapsible/hideable iframe"). With a `video` the first step shows,
    // right above the instructions card, a panel whose button hides and shows a script-free iframe
    // of the frame page; without one (every parity mount above) nothing is added.
    {
      const VKEY = ns.VIDEO_HIDDEN_KEY;
      const frameUrl = h.appUrl("modules/masque/media/patient-companion-intro.html");
      const ssGet = () => { try { return sessionStorage.getItem(VKEY); } catch (_) { return "blocked"; } };
      const ssClear = () => { try { sessionStorage.removeItem(VKEY); } catch (_) { /* blocked */ } };
      c.check(VKEY === "screenair.patient.introVideoHidden", "/video/key", null, "screenair.patient.introVideoHidden (sessionStorage)", VKEY);
      for (const loc of ["en", "es"]) {
        const at = `/video/${loc}`;
        const t = patient.chromeFor(loc);
        ssClear();
        const n = mountNew(view, { video: frameUrl });
        try {
          if (loc !== "en") click(localeButton(n.container, loc));
          const wrap = wrapOf(n.container);
          const panel = wrap.querySelector(':scope > [data-testid="patient-video"]');
          if (!c.check(!!panel, `${at}/panel`, null, "the video panel on the first step", "absent")) continue;
          const intro = wrap.querySelector(':scope > [data-testid="patient-section"][data-section="intro"]');
          c.check(!!intro && panel.nextElementSibling === intro, `${at}/above-instructions`, null, "right above the instructions card", panel.nextElementSibling && panel.nextElementSibling.outerHTML.slice(0, 80));
          c.check(panel.classList.contains("noprint"), `${at}/noprint`, null, "noprint (never printed)", panel.className);
          const btn = panel.querySelector('button[data-testid="patient-video-toggle"]');
          const box = panel.querySelector('[data-testid="patient-video-box"]');
          const frame = () => panel.querySelector("iframe");
          c.check(!!btn && btn.getAttribute("type") === "button" && btn.getAttribute("aria-expanded") === "true" && !!box && btn.getAttribute("aria-controls") === box.id && !!box.id,
            `${at}/toggle`, null, "a button, aria-expanded true, aria-controls naming the frame box", btn && btn.outerHTML.slice(0, 160));
          c.check(!!btn && textOf(btn).trim() === t.videoHide, `${at}/toggle/text`, null, t.videoHide, btn && textOf(btn).trim());
          const f = frame();
          c.check(!!f && f.getAttribute("src") === frameUrl && f.getAttribute("sandbox") === "allow-same-origin" && f.getAttribute("allow") === "fullscreen"
            && f.getAttribute("title") === t.videoTitle && !f.hasAttribute("srcdoc") && !/allow-scripts/.test(f.getAttribute("sandbox") || ""),
          `${at}/frame`, null, `the frame page, sandbox allow-same-origin (no scripts), allow fullscreen, title ${JSON.stringify(t.videoTitle)}`, f && f.outerHTML);
          if (loc !== "en") scanEs(at, n.container, corpusMasque);
          // Hide: the iframe goes (a playing video stops), the box is hidden, the choice is remembered for this tab.
          click(btn);
          c.check(btn.getAttribute("aria-expanded") === "false" && !frame() && box.hidden && textOf(btn).trim() === t.videoShow && ssGet() === "1",
            `${at}/hide`, null, `aria-expanded false, no iframe, box hidden, ${JSON.stringify(t.videoShow)}, remembered`, { expanded: btn.getAttribute("aria-expanded"), frame: !!frame(), hidden: box.hidden, text: textOf(btn).trim(), stored: ssGet() });
          if (loc !== "en") scanEs(`${at}/hidden`, n.container, corpusMasque);
          // The next step carries no panel.
          click(nextButton(n.container));
          c.check(!wrapOf(n.container).querySelector('[data-testid="patient-video"]'), `${at}/first-step-only`, null, "no panel after the first step", "shown");
        } finally {
          n.unmount();
        }
        // Remembered on a new mount in the same tab; shown again with the button, which forgets it.
        const m2 = mountNew(view, { video: frameUrl });
        try {
          const panel = wrapOf(m2.container).querySelector('[data-testid="patient-video"]');
          const btn = panel && panel.querySelector('[data-testid="patient-video-toggle"]');
          c.check(!!btn && btn.getAttribute("aria-expanded") === "false" && !panel.querySelector("iframe"), `${at}/remembered`, null, "still hidden after a remount", btn && btn.getAttribute("aria-expanded"));
          if (btn) click(btn);
          c.check(!!panel && !!panel.querySelector("iframe") && ssGet() === null, `${at}/show-again`, null, "shown again, nothing stored", { frame: !!(panel && panel.querySelector("iframe")), stored: ssGet() });
        } finally {
          m2.unmount();
          ssClear();
        }
      }
      // No video, no panel (a module whose host passes none: an upload, a derivation).
      {
        const n = mountNew(view);
        try {
          c.check(!n.container.querySelector('[data-testid="patient-video"]'), "/video/none", null, "no panel without a video", "shown");
        } finally { n.unmount(); }
        const n2 = mountNew(view, { video: "" });
        try {
          c.check(!n2.container.querySelector('[data-testid="patient-video"]'), "/video/empty", null, "no panel for an empty video", "shown");
        } finally { n2.unmount(); }
      }
      // The print stylesheet hides the panel too.
      c.check(/@media print\{\s*\.mp \.vid\{display:none!important\}\s*\}/.test(await h.fetchText("src/apps/PatientCompanion.jsx")),
        "/video/print-css", null, "@media print hides .mp .vid", "absent");
      // The frame page: a video with controls, preload none, playsinline, no autoplay, the MP4 and its
      // poster; no script; noindex; the prototype marker tagged English.
      const html = await h.fetchText("modules/masque/media/patient-companion-intro.html");
      const doc = new DOMParser().parseFromString(html, "text/html");
      const vids = [...doc.querySelectorAll("video")];
      const v0 = vids[0];
      const srcs = v0 ? [...v0.querySelectorAll("source")].map((s) => [s.getAttribute("src"), s.getAttribute("type")]) : [];
      c.check(vids.length === 1 && v0.hasAttribute("controls") && v0.getAttribute("preload") === "none" && v0.hasAttribute("playsinline") && !v0.hasAttribute("autoplay")
        && !v0.hasAttribute("loop") && !v0.hasAttribute("src") && v0.getAttribute("poster") === "patient-companion-intro-poster.jpg"
        && JSON.stringify(srcs) === JSON.stringify([["patient-companion-intro.mp4", "video/mp4"]]),
      "/video/page/video", null, "one <video controls preload=none playsinline> (no autoplay, no loop), its poster and the MP4", v0 && v0.outerHTML);
      c.check(!doc.querySelector("script") && /<meta\s+name="robots"\s+content="noindex, nofollow">/.test(html) && doc.documentElement.getAttribute("lang") === "en",
        "/video/page/head", null, "no script, noindex, lang en", { scripts: doc.querySelectorAll("script").length });
      const proto = doc.querySelector(".masque-proto");
      c.check(!!proto && proto.getAttribute("lang") === "en" && proto.textContent === policy.CAVEATS.prototype, "/video/page/marker", null, policy.CAVEATS.prototype, proto && proto.textContent);
      // The media files are served, by size (HEAD: nothing is downloaded).
      for (const [file, size] of [["patient-companion-intro.mp4", 14783849], ["patient-companion-intro-poster.jpg", 78113]]) {
        let got = null;
        try { const res = await fetch(h.appUrl(`modules/masque/media/${file}`), { method: "HEAD", cache: "no-cache" }); got = res.ok ? Number(res.headers.get("content-length")) : `HTTP ${res.status}`; } catch (err) { got = String(err && err.message); }
        c.check(got === size, `/video/page/${file}`, null, `${size} bytes`, got);
      }
    }

    // ------------------------------------------------------------------ the English version in print (release 0.4.8, final review)
    // The final review printed a Spanish summary whose page 2 ended with the English version's title
    // and nothing under it. The companion's print stylesheet (as mounted, read through the CSSOM) keeps
    // that title with the block under it and the section's urgent box whole; the summary blocks stay
    // unbreakable as before.
    {
      const n = mountNew(view);
      try {
        const css = qa(n.container, "style").map((x) => x.textContent).join("\n");
        const title = printRule(css, ".mp .enver-title"), call = printRule(css, ".mp .enver .call"), sum = printRule(css, ".mp .sum");
        c.check(!!title && title.getPropertyValue("break-after") === "avoid" && title.getPropertyValue("break-inside") === "avoid" && !!call && call.getPropertyValue("break-inside") === "avoid"
          && !!sum && sum.getPropertyValue("break-inside") === "avoid",
        "/english/print-css", null, "@media print: .mp .enver-title{break-inside:avoid;break-after:avoid}, .mp .enver .call{break-inside:avoid}, .mp .sum{break-inside:avoid}",
        { title: title && title.cssText, call: call && call.cssText, sum: sum && sum.cssText });
      } finally {
        n.unmount();
      }
    }

    // Module graph (§5.5): nothing that can compute or name a score.
    const files = await moduleGraph(h, "src/apps/PatientCompanion.jsx");
    const bad = files.filter((f) => FORBIDDEN_FILES.includes(f));
    c.check(!bad.length, "/graph", null, `none of ${FORBIDDEN_FILES.join(", ")}`, bad);
    c.note(`graph: ${files.join(", ")}`);
    c.note(`subjects: ${subjects.map((s) => s.name).join("; ")}`);
    return c.result();
  }),
};
