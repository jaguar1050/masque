# 05 — Scribe capture fixes: candidate design (robustness and clinical-safety lens)

**Prototype · not for clinical use.** Design only. Nothing in this document changes code or
module data. The phrase lists in §4.4 and Appendix A are **drafts for the clinical lead**: none
of them goes into `masque.rubric.json` until the lead approves it row by row.

Scope: F1 (heard signal), F2 (carry-over), F4 (the `lasts` false positive), and the
mechanism by which F3's approved phrases and gold cases are added. Clinical lead approval
covers F1-F4 as features. It does not cover any particular phrase, anchor or carry count.

---

## 0. What was verified before writing this

Every claim below comes from the files in this branch and from running the shipped engine
(`app/src/engine/extraction.js`, unmodified, imported natively in a browser) against
`masque.rubric.json` `lexicon` 0.3.1. A throwaway prototype of the design (not committed) was
run beside it on the same lexicon. That run reproduced the engine exactly on 12,000 random
utterances × three option sets (0 mismatches) before any new field was added.

| Utterance (patient, typed) | 0.3.1 today | With this design (F1/F2/F4 config, no F3 phrases) |
|---|---|---|
| "I'm feeling really dizzy" | `[]` | heard `v_vertigo` (cue "dizzy"); carry armed for 2 replies |
| …then "a few hours" | `[]` | `v_vertigo = 2` via carry ("hours", band 5 min – 72 h) |
| "as if the world is moving around me and I'm sitting still" | `[]` | `[]`. No cue exists, so this is an F3 vocabulary item |
| "everything is spinning" | `[]` | heard `v_vertigo` ("spinning" is already a cue; there was no band) |
| "I feel unsteady" / "I feel like I'm on a boat" | `[]` | `[]`. These are F3 vocabulary items (Appendix A) |
| "I get dizzy and it lasts a couple of hours" | `v_vertigo=2`, **`m_dur=1`** | `v_vertigo=2` only (F4) |
| "the room spins for a few seconds when I roll over" | `v_vertigo=1` | `v_vertigo=1`. "roll over" is an F3 draft for `v_head` |
| "My headaches last a couple of hours" | `m_head=1` only (**no `m_dur`**) | unchanged. `m_dur` has no cue "last" (F3 gap, §4.4) |
| "My attacks last two days" | `[]` (**no `m_dur`**) | unchanged (F3 gap, §4.4) |
| demo line 4 "…really dizzy too — kind of spinning, it comes and goes and lasts a while." | `[]` | heard `v_vertigo` only. `m_dur`'s cue-without-value is suppressed by F4, so no false "attack duration" signal appears |

Two of the orchestrator's F4 "keep working" examples do **not** work today:
"my headaches last a couple of hours" and "my attacks last two days" both miss `m_dur`, because
its cues are `lasts | last for | goes on for | sticks around` and the bare verb "last" is not
one of them. F4 must not make them worse, and it does not. Making them work is F3 vocabulary
(§4.4, Appendix A). The F4 table in §4.5 uses the "last for" forms, which do capture today.

Demo transcript: with this design, all 9 patient turns give byte-identical item, ctx and
red-flag captures. The only addition is one heard `v_vertigo` on turn 4. The carry expires
unused after turns 5 and 6, because neither contains a `v_vertigo` band phrase. Demo scoring is
therefore unchanged.

---

## 1. Capture shapes and ingestion

### 1.1 Existing item capture (unchanged)

```js
{ id, value, kind: "item" | "ctx" | "redflag", evidence: text, cueIndex, suppressedBy? }
```

### 1.2 New: heard capture (F1)

Emitted only when `extract(..., { heard: true })` is called. **The default call never emits
one**, so every existing caller, the gold-set benchmark and the parity suites see identical
output.

```js
{
  id: "<scale item id>",     // a lexicon scale entry whose cue matched
  kind: "heard",             // CAPTURE_KIND.HEARD (vocab.js)
  // no `value` key, ever: the value was not stated
  evidence: text,            // the whole utterance (as for every capture)
  cueIndex: i,               // position of the cue in `text`
  cue: "dizzy",              // the matched lexicon phrase (lowercase, as in the lexicon)
  cueText: "dizzy",          // text.slice(i, i + cue.length): the patient's own casing
  suppressedBy?: "third-party" | "historical" | "yield"   // only with includeSuppressed
}
```

A heard capture is emitted when **all** of these hold:

1. A scale entry's cue matches (`firstHit`, list order), and the cue is not negated. This is the
   same test that already opens a scale capture (extraction.js L114-115).
2. No band phrase of that entry matches, and `fallback` is `null`. This is the existing
   silent-drop branch at L118.
3. The entry does not yield in this utterance (F4, §4).
4. The third-party and historical gates pass at the cue position (`gated()` semantics). "My mom
   gets dizzy" and "I used to get dizzy" emit nothing, as they emit no capture today.

A heard capture never carries a value. `fallback` is never substituted. The item stays
unanswered (CLAUDE.md invariant 1).

### 1.3 New: carried item capture (F2)

Produced only by `extractInContext` (§3). It is an ordinary item capture plus provenance:

```js
{
  id, value, kind: "item",          // identical meaning to a normal item capture
  evidence: text,                   // the reply that supplied the value
  cueIndex: bandIndex,              // position of the band phrase in the reply
  via: "carry",                     // provenance marker; absent on normal captures
  band: "hours",                    // the band phrase that matched in the reply
  carriedFrom: {                    // the earlier cue-without-value
    cue: "dizzy", cueText: "dizzy", evidence: "<earlier utterance>", ref: 3   // ref = Scribe transcript id
  }
}
```

The key order is fixed as listed. Nothing outside the Scribe ever sees a carried capture: the
Screener, the benchmark and the per-utterance gold set never call `extractInContext`.

### 1.4 `ingestCaptures` (scribe.js): rules restated and pinned

The function body does not change. It already filters by `kind`, so:

| kind | effect | note |
|---|---|---|
| `item` (including `via:"carry"`) | first write wins: `if (a[id] === undefined) a[id] = value` | a carry can never overwrite an answer, including one written earlier in the same batch |
| `ctx` | overwrite | unchanged |
| `redflag` | raise-only, `"nlp"` | unchanged |
| `heard` | **ignored**: never written to `answers`, `ctx` or `rf`, and not in `touchedDomainItemIds` | absent stays absent |

