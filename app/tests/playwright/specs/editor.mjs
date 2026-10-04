// tests/playwright/specs/editor.mjs — the Rubric Editor end to end (design 03 §8.3 `editor` UI
// half, §5.7, §5.8, §9.12). Owner: WP11. Cloud runner only.
//
// dev      tests/dev/editor.html (the editor with a local registry, fixed clock, published
//          screens): page health; locked fields read-only; Apply disabled without changes, with
//          an error (V15) and with an unacknowledged edit the logic reads; "set max = Σw";
//          Revert and Revert all; the current-screen impact rows; the last cue phrase of a flag
//          cannot be removed; a built-in label refused in the Apply dialog; Create module keeps
//          the active module and the screens; editing a non-active module; Create and switch
//          goes through the switch confirmation; Download all twice with a fixed clock gives
//          byte-equal zips that pass `unzip -t`; no horizontal scroll at 375 px.
//          Modal keyboard handling of the editor's Confirm and Apply dialogs (initial focus, Tab
//          trap, inert background, Escape, focus returned); the Apply dialog's calibration notice
//          for a parent with research; the availability line in the shell's wording; the logic
//          and impact scroll boxes keyboard-focusable and labelled; a saved draft's time shown in
//          local time (Chromium timezone override).
// shape    tests/dev/editor.html?fixture=shape-bare: Create lexicon and Create English patient
//          wording from the UI; the created negation.window is not marked "edited"; a scoring
//          change on a parent without research shows no calibration notice.
// shell    screenair.html: the Rubric Editor tab of the real shell (WP12): Create and switch
//          through the shell's confirmation (which lists the dirty Screener), the remembered
//          module restored after a reload, and Download all from the shell passing `unzip -t`.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const NOW = "2026-10-01T12:00:00.000Z";

