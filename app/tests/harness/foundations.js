// tests/harness/foundations.js — the WP0 loader and foundations checks, folded from
// tests/loader-check.html into the integrity suite (design 03 §9.1 done-when 1-9, F7).
//
// foundationChecks(h) runs every check of the old page against the page's own loader
// (h.env.loader) and returns {results: [{dw, label, pass, detail, ms}], waiting}, where `dw` is
// the §9.1 done-when number and `waiting` lists engine files still carrying their WP0 stub.
// The boot checks run in hidden frames of tests/loader-check.html?mode=…, which stays the frame
// host, so a deliberately failing boot paints its red panel there and never on the test page.
// The fixtures stay under tests/loader-check/ (sources are fetched as data, never imported).
import React from "react";
import { createRoot } from "react-dom/client";

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg}: expected ${sb}, got ${sa}`);
}
function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: no result after ${ms} ms (hang)`)), ms); }),
  ]);
}
async function rejects(promise, label) {
  try { await promise; } catch (err) { return err; }
  throw new Error(`${label}: expected a rejection, got success`);
}
function hex(buf) { return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join(""); }

const ENGINE_EXPORTS = {
  'contract.js': ['CONTRACT_VERSION', 'FORMAT', 'SUPPORTED_LOCALES', 'LOGIC_PATHS', 'IDENTITY_TEMPLATE_FIELDS', 'KIN_FIELDS', 'RUBRIC_KEYS', 'COPY_SLOTS'],
  'vocab.js': ['BANDS', 'LOWEST_BAND', 'HIGHEST_BAND', 'INDETERMINATE', 'BAND_INTERP', 'TIERS', 'TIER_RANK', 'ANSWER', 'CAPTURE_KIND', 'PROBE_KIND', 'PROBE_KIND_ORDER', 'STEP_KIND', 'isAnswered', 'normalizeAnswer'],
  'policy.js': ['APP_VERSION', 'SITE', 'CAVEATS', 'LIMITS', 'LOCALE_NAMES', 'OMISSION_PATTERNS'],
  'hash.js': ['sha256Hex', 'sha256HexSync', 'canonicalJson', 'utf8Bytes', 'djb2', 'hashProjections', 'rubricHashes'],
  'css.js': ['scopeCss'],
  'download.js': ['downloadText', 'downloadJsonFile', 'downloadBytes', 'fhirHtml'],
  'prng.js': ['mulberry32', 'pick'],
  'scoring.js': ['scoreItem', 'itemBounds', 'bandFor', 'computeScore', 'scaleMaxOf', 'negativeMinOf', 'bandRangeText', 'meterZones', 'meterTicks', 'negativeValueOf'],
  'evaluate.js': ['evaluateRules', 'renderTpl'],
  'rules.js': ['buildRoutingState', 'routingRecs', 'buildPhenotypeState', 'derivePhenotype', 'activeDomains', 'gapSignals', 'referralFor', 'cdsPreview'],
  'gates.js': ['safetyGate', 'routingGate', 'signGate', 'coverageGate', 'referralGate', 'calibrationGate'],
  'bind.js': ['bindModule', 'renderIdentity', 'deepFreeze', 'parseRubricText', 'serializeRubric'],
  'lineage.js': ['ancestorRecord', 'kinOf', 'familyOf', 'classifyLineage', 'checkVersionFamily', 'provenanceLines', 'availability'],
  'generic.js': ['GENERIC_LOGIC', 'ENGINE_COPY_DEFAULTS', 'defaultScreenerSteps', 'defaultPatientSteps', 'DEFAULT_DEMO_PATIENT', 'DEFAULT_FHIR'],
  'validate.js': ['validateModule', 'validateRubricShape', 'formatReport'],
  'fhir.js': ['buildQuestionnaire', 'buildCdsHooks', 'buildDataDictionary', 'buildBundle'],
  'cohort.js': ['CANONICAL_FIELDS', 'subjectPseudonym', 'screenToCohortRow', 'rowsToCsv', 'cohortColumnsCsv', 'makeCohort'],
  'extraction.js': ['EXTRACTOR_KIND', 'createExtractor', 'extract', 'firstHit', 'allHits', 'cueBefore', 'faersToUtterances'],
  'probes.js': ['liveProbes', 'validateProbes', 'truncateProbes'],
  'scribe.js': ['ingestCaptures', 'rankSuggestions', 'captureLabel', 'itemShort', 'buildNote'],
  'patient.js': ['PATIENT_CHROME', 'TIER_DISPLAY', 'GRAMMAR', 'projectForPatient', 'localeText', 'buildPatientSummary', 'askForm', 'joinList', 'summaryText', 'summaryHtml', 'richText'],
  'derive.js': ['createDraft', 'diffRubrics', 'classifyChanges', 'lockedPaths', 'acknowledgePaths', 'proposeIdentity', 'deriveRubric'],
  'zip.js': ['crc32', 'zipStore', 'unzip'],
  'exportAll.js': ['buildExportFiles', 'README_TEXT'],
};
const STUB_OWNER = {
  'scoring.js': 'WP3', 'evaluate.js': 'WP3', 'rules.js': 'WP3', 'gates.js': 'WP3', 'bind.js': 'WP3', 'lineage.js': 'WP3',
  'generic.js': 'WP3', 'validate.js': 'WP3', 'fhir.js': 'WP4', 'cohort.js': 'WP4', 'extraction.js': 'WP5', 'probes.js': 'WP5',
  'scribe.js': 'WP5', 'patient.js': 'WP6', 'derive.js': 'WP11', 'zip.js': 'WP11', 'exportAll.js': 'WP11',
};

