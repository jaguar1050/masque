// tests/suites/capture.js — the heard (F1), carry-over (F2) and yield (F4) rules of the extraction
// engine, text normalization (lexicon.normalize), the MASQUE gold set 0.3.0 with its dialogues, and
// the Scribe engine helpers (design 05 §7.4; normalize: §11.6; round 2: §12; round 3: §13; round 3b:
// §13.10; round 3d: §13.12). Owner: WP5 (package WP-I of the screenAIr 0.4.1 change).
//
// Block 1  Engine rules on a generic fixture lexicon built here with neutral ids (s_alpha, s_beta …),
//          so the rules hold with no module branch: heard only with includeHeard AND heard: true;
//          heard gating and includeSuppressed; yield on present, absent, anchored, negated-anchor,
//          yes/no and pending targets, and the suppressedBy "yield" record; every extractInContext
//          rule and every refusal code; expiry after exactly `carry` patient replies; refresh,
//          supersede, two-unresolved clearing and the embedded no-arm rule; a blank text consumes
//          nothing; turnsLeft clamped to carry; purity on deep-frozen inputs; normalize (apostrophe
//          folding, number spelling, original-text offsets); and the default-off proof over a seeded
//          corpus, on the fixture without the new fields and on the 0.3.1-equivalent MASQUE lexicon.
//          Round 2 (§12): carry negation anywhere before a band span (R1); band choice by agreement
//          for a heard entry and the band-order rule kept for the others (R2); carryExclude (R3a);
//          the carryRefuse onset guard in the cue's own utterance (R3b); number spelling for band
//          phrases only, every other family and every gate window on the folded text (R4); and
//          extractInContext with {carry: false} (R5).
//          Round 3 (§13), which replaces R1, R2, R3b and the collection rule of R3a: a heard entry
//          takes no band value when any span is negated, a carryRefuse phrase occurs or the spans
//          disagree, and an utterance that stated a band without a value opens no carry-over (R9);
//          a carried reply collects carryExclude phrases too, for the negation, ambiguity and
//          attribution refusals, and any negated span refuses it whole (R10); a carryExclude phrase
//          supplies a value in the cue's own utterance only in a cue sentence and elsewhere can only
//          withhold (R11 as corrected in §13.11, with the boundary rule); the contained-before-negated
//          order (review T2), negationWindow on heard band
//          choice (T3), and the folded text for yield presence, the own-cue check, carryRefuse and
//          the windows of a carried reply (T9).
//          Round 3b (§13.10), which replaces the round-3 slot rule of R9 f: a withheld utterance arms
//          a yield-only slot (pending for yieldTo, never carried into) and turns an open slot of the
//          entry yield-only, refreshed with the full carry (§13.11); a yieldOnly that is not a boolean drops the
//          slot; a yield-only slot never carries or refuses and expires like any slot; and every
//          precedence rule of the engine's "Slots" header: the entry's cue heard again with no band
//          re-arms a normal slot, an entry that yields to it does not clear it. A yield-only slot
//          shows as [id, turnsLeft, "yield-only"] in the brief results.
//          Round 3d (§13.12): a withheld line ends a normal slot of another entry (rule 3c), replaced
//          by the withheld entry's yield-only slot or cleared; the multi-carry sequences show that no
//          reply is then carried into the entry whose slot ended, and pin the disclosed effects: an
//          entry that yields to it, and the chain to an entry that yields to a third (F-3D-4).
// Block 2  MASQUE gold set 0.3.0 (tests/fixtures/goldset/, SHA-256 pinned; it includes the 44 cases
//          of the reference set 0.2.0 by reference, which is pinned too): every case through
//          extract(lexicon, text, {includeHeard: true}), unsuppressed; every dialogue run as the
//          Scribe runs it (physician turns passed over, one pending slot kept, {carry: false} while
//          the pending item is answered); the 44 reference cases give the same output under the
//          shipped lexicon as under the 0.3.1-equivalent one; the lead's normalize cases (D4); the
//          round-2 rules and every trace of the round-1 review on MASQUE, the disclosed known risks
//          included, with exact expectations; the round-3 rules and every trace of the round-2 review
//          (F1-F4, ENG-R1-1) on MASQUE, the §13.6 known risks included; the round-3b yield-only slot
//          on MASQUE (the defect "split second … for hours" then "it lasts a couple of hours", and
//          the §13.10 table); self-checks of the AD13 extraction normaliser of
//          tests/harness/diff.js (review T5: crafted pairs it must not
//          excuse, rule H on the review traces, and its hand-copied number rule against the engine);
//          and the benchmark (micro P/R/F1 with denominators, by slice; dialogues), printed in the
//          notes in the shape of the CHANGELOG.md block.
// Block 3  Scribe engine helpers: ingestCaptures with heard and carry captures, heardPrompts,
//          askNextSections, rankSuggestions with exclude, and the §2.1 strings of captureLabel and
//          heardLabel for MASQUE, exactly.
// Block 4  The F4 property, generated from the shipped lexicon's yieldTo data: target cue × entry
//          cue × entry band phrase × {no anchor, each anchor, each anchor negated with "not "} ×
//          {plain, "my mother ", "used to "}. The yielding entry is captured iff its cue opens, the
//          gates pass and (no target is named or an anchor is present unnegated); the target's own
//          captures equal those of the same lexicon without yieldTo/anchor, and, on every utterance
//          that holds no phrase appended by the lexicon delta, those of the 0.3.1-equivalent lexicon
//          (approved vocabulary legitimately changes the target elsewhere).
//
// Pins (design 05 §11.8, lead decision D6). GOLD_0_3_0_SHA256 and EXPECTED_BENCHMARK are pinned from
// the lead's browser run. While either reads "PIN_AFTER_RUN" the verdict is INVALID, never PASS, and
// the notes carry the computed values to paste here. Round 2's pins were taken from the browser run
// of 2026-10-05 (seed 1296126801). Round 3 changed the gold set and the extractor, so both pins read
// "PIN_AFTER_RUN" again until the lead re-runs and re-pins (design 05 §13.8); round 3b changed both
// again (§13.10). Both pins were re-taken from the lead's browser run after round 3b (seed
// 1296126801), which reported no difference.
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { pick } from "../harness/matrix.js";
import { AD13_NUMBER_WORDS, ad13Explain, allowedDifference, heardBandChoiceMayDiffer, normalizeRewrites, numberProbeLexicon,
  revertLexiconDelta } from "../harness/diff.js";
import { LEXICON_DELTA } from "../harness/lexicon-delta.js";

// ------------------------------------------------------------------------------------------ pins

/** What an unpinned pin holds. */
const PIN_AFTER_RUN = "PIN_AFTER_RUN";
/** SHA-256 of tests/fixtures/goldset/masque_extraction_goldset_0.3.0.json, from the lead's run. */
const GOLD_0_3_0_SHA256 = "729492ef21c13824970478e86203e2e93e48a97660db9d7e66fa73fc28de1566";
/** {tp, fp, fn, dialoguesApplied, dialoguesRefused} of the lead's run (an object once pinned). */
const EXPECTED_BENCHMARK = { tp: 192, fp: 0, fn: 0, dialoguesApplied: 93, dialoguesRefused: 93 };

// ------------------------------------------------------------------------------------- constants

const GOLD_0_3_0_FIXTURE = "goldset/masque_extraction_goldset_0.3.0.json";
const REFERENCE_GOLD_PATH = "../reference/MASQUE_v0.3.1/masque_extraction_goldset.json";
const REFERENCE_GOLD_SHA256 = "e1d6573695e554e57dd44cfab3de6699dccc6518c42f2b28afa32d9ddcab6cb2";
const REFERENCE_CASES = 44;
/** The capabilities design 05 §3.2, §11.6 and §12.3 add; EXTRACTOR_FEATURES must name every one. */
const FEATURES = ["scale.heard", "scale.carry", "scale.carryExclude", "scale.yieldTo", "scale.anchor", "carryRefuse",
  "normalize.apostrophes", "normalize.numbers"];
const REFUSALS = ["answered", "own-cue", "other-entry", "question", "refuse-phrase", "no-band", "negated",
  "ambiguous", "third-party", "historical"];
const NEW_SCALE_FIELDS = ["heard", "carry", "carryExclude", "yieldTo", "anchor"];
const NEW_TOP_FIELDS = ["carryRefuse", "normalize"];
const DEFAULT_OFF_UTTERANCES = { full: 2000, quick: 500 };
const F4_STRIDE = { full: 1, quick: 9 };
const F4_PREFIXES = ["", "my mother ", "used to "];
const FILLERS = ["", "really ", "honestly ", "sometimes ", "I think ", "and ", "but ", "it’s ", "for 3 days ", "about 20 minutes "];
const JOINS = [", ", ". ", " and ", " — ", "; ", ", but ", "? "];
const SATURATED_F1 = 0.97;

// --------------------------------------------------------------------------------------- helpers

const arr = (x) => (Array.isArray(x) ? x : []);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isPhrase = (p) => typeof p === "string" && p !== "";
const clone = (x) => JSON.parse(JSON.stringify(x));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const decodeJson = (bytes) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));

function deepFreeze(x) {
  if (x !== null && typeof x === "object") {
    for (const k of Object.keys(x)) deepFreeze(x[k]);
    Object.freeze(x);
  }
  return x;
}

/** One capture as a short string: "<id>=<value | heard>[ via <via>][ [<suppressedBy>]]". */
function tagOf(cp) {
  if (!isObj(cp)) return `not a capture: ${JSON.stringify(cp)}`;
  let s = `${cp.id}=${cp.kind === "heard" ? "heard" : String(cp.value)}`;
  if (cp.via !== undefined) s += ` via ${cp.via}`;
  if (cp.suppressedBy !== undefined) s += ` [${cp.suppressedBy}]`;
  return s;
}
const tags = (caps) => (Array.isArray(caps) ? caps.map(tagOf) : [`not an array: ${JSON.stringify(caps)}`]);

/** The third element of a pending slot in a brief result or a dialogue step: a yield-only slot (round 3b). */
const YIELD_ONLY = "yield-only";
/** A pending slot as [id, turnsLeft], or [id, turnsLeft, "yield-only"] for a yield-only slot; anything else as it is. */
const slotOf = (p) => (isObj(p) ? (p.yieldOnly === true ? [p.id, p.turnsLeft, YIELD_ONLY] : [p.id, p.turnsLeft]) : p);

/** An extractInContext result as {captures (tags), pending (slotOf), applied, refused}. */
function brief(r) {
  if (!isObj(r)) return r;
  return {
    captures: tags(r.captures),
    pending: slotOf(r.pending),
    applied: isObj(r.carry) ? r.carry.applied : undefined,
    refused: isObj(r.carry) ? r.carry.refused : undefined,
  };
}

/** fn(), or undefined after recording a failed check at `<at>/threw` when it throws. */
function attempt(c, at, input, fn) {
  try {
    return fn();
  } catch (err) {
    c.check(false, `${at}/threw`, input, "no exception", String((err && err.message) || err));
    return undefined;
  }
}

/** A cheap equality for large sweeps: a passing check, or the full deep diff when the JSON differs. */
function same(c, a, b, at, input) {
  if (JSON.stringify(a) === JSON.stringify(b)) return c.check(true, at, input, a, b);
  c.diff(a, b, { at, input, keyOrder: true });
  return false;
}

/** {window, cues} of a lexicon cue list, or an empty one. */
const cueSpecOf = (x) => (isObj(x) && Array.isArray(x.cues) ? { window: Number(x.window) || 0, cues: x.cues.filter(isPhrase) } : { window: 0, cues: [] });
/** Whether a cue of `spec` occurs in the spec.window characters before `idx` (the rule of design 03 §4.9). */
function cueWithin(text, idx, spec) {
  const pre = text.slice(Math.max(0, idx - spec.window), idx).toLowerCase();
  return spec.cues.some((q) => pre.includes(q));
}
function firstIndex(low, phrases) {
  for (const p of phrases) { const i = low.indexOf(p); if (i !== -1) return i; }
  return -1;
}
function allIndices(low, phrases) {
  const out = [];
  for (const p of phrases) { let i = low.indexOf(p); while (i !== -1) { out.push(i); i = low.indexOf(p, i + p.length); } }
  return out;
}

/** Every item-vocabulary phrase of a lexicon (the synthetic corpus' words). */
function vocabularyOf(lex) {
  const out = [];
  for (const e of arr(lex.bool)) if (isObj(e)) out.push(...arr(e.ph));
  for (const e of arr(lex.ctx)) if (isObj(e)) out.push(...arr(e.ph));
  for (const e of arr(lex.scale)) {
    if (!isObj(e)) continue;
    out.push(...arr(e.cue));
    for (const b of arr(e.bands)) if (isObj(b)) out.push(...arr(b.ph));
  }
  for (const e of arr(lex.multi)) if (isObj(e)) out.push(...arr(e.ph));
  if (isObj(lex.redFlags)) for (const ph of Object.values(lex.redFlags)) out.push(...arr(ph));
  return [...new Set(out.filter(isPhrase))];
}

/** n seeded utterances: 1-3 lexicon phrases, each with a random negation / attribution / history cue or none. */
function utterances(rng, lex, n) {
  const phrases = vocabularyOf(lex);
  const prefixes = [lex.negation, lex.thirdParty, lex.historical].flatMap((s) => (isObj(s) ? arr(s.cues) : [])).filter(isPhrase);
  const out = [];
  if (!phrases.length) return out;
  for (let i = 0; i < n; i++) {
    const k = 1 + Math.floor(rng() * 3);
    const parts = [];
    for (let j = 0; j < k; j++) {
      const pre = rng() < 0.5 || !prefixes.length ? "" : `${pick(rng, prefixes)}${rng() < 0.5 ? " " : ""}`;
      let ph = pick(rng, phrases);
      if (rng() < 0.15) ph = ph.charAt(0).toUpperCase() + ph.slice(1);
      parts.push(`${pre}${pick(rng, FILLERS)}${ph}`);
    }
    let text = parts[0];
    for (let j = 1; j < parts.length; j++) text += pick(rng, JOINS) + parts[j];
    out.push(text);
  }
  return out;
}

/** A copy of `lex` without any field design 05 adds. */
function withoutNewFields(lex) {
  const l = clone(lex);
  for (const e of arr(l.scale)) if (isObj(e)) for (const k of NEW_SCALE_FIELDS) delete e[k];
  for (const k of NEW_TOP_FIELDS) delete l[k];
  return l;
}
function newFieldsOf(lex) {
  const found = NEW_TOP_FIELDS.filter((k) => lex[k] !== undefined);
  arr(lex.scale).forEach((e, i) => { if (isObj(e)) for (const k of NEW_SCALE_FIELDS) if (e[k] !== undefined) found.push(`scale/${i}/${k}`); });
  return found;
}

/**
 * The default-off proof on one lexicon without the new fields: extract(lex, t) deep-equals
 * extract(lex, t, {includeHeard: true, pendingIds: []}), and extractInContext(lex, t, null) is
 * {captures: extract(lex, t), pending: null, carry: {applied: false, refused: null}}.
 */
async function defaultOff(c, x, lex, texts, where) {
  let i = 0;
  for (const text of texts) {
    const at = `${where}/${i}`;
    attempt(c, at, { text }, () => {
      const base = x.extract(lex, text);
      same(c, base, x.extract(lex, text, { includeHeard: true, pendingIds: [] }), `${at}/extract`, { text });
      same(c, { captures: base, pending: null, carry: { applied: false, refused: null } }, x.extractInContext(lex, text, null), `${at}/extractInContext`, { text });
    });
    i += 1;
    if (i % 500 === 0) await tick();
  }
  return i;
}

// ----------------------------------------------------------------------- block 1: fixture lexicon

/** The generic fixture lexicon of block 1: neutral ids and words, every new field. */
const FIXTURE = {
  version: "0.0.1-fixture",
  lang: "en-US",
  negation: { window: 14, cues: ["no ", "not ", "n't", "never"] },
  thirdParty: { window: 30, cues: ["my cousin", "her "] },
  historical: { window: 30, cues: ["used to", "years ago"] },
  bool: [{ id: "b_gamma", ph: ["gamma sign", "gamma alpha mark"] }],
  ctx: [{ id: "c_delta", val: "yes", ph: ["delta note"] }],
  scale: [
    { id: "s_alpha", cue: ["alpha", "omicron"],
      bands: [{ ph: ["short span", "brief span", "two units", "a span of two"], v: 1 }, { ph: ["long span", "span", "units"], v: 2 }],
      fallback: null, heard: true, carry: 2 },
    { id: "s_beta", cue: ["persists", "keeps on"], bands: [{ ph: ["short span"], v: 1 }, { ph: ["long span"], v: 2 }],
      fallback: null, yieldTo: ["s_alpha"], anchor: ["beta mark"] },
    { id: "s_zeta", cue: ["zeta"], bands: [{ ph: ["long span"], v: 2 }], fallback: null, heard: true, carry: 1 },
    { id: "s_eps", cue: ["epsilon"], bands: [{ ph: ["long span"], v: 2 }], fallback: null },
  ],
  multi: [],
  redFlags: { f_omega: ["omega event"] },
  carryRefuse: ["ago"],
};
const fixture = (mutate) => { const lex = clone(FIXTURE); if (mutate) mutate(lex); return lex; };
const entryOf = (lex, id) => lex.scale.find((e) => e.id === id);
const withNormalize = (normalize) => (lex) => { lex.normalize = normalize; };
/** s_alpha.carryExclude (R3a, R10, R11): a v 2 phrase and a v 1 phrase that holds a shorter v 2 phrase. */
const withCarryExclude = (lex) => { entryOf(lex, "s_alpha").carryExclude = ["units", "brief span"]; };
/**
 * One phrase holding a number word in each family that runs on the folded text (R4): yes/no,
 * context, red-flag, scale cue and anchor phrases, and (review T9) a cue of s_alpha, which is
 * s_beta's yield target and the pending entry of P0, and a carryRefuse phrase.
 */
const withNumberWords = (lex) => {
  lex.bool[0].ph.push("two gamma");
  lex.ctx[0].ph.push("three deltas");
  lex.redFlags.f_omega.push("omega on one side", "can't omega");
  const eps = entryOf(lex, "s_eps");
  eps.cue.push("twelve times");
  eps.fallback = 1;
  entryOf(lex, "s_beta").anchor.push("two marks");
  entryOf(lex, "s_alpha").cue.push("eleven thetas");
  lex.carryRefuse.push("one time");
};

/** The slot "I feel alpha today" arms on the fixture. */
const P0 = Object.freeze({ id: "s_alpha", cue: "alpha", cueText: "alpha", evidence: "I feel alpha today", cueIndex: 7, turnsLeft: 2 });
const P1 = ["s_alpha", 1];
const CARRIED_FROM_P0 = { cue: "alpha", cueText: "alpha", evidence: "I feel alpha today", cueIndex: 7 };
/** P0 as a yield-only slot (round 3b), and the brief forms of a yield-only s_alpha slot. */
const Y0 = Object.freeze({ ...P0, yieldOnly: true });
const Y1 = ["s_alpha", 1, YIELD_ONLY];
const Y2 = ["s_alpha", 2, YIELD_ONLY];

// [label, text, opts, expected capture tags] on the fixture.
const EXTRACT_CASES = [
  ["heard/off-by-default", "I feel Alpha today", {}, []],
  ["heard/on", "I feel Alpha today", { includeHeard: true }, ["s_alpha=heard"]],
  ["heard/band-sets-a-value", "alpha for a long span", { includeHeard: true }, ["s_alpha=2"]],
  ["heard/negated-cue", "not alpha", { includeHeard: true }, []],
  ["heard/third-party", "my cousin has alpha", { includeHeard: true }, []],
  ["heard/third-party/includeSuppressed", "my cousin has alpha", { includeHeard: true, includeSuppressed: true }, ["s_alpha=heard [third-party]"]],
  ["heard/third-party/includeSuppressed-without-includeHeard", "my cousin has alpha", { includeSuppressed: true }, []],
  ["heard/historical", "it used to be alpha", { includeHeard: true }, []],
  ["heard/historical/includeSuppressed", "it used to be alpha", { includeHeard: true, includeSuppressed: true }, ["s_alpha=heard [historical]"]],
  ["yield/target-present", "alpha and it persists for a long span", {}, ["s_alpha=2"]],
  ["yield/target-present/includeSuppressed", "alpha and it persists for a long span", { includeSuppressed: true }, ["s_alpha=2", "s_beta=2 [yield]"]],
  ["yield/target-absent", "it persists for a long span", {}, ["s_beta=2"]],
  ["yield/anchored", "alpha, and the beta mark persists for a long span", {}, ["s_alpha=2", "s_beta=2"]],
  ["yield/negated-anchor", "alpha, not the beta mark, it persists for a long span", {}, ["s_alpha=2"]],
  ["yield/negated-anchor/includeSuppressed", "alpha, not the beta mark, it persists for a long span", { includeSuppressed: true }, ["s_alpha=2", "s_beta=2 [yield]"]],
  ["yield/negated-target-still-present", "not alpha, but it persists for a long span", {}, []],
  ["yield/negated-target-still-present/includeSuppressed", "not alpha, but it persists for a long span", { includeSuppressed: true }, ["s_beta=2 [yield]"]],
  ["yield/pending-target", "it persists for a long span", { pendingIds: ["s_alpha"] }, []],
  ["yield/pending-target/includeSuppressed", "it persists for a long span", { pendingIds: ["s_alpha"], includeSuppressed: true }, ["s_beta=2 [yield]"]],
  ["yield/pending-other-id", "it persists for a long span", { pendingIds: ["s_zeta"] }, ["s_beta=2"]],
];

