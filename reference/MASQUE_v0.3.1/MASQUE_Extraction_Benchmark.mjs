#!/usr/bin/env node
/*  Project MASQUE — extraction benchmark harness
    Run:  node MASQUE_Extraction_Benchmark.mjs [--json out.json] [--sweep]

    Proposal §7.2 commits to developing AND BENCHMARKING free-text extraction. The
    conformance audit found the extraction built and the benchmark absent. This is
    the benchmark.

    It imports MASQUE_Extraction.js directly, so it scores the rules that ship rather
    than a transcription of them. Change a phrase list, re-run, see the cost.

    What it will NOT do
    -------------------
    Report a headline number without its denominator. The development set is authored
    by one person to probe known failure modes, which makes it useful for guiding rule
    changes and useless as evidence of performance on real narratives. Every output
    path here carries that caveat, and the openFDA path is reported separately and
    marked unrun.
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extract, LEXICON_VERSION, EXTRACTOR_KIND, NEGATION, RF_PHRASES,
} from "./MASQUE_Extraction.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const gold = JSON.parse(fs.readFileSync(path.join(HERE, "masque_extraction_goldset.json"), "utf8"));

const argv = process.argv.slice(2);
const jsonOut = argv.includes("--json") ? argv[argv.indexOf("--json") + 1] : null;
const doSweep = argv.includes("--sweep") || true;

const isRf = id => id in RF_PHRASES;
const keyOf = (id, v) => `${id}=${v}`;

// --------------------------------------------------------------------------
// Scoring
// --------------------------------------------------------------------------
/*  An extraction is correct only when the id AND the value match. Capturing
    m_nausea="yes" where the gold says "no" is a wrong answer, not a partial one —
    it is the failure that puts a symptom in a chart the patient just denied. It is
    counted as a false positive and a false negative, and broken out separately as a
    value error so the harness can tell "found the wrong thing" from "found nothing".
*/
function scoreOne(kase, opts) {
  const got = extract(kase.text, { ...opts, includeSuppressed: true });
  const fired = got.filter(g => !g.suppressedBy);
  const suppressed = got.filter(g => g.suppressedBy);

  const goldSet = new Map(kase.expect.map(([id, v]) => [keyOf(id, v), { id, v }]));
  const gotSet = new Map(fired.map(g => [keyOf(g.id, g.value), g]));

  const tp = [], fp = [], fn = [];
  for (const [k, g] of gotSet) (goldSet.has(k) ? tp : fp).push({ ...g, key: k });
  for (const [k, g] of goldSet) if (!gotSet.has(k)) fn.push({ ...g, key: k });

  // error taxonomy
  for (const e of fp) {
    const goldIds = kase.expect.map(([id]) => id);
    e.cause = goldIds.includes(e.id) ? "value-error"
      : /^rf_/.test(e.id) ? "redflag-unsuppressed"
      : "vocabulary-overreach";
  }
  for (const e of fn) {
    const sup = suppressed.find(s => s.id === e.id);
    const wrongVal = fired.find(f => f.id === e.id);
    e.cause = sup ? `over-suppressed:${sup.suppressedBy}`
      : wrongVal ? "value-error"
      : "vocabulary-gap";
  }
  return { tp, fp, fn, suppressed };
}

function prf(tp, fp, fn) {
  const p = tp + fp ? tp / (tp + fp) : null;
  const r = tp + fn ? tp / (tp + fn) : null;
  const f = p !== null && r !== null && p + r > 0 ? (2 * p * r) / (p + r) : null;
  return { p, r, f1: f, tp, fp, fn };
}

function runSet(cases, opts = {}) {
  let TP = 0, FP = 0, FN = 0;
  const perItem = {}, causes = {}, perCase = [];
  for (const k of cases) {
    const s = scoreOne(k, opts);
    TP += s.tp.length; FP += s.fp.length; FN += s.fn.length;
    for (const g of [...s.tp, ...s.fp, ...s.fn]) {
      perItem[g.id] ??= { tp: 0, fp: 0, fn: 0 };
    }
    s.tp.forEach(g => perItem[g.id].tp++);
    s.fp.forEach(g => { perItem[g.id].fp++; causes[g.cause] = (causes[g.cause] || 0) + 1; });
    s.fn.forEach(g => { perItem[g.id].fn++; causes[g.cause] = (causes[g.cause] || 0) + 1; });
    perCase.push({ id: k.utteranceId, ...s });
  }
  const micro = prf(TP, FP, FN);
  const items = Object.entries(perItem).map(([id, c]) => ({ id, ...prf(c.tp, c.fp, c.fn) }));
  const withF1 = items.filter(i => i.f1 !== null);
  const macroF1 = withF1.length ? withF1.reduce((a, i) => a + i.f1, 0) / withF1.length : null;
  return { micro, macroF1, items, causes, perCase, n: cases.length };
}

