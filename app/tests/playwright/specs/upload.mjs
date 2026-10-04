// tests/playwright/specs/upload.mjs — the Upload dialog, the module switch and saved modules,
// end to end on screenair.html (design 03 §8.3 `upload`, §5.1, §5.2, §3.11, §9.13 done-when 2,
// 3). Owner: WP12. Cloud runner only; the model-level cases are in tests/suites/upload.js.
//
//   dialog      opened from the picker; a spreadsheet is refused with the exact message; a .js
//               shows the consent box with its SHA-256 and API list, and nothing runs before
//               consent (the fixture's global stays unset); Cancel registers nothing
//   shape       the data-only shape JSON validates with its availability summary, loads, and
//               all five tabs render with a clean console; picker, badge, caveat strip, title
//               and print header carry the uploaded marker; the Patient tab shows the patient
//               wording of the marker, never the clinician one; no at-home link
//   markup      injected markup in an uploaded rubric renders inert
//   switch      with Screener answers and a captured row, a Scribe transcript, Patient answers
//               and a Research demo cohort, switching module lists exactly those, Cancel keeps
//               everything, Switch module resets every app
//   derived     the built-in rubric with three weights changed by hand is offered "Load as a
//               module derived from …"; the Apply dialog (prepare mode) gives a verified
//               derivation with a "-local" instrument version, loaded with the edited badge
//   saved       an edited module not remembered shows the unsaved notice; Remember clears it;
//               after a reload the restore banner restores it, re-verified
//   zip         the current module's .zip (download link in the dialog) uploads back after a
//               reload as a verified derivation whose logic binds by SHA-256 without consent

import { readFileSync } from "node:fs";

const PROTO = "Prototype · not for clinical use";
const SHEET = "Spreadsheets and documents are not supported. Download the current module's rubric (.json) and edit its weights, or use the Rubric Editor.";
const CAV_UPLOADED = "Uploaded module — not reviewed. It runs in this page exactly as written in the file.";
const CAV_UPLOADED_SHORT = "uploaded, not reviewed";
const CAV_PATIENT_UPLOADED = "This questionnaire was loaded from a file and has not been reviewed.";
const TABS = ["screener", "scribe", "patient", "research", "editor"];

