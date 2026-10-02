// engine/extraction.js — rule-based phrase extraction with the lexicon injected
// (design 03 §4.9). Owner: WP5.
//
// The matcher is the baseline extraction engine (Ext L172-300) moved verbatim, with the
// module-level phrase constants replaced by a `lexicon` argument (rubric.lexicon, §3.2):
//
//   baseline constant   lexicon key
//   NEGATION            negation      {window, cues}
//   THIRD_PARTY         thirdParty    {window, cues}
//   HISTORICAL          historical    {window, cues}
//   BOOL_EX             bool          [{id, ph, thirdPartyExempt?}]
//   CTX_EX              ctx           [{id, val, ph}]
//   SCALE_EX            scale         [{id, cue, bands:[{ph, v}], fallback}]
//   MULTI_EX            multi         [{ids:[{id, value, kind}], ph}]
//   RF_PHRASES          redFlags      {flagId: phrases}
//
// Nothing here branches on an id: every id comes from the lexicon. The pass order, the
// first-hit / all-hits choice per family, the gating order (third party, then historical)
// and the significance of band order are those of the baseline, so a module's captures are
// byte-identical to the baseline's for the same lexicon.
//
// Red flags are the one family that is never gated: a cue phrase raises the flag for
// clinician review and nothing in the text may lower one (no negation, attribution or
// history check). Every other capture is gated.
//
// Pure; no React; no import-time side effects.

/** What kind of extractor this is (Ext L25). */
export const EXTRACTOR_KIND = "rule-based / phrase-match with local negation";

const arr = (x) => (Array.isArray(x) ? x : []);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const NO_CUES = Object.freeze({ window: 0, cues: Object.freeze([]) });
const cueSpec = (x) => (isObj(x) && Array.isArray(x.cues) ? x : NO_CUES);

/** Index of the first phrase (in list order) found in `text`, case-insensitively; -1 if none (Ext L172-175). */
export function firstHit(text, phrases) {
  const low = text.toLowerCase();
  for (const p of phrases) { const i = low.indexOf(p); if (i !== -1) return i; }
  return -1;
}

/**
 * Every position any phrase matches, ascending (Ext L187-195). Scanning all hits and
 * preferring an unnegated one means a single unnegated mention is an affirmation regardless
 * of what else in the sentence is denied.
 */
export function allHits(text, phrases) {
  const low = text.toLowerCase();
  const out = [];
  for (const p of phrases) {
    let i = low.indexOf(p);
    while (i !== -1) { out.push(i); i = low.indexOf(p, i + p.length); }
  }
  return out.sort((a, b) => a - b);
}

/** Whether any cue of `spec` ({window, cues}) occurs in the `spec.window` characters before `idx` (Ext L197-200). */
export function cueBefore(text, idx, spec) {
  const pre = text.slice(Math.max(0, idx - spec.window), idx).toLowerCase();
  return spec.cues.some(c => pre.includes(c));
}

/**
 * Captures from one utterance (Ext L217-268, with the lexicon injected).
 * Returns [{ id, value, kind, evidence, cueIndex, suppressedBy? }].
 *   opts.negationWindow overrides the lexicon's window (the benchmark sweep);
 *   opts.includeSuppressed also returns matches suppressed by an attribution or history cue.
 * A missing lexicon captures nothing.
 */
