// tests/harness/diff.js — path-reporting deep diff and the allowed-difference table
// (design 03 §8.0, §8.4, §8.7). No imports; nothing happens at import time.
//
// deepDiff(a, b, {allow, at, keyOrder, input, ctx}) → {diffs, observed, truncated}
//   a = oracle (baseline) value, b = new value. Paths are RFC 6901 JSON pointers relative to
//   `at` (default ""): the whole document is "" and "/" would be the key "". `allow` names the
//   allowed differences (AD ids) whose normalisers may apply; `observed` is the set of AD ids
//   whose difference was actually seen (normalised away). Nothing outside ALLOWED_DIFFERENCES
//   can widen a comparison: an unknown AD id throws instead of silently comparing less.
//
// Each allowed difference is {id, ready, owner, what, appliesTo(path, ctx), normalise(a, b, ctx,
// path) → [a2, b2], detector(input) → boolean}. A normaliser returns its inputs unchanged (the same
// references) when it does not apply; a changed pair counts as observed. Every normaliser is
// exact: it rewrites only the one documented difference, at the one documented place, and only
// when the new side shows exactly the documented new form. Anything else stays a difference.
//
// Parameters travel in `ctx`, keyed by AD id (ctx.AD1 = {total, floor} …); a normaliser whose
// parameters are absent never applies. The parameter object of each AD is documented on it.
// `detector(input)` answers "does this input exhibit the AD's precondition?" for h.expect: a
// precondition that occurs while the difference is not observed is "expected difference
// missing" → FAIL (§8.4).
//
// applyLexiconDelta(lex, delta) / revertLexiconDelta(lex, delta) (design 05 §6.2) apply and
// invert the approved lexicon delta whose data lives in tests/harness/lexicon-delta.js; the
// generator, the parity suites and AD13 all go through these two functions. The delta itself
// travels in arguments and in ctx.AD13, never through an import. normalizeRewrites(text, normalize)
// answers which lexicon.normalize rewrites the engine applies to a text (AD13 rule T), for suites
// that report how much of a corpus AD13 can excuse. For self-checks of AD13 itself (review T5):
// ad13Explain(ctx.AD13, a, b) lists the ids each extraction rule acts on, heardBandChoiceMayDiffer
// is rule H, bandPhraseMaySpell decides which scale entries rule Tn covers, and AD13_NUMBER_WORDS
// with numberProbeLexicon() cross-check the hand-copied number rule against the engine.
//
// applyLocaleDelta(locale, delta) / revertLocaleDelta(locale, delta) (release 0.4.2) apply and
// invert the Spanish completion whose data lives in tests/harness/locale-delta.js, the same way:
// apply only adds (an existing key is refused), in the English key order; revert removes exactly
// what apply added and proves it by re-applying. The generator and the suites go through these two.
// AD14 (the Spanish completion as the patient sees it) takes its parameters from ad14Params(…),
// built from that delta and the engine's Spanish chrome, and applies only where the comparison's
// own ctx.loc is that locale; ad14Explain lists which of its rules
// act on one comparison (the suites' per-rule h.expect), and ad14ISound is the test's own
// statement of the "e" rule.
//
// applyEmrDelta(rubric, delta) / revertEmrDelta(rubric, delta) (release 0.4.3) insert and remove
// the EMR template data of tests/harness/emr-delta.js as one new top-level rubric key, just before
// `changelog`: apply refuses a key that already exists; revert removes exactly what apply added and
// proves it by re-applying. The generator goes through these two. Both refuse a delta whose
// drafted.reviewed is true without a complete clinical-lead signOff record (release 0.4.4).
//
// AD15 (release 0.4.3) excuses only the added "EMR Friendly Template" button: in rendered text, the
// button's own text right after a named anchor (the Screener's write button, the Scribe's "Sign to
// chart"); in a tag/class shape list, its entries inserted right after a named anchor run. The
// panel it opens is never part of a parity comparison.
//
// AD16 (release 0.4.3) excuses only the two Patient .txt lines that the screen and the .html
// already show and the baseline .txt leaves out: the thin warning right after the header and the
// not-sure lede right under its heading, as the baseline's own UI[loc] strings; ad16Params builds
// its parameters from the baseline summary. It never overlaps AD14: in es its strings are the
// baseline's own Spanish, which no AD14 rule rewrites.
//
// applyReferralDelta(rubric, delta) / revertReferralDelta(rubric, delta) (release 0.4.5) apply and
// invert the clinical-lead referral rule of tests/harness/referral-delta.js under
// /phenotypes/referral only: a changed row replaces exactly its `from`, an added row adds a key that
// must not exist yet; revert removes exactly what apply did and proves it by re-applying. AD17
// (release 0.4.5) excuses exactly the rows of the delta's `destinations` (otologic: Neuro-otology →
// Neurology; both: Headache medicine / Neurology → Neurology; the reason unchanged) in a referral
// ServiceRequest's code text, for the comparison's phenotype only (ctx.AD17 = {delta, complaint};
// the delta travels in ctx, never through an import).
//
// Release 0.4.7: the lexicon deltas form a chain. tests/harness/lexicon-delta-033.js (0.3.2 → 0.3.3:
// lexicon.clauses, lexicon.clarify, four negation cues, the gold-set reference) goes through the
// same applyLexiconDelta / revertLexiconDelta after the 0.3.2 delta, which stays as it was;
// revertLexiconChain(lex, [LEXICON_DELTA, LEXICON_DELTA_033]) gives the 0.3.1-equivalent lexicon.
// AD18 excuses exactly that delta: at /lexicon and /module/versions as AD13 does (listed before AD13,
// so AD13 then sees the 0.3.2 form), and in /extract033/… capture arrays by an evidence rule (the
// clause evidence back to the whole text) and per-id rules that each state a superset of one
// chart-reading mechanism (ad18Explain lists them for self-checks). Since the clinical lead's decision
// D9 of 2026-10-12 chart reading applies to spoken and demo lines too, so a comparison without
// opts.chart (ctx.AD18.chart false: a spoken line) is excused by the same rules, except the two that
// belong to typed chart text: P (the chart pronouns) and X (no context marker from typed chart text,
// D8). Review round 2 had kept every spoken comparison strict.
//
// applyEmrDecisionsDelta(rubric, delta) / revertEmrDecisionsDelta(rubric, delta) (release 0.4.6)
// apply and invert the clinical lead's EMR-template answers of 2026-10-10 that add data
// (tests/harness/emr-decisions-delta.js): each added row adds a key that must not exist yet to an
// object under /emrTemplate (a list on the way is entered by index), nothing else; revert removes
// exactly what apply did and proves it by re-applying. The signed-off release 0.4.3 block of
// tests/harness/emr-delta.js stays as it was under it.
//
// applyQuestionDelta(rubric, delta) / revertQuestionDelta(rubric, delta) (release 0.4.8) apply and
// invert the clinical lead's clinician question for item r_dur of 2026-10-12
// (tests/harness/question-delta-048.js): each changed row replaces one item's `ask`, which must
// still read its `from`, on the item its `item` names, under /domains/<i>/items/<j> only; revert
// restores exactly that and proves it by re-applying. AD19 excuses exactly that question where the
// baseline printed the old one (a suggestion or heard prompt of that item), never anywhere else.
//
// AD20 (release 0.4.8) excuses only the English version of the findings that a Spanish patient
// summary adds for an English-speaking clinician (the clinical lead's request of 2026-10-12): in a
// .txt the exact block ad20Block builds (the two titles, the English caveat lines of the view,
// ad20EnglishNotices of the English .txt, and the English findings, ad20EnglishBody of the English
// .txt of the same answers) right before the footer rule; in rendered text the exact text of the
// English version section right before the disclaimer. Never in English. The built-in module has no
// English caveat lines, so its block is the titles and the findings.
//
// Release 0.4.8, follow-up: the clinical lead's EMR plan line (tests/harness/emr-plan-delta-048.js)
// adds one key under /emrTemplate and goes through applyEmrDecisionsDelta / revertEmrDecisionsDelta
// unchanged (the shape of the 0.4.6 answers). AD21 excuses only the Ambient Scribe's added
// "Question review" tab (the clinical lead's request of 2026-10-12, "to the right of "Ask Next""):
// in the text of the Scribe's right card in the Safety, Ask-next and Note views, the tab's own text
// right after the Ask next tab's text and right before the Note tab's, exactly once. The review
// view itself is never part of a parity comparison (the baseline has none).

/** The release string the frozen baseline prints, and the one screenAIr prints (AD4). */
export const BASELINE_RELEASE = "0.3.0";
export const NEW_RELEASE = "0.4.8";
const RELEASE_RE = /(?<![\d.])0\.3\.0(?![\d.])/g;

/** The dated caveat line that closes every Patient .txt export (AD10, §4.12). */
export const DATED_CAVEAT_RE = /^Prototype · not for clinical use · \d{4}-\d{2}-\d{2}$/;

/** The footer rule of a Patient .txt (Pat L1115) and the rule around its English version (AD20, release 0.4.8). */
export const AD20_FOOTER_RULE = "-".repeat(40);
const AD20_RULE = "=".repeat(40);

const unchanged = (a, b) => [a, b];
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x) && !(x instanceof Date);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

function withoutKeys(obj, keys) {
  const out = {};
  for (const k of Object.keys(obj)) if (!keys.includes(k)) out[k] = obj[k];
  return out;
}

// ------------------------------------------------------------------------------- CSV helpers

/** Split one CSV line (RFC 4180 quoting as rowsToCsv writes it) into raw cells. */
function csvCells(line) {
  const cells = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '""'; i++; }
      else if (ch === '"') { q = false; cur += ch; }
      else cur += ch;
    } else if (ch === '"') { q = true; cur += ch; }
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}

/** CSV text → array of lines (rowsToCsv joins with "\n"; quoted cells may contain "\n"). */
function csvLines(text) {
  const lines = [];
  let cur = "", q = false;
  for (const ch of text) {
    if (ch === '"') q = !q;
    if (ch === "\n" && !q) { lines.push(cur); cur = ""; } else cur += ch;
  }
  lines.push(cur);
  return lines;
}

function dropCsvColumns(text, names) {
  const lines = csvLines(text);
  const header = csvCells(lines[0]);
  const drop = new Set(names.map((n) => header.indexOf(n)).filter((i) => i >= 0));
  return lines.map((l) => csvCells(l).filter((_, i) => !drop.has(i)).join(",")).join("\n");
}

const looksLikeCohortCsv = (s) => typeof s === "string" && /^screen_id,/.test(s);

// ------------------------------------------------------------------------------- AD2 rows

/** The engine row's extra columns relative to a baseline row, for AD2 (null = not the AD2 shape). */
function ad2Extra(xKeys, yKeys, p) {
  if (xKeys.includes("module_id")) return null;
  const iApp = yKeys.indexOf("app_version");
  if (iApp < 0 || yKeys[iApp + 1] !== "module_id") return null;
  const extra = ["module_id"];
  if (p.scribe) {
    // Scribe rows lacked subject_id, visit_label and gender (Scb L497); the engine row has them.
    for (const k of ["subject_id", "visit_label", "gender"]) if (!xKeys.includes(k) && yKeys.includes(k)) extra.push(k);
  }
  return extra;
}

// ------------------------------------------------------------------------------- AD6 wording

const ad6Cache = new WeakMap();
function ad6Regex(p) {
  if (ad6Cache.has(p)) return ad6Cache.get(p);
  const map = new Map();
  for (const [from, to] of p.pairs) {
    if (typeof from !== "string" || typeof to !== "string" || !from) continue;
    if (map.has(from) && map.get(from) !== to) throw new Error(`AD6: "${from}" maps to two canonical strings`);
    map.set(from, to);
  }
  // Canonical strings map to themselves, so a canonical string that contains a Scribe
  // abbreviation as a prefix is matched whole (longest first) and never rewritten.
  for (const [, to] of p.pairs) if (typeof to === "string" && to && !map.has(to)) map.set(to, to);
  const keys = [...map.keys()].sort((x, y) => y.length - x.length);
  const re = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const r = { re, map };
  ad6Cache.set(p, r);
  return r;
}

/** Map every Scribe red-flag string in `s` to the canonical Screener wording (AD6). */
export function ad6Canonical(s, p) {
  const { re, map } = ad6Regex(p);
  return s.replace(re, (m) => map.get(m));
}

/**
 * Build the AD6 parameter object from the two baseline red-flag tables (by id): every field
 * the Scribe prints (text, points, action) paired with the Screener's.
 */
export function ad6Pairs(scribeFlags, screenerFlags) {
  const byId = new Map(screenerFlags.map((f) => [f.id, f]));
  const pairs = [];
  for (const f of scribeFlags) {
    const c = byId.get(f.id);
    if (!c) continue;
    for (const k of ["text", "points", "action"]) pairs.push([f[k], c[k]]);
  }
  return { pairs };
}

// ------------------------------------------------------------------------------- lexicon delta

const arr = (x) => (Array.isArray(x) ? x : []);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const clone = (x) => JSON.parse(JSON.stringify(x));
const IDX = "(?:0|[1-9]\\d*)";
const IDX_RE = /^(?:0|[1-9]\d*)$/;
/** The apostrophe look-alikes lexicon.normalize.apostrophes folds to U+0027 (lead decision D4). */
const AD13_FOLDED_RE = new RegExp("[\\u2018\\u2019\\u02BC\\u2032]");
const AD13_FOLDED_G = new RegExp("[\\u2018\\u2019\\u02BC\\u2032]", "g");
/**
 * A number token the engine spells out under lexicon.normalize.numbers "en": the engine's own
 * token rule (extraction.js NUMBER_TOKEN: not preceded by a letter, a digit or one of . : / , % -;
 * not followed by a letter, a digit or one of : / , % -; a following "." only when whitespace or
 * the end of the text comes after it) restricted to the spelled keys 0-20 and 30, 40 … 90 (the
 * keys of AD13_NUMBER_WORDS, below). The digit lookarounds make the alternation match a whole
 * digit run only, so "05", "22", "120", "2.5", "3-4" and "10:30" never match, exactly as the
 * engine leaves them as digits.
 */
const AD13_SPELLED_RE = /(?<![\p{L}\p{N}.:\/,%-])(?:1[0-9]|20|[3-9]0|[0-9])(?![\p{L}\p{N}:\/,%-])(?!\.\S)/u;

/**
 * What lexicon.normalize `n` can rewrite in `text`, as the engine applies it (design 05 §11.6, D4):
 *   apostrophes  n.apostrophes === true and the text holds a typographic apostrophe;
 *   numbers      n.numbers === "en" and the text (apostrophes folded first when n.apostrophes is
 *                true, as the engine does: U+02BC is a letter before folding) holds a token the
 *                engine spells out (AD13_SPELLED_RE).
 * Pure; never throws. A non-object `n` rewrites nothing.
 * @param {string} text
 * @param {object} n  a lexicon.normalize value
 * @returns {{apostrophes: boolean, numbers: boolean}}
 */
export function normalizeRewrites(text, n) {
  if (typeof text !== "string" || !isObj(n)) return { apostrophes: false, numbers: false };
  const apostrophes = n.apostrophes === true && AD13_FOLDED_RE.test(text);
  const folded = n.apostrophes === true ? text.replace(AD13_FOLDED_G, "'") : text;
  return { apostrophes, numbers: n.numbers === "en" && AD13_SPELLED_RE.test(folded) };
}

/**
 * The words lexicon.normalize.numbers "en" writes for the tokens AD13_SPELLED_RE matches, in key
 * order (0-20, then 30, 40 … 90): a hand copy of the engine's word map (extraction.js
 * NUMBER_WORDS_EN). Suites cross-check it, and AD13_SPELLED_RE, against the engine through
 * numberProbeLexicon (review T5).
 */
