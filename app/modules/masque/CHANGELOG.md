# MASQUE module — change log

**Prototype · not for clinical use.**

The change log of the built-in screenAIr module "Dizziness and Sinusitis (MASQUE v1)" (module id `masque`).
The entries are the rubric's own `changelog` (`masque.rubric.json`), quoted verbatim, followed by
the header of `masque.logic.js`, which records how the logic was moved. When screenAIr derives an
edited module from this one, the edit is appended to that module's own `changelog`, never here.

## Version axes

| Axis | Value | Where |
|---|---|---|
| Instrument | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | 0.3.2 | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.3.0 (lexicon 0.3.2) | `masque.rubric.json` `lexicon.goldSet`; the file is `app/tests/fixtures/goldset/masque_extraction_goldset_0.3.0.json` (local-only, never deployed) |

The release (screenAIr's own) is `APP_VERSION` in `app/src/engine/policy.js`: 0.4.6 since
2026-10-10 (the clinical lead's answers on the EMR template's open items; see the 0.4.6 entry).
Before it: 0.4.5 (the clinical lead's referral rule for dizziness cases, decided from 2026-10-07
to 2026-10-10), 0.4.4 (2026-10-07, the record of the clinical lead's sign-off of the EMR template content),
0.4.3 (2026-10-06, the EMR Friendly Template), 0.4.2 earlier the same day and 0.4.1. Release 0.4.3
also carries the Patient `.txt` thin warning and engine round 3d, both made in separate sessions
on 2026-10-06 and integrated on 2026-10-07 (see the 0.4.3 entry). The label's "v1" is display
copy, not a version axis. None of 0.4.3, 0.4.4, 0.4.5 and 0.4.6 moves another axis.

## 2026-10-02

- **extraction** (`/`): Extracted from the frozen baseline (app/tests/baseline/src, MANIFEST.sha256) by app/tests/tools/extract-rubric.html; field-by-field sources in modules/masque/SOURCES.md. Instrument 0.2 unchanged: item ids, weights, scale factors, cut-points and wording are moved, not edited.
- **reconciliation** (`/redFlags`): Red flags take the canonical Screener wording (text, points, action). The Scribe's shortened copy and the Simulator's third variant are dropped; the Scribe's per-flag `ask` is kept as unread data (Q5, Q6).
- **reconciliation** (`/domains`): Item text is canonical from the Screener (byte-identical to the Scribe's). The Scribe's ASK map becomes `ask`, its shortLabel map becomes `short` (n_allo has none, so the id is shown as today, Q24), VMPATHI_TAG becomes `tag`, and the Patient's clinician line `c` becomes `patientClin`. The Simulator's item copy (no scale factors, linear scoring) is dropped.
- **reconciliation** (`/contextItems`, `/locales/en/contextItems`): Patient context options keep the Patient's own values and labels (1/2/3+, <6mo/6-12mo/>12mo, no/yes); they are not realigned to the clinician bins (Q8). The gap-rule signal values (3+, >12mo, yes) are identical in both vocabularies.
- **reconciliation** (`/locales/en/steps`, `/locales/es/steps`): The Patient ITEMS domain `label`/`clinical` fields (never read) are dropped; the patient step titles come from the Patient section titles (UI.sections).
- **reconciliation** (`/sampleCases`): The five Simulator scenarios are added as sample cases sim-empty, sim-partial, sim-high, sim-redflag and sim-ruleout (group "scenario", `why` kept as the button title, FULL_HIGH inlined, `step` dropped, no complaint) (Q3).
- **reconciliation** (`/research`): The research panel's PROJECTS.MASQUE entry moves to `research`, with the brand-named knobs (score alias, artifact key, ETL script, fairness axes) and the Simulator's demo cohorts as data. BREATHE and VOICED stay in the panel as panel-only projects.
- **note** (`/label`, `/copy/note/supportingFooter`): Open questions shipped with their stated defaults: the label is display-only (Q1); the Scribe note keeps "Instrument v0.3 candidates." verbatim (Q7).

## 2026-10-04

Release screenAIr 0.4.1. Lexicon 0.3.1 → 0.3.2 and gold set 0.2.0 → 0.3.0; instrument 0.2 and
probe set 1.0.0 unchanged. The delta is `app/tests/harness/lexicon-delta.js`, applied by
`extract-rubric.js` after the baseline extraction (design `docs/refactor/05-scribe-capture-fixes.md`).
Round 2 of the release (design 05 §12) follows an adversarial review of the first round. It adds
`v_vertigo.carryExclude` to the same lexicon 0.3.2, changes how the extractor reads durations, and
corrects the records below. No version axis moves; `lexiconHash` changes, so the gold set and the
benchmark are re-pinned. Round 3 (2026-10-05, design 05 §13) follows a verification of round 2: it
makes every round-2 rule removal-only (R9-R11) and corrects the records again. No version axis
moves and no lexicon content changes, so `lexiconHash` is unchanged; the change-log note below is
reworded, and the gold set and the benchmark are re-pinned once more. Round 3b (same date, design 05
§13.10) replaces one round-3 slot rule with the yield-only slot. It changes no version axis, no
lexicon content and not the change-log note below. Round 3c (same date, design 05 §13.11) makes
R11 removal-only and renews a yield-only window on each withheld line, after the final pre-deploy
review. It changes no version axis and no lexicon content; the change-log note below is reworded,
and the gold set and the benchmark are re-pinned.

- **lexicon** (`/lexicon/version`, `/lexicon/scale/1/heard`, `/lexicon/scale/1/carry`, `/lexicon/scale/1/carryExclude`, `/lexicon/scale/2/yieldTo`, `/lexicon/scale/2/anchor`, `/lexicon/carryRefuse`, `/lexicon/normalize`, `/lexicon/goldSet`, `/lexicon/scale/1/cue`, `/lexicon/scale/1/bands/0/ph`, `/lexicon/scale/1/bands/2/ph`, `/lexicon/scale/1/bands/1/ph`, `/lexicon/bool/8/ph`, `/lexicon/bool/6/ph`, `/lexicon/bool/7/ph`, `/lexicon/bool/19/ph`, `/lexicon/negation/cues`, `/lexicon/thirdParty/cues`): Lexicon 0.3.1 → 0.3.2, approved by the clinical lead on 2026-10-04. v_vertigo: heard signal on (heard) and carry-over 2 (carry): when its cue is heard with no duration phrase the item stays unanswered and is shown as heard, and the next two patient replies may supply the duration — same item only; refused when the reply names anything else the lexicon knows, contains the item's own cue, is a question, contains a carryRefuse phrase, or when any duration phrase in it is negated (a negation cue anywhere before it in the reply), its duration phrases disagree, or it is attributed or historical. v_vertigo carry exclusions (carryExclude; clinical-lead decision 2026-10-04, day ranges are same-sentence only): about a day, overnight, for a day or two, for a couple of days, for two days, for three days set the duration only in a sentence where a v_vertigo cue is said, not negated, attributed or historical (a sentence ends at . ! ? or ; followed by whitespace or the end of the text), never from a carried reply; elsewhere in the cue's own utterance, and in a reply, they never supply the duration but still count for the negation and disagreement tests, so an utterance or reply in which one of them disagrees with another duration phrase gives no duration, and one standing alone outside such a sentence is a stated duration that is withheld. In the cue's own utterance a heard entry takes a duration only when the duration phrases found there agree, none of them is negated and no carryRefuse phrase occurs (an onset is not a duration); a phrase inside a longer phrase does not count. A duration that is stated but withheld leaves the item heard, opens only a yield-only slot (it keeps the yieldTo suppression for the next replies and never carries a value), and turns an open slot of that item yield-only with its reply window renewed, so the clinician asks. m_dur yields to v_vertigo (yieldTo) unless an approved anchor phrase is present and not negated, so a dizziness-duration sentence no longer scores the headache-attack duration; the yield holds while the reply window of a heard v_vertigo cue is open, also after its heard card is answered or skipped (an answered or skipped item is never carried); anchors: headache, facial pressure, facial pain, pressure in my face, behind my eyes, migraine lasts, migraines last, head pain. carryRefuse: ago, since, started, began — confirmed by the clinical lead on 2026-10-04 (proposed by the team as a carry-over guard). In a heard entry's own utterance it withholds the duration and no carry-over opens from that utterance; in a carried reply it refuses the carry. It can only prevent a capture, never cause one: withholding a duration no longer arms carry-over, so no later reply can supply a value because of it (an utterance with no duration phrase arms carry-over as before). Text normalization (normalize): before matching, curly apostrophes are read as a straight apostrophe; for duration band phrases only (clinical-lead decision 2026-10-04, digits for durations only), the standalone whole numbers 0–20 and 30, 40 … 90 are read as English words, so typed digits never reach a cue, yes/no, context, multi-item or red-flag phrase or a negation, attribution or history window; every other number stays as digits. Phrases appended: /lexicon/scale/1/cue (v_vertigo cues): world is moving, world moving around, world's moving, world was moving, everything spins, everything spun, room spun, room is moving, everything is moving, like i'm on a boat, like i was on a boat, like i am on a boat, like being on a boat, rocking feeling, rocking sensation, swaying side to side, feel unsteady, unsteady on my feet, losing my balance, lose my balance, balance is off; /lexicon/scale/1/bands/0/ph (v_vertigo, Under 5 min): split second, a second or two, a couple minutes, under five minutes, less than five minutes, two minutes, three minutes, four minutes; /lexicon/scale/1/bands/2/ph (v_vertigo, 5 min – 72 h): half the day, half a day, about a day, all night, for a day or two, for a couple of days, for two days, for three days, overnight; /lexicon/scale/1/bands/1/ph (v_vertigo, Over 72 h): lasts more than three days, lasted more than three days, days at a time; /lexicon/bool/8/ph (v_head): roll over, rolled over, turning over, over in bed, when i turn my head, when i look up, when i lie back, lying back in, tip my head back, high shelf, bending over; /lexicon/bool/6/ph (v_motion): driving through a tunnel, drive through a tunnel, patterned, busy visual, dizzy riding in a car, sick riding in a car; /lexicon/bool/7/ph (v_aural): ears feel full, ears ring, roaring; /lexicon/bool/19/ph (v_migfeat): headache during the dizz, headaches during the dizz; /lexicon/negation/cues: fewer than; /lexicon/thirdParty/cues: my grandmother, my grandma, my aunt, my uncle, my friend. Drafts struck and known risks: listed in CHANGELOG.md. Instrument 0.2 and probe set 1.0.0 unchanged. Gold set 0.2.0 → 0.3.0: 218 utterances and 93 dialogues added; no 0.2.0 case or label changed.

### Clinical-lead decisions (2026-10-04)

| Decision | What it settles | Where it lands |
|---|---|---|
| D1-D4 (round 1) | F1 heard and F2 carry-over for `v_vertigo`, F4 yield for `m_dur` with its anchors, the approved vocabulary, the negation and third-party cue additions, `normalize` | lexicon 0.3.2 (`lexicon-delta.js`) |
| L1 | Day ranges are same-sentence only: "about a day", "overnight", "for a day or two", "for a couple of days", "for two days" and "for three days" set the `v_vertigo` duration only in the cue's own sentence, never as a carried reply. | `v_vertigo.carryExclude` (R3a); from round 3 the sentence scope in the cue's own utterance (R11) and the carried-reply tests (R10) |
| L2 | Digits for durations only: `normalize.numbers` spells digits for band phrase matching only. | the extractor (R4) |
| L3 | `carryRefuse` (`ago`, `since`, `started`, `began`) is confirmed by the clinical lead on 2026-10-04 (proposed by the team as a carry-over guard). | lexicon 0.3.2; from round 2 it also guards direct extraction for heard entries (R3b); from round 3 a duration it withholds opens no carry-over (R9) |
| Accepted risk | Typed "twenty-two minutes" reads Under 5 min (decision D3); in round 2 the lead also accepted "twenty-two/-three/-four minutes" and "thirty-two/-three/-four minutes". The rest of the family (to "ninety-four minutes", with or without the hyphen) follows from the same approved phrases and is recorded as accepted with them, **flagged** for the lead's explicit confirmation (round 3). | "Known risks" below |

Not decided by the lead: the gold set 0.3.0 case text, from all three rounds, was drafted by the
team and has not been reviewed by the clinical lead.

### Round 2: extractor rules (screenAIr 0.4.1)

Each rule has gold set 0.3.0 cases (ids in brackets). Six earlier 0.3.0 labels changed with the
rules; each says so in its note. Round 3 (below) replaces R1, R2, R3b and the collection rule of
R3a; where a round-2 statement here no longer holds, a bracketed note says so.

- **R1 Carry negation is clause-wide.** A carried reply is refused (`negated`) when a negation cue
  occurs anywhere in it before the duration, not only in the 14 characters before it. "It doesn't
  really last for hours" is no longer carried as 5 min – 72 h (d054-d058). Recall cost, in the safe
  direction: "not seconds, more like hours" is now refused too (d010 relabelled). [In round 2 only
  the negated span was dropped, so another duration in the reply could still be carried (review
  F2); since round 3 (R10) any negated span refuses the whole reply.]
- **R2 Band choice for heard entries.** In the cue's own sentence `v_vertigo` reads every band
  phrase, drops one that lies inside a longer one or is negated, and takes a value only when the
  rest agree; otherwise it stays heard and carry-over can arm. "It hit me in a split second and the
  spinning lasted for hours" no longer reads Under 5 min (t001-t007, d069). Entries without `heard`
  keep the first band in band order. [Since round 3 (R9) a negated span withholds the value instead
  of being dropped (review F2), and an utterance whose duration was withheld no longer arms
  carry-over (review F3); "sentence" meant the transcript line until R11 (review F4).]
- **R3a `carryExclude`.** The six day-range phrases of decision L1 never supply a carried value.
  "I'm feeling really dizzy" · "How long has this been going on?" · "For two days." leaves
  `v_vertigo` heard (d059-d065; d021, d039 and d041 relabelled). [In round 2 they were not collected
  in a reply at all, so "For two days at a time." was carried as Over 72 h (review F1); since round 3
  (R10) they count for the negation and disagreement tests, and that reply is refused.]
- **R3b Onset guard.** For a heard entry, a `carryRefuse` phrase anywhere in the cue's own sentence
  withholds every duration of that sentence: "The dizziness started about a day ago" stays heard
  (t008-t013, d070). Recall cost, in the safe direction: "since Monday, and it lasts hours" and the
  "ago" inside "Chicago" withhold the duration too. [This was not the safe direction in round 2:
  the withheld duration armed carry-over, so a later reply could supply a value, often a wrong one
  (review F3). It is since round 3 (R9 f): no carry-over opens from that utterance.]
- **R4 Digits for durations only (L2).** Digits are spelled for band phrases only. Every other
  phrase, and every negation, attribution and history window, runs on the text as typed (with
  apostrophes folded). "I've been dizzy for 10 days" no longer records 10+ affected days, "It
  happens 3 or 4 times a week" no longer records 3+ clinicians, and "My sister has had 2 or 3 of
  these dizzy spells for hours" stays attributed (t014-t029, d057, d068; u008 and u009 relabelled).
  Recall cost: a typed "5 episodes" no longer reaches "five episodes" (t019).
- **R5 Yield after the heard card.** When the heard card is answered or skipped, the Scribe keeps
  passing the open reply window to the extractor with carry-over turned off, so "it lasts a couple
  of hours" no longer scores `m_dur` (d072).

### Round 3: removal-only rules (screenAIr 0.4.1, 2026-10-05)

A verification of round 2 upheld 23 findings (design 05 §13.1). Its central finding: round 2 could
record false scored values that round 1 did not. The principle of round 3 is that every round-2
rule is removal-only: it may withhold a value, it never causes a different value to be recorded,
and withholding never opens a path for a later wrong value. The one disclosed exception was R11,
which implemented decision L1 as decided. [Round 3c withdrew the exception: R11 is now
removal-only too; see below.] Each rule has gold set 0.3.0 cases (w001-w016,
d073-d085). Four earlier 0.3.0 labels changed with the rules (t003, t005, d069, d070); each says so
in its note.

- **R9 Direct extraction for heard entries** (replaces R2 and R3b). In the cue's own utterance
  `v_vertigo` collects every duration phrase and takes a value only when none is negated, no
  `carryRefuse` phrase occurs and they agree. When a duration was stated but withheld, the item is
  heard and no carry-over opens from that utterance, so the clinician asks. [Round 3 also closed
  an open slot of the item, which removed `m_dur`'s yield. Since round 3b the slot becomes
  yield-only instead; see below.] "I get dizzy, I don't know, seconds or hours." no longer reads
  5 min – 72 h, and after "I've been dizzy since Monday, and it lasts hours." the reply "All
  week." is no longer carried as Over 72 h (w001-w004, d075, d076, d078, d079, d085). An utterance with no duration
  phrase ("I'm feeling really dizzy") arms carry-over as before (d084).
- **R10 Carry** (replaces R1 and the collection rule of R3a). A carried reply collects every
  duration phrase of the pending item, the `carryExclude` phrases included. Any negated phrase
  refuses the whole reply, and phrases that disagree refuse it as ambiguous; an excluded phrase
  still never supplies the value. "For two days at a time." and "A few seconds, I'm not sure, maybe
  hours." are refused (d073, d074, d083); "For two days, and each spell lasts about an hour." still
  carries 5 min – 72 h (d065).
- **R11 Sentence scope (L1).** In the cue's own utterance a `carryExclude` phrase counts only in the
  cue's sentence. A sentence ends at `.` `!` `?` or `;` followed by whitespace or the end of the
  text, so "2.5" ends none and "Dr. " ends one. "I'm dizzy. It's been going on for two days." is
  heard and arms carry-over instead of reading 5 min – 72 h (w005-w012, d077). Other duration
  phrases keep line scope. The disclosed exception, flagged for the lead: "I'm dizzy for a few
  seconds. It's been going on for two days." now reads Under 5 min, where round 2 withheld the
  value (w013). [Round 3 ignored an excluded phrase in another sentence entirely, and that let a
  false value through: "I get these dizzy spells. They last for two days at a time." read Over
  72 h. Since round 3c an excluded phrase outside a cue sentence never supplies the value but still
  counts for the negation and disagreement tests: w013 and that line are heard with no value, and
  "I'm dizzy. It's been going on for two days." opens only a yield-only slot; see below.]
- **Records (R12).** The `carryRefuse` wording, which said it "can only prevent a capture" while
  round 2 let the withheld duration arm carry-over, is true again and now says why. The gold
  revision log no longer claims that labels changed independently of the extractor (review F8).

### Round 3b: yield-only slots (screenAIr 0.4.1, 2026-10-05)

**What changed.** An utterance whose duration is withheld now opens a **yield-only** slot for its
item. "Withheld" means duration phrases were present but gave no value: one was negated, a
`carryRefuse` phrase occurred, or two values were stated. A yield-only slot keeps `m_dur` yielding
for the item's reply window but never carries a value. If the item's reply window was already
open, a withheld utterance turns it into a yield-only slot with the replies it has left. It no
longer closes the window. A later utterance that names the item with no duration at all opens a
normal window again (design 05 §13.10). [Since round 3c the converted slot gets its full window
back, and so does a yield-only slot on each later withheld line; see below.]

**Why.** Round 3 armed nothing on a withheld utterance and closed an open window. Either way the
item stopped counting as present for `m_dur`'s yield. The next reply then scored the
headache-attack duration from a dizziness sentence, the misattribution the yield exists to stop
and one round 2 prevented. So round 3 had opened a path for a later wrong value. Round 3b records
no value that round 3 does not record. Its only effect on the scored output is that it can stop
`m_dur` from being recorded where round 3 recorded it.

**Examples** (lexicon 0.3.2):
- "It hit me in a split second and the spinning lasted for hours" · "it lasts a couple of hours"
  → no `m_dur` and no `v_vertigo` value (heard on the first line). Round 3 scored `m_dur` Under
  4 h.
- "I've been dizzy since Monday, and it lasts hours." · "it lasts a couple of hours" → no `m_dur`.
  Round 3 scored `m_dur` Under 4 h.
- "I'm feeling really dizzy" · "I've been dizzy since Monday, and it lasts hours." · "All week." →
  nothing carried: the window became yield-only.
- Unchanged: "I'm feeling really dizzy" · "it lasts a couple of hours" → `v_vertigo` 5 min – 72 h
  carried, no `m_dur`. The reported conversation, "I'm feeling really dizzy" · "as if the world is
  moving around me and I'm sitting still" · "a few hours" → `v_vertigo` 5 min – 72 h carried.

**The change-log note above was reworded for round 3b.** It no longer says a withheld duration
"closes" an open slot: the slot becomes yield-only, so no carried value can follow, but `m_dur` keeps
yielding. Its dialogue count is now 90.

[Round 3b kept the converted slot's remaining count, so "I'm feeling really dizzy" · "I've been
dizzy since Monday, and it lasts hours." · "ok" · "it lasts a couple of hours" scored `m_dur`
Under 4 h (gold d089) where round 2 suppressed it. Round 3c renews the window; see below.]

### Round 3c: final pre-deploy corrections (screenAIr 0.4.1, 2026-10-05)

A final review before deployment found two ways the round-3 rules could still record a value that
round 2 did not, or open a path for one (design 05 §13.11). Both are fixed by removal only.

**R11 made removal-only.** A day-range phrase (`carryExclude`) supplies the duration only in a
cue sentence: a sentence in which a `v_vertigo` cue is said, not negated, attributed or historical.
Every such sentence counts, not only the one holding the cue phrase listed first. Outside a cue
sentence a day range never supplies the duration, but it still counts for the negation and
disagreement tests, and it is a stated duration, so the item is withheld and only a yield-only
slot opens. Round 3 ignored it entirely there. Two problems followed:
- "for two days" overlaps "days at a time" without containing it, so dropping it left the v 3
  phrase alone: "I get these dizzy spells. They last for two days at a time." read Over 72 h, the
  F1 misread in another form (reviews F-R11-OVER72, ENG-R11-1).
- Ignoring the day range armed carry-over, so "I'm dizzy. It's been going on for two days." ·
  "All week." carried Over 72 h. And because the cue's sentence came from the first-listed cue
  phrase found, "I had vertigo for two days. Now I'm just dizzy." also armed and carried "All
  week." as Over 72 h (ENG-R11-2).

**Yield-only window renewed.** A withheld line that turns the item's open window yield-only, or
finds it yield-only already, renews it with the full window of two replies. A yield-only window
never carries a value, so a longer one can only keep `m_dur` yielding longer (review
F-3B-REMAINING-COUNT, gold d089).

**Examples** (lexicon 0.3.2):
- "I get these dizzy spells. They last for two days at a time." → heard, no value (round 3: Over
  72 h). The same for "I get dizzy. It lasts for two days at a time." and "How long am I dizzy?
  For two days at a time." (w017-w019, d093).
- "I had vertigo for two days. Now I'm just dizzy." → 5 min – 72 h, as in round 2 (w020, d091).
- "I'm dizzy. It's been going on for two days." · "All week." → nothing carried (d092; round 3:
  Over 72 h).
- "I'm dizzy for a few seconds. It's been going on for two days." → heard, no value (w013; round
  3: Under 5 min, the exception it disclosed).
- "I'm feeling really dizzy" · "I've been dizzy since Monday, and it lasts hours." · "ok" · "it
  lasts a couple of hours" → no `m_dur` (d089; round 3b: Under 4 h).
- Recall cost: "I'm dizzy. It's been going on for two days." · "How long does each spell last?" ·
  "About an hour." → nothing carried; the clinician enters the duration (d077; round 3 carried
  5 min – 72 h).
- Unchanged: the reported conversation, "I'm feeling really dizzy" · "as if the world is moving
  around me and I'm sitting still" · "a few hours" → `v_vertigo` 5 min – 72 h carried.

With round 3c, R11 is removal-only like the other round-3 rules, so the disclosed exception of
round 3 is withdrawn: on this lexicon, whose only carry-over item is `v_vertigo`, the rules withhold
more than round 2 and keep `m_dur` yielding more often, and no case found records a value round 2
did not. (A module with two carry-over items needs one more check: a withheld line about the
second item leaves the first item's open window open. Recorded as a follow-up; not reachable
here. [Resolved in round 3d; see below.]) The change-log note above was reworded to match (the
day-range sentence, the renewed window and the gold set totals: 218 utterances and 93 dialogues).

### Round 3d: engine follow-up, no change for this module (2026-10-06; ships in screenAIr 0.4.3)

Round 3d was made on 2026-10-06 in a separate session, on top of release 0.4.1 (round 3c), and
is not part of 0.4.1 or 0.4.2. It ships in release 0.4.3 (integrated on 2026-10-07; see the 0.4.3
entry). The follow-up above is closed in the engine (design 05 §13.12). In a module with two carry-over
items, a line that names the second item with its duration withheld now ends the first item's open
window, unless that line also names the first item again with no duration, which re-opens its
window (follow-up F-3D-1, below). The second item's yield-only window replaces it, so the reply
after that line is carried into neither item. Where round 2 found no duration on such a line, it
ended the window too, by opening a normal window for the second item.

**Disclosed differences from round 3**, for such modules only. From the line after the withheld
one, round 3d no longer holds the first item's window where round 3 would, so every rule that reads
the open window can decide differently, and the effects can chain:
- An item that yields to the first item, and not to the second, stops yielding. Its own value can
  be recorded where round 3 suppressed it. Its cue heard with no duration can close the window,
  keep a third item's window from opening, or, if it has carry-over, open its own.
- An item that yields to such a third item then stops yielding too. Its value can be recorded
  where round 3 carried the reply into the third item.

Round 2 did the same where it found no duration on the withheld line. Where it took one, it kept
the first item's window, as round 3 does, and there these values are recorded by neither round.
Four related cases are recorded as follow-ups and not changed (design 05 §13.12, F-3D-1 to
F-3D-4). This note was corrected in review round 1 of the integration (2026-10-07), which found
the chained effect; it had named only the first.

This module has one carry-over item (`v_vertigo`), so none of this can occur here. Its output, the
gold set 0.3.0, the benchmark block below and both pins are unchanged. So are the change-log note,
the version axes and the lexicon content.

### Known risks

Accepted by the lead or disclosed. Each has an example and, where a case can express it, a gold
set 0.3.0 case labelled as the rule behaves.

| Risk | Example | Status | Gold |
|---|---|---|---|
| Spelled-out compound tens read Under 5 min | typed "twenty-two minutes" through "ninety-four minutes" (every ten from twenty to ninety with -two, -three or -four, with or without the hyphen, e.g. "forty-two minutes", "twenty two minutes") → `v_vertigo` Under 5 min, because they contain "two/three/four minutes"; typed digits ("42 minutes") are not affected | accepted by the lead for "twenty-two" (D3) and the twenty-/thirty- forms (round 2); the rest of the family follows from the approved phrases and is recorded as accepted with them, **flagged** for the lead's explicit confirmation | u013, t037-t039, w014-w016 |
| Day ranges read as illness duration | "I woke up with vertigo, it came on overnight" and "I've been dizzy for two days", each in one sentence → 5 min – 72 h; the pre-existing "for days", "several days" and "all week" can still be carried as replies ("All week." → Over 72 h) | mitigated by R3a, R3b and R9-R11; residual as listed | t010, t011, w010, d024, d066 |
| Another symptom's duration in the same sentence read as the vertigo duration | "My migraines last for two days and I get dizzy with them" → `v_vertigo` 5 min – 72 h, from the migraine's duration | disclosed | y014 |
| An unrelated negation or hedge refuses a carried reply | "It comes on without warning and lasts for hours", "I can't remember exactly, maybe a few hours" and "no it usually lasts for hours" as replies → refused (`negated`); `v_vertigo` stays heard and is asked | recall cost of R1/R10, no false value | d080-d082 |
| Stated but ambiguous durations leave the item for the clinician | "The dizziness is never under five minutes, it lasts hours", "I've been dizzy since Monday, and it lasts hours", "I'm dizzy for two days at a time", "It's not a few seconds, the dizziness lasts hours", "I'm dizzy for a few seconds, not hours" → heard, no value and no carry-over; since round 3b `m_dur` keeps yielding for the reply window; as a reply, "A few hours, not for two days." is refused | recall cost of R9 and R10, no false value | t003, t005, t012, w001-w003, d075, d076, d078, d079, d083 |
| A day range in another sentence leaves the item for the clinician | "I'm dizzy. It's been going on for two days." → heard, no value, and only a yield-only window, so a following "About an hour." is not carried; "I'm dizzy for a few seconds. It's been going on for two days." → heard, no value (round 3: Under 5 min) | recall cost of R11 as corrected in round 3c (design 05 §13.11), no false value | w005-w009, w013, w017-w019, d077, d092, d093 |
| A refused carried reply uses up one reply but keeps the rest of the window | "I'm feeling really dizzy" · "For two days at a time." · "a few hours" → the second line is refused (ambiguous), then 5 min – 72 h is carried from the third. Round 1 did the same. | as designed (design 05 §3.5, §13.10) | d073 (first two lines); capture suite `refused-reply-keeps-the-rest-of-the-window` |
| The yield after a withheld duration lasts two replies after the last withheld line | "It hit me in a split second and the spinning lasted for hours" · "ok" · "fine" · "it lasts a couple of hours" → `m_dur` Under 4 h: the yield-only window ran out after "ok" and "fine". Each withheld line renews it (round 3c, d089). | as designed (ordinary expiry, as for a skipped heard card) | capture suite `yield-only-slot-expires` |
| An abbreviation ends a sentence | "Dr. " or "e.g. " before a day-range phrase puts it in another sentence, where it supplies no value: "I'm dizzy, I told Dr. Lee it was for two days." → heard, no value, yield-only window | documented boundary rule (design 05 §13.4); recall cost only since round 3c | w009 |
| "fewer than" before a 5 min – 72 h band | "The dizziness lasts fewer than five minutes" → 5 min – 72 h through "minutes"; as a reply the same words are refused (R1) | disclosed | t040, d058 |
| Yes/no denials beyond the 14-character window | "It doesn't happen when I roll over" → `v_head` yes; "I haven't noticed any roaring" → `v_aural` yes | baseline window, not changed in 0.4.1 | t030-t033 |
| Double negation read as a denial | "I've had no fewer than five episodes" → `v_count` no | disclosed | t035, t036 |
| Third-party cue on the patient's own report | "I drove with my friend and got dizzy for hours" → nothing recorded: "my friend" can suppress the patient's own report | disclosed | v098 |
| Idiom | "My stomach keeps turning over" → `v_head` yes ("turning over") | disclosed | t034 |
| Hedges carried as definite | "maybe a few hours" as a reply → 5 min – 72 h carried | disclosed | d067 |
| Digits not read in red-flag phrases | "I'm numb on 1 side" does not match the `rf_focal` phrase "numb on one side" | as in 0.3.1 (decision L2) | t026 |

### Drafts considered and struck by the lead

Recorded with the lead's reason so they are not proposed again.

Struck in the lead's review of the vocabulary:

| Draft | Proposed for | Reason |
|---|---|---|
| `a few minutes` | `v_vertigo` duration, Under 5 min | Straddles the 5-minute floor. ("a few minutes" still reads 5 min – 72 h through the existing band phrase "minutes": Q15, flagged, unchanged.) |
| `four days` | `v_vertigo` duration, Over 72 h | Usually describes how long the illness has lasted, and v 3 is evaluated before v 2, so it would override a correct episode duration in the same sentence. |
| `for a week` | `v_vertigo` duration, Over 72 h | As `four days`. |
| `for weeks` | `v_vertigo` duration, Over 72 h | As `four days`. |
| `constantly` | `v_vertigo` duration | A frequency, not a duration. (It remains an existing `i_days` cue.) |
| `too many times to count` | `v_count` | Fires on "antibiotics too many times to count". |

The Appendix A drafts of design 05 were superseded by the lead's approved list (lead decision D2).
A draft not in that list is not approved; where the approved list carries a narrower form instead,
it is named.

| Draft (design 05 Appendix A) | Target | Status |
|---|---|---|
| `unsteady` | `v_vertigo` cue | Not approved; approved instead: `feel unsteady`, `unsteady on my feet`. |
| `on a boat` | `v_vertigo` cue | Not approved; approved instead: `like i'm on a boat`, `like i was on a boat`, `like i am on a boat`, `like being on a boat`. |
| `rocking` | `v_vertigo` cue | Not approved; approved instead: `rocking feeling`, `rocking sensation`. |
| `swaying` | `v_vertigo` cue | Not approved; approved instead: `swaying side to side`. |
| `bobbing` | `v_vertigo` cue | Not approved. |
| `moving around me` | `v_vertigo` cue | Not approved; approved instead: `world moving around`. |
| `spins` | `v_vertigo` cue | Not approved; approved instead: `everything spins`. |
| `woozy` | `v_vertigo` cue | Not approved. |
| `rest of the day` | `v_vertigo` band, 5 min – 72 h | Not approved. |
| `a day or two` | `v_vertigo` band, 5 min – 72 h | Not approved; approved instead: `for a day or two`. |
| `couple of days` | `v_vertigo` band, 5 min – 72 h | Not approved; approved instead: `for a couple of days`. |
| `for weeks` | `v_vertigo` band, Over 72 h | Struck (see above). |
| `a week` | `v_vertigo` band, Over 72 h | Not approved (`for a week` struck, see above). |
| `migraine` | `m_dur` anchor | Not approved; approved instead: `migraine lasts`, `migraines last`. |
| `turn over in bed` | `v_head` | Not approved; approved instead: `turning over`, `over in bed`. |
| `lie back` / `lying back` | `v_head` | Not approved; approved instead: `when i lie back`, `lying back in`. |
| `turn my head` | `v_head` | Not approved; approved instead: `when i turn my head`. |
| `headaches last`, `attacks last`, `migraines last`, `last about`, `last around`, `last up to` | `m_dur` cue | Not approved: the `m_dur` cue list is unchanged in 0.3.2. (`migraines last` is approved as an `m_dur` anchor, not as a cue.) |

Never drafted, recorded in design 05 so they are not proposed: `lightheaded`, `faint`, `giddy`
(`v_vertigo` cue).

### Benchmark (in-sample regression snapshot: development figures, not performance)

The 0.3.0 labels are the 0.3.2 extractor's own output (regression snapshot); P/R/F1 on them is
tautological, not a measurement. The 0.3.0 case text, from all three rounds, was drafted by the team
to exercise the approved phrases and the round-2 and round-3 rules; it has not been reviewed by the
clinical lead.

Rounds 3, 3b and 3c changed the extractor and the gold set, so the figures of the round-2 run of
2026-10-05 (seed 1296126801, `GOLD_0_3_0_SHA256` `6e084ae3…`, tp 185 fp 0 fn 0, dialogues 72/72)
and of the round-3b run (`0b2a6c46…`, tp 192 fp 0 fn 0, dialogues 90/90) no longer apply. The
block below is copied from the `capture` suite's notes in the browser run after round 3c (seed
1296126801), which reported no difference; the same run re-pinned `GOLD_0_3_0_SHA256`
(`729492ef…`) and `EXPECTED_BENCHMARK` in `app/tests/suites/capture.js`.

```text
lexicon 0.3.2 · rule-based / phrase-match with local negation · features scale.heard, scale.carry, scale.carryExclude, scale.yieldTo, scale.anchor, carryRefuse, normalize.apostrophes, normalize.numbers · development set 0.3.0
!! AUTHORED — written by hand to probe known failure modes.
!! These are development figures, not validation results.
!! The 0.3.0 labels are the 0.3.2 extractor's own output (regression snapshot); P/R/F1 on them is tautological, not a measurement.

utterances 262 (44 from 0.2.0 + 218 added in 0.3.0) · labelled extractions 192 (50 + 142)
  micro  P 100.0%  R 100.0%  F1 100.0%  (tp 192 fp 0 fn 0)
  heard  57 labelled heard ids in 0.3.0 cases, checked exactly, excluded from P/R: 57/57 found, 0 unlabelled

BY SLICE (each with its denominator)
  clinical items only    P 100.0%  R 100.0%  F1 100.0%  n=254
  red flags only         P 100.0%  R 100.0%  F1 100.0%  n=8
  encounter register     P 100.0%  R 100.0%  F1 100.0%  n=254
  narrative register     P 100.0%  R 100.0%  F1 100.0%  n=8

DIALOGUES (93, 204 patient steps)
  carry applied as labelled   93/93
  refused as labelled         93/93

no-regression: the 44 cases of 0.2.0 give the same output under lexicon 0.3.2 as under 0.3.1: 44/44
```

### Derivations made before 0.4.1 (R1, Q11: accepted and documented)

A MASQUE derivation saved with "Remember", or downloaded, on screenAIr 0.4.0 records the 0.3.1
root (`lexiconVersion`, `lexiconHash`, `rubricSha256`). On 0.4.1 it no longer verifies against the
built-in module: lineage reports "This file was changed after it was created in screenAIr (root
record lexiconVersion, root record lexiconHash does not match)", and a `goldSet` mismatch is V53
when the root is supplied. This is inherent to any built-in lexicon update. Re-derive edits made
before 0.4.1 from the current built-in module. `instrumentHash` and `scoringHash` are unchanged, so
calibration still applies. The same holds for a derivation saved from a build of round 1 of 0.4.1:
its lexicon 0.3.2 has no `carryExclude`, so its `lexiconHash` differs from the shipped one. A
derivation saved from a build of round 2 still verifies after round 3, because round 3 changes no
lexicon content; lineage notes only that the built-in's rubric bytes changed (the reworded
change-log note).

