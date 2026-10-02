// tests/suites/shape.js — the data-only shape fixture through every engine function and all
// five tabs of the shell (design 03 §8.3 `shape`, §3.5). Owner: WP13.
//
// Engine half, on tests/fixtures/modules/shape.rubric.json bound generic (a plain upload next to
// the built-ins): it validates with zero errors; every engine function runs on it without
// throwing over a seeded answer sweep; and the §3.5 defaults hold:
//   - routing: the screener shows the engine card "No routing rules in this module" once the
//     screen is cleared and scorable; the scribe shows nothing; override and incomplete cards
//     still come first;
//   - phenotypes: complaint "" everywhere, every domain active, no referral, no CDS index card;
//   - the generic patient summary quotes each item's own `q` verbatim (" — option" for a scale
//     value > 0), asks nothing and has no gap line;
//   - no lexicon: extract captures nothing, availability says "no voice capture (no lexicon)";
//   - no probes: the probe rail is empty; no research: no population estimates;
//   - the Patient Companion works, and its .txt / .html exports match no OMISSION_PATTERNS.
// Render half, through the real shell (src/shell/ScreenAIr.jsx mounted in a detached container,
// the page address, title and storage restored afterwards):
//   - the fixture's bytes go through the Upload option of the module picker and the upload
//     dialog (Validate, the availability line on the result card, Load), which switches to it;
//   - the five tabs open in turn, each with content: the Screener walked to its result (the
//     generic card alone when cleared and scorable, no CDS card; with the red flag on, the
//     override card instead and the safety CDS card), no sample rail; the Scribe with the
//     no-lexicon notice and no Listen / Play / Step / typed input, every suggestion answered,
//     no probe rail, no routing card, the note's noDriver line; the Patient Companion walked to
//     its summary (each item's `q` quoted, exports free of OMISSION_PATTERNS, the at-home link
//     refused for a non-built-in); Research's two "no population / no research configuration"
//     messages; the Rubric Editor open on the fixture;
//   - the caveat strip (clinician and patient provenance), the print header, the footer's axes,
//     the document title and the ModuleInfo availability summary;
//   - no console error, window error or unhandled rejection anywhere in the render half.
// Placeholder half, on tests/fixtures/modules/placeholder.{rubric.json,logic.js} (the non-MASQUE
// module with logic, a lexicon, probes and an es locale — every optional family):
//   - it validates with zero errors (its closures use the F5 helpers: `isAnswered(id)`, and
//     `answered` is a number), and the activation, phenotype, probe, extraction and patient
//     (gap line, en and es) paths run on it without an error;
//   - through the shell's Upload dialog, with consent for its logic, it loads, and its Ambient
//     Scribe offers Listen and captures a typed statement; under the Playwright runner (the
//     voice stub and fake media installed) Listen starts the microphone path and a final speech
//     result is captured into the uploaded module with the "· voice" tag, the readout's coverage
//     and domain bars matching computeScore over the captured answers.
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need } from "../harness/kit.js";
import { drawAnswers } from "../harness/matrix.js";
import {
  byTestId, captureDownloads, choose, click, fullAnswers, importApp, openShell, openTab, qa, sandbox, setFiles,
  visibleText, waitFor, walkPatient,
} from "../harness/shell.js";

const NOW = "2026-10-01T12:00:00.000Z";
const NO_ROUTING = { h: "No routing rules in this module", p: "This module defines no routing rules, so no next step is suggested from the index." };
// Literal engine and app texts the design fixes for a module without these families (§3.5).
const NO_LEXICON = "This module has no extraction lexicon: speech and typed statements cannot be captured into the screen. Use the prompts.";
const NO_POPULATION = "No population estimates for this module.";
const NO_RESEARCH = "This module declares no research configuration; the readiness panel needs one.";
const NO_VOICE = "Ambient Scribe: no voice capture (no lexicon)";
const UPLOAD_VALUE = "__upload__";

