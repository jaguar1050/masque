// shell/registry.js — module registry (design 03 §3.8, §3.9, §3.11, §5.2). Owner: WP12.
//
// loadBuiltins({env}) is the one load path every built-in goes through, and the path an
// upload shares (D3): bytes → limits → strict UTF-8 → SHA-256 → JSON.parse / importSource →
// bindModule → validateModule. The upload path adds classification before anything runs
// (classifyFiles: kinds from bytes, SHA-256 and inspectSource only), consent-gated import of
// JavaScript, pairing (§3.9), lineage classification (§3.11) and validation (prepareUpload).
// Rubrics made by the editor, by "Load as derived" and by a restore from this browser go
// through the same binding (prepareRubric), so nothing a file claims about itself is trusted.
//
// Every module-data path resolves against env.appBase (the app/ folder), never against the
// page (D25). No module literal lives here: the list of built-ins is modules/registry.json.
// The session list (register / unregister) is plain module state; nothing happens at import.

import { bindModule, parseRubricText, serializeRubric } from "../engine/bind.js";
import { validateModule } from "../engine/validate.js";
import { sha256Hex } from "../engine/hash.js";
import { LIMITS, SITE } from "../engine/policy.js";
import { CONTRACT_VERSION, FORMAT } from "../engine/contract.js";
import { classifyLineage } from "../engine/lineage.js";
import { unzip } from "../engine/zip.js";

/** Registry file, relative to app/. */
export const REGISTRY_PATH = "./modules/registry.json";

/** localStorage key of the modules remembered in this browser (D20). */
export const SAVED_KEY = "screenair.saved.v1";

/** Thrown for a failure of the registry file itself (no entry can be built). */
export class RegistryError extends Error {
  constructor(message) { super(message); this.name = "RegistryError"; }
}

/** Failure at one stage of loading a built-in; becomes a ValidationReport error. */
class LoadError extends Error {
  constructor(code, path, message) { super(message); this.name = "LoadError"; this.code = code; this.path = path; }
}

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const now = () => new Date().toISOString();
const msgOf = (e) => (e && e.message ? String(e.message) : String(e));

/** The exact first sentences of the upload dialog's messages (§5.2 item 6). */
export const UPLOAD_MESSAGES = {
  notScreenair: "Not a screenAIr file",
  spreadsheet: "Spreadsheets and documents are not supported. Download the current module's rubric (.json) and edit its weights, or use the Rubric Editor.",
  newer: "Made for a newer screenAIr",
  notJson: "Not valid JSON",
  notUtf8: "Not valid UTF-8",
  tooLarge: "Too large",
  tooMany: "Too many files",
  jsDisabled: "JavaScript modules are disabled on this site; upload a JSON rubric",
  logicAlone: "Logic file without a rubric: select the rubric JSON together with it",
  needsLogic: "Needs the logic file for '{moduleId}'",
  reservedLogic: "Logic id '{moduleId}' is reserved for the built-in logic",
  consent: "This file contains executable code and was not run: consent is required",
  noDefault: "{file} has no default export",
  imports: "{file} imports other files (line {line}): logic files must be self-contained",
  notLogic: "{file} is not a screenAIr logic or module file (its default export's format must be \"screenair-logic\" or \"screenair-module\")",
  zipNoManifest: "Not a screenAIr file (the zip has no screenAIr manifest.json)",
};

const SPREADSHEET_EXT = /\.(csv|tsv|xls|xlsx|ods|doc|docx|pdf)$/i;
const JS_EXT = /\.(js|mjs)$/i;
const JSON_EXT = /\.json$/i;
const ZIP_EXT = /\.zip$/i;

/**
 * A readable name for a built-in whose rubric could not be read, so the picker shows
 * "<name> (failed to load)" rather than the path: the rubric file's name without its
 * directory and its ".rubric.json" / ".json" suffix. Replaced by the rubric's own label as
 * soon as the rubric parses.
 */
function fallbackLabel(path) {
  const base = String(path).split(/[\\/]/).pop() || String(path);
  return base.replace(/\.rubric\.json$/i, "").replace(/\.json$/i, "") || base;
}

async function fetchBytes(url, path) {
  let res;
  try { res = await fetch(url, { cache: "no-cache" }); }
  catch (e) { throw new LoadError("LOAD", path, `Could not fetch ${path}: ${msgOf(e)}`); }
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
  return { ok: false, errors: [{ path, code, msg: msgOf(err) }], warnings: [], info: {} };
}

