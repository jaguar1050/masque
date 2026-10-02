#!/usr/bin/env node
// tests/playwright/run.mjs — the cloud test runner (design 03 §8.0, §8.6). Never deployed; the
// user's machine has no Node and runs app/tests/ in a browser instead.
//
//   node app/tests/playwright/run.mjs [--port 8901] [--base http://127.0.0.1:8901/]
//        [--suite a,b] [--quick] [--seed n] [--spec a,b] [--no-server] [--no-exit-code]
//        [--timeout-min 30]
//
// --suite/--quick/--seed are passed to the test page (?suite= ?quick=1 ?seed=). --spec limits
// the run to the named steps: static-tree, pages, test-page, voice, print, upload, editor, or any
// spec file.
//
// Steps: vendor (npm pack into the gitignored .vendor/, ESM shims) → static-tree (the top-level
// entries of app/ and app/tests/, which serve an index.html and so give the browser's static
// suite no listing, must all be in that suite's KNOWN_ENTRIES) → the dev server (started
// over the repository root on --port when nothing answers there) → Chromium with fake media
// devices and the voice stub → the `pages` spec → the test page (waits for
// dataset.masqueTests) → the E2E specs (voice, print, upload, editor, then any other spec
// file found). Writes report.json next to this file, prints the JSON report on stdout, and
// exits non-zero on FAIL or INVALID. Changes nothing under app/ except report.json.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureVendor, pdfText } from "./vendor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const SPECS_DIR = path.join(HERE, "specs");
const REPORT = path.join(HERE, "report.json");
const ARTIFACTS = path.join(HERE, ".vendor", "artifacts");
const VOICE_STUB = path.join(HERE, "voice-stub.js");
const PLANNED_SPECS = [
  { name: "pages", owner: "WP12 + WP13" },
  { name: "voice", owner: "WP8 + WP13" },
  { name: "print", owner: "WP9 + WP13" },
  { name: "upload", owner: "WP12" },
  { name: "editor", owner: "WP11" },
];
const VERDICTS = ["pass", "fail", "invalid"];