export default {
  name: "shape",
  owner: "WP13",
  run: guarded("shape", async (h) => {
    const { module: masque } = await loadMasque(h);
    const E = {};
    for (const f of ["scoring.js", "rules.js", "gates.js", "scribe.js", "fhir.js", "cohort.js", "patient.js", "probes.js", "extraction.js", "lineage.js", "policy.js", "generic.js"]) E[f.replace(".js", "")] = await h.engine(f);
    need(typeof E.scoring.computeScore === "function", "waits on WP3");
    const c = collector(h);
    const { module: m, validation } = await h.loadFixture("shape", { builtins: [masque], loaded: [masque] });
    c.check(!(validation.errors || []).length, "/validation/errors", null, [], (validation.errors || []).map((e) => `${e.code} ${e.path}`));
    c.note(`shape: ${m.domains.length} domains, ${m.allItems.length} items, origin ${m.origin}; ${validation.warnings.length} warning(s)`);
    c.check(m.origin === "uploaded", "/origin", null, "uploaded", m.origin);

    // Availability (§4.16).
    const av = E.lineage.availability(m);
    c.check(av.scribe.voice === false && av.scribe.reason === "no voice capture (no lexicon)", "/availability/scribe", null, { voice: false, reason: "no voice capture (no lexicon)" }, av.scribe);
    c.check(av.scribe.probes === false, "/availability/scribe/probes", null, false, av.scribe.probes);
    c.check(av.patient.available === true, "/availability/patient", null, true, av.patient);
    c.check(av.research.population === false && av.research.readiness === false, "/availability/research", null, { population: false, readiness: false }, av.research);

    // A seeded sweep through every engine function.
    const rng = h.rng(h.seed ^ 0x53484150); // "SHAP"
    const items = m.allItems.map((it) => ({ id: it.id, scale: it.scale }));
    const flagIds = m.redFlags.map((f) => f.id);
    const view = E.patient.projectForPatient(m);
    let sawCard = 0, sawScorable = 0;
    const N = h.quick ? 300 : 2000;
    for (let i = 0; i < N; i++) {
      const p = [0, 0.15, 0.3, 0.6, 1][i % 5];
      const answers = drawAnswers(rng, items, p);
      const rf = rng() < 0.15 ? { [flagIds[0]]: true } : {};
      const safetyReviewed = rng() < 0.8;
      const input = { answers, rf, safetyReviewed };
      try {
        const score = E.scoring.computeScore(m, answers);
        const ph = E.rules.derivePhenotype(m, answers);
        c.check(ph.value === "" && ph.error === null, "/derivePhenotype", input, { value: "", error: null }, ph);
        const act = E.rules.activeDomains(m, { answers, complaint: "" });
        c.check(act.domains.size === m.domains.length, "/activeDomains", input, m.domainOrder, [...act.domains]);
        for (const surface of ["screener", "scribe"]) {
          const st = E.rules.buildRoutingState(m, { surface, answers, ctx: {}, complaint: "", score, activeFlags: rf, safetyReviewed });
          const out = E.rules.routingRecs(m, st);
          const override = Object.keys(rf).length > 0;
          if (surface === "screener" && !override && score.scorable) {
            sawCard++;
            c.check(out.recs.length === 1 && out.recs[0].h === NO_ROUTING.h && out.recs[0].p === NO_ROUTING.p, "/routingRecs/screener/@generic", input, NO_ROUTING, out.recs);
          }
          if (surface === "scribe" && !override && score.scorable) c.check(out.recs.length === 0, "/routingRecs/scribe", input, [], out.recs);
          c.check(out.error === null, `/routingRecs/${surface}/error`, input, null, out.error);
          const pv = E.rules.cdsPreview(m, st, { routingError: null });
          c.check(pv.index === null, `/cdsPreview/${surface}/index`, input, null, pv.index);
          const bundle = E.fhir.buildBundle(m, { patient: m.demo.patient, answers, score, complaint: "", activeFlags: E.rules.activeFlagsOf(m, rf),
            routingCleared: !override && safetyReviewed, routingError: null }, { surface, now: NOW });
          c.check(!bundle.entry.some((e) => e.resource.resourceType === "ServiceRequest" && e.resource.priority === "routine"), `/buildBundle/${surface}/referral`, input, "none", "a referral");
          if (surface === "scribe") {
            const note = E.scribe.buildNote(m, { patient: m.demo.patient, answers, ctx: {}, vmp: {}, score, complaint: "", recs: out.recs, routingError: null,
              gapAlert: false, activeFlags: E.rules.activeFlagsOf(m, rf), safetyReviewed, probeNotes: [] });
            c.check(typeof note === "string" && note.length > 0, "/buildNote", input, "a note", typeof note);
          }
        }
        if (score.scorable) sawScorable++;
        c.check(E.rules.referralFor(m, "") === null, "/referralFor", input, null, E.rules.referralFor(m, ""));
        const sug = E.scribe.rankSuggestions(m, { answers, complaint: "", vmp: {}, scorable: score.scorable, skipped: {} });
        c.check(Array.isArray(sug.list) && sug.list.every((s) => s.kind === "scored"), "/rankSuggestions", input, "scored items only", sug.list);
        c.check(E.probes.liveProbes(m.logic && m.logic.probes ? m.logic.probes.list : [], answers, rf, {}).length === 0, "/liveProbes", input, [], "probes");
        c.check(E.extraction.extract(m.lexicon, "Example item A1 and example item B1", {}).length === 0, "/extract", input, [], "captures");
        const row = E.cohort.screenToCohortRow(m, { patient: m.demo.patient, answers, score, activeFlags: [], complaint: "", ctx: {} }, { now: Date.parse(NOW), nonce: "aaaaa" });
        c.check(row.module_id === m.id && row.complaint === "", "/screenToCohortRow", input, { module_id: m.id, complaint: "" }, { module_id: row.module_id, complaint: row.complaint });
        // Generic summary: the module's own wording, verbatim.
        const { summary, error } = E.patient.buildPatientSummary(view, "en", { a: answers, ctx: {}, flags: rf });
        if (c.check(!error && !!summary, "/buildPatientSummary", input, "a summary", error)) {
          const en = m.rubric.locales.en.items;
          const want = [];
          for (const it of m.allItems) {
            const v = answers[it.id];
            if (it.scale) { if (typeof v === "number" && v > 0) want.push(`${en[it.id].q} — ${en[it.id].opts[v]}`); }
            else if (v === "yes") want.push(en[it.id].q);
          }
          c.diff(want, summary.said, { at: "/summary/said", input });
          c.diff([], summary.ask, { at: "/summary/ask", input });
          c.check(summary.gapLine === null, "/summary/gapLine", input, null, summary.gapLine);
          const txt = E.patient.summaryText(view, "en", summary, { generatedAt: NOW });
          const html = E.patient.summaryHtml(view, "en", summary, { generatedAt: NOW });
          for (const re of E.policy.OMISSION_PATTERNS) {
            c.check(!re.test(txt), "/summaryText/@pattern", { ...input, pattern: String(re) }, "no match", "match");
            const body = new DOMParser().parseFromString(html, "text/html").body.textContent;
            c.check(!re.test(body), "/summaryHtml/@pattern", { ...input, pattern: String(re) }, "no match", "match");
          }
        }
      } catch (err) {
        if (/not implemented/.test(err.message)) throw err;
        c.check(false, "/threw", input, "no throw", String(err.stack || err.message).split("\n").slice(0, 3).join(" | "));
      }
    }
    c.check(sawCard > 0, "/@coverage/genericCard", null, "> 0", sawCard);
    // The published artifacts build.
    for (const [name, fn] of [["buildQuestionnaire", () => E.fhir.buildQuestionnaire(m, { date: NOW.slice(0, 10) })], ["buildCdsHooks", () => E.fhir.buildCdsHooks(m)],
      ["buildDataDictionary", () => E.fhir.buildDataDictionary(m, {})], ["cohortColumnsCsv", () => E.cohort.cohortColumnsCsv(m)]]) {
      try { fn(); c.check(true, `/${name}`); } catch (err) { c.check(false, `/${name}`, null, "builds", String(err.message)); }
    }
    const cds = E.fhir.buildCdsHooks(m);
    c.check(!cds.exampleResponses.settledNonLowBand && Array.isArray(cds.exampleResponses.notScorable.cards) && !!cds.exampleResponses.redFlagPresent,
      "/buildCdsHooks/examples", null, "redFlagPresent + notScorable, no settled", Object.keys(cds.exampleResponses));
    c.note(`${N} answer sets (${sawScorable} scorable; the generic screener card checked ${sawCard} times)`);

    // ------------------------------------------------------------------ render half
    await renderHalf(h, c, E, m);

    // ------------------------------------------------------------------ placeholder half
    await placeholderHalf(h, c, E, masque);
    return c.result();
  }),
};