// [label, text, opts, expected capture tags] on the fixture: band choice for a heard entry (s_alpha).
// Round 2 (design 05 §12.4) took a value only when the live spans agreed (R2) and none when a
// carryRefuse phrase occurred in the utterance (R3b). Round 3 (R9, §13.2) replaces both: after the
// spans strictly inside a longer span are dropped, ANY span negated within the window, a carryRefuse
// phrase, or two distinct values withhold the value; a negated span no longer drops out and lets the
// others decide. An entry without heard (s_beta) keeps the first band in band order, without band
// negation, byte for byte.
const BAND_CHOICE_CASES = [
  ["R2/spans-agree", "alpha, a long span, units", {}, ["s_alpha=2"]],
  ["R2/spans-disagree", "alpha for a short span then a long span", {}, []],
  ["R2/spans-disagree/includeHeard", "alpha for a short span then a long span", { includeHeard: true }, ["s_alpha=heard"]],
  ["R2/spans-disagree/order-reversed", "alpha for a long span then a short span", { includeHeard: true }, ["s_alpha=heard"]],
  ["R2/contained-span-dropped", "alpha in a brief span", {}, ["s_alpha=1"]],
  // R9 b: round 2 dropped the negated "short span" and took 2 from "long span".
  ["R9b/a-negated-span-withholds-the-value", "alpha, not a short span but a long span", {}, []],
  ["R9b/a-negated-span-withholds-the-value/includeHeard", "alpha, not a short span but a long span", { includeHeard: true }, ["s_alpha=heard"]],
  ["R9b/hedge-with-a-negation-word", "alpha, I don't know, a short span or a long span", { includeHeard: true }, ["s_alpha=heard"]],
  ["R2/every-span-negated", "alpha, never a long span", { includeHeard: true }, ["s_alpha=heard"]],
  // Review T2: contained spans are dropped BEFORE the negation test. "span" lies inside the negated
  // "brief span" and goes with it; testing negation first would leave "span" live (outside the
  // window of "not ") and take 2.
  ["R9a/contained-span-of-a-negated-span-is-dropped-first (T2)", "alpha, not really a brief span", { includeHeard: true }, ["s_alpha=heard"]],
  ["R2/cue-utterance-keeps-the-window", "alpha, and not that it matters, a short span", {}, ["s_alpha=1"]],
  // Review T3: opts.negationWindow governs the band negation of a heard entry, in both directions.
  ["R9b/default-window-negates (T3)", "alpha, not a long span", { includeHeard: true }, ["s_alpha=heard"]],
  ["R9b/negationWindow-0-negates-nothing (T3)", "alpha, not a long span", { includeHeard: true, negationWindow: 0 }, ["s_alpha=2"]],
  ["R9b/a-wider-negationWindow-negates (T3)", "alpha, and not that it matters, a short span", { includeHeard: true, negationWindow: 40 }, ["s_alpha=heard"]],
  // R11 (§13.4): without carryExclude, every band phrase counts anywhere in the utterance.
  ["R11/without-carryExclude-every-phrase-has-line-scope", "alpha. It was 20 units", { includeHeard: true }, ["s_alpha=2"]],
  ["R2/spans-disagree/third-party/includeSuppressed", "my cousin has alpha, a short span or a long span", { includeHeard: true, includeSuppressed: true },
    ["s_alpha=heard [third-party]"]],
  ["R2/spans-disagree/yielding-entry-keeps-band-order", "alpha for a short span then a long span, it persists", { includeHeard: true, includeSuppressed: true },
    ["s_alpha=heard", "s_beta=1 [yield]"]],
  // The carryRefuse onset guard (R3b in round 2, R9 c in round 3).
  ["R3b/onset-guard", "alpha for a long span ago", { includeHeard: true }, ["s_alpha=heard"]],
  ["R3b/onset-guard/without-includeHeard", "alpha for a long span ago", {}, []],
  ["R3b/guard-phrase-before-the-cue", "a while ago I got alpha for a long span", { includeHeard: true }, ["s_alpha=heard"]],
  ["R3b/entry-without-heard-unaffected", "it persists for a long span ago", {}, ["s_beta=2"]],
  ["R2/entry-without-heard-keeps-band-order", "it persists for a long span then a short span", {}, ["s_beta=1"]],
  ["R2/entry-without-heard-bands-not-negated", "it persists, not a short span but a long span", {}, ["s_beta=1"]],
];

// [label, mutate(lexicon), text, opts, expected capture tags] on a variant of the fixture.
const VARIANT_CASES = [
  ["heard/flag-false", (l) => { entryOf(l, "s_alpha").heard = false; }, "I feel Alpha today", { includeHeard: true }, []],
  ["heard/flag-not-boolean", (l) => { entryOf(l, "s_alpha").heard = "yes"; }, "I feel Alpha today", { includeHeard: true }, []],
  ["heard/fallback-sets-a-value", (l) => { entryOf(l, "s_alpha").fallback = 1; }, "alpha", { includeHeard: true }, ["s_alpha=1"]],
  ["heard/yielding-entry-is-not-heard", (l) => { entryOf(l, "s_beta").heard = true; }, "alpha and it persists", { includeHeard: true }, ["s_alpha=heard"]],
  ["heard/yielding-entry-heard-without-its-target", (l) => { entryOf(l, "s_beta").heard = true; }, "it persists", { includeHeard: true }, ["s_beta=heard"]],
  ["yield/yes-no-target", (l) => { entryOf(l, "s_beta").yieldTo = ["b_gamma"]; }, "the gamma sign shows and it persists for a long span", {}, ["b_gamma=yes"]],
  ["yield/yes-no-target-absent", (l) => { entryOf(l, "s_beta").yieldTo = ["b_gamma"]; }, "it persists for a long span", {}, ["s_beta=2"]],
  ["R2/spans-disagree/fallback-applies", (l) => { entryOf(l, "s_alpha").fallback = 3; }, "alpha for a short span then a long span", { includeHeard: true }, ["s_alpha=3"]],
  ["R3b/no-carryRefuse-no-guard", (l) => { delete l.carryRefuse; }, "alpha for a long span ago", {}, ["s_alpha=2"]],
  ["R3a/excluded-phrase-sets-a-value-in-the-cue-utterance", withCarryExclude, "alpha for 20 units", {}, ["s_alpha=2"]],
  ["R3a/excluded-phrase-still-holds-its-contained-span", withCarryExclude, "alpha in a brief span", {}, ["s_alpha=1"]],
  // R11 (§13.4, as corrected in §13.11): a carryExclude span supplies a value only in a cue sentence,
  // one holding an unnegated, ungated hit of any of the entry's cues; elsewhere it supplies nothing
  // but still counts for the negation and agreement tests. A sentence ends at . ! ? ; followed by
  // whitespace or the end of the text.
  ["R11/excluded-span-in-another-sentence-gives-no-value", withCarryExclude, "alpha. It was 20 units", { includeHeard: true }, ["s_alpha=heard"]],
  ["R11/semicolon-ends-a-sentence", withCarryExclude, "alpha; 20 units", { includeHeard: true }, ["s_alpha=heard"]],
  ["R11/exclamation-mark-ends-a-sentence", withCarryExclude, "alpha! 20 units", { includeHeard: true }, ["s_alpha=heard"]],
  ["R11/question-mark-ends-a-sentence", withCarryExclude, "20 units? alpha", { includeHeard: true }, ["s_alpha=heard"]],
  ["R11/abbreviation-before-a-space-ends-a-sentence", withCarryExclude, "alpha, e.g. 20 units", { includeHeard: true }, ["s_alpha=heard"]],
  ["R11/period-without-whitespace-ends-nothing", withCarryExclude, "alpha.20 units", { includeHeard: true }, ["s_alpha=2"]],
  ["R11/decimal-ends-nothing", withCarryExclude, "alpha 2.5 units", { includeHeard: true }, ["s_alpha=2"]],
  // Every sentence with a cue hit counts, not only that of the hit the entry opened on (the first
  // cue phrase in list order, "alpha"): "omicron" is a cue too (review ENG-R11-2; round 3: heard).
  ["R11/any-cue-sentence-counts (ENG-R11-2)", withCarryExclude, "omicron for 20 units. alpha", { includeHeard: true }, ["s_alpha=2"]],
  // A negated or attributed cue hit makes no cue sentence.
  ["R11/a-negated-cue-hit-makes-no-cue-sentence", withCarryExclude, "alpha. not omicron for 20 units", { includeHeard: true }, ["s_alpha=heard"]],
  ["R11/an-attributed-cue-hit-makes-no-cue-sentence", withCarryExclude, "alpha. my cousin has omicron for 20 units", { includeHeard: true }, ["s_alpha=heard"]],
  // An excluded span elsewhere still holds the shorter span inside it ("span" in "brief span").
  ["R11/an-excluded-span-elsewhere-still-holds-its-contained-span", withCarryExclude, "alpha. a brief span", { includeHeard: true }, ["s_alpha=heard"]],
  ["R11/other-band-phrases-keep-line-scope", withCarryExclude, "alpha. It was a long span", {}, ["s_alpha=2"]],
  ["R11/an-agreeing-excluded-span-elsewhere-leaves-the-value", withCarryExclude, "alpha. It was 20 units, a long span", {}, ["s_alpha=2"]],
  ["R9d/excluded-span-in-the-cue-sentence-disagrees", withCarryExclude, "alpha for 20 units and a short span", { includeHeard: true }, ["s_alpha=heard"]],
  // An excluded span elsewhere still disagrees (review F-R11-OVER72). Round 3 ignored it and took 1;
  // round 2 gave heard, no value, as here.
  ["R11/an-excluded-span-elsewhere-still-disagrees (F-R11-OVER72)", withCarryExclude, "alpha, a short span. 20 units", {}, []],
  ["R11/an-excluded-span-elsewhere-still-disagrees/includeHeard", withCarryExclude, "alpha, a short span. 20 units", { includeHeard: true }, ["s_alpha=heard"]],
  ["R11/an-excluded-span-elsewhere-negated-withholds", withCarryExclude, "alpha, a long span. not 20 units", { includeHeard: true }, ["s_alpha=heard"]],
];

// [label, text, the one expected heard capture (key order and the absence of `value` included)].
const HEARD_SHAPES = [
  ["patient-casing", "I feel Alpha today",
    { id: "s_alpha", kind: "heard", evidence: "I feel Alpha today", cueIndex: 7, cue: "alpha", cueText: "Alpha" }],
  ["first-cue-in-list-order", "Omicron, then alpha",
    { id: "s_alpha", kind: "heard", evidence: "Omicron, then alpha", cueIndex: 14, cue: "alpha", cueText: "alpha" }],
  ["second-cue", "Omicron again",
    { id: "s_alpha", kind: "heard", evidence: "Omicron again", cueIndex: 0, cue: "omicron", cueText: "Omicron" }],
];

const after = (captures, pending, refused, applied = false) => ({ captures, pending, applied, refused });
const carryCap = (value, evidence, cueIndex, band) => ({ id: "s_alpha", value, kind: "item", evidence, cueIndex, via: "carry", band, carriedFrom: CARRIED_FROM_P0 });

// [label, text, pending slot, expected brief result, {pending?: full slot, capture?: full last capture}].
const CONTEXT_CASES = [
  ["arm", "I feel alpha today", null, after(["s_alpha=heard"], ["s_alpha", 2], null), { pending: { ...P0 } }],
  ["carry/applied", "for a long span", P0, after(["s_alpha=2 via carry"], null, null, true),
    { capture: carryCap(2, "for a long span", 6, "long span") }],
  ["carry/contained-span-dropped", "just a short span", P0, after(["s_alpha=1 via carry"], null, null, true),
    { capture: carryCap(1, "just a short span", 7, "short span") }],
  ["carry/earliest-span", "a long span and a long span", P0, after(["s_alpha=2 via carry"], null, null, true),
    { capture: carryCap(2, "a long span and a long span", 2, "long span") }],
  // R10 (§13.3): any negated span refuses the whole reply. Round 2 skipped the negated span and
  // carried the other one (2, 1 and 1 on these three); round 1 did the same on the first two and
  // refused the third as ambiguous ("long span" lies outside the window of "not ").
  ["refused/negated/any-negated-span-refuses-the-reply (R10)", "a long span, not a short span", P0, after([], P1, "negated")],
  ["refused/negated/a-later-negated-span (R10)", "a short span, not 20 units", P0, after([], P1, "negated")],
  ["refused/negated/hedge-with-a-negation-word (R10)", "a short span, I'm not sure, maybe a long span", P0, after([], P1, "negated")],
  // R1 (§12.2), kept by R10: a span is negated by a negation cue in the window before it or anywhere
  // in the reply before it. Round 1 carried v 2 from the first text below (the span "long span" lay
  // outside the window of "not ").
  ["carry/negation-anywhere-before-the-span (R1)", "not a short span, more a long span", P0, after([], P1, "negated")],
  ["carry/negation-outside-the-window (R1)", "it doesn't seem to be a long span", P0, after([], P1, "negated")],
  ["carry/yielding-entry-is-no-topic", "it persists for a long span", P0, after(["s_alpha=2 via carry"], null, null, true)],
  ["carry/turnsLeft-clamped", "for a long span", { ...P0, turnsLeft: 9 }, after(["s_alpha=2 via carry"], null, null, true)],
  ["refused/answered", "alpha for a long span", P0, after(["s_alpha=2"], null, "answered")],
  ["refused/own-cue-refreshes", "The ALPHA again", P0, after(["s_alpha=heard"], ["s_alpha", 2], "own-cue"),
    { pending: { id: "s_alpha", cue: "alpha", cueText: "ALPHA", evidence: "The ALPHA again", cueIndex: 4, turnsLeft: 2 } }],
  ["refused/own-cue-negated", "not alpha for a long span", P0, after([], P1, "own-cue"), { pending: { ...P0, turnsLeft: 1 } }],
  ["refused/other-entry/yes-no", "the gamma sign, for a long span", P0, after(["b_gamma=yes"], P1, "other-entry")],
  ["refused/other-entry/red-flag", "an omega event for a long span", P0, after(["f_omega=true"], P1, "other-entry")],
  ["refused/other-entry/context", "a delta note for a long span", P0, after(["c_delta=yes"], P1, "other-entry")],
  ["refused/other-entry/scale-cue", "the zeta for a long span", P0, after(["s_zeta=2"], P1, "other-entry")],
  ["refused/other-entry/anchored-yielding-entry", "the beta mark persists for a long span", P0, after(["s_beta=2"], P1, "other-entry")],
  ["refused/question", "for a long span?", P0, after([], P1, "question")],
  ["refused/question-inverted-mark", "¿for a long span", P0, after([], P1, "question")],
  ["refused/question-before-refuse-phrase", "a long span ago?", P0, after([], P1, "question")],
  ["refused/refuse-phrase", "a long span ago", P0, after([], P1, "refuse-phrase")],
  ["refused/no-band", "okay then", P0, after([], P1, "no-band")],
  ["refused/negated", "not for a long span", P0, after([], P1, "negated")],
  ["refused/ambiguous", "a short span or a long span", P0, after([], P1, "ambiguous")],
  ["refused/third-party", "my cousin has it for a long span", P0, after([], P1, "third-party")],
  ["refused/historical", "it used to be a long span", P0, after([], P1, "historical")],
  ["clamp/turnsLeft", "okay", { ...P0, turnsLeft: 9 }, after([], P1, "no-band")],
  ["slot/turnsLeft-0", "for a long span", { ...P0, turnsLeft: 0 }, after([], null, null)],
  ["slot/turnsLeft-negative", "for a long span", { ...P0, turnsLeft: -1 }, after([], null, null)],
  ["slot/turnsLeft-fraction", "for a long span", { ...P0, turnsLeft: 1.5 }, after([], null, null)],
  ["slot/turnsLeft-string", "for a long span", { ...P0, turnsLeft: "2" }, after([], null, null)],
  ["slot/entry-without-carry", "for a long span", { ...P0, id: "s_eps" }, after([], null, null)],
  ["slot/unknown-entry", "for a long span", { ...P0, id: "zz_missing" }, after([], null, null)],
  ["slot/not-an-object", "for a long span", "s_alpha", after([], null, null)],
  ["slot/none", "for a long span", null, after([], null, null)],
  ["supersede/entry-without-carry", "the epsilon thing", P0, after([], null, "other-entry")],
  ["supersede/another-carry-entry", "a zeta now", P0, after(["s_zeta=heard"], ["s_zeta", 1], "other-entry"),
    { pending: { id: "s_zeta", cue: "zeta", cueText: "zeta", evidence: "a zeta now", cueIndex: 2, turnsLeft: 1 } }],
  ["supersede/anchored-cue-without-value", "the beta mark persists", P0, after([], null, "other-entry")],
  ["clear/two-unresolved", "alpha and epsilon", null, after(["s_alpha=heard"], null, null)],
  ["clear/two-unresolved-with-slot", "alpha and epsilon", P0, after(["s_alpha=heard"], null, "own-cue")],
  ["no-arm/embedded-cue", "the gamma alpha mark", null, after(["b_gamma=yes", "s_alpha=heard"], null, null)],
  ["no-arm/embedded-cue-with-slot", "the gamma alpha mark", P0, after(["b_gamma=yes", "s_alpha=heard"], null, "own-cue")],
  ["no-arm/entry-without-carry", "it persists", null, after([], null, null)],
  ["arm/yielded-entry-is-not-unresolved", "alpha and it persists", null, after(["s_alpha=heard"], ["s_alpha", 2], null),
    { pending: { id: "s_alpha", cue: "alpha", cueText: "alpha", evidence: "alpha and it persists", cueIndex: 0, turnsLeft: 2 } }],
  ["slot/cross-turn-yield-keeps-the-slot", "it persists", P0, after([], P1, "no-band")],
  // R9 f (§13.2) with round 3b (§13.10, §13.11): a band stated in the cue's own utterance but withheld
  // (two values, a negated span, a carryRefuse phrase) leaves the entry heard and opens no carry-over:
  // it arms a yield-only slot (rule 3d), and an open slot of the entry turns yield-only and is
  // refreshed from this utterance with the full carry (rule 3b). Round 3 armed nothing and closed the
  // open slot; round 2 armed or refreshed a normal slot on each of these. An utterance with no band
  // span still arms a normal slot ("arm").
  ["yield-only/spans-disagree (R9 d, f; 3b)", "alpha for a short span then a long span", null, after(["s_alpha=heard"], Y2, null),
    { pending: { id: "s_alpha", cue: "alpha", cueText: "alpha", evidence: "alpha for a short span then a long span", cueIndex: 0, turnsLeft: 2, yieldOnly: true } }],
  ["yield-only/onset-guard (R9 c, f; 3b)", "alpha for a long span ago", null, after(["s_alpha=heard"], Y2, null)],
  ["yield-only/negated-span (R9 b, f; 3b)", "alpha, not a long span", null, after(["s_alpha=heard"], Y2, null)],
  ["yield-only/contained-span-of-a-negated-span (R9 a, b, f; 3b)", "alpha, not really a brief span", null, after(["s_alpha=heard"], Y2, null)],
  ["refused/own-cue/spans-disagree-turns-the-slot-yield-only (R9 f; 3b)", "alpha for a short span then a long span", P0, after(["s_alpha=heard"], Y2, "own-cue"),
    { pending: { id: "s_alpha", cue: "alpha", cueText: "alpha", evidence: "alpha for a short span then a long span", cueIndex: 0, turnsLeft: 2, yieldOnly: true } }],
  ["refused/own-cue/onset-guard-turns-the-slot-yield-only (R9 f; 3b)", "alpha for a long span ago", P0, after(["s_alpha=heard"], Y2, "own-cue")],
  ["refused/own-cue/negated-span-turns-the-slot-yield-only (R9 f; 3b)", "alpha, not a long span", P0, after(["s_alpha=heard"], Y2, "own-cue")],
  // Another entry withheld (s_zeta, its one band negated) ends the open normal slot and arms its own
  // yield-only slot (rule 3c, §13.12). Round 3c kept the normal slot, so the next reply could be
  // carried into s_alpha; round 2 armed a normal s_zeta slot over it.
  ["supersede/withheld-entry-supersedes-a-normal-slot (R9 f; rule 3c, §13.12)", "a zeta, not a long span", P0,
    after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], "other-entry"),
    { pending: { id: "s_zeta", cue: "zeta", cueText: "zeta", evidence: "a zeta, not a long span", cueIndex: 2, turnsLeft: 1, yieldOnly: true } }],
];

// [label, text, pending, expected brief result with s_alpha.carryExclude, the same without it,
// {capture?: full carried capture}]. In a carried reply (R10, §13.3, replacing the collection rule of
// R3a, §12.3) an excluded phrase never supplies the value, but it is collected: it holds the shorter
// spans inside it, it counts for the negation, ambiguity and attribution refusals, and a reply whose
// only spans are excluded has no band. In the cue's own utterance (R11, §13.4 and §13.11; pending
// null) it supplies a value only in a cue sentence; elsewhere it is still a stated band, so the
// entry is withheld and arms only a yield-only slot.
const CARRY_EXCLUDE_CASES = [
  ["excluded-phrase-never-carries", "20 units", P0, after([], P1, "no-band"), after(["s_alpha=2 via carry"], null, null, true)],
  // Round 2 did not collect "brief span" and carried 2 from the "span" inside it.
  ["excluded-phrase-still-holds-its-contained-span", "a brief span", P0, after([], P1, "no-band"), after(["s_alpha=1 via carry"], null, null, true)],
  ["other-phrases-still-carry", "two units", P0, after(["s_alpha=1 via carry"], null, null, true),
    after(["s_alpha=1 via carry"], null, null, true), { capture: carryCap(1, "two units", 0, "two units") }],
  // Review F1 on the fixture: round 2 carried 1 here.
  ["excluded-phrase-makes-a-reply-ambiguous (R10)", "a short span, 20 units", P0, after([], P1, "ambiguous"), after([], P1, "ambiguous")],
  // An excluded span that agrees: the value is carried from the span that is not excluded.
  ["excluded-and-carried-spans-agree (R10)", "20 units, a long span", P0, after(["s_alpha=2 via carry"], null, null, true),
    after(["s_alpha=2 via carry"], null, null, true), { capture: carryCap(2, "20 units, a long span", 12, "long span") }],
  // Round 2 carried 1 here (the negated excluded span was not collected).
  ["excluded-phrase-negated-refuses-the-reply (R10)", "a short span, not 20 units", P0, after([], P1, "negated"), after([], P1, "negated")],
  // Round 2 carried 2 here (the attributed excluded span was not collected).
  ["excluded-span-counts-for-attribution (R10)", "a long span, my cousin has 20 units", P0, after([], P1, "third-party"), after([], P1, "third-party")],
  // Round 3 ignored the excluded span here and armed a normal slot.
  ["R11/excluded-span-in-another-sentence-arms-only-a-yield-only-slot", "alpha. It was 20 units", null, after(["s_alpha=heard"], Y2, null),
    after(["s_alpha=2"], null, null)],
  ["R11/an-excluded-span-elsewhere-holds-its-contained-span-yield-only", "alpha. a brief span", null, after(["s_alpha=heard"], Y2, null),
    after(["s_alpha=1"], null, null)],
  // Withheld, so only a yield-only slot arms (R9 d, f; round 3b).
  ["R11/excluded-span-in-the-cue-sentence-disagrees-yield-only (R9 d, f; 3b)", "alpha for 20 units and a short span", null, after(["s_alpha=heard"], Y2, null),
    after(["s_alpha=heard"], Y2, null)],
  // Round 3 took 1 here (review F-R11-OVER72).
  ["R11/an-excluded-span-elsewhere-still-disagrees-yield-only", "alpha, a short span. 20 units", null, after(["s_alpha=heard"], Y2, null), after(["s_alpha=heard"], Y2, null)],
];

