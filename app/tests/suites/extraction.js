// tests/suites/extraction.js — free-text extraction parity (design 03 §8.3 `extraction`; design 05
// §7.2). Owner: WP13; accepts WP5 (with WP1's lexicon); block 2 and the 0.3.1-equivalent subject:
// WP-H.
//
// The parity subject is the 0.3.1-equivalent lexicon lex031 = revertLexiconChain(masque.lexicon,
// [LEXICON_DELTA, LEXICON_DELTA_033]) (tests/harness/lexicon-delta.js, then, since release 0.4.7,
// tests/harness/lexicon-delta-033.js): the exact inverse of the approved 0.3.1 → 0.3.2 delta and of
// the 0.3.2 → 0.3.3 delta, which the values suite proves; lex032 is the 0.3.2-equivalent lexicon on the
// way. A shipped lexicon that is not exactly 0.3.1 + the chain gives null and FAILS at /lexicon031.
//
// Block 1, strict parity (no AD). baseline extract(text, opts) (MASQUE_Extraction.js, its own
// constants) vs the engine's extract(lex031, text, opts), deep-equal arrays with key order, over:
//   - the 44 utterances of the v0.3.1 gold set (reference/MASQUE_v0.3.1/masque_extraction_goldset.json,
//     SHA-256 pinned below; a mismatch is INVALID);
//   - every patient turn of the demo transcript (baseline Scribe SCRIPT);
//   - 5,000 synthetic utterances (1,000 with ?quick=1): 1-3 phrases drawn from the baseline
//     lexicon, each with a random negation / third-party / historical prefix or none;
// each × includeSuppressed ∈ {false, true} × negationWindow ∈ {8, 14, 20} (+ the defaults).
// Also: createExtractor(lex031) agrees with extract and reports lexicon version 0.3.1;
// cueBefore/negatedNear agree with the baseline negatedNear; EXTRACTOR_KIND equals the baseline's;
// faersToUtterances agrees with the baseline on FAERS-shaped records (array and {results} forms,
// missing ids, records without reactions or narrative).
//
// Block 2, the 0.3.2 audit (AD13 only). The engine's extract(lex031, t, o) vs
// extract(lex032, t, o) at /extract032/<src>, allow ["AD13"], ctx.AD13 = {delta, text: t,
// lexicon: lex032}, over block 1's corpus and option matrix, plus:
//   - block 1's corpus again with {includeHeard} and {includeHeard, includeSuppressed}, so AD13's
//     heard rule (heard captures of an entry the delta gives heard: true) is exercised: at least
//     one such comparison must show heard captures on the shipped side and be explained by AD13
//     (/extract032/heard-rule);
//   - every appended item phrase in four frames ("<ph>", "not <ph>", "my mother <ph>",
//     "used to <ph>"), and for every scale entry the delta appends to, each cue followed by each
//     band phrase of the same entry (one of the two appended), in the same four frames;
//   - every appended negation / third-party cue between two topic phrases of the lexicon,
//     "<topic A>, <cue> <topic B>" (review F4, tests): topic B is every topic phrase; topic A is a
//     neutral topic phrase (no appended phrase, no negation / attribution / history / carryRefuse
//     cue, nothing normalize rewrites, the same non-empty captures on both lexicons, no id any
//     delta row names and no id topic B captures). AD13 rule N excuses only captures at or after
//     the cue, so topic A's captures stay strictly compared in every such text. Asserted (round
//     3, review T11): every such text opens with a topic A, none of them is excused whole by the
//     apostrophe rule (strictA === withA), and in at least one of them a topic-A capture before
//     the cue is outside every AD13 rule (ad13Explain), so it really is compared strictly;
//   - the round-3 utterances of design 05 §13.2-§13.4 and §13.6 (R9 band choice of a heard entry,
//     R11 sentence scope of carryExclude phrases), with the defaults and the two includeHeard
//     option sets, so AD13 rule H is exercised on every R9 / R11 case the design names (the
//     capture suite and gold set 0.3.0 own their expected outputs);
//   - the delta-derived yield corpus: for each scale entry given yieldTo by the delta, every
//     presence phrase of each target × each entry cue × each entry band (its first phrase) ×
//     {no anchor, each anchor, each anchor negated with "not "} × {plain, "my mother ",
//     "used to "}, with the defaults and includeSuppressed (the capture suite asserts the yield
//     semantics on the same generator; restated here so neither suite depends on the other).
// The phrase corpus also runs with the two includeHeard option sets. The note states how much of
// the audit AD13's normalize rule can excuse (normalizeRewrites, the engine's own rule): a text
// holding a typographic apostrophe is excused whole; in a text holding a spelled number token,
// rule Tn excuses only value or presence changes of the scale entries with a band phrase that
// number spelling can change (bandPhraseMaySpell; the note lists them), while their evidence,
// cueIndex and suppressedBy are still compared, and every other scale entry, red flags and
// non-scale captures stay strict (numbers apply to band matching only, round 2 R4; review T4).
// Then h.expect("AD13", {precondition: some raw comparison differed, observed}).
//
// Block 3, the 0.3.3 audit (AD18 only; release 0.4.7). The engine's extract(lex032, t, o) vs
// extract(masque.lexicon, t, o) at /extract033/<src>, allow ["AD18"], ctx.AD18 = {delta: LEXICON_DELTA_033,
// text: t, lexicon: masque.lexicon}, over block 1's corpus and option matrix (the heard option sets
// included), block 2's own texts (the 0.3.2 delta's phrase corpus, the round-3 texts), and its own:
//   - every cue of every clauses list and every appended negation cue, each with topic phrases of
//     the shipped lexicon in the frames its list reads (a cue before a list, after a phrase, glued to
//     it, between two clauses, a section header over a line, a placeholder after a label);
//   - the chart cases of gold set 0.4.0 (the lead's history and physical and the catalogue rows);
//   both also with opts.chart (typed chart text: ctx.AD18.chart, rules P and X).
// Since the clinical lead's decision D9 of 2026-10-12 chart reading applies to spoken and demo lines
// too, so a comparison without opts.chart (a spoken line) is audited by AD18 as well (ctx.AD18.chart
// false: rules P and X, typed chart text's, never fire there); review round 2 had kept spoken lines
// strict. AD18 drops the captures of every id one of its rules names after its evidence rule (a capture's
// clause evidence put back to the whole text); every other capture is compared strictly. Asserted:
// some comparison differs raw and every difference is explained, at least one comparison keeps a
// capture no AD18 rule touches (so the audit cannot turn vacuous), and AD18 itself is self-checked
// on crafted pairs (each rule fires on its own text and the engine's outputs there are excused; a
// wrong clause, a changed value of an untouched id, an extra capture, or a lexicon at another
// version is not; a rule of typed chart text, P or X, excuses nothing in a spoken comparison). Then
// h.expect("AD18", …).
//
// Block 4, the speech-mode audit (the clinical lead's decision D9 of 2026-10-12; it replaces the
// review-round-2 block that held spoken lines identical to release 0.4.6). Over the 44 reference cases,
// the cases of gold set 0.3.0, the demo transcript of the module and the baseline Scribe's script, the
// chart cases of gold set 0.4.0 read as spoken lines, block 3's cue texts, the round-3 texts and block
// 1's synthetic utterances, each × several option sets (extract, never opts.chart), and every dialogue
// of gold set 0.3.0, the module's demo transcript and the baseline Scribe's script run as the Scribe
// runs a spoken line (extractInContext, the slot kept, {carry: false} while the pending item is
// answered):
//   a. the 0.3.2 side is release 0.4.6's reading: the frozen engine of release 0.4.6
//      (tests/fixtures/engine-0.4.6/extraction.js and contract.js, git blobs of f57780b, SHA-256 pinned
//      below; a mismatch is INVALID) with the 0.3.2-equivalent lexicon vs this engine with the same
//      lexicon: deep-equal (key order included), the whole extractInContext result at every step;
//   b. lexicon 0.3.2 vs the shipped lexicon 0.3.3 on this engine, as spoken lines, under AD18 (ctx.AD18.chart
//      false), at /extract033/spoken/…; in the dialogues the captures are audited the same way at every
//      step and the slot and carry result (pending, applied, refused) are compared strictly: D9 keeps
//      carry-over (heard slots, carryRefuse, yieldTo) exactly as before;
//   c. explicit speech red-flag tests on the shipped lexicon (SPEECH_RED_FLAGS): a flag is lowered in a
//      spoken line only by a denial aimed directly at it ("No, I've never had double vision." lowers
//      rf_focal, the lead's red-flag decision), and an unpunctuated reply opening with "no" lowers no
//      flag it does not directly deny ("no it's more of a whooshing with my heartbeat" raises
//      rf_pulsatile), through extract and through extractInContext alike.
// Block 1 has no AD; block 2 allows AD13 only, block 3 AD18 only, block 4 none (a) and AD18 only (b) (§8.4).
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { pick, sizes } from "../harness/matrix.js";
import { ad13Explain, ad18Explain, allowedDifference, bandPhraseMaySpell, normalizeRewrites, revertLexiconChain, revertLexiconDelta } from "../harness/diff.js";
import { LEXICON_DELTA } from "../harness/lexicon-delta.js";
import { LEXICON_DELTA_033 } from "../harness/lexicon-delta-033.js";