const SCOPE_TARGETS = [
  { name: 'screener', file: 'MASQUE_Screener_v0_3.jsx', root: '.sa-screener' },
  { name: 'scribe', file: 'MASQUE_Scribe_v0_3.jsx', root: '.sa-scribe' },
  { name: 'population', file: 'MASQUE_Population.jsx', root: '.sa-pop' },
];

// ------------------------------------------------------------------------ checks

export async function foundationChecks(h) {
  const { importModule: loaderImport, importSource, inspectSource } = h.env.loader;
  const testsUrl = h.appUrl("tests/");
  const appBase = h.env.appBase;
  const at = (p) => new URL(p, testsUrl).href;
  const importModule = (spec, opts) => loaderImport(at(spec), opts);
  const text = async (path) => {
    const res = await fetch(at(path), { cache: "no-cache" });
    if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
    return res.text();
  };
  const bytes = async (path) => {
    const res = await fetch(at(path), { cache: "no-cache" });
    if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
  // Source fixtures are data: fetched as bytes, decoded, never imported by path (design §8.0).
  const source = async (name) => {
    const b = await bytes(`./loader-check/sources/${name}`);
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(b), byteLength: b.length };
  };
  const frame = (modeName) => new Promise((resolve) => {
    const f = document.createElement("iframe");
    f.style.cssText = "width:1px;height:1px;border:0;position:absolute;left:-9999px";
    f.src = at(`loader-check.html?mode=${modeName}`);
    const started = performance.now();
    const poll = setInterval(() => {
      const d = f.contentDocument;
      const alert = d && d.querySelector("[role=alert]");
      const ready = d && d.documentElement.dataset.masqueReady === "true";
      const out = d && d.getElementById("props-out");
      if (alert || (ready && out) || performance.now() - started > 20000) {
        clearInterval(poll);
        const r = { alert: alert ? alert.textContent : null, ready: !!ready, props: out ? out.textContent : null,
          marker: out ? out.dataset.marker : null, timedOut: !alert && !(ready && out) };
        f.remove();
        resolve(r);
      }
    }, 25);
    document.body.appendChild(f);
  });
  const results = [];
  const waiting = [];
  // A boot that fails on purpose logs the loader's error to the console of its frame; the
  // cloud runner forgives exactly these (playwright/run.mjs, window.__screenairExpectedConsole).
  const expectConsole = (prefix, max = 1) => { (window.__screenairExpectedConsole ||= []).push({ prefix, max }); };
  async function check(dw, label, fn) {
    const t0 = performance.now();
    let pass = false, detail = "";
    try {
      const out = await fn();
      pass = true;
      detail = out === undefined ? "" : typeof out === "string" ? out : JSON.stringify(out);
    } catch (err) {
      detail = String((err && err.message) || err);
    }
    results.push({ dw, label, pass, detail, ms: Math.round(performance.now() - t0) });
  }
  const H = await importModule('../src/engine/hash.js');
  const { mulberry32 } = await importModule('../src/engine/prng.js');

  // ---- 1: the baseline manifest verifies in the browser
  await check('1', 'baseline MANIFEST.sha256 verifies (crypto.subtle and sha256HexSync)', async () => {
    const manifest = (await text('./baseline/MANIFEST.sha256')).trim().split('\n');
    eq(manifest.length, 11, 'manifest entries');
    for (const line of manifest) {
      const m = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
      assert(m, `bad manifest line: ${line}`);
      const b = await bytes(`./baseline/${m[2]}`);
      const sync = H.sha256HexSync(b);
      const sub = hex(await crypto.subtle.digest('SHA-256', b));
      assert(sync === m[1] && sub === m[1], `${m[2]}: manifest ${m[1].slice(0, 12)}…, subtle ${sub.slice(0, 12)}…, sync ${sync.slice(0, 12)}…`);
    }
    return `${manifest.length} files match`;
  });

  // ---- 2: importSource
  const ok = await source('ok-logic.txt');
  await check('2', 'importSource runs a closure-bearing, non-ASCII module from its original bytes', async () => {
    const ns = await importSource(ok.text, { filename: 'ok-logic.js', byteLength: ok.byteLength, maxBytes: 512000 });
    const L = ns.default;
    eq(L.format, 'screenair-logic', 'format');
    eq(L.label, 'Prueba de vértigo — ñandú ✓', 'non-ASCII string');
    eq(L.sum.en.greet('Ana'), 'Hello Ana — Bárány, señor, 100 % ✓', 'closure output');
    const state = { yes: (id) => id === 'item_a', scale: (id) => (id === 'item_b' ? 2 : null) };
    eq(L.when(state), true, 'closure call');
    const whenSrc = L.when.toString(), greetSrc = L.sum.en.greet.toString();
    assert(ok.text.includes(whenSrc), `when.toString() is not a substring of the source: ${whenSrc}`);
    assert(ok.text.includes(greetSrc), `greet.toString() is not a substring of the source: ${greetSrc}`);
    eq(whenSrc, '(s) => s.yes("item_a") && s.scale("item_b") === 2', 'when.toString()');
    return `toString() = ${whenSrc}`;
  });

  await check('2', 'importSource strips a leading U+FEFF and still runs the original text', async () => {
    const ns = await importSource('﻿' + ok.text, { filename: 'bom.js' });
    eq(ns.default.label, 'Prueba de vértigo — ñandú ✓', 'label');
    assert(ok.text.includes(ns.default.sum.en.greet.toString()), 'toString substring');
  });

  for (const [file, kind] of [['import-static.txt', 'static import'], ['import-bare.txt', 'bare import'],
                              ['import-dynamic.txt', 'dynamic import()'], ['reexport-named.txt', 're-export'],
                              ['reexport-all.txt', 'export *']]) {
    await check('2', `importSource rejects a ${kind}`, async () => {
      const s = await source(file);
      const name = file.replace('.txt', '.js');
      const err = await rejects(importSource(s.text, { filename: name }), file);
      assert(err.message.startsWith(`${name} imports other files (`), err.message);
      assert(/ at \d+:\d+/.test(err.message), `no line:col site in: ${err.message}`);
      return err.message;
    });
  }

  await check('2', 'importSource rejects JSX as a syntax error with (line:col)', async () => {
    const s = await source('jsx.txt');
    const err = await rejects(importSource(s.text, { filename: 'jsx.js' }), 'jsx');
    assert(/^jsx\.js: .*jsx.*\(2:\d+\)$/.test(err.message), err.message);
    return err.message;
  });

  await check('2', 'importSource reports a syntax error as "file: msg (l:c)"', async () => {
    const s = await source('syntax.txt');
    const err = await rejects(importSource(s.text, { filename: 'syntax.js' }), 'syntax');
    assert(/^syntax\.js: [^\n]+ \(3:\d+\)$/.test(err.message), err.message);
    assert(err.loc && err.loc.line === 3, 'err.loc.line');
    return err.message;
  });

  await check('2', 'importSource rejects a file with no default export', async () => {
    const s = await source('no-default.txt');
    const err = await rejects(importSource(s.text, { filename: 'no-default.js' }), 'no-default');
    eq(err.message, 'no-default.js has no default export', 'message');
    return err.message;
  });

  await check('2', 'importSource refuses a file over maxBytes (UTF-8 byte count from the caller)', async () => {
    const err = await rejects(importSource(ok.text, { filename: 'big.js', byteLength: 512001, maxBytes: 512000 }), 'size');
    assert(/too large/.test(err.message), err.message);
    return err.message;
  });

  await check('2', 'importSource never paints the red panel', async () => {
    eq(document.querySelectorAll('[role=alert]').length, 0, 'red panels on this page');
    return 'no [role=alert] after every rejection above';
  });

  // ---- 7: inspectSource
  await check('7', 'inspectSource reads a literal format without executing (side effect stays undone) and lists V59 APIs', async () => {
    const s = await source('side-effect.txt');
    const r = inspectSource(s.text, { filename: 'side-effect.js' });
    eq(globalThis.__loaderCheckSideEffect, undefined, 'top-level side effect after inspect');
    eq(r.format, 'screenair-logic', 'format via export default <identifier>');
    eq(r.hasDefaultExport, true, 'hasDefaultExport');
    eq(r.importSites, [], 'importSites');
    eq(r.syntaxError, null, 'syntaxError');
    eq(r.apiRefs, ['window', 'document', 'globalThis', 'fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage',
                   'sessionStorage', 'indexedDB', 'navigator', 'eval', 'Function', 'import.meta'], 'apiRefs');
    // For contrast: importSource does execute it.
    await importSource(s.text, { filename: 'side-effect.js' });
    eq(globalThis.__loaderCheckSideEffect, 'ran', 'side effect after importSource');
    delete globalThis.__loaderCheckSideEffect;
    return r;
  });

  await check('7', 'inspectSource: object keys and member names are not API references', async () => {
    const r = inspectSource('const o = { window: 1, document: 2 }; o.fetch = 3; export default { format: "screenair-logic", o };');
    eq(r.apiRefs, [], 'apiRefs');
    eq(r.format, 'screenair-logic', 'format');
  });

  await check('7', 'inspectSource: format is the value the default export will hold, or null', async () => {
    const f = (src) => inspectSource(src).format;
    const cases = [
      // the last `format` member wins, as at runtime
      ['export default { format: "a", format: "screenair-logic" };', 'screenair-logic'],
      ['export default { "format": "a", format: "screenair-module" };', 'screenair-module'],
      // a later non-literal value or computed key, a spread, or an unknowable key: no answer
      ['export default { format: "screenair-logic", ["format"]: "b" };', null],
      ['export default { ["format"]: "screenair-logic" };', null],
      ['export default { ["x"]: 1, format: "screenair-logic" };', 'screenair-logic'],
      ['export default { format: "screenair-logic", format: kind };', null],
      ['export default { format: "screenair-logic", ...{ format: "b" } };', null],
      ['export default { ...base, format: "screenair-logic" };', null],
      ['const k = "format"; export default { format: "screenair-logic", [k]: "b" };', null],
      ['export default { format: "screenair-logic", get format() { return "b"; } };', null],
      ['export default { format: "screenair-logic", format() {} };', null],
      // top-level const, exported or not; any other use of the binding: no answer
      ['export const L = { format: "screenair-logic" }; export default L;', 'screenair-logic'],
      ['const L = { format: "screenair-logic", n: 1 }; export default L;', 'screenair-logic'],
      ['const L = { format: "screenair-logic" }; L.format = "b"; export default L;', null],
      ['const L = { format: "screenair-logic" }; Object.assign(L, { format: "b" }); export default L;', null],
      ['let L = { format: "screenair-logic" }; export default L;', null],
      ['const o = { L: 1 }; const L = { format: "screenair-logic" }; o.L = 2; export default L;', 'screenair-logic'],
    ];
    const got = cases.map(([src]) => f(src));
    cases.forEach(([src, want], i) => eq(got[i], want, src));
    return got;
  });

  await check('7', 'inspectSource: import sites, non-literal format, syntax error, missing default', async () => {
    const imp = inspectSource((await source('import-static.txt')).text, { filename: 'import-static.js' });
    eq(imp.importSites, ['2:0'], 'importSites');
    const dyn = inspectSource((await source('import-dynamic.txt')).text, { filename: 'import-dynamic.js' });
    eq(dyn.importSites.length, 1, 'dynamic import sites');
    const comp = inspectSource((await source('format-computed.txt')).text);
    eq(comp.format, null, 'computed format');
    eq(comp.hasDefaultExport, true, 'computed hasDefaultExport');
    const jsx = inspectSource((await source('jsx.txt')).text, { filename: 'jsx.js' });
    assert(jsx.syntaxError && jsx.syntaxError.startsWith('jsx.js: '), `syntaxError ${jsx.syntaxError}`);
    eq(jsx.format, null, 'jsx format');
    const nd = inspectSource((await source('no-default.txt')).text);
    eq(nd.hasDefaultExport, false, 'no default');
    eq(inspectSource(ok.text).format, 'screenair-logic', 'ok-logic format');
    return { importSites: imp.importSites, syntaxError: jsx.syntaxError };
  });

  // ---- 7: cycles, boot props, the loader's comments
  await check('7', 'two-module import cycle rejects with "import cycle: A → B → A" (no hang)', async () => {
    const err = await withTimeout(rejects(importModule('./loader-check/cycle-a.js'), 'cycle'), 10000, 'cycle');
    assert(err.message.startsWith('import cycle: cycle-a.js → cycle-b.js → cycle-a.js'), err.message);
    return err.message.split('\n')[0];
  });

  await check('7', 'cycle between two siblings built in parallel rejects (no hang)', async () => {
    const err = await withTimeout(rejects(importModule('./loader-check/sib-root.js'), 'sibling cycle'), 10000, 'sibling cycle');
    const first = err.message.split('\n')[0];
    assert(/^import cycle: sib-(x|y)\.js → sib-(x|y)\.js → sib-(x|y)\.js$/.test(first), err.message);
    return first;
  });

  await check('7', 'boot paints the cycle error in the red panel (two-module cycle)', async () => {
    expectConsole('[masque] Error: import cycle: cycle-a.js → cycle-b.js → cycle-a.js');
    const r = await frame('boot-cycle');
    assert(!r.timedOut, 'boot did not finish (hang)');
    assert(r.alert && r.alert.includes('import cycle: cycle-a.js → cycle-b.js → cycle-a.js'), `panel: ${r.alert}`);
    return r.alert.split('\n').slice(0, 3).join(' | ');
  });

  await check('7', 'boot paints the cycle error in the red panel (siblings built in parallel)', async () => {
    expectConsole('[masque] Error: import cycle: sib-');
    const r = await frame('boot-sibling-cycle');
    assert(!r.timedOut, 'boot did not finish (hang)');
    assert(r.alert && /import cycle: sib-(x|y)\.js → sib-(x|y)\.js → sib-(x|y)\.js/.test(r.alert), `panel: ${r.alert}`);
    return r.alert.split('\n').slice(0, 3).join(' | ');
  });

  await check('7', 'boot({…, props}) passes the props to the root component', async () => {
    const r = await frame('boot-props');
    assert(!r.timedOut && r.ready && !r.alert, `ready ${r.ready}, alert ${r.alert}`);
    const p = JSON.parse(r.props);
    eq(p.keys, ['env', 'marker'], 'prop keys');
    eq(p.marker, 'props-ok', 'marker');
    eq(p.appBase, appBase, 'env.appBase');
    eq(p.loaderFns, ['importModule', 'importSource', 'inspectSource'], 'env.loader');
    return r.props;
  });

  await check('7', 'compiling masque-loader.js through importModule finds no specifier in its comments', async () => {
    const src = await text('../assets/masque-loader.js');
    const out = window.Babel.transform(src, { presets: [['react', { runtime: 'classic' }]], sourceType: 'module',
                                             filename: 'masque-loader.js', compact: false }).code;
    const RE = /(from\s*|import\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\2/g;
    const hits = [...out.matchAll(RE)].map((m) => m[0]);
    eq(hits, [], 'relative specifiers found in the compiled loader');
    const ns = await withTimeout(importModule('../assets/masque-loader.js'), 10000, 'loader through itself');
    for (const k of ['boot', 'importModule', 'importSource', 'inspectSource']) assert(typeof ns[k] === 'function', `${k} missing`);
    return '0 matches; second instance compiled and imported';
  });

  // ---- parallel builds (part of 2/3/7 acceptance in design §6.2)
  await check('7', 'dependencies build in parallel; a shared dependency is built and instantiated once', async () => {
    const log = [];
    const realFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = String(input && input.url || input);
      log.push({ url: url.slice(url.lastIndexOf('/') + 1), t: performance.now() });
      return realFetch(input, init);
    };
    let ns;
    try { ns = await importModule('./loader-check/diamond-root.js'); } finally { window.fetch = realFetch; }
    assert(ns.left.shared === ns.right.shared, 'the shared module was instantiated twice');
    const at = (n) => log.findIndex((e) => e.url === n);
    const iRight = at('diamond-right.js'), iShared = at('diamond-shared.js');
    assert(iRight !== -1 && iShared !== -1, `fetch log: ${log.map((e) => e.url).join(', ')}`);
    assert(iRight < iShared, `right was fetched after left's dependency (sequential): ${log.map((e) => e.url).join(', ')}`);
    eq(log.filter((e) => e.url === 'diamond-shared.js').length, 1, 'shared fetched once');
    return 'fetch order: ' + log.map((e) => e.url).join(', ');
  });

  // ---- 4: sha256HexSync equals crypto.subtle on 20 vectors
  await check('4', 'sha256HexSync equals crypto.subtle on 20 vectors', async () => {
    assert(window.isSecureContext && crypto.subtle, 'not a secure context: crypto.subtle unavailable');
    const enc = new TextEncoder();
    const rng = mulberry32(0x5A1C);
    const rand = (n) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = Math.floor(rng() * 256); return b; };
    const mib = new Uint8Array(1 << 20); for (let i = 0; i < mib.length; i++) mib[i] = (i * 31 + 7) & 255;
    const vectors = [
      ['empty', new Uint8Array(0)],
      ['abc', enc.encode('abc')],
      ['1 MiB', mib],
      ['non-ASCII Spanish', enc.encode('Mareos y oídos — señor, ¿está bien? Bárány')],
      ['non-ASCII astral', enc.encode('🧭✓ — 中文 — Ελληνικά')],
      ['55 bytes', enc.encode('a'.repeat(55))],
      ['56 bytes', enc.encode('a'.repeat(56))],
      ['63 bytes', enc.encode('a'.repeat(63))],
      ['64 bytes', enc.encode('a'.repeat(64))],
      ['65 bytes', enc.encode('a'.repeat(65))],
      ['119 bytes', enc.encode('b'.repeat(119))],
      ['120 bytes', enc.encode('b'.repeat(120))],
      ['128 bytes', enc.encode('b'.repeat(128))],
      ['FIPS 448-bit', enc.encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')],
      ['FIPS 896-bit', enc.encode('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu')],
      ['one zero byte', new Uint8Array(1)],
      ['random 1000', rand(1000)],
      ['random 4097', rand(4097)],
      ['random 65537', rand(65537)],
      ['BOM + text', enc.encode('﻿export default {}')],
    ];
    eq(vectors.length, 20, 'vector count');
    for (const [name, b] of vectors) {
      const sub = hex(await crypto.subtle.digest('SHA-256', b));
      const sync = H.sha256HexSync(b);
      assert(sub === sync, `${name}: subtle ${sub} vs sync ${sync}`);
      assert(await H.sha256Hex(b) === sub, `${name}: sha256Hex`);
    }
    eq(H.sha256HexSync(new Uint8Array(0)), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'empty digest');
    eq(await H.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'abc digest');
    return `${vectors.length} vectors equal`;
  });

  // ---- 5: scopeCss outputs are deterministic and equal the committed expectations
  const { scopeCss } = await importModule('../src/engine/css.js');
  for (const t of SCOPE_TARGETS) {
    await check('5', `scopeCss(${t.name} CSS, "${t.root}") is deterministic and equals expected/scopecss-${t.name}.css`, async () => {
      const ns = await importModule(`./baseline/src/${t.file}`, { append: 'export { CSS as __loaderCheckCss };' });
      const css = ns.__loaderCheckCss;
      assert(typeof css === 'string' && css.length > 1000, 'CSS not exported');
      const a = scopeCss(css, t.root), b = scopeCss(css, t.root);
      assert(a === b, 'two runs differ');
      const expected = await text(`./loader-check/expected/scopecss-${t.name}.css`);
      if (a !== expected) {
        let i = 0; while (i < a.length && a[i] === expected[i]) i++;
        throw new Error(`differs from the expectation at offset ${i}: got ${JSON.stringify(a.slice(i, i + 60))}, expected ${JSON.stringify(expected.slice(i, i + 60))}`);
      }
      return `${a.length} chars, equal to the expectation`;
    });
  }

  // ---- 6: engine files import only engine files and have no top-level statements with effects
  await check('6', 'engine files import only ./<engine>.js and have no top-level expression statements', async () => {
    const bad = [];
    for (const f of Object.keys(ENGINE_EXPORTS)) {
      const src = await text(`../src/engine/${f}`);
      const ast = window.Babel.transform(src, { sourceType: 'module', filename: f, ast: true, code: false, presets: [] }).ast;
      for (const node of ast.program.body) {
        if ((node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration' ||
             (node.type === 'ExportNamedDeclaration' && node.source)) && !/^\.\/[A-Za-z]+\.js$/.test(node.source.value)) {
          bad.push(`${f}: imports ${node.source.value}`);
        }
        if (node.type === 'ExpressionStatement') bad.push(`${f}:${node.loc.start.line} top-level expression statement`);
      }
      if (inspectSource(src, { filename: f }).importSites.length !==
          ast.program.body.filter((n) => n.type === 'ImportDeclaration' || n.type === 'ExportAllDeclaration' || (n.type === 'ExportNamedDeclaration' && n.source)).length) {
        bad.push(`${f}: dynamic import()`);
      }
      if (src.charCodeAt(0) === 0xFEFF || src.includes('\r')) bad.push(`${f}: BOM or CR`);
    }
    eq(bad, [], 'violations');
    return `${Object.keys(ENGINE_EXPORTS).length} files clean`;
  });

  // ---- 8: every §2.4 file and ui/common.jsx exist, and a module importing all of them compiles
  await check('8', 'every engine file and ui/common.jsx exist, export their final names, and compile together', async () => {
    const ns = await importModule('./loader-check/all-engine.js');
    const problems = [];
    for (const [f, names] of Object.entries(ENGINE_EXPORTS)) {
      const m = ns.modules[f.replace('.js', '')];
      if (!m) { problems.push(`${f}: missing`); continue; }
      for (const n of names) if (!(n in m)) problems.push(`${f}: no export ${n}`);
    }
    for (const n of ['SessionProvider', 'useSession', 'ProvenanceBadge', 'TabNote']) {
      if (typeof ns.common[n] !== 'function') problems.push(`common.jsx: no ${n}`);
    }
    // A file still carrying its WP0 stub is a "waits on" note, not a failure; a stub must throw
    // exactly "not implemented: WPn" (its owner) when used.
    for (const [f, wp] of Object.entries(STUB_OWNER)) {
      const src = await text(`../src/engine/${f}`);
      if (!/export function \w+\([^)]*\)\s*\{\s*throw new Error\(/.test(src)) continue;
      waiting.push(`${f} (${wp})`);
      const m = ns.modules[f.replace('.js', '')];
      for (const fnName of ENGINE_EXPORTS[f].filter((n) => typeof m[n] === 'function' && /^[a-z]/.test(n))) {
        if (!new RegExp(`function ${fnName}\\([^)]*\\)\\s*\\{\\s*throw new Error\\(`).test(src)) continue;
        try { m[fnName](); problems.push(`${f}: ${fnName}() did not throw`); }
        catch (err) { if (!String(err.message).startsWith(`not implemented: ${wp}`)) problems.push(`${f}: ${fnName}() threw "${err.message}"`); }
      }
    }
    eq(problems, [], 'problems');
    return `${Object.keys(ENGINE_EXPORTS).length} engine files + ui/common.jsx; still stubs: ${waiting.join(', ') || 'none'}`;
  });

  await check('8', 'ui/common.jsx: session publish/addRow, TabNote and ProvenanceBadge render', async () => {
    const { common } = await importModule('./loader-check/all-engine.js');
    const { SessionProvider, useSession, TabNote, ProvenanceBadge, TAB_NOTES } = common;
    const ce = React.createElement;
    let api = null;
    function Probe() { api = useSession(); return null; }
    const host = document.createElement('div');
    const root = createRoot(host);
    const derived = { origin: 'derived', name: 'Child', instrumentVersion: '1-local.abc', hashes: { scoringHash: 'b' },
                      classification: { kind: 'verified', root: { name: 'Root', instrumentVersion: '1', hashes: { scoringHash: 'a' } } } };
    // Rendering is awaited by polling rather than assumed synchronous (flushSync does not
    // flush a createRoot render with every React build the import map may serve).
    const until = async (fn, label) => {
      for (let i = 0; i < 200; i++) { if (fn()) return; await new Promise((r) => setTimeout(r, 10)); }
      throw new Error(`timed out waiting for ${label}`);
    };
    root.render(ce(SessionProvider, null,
      ce(Probe), ce(TabNote), ce(TabNote, { kind: 'research' }),
      ce('div', { id: 'b1' }, ce(ProvenanceBadge, { module: { origin: 'builtin' } })),
      ce('div', { id: 'b2' }, ce(ProvenanceBadge, { module: derived })),
      ce('div', { id: 'b3' }, ce(ProvenanceBadge, { module: derived, variant: 'full' })),
      ce('div', { id: 'b4' }, ce(ProvenanceBadge, { module: derived, audience: 'patient' }))));
    await until(() => api && host.querySelector('#b4 [data-testid=provenance-badge]'), 'first render');
    eq(api.screens, { screener: null, scribe: null }, 'initial screens');
    eq(api.cohorts, { screener: [], scribe: [] }, 'initial cohorts');
    const snap = { source: 'scribe', at: '2026-10-02T00:00:00Z', score: 1 };
    api.publish(snap); api.addRow('screener', { a: 1 }); api.addRow('screener', { a: 2 });
    await until(() => api.screens.scribe === snap && api.cohorts.screener.length === 2, 'publish/addRow');
    assert(api.screens.scribe === snap, 'publish');
    eq(api.cohorts.screener.length, 2, 'addRow');
    const notes = host.querySelectorAll('[data-testid=tab-note]');
    eq([...notes].map((n) => n.textContent), [TAB_NOTES.clinician, TAB_NOTES.research], 'tab notes');
    eq(host.querySelector('#b1').innerHTML, '', 'built-in renders no badge');
    eq(host.querySelector('#b2 [data-testid=provenance-badge]').textContent.trim(), 'edited · scoring changed', 'compact badge');
    assert(host.querySelector('#b3 [data-testid=provenance-badge]').textContent.includes('Edited modulescores not comparable with Root 1'), host.querySelector('#b3 [data-testid=provenance-badge]').textContent);
    eq(host.querySelector('#b4 [data-testid=provenance-badge]').textContent.trim(), 'changed locally, not reviewed', 'patient badge');
    assert(!/scor/i.test(host.querySelector('#b4 [data-testid=provenance-badge]').textContent), 'patient badge names a score');
    root.unmount();
    return 'session, tab notes and badges as specified';
  });

  // ---- 9: rubricHashes
  await check('9', 'rubricHashes: deterministic across key orders; absent negative ≡ negative:false; undefined never defaulted', async () => {
    const r = { format: 'screenair-rubric', id: 'fixture', domains: [
      { key: 'a', label: 'Example A', max: 3, items: [{ id: 'i1', w: 1, text: 'Example item A' },
        { id: 'i2', w: 2, text: 'Example item B', scale: [{ label: 'None', f: 0 }, { label: 'Some', f: 1 }] }] },
      { key: 'n', label: 'Example N', max: -1, negative: true, items: [{ id: 'i3', w: -1, text: 'Example item C' }] }],
      bands: { cuts: { moderate: 1, high: 2 } }, redFlags: [{ id: 'f1', tier: 'urgent', group: 'G', text: 'T', points: 'P', action: 'X' }],
      changelog: [] };
    const reorder = (v) => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reorder(v[k])])) : v;
    const a = await H.rubricHashes(r), b = await H.rubricHashes(reorder(r));
    eq(a, b, 'key order');
    const f = structuredClone(r); f.domains[0].negative = false;
    const hf = await H.rubricHashes(f);
    eq([hf.instrumentHash, hf.scoringHash], [a.instrumentHash, a.scoringHash], 'negative:false vs absent');
    const t = structuredClone(r); t.domains[0].negative = true;
    const ht = await H.rubricHashes(t);
    assert(ht.instrumentHash !== a.instrumentHash && ht.scoringHash !== a.scoringHash, 'negative:true must differ');
    eq(a.lexiconHash, null, 'no lexicon → null');
    eq(H.hashProjections.instrument(r).domains[0].negative, false, 'projection emits negative:false');
    assert(!('fhir' in H.hashProjections.instrument(r)), 'absent fhir defaulted');
    return a;
  });
  return { results, waiting };
}