const fmt = v => (v === null ? "  —  " : (v * 100).toFixed(1).padStart(5));
const bar = (n = 74) => "─".repeat(n);

// --------------------------------------------------------------------------
const all = gold.cases;
const clinical = all.filter(c => !c.expect.some(([id]) => isRf(id)));
const redflag = all.filter(c => c.expect.some(([id]) => isRf(id)));
const byRegister = r => all.filter(c => c.register === r);

console.log(bar());
console.log("MASQUE EXTRACTION BENCHMARK");
console.log(bar());
console.log(`lexicon ${LEXICON_VERSION} · ${EXTRACTOR_KIND}`);
console.log(`negation window ${NEGATION.window} chars`);
console.log(`development set ${gold._meta.version} · ${all.length} utterances · ${all.reduce((a, c) => a + c.expect.length, 0)} labelled extractions`);
console.log("");
console.log("!! " + gold._meta.provenance.split(".")[0] + ".");
console.log("!! These are development figures, not validation results.");

const overall = runSet(all);
console.log("\n" + bar());
console.log("OVERALL");
console.log(bar());
console.log(`  micro  P ${fmt(overall.micro.p)}%   R ${fmt(overall.micro.r)}%   F1 ${fmt(overall.micro.f1)}%   (tp ${overall.micro.tp} fp ${overall.micro.fp} fn ${overall.micro.fn})`);
console.log(`  macro F1 ${fmt(overall.macroF1)}%  across ${overall.items.filter(i => i.f1 !== null).length} items`);

console.log("\nBY SLICE");
const slices = [
  ["clinical items only", clinical],
  ["red flags only", redflag],
  ["encounter register", byRegister("encounter")],
  ["narrative register (openFDA-like)", byRegister("narrative")],
];
for (const [name, set] of slices) {
  const r = runSet(set);
  console.log(`  ${name.padEnd(34)} P ${fmt(r.micro.p)}%  R ${fmt(r.micro.r)}%  F1 ${fmt(r.micro.f1)}%   n=${set.length}`);
}

