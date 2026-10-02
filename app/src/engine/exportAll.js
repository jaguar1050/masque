// engine/exportAll.js — Download all (design 03 §5.8, §4.15). Owner: WP11.
//
// buildExportFiles(entries, {appVersion, now, fetchBytes}) lists every file of the export:
// README.txt, manifest.json and, per loaded module, its rubric, its logic bytes exactly as
// loaded, its change log or documentation, the generated artifacts and (built-ins with
// population estimates) the research files fetched byte-for-byte. A module that failed to
// load or validate contributes no files; the manifest lists it under `failed`. Names are
// sorted and nothing depends on the clock but `now`, so the same inputs give the same files,
// and zipStore turns them into the same bytes. The export never contains answers,
// transcripts, cohort rows or any patient data: it is built from modules only.
// No side effects at import time; fetchBytes is the only I/O, and the caller supplies it.
import { CONTRACT_VERSION, FORMAT } from "./contract.js";
import { APP_VERSION, CAVEATS } from "./policy.js";
import { serializeRubric } from "./bind.js";
import { sha256Hex, utf8Bytes } from "./hash.js";
import { buildCdsHooks, buildDataDictionary, buildQuestionnaire } from "./fhir.js";
import { cohortColumnsCsv } from "./cohort.js";
import { zipStore } from "./zip.js";

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);

/**
 * The README of every export. `{release}`, `{generatedAt}` and `{modules}` are filled in by
 * buildExportFiles. Engine chrome, English only; it names no module.
 */
export const README_TEXT = `screenAIr module export
=======================

Prototype · not for clinical use

Release:      {release}
Generated at: {generatedAt}

This archive holds the screening modules that were loaded in screenAIr when it was
downloaded, so they can be kept, reviewed, edited by hand and uploaded again. It contains
no answers, transcripts, captured cohort rows or any other patient data.

Modules in this archive
-----------------------
{modules}

What each file is
-----------------
manifest.json
    The index of this archive: release, contract version, and per module its id, label,
    origin (built-in, uploaded or derived), the five version axes, the hashes, its
    classification and provenance, its change log, its validation summary and the SHA-256
    of every file listed for it ("selfContained": true marks a module written as one .js).
    Modules that failed to load are listed under "failed", without files.
<id>/<id>.rubric.json
    The module's rubric: all of its data (domains, items, weights, scale factors, cut-points,
    red flags, wording, lexicon, research configuration, provenance and change log). A JSON
    rubric holds no code.
<id>/<id>.logic.js
    The module's logic, byte for byte as it was loaded (absent for a data-only module). This
    file is code. A derived module carries its root's logic unchanged. A module that was
    uploaded as one self-contained .js file (rubric and logic together) is written back as
    that same file, byte for byte, under this name, with no separate <id>.rubric.json: the
    rubric inside it is the one that loads, and a readable copy is in generated/.
<id>/CHANGELOG.md
    For uploaded and derived modules: the change log of the rubric, as text.
<id>/<document>
    For built-in modules: the documentation files the module ships with, byte for byte.
<id>/generated/
    GENERATED files, rebuilt from the rubric by this screenAIr release: the FHIR
    Questionnaire, the CDS Hooks service description, the data dictionary and the cohort
    CSV header; for a self-contained module, also <id>.rubric.json, a copy of the rubric
    inside its .logic.js. They are outputs, not inputs: uploading reads the rubric and the
    logic only.
<id>/research/
    For built-in modules with population estimates: the index, every estimate it lists, the
    schema and the phenotype map, byte for byte. The provenance files behind the estimates
    are in app/data/provenance/ and the ETL scripts in app/etl/ of the screenAIr source;
    they are not copied here.

The five version axes
---------------------
They are deliberately separate numbers; none of them implies another.
  release      the screenAIr application release (manifest.json "release")
  instrument   the questionnaire: items, weights, scale factors and cut-points
               (rubric "instrumentVersion")
  lexicon      the speech-capture phrases (rubric "lexicon.version")
  probe set    the follow-up questions of the Ambient Scribe (logic "probes.version")
  gold set     the benchmark the lexicon was measured against (rubric "lexicon.goldSet");
               an edited lexicon keeps its root's gold set, which was not re-run
A module edited in screenAIr carries "-local" in every version it changed, so it never
reads as an official instrument number.

How to upload again
-------------------
In screenAIr choose "Upload" in the Module menu, then select either
  - this whole .zip file, or
  - one rubric .json together with its .logic.js (select both files at once).
A derived module whose logic is a built-in's binds to the built-in logic by its SHA-256;
that file is not run. Any other .js file is code and asks for consent before it runs.
A rubric changed by hand after download loads as a new derived module, through a dialog
that asks for a change note and assigns "-local" versions.

Prototype · not for clinical use
`;