/** Read and check modules/registry.json. */
async function readRegistry(env) {
  const url = new URL(REGISTRY_PATH, env.appBase).href;
  let res;
  try { res = await fetch(url, { cache: "no-cache" }); }
  catch (e) { throw new RegistryError(`Could not fetch ${REGISTRY_PATH}: ${msgOf(e)}`); }
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

/** Load one registry entry through the §3.8 path. */
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
    // F8: what the picker shows when `module` is null ("<label> (failed to load)", §5.2)
    // and whether registry.json marks it default.
    label: fallbackLabel(item.rubric),
    isDefault: item.default === true,
    docs,
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
    } catch (e) { throw new LoadError("LOGIC", item.logic, msgOf(e)); }

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
    } catch (e) { throw new LoadError(e && e.code ? e.code : "BIND", e && e.path ? e.path : item.rubric, msgOf(e)); }

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
 * Load every built-in listed in modules/registry.json (§3.8), the default first.
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
    // `loaded` is BoundModule[] (F4), never entries.
    const loaded = entries.filter(e => e.module).map(e => e.module);
    entries.push(await loadOne(items[i], i, { env, loaded }));
  }
  return entries;
}

// ============================================================================ helpers

/** Modules of the entries that loaded and validated (F4: failed entries are never passed). */
export function loadedModules(entries) {
  return arr(entries).filter(e => e && e.module && (!e.validation || e.validation.ok !== false)).map(e => e.module);
}

function builtinModules(entries) {
  return loadedModules(entries).filter(m => m.origin === "builtin");
}

/** Logic objects of loaded modules: {moduleId, sha256, logic, text, name, builtin, label}. */
function loadedLogics(entries) {
  const out = [];
  for (const e of arr(entries)) {
    const m = e && e.module;
    if (!m || !m.logic || !m.hashes || !m.hashes.logicSha256 || typeof m.logic.moduleId !== "string") continue;
    if (e.validation && e.validation.ok === false) continue;
    out.push({
      moduleId: m.logic.moduleId, sha256: m.hashes.logicSha256, logic: m.logic,
      text: m.sources && typeof m.sources.logicText === "string" ? m.sources.logicText : (e.files && e.files.logic ? e.files.logic.text : null),
      name: e.files && e.files.logic ? e.files.logic.name : `${m.logic.moduleId}.logic.js`,
      builtin: m.origin === "builtin", label: m.label,
    });
  }
  return out;
}

function fill(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (w, k) => (vars[k] === undefined ? w : String(vars[k])));
}

function ext(name) {
  const m = /\.[^./\\]+$/.exec(String(name));
  return m ? m[0].toLowerCase() : "";
}

/** "file.js: Unexpected token (4:32)" → "file.js line 4:32: Unexpected token". */
export function formatSyntaxError(file, message) {
  const first = String(message).split("\n")[0];
  const stripped = first.startsWith(`${file}: `) ? first.slice(file.length + 2) : first.replace(/^[^:]*\.(?:m?js|txt): /, "");
  const m = /^(.*?)\s*\((\d+):(\d+)\)\s*$/.exec(stripped);
  return m ? `${file} line ${m[2]}:${m[3]}: ${m[1]}` : `${file}: ${stripped}`;
}

async function bytesOf(f) {
  if (f instanceof Uint8Array) return f;
  if (f && f.bytes instanceof Uint8Array) return f.bytes;
  if (f && f.bytes instanceof ArrayBuffer) return new Uint8Array(f.bytes);
  if (f && typeof f.arrayBuffer === "function") return new Uint8Array(await f.arrayBuffer());
  throw new Error("not a file");
}

// ============================================================================ classifyFiles

/**
 * @typedef {Object} Classified
 * @property {string} name          file name (zip members: "<zip> › <path>")
 * @property {number} size          bytes
 * @property {string} sha256
 * @property {Uint8Array} bytes
 * @property {string|null} text     decoded UTF-8 text (json / js)
 * @property {string} kind          "rubric" | "builtin-logic" | "logic" | "module" | "executable" | "zip" | "error"
 * @property {Object|null} rubric   parsed rubric (kind "rubric")
 * @property {Object|null} inspect  inspectSource result (js)
 * @property {Object|null} builtin  {moduleId, sha256, label} of the recognised built-in logic
 * @property {boolean} needsConsent
 * @property {string|null} error    the refusal, exact first sentence first
 * @property {string[]} warnings
 * @property {string} kindLabel     what the dialog's table shows
 * @property {string} intended      the intended binding, in words
 * @property {string|null} zip      the zip it came from
 * @property {string|null} path     its path inside the zip
 */

function classifiedBase(name, bytes, sha256, zip = null, path = null) {
  return {
    name, size: bytes.byteLength, sha256, bytes, text: null, kind: "error", rubric: null, inspect: null,
    builtin: null, needsConsent: false, error: null, warnings: [], kindLabel: "—", intended: "—", zip, path,
  };
}

