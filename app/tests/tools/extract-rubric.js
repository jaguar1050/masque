// tests/tools/extract-rubric.js — builds app/modules/masque/masque.rubric.json from the frozen
// baseline (WP1; design 03 §3.8, §9.2). Local-only, never deployed.
//
// Every clinical value is read from app/tests/baseline/src at run time: module constants through
// the loader's `append` mechanism (the parity harness's oracles, so the baseline manifest is
// verified first), function outputs by calling the baseline builders, and JSX or template text by
// cutting the SHA-pinned source at fixed lines and compiling the cut with Babel, so whitespace
// and entities come out exactly as React renders them. Nothing clinical is typed here. The only
// hand-written values are those design §9.2 item 6 lists (HAND below), and each identity
// template is rendered back and compared with the literal it replaces.
//
// extractRubric(env) → {rubric, text, sha256, sources, checks, committed}
//   text     JSON.stringify(rubric, null, 2) + "\n" (UTF-8, LF, no \u escapes)
//   sources  [{path, file, lines, how}] — the field → baseline file:lines map behind SOURCES.md
//   checks   [{ok, what}] — every cross-check the extraction ran (all must be ok)
//   committed {sha256, identical} — the committed modules/masque/masque.rubric.json, compared byte for byte
import { createOracles } from "../harness/oracles.js";
import { rubricHashes, sha256Hex } from "../../src/engine/hash.js";
import { FORMAT, CONTRACT_VERSION } from "../../src/engine/contract.js";

// ---------------------------------------------------------------------------------------
// The hand-written values (design §9.2 item 6). Nothing else in the rubric is typed here.
// ---------------------------------------------------------------------------------------
const HAND = {
  id: "masque",
  label: "Dizziness and Sinusitis (MASQUE v1)",          // user requirement 2026-10-02 (Q1)
  name: "MASQUE",
  icon: "Stethoscope",
  // Identity templates over {id} and {instrument}; each is rendered back and compared with the
  // baseline literal it replaces (checks "identity: …").
  fhir: {
    questionnaireUrl: "http://{id}.example/Questionnaire/{id}-screener-v{instrument}",
    codeSystem: "http://{id}.example/codes",
    answerSystem: "http://{id}.example/answer",
    criteriaSystem: "http://{id}.example/criteria",
    weightExtension: "http://{id}.example/StructureDefinition/item-weight",
    indexCode: "{id}-index",
    screenIdPrefix: "{id}-",
    filePrefix: "{id}",
  },
  cds: {
    serviceId: "{id}-screen",
    safetyCardUuid: "{id}-safety",
    indexCardUuid: "{id}-index",
    sourceUrl: "http://{id}.example",
  },
  goldSetLexiconVersion: "0.3.1",
  goldSetFile: "masque_extraction_goldset.json",
  changelogDate: "2026-10-02",
};

const CHANGELOG_NOTES = [
  {
    kind: "extraction",
    note: "Extracted from the frozen baseline (app/tests/baseline/src, MANIFEST.sha256) by app/tests/tools/extract-rubric.html; field-by-field sources in modules/masque/SOURCES.md. Instrument 0.2 unchanged: item ids, weights, scale factors, cut-points and wording are moved, not edited.",
    paths: ["/"],
  },
  {
    kind: "reconciliation",
    note: "Red flags take the canonical Screener wording (text, points, action). The Scribe's shortened copy and the Simulator's third variant are dropped; the Scribe's per-flag `ask` is kept as unread data (Q5, Q6).",
    paths: ["/redFlags"],
  },
  {
    kind: "reconciliation",
    note: "Item text is canonical from the Screener (byte-identical to the Scribe's). The Scribe's ASK map becomes `ask`, its shortLabel map becomes `short` (n_allo has none, so the id is shown as today, Q24), VMPATHI_TAG becomes `tag`, and the Patient's clinician line `c` becomes `patientClin`. The Simulator's item copy (no scale factors, linear scoring) is dropped.",
    paths: ["/domains"],
  },
  {
    kind: "reconciliation",
    note: "Patient context options keep the Patient's own values and labels (1/2/3+, <6mo/6-12mo/>12mo, no/yes); they are not realigned to the clinician bins (Q8). The gap-rule signal values (3+, >12mo, yes) are identical in both vocabularies.",
    paths: ["/contextItems", "/locales/en/contextItems"],
  },
  {
    kind: "reconciliation",
    note: "The Patient ITEMS domain `label`/`clinical` fields (never read) are dropped; the patient step titles come from the Patient section titles (UI.sections).",
    paths: ["/locales/en/steps", "/locales/es/steps"],
  },
  {
    kind: "reconciliation",
    note: "The five Simulator scenarios are added as sample cases sim-empty, sim-partial, sim-high, sim-redflag and sim-ruleout (group \"scenario\", `why` kept as the button title, FULL_HIGH inlined, `step` dropped, no complaint) (Q3).",
    paths: ["/sampleCases"],
  },
  {
    kind: "reconciliation",
    note: "The research panel's PROJECTS.MASQUE entry moves to `research`, with the brand-named knobs (score alias, artifact key, ETL script, fairness axes) and the Simulator's demo cohorts as data. BREATHE and VOICED stay in the panel as panel-only projects.",
    paths: ["/research"],
  },
  {
    kind: "note",
    note: "Open questions shipped with their stated defaults: the label is display-only (Q1); the Scribe note keeps \"Instrument v0.3 candidates.\" verbatim (Q7).",
    paths: ["/label", "/copy/note/supportingFooter"],
  },
];

// ---------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------

const FILES = {
  Scr: "MASQUE_Screener_v0_3.jsx",
  Scb: "MASQUE_Scribe_v0_3.jsx",
  Pat: "MASQUE_Patient_v0_3.jsx",
  Sim: "MASQUE_Simulator.jsx",
  Ext: "MASQUE_Extraction.js",
  RRP: "ResearchReadinessPanel.jsx",
  Voice: "MASQUE_Voice.js",
  Pop: "MASQUE_Population.jsx",
};

class ExtractError extends Error {}
const fail = (msg) => { throw new ExtractError(msg); };

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return false;   // key order counts
  return ka.every((k) => deepEqual(a[k], b[k]));
}

/** A JSON round trip: plain data only, key order kept. */
const plain = (x) => JSON.parse(JSON.stringify(x));

function render(template, vars) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** Evaluate a JS literal cut from the baseline (array or object literal, no free variables). */
function evalLiteral(src) {
  return new Function(`"use strict"; return (${src});`)();
}

/** Babel's JSX compile of a cut, evaluated against a recording createElement. */
function jsx(snippet, scope = {}) {
  const Babel = globalThis.Babel;
  if (!Babel) fail("Babel standalone is not loaded on this page");
  const { code } = Babel.transform(`(<>${snippet}</>)`, {
    presets: [["react", { runtime: "classic" }]], sourceType: "script", babelrc: false, configFile: false,
  });
  const React = {
    Fragment: "#fragment",
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  };
  const names = Object.keys(scope);
  return new Function("React", ...names, `"use strict"; return ${code}`)(React, ...names.map((n) => scope[n]));
}

/** Text of a JSX tree: strings joined; <b>x</b> → **x**; other elements contribute their children. */
function flat(node) {
  if (node === null || node === undefined || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flat).join("");
  if (node.type === "b") return `**${flat(node.children)}**`;
  return flat(node.children);
}

/** The first element in a JSX tree that satisfies pred. */
function findEl(node, pred) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const c of node) { const r = findEl(c, pred); if (r) return r; } return null; }
  if (node.type && pred(node)) return node;
  return findEl(node.children, pred);
}

// ---------------------------------------------------------------------------------------
// Baseline source access with line bookkeeping
// ---------------------------------------------------------------------------------------