The JSDoc gains one line ("`heard` captures are ignored: a cue without a value never sets an
answer") and a new test pins the behaviour (§7.4). The return shape stays exactly
`{answers, ctx, rf, touchedDomainItemIds}`. No new key is added, because the `rules` and
`golden` suites compare outputs shaped like it.

### 1.5 `vocab.js`

```js
export const CAPTURE_KIND = { ITEM: "item", CTX: "ctx", REDFLAG: "redflag", HEARD: "heard" };
```

`kindOf()` in scribe.js already falls back to membership for unknown kinds. `captureLabel` is
**not** extended, because the `rules` suite compares it exhaustively with the baseline
`capLabel`. Heard captures get their own label function (§2.1).

---

## 2. F1: the heard signal in the Scribe UI

### 2.1 Wording: engine-owned, with clinical words drawn only from module data

New exports in `app/src/engine/scribe.js`:

```js
/** "heard “<cueText>” · <itemShort>: not stated". Unknown id → the id in place of the short label. */
export function heardLabel(module, capture) → string

/** captureLabel(module, capture) + " · carried from “<carriedFrom.cueText>”" (captureLabel itself unchanged). */
export function carryLabel(module, capture) → string
```

For MASQUE: `heard “dizzy” · episode duration: not stated` and
`episode duration: 5 min – 72 h · carried from “dizzy”`.

- The only engine words are "heard", "not stated" and "carried from". "episode duration" is the
  item's `short` and "5 min – 72 h" is its scale label, both module data. The quoted cue is the
  patient's own words, sliced from the utterance.
- The wording names no symptom class, no "duration", no score and no band. It says exactly what
  happened: a word was heard and no value was stated. That satisfies "say what a number is" for
  the absence of one.
- The note, FHIR bundle, cohort row, `onScreen` payload and Patient app never see heard state.

### 2.2 Transcript bubble

In the `.cap` row under the patient bubble, heard captures render after item captures:

```jsx
<span className="sa-scribe-heardtag" data-heard={c.id}>{heardLabel(module, c)}</span>
```

- The class is **not** `captag`. The render-scribe `captags` array keeps its baseline meaning,
  "things captured", so a heard tag is never counted as a capture. Its style is a dashed amber
  outline on white (`SCRIBE_EXTRA_CSS`, `sa-scribe-` prefix, scoped by `scopeCss`):
  ```css
  .sa-scribe-heardtag{font-family:var(--mono);font-size:10px;background:#fff;border:1px dashed var(--amber);border-radius:6px;padding:2px 6px;color:#7A4E12}
  ```
- A carried capture renders as a normal `captag` with the `+` prefix and `carryLabel` text:
  `+ episode duration: 5 min – 72 h · carried from “dizzy”`.
- A heard capture for an item **already answered** when the utterance is ingested is dropped
  before it is stored on the transcript line. Showing "not stated" next to an answer on record
  would be false. The pending carry is not armed for it either (§3.3 step 6).
- Transcript tags are historical. A heard tag stays on its bubble after the item is later
  answered, because it is still true that nothing was stated *in that utterance*. The answer
  appears as its own capture tag on the bubble that supplied it.

### 2.3 Interim (live) preview

`previewCaps` changes from `extractor.extract(interim)` to
`extractor.extractInContext(interim, livePending()).captures`, where `livePending()` is
`pendingRef.current` when its item is still unanswered, else `null`. The returned `pending` is
**discarded**: interim text never arms, decrements or clears carry state. Preview rendering:

- item, ctx and red-flag captures: unchanged (`captag pending`, `? <captureLabel>`);
- heard: `<span className="sa-scribe-heardtag pending">? {heardLabel}</span>`, with
  `.sa-scribe-heardtag.pending{opacity:.72}`;
- carry: `captag pending`, `? <carryLabel>`.

Nothing is written until the recogniser commits the segment. That is the existing rule, and the
Playwright `voice` spec keeps asserting it.

### 2.4 Ask next: where the heard item goes

New pure helper in scribe.js:

```js
/**
 * Heard items not yet answered and not dismissed, most recently heard first, and the ranked
 * suggestions with those items removed (moved, never copied; no back-fill).
 * HeardPrompt = {id, ask: item.ask ?? item.text, tag (as rankSuggestions), scale, kind: "heard",
 *                cueText, at}
 * @param heard      {[itemId]: {cue, cueText, at}}  (Scribe state, §2.5)
 * @param dismissed  {[itemId]: at}                  (Scribe state, §2.5)
 * @returns {{heard: HeardPrompt[], rest: Suggestion[]}}
 */
export function promoteHeard(module, { heard = {}, dismissed = {}, answers = {}, suggestions = [] } = {})
```

The returned `rest` is `suggestions` with every `kind:"scored"` entry whose id is in `heard`
filtered out. Info prompts are never touched. A heard item outside the ranked top-N, for
example in an inactive domain, is still promoted: the patient volunteered it, and domain
activation is a ranking heuristic, not a gate.

**Render order inside `data-testid="scribe-prompts"`** (exact):

1. the empty-state message, when `heard.length === 0 && rest.length === 0` (same strings as today);
2. probe group `safety`, if live, untruncated (**safety first, always**);
3. **the heard group** (`data-testid="scribe-heard"`), untruncated;
4. the remaining probe groups in `PROBE_KIND_ORDER`: `rescue` (Re-ask, never truncated), then
   `criteria`, `ruleout`, `phenotype`, `exam` (truncated to 2 as today);
5. the ranked suggestions `rest`;
6. routing recommendations (unchanged gate).

Rationale and alternatives:

- Safety outranks everything, so a question that could surface a red flag is never pushed down
  by a heard symptom ("gate, don't warn": the safety tier is structural, not advisory).
- The approved F1 says "top of Ask next". Re-ask is not a safety tier. Its rule is that it is
  *never truncated* and *never retired through a target*, and both still hold, because every
  live rescue probe still renders, just below the heard group.
- The alternative, heard below Re-ask, is listed as open question O7. For MASQUE the only overlap
  is `pr_internal_vertigo` (rescues `v_vertigo`), which stays live while `v_vertigo` is
  unanswered. With heard first, the clinician sees the duration question for the symptom the
  patient just named, then the alternate-phrasing rescue.

The engine helper that fixes this order:

```js
/** Rail sections in render order: safety probe group(s), then the heard group, then the other probe groups. */
export function askNextSections(probeGroups, heardPrompts) → Array<{kind:"probes", group} | {kind:"heard", items}>
```

It inserts the heard section after every group whose `PROBE_KIND[kind].rank === 0`, or first when
there is no such group. It is generic: it reads the engine vocabulary, never a module id.

**Heard group markup.** The blocks are deliberately not `.prompt`, so no existing selector or
parity driver confuses them with suggestions:

```jsx
<div data-testid="scribe-heard">
  <div className="qtag" style={{color:"var(--amber)",margin:"10px 0 4px"}}>
    Heard · value not stated — nothing is recorded until it is answered
  </div>
  {heardPrompts.map(hp => (
    <div className="sa-scribe-heardq" key={hp.id} data-heard-prompt={hp.id}>
      <div className="qtag"><HelpCircle size={11} /> {hp.tag} · heard “{hp.cueText}”</div>
      <div className="qq">{hp.ask}</div>
      <div className="prow">
        {hp.scale.map((o, i) => <button key={i} className="pbtn" onClick={() => answerPrompt(hp, i)}>{o.label}</button>)}
        <button className="pbtn skip" onClick={() => dismissHeard(hp)} data-testid="scribe-heard-skip">Skip</button>
      </div>
    </div>
  ))}
</div>
```

CSS (`SCRIBE_EXTRA_CSS`):

```css
.sa-scribe-heardq{border:1px solid var(--line);border-left:3px dashed var(--amber);border-radius:0 11px 11px 0;background:#FffdF8;padding:11px 13px;margin-top:9px}
.sa-scribe-heardq .qtag{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--amber);font-weight:700;margin-bottom:3px;display:flex;gap:6px;align-items:center}
.sa-scribe-heardq .qq{font-size:13.5px;font-weight:560;margin-bottom:8px}
```

- Every scale option is offered, including the f = 0 option. The clinician may legitimately
  record it. The engine does not pre-select, hide or reorder options.
- `answerPrompt(hp, i)` takes the existing scored branch (`setAnswers`, `setAsked`).
- The "Ask next (N)" label counts `heard.length + rest.length`.

### 2.5 Heard state in the Scribe, and when it clears

```js
const [heard, setHeard] = useState({});          // itemId -> {cue, cueText, at}  (at = transcript id)
const [heardDismissed, setHeardDismissed] = useState({}); // itemId -> at of the heard event dismissed
```

New pure helper (scribe.js):

```js
/** Fold one utterance's heard captures in: the latest event per item wins. Returns a new object, or the input when nothing changed. */
export function foldHeard(heard, captures, at) → heard
```

A heard item is shown in Ask next while
`answers[id] === undefined && !(heardDismissed[id] >= heard[id].at)`. It clears when:

| Event | Effect |
|---|---|
| item answered, by any route (carry, a later per-utterance capture, a heard or suggestion button, a probe option) | hidden at once. The filter is derived at render, so no effect or race is involved |
| heard block **Skip** | `heardDismissed[id] = heard[id].at`; also clears `pendingRef` if it points at that item. Writes no answer (identical to suggestion Skip semantics: skip is not denial) |
| a **new** heard event for the same item after a Skip | shown again (`at` is newer than the dismissal) |
| **Reset** | `setHeard({})`, `setHeardDismissed({})`, `pendingRef.current = null` |
| **module change** | the workspace remounts (existing behaviour). Defensively, `useEffect(() => { pendingRef.current = null; setHeard({}); setHeardDismissed({}); }, [module])` |
| carry expiry (§3) | **no effect on the heard prompt.** The item is still unanswered and the question is still worth asking. Only automatic carry stops |

`heard` is never counted in `dirtySummary` on its own. The transcript lines that produced it
already make the encounter dirty.

---

## 3. F2: carry-over

### 3.1 Data

Lexicon (module data, opt-in per entry; §5):

```json
{ "id": "v_vertigo", "cue": [...], "bands": [...], "fallback": null, "carry": 2 }
```

`carry` is an integer 0-3 (`CARRY_MAX = 3`, exported from extraction.js). Absent means 0, which
means never carried. There is **no global default**. Carry changes scoring behaviour, so it
must be a visible, versioned, per-item decision in module data that the clinical lead signs
off. For MASQUE 0.3.2 only `v_vertigo` gets `carry: 2` (the approved F2 example). Whether
`m_dur` should carry is open question O3.

Pending state (one slot; plain object; owned by the caller):

```js
/** @typedef {{id:string, cue:string, cueText:string, evidence:string, cueIndex:number,
 *             ref:(number|null), turnsLeft:number}} PendingCue */
```

### 3.2 API (extraction.js, pure, no state of its own)

```js
/**
 * One patient utterance in the context of the previous cue-without-value.
 * Pure: never mutates `lexicon`, `pending` or `opts`; the same inputs give the same output.
 * @param {Object} lexicon
 * @param {string} text
 * @param {PendingCue|null} pending
 * @param {{negationWindow?:number, utteranceRef?:(number|null)}} [opts]
 * @returns {{captures: Capture[],          // extract(..., {heard:true, contextIds}) + the carried capture last, if any
 *            pending: (PendingCue|null),   // the state to pass with the next PATIENT utterance
 *            carry: {applied:boolean, refused:(null|CarryRefusal)}}}
 */
export function extractInContext(lexicon, text, pending = null, opts = {})

/** The value a reply supplies for `pending`, or the reason it supplies none. Pure. */
export function carryValue(lexicon, text, pending, opts = {})
  → {value:number, index:number, phrase:string} | {refused: CarryRefusal}

/** "no-band" | "negated" | "ambiguous" | "third-party" | "historical" | "question" | "other-entry" | "reheard" | "answered" */
CarryRefusal

createExtractor(lexicon) gains  extractInContext: (text, pending, opts) => extractInContext(lex, text, pending, opts)
```

### 3.3 Algorithm (exact)

Given `pending` (possibly `null`) and one **patient** utterance `text`:

1. `ctxIds = pending ? [pending.id] : []`.
   `caps = extract(lexicon, text, { negationWindow, heard: true, contextIds: ctxIds })`.
   `contextIds` makes a pending item count as "cue present" for F4's `yieldTo` (§4). Example:
   with `v_vertigo` pending, "It lasts a couple of hours" no longer captures `m_dur`, because
   `m_dur` yields to the pending `v_vertigo` and has no anchor.
2. `next = pending ? {...pending, turnsLeft: pending.turnsLeft - 1} : null`. Every patient
   utterance consumes one turn, whether or not it carries.
3. If `pending`:
   - a. If `caps` holds an `item` capture for `pending.id`, the reply named the symptom with a
     value and normal extraction answered it. Then `next = null` and `refused = "answered"`
     (not a failure; the item is answered).
   - b. Else if `caps` holds a `heard` capture for `pending.id`, the symptom was named again
     without a value. `refused = "reheard"`, and step 6 re-arms with a fresh `turnsLeft`.
   - c. Else, the **other-entry guard**. Collect every phrase hit in `text`, regardless of
     negation or gating, of:
     every `bool[].ph`, `ctx[].ph`, `multi[].ph`, every `redFlags` list, and every **other**
     `scale[].cue`. Exclude entries that yielded in this utterance (they yielded *to* the pending
     topic, so they are not a competing topic). If any hit remains: `refused = "other-entry"`.
     A reply that names anything else the lexicon knows ("my headaches last all day", "the
     nausea lasts hours", "a few hours, and bright lights bother me", "double vision for an
     hour") may be giving that other thing's duration. The engine cannot tell which, so it
     refuses.
   - d. Else `r = carryValue(lexicon, text, pending, opts)`:
     - Collect every occurrence of every band phrase of the pending entry as a span
       `[start, end, v]`.
     - **Drop contained spans.** A span inside a longer span is not an independent hit:
       "a couple of minutes" hits `couple of minutes` (v 1) and `minutes` (v 2); the inner
       `minutes` is dropped, so v = 1. This reproduces the intent of band order without its
       first-band-wins tie-break.
     - No spans: `no-band`.
     - Drop spans negated at their start (`cueBefore` with the lexicon negation cues and window).
       None left: `negated` ("not for hours", "no just a few seconds").
     - More than one distinct `v` left: `ambiguous` ("a few seconds or a few minutes";
       "hours, sometimes for days"). The per-utterance extractor would pick the first band in
       list order. Carry has no cue anchoring the sentence, so it is stricter and refuses.
     - The third-party gate at the chosen span: `third-party` ("my mom gets it for hours").
       The historical gate: `historical` ("I used to have it for hours").
     - `text` contains `?` or `¿`: `question`. This is a weak guard (speech recognition often
       drops punctuation, §9 R3), but it costs nothing.
     - Otherwise return `{value: v, index: start, phrase}`.
     - On a value: append the carried capture (§1.3) to `caps`, set `next = null`, `applied = true`.
4. If `next && next.turnsLeft <= 0`: `next = null`. Expiry is silent and changes nothing.
5. The heard captures of this utterance (`kind: "heard"`, unsuppressed) are `H`.
6. **Arming:**
   - If `H.length === 1` and that entry has `carry > 0`, arm:
     `next = {id, cue, cueText, evidence: text, cueIndex, ref: opts.utteranceRef ?? null, turnsLeft: entry.carry}`.
     This also covers re-arming the same item (step 3b).
   - **Except** when the heard cue's span lies inside a phrase hit of another entry. Example:
     the `n_auto` phrase "dizzy when i stand" contains the cue "dizzy". The heard tag is still
     shown (the clinician should see it), but carry is not armed. Orthostatic light-headedness
     must not acquire a vertigo duration from the next reply. Verified: "I get dizzy when I
     stand" → `n_auto=yes` + heard `v_vertigo`, pending `null`; then "a few seconds" → nothing.
   - If `H.length > 1`: `next = null`. Two symptoms named without values in one breath are
     ambiguous for any reply. Both stay promoted as heard, and neither carries.
   - A new heard item of a **different** entry replaces the old pending (single slot,
     superseded). The old item's heard prompt stays in Ask next.
7. Return `{captures: caps, pending: next, carry: {applied, refused}}`.

### 3.4 Where the state lives (Scribe.jsx)

```js
const pendingRef = useRef(null);      // PendingCue | null — a ref, so back-to-back voice finals see it synchronously
const answersRef = useRef({});        // mirror of `answers`, updated in render AND synchronously inside ingest
answersRef.current = answers;         // in render (before any handler runs)
```

`ingest(role, text, src)` becomes:

```js
function ingest(role, text, src = "demo") {
  const at = transcriptCountRef.current++;           // stable id (replaces t.length; same values)
  let caps = [];
  if (role === "pt" && extractor) {
    let p = pendingRef.current;
    if (p && answersRef.current[p.id] !== undefined) p = null;     // expiry: item answered meanwhile
    const r = extractor.extractInContext(text, p, { utteranceRef: at });
    caps = r.captures;
    // a heard capture for an answered item is dropped; carry is never armed for it
    caps = caps.filter(c => !(c.kind === CAPTURE_KIND.HEARD && answersRef.current[c.id] !== undefined));
    pendingRef.current = r.pending && answersRef.current[r.pending.id] === undefined ? r.pending : null;
  }
  if (caps.length) {
    /* existing pulse / setAnswers / setCtx / setRf, unchanged: ingestCaptures ignores heard */
    answersRef.current = ingestCaptures({ answers: answersRef.current }, caps).answers;
    const h = caps.filter(c => c.kind === CAPTURE_KIND.HEARD);
    if (h.length) setHeard(x => foldHeard(x, h, at));
  }
  setTranscript(t => [...t, { id: at, role, text, src, caps: caps.map(c => ({
    id: c.id, value: c.value, kind: c.kind,
    ...(c.via ? { via: c.via, from: c.carriedFrom && c.carriedFrom.cueText } : {}),
    ...(c.kind === CAPTURE_KIND.HEARD ? { cueText: c.cueText } : {}),
  })) }]);
}
```

`transcriptCountRef` is reset to 0 by Reset. `pendingRef` is also cleared by heard Skip and by
module change (§2.5).

### 3.5 Decrement and expiry rules

| Event | Effect on `pending` |
|---|---|
| a committed **patient** segment (voice final, typed statement, demo patient line) | step 2: `turnsLeft − 1`; carry attempted first |
| a **physician** segment (voice with the toggle on Physician, demo physician line) | **none**. Not extracted, not consumed |
| an **interim** segment | **none** (preview only, §2.3) |
| `turnsLeft` reaches 0 | cleared silently |
| the item is answered by any route | cleared before the next patient segment (§3.4) |
| a new cue-without-value for a different item | replaced (single slot) |
| two heard items in one segment | cleared |
| heard Skip for that item | cleared |
| Reset, module change, unmount | cleared |
| Stop / restart listening, speaker toggle | **none**: the conversation continues |

Voice finals are per recogniser segment, not per conversational turn. A patient answer split
into two finals consumes two turns. With N = 2, "I've been dizzy" [final] + "for a few hours"
[final] still carries, because the second segment is the first reply. Open question O9 records
that a third, unrelated segment from the same breath is the first to fall outside the window.

### 3.6 Edge-case catalogue (each has a test in §7.3)

| # | Sequence (pt unless marked) | Result | Why |
|---|---|---|---|
| C1 | "I'm feeling really dizzy" → "a few hours" | `v_vertigo=2` via carry | approved F2 example |
| C2 | dizzy → "about an hour" | `=2` | "an hour" (band 3) |
| C3 | dizzy → "It lasts a couple of hours" | `=2`; **no `m_dur`** | `m_dur` yields to the pending topic; carry "hours" |
| C4 | dizzy → "my headaches last all day" | `m_head=1`; carry **refused** (other-entry); pending 1 left | another symptom named |
| C5 | dizzy → "my headache lasts all day" | `m_head=1`, `m_dur=2`; carry refused | the headache anchor stops the yield; other-entry |
| C6 | dizzy → "a couple of minutes" | `=1` | contained span dropped |
| C7 | dizzy → "a few seconds or a few minutes" | refused (ambiguous) | two values |
| C8 | dizzy → "No just a few seconds" | refused (negated) | conservative; item stays heard |
| C9 | dizzy → "not for hours" | refused (negated) | |
| C10 | dizzy → "My mom gets it for hours" | refused (third-party) | |
| C11 | dizzy → "I used to have it for hours" | refused (historical) | |
| C12 | dizzy → "the nausea lasts hours" | `m_nausea=yes`; refused (other-entry) | |
| C13 | dizzy → "Bright lights bother me" → "for hours" | `m_photo=yes`; then `=2` via carry on the 2nd reply | N = 2 |
| C14 | dizzy → "Bright lights bother me" → "my ears ring" → "for hours" | nothing carried; pending expired after reply 2 | expiry |
| C15 | dizzy → md "How long does it last?" → md "Minutes or hours?" → pt "hours" | `=2` | physician turns do not consume |
| C16 | dizzy → "minutes or hours?" | refused (question) | |
| C17 | "I get dizzy when I stand" → "a few seconds" | `n_auto=yes`, heard `v_vertigo`; **no carry** | cue inside another entry's phrase: not armed |
| C18 | "I'm dizzy and my headache lasts forever" → "a couple of hours" | heard `v_vertigo` and heard `m_dur`; nothing carried | two heard: pending cleared |
| C19 | dizzy → "I feel dizzy again" → "hours" | re-armed (2), then `=2` | re-heard resets the window |
| C20 | dizzy → "My attacks last for two days" | nothing (`m_dur` yields to the pending topic; `v_vertigo` has no band "two days") | conservative: both stay unanswered |
| C21 | dizzy → clinician answers `v_vertigo` via a button → "a few hours" | no carry (pending cleared) | first write wins is also enforced upstream |
| C22 | "My mom gets dizzy" → "for hours" | nothing heard, nothing carried | gated at the cue |
| C23 | "I'm not dizzy" → "for hours" | nothing | negated cue: not heard |
| C24 | dizzy → interim "a few hours" (not final) | preview `? episode duration: 5 min – 72 h · carried from “dizzy”`; no answer; pending unchanged | preview only |
| C25 | dizzy → Reset → "a few hours" | nothing | Reset clears |
| C26 | dizzy → "for several days" | `=3` | band 2 |

All 26 rows were run on the prototype except C15, C21, C24 and C25, which need the Scribe
component. Their expected outcomes follow directly from §3.4 and §3.5.

---

## 4. F4: a generic yield mechanism

### 4.1 The defect

`m_dur` (untreated *headache attack* duration) has the verb cues
`lasts | last for | goes on for | sticks around` and band "couple of hours" → 1. Any sentence
that uses the verb, about any symptom, scores it:

- "I get dizzy and it lasts a couple of hours" → `v_vertigo=2` **and** `m_dur=1`.
- "When I'm off balance it sticks around all day" → `v_vertigo=2` **and** `m_dur=2`.
- "It's not a headache, the dizziness lasts a couple of hours" → `v_vertigo=2` **and** `m_dur=1`.

All three were verified against the 0.3.1 engine.

### 4.2 Options compared

| | A. `yieldTo` + `anchor` (recommended) | B. `requireAny` context list | C. proximity window between cue and band | D. exclusive groups (nearest cue wins) |
|---|---|---|---|---|
| Rule | an entry yields (captures nothing, and is not heard) when a cue of a listed entry is present, **unless** one of its own anchor phrases is present unnegated | an entry fires only when one of its context phrases is also present | the band must lie within N chars after the cue | when cues of grouped entries co-occur, the band attaches to the nearest cue |
| Fixes "dizzy … lasts a couple of hours" | yes | yes | **no** (cue and band are adjacent) | yes (usually) |
| Keeps "my headache lasts a couple of hours" | yes (no `v_vertigo` cue) | yes | yes | yes |
| Keeps "my attacks last for two days" | yes (no `v_vertigo` cue) | **no**, unless "attack" is a context phrase. Every `m_dur` utterance without the context word is lost, including demo-style follow-ups where "headache" was said one sentence earlier | yes | yes |
| Blast radius | only sentences that also name the yield target | **every** utterance of the entry. Changes recall everywhere and needs a bigger approved phrase list | every utterance of every entry | every utterance with co-occurring cues; word-distance heuristics |
| Works with carry context (F2) | yes: a pending item counts as a present cue (C3, C20) | no natural hook | no | no |
| New clinical content | an anchor list (most of it reuses existing `m_head` cues) | a context list for every entry it is used on | a number | a grouping |
| Engine complexity | ~15 lines, no id branches | ~5 lines | ~10 lines | ~40 lines with distance ties |

**Recommendation: A.** It changes behaviour only where the defect lives: a sentence naming the
other symptom. It is conservative, because a contested duration is dropped (absent, never
negative) rather than guessed. It composes with F2 through `contextIds`, and it needs no new
vocabulary beyond an anchor list that the lead approves.

### 4.3 Semantics of A (exact)

Lexicon scale entry, optional fields:

```json
{ "id": "<entry>", "cue": [...], "bands": [...], "fallback": null,
  "yieldTo": ["<scale or bool entry id>", ...],
  "anchor": ["<phrase>", ...] }
```

In `extract`'s scale loop, after the cue test (unchanged) and the band selection (unchanged):

```js
const yt = yieldTarget(ex);   // null unless ex.yieldTo is non-empty
if (yt !== null) {
  if (keep && (v !== null && v !== undefined || wantHeard))
    push({ id: ex.id, ...(v != null ? { value: v } : {}), kind: v != null ? "item" : "heard",
           evidence: text, cueIndex: i, suppressedBy: "yield", yieldTo: yt });
  continue;
}
```

where

```js
// A listed entry "is present" if any of its cue phrases (scale) or phrases (bool) occurs
// anywhere in the text, regardless of negation or attribution, or if it is in opts.contextIds.
// The anchor overrides only when at least one anchor hit is NOT negated.
const yieldTarget = (ex) => {
  const ys = arr(ex.yieldTo);
  if (!ys.length) return null;
  const t = ys.find(id => context.has(id) || phrasesOf(id).some(p => low.includes(p)));
  if (t === undefined) return null;
  return allHits(text, arr(ex.anchor)).some(j => !negatedNear(text, j, win)) ? null : t;
};
```

Design choices, each the conservative one:

- **Target presence ignores negation and attribution.** In "I'm not dizzy but it lasts a couple
  of hours" the topic is still dizziness and "it" is ambiguous, so `m_dur` yields and the item
  stays absent.
- **The anchor must be unnegated.** In "It's not a headache, the dizziness lasts…" the denied
  headache does not license a headache duration.
- **Yield suppresses the heard capture too.** The demo's "…spinning … lasts a while" must not
  promote "attack duration" to the clinician.
- **Pass order is irrelevant.** Yield reads cue presence in the text, never other entries' results.
- With `includeSuppressed`, a yielded match is reported as `suppressedBy: "yield"` with
  `yieldTo: <id>`, so the benchmark's error taxonomy can name it ("over-suppressed:yield").
- The new fields are absent from 0.3.1, so the engine with the 0.3.1 lexicon is byte-identical
  to the baseline. The `extraction` suite keeps proving this on the reverted lexicon (§7.2).

### 4.4 MASQUE configuration for the clinical lead (DRAFT — needs approval)

`/lexicon/scale/2` (`m_dur`). The entry's position is asserted by id in the test delta (§7.1).

```json
"yieldTo": ["v_vertigo"],
"anchor": ["headache", "migraine", "head pain", "facial pressure", "facial pain", "pressure in my face", "behind my eyes"]
```

| Anchor | Source | Lead |
|---|---|---|
| `headache` | existing `m_head` cue | ☐ approve ☐ strike |
| `facial pressure` | existing `m_head` cue | ☐ ☐ |
| `facial pain` | existing `m_head` cue | ☐ ☐ |
| `pressure in my face` | existing `m_head` cue | ☐ ☐ |
| `behind my eyes` | existing `m_head` cue | ☐ ☐ |
| `migraine` | new (in `m_fhx` phrases as "i get migraine" etc.) | ☐ ☐ |
| `head pain` | new | ☐ ☐ |

(`sinus headache`, the remaining `m_head` cue, is subsumed by `headache`.)

`/lexicon/scale/1` (`v_vertigo`), for F2: `"carry": 2` ☐ approve ☐ strike.

Optional extension, not in the approved scope (open question O2): add bool targets to
`m_dur.yieldTo`, for example `v_aural` ("my ear rings and it lasts a couple of hours" scores
`m_dur=1` today). The mechanism supports it with no further engine change.

Vocabulary gaps found while testing F4. These are F3 drafts, not F4:
"My headaches last a couple of hours" and "My attacks last two days" capture no `m_dur`. The
candidate cues `headaches last`, `attacks last`, `migraines last`, `last about`, `last around`
and `last up to` are listed in Appendix A for the lead. The bare verb `last` is **not**
proposed: it would match "last week", "last visit" and "at last".

### 4.5 Before and after: F4 config only, no F3 phrases (verified on the prototype)

| # | Utterance | 0.3.1 | 0.3.2 (F4) |
|---|---|---|---|
| 1 | I get dizzy and it lasts a couple of hours | `v_vertigo=2`, `m_dur=1` | `v_vertigo=2` |
| 2 | When I'm off balance it sticks around all day | `v_vertigo=2`, `m_dur=2` | `v_vertigo=2` |
| 3 | It's not a headache, the dizziness lasts a couple of hours | `v_vertigo=2`, `m_dur=1` | `v_vertigo=2` |
| 4 | My headache lasts a couple of hours | `m_head=1`, `m_dur=1` | unchanged |
| 5 | My headaches last for a couple of hours | `m_head=1`, `m_dur=1` | unchanged |
| 6 | My attacks last for two days | `m_dur=2` | unchanged |
| 7 | I'm dizzy and my headache lasts all day | `m_head=1`, `v_vertigo=2`, `m_dur=2` | unchanged (anchor). `v_vertigo=2` from "all day" is a pre-existing likely false positive (§9 R4) |
| 8 | The vertigo goes on for days and my headaches last for a day or two | `m_head=1`, `v_vertigo=3`, `m_dur=2` | unchanged (anchor) |
| 9 | I get migraines that last for a couple of hours and I get dizzy | `m_fhx=yes`, `v_vertigo=2`, `m_dur=1` | unchanged **if `migraine` is approved**. If it is struck, `m_dur` is dropped |
| 10 | My mom gets dizzy and it lasts a couple of hours | `[]` | `[]` |
| 11 | The spinning lasts about two hours each time. (gold e07) | `v_vertigo=2` | unchanged |
| 12 | The dizziness only lasts a few seconds, then it passes. (gold e08) | `v_vertigo=1` | unchanged |
| 13 | It lasts a couple of hours (standalone) | `m_dur=1` | unchanged per utterance. **With `v_vertigo` pending (Scribe), it yields** (C3) |
| 14 | My headaches last a couple of hours | `m_head=1` | unchanged (F3 gap) |
| 15 | My attacks last two days | `[]` | unchanged (F3 gap) |
| 16 | demo line 4 (…dizzy … spinning … lasts a while) | `[]` | `[]`; heard `v_vertigo` only (with `heard:true`) |

Gold set 0.2.0 (44 cases): 0 outputs change. A 5,000-utterance synthetic corpus of the
`extraction` suite's kind also showed 0 changes. That corpus almost never puts a `v_vertigo` cue,
an `m_dur` cue and an `m_dur` band in one utterance, which is why §7.2 adds a targeted F4 corpus.

---

## 5. Contract, validator, editor, hashes

### 5.1 `contract.js`

Lexicon typedef, scale row:

```js
 * @property {Array<{id:string, cue:string[], bands:Array<{ph:string[], v:number}>, fallback:(number|null),
 *                   carry?:number, yieldTo?:string[], anchor?:string[]}>} scale  R
 *   carry    O 0–CARRY_MAX (3): later PATIENT replies that may supply this item's value after its cue was
 *            heard without one (Scribe only; extractInContext). Needs fallback null and ≥1 band.
 *   yieldTo  O ids of other lexicon entries (scale or bool). When a phrase of one of them occurs in the
 *            utterance (or it is the pending item), this entry captures nothing and is not heard,
 *            unless one of its `anchor` phrases occurs unnegated.
 *   anchor   O phrases that keep this entry live despite a yield target; requires yieldTo.
```

New export (the foundations subset check allows added names):

```js
/** Keys a lexicon scale entry may carry (validator V28 warns on any other). */
export const LEXICON_SCALE_KEYS = ["id", "cue", "bands", "fallback", "carry", "yieldTo", "anchor"];
```

### 5.2 `validate.js` (`checkLexicon` and `lexiconPhrases`)

No new V-codes, so the mutation-corpus rule "≥ 1 fixture per code" is untouched. New fixtures
are added anyway (§7.5). Inside the `arr(lex.scale).forEach` block, with `p = /lexicon/scale/${i}`:

| Rule | Sev | Path | Message |
|---|---|---|---|
| `carry !== undefined && !(Number.isInteger(carry) && carry >= 0 && carry <= 3)` | E V28 | `p/carry` | `carry must be an integer 0–3: the number of later patient replies that may supply "<id>"'s value` |
| `carry > 0 && fallback !== null` | E V28 | `p/carry` | `"<id>" has a fallback, so its cue always sets a value and is never heard without one; carry needs fallback null` |
| `carry > 0 && !bands.length` | E V28 | `p/carry` | `"<id>" has no bands, so a later reply could never supply a value` |
| `yieldTo !== undefined && (!Array.isArray(yieldTo) \|\| !yieldTo.length)` | E V28 | `p/yieldTo` | `yieldTo must be a non-empty list of lexicon entry ids` |
| element not a string, or not the id of a `scale` or `bool` entry in this lexicon | E V28 | `p/yieldTo/k` | `"<x>" is not a scale or yes/no entry of this lexicon` |
| element equals the entry's own id | E V28 | `p/yieldTo/k` | `an entry cannot yield to itself` |
| duplicate element | E V28 | `p/yieldTo/k` | `"<x>" is listed twice` |
| a yield cycle among scale entries (DFS over `yieldTo` restricted to scale ids) | E V28 | `p/yieldTo` | `yield cycle <a> → <b> → <a>: a sentence naming both captures neither` |
| `anchor !== undefined && yieldTo === undefined` | E V28 | `p/anchor` | `anchor has no effect without yieldTo` |
| `anchor` not a non-empty list | E V28 | `p/anchor` | `anchor must be a non-empty phrase list` |
| any key outside `LEXICON_SCALE_KEYS` | **W** V28 | `p/<key>` | `"<key>" is not a lexicon scale field and is ignored (a misspelt yieldTo, anchor or carry?)` |

`lexiconPhrases` adds `list(e.anchor, ${p}/anchor)`, so V29 (lowercase, non-empty, the < 3-char
warning) covers anchors with no other change.

MASQUE must still validate with **0 errors and the same expected warnings** (`validate` suite:
V12 `n_allo`, V33 es fallbacks). The new warning never fires on MASQUE, because it has no unknown
keys.

### 5.3 `derive.js` (Rubric Editor model)

- `EDITABLE` gains `"/lexicon/scale/*/anchor"` and `"/lexicon/scale/*/anchor/*"`. Anchors are
  phrase lists and edit like cue lists.
- `carry` and `yieldTo` are **not** added. They are read-only structure (anything not EDITABLE
  is read-only by construction) and round-trip unchanged through Apply, Download all and upload.
- The item-removal path (`itemDependents` and the removal helper near L1056-1090) also removes the
  id from every `yieldTo`. If that leaves an empty list it drops `yieldTo` and `anchor` together,
  so a removal can never produce a V28 error. It reports `{path: "/lexicon/scale/<i>/yieldTo",
  what: "a yield reference"}` among the dependents.
- `classifyChanges`: a change to `anchor`, `carry` or `yieldTo` is a lexicon change. This is
  automatic, because all three are inside the lexicon hash projection.

### 5.4 `RubricEditor.jsx`

In `LexiconSection` → "Scale items", per entry `e` at index `i`:

```jsx
<PhraseList path={`/lexicon/scale/${i}/cue`} label={`${e.id} cue — ${nameOf(e.id)}`} />
{arr(e.bands).map(/* unchanged */)}
{Array.isArray(e.yieldTo) && (
  <div className="re-sub" data-yield={e.id}>
    Yields to {e.yieldTo.join(", ")} (read-only): a sentence that names one of these captures nothing for {e.id} unless an anchor below is present.
  </div>
)}
{Array.isArray(e.anchor) && <PhraseList path={`/lexicon/scale/${i}/anchor`} label={`${e.id} anchors`} minOne />}
{Number.isInteger(e.carry) && e.carry > 0 && (
  <div className="re-sub" data-carry={e.id}>
    Carry {e.carry} (read-only): after the cue is heard without a value, the next {e.carry} patient replies in the Ambient Scribe may supply it.
  </div>
)}
```

`minOne` on anchors: the last anchor cannot be removed while `yieldTo` exists, so the editor
cannot create the "anchor without phrases" error. The section's existing "lexicon changed → -local
version / not re-run" warning covers edits to anchors.

### 5.5 `hash.js`

**No code change.** `hashProjections.lexicon` hashes the whole lexicon minus `version`, `lang` and
`goldSet`, so the new fields and phrases enter `lexiconHash` automatically:

- MASQUE `lexiconHash` and `contentHash` change, and `rubricSha256` changes. This is expected.
- `instrumentHash` and `scoringHash` **must not change**. Instrument 0.2 is untouched, and the
  research calibration gate keys on `scoringHash`. The `values` suite's
  `calibrationGate(masque) === true` check and a new explicit equality pin (§7.1) prove it.
- `logicSha256` does not change: `masque.logic.js` is untouched (probe set 1.0.0).
- Consequence for saved derivations: §9 R1.

---

## 6. Versioning and change logs

| Axis | Before | After | Owner / file |
|---|---|---|---|
| Release | 0.4.0 | **0.4.1** | `app/src/engine/policy.js` `APP_VERSION` (that line only. `SITE.ALLOW_JS_UPLOAD` is not touched) |
| Instrument | 0.2 | 0.2 | `masque.rubric.json` `instrumentVersion` (no item, weight or cut change) |
| Lexicon | 0.3.1 | **0.3.2** | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | 1.0.0 | `masque.logic.js` (untouched) |
| Gold set | 0.2.0 (lexicon 0.3.1, reference file) | **0.3.0 (lexicon 0.3.2)** | `lexicon.goldSet = {version:"0.3.0", lexiconVersion:"0.3.2", file:"masque_extraction_goldset.json"}`; the file moves to `app/modules/masque/` (§7.6) |
| Extractor | `EXTRACTOR_KIND` = "rule-based / phrase-match with local negation" | **unchanged** (still exactly that kind of matcher; the `extraction` suite pins it to the baseline string) | `extraction.js` |
| Extractor features | — | **new** `export const EXTRACTOR_FEATURES = Object.freeze(["heard", "scale.carry", "scale.yieldTo", "scale.anchor"])` | `extraction.js`. Printed in the benchmark header. Describes this engine's lexicon vocabulary separately from the lexicon version |
| Contract | 1 | 1 | additive optional fields. §9 R7 covers an older app reading a 0.3.2 lexicon |

**Release-string coupling (must land atomically with the APP_VERSION bump):**
`app/tests/harness/diff.js` `NEW_RELEASE = "0.4.0"` → `"0.4.1"`, AD4 `what` →
`"every printed release string: 0.3.0 → 0.4.1"`, and its comment. AD4 rewrites the baseline's
"0.3.0" only when the new side prints `NEW_RELEASE`. If APP_VERSION changes alone, every golden
and render comparison that prints the release FAILS. This supersedes orchestrator decision F6
("Release 0.4.0 stays the default"), which must be recorded in 03-design.md §8.4 and its decisions
table. Hard-coded `appVersion: "0.4.0"` props in `research.js`, `roundtrip.js` and
`research-parity.js` are self-consistent test inputs and stay as they are.

**Rubric `changelog`.** Append; never edit existing entries. The `values` provenance sweep already
exempts `/rubric/changelog/`. Drafts, with dates set on approval:

```json
{ "date": "<approval date>", "kind": "lexicon",
  "note": "Lexicon 0.3.1 → 0.3.2, approved by the clinical lead on <date>: <n> phrases added (listed with their approval in docs/refactor/05-candidate-robust.md Appendix A; struck drafts listed in CHANGELOG.md). Phrases are appended to their lists; no existing phrase is reworded, removed or reordered. Gold set 0.2.0 → 0.3.0: <k> authored cases added after the 44 unchanged v0.2.0 cases. Instrument 0.2 and probe set 1.0.0 unchanged.",
  "paths": ["/lexicon"] },
{ "date": "<approval date>", "kind": "lexicon",
  "note": "m_dur yields to v_vertigo: a sentence that names dizziness no longer scores the headache-attack duration unless it also names a headache anchor (approved anchor list). Extraction output changes on such sentences only; gold set 0.3.0 re-run.",
  "paths": ["/lexicon/scale/2/yieldTo", "/lexicon/scale/2/anchor"] },
{ "date": "<approval date>", "kind": "lexicon",
  "note": "v_vertigo carry 2: in the Ambient Scribe, after dizziness is heard without a duration, the next two patient replies may supply it; refused when the reply names anything else, is negated, ambiguous, attributed, historical or a question. Per-utterance extraction (Screener, benchmark) unchanged.",
  "paths": ["/lexicon/scale/1/carry"] }
```

**`app/modules/masque/CHANGELOG.md`**: the version-axes table becomes Lexicon 0.3.2 and Gold set
0.3.0 (lexicon 0.3.2). Add a new dated section quoting the three rubric entries verbatim, then
a sub-list "Considered and struck by the lead", where each struck draft phrase is listed with
the lead's reason. That record exists so that a later reader does not re-propose the same
phrase.

**`app/modules/masque/SOURCES.md`**: in the lexicon section, add one row per approved phrase:
path · phrase · "clinical lead approval <date> (F3)" · origin (problem report, module rescue-probe
wording, or new). Add one row for each F4 anchor ("existing `m_head` cue" or "new"), and one row
for `carry`. Record that the gold set moved to `modules/masque/` and is a superset of the
reference v0.2.0 file.

**`app/modules/masque/README.md`**: the versions line, and one paragraph on heard and carry
("the Scribe only; never a score from a heard cue").

**`app/modules/masque/EXTRACTION_BENCHMARK.txt`** (new): the `benchmark` suite's report (§7.6),
pasted in by the implementer from the test page. The Scribe footer already says "see
EXTRACTION_BENCHMARK". With `goldSet.lexiconVersion === lexicon.version`, the footer stops
saying "not re-run".

---

## 7. Tests

### 7.1 How the divergences are recorded, the harness-sanctioned way

`tests/harness/divergences.js` pins `tests/baseline/src` against `reference/fixed-src`. It is
**not** touched, and neither is `tests/baseline/MANIFEST.sha256` or its pin
`MANIFEST_SHA256`: this change edits no baseline file. Divergences of the *new code* from the
frozen baseline go where 03-design.md §8.4 puts them: the `ALLOWED_DIFFERENCES` table in
`tests/harness/diff.js`. Each entry has an exact normaliser and a detector, so an expected
difference that is not observed is a FAIL. §8.4's "Any difference that is not in §8.4 is a
defect … Widening it requires a design change recorded here and in `02-app-divergences.md`" is
satisfied by adding two rows to §8.4 and to 02-app-divergences.md, and by amending AD4:

| Id | Where | Baseline | New | Detector |
|---|---|---|---|---|
| AD4 (amended) | every printed release string | `0.3.0` | `0.4.1` | unchanged |
| **AD13** | the MASQUE lexicon (`values`); extraction captures on the 0.3.2 lexicon (`extraction`) | lexicon 0.3.1 as in `MASQUE_Extraction.js` | 0.3.1 plus **exactly** the approved delta in `tests/harness/lexicon-delta.js` | an F3/F4 gold case is in the corpus (`benchmark`), or the `/lexicon` projection is compared (`values`) |
| **AD14** | Scribe transcript, Ask next, view button label (`render-scribe`) | no heard signal | `.sa-scribe-heardtag` tags; the `scribe-heard` group; the heard item moved out of the suggestions; "Ask next (N)" counting the heard items | a heard tag is present in the new app at that step |

**`tests/harness/lexicon-delta.js`** (new; plain data plus three pure helpers; no imports). It is
the single, reviewable copy of what the lead approved:

```js
export const LEXICON_DELTA = {
  from: "0.3.1", to: "0.3.2", approvedOn: "<date>",
  // positions are asserted by entry id, so a reorder fails loudly
  addPhrases: [ { list: "scale", index: 1, entryId: "v_vertigo", field: "cue", phrase: "<approved>" }, /* … */
                { list: "bool", index: 8, entryId: "v_head", field: "ph", phrase: "<approved>" } ],
  setFields:  [ { list: "scale", index: 1, entryId: "v_vertigo", key: "carry", value: 2 },
                { list: "scale", index: 2, entryId: "m_dur", key: "yieldTo", value: ["v_vertigo"] },
                { list: "scale", index: 2, entryId: "m_dur", key: "anchor", value: ["<approved>", /* … */] } ],
};
export function applyDelta(lex031, delta) → lex032   // deep copy; phrases appended in delta order; new keys appended after `fallback` in delta order
export function revertDelta(lex032, delta) → lex031  // removes exactly those phrases and keys; throws on any mismatch
export function deltaLeaves(rubricLexicon, delta) → Set<string>  // the JSON pointers ("/rubric/lexicon/…") of every delta string
```

The AD13 normalisers (in diff.js):

- `values`, path `/lexicon`, when `a.version === from && b.version === to`: return
  `[applyDelta(a), b]` (exact: residual differences are still reported). Path `/module/versions`:
  `a.lexicon === from && b.lexicon === to` → `a2 = {...a, lexicon: to}`.
- `extraction`, paths `/lexicon032/extract/**` (§7.2 block 2), with
  `ctx.AD13 = {delta, text, negationWindow}`: remove from `b` each capture whose entry gained a
  delta phrase that occurs in `text`. Remove from `a` each capture of an entry with a delta
  `yieldTo` when a target phrase occurs in `text` and no anchor occurs unnegated. Compare the
  remainders in order. If they are equal, return `[b, b]`; else `[a, b]`. Any other difference,
  such as a changed value or an unexplained new capture, remains a FAIL.

The AD14 normaliser:

```js
// ctx.AD14 = { tags: string[]   (textContent of every .sa-scribe-heardtag in the new app, DOM order),
//              group: string|null (textContent of [data-testid=scribe-heard], prompts view),
//              moved: string[]  (textContent of each BASELINE .prompt whose ask text equals a heard prompt's ask),
//              label: {from:"Ask next (n)", to:"Ask next (m)"} | null }
appliesTo: (path, ctx) => !!(ctx && ctx.AD14) && /\/(transcript|encounter|view_safety|view_prompts|view_note|prompts)$/.test(path),
// strings: b2 = b minus each tag (first occurrence each), minus group, with label.to → label.from;
//          a2 = a minus each moved string (first occurrence each); a2 === b2 → [b, b] else [a, b]
// prompts arrays: a2 = a without the moved entries (once each); deep-equal(a2, b) → [b, b] else [a, b]
detector: (input) => !!(input && input.heard && input.heard.length),
```

`allowedDifference`'s error text becomes "design §8.4 lists AD1-AD14".

### 7.2 Suite changes

| Suite | Change |
|---|---|
| `values` | Import `LEXICON_DELTA`. Compare `/lexicon` and `/module/versions` with `allow: ["AD13"], ctx: {AD13: LEXICON_DELTA}`. Assert `revertDelta(R.lexicon)` deep-equals the eight baseline constants (key order included). Provenance sweep: skip a rubric string only when its pointer is in `deltaLeaves(R.lexicon, LEXICON_DELTA)` **and** its value equals the delta phrase. Any other new string is still "invented content" → FAIL. Pin `module.hashes.instrumentHash` and `scoringHash` to their 0.3.1 values (computed on the current commit before the change), so instrument 0.2 is provably untouched. `h.expect("AD13", {precondition: true, observed})` |
| `extraction` | **Block 1 (strict parity, unchanged corpus):** compare the baseline `extract` with `extract(revertDelta(lex), …)`. There is no AD here: the engine stays verbatim. Unchanged: gold 44 + demo + 5,000 synthetic × includeSuppressed × windows. `createExtractor(revertDelta(lex)).lexiconVersion === "0.3.1"`. `EXTRACTOR_KIND` is still equal to the baseline string. **Block 2 (0.3.2 audit):** the same corpus plus a targeted **F4 corpus** (every `v_vertigo` cue × every `m_dur` cue × every `m_dur` band × {no anchor, each anchor, each anchor negated} × {no prefix, third-party, historical}) plus every delta phrase in a positive, a negated and a third-party frame. Compare the baseline `extract` with `extract(lex, …)` under `allow: ["AD13"]`. **Block 3 (opt-in features, default-off proof):** for every corpus utterance, `extract(lex, t)` deep-equals `extract(lex, t, {heard:false, contextIds:[]})`, and the non-heard part of `extract(lex, t, {heard:true})` deep-equals `extract(lex, t)` |
| `render-scribe` | `ALLOW = ["AD4", "AD6", "AD5", "AD14"]`. Per `compare`, build `ctx.AD14` from both DOMs (§7.1). **Driver fix:** "answer the first suggestion" picks the baseline's first non-probe `.prompt`, reads its `.qq` text, and in the new app clicks the button with the same index in whichever of `[data-heard-prompt]` or `[data-suggestion]` has that `.qq`. Both apps then always answer the **same item**, so a moved prompt cannot fork the encounter state. `h.expect("AD14", {precondition: anyHeardTagSeen, observed})`. The demo walk exercises AD14 (turn 4). New behaviour blocks (§7.4) |
| `rules`, `golden`, `sweep`, `patient`, `probes`, `cohort-gen`, `integrity`, `research*`, `omissions`, `shape`, `upload`, `roundtrip` | no change in logic. They stay green through AD4's new `NEW_RELEASE`. `roundtrip` deep-equals rubrics, so it covers the new fields automatically. `omissions` confirms the Patient graph still excludes `extraction.js` and `scribe.js` |
| `validate` | new mutation fixtures (§7.5). MASQUE: 0 errors and the same warning list |
| `editor` | anchors are editable: edit an anchor, Apply, and get a "-local" lexicon version plus "not re-run". `carry` and `yieldTo` are read-only (locked, as with any non-EDITABLE path) and survive Apply byte-identically. Removing the item `v_vertigo` from a draft drops it from `m_dur.yieldTo` and drops `yieldTo` and `anchor`. The validator then reports 0 V28 |
| `static` | no rule changes. The new engine code must contain no MASQUE id or string, comments included. All examples in code comments use neutral words ("the pending item", "another entry") |
| **`carry`** (new) | §7.3 |
| **`benchmark`** (new) | §7.6 |
| Playwright `voice` | with the voice stub: final "I'm feeling really dizzy" gives a heard tag and the heard group first after any safety probes. Interim "a few hours" gives a dashed `? … carried from “dizzy”` preview and no answer. Final "a few hours" gives the carry tag and `v_vertigo` answered (published `onScreen.answers`). With the speaker on Physician, the final "for hours" neither carries nor consumes. Reset clears the heard group |

`tests/suites/index.json` gains `{"name":"carry","path":"carry.js","owner":"WP5"}` and
`{"name":"benchmark","path":"benchmark.js","owner":"WP13"}` after `extraction`.

### 7.3 `carry` suite (engine, module-agnostic and MASQUE)

- **Generic fixture lexicon:** built inline in the suite from the mutation base fixture's
  vocabulary (`p_two` scale with `carry: 2`, plus a second scale entry `p_three`-style with
  `yieldTo: ["p_two"]` and an anchor). This proves the engine has no module branch. On it:
  every rule of §3.3 and §4.3, each refusal code, expiry at exactly `carry` patient
  utterances, re-arm, two-heard clearing, the contained-span rule, the `?` guard,
  `includeSuppressed` yield reporting, and **purity**. Inputs are deep-frozen; calling twice gives
  deep-equal outputs; `pending` and `lexicon` are not mutated (`JSON.stringify` before and after).
- **MASQUE dialogues:** the `dialogues` of gold set 0.3.0 (§7.6), which include C1-C23 and C26,
  run through `extractInContext` with the 0.3.2 lexicon. Physician turns are skipped exactly as
  the Scribe skips them (they are not passed to the function). Expected captures and the
  pending id and `turnsLeft` are checked after every turn.
- **ingestCaptures:** a batch `[heard x, carried item x=2]` sets `x=2`. A batch `[heard x]`
  sets nothing and touches nothing. A carried capture for an id already answered leaves it.

### 7.4 `render-scribe` behaviour blocks (new app only)

Each block uses `bindModule` with the MASQUE rubric and an overridden `demo.transcript`, driven by
Step, plus typed input:

1. **heard:** pt "I'm feeling really dizzy". One `.sa-scribe-heardtag` with exactly
   `heard “dizzy” · episode duration: not stated`. `onScreen.answers` has no `v_vertigo`. The
   readout and coverage are unchanged from before the utterance. In Ask next, `[data-heard-prompt=v_vertigo]`
   comes after every `.prompt[data-probe]` of kind safety and before the first probe of any
   other kind. There is no `.prompt[data-suggestion=v_vertigo]`. The label count equals heard +
   suggestions.
2. **carry:** then pt "a few hours". A `captag` reads
   `+ episode duration: 5 min – 72 h · carried from “dizzy”`, `answers.v_vertigo === 2`, and the
   heard group is gone.
3. **physician turns:** transcript [pt dizzy, md "How long?", md "Minutes or hours?", pt "hours"]
   gives `v_vertigo === 2`.
4. **expiry:** [pt dizzy, pt "Bright lights bother me", pt "my ears ring", pt "for hours"]
   leaves no `v_vertigo` answer, and the heard prompt is **still shown**.
5. **Skip:** heard Skip hides the prompt and writes no answer, and a following "a few hours"
   does not carry. A new "I feel dizzy" shows the prompt again.
6. **Reset** clears the heard group, the transcript and the pending carry ("a few hours"
   after Reset does nothing).
7. **answered first:** answer `v_vertigo` via the heard block's 3rd option, then "a few hours".
   The answer stays 2 (no overwrite), with no carry tag.
8. **shape fixture** (no lexicon): no heard group, no error (existing block, extended).

### 7.5 Mutation fixtures (`tests/fixtures/mutations/safety.js`; base `p_two` is `scale[0]`)

| Code | Sev | Path | Build |
|---|---|---|---|
| V28 | E | `/lexicon/scale/0/carry` | `carry = 9` |
| V28 | E | `/lexicon/scale/0/carry` | `carry = 1; fallback = 0` |
| V28 | E | `/lexicon/scale/0/yieldTo/0` | `yieldTo = ["p_missing"]` |
| V28 | E | `/lexicon/scale/0/yieldTo/0` | `yieldTo = ["p_two"]` (self) |
| V28 | E | `/lexicon/scale/0/anchor` | `anchor = ["example anchor"]` without yieldTo |
| V29 | E | `/lexicon/scale/0/anchor/0` | `yieldTo = ["<a bool id of base>"]; anchor = ["Example Anchor"]` |
| V28 | W | `/lexicon/scale/0/yeildTo` | misspelt key |

### 7.6 Gold set 0.3.0 and the benchmark suite

**File:** `app/modules/masque/masque_extraction_goldset.json` (new; UTF-8, no BOM, LF).

- `_meta`: copied from v0.2.0, with `version: "0.3.0"`, and `revisionLog` gains
  `"0.3.0 — <k> authored utterances and <d> dialogues added for lexicon 0.3.2 (F2 carry, F3 vocabulary, F4 yield), approved by the clinical lead on <date>. The 44 v0.2.0 cases are unchanged. Same single author, no adjudication."`
  `provenance` and `labelling` are kept verbatim. They remain true.
- `cases`: the 44 v0.2.0 cases first, **deep-equal and in order**, then the new cases with ids
  `g01…` (yield), `v01…` (vocabulary), `p01…` (positional). Each new case may carry an optional
  `expectHeard: ["<id>"]`.
- `dialogues` (new array): `{dialogueId: "d01", register: "encounter", turns: [["pt","…"],["md","…"],…], expect: [[turnIndex, [[id, value, via?], …], pendingAfter: {id, turnsLeft} | null], …]}`.
- Minimum content: every F4 table row (§4.5) as a case. Every approved F3 phrase in ≥ 1
  positive case and ≥ 1 negated or third-party case. The 26 carry rows as dialogues. All gold
  text is **authored by us and approved by the lead** with the phrases. It is clinical-adjacent
  content and is not invented silently.

**`benchmark` suite** (browser port of `reference/MASQUE_v0.3.1/MASQUE_Extraction_Benchmark.mjs`,
the same scoring: id AND value must match; a value error counts as fp + fn; includeSuppressed for
the taxonomy; red flags identified by **membership in `module.redFlags`**, not by an id pattern):

1. **Port fidelity:** on the reference gold 0.2.0 (SHA-pinned in `extraction.js`) with
   `revertDelta(lex)`, reproduce the reference report exactly: micro tp 50, fp 0, fn 0; per-slice
   n = 39/5/36/8; the negation sweep row for window 14.
2. **Append-only gold:** SHA-256-pin the new file (constant in the suite). Its first 44 cases
   must deep-equal the reference cases.
3. **0.3.2 run:** P/R/F1 overall, by slice, by item and by error taxonomy, each with its
   denominator. The suite pins `EXPECTED_032 = {tp, fp, fn, byCause}` from the approved run. Any
   change is a FAIL, so a known gap stays visible as a pinned fn instead of a silent miss.
   **No regression:** every v0.2.0 labelled extraction is still a tp, and there is no new fp on
   the v0.2.0 cases.
4. **Dialogues:** `carry applied as labelled: x/d`, `refused as labelled: y/d`, with denominators.
   Pinned.
5. **Collision report:** for every delta phrase, the gold and demo texts it matches. Any match
   in a v0.2.0 case whose expectations then change is a FAIL.
6. The report text, with the header `lexicon 0.3.2 · <EXTRACTOR_KIND> · features <EXTRACTOR_FEATURES>`,
   `development set 0.3.0 · <n> utterances · <m> labelled`, and the AUTHORED / in-sample
   saturation caveats copied from the reference report's wording, goes into the suite notes and
   `window.__screenairBenchmark`. The implementer commits it as
   `app/modules/masque/EXTRACTION_BENCHMARK.txt`. Its numbers are **development figures, not
   validation** (CLAUDE.md "say what a number is").

### 7.7 Expected final state

All 23 suites (21 existing + `carry` + `benchmark`) PASS on the default seed, with no INVALID.
Every expected AD is observed (AD4, AD5 when exercised, AD6, AD13, AD14). MASQUE validates
with 0 errors and the unchanged warning list. The Playwright `voice` spec passes on the cloud
runner, and every page is healthy (`masqueReady`, clean console).

---

## 8. File-by-file change list and order of work

No file appears in two packages.

| WP | Files | Content |
|---|---|---|
| **E1 Extraction engine** | `app/src/engine/extraction.js`, `app/src/engine/vocab.js` | `extract` opts `heard` and `contextIds`; yield (§4.3); heard emission (§1.2); `carryValue`, `extractInContext`, `CARRY_MAX`, `EXTRACTOR_FEATURES`; `createExtractor().extractInContext`; `CAPTURE_KIND.HEARD`. Comments must stay module-agnostic |
| **E2 Scribe engine** | `app/src/engine/scribe.js` | `heardLabel`, `carryLabel`, `foldHeard`, `promoteHeard`, `askNextSections`; the `ingestCaptures` JSDoc line |
| **C Contract and validation** | `app/src/engine/contract.js`, `app/src/engine/validate.js`, `app/src/engine/derive.js` | typedef and `LEXICON_SCALE_KEYS`; §5.2 rules; `EDITABLE` anchors; item removal cleans `yieldTo` |
| **U Scribe app** | `app/src/apps/Scribe.jsx` | `pendingRef`, `answersRef`, `transcriptCountRef`; `heard` and `heardDismissed` state; `ingest`; preview; tags; heard group; ordering; Reset and module-change clearing; CSS in `SCRIBE_EXTRA_CSS`; the header comment |
| **R Editor** | `app/src/apps/RubricEditor.jsx` | §5.4 |
| **H Harness core and release** | `app/src/engine/policy.js` (APP_VERSION line only), `app/tests/harness/diff.js` (AD4 amend, AD13, AD14, error text), `app/tests/harness/lexicon-delta.js` (new), `app/tests/suites/index.json` | must land **atomically** with the APP_VERSION bump |
| **M Module data** (after lead approval only) | `app/modules/masque/masque.rubric.json` (lexicon 0.3.2, approved phrases appended, `carry`, `yieldTo`, `anchor`, `goldSet`, changelog), `app/modules/masque/masque_extraction_goldset.json` (new), `CHANGELOG.md`, `SOURCES.md`, `README.md`, `EXTRACTION_BENCHMARK.txt` (new, after T1 runs) | content moved and approved, never invented |
| **T1 Data-facing suites** | `app/tests/suites/values.js`, `app/tests/suites/extraction.js`, `app/tests/suites/carry.js` (new), `app/tests/suites/benchmark.js` (new) | §7.2, §7.3, §7.6 |
| **T2 UI suites** | `app/tests/suites/render-scribe.js`, `app/tests/playwright/specs/voice.mjs` (and `app/tests/playwright/voice-stub.js` only if it cannot already emit an interim then a final with the speaker set) | §7.2, §7.4 |
| **T3 Validator and editor suites** | `app/tests/fixtures/mutations/safety.js`, `app/tests/suites/editor.js` | §7.5, §7.2 |
| **D Docs** | `docs/refactor/03-design.md` (§4.9, §4.11, §5.4, §8.3 rows, §8.4 AD4/AD13/AD14, decisions table, superseding F6), `docs/refactor/04-module-authoring.md` (lexicon table rows for `carry`, `yieldTo`, `anchor`; the version-axes row for lexicon now includes "a carry, yield or anchor changes"), `docs/refactor/02-app-divergences.md` (AD13, AD14, AD4) | |

`hash.js`, `bind.js`, `probes.js`, `masque.logic.js`, `tests/harness/divergences.js`,
`tests/baseline/**` and `reference/**` are **not** changed.

**Order** (each step keeps every suite green):

0. **Lead review** of §4.4 (anchors, `carry: 2`) and Appendix A (each phrase), plus the gold
   cases written for them. This blocks M and the delta values in H only. Everything else can
   proceed on 0.3.1.
1. **E1 + C** in parallel. With the 0.3.1 lexicon, the defaults are byte-identical, so
   `extraction`, `values` and `validate` stay green.
2. **E2 + R** in parallel.
3. **U + T2 + the AD14 part of H**, together: the heard UI changes render text, so AD14 and the
   driver fix must land with it. The demo already produces a heard signal on 0.3.1.
4. **H release bump** (`policy.js` + `NEW_RELEASE`), atomically.
5. **M + the delta in H + T1 + T3**, together: the lexicon delta, the values and extraction AD13
   wiring, the new gold set and the benchmark pins. Run the benchmark, then commit
   `EXTRACTION_BENCHMARK.txt`.
6. **D.** Then a full run (default seed) plus the cloud Playwright run plus manual check (a) of
   §8.6, extended: say "I'm feeling really dizzy", then "a few hours".

---

## 9. Risks

- **R1. Saved and downloaded derivations of MASQUE 0.3.1 stop verifying.**
  `lineage.classifyLineage` row 3 compares the recorded root record's `lexiconVersion` and
  `lexiconHash` with the loaded built-in. After 0.3.2 these differ, so a derivation saved with
  "Remember", or a zip downloaded before the update, classifies as row 4 with the reason "This
  file was changed after it was created in screenAIr (root record lexiconVersion, root record
  lexiconHash does not match)". That text is **misleading**: the built-in changed, not the
  file. `checkVersionFamily` rule 3 (goldSet equal to the loaded root's) would also fail for
  such a module. For the prototype, the recommendation is to accept this and document it in
  CHANGELOG and README ("re-derive edits made before 0.4.1"). The alternative is a lineage
  "root updated" reason (out of scope; open question O6). No test fails, because the suites
  derive afresh.
- **R2. Release coupling.** APP_VERSION and AD4 `NEW_RELEASE` must move together (§6).
- **R3. Carry misattribution that cannot be fully excluded.**
  (a) Speaker mislabelling: a physician question spoken with the toggle on Patient ("does it
  last for hours") can supply a carry, as it can already set the item directly through
  per-utterance extraction today. The `?` guard helps only when the recogniser punctuates.
  (b) A patient answer in an unexpected frame ("the bus ride is a few hours") carries if
  nothing else in the lexicon matches.
  Mitigations: carry is opt-in per item and window-limited; the guard is the conservative
  other-entry rule; every carried value is visibly tagged "carried from “dizzy”" on the bubble
  that supplied it. Open questions O5 (a clear-answer affordance) and O11 (lexicon-level
  question cues) would narrow it further.
- **R4. Pre-existing per-utterance false positives remain.** The `v_vertigo` bands match
  durations of other symptoms in the same sentence ("I'm dizzy and my headache lasts all day" →
  `v_vertigo=2`). F4 fixes only the `m_dur` direction. A symmetric yield would need a
  `v_vertigo` anchor list. Flagged for the lead, not changed.
- **R5. The gold set stays in-sample and authored.** The new cases are written by us to probe the
  new rules, and the figures are development figures. The benchmark copies the reference report's
  saturation caveat.
- **R6. Heard noise.** Any cue without a band produces a heard prompt. This is by design (the
  approved F1). Cues embedded in another entry's phrase (`n_auto` "dizzy when i stand") show a
  heard tag but never arm carry.
- **R7. Forward compatibility.** An older app (0.4.0) loading a module whose lexicon has
  `yieldTo` or `carry` silently ignores them, so the old `m_dur` false positive returns there.
  The new V28 unknown-key **warning** helps only on new apps. The deployed site runs whatever is
  deployed, so this matters only for uploads across versions.
- **R8. The render-scribe driver change** (answer the same item on both sides) is required by the
  move semantics. It is safe because AD14 is exact, and because the state-forking alternative
  would hide real regressions.
- **R9. `tests/tools/extract-rubric.js` is stale.** It regenerates the 0.3.1 lexicon from the
  baseline. Re-running it would silently revert 0.3.2. Add a warning line to its output, or have
  it apply `LEXICON_DELTA` (owner: H; not required for green).
- **R10. Locale.** The `?` guard checks `?` and `¿`. Everything else is lexicon data, so a Spanish
  lexicon gets heard and carry by declaring `carry` and its own bands.

## 10. Open questions for the clinical lead

- **O1.** Appendix A: approve or strike each draft phrase. Should the band boundary phrases ("two
  days" for `v_vertigo`, "a few hours" for `m_dur`), which straddle the 72 h and 4 h cut-points,
  stay out, as drafted?
- **O2.** The F4 anchor list (§4.4). Should `m_dur.yieldTo` also include `v_aural` or other
  yes/no symptoms ("my ear rings and it lasts a couple of hours")?
- **O3.** Should `m_dur` get `carry` (for example after "my headaches last forever")? Drafted
  as no.
- **O4.** Should the encounter note record heard-but-unanswered items (for example
  "Mentioned, not characterised: episode duration (heard “dizzy”)")? Drafted as no for 0.4.1
  (the approved F1 covers the screen only).
- **O5.** Should a carried answer offer a one-click "clear" back to unanswered, given that the
  Scribe has no way to un-answer an item today?
- **O6.** Should derivations made before the lexicon update re-verify (a lineage "root updated"
  state), or should users re-derive (R1)?
- **O7.** Heard group position: after Safety and before Re-ask (drafted), or after Re-ask?
- **O8.** Is N = 2 right for `v_vertigo`, given that voice finals are counted per recogniser
  segment (§3.5)?
- **O9.** A third segment of the same breath falls outside the window. Is that acceptable, or
  should the window count speaker turns (it would need a turn boundary the recogniser does not
  give)?
- **O10.** `m_dur` cue gap: "my headaches last …" and "my attacks last …" capture nothing today.
  Approve any of the Appendix A `m_dur` cue drafts?
- **O11.** Should a lexicon-level, data-only `carryBlock: {cues: [...]}` list (for example
  interrogative openers) be added, to refuse carry from question-shaped utterances when there is
  no punctuation?

---

## Appendix A — F3 draft vocabulary (DRAFT: not approved, not to be committed)

All phrases are lowercase and appended to the end of their list, so no existing phrase moves.
Each needs ≥ 1 positive and ≥ 1 negated or third-party gold case if approved.

| # | Target (path) | Phrase | Origin | Risk noted | Lead |
|---|---|---|---|---|---|
| 1 | `v_vertigo` cue (`/lexicon/scale/1/cue`) | `unsteady` | problem report ("I feel unsteady") | non-vestibular unsteadiness (neuropathy, weakness). Heard-only unless a band is present | ☐ ☐ |
| 2 | 〃 | `on a boat` | module wording: rescue probe `pr_internal_vertigo` ("like still being on a boat") | low | ☐ ☐ |
| 3 | 〃 | `rocking` | same probe ("bobbing, rocking, or swaying") | "rocking chair" | ☐ ☐ |
| 4 | 〃 | `swaying` | same probe | low | ☐ ☐ |
| 5 | 〃 | `bobbing` | same probe | low | ☐ ☐ |
| 6 | 〃 | `world is moving` | problem report | low | ☐ ☐ |
| 7 | 〃 | `room is moving` | variant of 6 | low | ☐ ☐ |
| 8 | 〃 | `moving around me` | problem report | "people moving around me" (crowds: visual motion, not vertigo) | ☐ ☐ |
| 9 | 〃 | `spins` | lay variant ("everything spins"); `room spins` exists | low | ☐ ☐ |
| 10 | 〃 | `woozy` | lay term | presyncope or medication effect | ☐ ☐ |
| 11 | `v_head` ph (`/lexicon/bool/8/ph`) | `roll over` | problem report; `rolling over` exists | low | ☐ ☐ |
| 12 | 〃 | `lie back` / `lying back` | module wording: rescue probe `pr_positional` ("lying back") | low | ☐ ☐ |
| 13 | 〃 | `turn my head` | lay variant of `move my head` | low | ☐ ☐ |
| 14 | `m_dur` cue (`/lexicon/scale/2/cue`) | `headaches last` | gap found in F4 testing | low (names the headache) | ☐ ☐ |
| 15 | 〃 | `attacks last` | gap found in F4 testing | vertigo "attacks". Mitigated by F4 when a `v_vertigo` cue is present | ☐ ☐ |
| 16 | 〃 | `migraines last` | gap found in F4 testing | low | ☐ ☐ |
| 17 | 〃 | `last about` / `last around` / `last up to` | gap found in F4 testing | "the last about…" is rare. F4 yield applies | ☐ ☐ |

Considered and **not** drafted (recorded so they are not re-proposed): `lightheaded`
(presyncope, and it overlaps the `n_auto` phrase "lightheaded when i stand"), `faint`, `giddy`,
and the bare verb `last` ("last week", "last visit"). Band boundary phrases ("two days" for
`v_vertigo`, "a few hours" for `m_dur`) are not drafted because they straddle the instrument's
72 h and 4 h cut-points. That is a clinical decision (O1). No new `v_vertigo` band phrases are
needed for the reported follow-ups: "a few hours" and "about an hour" already match the existing
band phrases "hours" and "an hour". The failure was the same-utterance rule, which F2 addresses.
