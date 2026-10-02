// tests/suites/static.js — source rules over the served tree (design 03 §8.3 `static`, §6.4,
// §6.5, §9.0, §5.10). Sources are listed through the dev server's directory listing
// (python -m http.server) and parsed with Babel's parser; nothing is executed.
//
// Rules:
//   cycles     no import cycle among compiled files (so every page's import graph is acyclic);
//              tests/loader-check/ is excluded, its cycles are deliberate fixtures
//   layering   src/engine imports only src/engine; src/ui imports engine, src/ui, react and
//              lucide-react; src/apps imports engine, src/ui, src/apps, react, lucide-react and
//              the five shared legacy-path files; src/shell imports any of those, src/shell and
//              (until WP14 retires them, D18) the legacy src/ files; logic files import nothing
//   t-ids      no MASQUE id, flag id, context id, info-prompt id, phenotype value, "masque" (any
//              case, so also "MASQUE" and "masque.example") or the built-in label in src/engine,
//              src/ui, src/apps or src/shell. Exempt: import specifiers (apps and the shell must
//              import the shared legacy-path files of §2.7, whose names hold MASQUE) and the page
//              contract names (.masque-proto and .masque-back, which §5.10 hides in print;
//              #masque-status; data-masque-*; masque-loader.js)
//   loader     no compiled file imports masque-loader.js
//   specifiers no comment or string literal of a compiled file or a modules/**/*.logic.js file
//              (compiled through importSource) holds import-specifier text (from/import followed by
//              a quoted ./ or ../ path), which the loader would try to build
//   encoding   every text file under app/ is UTF-8 without BOM, with LF line endings
//   pages      every app/*.html (and every test page) carries noindex, nofollow
//   t-css      reported as pending until an app stylesheet exists (WP7)

const COMPILED_EXT = /\.(js|jsx)$/;
const TEXT_EXT = /\.(js|jsx|mjs|cjs|json|md|html|css|txt|csv|tsv|py|R|r|sha256|svg|xml|yml|yaml|htaccess|gitignore)$/;
const BINARY_EXT = /\.(xpt|png|jpg|jpeg|gif|webp|ico|pdf|zip|bin|xlsx|xls|ods|doc|docx|pyc|woff2?|ttf|otf|mp3|mp4|wav)$/i;

// Pre-existing CRLF files in trees design §2.8 keeps unchanged. Exempt from the LF rule only
// (BOM and UTF-8 are still checked): orchestrator decision F3.
const CRLF_EXEMPT = [
  "data/provenance/nhanes-fetch-manifest.json",
  "tests/fixtures/nhanes/nhanes_synthetic.csv",
  "tests/fixtures/synthetic_nhis_like.csv",
];

// app/ and app/tests/ hold an index.html, so `python -m http.server` serves that page instead of
// a listing; their top-level entries come from design §2.1 (pages), §2.2-§2.9 (folders). The
// browser cannot see an entry missing from this list; tests/playwright/run.mjs (Node) reads
// the real folders and fails on any entry not listed here (its "static-tree" step).
const KNOWN_ENTRIES = {
  "": {
    files: [".htaccess", "index.html", "screenair.html", "simulator.html", "screener.html", "scribe.html", "patient.html", "population.html"],
    dirs: ["assets", "data", "etl", "modules", "src", "tests"],
  },
  "tests/": {
    files: ["index.html", "loader-check.html", "population-artifact-check.html"],
    dirs: ["baseline", "dev", "fixtures", "harness", "loader-check", "playwright", "suites", "tools"],
  },
};

const SHARED_LEGACY = ["src/MASQUE_Voice.js", "src/PopulationArtifact.jsx", "src/MASQUE_Population.jsx",
  "src/MASQUE_SchemaCheck.js", "src/ResearchReadinessPanel.jsx"];