## 2026-10-06

Release screenAIr 0.4.2 (0.4.1 → 0.4.2): the Spanish Patient Companion completed. Instrument 0.2,
lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged. `masque.logic.js` is not touched,
so its SHA-256 (`logicSha256`) is unchanged. In the rubric only `locales.es` and the change log
change: `instrumentHash`, `scoringHash` and `lexiconHash` exclude the locales and are unchanged, so
the illustrative calibration still applies; `contentHash` and the rubric's bytes change.

The rubric's change-log entry, verbatim:

- **translation** (`/locales/es/contextItems`, `/locales/es/steps/story/heading`, `/locales/es/steps/story/lede`, `/locales/es/steps/story/intro`, `/locales/es/ui/forYouIf`, `/locales/es/ui/clinicianLede`, `/locales/es/items/r_dur/clin`, `/locales/es/items/r_abx/clin`, `/locales/es/items/r_surg/clin`, `/locales/es/items/r_lesion/clin`, `/locales/es/items/r_normal/clin`, `/locales/es/items/m_head/clin`, `/locales/es/items/m_dur/clin`, `/locales/es/items/m_photo/clin`, `/locales/es/items/m_nausea/clin`, `/locales/es/items/m_disable/clin`, `/locales/es/items/m_aura/clin`, `/locales/es/items/m_trig/clin`, `/locales/es/items/m_fhx/clin`, `/locales/es/items/v_vertigo/clin`, `/locales/es/items/v_count/clin`, `/locales/es/items/v_migfeat/clin`, `/locales/es/items/v_motion/clin`, `/locales/es/items/v_aural/clin`, `/locales/es/items/v_head/clin`, `/locales/es/items/n_burn/clin`, `/locales/es/items/n_otalgia/clin`, `/locales/es/items/n_auto/clin`, `/locales/es/items/n_viral/clin`, `/locales/es/items/n_allo/clin`, `/locales/es/items/i_days/clin`, `/locales/es/items/i_role/clin`, `/locales/es/items/x_purulent/clin`, `/locales/es/items/x_objective/clin`, `/locales/es/items/x_lowfreq/clin`, `/locales/es/items/x_anosmia/clin`): Spanish patient wording completed for release 0.4.2 (user request, 2026-10-06): an unreviewed team translation (two independent drafts, with clinical, language and mechanical review), recorded row by row in tests/harness/locale-delta.js and modules/masque/SOURCES.md. Added to locales.es: contextItems (c_clin, c_dur, c_dismiss: q and opts; the option values are the English ones, in the English order), steps.story heading, lede and intro, ui.forYouIf and ui.clinicianLede, and a Spanish clinician line (clin) for each of the 30 items, which the patient summary's "Para mi médico" block shows instead of the English patientClin. No existing Spanish string changed. locales.es.reviewed stays false, so the unreviewed-translation notice stays until a bilingual clinician reviews the Spanish. Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 unchanged.

### Why

The user asked on 2026-10-06 to "fix the Spanish patient companion to make sure it is completely
translated". Before this release a Spanish-speaking patient still met English: 11 rubric leaves
fell back to English (the context questions, the story heading, lede and intro, the "It's for you
if" list and the clinician paragraph; 11 V33 warnings), 17 `PATIENT_CHROME` keys fell back (the
intro, the safety step, the summary lede, "Get seen today/this week", the disclaimer and the
footer), the 30 clinician lines were English, and the patient caveats, engine cards, footer
version line and patient-mode controls existed only in English. This answers design question Q9
("translate now (needs a reviewer) or ship as today?") with "translate now", and amends D19
("strings untranslated today still fall back to English").

### What was translated, and by whom

