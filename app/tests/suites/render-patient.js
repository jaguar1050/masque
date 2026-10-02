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
//             not-sure ledes from UI.es). The baseline offers no "Not sure" on a scale item, so a
//             drawn "unsure" there is unanswered on both sides.
//             The summary's action row is compared as its own region: the baseline's
//             [print, download, startOver] becomes [print, download (.txt), download (.html),
//             startOver] (AD10's new .html export; §5.5 labels), asserted exactly.
//   exports   for every parity set that reaches a summary, the .txt and .html files the buttons
//             save (URL.createObjectURL stubbed) are byte-equal to the engine's summaryText /
//             summaryHtml for that summary, dated by the fixed clock, and named t.fileName and
//             its .html twin; Print calls window.print once.
// Beyond parity (§9.10 done-when):
//   errors    a summary rule that throws, and a throwing sum.gap: the rule-error card, Print and
//             both downloads disabled (Start over not), onModuleError called once (family
//             "patient"), no summary text rendered;
//   print     onPrintContext on mount and on every locale change, incl. editedLocally/stale for
//             a derivation with an edited English and a stale es locale; patientPrintHeader();
//   notices   the banner (printed: no `noprint`) carries the es caveat, the edited-wording and
//             stale-translation notices; patient provenance lines for non-built-ins; never a
//             clinician provenance line;
//   omissions rendered text of Safety, every step and the Summary with every flag on and every
//             item answered, for MASQUE, the shape fixture (a plain upload) and the derivation, in
//             every locale: no flag text/points/action and no OMISSION_PATTERNS match (the
//             Intro's "What it isn't" box, data-testid patient-what-it-isnt, is excluded);
//             the PatientCompanion module graph excludes the scoring/clinician files;
//   other     the "not available" notice for a module without patient wording; onDirty.
import React from "react";
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { flatItems, patientStream } from "../harness/matrix.js";
import { bumpFirstWeight, derivedFixture } from "../harness/derivation.js";

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
function walk(container, s, plan, flagIds) {
  const out = [];
  const problems = [];
  const cp = (at, withActions = false) => out.push({ at, text: snap(container), actions: withActions ? actionLabels(container) : undefined });
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
    let sets = 0, checkpoints = 0, ad10Pre = 0, ad10Seen = 0, ad4Seen = 0, exportsChecked = 0;
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
          const wn = walk(n.container, s, plans[s.loc], flagIds);
          for (const p of wb.problems) c.check(false, `${at}/drive/baseline`, input, "drivable", p);
          for (const p of wn.problems) c.check(false, `${at}/drive/new`, input, "drivable", p);
          const len = Math.min(wb.out.length, wn.out.length);
          c.check(wb.out.length === wn.out.length, `${at}/checkpoints`, input, wb.out.map((x) => x.at), wn.out.map((x) => x.at));
          for (let i = 0; i < len; i++) {
            const x = wb.out[i], y = wn.out[i];
            checkpoints += 1;
            const ctx = s.loc === "es" ? { AD10: { ledes: ledes.es } } : {};
            const isSummary = x.at === "summary";
            const r = c.diff(x.text, y.text, { at: `${at}/${x.at}`, input, allow: s.loc === "es" ? ["AD4", "AD10"] : ["AD4"], ctx });
            if (r.observed.has("AD4")) ad4Seen += 1;
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
          const built = patient.buildPatientSummary(view, s.loc, { a: Object.fromEntries(Object.entries(s.a).filter(([id, v]) => !(v === "unsure" && spec.items.find((it) => it.id === id && it.scale)))), ctx: s.ctx, flags: s.rf });
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
              c.check(txt.split("\n").pop() === `${CAV.prototype} · ${NOW.slice(0, 10)}`, `${at}/exports/txt/dated`, input, "dated caveat line", txt.split("\n").pop());
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
    c.note(`parity: ${sets} answer sets (seed 0x${(h.seed >>> 0).toString(16)}), ${checkpoints} checkpoints; AD4 on ${ad4Seen}; AD10 es ledes ${ad10Seen}/${ad10Pre}; ${exportsChecked} .txt/.html export pairs byte-checked`);

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
          for (const step of plan) {
            click(nextButton(n.container));
            const qEls = qa(cardOf(n.container), ".q");
            step.qs.forEach((q, i) => { const idx = answerIndex(q, s); if (idx >= 0 && qEls[i]) click(qa(qEls[i], ".opts button")[idx]); });
            regions.push([`step/${step.key}`, textOf(cardOf(n.container))]);
          }
          click(nextButton(n.container));
          regions.push(["summary", textOf(cardOf(n.container), ['[data-testid="patient-what-it-isnt"]'])]);
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
          const wantHeader = [CAV.prototype, ...(!L.reviewed && CAV.unreviewed[loc] ? [CAV.unreviewed[loc].title] : []), ...v.provenanceMarkers].join(" · ");
          c.diff(wantHeader, ns.patientPrintHeader(v, pc), { at: `${at}/${loc}/printHeader`, input: { loc } });
          // Banner: printed, with its notices.
          const bn = banner();
          const wantBanner = !L.reviewed && (CAV.unreviewed[loc] || L.editedLocally || L.stale);
          c.check(!!bn === !!wantBanner, `${at}/${loc}/banner`, { loc }, !!wantBanner, !!bn);
          if (bn) {
            c.check(!bn.closest(".noprint"), `${at}/${loc}/banner/printed`, { loc }, "no noprint ancestor", "noprint");
            if (CAV.unreviewed[loc]) c.diff(`⚠︎ ${CAV.unreviewed[loc].title}${CAV.unreviewed[loc].body}`, textOf(bn).slice(0, `⚠︎ ${CAV.unreviewed[loc].title}${CAV.unreviewed[loc].body}`.length), { at: `${at}/${loc}/banner/text` });
            c.check(textOf(bn).includes(CAV.editedWording.en) === !!L.editedLocally, `${at}/${loc}/banner/edited`, { loc }, !!L.editedLocally, textOf(bn));
            c.check(textOf(bn).includes(CAV.staleTranslation.en) === !!L.stale, `${at}/${loc}/banner/stale`, { loc }, !!L.stale, textOf(bn));
          }
          // Provenance: the patient lines for a non-built-in, printed; none for the built-in.
          const pv = prov();
          c.diff(v.provenanceLines, pv ? qa(pv, "p").map((p) => p.textContent) : [], { at: `${at}/${loc}/provenance` });
          if (pv) c.check(!pv.closest(".noprint"), `${at}/${loc}/provenance/printed`, null, "printed", "noprint");
          c.check(m.origin === "builtin" ? v.provenanceLines.length === 0 : v.provenanceLines.length > 0, `${at}/provenance/expected`, null, m.origin, v.provenanceLines);
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

    // Module graph (§5.5): nothing that can compute or name a score.
    const files = await moduleGraph(h, "src/apps/PatientCompanion.jsx");
    const bad = files.filter((f) => FORBIDDEN_FILES.includes(f));
    c.check(!bad.length, "/graph", null, `none of ${FORBIDDEN_FILES.join(", ")}`, bad);
    c.note(`graph: ${files.join(", ")}`);
    c.note(`subjects: ${subjects.map((s) => s.name).join("; ")}`);
    return c.result();
  }),
};