function makeSource(abbr, text) {
  const lines = text.split("\n");
  const src = {
    abbr, file: FILES[abbr], text, lines,
    /** Lines a..b (1-based, inclusive), joined with "\n". */
    region(a, b = a) {
      if (a < 1 || b > lines.length || a > b) fail(`${abbr} L${a}-${b} is outside the file`);
      return lines.slice(a - 1, b).join("\n");
    },
    /** The text strictly between `before` and `after` inside lines a..b; `before` must occur once there. */
    between(a, b, before, after) {
      const r = src.region(a, b);
      const i = r.indexOf(before);
      if (i < 0) fail(`${abbr} L${a}-${b}: anchor not found: ${before}`);
      if (r.indexOf(before, i + 1) >= 0) fail(`${abbr} L${a}-${b}: anchor not unique: ${before}`);
      const s = i + before.length;
      const j = r.indexOf(after, s);
      if (j < 0) fail(`${abbr} L${a}-${b}: closing anchor not found: ${after}`);
      return r.slice(s, j);
    },
    /** All regex matches inside lines a..b (the regex must be global). */
    matchAll(a, b, re) { return [...src.region(a, b).matchAll(re)]; },
    /** The single match of re inside lines a..b. */
    match(a, b, re) {
      const ms = [...src.region(a, b).matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))];
      if (ms.length !== 1) fail(`${abbr} L${a}-${b}: expected one match of ${re}, found ${ms.length}`);
      return ms[0];
    },
    /** 1-based line range of a top-level declaration (const/let/function, exported or not). */
    decl(name) {
      const re = new RegExp(`^[ \\t]*(?:export )?(?:const|let|function) ${name}\\b`, "m");
      const m = re.exec(text);
      if (!m) fail(`${abbr}: no declaration of ${name}`);
      const end = scanDeclEnd(text, m.index, m[0].includes("function"));
      const startLine = text.slice(0, m.index).split("\n").length;
      const endLine = text.slice(0, end).split("\n").length;
      return [startLine, endLine];
    },
    /** Assert that lines a..b contain `needle` (a structural fact, not a value taken from it). */
    has(a, b, needle) {
      if (!src.region(a, b).includes(needle)) fail(`${abbr} L${a}-${b}: expected to contain ${needle}`);
      return true;
    },
  };
  return src;
}

/** End offset of a declaration starting at `from`: brackets balanced, strings and templates skipped. */
function scanDeclEnd(text, from, isFunction) {
  let depth = 0, i = from, opened = false;
  while (i < text.length) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") { i = text.indexOf("\n", i); if (i < 0) return text.length; continue; }
    if (c === "/" && text[i + 1] === "*") { i = text.indexOf("*/", i + 2) + 2; continue; }
    if (c === '"' || c === "'") {
      i++;
      while (i < text.length && text[i] !== c) { if (text[i] === "\\") i++; i++; }
      i++; continue;
    }
    if (c === "`") {
      i++;
      while (i < text.length && text[i] !== "`") {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === "$" && text[i + 1] === "{") {
          // skip the embedded expression with its own bracket count
          let d = 1; i += 2;
          while (i < text.length && d > 0) {
            const e = text[i];
            if (e === '"' || e === "'") { i++; while (i < text.length && text[i] !== e) { if (text[i] === "\\") i++; i++; } }
            else if (e === "{") d++;
            else if (e === "}") d--;
            i++;
          }
          continue;
        }
        i++;
      }
      i++; continue;
    }
    if (c === "{" || c === "[" || c === "(") { depth++; opened = true; }
    else if (c === "}" || c === "]" || c === ")") {
      depth--;
      if (depth === 0 && isFunction && c === "}") return i + 1;
    } else if (c === ";" && depth === 0 && !isFunction) return i + 1;
    else if (c === "\n" && depth === 0 && opened && !isFunction) {
      // `const X = {...}` closed on a previous line without a semicolon
      return i;
    }
    i++;
  }
  return text.length;
}

// ---------------------------------------------------------------------------------------
// The extraction
// ---------------------------------------------------------------------------------------