async function classifyOne(name, bytes, { entries, env, zip = null, path = null }) {
  const sha256 = await sha256Hex(bytes);
  const c = classifiedBase(name, bytes, sha256, zip, path);
  const e = ext(path || name);
  if (SPREADSHEET_EXT.test(path || name)) { c.error = UPLOAD_MESSAGES.spreadsheet; c.kindLabel = "spreadsheet or document"; return c; }

  if (e === ".json") {
    c.kindLabel = "JSON";
    if (bytes.byteLength > LIMITS.rubricBytes) { c.error = `${UPLOAD_MESSAGES.tooLarge} (${bytes.byteLength} > ${LIMITS.rubricBytes})`; return c; }
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (_) { c.error = UPLOAD_MESSAGES.notUtf8; return c; }
    c.text = text;
    let parsed;
    try {
      const r = parseRubricText(text);
      parsed = r.rubric;
      c.warnings.push(...r.warnings);
    } catch (err) {
      c.error = msgOf(err).startsWith(UPLOAD_MESSAGES.notJson) ? msgOf(err) : `${UPLOAD_MESSAGES.notJson}: ${msgOf(err)}`;
      return c;
    }
    if (!isObj(parsed) || parsed.format !== FORMAT.rubric) {
      c.error = isObj(parsed) && parsed.format === FORMAT.export
        ? `${UPLOAD_MESSAGES.notScreenair}: this is the manifest of a screenAIr download; upload the whole .zip`
        : UPLOAD_MESSAGES.notScreenair;
      return c;
    }
    if (typeof parsed.contractVersion === "number" && parsed.contractVersion > CONTRACT_VERSION) {
      c.error = `${UPLOAD_MESSAGES.newer} (contractVersion ${parsed.contractVersion}; this screenAIr reads ${CONTRACT_VERSION})`;
      return c;
    }
    c.kind = "rubric";
    c.rubric = parsed;
    c.kindLabel = "rubric (JSON, no code)";
    const lb = parsed.logicBinding;
    c.intended = lb === "generic"
      ? `module '${parsed.id}' · generic logic (no code)`
      : `module '${parsed.id}' · logic '${isObj(lb) ? lb.moduleId : "?"}'${isObj(lb) && lb.logicSha256 ? ` (sha256 ${String(lb.logicSha256).slice(0, 8)})` : ""}`;
    return c;
  }

  if (JS_EXT.test(path || name)) {
    c.kindLabel = "JavaScript";
    if (bytes.byteLength > LIMITS.logicBytes) { c.error = `${UPLOAD_MESSAGES.tooLarge} (${bytes.byteLength} > ${LIMITS.logicBytes})`; return c; }
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (_) { c.error = UPLOAD_MESSAGES.notUtf8; return c; }
    c.text = text;
    // A loaded built-in's logic, by hash alone: not executed, no consent (§3.9).
    const known = loadedLogics(entries).find(l => l.builtin && l.sha256 === sha256);
    if (known) {
      c.kind = "builtin-logic";
      c.builtin = { moduleId: known.moduleId, sha256: known.sha256, label: known.label };
      c.kindLabel = "built-in logic (not run)";
      c.intended = `the loaded logic of ${known.label}`;
      return c;
    }
    if (!SITE.ALLOW_JS_UPLOAD) { c.error = UPLOAD_MESSAGES.jsDisabled; return c; }
    const file = path ? path.split("/").pop() : name;
    let insp;
    try { insp = env.loader.inspectSource(text, { filename: file }); }
    catch (err) { c.error = `${file}: ${msgOf(err)}`; return c; }
    c.inspect = insp;
    if (insp.syntaxError) { c.error = formatSyntaxError(file, insp.syntaxError); return c; }
    if (arr(insp.importSites).length) {
      c.error = fill(UPLOAD_MESSAGES.imports, { file, line: arr(insp.importSites).map(s => String(s).split(":")[0]).join(", ") });
      return c;
    }
    if (!insp.hasDefaultExport) { c.error = fill(UPLOAD_MESSAGES.noDefault, { file }); return c; }
    c.needsConsent = true;
    if (insp.format === FORMAT.logic) { c.kind = "logic"; c.kindLabel = "logic (executable)"; c.intended = "pairs with its rubric in this upload"; }
    else if (insp.format === FORMAT.module) { c.kind = "module"; c.kindLabel = "module (executable)"; c.intended = "rubric and logic in one file"; }
    else if (insp.format === null || insp.format === undefined) { c.kind = "executable"; c.kindLabel = "executable (kind determined after consent)"; c.intended = "determined after consent"; }
    else { c.needsConsent = false; c.error = fill(UPLOAD_MESSAGES.notLogic, { file }); }
    return c;
  }

  if (e === ".zip") {
    c.kindLabel = "zip";
    if (bytes.byteLength > LIMITS.zipBytes) { c.error = `${UPLOAD_MESSAGES.tooLarge} (${bytes.byteLength} > ${LIMITS.zipBytes})`; return c; }
    c.kind = "zip";
    return c;
  }

  c.error = UPLOAD_MESSAGES.notScreenair;
  return c;
}