// ============================================================================ render half

/** The generic summary's `said` lines for `answers` (§3.5), from the module's own wording. */
function expectedSaid(m, answers) {
  const en = m.rubric.locales.en.items;
  const want = [];
  for (const it of m.allItems) {
    const v = answers[it.id];
    if (it.scale) { if (typeof v === "number" && v > 0) want.push(`${en[it.id].q} — ${en[it.id].opts[v]}`); }
    else if (v === "yes") want.push(en[it.id].q);
  }
  return want;
}

/** Walk the mounted Screener from a fresh screen to its result, answering every item at its last option. */
function driveScreener(panel, { flags = [] } = {}) {
  const problems = [];
  const navLast = () => { const bs = qa(byTestId(panel, "scr-nav"), "button"); return bs[bs.length - 1] || null; };
  const step = () => panel.querySelector('[data-testid="scr-step"]');
  for (const flag of flags) {
    const row = qa(step(), ".rf").find((el) => el.textContent.includes(flag.text));
    if (row) click(row); else problems.push(`safety: no flag row "${flag.text}"`);
  }
  if (!flags.length) {
    const none = panel.querySelector(".safetybar button");
    if (none) click(none); else problems.push("safety: no 'None of these apply' button");
  }
  for (let guard = 0; guard < 20 && !byTestId(panel, "scr-readout"); guard++) {
    for (const q of qa(step(), ".q[data-item], .q[data-context]")) {
      const bs = qa(q, ".opts button");
      const last = bs[bs.length - 1];
      if (last && !last.classList.contains("sel")) click(last);
    }
    const n = navLast();
    if (!n || n.disabled) { problems.push(`step ${step() && step().getAttribute("data-step")}: cannot continue`); break; }
    click(n);
  }
  if (!byTestId(panel, "scr-readout")) problems.push("the result step was not reached");
  return problems;
}

