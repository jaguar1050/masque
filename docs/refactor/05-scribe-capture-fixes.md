# 05 — Scribe capture fixes (F1 heard, F2 carry-over, F4 yield; F3 mechanism): final design

**Prototype · not for clinical use.** This is the build specification. Implementers work from it
without further discussion. No clinical content ships until the clinical lead approves it row by
row: the phrases, anchors and refusal words, the two `v_vertigo` flags in §3.6, and the F1 wording
in §2.1.

**Approved 4 October 2026.** §11 is the approval record. It **supersedes Appendix A** (no Appendix
A draft is approved unless §11.3 lists it verbatim), resolves every open question of §9, and adds
the lead's extras (negation and third-party cue appends, and the `normalize` feature). Where §11
and an earlier section differ, §11 wins.

**Round 2, 4 October 2026.** §12 records the fixes made after the adversarial review of the first
implementation (commit 26464c5) and three further clinical-lead decisions. Where §12 and any
earlier section, §11 included, differ, §12 wins. Earlier sections carry a short "Round 2" pointer
where they are affected; their original text is kept as the record of round 1.

**Round 3, 5 October 2026.** §13 makes every round-2 rule removal-only (it may withhold a value,
never cause a different one, and withholding never opens a path for a later wrong value) and
implements lead decision L1 at sentence scope. Where §13 and any earlier section, §11 and §12
included, differ, §13 wins. Affected earlier sections carry a short "Round 3" pointer.

**Round 3b, 5 October 2026.** §13.10 adds the yield-only slot. It replaces the round-3 rule that a
withheld utterance closes an open slot, which had removed the yield that F4 relies on. Where §13.10
and any other section differ, §13.10 wins. Affected sections carry a short "Round 3b" pointer.

This design merges `design-candidates/05-candidate-minimal.md` and
`design-candidates/05-candidate-robust.md` (moved there from `docs/refactor/` unchanged). Section
10 lists the claims in both candidates that turned out to be wrong.

---

## 0. Summary

### 0.1 The fault

The clinical lead reported a failure, which we reproduced on the deployed code. The patient said
"I'm feeling really dizzy", then "as if the world is moving around me and I'm sitting still". The
transcript was correct, but nothing was captured.

`v_vertigo` is a scale entry with `fallback: null`. Extraction runs one utterance at a time. When
the cue matches and no band phrase does, `app/src/engine/extraction.js` L118 (`if (v === null ||
v === undefined) continue;`) drops the match without any signal. Follow-up replies such as "a few
hours" carry no cue, so they also extract nothing. Separately, `m_dur` (the duration of an
untreated headache attack) fires on any "lasts … couple of hours".

### 0.2 What ships

**Engine (`app/src/engine/extraction.js`)**
- One pure per-utterance function, `extract`, gains two opt-in options:
  - `includeHeard`;
  - `pendingIds`.
- One new pure function, `extractInContext(lexicon, text, pending)`, returns
  `{captures, pending, carry}`.
- The engine branches on no item id.

**Lexicon fields.** All are optional module data. Each is validated (§5), round-trips unchanged
through the editor, and has no effect when absent:

| Field | Feature | Meaning |
|---|---|---|
| `scale[i].heard: true` | F1 | Show the cue when it is heard without a value. |
| `scale[i].carry: 1–3` | F2 | Let that many following patient replies supply the value. |
| `scale[i].yieldTo: [ids]` + `scale[i].anchor: [phrases]` | F4 | Capture nothing when another entry is named, unless an anchor is present. |
| `lexicon.carryRefuse: [phrases]` | F2 guard | Replies that may never supply a carried value. |

**Capture kinds**
- New kind `"heard"`: it carries no value and never sets an answer.
- Carry-over results are ordinary item captures with `via: "carry"`, so first-write-wins still
  applies.

**Scribe UI**
- A dashed heard tag on the transcript bubble.
- A "Heard" group in Ask next. It sits after the safety probes and before the re-ask probes and
  everything else.
- A carry tag ("follow-up to “dizzy”") on the reply that supplied the value.

**Versions**

| Axis | Change |
|---|---|
| Lexicon | 0.3.1 → **0.3.2** |
| Gold set | 0.2.0 → **0.3.0** |
| Release `APP_VERSION` | 0.4.0 → **0.4.1** |
| Instrument | 0.2, unchanged |
| Probe set | 1.0.0, unchanged |
| `EXTRACTOR_KIND` | unchanged |
| `EXTRACTOR_FEATURES` | new |

### 0.3 What was verified

All behaviour tables in this document (§3.7, §4.4) were produced on 2026-10-04 by a throwaway
prototype of §1, §3 and §4. The prototype lived in the scratchpad and was not committed. It ran in
a browser against the committed rubric.

- **Inert without the new fields.** Before any new field was added, the prototype matched the
  shipped `extract()` byte for byte. That was 80,208 comparisons: 44 gold utterances, 8 demo
  patient turns and 20,000 synthetic utterances, each under 4 option sets. On the same lexicon,
  `extractInContext(lex, t, null).captures` deep-equalled `extract(lex, t)` every time.
- **F1/F2/F4 configuration (no F3 phrases).** The 44 v0.2.0 gold cases (× 4 option sets) and the
  20,000 synthetic utterances show **0 changes** in `extract()` output. The 8 demo patient turns
  give identical item, ctx and red-flag captures. The only addition is one heard `v_vertigo` on
  demo line 7 ("…really dizzy too — kind of spinning … lasts a while."). Demo scoring is therefore
  unchanged.

### 0.4 What was taken from each candidate

**Base: the minimal candidate.** From it:
- per-entry opt-in with no global default;
- a single pending slot, held in a ref;
- `.prompt` heard cards carrying `data-suggestion`, so the existing render-scribe behaviour helpers
  keep working;
- render parity run on the 0.3.1-equivalent lexicon, with zero new render normalisation;
- one exact lexicon delta behind a new AD13;
- the rule that a reply containing the pending item's own cue never carries.

**Grafted from the robust candidate:**
- `yieldTo` + `anchor`: the target's presence ignores negation, and the anchor must be unnegated;
- `pendingIds`, so a pending item counts as present for the yield;
- the broad "other entry" guard (any lexicon topic phrase blocks a carry);
- band selection with contained-span removal and an ambiguity refusal;
- the `?`/`¿` guard;
- no arming when the heard cue sits inside another entry's phrase;
- refusal codes;
- an `answersRef` mirror;
- heard tags that are not `captag`;
- `EXTRACTOR_FEATURES`;
- the delta data in its own harness file.

**New in this synthesis:**
- `heard` as a flag separate from `carry`;
- arming from the set of *all* unresolved cues, so an `m_dur` "lasts forever" with no `heard` flag
  still blocks misattribution;
- `carryRefuse` for "a few hours ago";
- a validator ban on carry for entries whose band can record an f = 0 (negative) option;
- skipped items are never carried;
- a deletion exemption in `lockViolations`;
- a staged-landing-tolerant `revertLexiconDelta`;
- a new `capture` suite.

---

## 1. Capture shapes and ingestion

### 1.1 Existing captures (unchanged)

```js
{ id, value, kind: "item" | "ctx" | "redflag", evidence, cueIndex, suppressedBy? }
```

### 1.2 New kind `"heard"` (F1)

`app/src/engine/vocab.js`:

```js
export const CAPTURE_KIND = { ITEM: "item", CTX: "ctx", REDFLAG: "redflag", HEARD: "heard" };
```

Shape. Key order is fixed. There is **no `value` key**.

```js
{ id, kind: "heard", evidence, cueIndex, cue, cueText, suppressedBy? }
//   cue      the matched lexicon phrase (lowercase, as in the lexicon)
//   cueText  text.slice(cueIndex, cueIndex + cue.length): the patient's own casing, for display
```

`extract()` emits a heard capture for scale entry `e` only when **all** of these hold:

1. `opts.includeHeard === true`. The default call never emits one.
2. `e.heard === true` (module data, §3.6).
3. The cue test opens the entry, exactly as today: the first cue hit in list order is not negated
   within the window.
4. The entry does not yield in this utterance (§4.3).
5. No band phrase matched, and `e.fallback` is `null` or `undefined`. This is the current L118
   branch. The item stays unanswered, and no fallback is ever substituted.
6. The third-party and historical gates pass at the cue index (`gated()` semantics). With
   `includeSuppressed`, a gated heard capture is returned with `suppressedBy`, like any other
   capture.

### 1.3 Carry-over result (F2)

`extractInContext` produces it. It is an ordinary item capture plus provenance:

```js
{ id, value, kind: "item", evidence /* the reply */, cueIndex /* band start in the reply */,
  via: "carry", band /* the band phrase matched */,
  carriedFrom: { cue, cueText, evidence /* the earlier utterance */, cueIndex } }
```

### 1.4 `ingestCaptures` (`engine/scribe.js` L35-46): body unchanged, rules pinned

| kind | effect |
|---|---|
| `item`, including `via: "carry"` | First write wins (`if (a[id] === undefined) a[id] = value`). A carry never overwrites an answer, including one written earlier in the same batch. It is in `touchedDomainItemIds`, so the domain bar pulses. |
| `ctx` | Overwrite (unchanged). |
| `redflag` | Raise-only, recorded as `"nlp"` (unchanged). |
| `heard` | **Ignored.** Never written to `answers`, `ctx` or `rf`, and not in `touchedDomainItemIds`. |

The return shape stays `{answers, ctx, rf, touchedDomainItemIds}`.

The JSDoc gains one line: `heard: a cue heard without its value — never an answer (absent stays
absent); ignored here.`

No other consumer of captures exists:
- the note, bundle, cohort row, `onScreen` payload, score and Patient app read `answers` only;
- the transcript is never exported.

So heard data cannot reach any output.

---

## 2. F1 user interface

### 2.1 Wording

The engine owns only the words "heard", "not stated" and "follow-up to". Every clinical word comes
from module data: the item's `short` label, its scale option label, its `ask` or `text`, its `tag`.
The quoted word is the patient's own `cueText`. Quotes are typographic (“ ”, UTF-8).

| Surface | Exact text (MASQUE example) | Source |
|---|---|---|
| Bubble heard tag | `heard “dizzy” · episode duration: not stated` | `heardLabel(module, c)` |
| Interim heard tag | `? heard “dizzy” · episode duration: not stated` | `"? " + heardLabel` |
| Carry tag on the reply bubble | `+ episode duration: 5 min – 72 h · follow-up to “dizzy”` | `"+ " + captureLabel(module, c)` |
| Interim carry tag | `? episode duration: 5 min – 72 h · follow-up to “dizzy”` | `"? " + captureLabel` |
| Heard group caption | `Heard · named by the patient, value not stated — nothing is recorded until it is answered` | Scribe.jsx constants (engine chrome) |
| Heard card tag line | `VM-PATHI · disequilibrium · heard “dizzy”` | `s.tag + " · heard “" + s.cueText + "”"` |
| Heard card question | `When the spinning or imbalance comes, how long does one episode last?` | `item.ask ?? item.text` |

New and changed functions in `app/src/engine/scribe.js`:

```js
/** "heard “<cueText>” · <itemShort>: not stated". Without cueText: "heard · <itemShort>: not stated".
 *  An unknown id shows the id in place of the short label. */
export function heardLabel(module, capture)

// captureLabel(module, capture): two branches are added before the existing logic. The
// item/ctx/redflag outputs are unchanged (the rules suite still compares them with baseline capLabel).
//   c.kind === CAPTURE_KIND.HEARD → return heardLabel(module, c)
//   c.via === "carry"             → return <existing item label> + " · follow-up to “" + from + "”"
//       where from = c.fromCueText ?? c.carriedFrom?.cueText (stored transcript tag or engine
//       capture); when from is not a string, the suffix is " · follow-up"
```

`kindOf` is unchanged. The heard branch returns before it is reached.

### 2.2 Transcript bubble (`apps/Scribe.jsx`)

Stored transcript tags (`caps` on a line) are built by one helper, `toTag(c)`:

- heard: `{ id, kind: "heard", cueText }`;
- carry: `{ id, value, kind: "item", via: "carry", fromCueText: c.carriedFrom.cueText }`;
- anything else: `{ id, value, kind }`, as today.

Rendering inside the existing `.cap` row:

```jsx
{m.caps.map((c, i) => c.kind === CAPTURE_KIND.HEARD
  ? <span className="sa-scribe-heardtag" key={i} data-heard={c.id}
          title={module.itemById[c.id] ? module.itemById[c.id].text : undefined}>{captureLabel(module, c)}</span>
  : <span className="captag" key={i}>+ {captureLabel(module, c)}</span>)}
```

- A heard tag is **not** `captag`. The render suites' `.tsc .captag` therefore still means "things
  captured", and the tag has no "+" because nothing was added to the record.
- Tag order follows capture order: red flags, bool, ctx, scale (heard sits here), multi, then the
  carry capture last.
- **The bubble tag is permanent for its line.** It records what that utterance contained, so it
  stays after the item is later answered.
- **A heard capture for an item already answered at ingest time is dropped before storing.** It is
  never shown, and it never arms carry, because "not stated" next to an answer on record would
  mislead.

CSS goes in `SCRIBE_EXTRA_CSS`, which is already scoped by `scopeCss(…, ".sa-scribe")`.
`SCRIBE_CSS` stays as moved, unedited.

```css
.sa-scribe-heardtag{background:#fff;border:1px dashed var(--amber);border-radius:6px;padding:2px 6px;color:#7A4E12}
.sa-scribe-heardtag.pending{opacity:.72}
.prompt.sa-scribe-heard{border-left-style:dashed}
```

### 2.3 Interim (live) preview

```js
const previewCaps = useMemo(() => (interim && speaker === "pt" && extractor)
  ? extractor.extractInContext(interim, livePending()).captures
      .filter(c => !(c.kind === CAPTURE_KIND.HEARD && answersRef.current[c.id] !== undefined)).map(toTag)
  : [], [interim, speaker, extractor, answers, skipped]);
```

- The returned `pending` is **discarded**. Interim text never arms, decrements or clears carry
  state, and nothing is written until the recogniser commits the segment (the existing rule).
- Rendering:
  - heard → `<span className="sa-scribe-heardtag pending">? {captureLabel}</span>`;
  - other captures, carry included → `<span className="captag pending">? {captureLabel}</span>`.
- A physician-speaker interim shows no preview, as today.

### 2.4 Ask next: promotion and order

**Engine helpers (`app/src/engine/scribe.js`)**

```js
/**
 * Heard prompts: one per heard item id that is an item of the module, unanswered and not skipped,
 * in the order given (most recently heard first), deduplicated by id.
 * HeardPrompt = {id, ask, tag, scale, kind: "heard", cueText}. ask/tag/scale are built exactly as
 * for a scored suggestion (a private helper shared with rankSuggestions: ask = item.ask ?? item.text;
 * tag = item.tag || domain.shortTag || domain.label lowercased). Domain activity and scorability
 * are NOT consulted: the patient raised it.
 * @param heard [{id, cueText}]   newest first
 */
export function heardPrompts(module, { heard = [], answers = {}, skipped = {} } = {})

/**
 * Ask-next sections in render order: every probe group whose PROBE_KIND rank is 0 (the safety
 * tier), then the heard prompts (only when non-empty), then every other probe group in the
 * truncateProbes order. With no rank-0 group the heard section comes first.
 * @returns Array<{kind: "probes", group} | {kind: "heard", items: HeardPrompt[]}>
 */
export function askNextSections(probeGroups = [], heard = [])

// rankSuggestions(module, {…existing…, exclude = []}): ids in `exclude` are removed from the
// open pool before sorting and slicing, so the list still fills to infoPrompts.maxScored. The
// return shape is unchanged ({list, error}). With exclude [] (the default) the output is identical
// (the rules suite compares .list with the baseline slice).
```

**Final order inside `data-testid="scribe-prompts"`, most urgent first**

1. The empty-state message, only when **both** `suggestions` and heard prompts are empty. The
   strings are unchanged.
2. **Safety** probe groups (rank 0), untruncated. Safety always comes first: a heard symptom never
   pushes down a question that could surface a red flag.
3. **Heard** group, `data-testid="scribe-heard"`, untruncated.
4. **Re-ask (rescue)** probes. They stay untruncated and are never retired through a target, so
   every live rescue still renders. For MASQUE, `pr_internal_vertigo` (which rescues `v_vertigo`)
   sits directly below the heard `v_vertigo` card.
5. Criteria, rule-out, supporting and exam probes, truncated to two as today.
6. Ranked suggestions (`rankSuggestions(…, {exclude: heard ids})`), so a heard item appears once.
7. Routing recommendations (the gate is unchanged).

**Markup.** The probe wrapper renders when `probeGroups.length > 0 || heardPromptList.length > 0`.
It keeps `style={{marginBottom:12}} data-testid="scribe-probes"`. Inside it,
`askNextSections(probeGroups, heardPromptList)` is mapped:
- a probe section renders the **existing** group JSX unchanged;
- the heard section renders:

```jsx
<div key="heard" data-testid="scribe-heard">
  <div className="qtag" style={{color:"var(--amber)",margin:"10px 0 4px"}}>{HEARD_LABEL}{HEARD_CAPTION}</div>
  {heardPromptList.map(s => (
    <div className="prompt sa-scribe-heard" key={s.id} data-suggestion={s.id} data-heard={s.id}>
      <div className="qtag"><HelpCircle size={11} /> {s.tag} · heard “{s.cueText}”</div>
      <div className="qq">{s.ask}</div>
      <div className="prow">
        {/* the same buttons as a scored suggestion: scale options, or Yes/No; then Skip */}
        <button className="pbtn skip" onClick={() => skipPrompt(s)} data-testid="scribe-skip">Skip</button>
      </div>
    </div>))}
</div>
```

Constants in Scribe.jsx:
- `HEARD_LABEL = "Heard"`;
- `HEARD_CAPTION = " · named by the patient, value not stated — nothing is recorded until it is answered"`.

The heard card **is** a `.prompt` with `data-suggestion` and **no inline `borderLeft`**. This is
deliberate:
- `complete()` and the skip block in `render-scribe.js` select `.prompt[data-suggestion]`, so they
  keep working on the shipped module and can answer or skip the heard item;
- the parity driver runs on the 0.3.1-equivalent lexicon (§7.3), where no heard card can exist.

**Buttons**
- `answerPrompt(s, value)` is unchanged. Kind `"heard"` takes the existing non-info branch, which
  writes `answers` and `asked`.
- `skipPrompt(s)` is unchanged. Kind `"heard"` takes the non-info branch, which writes `skipped`.
- Every scale option is offered, including the f = 0 option. That is a clinician's explicit answer,
  which the engine neither pre-selects nor hides.

**The view button.** It reads `Ask next (n)`, where `n = suggestions.length +
heardPromptList.length`, shown only when `n > 0`.

### 2.5 Heard state: where it lives and when it clears

There is no new React state. The heard list is derived from the transcript:

```js
const heardItems = useMemo(() => {            // newest first, one per id
  const seen = new Set(), out = [];
  for (let k = transcript.length - 1; k >= 0; k--)
    for (const c of transcript[k].caps)
      if (c.kind === CAPTURE_KIND.HEARD && !seen.has(c.id)) { seen.add(c.id); out.push({ id: c.id, cueText: c.cueText }); }
  return out;
}, [transcript]);
const heardPromptList = useMemo(() => heardPrompts(module, { heard: heardItems, answers, skipped }), [module, heardItems, answers, skipped]);
// rankSuggestions(module, {answers, complaint, phenotypeError, vmp, scorable, skipped,
//                          exclude: heardPromptList.map(s => s.id)})
```

| Event | Heard prompt (Ask next) | Bubble tag | Pending carry slot |
|---|---|---|---|
| Item answered by any route (capture, carry, heard or suggestion button, probe option) | hidden on the next render (filtered by `answers`) | stays | dropped at the next ingest (`livePending`) |
| Skip on the heard card (or on the item's suggestion) | hidden; a later heard of the same item does **not** re-promote it (Q8) | stays | dropped; a skipped item is never carried (§3.4) |
| Carry window expires | **stays.** The item is still unanswered and worth asking | stays | gone |
| Reset | gone (transcript emptied) | gone | `pendingRef.current = null` |
| Module change | gone (the workspace remounts; plus a defensive `useEffect(() => { pendingRef.current = null; }, [module])`) | gone | null |

`dirtySummary` is unchanged. The transcript lines already mark the encounter dirty.

---

## 3. F2 carry-over

### 3.1 State

```js
/** @typedef {{id:string, cue:string, cueText:string, evidence:string, cueIndex:number, turnsLeft:number}} PendingCue */
```

**Round 3b (§13.10):** `PendingCue` gains an optional boolean `yieldOnly`. A slot with
`yieldOnly: true` feeds the yield but never carries.

There is **one slot**, held in the Scribe as `const pendingRef = useRef(null)`.
- It is a ref, not state: it never renders by itself, because the heard tag and card are derived
  from the transcript.
- Voice callbacks reach the current `ingest` through `ingestRef`, so the slot is read and written
  synchronously even for back-to-back voice finals.

### 3.2 Engine API (`app/src/engine/extraction.js`, pure)

```js
import { LEXICON_CARRY_MAX } from "./contract.js";

export const EXTRACTOR_KIND = "rule-based / phrase-match with local negation";   // unchanged, still pinned
/** The lexicon fields this extractor honours beyond the baseline's (printed by the benchmark). */
export const EXTRACTOR_FEATURES = Object.freeze(["scale.heard", "scale.carry", "scale.yieldTo", "scale.anchor", "carryRefuse"]);

/**
 * extract(lexicon, text, opts): unchanged contract, plus two opt-in options. While both are absent,
 * the output for a lexicon without yieldTo is byte-identical to today's.
 *   opts.includeHeard  emit heard captures (§1.2)
 *   opts.pendingIds    ids treated as present for yieldTo (the item awaiting a value, §4.3)
 */
export function extract(lexicon, text, opts = {})

/**
 * One PATIENT utterance in the context of a cue heard earlier without its value. Pure: never
 * mutates lexicon, pending or opts; the same inputs give the same output. includeSuppressed is
 * not supported here (ignored).
 * @param {PendingCue|null} pending
 * @param {{negationWindow?:number}} [opts]
 * @returns {{captures:Object[], pending:(PendingCue|null), carry:{applied:boolean, refused:(null|string)}}}
 *   refused ∈ "answered" | "own-cue" | "other-entry" | "question" | "refuse-phrase" | "no-band" |
 *             "negated" | "ambiguous" | "third-party" | "historical"   (null when nothing was pending)
 */
export function extractInContext(lexicon, text, pending = null, opts = {})

// createExtractor(lexicon) gains
//   extractInContext: (text, pending = null, opts = {}) => extractInContext(lex, text, pending, opts)
```

**Implementation shape.** `extract` becomes a thin wrapper over a private
`scan(lexicon, text, opts) → {captures, unresolved, yielded}`.
- `scan` is today's body (same pass order, first-hit and all-hits choices, gating, and
  significance of band order), with the §1.2 heard emission and the §4.3 yield step added to the
  scale loop.
- `unresolved` is every scale entry, **whatever its `heard` flag**, whose cue opened, did not
  yield, found no band, has no fallback, and passed the gates: `[{id, cueIndex, cue}]`.
- `yielded` lists the ids that yielded.
- `extract = isObj(lexicon) && typeof text === "string" ? scan(...).captures : []`.

The cue phrase comes from a private `firstHitPhrase(text, phrases) → {i, phrase} | null`. It uses
the same list order as `firstHit`, and `firstHit` itself is unchanged.

Private helper `topicSpans(lexicon, text, excludeId, excludeScale)` returns `[{start, end}]` for
every occurrence, regardless of negation or gating, of every phrase in:
- `bool[].ph`, `ctx[].ph`, `multi[].ph` and every `redFlags` list;
- the `cue` list of every scale entry `e` with `e.id !== excludeId && !excludeScale(e)`.

Band lists and the negation/third-party/historical cue lists are **not** topics.

### 3.3 `extractInContext` algorithm (exact)

Definitions:
- `E(id)` is the first scale entry with that id.
- `carryOf(e)` is `e.carry` when `e.heard === true && Number.isInteger(e.carry) && 1 <= e.carry <= LEXICON_CARRY_MAX`, else 0.
- `win = opts.negationWindow ?? lexicon.negation.window`.
- `low = text.toLowerCase()`.

**Step 0. Guards.** If `lexicon` is not an object, `text` is not a string, or `!text.trim()`,
return `{captures: [], pending, carry: {applied: false, refused: null}}`. The input `pending` is
returned unchanged, so a blank voice final consumes nothing.

**Step 1. Validate the slot.** Set `p = pending` only when it is an object, `carryOf(E(p.id)) > 0`
and `Number.isInteger(p.turnsLeft) && p.turnsLeft > 0`. Clamp
`p.turnsLeft = min(p.turnsLeft, carryOf(E(p.id)))` on a copy. Otherwise `p = null`.

