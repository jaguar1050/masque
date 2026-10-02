// tests/playwright/specs/print.mjs — printing and saving the Patient summary, end to end
// (design 03 §8.3 `print`, §5.5, §5.10, §9.10). Owner: WP9 (+ WP13 runner). Cloud runner only.
//
// A Patient summary long enough for at least two pages (every flag ticked, every item answered,
// every context question answered) is printed with page.pdf() and read back with ctx.pdfText.
// On every page the caveat header must be the topmost text, read exactly
// "Prototype · not for clinical use" (+ " · Traducción sin revisar" for unreviewed es, + the
// patient provenance marker for a non-built-in), and no other text item's box may intersect
// the header's box (nothing printed under it). In es the unreviewed banner is on page 1.
//
// Targets:
//   dev        tests/dev/patient.html (the component inside the shell's PrintFrame, header
//              filled from onPrintContext): en, es, and a verified derivation (?derived=1);
//   export     the .html download from the dev page, en and es: saved, opened from disk with the
//              network off (no request but the file itself), caveat + date (+ es banner) shown,
//              then printed with the same per-page checks;
//   media      emulateMedia("print") on the dev summary: the dev bar, the Patient header, the
//              progress and the action row hidden; no OMISSION_PATTERNS match and no clinician
//              flag text in the printed DOM;
//   shell      screenair.html Patient tab, patient.html, and the Screener result on
//              screenair.html. The Patient targets need WP12-M2 (the shell and patient.html
//              mounting apps/PatientCompanion.jsx); until then they are reported as waiting
//              (FAIL, never a vacuous PASS). With emulateMedia("print") on the shell, the tab bar
//              and the header controls are hidden.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "../../..");