/**
 * Classify the selected files before anything runs (§3.9, §5.2 item 2): bytes, size against
 * LIMITS, UTF-8, SHA-256, then the kind. A .js whose SHA-256 equals a loaded built-in's logic
 * is "built-in logic (not run)"; any other .js is read by env.loader.inspectSource (parse
 * only). A .zip from Download-all is unpacked and each module file in it classified (its
 * documentation, generated and research files are listed nowhere and never run).
 * @param {Array<File|{name:string, bytes:Uint8Array}>} files
 * @param {{entries: Object[], env: Object}} ctx
 * @returns {Promise<Classified[]>}
 */
export async function classifyFiles(files, { entries = [], env } = {}) {
  const list = arr(files);
  const out = [];
  if (list.length > LIMITS.uploadFiles) {
    for (const f of list) {
      const bytes = new Uint8Array(0);
      const c = classifiedBase(f && f.name ? f.name : "?", bytes, "");
      c.error = `${UPLOAD_MESSAGES.tooMany} (${list.length} > ${LIMITS.uploadFiles})`;
      out.push(c);
    }
    return out;
  }
  for (const f of list) {
    const name = f && f.name ? String(f.name) : "file";
    let bytes;
    try { bytes = await bytesOf(f); }
    catch (err) { const c = classifiedBase(name, new Uint8Array(0), ""); c.error = `Could not read ${name}: ${msgOf(err)}`; out.push(c); continue; }
    const c = await classifyOne(name, bytes, { entries, env });
    if (c.kind !== "zip" || c.error) { out.push(c); continue; }
    // Unpack a Download-all zip (§5.8): its manifest says what it is.
    let members;
    try { members = await unzip(bytes); }
    catch (err) { c.kind = "error"; c.error = `${name}: ${msgOf(err)}`; out.push(c); continue; }
    const manifestFile = members.find(m => m.name === "manifest.json");
    let manifest = null;
    if (manifestFile) {
      try { manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestFile.bytes)); } catch (_) { manifest = null; }
    }
    if (!manifest || manifest.format !== FORMAT.export) { c.kind = "error"; c.error = UPLOAD_MESSAGES.zipNoManifest; out.push(c); continue; }
    c.kindLabel = `screenAIr download (${arr(manifest.modules).length} module${arr(manifest.modules).length === 1 ? "" : "s"})`;
    c.intended = "each module inside is classified below";
    c.manifest = manifest;
    out.push(c);
    // Module files sit at <id>/<id>.rubric.json and <id>/<id>.logic.js; documentation,
    // generated/ and research/ files are not module files.
    const moduleFiles = members.filter(m => {
      const parts = m.name.split("/");
      return parts.length === 2 && (/\.rubric\.json$/i.test(parts[1]) || /\.logic\.m?js$/i.test(parts[1]));
    });
    for (const m of moduleFiles) out.push(await classifyOne(`${name} › ${m.name}`, m.bytes, { entries, env, zip: name, path: m.name }));
  }
  return out;
}

// ============================================================================ prepareUpload

let keySeq = 0;
function uniqueKey(base, taken) {
  let key = base;
  while (taken.has(key)) key = `${base}#${++keySeq}`;
  taken.add(key);
  return key;
}

/**
 * Bind one rubric unit (§3.9 binding, §3.11 classification) and validate it.
 * @returns {Promise<Object>} PrepareResult
 */
