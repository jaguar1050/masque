// tests/playwright/specs/pages.mjs — every page, the redirects, the at-home patient page,
// patient mode and the keyboard-safe module picker (design 03 §8.3 `pages`, §5.1, §5.2, §5.11,
// §9.13 done-when 4, 5, 6, 7, 8). Owner: WP12 (+ WP13 runner). Cloud runner only.
//
//   health     screenair.html, patient.html and the legacy pages reach masqueReady with
//              #root children and a clean console; index.html loads; every page and the
//              redirect is noindex, nofollow; time-to-ready of screenair.html is recorded and
//              must be ≤ 3 s (done-when 6).
//   redirects  simulator.html lands on screenair.html with the hash it was given (from M2);
//              index.html, screener.html, scribe.html and population.html become redirects
//              in WP14 and are reported, not failed, until then.
//   picker     the first two options are exactly the default built-in's label and "Upload"
//              (done-when 7); arrow keys on the closed select neither open the upload dialog
//              nor switch module, Escape restores, Enter commits (§5.2).
//   caveat     "Prototype · not for clinical use" in the strip on all five tabs, in patient
//              mode, on patient.html and in the print header (done-when 4).
//   patient    patient.html and #mode=patient render only the Patient Companion, the caveat
//              and the footer: no nav.sa-tabs, no select, no file input, no link to
//              screenair.html or index.html, no omission-pattern match in the visible text, no
//              score or band (done-when 8); patient.html's module graph excludes the §5.11
//              list; leaving patient mode needs the confirmation; a reload with
//              #mode=patient&module=<unknown> shows the "no longer loaded" message.
//   narrow     no horizontal page scroll at 375 px on any tab, in patient mode and on
//              patient.html (done-when 5), and no visible element extends past the viewport
//              (content clipped or scrolled inside its own box does not count).
//   boot       the pages version the loader URL, load Babel with defer, and show a visible
//              error (not an endless "Loading…") when the loader cannot be imported.

const PROTO = "Prototype · not for clinical use";
const RETURN_TEXT = "The clinician view shows scores, research data and module tools. Hand the device back to the clinician before continuing.";
const NO_LONGER = "This questionnaire is no longer loaded on this device. Please hand the device back to your clinician.";
const NOT_AVAILABLE = "This questionnaire is not available.";
const TABS = ["screener", "scribe", "patient", "research", "editor"];
const OMISSION_PATTERNS = [
  /\bscor(?:e|es|ed|ing)\b/i,
  /likelihood/i,
  /probabil/i,
  /\b\d{1,3}\s*\/\s*\d{2,3}\b/,
  /\bpuntuaci[oó]n|\bpuntaje\b/i,
];
const PATIENT_GRAPH_EXCLUDES = [
  "src/shell/ScreenAIr.jsx", "src/shell/ModuleWorkspace.jsx", "src/shell/ModulePicker.jsx", "src/shell/UploadDialog.jsx",
  "src/apps/Screener.jsx", "src/apps/Scribe.jsx", "src/apps/ResearchTab.jsx", "src/apps/RubricEditor.jsx",
  "src/ResearchReadinessPanel.jsx", "src/MASQUE_Population.jsx", "src/MASQUE_Voice.js",
];
const TTR_BUDGET_MS = 3000;