/** engine/policy.js has no imports: load it as source (no package.json needed). */
async function loadPolicy() {
  const src = readFileSync(path.join(APP, "src/engine/policy.js"), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`);
}

const squash = (s) => String(s).replace(/\s+/g, "");

export default async function print(page, ctx) {
  const diffs = [];
  const notes = [];
  let n = 0;
  const check = (ok, p, a, b) => { n += 1; if (!ok) diffs.push({ path: p, input: null, a, b }); return ok; };
  const policy = await loadPolicy();
  const CAV = policy.CAVEATS;
  const P = CAV.prototype;
  const ES = CAV.unreviewed.es;
  const rubric = await (await fetch(new URL("app/modules/masque/masque.rubric.json", ctx.baseUrl))).json();
  const flagStrings = (rubric.redFlags || []).flatMap((f) => [f.text, f.points, f.action]).filter(Boolean);
  const out = path.join(ctx.artifactsDir, "print");
  mkdirSync(out, { recursive: true });

  const ready = async (p, url) => {
    await p.goto(url, { waitUntil: "load" });
    await p.waitForFunction(() => document.documentElement.dataset.masqueReady === "true", null, { timeout: 60000 });
  };
  const devUrl = (q = "") => new URL(`app/tests/dev/patient.html${q}`, ctx.baseUrl).href;

  /** Walk the mounted Patient Companion to its summary with everything ticked and answered. */
  async function fillPatient(p, loc) {
    await p.waitForSelector("[data-testid=patient-app] .mp .wrap", { timeout: 30000 });
    const r = await p.evaluate(async (loc) => {
      const tick = () => new Promise((res) => setTimeout(res, 0));
      const wrap = document.querySelector("[data-testid=patient-app] .mp .wrap");
      if (loc !== "en") {
        const b = wrap.querySelector(`.top .opts button[lang="${loc}"]`);
        if (!b) return `no ${loc} button`;
        b.click(); await tick();
      }
      const next = () => { const bs = wrap.querySelectorAll(":scope > .nav button"); return bs[bs.length - 1] || null; };
      next().click(); await tick();
      for (const f of wrap.querySelectorAll(":scope > .card .flag")) { f.click(); await tick(); }
      for (let guard = 0; guard < 40; guard++) {
        const nb = next();
        if (!nb) break;
        if (nb.disabled) return "a step could not be left";
        nb.click(); await tick();
        const card = wrap.querySelector(":scope > .card");
        if (!card || card.dataset.section === "summary") break;
        for (const q of card.querySelectorAll(".q")) {
          const bs = [...q.querySelectorAll(".opts button")];
          const bool = !!q.querySelector(".o.unsure");
          const b = bool ? bs[0] : bs[bs.length - 1];
          if (b && !b.classList.contains("sel")) { b.click(); await tick(); }
        }
      }
      return wrap.querySelector('[data-testid="patient-download-html"]') ? "ok" : "no summary";
    }, loc);
    return r;
  }

  /** page.pdf() and the per-page header checks. */
  async function pdfChecks(p, label, { header, page1 = [], minPages = 2 }) {
    const buf = await p.pdf({ format: "Letter", printBackground: false });
    writeFileSync(path.join(out, `${label.replace(/[^a-z0-9-]+/gi, "_")}.pdf`), buf);
    const pages = await ctx.pdfText(buf);
    check(pages.length >= minPages, `/${label}/pages`, `>= ${minPages}`, pages.length);
    const want = squash(header);
    pages.forEach((pg, i) => {
      const at = `/${label}/page${pg.page}`;
      const items = pg.items.slice().sort((x, y) => x.y - y.y || x.x - y.x);
      if (!items.length) { check(false, at, "text", "an empty page"); return; }
      const top = items[0];
      const row = items.filter((it) => Math.abs(it.y - top.y) < 2.5 && Math.abs(it.h - top.h) < 2.5).sort((x, y) => x.x - y.x);
      const rowText = row.map((it) => it.str).join("");
      check(squash(rowText) === want, `${at}/header`, header, rowText);
      const box = row.reduce((b, it) => ({ x0: Math.min(b.x0, it.x), y0: Math.min(b.y0, it.y), x1: Math.max(b.x1, it.x + it.w), y1: Math.max(b.y1, it.y + it.h) }),
        { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
      const eps = 0.25;
      const under = items.filter((it) => !row.includes(it)
        && it.x < box.x1 - eps && it.x + it.w > box.x0 + eps && it.y < box.y1 - eps && it.y + it.h > box.y0 + eps);
      check(!under.length, `${at}/nothing-under-header`, "no text item intersects the header", under.slice(0, 3).map((it) => it.str));
      if (i === 0) {
        const all = squash(items.map((it) => it.str).join(""));
        for (const s of page1) check(all.includes(squash(s)), `${at}/has`, s, "absent on page 1");
      }
    });
    notes.push(`${label}: ${pages.length} pages`);
    return pages;
  }

  /** The visible text of the page under print media (innerText honours display:none). */
  async function printedText(p, selector = "body") {
    await p.emulateMedia({ media: "print" });
    const t = await p.evaluate((sel) => (document.querySelector(sel) || document.body).innerText, selector);
    await p.emulateMedia({ media: null });
    return t;
  }

  function omissionChecks(label, text) {
    for (const s of flagStrings) check(!text.includes(s), `/${label}/@flagText`, "absent", s);
    for (const re of policy.OMISSION_PATTERNS) {
      const m = re.exec(text);
      check(!m, `/${label}/@pattern`, `no match for ${re}`, m && text.slice(Math.max(0, m.index - 40), m.index + 40));
    }
  }

  // ------------------------------------------------------------------ dev page: en, es, derived
  const dev = [
    { label: "dev-en", q: "", loc: "en", header: P, page1: [] },
    { label: "dev-es", q: "", loc: "es", header: `${P} · ${ES.title}`, page1: [ES.title, ES.body.slice(0, 40)] },
    { label: "dev-derived-en", q: "?derived=1", loc: "en", header: `${P} · ${CAV.patient.edited.short}`, page1: [CAV.patient.edited.en, CAV.editedWording.en] },
    { label: "dev-derived-es", q: "?derived=1", loc: "es", header: `${P} · ${ES.title} · ${CAV.patient.edited.short}`, page1: [ES.title, CAV.patient.edited.en, CAV.staleTranslation.en] },
  ];
  const exportsDone = {};
  for (const d of dev) {
    await ready(page, devUrl(d.q));
    const r = await fillPatient(page, d.loc);
    if (!check(r === "ok", `/${d.label}/fill`, "ok", r)) continue;
    const domHeader = await page.textContent(".sa-print-head td");
    check(domHeader === d.header, `/${d.label}/print-head`, d.header, domHeader);
    const pcs = await page.evaluate(() => window.__patientDev.printContexts);
    const last = pcs[pcs.length - 1] || {};
    check(last.loc === d.loc, `/${d.label}/onPrintContext/loc`, d.loc, last);
    if (d.q) check(d.loc === "es" ? last.stale === true : last.editedLocally === true, `/${d.label}/onPrintContext/notices`, d.loc === "es" ? "stale" : "editedLocally", last);
    await pdfChecks(page, d.label, { header: d.header, page1: d.page1 });

    if (!d.q) {
      // Print media: chrome hidden, nothing score-like or clinician-only printed.
      const t = await printedText(page);
      omissionChecks(`${d.label}/media`, t);
      await page.emulateMedia({ media: "print" });
      const inPrint = await page.evaluate(() => {
        const vis = (sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== "none" && el.getClientRects().length > 0; };
        return Object.fromEntries([".dev-pat-bar", "[data-testid=patient-header]", "[data-testid=patient-summary-actions]", "[data-testid=patient-footer]", "[data-testid=patient-banner]", ".sa-print-head"].map((s) => [s, vis(s)]));
      });
      await page.emulateMedia({ media: null });
      for (const s of [".dev-pat-bar", "[data-testid=patient-header]", "[data-testid=patient-summary-actions]", "[data-testid=patient-footer]"]) check(inPrint[s] === false, `/${d.label}/media/hidden${s}`, "hidden in print", inPrint[s]);
      check(inPrint[".sa-print-head"] === true, `/${d.label}/media/print-head`, "shown in print", inPrint[".sa-print-head"]);
      if (d.loc === "es") check(inPrint["[data-testid=patient-banner]"] === true, `/${d.label}/media/banner-printed`, true, inPrint["[data-testid=patient-banner]"]);

      // The .html export, saved and opened from disk with the network off.
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-testid=patient-download-html]")]);
      const name = dl.suggestedFilename();
      const file = path.join(out, `${d.label}-${name}`);
      await dl.saveAs(file);
      const html = readFileSync(file, "utf8");
      check(/\.html$/.test(name), `/${d.label}/export/name`, "*.html", name);
      check(!/<script|https?:\/\/|@import|url\(/i.test(html), `/${d.label}/export/inert`, "no script, no URL", "found");
      const [dlt] = await Promise.all([page.waitForEvent("download"), page.click("[data-testid=patient-download-txt]")]);
      const txt = readFileSync(await dlt.path(), "utf8");
      const lastLine = txt.split("\n").pop();
      check(/^Prototype · not for clinical use · \d{4}-\d{2}-\d{2}$/.test(lastLine), `/${d.label}/export/txt/dated`, "Prototype · not for clinical use · YYYY-MM-DD", lastLine);
      check(/\.txt$/.test(dlt.suggestedFilename()), `/${d.label}/export/txt/name`, "*.txt", dlt.suggestedFilename());
      exportsDone[d.loc] = { file, header: d.header, page1: d.page1 };
    }
  }

  // ------------------------------------------------------------------ export: offline open + print
  for (const [loc, e] of Object.entries(exportsDone)) {
    const label = `export-${loc}`;
    const p = await ctx.newPage();
    const context = p.context();
    const requests = [];
    p.on("request", (r) => requests.push(r.url()));
    await context.setOffline(true);
    try {
      const url = pathToFileURL(e.file).href;
      await p.goto(url, { waitUntil: "load" });
      await p.waitForTimeout(300);
      const others = requests.filter((u) => u !== url);
      check(others.length === 0, `/${label}/offline/requests`, "no request but the file", others.slice(0, 5));
      const text = await p.evaluate(() => document.body.innerText);
      check(text.includes(P), `/${label}/caveat`, P, "absent");
      check(/\d{4}-\d{2}-\d{2}/.test(text), `/${label}/date`, "a YYYY-MM-DD date", "absent");
      if (loc === "es") check(text.includes(ES.title) && text.includes(ES.body), `/${label}/banner`, ES.title, "absent");
      const robots = await p.getAttribute("meta[name=robots]", "content").catch(() => null);
      check(robots === "noindex, nofollow", `/${label}/robots`, "noindex, nofollow", robots);
      check(await p.evaluate(() => document.scripts.length) === 0, `/${label}/no-scripts`, 0, await p.evaluate(() => document.scripts.length));
      omissionChecks(`${label}/text`, text);
      await pdfChecks(p, label, { header: e.header, page1: e.page1 });
    } finally {
      await context.setOffline(false);
      await p.close();
    }
  }

  // ------------------------------------------------------------------ shell targets
  const shellUrl = new URL("app/screenair.html", ctx.baseUrl).href;
  const patientUrl = new URL("app/patient.html", ctx.baseUrl).href;
  const waiting = [];

  // screenair.html → Patient Companion tab.
  try {
    await ready(page, shellUrl);
    await page.click('nav.sa-tabs [data-tab="patient"]');
    const generic = await page.waitForSelector(".sa-shell [data-testid=patient-app]", { timeout: 8000 }).then(() => true, () => false);
    if (!generic) {
      const ms = await page.evaluate(() => (document.querySelector(".sa-shell") || {}).dataset?.milestone || "?");
      waiting.push(`screenair.html Patient tab (shell milestone ${ms} mounts the legacy Patient)`);
    } else {
      for (const loc of ["en", "es"]) {
        if (loc === "es") { await ready(page, shellUrl); await page.click('nav.sa-tabs [data-tab="patient"]'); }
        const r = await fillPatient(page, loc);
        if (!check(r === "ok", `/shell-patient-${loc}/fill`, "ok", r)) continue;
        const header = loc === "es" ? `${P} · ${ES.title}` : P;
        const head = await page.textContent(".sa-print-head td").catch(() => null);
        check(head === header, `/shell-patient-${loc}/print-head`, header, head);
        await pdfChecks(page, `shell-patient-${loc}`, { header, page1: loc === "es" ? [ES.title] : [] });
        const t = await printedText(page);
        omissionChecks(`shell-patient-${loc}/media`, t);
      }
      await page.emulateMedia({ media: "print" });
      const chrome = await page.evaluate(() => {
        const vis = (sel) => [...document.querySelectorAll(sel)].some((el) => getComputedStyle(el).display !== "none" && el.getClientRects().length > 0);
        return { tabs: vis(".sa-tabs"), controls: vis(".sa-top .sa-controls") };
      });
      await page.emulateMedia({ media: null });
      check(!chrome.tabs && !chrome.controls, "/shell-patient/media/chrome-hidden", "tabs and header controls hidden", chrome);
    }
  } catch (err) {
    check(false, "/shell-patient", "the Patient tab", String(err.message).split("\n")[0]);
  }

  // patient.html (the at-home page).
  try {
    await ready(page, patientUrl);
    const generic = await page.waitForSelector("[data-testid=patient-app]", { timeout: 8000 }).then(() => true, () => false);
    if (!generic) {
      waiting.push("patient.html (still boots the legacy Patient file)");
    } else {
      for (const loc of ["en", "es"]) {
        if (loc === "es") await ready(page, patientUrl);
        const r = await fillPatient(page, loc);
        if (!check(r === "ok", `/patient-page-${loc}/fill`, "ok", r)) continue;
        const header = loc === "es" ? `${P} · ${ES.title}` : P;
        await pdfChecks(page, `patient-page-${loc}`, { header, page1: loc === "es" ? [ES.title] : [] });
        omissionChecks(`patient-page-${loc}/media`, await printedText(page));
      }
    }
  } catch (err) {
    check(false, "/patient-page", "patient.html", String(err.message).split("\n")[0]);
  }

  // The Screener result on screenair.html (the shell's print frame around a clinician tab).
  try {
    await ready(page, shellUrl);
    await page.click('nav.sa-tabs [data-tab="screener"]');
    await page.waitForSelector(".sa-shell .mq", { timeout: 15000 });
    const reached = await page.evaluate(async () => {
      const tick = () => new Promise((res) => setTimeout(res, 30));
      const mq = document.querySelector(".sa-shell .mq");
      const sample = mq.querySelector(".banner button");
      if (!sample) return "no sample button";
      sample.click(); await tick();
      for (let i = 0; i < 12; i++) {
        if (mq.querySelector(".card .meter") || /result/i.test((mq.querySelector(".rail .seg.on, .rail .seg.cur") || {}).textContent || "")) break;
        const bs = [...mq.querySelectorAll(".mq-wrap > .nav button")];
        const nb = bs[bs.length - 1];
        if (!nb || nb.disabled) break;
        nb.click(); await tick();
      }
      return mq.querySelector(".card .meter") ? "ok" : "no result card";
    });
    if (check(reached === "ok", "/shell-screener/result", "ok", reached)) {
      const generic = await page.evaluate(() => !!document.querySelector(".sa-shell .sa-screener"));
      notes.push(`shell-screener: ${generic ? "generic apps/Screener.jsx" : "legacy Screener (M1 shell)"}`);
      await pdfChecks(page, "shell-screener", { header: P, minPages: 1 });
      await page.emulateMedia({ media: "print" });
      const chrome = await page.evaluate(() => {
        const vis = (sel) => [...document.querySelectorAll(sel)].some((el) => getComputedStyle(el).display !== "none" && el.getClientRects().length > 0);
        return { tabs: vis(".sa-tabs"), controls: vis(".sa-top .sa-controls") };
      });
      await page.emulateMedia({ media: null });
      check(!chrome.tabs && !chrome.controls, "/shell-screener/media/chrome-hidden", "tabs and header controls hidden", chrome);
    }
  } catch (err) {
    check(false, "/shell-screener", "the Screener result", String(err.message).split("\n")[0]);
  }

  for (const w of waiting) diffs.push({ path: "/shell", input: null, a: "mounts apps/PatientCompanion.jsx", b: `waits on WP12-M2: ${w}` });
  if (waiting.length) notes.push(`waiting on WP12-M2: ${waiting.join("; ")}`);
  check(ctx.consoleErrors.length === 0, "/console", "clean", ctx.consoleErrors.slice(0, 5));
  return { verdict: diffs.length ? "fail" : "pass", n, diffs, expectedMissing: [], notes };
}
