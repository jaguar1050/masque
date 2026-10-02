// tests/harness/runner.js — the screenAIr self-check runner (design 03 §8.0, §8.5, §8.6).
//
// tests/index.html imports the loader natively, builds `env` and calls run(env). The runner
// fetches suites/index.json, loads every listed suite at run time through
// env.loader.importModule (never a literal dynamic import, §6.5), runs each with its own
// harness object `h` and reports a table plus
//   document.documentElement.dataset.masqueTests = "pass" | "fail" | "invalid"
//   window.__screenairTests = the JSON report (read by tests/playwright/run.mjs).
// A suite that is missing or fails to compile is FAIL "not present: <message>"; a suite that
// throws is FAIL with the stack; it never breaks the page.
import { createOracles, sha256HexOf, invalidError } from "./oracles.js";
import { deepDiff } from "./diff.js";
import { renderHook, mount, text } from "./render.js";
import { withFixedClock, withSeededRandom, rng } from "./clock.js";
import { SLICES, cutSlice, wrapSlice, compileSlice } from "./slices.js";

/** mulberry32(0x4D415351) — "MASQ" — is the acceptance seed (§8.5). */
export const DEFAULT_SEED = 0x4D415351;
const FIXED_LOADED_AT = "2026-10-01T12:00:00.000Z";
const REPORT_DIFFS = 20;
const VERDICTS = ["pass", "fail", "invalid"];

function firstLine(msg) {
  return String(msg || "").split("\n")[0];
}

/**
 * The first line of an error message, plus the next non-empty line when the first only
 * introduces it ("Failed to compile <url>:" → the Babel message with its line:col).
 */
function headline(msg) {
  const lines = String(msg || "").split("\n");
  const first = lines[0];
  if (!/:\s*$/.test(first)) return first;
  const next = lines.slice(1).find((l) => l.trim());
  return next ? `${first} ${next.trim()}` : first;
}

function notPresentError(message) {
  const e = new Error(message);
  e.notPresent = true;
  return e;
}

