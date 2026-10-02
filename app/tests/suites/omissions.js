// tests/suites/omissions.js — what the Patient surfaces must never carry (design 03 §8.3
// `omissions`, §5.5, §5.11, D15, D26, §4.2 OMISSION_PATTERNS). Owner: WP13.
//
//   graph     the transitive import graph (sources fetched, specifiers collected; nothing
//             executed) of src/engine/patient.js and src/apps/PatientCompanion.jsx excludes
//             scoring.js, fhir.js, rules.js, cohort.js, probes.js, extraction.js, scribe.js and
//             ResearchReadinessPanel.jsx (§5.5); patient.html boots src/shell/PatientPage.jsx, whose
//             graph excludes the §5.11 list (the clinician shell, the picker, the upload dialog,
//             the four clinician apps, the readiness panel, the population page) and
//             MASQUE_Voice.js. §5.11 lets PatientPage import registry.js, whose validation path
//             reaches scoring.js; the graph notes list what it holds;
//   view      projectForPatient(module) carries no flag text, points or action, no clinician
//             provenance line and no CAVEATS.scoringChanged;
//   exports   summaryText (.txt) and summaryHtml (.html, text content) with all flags on and
//             every item answered, every locale: no flag text/points/action, no OMISSION_PATTERNS
//             match; the patient provenance, edited-wording and stale-translation lines appear
//             where they apply and never a clinician provenance line;
//   rendered  through the real shell and the real patient page, with every flag ticked and every
//             item answered through the Companion's own buttons, in every locale: the Safety,
//             every step and the Summary section (the Intro's "What it isn't" box excluded by
//             data-testid), the unreviewed banner, the provenance block, the caveat strip and
//             the print header, plus the .txt and .html files the Summary's buttons save:
//               - the Patient tab of the clinician shell;
//               - patient mode entered with "Hand to patient" (the whole visible shell: no tab
//                 bar, picker, file input, ⓘ button or link to the clinician pages; the other
//                 panels hidden and inert);
//               - patient mode opened by address (#tab=patient&mode=patient&module=<id>): the
//                 built-in renders, any other module reads "no longer loaded" and nothing else;
//               - patient.html (PatientPage, ?module=<id>): the built-in renders, any other
//                 module reads "not available" and never falls back;
//             no console error, window error or unhandled rejection on any of them;
//   modules   MASQUE, the shape fixture (a plain upload) and a verified derivation with changed
//             scoring, an edited English locale and a stale es locale. In the shell the upload
//             goes through registry.classifyFiles/prepareUpload and the derivation through
//             registry.prepareRubric, the paths the upload dialog and the editor's Apply use.
import React from "react";
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { bumpFirstWeight, derivedFixture } from "../harness/derivation.js";
import {
  byTestId, captureDownloads, click, fullAnswers, importApp, mountApp, openShell, qa, sandbox, selectModule, sleep, visibleText, waitFor, walkPatient,
} from "../harness/shell.js";

const NOW = "2026-10-01T12:00:00.000Z";
const FORBIDDEN_FILES = ["scoring.js", "fhir.js", "rules.js", "cohort.js", "probes.js", "extraction.js", "scribe.js", "ResearchReadinessPanel.jsx"];
// §5.11: the patient page's graph contains none of these (paths under app/src/), nor the voice module.
const PAGE_FORBIDDEN = ["shell/ScreenAIr.jsx", "shell/ModuleWorkspace.jsx", "shell/ModulePicker.jsx", "shell/UploadDialog.jsx", "apps/Screener.jsx",
  "apps/Scribe.jsx", "apps/ResearchTab.jsx", "apps/RubricEditor.jsx", "ResearchReadinessPanel.jsx", "MASQUE_Population.jsx", "MASQUE_Voice.js"];
const WHAT_IT_ISNT = '[data-testid="patient-what-it-isnt"]';
const NO_LONGER_LOADED = "This questionnaire is no longer loaded on this device. Please hand the device back to your clinician.";
const NOT_AVAILABLE = "This questionnaire is not available.";
const IMPORT_RE = /(?:^|[\s;}])(?:import|export)\s*(?:[\w*{}\s,$]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

/** Transitive relative-import graph from `entry` (an app-relative path). Returns the file URLs. */
async function moduleGraph(h, entry) {
  const seen = new Set();
  const order = [];
  const visit = async (url) => {
    if (seen.has(url)) return;
    seen.add(url);
    order.push(url);
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = (await res.text()).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1] || m[2];
      if (spec && (spec.startsWith("./") || spec.startsWith("../"))) await visit(new URL(spec, url).href);
    }
  };
  await visit(h.appUrl(entry));
  return order;
}