/** `screenair-modules-YYYY-MM-DD.zip` */
export function exportZipName(now) {
  return `screenair-modules-${String(now || new Date().toISOString()).slice(0, 10)}.zip`;
}

function basename(p) {
  return String(p).split(/[\\/]/).pop();
}

function cleanRel(p) {
  return String(p).replace(/^\.\//, "");
}

function serialClassification(c) {
  if (!isObj(c)) return null;
  const root = c.root && c.root.hashes ? {
    moduleId: c.root.id, label: c.root.label, origin: c.root.origin, instrumentVersion: c.root.instrumentVersion,
  } : null;
  return { kind: c.kind ?? null, origin: c.origin ?? null, row: c.row ?? null, reasons: arr(c.reasons).slice(), root };
}

function changelogMarkdown(module, release) {
  const lines = [`# Change log — ${module.label}`, "", `${CAVEATS.prototype}. Generated by screenAIr ${release} from the rubric's \`changelog\`; the rubric is the source.`, ""];
  const log = arr(module.changelog);
  if (!log.length) lines.push("(no entries)", "");
  for (const e of log) {
    if (!isObj(e)) continue;
    lines.push(`## ${e.date || "—"} · ${e.kind || "note"}`, "");
    if (e.note) lines.push(String(e.note), "");
    if (e.author) lines.push(`- Author: ${e.author}`);
    if (isObj(e.axes)) for (const [k, v] of Object.entries(e.axes)) if (Array.isArray(v)) lines.push(`- ${k}: ${v[0]} → ${v[1]}`);
    if (arr(e.paths).length) lines.push(`- Changed: ${arr(e.paths).map((p) => `\`${p}\``).join(", ")}`);
    if (arr(e.acknowledged).length) lines.push(`- Acknowledged: ${arr(e.acknowledged).map((p) => `\`${p}\``).join(", ")}`);
    if (arr(e.removed).length) lines.push(`- Removed: ${arr(e.removed).map((p) => `\`${p}\``).join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

function logicTextOf(entry, entries) {
  const m = entry.module;
  if (!m.hashes.logicSha256) return null;
  const own = entry.files && entry.files.logic && typeof entry.files.logic.text === "string" && entry.files.logic.text ? entry.files.logic.text : null;
  if (own) return own;
  if (m.sources && typeof m.sources.logicText === "string" && m.sources.logicText) return m.sources.logicText;
  for (const e of entries) {
    const o = e && e.module;
    if (!o || o.hashes.logicSha256 !== m.hashes.logicSha256) continue;
    const t = (e.files && e.files.logic && e.files.logic.text) || (o.sources && o.sources.logicText);
    if (typeof t === "string" && t) return t;
  }
  return null;
}

/**
 * A module loaded from one self-contained .js file (format "screenair-module", §3.9): the
 * registry records that file as both the rubric's and the logic's source. Its logic bytes are
 * the whole module, so the export writes that file alone as <id>.logic.js; a sibling
 * <id>.rubric.json would come back as a second copy of the module with no logic file of its
 * own to bind to, and the zip would not upload again.
 */
function isSelfContained(entry) {
  const f = entry && entry.files;
  if (!isObj(f) || !isObj(f.rubric) || !isObj(f.logic)) return false;
  if (f.logic.kind === "module") return true;
  const r = typeof f.rubric.name === "string" ? basename(f.rubric.name) : "";
  const l = typeof f.logic.name === "string" ? basename(f.logic.name) : "";
  return !!r && r === l && /\.m?js$/i.test(l);
}

function failedFiles(entry) {
  const out = {};
  const f = entry && entry.files;
  if (!isObj(f)) return out;
  for (const k of ["rubric", "logic"]) {
    if (isObj(f[k]) && f[k].name && f[k].sha256) out[basename(f[k].name)] = f[k].sha256;
  }
  return out;
}

function firstError(entry) {
  const v = entry && entry.validation;
  const e = v && arr(v.errors)[0];
  if (e) return `${e.code} · ${e.path || "/"} · ${e.msg}`;
  return entry && entry.module ? "validation did not pass" : "the module did not load";
}

async function fetchOrFail(fetchBytes, path, what) {
  if (typeof fetchBytes !== "function") throw new Error(`Download all: ${what} ${path} cannot be read (no fetchBytes was given)`);
  let buf;
  try { buf = await fetchBytes(path); }
  catch (err) { throw new Error(`Download all: ${what} ${path} could not be read (${err && err.message ? err.message : err})`); }
  if (!buf) throw new Error(`Download all: ${what} ${path} could not be read`);
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

const json = (x) => utf8Bytes(JSON.stringify(x, null, 2));

/**
 * Every file of a Download-all export (§5.8), sorted by name.
 * @param {Array<Object>} entries  RegistryEntry[] (built-in, uploaded, derived; failed ones too)
 * @param {{appVersion?:string, now?:string, fetchBytes?:function(string):Promise<ArrayBuffer|Uint8Array>}} [opts]
 *        fetchBytes resolves a path relative to app/ (env.appBase, D25)
 * @returns {Promise<Array<{name:string, bytes:Uint8Array}>>}
 */
export async function buildExportFiles(entries, { appVersion = APP_VERSION, now = null, fetchBytes = null } = {}) {
  const generatedAt = now || new Date().toISOString();
  const list = arr(entries).filter(Boolean);
  const files = new Map();
  const manifest = {
    format: FORMAT.export,
    formatVersion: 1,
    release: appVersion,
    contractVersion: CONTRACT_VERSION,
    generatedAt,
    caveat: CAVEATS.prototype,
    modules: [],
    failed: [],
  };
  const lines = [];
  for (const entry of list) {
    const m = entry.module;
    if (!m || !entry.validation || entry.validation.ok !== true) {
      manifest.failed.push({ key: entry.key ?? null, label: entry.label || (m && m.label) || entry.key || "?", error: firstError(entry), files: failedFiles(entry) });
      continue;
    }
    const id = m.id;
    const own = {};
    const add = async (rel, bytes) => {
      const name = `${id}/${rel}`;
      if (files.has(name)) throw new Error(`Download all: two files named ${name}`);
      files.set(name, bytes);
      own[name] = await sha256Hex(bytes);
    };
    const selfContained = !!m.hashes.logicSha256 && isSelfContained(entry);
    await add(selfContained ? `generated/${id}.rubric.json` : `${id}.rubric.json`, utf8Bytes(serializeRubric(m.rubric)));
    if (m.hashes.logicSha256) {
      const text = logicTextOf(entry, list);
      if (typeof text !== "string") throw new Error(`Download all: the logic source of ${m.label} is not available`);
      const bytes = utf8Bytes(text);
      const sha = await sha256Hex(bytes);
      if (sha !== m.hashes.logicSha256) throw new Error(`Download all: the logic source of ${m.label} does not match the logic that was loaded`);
      await add(`${id}.logic.js`, bytes);
    }
    if (m.origin === "builtin") {
      const docs = arr(m.docs).length ? arr(m.docs) : arr(entry.docs);
      for (const p of docs) await add(basename(p), await fetchOrFail(fetchBytes, p, "the document"));
    } else {
      await add("CHANGELOG.md", utf8Bytes(changelogMarkdown(m, appVersion)));
    }
    const prefix = m.fhir.filePrefix;
    const iv = m.instrumentVersion;
    await add(`generated/${prefix}-questionnaire-v${iv}.json`, json(buildQuestionnaire(m, { date: generatedAt.slice(0, 10) })));
    await add(`generated/${prefix}-cds-hooks.json`, json(buildCdsHooks(m)));
    await add(`generated/${prefix}-data-dictionary-v${iv}.json`, json(buildDataDictionary(m, { appVersion })));
    await add(`generated/${prefix}-cohort-columns.csv`, utf8Bytes(cohortColumnsCsv(m) + "\n"));
    const pop = m.research && m.research.population;
    if (m.origin === "builtin" && isObj(pop)) {
      const indexBytes = await fetchOrFail(fetchBytes, pop.index, "the population index");
      await add(`research/${cleanRel(pop.index)}`, indexBytes);
      let index;
      try { index = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(indexBytes)); }
      catch (err) { throw new Error(`Download all: the population index ${pop.index} is not valid JSON (${err.message})`); }
      for (const a of arr(index && index.artifacts)) {
        if (!isObj(a) || typeof a.path !== "string") continue;
        await add(`research/${cleanRel(a.path)}`, await fetchOrFail(fetchBytes, a.path, "the population estimate"));
      }
      for (const k of ["schema", "map"]) {
        if (typeof pop[k] === "string" && !files.has(`${id}/research/${cleanRel(pop[k])}`)) {
          await add(`research/${cleanRel(pop[k])}`, await fetchOrFail(fetchBytes, pop[k], `the population ${k}`));
        }
      }
    }
    manifest.modules.push({
      key: entry.key ?? m.key,
      id,
      label: m.label,
      name: m.name,
      origin: m.origin,
      ...(selfContained ? { selfContained: true } : {}),
      versions: {
        instrument: m.versions.instrument, lexicon: m.versions.lexicon, probeSet: m.versions.probeSet,
        goldSet: m.versions.goldSet, goldSetLexicon: m.versions.goldSetLexicon,
      },
      hashes: {
        rubricSha256: m.hashes.rubricSha256, logicSha256: m.hashes.logicSha256, instrumentHash: m.hashes.instrumentHash,
        scoringHash: m.hashes.scoringHash, lexiconHash: m.hashes.lexiconHash,
      },
      classification: serialClassification(m.classification),
      provenance: m.provenance ?? null,
      changelog: arr(m.changelog),
      validation: { errors: 0, warnings: arr(entry.validation.warnings).length },
      files: Object.fromEntries(Object.keys(own).sort().map((k) => [k, own[k]])),
    });
    const v = m.versions;
    lines.push(`  ${id}/  ${m.label} (${m.origin}) — instrument ${v.instrument ?? "—"}, lexicon ${v.lexicon ?? "—"}, probe set ${v.probeSet ?? "—"}, gold set ${v.goldSet ?? "—"}`);
  }
  for (const f of manifest.failed) lines.push(`  (not included) ${f.label}: ${f.error}`);
  const readme = README_TEXT
    .replace("{release}", appVersion)
    .replace("{generatedAt}", generatedAt)
    .replace("{modules}", lines.length ? lines.join("\n") : "  (none)");
  files.set("README.txt", utf8Bytes(readme));
  files.set("manifest.json", utf8Bytes(JSON.stringify(manifest, null, 2) + "\n"));
  return [...files.keys()].sort().map((name) => ({ name, bytes: files.get(name) }));
}

/**
 * Download all as one zip: {name: "screenair-modules-YYYY-MM-DD.zip", bytes}. With one entry
 * and `single: true` the name is `<id>.zip` (Download this module).
 */
export async function buildExportZip(entries, { appVersion = APP_VERSION, now = null, fetchBytes = null, single = false } = {}) {
  const at = now || new Date().toISOString();
  const files = await buildExportFiles(entries, { appVersion, now: at, fetchBytes });
  const list = arr(entries).filter(Boolean);
  const name = single && list.length === 1 && list[0].module ? `${list[0].module.id}.zip` : exportZipName(at);
  return { name, bytes: zipStore(files), files };
}

/** fetchBytes over env.appBase (D25): `p => fetch(new URL(p, appBase)).then(r => r.arrayBuffer())`, failing on HTTP errors. */
export function fetchBytesFor(appBase) {
  return async (p) => {
    const res = await fetch(new URL(p, appBase).href, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}
