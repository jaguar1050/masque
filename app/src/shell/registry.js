// shell/registry.js — module registry (design 03 §3.8, §5.2). Owner: WP12.
//
// M1 provides loadBuiltins({env}): the one load path every built-in module goes through,
// and the path an upload will share (D3). It is coded against the WP3 signatures
// (bindModule, validateModule) and works as soon as WP3 replaces the WP0 stubs; until then
// every built-in comes back as a failed entry whose error reads "not implemented: WP3".
// The upload, register and saved-module functions arrive at M3; their names are final.
//
// Every module-data path resolves against env.appBase (the app/ folder), never against the
// page (D25), so a page at any depth loads the same files. No module literal lives here:
// the list of built-ins is app/modules/registry.json.
// No side effects at import time.

import { bindModule } from "../engine/bind.js";
import { validateModule } from "../engine/validate.js";
import { sha256Hex } from "../engine/hash.js";
import { LIMITS } from "../engine/policy.js";
import { FORMAT } from "../engine/contract.js";

/** Registry file, relative to app/. */
export const REGISTRY_PATH = "./modules/registry.json";

/** Thrown for a failure of the registry file itself (no entry can be built). */
export class RegistryError extends Error {
  constructor(message) { super(message); this.name = "RegistryError"; }
}

/** Failure at one stage of loading a built-in; becomes a ValidationReport error. */
class LoadError extends Error {
  constructor(code, path, message) { super(message); this.name = "LoadError"; this.code = code; this.path = path; }
}

const now = () => new Date().toISOString();

/**
 * A readable name for a built-in whose rubric could not be read, so the picker shows
 * "masque (failed to load)" rather than the path: the rubric file's name without its
 * directory and its ".rubric.json" / ".json" suffix ("./modules/masque/masque.rubric.json"
 * gives "masque"). Replaced by the rubric's own label as soon as the rubric parses.
 */
function fallbackLabel(path) {
  const base = String(path).split(/[\\/]/).pop() || String(path);
  return base.replace(/\.rubric\.json$/i, "").replace(/\.json$/i, "") || base;
}

async function fetchBytes(url, path) {
  let res;
  try { res = await fetch(url, { cache: "no-cache" }); }
  catch (e) { throw new LoadError("LOAD", path, `Could not fetch ${path}: ${e && e.message ? e.message : e}`); }
  if (!res.ok) throw new LoadError("LOAD", path, `HTTP ${res.status} fetching ${path}`);
  return new Uint8Array(await res.arrayBuffer());
}

function decodeUtf8(bytes, path) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch (_) { throw new LoadError("LOAD", path, `Not valid UTF-8 (${path})`); }
}

function checkSize(bytes, limit, path) {
  if (bytes.byteLength > limit) throw new LoadError("LOAD", path, `Too large (${bytes.byteLength} > ${limit})`);
}

/** A ValidationReport for an entry that could not be loaded or bound (never mounts). */
function failureReport(err, fallbackPath) {
  const code = err && err.code ? err.code : "LOAD";
  const path = err && err.path ? err.path : fallbackPath;
  const msg = err && err.message ? err.message : String(err);
  return { ok: false, errors: [{ path, code, msg }], warnings: [], info: {} };
}

/** Read and check app/modules/registry.json. */
async function readRegistry(env) {
  const url = new URL(REGISTRY_PATH, env.appBase).href;
  let res;
  try { res = await fetch(url, { cache: "no-cache" }); }
  catch (e) { throw new RegistryError(`Could not fetch ${REGISTRY_PATH}: ${e && e.message ? e.message : e}`); }
  if (!res.ok) throw new RegistryError(`HTTP ${res.status} fetching ${REGISTRY_PATH}`);
  let reg;
  try { reg = JSON.parse(await res.text()); }
  catch (e) { throw new RegistryError(`Not valid JSON: ${e.message} (${REGISTRY_PATH})`); }
  if (!reg || reg.format !== FORMAT.registry || !Array.isArray(reg.modules)) {
    throw new RegistryError(`Not a screenAIr registry (${REGISTRY_PATH})`);
  }
  const listed = reg.modules.filter(m => m && typeof m.rubric === "string" && typeof m.logic === "string");
  // The default first (§5.2), the rest in registry order.
  return [...listed.filter(m => m.default === true), ...listed.filter(m => m.default !== true)];
}

/**
 * Load one registry entry through the §3.8 path:
 * bytes → limits → strict UTF-8 → SHA-256 → JSON.parse / importSource → bindModule → validateModule.
 */
