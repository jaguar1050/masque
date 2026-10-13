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
// After the baseline extraction the clinical-lead-approved lexicon delta (design 05 §6.2,
// tests/harness/lexicon-delta.js) is applied: lexicon 0.3.1 → 0.3.2 with applyLexiconDelta, proven
// exact by revertLexiconDelta, and its changelog entry is appended after the 2026-10-02 notes. The
// delta file is the only source of the 0.3.2 data; nothing of it is typed here.
//
// Release 0.4.2: the Spanish completion of the patient wording (tests/harness/locale-delta.js, an
// unreviewed team translation of 2026-10-06) is applied to the baseline-extracted locales.es the
// same way: applyLocaleDelta only adds, in the English key order, revertLocaleDelta must give back
// the baseline locales.es exactly, each row's English source must equal the English it translates,
// and its changelog entry follows the lexicon entry. Nothing of it is typed here either.
//
// Release 0.4.3: the EMR Friendly Template data (tests/harness/emr-delta.js, drafted by AI agents
// from verified sources on 2026-10-06, not reviewed by the clinical lead) is inserted as the
// top-level key `emrTemplate`, just before `changelog`: applyEmrDelta only adds (an existing key is
// refused), revertEmrDelta must give back the rubric without it exactly, every flag, item, probe,
// routing rule, phenotype and citation it names must exist (an exam row names an exam probe), every
// citation it carries must be used, and its changelog entry follows the translation entry. Nothing
// of it is typed here either.
//
// Release 0.4.4: the clinical lead signed off that data on 2026-10-07 (EMR_DELTA.signOff). The data
// is unchanged; drafted.reviewed is true only together with a complete signOff record (checked here
// and refused by applyEmrDelta otherwise), and the delta's sign-off changelog entry follows its
// emr-template entry, which stays as it was.
//
// Release 0.4.5: the clinical-lead referral rule for dizziness cases (tests/harness/referral-delta.js,
// decided in chat on 2026-10-07, 2026-10-09 and 2026-10-10) is applied last, under
// /phenotypes/referral only, with applyReferralDelta: the otologic destination changes from the
// baseline value it must still show, the phenotype both gets its own byPhenotype row (Neurology,
// with the reason the default gave it), and the clinician rules are added at the end of
// phenotypes.referral. revertReferralDelta must give back the rubric without them exactly; the
// rule's text must be the lead's words (the sentence without its opening reply word, the
// clarification verbatim, the definition verbatim but for the lead's amendments, each a single
// removal of words the lead's amendment names), the delta's destinations must be exactly the
// destinations that differ from the baseline (no reason moves), the rule must name exactly those
// phenotypes, nothing may escalate (the table holds no evidence or destination of its own), there
// is one basis per entry, and its changelog entry is the last, right after the 0.4.4 sign-off
// entry. Nothing of it is typed here.
//
// Release 0.4.6: the clinical lead's answers on the EMR template's open items
// (tests/harness/emr-decisions-delta.js, answered in chat on 2026-10-10) are applied last, under
// /emrTemplate only, with applyEmrDecisionsDelta: two keys are added (pastHistory at the end of
// emrTemplate, optionPlaceholders at the end of the HINTS exam row), nothing existing changes.
// revertEmrDecisionsDelta must give back the rubric without them exactly, so the signed-off
// emrTemplate of release 0.4.3 stays as it was under them; each answer must be one of the options the
// lead saw, the added rows must be exactly what the answers ask for, in the wording the chosen
// options quote (the modifying-conditions label, the HINTS placeholder) or the item's own (the
// family-history line), every item, probe and option named must exist, there is one basis per
// entry, and its changelog entry is the last, right after the release 0.4.5 referral entry.
// Nothing of it is typed here.
//
// Release 0.4.7: the lexicon change 0.3.2 → 0.3.3 (tests/harness/lexicon-delta-033.js: lexicon.clauses,
// lexicon.clarify, four negation cues and the gold-set reference, from the clinical lead's request and
// decisions of 2026-10-11) is applied right after the 0.3.2 delta with applyLexiconDelta, proven by
// revertLexiconDelta and, for the whole chain, revertLexiconChain. The lead's request and answers
// must be recorded verbatim; the lead-sourced rows must be exactly the verbs the request names and
// the rhinorrhea question verbatim; every clarify entry names one probe of the logic or one item; there
// is one basis per row, switch, entry and appended negation cue; gold set 0.4.0 must pin the reference
// file and gold set 0.3.0 (its SHA-256); and its change-log entry is the last. The clinical lead signed
// the delta off on 2026-10-12 (LEXICON_DELTA_033.signOff): the record must be complete and applied
// (lexicon033SignOffProblems of tests/harness/diff.js): no row is left a plain draft (every row the
// team drafted is "lead-approved", its basis still saying "Draft"), every struck row is absent, every
// approved row present, the rows added and the qualifiers removed at the sign-off in place, and the
// 19 Part D answers and the D8 follow-up answers recorded among their options. Nothing of it is typed
// here.
//
// Release 0.4.8: the clinical lead's question for item r_dur (tests/harness/question-delta-048.js,
// requested in chat on 2026-10-12) is applied last, with applyQuestionDelta: the item's clinician
// question (`ask`) changes from the baseline Scribe ASK it must still show to the lead's quoted
// sentence, verbatim; nothing else changes. revertQuestionDelta must give back the rubric without it
// exactly; the request must be recorded as written and quote both questions, the item must be the yes
// / no item the request names by its card tag, instrumentHash, scoringHash and lexiconHash must not
// move (ask is outside their projections), there is one basis per row, and its changelog entry
// follows the release 0.4.7 lexicon entry. Nothing of it is typed here.
//
// Release 0.4.8, follow-up: the clinical lead's plan line for the EMR template
// (tests/harness/emr-plan-delta-048.js, requested and answered in chat on 2026-10-12) is applied last,
// with applyEmrDecisionsDelta (the shape of the 0.4.6 answers): one key, planAdvice, is added at the
// end of /emrTemplate, nothing existing changes. revertEmrDecisionsDelta must give back the rubric
// without it exactly; the request must quote the line, the line must be that sentence verbatim (never
// re-cased or re-punctuated), the two answers must be recorded, its source and date must be the
// request's, instrumentHash, scoringHash and lexiconHash must not move (emrTemplate is outside their
// projections), there is one basis per line, and its changelog entry is the last, right after the
// question entry. Nothing of it is typed here.
//
// extractRubric(env) → {rubric, text, sha256, hashes, sources, checks, committed}
//   text     JSON.stringify(rubric, null, 2) + "\n" (UTF-8, LF, no \u escapes)
//   hashes   rubricHashes of the rubric as written, after its calibration's scoringHash is stored
//            (release 0.4.8 final review: they had been taken before, so their contentHash, which
//            covers research, was not the committed rubric's, and the 0.4.8 records quoted it)
//   sources  [{path, file, lines, how}] — the field → baseline file:lines map behind SOURCES.md
//   checks   [{ok, what}] — every cross-check the extraction ran (all must be ok)
//   committed {sha256, identical} — the committed modules/masque/masque.rubric.json, compared byte for byte
import { createOracles } from "../harness/oracles.js";
import {
  applyEmrDecisionsDelta, applyEmrDelta, applyLexiconDelta, applyLocaleDelta, applyQuestionDelta, applyReferralDelta, emrSignOffComplete, lexicon033SignOffProblems, revertEmrDecisionsDelta,
  revertEmrDelta, revertLexiconChain, revertLexiconDelta, revertLocaleDelta, revertQuestionDelta, revertReferralDelta,
} from "../harness/diff.js";
import { LEXICON_DELTA } from "../harness/lexicon-delta.js";
import { LEXICON_DELTA_033 } from "../harness/lexicon-delta-033.js";
import { LOCALE_DELTA } from "../harness/locale-delta.js";
import { EMR_DELTA } from "../harness/emr-delta.js";
import { REFERRAL_DELTA } from "../harness/referral-delta.js";
import { EMR_DECISIONS_DELTA } from "../harness/emr-decisions-delta.js";
import { QUESTION_DELTA } from "../harness/question-delta-048.js";
import { EMR_PLAN_DELTA } from "../harness/emr-plan-delta-048.js";
import { PATIENT_CHROME } from "../../src/engine/patient.js";
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
const arr = (x) => (Array.isArray(x) ? x : []);

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
  const lexicon031 = {
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
  check(deepEqual(Object.keys(lexicon031.redFlags).slice().sort(), redFlags.map((f) => f.id).slice().sort()), "RF_PHRASES keys === flag ids");
  check(Object.values(lexicon031.redFlags).every((l) => l.length > 0), "every red flag has a cue phrase");

  // The approved delta 0.3.1 → 0.3.2 (design 05 §6.2). applyLexiconDelta throws on any
  // precondition failure (version, entryId, a phrase already listed, a `from` that differs).
  const entryIdAt = (lex, path) => {
    const s = path.split("/").slice(1);
    if (!["bool", "ctx", "scale"].includes(s[0]) || !/^\d+$/.test(s[1] || "")) return undefined;
    const e = Array.isArray(lex[s[0]]) ? lex[s[0]][Number(s[1])] : undefined;
    return e && typeof e === "object" ? e.id : undefined;
  };
  const idRows = [...LEXICON_DELTA.appended, ...LEXICON_DELTA.fields].filter((r) => r.entryId !== undefined);
  check(idRows.length > 0 && idRows.every((r) => entryIdAt(lexicon031, r.path) === r.entryId),
    "lexicon delta: every appended[].entryId and fields[].entryId names the entry at its 0.3.1 position");
  const lexicon032 = applyLexiconDelta(lexicon031, LEXICON_DELTA);
  check(lexicon032.version === LEXICON_DELTA.to && deepEqual(revertLexiconDelta(lexicon032, LEXICON_DELTA), lexicon031),
    `lexicon delta: ${LEXICON_DELTA.from} → ${LEXICON_DELTA.to} applied, and revertLexiconDelta gives back the baseline lexicon exactly (key order included)`);
  const gold030Res = await fetch(new URL("tests/fixtures/goldset/" + lexicon032.goldSet.file, env.appBase).href, { cache: "no-cache" });
  if (!gold030Res.ok) fail(`gold set ${lexicon032.goldSet.file}: HTTP ${gold030Res.status}`);
  const gold030Bytes = new Uint8Array(await gold030Res.arrayBuffer());
  const gold030 = JSON.parse(new TextDecoder().decode(gold030Bytes));
  check(gold030 && gold030._meta && gold030._meta.version === lexicon032.goldSet.version && gold030._meta.lexiconVersion === lexicon032.goldSet.lexiconVersion
    && gold030._meta.basedOn && gold030._meta.basedOn.sha256 === goldPin && gold030._meta.basedOn.cases === gold.cases.length,
    `gold set ${lexicon032.goldSet.version} (tests/fixtures/goldset): _meta version and lexiconVersion equal the 0.3.2 lexicon's goldSet; basedOn pins the reference ${gold._meta.version} file and its ${gold.cases.length} cases`);

  // Release 0.4.7: the 0.3.2 → 0.3.3 delta (tests/harness/lexicon-delta-033.js), applied after the
  // 0.3.2 delta and proven by revert, the whole chain too. The lead's own words are checked here against
  // the lead's request verbatim; every other row was drafted by the team and approved by the lead on
  // 2026-10-12 ("lead-approved"), and the sign-off record is complete and applied.
  const D3 = LEXICON_DELTA_033;
  const lexicon = applyLexiconDelta(lexicon032, D3);
  check(lexicon.version === D3.to && D3.from === LEXICON_DELTA.to && deepEqual(revertLexiconDelta(lexicon, D3), lexicon032)
      && deepEqual(revertLexiconChain(lexicon, [LEXICON_DELTA, D3]), lexicon031)
      && deepEqual(Object.keys(lexicon), [...Object.keys(lexicon032).filter((k) => k !== "goldSet"), "clauses", "clarify", "goldSet"]),
    `lexicon delta 033: ${D3.from} → ${D3.to} applied after the 0.3.2 delta; revertLexiconDelta gives back the 0.3.2 lexicon and revertLexiconChain the baseline lexicon exactly (key order included); clauses and clarify are inserted just before goldSet`);
  {
    const req = arr(D3.request && D3.request.text).join("\n");
    const dec = D3.decisions || {};
    const rowsOf = (cl) => {
      const out = [];
      for (const k of ["affirm", "deny", "post", "prefix", "breaks", "scopeEnd", "complement", "mask", "hedge", "placeholder", "thirdParty", "chartIgnoreThirdParty"]) arr(cl[k]).forEach((r, i) => out.push([`/clauses/${k}/${i}`, r]));
      for (const k of ["exam", "family", "skip", "read"]) arr(cl.sections && cl.sections[k]).forEach((r, i) => out.push([`/clauses/sections/${k}/${i}`, r]));
      // Review round 2: the chart-register red-flag phrases, by flag id.
      for (const [k, list] of Object.entries(cl.redFlags || {})) arr(list).forEach((r, i) => out.push([`/clauses/redFlags/${k}/${i}`, r]));
      return out;
    };
    const cl = lexicon.clauses || {};
    const rows = rowsOf(cl);
    check(D3.release === "0.4.7" && D3.request && D3.request.date === "2026-10-11" && D3.request.by === "clinical lead"
        && req.includes("Make the patient capture statement a large textbook that is scrollable.") && req.includes("\"is the rhinorrhea clear or purulent?\"")
        && ["redFlags", "answers", "wording"].every((k) => dec[k] && dec[k].date === "2026-10-11" && typeof dec[k].question === "string" && typeof dec[k].answer === "string")
        && dec.redFlags.answer === "Don't raise, no listing" && dec.answers.answer === "Clickable answers (Recommended)" && dec.wording.answer === "Draft, you sign off (Recommended)"
        && !!D3.signOff && D3.signOff.date === "2026-10-12" && D3.signOff.by === "clinical lead",
      "lexicon delta 033: the lead's request and three answers of 2026-10-11 recorded (release 0.4.7); signed off by the clinical lead on 2026-10-12");
    const soProblems = lexicon033SignOffProblems(D3, lexicon);
    const so = D3.signOff || {};
    check(soProblems.length === 0,
      `lexicon delta 033: the sign-off record of 2026-10-12 is complete and applied (${so.totals ? `${so.totals.approved} approved, ${so.totals.struck} struck, ${so.totals.leadOwnWords} the lead's own words of ${so.totals.rows} rows` : "no totals"}; ${(so.partD || []).length} Part D answers and the D8 follow-up answers among their options): no plain draft left, every struck row absent, every approved row lead-approved, the sign-off's added rows and removed qualifiers in place${soProblems.length ? ` — ${soProblems.join("; ")}` : ""}`);
    // The lead's own words: exactly the endorsement and denial verbs the request names (has and no
    // with their boundary space), and the rhinorrhea question verbatim; every other row lead-approved.
    const LEAD_AFFIRM = ["endorses", "reports", "has ", "yes"], LEAD_DENY = ["denies", "no ", "lacks", "doesn't have"];
    const leadRows = rows.filter(([, r]) => r.source === "lead").map(([p, r]) => `${p.split("/")[2]}:${r.ph}`);
    check(deepEqual(leadRows, [...LEAD_AFFIRM.map((w) => `affirm:${w}`), ...LEAD_DENY.map((w) => `deny:${w}`)])
        && [...LEAD_AFFIRM, ...LEAD_DENY].every((w) => req.includes(w.trim()))
        && rows.every(([, r]) => r.source === "lead" || r.source === "lead-approved"),
      `lexicon delta 033: the lead-sourced clauses rows are exactly the verbs the request names (affirm ${LEAD_AFFIRM.join(", ")}; deny ${LEAD_DENY.join(", ")}), every other row lead-approved (${rows.length} rows)`);
    const clar = arr(lexicon.clarify);
    const rhin = clar.filter((e) => e.ask && e.ask.source === "lead");
    check(rhin.length === 1 && rhin[0].ask.text === "is the rhinorrhea clear or purulent?" && req.includes(`"${rhin[0].ask.text}"`) && rhin[0].source === "lead"
        && clar.every((e) => e === rhin[0] || (e.source === "lead-approved" && e.ask === undefined)),
      "lexicon delta 033: the one lead-sourced clarify entry asks the lead's question verbatim, never re-cased; every other entry is lead-approved and asks the module's own question");
    const logicNs3 = await env.loader.importModule(new URL("modules/masque/masque.logic.js", env.appBase).href);
    const probes3 = ((logicNs3.default || {}).probes || {}).list || [];
    const probeIds = new Set(probes3.map((p) => p.id));
    const itemIds = new Set(allIds);
    const strayClar = clar.filter((e) => (e.probe !== undefined) === (e.item !== undefined) || (e.probe !== undefined && !probeIds.has(e.probe)) || (e.item !== undefined && !itemIds.has(e.item)));
    // The review fixes of release 0.4.7: chartIgnoreThirdParty names only the lexicon's own attribution
    // cues, and strictConflict is exactly the yes/no entries of the negative (rule-out) domains.
    const tpCues = arr(lexicon.thirdParty && lexicon.thirdParty.cues);
    const ruleOut = domains.filter((d) => d.negative === true).flatMap((d) => d.items.map((i) => i.id)).filter((id) => arr(lexicon.bool).some((e) => e.id === id));
    const ignoreOk = arr(cl.chartIgnoreThirdParty).length > 0 && arr(cl.chartIgnoreThirdParty).every((r) => tpCues.includes(r.ph));
    const flagIdSet = new Set(redFlags.map((f) => f.id));
    const strayFlags = Object.keys(cl.redFlags || {}).filter((k) => !flagIdSet.has(k));
    check(clar.length > 0 && !strayClar.length && arr(cl.examItems).every((id) => itemIds.has(id)) && cl.redFlagNegation === true && cl.wordStart === true
        && ignoreOk && deepEqual(arr(cl.strictConflict), ruleOut) && !strayFlags.length && Object.keys(cl.redFlags || {}).length === flagIdSet.size,
      `lexicon delta 033: every clarify entry names exactly one probe of the logic or item (${clar.length} entries), every examItems id is an item, redFlagNegation (the lead's decision) and wordStart are on; every chartIgnoreThirdParty cue is a thirdParty cue of the lexicon, and strictConflict is exactly the yes/no entries of the negative domains (${ruleOut.join(", ")}); clauses.redFlags (review round 2) names every red flag of the module and nothing else${strayFlags.length ? ` — stray flags: ${strayFlags.join(", ")}` : ""}${strayClar.length ? ` — stray: ${strayClar.map((e) => e.id).join(", ")}` : ""}`);
    // examItems is empty since review round 2: its one basis is the switch's.
    const examEntries = arr(cl.examItems).length ? arr(cl.examItems).map((_, i) => `/clauses/examItems/${i}`) : ["/clauses/examItems"];
    const entries = [...rows.map(([p]) => p), "/clauses/wordStart", "/clauses/placeholderAsk", ...examEntries,
      ...arr(cl.strictConflict).map((_, i) => `/clauses/strictConflict/${i}`),
      "/clauses/redFlagNegation", ...clar.map((_, i) => `/clarify/${i}`),
      // The appended negation cues (review round 1: each has its basis too), at their 0.3.3 indices.
      ...arr(D3.appended).flatMap((row) => arr(row.phrases).map((ph) => `${row.path}/${arr(lexicon.negation && lexicon.negation.cues).indexOf(ph)}`))];
    const basis = D3.basis || {};
    const noBasis = entries.filter((p) => typeof basis[p] !== "string" || !basis[p].trim());
    const strayBasis = Object.keys(basis).filter((p) => !entries.includes(p));
    // A lead row's basis cites the lead; a row the team drafted keeps its drafting record ("Draft …"),
    // the lead's approval being the row's source and the sign-off record.
    const badTag = rows.filter(([p, r]) => !String(basis[p] || "").startsWith(r.source === "lead" ? "The clinical lead" : "Draft"));
    check(!noBasis.length && !strayBasis.length && !badTag.length && basis["/clauses/redFlagNegation"].startsWith("The clinical lead's decision of 2026-10-11"),
      `lexicon delta 033: one basis per clauses row, switch, clarify entry and appended negation cue (${entries.length}); a lead row's basis cites the lead, a lead-approved row's keeps its drafting record (Draft …)${noBasis.length ? ` — missing: ${noBasis.join(", ")}` : ""}${strayBasis.length ? ` — stray: ${strayBasis.join(", ")}` : ""}${badTag.length ? ` — tag: ${badTag.map(([p]) => p).join(", ")}` : ""}`);
    check(arr(D3.appended).length === 1 && D3.appended[0].path === "/negation/cues" && D3.appended[0].source === "lead-approved",
      "lexicon delta 033: the one appended row (negation cues) is lead-approved");
  }
  const gold040Res = await fetch(new URL("tests/fixtures/goldset/" + lexicon.goldSet.file, env.appBase).href, { cache: "no-cache" });
  if (!gold040Res.ok) fail(`gold set ${lexicon.goldSet.file}: HTTP ${gold040Res.status}`);
  const gold040 = await gold040Res.json();
  const inc = gold040 && gold040._meta ? gold040._meta.includes || {} : {};
  check(gold040 && gold040._meta && gold040._meta.version === lexicon.goldSet.version && gold040._meta.lexiconVersion === lexicon.goldSet.lexiconVersion
    && gold040._meta.basedOn && gold040._meta.basedOn.sha256 === goldPin && gold040._meta.basedOn.cases === gold.cases.length
    && inc.version === lexicon032.goldSet.version && inc.sha256 === (await sha256Hex(gold030Bytes)) && inc.cases === gold030.cases.length && inc.dialogues === gold030.dialogues.length,
    `gold set ${lexicon.goldSet.version} (tests/fixtures/goldset): _meta version and lexiconVersion equal lexicon.goldSet; basedOn pins the reference ${gold._meta.version} file and its ${gold.cases.length} cases; includes pins gold set ${lexicon032.goldSet.version} (its SHA-256, ${gold030.cases.length} cases, ${gold030.dialogues.length} dialogues)`);
  src("/lexicon", "Ext", [24, 166], `LEXICON_VERSION L24, NEGATION, THIRD_PARTY, HISTORICAL, BOOL_EX, CTX_EX, SCALE_EX, MULTI_EX, RF_PHRASES (keys renamed only); lang = Voice L47 VOICE_LANG; goldSet.version = reference/MASQUE_v0.3.1/masque_extraction_goldset.json _meta.version + tests/harness/lexicon-delta.js (clinical-lead approval ${LEXICON_DELTA.approved.date}) + tests/harness/lexicon-delta-033.js (release ${LEXICON_DELTA_033.release}: clauses, clarify, negation cues; the lead's request and decisions of ${LEXICON_DELTA_033.request.date}; signed off by the clinical lead on ${LEXICON_DELTA_033.signOff ? LEXICON_DELTA_033.signOff.date : "(not signed off)"})`);

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

  // The Spanish completion of release 0.4.2 (tests/harness/locale-delta.js). applyLocaleDelta throws
  // on any precondition failure (a path that already exists, a missing `after` sibling, the English
  // key order left).
  const pointerAt = (root, ptr) => ptr.slice(1).split("/").reduce((v, k) => (v !== null && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, k) ? v[k] : undefined), root);
  const clinOf = Object.fromEntries(domains.flatMap((d) => d.items.map((it) => [it.id, it.patientClin])));
  const esBase = `/locales/${LOCALE_DELTA.locale}`;
  check(LOCALE_DELTA.locale === "es" && LOCALE_DELTA.translated && LOCALE_DELTA.translated.reviewed === false && locales.es.reviewed === false,
    "locale delta: Spanish, an unreviewed translation, applied to a locale that stays reviewed: false");
  const enMismatch = LOCALE_DELTA.added.filter((row) => {
    const rel = String(row.path).slice(esBase.length);
    const m = /^\/items\/([^/]+)\/clin$/.exec(rel);
    return !deepEqual(row.en, m ? clinOf[m[1]] : pointerAt(locales.en, rel));
  }).map((row) => row.path);
  check(enMismatch.length === 0, `locale delta: every added row's \`en\` equals the English at the same path in locales.en (an item's clin: the item's patientClin)${enMismatch.length ? ` — differs: ${enMismatch.join(", ")}` : ""}`);
  const es0 = locales.es;
  locales.es = applyLocaleDelta(es0, LOCALE_DELTA);
  check(deepEqual(revertLocaleDelta(locales.es, LOCALE_DELTA), es0),
    `locale delta: ${LOCALE_DELTA.added.length} rows added to locales.es, and revertLocaleDelta gives back the baseline locales.es exactly (key order included)`);
  const enCtx = locales.en.contextItems, esCtx = locales.es.contextItems || {};
  check(deepEqual(Object.keys(esCtx), Object.keys(enCtx)) && Object.keys(enCtx).every((id) => deepEqual(esCtx[id].opts.map(([v]) => v), enCtx[id].opts.map(([v]) => v))),
    "locale delta: es context items and their option values equal the English ones, in order (the gap-rule signal values drive the summary)");
  check(locales.es.contextItems && Object.keys(locales.en.items).every((id) => typeof locales.es.items[id].clin === "string" && locales.es.items[id].clin),
    "locale delta: every item has a Spanish clinician line (clin)");
  const chromeBad = (LOCALE_DELTA.chrome || []).filter((row) => PATIENT_CHROME.en[row.key] !== row.en || typeof PATIENT_CHROME.es[row.key] !== "string").map((row) => row.key);
  check((LOCALE_DELTA.chrome || []).length > 0 && chromeBad.length === 0,
    `locale delta: every chrome row names a PATIENT_CHROME key whose English equals the row's en and which PATIENT_CHROME.es carries${chromeBad.length ? ` — not: ${chromeBad.join(", ")}` : ""}`);
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
  const deltaHow = `LOCALE_DELTA.added (release ${LOCALE_DELTA.release}; unreviewed team translation, ${LOCALE_DELTA.translated.date}; applied with applyLocaleDelta, proven by revertLocaleDelta)`;
  src("/locales/es/contextItems", "—", "tests/harness/locale-delta.js", `${deltaHow}; option values = /locales/en/contextItems, in order`);
  src("/locales/es/steps/story/{heading,lede,intro}", "—", "tests/harness/locale-delta.js", deltaHow);
  src("/locales/es/ui/{forYouIf,clinicianLede}", "—", "tests/harness/locale-delta.js", deltaHow);
  src("/locales/es/items/*/clin", "—", "tests/harness/locale-delta.js", `${deltaHow}; the English source is /domains[]/items[]/patientClin`);

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
  const rubric0 = {
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
    changelog: [
      ...CHANGELOG_NOTES.map((c) => ({ date: HAND.changelogDate, kind: c.kind, note: c.note, paths: c.paths })),
      // the approved lexicon change, after the 2026-10-02 notes (design 05 §6.3)
      { date: LEXICON_DELTA.changelog.date, kind: LEXICON_DELTA.changelog.kind, note: LEXICON_DELTA.changelog.note, paths: plain(LEXICON_DELTA.changelog.paths) },
      // the Spanish completion of release 0.4.2, after the lexicon entry
      { date: LOCALE_DELTA.changelog.date, kind: LOCALE_DELTA.changelog.kind, note: LOCALE_DELTA.changelog.note, paths: plain(LOCALE_DELTA.changelog.paths) },
      // the EMR template data of release 0.4.3, after the translation entry
      { date: EMR_DELTA.changelog.date, kind: EMR_DELTA.changelog.kind, note: EMR_DELTA.changelog.note, paths: plain(EMR_DELTA.changelog.paths) },
      // the clinical-lead sign-off of that data (release 0.4.4), right after it
      ...(EMR_DELTA.signOffChangelog ? [{ date: EMR_DELTA.signOffChangelog.date, kind: EMR_DELTA.signOffChangelog.kind, note: EMR_DELTA.signOffChangelog.note, paths: plain(EMR_DELTA.signOffChangelog.paths) }] : []),
      // the clinical-lead referral rule for dizziness cases (release 0.4.5)
      { date: REFERRAL_DELTA.changelog.date, kind: REFERRAL_DELTA.changelog.kind, note: REFERRAL_DELTA.changelog.note, paths: plain(REFERRAL_DELTA.changelog.paths) },
      // the clinical lead's answers on the EMR template's open items (release 0.4.6)
      { date: EMR_DECISIONS_DELTA.changelog.date, kind: EMR_DECISIONS_DELTA.changelog.kind, note: EMR_DECISIONS_DELTA.changelog.note, paths: plain(EMR_DECISIONS_DELTA.changelog.paths) },
      // the lexicon change 0.3.2 → 0.3.3 (release 0.4.7: chart text and clarification)
      { date: LEXICON_DELTA_033.changelog.date, kind: LEXICON_DELTA_033.changelog.kind, note: LEXICON_DELTA_033.changelog.note, paths: plain(LEXICON_DELTA_033.changelog.paths) },
      // the clinical lead's question for item r_dur (release 0.4.8)
      { date: QUESTION_DELTA.changelog.date, kind: QUESTION_DELTA.changelog.kind, note: QUESTION_DELTA.changelog.note, paths: plain(QUESTION_DELTA.changelog.paths) },
      // the clinical lead's plan line for the EMR template (release 0.4.8, follow-up), last
      { date: EMR_PLAN_DELTA.changelog.date, kind: EMR_PLAN_DELTA.changelog.kind, note: EMR_PLAN_DELTA.changelog.note, paths: plain(EMR_PLAN_DELTA.changelog.paths) },
    ],
  };

  // The EMR template data of release 0.4.3 (tests/harness/emr-delta.js). applyEmrDelta throws when
  // the key already exists or `before` is missing; revertEmrDelta proves the insertion exact.
  const emrKey = EMR_DELTA.path.slice(1);
  // Release 0.4.4: reviewed is true only together with a complete clinical-lead signOff record
  // (by, date, scope, channel; the date a real calendar date); a delta that is not reviewed carries
  // no signOff. The completeness test is applyEmrDelta's own (emrSignOffComplete, diff.js).
  const emrReviewed = EMR_DELTA.drafted ? EMR_DELTA.drafted.reviewed : undefined;
  const so = EMR_DELTA.signOff;
  const signOffComplete = emrSignOffComplete(so);
  check(emrKey === "emrTemplate" && EMR_DELTA.before === "changelog" && !!EMR_DELTA.drafted
      && (emrReviewed === true ? signOffComplete : emrReviewed === false && so === undefined),
    `emr delta: the emrTemplate key, inserted before changelog; drafted, and reviewed: true only together with a complete clinical-lead signOff record (by, date, scope, channel)${emrReviewed === true && signOffComplete ? ` — signed off by the ${so.by} on ${so.date}` : ""}`);
  {
    // The sign-off entry: present exactly when the delta is signed off, kind sign-off, dated as the
    // signOff, naming /emrTemplate, right after the emr-template one, and followed only by the
    // release 0.4.5 referral entry, the release 0.4.6 emr-decisions entry, the release 0.4.7
    // lexicon entry and the release 0.4.8 question and emr-plan entries (whose places the referral,
    // decisions, lexicon, question and plan checks assert).
    const soLog = EMR_DELTA.signOffChangelog;
    const beforeReferral = rubric0.changelog.slice(0, -5);
    const last2 = beforeReferral.slice(-2).map((e) => e.kind);
    check(rubric0.changelog[rubric0.changelog.length - 5].kind === REFERRAL_DELTA.changelog.kind
      && rubric0.changelog[rubric0.changelog.length - 4].kind === EMR_DECISIONS_DELTA.changelog.kind
      && rubric0.changelog[rubric0.changelog.length - 3].kind === LEXICON_DELTA_033.changelog.kind
      && rubric0.changelog[rubric0.changelog.length - 2].kind === QUESTION_DELTA.changelog.kind
      && rubric0.changelog[rubric0.changelog.length - 1].kind === EMR_PLAN_DELTA.changelog.kind && (emrReviewed === true
        ? !!soLog && !!so && soLog.kind === "sign-off" && soLog.date === so.date && typeof soLog.note === "string" && soLog.note.includes(so.date)
          && deepEqual(plain(soLog.paths), [EMR_DELTA.path]) && deepEqual(last2, [EMR_DELTA.changelog.kind, "sign-off"])
        : soLog === undefined && beforeReferral[beforeReferral.length - 1].kind === EMR_DELTA.changelog.kind),
      "emr delta: the sign-off change-log entry (kind sign-off, dated as the signOff, paths [/emrTemplate]) is present exactly when the delta is signed off, right after the emr-template entry and followed only by the release 0.4.5 referral entry, the release 0.4.6 emr-decisions entry, the release 0.4.7 lexicon entry and the release 0.4.8 question and emr-plan entries");
  }
  const rubricEmr = applyEmrDelta(rubric0, EMR_DELTA);
  check(deepEqual(revertEmrDelta(rubricEmr, EMR_DELTA), rubric0) && deepEqual(Object.keys(rubricEmr).filter((k) => k !== emrKey), Object.keys(rubric0)),
    "emr delta: emrTemplate inserted before changelog, and revertEmrDelta gives back the rubric without it exactly (key order included)");
  {
    const emr = rubricEmr.emrTemplate;
    const cites = emr.citations || {};
    const citeKeys = Object.keys(cites);
    const usedKeys = new Set();
    const badKeys = [];
    const useKeys = (keys, where) => {
      if (!Array.isArray(keys)) { badKeys.push(`${where} (not a list)`); return; }
      for (const k of keys) { if (cites[k]) usedKeys.add(k); else badKeys.push(`${where}: ${k}`); }
    };
    const flagIdSet = new Set(redFlags.map((f) => f.id));
    const itemById = Object.fromEntries(domains.flatMap((d) => d.items.map((it) => [it.id, it])));
    const phenoValues = new Set(phenotypes.values.map((v) => v.value));
    const logicNs = await env.loader.importModule(new URL("modules/masque/masque.logic.js", env.appBase).href);
    const probeById = Object.fromEntries(((logicNs.default && logicNs.default.probes && logicNs.default.probes.list) || []).map((p) => [p.id, p]));
    const bad = [];
    const showForOk = (sf, where) => {
      if (sf === undefined) return;
      if (!sf || !Array.isArray(sf.phenotypes) || !sf.phenotypes.length || sf.phenotypes.some((v) => !phenoValues.has(v))) bad.push(`${where}/showFor`);
    };
    (emr.references || []).forEach((r, i) => { useKeys(r.citations, `/references/${i}`); showForOk(r.showFor, `/references/${i}`); });
    for (const [fid, keys] of Object.entries(emr.redFlagRefs || {})) {
      if (!flagIdSet.has(fid)) bad.push(`/redFlagRefs/${fid} (no such flag)`);
      useKeys(keys, `/redFlagRefs/${fid}`);
    }
    for (const [fid, text] of Object.entries(emr.redFlagPlaceholders || {})) {
      if (!flagIdSet.has(fid) || typeof text !== "string" || !text.trim()) bad.push(`/redFlagPlaceholders/${fid}`);
    }
    const routingById = Object.fromEntries(((logicNs.default && logicNs.default.routing) || []).map((x) => [x.id, x]));
    (emr.instrumentRecs || []).forEach((id, i) => {
      const rule = routingById[id];
      if (!rule) bad.push(`/instrumentRecs/${i} (no routing rule ${id})`);
      // review round 2: a listed rule's chips are fixed string lists on every surface (never computed)
      else if (Object.values(rule.copy || {}).some((cp) => cp && cp.chips !== undefined && !(Array.isArray(cp.chips) && cp.chips.every((ch) => typeof ch === "string")))) bad.push(`/instrumentRecs/${i} (rule ${id} computes its chips)`);
    });
    (emr.history || []).forEach((r, i) => {
      if (r.item !== undefined && !itemById[r.item]) bad.push(`/history/${i} (no item ${r.item})`);
      if (r.probe !== undefined && (r.item !== undefined || !probeById[r.probe])) bad.push(`/history/${i} (probe ${r.probe})`);
      // review round 2: history rows carry no citations (never printed); a qualifier only on an item row
      if (r.citations !== undefined) bad.push(`/history/${i} (citations on a history row)`);
      if (r.qualifier !== undefined && (r.item === undefined || typeof r.qualifier !== "string" || !r.qualifier.trim())) bad.push(`/history/${i} (qualifier)`);
    });
    (emr.checklist || []).forEach((r, i) => {
      useKeys(r.citations, `/checklist/${i}`);
      if (r.onlyWithSignal !== undefined && (typeof r.onlyWithSignal !== "boolean" || !(r.signals || []).length)) bad.push(`/checklist/${i} (onlyWithSignal)`);
      (r.signals || []).forEach((s, j) => {
        const at = `/checklist/${i}/signals/${j}`;
        if (s.item !== undefined) {
          const it = itemById[s.item];
          if (!it) bad.push(`${at} (no item ${s.item})`);
          else if (Array.isArray(it.scale) ? !(Number.isInteger(s.value) && s.value >= 0 && s.value < it.scale.length) : !["yes", "no"].includes(s.value)) bad.push(`${at} (value)`);
          else {
            // review round 2: the render matches the answer's polarity (done / note positive,
            // answeredNo negative); never tried comes from a probe only
            const neg = s.value === "no" || (Array.isArray(it.scale) && it.scale[s.value].f === 0);
            if (s.render === "neverTried" || ((s.render === "done" || s.render === "note") && neg) || (s.render === "answeredNo" && !neg)) bad.push(`${at} (render ${s.render} against the answer's polarity)`);
          }
        } else {
          const p = probeById[s.probe];
          if (!p) bad.push(`${at} (no probe ${s.probe})`);
          else if (!(Number.isInteger(s.option) && s.option >= 0 && s.option < p.opts.length)) bad.push(`${at} (option)`);
        }
      });
    });
    (emr.examRows || []).forEach((r, i) => {
      if (r.citations !== undefined) useKeys(r.citations, `/examRows/${i}`);
      if (r.probe !== undefined && !(probeById[r.probe] && probeById[r.probe].kind === "exam")) bad.push(`/examRows/${i} (no exam probe ${r.probe})`);
    });
    check(badKeys.length === 0, `emr delta: every citation key it names is in emrTemplate.citations${badKeys.length ? ` — not: ${badKeys.join(", ")}` : ""}`);
    const unused = citeKeys.filter((k) => !usedKeys.has(k));
    check(unused.length === 0, `emr delta: every one of its ${citeKeys.length} citations is used${unused.length ? ` — unused: ${unused.join(", ")}` : ""}`);
    check(bad.length === 0, `emr delta: every red flag, item, probe and routing rule (masque.logic.js; exam rows name exam probes, instrument recs fixed chips), answer value (with a render of its polarity), probe option and phenotype it names exists, and history rows carry no citations${bad.length ? ` — not: ${bad.join(", ")}` : ""}`);
    check(citeKeys.every((k) => /^https:\/\/[^\s[\]{}]+$/.test(cites[k].url) && /^\d{4}-\d{2}-\d{2}$/.test(cites[k].accessed)
      && ["title", "publisher", "citation"].every((f) => typeof cites[k][f] === "string" && cites[k][f].trim())),
      "emr delta: every citation has a title, publisher and citation, an https url and an accessed date");
    const strings = [];
    const walkS = (x) => { if (typeof x === "string") strings.push(x); else if (Array.isArray(x)) x.forEach(walkS); else if (x && typeof x === "object") Object.values(x).forEach(walkS); };
    walkS(emr);
    check(strings.every((s) => !/[[\]{}]/.test(s)), "emr delta: no string carries [ ] { } (placeholders are the engine's)");
    const entries = [
      ...citeKeys.map((k) => `/citations/${k}`),
      ...(emr.references || []).map((_, i) => `/references/${i}`),
      ...(emr.instrumentRecs ? ["/instrumentRecs"] : []),
      ...Object.keys(emr.redFlagRefs || {}).map((k) => `/redFlagRefs/${k}`),
      ...Object.keys(emr.redFlagPlaceholders || {}).map((k) => `/redFlagPlaceholders/${k}`),
      ...(emr.history || []).map((_, i) => `/history/${i}`),
      ...(emr.checklist || []).map((_, i) => `/checklist/${i}`),
      ...(emr.examRows || []).map((_, i) => `/examRows/${i}`),
    ];
    const noBasis = entries.filter((p) => typeof EMR_DELTA.basis[p] !== "string" || !EMR_DELTA.basis[p]);
    const strayBasis = Object.keys(EMR_DELTA.basis).filter((p) => !entries.includes(p));
    check(noBasis.length === 0 && strayBasis.length === 0,
      `emr delta: one basis per entry (${entries.length})${noBasis.length ? ` — missing: ${noBasis.join(", ")}` : ""}${strayBasis.length ? ` — stray: ${strayBasis.join(", ")}` : ""}`);
  }
  src("/emrTemplate", "—", "tests/harness/emr-delta.js", `EMR_DELTA.value (release ${EMR_DELTA.release}; drafted by AI agents from verified sources, ${EMR_DELTA.drafted.date}; ${emrReviewed === true && signOffComplete ? `signed off by the ${so.by} on ${so.date} (${so.channel}), recorded in release 0.4.4` : "not reviewed by the clinical lead"}; inserted before /changelog with applyEmrDelta, proven by revertEmrDelta; one basis per entry in EMR_DELTA.basis)`);

  // The clinical-lead referral rule for dizziness cases (release 0.4.5; tests/harness/referral-delta.js).
  // applyReferralDelta throws when a changed value is not its `from` (the baseline-extracted value)
  // or an added key already exists; revertReferralDelta proves the change exact.
  const RD = REFERRAL_DELTA;
  const rubricRef = applyReferralDelta(rubricEmr, RD);
  const RULES_KEY = "clinicianRules";
  const addedRows = RD.added.map((row) => /^\/phenotypes\/referral\/byPhenotype\/([^/]+)$/.exec(row.path)).filter(Boolean).map((m) => m[1]);
  check(deepEqual(revertReferralDelta(rubricRef, RD), rubricEmr) && deepEqual(Object.keys(rubricRef), Object.keys(rubricEmr))
      && deepEqual(Object.keys(rubricRef.phenotypes), Object.keys(rubricEmr.phenotypes))
      && deepEqual(Object.keys(rubricRef.phenotypes.referral), [...Object.keys(rubricEmr.phenotypes.referral), RULES_KEY])
      && deepEqual(Object.keys(rubricRef.phenotypes.referral.byPhenotype), [...Object.keys(rubricEmr.phenotypes.referral.byPhenotype), ...addedRows]),
    `referral delta: ${RD.changed.length} destination changed from its baseline value, ${addedRows.length} byPhenotype row added last in byPhenotype and phenotypes.referral.${RULES_KEY} added last, and revertReferralDelta gives back the rubric without them exactly (key order included)`);
  {
    const ref = rubricRef.phenotypes.referral;
    const rulesList = Array.isArray(ref[RULES_KEY]) ? ref[RULES_KEY] : [];
    const dec = RD.decided || {};
    const q = RD.quotes || {};
    const dates = Array.isArray(dec.dates) ? dec.dates : [];
    const quoteDates = Object.values(q).map((x) => (x && typeof x === "object" ? x.date : undefined));
    check(RD.release === "0.4.5" && dec.by === "clinical lead" && dec.channel === "chat" && dates.length > 0
        && dates.every((d, i) => emrSignOffComplete({ by: dec.by, scope: "referral rule", channel: dec.channel, date: d }) && (i === 0 || dates[i - 1] < d))
        && quoteDates.length > 0 && quoteDates.every((d) => dates.includes(d)) && dates.every((d) => quoteDates.includes(d)),
      `referral delta: release 0.4.5, decided by the clinical lead in chat on real calendar dates in order (${dates.join(", ")}), each the date of a quote and every quote dated with one of them`);
    // The lead's amendments of the definition (2026-10-10): each row names a definition line of an
    // added clinician rule and the text removed from the lead's line at the same index.
    const amendments = Array.isArray(RD.amendments) ? RD.amendments : [];
    const AMEND_PATH = new RegExp(`^/phenotypes/referral/${RULES_KEY}/(\\d+)/definition/(\\d+)$`);
    const amendRows = amendments.map((a) => ({ a, m: a && typeof a === "object" && typeof a.path === "string" ? AMEND_PATH.exec(a.path) : null }));
    const amendsOf = (i) => amendRows.filter(({ m }) => m && Number(m[1]) === i);
    /** The lead's definition (quotes.definition) with the amendments of rule i applied, or null when one does not apply as a single removal. */
    const amendedDefinition = (i) => {
      if (!q.definition || !Array.isArray(q.definition.text)) return null;
      const out = [...q.definition.text];
      for (const { a, m } of amendsOf(i)) {
        const j = Number(m[2]);
        if (typeof out[j] !== "string" || typeof a.removed !== "string" || !a.removed || out[j].split(a.removed).length !== 2) return null;
        out[j] = out[j].replace(a.removed, "");
      }
      return out;
    };
    const amendDates = (i) => [...new Set(amendsOf(i).map(({ a }) => (q[a.quote] && typeof q[a.quote] === "object" ? q[a.quote].date : undefined)))];
    // The lead's words: the rule is the lead's sentence without its opening reply word, the
    // clarification is the lead's, line for line, and the definition is the lead's line for line
    // with only the lead's amendments applied; each source names its date, and the rule's source
    // also the date of each amendment of its definition.
    check(rulesList.length > 0 && rulesList.every((e, i) => typeof e.rule === "string" && e.rule && !!q.referral && q.referral.text === `Yes, ${e.rule}`
        && !!q.definition && deepEqual(e.definition, amendedDefinition(i)) && !!q.clarification && deepEqual(e.clarification, [q.clarification.text])
        && e.source === `${dec.by}, ${q.referral.date}${amendDates(i).length ? `; definition amended ${amendDates(i).join(", ")}` : ""}`
        && q.definition.date === q.referral.date && e.clarificationSource === `${dec.by}, ${q.clarification.date}`),
      "referral delta: each clinician rule's rule is the lead's sentence (quotes.referral) without its opening reply word \"Yes, \", its clarification the lead's words verbatim (quotes.clarification), its definition the lead's (quotes.definition) line for line with only the lead's amendments applied, and its source and clarificationSource the lead and the date of each (the source also the date of each amendment of the definition)");
    // Each amendment removes exactly one occurrence of its text from the lead's definition line and
    // nothing else, rests on a later dated decision of the lead that names every word it removes,
    // and leaves none of those words in the printed line.
    const wordsOf = (s) => String(s).toLowerCase().match(/[a-zÀ-ɏ]+/g) || [];
    check(new Set(amendments.map((a) => a && a.path)).size === amendments.length && amendRows.every(({ a, m }) => {
      if (!m || typeof a.removed !== "string" || !wordsOf(a.removed).length || !q.definition || !Array.isArray(q.definition.text)) return false;
      const e = rulesList[Number(m[1])];
      const j = Number(m[2]);
      const lead = q.definition.text[j];
      const quote = q[a.quote];
      if (!e || !Array.isArray(e.definition) || typeof lead !== "string" || lead.split(a.removed).length !== 2 || e.definition[j] !== lead.replace(a.removed, "")) return false;
      if (!quote || typeof quote !== "object" || !dates.includes(quote.date) || !(quote.date > q.definition.date)) return false;
      const said = new Set(wordsOf([].concat(quote.text).join(" ")));
      const printed = new Set(wordsOf(e.definition[j]));
      return wordsOf(a.removed).every((w) => said.has(w) && !printed.has(w));
    }),
      `referral delta: each amendment of the definition (${amendments.map((a) => `${a && a.path}: ${JSON.stringify(a && a.removed)} removed`).join("; ")}) removes exactly one occurrence of its text from the lead's line (quotes.definition) and nothing else, rests on a later dated decision of the lead (quotes.${amendments.map((a) => a && a.quote).join(", quotes.")}) that names every word it removes, and leaves none of those words in the printed line`);
    // destinations is exactly the set of referral destinations that differ from the baseline: for
    // every phenotype value (and the default) the shipped specialty differs from the
    // baseline-extracted one exactly when destinations has its row (from → to), and no reason moves.
    const base = rubricEmr.phenotypes.referral;
    const destOf = (r, v) => (v && r.byPhenotype && Object.prototype.hasOwnProperty.call(r.byPhenotype, v) ? r.byPhenotype[v] : r.default);
    const moved = [];
    let reasonsKept = true;
    for (const v of [...phenotypes.values.map((x) => x.value), ""]) {
      const a = destOf(base, v), b = destOf(ref, v);
      if (!a || !b || a.reason !== b.reason) reasonsKept = false;
      else if (a.specialty !== b.specialty) moved.push({ phenotype: v, reason: b.reason, from: a.specialty, to: b.specialty });
    }
    check(reasonsKept && deepEqual(moved, RD.destinations),
      `referral delta: destinations is exactly the referral destinations that differ from the baseline (${moved.map((m) => `${m.phenotype || "(default)"}: ${m.from} → ${m.to}`).join("; ")}), and no reason changes`);
    // The clinician rule prints for exactly the phenotypes whose destination the lead's rule moved
    // (the dizziness cases), each a phenotype value.
    const phenoValues = new Set(phenotypes.values.map((v) => v.value));
    check(rulesList.every((e) => Array.isArray(e.phenotypes) && e.phenotypes.length > 0 && e.phenotypes.every((v) => phenoValues.has(v))
        && deepEqual([...e.phenotypes].sort(), RD.destinations.map((d) => d.phenotype).sort())),
      "referral delta: every phenotype a clinician rule names exists, and the rule names exactly the phenotypes of destinations (the dizziness cases)");
    // No automatic escalation: the referral table holds only its destinations and the clinician
    // rules, and a clinician rule carries only display fields (no probe, option or destination).
    const RULE_FIELDS = ["phenotypes", "source", "rule", "definition", "clarificationSource", "clarification", "confirm"];
    check(deepEqual(Object.keys(ref), ["byPhenotype", "default", RULES_KEY]) && rulesList.every((e) => Object.keys(e).every((k) => RULE_FIELDS.includes(k))),
      `referral delta: no escalation: phenotypes.referral is {byPhenotype, default, ${RULES_KEY}} and a clinician rule has only the fields ${RULE_FIELDS.join(", ")}`);
    const strings = [];
    const walkS = (x) => { if (typeof x === "string") strings.push(x); else if (Array.isArray(x)) x.forEach(walkS); else if (x && typeof x === "object") Object.values(x).forEach(walkS); };
    walkS(rulesList);
    check(strings.length > 0 && strings.every((s) => s.trim() && !/[[\]{}]/.test(s)), "referral delta: every clinician-rule string is non-empty and carries no [ ] { } (placeholders are the engine's)");
    const entries = [...RD.changed.map((row) => row.path), ...RD.added.filter((row) => row.path !== `/phenotypes/referral/${RULES_KEY}`).map((row) => row.path),
      ...rulesList.flatMap((e, i) => Object.keys(e).map((k) => `/phenotypes/referral/${RULES_KEY}/${i}/${k}`))];
    const noBasis = entries.filter((p) => typeof RD.basis[p] !== "string" || !RD.basis[p].trim());
    const strayBasis = Object.keys(RD.basis).filter((p) => !entries.includes(p));
    check(noBasis.length === 0 && strayBasis.length === 0,
      `referral delta: one basis per changed destination, per added byPhenotype row and per field of each clinician rule (${entries.length})${noBasis.length ? ` — missing: ${noBasis.join(", ")}` : ""}${strayBasis.length ? ` — stray: ${strayBasis.join(", ")}` : ""}`);
    const log = rubricRef.changelog;
    const rl = log[log.length - 5];
    check(rl.kind === "referral" && rl.date === dates[dates.length - 1] && deepEqual(rl.paths, [...RD.changed.map((row) => row.path), ...RD.added.map((row) => row.path)])
        && log[log.length - 6].kind === "sign-off" && log[log.length - 4].kind === EMR_DECISIONS_DELTA.changelog.kind && log[log.length - 3].kind === LEXICON_DELTA_033.changelog.kind
        && log[log.length - 2].kind === QUESTION_DELTA.changelog.kind && log[log.length - 1].kind === EMR_PLAN_DELTA.changelog.kind,
      "referral delta: its change-log entry (kind referral, dated as the last decision, paths = the changed and added paths) comes right after the 0.4.4 sign-off entry and is followed only by the 0.4.6 emr-decisions entry, the 0.4.7 lexicon entry and the 0.4.8 question and emr-plan entries");
  }
  src("/phenotypes/referral/byPhenotype/otologic/specialty", "—", "tests/harness/referral-delta.js", `REFERRAL_DELTA.changed (release ${REFERRAL_DELTA.release}; the clinical lead's referral rule, chat, ${REFERRAL_DELTA.quotes.referral.date}): was the baseline value (Scr L1456), which applyReferralDelta requires; proven by revertReferralDelta`);
  src("/phenotypes/referral/byPhenotype/both", "—", "tests/harness/referral-delta.js", `REFERRAL_DELTA.added (release ${REFERRAL_DELTA.release}; the clinical lead, chat, ${REFERRAL_DELTA.quotes.both.date}: both cases follow the dizziness rule): specialty Neurology with the reason the default gave both; added last in byPhenotype with applyReferralDelta, proven by revertReferralDelta`);
  src("/phenotypes/referral/clinicianRules", "—", "tests/harness/referral-delta.js", `REFERRAL_DELTA.added (release ${REFERRAL_DELTA.release}; the clinical lead's referral rule and definition, ${REFERRAL_DELTA.quotes.referral.date}, and clarification, ${REFERRAL_DELTA.quotes.clarification.date}, verbatim, chat; the definition as the lead amended it, ${REFERRAL_DELTA.quotes.amendment.date}, REFERRAL_DELTA.amendments); added last in phenotypes.referral with applyReferralDelta, proven by revertReferralDelta; one basis per field in REFERRAL_DELTA.basis`);

  // The clinical lead's answers on the EMR template's open items (release 0.4.6;
  // tests/harness/emr-decisions-delta.js). applyEmrDecisionsDelta throws when an added key already
  // exists or its parent is missing; revertEmrDecisionsDelta proves the addition exact.
  const ED = EMR_DECISIONS_DELTA;
  const rubricDec = applyEmrDecisionsDelta(rubricRef, ED);
  {
    const ed0 = rubricRef.emrTemplate;
    const ed = rubricDec.emrTemplate;
    const HINTS_ROW = 14;
    check(deepEqual(revertEmrDecisionsDelta(rubricDec, ED), rubricRef) && deepEqual(Object.keys(rubricDec), Object.keys(rubricRef))
        && deepEqual(Object.keys(ed), [...Object.keys(ed0), "pastHistory"])
        && deepEqual(Object.keys(ed.examRows[HINTS_ROW]), [...Object.keys(ed0.examRows[HINTS_ROW]), "optionPlaceholders"])
        && deepEqual(ed0, EMR_DELTA.value),
      "emr decisions delta: emrTemplate.pastHistory added last in emrTemplate and optionPlaceholders added last in the HINTS exam row, nothing else; revertEmrDecisionsDelta gives back the rubric without them exactly (key order included), whose emrTemplate is the signed-off block of release 0.4.3 (EMR_DELTA.value)");
    const dec = ED.decided || {};
    const q = ED.quotes || {};
    const qs = Object.values(q);
    check(ED.release === "0.4.6" && dec.by === "clinical lead" && dec.channel === "chat" && emrSignOffComplete({ by: dec.by, scope: "emr decisions", channel: dec.channel, date: dec.date })
        && qs.length === 4 && qs.every((x) => x && x.date === dec.date && typeof x.question === "string" && x.question.trim() && Array.isArray(x.options) && x.options.length >= 2
          && x.options.every((o) => o && typeof o.label === "string" && o.label.trim() && typeof o.description === "string" && o.description.trim())),
      `emr decisions delta: release 0.4.6, decided by the clinical lead in chat on a real calendar date (${dec.date}); four quoted questions of that date, each with the options the lead saw`);
    // Each answer is one option label, or (the multi-select question) a comma-joined list of them.
    const chosen = (x) => (x && typeof x.answer === "string" ? x.answer.split(",") : []);
    const labelsOf = (x) => (x && Array.isArray(x.options) ? x.options.map((o) => o.label) : []);
    check(qs.every((x) => chosen(x).length > 0 && chosen(x).every((a) => labelsOf(x).includes(a)) && (x === q.addBack || chosen(x).length === 1)),
      "emr decisions delta: each answer is one of the options the lead saw (the add-back question: one or more of them, comma-joined)");
    const optionOf = (x, label) => (x && Array.isArray(x.options) ? x.options.find((o) => o.label === label) : undefined);
    const has = (x, label) => chosen(x).includes(label);
    // The added rows are exactly what the answers ask for, in the wording the chosen options quote.
    const mod = optionOf(q.addBack, "Modifying conditions");
    const modLabel = mod ? (/^Add '(.+): \[ \]'/.exec(mod.description) || [])[1] : undefined;
    const famItems = (ed.pastHistory || []).filter((r) => r.item !== undefined);
    const itemByIdD = Object.fromEntries(domains.flatMap((d) => d.items.map((it) => [it.id, it])));
    const famItem = famItems.length === 1 ? itemByIdD[famItems[0].item] : undefined;
    check(has(q.addBack, "Modifying conditions") && has(q.addBack, "Family history of migraine") && !!modLabel
        && deepEqual(ed.pastHistory, [{ label: modLabel, group: "medical" }, { item: famItems.length === 1 ? famItems[0].item : null, group: "family" }])
        && !!famItem && famItem.patientClin === "Personal or family history of migraine" && famItem.text === famItem.patientClin
        && !(ed.history || []).some((r) => r.item === famItem.id),
      `emr decisions delta: pastHistory is exactly the two rows the add-back answer asks for: the modifying-conditions label as the chosen option quotes it (${JSON.stringify(modLabel)}, group medical) and the item whose own wording is "Personal or family history of migraine" (group family; not also a history row)`);
    const hintsOpt = optionOf(q.hints, "Add a clinician line (Recommended)");
    const hintsText = hintsOpt ? (/add '\[([^\]]+)\]'/.exec(hintsOpt.description) || [])[1] : undefined;
    const centralLabel = (/\('([^']+)'\)/.exec((q.hints && q.hints.question) || "") || [])[1];
    const logicNsD = await env.loader.importModule(new URL("modules/masque/masque.logic.js", env.appBase).href);
    const hintsProbe = (((logicNsD.default || {}).probes || {}).list || []).find((p) => p.id === ed.examRows[HINTS_ROW].probe);
    const centralIndex = hintsProbe ? hintsProbe.opts.findIndex((o) => o.l === centralLabel) : -1;
    check(has(q.hints, "Add a clinician line (Recommended)") && !!hintsText && !!hintsProbe && hintsProbe.kind === "exam" && hintsProbe.id === "pr_head_impulse" && centralIndex >= 0
        && deepEqual(ed.examRows[HINTS_ROW].optionPlaceholders, [{ option: centralIndex, placeholder: hintsText }]),
      `emr decisions delta: the HINTS exam row (pr_head_impulse, an exam probe) carries exactly one option placeholder, for the option the question names (${JSON.stringify(centralLabel)}, index ${centralIndex}), in the words the chosen option quotes (${JSON.stringify(hintsText)})`);
    // The other answers add no data: the reading of "also" and the Considerations line are the
    // engine's (engine/emr.js); DZ4 keeps its clause (the signed-off checklist is unchanged).
    check(has(q.also, "Workup + referral + references") && has(q.addBack, "Assessment 'Considerations'") && has(q.dz4, "Keep the clause (Recommended)")
        && deepEqual(ED.added.map((row) => row.path), ["/emrTemplate/pastHistory", `/emrTemplate/examRows/${HINTS_ROW}/optionPlaceholders`]),
      "emr decisions delta: the answers that add no data (the reading of also, the Considerations line, the DZ4 clause) add no row: added is exactly pastHistory and the HINTS option placeholders");
    const strings = [];
    const walkS = (x) => { if (typeof x === "string") strings.push(x); else if (Array.isArray(x)) x.forEach(walkS); else if (x && typeof x === "object") Object.values(x).forEach(walkS); };
    walkS(ED.added.map((row) => row.value));
    check(strings.length > 0 && strings.every((x) => x.trim() && !/[[\]{}]/.test(x)), "emr decisions delta: every added string is non-empty and carries no [ ] { } (placeholders are the engine's)");
    const entries = [...(ed.pastHistory || []).map((_, i) => `/pastHistory/${i}`), ...(ed.examRows[HINTS_ROW].optionPlaceholders || []).map((_, j) => `/examRows/${HINTS_ROW}/optionPlaceholders/${j}`)];
    const noBasis = entries.filter((p) => typeof ED.basis[p] !== "string" || !ED.basis[p].trim());
    const strayBasis = Object.keys(ED.basis).filter((p) => !entries.includes(p));
    check(noBasis.length === 0 && strayBasis.length === 0,
      `emr decisions delta: one basis per past-history row and per option placeholder (${entries.length})${noBasis.length ? ` — missing: ${noBasis.join(", ")}` : ""}${strayBasis.length ? ` — stray: ${strayBasis.join(", ")}` : ""}`);
    const log = rubricDec.changelog;
    const dl = log[log.length - 4];
    check(dl.kind === "emr-decisions" && dl.date === dec.date && deepEqual(dl.paths, ED.added.map((row) => row.path)) && log[log.length - 5].kind === "referral",
      "emr decisions delta: its change-log entry (kind emr-decisions, dated as the decision, paths = the added paths) comes right after the 0.4.5 referral entry and is followed only by the 0.4.7 lexicon entry and the 0.4.8 question and emr-plan entries");
    // Release 0.4.7: the lexicon 0.3.2 → 0.3.3 entry, dated as the lead's sign-off (2026-10-12),
    // naming exactly the paths the delta touches; since release 0.4.8 the question and emr-plan
    // entries follow it.
    const ll = log[log.length - 3];
    const d3paths = [...new Set([...LEXICON_DELTA_033.fields.map((row) => `/lexicon${row.path}`), ...LEXICON_DELTA_033.appended.map((row) => `/lexicon${row.path}`)])];
    check(ll.kind === "lexicon" && !!LEXICON_DELTA_033.signOff && ll.date === LEXICON_DELTA_033.signOff.date && deepEqual(ll.paths.slice().sort(), d3paths.slice().sort()) && ll.note === LEXICON_DELTA_033.changelog.note
        && ll.note.includes("signed off by the clinical lead on 2026-10-12") && !ll.note.includes("DRAFT") && ll.note.includes("\"is the rhinorrhea clear or purulent?\""),
      "lexicon delta 033: its change-log entry (kind lexicon, dated as the lead's sign-off of 2026-10-12, paths = exactly the paths the delta touches, the note saying the lead signed it off and quoting the lead's question) is followed only by the 0.4.8 question and emr-plan entries");
  }
  src("/emrTemplate/pastHistory", "—", "tests/harness/emr-decisions-delta.js", `EMR_DECISIONS_DELTA.added (release ${EMR_DECISIONS_DELTA.release}; the clinical lead's answer, chat, ${EMR_DECISIONS_DELTA.decided.date}: add back the modifying-conditions row, in the wording the chosen option quotes, and the family-history-of-migraine line); added last in emrTemplate with applyEmrDecisionsDelta, proven by revertEmrDecisionsDelta; one basis per row in EMR_DECISIONS_DELTA.basis`);
  src("/emrTemplate/examRows/14/optionPlaceholders", "—", "tests/harness/emr-decisions-delta.js", `EMR_DECISIONS_DELTA.added (release ${EMR_DECISIONS_DELTA.release}; the clinical lead's answer, chat, ${EMR_DECISIONS_DELTA.decided.date}: a clinician line under the HINTS row when a central pattern is recorded, in the words the chosen option quotes); added last in the HINTS exam row with applyEmrDecisionsDelta, proven by revertEmrDecisionsDelta`);

  // The clinical lead's question for item r_dur (release 0.4.8; tests/harness/question-delta-048.js).
  // applyQuestionDelta throws when an item at a row's path is not the row's item or its ask is not
  // the row's `from` (the baseline-extracted value); revertQuestionDelta proves the change exact.
  const QD = QUESTION_DELTA;
  const rubricQ = applyQuestionDelta(rubricDec, QD);
  {
    const rubric = rubricQ;
    check(deepEqual(revertQuestionDelta(rubric, QD), rubricDec) && deepEqual(Object.keys(rubric), Object.keys(rubricDec)),
      `question delta: ${QD.changed.length} item question changed from its baseline value, nothing else; revertQuestionDelta gives back the rubric without it exactly (key order included)`);
    const req = Array.isArray(QD.request) ? QD.request.join("\n") : "";
    const rq = QD.requested || {};
    check(QD.release === "0.4.8" && rq.by === "clinical lead" && rq.channel === "chat" && emrSignOffComplete({ by: rq.by, scope: "question", channel: rq.channel, date: rq.date })
        && rq.date === "2026-10-12" && req.startsWith("Fix 2: Question: recalcitrance\n"),
      `question delta: release 0.4.8, requested by the clinical lead in chat on a real calendar date (${rq.date}), the request recorded as written`);
    // Each new question is a sentence the lead quoted, verbatim (never re-cased or re-punctuated);
    // each old one is the baseline Scribe's ASK, which the lead's request also quotes; the item is the
    // one the request names by its card tag (its domain label, lowercased) and it is a yes / no item.
    const itemByIdQ = Object.fromEntries(rubric.domains.flatMap((d) => d.items.map((it) => [it.id, { it, d }])));
    const badRows = QD.changed.filter((row) => {
      const hit = itemByIdQ[row.item];
      return !hit || !req.includes(`"${row.to}"`) || !req.includes(row.from) || hit.it.ask !== row.to || hit.it.scale !== undefined
        || !req.includes(`Question: ${String(hit.d.label).toLowerCase()}`) || scb.ASK[row.item] !== row.from;
    });
    check(badRows.length === 0,
      `question delta: each new question is the lead's quoted sentence, verbatim, on the yes / no item the request names by its card tag; each old one the baseline Scribe ASK the request quotes${badRows.length ? ` — not: ${badRows.map((row) => row.path).join(", ")}` : ""}`);
    // Outside the instrument: ask is not in the instrumentHash or scoringHash projections, so neither
    // hash and no version axis moves (Q11; engine/hash.js).
    const [hq, hd] = await Promise.all([rubricHashes(rubric), rubricHashes(rubricDec)]);
    check(hq.instrumentHash === hd.instrumentHash && hq.scoringHash === hd.scoringHash && hq.lexiconHash === hd.lexiconHash && hq.contentHash !== hd.contentHash
        && rubric.instrumentVersion === rubricDec.instrumentVersion && deepEqual(rubric.lexicon, rubricDec.lexicon),
      "question delta: instrumentHash, scoringHash and lexiconHash unchanged (ask is outside their projections), contentHash changed; instrument and lexicon versions unchanged");
    const entries = QD.changed.map((row) => row.path);
    const noBasis = entries.filter((p) => typeof QD.basis[p] !== "string" || !QD.basis[p].trim());
    const strayBasis = Object.keys(QD.basis).filter((p) => !entries.includes(p));
    check(noBasis.length === 0 && strayBasis.length === 0,
      `question delta: one basis per changed question (${entries.length})${noBasis.length ? ` — missing: ${noBasis.join(", ")}` : ""}${strayBasis.length ? ` — stray: ${strayBasis.join(", ")}` : ""}`);
    const log = rubric.changelog;
    const ql = log[log.length - 2];
    check(ql.kind === "question" && ql.date === rq.date && deepEqual(ql.paths, entries) && log[log.length - 3].kind === "lexicon"
        && QD.changed.every((row) => ql.note.includes(`"${row.to}"`)),
      "question delta: its change-log entry (kind question, dated as the request, paths = the changed paths, quoting the new question) comes right after the 0.4.7 lexicon entry and is followed only by the 0.4.8 emr-plan entry");
  }
  for (const row of QUESTION_DELTA.changed) {
    src(row.path, "—", "tests/harness/question-delta-048.js", `QUESTION_DELTA.changed (release ${QUESTION_DELTA.release}; the clinical lead's question for ${row.item}, chat, ${QUESTION_DELTA.requested.date}, verbatim): was the baseline Scribe ASK.${row.item}, which applyQuestionDelta requires; proven by revertQuestionDelta`);
  }

  // The clinical lead's plan line for the EMR template (release 0.4.8, follow-up;
  // tests/harness/emr-plan-delta-048.js), applied with the 0.4.6 answers' functions:
  // applyEmrDecisionsDelta throws when the added key already exists or its parent is missing;
  // revertEmrDecisionsDelta proves the addition exact.
  const PD = EMR_PLAN_DELTA;
  const rubric = applyEmrDecisionsDelta(rubricQ, PD);
  {
    const e0 = rubricQ.emrTemplate;
    const e1 = rubric.emrTemplate;
    check(deepEqual(revertEmrDecisionsDelta(rubric, PD), rubricQ) && deepEqual(Object.keys(rubric), Object.keys(rubricQ))
        && deepEqual(Object.keys(e1), [...Object.keys(e0), "planAdvice"]) && deepEqual(PD.added.map((row) => row.path), ["/emrTemplate/planAdvice"]),
      "emr plan delta: emrTemplate.planAdvice added last in emrTemplate, nothing else; revertEmrDecisionsDelta gives back the rubric without it exactly (key order included)");
    const req = Array.isArray(PD.request) ? PD.request.join("\n") : "";
    const rq = PD.requested || {};
    const q = PD.quotes || {};
    check(PD.release === "0.4.8" && rq.by === "clinical lead" && rq.channel === "chat" && emrSignOffComplete({ by: rq.by, scope: "emr plan", channel: rq.channel, date: rq.date })
        && rq.date === "2026-10-12" && req.startsWith("Also recommendations in the plan should also add \""),
      `emr plan delta: release 0.4.8, requested by the clinical lead in chat on a real calendar date (${rq.date}), the request recorded as written`);
    // The answers: the line prints beside the treatment references with no red flag open, in the EMR
    // template only (the chosen options' labels and descriptions as the lead saw them).
    check(Object.keys(q).length === 2 && Object.values(q).every((x) => x && x.date === rq.date && typeof x.question === "string" && x.question.trim()
          && typeof x.answer === "string" && x.answer.trim() && typeof x.answerDescription === "string" && x.answerDescription.trim())
        && !!q.when && q.when.answer === "With the treatment refs, no red flag (Recommended)" && !!q.outputs && q.outputs.answer === "EMR template note (Recommended)",
      "emr plan delta: the two answers of 2026-10-12 recorded with their questions and the chosen options' descriptions (when: with the treatment refs, no red flag; outputs: the EMR template note)");
    // The line is the sentence the lead quoted, verbatim (never re-cased or re-punctuated), with its
    // record: source "lead", decided on the request's date; the question about it quotes it too.
    const rows = Array.isArray(e1.planAdvice) ? e1.planAdvice : [];
    check(rows.length === 1 && rows.every((r) => r && Object.keys(r).join() === "text,source,decided" && typeof r.text === "string" && req.includes(`"${r.text}"`)
          && !!q.when && q.when.question.includes(`"${r.text}"`) && r.source === "lead" && r.decided === rq.date),
      `emr plan delta: planAdvice is exactly one line, the sentence the lead quoted, verbatim (${JSON.stringify(rows[0] && rows[0].text)}), with source "lead" and decided ${rq.date}`);
    const strings = [];
    const walkS = (x) => { if (typeof x === "string") strings.push(x); else if (Array.isArray(x)) x.forEach(walkS); else if (x && typeof x === "object") Object.values(x).forEach(walkS); };
    walkS(PD.added.map((row) => row.value));
    check(strings.length > 0 && strings.every((x) => x.trim() && !/[[\]{}]/.test(x)), "emr plan delta: every added string is non-empty and carries no [ ] { } (placeholders are the engine's)");
    // Outside the instrument: emrTemplate is in no projection but contentHash's.
    const [hp, hq] = await Promise.all([rubricHashes(rubric), rubricHashes(rubricQ)]);
    check(hp.instrumentHash === hq.instrumentHash && hp.scoringHash === hq.scoringHash && hp.lexiconHash === hq.lexiconHash && hp.contentHash !== hq.contentHash
        && rubric.instrumentVersion === rubricQ.instrumentVersion && deepEqual(rubric.lexicon, rubricQ.lexicon),
      "emr plan delta: instrumentHash, scoringHash and lexiconHash unchanged (emrTemplate is outside their projections), contentHash changed; instrument and lexicon versions unchanged");
    const entries = rows.map((_, i) => `/planAdvice/${i}`);
    const noBasis = entries.filter((p) => typeof PD.basis[p] !== "string" || !PD.basis[p].trim());
    const strayBasis = Object.keys(PD.basis).filter((p) => !entries.includes(p));
    check(entries.length > 0 && noBasis.length === 0 && strayBasis.length === 0,
      `emr plan delta: one basis per plan-advice line (${entries.length})${noBasis.length ? ` — missing: ${noBasis.join(", ")}` : ""}${strayBasis.length ? ` — stray: ${strayBasis.join(", ")}` : ""}`);
    const log = rubric.changelog;
    const pl = log[log.length - 1];
    check(pl.kind === "emr-plan" && pl.date === rq.date && deepEqual(pl.paths, PD.added.map((row) => row.path)) && log[log.length - 2].kind === "question"
        && rows.every((r) => pl.note.includes(`"${r.text}"`)),
      "emr plan delta: its change-log entry (kind emr-plan, dated as the request, paths = the added path, quoting the line) is the last, right after the 0.4.8 question entry");
  }
  src("/emrTemplate/planAdvice", "—", "tests/harness/emr-plan-delta-048.js", `EMR_PLAN_DELTA.added (release ${EMR_PLAN_DELTA.release}; the clinical lead's request and answers, chat, ${EMR_PLAN_DELTA.requested.date}: the lead's sentence, verbatim, printed beside the empiric-treatment references with no red flag open, in the EMR template only); added last in emrTemplate with applyEmrDecisionsDelta, proven by revertEmrDecisionsDelta; one basis per line in EMR_PLAN_DELTA.basis`);

  check(scaleMaxComputed === 100, "Σ positive domain max = 100");
  for (const d of rubric.domains) check(Math.abs(d.items.reduce((s, i) => s + i.w, 0) - d.max) < 1e-9, `domain ${d.key}: Σw = max`);
  src("/{format,contractVersion}", "—", "engine/contract.js", "FORMAT.rubric, CONTRACT_VERSION");
  src("/{id,label,name,icon}", "—", "hand-written", "design §9.2 item 6 (label: user requirement 2026-10-02, Q1)");
  src("/logicBinding", "—", "hand-written", "{moduleId: id}; the registry pairs the files, no SHA pin (§3.8)");
  src("/changelog", "—", "hand-written", "reconciliation, extraction and open-question notes (§3.8); then LEXICON_DELTA.changelog from tests/harness/lexicon-delta.js (design 05 §6.3); then LOCALE_DELTA.changelog from tests/harness/locale-delta.js (release 0.4.2); then EMR_DELTA.changelog from tests/harness/emr-delta.js (release 0.4.3); then EMR_DELTA.signOffChangelog from the same file (release 0.4.4, the clinical-lead sign-off); then REFERRAL_DELTA.changelog from tests/harness/referral-delta.js (release 0.4.5, the clinical-lead referral rule, dated as its last decision); then EMR_DECISIONS_DELTA.changelog from tests/harness/emr-decisions-delta.js (release 0.4.6, the clinical lead's answers on the EMR template's open items); then LEXICON_DELTA_033.changelog from tests/harness/lexicon-delta-033.js (release 0.4.7, lexicon 0.3.3: chart text and clarification, signed off by the clinical lead on 2026-10-12); then QUESTION_DELTA.changelog from tests/harness/question-delta-048.js (release 0.4.8, the clinical lead's question for item r_dur, 2026-10-12); the last entry is EMR_PLAN_DELTA.changelog from tests/harness/emr-plan-delta-048.js (release 0.4.8, the clinical lead's plan line for the EMR template, 2026-10-12)");

  // scoring hash with WP0's rubricHashes (the binder's implementation); the hashes returned are those
  // of the rubric as written, with that scoringHash stored (contentHash covers research).
  const unstored = await rubricHashes(rubric);
  rubric.research.calibration.appliesTo.scoringHash = unstored.scoringHash;
  check(/^[0-9a-f]{64}$/.test(unstored.scoringHash), "scoringHash is 64-hex");
  const hashes = await rubricHashes(rubric);
  check(hashes.scoringHash === unstored.scoringHash, "scoringHash is independent of research (stable after storing it)");

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
