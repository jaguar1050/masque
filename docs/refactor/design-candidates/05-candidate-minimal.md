# 05 — Scribe capture fixes: candidate design, minimal-change lens

**Prototype · not for clinical use.** Design only: nothing in this document is implemented,
and no clinical content in it ships until the clinical lead has approved it (§4.4, §6.4).

Scope: F1 (the "heard" signal), F2 (carry-over), F4 (the `lasts` false positive), and the
mechanism that adds the F3 phrases and gold cases once they are approved. The lens is minimal
change. The design reuses the existing capture kinds, suggestion ranking, lexicon shape and
first-write-wins ingestion, adds **two optional lexicon fields** (`carry` and `yield`, both on
`lexicon.scale[i]`), adds **one pure engine function** (`extractInContext`) and **one capture
kind** (`"heard"`), and changes nothing for a lexicon that does not use the new fields.

Behaviour shown in this document was checked on 2026-10-04 against the committed engine
(`app/src/engine/extraction.js`) and rubric, using a throwaway browser prototype of the logic
specified in §3 and §4. The prototype was not committed. The "before" columns are the engine's
real output today.

---

## 0. The fault, restated

| # | Utterance(s) | Today | Cause |
|---|---|---|---|
| 1 | "I'm feeling really dizzy" | nothing | `v_vertigo` is a scale entry with `fallback: null`. Its cue matches, no band matches, and extraction.js L118 `continue`s with no signal. |
| 2 | "as if the world is moving around me and I'm sitting still" | nothing | No cue in the lexicon (an F3 matter). |
| 3 | follow-up "a few hours", "about an hour" | nothing | Extraction is per utterance, so a band phrase without a cue in the same line is ignored. |
| 4 | "I get dizzy and it lasts a couple of hours" | `v_vertigo=2`, **`m_dur=1`** | The `m_dur` cue `lasts` and its band `couple of hours` both match. No headache was mentioned. |
| 5 | "the room spins for a few seconds when I roll over" | `v_vertigo=1` only | The `v_head` phrase list has `rolling over` but not `roll over` (an F3 matter). |