- **Module data** (rubric `locales.es`, applied by the extractor from
  `app/tests/harness/locale-delta.js`): the three context questions with their option labels
  (values unchanged, in the English order), the story heading, lede and intro, the three "Es para
  usted si" bullets, the clinician paragraph and a clinician line (`clin`) for each of the 30
  items. Row by row, with the basis of each, in `SOURCES.md` ("Spanish translation delta
  (unreviewed)").
- **Engine chrome**: the 17 missing `PATIENT_CHROME.es` keys, in `app/src/engine/patient.js`
  (listed in `SOURCES.md`).
- **Engine and shell text** (not module data): the patient caveats, the Spanish companion line of
  the prototype marker, the two engine cards, the patient footer's version line and the
  patient-mode controls (sections below).

The Spanish (82 strings) was produced by AI agents: two independent drafts, merged, then a
clinical review, a language review and a mechanical review, also by AI agents. It was **not**
produced or checked by a qualified human medical translator or by a bilingual clinician. No
existing Spanish string was changed: the delta can only add paths, and the `values` suite keeps
pinning every baseline Spanish string byte for byte.

### Review status: `reviewed` stays false, and the banner stays

`locales.es.reviewed` stays `false`. The "⚠︎ Traducción sin revisar" banner (its text unchanged),
the " · Traducción sin revisar" print-header title and the unreviewed line at the top of the
`.txt` therefore remain on every Spanish surface. Only a bilingual clinical reviewer's sign-off,
recorded as a decision, may set it to `true`. The items awaiting that reviewer, the safety strings
first, are listed at the end of the Spanish section of `SOURCES.md`.

### The `clin` locale key

`locales.<loc>.items.<id>.clin` is a new optional key for translations: the item's clinician line
in that language. Under `es` the "Para mi médico" block now reads the Spanish line plus the Spanish
option label in brackets, where it used to read the English `patientClin` plus the Spanish label.
Each line carries its own `lang` (on screen and in the `.html`; the `.txt` is untagged). English
has no `clin` (a V32 error): its line is `patientClin`, unchanged. A locale without `clin` falls
back to `patientClin`, tagged `lang="en"`. The baseline Patient said this block "stays in clinical
English regardless of locale" (Pat L1116-1118); translating it follows the request for a complete
translation and is flagged for the lead (`SOURCES.md`, reviewer item 9). In the Rubric Editor the
key is the optional field "Clinician line (patient summary)" in a non-English locale's Patient
wording, hinted with the English `patientClin`; clearing it removes the key, and an edit of the
item's `patientClin` marks it stale.

### Two Spanish grammar fixes (baseline behaviour, changed)

- **"¿".** The Spanish ask form only turned the final "." into "?", so 18 yes/no questions in the
  summary read "statement?" with no opening mark. It now prefixes "¿" when the transform itself
  made the "?" and the text has no "¿" anywhere (a question that already contains one, such as
  `v_vertigo`'s "…, ¿cuánto dura?", is left alone). Exactly those 18 items change.
- **"e" for "y".** The Spanish list joiner now uses "e" before a final element that starts with an
  /i/ sound ("i…", or "hi" + consonant, accents ignored) and keeps "y" before "hie", "hia", "hio"
  and "hiu" ("y hielo"). It already changes a real summary line: "…durante las crisis e
  inflamación…". An element starting "hia", "hie", "hio" or "hiu" always takes "y": right for
  "hielo" and "hierba", but a word whose /i/ is a vowel in hiatus ("hiato") would also get "y" (a
  known limitation, documented at `GRAMMAR.es`; no element of this module starts that way).

English output is unchanged by both. A question whose Spanish wording is missing (a derived
module's new item that falls back to English, V33) is never given the Spanish grammar: it takes the
English question form ("Do I …?", no "¿") and is tagged `lang="en"` on screen and in the `.html`.
The built-in module has no such fallback, so its Spanish output is as described above.

### Language tagging and `<html lang>`

- `<html lang>` follows the companion's locale on `patient.html` and in the shell's patient mode,
  and returns to `en` when patient mode is left.
- `patient.html`: the tab title is "{name} · " + the locale's title ("Preparándose para su
  consulta" in Spanish), and the header title and the region carry `lang`.
- The print header is built from parts, each tagged with its language.
- Context option buttons take their `lang` from the options, not from the question.
- The progress line and step headings carry `lang` when their title is a fallback.
- In patient mode the patient panel is labelled with the locale's title, with `lang`, and no
  longer points `aria-labelledby` at a tab button that patient mode does not render; its
  `aria-label` is its name. Clinician mode is unchanged.
- English elements on a Spanish page (the English marker, the English lines of the patient-mode
  controls) carry `lang="en"`. So do the static corner badge and the noscript paragraph of
  `patient.html` and `screenair.html` (outside the React root), the hidden clinician panels in
  patient mode, and a shell toast's English text and its "Dismiss" label.

### Spanish caveats and the companion marker

- The patient caveats now have Spanish: the edited-questionnaire and loaded-from-a-file lines and
  their short markers, the edited-wording notice and the stale-translation notice. They are chosen
  by the patient locale in the banner, the provenance block, the `.txt`, the `.html`, the footer
  markers, the print header and the shell's caveat strip, and tagged `lang="es"` wherever the
  surface is HTML (the `.txt` is plain text, untagged). They never show for the built-in module,
  only for derived or uploaded modules and edited or stale locales. In patient mode and on
  `patient.html` the caveat strip shows only the Spanish lines; on the clinician's Patient tab
  (not handed to the patient) it keeps the English lines exactly as before and adds the Spanish
  lines after them (`lang="es"`).
- **The marker "Prototype · not for clinical use" stays in English everywhere** (`lang="en"`). On a
  Spanish patient surface the Spanish companion line follows it, never replaces it: "Prototype · not
  for clinical use — Prototipo · no apto para uso clínico". This covers the caveat strip, the
  patient footer, the print header, the `.txt` last line ("Prototype · not for clinical use —
  Prototipo · no apto para uso clínico · YYYY-MM-DD") and the `.html` header and footer. In
  unreviewed Spanish the print header reads "Prototype · not for clinical use — Prototipo · no apto
  para uso clínico · Traducción sin revisar". In English nothing changes.
- The validator's V38 now also bans every Spanish caveat, and the phrase "no apto para uso
  clínico", from module data. It compares both sides with accents removed and lower-cased (after
  canonical decomposition), in both languages, so "no apto para uso clinico" is caught too.
- The engine cards ("no patient wording" and the summary-error card) have Spanish versions, chosen
  by locale.
- The patient footer under `es` reads "MASQUE · versión 0.4.2 · instrumento 0.2": release and
  instrument stay two separate numbers.

### Bilingual patient-mode controls

In the shell's patient mode, with the companion in Spanish, the controls keep their English and add
a Spanish line under it (`lang="es"`): the "Return to clinician view" button ("Regresar a la vista
del médico"), the return confirmation's title, body and both buttons, and the microphone-stopped
toast. The patient-mode tab title becomes "screenAIr · Preparándose para su consulta". The English
stays because these controls are addressed to the clinician as well. Test ids are unchanged.

### Round 3: the rendered-Spanish review (2026-10-06)

A review of the Spanish as the patient sees it (screens, `.txt` and `.html` captures) changed five
Spanish values; English is untouched, and no module data changed (the rubric is byte-identical):

- `PATIENT_CHROME.es.carryOn`: "Puede continuar y terminar el resumen — esto aparecerá en la parte
  de arriba del resumen." ("del resumen" names whose top);
- `PATIENT_CHROME.es.summaryLede`: "Imprímalo o déjelo abierto en su teléfono. …" (no comma before
  "o");
- `PATIENT_CHROME.es.footer`: "Guía {name} v{appVersion} para el paciente · instrumento
  v{instrument} · …" (the release follows the name, not "el paciente");
- `CAVEATS.patient.edited.esShort` and `uploaded.esShort`: "cuestionario modificado localmente,
  sin revisar" and "cuestionario cargado desde un archivo, sin revisar" (the marker names its
  noun, so it reads right after "Traducción sin revisar").

Declined: lower-casing the "Es para usted si" bullets (kept parallel with the English source, which
capitalises its bullets too). The same round fixed the engine: the English-fallback question form
and the strip on the clinician's Patient tab (above), the patient panel's `aria-labelledby`,
accent-insensitive V38, and AD14 now excuses only a comparison whose own locale is Spanish. All
five values are unreviewed like the rest (`SOURCES.md`, "Revised after the rendered-Spanish
review, round 3", and reviewer item 12).

### Release 0.4.2

`APP_VERSION` (`app/src/engine/policy.js`) and the test harness's `NEW_RELEASE` move together to
0.4.2. 0.4.1 is deployed at `/masque/demo/`, and printed exports and footers carry the release, so
two different patient apps must not both print "0.4.1". The release has been the lead's call
(design Q2); it is recorded as a decision of this release (design, "Decisions for release 0.4.2"),
and deployment remains the lead's.

Lineage: derivations made under 0.4.1 still verify, because lineage compares the instrument,
scoring and lexicon hashes and `logicSha256`, none of which moves; module information shows the
extra reason that the built-in's rubric bytes changed. A 0.4.1 download-all zip that contains the
built-in MASQUE rubric no longer matches it byte for byte, so its rubric is offered as "Load as
derived" instead of being recognised as already loaded; derived entries inside such a zip still
verify.

### What stays English, and why

- The marker "Prototype · not for clinical use": the project rule; the Spanish line is added next
  to it.
- The static corner badge of `patient.html` and `screenair.html` (`.masque-proto`): it stays the
  English marker only, tagged `lang="en"`. It is static HTML outside the React root, written
  before any locale exists, and it is the required English marker; the React caveat strip just
  below it already shows the marker with its Spanish line on a Spanish surface. Recorded as a
  decision of this release; no code change.
- Text shown before a locale exists (the companion always opens in English): `patient.html`'s
  static title, description, loading text and noscript; "This questionnaire is not available.",
  the load-failure message and its "Technical detail"; the shell's "no longer loaded" message, the
  loading states and the module-list errors.
- Shell chrome around patient mode: the screenAIr wordmark and the toast's "Dismiss" label.
- The English lines of the bilingual patient-mode controls (kept for the clinician).
- The "English" button of the language switch (an endonym, tagged `lang="en"`).
- The whole clinician program, which has no Spanish.
- English module text that a derived or uploaded module leaves untranslated still falls back to
  English (V33).

### Known limits

- Unreviewed: every new Spanish string waits for a bilingual clinical reviewer (`SOURCES.md`).
  The existing Spanish (masculine generics, a mix of registers) was not reworded, by rule, and is
  flagged for the same reviewer.
- The `.txt` export has no thin-summary warning and no "not sure" lede, in either language (as
  before). [Fixed in release 0.4.3 (AD16); see the 0.4.3 entry.]
- No remembered locale and no `?lang=es` parameter: the patient must choose "Español" each time.
- For derived modules with partial translations, some English fallbacks (flag and item fallbacks,
  the summary-template fallback) are still not tagged `lang="en"`; the "not sure" questions are,
  since round 3. Not reachable with the built-in module, whose Spanish is now complete.
- The cloud Playwright specs were not run for this release (no Node on this machine). Their
  Spanish-mode text pins (for example the Spanish print header) must follow the new text.
- Baseline logic, for the clinical lead (not translation): a clinician line can show "+" next to a
  bracketed scale option outside the criterion's window (`m_dur`, `v_vertigo`), in both languages
  (`SOURCES.md`).

### Verification (2026-10-06, after round 3)

Full test run at `app/tests/index.html?seed=1296126801` (not quick): **22/22 suites PASS**
(`patient` 303,563 checks, `render-patient` 8,964, `omissions` 20,477, `golden` 411, `values`
2,723, `validate` 316 with MASQUE at 0 errors, V12 ×1, V33 ×0; the full per-suite list is in
`docs/refactor/02-app-divergences.md`, "screenAIr 0.4.2", Verification). `extract-rubric.html`
reports "Identical" (SHA-256 `6f426f60ae8ab8355e40bf589d2d2930f5a795dab80acf6f017d46d72df0d054`,
129 checks, 103,312 bytes). The cloud Playwright specs were not run (no Node on this machine).

## 2026-10-06: release 0.4.3, the EMR Friendly Template

Release screenAIr 0.4.3 (0.4.2 → 0.4.3). Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold
set 0.3.0 are unchanged. `masque.logic.js` is not touched, so `logicSha256` is unchanged. In the
rubric only the new top-level block `emrTemplate` (inserted just before `changelog`) and one
change-log entry are added; nothing existing changes. `instrumentHash`, `scoringHash` and
`lexiconHash` do not cover the block and are unchanged, so the illustrative calibration still
applies; `contentHash` and the rubric's bytes change. The release also carries two engine changes
made in separate sessions and integrated on 2026-10-07: the Patient `.txt` thin warning (AD16) and
round 3d. Neither touches the rubric; see "Also in release 0.4.3" below.

**Review status (at release 0.4.3).** The clinical content of this release (the citation
register, the reference, checklist and exam labels, and which citations sit under which red flag)
was assembled by AI agents from verified specialty-society and journal sources. At release 0.4.3
it had not been reviewed by the clinical lead. The provenance in `app/tests/harness/emr-delta.js`
said so (`EMR_DELTA.drafted.reviewed: false`), and the generator refused a delta that read
otherwise (`applyEmrDelta`), so setting it to `true` had to go with a recorded decision of the
lead. Decisions D1-D16 below all awaited the lead. **That decision came on 2026-10-07:** the
clinical lead signed off the EMR template content as implemented, recorded in release 0.4.4
(`EMR_DELTA.signOff`; the 0.4.4 entry below gives its scope and what it does not cover). The
template is a prototype aid for drafting a note. It is not a clinical document, not decision
support and not a prescribing aid. Every copy of it opens and closes with "Prototype · not for
clinical use".

The rubric's change-log entry, verbatim:

- **emr-template** (`/emrTemplate`): EMR Friendly Template data added for release 0.4.3 (user request, 2026-10-06): emrTemplate carries citation metadata and links only (verified or corrected sources, accessed 2026-10-06), the empiric-treatment references, the routing recommendations whose chips are instruments, the red-flag references and workup placeholders, the treatment-and-workup rows, the management checklist and the exam rows. Drafted by AI agents from verified sources and not reviewed by the clinical lead (decisions D1-D16 await the lead); recorded row by row in tests/harness/emr-delta.js. No guideline text is copied and no agent, dose or threshold is stored. Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged; only contentHash changes.

### The feature

The user asked on 2026-10-06 for an "EMR Friendly Template" button next to the chart write-back
in the Clinician Screener and the Ambient Scribe. The button opens a text box in an iframe with a
pre-populated, unformatted consult note, with bracketed placeholders for the exam and other
patient-specific findings (allergies, for example), "similar to the FHIR option". The request asked
for four things in the plan:

- a reference to a specialty-society page on empiric prophylactic and abortive treatment that a
  clinician could try before the patient reaches a specialist;
- a referral to a neurologic specialist, based on the screen result;
- when red flags are present, the imaging, labs or referral that fit them;
- a brief checklist of allergy, sinusitis and dizziness management not yet offered.

What shipped:

- **Screener.** The result step's write-back row gains a `btn ghost` button labelled "EMR Friendly
  Template" (lucide `ClipboardList`), right after "Write result to chart". It toggles a panel below
  the row.
- **Scribe.** The Note view's button row gains an `act ghost` button with the same label, right
  after "Sign to chart", and the same panel below the row.
- **The panel.**
  - An instruction line: "Plain text for pasting into an EMR. Complete every [bracketed] field;
    edits here are not saved. The text is rebuilt whenever the screen changes or you leave this
    view, which discards edits made here." On the Scribe the second sentence reads "The text is
    rebuilt whenever the encounter changes or you leave this view, which discards edits made
    here." (review round 2; "or you leave this view" since review round 4: the panel unmounts
    with its view).
  - A script-free `<iframe sandbox="allow-same-origin">` titled "EMR friendly consult note
    template", holding one editable monospace textarea.
  - "Copy text" and "Download .txt". Both take the text as currently edited in the box. The files
    are `masque-emr-template-screener.txt` and `masque-emr-template-scribe.txt`.
  - The panel mounts only while open. Resetting the screen or the encounter closes it.
- **The text.** `buildEmrTemplate` in the new engine file `app/src/engine/emr.js` writes it: plain
  text, LF line endings, no markdown. It uses the same inputs and the same gates as the FHIR
  bundle, so the note and the bundle never disagree on referral or routing. Neither `buildNote`
  nor `buildBundle` is changed or called.

### What the note contains in each state

Every note has these parts, in this order:

1. The marker and the provenance lines (none for the built-in module).
2. The title: `fhir.documentTitle` and the surface title, "MASQUE encounter note (draft) - MASQUE
   Screener" or "- MASQUE Scribe".
3. The patient line and the header placeholders (DOB, date of service, referring clinician,
   consultant, encounter type). A synthetic (demo) patient is never copied into the text: the
   line reads `Patient: [name]   Age / sex: [ ]   MRN: [ ]` (review round 1). A real identity is
   printed only from a patient object that is not synthetic, which neither app passes today.
4. REASON FOR CONSULT: the presenting picture. The Screener prints the picture the clinician
   picked. The Scribe prints `Presenting picture: [ ]`, followed by "(screen phenotype by module
   rule: <picture>; confirm)" only when a module derive rule fired; an encounter where no rule
   fires never prints the module's default picture (review round 1).
5. HISTORY OF PRESENT ILLNESS: an HPI placeholder, the context questions that were answered, the
   module's gap line when every gap marker hit (when the rule fires on fewer, the encounter note's
   context line, for example "Context: duration >12 months; seen by 3+ clinicians.", instead:
   review round 3), and on the Scribe the information prompts covered and the
   probe notes, by kind: supporting (phenotype) notes under "Supporting features (recorded, not
   scored):" with the module's footer, and notes of kinds that may write a scored item (rescue,
   criteria, safety, rule-out) under "Probe notes (recorded by clinician):" without it.
6. TREATMENT AND WORKUP TO DATE (from screen). When a Scribe probe the clinician answered wrote an
   item's current answer, its option label follows the state, for example "Audiometric
   fluctuating low-frequency SNHL: answered no (recorded by clinician via probe: Stable, or never
   tested twice)". When no probe wrote a negative answer, the row's qualifier follows it instead:
   "Audiometric fluctuating low-frequency SNHL: answered no (testing not recorded)", and the same
   for the endoscopy/CT item, so a "no" never reads as a negative test (review round 2). Since
   review round 3 the two prior-workup items read "answered no (workup not recorded)" the same
   way. The migraine-trial placeholder row is followed on the Scribe by the recorded
   treatment-trial answer, and the last row is the placeholder "Acute headache medication use —
   days per month, by class: [ ]" (review round 3, D13).
7. PAST HISTORY / MEDICATIONS / ALLERGIES (placeholders only).
8. REVIEW OF SYSTEMS (screen items, as answered; not today's examination) (the heading since
   review round 3):
   - "Endorsed" by domain;
   - "Answered no";
   - an item a Scribe probe wrote carries that probe's recorded answer here too, for example
     "Answered no: Head-motion or positional intolerance (recorded by clinician via probe: No
     positional trigger)" (review round 2);
   - "Not answered: n of N scored items. Unanswered items are not counted as denials.";
   - a placeholder.
9. PHYSICAL EXAM (placeholders only). Each row names its sources by number, for example
   "Dix–Hallpike (right, left) (sources 6, 1): [ ]" (review round 2).
10. SCREEN RESULT. The domain points carry their denominators: "Otologic / vestibular 4/25 (1
    of 6 items answered)", and "Neuropathic not answered" for a domain with nothing answered, so
    an unasked domain never reads as zero points (review round 3). A fully answered screen prints
    the encounter note's domain line unchanged.
11. ASSESSMENT.
12. PLAN.
13. REFERENCES (cited by number in the exam rows and checklist): the exam rows' and the
    checklist's citations, one numbering by first use, each listed once (review round 3; it
    replaces round 2's "Exam row sources:" and "Checklist sources:" lists).
14. Sign-off: the module's sign-off sentence, a signature placeholder, "Reference links accessed:
    2026-10-06" (only when a citation was printed), the version line, and the marker again.

The states differ only in SCREEN RESULT, ASSESSMENT and PLAN:

| State (gates as in the bundle) | SCREEN RESULT | ASSESSMENT | PLAN |
|---|---|---|---|
| Red flag open (either surface; checked first) | Index or the incomplete sentences, then "RED FLAGS PRESENT — EMERGENT\|URGENT. Screening routing withheld." and one `- <flag text> — <points>.` line per flag; on the Scribe, while the review is not recorded, "NOT YET REVIEWED — no routing issued. Complete the red-flag review before signing." follows them (review round 3: the flags listed are the ones raised, the others were never confirmed absent) | "Red flag present — evaluate on its own terms before treating this as a masked migrainous / neuropathic driver." | The tier header, then "At least one needs same-day assessment." (emergent) or "Expedited workup — days, not weeks." (urgent only). Then, once, "Actions are the module's own wording; Ref lines are background reading, not the source of an action or its timing." One `- <module action> (<points>).` line per flag (Scribe: plus " Source: heard in encounter." / "marked by clinician." / `from <probe kind> probe.`), each followed by its "Ref:" lines and, for `rf_systemic`, "[directed workup — specify]". Then "[Workup ordered / ED or same-day referral made — details, time]" and "Screening routing withheld — red flag present" (the Screener bundle's routing-override wording, printed on both surfaces as the content basis gives it; the Scribe bundle has no such component, and neither bundle issues a referral under a flag). **No referral line, no screening recommendations, no empiric-treatment references.** The checklist stays. |
| Scribe, safety review not recorded (no flag open) | "NOT YET REVIEWED — no routing issued. Complete the red-flag review before signing." | placeholder | "Safety review not recorded — no screening routing issued." Then the checklist. |
| Not scorable | "MASQUE SCREEN — INCOMPLETE, NO RESULT ISSUED" and the encounter note's incomplete sentences (bounds, "No likelihood band is reported…") | placeholder | "Screen not scorable — complete the outstanding items before acting on this screen." Then the checklist. |
| A module routing or phenotype rule failed | Index | placeholder | `Screening routing withheld: module rule "<ruleId>" failed, so no referral was issued.` plus any recommendations the engine still returns. Then the checklist. |
| Scorable, low band (referral gate closed by the band) | Index, coverage, domains, "Red-flag review completed; none present." | placeholder | "Referral: [clinician decision]", the two consultant placeholders, and the routing recommendations that fired, verbatim (or the module's no-driver line). Chips print as "Instruments: a; b" only for the recommendations `emrTemplate.instrumentRecs` lists (mid-facial migraine, vestibular migraine, tinnitus), as "Named on screen: a; b" for other fixed chips (the neuropathic overlay: SFN-SIQ, COMPASS-31 and, on the Screener, "Neurology"), and not at all when the rule computes them from the answers (the competing-findings chips, which are cut from rule-out item text; those items are listed under treatment and workup). **No empiric-treatment references.** Then the checklist. |
| Scorable, moderate or high, referral gate open | as above | `Screen: <Moderate\|High> likelihood of a masked migrainous / neuropathic driver (illustrative—replace after validation)` | The bundle's own referral text: "Referral: Neuro-otology — evaluate for vestibular migraine" (complaint otologic) or "Referral: Headache medicine / Neurology — evaluate for mid-facial / migrainous cause" (every other complaint, "both" included). Then `Reason: MASQUE index n/100 (<band> likelihood); administer confirmatory instrument.` (the Scribe omits "likelihood", as its bundle does), byte-equal to the bundle, followed by "(MASQUE index: illustrative—replace after validation)" and, on the Scribe, a line saying where the destination came from: "(destination from the screen phenotype by module rule: <picture>; confirm)", "(destination from the module's default phenotype: <picture>; confirm)" when no derive rule fired, or "(destination from the screen phenotype: <picture>; confirm)" (review round 3, D14). Then the consultant placeholders and the recommendations. Then "Empiric treatment references (for use before specialist review):" with four reference lines for every picture (AAN/AHS 2026 first), plus the AFP dizziness line and the vestibular-migraine note for the otologic and both pictures. Then three "offered today" placeholders and the checklist. |

In every scorable state the index carries the illustrative label:
`Index n/100 (illustrative—replace after validation) — <BAND> likelihood of …`. Since review round
2 (R25) ASSESSMENT lists no criteria items: the "Criteria items recorded on screen" block printed
the module's criterion letters, one of which contradicts the Bárány/IHS criteria cited in the same
note (risk 14). Every item still appears in the review of systems.

The checklist heading is "Medical management not yet offered — checklist (allergy / sinusitis /
dizziness):" (D7, verbatim). The next line is the key (review round 1): "Key: ticked = recorded
as done; unticked = not recorded (not confirmed as not offered)." Each row reads one of:

- `[x] <label> - recorded on screen: <item wording>`, only when an answer proves the step was
  done, or `[x] <label> - recorded by clinician via probe: <probe note>` when a Scribe probe
  answer does. Since review round 3 an item answer that a Scribe probe wrote reads the same way,
  with the probe's answer after the item wording: "[x] Audiogram (…) (sources 1, 15, 16) -
  recorded by clinician via probe: Audiometric fluctuating low-frequency SNHL (Yes, it
  fluctuates)", never "recorded on screen";
- `[ ] <label> - patient reports never tried`, only from the Scribe's treatment-trial probe;
- `[ ] <label> - not recorded`, the default, which never means "not offered".

A row may add "; screen answered no: …", "; screen records (context only): …" (for `r_abx`
"(context only; agent/route not recorded)", and since review round 4 for `r_normal` "(context
only; modality not recorded)") or, for a probe answer, "; recorded by clinician via probe
(context only): …" (review round 2) or "; recorded by clinician via probe, answered no: …"
(review round 3, for example "Objective sinus inflammation on endoscopy/CT when symptomatic
(Genuinely clear)"). Since review round 4 that clear scan, recorded by the clinician, also ticks
the sinus-evaluation row: "[x] Objective sinus evaluation (rhinoscopy, endoscopy or CT) (sources
3, 4) - recorded by clinician via probe: Genuinely clear; recorded by clinician via probe,
answered no: …". The allergy-testing row ends with "[date / result]".
The antibiotic-stewardship row is a status line without a box, printed only when `r_abx` is "yes"
(review round 2): "Antibiotic stewardship reviewed (sources 3, 4, 12): not recorded; screen records
(context only; agent/route not recorded): ≥2 antibiotic/steroid courses without lasting relief".
The positional row names the treatment only, "Canalith repositioning (if positional vertigo)",
with a recorded Dix–Hallpike result as context; the test itself is the exam row (review round 2).
Missing data never ticks a box, and a signal whose render contradicts its answer (a "no" as done,
a "yes" as answered no) never prints. Each row names its sources by number after its label
("(sources 1, 3)"; review round 2); since review round 3 the numbers continue the exam rows'
numbering, and the one list after the plan holds both.

The neutral template applies to a module without `emrTemplate` (an uploaded or generic module).
It keeps the same sections and gates. Red flags still print their module actions, without "Ref:"
lines. It has no treatment rows (one placeholder instead), no reference lines, no checklist, no
sources (no REFERENCES section) and no exam rows beyond vitals and general; fixed chips print
as "Named on screen:".

### Where each line comes from

Every line is one of the source classes of the content basis (`emr-basis`, a working document of
the release, not in the repository). No other clinical sentence appears.

| Class | What it is | Lines |
|---|---|---|
| M: module text | Read from the bound module at run time, moved verbatim | presenting picture (`phenotypes.values`; on the Scribe only after a fired derive rule), context questions and options, gap line, info-prompt label and supporting footer, probe notes and option labels, item `patientClin` / `short` / scale labels, domain labels, red-flag `text`, `points`, `action`, routing recommendation `h`, `p` and chips, `copy.note.*` (screen heading, likelihood phrase, pattern phrase, no-driver line, sign-off), `copy.screener.bandSuffix`, `copy.indexName`, `fhir.documentTitle`, the referral specialty and reason (`phenotypes.referral`) |
| E: engine sentence | Copied verbatim into `engine/emr.js`, each source named at its constant | the red-flag header and tier lines, "Red-flag review completed; none present.", the not-reviewed and not-scorable sentences (since round 3 the not-reviewed sentence also follows open flags on the Scribe while the review is not recorded), the encounter note's "Context: …" line (round 3), the rule-error sentence, "Screening routing withheld — red flag present" (the Screener bundle's wording, on both surfaces), the incomplete-screen sentences, the index and domains formats, the referral and reason formats, "Unanswered items are not counted as denials.", "heard in encounter", the band labels; `CAVEATS.prototype` and `CAVEATS.illustrative` from `engine/policy.js` |
| A: app data | The screen's own state | answers, score, coverage, band, open flags and their capture source, complaint, probe answers (patient demographics only from a non-synthetic patient) |
| C: citation | `emrTemplate.citations`, printed as metadata and a link only | every "Ref:" line, every reference line, the checklist and exam-row sources |
| N: new short label | `emrTemplate` data, each with its citation keys (decision D1) | the reference labels, the vestibular-migraine note, the checklist labels, the exam-row labels |
| P: placeholder | Square brackets, written by the engine or around an `emrTemplate` heading, placeholder or qualifier | every patient-specific field, the identity line, the Scribe's presenting picture, "[date / result]", "[directed workup — specify]" |
| S: structural label | Section headings (round 3: "REVIEW OF SYSTEMS (screen items, as answered; not today's examination)", "REFERENCES (cited by number in the exam rows and checklist)"), status words, "Ref:", "Instruments:", "Named on screen:", "Source:", "Key: …", "Probe notes (recorded by clinician):", "recorded by clinician via probe" (", answered no"), "(context only)", "Screen:", "(screen phenotype by module rule: …; confirm)", the Scribe's destination lines (round 3), the domains' "(n of m items answered)" and "<domain> not answered" (round 3), the Ref-lines line above the red-flag actions, the rows' "(sources 1, 3)" marks and the source-list numbers (round 2), and the data's qualifiers ("agent/route not recorded", "testing not recorded", round 3 "workup not recorded", round 4 "modality not recorded") | |

The row-by-row record of every `emrTemplate` string, with its citation keys and basis, is in
`SOURCES.md` ("EMR template data (release 0.4.3, signed off by the clinical lead in 0.4.4)").

### Citation register (accessed 2026-10-06)

Only sources the citation verifier marked `verified` or `corrected` are used. All 35 carried are
printed somewhere. Verified sources that this release does not carry are kept out of the
rubric, among them AHS24 and AHS21 (they conflict with or are superseded by AAN/AHS 2026), IHS-PREV24,
ICHD3, ACEP19 (background only), ACR-VISION25, ICAR-TUM24 (abstract only), ICAR-RS21, APTA22
(peripheral hypofunction only), ACR-DIZZ23, AAO-MEN20, AAO-AIT24, JTF-DRUG22 and, since review
round 1, AFP-ARS25 (its accessible text does not support "Emergency ENT and imaging", the only
place it was cited). The "Used by" column names the `emrTemplate` entries that cite the key.