const BUILTIN_LABEL = "Dizziness and Sinusitis (MASQUE v1)";
const PAGE_CONTRACT_NAMES = /masque-(?:proto|back|status|loader\.js)\b|data-masque-[a-z-]+|\bmasque(?:Ready|Tests)\b/g;
const SPECIFIER_TEXT = /(?:from|import)\s*\(?\s*["'`]\.{1,2}\//;

function isCompiled(path) {
  if (!COMPILED_EXT.test(path)) return false;
  if (path.startsWith("assets/") || path.startsWith("data/") || path.startsWith("etl/") || path.startsWith("modules/")) return false;
  if (path.startsWith("tests/playwright/")) return false;
  if (path.startsWith("tests/fixtures/") && !path.startsWith("tests/fixtures/mutations/")) return false;
  if (path.startsWith("tests/loader-check/sources/")) return false;
  return true;
}

function resolveRel(fromPath, spec) {
  const u = new URL(spec, `http://x/${fromPath}`);
  return u.pathname.slice(1);
}

/** Import specifiers, comments and string texts of one source file. */
function scanSource(Babel, path, text) {
  const ast = Babel.packages.parser.parse(text, {
    sourceType: "module",
    plugins: ["jsx"],
    errorRecovery: false,
  });
  const imports = [];
  const strings = [];
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    switch (node.type) {
      case "ImportDeclaration":
      case "ExportAllDeclaration":
        imports.push({ spec: node.source.value, line: node.loc.start.line, start: node.source.start, end: node.source.end }); break;
      case "ExportNamedDeclaration":
        if (node.source) imports.push({ spec: node.source.value, line: node.loc.start.line, start: node.source.start, end: node.source.end });
        break;
      case "ImportExpression":
        if (node.source && node.source.type === "StringLiteral") {
          imports.push({ spec: node.source.value, line: node.loc.start.line, start: node.source.start, end: node.source.end, dynamic: true });
        }
        break;
      case "CallExpression":
        if (node.callee && node.callee.type === "Import" && node.arguments[0] && node.arguments[0].type === "StringLiteral") {
          const a = node.arguments[0];
          imports.push({ spec: a.value, line: node.loc.start.line, start: a.start, end: a.end, dynamic: true });
        }
        break;
      case "StringLiteral":
        strings.push({ value: node.value, line: node.loc.start.line }); break;
      case "TemplateElement":
        strings.push({ value: node.value.raw, line: node.loc.start.line });
        if (node.value.cooked != null && node.value.cooked !== node.value.raw) strings.push({ value: node.value.cooked, line: node.loc.start.line });
        break;
      case "JSXText":
        strings.push({ value: node.value, line: node.loc.start.line, jsx: true }); break;
      default: break;
    }
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments" || key === "innerComments") continue;
      const v = node[key];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") visit(c); }
      else if (v && typeof v.type === "string") visit(v);
    }
  };
  visit(ast.program);
  const comments = (ast.comments || []).map((c) => ({ value: c.value, line: c.loc.start.line }));
  // Import declarations' own source strings are specifiers, not text.
  const specLines = new Set(imports.map((i) => `${i.line}\u0000${i.spec}`));
  return { imports, comments, strings: strings.filter((s) => !specLines.has(`${s.line}\u0000${s.value}`)) };
}