const GOLDSET_PATH = "../reference/MASQUE_v0.3.1/masque_extraction_goldset.json";
const GOLDSET_SHA256 = "e1d6573695e554e57dd44cfab3de6699dccc6518c42f2b28afa32d9ddcab6cb2";
const WINDOWS = [8, 14, 20];
const FILLERS = ["", "really ", "honestly ", "sometimes ", "I think ", "and ", "but ", "also "];
const JOINS = [", ", ". ", " and ", " — ", "; ", ", but "];
/** Block 2's frames for an appended phrase (design 05 §7.2). */
const FRAMES = ["", "not ", "my mother ", "used to "];
/** The prefixes of the yield corpus (design 05 §7.4 block 4). */
const YIELD_PREFIXES = ["", "my mother ", "used to "];
/** Gold set 0.4.0 (release 0.4.7): block 3 reads its chart cases. */
const GOLD_0_4_0_FIXTURE = "goldset/masque_extraction_goldset_0.4.0.json";
/** Gold set 0.3.0 and its pin (the capture suite's, from the lead's run): block 4 reads its cases and dialogues. */
const GOLD_0_3_0_FIXTURE = "goldset/masque_extraction_goldset_0.3.0.json";
const GOLD_0_3_0_SHA256 = "729492ef21c13824970478e86203e2e93e48a97660db9d7e66fa73fc28de1566";
/** The frozen release 0.4.6 engine (block 4): git blobs of f57780b, pinned by SHA-256. */
const ENGINE_046_DIR = "engine-0.4.6/";
const ENGINE_046_SHA256 = {
  "extraction.js": "ebf519c374036f68687bb32ce93c114601a4d475e3f01b36bdccbe173365ea73",
  "contract.js": "7ffbd1681dbbb12a56a6525ff7f89f2c36d1250e41571e2b064f2118ae8885d3",
};
/**
 * Block 4c: explicit speech red-flag tests (D9, 2026-10-12) on the shipped lexicon, as spoken lines (no
 * opts.chart): [label, text, raised flag ids, flag ids that must not be raised].
 */
const SPEECH_RED_FLAGS = [
  ["reply-no/whooshing-with-heartbeat", "no it's more of a whooshing with my heartbeat", ["rf_pulsatile"], []],
  ["reply-no/hear-a-whooshing", "no I hear a whooshing sound in my ear", ["rf_pulsatile"], []],
  ["reply-no/double-vision-when-tired", "no I get double vision when I'm tired", ["rf_focal"], []],
  ["reply-no/the-room-spins", "no the room spins and I see double vision", ["rf_focal"], []],
  ["reply-no/nosebleeds-every-week", "no I've been getting nosebleeds every week", ["rf_mass"], []],
  ["reply-no/then-a-direct-denial", "no it's more like a whooshing no double vision though", ["rf_pulsatile"], ["rf_focal"]],
  ["reply-no/break", "no but I hear my heartbeat in my ear", ["rf_pulsatile"], []],
  ["direct/never-had", "No, I've never had double vision.", [], ["rf_focal"]],
  ["direct/never-had-unpunctuated", "no I've never had double vision", [], ["rf_focal"]],
  ["direct/no-double-vision", "no double vision", [], ["rf_focal"]],
  ["direct/don't-get", "no I don't get double vision", [], ["rf_focal"]],
  ["direct/two-denials", "no nosebleeds no double vision", [], ["rf_mass", "rf_focal"]],
  ["direct/not-pulsatile", "the ringing is not pulsatile", [], ["rf_pulsatile"]],
  ["affirmed/plain", "I hear my heartbeat whooshing in my ear", ["rf_pulsatile"], []],
  ["affirmed/reference-r02-was", "Yes, and I had double vision last week.", ["rf_focal"], []],
];
/** Block 4's option sets for extract (a spoken line: never opts.chart). */
const SPOKEN_OPTION_SETS = [null, { includeSuppressed: true }, { includeHeard: true }, { includeHeard: true, includeSuppressed: true },
  { negationWindow: 8 }, { negationWindow: 20, includeSuppressed: true }, { includeHeard: true, pendingIds: ["v_vertigo"] }];
/** Block 3: topic phrases paired with each clauses cue (rotated through the topic list). */
const CUE_TOPICS = 6;
/** Block 2's option sets that return heard captures (AD13's heard rule, review F4 tests). */
const HEARD_OPTION_SETS = [{ includeHeard: true }, { includeHeard: true, includeSuppressed: true }];
/** Typed chart text (release 0.4.7 review fixes): block 3 reads its own corpus and the chart cases this way too. */
const CHART_OPTION_SETS = [{ includeHeard: true, chart: true }, { includeHeard: true, includeSuppressed: true, chart: true }];
/**
 * The round-3 utterances of design 05 §13.2-§13.4 and §13.6 (and the R9 recall-cost case of gold
 * t005), verbatim: R9 band choice of a heard entry (a negated span, a carryRefuse phrase, two
 * values, no span), R11 (a carryExclude phrase inside or outside a cue sentence, the
 * abbreviation boundary; from round 3c, §13.11, a day range elsewhere overlapping "days at a time",
 * a cue sentence of a cue other than the first listed, an attributed cue hit) and the disclosed
 * risks. Their expected captures belong to the capture
 * suite and gold set 0.3.0; here they only feed block 2, so AD13 (rule H above all) must explain
 * every difference they show.
 */
const ROUND3_TEXTS = [
  "I get dizzy, I don't know, seconds or hours.",
  "I've been dizzy since Monday, and it lasts hours.",
  "I'm dizzy for two days at a time",
  "The dizziness is never under five minutes, it lasts hours",
  "never under five minutes, it lasts hours",
  "It hit me in a split second and the spinning lasted for hours",
  "I felt dizzy a couple minutes ago",
  "I'm feeling really dizzy",
  "the room spins for a few seconds when I roll over",
  "it lasts 2 minutes",
  "I'm dizzy. It's been going on for two days.",
  "I've been dizzy for two days",
  "I'm dizzy for a few seconds. It's been going on for two days.",
  "I'm dizzy. For 2 days.",
  "I get dizzy, e.g. for two days",
  "My migraines last for two days and I get dizzy with them",
  "It's not a few seconds, the dizziness lasts hours",
  "I'm dizzy for a few seconds, not hours.",
  "The dizziness lasts forty-two minutes.",
  "I get these dizzy spells. They last for two days at a time.",
  "I get dizzy. It lasts for two days at a time.",
  "How long am I dizzy? For two days at a time.",
  "I had vertigo for two days. Now I'm just dizzy.",
  "The room spins for two days at a time. Then I feel dizzy.",
  "I get dizzy. My mother was dizzy for two days.",
];

const arr = (x) => (Array.isArray(x) ? x : []);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isPhrase = (p) => typeof p === "string" && p !== "";

/** Every topic phrase of a lexicon (bool, ctx and multi phrases, scale cues, red-flag phrases); no bands, no cue lists. */
function topicPhrases(lexicon) {
  const out = [];
  for (const e of arr(lexicon.bool)) if (isObj(e)) out.push(...arr(e.ph));
  for (const e of arr(lexicon.ctx)) if (isObj(e)) out.push(...arr(e.ph));
  for (const e of arr(lexicon.scale)) if (isObj(e)) out.push(...arr(e.cue));
  for (const e of arr(lexicon.multi)) if (isObj(e)) out.push(...arr(e.ph));
  if (isObj(lexicon.redFlags)) for (const ph of Object.values(lexicon.redFlags)) out.push(...arr(ph));
  return [...new Set(out.filter(isPhrase))];
}

/** The lexicon.normalize value the delta adds (null when it adds none). */
function deltaNormalize(delta) {
  const row = arr(delta.fields).find((x) => isObj(x) && x.path === "/normalize");
  return row && isObj(row.to) ? row.to : null;
}

/** Every entry id a delta row names: entryId, and the flag id of a /redFlags/<id> row. */
function deltaEntryIds(delta) {
  const ids = new Set();
  for (const row of [...arr(delta.appended), ...arr(delta.fields)]) {
    if (!isObj(row)) continue;
    if (typeof row.entryId === "string") ids.add(row.entryId);
    const m = typeof row.path === "string" ? /^\/redFlags\/([^/]+)$/.exec(row.path) : null;
    if (m) ids.add(m[1]);
  }
  return ids;
}

/**
 * The neutral topic phrases that may open an appended-cue text ("<topic A>, <cue> <topic B>"),
 * each with the ids it captures: a topic phrase of the shipped lexicon that holds no phrase the
 * delta appends and no negation, attribution, history or carryRefuse cue of the shipped lexicon,
 * that normalize leaves alone, whose captures on its own are non-empty, hold a non-red-flag
 * capture and are equal (key order included) on both lexicons, and that captures no id a delta
 * row names. AD13 rules P, Y, H and T then never touch its ids, and rule N excuses only captures
 * at or after the cue, so its captures stay strictly compared.
 */
function neutralTopics(delta, lex, lex031, extract) {
  const cueLists = [lex.negation, lex.thirdParty, lex.historical].flatMap((x) => arr(isObj(x) ? x.cues : null));
  const banned = [
    ...arr(delta.appended).flatMap((row) => (isObj(row) ? arr(row.phrases) : [])),
    ...cueLists, ...arr(lex.carryRefuse),
  ].filter(isPhrase);
  const touched = deltaEntryIds(delta);
  const norm = deltaNormalize(delta);
  const out = [];
  for (const ph of topicPhrases(lex)) {
    const low = ph.toLowerCase();
    if (banned.some((b) => low.includes(b))) continue;
    const rw = normalizeRewrites(ph, norm);
    if (rw.apostrophes || rw.numbers) continue;
    const a = extract(lex031, ph), b = extract(lex, ph);
    if (!a.length || JSON.stringify(a) !== JSON.stringify(b) || !a.some((x) => x.kind !== "redflag")) continue;
    const ids = new Set(a.map((x) => x.id));
    if ([...ids].some((id) => touched.has(id))) continue;
    out.push({ ph, ids });
  }
  return out;
}