async function bindUnit(unit, ctx) {
  const { rubric } = unit;
  const result = {
    file: unit.fileName, files: unit.fileNames || [unit.fileName], id: isObj(rubric) && typeof rubric.id === "string" ? rubric.id : null,
    label: isObj(rubric) && typeof rubric.label === "string" ? rubric.label : (unit.fileName || "module"),
    entry: null, report: null, classification: null, errors: [], warnings: [...arr(unit.warnings)], skipped: null, rederive: null,
  };
  if (!isObj(rubric) || rubric.format !== FORMAT.rubric) { result.errors.push(UPLOAD_MESSAGES.notScreenair); return result; }

  // 1. The logic it binds to (§3.9 "Binding a rubric").
  let logicObj = null;
  let logic = null; // {name, text, sha256, bytes?, inspect?, uploaded}
  const lb = rubric.logicBinding;
  if (unit.logic) {
    logicObj = unit.logic.logic;
    logic = unit.logic;
    unit.logic.used = true;
  } else if (isObj(lb) && typeof lb.moduleId === "string") {
    const sha = typeof lb.logicSha256 === "string" ? lb.logicSha256 : null;
    // Logic in the same upload, the copy in the rubric's own folder first (a Download-all zip).
    const dir = (n) => String(n || "").replace(/[^/›]*$/, "");
    const pool = ctx.pool.filter(l => l.moduleId === lb.moduleId)
      .map((l, i) => [l, i]).sort((a, b) => (dir(b[0].file) === dir(unit.fileName)) - (dir(a[0].file) === dir(unit.fileName)) || a[1] - b[1]).map(x => x[0]);
    const loaded = loadedLogics(ctx.entries).filter(l => l.moduleId === lb.moduleId);
    let hit = pool.find(l => !sha || l.sha256 === sha) || null;
    if (!hit && sha) hit = loaded.find(l => l.sha256 === sha) || null;
    if (!hit && !sha) hit = loaded.find(l => l.builtin) || null;
    if (!hit && sha && loaded.length) {
      hit = loaded[0];
      result.warnings.push(`this rubric was created against logic ${sha.slice(0, 8)}, binding to ${hit.sha256.slice(0, 8)}`);
    }
    if (!hit) { result.errors.push(fill(UPLOAD_MESSAGES.needsLogic, { moduleId: lb.moduleId })); return result; }
    hit.used = true;
    // The uploaded file this unit actually bound to (a loaded logic has none), for its provenance.
    if (hit.file) unit.boundLogicFile = hit.file;
    logicObj = hit.logic;
    logic = { name: hit.name, text: hit.text, sha256: hit.sha256, bytes: hit.bytes || null, inspect: hit.inspect || null, uploaded: !!hit.uploaded };
  } else if (lb !== "generic") {
    // bindModule reports the malformed binding (V5) by path.
  }

  // 2. Classification (§3.11): never read from the file.
  const builtins = builtinModules(ctx.entries);
  const loadedMods = [...loadedModules(ctx.entries), ...ctx.batch];
  let classification;
  try {
    classification = await classifyLineage(rubric, {
      builtins, loaded: loadedMods, sameUpload: ctx.sameUpload.filter(u => u !== unit).map(u => ({ rubric: u.rubric, rubricSha256: u.rubricSha256 })),
      logicSha256: logic ? logic.sha256 : null, rubricSha256: unit.rubricSha256 || null,
    });
  } catch (err) { result.errors.push(`Could not classify ${unit.fileName}: ${msgOf(err)}`); return result; }
  result.classification = classification;
  if (classification.kind === "duplicate") {
    result.skipped = `already loaded: ${classification.root ? classification.root.label : result.label}`;
    return result;
  }
  if (classification.kind === "rederive") {
    result.errors.push(...arr(classification.reasons));
    result.rederive = { root: classification.root, reasons: arr(classification.reasons), rubric, rubricText: unit.rubricText, rubricSha256: unit.rubricSha256, fileName: unit.fileName };
    return result;
  }

  // 3. Bind with the origin the classification assigns.
  const origin = classification.origin;
  const key = uniqueKey(`${origin === "derived" ? "derived" : "upload"}:${result.id || "module"}`, ctx.keys);
  const loadedAt = now();
  const files = {
    rubric: { name: unit.fileName, text: unit.rubricText, sha256: unit.rubricSha256 },
    logic: logic ? { name: logic.name, text: logic.text, sha256: logic.sha256 } : null,
  };
  let module;
  try {
    module = await bindModule(rubric, logicObj, {
      origin, classification, key,
      sources: { rubricText: unit.rubricText, logicText: logic ? logic.text : null },
      files, loadedAt, logicSha256: logic ? logic.sha256 : undefined,
    });
  } catch (err) {
    result.errors.push(msgOf(err));
    return result;
  }
  const root = classification.kind === "verified" || classification.kind === "derived-from-upload" ? classification.root : null;
  const upload = unit.upload ? {
    rubric: unit.rubricBytes ? { bytes: unit.rubricBytes } : undefined,
    logic: logic && logic.uploaded ? { bytes: logic.bytes || undefined, text: logic.text } : undefined,
    inspect: logic && logic.uploaded ? logic.inspect || undefined : undefined,
  } : null;
  const report = await validateModule({ module, loaded: loadedMods, root, upload });
  result.report = report;
  result.label = module.label;
  for (const b of arr(module.bindIssues)) result.warnings.push(`${b.code} · ${b.path} · ${b.msg}`);
  if (!report.ok) {
    const n = report.errors.length;
    result.errors.push(`${n} validation error${n === 1 ? "" : "s"}`);
    return result;
  }
  result.entry = {
    key, origin, classification, module, validation: report, files, loadedAt,
    label: module.label, isDefault: false,
    sourceFileNames: unit.fileNames || [unit.fileName],
    jsonOnly: !(logic && logic.uploaded),
  };
  ctx.batch.push(module);
  return result;
}

