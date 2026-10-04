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
 *   3. build its relative dependencies first, in parallel, refusing import cycles
 *   4. rewrite each relative specifier to its dependency's blob: URL
 *   5. create a blob: URL for this module and hand it back
 *
 * Bare specifiers (react, lucide-react) are deliberately left untouched --
 * the page's <script type="importmap"> resolves those, and import maps apply
 * to blob: modules too, so every module shares one React instance.
 *
 * Two more entry points take source TEXT instead of a path (screenAIr logic
 * files and uploads): importSource() runs a self-contained module exactly as
 * written, and inspectSource() parses one without running it.
 *
 * Pages import this file natively and hand its functions to compiled code as
 * `env.loader`; compiled code never imports the loader by path.
 */

const EXT_RE = /\.(jsx|js|mjs)$/;

// Static imports, side-effect imports, re-exports and dynamic import() calls
// whose specifier is relative all need rewriting. The pattern runs over the
// whole transformed text, comments and string literals included, so keep
// specifier-shaped examples out of every compiled file's comments and strings.
const REL_SPECIFIER_RE = /(from\s*|import\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\2/g;

// Module URL -> Promise<blob URL>. Keyed by resolved URL so a module shared by
// two entries (ResearchReadinessPanel) is fetched, transformed and instantiated
// exactly once, even when the two entries are built in parallel.
const graph = new Map();

// Wait-for map used for cycle detection: cache key -> {deps, seq}, the keys of
// the dependencies that module is waiting on and the order it started waiting
// in. A key is present only while its dependencies are still building.
const waiting = new Map();
let waitSeq = 0;

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

// Pages load Babel standalone with `defer`, so the first paint does not wait for it. Deferred
// scripts run before module scripts in document order, so Babel is normally present when the
// loader runs; this also covers a page that loads it later (or never: then it rejects once the
// page has finished loading).
function babelReady() {
  if (window.Babel) return Promise.resolve(window.Babel);
  return new Promise((resolve, reject) => {
    const settle = () => (window.Babel ? resolve(window.Babel) : reject(new Error('Babel standalone did not load.')));
    if (document.readyState === 'complete') settle();
    else window.addEventListener('load', settle, { once: true });
  });
}

function keyOf(spec, baseUrl) {
  return new URL(candidates(spec)[0], baseUrl).href;
}

function shortName(key) {
  const path = key.split('#')[0];
  return path.slice(path.lastIndexOf('/') + 1) || path;
}

// Depth-first search through the wait-for map for a path from `from` back to
// `target`. Returns the path (keys, starting at `from`) or null.
function findPath(from, target, seen = new Set()) {
  if (from === target) return [from];
  if (seen.has(from)) return null;
  seen.add(from);
  const entry = waiting.get(from);
  if (!entry) return null;
  for (const n of entry.deps) {
    const rest = findPath(n, target, seen);
    if (rest) return [from, ...rest];
  }
  return null;
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
  const resolved = keyOf(spec, baseUrl);
  const probe = append ? `${resolved}#patched:${hashOf(append)}` : resolved;
  if (graph.has(probe)) return graph.get(probe);

  const pending = (async () => {
    const [{ url, source }] = await Promise.all([fetchModule(spec, baseUrl), babelReady()]);

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

    // Unique relative specifiers, in order of first appearance.
    const specs = [];
    for (const match of transformed.matchAll(REL_SPECIFIER_RE)) {
      if (!specs.includes(match[3])) specs.push(match[3]);
    }

    // Record this module's edges, then look for a path back to it. Every
    // module of a cycle registers before any of them can finish, so the last
    // one to register always finds the cycle -- also when two siblings built
    // in parallel each find the other already pending in the cache.
    const depKeys = specs.map((s) => keyOf(s, url));
    waiting.set(probe, { deps: depKeys, seq: waitSeq++ });
    for (const dk of depKeys) {
      const path = findPath(dk, probe);
      if (path) {
        // Report the cycle from the member that started waiting first -- the one
        // nearest the entry -- so A importing B importing A reads A → B → A.
        const ring = [probe, ...path.slice(0, -1)];
        let start = 0;
        ring.forEach((k, i) => { if (waiting.get(k).seq < waiting.get(ring[start]).seq) start = i; });
        const loop = [...ring.slice(start), ...ring.slice(0, start), ring[start]];
        waiting.delete(probe);
        const names = loop.map(shortName).join(' → ');
        const urls = loop.map((k) => `  ${k}`).join('\n');
        throw new Error(`import cycle: ${names}\n${urls}`);
      }
    }

    let blobs;
    try {
      blobs = await Promise.all(specs.map((s) => build(s, url)));
    } finally {
      waiting.delete(probe);
    }
    const deps = new Map(specs.map((s, i) => [s, blobs[i]]));

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

// ---------------------------------------------------------------------------
// Source-text entry points (design 03 §6.1)
// ---------------------------------------------------------------------------

// Identifiers that reach page or network APIs (validator code V59). Listed in
// the consent dialog before an uploaded file runs. A heuristic signal, not a
// sandbox: code can reach the same APIs without naming any of them, so an
// empty list never means the code is harmless.
const API_NAMES = ['window', 'document', 'globalThis', 'fetch', 'XMLHttpRequest', 'WebSocket',
  'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'eval', 'Function'];
// Other ways to the global object or the page. These are also ordinary variable
// names, so they count only when the file declares no binding of that name.
const GLOBAL_ALIASES = ['self', 'top', 'parent', 'frames', 'opener', 'location'];
const API_IMPORT_META = 'import.meta';
// Objects whose members are page APIs: a computed member of one (`window[k]`)
// can be any of them.
const GLOBAL_OBJECTS = ['window', 'globalThis', 'self', 'top', 'parent', 'frames', 'opener'];
// `(() => {}).constructor` is the Function constructor without naming it.
const API_CONSTRUCTOR = '.constructor';

const SKIP_KEYS = new Set(['loc', 'start', 'end', 'extra', 'range',
  'leadingComments', 'trailingComments', 'innerComments', 'comments']);

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function site(node) {
  return node && node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : '?:?';
}

// Parse only: no preset, so JSX is a syntax error here by design.
function parseSource(src, filename) {
  try {
    return window.Babel.transform(src, {
      sourceType: 'module', filename, ast: true, code: false, presets: [],
      babelrc: false, configFile: false,
    }).ast;
  } catch (err) {
    let first = String(err && err.message ? err.message : err).split('\n')[0];
    // Babel prefixes its own (cwd-resolved) file name; replace it with ours.
    const marker = `${filename}: `;
    const at = first.indexOf(marker);
    if (at !== -1 && at <= 1) first = first.slice(at + marker.length);
    first = first.replace(/:\s*$/, '');
    const e = new Error(`${filename}: ${first}`);
    if (err && err.loc) e.loc = { line: err.loc.line, column: err.loc.column };
    e.syntax = true;
    throw e;
  }
}

// An Identifier is a reference unless it is a non-computed member property or
// object/class key, or a label. (A binding site such as a declarator id counts.)
function isReference(parent, parentKey) {
  if (!parent) return true;
  const isKey = !parent.computed && (
    ((parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') && parentKey === 'property') ||
    ((parent.type === 'ObjectProperty' || parent.type === 'ObjectMethod' || parent.type === 'ClassMethod' ||
      parent.type === 'ClassProperty' || parent.type === 'ClassPrivateProperty') && parentKey === 'key'));
  const isLabel = (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' ||
    parent.type === 'ContinueStatement') && parentKey === 'label';
  return !isKey && !isLabel;
}

// The names a binding pattern declares (`a`, `{ b, c: d }`, `[e, ...f]`, `g = 1`).
function patternNames(node, out) {
  if (!node) return out;
  switch (node.type) {
    case 'Identifier': out.add(node.name); break;
    case 'ObjectPattern':
      for (const p of node.properties) patternNames(p.type === 'RestElement' ? p.argument : p.value, out);
      break;
    case 'ArrayPattern': for (const e of node.elements) patternNames(e, out); break;
    case 'AssignmentPattern': patternNames(node.left, out); break;
    case 'RestElement': patternNames(node.argument, out); break;
    default: break;
  }
  return out;
}

function memberName(node) {
  if (!node || !node.property) return null;
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'StringLiteral') return node.property.value;
  return null;
}

// One recursive walk collecting everything both entry points need.
function scan(ast) {
  const imports = [];   // {kind, site}
  const apis = new Set();
  const aliasRefs = new Set(); // GLOBAL_ALIASES seen in reference position
  const declared = new Set();  // every name the file binds anywhere
  const refCounts = new Map(); // identifier name -> occurrences in reference position
  let defaultExport = null;

  const visit = (node, parent, parentKey) => {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'VariableDeclarator':
        patternNames(node.id, declared); break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ObjectMethod':
      case 'ClassMethod':
        if (node.id) declared.add(node.id.name);
        for (const p of node.params || []) patternNames(p, declared);
        break;
      case 'ClassDeclaration':
      case 'ClassExpression':
        if (node.id) declared.add(node.id.name);
        break;
      case 'CatchClause':
        patternNames(node.param, declared); break;
      case 'ImportDeclaration':
        imports.push({ kind: 'import declaration', site: site(node) }); break;
      case 'ExportAllDeclaration':
        imports.push({ kind: 're-export', site: site(node) }); break;
      case 'ExportNamedDeclaration':
        if (node.source) imports.push({ kind: 're-export', site: site(node) });
        break;
      case 'ImportExpression':
        imports.push({ kind: 'dynamic import()', site: site(node) }); break;
      case 'CallExpression':
        if (node.callee && node.callee.type === 'Import') imports.push({ kind: 'dynamic import()', site: site(node) });
        break;
      case 'ExportDefaultDeclaration':
        if (!defaultExport) defaultExport = node;
        break;
      case 'MemberExpression':
      case 'OptionalMemberExpression': {
        // `window.localStorage`, `globalThis["fetch"]`: the property is the API reached;
        // `window[k]` can be any of them.
        const name = memberName(node);
        if (node.object && node.object.type === 'Identifier' && GLOBAL_OBJECTS.includes(node.object.name)) {
          if (name !== null) { if (API_NAMES.includes(name)) apis.add(name); }
          else if (node.computed) apis.add(`${node.object.name}[…]`);
        }
        if (name === 'constructor') apis.add(API_CONSTRUCTOR);
        break;
      }
      case 'MetaProperty':
        if (node.meta && node.meta.name === 'import' && node.property && node.property.name === 'meta') apis.add(API_IMPORT_META);
        break;
      case 'Identifier':
        if (isReference(parent, parentKey)) {
          refCounts.set(node.name, (refCounts.get(node.name) || 0) + 1);
          if (API_NAMES.includes(node.name)) apis.add(node.name);
          if (GLOBAL_ALIASES.includes(node.name)) aliasRefs.add(node.name);
        }
        break;
      default:
        break;
    }
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') visit(child, node, key);
      } else if (value && typeof value.type === 'string') {
        visit(value, node, key);
      }
    }
  };
  visit(ast.program, null, null);
  for (const n of aliasRefs) if (!declared.has(n)) apis.add(n);

  const order = [...API_NAMES, ...GLOBAL_ALIASES, API_IMPORT_META,
    ...GLOBAL_OBJECTS.map((o) => `${o}[…]`), API_CONSTRUCTOR];
  return { imports, apiRefs: order.filter((n) => apis.has(n)), defaultExport, refCounts };
}

// The literal key of an object member, or undefined when it cannot be known
// without evaluating something (a computed key other than a string literal).
function literalKey(p) {
  if (p.computed) return p.key && p.key.type === 'StringLiteral' ? p.key.value : undefined;
  if (!p.key) return undefined;
  if (p.key.type === 'Identifier') return p.key.name;
  if (p.key.type === 'StringLiteral') return p.key.value;
  if (p.key.type === 'NumericLiteral') return String(p.key.value);
  return undefined;
}

// `format` only when the literal is what the module's default export will hold:
// the last `format` member wins (as at runtime), and any member whose key or
// contribution cannot be known statically (spread, non-literal computed key)
// makes the answer null rather than a guess.
function literalFormat(ast, defaultExport, refCounts) {
  if (!defaultExport) return null;
  let obj = defaultExport.declaration;
  if (obj && obj.type === 'Identifier') {
    const name = obj.name;
    obj = null;
    let bindings = 0;
    for (const stmt of ast.program.body) {
      const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
      if (!decl || decl.type !== 'VariableDeclaration') continue;
      for (const d of decl.declarations) {
        if (!d.id || d.id.type !== 'Identifier' || d.id.name !== name) continue;
        bindings += 1;
        obj = decl.kind === 'const' ? d.init : null;
      }
    }
    // Exactly the binding and the `export default` itself: any other reference
    // (e.g. `L.format = "b"`, `Object.assign(L, …)`) could change it before use.
    if (bindings !== 1 || (refCounts.get(name) || 0) !== 2) return null;
  }
  if (!obj || obj.type !== 'ObjectExpression') return null;
  let last = null;
  for (const p of obj.properties) {
    if (p.type === 'SpreadElement') return null;
    const k = literalKey(p);
    if (k === undefined) return null;
    if (k === 'format') last = p;
  }
  // A method/getter/setter, or a computed `["format"]`, is not the identifier or
  // string key §6.1 stands behind.
  if (!last || last.type !== 'ObjectProperty' || last.computed) return null;
  return last.value && last.value.type === 'StringLiteral' ? last.value.value : null;
}

/**
 * Parse a self-contained module without executing anything.
 *
 * @param {string} source
 * @param {{filename?: string}} [opts]
 * @returns {{format: string|null, importSites: string[], apiRefs: string[],
 *            hasDefaultExport: boolean, syntaxError: string|null}}
 *   importSites are "line:column" (Babel positions: line 1-based, column 0-based).
 */
export function inspectSource(source, { filename = 'module.js' } = {}) {
  if (!window.Babel) throw new Error('Babel standalone did not load.');
  const src = stripBom(String(source));
  let ast;
  try {
    ast = parseSource(src, filename);
  } catch (err) {
    if (!err.syntax) throw err;
    return { format: null, importSites: [], apiRefs: [], hasDefaultExport: false, syntaxError: err.message };
  }
  const { imports, apiRefs, defaultExport, refCounts } = scan(ast);
  return {
    format: literalFormat(ast, defaultExport, refCounts),
    importSites: imports.map((i) => i.site),
    apiRefs,
    hasDefaultExport: !!defaultExport,
    syntaxError: null,
  };
}

/**
 * Run a self-contained module from its source text and return its namespace.
 * The text runs exactly as given (no transform), so the executed bytes are the
 * fetched or uploaded bytes. It may import nothing and may not contain JSX.
 * Always throws to the caller; never paints the error panel; never touches the
 * module graph cache.
 *
 * @param {string} source
 * @param {{filename?: string, byteLength?: number|null, maxBytes?: number|null}} [opts]
 *   byteLength: the UTF-8 byte count the caller measured before decoding.
 *   maxBytes: the caller's limit. Both are needed for the size check.
 */
export async function importSource(source, { filename = 'module.js', byteLength = null, maxBytes = null } = {}) {
  await babelReady();
  if (byteLength != null && maxBytes != null && byteLength > maxBytes) {
    throw new Error(`${filename} is too large (${byteLength} > ${maxBytes} bytes)`);
  }
  const src = stripBom(String(source));
  const ast = parseSource(src, filename);
  const { imports, defaultExport } = scan(ast);
  if (imports.length) {
    const list = imports.map((i) => `${i.kind} at ${i.site}`).join(', ');
    const e = new Error(`${filename} imports other files (${list}): logic files must be self-contained`);
    e.importSites = imports.map((i) => i.site);
    throw e;
  }
  if (!defaultExport) throw new Error(`${filename} has no default export`);

  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  try {
    return await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Compile and mount a component.
 * @param {object} opts
 * @param {string} opts.entry      Relative path to the entry module (resolved against the page)
 * @param {string} [opts.mountId]  Target element id (default 'root')
 * @param {object|null} [opts.props]  Props for the root component (default none)
 */
export async function boot({ entry, mountId = 'root', props = null }) {
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

    createRoot(host).render(React.createElement(React.StrictMode, null, React.createElement(App, props)));

    if (status) status.remove();
    document.documentElement.dataset.masqueReady = 'true';
  } catch (err) {
    if (status) status.remove();
    showError(err);
  }
}