| Key | Citation (as printed) | URL | Status | Used by |
|---|---|---|---|---|
| `AAN26` | Potrebic S, Tanveer S, Becker WJ, et al. Pharmacologic Treatment for Migraine Prevention in Adults Practice Guideline Recommendations: Report of the AAN Guidelines Subcommittee and the American Headache Society. Neurology. 2026;107(7):e214881. | https://www.aan.com/Guidelines/Home/GuidelineDetail/1158 | corrected | references/0 |
| `AFP-PROPH25` | Moreland P, Gaffney B, Lanham JS. Migraine Headache Prophylaxis. Am Fam Physician. 2025;111(5):443-450. | https://www.aafp.org/afp/2025/0500/migraine-headache-prophylaxis | verified | references/1 |
| `AFP-ACUTE25` | Wiley AT, Watson JC, Lehmann DN. Acute Migraine Headache: Treatment Strategies. Am Fam Physician. 2025;111(4):317-327 (updated 2026-04-02). | https://www.aafp.org/afp/2025/0400/acute-migraine-headache | corrected | references/2 |
| `AFP-IHSACUTE26` | Arnold MJ. Acute Migraine Treatment: Guidelines From the International Headache Society. Am Fam Physician. 2026;113(2):196-198. | https://www.aafp.org/afp/2026/0200/practice-guidelines-acute-migraine-treatment | verified | references/3 |
| `AFP-DIZZ23` | Rogers TS, Noel MA, Garcia B. Dizziness: Evaluation and Management. Am Fam Physician. 2023;107(5):514-523. | https://www.aafp.org/afp/2023/0500/dizziness | corrected | references/4, references/5, checklist/dz1, checklist/dz2, checklist/dz3, checklist/dz4, examRows/0, examRows/12, examRows/13, examRows/14, examRows/17 |
| `COCH-VMPROPH23` | Webster K, Dor A, Galbraith K, et al. Pharmacological interventions for prophylaxis of vestibular migraine. Cochrane Database Syst Rev. 2023;4(4):CD015187. | https://pmc.ncbi.nlm.nih.gov/articles/PMC10093999/ | verified | references/5, checklist/dz3 |
| `COCH-VMACUTE23` | Webster KE, Dor A, Galbraith K, et al. Pharmacological interventions for acute attacks of vestibular migraine. Cochrane Database Syst Rev. 2023;4(4):CD015322. | https://pmc.ncbi.nlm.nih.gov/articles/PMC10097606/ | corrected | references/5, checklist/dz3 |
| `BARANY22` | Lempert T, Olesen J, Furman J, et al. Vestibular migraine: Diagnostic criteria (Update). J Vestib Res. 2022;32(1):1-6. | https://pmc.ncbi.nlm.nih.gov/articles/PMC9249276/ | verified | references/5, checklist/dz3 |
| `ACR-HA22` | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Headache (2022 Update). J Am Coll Radiol. 2023;20(5S):S70-S93. | https://acsearch.acr.org/docs/69482/Narrative/ | verified | redFlagRefs/rf_thunderclap, redFlagRefs/rf_vision, redFlagRefs/rf_pulsatile, redFlagRefs/rf_progressive, redFlagRefs/rf_new50, redFlagRefs/rf_systemic |
| `AFP-HA22` | Viera AJ, Antono B. Acute Headache in Adults: A Diagnostic Approach. Am Fam Physician. 2022;106(3):260-268. | https://www.aafp.org/afp/2022/0900/acute-headache-adults | verified | redFlagRefs/rf_thunderclap, redFlagRefs/rf_new50 |
| `ACR-STROKE23` | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Cerebrovascular Diseases-Stroke and Stroke-Related Conditions. J Am Coll Radiol. 2024;21(6S):S21-S64. | https://acsearch.acr.org/docs/3149012/Narrative/ | verified | redFlagRefs/rf_focal, redFlagRefs/rf_vision |
| `AHA26` | Prabhakaran S, Gonzalez NR, Zachrison KS, et al. 2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke. Stroke. 2026;57(8):e316-e436. | https://doi.org/10.1161/STR.0000000000000513 | verified | redFlagRefs/rf_focal |
| `GRACE3-23` | Edlow JA, Carpenter C, Akhter M, et al. Guidelines for reasonable and appropriate care in the emergency department 3 (GRACE-3): Acute dizziness and vertigo in the emergency department. Acad Emerg Med. 2023;30(5):442-486. | https://doi.org/10.1111/acem.14728 | verified | redFlagRefs/rf_focal, checklist/dz1, examRows/14, examRows/15 |
| `IIH18` | Mollan SP, Davies B, Silver NC, et al. Idiopathic intracranial hypertension: consensus guidelines on management. J Neurol Neurosurg Psychiatry. 2018;89(10):1088-1100. | https://pmc.ncbi.nlm.nih.gov/articles/PMC6166610/ | verified | redFlagRefs/rf_vision, examRows/11 |
| `AFP-VISION25` | Fraser JA, Son M, Vinokurtseva A. Sudden Vision Loss: A Diagnostic Approach. Am Fam Physician. 2025;111(1):54-61. | https://www.aafp.org/afp/2025/0100/sudden-vision-loss | verified | redFlagRefs/rf_vision, redFlagRefs/rf_gca |
| `AFP-GCA22` | Raleigh MF, Stoddard J, Darrow HJ. Polymyalgia Rheumatica and Giant Cell Arteritis: Rapid Evidence Review. Am Fam Physician. 2022;106(4):420-426. | https://www.aafp.org/afp/2022/1000/polymyalgia-rheumatica-giant-cell-arteritis | verified | redFlagRefs/rf_gca, redFlagRefs/rf_new50 |
| `ACR-GCA21` | Maz M, Chung SA, Abril A, et al. 2021 American College of Rheumatology/Vasculitis Foundation Guideline for the Management of Giant Cell Arteritis and Takayasu Arteritis. Arthritis Rheumatol. 2021;73(8):1349-1365. | https://pmc.ncbi.nlm.nih.gov/articles/PMC12344528/ | verified | redFlagRefs/rf_gca |
| `ACR-SINO21` | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Sinonasal Disease (2021 Update). J Am Coll Radiol. 2022;19(5S):S175-S193. | https://acsearch.acr.org/docs/69502/Narrative/ | verified | redFlagRefs/rf_orbital, redFlagRefs/rf_mass |
| `AAO-SSNHL19` | Chandrasekhar SS, Tsai Do BS, Schwartz SR, et al. Clinical Practice Guideline: Sudden Hearing Loss (Update). Otolaryngol Head Neck Surg. 2019;161(1_suppl):S1-S45. | https://doi.org/10.1177/0194599819859885 | corrected | examRows/5 (no longer under rf_ssnhl: review round 1) |
| `AFP-HL19` | Michels TC, Duffy MT, Rogers DJ. Hearing Loss in Adults: Differential Diagnosis and Treatment. Am Fam Physician. 2019;100(2):98-108. | https://www.aafp.org/afp/2019/0715/p98 | verified | redFlagRefs/rf_ssnhl, redFlagRefs/rf_asym |
| `ACR-HLV18` | Expert Panel on Neurologic Imaging. ACR Appropriateness Criteria: Hearing Loss and/or Vertigo. J Am Coll Radiol. 2018;15(11S):S321-S331. | https://acsearch.acr.org/docs/69488/Narrative/ | verified | redFlagRefs/rf_ssnhl, redFlagRefs/rf_asym |
| `ACR-TINN23` | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Tinnitus (2023 Update). J Am Coll Radiol. 2023;20(11S):S574-S591. | https://acsearch.acr.org/docs/3094199/Narrative | verified | redFlagRefs/rf_asym, redFlagRefs/rf_pulsatile |
| `AFP-TINN21` | Dalrymple SN, Lewis SH, Philman S. Tinnitus: Diagnosis and Management. Am Fam Physician. 2021;103(11):663-671. | https://www.aafp.org/afp/2021/0601/p663 | verified | redFlagRefs/rf_asym, redFlagRefs/rf_pulsatile, checklist/dz4 |
| `AAO-TINN14` | Tunkel DE, Bauer CA, Sun GH, et al. Clinical Practice Guideline: Tinnitus. Otolaryngol Head Neck Surg. 2014;151(2 Suppl):S1-S40. | https://doi.org/10.1177/0194599814545325 | verified | redFlagRefs/rf_asym, checklist/dz4 |
| `NICE-CG150` | NICE. Headaches in over 12s: diagnosis and management (CG150). Published 2012-09-19; last updated 2025-06-03. | https://www.nice.org.uk/guidance/cg150/chapter/Recommendations | corrected | redFlagRefs/rf_progressive, redFlagRefs/rf_systemic |
| `SNNOOP10` | Do TP, Remmers A, Schytz HW, et al. Red and orange flags for secondary headaches in clinical practice: SNNOOP10 list. Neurology. 2019;92(3):134-144 (narrative review). | https://pmc.ncbi.nlm.nih.gov/articles/PMC6340385/ | corrected | redFlagRefs/rf_progressive |
| `ACR-CN22` | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Cranial Neuropathy (2022 Update). J Am Coll Radiol. 2022;19(11S):S266-S303. | https://acsearch.acr.org/docs/69509/Narrative | verified | redFlagRefs/rf_mass |
| `AFP-AR23` | Weaver-Agostoni J, Kosak Z, Bartlett S. Allergic Rhinitis: Rapid Evidence Review. Am Fam Physician. 2023;107(5):466-473. | https://www.aafp.org/afp/2023/0500/allergic-rhinitis | corrected | checklist/al1_si3, checklist/al2, checklist/al3, checklist/si2 |
| `AAO-AR15` | Seidman MD, Gurgel RK, Lin SY, et al. Clinical Practice Guideline: Allergic Rhinitis. Otolaryngol Head Neck Surg. 2015;152(1 Suppl):S1-S43. | https://doi.org/10.1177/0194599814561600 | verified | checklist/al1_si3, checklist/al2, checklist/al3 |
| `JTF-RHIN20` | Dykewicz MS, Wallace DV, Amrol DJ, et al. Rhinitis 2020: A practice parameter update. J Allergy Clin Immunol. 2020;146(4):721-767. | https://doi.org/10.1016/j.jaci.2020.07.007 | verified | checklist/al1_si3 |
| `ICAR-AR23` | Wise SK, et al. International consensus statement on allergy and rhinology: Allergic rhinitis – 2023. Int Forum Allergy Rhinol. 2023;13(4):293-859. Synopsis: J Allergy Clin Immunol Pract. 2023;11(3):773-796. | https://doi.org/10.1002/alr.23090 | verified | checklist/al1_si3, checklist/al2 |
| `AAO-SIN25` | Payne SC, McKenna M, Buckley J, et al. Clinical Practice Guideline: Adult Sinusitis Update. Otolaryngol Head Neck Surg. 2025;173 Suppl 1:S1-S56. | https://doi.org/10.1002/ohn.1344 | verified | checklist/al1_si3, checklist/si1, checklist/si2, checklist/si4, examRows/6 |
| `AFP-CRS23` | Keating MK, Phillips JC, Phillips J. Chronic Rhinosinusitis. Am Fam Physician. 2023;108(4):370-377. | https://www.aafp.org/afp/2023/1000/chronic-rhinosinusitis | corrected | checklist/al1_si3, checklist/si1, checklist/si2, checklist/si4, examRows/7 |
| `AAO-CRSSURG25` | Shin JJ, Wilson M, McKenna M, et al. Clinical Practice Guideline: Surgical Management of Chronic Rhinosinusitis. Otolaryngol Head Neck Surg. 2025;172 Suppl 2:S1-S47. | https://doi.org/10.1002/ohn.1287 | verified | checklist/si4 |
| `AAO-BPPV17` | Bhattacharyya N, Gubbels SP, Schwartz SR, et al. Clinical Practice Guideline: Benign Paroxysmal Positional Vertigo (Update). Otolaryngol Head Neck Surg. 2017;156(3_suppl):S1-S47. | https://doi.org/10.1177/0194599816689667 | verified | checklist/dz1, examRows/13 |

The stored citations differ from the content basis's short register in two ways. The generator
script checks every one against its verified or corrected record:

- The citations carry full titles from the verified records. For example, AFP-HL19 reads "Hearing
  Loss in Adults: Differential Diagnosis and Treatment".