// [label, text, pending, expected brief result] with opts {carry: false} (R5, §12.6): the slot is
// still validated, consumed, expired, refreshed and superseded, and still counts as present for
// yieldTo; nothing is carried and no refusal is recorded.
const CARRY_OFF_CASES = [
  ["yield-holds", "it persists for a long span", P0, after([], P1, null)],
  ["nothing-carried", "for a long span", P0, after([], P1, null)],
  ["no-refusal-recorded", "for a long span?", P0, after([], P1, null)],
  ["an-answer-keeps-the-slot", "alpha for a long span", P0, after(["s_alpha=2"], P1, null)],
  ["expiry", "for a long span", { ...P0, turnsLeft: 1 }, after([], null, null)],
  ["own-cue-refreshes", "The ALPHA again", P0, after(["s_alpha=heard"], ["s_alpha", 2], null)],
  ["supersede", "a zeta now", P0, after(["s_zeta=heard"], ["s_zeta", 1], null)],
  ["other-entry-still-captured", "the gamma sign, for a long span", P0, after(["b_gamma=yes"], P1, null)],
  ["no-slot", "it persists for a long span", null, after(["s_beta=2"], null, null)],
  ["slot-entry-without-carry", "it persists for a long span", { ...P0, id: "s_eps" }, after(["s_beta=2"], null, null)],
  // R9 f with carry off: a withheld band neither refreshes the slot nor turns it yield-only (round
  // 3b converts only in step 4, which carry off skips); it only consumes a reply.
  ["withheld-only-consumes (R9 f; 3b)", "alpha for a short span then a long span", P0, after(["s_alpha=heard"], P1, null)],
  // A yield-only slot reads the same with carry off and carry on (round 3b).
  ["yield-only-slot (3b)", "for a long span", Y0, after([], Y1, null)],
];

/** s_eps made an entry that may carry (heard, carry 2), for a yield-only slot of a third entry. */
const withCarryingEps = (lex) => { const e = entryOf(lex, "s_eps"); e.heard = true; e.carry = 2; };
/** s_zeta with a two-reply window, so its normal slot outlives the line after it (round 3d). */
const withZetaCarry2 = (lex) => { entryOf(lex, "s_zeta").carry = 2; };
/**
 * The slot "a zeta now" arms under withZetaCarry2. s_zeta follows s_alpha in scale order, so when
 * both are withheld it is never the first withheld id (review round 2 of the integration).
 */
const Z0 = Object.freeze({ id: "s_zeta", cue: "zeta", cueText: "zeta", evidence: "a zeta now", cueIndex: 2, turnsLeft: 2 });
// [label, mutate(fixture) | null, text, pending slot, opts, expected brief result, {pending?: full slot}]
// (round 3b, design 05 §13.10): the yield-only slot and every rule of the engine's "Slots" header.
// Step 1 accepts yieldOnly only as a boolean; step 4 never carries for a yield-only slot and records
// no refusal; step 6 decides by rules 1 (normal slot), 2 (clear) and 3a-3e (withheld entries).
const YIELD_ONLY_CASES = [
  ["step1/yieldOnly-string-drops-the-slot", null, "for a long span", { ...P0, yieldOnly: "yes" }, {}, after([], null, null)],
  ["step1/yieldOnly-null-drops-the-slot", null, "for a long span", { ...P0, yieldOnly: null }, {}, after([], null, null)],
  ["step1/yieldOnly-number-drops-the-slot", null, "for a long span", { ...P0, yieldOnly: 1 }, {}, after([], null, null)],
  ["step1/yieldOnly-false-is-a-normal-slot", null, "for a long span", { ...P0, yieldOnly: false }, {}, after(["s_alpha=2 via carry"], null, null, true)],
  ["step4/never-carries", null, "for a long span", Y0, {}, after([], Y1, null), { pending: { ...P0, turnsLeft: 1, yieldOnly: true } }],
  ["step4/no-refusal/question", null, "for a long span?", Y0, {}, after([], Y1, null)],
  ["step4/no-refusal/no-band", null, "okay then", Y0, {}, after([], Y1, null)],
  ["step4/no-refusal/negated", null, "not for a long span", Y0, {}, after([], Y1, null)],
  ["step4/an-answer-keeps-it (as with carry off)", null, "alpha for a long span", Y0, {}, after(["s_alpha=2"], Y1, null)],
  ["step4/carry-option-ignored", null, "for a long span", Y0, { carry: true }, after([], Y1, null)],
  ["keeps-the-yield", null, "it persists for a long span", Y0, {}, after([], Y1, null)],
  ["step5/expires", null, "okay", { ...Y0, turnsLeft: 1 }, {}, after([], null, null)],
  ["step1/turnsLeft-clamped", null, "okay", { ...Y0, turnsLeft: 9 }, {}, after([], Y1, null)],
  ["rule1/heard-again-re-arms-a-normal-slot", null, "The ALPHA again", Y0, {}, after(["s_alpha=heard"], ["s_alpha", 2], null),
    { pending: { id: "s_alpha", cue: "alpha", cueText: "ALPHA", evidence: "The ALPHA again", cueIndex: 4, turnsLeft: 2 } }],
  ["rule1/another-entry-that-may-carry-supersedes-it", null, "a zeta now", Y0, {}, after(["s_zeta=heard"], ["s_zeta", 1], null)],
  ["rule2/an-entry-without-carry-clears-it", null, "the epsilon thing", Y0, {}, after([], null, null)],
  ["rule2/two-unresolved-clear-it", null, "alpha and epsilon", Y0, {}, after(["s_alpha=heard"], null, null)],
  // s_beta yields to the pending s_alpha, so it is not unresolved and does not clear the slot it
  // yields to; anchored, it does not yield and clears it.
  ["rule2/a-yielding-cue-does-not-clear-it", null, "it persists", Y0, {}, after([], Y1, null)],
  ["rule2/an-anchored-cue-clears-it", null, "the beta mark persists", Y0, {}, after([], null, null)],
  // Rule 3b (§13.11): a yield-only slot of a withheld entry is refreshed from this utterance with the
  // full carry (round 3b kept its remaining count, review F-3B-REMAINING-COUNT).
  ["rule3b/withheld-again-refreshes-the-yield-only-slot", null, "alpha for a short span then a long span", Y0, {}, after(["s_alpha=heard"], Y2, null),
    { pending: { id: "s_alpha", cue: "alpha", cueText: "alpha", evidence: "alpha for a short span then a long span", cueIndex: 0, turnsLeft: 2, yieldOnly: true } }],
  ["rule3b/two-withheld-refresh-the-slot-of-one-of-them", null, "alpha and zeta, not a long span", Y0, {}, after(["s_alpha=heard", "s_zeta=heard"], Y2, null)],
  // The same with the slot of the entry that is not first among the withheld (review round 2 of the
  // integration): the slot's own entry is refreshed, from its own cue, not the first withheld entry.
  ["rule3b/two-withheld-refresh-the-slot-of-the-second-of-them", withZetaCarry2, "alpha and zeta, not a long span", { ...Z0, yieldOnly: true }, {},
    after(["s_alpha=heard", "s_zeta=heard"], ["s_zeta", 2, YIELD_ONLY], null),
    { pending: { id: "s_zeta", cue: "zeta", cueText: "zeta", evidence: "alpha and zeta, not a long span", cueIndex: 10, turnsLeft: 2, yieldOnly: true } }],
  // Rule 3c (round 3d, §13.12): a withheld entry ends a normal slot of another entry, replaced by its
  // yield-only slot (one id) or cleared (two or more), also when read with carry off. Round 3c kept
  // the normal slot on each of these lines; round 2 armed the withheld entry over it, or cleared it.
  ["rule3c/withheld-replaces-a-normal-slot-of-another-entry", null, "a zeta, not a long span", P0, {},
    after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], "other-entry"),
    { pending: { id: "s_zeta", cue: "zeta", cueText: "zeta", evidence: "a zeta, not a long span", cueIndex: 2, turnsLeft: 1, yieldOnly: true } }],
  ["rule3c/two-withheld-clear-a-normal-slot-of-a-third-entry", withCarryingEps, "zeta and epsilon, not a long span", P0, {},
    after(["s_zeta=heard", "s_eps=heard"], null, "other-entry")],
  ["rule3c/read-with-carry-off-it-ends-too", null, "a zeta, not a long span", P0, { carry: false },
    after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], null)],
  // A normal slot of a withheld entry (read with carry off) is the one rule 3 keeps, beside another
  // withheld entry too.
  ["rule3b/a-normal-slot-of-a-withheld-entry-stays-beside-another (carry off)", null, "alpha and zeta, not a long span", P0, { carry: false },
    after(["s_alpha=heard", "s_zeta=heard"], P1, null)],
  ["rule3b/a-normal-slot-of-the-second-withheld-entry-stays (carry off)", withZetaCarry2, "alpha and zeta, not a long span", Z0, { carry: false },
    after(["s_alpha=heard", "s_zeta=heard"], ["s_zeta", 1], null), { pending: { ...Z0, turnsLeft: 1 } }],
  // Recorded follow-ups (§13.12), pinned as the engine behaves. Round 2 cleared the slot on both:
  // it counted the withheld entry as unresolved. Here an unresolved cue beside a withheld one still
  // arms a normal slot (rule 1 counts unresolved ids only), and a withheld entry without carry is
  // ignored by rule 3, so a normal slot of another entry stays open.
  ["rule1/an-unresolved-cue-beside-a-withheld-one-arms-a-normal-slot (follow-up)", null, "zeta, and alpha not a short span", null, {},
    after(["s_alpha=heard", "s_zeta=heard"], ["s_zeta", 1], null)],
  ["rule3a/a-withheld-entry-without-carry-leaves-a-normal-slot (follow-up)", (l) => { delete entryOf(l, "s_zeta").carry; }, "a zeta, not a long span", P0, {},
    after(["s_zeta=heard"], P1, "other-entry")],
  ["rule3d/withheld-replaces-a-yield-only-slot-of-another-entry", null, "a zeta, not a long span", Y0, {}, after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], null),
    { pending: { id: "s_zeta", cue: "zeta", cueText: "zeta", evidence: "a zeta, not a long span", cueIndex: 2, turnsLeft: 1, yieldOnly: true } }],
  // The converted slot expires on this very reply, so no slot is left open and the withheld entry
  // arms a yield-only slot afresh, with its full carry.
  ["rule3d/conversion-on-the-last-reply-arms-afresh", null, "alpha for a short span then a long span", { ...P0, turnsLeft: 1 }, {}, after(["s_alpha=heard"], Y2, "own-cue")],
  // Unlike rule 1 for an unresolved cue, rule 3 does not ask whether the cue lies inside another
  // entry's phrase ("alpha" inside "gamma alpha mark"): a yield-only slot never carries a value.
  ["rule3d/cue-inside-another-phrase-still-arms", null, "the gamma alpha mark, a short span or a long span", null, {}, after(["b_gamma=yes", "s_alpha=heard"], Y2, null)],
  ["rule3/withheld-entry-without-carry-is-ignored", (l) => { delete entryOf(l, "s_zeta").carry; }, "alpha and zeta, not a long span", null, {},
    after(["s_alpha=heard", "s_zeta=heard"], Y2, null)],
  ["rule3e/two-withheld-arm-nothing", null, "alpha and zeta, not a long span", null, {}, after(["s_alpha=heard", "s_zeta=heard"], null, null)],
  ["rule3e/two-withheld-clear-a-yield-only-slot-of-a-third-entry", withCarryingEps, "alpha and zeta, not a long span",
    { id: "s_eps", cue: "epsilon", cueText: "epsilon", evidence: "the epsilon thing", cueIndex: 4, turnsLeft: 2, yieldOnly: true }, {},
    after(["s_alpha=heard", "s_zeta=heard"], null, null)],
  ["rule3d/one-withheld-replaces-a-yield-only-slot-of-a-third-entry", withCarryingEps, "a zeta, not a long span",
    { id: "s_eps", cue: "epsilon", cueText: "epsilon", evidence: "the epsilon thing", cueIndex: 4, turnsLeft: 2, yieldOnly: true }, {},
    after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], null)],
];