function findCycles(graph) {
  const cycles = [];
  const state = new Map(); // 1 = on stack, 2 = done
  const stack = [];
  const dfs = (n) => {
    state.set(n, 1);
    stack.push(n);
    for (const m of graph.get(n) || []) {
      if (!graph.has(m)) continue;
      if (state.get(m) === 1) cycles.push([...stack.slice(stack.indexOf(m)), m]);
      else if (!state.get(m)) dfs(m);
    }
    stack.pop();
    state.set(n, 2);
  };
  for (const n of [...graph.keys()].sort()) if (!state.get(n)) dfs(n);
  return cycles;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** The MASQUE identifiers t-ids forbids, from the rubric when WP1 has landed, plus the baseline. */
async function forbiddenTokens(h, notes) {
  const ids = new Set();
  const phenotypes = new Set();
  let label = BUILTIN_LABEL;
  try {
    // Ask the listings first (modules/ is already listed by the tree walk), so no 404 is logged
    // before WP1 adds the rubric.
    const mods = await h.listDir(h.appUrl("modules/")).catch(() => null);
    if (mods && !mods.dirs.includes("masque")) throw new Error("not present");
    if (!(await h.fileExists(h.appUrl("modules/masque/masque.rubric.json")))) throw new Error("not present");
    const rubric = JSON.parse(await h.fetchText("modules/masque/masque.rubric.json"));
    for (const d of rubric.domains || []) for (const it of d.items || []) ids.add(it.id);
    for (const f of rubric.redFlags || []) ids.add(f.id);
    for (const c of rubric.contextItems || []) ids.add(c.id);
    for (const p of (rubric.infoPrompts && rubric.infoPrompts.prompts) || []) ids.add(p.id);
    for (const v of (rubric.phenotypes && rubric.phenotypes.values) || []) phenotypes.add(v.value);
    if (rubric.label) label = rubric.label;
    notes.push("t-ids: identifiers from modules/masque/masque.rubric.json and the baseline");
  } catch (err) {
    notes.push("t-ids: modules/masque/masque.rubric.json not readable yet; identifiers from the baseline only");
  }
  const scr = await h.oracle("MASQUE_Screener_v0_3.jsx");
  for (const k of scr.DOMAIN_ORDER) for (const it of scr.ITEMS[k].items) ids.add(it.id);
  for (const f of scr.RED_FLAGS) ids.add(f.id);
  for (const s of Object.values(scr.SAMPLE_CASES)) {
    for (const k of Object.keys(s.ctx || {})) ids.add(k);
    if (s.complaint) phenotypes.add(s.complaint);
  }
  const pat = await h.oracle("MASQUE_Patient_v0_3.jsx");
  for (const c of pat.CONTEXT_Q) ids.add(c.id);
  const scb = await h.oracle("MASQUE_Scribe_v0_3.jsx");
  for (const p of scb.VMPATHI_INFO) ids.add(p.id);
  return { ids: [...ids].sort(), phenotypes: [...phenotypes].sort(), label };
}

function layerOf(path) {
  if (path.startsWith("src/engine/")) return "engine";
  if (path.startsWith("src/ui/")) return "ui";
  if (path.startsWith("src/apps/")) return "apps";
  if (path.startsWith("src/shell/")) return "shell";
  if (path.startsWith("src/") && path.indexOf("/", 4) < 0) return "legacy";
  return null;
}

function allowedImport(layer, target, bare) {
  if (bare) {
    if (layer === "engine") return false;
    if (layer === "ui" || layer === "apps" || layer === "shell") return target === "react" || target === "lucide-react";
    return true;
  }
  const t = layerOf(target);
  switch (layer) {
    case "engine": return t === "engine";
    case "ui": return t === "engine" || t === "ui";
    case "apps": return t === "engine" || t === "ui" || t === "apps" || SHARED_LEGACY.includes(target);
    case "shell": return t === "engine" || t === "ui" || t === "apps" || t === "shell" || t === "legacy";
    default: return true;
  }
}

// Exposed for the harness self-checks.
export { scanSource, findCycles, allowedImport, isCompiled, SPECIFIER_TEXT, PAGE_CONTRACT_NAMES, KNOWN_ENTRIES };

export default {
  name: "static",
  owner: "WP13",
  async run(h) {
    const notes = [];
    const fails = [];
    const fail = (rule, msg) => fails.push(`${rule}: ${msg}`);
    const Babel = h.babel;
    if (!Babel || !Babel.packages || !Babel.packages.parser) {
      return { verdict: "fail", n: 0, diffs: [], expectedMissing: [], notes: ["Babel standalone parser is not available"] };
    }

    let files;
    try {
      const tree = await h.listTree(h.appUrl(""), {
        skipDir: (rel) => rel.split("/").some((seg) => seg.startsWith(".") || seg === "__pycache__" || seg === "node_modules"),
        known: KNOWN_ENTRIES,
      });
      files = tree.files;
      notes.push(`enumerated from the design's file list (they serve an index.html, so the dev server gives no listing): ${tree.unlisted.join(", ")}; an entry missing from that list is not seen here; tests/playwright/run.mjs (static-tree) checks it in Node`);
    } catch (err) {
      return { verdict: "fail", n: 0, diffs: [], expectedMissing: [], notes: [`cannot list app/: ${err.message} (static needs the python http.server directory listing)`] };
    }
    files = files.filter((p) => p !== "tests/playwright/report.json");
    notes.push(`${files.length} files under app/`);
    let n = 0;

    // ------------------------------------------------------------------ parse compiled files
    const compiled = files.filter(isCompiled);
    const logicFiles = files.filter((p) => p.startsWith("modules/") && /\.logic\.js$/.test(p));
    const scans = new Map();
    for (const path of [...compiled, ...logicFiles]) {
      const text = await h.fetchText(path);
      try {
        scans.set(path, scanSource(Babel, path, text));
      } catch (err) {
        fail("parse", `${path}: ${String(err.message).split("\n")[0]}`);
      }
    }
    notes.push(`${compiled.length} compiled files and ${logicFiles.length} logic files parsed`);

    // ------------------------------------------------------------------ cycles
    const graph = new Map();
    const unresolved = [];
    const fileSet = new Set(files);
    for (const path of compiled) {
      if (path.startsWith("tests/loader-check/")) continue;
      const s = scans.get(path);
      if (!s) continue;
      const deps = [];
      for (const imp of s.imports) {
        if (!/^\.{1,2}\//.test(imp.spec)) continue;
        const target = resolveRel(path, imp.spec);
        deps.push(target);
        if (!fileSet.has(target)) unresolved.push(`${path}:${imp.line} → ${imp.spec}`);
      }
      graph.set(path, deps);
    }
    n += 1;
    const cycles = findCycles(graph);
    for (const c of cycles) fail("cycles", c.join(" → "));
    if (unresolved.length) notes.push(`unresolved relative imports (not a static rule; the page would fail to load): ${unresolved.join("; ")}`);

    // Page entries, for the record.
    const pages = files.filter((p) => /\.html$/.test(p) && !p.startsWith("tests/loader-check"));
    const entries = [];
    for (const page of pages) {
      const html = await h.fetchText(page);
      for (const m of html.matchAll(/(?:entry:\s*|importModule\(\s*)['"]([^'"]+)['"]/g)) {
        const target = resolveRel(page, m[1]);
        entries.push(`${page} → ${target}${fileSet.has(target) ? "" : " (missing)"}`);
      }
    }
    notes.push(`cycles: ${graph.size} files, ${cycles.length} cycle(s); page entries: ${entries.join("; ") || "none"}`);

    // ------------------------------------------------------------------ layering
    for (const [path, s] of scans) {
      const layer = path.startsWith("modules/") ? "logic" : layerOf(path);
      if (!layer || layer === "legacy") continue;
      n += 1;
      for (const imp of s.imports) {
        if (layer === "logic") { fail("layering", `${path}:${imp.line} logic files import nothing, found "${imp.spec}"`); continue; }
        const bare = !/^\.{1,2}\//.test(imp.spec);
        const target = bare ? imp.spec : resolveRel(path, imp.spec);
        if (!allowedImport(layer, target, bare)) fail("layering", `${path}:${imp.line} (${layer}) may not import ${bare ? `"${imp.spec}"` : target}`);
      }
    }

    // ------------------------------------------------------------------ loader imports, specifier text
    for (const path of [...compiled, ...logicFiles]) {
      const s = scans.get(path);
      if (!s) continue;
      n += 1;
      for (const imp of s.imports) {
        if (/(^|\/)masque-loader\.js$/.test(imp.spec)) fail("loader", `${path}:${imp.line} imports ${imp.spec}`);
      }
      for (const c of s.comments) if (SPECIFIER_TEXT.test(c.value)) fail("specifiers", `${path}:${c.line} comment holds import-specifier text`);
      for (const st of s.strings) if (SPECIFIER_TEXT.test(st.value)) fail("specifiers", `${path}:${st.line} ${st.jsx ? "JSX text" : "string"} holds import-specifier text`);
    }

    // ------------------------------------------------------------------ t-ids
    const tokens = await forbiddenTokens(h, notes);
    const idRes = tokens.ids.map((id) => [id, new RegExp(`(?<![A-Za-z0-9_])${escapeRe(id)}(?![A-Za-z0-9_])`)]);
    const longPheno = tokens.phenotypes.filter((v) => v.length >= 6).map((v) => [v, new RegExp(`(?<![A-Za-z0-9_])${escapeRe(v)}(?![A-Za-z0-9_])`, "i")]);
    const shortPheno = tokens.phenotypes.filter((v) => v.length < 6);
    const tidFiles = files.filter((p) => /^src\/(engine|ui|apps|shell)\//.test(p) && TEXT_EXT.test(p));
    // F2: t-ids is waived for src/shell/** while the shell is the M1 legacy shell, recognisable
    // as a ScreenAIr.jsx that does not import shell/registry.js (§9.13 M1); from M2 on the rule
    // applies to the shell in full. Waived findings are listed as notes, never dropped silently.
    const shellScan = scans.get("src/shell/ScreenAIr.jsx");
    const shellAtM1 = !!shellScan && !shellScan.imports.some((imp) => /(^|\/)registry\.js$/.test(imp.spec));
    const waived = [];
    for (const path of tidFiles) {
      n += 1;
      const fail = (rule, msg) => (shellAtM1 && path.startsWith("src/shell/") ? waived.push(msg) : fails.push(`${rule}: ${msg}`));
      const raw = await h.fetchText(path);
      // Exempt (design-mandated, not module identity): import specifiers, which name the
      // shared legacy-path files (§2.7: MASQUE_Voice.js, MASQUE_Population.jsx …), and the page
      // contract names (§5.10 hides .masque-proto/.masque-back; #masque-status, data-masque-*,
      // masque-loader.js). Blanked with spaces so line numbers stay true.
      const s0 = scans.get(path);
      let text = raw;
      if (s0) for (const imp of s0.imports) if (Number.isInteger(imp.start)) text = text.slice(0, imp.start) + " ".repeat(imp.end - imp.start) + text.slice(imp.end);
      text = text.replace(PAGE_CONTRACT_NAMES, (m) => " ".repeat(m.length));
      const lineOf = (idx) => text.slice(0, idx).split("\n").length;
      const brands = [...text.matchAll(/masque/gi)];
      for (const b of brands.slice(0, 10)) fail("t-ids", `${path}:${lineOf(b.index)} names "${text.slice(b.index, b.index + 24).split("\n")[0]}…"`);
      if (brands.length > 10) fail("t-ids", `${path}: ${brands.length - 10} more`);
      const li = text.indexOf(tokens.label);
      if (li >= 0) fail("t-ids", `${path}:${lineOf(li)} holds the built-in label`);
      for (const [id, re] of [...idRes, ...longPheno]) {
        const m = re.exec(text);
        if (m) fail("t-ids", `${path}:${lineOf(m.index)} names "${id}"`);
      }
      const s = scans.get(path);
      if (s) for (const st of s.strings) if (shortPheno.includes(st.value)) fail("t-ids", `${path}:${st.line} string literal "${st.value}" is a phenotype value`);
    }
    notes.push(`t-ids: ${tidFiles.length} files checked against ${tokens.ids.length} ids, ${tokens.phenotypes.length} phenotype values, the brand and the label`);
    if (waived.length) notes.push(`t-ids waived for src/shell/** at M1 (orchestrator decision F2; the rule applies in full from M2): ${waived.length} finding(s), e.g. ${waived.slice(0, 3).join("; ")}`);

    // ------------------------------------------------------------------ encoding
    let textFiles = 0;
    const exemptUsed = [];
    for (const path of files) {
      if (BINARY_EXT.test(path)) continue;
      if (!TEXT_EXT.test(path) && !/(^|\/)\.htaccess$/.test(path)) { notes.push(`encoding: skipped ${path} (unknown kind)`); continue; }
      textFiles += 1;
      const bytes = await h.fetchBytes(path);
      if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) fail("encoding", `${path} starts with a BOM`);
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch (err) {
        fail("encoding", `${path} is not valid UTF-8`);
      }
      if (bytes.includes(0x0D)) {
        if (CRLF_EXEMPT.includes(path)) exemptUsed.push(path);
        else fail("encoding", `${path} contains CR (line endings must be LF)`);
      }
    }
    n += 1;
    notes.push(`encoding: ${textFiles} text files${exemptUsed.length ? `; CR exempted (F3: pre-existing data files, §2.8 unchanged trees): ${exemptUsed.join(", ")}` : ""}`);

    // ------------------------------------------------------------------ pages
    for (const page of pages.concat(files.filter((p) => p.startsWith("tests/loader-check") && p.endsWith(".html")))) {
      n += 1;
      const html = await h.fetchText(page);
      if (!/<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow["']/i.test(html)) fail("pages", `${page} lacks <meta name="robots" content="noindex, nofollow">`);
    }

    // ------------------------------------------------------------------ t-css
    const appFiles = files.filter((p) => p.startsWith("src/apps/") && /\.jsx?$/.test(p));
    if (appFiles.length) fail("t-css", "not implemented yet (needs the mounted app stylesheets; WP13 adds it once WP7 lands)");
    else notes.push("t-css: vacuous, no app stylesheet exists yet (src/apps is empty); the check lands with WP7");

    return { verdict: fails.length ? "fail" : "pass", n, diffs: [], expectedMissing: [], notes: [...notes, ...fails] };
  },
};