/**
 * Block 2's phrase corpus from the delta: {texts (deduplicated, in generation order), cueTexts,
 * strictA}. `lex` is the shipped lexicon; delta paths use the `from` lexicon's indices, which the
 * delta never shifts. An appended negation / third-party cue is placed between two topic phrases,
 * "<topic A>, <cue> <topic B>", topic A from neutralTopics, rotated, never one capturing an id
 * that topic B captures on either lexicon (with includeSuppressed); with no such topic A the text
 * is "<cue> <topic B>". cueTexts counts the appended-cue texts, withA those with a topic A, strictA
 * those with a topic A whose text normalize leaves whole (no typographic apostrophe); pool is the
 * number of neutral topic phrases; topicA lists the texts with a topic A as {text, ids (the ids
 * topic A captures on its own), cueAt (the offset of the appended cue)}.
 */
function deltaPhraseCorpus(delta, lex, lex031, extract) {
  const texts = new Set();
  const framed = (s) => { for (const f of FRAMES) texts.add(`${f}${s}`); };
  const appendedScale = new Map();   // scale index → Set of appended cue / band phrases
  const topics = topicPhrases(lex);
  const pool = neutralTopics(delta, lex, lex031, extract);
  const norm = deltaNormalize(delta);
  const idsOf = new Map();           // topic B → ids it captures on either lexicon
  const capturedIds = (ph) => {
    if (!idsOf.has(ph)) {
      const all = [...extract(lex031, ph, { includeSuppressed: true }), ...extract(lex, ph, { includeSuppressed: true })];
      idsOf.set(ph, new Set(all.map((x) => x.id)));
    }
    return idsOf.get(ph);
  };
  let cueTexts = 0, withA = 0, strictA = 0, turn = 0;
  const topicA = [];
  for (const row of arr(delta.appended)) {
    if (!isObj(row) || typeof row.path !== "string") continue;
    const t = row.path.slice(1).split("/");
    const phrases = arr(row.phrases).filter(isPhrase);
    if (t[0] === "negation" || t[0] === "thirdParty") {
      for (const cue of phrases) {
        for (const ph of topics) {
          const idsB = capturedIds(ph);
          let a = null;
          for (let j = 0; j < pool.length && a === null; j++) {
            const cand = pool[(turn + j) % pool.length];
            if (cand.ph !== ph && ![...cand.ids].some((id) => idsB.has(id))) a = cand;
          }
          turn++;
          const text = a ? `${a.ph}, ${cue} ${ph}` : `${cue} ${ph}`;
          if (texts.has(text)) continue;
          texts.add(text);
          cueTexts++;
          if (a) {
            withA++;
            topicA.push({ text, ids: a.ids, cueAt: a.ph.length + 2 });
          }
          if (a && !normalizeRewrites(text, norm).apostrophes) strictA++;
        }
      }
      continue;
    }
    for (const ph of phrases) framed(ph);
    if (t[0] === "scale") {
      const i = Number(t[1]);
      if (!appendedScale.has(i)) appendedScale.set(i, new Set());
      for (const ph of phrases) appendedScale.get(i).add(ph);
    }
  }
  for (const [i, added] of appendedScale) {
    const e = arr(lex.scale)[i];
    if (!isObj(e)) continue;
    for (const cue of arr(e.cue).filter(isPhrase)) {
      for (const b of arr(e.bands)) {
        for (const ph of arr(isObj(b) ? b.ph : null).filter(isPhrase)) {
          if (added.has(cue) || added.has(ph)) framed(`${cue} ${ph}`);
        }
      }
    }
  }
  return { texts: [...texts], cueTexts, withA, strictA, pool: pool.length, topicA };
}

/** The delta-derived yield corpus (texts), generated from the shipped lexicon's yieldTo data. */
function yieldCorpus(delta, lex) {
  const out = [];
  const presence = (id) => [
    ...arr(lex.scale).filter((e) => isObj(e) && e.id === id).flatMap((e) => arr(e.cue)),
    ...arr(lex.bool).filter((e) => isObj(e) && e.id === id).flatMap((e) => arr(e.ph)),
  ].filter(isPhrase);
  for (const row of arr(delta.fields)) {
    if (!isObj(row) || typeof row.path !== "string") continue;
    const m = /^\/scale\/(\d+)\/yieldTo$/.exec(row.path);
    if (!m) continue;
    const e = arr(lex.scale)[Number(m[1])];
    if (!isObj(e)) continue;
    const anchors = arr(e.anchor).filter(isPhrase);
    const tails = ["", ...anchors.map((a) => `, ${a}`), ...anchors.map((a) => `, not ${a}`)];
    const bands = arr(e.bands).map((b) => arr(isObj(b) ? b.ph : null).find(isPhrase)).filter(isPhrase);
    const cues = arr(e.cue).filter(isPhrase);
    for (const target of arr(row.to)) {
      for (const tc of presence(target)) {
        for (const ec of cues) {
          for (const bp of bands) {
            for (const tail of tails) {
              for (const pre of YIELD_PREFIXES) out.push(`${pre}${tc} and it ${ec} ${bp}${tail}`);
            }
          }
        }
      }
    }
  }
  return out;
}

/** All phrases the baseline lexicon matches, by family (the synthetic vocabulary). */
function lexiconPhrases(ext) {
  const out = [];
  for (const e of ext.BOOL_EX) out.push(...e.ph);
  for (const e of ext.CTX_EX) out.push(...e.ph);
  for (const e of ext.SCALE_EX) { out.push(...e.cue); for (const b of e.bands) out.push(...b.ph); }
  for (const e of ext.MULTI_EX) out.push(...e.ph);
  for (const ph of Object.values(ext.RF_PHRASES)) out.push(...ph);
  return [...new Set(out)];
}

/**
 * Block 3's own corpus from the 0.3.3 delta: every cue of every clauses list (the delta's /clauses
 * row; scopeEnd, chartIgnoreThirdParty and denial headers over a list since review round 1; complement
 * words, signs, abbreviations, later list items and "+" lines since review round 3) and every
 * appended negation cue, each paired with CUE_TOPICS topic phrases of the shipped lexicon (rotated),
 * in the frames its list reads. Texts deduplicated, in generation order.
 */
function delta033Corpus(delta, lex) {
  const row = arr(delta.fields).find((r) => isObj(r) && r.path === "/clauses");
  const cl = row && isObj(row.to) ? row.to : {};
  const topics = topicPhrases(lex);
  const texts = new Set();
  if (!topics.length) return [];
  let turn = 0;
  const next = () => topics[(turn++ * 7) % topics.length];
  const each = (xs, fn) => { for (const cue of xs) for (let j = 0; j < CUE_TOPICS; j++) fn(cue, next(), next(), next()); };
  const ph = (k) => arr(cl[k]).map((r) => (isObj(r) ? r.ph : r)).filter(isPhrase);
  each(ph("affirm"), (q, A, B) => { texts.add(`${q.trim()} ${A}`); texts.add(`no ${A}, ${q.trim()} ${B}`); });
  each(ph("deny"), (q, A, B, C) => { texts.add(`${q.trim()} ${A}, ${B} and ${C}`); texts.add(`${q.trim()} ${A} but ${B}`); });
  each(ph("post"), (q, A, B) => { texts.add(`${A}${q}`); texts.add(`${A}${q}, ${B}`); });
  each(ph("prefix"), (q, A, B) => { texts.add(`${q}${A}`); texts.add(`the ${q}${A} and ${B}`); });
  each(ph("breaks"), (q, A, B) => { texts.add(`not ${A}${q.startsWith(" ") ? q : ` ${q}`}${B}`); });
  each(ph("mask"), (q, A) => { texts.add(`${q} ${A}`); texts.add(`the ${q}`); });
  each(ph("hedge"), (q, A) => { texts.add(`${q} ${A}`); texts.add(`${A}${q === "?" ? "?" : ` ${q}`}`); });
  each(ph("placeholder"), (q, A) => { texts.add(`${A}: ${q}`); texts.add(`${q} with ${A}`); });
  each(ph("thirdParty"), (q, A, B) => { texts.add(`${q.trim()} ${A}`); texts.add(`${A}, ${q.trim()} ${B}`); });
  // Review round 1: a scopeEnd word after a denied list item, before a red-flag phrase too; a pronoun
  // before a finding and before another word; a denial heading a list of lines.
  each(ph("scopeEnd"), (q, A, B, C) => { texts.add(`no ${A}, ${q} ${B}`); texts.add(`denies ${A}, ${B} ${q} ${C}`); });
  each(ph("chartIgnoreThirdParty"), (q, A, B) => { texts.add(`${q}${A}`); texts.add(`${q}friend has ${B}`); });
  // Review round 3: a complement word after a denial; signs between findings with only spaces; an
  // abbreviation inside a sentence; a later list item holding another word; a "+" line under a denial.
  each(ph("complement"), (q, A, B) => { texts.add(`no workup ${q} ${A}`); texts.add(`denies ${A}, change ${q} ${B}`); });
  each(["(-)", "(+)"], (q, A, B) => { texts.add(`${q} ${A} (+) ${B}`); texts.add(`(-) ${A} ${q} ${B}`); });
  each(["assoc.", "hx. of", "e.g."], (q, A, B) => { texts.add(`No ${q} ${A}.`); texts.add(`Denies ${q} ${A} or ${B}.`); });
  each(["reported", "present", "today"], (q, A, B) => { texts.add(`no ${A}, ${B} ${q}.`); texts.add(`Denies:
- ${A}
+ ${B}`); });
  each(ph("deny"), (q, A, B) => { texts.add(`${q.trim()}:
- ${A}
- ${B}`); });
  const sec = isObj(cl.sections) ? cl.sections : {};
  each(Object.keys(sec).flatMap((k) => arr(sec[k]).map((r) => (isObj(r) ? r.ph : r)).filter(isPhrase)), (w, A, B) => {
    texts.add(`${w.toUpperCase()}:\n${A}`); texts.add(`${w}: ${A}`); texts.add(`${w}\n${A}\nHPI\n${B}`);
  });
  each(arr(delta.appended).filter((r) => isObj(r) && r.path === "/negation/cues").flatMap((r) => arr(r.phrases)).filter(isPhrase),
    (q, A, B) => { texts.add(`${A}, ${q} ${B}`); texts.add(`${q} ${A}`); });
  return [...texts];
}

