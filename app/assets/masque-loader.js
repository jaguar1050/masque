/*
 * MASQUE demo loader
 * ------------------
 * The v0.3.1 components are ES modules containing JSX, with a real dependency
 * graph (Scribe -> ResearchReadinessPanel + MASQUE_Extraction + MASQUE_Probes).
 * There is no Node build step here, and the usual no-build trick
 * (<script type="text/babel">) cannot express that graph: Babel inlines the
 * transformed source, and relative imports have nothing to resolve against.
 *
 * So we do the resolution ourselves:
 *   1. fetch a module's source
 *   2. transform JSX -> JS with Babel standalone, keeping `import`/`export`
 *   3. recursively build its relative dependencies first
 *   4. rewrite each relative specifier to its dependency's blob: URL
 *   5. create a blob: URL for this module and hand it back
 *
 * Bare specifiers (react, lucide-react) are deliberately left untouched --
 * the page's <script type="importmap"> resolves those, and import maps apply
 * to blob: modules too, so every module shares one React instance.
 */

const EXT_RE = /\.(jsx|js|mjs)$/;

// `from "./x"`, `import "./x"`, and `import("./x")` all need rewriting.
const REL_SPECIFIER_RE = /(from\s*|import\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\2/g;

// Module URL -> Promise<blob URL>. Keyed by resolved URL so a module shared by
// two entries (ResearchReadinessPanel) is fetched, transformed and instantiated
// exactly once.
const graph = new Map();

function candidates(spec) {
  return EXT_RE.test(spec) ? [spec] : [spec + '.jsx', spec + '.js', spec];
}

async function fetchModule(spec, baseUrl) {
  let lastStatus = null;
  for (const candidate of candidates(spec)) {
    const url = new URL(candidate, baseUrl).href;
    let res;
    try {
      // 'no-cache' revalidates rather than refetching: a 304 is cheap, and it
      // means redeploying a component is picked up without a hard reload.
      res = await fetch(url, { cache: 'no-cache' });
    } catch (err) {
      throw new Error(`Network error fetching ${url}: ${err.message}`);
    }
    if (res.ok) return { url, source: await res.text() };
    lastStatus = res.status;
  }
  throw new Error(`Could not resolve "${spec}" from ${baseUrl} (last status ${lastStatus})`);
}

// djb2 -- only used to give a patched copy of a module its own cache key.
function hashOf(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/**
 * @param {string} spec     Module specifier (relative or absolute URL)
 * @param {string} baseUrl  URL the specifier resolves against
 * @param {string} append   Source text appended to the ENTRY module only, before
 *                          transform. The parity harness uses this to add
 *                          `export { ... }` to reference/ files whose internals
 *                          are module-private, without editing reference/.
 *                          Dependencies are always built unpatched.
 */
async function build(spec, baseUrl, append = '') {
  const resolved = new URL(candidates(spec)[0], baseUrl).href;
  const probe = append ? `${resolved}#patched:${hashOf(append)}` : resolved;
  if (graph.has(probe)) return graph.get(probe);

  const pending = (async () => {
    const { url, source } = await fetchModule(spec, baseUrl);

    if (!window.Babel) throw new Error('Babel standalone did not load.');

    // runtime:'classic' keeps the JSX factory as React.createElement, which is
    // what these files expect -- they all `import React from "react"`.
    // No preset-env: `import`/`export` must survive so the browser links them.
    let transformed;
    try {
      transformed = window.Babel.transform(append ? `${source}\n${append}\n` : source, {
        presets: [['react', { runtime: 'classic' }]],
        sourceType: 'module',
        filename: url,
        compact: false,
      }).code;
    } catch (err) {
      throw new Error(`Failed to compile ${url}:\n${err.message}`);
    }

    // Build dependencies before we can rewrite them to blob URLs.
    const deps = new Map();
    for (const match of transformed.matchAll(REL_SPECIFIER_RE)) {
      const depSpec = match[3];
      if (!deps.has(depSpec)) deps.set(depSpec, await build(depSpec, url));
    }

    const linked = transformed.replace(
      REL_SPECIFIER_RE,
      (whole, prefix, quote, depSpec) => `${prefix}${quote}${deps.get(depSpec)}${quote}`
    );

    return URL.createObjectURL(new Blob([linked], { type: 'text/javascript' }));
  })();

  graph.set(probe, pending);
  return pending;
}

function showError(err) {
  const panel = document.createElement('div');
  panel.setAttribute('role', 'alert');
  panel.style.cssText =
    'position:fixed;inset:auto 16px 16px 16px;z-index:99999;max-height:45vh;overflow:auto;' +
    'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;' +
    'background:#2a1215;color:#ff8a80;border:1px solid #5c2b2e;border-radius:10px;padding:12px 16px;';
  panel.textContent = 'MASQUE demo failed to start\n\n' + (err && err.stack ? err.stack : String(err));
  document.body.appendChild(panel);
  console.error('[masque]', err);
}

/**
 * Compile a module (and its relative dependency graph) and import it.
 * Returns the module namespace object, exactly like a native `import()`.
 *
 * @param {string} spec                 Relative path or absolute URL of the module
 * @param {object} [opts]
 * @param {string} [opts.baseUrl]       Resolution base (default: the page)
 * @param {string} [opts.append]        Source appended to this module before compiling,
 *                                      e.g. 'export { ITEMS, useScore };' -- see build()
 */
export async function importModule(spec, { baseUrl = document.baseURI, append = '' } = {}) {
  const blobUrl = await build(spec, baseUrl, append);
  return import(blobUrl);
}

/**
 * Compile and mount a component.
 * @param {string} entry   Relative path to the entry module, e.g. './src/App.jsx'
 * @param {string} mountId Target element id (default 'root')
 */
export async function boot({ entry, mountId = 'root' }) {
  const status = document.getElementById('masque-status');
  const setStatus = (msg) => { if (status) status.textContent = msg; };

  try {
    setStatus('Compiling components…');
    const blobUrl = await build(entry, document.baseURI);

    setStatus('Starting…');
    const [{ default: App }, React, { createRoot }] = await Promise.all([
      import(blobUrl),
      import('react'),
      import('react-dom/client'),
    ]);

    if (typeof App !== 'function') {
      throw new Error(`${entry} has no default-exported component.`);
    }

    const host = document.getElementById(mountId);
    if (!host) throw new Error(`Mount point #${mountId} not found.`);

    createRoot(host).render(React.createElement(React.StrictMode, null, React.createElement(App)));

    if (status) status.remove();
    document.documentElement.dataset.masqueReady = 'true';
  } catch (err) {
    if (status) status.remove();
    showError(err);
  }
}