**Step 2. Scan.** `s = scan(lexicon, text, {negationWindow: win, includeHeard: true, pendingIds: p ? [p.id] : []})`, then `caps = s.captures.slice()`.

**Step 3. Default next state.** `next = p ? {...p, turnsLeft: p.turnsLeft - 1} : null`. Every
non-blank patient utterance consumes one reply.

**Step 4. Carry**, only if `p`. Stop at the first rule that applies:
1. **`answered`.** `caps` has an `item` capture with `id === p.id` (any family). The utterance
   answered the item itself. Set `next = null`.
2. **`own-cue`.** Any phrase of `E(p.id).cue` occurs in `low`, in any form: negated, gated or heard
   again. The per-utterance matcher already decided this line. "I don't get dizzy for hours" must
   never become a duration. A re-heard cue re-arms in step 6.
3. **`other-entry`.** `topicSpans(lexicon, text, p.id, e => arr(e.yieldTo).includes(p.id) &&
   !anchoredUnnegated(e))` is non-empty. A reply that names anything else the lexicon knows may be
   giving that thing's duration ("the nausea lasts hours", "my headaches last all day"), so the
   engine refuses. Entries that yield to the pending item are not a competing topic and are
   excluded. That is why "it lasts a couple of hours" still carries: `m_dur`'s "lasts" yields to
   the pending `v_vertigo`.
4. **`question`.** The text contains `?` or `¿`. The question guard is engine punctuation and
   language-neutral. It is weak, because speech recognition seldom punctuates (R2).
5. **`refuse-phrase`.** Any `lexicon.carryRefuse` phrase occurs in `low` ("a few hours ago",
   "it started…"). This is data, and the list is empty when absent.
6. **Band selection.**
   1. Collect every occurrence of every band phrase of `E(p.id)` as `{start, end, v, phrase}`.
   2. Drop each span strictly contained in a longer span: "a couple of minutes" keeps "couple of
      minutes" (v 1) and drops "minutes" (v 2).
   3. If nothing is left: `no-band`.
   4. Drop spans negated at their start (`negatedNear(text, start, win)`). If nothing is left:
      `negated` ("not for hours", "no just a few seconds").
   5. If more than one distinct `v` remains: `ambiguous` ("a few seconds or a few minutes";
      "hours at a time, sometimes for days"). This is stricter than per-utterance band order. With
      no cue anchoring the reply, the engine refuses rather than guesses.
   6. If any remaining span is third-party-gated: `third-party`. If any is history-gated:
      `historical`.
   7. Otherwise choose the earliest span. Append
      `{id: p.id, value: v, kind: "item", evidence: text, cueIndex: start, via: "carry", band: phrase, carriedFrom: {cue: p.cue, cueText: p.cueText, evidence: p.evidence, cueIndex: p.cueIndex}}`
      to `caps`. Set `next = null` and `applied = true`.

   **Round 2 (§12.2-§12.3, §12.6).** 6.1 skips the entry's `carryExclude` phrases; 6.4 also drops a
   span when any negation cue occurs anywhere in the reply before it; with `{carry: false}` step 4
   is skipped entirely.

   **Round 3b (§13.10).** Step 4 is also skipped for a slot with `yieldOnly: true`. When a reply
   read with carry on states the pending entry's band without giving its value, the slot becomes
   yield-only and keeps its remaining count (since round 3c, §13.11, step 6 then renews it to the
   full `carry`). Step 1 drops a slot whose `yieldOnly` is present but not a boolean. Step 6 arms a
   yield-only slot from a withheld entry.

**Step 5. Expiry.** If `next && next.turnsLeft <= 0`, set `next = null`.

**Step 6. Arming, superseding, refreshing.** Let `ids` be the distinct ids in `s.unresolved`.
- `ids.length === 1`, with `u` its unresolved record:
  - Set `next` to `{id: u.id, cue: u.cue, cueText: text.slice(u.cueIndex, u.cueIndex + u.cue.length), evidence: text, cueIndex: u.cueIndex, turnsLeft: carryOf(E(u.id))}` when:
    - `carryOf(E(u.id)) > 0`, **and**
    - the cue span does not overlap any span of `topicSpans(lexicon, text, u.id, e => s.yielded.includes(e.id))`.
  - Otherwise set `next = null`.
  - This one rule covers three cases:
    - **arming** a new item;
    - **refreshing** the same item (a full window again: "I feel dizzy again");
    - **superseding** the old slot. A new cue-without-value of another item, even one without
      `heard` or `carry` such as `m_dur` in "my headache lasts forever", clears the slot.
  - The overlap rule is what stops "I get dizzy when I stand" (inside the `n_auto` phrase
    "dizzy when i stand") from arming a vertigo duration. The heard tag is still shown.