/**
 * Self-checks of the AD18 extraction normaliser (release 0.4.7): on each crafted text the named
 * rule names the id (ad18Explain) and the engine's two outputs (lex032, shipped) are excused; and
 * the normaliser refuses a wrong clause (one disagreeing with its evidence, or, review round 1, one
 * that does not hold the capture's cue or is cut inside a word), a changed value of an id no rule
 * touches, an extra capture of such an id, and a lexicon at another version; and a contraction that
 * is a negation cue keeps its 0.3.2 reach (rule Wc names nothing, the captures agree).
 */
function ad18SelfChecks(c, x, lex, lex032) {
  const at = (q) => `/extract033/AD18-selfcheck${q}`;
  let d;
  try { d = allowedDifference("AD18"); } catch (err) { c.check(false, at("/allowedDifference"), null, "AD18", String(err.message)); return 0; }
  const P = "/extract033/selfcheck";
  // Every crafted comparison is made with opts.chart (typed chart text); since D9 (2026-10-12) the same
  // texts are also read as spoken lines, where every rule but P and X applies.
  const ctxOf = (text, lexicon = lex, chart = true) => ({ AD18: { delta: LEXICON_DELTA_033, text, lexicon, chart } });
  c.check(d.appliesTo(P, ctxOf("")) === true && d.appliesTo("/extract032/x", ctxOf("")) === false, at("/appliesTo"), null, "only /extract033/…, /lexicon and /module/versions", null);
  // [rule, text, id]: the rule names the id, and the engine's outputs there are excused.
  const FIRES = [
    // The lead struck the mask "aural" (2026-10-12); the mask "number" keeps "numb" (n_burn) out of "number".
    ["W", "The number of episodes went up.", "n_burn"],
    ["Wc", "The other symptom is tinnitus.", "v_aural"],
    ["S", "Not this. Tinnitus today.", "v_aural"],
    ["L", "Denies nausea, tinnitus.", "v_aural"],
    ["H", "Possibly tinnitus.", "v_aural"],
    ["G", "ALLERGIES: amoxicillin", "r_abx"],
    ["T", "Sister with tinnitus.", "v_aural"],
    ["N", "It wasn't tinnitus.", "v_aural"],
    ["M", "Tinnitus and ringing.", "v_aural"],
    ["RF", "Tinnitus is not pulsatile.", "rf_pulsatile"],
    ["B", "I'm dizzy. It lasts hours.", "v_vertigo"],
    ["S0", "Tinnitus\nNausea", "v_aural"],
    // Typed chart text (opts.chart): the pronoun gates in 0.3.2 and not in chart text.
    ["P", "Her tinnitus is bilateral.", "v_aural"],
    // Review round 2: a chart-register red-flag phrase (clauses.redFlags) raises its flag.
    ["C", "Sudden hearing loss in the left ear.", "rf_ssnhl"],
    // Review round 2: a label answered by an affirm cue after it (rule L reads affirm cues anywhere).
    ["L", "Not nausea, tinnitus: (+)", "v_aural"],
    // The lead's D8 answer (2026-10-12): typed chart text sets no context marker.
    ["X", "Anxiety, per prior doctor.", "c_dismiss"],
  ];
  // Rules of typed chart text only: in a spoken line the 0.3.3 lexicon reads them as 0.3.2 does.
  const TYPED_ONLY = new Set(["P", "X"]);
  const strip = (xs) => JSON.stringify(arr(xs).map((q) => { const y = { ...q }; delete y.evidence; delete y.clause; return y; }));
  let n = 0;
  const CH = { includeHeard: true, includeSuppressed: true, chart: true };
  for (const [rule, text, id] of FIRES) {
    const where = at(`/fires/${rule}`);
    try {
      const a = x.extract(lex032, text, CH);
      const b = x.extract(lex, text, CH);
      const E = ad18Explain(ctxOf(text).AD18, a, b);
      c.check(!!E && E.E === true && arr(E[rule]).includes(id), where, { text, rules: E }, `rule ${rule} names ${id}; the evidence rule holds`, E && { E: E.E, [rule]: E[rule] });
      const [na, nb] = d.normalise(a, b, ctxOf(text), P);
      c.check(JSON.stringify(a) === JSON.stringify(b) || JSON.stringify(na) === JSON.stringify(nb), `${where}/excused`, { text, a, b }, "the engine's two outputs excused", "not excused");
      // D9 (2026-10-12): the same text read as a spoken line (no opts.chart). A rule of typed chart text
      // (P, X) reads in speech as in 0.3.2 (the captures agree, evidence aside), and its typed outputs are
      // not excused as a spoken comparison; every other rule's spoken outputs are excused.
      const sa2 = x.extract(lex032, text, { includeHeard: true, includeSuppressed: true });
      const sb2 = x.extract(lex, text, { includeHeard: true, includeSuppressed: true });
      if (TYPED_ONLY.has(rule)) {
        c.check(strip(sa2) === strip(sb2), `${where}/spoken-as-0.3.2`, { text, a: sa2, b: sb2 }, "the same captures on lexicon 0.3.2 and 0.3.3 in a spoken line (evidence aside)", "different");
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          const [sa, sb] = d.normalise(a, b, ctxOf(text, lex, false), P);
          c.check(JSON.stringify(sa) !== JSON.stringify(sb), `${where}/not-excused-spoken`, { text }, "rule of typed chart text: not excused as a spoken comparison", "excused");
        }
      } else {
        const [na2, nb2] = d.normalise(sa2, sb2, ctxOf(text, lex, false), P);
        c.check(JSON.stringify(sa2) === JSON.stringify(sb2) || JSON.stringify(na2) === JSON.stringify(nb2), `${where}/spoken-excused`, { text, a: sa2, b: sb2 }, "the spoken outputs excused (D9)", "not excused");
      }
      n++;
    } catch (err) {
      c.check(false, `${where}/threw`, { text }, "no exception", String(err.message));
    }
  }
  // Crafted pairs that must not be excused (and those that must).
  const text = "Tinnitus today.";
  const cap = (id, value, extra = {}) => ({ id, value, kind: "item", evidence: text, cueIndex: 0, ...extra });
  const clause = { start: 0, end: text.length };
  const inClause = (o) => ({ ...o, evidence: text.slice(clause.start, clause.end), clause });
  const PAIRS = [
    ["evidence-only", [cap("v_aural", "yes")], [inClause(cap("v_aural", "yes"))], lex, true],
    ["no-clause", [cap("v_aural", "yes")], [cap("v_aural", "no")], lex, false],
    ["wrong-clause", [cap("v_aural", "yes")], [{ ...cap("v_aural", "yes"), clause: { start: 0, end: 8 } }], lex, false],
    // Review round 1: a clause consistent with its evidence but not holding the capture's cue, or
    // starting or ending inside a word, is not excused either.
    ["consistent-clause-without-the-cue", [cap("v_aural", "yes")], [{ ...cap("v_aural", "yes"), evidence: text.slice(9, 15), clause: { start: 9, end: 15 } }], lex, false],
    ["consistent-clause-inside-a-word", [cap("v_aural", "yes")], [{ ...cap("v_aural", "yes"), evidence: text.slice(0, 1), clause: { start: 0, end: 1 } }], lex, false],
    ["clause-not-last", [cap("v_aural", "yes")], [{ id: "v_aural", value: "yes", kind: "item", evidence: text, clause, cueIndex: 0 }], lex, false],
    ["value-of-an-untouched-id", [cap("v_aural", "yes")], [inClause(cap("v_aural", "no"))], lex, false],
    ["extra-capture-of-an-untouched-id", [cap("v_aural", "yes")], [inClause(cap("v_aural", "yes")), inClause(cap("m_nausea", "yes"))], lex, false],
    ["lexicon-at-another-version", [cap("v_aural", "yes")], [inClause(cap("v_aural", "yes"))], lex032, false],
    // D9 (2026-10-12): a spoken comparison is audited like typed chart text (review round 2 refused it).
    ["spoken-comparison", [cap("v_aural", "yes")], [inClause(cap("v_aural", "yes"))], lex, true, false],
    ["spoken-value-of-an-untouched-id", [cap("v_aural", "yes")], [inClause(cap("v_aural", "no"))], lex, false, false],
  ];
  for (const [label, a, b, lexicon, excused, chart = true] of PAIRS) {
    const [na, nb] = d.normalise(a, b, ctxOf(text, lexicon, chart), P);
    const got = JSON.stringify(na) === JSON.stringify(nb);
    c.check(got === excused, at(`/pair/${label}`), { text, a, b }, excused ? "excused" : "not excused", got ? "excused" : "not excused");
  }
  // Rules of typed chart text: the pronoun (P) and the context markers (X, D8) excuse a typed comparison
  // and never a spoken one.
  const TYPED_PAIRS = [
    ["P", "Her tinnitus is bilateral.", [], (t) => [{ id: "v_aural", value: "yes", kind: "item", evidence: t, cueIndex: 4, clause: { start: 0, end: t.length } }]],
    ["X", "Anxiety, per prior doctor.", (t) => [{ id: "c_dismiss", value: "yes", kind: "ctx", evidence: t, cueIndex: 0 }], []],
  ];
  for (const [rule, t, a0, b0] of TYPED_PAIRS) {
    const a = typeof a0 === "function" ? a0(t) : a0;
    const b = typeof b0 === "function" ? b0(t) : b0;
    for (const chart of [true, false]) {
      const [na, nb] = d.normalise(a, b, ctxOf(t, lex, chart), P);
      const got = JSON.stringify(na) === JSON.stringify(nb);
      c.check(got === chart, at(`/pair/typed-only-${rule}/${chart ? "typed" : "spoken"}`), { text: t, a, b }, chart ? "excused" : "not excused", got ? "excused" : "not excused");
    }
  }
  // Review round 1: a contraction that is itself a negation cue ("didn't") is measured from the "n't"
  // it holds, so its reach is the 0.3.2 one: rule Wc does not name the id, and the engine's two
  // outputs agree (no flip from "no" to "yes" is excused silently).
  for (const [label, t, id] of [["didnt", "I didn't have any nausea.", "m_nausea"], ["doesnt", "Patient doesn't report thick discharge.", "x_purulent"],
    ["hasnt", "She hasn't seen any green mucus.", "x_purulent"], ["wasnt", "It wasn't as if the world was moving.", "v_vertigo"]]) {
    const where = at(`/measured-contraction/${label}`);
    const o = { includeHeard: true, chart: true };
    const a = x.extract(lex032, t, o);
    const b = x.extract(lex, t, o);
    const E = ad18Explain(ctxOf(t).AD18, a, b);
    c.check(!!E && !arr(E.Wc).includes(id), `${where}/Wc`, { text: t, rules: E }, `rule Wc does not name ${id}`, E && E.Wc);
    const strip = (xs) => JSON.stringify(arr(xs).map((q) => { const y = { ...q }; delete y.evidence; delete y.clause; return y; }));
    c.check(strip(a) === strip(b), `${where}/same-captures`, { text: t, a, b }, "the same captures as lexicon 0.3.2 (evidence aside)", { a: strip(a), b: strip(b) });
  }
  // /module/versions and /lexicon hand the 0.3.2 form on (AD13 then reads it).
  const [, vb] = d.normalise({ lexicon: "0.3.1" }, { lexicon: LEXICON_DELTA_033.to }, { AD18: { delta: LEXICON_DELTA_033, full: lex } }, "/module/versions");
  c.check(vb && vb.lexicon === LEXICON_DELTA_033.from, at("/module-versions"), null, LEXICON_DELTA_033.from, vb && vb.lexicon);
  const proj = { version: lex.version, negation: lex.negation };
  const [, lb] = d.normalise({ version: "0.3.1" }, proj, { AD18: { delta: LEXICON_DELTA_033, full: lex } }, "/lexicon");
  c.check(!!lb && lb.version === lex032.version && JSON.stringify(lb.negation) === JSON.stringify(lex032.negation), at("/lexicon"), null, "the 0.3.2 projection", lb);
  return n + PAIRS.length + 2 * TYPED_PAIRS.length + 4;
}