function newCtx(entries) {
  return {
    entries: arr(entries),
    pool: [],
    batch: [],
    sameUpload: [],
    keys: new Set(arr(entries).map(e => e && e.key).filter(Boolean)),
  };
}

/** Units without a provenance root first, so a root uploaded together with its derivation binds first (§3.11 row 6). */
function rootsFirst(units) {
  const depth = (u) => (isObj(u.rubric) && isObj(u.rubric.provenance) ? arr(u.rubric.provenance.lineage).length + 1 : 0);
  return units.map((u, i) => [u, i]).sort((a, b) => depth(a[0]) - depth(b[0]) || a[1] - b[1]).map(x => x[0]);
}

/**
 * Validate an upload (§5.2 item 4). Consented JavaScript is imported with
 * env.loader.importSource; a .js recognised as built-in logic binds to the loaded logic
 * object, never to the uploaded bytes. Rubrics are paired with logic (§3.9), classified
 * (§3.11), bound and validated against `entries` and each other. Nothing is registered.
 * @param {Classified[]} classified
 * @param {{entries: Object[], consent: boolean, env: Object}} ctx
 * @returns {Promise<Array<{file:string, files:string[], id:(string|null), label:string, entry:(Object|null),
 *   report:(Object|null), classification:(Object|null), errors:string[], warnings:string[], skipped:(string|null),
 *   rederive:(Object|null)}>>}
 */
export async function prepareUpload(classified, { entries = [], consent = false, env } = {}) {
  const ctx = newCtx(entries);
  const results = [];
  const fileResult = (c, error) => ({
    file: c.name, files: [c.name], id: null, label: c.name, entry: null, report: null, classification: null,
    errors: [error], warnings: [...arr(c.warnings)], skipped: null, rederive: null,
  });
  const units = [];
  const logicFiles = [];
  const builtinNames = new Set(loadedLogics(entries).filter(l => l.builtin).map(l => l.moduleId));
  const builtinShaById = new Map(loadedLogics(entries).filter(l => l.builtin).map(l => [l.moduleId, l.sha256]));

  for (const c of arr(classified)) {
    if (c.kind === "zip" && !c.error) continue;
    if (c.error) { results.push(fileResult(c, c.error)); continue; }
    if (c.kind === "rubric") {
      units.push({ rubric: c.rubric, rubricText: c.text, rubricBytes: c.bytes, rubricSha256: c.sha256, fileName: c.name, fileNames: [c.name], warnings: c.warnings, upload: true });
      continue;
    }
    if (c.kind === "builtin-logic") {
      const l = loadedLogics(entries).find(x => x.sha256 === c.sha256);
      const pooled = l ? { ...l, file: c.name, used: false, uploaded: false } : null;
      if (pooled) ctx.pool.push(pooled);
      logicFiles.push({ c, pooled });
      continue;
    }
    // Executable: logic, module or unknown kind. Runs only with consent.
    if (!SITE.ALLOW_JS_UPLOAD) { results.push(fileResult(c, UPLOAD_MESSAGES.jsDisabled)); continue; }
    if (!consent) { results.push(fileResult(c, UPLOAD_MESSAGES.consent)); continue; }
    const file = c.path ? c.path.split("/").pop() : c.name;
    let ns;
    try {
      ns = await env.loader.importSource(c.text, { filename: file, byteLength: c.size, maxBytes: LIMITS.logicBytes });
    } catch (err) {
      const m = msgOf(err);
      const formatted = /imports other files|has no default export|too large/i.test(m) ? m.split("\n")[0] : formatSyntaxError(file, m);
      results.push(fileResult(c, formatted));
      continue;
    }
    const def = ns && ns.default;
    if (isObj(def) && def.format === FORMAT.logic && typeof def.moduleId === "string") {
      if (builtinNames.has(def.moduleId) && builtinShaById.get(def.moduleId) !== c.sha256) {
        results.push(fileResult(c, fill(UPLOAD_MESSAGES.reservedLogic, { moduleId: def.moduleId })));
        continue;
      }
      const item = { moduleId: def.moduleId, sha256: c.sha256, logic: def, text: c.text, name: file, file: c.name, bytes: c.bytes, inspect: c.inspect, uploaded: true, used: false };
      ctx.pool.push(item);
      logicFiles.push({ c, pooled: item });
      continue;
    }
    if (isObj(def) && def.format === FORMAT.module) {
      if (typeof def.contractVersion === "number" && def.contractVersion > CONTRACT_VERSION) {
        results.push(fileResult(c, `${UPLOAD_MESSAGES.newer} (contractVersion ${def.contractVersion}; this screenAIr reads ${CONTRACT_VERSION})`));
        continue;
      }
      if (!isObj(def.rubric) || !isObj(def.logic)) { results.push(fileResult(c, `${file}: a screenair-module needs a rubric object and a logic object`)); continue; }
      const lg = def.logic;
      if (typeof lg.moduleId === "string" && builtinNames.has(lg.moduleId) && builtinShaById.get(lg.moduleId) !== c.sha256) {
        results.push(fileResult(c, fill(UPLOAD_MESSAGES.reservedLogic, { moduleId: lg.moduleId })));
        continue;
      }
      let rubricText;
      try { rubricText = serializeRubric(def.rubric); }
      catch (err) { results.push(fileResult(c, `${file}: the module's rubric is not plain JSON (${msgOf(err)})`)); continue; }
      units.push({
        rubric: def.rubric, rubricText, rubricBytes: null, rubricSha256: await sha256Hex(rubricText), fileName: c.name, fileNames: [c.name],
        warnings: c.warnings, upload: true,
        logic: { logic: lg, text: c.text, sha256: c.sha256, name: file, bytes: c.bytes, inspect: c.inspect, uploaded: true },
      });
      // Its logic can also bind a rubric of the same upload (a derivation exported beside it).
      if (typeof lg.moduleId === "string") {
        ctx.pool.push({ moduleId: lg.moduleId, sha256: c.sha256, logic: lg, text: c.text, name: file, file: c.name, bytes: c.bytes, inspect: c.inspect, uploaded: true, used: false });
      }
      continue;
    }
    results.push(fileResult(c, fill(UPLOAD_MESSAGES.notLogic, { file })));
  }

  ctx.sameUpload = units;
  for (const u of rootsFirst(units)) {
    const r = await bindUnit(u, ctx);
    if (r.entry && u.fileNames) {
      // Only the logic file this unit bound to: the pool's `used` flag is shared by every unit.
      const own = u.boundLogicFile && !u.fileNames.includes(u.boundLogicFile) ? [u.boundLogicFile] : [];
      r.files = [...u.fileNames, ...own];
      r.entry.sourceFileNames = r.files;
    }
    results.push(r);
  }
  for (const { c, pooled } of logicFiles) {
    if (pooled && pooled.used) continue;
    // A built-in's own logic that came with a skipped duplicate is not an error.
    if (c.kind === "builtin-logic" && results.some(r => r.skipped)) continue;
    results.push(fileResult(c, UPLOAD_MESSAGES.logicAlone));
  }
  return results;
}