export async function extractRubric(env) {
  const oracles = createOracles(env);
  const sources = [];
  const checks = [];
  const src = (path, abbr, lines, how = "") => {
    const ref = Array.isArray(lines) ? (lines[0] === lines[1] ? `L${lines[0]}` : `L${lines[0]}-${lines[1]}`) : lines;
    sources.push({ path, file: abbr, lines: ref, how });
  };
  const check = (ok, what) => {
    checks.push({ ok: !!ok, what });
    if (!ok) fail(`check failed: ${what}`);
  };

  // --- baseline modules and texts -------------------------------------------------------
  const [scr, scb, pat, sim, ext, rrp, voice, pop] = await Promise.all([
    oracles.oracle(FILES.Scr),
    oracles.oracle(FILES.Scb),
    oracles.oracle(FILES.Pat),
    oracles.oracle(FILES.Sim),
    oracles.oracle(FILES.Ext),
    oracles.oracle(FILES.RRP),
    oracles.oracle(FILES.Voice),
    oracles.oracle(FILES.Pop, { append: "export { INDEX_PATH, SCHEMA_PATH, MAP_PATH };" }),
  ]);
  const T = {};
  for (const abbr of Object.keys(FILES)) T[abbr] = makeSource(abbr, await oracles.baselineText(FILES[abbr]));
  const { Scr, Scb, Pat, Sim, RRP } = T;

  // --- instrument -------------------------------------------------------------------------
  const instrumentVersion = scr.INSTRUMENT_VERSION;
  check(instrumentVersion === Scb.match(1, Scb.lines.length, /const INSTRUMENT_VERSION = "([^"]+)"/)[1]
    && instrumentVersion === Pat.match(1, Pat.lines.length, /const INSTRUMENT_VERSION = "([^"]+)"/)[1],
    "instrument version identical in Screener, Scribe and Patient");
  src("/instrumentVersion", "Scr", Scr.decl("INSTRUMENT_VERSION"), "INSTRUMENT_VERSION");

  check(deepEqual(scr.DOMAIN_ORDER, scb.DOMAIN_ORDER) && deepEqual(scr.DOMAIN_ORDER, pat.DOMAIN_ORDER), "domain order identical in Screener, Scribe, Patient");
  check(deepEqual(plain(scr.ITEMS), plain(scb.ITEMS)), "Screener ITEMS deep-equal Scribe ITEMS (Screener canonical, Inv §2)");

  // Scribe per-item maps
  const shortOf = (id) => { const s = scb.shortLabel({ id }); return s === id ? undefined : s; };
  const scaleMaxComputed = scr.DOMAIN_ORDER.filter((k) => !scr.ITEMS[k].negative).reduce((s, k) => s + scr.ITEMS[k].max, 0);

  // Patient clinician lines
  const patItem = {};
  for (const k of pat.DOMAIN_ORDER) for (const it of pat.ITEMS[k].items) patItem[it.id] = { ...it, domain: k };

  // shortTag (Scb: `it.domain === "<k>" ? "<tag>" : label.toLowerCase()`)
  const scbSugg = Scb.decl("suggestions");
  const shortTagM = Scb.match(scbSugg[0], scbSugg[1], /it\.domain === "(\w+)" \? "([^"]+)" : ITEMS\[it\.domain\]\.label\.toLowerCase\(\)/);
  const shortTagLine = Scb.lines.findIndex((l) => l.includes(shortTagM[0])) + 1;

  let shortCount = 0;
  const domains = scr.DOMAIN_ORDER.map((key) => {
    const d = scr.ITEMS[key];
    const out = { key, label: d.label, max: d.max };
    if (d.negative !== undefined) out.negative = d.negative;
    if (shortTagM[1] === key) out.shortTag = shortTagM[2];
    out.items = d.items.map((it) => {
      const o = plain(it);                              // id, w, text, scale, ref — Screener key order
      const short = shortOf(it.id);
      if (short !== undefined) { o.short = short; shortCount++; }
      if (scb.ASK[it.id] !== undefined) o.ask = scb.ASK[it.id];
      if (scb.VMPATHI_TAG[it.id] !== undefined) o.tag = scb.VMPATHI_TAG[it.id];
      const p = patItem[it.id];
      if (!p) fail(`Patient ITEMS has no ${it.id}`);
      check(p.w === it.w && p.domain === key && (p.scale ?? null) === (it.scale ? it.scale.length : null),
        `Patient ${it.id}: weight, domain and scale length agree with the Screener`);
      o.patientClin = p.c;
      return o;
    });
    return out;
  });
  const allIds = domains.flatMap((d) => d.items.map((i) => i.id));
  check(deepEqual(allIds, scr.ALL_ITEM_IDS), "item order equals Screener ALL_ITEM_IDS");
  check(Object.keys(scb.ASK).length === allIds.length && allIds.every((id) => scb.ASK[id] !== undefined), "ASK covers every item");
  check(shortCount === 29 && shortOf("n_allo") === undefined, "shortLabel: 29 entries, none for n_allo");
  check(Object.keys(scb.VMPATHI_TAG).every((id) => allIds.includes(id)), "VMPATHI_TAG ids are items");
  src("/domains", "Scr", Scr.decl("ITEMS"), "ITEMS (key, label, max, negative; items id, w, text, scale, ref in Screener key order), DOMAIN_ORDER " + `L${Scr.decl("DOMAIN_ORDER")[0]}`);
  src("/domains[]/items[]/short", "Scb", Scb.decl("shortLabel"), "shortLabel(it) for every item; n_allo returns its id, so no `short`");
  src("/domains[]/items[]/ask", "Scb", Scb.decl("ASK"), "ASK");
  src("/domains[]/items[]/tag", "Scb", Scb.decl("VMPATHI_TAG"), "VMPATHI_TAG");
  src("/domains[]/items[]/patientClin", "Pat", Pat.decl("ITEMS"), "ITEMS[].items[].c");
  src("/domains[vestibular]/shortTag", "Scb", [shortTagLine, shortTagLine], "suggestion tag fallback for the vestibular domain");

  // --- bands ------------------------------------------------------------------------------
  const bands = { cuts: plain(scr.BAND_CUTS) };
  check(deepEqual(plain(scb.BAND_CUTS), bands.cuts), "BAND_CUTS identical in Screener and Scribe");
  src("/bands", "Scr", Scr.decl("BAND_CUTS"), "BAND_CUTS");

  // --- context items and the gap rule ------------------------------------------------------
  const ctxQ = Scr.decl("ContextQ");
  const ctxRows = evalLiteral(Scr.between(ctxQ[0], ctxQ[1], "const rows = ", ";\n"));
  const scrGapLines = [873, 878];
  Scr.has(873, 873, "const gapFlags = [");
  const scbGapLines = [916, 921];
  Scb.has(916, 916, "const gapFlags = [");
  const noteCtxLines = [1345, 1349];
  Scb.has(1345, 1345, "const ctxLine = [");
  const sig = (s, a, b) => s.matchAll(a, b, /ctx\.(\w+) === "([^"]+)" && "([^"]*)"/g).map((m) => ({ id: m[1], value: m[2], label: m[3] }));
  const scrSig = sig(Scr, scrGapLines[0], scrGapLines[1]);
  const scbSig = sig(Scb, scbGapLines[0], scbGapLines[1]);
  const noteSig = sig(Scb, noteCtxLines[0], noteCtxLines[1]);
  const patGap = Pat.match(957, 957, /S\.gap\((.*)\)/)[1];
  const patSig = [...patGap.matchAll(/ctx\.(\w+) === "([^"]+)"/g)].map((m) => ({ id: m[1], value: m[2] }));
  const patCount = [...Pat.match(955, 955, /const gapCount = \[(.*)\]/)[1].matchAll(/ctx\.(\w+) === "([^"]+)"/g)].map((m) => ({ id: m[1], value: m[2] }));
  for (const list of [scbSig, noteSig, patSig, patCount]) {
    check(list.length === scrSig.length && list.every((s) => scrSig.some((t) => t.id === s.id && t.value === s.value)),
      "gap-rule markers and signal values agree across Screener, Scribe panel, Scribe note and Patient");
  }
  const threshold = Number(Scr.match(878, 878, /gapFlags\.length >= (\d+)/)[1]);
  check(threshold === Number(Scb.match(921, 921, /gapFlags\.length >= (\d+)/)[1]) && threshold === Number(Pat.match(956, 956, /gapCount >= (\d+)/)[1]),
    "gap threshold identical in Screener, Scribe and Patient");

  const contextItems = ctxRows.map((r) => {
    const o = { id: r.id, text: r.t, options: r.opts };
    const cap = scb.capLabel({ id: r.id });
    if (cap !== r.id) o.captureLabel = cap;
    const s = scrSig.find((x) => x.id === r.id);
    if (s) {
      check(r.opts.some(([v]) => v === s.value), `context ${r.id}: signal value is a Screener option`);
      o.signal = {
        value: s.value,
        screenerLabel: s.label,
        scribeLabel: scbSig.find((x) => x.id === r.id).label,
        noteLabel: noteSig.find((x) => x.id === r.id).label,
      };
    }
    return o;
  });
  const gapRule = { threshold, markers: patSig.map((s) => s.id), noteOrder: noteSig.map((s) => s.id) };
  check(deepEqual(gapRule.markers, scrSig.map((s) => s.id)), "gap markers: Patient S.gap positional order equals the Screener order");
  src("/contextItems[]/{id,text,options}", "Scr", [ctxQ[0] + 1, ctxQ[0] + 5], "ContextQ rows (t → text, opts → options)");
  src("/contextItems[]/captureLabel", "Scb", Scb.decl("capLabel"), "capLabel ctx map");
  src("/contextItems[]/signal", "Scr", scrGapLines, `screenerLabel: Screener gapFlags; scribeLabel: Scb L${scbGapLines[0]}-${scbGapLines[1]} gapFlags; noteLabel: Scb L${noteCtxLines[0]}-${noteCtxLines[1]} ctxLine`);
  src("/gapRule", "Pat", [955, 957], `markers = S.gap positional order (Pat L957); threshold Scr L878 = Scb L921 = Pat L956; noteOrder = Scb L${noteCtxLines[0]}-${noteCtxLines[1]}`);

  // --- red flags --------------------------------------------------------------------------
  const scbFlag = Object.fromEntries(scb.RED_FLAGS.map((f) => [f.id, f]));
  const redFlags = scr.RED_FLAGS.map((f) => {
    const s = scbFlag[f.id];
    if (!s) fail(`Scribe has no flag ${f.id}`);
    check(s.tier === f.tier && s.group === f.group, `flag ${f.id}: tier and group agree in Screener and Scribe`);
    const o = plain(f);
    if (s.ask !== undefined) o.ask = s.ask;
    return o;
  });
  check(deepEqual(scr.RED_FLAGS.map((f) => f.id), scb.RED_FLAGS.map((f) => f.id)), "flag order identical in Screener and Scribe");
  const scbDiffering = scr.RED_FLAGS.filter((f) => ["text", "points", "action"].some((k) => scbFlag[f.id][k] !== f[k])).map((f) => f.id);
  src("/redFlags", "Scr", Scr.decl("RED_FLAGS"), `RED_FLAGS (canonical); ask from Scb L${Scb.decl("RED_FLAGS").join("-")}; Scribe wording differs for ${scbDiffering.length} of 12 flags (dropped)`);

  // --- steps ------------------------------------------------------------------------------
  const rail = Object.fromEntries(scr.STEPS.map((s) => [s.key, { eyebrow: s.eyebrow, title: s.title }]));
  const stepCard = (eyebrowLine, h2Line, pFrom, pTo) => {
    const card = { eyebrow: flat(jsx(Scr.region(eyebrowLine).trim())).trim() };
    if (h2Line) card.heading = flat(jsx(Scr.region(h2Line).trim())).trim();
    if (pFrom) card.sub = flat(jsx(Scr.region(pFrom, pTo).trim())).trim();
    return card;
  };
  const stepCardProps = (line) => {
    const cut = Scr.between(line, line, "&& ", "/>}") + "/>";
    const el = jsx(cut, { StepCard: "StepCard", answers: {}, set: () => {} });
    const s = findEl(el, (n) => n.type === "StepCard");
    return { dk: s.props.dk, card: { eyebrow: s.props.eyebrow, heading: s.props.title, sub: s.props.sub } };
  };
  // structural facts asserted against the source before they are written as data
  Scr.has(888, 888, 'stepKey === "safety" ? safetyDone');
  const requiresStep = Scr.match(888, 888, /stepKey === "(\w+)" \? !!complaint/)[1];
  Scr.has(1066, 1066, 'stepKey === "intake"');
  Scr.has(1077, 1080, "setComplaint(o.k)");
  const intakeQ = jsx(Scr.region(1086).trim(), { QGroup: "QGroup", answers: {}, set: () => {} });
  const intakeQProps = findEl(intakeQ, (n) => n.type === "QGroup").props;
  Scr.has(1096, 1096, 'stepKey === "impact"');
  const impactQ = findEl(jsx(Scr.region(1101).trim(), { QGroup: "QGroup", answers: {}, set: () => {} }), (n) => n.type === "QGroup").props;
  Scr.has(1103, 1103, "<ContextQ ");
  Scr.has(1107, 1107, 'stepKey === "result"');

  const screenerSteps = [];
  for (const s of scr.STEPS) {
    const st = { key: s.key };
    if (s.key === "safety") {
      Scr.has(1021, 1021, 'stepKey === "safety"');
      Object.assign(st, { kind: "safety", rail: rail[s.key], card: stepCard(1023, 1024, 1025, 1028) });
    } else if (s.key === "intake") {
      Object.assign(st, {
        kind: "domain", domainKeys: [intakeQProps.domainKey], extras: ["complaintPicker"],
        ...(requiresStep === "intake" ? { requires: "complaint" } : {}),
        rail: rail[s.key], card: stepCard(1068, 1069, 1070, 1070),
        domainIntro: { [intakeQProps.domainKey]: intakeQProps.intro },
      });
    } else if (s.key === "impact") {
      Object.assign(st, { kind: "domain", domainKeys: [impactQ.domainKey], extras: ["context"], rail: rail[s.key], card: stepCard(1098, 1099, 1100, 1100) });
    } else if (s.key === "result") {
      Object.assign(st, { kind: "result", rail: rail[s.key], card: stepCard(1221) });
    } else {
      const line = { migraine: 1090, vestibular: 1091, neuro: 1092, discriminators: 1094 }[s.key];
      if (!line) fail(`no card source for Screener step ${s.key}`);
      Scr.has(line, line, `stepKey === "${s.key}"`);
      const p = stepCardProps(line);
      Object.assign(st, { kind: "domain", domainKeys: [p.dk], rail: rail[s.key], card: p.card });
    }
    screenerSteps.push(st);
  }
  check(deepEqual(screenerSteps.filter((s) => s.kind === "domain").flatMap((s) => s.domainKeys).slice().sort(), scr.DOMAIN_ORDER.slice().sort()),
    "every domain is in exactly one Screener step");

  // Patient steps
  const patDomainKeys = evalLiteral(Pat.match(726, 726, /\{(\[[^\]]*\])\.includes\(key\)/)[1]);
  const storyQ = findEl(jsx(Pat.region(720, 721).trim(), { QBlock: "QBlock", a: {}, set: () => {}, t: {}, loc: "en" }), (n) => n.type === "QBlock").props;
  Pat.has(703, 703, 'key === "story"');
  Pat.has(709, 709, "CONTEXT_Q.map");
  const patientSteps = pat.SECTIONS.filter((s) => s.key === "story" || patDomainKeys.includes(s.key)).map((s) =>
    s.key === "story"
      ? { key: "story", kind: "story", domainKeys: [storyQ.domain], extras: ["context"] }
      : { key: s.key, kind: "domain", domainKeys: [s.key] });
  check(deepEqual(patientSteps.flatMap((s) => s.domainKeys).slice().sort(), scr.DOMAIN_ORDER.slice().sort()), "every domain is in exactly one Patient step");
  src("/steps/screener[]/rail", "Scr", Scr.decl("STEPS"), "STEPS {eyebrow, title}");
  src("/steps/screener[]/card", "Scr", "L1023-1028, L1068-1070, L1086, L1090-1094, L1098-1100, L1221", "step card eyebrow/h2/stepsub (JSX text, compiled); domainIntro = QGroup intro (L1086); requires from L888");
  src("/steps/patient", "Pat", Pat.decl("SECTIONS"), "SECTIONS keys; story = context questions (L709) + QBlock recalcitrance (L720); domain steps from L726");

  // --- phenotypes ---------------------------------------------------------------------------
  const pickSrc = Scr.between(1072, 1076, "{[", "].map(o =>");
  const phenoValues = evalLiteral(`[${pickSrc}]`).map((o) => ({ value: o.k, h: o.h, d: o.d }));
  const scribeDefault = Scb.match(849, 849, /; return "(\w+)";/)[1];
  const alwaysActive = JSON.parse(Scb.match(857, 857, /new Set\((\[[^\]]*\])\)/)[1]);
  const gateDomain = Scb.match(862, 862, /const vestActive = active\.has\("(\w+)"\)/)[1];
  Scb.has(866, 867, "vestActive && VMPATHI_TAG[");
  // Referral: the baseline bundle builders, per phenotype value.
  const answersFull = scr.SAMPLE_CASES.otologic.a;
  const score = scb.computeScore(answersFull);
  const referralText = (builder, complaint) => {
    const b = builder({
      patient: scr.DEMO_PATIENT, answers: answersFull, total: score.total, floor: score.floor, ceiling: score.ceiling,
      coverage: score.coverage, scorable: true, band: "high", domains: score.domains, complaint, ctx: {}, recs: [],
      activeFlags: [], emergent: false, routingCleared: true, note: "",
    });
    const sr = b.entry.map((e) => e.resource).filter((r) => r.resourceType === "ServiceRequest");
    if (sr.length !== 1) fail("expected exactly one referral ServiceRequest");
    const m = /^Referral: (.+) — evaluate for (.+)$/.exec(sr[0].code.text);
    if (!m) fail(`unexpected referral text: ${sr[0].code.text}`);
    return { specialty: m[1], reason: m[2] };
  };
  const refDefault = referralText(scr.buildBundle, "");
  const referral = { byPhenotype: {}, default: refDefault };
  for (const v of phenoValues) {
    const r = referralText(scr.buildBundle, v.value);
    check(deepEqual(r, referralText(scb.buildBundle, v.value)), `referral for "${v.value}": Screener ≡ Scribe`);
    if (!deepEqual(r, refDefault)) referral.byPhenotype[v.value] = r;
  }
  const termM = Scr.match(1344, 1344, /\{complaint === "(\w+)" \? "(\w+)" : "(\w+)"\}/);
  const cdsTerm = { byPhenotype: { [termM[1]]: termM[2] }, default: termM[3] };
  const phenotypes = { values: phenoValues, scribeDefault, alwaysActive, tagBoostDomain: gateDomain, referral, cdsTerm };
  src("/phenotypes/values", "Scr", [1072, 1076], "complaint picker {k → value, h, d}");
  src("/phenotypes/scribeDefault", "Scb", [849, 849], "complaint fallback");
  src("/phenotypes/alwaysActive", "Scb", [857, 857], "always-active suggestion domains");
  src("/phenotypes/tagBoostDomain", "Scb", [862, 866], "vestActive gates the tag boost");
  src("/phenotypes/referral", "Scr", [1455, 1456], "buildBundle referral ServiceRequest text per complaint (Scr L1577 ≡ Scb L1401, L1453), parsed as `Referral: {specialty} — evaluate for {reason}`");
  src("/phenotypes/cdsTerm", "Scr", [1344, 1344], "CDS preview ternary");

  // --- info prompts -------------------------------------------------------------------------
  const infoPrompts = {
    gateDomain,
    tagPrefix: Scb.match(1344, 1344, /\.replace\("([^"]+)",""\)/)[1],
    maxScored: Number(Scb.match(871, 871, /open\.slice\(0, (\d+)\)/)[1]),
    maxTotal: Number(Scb.match(876, 876, /items\.length < (\d+)/)[1]),
    prompts: plain(scb.VMPATHI_INFO),
  };
  check(infoPrompts.prompts.every((p) => p.tag.startsWith(infoPrompts.tagPrefix)), "every info prompt tag starts with the tag prefix");
  src("/infoPrompts", "Scb", Scb.decl("VMPATHI_INFO"), "prompts = VMPATHI_INFO; gateDomain Scb L862; maxScored L871; maxTotal L876; tagPrefix L1344");

  // --- sample cases ---------------------------------------------------------------------------
  const buttons = Object.fromEntries(Scr.matchAll(994, 997, /loadSample\("(\w+)"\)\}><(\w+) size=\{14\}\/> ([^<]+)<\/button>/g)
    .map((m) => [m[1], { icon: m[2], buttonLabel: m[3] }]));
  const sampleCases = Object.entries(scr.SAMPLE_CASES).map(([id, c]) => {
    const b = buttons[id];
    if (!b) fail(`no sample button for ${id}`);
    const o = { id, label: c.label, buttonLabel: b.buttonLabel, icon: b.icon };
    if (c.complaint !== undefined) o.complaint = c.complaint;
    if (c.ctx) o.ctx = plain(c.ctx);
    if (c.rf && Object.keys(c.rf).length) o.rf = plain(c.rf);
    o.a = plain(c.a);
    return o;
  });
  const simIcons = Object.fromEntries(Sim.matchAll(...Sim.decl("SCENARIOS"), /\{ id:"(\w+)", icon:(\w+), label:/g).map((m) => [m[1], m[2]]));
  for (const s of sim.SCENARIOS) {
    const r = s.apply();
    check(r.safety === true, `scenario ${s.id}: safety review recorded (default safetyReviewed)`);
    const o = { id: `sim-${s.id}`, label: s.label, buttonLabel: s.label, group: "scenario", icon: simIcons[s.id], why: s.why, complaint: "" };
    if (!o.icon) fail(`no icon for scenario ${s.id}`);
    if (r.rf && Object.keys(r.rf).length) o.rf = plain(r.rf);
    o.a = plain(r.answers);
    sampleCases.push(o);
  }
  check(deepEqual(sampleCases.find((c) => c.id === "sim-high").a, plain(sim.FULL_HIGH)), "sim-high inlines FULL_HIGH");
  src("/sampleCases[0..3]", "Scr", Scr.decl("SAMPLE_CASES"), "SAMPLE_CASES (key → id); buttonLabel and icon from the sample buttons Scr L994-997");
  src("/sampleCases[4..8]", "Sim", Sim.decl("SCENARIOS"), "SCENARIOS: id → sim-<id>, label (also buttonLabel, as Sim L652 renders it), icon name, why, apply().answers (FULL_HIGH Sim L308-312 inlined), apply().rf when non-empty; step dropped");

  // --- demo -------------------------------------------------------------------------------------
  check(deepEqual(plain(scr.DEMO_PATIENT), plain(scb.PATIENT)), "DEMO_PATIENT ≡ Scribe PATIENT");
  const demo = { patient: plain(scr.DEMO_PATIENT), transcript: plain(scb.SCRIPT) };
  src("/demo/patient", "Scr", Scr.decl("DEMO_PATIENT"), "DEMO_PATIENT (≡ Scb PATIENT L587)");
  src("/demo/transcript", "Scb", Scb.decl("SCRIPT"), "SCRIPT");

  // --- lexicon ----------------------------------------------------------------------------------
  const goldUrl = new URL("../reference/MASQUE_v0.3.1/" + HAND.goldSetFile, env.appBase).href;
  const goldBytes = new Uint8Array(await (await fetch(goldUrl, { cache: "no-cache" })).arrayBuffer());
  const refManifest = await (await fetch(new URL("../reference/MASQUE_v0.3.1/MANIFEST.sha256", env.appBase).href, { cache: "no-cache" })).text();
  const goldPin = (refManifest.split("\n").find((l) => l.endsWith(`./${HAND.goldSetFile}`)) || "").split(/\s+/)[0];
  check(goldPin && (await sha256Hex(goldBytes)) === goldPin, "gold set file matches reference/MASQUE_v0.3.1/MANIFEST.sha256");
  const gold = JSON.parse(new TextDecoder().decode(goldBytes));
  const lexicon = {
    version: ext.LEXICON_VERSION,
    lang: voice.VOICE_LANG,
    negation: plain(ext.NEGATION),
    thirdParty: plain(ext.THIRD_PARTY),
    historical: plain(ext.HISTORICAL),
    bool: plain(ext.BOOL_EX),
    ctx: plain(ext.CTX_EX),
    scale: plain(ext.SCALE_EX),
    multi: plain(ext.MULTI_EX),
    redFlags: plain(ext.RF_PHRASES),
    goldSet: { version: gold._meta.version, lexiconVersion: HAND.goldSetLexiconVersion, file: HAND.goldSetFile },
  };
  check(deepEqual(Object.keys(lexicon.redFlags).slice().sort(), redFlags.map((f) => f.id).slice().sort()), "RF_PHRASES keys === flag ids");
  check(Object.values(lexicon.redFlags).every((l) => l.length > 0), "every red flag has a cue phrase");
  src("/lexicon", "Ext", [24, 166], "LEXICON_VERSION L24, NEGATION, THIRD_PARTY, HISTORICAL, BOOL_EX, CTX_EX, SCALE_EX, MULTI_EX, RF_PHRASES (keys renamed only); lang = Voice L47 VOICE_LANG; goldSet.version = reference/MASQUE_v0.3.1/masque_extraction_goldset.json _meta.version");

  // --- locales ----------------------------------------------------------------------------------
  check(deepEqual(Object.keys(pat.P), allIds), "Patient P key order = item order");
  check(allIds.every((id) => pat.ES_P[id]), "ES_P covers every item");
  check(scr.RED_FLAGS.every((f, i) => pat.RED_FLAGS[i].id === f.id && pat.RED_FLAGS[i].tier === (f.tier === "emergent" ? "now" : "soon")),
    "Patient flags: same order, tier emergent→now, urgent→soon");
  const sectionIndex = (key) => pat.SECTIONS.findIndex((s) => s.key === key);
  const blurb = { en: pat.BLURB, es: pat.BLURB_ES };
  const localeSteps = (loc) => {
    const out = {};
    for (const s of patientSteps) {
      const o = { title: pat.UI[loc].sections[sectionIndex(s.key)] };
      if (s.key === "story" && loc === "en") {
        o.heading = flat(jsx(Pat.region(705).trim())).trim();
        o.lede = flat(jsx(Pat.region(706, 707).trim())).trim();
        o.intro = storyQ.intro;
      }
      if (s.kind === "domain") o.lede = blurb[loc][s.key];
      out[s.key] = o;
    }
    return out;
  };
  check(pat.SECTIONS.every((s, i) => pat.UI.en.sections[i] === s.title), "UI.en.sections equals SECTIONS titles");
  const forYouIf = [787, 788, 789].map((l) => flat(jsx(Pat.region(l).trim())).trim());
  Pat.has(786, 786, "<ul>");
  Pat.has(790, 790, "</ul>");
  const clinicianLede = flat(jsx(Pat.region(1066, 1070).trim(), { INSTRUMENT_VERSION: "{instrument}" })).trim();
  const locales = {
    en: {
      reviewed: pat.REVIEWED.en,
      items: plain(pat.P),
      redFlags: Object.fromEntries(pat.RED_FLAGS.map((f) => [f.id, { q: f.q, say: f.say }])),
      contextItems: Object.fromEntries(pat.CONTEXT_Q.map((c) => [c.id, { q: c.q, opts: plain(c.opts) }])),
      steps: localeSteps("en"),
      ui: { sub: pat.UI.en.sub, forYouIf, clinicianLede },
    },
    es: {
      reviewed: pat.REVIEWED.es,
      items: plain(pat.ES_P),
      redFlags: plain(pat.ES_RF),
      steps: localeSteps("es"),
      ui: { sub: pat.UI.es.sub },
    },
  };
  check(deepEqual(pat.CONTEXT_Q.map((c) => c.id), contextItems.map((c) => c.id)), "Patient context questions = clinician context items, same order");
  src("/locales/en/items", "Pat", Pat.decl("P"), "P");
  src("/locales/es/items", "Pat", Pat.decl("ES_P"), "ES_P");
  src("/locales/en/redFlags", "Pat", Pat.decl("RED_FLAGS"), "RED_FLAGS {q, say} by id (tier maps through TIER_DISPLAY)");
  src("/locales/es/redFlags", "Pat", Pat.decl("ES_RF"), "ES_RF");
  src("/locales/en/contextItems", "Pat", Pat.decl("CONTEXT_Q"), "CONTEXT_Q {q, opts}, the Patient's own values (not realigned)");
  src("/locales/*/steps/*/title", "Pat", Pat.decl("UI"), "UI[loc].sections[2..7] (L383, L405)");
  src("/locales/*/steps/<domain>/lede", "Pat", [761, 774], "BLURB (L768-774), BLURB_ES (L761-767)");
  src("/locales/en/steps/story/{heading,lede,intro}", "Pat", [705, 721], "story h2 L705, lede L706-707, QBlock intro L720-721");
  src("/locales/*/ui/sub", "Pat", [381, 403], "UI.en.sub L381, UI.es.sub L403");
  src("/locales/en/ui/forYouIf", "Pat", [787, 789], "Intro \"It's for you if\" list");
  src("/locales/en/ui/clinicianLede", "Pat", [1066, 1070], "clinician paragraph; {INSTRUMENT_VERSION} → {instrument}; <b>−</b> → **−**");
  src("/locales/*/reviewed", "Pat", Pat.decl("REVIEWED"), "REVIEWED");

  // --- research ---------------------------------------------------------------------------------
  const projectKey = Scr.match(1137, 1137, /<ResearchReadinessPanel project="(\w+)"/)[1];
  check(projectKey === Scb.match(1266, 1266, /<ResearchReadinessPanel project="(\w+)"/)[1], "Screener and Scribe pass the same panel project");
  const P0 = rrp.PROJECTS[projectKey];
  if (!P0) fail(`PROJECTS has no ${projectKey}`);
  const aliasArgs = RRP.match(198, 198, /numOrNull\(r\.score, ([^)]*)\)/)[1].split(",").map((s) => s.trim().replace(/^r\./, ""));
  const prefix = projectKey.toLowerCase() + "_";
  const scoreAliases = aliasArgs.filter((a) => a.startsWith(prefix));
  check(deepEqual(scoreAliases, RRP.match(217, 217, /anyPresent\(r\.score, ([^)]*)\)/)[1].split(",").map((s) => s.trim().replace(/^r\./, "")).filter((a) => a.startsWith(prefix))),
    "score aliases identical at RRP L198 and L217");
  const artifactKey = RRP.match(839, 839, /parsed\.(\w+)==="population-estimates"/)[1];
  const etlScript = RRP.match(966, 966, /<code>app\/(etl\/[\w.]+\.R)<\/code>/)[1];
  RRP.has(779, 779, etlScript.split("/")[1]);
  const fairnessAxes = JSON.parse(RRP.match(942, 942, /\{(\[[^\]]*\])\.map\(ax=>/)[1]);
  // demo cohorts: makeCohort(kind) as data, verified by regenerating each cohort
  const [mc0, mc1] = Sim.decl("makeCohort");
  const seed = Number(Sim.match(mc0, mc1, /let s = (\d+) >>> 0;/)[1]);
  const prevalence = Number(Sim.match(mc0, mc1, /R\(\) < ([\d.]+) \? 1 : 0/)[1]);
  const rm = Sim.match(mc0, mc1, /hi \? \(y\?(\d+)\+R\(\)\*(\d+):(\d+)\+R\(\)\*(\d+)\) : \(y\?(\d+)\+R\(\)\*(\d+):(\d+)\+R\(\)\*(\d+)\)/).slice(1).map(Number);
  const ranges = { hi: { pos: [rm[0], rm[1]], neg: [rm[2], rm[3]] }, lo: { pos: [rm[4], rm[5]], neg: [rm[6], rm[7]] } };
  const kindBlocks = Sim.region(mc0, mc1).split('if (kind === "').slice(1);
  const specs = {};
  for (const block of kindBlocks) {
    const kind = block.slice(0, block.indexOf('"'));
    const groups = [...block.matchAll(/push\("(\w*)","(\w*)",(\d+),(true|false),(true|false)\)/g)]
      .map((m) => ({ sex: m[1], gender: m[2], n: Number(m[3]), hi: m[4] === "true", labeled: m[5] === "true" }));
    const extraRows = [...block.matchAll(/rows\.push\((\{[^\n]*\})\);/g)].map((m) => evalLiteral(m[1]));
    specs[kind] = { seed, prevalence, hi: ranges.hi, lo: ranges.lo, groups, ...(extraRows.length ? { extraRows } : {}) };
  }
  const demoCohorts = sim.COHORTS.map((c) => {
    const spec = specs[c.id];
    if (!spec) fail(`no makeCohort branch for ${c.id}`);
    check(deepEqual(regenerateCohort(spec), sim.makeCohort(c.id)), `demo cohort ${c.id}: spec regenerates Sim makeCohort("${c.id}") exactly`);
    return { id: c.id, label: c.label, why: c.why, spec: plain(spec) };
  });
  const research = {
    projectKey,
    title: P0.title,
    target: P0.target,
    threshold: P0.threshold,
    calibration: { ...plain(P0.calibration), appliesTo: { scoringHash: "" } },
    sources: plain(P0.sources),
    expected: plain(P0.expected),
    demo: plain(P0.demo),
    scoreAliases,
    artifactKey,
    etlScript,
    fairnessAxes,
    demoCohorts,
    population: { index: pop.INDEX_PATH, schema: pop.SCHEMA_PATH, map: pop.MAP_PATH },
  };
  const extraP0 = Object.keys(P0).filter((k) => !(k in research));
  check(extraP0.length === 0, "every PROJECTS.MASQUE key is carried");
  src("/research/{title,target,threshold,calibration,sources,expected,demo}", "RRP", [26, 56], "PROJECTS.MASQUE verbatim (projectKey = the panel project, Scr L1137 = Scb L1266)");
  src("/research/calibration/appliesTo/scoringHash", "—", "engine/hash.js", "rubricHashes(rubric).scoringHash, computed by this tool");
  src("/research/scoreAliases", "RRP", [198, 198], "brand alias among the numOrNull arguments (≡ L217)");
  src("/research/artifactKey", "RRP", [839, 839], "parsed.<key> === \"population-estimates\"");
  src("/research/etlScript", "RRP", [966, 966], "<code>app/etl/…</code>, made relative to app/ (also named at L779)");
  src("/research/fairnessAxes", "RRP", [942, 942], "the axis toggle list");
  src("/research/demoCohorts", "Sim", Sim.decl("COHORTS"), `COHORTS {id, label, why}; spec from makeCohort Sim L${mc0}-${mc1} (seed, prevalence, score ranges as [base, span], groups, extra row), each regenerated and compared`);
  src("/research/population", "Pop", [31, 33], "INDEX_PATH, SCHEMA_PATH, MAP_PATH");

  // --- fhir -------------------------------------------------------------------------------------
  const vars = { id: HAND.id, instrument: instrumentVersion };
  const q = scr.buildQuestionnaire();
  const safetyGroup = q.item.find((g) => g.linkId === "safety");
  const criteriaItem = q.item.flatMap((g) => g.item).find((i) => i.code && i.linkId !== undefined && !scr.RED_FLAGS.some((f) => f.id === i.linkId));
  const scbBundle = scb.buildBundle({
    patient: scb.PATIENT, answers: answersFull, total: score.total, floor: score.floor, ceiling: score.ceiling, coverage: score.coverage,
    scorable: true, band: "high", domains: score.domains, complaint: "otologic", note: "", activeFlags: [], emergent: false, routingCleared: true,
  });
  const scrBundle = scr.buildBundle({
    patient: scr.DEMO_PATIENT, answers: answersFull, total: score.total, floor: score.floor, ceiling: score.ceiling, coverage: score.coverage,
    scorable: true, band: "high", domains: score.domains, complaint: "otologic", ctx: {}, recs: [], activeFlags: [], emergent: false,
  });
  const obs = scrBundle.entry.map((e) => e.resource).find((r) => r.resourceType === "Observation");
  const obsScb = scbBundle.entry.map((e) => e.resource).find((r) => r.resourceType === "Observation");
  const docRef = scbBundle.entry.map((e) => e.resource).find((r) => r.resourceType === "DocumentReference");
  const row = scr.screenToCohortRow({ patient: scr.DEMO_PATIENT, answers: {}, total: 0, coverage: 0, scorable: false, band: "indeterminate", activeFlags: [], complaint: "", ctx: {} });
  const fhir = {
    questionnaireUrl: HAND.fhir.questionnaireUrl,
    questionnaireName: q.name,
    questionnaireTitle: q.title,
    publisher: q.publisher,
    description: q.description,
    safetyGroupText: safetyGroup.text,
    codeSystem: HAND.fhir.codeSystem,
    answerSystem: HAND.fhir.answerSystem,
    criteriaSystem: HAND.fhir.criteriaSystem,
    weightExtension: HAND.fhir.weightExtension,
    indexCode: HAND.fhir.indexCode,
    indexDisplay: obs.code.coding[0].display,
    documentType: docRef.type.text,
    documentTitle: docRef.content[0].attachment.title,
    screenIdPrefix: HAND.fhir.screenIdPrefix,
    filePrefix: HAND.fhir.filePrefix,
  };
  check(render(fhir.questionnaireUrl, vars) === scr.QUESTIONNAIRE_URL, "identity: questionnaireUrl renders to Scr QUESTIONNAIRE_URL");
  check(render(fhir.codeSystem, vars) === safetyGroup.item[0].code[0].system && render(fhir.codeSystem, vars) === obs.code.coding[0].system,
    "identity: codeSystem renders to the Questionnaire flag code system and the index Observation system");
  check(render(fhir.answerSystem, vars) === scr.ANSWER_SYSTEM, "identity: answerSystem renders to Scr ANSWER_SYSTEM");
  check(criteriaItem && render(fhir.criteriaSystem, vars) === criteriaItem.code[0].system, "identity: criteriaSystem renders to the Questionnaire criterion system");
  check(render(fhir.weightExtension, vars) === scr.WEIGHT_EXT, "identity: weightExtension renders to Scr WEIGHT_EXT");
  check(render(fhir.indexCode, vars) === obs.code.coding[0].code && render(fhir.indexCode, vars) === obsScb.code.coding[0].code, "identity: indexCode renders to the index Observation code (Screener and Scribe)");
  check(obsScb.code.coding[0].display === fhir.indexDisplay, "indexDisplay identical in Screener and Scribe bundles");
  check(row.screen_id.startsWith(render(fhir.screenIdPrefix, vars)) && Scr.region(574).includes("`" + render(fhir.screenIdPrefix, vars) + "${Date.now()"),
    "identity: screenIdPrefix renders to the screen_id prefix (Scr L574)");
  check(Scr.region(1407).includes("`" + render(fhir.filePrefix, vars) + "-questionnaire-v${INSTRUMENT_VERSION}.json`")
    && Scr.region(1410).includes(`"${render(fhir.filePrefix, vars)}-cds-hooks.json"`)
    && Scr.region(966).includes("`" + render(fhir.filePrefix, vars) + "-pilot-cohort-"), "identity: filePrefix renders to the download-name prefix (Scr L966, L1407-1413)");
  check(deepEqual(plain(scb.buildQuestionnaire().item.slice(1)), plain(q.item.slice(1))) && scb.buildQuestionnaire().name === q.name, "Scribe Questionnaire ≡ Screener outside the red-flag group");
  src("/fhir/questionnaireUrl", "Scr", [80, 80], "QUESTIONNAIRE_URL as a template (hand-written, rendered back and compared)");
  src("/fhir/{questionnaireName,questionnaireTitle,publisher,description}", "Scr", [429, 438], "buildQuestionnaire() name, title, publisher, description");
  src("/fhir/safetyGroupText", "Scr", [443, 443], "buildQuestionnaire() safety group text");
  src("/fhir/{codeSystem,answerSystem,criteriaSystem,weightExtension}", "Scr", "L421-422, L447, L467", "templates (hand-written), rendered back and compared with ANSWER_SYSTEM, WEIGHT_EXT and the Questionnaire's code systems");
  src("/fhir/{indexCode,indexDisplay}", "Scr", [1537, 1537], "index Observation code (template, compared) and display (≡ Scb L1425)");
  src("/fhir/{documentType,documentTitle}", "Scb", [1444, 1446], "DocumentReference type.text and attachment title");
  src("/fhir/{screenIdPrefix,filePrefix}", "Scr", "L574, L966, L1407-1413", "templates (hand-written), compared with the screen_id and download-name prefixes");

  // --- cds --------------------------------------------------------------------------------------
  const hooks = scr.buildCdsHooks();
  check(deepEqual(plain(hooks), plain(scb.buildCdsHooks())), "CDS Hooks document identical in Screener and Scribe");
  const svc = hooks.discovery.services[0];
  const rfCard = hooks.exampleResponses.redFlagPresent.cards[0];
  const idxCard = hooks.exampleResponses.settledNonLowBand.cards[0];
  const withheld = ". The screening index is withheld from routing.";
  check(rfCard.detail.endsWith(withheld), "redFlagPresent detail = flag action + engine sentence");
  const rfAction = rfCard.detail.slice(0, -withheld.length);
  const rfExample = scr.RED_FLAGS.filter((f) => f.action === rfAction);
  check(rfExample.length === 1, "redFlagPresent detail names exactly one flag's action");
  const settledM = /index (\d+)\/(\d+) — (\w+) likelihood/.exec(idxCard.summary);
  if (!settledM) fail(`unexpected settled summary: ${idxCard.summary}`);
  check(Number(settledM[2]) === scaleMaxComputed && scr.bandFor(Number(settledM[1])) === settledM[3], "settled example: score/scaleMax and band agree with bandFor");
  const cds = {
    serviceId: HAND.cds.serviceId,
    hook: svc.hook,
    title: svc.title,
    description: svc.description,
    source: { label: rfCard.source.label, url: HAND.cds.sourceUrl },
    safetyCardUuid: HAND.cds.safetyCardUuid,
    indexCardUuid: HAND.cds.indexCardUuid,
    examples: {
      redFlagPresent: { flagId: rfExample[0].id, summary: rfCard.summary },
      settled: { score: Number(settledM[1]), band: settledM[3], summary: idxCard.summary, detail: idxCard.detail },
    },
  };
  check(render(cds.serviceId, vars) === svc.id, "identity: cds.serviceId renders to the service id");
  check(render(cds.safetyCardUuid, vars) === rfCard.uuid && render(cds.indexCardUuid, vars) === idxCard.uuid, "identity: card uuids render to the example uuids");
  check(render(cds.source.url, vars) === rfCard.source.url && rfCard.source.url === idxCard.source.url && rfCard.source.label === idxCard.source.label, "identity: cds.source.url renders to both example sources");
  check(svc.prefetch.priorScreens.includes(`code=${render(fhir.codeSystem, vars)}|${render(fhir.indexCode, vars)}&`), "prefetch names codeSystem|indexCode");
  src("/cds/{hook,title,description}", "Scr", [478, 483], "buildCdsHooks() discovery service");
  src("/cds/{serviceId,safetyCardUuid,indexCardUuid,source}", "Scr", "L479, L496-500, L507, L511", "templates (hand-written) compared with the service id, card uuids and source url; source.label from the cards");
  src("/cds/examples", "Scr", [494, 512], "redFlagPresent {flagId = the flag whose action the detail names, summary}; settled {score, band parsed from the summary, summary, detail}");

  // --- copy -------------------------------------------------------------------------------------
  const one = (s, line, scope) => flat(jsx(s.region(line).trim(), scope)).trim();
  const many = (s, a, b, scope) => flat(jsx(s.region(a, b).trim(), scope)).trim();
  const stripPrefix = (text, prefix, what) => {
    if (!text.startsWith(prefix)) fail(`${what}: expected the engine prefix ${JSON.stringify(prefix)}`);
    return text.slice(prefix.length);
  };
  const noEscape = (s, what) => { if (/\\|\$\{/.test(s)) fail(`${what}: unexpected escape or interpolation in ${s}`); return s; };
  const t1 = (s, line) => {
    const el = findEl(jsx(s.region(line).trim(), { APP_VERSION: "" }), (n) => n.props.className === "t1");
    return el.children.filter((c) => typeof c === "string").join("").trim();
  };
  const scbGap = jsx(Scb.region(1079).trim(), { gapFlags: [] });
  const scbNotew = jsx(Scb.region(1252).trim(), { ShieldCheck: "ShieldCheck" });
  const cdsIndexTitleSrc = Scr.region(1343, 1345).trim().replace(/\{complaint === "\w+" \? "\w+" : "\w+"\}/, "{CDS_TERM}");
  const indexBody = many(Scr, 1346, 1349, { total: "{total}", bandMeta: { label: "{bandLabel}" } });
  const scaleRe = new RegExp(`/${scaleMaxComputed}\\b`, "g");
  check((indexBody.match(scaleRe) || []).length === 1, "CDS index body: one literal /scaleMax restatement");
  const copy = {
    indexName: one(Scr, 1243),
    gate: { patternPhrase: noEscape(Scr.between(898, 898, "before this presentation is treated as a ", ". \""), "gate.patternPhrase") },
    screener: {
      title: t1(Scr, 1005),
      subtitle: one(Scr, 1006),
      bandSuffix: stripPrefix(flat(jsx(Scr.region(1255).trim().replace(/^\?\s*/, ""), { Activity: "Activity", bandMeta: { label: "{L}" } })), " {L} ", "screener.bandSuffix").trim(),
      gapAlert: {
        title: one(Scr, 1303),
        body: stripPrefix(many(Scr, 1304, 1308, { gapFlags: [] }), ". ", "screener.gapAlert.body"),
      },
      disclaimer: many(Scr, 1426, 1429),
      emrDetails: [1435, 1436, 1437, 1438, 1439].map((l) => one(Scr, l)),
      specIntro: many(Scr, 1404, 1405),
    },
    scribe: {
      title: t1(Scb, 958),
      subtitle: one(Scb, 959),
      gapAlert: {
        title: flat(findEl(scbGap, (n) => n.props.className === "at")).trim(),
        body: stripPrefix(flat(findEl(scbGap, (n) => n.props.className === "ap")), ". ", "scribe.gapAlert.body").trim(),
      },
      vmpathiDisclaimer: flat(findEl(scbNotew, (n) => n.type === "span")).trim(),
      about: [1259, 1260, 1261, 1262].map((l) => one(Scb, l)),
    },
    note: {
      title: noEscape(stripPrefix(Scb.region(1352), "`", "note.title"), "note.title"),
      screenHeading: noEscape(Scb.region(1368).slice(0, Scb.region(1368).indexOf("${")), "note.screenHeading"),
      likelihoodOf: noEscape(Scb.between(1370, 1370, "${band.toUpperCase()} ", ".`"), "note.likelihoodOf"),
      patternPhrase: noEscape(Scb.between(1382, 1382, "before treating this as a ", ".\\n\""), "note.patternPhrase"),
      infoCovered: noEscape(Scb.between(1366, 1366, '? "', ': " +'), "note.infoCovered"),
      gapLine: noEscape(Scb.between(1374, 1374, '? "  ', '" :'), "note.gapLine"),
      supportingFooter: noEscape(Scb.region(1378).trim(), "note.supportingFooter"),
      noDriver: noEscape(Scb.between(1390, 1390, '"  • ', '"}'), "note.noDriver"),
      signOff: noEscape(Scb.region(1392).slice(0, Scb.region(1392).indexOf("`")), "note.signOff"),
    },
    cds: {
      preview: {
        safetyTitle: many(Scr, 1333, 1335),
        indexTitle: flat(jsx(cdsIndexTitleSrc, { CDS_TERM: "{cdsTerm}" })).trim(),
        indexBody: indexBody.replace(scaleRe, "/{scaleMax}"),
      },
    },
  };
  // the note lines the slots come from, asserted structurally
  Scb.has(1351, 1352, "return (\n`");
  Scb.has(1353, 1353, "Patient: ${patient.family}");
  Scb.has(1368, 1368, "${scorable ? \"\" : \" — INCOMPLETE, NO RESULT ISSUED\"}");
  Scb.has(1376, 1376, "SUPPORTING FEATURES AND EXAM (recorded, not scored)");
  Scb.has(1392, 1392, "`");
  check(Scb.region(1393).trim() === ");", "note template ends at Scb L1392");
  check(copy.scribe.title && copy.screener.title, "brand titles found");
  src("/copy/indexName", "Scr", [1243, 1243], "result h2");
  src("/copy/gate/patternPhrase", "Scr", [898, 898], "override rec p: \"…treated as a {gate.patternPhrase}. …\"");
  src("/copy/screener/title", "Scr", [1005, 1005], "brand row t1 text before the version span (trimmed)");
  src("/copy/screener/subtitle", "Scr", [1006, 1006], "brand row t2 (&amp; → &)");
  src("/copy/screener/bandSuffix", "Scr", [1255, 1255], "text after {bandMeta.label}");
  src("/copy/screener/gapAlert/title", "Scr", [1303, 1303], ".at");
  src("/copy/screener/gapAlert/body", "Scr", [1304, 1308], ".ap after the engine's `labels.join(\" · \") + \". \"`");
  src("/copy/screener/disclaimer", "Scr", [1426, 1429], "result note span");
  src("/copy/screener/emrDetails", "Scr", [1435, 1439], "five <div>s; <b>…</b> → **…**");
  src("/copy/screener/specIntro", "Scr", [1404, 1405], "Published specification intro");
  src("/copy/scribe/title", "Scb", [958, 958], "brand row t1 text before the version span (trimmed)");
  src("/copy/scribe/subtitle", "Scb", [959, 959], "brand row t2");
  src("/copy/scribe/gapAlert/{title,body}", "Scb", [1079, 1079], ".at; .ap after the engine prefix");
  src("/copy/scribe/vmpathiDisclaimer", "Scb", [1252, 1252], "notew span");
  src("/copy/scribe/about", "Scb", [1259, 1262], "four <div>s; <b>…</b> → **…**");
  src("/copy/note/title", "Scb", [1352, 1352], "first note line");
  src("/copy/note/screenHeading", "Scb", [1368, 1368], "text before the INCOMPLETE suffix");
  src("/copy/note/likelihoodOf", "Scb", [1370, 1370], "text after \"Index {total}/{scaleMax} — {BAND} \"");
  src("/copy/note/patternPhrase", "Scb", [1382, 1382], "A&P red-flag line: \"…treating this as a {note.patternPhrase}.\"");
  src("/copy/note/infoCovered", "Scb", [1366, 1366], "label before \": \" + covered domains");
  src("/copy/note/gapLine", "Scb", [1374, 1374], "gap line without its two-space indent");
  src("/copy/note/supportingFooter", "Scb", [1378, 1378], "verbatim, indent trimmed (Q7)");
  src("/copy/note/noDriver", "Scb", [1390, 1390], "A&P fallback without \"  • \"");
  src("/copy/note/signOff", "Scb", [1392, 1392], "last note line");
  src("/copy/cds/preview/safetyTitle", "Scr", [1333, 1335], "override CDS card title");
  src("/copy/cds/preview/indexTitle", "Scr", [1343, 1345], "index CDS card title; the complaint ternary → {cdsTerm}");
  src("/copy/cds/preview/indexBody", "Scr", [1346, 1349], "{total}, {bandMeta.label} → {bandLabel}, /100 → /{scaleMax}");

  // --- top level --------------------------------------------------------------------------------
  const rubric = {
    format: FORMAT.rubric,
    contractVersion: CONTRACT_VERSION,
    id: HAND.id,
    label: HAND.label,
    name: HAND.name,
    icon: HAND.icon,
    instrumentVersion,
    logicBinding: { moduleId: HAND.id },
    domains,
    bands,
    contextItems,
    gapRule,
    redFlags,
    steps: { screener: screenerSteps, patient: patientSteps },
    phenotypes,
    infoPrompts,
    sampleCases,
    demo,
    lexicon,
    locales,
    research,
    fhir,
    cds,
    copy,
    changelog: CHANGELOG_NOTES.map((c) => ({ date: HAND.changelogDate, kind: c.kind, note: c.note, paths: c.paths })),
  };
  check(scaleMaxComputed === 100, "Σ positive domain max = 100");
  for (const d of rubric.domains) check(Math.abs(d.items.reduce((s, i) => s + i.w, 0) - d.max) < 1e-9, `domain ${d.key}: Σw = max`);
  src("/{format,contractVersion}", "—", "engine/contract.js", "FORMAT.rubric, CONTRACT_VERSION");
  src("/{id,label,name,icon}", "—", "hand-written", "design §9.2 item 6 (label: user requirement 2026-10-02, Q1)");
  src("/logicBinding", "—", "hand-written", "{moduleId: id}; the registry pairs the files, no SHA pin (§3.8)");
  src("/changelog", "—", "hand-written", "reconciliation, extraction and open-question notes (§3.8)");

  // scoring hash with WP0's rubricHashes (the binder's implementation)
  const hashes = await rubricHashes(rubric);
  rubric.research.calibration.appliesTo.scoringHash = hashes.scoringHash;
  check(/^[0-9a-f]{64}$/.test(hashes.scoringHash), "scoringHash is 64-hex");
  check((await rubricHashes(rubric)).scoringHash === hashes.scoringHash, "scoringHash is independent of research (stable after storing it)");

  // --- serialise and compare with the committed file ---------------------------------------------
  const text = JSON.stringify(rubric, null, 2) + "\n";
  check(!text.includes("\\u"), "no \\u escapes");
  check(!text.includes("\r"), "LF only");
  check(deepEqual(JSON.parse(text), rubric), "JSON round trip is lossless");
  const sha256 = await sha256Hex(text);
  let committed = { sha256: null, identical: false, error: null };
  try {
    const res = await fetch(new URL("modules/masque/masque.rubric.json", env.appBase).href, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    committed.sha256 = await sha256Hex(bytes);
    committed.identical = committed.sha256 === sha256;
  } catch (err) {
    committed.error = String(err && err.message || err);
  }
  return { rubric, text, sha256, hashes, sources, checks, committed };
}

/**
 * Sim L285-305 driven by a CohortSpec — a verification transcription used only to prove that the
 * extracted spec reproduces the baseline cohort (the engine's own makeCohort is WP4's).
 */
function regenerateCohort(spec) {
  let s = spec.seed >>> 0;
  const R = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 4) / 0x10000000; };
  const rows = [];
  for (const g of spec.groups) {
    const r = g.hi ? spec.hi : spec.lo;
    for (let i = 0; i < g.n; i++) {
      const y = R() < spec.prevalence ? 1 : 0;
      rows.push({ score: Math.round(y ? r.pos[0] + R() * r.pos[1] : r.neg[0] + R() * r.neg[1]),
        label: g.labeled ? y : "", sex: g.sex, gender: g.gender,
        subject_id: `s-${g.sex[0]}${g.gender[0]}${i}`, captured_at: "2026-04-01" });
    }
  }
  for (const x of spec.extraRows || []) rows.push({ ...x });
  return rows;
}