export const AD13_NUMBER_WORDS = Object.freeze(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
  "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]);

const ALNUM_RE = /[\p{L}\p{N}]/u;
const DIGIT_RE = /\p{N}/u;

/**
 * Whether number spelling can change whether band phrase `p` matches (AD13 rule T, review T4).
 * A spelled word replaces a digit token that has no letter or digit on either side, so a match of
 * `p` can only gain or lose an occurrence that overlaps a spelled word when `p`
 *   - holds a digit (it matched the typed digits, which spelling removes: validator V29), or
 *   - lies inside one number word ("even" in "seven"), or
 *   - holds a whole number word with no letter or digit next to it inside `p`, or
 *   - begins with the tail of a number word ("en minutes" in "ten minutes") or ends with the head
 *     of one ("lasts tw"), the rest of `p` starting (ending) at a non-alphanumeric character.
 * Every other phrase matches the spelled view exactly where it matches the folded text. A superset:
 * the lookarounds of AD13_SPELLED_RE are narrower than "not a letter or digit".
 * @param {string} p  a lowercase band phrase
 * @returns {boolean}
 */
export function bandPhraseMaySpell(p) {
  if (typeof p !== "string" || p === "") return false;
  if (DIGIT_RE.test(p)) return true;
  for (const w of AD13_NUMBER_WORDS) {
    if (w.includes(p)) return true;
    for (let i = p.indexOf(w); i !== -1; i = p.indexOf(w, i + 1)) {
      if ((i === 0 || !ALNUM_RE.test(p[i - 1])) && (i + w.length === p.length || !ALNUM_RE.test(p[i + w.length]))) return true;
    }
    for (let k = 1; k < w.length; k++) {
      const tail = w.slice(k), head = w.slice(0, w.length - k);
      if (p.startsWith(tail) && (p.length === tail.length || !ALNUM_RE.test(p[tail.length]))) return true;
      if (p.endsWith(head) && (p.length === head.length || !ALNUM_RE.test(p[p.length - head.length - 1]))) return true;
    }
  }
  return false;
}

/**
 * A probe lexicon for cross-checking normalizeRewrites against the engine (review T5): one scale
 * entry "probe" whose cue is every ASCII letter and digit (so any text with one opens it) and whose
 * only band (v 1) is every AD13_NUMBER_WORDS word; no negation, attribution or history cues. The
 * engine's extract(probe, t) holds {id: "probe", value: 1} exactly when a number word occurs in the
 * band-matching view of `t`. With `normalize` (default {numbers: "en"}) that view is the spelled
 * one; with null it is the text itself. For a text in which no number word occurs literally, the
 * two differ exactly when the engine spelled a token, which must equal normalizeRewrites(t,
 * normalize).numbers. Fresh object on every call.
 * @param {object|null} [normalize]
 * @returns {object}
 */
export function numberProbeLexicon(normalize = { numbers: "en" }) {
  const lex = {
    version: "probe", lang: "en",
    scale: [{ id: "probe", cue: [..."abcdefghijklmnopqrstuvwxyz0123456789"], bands: [{ ph: [...AD13_NUMBER_WORDS], v: 1 }], fallback: null }],
  };
  if (isObj(normalize)) lex.normalize = { ...normalize };
  return lex;
}

/**
 * The sentence index of an offset in `text` (round 3 R11, the engine's rule): a sentence ends at
 * one of . ! ? ; that is followed by whitespace or by the end of the text. A "." inside "2.5" or
 * "e.g." (no whitespace after it) ends nothing; "e.g. " does. Offsets are counted by the boundaries
 * strictly before them, so the punctuation belongs to the sentence it closes.
 */
function sentenceIndex(text) {
  const ends = [];
  for (let k = 0; k < text.length; k++) {
    if (".!?;".includes(text[k]) && (k + 1 === text.length || /\s/.test(text[k + 1]))) ends.push(k);
  }
  return (pos) => ends.filter((e) => e < pos).length;
}

/**
 * The lists a lexicon delta may append to (paths relative to the lexicon, using the `from`
 * lexicon's positional indices), each with the family whose positional entry the row's `entryId`
 * asserts (null: the list belongs to no entry, so the row takes no entryId). Item vocabulary
 * (design 05 §6.2) plus the negation and third-party cue lists (lead decision D3). The historical
 * cue list is not open to a delta.
 */
const DELTA_APPEND = [
  [new RegExp(`^/bool/${IDX}/ph$`), "bool"],
  [new RegExp(`^/ctx/${IDX}/ph$`), "ctx"],
  [new RegExp(`^/multi/${IDX}/ph$`), "multi"],
  [new RegExp(`^/scale/${IDX}/cue$`), "scale"],
  [new RegExp(`^/scale/${IDX}/bands/${IDX}/ph$`), "scale"],
  [/^\/redFlags\/[^/~]+$/, "redFlags"],
  [/^\/negation\/cues$/, null],
  [/^\/thirdParty\/cues$/, null],
];

/**
 * The keys a lexicon delta may add (no `from`) or replace (`from` present): the version, the
 * per-entry scale fields of design 05 §1-§4 (carryExclude: lead decision 2026-10-04, round 2 R3a),
 * the top-level carryRefuse and normalize (lead decision D4), the top-level clauses and clarify
 * (release 0.4.7, tests/harness/lexicon-delta-033.js) and the gold-set reference.
 */
const DELTA_FIELDS = [
  [/^\/version$/, null],
  [new RegExp(`^/scale/${IDX}/(?:heard|carry|yieldTo|anchor|carryExclude)$`), "scale"],
  [/^\/carryRefuse$/, null],
  [/^\/normalize$/, null],
  [/^\/clauses$/, null],
  [/^\/clarify$/, null],
  [/^\/goldSet$/, null],
];

const deltaTokens = (path) => path.slice(1).split("/");

function deltaFamily(table, path, what) {
  const hit = typeof path === "string" ? table.find(([re]) => re.test(path)) : undefined;
  if (!hit) throw new Error(`lexicon delta: ${what} path ${JSON.stringify(path)} is not allowed`);
  return hit[1];
}

/** The value at `tokens` under `root` (own keys only; array steps need an index in range), or undefined. */
function valueAt(root, tokens) {
  let n = root;
  for (const t of tokens) {
    if (Array.isArray(n)) n = IDX_RE.test(t) && Number(t) < n.length ? n[Number(t)] : undefined;
    else n = isObj(n) && own(n, t) ? n[t] : undefined;
    if (n === undefined) return undefined;
  }
  return n;
}

/** Throw unless the row's entryId names the entry at its path (see DELTA_APPEND / DELTA_FIELDS). */
function assertEntry(lex, family, tokens, row) {
  const where = `lexicon delta: "${row.path}"`;
  if (family === null) {
    if (row.entryId !== undefined) throw new Error(`${where} belongs to no entry, so it takes no entryId`);
    return;
  }
  if (family === "redFlags") {
    if (row.entryId !== undefined && row.entryId !== tokens[1]) throw new Error(`${where}: entryId ${JSON.stringify(row.entryId)} is not the flag id "${tokens[1]}"`);
    return;
  }
  const e = valueAt(lex, tokens.slice(0, 2));
  if (!isObj(e)) throw new Error(`${where}: the lexicon has no ${family} entry at index ${tokens[1]}`);
  const ids = family === "multi" ? arr(e.ids).map((t) => (isObj(t) ? t.id : undefined)) : [e.id];
  if (typeof row.entryId !== "string" || !ids.includes(row.entryId)) {
    throw new Error(`${where}: entryId ${JSON.stringify(row.entryId)} does not match the entry at that position (${ids.join(", ")})`);
  }
}

/** Shape checks shared by apply and revert; throws on the first failure. */
function checkDelta(delta) {
  if (!isObj(delta)) throw new Error("lexicon delta: not an object");
  if (typeof delta.from !== "string" || typeof delta.to !== "string" || !delta.from || !delta.to || delta.from === delta.to) {
    throw new Error("lexicon delta: from and to must be two different version strings");
  }
  if (!Array.isArray(delta.appended) || !Array.isArray(delta.fields)) throw new Error("lexicon delta: appended and fields must be lists");
  for (const row of delta.appended) {
    if (!isObj(row)) throw new Error("lexicon delta: an appended row is not an object");
    deltaFamily(DELTA_APPEND, row.path, "appended");
    if (!Array.isArray(row.phrases) || !row.phrases.length) throw new Error(`lexicon delta: "${row.path}" appends no phrases`);
    for (const ph of row.phrases) {
      if (typeof ph !== "string" || !ph || ph !== ph.toLowerCase()) throw new Error(`lexicon delta: "${row.path}": ${JSON.stringify(ph)} is not a non-empty lowercase phrase`);
    }
  }
  const seen = new Set();
  for (const row of delta.fields) {
    if (!isObj(row)) throw new Error("lexicon delta: a field row is not an object");
    deltaFamily(DELTA_FIELDS, row.path, "field");
    if (seen.has(row.path)) throw new Error(`lexicon delta: field "${row.path}" is listed twice`);
    seen.add(row.path);
    if (row.to === undefined) throw new Error(`lexicon delta: field "${row.path}" has no "to" value`);
    if (/\/carryExclude$/.test(row.path) && (!Array.isArray(row.to) || !row.to.length || new Set(row.to).size !== row.to.length ||
      row.to.some((ph) => typeof ph !== "string" || !ph || ph !== ph.toLowerCase()))) {
      throw new Error(`lexicon delta: field "${row.path}" must be a list of distinct non-empty lowercase phrases`);
    }
    if (own(row, "from") && row.from === undefined) throw new Error(`lexicon delta: field "${row.path}" has an undefined "from"`);
    // Release 0.4.7: the chart-reading object and the clarification list (their full shape is the
    // validator's, V28/V29; here only what apply and revert rely on).
    if (row.path === "/clauses" && !isObj(row.to)) throw new Error(`lexicon delta: field "${row.path}" must be an object`);
    if (row.path === "/clarify" && (!Array.isArray(row.to) || !row.to.length || row.to.some((e) => !isObj(e) || typeof e.id !== "string" || !e.id)
      || new Set(row.to.map((e) => e.id)).size !== row.to.length)) {
      throw new Error(`lexicon delta: field "${row.path}" must be a non-empty list of entries with distinct ids`);
    }
  }
  const v = delta.fields.find((row) => row.path === "/version");
  if (!v || !own(v, "from") || v.from !== delta.from || v.to !== delta.to) {
    throw new Error(`lexicon delta: a "/version" field from "${delta.from}" to "${delta.to}" is required`);
  }
}

/**
 * lex031 + delta → lex032 (design 05 §6.2). Deep copy; never mutates either argument. Throws on
 * any precondition failure: a malformed delta, a disallowed path, version ≠ delta.from, an
 * entryId that does not match the entry at its position, a target list that is missing, a phrase
 * already in its list (or listed twice), an added key that already exists, a replaced key that is
 * missing or whose value does not deep-equal `from` (key order included), a carryExclude list
 * that is not distinct non-empty lowercase phrases or names a phrase that is not one of its entry's
 * band phrases (after the appended rows).
 * Appended phrases go at the END of their list, in delta order. Added entry keys go at the end of
 * the entry, in delta order; added top-level keys (carryRefuse, normalize) are inserted just
 * before `goldSet` (at the end when there is none), in delta order; replaced values keep their key
 * position.
 * @param {object} lex031
 * @param {{from: string, to: string, appended: object[], fields: object[]}} delta
 * @returns {object}
 */
export function applyLexiconDelta(lex031, delta) {
  checkDelta(delta);
  if (!isObj(lex031)) throw new Error("lexicon delta: the lexicon is not an object");
  if (lex031.version !== delta.from) throw new Error(`lexicon delta: lexicon version ${JSON.stringify(lex031.version)} is not "${delta.from}"`);
  const lex = clone(lex031);

  for (const row of delta.appended) {
    const family = deltaFamily(DELTA_APPEND, row.path, "appended");
    const tokens = deltaTokens(row.path);
    assertEntry(lex, family, tokens, row);
    const list = valueAt(lex, tokens);
    if (!Array.isArray(list)) throw new Error(`lexicon delta: "${row.path}" is not a phrase list in the lexicon`);
    for (const ph of row.phrases) {
      if (list.includes(ph)) throw new Error(`lexicon delta: "${row.path}" already has "${ph}"`);
      list.push(ph);
    }
  }

  const added = [];                       // top-level keys, inserted before goldSet
  for (const row of delta.fields) {
    const family = deltaFamily(DELTA_FIELDS, row.path, "field");
    const tokens = deltaTokens(row.path);
    assertEntry(lex, family, tokens, row);
    const key = tokens[tokens.length - 1];
    const parent = valueAt(lex, tokens.slice(0, -1));
    if (!isObj(parent)) throw new Error(`lexicon delta: "${row.path}" has no parent object in the lexicon`);
    if (key === "carryExclude") {
      // Appended phrases are already in place: every excluded phrase is one of the entry's band phrases.
      const stray = row.to.filter((ph) => !arr(parent.bands).some((b) => isObj(b) && arr(b.ph).includes(ph)));
      if (stray.length) throw new Error(`lexicon delta: "${row.path}" names ${JSON.stringify(stray)}, not band phrases of that entry`);
    }
    if (own(row, "from")) {
      if (!own(parent, key)) throw new Error(`lexicon delta: "${row.path}" replaces a key the lexicon does not have`);
      if (!same(parent[key], row.from)) throw new Error(`lexicon delta: "${row.path}" is ${JSON.stringify(parent[key])}, not the delta's "from" ${JSON.stringify(row.from)}`);
      parent[key] = clone(row.to);
    } else {
      if (own(parent, key) || added.some(([k]) => k === key)) throw new Error(`lexicon delta: "${row.path}" adds a key the lexicon already has`);
      if (tokens.length === 1) added.push([key, clone(row.to)]);
      else parent[key] = clone(row.to);
    }
  }
  if (!added.length) return lex;

  const out = {};
  for (const k of Object.keys(lex)) {
    if (k === "goldSet") for (const [ak, av] of added) out[ak] = av;
    out[k] = lex[k];
  }
  if (!own(lex, "goldSet")) for (const [ak, av] of added) out[ak] = av;
  return out;
}

/** The structural inverse of applyLexiconDelta (unverified; revertLexiconDelta proves it). Throws when it cannot undo. */
function unapplyLexiconDelta(lex, delta) {
  checkDelta(delta);
  const r = clone(lex);
  for (const row of [...delta.fields].reverse()) {
    const tokens = deltaTokens(row.path);
    const key = tokens[tokens.length - 1];
    const parent = valueAt(r, tokens.slice(0, -1));
    if (!isObj(parent) || !own(parent, key)) throw new Error(`lexicon delta: "${row.path}" is not in the lexicon`);
    if (own(row, "from")) parent[key] = clone(row.from);
    else delete parent[key];
  }
  for (const row of [...delta.appended].reverse()) {
    const list = valueAt(r, deltaTokens(row.path));
    const n = row.phrases.length;
    if (!Array.isArray(list) || list.length < n || !same(list.slice(list.length - n), row.phrases)) {
      throw new Error(`lexicon delta: "${row.path}" does not end with the appended phrases`);
    }
    list.length -= n;
  }
  return r;
}

/**
 * The `from`-equivalent (0.3.1-equivalent) lexicon, or null (design 05 §6.2). Never throws and
 * never mutates its arguments.
 *   lex.version === delta.to   → a reverted deep copy, only when `lex` shows EXACTLY the delta:
 *                                JSON.stringify(applyLexiconDelta(result, delta)) ===
 *                                JSON.stringify(lex) (key order included);
 *   lex.version === delta.from → `lex` itself (the same reference) when the delta could still be
 *                                applied to it, which means it carries no added delta key, every
 *                                replaced key still holds its `from` value, no appended phrase is
 *                                in its list, and every entryId matches (staged landing: the suites
 *                                are green before and after the module data lands);
 *   otherwise (or a malformed delta) → null.
 */
export function revertLexiconDelta(lex, delta) {
  if (!isObj(lex) || !isObj(delta)) return null;
  if (lex.version === delta.to) {
    try {
      const r = unapplyLexiconDelta(lex, delta);
      return JSON.stringify(applyLexiconDelta(r, delta)) === JSON.stringify(lex) ? r : null;
    } catch (e) {
      return null;
    }
  }
  if (lex.version === delta.from) {
    try {
      applyLexiconDelta(lex, delta);
      return lex;
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * The lexicon before the first delta of a chain (release 0.4.7): `deltas` in application order
 * (tests/harness/lexicon-delta.js, then tests/harness/lexicon-delta-033.js), reverted last first with
 * revertLexiconDelta, so each step proves its own delta exact and a lexicon still at a delta's
 * `from` passes that step unchanged (staged landing). null when any step gives null, or for an
 * empty or malformed chain. Never throws and never mutates its arguments.
 * @param {object} lex
 * @param {object[]} deltas
 * @returns {object|null}
 */
export function revertLexiconChain(lex, deltas) {
  if (!Array.isArray(deltas) || !deltas.length) return null;
  let r = lex;
  for (const d of [...deltas].reverse()) {
    r = revertLexiconDelta(r, d);
    if (r === null) return null;
  }
  return r;
}

// ---------------------------------------------------------------------------------------
// The locale delta (release 0.4.2, tests/harness/locale-delta.js): Spanish added to locales.es
// ---------------------------------------------------------------------------------------

/**
 * The paths a locale delta may add, relative to /locales/<locale>, with the key order the parent
 * keeps (the English locale's order): a new key goes after its `after` sibling and must leave
 * the listed keys in this order. `null`: the key goes after the parent's existing keys (an
 * item's `clin`).
 */
const LOCALE_DELTA_PATHS = [
  [/^\/contextItems$/, ["reviewed", "items", "redFlags", "contextItems", "steps", "ui"]],
  [/^\/steps\/[^/~]+\/(?:title|heading|lede|intro)$/, ["title", "heading", "lede", "intro"]],
  [/^\/ui\/(?:sub|forYouIf|clinicianLede)$/, ["sub", "forYouIf", "clinicianLede"]],
  [/^\/items\/[^/~]+\/clin$/, null],
];

function localeDeltaRel(delta, row) {
  const base = `/locales/${delta.locale}`;
  if (typeof row.path !== "string" || !row.path.startsWith(base + "/")) {
    throw new Error(`locale delta: path ${JSON.stringify(row.path)} is not under ${base}`);
  }
  const rel = row.path.slice(base.length);
  const hit = LOCALE_DELTA_PATHS.find(([re]) => re.test(rel));
  if (!hit) throw new Error(`locale delta: path ${JSON.stringify(row.path)} is not one a locale delta may add`);
  return { rel, tokens: rel.slice(1).split("/"), order: hit[1] };
}

/** Shape checks shared by apply and revert; throws on the first failure. */
function checkLocaleDelta(delta) {
  if (!isObj(delta)) throw new Error("locale delta: not an object");
  if (typeof delta.locale !== "string" || !/^[a-z]{2,3}$/.test(delta.locale) || delta.locale === "en") {
    throw new Error("locale delta: locale must name a translation (not en)");
  }
  if (!Array.isArray(delta.added) || !delta.added.length) throw new Error("locale delta: added must be a non-empty list");
  const seen = new Set();
  for (const row of delta.added) {
    if (!isObj(row)) throw new Error("locale delta: an added row is not an object");
    localeDeltaRel(delta, row);
    if (seen.has(row.path)) throw new Error(`locale delta: "${row.path}" is listed twice`);
    seen.add(row.path);
    if (typeof row.after !== "string" || !row.after) throw new Error(`locale delta: "${row.path}" names no "after" sibling`);
    if (row.value === undefined || row.en === undefined) throw new Error(`locale delta: "${row.path}" needs a value and its English source (en)`);
    if (row.basis === undefined || row.basis === null || row.basis === "") throw new Error(`locale delta: "${row.path}" records no basis`);
  }
  if (delta.chrome !== undefined) {
    if (!Array.isArray(delta.chrome)) throw new Error("locale delta: chrome must be a list");
    const keys = new Set();
    for (const row of delta.chrome) {
      if (!isObj(row) || typeof row.key !== "string" || !row.key || typeof row.en !== "string" || typeof row.basis !== "string" || !row.basis) {
        throw new Error("locale delta: a chrome row is {key, en, basis}");
      }
      if (keys.has(row.key)) throw new Error(`locale delta: chrome key "${row.key}" is listed twice`);
      keys.add(row.key);
    }
  }
}

/** Rebuild `obj` in place with `key` inserted right after `after` (insertion order is key order). */
function insertAfter(obj, after, key, value) {
  const entries = Object.keys(obj).map((k) => [k, obj[k]]);
  for (const [k] of entries) delete obj[k];
  for (const [k, v] of entries) {
    obj[k] = v;
    if (k === after) obj[key] = value;
  }
}

/**
 * locale + delta → the completed locale (release 0.4.2). Deep copy; never mutates either argument.
 * Each `added` row, in order, inserts `value` at `path` right after its `after` sibling. Throws on
 * any precondition failure: a malformed delta, a path outside /locales/<delta.locale> or not one
 * a locale delta may add (LOCALE_DELTA_PATHS), a key that already exists (existing wording is
 * never overwritten), a missing parent object or `after` sibling, a result whose keys leave the
 * English order, or (an item's `clin`) an `after` that is not the item's last key.
 * @param {object} loc0   the locale object (rubric.locales[delta.locale]) before the delta
 * @param {{locale: string, added: object[], chrome?: object[]}} delta
 * @returns {object}
 */
export function applyLocaleDelta(loc0, delta) {
  checkLocaleDelta(delta);
  if (!isObj(loc0)) throw new Error("locale delta: the locale is not an object");
  const loc = clone(loc0);
  for (const row of delta.added) {
    const { tokens, order } = localeDeltaRel(delta, row);
    const key = tokens[tokens.length - 1];
    const parent = valueAt(loc, tokens.slice(0, -1));
    if (!isObj(parent)) throw new Error(`locale delta: "${row.path}" has no parent object in the locale`);
    if (own(parent, key)) throw new Error(`locale delta: "${row.path}" already exists; a delta only adds`);
    if (!own(parent, row.after)) throw new Error(`locale delta: "${row.path}": the "after" sibling "${row.after}" is not there`);
    const keys = Object.keys(parent);
    if (order === null && keys[keys.length - 1] !== row.after) {
      throw new Error(`locale delta: "${row.path}" goes after the last key, "${keys[keys.length - 1]}", not "${row.after}"`);
    }
    insertAfter(parent, row.after, key, clone(row.value));
    if (order) {
      const idx = Object.keys(parent).filter((k) => order.includes(k)).map((k) => order.indexOf(k));
      if (idx.some((v, i) => i > 0 && v <= idx[i - 1])) {
        throw new Error(`locale delta: "${row.path}" leaves the keys out of the English order (${order.join(", ")})`);
      }
    }
  }
  return loc;
}

/** The structural inverse of applyLocaleDelta (unverified; revertLocaleDelta proves it). Throws when it cannot undo. */
function unapplyLocaleDelta(loc, delta) {
  checkLocaleDelta(delta);
  const r = clone(loc);
  for (const row of [...delta.added].reverse()) {
    const { tokens } = localeDeltaRel(delta, row);
    const key = tokens[tokens.length - 1];
    const parent = valueAt(r, tokens.slice(0, -1));
    if (!isObj(parent) || !own(parent, key)) throw new Error(`locale delta: "${row.path}" is not in the locale`);
    if (!same(parent[key], row.value)) throw new Error(`locale delta: "${row.path}" is not the delta's value`);
    delete parent[key];
  }
  return r;
}

/**
 * The locale without the delta, or null (release 0.4.2). Never throws and never mutates its arguments.
 *   every added path present → a reverted deep copy, only when the locale shows EXACTLY the
 *                              delta: each added value equal to the delta's, and
 *                              JSON.stringify(applyLocaleDelta(result, delta)) === JSON.stringify(loc)
 *                              (key order included);
 *   no added path present    → `loc` itself (the same reference) when the delta could still be
 *                              applied to it (staged landing);
 *   otherwise (some present, or a malformed delta) → null.
 * @returns {object|null}
 */
export function revertLocaleDelta(loc, delta) {
  if (!isObj(loc) || !isObj(delta)) return null;
  let present;
  try {
    checkLocaleDelta(delta);
    present = delta.added.map((row) => {
      const { tokens } = localeDeltaRel(delta, row);
      const parent = valueAt(loc, tokens.slice(0, -1));
      return isObj(parent) && own(parent, tokens[tokens.length - 1]);
    });
  } catch (e) {
    return null;
  }
  if (present.every(Boolean)) {
    try {
      const r = unapplyLocaleDelta(loc, delta);
      return JSON.stringify(applyLocaleDelta(r, delta)) === JSON.stringify(loc) ? r : null;
    } catch (e) {
      return null;
    }
  }
  if (!present.some(Boolean)) {
    try {
      applyLocaleDelta(loc, delta);
      return loc;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------
// The EMR template delta (release 0.4.3, tests/harness/emr-delta.js): one new top-level rubric key
// ---------------------------------------------------------------------------------------

/** Shape checks shared by apply and revert; throws on the first failure. Returns the key. */
function checkEmrDelta(delta) {
  if (!isObj(delta)) throw new Error("emr delta: not an object");
  if (typeof delta.path !== "string" || !/^\/[A-Za-z][A-Za-z0-9]*$/.test(delta.path)) {
    throw new Error("emr delta: path must name one top-level key (\"/<key>\")");
  }
  if (typeof delta.before !== "string" || !delta.before) throw new Error("emr delta: names no \"before\" key");
  if (!isObj(delta.value)) throw new Error("emr delta: value must be an object");
  if (!isObj(delta.basis) || !Object.keys(delta.basis).length) throw new Error("emr delta: records no basis");
  if (!isObj(delta.drafted) || typeof delta.drafted.reviewed !== "boolean") throw new Error("emr delta: drafted.reviewed must be true or false");
  if (delta.drafted.reviewed === false && delta.signOff !== undefined) {
    throw new Error("emr delta: a signOff record goes with drafted.reviewed true only");
  }
  if (delta.drafted.reviewed === true && !emrSignOffComplete(delta.signOff)) {
    throw new Error("emr delta: drafted.reviewed may be true only together with a complete clinical-lead signOff record (by, date YYYY-MM-DD as a real calendar date, scope, channel)");
  }
  return delta.path.slice(1);
}

/**
 * Whether `signOff` is a complete sign-off record (release 0.4.4): `by`, `scope` and `channel`
 * non-empty strings and `date` a real calendar date written YYYY-MM-DD (it must round-trip through
 * Date, so "2026-13-45" or "2026-02-30" is refused). The extractor uses this function too.
 * @param {*} signOff
 * @returns {boolean}
 */
export function emrSignOffComplete(signOff) {
  if (!isObj(signOff)) return false;
  for (const k of ["by", "scope", "channel"]) if (typeof signOff[k] !== "string" || !signOff[k].trim()) return false;
  const d = signOff.date;
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/**
 * The clinical lead's sign-off of the lexicon delta 0.3.2 → 0.3.3 (release 0.4.7; signOff of
 * tests/harness/lexicon-delta-033.js, decided 2026-10-12) against the lexicon the delta gives: [] when
 * it is complete and applied, else the problems found (strings). Complete and applied:
 *   - the record: by, scope, channel non-empty and date a real calendar date (emrSignOffComplete); rows
 *     (the sign-off list, ids unique, each decision "approve", "strike" or "lead's own words"), totals
 *     equal to those counts; partD the 19 questions D1-D19 in order, each answer one of its options;
 *     d8FollowUp part1 and part2, each answer (comma-joined) among the options shown;
 *   - no plain draft left: no clauses row (lists, sections, chart red-flag phrases), clarify entry or
 *     placeholderAsk with source "draft", and no appended row of the delta marked "draft";
 *   - every struck row absent from its clauses list, and `struck` naming exactly those rows;
 *   - every approved clauses row present with source "lead-approved" and every lead row with "lead";
 *     every approved appended negation cue in lexicon.negation.cues; every clarify entry of the list
 *     present, approved ones "lead-approved" and the lead's "lead";
 *   - every row `added` at the sign-off at its pointer with its phrase and source "lead-approved", and
 *     every qualifier in `removedQualifiers` gone from its entry's unless list.
 * Pure; never throws for object inputs.
 * @param {object} delta
 * @param {object} lexicon
 * @returns {string[]}
 */
export function lexicon033SignOffProblems(delta, lexicon) {
  const out = [];
  const so = isObj(delta) ? delta.signOff : null;
  if (!isObj(so)) return ["no signOff record"];
  if (!emrSignOffComplete(so)) out.push("signOff: by, scope, channel and a real calendar date are required");
  if (!isObj(lexicon)) return [...out, "no lexicon"];
  const cl = isObj(lexicon.clauses) ? lexicon.clauses : {};
  const rows = arr(so.rows).filter(isObj);
  const DECISIONS = ["approve", "strike", "lead's own words"];
  if (!rows.length || rows.length !== arr(so.rows).length) out.push("signOff.rows: a non-empty list of row records");
  const ids = rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length) out.push("signOff.rows: ids must be unique");
  const bad = rows.filter((r) => !DECISIONS.includes(r.decision) || typeof r.list !== "string");
  if (bad.length) out.push(`signOff.rows: unknown decision or list (${bad.map((r) => r.id).join(", ")})`);
  const count = (d) => rows.filter((r) => r.decision === d).length;
  const t = isObj(so.totals) ? so.totals : {};
  if (t.rows !== rows.length || t.approved !== count("approve") || t.struck !== count("strike") || t.leadOwnWords !== count("lead's own words")) {
    out.push("signOff.totals must equal the counts of signOff.rows");
  }
  const pd = arr(so.partD);
  if (pd.length !== 19 || pd.some((q, i) => !isObj(q) || q.id !== `D${i + 1}` || typeof q.question !== "string" || !arr(q.options).includes(q.answer))) {
    out.push("signOff.partD: the 19 questions D1-D19 in order, each answer one of its options");
  }
  const fu = isObj(so.d8FollowUp) ? so.d8FollowUp : {};
  for (const k of ["part1", "part2"]) {
    const p = fu[k];
    const ok = isObj(p) && isObj(p.options) && typeof p.answer === "string" && p.answer.split(",").every((a) => own(p.options, a));
    if (!ok) out.push(`signOff.d8FollowUp.${k}: the question, its options and an answer among them`);
  }
  // No plain draft left.
  const listOf = (name) => {
    const parts = String(name).split(".");
    if (parts[0] !== "clauses") return undefined;
    let x = cl;
    for (const p of parts.slice(1)) x = isObj(x) ? x[p] : undefined;
    return Array.isArray(x) ? x : undefined;
  };
  const allRows = [];
  for (const [k, v] of Object.entries(cl)) {
    if (Array.isArray(v)) v.forEach((r, i) => allRows.push([`/clauses/${k}/${i}`, r]));
    else if ((k === "sections" || k === "redFlags") && isObj(v)) for (const [kk, vv] of Object.entries(v)) arr(vv).forEach((r, i) => allRows.push([`/clauses/${k}/${kk}/${i}`, r]));
  }
  const drafts = allRows.filter(([, r]) => isObj(r) && r.source === "draft").map(([p]) => p);
  arr(lexicon.clarify).forEach((e, i) => { if (isObj(e) && (e.source === "draft" || (isObj(e.ask) && e.ask.source === "draft"))) drafts.push(`/clarify/${i}`); });
  if (isObj(cl.placeholderAsk) && cl.placeholderAsk.source === "draft") drafts.push("/clauses/placeholderAsk");
  arr(delta.appended).forEach((r, i) => { if (!isObj(r) || r.source === "draft") drafts.push(`appended/${i}`); });
  if (drafts.length) out.push(`plain drafts left: ${drafts.join(", ")}`);
  // Struck rows absent; approved and lead rows present with their source.
  const struck = rows.filter((r) => r.decision === "strike");
  for (const r of struck) {
    const l = listOf(r.list);
    if (!l) out.push(`struck row ${r.id}: no clauses list ${r.list}`);
    else if (l.some((x) => isObj(x) && x.ph === r.text)) out.push(`struck row ${r.id} (${r.list} "${r.text}") is still in the lexicon`);
  }
  const named = arr(so.struck).filter(isObj).map((x) => `${x.id}:${x.ph}`).sort();
  if (JSON.stringify(named) !== JSON.stringify(struck.map((r) => `${r.id}:${r.text}`).sort())) out.push("signOff.struck must name exactly the struck rows");
  const clar = arr(lexicon.clarify).filter(isObj);
  for (const r of rows.filter((x) => x.decision !== "strike")) {
    const want = r.decision === "approve" ? "lead-approved" : "lead";
    if (r.list.startsWith("clauses.")) {
      const l = listOf(r.list);
      const hit = l ? l.find((x) => isObj(x) && x.ph === r.text) : undefined;
      if (!hit || hit.source !== want) out.push(`row ${r.id} (${r.list} "${r.text}"): not in the lexicon with source "${want}"`);
    } else if (r.list === "negation.cues (appended)") {
      if (!arr(lexicon.negation && lexicon.negation.cues).includes(r.text)) out.push(`row ${r.id}: the negation cue "${r.text}" is not in the lexicon`);
    } else if (r.list === "clarify") {
      const id = isObj(r.text) ? r.text.id : undefined;
      const e = clar.find((x) => x.id === id);
      if (!e || e.source !== want) out.push(`row ${r.id}: clarify entry ${id} not in the lexicon with source "${want}"`);
    }
  }
  // Rows added at the sign-off, and qualifiers removed.
  for (const a of arr(so.added)) {
    const segs = isObj(a) && typeof a.path === "string" ? a.path.split("/").slice(1) : [];
    let x = lexicon;
    for (const sg of segs) x = x === null || typeof x !== "object" ? undefined : x[sg];
    if (!segs.length || !isObj(x) || x.ph !== a.ph || x.source !== "lead-approved") out.push(`added row ${isObj(a) ? a.path : "?"} ("${isObj(a) ? a.ph : "?"}") is not at its pointer as a lead-approved row`);
  }
  for (const q of arr(so.removedQualifiers)) {
    const e = isObj(q) ? clar.find((x) => x.id === q.entry) : undefined;
    if (!e) { out.push(`removedQualifiers: no clarify entry ${isObj(q) ? q.entry : "?"}`); continue; }
    const left = arr(q.removed).filter((w) => arr(e.unless).includes(w));
    if (left.length || !arr(q.removed).length) out.push(`removedQualifiers ${q.entry}: still holds ${left.join(", ") || "(nothing listed)"}`);
  }
  return out;
}

/**
 * rubric + delta → the rubric with `delta.value` at the top-level key `delta.path`, inserted right
 * before the key `delta.before` (release 0.4.3). Deep copy; never mutates either argument. Throws
 * on a malformed delta, a rubric that already has the key (a delta only adds: existing content is
 * never overwritten), or a rubric without the `before` key.
 * @param {object} rubric0
 * @param {{path: string, before: string, value: object, basis: object, drafted: object, signOff?: object}} delta
 * @returns {object}
 */
export function applyEmrDelta(rubric0, delta) {
  const key = checkEmrDelta(delta);
  if (!isObj(rubric0)) throw new Error("emr delta: the rubric is not an object");
  if (own(rubric0, key)) throw new Error(`emr delta: the rubric already has "${key}"; a delta only adds`);
  if (!own(rubric0, delta.before)) throw new Error(`emr delta: the rubric has no "${delta.before}" to insert before`);
  const r = clone(rubric0);
  const out = {};
  for (const k of Object.keys(r)) {
    if (k === delta.before) out[key] = clone(delta.value);
    out[k] = r[k];
  }
  return out;
}

/**
 * The rubric without the delta, or null (release 0.4.3). Never throws and never mutates its arguments.
 *   key present → a reverted deep copy, only when the rubric shows EXACTLY the delta: the value
 *                 deep-equal to the delta's (key order included) and
 *                 JSON.stringify(applyEmrDelta(result, delta)) === JSON.stringify(rubric);
 *   key absent  → `rubric` itself (the same reference) when the delta could still be applied to it
 *                 (staged landing);
 *   otherwise (or a malformed delta) → null.
 * @returns {object|null}
 */
export function revertEmrDelta(rubric, delta) {
  if (!isObj(rubric) || !isObj(delta)) return null;
  let key;
  try { key = checkEmrDelta(delta); } catch (e) { return null; }
  if (own(rubric, key)) {
    try {
      if (!same(rubric[key], delta.value)) return null;
      const r = clone(rubric);
      delete r[key];
      return JSON.stringify(applyEmrDelta(r, delta)) === JSON.stringify(rubric) ? r : null;
    } catch (e) {
      return null;
    }
  }
  try {
    applyEmrDelta(rubric, delta);
    return rubric;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------------------
// The referral delta (release 0.4.5, tests/harness/referral-delta.js): the clinical-lead referral
// rule for dizziness cases, under /phenotypes/referral only
// ---------------------------------------------------------------------------------------

const REFERRAL_DELTA_ROOT = "/phenotypes/referral/";
const unescapeToken = (t) => t.replace(/~1/g, "/").replace(/~0/g, "~");
const pointerTokens = (path) => path.slice(1).split("/").map(unescapeToken);

/** Shape checks shared by apply and revert; throws on the first failure. */
function checkReferralDelta(delta) {
  if (!isObj(delta)) throw new Error("referral delta: not an object");
  if (!Array.isArray(delta.changed) || !Array.isArray(delta.added) || !(delta.changed.length + delta.added.length)) {
    throw new Error("referral delta: changed and added must be lists, not both empty");
  }
  const paths = [];
  for (const row of [...delta.changed, ...delta.added]) {
    if (!isObj(row) || typeof row.path !== "string" || !row.path.startsWith(REFERRAL_DELTA_ROOT) || row.path.length <= REFERRAL_DELTA_ROOT.length
      || pointerTokens(row.path).some((t) => !t)) {
      throw new Error(`referral delta: every path is a JSON pointer under ${REFERRAL_DELTA_ROOT} (${JSON.stringify(isObj(row) ? row.path : row)})`);
    }
    if (paths.some((p) => p === row.path || p.startsWith(`${row.path}/`) || row.path.startsWith(`${p}/`))) throw new Error(`referral delta: ${row.path} overlaps another row`);
    paths.push(row.path);
  }
  for (const row of delta.changed) {
    if (typeof row.from !== "string" || typeof row.to !== "string" || row.from === row.to) throw new Error(`referral delta: ${row.path}: from and to must be two different strings`);
  }
  for (const row of delta.added) if (row.value === undefined) throw new Error(`referral delta: ${row.path}: no value`);
  if (!isObj(delta.basis) || !Object.keys(delta.basis).length) throw new Error("referral delta: records no basis");
}

/** The parent object of a pointer and its last token, or null when the parent is not an object. */
function parentOf(root, path) {
  const toks = pointerTokens(path);
  let n = root;
  for (const t of toks.slice(0, -1)) {
    if (!isObj(n) || !own(n, t)) return null;
    n = n[t];
  }
  return isObj(n) ? { parent: n, key: toks[toks.length - 1] } : null;
}

/**
 * rubric + delta → the rubric with the referral delta applied (release 0.4.5). Deep copy; never
 * mutates either argument. Each `changed` row replaces a string that must equal its `from`; each
 * `added` row adds a key that must not exist yet, at the end of its parent object (an existing
 * key is never overwritten). Throws on a malformed delta or a rubric that does not show the
 * delta's preconditions.
 * @param {object} rubric0
 * @param {{changed: Array<{path, from, to}>, added: Array<{path, value}>, basis: object}} delta
 * @returns {object}
 */
export function applyReferralDelta(rubric0, delta) {
  checkReferralDelta(delta);
  if (!isObj(rubric0)) throw new Error("referral delta: the rubric is not an object");
  const r = clone(rubric0);
  for (const row of delta.changed) {
    const at = parentOf(r, row.path);
    if (!at || !own(at.parent, at.key)) throw new Error(`referral delta: ${row.path} is not in the rubric`);
    if (at.parent[at.key] !== row.from) throw new Error(`referral delta: ${row.path} is ${JSON.stringify(at.parent[at.key])}, not ${JSON.stringify(row.from)}`);
    at.parent[at.key] = row.to;
  }
  for (const row of delta.added) {
    const at = parentOf(r, row.path);
    if (!at) throw new Error(`referral delta: the parent of ${row.path} is not an object of the rubric`);
    if (own(at.parent, at.key)) throw new Error(`referral delta: the rubric already has ${row.path}; a delta only adds`);
    at.parent[at.key] = clone(row.value);
  }
  return r;
}

/**
 * The rubric without the referral delta, or null (release 0.4.5). Never throws and never mutates
 * its arguments.
 *   applied   → a reverted deep copy, only when the rubric shows EXACTLY the delta (every changed
 *               value equal to its `to`, every added value deep-equal to the delta's, key order
 *               included) and JSON.stringify(applyReferralDelta(result, delta)) === JSON.stringify(rubric);
 *   not applied (every changed value equal to its `from`, no added key present, and the delta
 *               applies) → `rubric` itself (the same reference: staged landing);
 *   otherwise (or a malformed delta) → null.
 * @returns {object|null}
 */
export function revertReferralDelta(rubric, delta) {
  if (!isObj(rubric) || !isObj(delta)) return null;
  try { checkReferralDelta(delta); } catch (e) { return null; }
  const valueAt = (root, path) => { const at = parentOf(root, path); return at && own(at.parent, at.key) ? at.parent[at.key] : undefined; };
  const applied = delta.changed.every((row) => valueAt(rubric, row.path) === row.to) && delta.added.every((row) => valueAt(rubric, row.path) !== undefined && same(valueAt(rubric, row.path), row.value));
  if (applied) {
    try {
      const r = clone(rubric);
      for (const row of delta.added) { const at = parentOf(r, row.path); delete at.parent[at.key]; }
      for (const row of delta.changed) { const at = parentOf(r, row.path); at.parent[at.key] = row.from; }
      return JSON.stringify(applyReferralDelta(r, delta)) === JSON.stringify(rubric) ? r : null;
    } catch (e) {
      return null;
    }
  }
  const pristine = delta.changed.every((row) => valueAt(rubric, row.path) === row.from) && delta.added.every((row) => valueAt(rubric, row.path) === undefined);
  if (!pristine) return null;
  try {
    applyReferralDelta(rubric, delta);
    return rubric;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------------------
// The EMR decisions delta (release 0.4.6, tests/harness/emr-decisions-delta.js): the clinical
// lead's answers of 2026-10-10 that add data, as new keys under /emrTemplate only
// ---------------------------------------------------------------------------------------

const EMR_DECISIONS_ROOT = "/emrTemplate/";

/** Shape checks shared by apply and revert; throws on the first failure. */
function checkEmrDecisionsDelta(delta) {
  if (!isObj(delta)) throw new Error("emr decisions delta: not an object");
  if (!Array.isArray(delta.added) || !delta.added.length) throw new Error("emr decisions delta: added must be a non-empty list");
  const paths = [];
  for (const row of delta.added) {
    if (!isObj(row) || typeof row.path !== "string" || !row.path.startsWith(EMR_DECISIONS_ROOT) || row.path.length <= EMR_DECISIONS_ROOT.length
      || pointerTokens(row.path).some((t) => !t)) {
      throw new Error(`emr decisions delta: every path is a JSON pointer under ${EMR_DECISIONS_ROOT} (${JSON.stringify(isObj(row) ? row.path : row)})`);
    }
    if (paths.some((p) => p === row.path || p.startsWith(`${row.path}/`) || row.path.startsWith(`${p}/`))) throw new Error(`emr decisions delta: ${row.path} overlaps another row`);
    paths.push(row.path);
    if (row.value === undefined) throw new Error(`emr decisions delta: ${row.path}: no value`);
  }
  if (!isObj(delta.basis) || !Object.keys(delta.basis).length) throw new Error("emr decisions delta: records no basis");
}

/**
 * The parent object of a pointer and its last token, or null when the parent is not an object.
 * Unlike parentOf, a list on the way is entered by a decimal index token ("examRows/14").
 */
function parentThrough(root, path) {
  const toks = pointerTokens(path);
  let n = root;
  for (const t of toks.slice(0, -1)) {
    if (Array.isArray(n)) {
      if (!/^(?:0|[1-9]\d*)$/.test(t) || Number(t) >= n.length) return null;
      n = n[Number(t)];
    } else if (isObj(n) && own(n, t)) n = n[t];
    else return null;
  }
  return isObj(n) ? { parent: n, key: toks[toks.length - 1] } : null;
}

/**
 * rubric + delta → the rubric with the EMR decisions delta applied (release 0.4.6). Deep copy;
 * never mutates either argument. Each `added` row adds a key that must not exist yet, at the end
 * of its parent object (an object under /emrTemplate, reached through lists by index); nothing
 * existing is changed or overwritten. Throws on a malformed delta or a rubric without the parent.
 * @param {object} rubric0
 * @param {{added: Array<{path, value}>, basis: object}} delta
 * @returns {object}
 */
export function applyEmrDecisionsDelta(rubric0, delta) {
  checkEmrDecisionsDelta(delta);
  if (!isObj(rubric0)) throw new Error("emr decisions delta: the rubric is not an object");
  const r = clone(rubric0);
  for (const row of delta.added) {
    const at = parentThrough(r, row.path);
    if (!at) throw new Error(`emr decisions delta: the parent of ${row.path} is not an object of the rubric`);
    if (own(at.parent, at.key)) throw new Error(`emr decisions delta: the rubric already has ${row.path}; a delta only adds`);
    at.parent[at.key] = clone(row.value);
  }
  return r;
}

/**
 * The rubric without the EMR decisions delta, or null (release 0.4.6). Never throws and never
 * mutates its arguments.
 *   applied     → a reverted deep copy, only when every added value is deep-equal to the delta's
 *                 (key order included) and JSON.stringify(applyEmrDecisionsDelta(result, delta))
 *                 === JSON.stringify(rubric);
 *   not applied (no added key present, and the delta applies) → `rubric` itself (staged landing);
 *   otherwise (or a malformed delta) → null.
 * @returns {object|null}
 */
export function revertEmrDecisionsDelta(rubric, delta) {
  if (!isObj(rubric) || !isObj(delta)) return null;
  try { checkEmrDecisionsDelta(delta); } catch (e) { return null; }
  const valueAt = (root, path) => { const at = parentThrough(root, path); return at && own(at.parent, at.key) ? at.parent[at.key] : undefined; };
  if (delta.added.every((row) => valueAt(rubric, row.path) !== undefined && same(valueAt(rubric, row.path), row.value))) {
    try {
      const r = clone(rubric);
      for (const row of [...delta.added].reverse()) { const at = parentThrough(r, row.path); delete at.parent[at.key]; }
      return JSON.stringify(applyEmrDecisionsDelta(r, delta)) === JSON.stringify(rubric) ? r : null;
    } catch (e) {
      return null;
    }
  }
  if (!delta.added.every((row) => valueAt(rubric, row.path) === undefined)) return null;
  try {
    applyEmrDecisionsDelta(rubric, delta);
    return rubric;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------------------
// The question delta (release 0.4.8, tests/harness/question-delta-048.js): the clinical lead's
// clinician question for an item, as a changed `ask` under /domains/<i>/items/<j> only
// ---------------------------------------------------------------------------------------

const QUESTION_PATH_RE = /^\/domains\/(0|[1-9]\d*)\/items\/(0|[1-9]\d*)\/ask$/;

/** Shape checks shared by apply and revert; throws on the first failure. */
function checkQuestionDelta(delta) {
  if (!isObj(delta)) throw new Error("question delta: not an object");
  if (!Array.isArray(delta.changed) || !delta.changed.length) throw new Error("question delta: changed must be a non-empty list");
  const paths = [];
  for (const row of delta.changed) {
    if (!isObj(row) || typeof row.path !== "string" || !QUESTION_PATH_RE.test(row.path)) {
      throw new Error(`question delta: every path is /domains/<i>/items/<j>/ask (${JSON.stringify(isObj(row) ? row.path : row)})`);
    }
    if (paths.includes(row.path)) throw new Error(`question delta: ${row.path} is changed twice`);
    paths.push(row.path);
    if (typeof row.item !== "string" || !row.item) throw new Error(`question delta: ${row.path}: no item id`);
    if (typeof row.from !== "string" || typeof row.to !== "string" || !row.from.trim() || !row.to.trim() || row.from === row.to) {
      throw new Error(`question delta: ${row.path}: from and to must be two different non-empty strings`);
    }
  }
  if (!isObj(delta.basis) || !Object.keys(delta.basis).length) throw new Error("question delta: records no basis");
}

/** The item a question row addresses ({item, key: "ask"}), or null when the path does not reach an item. */
function questionItem(root, path) {
  const m = QUESTION_PATH_RE.exec(path);
  if (!m || !isObj(root) || !Array.isArray(root.domains)) return null;
  const d = root.domains[Number(m[1])];
  const items = isObj(d) && Array.isArray(d.items) ? d.items : null;
  const it = items ? items[Number(m[2])] : undefined;
  return isObj(it) ? it : null;
}

/**
 * rubric + delta → the rubric with the question delta applied (release 0.4.8). Deep copy; never
 * mutates either argument. Each `changed` row replaces the `ask` of the item at its path, which
 * must be the item its `item` names and must still read its `from`; nothing else changes (no key
 * is added or removed, so key order is kept). Throws on a malformed delta or a rubric that does
 * not show the delta's preconditions.
 * @param {object} rubric0
 * @param {{changed: Array<{path, item, from, to}>, basis: object}} delta
 * @returns {object}
 */
export function applyQuestionDelta(rubric0, delta) {
  checkQuestionDelta(delta);
  if (!isObj(rubric0)) throw new Error("question delta: the rubric is not an object");
  const r = clone(rubric0);
  for (const row of delta.changed) {
    const it = questionItem(r, row.path);
    if (!it) throw new Error(`question delta: ${row.path} does not reach an item of the rubric`);
    if (it.id !== row.item) throw new Error(`question delta: ${row.path} is the item ${JSON.stringify(it.id)}, not ${JSON.stringify(row.item)}`);
    if (!own(it, "ask") || it.ask !== row.from) throw new Error(`question delta: ${row.path} is ${JSON.stringify(it.ask)}, not ${JSON.stringify(row.from)}`);
    it.ask = row.to;
  }
  return r;
}

/**
 * The rubric without the question delta, or null (release 0.4.8). Never throws and never mutates
 * its arguments.
 *   applied   → a reverted deep copy, only when every changed item is the row's item and reads its
 *               `to`, and JSON.stringify(applyQuestionDelta(result, delta)) === JSON.stringify(rubric);
 *   not applied (every changed item reads its `from`, and the delta applies) → `rubric` itself
 *               (the same reference: staged landing);
 *   otherwise (or a malformed delta) → null.
 * @returns {object|null}
 */
export function revertQuestionDelta(rubric, delta) {
  if (!isObj(rubric) || !isObj(delta)) return null;
  try { checkQuestionDelta(delta); } catch (e) { return null; }
  const askAt = (root, row) => { const it = questionItem(root, row.path); return it && it.id === row.item && own(it, "ask") ? it.ask : undefined; };
  if (delta.changed.every((row) => askAt(rubric, row) === row.to)) {
    try {
      const r = clone(rubric);
      for (const row of delta.changed) questionItem(r, row.path).ask = row.from;
      return JSON.stringify(applyQuestionDelta(r, delta)) === JSON.stringify(rubric) ? r : null;
    } catch (e) {
      return null;
    }
  }
  if (!delta.changed.every((row) => askAt(rubric, row) === row.from)) return null;
  try {
    applyQuestionDelta(rubric, delta);
    return rubric;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------------------
// AD14 (release 0.4.2): the Spanish completion as rendered, against the frozen baseline
// ---------------------------------------------------------------------------------------

/** The separator the engine puts between the English prototype marker and a locale's companion line (D9). */
export const AD14_MARKER_JOIN = " — ";
const AD14_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a list element starts with an /i/ sound, so that Spanish "y" becomes "e" before it
 * (release 0.4.2, decision D5; AD14 rule J). The test's own statement of the rule, written apart
 * from the engine's: after leading spaces, quotes and opening marks, with accents removed and
 * lowercased, the element starts with "i", or with "hi" and a consonant ("hiperacusia"); "hie",
 * "hia", "hio" and "hiu" open with a glide and keep "y" ("y hielo"). Pure.
 * @param {string} word
 * @returns {boolean}
 */
export function ad14ISound(word) {
  if (typeof word !== "string") return false;
  const w = word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^[\s"'“”‘’«»¿¡([]+/, "");
  return w.startsWith("i") || /^hi[bcdfghjklmnpqrstvwxyz]/.test(w);
}

/**
 * The parameter object of AD14 for one translated locale (release 0.4.2): what the Spanish
 * completion may change in a rendered or exported baseline text, and nothing else. Pure; built
 * by the suites from tests/harness/locale-delta.js and the engine's chrome, passed as ctx.AD14.
 *   pairs      [english, spanish] as the patient sees them, longest English first: every `added`
 *              row except the items' clin (a string row as is; a list row line by line; the
 *              context items' q and each option label, option by option), and each `chrome` row as
 *              chromeEn[key] → chromeLoc[key]; {name}, {id}, {instrument} and {appVersion} filled
 *              from `vars` and `**` markup removed on both sides (the rendered text);
 *   clin       [patientClin, the locale's clin] of the items/<id>/clin rows, longest first;
 *   questions  the baseline question forms the "¿" fix opens: each ends with "?" and holds no "¿";
 *   iWords     the list elements (`listElements`, the logic's word maps) that start with an /i/
 *              sound (ad14ISound): only " y " right before one of them may become " e ";
 *   marker     {en, companion}: the English prototype marker and the locale's companion line.
 * Throws instead of widening AD14: a delta that is malformed or names English, a context item or
 * option list that differs from the English one in ids, length or value codes (a changed value
 * code is never a translation), a list row whose lengths differ, a chrome row whose `en` is not
 * chromeEn[key] or whose key chromeLoc lacks, a question that is not an unopened "…?", or a
 * marker that is not two non-empty strings.
 * @param {{delta: object, chromeEn: object, chromeLoc: object, vars?: object, questions?: string[],
 *          listElements?: string[], marker?: {en: string, companion: string}}} input
 * @returns {{locale: string, pairs: Array<[string, string]>, clin: Array<[string, string]>,
 *            questions: string[], iWords: string[], marker: ({en: string, companion: string}|null)}}
 */
export function ad14Params({ delta, chromeEn = {}, chromeLoc = {}, vars = {}, questions = [], listElements = [], marker = null } = {}) {
  checkLocaleDelta(delta);
  const render = (s) => s.replace(/\{(name|id|instrument|appVersion)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k]))).replace(/\*\*/g, "");
  const pairs = [], clin = [];
  const add = (list, en, es, where) => {
    if (typeof en !== "string" || typeof es !== "string" || !en || !es) throw new Error(`AD14: ${where} is not a pair of non-empty strings`);
    const e = render(en), s = render(es);
    if (e !== s) list.push([e, s]);
  };
  const base = `/locales/${delta.locale}`;
  for (const row of delta.added) {
    const rel = row.path.slice(base.length);
    if (/^\/items\/[^/~]+\/clin$/.test(rel)) { add(clin, row.en, row.value, row.path); continue; }
    if (rel === "/contextItems") {
      if (!isObj(row.en) || !isObj(row.value)) throw new Error(`AD14: ${row.path} is not an object of context items`);
      const ids = Object.keys(row.en);
      if (!same(ids, Object.keys(row.value))) throw new Error(`AD14: ${row.path} names other context items than the English (${ids.join(", ")})`);
      for (const id of ids) {
        const e = row.en[id], s = row.value[id];
        if (!isObj(e) || !isObj(s) || !Array.isArray(e.opts) || !Array.isArray(s.opts)) throw new Error(`AD14: ${row.path}/${id} has no q and opts`);
        add(pairs, e.q, s.q, `${row.path}/${id}/q`);
        if (e.opts.length !== s.opts.length) throw new Error(`AD14: ${row.path}/${id}/opts has ${s.opts.length} options, the English ${e.opts.length}`);
        e.opts.forEach((o, i) => {
          const t = s.opts[i];
          if (!Array.isArray(o) || !Array.isArray(t) || o.length !== 2 || t.length !== 2) throw new Error(`AD14: ${row.path}/${id}/opts/${i} is not [value, label]`);
          if (o[0] !== t[0]) throw new Error(`AD14: ${row.path}/${id}/opts/${i}: value code ${JSON.stringify(t[0])} is not the English ${JSON.stringify(o[0])}`);
          add(pairs, o[1], t[1], `${row.path}/${id}/opts/${i}`);
        });
      }
      continue;
    }
    if (Array.isArray(row.en) || Array.isArray(row.value)) {
      if (!Array.isArray(row.en) || !Array.isArray(row.value) || row.en.length !== row.value.length) throw new Error(`AD14: ${row.path} is not two lists of one length`);
      row.en.forEach((e, i) => add(pairs, e, row.value[i], `${row.path}/${i}`));
      continue;
    }
    add(pairs, row.en, row.value, row.path);
  }
  for (const row of arr(delta.chrome)) {
    if (chromeEn[row.key] !== row.en) throw new Error(`AD14: chrome ${row.key}: the row's English is not PATIENT_CHROME.en.${row.key}`);
    if (typeof chromeLoc[row.key] !== "string" || !chromeLoc[row.key]) throw new Error(`AD14: chrome ${row.key}: the ${delta.locale} chrome has no value`);
    add(pairs, row.en, chromeLoc[row.key], `chrome ${row.key}`);
  }
  const byLength = (x, y) => y[0].length - x[0].length;
  pairs.sort(byLength);
  clin.sort(byLength);
  for (const q of questions) {
    if (typeof q !== "string" || !q.endsWith("?") || q.includes("¿")) throw new Error(`AD14: ${JSON.stringify(q)} is not an unopened question`);
  }
  if (marker !== null && (!isObj(marker) || typeof marker.en !== "string" || !marker.en || typeof marker.companion !== "string" || !marker.companion)) {
    throw new Error("AD14: marker must be {en, companion}, two non-empty strings");
  }
  const iWords = [...new Set(arr(listElements).filter((w) => typeof w === "string" && w && ad14ISound(w)))];
  return Object.freeze({
    locale: delta.locale,
    pairs: Object.freeze(pairs.map((p) => Object.freeze(p))),
    clin: Object.freeze(clin.map((p) => Object.freeze(p))),
    questions: Object.freeze([...new Set(questions)].sort((x, y) => y.length - x.length)),
    iWords: Object.freeze(iWords.sort((x, y) => y.length - x.length)),
    marker: marker === null ? null : Object.freeze({ en: marker.en, companion: marker.companion }),
  });
}

const ad14Usable = (p) => isObj(p) && typeof p.locale === "string" && p.locale !== "en" &&
  Array.isArray(p.pairs) && Array.isArray(p.clin) && Array.isArray(p.questions) && Array.isArray(p.iWords);

/**
 * AD14 on one pair of strings, rule by rule (each acts only where the new side shows its new form):
 *   P  a pair's English in the baseline → its Spanish, when the new side holds that Spanish;
 *   C  a clin pair, the same way (the "Para mi médico" lines);
 *   Q  a baseline question q → "¿" + q, when the new side holds "¿" + q;
 *   J  " y " + an iWord → " e " + that iWord, when the new side holds the latter;
 *   M  on the NEW side: a last line `${marker.en} — ${marker.companion} · YYYY-MM-DD` (the dated
 *      caveat line with its companion, D9) → `${marker.en} · YYYY-MM-DD`, so AD10 then owns it.
 * Returns {a2, b2, fired: {P, C, Q, J: [sources], M: boolean}, present: {P, C, Q, J: [sources in a]}}.
 */
function ad14Strings(p, a, b) {
  let a2 = a, b2 = b;
  const fired = { P: [], C: [], Q: [], J: [], M: false };
  const present = { P: [], C: [], Q: [], J: [] };
  const swap = (key, from, to) => {
    if (!a2.includes(from)) return;
    present[key].push(from);
    if (!b2.includes(to)) return;
    a2 = a2.split(from).join(to);
    fired[key].push(from);
  };
  for (const [en, es] of p.pairs) swap("P", en, es);
  for (const [en, es] of p.clin) swap("C", en, es);
  for (const q of p.questions) {
    if (!a2.includes(q)) continue;
    present.Q.push(q);
    if (!b2.includes(`¿${q}`)) continue;
    // Only an occurrence that is not already opened.
    a2 = a2.split(q).map((part, i, all) => (i < all.length - 1 && !part.endsWith("¿") ? `${part}¿` : part)).join(q);
    fired.Q.push(q);
  }
  for (const w of p.iWords) {
    if (!a2.includes(` y ${w}`)) continue;
    present.J.push(w);
    if (!b2.includes(` e ${w}`)) continue;
    a2 = a2.split(` y ${w}`).join(` e ${w}`);
    fired.J.push(w);
  }
  if (isObj(p.marker)) {
    const lines = b2.split("\n");
    const last = lines[lines.length - 1];
    const head = `${p.marker.en}${AD14_MARKER_JOIN}${p.marker.companion} · `;
    if (last.startsWith(head) && AD14_DATE_RE.test(last.slice(head.length))) {
      lines[lines.length - 1] = `${p.marker.en} · ${last.slice(head.length)}`;
      b2 = lines.join("\n");
      fired.M = true;
    }
  }
  return { a2, b2, fired, present };
}

/**
 * AD14 on one summary clinician entry (a path ending in /clin/<n>): the baseline {w, neg, t}
 * against the new {w, neg, t, lang}. Excused (→ [b, b]) only when w and neg are equal and either
 * lang is the locale and t is a clin pair's Spanish where the baseline had its English, followed by
 * the same option in brackets (or nothing), or lang is "en" and t is unchanged (a locale without
 * its own clin line). Anything else, including an English-mode entry, stays a difference.
 */
function ad14ClinEntry(p, a, b) {
  if (!same(Object.keys(a), ["w", "neg", "t"]) || !same(Object.keys(b), ["w", "neg", "t", "lang"])) return null;
  if (a.w !== b.w || a.neg !== b.neg || typeof a.t !== "string" || typeof b.t !== "string") return null;
  if (b.lang === "en") return a.t === b.t ? "en" : null;
  if (b.lang !== p.locale) return null;
  for (const [en, es] of p.clin) {
    if (!a.t.startsWith(en)) continue;
    const rest = a.t.slice(en.length);
    if (/^(?: \[[^\]]*\])?$/.test(rest) && b.t === es + rest) return en;
  }
  return null;
}

/**
 * Which AD14 rules act on one comparison, for the suites' per-rule expectations and the AD14
 * self-checks. `a` is the baseline value as AD14 receives it (after AD4, which precedes it), `b`
 * the new one. Strings: {fired, present} of ad14Strings (P, C, Q, J lists; M boolean). A clin
 * entry object: {fired: {C: [english]}, present: {C: [english]}} when the entry is excused, else
 * with an empty fired list. Returns null when `p` is not a usable AD14 parameter object (an
 * English locale included). Pure.
 */
export function ad14Explain(p, a, b) {
  if (!ad14Usable(p)) return null;
  if (typeof a === "string" && typeof b === "string") {
    const r = ad14Strings(p, a, b);
    return { fired: r.fired, present: r.present };
  }
  if (isObj(a) && isObj(b)) {
    const hit = ad14ClinEntry(p, a, b);
    const src = typeof a.t === "string" ? p.clin.filter(([en]) => a.t.startsWith(en)).map(([en]) => en) : [];
    return { fired: { P: [], C: hit && hit !== "en" ? [hit] : [], Q: [], J: [], M: false }, present: { P: [], C: src, Q: [], J: [] } };
  }
  return null;
}

/**
 * AD13 for one utterance's capture arrays: the ids whose captures the delta may change in `text`
 * (design 05 §7.1, extended for lead decisions D3 / D4).
 *   P  an appended item phrase occurs in the lowercased text: that entry's id (multi: every id of
 *      the entry; redFlags: the flag id);
 *   N  an appended negation or third-party cue occurs: every non-red-flag capture (either side)
 *      whose cueIndex is at or after the first such occurrence, since a new cue can negate or gate
 *      anything that follows it (red flags are never negated or gated);
 *   Y  a scale entry given yieldTo by the delta, when any presence phrase (cue / ph lists of the
 *      shipped lexicon) of one of its targets occurs;
 *   H  a scale entry given `heard: true` by the delta, when its band choice in direct extraction
 *      can differ from the first-band-in-array-order rule (round 3 R9/R11,
 *      heardBandChoiceMayDiffer): that entry's id;
 *   Ta the delta adds `normalize` with apostrophes true and the text holds a typographic
 *      apostrophe (normalizeRewrites, the engine's own rule): every id on either side, because
 *      folding can move any match;
 *   Tn the delta adds `normalize` with numbers "en" and the text (without a typographic
 *      apostrophe) holds a token the engine spells out: the shipped scale entries that have a band
 *      phrase spelling can change (bandPhraseMaySpell), because numbers apply to band matching only
 *      (round 2 R4; review T4). Value-only: a capture of such an id is excused only when each side
 *      holds at most one capture of that id, of kind item or heard, and, when both sides hold one,
 *      the two agree on everything except value, kind, cue and cueText (same evidence, cueIndex
 *      and suppressedBy). Remaining breadth, stated: for such an entry a changed value, and the
 *      appearance or disappearance of its one capture, are excused whatever their cause. Red
 *      flags, non-scale captures and scale entries without such a band phrase (no band, or no
 *      number word in any band) stay strictly compared; the capture suite and gold set 0.3.0 own
 *      the normalize behaviour.
 * Heard captures of an entry given `heard: true` by the delta are removed separately (`heard`).
 * Returns the sets per rule; ad13Touched merges them.
 */
function ad13Rules(p, a, b) {
  const { delta, text, lexicon } = p;
  const low = text.toLowerCase();
  const caps = [...a, ...b];
  const R = { P: new Set(), N: new Set(), Y: new Set(), H: new Set(), Ta: new Set(), Tn: new Set(), heard: new Set() };
  for (const row of arr(delta.appended)) {
    if (!isObj(row) || typeof row.path !== "string") continue;
    const hits = arr(row.phrases).filter((ph) => typeof ph === "string" && ph && low.includes(ph));
    if (!hits.length) continue;
    const t = deltaTokens(row.path);
    if (t[0] === "redFlags") R.P.add(t[1]);
    else if (t[0] === "multi") {
      const e = valueAt(lexicon, t.slice(0, 2));
      for (const x of arr(isObj(e) ? e.ids : null)) if (isObj(x) && typeof x.id === "string") R.P.add(x.id);
    } else if (t[0] === "bool" || t[0] === "ctx" || t[0] === "scale") {
      const e = valueAt(lexicon, t.slice(0, 2));
      const id = isObj(e) && typeof e.id === "string" ? e.id : row.entryId;
      if (typeof id === "string") R.P.add(id);
    } else if (t[0] === "negation" || t[0] === "thirdParty") {
      const first = Math.min(...hits.map((ph) => low.indexOf(ph)));
      for (const c of caps) if (c.kind !== "redflag" && typeof c.cueIndex === "number" && c.cueIndex >= first) R.N.add(c.id);
    }
  }
  const presence = (id) => [
    ...arr(lexicon.scale).filter((e) => isObj(e) && e.id === id).flatMap((e) => arr(e.cue)),
    ...arr(lexicon.bool).filter((e) => isObj(e) && e.id === id).flatMap((e) => arr(e.ph)),
  ];
  for (const row of arr(delta.fields)) {
    if (!isObj(row) || typeof row.path !== "string") continue;
    const m = /^\/scale\/(\d+)\/(yieldTo|heard)$/.exec(row.path);
    if (m) {
      const e = arr(lexicon.scale)[Number(m[1])];
      const id = isObj(e) && typeof e.id === "string" ? e.id : row.entryId;
      if (m[2] === "heard") {
        if (row.to === true) {
          R.heard.add(id);
          if (heardBandChoiceMayDiffer(lexicon, e, text)) R.H.add(id);
        }
        continue;
      }
      if (arr(row.to).some((target) => presence(target).some((ph) => typeof ph === "string" && ph && low.includes(ph)))) R.Y.add(id);
    } else if (row.path === "/normalize" && isObj(row.to)) {
      const r = normalizeRewrites(text, row.to);
      if (r.apostrophes) for (const c of caps) R.Ta.add(c.id);
      else if (r.numbers) {
        for (const e of arr(lexicon.scale)) {
          if (isObj(e) && typeof e.id === "string" && arr(e.bands).some((x) => isObj(x) && arr(x.ph).some(bandPhraseMaySpell))) R.Tn.add(e.id);
        }
      }
    }
  }
  return R;
}

/** ad13Rules merged: {ids} excused whole (P, N, Y, H, Ta), {valueOnly} under Tn's conditions, {heard}. */
function ad13Touched(p, a, b) {
  const R = ad13Rules(p, a, b);
  const ids = new Set([...R.P, ...R.N, ...R.Y, ...R.H, ...R.Ta]);
  const valueOnly = new Set([...R.Tn].filter((id) => !ids.has(id)));
  return { ids, valueOnly, heard: R.heard };
}

/**
 * AD13's extraction rules for one comparison, by rule, for self-checks (review T5): the ids each
 * rule would act on, sorted, as {P, N, Y, H, Ta, Tn, heard} (see ad13Rules). `p` is the extraction
 * ctx.AD13 ({delta, text, lexicon}); `a` and `b` are the two capture arrays (rule N reads their
 * cueIndex; Ta lists their ids). Tn lists the ids whose captures may be excused value-only; whether
 * they are depends on the captures (the AD13 normaliser decides). Returns null for a malformed `p`.
 * Pure; never throws for array inputs.
 * @param {{delta: object, text: string, lexicon: object}} p
 * @param {object[]} [a]
 * @param {object[]} [b]
 */
export function ad13Explain(p, a = [], b = []) {
  if (!isObj(p) || !isObj(p.delta) || typeof p.text !== "string" || !isObj(p.lexicon)) return null;
  const R = ad13Rules(p, arr(a).filter(isObj), arr(b).filter(isObj));
  const out = {};
  for (const k of Object.keys(R)) out[k] = [...R[k]].filter((x) => x !== undefined).sort();
  return out;
}

/** A capture of a Tn id reduced to what number spelling cannot change, or null when it is not an item or heard capture. */
function tnSkeleton(c) {
  return c.kind === "item" || c.kind === "heard" ? withoutKeys(c, ["value", "kind", "cue", "cueText"]) : null;
}

/**
 * Rule H of AD13: whether scale entry `e` of `lexicon`, given heard: true, can take a different
 * value in direct extraction of `text` than the first-band-in-array-order rule gives for the same
 * bands (round 3 R9 and R11). Exported for self-checks (review T5).
 *
 * The heard rule (R9): open on the entry's cue hit (the first cue phrase, in list order, found in
 * the text); collect every occurrence of every band phrase with a value; drop occurrences strictly
 * inside a longer one; then no value (the fallback) when a carryRefuse phrase occurs anywhere, when
 * any remaining occurrence is negated within the negation window, or when the remaining
 * occurrences hold two or more values; and no value either when every remaining occurrence is a
 * carryExclude phrase outside every cue sentence (R11 as corrected in design 05 §13.11: a cue
 * sentence holds a cue hit that is not negated and passes the attribution and history gates;
 * sentences end at . ! ? ; followed by whitespace or the end of the text); otherwise their one
 * value. The baseline rule: the value of the first band, in array order, with a phrase anywhere in
 * the text (a band without a value gives none), else the fallback.
 *
 * Both are evaluated on the lowercased text with the band phrases as written; number spelling and
 * apostrophe folding are rule T's. The negation window is not known here (the call's negationWindow
 * may override the lexicon's), so a remaining occurrence counts as possibly negated whenever a
 * negation cue of the lexicon starts anywhere before it: a superset of every window. For the same
 * reason the opening hit's sentence is the one sure cue sentence, and every other sentence holding
 * a cue occurrence is possibly one, so both outcomes are kept there. The result is
 * true when any possible heard outcome differs from the baseline value (null and undefined are both
 * "no value"); arming and unresolved state (R9 f) never change extract's captures. Pure.
 * @param {object} lexicon  the shipped lexicon (negation cues, carryRefuse)
 * @param {object} e        the scale entry, as shipped
 * @param {string} text
 * @returns {boolean}
 */
export function heardBandChoiceMayDiffer(lexicon, e, text) {
  if (!isObj(lexicon) || !isObj(e) || typeof text !== "string") return false;
  const low = text.toLowerCase();
  const hit = (ph) => typeof ph === "string" && ph !== "" && low.includes(ph);
  const cue = arr(e.cue).find(hit);
  if (cue === undefined) return false;    // the entry does not open: no capture of it on either side
  const sentence = sentenceIndex(low);
  const cueSentence = sentence(low.indexOf(cue));
  const cueSentences = new Set();         // every sentence holding a cue occurrence (a superset)
  for (const ph of arr(e.cue)) {
    if (!hit(ph)) continue;
    for (let i = low.indexOf(ph); i !== -1; i = low.indexOf(ph, i + ph.length)) cueSentences.add(sentence(i));
  }
  const excluded = arr(e.carryExclude);
  let spans = [];
  let first;                              // the first-band-in-array-order value (undefined: none)
  for (const b of arr(e.bands)) {
    if (!isObj(b)) continue;
    if (first === undefined && arr(b.ph).some(hit)) first = { v: b.v };
    if (b.v === null || b.v === undefined) continue;
    for (const ph of arr(b.ph)) {
      if (!hit(ph)) continue;
      for (let i = low.indexOf(ph); i !== -1; i = low.indexOf(ph, i + ph.length)) spans.push({ start: i, end: i + ph.length, v: b.v, ph });
    }
  }
  spans = spans.filter((x) => !spans.some((y) => y.start <= x.start && x.end <= y.end && y.end - y.start > x.end - x.start));
  const none = (x) => (x === undefined ? null : x);
  const fallback = none(e.fallback);
  const baseline = first === undefined ? fallback : none(first.v);
  const outcomes = [];
  const values = new Set(spans.map((x) => JSON.stringify(x.v)));
  // Whether some span surely, or possibly, may supply the value (R11).
  const sure = spans.some((x) => !excluded.includes(x.ph) || sentence(x.start) === cueSentence);
  const maybe = sure || spans.some((x) => cueSentences.has(sentence(x.start)));
  if (arr(lexicon.carryRefuse).some(hit) || values.size !== 1 || !maybe) {
    outcomes.push(fallback);
  } else {
    outcomes.push(spans[0].v);
    if (!sure) outcomes.push(fallback);
    const cues = arr(isObj(lexicon.negation) ? lexicon.negation.cues : null).filter((c) => typeof c === "string" && c !== "");
    const firstCue = Math.min(Infinity, ...cues.map((c) => low.indexOf(c)).filter((k) => k !== -1));
    if (spans.some((x) => firstCue < x.start)) outcomes.push(fallback);
  }
  return outcomes.some((o) => !same(o, baseline));
}

// ------------------------------------------------------------------------------- AD16 .txt

/**
 * The AD16 parameter object (release 0.4.3) for one Patient .txt comparison, from the baseline
 * summary and the baseline UI[loc]: thin = [thinTitle, thin] when the summary is thin by the
 * baseline screen's own rule (nothing said, no clinician line, no flag: Pat L1001); notSure =
 * [notSure, notSureLede] when it lists a "Not sure"; unreviewed = txtUnreviewed, which closes the
 * header (Pat L1101). null when the .txt has neither difference. In es these are the baseline's
 * own Spanish strings (UI.es), which the engine's es chrome prints unchanged: none of them is an
 * AD14 (Spanish completion) source, so AD14 and AD16 act on disjoint lines of one .txt.
 */
export function ad16Params(summary, ui) {
  if (!isObj(summary) || !isObj(ui)) return null;
  const thin = !arr(summary.said).length && !arr(summary.clin).length && !arr(summary.flags).length;
  const unsure = arr(summary.unsureList).length > 0;
  if (!thin && !unsure) return null;
  return {
    thin: thin ? [ui.thinTitle, ui.thin] : null,
    notSure: unsure ? [ui.notSure, ui.notSureLede] : null,
    unreviewed: typeof ui.txtUnreviewed === "string" ? ui.txtUnreviewed : "",
  };
}

// ------------------------------------------------------------------------------- the table

// ------------------------------------------------------------------------------- AD17 referral

/** A referral ServiceRequest's code text (engine/fhir.js; baseline Scr L1456, Scb L1401). */
const AD17_REFERRAL_RE = /^Referral: (.+) — evaluate for (.+)$/;
const ad17Str = (x) => typeof x === "string" && x.length > 0;

/**
 * The change AD17 may excuse in one comparison: the row of the delta's `destinations` for
 * ctx.AD17.complaint, as {phenotype, reason, from, to}, or null (no such row, no usable
 * parameters, or a malformed list: a `destinations` that is not a list, or a row without four
 * non-empty strings or with from === to, excuses nothing at all).
 */
function ad17Change(p) {
  if (!isObj(p) || !isObj(p.delta) || !ad17Str(p.complaint) || !Array.isArray(p.delta.destinations)) return null;
  const rows = p.delta.destinations;
  if (!rows.length || rows.some((r) => !isObj(r) || !ad17Str(r.phenotype) || !ad17Str(r.reason) || !ad17Str(r.from) || !ad17Str(r.to) || r.from === r.to)) return null;
  const hit = rows.filter((r) => r.phenotype === p.complaint);
  return hit.length === 1 ? { phenotype: hit[0].phenotype, reason: hit[0].reason, from: hit[0].from, to: hit[0].to } : null;
}

// ------------------------------------------------------------------------------- AD18 chart reading

const AD18_WORD_RE = /[\p{L}\p{N}]/u;
const ad18Word = (ch) => typeof ch === "string" && ch !== "" && AD18_WORD_RE.test(ch);
const AD18_WORD_G = /[\p{L}\p{N}]/u;
/** The phrases of a list of strings or {ph, source} rows. */
const ad18List = (xs) => arr(xs).map((e) => (isObj(e) ? e.ph : e)).filter((p) => typeof p === "string" && p !== "");
/** Every occurrence of every phrase in `hay`, as {start, end}. */
function ad18Occ(hay, phrases) {
  const out = [];
  for (const p of phrases) for (let k = hay.indexOf(p); k !== -1; k = hay.indexOf(p, k + 1)) out.push({ start: k, end: k + p.length, phrase: p });
  return out;
}
const ad18AtWordStart = (hay, o) => !(ad18Word(o.phrase[0]) && o.start > 0 && ad18Word(hay[o.start - 1]));
/** A label at the start of a one-line text, as the engine reads one (engine/extraction.js LABEL_LINE). */
const AD18_LABEL_RE = /^[ \t]*([A-Za-z][A-Za-z0-9 /&()'-]{0,40}?)[ \t]*:(?=\s|$)/;
/** The ids a capture of kind "ctx" can carry in `lexicon`: lexicon.ctx ids and the multi targets of kind ctx. */
function ad18CtxIds(lexicon) {
  const out = new Set();
  for (const e of arr(lexicon.ctx)) if (isObj(e) && typeof e.id === "string") out.add(e.id);
  for (const e of arr(lexicon.multi)) if (isObj(e)) for (const t of arr(e.ids)) if (isObj(t) && t.kind === "ctx" && typeof t.id === "string") out.add(t.id);
  return out;
}
const ad18Key = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The phrases through which each id can be captured in `lexicon`: bool ph, ctx ph, scale cue, band
 * phrases and anchors (and carryRefuse for an entry with heard: true), multi ph (for every id of
 * the entry) and red-flag phrases. Map id → phrases.
 */
function ad18IdPhrases(lexicon) {
  const m = new Map();
  const add = (id, xs) => { if (typeof id !== "string") return; if (!m.has(id)) m.set(id, []); m.get(id).push(...ad18List(xs)); };
  for (const e of arr(lexicon.bool)) if (isObj(e)) add(e.id, e.ph);
  for (const e of arr(lexicon.ctx)) if (isObj(e)) add(e.id, e.ph);
  for (const e of arr(lexicon.scale)) {
    if (!isObj(e)) continue;
    add(e.id, e.cue);
    for (const b of arr(e.bands)) if (isObj(b)) add(e.id, b.ph);
    add(e.id, e.anchor);
    if (e.heard === true) add(e.id, lexicon.carryRefuse);
  }
  for (const e of arr(lexicon.multi)) if (isObj(e)) for (const t of arr(e.ids)) if (isObj(t)) add(t.id, e.ph);
  if (isObj(lexicon.redFlags)) for (const [id, ph] of Object.entries(lexicon.redFlags)) add(id, ph);
  // Review round 2: the chart-register red-flag phrases (clauses.redFlags) of each flag.
  const cl = isObj(lexicon.clauses) ? lexicon.clauses : {};
  if (isObj(cl.redFlags)) for (const [id, rows] of Object.entries(cl.redFlags)) add(id, rows);
  return m;
}

/**
 * AD18's rules for one utterance (release 0.4.7; design 06 / 03 §8.4): the ids whose captures the
 * 0.3.2 → 0.3.3 delta (tests/harness/lexicon-delta-033.js: chart reading, lexicon.clauses, and four
 * appended negation cues) may change in `text`, each rule a stated superset of one chart-reading
 * mechanism of engine/extraction.js, read on the lowercased text with typographic apostrophes folded
 * and every whitespace character read as a space. A "sentence" is the span between two sentence
 * ends (. ! ? ; followed by whitespace or the end; a "?" with no letter or digit since the last end
 * ends nothing, as in the engine), a superset of every clause of a one-line text.
 *   S0  the text holds a whitespace character other than a space (a line break, a tab): lines,
 *       headers, sections and wrapped lines are read, so every id on either side;
 *   G   a one-line text that is a section word of clauses.sections, or opens with one as a label
 *       ("Allergies: …"): every id on either side;
 *   W   an occurrence of one of the id's phrases that is not at a word start, or lies inside an
 *       occurrence of a clauses.mask word (wordStart, mask);
 *   Wc  a negation, attribution or history cue (the lexicon's, clauses.thirdParty included) occurs
 *       not at a word start: every id with an occurrence after it (that cue no longer reads). Not a
 *       negation cue lying at the end of a word-start negation cue that holds it ("n't" in "didn't"):
 *       the engine measures that cue from it, so its reach is the 0.3.2 one (review round 1);
 *   S   a cue of those lists occurs before an occurrence of the id with a sentence end, a ": " or a
 *       clauses.breaks cue between them (the window is clipped to the clause);
 *   L   in the occurrence's sentence: a clauses.deny or (review round 1) clauses.scopeEnd cue before
 *       it, a clauses.affirm cue anywhere (review round 2: after it, an affirm cue may answer it as a
 *       label), a clauses.post cue after it, or a clauses.prefix cue ending at it;
 *   H   in the occurrence's sentence: a clauses.hedge or clauses.placeholder cue;
 *   T   a clauses.thirdParty cue before the occurrence;
 *   N   a negation cue the delta appends before the occurrence;
 *   M   the id has occurrences at two or more offsets (every mention in text order; a yes/no
 *       entry's mentions decide together: one finding affirmed and denied, or any mixed mentions of
 *       a clauses.strictConflict item, record nothing, and otherwise an affirmed mention wins);
 *   RF  with clauses.redFlagNegation, a red flag with a negation cue of the lexicon before an
 *       occurrence (a denied flag is not raised);
 *   B   a scale entry with heard: true, a band or carryRefuse phrase of it occurring, in a text with
 *       more than one sentence, a ": " or a clauses.breaks cue (its duration comes from its cue's
 *       clause only);
 *   P   typed chart text only (p.chart true, the extraction ran with opts.chart): a
 *       clauses.chartIgnoreThirdParty cue before the occurrence (it gates in 0.3.2, never in chart
 *       text);
 *   C   (review round 2) an occurrence of one of the flag's clauses.redFlags phrases (chart-register
 *       red-flag wording; read in every line since D9, 2026-10-12).
 *   X   typed chart text only (p.chart true; the clinical lead's D8 answer of 2026-10-12): every id a
 *       capture of kind "ctx" can carry (lexicon.ctx and the multi targets of kind ctx): typed chart
 *       text sets no context marker.
 * The normaliser applies them to typed chart text and, since the lead's decision D9 of 2026-10-12, to
 * spoken lines (p.chart not true), where P and X never fire; ad18Explain reports them for any p.
 * A spoken line's heard band choice and yields are release 0.4.6's (the carry-over D9 keeps), its red
 * flags are read with the reply-word rule (a reply-opening deny cue lowers none): both can only keep a
 * spoken capture at its 0.3.2 value, so no rule is needed for them.
 * Every clauses cue list is read here wherever it occurs (no word start or end): a superset of the
 * engine's whole-word matching of those lists.
 * `p` = ctx.AD18 = {delta, text, lexicon (the shipped 0.3.3 lexicon), chart?}; `a`, `b` the two
 * capture arrays (S0 and G list their ids). Returns the sets per rule.
 */
function ad18Rules(p, a, b) {
  const { delta, text, lexicon } = p;
  const cl = isObj(lexicon.clauses) ? lexicon.clauses : {};
  const R = { S0: new Set(), G: new Set(), W: new Set(), Wc: new Set(), S: new Set(), L: new Set(), H: new Set(), T: new Set(),
    N: new Set(), M: new Set(), RF: new Set(), B: new Set(), P: new Set(), C: new Set(), X: new Set() };
  if (p.chart === true) for (const id of ad18CtxIds(lexicon)) if ([...a, ...b].some((c) => c.id === id)) R.X.add(id);
  const all = [...a, ...b];
  if (/[^\S ]/.test(text)) for (const c of all) R.S0.add(c.id);
  const hay = text.toLowerCase().replace(AD13_FOLDED_G, "'").replace(/\s/g, " ");
  const sec = new Set();
  if (isObj(cl.sections)) for (const k of Object.keys(cl.sections)) for (const w of ad18List(cl.sections[k])) sec.add(ad18Key(w));
  const trimmed = text.trim();
  const bare = trimmed.endsWith(":") ? trimmed.slice(0, -1) : trimmed;
  const label = AD18_LABEL_RE.exec(text);
  if (sec.has(ad18Key(bare)) || (label && sec.has(ad18Key(label[1])))) for (const c of all) R.G.add(c.id);
  const ends = [];
  // A "?" with no letter or digit since the last sentence end (chart shorthand "? aura") ends nothing,
  // as in the engine (review round 1): it belongs to the words after it.
  for (let k = 0, last = 0; k < hay.length; k++) {
    if (!".!?;".includes(hay[k]) || !(k + 1 === hay.length || hay[k + 1] === " ")) continue;
    if (hay[k] === "?" && !AD18_WORD_G.test(hay.slice(last, k))) continue;
    ends.push(k);
    last = k + 1;
  }
  const sentence = (pos) => ends.filter((e) => e < pos).length;
  const cueOf = (x) => ad18List(isObj(x) ? x.cues : null);
  const gates = ad18Occ(hay, [...cueOf(lexicon.negation), ...cueOf(lexicon.thirdParty), ...cueOf(lexicon.historical), ...ad18List(cl.thirdParty)]);
  const breaks = ad18Occ(hay, ad18List(cl.breaks));
  const colons = [];
  for (let k = hay.indexOf(": "); k !== -1; k = hay.indexOf(": ", k + 1)) colons.push(k);
  const masks = ad18Occ(hay, ad18List(cl.mask));
  const deny = ad18Occ(hay, ad18List(cl.deny)), affirm = ad18Occ(hay, ad18List(cl.affirm)), post = ad18Occ(hay, ad18List(cl.post));
  const scopeEnd = ad18Occ(hay, ad18List(cl.scopeEnd));
  const prefix = ad18Occ(hay, ad18List(cl.prefix)), hedge = ad18Occ(hay, [...ad18List(cl.hedge), ...ad18List(cl.placeholder)]);
  const tp = ad18Occ(hay, ad18List(cl.thirdParty));
  const pronouns = p.chart === true ? ad18Occ(hay, ad18List(cl.chartIgnoreThirdParty)) : [];
  const appended = ad18Occ(hay, arr(delta.appended).filter((row) => isObj(row) && row.path === "/negation/cues").flatMap((row) => arr(row.phrases)));
  const negCues = ad18Occ(hay, cueOf(lexicon.negation));
  const negWordStart = negCues.filter((n) => ad18AtWordStart(hay, n));
  const negList = cueOf(lexicon.negation);
  const measuredFrom = (g) => negList.includes(g.phrase)
    && negWordStart.some((n) => n.end === g.end && n.start < g.start && n.phrase.endsWith(g.phrase));
  const midWord = gates.filter((g) => !ad18AtWordStart(hay, g) && !measuredFrom(g));
  const boundaryBetween = (from, to) => ends.some((e) => e >= from && e < to) || colons.some((k) => k >= from && k < to)
    || breaks.some((x) => x.start > from && x.start < to);
  const multiSentence = ends.some((e) => e < hay.length - 1) || colons.length > 0 || breaks.length > 0;
  const flags = isObj(lexicon.redFlags) ? new Set(Object.keys(lexicon.redFlags)) : new Set();
  const heardIds = new Set(arr(lexicon.scale).filter((e) => isObj(e) && e.heard === true).map((e) => e.id));
  if (isObj(cl.redFlags)) {
    for (const [id, rows] of Object.entries(cl.redFlags)) if (ad18Occ(hay, ad18List(rows)).length) R.C.add(id);
  }
  for (const [id, phrases] of ad18IdPhrases(lexicon)) {
    const occ = ad18Occ(hay, phrases);
    if (!occ.length) continue;
    if (new Set(occ.map((o) => o.start)).size > 1) R.M.add(id);
    if (heardIds.has(id) && multiSentence) R.B.add(id);
    for (const o of occ) {
      const s = sentence(o.start);
      const inS = (x) => sentence(x.start) === s;
      if (!ad18AtWordStart(hay, o) || masks.some((m) => m.start <= o.start && o.end <= m.end)) R.W.add(id);
      if (midWord.some((g) => g.start <= o.start)) R.Wc.add(id);
      if (gates.some((g) => g.start < o.start && boundaryBetween(g.start, o.start))) R.S.add(id);
      if (deny.some((x) => x.start < o.start && inS(x)) || affirm.some(inS) || scopeEnd.some((x) => x.start < o.start && inS(x))
        || post.some((x) => x.start >= o.end && inS(x)) || prefix.some((x) => x.end === o.start)) R.L.add(id);
      if (hedge.some(inS)) R.H.add(id);
      if (tp.some((x) => x.start < o.start)) R.T.add(id);
      if (appended.some((x) => x.start < o.start)) R.N.add(id);
      if (cl.redFlagNegation === true && flags.has(id) && negCues.some((x) => x.start < o.start)) R.RF.add(id);
      if (pronouns.some((x) => x.start < o.start)) R.P.add(id);
    }
  }
  return R;
}

/**
 * AD18's evidence rule (E): the 0.3.3 side's captures with their evidence put back to the whole
 * text and `clause` removed, or null when any capture does not carry clause {start, end} as its
 * last key, with integer offsets inside the text and the evidence exactly text.slice(start, end)
 * (the 0.3.2 side must carry no clause at all). The clause must also hold the capture's cueIndex
 * (start <= cueIndex < end) and neither start nor end inside a word (review round 1): a clause
 * attached to the wrong part of the text is not excused. A value carried into a spoken reply (via
 * "carry", D9 keeping carry-over as it was) has the whole reply as its evidence and no clause, and
 * passes as it is.
 */
function ad18Unclause(text, a, b) {
  if (a.some((c) => Object.prototype.hasOwnProperty.call(c, "clause"))) return null;
  const out = [];
  for (const c of b) {
    const keys = Object.keys(c);
    // A value carried into a spoken reply (via "carry") keeps the whole reply as its evidence and has no
    // clause, as in release 0.4.6 (D9 keeps carry-over as it was).
    if (c.via === "carry" && !Object.prototype.hasOwnProperty.call(c, "clause")) {
      if (c.evidence !== text) return null;
      out.push(c);
      continue;
    }
    const k = c.clause;
    if (keys[keys.length - 1] !== "clause" || !isObj(k) || !same(Object.keys(k), ["start", "end"]) || !Number.isInteger(k.start) || !Number.isInteger(k.end)
      || k.start < 0 || k.end > text.length || k.start >= k.end || c.evidence !== text.slice(k.start, k.end)) return null;
    if (!Number.isInteger(c.cueIndex) || c.cueIndex < k.start || c.cueIndex >= k.end
      || (ad18Word(text[k.start - 1]) && ad18Word(text[k.start])) || (ad18Word(text[k.end - 1]) && ad18Word(text[k.end]))) return null;
    const x = { ...c, evidence: text };
    delete x.clause;
    out.push(x);
  }
  return out;
}

/**
 * AD18's extraction rules for one comparison, by rule, for self-checks: {E (true when the evidence
 * rule holds), S0, G, W, Wc, S, L, H, T, N, M, RF, B, P, C, X} with the ids sorted. `p` is the extraction
 * ctx.AD18 ({delta, text, lexicon, chart?}); `a` and `b` the two capture arrays. null for a
 * malformed `p`.
 * Pure; never throws for array inputs.
 * @param {{delta: object, text: string, lexicon: object, chart?: boolean}} p
 * @param {object[]} [a]
 * @param {object[]} [b]
 */
export function ad18Explain(p, a = [], b = []) {
  if (!isObj(p) || !isObj(p.delta) || typeof p.text !== "string" || !isObj(p.lexicon)) return null;
  const xa = arr(a).filter(isObj), xb = arr(b).filter(isObj);
  const R = ad18Rules(p, xa, xb);
  const out = { E: ad18Unclause(p.text, xa, xb) !== null };
  for (const k of Object.keys(R)) out[k] = [...R[k]].filter((x) => x !== undefined).sort();
  return out;
}

/**
 * The §8.4 table. Owners name the suites that exercise each AD; the normalisers themselves
 * all live here (WP13).
 */
export const ALLOWED_DIFFERENCES = [
  {
    id: "AD1",
    ready: true,
    owner: "golden (WP4)",
    what: "Screener-surface bundle: attainable-range low and the incomplete note use floor, not total (Scr L1526, L1549)",
    // ctx.AD1 = {total, floor}: the screen's computeScore total and floor. Only the
    // attainable-range low value and the Observation note are touched.
    appliesTo: (path, ctx) => !!(ctx && ctx.AD1) && (/\/valueRange\/low\/value$/.test(path) || /\/note\/\d+\/text$/.test(path)),
    normalise(a, b, ctx) {
      const { total, floor } = ctx.AD1;
      if (total === floor) return [a, b];
      if (typeof a === "number" && typeof b === "number") {
        return a === total && b === floor ? [b, b] : [a, b];
      }
      if (typeof a === "string" && typeof b === "string") {
        const a2 = a.replace(`bounded to ${total}–`, `bounded to ${floor}–`);
        return a2 !== a && a2 === b ? [b, b] : [a, b];
      }
      return [a, b];
    },
    // input = {surface, score:{scorable, total, floor}}
    detector: (input) => !!(input && input.surface === "screener" && input.score && !input.score.scorable && input.score.floor < input.score.total),
  },
  {
    id: "AD2",
    ready: true,
    owner: "golden (WP4)",
    what: "cohort rows and CSV: module_id after app_version; the Scribe uses the engine (Screener) row",
    // ctx.AD2 = {moduleId, scribe?: boolean}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD2),
    normalise(a, b, ctx) {
      const p = ctx.AD2;
      if (isObj(a) && isObj(b) && "app_version" in b) {
        if (b.module_id !== p.moduleId) return [a, b];
        const extra = ad2Extra(Object.keys(a), Object.keys(b), p);
        return extra ? [a, withoutKeys(b, extra)] : [a, b];
      }
      if (looksLikeCohortCsv(a) && looksLikeCohortCsv(b)) {
        const xh = csvCells(csvLines(a)[0]), yh = csvCells(csvLines(b)[0]);
        const extra = ad2Extra(xh, yh, p);
        if (!extra) return [a, b];
        // Every data row carries the module id in that column.
        const iMod = yh.indexOf("module_id");
        if (!csvLines(b).slice(1).every((l) => csvCells(l)[iMod] === p.moduleId)) return [a, b];
        return [a, dropCsvColumns(b, extra)];
      }
      return [a, b];
    },
    // input = a cohort row or CSV text from the new engine: always carries module_id.
    detector: () => true,
  },
  {
    id: "AD3",
    ready: true,
    owner: "golden (WP4)",
    what: "data dictionary: module_id first and complaint before coverage in canonicalCohortFields",
    // ctx.AD3 = {} (presence enables it)
    appliesTo: (path, ctx) => !!(ctx && ctx.AD3),
    normalise(a, b) {
      if (!isObj(a) || !isObj(b) || !Array.isArray(a.canonicalCohortFields) || !Array.isArray(b.canonicalCohortFields)) return [a, b];
      const xs = a.canonicalCohortFields, ys = b.canonicalCohortFields;
      const names = (l) => l.map((f) => f && f.name);
      const xn = names(xs), yn = names(ys);
      if (xn.includes("module_id") || xn.includes("complaint")) return [a, b];
      if (yn[0] !== "module_id") return [a, b];
      const iC = yn.indexOf("complaint");
      if (iC < 0 || yn[iC + 1] !== "coverage") return [a, b];
      const ys2 = ys.filter((f) => f.name !== "module_id" && f.name !== "complaint");
      return [a, { ...b, canonicalCohortFields: ys2 }];
    },
    detector: () => true,
  },
  {
    id: "AD4",
    ready: true,
    owner: "WP13",
    what: "every printed release string: 0.3.0 → 0.4.8",
    // Only a standalone "0.3.0" token is rewritten (not 0.3.1, 10.3.0 or 0.3.0.1), and only
    // when the new side prints 0.4.8 (NEW_RELEASE, moved together with policy.APP_VERSION).
    appliesTo: () => true,
    normalise(a, b) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      if (!RELEASE_RE.test(a)) { RELEASE_RE.lastIndex = 0; return [a, b]; }
      RELEASE_RE.lastIndex = 0;
      if (!b.includes(NEW_RELEASE)) return [a, b];
      const a2 = a.replace(RELEASE_RE, NEW_RELEASE);
      return a2 === a ? [a, b] : [a2, b];
    },
    detector: () => true,
  },
  {
    id: "AD5",
    ready: true,
    owner: "render-scribe (WP8)",
    what: "Scribe probe rail “re-asking {id}” prints itemShort(item) instead of the raw id (Scb L1169)",
    // ctx.AD5 = {short: {itemId: itemShort(item)}}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD5),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const short = ctx.AD5.short || {};
      const a2 = a.replace(/re-asking ([a-z][a-z0-9_]*)/g, (m, id) => (Object.prototype.hasOwnProperty.call(short, id) ? `re-asking ${short[id]}` : m));
      return a2 !== a && a2 === b ? [b, b] : [a, b];
    },
    // input = {rescues: id, short} — the id differs from its short label
    detector: (input) => !!(input && input.short && input.short !== input.rescues),
  },
  {
    id: "AD6",
    ready: true,
    owner: "golden / rules (WP5)",
    what: "Scribe red-flag wording (Scb L189-240) → the canonical Screener wording",
    // ctx.AD6 = ad6Pairs(scribe RED_FLAGS, screener RED_FLAGS)
    appliesTo: (path, ctx) => !!(ctx && ctx.AD6),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const a2 = ad6Canonical(a, ctx.AD6);
      return a2 === a ? [a, b] : [a2, b];
    },
    // input = {strings: [baseline strings], pairs} — some baseline string carries Scribe wording
    detector: (input) => !!(input && Array.isArray(input.strings) && input.pairs &&
      input.strings.some((s) => typeof s === "string" && ad6Canonical(s, input.pairs) !== s)),
  },
  {
    id: "AD7",
    ready: true,
    owner: "render-screener (WP7)",
    what: "Screener meter zones 33/33/34 → 34/33/33 derived from the cuts (visual only)",
    // ctx.AD7 = {from: [33,33,34], to: [34,33,33]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD7),
    normalise(a, b, ctx) {
      const { from, to } = ctx.AD7;
      return same(a, from) && same(b, to) ? [b, b] : [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD8",
    ready: true,
    owner: "research-parity (WP10)",
    what: "research panel: module_id / scoring_hash in manifest and model card; modelVersion default; file names",
    // ctx.AD8 = {moduleId, scoringHash, modelVersion?: {from, to}, fileNames?: [[from, to]]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD8),
    normalise(a, b, ctx) {
      const p = ctx.AD8;
      if (isObj(a) && isObj(b)) {
        const extra = [];
        if (!("module_id" in a) && b.module_id === p.moduleId) extra.push("module_id");
        if (!("scoring_hash" in a) && p.scoringHash !== undefined && b.scoring_hash === p.scoringHash) extra.push("scoring_hash");
        return extra.length ? [a, withoutKeys(b, extra)] : [a, b];
      }
      if (typeof a === "string" && typeof b === "string") {
        if (p.modelVersion && a === p.modelVersion.from && b === p.modelVersion.to) return [b, b];
        for (const [from, to] of p.fileNames || []) if (a === from && b === to) return [b, b];
      }
      return [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD9",
    ready: true,
    owner: "research-parity (WP10)",
    what: "population page: its own brand row and footer, absent when embedded in Research",
    // ctx.AD9 = {regions: [baseline textContent of the brand row, of the footer, …]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD9),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      let a2 = a;
      for (const r of ctx.AD9.regions || []) if (r && a2.includes(r)) a2 = a2.replace(r, "");
      return a2 !== a && a2 === b ? [b, b] : [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD10",
    ready: true,
    owner: "patient / golden (WP6, WP9)",
    what: "Patient: the .txt closes with the dated caveat line (after any patient provenance lines); es ledes from UI.es",
    // ctx.AD10 = {notices?: string[] (patient provenance / edited / stale lines, in order),
    //             date?: "YYYY-MM-DD", ledes?: [[englishLiteral, esString]]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD10),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const p = ctx.AD10;
      let a2 = a, b2 = b;
      for (const [en, es] of p.ledes || []) if (en && a2.includes(en)) a2 = a2.split(en).join(es);
      const lines = b2.split("\n");
      const last = lines[lines.length - 1];
      if (DATED_CAVEAT_RE.test(last) && (!p.date || last.endsWith(` · ${p.date}`))) {
        const notices = p.notices || [];
        const head = lines.slice(0, lines.length - 1 - notices.length);
        const mid = lines.slice(lines.length - 1 - notices.length, lines.length - 1);
        if (same(mid, notices)) b2 = head.join("\n");
      }
      return a2 === a && b2 === b ? [a, b] : [a2, b2];
    },
    // input = a Patient .txt export: always closes with the dated caveat line
    detector: () => true,
  },
  {
    id: "AD11",
    ready: true,
    owner: "render-screener (WP7)",
    what: "Screener sample rail: 4 buttons → 9 (4 unchanged + 5 sim-* scenarios)",
    // ctx.AD11 = {added: [the five scenario button labels]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD11),
    normalise(a, b, ctx) {
      if (!Array.isArray(a) || !Array.isArray(b)) return [a, b];
      const added = ctx.AD11.added || [];
      if (b.length !== a.length + added.length) return [a, b];
      const rest = [];
      let k = 0;
      for (const x of b) {
        if (k < added.length && same(x, added[k])) { k++; continue; }
        rest.push(x);
      }
      return k === added.length && same(rest, a) ? [b, b] : [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD12",
    ready: true,
    owner: "render (WP7-WP9)",
    what: "chrome around the apps: per-page back link and pill (baseline) vs the shell chrome (new)",
    // ctx.AD12 = {baseline: [strings removed from the baseline text], current: [strings removed from the new text]}
    appliesTo: (path, ctx) => !!(ctx && ctx.AD12),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      let a2 = a, b2 = b;
      for (const s of ctx.AD12.baseline || []) if (s && a2.includes(s)) a2 = a2.replace(s, "");
      for (const s of ctx.AD12.current || []) if (s && b2.includes(s)) b2 = b2.replace(s, "");
      return (a2 !== a || b2 !== b) && a2 === b2 ? [a2, b2] : [a, b];
    },
    detector: () => true,
  },
  {
    id: "AD13",
    ready: true,
    owner: "values / extraction (WP-H)",
    what: "MASQUE lexicon 0.3.1 → 0.3.2: exactly the clinical-lead-approved delta of tests/harness/lexicon-delta.js",
    // values:      ctx.AD13 = {delta, full}   full = the whole shipped lexicon (rubric.lexicon)
    // extraction:  ctx.AD13 = {delta, text, lexicon}   lexicon = the shipped (0.3.2) lexicon
    appliesTo: (path, ctx) => !!(ctx && ctx.AD13) &&
      (path === "/lexicon" || path === "/module/versions" || /^\/extract032\//.test(path)),
    normalise(a, b, ctx, path) {
      const p = ctx.AD13;
      const delta = p.delta;
      if (!isObj(delta) || typeof delta.from !== "string" || typeof delta.to !== "string") return [a, b];
      if (path === "/lexicon") {
        // Projection objects: only when a.version === from, b.version === to and every key of b
        // deep-equals full[key]. The revert proves the whole delta exact, including the keys the
        // projection does not show (carryRefuse, normalize, goldSet); b is replaced by the
        // reverted lexicon projected onto b's keys, in b's key order.
        if (!isObj(a) || !isObj(b) || !isObj(p.full)) return [a, b];
        if (a.version !== delta.from || b.version !== delta.to) return [a, b];
        if (!Object.keys(b).every((k) => same(b[k], p.full[k]))) return [a, b];
        const r = revertLexiconDelta(p.full, delta);
        if (r === null) return [a, b];
        const proj = {};
        for (const k of Object.keys(b)) proj[k] = r[k];
        return [a, proj];
      }
      if (path === "/module/versions") {
        if (!isObj(a) || !isObj(b)) return [a, b];
        return a.lexicon === delta.from && b.lexicon === delta.to ? [a, { ...b, lexicon: delta.from }] : [a, b];
      }
      // /extract032/… capture arrays: drop the captures of every id the delta may touch in this
      // text (ad13Touched: rules P, N, Y, H, Ta whole, heard captures of a heard entry) from both
      // sides, then the captures of each Tn id that pass its value-only test (at most one item or
      // heard capture per side; when both sides hold one, equal apart from value, kind, cue and
      // cueText); equal afterwards (key order included) with something removed → [b, b]. Only for
      // the shipped lexicon at the delta's `to` version.
      if (!Array.isArray(a) || !Array.isArray(b) || typeof p.text !== "string") return [a, b];
      if (!isObj(p.lexicon) || p.lexicon.version !== delta.to) return [a, b];
      if (!a.every(isObj) || !b.every(isObj) || same(a, b)) return [a, b];
      const { ids, valueOnly, heard } = ad13Touched(p, a, b);
      const drop = (c) => ids.has(c.id) || (c.kind === "heard" && heard.has(c.id));
      let a2 = a.filter((c) => !drop(c)), b2 = b.filter((c) => !drop(c));
      for (const id of valueOnly) {
        const A = a2.filter((c) => c.id === id), B = b2.filter((c) => c.id === id);
        if ((!A.length && !B.length) || A.length > 1 || B.length > 1) continue;
        const sa = A.length ? tnSkeleton(A[0]) : undefined, sb = B.length ? tnSkeleton(B[0]) : undefined;
        if (sa === null || sb === null) continue;
        if (sa !== undefined && sb !== undefined && !same(sa, sb)) continue;
        a2 = a2.filter((c) => c.id !== id);
        b2 = b2.filter((c) => c.id !== id);
      }
      const removed = a2.length !== a.length || b2.length !== b.length;
      return removed && same(a2, b2) ? [b, b] : [a, b];
    },
    // input = {differs: boolean} — the raw (un-normalised) comparison showed a difference
    detector: (input) => !!(input && input.differs),
  },
  {
    id: "AD14",
    ready: true,
    owner: "patient / golden / render-patient (release 0.4.2)",
    what: "Spanish completion (release 0.4.2): the delta's and the chrome rows' English → Spanish, \"¿\" on the 18 statement-questions, \"y\" → \"e\" before an /i/ sound, the es clinician lines (per-line lang), the Spanish companion of the prototype marker",
    // ctx.AD14 = ad14Params({delta: LOCALE_DELTA, chromeEn, chromeLoc, vars, questions, listElements, marker})
    // for a translated locale, and ctx.loc = the locale of the comparison itself: AD14 excuses only
    // a comparison whose ctx.loc is the parameter object's locale ("es"), so an English or loc-less
    // comparison is never excused, whatever parameters it carries; a parameter object whose locale
    // is "en" never applies. List it after AD4 and before AD10 (allow order is application order):
    // AD4 first moves the baseline's release, and AD14's rule M hands the dated line to AD10.
    appliesTo: (path, ctx) => !!ctx && ad14Usable(ctx.AD14) && typeof ctx.loc === "string" && ctx.loc === ctx.AD14.locale,
    normalise(a, b, ctx, path) {
      const p = ctx.AD14;
      if (isObj(a) && isObj(b) && /\/clin\/(?:0|[1-9]\d*)$/.test(path)) return ad14ClinEntry(p, a, b) !== null ? [b, b] : [a, b];
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const { a2, b2 } = ad14Strings(p, a, b);
      return a2 === a && b2 === b ? [a, b] : [a2, b2];
    },
    // input = {p: ctx.AD14, baseline: string} — the baseline text holds something AD14 rewrites
    // (a pair's English, a clin English, an unopened question, " y " before an iWord)
    detector: (input) => {
      if (!input || !ad14Usable(input.p) || typeof input.baseline !== "string") return false;
      const { present } = ad14Strings(input.p, input.baseline, "");
      return Object.values(present).some((xs) => xs.length > 0);
    },
  },
  {
    id: "AD15",
    ready: true,
    owner: "render-screener / render-scribe (release 0.4.3)",
    what: "the EMR Friendly Template button: one button added to the Screener's write-back row (right after the write button) and to the Scribe's Note-view row (right after Sign to chart)",
    // ctx.AD15 = {text?: [[anchor, added], …], shape?: {anchor: string[], added: string[]}}
    //   text   on two strings: the new text holds `anchor + added` exactly once where the baseline
    //          holds `anchor`, and removing `added` there gives the baseline exactly;
    //   shape  on two tag/class lists: `added` inserted right after a run equal to `anchor`, and
    //          removing it there gives the baseline exactly.
    // Only at a result card's text or DOM shape (…/card/text, …/card/dom) or the Scribe's Note view
    // (…/view_note). Anything else, the open panel included, stays a difference.
    appliesTo: (path, ctx) => !!(ctx && ctx.AD15) && /\/(?:card\/(?:text|dom)|view_note)$/.test(path),
    normalise(a, b, ctx) {
      const p = ctx.AD15;
      if (typeof a === "string" && typeof b === "string") {
        for (const [anchor, added] of p.text || []) {
          if (typeof anchor !== "string" || typeof added !== "string" || !anchor || !added) continue;
          const at = b.indexOf(anchor + added);
          if (at < 0 || b.indexOf(anchor + added, at + 1) >= 0) continue;
          const b2 = b.slice(0, at + anchor.length) + b.slice(at + anchor.length + added.length);
          if (b2 === a) return [a, a];
        }
        return [a, b];
      }
      if (Array.isArray(a) && Array.isArray(b) && isObj(p.shape)) {
        const anchor = Array.isArray(p.shape.anchor) ? p.shape.anchor : [];
        const added = Array.isArray(p.shape.added) ? p.shape.added : [];
        if (!anchor.length || !added.length || b.length !== a.length + added.length) return [a, b];
        for (let k = anchor.length; k + added.length <= b.length; k++) {
          if (!same(b.slice(k - anchor.length, k), anchor) || !same(b.slice(k, k + added.length), added)) continue;
          if (same([...b.slice(0, k), ...b.slice(k + added.length)], a)) return [a, a];
        }
      }
      return [a, b];
    },
    // input: any result card or Note view (the button is always there)
    detector: () => true,
  },
  {
    id: "AD16",
    ready: true,
    owner: "patient / golden (release 0.4.3)",
    what: "Patient .txt: the thin warning after the header and the not-sure lede under its heading, as on screen and in the .html (Pat L1001-1014, L1058; absent from Pat L1096-1125)",
    // ctx.AD16 = ad16Params(baseline summary, baseline UI[loc]): {thin: [title, text] | null,
    //   notSure: [heading, lede] | null, unreviewed: txtUnreviewed}. Headings print as
    //   String(x).toUpperCase() and text lines with a two-space indent (Pat L1100-1114). The thin
    //   block (title, text, blank) is inserted into the baseline right after the header (title,
    //   rule, blank, then the unreviewed line and a blank when present), and the lede right after
    //   the one not-sure heading, each only when the new side holds exactly those lines at that
    //   index. Nothing else is touched; anything else stays a difference. In en and es alike the
    //   strings are the baseline's own UI[loc] (in es the Spanish of Pat L414-417, which the engine
    //   prints unchanged and AD14 never rewrites); list it last, after AD4, AD14 (es) and AD10.
    appliesTo: (path, ctx) => !!(ctx && ctx.AD16),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const p = ctx.AD16;
      const up = (s) => String(s).toUpperCase();
      const xs = a.split("\n"), ys = b.split("\n");
      let changed = false;
      if (Array.isArray(p.thin)) {
        const at = p.unreviewed && xs[3] === p.unreviewed && xs[4] === "" ? 5 : 3;
        const block = [up(p.thin[0]), "  " + p.thin[1], ""];
        if (same(ys.slice(at, at + 3), block) && !same(xs.slice(at, at + 3), block)) {
          xs.splice(at, 0, ...block);
          changed = true;
        }
      }
      if (Array.isArray(p.notSure)) {
        const head = up(p.notSure[0]), lede = "  " + p.notSure[1];
        const i = xs.indexOf(head);
        if (i >= 0 && xs.indexOf(head, i + 1) < 0 && xs[i + 1] !== lede && ys[i] === head && ys[i + 1] === lede) {
          xs.splice(i + 1, 0, lede);
          changed = true;
        }
      }
      return changed ? [xs.join("\n"), b] : [a, b];
    },
    // input = a baseline Patient summary: thin (Pat L1001) or with a "Not sure"
    detector: (input) => ad16Params(input, {}) !== null,
  },
  {
    id: "AD17",
    ready: true,
    owner: "golden / rules / render-screener (release 0.4.5)",
    what: "the referral destination of a dizziness case: exactly the referral delta's destinations (otologic Neuro-otology → Neurology; both Headache medicine / Neurology → Neurology; reason unchanged; clinical-lead decisions of 2026-10-07 and 2026-10-09, tests/harness/referral-delta.js)",
    // ctx.AD17 = {delta: REFERRAL_DELTA, complaint: the comparison's phenotype value}. Only at a
    //   referral ServiceRequest's code text (…/code/text), and only when both sides read
    //   "Referral: <specialty> — evaluate for <reason>", the reason on both sides is the reason of
    //   the delta's `destinations` row for ctx.AD17.complaint, the baseline's specialty is that
    //   row's `from` and the new one its `to`. One row per phenotype; a malformed `destinations`
    //   excuses nothing. Any other specialty, reason, phenotype, direction or place stays a
    //   difference (the sinonasal phenotype and the default keep their destination).
    appliesTo: (path, ctx) => !!(ctx && ctx.AD17) && /\/code\/text$/.test(path),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const p = ad17Change(ctx.AD17);
      if (!p) return [a, b];
      const ma = AD17_REFERRAL_RE.exec(a), mb = AD17_REFERRAL_RE.exec(b);
      if (!ma || !mb || ma[1] !== p.from || mb[1] !== p.to || ma[2] !== p.reason || mb[2] !== p.reason) return [a, b];
      return [b, b];
    },
    // input = {p: ctx.AD17, baseline: the baseline's referral code text (or null)} — the baseline
    // refers this phenotype to its destinations row's `from`, with that row's reason
    detector: (input) => {
      const p = input ? ad17Change(input.p) : null;
      const m = p && typeof input.baseline === "string" ? AD17_REFERRAL_RE.exec(input.baseline) : null;
      return !!(m && m[1] === p.from && m[2] === p.reason);
    },
  },
  {
    id: "AD18",
    ready: true,
    owner: "values / extraction / capture (release 0.4.7)",
    what: "MASQUE lexicon 0.3.2 → 0.3.3: exactly the delta of tests/harness/lexicon-delta-033.js (chart reading, clarification triggers, four negation cues; signed off by the clinical lead on 2026-10-12); in extraction, comparisons of typed chart text (opts.chart) and, since the lead's decision D9 of 2026-10-12, of spoken lines (rules P and X typed only)",
    // values:      ctx.AD18 = {delta, full}   full = the whole shipped lexicon (rubric.lexicon); list
    //              it before AD13 (allow ["AD18", "AD13"]): it hands AD13 the 0.3.2 projection, and
    //              ctx.AD13.full is then the 0.3.2-equivalent lexicon
    // extraction:  ctx.AD18 = {delta, text, lexicon, chart}   lexicon = the shipped (0.3.3) lexicon;
    //              chart true when both sides ran with opts.chart (typed chart text); without it the
    //              comparison is a spoken line's (D9, 2026-10-12: chart reading reads it too; rules P
    //              and X never fire there)
    appliesTo: (path, ctx) => !!(ctx && ctx.AD18) &&
      (path === "/lexicon" || path === "/module/versions" || /^\/extract033\//.test(path)),
    normalise(a, b, ctx, path) {
      const p = ctx.AD18;
      const delta = p.delta;
      if (!isObj(delta) || typeof delta.from !== "string" || typeof delta.to !== "string") return [a, b];
      if (path === "/lexicon") {
        // Projection objects: only when b.version === to and every key of b deep-equals full[key];
        // the revert proves the whole delta exact (clauses, clarify, goldSet and the appended cues
        // included); b becomes the reverted lexicon projected onto b's keys, in b's key order.
        if (!isObj(a) || !isObj(b) || !isObj(p.full) || b.version !== delta.to) return [a, b];
        if (!Object.keys(b).every((k) => same(b[k], p.full[k]))) return [a, b];
        const r = revertLexiconDelta(p.full, delta);
        if (r === null) return [a, b];
        const proj = {};
        for (const k of Object.keys(b)) proj[k] = r[k];
        return [a, proj];
      }
      if (path === "/module/versions") {
        if (!isObj(a) || !isObj(b)) return [a, b];
        return b.lexicon === delta.to ? [a, { ...b, lexicon: delta.from }] : [a, b];
      }
      // /extract033/… capture arrays (0.3.2 side a, 0.3.3 side b): the evidence rule E first (every
      // b capture's evidence back to the whole text and its clause removed; refused unless every b
      // capture carries an exact clause), then the captures of every id an ad18Rules rule names
      // dropped from both sides; equal afterwards (key order included) with something changed →
      // [b, b]. Only for the shipped lexicon at the delta's `to` version.
      if (!Array.isArray(a) || !Array.isArray(b) || typeof p.text !== "string") return [a, b];
      if (!isObj(p.lexicon) || p.lexicon.version !== delta.to) return [a, b];
      if (!a.every(isObj) || !b.every(isObj) || same(a, b)) return [a, b];
      const b1 = ad18Unclause(p.text, a, b);
      if (b1 === null) return [a, b];
      const R = ad18Rules(p, a, b1);
      const ids = new Set(Object.values(R).flatMap((s) => [...s]));
      const a2 = a.filter((c) => !ids.has(c.id)), b2 = b1.filter((c) => !ids.has(c.id));
      return same(a2, b2) ? [b, b] : [a, b];
    },
    // input = {differs: boolean} — the raw (un-normalised) comparison showed a difference
    detector: (input) => !!(input && input.differs),
  },
  {
    id: "AD19",
    ready: true,
    owner: "rules (release 0.4.8)",
    what: "the clinical lead's question for item r_dur (chat, 2026-10-12): exactly the changed asks of tests/harness/question-delta-048.js (\"How long has this been going on?\" → \"Have symptoms persisted over 3 months despite trials of medical management?\"), in a Scribe suggestion or heard prompt of that item",
    // ctx.AD19 = {delta: QUESTION_DELTA}. Only at one suggestion or heard prompt object
    //   (…/rankSuggestions/<k> or …/heardPrompts/<k>) whose id is a changed row's item on both sides,
    //   whose baseline ask is that row's `from` and whose new ask is its `to`, and only when the
    //   question is the one difference (with the new side's ask put back to `from` the two are equal,
    //   tag, scale, kind and key order included): then the pair is excused whole. A malformed delta
    //   excuses nothing; any other item, question, field, direction or place stays a difference.
    appliesTo: (path, ctx) => !!(ctx && ctx.AD19) && /\/(?:rankSuggestions|heardPrompts)\/(?:0|[1-9]\d*)$/.test(path),
    normalise(a, b, ctx) {
      if (!isObj(a) || !isObj(b) || typeof a.id !== "string" || a.id !== b.id) return [a, b];
      const row = ad19Rows(ctx.AD19).find((r) => r.item === a.id);
      if (!row || a.ask !== row.from || b.ask !== row.to) return [a, b];
      // All or nothing: excused only when the question is the one difference (key order included).
      return same(a, { ...b, ask: row.from }) ? [a, a] : [a, b];
    },
    // input = {p: ctx.AD19, list: a baseline suggestion list} — it holds a changed row's item with
    // that row's `from` as its ask
    detector: (input) => {
      if (!input || !Array.isArray(input.list)) return false;
      const rows = ad19Rows(input.p);
      return input.list.some((s) => isObj(s) && rows.some((r) => r.item === s.id && r.from === s.ask));
    },
  },
  {
    id: "AD20",
    ready: true,
    owner: "patient / golden / render-patient (release 0.4.8)",
    what: "Spanish patient output (release 0.4.8, the clinical lead's request of 2026-10-12): the English version of the same findings added to the es summary — in the .txt the block [rule, the es and the English englishVersion titles upper-cased, rule, blank, the English caveat lines and a blank when the view has any (none for the built-in module), the English findings] right before the footer rule; on screen the English version section's text right before the disclaimer",
    // ctx.AD20 = {locale, block} for a .txt, or {locale, text, before} for rendered text (exactly one form):
    //   block        the exact inserted lines (ad20Block of the two titles, ad20EnglishNotices and
    //                ad20EnglishBody of the English .txt of the same answers): excused only when the new side holds them
    //                exactly once, as one run that ends right before its last footer rule, and they are
    //                removed there;
    //   text/before  the exact textContent of the English version section (the two titles, the English
    //                caveat lines and the English findings as the English companion renders them) and the text that must
    //                follow it (the locale's disclaimer): excused only when the new side holds
    //                text + before exactly once, and `text` is removed there.
    // Applies only where ctx.loc is the parameter's locale, never "en". List it right after AD4 and
    // before AD14, AD10 and AD16 (allow order is application order): it hands them the new side
    // without the English version, which the baseline never had. Nothing else is touched.
    appliesTo: (path, ctx) => !!ctx && ad20Usable(ctx.AD20) && typeof ctx.loc === "string" && ctx.loc === ctx.AD20.locale,
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const b2 = ad20Strip(ctx.AD20, b);
      return b2 === null ? [a, b] : [a, b2];
    },
    // input = {p: ctx.AD20, text: the new side} — it holds the English version where AD20 excuses it
    detector: (input) => !!input && ad20Usable(input.p) && typeof input.text === "string" && ad20Strip(input.p, input.text) !== null,
  },
  {
    id: "AD21",
    ready: true,
    owner: "render-scribe (release 0.4.8, follow-up)",
    what: "the Ambient Scribe's Question review tab (the clinical lead's request of 2026-10-12): one tab added to the view switch, right after Ask next and before Note, in the right card's text of the Safety, Ask-next and Note views",
    // ctx.AD21 = {text, before}: text is the exact textContent of the added tab (" Question review"),
    //   before the text that must follow it (the Note tab's, " Note"). Excused only when the new side
    //   holds text + before exactly once, right after the Ask next tab's text ("Ask next " and its
    //   count), and `text` is removed there. Only at …/view_safety, …/view_prompts and …/view_note.
    //   Nothing else is touched; list it before AD15 and AD5, which need the rest to match.
    appliesTo: (path, ctx) => !!ctx && ad21Usable(ctx.AD21) && /\/view_(?:safety|prompts|note)$/.test(path),
    normalise(a, b, ctx) {
      if (typeof a !== "string" || typeof b !== "string") return [a, b];
      const b2 = ad21Strip(ctx.AD21, b);
      return b2 === null ? [a, b] : [a, b2];
    },
    // input = {p: ctx.AD21, text: the new side} — it holds the tab where AD21 excuses it
    detector: (input) => !!input && ad21Usable(input.p) && typeof input.text === "string" && ad21Strip(input.p, input.text) !== null,
  },
];

// ---------------------------------------------------------------------------------------
// AD21 (release 0.4.8, follow-up): the Scribe's Question review tab
// ---------------------------------------------------------------------------------------

/** The Ask next tab's text as it ends the run before AD21's tab: "Ask next", its count, the trailing space. */
const AD21_AFTER_RE = /Ask next (?:\((?:0|[1-9]\d*)\))?$/;

function ad21Usable(p) {
  return isObj(p) && typeof p.text === "string" && p.text.trim() !== "" && typeof p.before === "string" && p.before.trim() !== "";
}

/** The new side without AD21's tab text, or null when it does not hold it exactly once where it belongs. */
function ad21Strip(p, b) {
  const needle = p.text + p.before;
  const i = b.indexOf(needle);
  if (i < 0 || b.indexOf(needle, i + 1) >= 0 || !AD21_AFTER_RE.test(b.slice(0, i))) return null;
  return b.slice(0, i) + b.slice(i + p.text.length);
}

/**
 * The exact .txt lines a non-English summary inserts for its English version (release 0.4.8): a
 * rule, the locale's title and the English title (both upper-cased as the .txt prints headings), a
 * rule, a blank line, then the English caveat lines `englishNotices` and a blank line when there are
 * any (ad20EnglishNotices of the English .txt of the same view; none for the built-in module), then
 * the English findings `englishBody` (ad20EnglishBody of the English .txt of the same answers).
 */
export function ad20Block(titleLoc, titleEn, englishBody, englishNotices = []) {
  const notes = Array.isArray(englishNotices) ? englishNotices : [];
  return [AD20_RULE, String(titleLoc).toUpperCase(), String(titleEn).toUpperCase(), AD20_RULE, "",
    ...(notes.length ? [...notes, ""] : []), ...(Array.isArray(englishBody) ? englishBody : [])];
}

/**
 * The caveat lines of an English Patient .txt (release 0.4.8, final review): its lines after the
 * footer line that follows its last footer rule, before the dated caveat line that closes it (the
 * patient provenance, edited-wording and stale-translation lines, AD10). [] when it has none; null
 * when the text has no footer rule or no dated last line.
 */
export function ad20EnglishNotices(txt) {
  if (typeof txt !== "string") return null;
  const lines = txt.split("\n");
  const end = lines.lastIndexOf(AD20_FOOTER_RULE);
  if (end < 0 || lines.length < end + 3 || !DATED_CAVEAT_RE.test(lines[lines.length - 1])) return null;
  return lines.slice(end + 2, -1);
}

/**
 * The findings of an English Patient .txt: its lines after the header (title, rule, blank, and the
 * unreviewed line with its blank when `unreviewed` names it) and before its last footer rule.
 * Null when the text has no footer rule.
 */
export function ad20EnglishBody(txt, { unreviewed = null } = {}) {
  if (typeof txt !== "string") return null;
  const lines = txt.split("\n");
  const start = unreviewed && lines[3] === unreviewed && lines[4] === "" ? 5 : 3;
  const end = lines.lastIndexOf(AD20_FOOTER_RULE);
  return end >= start ? lines.slice(start, end) : null;
}

function ad20Usable(p) {
  if (!isObj(p) || typeof p.locale !== "string" || !p.locale || p.locale === "en") return false;
  const block = Array.isArray(p.block) && p.block.length >= 6 && p.block.every((x) => typeof x === "string") && p.block[0] === AD20_RULE && p.block[3] === AD20_RULE && p.block[4] === "";
  const text = typeof p.text === "string" && p.text !== "" && typeof p.before === "string" && p.before !== "";
  return block !== text; // exactly one form
}

/** The new side without the English version AD20 names, or null when it does not hold it exactly once where it belongs. */
function ad20Strip(p, b) {
  if (Array.isArray(p.block)) {
    const lines = b.split("\n");
    const n = p.block.length;
    const at = [];
    for (let i = 0; i + n <= lines.length; i++) {
      let ok = true;
      for (let k = 0; k < n && ok; k++) ok = lines[i + k] === p.block[k];
      if (ok) at.push(i);
    }
    if (at.length !== 1 || lines.lastIndexOf(AD20_FOOTER_RULE) !== at[0] + n) return null;
    return [...lines.slice(0, at[0]), ...lines.slice(at[0] + n)].join("\n");
  }
  const needle = p.text + p.before;
  const i = b.indexOf(needle);
  if (i < 0 || b.indexOf(needle, i + 1) >= 0) return null;
  return b.slice(0, i) + b.slice(i + p.text.length);
}

/** The well-formed rows of AD19's delta ({item, from, to}, from ≠ to), or [] for a malformed delta. */
function ad19Rows(p) {
  const rows = isObj(p) && isObj(p.delta) && Array.isArray(p.delta.changed) ? p.delta.changed : null;
  if (!rows || !rows.length) return [];
  const ok = rows.every((r) => isObj(r) && typeof r.item === "string" && r.item && typeof r.from === "string" && typeof r.to === "string"
    && r.from.trim() && r.to.trim() && r.from !== r.to);
  return ok ? rows : [];
}

const AD_BY_ID = new Map(ALLOWED_DIFFERENCES.map((d) => [d.id, d]));

export function allowedDifference(id) {
  const d = AD_BY_ID.get(id);
  if (!d) throw new Error(`unknown allowed difference "${id}" (design §8.4 lists AD1-AD21)`);
  return d;
}

/** JSON-pointer token escaping (RFC 6901). */
export function pointerToken(key) {
  return String(key).replace(/~/g, "~0").replace(/\//g, "~1");
}

function kind(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (v instanceof Date) return "date";
  if (v instanceof Set) return "set";
  return typeof v;
}

function show(v) {
  if (typeof v === "function") return `[function ${v.name || "anonymous"}]`;
  if (v === undefined) return "[undefined]";
  if (typeof v === "number" && !Number.isFinite(v)) return `[number ${v}]`;
  if (v instanceof Set) return [...v];
  return v;
}

const MAX_DIFFS = 1000;

/**
 * @param {any} a  oracle value
 * @param {any} b  new value
 * @param {{allow?: string[], at?: string, keyOrder?: boolean, input?: any, ctx?: object}} [opts]
 *   keyOrder: also report objects whose own keys appear in a different order (path + "/@keys").
 *   input: the replayable input recorded on every Diff.
 *   ctx: the AD parameters, keyed by AD id.
 * @returns {{diffs: Array<{path: string, input: any, a: any, b: any}>, observed: Set<string>, truncated: boolean}}
 */
export function deepDiff(a, b, { allow = [], at = "", keyOrder = false, input = null, ctx = {} } = {}) {
  const ads = allow.map((id) => {
    const d = allowedDifference(id);
    if (!d.ready) throw new Error(`allowed difference ${id} has no normaliser yet (owner: ${d.owner}); it cannot be applied`);
    return d;
  });
  const diffs = [];
  const observed = new Set();
  let truncated = false;

  const push = (path, x, y) => {
    if (diffs.length >= MAX_DIFFS) { truncated = true; return; }
    diffs.push({ path, input, a: show(x), b: show(y) });
  };

  const walk = (x, y, path) => {
    if (truncated) return;
    for (const d of ads) {
      if (!d.appliesTo(path, ctx)) continue;
      const [x2, y2] = d.normalise(x, y, ctx, path);
      if (x2 !== x || y2 !== y) { observed.add(d.id); x = x2; y = y2; }
    }
    if (x === y) return;
    if (typeof x === "number" && typeof y === "number" && Number.isNaN(x) && Number.isNaN(y)) return;
    const kx = kind(x), ky = kind(y);
    if (kx !== ky) { push(path, x, y); return; }
    if (kx === "set") { walk([...x].sort(), [...y].sort(), path); return; }
    if (kx === "array") {
      if (x.length !== y.length) push(`${path}/length`, x.length, y.length);
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i++) walk(x[i], y[i], `${path}/${i}`);
      for (let i = n; i < x.length; i++) push(`${path}/${i}`, x[i], undefined);
      for (let i = n; i < y.length; i++) push(`${path}/${i}`, undefined, y[i]);
      return;
    }
    if (kx === "date") {
      if (x.getTime() !== y.getTime()) push(path, x.toISOString(), y.toISOString());
      return;
    }
    if (kx === "object") {
      // `undefined`-valued keys count as absent, as they would after JSON serialisation.
      const kxs = Object.keys(x).filter((k) => x[k] !== undefined);
      const kys = Object.keys(y).filter((k) => y[k] !== undefined);
      if (keyOrder) {
        const common = kxs.filter((k) => kys.includes(k));
        const commonY = kys.filter((k) => kxs.includes(k));
        if (common.join("\u0000") !== commonY.join("\u0000")) push(`${path}/@keys`, common, commonY);
      }
      const seen = new Set();
      for (const k of kxs) {
        seen.add(k);
        walk(x[k], y[k], `${path}/${pointerToken(k)}`);
      }
      for (const k of kys) if (!seen.has(k)) walk(undefined, y[k], `${path}/${pointerToken(k)}`);
      return;
    }
    // Different primitives, or two distinct functions.
    push(path, x, y);
  };

  walk(a, b, at);
  return { diffs, observed, truncated };
}

/** A line-by-line diff of two texts as Diff-ready entries (for long strings: notes, .txt exports). */
export function textLineDiff(a, b, { at = "", input = null, max = 20 } = {}) {
  const xs = String(a).split("\n"), ys = String(b).split("\n");
  const out = [];
  const n = Math.max(xs.length, ys.length);
  for (let i = 0; i < n && out.length < max; i++) {
    if (xs[i] !== ys[i]) out.push({ path: `${at}/line/${i + 1}`, input, a: xs[i] === undefined ? "[no line]" : xs[i], b: ys[i] === undefined ? "[no line]" : ys[i] });
  }
  return out;
}
