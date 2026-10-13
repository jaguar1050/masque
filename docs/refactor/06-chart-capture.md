# 06 — Chart-text capture and clarification prompts (release 0.4.7): design note

**Prototype · not for clinical use.** This note records the design of screenAIr 0.4.7 as
implemented on branch `claude/release-0.4.7`, from 0.4.6 (`f57780b`). Apart from the clinical lead's
own words and decision, every cue list, trigger and qualifier was drafted by the team; the lead
decided each row of the sign-off list in `app/modules/masque/CHANGELOG.md` (release 0.4.7,
"SIGN-OFF") on 2026-10-12 and answered its Part D questions (§14). The sections before §14 describe
the design as built before the sign-off; §14 says what the sign-off changed, and where they differ
§14 decides (in particular, chart reading now reads spoken lines too, D9).

The decisions are CC1-CC53 in `03-design.md` (CC13-CC16: the fixes before review, §10; CC46-CC53: the
sign-off, §14). The
allowed differences and the deploy list are in `02-app-divergences.md` ("screenAIr 0.4.7"). The field reference is `04-module-authoring.md` §2.8 and
§7. The engine's own description is the header of `app/src/engine/extraction.js` ("Chart reading").
Where this note and the code differ, the code and its tests decide, and this note is corrected.

## 1. The request and the decisions

On 2026-10-11 the user, who is the project's clinical lead, asked for four things:

- the Scribe's "patient capture statement" as a large scrollable text box;
- chart text read fully: the lead's history and physical flagged pulsatile tinnitus "even though
  the chart says "not pulsatile"";
