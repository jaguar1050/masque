// tests/suites/omissions.js — what the Patient surfaces must never carry (design 03 §8.3
// `omissions`, §5.5, §5.11, D15, D26, §4.2 OMISSION_PATTERNS). Owner: WP13.
//
//   graph     the transitive import graph (sources fetched, specifiers collected; nothing
//             executed) of src/engine/patient.js and src/apps/PatientCompanion.jsx excludes
//             scoring.js, fhir.js, rules.js, cohort.js, probes.js, extraction.js, scribe.js,
//             emr.js (release 0.4.3, the clinician EMR template) and ResearchReadinessPanel.jsx
//             (§5.5); patient.html boots src/shell/PatientPage.jsx, whose graph excludes the §5.11
//             list (the clinician shell, the picker, the upload dialog, the four clinician apps,
//             the readiness panel, the population page), engine/emr.js and MASQUE_Voice.js. §5.11 lets PatientPage import registry.js, whose validation path
//             reaches scoring.js; the graph notes list what it holds;
//   view      projectForPatient(module) carries no flag text, points or action, no clinician
//             provenance line, no CAVEATS.scoringChanged and (release 0.4.3) no emrTemplate data;
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
//   es        release 0.4.2 (the Spanish completion): the patient caveats (provenance, edited
//             wording, stale translation) appear in the export's locale — Spanish in es, never the
//             English line there; the .txt / .html carry the Spanish companion of the prototype
//             marker in es only (the English marker always), and the es .html tags each clinician
//             line, notice and marker part with its language. Rendered: <html lang> follows the
//             companion in patient mode (by Hand to patient and by address) and on patient.html,
//             stays English in the clinician shell's Patient tab, and is restored on leaving patient
//             mode and on unmounting the page; the caveat strip, the print header and the patient
//             footer show the companion line (and the es version line) in es only; the strip's
//             patient caveats are the locale's own lines alone in patient mode and on patient.html,
//             while the clinician shell's Patient tab keeps the English lines (lang="en") and adds
//             the locale's lines after them (lang="es"); in patient mode the Patient panel carries no
//             aria-labelledby (no tab bar is rendered), its aria-label naming it; patient mode's
//             title, the Patient panel's label, the return button and the return dialog add the
//             Spanish, and the hidden clinician panels are tagged lang="en" in es (untagged in en);
//             a string toast and its dismiss button are tagged lang="en"; and a DOM scan of the
//             mounted shell or page root (.sa-shell) in es finds no element tagged lang="en"
//             inside the Companion but the "English" locale button, and no English text anywhere
//             outside an element tagged lang="en". That root does not hold the deployed pages'
//             static chrome outside #root, so each deployed page (patient.html and
//             screenair.html#mode=patient) is also booted as served in a hidden 1024 px frame,
//             switched to Español, and its WHOLE body scanned the same way: the corner badge
//             ("Prototype · not for clinical use", outside #root) must be tagged lang="en".
//   settle    (release 0.4.3, review round 3) a walk clicks synchronously, but the host reports
//             the Companion makes from its effects (its locale for the strip, the print header,
//             <html lang> and the title; its dirty state for "Hand to patient") reach the shell in
//             a later task, which a hidden (background) tab delays by about a second. After each
//             walk, and before each state check that follows one, the suite drains the scheduler's
//             posted-message queue and then waits for the state the checks expect (up to 10 s, never
//             throwing: a state that never comes is still reported by the checks), instead of a
//             fixed sleep(0). Reproduced before the change: ?suite=omissions alone in a background
//             tab failed with 24 diffs under the derived module's Spanish walk.
import React from "react";
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { bumpFirstWeight, derivedFixture } from "../harness/derivation.js";
import {
  byTestId, captureDownloads, click, fullAnswers, importApp, mountApp, openShell, qa, sandbox, selectModule, sleep, visibleText, waitFor, walkPatient,
} from "../harness/shell.js";
import { englishCorpus, englishScan, stringLeaves } from "../harness/spanish.js";

const NOW = "2026-10-01T12:00:00.000Z";
const FORBIDDEN_FILES = ["scoring.js", "fhir.js", "rules.js", "cohort.js", "probes.js", "extraction.js", "scribe.js", "emr.js", "ResearchReadinessPanel.jsx"];
// §5.11: the patient page's graph contains none of these (paths under app/src/), nor the voice module.
const PAGE_FORBIDDEN = ["shell/ScreenAIr.jsx", "shell/ModuleWorkspace.jsx", "shell/ModulePicker.jsx", "shell/UploadDialog.jsx", "apps/Screener.jsx",
  "apps/Scribe.jsx", "apps/ResearchTab.jsx", "apps/RubricEditor.jsx", "ResearchReadinessPanel.jsx", "MASQUE_Population.jsx", "MASQUE_Voice.js",
  "engine/emr.js"];