- AHA26 links to its DOI (https://doi.org/10.1161/STR.0000000000000513), the verified register's
  own URL, where the basis register gave the PubMed record
  (https://pubmed.ncbi.nlm.nih.gov/41582814/) as a fallback for DOI-only sources. Until review
  round 3 the PubMed record was stored, the one exception to "every stored URL is the register's,
  exactly"; every other DOI-only source already stored its DOI. The publisher's pages return 403
  to automated checks, not to readers.

### Reuse terms: cite and link only

The note and the rubric store citation metadata and URLs, nothing else. No guideline text is
copied, pasted or paraphrased, and no agent, dose, threshold or duration is printed or stored. The
reasons:

- AAFP pages forbid copying or reproducing their content.
- entnet.org (AAO-HNSF) carries a "No External Use or Transfer (Including AI-Based Technologies)"
  clause.
- AAN material is copyrighted.
- A prototype must not make prescribing suggestions.

The labels are short therapy-class, exam or section names (facts), and must stay that way. The
treatment the clinician actually offered goes into the "offered today" placeholders. Anyone who
edits `emrTemplate` keeps to this rule. The validator can check a citation's shape (https URL,
title, publisher, accessed date) but not its truth or its terms of use.

### Decisions D1-D16 (signed off by the clinical lead on 2026-10-07, recorded in release 0.4.4)

The implementation spec resolved the open decisions of the content basis as below. The
implementation follows them. At release 0.4.3 none had been confirmed by the clinical lead. On
2026-10-07 the clinical lead signed off the EMR template content as implemented (the 0.4.4 entry
below), so each Status reads "signed off 2026-10-07 (0.4.4)". The lead items and options recorded
in the rows stand as implemented: the sign-off was one statement covering the content as
implemented, not an answer to each item (see "How it was given" in the 0.4.4 entry). The safety items of D3 (D3c) and D6 and the D14 quirk stay
recorded as known limitations, accepted at sign-off unless the lead asks for changes.

| # | Decision | As implemented | Status |
|---|---|---|---|
| D1 | Approve the new short labels (N), each with its citation keys | References, VM note, checklist and exam labels live in `emrTemplate` with citation keys; each entry's basis is in `EMR_DELTA.basis` and in `SOURCES.md`. Round 1 changed the reference labels (R14), the VM note (R14) and the AL3 and DZ4 labels (R8). Round 2 changed the DZ1 label to "Canalith repositioning (if positional vertigo)" (the treatment only, in words of the basis label; R18) and the SI4 label to "Antibiotic stewardship reviewed" (no presumed diagnosis; R19): both are explicit deviations from the content basis §4 labels. **Round 3:** AL3 is cut to the class name "Specific-IgE allergy testing (skin or serum)" (R34; its indication clause restated the AFP-AR23 recommendation) and SI1 reads "Objective sinus evaluation (rhinoscopy, endoscopy or CT)" (R33; a ticked "Objective confirmation of chronic rhinosinusitis" read as a diagnosis the screen does not make): both D1 deviations from the basis §4 labels. **Lead item (round 2, open for DZ4 only):** DZ4 keeps the basis's indication clause "(episodic vertigo with aural symptoms, or unilateral tinnitus)", which synthesises AFP-DIZZ23, AFP-TINN21 and AAO-TINN14. Approve it, or trim it to "Audiogram" | signed off 2026-10-07 (0.4.4), as implemented: DZ4 keeps the basis's indication clause; **confirmed by the clinical lead on 2026-10-10** ("Keep the clause", release 0.4.6) |
| D2 | Title = `fhir.documentTitle` + surface name | "MASQUE encounter note (draft) - MASQUE Screener" / "- MASQUE Scribe" | signed off 2026-10-07 (0.4.4) |
| D3 | Neuro referral = `referralGate` + `referralFor`, identical to the FHIR referral; fired recommendations printed verbatim; low band → "Referral: [clinician decision]"; red flag, unreviewed Scribe safety check, unscorable screen or rule error → the matching engine sentence | As stated; "Referral: [clinician decision]" also when the gate is open but the module has no referral table. **Safety item for the lead (D3c):** for the complaint "both" the plan reads "Referral: Headache medicine / Neurology — evaluate for mid-facial / migrainous cause" while the vestibular-migraine recommendation printed below it says "Refer neuro-otology / vestibular therapy." (Screener, sample "otologic" with complaint both). The template follows the module's referral table and does not resolve this. **Lead item (round 2):** for the otologic picture the referral goes to "Neuro-otology" (the module's referral table, identical to the FHIR ServiceRequest). In US practice neurotology is an otolaryngology subspecialty, while the request asked for "a referral to a neurologic specialist"; only the sinonasal and both pictures route to "Headache medicine / Neurology". The template cannot change it (the line must equal the bundle): confirm the destination, or make a versioned change to `phenotypes.referral`. **Round 3 (with D14):** on the Scribe the destination follows the derived complaint, so the Scribe phenotype quirk reaches the referral itself: an otologic patient with `m_head` "None" derives "both" and is referred to "Headache medicine / Neurology — evaluate for mid-facial / migrainous cause" while the vestibular-migraine recommendation names neuro-otology. The referral line stays the bundle's; a line under it now names its source (R29) | signed off 2026-10-07 (0.4.4), as implemented (the otologic destination "Neuro-otology" included); the D3c safety item stays a known limitation, accepted at sign-off. **Release 0.4.5:** the otologic and both destinations are replaced by the clinical lead's referral rule (2026-10-07 and 2026-10-09: Neurology for both pictures, nothing escalated automatically, since the clarification of 2026-10-09 rules out the Scribe probe as a record of true vertigo), and the note states the rule, its definition and its clarification above the recommendations; the destination in the D3c item is thereby the lead's. **Release 0.4.6:** under an open red flag the note's referral line no longer equals the bundle's: the bundle still issues none, while the note prints the screen-based referral (the referral of the same screen with the flags removed) under the heading "Screen-based referral and references (the FHIR bundle withholds the referral while a red flag is open):" (the lead's reading of "also", 2026-10-10; red-flag row) |
| D4 | Empiric-treatment references only while the referral gate is open (AFP-PROPH25, AAN26, AFP-ACUTE25, AFP-IHSACUTE26; AFP-DIZZ23 and the VM note for otologic or both) | As stated (`references[].showFor.phenotypes`) | signed off 2026-10-07 (0.4.4). **Release 0.4.6:** under an open red flag the references also print where the gate would open with the flags removed, under the screen-based heading (the lead's reading of "also", 2026-10-10; red-flag row); the FHIR bundle never carries them |
| Red flags | Per flag: module action and points, "Ref:" lines, the workup placeholder, the tier line; referral and references withheld; checklist kept | As stated; bullets are "- " (D11). **The reading of "also" (round 2, for the user and the lead):** the request says that with red flags the imaging, labs or referral "should be indicated in the plan also". The template prints the workup and, while any flag is open, withholds the neurologic referral and the empiric-treatment references, as the FHIR routing override does (gate, don't warn). This is a deliberate reading; the other reading (workup plus referral plus references) would print routing the bundle withholds | signed off 2026-10-07 (0.4.4): the reading as implemented. **Release 0.4.6: the other reading, chosen by the clinical lead on 2026-10-10** ("Workup + referral + references"): under the workup the note also prints the screen-based referral block and the references, under a heading saying that the FHIR bundle withholds the referral; the bundle is unchanged |
| D5 | Module action and Ref only; no cited additions (labs, timings) | As stated | signed off 2026-10-07 (0.4.4) |
| D6 | No plan line for a central HINTS pattern | HINTS appears as an exam row only. **Safety item for the lead:** with the Scribe's head-impulse probe answered "Normal impulse (points central)" and the gate open, the exam row reads "Head impulse / nystagmus / test of skew (HINTS) (sources 1, 7): [ ] (recorded by clinician via probe: Normal impulse (points central); HINTS: normal head impulse — central pattern)" and the plan still opens "Referral: Neuro-otology — evaluate for vestibular migraine" with the empiric-treatment references; nothing in the plan responds to the finding. A plan response would need a versioned instrument change (a flag), not template text. **Option for the lead (round 2):** without new clinical text, the data could add a placeholder under the HINTS exam row when that probe option is recorded (for example "[clinician interpretation of HINTS and any imaging decision]", keyed by probe and option in `emrTemplate`, so the engine stays id-free), or a cited qualifier in the exam-row label (GRACE3-23, AFP-DIZZ23) approved under D1. **Round 3 (residual risk, raised again):** a verifier reported the same finding: a recorded central pattern sits next to a routine referral and the empiric references, while the probe's own `why` reads "the opposite of reassuring" and GRACE-3 / ACR support imaging for a central pattern. Two further options within the rules: a versioned instrument change that raises a flag for that option, or a lead-approved display of the probe's `why` (module text, M) next to that recorded option only. Not implemented: D6 resolves "no HINTS plan line" | signed off 2026-10-07 (0.4.4); the central HINTS pattern with no plan response stays a residual risk, accepted at sign-off (none of the options above is implemented). **Release 0.4.6: the clinical lead chose the round 2 placeholder on 2026-10-10** ("Add a clinician line"): "[clinician interpretation of HINTS and any imaging decision]" under the HINTS row when the Scribe records "Normal impulse (points central)" (`examRows[14].optionPlaceholders`); still no flag and no plan line |
| D7 | Checklist: all three groups, core items (AL1 merged with SI3, AL2, AL3, SI1, SI2, SI4, DZ1, DZ2, DZ3, DZ4), status words as in the basis | Ten rows; shown in **every** state (see the implementation choices below). **Amended in round 1, awaiting the lead:** the heading stays verbatim and a key line follows it ("Key: ticked = recorded as done; unticked = not recorded (not confirmed as not offered)."), because under a "not yet offered" heading an unknown row read as negative and a ticked box was ambiguous; SI4 is a status line without a box, as the basis asks (R6, R7). Round 2: SI4 prints only when its `r_abx` signal holds (`onlyWithSignal`, R19). **Lead item (I3, round 2):** with `rf_systemic` ("Directed workup before symptomatic management") or `rf_orbital` ("Emergency ENT and imaging") open, the symptomatic-therapy rows follow the workup lines; the spec kept the checklist ("history, not routing"). Confirm I3, or withhold the checklist under any red flag (one condition in `engine/emr.js`) or under an emergent one only. **Lead item (round 3):** the checklist is also shown while the Scribe's safety review is not recorded, which the content basis §1 table lists as "Withheld (D7)"; the spec is silent on that state and I3 keeps it (management history, not routing). Confirm, or withhold it there too. **Round 4:** SI1 is also ticked by the clear scan the clinician recorded on the Scribe (`pr_scan_detail` "Genuinely clear", R45), and its `r_normal` context reads "(context only; modality not recorded)" (R46) | signed off 2026-10-07 (0.4.4), as implemented (I3: the checklist in every state); **confirmed by the clinical lead** (release 0.4.5): under an open red flag (I3, round 2) on 2026-10-07, and while the Scribe's safety review is not recorded (round 3) and on an unscorable screen, on 2026-10-09 ("regardless … the user should be able to see progress": every state) |
| D8 | Allergy placeholders "Drug allergies — agent and reaction: [ ]" and "Environmental / inhalant allergies; prior allergy testing — date, result: [ ]"; checklist covers inhalant / allergic-rhinitis management; AL5 omitted | As stated | signed off 2026-10-07 (0.4.4) |
| D9 | No crosswalk from `i_days` / `i_role` to prevention thresholds | None | signed off 2026-10-07 (0.4.4) |
| D10 | `CAVEATS.illustrative` inline after the index; `copy.note.signOff` at sign-off | As stated | signed off 2026-10-07 (0.4.4) |
| D11 | Module text verbatim (≥ – — Bárány); generated structure ASCII ("-", ":", "\|"); document the legacy-EMR paste risk | As stated; the risk is in the `emr.js` header and under the known risks below | signed off 2026-10-07 (0.4.4) |
| D12 | Date of service is a placeholder | "Date of service: [date]" | signed off 2026-10-07 (0.4.4) |
| D13 | Include "Pregnancy status / childbearing potential: [ ]" | Included. Since round 3 the optional acute-medication row is included too, verbatim from the basis §2.6, "Acute headache medication use — days per month, by class: [ ]" (no number printed): an `emrTemplate.history` label row (data, because the engine names no condition), the last treatment-to-date row (R39). The optional modifying-conditions row is left out | signed off 2026-10-07 (0.4.4). **Release 0.4.6:** the clinical lead added the modifying-conditions row back on 2026-10-10, in the wording the lead approved ("Modifying conditions (asthma, cystic fibrosis, immunocompromise, aspirin-exacerbated respiratory disease, ciliary dyskinesia): [ ]", `emrTemplate.pastHistory`, after the pregnancy line) |
| D14 | Accept the Scribe phenotype quirk and document it | **Changed in round 1 (R1):** the presenting picture no longer prints it as a finding. The Scribe prints `Presenting picture: [ ]`, with "(screen phenotype by module rule: <picture>; confirm)" only when a derive rule fired; quirk under the known risks below. **Restated in round 3 (R29):** the content basis said the quirk only "changes which references show". It also sets the referral destination (D3c: "both" goes to Headache medicine / Neurology), identically in the FHIR ServiceRequest. Example: `m_head` "None", every vestibular item positive, no antibiotic or surgery history: the Scribe derives "both" and refers an otologic patient with no headache for a "mid-facial / migrainous cause". The referral line stays byte-equal to the bundle; on the Scribe a line under it says where the destination came from ("(destination from the screen phenotype by module rule: Both - Mixed sinonasal and otologic; confirm)"). The real fix is a versioned `masque.logic.js` derive change (`sin` needing `m_head` > 0, `oto` needing `v_vertigo` > 0), which this release may not make | signed off 2026-10-07 (0.4.4); the quirk stays a known limitation, accepted at sign-off (its fix is a versioned logic change). **Release 0.4.5:** a `both` the quirk derives is a dizziness case like `otologic` (Neurology, with the lead's rule printed; known risk 12) |
| D15 | Cite both AFP 2025 prophylaxis and AAN/AHS 2026 | Both printed; since round 1 AAN/AHS 2026 comes first and the AFP row is labelled "American Family Physician (AAFP journal), 2025; predates AAN/AHS 2026" (R14) | signed off 2026-10-07 (0.4.4) |
| D16 | On the Scribe, annotate each red-flag line with its capture source | "Source: heard in encounter." (the app's existing wording) / "Source: marked by clinician." / `Source: from <probe kind> probe.` | signed off 2026-10-07 (0.4.4) |

**Implementation choices for the lead to confirm** (confirmed as implemented by the sign-off of
2026-10-07, release 0.4.4; I3 confirmed by the lead on 2026-10-07 and 2026-10-09 and I5 answered on
2026-10-10, release 0.4.5 and 0.4.6; **I1, I2, I4, I6, I7 and I8 confirmed by the lead on
2026-10-11**, release 0.4.6). These go beyond, or differ from, the spec:

- I1: The block has a `history` key (rows `{item}` or `{label}`) for the "treatment and workup to
  date" lines, because the engine may not name item ids. There is no separate `vestibularNote`
  key: the VM line is a `references` row with `note` in place of `label`.
- I2: Bullets are "- ", not "•" (D11). The verbatim engine sentences and the spec's verbatim
  headings and placeholders keep their em dashes.
- I3: The checklist shows in every state, including the Scribe's unreviewed-safety state and an
  unscorable screen. The spec states this only for red flags; its reason ("it documents management
  history, it does not route") applies to every state. The content basis had withheld it. Under an
  open `rf_systemic` this places symptomatic-therapy rows after "Directed workup before symptomatic
  management"; round 2 records that as a lead item (D7).
- I4 (superseded in round 1, R9, and again in round 3, R38): checklist and exam-row citations
  were kept in the data but not printed. Round 1 listed them once each under the checklist and
  the exam; since round 3 they share one numbered list after the plan.
- I5: Left out to keep the note tight:
  - the optional D13 modifying-conditions row (the acute-medication row is included since
    round 3, R39);
  - the family-history-of-migraine line (it appears in the review of systems; "Family history:
    [ ]" remains);
  - an Assessment "Considerations:" line (the recommendations are in the plan);
  - scale-item lines in the HPI (they appear in the review of systems).

  **Release 0.4.6:** on 2026-10-10 the clinical lead added back the first three: the
  modifying-conditions row, the family-history-of-migraine line (with "Other family history: [ ]"
  under it; the item leaves the review of systems) and the Assessment "Considerations:" line. The
  scale-item HPI lines stay out.

  Items listed under treatment and workup are not repeated in the review of systems. The "Not
  answered" count still covers every item.
- I6: A Scribe exam probe the clinician answered keeps its placeholder:
  `<label>: [ ] (recorded by clinician via probe: <option>; <note>)`. A probe answer is never
  presented as a documented finding. A deferred exam probe therefore reads
  `<label>: [ ] (recorded by clinician via probe: Deferred)`: the placeholder stays open and the
  module's option label says it was deferred. The engine cannot tell "Deferred" from "Normal"
  (neither writes a note or a flag) without naming option labels, so it does not reword it to the
  basis's `[ ] (deferred)` (round 1: kept, see the rejected findings).
- I7: Some engine headings are worded differently from the basis, so that they carry no condition
  words and can live in the engine:
  - "Empiric treatment references (for use before specialist review):";
  - "Acute (abortive) treatment offered today";
  - "Preventive treatment offered today";
  - "Lifestyle / non-drug measures discussed".
- I8 (changed in round 1, R13): the Scribe version line now carries the gold set as its own
  field, "gold set 0.3.0" (with "(lexicon x)" when it was benchmarked on another lexicon, and
  "gold set not benchmarked" without one). The instruction line has the second sentence about
  rebuilding.

**Review round 1 (6 October 2026), all awaiting the lead until the sign-off of 2026-10-07 (0.4.4).**
Three independent verifiers reviewed
the release; the fixer changed the following. None adds a clinical sentence: every new line is a
placeholder, a structural label, module text or a verified citation.

- R1: Scribe presenting picture: a placeholder, plus the module rule's category only when a derive
  rule fired. Before, an empty encounter printed the default picture "Sinonasal - …" as "derived
  from captured answers", and `m_head` "None" with vertigo printed "Both - …".
- R2: Identity: the synthetic demo patient is never copied into the text.
- R3: Chips: "Instruments:" only for `emrTemplate.instrumentRecs` (sinus_migraine,
  vestibular_migraine, tinnitus); other fixed chips "Named on screen:"; computed chips (the
  competing-findings rule's item texts cut at 46 characters) not repeated. This departs from spec
  rule 4, which put every chip list under "Instruments:".
- R4: Red-flag references: AAO-SSNHL19 removed from `rf_ssnhl` (it gives audiometry within 14
  days, not same-day) and AFP-ARS25 from `rf_orbital` (dropped from the register). One structural
  line above the actions says Ref lines are background reading, not the source of an action or
  its timing.
- R5: `rf_systemic` prints "[directed workup — specify]" (`redFlagPlaceholders`; content basis §3).
- R6: The checklist key line (D7 amendment).
- R7: SI4 is a status line without a box. The module's own sentence "Reassess before further
  antibiotics, steroids, or sinus surgery." is not attached to it: the engine would have to read a
  routing recommendation's text by id, and that recommendation already prints in the plan when it
  fires.
- R8: Checklist wording as the basis gives it: AL3 "… if empiric treatment fails or diagnosis
  uncertain" with "[date / result]"; DZ4 "(episodic vertigo with aural symptoms, or unilateral
  tinnitus)"; the `r_abx` signals qualified "agent/route not recorded"; a probe answer in the
  checklist reads "recorded by clinician via probe", never "recorded on screen".
- R9: Checklist and exam-row sources printed (supersedes I4).
- R10: `CAVEATS.illustrative` on the assessment's band headline ("Screen: …") and after the
  referral reason, which stays byte-equal to the bundle.
- R11: Probe notes split by kind (supporting notes keep the module footer; notes of writing kinds
  do not get it).
- R12: Treatment and workup: an item a probe wrote carries the probe's option label; the
  migraine-trial row echoes the Scribe's recorded treatment-trial answer; "Not asked" became "Not
  answered" (unsure answers were asked).
- R13: The Scribe footer's gold-set axis (supersedes I8).
- R14: References: AAN/AHS 2026 first; AFP rows labelled "American Family Physician (AAFP
  journal), <year>", the 2025 prophylaxis row "predates AAN/AHS 2026"; the VM note says "low or
  very-low certainty", as the two Cochrane reviews rate it.
- R15: V61 also checks the new keys and fields, that an exam row names an exam-kind probe, and
  square brackets in info-prompt tags, probe questions, options and notes and routing copy; the
  editor's flag deletion also removes the flag's workup placeholder.

Findings the fixer did not act on, with the reason:

- A deferred exam probe as `[ ] (deferred)`: kept as I6 says (no option-label words in the engine;
  the placeholder stays open and the label is the module's own).
- On the Screener, an inline "audiometry dates/results: [ ]" after `x_lowfreq` "answered no": the
  same section already carries "Audiograms / vestibular testing — dates, results: [ ]".
- The AHA26 DOI: the PubMed link stays (see above), recorded in `SOURCES.md` (superseded in
  round 3, R36: the register's DOI is now stored).
- The Bárány criterion labels (risk 14) and the D3c and D6 safety items: they need the lead, and
  the module text may not be reworded here.

**Review round 2 (7 October 2026), all awaiting the lead until the sign-off of 2026-10-07 (0.4.4).**
Three independent verifiers reviewed
the round-1 tree. The fixer changed the following. None adds a clinical sentence: every new string
is a structural label, a qualifier (S) or a label cut down to words of its content-basis label.

- R16: V61 checks each item signal's polarity: `done` and `note` print the item's positive
  wording, so they need a positive answer; `answeredNo` needs a negative one ("no", or a scale
  option with f 0); `neverTried` comes from a probe answer only (all E). The engine skips any
  signal that contradicts its render, so data that bypassed validation still fails closed: an
  uploaded module can no longer print a "no" as "[x] … recorded on screen: <positive wording>".
  One mutation fixture per case.
- R17: V61 reports an `instrumentRecs` rule whose chips are computed (or not a list of strings) on
  any surface it has copy for (E). The engine tests computed chips before `instrumentRecs`, so a
  bad list can never print cut item text under "Instruments:".
- R18: DZ1 reads "Canalith repositioning (if positional vertigo)" (was "Dix–Hallpike test /
  canalith repositioning (if positional vertigo)"). The test is its own exam row; a recorded
  Dix–Hallpike result printed next to "not recorded" read as if the test were undocumented. A
  probe's context note reads "recorded by clinician via probe (context only): …", parallel to
  "screen records (context only): …". A D1 deviation from content basis §4 DZ1 (a subset of its
  words; keys AAO-BPPV17, AFP-DIZZ23, GRACE3-23 unchanged).
- R19: SI4 prints only when `r_abx` is "yes" (new optional row field `onlyWithSignal`: V61 E when
  not a boolean, W when the row has no signals), as the basis §4 rendering column gives it
  ("r_abx = yes → print"). Its label is "Antibiotic stewardship reviewed": "(chronic
  rhinosinusitis)" presumed a diagnosis the screen never makes and printed for every patient. A D1
  deviation from the basis §4 SI4 label, whose wording restates AAO-SIN25 KAS 14; keys AAO-SIN25
  (KAS 14), AFP-CRS23, AAO-CRSSURG25 (KAS 3) unchanged.
- R20: A history item row may carry a `qualifier`, printed after a negative answer that no probe
  wrote. `x_lowfreq` and `x_objective` carry "testing not recorded" (basis §2.5: "no" does not mean
  an audiogram was done; risk 6). On the Scribe the probe's own option label still takes its place
  ("Stable, or never tested twice"; "Genuinely clear").
- R21: History rows no longer take `citations` (V61 E). The template never printed them, so a
  citation used only there passed "every citation is used" without reaching the note. Removed from
  the typedef, the extractor's used-keys count and the authoring table (no MASQUE row had any).
- R22: Review of systems: an item a Scribe probe wrote carries the probe's recorded answer, as the
  treatment rows already did and as the `emr.js` header said.
- R23: The exam and checklist rows name their own sources by number after the label ("(sources 1,
  3)"; parentheses, since square brackets are placeholders), and both source lists are numbered.
  A row `onlyWithSignal` hides contributes no source.
- R24: The Scribe's instruction sentence names the encounter (`EMR_UI.regeneratesScribe`). The
  plan's "Screening routing withheld — red flag present" is recorded as the Screener bundle's
  routing-override wording, printed on both surfaces as the content basis (§1, §2.10b) gives it;
  the Scribe bundle has no such component, and neither bundle issues a referral under a flag.
- R25: ASSESSMENT no longer lists "Criteria items recorded on screen" (risk 14). The `emr` suite
  checks in every template that no item `ref` and no scale item's `patientClin` is printed.
- R26: Records and tests: the fuzz coverage wording below now matches `02-app-divergences.md`
  (the fuzz draws flag, unscorable, closed and open, the Scribe also unreviewed; the named
  18-state matrix adds the rule-error states); the `values` suite checks exactly one basis per
  EMR-delta entry, as the extractor does.

Recorded for the lead in round 2, not changed (each needs a clinical decision, or the spec already
decided it; at the sign-off of 2026-10-07 each stands as implemented, and the D6 item stays a
residual risk, accepted at sign-off):

- A placeholder under a recorded central HINTS pattern (D6 option above).
- The checklist under an open emergent or `rf_systemic` flag (I3, D7 above).
- The AL3 and DZ4 indication clauses (D1 above).
- The otologic referral destination "Neuro-otology" (D3 above).
- The reading of "also" under a red flag (red-flag row above, and the release note below).

**Review round 3 (7 October 2026), all awaiting the lead until the sign-off of 2026-10-07 (0.4.4).**
Three independent verifiers reviewed
the round-2 tree. The fixer changed the following. None adds a clinical sentence: every new string
is a structural label (S), a qualifier, an existing engine sentence (E), a placeholder heading
from the content basis (P) or a label cut down from its basis label (N, D1).

- R27: Checklist: an item answer a Scribe probe wrote reads "recorded by clinician via probe"
  ("recorded by clinician via probe, answered no" for an answered-no signal), with the probe's
  answer in parentheses after the item wording, as the history rows already did. Before, the same
  fact had two sources in one note: "Audiometric fluctuating low-frequency SNHL: yes (recorded by
  clinician via probe: Yes, it fluctuates)" under treatment and workup, "recorded on screen" in
  the checklist (contradicting R8 and the engine's own comment).
- R28: Gap line: the module's `copy.note.gapLine`, "Diagnostic-gap pattern flagged (repeat visits
  + prior dismissal).", prints only when every gap marker hit. The rule fires on two of three, so
  with `c_dismiss` "No" the note printed "Previously told it was anxiety / stress, or “nothing
  wrong”: No" and, on the next line, "(repeat visits + prior dismissal)". When the rule fires on
  fewer markers the encounter note's own context line prints instead (E, `engine/scribe.js`
  L295/L312), for example "Context: duration >12 months; seen by 3+ clinicians.". **Lead item:**
  the module's `gapLine` and `copy.screener.gapAlert.body` ("This pattern of repeated visits and
  prior dismissal …") name both markers while the rule fires on any two; a module-copy issue the
  engine may not reword.
- R29: Scribe referral destination (D14 restated, D3c): a structural line under the bundle's
  referral and index label says which computed picture the destination follows: "(destination
  from the screen phenotype by module rule: <picture>; confirm)", "(destination from the module's
  default phenotype: <picture>; confirm)" when no derive rule fired, else "(destination from the
  screen phenotype: <picture>; confirm)". The referral line itself stays byte-equal to the bundle.
  The Screener prints none (the clinician picked the picture).
- R30: Under open flags on the Scribe, while the review is not recorded, SCREEN RESULT adds the
  encounter note's "NOT YET REVIEWED — no routing issued. Complete the red-flag review before
  signing." after the flag lines (E). The flags listed are the ones raised, the other flags were
  never confirmed absent, and the Scribe's own sign button already says the note states the
  review is outstanding. `buildNote` prints only the flags here; the lead may prefer that (one
  condition in `engine/emr.js`).
- R31: Domains: "Neuropathic not answered" for a domain with nothing answered, and "Otologic /
  vestibular 4/25 (1 of 6 items answered)" for a partly answered one (S annotations of the E
  sentence). The encounter note's "Neuropathic 0/15" rendered absent data as zero points. A fully
  answered screen prints the E line unchanged.
- R32: History qualifiers "workup not recorded" on `r_normal` and `r_lesion` (S): "Recurrent
  dizziness/aural symptoms, no structural lesion found: answered no" could read as a lesion found,
  and the exam-or-imaging row as an abnormal workup. As for R20, a probe's own answer takes the
  qualifier's place.
- R33: SI1 reads "Objective sinus evaluation (rhinoscopy, endoscopy or CT)" (was "Objective
  confirmation of chronic rhinosinusitis (rhinoscopy, endoscopy or CT)"). Ticked by `x_objective`
  ("Objective sinus inflammation on endoscopy/CT when symptomatic"), it read as a confirmed
  diagnosis, which also needs the symptom criteria. A D1 deviation from the basis §4 SI1 label;
  keys AAO-SIN25 (KAS 7B) and AFP-CRS23 unchanged.
- R34: AL3 reads "Specific-IgE allergy testing (skin or serum)" with "[date / result]" (was "… if
  empiric treatment fails or diagnosis uncertain"). The clause restated the AFP-AR23
  recommendation (reuse terms, risk 1), the kind of wording round 2 removed from SI4; the linked
  sources carry the indication. Words of the basis §4 AL3 label (a D1 deviation); keys AFP-AR23,
  AAO-AR15 unchanged. This settles the round-2 lead item for AL3; DZ4 stays open (D1).
- R35: `rf_ssnhl`: the basis text now says why AAO-SSNHL19 is not under "Same-day audiogram"
  (content basis §3: do not attribute same-day to AAO-HNSF) and that AFP-HL19, which stays, does
  not give same-day either (audiometry plus otolaryngology within one week); it is kept, like
  every Ref line, only under the line saying Ref lines are not the source of an action or its
  timing. The lead should choose one rule for both sources (records only; the rubric is
  unchanged by this).
- R36: AHA26 stores the verified register's DOI URL (was the PubMed record), so every stored URL
  is the register's, exactly (see the citation register above).
- R37: The review of systems is headed "REVIEW OF SYSTEMS (screen items, as answered; not today's
  examination)": items such as "Deep ear or throat pain with normal ear exam" are the patient's
  screen answers, not a documented examination. Module text unchanged.
- R38: One numbered list, "REFERENCES (cited by number in the exam rows and checklist)", after the
  plan and before the sign-off, replaces round 2's "Exam row sources:" (inside PHYSICAL EXAM) and
  "Checklist sources:" (in the plan); the rows keep their "(sources n)" marks, one numbering by
  first use, so a key is listed once (AFP-DIZZ23 was source 1 in the exam and source 9 in the
  checklist).
- R39: The optional D13 placeholder "Acute headache medication use — days per month, by class:
  [ ]" (basis §2.6, verbatim; AAN26 rec. 12A/B, AFP-IHSACUTE26; no number printed), as the last
  `emrTemplate.history` row.
- R40: Records corrected: I5 says "Not answered" (R12); the D6 example carries "(sources 1, 7)"
  (R23); `03-design.md` E2 no longer says `history` replaces `vestibularNote`; the deploy-list
  pointer in `02-app-divergences.md` points up.
- R41: Tests: the `emr` oracle tests computed chips before `instrumentRecs`, as the engine does
  (R17), and the computed-listed fixture now runs through the whole oracle; the oracle mirrors
  R27-R39, with traps for each. The `omissions` suite no longer depends on timing: it failed in a
  full run in a background tab (24 diffs, all in the derived module's Spanish walk) and passed
  alone. Reproduced: alone in a background tab it failed the same way, because the Companion's
  locale and dirty reports reach the shell in a later task that a hidden tab delays by about a
  second, and the suite checked after a fixed `sleep(0)`. It now drains the scheduler's
  posted-message queue and waits for the expected state (up to 10 s) after each walk.

Recorded for the lead in round 3, not changed (at the sign-off of 2026-10-07 each stands as
implemented; the prompt labels, D6, the gap wording and D14 stay known limitations or follow-ups,
accepted at sign-off):

- **Item-prompt answers on the Scribe carry no capture label** (optional finding). Items the
  clinician answered by clicking an item prompt print like any screen answer, while probe-written
  items say "recorded by clinician via probe". The spec requires labels for probe results only;
  an item-prompt answer is still the patient's screen answer, and labelling it would need new
  state passed to the engine (the Scribe's `asked` map) and a lead-approved label such as "(asked
  by clinician)". Not changed.
- The checklist while the Scribe's safety review is not recorded (D7, I3).
- A recorded central HINTS pattern (D6, residual risk raised again).
- The module's `gapLine` and `gapAlert.body` wording (R28) and the Scribe derive rule behind D14
  (R29): versioned module changes.
- The DZ4 indication clause (D1) and one rule for the `rf_ssnhl` Ref lines (R35).

**Review round 4 (7 October 2026), all awaiting the lead until the sign-off of 2026-10-07 (0.4.4).**
Six minor fixes to the round-3 tree.
None adds a clinical sentence: the new strings are a qualifier (S), the module's own probe option
label (M) printed by an existing rule, and a longer panel instruction (chrome).

- R42: V61 warns on a field the engine never reads, on every row kind: "unknown <kind> field
  "<key>" (it is never read)" (W) for keys outside references `label`, `note`, `citations`,
  `showFor`; history `item`, `qualifier`, `label`, `probe`; checklist `id`, `group`, `label`,
  `citations`, `placeholder`, `box`, `onlyWithSignal`, `signals`; item signals `item`, `value`,
  `render`, `qualifier`; probe signals `probe`, `option`, `render`, `qualifier`; exam rows `label`,
  `citations`, `probe` (checked against what `engine/emr.js` reads; a checklist `id` is the
  validator's). A history row's `citations` keeps its own error and is not reported twice. One
  mutation fixture per row kind; the `validate` suite also checks each message. MASQUE raises none.
- R43: Tests: `render-screener` and `render-scribe` attach the panel off screen, wait for the
  frame's textarea to load, type a marker line after the template, and check that Copy (stubbed
  clipboard) and Download (the saved blob) take the edited text; leaving the view (the Screener's
  Back, the Scribe's Ask next) and coming back remounts the frame with the generated text. Until
  now both suites checked Copy and Download only on a detached frame, which falls back to the
  generated text.
- R44: Records: the stewardship example prints "(sources 3, 4, 12)" (it said "(sources 5, 6, 7)",
  the round-2 numbering); the round-1 AHA26 line is marked superseded by R36. The other "(sources
  n)" examples were checked against the engine and match.
- R45: SI1 ("Objective sinus evaluation (rhinoscopy, endoscopy or CT)") gains a first signal, the
  Scribe's rule-out probe `pr_scan_detail` option 1, "Genuinely clear", rendered done: a clear scan
  the clinician recorded is an evaluation done, so the row reads "[x] … - recorded by clinician via
  probe: Genuinely clear", followed by the item's answered no that the probe wrote. Before, the row
  read "[ ] … - not recorded" next to that recorded clear scan. The other option ("Real inflammation
  reported") already ticked it through `x_objective` "yes". A screen answer alone never ticks it,
  and the Screener runs no probes. Option index checked against `masque.logic.js`.
- R46: The `r_normal` note on SI1 carries the qualifier "modality not recorded": "screen records
  (context only; modality not recorded): Exam or imaging normal relative to symptom burden". The
  item says an exam or imaging study was normal, not which (basis §2.5).
- R47: The panel instruction says that leaving the view discards edits too: "… The text is rebuilt
  whenever the screen changes or you leave this view, which discards edits made here." (the
  Scribe: "whenever the encounter changes or you leave this view"). The panel unmounts with the
  Screener's result view and the Scribe's Note view, so an edit was lost there without warning.

### Known limits and risks

What the template cannot source, so it leaves a placeholder:

- Patient facts: allergies of any kind, medications, past, social and family history (other than
  the screen's migraine item), vitals, date of birth, dates.
- Every examination finding. Only the headings are sourced, apart from Scribe exam probes the
  clinician answered.
- Specific empiric agents, doses, durations and starting thresholds. The sources exist but may
  not be copied, and printing them would be prescribing in a prototype.
- A vestibular-migraine treatment guideline. None exists, and AAO-HNSF lists one as in
  development. The VM line is labelled empiric.
- Elective referral thresholds for neurology, headache medicine or neuro-otology beyond the
  module's own `referralGate` and `phenotypes.referral`. No verified source sets them, so the
  referral line carries no citation.
- Labs for every flag except the inflammatory-marker flags. "Directed workup" stays the module's
  wording, and `rf_systemic` adds the placeholder "[directed workup — specify]" (round 1).
- The urgency of a non-red-flag referral (the bundle says "routine"; no clinical source supports
  it), the follow-up interval, and the primary-care framing. The module's documented setting is
  the ENT encounter, and it never says who refers whom.

Risks:

1. **Reuse terms.** See above. Any future edit that pastes guideline wording breaks AAFP, AAO-HNSF
   or AAN terms.
2. **Paywalls and blocked access.**
   - Several full texts are paywalled: AFP 2025 prophylaxis (abstract and SORT open), AFP 2025
     acute rhinosinusitis, AFP 2025 sudden vision loss.
   - Wiley, neurology.org and ahajournals pages refuse automated access.
   - The AAO-HNSF 2025 sinusitis key-action statements were read from a secondary summary.
3. **Currency.**
   - AFP 2025 prophylaxis predates AAN/AHS 2026.
   - Some guidelines are current but old: AAO-HNSF allergic rhinitis 2015, BPPV 2017 and tinnitus
     2014 (update in development); ACR hearing loss and/or vertigo 2018.
   - NICE CG150's management section is being updated.
   - Lasmiditan is unavailable after 31 May 2026, so no ditan is ever named.
   - Every citation needs re-verification each release. Its `accessed` date says when it was last
     checked.
4. **Source conflicts the note does not resolve.**
   - The thunderclap lumbar-puncture rule (AFP 2022 vs ACEP 2019).
   - Rimegepant (AHS 2024 vs AAN/AHS 2026).
   - Acute rhinosinusitis antibiotic timing (AFP 2025 vs AAO-HNSF 2025).
   - SNNOOP10's age 65 vs the module's 50.
   - AAO-HNSF sudden hearing loss "within 14 days" vs the module's "Same-day audiogram". The
     module text stays, unattributed. Resolved in round 1: `rf_ssnhl` no longer cites
     AAO-SSNHL19 (its Refs are AFP-HL19 and ACR-HLV18), and a structural line says Ref lines are
     not the source of an action or its timing. The lead may restore it with that caveat. Round 3
     (R35): AFP-HL19 gives one week, not same-day, either; it stays only under that line, and the
     lead should apply one rule to both.
5. **Clinical safety and liability.**
   - A prototype note pasted into a real EMR. The marker is the first and last line of the text,
     but a clinician can delete it.
   - Edits in the box are neither saved nor checked, and a change to the screen, or leaving the
     panel's view, rebuilds the text and discards them (the instruction line says both since
     round 4).
   - No normal finding is pre-filled, and probe results are labelled as recorded by the clinician.
6. **Absent vs negative.** Each trap is handled and is to be pinned by the test package:
   - `x_lowfreq` "no" does not prove an audiogram was done (only "yes" ticks the audiogram row;
     since round 2 a "no" no probe wrote reads "answered no (testing not recorded)", as does the
     endoscopy/CT item);
   - `r_abx` does not prove an intranasal steroid trial (context only);
   - "unsure" counts as unanswered;
   - "Never tried" lives only in the probe answers;
   - a deferred exam probe is not normal.
7. **Brackets.** Square brackets mean "fill me in", so routing chips never sit in brackets
   ("Instruments: a; b" or "Named on screen: a; b"). V61 errors on `[ ] { }` in `emrTemplate` and
   warns on square brackets in the module and logic strings the template prints.
8. **`patientClin` on scale items** embeds a qualifying value. The template prints `short (option)`
   for scale items and, since round 2 (no criteria list), never prints a scale item's
   `patientClin`; the `emr` suite checks this in every template.
9. **HINTS reliability** depends on training. The result is shown as recorded by the clinician,
   never as interpreted by the app.
10. **Characters (D11).** Module text keeps ≥, en and em dashes and "Bárány". Some legacy EMRs
    mangle non-ASCII characters on paste. Module text is never ASCII-folded.
11. **"Instruments:" label (resolved in round 1, R3).** It now heads only the chips of the
    recommendations `instrumentRecs` lists. The neuropathic overlay's chips read "Named on
    screen:" (its Screener list includes the referral "Neurology"), and the competing-findings
    chips, which the rule cuts from rule-out item text, are not repeated. The lead should confirm
    the list.
12. **Scribe phenotype quirk (D14).** The Scribe derives the complaint with the baseline rule:
    `m_head` "None" sets sinonasal and `v_vertigo` 0 sets otologic, which changes which
    references show and the referral destination (D3c; the FHIR ServiceRequest carries the same
    specialty), and an encounter where no rule fires falls back to the default picture. Since
    round 1 the presenting picture is a placeholder, with the rule's category to confirm only when
    a rule fired, so neither the fallback nor a rule firing on a denied answer reads as a finding.
    Since round 3 (R29) a line under an open Scribe referral says which computed picture its
    destination follows, to confirm. The reference selection and the destination still follow
    the derived complaint; fixing the rule is a versioned logic change for the lead. Accepted at
    sign-off (2026-10-07, release 0.4.4) as a known limitation. **Release 0.4.5:** `otologic` and
    `both` are both dizziness cases (the lead, 2026-10-07 and 2026-10-09), so an otologic patient
    whom the quirk derives as `both` is now referred to Neurology with the lead's rule printed, as
    `otologic` is; the quirk still sets the reason ("mid-facial / migrainous cause" for `both`) and
    the references, and its fix is still a versioned logic change.
13. **Not checked visually.** The panel was checked through the DOM, not by eye. The 375 px
    no-horizontal-scroll check was not run (the iframe is `width:100%`, `box-sizing:border-box`).
    The cloud Playwright specs were not run (no Node on this machine).
14. **Bárány criterion labels (upstream, for the lead; open).** Until round 2 ASSESSMENT listed
    "Criteria items recorded on screen" with each item's own text and `ref`, for example "Episodic
    vertigo 5 min – 72 h (Bárány VM B) - Bárány VM criterion B" and "≥5 vestibular episodes to date
    (Bárány VM A) - Bárány VM criterion A". In the Bárány/IHS criteria (BARANY22, cited under the
    vestibular migraine note) criterion A is at least five episodes lasting 5 minutes to 72 hours,
    and B is current or past migraine. The labels are baseline instrument text, moved verbatim
    (`tests/baseline/src/MASQUE_Screener_v0_3.jsx`); this release may not reword them. Round 2
    (R25) dropped the block: it was new assembly, the only place "Bárány VM B" reached the note,
    and listing A/B/C invited a "meets criteria" reading (B, migraine history, is not assessed).
    No item `ref` is printed now; the boolean items' own wording still carries their letters A and
    C in the review of systems, which match BARANY22. The upstream `v_vertigo` mislabel stays in the
    instrument; fixing it is a versioned instrument change for the lead. Accepted at sign-off
    (2026-10-07, release 0.4.4) as a known limitation; still open.
15. **Safety items for the lead (D3c, D6).** See the decision table: the "both" referral versus the
    vestibular-migraine recommendation, and a recorded central HINTS pattern with no plan
    response. Both stay recorded as known limitations, accepted at sign-off (2026-10-07, release
    0.4.4) unless the lead asks for changes. **Release 0.4.5:** the "both" referral is now the
    lead's ("Referral: Neurology — evaluate for mid-facial / migrainous cause"), with the lead's
    rule, definition and clarification printed between it and the vestibular-migraine
    recommendation; the D6 item is unchanged. **Release 0.4.6:** a recorded central pattern now
    gets the clinician placeholder under the HINTS row (the lead's choice, 2026-10-10); it raises
    no flag, so a routine referral and the references can still print next to it.

### Also in release 0.4.3: two changes from separate sessions (integrated 2026-10-07)

Two changes were made on 2026-10-06 in separate sessions, on top of release 0.4.1 and before the
Spanish and EMR work. Neither was deployed. Both were integrated into release 0.4.3 on 2026-10-07
and ship with it. Neither changes module data: the rubric, its hashes and every version axis but
the release are as stated above.

**The Patient `.txt` says when the summary is thin (allowed difference AD16).**
- The Companion's screen and its `.html` export already show the thin warning (`thinTitle`, "There
  isn't much here yet", with the `thin` text) when nothing is said, there is no clinician line and
  no flag. They also show the lede `notSureLede` above the not-sure list.
- The `.txt` export left both out, in English and Spanish, as the baseline Patient did (Pat
  L1096-1125). A near-empty `.txt` therefore read as a finished summary.
- The `.txt` now prints the thin block right after its header (after the unreviewed-translation
  line where present), with the heading in capitals like every `.txt` heading. It prints the lede
  right under the not-sure heading.
- Only existing strings are used. In Spanish these are the existing `thinTitle`, `thin` and
  `notSureLede`, unchanged since the baseline; the 0.4.2 translation did not touch them. No score,
  band or probability is added.
- The change was made as commit 27ce5f4, where its allowed difference was numbered AD14. In this
  release AD14 is the Spanish completion and AD15 the EMR button, so it is AD16
  (`docs/refactor/02-app-divergences.md`; design E11). It closes an item the 0.4.2 entry left out
  of scope.

**Engine round 3d: no change for this module.** This is the slot rule described above under
"Round 3d" (design 05 §13.12; design S12 and E12). With two carry-over items, a line that names the
second item with its duration withheld ends the first item's open window, unless that line also
names the first item again with no duration. This module has one
carry-over item (`v_vertigo`), so its output, the gold set 0.3.0, the benchmark block and both pins
are unchanged. At integration the engines before and after round 3d also gave identical results
on 12,000 seeded dialogues (48,318 steps) built from the gold set texts and this lexicon's phrases.
Review round 1 of the integration generalised round 3d's disclosure (the effects chain, above;
follow-up F-3D-4) and pinned the new trace in the capture suite; the engine logic is unchanged.

### Release 0.4.3

`APP_VERSION` (`app/src/engine/policy.js`) and the test harness's `NEW_RELEASE` move together to
0.4.3, with the AD4 text. 0.4.2 is the deployed release, and every printed export carries the
release, so the two must not print the same number. Deployment remains the lead's decision.

**The reading of "also".** The request says that when red flags are present, the imaging, labs
or referral "should be indicated in the plan also". The template prints each flag's own workup and,
while any flag is open, withholds the neurologic referral and the empiric-treatment references, as
the FHIR bundle's routing override does (the upstream rule "gate, don't warn"). This is a deliberate
reading of "also", stated here so the user and the lead confirm it rather than discover it.

Lineage: derivations made under 0.4.2 should still verify, because lineage compares the
instrument, scoring and lexicon hashes and `logicSha256`, none of which moves. This was not tested
separately in this release. A 0.4.2 download-all zip that contains the built-in MASQUE rubric no
longer matches it byte for byte, so its rubric is offered as "Load as derived".

### Verification (2026-10-07, after the integration)

On branch `claude/release-0.4.3`: the EMR release, then the Patient `.txt` thin change (AD16) and
round 3d, then the fixes of the integration's review rounds 1 and 2 (comments, records, one
capture sequence, two capture rows and the round 3+ property's counts; no engine logic).
- The full suite at `?seed=1296126801`, run in a background tab: **23/23 PASS**, 0 fail, 0 invalid.
  Two suites moved from review round 4's run below: `patient` 303,615 (+52: the thin cases and the
  AD16 checks) and `capture` 269,966 (+16,009: the round-3d cases, the F-3D-4 sequence of review
  round 1 and the two rows of review round 2 included, and the round 3+ property). Every other
  suite has the same count.
- `GOLD_0_3_0_SHA256` and `EXPECTED_BENCHMARK` are unchanged.
- `extract-rubric.html` reports "Identical", with the same SHA-256 `02c53481…` and 131,172 bytes as
  below: neither change touches the rubric.
- At integration the engines before and after round 3d gave identical results on 12,000 seeded
  dialogues built from this lexicon (48,318 steps).
- Per-suite figures: `docs/refactor/02-app-divergences.md` ("screenAIr 0.4.3", Verification).

### Verification (2026-10-07, after review round 4, before the integration)

- `extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `02c534810582927d8272a924aabc15d65d976f41ba162f6f01d2b4bf02f02004`, 137 checks passed (eight
  for the EMR delta), 131,172 bytes. (After round 3: `ee9ae228…`, 131,004 bytes; after round 2:
  `e9449e39…`, 130,890 bytes; after round 1: `e0b929c1…`, 130,815 bytes; before round 1:
  `64f7e2c5…`, 130,536 bytes.)
- The built-in MASQUE validates with 0 errors and the expected V12 warning only (no unknown-field
  warning, R42).
- The full suite at `?seed=1296126801`, run in a background tab: **23/23 PASS**, 0 fail, 0
  invalid. Per suite (checks): integrity 78, values 3,114, golden 411, sweep 104,273, rules
  221,619, patient 303,563, extraction 167,936, capture 253,957, probes 100,049, cohort-gen 10,
  validate 394, shape 77,607, emr 102,783, render-screener 1,289, render-scribe 292,
  render-patient 8,964, omissions 20,480, research 160, research-parity 436, editor 230, roundtrip
  183, upload 87, static 1,024. Round 4 added 19 `validate` checks (six unknown-field generators,
  their six messages with a generator-found check each, and the history-citations single report),
  133 `emr` checks (the SI1 traps and those states through the whole oracle), 8 `render-screener`
  and 6 `render-scribe` checks (the edited text through Copy and Download, and its loss on leaving
  the view) and 3 `values` checks (the three new string leaves under `/emrTemplate`: the
  probe id, its render and the qualifier).
- **`omissions` failed intermittently before round 3.** Round 2's verification recorded only a
  passing run; a first full run of that tree had failed `omissions` (24 diffs, all in the derived
  module's Spanish walk) and passed alone and on rerun. Round 3 reproduced it with the suite alone
  in a background tab and fixed the timing dependence in the suite (R41): it now waits on the
  expected state after each walk. Since then it passed alone in a background tab and in the full
  run above.
- The `emr` suite's fuzz built 3,000 templates (1,500 seeded states per surface). It drew flag,
  unscorable, closed and open on both surfaces, and on the Scribe also unreviewed (Screener:
  closed 260, flag 426, open 287, unscorable 527; Scribe: closed 195, flag 462, open 226,
  unreviewed 241, unscorable 376): no throw, deterministic output, the inputs untouched, the marker
  first and last, no braces, square brackets only as placeholders and boxes, no criterion ref, and
  the referral text and reason equal to the FHIR bundle's in every state; since round 3 also the
  gap and context lines, the domain denominators, the shared source list, the probe-written
  checklist source, the review sentence under open flags and the Scribe destination line. The fuzz
  uses the unmodified module, so it cannot reach a rule error; the named matrix (18 states) adds
  the rule-error states (a throwing routing rule on both surfaces, a throwing derive rule on the
  Scribe).
- `screenair.html` after the run: the page reports ready, the Scribe's EMR panel mounts with the
  round-4 instruction line, and the console is clean.
- Round 3's run (`ee9ae228…`): 23/23 PASS, with values 3,111, validate 375, emr 102,650,
  render-screener 1,281 and render-scribe 286 (the other suites as above).
- Round 2's run (`e9449e39…`): 23/23 PASS on its recorded run, with values 3,108 and emr 80,018;
  round 1's run (`e0b929c1…`): 23/23 PASS, with values 3,106, validate 365 and emr 73,909 (the
  other suites as above).
- The files, the deploy list and the AD15 and AD16 rows: `docs/refactor/02-app-divergences.md`
  ("screenAIr 0.4.3").

## 2026-10-07: release 0.4.4, the clinical-lead sign-off of the EMR template content

Release screenAIr 0.4.4 (0.4.3 → 0.4.4) records a sign-off. It changes no clinical content, and no
behaviour other than the printed release string (0.4.4, AD4) and the Rubric Editor's lock reason
for `/emrTemplate` (below). Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged.
`masque.logic.js` is not touched, so `logicSha256` is unchanged. The `emrTemplate` block is byte for
byte release 0.4.3's. The rubric gains one change-log entry (kind `sign-off`), so `contentHash` and
the rubric's bytes change; `instrumentHash`, `scoringHash` and `lexiconHash` do not, and the
illustrative calibration still applies.

**The sign-off.** On 2026-10-07 the user, who is the project's clinical lead, wrote in chat:

> yes I am Clinically signed off on the EMR template content, please upload the changes

Earlier the same day the lead had written "agree with changes, put 0.4.3 live", and 0.4.3 is the
deployed release.

- **By** the clinical lead, **on** 2026-10-07, **in** chat.
- **Scope:** the EMR Friendly Template content and the note it generates, as implemented in
  release 0.4.3. That is the `emrTemplate` block (the citation register, the empiric-treatment
  references, the instrument recs, the red-flag references and workup placeholder, the
  treatment-and-workup rows, the checklist and the exam rows) and the note `buildEmrTemplate`
  writes from it on the Screener and the Scribe, with decisions D1-D16 and the changes of review
  rounds 1-4 (R1-R47). The implementation choices I1-I8 and the items each round recorded for the
  lead are covered as they stand.
- **How it was given:** as one statement covering the content as implemented. The lead did not
  answer the recorded lead items one by one (among them the DZ4 indication clause, the reading of
  "also", the otologic destination "Neuro-otology", I3 and the checklist while the Scribe's safety
  review is not recorded). They are recorded as signed off as implemented on that basis, and the
  lead is to be asked to confirm that reading, item by item, when this release is reported to
  the lead. Until the lead answers, that confirmation is pending. If the lead does not confirm
  one, its Status cell is amended to "implemented, not individually confirmed" and it
  becomes a follow-up.
  **Status of that list (release 0.4.5, updated 2026-10-10):**
  - the checklist under an open red flag (the lead item I3 of round 2, D7: the
    symptomatic-therapy rows under `rf_systemic` or `rf_orbital`): **CONFIRMED by the lead on
    2026-10-07** ("Yes, checklist showing even when red flag is open is okay to proceed");
  - the checklist while the Scribe's safety review is not recorded (the separate lead item of
    round 3, D7; the content basis §1 table had "Withheld (D7)"): **CONFIRMED by the lead on
    2026-10-09** ("The checklist can be shown regardless if the safety screen is done, the user
    should be able to see progress and alerted if red flags pop up.");
  - the otologic destination "Neuro-otology" (D3): **REPLACED** by the lead's referral rule
    (2026-10-07; dizziness cases to Neurology, nothing escalated automatically; release 0.4.5), and
    the destination of `both` (D3c) likewise "Neurology" (2026-10-09);
  - the checklist on an unscorable screen (the rest of I3): **CONFIRMED** by the same 2026-10-09
    statement, whose "regardless" and "the user should be able to see progress" cover every state,
    an unfinished screen included (recorded by the main session, 2026-10-10);
  - the DZ4 indication clause (D1): **CONFIRMED by the lead on 2026-10-10** (kept; release 0.4.6);
  - the reading of "also" under a red flag: **ANSWERED by the lead on 2026-10-10**, the other
    reading (the referral and the references printed too, the bundle unchanged; release 0.4.6);
  - I5 (the items left out): **ANSWERED by the lead on 2026-10-10**: three of the four added back
    (release 0.4.6); and the D6 residual risk: the lead chose the clinician placeholder (release
    0.4.6);
  - the rest of the implementation choices, I1, I2, I4, I6, I7 and I8: **CONFIRMED by the lead on
    2026-10-11**, as implemented (release 0.4.6, "Confirmed on 2026-10-11" in the 0.4.6 entry). The
    list is closed;
  - new in 0.4.5, the two questions recorded for the lead: **ANSWERED by the lead on
    2026-10-10** (Decision 3 in the 0.4.5 entry). The 2026-10-07 internal-vertigo line is
    amended: a rocking or bobbing sensation is dizziness, not true vertigo, and swaying is
    imbalance too, so the line no longer lists "swaying, bobbing". No versioned instrument, probe
    or lexicon change is wanted: rocking, bobbing and swaying still count toward the vestibular
    score as imbalance, through the item `v_vertigo` ("Episodic vertigo or imbalance"), the probe
    `pr_internal_vertigo` and the approved cues of lexicon 0.3.2. The absence of a cue that a
    ticked placeholder means changing the referral by hand stays a known limitation. The 0.4.5
    questions of 2026-10-07 are answered or moot: `both` is a dizziness case (2026-10-09), the
    rule sentence is the lead's own words and the definition the lead's as the lead amended it,
    and seconds-long internal vertigo, the order of the placeholder and the evidence line and
    escalation on "Yes, but only seconds at a time" are superseded by the clarification of
    2026-10-09 (nothing escalates; no evidence line prints).
- **Recorded in** `app/tests/harness/emr-delta.js`: `EMR_DELTA.signOff` = {by: "clinical lead",
  date: "2026-10-07", scope: "emrTemplate content and the generated note as implemented in
  release 0.4.3 (decisions D1-D16, review rounds 1-4)", channel: "chat"}, with
  `drafted.reviewed: true`. The drafting provenance stays as history (AI agents, 2026-10-06,
  verified and corrected sources only), and so does the release 0.4.3 change-log entry above. That entry still says the data was
  not reviewed by the clinical lead, which was true when it was written.
- **Enforced:**
  - `applyEmrDelta` (`tests/harness/diff.js`) refuses `drafted.reviewed: true` without a complete
    sign-off record (by, date, scope, channel; the date a real calendar date in YYYY-MM-DD form),
    and a sign-off record on a delta that is not reviewed.
  - The extractor checks the same, with the same function (`emrSignOffComplete`). A new check (138 in all) places the sign-off entry last, right
    after the `emr-template` entry.
  - The `values` suite pins the record and both entries. It also pins the SHA-256 of the
    signed-off block (`fb63a2b9…`, the block as release 0.4.3 shipped it). A later change to
    any `emrTemplate` string, row or citation is outside this sign-off and fails there until a new
    sign-off is recorded.

**What the sign-off does not cover.**

- **The Spanish Patient Companion translation** (release 0.4.2). `locales.es.reviewed` stays
  `false`, and the "Traducción sin revisar" banner stays until a bilingual clinical reviewer signs
  it off.
- **The recorded follow-ups.** They stay recorded as known limitations and follow-ups, accepted at
  sign-off unless the lead asks for changes. This release changes none of them:
  - a recorded central HINTS pattern gets no plan response (D6; known risk 15);
  - for the complaint "both" the referral goes to Headache medicine / Neurology while the
    vestibular-migraine recommendation names neuro-otology (D3c; known risk 15);
  - the Scribe phenotype quirk sets the references and the referral destination (D14; known risk
    12); its fix is a versioned `masque.logic.js` change;
  - the upstream Bárány criterion labels (known risk 14); their fix is a versioned instrument
    change;
  - the module's `gapLine` and `gapAlert.body` wording (R28), a module-copy change;
  - item-prompt answers on the Scribe carry no capture label (round 3 finding F7);
  - the round 3d follow-ups F-3D-1 to F-3D-4 (design 05 §13.12; "Round 3d" above), each needing its
    own review before a module with two entries that may carry ships.

Every citation still needs re-verification each release; its `accessed` date (2026-10-06) says
when it was last checked (known risk 3).

The rubric's change-log entry, verbatim:

- **sign-off** (`/emrTemplate`): Clinical-lead sign-off, recorded in release 0.4.4: on 2026-10-07 the clinical lead signed off, in chat, the EMR Friendly Template content (emrTemplate) and the note it generates, as implemented in release 0.4.3 (decisions D1-D16, review rounds 1-4). The emrTemplate data is unchanged; tests/harness/emr-delta.js records the sign-off (signOff, reviewed: true) and keeps the AI-agent drafting provenance and the preceding emr-template entry as history. Not covered: the Spanish Patient Companion translation (locales.es stays reviewed: false). The recorded follow-ups stay open as known limitations, accepted at sign-off unless the lead asks for changes: a recorded central HINTS pattern with no plan response (D6), the referral destination for the complaint both (D3c), the Scribe phenotype quirk (D14), the upstream Bárány criterion labels, the gapLine copy, the unlabelled item-prompt answers on the Scribe and the round 3d follow-ups F-3D-1 to F-3D-4 (CHANGELOG.md, release 0.4.4). Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged; only contentHash changes.

**Other records.**

- The Status column of the D1-D16 table above reads "signed off 2026-10-07 (0.4.4)".
- The review rounds and known risks 12, 14 and 15 note the sign-off.
- `SOURCES.md` gives the sign-off status of every `emrTemplate` string; `README.md` says the same in
  one paragraph.
- The Rubric Editor's lock reason for `/emrTemplate` (`app/src/engine/derive.js`) no longer says the
  data awaits review: "The EMR template data is cited clinical content (the built-in module's was
  signed off by the clinical lead on 2026-10-07); not editable in the Rubric Editor." The lock
  applies to the block of any module the editor opens, an upload included, so the reason names
  the built-in module's sign-off instead of claiming one for every block.

### Release 0.4.4

`APP_VERSION` (`app/src/engine/policy.js`) and the test harness's `NEW_RELEASE` move together to
0.4.4, with the AD4 text. 0.4.3 is the deployed release, and every printed export carries the
release, so the two must not print the same number. The lead asked for the upload together with
the sign-off; the upload is a separate step after verification, not part of this commit.

Lineage, as in 0.4.3: derivations made under 0.4.3 should still verify, because lineage compares the
instrument, scoring and lexicon hashes and `logicSha256`, none of which moves. A 0.4.3 download-all
zip that contains the built-in MASQUE rubric no longer matches it byte for byte, so its rubric is
offered as "Load as derived". Neither was tested separately in this release.

### Verification (2026-10-07)

- `extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `03d5e5bc566dd922dc9d960bc622f703170175c848aba8c02c1f98d644642ab7`, 138 checks passed (nine
  for the EMR delta), 132,397 bytes (release 0.4.3: `02c53481…`, 137 checks, 131,172 bytes). The
  `emrTemplate` block is unchanged; only the change log grows.
- The full suite at `?seed=1296126801`, run in a background tab: **23/23 PASS**, 0 fail, 0
  invalid. Per suite (checks): integrity 78, values 3,120, golden 411, sweep 104,273, rules
  221,619, patient 303,615, extraction 167,936, capture 269,966, probes 100,049, cohort-gen 10,
  validate 394, shape 77,607, emr 102,783, render-screener 1,289, render-scribe 292,
  render-patient 8,964, omissions 20,480, research 160, research-parity 436, editor 230, roundtrip
  183, upload 87, static 1,024. Only `values` moved from release 0.4.3's final run (3,114 →
  3,120: the sign-off record, the sign-off entry and its kind and date, the signed-off block's
  SHA-256, and, since fix round 1, the two `emrSignOffComplete` checks). This is the run after fix
  round 1 (the calendar-date check and the record wording); the extractor reported the same
  "Identical", 138 checks.
- The negative cases of `applyEmrDelta` were run by hand: `reviewed: true` with no sign-off, an
  empty `channel` or a date not in YYYY-MM-DD form throws (since fix round 1 the `values` suite
  checks an impossible date, 2026-02-30, and a few incomplete records too); a sign-off record on an unreviewed delta
  throws; an unreviewed delta without one applies; `revertEmrDelta` returns null for a refused
  delta.
- `screenair.html` after the run: ready, `#root` mounted, and the footer lists release 0.4.4,
  module masque, instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0, with the
  marker. The console shows no error from the page (only the loader check's deliberate
  import-cycle errors from the suite run).
- The files, the deploy list and the AD4 row: `docs/refactor/02-app-divergences.md` ("screenAIr
  0.4.4").

## 2026-10-07 to 2026-10-10: release 0.4.5, the clinical-lead referral rule for dizziness cases

Release screenAIr 0.4.5 (0.4.4 → 0.4.5) records the clinical lead's decisions of 7, 9 and 10
October 2026 and implements the referral rule for dizziness cases. Instrument 0.2, lexicon 0.3.2,
probe set 1.0.0 and gold set 0.3.0 are unchanged. `masque.logic.js` is not touched, so
`logicSha256` is unchanged, and the signed-off `emrTemplate` block is byte for byte release
0.4.3's (the `values` suite's pin of its SHA-256, `fb63a2b9…`, still holds). The rubric's
`phenotypes.referral` changes (two destinations and the lead's rule, printed for the clinician)
and the rubric gains one change-log entry (kind `referral`), so `contentHash` and the rubric's
bytes change. The referral table is outside `instrumentHash` and `scoringHash`, which do not
move, and the illustrative calibration still applies.

**The decisions.** The user, who is the project's clinical lead, wrote in chat:

- 2026-10-07:

  > Yes, checklist showing even when red flag is open is okay to proceed

  > Yes, dizziness cases should be referred to neurology, and neuro-otology if there is a true vertiginous component or a history of ear or brain surgeries.

  Asked directly how true vertigo is to be recognised, the lead answered in chat with this
  definition, in the lead's own words:

  > • Internal Vertigo: A false sensation of self-motion. The person feels like they are spinning clockwise/counter-clockwise, tilting, swaying, bobbing, or being pulled in a specific direction.
  > • External Vertigo: A false sensation that the surrounding environment is moving, spinning, or whirling around them.
  > The direction is often predictable (e.g. "always to the right")

  The lead also chose that the rule applies to the EMR note and to the FHIR referral
  ServiceRequest alike (the two stay identical), and that the instrument's vestibular-migraine
  recommendation in `masque.logic.js` ("Refer neuro-otology / vestibular therapy.") is left
  unchanged, with the note stating the lead's rule right above the recommendations.
- 2026-10-09:

  > both cases should follow the dizziness rule

  Three minutes later, in one message:

  > Vertigo episodes that last between 30 min and 12 hours should count as vertigo for purposes of ruling out meniere's disease, transient vertigo (true room spinning for a few seconds can count as vertigo which can be consistent with migrainous vertigo). A rocking or bobbing sensation is not true vertigo but a dizziness morphology that can be consistent with migrainous symptoms. Also some people describe "the floor falling out from underneath them".

  > The checklist can be shown regardless if the safety screen is done, the user should be able to see progress and alerted if red flags pop up.
- 2026-10-10, in two messages, answering the two questions this release had recorded for the lead
  (whether the 2026-10-07 internal-vertigo line is to be amended, and whether a versioned
  instrument, probe or lexicon change is wanted now that a rocking or bobbing sensation scores
  into `v_vertigo`):

  > classify rocking or bobbing as dizziness and not true vertigo, it counts toward the vestibular score still as it is imbalance

  > Swaying is imbalance also

**Provenance.** The rule sentence and the definition of 2026-10-07 are the lead's own words, given
verbatim in chat (the definition in answer to a direct question). The stored rule is the lead's
sentence without its opening reply word "Yes, " (the extractor checks that this is the only
difference); the clarification is stored and printed verbatim, spelling and punctuation the
lead's. The definition is stored and printed as the lead amended it on 2026-10-10 (Decision 3):
the lead's three lines with "swaying, bobbing, " removed from the internal-vertigo line and
nothing else changed; the definition as given on 2026-10-07 is kept verbatim in
`tests/harness/referral-delta.js` (`quotes.definition`), and the amendment's two messages as
`quotes.amendment`. The qualifiers that review round 1 of this release added ("as relayed to
the implementing session", "lead confirmation pending") are withdrawn everywhere. Each date is
the local calendar date (UTC-7) of the chat message. The decision on `both` was sent at 21:56 on
2026-10-09, three minutes before the clarification; the corrections as first committed
(`f985f74`) dated it 2026-10-08, and fix round 1 of the corrections dated it correctly
everywhere, the rubric's change-log entry included.

**Decision 1: the checklist in every state — CONFIRMED.** The management checklist is shown in every state (I3, D7), and the lead has now
confirmed both states the lead items asked about: under an open red flag (2026-10-07: "Yes,
checklist showing even when red flag is open is okay to proceed") and before the Scribe's safety
review is recorded (2026-10-09: "The checklist can be shown regardless if the safety screen is
done, the user should be able to see progress and alerted if red flags pop up."). Nothing changes,
because release 0.4.3 already behaves so: the checklist shows in every state, open red flags lead
the plan ("RED FLAGS PRESENT — <tier>", one module action per flag, the referral withheld), and on
the Scribe before the review, with no red flag open, the plan opens "Safety review not recorded —
no screening routing issued." (with a flag open, the red-flag lines lead and SCREEN RESULT carries
"NOT YET REVIEWED — no routing issued…"). The checklist on an unscorable screen (the rest of I3)
is covered by the same statement: "regardless" and "the user should be able to see progress" name
no exception, and an unfinished screen is where progress shows (recorded 2026-10-10). The
pending question of review round 1 about seconds-long internal vertigo is superseded by the
clarification of 2026-10-09 (Decision 2).

**Decision 2: the referral rule.** As implemented:

| Picture | Referral (FHIR ServiceRequest and EMR note alike) | The note's rule block |
|---|---|---|
| Otologic / vestibular (`otologic`) | **Neurology** — evaluate for vestibular migraine (was Neuro-otology) | printed |
| Both (`both`) | **Neurology** — evaluate for mid-facial / migrainous cause (was Headache medicine / Neurology, through the default) | printed |
| Sinonasal (`sinonasal`) and the default (no picture) | Headache medicine / Neurology — evaluate for mid-facial / migrainous cause (unchanged) | none |

- **Dizziness cases are the `otologic` and `both` phenotypes.** `otologic` is the picture
  "Dizziness, aural fullness, tinnitus, fluctuating hearing"; `both` ("Mixed sinonasal and
  otologic") is a dizziness case by the lead's decision of 2026-10-09. On the Scribe the module's
  derive rule (`masque.logic.js`, unchanged; D14) gives `both` whenever headache severity
  (`m_head`) has any answer, "None" included, alongside a vestibular answer, so the rule now
  reaches the completed Scribe encounters it missed before this decision. For `both` only the
  specialty changes: the reason stays the module's own text for that picture, "mid-facial /
  migrainous cause", which it had through the default (main session).
- **No automatic escalation.** The first implementation of this release (commits `9dac9b7` and
  `c175c03`, never deployed) escalated an otologic referral to "Neuro-otology" when the Scribe's
  rescue probe `pr_internal_vertigo` ("Does your head ever feel like it's bobbing, rocking, or
  swaying side to side … even while you're sitting perfectly still?") was answered "Yes — rocking
  or bobbing" or "Yes, but only seconds at a time", and printed "True vertigo recorded by clinician
  via probe: …". The lead's clarification of 2026-10-09 says that a rocking or bobbing sensation is
  not true vertigo, so that probe does not record true vertigo, and the escalation, its evidence
  line and the escalation words on the Scribe's destination line are removed. No other app data
  reliably records true vertigo as the lead now describes it: the episode-duration item
  (`v_vertigo`, "Episodic vertigo or imbalance"; patient wording "When you get a dizzy or spinning
  spell, how long does it last?") cannot isolate true vertigo, and its band "5 min – 72 h" cannot
  isolate episodes of 30 min to 12 hours; spontaneous patient words are not used; a prior ear or
  brain surgery is captured nowhere. So release 0.4.5 escalates nothing: a dizziness case is
  referred to "Neurology" in every state in which a referral prints, in the EMR note and the FHIR
  ServiceRequest alike, and Neuro-otology is the clinician's decision through the printed rule.
  The engine has no escalation path (no rule, probe or option is read for the referral), and the
  referral table holds no evidence or destination of its own.
- **The EMR note.** For a dizziness case, wherever the plan prints a referral line or "Referral:
  [clinician decision]" (the lowest band), these lines sit between the consultant placeholders and
  the recommendations, right above "Consider vestibular migraine … Refer neuro-otology / vestibular
  therapy …" (otologic shown; for `both` the referral line reads "Referral: Neurology — evaluate
  for mid-facial / migrainous cause" and the block is the same):

  ```text
  Referral: Neurology — evaluate for vestibular migraine
  ...
  Specific question for the consultant: [ ]
  Urgency / preferred clinic: [ ]
  Referral rule (clinical lead, 2026-10-07; definition amended 2026-10-10): dizziness cases should be referred to neurology, and neuro-otology if there is a true vertiginous component or a history of ear or brain surgeries.
  Definition (clinical lead, 2026-10-07; definition amended 2026-10-10):
  • Internal Vertigo: A false sensation of self-motion. The person feels like they are spinning clockwise/counter-clockwise, tilting, or being pulled in a specific direction.
  • External Vertigo: A false sensation that the surrounding environment is moving, spinning, or whirling around them.
  The direction is often predictable (e.g. "always to the right")
  Clarification (clinical lead, 2026-10-09):
  Vertigo episodes that last between 30 min and 12 hours should count as vertigo for purposes of ruling out meniere's disease, transient vertigo (true room spinning for a few seconds can count as vertigo which can be consistent with migrainous vertigo). A rocking or bobbing sensation is not true vertigo but a dizziness morphology that can be consistent with migrainous symptoms. Also some people describe "the floor falling out from underneath them".
  True vertigo (internal or external): [ ]
  Prior ear or brain surgery: [ ]
  ```

  "Referral rule", "Definition" and "Clarification" with their sources in parentheses are
  structural labels; the rule, the definition (as the lead amended it on 2026-10-10) and the
  clarification are the lead's words, stored in `phenotypes.referral` (never in the signed-off
  `emrTemplate` block). The engine prints one `source` after "Referral rule" and after
  "Definition", so since 2026-10-10 it reads "clinical lead, 2026-10-07; definition amended
  2026-10-10": it names what was amended, and the rule itself is unchanged since 2026-10-07 (a
  separate source for the definition would be an engine change). The two placeholders are
  never pre-filled. Under an open red flag, an unrecorded Scribe safety review, an unscorable screen
  or a rule error none of it prints (gate, don't warn). On the Scribe the destination line names
  the picture only, as in release 0.4.4.
- **Bárány criteria and the lead's rule are different things.** The instrument's own text is
  unchanged (`masque.logic.js` untouched): the probe `pr_internal_vertigo` keeps its `why`
  ("Internal vertigo — a false sense of self-motion — qualifies under Bárány exactly as spinning
  does …") and its options (option 1's note: "Internal vertigo lasting seconds — below the 5-minute
  Bárány floor; …"), and the `vestibular_migraine` recommendation keeps "Refer neuro-otology /
  vestibular therapy." Option 0, "Yes — rocking or bobbing", still writes `v_vertigo` = 2 (a
  5 min – 72 h episode) and option 1, "Yes, but only seconds at a time", `v_vertigo` = 1
  ("Under 5 min"); both are scored and printed (see Decision 3, which also lists the approved
  rocking cues). These belong to the Bárány vestibular-migraine criteria that the instrument
  scores and routes against. The lead's referral rule decides the referral destination and what
  the clinician confirms; it does not change the instrument's scoring, probes or recommendation
  text, and the instrument's Bárány reading does not change the referral. The note prints both,
  each labelled as what it is.
- **Why the recommendation text is unchanged.** It is the instrument's routing copy, moved
  verbatim from the baseline, and the lead chose to keep it; the note states the lead's rule right
  above it instead. The plan therefore reads "Referral: Neurology" above a recommendation that
  names neuro-otology / vestibular therapy, with the rule between them saying when neuro-otology
  applies.
- **Where it lives.** In module data: `phenotypes.referral.byPhenotype.otologic.specialty`
  ("Neurology"), the new `phenotypes.referral.byPhenotype.both` and the new
  `phenotypes.referral.clinicianRules` (`{phenotypes, source, rule, definition,
  clarificationSource, clarification, confirm}`), from `app/tests/harness/referral-delta.js`
  through the extractor (`applyReferralDelta`, proven exact by `revertReferralDelta`; ten checks,
  148 in all, since the amendment of 2026-10-10). `clinicianRules` replaces the first
  implementation's `phenotypes.referral.escalate` entry: its probe evidence, its Neuro-otology
  destination (`to`) and its `evidenceLabel` are removed (the lead's rule sentence itself names
  neuro-otology), its display fields stay (`clinicianRule` is renamed `rule`), and the key is
  renamed because nothing escalates. The
  engine names no phenotype, probe or condition: `emr.js` prints the clinician
  rules of the picture; `rules.js` `referralFor`, `fhir.js` and `Scribe.jsx` are byte for byte
  release 0.4.4's. Validator V27 checks the new fields (§2.6 of `04-module-authoring.md`; a field
  the engine never reads, an escalation destination or evidence among them, is a warning), and the
  Rubric Editor keeps `phenotypes` read-only.

**Decision 3: the definition amended; rocking, bobbing and swaying are imbalance (2026-10-10).**
The lead's two messages of 2026-10-10 answer the two questions this release had recorded for the
lead.

- **The definition's internal-vertigo line is amended.** A rocking or bobbing sensation is
  dizziness and not true vertigo, and swaying is imbalance too, so the line no longer lists
  swaying and bobbing. The stored and printed line is:

  ```text
  • Internal Vertigo: A false sensation of self-motion. The person feels like they are spinning clockwise/counter-clockwise, tilting, or being pulled in a specific direction.
  ```

  Only "swaying, bobbing, " is removed. The bullet, the rest of the line, the external-vertigo
  line and the direction line are the lead's words of 2026-10-07, byte for byte. The definition no
  longer contradicts the clarification of 2026-10-09, which prints unchanged right after it (it
  still says "A rocking or bobbing sensation is not true vertigo"). The definition as given on
  2026-10-07 stays verbatim in `REFERRAL_DELTA.quotes.definition` as history, the two messages are
  `quotes.amendment` (dated 2026-10-10), and `REFERRAL_DELTA.amendments` records the removal
  (`{path: "/phenotypes/referral/clinicianRules/0/definition/0", quote: "amendment", removed:
  "swaying, bobbing, "}`). The rule's `source` reads "clinical lead, 2026-10-07; definition amended
  2026-10-10", so both labels in the note show the amendment. The extractor checks that the
  definition is the lead's line for line with only the recorded removal applied, that the source
  names the amendment's date, and, in a new check (148 in all), that the removal takes out exactly
  one occurrence and nothing else, rests on a later dated decision of the lead whose words name
  every word removed, and leaves none of them in the printed line. The `values` suite pins the
  amended definition line by line, the 2026-10-07 text in `quotes.definition` and the
  clarification; the `emr` suite pins the printed block, checks that no printed definition line
  names swaying or bobbing and that the 2026-10-07 internal-vertigo line prints nowhere.
- **No versioned instrument, probe or lexicon change.** A rocking, bobbing or swaying sensation
  still counts toward the vestibular score, as imbalance, through the item `v_vertigo`, "Episodic
  vertigo or imbalance — how long does an episode last?" (6 points, Bárány VM criterion B), the
  probe `pr_internal_vertigo` and the approved cues. Under the instrument (`masque.logic.js`) and
  lexicon 0.3.2, both unchanged, it scores by three routes:
  - the Scribe probe `pr_internal_vertigo` answered "Yes — rocking or bobbing" (option 0) writes
    `v_vertigo` = 2 ("5 min – 72 h", all 6 points), and the note's review of systems prints
    "episode duration (5 min – 72 h) (recorded by clinician via probe: Yes — rocking or bobbing)";
  - the same probe answered "Yes, but only seconds at a time" (option 1) writes `v_vertigo` = 1
    ("Under 5 min", 1.2 of the 6 points), which also scores, and the review of systems prints
    "episode duration (Under 5 min) (recorded by clinician via probe: Yes, but only seconds at a
    time; Internal vertigo lasting seconds — below the 5-minute Bárány floor; …)";
  - the lexicon cues the lead approved on 2026-10-04 (F3; `SOURCES.md`), taken from the module's
    probe wording (`pr_internal_vertigo`, and `pr_mdds` for "rocking feeling"), map heard speech
    to `v_vertigo`: "rocking feeling", "rocking sensation", "like i'm on a boat" with its three
    variants ("like i was on a boat", "like i am on a boat", "like being on a boat") and
    "swaying side to side". With a duration phrase in the same utterance, or, under the
    carry-over rules, in one of the next two patient replies, the Scribe captures the answer ("i
    get a rocking sensation that lasts hours" gives 2, "it's a rocking feeling for a few seconds"
    gives 1, "i feel like i'm swaying side to side for hours" gives 2) and the review of systems
    prints it as "episode duration (…)"; a cue with no duration is only heard, never an answer.

  Each of these answers counts toward the index as imbalance, which the item's own label names
  ("vertigo or imbalance"). The lead's definition printed in the note no longer lists the
  sensation, and the clarification printed after it says that it is not true vertigo. The probe,
  its options, its `why` and option 1's note (the instrument's Bárány reading, above) and the
  scoring stay the instrument's, moved verbatim from the baseline, and the cues stay lexicon
  0.3.2's as the lead approved them. Instrument 0.2, probe set 1.0.0, lexicon 0.3.2 and gold set
  0.3.0 are unchanged; only the rubric's `phenotypes.referral` and its change-log entry change,
  so only `contentHash` moves.

**The allowed difference AD17.** The baseline bundles refer the otologic picture to
"Neuro-otology" and the picture `both` to "Headache medicine / Neurology", so parity comparisons of
those referrals differ. AD17 excuses exactly two changes, at a referral ServiceRequest's code text
and for the comparison's own phenotype: otologic "Referral: Neuro-otology — evaluate for vestibular
migraine" → "Referral: Neurology — evaluate for vestibular migraine", and both "Referral: Headache
medicine / Neurology — evaluate for mid-facial / migrainous cause" → "Referral: Neurology —
evaluate for mid-facial / migrainous cause". It reads them from the delta's `destinations`, which
the extractor and the `values` suite prove to be exactly the destinations that differ from the
baseline. It excuses no other phenotype (sinonasal, the default, an unknown value), specialty or
reason, not the reverse direction, not another place, and nothing under a malformed or missing
delta (self-checks in the `rules` suite, with an exhaustive sweep over phenotypes, specialties and
reasons). It is expected wherever a baseline bundle refers one of the two phenotypes: `golden`
(Screener and Scribe bundles), `rules` (referralFor against both baseline bundles of each) and
`render-screener` (the bundle shown for the sample "otologic"). The CDS preview and the CDS Hooks
document name no specialty, so they are unchanged and compared without it.

**For the lead.** Recorded, not decided here:

- **Known limitation: a ticked placeholder does not change the referral.** The note and the FHIR
  ServiceRequest say "Neurology". A clinician who ticks "True vertigo (internal or external)" or
  "Prior ear or brain surgery" changes the referral line and the order by hand; only the lead's
  rule sentence implies it. A cue would be lead-sourced text in `phenotypes.referral` (never
  engine copy); none is added.
- External vertigo, true vertigo as the clarification describes it and a prior ear or brain
  surgery are asked by no probe; capturing them would be a versioned probe or instrument change.
- **Still pending** from the 0.4.4 list ("Status of that list" in the 0.4.4 entry): the rest of
  the implementation choices I1-I8 (I3, the checklist, is now confirmed in every state), the DZ4
  indication clause (D1) and the reading of "also" under a red flag. **Release 0.4.6:** the DZ4
  clause, the reading of "also", I5 and D6 were answered on 2026-10-10 (the 0.4.6 entry), and I1,
  I2, I4, I6, I7 and I8 were confirmed as implemented on 2026-10-11.

Answered and removed from this list: whether `both` counts as a dizziness case (yes, 2026-10-09);
the rule sentence as stored (the lead's own words); the checklist before the Scribe's safety
review is recorded and on an unscorable screen (confirmed 2026-10-09, Decision 1: the checklist in
every state); seconds-long internal vertigo, escalation on "Yes, but only seconds at a time" and
the order of the placeholder and the evidence line (superseded by the clarification of
2026-10-09: nothing escalates and no evidence line prints); whether the 2026-10-07
internal-vertigo line is to be amended (yes, 2026-10-10: "swaying, bobbing, " removed, Decision
3); and whether a versioned instrument, probe or lexicon change is wanted now that a rocking or
bobbing sensation scores into `v_vertigo` (no, 2026-10-10: rocking, bobbing and swaying count
toward the vestibular score as imbalance, through the item "Episodic vertigo or imbalance", the
probe `pr_internal_vertigo` and the approved cues; Decision 3).

The rubric's change-log entry, verbatim:

- **referral** (`/phenotypes/referral/byPhenotype/otologic/specialty`, `/phenotypes/referral/byPhenotype/both`, `/phenotypes/referral/clinicianRules`): Clinical-lead referral rule for dizziness cases, recorded in release 0.4.5 from the clinical lead's decisions in chat of 2026-10-07, 2026-10-09 and 2026-10-10. On 2026-10-07 the lead decided that dizziness cases should be referred to neurology, and to neuro-otology if there is a true vertiginous component or a history of ear or brain surgeries, and defined true vertigo (internal and external); on 2026-10-09 the lead decided that both cases follow the dizziness rule and added a clarification of what counts as true vertigo; on 2026-10-10 the lead amended the definition: a rocking or bobbing sensation is dizziness and not true vertigo, and swaying is imbalance too, so the internal-vertigo line no longer lists swaying and bobbing (the definition as given on 2026-10-07 is kept in tests/harness/referral-delta.js). Such a sensation still counts toward the vestibular score as imbalance, through the item Episodic vertigo or imbalance (the probe pr_internal_vertigo and the approved lexicon cues), so the instrument, probes and lexicon are unchanged. The otologic phenotype now refers to Neurology (was Neuro-otology) and the phenotype both to Neurology (was Headache medicine / Neurology through the default), each with its reason unchanged. No captured answer reliably records true vertigo or a prior ear or brain surgery, so nothing escalates automatically: phenotypes.referral.clinicianRules prints in the EMR note, for both phenotypes, the lead's rule and clarification verbatim and the definition as the lead amended it, with a placeholder for each condition, and neuro-otology is the clinician's decision. The FHIR referral and the EMR note agree. The sinonasal phenotype and the default keep Headache medicine / Neurology; the routing recommendation text in masque.logic.js is unchanged. Recorded in tests/harness/referral-delta.js. Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged; only contentHash changes.

### Release 0.4.5

`APP_VERSION` (`app/src/engine/policy.js`) and the test harness's `NEW_RELEASE` move together to
0.4.5, with the AD4 text. 0.4.4 is the deployed release, and every printed export carries the
release, so the two must not print the same number. The release stays 0.4.5 through the
corrections that followed the lead's decisions of 2026-10-09 and through the lead's amendment of
the definition on 2026-10-10 (neither the first implementation nor the corrections were
deployed). Lineage, as in 0.4.4: derivations made under 0.4.4 should still verify (instrument,
scoring and lexicon hashes and `logicSha256` do not move); a 0.4.4 download-all zip holding the
built-in rubric no longer matches it byte for byte, so its rubric is offered as "Load as derived".
Neither was tested separately in this release.

### Verification (2026-10-10, after the amendment of the definition)

- `extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `068f37c3e49a3df152bda500cba9f93846041a979051cab26f90e279adf1982e`, 148 checks passed (ten
  for the referral delta), 136,256 bytes (release 0.4.4: `03d5e5bc…`, 138 checks, 132,397 bytes;
  the superseded first implementation: `aa93907f…`, 146 checks, 135,095 bytes; the corrections as
  first committed, `f985f74`, whose change-log entry carried the date 2026-10-08: `f226112b…`,
  147 checks, 135,689 bytes; release 0.4.5 before the amendment, `dcff4d2`: `bd6e2bd8…`, 147
  checks, 135,674 bytes). `scoringHash` (`32cc4f44…`) and `instrumentHash` are unchanged.
- The full suite at `?seed=1296126801`, run in a background tab after the last change (the
  amendment and these records): **23/23 PASS**, 0 fail, 0 invalid, 1,393,037 checks. Only two
  suites moved from the run before the amendment (`dcff4d2`, 1,393,003 checks): values 3,159 →
  3,164 (the 2026-10-07 definition kept verbatim in `quotes.definition`, the amended definition
  equal to it with exactly the recorded removal, the amendment naming swaying and bobbing, no
  printed definition line naming either, and the clarification pinned unchanged) and emr 110,461
  → 110,490 (the block written out in the suite, and in each of the 28 states that print the
  rule block a check that no printed definition line names swaying or bobbing and that the
  2026-10-07 internal-vertigo line prints nowhere). From release 0.4.4: values 3,120 → 3,164,
  rules 221,619 → 221,845, validate 394 → 416, emr 102,783 → 110,490, render-scribe 292 → 300,
  editor 230 → 251, golden 411 → 412, render-screener 1,289 → 1,290, static 1,024 → 1,025;
  every other suite has the same count. AD17 was observed wherever its precondition held (golden
  10 of 10, render-screener 1 of 1, rules 4 of 4). The `emr` fuzz drew open referrals of
  `otologic` (Screener 100, Scribe 39) and `both` (Screener 105, Scribe 36, and 126 derived on
  the Scribe), with `pr_internal_vertigo` answered in 66 Screener and 149 Scribe of them, each
  with the template's referral equal to the bundle's and to the module data's destination, and no
  evidence line or escalation words in any of the 3,000 notes. The explicit derived cases (the
  sample "otologic" on the Scribe without `m_head`, which derives `otologic`, and with `m_head`
  "None", which derives `both`) read "Neurology" with the lead's rule block whatever
  `pr_internal_vertigo` records.
- `screenair.html` after the run: ready, `#root` mounted, and the footer lists release 0.4.5,
  module masque, instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0, with the
  marker. The engine, in the page, prints the rule block above, with the amended definition and
  the source "clinical lead, 2026-10-07; definition amended 2026-10-10", for `otologic` and
  `both` on both surfaces (with `pr_internal_vertigo` answered on the Scribe, still "Neurology")
  and none for `sinonasal`. The console shows no error from the page (only the loader check's
  deliberate import-cycle errors from the suite run). The prints and captures quoted in Decision
  3 were read from the engine in the page (before the amendment, when they were a question in
  "For the lead": the review-of-systems line of each `pr_internal_vertigo` "Yes" answer on the
  Scribe, the vestibular points of `v_vertigo` = 1 and 2, and the two rocking examples and a cue
  with no duration through the lexicon's `extract`; after it, the two rocking examples again and
  the swaying example through `extract`).
- The files, the deploy list and the AD4 and AD17 rows: `docs/refactor/02-app-divergences.md`
  ("screenAIr 0.4.5").
- History: the first implementation (2026-10-07, commits `9dac9b7` and `c175c03`) passed the same
  suite with 1,389,464 checks and its extractor run with 146 checks; it is replaced by this one.
  Release 0.4.5 before the amendment (`dcff4d2`, 2026-10-10) passed it with 1,393,003 checks and
  its extractor run with 147 checks.

## 2026-10-10: release 0.4.6, the clinical lead's answers on the EMR template's open items

Release screenAIr 0.4.6 (0.4.5 → 0.4.6) records the clinical lead's answers of 10 October 2026 to
four of the items the EMR template sign-off had left open (the reading of "also" under a red flag,
the DZ4 indication clause, the I5 items left out and the D6 central HINTS pattern) and implements
them. Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged.
`masque.logic.js` is not touched, so `logicSha256` is unchanged. The rubric gains two keys under
`emrTemplate` (`pastHistory`, and `optionPlaceholders` on the HINTS exam row) and one change-log
entry (kind `emr-decisions`), so `contentHash` and the rubric's bytes change; `instrumentHash` and
`scoringHash` do not move, and the illustrative calibration still applies. The signed-off
`emrTemplate` block of release 0.4.3 is byte for byte unchanged under the two additions: the
`values` suite removes them with `revertEmrDecisionsDelta` and the SHA-256 of what is left is
still `fb63a2b9…`; the shipped block is pinned apart (`0152cfd8…`).

**The decisions.** On 2026-10-10 the user, who is the project's clinical lead, answered four
questions in chat. The questions, every option as the lead saw it (label and description) and the
answers are kept verbatim in `app/tests/harness/emr-decisions-delta.js` (`quotes`). The answers:

- **The reading of "also"** (red-flag row of the decision table). Question: "When a red flag is
  open, what should the plan show besides the red-flag workup?" Answer:

  > Workup + referral + references

  The option read: "Also print the neurology referral and the empiric-treatment references under
  an open red flag. The FHIR order would still withhold the referral, so note and order would
  differ." The other option was the reading as implemented since 0.4.3 ("Workup only").
- **DZ4** (D1). Question: "DZ4 checklist label: keep the indication clause or trim it?" Answer:

  > Keep the clause (Recommended)

- **I5, the items left out to keep the note short.** Question: "Which of the items left out to
  keep the note short should be added back?" (several answers allowed). Answer:

  > Modifying conditions,Family history of migraine,Assessment 'Considerations'

  The options read: "Add 'Modifying conditions (asthma, cystic fibrosis, immunocompromise,
  aspirin-exacerbated respiratory disease, ciliary dyskinesia): [ ]' (AAO-HNS adult sinusitis
  guideline)."; "Add a separate history line with the screen's answer (it already appears in the
  review of systems)."; "Repeat the fired recommendations' headings under Assessment (they
  already appear in the plan)." Not chosen: "None — keep it tight". The fourth I5 item, the
  scale-item lines in the HPI, was not offered and stays out.
- **D6, a recorded central HINTS pattern.** Question: "If the Scribe records a central HINTS
  pattern ('Normal impulse (points central)'), what should the plan do?" Answer:

  > Add a clinician line (Recommended)

  The option read: "Under the HINTS exam row, add '[clinician interpretation of HINTS and any
  imaging decision]' when a central pattern is recorded. No new clinical claim; data-only
  change." Not chosen: showing the probe's own warning, treating the pattern as a red flag, and
  keeping it as is.

**What changes in the note.**

- **Under an open red flag** (engine, `engine/emr.js`). After the red-flag actions, the workup
  placeholder and the bundle's line "Screening routing withheld — red flag present", the plan now
  prints a heading, "Screen-based referral and references (the FHIR bundle withholds the referral
  while a red flag is open):", and under it exactly what the plan prints with no flag open, without the
  routing recommendations: the referral line in the bundle's words with its reason and index label
  (on the Scribe, the line naming where its destination came from), the consultant placeholders
  and, for the dizziness cases, the lead's referral rule block; then the empiric-treatment
  references and the treatment-offered lines. The gates are re-run without the flags only, so the
  Scribe's unrecorded safety review, an unscorable screen and a rule error still print their own
  sentence under the heading, and the lowest band "Referral: [clinician decision]" with no
  references. The FHIR bundle is unchanged: it still withholds the referral, the routing
  recommendations stay withheld and the band headline stays off the assessment. This is the one
  place where the note and the bundle now differ, as the option said; the heading says so in the
  note. The checklist stays in every state, as before.