/** s_eta, an entry without heard that yields to s_zeta and shares its band phrase (round 3d). */
const withZetaYielder = (lex) => {
  lex.scale.push({ id: "s_eta", cue: ["lingers"], bands: [{ ph: ["long span"], v: 2 }], fallback: null, yieldTo: ["s_zeta"] });
};
/** s_eps made to carry, and s_eta yielding to s_eps instead (round 3d, follow-up F-3D-4). */
const withEpsYielder = (lex) => {
  withCarryingEps(lex);
  lex.scale.push({ id: "s_eta", cue: ["lingers"], bands: [{ ph: ["long span"], v: 2 }], fallback: null, yieldTo: ["s_eps"] });
};
// [label, mutate(fixture) | null, patient replies in order, the expected brief result of each] (R9 f,
// R10, R11, round 3b, round 3d): each reply goes through extractInContext with the slot the previous
// one returned.
const SEQUENCES = [
  ["arm-then-carry", null, ["alpha", "a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_alpha=2 via carry"], null, null, true)]],
  // On the next three, round 2 armed or refreshed the slot on the withheld line and carried 2 from
  // the last reply; round 3 armed nothing or closed the slot. Since round 3b the slot is yield-only
  // (armed afresh, or turned yield-only and refreshed), so nothing is carried and nothing is refused.
  ["withheld-opens-a-yield-only-window (R9 f; 3b)", null, ["alpha a while ago, for a long span", "a long span"],
    [after(["s_alpha=heard"], Y2, null), after([], Y1, null)]],
  ["spans-disagree-turn-the-open-slot-yield-only (R9 f; 3b)", null, ["alpha", "alpha for a short span then a long span", "a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_alpha=heard"], Y2, "own-cue"), after([], Y1, null)]],
  ["onset-guard-turns-the-open-slot-yield-only (R9 f; 3b)", null, ["alpha", "alpha for a long span ago", "a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_alpha=heard"], Y2, "own-cue"), after([], Y1, null)]],
  // Round 3b: the yield-only slot keeps s_beta yielding (round 3 had no slot and recorded s_beta = 2
  // on the second line) until it expires, after `carry` replies as any slot does.
  ["yield-only-slot-keeps-the-yield (3b)", null, ["alpha a while ago, for a long span", "it persists for a long span"],
    [after(["s_alpha=heard"], Y2, null), after([], Y1, null)]],
  ["yield-only-slot-expires (3b)", null, ["alpha a while ago, for a long span", "okay", "okay", "it persists for a long span"],
    [after(["s_alpha=heard"], Y2, null), after([], Y1, null), after([], null, null), after(["s_beta=2"], null, null)]],
  // The entry's cue heard again with no band re-arms a normal slot, which carries (rule 1).
  ["heard-again-re-arms-a-normal-slot (3b rule 1)", null, ["alpha a while ago, for a long span", "alpha again", "a long span"],
    [after(["s_alpha=heard"], Y2, null), after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_alpha=2 via carry"], null, null, true)]],
  // An entry that yields to the pending id is not unresolved, so it does not clear the slot (rule 2);
  // round 3 read "it persists" without a pending id and had no slot to clear.
  ["a-yielding-cue-does-not-clear-it (3b rule 2)", null, ["alpha a while ago, for a long span", "it persists", "it persists for a long span"],
    [after(["s_alpha=heard"], Y2, null), after([], Y1, null), after([], null, null)]],
  // A slot of another entry that is unresolved and may carry supersedes the yield-only slot (rule 1),
  // and a reply then carries into it.
  ["another-entry-re-arms-a-normal-slot (3b rule 1)", null, ["alpha a while ago, for a long span", "a zeta now", "a long span"],
    [after(["s_alpha=heard"], Y2, null), after(["s_zeta=heard"], ["s_zeta", 1], null), after(["s_zeta=2 via carry"], null, null, true)]],
  // A refused reply (here ambiguous) uses up one reply of the window and leaves the rest open.
  ["refused-reply-keeps-the-rest-of-the-window", null, ["alpha", "a short span or a long span", "a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after([], P1, "ambiguous"), after(["s_alpha=2 via carry"], null, null, true)]],
  // R11 (§13.11): the excluded span in the other sentence is a stated band that gives no value, so
  // only a yield-only slot arms and no reply is carried (round 3 armed a normal slot and carried 1).
  ["R11/another-sentence-opens-no-carry", withCarryExclude, ["alpha. It was 20 units", "a short span"],
    [after(["s_alpha=heard"], Y2, null), after([], Y1, null)]],
  // Rule 3b (§13.11): each withheld line refreshes the yield-only slot, so s_beta keeps yielding
  // through `carry` replies after the last one (round 3b let the converted slot run out first).
  ["refreshed-slot-keeps-the-yield (3b rule 3b)", null, ["alpha", "alpha for a long span ago", "okay", "it persists for a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_alpha=heard"], Y2, "own-cue"), after([], Y1, null), after([], null, null)]],

  // Round 3d (§13.12): two entries that may carry, s_alpha and s_zeta, share the band phrase "long
  // span". A line naming one of them with its band withheld ends the other's normal slot (rule 3c), so
  // the reply after it, likely about the withheld entry, is carried into neither. Round 3c kept the
  // other's normal slot and carried that reply into it: s_alpha = 2 on the first sequence, s_zeta = 2
  // on the second. Round 2 armed the withheld entry's normal slot instead and carried the reply into
  // it (s_zeta = 2, then s_alpha = 2); on the third it cleared the slot, as here.
  ["multi-carry/withheld-line-ends-the-other-entrys-window (3c)", null, ["alpha", "a zeta, not a long span", "a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], "other-entry"), after([], null, null)]],
  ["multi-carry/the-other-way-round (3c)", withZetaCarry2, ["zeta", "alpha for a short span then a long span", "a long span"],
    [after(["s_zeta=heard"], ["s_zeta", 2], null), after(["s_alpha=heard"], Y2, "other-entry"), after([], Y1, null)]],
  ["multi-carry/two-withheld-entries-clear-the-window (3c, 3e)", withCarryingEps, ["alpha", "zeta and epsilon, not a long span", "a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_zeta=heard", "s_eps=heard"], null, "other-entry"), after([], null, null)]],
  // The withheld entry's cue heard again with no band re-arms a normal slot of it, which carries
  // (rule 1); round 3c reached the same slot on the third line.
  ["multi-carry/the-withheld-entry-heard-again-carries (3c, rule 1)", null, ["alpha", "a zeta, not a long span", "zeta again", "a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], "other-entry"),
      after(["s_zeta=heard"], ["s_zeta", 1], null), after(["s_zeta=2 via carry"], null, null, true)]],
  // An entry that yields to the withheld entry (s_eta yields to s_zeta) keeps yielding on the next
  // reply: round 3c recorded s_eta = 2 there, and round 2 carried s_zeta = 2.
  ["multi-carry/an-entry-yielding-to-the-withheld-entry-yields (3c)", withZetaYielder, ["alpha", "a zeta, not a long span", "it lingers for a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], "other-entry"), after([], null, null)]],
  // Disclosed (§13.12): an entry that yields to the entry whose slot ended (s_beta yields to s_alpha)
  // no longer yields to it, and records its own value where round 3c carried s_alpha = 2. Round 2
  // recorded s_beta = 2 too when it read the second line with no value (the first sequence); when it
  // took the value (the second: its negated span dropped, the other gave 2) it kept s_alpha's slot
  // and carried s_alpha = 2, as round 3c did.
  ["multi-carry/an-entry-yielding-to-the-ended-entry-records-its-value (3c, disclosed)", null, ["alpha", "a zeta, not a long span", "it persists for a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], "other-entry"), after(["s_beta=2"], null, null)]],
  ["multi-carry/the-same-where-round-2-took-the-value (3c, disclosed)", null, ["alpha", "a zeta, not a long span, a long span", "it persists for a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], "other-entry"), after(["s_beta=2"], null, null)]],
  // Disclosed (§13.12, integration review round 1; follow-up F-3D-4): the effect chains to an entry
  // that does not yield to the ended entry. On the third line s_beta, no longer yielding to s_alpha,
  // is unresolved beside s_eps, so the slot is cleared (rule 2) where rounds 2, 3 and 3c armed s_eps
  // (s_beta yielded). On the fourth, s_eta, which yields to s_eps, records s_eta = 2 where those
  // rounds carried s_eps = 2 and had s_eta yield. Round 2 took s_zeta = 2 on the second line and kept
  // s_alpha's slot, so neither round 2 nor round 3c recorded s_eta = 2.
  ["multi-carry/the-effect-chains-to-an-entry-yielding-to-a-third (3c, disclosed, F-3D-4)", withEpsYielder,
    ["alpha", "a zeta, not a long span, a long span", "it persists and epsilon", "it lingers for a long span"],
    [after(["s_alpha=heard"], ["s_alpha", 2], null), after(["s_zeta=heard"], ["s_zeta", 1, YIELD_ONLY], "other-entry"),
      after(["s_eps=heard"], null, null), after(["s_eta=2"], null, null)]],
];

// [label, text, opts, tags without normalize, tags with normalize {apostrophes: true, numbers: "en"}].
const NORMALIZE_CASES = [
  ["apostrophe/denial", "I don’t feel alpha", { includeHeard: true }, ["s_alpha=heard"], []],
  ["numbers/small-integer", "alpha lasts 2 units", {}, ["s_alpha=2"], ["s_alpha=1"]],
  ["numbers/in-parentheses", "alpha for (2 units)", {}, ["s_alpha=2"], ["s_alpha=1"]],
  ["numbers/mid-sentence", "alpha, 2 units.", {}, ["s_alpha=2"], ["s_alpha=1"]],
  ["numbers/sentence-final-period", "alpha for a span of 2.", {}, ["s_alpha=2"], ["s_alpha=1"]],
  ["numbers/21-to-29-stay-digits", "alpha lasts 22 units", {}, ["s_alpha=2"], ["s_alpha=2"]],
  ["numbers/typed-twenty-two (accepted risk)", "alpha lasts twenty-two units", {}, ["s_alpha=1"], ["s_alpha=1"]],
  ["numbers/decimal", "alpha lasts 2.5 units", {}, ["s_alpha=2"], ["s_alpha=2"]],
  ["numbers/decimal-at-the-end", "alpha for a span of 2.5", {}, ["s_alpha=2"], ["s_alpha=2"]],
  ["numbers/range", "alpha lasts 3-4 units", {}, ["s_alpha=2"], ["s_alpha=2"]],
  ["numbers/minus-sign", "alpha for -2 units", {}, ["s_alpha=2"], ["s_alpha=2"]],
  ["numbers/fraction", "alpha for 1/2 units", {}, ["s_alpha=2"], ["s_alpha=2"]],
  ["numbers/leading-zero", "alpha for 02 units", {}, ["s_alpha=2"], ["s_alpha=2"]],
  ["numbers/touching-a-letter", "alpha for x2 units", {}, ["s_alpha=2"], ["s_alpha=2"]],
  // A typographic apostrophe and a digit in one text (review F2, tests).
  ["mixed/curly-denial-and-digit", "I don’t feel alpha for 2 units", { includeHeard: true }, ["s_alpha=2"], []],
  // R2 with R4: a spelled number joins the band choice of a heard entry ("two units" v 1, "long span" v 2).
  ["R2/spelled-number-joins-the-band-choice", "alpha for 2 units, a long span", {}, ["s_alpha=2"], []],
  // R4 (§12.5): every gate window is measured on the folded text, at original offsets, so a spelled
  // number never pushes a cue out of its window (round 1 measured on the spelled text and gave
  // ["s_alpha=heard"], ["s_alpha=2"] and ["s_alpha=2"] on these three with normalize on).
  ["R4/cue-negation-window-on-original-offsets", "not 13 or 17 alpha", { includeHeard: true }, [], []],
  ["R4/band-negation-window-on-original-offsets", "alpha, not 13 or 17 units", { includeHeard: true }, ["s_alpha=heard"], ["s_alpha=heard"]],
  ["R4/third-party-window-on-original-offsets", "my cousin had 13 or 17 alpha units", { includeSuppressed: true }, ["s_alpha=2 [third-party]"], ["s_alpha=2 [third-party]"]],
  ["R4/red-flag-after-a-digit", "an omega event after 2 units", {}, ["f_omega=true"], ["f_omega=true"]],
];

// [label, text, opts, the captures with normalize on, in full: indices in original-text coordinates].
const NORMALIZE_SHAPES = [
  ["offset/item-after-a-spelled-number", "2 units then alpha", {},
    [{ id: "s_alpha", value: 1, kind: "item", evidence: "2 units then alpha", cueIndex: 13 }]],
  ["offset/heard-after-a-spelled-number", "at 3 I felt Alpha", { includeHeard: true },
    [{ id: "s_alpha", kind: "heard", evidence: "at 3 I felt Alpha", cueIndex: 12, cue: "alpha", cueText: "Alpha" }]],
  ["offset/heard-after-a-folded-apostrophe", "I’m Alpha", { includeHeard: true },
    [{ id: "s_alpha", kind: "heard", evidence: "I’m Alpha", cueIndex: 4, cue: "alpha", cueText: "Alpha" }]],
  ["offset/red-flag-after-a-spelled-number", "an omega event after 2 units", {},
    [{ id: "f_omega", value: true, kind: "redflag", evidence: "an omega event after 2 units", cueIndex: 3 }]],
];

// [label, text, tags without normalize, tags with normalize {apostrophes: true, numbers: "en"}] on
// the fixture withNumberWords (R4, §12.5, lead decision L2): number spelling is for band phrases
// only, so a typed digit reaches no yes/no, context, red-flag, cue, anchor or carryRefuse phrase,
// and no yield target's cue; the spelled word still does, and apostrophe folding still reaches
// every family.
const FOLDED_ONLY_CASES = [
  ["bool-phrase", "I had 2 gamma", [], []],
  ["bool-phrase-spelled", "I had two gamma", ["b_gamma=yes"], ["b_gamma=yes"]],
  ["context-phrase", "3 deltas", [], []],
  ["context-phrase-spelled", "three deltas", ["c_delta=yes"], ["c_delta=yes"]],
  ["red-flag-phrase", "omega on 1 side", [], []],
  ["red-flag-phrase-spelled", "omega on one side", ["f_omega=true"], ["f_omega=true"]],
  ["red-flag-curly-apostrophe", "I can’t omega", [], ["f_omega=true"]],
  ["scale-cue", "it was 12 times", [], []],
  ["scale-cue-spelled", "it was twelve times", ["s_eps=1"], ["s_eps=1"]],
  ["anchor", "alpha and 2 marks, it persists for a long span", ["s_alpha=2"], ["s_alpha=2"]],
  ["anchor-spelled", "alpha and two marks, it persists for a long span", ["s_alpha=2", "s_beta=2"], ["s_alpha=2", "s_beta=2"]],
  // Review T9: yield presence of the target's cue, and the carryRefuse onset guard (R9 c).
  ["yield-target-cue", "11 thetas and it persists for a long span", ["s_beta=2"], ["s_beta=2"]],
  ["yield-target-cue-spelled", "eleven thetas and it persists for a long span", ["s_alpha=2"], ["s_alpha=2"]],
  ["carryRefuse-onset-guard", "alpha for a long span, 1 time", ["s_alpha=2"], ["s_alpha=2"]],
  ["carryRefuse-onset-guard-spelled", "alpha for a long span, one time", [], []],
];
// [label, text, pending, expected brief, {capture?}] on withNumberWords with normalize on: the
// other-entry check (topic phrases), the own-cue check and the carryRefuse check run on the folded
// text too, and the attribution and history windows of a carried reply are measured at original
// offsets (review T9; measured on the spelled text, the last two would carry 2).
const FOLDED_ONLY_CONTEXT = [
  ["topic-phrase", "3 deltas, a long span", P0, after(["s_alpha=2 via carry"], null, null, true),
    { capture: carryCap(2, "3 deltas, a long span", 12, "long span") }],
  ["topic-phrase-spelled", "three deltas, a long span", P0, after(["c_delta=yes"], P1, "other-entry")],
  ["own-cue", "11 thetas, a long span", P0, after(["s_alpha=2 via carry"], null, null, true),
    { capture: carryCap(2, "11 thetas, a long span", 13, "long span") }],
  ["own-cue-spelled", "eleven thetas again", P0, after(["s_alpha=heard"], ["s_alpha", 2], "own-cue")],
  ["refuse-phrase", "1 time, a long span", P0, after(["s_alpha=2 via carry"], null, null, true)],
  ["refuse-phrase-spelled", "one time, a long span", P0, after([], P1, "refuse-phrase")],
  ["third-party-window-of-a-carried-reply", "my cousin gets 13 or 17 long spans", P0, after([], P1, "third-party")],
  ["historical-window-of-a-carried-reply", "it used to be 13 or 17 long spans", P0, after([], P1, "historical")],
];

// The round 3+ property (round 3d, §13.12; the engine's "Slots" header). Round 3+ is round 3 with
// rule 3c added; it is this engine read with a normal slot or none, a yield-only slot it returns
// read as none. On seeded multi-carry dialogues, at every step: where the engine holds a normal slot
// it is round 3+'s, and elsewhere round 3+ holds none; every capture is one round 3+ records, and a
// capture round 3+ records that is missing here is of an entry that yields to the yield-only slot read.
const R3P_DIALOGUES = { full: 4000, quick: 1000 };
const R3P_CUES = ["alpha", "omicron", "zeta", "epsilon", "persists", "lingers", "the beta mark", "gamma sign", "the gamma alpha mark"];
const R3P_BANDS = ["a short span", "a long span", "a brief span", "two units", "20 units", "span"];
const R3P_MODS = ["", "", "", "not ", "never ", "my cousin has ", "it used to be "];
const R3P_WITHHELD = ["not a long span", "a short span then a long span", "a long span a while ago", "a long span, not a long span"];

/** The fixture with s_zeta's carry varied, s_eps, s_beta and a new s_eta (yielding) made to carry at random. */
function multiCarryFixture(rng) {
  return fixture((l) => {
    entryOf(l, "s_zeta").carry = 1 + Math.floor(rng() * 3);
    if (rng() < 0.6) { const e = entryOf(l, "s_eps"); e.heard = true; e.carry = 1 + Math.floor(rng() * 2); }
    if (rng() < 0.5) { const b = entryOf(l, "s_beta"); b.heard = true; if (rng() < 0.7) b.carry = 1 + Math.floor(rng() * 2); }
    l.scale.push({ id: "s_eta", cue: ["lingers"], bands: [{ ph: ["short span"], v: 1 }, { ph: ["long span"], v: 2 }], fallback: null,
      yieldTo: pick(rng, [["s_zeta"], ["s_alpha"], ["s_eps"], ["s_zeta", "s_alpha"]]), ...(rng() < 0.5 ? { heard: true, carry: 1 } : {}) });
  });
}
/** One seeded patient line: one to three cues, bands or fillers, each perhaps negated, attributed or historical. */
function r3pLine(rng) {
  const parts = [];
  for (let k = 1 + Math.floor(rng() * 3); k > 0; k--) {
    const r = rng();
    parts.push(pick(rng, R3P_MODS) + (r < 0.45 ? pick(rng, R3P_CUES) : r < 0.9 ? pick(rng, R3P_BANDS) : pick(rng, ["okay", "again"])));
  }
  let text = parts.join(pick(rng, [" and ", ", ", ". ", " then "]));
  if (rng() < 0.08) text += " a while ago";
  if (rng() < 0.06) text += "?";
  return text;
}
/** The tags of `a` missing from `b`, as multisets. */
function tagsMissing(a, b) {
  const left = new Map();
  for (const t of b) left.set(t, (left.get(t) || 0) + 1);
  const out = [];
  for (const t of a) { const k = left.get(t) || 0; if (k) left.set(t, k - 1); else out.push(t); }
  return out;
}

async function roundThreePlus(c, h, x) {
  const at = (p) => `/block1/round3plus${p}`;
  const rng = h.rng((h.seed ^ 0x52335050) >>> 0); // "R3PP"
  const n = h.quick ? R3P_DIALOGUES.quick : R3P_DIALOGUES.full;
  const asRound3Plus = (r) => (isObj(r) && isObj(r.pending) && r.pending.yieldOnly === true ? { ...r, pending: null } : r);
  const stats = { steps: 0, normal: 0, yieldOnly: 0, ended: 0, closed: 0, suppressed: 0 };
  for (let d = 0; d < n; d++) {
    const lex = multiCarryFixture(rng);
    const lines = Array.from({ length: 2 + Math.floor(rng() * 5) }, () => r3pLine(rng));
    if (rng() < 0.6) { lines[0] = pick(rng, R3P_CUES.slice(0, 6)); lines[1] = `${pick(rng, R3P_CUES.slice(0, 6))}, ${pick(rng, R3P_WITHHELD)}`; }
    const opts = lines.map(() => (rng() < 0.15 ? { carry: false } : {}));
    let slot = null, ref = null;
    for (let i = 0; i < lines.length; i++) {
      const where = at(`/${d}/${i}`);
      const input = { lines: lines.slice(0, i + 1), opts: opts[i], slot, round3plus: ref, scale: lex.scale };
      const r = attempt(c, where, input, () => x.extractInContext(lex, lines[i], slot, opts[i]));
      const q = attempt(c, `${where}/round3plus`, input, () => asRound3Plus(x.extractInContext(lex, lines[i], ref, opts[i])));
      if (r === undefined || q === undefined) break;
      const normal = isObj(r.pending) && r.pending.yieldOnly !== true;
      const read = isObj(slot) && slot.yieldOnly === true ? slot.id : null;
      const extra = tagsMissing(tags(r.captures), tags(q.captures));
      const missing = tagsMissing(tags(q.captures), tags(r.captures))
        .filter((t) => { const e = entryOf(lex, t.slice(0, t.indexOf("="))); return !(read !== null && isObj(e) && arr(e.yieldTo).includes(read)); });
      const ok = (normal ? JSON.stringify(r.pending) === JSON.stringify(q.pending) : q.pending === null) && !extra.length && !missing.length;
      c.check(ok, where, input, { pending: normal ? q.pending : null, extra: [], missing: [] }, { pending: r.pending, extra, missing });
      if (!ok) break;
      stats.steps += 1;
      if (normal) stats.normal += 1; else if (isObj(r.pending)) stats.yieldOnly += 1;
      // A normal slot read and another entry's yield-only slot returned. Rule 3c ended it only when it
      // was still open at step 6: not expired (step 5), not closed by an answer or a carry (step 4).
      // Otherwise no slot was left and rule 3d armed the new one, as round 3c did (review round 2).
      if (isObj(slot) && slot.yieldOnly !== true && isObj(r.pending) && r.pending.yieldOnly === true && r.pending.id !== slot.id) {
        const open = Math.min(slot.turnsLeft, entryOf(lex, slot.id).carry) > 1 && r.carry.applied !== true && r.carry.refused !== "answered";
        if (open) stats.ended += 1; else stats.closed += 1;
      }
      if (tags(q.captures).length > tags(r.captures).length) stats.suppressed += 1;
      slot = r.pending;
      ref = q.pending;
    }
    if (d % 250 === 0) await tick();
  }
  c.note(`block 1: round 3+ property (§13.12) on ${n} seeded multi-carry dialogues, ${stats.steps} steps: ${stats.normal} normal slots (each round 3+'s), ${stats.yieldOnly} yield-only slots, ${stats.ended} normal slots ended by rule 3c and replaced by the withheld entry's yield-only slot, ${stats.closed} normal slots closed on the line (expired, answered or carried) and followed by another entry's yield-only slot (rule 3d, as in round 3c), ${stats.suppressed} steps with a yielding entry suppressed`);
}

const PURITY_TEXTS = ["I feel alpha today", "for a long span", "the gamma alpha mark", "alpha and it persists for a long span",
  "my cousin has alpha", "I don’t feel alpha for 2 units", "a zeta now", "   ", "alpha for a short span then a long span",
  "alpha for a long span ago", "a brief span", "it persists for a long span", "alpha. a brief span", "a short span, not 20 units",
  "alpha, not really a brief span", "20 units, a long span"];

async function block1(c, h, x, carryMax) {
  const at = (p) => `/block1${p}`;
  const L = fixture();
  const LN = fixture(withNormalize({ apostrophes: true, numbers: "en" }));

  // EXTRACTOR_FEATURES names every capability (the benchmark header prints the export itself).
  const feats = x.EXTRACTOR_FEATURES;
  c.check(Array.isArray(feats) && FEATURES.every((f) => feats.includes(f)), at("/EXTRACTOR_FEATURES"), null, FEATURES, feats);
  c.check(Object.isFrozen(feats), at("/EXTRACTOR_FEATURES/frozen"), null, true, Object.isFrozen(feats));

  // extract: heard and yield; band choice and the onset guard (round 2).
  for (const [label, text, opts, want] of [...EXTRACT_CASES, ...BAND_CHOICE_CASES]) {
    const got = attempt(c, at(`/extract/${label}`), { text, opts }, () => x.extract(L, text, opts));
    if (got !== undefined) c.diff(want, tags(got), { at: at(`/extract/${label}`), input: { text, opts } });
  }
  for (const [label, mutate, text, opts, want] of VARIANT_CASES) {
    const lex = fixture(mutate);
    const got = attempt(c, at(`/extract/${label}`), { text, opts }, () => x.extract(lex, text, opts));
    if (got !== undefined) c.diff(want, tags(got), { at: at(`/extract/${label}`), input: { text, opts } });
  }
  for (const [label, text, want] of HEARD_SHAPES) {
    const got = attempt(c, at(`/heard-shape/${label}`), { text }, () => x.extract(L, text, { includeHeard: true }));
    if (got !== undefined) c.diff([want], got, { at: at(`/heard-shape/${label}`), input: { text }, keyOrder: true });
  }

  // extractInContext: every rule and refusal code.
  const seen = new Set();
  for (const [label, text, pending, want, full] of CONTEXT_CASES) {
    const input = { text, pending };
    const r = attempt(c, at(`/context/${label}`), input, () => x.extractInContext(L, text, pending));
    if (r === undefined) continue;
    if (isObj(r.carry) && typeof r.carry.refused === "string") seen.add(r.carry.refused);
    c.diff(want, brief(r), { at: at(`/context/${label}`), input });
    if (full && full.pending) c.diff(full.pending, r.pending, { at: at(`/context/${label}/pending`), input, keyOrder: true });
    if (full && full.capture) {
      const caps = arr(r.captures);
      c.diff(full.capture, caps[caps.length - 1], { at: at(`/context/${label}/capture`), input, keyOrder: true });
    }
  }
  const unseen = REFUSALS.filter((code) => !seen.has(code));
  c.check(!unseen.length, at("/context/every-refusal-code"), { unseen }, REFUSALS, [...seen]);

  // createExtractor(lexicon).extractInContext is the same function bound to the lexicon.
  const bound = x.createExtractor(L);
  c.check(typeof bound.extractInContext === "function", at("/createExtractor/extractInContext"), null, "function", typeof bound.extractInContext);
  if (typeof bound.extractInContext === "function") {
    for (const [label, text, pending] of CONTEXT_CASES) {
      const want = attempt(c, at(`/createExtractor/${label}`), { text }, () => x.extractInContext(L, text, pending));
      const got = attempt(c, at(`/createExtractor/${label}`), { text }, () => bound.extractInContext(text, pending));
      if (want !== undefined && got !== undefined) same(c, want, got, at(`/createExtractor/${label}`), { text, pending });
    }
    for (const [label, text, pending] of CARRY_OFF_CASES) {
      const want = attempt(c, at(`/createExtractor/carry-off/${label}`), { text }, () => x.extractInContext(L, text, pending, { carry: false }));
      const got = attempt(c, at(`/createExtractor/carry-off/${label}`), { text }, () => bound.extractInContext(text, pending, { carry: false }));
      if (want !== undefined && got !== undefined) same(c, want, got, at(`/createExtractor/carry-off/${label}`), { text, pending });
    }
  }

  // {carry: true} is the default (R5).
  for (const [label, text, pending] of CONTEXT_CASES) {
    const want = attempt(c, at(`/carry-true/${label}`), { text }, () => x.extractInContext(L, text, pending));
    const got = attempt(c, at(`/carry-true/${label}`), { text }, () => x.extractInContext(L, text, pending, { carry: true }));
    if (want !== undefined && got !== undefined) same(c, want, got, at(`/carry-true/${label}`), { text, pending });
  }
  // {carry: false} (R5): the slot lives on for yieldTo; nothing is carried or refused.
  for (const [label, text, pending, want] of CARRY_OFF_CASES) {
    const input = { text, pending, opts: { carry: false } };
    const r = attempt(c, at(`/carry-off/${label}`), input, () => x.extractInContext(L, text, pending, { carry: false }));
    if (r !== undefined) c.diff(want, brief(r), { at: at(`/carry-off/${label}`), input });
  }
  // Yield-only slots (round 3b): every rule of "Slots" in the engine header.
  for (const [label, mutate, text, pending, opts, want, full] of YIELD_ONLY_CASES) {
    const lex = fixture(mutate);
    const where = at(`/yield-only/${label}`);
    const input = { text, pending, opts };
    const r = attempt(c, where, input, () => x.extractInContext(lex, text, pending, opts));
    if (r === undefined) continue;
    c.diff(want, brief(r), { at: where, input });
    if (full && full.pending) c.diff(full.pending, r.pending, { at: `${where}/pending`, input, keyOrder: true });
  }
  // carryExclude (R3a, R10, R11): the same utterances with and without s_alpha.carryExclude.
  const LX = fixture(withCarryExclude);
  for (const [label, text, pending, want, wantWithout, full] of CARRY_EXCLUDE_CASES) {
    const input = { text, pending };
    const r = attempt(c, at(`/carryExclude/${label}`), input, () => x.extractInContext(LX, text, pending));
    if (r !== undefined) {
      c.diff(want, brief(r), { at: at(`/carryExclude/${label}`), input });
      if (full && full.capture) {
        const caps = arr(r.captures);
        c.diff(full.capture, caps[caps.length - 1], { at: at(`/carryExclude/${label}/capture`), input, keyOrder: true });
      }
    }
    const w = attempt(c, at(`/carryExclude/${label}/without`), input, () => x.extractInContext(L, text, pending));
    if (w !== undefined) c.diff(wantWithout, brief(w), { at: at(`/carryExclude/${label}/without`), input });
  }
  // Sequences (R9 f, R10, R11): each reply read with the slot the previous one returned.
  for (const [label, mutate, replies, want] of SEQUENCES) {
    const lex = fixture(mutate);
    const where = at(`/sequence/${label}`);
    const got = attempt(c, where, { replies }, () => {
      let slot = null;
      return replies.map((text) => { const r = x.extractInContext(lex, text, slot); slot = r.pending; return brief(r); });
    });
    if (got !== undefined) c.diff(want, got, { at: where, input: { replies } });
  }

  // Expiry after exactly `carry` patient replies, for every carry from 1 to LEXICON_CARRY_MAX.
  for (let k = 1; k <= carryMax; k++) {
    const where = at(`/expiry/carry-${k}`);
    attempt(c, where, { carry: k }, () => {
      const lex = fixture((l) => { entryOf(l, "s_alpha").carry = k; });
      const armed = x.extractInContext(lex, "alpha", null).pending;
      c.diff(k, isObj(armed) ? armed.turnsLeft : armed, { at: `${where}/armed` });
      const left = [];
      let slot = armed;
      for (let j = 0; j < k; j++) { slot = x.extractInContext(lex, "okay", slot).pending; left.push(isObj(slot) ? slot.turnsLeft : slot); }
      const wantLeft = [];
      for (let j = 1; j <= k; j++) wantLeft.push(k - j > 0 ? k - j : null);
      c.diff(wantLeft, left, { at: `${where}/turnsLeft-after-each-reply` });
      c.diff({ applied: false, refused: null }, x.extractInContext(lex, "for a long span", slot).carry, { at: `${where}/after-${k}-replies` });
      slot = armed;
      for (let j = 0; j < k - 1; j++) slot = x.extractInContext(lex, "okay", slot).pending;
      c.diff({ applied: true, refused: null }, x.extractInContext(lex, "for a long span", slot).carry, { at: `${where}/reply-${k}-carries` });
    });
  }

  // Which entries arm: heard: true and an integer carry from 1 to LEXICON_CARRY_MAX.
  const ARMING = [
    ["carry-at-max", (l) => { entryOf(l, "s_alpha").carry = carryMax; }, ["s_alpha=heard"], ["s_alpha", carryMax]],
    ["carry-over-max", (l) => { entryOf(l, "s_alpha").carry = carryMax + 1; }, ["s_alpha=heard"], null],
    ["carry-zero", (l) => { entryOf(l, "s_alpha").carry = 0; }, ["s_alpha=heard"], null],
    ["carry-fraction", (l) => { entryOf(l, "s_alpha").carry = 1.5; }, ["s_alpha=heard"], null],
    ["heard-without-carry", (l) => { delete entryOf(l, "s_alpha").carry; }, ["s_alpha=heard"], null],
    ["carry-without-heard", (l) => { entryOf(l, "s_alpha").heard = false; }, [], null],
  ];
  for (const [label, mutate, wantCaps, wantPending] of ARMING) {
    const lex = fixture(mutate);
    const r = attempt(c, at(`/arming/${label}`), { text: "alpha" }, () => x.extractInContext(lex, "alpha", null));
    if (r !== undefined) c.diff(after(wantCaps, wantPending, null), brief(r), { at: at(`/arming/${label}`), input: { text: "alpha" } });
  }

  // A blank text consumes nothing: the very same pending object comes back (with {carry: false} too).
  for (const [blank, opts] of [["", undefined], ["   ", undefined], ["\n\t ", undefined], ["   ", { carry: false }]]) {
    const where = at(`/blank/${JSON.stringify(blank)}${opts ? "/carry-off" : ""}`);
    const r = attempt(c, where, { text: blank, opts }, () => x.extractInContext(L, blank, P0, opts));
    if (r === undefined) continue;
    c.check(r.pending === P0, `${where}/same-pending`, { text: blank, opts }, "the pending object passed in", r.pending);
    c.diff({ captures: [], applied: false, refused: null }, { captures: tags(r.captures), applied: r.carry && r.carry.applied, refused: r.carry && r.carry.refused },
      { at: where, input: { text: blank, opts } });
  }
  // Step 0 guards: no lexicon object, or text that is not a string, captures and consumes nothing.
  for (const [label, lex, text] of [["no-lexicon", null, "for a long span"], ["lexicon-is-a-list", [], "for a long span"], ["text-not-a-string", L, 42]]) {
    const r = attempt(c, at(`/guards/${label}`), { text }, () => x.extractInContext(lex, text, P0));
    if (r === undefined) continue;
    c.check(r.pending === P0, at(`/guards/${label}/same-pending`), { text }, "the pending object passed in", r.pending);
    c.diff({ captures: [], applied: false, refused: null }, { captures: tags(r.captures), applied: r.carry && r.carry.applied, refused: r.carry && r.carry.refused },
      { at: at(`/guards/${label}`), input: { text } });
  }
  // opts: includeSuppressed is ignored, negationWindow is honoured, a non-object opts reads as {}.
  // Round 2 (R1): a carried band span is negated by a cue anywhere before it whatever the window, so
  // negationWindow is shown on the utterance's own extraction ("not the gamma sign"); round 1 showed
  // it with "not for a long span", which {negationWindow: 0} no longer carries.
  const OPTS_CASES = [
    ["includeSuppressed-ignored", "my cousin has alpha", null, { includeSuppressed: true }, after([], null, null)],
    ["negationWindow-honoured", "not the gamma sign", P0, { negationWindow: 0 }, after(["b_gamma=yes"], P1, "other-entry")],
    ["negationWindow-default", "not the gamma sign", P0, {}, after(["b_gamma=no"], P1, "other-entry")],
    ["negationWindow-0/carry-negation-is-clause-wide (R1)", "not for a long span", P0, { negationWindow: 0 }, after([], P1, "negated")],
    ["opts-not-an-object", "for a long span", P0, "not options", after(["s_alpha=2 via carry"], null, null, true)],
  ];
  for (const [label, text, pending, opts, want] of OPTS_CASES) {
    const r = attempt(c, at(`/opts/${label}`), { text, opts }, () => x.extractInContext(L, text, pending, opts));
    if (r !== undefined) c.diff(want, brief(r), { at: at(`/opts/${label}`), input: { text, opts } });
  }

  // normalize: opt-in, apostrophe folding, number spelling, offsets in original-text coordinates.
  for (const [label, text, opts, plain, normed] of NORMALIZE_CASES) {
    const a = attempt(c, at(`/normalize/${label}/off`), { text, opts }, () => x.extract(L, text, opts));
    if (a !== undefined) c.diff(plain, tags(a), { at: at(`/normalize/${label}/off`), input: { text, opts } });
    const b = attempt(c, at(`/normalize/${label}/on`), { text, opts }, () => x.extract(LN, text, opts));
    if (b !== undefined) c.diff(normed, tags(b), { at: at(`/normalize/${label}/on`), input: { text, opts } });
  }
  for (const [label, text, opts, want] of NORMALIZE_SHAPES) {
    const got = attempt(c, at(`/normalize/${label}`), { text, opts }, () => x.extract(LN, text, opts));
    if (got !== undefined) c.diff(want, got, { at: at(`/normalize/${label}`), input: { text, opts }, keyOrder: true });
  }
  const SEPARATE = [
    ["apostrophes-only", { apostrophes: true }, [], ["s_alpha=2"]],
    ["numbers-only", { numbers: "en" }, ["s_alpha=heard"], ["s_alpha=1"]],
    ["both-off", { apostrophes: false, numbers: "fr" }, ["s_alpha=heard"], ["s_alpha=2"]],
  ];
  for (const [label, normalize, wantDenial, wantNumber] of SEPARATE) {
    const lex = fixture(withNormalize(normalize));
    const d = attempt(c, at(`/normalize/${label}`), { normalize }, () => x.extract(lex, "I don’t feel alpha", { includeHeard: true }));
    if (d !== undefined) c.diff(wantDenial, tags(d), { at: at(`/normalize/${label}/apostrophe`), input: { normalize } });
    const n = attempt(c, at(`/normalize/${label}`), { normalize }, () => x.extract(lex, "alpha lasts 2 units"));
    if (n !== undefined) c.diff(wantNumber, tags(n), { at: at(`/normalize/${label}/number`), input: { normalize } });
  }
  const NORMALIZED_CONTEXT = [
    ["carry/spelled-twenty", "20 units", P0, after(["s_alpha=2 via carry"], null, null, true), { capture: carryCap(2, "20 units", 3, "units") }],
    ["carry/spelled-two", "2 units", P0, after(["s_alpha=1 via carry"], null, null, true), { capture: carryCap(1, "2 units", 0, "two units") }],
    ["refused/negated-after-folding", "it wasn’t a long span", P0, after([], P1, "negated")],
    ["arm/offset-after-a-spelled-number", "at 3 I felt Alpha", null, after(["s_alpha=heard"], ["s_alpha", 2], null),
      { pending: { id: "s_alpha", cue: "alpha", cueText: "Alpha", evidence: "at 3 I felt Alpha", cueIndex: 12, turnsLeft: 2 } }],
  ];
  for (const [label, text, pending, want, full] of NORMALIZED_CONTEXT) {
    const r = attempt(c, at(`/normalize/context/${label}`), { text }, () => x.extractInContext(LN, text, pending));
    if (r === undefined) continue;
    c.diff(want, brief(r), { at: at(`/normalize/context/${label}`), input: { text } });
    if (full && full.pending) c.diff(full.pending, r.pending, { at: at(`/normalize/context/${label}/pending`), input: { text }, keyOrder: true });
    if (full && full.capture) {
      const caps = arr(r.captures);
      c.diff(full.capture, caps[caps.length - 1], { at: at(`/normalize/context/${label}/capture`), input: { text }, keyOrder: true });
    }
  }
  const plainCarry = attempt(c, at("/normalize/context/off"), null, () => x.extractInContext(L, "it wasn’t a long span", P0));
  if (plainCarry !== undefined) c.diff(after(["s_alpha=2 via carry"], null, null, true), brief(plainCarry), { at: at("/normalize/context/off/apostrophe-not-folded") });

  // R4: number spelling reaches band phrases only; every other family runs on the folded text.
  const LR = fixture(withNumberWords);
  const LRN = fixture((l) => { withNumberWords(l); withNormalize({ apostrophes: true, numbers: "en" })(l); });
  for (const [label, text, plain, normed] of FOLDED_ONLY_CASES) {
    const a = attempt(c, at(`/normalize/folded-only/${label}/off`), { text }, () => x.extract(LR, text));
    if (a !== undefined) c.diff(plain, tags(a), { at: at(`/normalize/folded-only/${label}/off`), input: { text } });
    const b = attempt(c, at(`/normalize/folded-only/${label}/on`), { text }, () => x.extract(LRN, text));
    if (b !== undefined) c.diff(normed, tags(b), { at: at(`/normalize/folded-only/${label}/on`), input: { text } });
  }
  for (const [label, text, pending, want, full] of FOLDED_ONLY_CONTEXT) {
    const where = at(`/normalize/folded-only/context/${label}`);
    const r = attempt(c, where, { text }, () => x.extractInContext(LRN, text, pending));
    if (r === undefined) continue;
    c.diff(want, brief(r), { at: where, input: { text } });
    if (full && full.capture) {
      const caps = arr(r.captures);
      c.diff(full.capture, caps[caps.length - 1], { at: `${where}/capture`, input: { text }, keyOrder: true });
    }
  }

  // Purity: deep-frozen inputs, unchanged after the calls, and two calls deep-equal.
  const Lf = deepFreeze(fixture());
  const LNf = deepFreeze(fixture(withNormalize({ apostrophes: true, numbers: "en" })));
  const LXf = deepFreeze(fixture(withCarryExclude));
  const Pf = deepFreeze({ ...P0 });
  const Yf = deepFreeze({ ...Y0 });
  const oe = deepFreeze({ includeHeard: true, includeSuppressed: true, pendingIds: ["s_alpha"], negationWindow: 14 });
  const oc = deepFreeze({ negationWindow: 14 });
  const ocOff = deepFreeze({ negationWindow: 14, carry: false });
  const snapshot = () => [Lf, LNf, LXf, Pf, Yf, oe, oc, ocOff].map((v) => JSON.stringify(v));
  const before = snapshot();
  for (const [name, lex] of [["fixture", Lf], ["normalized", LNf], ["carryExclude", LXf]]) {
    for (const text of PURITY_TEXTS) {
      const where = at(`/purity/${name}/${JSON.stringify(text)}`);
      const e1 = attempt(c, `${where}/extract`, { text }, () => x.extract(lex, text, oe));
      const e2 = attempt(c, `${where}/extract`, { text }, () => x.extract(lex, text, oe));
      if (e1 !== undefined && e2 !== undefined) c.diff(e1, e2, { at: `${where}/extract`, input: { text }, keyOrder: true });
      for (const [suffix, o, slot] of [["", oc, Pf], ["/carry-off", ocOff, Pf], ["/yield-only", oc, Yf]]) {
        const r1 = attempt(c, `${where}/extractInContext${suffix}`, { text }, () => x.extractInContext(lex, text, slot, o));
        const r2 = attempt(c, `${where}/extractInContext${suffix}`, { text }, () => x.extractInContext(lex, text, slot, o));
        if (r1 !== undefined && r2 !== undefined) c.diff(r1, r2, { at: `${where}/extractInContext${suffix}`, input: { text }, keyOrder: true });
      }
    }
  }
  c.diff(before, snapshot(), { at: at("/purity/inputs-unchanged") });
  c.diff(JSON.stringify(FIXTURE), JSON.stringify(L), { at: at("/purity/fixture-unchanged") });

  // Default-off proof on the fixture without the new fields.
  const rng = h.rng((h.seed ^ 0x43415054) >>> 0); // "CAPT"
  const n = h.quick ? DEFAULT_OFF_UTTERANCES.quick : DEFAULT_OFF_UTTERANCES.full;
  const bare = withoutNewFields(FIXTURE);
  const done = await defaultOff(c, x, bare, utterances(rng, bare, n), at("/default-off/fixture"));
  c.note(`block 1: ${EXTRACT_CASES.length + BAND_CHOICE_CASES.length + VARIANT_CASES.length + HEARD_SHAPES.length} extract cases (${BAND_CHOICE_CASES.length} on band choice and the onset guard), ${CONTEXT_CASES.length} extractInContext cases (refusal codes seen: ${[...seen].join(", ")}), ${CARRY_OFF_CASES.length} with {carry: false}, ${YIELD_ONLY_CASES.length} yield-only slot cases (rounds 3b-3d), ${CARRY_EXCLUDE_CASES.length} carryExclude utterances, ${SEQUENCES.length} sequences, expiry for carry 1-${carryMax}, ${NORMALIZE_CASES.length + NORMALIZE_SHAPES.length + NORMALIZED_CONTEXT.length + FOLDED_ONLY_CASES.length + FOLDED_ONLY_CONTEXT.length} normalize cases; default-off: ${done} seeded utterances on the fixture without the new fields`);
  await roundThreePlus(c, h, x);
}

// --------------------------------------------------------------------------- block 2: gold 0.3.0

const pairKey = (id, v) => `${id}=${JSON.stringify(v)}`;
const isValueCapture = (cp) => isObj(cp) && cp.kind !== "heard" && cp.suppressedBy === undefined;
const isHeardCapture = (cp) => isObj(cp) && cp.kind === "heard" && cp.suppressedBy === undefined;

function prf(tp, fp, fn) {
  const p = tp + fp ? tp / (tp + fp) : null;
  const r = tp + fn ? tp / (tp + fn) : null;
  const f1 = p !== null && r !== null && p + r > 0 ? (2 * p * r) / (p + r) : null;
  return { p, r, f1, tp, fp, fn };
}
const pct = (v) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const sum = (rows, k) => rows.reduce((a, row) => a + row[k], 0);

/**
 * One dialogue: physician turns are passed over (a null step, the slot untouched); each patient turn
 * goes through extractInContext with the slot, and the returned slot is always kept. With `scribe`,
 * as the Scribe does (design 05 §3.4, round 2 R5 §12.6): while the pending item is answered the slot
 * is still passed, with {carry: false}, so it keeps counting as present for yieldTo and nothing is
 * carried; heard captures of an answered item are dropped. Rounds 3 and 3b change nothing here: the
 * engine itself arms a yield-only slot, or turns the open slot yield-only, when a line states the
 * pending entry's band without a value (R9 f, §13.10), and the Scribe, like this runner, keeps
 * whatever slot the engine returns, yieldOnly included, and passes it whole.
 * Step = {captures: [id, value] or [id, value, "carry"], heard: ids,
 *         pending: [id, turnsLeft] | [id, turnsLeft, "yield-only"] | null, refused}.
 */
function runDialogue(x, lex, turns, scribe) {
  let slot = null;
  const answers = {};
  return turns.map((turn) => {
    const [speaker, text] = Array.isArray(turn) ? turn : [];
    if (speaker !== "pt") return null;
    const answered = scribe && isObj(slot) && answers[slot.id] !== undefined;
    const r = x.extractInContext(lex, text, slot, answered ? { carry: false } : {});
    const caps = arr(r.captures).filter((cp) => !(scribe && isObj(cp) && cp.kind === "heard" && answers[cp.id] !== undefined));
    slot = r.pending;
    for (const cp of caps) if (isObj(cp) && cp.kind === "item" && answers[cp.id] === undefined) answers[cp.id] = cp.value;
    return {
      captures: caps.filter((cp) => isObj(cp) && cp.kind !== "heard").map((cp) => (cp.via === "carry" ? [cp.id, cp.value, "carry"] : [cp.id, cp.value])),
      heard: caps.filter((cp) => isObj(cp) && cp.kind === "heard").map((cp) => cp.id),
      pending: slotOf(slot),
      refused: isObj(r.carry) ? r.carry.refused : undefined,
    };
  });
}

// The lead's normalize cases on MASQUE (D4): [label, text, opts, expected capture tags].
const D4_CASES = [
  ["curly-apostrophe-denial", "I don’t feel unsteady", { includeHeard: true }, []],
  ["digit-under-five-minutes", "I get dizzy and it lasts 2 minutes", {}, ["v_vertigo=1"]],
  ["digits-21-to-29-stay", "I get dizzy and it lasts 22 minutes", {}, ["v_vertigo=2"]],
  ["digit-days", "I've been dizzy for 3 days", {}, ["v_vertigo=2"]],
];

function d4(c, x, lex, at) {
  for (const [label, text, opts, want] of D4_CASES) {
    const got = attempt(c, at(`/D4/${label}`), { text, opts }, () => x.extract(lex, text, opts));
    if (got !== undefined) c.diff(want, tags(got), { at: at(`/D4/${label}`), input: { text, opts } });
  }
  const unfolded = clone(lex);
  delete unfolded.normalize;
  const raw = attempt(c, at("/D4/curly-apostrophe-without-normalize"), null, () => x.extract(unfolded, "I don’t feel unsteady", { includeHeard: true }));
  if (raw !== undefined) c.diff(["v_vertigo=heard"], tags(raw), { at: at("/D4/curly-apostrophe-without-normalize") });
  attempt(c, at("/D4/carry-reply-20-minutes"), null, () => {
    const armed = x.extractInContext(lex, "I'm feeling really dizzy", null);
    const r = x.extractInContext(lex, "20 minutes", armed.pending);
    c.diff(after(["v_vertigo=2 via carry"], null, null, true), brief(r), { at: at("/D4/carry-reply-20-minutes"), input: { text: "20 minutes" } });
    const cp = arr(r.captures).find((q) => isObj(q) && q.via === "carry");
    c.diff({ band: "minutes", cueIndex: 3 }, cp ? { band: cp.band, cueIndex: cp.cueIndex } : null, { at: at("/D4/carry-reply-20-minutes/band") });
  });
}

// Round 2 on MASQUE (design 05 §12): the rules and every trace of the round-1 review, with the
// disclosed known risks (§12.9) pinned as the rules behave. [label, text, opts, expected capture tags].
const ROUND2_CASES = [
  // R2 band choice for the heard entry v_vertigo (review F4; round 1 read v 1 on the first three).
  ["R2/split-second-and-hours", "It hit me in a split second and the spinning lasted for hours", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R2/split-second-and-hours/without-includeHeard", "It hit me in a split second and the spinning lasted for hours", {}, []],
  ["R2/couple-minutes-and-hours", "I get dizzy a couple minutes after standing up and it lasts for hours", { includeHeard: true }, ["v_vertigo=heard"]],
  // Round 2 dropped the negated "under five minutes" and read v 2 from "hours"; since round 3 (R9 b)
  // the negated span withholds the value (gold t003).
  ["R9b/negated-band-withholds", "The dizziness is never under five minutes, it lasts hours", {}, []],
  ["R9b/negated-band-withholds/includeHeard", "The dizziness is never under five minutes, it lasts hours", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R2/spans-agree", "The dizziness lasts hours, sometimes all day.", {}, ["v_vertigo=2"]],
  ["R2/overlapping-spans-disagree", "I'm dizzy for three days at a time.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R2/entry-without-heard-keeps-band-order", "My headache lasts all day, maybe a week.", {}, ["m_head=1", "m_dur=2"]],
  // R3b onset guard (review F4, F7) and the disclosed residual of the day-range risk.
  ["R3b/couple-minutes-ago", "I felt dizzy a couple minutes ago", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R3b/started-about-a-day-ago", "The dizziness started about a day ago", { includeHeard: true }, ["v_vertigo=heard"]],
  ["risk/came-on-overnight", "I woke up with vertigo, it came on overnight", {}, ["v_vertigo=2"]],
  ["risk/dizzy-for-two-days", "I've been dizzy for two days", {}, ["v_vertigo=2"]],
  // R4 digits for durations only (review F5, F6, ENG-1; lead decision L2).
  ["R4/digits-reach-no-cue", "I've been dizzy for 10 days", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R4/typed-onset", "It started about 10 days ago.", {}, []],
  ["R4/digits-reach-no-multi-phrase", "It happens 3 or 4 times a week", {}, []],
  ["R4/digits-reach-no-multi-phrase/hours", "It lasts 3 or 4 hours.", {}, []],
  ["R4/digits-reach-no-yes-no-phrase", "I've had less than 5 episodes.", {}, []],
  ["R4/digits-reach-no-multi-phrase/doctors", "I’ve seen 3 doctors.", {}, []],
  ["R4/spelled-cue-still-matches", "I'm affected about ten days a month.", {}, ["i_days=3"]],
  ["R4/spelled-multi-phrase-still-matches", "It happens three or four times a week", {}, ["c_clin=3+"]],
  ["R4/third-party-window-on-the-folded-text", "My sister has had 2 or 3 of these dizzy spells for hours", { includeHeard: true }, []],
  ["R4/third-party-window-on-the-folded-text/includeSuppressed", "My sister has had 2 or 3 of these dizzy spells for hours", { includeSuppressed: true },
    ["v_vertigo=2 [third-party]"]],
  // normalize in red-flag phrases and a mixed text (review F2, tests).
  ["normalize/curly-red-flag/hearing", "I suddenly couldn’t hear", {}, ["rf_ssnhl=true"]],
  ["normalize/curly-red-flag/eye", "I can’t move my eye", {}, ["rf_orbital=true"]],
  ["normalize/curly-denial-and-digit", "I don’t feel unsteady for 2 minutes", { includeHeard: true }, []],
  ["normalize/face-went-numb-on-1-side", "My face went numb on 1 side.", {}, ["rf_focal=true", "n_burn=yes"]],
  // Disclosed known risks (§12.9), pinned as the rules behave.
  ["risk/digit-in-a-red-flag-phrase", "I'm numb on 1 side.", {}, ["n_burn=yes"]],
  ["risk/denial-beyond-the-window/roll-over", "It doesn't happen when I roll over", {}, ["v_head=yes"]],
  ["risk/denial-beyond-the-window/turn-my-head", "I don't usually get dizzy when I turn my head", { includeHeard: true }, ["v_head=yes", "v_vertigo=heard"]],
  ["risk/denial-beyond-the-window/lie-back", "I don't really feel it when I lie back", {}, ["v_head=yes"]],
  ["risk/denial-beyond-the-window/roaring", "I haven't noticed any roaring", {}, ["v_aural=yes"]],
  ["risk/idiom-turning-over", "My stomach keeps turning over.", {}, ["v_head=yes"]],
  ["risk/double-negation", "I've had no fewer than five episodes.", {}, ["v_count=no"]],
  ["risk/double-negation/not-fewer-than", "Not fewer than five episodes.", {}, ["v_count=no"]],
  ["risk/fewer-than-five-minutes", "I get dizzy for fewer than five minutes", {}, ["v_vertigo=2"]],
  ["risk/twenty-two-minutes", "I get dizzy and it lasts twenty-two minutes", {}, ["v_vertigo=1"]],
  ["risk/twenty-three-minutes", "The dizziness lasts twenty-three minutes.", {}, ["v_vertigo=1"]],
  ["risk/thirty-four-minutes", "The spinning lasts thirty-four minutes.", {}, ["v_vertigo=1"]],
  ["risk/my-friend", "My friend says I get dizzy for hours", { includeHeard: true }, []],
];
// The normalize texts above on the same lexicon without lexicon.normalize: their expectations hold
// only through folding (and, for the last, the digit read as a band of its own).
const ROUND2_UNFOLDED = [
  ["curly-red-flag/hearing", "I suddenly couldn’t hear", {}, []],
  ["curly-red-flag/eye", "I can’t move my eye", {}, []],
  ["curly-denial-and-digit", "I don’t feel unsteady for 2 minutes", { includeHeard: true }, ["v_vertigo=2"]],
];

/** The cue utterance that arms v_vertigo (pending ["v_vertigo", 2]) before a reply of ROUND2_REPLIES. */
const DIZZY = "I'm feeling really dizzy";
const ARMED = "armed";
const V1 = ["v_vertigo", 1];
/** A yield-only v_vertigo slot with 2 or 1 replies left (round 3b). */
const VY2 = ["v_vertigo", 2, YIELD_ONLY];
const VY1 = ["v_vertigo", 1, YIELD_ONLY];
// [label, reply, slot (ARMED: the slot DIZZY arms; null: none), opts, expected brief result].
const ROUND2_REPLIES = [
  // R1 carry negation anywhere before the band span (review F2, F5; round 1 carried v 2 on each).
  ["R1/doesnt-really-last-for-hours", "It doesn't really last for hours", ARMED, {}, after([], V1, "negated")],
  ["R1/dont-think-its-hours", "No, I don't think it's hours", ARMED, {}, after([], V1, "negated")],
  ["R1/not-sure-its-even-hours", "I'm not sure it's even hours", ARMED, {}, after([], V1, "negated")],
  ["R1/not-seconds-more-like-hours", "not seconds, more like hours", ARMED, {}, after([], V1, "negated")],
  ["R1/fewer-than-five-minutes", "fewer than five minutes", ARMED, {}, after([], V1, "negated")],
  ["R1/a-few-hours-still-carries", "a few hours", ARMED, {}, after(["v_vertigo=2 via carry"], null, null, true)],
  ["R4/not-10-or-15-minutes", "No, not 10 or 15 minutes", ARMED, {}, after([], V1, "negated")],
  ["R4/10-days-is-no-other-entry", "10 days", ARMED, {}, after([], V1, "no-band")],
  // R3a day ranges are same-sentence only (review F1; lead decision L1; round 1 carried v 2 on each).
  ["R3a/for-two-days", "For two days.", ARMED, {}, after([], V1, "no-band")],
  ["R3a/for-three-days", "For three days.", ARMED, {}, after([], V1, "no-band")],
  ["R3a/for-3-days", "for 3 days", ARMED, {}, after([], V1, "no-band")],
  ["R3a/about-a-day", "about a day", ARMED, {}, after([], V1, "no-band")],
  ["R3a/for-a-day-or-two", "for a day or two", ARMED, {}, after([], V1, "no-band")],
  ["R3a/for-a-couple-of-days", "for a couple of days", ARMED, {}, after([], V1, "no-band")],
  ["R3a/overnight", "overnight", ARMED, {}, after([], V1, "no-band")],
  ["R3a/half-a-day-still-carries", "half a day", ARMED, {}, after(["v_vertigo=2 via carry"], null, null, true)],
  // Since round 3 (R10) the excluded "for two days" is collected; it agrees with "an hour" (gold d065).
  ["R10/excluded-and-carried-spans-agree", "For two days, and each spell lasts about an hour.", ARMED, {}, after(["v_vertigo=2 via carry"], null, null, true)],
  // Disclosed known risks (§12.9): pre-existing day bands and hedges are still carried.
  ["risk/all-week-carried", "All week.", ARMED, {}, after(["v_vertigo=3 via carry"], null, null, true)],
  ["risk/for-days-carried", "for days", ARMED, {}, after(["v_vertigo=3 via carry"], null, null, true)],
  ["risk/several-days-carried", "several days", ARMED, {}, after(["v_vertigo=3 via carry"], null, null, true)],
  ["risk/hedge-carried", "maybe a few hours", ARMED, {}, after(["v_vertigo=2 via carry"], null, null, true)],
  // R5: the heard card answered or skipped (review UI-1). Without the slot (round 1) m_dur was recorded.
  ["R5/slot-kept-with-carry-off", "it lasts a couple of hours", ARMED, { carry: false }, after([], V1, null)],
  ["R5/without-the-slot", "it lasts a couple of hours", null, {}, after(["m_dur=1"], null, null)],
  ["R5/nothing-carried", "a few hours", ARMED, { carry: false }, after([], V1, null)],
  // R9 f: a duration stated in the cue's own utterance but withheld opens no carry-over (round 2
  // armed carry-over on both; gold d069 and d070); since round 3b it arms a yield-only slot (round 3
  // armed nothing).
  ["R9/spans-disagree-open-only-a-yield-only-slot (3b)", "It hit me in a split second and the spinning lasted for hours", null, {}, after(["v_vertigo=heard"], VY2, null)],
  ["R9/onset-guard-opens-only-a-yield-only-slot (3b)", "The dizziness started about a day ago", null, {}, after(["v_vertigo=heard"], VY2, null)],
];

function round2(c, x, lex, at) {
  for (const [label, text, opts, want] of ROUND2_CASES) {
    const got = attempt(c, at(`/round2/${label}`), { text, opts }, () => x.extract(lex, text, opts));
    if (got !== undefined) c.diff(want, tags(got), { at: at(`/round2/${label}`), input: { text, opts } });
  }
  const unfolded = clone(lex);
  delete unfolded.normalize;
  for (const [label, text, opts, want] of ROUND2_UNFOLDED) {
    const got = attempt(c, at(`/round2/without-normalize/${label}`), { text, opts }, () => x.extract(unfolded, text, opts));
    if (got !== undefined) c.diff(want, tags(got), { at: at(`/round2/without-normalize/${label}`), input: { text, opts } });
  }
  const armed = attempt(c, at("/round2/armed"), { text: DIZZY }, () => x.extractInContext(lex, DIZZY, null));
  if (armed === undefined) return;
  c.diff(after(["v_vertigo=heard"], ["v_vertigo", 2], null), brief(armed), { at: at("/round2/armed"), input: { text: DIZZY } });
  for (const [label, text, slot, opts, want] of ROUND2_REPLIES) {
    const where = at(`/round2/reply/${label}`);
    const pending = slot === ARMED ? armed.pending : null;
    const r = attempt(c, where, { text, pending, opts }, () => x.extractInContext(lex, text, pending, opts));
    if (r !== undefined) c.diff(want, brief(r), { at: where, input: { text, pending, opts } });
  }
  c.note(`block 2: round 2 on lexicon ${lex.version}: ${ROUND2_CASES.length + ROUND2_UNFOLDED.length} utterances and ${ROUND2_REPLIES.length} replies (R1-R5, the round-1 review traces and the disclosed known risks)`);
}

// Round 3 on MASQUE (design 05 §13): R9-R11, every trace of the round-2 review (F1-F4, ENG-R1-1) and
// the §13.6 known risks, pinned as the rules behave; the gold case or dialogue of each is named.
// [label, text, opts, expected capture tags].
const ROUND3_CASES = [
  // R9 b: any negated band span withholds the value (round 2 dropped the negated span and scored the
  // other one: v 2, v 1, v 2).
  ["R9b/hedge-with-a-negation-word (F2, w001)", "I get dizzy, I don't know, seconds or hours.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R9b/not-hours-recall-cost (t005)", "I'm dizzy for a few seconds, not hours.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R9b/not-a-few-seconds (w002)", "It's not a few seconds, the dizziness lasts hours", { includeHeard: true }, ["v_vertigo=heard"]],
  // Review T2 on MASQUE: "minutes" (v 2) lies inside the negated "under five minutes" and is dropped
  // with it; testing negation first would leave "minutes" live and score v 2.
  ["R9a/contained-span-of-a-negated-span (T2)", "The dizziness is not under five minutes", { includeHeard: true }, ["v_vertigo=heard"]],
  // R9 c and d.
  ["R9c/since-withholds (F3, t012)", "I've been dizzy since Monday, and it lasts hours.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R9d/two-days-at-a-time (w003)", "I'm dizzy for two days at a time", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R9e/one-value-unchanged (w004)", "The room spins for a few seconds when I roll over.", {}, ["v_head=yes", "v_vertigo=1"]],
  // R11: the sentence scope of the carryExclude phrases.
  ["R11/excluded-phrase-in-another-sentence (F4, w005)", "I'm dizzy. It's been going on for two days.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R11/digits-in-another-sentence", "I'm dizzy. For 2 days.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R11/no-whitespace-after-the-period (w010)", "I'm dizzy.It's been going on for two days.", {}, ["v_vertigo=2"]],
  ["R11/other-phrases-keep-line-scope (w011)", "I'm dizzy. Each spell lasts about an hour.", {}, ["v_vertigo=2"]],
  // §13.11: a day range in another sentence gives no value but still disagrees (round 3: v 1 on
  // w013 and v 3 on the next three, where "for two days" overlaps the v 3 phrase "days at a time"
  // without containing it, review F-R11-OVER72 and ENG-R11-1).
  ["R11/a-day-range-elsewhere-still-disagrees (w013)", "I'm dizzy for a few seconds. It's been going on for two days.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R11/day-range-elsewhere-overlapping-days-at-a-time (w017)", "I get these dizzy spells. They last for two days at a time.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R11/day-range-elsewhere-overlapping-days-at-a-time/short (w018)", "I get dizzy. It lasts for two days at a time.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R11/day-range-elsewhere-after-a-question (w019)", "How long am I dizzy? For two days at a time.", { includeHeard: true }, ["v_vertigo=heard"]],
  // §13.11: every sentence with an unnegated, ungated cue hit counts, not only that of the cue phrase
  // listed first ("dizzy"); round 3 ignored the day range and armed a normal slot (review ENG-R11-2).
  ["R11/any-cue-sentence-counts (w020)", "I had vertigo for two days. Now I'm just dizzy.", {}, ["v_vertigo=2"]],
  ["R11/any-cue-sentence-still-disagrees (w021)", "The room spins for two days at a time. Then I feel dizzy.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["R11/an-attributed-cue-hit-makes-no-cue-sentence (w022)", "I get dizzy. My mother was dizzy for two days.", { includeHeard: true }, ["v_vertigo=heard"]],
  // Known risks (§13.6).
  ["risk/abbreviation-ends-a-sentence (w009)", "I'm dizzy, I told Dr. Lee it was for two days.", { includeHeard: true }, ["v_vertigo=heard"]],
  ["risk/abbreviation-e.g.-ends-a-sentence", "I get dizzy, e.g. for two days", { includeHeard: true }, ["v_vertigo=heard"]],
  ["risk/another-symptoms-duration (y014)", "My migraines last for two days and I get dizzy with them", {}, ["v_vertigo=2", "m_dur=2"]],
  ["risk/forty-two-minutes (w014)", "The dizziness lasts forty-two minutes.", {}, ["v_vertigo=1"]],
  ["risk/twenty-two-without-the-hyphen (w015)", "The dizziness lasts twenty two minutes.", {}, ["v_vertigo=1"]],
  ["risk/ninety-four-minutes (w016)", "The spinning lasts ninety-four minutes.", {}, ["v_vertigo=1"]],
  ["risk/typed-42-minutes-unaffected", "The dizziness lasts 42 minutes.", {}, ["v_vertigo=2"]],
];
// [label, reply, slot (ARMED: the slot DIZZY arms; null: none), opts, expected brief result].
const ROUND3_REPLIES = [
  // R10: excluded phrases count for the refusals, and any negated span refuses the reply.
  ["R10/two-days-at-a-time-ambiguous (F1, d073)", "For two days at a time.", ARMED, {}, after([], V1, "ambiguous")],
  ["R10/hedge-with-a-negation-word (F2, d074)", "A few seconds, I'm not sure, maybe hours.", ARMED, {}, after([], V1, "negated")],
  ["R10/negated-excluded-phrase (d083)", "A few hours, not for two days.", ARMED, {}, after([], V1, "negated")],
  ["R10/not-seconds-after-the-carried-span", "It lasts for hours, not seconds", ARMED, {}, after([], V1, "negated")],
  ["R10/attributed-excluded-phrase", "About an hour, my sister has it for two days", ARMED, {}, after([], V1, "third-party")],
  // Disclosed recall cost (ENG-R1-1): an unrelated negation or a hedge refuses the reply.
  ["risk/unrelated-negation (d080)", "It comes on without warning and lasts for hours", ARMED, {}, after([], V1, "negated")],
  ["risk/hedge-cant-remember (d081)", "I can't remember exactly, maybe a few hours", ARMED, {}, after([], V1, "negated")],
  ["risk/voice-without-a-comma (d082)", "no it usually lasts for hours", ARMED, {}, after([], V1, "negated")],
  // R9 f in the cue's own utterance: a withheld duration opens no carry-over, only a yield-only slot
  // (round 3b; round 3 armed nothing); no duration arms a normal slot.
  ["R9f/hedge-opens-only-a-yield-only-slot (w001; 3b)", "I get dizzy, I don't know, seconds or hours.", null, {}, after(["v_vertigo=heard"], VY2, null)],
  ["R9f/since-opens-only-a-yield-only-slot (t012; 3b)", "I've been dizzy since Monday, and it lasts hours.", null, {}, after(["v_vertigo=heard"], VY2, null)],
  ["R9f/two-days-at-a-time-opens-only-a-yield-only-slot (w003; 3b)", "I'm dizzy for two days at a time", null, {}, after(["v_vertigo=heard"], VY2, null)],
  ["R9f/never-under-five-minutes-opens-only-a-yield-only-slot (t003; 3b)", "The dizziness is never under five minutes, it lasts hours", null, {},
    after(["v_vertigo=heard"], VY2, null)],
  // §13.11: a day range in another sentence is a stated band, so these open only a yield-only slot
  // (round 3: a normal slot on the first two, v 1 on the third, v 3 on the fourth).
  ["R11/excluded-phrase-in-another-sentence-opens-only-a-yield-only-slot (w005)", "I'm dizzy. It's been going on for two days.", null, {}, after(["v_vertigo=heard"], VY2, null)],
  ["R11/abbreviation-opens-only-a-yield-only-slot (w009)", "I'm dizzy, I told Dr. Lee it was for two days.", null, {}, after(["v_vertigo=heard"], VY2, null)],
  ["R11/a-day-range-elsewhere-disagrees-yield-only (w013)", "I'm dizzy for a few seconds. It's been going on for two days.", null, {}, after(["v_vertigo=heard"], VY2, null)],
  ["R11/overlapping-days-at-a-time-yield-only (w017)", "I get these dizzy spells. They last for two days at a time.", null, {}, after(["v_vertigo=heard"], VY2, null)],
];
// [label, patient lines in order, the expected brief result of each] (each line read with the slot
// the previous one returned).
const ROUND3_SEQUENCES = [
  ["unchanged/no-duration-arms-then-a-reply-carries (d084)", [DIZZY, "a few hours"],
    [after(["v_vertigo=heard"], ["v_vertigo", 2], null), after(["v_vertigo=2 via carry"], null, null, true)]],
  // Review F3: round 2 armed carry-over on the first line and carried "All week." as v 3. Since
  // round 3b the first line arms a yield-only slot, which carries nothing (round 3 armed nothing).
  ["F3/since-then-all-week (d076; 3b)", ["I've been dizzy since Monday, and it lasts hours.", "All week."],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null)]],
  // The same with a slot already open (an Expected line of round 3b): the withheld line turns it
  // yield-only, refreshed (§13.11), so "All week." is not carried (round 3 closed the slot; round 2
  // refreshed it and carried v 3).
  ["F3/an-open-slot-turns-yield-only (d085; 3b)", [DIZZY, "I've been dizzy since Monday, and it lasts hours.", "All week."],
    [after(["v_vertigo=heard"], ["v_vertigo", 2], null), after(["v_vertigo=heard"], VY2, "own-cue"), after([], VY1, null)]],
  // §13.11: the day range in the other sentence opens no carry-over, so the reply is not carried
  // (round 3 armed a normal slot and carried v 2: a recall cost, no false value).
  ["F4/a-day-range-elsewhere-opens-no-carry (d077; §13.11)", ["I'm dizzy. It's been going on for two days.", "About an hour."],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null)]],
  // Review ENG-R11-2: the day range shares a sentence with "vertigo", so it gives v 2 as in round 2;
  // round 3 armed a normal slot and carried "All week." as v 3.
  ["R11/any-cue-sentence-then-all-week (d091; §13.11)", ["I had vertigo for two days. Now I'm just dizzy.", "All week."],
    [after(["v_vertigo=2"], null, null), after([], null, null)]],
  ["R9d/two-values-open-no-window (d078; 3b)", ["I'm dizzy for two days at a time", "a few hours"],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null)]],
  ["R9b/a-hedge-opens-no-window (d075; 3b)", ["I get dizzy, I don't know, seconds or hours.", "a few hours"],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null)]],
  ["R9b/never-under-five-minutes-opens-no-window (d079; 3b)", ["The dizziness is never under five minutes, it lasts hours", "a few hours"],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null)]],
  // A refused reply uses up one reply of the window; a later reply in it can still carry.
  ["refused-reply-keeps-the-rest-of-the-window", [DIZZY, "For two days at a time.", "a few hours"],
    [after(["v_vertigo=heard"], ["v_vertigo", 2], null), after([], V1, "ambiguous"), after(["v_vertigo=2 via carry"], null, null, true)]],
  // Round 3 armed carry-over here and carried the pre-existing v 3 day band "All week."; since
  // §13.11 the first line opens only a yield-only slot (review F-R11-OVER72, the residual of §13.4).
  ["R11/a-day-range-elsewhere-no-longer-lets-all-week-carry (d092; §13.11)", ["I'm dizzy. It's been going on for two days.", "All week."],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null)]],
  // The round-3b defect (§13.10), an Expected line: after the withheld line round 3 left no slot, so
  // m_dur's yield to the pending v_vertigo did not cover the next line and m_dur was recorded as
  // Under 4 h (round 2 kept a normal slot and carried v 2). The yield-only slot keeps m_dur yielding,
  // and nothing is carried: no m_dur and no v_vertigo value.
  ["withheld/yield-only-slot-so-m_dur-yields (3b)", ["It hit me in a split second and the spinning lasted for hours", "it lasts a couple of hours"],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null)]],
];
// Round 3b on MASQUE (design 05 §13.10): [label, patient lines in order, the expected brief result of
// each], read as ROUND3_SEQUENCES. The Expected lines of the round-3b specification and its table
// not already above, with the behaviour notes of CHANGELOG.md, pinned as the engine behaves.
const ROUND3B_SEQUENCES = [
  // Expected: m_dur yields after the onset-guard line too (round 3: m_dur = 1).
  ["since-then-the-attack-line", ["I've been dizzy since Monday, and it lasts hours.", "it lasts a couple of hours"],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null)]],
  // The open slot turned yield-only keeps m_dur yielding (round 3: m_dur = 1).
  ["open-slot-then-since-then-the-attack-line", [DIZZY, "I've been dizzy since Monday, and it lasts hours.", "it lasts a couple of hours"],
    [after(["v_vertigo=heard"], ["v_vertigo", 2], null), after(["v_vertigo=heard"], VY2, "own-cue"), after([], VY1, null)]],
  // Expected, unchanged: with no band span the cue arms a normal slot, the attack line carries v 2
  // and m_dur yields.
  ["unchanged/dizzy-then-the-attack-line-carries", [DIZZY, "it lasts a couple of hours"],
    [after(["v_vertigo=heard"], ["v_vertigo", 2], null), after(["v_vertigo=2 via carry"], null, null, true)]],
  // Expected, unchanged: the reported conversation (gold d001, without its physician turn).
  ["unchanged/the-reported-conversation", [DIZZY, "as if the world is moving around me and I'm sitting still", "a few hours"],
    [after(["v_vertigo=heard"], ["v_vertigo", 2], null), after(["v_vertigo=heard"], ["v_vertigo", 2], "own-cue"),
      after(["v_vertigo=2 via carry"], null, null, true)]],
  // §13.11: the converted slot is refreshed with the full carry, so m_dur still yields on the attack
  // line (round 3b kept only the remaining count, the slot expired after "ok" and m_dur = 1 was
  // recorded where round 2 suppressed it: review F-3B-REMAINING-COUNT, gold d089).
  ["refreshed/a-converted-slot-is-refreshed (d089; §13.11)", [DIZZY, "I've been dizzy since Monday, and it lasts hours.", "ok", "it lasts a couple of hours"],
    [after(["v_vertigo=heard"], ["v_vertigo", 2], null), after(["v_vertigo=heard"], VY2, "own-cue"), after([], VY1, null),
      after([], null, null)]],
  // A yield-only slot armed where none was open gets the full carry: the attack line is its second
  // reply and m_dur still yields (round 3: m_dur = 1) …
  ["yield-only-slot-lasts-carry-replies", ["It hit me in a split second and the spinning lasted for hours", "ok", "it lasts a couple of hours"],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null), after([], null, null)]],
  // … and then expires: the expiry control, as for a skipped heard card.
  ["yield-only-slot-expires", ["It hit me in a split second and the spinning lasted for hours", "ok", "fine", "it lasts a couple of hours"],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null), after([], null, null), after(["m_dur=1"], null, null)]],
  // The cue heard again with no band re-arms a normal slot, and the next reply carries.
  ["heard-again-re-arms-a-normal-slot", ["It hit me in a split second and the spinning lasted for hours", "I feel dizzy again", "a few hours"],
    [after(["v_vertigo=heard"], VY2, null), after(["v_vertigo=heard"], ["v_vertigo", 2], null), after(["v_vertigo=2 via carry"], null, null, true)]],
  // m_dur yields to the pending v_vertigo, so "it lasts forever" is not a new cue awaiting a value and
  // does not clear the slot it yields to (rule 2) …
  ["a-yielding-line-keeps-the-slot", ["It hit me in a split second and the spinning lasted for hours", "it lasts forever", "it lasts a couple of hours"],
    [after(["v_vertigo=heard"], VY2, null), after([], VY1, null), after([], null, null)]],
  // … while a headache's duration is another topic: anchored, m_dur does not yield, awaits a value
  // and clears the slot, and the attack line then scores m_dur, as in round 3.
  ["another-topic-clears-the-slot", ["It hit me in a split second and the spinning lasted for hours", "my headache lasts forever", "it lasts a couple of hours"],
    [after(["v_vertigo=heard"], VY2, null), after(["m_head=1"], null, null), after(["m_dur=1"], null, null)]],
];