const WHAT_IT_ISNT = '[data-testid="patient-what-it-isnt"]';
const NO_LONGER_LOADED = "This questionnaire is no longer loaded on this device. Please hand the device back to your clinician.";
const NOT_AVAILABLE = "This questionnaire is not available.";
const IMPORT_RE = /(?:^|[\s;}])(?:import|export)\s*(?:[\w*{}\s,$]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
/** D11: the patient footer's version line in Spanish (shell.PatientFooter.versionLine, release 0.4.2). */
const ES_FOOTER_LINE = (name, appVersion, instrument) => `${name} \u00b7 versi\u00f3n ${appVersion} \u00b7 instrumento ${instrument}`;
/** A patient caveat in a locale: its `loc` text where it has one (release 0.4.2), else its English. */
const inLoc = (cav, loc) => (loc !== "en" && cav && typeof cav[loc] === "string" && cav[loc] ? cav[loc] : cav.en);

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
      // Release 0.4.3: the clinician EMR template data never reaches the patient view (projectForPatient is a whitelist).
      const emrUrls = m.emrTemplate && m.emrTemplate.citations ? Object.values(m.emrTemplate.citations).map((x) => x && x.url).filter(Boolean) : [];
      c.check(!Object.prototype.hasOwnProperty.call(view, "emrTemplate") && !viewText.includes("emrTemplate") && !emrUrls.some((u) => viewText.includes(u)),
        `${at}/view/@emrTemplate`, { citations: emrUrls.length }, "absent", "present");
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
        const comp = (policy.CAVEATS.prototypeCompanion || {}).es;
        for (const [kind, text] of [["txt", txt], ["html", htmlBody]]) {
          for (const str of flagStrings) c.check(!text.includes(str), `${at}/${loc}/${kind}/@flagText`, { text: str }, "absent", "present");
          for (const re of policy.OMISSION_PATTERNS) {
            const hit = re.exec(text);
            c.check(!hit, `${at}/${loc}/${kind}/@pattern`, { pattern: String(re) }, "no match", hit && text.slice(Math.max(0, hit.index - 40), hit.index + 40));
          }
          for (const line of clinicianLines) c.check(!text.includes(line), `${at}/${loc}/${kind}/@clinicianProvenance`, { line }, "absent", "present");
          c.check(text.includes(policy.CAVEATS.prototype), `${at}/${loc}/${kind}/@caveat`, null, policy.CAVEATS.prototype, "absent");
          // Release 0.4.2: the patient caveats in the export's locale (Spanish in es, never the English there).
          if (m.origin !== "builtin") {
            const cav = m.origin === "derived" ? policy.CAVEATS.patient.edited : policy.CAVEATS.patient.uploaded;
            const want = inLoc(cav, loc);
            c.check(text.includes(want), `${at}/${loc}/${kind}/@patientProvenance`, null, want, "absent");
            if (want !== cav.en) c.check(!text.includes(cav.en), `${at}/${loc}/${kind}/@patientProvenance/notEnglish`, null, `no "${cav.en}"`, "present");
          }
          const L = (m.locales || {})[loc] && m.locales[loc].data;
          if (L && L.editedLocally) noticeChecks++;
          if (L && Array.isArray(L.stale) && L.stale.length) noticeChecks++;
          for (const [on, cav, name] of [[L && L.editedLocally, policy.CAVEATS.editedWording, "editedWording"], [L && Array.isArray(L.stale) && L.stale.length, policy.CAVEATS.staleTranslation, "stale"]]) {
            if (!on) continue;
            c.check(text.includes(inLoc(cav, loc)), `${at}/${loc}/${kind}/@${name}`, null, inLoc(cav, loc), "absent");
            if (inLoc(cav, loc) !== cav.en) c.check(!text.includes(cav.en), `${at}/${loc}/${kind}/@${name}/notEnglish`, null, `no "${cav.en}"`, "present");
          }
          // D9: the Spanish companion of the marker, next to the English marker, in es only.
          if (loc === "es") c.check(text.includes(`${policy.CAVEATS.prototype} \u2014 ${comp}`), `${at}/${loc}/${kind}/@companion`, null, `${policy.CAVEATS.prototype} — ${comp}`, "absent");
          else c.check(!text.includes(comp), `${at}/${loc}/${kind}/@companion`, null, "no Spanish companion outside es", "present");
        }
        if (loc === "es") {
          // The es .html tags each part with its language (D3, D7, D9): clinician lines, notices, the marker.
          const doc = new DOMParser().parseFromString(html, "text/html");
          const lis = qa(doc, ".clin li");
          const esItems = (view.locales.es && view.locales.es.data && view.locales.es.data.items) || {};
          const wantLi = (id) => (esItems[id] && esItems[id].clin ? "es" : "en");
          c.check(lis.length > 0 && lis.every((li) => li.getAttribute("lang") === "es" || li.getAttribute("lang") === "en") && !qa(doc, ".clin ul[lang]").length,
            `${at}/${loc}/html/clin/@lang`, null, "every clinician line tagged (es for an own clin line), the list untagged", lis.map((li) => li.getAttribute("lang")));
          const items = m.domains.flatMap((d) => d.items).filter((it) => esItems[it.id]);
          if (items.length && items.every((it) => wantLi(it.id) === "es")) c.check(lis.every((li) => li.getAttribute("lang") === "es"), `${at}/${loc}/html/clin/@es`, null, "lang es on every line", lis.map((li) => li.getAttribute("lang")));
          for (const pn of qa(doc, "p.notice")) c.check(pn.getAttribute("lang") === "es", `${at}/${loc}/html/notice/@lang`, { text: pn.textContent }, "es", pn.getAttribute("lang"));
          const spans = qa(doc, "span[lang]");
          c.check(spans.some((x) => x.getAttribute("lang") === "en" && x.textContent === policy.CAVEATS.prototype) && spans.some((x) => x.getAttribute("lang") === "es" && x.textContent === comp),
            `${at}/${loc}/html/marker/@lang`, null, "the English marker lang en, its companion lang es", spans.map((x) => `${x.getAttribute("lang")}:${x.textContent}`).slice(0, 6));
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
 * Let the app settle after a synchronous walk or click (review round 3): drain the scheduler's
 * posted-message queue once (React posts its deferred work the same way, so ours runs after it),
 * then poll `pred` until it holds or `timeout` ms pass. Never throws: the checks that follow report
 * a state that never came. Returns whether `pred` held.
 */
async function settle(pred = () => true, timeout = 10000) {
  await new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { ch.port1.close(); resolve(); };
    ch.port2.postMessage(0);
  });
  try {
    await waitFor(() => { try { return !!pred(); } catch (_) { return false; } }, { timeout, what: "the app to settle" });
    return true;
  } catch (_) {
    return false;
  }
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
  // A patient caveat in any locale → its English (the clinician's Patient tab shows both, release 0.4.2).
  const enCaveat = (text) => {
    for (const cav of [CAV.patient.edited, CAV.patient.uploaded, CAV.editedWording, CAV.staleTranslation]) {
      if (Object.entries(cav).some(([k, v]) => k !== "short" && k !== "esShort" && v === text)) return cav.en;
    }
    return `[no English caveat for ${JSON.stringify(text)}]`;
  };
  const saNs = await importApp(h, "src/shell/ScreenAIr.jsx");
  const MODE_ES = (saNs.PATIENT_MODE_TEXT || {}).es || {};
  // D10: the patient-mode Spanish lines (return button, return dialog, microphone toast) are
  // patient-facing text too: present, and clean of every OMISSION_PATTERNS match.
  for (const t of [MODE_ES.returnButton, MODE_ES.micToast, ...Object.values(MODE_ES.returnDialog || {})]) {
    c.check(typeof t === "string" && t.trim() !== "", "/rendered/PATIENT_MODE_TEXT/es", null, "a Spanish line", t);
    for (const re of policy.OMISSION_PATTERNS) c.check(typeof t !== "string" || !re.test(t), "/rendered/PATIENT_MODE_TEXT/es/@pattern", { pattern: String(re), text: t }, "no match", "match");
  }
  // A string toast is English shell text, and its dismiss label is English: both tagged lang="en",
  // so a toast still showing when <html lang> follows the companion is not read as Spanish. A node
  // message (the patient-mode microphone toast with its Spanish line) tags its own parts.
  {
    const chromeNs = await importApp(h, "src/shell/chrome.jsx");
    const t1 = mountApp(React.createElement(chromeNs.Toast, { message: saNs.MIC_TOAST, onDone: () => {} }));
    const t2 = mountApp(React.createElement(chromeNs.Toast, { message: React.createElement("span", { lang: "es" }, "Ejemplo"), onDone: () => {} }));
    try {
      const x1 = t1.container.querySelector(".sa-toast-x");
      const s1 = t1.container.querySelector(".sa-toast > span");
      c.check(!!x1 && x1.getAttribute("lang") === "en" && x1.getAttribute("aria-label") === "Dismiss" && !!s1 && s1.getAttribute("lang") === "en" && s1.textContent === saNs.MIC_TOAST,
        "/rendered/toast/@lang", null, 'string message and "Dismiss" tagged lang="en"', [x1 && x1.outerHTML.slice(0, 120), s1 && s1.getAttribute("lang")]);
      const s2 = t2.container.querySelector(".sa-toast > span");
      c.check(!!s2 && !s2.hasAttribute("lang") && !!s2.querySelector('span[lang="es"]'), "/rendered/toast/node", null, "a node message keeps its own tags, its wrapper untagged", s2 && s2.outerHTML.slice(0, 120));
    } finally {
      t1.unmount();
      t2.unmount();
    }
  }
  const htmlLang = () => document.documentElement.getAttribute("lang");
  const COMP = (CAV.prototypeCompanion || {}).es;
  const markerWant = (loc) => (loc === "es" ? `${CAV.prototype} \u2014 ${COMP}` : CAV.prototype);
  /** The English and Spanish sources the es DOM scan looks for (release 0.4.2). */
  const corpusFor = (view) => englishCorpus({
    english: [...stringLeaves(patient.PATIENT_CHROME.en), ...stringLeaves(view.locales.en ? view.locales.en.data : {}),
      ...view.domains.flatMap((d) => d.items).map((it) => it.patientClin),
      CAV.patient.edited.en, CAV.patient.uploaded.en, CAV.patient.edited.short, CAV.patient.uploaded.short, CAV.editedWording.en, CAV.staleTranslation.en],
    spanish: [...stringLeaves(patient.PATIENT_CHROME.es), ...stringLeaves(view.locales.es ? view.locales.es.data : {}),
      CAV.patient.edited.es, CAV.patient.uploaded.es, CAV.editedWording.es, CAV.staleTranslation.es],
  });
  const tally = { surfaces: 0, scans: 0, scanTexts: 0, returns: 0 };
  /**
   * The checks of a patient surface (release 0.4.2) in `root` (the visible shell or page) after a
   * walk in `loc`: the strip's marker, the print header, the footer, and in es the DOM scan.
   */
  const surfaceChecks = (at, root, view, loc, module = null) => {
    tally.surfaces += 1;
    const strip = byTestId(root, "caveat-strip");
    const b = strip ? strip.querySelector("b") : null;
    if (module && strip) {
      // A patient surface shows the patient caveats in its locale only, each tagged with its language.
      const want = lineage.provenanceLineParts(module, "patient", { locale: loc }).map((p) => [p.text, p.lang]);
      c.diff(want, qa(strip, ".sa-caveat-line").map((x) => [x.textContent, x.getAttribute("lang")]), { at: `${at}/caveatStrip/lines` });
    }
    c.check(!!b && b.textContent === markerWant(loc), `${at}/caveatStrip/marker`, { loc }, markerWant(loc), b ? b.textContent : "absent");
    if (loc === "es" && b) {
      c.check(qa(b, 'span[lang="en"]').some((x) => x.textContent === CAV.prototype) && qa(b, 'span[lang="es"]').some((x) => x.textContent === COMP),
        `${at}/caveatStrip/marker/@lang`, null, "English marker lang en, companion lang es", b.innerHTML.slice(0, 200));
    }
    const head = root.querySelector("thead.sa-print-head");
    if (head) c.check(head.textContent.startsWith(markerWant(loc)), `${at}/printHeader/marker`, { loc }, markerWant(loc), head.textContent);
    const foot = byTestId(root, "patient-page-footer");
    if (foot) {
      const ps = qa(foot, "p");
      const wantLine = loc === "es" ? ES_FOOTER_LINE(view.name, policy.APP_VERSION, view.instrumentVersion) : `${view.name} \u00b7 release ${policy.APP_VERSION} \u00b7 instrument ${view.instrumentVersion}`;
      c.check(ps.length >= 2 && ps[0].textContent === wantLine && (loc === "es" ? ps[0].getAttribute("lang") === "es" : !ps[0].hasAttribute("lang")),
        `${at}/footer/versionLine`, { loc }, wantLine, ps.length ? `${ps[0].textContent} (lang ${ps[0].getAttribute("lang")})` : "absent");
      c.check(ps.length >= 2 && ps[ps.length - 1].textContent === markerWant(loc), `${at}/footer/marker`, { loc }, markerWant(loc), ps.length ? ps[ps.length - 1].textContent : "absent");
    }
    if (loc !== "es") return;
    const scan = englishScan(root, {
      corpus: corpusFor(view),
      docLang: htmlLang() || "en",
      allowEn: (el) => !el.closest('[data-testid="patient-app"]') || el.matches('[data-testid="patient-locale-en"]'),
    });
    c.check(!scan.langEn.length, `${at}/@scan/langEn`, { loc }, "no lang=\"en\" inside the Companion but the English button", scan.langEn.slice(0, 5));
    c.check(!scan.english.length, `${at}/@scan/english`, { loc }, "no English outside lang=\"en\"", scan.english.slice(0, 5));
    c.check(scan.texts > 20, `${at}/@scan/texts`, null, "a scanned page", scan.texts);
    tally.scans += 1; tally.scanTexts += scan.texts;
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
          const langBefore = htmlLang();
          for (const loc of locs) {
            const at = `${base}/tab/${loc}`;
            walks += await walkAndCheck(c, ctx, { root: panel, view, module: m, loc, at,
              chrome: () => [["caveat-strip", strip().textContent], ["print-header", headText()]] });
            // The clinician's Patient tab: the English patient caveats exactly as before release
            // 0.4.2 (lang "en"); outside English the locale's own lines follow them (lang loc).
            const own = lineage.provenanceLineParts(m, "patient", { locale: loc });
            const wantLines = loc === "en"
              ? ctx.patientLines(m, loc).map((t) => [t, "en"])
              : [...own.map((p) => [enCaveat(p.text), "en"]), ...own.filter((p) => p.lang !== "en").map((p) => [p.text, p.lang])];
            const stripLines = () => qa(strip(), ".sa-caveat-line").map((x) => [x.textContent, x.getAttribute("lang")]);
            await settle(() => headText().startsWith(markerWant(loc)) && JSON.stringify(stripLines()) === JSON.stringify(wantLines));
            c.diff(wantLines, stripLines(), { at: `${at}/caveatStrip/lines` });
            if (loc !== "en" && !builtin) c.check(own.length > 0 && own.every((p) => p.lang === loc), `${at}/caveatStrip/lines/@both`, { loc }, "English lines, then the locale's", wantLines);
            c.check(panel.getAttribute("aria-labelledby") === "sa-tab-patient" && !!C.querySelector("#sa-tab-patient"), `${at}/panel/labelledby`, null,
              "sa-tab-patient (the tab is rendered)", [panel.getAttribute("aria-labelledby"), !!C.querySelector("#sa-tab-patient")]);
            c.check(headText().startsWith(CAV.prototype), `${at}/printHeader`, null, CAV.prototype, headText());
            // The clinician shell's Patient tab: the strip and print header follow the companion, <html lang> does not.
            c.check(headText().startsWith(markerWant(loc)), `${at}/printHeader/marker`, { loc }, markerWant(loc), headText());
            c.check(htmlLang() === langBefore, `${at}/htmlLang`, { loc }, `${langBefore} (clinician mode)`, htmlLang());
          }
          // Patient mode, entered from the Patient tab. The walk above left answers in the
          // companion, so the shell must ask before handing on (D26): assert the dialog, then
          // start a new patient session so the mode walk begins from a fresh companion. The
          // Companion's dirty report reaches the shell in a later task: let it settle first.
          await settle();
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
            // Release 0.4.2: patient mode follows the companion's locale (D6, D10).
            const at = `${base}/mode/${loc}`;
            const wantTitle = loc === "es" ? `screenAIr \u00b7 ${patient.PATIENT_CHROME.es.title}` : "screenAIr \u00b7 Patient Companion";
            const modeLines = lineage.provenanceLineParts(m, "patient", { locale: loc }).map((p) => [p.text, p.lang]);
            const printHead = () => (C.querySelector("thead.sa-print-head") || {}).textContent || markerWant(loc);
            await settle(() => htmlLang() === loc && document.title === wantTitle && printHead().startsWith(markerWant(loc))
              && JSON.stringify(qa(byTestId(shellEl, "caveat-strip"), ".sa-caveat-line").map((x) => [x.textContent, x.getAttribute("lang")])) === JSON.stringify(modeLines));
            c.check(htmlLang() === loc, `${at}/htmlLang`, { loc }, loc, htmlLang());
            c.check(document.title === wantTitle, `${at}/title`, { loc }, wantTitle, document.title);
            const rb = byTestId(C, "return-to-clinician");
            // The hidden clinician panels keep English labels (and, once visited, English content):
            // tagged lang="en" while <html lang> follows a non-English companion, untagged in English.
            const others = ["screener", "scribe", "research", "editor"].map((k) => C.querySelector(`#sa-panel-${k}`)).filter(Boolean);
            c.check(others.length > 0 && others.every((p) => (loc === "en" ? !p.hasAttribute("lang") : p.getAttribute("lang") === "en")), `${at}/panels/@lang`, { loc },
              loc === "en" ? "every clinician panel untagged" : 'every clinician panel lang="en"', others.map((p) => `${p.dataset.panel}:${p.getAttribute("lang")}`));
            if (loc === "es") {
              c.check(modePanel.getAttribute("aria-label") === patient.PATIENT_CHROME.es.title && modePanel.getAttribute("lang") === "es", `${at}/panel/label`, null,
                `${patient.PATIENT_CHROME.es.title} (lang es)`, [modePanel.getAttribute("aria-label"), modePanel.getAttribute("lang")]);
              c.check(!!rb && qa(rb, 'span[lang="en"]').some((x) => x.textContent === "Return to clinician view") && qa(rb, 'span[lang="es"]').some((x) => x.textContent === MODE_ES.returnButton && !!MODE_ES.returnButton),
                `${at}/returnButton`, null, `Return to clinician view (en) + ${MODE_ES.returnButton} (es)`, rb ? rb.innerHTML.slice(0, 200) : "absent");
            } else {
              c.check(!!rb && rb.textContent === "Return to clinician view" && !qa(rb, "[lang]").length, `${at}/returnButton`, null, "Return to clinician view (English only)", rb ? rb.innerHTML : "absent");
              c.check(!modePanel.hasAttribute("lang") && modePanel.getAttribute("aria-label") !== patient.PATIENT_CHROME.es.title, `${at}/panel/label`, null,
                "the English panel label, untagged", [modePanel.getAttribute("aria-label"), modePanel.getAttribute("lang")]);
            }
            c.check(!modePanel.hasAttribute("aria-labelledby") && !C.querySelector("#sa-tab-patient") && !!modePanel.getAttribute("aria-label"), `${at}/panel/labelledby`, { loc },
              "no aria-labelledby (no tab is rendered); named by aria-label", [modePanel.getAttribute("aria-labelledby"), modePanel.getAttribute("aria-label")]);
            surfaceChecks(at, shellEl, view, loc, m);
          }
          const page = visibleText(shellEl, [WHAT_IT_ISNT]);
          c.check(page.includes(CAV.prototype), `${base}/mode/@caveat`, null, CAV.prototype, "absent");
          // Leaving patient mode from es: the return dialog adds the Spanish (D10), and <html lang> is restored.
          if (locs[locs.length - 1] === "es") {
            click(byTestId(C, "return-to-clinician"));
            const dlg = await waitFor(() => byTestId(C, "return-dialog"), { what: "the return dialog" });
            const pair = (el, en, es) => !!el && qa(el, 'span[lang="en"]').some((x) => x.textContent === en) && qa(el, 'span[lang="es"]').some((x) => x.textContent === es && !!es);
            const rd = MODE_ES.returnDialog || {};
            c.check(pair(dlg.querySelector("h2"), "Return to clinician view?", rd.title), `${base}/mode/es/returnDialog/title`, null, rd.title, dlg.querySelector("h2") && dlg.querySelector("h2").innerHTML.slice(0, 200));
            c.check(pair(dlg.querySelector(".sa-confirm-body"), saNs.RETURN_TEXT, rd.body), `${base}/mode/es/returnDialog/body`, null, rd.body, (dlg.querySelector(".sa-confirm-body") || {}).textContent);
            c.check(pair(byTestId(dlg, "confirm-cancel"), "Stay in patient mode", rd.stay), `${base}/mode/es/returnDialog/stay`, null, rd.stay, (byTestId(dlg, "confirm-cancel") || {}).textContent);
            c.check(pair(byTestId(dlg, "confirm-ok"), "Return to clinician view", rd.confirm), `${base}/mode/es/returnDialog/confirm`, null, rd.confirm, (byTestId(dlg, "confirm-ok") || {}).textContent);
            click(byTestId(dlg, "confirm-ok"));
            await waitFor(() => C.querySelector('.sa-shell[data-mode="clinician"]'), { what: "clinician mode" });
            await settle(() => htmlLang() === langBefore && !/Preparándose|Patient Companion/.test(document.title));
            c.check(htmlLang() === langBefore, `${base}/mode/es/return/htmlLang`, null, `${langBefore} (restored)`, htmlLang());
            c.check(!/Preparándose|Patient Companion/.test(document.title), `${base}/mode/es/return/title`, null, "the clinician title", document.title);
            tally.returns += 1;
          }
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
              await settle(() => htmlLang() === loc && ((C.querySelector("thead.sa-print-head") || {}).textContent || markerWant(loc)).startsWith(markerWant(loc)));
              c.check(htmlLang() === loc, `${base}/address/${loc}/htmlLang`, { loc }, loc, htmlLang());
              surfaceChecks(`${base}/address/${loc}`, shellEl, view, loc, m);
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
        const pageLangBefore = htmlLang();
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
                // Release 0.4.2 (D6): the page follows the companion's locale.
                const at = `${base}/page/${loc}`;
                const title = (patient.PATIENT_CHROME[loc] || patient.PATIENT_CHROME.en).title;
                await settle(() => htmlLang() === loc && document.title === `${view.name} \u00b7 ${title}`);
                c.check(htmlLang() === loc, `${at}/htmlLang`, { loc }, loc, htmlLang());
                c.check(document.title === `${view.name} \u00b7 ${title}`, `${at}/title`, { loc }, `${view.name} · ${title}`, document.title);
                const hs = byTestId(C, "patient-page-header");
                const span = hs ? qa(hs, "span").pop() : null;
                c.check(!!span && span.textContent === `${view.name} \u00b7 ${title}` && (loc === "en" ? !span.hasAttribute("lang") : span.getAttribute("lang") === loc),
                  `${at}/header`, { loc }, `${view.name} · ${title}${loc === "en" ? "" : ` (lang ${loc})`}`, span ? `${span.textContent} (lang ${span.getAttribute("lang")})` : "absent");
                surfaceChecks(at, shellEl, view, loc, m);
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
          await settle(() => htmlLang() === pageLangBefore);
          c.check(htmlLang() === pageLangBefore, `${base}/page/htmlLang/restored`, null, pageLangBefore, htmlLang());
          c.check(errors.length === 0, `${base}/page/console`, null, [], errors.slice(0, 10));
        }
      });
    }
  } finally {
    for (const k of ours) { try { registry.unregister(k); } catch (_) { /* gone */ } }
  }

  // ---------------------------------------------------------------- the deployed pages, as served
  // The scans above see the mounted shell or page root only. The deployed pages also carry static
  // chrome outside #root (the corner badge "Prototype · not for clinical use"; noscript), which
  // stays English while <html lang> follows the companion. Each page is booted by its own loader
  // in a hidden same-origin frame at 1024 px (the badge shows above 640 px), switched to Español,
  // and its whole body scanned; then switched back to English.
  const mv = patient.projectForPatient(masque);
  const frames = [];
  if (Object.keys(mv.locales || {}).includes("es")) {
    const id = encodeURIComponent(mv.id);
    // A fresh query on each page, so the frame loads the page as served now, never a cached copy
    // (the loader fetches modules with no-cache; the page itself goes through the HTTP cache).
    const fresh = `fresh=${Date.now().toString(36)}`;
    for (const [name, path] of [["patient.html", `patient.html?module=${id}&${fresh}`], ["screenair.html#mode=patient", `screenair.html?${fresh}#tab=patient&mode=patient&module=${id}`]]) {
      const at = `/rendered/frame/${name}`;
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:absolute;left:-10000px;top:0;width:1024px;height:800px;border:0";
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      try {
        frame.src = h.appUrl(path);
        document.body.appendChild(frame);
        const doc = await waitFor(() => {
          const d = frame.contentDocument;
          if (!d || !d.documentElement) return null;
          return d.querySelector("[role=alert]") || (d.documentElement.dataset.masqueReady === "true" && d.querySelector('[data-testid="patient-locale-es"]')) ? d : null;
        }, { timeout: 45000, every: 50, what: `${name} to boot in a frame` });
        const win = frame.contentWindow;
        const alert = doc.querySelector("[role=alert]");
        if (!c.check(!alert && doc.documentElement.dataset.masqueReady === "true", `${at}/boot`, null, "masqueReady, no loader error", alert ? alert.textContent.slice(0, 300) : "not ready")) continue;
        const badge = doc.querySelector(".masque-proto");
        const near = (el) => { const x = el && el.closest("[lang]"); return x ? x.getAttribute("lang") : null; };
        c.check(!!badge && badge.textContent === CAV.prototype && win.getComputedStyle(badge).display !== "none", `${at}/badge`, null, `${CAV.prototype}, shown at 1024 px`,
          badge ? `${badge.textContent} (display ${win.getComputedStyle(badge).display})` : "absent");
        c.check(doc.documentElement.getAttribute("lang") === "en" && near(badge) === "en", `${at}/en/@lang`, null, "<html lang> en, the badge en", [doc.documentElement.getAttribute("lang"), near(badge)]);
        doc.querySelector('[data-testid="patient-locale-es"]').click();
        await waitFor(() => doc.documentElement.getAttribute("lang") === "es", { what: `${name}: <html lang> es after Español` });
        await sleep(50);
        c.check(near(badge) === "en", `${at}/es/badge/@lang`, null, 'the corner badge lang="en" on an es page', badge ? `${near(badge)} (${badge.outerHTML.slice(0, 120)})` : "absent");
        const scan = englishScan(doc.body, {
          corpus: corpusFor(mv),
          docLang: "es",
          allowEn: (el) => !el.closest('[data-testid="patient-app"]') || el.matches('[data-testid="patient-locale-en"]'),
        });
        c.check(!scan.langEn.length, `${at}/es/@scan/langEn`, null, "no lang=\"en\" inside the Companion but the English button", scan.langEn.slice(0, 5));
        c.check(!scan.english.length, `${at}/es/@scan/english`, null, "no English outside lang=\"en\" anywhere in the body", scan.english.slice(0, 5));
        c.check(scan.texts > 20, `${at}/es/@scan/texts`, null, "a scanned page", scan.texts);
        if (name.startsWith("screenair")) {
          const others = [...doc.querySelectorAll('[role="tabpanel"]')].filter((p) => p.dataset.panel !== "patient");
          c.check(others.length > 0 && others.every((p) => p.getAttribute("lang") === "en"), `${at}/es/panels/@lang`, null, 'every clinician panel lang="en"', others.map((p) => `${p.dataset.panel}:${p.getAttribute("lang")}`));
        }
        doc.querySelector('[data-testid="patient-locale-en"]').click();
        await waitFor(() => doc.documentElement.getAttribute("lang") === "en", { what: `${name}: <html lang> en after English` });
        c.check(near(badge) === "en", `${at}/en-again/badge/@lang`, null, "en", near(badge));
        frames.push({ name, texts: scan.texts });
      } catch (err) {
        c.check(false, `${at}/drive`, null, "booted and driven", String((err && err.message) || err).split("\n")[0]);
      } finally {
        frame.remove();
      }
    }
    c.check(frames.length === 2, "/rendered/frame/@coverage", null, "both deployed pages scanned in es", frames.map((f) => f.name));
  }
  c.note(`deployed pages in a frame (whole body, es): ${frames.map((f) => `${f.name} (${f.texts} text nodes)`).join("; ") || "none"}`);
  c.note(`rendered: ${live.map((s) => s.name).join("; ")} in the Patient tab, patient mode (Hand to patient and by address) and patient.html; ${walks} sections walked`);
  c.note(`release 0.4.2: ${tally.surfaces} patient surfaces checked (strip, print header, footer, <html lang>), ${tally.scans} es DOM scans (${tally.scanTexts} text nodes), ${tally.returns} returns to the clinician view from es`);
  const esLive = live.filter((s) => Object.keys(patient.projectForPatient(s.module).locales || {}).includes("es"));
  c.check(tally.scans >= esLive.length * 2 && tally.returns === esLive.length, "/rendered/@es-coverage", null, `≥ ${esLive.length * 2} es scans, ${esLive.length} returns`, tally);
}