- **The assessment** (engine). With no flag and no gate closed, a line "Considerations: <heading>;
  <heading>" lists the headings of the module recommendations the plan prints, once each, in their
  order, between the band headline and the clinician placeholder (content basis §2.9). Never an
  engine card (the override, incomplete, rule-error or no-routing card), so not under a flag, a
  closed Scribe review, an unscorable screen or a rule error. Example (sample "otologic"):
  "Considerations: Consider vestibular migraine; Characterise the tinnitus before attributing it".
- **Past history** (data `emrTemplate.pastHistory`, engine support). After "Pregnancy status /
  childbearing potential: [ ]": "Modifying conditions (asthma, cystic fibrosis, immunocompromise,
  aspirin-exacerbated respiratory disease, ciliary dyskinesia): [ ]", the wording the lead approved
  (the content basis §2.6 optional D13 row, heading from AAO-SIN25 KAS 8, in the words of the basis
  SI5 label with its abbreviations written out). After "Social history: [ ]": "Personal or family
  history of migraine: <state>" (the item `m_fhx`, its own wording and its recorded state: yes /
  answered no / not recorded, never a no from missing data; on the Scribe a probe that wrote it is
  labelled as recorded), then "Other family history: [ ]" (basis §2.6) in place of "Family history:
  [ ]". The item leaves the review of systems; the "Not answered" count still covers every item.
  No citation is printed on either row (past-history rows, like history rows, carry none).