/**
 * Bind a rubric made inside this page — the editor's Apply, the upload dialog's "Load as
 * derived", a restore from this browser — exactly as an upload of its JSON would be: it is
 * classified (§3.11), paired with a loaded logic by moduleId and SHA-256 (§3.9), bound and
 * validated. Nothing is registered.
 * @param {Object} rubric
 * @param {{entries: Object[], env?: Object, fileName?: string, rubricText?: string}} ctx
 * @returns {Promise<Object>} the PrepareResult of prepareUpload
 */
export async function prepareRubric(rubric, { entries = [], fileName = null, rubricText = null } = {}) {
  const text = typeof rubricText === "string" ? rubricText : serializeRubric(rubric);
  const name = fileName || `${isObj(rubric) && rubric.id ? rubric.id : "module"}.rubric.json`;
  const ctx = newCtx(entries);
  const unit = { rubric, rubricText: text, rubricBytes: null, rubricSha256: await sha256Hex(text), fileName: name, fileNames: [name], warnings: [], upload: false };
  ctx.sameUpload = [unit];
  return bindUnit(unit, ctx);
}

// ============================================================================ session list

// The modules loaded in this page, in load order (built-ins first). Plain module state:
// created empty, changed only by register / unregister.
let SESSION = [];

/** The entries registered in this page. */
export function registered() {
  return SESSION.slice();
}

/**
 * Add an entry to the session list (or replace the entry with the same key). A non-built-in
 * whose module id is already registered under another key is refused.
 * @returns {Object[]} the new list
 */
export function register(entry) {
  if (!entry || typeof entry.key !== "string") throw new Error("register: an entry needs a key");
  const id = entry.module ? entry.module.id : null;
  if (id && entry.origin !== "builtin" && SESSION.some(e => e.key !== entry.key && e.module && e.module.id === id)) {
    throw new Error(`Module id '${id}' is already loaded`);
  }
  // A built-in reloaded (Retry) replaces its earlier entry, whose key may have been the
  // fallback "builtin:<index>" when its rubric did not parse: same registry.json rubric path.
  const path = entry.origin === "builtin" && entry.files && entry.files.rubric ? entry.files.rubric.name : null;
  const list = path ? SESSION.filter(e => !(e.origin === "builtin" && e.key !== entry.key && e.files && e.files.rubric && e.files.rubric.name === path)) : SESSION;
  const i = list.findIndex(e => e.key === entry.key);
  SESSION = i >= 0 ? [...list.slice(0, i), entry, ...list.slice(i + 1)] : [...list, entry];
  return registered();
}