async function fetchOk(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status} for ${url}`);
    e.status = res.status;
    throw e;
  }
  return res;
}

/** Parse the URL options: ?suite=a,b  ?quick=1  ?seed=<int or 0xhex>. */
export function parseOptions(search) {
  const q = new URLSearchParams(search || "");
  const seedText = q.get("seed");
  let seed = DEFAULT_SEED;
  if (seedText) {
    const n = /^0x/i.test(seedText) ? parseInt(seedText, 16) : parseInt(seedText, 10);
    if (Number.isFinite(n)) seed = n >>> 0;
  }
  const suite = q.get("suite");
  return {
    seed,
    quick: q.get("quick") === "1",
    only: suite ? suite.split(",").map((s) => s.trim()).filter(Boolean) : null,
  };
}

const listingCache = new Map();

/**
 * Directory listing as served by `python -m http.server` (the dev server on both machines).
 * Resolves to {files, dirs} (names relative to `dirUrl`), or to null when the server answers
 * with something else, which it does for a folder holding an index.html (app/, app/tests/).
 * Rejects (err.status = 404) when the folder does not exist.
 */
export function listDir(dirUrl) {
  if (!listingCache.has(dirUrl)) {
    listingCache.set(dirUrl, (async () => {
      const res = await fetchOk(dirUrl);
      const type = res.headers.get("content-type") || "";
      if (!type.includes("text/html")) return null;
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      if (!/^Directory listing for /i.test(doc.title || "")) return null;
      const files = [], dirs = [];
      for (const a of doc.querySelectorAll("li > a[href]")) {
        const href = a.getAttribute("href");
        if (!href || href.startsWith("?") || href.startsWith("/") || href.includes("://")) continue;
        const name = decodeURIComponent(href);
        if (name.endsWith("/")) dirs.push(name.slice(0, -1)); else files.push(name);
      }
      return { files, dirs };
    })());
  }
  return listingCache.get(dirUrl);
}

/** Whether `fileUrl` exists, from its folder's listing when there is one (no 404 is logged then). */
export async function fileExists(fileUrl) {
  const u = new URL(fileUrl);
  const dir = u.href.slice(0, u.href.lastIndexOf("/") + 1);
  const name = decodeURIComponent(u.pathname.slice(u.pathname.lastIndexOf("/") + 1));
  try {
    const listing = await listDir(dir);
    if (listing) return listing.files.includes(name);
  } catch (err) {
    if (err.status === 404) return false;
  }
  const res = await fetch(fileUrl, { cache: "no-cache" });
  return res.ok;
}

/**
 * Every file below `rootUrl`, as paths relative to it. `skipDir(relPath)` prunes the walk.
 * A folder that serves an index.html instead of a listing is enumerated from `known[rel]`
 * ({files, dirs}); without an entry there the walk fails, never silently skipping it.
 * Returns {files, unlisted} where `unlisted` names the folders enumerated from `known`.
 */
export async function listTree(rootUrl, { skipDir = () => false, known = {} } = {}) {
  const out = [];
  const unlisted = [];
  const walk = async (rel) => {
    let listing;
    try {
      listing = await listDir(new URL(rel, rootUrl).href);
    } catch (err) {
      if (err.status === 404 && rel) return; // the folder does not exist (yet)
      throw err;
    }
    if (!listing) {
      const k = known[rel];
      if (!k) throw new Error(`no directory listing for ${rel || "./"} (it serves an index.html) and no known entry list`);
      unlisted.push(rel || "./");
      listing = { files: [], dirs: k.dirs || [] };
      for (const f of k.files || []) {
        const res = await fetch(new URL(rel + f, rootUrl).href, { cache: "no-cache" });
        if (res.ok) listing.files.push(f);
      }
    }
    for (const f of listing.files) out.push(rel + f);
    for (const d of listing.dirs) {
      const sub = `${rel}${d}/`;
      if (!skipDir(sub)) await walk(sub);
    }
  };
  await walk("");
  return { files: out.sort(), unlisted };
}

function makeShared(env, options) {
  return {
    env,
    options,
    oracles: createOracles(env),
    builtins: null,
    engineCache: new Map(),
  };
}

function engine(shared, file) {
  const { env } = shared;
  if (!shared.engineCache.has(file)) {
    shared.engineCache.set(file, env.loader.importModule(new URL(`src/engine/${file}`, env.appBase).href));
  }
  return shared.engineCache.get(file);
}

/** The harness object handed to one suite (§8.0). */
function makeHarness(shared, ctx) {
  const { env, options, oracles } = shared;
  const fixturesBase = new URL("tests/fixtures/", env.appBase).href;

  const markInvalid = (err) => {
    if (err && err.invalid) ctx.invalid.push(firstLine(err.message));
    throw err;
  };

  async function loadBuiltins() {
    if (!shared.builtins) {
      shared.builtins = (async () => {
        let registry;
        try {
          registry = await env.loader.importModule(new URL("src/shell/registry.js", env.appBase).href);
        } catch (err) {
          if (/Could not resolve/.test(err.message)) throw notPresentError(`not present: src/shell/registry.js (WP12) — ${firstLine(err.message)}`);
          throw err;
        }
        if (typeof registry.loadBuiltins !== "function") throw notPresentError("not present: registry.loadBuiltins (WP12)");
        return registry.loadBuiltins({ env });
      })();
    }
    return shared.builtins;
  }

  async function fetchFixture(path, as = "json") {
    const res = await fetchOk(new URL(path, fixturesBase).href);
    if (as === "bytes") return new Uint8Array(await res.arrayBuffer());
    if (as === "text") return res.text();
    if (as === "json") return res.json();
    throw new Error(`h.fixture: unknown kind "${as}" (json | text | bytes)`);
  }

  const h = {
    env,
    seed: options.seed,
    quick: options.quick,

    oracle: (file, opts) => oracles.oracle(file, opts).catch(markInvalid),
    reference: (file, opts) => oracles.reference(file, opts).catch(markInvalid),
    baselineText: (file) => oracles.baselineText(file).catch(markInvalid),
    referenceText: (file) => oracles.referenceText(file).catch(markInvalid),
    verifyManifest: () => oracles.verifyManifest(),
    verifyReference: (file) => oracles.verifyReference(file),

    async slice(name) {
      const spec = SLICES[name];
      if (!spec) throw new Error(`unknown slice "${name}"`);
      try {
        const text = await oracles.baselineText(spec.file);
        const slice = cutSlice(text, spec, name);
        const got = await sha256HexOf(slice);
        if (got !== spec.sha256) throw invalidError(`slice ${name}: sha256 ${got.slice(0, 12)}… ≠ pinned ${spec.sha256.slice(0, 12)}…`);
        const fn = compileSlice(wrapSlice(slice, spec), spec.params, window.Babel);
        return { fn, params: spec.params.slice(), text: slice };
      } catch (err) {
        return markInvalid(err);
      }
    },

    renderHook,
    mount,
    text,

    diff(a, b, opts = {}) {
      const r = deepDiff(a, b, opts);
      for (const id of r.observed) ctx.observed.add(id);
      return r;
    },
    expect(adId, { precondition, observed }) {
      ctx.expectations.push({ adId, precondition: !!precondition, observed: !!observed });
      if (precondition && !observed && !ctx.expectedMissing.includes(adId)) ctx.expectedMissing.push(adId);
    },

    withFixedClock,
    withSeededRandom,
    rng,

    async loadBuiltin(id) {
      const entries = await loadBuiltins();
      if (!Array.isArray(entries) || !entries.length) throw new Error("registry.loadBuiltins returned no entries");
      const entry = id == null ? entries[0] : entries.find((e) => e && e.module && e.module.id === id);
      if (!entry) throw new Error(`no built-in module "${id}" (loaded: ${entries.map((e) => e && e.module && e.module.id).join(", ")})`);
      return { module: entry.module, validation: entry.validation, entry };
    },

    /**
     * Bind tests/fixtures/modules/<name>.rubric.json, plus its logic when the rubric binds
     * one: `<logic ?? name>.logic.js`, else `<logicBinding.moduleId>.logic.js`.
     * `meta.origin` is the one classifyLineage assigns (§3.4 step 7, §3.11); `origin` overrides
     * it only when passed explicitly.
     */
    async loadFixture(name, { logic: logicName = null, origin = null, builtins = [], loaded = [] } = {}) {
      const rubricPath = `modules/${name}.rubric.json`;
      const rubricBytes = await fetchFixture(rubricPath, "bytes");
      const rubricText = new TextDecoder("utf-8", { fatal: true }).decode(rubricBytes);
      const rubric = JSON.parse(rubricText);
      let logic = null, logicFile = null;
      const binding = rubric.logicBinding;
      if (binding && typeof binding === "object") {
        const candidates = logicName ? [logicName] : [...new Set([name, binding.moduleId])];
        for (const c of candidates) {
          if (!(await fileExists(new URL(`modules/${c}.logic.js`, fixturesBase).href))) continue;
          const bytes = await fetchFixture(`modules/${c}.logic.js`, "bytes");
          logicFile = { name: `${c}.logic.js`, bytes, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
          break;
        }
        if (!logicFile) throw new Error(`fixture ${name}: no logic file for '${binding.moduleId}' (tried ${candidates.map((c) => c + ".logic.js").join(", ")})`);
        const ns = await env.loader.importSource(logicFile.text, { filename: logicFile.name, byteLength: logicFile.bytes.length });
        logic = ns.default;
      }
      const [bind, validate, lineage] = await Promise.all([engine(shared, "bind.js"), engine(shared, "validate.js"), engine(shared, "lineage.js")]);
      const rubricSha256 = await sha256HexOf(rubricBytes);
      const logicSha256 = logicFile ? await sha256HexOf(logicFile.bytes) : null;
      const classification = await lineage.classifyLineage(rubric, { builtins, loaded, sameUpload: [], logicSha256, contentHash: null });
      const meta = {
        origin: origin != null ? origin : classification && classification.origin,
        classification,
        key: `fixture:${name}`,
        sources: { rubricText, logicText: logicFile ? logicFile.text : null },
        files: {
          rubric: { name: `${name}.rubric.json`, text: rubricText, sha256: rubricSha256 },
          logic: logicFile ? { name: logicFile.name, text: logicFile.text, sha256: logicSha256 } : null,
        },
        loadedAt: FIXED_LOADED_AT,
      };
      const module = await bind.bindModule(rubric, logic, meta);
      const validation = await validate.validateModule({ module, loaded });
      return { module, validation };
    },

    /** A file under tests/fixtures/, fetched (never imported) as "json", "text" or "bytes". */
    fixture: fetchFixture,

    // Conveniences beyond the §8.0 minimum.
    engine: (file) => engine(shared, file),
    appUrl: (path) => new URL(path, env.appBase).href,
    async fetchText(path) { return (await fetchOk(new URL(path, env.appBase).href)).text(); },
    async fetchBytes(path) { return new Uint8Array(await (await fetchOk(new URL(path, env.appBase).href)).arrayBuffer()); },
    sha256: sha256HexOf,
    listDir,
    listTree,
    fileExists,
    get babel() { return window.Babel; },
    note(msg) { ctx.notes.push(String(msg)); },
    /** The result of a skeleton suite whose package has not merged yet. */
    notImplemented(what) {
      return { verdict: "fail", n: 0, diffs: [], expectedMissing: [], notes: [`not implemented: ${what}`] };
    },
  };
  return h;
}

/**
 * A harness object outside a run, for the harness self-checks and ad-hoc debugging in the
 * console: `const {h, ctx} = harnessFor(env)`. ctx collects notes, INVALID reasons, AD
 * expectations and observed ADs exactly as during a run.
 */
export function harnessFor(env, { seed = DEFAULT_SEED, quick = false } = {}) {
  const ctx = { notes: [], invalid: [], expectations: [], expectedMissing: [], observed: new Set() };
  const shared = makeShared(env, { seed, quick, only: null });
  return { h: makeHarness(shared, ctx), ctx };
}

/** Turn whatever a suite returned (or threw) into a well-formed SuiteResult. */
function normalise(raw, ctx) {
  const notes = [...ctx.notes];
  let verdict = "fail";
  let n = 0, diffs = [], expectedMissing = [...ctx.expectedMissing];
  if (!raw || typeof raw !== "object") {
    notes.push("suite returned no SuiteResult");
  } else {
    verdict = VERDICTS.includes(raw.verdict) ? raw.verdict : "fail";
    if (!VERDICTS.includes(raw.verdict)) notes.push(`unknown verdict ${JSON.stringify(raw.verdict)}`);
    n = Number.isFinite(raw.n) ? raw.n : 0;
    diffs = Array.isArray(raw.diffs) ? raw.diffs : [];
    for (const id of raw.expectedMissing || []) if (!expectedMissing.includes(id)) expectedMissing.push(id);
    for (const note of raw.notes || []) notes.push(String(note));
  }
  if (verdict === "pass" && diffs.length) { verdict = "fail"; notes.push(`${diffs.length} unexplained difference(s)`); }
  if (expectedMissing.length && verdict !== "invalid") {
    verdict = "fail";
    notes.push(`expected difference missing: ${expectedMissing.join(", ")}`);
  }
  if (ctx.invalid.length) {
    verdict = "invalid";
    for (const msg of ctx.invalid) if (!notes.includes(msg)) notes.push(msg);
  }
  return { verdict, n, diffs, expectedMissing, notes };
}

async function runSuite(shared, entry, suitesUrl) {
  const { env } = shared;
  const ctx = { notes: [], invalid: [], expectations: [], expectedMissing: [], observed: new Set() };
  const started = performance.now();
  const base = { name: entry.name, owner: entry.owner || "?", path: entry.path };
  let mod;
  const suiteUrl = new URL(entry.path, suitesUrl).href;
  try {
    // Ask the folder listing first, so a suite whose package has not merged costs no 404.
    if (!(await fileExists(suiteUrl).catch(() => true))) throw new Error(`${entry.path} does not exist yet`);
    mod = await env.loader.importModule(suiteUrl);
  } catch (err) {
    return { ...base, verdict: "fail", n: 0, diffs: [], diffCount: 0, expectedMissing: [], observed: [],
      notes: [`not present: ${headline(err.message)}`], elapsedMs: Math.round(performance.now() - started) };
  }
  const suite = mod && mod.default;
  let result;
  if (!suite || typeof suite.run !== "function") {
    result = { verdict: "fail", n: 0, diffs: [], expectedMissing: [], notes: ["malformed suite: no default export with run(h)"] };
  } else {
    if (suite.name !== entry.name) ctx.notes.push(`suite name "${suite.name}" ≠ file stem "${entry.name}"`);
    try {
      const h = makeHarness(shared, ctx);
      result = await suite.run(h);
      if (suite.name !== entry.name && result && result.verdict === "pass") result = { ...result, verdict: "fail" };
    } catch (err) {
      if (err && err.invalid) {
        if (!ctx.invalid.includes(firstLine(err.message))) ctx.invalid.push(firstLine(err.message));
        result = { verdict: "invalid", n: 0, diffs: [], expectedMissing: [], notes: [] };
      } else if (err && err.notPresent) {
        result = { verdict: "fail", n: 0, diffs: [], expectedMissing: [], notes: [firstLine(err.message)] };
      } else {
        result = { verdict: "fail", n: 0, diffs: [], expectedMissing: [], notes: [`threw: ${err && err.stack ? err.stack : String(err)}`] };
      }
    }
  }
  const r = normalise(result, ctx);
  return {
    ...base,
    owner: (suite && suite.owner) || base.owner,
    verdict: r.verdict,
    n: r.n,
    diffCount: r.diffs.length,
    diffs: r.diffs.slice(0, REPORT_DIFFS),
    expectedMissing: r.expectedMissing,
    observed: [...ctx.observed],
    notes: r.notes,
    elapsedMs: Math.round(performance.now() - started),
  };
}

// --------------------------------------------------------------------------- page UI

const CHECKLIST = [
  "(a) screenair.html → Ambient Scribe → Listen; allow the microphone; say “the light really bothers me and I feel sick”. The capture tags appear with “· voice”. Switch to Patient Companion: the microphone stops.",
  "(b) Patient → finish → Print preview of a summary longer than one page: the caveat heads every page and covers no text; in Español the unreviewed banner appears.",
  "(c) Rubric Editor → change one weight → Apply with Create and switch → the Questionnaire URL and code system in the Screener's spec download have changed; Research shows every calibration-dependent figure withheld.",
  "(d) Download all, reload the page (do not click Restore), then Upload the zip: “already loaded” for MASQUE, and the derived module loads as a verified derivation with the “Edited” badge and the population banner.",
  "(e) Open app/patient.html: no tabs, no module menu, no link to the clinician program. Finish the summary, download the .html, open it with the network off: the caveat and the date are there.",
  "(f) Download the MASQUE rubric, change one weight in a text editor, upload it: the dialog offers “Load as a module derived from Dizziness and Sinusitis (MASQUE v1)”, and the result's instrument version carries a -local suffix.",
];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v; else if (k === "text") node.textContent = v; else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function buildPage(root, options) {
  root.textContent = "";
  const wrap = el("div", { className: "t-wrap" });
  wrap.append(
    el("h1", { text: "screenAIr self-check" }),
    el("p", { className: "t-sub", text: "Local only (design 03 §8). Parity suites against the frozen baseline (tests/baseline/src) and reference/fixed-src. ?suite=<name>[,<name>] runs a subset; ?quick=1 runs the short sweeps; ?seed=<n> explores another seed (the default seed is the acceptance run)." }),
    el("p", { className: "t-sub", text: `seed ${options.seed} (0x${options.seed.toString(16).toUpperCase()})${options.quick ? " · quick" : ""}${options.only ? " · suites: " + options.only.join(", ") : ""}` }),
  );
  const summary = el("div", { className: "t-summary", id: "t-summary", text: "Running…" });
  wrap.append(el("div", { className: "t-card" }, summary));
  const tbody = el("tbody", { id: "t-rows" });
  const table = el("table", {},
    el("thead", {}, el("tr", {}, ...["Suite", "Owner", "Verdict", "N", "ms", "Detail"].map((t) => el("th", { text: t })))),
    tbody);
  wrap.append(el("div", { className: "t-card" }, table));
  const ol = el("ol", {});
  for (const item of CHECKLIST) ol.append(el("li", { text: item }));
  wrap.append(el("div", { className: "t-card", "data-testid": "manual-checklist" },
    el("h2", { text: "Manual acceptance on the user's machine (§8.6)" }),
    el("p", { className: "t-sub", text: "Run once on the final build, from http://127.0.0.1:8901/app/ (python -m http.server over the project root)." }),
    ol));
  wrap.append(el("div", { className: "t-proto", text: "Prototype · not for clinical use" }));
  root.append(wrap);
  return { summary, tbody };
}

function rowFor(tbody, entry) {
  const tr = el("tr", { "data-suite": entry.name });
  tr.append(el("td", { text: entry.name }), el("td", { text: entry.owner || "" }),
    el("td", { className: "t-run", text: "…" }), el("td"), el("td"), el("td"));
  tbody.append(tr);
  return tr;
}

function fillRow(tr, r) {
  const cells = tr.children;
  cells[1].textContent = r.owner;
  cells[2].textContent = r.verdict.toUpperCase();
  cells[2].className = `t-${r.verdict}`;
  cells[3].textContent = String(r.n);
  cells[4].textContent = String(r.elapsedMs);
  const detail = cells[5];
  detail.textContent = "";
  for (const note of r.notes) detail.append(el("div", { className: "t-note", text: note }));
  if (r.diffCount) {
    const pre = el("pre", { text: r.diffs.map((d) => `${d.path === "" ? "(root)" : d.path}\n  a: ${JSON.stringify(d.a)}\n  b: ${JSON.stringify(d.b)}\n  input: ${JSON.stringify(d.input)}`).join("\n") });
    detail.append(el("details", {}, el("summary", { text: `${r.diffCount} difference(s)${r.diffCount > REPORT_DIFFS ? `, first ${REPORT_DIFFS}` : ""}` }), pre));
  }
}

/**
 * Run every listed suite (or the ?suite= subset) and report.
 * @param {{loader: {importModule: Function, importSource: Function, inspectSource: Function}, appBase: string}} env
 * @param {{search?: string, root?: HTMLElement}} [opts]
 */
export async function run(env, { search = location.search, root = document.getElementById("root") } = {}) {
  const options = parseOptions(search);
  const started = performance.now();
  const startedAt = new Date().toISOString();
  const { summary, tbody } = buildPage(root, options);
  document.documentElement.dataset.masqueReady = "true";

  const suitesUrl = new URL("tests/suites/index.json", env.appBase).href;
  let list;
  try {
    const index = await (await fetchOk(suitesUrl)).json();
    list = index.suites;
    if (!Array.isArray(list)) throw new Error("suites/index.json has no suites array");
  } catch (err) {
    summary.textContent = `Cannot read suites/index.json: ${err.message}`;
    summary.className = "t-summary t-fail";
    const report = { verdict: "fail", error: err.message, suites: [] };
    window.__screenairTests = report;
    document.documentElement.dataset.masqueTests = "fail";
    return report;
  }
  if (options.only) {
    const unknown = options.only.filter((n) => !list.some((s) => s.name === n));
    list = list.filter((s) => options.only.includes(s.name));
    for (const name of unknown) list.push({ name, path: `${name}.js`, owner: "?" });
  }

  const shared = makeShared(env, options);
  const rows = list.map((entry) => rowFor(tbody, entry));
  const results = [];
  for (let i = 0; i < list.length; i++) {
    summary.textContent = `Running ${list[i].name} (${i + 1}/${list.length})…`;
    const r = await runSuite(shared, list[i], suitesUrl);
    results.push(r);
    fillRow(rows[i], r);
  }

  const count = (v) => results.filter((r) => r.verdict === v).length;
  const verdict = count("invalid") ? "invalid" : count("fail") ? "fail" : "pass";
  const report = {
    format: "screenair-test-report",
    verdict,
    seed: options.seed,
    quick: options.quick,
    only: options.only,
    startedAt,
    elapsedMs: Math.round(performance.now() - started),
    counts: { pass: count("pass"), fail: count("fail"), invalid: count("invalid"), total: results.length },
    suites: results,
  };
  summary.textContent = `${verdict.toUpperCase()} — ${report.counts.pass} pass · ${report.counts.fail} fail · ${report.counts.invalid} invalid of ${results.length} suites · ${report.elapsedMs} ms`;
  summary.className = `t-summary t-${verdict}`;
  window.__screenairTests = report;
  document.documentElement.dataset.masqueTests = verdict;
  return report;
}