function parseArgs(argv) {
  const o = { port: 8901, base: null, suite: null, quick: false, seed: null, spec: null, server: true, exitCode: true, timeoutMin: 30 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--port") o.port = Number(next());
    else if (a === "--base") o.base = next();
    else if (a === "--suite") o.suite = next();
    else if (a === "--quick") o.quick = true;
    else if (a === "--seed") o.seed = next();
    else if (a === "--spec") o.spec = next().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--no-server") o.server = false;
    else if (a === "--no-exit-code") o.exitCode = false;
    else if (a === "--timeout-min") o.timeoutMin = Number(next());
    else if (a === "--help" || a === "-h") { console.error((() => { const l = readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n"); return l.slice(1, l.findIndex((x) => x.startsWith("import "))).join("\n"); })()); process.exit(0); }
    else throw new Error(`unknown argument ${a}`);
  }
  if (!o.base) o.base = `http://127.0.0.1:${o.port}/`;
  if (!o.base.endsWith("/")) o.base += "/";
  return o;
}

const log = (m) => console.error(`[run] ${m}`);

/** Playwright from a local install, NODE_PATH, the scratchpad or the global npm root. */
async function loadPlaywright() {
  try { return await import("playwright"); } catch { /* fall through */ }
  const dirs = [];
  if (process.env.PLAYWRIGHT_MODULE_DIR) dirs.push(process.env.PLAYWRIGHT_MODULE_DIR);
  for (const d of (process.env.NODE_PATH || "").split(path.delimiter)) if (d) dirs.push(d);
  try { dirs.push(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim()); } catch { /* no npm */ }
  for (const dir of dirs) {
    try {
      const req = createRequire(path.join(dir, "noop.js"));
      return await import(pathToFileURL(req.resolve("playwright")).href);
    } catch { /* next */ }
  }
  throw new Error("Playwright not found: install it globally, or set NODE_PATH / PLAYWRIGHT_MODULE_DIR to a node_modules folder that holds it");
}

async function reachable(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer(opts) {
  const probe = new URL("app/tests/index.html", opts.base).href;
  if (await reachable(probe)) return null;
  if (!opts.server) throw new Error(`nothing serves ${probe}; start python3 -m http.server ${opts.port} --directory ${REPO}`);
  const u = new URL(opts.base);
  log(`starting python3 -m http.server ${u.port} over ${REPO}`);
  const child = spawn("python3", ["-m", "http.server", u.port, "--bind", u.hostname, "--directory", REPO], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    if (await reachable(probe)) return child;
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`the dev server did not come up on ${opts.base}`);
}

function normaliseResult(raw, name, owner) {
  if (!raw || typeof raw !== "object") return { name, owner, verdict: "fail", n: 0, diffs: [], expectedMissing: [], notes: ["spec returned no SuiteResult"] };
  const verdict = VERDICTS.includes(raw.verdict) ? raw.verdict : "fail";
  const diffs = Array.isArray(raw.diffs) ? raw.diffs : [];
  const expectedMissing = Array.isArray(raw.expectedMissing) ? raw.expectedMissing : [];
  const notes = (raw.notes || []).map(String);
  let v = verdict;
  if (v === "pass" && (diffs.length || expectedMissing.length)) { v = "fail"; notes.push("differences or missing expected differences reported"); }
  return { name, owner, verdict: v, n: Number.isFinite(raw.n) ? raw.n : 0, diffCount: diffs.length, diffs: diffs.slice(0, 20), expectedMissing, notes };
}

/**
 * app/ and app/tests/ serve an index.html, so the browser `static` suite enumerates their
 * top-level entries from its KNOWN_ENTRIES list and cannot see anything else there (a new page
 * without noindex, a CRLF file). Node can: every real entry must be listed. static.js has no
 * imports, so it is imported as source through a data: URL (no package.json needed).
 */
async function staticTree() {
  const t0 = Date.now();
  const name = "static-tree", owner = "WP13";
  const SKIP_DIR = (d) => d.startsWith(".") || d === "__pycache__" || d === "node_modules";
  try {
    const src = readFileSync(path.join(REPO, "app/tests/suites/static.js"), "utf8");
    const mod = await import(`data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`);
    const known = mod.KNOWN_ENTRIES;
    if (!known || typeof known !== "object") throw new Error("app/tests/suites/static.js does not export KNOWN_ENTRIES");
    const notes = [], unknown = [];
    let n = 0;
    for (const [rel, k] of Object.entries(known)) {
      const dir = path.join(REPO, "app", rel);
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        n += 1;
        if (e.isDirectory()) {
          if (SKIP_DIR(e.name)) continue;
          if (!(k.dirs || []).includes(e.name)) unknown.push(`app/${rel}${e.name}/`);
        } else if (!(k.files || []).includes(e.name)) {
          unknown.push(`app/${rel}${e.name}`);
        }
      }
    }
    notes.push(`${n} top-level entries of ${Object.keys(known).map((r) => `app/${r}`).join(", ")} checked against static.js KNOWN_ENTRIES`);
    for (const u of unknown) notes.push(`unknown entry ${u}: the browser static suite cannot see it; add it to KNOWN_ENTRIES (and the design file list) so its rules apply`);
    return { name, owner, verdict: unknown.length ? "fail" : "pass", n, diffCount: 0, diffs: [], expectedMissing: [], notes, elapsedMs: Date.now() - t0 };
  } catch (err) {
    return { name, owner, verdict: "fail", n: 0, diffCount: 0, diffs: [], expectedMissing: [], notes: [`threw: ${err && err.stack ? err.stack : err}`], elapsedMs: Date.now() - t0 };
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const vendor = ensureVendor({ log: (m) => console.error(`[vendor] ${m}`) });
  const pw = await loadPlaywright();
  const chromium = pw.chromium || (pw.default && pw.default.chromium);
  const server = await ensureServer(opts);
  mkdirSync(ARTIFACTS, { recursive: true });

  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const unrouted = new Set();

  /** A fresh context: CDN routes to the vendored shims, the voice stub, fake media permission. */
  async function newContext() {
    const context = await browser.newContext();
    await context.route((url) => url.hostname === "esm.sh" || url.hostname === "cdn.jsdelivr.net", async (route) => {
      const href = route.request().url();
      const r = vendor.routes[href];
      if (!r) {
        unrouted.add(href);
        await route.fulfill({ status: 404, contentType: "text/plain", body: `not vendored: ${href}` });
        return;
      }
      await route.fulfill({ status: 200, contentType: r.contentType, body: readFileSync(r.file), headers: { "access-control-allow-origin": "*" } });
    });
    await context.addInitScript({ path: VOICE_STUB });
    try { await context.grantPermissions(["microphone"], { origin: new URL(opts.base).origin }); } catch { /* not all builds */ }
    return context;
  }

  function watch(page) {
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });
    page.on("requestfailed", (r) => { if (!r.url().startsWith("blob:")) errors.push(`requestfailed: ${r.url()} ${r.failure() && r.failure().errorText}`); });
    return errors;
  }

  const voiceStub = {
    script: VOICE_STUB,
    call: (page, method, ...args) => page.evaluate(([m, a]) => window.__voiceStub[m](...a), [method, args]),
    read: (page) => page.evaluate(() => {
      const s = window.__voiceStub;
      return { state: s.state, lang: s.lang, starts: s.starts, instances: s.instances.length, live: s.live };
    }),
  };

  async function runSpec(name, owner, file) {
    const t0 = Date.now();
    if (!file) return { name, owner, verdict: "fail", n: 0, diffCount: 0, diffs: [], expectedMissing: [], notes: [`not present: tests/playwright/specs/${name}.mjs`], elapsedMs: 0 };
    let context;
    try {
      const mod = await import(pathToFileURL(file).href);
      if (typeof mod.default !== "function") throw new Error("spec has no default export function (page, ctx)");
      context = await newContext();
      const page = await context.newPage();
      const errors = watch(page);
      const ctx = {
        baseUrl: opts.base,
        appUrl: new URL("app/", opts.base).href,
        routes: vendor.routes,
        voiceStub,
        pdfText: (buf) => pdfText(buf, vendor),
        artifactsDir: ARTIFACTS,
        consoleErrors: errors,
        newPage: async () => { const p = await context.newPage(); watch(p); return p; },
      };
      const raw = await mod.default(page, ctx);
      return { ...normaliseResult(raw, name, owner), elapsedMs: Date.now() - t0 };
    } catch (err) {
      return { name, owner, verdict: "fail", n: 0, diffCount: 0, diffs: [], expectedMissing: [], notes: [`threw: ${err && err.stack ? err.stack : err}`], elapsedMs: Date.now() - t0 };
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  const specFiles = existsSync(SPECS_DIR) ? readdirSync(SPECS_DIR).filter((f) => f.endsWith(".mjs")).sort() : [];
  const specFile = (name) => (specFiles.includes(`${name}.mjs`) ? path.join(SPECS_DIR, `${name}.mjs`) : null);
  const wanted = (name) => !opts.spec || opts.spec.includes(name);
  const results = [];

  // 0. static-tree (Node only; complements the browser static suite)
  if (wanted("static-tree")) results.push(await staticTree());

  // 1. pages
  if (wanted("pages")) results.push(await runSpec("pages", "WP12 + WP13", specFile("pages")));

  // 2. the test page
  let testPage = null;
  if (wanted("test-page")) {
    const t0 = Date.now();
    const context = await newContext();
    const page = await context.newPage();
    const errors = watch(page);
    const q = new URLSearchParams();
    if (opts.suite) q.set("suite", opts.suite);
    if (opts.quick) q.set("quick", "1");
    if (opts.seed) q.set("seed", opts.seed);
    const url = new URL(`app/tests/index.html${q.toString() ? `?${q}` : ""}`, opts.base).href;
    try {
      await page.goto(url, { waitUntil: "load" });
      await page.waitForFunction(() => !!document.documentElement.dataset.masqueTests, null, { timeout: opts.timeoutMin * 60000 });
      const report = await page.evaluate(() => window.__screenairTests || null);
      const health = await page.evaluate(() => ({
        masqueReady: document.documentElement.dataset.masqueReady === "true",
        rootChildren: document.getElementById("root") ? document.getElementById("root").children.length : 0,
      }));
      // The self-check fetches files that later packages add (a suite, a folder); the browser logs
      // each 404 as a console error. They are counted, not treated as an unhealthy page.
      const is404 = (e) => /Failed to load resource: the server responded with a status of 404/.test(e);
      // A check that provokes a console error on purpose (the loader's red panel in a hidden
      // boot frame, harness/foundations.js) declares it first in
      // window.__screenairExpectedConsole = [{prefix, max}]; each declaration absorbs at most
      // `max` errors that start with "console.error: " + prefix. Nothing else is forgiven.
      const expected = (await page.evaluate(() => window.__screenairExpectedConsole || [])).map((x) => ({ ...x, left: x.max || 1 }));
      const isExpected = (e) => {
        const hit = expected.find((x) => x.left > 0 && e.startsWith(`console.error: ${x.prefix}`));
        if (hit) hit.left -= 1;
        return !!hit;
      };
      const real = errors.filter((e) => !is404(e) && !isExpected(e));
      health.consoleClean = real.length === 0;
      health.consoleErrors = real.slice(0, 20);
      health.resource404 = errors.filter(is404).length;
      health.expectedConsole = expected.map((x) => ({ prefix: x.prefix, absorbed: (x.max || 1) - x.left }));
      let verdict = report && VERDICTS.includes(report.verdict) ? report.verdict : "fail";
      const notes = [];
      if (!health.masqueReady || !health.rootChildren) { verdict = verdict === "invalid" ? verdict : "fail"; notes.push("test page not healthy (masqueReady / #root)"); }
      if (!health.consoleClean) { verdict = verdict === "invalid" ? verdict : "fail"; notes.push(`console not clean: ${real.length} error(s)`); }
      testPage = { url, verdict, health, notes, elapsedMs: Date.now() - t0, report };
    } catch (err) {
      testPage = { url, verdict: "fail", health: null, notes: [`threw: ${err && err.stack ? err.stack : err}`, ...errors.slice(0, 20)], elapsedMs: Date.now() - t0, report: null };
    } finally {
      await context.close().catch(() => {});
    }
  }

  // 3. E2E specs
  for (const { name, owner } of PLANNED_SPECS.slice(1)) if (wanted(name)) results.push(await runSpec(name, owner, specFile(name)));
  for (const f of specFiles) {
    const name = f.replace(/\.mjs$/, "");
    if (PLANNED_SPECS.some((p) => p.name === name) || !wanted(name)) continue;
    results.push(await runSpec(name, "?", path.join(SPECS_DIR, f)));
  }

  await browser.close();
  if (server) server.kill();

  const all = [...results.map((r) => r.verdict), ...(testPage ? [testPage.verdict] : [])];
  const verdict = all.includes("invalid") ? "invalid" : all.includes("fail") || !all.length ? "fail" : "pass";
  const out = {
    format: "screenair-playwright-report",
    verdict,
    startedAt: new Date(started).toISOString(),
    elapsedMs: Date.now() - started,
    baseUrl: opts.base,
    options: { suite: opts.suite, quick: opts.quick, seed: opts.seed, spec: opts.spec },
    vendor: vendor.versions,
    unroutedCdnRequests: [...unrouted],
    counts: {
      testSuites: testPage && testPage.report && testPage.report.counts ? testPage.report.counts : null,
      specs: { pass: results.filter((r) => r.verdict === "pass").length, fail: results.filter((r) => r.verdict === "fail").length,
        invalid: results.filter((r) => r.verdict === "invalid").length, total: results.length },
    },
    testPage,
    specs: results,
  };
  writeFileSync(REPORT, JSON.stringify(out, null, 2) + "\n");
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  log(`${verdict.toUpperCase()} — report written to ${path.relative(REPO, REPORT)}`);
  if (opts.exitCode && verdict !== "pass") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 2;
});