/** Remove a non-built-in entry from the session list. @returns {Object[]} the new list */
export function unregister(key) {
  const e = SESSION.find(x => x.key === key);
  if (e && e.origin === "builtin") throw new Error("built-in modules cannot be removed");
  SESSION = SESSION.filter(x => x.key !== key);
  return registered();
}

/** Update fields of a registered entry (savedAt, downloadedAt). @returns {Object[]} the new list */
export function markEntry(key, fields) {
  SESSION = SESSION.map(e => (e.key === key ? { ...e, ...fields } : e));
  return registered();
}

// ============================================================================ saved modules

function readSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(x => isObj(x) && typeof x.id === "string" && typeof x.rubricText === "string") : [];
  } catch (_) { return []; }
}

function writeSaved(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); return true; }
  catch (_) { return false; }
}

/**
 * Remember a module in this browser (D20): the rubric text and a reference to its logic
 * (moduleId and SHA-256) — never logic source, never answers.
 * @returns {string|null} savedAt, or null when storage is unavailable
 */
export function saveModule(entry) {
  const m = entry && entry.module;
  if (!m || m.origin === "builtin") return null;
  const rubricText = entry.files && entry.files.rubric && typeof entry.files.rubric.text === "string" ? entry.files.rubric.text : serializeRubric(m.rubric);
  const logicRef = m.hashes && m.hashes.logicSha256 && m.logic && typeof m.logic.moduleId === "string"
    ? { moduleId: m.logic.moduleId, sha256: m.hashes.logicSha256, name: entry.files && entry.files.logic ? entry.files.logic.name : null }
    : null;
  const savedAt = now();
  const rec = { id: m.id, label: m.label, origin: m.origin, rubricText, logicRef, savedAt };
  const list = readSaved().filter(x => x.id !== m.id);
  return writeSaved([...list, rec]) ? savedAt : null;
}

/**
 * The modules remembered in this browser. `needsLogicUpload` is true when the recorded logic
 * is not loaded in this page (an uploaded logic file must be uploaded again).
 * @param {{entries?: Object[]}} [ctx]
 */
export function listSaved({ entries = registered() } = {}) {
  const logics = loadedLogics(entries);
  return readSaved().map(x => ({
    id: x.id, label: typeof x.label === "string" ? x.label : x.id, origin: typeof x.origin === "string" ? x.origin : "uploaded",
    logicRef: isObj(x.logicRef) ? x.logicRef : null, savedAt: x.savedAt || null,
    needsLogicUpload: isObj(x.logicRef) ? !logics.some(l => l.sha256 === x.logicRef.sha256) : false,
  }));
}

/**
 * Restore a remembered module. Only the stored rubric text is trusted, and even that goes
 * through classification and validation exactly as an upload does; the stored `origin` is
 * display-only. Throws with the reasons when it cannot load.
 * @returns {Promise<Object>} RegistryEntry
 */
export async function restoreSaved(id, { entries = registered() } = {}) {
  const rec = readSaved().find(x => x.id === id);
  if (!rec) throw new Error(`No module '${id}' is saved in this browser`);
  let rubric;
  try { rubric = parseRubricText(rec.rubricText).rubric; }
  catch (err) { throw new Error(`The saved copy of '${id}' is damaged: ${msgOf(err)}`); }
  if (isObj(rec.logicRef) && isObj(rubric.logicBinding) && !loadedLogics(entries).some(l => l.sha256 === rec.logicRef.sha256)) {
    throw new Error(`needs logic file ${rec.logicRef.name ? `\`${rec.logicRef.name}\` ` : ""}(sha256 ${String(rec.logicRef.sha256).slice(0, 16)}…): upload it together with the rubric`);
  }
  const r = await prepareRubric(rubric, { entries, rubricText: rec.rubricText, fileName: `${id}.rubric.json` });
  if (r.skipped) throw new Error(`'${rec.label || id}' is ${r.skipped}`);
  if (!r.entry) {
    const detail = r.report ? r.report.errors.slice(0, 5).map(e => `${e.code} · ${e.path} · ${e.msg}`) : [];
    throw new Error([...r.errors, ...detail].join("; "));
  }
  return { ...r.entry, savedAt: rec.savedAt || null };
}

/** Forget a remembered module. */
export function forgetSaved(id) {
  writeSaved(readSaved().filter(x => x.id !== id));
}
