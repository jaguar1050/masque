// tests/harness/matrix.js — the §8.5 sweeps and matrices, shared by the sweep, rules, probes
// and patient suites (design 03 §8.5). No imports; nothing happens at import time.
//
// Every generator takes the instrument description from the BASELINE oracle (Screener ITEMS
// and DOMAIN_ORDER, RED_FLAGS, Patient CONTEXT_Q …), never from the module under test, so a
// module that dropped an item cannot shrink its own test matrix. Every draw comes from the
// seeded mulberry32 stream `rng` (h.rng(h.seed)), in a fixed order, so a run is replayable
// from its seed and every Diff carries the replayable input itself.

/** Sizes of the acceptance run and of ?quick=1 (§8.5). */
export const SIZES = {
  full: { scoring: 50000, hookScoring: 2000, rules: 20000, patient: 20000, probes: 50000, extraction: 5000 },
  quick: { scoring: 5000, hookScoring: 1000, rules: 2000, patient: 2000, probes: 5000, extraction: 1000 },
};
export const sizes = (quick) => (quick ? SIZES.quick : SIZES.full);

/** Unanswered probabilities of the five scoring strata (§8.5). */
export const STRATA = [0, 0.15, 0.3, 0.6, 1.0];

/** Flatten the baseline Screener ITEMS into [{id, w, scale, domain, negative}] in DOMAIN_ORDER. */
export function flatItems(ITEMS, DOMAIN_ORDER) {
  return DOMAIN_ORDER.flatMap((k) => ITEMS[k].items.map((it) => ({ ...it, domain: k, negative: !!ITEMS[k].negative })));
}

const pickIdx = (rng, n) => Math.min(n - 1, Math.floor(rng() * n));
export const pick = (rng, xs) => xs[pickIdx(rng, xs.length)];

/** One answer for an item: "yes"/"no" uniform, or a uniform scale index. */
export function drawAnswer(rng, it) {
  return it.scale ? pickIdx(rng, it.scale.length) : (rng() < 0.5 ? "yes" : "no");
}

/** One answer set: each item unanswered with probability pUnanswered. */
export function drawAnswers(rng, items, pUnanswered) {
  const a = {};
  for (const it of items) {
    const skip = rng() < pUnanswered;
    const v = drawAnswer(rng, it);
    if (!skip) a[it.id] = v;
  }
  return a;
}

const maxAnswer = (it) => (it.scale ? it.scale.map((s) => s.f).indexOf(Math.max(...it.scale.map((s) => s.f))) : "yes");
const minAnswer = (it) => (it.scale ? it.scale.map((s) => s.f).indexOf(Math.min(...it.scale.map((s) => s.f))) : "no");

/**
 * The §8.5 scoring edge cases: the sample answer sets given, empty, all-max, all-min, only the
 * negative domain answered (all "yes"), and everything but one negative item (one per item).
 */
export function edgeAnswerSets(items, samples = []) {
  const out = [];
  for (const s of samples) out.push({ label: `sample:${s.label}`, answers: { ...s.answers } });
  out.push({ label: "empty", answers: {} });
  out.push({ label: "all-max", answers: Object.fromEntries(items.map((it) => [it.id, maxAnswer(it)])) });
  out.push({ label: "all-min", answers: Object.fromEntries(items.map((it) => [it.id, minAnswer(it)])) });
  const neg = items.filter((it) => it.negative);
  out.push({ label: "negative-domain-only", answers: Object.fromEntries(neg.map((it) => [it.id, maxAnswer(it)])) });
  for (const left of neg) {
    const a = Object.fromEntries(items.map((it) => [it.id, maxAnswer(it)]));
    delete a[left.id];
    out.push({ label: `all-but:${left.id}`, answers: a });
  }
  return out;
}

/**
 * The scoring stream: `n` answer sets in five equal strata (§8.5), then the edge cases.
 * Yields {label, stratum, answers}.
 */
export function* scoringStream(rng, items, n, samples = []) {
  const per = Math.ceil(n / STRATA.length);
  let i = 0;
  for (let s = 0; s < STRATA.length; s++) {
    for (let k = 0; k < per && i < n; k++, i++) yield { label: `s${s}#${k}`, stratum: STRATA[s], answers: drawAnswers(rng, items, STRATA[s]) };
  }
  for (const e of edgeAnswerSets(items, samples)) yield { label: e.label, stratum: null, answers: e.answers };
}

/** Red flags: none with p .8, one random flag .15, two distinct flags .05 (§8.5). */
export function drawFlags(rng, flagIds) {
  const r = rng();
  const rf = {};
  if (r >= 0.8) {
    const first = pick(rng, flagIds);
    rf[first] = true;
    if (r >= 0.95) rf[pick(rng, flagIds.filter((id) => id !== first))] = true;
  }
  return rf;
}

/**
 * The §8.5 rules matrix, drawn from the scoring stream. Each state:
 *   complaint ∈ {"", ...phenotypeValues} uniform; each context item unanswered p .2, otherwise a
 *   uniform option value; rf: none .8 / one random flag .15 / two .05; safetyReviewed p .8;
 *   Scribe skipped: each item p .1; vmp: each info prompt undefined / "yes" / "no" / "skip".
 * @param {{items, contextOptions: Object<string,string[]>, flagIds: string[], phenotypeValues: string[],
 *          infoIds: string[], samples?: Array}} spec
 */
export function* ruleStream(rng, spec, n) {
  const complaints = ["", ...spec.phenotypeValues];
  const scoring = scoringStream(rng, spec.items, n, spec.samples || []);
  for (const s of scoring) {
    const complaint = pick(rng, complaints);
    const ctx = {};
    for (const [id, opts] of Object.entries(spec.contextOptions)) {
      const skip = rng() < 0.2;
      const v = pick(rng, opts);
      if (!skip) ctx[id] = v;
    }
    const rf = drawFlags(rng, spec.flagIds);
    const safetyReviewed = rng() < 0.8;
    const skipped = {};
    for (const it of spec.items) if (rng() < 0.1) skipped[it.id] = true;
    const vmp = {};
    for (const id of spec.infoIds || []) {
      const v = pick(rng, [undefined, "yes", "no", "skip"]);
      if (v !== undefined) vmp[id] = v;
    }
    yield { label: s.label, answers: s.answers, complaint, ctx, rf, safetyReviewed, skipped, vmp };
  }
}

/**
 * The §8.5 Patient matrix: each item undefined .15 / "unsure" .10 / a value .75; each context
 * item unanswered p .2 or a uniform Patient-vocabulary value; red flags as in the rules matrix;
 * loc ∈ {en, es}.
 * @param {{items, contextOptions: Object<string,string[]>, flagIds: string[], locales: string[]}} spec
 */
export function* patientStream(rng, spec, n) {
  for (let i = 0; i < n; i++) {
    const a = {};
    for (const it of spec.items) {
      const r = rng();
      const v = drawAnswer(rng, it);
      if (r < 0.15) continue;
      a[it.id] = r < 0.25 ? "unsure" : v;
    }
    const ctx = {};
    for (const [id, opts] of Object.entries(spec.contextOptions)) {
      const skip = rng() < 0.2;
      const v = pick(rng, opts);
      if (!skip) ctx[id] = v;
    }
    const rf = drawFlags(rng, spec.flagIds);
    const loc = pick(rng, spec.locales);
    yield { label: `p#${i}`, a, ctx, rf, loc };
  }
}