- `ids.length > 1`: `next = null`. Two values are awaited in one breath ("I'm dizzy and my
  headache lasts forever"), so any reply is ambiguous. Heard tags and cards still show for every
  entry with `heard: true`.
- `ids.length === 0`: `next` stays as computed by steps 3-5.

**Step 7. Return** `{captures: caps, pending: next, carry: {applied, refused}}`. Captures keep
`extract`'s family order, with the carry capture last.

### 3.4 The Scribe side (`apps/Scribe.jsx`)

```js
const pendingRef = useRef(null);
const answersRef = useRef(answers); answersRef.current = answers;   // in render
const skippedRef = useRef(skipped); skippedRef.current = skipped;   // in render
useEffect(() => { pendingRef.current = null; }, [module]);

/** The slot, unless its item has since been answered or skipped (read-only). */
function livePending() {
  const p = pendingRef.current;
  return p && answersRef.current[p.id] === undefined && !skippedRef.current[p.id] ? p : null;
}

function ingest(role, text, src = "demo") {
  let caps = [];
  if (role === "pt" && extractor) {
    const r = extractor.extractInContext(text, livePending());
    caps = r.captures.filter(c => !(c.kind === CAPTURE_KIND.HEARD && answersRef.current[c.id] !== undefined));
    const n = r.pending;
    pendingRef.current = n && answersRef.current[n.id] === undefined && !skippedRef.current[n.id] ? n : null;
  }
  if (caps.length) {
    /* the existing pulse, setAnswers/setCtx/setRf through ingestCaptures — unchanged */
    answersRef.current = ingestCaptures({ answers: answersRef.current }, caps).answers;   // synchronous mirror
  }
  setTranscript(t => [...t, { id: t.length, role, text, src, caps: caps.map(toTag) }]);   // id rule unchanged
}
// reset(): add  pendingRef.current = null; answersRef.current = {};
```

**Round 2 (§12.6).** `ingest` no longer passes `livePending()` (null once the item is answered or
skipped). It passes the slot itself, `pendingRef.current`, with `{carry: false}` while the pending
item is answered or skipped and `{carry: true}` (the default) otherwise, so the slot keeps feeding
the yield until it expires.

**Which turns consume the window**
- Physician turns never call the extractor and leave the slot untouched, so they **do not
  consume**. This covers demo `md` lines and voice segments with the speaker toggle set to
  Physician.
- Typed, demo and voice patient lines all go through the same path, so the capture rules stay
  identical for the three sources.

**Skipped items are never carried.** A skip says the clinician chose not to ask, so a weaker
follow-up inference must not answer for them. An explicit same-utterance capture still answers a
skipped item, as today.

### 3.5 Decrement and expiry rules

| Event | Effect on the slot |
|---|---|
| Committed, non-blank patient segment | `turnsLeft − 1`, after a carry attempt (§3.3 steps 3-5) |
| Blank or whitespace-only patient segment | none |
| Physician segment | none |
| Interim segment | none (preview only) |
| `turnsLeft` reaches 0 | cleared, silently |
| Item answered by any route | cleared at the next ingest (`livePending`) |
| Item skipped | cleared at the next ingest |
| New cue-without-value of a different item (any scale entry, with or without `heard`/`carry`) | superseded: the new item's slot, or null |
| Same item heard again | refreshed to the full `carry` |
| Two or more cues-without-value in one segment | cleared |
| Reset, module change, unmount | cleared |
| Stop or restart listening, speaker toggle | none (the conversation continues) |

**Round 2 (§12.6)** amends the "Item answered" and "Item skipped" rows: the slot still goes to the
engine, which processes it for decrement, expiry and refresh and still counts the item as present
for `yieldTo`, but with `{carry: false}` it can no longer supply a carried value.

**Round 3b (§13.10)** adds two rows in effect. An utterance that states the item's band without
giving its value (R9 f), read with carry on while the item's slot is open, makes the slot
yield-only and keeps its remaining count (since round 3c, §13.11, it is renewed to the full
`carry`). A withheld entry with `carry` arms a yield-only slot
with the full `carry` when no slot of the item is open. A yield-only slot is decremented, expired
and superseded like any other slot.

Voice finals are recogniser segments, not conversational turns. "I've been dizzy" [final] then
"for a few hours" [final] still carries, because the second segment is the first reply. Filler
finals ("um") do consume a reply (R5).

### 3.6 Which entries may carry: per-entry module data, no global default

- `scale[i].heard` (optional, `true` or `false`; only `true` means anything) turns on F1 for that
  entry.
- `scale[i].carry` (optional, integer 1-3, `LEXICON_CARRY_MAX = 3` in `engine/contract.js`) turns
  on F2. It requires `heard: true`.

There is no engine default, so every existing module, the shape fixture, the mutation base and the
0.3.1 lexicon behave exactly as today. Each entry is a separate clinical decision. `m_dur`'s cue is
a verb ("lasts"), not a symptom, so a heard signal for it would be noise (Q5).

**Proposed MASQUE configuration (needs clinical-lead approval):**
- `lexicon.scale[1]` (`v_vertigo`): `"heard": true, "carry": 2`.
- Nothing on `m_head` or `m_dur`. `i_days` and `i_role` have fallbacks, so neither flag could ever
  apply to them.

### 3.7 Verified F2 behaviour (MASQUE, §3.6 configuration + §4.5 configuration, no F3 phrases)

Notation:
- `[id/n]` is the slot after the turn.
- "md" turns are not passed to the engine, as in the Scribe.
- Line 1 is the reported case.

| # | Dialogue (patient unless marked) | Result per turn | Why |
|---|---|---|---|
| 1 | "I'm feeling really dizzy" → "as if the world is moving around me and I'm sitting still" → md "How long does it last?" → "a few hours" | heard [v_vertigo/2] → — `no-band` [/1] → (md) [/1] → **v_vertigo = 2 (5 min – 72 h) via carry, band "hours"** [—] | The reported case. The physician turn does not consume. |
| 2 | dizzy → "about an hour" | → v_vertigo = 2 via carry ("an hour") | |
| 3 | dizzy → "It lasts a couple of hours" | → v_vertigo = 2 via carry; **no m_dur** | `m_dur` yields to the pending item |
| 4 | dizzy → "my headaches last all day" | → m_head = 1; `other-entry` [/1] | another symptom named |
| 5 | dizzy → "my headache lasts all day" | → m_head = 1, m_dur = 2; `other-entry` [/1] | anchor present, so no yield |
| 6 | dizzy → "a couple of minutes" | → v_vertigo = 1 via carry | contained span dropped |
| 7 | dizzy → "a few seconds or a few minutes" | → — `ambiguous` [/1] | |
| 8 | dizzy → "No just a few seconds" / "not for hours" | → — `negated` [/1] | |
| 9 | dizzy → "not seconds, more like hours" | → v_vertigo = 2 via carry | negated band skipped |
| 10 | dizzy → "My mom gets it for hours" | → — `third-party` [/1] | |
| 11 | dizzy → "I used to have it for hours" | → — `historical` [/1] | |
| 12 | dizzy → "the nausea lasts hours" | → m_nausea = yes; `other-entry` [/1] | |
| 13 | dizzy → "Bright lights bother me" → "for hours" | → m_photo = yes `other-entry` [/1] → v_vertigo = 2 via carry | N = 2 |
| 14 | dizzy → "Bright lights bother me" → "my ears ring" → "for hours" | → [/1] → `no-band` [—] → — | expired |
| 15 | dizzy → md "How long?" → md "Minutes or hours?" → "hours" | → v_vertigo = 2 via carry | md turns do not consume |
| 16 | dizzy → "minutes or hours?" | → — `question` [/1] | |
| 17 | "I get dizzy when I stand" → "a few seconds" | n_auto = yes + heard [—] → — | cue inside another entry's phrase: not armed |
| 18 | "I'm dizzy and my headache lasts forever" → "a couple of hours" | m_head = 1 + heard [—] → — | two unresolved cues (v_vertigo, m_dur) |
| 19 | dizzy → "I feel dizzy again" → "ok" → "hours" | → heard `own-cue` [/2] → [/1] → v_vertigo = 2 via carry | refresh |
| 20 | dizzy → "My attacks last for two days" | → — `no-band` [/1] | `m_dur` yields (no anchor); "two days" is no v_vertigo band; both stay unanswered |
| 21 | "My mom gets dizzy" → "for hours" / "I'm not dizzy" → "for hours" | — → — | gated or negated cue: nothing heard, nothing armed |
| 22 | dizzy → "for several days" | → v_vertigo = 3 via carry | |
| 23 | dizzy → "I don't get dizzy for hours" / "I'm not dizzy right now, but earlier for hours" | → — `own-cue` [/1] | a denial never becomes a duration |
| 24 | dizzy → "everything is spinning" → "ok" → "a few hours" | → heard `own-cue` [/2] → [/1] → v_vertigo = 2 | |
| 25 | dizzy → "ok" → "fine" → "a few hours" | → [/1] → [—] → — | expired after two replies |
| 26 | dizzy → "   " → "a few hours" | → (not consumed) [/2] → v_vertigo = 2 | blank final |
| 27 | dizzy → "a few hours ago" | → v_vertigo = 2 **without** `carryRefuse`; → — `refuse-phrase` **with** `carryRefuse: ["ago", …]` | R2, Appendix A |
| 28 | "I get dizzy and it lasts a while" → "a few hours" | heard [/2] → v_vertigo = 2 via carry | `m_dur` yielded, so not a second unresolved cue |
| 29 | dizzy → "it lasts forever" → "a few hours" | → `no-band` [/1] → v_vertigo = 2 | |
| 30 | "It lasts a couple of hours" (nothing pending) | m_dur = 1 | per-utterance behaviour unchanged |
| 31 | demo transcript, all 14 lines | line 7: heard [v_vertigo/2]; line 8 (md): [/2]; line 9 `other-entry` [/1]; line 10 `other-entry` [—] | no carry; captures otherwise identical to 0.3.1 |

These rows run in the browser suite (gold set dialogues, §7.2). The Scribe-only ones (Skip,
answered meanwhile, Reset, interim) are covered by `render-scribe` and the Playwright voice spec
(§7.3).

---

## 4. F4: a generic yield rule

### 4.1 The defect

`m_dur` (untreated headache-attack duration) has the cues `lasts | last for | goes on for | sticks
around` and the band phrase "couple of hours" (v 1). Any sentence using the verb scores it,
whatever the subject. "I get dizzy and it lasts a couple of hours" gives `v_vertigo=2` **and**
`m_dur=1`.

The brief also asked that "my headaches last a couple of hours" and "my attacks last two days"
keep working. **They do not work today.** The bare verb "last" is not an `m_dur` cue, so both
capture no `m_dur`. F4 must not make them worse, and it does not. Making them work is F3
vocabulary (Appendix A). The F4 table uses the "last for" forms, which do capture today.

### 4.2 Options compared

| | Option | Configuration | Fixes "dizzy … lasts a couple of hours" | Keeps "my headache lasts…" / "my attacks last for two days" | Blast radius | New clinical content |
|---|---|---|---|---|---|---|
| **A** | **`yieldTo` + `anchor` (recommended).** An entry yields (captures nothing, no heard) in an utterance where a listed entry is present (any of its cue/ph phrases occurs, regardless of negation or attribution, or it is pending), unless one of the entry's own `anchor` phrases occurs **unnegated**. | `m_dur.yieldTo = ["v_vertigo"]`, `m_dur.anchor = [approved phrases]` | yes | yes (no dizziness cue) | only sentences that also name the target, plus replies while the target is pending | an anchor list (5 of 7 drafts are existing `m_head` cues) |
| A′ | `yield: {to: [ids], unless: [ids]}` (minimal candidate): `unless` reuses other entries' cue lists | `unless: ["m_head"]` | yes | yes | same as A | none, but it cannot express "migraine", so "My migraines last for two days and I get dizzy" loses `m_dur` |
| B | `requireAny: [phrases]`: the entry fires only with a context phrase present | a context list for `m_dur` | yes | **no**: every `m_dur` utterance without the word is lost, including "Each attack lasts two days" unless "attack" is listed | every utterance of the entry | a new phrase list |
| C | Proximity window between cue and band | a number | **no**: cue and band are adjacent | yes | every utterance | a number |
| D | Nearest-cue assignment among co-occurring entries | a grouping | usually | yes | every co-occurrence; distance heuristics | a grouping |
| E | Remove "lasts" from the `m_dur` cues | lexicon edit | yes | **no** ("Each attack lasts two days" lost) | everywhere | removes approved content |

**A is recommended.**
- It changes behaviour only where the defect lives: a sentence that names the other symptom.
- It is conservative. A contested duration is dropped (unanswered and still asked), never guessed.
- It composes with F2 through `pendingIds`.
- It is generic. The engine reads only ids and phrases from data.

A′ is A with a weaker anchor, so A subsumes it.

### 4.3 Semantics (exact; `extract`'s scale loop, after the cue test and band selection)

```js
// lexicon.scale[i]: yieldTo?: string[] (ids of other scale or bool entries), anchor?: string[] (phrases)
const presence = (id) => [...scale cue lists of entries with that id, ...bool ph lists of entries with that id];
const yieldTarget = (ex) => {
  const ys = arr(ex.yieldTo);
  if (!ys.length) return null;
  const t = ys.find(id => pendingIds.has(id) || presence(id).some(p => typeof p === "string" && p && low.includes(p)));
  if (t === undefined) return null;
  return allHits(text, arr(ex.anchor)).some(j => !negatedNear(text, j, win)) ? null : t;
};
// in the loop, after `v` is computed from the bands and the fallback:
const yt = yieldTarget(ex);
if (yt !== null) {
  yielded.push(ex.id);
  if (keep && v !== null && v !== undefined)
    push({ id: ex.id, value: v, kind: "item", evidence: text, cueIndex: i, suppressedBy: "yield" });
  continue;            // no item capture, no heard capture, not unresolved
}
```

Each design choice below is the conservative one:
- **The target's presence ignores negation and attribution.** In "I'm not dizzy but it lasts a
  couple of hours", "it" is ambiguous, so the entry yields and the item stays unanswered.
- **The anchor must be unnegated.** In "It's not a headache, the dizziness lasts…", the denied
  headache does not license a headache duration.
- **A yield suppresses the heard capture and the unresolved record too.** "…spinning, it comes and
  goes and lasts a while" never shows or arms a headache-attack duration.
- **Order independence.** The yield reads phrase presence in the text, never another entry's
  result.
- **`includeSuppressed` reports a yielded value** as `suppressedBy: "yield"`, so the benchmark's
  error taxonomy can name it.
- **Inert without `yieldTo`.** With no `yieldTo` anywhere, this code path never runs.

**Round 2 (§12.4, §12.5, §12.6).** For an entry with `heard: true`, `v` is no longer the first band
in array order: it comes from the R2 band choice and the R3b onset guard (§12.4). Presence and
anchors run on the folded text, never the number-normalised one (§12.5). `pendingIds` still comes
from the slot after the pending item is answered or skipped (`{carry: false}`, §12.6).

### 4.4 Before/after (verified; anchors as drafted in §4.5 incl. `migraine` and `head pain`; no F3 phrases)

The "Before" column is the deployed engine. The "After" column is per utterance, `extract()` with
`includeHeard`.

| # | Sentence | Before (0.3.1) | After (0.3.2) | Note |
|---|---|---|---|---|
| 1 | I get dizzy and it lasts a couple of hours | v_vertigo=2, **m_dur=1** | v_vertigo=2 | **the reported false positive removed** |
| 2 | When I'm off balance it sticks around all day | v_vertigo=2, **m_dur=2** | v_vertigo=2 | removed |
| 3 | It's not a headache, the dizziness lasts a couple of hours | v_vertigo=2, **m_dur=1** | v_vertigo=2 | a denied headache does not anchor |
| 4 | The room spins and it lasts the rest of the day | **m_dur=2** | heard v_vertigo (“room spins”) | removed. The vertigo duration is unknown; "rest of the day" is an F3 draft band. |
| 5 | I'm not dizzy but it lasts a couple of hours | m_dur=1 | — | the target counts even when negated: conservative, unanswered (Q14) |
| 6 | My headache lasts a couple of hours | m_head=1, m_dur=1 | same | kept |
| 7 | My headaches last for a couple of hours | m_head=1, m_dur=1 | same | kept |
| 8 | My attacks last for two days | m_dur=2 | same | kept |
| 9 | Each attack lasts two days | m_dur=2 | same | kept |
| 10 | I'm dizzy and my headache lasts all day | m_head=1, v_vertigo=2, m_dur=2 | same | anchor. The `v_vertigo=2` from "all day" is a pre-existing false positive (R4). |
| 11 | I get dizzy with my headaches and they last for a couple of hours | m_head=1, v_vertigo=2, m_dur=1 | same | anchor |
| 12 | I'm not dizzy, but my headache lasts all day | m_head=1, m_dur=2 | same | anchor |
| 13 | I get migraines that last for a couple of hours and I get dizzy | m_fhx=yes, v_vertigo=2, m_dur=1 | same | **only if `migraine` is approved.** Struck, `m_dur` is dropped. |
| 14 | My migraines last for two days and I get dizzy with them | m_dur=2 | heard v_vertigo, m_dur=2 | **only if `migraine` is approved.** Struck: heard only. |
| 15 | the head pain lasts a couple of hours and I feel dizzy | v_vertigo=2, m_dur=1 | same | **only if `head pain` is approved.** Struck, `m_dur` is dropped. |
| 16 | My mom gets dizzy and it lasts a couple of hours | — | — | gated |
| 17 | The spinning lasts about two hours each time. (gold e07) | v_vertigo=2 | same | |
| 18 | The dizziness only lasts a few seconds, then it passes. (gold e08) | v_vertigo=1 | same | |
| 19 | Vertigo episodes last for hours | v_vertigo=2 | same | |
| 20 | It lasts a couple of hours (nothing pending) | m_dur=1 | same | unchanged per utterance |
| 21 | It lasts a couple of hours (v_vertigo pending, Scribe) | m_dur=1 | v_vertigo=2 via carry; no m_dur | cross-turn yield (§3.7 row 3) |
| 22 | My headaches last a couple of hours | m_head=1 | same | `m_dur` missed before and after (F3 draft "headaches last") |
| 23 | My attacks last two days | — | — | same gap (F3 draft "attacks last") |
| 24 | my ear rings and it lasts a couple of hours | v_aural=yes, m_dur=1 | same | bool targets are supported but not configured (Q6) |
| 25 | demo line 7 "…really dizzy too — kind of spinning … lasts a while." | — | heard v_vertigo (“dizzy”) | no `m_dur` signal |

`includeSuppressed` on row 1 reports `m_dur=1 [yield]`.

On the 44 v0.2.0 gold cases × 4 option sets, and on 20,000 synthetic utterances: **0 outputs
change**. The synthetic corpus almost never combines a `v_vertigo` cue, an `m_dur` cue and an
`m_dur` band, which is why §7.2 adds a targeted F4 corpus.

### 4.5 Exact MASQUE configuration for the clinical lead (DRAFT; needs approval)

```json
"scale": [
  { "id": "m_head", … unchanged … },
  { "id": "v_vertigo", "cue": [ … ], "bands": [ … ], "fallback": null, "heard": true, "carry": 2 },
  { "id": "m_dur", "cue": [ … ], "bands": [ … ], "fallback": null,
    "yieldTo": ["v_vertigo"],
    "anchor": ["headache", "facial pressure", "facial pain", "pressure in my face", "behind my eyes", "migraine", "head pain"] },
  …
]
```

What the lead is approving, in clinical words:
1. When a sentence names dizziness or vertigo and does not name a headache, facial pain or
   migraine (not negated), a duration in it is not taken as a headache-attack duration.
2. The same holds for a follow-up reply while a dizziness duration is being waited for.
3. When both are named, both items are captured as today.

Each anchor is approved or struck separately (Appendix A, table A3). Five come from `m_head`'s
existing cue list. "sinus headache" is subsumed by "headache". `migraine` and `head pain` are new.

---

## 5. Contract, validator, editor, hashes

### 5.1 `engine/contract.js`

```js
/** Upper bound of lexicon.scale[i].carry (following patient replies that may supply a value). */
export const LEXICON_CARRY_MAX = 3;
/** Keys a lexicon scale entry may carry (validator V28 warns on any other). */
export const LEXICON_SCALE_KEYS = ["id", "cue", "bands", "fallback", "heard", "carry", "yieldTo", "anchor"];
```

The `Lexicon` typedef changes:
- the scale line becomes
  `{id, cue, bands, fallback, heard?: true, carry?: number, yieldTo?: string[], anchor?: string[]}`;
- a new property: `@property {string[]} [carryRefuse] O phrases that refuse a carried value (F2)`.

Each new field gets one doc line, using the meanings in §1-§4. `RUBRIC_KEYS` is unchanged, because
nothing new is top level.

**Round 2 (§12.3).** `LEXICON_SCALE_KEYS` gains `"carryExclude"`, and the scale line of the typedef
gains `carryExclude?: string[]`.

### 5.2 `engine/validate.js`

`checkLexicon` checks run inside the existing `arr(lex.scale).forEach`, after the fallback check,
with `p = /lexicon/scale/${i}` and `it` the item. They reuse V28 and V29. No new V-code, so the
"≥ 1 fixture per code V1-V60" rule is untouched.

| Sev | Path | Rule | Message |
|---|---|---|---|
| E V28 | `p/heard` | `heard !== undefined && typeof heard !== "boolean"` | `heard must be true or false` |
| W V28 | `p/heard` | `heard === true && fallback !== null && fallback !== undefined` | `"<id>" has a fallback, so its cue always sets a value and is never heard without one` |
| E V28 | `p/carry` | present and not an integer in 1..`LEXICON_CARRY_MAX` | `carry must be an integer from 1 to 3: how many following patient replies may supply the value` |
| E V28 | `p/carry` | present and `heard !== true` | `carry needs heard: true (carry-over starts from a cue heard without its value)` |
| E V28 | `p/carry` | present and some band `j` has `it.scale[b.v].f === 0` | `band <j> of "<id>" records option <v> ("<label>", f = 0): a follow-up reply must never record a negative answer, so carry cannot be used on this entry` |
| E V28 | `p/yieldTo` | present and not a non-empty array | `yieldTo must be a non-empty list of lexicon entry ids` |
| E V28 | `p/yieldTo/k` | element equals the entry's own id (checked first) | `an entry cannot yield to itself` |
| E V28 | `p/yieldTo/k` | otherwise: element is not a string id of a scale or bool entry of this lexicon | `"<x>" is not the id of another scale or yes/no entry of this lexicon` |
| E V28 | `p/yieldTo/k` | duplicate element (second and later occurrences) | `"<x>" is listed twice` |
| E V28 | `p/yieldTo` | a cycle among scale entries (DFS over `yieldTo` restricted to scale ids; reported once, at the lowest-index entry of the cycle) | `yield cycle <a> → <b> → <a>: an utterance that names all of them captures none of them` |
| E V28 | `p/anchor` | present and `yieldTo` absent | `anchor has no effect without yieldTo` |
| E V28 | `p/anchor` | present and not a non-empty array | `anchor must be a non-empty phrase list` |
| W V28 | `p/<key>` | a key not in `LEXICON_SCALE_KEYS` | `"<key>" is not a lexicon scale field and is ignored (a misspelt heard, carry, yieldTo or anchor?)` |
| E V28 | `/lexicon/carryRefuse` | present and not a non-empty array | `carryRefuse must be a non-empty phrase list` |
| W V28 | `/lexicon/carryRefuse` | present and no scale entry has `carry` | `carryRefuse has no effect: no scale entry has carry` |

`lexiconPhrases(lex)` adds `list(e.anchor, ${p}/anchor)` and `list(lex.carryRefuse,
"/lexicon/carryRefuse")`. The existing V29 rules (non-empty, lowercase, W under 3 characters) then
cover them. `"ago"` is 3 characters, so no warning.

**Round 2 (§12.3, §12.5).** The `carryExclude` rules are added under V28 (exact messages in
`engine/validate.js` and `04-module-authoring.md` §7), and the misspelt-key warning names
`carryExclude` too. The V29 number warning applies to band phrases only.

MASQUE 0.3.2 must still validate with **0 errors and only the expected warnings**: V12 for
`n_allo` and V33 for the es fallbacks.

### 5.3 `engine/derive.js`: locks, deletion, change classification

**`LOCKS` additions**, with the reason shown next to the lock:

```js
["/lexicon/scale/*/heard",   "The heard signal is clinical-lead-approved configuration; not editable in the Rubric Editor."],
["/lexicon/scale/*/carry",   "Carry-over is clinical-lead-approved configuration; not editable in the Rubric Editor."],
["/lexicon/scale/*/yieldTo", "The yield rule is clinical-lead-approved configuration; not editable in the Rubric Editor."],
["/lexicon/scale/*/anchor",  "Yield anchors are clinical-lead-approved configuration; not editable in the Rubric Editor."],
["/lexicon/carryRefuse",     "Carry-over refusal phrases are clinical-lead-approved configuration; not editable in the Rubric Editor."],
```

`EDITABLE` is unchanged. These fields are read-only and are preserved byte for byte, because the
editor edits a cloned draft by path.

**`itemDependents(rubric, id)`** adds
`{path: "/lexicon/scale/<k>/yieldTo", what: "a yield rule naming this item"}` for every scale entry
whose `yieldTo` includes `id`.

**`deleteItem(rubric, id)`**
- Excludes `/yieldTo` dependents from the `setAt(…, undefined)` loop, as it already does for multi
  entries.
- After the loop, for every scale entry with `yieldTo`: `e.yieldTo = e.yieldTo.filter(x => x !==
  id)`. When that empties it, delete `yieldTo` **and** `anchor`.
- A deletion therefore never leaves a V28 error behind.

**`lockViolations`**. `dependentOfGone` also exempts
`segs[0] === "lexicon" && segs[1] === "scale" && gone.size > 0`. Removing a deleted item's scale
entry shifts later indices, and stripping a yield reference touches a locked field. Both are
consequences of the deletion, not edits.

For MASQUE this never triggers, because `canDeleteItem` refuses items the logic reads, and
`v_vertigo` is read.

**Round 2 (§12.8, §12.7).** The exemption above was too broad (any deletion, even of a red flag,
exempted every `/lexicon/scale` path). It is narrowed to what a deletion actually produces, and the
five lock reasons say "approved lexicon configuration" instead of "clinical-lead-approved
configuration".

**`classifyChanges`** needs no change. All five fields are inside the lexicon hash projection, so
any difference is a lexicon change, giving the "-local" version and "not re-run".

### 5.4 `apps/RubricEditor.jsx` (`LexiconSection`): display, read-only

First lexicon card, after the historical cues:

```jsx
{Array.isArray(lx.carryRefuse) && <PhraseList path="/lexicon/carryRefuse" label="Carry-over refusal phrases (a reply containing one never supplies a carried value)" />}
```

"Scale items" card, inside each entry `e` at index `i`, after its band lists:

```jsx
{e.heard === true && (
  <div className="re-sub" data-heard-config={e.id}>
    Heard signal on{Number.isInteger(e.carry) ? ` · carry-over: the next ${e.carry} patient ${e.carry === 1 ? "reply" : "replies"} may supply the value` : ""} (read-only: clinical-lead-approved configuration)
  </div>)}
{Array.isArray(e.yieldTo) && (
  <div className="re-sub" data-yield={e.id}>
    Yields to {e.yieldTo.join(", ")} (read-only): a sentence that names one of these captures nothing for {e.id} unless an anchor phrase below is present and not negated.
  </div>)}
{Array.isArray(e.anchor) && <PhraseList path={`/lexicon/scale/${i}/anchor`} label={`${e.id} anchors`} />}
```

**Round 2 (§12.7):** the heard row's parenthesis reads `(read-only: approved lexicon configuration)`.

`PhraseList` already renders locked paths read-only: `lockReason(path + "/0") && lockReason(path)`
disables removal and hides the add input. Ids come from data, so t-ids is satisfied.

A cue or band edit keeps every new field in the derived lexicon (editor suite, §7.2).

### 5.5 `engine/hash.js`: no code change

`hashProjections.lexicon` hashes the lexicon minus `version`, `lang` and `goldSet`. So `heard`,
`carry`, `yieldTo`, `anchor`, `carryRefuse` and appended phrases all change MASQUE's
**`lexiconHash`**, as they must.

- `rubricSha256` and `contentHash` change too.
- `instrumentHash` and `scoringHash` are **unchanged**. Their projections exclude the lexicon.
  Therefore:
  - `research.calibration.appliesTo.scoringHash` keeps its value (the generator recomputes the same
    string);
  - `calibrationGate(masque)` stays `true`;
  - the `values` suite's instrument deep-equals and calibration checks prove it.
- `logicSha256` is unchanged, because `masque.logic.js` is untouched.

Consequence: saved and downloaded 0.3.1 derivations (R1).

---

## 6. Versioning, the lexicon delta, change logs

### 6.1 Axes and constants

| Axis or constant | Before | After | Where |
|---|---|---|---|
| Release `APP_VERSION` | 0.4.0 | **0.4.1** | `app/src/engine/policy.js` L6, that line only. **Do not touch** the `SITE.ALLOW_JS_UPLOAD` line: the deployed site sets it to `false` and the repo has `true`. |
| AD4 `NEW_RELEASE` | "0.4.0" | **"0.4.1"** | `app/tests/harness/diff.js` L25, plus AD4's `what` and comment. **Atomic with `APP_VERSION`.** If either moves alone, every golden or render comparison that prints the release fails. |
| Instrument | 0.2 | 0.2 | no item, weight, scale factor or cut-point change |
| Lexicon | 0.3.1 | **0.3.2** | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | 1.0.0 | `masque.logic.js`, untouched |
| Gold set | 0.2.0 (lexicon 0.3.1) | **0.3.0 (lexicon 0.3.2)** | `lexicon.goldSet = {"version": "0.3.0", "lexiconVersion": "0.3.2", "file": "masque_extraction_goldset_0.3.0.json"}` |
| `EXTRACTOR_KIND` | "rule-based / phrase-match with local negation" | **unchanged** | still pinned to the baseline by the `extraction` suite |
| `EXTRACTOR_FEATURES` | — | **new** (§3.2) | printed in the benchmark header |
| Contract | 1 | 1 | additive optional fields (R10) |

Orchestrator decision F6 ("Release 0.4.0 stays the default") is superseded. That is recorded in 03
(§6.4). The test-local `appVersion: "0.4.0"` inputs in `research.js`, `roundtrip.js` and
`research-parity.js` are self-consistent and stay.

### 6.2 The lexicon delta: one source of truth for module data, generator and harness

New file `app/tests/harness/lexicon-delta.js`. It holds plain data only: no imports and no logic.
It is local-only, never deployed.

```js
/** The clinical-lead-approved MASQUE lexicon change 0.3.1 → 0.3.2. Paths are relative to the
 *  lexicon and use the 0.3.1 positional indices; entryId asserts the entry at that position. */
export const LEXICON_DELTA = {
  from: "0.3.1", to: "0.3.2",
  approved: { by: "clinical lead", date: "<YYYY-MM-DD>" },
  // Phrases appended at the END of an existing item-vocabulary list, in this order. Allowed paths:
  // /bool/<i>/ph, /ctx/<i>/ph, /multi/<i>/ph, /scale/<i>/cue, /scale/<i>/bands/<j>/ph, /redFlags/<id>.
  // Never the negation / thirdParty / historical cue lists (a different decision).
  appended: [
    // { path: "/bool/8/ph", entryId: "v_head", phrases: ["roll over"], why: "F3", approvedOn: "<date>" },
  ],
  // Keys added to existing objects, in this order. `from` present = replaces that exact value.
  fields: [
    { path: "/version", from: "0.3.1", to: "0.3.2" },
    { path: "/scale/1/heard", entryId: "v_vertigo", to: true, why: "F1" },
    { path: "/scale/1/carry", entryId: "v_vertigo", to: 2, why: "F2" },
    { path: "/scale/2/yieldTo", entryId: "m_dur", to: ["v_vertigo"], why: "F4" },
    { path: "/scale/2/anchor", entryId: "m_dur", to: [/* approved anchors */], why: "F4" },
    { path: "/carryRefuse", to: [/* approved phrases; omit the row if all are struck */], why: "F2 guard" },
    { path: "/goldSet",
      from: { version: "0.2.0", lexiconVersion: "0.3.1", file: "masque_extraction_goldset.json" },
      to:   { version: "0.3.0", lexiconVersion: "0.3.2", file: "masque_extraction_goldset_0.3.0.json" }, why: "gold set re-run" },
  ],
  changelog: { date: "<YYYY-MM-DD>", kind: "lexicon", note: "<§6.3, verbatim>", paths: [/* every touched path, "/lexicon/…" */] },
};
```

Helpers live in `app/tests/harness/diff.js`, which keeps its no-imports rule. The data travels in
`ctx`.

```js
/** lex031 + delta → lex032. Deep copy; throws on any precondition failure (version ≠ from, entryId
 *  mismatch, a phrase already in its list, a `from` that does not deep-equal, a disallowed path).
 *  Added entry keys go at the end of the entry, in delta order; added top-level keys are inserted
 *  just before `goldSet`; replaced values keep their key position. */
export function applyLexiconDelta(lex031, delta)

/** The 0.3.1-equivalent lexicon, or null.
 *   lex.version === delta.to   → reverted copy, only if lex shows EXACTLY the delta, proven by
 *                                 JSON.stringify(applyLexiconDelta(result, delta)) === JSON.stringify(lex)
 *                                 (key order included);
 *   lex.version === delta.from → lex itself (same reference) when it carries no delta key and no
 *                                 appended phrase at its list end (staged landing: suites are green
 *                                 before and after the module data lands);
 *   otherwise                  → null. */
export function revertLexiconDelta(lex, delta)
```

### 6.3 Rubric `changelog` entry (append only; a draft, finalised at approval)

```json
{ "date": "<approval date>", "kind": "lexicon",
  "note": "Lexicon 0.3.1 → 0.3.2, approved by the clinical lead on <date>. v_vertigo: heard signal on (heard) and carry-over 2 (carry): when its cue is heard without a duration the item stays unanswered and is shown as heard, and the next two patient replies may supply the duration — same item only; refused when the reply names anything else the lexicon knows, contains the item's own cue, is a question, contains a carryRefuse phrase, or its duration is negated, ambiguous, attributed or historical. m_dur yields to v_vertigo (yieldTo) unless an approved anchor phrase is present and not negated, so a dizziness-duration sentence no longer scores the headache-attack duration. carryRefuse: <approved list | none>. Phrases appended: <path: phrases … | none>. Drafts struck: listed in CHANGELOG.md. Instrument 0.2 and probe set 1.0.0 unchanged. Gold set 0.2.0 → 0.3.0: <n> utterances and <d> dialogues added; no 0.2.0 case or label changed.",
  "paths": ["/lexicon/version", "/lexicon/scale/1/heard", "/lexicon/scale/1/carry", "/lexicon/scale/2/yieldTo", "/lexicon/scale/2/anchor", "/lexicon/carryRefuse", "/lexicon/goldSet", "<appended list paths>"] }
```

It is generated, not hand-edited: `extract-rubric.js` appends `LEXICON_DELTA.changelog` after the
2026-10-02 notes. The `values` provenance sweep already exempts `/rubric/changelog/`.

### 6.4 Files that carry the version change

**`app/tests/tools/extract-rubric.js`** (the generator; it keeps "masque.rubric.json is generated,
not written" true)
- Import `LEXICON_DELTA` (`../harness/lexicon-delta.js`) and `applyLexiconDelta` /
  `revertLexiconDelta` (`../harness/diff.js`).
- Build the 0.3.1 lexicon from the baseline exactly as today, then
  `lexicon = applyLexiconDelta(lexicon031, LEXICON_DELTA)`.
- Add the checks:
  - `revertLexiconDelta(lexicon, LEXICON_DELTA)` deep-equals `lexicon031`;
  - every `appended[].entryId` and `fields[].entryId` matches.
- Append `LEXICON_DELTA.changelog` to `changelog`.
- Extend the `/lexicon` `src()` note:
  `+ tests/harness/lexicon-delta.js (clinical-lead approval <date>)`.
- Regenerating then reproduces the committed rubric byte for byte (`extract-rubric.html` reports
  "identical").

**`app/modules/masque/CHANGELOG.md`**
- The version-axes table: Lexicon 0.3.2; Gold set 0.3.0 (lexicon 0.3.2).
- A new dated section quoting the §6.3 entry verbatim (the file's own rule).
- A sub-list "Drafts considered and struck by the lead", each with the lead's reason, so they are
  not re-proposed.
- A "Benchmark (in-sample, authored, saturated: development figures, not performance)" block:
  - micro P/R/F1 with tp/fp/fn on 44 + n utterances, with denominators;
  - dialogues `carry applied as labelled x/d`, `refused as labelled y/d`;
  - the header `lexicon 0.3.2 · <EXTRACTOR_KIND> · features <EXTRACTOR_FEATURES> · development set 0.3.0`.
  - **Round 2 (§12.9):** the block states plainly that the 0.3.0 labels are the 0.3.2 extractor's
    own output (regression snapshot); P/R/F1 on them is tautological, not a measurement.
- A line "Release screenAIr 0.4.1".
- A note on R1 (re-derive edits made before 0.4.1).

**`app/modules/masque/SOURCES.md`**
- The hand-written-values table gains:
  - a row for `lexicon.version` 0.3.2;
  - rows for `lexicon.scale[1].heard`, `.carry`, `lexicon.scale[2].yieldTo`, `.anchor` and
    `lexicon.carryRefuse`;
  - one row per appended phrase, giving the path, the phrase, "clinical-lead approval <date>
    (F3)", and the origin (problem report, module probe wording, or new).
- Source column: "applied by `extract-rubric.js` from `tests/harness/lexicon-delta.js` after the
  baseline extraction".
- The `goldSet` row is updated: the file lives in `app/tests/fixtures/goldset/` (local-only), is a
  superset of reference v0.2.0 by reference, and is SHA-256 pinned in `suites/capture.js`.

**`app/modules/masque/README.md`**
- Line 23: lexicon 0.3.2, gold set 0.3.0.
- One sentence: "the Ambient Scribe shows a cue heard without its value and may take the value from
  the next replies; a heard cue never scores".

**Docs** (§8, WP-L)
- `docs/refactor/03-design.md`:
  - §4.9 and §4.11 (the new functions);
  - §5.4 (heard UI, slot);
  - §7.5 (the new chrome strings of §2.1);
  - §8.3 (the `extraction`, `render` and new `capture` rows);
  - §8.4 (amend AD4 to 0.4.1, add AD13, and change "No difference is permitted in … extraction" to
    "… extraction outside AD13");
  - a decisions row superseding F6.
- `docs/refactor/02-app-divergences.md`: a "screenAIr 0.4.1" section with AD13 and AD4.
- `docs/refactor/04-module-authoring.md`:
  - §2.8 rows for `heard`, `carry`, `yieldTo`, `anchor`, `carryRefuse`;
  - §5.1: the lexicon axis bumps when any of them changes;
  - §7: the new V28 messages.

### 6.5 The F3 mechanism: how an approved phrase gets in

1. **We draft.** Appendix A lists each candidate with its target list, origin and risk.
2. **The lead marks each row approve or strike**, with a date. Struck rows go into CHANGELOG.md
   with the reason.
3. **Approved phrases are appended** to `LEXICON_DELTA.appended`:
   - lowercase, ≥ 3 characters (V29);
   - at the end of the existing list;
   - never inserted, reordered or reworded.

   A phrase that could collide with an earlier band (band order is significant) goes back to the
   lead with the collision case.
4. **Gold cases** go into `masque_extraction_goldset_0.3.0.json`:
   - ≥ 1 positive case per phrase;
   - for cue phrases, also ≥ 1 negated **or** third-party case;
   - a collision case where the phrase is a substring risk (for example "rocking chair").

   The gold text is authored by us and approved by the lead with the phrases. **Round 2
   correction (§12.7):** this did not happen for gold set 0.3.0. Its case text was drafted by the
   team and has **not** been reviewed by the clinical lead; only the phrases were approved.
5. **Regenerate** the rubric with `extract-rubric.html` (byte-identical check). Update CHANGELOG.md
   and SOURCES.md.
6. **Re-pin** `GOLD_0_3_0_SHA256` and `EXPECTED_BENCHMARK` in `suites/capture.js`, then run the
   harness.

   Any change to the output of one of the 44 v0.2.0 cases **fails**, and the phrase goes back to
   the lead. No v0.2.0 label is ever edited to match ("a gold set edited to match its system is not
   a gold set", reference revisionLog).

If F3 approval lags, 0.3.2 ships with `appended: []` (F1, F2 and F4 only). F3 then becomes lexicon
0.3.3 and gold set 0.3.1 through the same mechanism (Q12).

---

## 7. Tests

### 7.1 How the intentional divergences are recorded (the harness-sanctioned way)

**`tests/harness/divergences.js` is not the place and is not touched.** It pins:
- `reference/fixed-src` against `tests/baseline/src` (`FIXED_SRC_SHA256`, `HUNKS`);
- the baseline manifest itself (`MANIFEST_SHA256`).

The `integrity` suite consumes it. This change edits no baseline or reference file, so
`MANIFEST_SHA256`, `FIXED_SRC_SHA256` and `HUNKS` all stay.

Divergences of the **new code** from the frozen baseline live where 03 §8.4 puts them: the
`ALLOWED_DIFFERENCES` table in `tests/harness/diff.js`. Each entry there has an exact normaliser and
a detector. 03 §8.7 says widening requires a design change in 03 and in 02. So:

- **AD4 amended:** `NEW_RELEASE = "0.4.1"`, and `what` becomes `every printed release string:
  0.3.0 → 0.4.1`.
- **AD13 added.** `allowedDifference`'s message becomes "design §8.4 lists AD1-AD13".

```js
{ id: "AD13", ready: true, owner: "values / extraction (WP-H)",
  what: "MASQUE lexicon 0.3.1 → 0.3.2: exactly the clinical-lead-approved delta of tests/harness/lexicon-delta.js",
  // values:      ctx.AD13 = {delta, full}   full = the whole shipped lexicon (rubric.lexicon)
  // extraction:  ctx.AD13 = {delta, text, lexicon}   lexicon = the shipped (0.3.2) lexicon
  appliesTo: (path, ctx) => !!(ctx && ctx.AD13) &&
    (path === "/lexicon" || path === "/module/versions" || /^\/extract032\//.test(path)),
  normalise(a, b, ctx) {
    // /lexicon (projection objects): only when a.version === delta.from, b.version === delta.to,
    //   and every key of b deep-equals full[key]; r = revertLexiconDelta(full, delta); r === null →
    //   [a, b]; else [a, projection of r onto b's keys]. The whole delta is proven exact, including
    //   carryRefuse and goldSet, which the projection does not show.
    // /module/versions: a.lexicon === from && b.lexicon === to → [a, {...b, lexicon: from}].
    // /extract032/… (capture arrays): P = ids touched by an appended phrase occurring in
    //   text.toLowerCase() (the entry's id; for multi, every id of the entry; for redFlags, the key);
    //   Y = ids of scale entries with a delta yieldTo when any presence phrase of a target (0.3.2
    //   lists) occurs in the text. a2/b2 = a/b without captures whose id ∈ P ∪ Y; if JSON-equal
    //   (key order included) and something was removed → [b, b]; else [a, b].
  },
  detector: (input) => !!(input && input.differs) },
```

**Parity subject change (recorded in 03 §8.3).** The `extraction` and `render-scribe` parity
comparisons run on the **0.3.1-equivalent lexicon**:
`revertLexiconDelta(module.lexicon, LEXICON_DELTA)`, the exact inverse proven by the `values` suite.
They prove "generic engine + 0.3.1 data == baseline" with no new normalisation. The 0.3.2 behaviour
is proven separately:
- by AD13 (no collateral change);
- by the gold set 0.3.0 and the `capture` suite;
- by the `render-scribe` behaviour blocks.

### 7.2 Suite by suite

| Suite | Change |
|---|---|
| **values** (WP-H) | Import `LEXICON_DELTA`, and `revertLexiconDelta` from `diff.js`. The `/lexicon` and `/module/versions` diffs get `{allow: ["AD13"], ctx: {AD13: {delta: LEXICON_DELTA, full: R.lexicon}}}`, then `h.expect("AD13", {precondition: R.lexicon.version === LEXICON_DELTA.to, observed})`. **Provenance sweep:** a rubric string is skipped only when its JSON pointer **and** its value both match a delta leaf. The leaves are: `/rubric/lexicon/version` = "0.3.2"; for each appended list, `/rubric/lexicon<path>/<len031 + k>` = `phrases[k]`; every string leaf under each `fields[].to`. A regex over whole lists is not used, because it would exempt any later unapproved phrase in the same list. Every other new string is still "invented content" → FAIL. Instrument and calibration checks are unchanged; they already prove instrument 0.2 is untouched. |
| **extraction** (WP-H) | **Block 1, strict parity (no AD), today's corpus and option matrix:** `lex031 = revertLexiconDelta(module.lexicon, LEXICON_DELTA)`. If it is null, FAIL at `/lexicon031`. Baseline `ext.extract` is compared with the engine's `extract(lex031, …)`. Also `createExtractor(lex031).lexiconVersion === "0.3.1"`, and `EXTRACTOR_KIND` stays equal to the baseline's. **Block 2, 0.3.2 audit:** the engine's `extract(lex031, t, o)` vs `extract(module.lexicon, t, o)` at `/extract032/<src>`, with `allow: ["AD13"]` and `ctx.AD13 = {delta, text: t, lexicon: module.lexicon}`. The corpus is block 1's corpus, plus every appended phrase in four frames (`"<ph>"`, `"not <ph>"`, `"my mother <ph>"`, `"used to <ph>"`, cue phrases also followed by each band of the same entry), plus the delta-derived F4 corpus. That corpus comes from the same generator as `capture` block 4 (§7.4), restated in this suite rather than shared, so neither suite depends on the other. Then `h.expect("AD13", {precondition: anyRawDifference, observed})`. The header comment's "No difference is allowed: extraction has no AD" becomes "block 1 has no AD; block 2 allows AD13 only". |
| **capture** (NEW, WP-I) | See §7.4. Registered in `tests/suites/index.json` right after `extraction`: `{"name": "capture", "path": "capture.js", "owner": "WP5", "what": "heard / carry-over / yield engine rules, the 0.3.0 gold set and dialogues, Scribe engine helpers"}`. |
| **render-scribe** (WP-J) | See §7.3. |
| **validate** (WP-K, fixtures only) | No suite code change. New entries in `tests/fixtures/mutations/safety.js` (§7.5). MASQUE: 0 errors and the same warning list. |
| **editor** (WP-K) | (a) `lockReason` is non-null for `/lexicon/scale/1/heard`, `/lexicon/scale/1/carry`, `/lexicon/scale/2/yieldTo`, `/lexicon/scale/2/anchor`, `/lexicon/scale/2/anchor/0` and `/lexicon/carryRefuse`. (b) In the existing lexicon block (a bool phrase added, then run), every scale entry's `heard`, `carry`, `yieldTo` and `anchor`, and `carryRefuse`, deep-equal the root's in the derived lexicon, with `0.3.2-local.<hash6>` and "not re-run". (c) Deletion: derive and bind a MASQUE child that adds a bool item `zz_new` (with a phrase) and appends `"zz_new"` to the `yieldTo` of the entry that has one. On that child, `deleteItem(draft, "zz_new")` restores that entry's `yieldTo` to the root's, `lockViolations(child, draft)` is `[]`, and the result validates with 0 V28. (d) A draft whose `yieldTo` is edited directly gives a "Read-only" lock violation. |
| **Playwright `editor.mjs`** (WP-K, cloud) | The MASQUE lexicon section shows `[data-heard-config]`, `[data-yield]`, read-only anchor chips (remove buttons disabled, no add input) and the read-only carry-refusal list (if approved). |
| **Playwright `voice.mjs`** (WP-J, cloud) | With the voice stub: final "I'm feeling really dizzy" gives one `.sa-scribe-heardtag`. Interim "a few hours" gives a `.captag.pending` reading `? episode duration: 5 min – 72 h · follow-up to “dizzy”` and no answer in `onScreen`. Final "a few hours" gives the carry tag and `answers.v_vertigo === 2`. With the speaker set to Physician, a final "for hours" neither carries nor consumes. Reset clears the heard group. |
| **integrity** (WP-I edits `foundations.js` only) | `ENGINE_EXPORTS['extraction.js']` adds `extractInContext` and `EXTRACTOR_FEATURES`; `['scribe.js']` adds `heardLabel`, `heardPrompts` and `askNextSections`; `['contract.js']` adds `LEXICON_CARRY_MAX` and `LEXICON_SCALE_KEYS`. |
| rules, golden, sweep, probes, patient, shape, omissions, research, research-parity, roundtrip, upload, cohort-gen, render-screener, render-patient | **No code change.** `rankSuggestions(…).list`, `captureLabel` for item/ctx/redflag and `ingestCaptures` are unchanged for the inputs they test. The release flows through AD4's new `NEW_RELEASE`. `roundtrip` deep-equals rubrics, so the new fields survive download, upload and hashing. `omissions` still finds `extraction.js` and `scribe.js` outside the Patient graph (`extraction.js` now imports `contract.js`; that changes nothing there). |
| **static** | No change; it enforces the rules: (1) engine, ui, apps and shell source, **comments included**, names no MASQUE id, no `masque`, no long phenotype value and no short phenotype value as a string literal (avoid the literal `"both"`), and every example in comments uses neutral words ("the pending item", "another entry"); (2) no `from "./…"` text in comments; (3) new text files are UTF-8 without BOM, with LF. |
| `harness/runner.js` manual checklist (WP-J) | Add (g): "Ambient Scribe → Listen → say 'I'm feeling really dizzy' → a dashed 'heard “dizzy” · episode duration: not stated' tag and a Heard card at the top of Ask next (below any Safety probes) → say 'a few hours' → 'episode duration: 5 min – 72 h · follow-up to “dizzy”', coverage rises, the Heard card disappears." |

### 7.3 `render-scribe` (WP-J)

**Parity.** The suite mounts the baseline and `Scribe` with

```js
const lex031 = revertLexiconDelta(module.rubric.lexicon, LEXICON_DELTA);   // null → FAIL /parity/lexicon031
const module031 = await bind.bindModule({ ...module.rubric, lexicon: lex031 }, module.logic,
  { origin: "builtin", classification: "builtin", key: "fixture:masque-lexicon-0.3.1",
    sources: { rubricText: null, logicText: module.sources.logicText } });
```

The rest is unchanged: same driver, same `ALLOW = ["AD4", "AD6", "AD5"]`, same `h.expect`s. The
footer then prints "extraction lexicon 0.3.1", as the baseline does. No heard tag or card can
appear, because `module031` has no `heard` field.

**Existing behaviour blocks** (skip, sign and routing, fail-closed, shape, mic) run on the
**shipped** module. They need no change, because the heard card is a `.prompt[data-suggestion]`:
- `complete()` answers it;
- the skip block may pick it, and Skip on a heard card writes nothing and hides it.

The shape block adds `c.check(!q("scribe-heard"), "/shape/heard", …)`.

**New behaviour blocks**, on the shipped module. Each uses
`bindModule({...module.rubric, demo: {...module.rubric.demo, transcript: T}}, module.logic, {…})`
and Step. Typed input uses the native value setter, `dispatchEvent(new Event("input", {bubbles:
true}))`, then a click on `scribe-capture`.

1. **heard** (T = [pt "I'm feeling really dizzy"])
   - exactly one `.sa-scribe-heardtag`, text `heard “dizzy” · episode duration: not stated`;
   - zero `.tsc .captag`;
   - `log.screens.at(-1).answers` has no `v_vertigo`;
   - readout and coverage equal their values before the step;
   - Ask next: `[data-testid=scribe-heard] [data-heard=v_vertigo]` exists, `[data-suggestion="v_vertigo"]`
     occurs exactly once, and the view button reads `Ask next (n)` with n = heard + suggestions.
2. **order** (T = [pt "my ear feels full and it rings", pt "I'm feeling really dizzy"]). In DOM
   order:
   - every `.prompt[data-probe]` of the Safety group precedes `[data-heard=v_vertigo]`;
   - the heard card precedes `[data-probe=pr_internal_vertigo]` (Re-ask) and every
     `.prompt[data-suggestion]:not([data-heard])`.
3. **carry** (T = §3.7 row 1, four turns including the md turn)
   - after the fourth step `answers.v_vertigo === 2`;
   - the last bubble's `.captag` reads `+ episode duration: 5 min – 72 h · follow-up to “dizzy”`;
   - no heard card;
   - coverage is greater than before step 4.

   This also proves the physician turn is not consumed.
4. **expiry** (T = dizzy, "ok", "fine", "a few hours"): no `v_vertigo` answer, and the heard card
   is **still** shown.
5. **skip** (T = dizzy, "a few hours"): Step 1, Skip the heard card, then Step 2. No `v_vertigo`
   answer, no heard card, no carry tag.
6. **answer** (T = dizzy): Step 1, then click the heard card's third button ("5 min – 72 h"). Then:
   - `answers.v_vertigo === 2`;
   - the card is gone;
   - the bubble tag remains.
7. **reset** (T = dizzy): Step 1, Reset, then type "a few hours" and Capture. Nothing is captured.
8. **F4** (T = [pt "I get dizzy and it lasts a couple of hours"]): the tag
   `+ episode duration: 5 min – 72 h` is present, and no `.captag` contains `attack duration`.
9. **demo** (the shipped transcript, all Steps):
   - `answers`, readout and coverage equal those of the same walk on `module031`;
   - exactly one heard tag, on the bubble of demo line 7;
   - Ask next shows the heard `v_vertigo` card.

The interim preview is covered by the Playwright `voice` spec.

### 7.4 `capture` suite (new; WP-I)

- **Block 1, engine rules on a generic fixture lexicon** (built inline; neutral ids such as
  `s_alpha` with `heard`, `carry: 2` and two bands; `s_beta` with `yieldTo: ["s_alpha"]` and an
  anchor; a bool and a red flag; `carryRefuse`). It proves the engine has no module branch.
  Checks:
  - heard only with `includeHeard` **and** `heard: true`;
  - heard gating, and `includeSuppressed` heard;
  - yield on present, absent, anchored, negated-anchor and `pendingIds` targets;
  - the `suppressedBy: "yield"` record;
  - every §3.3 rule and every refusal code;
  - expiry at exactly `carry` patient utterances;
  - refresh, supersede, two-unresolved clearing, embedded no-arm;
  - blank text not consumed;
  - `turnsLeft` clamped to `carry`;
  - **purity**: deep-frozen inputs, `JSON.stringify` of lexicon and pending unchanged, two calls
    deep-equal;
  - **default-off proof**: on a lexicon without the new fields, over a seeded 2,000-utterance
    corpus, `extract(lex, t)` deep-equals `extract(lex, t, {includeHeard: true, pendingIds: []})`,
    and `extractInContext(lex, t, null)` gives `{captures: extract(lex, t), pending: null}`.
- **Block 2, MASQUE gold set 0.3.0.**
  - Fetch `tests/fixtures/goldset/masque_extraction_goldset_0.3.0.json`. Its SHA-256 must equal
    `GOLD_0_3_0_SHA256`, otherwise **INVALID**, like the reference pin.
  - Its `_meta.basedOn.sha256` must equal the reference pin
    `e1d6573695e554e57dd44cfab3de6699dccc6518c42f2b28afa32d9ddcab6cb2`.
  - Per-utterance cases: `extract(module.lexicon, text, {includeHeard: true})`, unsuppressed. The
    item, ctx and red-flag `[id, value]` pairs are set-equal to `expect`, and the heard ids are
    set-equal to `expectHeard` (default `[]`).
  - Dialogues: run as the Scribe does, passing md turns over and keeping the slot. Each patient
    step's `{captures as [id, value, via?], heard ids, pending as [id, turnsLeft] | null, refused}`
    equals the labelled step.
  - **No regression:** each of the 44 reference cases gives the same output under `module.lexicon`
    as under `lex031`.
  - **Benchmark:** micro P/R/F1 over 44 + n, matching id **and** value (a value error counts as
    fp + fn); heard is excluded from P/R and checked exactly. By slice: clinical items, red flags
    (by membership in `module.redFlags`), encounter, narrative. Each figure is reported with its
    denominator. `EXPECTED_BENCHMARK = {tp, fp, fn, dialoguesApplied, dialoguesRefused}` is pinned
    from the approved run. Notes carry the report text, with the header of §6.4 and the
    "AUTHORED · development figures, not validation · in-sample, saturated" caveats copied from the
    reference report's wording. The implementer copies the block into CHANGELOG.md. **Round 2
    (§12.9):** "in-sample, saturated" understated the circularity; the printed block now says the
    0.3.0 labels are the 0.3.2 extractor's own output (regression snapshot) and that P/R/F1 on them
    is tautological, not a measurement. `EXPECTED_BENCHMARK` is a snapshot checksum.
- **Block 3, Scribe engine helpers** (`scribe.js`):
  - `ingestCaptures`: a batch `[heard x]` changes nothing and touches nothing; `[heard x, carry x=2]`
    sets x; a carry for an answered id leaves the answer.
  - `heardPrompts`: filtering (unanswered, not skipped, item exists), dedupe, newest-first order.
  - `askNextSections`:
    - with a safety group: `[safety…, heard, rest…]`;
    - with none: `[heard, …]`;
    - with no heard: exactly the probe groups.
  - `rankSuggestions(…, {exclude})` fills to `maxScored`, and `exclude: []` equals no `exclude`.
  - The MASQUE strings of §2.1 for `captureLabel` and `heardLabel`, exactly.
- **Block 4, targeted F4 property**, generated from the shipped lexicon's `yieldTo` data. For every
  target cue × entry cue × entry band × {no anchor, each anchor, each anchor negated with "not "} ×
  {plain, "my mother " prefix, "used to " prefix}:
  - the yielding entry is captured iff an unnegated anchor is present (and the gates pass);
  - the target's own captures deep-equal its `lex031` captures.

### 7.5 Validator mutation fixtures (`tests/fixtures/mutations/safety.js`)

The base `p_two` is `scale[0]`, with options f = 0 / 0.5 / 1 and bands v 2 and 1. The bool ids are
`p_one`, `p_three`, `p_four` and `p_minus`. Each fixture is `{code, sev, path, what, build}`.

| Sev | Path | Build |
|---|---|---|
| E V28 | `/lexicon/scale/0/heard` | `heard = "yes"` |
| W V28 | `/lexicon/scale/0/heard` | `heard = true; fallback = 1` |
| E V28 | `/lexicon/scale/0/carry` | `heard = true; carry = 9` |
| E V28 | `/lexicon/scale/0/carry` | `carry = 2` (no heard) |
| E V28 | `/lexicon/scale/0/carry` | `heard = true; carry = 2; bands[1].v = 0` (f = 0) |
| E V28 | `/lexicon/scale/0/yieldTo` | `yieldTo = []` |
| E V28 | `/lexicon/scale/0/yieldTo/0` | `yieldTo = ["p_missing"]` |
| E V28 | `/lexicon/scale/0/yieldTo/0` | `yieldTo = ["p_two"]` (self) |
| E V28 | `/lexicon/scale/0/yieldTo/1` | `yieldTo = ["p_one", "p_one"]` |
| E V28 | `/lexicon/scale/0/yieldTo` | add a scale item `p_cycle` to p_two's domain (adjust max), give it a lexicon scale entry, and set `yieldTo` both ways |
| E V28 | `/lexicon/scale/0/anchor` | `anchor = ["example anchor"]` (no yieldTo) |
| E V29 | `/lexicon/scale/0/anchor/0` | `yieldTo = ["p_one"]; anchor = ["Example Anchor"]` |
| W V28 | `/lexicon/scale/0/yeildTo` | the misspelt key |
| E V28 | `/lexicon/carryRefuse` | `carryRefuse = "x"` |
| W V28 | `/lexicon/carryRefuse` | `carryRefuse = ["example refusal"]` (no carry anywhere) |

### 7.6 Gold set 0.3.0 file

`app/tests/fixtures/goldset/masque_extraction_goldset_0.3.0.json`. It is UTF-8 without BOM, LF,
local-only and never deployed. The 44 reference cases are included **by reference** (SHA-pinned),
not copied.

```json
{ "_meta": { "name": "MASQUE extraction development set", "version": "0.3.0", "lexiconVersion": "0.3.2",
    "basedOn": { "file": "reference/MASQUE_v0.3.1/masque_extraction_goldset.json", "version": "0.2.0",
                 "sha256": "e1d6573695e554e57dd44cfab3de6699dccc6518c42f2b28afa32d9ddcab6cb2", "cases": 44 },
    "provenance": "<the 0.2.0 provenance, verbatim> Cases added in 0.3.0 were drafted by the screenAIr team and approved by the clinical lead on <date>.",
    "labelling": "<the 0.2.0 labelling, verbatim>",
    "registers": { "<the 0.2.0 registers, verbatim>": "" },
    "revisionLog": ["<the 0.2.0 entry, verbatim>", "0.3.0 — <n> utterances and <d> dialogues added for lexicon 0.3.2 (F1 heard, F2 carry-over, F3 vocabulary, F4 yield); no 0.2.0 case or label changed."] },
  "cases": [
    { "utteranceId": "y01", "register": "encounter", "feature": "F4", "text": "I get dizzy and it lasts a couple of hours", "expect": [["v_vertigo", 2]] },
    { "utteranceId": "y04", "register": "encounter", "feature": "F4", "text": "The room spins and it lasts the rest of the day", "expect": [], "expectHeard": ["v_vertigo"] }
  ],
  "dialogues": [
    { "dialogueId": "d01", "register": "encounter", "feature": "F2",
      "turns": [["pt", "I'm feeling really dizzy"], ["pt", "as if the world is moving around me and I'm sitting still"], ["md", "How long does it last?"], ["pt", "a few hours"]],
      "steps": [ { "captures": [], "heard": ["v_vertigo"], "pending": ["v_vertigo", 2], "refused": null },
                 { "captures": [], "heard": [], "pending": ["v_vertigo", 1], "refused": "no-band" },
                 null,
                 { "captures": [["v_vertigo", 2, "carry"]], "heard": [], "pending": null, "refused": null } ] }
  ] }
```

**Round 2 correction (§12.7).** The provenance template above ("approved by the clinical lead on
<date>") does not describe what happened. The 0.3.0 cases were drafted by the screenAIr team and
their text has not been reviewed by the clinical lead; the file's provenance must say so.

Id prefixes: `h` (F1 heard-only), `y` (F4 yield), `v` (F3 vocabulary), `d` (dialogues).

**Minimum content** (drafted for approval with Appendix A):
- every §4.4 row that does not need the Scribe, labelled with its "after" result and its
  approval-dependent variant;
- every §3.7 row except 26 (blank), 27 (depends on `carryRefuse`) and 31 (the demo, covered by
  render-scribe), as dialogues;
- per approved phrase, the §6.5 step 4 cases.

### 7.7 Expected final state

- **22 suites** (21 existing + `capture`) PASS on the default seed, with no INVALID.
- AD4, AD5 (when exercised), AD6 and AD13 are observed wherever their preconditions occur.
- `MANIFEST_SHA256`, the fixed-src pins and the reference gold pin are unchanged. The gold 0.3.0
  pin matches.
- MASQUE validates with 0 errors and only the V12/V33 warnings.
- `extract-rubric.html` reports "identical".
- The cloud Playwright suites pass, and every page is healthy.
- Manual checklist (g) is run once on the user's machine.

---

## 8. File-by-file change list and order of work

No file appears in two packages.

| WP | Files | Content | Depends on |
|---|---|---|---|
| **WP-A** Extraction engine | `app/src/engine/extraction.js` | `scan` refactor (byte-identical defaults); `includeHeard`; `pendingIds`; heard capture; the yield step; `unresolved`/`yielded`; `extractInContext`; `createExtractor().extractInContext`; `EXTRACTOR_FEATURES`; header comment updated (no ids, no "masque") | contract constant from WP-C (or a temporary local `3` replaced on merge) |
| **WP-B** Scribe engine | `app/src/engine/scribe.js`, `app/src/engine/vocab.js` | `CAPTURE_KIND.HEARD`; `heardLabel`; the `captureLabel` heard and carry branches; `heardPrompts`; `askNextSections`; `rankSuggestions` `exclude`; a private shared suggestion builder; the `ingestCaptures` JSDoc line | — |
| **WP-C** Contract, validator, derive | `app/src/engine/contract.js`, `app/src/engine/validate.js`, `app/src/engine/derive.js` | `LEXICON_CARRY_MAX`, `LEXICON_SCALE_KEYS`, typedef; §5.2 rules and `lexiconPhrases`; LOCKS; `itemDependents` / `deleteItem` / `lockViolations` (§5.3) | — |
| **WP-D** Scribe UI | `app/src/apps/Scribe.jsx` | `pendingRef`, `answersRef`, `skippedRef`, `livePending`, `toTag`, `ingest`, `reset`, the module effect; preview; bubble tags; `heardItems`/`heardPromptList`; `exclude`; sections and heard group; count and empty state; CSS in `SCRIBE_EXTRA_CSS`; `HEARD_LABEL`/`HEARD_CAPTION`; header comment | WP-A, WP-B (APIs fixed here) |
| **WP-E** Editor UI | `app/src/apps/RubricEditor.jsx` | §5.4 read-only rows | WP-C |
| **WP-F** Release and harness mechanism | `app/src/engine/policy.js` (`APP_VERSION` line only), `app/tests/harness/diff.js` | `APP_VERSION` **with** `NEW_RELEASE` 0.4.1 and AD4 text (atomic); `applyLexiconDelta`, `revertLexiconDelta`, AD13, the AD1-AD13 message | — |
| **WP-G** Module data (after approval) | `app/tests/harness/lexicon-delta.js` (new), `app/tests/tools/extract-rubric.js`, `app/modules/masque/masque.rubric.json` (regenerated, never hand-edited), `app/modules/masque/CHANGELOG.md`, `app/modules/masque/SOURCES.md`, `app/modules/masque/README.md`, `app/tests/fixtures/goldset/masque_extraction_goldset_0.3.0.json` (new) | the approved delta; the generator applying it; the regenerated rubric; the gold cases; logs | approval; WP-F helpers |
| **WP-H** Data-facing parity suites | `app/tests/suites/values.js`, `app/tests/suites/extraction.js` | §7.2 rows | WP-A, WP-F (green before WP-G thanks to the tolerant revert) |
| **WP-I** Capture suite and registration | `app/tests/suites/capture.js` (new), `app/tests/suites/index.json`, `app/tests/harness/foundations.js` | §7.4; the suite entry; the `ENGINE_EXPORTS` additions | WP-A, WP-B, WP-C; block 2 pins after WP-G |
| **WP-J** Scribe UI tests | `app/tests/suites/render-scribe.js`, `app/tests/harness/runner.js` (checklist g), `app/tests/playwright/specs/voice.mjs` | §7.3; Playwright voice steps | WP-D, WP-F; behaviour blocks need WP-G data |
| **WP-K** Validator and editor tests | `app/tests/fixtures/mutations/safety.js`, `app/tests/suites/editor.js`, `app/tests/playwright/specs/editor.mjs` | §7.5; §7.2 editor rows | WP-C, WP-E; editor (b) needs WP-G |
| **WP-L** Docs | `docs/refactor/03-design.md`, `docs/refactor/02-app-divergences.md`, `docs/refactor/04-module-authoring.md`, `docs/refactor/05-scribe-capture-fixes.md`; `05-candidate-minimal.md` and `05-candidate-robust.md` moved to `docs/refactor/design-candidates/` | §6.4 docs list; the `normalize` field and the extended delta paths; the §11 approval record | — |

**Not changed:**
- `hash.js`, `bind.js`, `probes.js`, `rules.js`, `masque.logic.js`, `modules/registry.json`;
- `tests/harness/divergences.js`, `tests/baseline/**`, `reference/**`.

**Order** (every step keeps all suites green):

0. **Approval round.** It blocks WP-G content only. The lead approves or strikes each Appendix A
   row, the two `v_vertigo` flags (§3.6), the F4 rule (§4.5), the F1 wording (§2.1) and the gold
   cases drafted for them.
1. **In parallel:** WP-A, WP-B, WP-C, WP-F, WP-L.
   - On the still-0.3.1 lexicon every new code path is inert (no new fields), so `extraction`,
     `values` and `render-scribe` stay green unchanged.
   - WP-F lands `APP_VERSION` and `NEW_RELEASE` in one commit.
2. **WP-D and WP-E.** The Scribe now calls `extractInContext`. On the 0.3.1 lexicon the render
   parity is identical (verified equivalence, §0.3).
3. **WP-H, then WP-K's non-data parts.** With `revertLexiconDelta`'s identity case, WP-H is green
   before the data lands.
4. **WP-G**, landing **together with** the data-dependent parts of WP-I (capture blocks 2 and 4,
   pins), WP-J (behaviour blocks 1-9) and WP-K (editor b). Then:
   1. regenerate the rubric;
   2. run the harness;
   3. pin `GOLD_0_3_0_SHA256` and `EXPECTED_BENCHMARK`;
   4. copy the benchmark block into CHANGELOG.md.
5. **Full run** on the default seed, the cloud Playwright run, and manual check (g).

---

## 9. Risks and open questions

### Risks

- **R1. Saved derivations stop verifying.** A MASQUE derivation saved with "Remember", or
  downloaded on 0.4.0, records the 0.3.1 root (`lexiconVersion`, `lexiconHash`, `rubricSha256`).
  `classifyLineage` then returns row 4 with the misleading reason "This file was changed after it
  was created in screenAIr (root record lexiconVersion, root record lexiconHash does not match)",
  and a goldSet mismatch is V53 when the root is supplied. This is inherent to any built-in lexicon
  update. It is documented in CHANGELOG.md and README.md ("re-derive edits made before 0.4.1").
  The alternative is a lineage "root updated" state (Q11). No suite fails, because the suites
  derive afresh.
- **R2. Residual carry misattribution.**
  - A bare duration that answers something the lexicon does not know ("the bus ride is a few
    hours") is carried within the window.
  - So is a physician question captured with the speaker toggle on Patient ("does it last for
    hours"). The `?` guard helps only when the recogniser punctuates.
  - Mitigations:
    - carry is opt-in per entry and window-limited;
    - the other-entry, own-cue, question and refusal-phrase guards apply;
    - every carried value is tagged "follow-up to “…”" on the bubble that supplied it.
  - The Scribe has no "clear an answer" control (a baseline limitation, Q10), and the
    `pr_internal_vertigo` rescue is live only while `v_vertigo` is unanswered or 0.
- **R3. F4 recall cost.** A dizziness sentence that carries a genuine attack duration but no
  approved anchor leaves `m_dur` unanswered (§4.4 rows 5, 13-15 if struck, and §3.7 row 20). That
  is the safe direction: the item is still asked.
- **R4. Pre-existing per-utterance false positives remain.** `v_vertigo` bands pick up durations
  of other symptoms in the same sentence ("I'm dizzy and my headache lasts all day" →
  `v_vertigo=2`). F4 fixes only the `m_dur` direction. A symmetric fix would need a `v_vertigo`
  anchor list, which is new content. Flagged, not changed.
- **R5. Voice segmentation.** The window counts recogniser finals, not conversational turns, so
  fillers ("um") consume it. Blank finals do not.
- **R6. Heard noise.** F3 cue additions without bands produce heard tags and cards that never score
  by themselves. That is intended by F1, but it adds visual load.
- **R7. The interim preview can differ from the commit.** The recogniser revises words, so a
  previewed carry may not happen.
- **R8. Parity subject change.** The render and extraction parity now run on the reverted lexicon.
  This is sound only because `values` proves the revert exact. It must be recorded in 03 §8.3/§8.4
  and in 02, or reviewers will read it as widening.
- **R9. Release coupling.** `APP_VERSION` and `NEW_RELEASE` must move in one commit (WP-F).
- **R10. Forward compatibility.** An older app loading a 0.3.2 lexicon ignores the new fields, so
  the `m_dur` false positive returns there and nothing is heard or carried. This only matters for
  uploads across versions. The new unknown-key warning helps only on new apps.
- **R11. Generator staleness.** If `extract-rubric.js` did not apply the delta, regenerating would
  silently revert 0.3.2. WP-G makes it apply the delta and cross-check.
- **R12. Band order.** An appended band phrase can change a value where an earlier band now wins.
  The collision cases and the "no 0.2.0 regression" check catch it, and the lead sees them.

### Open questions (for the clinical lead or the orchestrator)

- **Q1.** Approve `v_vertigo` `heard: true` and `carry: 2`? Is N = 2 right, given that it counts
  recogniser segments?
- **Q2.** Approve `m_dur.yieldTo = ["v_vertigo"]`, including its cross-turn effect (§4.4 row 21)?
  Approve or strike each anchor (A3). `migraine` and `head pain` are new.
- **Q3.** Approve or strike each `carryRefuse` phrase (A4)? If all are struck, R2's "a few hours
  ago" case stands.
- **Q4.** Is the F1 wording of §2.1 acceptable?
- **Q5.** Should `m_dur` get `heard` or `carry`? Drafted as no.
- **Q6.** Should `m_dur.yieldTo` also name yes/no symptoms (for example `v_aural`: "my ear rings
  and it lasts a couple of hours")? The mechanism supports it with no engine change. Drafted as no.
- **Q7.** The heard group sits after Safety and before Re-ask, as drafted. Or should it sit after
  Re-ask?
- **Q8.** Should a later heard event re-promote an item the clinician skipped? Drafted as no:
  skip is final for the encounter until Reset.
- **Q9.** Should the note or the FHIR bundle mention heard-but-unstated items? Drafted as no: they
  derive from answers only, and the incomplete-screen line already says unanswered items are not
  denials.
- **Q10.** Should a carried answer have a "clear back to unanswered" affordance? Out of scope.
- **Q11.** For R1: accept and announce, or add a lineage "root updated" state?
- **Q12.** Ship 0.3.2 without F3 if approval lags (F3 → 0.3.3 and gold 0.3.1)?
- **Q13.** Publish the gold set and benchmark beside the module (deployed, in the registry `docs`),
  as upstream did, rather than keeping them local-only?
- **Q14.** "I'm not dizzy but it lasts a couple of hours" now leaves `m_dur` unanswered (§4.4 row
  5). Accept?
- **Q15.** Existing behaviour, flagged with no change proposed: "a few minutes" scores
  `v_vertigo = 2` (5 min – 72 h) through the band phrase "minutes", although a few minutes may be
  under the 5-minute Bárány floor. Also R4.
- **Q16.** Should anchors (and `carryRefuse`) become editable phrase lists in the Rubric Editor?
  Drafted as read-only for 0.4.1.

---

## 10. Corrections to the candidates

Each item below was checked against the code, and against the prototype where behaviour was
involved.

**Minimal candidate (`design-candidates/05-candidate-minimal.md`)**

1. **Misattribution gap.** The guard blocks only *other scale cues*. "the nausea lasts hours" after
   "dizzy" therefore carries `v_vertigo = 2`: `m_nausea` is a bool, and `m_dur`'s "lasts" yields
   to the pending item. Corrected by the broad topic guard (§3.3 step 4.3).
2. **Arming gap.** In "I'm dizzy and my headache lasts forever", `m_dur` has no `carry`, so
   minimal sees one heard item and arms `v_vertigo`. A following "a couple of hours", which
   answers the headache, is then carried into the vertigo duration. Corrected by arming from all
   unresolved cues (§3.3 step 6; §3.7 row 18).
3. **Wrong file for the delta.** It places `LEXICON_DELTA` in `tests/harness/divergences.js`. That
   file pins the baseline against fixed-src for the `integrity` suite. Allowed differences live in
   `diff.js` `ALLOWED_DIFFERENCES`. The delta now has its own file (§6.2).
4. **Weak provenance exemption.** Its `HAND_WRITTEN` regexes cover whole lists
   (`…<path>(/\d+)?$`), so any later unapproved phrase in an approved list would also escape the
   provenance sweep. Exemption is now by exact pointer and value (§7.2).
5. **Lock conflict.** `deleteItem` strips `yield` references, but `lockViolations` would then
   report the change to a non-editable field. Exemption added (§5.3).
6. **Negative values.** Carry can write any band value, including a band that maps to an f = 0
   option, so a bare reply could record a denial. Banned by the validator (§5.2).
7. **Demo numbering.** "Demo line 7 … /1 after line 8, then expired after line 9" counts the
   physician line 8, which does not consume. The slot drops to 1 after line 9 and expires after
   line 10 (1-based).
8. **Heard tags as captures.** Heard tags carry the class `captag`, so the render suites'
   `.tsc .captag` would count them as captures. Changed to a separate class (§2.2).

**Robust candidate (`design-candidates/05-candidate-robust.md`)**

1. **Render parity fails on the footer.** Parity runs on the shipped 0.3.2 module with `ALLOW =
   ["AD4","AD6","AD5","AD14"]`, but the baseline footer prints "extraction lexicon 0.3.1" (Scb
   L1275) and the new one prints 0.3.2. No AD normalises that, so every comparison fails at the
   footer. Any approved F3 phrase occurring in a demo line would also change capture tags with no
   normaliser. Parity now runs on the reverted lexicon (§7.3).
2. **Denials become durations.** "I don't get dizzy for hours" after "dizzy" carries `v_vertigo =
   2`. The negated own cue produces neither an item nor a heard capture, the guard ignores the
   pending entry's own cue, and "hours" is outside the 14-character negation window. Corrected by
   the own-cue rule (§3.3 step 4.2).
3. **Helpers can no longer reach the heard item.** The heard prompts are deliberately not
   `.prompt[data-suggestion]`, and the item is moved out of the suggestions. The existing
   `render-scribe` helpers `complete()` and the skip block can then never reach it, and the design
   neither updates nor analyses them (`complete()` feeds the hard `/fail-closed/*/scorable` check).
   Heard cards now keep `data-suggestion` (§2.4).
4. **Skip does not hide.** Heard Skip records only `heardDismissed`, so the item drops back into
   the ranked suggestions after a Skip, contradicting "Skip hides it". Skip now uses `skipped`.
5. **No per-entry opt-in.** Heard fires for every fallback-null entry, so any "it lasts a while"
   with no dizziness cue would promote "heard “lasts” · attack duration: not stated" to the top of
   Ask next. `heard` is now per-entry module data.
6. **The Screener does not extract.** "Per-utterance extraction (Screener, benchmark) unchanged" /
   "the Screener … never call extractInContext": only `apps/Scribe.jsx` imports `createExtractor`.
7. **Confusing gold file name.** It names the 0.3.0 gold file `masque_extraction_goldset.json` in
   `app/modules/masque/` (deployed), reusing the reference file's name for a different version.
   Renamed and kept local-only (§7.6; Q13).
8. **Unneeded id change.** Replacing the transcript line id with `transcriptCountRef` is not needed
   and touches parity-sensitive code. `ingest` keeps `t.length`.
9. **Turn count.** §0 says "all 9 patient turns" of the demo. The demo transcript has 14 lines,
   8 of them patient turns.

**The orchestration brief**

1. `harness/divergences.js` does not list allowed divergences from the v0.3.1 baseline. It pins
   fixed-src against the baseline. The ADs are in `harness/diff.js`.
2. The F4 keep-working examples "my headaches last a couple of hours" and "my attacks last two
   days" capture no `m_dur` **today** (§4.1). They become F3 drafts (A5).

---

## Appendix A — Drafts for the clinical lead (NOT approved; not to be committed until marked)

> **Superseded on 4 October 2026 by §11.** This appendix is kept as the record of what was drafted.
> Its drafts are **not** approved unless they appear verbatim in §11.3; the approved anchors are
> those of §11.4, not A3.

Every phrase is lowercase and appended to the end of its list. Approving a row also approves its
gold cases (§6.5).

**A cue addition does score whenever a band phrase is in the same utterance, or follows within the
carry window.** It also widens `m_dur`'s yield target, because `yieldTo` reads `v_vertigo`'s cue
list.

**A1. `v_vertigo` cue** (`/scale/1/cue`)

| # | Phrase | Origin | Risk noted | Lead |
|---|---|---|---|---|
| 1 | `unsteady` | problem report ("I feel unsteady") | non-vestibular unsteadiness (neuropathy, weakness) | ☐ approve ☐ strike |
| 2 | `on a boat` | module probe `pr_internal_vertigo` ("like still being on a boat") | low | ☐ ☐ |
| 3 | `rocking` | same probe ("bobbing, rocking, or swaying") | "rocking chair" | ☐ ☐ |
| 4 | `swaying` | same probe | low | ☐ ☐ |
| 5 | `bobbing` | same probe | low | ☐ ☐ |
| 6 | `world is moving` | problem report | low | ☐ ☐ |
| 7 | `room is moving` | variant of 6 | low | ☐ ☐ |
| 8 | `moving around me` | problem report | "people moving around me" (visual motion, not vertigo) | ☐ ☐ |
| 9 | `spins` | lay variant ("everything spins"; `room spins` exists) | low | ☐ ☐ |
| 10 | `lose my balance` / `losing my balance` | lay variants of `off balance` | falls without vertigo | ☐ ☐ |
| 11 | `woozy` | lay term | presyncope or medication effect | ☐ ☐ |

Not drafted, and recorded so they are not re-proposed:
- `lightheaded` (presyncope; overlaps the `n_auto` phrase "lightheaded when i stand");
- `faint`, `giddy`.

**A2. `v_vertigo` bands** (appended to the band's `ph`; band order unchanged)

| # | Target | Phrase | Note | Lead |
|---|---|---|---|---|
| 1 | v = 2, 5 min – 72 h (`/scale/1/bands/2/ph`) | `rest of the day` | §4.4 row 4 | ☐ ☐ |
| 2 | 〃 | `a day or two` | ≤ 48 h | ☐ ☐ |
| 3 | 〃 | `couple of days` | ≤ 72 h | ☐ ☐ |
| 4 | v = 3, over 72 h (`/scale/1/bands/1/ph`) | `for weeks` | | ☐ ☐ |
| 5 | 〃 | `a week` | "a weekend" collision | ☐ ☐ |

`a few days` and `two days` are left out because they straddle the 72 h cut-point. That is the
lead's decision.

No band is needed for the reported follow-ups. "a few hours" and "about an hour" already match
"hours" and "an hour". The failure was the same-utterance rule, which F2 addresses.

**A3. F4 anchors** (`/scale/2/anchor`)

| # | Phrase | Source | Lead |
|---|---|---|---|
| 1 | `headache` | existing `m_head` cue (covers "sinus headache") | ☐ ☐ |
| 2 | `facial pressure` | existing `m_head` cue | ☐ ☐ |
| 3 | `facial pain` | existing `m_head` cue | ☐ ☐ |
| 4 | `pressure in my face` | existing `m_head` cue | ☐ ☐ |
| 5 | `behind my eyes` | existing `m_head` cue | ☐ ☐ |
| 6 | `migraine` | new (single word; "i get migraine" exists in `m_fhx`) | ☐ ☐ |
| 7 | `head pain` | new | ☐ ☐ |

**A4. `carryRefuse`** (`/carryRefuse`, new list)

| # | Phrase | Why | Risk | Lead |
|---|---|---|---|---|
| 1 | `ago` | "a few hours ago" is an onset, not a duration | "agony", "Chicago" (refusal is the safe direction) | ☐ ☐ |
| 2 | `since` | "since this morning" | low | ☐ ☐ |
| 3 | `started` | "it started a few hours back" | low | ☐ ☐ |
| 4 | `began` | as 3 | low | ☐ ☐ |

**A5. Other F3 drafts**

| # | Target (path) | Phrase | Origin | Risk | Lead |
|---|---|---|---|---|---|
| 1 | `v_head` (`/bool/8/ph`) | `roll over` | problem report; `rolling over` exists | low | ☐ ☐ |
| 2 | 〃 | `turn over in bed` | lay variant | low | ☐ ☐ |
| 3 | 〃 | `lie back` / `lying back` | probe `pr_positional` ("lying back") | low; `lie down` is an `m_disable` phrase and is not drafted | ☐ ☐ |
| 4 | 〃 | `turn my head` | lay variant of `move my head` | low | ☐ ☐ |
| 5 | `m_dur` cue (`/scale/2/cue`) | `headaches last` | §4.1 gap | low | ☐ ☐ |
| 6 | 〃 | `attacks last` | §4.1 gap | vertigo "attacks"; F4 yields when a dizziness cue is present | ☐ ☐ |
| 7 | 〃 | `migraines last` | §4.1 gap | low | ☐ ☐ |
| 8 | 〃 | `last about` / `last around` / `last up to` | §4.1 gap | "the last about…" is rare; F4 still applies | ☐ ☐ |

The bare verb `last` is not drafted: it would match "last week", "last visit" and "at last".

---

## 11. Approval record (2026-10-04)

- **Approved by:** "clinical lead". **Date:** 2026-10-04. This date fills every `<date>` and
  `<YYYY-MM-DD>` placeholder above: `LEXICON_DELTA.approved`, each `approvedOn`, the rubric
  `changelog` entry (§6.3), the gold set provenance (§7.6) and CHANGELOG.md. **Round 2
  correction (§12.7):** the date is the date of the phrase approval only. It does not mean the gold
  set 0.3.0 case text was reviewed by the clinical lead; it was not.
- **Scope.** This record settles the approval round of §8 step 0. It **supersedes Appendix A** and
  overrides any earlier section it contradicts. It is recorded from the lead's decisions D1-D7 of
  the implementation round.

### 11.1 Appendix A is superseded (D2)

Appendix A is kept only as the record of what was drafted. A draft is approved **only** if it
appears verbatim in §11.3 or §11.4. In particular these drafts are **not approved**:

- `v_vertigo` cue drafts: bare `unsteady`, `on a boat`, `rocking`, `swaying`, `bobbing`,
  `moving around me`, `spins`, `woozy` (the approved cue list in §11.3 uses longer, more specific
  phrases instead);
- `v_vertigo` band drafts: `rest of the day`, `a day or two`, `couple of days`, `for weeks`,
  `a week`;
- F4 anchor draft: bare `migraine` (the approved anchors are `migraine lasts` and
  `migraines last`, §11.4);
- `v_head` drafts: `turn over in bed`, `lie back` / `lying back`, `turn my head`;
- `m_dur` cue additions: `headaches last`, `attacks last`, `migraines last`, `last about`,
  `last around`, `last up to`. No phrase is appended to `/scale/2/cue` ("migraines last" is
  approved as an F4 anchor only).

Consequences for the verified tables (they were produced with the Appendix A anchors):

- §4.4 rows 13 and 14 depended on the draft `migraine`. With the approved anchors they must be
  re-derived by the gold set 0.3.0 run; neither row is a promise.
- §4.4 rows 22 and 23 ("headaches last", "attacks last") stay gaps: `m_dur` is still missed there.
- §4.4 row 4 ("rest of the day") stays heard-only; that band phrase is not approved.

### 11.2 Open questions resolved (D1)

| Q | Resolution |
|---|---|
| Q1 | **Approved.** `v_vertigo` `heard: true`, `carry: 2`. |
| Q2 | **Approved.** `m_dur.yieldTo = ["v_vertigo"]`, including the cross-turn effect (§4.4 row 21). Anchors: the approved list of §11.4 (not the Appendix A list). |
| Q3 | **Approved.** `carryRefuse = ["ago", "since", "started", "began"]`, included as a conservative guard: it can only prevent a capture, never cause one. The lead informs the clinical lead. **Round 2:** confirmed by the clinical lead on 2026-10-04 (proposed by the team as a carry-over guard); from release 0.4.1 round 2 it also guards direct extraction for `heard` entries (§12.4). **Round 3 (§13.5):** round 2 made "never cause one" false, because the withheld value armed carry-over; with R9 f no carry-over opens from that utterance, so the property holds again: in a heard entry's own utterance it withholds the duration and no carry-over opens; in a carried reply it refuses the carry. |
| Q4 | **Approved** as drafted in §2.1. |
| Q5 | No: `m_dur` gets neither `heard` nor `carry`. |
| Q6 | No: `m_dur.yieldTo` names no yes/no symptom. |
| Q7 | The Heard group sits **after Safety, before Re-ask**, as drafted (§2.4). |
| Q8 | No: a later heard event does not re-promote a skipped item. |
| Q9 | No: the note and the FHIR bundle are unchanged. |
| Q10 | Out of scope. |
| Q11 | **Accept and document** R1: a CHANGELOG.md (and README.md) note, "re-derive edits made before 0.4.1". No lineage "root updated" state. |
| Q12 | **Moot.** F3 is approved now and ships in lexicon **0.3.2** with gold set **0.3.0**; the "F3 → 0.3.3 / gold 0.3.1" path of §6.5 is not used. |
| Q13 | The gold set and benchmark stay **local-only**. |
| Q14 | **Accepted**: "I'm not dizzy but it lasts a couple of hours" leaves `m_dur` unanswered. |
| Q15 | Flag only; no change ("a few minutes" is also struck as a new phrase, §11.7). |
| Q16 | Anchors and `carryRefuse` stay **read-only** in the Rubric Editor. |

### 11.3 Approved vocabulary (D3)

Lexicon 0.3.1 → **0.3.2**. Each phrase is appended at the **end** of its list, in the order
given; nothing is inserted, reordered or reworded. Indices are the 0.3.1 positional indices and
each row's `entryId` asserts the entry at that position (verify by id, never by index alone).
`v_vertigo` is scale entry 1 and its `bands` array is ordered `[v = 1, v = 3, v = 2]`: `bands/0` is
v = 1, `bands/1` is v = 3, `bands/2` is v = 2. `m_dur` is scale entry 2. The `bool` indices of
`v_head`, `v_motion`, `v_aural` and `v_migfeat` are looked up by id.

| Path | Entry | Phrases appended, in order |
|---|---|---|
| `/scale/1/cue` | `v_vertigo` (symptom cues) | "world is moving", "world moving around", "world's moving", "world was moving", "everything spins", "everything spun", "room spun", "room is moving", "everything is moving", "like i'm on a boat", "like i was on a boat", "like i am on a boat", "like being on a boat", "rocking feeling", "rocking sensation", "swaying side to side", "feel unsteady", "unsteady on my feet", "losing my balance", "lose my balance", "balance is off" |
| `/scale/1/bands/0/ph` | `v_vertigo` v = 1 (under 5 min) | "split second", "a second or two", "a couple minutes", "under five minutes", "less than five minutes", "two minutes", "three minutes", "four minutes" |
| `/scale/1/bands/2/ph` | `v_vertigo` v = 2 (5 min – 72 h) | "half the day", "half a day", "about a day", "all night", "for a day or two", "for a couple of days", "for two days", "for three days", "overnight" |
| `/scale/1/bands/1/ph` | `v_vertigo` v = 3 (over 72 h) | "lasts more than three days", "lasted more than three days", "days at a time" |
| `/bool/<i>/ph` | `v_head` | "roll over", "rolled over", "turning over", "over in bed", "when i turn my head", "when i look up", "when i lie back", "lying back in", "tip my head back", "high shelf", "bending over" |
| `/bool/<i>/ph` | `v_motion` | "driving through a tunnel", "drive through a tunnel", "patterned", "busy visual", "dizzy riding in a car", "sick riding in a car" |
| `/bool/<i>/ph` | `v_aural` | "ears feel full", "ears ring", "roaring" |
| `/bool/<i>/ph` | `v_migfeat` | "headache during the dizz", "headaches during the dizz" |
| `/negation/cues` | negation (lead extra, §11.5) | "fewer than" |
| `/thirdParty/cues` | third party (lead extra, §11.5) | "my grandmother", "my grandma", "my aunt", "my uncle", "my friend" |

**Accepted risk.** "two minutes" (v = 1) also matches the spelled-out "twenty-two minutes". The lead
accepted this. Typed digits are not affected: `normalize.numbers` leaves 22 as digits (§11.6), so
"22 minutes" reads v = 2. **Round 2 (§12.9):** the same holds for "twenty-three/-four minutes" and
"thirty-two/-three/-four minutes"; all are listed as accepted known risks in CHANGELOG.md.
**Round 3 (§13.6):** the whole family "twenty-two" through "ninety-four minutes", with or without
the hyphen, behaves the same; it is recorded as accepted with the approved phrases and flagged for
the lead's explicit confirmation.

### 11.4 F1, F2 and F4 configuration

| Path | Value | Feature |
|---|---|---|
| `/scale/1/heard` (`v_vertigo`) | `true` | F1 |
| `/scale/1/carry` (`v_vertigo`) | `2` | F2 |
| `/scale/2/yieldTo` (`m_dur`) | `["v_vertigo"]` | F4 |
| `/scale/2/anchor` (`m_dur`) | `["headache", "facial pressure", "facial pain", "pressure in my face", "behind my eyes", "migraine lasts", "migraines last", "head pain"]` | F4 |
| `/carryRefuse` | `["ago", "since", "started", "began"]` | F2 guard |

### 11.5 Lead extras and the extended delta

- **Negation and third-party cues.** The lead approved appending "fewer than" to
  `/negation/cues` and "my grandmother", "my grandma", "my aunt", "my uncle", "my friend" to
  `/thirdParty/cues`. This **overrides** the §6.2 comment "Never the negation / thirdParty /
  historical cue lists": `LEXICON_DELTA.appended` may now also target `/negation/cues` and
  `/thirdParty/cues`. The historical cue list stays outside the delta.
- **`normalize`.** A new top-level lexicon field `/normalize = {"apostrophes": true, "numbers":
  "en"}` (§11.6).
- **Extended delta paths.** `appended` paths: `/bool/<i>/ph`, `/ctx/<i>/ph`, `/multi/<i>/ph`,
  `/scale/<i>/cue`, `/scale/<i>/bands/<j>/ph`, `/redFlags/<id>`, **`/negation/cues`**,
  **`/thirdParty/cues`**. `fields`, in order: `/version`, `/scale/1/heard`, `/scale/1/carry`,
  `/scale/2/yieldTo`, `/scale/2/anchor`, `/carryRefuse`, **`/normalize`**, `/goldSet`. Added
  top-level keys are inserted just before `goldSet` in delta order, so the 0.3.2 lexicon ends
  `…, carryRefuse, normalize, goldSet`. The change-log `paths` list every touched path, these
  included.
- **AD13** must account for every delta kind. An appended negation or third-party cue can change
  the captures of any entry in an utterance that contains it, and `normalize` can change captures
  in any utterance that contains a typographic apostrophe or a standalone small number; the AD13
  extraction normaliser has to explain those differences (and nothing more), and its exact rule is
  in `tests/harness/diff.js`. **Round 2 (§12.10):** the round-1 rule excused whole texts on any
  ASCII digit; it is narrowed to the texts and families the engine actually changes.

### 11.6 The `normalize` engine feature (D4)

Opt-in by lexicon, so the 0.3.1 lexicon stays byte-identical in behaviour.

- **Field.** `lexicon.normalize`, optional object; keys `apostrophes` (boolean) and `numbers` (the
  string `"en"`). Absent: no normalisation, behaviour byte-identical to 0.4.0.
- **`apostrophes: true`.** Before matching, U+2018, U+2019, U+02BC and U+2032 are folded to U+0027
  in the text. The length is unchanged, so offsets are unchanged. This fixes "I don’t feel
  unsteady" typed on iOS or macOS, which otherwise misses the "n't"/"don't" negation cue and reads
  positive.
- **`numbers: "en"`.** Before matching, standalone integer tokens 0-20 and the round tens 30, 40,
  50, 60, 70, 80 and 90 are replaced with English words (zero … twenty, thirty … ninety). Every
  other number stays digits:
  - 21-29, 31-39 and the other non-round numbers ("twenty-two minutes" would contain the approved
    phrase "two minutes" and misscore);
  - 100 and above, decimals, times (`10:30`), fractions (`1/2`), ranges (`3-4`) and percentages;
  - digits adjacent to letters (`B12`, `2nd`, `x2`).

  A token is **standalone** when it is bounded on each side by the start or end of the text, or by
  a character that is not a letter, a digit or one of `.` `:` `/` `,` `%` `-`. **Sentence
  punctuation exception:** a trailing `.` followed by the end of the text or by whitespace is
  sentence punctuation, not part of a decimal, so "it lasts 2." still counts. This case is handled
  explicitly in the engine and documented there.
- **Coordinates.** All matching (phrases, cue and band lookup, the negation, third-party and
  historical windows) runs on the normalised lowercase text. Every reported index (`cueIndex`, and
  the positions behind the `cue`/`cueText` fields of heard captures) is mapped back to
  **original-text coordinates** through an offset map; `evidence` stays the original text, and
  `cueText` is sliced from the original text. **Superseded in round 2 (§12.5):** number spelling
  now applies to band phrase matching only; everything else, every gate window included, runs on
  the apostrophe-folded text, whose indices are original indices.
- **`EXTRACTOR_FEATURES`** gains one entry for each capability (apostrophe folding, number
  spelling).
- **Validator (V28 style).** Unknown `normalize` keys are rejected; `apostrophes` must be a
  boolean; `numbers` must be `"en"` and requires `lexicon.lang` to start with `"en"`.
- **Gold set 0.3.0 and the `capture` suite** gain the cases:
  - curly-apostrophe denial "I don’t feel unsteady" → no `v_vertigo` heard capture and no value;
  - "it lasts 2 minutes" with a `v_vertigo` cue → `v_vertigo = 1`;
  - "22 minutes" → `v_vertigo = 2`;
  - "for 3 days" → `v_vertigo = 2`;
  - a carry-over reply "20 minutes" → `v_vertigo = 2`.

### 11.7 Drafts considered and struck

Struck by the lead's reviewer process. Each is recorded in `app/modules/masque/CHANGELOG.md`
("Drafts considered and struck") with its reason, so it is not re-proposed:

| Draft | Reason |
|---|---|
| "a few minutes" | Straddles the 5-minute floor. |
| "four days", "for a week", "for weeks" | Usually describe how long the illness has lasted, and v = 3 is evaluated before v = 2, so they would override a correct episode duration. |
| "constantly" | A frequency, not a duration. |
| "too many times to count" | Fires on "antibiotics too many times to count". |

### 11.8 Versions, generated rubric and pins (D5-D7)

- **Versions.** Release `APP_VERSION` **0.4.1**, atomic with `diff.js` `NEW_RELEASE` (AD4);
  lexicon **0.3.2**; gold set **0.3.0** (lexicon 0.3.2); instrument 0.2; probe set 1.0.0;
  `EXTRACTOR_KIND` unchanged.
- **Generated rubric.** `masque.rubric.json` is generated by `app/tests/tools/extract-rubric.js`.
  The committed file must be byte-for-byte what the generator produces (`JSON.stringify(x, null,
  2) + "\n"`, non-ASCII written as UTF-8, never `\u` escapes, key order per §6.2 and §11.5); the
  lead runs `extract-rubric.html` and requires "identical".
- **Benchmark pins.** `GOLD_0_3_0_SHA256` and `EXPECTED_BENCHMARK` in `suites/capture.js` need the
  browser run. Until then both read the string `"PIN_AFTER_RUN"`; the suite reports verdict
  **INVALID** with a clear note and the computed values in its notes, so the lead can paste them.
  It never passes silently.

---

## 12. Round 2 (review fixes and clinical-lead decisions, 2026-10-04)

**Prototype · not for clinical use.** This section is the specification for round 2 of release
0.4.1. It overrides every earlier section, §11 included, where they differ. Earlier sections carry
"Round 2" pointers to the subsection that replaces them.

### 12.1 Why, and what the lead decided

An adversarial review of the round-1 commit (26464c5) upheld 22 findings and refuted none. All 22
suites passed on 26464c5, so every finding was a defect the tests could not see. The findings fall
into five groups:

- **wrong scored values** from carry-over, band order, the onset/illness-duration confusion and
  number spelling;
- **records** that claimed more clinical approval than was given, and a benchmark described as
  more than it is;
- a **lock exemption** wider than its rationale;
- **yield lost** after the heard card is answered or skipped;
- **tests** that were vacuous or too permissive in places.

Three clinical-lead decisions of 2026-10-04 feed round 2:

| # | Decision | Where |
|---|---|---|
| L1 | **Day ranges are same-sentence only.** The `v_vertigo` v = 2 band phrases "about a day", "overnight", "for a day or two", "for a couple of days", "for two days" and "for three days" may set a value only when they occur in the same sentence as a cue, never as a carried reply. | §12.3 (`carryExclude`) |
| L2 | **Digits for durations only.** `normalize.numbers` spells digits only for band phrase matching. Typed digits no longer reach cue, yes/no, context, multi-item or red-flag phrases, or any gate window. | §12.5 |
| L3 | **`carryRefuse` confirmed.** `["ago", "since", "started", "began"]` was proposed by the team as a carry-over guard and is now confirmed by the clinical lead on 2026-10-04. | §12.4, §12.7 |

The lead also accepted, as known risks, that typed "twenty-two/-three/-four minutes" and
"thirty-two/-three/-four minutes" read Under 5 min (§12.9).

**Not changed by round 2.** The gold set 0.3.0 case text is still **not reviewed** by the clinical
lead (§12.7). The 14-character negation window for yes/no phrases is baseline behaviour and stays;
its failures are disclosed (§12.9). The version axes are unchanged: release 0.4.1, instrument 0.2,
lexicon 0.3.2, probe set 1.0.0, gold set 0.3.0 (lexicon 0.3.2). The lexicon 0.3.2 content gains
`v_vertigo.carryExclude`, so `lexiconHash` changes and the gold set and benchmark are re-pinned
(§12.10).

**Finding → fix**

| Finding (review file) | Fix |
|---|---|
| F2 clinical: a denial outside the 14-character window is carried | R1, §12.2 |
| F1 clinical: "How long has this been going on?" → "For two days." carried as episode duration | R3a, §12.3 (L1) |
| F4 clinical: new v = 1 phrases override a correct v = 2 in the same sentence | R2, §12.4 |
| F7 clinical: same-sentence onset statements score through v = 2 bands | R3b, §12.4 |
| F5 clinical, F6 clinical, ENG-1: number spelling widens gate windows and fires number-word phrases on digits | R4, §12.5 (L2) |
| UI-1: answering or skipping the heard card turns off the yield | R5, §12.6 |
| F8 clinical: records claim clinical-lead approval for `carryRefuse` and gold cases | R6, §12.7 |
| F9 clinical, F3 clinical, F11 clinical: known risks undisclosed | R6, §12.9 |
| F6 tests: benchmark circularity understated | R6, §12.9 |
| F10 clinical, ENG-2, UI-2: lock exemption too wide | R7, §12.8 |
| F1 tests, F2 tests, F3 tests, F4 tests, F5 tests | R8, §12.10 |
| UI-3: locked phrase lists give no visible read-only cue | Not addressed in round 2 (§12.11) |

### 12.2 R1 — Carry negation is clause-wide

**Round 3 (§13.3, R10):** a negated span no longer drops out while another span is carried; any
negated span refuses the whole reply as `negated`.

In `extractInContext` step 4, band selection (§3.3 step 6.4), a band span is dropped as negated if
**either**:

- a negation cue occurs in the `win` characters before it, as before; **or**
- any phrase of `lexicon.negation.cues` occurs **anywhere in the reply before the span**. The
  search runs on the folded text (§12.5) sliced `[0, spanStartOriginal)`.

If no span survives, the refusal is `negated`, as before. This guard applies to carry only, because
a bare follow-up reply is a weaker inference than a same-sentence statement. Direct extraction keeps
the window check.

| Pending `v_vertigo`, reply | Round 1 | Round 2 |
|---|---|---|
| "It doesn't really last for hours" | v = 2 carried | refused `negated` |
| "No, I don't think it's hours" | v = 2 carried | refused `negated` |
| "I'm not sure it's even hours" | v = 2 carried | refused `negated` |
| "No, not 10 or 15 minutes" | v = 2 carried (number spelling pushed "not" out of the window) | refused `negated` |
| "a few hours" | v = 2 carried | v = 2 carried (unchanged) |

### 12.3 R3a — `carryExclude`: band phrases that never carry (L1)

**Round 3 (§13.3 R10, §13.4 R11):** excluded phrases are collected again in a carried reply. They
never supply the carried value, but they count for the negation and ambiguity refusals ("For two
days at a time." is refused `ambiguous`). In direct extraction they count only in the cue's own
sentence.

**Field.** Optional scale-entry field `carryExclude: string[]`. These are band phrases of that
entry that `extractInContext` does **not** collect when it looks for a carried value (§3.3 step
6.1). They still work normally in direct extraction (`extract`/`scan`).

An excluded phrase is not collected at all. It neither carries a value nor removes a shorter
contained span. If nothing else is collected, the refusal is `no-band`.

**Validation (V28 style, `engine/validate.js`):**
- a non-empty array;
- each element a non-empty lowercase string, present verbatim in one of the entry's bands' `ph`
  lists;
- no duplicates;
- requires `carry` on the same entry.

`LEXICON_SCALE_KEYS` gains `"carryExclude"`. Mutation fixtures cover each rule (§12.10).

**MASQUE** (clinical-lead decision 2026-10-04):
`v_vertigo.carryExclude = ["about a day", "overnight", "for a day or two", "for a couple of days", "for two days", "for three days"]`.
It is a field of the 0.3.2 lexicon delta. `lexicon-delta.js` gives its exact position, and the
change log lists its path. The Rubric Editor has no control for it, and it is kept byte for byte
in every derived lexicon, because the editor edits a cloned draft by path.

| Dialogue | Round 1 | Round 2 |
|---|---|---|
| "I'm dizzy" · md "How long has this been going on?" · "For two days." | v_vertigo = 2 carried | refused `no-band`; v_vertigo stays heard |
| "I'm dizzy" · "half a day" | v = 2 carried | v = 2 carried (not excluded) |
| "I've been dizzy for two days" (one sentence) | v = 2 | v = 2 (residual, §12.9) |

### 12.4 R2 and R3b — Direct extraction for `heard` entries: band choice and onset guard

**Round 3 (§13.2, R9) replaces this subsection.** Any negated span, an onset phrase or two distinct
values withhold the value, and when the utterance held any band span the entry is not recorded as
unresolved, so no carry-over opens from it.

Both rules apply **only** to scale entries with `heard === true`. An entry without `heard` keeps
round-1 behaviour byte for byte: the first band, in array order, with any hit wins.

**R2, band choice.** For a heard entry whose cue opened (not negated, not yielded):
1. Collect every occurrence of every band phrase as a span. Band matching runs on the
   number-normalised view (§12.5), and each span is mapped to original indices through the offset
   map.
2. Drop each span strictly contained in a longer span (the carry rule, §3.3 step 6.2).
3. Drop each span negated within the negation window. The window is measured on the folded text,
   at the span's original index.
4. Drop **all** spans if the R3b onset guard fires.
5. Decide:
   - no live span → no value, exactly as when no band matched;
   - live spans with two or more distinct values → no value, treated **exactly like "no band"**:
     a heard capture under `includeHeard`, and the entry recorded as unresolved so that carry can
     arm;
   - exactly one distinct value → that value.

**R3b, onset guard.** If any `lexicon.carryRefuse` phrase occurs anywhere in the utterance (folded
text), no band value is taken from that utterance for a heard entry: all spans are dropped, so the
entry is heard and unresolved. `carryRefuse` keeps its carry role (§3.3 step 4.5) unchanged.

The first three rows gave v = 2 under lexicon 0.3.1 (review finding F4).

| Utterance | Round 1 | Round 2 |
|---|---|---|
| "It hit me in a split second and the spinning lasted for hours" | v = 1 | heard, no value (two values) |
| "I get dizzy a couple minutes after standing up and it lasts for hours" | v = 1 | heard, no value (two values) |
| "The dizziness is never under five minutes, it lasts hours" | v = 1 | v = 2 ("under five minutes" negated; "minutes" contained) |
| "I felt dizzy a couple minutes ago" | v = 1 | heard, no value (onset guard: "ago") |
| "The dizziness started about a day ago" | v = 2 | heard, no value (onset guard) |
| "I woke up with vertigo, it came on overnight" | v = 2 | v = 2 (residual: no new phrase, §12.9) |
| "it lasts 2 minutes" with a `v_vertigo` cue | v = 1 | v = 1 (unchanged) |

### 12.5 R4 — Digits for durations only (L2)

`lexicon.normalize.numbers` (`"en"`) now applies **only to band phrase matching**: scale bands in
`scan` and in `extractInContext`. Everything else runs on the **folded** text: cues, `bool`, `ctx`,
`multi`, red flags, yield presence and anchors, `topicSpans` (other-entry), the own-cue check,
`carryRefuse`, and **all** gate windows (negation, third-party, historical). The folded text has
apostrophes folded when `normalize.apostrophes` is `true`. It is the same length as the original,
so its indices are original indices.

Band spans found on the number-normalised view are mapped to original indices (the existing offset
map) **before** any window check. `EXTRACTOR_FEATURES` keeps the entry name `"normalize.numbers"`,
and the documentation states that it is bands-only.

**Validator.** The V29 warning "a phrase holding a standalone number token can never match" now
applies only to **band** phrases. Cue, yes/no, context, multi-item and red-flag phrases with digits
match typed digits again, as in 0.3.1.

| Utterance | Round 1 | Round 2 |
|---|---|---|
| "I've been dizzy for 10 days" | i_days = 10+ (cue "ten days") | i_days not set |
| "It happens 3 or 4 times a week" | c_clin = 3+ ("three or four") | c_clin not set |
| "less than 5 episodes" | v_count = yes ("five episodes") | v_count not set |
| "My sister has had 2 or 3 of these dizzy spells for hours" | v_vertigo = 2 (third-party window pushed out) | third-party gated, nothing recorded |
| carry reply "No, not 10 or 15 minutes" | v = 2 carried | refused `negated` |
| "it lasts 2 minutes" with a cue / "for 3 days" / carry reply "20 minutes" | v = 1 / v = 2 / v = 2 | unchanged |
| "numb on 1 side" | matched "numb on one side" | no match, as in 0.3.1 (disclosed, §12.9) |

### 12.6 R5 — Yield survives answering or skipping the heard card

**Engine option.** `extractInContext(lexicon, text, pending, {carry: false})`:
- the slot is still validated, decremented, expired and refreshed (§3.3 steps 1, 3, 5, 6);
- the slot still feeds `pendingIds` to `scan`, so `yieldTo` presence holds;
- step 4 never produces a carry capture and records no refusal (`carry.refused` is `null`).

`{carry: true}`, or the option absent, is round-1 behaviour.

**Scribe.** `ingest` passes the slot itself (`pendingRef.current`, not `null`):
- with `{carry: false}` whenever the pending item is answered or skipped;
- with `{carry: true}`, or the default, otherwise.

Skipped and answered items are still never carried (§3.4). They just keep yielding.

| Sequence | Round 1 | Round 2 |
|---|---|---|
| "I'm feeling really dizzy" → heard card Skip → "it lasts a couple of hours" | m_dur = Under 4 h | nothing; m_dur yields to the pending `v_vertigo` |

### 12.7 R6 — Records honesty

- **`carryRefuse`.** Every "pending confirmation" wording becomes: "confirmed by the clinical lead
  on 2026-10-04 (proposed by the team as a carry-over guard)". This covers the rubric change-log
  note, CHANGELOG.md, SOURCES.md, the `lexicon-delta.js` row and this document (§11.2 Q3).
- **Gold set 0.3.0.** The case text was drafted by the team and has **not** been reviewed by the
  clinical lead. This applies to the SOURCES.md `goldSet` row, the gold file's provenance and every
  other place, including §6.5 step 4, §7.6 and the §11 date sentence of this document.
- **Generic engine and editor strings.** A module-agnostic engine cannot know who approved a
  module. Strings that said "clinical-lead-approved configuration" for any module now say
  **"approved lexicon configuration"**. This covers the five `derive.js` `LOCKS` reasons (§5.3)
  and the Rubric Editor's read-only rows (§5.4). Example: "Carry-over refusal phrases are approved
  lexicon configuration; not editable in the Rubric Editor." Records about the MASQUE delta itself
  ("the clinical-lead-approved MASQUE lexicon change") stay, because they describe one module's
  approval.
- **Benchmark wording.** The `capture.js` printed block and CHANGELOG.md say: "the 0.3.0 labels
  are the 0.3.2 extractor's own output (regression snapshot); P/R/F1 on them is tautological, not
  a measurement".

### 12.8 R7 — Lock exemption narrowed

`derive.js lockViolations` exempts only what a deletion actually produces:
- scale entries are matched **by id**, not by index;
- the deleted item's own scale entry may be removed, together with the index shift of later
  entries;
- the deleted id may be removed from `yieldTo` lists, and `yieldTo` and `anchor` may be deleted
  when the list empties;
- **flag deletions exempt nothing** under `/lexicon/scale`, because a flag deletion never touches
  scale entries.

Every other difference under `/lexicon/scale` that touches a locked path is a lock violation.

Mutation fixture: delete an unrelated flag and set `/lexicon/scale/0/heard = true` → lock
violation.

### 12.9 Known risks (CHANGELOG.md, under the 0.4.1 / 2026-10-04 section)

CHANGELOG.md gets a "Known risks" subsection. Each risk has one example (**Round 3:** further rows
in §13.6):

| Risk | Example | Status |
|---|---|---|
| Spelled-out compound minutes read Under 5 min | typed "twenty-two minutes", "twenty-three minutes", "twenty-four minutes", "thirty-two minutes" → v_vertigo = 1 (contains "two/three/four minutes") | accepted by the lead |
| Day ranges read as illness duration | "it came on overnight" and "I've been dizzy for two days" in one sentence → v = 2; the pre-existing "for days", "several days" and "all week" can still be carried as replies | mitigated by R3a and R3b; residual as listed |
| "fewer than" before a v = 2 band | "fewer than five minutes" → 5 min – 72 h | disclosed |
| Yes/no denials beyond the 14-character window | "It doesn't happen when I roll over" → v_head yes; "I haven't noticed any roaring" → v_aural yes | baseline window, not changed in 0.4.1 |
| Double negation read as a denial | "no fewer than five episodes" → v_count no | disclosed |
| Third-party cue on the patient's own report | "my friend" nearby can suppress the patient's own report | disclosed |
| Idiom | "my stomach keeps turning over" → v_head yes ("turning over") | disclosed |
| Hedges carried as definite | "maybe a few hours" as a reply → v = 2 carried | disclosed |
| Digits not read in red-flag phrases | "numb on 1 side" does not match "numb on one side" | as in 0.3.1 (L2) |

### 12.10 R8 — Tests

- **AD13 rule T** (`tests/harness/diff.js`) is narrowed to what the engine actually changes:
  - **Apostrophe folding.** Only texts that contain a typographic apostrophe are excused, and in
    them any family may differ.
  - **Number spelling.** Only **scale-entry** captures, in texts that hold a token the engine
    spells. The token rule is the engine's exact rule: a standalone 0-20 or 30/40/…/90, the same
    lookbehind and lookahead, and the sentence-final `.` rule.
  - Red flags and non-scale captures stay strictly compared.
- **capture suite and gold set 0.3.0** gain:
  - cases for every R1-R5 behaviour (§12.2-§12.6 tables) and every review trace;
  - the curly-apostrophe red flags "I suddenly couldn’t hear" → rf_ssnhl and "I can’t move my eye"
    → rf_orbital;
  - the mixed curly + digit case "I don’t feel unsteady for 2 minutes" → no v_vertigo value.
- **render-scribe:**
  - the transcript [pt DIZZY, pt "ok", md "How long does it last?", pt "a few hours"] →
    `answers.v_vertigo === 2` and the "follow-up to" tag. This fails if the physician turn
    consumes a reply.
  - the R5 skip-then-yield case;
  - the shipped footer shows extraction lexicon 0.3.2 with instrument 0.2 and probe set 1.0.0.
- **extraction suite:**
  - the appended-cue corpus becomes `'<topic A>, <cue> <topic B>'`, so topic A stays strictly
    compared;
  - AD13's heard rule is either exercised or removed.
- **Validator fixtures** for `carryExclude`, plus the R7 lock fixture (§12.8).
- **Pins.** `GOLD_0_3_0_SHA256` and `EXPECTED_BENCHMARK` in `capture.js` go back to
  `"PIN_AFTER_RUN"`. The lead re-pins after the browser run. All 22 suites must pass again.

### 12.11 Not addressed in round 2

- **UI-3:** the locked anchor and `carryRefuse` phrase lists show no visible read-only reason in
  the Rubric Editor (a UX gap only; the fields are locked).
- **Optional extras the review raised:** a hedge refusal ("not sure", "maybe") and an affirmation
  guard for "no fewer than". These would need clinical-lead approval of new phrases. They are
  disclosed in §12.9 instead.

---

## 13. Round 3 (removal-only rules, 2026-10-05)

**Prototype · not for clinical use.** This section is the specification for round 3 of release
0.4.1. It refines R1-R3 of §12 and overrides every earlier section, §11 and §12 included, where
they differ. Earlier sections carry a short "Round 3" pointer where they are affected; their text is
kept as the record of rounds 1 and 2.

### 13.1 Why, and the principle

A verification of round 2 (commit 3700a14 on 26464c5) upheld 23 findings and refuted one. The
lead's browser run of 3700a14 passed all 22 suites and pinned the gold set and the benchmark, so
again every finding was a defect the tests could not see. The central finding: **round 2 could
create false scored findings that round 1 did not.** Three round-2 rules were presented as
conservative but could change which value was recorded:

- **R3a** (`carryExclude`) stopped collecting a day range in a carried reply, so it no longer made
  the reply ambiguous: "For two days at a time." was carried as Over 72 h, where round 1 refused it
  as ambiguous (F1).
- **R1 and R2** dropped a negated span and let a surviving span with a different value win. A hedge
  holding a negation word ("not sure", "don't know") removed one of two conflicting durations, and
  the other was scored (F2).
- **R3b** (the onset guard) withheld the value but recorded the entry as unresolved, so carry-over
  armed and a later reply could supply a value, often a wrong one. The records said `carryRefuse`
  "can only prevent a capture", which was then false (F3).

Lead decision L1 ("same sentence only") was also implemented as "same transcript line" (F4).

**Principle of round 3.** Every round-2 rule must be **removal-only**. It may withhold a value. It
must never cause a different value to be recorded, and withholding must never open a path for a
later wrong value.

The one deliberate exception is R11, which implements L1 as decided rather than as a removal. It is
stated in §13.4.

**Finding → fix** (finding ids as in the verification report)

| Finding | Fix |
|---|---|
| F1: R3a hides a conflicting day range in a carried reply | R10, §13.3 |
| F2: a hedge with a negation word drops one of two conflicting durations | R10 (carry), R9 b (direct), §13.2-§13.3 |
| F3: "`carryRefuse` can only prevent a capture" false since R3b | R9 c and R9 f (engine), R12 (records), §13.2, §13.5 |
| F4: L1 implemented as "same line" | R11, §13.4 |
| F5: known risks understate compound tens and another symptom's duration | R12, §13.6 |
| F6, ENG-R3b-1: `carryRefuse` and `heard` descriptions out of date; V28 warning wrong | R12, §13.5 |
| F7: 02 Verification paragraph stale; `capture.js` says "re-approve them" | R12, §13.5 |
| F8: gold revision log claims label independence | R12, §13.5 |
| ENG-R1-1: R1 also refuses on an unrelated negation, undisclosed | R12 (known risk and gold dialogue), §13.6 |
| DER-R7-1, DER-R7-2: lock gaps in `derive.js` (pre-existing) | R13, §13.7 |
| T1-T11: tests | R14, §13.8 |
| ENG-R2-1 (refuted) | No change |

### 13.2 R9 — Direct extraction for `heard` entries

R9 replaces R2 and R3b (§12.4). It applies **only** to scale entries with `heard === true`. An entry
without `heard` keeps round-1 behaviour byte for byte: the first band, in array order, with any hit
wins.

For a heard entry whose cue opened (not negated, not yielded, not attributed to someone else, not
historical):

a) **Collect.** Collect every occurrence of every band phrase as a span on the number-normalised
   view (§12.5), `carryExclude` phrases included, subject to the sentence scope of R11 (§13.4). Map
   each span to original indices through the offset map. Then drop each span strictly contained in
   a longer span.
b) **Negation.** If **any** remaining span is negated within the negation window → no value. The
   window is measured on the folded text at the span's original index and honours
   `opts.negationWindow`.
c) **Onset guard.** If any `lexicon.carryRefuse` phrase occurs in the utterance (folded text) → no
   value.
d) **Ambiguity.** If the remaining spans carry two or more distinct values → no value.
e) **Value.** Otherwise exactly one distinct value remains → that value, as in round 2.
f) **Arming.** When no value is taken, the entry is recorded as **unresolved** (so carry-over may
   arm) **only if the utterance held no band span at all after step a**. If any span existed (cases
   b, c and d), the heard capture is still emitted under `includeHeard`, but the entry is **not**
   recorded as unresolved: no carry window opens from that utterance, and the clinician asks.
   An utterance with no band span (for example "I'm feeling really dizzy") behaves as in rounds 1
   and 2: heard, unresolved, and carry-over arms.
   **Round 3b (§13.10):** the withheld entry now arms a **yield-only** slot (no carry, but the
   entries that yield to it keep yielding), and an open slot of the item becomes yield-only
   instead of closing. Still no value can be carried from or after that utterance.
g) **Fallback.** Unchanged from round 2. It applies when no value is taken. MASQUE `v_vertigo` has
   `fallback: null`.

Steps b to d differ from round 2 in one way that matters: a negated span no longer drops out and
lets the others decide. Any negated span, an onset phrase or a disagreement now withholds the
value, and R9 f stops the withheld value from being supplied later by a carried reply.

| Utterance (`v_vertigo` cue present) | Round 2 | Round 3 |
|---|---|---|
| "I get dizzy, I don't know, seconds or hours." | v = 2 ("seconds" negated, "hours" live) | heard, no value, no arming (b) |
| "I've been dizzy since Monday, and it lasts hours." | heard, arms; a following "All week." carried v = 3 | heard, no value, no arming (c); "All week." carries nothing |
| "I'm dizzy for two days at a time" (one sentence) | heard, arms (two values) | heard, no value, no arming (d) |
| "The dizziness is never under five minutes, it lasts hours" | v = 2 | heard, no value, no arming (b; now conservative) |
| "It hit me in a split second and the spinning lasted for hours" | heard, arms | heard, no value, no arming (d) |
| "I felt dizzy a couple minutes ago" | heard, arms | heard, no value, no arming (c) |
| "I'm feeling really dizzy" | heard, arms | heard, arms (unchanged: no span) |
| "the room spins for a few seconds when I roll over" | v_vertigo = 1, v_head yes | unchanged |
| "it lasts 2 minutes" | v = 1 | v = 1 (unchanged) |

**Why R9 is removal-only.** Against round 2, steps b to d can only turn a value into no value, and
step f can only stop an arming. No step adds a span, changes a span's value or opens a window that
round 2 did not open. The single source of new values in round 3 is R11 (§13.4).

### 13.3 R10 — Carry (`extractInContext` step 4)

R10 replaces R1 (§12.2) and the collection rule of R3a (§12.3). Band selection for a carried reply:

1. Collect every band span of the pending entry, **including** its `carryExclude` phrases. Drop
   each span strictly contained in a longer span.
2. No span at all → refuse `no-band`.
3. If **any** remaining span is negated → refuse `negated`, for the **whole** reply. A span is
   negated when a negation cue occurs in the window before it, or when any negation cue occurs
   anywhere in the reply before it (R1). R1 is therefore now removal-only: it can refuse a reply,
   never pick the surviving span.
4. Else, if the remaining spans carry two or more distinct values → refuse `ambiguous`. Excluded
   spans count here.
5. Else, if every remaining span is an excluded phrase → refuse `no-band`.
6. Else carry the single value, taken from a non-excluded span, subject to the third-party and
   historical windows as in round 2.

The refusal codes before band selection keep their round-2 order: answered, own-cue, other-entry,
question, refuse-phrase. `{carry: false}` (R5, §12.6) is unchanged.

An excluded phrase never supplies a carried value (L1 holds), but it is no longer invisible: it can
make a reply negated or ambiguous.

| Pending `v_vertigo`, reply | Round 2 | Round 3 |
|---|---|---|
| "For two days at a time." | v = 3 carried | refused `ambiguous` |
| "For two days, and each spell lasts about an hour." | v = 2 carried | v = 2 carried (excluded and non-excluded spans agree) |
| "For two days." | refused `no-band` | refused `no-band` (unchanged) |
| "A few seconds, I'm not sure, maybe hours." | v = 1 carried | refused `negated` |
| "It comes on without warning and lasts for hours" | refused `negated` | refused `negated` (disclosed recall cost, ENG-R1-1, §13.6) |
| "a few hours" (after "I'm feeling really dizzy") | v = 2 carried | v = 2 carried (unchanged) |

### 13.4 R11 — Sentence scope for `carryExclude` phrases in direct extraction (L1)

**Corrected in round 3c (§13.11).** As specified here, R11 ignored an excluded phrase in another sentence entirely, and that let false values through. Since round 3c such a phrase never supplies the value but still counts for R9 b-d and f, and every sentence with an unnegated, ungated cue hit counts as a cue sentence. The text below records round 3 as it was.

In direct extraction (R9 a), a span of a `carryExclude` phrase counts only when it lies in the
**same sentence** as the hit of the entry's cue that opened the entry. Spans of excluded phrases in
any other sentence are ignored entirely: they set nothing, make nothing ambiguous and are not
"present" for R9 f. Non-excluded band phrases keep line scope, as before.

**Sentence boundaries.** A sentence runs from the start of the text, or from just after a boundary,
to the next boundary or the end of the text. A boundary is one of `.` `!` `?` `;` **followed by
whitespace or by the end of the text**. The test runs on the folded text, whose indices are original
indices. Consequences, stated so they are not mistaken for bugs:

- "2.5", "10.30" and a `.` inside a token are not boundaries, because no whitespace follows the
  punctuation.
- An abbreviation followed by a space ("e.g. ", "Dr. ", "approx. ") **is** a boundary. An excluded
  phrase after it is then treated as being in another sentence and ignored. This can only narrow
  what an excluded phrase reaches.
- A comma, a colon, a dash and a line break are not boundaries. A voice transcript with no
  punctuation is one sentence.

| Utterance | Round 2 | Round 3 |
|---|---|---|
| "I'm dizzy. It's been going on for two days." (one line) | v = 2 | heard, no value, arms (the excluded span is in another sentence and ignored) |
| "I've been dizzy for two days" (one sentence) | v = 2 | v = 2 (unchanged; residual, §12.9) |
| "I'm dizzy for two days at a time" (one sentence) | heard, arms | heard, no value, no arming (R9 d) |

**The disclosed exception to the principle.** R11 is the implementation of L1, not a removal. When a
line holds a non-excluded band phrase and an excluded phrase in another sentence with a different
value, round 2 withheld the value as ambiguous, and round 3 takes the non-excluded value. Example:
"I'm dizzy for a few seconds. It's been going on for two days." is intended to give v = 1 in
round 3 (round 2: heard, no value, armed); the gold case pins the engine's actual output. This is
what L1 decides: a day range in another sentence does not describe the
episode. It is flagged for the lead, and a gold case pins it.

The F4 row above arms carry-over, so a following reply is read as in round 2. The pre-existing
v = 3 phrases ("all week", "for days", "several days") can still be carried there; that residual is
already listed in §12.9.

### 13.5 R12 — Records (true statements only)

- **`carryRefuse`.** The wording becomes: "in a heard entry's own utterance it withholds the
  duration and no carry-over opens from that utterance; in a carried reply it refuses the carry".
  With R9 c and R9 f the property "it can only prevent a capture, never cause one" is **true
  again**, and the records may state it with that justification: withholding the value no longer
  arms carry-over, so no later reply can supply a value because of it. This covers the rubric
  change-log note, CHANGELOG.md (the R3b paragraph and "the safe direction"), SOURCES.md,
  `lexicon-delta.js`, the gold notes of t012 and t013, and §11.2 Q3 of this document.
- **Rubric Editor label.** The read-only `carryRefuse` row names both roles. Intended text:
  `Carry-over refusal phrases (read-only; a reply containing one never supplies a carried value, and
  in a heard entry's own utterance one withholds the value and opens no carry-over)`. The exact text
  is in `RubricEditor.jsx`; `03-design.md` §7.5 lists it.
- **`contract.js` typedef notes.**
  - `heard`: besides the heard display, `heard: true` changes the scored output. Band choice follows
    R9 (every span counts, any negated span or disagreement withholds the value, and a withheld
    value with a span present does not arm carry-over).
  - `carryRefuse`: both roles, as in the first bullet.
- **Validator V28 warning.** It fires only when **no scale entry has `heard: true` or `carry`**.
  Message: `carryRefuse has no effect: no scale entry has heard: true or carry`. `04-module-authoring.md`
  §7 lists it.
- **`docs/refactor/03-design.md` and `04-module-authoring.md`** describe R9-R11 and the two
  `carryRefuse` roles.
- **CHANGELOG.md known risks** gain the rows of §13.6.
- **`02-app-divergences.md`.** The Verification paragraph states the real state: the lead's run of
  3700a14 passed 22/22 and pinned both values. Round 3 sets them back to `"PIN_AFTER_RUN"` until the
  lead re-runs.
- **`capture.js`.** The gold-SHA mismatch message "re-approve them, then re-pin" becomes "review
  them, then re-pin". The gold case text has not been reviewed by the clinical lead, so the message
  must not imply clinical approval.
- **Gold set 0.3.0 `revisionLog` (F8).** "Six labels changed because the rules changed, never to
  match the extractor after the fact" becomes: "six labels changed with the round-2 rules; as for
  every 0.3.0 label, each is the extractor's output under those rules". Round 3 adds its own entry
  in the same honest form.

### 13.6 Known risks added (CHANGELOG.md, under the 0.4.1 / 2026-10-04 section)

| Risk | Example | Status |
|---|---|---|
| Spelled-out compound tens read Under 5 min | typed "twenty-two minutes" through "ninety-four minutes" (every ten from twenty to ninety with -two, -three or -four, with or without the hyphen, e.g. "forty-two minutes", "twenty two minutes") → v_vertigo = 1, because they contain the approved phrases "two/three/four minutes". Typed digits ("42 minutes") are not affected. | The lead accepted "twenty-two" (§11.3). The full family follows from the approved phrases and is recorded as accepted with them; **flagged** for the lead's explicit confirmation. |
| Another symptom's duration in the same sentence read as the vertigo duration | "My migraines last for two days and I get dizzy with them" → v_vertigo = 2 (gold y014) | disclosed |
| An unrelated negation refuses a carried reply | "It comes on without warning and lasts for hours" as a reply → refused `negated`; also "I can't remember exactly, maybe a few hours" | recall cost (R1/R10), no false value; gold dialogue pins it |
| Stated but ambiguous durations leave the item for the clinician | "never under five minutes, it lasts hours", "I've been dizzy since Monday, and it lasts hours", "I'm dizzy for two days at a time", "It's not a few seconds, the dizziness lasts hours" → heard, no value, no carry-over | recall cost of R9 b-d and f, no false value |
| A day range in another sentence no longer vetoes an in-line duration | "I'm dizzy for a few seconds. It's been going on for two days." → v = 1 | R11 exception (§13.4), flagged; **withdrawn in round 3c** (§13.11): heard, no value |
| An abbreviation splits a sentence | "e.g. " or "Dr. " before an excluded phrase puts it in another sentence | documented boundary rule (§13.4) |

### 13.7 R13 — Lock gaps in `derive.js` (pre-existing, DER-R7-1 and DER-R7-2)

- **`/lexicon/multi`.** The exemption in `lockViolations` applies only to **item** deletions; a flag
  deletion exempts nothing under `/lexicon/multi`, because `deleteFlag` never touches it. Preferred
  form: compare `multi` against what `deleteItem` produces (drop the deleted item from each `ids`
  list, drop entries left empty), as `expectedScale` does for `scale`. Any other `multi` difference
  that touches a locked path is a lock violation.
- **`deleteItem` ordering.** Dependent paths are sorted by their **numeric** index, descending,
  before splicing, so duplicate-id entries that straddle index 9/10 are deleted correctly (a string
  sort put `/lexicon/scale/2` before `/lexicon/scale/10`).

### 13.8 R14 — Tests

Each test-finding is closed as its FIX describes:

| Finding | Test |
|---|---|
| T1 | render-scribe: [DIZZY, Skip, "ok", ATTACK_LINE] and [DIZZY, answer, "ok", ATTACK_LINE] leave `m_dur` unanswered; the d072 sequence ("The dizziness lasts a few seconds", "I feel dizzy again", ATTACK_LINE) through the real Scribe leaves `m_dur` unanswered; an expiry control [DIZZY, Skip, "ok", "fine", ATTACK_LINE] scores `m_dur` again |
| T2 | a discriminating case for "contained spans dropped before negation", e.g. "alpha, not really a brief span" → `s_alpha` heard, plus a MASQUE case with a negated v = 1 "…minutes" phrase |
| T3 | `negationWindow` on heard band choice, e.g. "alpha, not a short span but a long span" with `{negationWindow: 0}` against the default |
| T4 | AD13 rule T narrowed to scale entries having a band phrase that contains a number word, and/or the remaining breadth stated in the suite note |
| T5 | AD13 self-checks: crafted pairs that must **not** be excused (a red-flag or yes/no difference in a spelled-number text; a `v_vertigo` value difference with no negation cue, no `carryRefuse` and agreeing spans); `normalizeRewrites` cross-checked against the engine's spelled view |
| T6 | skip-yield and answer-yield assert that the second line was ingested, and answer-yield uses an option whose value differs from what a carry would give |
| T7 | negative V29 check: `numbers: "en"` plus a yes/no phrase with a digit → no V29 at that path |
| T8 | R7 branches: deleting a scale-owning item with an entry after it → no lock violation; a whole added scale entry with `heard` or `carryExclude` → LOCK |
| T9 | folded-text coverage for a yield target's cue, the pending entry's own cue, `carryRefuse`, and the third-party window of a carried reply |
| T10 | the Playwright editor check uses `/clinical[- ]lead/i` |
| T11 | the appended-cue corpus asserts `strictA` |

Plus capture-suite and gold set 0.3.0 cases for every R9-R11 row of §13.2-§13.4, the §13.6
examples, and the R13 fixtures. **Pins.** `GOLD_0_3_0_SHA256` and `EXPECTED_BENCHMARK` go back to
`"PIN_AFTER_RUN"`. The lead re-runs the test page, re-pins and regenerates; all 22 suites must pass
again.

### 13.9 Not changed by round 3

- The version axes: release 0.4.1, instrument 0.2, lexicon 0.3.2, probe set 1.0.0, gold set 0.3.0
  (lexicon 0.3.2). No lexicon content changes, so `lexiconHash` is unchanged. The rubric
  change-log note (top-level `changelog`, outside the lexicon) is reworded, so the generated rubric
  is regenerated. The gold set file changes, so its pin moves.
- The vocabulary, `carryExclude`, `carryRefuse`, the negation window for yes/no phrases (§12.9), R4
  (§12.5), R5 (§12.6) and the `{carry: false}` option.
- Entries without `heard`, and every lexicon without the 0.4.1 fields: byte-identical behaviour.
- UI-3 and the optional hedge and affirmation guards (§12.11).

### 13.10 Round 3b — yield-only slots

**Prototype · not for clinical use.** Round 3b changes only the carry slot of `extractInContext`.
It overrides §3.1, §3.3, §3.5 and R9 f (§13.2) where they differ.

**The defect.** As implemented in round 3, R9 f did two things when a heard entry's duration was
withheld. "Withheld" means band spans were present but gave no value: a negated span, a
`carryRefuse` phrase, or two values.
- The withheld utterance armed no slot.
- When it was read with carry on while that item's slot was open, it closed the slot
  (`next = null`).

Both removed the slot that supplies `pendingIds` to `scan`. That is the presence `m_dur`'s `yieldTo`
relies on. So the next reply, "it lasts a couple of hours", scored `m_dur` = Under 4 h. That is the
misattribution F4 exists to stop, and round 2 prevented it. Round 3 thereby broke its own principle
(§13.1): withholding opened a path for a later wrong value.

| Patient lines (lexicon 0.3.2) | Round 1 | Round 2 | Round 3 | Round 3b |
|---|---|---|---|---|
| "It hit me in a split second and the spinning lasted for hours" · "it lasts a couple of hours" | v_vertigo = 1; then m_dur = 1 | heard, arms; then v_vertigo = 2 carried | heard, no slot; then **m_dur = 1** | heard, yield-only slot; then nothing (m_dur yields, nothing carried) |
| "I've been dizzy since Monday, and it lasts hours." · "it lasts a couple of hours" | v_vertigo = 2; then m_dur = 1 | heard, arms; then v_vertigo = 2 carried | heard, no slot; then **m_dur = 1** | heard, yield-only slot; then nothing |
| "I'm feeling really dizzy" · "I've been dizzy since Monday, and it lasts hours." · "All week." | heard; v_vertigo = 2; nothing | heard; own-cue, slot refreshed; v_vertigo = 3 carried | heard; own-cue, slot closed; nothing | heard; own-cue, slot becomes yield-only (1 reply left); nothing carried |
| "I'm feeling really dizzy" · "it lasts a couple of hours" | v_vertigo = 2 carried, m_dur yields | unchanged | unchanged | unchanged |
| "I'm feeling really dizzy" · "as if the world is moving around me and I'm sitting still" · "a few hours" (the reported conversation) | v_vertigo = 2 carried (the second line refused `own-cue` and re-arms) | unchanged | unchanged | unchanged |

The round-3b column is the specified behaviour. It was checked against a scratch Python model of
the round-3 engine with the rules below added, not against the shipped JavaScript. The capture
suite and gold set 0.3.0 pin the engine's actual output.

**The rules.**

1. **Shape.** `PendingCue` gains an optional boolean field `yieldOnly`:
   ```js
   /** @typedef {{id:string, cue:string, cueText:string, evidence:string, cueIndex:number, turnsLeft:number, yieldOnly?:boolean}} PendingCue */
   ```
   A yield-only slot has `yieldOnly: true`. It supplies `pendingIds` to `scan`, so `yieldTo`
   presence holds, and it is validated, decremented, expired and superseded exactly like any
   slot. Step 4 never carries for it: no carry capture and no refusal (`carry.refused` is `null`),
   the same as reading with `{carry: false}`.
2. **Step 1 (validation).** A slot whose `yieldOnly` key is present with a non-boolean value is
   invalid and is dropped (`p = null`), like a slot with a bad `turnsLeft`. `yieldOnly: false` and
   an absent key both mean a normal slot.
3. **Step 4 (conversion).** This replaces the round-3 rule that a withheld utterance closes the
   open slot. When a normal slot is read with carry on and the utterance withholds the pending
   entry's own band (the entry is in `scan`'s withheld set), the slot becomes `yieldOnly: true`. It
   keeps its remaining count, which step 3 has already decremented. In that utterance the
   entry's own cue is present, so step 4 has already refused `own-cue` and nothing is carried.
   With `{carry: false}` step 4 does not run, so there is no conversion. As in round 3, the slot
   then only loses one reply.
4. **Step 6 (arming), as implemented** (the engine's `extractInContext` header, "Slots", is the
   authority; this list transcribes it). Let `s` be the utterance's scan with the slot's id
   pending, and `r` the scan round 3 made of it: `s` itself, or, when the slot read is yield-only,
   the same utterance scanned with **no** id pending. The first rule that applies decides:
   1. **Normal slot.** `r` holds exactly one unresolved id, its entry may carry, and its cue lies
      inside no phrase of another entry (an entry that yielded in `r` excepted). That entry gets a
      **normal** slot with `turnsLeft = carryOf(E(id))`. It arms, refreshes (the entry's cue heard
      again with no band, after a withheld line too: "I feel dizzy again") or supersedes any slot,
      normal or yield-only. Deciding on `r` rather than `s` is what makes a normal slot arm exactly
      when round 3 arms one: a yield-only pending id can make an entry yield, and deciding on `s`
      would let that yield expose a different single unresolved cue that round 3 never armed (the
      round-3b engine package found such a case by fuzzing; MASQUE agrees under both readings).
   2. **Clear.** Otherwise, if `s` holds any unresolved entry (one rule 1 did not arm, or two or
      more cues awaiting a value), the slot is cleared. An entry that yields to the pending id is
      not unresolved in `s`, so it never clears the slot it yields to.
   3. **Withheld.** Let `W` be the distinct ids of `s`'s withheld entries whose entry may carry
      (`carryOf ≥ 1`; other withheld entries are ignored):
      a. `W` is empty: the slot stays as steps 3-5 left it.
      b. The slot belongs to an id in `W`: it stays as it is (remaining count, not refreshed).
      c. The slot is a normal slot of another entry: it stays. A yield-only slot never supersedes
         a normal slot. **[Changed in round 3d (§13.12): the normal slot ends, replaced as in d or
         cleared as in e.]**
      d. `W` holds one id: that entry gets a new yield-only slot, `{id, cue, cueText, evidence:
         text, cueIndex, turnsLeft: carryOf(E(id)), yieldOnly: true}`, its cue fields taken as for
         an unresolved cue, with no embedded-cue check (a yield-only slot carries nothing). It
         replaces no slot, or a yield-only slot of another entry.
      e. `W` holds two or more ids: the slot is cleared.

   **Precedence.** A normal slot always wins over a yield-only slot; an unresolved cue (rules 1-2)
   is decided before any withheld entry; an open normal slot is never replaced by a yield-only one;
   a yield-only slot replaces only no slot, or another yield-only slot. **[Round 3d (§13.12): a
   withheld entry that may carry now ends an open normal slot of another entry; the other
   statements stand.]** The single-slot model is
   kept. A consequence of keeping the remaining count (capture suite
   `rule3d/conversion-on-the-last-reply-arms-afresh`): when a withheld line converts a slot with
   one reply left, that slot expires on the same line and rule 3d arms a fresh yield-only slot
   with the full `carry`.
5. **The Scribe.** No change. It stores and passes the returned slot whole, so `yieldOnly`
   travels with it. It still passes the slot with `{carry: false}` once the item is answered or
   skipped (§12.6). For a yield-only slot that option changes nothing, because step 4 is already
   skipped.

**Why it is removal-only against round 3.** Round 3b records no value that round 3 does not record,
with one exception: it may **suppress** an entry that yields (here `m_dur`) where round 3 recorded
it. Three reasons:
- A yield-only slot never carries. Wherever round 3 had no slot (withheld, nothing armed) or a
  closed slot, round 3b carries nothing either.
- Where round 3 kept or armed a normal slot, round 3b does the same (rules 6.1 and 6.3). [Round 3d
  (§13.12) ends a normal slot round 3 kept when a withheld line names another entry that may
  carry; the comparison is then with round 3 plus that rule.]
- The only effect of a yield-only slot on `scan` is the extra `pendingIds` entry. That can only
  make an entry with `yieldTo` yield, which is suppression.

A lexicon without `heard`, or without `carry`, never produces a withheld entry with `carryOf ≥ 1`,
so no yield-only slot is created. Its behaviour stays byte-identical, provided the caller passes
no `yieldOnly` slot of its own.

**What does not change.**
- R9 a-e and g, R10, R11 and every refusal code.
- No carry window opens from a withheld utterance: "no carry-over opens" (§13.2 R9 f, §13.5)
  stays true.
- The `carryRefuse` wording ("it can only prevent a capture, never cause one") stays true.
- The rubric change-log note **was** reworded at the end of round 3b (lead, 5 October): it no
  longer says a withheld duration "closes an open one"; it says the duration opens only a
  yield-only slot and turns an open slot of that item yield-only. Its dialogue count reads 90.
  Lexicon content is unchanged, so `lexiconHash` is unchanged; the rubric bytes change only in the
  top-level `changelog`.
- Version axes, lexicon content and `lexiconHash`: unchanged.

**Behaviour notes (as designed, recorded in CHANGELOG.md).**
- **A refused carried reply uses up one reply but keeps the rest of the window.** "I'm feeling
  really dizzy" · "For two days at a time." · "a few hours" → the second line is refused
  `ambiguous` (R10) and the third carries 5 min – 72 h. This is unchanged since round 1, where the
  second line was also refused `ambiguous`.
- **A converted slot keeps only its remaining count** (superseded by round 3c, §13.11: the slot is renewed and `m_dur` yields on the last line). "I'm feeling really dizzy" · "I've been
  dizzy since Monday, and it lasts hours." · "ok" · "it lasts a couple of hours" → the slot
  expires after "ok", so the last line scores `m_dur` = Under 4 h, as in round 3. This is the
  ordinary expiry of the yield (compare the T1 expiry control, §13.8). A yield-only slot armed
  where no slot was open gets the full `carry`.
- **R11 unchanged** (superseded by round 3c, §13.11: heard, no value). A day range in another sentence is ignored, so "I'm dizzy for a few seconds.
  It's been going on for two days." → `v_vertigo` Under 5 min. That follows from the lead's
  same-sentence decision (L1), and round 1 gave the same value.

**Tests (expected coverage; the suite is the record).** Each rule above should have a fixture case
in the capture suite:
- a non-boolean `yieldOnly` dropped at step 1;
- a yield-only slot that never carries and records no refusal;
- conversion that keeps the count;
- a re-heard cue that re-arms a normal slot;
- a yield-only slot that does not supersede a normal slot of another item (reversed in round 3d,
  §13.12: `rule3c/withheld-replaces-a-normal-slot-of-another-entry`).

The MASQUE dialogues of the table above are pinned as gold set 0.3.0 dialogues d086-d090 and in
the capture suite's `ROUND3B_SEQUENCES`; the round-3 dialogues whose pending changed (d069, d070,
d075, d076, d078, d079, d085) were relabelled to the yield-only behaviour. The capture suite holds
29 yield-only fixture cases (`YIELD_ONLY_CASES`) covering step 1, step 4, expiry and rules 3a-3e.
**Pins.** Re-taken from the lead's browser run after round 3b (seed 1296126801), which reported no
difference: see CHANGELOG.md's benchmark block.

### 13.11 Round 3c — final pre-deploy corrections

**Prototype · not for clinical use.** A final review of round 3b before deployment (two lenses,
each finding checked by two skeptics) upheld four findings. It found no crash, no broken
invariant and no defect in the yield-only slot itself. Round 3c overrides §13.4 and §13.10 where
they differ.

| Finding | Severity | What it showed |
|---|---|---|
| F-R11-OVER72 (clinical) | blocking | R11 dropped an excluded span outside the cue's sentence entirely. "for two days" overlaps the v 3 phrase "days at a time" without containing it, so dropping it left v 3 alone: "I get these dizzy spells. They last for two days at a time." → Over 72 h, the F1 misread back in direct extraction. |
| ENG-R11-1 (engine) | major | The same mechanism, traced in the engine; also "I get dizzy. It lasts for two days at a time." and "How long am I dizzy? For two days at a time." |
| ENG-R11-2 (engine) | major | The cue's sentence was that of `firstHit`, the first-listed cue phrase found ("dizzy"), so "I had vertigo for two days. Now I'm just dizzy." ignored the day range, armed carry-over, and "All week." then carried Over 72 h (round 2: 5 min – 72 h). |
| F-3B-REMAINING-COUNT (clinical) | major | A converted slot kept its remaining count, so "I'm feeling really dizzy" · "I've been dizzy since Monday, and it lasts hours." · "ok" · "it lasts a couple of hours" scored `m_dur` Under 4 h where round 2 suppressed it (gold d089). |

**R11, removal-only.** In direct extraction (R9 a) every band span is collected, `carryExclude`
phrases included wherever they lie, and spans strictly inside a longer span are dropped. R9 b-d
run on all of them. Then, when they agree on one value, the value is taken only if some span may
supply it: a span that is not a `carryExclude` phrase, or a `carryExclude` span in a **cue
sentence**. A cue sentence is any sentence holding a hit of any of the entry's cue phrases that is
not negated within the window and passes the attribution and history gates; the entry's opening
hit always makes one. When every span is an excluded span outside every cue sentence, no value is
taken, and because a span was present the entry is withheld (R9 f): heard, and only a yield-only
slot opens. The boundary rule of §13.4 is unchanged.

Against round 2 (line scope) this only withholds: a span set that round 2 read as one value is
read as the same value or as none. The exception disclosed in §13.4 is withdrawn: "I'm dizzy for a
few seconds. It's been going on for two days." is heard with no value, as in round 2, and L1 still
holds, since a day range outside a cue sentence never sets the value.

**Rule 3b, renewed.** When step 6 reaches rule 3 and the slot is a **yield-only** slot of a
withheld entry (one step 4 has just converted included), it is replaced by a new yield-only slot of
that entry as in rule 3d: cue fields from this utterance, `turnsLeft = carry`. A normal slot of a
withheld entry (read with `{carry: false}`) still stays as it is. A yield-only slot never carries,
so this only lengthens the suppression of the entries that yield to it. Rule 1 still decides on
the scan without a yield-only pending id, so a normal slot arms exactly where round 3 (with the
corrected R11) arms one.

| Patient lines (lexicon 0.3.2) | Round 2 | Round 3 / 3b | Round 3c |
|---|---|---|---|
| "I get these dizzy spells. They last for two days at a time." | heard, arms | **v 3** (Over 72 h) | heard, yield-only slot (w017, d093) |
| "I had vertigo for two days. Now I'm just dizzy." · "All week." | v 2 | heard, arms; **v 3 carried** | v 2; nothing carried (w020, d091) |
| "The room spins for two days at a time. Then I feel dizzy." | heard, arms | **v 3** | heard, yield-only slot (w021) |
| "I'm dizzy. It's been going on for two days." · "All week." | v 2 | heard, arms; **v 3 carried** | heard, yield-only slot; nothing carried (w005, d092) |
| "I'm dizzy. It's been going on for two days." · (md) · "About an hour." | v 2 | heard, arms; v 2 carried | heard, yield-only slot; nothing carried (recall cost, d077) |
| "I'm dizzy for a few seconds. It's been going on for two days." | heard, arms | v 1 (the §13.4 exception) | heard, yield-only slot (w013) |
| "I get dizzy. My mother was dizzy for two days." | v 2 | heard, arms | heard, yield-only slot (an attributed cue hit makes no cue sentence; w022) |
| "I'm feeling really dizzy" · "I've been dizzy since Monday, and it lasts hours." · "ok" · "it lasts a couple of hours" | v 2 carried on the last line | **m_dur = 1** on the last line (3b) | nothing (d089) |
| The reported conversation | v 2 carried | v 2 carried | v 2 carried (unchanged) |

**Not changed, recorded as a follow-up.** Rule 3c (a yield-only slot never supersedes a normal
slot of another item) is kept. In a lexicon with two or more carry-capable items, a withheld line
about item B leaves item A's open normal window open, where round 2 armed B over it; the next reply
could then be carried into A. MASQUE has one carry-capable item (`v_vertigo`), so this cannot
occur in the shipped module. Changing it would also change which normal slots arm, so it needs its
own review before any module with two carry-capable items ships. **[Resolved in round 3d, §13.12.]**

**Records.** The engine header ("Band choice", "Sentences", "Slots" rule 3b), `contract.js`
(`carryExclude`, `PendingCue`), the Rubric Editor's read-only `carryExclude` label, the AD13 rule-H
model in `tests/harness/diff.js`, the rubric change-log note (day ranges, the renewed window, gold
totals 218 and 93; regenerated, the generator reports identical), CHANGELOG.md (round 3c section,
known risks, benchmark), SOURCES.md, README.md, 02, 03 (S11), 04 and this section.

**Tests.** Capture suite: the R11 fixture cases (any cue sentence, a negated or attributed cue hit,
an agreeing or disagreeing excluded span elsewhere, the contained span), the rule-3b renewal cases
and sequences, and the MASQUE traces above; gold set 0.3.0 adds w017-w022 and d091-d093 and
relabels w013, d077, d085, d088 and d089 (provenance unchanged: drafted by the team, not reviewed
by the clinical lead); the extraction suite's round-3 texts include the new traces, so AD13 rule H
must explain them. **Pins** re-taken from the browser run after round 3c (seed 1296126801), which
reported no difference: see CHANGELOG.md's benchmark block.

### 13.12 Round 3d — a withheld line ends another entry's normal slot

**Prototype · not for clinical use.** Round 3d closes the follow-up recorded in §13.11. It changes
rule 3c of step 6 in `extractInContext` and nothing else, and it overrides §13.10 and §13.11 where
they differ. Rule 3c needs two scale entries that may carry (`heard: true` and `carry` ≥ 1).
MASQUE has one, `v_vertigo`, so the shipped module's output, gold set 0.3.0, the benchmark and both
pins are unchanged.

**Release.** Round 3d was made on 2026-10-06 in a separate session, on top of release 0.4.1
(round 3c) with the Patient `.txt` thin change, and is not part of 0.4.1 or 0.4.2. It ships in
release 0.4.3, integrated on 2026-10-07 without a change to its engine logic (design 03 S12 and
E12). The evidence below is that session's, on its own tree. The integrated run is recorded in
`02-app-divergences.md` ("screenAIr 0.4.3", Verification). Review round 1 of the integration
(2026-10-07) corrected this section and the engine header without changing the engine logic: the
definition of round 3+, the effects against round 3 (they chain; "Effects against round 3"
below), the eighth trace and follow-up F-3D-4. Review round 2 (the same day) changed records and
tests only: the band choice that round 3 and round 3+ mean here, the plain statements of rule 3c
(rules 1 and 2 decide first: `contract.js`, 04 §2.8, CHANGELOG.md), two `YIELD_ONLY_CASES` rows
for the second withheld entry's slot, and the round 3+ property's count of rule-3c endings
(Evidence).

**The defect.** Let A and B be two entries that may carry. A's normal slot is open: A's cue was
heard with no band. A patient line then names B's cue and states a band that is withheld: a
negated span, a `carryRefuse` phrase, or two values. Where round 2 found no value for B on such a
line (every span negated, an onset phrase, two live values), it counted B as unresolved and armed
B's normal slot over A's. Round 3 made B withheld, and a withheld entry arms nothing (R9 f).
Round 3b gave B a yield-only slot, but rule 3c said a yield-only slot never replaces a normal one.
So A's normal slot stayed open, and the next reply could be carried into A. That reply was most
likely about B, and round 2 did not record that value. This breaks the principle of §13.1.

**The rule (rule 3c, as implemented).** When step 6 reaches rule 3 (rules 1 and 2 did not decide)
and the slot is a normal slot of an entry not in `W`, the slot ends. If `W` holds one id, that
entry's yield-only slot replaces it (rule 3d). If `W` holds two or more ids, the slot is cleared
(rule 3e). Reading with `{carry: false}` makes no difference to this. Nothing else changes:
- A normal slot of an entry in `W`, read with carry off, still stays as it is (3b).
- A normal slot armed by rule 1 still takes precedence over any yield-only slot.
- A withheld entry without `carry` is still ignored.

Rules 3d and 3e already treated a yield-only slot of another entry this way, so they now apply to
a slot of another entry whatever its kind. The engine header ("Slots") is the authority.

Traces on the capture suite's fixture lexicon, run through the round-2 engine (commit 3700a14), the
round-3c engine (abf659f) and this one. `s_alpha` and `s_zeta` may carry and share the band phrase
"long span"; `s_beta` yields to `s_alpha`; `s_eta`, added for the fourth row, yields to `s_zeta`,
and in the eighth row, where `s_eps` may carry too, to `s_eps`.

| Patient lines | Round 2 | Round 3c | Round 3d |
|---|---|---|---|
| "alpha" · "a zeta, not a long span" · "a long span" | `s_zeta` armed over `s_alpha`; `s_zeta` = 2 carried | `s_alpha` kept; **`s_alpha` = 2 carried** | `s_zeta` yield-only; nothing carried |
| "zeta" · "alpha for a short span then a long span" · "a long span" (`s_zeta` carry 2) | `s_alpha` armed; `s_alpha` = 2 carried | `s_zeta` kept; **`s_zeta` = 2 carried** | `s_alpha` yield-only; nothing carried |
| "alpha" · "zeta and epsilon, not a long span" · "a long span" (`s_eps` may carry) | cleared; nothing | `s_alpha` kept; **`s_alpha` = 2 carried** | cleared; nothing |
| "alpha" · "a zeta, not a long span" · "it lingers for a long span" | `s_eta` yields; `s_zeta` = 2 carried | **`s_eta` = 2** | `s_eta` yields; nothing |
| "alpha" · "a zeta, not a long span" · "zeta again" · "a long span" | `s_zeta` = 2 carried | `s_zeta` = 2 carried | `s_zeta` = 2 carried (rule 1 re-arms a normal slot) |
| "alpha" · "a zeta, not a long span" · "it persists for a long span" | `s_beta` = 2 | `s_alpha` = 2 carried | `s_beta` = 2 (disclosed below) |
| "alpha" · "a zeta, not a long span, a long span" · "it persists for a long span" | `s_zeta` = 2 on the second line; `s_alpha` = 2 carried | `s_alpha` = 2 carried | `s_beta` = 2 (disclosed below) |
| "alpha" · "a zeta, not a long span, a long span" · "it persists and epsilon" · "it lingers for a long span" (`s_eps` may carry; `s_eta` yields to `s_eps`) | `s_zeta` = 2 on the second line; `s_eps` armed on the third (`s_beta` yields); `s_eta` yields, `s_eps` = 2 carried | `s_eps` armed on the third; `s_eta` yields, `s_eps` = 2 carried | cleared on the third (`s_beta` and `s_eps` unresolved); **`s_eta` = 2** (disclosed below; F-3D-4) |

**The claim, restated.** Before round 3d, every yield-only slot stood where round 3 had no slot.
Rule 1 decides on `r`, the utterance scanned with no yield-only id pending. That was round 3's
scan, so "a normal slot arms exactly when round 3 arms one" held. Rule 3c now ends a normal slot
that round 3 keeps, so that claim no longer holds against round 3. The engine header restates it
against **round 3+**: round 3 (this engine's band choice, R11 as corrected in round 3c, §13.11; no
yield-only slot; a withheld entry arms nothing, and one of the slot's own entry read with carry on
closes the slot) with rule 3c added, so that a withheld entry that may carry closes a normal slot
of any entry not itself withheld on that line (not in `W`). A normal slot of an entry that is
withheld too, read with carry off, stays, as in round 3
(`rule3b/a-normal-slot-of-a-withheld-entry-stays-beside-another`). The claim then holds again:
- Where round 3+ holds a normal slot, this engine holds the same one; elsewhere it holds a
  yield-only slot or none, and round 3+ holds none.
- `r` is round 3+'s scan, so a normal slot arms exactly when round 3+ arms one.
- No value is recorded that round 3+ does not record. A yield-only pending id can only make an
  entry yield, so an entry may be suppressed where round 3+ recorded it.

**Effects against round 3.** Here "round 3" means round 3's slot rules with this engine's band
choice (round 3+ without rule 3c). Round 3's own band choice (0552a38) differs (§13.11, ENG-R11-2):
on MASQUE, "I had vertigo for two days. Now I'm just dizzy." gives `v_vertigo` heard and a normal
slot there, and `v_vertigo` = 2 here and in round 3c. That is R11, not round 3d (review round 2 of
the integration). Against round 3 itself, rule 3c removes the carry into A, which is
the point of the fix. It also changes which id is pending from the next line on: B, as a
yield-only slot, or none, where round 3 held A. On the rule-3c line itself both engines scan with A
pending, so nothing changes there. Every later decision that reads the pending id follows, and the
effects chain until the two engines' slots agree again:
- An entry C that lists A in `yieldTo`, and not the id pending here (B, or none), stops yielding.
  Its own value may be recorded. Its cue heard with no band may clear the slot (rule 2), keep
  another entry X from arming where round 3 armed X (rule 1 needs exactly one unresolved id), or,
  if C may carry, arm a normal slot of C (rule 1 decides on `r`), so that a later reply may be
  carried into C. Round 3 had C yield in each case.
- An entry E that yields to such an X then stops yielding too, and may record the value round 3
  carried into X. E need not yield to A. In the eighth row `s_beta`, no longer yielding to
  `s_alpha`, is unresolved beside `s_eps` on the third line, so the slot is cleared and `s_eps`
  never arms; on the fourth, `s_eta`, which yields to `s_eps` only, records the "long span" that
  round 3c carried into `s_eps`.
- In general: rule 3c changes only the slot a line returns, and a line's captures read the pending
  id only for `yieldTo` and for the carry. So a value round 3d records that round 3 does not is, on
  its line, either of an entry that yields in round 3, to the id round 3 holds pending, and does
  not yield here, or carried into a normal slot that round 3 does not hold.

Round 2 also ended A's slot whenever it found no value for B on the withheld line, because it
armed B's slot over A's or cleared it, so there it had effects of the same kind. Where round 2 took
B's value (the last two rows: it dropped the negated span and took the live one), it kept A's slot
and carried the reply into A, as round 3 does. There round 3d may record values that neither round
2 nor round 3c recorded: `s_beta` = 2 in the seventh row, which drops the `s_alpha` = 2 both
carried, and `s_eta` = 2 in the eighth, which drops their `s_eps` = 2. These effects are why round
3d is not removal-only; they are disclosed here and in the engine header. Conversely, an entry D
that yields to B now yields on the replies after B's line (the fourth row), as in round 2. Round 3c
recorded D there.

Why not keep A pending instead, by turning A's normal slot yield-only? A single slot holds one
pending id. Keeping A would keep C yielding, but it would leave D unsuppressed on the reply that is
most likely about B, and that misattribution is what `yieldTo` exists to prevent. Because a
yield-only slot decides rule 1 on `r`, C could still arm a normal slot where round 3 did not,
unless a third slot state recorded that round 3 still held A's slot. Round 3d therefore follows
round 2's slot identity: the slot follows the latest awaited value, as rule 3d already did for a
yield-only slot of another entry. Keeping the effects above to the entries that yield to A would
need A kept pending for `yieldTo` beside B, a second pending id; that is follow-up F-3D-4.

**Evidence.**
- Capture suite (block 1):
  - the rule-3c rows of `YIELD_ONLY_CASES`, and two rows for a slot of `s_zeta`, the second
    withheld entry in scale order (review round 2 of the integration): a normal slot read with
    carry off stays, and a yield-only one is refreshed from `s_zeta`'s own cue. Before them, step 6
    reading `held[0] === next.id` for `held.includes(next.id)`, or taking the refreshed slot's cue
    from `held[0]`, passed the whole capture suite; each now fails it;
  - `supersede/withheld-entry-supersedes-a-normal-slot`;
  - eight `multi-carry/…` sequences (the table above; the eighth was added in review round 1 of
    the integration);
  - a new **round 3+ property**: 4,000 seeded multi-carry dialogues (1,000 with `?quick=1`). At
    every step it checks the three bullets of the restated claim, with round 3+ taken as this
    engine read with a normal slot or none and a yield-only result read as none. The property does
    not test rule 3c itself, since round 3+ includes it; the fixtures do that. It tests the
    yield-only machinery against it. In a scratch check it caught both mutants tried: carrying from
    a yield-only slot (91 failures) and deciding rule 1 on `s` (11 failures). Its note counts the
    normal slots rule 3c ends (still open at step 6) apart from those closed on the line itself
    (expired, answered or carried) and followed by rule 3d, as in round 3c; at seed 1296126801,
    456 and 280 (review round 2 of the integration; the first integrated note gave their sum, 736,
    as rule 3c's). An instrumented engine counted the same 456, all of them replaced by a yield-only
    slot: the property never reaches rule 3c's clearing of a normal slot (two or more withheld),
    which the fixture rows and the third trace cover. With round 3c's step-6 condition restored
    the note gives 0 and 283.
- A scratch differential run (not committed): 60,000 seeded dialogues on fixture variants with two
  to four entries that may carry, against the round-3c engine.
  - Every first difference was a rule-3c line (7,669), with the same captures on that line.
  - On the reply after it, round 3c carried a value into the entry whose slot ended 333 times;
    round 3d never did.
  - Of the item values round 3d recorded later in those dialogues that round 3c did not, all 17
    belonged to an entry yielding to that entry. That holds for that run's fixture variants only,
    not in general (the eighth row). The integration review reported a scratch run of its own
    (60,000 seeded dialogues with lines biased toward such chains; not committed, not re-run here):
    269 values round 3d recorded that round 3c did not; 12 of them belonged to entries that do not
    yield to the entry whose slot ended; 8 were recorded by neither round 3c nor round 2, and all 8
    followed the chain of the eighth row.
  - At the fix, a further scratch run (200,000 seeded dialogues from a generator like the round 3+
    property's, against the round-3c engine; not committed) found 61 values round 3d recorded that
    round 3c did not: 57 of an entry that yielded in round 3c to its pending id, 4 carried into a
    normal slot round 3c did not hold, and none of any other kind, as the general statement above
    says.
- On the MASQUE lexicon, 20,000 seeded dialogues (79,928 steps) built from the gold set 0.3.0
  texts and the lexicon's phrases gave no difference at all.
- The browser self-check passes 22/22 with the pinned `GOLD_0_3_0_SHA256` and
  `EXPECTED_BENCHMARK` unchanged.

**Recorded follow-ups (not changed; each reachable only with two `heard` entries, or a `heard`
entry with `carry` that yields).** Each was run through the round-2 engine. Each is a value round 2
did not record, and each is pinned in the capture suite as the engine behaves, so a change shows.
Like round 3d, a fix to any of them changes which slots arm and which ids are pending, so each needs
its own review of the entries that yield.

| Id | Rule | Trace (fixture) | Round 2 | Round 3d |
|---|---|---|---|---|
| F-3D-1 | 1 counts unresolved ids only | "zeta, and alpha not a short span" · "a long span" | two unresolved, cleared; nothing | `s_zeta` normal slot; `s_zeta` = 2 carried (`rule1/an-unresolved-cue-beside-a-withheld-one-arms-a-normal-slot`) |
| F-3D-2 | 3 ignores a withheld entry without `carry` | `s_zeta` without `carry`: "alpha" · "a zeta, not a long span" · "a long span" | cleared; nothing | `s_alpha` kept; `s_alpha` = 2 carried (`rule3a/a-withheld-entry-without-carry-leaves-a-normal-slot`): the defect above, with a B that has no `carry` |
| F-3D-3 | 1 decides on `r` | `s_beta` heard, carry 1: "alpha a while ago, for a long span" · "it persists" · "a long span" | `s_beta` yields; `s_alpha` = 2 carried (a value round 3 withholds) | `s_beta` normal slot armed on the second line; `s_beta` = 2 carried |
| F-3D-4 | 3c changes the pending id, and the effects chain | the eighth trace above (`s_eps` may carry; `s_eta` yields to `s_eps`) | `s_zeta` = 2 on the second line; `s_eps` armed on the third; `s_eps` = 2 carried | cleared on the third line; `s_eta` = 2 (`multi-carry/the-effect-chains-to-an-entry-yielding-to-a-third`) |

F-3D-3 is round 3's arming, which round 3b kept deliberately (§13.10, rule 1). Arming on `s`
instead would let a yield expose a cue that round 3 never armed. The conservative alternative is to
arm only when the cue is unresolved in both `r` and `s`. That changes which ids are pending, so it
needs the same review.

F-3D-4 would keep A pending for `yieldTo` beside B: a second pending id, or a slot state recording
that round 3 still holds A's slot. That changes the single-slot model, so it needs its own review of
every rule that reads the pending id; the engine is not changed now (integration review round 1).

**Records.** The engine header ("Slots" rule 3c and the restated claim), `contract.js`
(`PendingCue`), `04-module-authoring.md` §2.8, 03 (S12, E12, and the step-6 summary and the
removal-only bullet in §4.9), CHANGELOG.md (a round-3d note under round 3c) and this section. The
rubric change-log note does not describe rule 3c, so the rubric is not regenerated, and
`lexiconHash` is unchanged. Version axes: unchanged.