/** FAERS-shaped records (openFDA drug/event shape), built here so nothing is fetched. */
function faersFixture() {
  const records = [
    { safetyreportid: "10000001", patient: { reaction: [{ reactionmeddrapt: "Vertigo" }, { reactionmeddrapt: "Tinnitus" }] },
      narrativeincludeclinical: "The patient reported spinning dizziness with ringing in the ears after the second dose." },
    { safetyReportId: "10000002", patient: { reaction: [{ reactionmeddrapt: "Migraine" }] } },
    { patient: { reaction: [{ reactionmeddrapt: "Photophobia" }, { reactionmeddrapt: "" }, {}] },
      narrativeincludeclinical: "Reporter states light sensitivity and nausea; no family history provided." },
    { safetyreportid: "10000004", patient: {} },
    { safetyreportid: "10000005" },
    { safetyreportid: "10000006", narrativeincludeclinical: "Hearing dropped suddenly in one ear over a day." },
    { safetyreportid: 10000007, patient: { reaction: [{ reactionmeddrapt: "Headache" }] }, narrativeincludeclinical: "" },
    {},
  ];
  return [
    { name: "array", input: records },
    { name: "results", input: { results: records } },
    { name: "empty-results", input: { results: [] } },
    { name: "no-results", input: {} },
    { name: "null", input: null },
  ];
}