- **The HINTS exam row** (data `emrTemplate.examRows[14].optionPlaceholders`, engine support). On
  the Scribe, when `pr_head_impulse` records option 0, "Normal impulse (points central)", the row
  is followed by "  [clinician interpretation of HINTS and any imaging decision]". No flag, no plan
  line and no clinical claim: the interpretation and any imaging decision are the clinician's. The
  other options, an unanswered probe and the Screener (which runs no probes) print nothing extra.
- **DZ4** keeps its label "Audiogram (episodic vertigo with aural symptoms, or unilateral
  tinnitus)": no change.

**Where it lives.** The two data additions are a separate, provable delta,
`app/tests/harness/emr-decisions-delta.js` (`EMR_DECISIONS_DELTA`), applied last by the extractor
with `applyEmrDecisionsDelta` (`tests/harness/diff.js`): each row adds a key that must not exist
yet, under `/emrTemplate` only, and `revertEmrDecisionsDelta` must give back the rubric without
them exactly. The extractor also checks that each answer is one of the options the lead saw, that
the added rows are exactly what the answers ask for, that the modifying-conditions label and the
HINTS placeholder are the strings the chosen options quote, that the family-history row is the item
whose own wording is "Personal or family history of migraine", that option 0 of `pr_head_impulse`
is the option the question names, one basis per entry, and the change-log entry's place (last,
after the 0.4.5 referral entry). `tests/harness/emr-delta.js` (the signed-off release 0.4.3 data)
is not touched. Validator V61 (`engine/validate.js`) reads the two new fields: a `pastHistory` row
has exactly one of `item` or `label` and a `group` of `medical` or `family`, and its item may not
also be a history row's; an exam row's `optionPlaceholders` is a list of {`option`, `placeholder`}
on a row with a probe, one per option, each option one the probe has (E). The engine names no item,
probe, option or condition: which rows print, and where, is data.