async function loadOne(item, index, { env, loaded }) {
  const at = p => new URL(p, env.appBase).href;
  const docs = Array.isArray(item.docs) ? item.docs.slice() : [];
  const entry = {
    key: `builtin:${index}`,
    origin: "builtin",
    classification: null,
    module: null,
    validation: null,
    files: {
      rubric: { name: item.rubric, text: "", sha256: "" },
      logic: { name: item.logic, text: "", sha256: "" },
    },
    loadedAt: now(),
    // Not in the contract typedef: what the picker shows when `module` is null
    // ("<label> (failed to load)", §5.2) and whether registry.json marks it default.
    label: fallbackLabel(item.rubric),
    isDefault: item.default === true,
  };
  try {
    const [rubricBytes, logicBytes] = await Promise.all([
      fetchBytes(at(item.rubric), item.rubric),
      fetchBytes(at(item.logic), item.logic),
    ]);
    checkSize(rubricBytes, LIMITS.rubricBytes, item.rubric);
    const rubricText = decodeUtf8(rubricBytes, item.rubric);
    const logicText = decodeUtf8(logicBytes, item.logic);
    const [rubricSha, logicSha] = await Promise.all([sha256Hex(rubricBytes), sha256Hex(logicBytes)]);
    entry.files.rubric = { name: item.rubric, text: rubricText, sha256: rubricSha };
    entry.files.logic = { name: item.logic, text: logicText, sha256: logicSha };

    let rubric;
    try { rubric = JSON.parse(rubricText); }
    catch (e) { throw new LoadError("LOAD", item.rubric, `Not valid JSON: ${e.message}`); }
    if (rubric && typeof rubric.id === "string") entry.key = `builtin:${rubric.id}`;
    if (rubric && typeof rubric.label === "string") entry.label = rubric.label;

    let logicNs;
    try {
      logicNs = await env.loader.importSource(logicText, {
        filename: item.logic, byteLength: logicBytes.byteLength, maxBytes: LIMITS.logicBytes,
      });
    } catch (e) { throw new LoadError("LOGIC", item.logic, e && e.message ? e.message : String(e)); }

    let module;
    try {
      module = await bindModule(rubric, logicNs.default, {
        origin: "builtin",
        classification: "builtin",
        key: entry.key,
        sources: { rubricText, logicText },
        files: entry.files,
        docs,
        loadedAt: entry.loadedAt,
      });
    } catch (e) { throw new LoadError(e && e.code ? e.code : "BIND", e && e.path ? e.path : item.rubric, e && e.message ? e.message : String(e)); }

    entry.module = module;
    entry.classification = module && module.classification ? module.classification : null;
    if (module && typeof module.label === "string") entry.label = module.label;
    entry.validation = await validateModule({ module, loaded });
  } catch (err) {
    entry.validation = failureReport(err, item.rubric);
  }
  return entry;
}

/**
 * Load every built-in listed in app/modules/registry.json (§3.8), the default first.
 * A built-in that fails to fetch, parse, import, bind or validate is still returned, with
 * `module` null or `validation.ok` false, so the picker can list it and the shell can show
 * InvalidModule; it never mounts an app. Only a failure of registry.json itself throws.
 * @param {{env: Object}} args  env: the page's Env typedef (engine/contract.js), {loader, appBase}
 * @returns {Promise<Array<Object>>} RegistryEntry[]
 */
export async function loadBuiltins({ env }) {
  if (!env || typeof env.appBase !== "string" || !env.loader) {
    throw new RegistryError("loadBuiltins needs env = {loader, appBase} from the page (design §6.4)");
  }
  const items = await readRegistry(env);
  const entries = [];
  for (let i = 0; i < items.length; i++) {
    // Sequential: each validation sees the modules loaded before it (V8 uniqueness).
    // `loaded` is BoundModule[] (V8: "unique among loaded modules"), never entries: an
    // entry that failed before binding has no module and takes no part in V8.
    const loaded = entries.filter(e => e.module).map(e => e.module);
    entries.push(await loadOne(items[i], i, { env, loaded }));
  }
  return entries;
}

// ----------------------------------------------------------------------- M3 (names final)

const m3 = name => () => { throw new Error(`not implemented: WP12 M3 (${name})`); };

export const classifyFiles = m3("classifyFiles");
export const prepareUpload = m3("prepareUpload");
export const register = m3("register");
export const unregister = m3("unregister");
export const saveModule = m3("saveModule");
export const listSaved = m3("listSaved");
export const restoreSaved = m3("restoreSaved");
export const forgetSaved = m3("forgetSaved");