export default async function editor(page, ctx) {
  const diffs = [];
  const notes = [];
  let n = 0;
  const check = (ok, p, a, b) => { n += 1; if (!ok) diffs.push({ path: p, input: null, a, b }); return ok; };
  const out = path.join(ctx.artifactsDir, "editor");
  mkdirSync(out, { recursive: true });
  const url = (q) => new URL(`app/tests/dev/editor.html${q}`, ctx.baseUrl).href;
  const ready = async (p, u) => {
    await p.goto(u, { waitUntil: "load" });
    await p.waitForFunction(() => document.documentElement.dataset.masqueReady === "true", null, { timeout: 60000 });
  };
  const devReady = async (p) => {
    await p.waitForFunction(() => window.__editorDev && (window.__editorDev.ready || window.__editorDev.error), null, { timeout: 60000 });
    const err = await p.evaluate(() => window.__editorDev.error);
    if (err) throw new Error(`dev page: ${err}`);
    await p.waitForSelector("[data-testid=rubric-editor]", { timeout: 30000 });
  };
  const applyDisabled = (p) => p.locator("[data-testid=editor-apply]").isDisabled();
  const settle = async (p) => {
    await p.waitForTimeout(400);
    await p.waitForFunction(() => !/checking/i.test(document.querySelector("[data-testid=editor-validation]")?.textContent || ""), null, { timeout: 20000 });
    await p.waitForTimeout(150);
  };
  const errorCodes = (p) => p.$$eval("[data-testid=validation-errors] li", (xs) => xs.map((x) => x.dataset.code));
  const warningCodes = (p) => p.$$eval("[data-testid=validation-warnings] li", (xs) => xs.map((x) => x.dataset.code));
  const unzipT = (file) => {
    try { return { ok: true, text: execFileSync("unzip", ["-t", file], { encoding: "utf8" }) }; }
    catch (err) { return { ok: false, text: String(err.stdout || err.message) }; }
  };

  // ======================================================================== dev page
  await ready(page, url(`?now=${NOW}&screens=1`));
  await devReady(page);
  check(ctx.consoleErrors.length === 0, "/dev/console", "clean", ctx.consoleErrors.slice(0, 5));
  const caveat = await page.evaluate(() => document.body.textContent.includes("Prototype · not for clinical use"));
  check(caveat, "/dev/caveat", "caveat on the page", caveat);
  const activeKey = await page.evaluate(() => window.__editorDev.activeKey);

  // Locked fields.
  for (const p of ["/id", "/instrumentVersion", "/lexicon/version"]) {
    const ro = await page.locator(`[data-path="${p}"]`).getAttribute("readonly");
    check(ro !== null, `/dev/locked${p}`, "readonly", ro);
  }
  check(await applyDisabled(page), "/dev/apply/no-changes", "disabled", "enabled");

  // Weight edit → V15; set max = Σw → no error, V17; Apply enabled.
  await page.click("[data-section-nav=domains]");
  const wPath = "/domains/0/items/0/w";
  const w0 = await page.locator(`[data-path="${wPath}"]`).inputValue();
  await page.locator(`[data-path="${wPath}"]`).fill(String(Number(w0) + 1));
  await settle(page);
  check((await errorCodes(page)).includes("V15"), "/dev/weight/V15", "V15", await errorCodes(page));
  check(await applyDisabled(page), "/dev/weight/apply-disabled", "disabled", "enabled");
  await page.click("[data-set-max='0']");
  await settle(page);
  check(!(await errorCodes(page)).length, "/dev/setmax/no-errors", [], await errorCodes(page));
  check((await warningCodes(page)).includes("V17"), "/dev/setmax/V17", "V17 warning", await warningCodes(page));
  check(!(await applyDisabled(page)), "/dev/setmax/apply-enabled", "enabled", "disabled");
  // Current-screen impact rows (the edited module is the active one).
  const cur = await page.$$eval("[data-impact-case^='__screen_']", (xs) => xs.map((x) => x.dataset.impactCase));
  check(cur.includes("__screen_screener") && cur.includes("__screen_scribe"), "/dev/impact/current-rows", ["__screen_screener", "__screen_scribe"], cur);
  // Revert one field, then Revert all.
  await page.click(`[data-revert="${wPath}"]`);
  await settle(page);
  check((await page.locator(`[data-path="${wPath}"]`).inputValue()) === w0, "/dev/revert/field", w0, await page.locator(`[data-path="${wPath}"]`).inputValue());
  await page.click("[data-revert-all]");
  await settle(page);
  check((await page.locator("[data-testid=editor-status]").innerText()).startsWith("0 changes") && await applyDisabled(page), "/dev/revert-all", "0 changes, Apply disabled", await page.locator("[data-testid=editor-status]").innerText());

  // Wording the logic reads: m_dur option 2 needs the acknowledgement.
  const scalePath = await page.evaluate(() => {
    const e = window.__editorDev.entries().find((x) => x.key === window.__editorDev.activeKey);
    const r = e.module.rubric;
    for (let di = 0; di < r.domains.length; di++) for (let ii = 0; ii < r.domains[di].items.length; ii++) {
      if (r.domains[di].items[ii].id === "m_dur") return `/domains/${di}/items/${ii}/scale/2/label`;
    }
    return null;
  });
  if (check(!!scalePath, "/dev/ack/item", "m_dur in the built-in", null)) {
    const f = page.locator(`[data-path="${scalePath}"]`);
    await f.fill((await f.inputValue()) + " (edited)");
    await settle(page);
    check(await applyDisabled(page), "/dev/ack/blocks", "disabled until acknowledged", "enabled");
    const box = await page.locator(`[data-ack="${scalePath}"]`).innerText();
    check(/Read by:/.test(box) && /summary\./.test(box), "/dev/ack/read-by", "Read by: summary rules", box.slice(0, 200));
    check(/en: /.test(box), "/dev/ack/sentence", "the patient sentence the rule produces", box.slice(0, 300));
    await page.locator(`[data-ack-check="${scalePath}"]`).check();
    await settle(page);
    check(!(await applyDisabled(page)), "/dev/ack/unblocks", "enabled", "disabled");
    await page.click("[data-revert-all]");
    await settle(page);
  }

  // The last cue phrase of a red flag cannot be removed.
  await page.click("[data-section-nav=lexicon]");
  const listPath = await page.evaluate(() => {
    const el = document.querySelector("[data-remove-phrase^='/lexicon/redFlags/']");
    return el ? el.dataset.removePhrase.replace(/\/\d+$/, "") : null;
  });
  if (check(!!listPath, "/dev/lexicon/list", "a red-flag cue list", null)) {
    for (let guard = 0; guard < 50; guard++) {
      const btns = page.locator(`[data-remove-phrase^="${listPath}/"]`);
      const count = await btns.count();
      if (count <= 1) break;
      await btns.first().click();
    }
    const last = page.locator(`[data-remove-phrase^="${listPath}/"]`);
    check((await last.count()) === 1 && await last.first().isDisabled(), "/dev/lexicon/last-phrase", "one phrase left, its remove button disabled", await last.count());
    const hint = await page.locator(`[data-path="${listPath}"]`).innerText();
    check(/Every red flag needs at least one cue phrase/.test(hint), "/dev/lexicon/last-phrase-message", "the V28 message", hint.slice(0, 200));
    await page.click("[data-revert-all]");
    await settle(page);
  }

  // The editor's Confirm dialog: modal keyboard handling (a red-flag tier change, then Escape).
  await page.click("[data-section-nav=flags]");
  {
    const sel = page.locator('[data-path="/redFlags/0/tier"]');
    if (check(await sel.count() === 1, "/dev/confirm/tier-select", "the first red flag's tier select", 0)) {
      const tier0 = await sel.inputValue();
      await sel.focus();
      await sel.selectOption(tier0 === "emergent" ? "urgent" : "emergent");
      await page.waitForSelector("[data-testid=editor-confirm]", { timeout: 10000 });
      await page.waitForTimeout(100);
      const st = () => page.evaluate(() => {
        const a = document.activeElement;
        const box = document.querySelector("[data-testid=editor-confirm]");
        return { inside: !!(box && a && box.contains(a)), which: a ? (a.dataset.confirm || a.tagName) : null, inert: !!document.querySelector("[data-testid=editor-main]")?.closest("[inert]") };
      });
      const s0 = await st();
      check(s0.inside && s0.which === "cancel", "/dev/confirm/initial-focus", "Cancel focused", s0);
      check(s0.inert, "/dev/confirm/inert", "background inert", s0);
      for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
      check((await st()).inside, "/dev/confirm/tab-trap", "focus stays in the dialog", await st());
      await page.keyboard.press("Shift+Tab");
      check((await st()).inside, "/dev/confirm/shift-tab-trap", "focus stays in the dialog", await st());
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      const s1 = await page.evaluate(() => ({ open: !!document.querySelector("[data-testid=editor-confirm]"), focus: document.activeElement && document.activeElement.dataset.path, inert: !!document.querySelector("[data-testid=editor-main]")?.closest("[inert]") }));
      check(!s1.open && !s1.inert, "/dev/confirm/escape", "closed, background live", s1);
      check(s1.focus === "/redFlags/0/tier", "/dev/confirm/focus-return", "/redFlags/0/tier", s1.focus);
      check((await page.locator("[data-testid=editor-status]").innerText()).startsWith("0 changes") && await sel.inputValue() === tier0, "/dev/confirm/escape-cancels", `0 changes, tier ${tier0}`, [await page.locator("[data-testid=editor-status]").innerText(), await sel.inputValue()]);
    }
  }

  // Apply: a built-in label is refused; Create module keeps the active module and the screens.
  await page.click("[data-section-nav=domains]");
  await page.locator(`[data-path="${wPath}"]`).fill(String(Number(w0) + 1));
  await page.click("[data-set-max='0']");
  await settle(page);
  await page.click("[data-testid=editor-apply]");
  await page.waitForSelector("[data-testid=apply-dialog] [data-apply=label]", { timeout: 20000 });
  // Modal keyboard handling of the Apply dialog, then Escape and open it again.
  {
    await page.waitForTimeout(150);
    const st = () => page.evaluate(() => {
      const a = document.activeElement;
      const box = document.querySelector("[data-testid=apply-dialog]");
      return { inside: !!(box && a && box.contains(a)), which: a ? (a.dataset.apply || a.dataset.applyAction || a.tagName) : null, inert: !!document.querySelector("[data-testid=editor-main]")?.closest("[inert]") };
    });
    const s0 = await st();
    check(s0.inside && s0.which === "id", "/dev/apply/initial-focus", "the module id field", s0);
    check(s0.inert, "/dev/apply/inert", "background inert", s0);
    for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
    check((await st()).inside, "/dev/apply/tab-trap", "focus stays in the dialog", await st());
    check(await page.locator("[data-testid=apply-dialog] [data-notice=scoring]").count() === 1, "/dev/apply/calibration-notice", "shown (the parent has research)", 0);
    const av = await page.locator("[data-testid=apply-availability]").innerText().catch(() => "");
    check(/^Clinician Screener ✓ · /.test(av) && /Research(: | ✓ \(population estimates and readiness\))/.test(av), "/dev/apply/availability-wording", "the shell's availability wording", av);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const s1 = await page.evaluate(() => ({ open: !!document.querySelector("[data-testid=apply-dialog]"), focus: document.activeElement && document.activeElement.dataset.testid, inert: !!document.querySelector("[data-testid=editor-main]")?.closest("[inert]") }));
    check(!s1.open && !s1.inert && s1.focus === "editor-apply", "/dev/apply/escape", "closed, focus back on Apply", s1);
    await page.click("[data-testid=editor-apply]");
    await page.waitForSelector("[data-testid=apply-dialog] [data-apply=label]", { timeout: 20000 });
  }
  const builtinLabel = await page.evaluate(() => window.__editorDev.entries()[0].module.label);
  await page.fill("[data-apply=label]", builtinLabel);
  await page.fill("[data-apply=note]", "editor spec: one weight up");
  await page.waitForTimeout(900);
  const refused = await page.locator("[data-testid=apply-dialog] .re-msg").allInnerTexts();
  check(refused.some((t) => /belongs to a built-in module/.test(t)) && await page.locator("[data-apply-action=create]").isDisabled(), "/dev/apply/builtin-label", "refused", refused);
  await page.fill("[data-apply=label]", "Editor spec module");
  await page.waitForFunction(() => { const b = document.querySelector("[data-apply-action=create]"); return b && !b.disabled; }, null, { timeout: 20000 });
  check(await page.locator("[data-apply=remember]").isChecked(), "/dev/apply/remember-default", "checked", "unchecked");
  const iv = await page.locator("[data-apply=instrumentVersion]").inputValue();
  check(/-local\./.test(iv), "/dev/apply/version", "-local", iv);
  await page.click("[data-apply-action=create]");
  await page.waitForSelector("[data-testid=editor-result]", { timeout: 20000 });
  const st1 = await page.evaluate(() => ({ active: window.__editorDev.activeKey, resets: window.__editorDev.screenResets, keys: window.__editorDev.keys(), applied: window.__editorDev.applied }));
  check(st1.active === activeKey && st1.resets === 0, "/dev/create/keeps-active", { active: activeKey, resets: 0 }, st1);
  check(/Choose it from the Module menu/.test(await page.locator("[data-testid=editor-result]").innerText()), "/dev/create/result", "Created … Choose it from the Module menu", await page.locator("[data-testid=editor-result]").innerText());
  const screens = await page.locator("[data-testid=dev-screens]").innerText();
  check(screens.includes("screener") && screens.includes("scribe"), "/dev/create/screens-untouched", "screens: screener, scribe", screens);
  const newKey = st1.keys.find((k) => k.startsWith("derived:"));
  check(!!newKey && st1.applied[0] && st1.applied[0].kind === "verified" && st1.applied[0].remember === true, "/dev/create/registered", "a verified derived entry", st1.applied);

  // Editing a non-active module.
  if (newKey) {
    await page.selectOption("[data-testid=editor-module]", newKey);
    await page.click("[data-section-nav=identity]");
    const lab = page.locator('[data-path="/label"]');
    await lab.fill((await lab.inputValue()) + " · second edit");
    await settle(page);
    const st2 = await page.evaluate(() => ({ active: window.__editorDev.activeKey, resets: window.__editorDev.screenResets }));
    check(st2.active === activeKey && st2.resets === 0, "/dev/non-active/untouched", { active: activeKey }, st2);
    check(!(await page.$("[data-impact-case^='__screen_']")), "/dev/non-active/no-current-rows", "no current-screen rows", "present");
    // Create and switch → the switch confirmation.
    await page.click("[data-testid=editor-apply]");
    await page.waitForSelector("[data-testid=apply-dialog] [data-apply=note]", { timeout: 20000 });
    await page.fill("[data-apply=note]", "editor spec: label only");
    await page.waitForFunction(() => { const b = document.querySelector("[data-apply-action=create-switch]"); return b && !b.disabled; }, null, { timeout: 20000 });
    check(!!(await page.$("[data-testid=iv-locked]")), "/dev/switch/version-locked", "instrument version locked (wording only)", "editable");
    await page.click("[data-apply-action=create-switch]");
    await page.waitForSelector("[data-testid=dev-switch-confirm]", { timeout: 20000 });
    const confirmText = await page.locator("[data-testid=dev-switch-confirm]").innerText();
    check(/clears/.test(confirmText), "/dev/switch/confirmation", "lists what switching clears", confirmText.slice(0, 200));
    await page.click("[data-dev-switch=ok]");
    const st3 = await page.evaluate(() => ({ active: window.__editorDev.activeKey, resets: window.__editorDev.screenResets, keys: window.__editorDev.keys() }));
    check(st3.active !== activeKey && st3.active !== newKey && st3.resets === 1, "/dev/switch/switched", "the new module is active", st3);
  }

  // Download all twice with the fixed clock: byte-equal, unzip -t.
  await page.click("[data-section-nav=downloads]");
  const zips = [];
  for (let i = 0; i < 2; i++) {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click("[data-download=all]")]);
    const file = path.join(out, `download-all-${i}.zip`);
    await dl.saveAs(file);
    zips.push(file);
    check(dl.suggestedFilename() === `screenair-modules-${NOW.slice(0, 10)}.zip`, `/dev/download/name/${i}`, `screenair-modules-${NOW.slice(0, 10)}.zip`, dl.suggestedFilename());
  }
  const b0 = readFileSync(zips[0]), b1 = readFileSync(zips[1]);
  check(b0.equals(b1), "/dev/download/byte-equal", "identical bytes", `${b0.length} vs ${b1.length}`);
  const t = unzipT(zips[0]);
  check(t.ok && /No errors detected/.test(t.text), "/dev/download/unzip-t", "No errors detected", t.text.split("\n").slice(-3).join(" "));
  notes.push(`download-all zip: ${b0.length} bytes, ${(t.text.match(/testing:/g) || []).length} entries`);
  const [dlm] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click("[data-download=module]")]);
  const fm = path.join(out, "download-module.zip");
  await dlm.saveAs(fm);
  const tm = unzipT(fm);
  check(tm.ok && /\.zip$/.test(dlm.suggestedFilename()), "/dev/download/module", "a valid <id>.zip", [dlm.suggestedFilename(), tm.text.split("\n").slice(-2).join(" ")]);
  const [dlr] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click("[data-download=rubric]")]);
  check(/\.rubric\.json$/.test(dlr.suggestedFilename()), "/dev/download/rubric", "<id>.rubric.json", dlr.suggestedFilename());
  check(ctx.consoleErrors.length === 0, "/dev/console-end", "clean", ctx.consoleErrors.slice(0, 5));

  // ======================================================================== 375 px
  {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 375, height: 800 });
    await ready(p, url(`?now=${NOW}`));
    await devReady(p);
    const widths = [];
    for (const s of ["identity", "domains", "flags", "patient", "lexicon", "downloads"]) {
      await p.click(`[data-section-nav=${s}]`);
      await p.waitForTimeout(150);
      widths.push([s, await p.evaluate(() => document.documentElement.scrollWidth)]);
    }
    await p.click("[data-section-nav=domains]");
    await p.locator('[data-path="/domains/0/items/0/w"]').fill("4");
    await p.waitForTimeout(1500);
    widths.push(["impact", await p.evaluate(() => document.documentElement.scrollWidth)]);
    check(widths.every(([, w]) => w <= 375), "/narrow/no-horizontal-scroll", "≤ 375", widths);
    const focusable = (sel) => p.evaluate((q) => { const e = document.querySelector(q); return e ? { tab: e.tabIndex, label: e.getAttribute("aria-label"), role: e.getAttribute("role") } : null; }, sel);
    const imp = await focusable("[data-testid=editor-impact] .re-scroll");
    check(!!imp && imp.tab === 0 && !!imp.label && imp.role === "region", "/narrow/impact-scroll-focusable", "tabIndex 0 + labelled region", imp);
    await p.click("[data-section-nav=logic]");
    await p.waitForTimeout(150);
    const lg = await focusable("[data-section=logic] pre");
    check(!!lg && lg.tab === 0 && !!lg.label && lg.role === "region", "/narrow/logic-scroll-focusable", "tabIndex 0 + labelled region", lg);
    await p.close();
  }

  // ======================================================================== shape fixture
  {
    const p = await ctx.newPage();
    await ready(p, url(`?now=${NOW}&fixture=shape-bare&active=upload:shape-bare`));
    await devReady(p);
    await p.selectOption("[data-testid=editor-module]", "upload:shape-bare");
    // A scoring change on a parent without research: no calibration notice in the Apply dialog.
    const hasResearch = await p.evaluate(() => { const e = window.__editorDev.entries().find((x) => x.key === "upload:shape-bare"); return !!(e && e.module.research); });
    await p.click("[data-section-nav=domains]");
    const sw = p.locator('[data-path="/domains/0/items/0/w"]');
    await sw.fill(String(Number(await sw.inputValue()) + 1));
    await p.click("[data-set-max='0']").catch(() => {});
    await settle(p);
    if (!hasResearch && !(await applyDisabled(p))) {
      await p.click("[data-testid=editor-apply]");
      await p.waitForSelector("[data-testid=apply-dialog] [data-apply=note]", { timeout: 20000 });
      check(await p.locator("[data-testid=apply-dialog] [data-notice=scoring]").count() === 0, "/shape/apply/no-calibration-notice", "no research → no calibration notice", await p.locator("[data-testid=apply-dialog] [data-notice=scoring]").innerText().catch(() => ""));
      await p.keyboard.press("Escape");
      await p.waitForSelector("[data-testid=apply-dialog]", { state: "detached", timeout: 5000 }).catch(() => {});
    } else {
      notes.push(`shape: calibration-notice absence not exercised (research ${hasResearch}, Apply ${await applyDisabled(p) ? "disabled" : "enabled"})`);
    }
    await p.click("[data-revert-all]");
    await settle(p);
    await p.click("[data-section-nav=lexicon]");
    await p.click("[data-create-lexicon]");
    await settle(p);
    const winEdited = await p.evaluate(() => { const e = document.querySelector('[data-path="/lexicon/negation/window"]'); const f = e && e.closest(".re-field"); return f ? !!f.querySelector(".re-edit") || f.classList.contains("re-changed") : "absent"; });
    check(winEdited === false, "/shape/create-lexicon/window-not-edited", "negation.window not marked edited", winEdited);
    const v28 = (await errorCodes(p)).filter((x) => x === "V28").length;
    check(v28 > 0, "/shape/create-lexicon/V28", "V28 names every flag without a phrase", await errorCodes(p));
    await p.click("[data-section-nav=patient]");
    await p.click("[data-create-patient]");
    await settle(p);
    const codes = await errorCodes(p);
    check(codes.includes("V23") || codes.includes("V32"), "/shape/create-patient/V23-V32", "V23/V32 list what is missing", codes);
    const rows = await p.$$eval("[data-patient-item]", (xs) => xs.length);
    check(rows > 0, "/shape/create-patient/rows", "one row per item", rows);
    await p.close();
  }

  // ======================================================================== saved draft, local time
  {
    const p = await ctx.newPage();
    try {
      const cdp = await p.context().newCDPSession(p);
      await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
      await ready(p, url(`?now=${NOW}`));
      await devReady(p);
      await p.evaluate((savedAt) => {
        const key = window.__editorDev.activeKey;
        const e = window.__editorDev.entries().find((x) => x.key === key);
        localStorage.setItem(`screenair.draft.v1.${key}`, JSON.stringify({ savedAt, parentSha: e.module.hashes.rubricSha256, rubric: e.module.rubric }));
      }, NOW);
      await ready(p, url(`?now=${NOW}`));
      await devReady(p);
      const banner = await p.waitForSelector("[data-testid=editor-resume]", { timeout: 10000 }).then((e) => e.innerText()).catch(() => "");
      // 12:00Z on 2026-10-01 is 08:00 in New York (EDT).
      check(banner.includes("2026-10-01 08:00"), "/draft/local-time", "2026-10-01 08:00 (America/New_York)", banner);
    } catch (err) {
      check(false, "/draft/error", "no error", String(err && err.message ? err.message : err).split("\n")[0]);
    } finally {
      await p.evaluate(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith("screenair.draft.v1.")) localStorage.removeItem(k); } catch (_) { /* blocked */ } }).catch(() => {});
      await p.close();
    }
  }

  // ======================================================================== the shell
  await shellPart(ctx, check, notes, out, unzipT);

  return { verdict: diffs.length ? "fail" : "pass", n, diffs, expectedMissing: [], notes };
}