function round3(c, x, lex, at) {
  for (const [label, text, opts, want] of ROUND3_CASES) {
    const got = attempt(c, at(`/round3/${label}`), { text, opts }, () => x.extract(lex, text, opts));
    if (got !== undefined) c.diff(want, tags(got), { at: at(`/round3/${label}`), input: { text, opts } });
  }
  const armed = attempt(c, at("/round3/armed"), { text: DIZZY }, () => x.extractInContext(lex, DIZZY, null));
  if (armed !== undefined) {
    for (const [label, text, slot, opts, want] of ROUND3_REPLIES) {
      const where = at(`/round3/reply/${label}`);
      const pending = slot === ARMED ? armed.pending : null;
      const r = attempt(c, where, { text, pending, opts }, () => x.extractInContext(lex, text, pending, opts));
      if (r !== undefined) c.diff(want, brief(r), { at: where, input: { text, pending, opts } });
    }
  }
  for (const [prefix, table] of [["/round3/sequence", ROUND3_SEQUENCES], ["/round3b/sequence", ROUND3B_SEQUENCES]]) {
    for (const [label, lines, want] of table) {
      const where = at(`${prefix}/${label}`);
      const got = attempt(c, where, { lines }, () => {
        let slot = null;
        return lines.map((text) => { const r = x.extractInContext(lex, text, slot); slot = r.pending; return brief(r); });
      });
      if (got !== undefined) c.diff(want, got, { at: where, input: { lines } });
    }
  }
  c.note(`block 2: round 3 on lexicon ${lex.version}: ${ROUND3_CASES.length} utterances, ${ROUND3_REPLIES.length} replies and ${ROUND3_SEQUENCES.length} sequences (R9-R11, the round-2 review traces and the §13.6 known risks); round 3b: ${ROUND3B_SEQUENCES.length} sequences (the yield-only slot, §13.10)`);
}