**Confirmed on 2026-10-11.** Shown the six implementation choices still open from the 0.4.4 list
(I1, the `history` key and the VM line as a references row; I2, "- " bullets; I4, one numbered
references list after the plan; I6, a deferred Scribe exam reading "(recorded by clinician via
probe: Deferred)"; I7, the four engine headings worded without condition words; I8, the gold set
as its own footer field) and asked whether any should change or when to upload 0.4.6, the lead
answered in chat (2026-10-11, local date):

> Confirm changes, upload 0.4.6 and update the version in github on the cloud session

They are recorded as confirmed as implemented; nothing changes in the note or the data, so the
rubric, the tests and the counts below are unchanged. Nothing from the 0.4.4 list is pending now:
I3 (the checklist in every state, 2026-10-07 and 2026-10-09), I5, the DZ4 clause, the reading of
"also" and D6 (all 2026-10-10, above), and I1, I2, I4, I6, I7 and I8 (2026-10-11). The known limitations
accepted at sign-off are otherwise unchanged (D3c and D14 as amended in 0.4.5, the upstream Bárány
labels, the gapLine copy, F7 and F-3D-1 to F-3D-4); a ticked referral-rule placeholder still does
not change the referral (0.4.5).

The rubric's change-log entry, verbatim:

- **emr-decisions** (`/emrTemplate/pastHistory`, `/emrTemplate/examRows/14/optionPlaceholders`): Clinical-lead answers on the EMR Friendly Template's open items, recorded in release 0.4.6 from the clinical lead's answers in chat of 2026-10-10. Two answers add data under emrTemplate: pastHistory (the modifying-conditions row, "Modifying conditions (asthma, cystic fibrosis, immunocompromise, aspirin-exacerbated respiratory disease, ciliary dyskinesia)", after the pregnancy line, and the item Personal or family history of migraine with its recorded state, before the family-history placeholder, which then reads "Other family history"), and an option placeholder under the HINTS exam row ("clinician interpretation of HINTS and any imaging decision", printed when the Scribe records Normal impulse (points central)). The other answers change the engine only or nothing: under an open red flag the note also prints the screen-based referral and the empiric-treatment references (the FHIR bundle still withholds the referral), the assessment names the headings of the recommendations the plan prints, and the DZ4 label keeps its indication clause. The signed-off emrTemplate block of release 0.4.3 is unchanged under these additions. Recorded in tests/harness/emr-decisions-delta.js. Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged; only contentHash changes.

### Review round 1 (2026-10-11, before upload)

Four independent reviewers (engine, clinical content and invariants, harness and validator, records
and deploy readiness), each finding checked by two skeptics, reviewed `a490922..e0d6fa3`. No
critical or major finding; the clinical content, the gates and the FHIR bundle were found as
intended. Confirmed and fixed:

- **The heading overstated what the bundle withholds.** It read "(the FHIR bundle withholds them
  while a red flag is open)", but the bundle never carries the empiric-treatment references in
  any state; it withholds only the referral, which is all the option the lead chose said. The
  heading now reads "Screen-based referral and references (the FHIR bundle withholds the referral
  while a red flag is open):", and the rubric's change-log note likewise ("the FHIR bundle still
  withholds the referral"), so the rubric was regenerated.
- **The Rubric Editor did not know the new past-history rows.** `derive.js` `itemDependents` and
  the EMR lock's expected block now include `emrTemplate.pastHistory`, so deleting an item a
  past-history row names removes that row instead of leaving a module that fails V61; the lock
  reason names the lead's additions of 2026-10-10. The `editor` suite checks the dependents, the
  cascade and the lock for the past-history item.
- **A test gap.** Under an open flag where the screen without the flags is unreviewed, unscorable or
  in error, the `emr` suite now also asserts that no referral line or placeholder and no consultant
  line prints (the engine already did not).
- **Stale contract and records.** The `EmrTemplate.references` typedef, the authoring guide (the
  references row, and the clinician-rule section's "never under an open red flag" and "they always
  agree"), the D3 and D4 Status cells and ED1 now describe the 0.4.6 behaviour under a red flag.

Recorded, not changed (for the lead): on the Scribe the screen-based block re-runs the gates with
the safety review as recorded. The Scribe hides "none of these apply" while a flag is open, so when
a flag is raised before the review is recorded (the usual order) the block prints "Safety review
not recorded — no screening routing issued." and no referral or references; they print on the
Scribe only when the review was recorded before the flag. On the Screener the safety step is part
of the flow, so the block prints. Rejected after verification: printing the references under an
emergent flag (the lead's choice), the family-history line's place (the lead's choice) and the
records of the 2026-10-11 confirmation.

### Release 0.4.6

`APP_VERSION` (`app/src/engine/policy.js`) and the test harness's `NEW_RELEASE` move together to
0.4.6, with the AD4 text. 0.4.5 is the deployed release, and every printed export carries the
release, so the two must not print the same number. Lineage, as in 0.4.5: derivations made under
0.4.5 should still verify (instrument, scoring and lexicon hashes and `logicSha256` do not move);
a 0.4.5 download-all zip holding the built-in rubric no longer matches it byte for byte, so its
rubric is offered as "Load as derived". Neither was tested separately in this release.

### Verification (2026-10-10)

- `extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `173f28b9110d773a6afe970681f0e43a3e4e83317d2aff402f8280f47d2278d9`, 157 checks passed (nine
  for the decisions delta), 138,226 bytes (before review round 1: `ed436707…`, 138,218 bytes, the
  change-log note's "withholds them"; release 0.4.5: `068f37c3…`, 148 checks, 136,256 bytes). `scoringHash` (`32cc4f44…`) and `instrumentHash` are unchanged. The shipped
  `emrTemplate` hashes `0152cfd8…`; without the two additions it hashes `fb63a2b9…`, the
  signed-off block.
- The full suite at `?seed=1296126801`, run in a background tab after review round 1:
  **23/23 PASS**, 0 fail, 0 invalid, 1,407,588 checks (before review round 1: 1,407,090; emr
  124,521 → 125,013 for the closed-gate assertions under a flag, editor 251 → 257 for the
  past-history delete cascade). Four suites moved from release 0.4.5 (1,393,037 checks), editor
  251 → 257 as just said, and these three (counts before review round 1): values 3,164 → 3,185 (the decisions delta: revert and re-apply,
  the record, the added data, the approved wording, the HINTS probe's options, the shipped block's
  SHA-256, one basis per entry, the change-log entry, and the signed-off block still `fb63a2b9…`
  under it), emr 110,490 → 124,521 (under every open flag in the matrix, the flags and the 3,000
  fuzz notes, the heading and the plan under it equal to the unflagged plan without its
  recommendations, the referral equal to the bundle's without the flags while the bundle carries
  none; the Considerations line, the past-history section and the exam rows in every state; the
  release 0.4.6 section and its seven V61 mutations) and static 1,025 → 1,026. Every other suite
  has the same count. The `emr` fuzz drew 455 Screener and 437 Scribe notes under open flags.
- `screenair.html` after the run: ready, `#root` mounted, the footer lists release 0.4.6. In the
  page, the Screener's EMR panel for the sample "red flag" prints the red-flag action with its
  Ref lines, the workup placeholder, "Screening routing withheld — red flag present", the 0.4.6
  heading, "Referral: Neurology — evaluate for vestibular migraine" with its reason, the
  consultant lines, the lead's rule block, the empiric-treatment references and the checklist; its
  assessment has no band headline and no Considerations line. The sample "otologic" prints
  "Considerations: Consider vestibular migraine; Characterise the tinnitus before attributing it".
  Both print the modifying-conditions row, "Personal or family history of migraine: yes" and
  "Other family history: [ ]". The console shows no error from the page (only the loader check's
  deliberate import-cycle errors from the suite run).
- The files, the deploy list and the AD4 row: `docs/refactor/02-app-divergences.md` ("screenAIr
  0.4.6").

## Logic (`masque.logic.js`)

The header of `masque.logic.js` as of this change log, verbatim (the loaded file's SHA-256 is
shown in screenAIr's module information drawer and in the export manifest):

```text
// masque.logic.js — logic layer of the built-in MASQUE module (screenAIr design 03 §3.3, §3.8; WP2).
//
// format "screenair-logic", contractVersion 1, moduleId "masque". Closures appear only on
// contract LOGIC_PATHS; everything else is plain data. This file imports nothing: the registry
// fetches it as text and runs it through the loader's importSource, so the bytes executed are
// the bytes served. screenAIr never edits it; it is replaced only by uploading a whole file.
//
// MOVE RULE. Every block below is moved from the frozen baseline (app/tests/baseline/src/,
// byte-identical to app/src at commit 5448d42) without rewording, renumbering or reordering.
// The probe and SUM blocks are verbatim line ranges. In the closures, free variables are
// renamed mechanically to the state fields of design §3.3 and nothing else changes:
//   Screener/Scribe locals answers, domains, band, complaint  -> s.answers, s.domains, s.band, s.complaint
//   Screener ITEMS.discriminators                             -> s.items.discriminators
//   the band literal "low" in `strong`                        -> s.lowestBand (engine vocabulary, same value)
//   Patient yes(id), scale(id), S, L(xs)                      -> s.yes(id), s.scale(id), s.S, s.L(xs)
//   Patient locals mig, vOther, neu, disc                     -> s.groups.mig, .vOther, .neu, .disc (engine-built)
//   Patient locals migPattern, vestPattern                    -> s.migPattern, s.vestPattern (derived)
//   Patient locals mHead, mDur, vDur, days, role              -> s.scale("m_head"), ("m_dur"), ("v_vertigo"), ("i_days"), ("i_role")
//   `if (xs.length)`                                          -> `xs.length > 0` (same truth value; `when` returns a boolean)
//
// SOURCE MAP (Scr = MASQUE_Screener_v0_3.jsx, Scb = MASQUE_Scribe_v0_3.jsx,
// Pat = MASQUE_Patient_v0_3.jsx, Prb = MASQUE_Probes.js; baseline line numbers):
//   PROBES (const)              Prb L21-46 (rationale comment) and L56-143, verbatim.
//   VM_PROBES (const)           Prb L145-287, verbatim, comments included.
//   probes                      {version: Prb L290 PROBE_SET_VERSION, list: Prb L289 ALL_PROBES order}.
//                               PROBE_KIND (Prb L47-54) is engine/vocab.js; liveProbes and
//                               validateProbes (Prb L293-345) are engine/probes.js, which keeps the
//                               rescue and supporting-probe enforcement in the engine.
//   SUM (const)                 Pat L426-502, verbatim -> locales.en.sum, locales.es.sum.
//   sin, oto                    Scb L847, L848 (the Scribe complaint inputs).
//   phenotypes.derive           Scb L849: "both" when sin && oto, then "otologic" when oto. The
//                               fall-through "sinonasal" is rubric phenotypes.scribeDefault.
//   phenotypes.activation       Scb L858 (vestibular), L859 (neuro). The always-active set of
//                               Scb L857 is rubric phenotypes.alwaysActive.
//   route.strong/sinus/oto      Scr L914-916 (= Scb L1326-1328).
//   routing, 5 rules            when: Scr L917, L922, L927, L934, L941 (= Scb L1329-1333);
//                               copy.screener: Scr L918-920, L923-925, L928-930, L935-937, L942-944;
//                               copy.scribe: the object literals of Scb L1329-1333;
//                               the rationale comments Scr L932-933 and L939-940, verbatim.
//   routing no_driver           Scr L946-950, Screener only (Scb buildRecs, L1324-1335, has none).
//                               The gates ahead of these rules (Scr L895-913: red-flag override and
//                               incomplete screen; Scb L1325 with L928-930: not scorable or routing
//                               not cleared) are engine-owned (engine/rules.js routingRecs).
//   patientSummary.groups       Pat L919 (mig), L926 (vOther), L929 (neu), L936 (disc).
//   patientSummary.derived      Pat L940 (migPattern), L941 (vestPattern).
//   patientSummary.said         Pat L910-937: the 16 pushes, in order.
//   patientSummary.ask          Pat L945-953: the 9 pushes, in order; the if/else of L945-946 is
//                               two mutually exclusive rules (askBoth, askMig); askNext has no `when`.
//                               The rationale comment Pat L942-944 is kept verbatim above askBoth.
//   Elsewhere, not in this file: the gap line (Pat L955-958; engine + rubric gapRule, which calls
//   sum.gap with its booleans in reads.gapMarkers order); unsureList and the clinician block
//   (Pat L960-972, engine); referral (Scr L1456, Scb L1401/L1453; rubric phenotypes.referral);
//   CDS preview (Scr L1329-1349; rubric cds.preview + engine cdsPreview); suggestion ranking
//   (Scb L860-879, engine scribe.js).
//   reads                       design §3.8: every item, domain, flag, phenotype value and gap
//                               marker any closure or probe reads or writes.
//
// Closures are pure: they read only their state argument (or a probe's two frozen arguments)
// and the constants of this file.
```