The demo transcript already shows fault 1. Line 7 ("…really dizzy too — kind of spinning, it
comes and goes and lasts a while.") captures nothing today: `v_vertigo` has no band, and `m_dur`
(`lasts`) has no band.

---

## 1. Capture shape changes

### 1.1 Current shape (unchanged)

`extract()` returns `[{id, value, kind, evidence, cueIndex, suppressedBy?}]` with
`kind ∈ {"item", "ctx", "redflag"}` (`CAPTURE_KIND` in `engine/vocab.js`).

### 1.2 New kind `"heard"` (F1)

```js
// engine/vocab.js
export const CAPTURE_KIND = { ITEM: "item", CTX: "ctx", REDFLAG: "redflag", HEARD: "heard" };
```

A heard capture records that a scale entry's cue was heard, unnegated and not attributed or
historical, while no band phrase matched and the entry has no fallback:

```js
{ id: "v_vertigo", value: null, kind: "heard", evidence: "<the utterance>", cueIndex: 23, cue: "dizzy" }
```

- `value` is always `null`. A heard capture never carries a value.
- `cue` is the matched cue as the patient said it (`text.substr(cueIndex, phrase.length)`, in
  the original case). It exists only for display.
- A heard capture is emitted only when **both** of these hold:
  - the caller asked for heard captures (`opts.includeHeard === true`; `extractInContext`
    always asks);
  - the entry opts in with `Number.isInteger(entry.carry)` (§3.6).
  Without both, `extract()` output is byte-identical to today's.
- Gating is identical to an item capture (the same `gated()` helper). With `includeSuppressed`,
  a third-party or historical heard is returned with `suppressedBy`, like any other capture.

### 1.3 Carry-over results (F2)

A carry-over result is an ordinary item capture with provenance fields after the standard ones:

```js
{ id: "v_vertigo", value: 2, kind: "item", evidence: "a few hours", cueIndex: 6,
  via: "carry", from: { evidence: "I'm feeling really dizzy", cueIndex: 18, cue: "dizzy" } }
```

`cueIndex` is the position of the band phrase in **this** utterance. `from` is the earlier
utterance in which the cue was heard.

### 1.4 How `ingestCaptures` treats them (no code change)

`ingestCaptures` (engine/scribe.js L35-46) already filters by kind, so:

- **heard**: ignored by every branch. It never sets `answers`, `ctx` or `rf`, and is not in
  `touchedDomainItemIds`, so the domain bars do not pulse. Only the doc comment changes, adding
  a line: `heard: never an answer (absent stays absent); ignored here.`
- **carry**: `kind === "item"`, so it is folded exactly like a same-utterance capture. First
  write wins: an answer already on the record, or an earlier capture in the same batch, is not
  overwritten. The domain pulse fires.

No other consumer of captures exists. The transcript is not exported; the note, the bundle, the
cohort row and the score read `answers` only. So heard data cannot reach any output.

---

## 2. F1 user interface

### 2.1 Wording (engine-owned, generic)

`captureLabel(module, capture)` in `engine/scribe.js` gains two branches. The item, ctx and
redflag outputs are unchanged, and the `rules` suite keeps comparing them with the baseline
`capLabel`.

```js
// heard: "heard “dizzy” · episode duration not stated"
if (c.kind === CAPTURE_KIND.HEARD) {
  const it = module.itemById && module.itemById[c.id];
  return (c.cue ? `heard “${c.cue}” · ` : "heard · ") + (it ? itemShort(it) : c.id) + " not stated";
}
// item with via:"carry": the existing item label + " · follow-up to “dizzy”"
```

`kindOf()` returns `"heard"` for `c.kind === "heard"`. The engine supplies only the words
"heard", "not stated" and "follow-up to". The item name is the module's `short` label
(`episode duration` for `v_vertigo`), and the quoted word is the patient's own. No clinical term
is engine-owned.

### 2.2 Transcript bubble and interim preview (apps/Scribe.jsx)

- The transcript line keeps its caps as `{id, value, kind, cue?, via?, fromCue?}`. The first
  three keys are unchanged; `cue` is on heard captures and `via`/`fromCue` on carry captures.
- A heard capture renders as
  `<span className="captag sa-scribe-heardtag" data-heard={c.id} title={item.text}>{captureLabel}</span>`.
  It has no "+" prefix: it is not added to the record. A carry capture renders with the existing
  `+ ` prefix and its `captureLabel`, which already carries the follow-up suffix.
- **Interim preview.** `previewCaps` calls
  `extractor.extractInContext(interim, pendingRef.current).captures` and throws away the
  returned `pending`, so the preview mutates nothing. It renders heard and carry captures with
  the existing `captag pending` class and the "? " prefix. The preview therefore shows what a
  commit of those words would produce.
- New classes go in `SCRIBE_EXTRA_CSS`. `SCRIBE_CSS` is moved unedited and stays that way.
  ```css
  .sa-scribe-heardtag{background:#fff;border:1px dashed var(--amber);color:#7A4E12}
  .sa-scribe-heard{border-left:3px solid var(--amber)}
  ```

### 2.3 Promotion in "Ask next"

**Engine.** `rankSuggestions(module, {…, heard = []})` takes the heard item ids, most recent
first. The return type gains one key:

```js
// @returns {{list: Suggestion[], error, heard: Suggestion[]}}
//   heard  — one Suggestion per id in `heard` that is an item, unanswered and not skipped,
//            in the order given; kind "heard"; ask/tag/scale exactly as a scored suggestion.
//            Shown regardless of active domain or scorability (the patient raised it).
//   list   — unchanged ranking, computed over the pool MINUS the heard ids (so no duplicate,
//            and the list still backfills to infoPrompts.maxScored).
```

With `heard` empty (the default) `list` is identical to today's, so the `rules` suite comparison
with the baseline slice is unaffected.

**Order of the Ask-next view** (Scribe.jsx L756-816), most urgent first:

1. **Safety probes** (kind `safety`). They always come first; F1 never outranks a question that
   could surface a red flag.
2. **Heard: not stated** (new block, `data-testid="scribe-heard"`). One card per heard item.
3. **Re-ask (rescue) probes**, unchanged and never truncated.
4. Criteria, rule-out, supporting and exam probes, unchanged (still truncated to two).
5. Ranked suggestions (`list`).

The rendering splits `probeGroups` into the `safety` group(s) and the rest, inside the existing
`scribe-probes` wrapper: `{safetyGroups}{heardBlock}{otherGroups}`. When there are no probes the
heard block renders on its own before the suggestions. Splitting the groups changes no text when
nothing is heard, so the baseline parity snapshot does not move.

**Heard card**: the `.prompt sa-scribe-heard` markup with
`data-suggestion={id} data-heard={id}` and no inline `borderLeft`. It contains:

- group caption `Heard · not stated`;
- a `qtag` reading `{s.tag} · heard “{cue}” — not recorded until answered`;
- a `qq` of `s.ask` (module data);
- the item's scale buttons, or Yes/No, plus Skip, through the existing `answerPrompt` and
  `skipPrompt`. `answerPrompt` treats kind `"heard"` like a scored suggestion: it writes
  `answers` and `asked`.

The "Ask next (n)" count becomes `list.length + heard.length`. The empty-state message shows only
when both are empty.

### 2.4 Where heard state lives and when it clears

There is no new React state. `heardList` is derived:

```js
const heardList = useMemo(() => {            // newest first, one per item
  const seen = new Set(), out = [];
  for (let k = transcript.length - 1; k >= 0; k--)
    for (const c of transcript[k].caps)
      if (c.kind === CAPTURE_KIND.HEARD && !seen.has(c.id)) { seen.add(c.id); out.push({ id: c.id, cue: c.cue }); }
  return out;
}, [transcript]);
```

`rankSuggestions(module, {…, heard: heardList.map(h => h.id)})` then filters out answered and
skipped items. The heard promotion therefore clears:

- **as soon as the item is answered** by any route: a capture, a carry, a prompt button or a
  probe option that writes the item. The next render filters it out.
- **when it is skipped.** Skip hides the card and writes nothing, the same rule as any prompt.
  A later heard for a skipped item does not re-promote it (open question Q6).
- **on Reset.** The transcript is emptied, so `heardList` is empty.
- **on a module change.** The workspace remounts, and the transcript is per-instance.

The **bubble tag is permanent** for its line: it records what that utterance contained. It is not
a live status.

---

## 3. F2 carry-over: the algorithm

### 3.1 State

```js
// pending: null | { id: string, cue: string, evidence: string, cueIndex: number, turnsLeft: number }
```

There is a **single slot**: at most one item is pending. It lives in the Scribe as
`const pendingRef = useRef(null)`. It is a ref, not state, because it never renders by itself
(the heard tag and card are derived from the transcript), and voice callbacks reach the current
`ingest` through `ingestRef`.

### 3.2 Engine function (pure, in `engine/extraction.js`)

```js
/** Version string for the context rules; EXTRACTOR_KIND (per-utterance matcher) is unchanged. */
export const CONTEXT_EXTRACTOR_KIND = "same-item carry-over across following patient replies (lexicon scale carry); cue yield (lexicon scale yield)";

/**
 * One PATIENT utterance in the context of the item heard without its value in the preceding
 * patient replies. Pure: never mutates its inputs; returns new objects.
 * @param {Object} lexicon
 * @param {string} text
 * @param {null|{id, cue, evidence, cueIndex, turnsLeft}} pending
 * @param {{negationWindow?: number}} [opts]   includeSuppressed is not supported here
 * @returns {{captures: Object[], pending: (null|Object)}}
 */
export function extractInContext(lexicon, text, pending = null, opts = {})
```

`createExtractor(lexicon)` gains
`extractInContext: (text, pending, opts = {}) => extractInContext(lex, text, pending, opts)`.

`extract(lexicon, text, opts)` gains two options. Both are absent by default, and while absent
the per-utterance output is unchanged:

- `includeHeard: boolean` emits heard captures (§1.2);
- `assumeCued: string[]` lists scale ids that count as cued for the `yield` rule (§4). The caller
  passes the pending item, so a follow-up such as "it lasts a couple of hours" yields `m_dur` to
  the pending `v_vertigo`.

### 3.3 Steps (exact)

Let `E(id)` be the first scale entry with that id. Let `win = opts.negationWindow ??
lexicon.negation.window`.

0. **Guards.** If `lexicon` is not an object, or `text` is not a string, return
   `{captures: [], pending}`. If `!text.trim()`, return `{captures: [], pending}`: a blank voice
   final consumes nothing.
1. **Validate the pending slot.** `p = pending` only when it is an object, `E(p.id)` exists,
   `Number.isInteger(E(p.id).carry) && E(p.id).carry > 0`, and `Number.isInteger(p.turnsLeft)
   && p.turnsLeft > 0`. Otherwise `p = null`.
2. **Base captures.**
   `caps = extract(lexicon, text, {negationWindow: win, includeHeard: true, assumeCued: p ? [p.id] : []})`.
3. **Default next state.** `next = p ? {...p, turnsLeft: p.turnsLeft - 1} : null`. Every patient
   utterance consumes one reply.
4. **Carry**, only if `p`:
   1. **Answered here.** If `caps` contains an item capture (any family, including `multi`) with
      `id === p.id`, set `next = null` and do not carry.
   2. **Own cue present.** If any phrase of `E(p.id).cue` occurs in `text`, whether negated,
      attributed or historical, do not carry: the normal matcher already decided the line
      ("I'm not dizzy right now, but earlier for hours" carries nothing).
   3. **Misattribution guard.** Do not carry if any **other** scale entry `e` (`e.id !== p.id`)
      has a cue phrase occurring in `text`, negated or not. The one exception is an entry that
      *yields to the pending item in this utterance*: `e.yield.to` includes `p.id` and no
      `e.yield.unless` entry is cued. So "my headaches last all day" after "dizzy" is blocked by
      the `m_head` cue, while "it lasts a couple of hours" is not blocked by `m_dur`'s `lasts`,
      because `m_dur` yields to `v_vertigo`.
   4. **Band.** Take the first band of `E(p.id).bands` **in band order** (the significance of
      band order is preserved) that has at least one hit not negated within `win` characters
      before it (`allHits` filtered by `negatedNear`). Its first unnegated hit index is `i`.
      "not seconds, more like hours" skips band 1 (negated) and takes `hours` (5 min – 72 h).
   5. **Gate.** If a third-party cue or a historical cue is near `i` (the same windows as the
      matcher), do not carry ("it used to last a few minutes", "my mother gets it for hours
      too").
   6. **Emit.** Otherwise append
      `{id: p.id, value: band.v, kind: "item", evidence: text, cueIndex: i, via: "carry", from: {evidence: p.evidence, cueIndex: p.cueIndex, cue: p.cue}}`
      to `caps`, and set `next = null`.
5. **New or refreshed pending.** Let
   `H = caps.filter(c => c.kind === "heard" && E(c.id).carry > 0)`.
   - If `H.length === 1`, set
     `next = {id: H[0].id, cue: H[0].cue, evidence: text, cueIndex: H[0].cueIndex, turnsLeft: E(H[0].id).carry}`.
     This **supersedes** any older pending item, or **refreshes** the same one ("still dizzy").
   - If `H.length > 1`, set `next = null`. Two items are waiting for a value, so a bare band
     phrase would be ambiguous. Both still show heard tags and cards.
6. **Expiry.** If `next && next.turnsLeft <= 0`, set `next = null`.
7. **Return** `{captures: caps, pending: next}`. The order is extract's family order, with the
   carry capture last.

### 3.4 What the Scribe does (apps/Scribe.jsx `ingest`, ~L315)

```js
const pendingRef = useRef(null);
useEffect(() => { pendingRef.current = null; }, [module]);   // a new module starts clean

function ingest(role, text, src = "demo") {
  let caps = [];
  if (role === "pt" && extractor) {
    const prior = pendingRef.current && answers[pendingRef.current.id] === undefined ? pendingRef.current : null;
    const r = extractor.extractInContext(text, prior);
    caps = r.captures;
    pendingRef.current = r.pending && answers[r.pending.id] === undefined ? r.pending : null;
  }
  // …unchanged: pulse, setAnswers/setCtx/setRf through ingestCaptures…
  setTranscript(t => [...t, { id: t.length, role, text, src, caps: caps.map(toTag) }]);
}
// reset(): pendingRef.current = null;  (alongside the existing clears)
```

- **Physician turns** (`role === "md"`: demo lines, or the voice speaker toggle set to
  Physician) never call the extractor and leave `pendingRef` untouched, so they **do not
  consume** a reply.
- **Typed, demo and voice patient lines** all go through the same path. The capture rules stay
  identical for the three sources.
- `answers` in the closure is the latest render's (`ingestRef.current = ingest` every render).
  A second voice final that arrives before a re-render cannot see a carry from the first. It does
  not need to: step 4.6 has already cleared the slot.

### 3.5 Every edge case

| Case | Result |
|---|---|
| Physician turn between cue and answer | Not consumed (§3.4). |
| N = 2 patient replies without a band | Expires after the second ("dizzy" / "ok" / "fine" / "a few hours" → nothing). |
| Reset | `pendingRef.current = null`; transcript cleared. |
| Module change | Remount, plus the `[module]` effect sets the slot to null. |
| Item answered by prompt, probe or capture | The slot is dropped on the next ingest (`answers[id] !== undefined`). The heard card disappears at once (derived). |
| New cue-without-value for another item | Supersedes (single slot). |
| Same item heard again | `turnsLeft` refreshed to `carry`. |
| Two heard items in one utterance | Slot cleared (ambiguous); both cards shown. |
| Follow-up cues another scale entry ("my headaches last all day") | No carry (guard 4.3); `m_head` captured normally. |
| Follow-up cues another entry negated ("no headache, it lasts a few hours") | No carry: the guard ignores negation and is deliberately conservative. Unanswered is the safe direction. |
| Follow-up contains the pending item's own cue | No carry; the normal matcher decides (and may refresh the slot). |
| Band phrase negated | That band is skipped; a later unnegated band may match. |
| Band phrase attributed or historical | No carry. |
| Band phrase shared with another entry's bands (`half an hour` in both `v_vertigo` and `m_dur`) | Only the pending item can receive it, so it goes to the same item only. `m_dur` never receives a carry unless `m_dur` itself is pending. |
| Follow-up with a carry **and** a new heard | Cannot happen: a new heard means another scale entry is cued, so step 4.3 blocks the carry. |
| Lexicon with no `carry` fields (every other module, the shape fixture, the 0.3.1 lexicon) | Never a heard and never a pending slot, so `extractInContext(lex, t, null).captures` deep-equals `extract(lex, t)`. Proven in the `extraction` suite (§7.2). |
| Blank or whitespace voice final | Not consumed. |
| Third-party heard ("my mother gets dizzy") | Suppressed by `gated()`, so no heard and no slot. |
| Interim preview | Uses the slot read-only and never changes it. |

### 3.6 Who may carry: per-entry `carry` (module data), no global default

`lexicon.scale[i].carry` is an optional integer from 0 to 3 (`LEXICON_CARRY_MAX = 3` in
`engine/contract.js`):

- absent: no heard signal and no carry-over. This is today's behaviour, and the default for every
  existing module.
- `0`: heard signal only.
- `1` to `3`: heard signal, plus that many following patient replies may supply the value.

The engine has **no global default**, which is why every existing module is untouched. The field
is opt-in per entry because each entry is a clinical decision. `m_dur`'s cue (`lasts`,
`last for`, …) is a duration word, not a symptom, so a heard signal for it would mostly be noise.

**Proposed MASQUE configuration, for clinical-lead approval:**
`lexicon.scale[1]` (`v_vertigo`) `carry: 2`. No `carry` on `m_dur`, `m_head`, `i_days` or
`i_role`. The last three have fallbacks, so carry could never apply to them (validator warning,
§5.1).

### 3.7 Verified F2 behaviour (lexicon with `v_vertigo.carry = 2` and the §4 yield)

| Dialogue (pt unless marked) | Captures per turn | Slot after |
|---|---|---|
| "I'm feeling really dizzy" | heard “dizzy” | v_vertigo/2 |
| "as if the world is moving around me and I'm sitting still" | — | v_vertigo/1 |
| md: "How long does it last?" | (not extracted) | v_vertigo/1 |
| "a few hours" | **v_vertigo = 2 (5 min – 72 h), via carry from “dizzy”** | — |
| "I'm feeling really dizzy" → "about an hour" | heard → v_vertigo = 2 (carry) | — |
| "I'm feeling really dizzy" → "my headaches last all day" | heard → m_head = 1 only | v_vertigo/1 |
| "I get really dizzy" → "it lasts a couple of hours" | heard → v_vertigo = 2 (carry); no m_dur | — |
| "I get really dizzy" → "I have it most days" → "a few hours" | heard → i_days = 3 → v_vertigo = 2 (carry) | — |
| "I get really dizzy" → "not seconds, more like hours" | heard → v_vertigo = 2 (carry) | — |
| "I get really dizzy" → "it used to last a few minutes" | heard → — (historical) | v_vertigo/1 |
| "I get really dizzy" → "everything is spinning" → "ok" → "a few hours" | heard → heard “spinning” (refresh) → — → v_vertigo = 2 | — |
| "I get really dizzy" → "ok" → "fine" → "a few hours" | heard → — → — (expired) → — | — |
| "I get really dizzy" → "my mother gets it for hours too" | heard → — (third party) | v_vertigo/1 |
| "I get really dizzy" → "I'm not dizzy right now, but earlier for hours" | heard → — (own cue present) | v_vertigo/1 |
| "I get really dizzy" → "the headache lasts a couple of hours" | heard → m_head = 1, m_dur = 1 | v_vertigo/1 |
| "It lasts a couple of hours" (nothing pending) | m_dur = 1 (unchanged) | — |
| Demo line 7 ("…really dizzy too — kind of spinning… lasts a while.") | heard “dizzy”; no m_dur | v_vertigo/2, then /1 after line 8, then expired after line 9 |

---

## 4. F4: a generic "yield" rule

### 4.1 Options compared

| | Option | Configuration needed | Effect | New clinical content | Verdict |
|---|---|---|---|---|---|
| **A** | **`yield: {to: [ids], unless?: [ids]}`** on a scale entry: the entry captures nothing (no value, no heard) in an utterance where an entry in `to` is cued, unless an entry in `unless` is also cued. "Cued" means the matcher's own test: first cue hit, not negated. The pending item counts as cued (`assumeCued`). | `m_dur.yield = {to: ["v_vertigo"], unless: ["m_head"]}` | Narrow: only sentences where both cues co-occur, plus follow-ups while `v_vertigo` is pending. | **None.** It references existing entries' cue lists, so the lead approves a rule, not vocabulary. | **Recommended** |
| B | `requireAny: [phrases]`: the entry captures only if one of these context phrases is present. | A new phrase list for `m_dur` (headache, migraine, attack, …) | Broad: every bare "it lasts a couple of hours" stops scoring `m_dur`, including when headache was the previous turn's topic. A regression against today. | Yes (a new phrase list) | Rejected |
| C | Nearest-cue assignment: a band phrase shared by several cued entries goes to the nearest preceding cue. | An engine heuristic and a per-entry group | Order- and distance-dependent, hard to explain, and changes many synthetic outputs. | No, but it is a new mechanism | Rejected |
| D | Remove `lasts` from the `m_dur` cue list | Lexicon edit | Kills "Each attack lasts two days" (today `m_dur = 2`). | Removal of approved content | Rejected |

### 4.2 Recommended mechanism (exact)

In `extract()`, inside the scale loop, after the cue test (L114-115) and before the band
search:

```js
const scaleList = arr(lexicon.scale);
const assumed = new Set(arr(opts.assumeCued));
const cueAt = (e) => { const i = firstHit(text, arr(e.cue)); return i !== -1 && !negatedNear(text, i, win) ? i : -1; };
const cuedReal = (id) => scaleList.some(e => isObj(e) && e.id === id && cueAt(e) !== -1);
const yields = (ex) => isObj(ex.yield)
  && arr(ex.yield.to).some(id => assumed.has(id) || cuedReal(id))
  && !arr(ex.yield.unless).some(cuedReal);
// …
if (yields(ex)) {
  if (keep) { /* value computed as usual */ if (v !== null && v !== undefined) push({ id: ex.id, value: v, kind: "item", evidence: text, cueIndex: i, suppressedBy: "yield" }); }
  continue;   // neither an item nor a heard capture
}
```

- `unless` uses real cues only: the pending context never counts as a headache cue.
- Third-party and historical gating are not part of "cued", the same as the matcher's own cue
  test. So "my mother gets dizzy and it lasts…" still yields; that line is already suppressed by
  attribution.
- With no `yield` field on any entry, the code path is today's.

### 4.3 Exact MASQUE configuration for the clinical lead

```json
"scale": [
  { "id": "m_head", … },
  { "id": "v_vertigo", "cue": […], "bands": […], "fallback": null, "carry": 2 },
  { "id": "m_dur", "cue": ["lasts", "last for", "goes on for", "sticks around"], "bands": […], "fallback": null,
    "yield": { "to": ["v_vertigo"], "unless": ["m_head"] } },
  …
]
```

What the lead is approving, in clinical words:

1. "When a sentence talks about dizziness or vertigo and does not mention a headache or facial
   pain, a duration in it is not taken as a headache-attack duration."
2. "The same applies to a follow-up reply while a dizziness duration is still being waited for."
3. "When both a headache and dizziness are mentioned, both items are captured as today."

The `unless` cues are `m_head`'s existing cue list: `facial pressure`, `behind my eyes`,
`sinus headache`, `headache`, `facial pain`, `pressure in my face`.

### 4.4 Before/after (verified)

Per utterance, `extract()` with `includeHeard`; "heard" rows only for entries with `carry`.

| # | Sentence | Before (0.3.1) | After (0.3.2 config) | Note |
|---|---|---|---|---|
| 1 | I get dizzy and it lasts a couple of hours | v_vertigo=2, **m_dur=1** | v_vertigo=2 | **The false positive removed** |
| 2 | The room spins and it lasts the rest of the day | **m_dur=2** | heard “room spins” (v_vertigo) | False positive removed. The vertigo duration is unknown ("rest of the day" is not a v_vertigo band, an F3 candidate). |
| 3 | My headache lasts a couple of hours | m_head=1, m_dur=1 | m_head=1, m_dur=1 | Kept |
| 4 | Each attack lasts two days | m_dur=2 | m_dur=2 | Kept |
| 5 | I get dizzy with my headaches and they last for a couple of hours | m_head=1, v_vertigo=2, m_dur=1 | same | `unless` (headache cue) keeps both |
| 6 | I'm not dizzy, but my headache lasts all day | m_head=1, m_dur=2 | same | A negated vertigo cue does not trigger the yield |
| 7 | The spinning lasts about two hours each time. (gold e07) | v_vertigo=2 | v_vertigo=2 | Unchanged |
| 8 | The dizziness only lasts a few seconds, then it passes. (gold e08) | v_vertigo=1 | v_vertigo=1 | Unchanged |
| 9 | Vertigo episodes last for hours | v_vertigo=2 | v_vertigo=2 | Unchanged |
| 10 | It lasts a couple of hours (nothing pending) | m_dur=1 | m_dur=1 | Unchanged per utterance |
| 11 | It lasts a couple of hours (v_vertigo pending) | m_dur=1 (per-utterance today) | v_vertigo=2 (carry), no m_dur | Cross-turn yield |
| 12 | My migraines last for two days and I get dizzy with them | **m_dur=2** (correct) | heard “dizzy”; m_dur unanswered | **Recall cost**: "migraine" is not an `m_head` cue. Safe direction (unanswered, still asked). Q4. |
| 13 | My headaches last a couple of hours | m_head=1 | m_head=1 | m_dur is not captured before **or** after: `last` ≠ `lasts`/`last for`. A vocabulary gap (F3 draft). |
| 14 | My attacks last two days | — | — | Same gap; F4 neither breaks nor fixes it. |

All 44 v0.3.1 gold utterances give identical `extract()` output under the 0.3.2 configuration
without F3 phrases (checked).

---

## 5. Contract, validator, editor, hashes

### 5.1 Validator (`engine/validate.js`, `checkLexicon`, inside the existing scale loop; code V28)

| Path | Severity | Rule | Message |
|---|---|---|---|
| `/lexicon/scale/{i}/carry` | E | present ⇒ integer 0 ≤ carry ≤ `LEXICON_CARRY_MAX` | `carry must be an integer from 0 to 3 (0 = show "heard" only; 1–3 = also let that many following patient replies supply the value)` |
| `/lexicon/scale/{i}/carry` | W | present and `fallback !== null` | `"{id}" has a fallback, so its cue always sets a value: carry never applies` |
| `/lexicon/scale/{i}/yield` | E | present ⇒ plain object with keys ⊆ {to, unless} | `yield must be {to: [scale entry ids], unless?: [scale entry ids]}` |
| `/lexicon/scale/{i}/yield/to` | E | non-empty array | `yield.to must be a non-empty list of scale entry ids` |
| `/lexicon/scale/{i}/yield/unless` | E | absent or array | `yield.unless must be a list of scale entry ids` |
| `…/yield/(to\|unless)/{j}` | E | the id of another scale entry of this lexicon | `"{x}" is not the id of another scale entry in this lexicon` |
| `…/yield/(to\|unless)/{j}` | E | ≠ the entry's own id | `an entry cannot yield to itself` |
| `…/yield/(to\|unless)/{j}` | E | no duplicates within the list | `"{x}" is listed twice` |
| `/lexicon/scale/{i}/yield/unless/{j}` | E | not also in `to` | `"{x}" is also in yield.to` |
| `/lexicon/scale/{i}/yield/to/{j}` | E | no mutual yield (A→B and B→A) | `"{id}" and "{x}" yield to each other, so an utterance that cues both captures neither` |

The existing V-code is reused, so the "≥ 1 mutation per code V1-V60" rule needs no new code.
`lexiconPhrases()` is not extended: ids are not phrases, so V29 does not apply to them.

### 5.2 Contract (`engine/contract.js`)

- `export const LEXICON_CARRY_MAX = 3;`
- The `Lexicon` typedef's scale line gains
  `carry?: number, yield?: {to: string[], unless?: string[]}`, with one doc line each, as in
  §3.6 and §4.2.

`RUBRIC_KEYS` is unchanged (the change is not top level).

### 5.3 Rubric Editor (`apps/RubricEditor.jsx`) and model (`engine/derive.js`)

- **Round-trip.** The editor edits a cloned draft by path. `carry` and `yield` are not in
  `EDITABLE`, so they are already preserved byte-for-byte and are read-only.
- **Display.** In the "Scale items" card, under the entry's phrase lists, a read-only line:
  `heard signal on · carry-over {n} patient replies · yields to {to…} unless {unless…} is cued (read-only: clinical-lead-approved configuration)`.
  Each clause appears only when its field exists. The ids come from data.
- **LOCKS** (derive.js L225-262) gain:
  - `["/lexicon/scale/*/carry", "Carry-over is clinical-lead-approved configuration; not editable in the Rubric Editor."]`
  - `["/lexicon/scale/*/yield", "The yield rule is clinical-lead-approved configuration; not editable in the Rubric Editor."]`
- **Dangling references.** `deleteItem(rubric, id)` (derive.js L1081) also strips `id` from every
  other scale entry's `yield.to` and `yield.unless`. It drops `unless` when that list empties and
  `yield` when `to` empties. `itemDependents` lists such entries as
  `{path: "/lexicon/scale/{k}/yield", what: "a yield rule naming this item"}`. For MASQUE this
  never triggers, because `canDeleteItem` refuses items the logic reads.
- **Version.** A lexicon phrase edit already forces `<root>-local.<hash6>` and "not re-run". That
  is unchanged.

### 5.4 Hashes (`engine/hash.js`): no code change

`hashProjections.lexicon` hashes the lexicon minus `version`, `lang` and `goldSet`, so `carry`,
`yield` and appended phrases change MASQUE's **lexiconHash**, as they should.

- `instrumentHash` and `scoringHash` are unchanged, so `research.calibration.appliesTo.scoringHash`
  still matches and `calibrationGate(masque)` stays true.
- `rubricSha256` and `contentHash` change (see risk R1).

---

## 6. Versioning and change log

| Axis or constant | Before | After | Where |
|---|---|---|---|
| Release `APP_VERSION` | 0.4.0 | **0.4.1** | `app/src/engine/policy.js` L6 only. **Do not touch** the `SITE.ALLOW_JS_UPLOAD` line. |
| Instrument | 0.2 | 0.2 | No item, weight, scale factor or cut-point changes. |
| Lexicon | 0.3.1 | **0.3.2** | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | 1.0.0 | Unchanged |
| Gold set | 0.2.0 (lexicon 0.3.1) | **0.3.0 (lexicon 0.3.2)** | `lexicon.goldSet = {version: "0.3.0", lexiconVersion: "0.3.2", file: "masque_extraction_goldset_0.3.0.json"}` |
| `EXTRACTOR_KIND` | "rule-based / phrase-match with local negation" | **unchanged** | The per-utterance matcher is the same; the `extraction` suite still pins it against the baseline. |
| `CONTEXT_EXTRACTOR_KIND` | — | new (§3.2) | `engine/extraction.js`; quoted in the CHANGELOG benchmark block. |
| AD4 `NEW_RELEASE` | "0.4.0" | **"0.4.1"** | `app/tests/harness/diff.js` L25, and the AD4 `what` text. |

**Rubric `changelog`, appended entry** (draft; date and phrase list filled in at approval):

```json
{ "date": "<approval date>", "kind": "lexicon",
  "note": "Lexicon 0.3.1 → 0.3.2, approved by the clinical lead on <date>. v_vertigo carries over (carry 2): when its cue is heard without a duration the item stays unanswered and is shown as heard, and the next two patient replies may supply the duration — same item only. m_dur yields to v_vertigo unless an m_head cue is present, so a dizziness-duration sentence no longer scores the headache-attack duration. Approved phrases: <list, or 'none'>. Instrument 0.2 unchanged. Gold set 0.3.0 adds <n> utterances and <m> dialogues.",
  "paths": ["/lexicon/version", "/lexicon/scale/1/carry", "/lexicon/scale/2/yield", "/lexicon/goldSet", "<appended paths>"] }
```

**`app/modules/masque/CHANGELOG.md`**

- Version-axes table: Lexicon 0.3.2; Gold set 0.3.0 (lexicon 0.3.2).
- A new dated section quoting the entry above verbatim (the file's own rule).
- A "Benchmark (in-sample, authored, saturated)" block: micro P/R/F1 on 44 + n utterances,
  dialogue pass count, `CONTEXT_EXTRACTOR_KIND`. It states that these are development figures,
  not performance.
- A line: "Release screenAIr 0.4.1".

**`app/modules/masque/SOURCES.md`**

- The hand-written table gains rows for `lexicon.version` (0.3.2), `lexicon.scale[1].carry`,
  `lexicon.scale[2].yield`, and each appended phrase. Source:
  "clinical-lead approval <date>; listed in `app/tests/harness/divergences.js` `LEXICON_DELTA`;
  applied by `extract-rubric.js` after the baseline extraction".
- The `goldSet` row is updated (file in `app/tests/fixtures/goldset/`, SHA-256 pinned in
  `suites/extraction.js`).

**Docs**

- `docs/refactor/03-design.md` §8.4: a new AD13 row, and the AD4 row now reads 0.4.1.
- §8.3: the `extraction` and `render` rows name the AD13 reverted lexicon for parity.
- `docs/refactor/02-app-divergences.md`: AD13 and release 0.4.1.
- `docs/refactor/04-module-authoring.md` §2.8: `carry` and `yield` documented; §7: the new V28
  messages.

---

## 7. Tests

### 7.1 How the intentional divergence is recorded: AD13 (the harness-sanctioned route)

`harness/divergences.js` pins the baseline manifest and the fixed-src hunks. **Neither
`MANIFEST_SHA256`, `FIXED_SRC_SHA256` nor `HUNKS` changes.**

Per §8.7, "any difference not in §8.4 is a defect; widening requires a design change recorded
[in 03] and in 02-app-divergences". So the lexicon change is registered as **AD13**, with its
data in one place:

```js
// harness/divergences.js — NEW export, plain data (tests are exempt from t-ids)
export const LEXICON_DELTA = {
  from: "0.3.1", to: "0.3.2",
  approved: { by: "clinical lead", date: "<YYYY-MM-DD>" },
  // phrases appended at the END of an existing list (never inserted, reordered or removed);
  // paths are relative to the lexicon and use the baseline's positional indices
  appended: [
    // { path: "/scale/1/cue", id: "v_vertigo", phrases: ["…"], why: "F3" },   ← only approved phrases
  ],
  // keys added to (or changed on) existing objects
  fields: [
    { path: "/scale/1/carry", id: "v_vertigo", to: 2, why: "F2" },
    { path: "/scale/2/yield", id: "m_dur", to: { to: ["v_vertigo"], unless: ["m_head"] }, why: "F4" },
    { path: "/goldSet",
      from: { version: "0.2.0", lexiconVersion: "0.3.1", file: "masque_extraction_goldset.json" },
      to:   { version: "0.3.0", lexiconVersion: "0.3.2", file: "masque_extraction_goldset_0.3.0.json" }, why: "gold set re-run" },
  ],
};
```

```js
// harness/diff.js — NEW helper + AD13 entry (and allowedDifference's message → "AD1-AD13")
/** The 0.3.1-equivalent lexicon, or null unless `lex` shows EXACTLY the documented delta. */
export function revertLexicon(lex, delta) { /* clone; require version === delta.to; for each
  field: value at path deep-equals `to` (and the entry id matches) → restore `from` or delete;
  for each appended: list at path ends with exactly `phrases` → slice them off; any mismatch →
  null; finally version = delta.from */ }

{ id: "AD13", ready: true, owner: "values / extraction / render-scribe",
  what: "MASQUE lexicon 0.3.1 → 0.3.2: the clinical-lead-approved additions in divergences.js LEXICON_DELTA",
  // ctx.AD13 = LEXICON_DELTA
  appliesTo: (path, ctx) => !!(ctx && ctx.AD13) && (path === "/lexicon" || /\/versions\/lexicon$/.test(path)),
  normalise(a, b, ctx) {
    if (typeof a === "string" && typeof b === "string") return a === ctx.AD13.from && b === ctx.AD13.to ? [b, b] : [a, b];
    if (isObj(b)) { const r = revertLexicon(b, ctx.AD13); return r ? [a, r] : [a, b]; }
    return [a, b];
  },
  detector: () => true },   // the shipped lexicon always carries the delta
```

The normaliser is exact. It rewrites only the documented additions, and only when the new side
shows exactly the documented form. Anything else, such as an undocumented phrase or a changed
band, stays a difference and FAILS.

### 7.2 Suite changes

| Suite | Change |
|---|---|
| **values** | `/lexicon` diff and `/module/versions` diff get `{allow: ["AD13"], ctx: {AD13: LEXICON_DELTA}}`, with `h.expect("AD13", {precondition: true, observed})`. `HAND_WRITTEN` gains one RegExp per `LEXICON_DELTA` path (`^/rubric/lexicon<path>(/\d+)?$` for appended phrases and fields) plus `^/rubric/lexicon/version$`, with reason "approved lexicon change (AD13)". The provenance sweep therefore skips exactly the approved strings and nothing else. |
| **extraction** | (1) **Parity stays exact**: every baseline comparison uses `lex031 = revertLexicon(module.lexicon, LEXICON_DELTA)` (`need(lex031, …)` otherwise), and `createExtractor(lex031).lexiconVersion === "0.3.1"`. This proves the engine with 0.3.1 data equals the baseline, so the new code paths are inert when the fields are absent. (2) **No collateral**: over the same corpus (44 gold + demo + synthetic) × the same opts, `extract(module.lexicon, t, o)` must deep-equal `extract(lex031, t, o)` unless `ad13Touches(t)`: an appended phrase occurs in `t.toLowerCase()`, or an entry with `yield` has a cue phrase in `t` together with a cue phrase of one of its `to` entries. `h.expect("AD13", {precondition: some touch, observed: some difference})`. (3) **Gold additions**: per-utterance `[id, value]` pairs equal `expect`, and heard ids equal `expectHeard`. (4) **Dialogues**: `extractInContext` over the turns (md turns skipped, as the Scribe does) gives `expect` (final captures) and `expectPending` (the slot after each turn). (5) **Benchmark note**: micro P/R/F1 on 44 + n with the shipped lexicon; it must be 100 % in-sample, otherwise the misses are listed as diffs. (6) **Context invariants** over 2,000 seeded dialogues built from corpus utterances: inputs frozen and not mutated; a heard capture never has `kind:"item"` or a value; a carry capture's id equals the incoming pending id; no carry when another non-yielding scale cue occurs; `turnsLeft ≤ carry`; with `lex031`, every result has `pending === null` and captures deep-equal `extract(lex031, t)`. (7) The new gold file is SHA-256 pinned (`GOLDSET_ADDITIONS_SHA256`), and a mismatch is INVALID, like the reference pin. `EXTRACTOR_KIND` is still pinned to the baseline. |
| **render-scribe** | **Parity** mounts the baseline and `Scribe` with `module031 = bindModule({...module.rubric, lexicon: lex031}, module.logic, {origin: "builtin", classification: "builtin", key: "fixture:masque-0.3.1-lexicon", sources: module.sources})`. Same driver, same ALLOW (AD4, AD6, AD5), zero new normalisation. **Behaviour (new)**, on the shipped module: (a) typed "I'm feeling really dizzy" gives one `.sa-scribe-heardtag` reading `heard “dizzy” · episode duration not stated`; readout, coverage and published `answers` are unchanged; (b) Ask next has `[data-testid=scribe-heard] [data-heard=v_vertigo]` after every safety probe card and before the first rescue card (DOM order), and the count includes it; (c) a module copy whose `demo.transcript` is the four-turn dialogue of §3.7 (pt, pt, md, pt), stepped, gives `answers.v_vertigo === 2`, the tag `+ episode duration: 5 min – 72 h · follow-up to “dizzy”`, no heard card, and coverage > 0 (this also proves the physician turn is not consumed); (d) Skip on the heard card hides it and writes nothing; (e) answering it writes the answer and removes it; (f) Reset, then typed "a few hours", captures nothing; (g) "I get dizzy and it lasts a couple of hours" gives `v_vertigo` 2 and **no** attack-duration tag. The existing skip, sign and routing blocks run on the shipped module unchanged; the heard card carries `data-suggestion`, so their helpers still work. |
| **validate** | No suite code change. New entries in `tests/fixtures/mutations/safety.js`, each giving its code at its path: carry 9 → E `/lexicon/scale/0/carry`; carry 1 with a fallback → W; yield to an unknown id → E `/lexicon/scale/0/yield/to/0`; yield to itself; `unless` also in `to`; mutual yield (the mutation pushes a second scale entry); `yield: "x"`. MASQUE still validates with 0 errors and no new warning. |
| **editor** | (a) The MASQUE lexicon card shows the read-only carry/yield line. (b) `lockedPaths` reports the two new LOCK reasons. (c) A phrase edit and Apply give a derived lexicon whose `carry` and `yield` deep-equal the root's, with `0.3.2-local.<hash6>` and "not re-run". (d) `deleteItem` on an inline two-scale fixture strips the yield reference. |
| **rules, golden, sweep, probes, patient, shape, omissions, research\*, roundtrip, upload, cohort-gen, integrity** | No code change. `rankSuggestions`, `captureLabel` and `ingestCaptures` are unchanged for the inputs they test. The release string moves through AD4's updated `NEW_RELEASE`. `roundtrip` re-checks the new rubric (the new fields survive download, upload and hashing). |
| **static** | No change; it enforces the rules. Engine code and comments must name no item id and no "masque". The new tests directory goes under `tests/fixtures/`, so `KNOWN_ENTRIES` is untouched. |
| **foundations** (harness) | `ENGINE_EXPORTS['extraction.js']` adds `extractInContext` and `CONTEXT_EXTRACTOR_KIND`. |
| Playwright `voice` (cloud, optional) | `emitFinal("I'm feeling really dizzy")` gives the heard tag; `emitInterim("a few")` gives no write; `emitFinal("a few hours")` gives the carry tag and the answer. |
| `tests/index.html` manual checklist | Add (g): "Listen → 'I'm feeling really dizzy' → heard tag and Heard card → 'a few hours' → episode duration 5 min – 72 h, coverage rises." |

### 7.3 Gold-set 0.3.0 (the F3/F4 mechanism)

The file is `app/tests/fixtures/goldset/masque_extraction_goldset_0.3.0.json`. It is local-only
and never deployed. The 44 reference cases are included by reference, not copied:

```json
{ "_meta": { "name": "MASQUE extraction development set", "version": "0.3.0",
    "basedOn": { "file": "reference/MASQUE_v0.3.1/masque_extraction_goldset.json", "version": "0.2.0", "sha256": "e1d6573695e554e57dd44cfab3de6699dccc6518c42f2b28afa32d9ddcab6cb2" },
    "provenance": "AUTHORED — … approved by the clinical lead on <date>. Development figures, not validation.",
    "revisionLog": ["0.3.0 — adds F2/F3/F4 cases for lexicon 0.3.2; no 0.2.0 label changed."] },
  "cases": [ { "utteranceId": "g01", "register": "encounter", "text": "I get dizzy and it lasts a couple of hours", "expect": [["v_vertigo", 2]] },
             { "utteranceId": "g02", "register": "encounter", "text": "The room spins and it lasts the rest of the day", "expect": [], "expectHeard": ["v_vertigo"] } ],
  "dialogues": [ { "dialogueId": "d01", "register": "encounter",
      "turns": [["pt","I'm feeling really dizzy"],["pt","as if the world is moving around me and I'm sitting still"],["md","How long does it last?"],["pt","a few hours"]],
      "expect": [["v_vertigo", 2]], "expectPending": ["v_vertigo", "v_vertigo", null, null] } ] }
```

**F4 cases (draft)**: §4.4 rows 1 to 10, with their "after" labels.

**F2 dialogues (draft)**: every row of §3.7.

**F3 workflow**, per phrase:

1. **We draft.** The draft table is in §7.4.
2. **The lead marks approve or strike**, with a date. The decision is recorded in the rubric
   `changelog` note.
3. **Approved phrases are appended** to the end of the existing list. Each must be lowercase and
   at least 3 characters (V29). An approved phrase never goes into an earlier band than one it
   could collide with.
4. **Add it to `LEXICON_DELTA.appended`.** This is the single source the harness and the
   extractor tool read.
5. **Add at least one positive gold case**, plus a negated case for cue phrases, and a collision
   case where the phrase is a substring risk.
6. **Regenerate the rubric** with `extract-rubric.html`. It applies `LEXICON_DELTA` after the
   baseline extraction, so "regenerating reproduces the committed file byte for byte" stays true.
7. **Update the SHA pin** of the new gold file and re-run the harness.

### 7.4 F3 draft for the clinical lead

**DRAFT, not approved, not to be implemented.** Each row needs approve or strike.

| List (path) | Candidate phrases | Notes for the lead |
|---|---|---|
| v_vertigo cue (`/scale/1/cue`) | `unsteady`, `on a boat`, `rocking`, `swaying`, `world is moving`, `moving around me`, `lose my balance`, `losing my balance` | Cue additions alone never score. With no band, `fallback: null` means they only produce "heard" and open the carry slot. `on a boat`, `rocking` and `swaying` follow the module's own internal-vertigo rescue probe wording. **Excluded on purpose:** `lightheaded` (presyncope, and `n_auto` already uses it). Substring risk: "rocking chair". |
| v_vertigo band v=2 (`/scale/1/bands/2/ph`) | `rest of the day`, `a day or two`, `couple of days` | All fall within 5 min – 72 h. `a few days` is left out because it straddles 72 h. |
| v_vertigo band v=3 (`/scale/1/bands/1/ph`) | `for weeks`, `a week` | Over 72 h. |
| v_head (`/bool/8/ph`) | `roll over`, `turn over in bed` | Fault 5. `lie down` is excluded: it is an `m_disable` phrase. |
| m_dur cue (`/scale/2/cue`) | `headaches last`, `attacks last`, `migraines last` | Closes §4.4 rows 13 and 14. The `yield` rule still protects dizziness sentences. |

**Existing behaviour to flag (no change proposed):** "a few minutes" scores `v_vertigo = 2`
(5 min – 72 h) through the band phrase `minutes`, although a few minutes may be under the 5-minute
Bárány floor.

### 7.5 Expected final state

- All 21 suites PASS on the default seed.
- AD4, AD5, AD6 and AD13 are observed wherever their preconditions occur.
- No INVALID: `MANIFEST_SHA256`, the fixed-src pins and the reference gold pin are untouched, and
  the new gold pin matches.
- The cloud Playwright suites pass.
- The manual checklist, with the new step (g), is run once.

---

## 8. File-by-file change list (one owner per file)

| Pkg | Files | Description | Depends on |
|---|---|---|---|
| **P1 Extraction engine** | `app/src/engine/extraction.js` | `extract` opts `includeHeard` and `assumeCued`; the `yield` rule; heard capture with `cue`; `includeSuppressed` records `suppressedBy:"yield"`; `extractInContext`; `createExtractor().extractInContext`; `CONTEXT_EXTRACTOR_KIND`. No ids in code or comments. | — |
| **P2 Scribe engine** | `app/src/engine/scribe.js`, `app/src/engine/vocab.js` | `CAPTURE_KIND.HEARD`; `kindOf`/`captureLabel` heard and carry branches; `rankSuggestions` `heard` option and return key; `ingestCaptures` doc line. | — |
| **P3 Contract, validator, derive** | `app/src/engine/contract.js`, `app/src/engine/validate.js`, `app/src/engine/derive.js` | `LEXICON_CARRY_MAX`, typedef; V28 rules of §5.1; LOCKS; `deleteItem`/`itemDependents` yield stripping. | — |
| **P4 Scribe UI** | `app/src/apps/Scribe.jsx` | `pendingRef`, `ingest`, `reset`, preview; tags; `heardList`; heard block placement; count; CSS in `SCRIBE_EXTRA_CSS`; header comment. | P1, P2 (APIs fixed here) |
| **P5 Editor UI** | `app/src/apps/RubricEditor.jsx` | Read-only carry/yield line in the Scale items card. | P3 |
| **P6 Release** | `app/src/engine/policy.js` | `APP_VERSION = "0.4.1"` (that line only). | — |
| **P7 Module data** (after lead approval) | `app/modules/masque/masque.rubric.json` (regenerated), `app/modules/masque/CHANGELOG.md`, `app/modules/masque/SOURCES.md`, `app/tests/tools/extract-rubric.js` (imports `LEXICON_DELTA`, applies it, HAND goldSet 0.3.0 and the changelog entry), `app/tests/fixtures/goldset/masque_extraction_goldset_0.3.0.json` | The clinical content and its generator. | Approval; P8's `LEXICON_DELTA` values (agreed text in §4.3/§7.1) |
| **P8 Harness** | `app/tests/harness/divergences.js` (new export only), `app/tests/harness/diff.js` (AD13, `revertLexicon`, AD4 `NEW_RELEASE`, message), `app/tests/harness/foundations.js` (export list) | The sanctioned divergence record. | Approval (delta contents) |
| **P9a Extraction and values suites** | `app/tests/suites/extraction.js`, `app/tests/suites/values.js` | §7.2 rows. | P1, P7, P8 |
| **P9b Scribe render suite** | `app/tests/suites/render-scribe.js`, `app/tests/index.html` (checklist), `app/tests/playwright/specs/voice.mjs` (optional) | §7.2 rows. | P1, P2, P4, P7, P8 |
| **P9c Validate and editor suites** | `app/tests/fixtures/mutations/safety.js`, `app/tests/suites/editor.js` | §7.2 rows. | P3, P5 |
| **P10 Docs** | `docs/refactor/03-design.md` (§8.3, §8.4), `docs/refactor/02-app-divergences.md`, `docs/refactor/04-module-authoring.md` (§2.8, §7) | AD13, AD4 at 0.4.1, field reference. | — |

**Order of work**

1. **Approval round** (blocking P7/P8 contents only):
   - the F4 rule (§4.3);
   - `v_vertigo.carry = 2` and none elsewhere (§3.6);
   - the F1 wording (§2.1/§2.3);
   - the F3 table (§7.4, approve or strike per phrase).
2. **In parallel, against this spec**: P1, P2, P3, P6, P10. Then P4 and P5. They can start at
   once, because the signatures are fixed in §2, §3 and §5.
3. **P8 and P7** once the approved delta is known. P7 regenerates the rubric through the tool, so
   it must land with or after P8's `LEXICON_DELTA`.
4. **P9a, P9b, P9c.** They can be drafted early and finalised against P7.
5. **Full run** of `app/tests/` (default seed), the cloud Playwright run and the manual checklist.

If F3 approval lags, ship 0.3.2 with `appended: []` (F1/F2/F4 only) and make F3 lexicon 0.3.3
with gold set 0.3.1 later, through the same mechanism (Q8).

---

## 9. Risks and open questions

### Risks

- **R1. Saved derivations stop verifying.** Remembered (localStorage) or downloaded derivations
  of MASQUE made on 0.4.0 record the old root (`rubricSha256`, `lexiconHash`, `goldSet`). Against
  the 0.4.1 built-in they no longer verify. They load as unverified, and a goldSet mismatch is
  V53 when the root is supplied. This is inherent to any built-in update and should be stated in
  the CHANGELOG (Q9).
- **R2. Residual carry misattribution.** A bare duration answering another question within two
  patient replies is carried. For example, md "When did this start?" and pt "a few hours ago"
  give `v_vertigo = 2`. The carry tag makes it visible, but the Scribe has no direct edit for a
  captured answer (a baseline limitation), and first write wins. Option: a later lexicon field
  for post-phrase blockers such as "ago" (Q5).
- **R3. F4 recall cost.** A vertigo cue with a migraine-attack duration and no `m_head` cue
  leaves `m_dur` unanswered (§4.4 row 12). This is the safe direction; the item is still asked.
- **R4. Parity subject change.** The parity suites now prove "engine + reverted lexicon ==
  baseline" (exact), plus "revert(shipped) == baseline" (values), plus the no-collateral check.
  The change must be recorded in 03 §8.3/§8.4 and in 02, or reviewers will read it as widening.
- **R5. Band-order significance.** An appended band phrase can change a value where an earlier
  band now wins. The AD13 detector (appended phrase present) covers it in tests; the lead should
  see the collision cases.
- **R6. Speech fragments use up the window.** Voice finals such as "um" consume a reply, so two
  fragments expire the slot. Blank finals are ignored, but fillers are not.
- **R7. Cue additions make heard tags noisy.** F3 cue additions without bands produce heard tags
  and cards that never score. That is intended, but it is visual load.
- **R8. Interim preview can differ from the commit.** The preview can show a carry that the
  committed segment does not produce (the recogniser revises words).

### Open questions (for the lead or the orchestrator)

- **Q1.** Approve `m_dur.yield = {to: ["v_vertigo"], unless: ["m_head"]}`, including its
  cross-turn effect (§4.4 row 11)?
- **Q2.** Approve `v_vertigo.carry = 2`. Should `m_dur` get a heard signal (`carry: 0`), or carry
  at all? Recommendation: no.
- **Q3.** F1 wording: is `heard “dizzy” · episode duration not stated` and a card captioned
  "Heard · not stated" acceptable? `short` for `v_vertigo` is "episode duration".
- **Q4.** Should `unless` also accept a migraine mention? That needs either "migraine" as an
  `m_head` cue (changes `m_head` scoring, fallback 1) or phrase-valued `unless` (new clinical
  content).
- **Q5.** A blocker for "… ago" after a band phrase in carry-over (R2)?
- **Q6.** Should a new heard re-promote an item the clinician skipped? Design: no.
- **Q7.** Should the note mention heard-but-unstated items? Design: no; the note derives from
  answers only, and the incomplete-screen line already says unanswered items are not denials.
- **Q8.** Ship 0.3.2 without F3 if approval lags (F3 → 0.3.3)?
- **Q9.** Keep the 0.3.1 root record so pre-0.4.1 derivations still verify (R1), or accept the
  break and announce it?
- **Q10.** Gold additions live in `app/tests/fixtures/goldset/` (local-only, never deployed).
  Should they instead be published beside the module, as upstream published its gold set?
- **Q11.** Should `yield.to`/`unless` ever reference bool entries? Design: scale entries only.