// AD13 self-checks (design 05 §13.8, review T5). The extraction normaliser of AD13
// (tests/harness/diff.js) excuses differences between lexicon 0.3.1 and 0.3.2 captures; a bug that
// widened it would pass every audit silently, so it is fed crafted pairs here, including pairs it
// must NOT excuse. The captures are crafted, not engine output.
const AD13_PATH = "/extract032/selfcheck";
// [label, text, captures a, captures b (each [id, value, kind, cueIndex], evidence = text), excused].
const AD13_PAIRS = [
  // Rule Tn (number spelling): only value or presence changes of the one capture of a scale entry
  // whose band phrases spelling can change; evidence and cueIndex must agree.
  ["Tn/entry-without-a-band-stays-strict", "I have had it for 10 days", [["i_days", 3, "item", 0]], [], false],
  ["Tn/red-flag-stays-strict", "I have had it for 10 days", [["rf_focal", true, "redflag", 0]], [], false],
  ["Tn/yes-no-stays-strict", "I feel nauseous 2 times a day", [["m_nausea", "yes", "item", 7]], [], false],
  ["Tn/value-change-is-excused", "the room spins for 2 hours", [["v_vertigo", 2, "item", 4]], [["v_vertigo", 1, "item", 4]], true],
  ["Tn/appearance-is-excused", "the room spins for 2 hours", [["v_vertigo", 2, "item", 4]], [], true],
  ["Tn/cueIndex-change-stays-strict", "the room spins for 2 hours", [["v_vertigo", 2, "item", 4]], [["v_vertigo", 1, "item", 9]], false],
  ["Tn/two-captures-of-one-id-stay-strict", "the room spins for 2 hours", [["v_vertigo", 2, "item", 4], ["v_vertigo", 1, "item", 4]], [], false],
  ["Tn/a-red-flag-kind-stays-strict", "the room spins for 2 hours", [["v_vertigo", true, "redflag", 4]], [], false],
  ["Tn/entry-without-a-band-in-a-spelled-text-stays-strict", "the room spins for 2 hours", [["i_days", 3, "item", 4]], [], false],
  // Rule H (heard band choice): with no negation cue, no carryRefuse phrase and agreeing spans the
  // value must not differ; a negation cue before a span excuses that entry, and only that entry.
  ["H/agreeing-spans-stay-strict", "the room spins for hours", [["v_vertigo", 2, "item", 4]], [["v_vertigo", 1, "item", 4]], false],
  ["H/negation-before-a-span-is-excused", "the room spins, not for hours", [["v_vertigo", 2, "item", 4]], [], true],
  ["H/another-entry-stays-strict", "the room spins, not for hours", [["i_days", 3, "item", 4]], [], false],
];
// [text, whether v_vertigo's band choice as a heard entry may differ from the first band in band
// order (rule H, heardBandChoiceMayDiffer)].
const AD13_RULE_H = [
  ["I'm dizzy. It's been going on for two days.", true],
  ["I'm dizzy for two days at a time", true],
  ["the room spins, not for hours", true],
  ["the room spins since monday for hours", true],
  ["I get dizzy, I don't know, seconds or hours.", true],
  ["the room spins for hours", false],
  // Round 3c (§13.11): the excluded day range elsewhere still disagrees, so heard gives no value
  // where the band-order rule gives v 1 (round 3 ignored it and agreed with the band-order rule).
  ["I'm dizzy for a few seconds. It's been going on for two days.", true],
  ["I get these dizzy spells. They last for two days at a time.", true],
  // The excluded span lies in the opening cue's sentence and agrees with the other span: v 2 both ways.
  ["I've been dizzy for two days. Each spell lasts about an hour.", false],
];
/** The scale entries rule Tn covers in the shipped lexicon: those with a band phrase spelling can change. */
const AD13_TN_IDS = ["m_dur", "v_vertigo"];
/** Texts for the number-rule cross-check; "#" becomes each of 0 … 100. */
const NUMBER_TEMPLATES = ["x # y", "#.", "#.5", "a#", "#:30", "#-4", "0#", "(#)", "x #, y", "x #/2", "#%", "x #.\ny"];
/** The integers lexicon.normalize.numbers "en" spells, in the order of AD13_NUMBER_WORDS. */
const SPELLED_INTEGERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 30, 40, 50, 60, 70, 80, 90];