export default async function pages(page, ctx) {
  const diffs = [];
  const notes = [];
  let n = 0;
  const check = (ok, path, a, b) => { n += 1; if (!ok) diffs.push({ path, input: null, a, b }); return ok; };
  const app = (p) => new URL(`app/${p}`, ctx.baseUrl).href;
  const waitFor = async (p, fn, arg, timeout = 5000) => { try { await p.waitForFunction(fn, arg, { timeout }); return true; } catch { return false; } };

  async function open(p, path, { errors } = {}) {
    // A hash-only change is a same-document navigation; leave the page first so this is a load.
    await p.goto("about:blank");
    const t0 = Date.now();
    await p.goto(app(path), { waitUntil: "load" });
    const ok = await waitFor(p, () => document.documentElement.dataset.masqueReady === "true", null, 60000);
    const ms = Date.now() - t0;
    const health = await p.evaluate(() => ({
      ready: document.documentElement.dataset.masqueReady === "true",
      root: document.getElementById("root") ? document.getElementById("root").children.length : 0,
      robots: (document.querySelector('meta[name="robots"]') || {}).content || "",
    }));
    return { ok, ms, health, errors };
  }
  /** The shell is ready when the module workspace (or a failure card) is on screen. */
  const shellReady = (p) => waitFor(p, () => !!document.querySelector(".sa-shell main[data-module], .sa-shell [data-testid=invalid-module], .sa-shell [data-testid=registry-error], .sa-shell [data-testid=patient-missing]"), null, 30000);
  const consoleSince = (from) => ctx.consoleErrors.slice(from).filter((e) => !/status of 404/.test(e) || !/RubricEditor/.test(e));

  // ------------------------------------------------------------------ health
  let mark = ctx.consoleErrors.length;
  const ttr = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const r = await open(page, "screenair.html");
    const ready = await shellReady(page);
    ttr.push(Date.now() - t0);
    if (i === 0) {
      check(r.ok && r.health.ready && r.health.root > 0 && ready, "/screenair/health", "masqueReady, #root, workspace", r.health);
      check(/noindex/.test(r.health.robots) && /nofollow/.test(r.health.robots), "/screenair/robots", "noindex, nofollow", r.health.robots);
    }
  }
  const best = Math.min(...ttr);
  notes.push(`time-to-ready screenair.html (module workspace on screen): ${ttr.join(", ")} ms (best ${best} ms; budget ${TTR_BUDGET_MS} ms)`);
  check(best <= TTR_BUDGET_MS, "/screenair/time-to-ready", `≤ ${TTR_BUDGET_MS} ms`, `${best} ms`);
  check(consoleSince(mark).length === 0, "/screenair/console", "clean", consoleSince(mark).slice(0, 5));

  for (const legacy of ["patient.html", "screener.html", "scribe.html", "population.html"]) {
    mark = ctx.consoleErrors.length;
    const p = page;
    await p.goto(app(legacy), { waitUntil: "load" });
    const url = p.url();
    if (/screenair\.html/.test(url)) { notes.push(`${legacy} redirects to ${url.replace(ctx.baseUrl, "")}`); continue; }
    const ok = await waitFor(p, () => document.documentElement.dataset.masqueReady === "true", null, 60000);
    await p.waitForTimeout(400);
    const h = await p.evaluate(() => ({
      root: document.getElementById("root") ? document.getElementById("root").children.length : 0,
      robots: (document.querySelector('meta[name="robots"]') || {}).content || "",
    }));
    check(ok && h.root > 0, `/${legacy}/health`, "masqueReady with #root children", h);
    check(/noindex/.test(h.robots) && /nofollow/.test(h.robots), `/${legacy}/robots`, "noindex, nofollow", h.robots);
    const errs = ctx.consoleErrors.slice(mark);
    check(errs.length === 0, `/${legacy}/console`, "clean", errs.slice(0, 5));
  }
  {
    await page.goto(app("index.html"), { waitUntil: "load" });
    const url = page.url();
    const robots = await page.evaluate(() => (document.querySelector('meta[name="robots"]') || {}).content || "");
    check(/noindex/.test(robots) && /nofollow/.test(robots), "/index/robots", "noindex, nofollow", robots);
    if (/screenair\.html/.test(url)) notes.push("index.html redirects to screenair.html (WP14)");
    else {
      const links = await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")));
      check(links.includes("./screenair.html") && links.includes("./patient.html"), "/index/cards", "screenAIr and For patients cards", links);
      check(!links.includes("./simulator.html"), "/index/no-simulator-card", "no Simulator card (M2)", links);
      notes.push("index.html, screener.html, scribe.html and population.html become redirects in WP14; until then they are checked as pages");
    }
  }

  // ------------------------------------------------------------------ redirects
  {
    const p = page;
    const resp = await p.request.get(app("simulator.html"));
    const html = await resp.text();
    check(/noindex,\s*nofollow/.test(html), "/simulator/robots", "noindex, nofollow", "missing");
    check(html.includes(PROTO.replace("·", "&middot;")) || html.includes(PROTO), "/simulator/caveat", PROTO, "missing");
    await p.goto(app("simulator.html#tab=research"), { waitUntil: "load" });
    const landed = await waitFor(p, () => /screenair\.html/.test(location.pathname), null, 10000);
    check(landed, "/simulator/redirect", "screenair.html", p.url());
    if (landed) {
      await shellReady(p);
      const tab = await p.evaluate(() => new URLSearchParams(location.hash.slice(1)).get("tab"));
      check(tab === "research", "/simulator/redirect/tab", "research", tab);
      const sel = await p.evaluate(() => (document.querySelector('nav.sa-tabs [aria-selected="true"]') || {}).dataset?.tab || null);
      check(sel === "research", "/simulator/redirect/tab-shown", "research", sel);
    }
  }

  // ------------------------------------------------------------------ picker and caveat on every tab
  await open(page, "screenair.html#tab=screener");
  await shellReady(page);
  const opts = await page.evaluate(() => [...document.querySelectorAll("#sa-module option")].map((o) => o.textContent));
  const rubric = await (await fetch(app("modules/masque/masque.rubric.json"))).json();
  check(opts[0] === rubric.label && opts[1] === "Upload", "/picker/first-two", [rubric.label, "Upload"], opts.slice(0, 2));
  check(await page.evaluate(() => {
    const first = [...document.querySelectorAll("button, select, input, a[href], textarea")].find((el) => el.offsetParent !== null);
    return !!first && first.id === "sa-module";
  }), "/picker/first-control", "the module select is the first interactive control", "another control comes first");
  for (const t of TABS) {
    await page.click(`nav.sa-tabs [data-tab="${t}"]`);
    await page.waitForTimeout(250);
    const strip = await page.textContent("#sa-caveat").catch(() => "");
    check(strip.includes(PROTO), `/caveat/${t}`, PROTO, strip);
    const head = await page.textContent(".sa-print-head td").catch(() => "");
    check(head.startsWith(PROTO), `/print-head/${t}`, PROTO, head);
    const shown = await page.evaluate((k) => { const el = document.getElementById(`sa-panel-${k}`); return !!el && !el.hidden && el.children.length > 0; }, t);
    check(shown, `/tab/${t}/shown`, "panel mounted and shown", "hidden or empty");
  }
  // Panels stay mounted (hidden) after their first visit, so a tab switch keeps their state.
  const mounted = await page.evaluate((keys) => keys.filter((k) => { const el = document.getElementById(`sa-panel-${k}`); return !!el && el.children.length > 0; }), TABS);
  check(mounted.length === TABS.length, "/tabs/kept-mounted", TABS, mounted);

  // Keyboard on the closed select (§5.2).
  {
    await page.click('nav.sa-tabs [data-tab="screener"]');
    const before = await page.evaluate(() => document.querySelector(".sa-shell main").dataset.module);
    await page.focus("#sa-module");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(250);
    check(await page.locator("[data-testid=upload-dialog]").count() === 0, "/keyboard/arrow/no-upload", "no upload dialog on ArrowDown", "upload dialog opened");
    check(await page.evaluate(() => document.querySelector(".sa-shell main").dataset.module) === before, "/keyboard/arrow/no-switch", before, "switched");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    const v = await page.evaluate(() => document.getElementById("sa-module").selectedOptions[0].textContent);
    check(v === rubric.label, "/keyboard/escape-restores", rubric.label, v);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const opened = await waitFor(page, () => !!document.querySelector("[data-testid=upload-dialog]"), null, 3000);
    check(opened, "/keyboard/enter-commits", "Enter on Upload opens the upload dialog", "no dialog");
    if (opened) {
      // The modal keeps focus inside and the page behind it is inert.
      await page.waitForTimeout(100);
      const outside = [];
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
        await page.keyboard.press("Tab");
        if (!(await page.evaluate(() => !!document.activeElement.closest("[data-testid=upload-dialog]")))) outside.push(await page.evaluate(() => document.activeElement.tagName));
      }
      check(!outside.length, "/modal/upload/trap", "Tab stays in the dialog", outside);
      check(await page.evaluate(() => document.querySelector("header.sa-top").closest("[inert]") !== null), "/modal/upload/inert", "page behind is inert", "reachable");
      await page.keyboard.press("Escape");
      check(await waitFor(page, () => !document.querySelector("[data-testid=upload-dialog]")), "/keyboard/cancel", "closed", "open");
      check(await waitFor(page, () => document.activeElement && document.activeElement.id === "sa-module"), "/modal/upload/focus-return", "#sa-module", await page.evaluate(() => document.activeElement.tagName));
      check(await page.evaluate(() => !document.querySelector("[inert]:not([role=tabpanel])")), "/modal/upload/inert-cleared", "nothing inert", "inert left behind");
      const after = await page.evaluate(() => document.getElementById("sa-module").selectedOptions[0].textContent);
      check(after === rubric.label, "/keyboard/reset-after-upload", rubric.label, after);
    }
    // Switching between two modules by keyboard: load the shape fixture first.
    const shape = await (await fetch(app("tests/fixtures/modules/shape.rubric.json"))).text();
    await page.selectOption("#sa-module", "__upload__");
    await page.setInputFiles("[data-testid=upload-input]", { name: "shape.rubric.json", mimeType: "application/json", buffer: Buffer.from(shape) });
    await page.click("[data-testid=upload-validate]");
    if (await waitFor(page, () => { const b = document.querySelector("[data-testid=upload-load]"); return !!b && !b.disabled; }, null, 15000)) {
      await page.click("[data-testid=upload-load]");
      await waitFor(page, () => document.querySelector(".sa-shell main")?.dataset.module === "shape", null, 15000);
      await page.focus("#sa-module");
      await page.keyboard.press("Home");
      await page.waitForTimeout(250);
      check(await page.evaluate(() => document.querySelector(".sa-shell main").dataset.module) === "shape", "/keyboard/two/no-switch", "shape stays active while the choice is pending", "switched");
      check(await page.locator("[data-testid=switch-dialog]").count() === 0, "/keyboard/two/no-dialog", "no dialog", "dialog");
      await page.keyboard.press("Enter");
      const sw = await waitFor(page, (id) => document.querySelector(".sa-shell main")?.dataset.module === id, rubric.id, 10000);
      check(sw, "/keyboard/two/enter-switches", rubric.id, await page.evaluate(() => document.querySelector(".sa-shell main")?.dataset.module));
    } else {
      check(false, "/keyboard/two/upload", "the shape fixture loads", await page.textContent("[data-testid=upload-dialog]").catch(() => "no dialog"));
    }
  }

  // ------------------------------------------------------------------ ModuleInfo (About, D27)
  {
    await page.click("[data-testid=module-info-button]");
    const opened = await waitFor(page, () => !!document.querySelector("[data-testid=module-info]"));
    if (check(opened, "/info/open", "ModuleInfo drawer", "none")) {
      const about = await page.textContent("[data-testid=module-info-about]");
      check(about.includes(PROTO) && /illustrative until fit on approved data/.test(about), "/info/about/notice", "the notice from index.html", about.slice(0, 200));
      const axes = await page.evaluate(() => [...document.querySelectorAll("[data-testid=module-info] [data-axis]")].map((x) => x.dataset.axis));
      for (const a of ["release", "instrument", "lexicon", "probe-set", "gold-set"]) check(axes.includes(a), `/info/axis/${a}`, "listed separately", axes);
      const text = await page.textContent("[data-testid=module-info]");
      check(/[0-9a-f]{64}/.test(text), "/info/hashes", "SHA-256 hashes", "none");
      check(await page.locator("[data-testid=module-info] button:has-text('Remove from this session')").count() === 0, "/info/builtin-not-removable", "no Remove for a built-in", "Remove offered");
      // A parent re-render (a toast) does not move focus inside the open drawer.
      await page.keyboard.press("Shift+Tab");
      const f1 = await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80));
      await page.evaluate(() => { location.hash = "tab=scribe"; });
      await page.waitForTimeout(300);
      const f2 = await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80));
      check(f1 === f2 && await page.evaluate(() => !!document.activeElement.closest("[data-testid=module-info]")), "/modal/info/focus-stable", f1, f2);
      await page.keyboard.press("Escape");
      check(await waitFor(page, () => !document.querySelector("[data-testid=module-info]")), "/info/escape", "closed", "open");
      check(await waitFor(page, () => document.activeElement && document.activeElement.dataset.testid === "module-info-button"), "/modal/info/focus-return", "the ⓘ button", await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80)));
      await page.click('nav.sa-tabs [data-tab="screener"]');
    }
  }

  // ------------------------------------------------------------------ hash edits of module=
  {
    // An unknown module= is not followed and does not stay in the address.
    await page.evaluate(() => { location.hash = "tab=screener&module=no-such-module"; });
    await page.waitForTimeout(400);
    const h = await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get("module"));
    const shown = await page.evaluate(() => document.querySelector(".sa-shell main")?.dataset.module || null);
    check(h === rubric.id && shown === rubric.id, "/hash/module-unknown", { hash: rubric.id, shown: rubric.id }, { hash: h, shown });
    // A module= naming the active built-in after its removal from the address is written back.
    await page.evaluate(() => { location.hash = "tab=research"; });
    await page.waitForTimeout(400);
    const h2 = await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get("module"));
    check(h2 === rubric.id, "/hash/module-rewritten", rubric.id, h2);
    await page.click('nav.sa-tabs [data-tab="screener"]');
  }

  // ------------------------------------------------------------------ a built-in that fails to load
  for (const [label, body] of [["not-json", "{ not json"], ["invalid", null]]) {
    const p = await ctx.newPage();
    let fulfilled = 0;
    await p.route((u) => u.pathname.endsWith("/modules/masque/masque.rubric.json") || u.pathname.endsWith(`/${rubric.id}.rubric.json`), async (route) => {
      fulfilled += 1;
      if (body !== null) return route.fulfill({ status: 200, contentType: "application/json", body });
      const r = JSON.parse(JSON.stringify(rubric));
      r.domains[0].max += 7;   // V15: Σw no longer equals the domain max
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r, null, 2) });
    });
    await p.goto(app("screenair.html#tab=screener"), { waitUntil: "load" });
    await waitFor(p, () => document.documentElement.dataset.masqueReady === "true", null, 60000);
    const inv = await waitFor(p, () => !!document.querySelector("[data-testid=invalid-module]"), null, 30000);
    if (check(inv && fulfilled > 0, `/invalid/${label}/shown`, "InvalidModule", inv ? "shown" : "absent")) {
      const t = await p.textContent("[data-testid=invalid-module]");
      check(label === "invalid" ? /V15/.test(t) : /Not valid JSON/.test(t), `/invalid/${label}/report`, label === "invalid" ? "V15 · path · message" : "Not valid JSON", t.slice(0, 200));
      check(await p.locator("[data-testid=invalid-module] button:has-text('Retry')").count() === 1, `/invalid/${label}/retry`, "Retry", "absent");
      const o = await p.evaluate(() => [...document.querySelectorAll("#sa-module option")].map((x) => x.textContent));
      check(/\(failed to load\)$/.test(o[0] || "") && o[1] === "Upload", `/invalid/${label}/picker`, "<label> (failed to load), Upload", o);
      check(await p.locator("[data-testid=scr-banner], [data-testid=scribe-app], [data-testid=patient-app]").count() === 0, `/invalid/${label}/no-app`, "no app mounted", "an app mounted");
      check((await p.textContent("#sa-caveat")).includes(PROTO), `/invalid/${label}/caveat`, PROTO, "missing");
    }
    await p.close();
  }

  // Only the logic file fails: the rubric is read first, so the module keeps its label.
  {
    const p = await ctx.newPage();
    await p.route((u) => /\/modules\/[^/]+\/[^/]+\.logic\.js$/.test(u.pathname), (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "gone" }));
    await p.goto(app("screenair.html#tab=screener"), { waitUntil: "load" });
    await waitFor(p, () => document.documentElement.dataset.masqueReady === "true", null, 60000);
    const inv = await waitFor(p, () => !!document.querySelector("[data-testid=invalid-module]"), null, 30000);
    const o = await p.evaluate(() => [...document.querySelectorAll("#sa-module option")].map((x) => x.textContent));
    const head = inv ? await p.textContent("[data-testid=invalid-module] h2") : "";
    check(inv && o[0] === `${rubric.label} (failed to load)` && head.includes(rubric.label), "/invalid/logic-missing/label", `${rubric.label} (failed to load)`, { option: o[0], head });
    await p.close();
  }

  // ------------------------------------------------------------------ patient mode
  async function patientOnly(p, label) {
    const r = await p.evaluate(() => {
      const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
      const any = (sel) => [...document.querySelectorAll(sel)].some(vis);
      const what = document.querySelector("[data-testid=patient-what-it-isnt]");
      const text = document.body.innerText.replace(what ? what.innerText : "\u0000", "");
      return {
        tabs: any("nav.sa-tabs"), select: any("select"), file: document.querySelectorAll("input[type=file]").length,
        upload: any("[data-testid=upload-dialog]"), info: any("[data-testid=module-info-button]"),
        links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => /screenair\.html|index\.html|^\.\/?$|^\/$/.test(h)),
        companion: any("[data-testid=patient-app]"), caveat: (document.getElementById("sa-caveat") || {}).textContent || "",
        footer: (document.getElementById("sa-footer") || {}).textContent || "",
        visiblePanels: [...document.querySelectorAll("[role=tabpanel]")].filter(vis).map((x) => x.dataset.panel),
        text,
      };
    });
    check(!r.tabs, `/${label}/no-tabs`, "no tab bar", "tab bar");
    check(!r.select, `/${label}/no-select`, "no select", "select visible");
    check(r.file === 0, `/${label}/no-file-input`, 0, r.file);
    check(!r.info, `/${label}/no-info`, "no ⓘ", "ⓘ");
    check(r.links.length === 0, `/${label}/no-clinician-link`, [], r.links);
    check(r.companion, `/${label}/companion`, "Patient Companion shown", "absent");
    check(r.caveat.includes(PROTO), `/${label}/caveat`, PROTO, r.caveat);
    check(r.footer.includes(PROTO), `/${label}/footer`, PROTO, r.footer);
    if (r.visiblePanels.length) check(r.visiblePanels.length === 1 && r.visiblePanels[0] === "patient", `/${label}/panels`, ["patient"], r.visiblePanels);
    for (const re of OMISSION_PATTERNS) {
      const m = re.exec(r.text);
      check(!m, `/${label}/@pattern`, `no match for ${re}`, m && r.text.slice(Math.max(0, m.index - 40), m.index + 40));
    }
    return r;
  }

  {
    await open(page, "screenair.html#tab=patient");
    await shellReady(page);
    const bar = await page.textContent("[data-testid=patient-mode-bar]").catch(() => "");
    check(/Hand to patient/.test(bar) && bar.includes(`patient.html?module=${rubric.id}`), "/patient-tab/bar", "Hand to patient + at-home link", bar);
    // The companion keeps its place when it is handed over (same instance, no remount).
    await page.click(".sa-shell [data-testid=patient-next]").catch(() => {});
    await page.waitForTimeout(150);
    const before = await page.textContent(".sa-shell [data-testid=patient-progress]").catch(() => null);
    await page.click("[data-testid=hand-to-patient]");
    await page.waitForTimeout(300);
    const after = await page.textContent(".sa-shell [data-testid=patient-progress]").catch(() => null);
    check(before !== null && before === after, "/patient-mode/state-kept", before, after);
    // Focus moves to the Patient Companion's heading, not <body>.
    const handFocus = await page.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, inPanel: !!a.closest("#sa-panel-patient") } : null; });
    check(!!handFocus && /^H[12]$/.test(handFocus.tag) && handFocus.inPanel, "/patient-mode/hand/focus", "the Patient Companion heading", handFocus);
    await patientOnly(page, "patient-mode");
    const hash = await page.evaluate(() => location.hash);
    check(/mode=patient/.test(hash) && hash.includes(`module=${rubric.id}`), "/patient-mode/hash", `#…mode=patient&module=${rubric.id}`, hash);
    const title = await page.title();
    check(title === "screenAIr · Patient Companion", "/patient-mode/title", "screenAIr · Patient Companion", title);
    // Clinician screens stay mounted but hidden and inert.
    const inert = await page.evaluate(() => [...document.querySelectorAll("[role=tabpanel]")].filter((p) => p.dataset.panel !== "patient" && p.children.length).every((p) => p.hidden && p.hasAttribute("inert")));
    check(inert, "/patient-mode/inert", "other panels hidden and inert", "reachable");
    // Leaving needs the confirmation.
    await page.click("[data-testid=return-to-clinician]");
    const dlg = await waitFor(page, () => !!document.querySelector("[data-testid=return-dialog]"));
    check(dlg, "/patient-mode/return/dialog", "confirmation", "none");
    if (dlg) {
      const txt = await page.textContent("[data-testid=return-dialog]");
      check(txt.includes(RETURN_TEXT), "/patient-mode/return/text", RETURN_TEXT, txt);
      await page.click("[data-testid=confirm-cancel]");
      await page.waitForTimeout(200);
      check(await page.evaluate(() => document.querySelector(".sa-shell").dataset.mode) === "patient", "/patient-mode/return/stay", "patient", "clinician");
      // A hand-edited hash does not leave patient mode either.
      await page.evaluate(() => { location.hash = "tab=screener"; });
      await page.waitForTimeout(300);
      check(await page.evaluate(() => document.querySelector(".sa-shell").dataset.mode) === "patient", "/patient-mode/hash-edit", "patient", "clinician");
      await page.click("[data-testid=return-to-clinician]");
      await page.click("[data-testid=confirm-ok]");
      await page.waitForTimeout(200);
      check(await page.evaluate(() => document.querySelector(".sa-shell").dataset.mode) === "clinician", "/patient-mode/return/ok", "clinician", "patient");
      // The return dialog focuses the safe action: Enter, Enter on Return stays in patient mode.
      await page.click('nav.sa-tabs [data-tab="patient"]');
      await page.click("[data-testid=hand-to-patient]");
      await page.waitForTimeout(200);
      await page.focus("[data-testid=return-to-clinician]");
      await page.keyboard.press("Enter");
      await waitFor(page, () => !!document.querySelector("[data-testid=return-dialog]"));
      await page.waitForTimeout(100);
      const focused = await page.evaluate(() => (document.activeElement && document.activeElement.dataset.testid) || "");
      check(focused === "confirm-cancel", "/patient-mode/return/focus", "Stay in patient mode focused", focused);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      check(await page.evaluate(() => document.querySelector(".sa-shell").dataset.mode) === "patient", "/patient-mode/return/enter-enter", "patient", "clinician");
      await page.click("[data-testid=return-to-clinician]");
      await page.click("[data-testid=confirm-ok]");
      await page.waitForTimeout(200);
      // A companion that holds answers is not handed to the next patient silently.
      await page.click(".sa-shell [data-testid=patient-next]").catch(() => {});
      await page.waitForTimeout(100);
      await page.click(".sa-shell #sa-panel-patient [data-flag]").catch(() => {});
      await page.waitForTimeout(150);
      await page.click("[data-testid=hand-to-patient]");
      const hand = await waitFor(page, () => !!document.querySelector("[data-testid=hand-dialog]"));
      check(hand, "/patient-mode/hand/dialog", "new-session choice", "handed over with the previous answers");
      if (hand) {
        await page.click("[data-testid=confirm-ok]");
        await page.waitForTimeout(300);
        const sec = await page.evaluate(() => { const s = document.querySelector(".sa-shell [data-testid=patient-section]"); return s ? s.dataset.section : null; });
        const mode = await page.evaluate(() => document.querySelector(".sa-shell").dataset.mode);
        check(mode === "patient" && sec === "intro", "/patient-mode/hand/new-session", "patient mode, fresh companion at intro", { mode, sec });
        await page.click("[data-testid=return-to-clinician]");
        await page.click("[data-testid=confirm-ok]");
        await page.waitForTimeout(200);
      }
    }
    // An address edit into patient mode closes a clinician dialog that was open (here Upload).
    await page.selectOption("#sa-module", "__upload__");
    if (await waitFor(page, () => !!document.querySelector("[data-testid=upload-dialog]"))) {
      await page.evaluate(() => { location.hash = "tab=patient&mode=patient"; });
      await page.waitForTimeout(400);
      const st = await page.evaluate(() => ({ mode: document.querySelector(".sa-shell").dataset.mode, upload: !!document.querySelector("[data-testid=upload-dialog]"), inert: !!document.querySelector("header.sa-top[inert], header.sa-top [inert]") }));
      check(st.mode === "patient" && !st.upload && !st.inert, "/patient-mode/closes-upload", { mode: "patient", upload: false, inert: false }, st);
      await page.click("[data-testid=return-to-clinician]");
      await page.click("[data-testid=confirm-ok]");
      await page.waitForTimeout(200);
    } else {
      check(false, "/patient-mode/closes-upload", "upload dialog opened first", "no dialog");
    }
    // Reload on #mode=patient reopens patient mode on that built-in.
    await open(page, `screenair.html#tab=patient&module=${rubric.id}&mode=patient`);
    await shellReady(page);
    await page.waitForTimeout(300);
    await patientOnly(page, "patient-mode-reload");
    // An id that is not a built-in is never substituted.
    await open(page, "screenair.html#tab=patient&module=local-unknown-1&mode=patient");
    await shellReady(page);
    const miss = await page.textContent("[data-testid=patient-missing]").catch(() => "");
    check(miss.includes(NO_LONGER), "/patient-mode/missing", NO_LONGER, miss);
    check(await page.locator("[data-testid=patient-app]").count() === 0, "/patient-mode/missing/no-companion", 0, await page.locator("[data-testid=patient-app]").count());
    // Nothing of the fallback module shows: no name in the header, no print header naming it.
    const missTitle = await page.textContent("[data-testid=patient-mode-title]").catch(() => null);
    check(missTitle === "", "/patient-mode/missing/no-module-name", "", missTitle);
    const missHead = await page.textContent(".sa-print-head td").catch(() => "");
    check(missHead === PROTO, "/patient-mode/missing/print-head", PROTO, missHead);
  }

  // ------------------------------------------------------------------ patient.html
  {
    mark = ctx.consoleErrors.length;
    const r = await open(page, "patient.html");
    await waitFor(page, () => !!document.querySelector("[data-testid=patient-app]"), null, 30000);
    check(r.health.ready && r.health.root > 0, "/patient-page/health", "healthy", r.health);
    await patientOnly(page, "patient-page");
    const head = await page.textContent(".sa-print-head td").catch(() => "");
    check(head === PROTO, "/patient-page/print-head", PROTO, head);
    check(ctx.consoleErrors.slice(mark).length === 0, "/patient-page/console", "clean", ctx.consoleErrors.slice(mark, mark + 5));
    await open(page, "patient.html?module=not-a-module");
    await waitFor(page, () => !!document.querySelector("[data-testid=patient-page-missing]"), null, 30000);
    const miss = await page.textContent("[data-testid=patient-page-missing]").catch(() => "");
    check(miss === NOT_AVAILABLE, "/patient-page/unknown-module", NOT_AVAILABLE, miss);
    check(await page.locator("[data-testid=patient-app]").count() === 0, "/patient-page/unknown-module/no-fallback", 0, 1);
    // Module graph (§5.11): fetch sources and follow relative specifiers.
    const graph = await moduleGraph(app("src/shell/PatientPage.jsx"));
    const appRoot = app("");
    const rel = [...graph].map((u) => u.replace(appRoot, ""));
    for (const x of PATIENT_GRAPH_EXCLUDES) check(!rel.includes(x), `/patient-page/graph/${x}`, "absent", "present");
    notes.push(`patient.html module graph: ${rel.length} files`);
    const pageHtml = await (await fetch(app("patient.html"))).text();
    check(!/href=["'][^"']*(screenair|index)\.html/.test(pageHtml) && !/masque-back/.test(pageHtml.replace(/\.masque-back[^}]*\}/g, "")), "/patient-page/html/no-link", "no link to the clinician program", "link");
  }

  // ------------------------------------------------------------------ 375 px
  {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 375, height: 760 });
    const overflow = () => p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
    // Every visible element's visible extent lies inside the viewport. An ancestor that clips or
    // scrolls (overflow-x other than visible) bounds what is visible of its content, so a table in
    // a scrolling wrapper or the tab bar scrolling inside itself is not a finding; a box that is
    // wider than the screen while the page itself does not scroll (body overflow hidden, an
    // absolutely positioned element) is.
    const outside = () => p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const clipCache = new Map();
      const clips = (el) => {
        if (!clipCache.has(el)) {
          const ox = getComputedStyle(el).overflowX;
          clipCache.set(el, ox !== "visible" && el !== document.body && el !== document.documentElement);
        }
        return clipCache.get(el);
      };
      const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.classList.length ? `.${[...el.classList].slice(0, 2).join(".")}` : ""}${el.dataset.testid ? `[${el.dataset.testid}]` : ""}`;
      const bad = [];
      for (const el of document.body.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "contents") continue;
        let left = r.left, right = r.right;
        for (let a = el.parentElement; a && left < right; a = a.parentElement) {
          if (!clips(a)) continue;
          const ar = a.getBoundingClientRect();
          left = Math.max(left, ar.left);
          right = Math.min(right, ar.right);
        }
        if (left >= right) continue;
        if (right > vw + 0.5 || left < -0.5) bad.push(`${name(el)} ${Math.round(left)}…${Math.round(right)}`);
      }
      return bad;
    });
    // Report the outermost offenders: a too-wide box makes its children too wide as well.
    const firstFew = (list) => list.slice(0, 6);
    await p.goto(app("screenair.html#tab=screener"), { waitUntil: "load" });
    await shellReady(p);
    for (const t of TABS) {
      await p.click(`nav.sa-tabs [data-tab="${t}"]`);
      await p.waitForTimeout(t === "editor" ? 2500 : 400);
      const o = await overflow();
      check(o <= 0, `/narrow/${t}`, "no horizontal page scroll at 375 px", `${o}px wider`);
      const out = await outside();
      check(out.length === 0, `/narrow/${t}/elements`, "no element past the viewport at 375 px", firstFew(out));
    }
    await p.click('nav.sa-tabs [data-tab="patient"]');
    await p.click("[data-testid=hand-to-patient]");
    await p.waitForTimeout(300);
    check(await overflow() <= 0, "/narrow/patient-mode", "no horizontal scroll", `${await overflow()}px`);
    const outP = await outside();
    check(outP.length === 0, "/narrow/patient-mode/elements", "no element past the viewport", firstFew(outP));
    await p.goto(app("patient.html"), { waitUntil: "load" });
    await waitFor(p, () => !!document.querySelector("[data-testid=patient-app]"), null, 30000);
    check(await overflow() <= 0, "/narrow/patient-page", "no horizontal scroll", `${await overflow()}px`);
    const outPP = await outside();
    check(outPP.length === 0, "/narrow/patient-page/elements", "no element past the viewport", firstFew(outPP));
    await p.close();
  }

  // ------------------------------------------------------------------ boot: loader URL, deferred Babel, visible failure
  {
    // The loader URL carries the release, so a new release never runs with a cached old loader.
    const release = ((await (await fetch(app("src/engine/policy.js"))).text()).match(/APP_VERSION\s*=\s*"([^"]+)"/) || [])[1] || "?";
    for (const pg of ["screenair.html", "patient.html"]) {
      const html = await (await fetch(app(pg))).text();
      const url = (html.match(/masque-loader\.js[^'"]*/) || [""])[0];
      check(url === `masque-loader.js?v=${release}`, `/boot/${pg}/versioned-loader`, `masque-loader.js?v=${release}`, url);
      check(/<script defer src="[^"]*babel[^"]*"/.test(html), `/boot/${pg}/babel-defer`, "<script defer src=…babel…>", (html.match(/<script[^>]*babel[^>]*>/) || [""])[0]);
    }
    const p = await ctx.newPage();
    await p.route((u) => u.pathname.endsWith("/assets/masque-loader.js"), (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "gone" }));
    await p.goto(app("screenair.html"), { waitUntil: "load" });
    const shown = await waitFor(p, () => [...document.querySelectorAll("[role=alert]")].some((x) => /failed to start/.test(x.textContent)), null, 15000);
    const st = await p.evaluate(() => ({ spinner: !!document.getElementById("masque-status"), alert: ([...document.querySelectorAll("[role=alert]")].map((x) => x.textContent)[0] || "").slice(0, 160) }));
    check(shown && !st.spinner, "/boot/loader-missing/visible-error", "a visible error, no spinner", st);
    await p.close();  // its expected loader error stays on that page (ctx.newPage keeps its own log)
  }

  notes.unshift(`${n} checks`);
  return { verdict: diffs.length ? "fail" : "pass", n, diffs, expectedMissing: [], notes };

  async function moduleGraph(entry) {
    const seen = new Set();
    const queue = [entry];
    const RE = /(?:from\s*|import\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\1/g;
    while (queue.length) {
      const u = queue.shift();
      if (seen.has(u)) continue;
      seen.add(u);
      let src = "";
      try { const res = await fetch(u); if (!res.ok) continue; src = await res.text(); } catch { continue; }
      // Strip comments so prose that mentions a file is not counted as an import.
      src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
      for (const m of src.matchAll(RE)) queue.push(new URL(m[2], u).href);
    }
    return seen;
  }
}
