// tests/suites/extraction.js — free-text extraction parity (design 03 §8.3 `extraction`; design 05
// §7.2). Owner: WP13; accepts WP5 (with WP1's lexicon); block 2 and the 0.3.1-equivalent subject:
// WP-H.
//
// The parity subject is the 0.3.1-equivalent lexicon lex031 = revertLexiconDelta(masque.lexicon,
// LEXICON_DELTA) (tests/harness/lexicon-delta.js): the exact inverse of the approved 0.3.1 → 0.3.2
// delta, which the values suite proves. A shipped lexicon that is neither 0.3.1 nor exactly
// 0.3.1 + the delta gives null and FAILS at /lexicon031.
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
// extract(masque.lexicon, t, o) at /extract032/<src>, allow ["AD13"], ctx.AD13 = {delta, text: t,
// lexicon: masque.lexicon}, over block 1's corpus and option matrix, plus:
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
// Block 1 has no AD; block 2 allows AD13 only (§8.4).
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { pick, sizes } from "../harness/matrix.js";
import { ad13Explain, allowedDifference, bandPhraseMaySpell, normalizeRewrites, revertLexiconDelta } from "../harness/diff.js";
import { LEXICON_DELTA } from "../harness/lexicon-delta.js";

const GOLDSET_PATH = "../reference/MASQUE_v0.3.1/masque_extraction_goldset.json";
const GOLDSET_SHA256 = "e1d6573695e554e57dd44cfab3de6699dccc6518c42f2b28afa32d9ddcab6cb2";
const WINDOWS = [8, 14, 20];
const FILLERS = ["", "really ", "honestly ", "sometimes ", "I think ", "and ", "but ", "also "];
const JOINS = [", ", ". ", " and ", " — ", "; ", ", but "];
/** Block 2's frames for an appended phrase (design 05 §7.2). */
const FRAMES = ["", "not ", "my mother ", "used to "];
/** The prefixes of the yield corpus (design 05 §7.4 block 4). */
const YIELD_PREFIXES = ["", "my mother ", "used to "];
/** Block 2's option sets that return heard captures (AD13's heard rule, review F4 tests). */
const HEARD_OPTION_SETS = [{ includeHeard: true }, { includeHeard: true, includeSuppressed: true }];
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
    // The parity subject: the 0.3.1-equivalent lexicon (design 05 §7.1). Without it neither block
    // can run; the lexicon-independent checks (EXTRACTOR_KIND, FAERS) still do.
    const lex031 = revertLexiconDelta(lex, LEXICON_DELTA);
    if (!c.check(lex031 !== null, "/lexicon031", { version: lex.version },
      `the shipped lexicon is ${LEXICON_DELTA.from} or exactly ${LEXICON_DELTA.from} + tests/harness/lexicon-delta.js (revertLexiconDelta)`,
      "revertLexiconDelta returned null")) {
      c.note(`lexicon ${JSON.stringify(lex.version)} is neither ${LEXICON_DELTA.from} nor exactly the ${LEXICON_DELTA.from} → ${LEXICON_DELTA.to} delta; blocks 1 and 2 not run`);
    }
    c.note(lex031 === lex
      ? `parity subject: the shipped lexicon itself (version ${lex.version}; the delta has not landed)`
      : lex031 !== null ? `parity subject: revertLexiconDelta(lexicon ${lex.version}) = lexicon ${lex031.version}` : "parity subject: none");

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
        b = lex031 === lex ? a : run(lex, text, opts);
      } catch (err) {
        if (/not implemented/.test(err.message)) throw err;
        c.check(false, "/extract032/threw", { text, opts: opts || null }, "captures", String(err.message));
        return;
      }
      const raw = JSON.stringify(a) !== JSON.stringify(b);
      const r = c.diff(a, b, {
        at: `/extract032/${src}${opts ? "" : "/defaults"}`, input: { text, opts: opts || null }, keyOrder: true,
        allow: ["AD13"], ctx: { AD13: { delta: LEXICON_DELTA, text, lexicon: lex } },
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
          audit032(u.src, u.text, opts, got);
          await tick();
        }
      }
      c.note(`block 1 (strict, no AD) extract: ${gold.length} gold + ${demo.length} demo turns + ${synth.length} synthetic utterances × includeSuppressed {false, true} × negationWindow {${WINDOWS.join(", ")}} (+ defaults) = ${compared} comparisons on lexicon ${lex031.version}`);

      // Block 1's corpus again with heard captures returned (AD13's heard rule, review F4 tests).
      for (const u of corpus) {
        for (const opts of HEARD_OPTION_SETS) { audit032(`heard/${u.src}`, u.text, opts); await tick(); }
      }
      // Block 2's own corpus: the appended phrases and the yield corpus.
      const phrase = deltaPhraseCorpus(LEXICON_DELTA, lex, lex031, extraction.extract);
      const phraseTexts = phrase.texts;
      const phraseOpts = h.quick ? [null, { includeSuppressed: true }, ...HEARD_OPTION_SETS] : [...OPTION_SETS, null, ...HEARD_OPTION_SETS];
      for (let k = 0; k < phraseTexts.length; k++) {
        for (const opts of phraseOpts) { audit032(`delta#${k}`, phraseTexts[k], opts); await tick(); }
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
        try { a = run(lex031, x.text); b = run(lex, x.text); } catch (_) { continue; }
        const E = ad13Explain({ delta: LEXICON_DELTA, text: x.text, lexicon: lex }, a, b);
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
        for (const opts of r3Opts) { audit032(`round3#${k}`, ROUND3_TEXTS[k], opts); await tick(); }
      }
      const yieldAll = yieldCorpus(LEXICON_DELTA, lex);
      const stride = h.quick ? 4 : 1;
      let yieldRun = 0;
      for (let k = 0; k < yieldAll.length; k += stride) {
        for (const opts of [null, { includeSuppressed: true }]) { audit032(`yield#${k}`, yieldAll[k], opts); await tick(); }
        yieldRun++;
      }
      // AD13's heard rule is exercised, not just present: some includeHeard comparison shows heard
      // captures on the shipped side (the 0.3.1-equivalent lexicon has no heard entry) and passes.
      c.check(lex031 === lex || audit.heardExplained > 0, "/extract032/heard-rule", null,
        "≥ 1 includeHeard comparison with heard captures on the shipped side, explained by AD13", { withHeard: audit.heard, explained: audit.heardExplained });
      const pct = (k) => (audit.compared ? `${(100 * k / audit.compared).toFixed(1)}%` : "0%");
      c.note(`block 2 (0.3.2 audit, AD13 only): block 1's corpus × (${OPTION_SETS.length + 1} + ${HEARD_OPTION_SETS.length} includeHeard) option sets + ${phraseTexts.length} delta-phrase texts × ${phraseOpts.length} option sets + ${ROUND3_TEXTS.length} round-3 texts × ${r3Opts.length} option sets + ${yieldRun}${stride > 1 ? ` of ${yieldAll.length}` : ""} yield texts × {defaults, includeSuppressed} = ${audit.compared} comparisons of lexicon ${lex031.version} vs ${lex.version}; ${audit.differed} differed raw, ${audit.explained} explained by AD13`);
      const tnIds = arr(lex.scale).filter((e) => isObj(e) && arr(e.bands).some((b) => isObj(b) && arr(b.ph).some(bandPhraseMaySpell))).map((e) => e.id);
      c.note(`block 2 strict share: ${audit.apostrophes} comparisons (${pct(audit.apostrophes)}) hold a typographic apostrophe and are excused whole by AD13's normalize rule; ${audit.numbers} (${pct(audit.numbers)}) hold a spelled number token (0-20, 30…90, the engine's token rule), in which rule Tn excuses only value or presence changes of the scale entries with a band phrase that number spelling can change (${tnIds.join(", ") || "none"}), their evidence, cueIndex and suppressedBy still compared, every other scale entry, red flags and non-scale captures strict; every other capture outside rules P / N / Y / H is compared strictly (the capture suite and gold set 0.3.0 own the normalize behaviour). Appended-cue corpus: ${phrase.cueTexts} texts, ${phrase.withA} opening with one of ${phrase.pool} neutral topic phrases, ${phrase.strictA} of them left whole by normalize, ${strictTopicA} with a topic-A capture no AD13 rule touches. Heard rule: ${audit.heard} includeHeard comparisons with heard captures on the shipped side, ${audit.heardExplained} explained by AD13`);
      h.expect("AD13", { precondition: allowedDifference("AD13").detector({ differs: audit.differed > 0 }), observed: audit.explained > 0 });
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