function ad13SelfChecks(c, x, lex, at, corpus) {
  const where = (p) => at(`/AD13-selfcheck${p}`);
  const d = attempt(c, where("/allowedDifference"), null, () => allowedDifference("AD13"));
  if (d === undefined) return;
  const ctxOf = (text) => ({ AD13: { delta: LEXICON_DELTA, text, lexicon: lex } });
  const applies = attempt(c, where("/appliesTo"), { path: AD13_PATH }, () => d.appliesTo(AD13_PATH, ctxOf("")));
  c.check(applies === true, where("/appliesTo"), { path: AD13_PATH }, true, applies);

  // Crafted pairs. Not excused: the normaliser returns its inputs; excused: [b, b].
  const capsOf = (rows, text) => rows.map(([id, value, kind, cueIndex]) => ({ id, value, kind, evidence: text, cueIndex }));
  for (const [label, text, rowsA, rowsB, excused] of AD13_PAIRS) {
    const at2 = where(`/pair/${label}`);
    attempt(c, at2, { text }, () => {
      const a = capsOf(rowsA, text), b = capsOf(rowsB, text);
      const [na, nb] = d.normalise(a, b, ctxOf(text), AD13_PATH);
      const got = JSON.stringify(na) === JSON.stringify(nb);
      c.check(got === excused, at2, { text, a, b, rules: ad13Explain(ctxOf(text).AD13, a, b) },
        excused ? "excused" : "not excused", got ? "excused" : "not excused");
    });
  }
  const tn = attempt(c, where("/Tn-entries"), null, () => ad13Explain(ctxOf("the room spins for 2 hours").AD13, [], []));
  if (tn !== undefined) c.diff(AD13_TN_IDS, isObj(tn) ? tn.Tn : tn, { at: where("/Tn-entries"), input: { text: "the room spins for 2 hours" } });

  // Rule H on the round-3 review traces.
  const vv = arr(lex.scale).find((e) => isObj(e) && e.id === "v_vertigo");
  for (const [text, want] of AD13_RULE_H) {
    const got = attempt(c, where(`/rule-H/${text}`), { text }, () => heardBandChoiceMayDiffer(lex, vv, text));
    if (got !== undefined) c.check(got === want, where(`/rule-H/${text}`), { text }, want, got);
  }

  // The number rule diff.js copies by hand (AD13_NUMBER_WORDS and the token rule of
  // normalizeRewrites), against the engine: the probe lexicon's one band is every number word, so
  // the engine spelled a token exactly when the probe captures with numbers "en" and not without.
  const probe = numberProbeLexicon();
  const plain = numberProbeLexicon(null);
  const probed = (lx, text) => arr(x.extract(lx, text)).some((cp) => isObj(cp) && cp.id === "probe" && cp.value === 1);
  /** true / false: whether the engine spelled a token of `text`; null when a number word occurs in it literally. */
  const engineSpelled = (text) => (probed(plain, text) ? null : probed(probe, text));
  const mismatch = [];
  let crafted = 0, spelled = 0;
  for (let k = 0; k <= 100; k++) {
    for (const tpl of NUMBER_TEMPLATES) {
      const text = tpl.replace("#", String(k));
      const engine = attempt(c, where(`/number-rule/${JSON.stringify(text)}`), { text }, () => engineSpelled(text));
      if (engine === undefined) continue;
      const harness = normalizeRewrites(text, { numbers: "en" }).numbers;
      crafted += 1;
      if (engine === true) spelled += 1;
      if (engine !== harness) mismatch.push({ text, engine, normalizeRewrites: harness });
    }
  }
  c.check(!mismatch.length, where("/number-rule/crafted"), { mismatch: mismatch.slice(0, 20) }, "normalizeRewrites(t).numbers === the engine spelled a token of t", `${mismatch.length} mismatch(es)`);
  c.check(crafted === 101 * NUMBER_TEMPLATES.length && spelled > 0, where("/number-rule/crafted/count"), null,
    { crafted: 101 * NUMBER_TEMPLATES.length, spelled: "> 0" }, { crafted, spelled });
  const words = [];
  c.check(SPELLED_INTEGERS.length === AD13_NUMBER_WORDS.length, where("/number-words/length"), null, SPELLED_INTEGERS.length, AD13_NUMBER_WORDS.length);
  SPELLED_INTEGERS.forEach((n, i) => {
    const w = AD13_NUMBER_WORDS[i];
    const lx = numberProbeLexicon();
    lx.scale[0].bands = [{ ph: [` ${w} `], v: 1 }];
    const ok = attempt(c, where(`/number-words/${n}`), { n, w }, () => probed(lx, `x ${n} y`));
    if (ok === false) words.push({ n, word: w });
  });
  c.diff([], words, { at: where("/number-words"), input: "each AD13_NUMBER_WORDS word is the engine's spelling of its integer" });
  const corpusMismatch = [];
  let checked = 0;
  for (const text of corpus) {
    if (typeof text !== "string") continue;
    const engine = attempt(c, where("/number-rule/corpus"), { text }, () => engineSpelled(text));
    if (engine === undefined || engine === null) continue;
    checked += 1;
    const harness = normalizeRewrites(text, { numbers: "en" }).numbers;
    if (engine !== harness) corpusMismatch.push({ text, engine, normalizeRewrites: harness });
  }
  c.check(!corpusMismatch.length && checked > 0, where("/number-rule/corpus"), { checked, mismatch: corpusMismatch.slice(0, 20) },
    "normalizeRewrites(t).numbers === the engine spelled a token of t, on every corpus text", `${corpusMismatch.length} mismatch(es) in ${checked}`);
  c.note(`block 2: AD13 self-checks: ${AD13_PAIRS.length} crafted capture pairs (${AD13_PAIRS.filter((p) => !p[4]).length} that must not be excused), ${AD13_RULE_H.length} rule-H texts, the number rule on ${crafted} crafted texts (${spelled} spelled) and ${checked} corpus texts without a literal number word, ${SPELLED_INTEGERS.length} number words`);
}

async function block2(c, h, x, module, lex031, out) {
  const at = (p) => `/block2${p}`;
  const lex = module.lexicon;

  // The reference set 0.2.0 (44 cases), pinned: a mismatch is INVALID.
  let reference = null;
  try {
    const bytes = await h.fetchBytes(REFERENCE_GOLD_PATH);
    const sha = await h.sha256(bytes);
    if (sha !== REFERENCE_GOLD_SHA256) {
      const e = new Error(`reference gold set ${REFERENCE_GOLD_PATH}: sha256 ${sha.slice(0, 12)}… ≠ pinned ${REFERENCE_GOLD_SHA256.slice(0, 12)}…`);
      e.invalid = true;
      throw e;
    }
    reference = decodeJson(bytes);
  } catch (err) {
    if (err && err.invalid) throw err;
    c.check(false, at("/reference"), { path: REFERENCE_GOLD_PATH }, "the v0.2.0 gold set (44 utterances)", `unreadable: ${err && err.message}`);
  }

  // The gold set 0.3.0; its pin is judged by the caller.
  let gold = null;
  try {
    const bytes = await h.fixture(GOLD_0_3_0_FIXTURE, "bytes");
    out.goldSha = await h.sha256(bytes);
    gold = decodeJson(bytes);
  } catch (err) {
    c.check(false, at("/gold"), { path: `tests/fixtures/${GOLD_0_3_0_FIXTURE}` }, "the gold set 0.3.0", `unreadable: ${err && err.message}`);
  }

  d4(c, x, lex, at);
  round2(c, x, lex, at);
  round3(c, x, lex, at);
  const corpus = [
    ...[...D4_CASES, ...ROUND2_CASES, ...ROUND2_UNFOLDED, ...ROUND3_CASES].map((row) => row[1]),
    ...[...ROUND2_REPLIES, ...ROUND3_REPLIES].map((row) => row[1]),
    ...(reference ? arr(reference.cases) : []).map((k) => isObj(k) && k.text),
    ...(gold ? arr(gold.cases) : []).map((k) => isObj(k) && k.text),
    ...(gold ? arr(gold.dialogues) : []).flatMap((dl) => (isObj(dl) ? arr(dl.turns) : [])).map((t) => (Array.isArray(t) && t[0] === "pt" ? t[1] : null)),
  ];
  ad13SelfChecks(c, x, lex, at, corpus);
  if (!reference || !gold) return;

  const refCases = arr(reference.cases);
  const refVersion = isObj(reference._meta) ? reference._meta.version : undefined;
  c.check(refCases.length === REFERENCE_CASES, at("/reference/cases"), null, REFERENCE_CASES, refCases.length);
  const meta = isObj(gold._meta) ? gold._meta : {};
  const basedOn = isObj(meta.basedOn) ? meta.basedOn : {};
  const goldSet = isObj(lex.goldSet) ? lex.goldSet : {};
  c.diff(REFERENCE_GOLD_SHA256, basedOn.sha256, { at: at("/gold/_meta/basedOn/sha256") });
  c.diff(REFERENCE_CASES, basedOn.cases, { at: at("/gold/_meta/basedOn/cases") });
  c.diff(refVersion, basedOn.version, { at: at("/gold/_meta/basedOn/version") });
  c.diff(goldSet.version, meta.version, { at: at("/gold/_meta/version") });
  c.diff(goldSet.lexiconVersion, meta.lexiconVersion, { at: at("/gold/_meta/lexiconVersion") });
  c.diff(lex.version, meta.lexiconVersion, { at: at("/gold/_meta/lexiconVersion-is-the-shipped-lexicon") });
  c.diff(GOLD_0_3_0_FIXTURE.split("/").pop(), goldSet.file, { at: at("/lexicon/goldSet/file") });

  const newCases = arr(gold.cases);
  const dialogues = arr(gold.dialogues);
  const ids = [...refCases.map((k) => k.utteranceId), ...newCases.map((k) => k.utteranceId), ...dialogues.map((d) => d.dialogueId)];
  c.diff([], ids.filter((id, i) => typeof id !== "string" || ids.indexOf(id) !== i), { at: at("/gold/ids-unique") });

  // Per-utterance cases: [id, value] pairs set-equal to expect, heard ids set-equal to expectHeard.
  const rows = [];
  for (const [origin, list] of [[refVersion, refCases], [meta.version, newCases]]) {
    for (const kase of list) {
      const id = kase.utteranceId;
      const text = kase.text;
      const caps = attempt(c, at(`/cases/${id}`), { text }, () => x.extract(lex, text, { includeHeard: true }));
      if (caps === undefined) continue;
      const want = [...new Set(arr(kase.expect).map((p) => pairKey(p[0], p[1])))].sort();
      const got = [...new Set(arr(caps).filter(isValueCapture).map((cp) => pairKey(cp.id, cp.value)))].sort();
      c.diff(want, got, { at: at(`/cases/${id}/expect`), input: { text } });
      const wantHeard = [...new Set(arr(kase.expectHeard))].sort();
      const gotHeard = [...new Set(arr(caps).filter(isHeardCapture).map((cp) => cp.id))].sort();
      c.diff(wantHeard, gotHeard, { at: at(`/cases/${id}/expectHeard`), input: { text } });
      const wantSet = new Set(want), gotSet = new Set(got);
      rows.push({
        kase, origin,
        tp: got.filter((k) => wantSet.has(k)).length,
        fp: got.filter((k) => !wantSet.has(k)).length,
        fn: want.filter((k) => !gotSet.has(k)).length,
        labelled: want.length,
        heardLabelled: wantHeard.length,
        heardFound: wantHeard.filter((k) => gotHeard.includes(k)).length,
        heardExtra: gotHeard.filter((k) => !wantHeard.includes(k)).length,
      });
    }
  }

  // Dialogues, run as the Scribe runs them.
  let dialoguesApplied = 0, dialoguesRefused = 0, patientSteps = 0, agree = 0, labelledCarry = 0;
  const labelledRefusals = {};
  for (const d of dialogues) {
    const did = d.dialogueId;
    const turns = arr(d.turns);
    const labels = arr(d.steps);
    c.check(turns.length === labels.length, at(`/dialogues/${did}/steps/length`), null, turns.length, labels.length);
    const run = attempt(c, at(`/dialogues/${did}`), { turns }, () => runDialogue(x, lex, turns, true));
    const pure = attempt(c, at(`/dialogues/${did}/pure`), { turns }, () => runDialogue(x, lex, turns, false));
    if (run === undefined) continue;
    if (pure !== undefined && JSON.stringify(pure) === JSON.stringify(run)) agree += 1;
    const carried = (s) => JSON.stringify(isObj(s) ? arr(s.captures).filter((t) => Array.isArray(t) && t[2] === "carry") : null);
    let okApplied = true, okRefused = true;
    turns.forEach((turn, k) => {
      const want = labels[k] === undefined ? null : labels[k];
      const got = run[k];
      c.diff(want, got, { at: at(`/dialogues/${did}/steps/${k}`), input: { turn } });
      if (isObj(want)) {
        if (arr(want.captures).some((t) => Array.isArray(t) && t[2] === "carry")) labelledCarry += 1;
        if (typeof want.refused === "string") labelledRefusals[want.refused] = (labelledRefusals[want.refused] || 0) + 1;
      }
      if (got === null) return;
      patientSteps += 1;
      if (carried(want) !== carried(got)) okApplied = false;
      if (!isObj(want) || want.refused !== got.refused) okRefused = false;
    });
    if (okApplied) dialoguesApplied += 1;
    if (okRefused) dialoguesRefused += 1;
  }

  // No regression: the 44 reference cases under the shipped lexicon and the 0.3.1-equivalent one.
  let unchanged = 0;
  if (lex031) {
    for (const kase of refCases) {
      let ok = true;
      for (const opts of [{}, { includeSuppressed: true }]) {
        const where = at(`/noRegression/${kase.utteranceId}${opts.includeSuppressed ? "/includeSuppressed" : ""}`);
        const r = attempt(c, where, { text: kase.text, opts }, () => same(c, x.extract(lex031, kase.text, opts), x.extract(lex, kase.text, opts), where, { text: kase.text, opts }));
        if (r !== true) ok = false;
      }
      if (ok) unchanged += 1;
    }
  }

  // Benchmark (heard excluded from P/R and checked exactly above).
  const micro = prf(sum(rows, "tp"), sum(rows, "fp"), sum(rows, "fn"));
  const flagCase = (row) => arr(row.kase.expect).some((p) => !!(module.flagById && module.flagById[p[0]]));
  const slices = [
    ["clinical items only", rows.filter((row) => !flagCase(row))],
    ["red flags only", rows.filter(flagCase)],
    ["encounter register", rows.filter((row) => row.kase.register === "encounter")],
    ["narrative register", rows.filter((row) => row.kase.register === "narrative")],
  ];
  const refRows = rows.filter((row) => row.origin === refVersion);
  const newRows = rows.filter((row) => row.origin !== refVersion);
  const heardLabelled = sum(rows, "heardLabelled");
  const benchmark = { tp: micro.tp, fp: micro.fp, fn: micro.fn, dialoguesApplied, dialoguesRefused };
  out.benchmark = benchmark;
  const lines = [];
  lines.push(`lexicon ${lex.version} · ${x.EXTRACTOR_KIND} · features ${arr(x.EXTRACTOR_FEATURES).join(", ")} · development set ${meta.version}`);
  lines.push(`!! ${String(meta.provenance || "").split(".")[0]}.`);
  lines.push("!! These are development figures, not validation results.");
  // Design 05 §12.7 (R6): the 0.3.0 labels are the extractor's own output, so the pin is a regression
  // snapshot and P/R/F1 on it measures nothing.
  lines.push(`!! The ${meta.version} labels are the ${meta.lexiconVersion} extractor's own output (regression snapshot); P/R/F1 on them is tautological, not a measurement.`);
  if (micro.f1 === null || micro.f1 < SATURATED_F1) lines.push("!! F1 is below 97%: a label and the extractor disagree (see the differences).");
  lines.push("");
  lines.push(`utterances ${rows.length} (${refRows.length} from ${refVersion} + ${newRows.length} added in ${meta.version}) · labelled extractions ${sum(rows, "labelled")} (${sum(refRows, "labelled")} + ${sum(newRows, "labelled")})`);
  lines.push(`  micro  P ${pct(micro.p)}  R ${pct(micro.r)}  F1 ${pct(micro.f1)}  (tp ${micro.tp} fp ${micro.fp} fn ${micro.fn})`);
  lines.push(`  heard  ${heardLabelled} labelled heard ids in ${meta.version} cases, checked exactly, excluded from P/R: ${sum(rows, "heardFound")}/${heardLabelled} found, ${sum(rows, "heardExtra")} unlabelled`);
  lines.push("");
  lines.push("BY SLICE (each with its denominator)");
  for (const [name, set] of slices) {
    const s = prf(sum(set, "tp"), sum(set, "fp"), sum(set, "fn"));
    lines.push(`  ${name.padEnd(22)} P ${pct(s.p)}  R ${pct(s.r)}  F1 ${pct(s.f1)}  n=${set.length}`);
  }
  lines.push("");
  lines.push(`DIALOGUES (${dialogues.length}, ${patientSteps} patient steps)`);
  lines.push(`  carry applied as labelled   ${dialoguesApplied}/${dialogues.length}`);
  lines.push(`  refused as labelled         ${dialoguesRefused}/${dialogues.length}`);
  lines.push("");
  lines.push(lex031
    ? `no-regression: the ${refCases.length} cases of ${refVersion} give the same output under lexicon ${lex.version} as under ${lex031.version}: ${unchanged}/${refCases.length}`
    : `no-regression: not run (no ${LEXICON_DELTA.from}-equivalent lexicon)`);
  out.lines = lines;
  c.note(`block 2: ${rows.length} cases, ${dialogues.length} dialogues (${patientSteps} patient steps; ${labelledCarry} labelled carry steps; labelled refusals ${Object.entries(labelledRefusals).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}); the Scribe emulation and the pure engine runner agree on ${agree}/${dialogues.length} dialogues`);
}

// --------------------------------------------------------------------- block 3: Scribe helpers