export function extract(lexicon, text, opts = {}) {
  if (!isObj(lexicon) || typeof text !== "string") return [];
  const NEGATION = cueSpec(lexicon.negation);
  const THIRD_PARTY = cueSpec(lexicon.thirdParty);
  const HISTORICAL = cueSpec(lexicon.historical);
  const negatedNear = (t, idx, window = NEGATION.window) => cueBefore(t, idx, { window, cues: NEGATION.cues });
  const thirdPartyNear = (t, idx) => cueBefore(t, idx, THIRD_PARTY);
  const historicalNear = (t, idx) => cueBefore(t, idx, HISTORICAL);

  const win = opts.negationWindow ?? NEGATION.window;
  const keep = !!opts.includeSuppressed;
  const found = [];
  const push = (o) => found.push(o);
  const gated = (id, kind, i, value, exempt = {}) => {
    // An entry marked thirdPartyExempt is inherently about someone else (a family history),
    // so an attribution cue is the finding rather than a misattribution of it.
    if (!exempt.thirdParty && thirdPartyNear(text, i)) { if (keep) push({ id, value, kind, evidence: text, cueIndex: i, suppressedBy: "third-party" }); return; }
    if (historicalNear(text, i)) { if (keep) push({ id, value, kind, evidence: text, cueIndex: i, suppressedBy: "historical" }); return; }
    push({ id, value, kind, evidence: text, cueIndex: i });
  };

  // Red flags: no gating of any kind.
  for (const [id, ph] of Object.entries(isObj(lexicon.redFlags) ? lexicon.redFlags : {})) {
    const i = firstHit(text, arr(ph));
    if (i !== -1) push({ id, value: true, kind: "redflag", evidence: text, cueIndex: i });
  }

  for (const ex of arr(lexicon.bool)) {
    const hits = allHits(text, arr(ex.ph));
    if (!hits.length) continue;
    const unnegated = hits.find(i => !negatedNear(text, i, win));
    const i = unnegated ?? hits[0];
    gated(ex.id, "item", i, unnegated === undefined ? "no" : "yes",
          { thirdParty: !!ex.thirdPartyExempt });
  }

  for (const ex of arr(lexicon.ctx)) {
    const i = firstHit(text, arr(ex.ph));
    if (i === -1 || negatedNear(text, i, win)) continue;
    gated(ex.id, "ctx", i, ex.val);
  }

  for (const ex of arr(lexicon.scale)) {
    const i = firstHit(text, arr(ex.cue));
    if (i === -1 || negatedNear(text, i, win)) continue;
    let v = ex.fallback;
    for (const b of arr(ex.bands)) { if (firstHit(text, arr(b.ph)) !== -1) { v = b.v; break; } }
    if (v === null || v === undefined) continue;
    gated(ex.id, "item", i, v);
  }

  for (const ex of arr(lexicon.multi)) {
    const i = firstHit(text, arr(ex.ph));
    if (i === -1 || negatedNear(text, i, win)) continue;
    for (const t of arr(ex.ids)) gated(t.id, t.kind, i, t.value);
  }

  return found;
}

/**
 * An extractor bound to one lexicon: `extract(text, opts)`, `negatedNear(text, idx, window)`
 * (default window = the lexicon's negation window, Ext L202-203) and `lexiconVersion`.
 */
export function createExtractor(lexicon) {
  const lex = isObj(lexicon) ? lexicon : null;
  const NEGATION = cueSpec(lex && lex.negation);
  return {
    extract: (text, opts = {}) => extract(lex, text, opts),
    negatedNear: (text, idx, window = NEGATION.window) => cueBefore(text, idx, { window, cues: NEGATION.cues }),
    lexiconVersion: lex && typeof lex.version === "string" ? lex.version : null,
  };
}

/**
 * FAERS adapter (Ext L285-300, verbatim): maps openFDA adverse-event records (an array or
 * `{results}`) onto benchmark utterances. A declared interface, not a validated one.
 */
export function faersToUtterances(records) {
  const arr = Array.isArray(records) ? records : (records?.results ?? []);
  return arr.flatMap(rec => {
    const id = rec.safetyreportid ?? rec.safetyReportId ?? null;
    const texts = [];
    for (const r of rec.patient?.reaction ?? []) {
      if (r.reactionmeddrapt) texts.push(r.reactionmeddrapt);
    }
    if (rec.narrativeincludeclinical) texts.push(rec.narrativeincludeclinical);
    return texts.filter(Boolean).map((text, k) => ({
      utteranceId: id ? `faers-${id}-${k}` : `faers-anon-${k}`,
      register: "narrative",
      speaker: "reporter",
      text: String(text),
    }));
  });
}