export default async function upload(page, ctx) {
  const diffs = [];
  const notes = [];
  let n = 0;
  const check = (ok, path, a, b) => { n += 1; if (!ok) diffs.push({ path, input: null, a, b }); return ok; };
  const app = (p) => new URL(`app/${p}`, ctx.baseUrl).href;
  const fixtureText = async (name) => (await fetch(app(`tests/fixtures/modules/${name}`))).text();
  const fixtureBytes = async (name) => Buffer.from(await (await fetch(app(`tests/fixtures/modules/${name}`))).arrayBuffer());
  const waitFor = async (fn, arg, timeout = 8000) => { try { await page.waitForFunction(fn, arg, { timeout }); return true; } catch { return false; } };
  const active = () => page.evaluate(() => (document.querySelector(".sa-shell main") || {}).dataset?.module || null);
  const fresh = async (hash = "#tab=screener") => {
    await page.goto("about:blank");
    await page.goto(app(`screenair.html${hash}`), { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.dataset.masqueReady === "true", null, { timeout: 60000 });
    await waitFor(() => !!document.querySelector(".sa-shell main[data-module]"), null, 30000);
  };
  const openUpload = async () => {
    await page.selectOption("#sa-module", "__upload__");
    return waitFor(() => !!document.querySelector("[data-testid=upload-dialog]"));
  };
  const choose = (files) => page.setInputFiles("[data-testid=upload-input]", files.map((f) => ({ name: f.name, mimeType: f.type || "application/octet-stream", buffer: Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data) })));
  const validateAndWait = async () => {
    await page.click("[data-testid=upload-validate]");
    return waitFor(() => !!document.querySelector("[data-testid=upload-results]"), null, 20000);
  };
  const loadReady = () => waitFor(() => { const b = document.querySelector("[data-testid=upload-load]"); return !!b && !b.disabled; }, null, 20000);
  const consoleMark = () => ctx.consoleErrors.length;
  const consoleSince = (m) => ctx.consoleErrors.slice(m).filter((e) => !/status of 404/.test(e));

  // Clean state: nothing remembered from an earlier run.
  await fresh();
  await page.evaluate(() => { try { localStorage.removeItem("screenair.saved.v1"); } catch (_) {} });
  await fresh();
  const rubric = await (await fetch(app("modules/masque/masque.rubric.json"))).json();
  const builtinId = rubric.id;

  // ------------------------------------------------------------------ dialog basics
  check(await openUpload(), "/dialog/open", "upload dialog", "none");
  check(await page.evaluate(() => document.getElementById("sa-module").selectedOptions[0].value !== "__upload__"), "/dialog/picker-reset", "picker back on the active module", "Upload still selected");
  await choose([{ name: "sheet.csv", data: await fixtureBytes("upload-sheet.csv") }]);
  await waitFor(() => !!document.querySelector("[data-testid=upload-files]"));
  const sheetErr = await page.textContent("[data-testid=upload-file-error]").catch(() => "");
  check(sheetErr === SHEET, "/dialog/spreadsheet", SHEET, sheetErr);
  check(await page.isDisabled("[data-testid=upload-validate]"), "/dialog/spreadsheet/no-validate", "Validate disabled", "enabled");

  // Before consent nothing runs.
  await page.evaluate(() => { delete window.__uploadFixtureSideEffect; });
  await choose([
    { name: "shape-bound.rubric.json", data: await fixtureText("shape-bound.rubric.json") },
    { name: "side.logic.js", data: await fixtureText("upload-global-side-effect.logic.txt") },
  ]);
  await waitFor(() => !!document.querySelector("[data-testid=upload-consent]"));
  const consentText = await page.textContent("[data-testid=upload-consent]").catch(() => "");
  check(/This file contains executable code\. It will run inside this page with the same permissions as screenAIr/.test(consentText), "/consent/text", "the consent warning", consentText.slice(0, 120));
  check(/window/.test(consentText) && /localStorage/.test(consentText) && /globalThis/.test(consentText), "/consent/apis", "window, globalThis, localStorage listed", consentText);
  check(/[0-9a-f]{64}/.test(consentText), "/consent/sha256", "the full SHA-256", consentText);
  // The API list is a heuristic: the dialog says so and never claims the code reaches nothing.
  check(/heuristic/.test(consentText) && /can reach anything this page can/.test(consentText) && !/References no page or network API/.test(consentText), "/consent/heuristic", "the checks are heuristics; the code can reach anything the page can", consentText);
  {
    const kinds = await page.evaluate(() => [...document.querySelectorAll("[data-testid=upload-files] tbody tr")].map((tr) => [tr.dataset.kind, tr.lastElementChild.textContent]));
    const lg = kinds.find(([k]) => k === "logic");
    check(!!lg && /'shape'/.test(lg[1]) && /after consent/.test(lg[1]), "/dialog/logic-binding-text", "pairs with a rubric of this upload … ('shape'; checked after consent)", kinds);
  }
  check(await page.evaluate(() => window.__uploadFixtureSideEffect === undefined), "/consent/not-run", "unset", await page.evaluate(() => window.__uploadFixtureSideEffect));
  check(await page.isDisabled("[data-testid=upload-validate]"), "/consent/validate-gated", "Validate disabled until consent", "enabled");
  await page.click("[data-testid=upload-cancel]");
  check(await waitFor(() => !document.querySelector("[data-testid=upload-dialog]")), "/dialog/cancel", "closed", "open");
  check(await page.evaluate(() => !document.querySelector("#sa-module optgroup")), "/dialog/cancel/nothing-registered", "no session modules", "a module was registered");
  check(await page.evaluate(() => window.__uploadFixtureSideEffect === undefined), "/consent/cancel-not-run", "unset", "ran");

  // ------------------------------------------------------------------ shape
  let mark = consoleMark();
  await openUpload();
  await choose([{ name: "shape.rubric.json", data: await fixtureText("shape.rubric.json") }]);
  check(await validateAndWait(), "/shape/validate", "results", "none");
  const av = await page.textContent("[data-testid=upload-availability]").catch(() => "");
  check(av.includes("Ambient Scribe: no voice capture (no lexicon)") && av.startsWith("Clinician Screener ✓"), "/shape/availability", "Clinician Screener ✓ · Ambient Scribe: no voice capture (no lexicon) · …", av);
  if (check(await loadReady(), "/shape/load-enabled", "Load enabled", "disabled")) {
    await page.click("[data-testid=upload-load]");
    check(await waitFor(() => document.querySelector(".sa-shell main")?.dataset.module === "shape", null, 15000), "/shape/active", "shape", await active());
    const optText = await page.evaluate(() => [...document.querySelectorAll("#sa-module optgroup option")].map((o) => o.textContent));
    check(optText.includes("Shape fixture (example module) · uploaded"), "/shape/picker", "Shape fixture (example module) · uploaded", optText);
    check(await page.evaluate(() => document.querySelector("#sa-module optgroup")?.label) === "Loaded this session", "/shape/optgroup", "Loaded this session", "other");
    check((await page.title()) === "screenAIr · Shape fixture (example module) (uploaded)", "/shape/title", "screenAIr · Shape fixture (example module) (uploaded)", await page.title());
    const badge = await page.textContent(".sa-top [data-testid=provenance-badge]").catch(() => "");
    check(badge === "uploaded", "/shape/badge", "uploaded", badge);
    for (const t of TABS) {
      await page.click(`nav.sa-tabs [data-tab="${t}"]`);
      await page.waitForTimeout(t === "editor" ? 2500 : 500);
      const st = await page.evaluate((k) => { const el = document.getElementById(`sa-panel-${k}`); return { shown: !!el && !el.hidden, kids: el ? el.children.length : 0, text: el ? el.innerText.length : 0 }; }, t);
      check(st.shown && st.kids > 0 && st.text > 0, `/shape/tab/${t}`, "rendered", st);
      const strip = await page.textContent("#sa-caveat");
      const head = await page.textContent(".sa-print-head td");
      check(strip.includes(PROTO), `/shape/${t}/caveat`, PROTO, strip);
      if (t === "patient") {
        check(strip.includes(CAV_PATIENT_UPLOADED) && !strip.includes(CAV_UPLOADED), "/shape/patient/strip-wording", CAV_PATIENT_UPLOADED, strip);
        check(!/scor/i.test(strip + head), "/shape/patient/no-score-word", "no score word", strip + " | " + head);
        const bar = await page.textContent("[data-testid=patient-mode-bar]").catch(() => "");
        check(bar.includes("At-home use is available for built-in modules only."), "/shape/patient/no-at-home", "At-home use is available for built-in modules only.", bar);
      } else {
        check(strip.includes(CAV_UPLOADED), `/shape/${t}/strip-wording`, CAV_UPLOADED, strip);
        check(head === `${PROTO} · ${CAV_UPLOADED_SHORT}`, `/shape/${t}/print-head`, `${PROTO} · ${CAV_UPLOADED_SHORT}`, head);
      }
    }
    const scribeNotice = await page.locator(".sa-shell [data-testid=scribe-no-lexicon]").count();
    check(scribeNotice === 1, "/shape/scribe/no-lexicon", "the no-lexicon notice", scribeNotice);
    check(consoleSince(mark).length === 0, "/shape/console", "clean", consoleSince(mark).slice(0, 5));
  }

  // ------------------------------------------------------------------ markup
  await page.evaluate(() => { delete window.__injected; });
  await openUpload();
  await choose([{ name: "markup.rubric.json", data: await fixtureText("upload-markup.rubric.json") }]);
  await validateAndWait();
  if (check(await loadReady(), "/markup/load-enabled", "Load enabled", await page.textContent("[data-testid=upload-results]").catch(() => ""))) {
    await page.click("[data-testid=upload-load]");
    await page.waitForTimeout(400);
    for (const t of ["screener", "patient"]) { await page.click(`nav.sa-tabs [data-tab="${t}"]`); await page.waitForTimeout(400); }
    await page.click("[data-testid=module-info-button]");
    await page.waitForTimeout(200);
    const inert = await page.evaluate(() => ({ injected: window.__injected, imgs: document.querySelectorAll('.sa-shell img[src="x"], .sa-shell img[onerror]').length }));
    check(inert.injected === undefined && inert.imgs === 0, "/markup/inert", { injected: undefined, imgs: 0 }, inert);
    await page.keyboard.press("Escape");
  }

  // ------------------------------------------------------------------ switch with dirty state
  {
    await fresh();
    // Load the shape fixture again (a reload forgets uploads), then go back to the built-in.
    await openUpload();
    await choose([{ name: "shape.rubric.json", data: await fixtureText("shape.rubric.json") }]);
    await validateAndWait();
    await loadReady();
    await page.click("[data-testid=upload-load]");
    await waitFor(() => document.querySelector(".sa-shell main")?.dataset.module === "shape");
    await page.selectOption("#sa-module", `builtin:${builtinId}`);
    await waitFor((id) => document.querySelector(".sa-shell main")?.dataset.module === id, builtinId);
    // Screener: a sample case and a captured row.
    await page.click('nav.sa-tabs [data-tab="screener"]');
    await page.click(".sa-shell [data-testid=scr-banner] button");
    await page.waitForTimeout(200);
    const appended = await page.evaluate(() => {
      const b = [...document.querySelectorAll(".sa-shell .sa-screener button")].find((x) => /Append this screen/.test(x.textContent));
      if (!b) return false;
      b.click();
      return true;
    });
    // Scribe: one typed line.
    await page.click('nav.sa-tabs [data-tab="scribe"]');
    await page.fill(".sa-shell [data-testid=scribe-input]", "Example line typed by the test");
    await page.click(".sa-shell [data-testid=scribe-capture]");
    // Patient: past the intro, one safety answer.
    await page.click('nav.sa-tabs [data-tab="patient"]');
    await page.click(".sa-shell [data-testid=patient-next]").catch(() => {});
    await page.click(".sa-shell [data-testid=patient-none-apply]").catch(() => {});
    // Research: a demo cohort in the panel.
    await page.click('nav.sa-tabs [data-tab="research"]');
    await page.evaluate(() => { const b = [...document.querySelectorAll(".sa-shell [data-testid=research-tab] button")].find((x) => /Research readiness/.test(x.textContent)); if (b) b.click(); });
    await page.waitForTimeout(400);
    const demo = await page.evaluate(() => {
      const sel = document.querySelector(".sa-shell [data-testid=rrp-demo-cohort]");
      if (!sel) {
        const dataTab = [...document.querySelectorAll(".sa-shell [data-testid=research-tab] button, .sa-shell [data-testid=research-tab] [role=tab]")].find((x) => /^\s*Data( ingestion)?\s*$/.test(x.textContent));
        if (dataTab) dataTab.click();
        return "clicked data tab";
      }
      return "present";
    });
    if (demo !== "present") await page.waitForTimeout(300);
    const opts = await page.evaluate(() => [...(document.querySelector(".sa-shell [data-testid=rrp-demo-cohort]")?.options || [])].map((o) => o.value).filter(Boolean));
    if (opts.length) await page.selectOption(".sa-shell [data-testid=rrp-demo-cohort]", opts[0]);
    await page.waitForTimeout(300);
    // A live microphone in the Scribe (the voice stub stands in for the recogniser).
    await page.click('nav.sa-tabs [data-tab="scribe"]');
    await page.click(".sa-shell [data-testid=scribe-listen]").catch(() => {});
    const listening = await waitFor(() => window.__voiceStub && window.__voiceStub.live === true, null, 5000);
    check(listening, "/switch/mic/started", "a live capture before the switch", await page.evaluate(() => window.__voiceStub && window.__voiceStub.state));
    await page.click('nav.sa-tabs [data-tab="research"]');
    // Switch.
    await page.selectOption("#sa-module", "upload:shape");
    const dlg = await waitFor(() => !!document.querySelector("[data-testid=switch-dialog]"));
    if (check(dlg, "/switch/dialog", "confirmation", "switched without asking")) {
      const lines = await page.evaluate(() => [...document.querySelectorAll("[data-testid=switch-dialog] [data-testid=confirm-lines] li")].map((li) => li.textContent));
      const body = await page.textContent("[data-testid=switch-dialog]");
      check(lines.some((l) => /^Clinician Screener — .*\d+ answers?/.test(l)), "/switch/lines/screener-answers", "Clinician Screener — n answers…", lines);
      check(!appended || lines.some((l) => /^Clinician Screener — .*1 captured row/.test(l)), "/switch/lines/screener-rows", "… 1 captured row", lines);
      check(lines.some((l) => /^Ambient Scribe — .*transcript/.test(l)), "/switch/lines/scribe", "Ambient Scribe — transcript …", lines);
      check(lines.some((l) => /^Patient Companion — answers in progress$/.test(l)), "/switch/lines/patient", "Patient Companion — answers in progress", lines);
      check(opts.length > 0, "/switch/research/demo-offered", "Load demo cohort offered for the built-in", "no demo cohort select");
      check(lines.some((l) => /^Research — /.test(l)), "/switch/lines/research", "Research — demo cohort loaded / uploaded rows", lines);
      check(body.includes("Rubric Editor drafts are kept.") && body.includes("Export captured rows from the Screener or Scribe first if you need them."), "/switch/notes", "both notes", body);
      notes.push(`switch dialog lines: ${lines.join(" | ")}`);
      await page.click("[data-testid=confirm-cancel]");
      await page.waitForTimeout(200);
      check(await active() === builtinId, "/switch/cancel/kept-module", builtinId, await active());
      check(await page.evaluate(() => /Example line typed by the test/.test((document.querySelector(".sa-shell [data-testid=scribe-transcript]") || document.querySelector(".sa-shell .sa-scribe") || {}).textContent || "")), "/switch/cancel/kept-state", "transcript kept", "lost");
      await page.selectOption("#sa-module", "upload:shape");
      await waitFor(() => !!document.querySelector("[data-testid=switch-dialog]"));
      await page.click("[data-testid=confirm-ok]");
      check(await waitFor(() => document.querySelector(".sa-shell main")?.dataset.module === "shape"), "/switch/ok", "shape", await active());
      check(await waitFor(() => !window.__voiceStub.live, null, 5000), "/switch/mic/stopped", "no live capture after a module switch", await page.evaluate(() => window.__voiceStub.state));
      check(await page.locator("#sa-mic").count() === 0, "/switch/mic/indicator-gone", "no indicator", "shown");
      check(await page.evaluate(() => document.querySelector('nav.sa-tabs [aria-selected="true"]').dataset.tab) === "research", "/switch/tab-kept", "research", "other");
      await page.selectOption("#sa-module", `builtin:${builtinId}`);
      await waitFor((id) => document.querySelector(".sa-shell main")?.dataset.module === id, builtinId);
      const reset = await page.evaluate(() => ({
        scribe: /Example line typed by the test/.test((document.querySelector(".sa-shell .sa-scribe") || {}).textContent || ""),
        dialog: !!document.querySelector("[data-testid=switch-dialog]"),
      }));
      check(!reset.scribe && !reset.dialog, "/switch/reset", "every app fresh after the switch", reset);
      // Every app reports a clean state after the remount, so the next switch asks nothing.
      await page.selectOption("#sa-module", "upload:shape");
      await page.waitForTimeout(300);
      check(await page.locator("[data-testid=switch-dialog]").count() === 0 && await active() === "shape", "/switch/reset/clean", "switch without a confirmation", await page.evaluate(() => [...document.querySelectorAll("[data-testid=confirm-lines] li")].map((x) => x.textContent)));
      if (await page.locator("[data-testid=switch-dialog]").count()) await page.click("[data-testid=confirm-cancel]");
      await page.selectOption("#sa-module", `builtin:${builtinId}`);
      await waitFor((id) => document.querySelector(".sa-shell main")?.dataset.module === id, builtinId);
    }
  }

  // ------------------------------------------------------------------ Load as derived
  let derivedId = null;
  {
    const edited = JSON.parse(JSON.stringify(rubric));
    const d = edited.domains.find((x) => !x.negative && x.items.length >= 3 && x.items.every((it) => Math.abs(it.w) >= 3));
    d.items[0].w += 1; d.items[1].w += 1; d.items[2].w -= 2;
    await openUpload();
    await choose([{ name: `${builtinId}.rubric.json`, data: JSON.stringify(edited, null, 2) + "\n" }]);
    await validateAndWait();
    const offer = await page.textContent("[data-testid=load-as-derived]").catch(() => "");
    check(offer === `Load as a module derived from ${rubric.label}`, "/derived/offer", `Load as a module derived from ${rubric.label}`, offer);
    const reason = await page.textContent("[data-testid=upload-result] [data-testid=upload-error]").catch(() => "");
    check(reason.startsWith(`Module id '${builtinId}' is reserved for the built-in module`), "/derived/reason", "Module id … is reserved for the built-in module", reason);
    if (offer) {
      await page.click("[data-testid=load-as-derived]");
      const applyShown = await waitFor(() => !!document.querySelector("[data-testid=apply-dialog]") || !!document.querySelector("[data-testid=derive-form]"), null, 20000);
      if (check(applyShown, "/derived/apply-dialog", "the Apply dialog (prepare mode)", "none")) {
        const isApply = await page.locator("[data-testid=apply-dialog]").count() > 0;
        notes.push(isApply ? "Load as derived: the Rubric Editor's ApplyDialog (prepare mode)" : "Load as derived: the upload dialog's own form (ApplyDialog not available)");
        await page.waitForTimeout(800);
        if (isApply) {
          const iv = await page.inputValue("[data-apply=instrumentVersion]");
          check(/-local/.test(iv), "/derived/instrument-local", "-local tag", iv);
          await page.fill("[data-apply=note]", "Three weights changed by hand (upload spec).");
          for (const box of await page.locator("[data-apply-ack]").all()) await box.check();
          await waitFor(() => { const b = document.querySelector("[data-apply-action=prepare]"); return !!b && !b.disabled; }, null, 15000);
          await page.click("[data-apply-action=prepare]");
        } else {
          const iv = await page.inputValue("[data-testid=derive-instrument]");
          check(/-local/.test(iv), "/derived/instrument-local", "-local tag", iv);
          await page.fill("[data-testid=derive-note]", "Three weights changed by hand (upload spec).");
          await page.click("[data-testid=derive-prepare]");
        }
        const prepared = await loadReady();
        if (check(prepared, "/derived/prepared", "a validated derived module", await page.textContent("[data-testid=upload-results]").catch(() => ""))) {
          await page.click("[data-testid=upload-load]");
          await waitFor(() => (document.querySelector(".sa-shell main")?.dataset.module || "").startsWith("local-"), null, 15000);
          derivedId = await active();
          const badge = await page.textContent(".sa-top [data-testid=provenance-badge]").catch(() => "");
          check(badge === "edited · scoring changed", "/derived/badge", "edited · scoring changed", badge);
          const footer = await page.textContent("#sa-footer");
          check(/instrument \S*-local/.test(footer), "/derived/footer-version", "instrument …-local…", footer);
          check(await page.locator("[data-testid=unsaved-notice]").count() === 1, "/saved/unsaved-notice", "shown", "absent");
          // Removing an edited module that exists only in this tab is confirmed (it cannot come back).
          await page.click("[data-testid=module-info-button]");
          await page.click("[data-testid=module-info] button:has-text('Remove from this session')");
          const rm = await waitFor(() => !!document.querySelector("[data-testid=remove-dialog]"));
          if (check(rm, "/remove/unsaved/confirm", "a confirmation before discarding the only copy", "removed at once")) {
            const txt = await page.textContent("[data-testid=remove-dialog]");
            check(/exists only in this tab/.test(txt) && /Rubric Editor draft/.test(txt), "/remove/unsaved/text", "only in this tab … its Rubric Editor draft", txt);
            check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.testid) === "confirm-cancel", "/remove/unsaved/focus", "Cancel focused", await page.evaluate(() => document.activeElement && document.activeElement.dataset.testid));
            await page.click("[data-testid=remove-dialog] [data-testid=confirm-cancel]");
            await page.waitForTimeout(200);
            check(await active() === derivedId, "/remove/unsaved/cancel-keeps", derivedId, await active());
          }
          await page.keyboard.press("Escape");
          await waitFor(() => !document.querySelector("[data-testid=module-info]"));
        }
      }
    }
  }

  // ------------------------------------------------------------------ zip of the current module, re-uploaded after a reload
  if (derivedId) {
    await openUpload();
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 20000 }).catch(() => null),
      page.click("[data-testid=upload-download-current]"),
    ]);
    if (check(!!dl, "/zip/download", `${derivedId}.zip`, "no download")) {
      check(dl.suggestedFilename() === `${derivedId}.zip`, "/zip/name", `${derivedId}.zip`, dl.suggestedFilename());
      const zipBytes = readFileSync(await dl.path());
      await page.click("[data-testid=upload-cancel]");
      check(await page.locator("[data-testid=unsaved-notice]").count() === 0, "/saved/unsaved-cleared-by-download", "notice gone after the download", "still shown");
      // Remember it, then reload: the restore banner brings it back, re-verified.
      await page.click("[data-testid=module-info-button]");
      await page.click("[data-testid=module-info] button:has-text('Remember in this browser')").catch(() => {});
      await page.keyboard.press("Escape");
      await fresh();
      const banner = await page.textContent("[data-testid=restore-banner]").catch(() => "");
      check(/^1 module saved in this browser/.test(banner), "/saved/banner", "1 module saved in this browser", banner);
      // Upload the zip before restoring: the derivation verifies, its logic binds by SHA-256.
      await openUpload();
      await choose([{ name: `${derivedId}.zip`, data: zipBytes }]);
      await waitFor(() => !!document.querySelector("[data-testid=upload-files]"));
      check(await page.locator("[data-testid=upload-consent]").count() === 0, "/zip/no-consent", "no consent needed (built-in logic by SHA-256)", "consent box");
      const kinds = await page.evaluate(() => [...document.querySelectorAll("[data-testid=upload-kind]")].map((x) => x.textContent));
      check(kinds.includes("built-in logic (not run)"), "/zip/builtin-logic", "built-in logic (not run)", kinds);
      await validateAndWait();
      if (check(await loadReady(), "/zip/load-enabled", "Load enabled", await page.textContent("[data-testid=upload-results]").catch(() => ""))) {
        await page.click("[data-testid=upload-load]");
        await waitFor((id) => document.querySelector(".sa-shell main")?.dataset.module === id, derivedId, 15000);
        check(await active() === derivedId, "/zip/active", derivedId, await active());
        const badge = await page.textContent(".sa-top [data-testid=provenance-badge]").catch(() => "");
        check(badge === "edited · scoring changed", "/zip/badge", "edited · scoring changed", badge);
      }
      // The banner no longer offers a module that is loaded.
      check(await page.locator("[data-testid=restore-banner]").count() === 0, "/saved/banner-hidden-when-loaded", "hidden", "shown");
      // Restore path on a fresh page.
      await fresh();
      if (await page.locator("[data-testid=restore-saved]").count()) {
        await page.click("[data-testid=restore-saved]");
        await page.waitForTimeout(800);
        const optText = await page.evaluate(() => [...document.querySelectorAll("#sa-module optgroup option")].map((o) => o.value));
        check(optText.includes(`derived:${derivedId}`), "/saved/restore", `derived:${derivedId}`, optText);
        check(await active() === builtinId, "/saved/not-auto-activated", builtinId, await active());
      } else {
        check(false, "/saved/restore", "a Restore button", "none");
      }
    }
  }
  await page.evaluate(() => { try { localStorage.removeItem("screenair.saved.v1"); } catch (_) {} });

  // ------------------------------------------------------------------ a saved module whose logic is not loaded
  // Its restore fails until the logic is uploaded again: the banner says what is needed and
  // stays after the failed Restore, instead of disappearing for good.
  {
    await fresh();
    await openUpload();
    await choose([
      { name: "shape-bound.rubric.json", data: await fixtureText("shape-bound.rubric.json") },
      { name: "shape.logic.js", data: await fixtureText("shape.logic.js") },
    ]);
    await waitFor(() => !!document.querySelector("[data-testid=upload-consent]"));
    await page.check("[data-testid=upload-consent-box]");
    await validateAndWait();
    if (check(await loadReady(), "/saved-logic/load", "Load enabled", await page.textContent("[data-testid=upload-results]").catch(() => ""))) {
      await page.click("[data-testid=upload-load]");
      await waitFor(() => document.querySelector(".sa-shell main")?.dataset.module === "shape", null, 15000);
      await page.click("[data-testid=module-info-button]");
      const about = await page.textContent("[data-testid=module-info]");
      check(/uploaded as/.test(about) && /shape-bound\.rubric\.json/.test(about), "/saved-logic/uploaded-as", "uploaded as shape-bound.rubric.json, shape.logic.js", about.slice(0, 300));
      await page.click("[data-testid=module-info] button:has-text('Remember in this browser')").catch(() => {});
      await page.keyboard.press("Escape");
      await fresh();
      const needs = await page.textContent("[data-testid=restore-needs]").catch(() => "");
      check(/needs logic file `shape\.logic\.js`/.test(needs), "/saved-logic/banner-needs", "names the logic file it needs", needs);
      await page.click("[data-testid=restore-saved]");
      await page.waitForTimeout(600);
      check(await page.locator("[data-testid=restore-banner]").count() === 1, "/saved-logic/banner-kept", "the banner stays while a restore failed", "hidden");
      const toast = await page.textContent("[data-testid=toast]").catch(() => "");
      check(/not restored/.test(toast) && /shape\.logic\.js/.test(toast), "/saved-logic/toast", "not restored — … needs logic file `shape.logic.js` …", toast);
    }
    await page.evaluate(() => { try { localStorage.removeItem("screenair.saved.v1"); } catch (_) {} });
  }

  notes.unshift(`${n} checks`);
  return { verdict: diffs.length ? "fail" : "pass", n, diffs, expectedMissing: [], notes };
}