function block3(c, scribe, vocab, module, x) {
  const at = (p) => `/block3${p}`;
  const K = vocab.CAPTURE_KIND || {};
  c.diff("heard", K.HEARD, { at: at("/CAPTURE_KIND/HEARD") });
  const item = module.itemById ? module.itemById.v_vertigo : undefined;
  c.check(!!item, at("/module/v_vertigo"), null, "the MASQUE item v_vertigo", item);

  // ingestCaptures: heard is never an answer; a carry is an item capture (first write wins).
  const heardCap = { id: "v_vertigo", kind: "heard", evidence: "I'm feeling really dizzy", cueIndex: 19, cue: "dizzy", cueText: "dizzy" };
  const carried = { id: "v_vertigo", value: 2, kind: "item", evidence: "a few hours", cueIndex: 6, via: "carry", band: "hours",
    carriedFrom: { cue: "dizzy", cueText: "dizzy", evidence: "I'm feeling really dizzy", cueIndex: 19 } };
  const state = { answers: { m_head: 1 }, ctx: { c_dur: ">12mo" }, rf: { rf_focal: "md" } };
  const ingest = (s, caps, label) => attempt(c, at(`/ingestCaptures/${label}`), { caps }, () => scribe.ingestCaptures(s, caps));
  const r1 = ingest(state, [heardCap], "heard-only");
  if (r1 !== undefined) c.diff({ ...state, touchedDomainItemIds: [] }, r1, { at: at("/ingestCaptures/heard-only") });
  const r2 = ingest({ answers: {}, ctx: {}, rf: {} }, [heardCap, carried], "heard-then-carry");
  if (r2 !== undefined) c.diff({ answers: { v_vertigo: 2 }, ctx: {}, rf: {}, touchedDomainItemIds: ["v_vertigo"] }, r2, { at: at("/ingestCaptures/heard-then-carry") });
  const r3 = ingest({ answers: { v_vertigo: 1 } }, [carried], "carry-never-overwrites");
  if (r3 !== undefined) c.diff({ v_vertigo: 1 }, r3.answers, { at: at("/ingestCaptures/carry-never-overwrites") });
  const r4 = ingest({ answers: {} }, [{ id: "v_vertigo", value: 1, kind: "item", evidence: "x", cueIndex: 0 }, carried], "first-write-in-the-batch");
  if (r4 !== undefined) c.diff({ v_vertigo: 1 }, r4.answers, { at: at("/ingestCaptures/first-write-in-the-batch") });

  // heardPrompts: items only, unanswered, not skipped, newest first, one per id.
  const idsOf = (xs) => arr(xs).map((s) => s && s.id);
  const heard = [{ id: "v_head", cueText: "first" }, { id: "zz_not_an_item", cueText: "x" }, { id: "v_vertigo", cueText: "dizzy" },
    { id: "v_head", cueText: "older" }, { id: "m_nausea", cueText: "y" }, { id: "x_purulent", cueText: "z" }];
  const hp = (args, label) => attempt(c, at(`/heardPrompts/${label}`), args, () => scribe.heardPrompts(module, args));
  const all = hp({ heard }, "order-and-dedupe");
  if (all !== undefined) {
    c.diff(["v_head", "v_vertigo", "m_nausea", "x_purulent"], idsOf(all), { at: at("/heardPrompts/order-and-dedupe") });
    c.diff(["first", "dizzy", "y", "z"], arr(all).map((s) => s && s.cueText), { at: at("/heardPrompts/newest-cue-text-wins") });
  }
  const answered = hp({ heard, answers: { m_nausea: "yes", v_vertigo: 2 } }, "answered");
  if (answered !== undefined) c.diff(["v_head", "x_purulent"], idsOf(answered), { at: at("/heardPrompts/answered") });
  const skipped = hp({ heard, skipped: { v_head: true } }, "skipped");
  if (skipped !== undefined) c.diff(["v_vertigo", "m_nausea", "x_purulent"], idsOf(skipped), { at: at("/heardPrompts/skipped") });
  const none = hp({}, "none");
  if (none !== undefined) c.diff([], none, { at: at("/heardPrompts/none") });
  const one = hp({ heard: [{ id: "v_vertigo", cueText: "dizzy" }] }, "shape");
  if (one !== undefined) {
    c.diff([{ id: "v_vertigo", ask: "When the spinning or imbalance comes, how long does one episode last?", tag: "VM-PATHI · disequilibrium",
      scale: item ? item.scale : undefined, kind: "heard", cueText: "dizzy" }], one, { at: at("/heardPrompts/shape"), keyOrder: true });
  }
  // The same builder as a scored suggestion, for every item of the module (domain activity not consulted).
  for (const it of arr(module.allItems)) {
    attempt(c, at(`/heardPrompts/builder/${it.id}`), null, () => {
      const others = {};
      for (const o of module.allItems) if (o.id !== it.id) others[o.id] = Array.isArray(o.scale) ? 0 : "no";
      // scorable: false — the widened pool, domain activity not consulted (F12, AD18).
      const sug = scribe.rankSuggestions(module, { answers: others, scorable: false }).list.filter((s) => s.kind === "scored")
        .map((s) => ({ id: s.id, ask: s.ask, tag: s.tag, scale: s.scale }));
      const got = scribe.heardPrompts(module, { heard: [{ id: it.id, cueText: "q" }] })
        .map((s) => ({ id: s.id, ask: s.ask, tag: s.tag, scale: s.scale }));
      c.diff(sug, got, { at: at(`/heardPrompts/builder/${it.id}`) });
    });
  }

  // askNextSections: rank-0 (safety) groups, then the heard section, then every other group.
  const PK = vocab.PROBE_KIND || {};
  const isTop = (g) => Object.prototype.hasOwnProperty.call(PK, g.kind) && PK[g.kind].rank === 0;
  const groups = [...arr(vocab.PROBE_KIND_ORDER), "zz_unknown_kind"].map((kind) => ({ kind, shown: [{ id: `probe_${kind}` }], total: 1 }));
  c.check(groups.some(isTop), at("/askNextSections/vocabulary-has-a-rank-0-kind"), null, "a PROBE_KIND with rank 0", arr(vocab.PROBE_KIND_ORDER));
  const items = arr(one);
  const probes = (gs) => gs.map((group) => ({ kind: "probes", group }));
  const rest = groups.filter((g) => !isTop(g));
  const SECTIONS = [
    ["safety-heard-rest", groups, items, [...probes(groups.filter(isTop)), { kind: "heard", items }, ...probes(rest)]],
    ["no-rank-0-group", rest, items, [{ kind: "heard", items }, ...probes(rest)]],
    ["no-heard", groups, [], probes(groups)],
    ["heard-only", [], items, [{ kind: "heard", items }]],
    ["nothing", [], [], []],
  ];
  for (const [label, gs, hs, want] of SECTIONS) {
    const got = attempt(c, at(`/askNextSections/${label}`), null, () => scribe.askNextSections(gs, hs));
    if (got === undefined) continue;
    c.diff(want, got, { at: at(`/askNextSections/${label}`) });
    const sameObjects = Array.isArray(got) && got.length === want.length
      && got.every((s, i) => (s && s.kind === "heard" ? s.items === hs : !!s && s.group === want[i].group));
    c.check(sameObjects, at(`/askNextSections/${label}/same-objects`), null, "the groups and the heard list passed in", got);
  }

  // rankSuggestions: exclude [] is the default; exclude removes from the open pool and still fills.
  const rank = (s, label) => attempt(c, at(`/rankSuggestions/${label}`), s, () => scribe.rankSuggestions(module, s));
  const states = [
    ["empty", {}],
    ["scorable", { scorable: true }],
    ...arr(module.phenotypes && module.phenotypes.values).map((v) => [`complaint-${v.value}`, { complaint: v.value }]),
    ["partly-answered", { answers: { v_vertigo: 2, m_head: 1, r_dur: "yes" } }],
  ];
  for (const [label, s] of states) {
    const base = rank(s, label);
    if (base === undefined) continue;
    const withEmpty = rank({ ...s, exclude: [] }, `${label}/exclude-empty`);
    if (withEmpty !== undefined) c.diff(base, withEmpty, { at: at(`/rankSuggestions/${label}/exclude-empty`) });
    const scored = arr(base.list).filter((q) => q.kind === "scored").map((q) => q.id);
    if (!scored.length) continue;
    const ex = scored.slice(0, 2);
    const viaExclude = rank({ ...s, exclude: ex }, `${label}/exclude`);
    const skip = {};
    for (const id of ex) skip[id] = true;
    const viaSkip = rank({ ...s, skipped: skip }, `${label}/skipped`);
    if (viaExclude !== undefined && viaSkip !== undefined) c.diff(viaSkip, viaExclude, { at: at(`/rankSuggestions/${label}/exclude-equals-skip`) });
    if (viaExclude !== undefined) c.check(!arr(viaExclude.list).some((q) => ex.includes(q.id)), at(`/rankSuggestions/${label}/excluded-absent`), { exclude: ex }, "no excluded id", idsOf(viaExclude.list));
  }
  const maxScored = module.infoPrompts && Number.isInteger(module.infoPrompts.maxScored) ? module.infoPrompts.maxScored : 4;
  const open = rank({ scorable: true }, "fill");
  if (open !== undefined) {
    const first = arr(open.list).find((q) => q.kind === "scored");
    const filled = first ? rank({ scorable: true, exclude: [first.id] }, "fill/exclude") : undefined;
    if (filled !== undefined) c.diff(maxScored, arr(filled.list).filter((q) => q.kind === "scored").length, { at: at("/rankSuggestions/fills-to-maxScored") });
  }

  // The §2.1 strings for MASQUE, exactly.
  const FROM = "episode duration: 5 min – 72 h · follow-up to “dizzy”";
  const HEARD = "heard “dizzy” · episode duration: not stated";
  const STRINGS = [
    ["heardLabel", () => scribe.heardLabel(module, heardCap), HEARD],
    ["captureLabel/heard-engine-capture", () => scribe.captureLabel(module, heardCap), HEARD],
    ["captureLabel/heard-transcript-tag", () => scribe.captureLabel(module, { id: "v_vertigo", kind: "heard", cueText: "dizzy" }), HEARD],
    ["heardLabel/without-cue-text", () => scribe.heardLabel(module, { id: "v_vertigo", kind: "heard" }), "heard · episode duration: not stated"],
    ["heardLabel/unknown-id", () => scribe.heardLabel(module, { id: "zz_not_an_item", kind: "heard", cueText: "something" }), "heard “something” · zz_not_an_item: not stated"],
    ["captureLabel/carry-engine-capture", () => scribe.captureLabel(module, carried), FROM],
    ["captureLabel/carry-transcript-tag", () => scribe.captureLabel(module, { id: "v_vertigo", value: 2, kind: "item", via: "carry", fromCueText: "dizzy" }), FROM],
    ["captureLabel/carry-without-cue-text", () => scribe.captureLabel(module, { id: "v_vertigo", value: 2, kind: "item", via: "carry" }), "episode duration: 5 min – 72 h · follow-up"],
    ["captureLabel/item-unchanged", () => scribe.captureLabel(module, { id: "v_vertigo", value: 2, kind: "item" }), "episode duration: 5 min – 72 h"],
    ["bubble/carry-tag", () => "+ " + scribe.captureLabel(module, carried), "+ " + FROM],
    ["interim/heard-tag", () => "? " + scribe.heardLabel(module, heardCap), "? " + HEARD],
    ["heard-card/tag-line", () => { const s = scribe.heardPrompts(module, { heard: [{ id: "v_vertigo", cueText: "dizzy" }] })[0]; return `${s.tag} · heard “${s.cueText}”`; },
      "VM-PATHI · disequilibrium · heard “dizzy”"],
    ["heard-card/question", () => scribe.heardPrompts(module, { heard: [{ id: "v_vertigo", cueText: "dizzy" }] })[0].ask,
      "When the spinning or imbalance comes, how long does one episode last?"],
    ["engine/heard-capture-label", () => {
      const r = x.extractInContext(module.lexicon, "I'm feeling really dizzy", null);
      const cp = arr(r.captures).find((q) => isObj(q) && q.kind === "heard");
      return cp ? scribe.captureLabel(module, cp) : null;
    }, HEARD],
    ["engine/carry-capture-label", () => {
      const armed = x.extractInContext(module.lexicon, "I'm feeling really dizzy", null);
      const r = x.extractInContext(module.lexicon, "a few hours", armed.pending);
      const cp = arr(r.captures).find((q) => isObj(q) && q.via === "carry");
      return cp ? scribe.captureLabel(module, cp) : null;
    }, FROM],
  ];
  for (const [label, fn, want] of STRINGS) {
    const got = attempt(c, at(`/strings/${label}`), null, fn);
    if (got !== undefined) c.diff(want, got, { at: at(`/strings/${label}`) });
  }
}

// --------------------------------------------------------------------------- block 4: F4 property

async function block4(c, h, x, lex, lex031) {
  const at = (p) => `/block4${p}`;
  const noYield = clone(lex);
  for (const e of arr(noYield.scale)) if (isObj(e)) { delete e.yieldTo; delete e.anchor; }
  const appended = arr(LEXICON_DELTA.appended).flatMap((row) => arr(row && row.phrases)).filter(isPhrase);
  const neg = cueSpecOf(lex.negation), third = cueSpecOf(lex.thirdParty), hist = cueSpecOf(lex.historical);
  c.check(third.cues.includes("my mother") && hist.cues.includes("used to"), at("/prefixes-are-lexicon-cues"), null,
    "\"my mother\" an attribution cue and \"used to\" a history cue", { thirdParty: third.cues, historical: hist.cues });
  const stride = h.quick ? F4_STRIDE.quick : F4_STRIDE.full;
  const entries = arr(lex.scale).filter((e) => isObj(e) && Array.isArray(e.yieldTo) && e.yieldTo.length);
  c.check(entries.length > 0, at("/entries"), null, "at least one scale entry with yieldTo", entries.length);
  const stats = { utterances: 0, captured: 0, yielded: 0, notOpen: 0, vs031: 0, normalized: 0 };
  let k = 0;
  for (const E of entries) {
    const anchors = arr(E.anchor).filter(isPhrase);
    const cues = arr(E.cue).filter(isPhrase);
    const bands = arr(E.bands).flatMap((b) => (isObj(b) ? arr(b.ph) : [])).filter(isPhrase);
    const variants = [null, ...anchors.map((a) => ({ anchor: a, negated: false })), ...anchors.map((a) => ({ anchor: a, negated: true }))];
    for (const tid of E.yieldTo) {
      const targetPhrases = [
        ...arr(lex.scale).filter((e) => isObj(e) && e.id === tid).flatMap((e) => arr(e.cue)),
        ...arr(lex.bool).filter((e) => isObj(e) && e.id === tid).flatMap((e) => arr(e.ph)),
      ].filter(isPhrase);
      c.check(targetPhrases.length > 0, at(`/${E.id}/${tid}/target-phrases`), null, "the target's cue or yes/no phrases", targetPhrases.length);
      for (const prefix of F4_PREFIXES) for (const tc of targetPhrases) for (const ec of cues) for (const band of bands) for (const v of variants) {
        k += 1;
        if ((k - 1) % stride !== 0) continue;
        const text = v === null ? `${prefix}${tc} and it ${ec} ${band}`
          : v.negated ? `${prefix}${tc}, not ${v.anchor}, but it ${ec} ${band}`
            : `${prefix}${tc} and the ${v.anchor} ${ec} ${band}`;
        const where = at(`/${E.id}/${tid}/${stats.utterances}`);
        stats.utterances += 1;
        // The oracle reads the raw text, so it is only valid where normalize is the identity: no
        // typographic apostrophe and no standalone number normalize would spell (0–20, round tens).
        // Other digits (the band "over 72") are left as they are and stay in the sweep.
        if (/[‘’ʼ′]/.test(text) || /(?<![\p{L}\p{N}.:\/,%-])(?:1?[0-9]|20|[3-9]0)(?![\p{L}\p{N}:\/,%-])/u.test(text)) {
          stats.normalized += 1; continue;
        }
        attempt(c, where, { text }, () => {
          const low = text.toLowerCase();
          const ci = firstIndex(low, cues);
          const opens = ci !== -1 && !cueWithin(text, ci, neg);
          const gatesPass = opens && !cueWithin(text, ci, third) && !cueWithin(text, ci, hist);
          const anchored = allIndices(low, anchors).some((j) => !cueWithin(text, j, neg));
          const targetNamed = targetPhrases.some((p) => low.includes(p));
          const expectCaptured = gatesPass && (!targetNamed || anchored);
          const capsY = x.extract(lex, text);
          const capsN = x.extract(noYield, text);
          const eY = capsY.filter((cp) => cp.id === E.id);
          const eN = capsN.filter((cp) => cp.id === E.id);
          c.check((eY.length > 0) === expectCaptured, `${where}/entry-captured`, { text, opens, gatesPass, anchored, targetNamed }, expectCaptured, tags(eY));
          if (expectCaptured) same(c, eN, eY, `${where}/entry-as-without-yield`, { text });
          if (expectCaptured) stats.captured += 1; else if (gatesPass) stats.yielded += 1; else stats.notOpen += 1;
          same(c, capsN.filter((cp) => cp.id === tid), capsY.filter((cp) => cp.id === tid), `${where}/target-as-without-yield`, { text });
          if (lex031 && !appended.some((p) => low.includes(p))) {
            stats.vs031 += 1;
            same(c, x.extract(lex031, text).filter((cp) => cp.id === tid), capsY.filter((cp) => cp.id === tid), `${where}/target-as-lexicon031`, { text });
          }
        });
        if (stats.utterances % 2000 === 0) await tick();
      }
    }
  }
  c.check(stats.normalized === 0, at("/no-normalized-text"), null, 0, stats.normalized);
  c.note(`block 4: F4 property on ${stats.utterances} utterances${stride > 1 ? ` (every ${stride}th, ?quick=1)` : ""} from ${entries.map((e) => `${e.id} → ${arr(e.yieldTo).join("/")}`).join(", ")}: entry captured ${stats.captured}, yielded ${stats.yielded}, cue negated or gated ${stats.notOpen}; target compared with the same lexicon without yieldTo/anchor on all, and with lexicon ${lex031 ? lex031.version : "(none)"} on the ${stats.vs031} that hold no appended phrase`);
}

// ------------------------------------------------------------------------------------------ suite

export default {
  name: "capture",
  owner: "WP5",
  run: guarded("capture", async (h) => {
    const [x, scribe, contract, vocab] = await Promise.all([h.engine("extraction.js"), h.engine("scribe.js"), h.engine("contract.js"), h.engine("vocab.js")]);
    need(typeof x.extract === "function" && typeof x.extractInContext === "function", "waits on WP-A: extraction.extractInContext");
    need(Array.isArray(x.EXTRACTOR_FEATURES), "waits on WP-A: extraction.EXTRACTOR_FEATURES");
    need(typeof scribe.heardLabel === "function" && typeof scribe.heardPrompts === "function" && typeof scribe.askNextSections === "function",
      "waits on WP-B: scribe.heardLabel / heardPrompts / askNextSections");
    need(Number.isInteger(contract.LEXICON_CARRY_MAX), "waits on WP-C: contract.LEXICON_CARRY_MAX");
    const c = collector(h);
    const invalid = [];
    const out = { goldSha: null, benchmark: null, lines: [] };

    await block1(c, h, x, contract.LEXICON_CARRY_MAX);

    const { module, validation } = await loadMasque(h);
    c.note(validationNote(validation));
    need(isObj(module.lexicon), "the MASQUE rubric has no lexicon");
    const lex = module.lexicon;
    c.diff(LEXICON_DELTA.to, lex.version, { at: "/lexicon/version" });
    const lex031 = revertLexiconDelta(lex, LEXICON_DELTA);
    c.check(lex031 !== null, "/lexicon031", { version: lex.version }, `the ${LEXICON_DELTA.from}-equivalent lexicon (revertLexiconDelta)`, null);
    if (lex031) {
      const extra = newFieldsOf(lex031);
      c.diff([], extra, { at: "/block1/default-off/lexicon031/new-fields" });
      if (!extra.length) {
        const rng = h.rng((h.seed ^ 0x4C583331) >>> 0); // "LX31"
        const n = h.quick ? DEFAULT_OFF_UTTERANCES.quick : DEFAULT_OFF_UTTERANCES.full;
        const done = await defaultOff(c, x, lex031, utterances(rng, lex031, n), "/block1/default-off/lexicon031");
        c.note(`default-off: ${done} seeded utterances on lexicon ${lex031.version} (the shipped lexicon with the delta reverted)`);
      }
    }

    await block2(c, h, x, module, lex031, out);
    block3(c, scribe, vocab, module, x);
    await block4(c, h, x, lex, lex031);

    // Pins (D6): never a silent pass.
    if (GOLD_0_3_0_SHA256 === PIN_AFTER_RUN) {
      invalid.push(`INVALID until pinned: GOLD_0_3_0_SHA256 reads "${PIN_AFTER_RUN}"; the gold set 0.3.0 served now has sha256 ${out.goldSha || "(unreadable)"}`);
    } else if (out.goldSha !== GOLD_0_3_0_SHA256) {
      invalid.push(`gold set 0.3.0 tests/fixtures/${GOLD_0_3_0_FIXTURE}: sha256 ${String(out.goldSha).slice(0, 12)}… ≠ pinned ${GOLD_0_3_0_SHA256.slice(0, 12)}… (the cases changed after the pinned run: review them, then re-pin)`);
    }
    if (EXPECTED_BENCHMARK === PIN_AFTER_RUN) {
      invalid.push(`INVALID until pinned: EXPECTED_BENCHMARK reads "${PIN_AFTER_RUN}"; this run computed ${JSON.stringify(out.benchmark)}`);
    } else if (out.benchmark) {
      c.diff(EXPECTED_BENCHMARK, out.benchmark, { at: "/block2/benchmark" });
    } else {
      c.check(false, "/block2/benchmark", null, EXPECTED_BENCHMARK, "not computed (the gold sets did not load)");
    }
    const pins = [
      `pin GOLD_0_3_0_SHA256 = ${JSON.stringify(out.goldSha)}`,
      `pin EXPECTED_BENCHMARK = ${JSON.stringify(out.benchmark)}`,
      "(pin only from the lead's browser run, and only when it reports no difference)",
    ];
    const block = out.lines.length ? ["benchmark block for app/modules/masque/CHANGELOG.md (one note per line):", ...out.lines] : [];
    const res = c.result([...pins, ...block]);
    if (!invalid.length) return res;
    const failing = c.count ? [`${c.count} failing comparison(s) as well (see the differences): the verdict is FAIL once pinned`] : [];
    return { ...res, verdict: "invalid", notes: [...invalid, ...failing, ...res.notes] };
  }),
};