console.log("\nERROR TAXONOMY");
for (const [cause, n] of Object.entries(overall.causes).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${cause}`);
}

console.log("\nWEAKEST ITEMS (by F1, items with ≥1 labelled instance)");
overall.items.filter(i => i.f1 !== null).sort((a, b) => a.f1 - b.f1).slice(0, 8)
  .forEach(i => console.log(`  ${i.id.padEnd(14)} F1 ${fmt(i.f1)}%   P ${fmt(i.p)}%  R ${fmt(i.r)}%   (tp ${i.tp} fp ${i.fp} fn ${i.fn})`));

// --------------------------------------------------------------------------
// Negation-window sweep — replaces the unexplained constant with a measurement.
// --------------------------------------------------------------------------
let sweep = null;
if (doSweep) {
  console.log("\n" + bar());
  console.log("NEGATION WINDOW SWEEP  (clinical items only — red flags are never negation-checked)");
  console.log(bar());
  sweep = [];
  for (const w of [10, 14, 18, 22, 26, 30, 36, 44, 60]) {
    const r = runSet(clinical, { negationWindow: w });
    sweep.push({ window: w, ...r.micro });
    const mark = w === NEGATION.window ? "  <- shipped" : "";
    console.log(`  window ${String(w).padStart(3)}  P ${fmt(r.micro.p)}%  R ${fmt(r.micro.r)}%  F1 ${fmt(r.micro.f1)}%${mark}`);
  }
  const scored = sweep.filter(s => s.f1 !== null);
  const bestF1 = Math.max(...scored.map(s => s.f1));
  const tied = scored.filter(s => Math.abs(s.f1 - bestF1) < 1e-9).map(s => s.window);
  const shippedBest = tied.includes(NEGATION.window);
  console.log("");
  if (tied.length === scored.length) {
    console.log("  F1 is FLAT across every window tested — this set does not discriminate the");
    console.log("  parameter at all. The shipped value is therefore still unjustified by evidence;");
    console.log("  the fix is more negation cases in the set, not a different constant.");
  } else if (shippedBest && tied.length > 1) {
    console.log(`  Best F1 is a plateau across windows ${tied.join(", ")} — the shipped value ${NEGATION.window} is`);
    console.log("  on it. Anything on a plateau is under-determined; prefer the smallest such window,");
    console.log("  since a narrower scope is the more conservative reading of a negation.");
  } else if (shippedBest) {
    console.log(`  Best F1 at window ${NEGATION.window}, uniquely — the shipped value is the measured optimum.`);
  } else {
    console.log(`  Best F1 at window${tied.length > 1 ? "s" : ""} ${tied.join(", ")}; shipped value is ${NEGATION.window}.`);
    console.log("  -> consider updating NEGATION.window, and bump LEXICON_VERSION when you do.");
  }
}

console.log("\n" + bar());
console.log("SET SATURATION");
console.log(bar());
/*  The number that matters least is the headline one.

    These rules were changed in response to this set, so every figure above is
    in-sample by construction. A rule-based extractor scoring at or near ceiling on
    its own development set has not been shown to be good — it has shown the set is
    exhausted. Printing this automatically rather than relying on whoever reads the
    output to remember it is the whole point.
*/
{
  const f1 = overall.micro.f1 ?? 0;
  const tuned = "Rules in MASQUE_Extraction.js were revised in response to this set (lexicon 0.2.0 → 0.3.1), so all figures above are IN-SAMPLE.";
  if (f1 >= 0.97) {
    console.log("  ** SATURATED — DO NOT REPORT THE HEADLINE NUMBER AS PERFORMANCE. **");
    console.log(`  F1 is ${(f1 * 100).toFixed(1)}% on a ${all.length}-utterance authored set with no held-out split.`);
    console.log("  " + tuned);
    console.log("  This means the set has stopped being informative, not that extraction is solved.");
    console.log("  Next useful step is harder data, not more tuning:");
    console.log("    - real FAERS narratives via faersToUtterances()");
    console.log("    - a second annotator and an agreement statistic");
    console.log("    - a held-out split written by someone who did not write the rules");
  } else {
    console.log(`  F1 ${(f1 * 100).toFixed(1)}% — set is still discriminating. ` + tuned);
  }
}
console.log(bar());
console.log("  adapter        : faersToUtterances() — declared interface, NOT YET RUN on live data");
console.log("  access         : pending (proposal §6 lists openFDA for narrative NLP development)");
console.log("  measured here  : narrative-register proxy cases only, authored, see slice table above");
console.log("  what is needed : a FAERS pull, ≥2 independent annotators, an agreement statistic,");
console.log("                   and a held-out split. Until then no extraction figure should be");
console.log("                   quoted as performance on openFDA narratives.");
console.log("");

const report = {
  generatedAt: new Date().toISOString(),
  lexiconVersion: LEXICON_VERSION,
  extractorKind: EXTRACTOR_KIND,
  negationWindow: NEGATION.window,
  developmentSet: { version: gold._meta.version, cases: all.length, provenance: gold._meta.provenance, labelling: gold._meta.labelling },
  status: "DEVELOPMENT — not validation. Authored set, single annotator, no held-out split.",
  overall: { micro: overall.micro, macroF1: overall.macroF1 },
  slices: Object.fromEntries(slices.map(([n, s]) => [n, runSet(s).micro])),
  errorTaxonomy: overall.causes,
  perItem: overall.items,
  negationSweep: sweep,
  saturation: {
    inSample: true,
    saturated: (overall.micro.f1 ?? 0) >= 0.97,
    note: "Rules were revised in response to this set, so every figure here is in-sample. At or near ceiling means the set is exhausted, not that extraction is solved. Do not quote the headline F1 as extraction performance.",
    heldOutSplit: false,
    annotators: 1,
    interAnnotatorAgreement: null,
  },
  openFda: { adapter: "faersToUtterances", run: false, accessStatus: "pending",
    caveat: "No extraction figure in this report was measured on openFDA narratives." },
};
if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2)); console.log(`wrote ${jsonOut}`); }
export default report;