async function renderHalf(h, c, E, fixtureModule) {
  let ScreenAIr, registry, chrome, companion;
  try {
    [ScreenAIr, registry, chrome, companion] = await Promise.all([
      importApp(h, "src/shell/ScreenAIr.jsx").then((ns) => ns.default),
      importApp(h, "src/shell/registry.js"),
      importApp(h, "src/shell/chrome.jsx"),
      importApp(h, "src/apps/PatientCompanion.jsx"),
    ]);
  } catch (err) {
    c.check(false, "/render/compile", null, "src/shell/ScreenAIr.jsx and its graph compile (WP7-WP12)", String(err.message).split("\n").slice(0, 2).join(" "));
    return;
  }
  if (typeof ScreenAIr !== "function") { c.check(false, "/render/compile", null, "a default-exported shell component", typeof ScreenAIr); return; }
  // A shape entry left by an earlier run in this page would make the upload "already loaded".
  for (const e of registry.registered()) if (e.origin !== "builtin" && e.module && e.module.id === fixtureModule.id) registry.unregister(e.key);
  const bytes = await h.fixture("modules/shape.rubric.json", "bytes");
  const CAV = E.policy.CAVEATS;
  let shapeKey = null;
  let checked = 0;
  const at = (p) => `/render${p}`;

  await sandbox({ hash: "#tab=screener" }, async ({ errors }) => {
    const shell = await openShell(h, ScreenAIr);
    const C = shell.container;
    try {
      // ---------------------------------------------------------------- upload through the picker
      choose(C.querySelector("select#sa-module"), UPLOAD_VALUE);
      const dlg = await waitFor(() => byTestId(C, "upload-dialog"), { what: "the upload dialog" });
      setFiles(byTestId(dlg, "upload-input"), [new File([bytes], "shape.rubric.json", { type: "application/json" })]);
      click(await waitFor(() => { const b = byTestId(C, "upload-validate"); return b && !b.disabled ? b : null; }, { what: "Validate to enable" }));
      const load = await waitFor(() => { const b = byTestId(C, "upload-load"); return b && !b.disabled ? b : null; }, { what: "Load to enable" });
      const avail = byTestId(C, "upload-availability");
      c.check(!!avail && avail.textContent.includes(NO_VOICE), at("/upload/availability"), null, NO_VOICE, avail ? avail.textContent : "absent");
      click(load);
      await waitFor(() => C.querySelector(`main.sa-main[data-module="${fixtureModule.id}"]`), { what: "the shell to switch to the uploaded fixture" });
      const entry = registry.registered().find((e) => e.origin !== "builtin" && e.module && e.module.id === fixtureModule.id);
      if (!c.check(!!entry, at("/upload/registered"), null, "a registered upload", "none")) return;
      shapeKey = entry.key;
      const m = entry.module;
      c.check(m.origin === "uploaded", at("/upload/origin"), null, "uploaded", m.origin);
      c.check(chrome.availabilityText(m).includes(NO_VOICE), at("/availabilityText"), null, NO_VOICE, chrome.availabilityText(m));
      c.check(document.title === `screenAIr · ${m.label} (uploaded)`, at("/title"), null, `screenAIr · ${m.label} (uploaded)`, document.title);
      const strip = () => { const s = byTestId(C, "caveat-strip"); return s ? qa(s, ".sa-caveat-line").map((x) => x.textContent) : null; };
      const head = () => { const t = C.querySelector("thead.sa-print-head"); return t ? t.textContent : null; };
      const footer = byTestId(C, "version-footer");
      const footText = footer ? footer.textContent : "";
      for (const axis of [`module ${m.id}`, `instrument ${m.instrumentVersion}`, "lexicon —", "probe set —", "gold set — (not benchmarked)", CAV.prototype]) {
        c.check(footText.includes(axis), at("/footer"), { axis }, axis, footText);
      }

      // ---------------------------------------------------------------- Clinician Screener
      let p = await openTab(C, "screener");
      c.diff(E.lineage.provenanceLines(m, "clinician"), strip(), { at: at("/screener/caveatStrip") });
      c.check((head() || "").startsWith(CAV.prototype), at("/screener/printHeader"), null, CAV.prototype, head());
      c.check(!byTestId(p, "sample-rail"), at("/screener/sampleRail"), null, "hidden (no sampleCases)", "shown");
      for (const pr of driveScreener(p)) c.check(false, at("/screener/drive"), null, "drivable", pr);
      const readout = byTestId(p, "scr-readout");
      c.check(!!readout && /^SCORE \//.test(readout.textContent), at("/screener/scorable"), null, "SCORE / …", readout ? readout.textContent : "absent");
      const recs = qa(byTestId(p, "scr-recs"), ".rec").map((r) => ({ h: r.querySelector("h4").textContent, p: r.querySelector("p").textContent }));
      c.diff([NO_ROUTING], recs, { at: at("/screener/recs") });
      c.check(!byTestId(p, "cds-preview"), at("/screener/cdsPreview"), null, "no CDS card (no cdsTerm, no flag)", byTestId(p, "cds-preview") && byTestId(p, "cds-preview").textContent);
      // With the red flag on: the override card first, the safety CDS card, never the generic card.
      click(qa(byTestId(p, "scr-nav"), "button").pop()); // New screen
      for (const pr of driveScreener(p, { flags: m.redFlags })) c.check(false, at("/screener/drive/flag"), null, "drivable", pr);
      c.check(!!byTestId(p, "scr-override"), at("/screener/override"), null, "the override card", "absent");
      const recsF = qa(byTestId(p, "scr-recs"), ".rec").map((r) => r.querySelector("h4").textContent);
      c.check(!recsF.includes(NO_ROUTING.h), at("/screener/override/recs"), null, "no generic card under an override", recsF);
      const cds = byTestId(p, "cds-preview");
      c.check(!!cds && cds.getAttribute("data-card") === "safety", at("/screener/override/cds"), null, "the safety CDS card", cds ? cds.getAttribute("data-card") : "absent");
      checked += 1;

      // ---------------------------------------------------------------- Ambient Scribe
      p = await openTab(C, "scribe");
      const notice = byTestId(p, "scribe-no-lexicon");
      c.check(!!notice && notice.textContent.trim() === NO_LEXICON, at("/scribe/noLexicon"), null, NO_LEXICON, notice ? notice.textContent.trim() : "absent");
      for (const id of ["scribe-listen", "scribe-stop", "scribe-play", "scribe-step", "scribe-input", "scribe-capture", "scribe-meter"]) {
        c.check(!byTestId(p, id), at(`/scribe/transport/${id}`), null, "hidden (no lexicon)", "shown");
      }
      click(byTestId(p, "scribe-view-prompts"));
      for (let guard = 0; guard < 30; guard++) {
        const s = byTestId(p, "scribe-suggestions") && byTestId(p, "scribe-suggestions").querySelector(".prompt");
        if (!s) break;
        const b = s.querySelector(".pbtn.y") || qa(s, ".pbtn:not(.skip):not(.n)").pop();
        if (!b) { c.check(false, at("/scribe/drive"), null, "an answer button", s.textContent); break; }
        click(b);
      }
      c.check(!byTestId(p, "scribe-suggestions") || !byTestId(p, "scribe-suggestions").querySelector(".prompt"), at("/scribe/suggestions"), null, "all answered", "outstanding");
      c.check(!byTestId(p, "scribe-probes"), at("/scribe/probeRail"), null, "hidden (no probes)", "shown");
      click(byTestId(p, "scribe-view-safety"));
      const review = byTestId(p, "scribe-review");
      if (c.check(!!review, at("/scribe/review"), null, "the safety review button", "absent")) click(review);
      click(byTestId(p, "scribe-view-prompts"));
      const srecs = byTestId(p, "scribe-recs");
      c.check(!srecs || !qa(srecs, ".rec").length, at("/scribe/recs"), null, "no routing card (§3.5)", srecs ? srecs.textContent : null);
      click(byTestId(p, "scribe-view-note"));
      const note = byTestId(p, "scribe-note");
      const noDriver = (m.copy && m.copy.note && m.copy.note.noDriver) || E.generic.ENGINE_COPY_DEFAULTS.note.noDriver;
      c.check(!!note && note.textContent.includes(noDriver), at("/scribe/note/noDriver"), null, noDriver, note ? note.textContent.slice(-400) : "absent");
      checked += 1;

      // ---------------------------------------------------------------- Patient Companion
      p = await openTab(C, "patient");
      const view = E.patient.projectForPatient(m);
      const bar = byTestId(p, "patient-mode-bar");
      c.check(!!bar && bar.textContent.includes("At-home use is available for built-in modules only.") && !bar.querySelector("a"), at("/patient/atHome"), null,
        "no at-home link for an upload", bar ? bar.textContent : "absent");
      c.diff(E.lineage.provenanceLines(m, "patient", { locale: "en" }), strip(), { at: at("/patient/caveatStrip") });
      c.check(head() === companion.patientPrintHeader(view, { loc: "en", reviewed: true }), at("/patient/printHeader"), null,
        companion.patientPrintHeader(view, { loc: "en", reviewed: true }), head());
      const { a, ctx } = fullAnswers(m);
      const walk = walkPatient(p, view, { loc: "en", a, ctx, flags: "all", snap: (key, sec) => visibleText(sec, ['[data-testid="patient-what-it-isnt"]']) });
      for (const pr of walk.problems) c.check(false, at("/patient/drive"), null, "drivable", pr);
      const sumText = (walk.out.find((x) => x.at === "summary") || {}).value || "";
      for (const line of expectedSaid(m, a)) c.check(sumText.includes(line), at("/patient/summary/said"), { line }, "quoted verbatim", sumText.slice(0, 300));
      const flagStrings = m.redFlags.flatMap((f) => [f.text, f.points, f.action]).filter(Boolean);
      const got = captureDownloads(() => { click(byTestId(p, "patient-download-txt")); click(byTestId(p, "patient-download-html")); });
      c.check(got.files.length === 2, at("/patient/exports"), null, 2, got.files.length);
      const texts = [...walk.out.map((x) => [`section/${x.at}`, x.value || ""])];
      for (const f of got.files) {
        const raw = await f.blob.text();
        const t = f.type === "text/html" ? new DOMParser().parseFromString(raw, "text/html").body.textContent : raw;
        texts.push([`export/${f.name}`, t]);
        c.check(t.includes(CAV.patient.uploaded.en), at(`/patient/export/${f.name}/provenance`), null, CAV.patient.uploaded.en, "absent");
      }
      texts.push(["caveat-strip", byTestId(C, "caveat-strip").textContent], ["print-header", head()]);
      for (const [where, t] of texts) {
        for (const re of E.policy.OMISSION_PATTERNS) { const hit = re.exec(t); c.check(!hit, at(`/patient/${where}/@pattern`), { pattern: String(re) }, "no match", hit && t.slice(Math.max(0, hit.index - 40), hit.index + 40)); }
        for (const str of flagStrings) c.check(!t.includes(str), at(`/patient/${where}/@flagText`), { text: str }, "absent", "present");
      }
      checked += 1;

      // ---------------------------------------------------------------- Research
      p = await openTab(C, "research");
      // Both sections mount on their first visit (§5.6).
      for (const seg of ["population", "readiness"]) {
        const b = byTestId(p, `research-seg-${seg}`);
        if (c.check(!!b, at(`/research/segment/${seg}`), null, "a section button", "absent")) click(b);
      }
      const pop = byTestId(p, "research-pop-message");
      c.check(!!pop && pop.textContent === NO_POPULATION, at("/research/population"), null, NO_POPULATION, pop ? pop.textContent : "absent");
      const nores = byTestId(p, "research-no-config");
      c.check(!!nores && nores.textContent === NO_RESEARCH, at("/research/noConfig"), null, NO_RESEARCH, nores ? nores.textContent : "absent");
      c.check(!p.querySelector(".rrp"), at("/research/panel"), null, "no readiness panel", "rendered");
      c.diff(E.lineage.provenanceLines(m, "clinician"), strip(), { at: at("/research/caveatStrip") });
      checked += 1;

      // ---------------------------------------------------------------- Rubric Editor
      p = await openTab(C, "editor");
      const ed = await waitFor(() => byTestId(p, "rubric-editor") || byTestId(p, "editor-unavailable"), { what: "the Rubric Editor" });
      c.check(ed.getAttribute("data-testid") === "rubric-editor", at("/editor/rendered"), null, "the Rubric Editor", visibleText(ed).slice(0, 200));
      const sel = byTestId(p, "editor-module");
      c.check(!!sel && sel.value === shapeKey, at("/editor/editing"), null, shapeKey, sel ? sel.value : "absent");
      checked += 1;

      // ---------------------------------------------------------------- ModuleInfo
      click(byTestId(C, "module-info-button"));
      const info = await waitFor(() => byTestId(C, "module-info"), { what: "ModuleInfo" });
      c.check(info.textContent.includes(NO_VOICE), at("/moduleInfo/availability"), null, NO_VOICE, info.textContent.slice(0, 300));
      c.note(`render: the fixture uploaded through the shell's dialog and walked through ${checked}/5 tabs`);
    } finally {
      shell.unmount();
      if (shapeKey) { try { registry.unregister(shapeKey); } catch (_) { /* already gone */ } }
      c.check(errors.length === 0, at("/console"), null, "no console error, window error or unhandled rejection", errors.slice(0, 10));
    }
  });
  c.check(checked === 5, at("/@tabs"), null, 5, checked);
}

// ============================================================================ placeholder half

/** Set a React-controlled text input as typing would (native setter + one input event). */
function typeInto(input, value) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  flushSync(() => { set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}

/** The answers a list of utterances captures (non-suppressed item captures, last one wins). */
function capturedAnswers(E, lexicon, utterances) {
  const a = {};
  for (const u of utterances) for (const cap of E.extraction.extract(lexicon, u, {})) if (!cap.suppressedBy && cap.kind === "item") a[cap.id] = cap.value;
  return a;
}

async function placeholderHalf(h, c, E, masque) {
  const at = (p) => `/placeholder${p}`;
  let m, validation;
  try {
    ({ module: m, validation } = await h.loadFixture("placeholder", { builtins: [masque], loaded: [masque] }));
  } catch (err) {
    c.check(false, at("/load"), null, "the placeholder fixture binds", String(err.message));
    return;
  }
  c.check(!(validation.errors || []).length, at("/validation/errors"), null, [], (validation.errors || []).map((e) => `${e.code} ${e.path} ${e.msg || ""}`));
  c.note(`placeholder: ${m.domains.length} domains, ${m.allItems.length} items, origin ${m.origin}; ${validation.warnings.length} warning(s)`);
  const av = E.lineage.availability(m);
  c.check(av.scribe.voice === true && av.scribe.probes === true, at("/availability/scribe"), null, { voice: true, probes: true }, av.scribe);

  // Activation (F5 helpers): answering p_three, even "no", activates the rule's domains.
  const act0 = E.rules.activeDomains(m, { answers: {}, complaint: "" });
  c.check(act0.error === null && [...act0.domains].join() === "first", at("/activeDomains/none"), null, "first, no error", { domains: [...act0.domains], error: act0.error });
  const act1 = E.rules.activeDomains(m, { answers: { p_three: "no" }, complaint: "" });
  c.check(act1.error === null && ["first", "second", "minus"].every((k) => act1.domains.has(k)), at("/activeDomains/isAnswered"), null, "first, second, minus; no error",
    { domains: [...act1.domains], error: act1.error });
  // Phenotypes.
  for (const [answers, want] of [[{ p_three: "yes", p_four: "yes" }, "kind_y"], [{ p_one: "yes" }, "kind_x"]]) {
    const ph = E.rules.derivePhenotype(m, answers);
    c.check(ph.error === null && ph.value === want, at("/derivePhenotype"), answers, want, ph);
  }
  // Probes.
  const list = m.logic.probes.list;
  c.diff([], E.probes.validateProbes(list, m.allItems.map((it) => it.id), m.redFlags.map((f) => f.id)), { at: at("/validateProbes") });
  c.check(E.probes.liveProbes(list, {}, {}, {}).length > 0, at("/liveProbes"), null, "> 0 live", 0);
  // Extraction.
  const SPOKEN = "I have example item one and example item three";
  const fromSpoken = capturedAnswers(E, m.lexicon, [SPOKEN]);
  c.diff({ p_one: "yes", p_three: "yes" }, fromSpoken, { at: at("/extract") });
  // Patient summary, en and es, with and without the gap marker.
  const view = E.patient.projectForPatient(m);
  for (const loc of ["en", "es"]) {
    for (const ctx of [{}, { p_ctx: "b" }]) {
      const input = { loc, ctx };
      const { summary, error } = E.patient.buildPatientSummary(view, loc, { a: { p_one: "yes", p_three: "yes", p_two: 2, p_four: "yes" }, ctx, flags: {} });
      if (!c.check(!error && !!summary, at("/buildPatientSummary"), input, "a summary", error)) continue;
      const wantGap = ctx.p_ctx === "b" ? m.logic.locales[loc].sum.gap(true) : null;
      c.check(summary.gapLine === wantGap, at("/buildPatientSummary/gapLine"), input, wantGap, summary.gapLine);
      c.check(summary.said.length === 2 && summary.ask.length === 2, at("/buildPatientSummary/rules"), input, "2 said, 2 ask", { said: summary.said, ask: summary.ask });
    }
  }

  // ---------------------------------------------------------------- through the shell
  let ScreenAIr, registry;
  try {
    [ScreenAIr, registry] = await Promise.all([importApp(h, "src/shell/ScreenAIr.jsx").then((ns) => ns.default), importApp(h, "src/shell/registry.js")]);
  } catch (err) {
    c.check(false, at("/render/compile"), null, "the shell compiles", String(err.message).split("\n")[0]);
    return;
  }
  for (const e of registry.registered()) if (e.origin !== "builtin" && e.module && e.module.id === m.id) registry.unregister(e.key);
  const rubricBytes = await h.fixture("modules/placeholder.rubric.json", "bytes");
  const logicBytes = await h.fixture("modules/placeholder.logic.js", "bytes");
  const stub = typeof window !== "undefined" ? window.__voiceStub : undefined;
  let key = null;
  await sandbox({ hash: "#tab=scribe" }, async ({ errors }) => {
    const shell = await openShell(h, ScreenAIr);
    const C = shell.container;
    try {
      choose(C.querySelector("select#sa-module"), UPLOAD_VALUE);
      const dlg = await waitFor(() => byTestId(C, "upload-dialog"), { what: "the upload dialog" });
      setFiles(byTestId(dlg, "upload-input"), [
        new File([rubricBytes], "placeholder.rubric.json", { type: "application/json" }),
        new File([logicBytes], "placeholder.logic.js", { type: "text/javascript" }),
      ]);
      const box = await waitFor(() => byTestId(C, "upload-consent-box"), { what: "the consent box for the logic file" });
      if (!box.checked) click(box);
      click(await waitFor(() => { const b = byTestId(C, "upload-validate"); return b && !b.disabled ? b : null; }, { what: "Validate to enable" }));
      const load = await waitFor(() => {
        const b = byTestId(C, "upload-load");
        if (b && !b.disabled) return b;
        return qa(C, '[data-testid="upload-result"][data-ok="false"]').length ? "refused" : null;
      }, { what: "Load to enable" });
      if (!c.check(load !== "refused", at("/upload/load"), null, "Load enabled",
        qa(C, '[data-testid="upload-error"], [data-testid="upload-errors"] li').map((x) => x.textContent).slice(0, 6))) return;
      click(load);
      await waitFor(() => C.querySelector(`main.sa-main[data-module="${CSS.escape(m.id)}"]`), { what: "the shell to switch to the uploaded placeholder" });
      const entry = registry.registered().find((e) => e.origin !== "builtin" && e.module && e.module.id === m.id);
      if (!c.check(!!entry, at("/upload/registered"), null, "a registered upload", "none")) return;
      key = entry.key;
      const um = entry.module;

      const p = await openTab(C, "scribe");
      c.check(!byTestId(p, "scribe-no-lexicon"), at("/scribe/noLexicon"), null, "no notice (the module has a lexicon)", "shown");
      c.check(!!byTestId(p, "scribe-listen"), at("/scribe/listen"), null, "Listen shown", "absent");
      const readout = () => ({
        coverage: ((byTestId(p, "scribe-readout") || {}).textContent || "").match(/coverage (\d+)%/)?.[1] ?? null,
        bars: qa(byTestId(p, "scribe-domains"), ".dbar").map((d) => `${d.querySelector(".dl").textContent} ${d.querySelector(".dpts").textContent}`),
      });
      const expected = (answers) => {
        const sc = E.scoring.computeScore(um, answers);
        return { coverage: String(sc.coverage), bars: um.domainOrder.map((k) => `${sc.domains[k].label} ${sc.domains[k].pts}/${sc.domains[k].max}`) };
      };
      const said = [];

      // Typed capture.
      const TYPED = "example item four";
      typeInto(byTestId(p, "scribe-input"), TYPED);
      click(byTestId(p, "scribe-capture"));
      said.push(TYPED);
      await waitFor(() => qa(p, ".tsc .bub").some((b) => b.textContent === TYPED), { what: "the typed statement in the transcript" });
      c.diff(expected(capturedAnswers(E, um.lexicon, said)), readout(), { at: at("/scribe/typed/readout") });

      // Microphone (voice stub + fake media under the Playwright runner only).
      if (!stub) {
        c.note("placeholder: the microphone path needs the Playwright runner (voice stub and fake media); typed capture checked only");
      } else {
        const starts0 = stub.starts;
        click(byTestId(p, "scribe-listen"));
        await waitFor(() => stub.starts > starts0 && stub.state === "started" && /Listening ·/.test((byTestId(p, "scribe-voice-state") || {}).textContent || ""),
          { what: "Listen to start the recogniser" });
        c.check(stub.lang === um.lexicon.lang, at("/scribe/voice/lang"), null, um.lexicon.lang, stub.lang);
        stub.emitFinal(SPOKEN);
        said.push(SPOKEN);
        const row = await waitFor(() => qa(p, ".tsc .row").find((r) => r.querySelector(".bub") && r.querySelector(".bub").textContent === SPOKEN), { what: "the spoken statement in the transcript" });
        const who = row.querySelector(".who");
        c.check(!!who && who.textContent === "Patient · voice", at("/scribe/voice/tag"), null, "Patient · voice", who && who.textContent);
        c.check(qa(row, ".captag").length === 2, at("/scribe/voice/captags"), null, 2, qa(row, ".captag").map((x) => x.textContent));
        await waitFor(() => readout().coverage === expected(capturedAnswers(E, um.lexicon, said)).coverage, { timeout: 3000, what: "the readout to update" }).catch(() => null);
        c.diff(expected(capturedAnswers(E, um.lexicon, said)), readout(), { at: at("/scribe/voice/readout") });
        const stop = byTestId(p, "scribe-stop");
        if (stop) click(stop);
        await waitFor(() => !stub.live, { timeout: 3000, what: "the recogniser to stop" }).catch(() => null);
        c.check(!stub.live, at("/scribe/voice/stopped"), null, "no live recogniser after Stop", stub.state);
        c.note(`placeholder: microphone capture into the uploaded module checked (${readout().bars.join("; ")}; coverage ${readout().coverage}%)`);
      }
    } finally {
      shell.unmount();
      if (stub && stub.live) { try { stub.end(); } catch (_) { /* already ended */ } }
      if (key) { try { registry.unregister(key); } catch (_) { /* already gone */ } }
      c.check(errors.length === 0, at("/render/console"), null, "no console error, window error or unhandled rejection", errors.slice(0, 10));
    }
  });
}