export default {
  name: "extraction",
  owner: "WP13",
  run: guarded("extraction", async (h) => {
    const { module, validation } = await loadMasque(h);
    const extraction = await h.engine("extraction.js");
    need(typeof extraction.extract === "function", "waits on WP5: extraction.extract");
    need(module.lexicon, "waits on WP1: the MASQUE rubric has no lexicon");
    const [ext, scb] = await Promise.all([h.oracle("MASQUE_Extraction.js"), h.oracle("MASQUE_Scribe_v0_3.jsx")]);
    const c = collector(h);
    c.note(validationNote(validation));
    const lex = module.lexicon;
    // The parity subject: the 0.3.1-equivalent lexicon (design 05 §7.1), through the 0.3.2-equivalent
    // one (release 0.4.7). Without it no block can run; the lexicon-independent checks
    // (EXTRACTOR_KIND, FAERS) still do.
    const lex032 = revertLexiconDelta(lex, LEXICON_DELTA_033);
    const lex031 = lex032 === null ? null : revertLexiconChain(lex, [LEXICON_DELTA, LEXICON_DELTA_033]);
    if (!c.check(lex031 !== null, "/lexicon031", { version: lex.version },
      `the shipped lexicon is exactly ${LEXICON_DELTA.from} + tests/harness/lexicon-delta.js + tests/harness/lexicon-delta-033.js (revertLexiconChain)`,
      "revertLexiconChain returned null")) {
      c.note(`lexicon ${JSON.stringify(lex.version)} is not exactly ${LEXICON_DELTA.from} + the delta chain; blocks 1, 2 and 3 not run`);
    }
    c.note(lex031 !== null ? `parity subject: revertLexiconChain(lexicon ${lex.version}) = lexicon ${lex031.version} (through ${lex032.version})` : "parity subject: none");

    // Block 2: one audited comparison of lex031 vs the shipped lexicon (AD13 only).
    //   apostrophes / numbers  comparisons whose text AD13's normalize rule can excuse: whole
    //                          (a typographic apostrophe) / in part (a spelled number token: rule
    //                          Tn, value or presence of the scale entries whose band phrases
    //                          spelling can change), by normalizeRewrites, the engine's own rule
    //   heard / heardExplained includeHeard comparisons with a heard capture on the shipped side /
    //                          those explained by AD13 (its heard rule exercised)
    const audit = { compared: 0, differed: 0, explained: 0, apostrophes: 0, numbers: 0, heard: 0, heardExplained: 0 };
    const deltaNorm = deltaNormalize(LEXICON_DELTA);
    let ticks = 0;
    const tick = async () => { if (++ticks % 2000 === 0) await new Promise((r) => setTimeout(r, 0)); };
    const run = (lexicon, text, opts) => (opts ? extraction.extract(lexicon, text, opts) : extraction.extract(lexicon, text));
    const audit032 = (src, text, opts, before) => {
      let a = before, b;
      try {
        if (a === undefined) a = run(lex031, text, opts);
        b = lex031 === lex032 ? a : run(lex032, text, opts);
      } catch (err) {
        if (/not implemented/.test(err.message)) throw err;
        c.check(false, "/extract032/threw", { text, opts: opts || null }, "captures", String(err.message));
        return undefined;
      }
      audit032diff(src, text, opts, a, b);
      return b;
    };
    const audit032diff = (src, text, opts, a, b) => {
      const raw = JSON.stringify(a) !== JSON.stringify(b);
      const r = c.diff(a, b, {
        at: `/extract032/${src}${opts ? "" : "/defaults"}`, input: { text, opts: opts || null }, keyOrder: true,
        allow: ["AD13"], ctx: { AD13: { delta: LEXICON_DELTA, text, lexicon: lex032 } },
      });
      audit.compared++;
      if (raw) audit.differed++;
      if (r.observed.has("AD13")) audit.explained++;
      const rw = normalizeRewrites(text, deltaNorm);
      if (rw.apostrophes) audit.apostrophes++;
      else if (rw.numbers) audit.numbers++;
      if (opts && opts.includeHeard === true && b.some((x) => x && x.kind === "heard")) {
        audit.heard++;
        if (r.observed.has("AD13")) audit.heardExplained++;
      }
    };
    // Block 3: one audited comparison of lex032 vs the shipped lexicon (AD18 only).
    //   strict   comparisons (of the first STRICT_SAMPLE) in which some capture's id is touched by no
    //            AD18 rule, so it is compared strictly
    const audit3 = { compared: 0, differed: 0, explained: 0, sampled: 0, strict: 0, chart: 0, spoken: 0, spokenDiffered: 0, spokenExplained: 0 };
    const STRICT_SAMPLE = 4000;
    const audit033 = (src, text, opts, before) => {
      let a = before, b;
      try {
        if (a === undefined) a = run(lex032, text, opts);
        b = lex032 === lex ? a : run(lex, text, opts);
      } catch (err) {
        if (/not implemented/.test(err.message)) throw err;
        c.check(false, "/extract033/threw", { text, opts: opts || null }, "captures", String(err.message));
        return;
      }
      const raw = JSON.stringify(a) !== JSON.stringify(b);
      const ctx = { AD18: { delta: LEXICON_DELTA_033, text, lexicon: lex, chart: !!(opts && opts.chart === true) } };
      // D9 (2026-10-12): without opts.chart the comparison is a spoken line's, audited by AD18 too.
      if (!ctx.AD18.chart) { audit3.spoken++; if (raw) audit3.spokenDiffered++; }
      const r = c.diff(a, b, { at: `/extract033/${src}${opts ? (opts.chart === true ? "/chart" : "") : "/defaults"}`, input: { text, opts: opts || null }, keyOrder: true, allow: ["AD18"], ctx });
      audit3.compared++;
      if (raw) audit3.differed++;
      if (r.observed.has("AD18")) { audit3.explained++; if (!ctx.AD18.chart) audit3.spokenExplained++; }
      if (audit3.sampled < STRICT_SAMPLE && (a.length || b.length)) {
        audit3.sampled++;
        const E = ad18Explain(ctx.AD18, a, b);
        const touched = new Set(Object.entries(E || {}).filter(([k]) => k !== "E").flatMap(([, v]) => v));
        if ([...a, ...b].some((cp) => cp && !touched.has(cp.id))) audit3.strict++;
      }
    };

    // Gold set, pinned.
    let gold = [];
    try {
      const bytes = await h.fetchBytes(GOLDSET_PATH);
      const sha = await h.sha256(bytes);
      if (sha !== GOLDSET_SHA256) {
        const e = new Error(`gold set ${GOLDSET_PATH}: sha256 ${sha.slice(0, 12)}… ≠ pinned ${GOLDSET_SHA256.slice(0, 12)}…`);
        e.invalid = true;
        throw e;
      }
      gold = JSON.parse(new TextDecoder().decode(bytes)).cases.map((x) => ({ src: `gold:${x.utteranceId}`, text: x.text }));
    } catch (err) {
      if (err.invalid) throw err;
      c.check(false, "/goldset", { path: GOLDSET_PATH }, "the v0.3.1 gold set (44 utterances)", `unreadable: ${err.message}`);
    }
    c.check(gold.length === 44 || !gold.length, "/goldset/length", null, 44, gold.length);
    const demo = scb.SCRIPT.filter(([role]) => role === "pt").map(([, text], i) => ({ src: `demo:pt#${i}`, text }));

    // Synthetic utterances.
    const rng = h.rng(h.seed ^ 0x45585452); // "EXTR"
    const phrases = lexiconPhrases(ext);
    const prefixes = [
      ...ext.NEGATION.cues.map((cue) => ({ kind: "negation", cue })),
      ...ext.THIRD_PARTY.cues.map((cue) => ({ kind: "third-party", cue })),
      ...ext.HISTORICAL.cues.map((cue) => ({ kind: "historical", cue })),
    ];
    const synth = [];
    const nSynth = sizes(h.quick).extraction;
    for (let i = 0; i < nSynth; i++) {
      const k = 1 + Math.floor(rng() * 3);
      const parts = [];
      for (let j = 0; j < k; j++) {
        const r = rng();
        const pre = r < 0.5 ? "" : `${pick(rng, prefixes).cue}${rng() < 0.5 ? " " : ""}`;
        const filler = pick(rng, FILLERS);
        let ph = pick(rng, phrases);
        if (rng() < 0.15) ph = ph.charAt(0).toUpperCase() + ph.slice(1);
        parts.push(`${pre}${filler}${ph}`);
      }
      let text = parts[0];
      for (let j = 1; j < parts.length; j++) text += pick(rng, JOINS) + parts[j];
      synth.push({ src: `synthetic#${i}`, text });
    }

    const corpus = [...gold, ...demo, ...synth];
    const OPTION_SETS = [];
    for (const includeSuppressed of [false, true]) for (const negationWindow of WINDOWS) OPTION_SETS.push({ includeSuppressed, negationWindow });
    let compared = 0;
    if (lex031 !== null) {
      // Block 1 (strict, no AD); each successful engine result is reused as block 2's lex031 side.
      for (const u of corpus) {
        for (const opts of [...OPTION_SETS, null]) {
          const want = opts ? ext.extract(u.text, opts) : ext.extract(u.text);
          let got;
          try {
            got = run(lex031, u.text, opts);
          } catch (err) {
            if (/not implemented/.test(err.message)) throw err;
            c.check(false, `/extract/threw`, opts ? { text: u.text, opts } : { text: u.text }, "captures", String(err.message));
            continue;
          }
          // opts === null is the shipped defaults (no opts argument at all).
          c.diff(want, got, opts
            ? { at: `/extract/${u.src}`, input: { text: u.text, opts }, keyOrder: true }
            : { at: `/extract/${u.src}/defaults`, input: { text: u.text }, keyOrder: true });
          compared++;
          const g032 = audit032(u.src, u.text, opts, got);
          if (g032 !== undefined) audit033(u.src, u.text, opts, g032);
          await tick();
        }
      }
      c.note(`block 1 (strict, no AD) extract: ${gold.length} gold + ${demo.length} demo turns + ${synth.length} synthetic utterances × includeSuppressed {false, true} × negationWindow {${WINDOWS.join(", ")}} (+ defaults) = ${compared} comparisons on lexicon ${lex031.version}`);

      // Block 1's corpus again with heard captures returned (AD13's heard rule, review F4 tests).
      for (const u of corpus) {
        for (const opts of HEARD_OPTION_SETS) {
          const g032 = audit032(`heard/${u.src}`, u.text, opts);
          if (g032 !== undefined) audit033(`heard/${u.src}`, u.text, opts, g032);
          await tick();
        }
      }
      // Block 2's own corpus: the appended phrases and the yield corpus.
      const phrase = deltaPhraseCorpus(LEXICON_DELTA, lex032, lex031, extraction.extract);
      const phraseTexts = phrase.texts;
      const phraseOpts = h.quick ? [null, { includeSuppressed: true }, ...HEARD_OPTION_SETS] : [...OPTION_SETS, null, ...HEARD_OPTION_SETS];
      for (let k = 0; k < phraseTexts.length; k++) {
        for (const opts of phraseOpts) {
          const g032 = audit032(`delta#${k}`, phraseTexts[k], opts);
          if (g032 !== undefined) audit033(`delta032#${k}`, phraseTexts[k], opts, g032);
          await tick();
        }
      }
      // Every appended-cue text opens with a neutral topic phrase, compared strictly (rule N
      // excuses only captures at or after the cue).
      c.check(phrase.cueTexts > 0 && phrase.withA === phrase.cueTexts, "/extract032/appended-cue/topic-a", { pool: phrase.pool },
        "every appended-cue text is \"<topic A>, <cue> <topic B>\"", { cueTexts: phrase.cueTexts, withTopicA: phrase.withA });
      // Review T11: no such text is excused whole by AD13's apostrophe rule, and in at least one
      // of them a topic-A capture before the cue is outside every AD13 rule (ad13Explain), so the
      // corpus cannot turn vacuous (every text excused) without failing here.
      c.check(phrase.strictA === phrase.withA, "/extract032/appended-cue/strict-a", null,
        "every appended-cue text with a topic A is left whole by normalize (no typographic apostrophe)", { withTopicA: phrase.withA, strictA: phrase.strictA });
      let strictTopicA = 0;
      for (const x of phrase.topicA) {
        let a, b;
        try { a = run(lex031, x.text); b = run(lex032, x.text); } catch (_) { continue; }
        const E = ad13Explain({ delta: LEXICON_DELTA, text: x.text, lexicon: lex032 }, a, b);
        if (!E) continue;
        const excused = new Set([...E.P, ...E.N, ...E.Y, ...E.H, ...E.Ta, ...E.Tn]);
        const strict = (caps) => caps.some((cp) => cp && cp.kind !== "redflag" && x.ids.has(cp.id)
          && typeof cp.cueIndex === "number" && cp.cueIndex < x.cueAt && !excused.has(cp.id));
        if (strict(a) && strict(b)) strictTopicA++;
        await tick();
      }
      c.check(strictTopicA > 0, "/extract032/appended-cue/topic-a-strict", { texts: phrase.topicA.length },
        "≥ 1 appended-cue text whose topic-A capture (before the cue) no AD13 rule touches", strictTopicA);
      // The round-3 utterances (design 05 §13): every R9 / R11 case through block 2.
      const r3Opts = [...OPTION_SETS, null, ...HEARD_OPTION_SETS];
      for (let k = 0; k < ROUND3_TEXTS.length; k++) {
        for (const opts of r3Opts) {
          const g032 = audit032(`round3#${k}`, ROUND3_TEXTS[k], opts);
          if (g032 !== undefined) audit033(`round3#${k}`, ROUND3_TEXTS[k], opts, g032);
          await tick();
        }
      }
      const yieldAll = yieldCorpus(LEXICON_DELTA, lex032);
      const stride = h.quick ? 4 : 1;
      let yieldRun = 0;
      for (let k = 0; k < yieldAll.length; k += stride) {
        for (const opts of [null, { includeSuppressed: true }]) { audit032(`yield#${k}`, yieldAll[k], opts); await tick(); }
        yieldRun++;
      }
      // AD13's heard rule is exercised, not just present: some includeHeard comparison shows heard
      // captures on the shipped side (the 0.3.1-equivalent lexicon has no heard entry) and passes.
      c.check(lex031 === lex032 || audit.heardExplained > 0, "/extract032/heard-rule", null,
        "≥ 1 includeHeard comparison with heard captures on the shipped side, explained by AD13", { withHeard: audit.heard, explained: audit.heardExplained });
      const pct = (k) => (audit.compared ? `${(100 * k / audit.compared).toFixed(1)}%` : "0%");
      c.note(`block 2 (0.3.2 audit, AD13 only): block 1's corpus × (${OPTION_SETS.length + 1} + ${HEARD_OPTION_SETS.length} includeHeard) option sets + ${phraseTexts.length} delta-phrase texts × ${phraseOpts.length} option sets + ${ROUND3_TEXTS.length} round-3 texts × ${r3Opts.length} option sets + ${yieldRun}${stride > 1 ? ` of ${yieldAll.length}` : ""} yield texts × {defaults, includeSuppressed} = ${audit.compared} comparisons of lexicon ${lex031.version} vs ${lex032.version}; ${audit.differed} differed raw, ${audit.explained} explained by AD13`);
      const tnIds = arr(lex032.scale).filter((e) => isObj(e) && arr(e.bands).some((b) => isObj(b) && arr(b.ph).some(bandPhraseMaySpell))).map((e) => e.id);
      c.note(`block 2 strict share: ${audit.apostrophes} comparisons (${pct(audit.apostrophes)}) hold a typographic apostrophe and are excused whole by AD13's normalize rule; ${audit.numbers} (${pct(audit.numbers)}) hold a spelled number token (0-20, 30…90, the engine's token rule), in which rule Tn excuses only value or presence changes of the scale entries with a band phrase that number spelling can change (${tnIds.join(", ") || "none"}), their evidence, cueIndex and suppressedBy still compared, every other scale entry, red flags and non-scale captures strict; every other capture outside rules P / N / Y / H is compared strictly (the capture suite and gold set 0.3.0 own the normalize behaviour). Appended-cue corpus: ${phrase.cueTexts} texts, ${phrase.withA} opening with one of ${phrase.pool} neutral topic phrases, ${phrase.strictA} of them left whole by normalize, ${strictTopicA} with a topic-A capture no AD13 rule touches. Heard rule: ${audit.heard} includeHeard comparisons with heard captures on the shipped side, ${audit.heardExplained} explained by AD13`);
      h.expect("AD13", { precondition: allowedDifference("AD13").detector({ differs: audit.differed > 0 }), observed: audit.explained > 0 });

      // Block 3's own corpus: the 0.3.3 delta's cues and the chart cases of gold set 0.4.0.
      const own033 = delta033Corpus(LEXICON_DELTA_033, lex);
      const ownOpts = h.quick ? [null, { includeSuppressed: true }, ...HEARD_OPTION_SETS, ...CHART_OPTION_SETS] : [...OPTION_SETS, null, ...HEARD_OPTION_SETS, ...CHART_OPTION_SETS];
      for (let k = 0; k < own033.length; k++) {
        for (const opts of ownOpts) { audit033(`delta033#${k}`, own033[k], opts); await tick(); }
      }
      let chart = [];
      try {
        const g40 = JSON.parse(await h.fixture(GOLD_0_4_0_FIXTURE, "text"));
        chart = arr(g40.cases).filter((k) => isObj(k) && k.register === "chart").map((k) => ({ src: `chart:${k.utteranceId}`, text: k.text }));
      } catch (err) {
        c.check(false, "/extract033/chart", { path: `tests/fixtures/${GOLD_0_4_0_FIXTURE}` }, "the chart cases of gold set 0.4.0", `unreadable: ${err && err.message}`);
      }
      c.check(chart.length > 0, "/extract033/chart/cases", null, "≥ 1 chart case", chart.length);
      for (const u of chart) {
        for (const opts of [...OPTION_SETS, null, ...HEARD_OPTION_SETS, ...CHART_OPTION_SETS]) { audit033(u.src, u.text, opts); audit3.chart++; await tick(); }
      }
      const selfChecked = ad18SelfChecks(c, extraction, lex, lex032);
      c.check(lex032 === lex || audit3.differed > 0, "/extract033/differs", null, "≥ 1 comparison of lexicon 0.3.2 vs the shipped lexicon differs raw", audit3.differed);
      c.check(lex032 === lex || audit3.strict > 0, "/extract033/strict", { sampled: audit3.sampled }, "≥ 1 comparison keeps a capture no AD18 rule touches (compared strictly)", audit3.strict);
      c.check(lex032 === lex || (audit3.spoken > 0 && audit3.spokenDiffered > 0 && audit3.spokenExplained > 0), "/extract033/spoken-audited", null,
        "comparisons without opts.chart (spoken lines) differ and are explained by AD18 (D9, 2026-10-12)", { spoken: audit3.spoken, differed: audit3.spokenDiffered, explained: audit3.spokenExplained });
      c.note(`block 3 (0.3.3 audit, AD18 only): block 1's and block 2's corpora (every option set) + ${own033.length} delta-033 cue texts × ${ownOpts.length} option sets + ${chart.length} chart cases × ${OPTION_SETS.length + 1 + HEARD_OPTION_SETS.length + CHART_OPTION_SETS.length} option sets (the last ${CHART_OPTION_SETS.length} with opts.chart) = ${audit3.compared} comparisons of lexicon ${lex032.version} vs ${lex.version} (${audit3.spoken} without opts.chart, read as spoken lines since D9: ${audit3.spokenDiffered} differed raw, ${audit3.spokenExplained} explained); ${audit3.differed} differed raw, ${audit3.explained} explained by AD18; of the first ${audit3.sampled} with captures, ${audit3.strict} keep a capture no AD18 rule touches (compared strictly); ${selfChecked} AD18 self-checks`);
      h.expect("AD18", { precondition: allowedDifference("AD18").detector({ differs: audit3.differed > 0 }), observed: audit3.explained > 0 });
    }

    // Block 4 (the clinical lead's decision D9 of 2026-10-12): the speech-mode audit.
    if (lex032 !== null) {
      let old = null;
      try {
        for (const [file, pin] of Object.entries(ENGINE_046_SHA256)) {
          const sha = await h.sha256(await h.fixture(`${ENGINE_046_DIR}${file}`, "bytes"));
          if (sha !== pin) {
            const e = new Error(`frozen 0.4.6 engine tests/fixtures/${ENGINE_046_DIR}${file}: sha256 ${sha.slice(0, 12)}… ≠ pinned ${pin.slice(0, 12)}…`);
            e.invalid = true;
            throw e;
          }
        }
        old = await h.env.loader.importModule(h.appUrl(`tests/fixtures/${ENGINE_046_DIR}extraction.js`));
      } catch (err) {
        if (err.invalid) throw err;
        c.check(false, "/spoken046/engine", { path: `tests/fixtures/${ENGINE_046_DIR}` }, "the frozen release 0.4.6 engine", `unreadable: ${err && err.message}`);
      }
      let g30 = null;
      try {
        const bytes = await h.fixture(GOLD_0_3_0_FIXTURE, "bytes");
        const sha = await h.sha256(bytes);
        if (sha !== GOLD_0_3_0_SHA256) {
          const e = new Error(`gold set tests/fixtures/${GOLD_0_3_0_FIXTURE}: sha256 ${sha.slice(0, 12)}… ≠ pinned ${GOLD_0_3_0_SHA256.slice(0, 12)}…`);
          e.invalid = true;
          throw e;
        }
        g30 = JSON.parse(new TextDecoder().decode(bytes));
      } catch (err) {
        if (err.invalid) throw err;
        c.check(false, "/spoken046/goldset030", { path: `tests/fixtures/${GOLD_0_3_0_FIXTURE}` }, "gold set 0.3.0", `unreadable: ${err && err.message}`);
      }
      if (old && typeof old.extract === "function" && typeof old.extractInContext === "function") {
        const stat = { compared: 0, audited: 0, differed: 0, explained: 0, dialogues: 0, steps: 0, stepsDiffered: 0, stepsExplained: 0, redFlags: 0 };
        const ad18Spoken = (text) => ({ AD18: { delta: LEXICON_DELTA_033, text, lexicon: lex, chart: false } });
        const call = (fn, lexicon, text, opts) => (opts ? fn(lexicon, text, opts) : fn(lexicon, text));
        // a. lexicon 0.3.2 here reads as release 0.4.6 read it; b. lexicon 0.3.2 vs 0.3.3 as a spoken line, under AD18.
        const cmp = (src, text, opts) => {
          let old32, got32, got33;
          try {
            old32 = call(old.extract, lex032, text, opts);
            got32 = call(extraction.extract, lex032, text, opts);
            got33 = call(extraction.extract, lex, text, opts);
          } catch (err) {
            c.check(false, "/spoken/threw", { text, opts: opts || null }, "captures", String(err.message));
            return;
          }
          c.diff(old32, got32, { at: `/spoken046/${src}`, input: { text, opts: opts || null }, keyOrder: true });
          stat.compared++;
          const raw = JSON.stringify(got32) !== JSON.stringify(got33);
          const r = c.diff(got32, got33, { at: `/extract033/spoken/${src}`, input: { text, opts: opts || null }, keyOrder: true, allow: ["AD18"], ctx: ad18Spoken(text) });
          stat.audited++;
          if (raw) stat.differed++;
          if (r.observed.has("AD18")) stat.explained++;
        };
        // A dialogue as the Scribe runs a spoken line: physician turns passed over, the slot kept, {carry: false}
        // while the pending item is answered. a. the frozen 0.4.6 engine and this one on lexicon 0.3.2 agree on the
        // whole result; b. lexicon 0.3.3's captures are audited against 0.3.2's under AD18, and its slot and carry
        // result (pending, applied, refused) equal 0.3.2's: D9 keeps carry-over exactly as before.
        const dialogue = (src, turns) => {
          const side = () => ({ slot: null, answers: {} });
          const S = { old: side(), a: side(), b: side() };
          const optsOf = (t) => (isObj(t.slot) && t.answers[t.slot.id] !== undefined ? { carry: false } : {});
          arr(turns).forEach((turn, k) => {
            const [speaker, text] = Array.isArray(turn) ? turn : [];
            if (speaker !== "pt" || typeof text !== "string") return;
            let w46, w32, w33;
            try {
              w46 = old.extractInContext(lex032, text, S.old.slot, optsOf(S.old));
              w32 = extraction.extractInContext(lex032, text, S.a.slot, optsOf(S.a));
              w33 = extraction.extractInContext(lex, text, S.b.slot, optsOf(S.b));
            } catch (err) {
              c.check(false, `/spoken/dialogue/${src}/${k}/threw`, { text }, "a result", String(err.message));
              return;
            }
            c.diff(w46, w32, { at: `/spoken046/dialogue/${src}/${k}`, input: { text, pending: S.old.slot }, keyOrder: true });
            const raw = JSON.stringify(w32.captures) !== JSON.stringify(w33.captures);
            const r = c.diff(w32.captures, w33.captures, { at: `/extract033/spoken-dialogue/${src}/${k}/captures`, input: { text, pending: S.a.slot }, keyOrder: true, allow: ["AD18"], ctx: ad18Spoken(text) });
            c.diff({ pending: w32.pending, carry: w32.carry }, { pending: w33.pending, carry: w33.carry }, { at: `/spoken-carry/dialogue/${src}/${k}`, input: { text, pending: S.a.slot }, keyOrder: true });
            stat.steps++;
            if (raw) stat.stepsDiffered++;
            if (r.observed.has("AD18")) stat.stepsExplained++;
            for (const [t, w] of [[S.old, w46], [S.a, w32], [S.b, w33]]) {
              t.slot = w.pending;
              for (const cp of arr(w.captures)) if (isObj(cp) && cp.kind === "item" && t.answers[cp.id] === undefined) t.answers[cp.id] = cp.value;
            }
          });
          stat.dialogues++;
        };
        const g30cases = g30 ? arr(g30.cases).filter((k) => isObj(k) && typeof k.text === "string") : [];
        const g30dialogues = g30 ? arr(g30.dialogues).filter((d) => isObj(d) && Array.isArray(d.turns)) : [];
        let chartTexts = [];
        try {
          const g40 = JSON.parse(await h.fixture(GOLD_0_4_0_FIXTURE, "text"));
          chartTexts = arr(g40.cases).filter((k) => isObj(k) && k.register === "chart").map((k) => ({ src: `chart-spoken:${k.utteranceId}`, text: k.text }));
        } catch (err) {
          c.check(false, "/spoken/chart", { path: `tests/fixtures/${GOLD_0_4_0_FIXTURE}` }, "the chart cases of gold set 0.4.0", `unreadable: ${err && err.message}`);
        }
        const demoTurns = arr(module.demo && module.demo.transcript);
        const demoPt = demoTurns.filter((t) => Array.isArray(t) && t[0] === "pt");
        const named = [
          ...gold.map((u) => ({ src: `ref:${u.src}`, text: u.text })),
          ...g30cases.map((k) => ({ src: `gold030:${k.utteranceId}`, text: k.text })),
          ...demoPt.map((t, i) => ({ src: `module-demo:pt#${i}`, text: t[1] })),
          ...demo.map((u) => ({ src: `scribe-script:${u.src}`, text: u.text })),
          ...chartTexts,
          ...ROUND3_TEXTS.map((t, i) => ({ src: `round3#${i}`, text: t })),
          ...SPEECH_RED_FLAGS.map(([label, t]) => ({ src: `speech-red-flag:${label}`, text: t })),
        ];
        for (const u of named) for (const opts of SPOKEN_OPTION_SETS) { cmp(u.src, u.text, opts); await tick(); }
        const cueTexts = delta033Corpus(LEXICON_DELTA_033, lex);
        for (let k = 0; k < cueTexts.length; k++) for (const opts of [null, { includeHeard: true, includeSuppressed: true }]) { cmp(`delta033#${k}`, cueTexts[k], opts); await tick(); }
        for (const u of synth) for (const opts of [null, { includeHeard: true, includeSuppressed: true }]) { cmp(u.src, u.text, opts); await tick(); }
        for (const d of g30dialogues) dialogue(`gold030:${d.dialogueId || d.id}`, d.turns);
        dialogue("module-demo", demoTurns);
        dialogue("scribe-script", scb.SCRIPT);
        // c. Explicit speech red-flag tests, through extract and through extractInContext (no slot).
        const flagsOf = (caps) => arr(caps).filter((q) => isObj(q) && q.kind === "redflag" && q.suppressedBy === undefined).map((q) => q.id);
        for (const [label, text, raised, notRaised] of SPEECH_RED_FLAGS) {
          let viaExtract, viaContext;
          try {
            viaExtract = flagsOf(extraction.extract(lex, text, { includeHeard: true }));
            viaContext = flagsOf(extraction.extractInContext(lex, text, null).captures);
          } catch (err) {
            c.check(false, `/speech-red-flags/${label}/threw`, { text }, "captures", String(err.message));
            continue;
          }
          for (const [how, got] of [["extract", viaExtract], ["extractInContext", viaContext]]) {
            c.diff([], raised.filter((id) => !got.includes(id)), { at: `/speech-red-flags/${label}/${how}/raised`, input: { text, got } });
            c.diff([], notRaised.filter((id) => got.includes(id)), { at: `/speech-red-flags/${label}/${how}/not-raised`, input: { text, got } });
          }
          stat.redFlags++;
        }
        c.check(g30cases.length === 218 && g30dialogues.length === 93, "/spoken/goldset030/size", null, "218 cases, 93 dialogues", { cases: g30cases.length, dialogues: g30dialogues.length });
        c.check(stat.compared > 0 && stat.steps > 0 && demoPt.length > 0 && stat.differed > 0 && stat.explained > 0, "/spoken/ran", null,
          "comparisons and dialogue steps; some spoken comparisons differ between lexicon 0.3.2 and 0.3.3 and are explained by AD18", stat);
        c.note(`block 4 (speech-mode audit, D9 2026-10-12): ${named.length} named texts (${gold.length} reference, ${g30cases.length} gold 0.3.0, ${demoPt.length} module demo, ${demo.length} Scribe script, ${chartTexts.length} gold 0.4.0 chart cases read as spoken lines, ${ROUND3_TEXTS.length} round-3, ${SPEECH_RED_FLAGS.length} speech red-flag texts) × ${SPOKEN_OPTION_SETS.length} option sets + ${cueTexts.length} delta-033 cue texts and ${synth.length} synthetic utterances × 2 option sets: ${stat.compared} comparisons of the frozen 0.4.6 engine and this one on lexicon ${lex032.version} (strict), and ${stat.audited} of lexicon ${lex032.version} vs ${lex.version} as spoken lines under AD18 (${stat.differed} differed raw, ${stat.explained} explained); ${stat.dialogues} dialogues (${g30dialogues.length} gold 0.3.0, the module demo, the Scribe script), ${stat.steps} extractInContext steps: whole result strict against release 0.4.6 on lexicon ${lex032.version}, lexicon ${lex.version}'s captures under AD18 (${stat.stepsDiffered} differed, ${stat.stepsExplained} explained) and its slot and carry result strictly equal; ${stat.redFlags} explicit speech red-flag texts, each through extract and extractInContext`);
      }
    }

    // createExtractor and the negation helper.
    if (lex031 === null) {
      // Reported at /lexicon031.
    } else if (typeof extraction.createExtractor === "function") {
      const ex = extraction.createExtractor(lex031);
      c.check(ex.lexiconVersion === ext.LEXICON_VERSION, "/createExtractor/lexiconVersion", null, ext.LEXICON_VERSION, ex.lexiconVersion);
      for (const u of [...gold, ...demo].slice(0, 60)) {
        c.diff(ext.extract(u.text), ex.extract(u.text), { at: `/createExtractor/${u.src}`, input: { text: u.text }, keyOrder: true });
        for (let idx = 0; idx <= u.text.length; idx += 7) {
          c.diff(ext.negatedNear(u.text, idx), ex.negatedNear(u.text, idx), { at: `/negatedNear/${u.src}/${idx}`, input: { text: u.text, idx } });
        }
      }
      const shipped = extraction.createExtractor(lex);
      c.check(shipped.lexiconVersion === lex.version, "/createExtractor/@shipped/lexiconVersion", null, lex.version, shipped.lexiconVersion);
    } else {
      c.check(false, "/createExtractor", null, "function", "absent (waits on WP5)");
    }
    c.check(extraction.EXTRACTOR_KIND === ext.EXTRACTOR_KIND, "/EXTRACTOR_KIND", null, ext.EXTRACTOR_KIND, extraction.EXTRACTOR_KIND);

    // FAERS adapter.
    for (const f of faersFixture()) {
      let want, got;
      try { want = ext.faersToUtterances(f.input); } catch (err) { want = `throws: ${err.message}`; }
      try { got = extraction.faersToUtterances(f.input); } catch (err) { got = `throws: ${err.message}`; }
      c.diff(want, got, { at: `/faersToUtterances/${f.name}`, input: f.input, keyOrder: true });
    }
    return c.result();
  }),
};