const nameOf = (url) => decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));

function htmlText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const el of doc.querySelectorAll("style, script")) el.remove();
  return doc.body ? doc.body.textContent : "";
}

export default {
  name: "omissions",
  owner: "WP13",
  run: guarded("omissions", async (h) => {
    const { module, validation } = await loadMasque(h);
    const [patient, policy] = await Promise.all([h.engine("patient.js"), h.engine("policy.js")]);
    need(typeof patient.projectForPatient === "function", "waits on WP6: patient.js");
    const c = collector(h);
    c.note(validationNote(validation));

    // ------------------------------------------------------------------ module graphs
    const srcBase = h.appUrl("src/");
    const srcRel = (u) => (u.startsWith(srcBase) ? decodeURIComponent(u.slice(srcBase.length)) : u);
    const graphs = [["src/engine/patient.js", "WP6", FORBIDDEN_FILES, (u) => nameOf(u)], ["src/apps/PatientCompanion.jsx", "WP9", FORBIDDEN_FILES, (u) => nameOf(u)],
      ["src/shell/PatientPage.jsx", "WP12-M2", PAGE_FORBIDDEN, srcRel]];
    for (const [entry, owner, forbidden, key] of graphs) {
      if (!(await h.fileExists(h.appUrl(entry)))) { c.check(false, `/graph/${entry}`, null, "the file", `absent (waits on ${owner})`); continue; }
      const files = await moduleGraph(h, entry);
      const bad = files.filter((u) => forbidden.includes(key(u)));
      c.check(!bad.length, `/graph/${entry}`, { entry }, `none of ${forbidden.join(", ")}`, bad.map(srcRel));
      c.note(`graph ${entry}: ${files.length} files (${files.map(nameOf).join(", ")})`);
    }
    // patient.html boots PatientPage and links nowhere into the clinician program (§5.11).
    const pageHtml = await h.fetchText("patient.html");
    const boots = [...pageHtml.matchAll(/(?:entry:\s*|importModule\(\s*)['"]([^'"]+)['"]/g)].map((x) => x[1]);
    c.diff(["./src/shell/PatientPage.jsx"], boots, { at: "/graph/patient.html/entry" });
    c.check(!/href=["'][^"']*(?:screenair|index|screener|scribe|simulator|population)\.html/i.test(pageHtml), "/graph/patient.html/links", null, "no link to a clinician page", "a link");

    // ------------------------------------------------------------------ the three modules
    const subjects = [{ name: "masque", module }];
    try {
      const shape = await h.loadFixture("shape", { builtins: [module], loaded: [module] });
      subjects.push({ name: "shape (uploaded)", module: shape.module });
    } catch (err) {
      c.check(false, "/modules/shape", null, "the shape fixture", String(err.message).split("\n")[0]);
    }
    try {
      const EDIT = " (edited locally for the omissions suite)";
      const d = await derivedFixture(h, module, {
        id: `local-${module.id}-omissions`,
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
      c.check(d.classification && d.classification.kind === "verified", "/modules/derived/classification", null, "verified", d.classification && d.classification.kind);
      subjects.push({ name: "derived (scoring, en edited, es stale)", module: d.module, derived: true, rubric: d.rubric });
    } catch (err) {
      c.check(false, "/modules/derived", null, "a verified derivation", String(err.message).split("\n")[0]);
    }

    let noticeChecks = 0;
    const clinicianLines = [policy.CAVEATS.uploaded.en, policy.CAVEATS.edited.en, policy.CAVEATS.scoringChanged.en.split("{root}")[0]];
    for (const s of subjects) {
      const m = s.module;
      const at = `/${s.name}`;
      const view = patient.projectForPatient(m);
      const viewText = JSON.stringify(view);
      const flagStrings = (m.redFlags || []).flatMap((f) => [f.text, f.points, f.action]).filter(Boolean);
      for (const str of flagStrings) c.check(!viewText.includes(str), `${at}/view/@flagText`, { text: str }, "absent", "present");
      for (const line of clinicianLines) c.check(!viewText.includes(line), `${at}/view/@clinicianProvenance`, { line }, "absent", "present");
      const a = {};
      for (const d of m.domains) for (const it of d.items) a[it.id] = Array.isArray(it.scale) ? it.scale.length - 1 : "yes";
      const rf = Object.fromEntries((m.redFlags || []).map((f) => [f.id, true]));
      const ctx = {};
      for (const ci of m.contextItems || []) if (ci.signal) ctx[ci.id] = ci.signal.value;
      for (const loc of Object.keys(view.locales || {})) {
        const { summary, error } = patient.buildPatientSummary(view, loc, { a, ctx, flags: rf });
        if (!c.check(!error && !!summary, `${at}/${loc}/summary`, null, "a summary", error)) continue;
        const txt = patient.summaryText(view, loc, summary, { generatedAt: NOW });
        const html = patient.summaryHtml(view, loc, summary, { generatedAt: NOW });
        const htmlBody = htmlText(html);
        for (const [kind, text] of [["txt", txt], ["html", htmlBody]]) {
          for (const str of flagStrings) c.check(!text.includes(str), `${at}/${loc}/${kind}/@flagText`, { text: str }, "absent", "present");
          for (const re of policy.OMISSION_PATTERNS) {
            const hit = re.exec(text);
            c.check(!hit, `${at}/${loc}/${kind}/@pattern`, { pattern: String(re) }, "no match", hit && text.slice(Math.max(0, hit.index - 40), hit.index + 40));
          }
          for (const line of clinicianLines) c.check(!text.includes(line), `${at}/${loc}/${kind}/@clinicianProvenance`, { line }, "absent", "present");
          c.check(text.includes(policy.CAVEATS.prototype), `${at}/${loc}/${kind}/@caveat`, null, policy.CAVEATS.prototype, "absent");
          if (m.origin !== "builtin") {
            const want = m.origin === "derived" ? policy.CAVEATS.patient.edited.en : policy.CAVEATS.patient.uploaded.en;
            c.check(text.includes(want), `${at}/${loc}/${kind}/@patientProvenance`, null, want, "absent");
          }
          const L = (m.locales || {})[loc] && m.locales[loc].data;
          if (L && L.editedLocally) noticeChecks++;
          if (L && Array.isArray(L.stale) && L.stale.length) noticeChecks++;
          if (L && L.editedLocally) c.check(text.includes(policy.CAVEATS.editedWording.en), `${at}/${loc}/${kind}/@editedWording`, null, policy.CAVEATS.editedWording.en, "absent");
          if (L && Array.isArray(L.stale) && L.stale.length) c.check(text.includes(policy.CAVEATS.staleTranslation.en), `${at}/${loc}/${kind}/@stale`, null, policy.CAVEATS.staleTranslation.en, "absent");
        }
        c.check(!/<script|javascript:|https?:\/\//i.test(html), `${at}/${loc}/html/@inert`, null, "no script and no URL", "found");
      }
    }
    c.note(`exports checked: ${subjects.map((s) => s.name).join("; ")}; ${noticeChecks} edited-wording / stale-translation notices checked`);
    if (subjects.some((s) => s.derived)) c.check(noticeChecks >= 4, "/derived/@noticeCoverage", null, ">= 4 (en edited, es stale; .txt and .html)", noticeChecks);

    // ------------------------------------------------------------------ rendered
    await renderedHalf(h, c, { patient, policy, masque: module, subjects });
    return c.result();
  }),
};

// ============================================================================ rendered half

/** The checks every patient-facing text gets (§8.3 omissions). */
function textChecks(c, policy, at, text, { flagStrings, clinicianLines }) {
  for (const str of flagStrings) c.check(!text.includes(str), `${at}/@flagText`, { text: str }, "absent", "present");
  for (const re of policy.OMISSION_PATTERNS) {
    const hit = re.exec(text);
    c.check(!hit, `${at}/@pattern`, { pattern: String(re) }, "no match", hit && text.slice(Math.max(0, hit.index - 40), hit.index + 40));
  }
  for (const line of clinicianLines) c.check(!text.includes(line), `${at}/@clinicianProvenance`, { line }, "absent", "present");
}

/**
 * Walk the Companion inside `root` in `loc` with every flag on and every item answered, checking
 * each section as shown and the two exports. `chrome()` returns extra regions to check at every
 * section ([name, text] pairs: the caveat strip, the print header, or the whole visible page).
 */
async function walkAndCheck(c, ctx, { root, view, module, loc, at, chrome }) {
  const { policy } = ctx;
  const { a, ctx: answersCtx } = fullAnswers(module);
  const sections = [];
  const walk = walkPatient(root, view, {
    loc, a, ctx: answersCtx, flags: "all",
    snap: (key, sec) => {
      const regions = [[`section/${key}`, visibleText(sec, [WHAT_IT_ISNT])]];
      for (const id of ["patient-banner", "patient-provenance"]) { const el = byTestId(root, id); if (el) regions.push([id, el.textContent]); }
      regions.push(...chrome());
      if (key === "safety") {
        const on = qa(sec, '.flag[aria-checked="true"]').length;
        c.check(on === view.redFlags.length, `${at}/safety/allFlagsOn`, null, view.redFlags.length, on);
      }
      sections.push(key);
      return regions;
    },
  });
  for (const pr of walk.problems) c.check(false, `${at}/drive`, null, "drivable", pr);
  c.check(sections[sections.length - 1] === "summary", `${at}/reachedSummary`, null, "summary", sections);
  for (const { at: key, value } of walk.out) for (const [name, text] of value || []) textChecks(c, policy, `${at}/${key}/${name}`, text || "", ctx);
  const got = captureDownloads(() => {
    click(byTestId(root, "patient-download-txt"));
    click(byTestId(root, "patient-download-html"));
  });
  c.check(got.files.length === 2, `${at}/exports`, null, 2, got.files.length);
  for (const f of got.files) {
    const raw = await f.blob.text();
    const doc = f.type === "text/html" ? new DOMParser().parseFromString(raw, "text/html") : null;
    if (doc) for (const el of doc.querySelectorAll("style, script")) el.remove();
    const text = doc ? doc.body.textContent : raw;
    textChecks(c, policy, `${at}/export/${f.name}`, text, ctx);
    c.check(text.includes(policy.CAVEATS.prototype), `${at}/export/${f.name}/@caveat`, null, policy.CAVEATS.prototype, "absent");
    for (const line of ctx.patientLines(module, loc)) c.check(text.includes(line), `${at}/export/${f.name}/@patientProvenance`, { line }, "present", "absent");
  }
  return sections.length;
}

async function renderedHalf(h, c, { patient, policy, masque, subjects }) {
  let ScreenAIr, PatientPage, registry, lineage;
  try {
    [ScreenAIr, PatientPage, registry, lineage] = await Promise.all([
      importApp(h, "src/shell/ScreenAIr.jsx").then((ns) => ns.default),
      importApp(h, "src/shell/PatientPage.jsx").then((ns) => ns.default),
      importApp(h, "src/shell/registry.js"),
      h.engine("lineage.js"),
    ]);
  } catch (err) {
    c.check(false, "/rendered/compile", null, "ScreenAIr.jsx and PatientPage.jsx compile (WP9, WP12)", String(err.message).split("\n").slice(0, 2).join(" "));
    return;
  }
  const CAV = policy.CAVEATS;
  const ctx = {
    policy,
    clinicianLines: [CAV.uploaded.en, CAV.edited.en, CAV.scoringChanged.en.split("{root}")[0]],
    flagStrings: [],
    patientLines: (m, loc) => lineage.provenanceLines(m, "patient", { locale: loc }),
  };

  // Register the subjects the way the shell would: the built-ins, the upload, the derivation.
  for (const e of await registry.loadBuiltins({ env: h.env })) registry.register(e);
  const ours = [];
  const live = [];
  for (const s of subjects) {
    if (s.module.origin === "builtin") { live.push({ ...s, key: (registry.registered().find((e) => e.origin === "builtin" && e.module && e.module.id === s.module.id) || {}).key }); continue; }
    for (const e of registry.registered()) if (e.origin !== "builtin" && e.module && e.module.id === s.module.id) registry.unregister(e.key);
    let res;
    if (s.derived) {
      res = await registry.prepareRubric(s.rubric, { entries: registry.registered(), env: h.env });
    } else {
      const bytes = await h.fixture("modules/shape.rubric.json", "bytes");
      const cl = await registry.classifyFiles([{ name: "shape.rubric.json", bytes }], { entries: registry.registered(), env: h.env });
      res = (await registry.prepareUpload(cl, { entries: registry.registered(), env: h.env })).find((r) => r.entry) || { errors: ["no entry"] };
    }
    if (!c.check(!!res.entry, `/rendered/${s.name}/prepare`, null, "an entry", res.errors || res.skipped)) continue;
    const want = s.derived ? ["derived", "verified"] : ["uploaded", null];
    const got = [res.entry.module.origin, s.derived ? res.entry.module.classification && res.entry.module.classification.kind : null];
    c.diff(want, got, { at: `/rendered/${s.name}/classification` });
    registry.register(res.entry);
    ours.push(res.entry.key);
    live.push({ ...s, module: res.entry.module, key: res.entry.key });
  }

  let walks = 0;
  try {
    for (const s of live) {
      const m = s.module;
      const builtin = m.origin === "builtin";
      const view = patient.projectForPatient(m);
      const locs = Object.keys(view.locales || {});
      ctx.flagStrings = (m.redFlags || []).flatMap((f) => [f.text, f.points, f.action]).filter(Boolean);
      const base = `/rendered/${s.name}`;

      // ---------------------------------------------------------------- Patient tab, then Hand to patient
      await sandbox({ hash: "#tab=patient" }, async ({ errors }) => {
        const shell = await openShell(h, ScreenAIr);
        const C = shell.container;
        try {
          if (!builtin) await selectModule(C, s.key, m.id);
          const panel = await waitFor(() => { const p = C.querySelector("#sa-panel-patient"); return p && !p.hidden && byTestId(p, "patient-app") ? p : null; }, { what: "the Patient tab" });
          const strip = () => byTestId(C, "caveat-strip");
          const headText = () => (C.querySelector("thead.sa-print-head") || {}).textContent || "";
          for (const loc of locs) {
            const at = `${base}/tab/${loc}`;
            walks += await walkAndCheck(c, ctx, { root: panel, view, module: m, loc, at,
              chrome: () => [["caveat-strip", strip().textContent], ["print-header", headText()]] });
            const lines = qa(strip(), ".sa-caveat-line").map((x) => x.textContent);
            c.diff(ctx.patientLines(m, loc), lines, { at: `${at}/caveatStrip/lines` });
            c.check(headText().startsWith(CAV.prototype), `${at}/printHeader`, null, CAV.prototype, headText());
          }
          // Patient mode, entered from the Patient tab. The walk above left answers in the
          // companion, so the shell must ask before handing on (D26): assert the dialog, then
          // start a new patient session so the mode walk begins from a fresh companion.
          click(byTestId(C, "hand-to-patient"));
          await waitFor(() => byTestId(C, "hand-dialog") || C.querySelector('.sa-shell[data-mode="patient"]'), { what: "the hand-to-patient dialog or patient mode" });
          const handDialog = byTestId(C, "hand-dialog");
          c.check(!!handDialog, `${base}/mode/handDialog`, null, "hand-dialog shown (answers present)", handDialog ? "shown" : "absent (switched silently)");
          if (handDialog) click(byTestId(C, "confirm-ok"));
          await waitFor(() => C.querySelector('.sa-shell[data-mode="patient"]'), { what: "patient mode" });
          c.check(!byTestId(C, "hand-dialog"), `${base}/mode/handDialog/closed`, null, "dialog closed", "still open");
          const shellEl = C.querySelector(".sa-shell");
          for (const [sel, what] of [["nav.sa-tabs", "the tab bar"], ["select", "a select"], ['input[type="file"]', "a file input"], ['[data-testid="module-info-button"]', "the ⓘ button"],
            ["#sa-mic", "the microphone indicator"], ['[data-testid="patient-mode-bar"]', "the patient-mode bar"], ['a[href*="screenair.html"], a[href*="index.html"]', "a link to the clinician program"]]) {
            const hit = qa(shellEl, sel).filter((el) => !el.closest("[hidden]"));
            c.check(!hit.length, `${base}/mode/absent`, { selector: sel }, `no ${what}`, hit.length);
          }
          for (const k of ["screener", "scribe", "research", "editor"]) {
            const p = C.querySelector(`#sa-panel-${k}`);
            c.check(!p || (p.hidden && p.hasAttribute("inert")), `${base}/mode/panel/${k}`, null, "hidden and inert", p ? { hidden: p.hidden, inert: p.hasAttribute("inert") } : "absent");
          }
          c.check(document.title === "screenAIr · Patient Companion", `${base}/mode/title`, null, "screenAIr · Patient Companion", document.title);
          const modePanel = C.querySelector("#sa-panel-patient");
          for (const loc of locs) {
            walks += await walkAndCheck(c, ctx, { root: modePanel, view, module: m, loc, at: `${base}/mode/${loc}`,
              chrome: () => [["visible-page", visibleText(shellEl, [WHAT_IT_ISNT])]] });
          }
          const page = visibleText(shellEl, [WHAT_IT_ISNT]);
          c.check(page.includes(CAV.prototype), `${base}/mode/@caveat`, null, CAV.prototype, "absent");
        } finally {
          shell.unmount();
          c.check(errors.length === 0, `${base}/tab+mode/console`, null, [], errors.slice(0, 10));
        }
      });

      // ---------------------------------------------------------------- patient mode by address
      await sandbox({ hash: `#tab=patient&mode=patient&module=${encodeURIComponent(m.id)}` }, async ({ errors }) => {
        const shell = await openShell(h, ScreenAIr);
        const C = shell.container;
        try {
          const shellEl = C.querySelector(".sa-shell");
          c.check(shellEl && shellEl.getAttribute("data-mode") === "patient", `${base}/address/mode`, null, "patient", shellEl && shellEl.getAttribute("data-mode"));
          c.check(!C.querySelector("nav.sa-tabs") && !C.querySelector("select"), `${base}/address/chrome`, null, "no tab bar, no picker", "present");
          if (builtin) {
            const panel = await waitFor(() => { const p = C.querySelector("#sa-panel-patient"); return p && !p.hidden && byTestId(p, "patient-app") ? p : null; }, { what: "the Patient panel" });
            for (const loc of locs) {
              walks += await walkAndCheck(c, ctx, { root: panel, view, module: m, loc, at: `${base}/address/${loc}`,
                chrome: () => [["visible-page", visibleText(shellEl, [WHAT_IT_ISNT])]] });
            }
          } else {
            const miss = byTestId(C, "patient-missing");
            c.check(!!miss && miss.textContent === NO_LONGER_LOADED, `${base}/address/missing`, null, NO_LONGER_LOADED, miss ? miss.textContent : "absent");
            c.check(!byTestId(C, "patient-app") && !C.querySelector("main.sa-main"), `${base}/address/noSubstitute`, null, "no module rendered", "a module");
            textChecks(c, policy, `${base}/address/page`, visibleText(shellEl), ctx);
          }
        } finally {
          shell.unmount();
          c.check(errors.length === 0, `${base}/address/console`, null, [], errors.slice(0, 10));
        }
      });

      // ---------------------------------------------------------------- patient.html
      await sandbox({ search: `?module=${encodeURIComponent(m.id)}`, hash: "" }, async ({ errors }) => {
        const pg = mountApp(React.createElement(PatientPage, { env: h.env }));
        try {
          const C = pg.container;
          await waitFor(() => byTestId(C, "patient-app") || byTestId(C, "patient-page-missing") || byTestId(C, "patient-page-failed"), { what: "the patient page" });
          const shellEl = C.querySelector(".sa-shell");
          for (const [sel, what] of [["nav", "a tab bar"], ["select", "a select"], ['input[type="file"]', "a file input"], ['a[href*="screenair.html"], a[href*="index.html"]', "a link to the clinician program"]]) {
            c.check(!C.querySelector(sel), `${base}/page/absent`, { selector: sel }, `no ${what}`, "present");
          }
          if (builtin) {
            if (c.check(!!byTestId(C, "patient-app"), `${base}/page/rendered`, null, "the Companion", visibleText(C).slice(0, 200))) {
              for (const loc of locs) {
                walks += await walkAndCheck(c, ctx, { root: C, view, module: m, loc, at: `${base}/page/${loc}`,
                  chrome: () => [["visible-page", visibleText(shellEl, [WHAT_IT_ISNT])]] });
              }
            }
          } else {
            const miss = byTestId(C, "patient-page-missing");
            c.check(!!miss && miss.textContent === NOT_AVAILABLE, `${base}/page/missing`, null, NOT_AVAILABLE, miss ? miss.textContent : visibleText(C).slice(0, 200));
            c.check(!byTestId(C, "patient-app"), `${base}/page/noFallback`, null, "no module rendered", "a module");
          }
          c.check(visibleText(C).includes(CAV.prototype), `${base}/page/@caveat`, null, CAV.prototype, "absent");
        } finally {
          pg.unmount();
          await sleep(0);
          c.check(errors.length === 0, `${base}/page/console`, null, [], errors.slice(0, 10));
        }
      });
    }
  } finally {
    for (const k of ours) { try { registry.unregister(k); } catch (_) { /* gone */ } }
  }
  c.note(`rendered: ${live.map((s) => s.name).join("; ")} in the Patient tab, patient mode (Hand to patient and by address) and patient.html; ${walks} sections walked`);
}