async function shellPart(ctx, check, notes, out, unzipT) {
  const p = await ctx.newPage();
  const shellUrl = new URL("app/screenair.html#tab=screener", ctx.baseUrl).href;
  try {
    await p.goto(shellUrl, { waitUntil: "load" });
    await p.waitForFunction(() => document.documentElement.dataset.masqueReady === "true", null, { timeout: 60000 });
    await p.evaluate(() => { try { localStorage.removeItem("screenair.saved.v1"); } catch (_) { /* blocked */ } });
    const editorTab = await p.waitForSelector("[data-tab=editor]", { timeout: 20000 }).catch(() => null);
    if (!editorTab) { check(false, "/shell/editor-tab", "the shell's Rubric Editor tab (WP12-M2)", "absent"); return; }
    // Make the Screener dirty, so a switch has something to clear.
    const sample = await p.waitForSelector("[data-sample]", { timeout: 20000 }).catch(() => null);
    if (sample) await sample.click();
    await p.click("[data-tab=editor]");
    const ed = await p.waitForSelector("[data-testid=rubric-editor]", { timeout: 30000 }).catch(() => null);
    if (!ed) {
      const why = await p.evaluate(() => (document.querySelector("[role=tabpanel]:not([hidden])") || document.body).innerText.slice(0, 200));
      check(false, "/shell/editor-mounted", "apps/RubricEditor.jsx in the Rubric Editor tab", why);
      return;
    }
    const before = await p.locator("#sa-module").inputValue();
    await p.click("[data-section-nav=domains]");
    const w = p.locator('[data-path="/domains/0/items/0/w"]');
    await w.fill(String(Number(await w.inputValue()) + 1));
    await p.click("[data-set-max='0']");
    await p.waitForFunction(() => { const b = document.querySelector("[data-testid=editor-apply]"); return b && !b.disabled; }, null, { timeout: 30000 });
    await p.click("[data-testid=editor-apply]");
    await p.waitForSelector("[data-apply=note]", { timeout: 20000 });
    await p.fill("[data-apply=note]", "editor spec: shell create and switch");
    await p.waitForFunction(() => { const b = document.querySelector("[data-apply-action=create-switch]"); return b && !b.disabled; }, null, { timeout: 30000 });
    await p.click("[data-apply-action=create-switch]");
    const confirm = await p.waitForSelector("[data-testid=confirm-lines]", { timeout: 20000 }).catch(() => null);
    if (check(!!confirm, "/shell/switch/confirmation", "the shell's switch confirmation", sample ? "none shown" : "no sample button to make the Screener dirty")) {
      const lines = await p.locator("[data-testid=confirm-lines]").innerText();
      check(/Clinician Screener/.test(lines), "/shell/switch/lists-screener", "Clinician Screener — …", lines);
      await p.click("[data-testid=confirm-ok]");
    }
    await p.waitForFunction((b) => document.querySelector("#sa-module") && document.querySelector("#sa-module").value !== b, before, { timeout: 20000 }).catch(() => null);
    const after = await p.locator("#sa-module").inputValue();
    check(after !== before, "/shell/switch/active", "the derived module is active", after);
    check(/\(edited\)/.test(await p.title()), "/shell/switch/title", "screenAIr · … (edited)", await p.title());
    const saved = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem("screenair.saved.v1") || "[]").map((x) => x.id); } catch (_) { return null; } });
    check(Array.isArray(saved) && saved.length === 1, "/shell/remember/saved", "one remembered module", saved);
    // Download all from the shell.
    await p.click("[data-tab=editor]");
    await p.waitForSelector("[data-testid=rubric-editor]", { timeout: 20000 });
    await p.click("[data-section-nav=downloads]");
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.click("[data-download=all]")]);
    const file = path.join(out, "shell-download-all.zip");
    await dl.saveAs(file);
    const t = unzipT(file);
    check(t.ok && /No errors detected/.test(t.text) && /\/manifest\.json|manifest\.json/.test(t.text), "/shell/download/unzip-t", "a valid zip with a manifest", t.text.split("\n").slice(-3).join(" "));
    // Reload: the remembered module restores.
    await p.goto(new URL("app/screenair.html#tab=editor", ctx.baseUrl).href, { waitUntil: "load" });
    await p.reload({ waitUntil: "load" });
    await p.waitForFunction(() => document.documentElement.dataset.masqueReady === "true", null, { timeout: 60000 });
    const banner = await p.waitForSelector("[data-testid=restore-banner]", { timeout: 20000 }).catch(() => null);
    if (check(!!banner, "/shell/remember/banner", "the restore banner", "absent")) {
      await p.click("[data-testid=restore-saved]");
      const ok = await p.waitForFunction((id) => [...document.querySelectorAll("#sa-module option")].some((o) => o.value.includes(id)), saved && saved[0], { timeout: 20000 }).then(() => true).catch(() => false);
      check(ok, "/shell/remember/restored", "the remembered module is in the Module menu again", await p.$$eval("#sa-module option", (xs) => xs.map((x) => x.value)));
    }
  } catch (err) {
    check(false, "/shell/error", "no error", String(err && err.message ? err.message : err).split("\n")[0]);
  } finally {
    notes.push("shell part: screenair.html (WP12 shell)");
    await p.evaluate(() => { try { localStorage.removeItem("screenair.saved.v1"); } catch (_) { /* blocked */ } }).catch(() => {});
    await p.close();
  }
}