- endorsement verbiage ("e.g. endorses, reports, has, yes") and denial verbiage ("e.g. denies, no,
  lacks, doesn't have") that "properly triggers criteria";
- a section after the text that prompts the clinician to clarify unclear verbiage, for example "is
  the rhinorrhea clear or purulent?" for a generic "runny nose".

The lead then chose:

- **Red flags:** "Don't raise, no listing". A clear denial does not raise the flag.
- **Answers:** "Clickable answers (Recommended)". Each prompt shows the item's own options, and a
  click records the clinician's answer.
- **Wording:** "Draft, you sign off (Recommended)". The lead's examples are used verbatim, the rest
  is drafted (questions from the module's own wording), and the lead approves the full list before
  upload.

The full text is verbatim in `app/tests/harness/lexicon-delta-033.js` (`request`, `decisions`) and in
the CHANGELOG. The history and physical is `app/tests/dev/hp-example.txt`, and gold set 0.4.0 case
`k001`.

## 2. What was wrong (lexicon 0.3.2, release 0.4.6)

The engine read every typed or spoken line as one patient utterance with phrase matching built for
speech. On the lead's history and physical it gave 11 captures, and every capture's evidence was the
whole note:

| Failure | Mechanism | Example in the H&P |
|---|---|---|
| A denied red flag raised | Red flags were never negated (upstream fix02 rule 1). | "Tinnitus is not pulsatile" → `rf_pulsatile` |
| A denial in a list not read | Negation was a 14-character window before the phrase. | "Denies … purulent rhinorrhea, hyposmia/anosmia" → `x_purulent`, `x_anosmia` yes |
| Substring hits | No word-boundary rule. | "aura" in "aural fullness" → `m_aura`; "positional" in "non-positional" → `v_head`; "stress" in "distress" (hidden only by a nearby "no ") |
| A negation across sentences | The window crossed `.` and line ends. | "No nausea. Photophobia." → `m_photo` no |
| Exam findings read as symptoms | No sections. | "sensation normal to light touch" → `n_allo` |
| Mentions in list order | `firstHit` took the first phrase of the list, not the first in the text. | "Endorses vertigo for hours. Denies dizziness." → nothing |
| A duration from elsewhere | A heard entry's band phrases were taken from the whole utterance. | `v_vertigo` 2 from "minutes to hours" in another sentence |
| A one-line box | An `<input>`; a pasted note collapsed into one bubble, and Enter submitted. | — |
| A pasted note treated as speech | One utterance through the carry-over path. | A "?" in the note refused a carry. |

## 3. Chart reading (`lexicon.clauses`)

### 3.1 Principle

All new behaviour is **opt-in lexicon data and does nothing when absent** (CC2). It is the pattern
of release 0.4.1 (`heard`, `carry`, `yieldTo`, `normalize`): the engine owns the rules, the module
owns every word. Without `clauses`:

- the frozen baseline and the lexicons equivalent to 0.3.1 and 0.3.2 extract exactly as before
  (`extraction` block 1, strict);
- the `capture` default-off proofs hold;
- `firstHit`, `allHits`, `cueBefore`, `negatedNear` and `EXTRACTOR_KIND` are unchanged.

The new code is a chart reader built inside `scan` when the lexicon has `clauses` and the text is
typed chart text (`opts.chart`; review round 2, §12: a spoken or demo line never reads it), and the
families consult it instead of the window helpers. No id, item, flag or condition word appears in engine or
app code.

### 3.2 Segmentation

- **Lines and headers.** Lines are split on CRLF, CR or LF. A line that is a section word of
  `clauses.sections` (any case, optional trailing ":") opens that section kind; a word of the kind
  `read` (history, assessment, plan …, review round 1) is read normally and ends any section kind.
  Any other line ending in ":" with nothing after it, and an all-capitals line of at most four
  words, is a header. Inside an exam it is a sub-label and keeps the exam, whatever its case
  ("HEENT:", "Neuro:"); anywhere else it ends the section kind (review round 1; before it an
  all-capitals sub-label ended the exam, and a mixed-case header kept any kind).
- **Labels.** "Label: text" at a line start whose label is a section word sets that kind for that
  line and its wrapped continuation only (review round 1: "Allergies: NKDA" no longer silences the
  lines below it), and its ":" ends a clause; a `read` label ends the section kind. A label that
  names no section reads in the section kind with its text: "Photophobia: no" is the label denied,
  and "Label: ***" the label unfilled.
- **Wrapped lines.** A line continues the previous one when that line has no clause end and this
  one starts lower-case, is indented deeper, or follows a "," or "/". This keeps the H&P's
  "migratory otalgia/cervicalgia,\nautophony, …" and "in no acute\n  distress." whole.
- **Clauses** end at `.` `!` `?` or `;` followed by whitespace or the end (the existing
  `SENTENCE_END` rule, so "2.5" ends nothing), at a line end that is not a wrap, after a label, and
  before a `breaks` cue ("but", "however", " — " …). A "?" with no word before it in its clause ends
  nothing: chart shorthand "? aura" queries the words after it, which it hedges (review round 1). A
  clause never crosses a header.
- **Lists under a denying line** (review round 1). A line holding a `deny` cue, no affirm cue after
  it and no finding, that is a header ("Patient denies:", "Negative for:") or ends with the cue
  ("Denies"), heads a list. Its bullet and deeper-indented lines, and under a header its plain lines
  of at most four words with no cue and no `scopeEnd` word, read as if the denial opened them
  (§3.4 rule 3), until a blank line, a header or any other line.

### 3.3 Matching

Every whitespace character reads as a space, so a phrase split over a wrapped line matches. With
`wordStart: true`, phrases and the lexicon's own cues (negation, attribution, history) match only at
a word start: the character before them is not a letter or a digit. A cue that starts with neither,
such as "?", is unbounded. Phrases stay stems at their end ("light sensitiv"). The `clauses` cue
lists (affirm, deny, post, prefix, breaks, scopeEnd, hedge, placeholder, thirdParty) match as whole words,
`wordStart` or not: at a word start and at a word end, except on a side where the cue's own
character is no letter or digit (`"has "`, `"non-"`, `" negative"`, `"?"`). So the lead's "yes"
never reads at the start of "yesterday" (a fix before review, §10). A word-start rule cannot catch a
phrase at the start of a longer word ("aura" in "aural"), so a hit lying inside an occurrence of a
`mask` word is no hit.
Because "n't" no longer matches inside "wasn't", the delta appends four negating contractions as
cues (§6). A negation cue that holds another negation cue at its end is measured from that cue
(review round 1): "didn't" reaches back from its "n't", so every contraction keeps the window reach
"n't" had in 0.3.2 ("I didn't have any nausea." reads no). Lowercasing keeps every character's
length ("İ" stays as it is), so no offset shifts (review round 1). A **finding** is a hit of any
topic phrase (yes/no, context and multi-answer phrases, red-flag phrases, scale cues, clarification
triggers), to the end of its word.

### 3.4 Negation

For a phrase hit in clause C, the first rule that applies decides:

1. **Window.** A negation cue of the lexicon within its window before the hit, the window clipped
   to C's start. An `affirm` cue between that cue and the hit keeps the hit affirmed ("Endorses
   dizziness but denies nausea" also needs the break), and so does a `scopeEnd` word (review round
   1: "No relief, so nausea …").
2. **Prefix.** A `prefix` cue ending exactly at the hit is attribute negation. The mention is
   dropped, never recorded as a denial: "non-positional tinnitus" says nothing about positional
   dizziness.
3. **List scope.** A `deny` cue earlier in C (or heading C's list, §3.2) with no `affirm` cue
   between it and the hit. This is a list denial: "Denies visual/auditory auras, otorrhea, …,
   purulent rhinorrhea, hyposmia/anosmia, nasal obstruction." Since review round 1 it reaches the
   hit unless a `scopeEnd` word (with, so, now, until, is, are, was, were, to, from) lies between
   them or, when the hit is in a later list item (a `,` `;` `/` "and" or "or" between), after the hit
   in its own item. A hit it does not reach is **uncertain**: set aside, recorded neither yes nor no
   ("No interpreter available, so nausea, photophobia and tinnitus were not reviewed." records
   none of them).
4. **Post.** A `post` cue after the hit in C that closes its item (the clause end, punctuation, "and"
   or "or" after it), with only a ":", one other word ("Positional testing negative.") or a list of
   findings it closes ("Nausea, photophobia: negative.") between (review round 1; before it any post
   cue later in the item counted). An `affirm` cue governing the hit directly keeps a post cue from
   denying it, and an `affirm` cue later in C that names no finding takes the denial back: uncertain
   ("Pulsatile tinnitus previously denied, now endorsed.").

The lexicon's own negation cues stay window-only; only `deny` cues spread over a list. "fewer
than" stays window-only. Attribution (the lexicon's attribution cues plus `clauses.thirdParty`) and
history windows are clipped to the clause too. In typed chart text (`opts.chart`) the lexicon's
attribution cues listed in `clauses.chartIgnoreThirdParty` ("her ", "his ") do not gate when a
finding follows them: in a chart note they name the patient ("Her tinnitus is bilateral."). Before
any other word ("Her husband has tinnitus.") they gate as in speech, and relatives and every other
cue still gate (§10, §11).

### 3.5 Mentions in text order

- **Yes/no entries** collect every mention. Affirmed only → yes; denied only → no. A conflict (no
  capture, and a conflict card asks, §4) needs one finding said both ways: the same phrase of the
  entry, or two of its phrases whose spans overlap, affirmed in one mention and denied in another.
  Different phrases that disagree are different findings of the item, and the affirmed mention
  wins (n07: "It's not the weather … it's when I skip meals." records `m_trig` yes). For an item of
  `clauses.strictConflict` (the rule-out items) any affirmed and any denied mention is a conflict
  (§10).
- **Context, scale-cue and multi-answer entries** take the first mention, in text order, that is
  neither negated, uncertain nor gated; a gated one only when no ungated one is left. An uncertain
  mention of a yes/no entry is set aside like an attribute-negated one.
- **Heard entries** (`heard: true`) take band and `carryRefuse` phrases only from their cue's own
  clause. A band phrase elsewhere in the utterance gives no value but still withholds the entry, so
  no normal carry-over slot arms. This last rule was decided in the data stage: without it, voice
  dialogues d077, d092 and d093 carried the next reply in as the episode duration.

### 3.6 Sections, hedges and placeholders

- `skip` sections (allergies, medications) capture nothing.
- `family` sections attribute every capture to someone else, except a `thirdPartyExempt` entry
  (`m_fhx`).
- `exam` sections capture only `examItems` (MASQUE: `r_normal`, `x_objective`, whose own text names
  the exam or the imaging).
- A clause holding a `placeholder` cue (`***`, `___`) captures nothing.
- A clause holding a `hedge` cue ("reportedly", "possible", "?" …) records nothing. The item is left
  for a hedge card instead.

### 3.7 Red flags (`redFlagNegation`, the lead's decision)

With `redFlagNegation: true`, a red flag is raised only when at least one of its mentions is not
denied, and a denied flag is neither raised nor listed. Since review round 1 a mention is denied only
by a denial that governs the flag phrase directly (the lead's "clear denial"), narrowed in review
round 3 (§13) to exactly: a prefix; in its own list item, a window cue or a `deny` cue before it with
only plain words between (no `:`, finding, affirm cue, plus sign, `scopeEnd` or `complement` word);
a `deny` cue heading the list when the flag's later item (or an item carried from a line above) is
the bare flag phrase ("No vision loss, diplopia, facial droop, weakness, or slurred speech."); or a
closing `post` cue right after it (only findings between: "Pulsatile tinnitus denied."). A label
answer never enters the test. A list scope that does not reach the flag this way
("Migraine without aura, now with worst headache of her life."), a distant or unclosed post cue
("Reports pulsatile tinnitus with negative CTA head and neck."), and an uncertain reading never
lower a flag: before the round, the general rules hid such flags. Sections, hedges and placeholders never lower a flag: a hedged "possible pulsatile
tinnitus" still raises it. Without the switch red flags stay ungated, as upstream. The change
reverses upstream fix02 rule 1 and the reference label r02, which gold set 0.4.0 supersedes. The
Scribe's Safety strip copy, "Ambient capture can raise a flag but never clear one", stays true:
capture still never clears a flag once raised.

### 3.8 Evidence

Every capture's `evidence` is its clause's text, and `clause: {start, end}` (original offsets) is
added after the capture's other keys; the clause always holds the capture's `cueIndex`. Without
`clauses` the evidence stays the utterance, as the parity suites require.

### 3.9 Typed chart text

The Scribe calls `extractInContext(lexicon, text, pending, {chart: true})` and
`clarifyCues(lexicon, text, {chart: true})` for the box. The pending slot comes back exactly as it
went in: never consumed, refused, carried into or armed (CC6), and the `chartIgnoreThirdParty` cues
do not gate before a finding (CC13, CC21). `extract` takes the same option (gold set 0.4.0 reads its
chart cases with it). Voice and demo lines keep their path. The option is **not inert without
`clauses`**: it changes no capture of `extract` or `clarifyCues` there, but `extractInContext` with
it never carries, whatever the lexicon (stated in review round 1; the `capture` suite pins it on the
lexicon equivalent to 0.3.2).

## 4. Clarifications (`lexicon.clarify`)

**Data.** `clarify: [{id, ph, unless?, probe` or `item, ask?, source}]`. `ph` are the triggers and
`unless` the qualifiers that resolve the mention in the same clause. Each entry names exactly one
of `probe` or `item`. `ask: {text, source}` overrides the question (MASQUE: only the rhinorrhea
entry, with the lead's question). `source` is `lead`, `module` or `draft`.

**`clarifyCues(lexicon, text)`** (`extraction.js`) runs outside `extract` and `extractInContext`, so
no capture, slot, gold label or benchmark depends on it. It returns, in text order, cues
`{kind: "clarify", id, reason, probe | item, evidence, clause, cueIndex, cueText, against?}`:

| Reason | When | Target |
|---|---|---|
| `trigger` | The first hit of an entry's `ph`, in text order, that is not negated, not attributed or historical, not in a skip or family section and not in a placeholder clause (an exam section never gates a trigger), whose clause holds none of the entry's `unless` phrases | the entry's probe or item |
| `hedge` | An item mentioned only in hedged clauses and captured nowhere | the item, with the `clarify` entry for that item if there is one |
| `conflict` | A yes/no item in conflict (§3.5: one finding said both ways; any mixed mentions of a `strictConflict` item; `against` quotes the other mention) | the item |
| `placeholder` | The first placeholder, once | none; the question is `clauses.placeholderAsk.text` (lexicon data, never engine copy) |

Without `clauses`, triggers are read on structural clauses with the lexicon's negation window
clipped to the clause, and there are no hedge, conflict or placeholder cues.

**`clarifyPrompts(module, cues, state)`** (`scribe.js`) maps cues to cards:

- a probe card: the probe's kind tag, the question (`ask.text`, else the probe's `say`) and the
  probe's options verbatim;
- an item card: the question (`ask.text`, else the item's `ask`) and the item's options (Yes / No,
  or its scale labels);
- the placeholder note card.

It keeps one card per target (a probe with a `target` counts as that item, a rescue probe as the
item it rescues), in text order. It drops a probe card when the probe is answered. A rescue probe's
card is shown only while the probe is live as Ask next reads it (`liveProbes`, its `when`), so it
leaves once its item reads positive and never overwrites it (review round 1: the dizziness-kind card
overwrote a recorded `v_vertigo`). Any other probe's card is dropped when its target item is
answered or an option would write an answered item; its `when` is not read, because the text asked.
It drops an item card when the item is answered or skipped, and any card the clinician dismissed.

**Why not probes, captures or note lines.** Probe parity compares the probe id sequence with the
baseline, and the probe set axis stays 1.0.0. The `capture` scoring counts every non-heard capture as
a value. `golden` compares the note line by line. So clarifications reference probes and items
(their questions and options are the module's, verbatim) without being any of the three. An
answer given on a card is an ordinary probe or item answer, which the note, the bundle and the
EMR template print as before.

**MASQUE entries** (inventory CL-01 to CL-20; all triggers and qualifiers drafts): rhinorrhea →
`pr_purulence` (the lead's question), tinnitus quality → `pr_tinnitus_quality`, which ear →
`pr_laterality`, sudden vs gradual → `pr_sudden_drop`, audiogram → `pr_audiogram`, kind of
dizziness → `pr_internal_vertigo`, ear pain → item `n_otalgia`, smell → `pr_smell`, one-sided nose →
`pr_nasal_mass`, "HINTS negative" → `pr_head_impulse`, neck → `pr_neck`, viral onset → item `n_viral`.
CL-17 (allergies) has no target, and the CHANGELOG lists the rest that did not land.

## 5. The Ambient Scribe (`apps/Scribe.jsx`)

- **The box.** A `<textarea>` with the same `scribe-input` / `scribe-capture` test ids: 8 rows,
  `resize: vertical`, at least 200 px, at most 60vh, scrolling. Enter adds a line; Ctrl or Cmd+Enter
  captures (not while an IME is composing). The hint is only in the placeholder, the button's title
  and `aria-keyshortcuts`, so the encounter card gains no text node and parity holds. CSS is in
  `SCRIBE_EXTRA_CSS` (`sa-scribe-` prefix); patient bubbles keep line breaks (`pre-wrap`).
- **Clarify** (`data-testid="scribe-clarify"`, only with cards). Each card quotes the clause and
  shows its tag, the reason, the question, one button per answer and Skip.
  - Probe cards answer through `answerProbe`, so flags are only raised and the EMR "recorded by
    clinician via probe" label works unchanged.
  - Item cards answer through `answerPrompt`.
  - A card leaves once answered or skipped.
- **Never asked twice.** While a card is open, its probe leaves the Ask next rail, and its item (a
  rescue probe's: the item it re-asks) leaves the suggestions, the heard cards and the rail's other
  probes for that item (review round 1: a rule-out conflict card and its rule-out probe were both
  shown).
- **Assistive technology** (review round 1). An always-mounted, visually hidden status
  (`scribe-clarify-status`, "2 questions to clarify") announces the cards; the section is a region
  labelled "Clarify"; each card is a group named by its question; after an answer or Skip, focus
  moves to the card now in its place, or back to the box when none is left. The caption reads
  " · the text leaves these open; nothing is recorded until you answer" (it was wrong for hedge,
  conflict and placeholder cards).
- **Tags and copy.** Cards carry no `data-suggestion` or `data-heard`, are not transcript rows, and
  their bubble tags have their own class (`sa-scribe-clarifytag`), never a capture tag. The copy is
  generic and names no module ("Clarify", "Skip", the reason words). It was drafted by the team,
  listed in the CHANGELOG sign-off part C and approved by the clinical lead on 2026-10-12 (C1-C12).
- **Reset and unsaved work.** Reset clears the cards and the draft, and an uncaptured draft counts in
  `dirtySummary` ("text not yet captured").

## 6. Lexicon 0.3.3 and the sign-off

The data is `app/tests/harness/lexicon-delta-033.js`, the second link of the lexicon delta chain
after `lexicon-delta.js` (0.3.1 → 0.3.2, untouched). `extract-rubric.js` applies it to the 0.3.2
lexicon and proves it by `revertLexiconDelta`, and the whole chain by `revertLexiconChain`. Its
nine checks are listed in `SOURCES.md`. It holds:

- `clauses`: 268 phrase rows after review round 3 (8 the lead's, 260 drafts; `scopeEnd` and
  `sections.read` from review round 1, `clauses.redFlags` and the notation, treatment-failure, mask,
  hedge and placeholder rows from review round 2, `clauses.complement`, three breaks, "rather than"
  and "slurred speech" from review round 3) and the switches `wordStart`, `placeholderAsk`,
  `examItems` (empty since review round 2), `strictConflict` (drafts) and `redFlagNegation` (the
  lead's decision);
- `clarify`: 14 entries;
- four draft negation cues, `wasn't`, `weren't`, `aren't` and `hadn't`;
- the `goldSet` reference 0.4.0;
- one basis per row, switch, entry and appended negation cue (294 after review round 3);
- the change-log entry, which says DRAFT.

`signOff` is `null`. The sign-off works as the EMR sign-off of release 0.4.4 did: the lead approves
or strikes each row; struck rows leave the delta; the gold cases they affect are relabelled; the
rubric is regenerated; and `signOff` records the decision with its date. Only then is anything
uploaded.

## 7. Proofs

| Proof | Where | What it shows |
|---|---|---|
| Baseline parity | `extraction` block 1 (35,364 strict comparisons) | Generic engine + 0.3.1 data = baseline, with no allowed difference, on the chain-reverted lexicon. |
| Default off | `capture` | On the 0.3.1 and 0.3.2 equivalents: no clarify cue, no clause evidence, `opts.chart` changing no capture of `extract` (2,000 seeded utterances each); with a slot open, `opts.chart` never carries (pinned on the 0.3.2 equivalent). |
| 0.3.2 audit | `extraction` block 2, AD13 | Unchanged rules, now between the 0.3.1 and 0.3.2 equivalents. |
| 0.3.3 audit | `extraction` block 3, AD18 | 124,860 comparisons after review round 3 (119,934 without `opts.chart`, all identical since review round 2), every typed difference explained by the evidence rule (the clause must hold the capture's cue) and the stated per-id rules; a strict share must remain (1,766 of the first 4,000 with captures); 29 self-checks. |
| Spoken path | `extraction` block 4 (review round 2) | The frozen 0.4.6 engine on lexicon 0.3.2 against this engine on 0.3.3 without `opts.chart`: 18,342 extract comparisons and 220 dialogue steps, all identical. |
| Engine rules | `capture` block 1 | 145 neutral-fixture chart cases after review round 3 (5 against the same texts without `clauses`; both directions of each fix before review and of review rounds 1-3; each also read as speech) and 24 `clarifyCues` cases. |
| 0.3.2 regression | `capture` blocks 2 and 4 | Gold set 0.3.0, `EXPECTED_BENCHMARK` and the round 2-3 pins on the 0.3.2 equivalent: unchanged. |
| 0.3.3 snapshot | `capture` block 5, gold set 0.4.0 | 521 cases after review round 3 (259 chart, read with `opts.chart`), 93 dialogues: tp 466, fp 0, fn 0. No label is superseded (since review round 2) and no spoken output changes against 0.3.2. The lead's H&P checks pass. 40 round-2 and 68 round-3 texts with explicit expectations; the red-flag battery (181 phrases × 21 affirming and 17 denying templates). |
| Data exactness | `values`, the extractor | The shipped lexicon is exactly 0.3.1 plus both deltas (AD13, AD18); every 0.3.3 leaf is exempt from the provenance sweep by pointer and value. |
| UI | `render-scribe`, `shape` | Parity unchanged (AD4, AD5, AD6, AD15). The H&P pasted through the box gives the cards `clarifyPrompts` gives, never twice in Ask next, with Skip, flag, item and placeholder paths, the EMR template and Reset. The runny-nose card asks the lead's question with `pr_purulence`'s answers. Typed chart text arms no slot. A typed "Her tinnitus is bilateral." records `v_aural`; spoken, it records nothing. Review round 1: the rescue card is absent once the duration is recorded and leaves when a later line records it; a rule-out conflict card holds its probe off the rail; the section's region, groups, status and focus. |
| Validator | `validate` | 54 generators after review round 3, one per rule, and a valid control. |
| Editor | `editor` | The `clauses` and `clarify` lock rows: the reason wording, not editable, direct edits refused. |

## 8. Known risks, limits and follow-ups

- **Points for the lead** (CHANGELOG sign-off part D):
  - the conflict rule: one finding said both ways in different words records yes; the rule-out
    items stay strict;
  - a negative test reads as a denial only right before a cue that closes its item (`" negative"`,
    open question Q2, narrowed in review round 1);
  - red flags: only a denial that governs the flag phrase directly lowers one (the four conditions
    of §3.7, review round 3); some flags a clinician would read as denied are raised, and two kinds of
    affirmed flag are still lowered (a time limit after a governing denial, a bare later item of a
    denied list), listed in part D;
  - a mention a list denial does not reach is set aside, with no card;
  - lists under a denying line, and the exam's end at a `read` header only;
  - a list denial of "pulsatile tinnitus" also records `v_aural` no;
  - a plural relative ("sisters") no longer gates, since the `clauses` cues match whole words;
  - in typed chart text "her " and "his " name the patient only before a finding; "they get" still
    gates;
  - typed text never carries, for any module;
  - exam text needs a header;
  - a past-medical-history header is read normally (a `read` header);
  - a history cue after the phrase is not read;
  - a duration after `;` is not the cue's.
- **Not landed** (CHANGELOG part E): vocabulary for "aural fullness", "phonophobia", "imbalance",
  "sudden hearing loss" and family-history migraine, and the clarification rows without a target or
  a module question.
- **Gold set 0.4.0 pins** were taken from the team's run until the sign-off, and were re-taken from
  the run of 2026-10-12 after it (§14). Its chart labels are the team's, relabelled for the lead's
  decisions.
- **Lineage.** `lexiconHash` changes, so derivations saved on 0.4.6 no longer verify against the
  built-in module (re-derive).
- **Rubric Editor.** No control for `clauses` or `clarify`. They are kept byte for byte, locked and
  shown as read-only summary lines (CC16); since review round 1 the reason says each row is tagged
  with its source (lead, module or draft), never "approved" (CC27).
- **Playwright.** No cloud Playwright run was made in this release (no Node on this machine). No
  spec references `scribe-input`.

## 9. Files

Engine: `src/engine/extraction.js`, `scribe.js`, `vocab.js`, `validate.js`, `contract.js`,
`policy.js`, `derive.js`. App: `src/apps/Scribe.jsx`, `src/apps/RubricEditor.jsx`. Module data: `modules/masque/masque.rubric.json`
(generated) and its records. Tests (local-only): `tests/harness/lexicon-delta-033.js`, `diff.js`
(chain, AD18), `foundations.js`; `tests/tools/extract-rubric.js`;
`tests/fixtures/goldset/masque_extraction_goldset_0.4.0.json`; `tests/dev/hp-example.txt`; the
`extraction`, `capture`, `values`, `render-scribe`, `shape`, `editor` and `validate` suites;
`tests/fixtures/mutations/safety.js` and `index.js`. The table with each file's change is in
`02-app-divergences.md`. Review round 1 touched the same files (`derive.js`, `RubricEditor.jsx` and
`Scribe.jsx` among them); no new file.

## 10. Fixes before review (11 October 2026)

Four known problems of the first build were fixed before review; nothing else was re-tuned. The
decisions are CC13-CC16 in `03-design.md`, the records the CHANGELOG's "Four fixes before review".

| Fix | Problem | Change | New data (drafts) |
|---|---|---|---|
| Chart pronouns (CC13) | "Her tinnitus is bilateral." was read as someone else's tinnitus: the shipped attribution cue "her " gated it. | `opts.chart` (typed text; `extract`, `extractInContext`, `clarifyCues`): the cues of `clauses.chartIgnoreThirdParty` do not gate. Relatives and every other cue still do. Spoken lines unchanged. | `chartIgnoreThirdParty`: `"her "`, `"his "` (V28: cues of `lexicon.thirdParty.cues`) |
| Conflict rule (CC14) | Any affirmed and any denied mention of an item was a conflict, so n07 lost its `m_trig` yes. | A conflict needs one finding said both ways (same phrase, or overlapping phrase spans); different phrases that disagree record yes. The rule-out items keep the strict rule: a "yes" there lowers the index, so recording nothing and asking is the conservative choice. | `strictConflict`: `x_purulent`, `x_objective`, `x_lowfreq`, `x_anosmia` (V28: yes/no items of a negative domain) |
| Whole-word cues (CC15) | "yes" matched the start of "yesterday" and ended a list denial. | The `clauses` cue lists match as whole words; phrases and the lexicon's own gate cues unchanged. | none |
| Editor locks (CC16) | `clauses` and `clarify` had no lock row or display. | `LOCKS` rows ("approved lexicon configuration"), read-only summary lines in the Rubric Editor. | none |

Gold set 0.4.0 gains `k052`-`k065` (both directions of each engine fix on the shipped lexicon) and
loses the n07 supersede row; its chart cases are read with `opts.chart`. AD18 gains rule P for
`opts.chart` comparisons.

## 11. Review round 1 (11 October 2026)

The review of the release confirmed the problems below in the browser. Each is fixed at its root
cause, with tests in both directions; the decisions are CC17-CC28 in `03-design.md`, the records the
CHANGELOG's "Review round 1". The lead's history and physical gives exactly what it gave before the
round.

| Fix | Problem | Change | New data (drafts) |
|---|---|---|---|
| Red flags (CC17) | A denial of something else in the clause hid an affirmed flag ("Vertigo without hearing loss, with double vision …", "Reports pulsatile tinnitus with negative CTA …"), in chart and spoken lines. | Only a denial that governs the flag phrase directly lowers it (§3.7). | none |
| Lists under a denying line (CC18) | "Patient denies:" over bullets opened no scope: every listed symptom read yes. | The line heads a list; its items read as if the denial opened them (§3.2). | none |
| List scope (CC18) | A deny cue reached to the clause end: unreviewed items, and findings after "with" or a verb, read no. | `scopeEnd` words end a list denial; a mention it does not reach is set aside (§3.4 rule 3). | `scopeEnd`: with, so, now, until, is, are, was, were, to, from |
| Post cues (CC19) | Any post cue later in the item denied ("Photophobia: no change …", "… with negative MRI"), and only the last item of a list it closed. | A post cue must close the item right after the mention, and denies a list it closes (§3.4 rule 4). | none |
| Sections (CC20) | "HEENT:" ended an exam; an inline "Allergies: NKDA" silenced the note below it. | Exam sub-labels keep the exam; `read` headers end any section; an inline section label holds for its line (§3.2). | `sections.read` (17 headers) |
| Chart pronouns (CC21) | "Her husband has tinnitus." was recorded as the patient's. | The pronoun names the patient only before a finding (§3.4). | none |
| Contractions (CC22) | "I didn't have any nausea." read yes: "didn't" started outside the window; AD18 Wc excused it. | A negation cue holding another at its end is measured from it (§3.3); Wc narrowed; v025 and v042 leave the supersede table. | bases of the four appended cues |
| A leading "?" (CC23) | "? aura" recorded aura yes. | A "?" with no word before it in its clause hedges the words after it (§3.2). | none |
| Offsets (CC24) | "İ" shifted every later offset. | Length-keeping lowercase (§3.3). | none |
| The rescue card (CC25) | The dizziness-kind card stayed after `v_vertigo` was recorded and overwrote it; a conflict card and its probe were both shown. | Rescue cards only while live; one target with the rescued item; the rail holds probes for an open card's item (§4, §5). | none |
| Clarify for assistive technology and its caption (CC26) | No announcement of the first cards, unnamed cards, focus lost after an answer; a caption wrong for three card reasons. | Status, region, named groups, focus moves; new caption (§5). | wording C9-C11 (CHANGELOG part C) |
| Wording, records and tests (CC27, CC28) | Locks said "approved"; stale chart-case counts; `opts.chart` called inert; AD18 and the evidence checks accepted a clause without the cue. | Neutral lock wording; counts; §3.9; the clause must hold the `cueIndex`. | none |

Gold set 0.4.0 gains `k066`-`k122`; AD18's rule L reads `scopeEnd`, its sentences treat a leading
"?" as the engine does, its rule Wc is narrowed, and its evidence rule checks the clause.

## 12. Review round 2 (11 October 2026)

The second review's lead items. The lead's working choice stays "Draft, you sign off": the team
drafted a conservative default for each, every new phrase, cue and question is a draft row with a
basis ("(review round 2)" in the sign-off list), and nothing is uploaded before the lead signs off.
The decisions are CC29-CC35 in `03-design.md`; the records are the CHANGELOG's "Review round 2".

| Change | Problem | Default (engine rule or data) | New data (drafts) |
|---|---|---|---|
| Chart reading for typed chart text only (CC29) | The chart reader ran on every utterance, so spoken and demo lines lost red flags to a leading "no" and changed captures and carry-over against 0.4.6. | `scan` builds the reader only with `opts.chart`; `extractInContext` steps 2-7 are the 0.4.6 code again; the length-keeping lowercase is used for chart reading only. `extraction` block 4 compares with the frozen 0.4.6 engine; AD18 excuses typed chart text only. | none |
| Chart red flags (CC30) | The red-flag phrases were patient speech only, and clarify qualifiers ("left", "sudden", "pulsing", "bloody", …) silenced the safety cards exactly when the chart stated the dangerous answer. | `clauses.redFlags` read after `lexicon.redFlags[flag]` in chart text; a hit inside a longer hit of the same flag is part of it. The safety entries keep only qualifiers that are phrases of the flag or safe answers. | 111 phrases (every flag), the mask "hay fever"; qualifiers removed from five safety entries |
| Treatment failure (CC31) | "No improvement with antibiotics" read `r_abx` no. | A negation, deny, post or prefix cue inside a longer affirm or hedge cue is no cue. | 10 affirm cues ("no improvement" … "despite") |
| Notation and hedges (CC32) | "(-) aura", "Aura: (-)", "Nausea: denies", "Nausea - no" read yes; "Nausea: [ ]" read yes; "maybe" and "unsure" did not hedge. | Label answers: a cue right after a finding (a ":" or "-" between, or nothing before a sign) answers it; an affirm cue affirms, a deny cue opens no list; an affirm cue answering another label takes nothing back. | "(+)", "(-)" (deny and post), ": denies", " - no", "[ ]", "[]", "maybe", "unsure", "uncertain", "not sure", "might" |
| Report headers (CC33) | "ct showed", "lund-mackay", "audiogram showed" turned normal reports into positive rule-outs (H09). | Masked in chart text; clarification triggers and qualifiers are matched without the mask. | 5 masks; `cl_scan_report`, `cl_audiogram_report`; test names out of `cl_audiogram`'s qualifiers |
| Exam items (CC34) | One normal exam line recorded `r_normal`; an office exam answered `x_objective`. | `examItems` empty (V28 allows it); a lead question. | `examItems: []` |
| The template card (CC35) | The card asked a question it gave no way to answer (Skip only). | A notice: role `note`, the lexicon's text, one Dismiss control; the status counts notices apart. | the notice text (draft) |

**Held-out cases** (30 chart texts written before any engine run): the eight red flags they name are
all raised after round 2 (three were before), none the text denies is raised, and H01, H09, H18,
H23, H24 and H25 now read as the reviewers expected. The four implicit flags (`rf_asym`, `rf_new50`)
need context no phrase can read; the laterality card now asks where a side is stated.

**Proofs.**
- `extraction` block 4: the frozen 0.4.6 engine on lexicon 0.3.2 against this engine on 0.3.3
  without `opts.chart`. 17,399 extract comparisons and 220 dialogue steps, all identical.
- Block 3: every spoken comparison of lexicon 0.3.2 and 0.3.3 is identical (117,333). AD18 explains
  the 4,209 typed-chart differences, with the new rule C (chart red-flag phrases) and rule L widened
  to affirm cues anywhere.
- `capture`: block 1 reads every chart case also without `opts.chart` against the fixture without
  the chart block. Block 5 adds 40 round-2 chart texts with explicit expectations and a guard
  against the removed qualifiers.
- Gold set 0.4.0: `k123`-`k186`, six relabelled chart cases, and an empty supersede table.
- `render-scribe`: the notice.

**Open for the lead** (CHANGELOG part D):
- whether chart reading should reach spoken lines;
- whether a normal exam may answer `r_normal` or `x_objective`;
- the breadth of the chart red-flag phrases (each raises on any undenied mention; the flags' own
  conditions, such as age or side, are not checked);
- safety cards shown beside a raised flag;
- how treatment-failure cues and label answers read mixed chart forms.

## 13. Review round 3 (11 October 2026)

The third review's confirmed defects, each fixed at its root in the engine, with draft rows only where
a word list was needed. The decisions are CC36-CC45 in `03-design.md`; the records are the
CHANGELOG's "Review round 3", and Part D of its sign-off list now states exactly when a red flag is
lowered.

| Change | Problem | Engine rule | New data (drafts) |
|---|---|---|---|
| Signs between findings (CC36) | "(+) a (-) b": each sign answered the finding before it, so "(-) aura (+) nausea" read aura yes and all-negative sign lines raised flags. | A cue answers a label only when it closes the item; a spaced sign between two findings is the next finding's prefix. | none |
| Abbreviations (CC37) | "No assoc. nausea.", "Denies hx. of aura." read yes (0.4.6: no): the "." cut the clause. | A "." before a lower-case word ends nothing after a short or dotted token, in a capitalised clause that names no finding before it. | none |
| Red flags in later list items (CC38, CC39) | "No nausea, double vision reported." lowered `rf_focal`: a later item lowered a flag with any two words before and one after. | A later or carried item lowers a flag only as the bare flag phrase; a plus sign affirms; a label answer no longer enters the red-flag test. | "slurred speech" (`rf_focal`) |
| A denial of something else (CC40) | "No steroids given for sudden hearing loss." lowered `rf_ssnhl`. | No denial lowers a flag past a complement word, and no list denial reaches past one; breaks end the clause. | `clauses.complement` (for, in, about, after, since, on, none of); breaks "other than", "besides", "apart from" |
| Later list items for yes/no items (CC41) | "No dizziness, tinnitus in the right ear only." recorded `v_aural` no and hid the aural safety cards. | A later or carried item with any other word is uncertain (list denial or window); an uncertain trigger still asks. | none |
| Lists under a denial (CC42) | "+ night sweats" and a plain line after the bullets were read as denied items. | "+" lines and lines with an affirm cue end the list, so does a plain line after bullets; plain item lines never wrap. | none |
| Label answers against a denial (CC43) | "No nausea - reports good appetite." read yes; "Non-pulsatile tinnitus: yes." raised `rf_pulsatile`; "Headache: denies nausea, …" opened no list. | Closing label answers only (CC36); a label answer never overrides a prefix or a negation or deny cue in its own item. | none |
| Denied qualifiers (CC44) | "Tinnitus, not bilateral" silenced the laterality card. | A qualifier resolves a trigger only when undenied, for every entry. | deny "rather than" |
| The slash and a second label (CC45) | "visual/auditory auras" split into two items; "Nausea: no Photophobia: yes" read nausea yes, photophobia no. | "/" separates only next to a space or a finding; a second "Label:" on a line starts a clause. | none |

**The rule for a red flag**, after round 3 (sign-off part D lists it with its known lowering cases):
a flag phrase is lowered only by a prefix; in its own list item, a window or deny cue across plain
words; a deny cue heading the list when its later item is the bare flag phrase; or a closing post cue
right after it. The `capture` red-flag battery (181 phrases × 21 affirming and 17 denying templates)
tests every phrase both ways. Known lowering cases still open: a time limit after a governing denial
("No diplopia until this morning.") and a bare later item read as one more negative ("No nausea,
diplopia.").

**Held-out corpus 2** (the round-3 reviewers', 30 texts): denied flags not raised 36 of 37 (35
before), stated flags raised 9 of 11, strict expectations 18 of 21 (unchanged). The one denied flag
still raised comes from the ROS form "- fever", a lead item.

**Proofs.**
- `capture`: 35 new fixture cases, 68 round-3 MASQUE texts with explicit expectations (each also read
  as speech, identical to lexicon 0.3.2), the red-flag battery, and gold set 0.4.0 `k187`-`k259`
  with eleven relabelled chart cases.
- `extraction` block 4 still finds every spoken line identical to the frozen 0.4.6 engine (18,342
  comparisons, 220 dialogue steps), and block 3 explains every typed difference under AD18.
- `values` checks that the CHANGELOG quotes every rubric change-log entry verbatim.
- Against the round-2 engine, `capture` fails with 400 differences (the cap) and `render-scribe`
  with 9.

**Recorded for the lead, not fixed** (sign-off part D): chart denials still read as yes ("not
associated with", "not accompanied by", the ROS "- x", "neg for", "X: N"); chart red-flag recall (24
of 42 in a fresh battery; `rf_progressive` and `rf_asym` gaps); a spouse, partner or child is not a
third party in chart wording; chart wording sets the gap-rule markers (`c_dismiss`, `c_dur`); one hedge
word drops every finding of its clause; the `cl_otalgia` qualifier "deep"; "steady", "clicking" and
"progressive" silencing a safety card; rule-out qualifiers silencing a card when the text states the
positive answer.

## 14. The clinical lead's sign-off (12 October 2026)

On 2026-10-12 the clinical lead decided the 306 rows of the sign-off list (read from `cd34934`) on the
sign-off page: 278 approved, 18 struck, 10 the lead's own words or decision. The lead answered the 19
Part D questions, two follow-up questions on D8 and one on the struck mask "aural", and wrote "done,
re-rest and upload 0.4.7". The decisions are final and applied exactly (CC46-CC53;
`LEXICON_DELTA_033.signOff`; CHANGELOG, "Clinical-lead sign-off (2026-10-12)").

**Data (lexicon 0.3.3 as signed off).**
- Struck: the mask "aural" (kept struck after the lead was told the history and physical then
  states and denies aura) and 17 chart red-flag phrases (`rf_thunderclap` 2, `rf_focal` 2,
  `rf_vision` 3, `rf_gca` 3, `rf_orbital` 7).
- Every drafted row left is `lead-approved` (a source tag the validator accepts since the sign-off);
  its basis keeps the drafting record. No plain draft is left (`lexicon033SignOffProblems`).
- Added, lead-approved: the hedge "+/-" (D7); the deny cues "not associated with", "not accompanied
  by", "neg for"; `rf_progressive` "progressively worse", "progressively worsening", "worse each
  week"; `rf_asym` "left-sided hearing loss", "right-sided hearing loss", "asymmetric hearing loss"
  (D8).
- Removed qualifiers (D8): "deep" (`cl_otalgia`); "clicking", "steady" (`cl_tinnitus_quality`);
  "progressive" (`cl_hearing_onset`); the positive-answer qualifiers of the rule-out entries
  (`cl_rhinorrhea`, `cl_audiogram`, `cl_smell`, `cl_scan_report`, `cl_audiogram_report`).

**Engine.**
- **D9: chart reading for spoken and demo lines.** `scan` reads every line with chart reading under
  `clauses`; `opts.chart` marks typed chart text. A spoken line keeps carry-over exactly as before
  (`extractInContext` steps 2-7; a heard entry's band chosen by release 0.4.6's rule over the whole
  utterance; yield anchors with the window), every attribution cue (the pronoun exception is typed,
  D19), and no clarification (`clarifyCues` reads typed text only). A reply word, a deny cue opening
  its clause before a word starting no finding with no list separator before the next finding, lowers
  no red flag in a spoken line ("no it's more of a whooshing with my heartbeat" raises `rf_pulsatile`;
  "No, I've never had double vision." still lowers `rf_focal`). Typed chart text keeps D1's four
  conditions.
- **D8: no context marker from typed chart text.** No capture of kind ctx under chart reading with
  `opts.chart`; the clinician sets them (`includeSuppressed`: `chart-context`).
- **D7:** no rule: the hedge row "+/-" is read as any hedge cue.

**What the lead's decisions changed in the outputs.** Gold 0.4.0: ten chart labels relabelled (k001,
k004, k006, k037, k126, k166, k223 for the strikes; k035, k243 for D8's context markers; k162 for the
removed qualifiers), 14 chart cases added (k260-k273), and five spoken-register outputs superseded for
D9 (e16, r02, f02, t007, w019; no dialogue step). The lead's history and physical: `m_aura` is no longer
recorded (stated and denied: a conflict card, eleven cards); read as a spoken line it gives the typed
captures except `v_vertigo`, which keeps release 0.4.6's band choice (2, from "minutes to hours").

**Proofs.** `extraction` block 4 is the speech-mode audit (lexicon 0.3.2 vs 0.3.3 on spoken lines under
AD18; the dialogues' slot and carry results strictly equal; the 0.3.2 side equal to the frozen 0.4.6
engine) with 15 explicit speech red-flag tests. AD18 audits spoken comparisons (rules P and X stay
typed; X is new for D8), and its evidence rule lets a carried capture keep the whole reply. `capture`
reads each fixture chart case the other way too, with the register rules listed (`OTHER_READING`),
and nine spoken MASQUE lines with explicit expectations. `values` and the extractor check the sign-off
record is complete and applied.

**Known limits after the sign-off** (the lead did not pick them): a spouse, partner or child in chart
wording is not a third party; one hedge word drops every finding of its clause, in speech too. With
D9 a spoken report header ("my hearing test showed …") records nothing and no card asks, and the
reply-word rule keeps a flag raised after a denial with a word before the phrase, such as "no real double vision" (the safe side).
Decided after the final review (2026-10-12, in chat, before the upload; nothing changed): the
reply-word rule, until then the team's, is the lead's ("Don't lower (Recommended)": a spoken reply
opening with "no" lowers no red flag named later in it, at the cost that "no I haven't noticed any
slurred speech" also raises `rf_focal`); and row 281's (`cl_rhinorrhea`) eight drafted triggers and
its qualifiers left ("clear", "watery", "thin ") are lead-approved ("Approve all (Recommended)"), so
the rubric's change-log note holds (CHANGELOG, "Decided after the final review"). The records fixes of that review
changed records and comments only (CHANGELOG, "Verification (2026-10-12, after the records
fixes)").
