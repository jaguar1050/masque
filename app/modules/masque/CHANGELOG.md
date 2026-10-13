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
| Lexicon | 0.3.3 | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.4.0 (lexicon 0.3.3) | `masque.rubric.json` `lexicon.goldSet`; the file is `app/tests/fixtures/goldset/masque_extraction_goldset_0.4.0.json`, which includes gold set 0.3.0 (`masque_extraction_goldset_0.3.0.json`, unchanged) by its SHA-256 (both local-only, never deployed) |

The release (screenAIr's own) is `APP_VERSION` in `app/src/engine/policy.js`: 0.4.8 since
2026-10-12 (the clinical lead's three fixes of 2026-10-12: the `r_dur` clinician question, the
Patient Companion's introduction video and the English version of a Spanish summary; see the 0.4.8
entry). Before it: 0.4.7 (2026-10-11, chart-text capture and the clarification prompts; its rows
were decided by the clinical lead on 2026-10-12), 0.4.6 (2026-10-10, the
clinical lead's answers on the EMR template's open items), 0.4.5 (the clinical lead's referral rule for dizziness cases, decided from 2026-10-07
to 2026-10-10), 0.4.4 (2026-10-07, the record of the clinical lead's sign-off of the EMR template content),
0.4.3 (2026-10-06, the EMR Friendly Template), 0.4.2 earlier the same day and 0.4.1. Release 0.4.3
also carries the Patient `.txt` thin warning and engine round 3d, both made in separate sessions
on 2026-10-06 and integrated on 2026-10-07 (see the 0.4.3 entry). The label's "v1" is display
copy, not a version axis. None of 0.4.3, 0.4.4, 0.4.5 and 0.4.6 moves another axis; 0.4.7
moves the lexicon (0.3.2 → 0.3.3) and the gold set (0.3.0 → 0.4.0); 0.4.8 moves no other axis
(an item's clinician question is outside `instrumentHash` and `scoringHash`).

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

## 2026-10-11 to 2026-10-12: release 0.4.7, chart-text capture and the clarification prompts (signed off by the clinical lead on 2026-10-12)

Release screenAIr 0.4.7 (0.4.6 → 0.4.7) implements the clinical lead's request of 11 October 2026:
a large scrollable capture box, chart text (a history and physical) read properly, endorsement and
denial verbiage that triggers the criteria properly, and a section that asks the clinician to
clarify unclear verbiage. Lexicon 0.3.2 → 0.3.3 and gold set 0.3.0 → 0.4.0. Instrument 0.2 and
probe set 1.0.0 are unchanged, and `masque.logic.js` is not touched, so `logicSha256` is
unchanged. The lexicon gains two keys (`clauses`, `clarify`) and four negation cues, and the rubric
gains one change-log entry (kind `lexicon`, `/changelog/14`), so `lexiconHash`, `contentHash` and the
rubric's bytes change. `instrumentHash` and `scoringHash` (`32cc4f44…`) do not move, and the
illustrative calibration still applies.

**Signed off by the clinical lead on 2026-10-12.** The lead chose "Draft, you sign off" (below), so
every cue list and clarification trigger the lead did not name was drafted by the team and listed at
the end of this entry. On 2026-10-12 the lead decided every row of that list on the sign-off page
(278 approved, 18 struck), answered its 19 Part D questions and two follow-up questions in chat, and
wrote "done, re-rest and upload 0.4.7". The decisions are applied as given ("Clinical-lead sign-off
(2026-10-12)", near the end of this entry): every drafted row left is marked `source:
"lead-approved"`, the struck rows are gone, the rows the lead approved in the answers are added, and
`LEXICON_DELTA_033.signOff` records every outcome. The review of the release (rounds 1, 2 and 3, below)
changed the chart-reading rules and added draft rows before the sign-off. Review round 2 kept chart
reading to typed chart text; since the lead's decision D9 of 2026-10-12 it reads spoken and demo lines
too.

### The request (verbatim, 2026-10-11, chat)

The user, who is the project's clinical lead, wrote:

> Make the patient capture statement a large textbook that is scrollable.
>
> The patient capture statement also does not parse through chart text fully. For example the following history and physical flags pulsatile tinnitus even though the chart says "not pulsatile": [the H&P in `app/tests/dev/hp-example.txt`]
>
> Ensure verbiage for endorsements (e.g. endorses, reports, has, yes) and denials (e.g. denies, no, lacks, doesn't have) properly triggers criteria.
>
> Create a section after inputting the text where the program prompts the user for clarification on unclear verbiage, e.g. a generic "runny nose" report should prompt the clinician to ask "is the rhinorrhea clear or purulent?"

The history and physical the lead pasted is kept verbatim as `app/tests/dev/hp-example.txt` and as
gold set 0.4.0 case `k001`. It is a template with `***` placeholders and holds no patient data.

### The lead's answers (verbatim, 2026-10-11)

The lead then answered three questions in the same chat. The questions, the chosen options and the
answers are kept verbatim in `app/tests/harness/lexicon-delta-033.js` (`request`, `decisions`).

- **Red flags.** Question: "When the chart text denies a red flag (e.g. "tinnitus is not
  pulsatile"), what should happen? Today red flags are never negated, by design, so nothing can hide
  one." Answer:

  > Don't raise, no listing

  The option read: "A clear denial simply does not raise the flag."
- **Answers.** Question: "In the clarification section, should the clinician be able to answer each
  prompt with a click?" Answer:

  > Clickable answers (Recommended)

  The option read: "Each prompt shows the question and the item's own answer options (e.g. Clear /
  Purulent); a click records the answer as recorded by the clinician."
- **Wording.** Question: "New cue words and clarification questions are lexicon content, which the
  project rules say must come from you. How should I source them?" Answer:

  > Draft, you sign off (Recommended)

  The option read: "I use your examples verbatim, draft the rest (questions taken from the module's
  own item wording where possible), test, and show you the full list to approve before anything is
  uploaded."

**What the lead named, used verbatim:** the affirm cues "endorses", "reports", "has" and "yes"; the
deny cues "denies", "no", "lacks" and "doesn't have"; and the question "is the rhinorrhea clear or
purulent?", stored and shown as written, never re-cased. "has" and "no" are stored with their
boundary space (`has `, `no `), so they do not match "hash" or "nose". Everything else is a draft.

**This reverses an upstream rule.** Until now red flags were never negated:
`reference/MASQUE_v0.3.1/changelog/CHANGELOG_fix02_red_flags.md` says capture "may only ever raise a
flag, never clear one", and a denial still raised the flag. With `clauses.redFlagNegation` on (the
lead's decision), a red flag whose every mention is denied is neither raised nor listed. One
undenied mention still raises it, and sections, hedges and placeholders never lower a flag. Capture
still never clears a flag that is already raised, so the Safety strip's wording stays true and is
unchanged. From review round 2 until the lead's decision D9 of 2026-10-12 all of this held in typed
chart text only, and a spoken line raised every flag phrase as before. Since D9 it holds in spoken
and demo lines too (with the reply-word rule: "D7 and D9" under "Clinical-lead sign-off
(2026-10-12)"), so gold set 0.4.0 supersedes the reference label r02 ("No, I've never had double
vision or anything like that." → `rf_focal`) and four other outputs ("Gold set 0.4.0" below). The
reference file itself is unchanged.

### What changed

**Extraction engine (`engine/extraction.js`).** All new behaviour is opt-in lexicon data and does
nothing when absent. The frozen baseline and the lexicons equivalent to 0.3.1 and 0.3.2 extract
exactly as before: extraction block 1 (strict, 35,364 comparisons) is unchanged, and the default-off
proofs run 2,000 seeded utterances on each. `EXTRACTOR_KIND` is unchanged; `EXTRACTOR_FEATURES`
gains `clauses` and `clarify`. With `lexicon.clauses`, in typed chart text (`opts.chart`) and, since
the lead's decision D9 of 2026-10-12, in spoken and demo lines too (review round 2 had kept it to
typed chart text; design `docs/refactor/06-chart-capture.md`):

- **Segmentation.** The text is read in lines, section headers (`clauses.sections`), labels ("CC:",
  "ROS:"), wrapped lines and clauses. A clause ends at `.` `!` `?` or `;` followed by whitespace, at
  a line end that is not a wrap, after a label and before a `clauses.breaks` cue (review round 3:
  also before a second "Label:" on a line, and never at the "." of an abbreviation inside a
  sentence). A clause never crosses a header.
- **Matching.** Every phrase and every negation, attribution and history cue matches only at a
  word start (`wordStart`). The `clauses` cue lists match as whole words (a word start and a word
  end), so the lead's "yes" never reads at the start of "yesterday". A hit inside a `mask` word is
  no hit, so "aura" inside "aural" no longer counts.
- **Negation**, for a hit, the first that applies: the lexicon's window clipped to the clause (an
  affirm cue between the negation cue and the hit keeps it affirmed); a `prefix` cue glued to the
  hit ("non-positional": the mention is dropped, never recorded as a denial); a `deny` cue earlier
  in the clause with no affirm cue between them (a list denial); a `post` cue after the hit
  ("Photophobia: no"). Review rounds 1 and 3 (below) narrowed the list denial, the post cue and
  the label answers.
- **All mentions, in text order.** A yes/no item mentioned only affirmed records yes and only
  denied records no. One finding said both ways (the same phrase, or two of the item's phrases
  whose spans overlap) records nothing and is asked instead (a conflict card). When different
  phrases of the item disagree, the affirmed mention wins, except for the rule-out items
  (`strictConflict`), where any affirmed and any denied mention is a conflict. Context, scale and
  multi-answer entries take the first undenied mention in text order. A heard entry takes its
  duration only from its cue's own clause.
- **Sections.** Nothing captures under an allergy or medication header. Under a family-history
  header every capture is attributed to someone else (`m_fhx` excepted). Under an exam header only
  the `examItems` capture: none since review round 2 (it named `r_normal` and `x_objective`).
- **Hedges and placeholders.** A hedged clause, or one holding unfilled template text, records
  nothing; each is asked instead.
- **Red flags** (`redFlagNegation`): as above; since review round 1 only a denial that governs the
  flag phrase directly lowers a flag (narrowed in review round 3; Part D of the sign-off list gives
  the exact conditions).
- **Evidence.** Each capture's evidence is its clause, with `clause: {start, end}` added.
- **Typed chart text.** `extractInContext(…, {chart: true})` never consumes, refuses, carries into or
  arms a carry-over slot, for any lexicon (with `lexicon.clauses` or not). With `{chart: true}`
  (`extract`, `extractInContext` and `clarifyCues`) the attribution cues listed in
  `clauses.chartIgnoreThirdParty` ("her ", "his ") do not gate when a finding follows them: in a
  chart note they name the patient. Before any other word, relatives and every other cue still
  gate (review round 1).
- **One decision of the data stage.** A duration stated in another sentence of the same line still
  withholds the heard entry, as before chart reading, so no normal carry-over slot opens. Without
  this, three voice dialogues (d077, d092, d093) carried the next reply in as the episode duration,
  for example "All week." as Over 72 h. Since review round 2 voice lines carry exactly as in 0.4.6
  (since D9 they are read with chart reading but keep their carry-over and release 0.4.6's band
  choice), so the decision applies to typed text only, which never carries.

**Clarifications (`clarifyCues`, `clarifyPrompts`).** `extraction.clarifyCues(lexicon, text)` runs
outside `extract`, so no capture, carry-over slot, gold label or benchmark depends on it. It returns
four kinds of cue:

- **trigger:** a `lexicon.clarify` phrase in a clause that is not denied, attributed, historical or
  a placeholder, and holds none of the entry's `unless` qualifiers (since review round 3 only an
  undenied qualifier counts, and a mention set aside as uncertain still asks);
- **hedge:** an item mentioned only in hedged clauses;
- **conflict:** a yes/no item with one finding both affirmed and denied (for a rule-out item, any
  affirmed and any denied mention);
- **placeholder:** one cue for unfilled template text.

`scribe.clarifyPrompts` turns the cues into cards, in text order and one per target. It drops a card
whose probe or item is already answered or skipped (since review round 1: a rescue probe's card
only while the probe is live, as on the Ask next rail). The question is the entry's `ask` (only the
rhinorrhea entry has one, the lead's question), else the probe's `say`, else the item's `ask`, all
module text verbatim. The answers are the probe's options or the item's own options. Clarifications
are not probes (the probe set stays 1.0.0), not captures and not note lines.

**Validator and contract.** V28 checks `clauses` (keys, switches, `{ph, source}` lists, sources,
sections, `examItems`, `placeholderAsk`, `chartIgnoreThirdParty` against the lexicon's attribution
cues, `strictConflict` against the negative domains) and `clarify` (keys, ids, `ph`, `unless`, exactly one of
`probe` or `item`, the probe against the logic, `ask`, `source`). V29 checks every new phrase list,
which may carry one boundary space at most (a short cue of a whole-word list, such as the scopeEnd
cue "so", is no warning since review round 1). No new V-code was needed; 54 mutation generators and a
control cover the rules (review round 2: `clauses.redFlags`, every key a red flag of the module, and
an `examItems` list that may be empty; review round 3: the `complement` list). `contract.js` gains `LEXICON_CLAUSES_KEYS`, `LEXICON_CLAUSE_LISTS`,
`LEXICON_SECTION_KINDS`, `LEXICON_SOURCES`, `LEXICON_ASK_SOURCES`, `LEXICON_CLARIFY_KEYS` and the
typedefs (review round 1: the key and list `scopeEnd`, the section kind `read`; review round 3: the
key and list `complement`).

**Lexicon 0.3.3 (module data).** The change is `app/tests/harness/lexicon-delta-033.js`, the second
link of the delta chain. `lexicon-delta.js`, the approved 0.3.1 → 0.3.2 record, is untouched. The
extractor applies the new delta after the 0.3.2 one and proves it by revert. It holds:

- `clauses`: 268 phrase rows (8 the lead's, 260 drafts; 27 of them, `scopeEnd` and
  `sections.read`, from review round 1; 139 from review round 2, 111 of those the chart-register
  red-flag phrases of the new list `clauses.redFlags`; and 12 from review round 3: the new list
  `clauses.complement`, three breaks, the deny cue "rather than" and the `rf_focal` phrase "slurred
  speech"), the draft switches `wordStart`,
  `placeholderAsk`, `examItems` (empty since review round 2) and `strictConflict`, and
  `redFlagNegation` (the lead's decision);
- `clarify`: 14 entries (`cl_scan_report` and `cl_audiogram_report` from review round 2);
- four draft negation cues, `wasn't`, `weren't`, `aren't` and `hadn't`, because under `wordStart` the
  0.3.2 cue "n't" no longer reads inside a contraction.

There is one basis per row, switch, entry and appended negation cue (294 in all since review round
3; 282 after review round 2; 142 after review round 1, which gave the four appended cues their own
basis rows).

**Ambient Scribe (`apps/Scribe.jsx`).**

- **The box.** The one-line box is now a textarea: 8 rows, at least 200 px, at most 60% of the
  window height, resizable vertically, scrolling. Enter adds a line; Ctrl or Cmd+Enter captures
  (never while an input method is composing). The button still reads "Capture". Typed text is
  chart text (`chart: true`), for its captures and its clarification cues alike.
- **The Clarify section.** It appears under the box only when it has cards. Each card quotes the
  clause, asks the question and offers one button per answer, plus Skip (since review round 2 the
  template-text card is a notice with one Dismiss control). Probe cards answer through
  the probe path, so flags are only raised and the EMR note's "recorded by clinician via probe"
  label is unchanged. Item cards answer through the item path.
- **Never asked twice.** While a card is open, its probe leaves the Ask next rail and its item (a
  rescue probe's: the item it re-asks) leaves the suggestions, the heard cards and, since review
  round 1, the rail's other probes for that item.
- **Transcript and reset.** Patient bubbles keep their line breaks. Clarify tags on a bubble have
  their own class and are never capture tags. Reset clears the cards and the draft, and an
  uncaptured draft counts as "text not yet captured". The app names no module id.

**The lead's history and physical** (gold set 0.4.0 case k001, read as typed chart text with
`extract(lexicon, text, {includeHeard: true, chart: true})`):

| | Lexicon 0.3.2 (release 0.4.6) | Lexicon 0.3.3 (release 0.4.7) |
|---|---|---|
| `rf_pulsatile` | raised ("not pulsatile": red flags were never negated) | not raised, not listed |
| `m_aura` | yes, from "aura" inside "aural fullness" | not recorded since the sign-off: the lead struck the mask "aural" (and kept it struck when told this effect), so "aural fullness" states aura and "denies auras" denies it, one finding said both ways (a conflict card); before the sign-off, no |
| `x_purulent`, `x_anosmia` | yes: "Denies" is 140 or more characters back, outside the window | no (list denial) |
| `v_head` | yes, from "non-positional" | not recorded (`prefix`) |
| `n_allo` | yes, from the exam's "light touch" | not recorded (exam section) |
| `m_head` | 1 (Occasional), from "known headaches" | not recorded: "Reportedly has known headaches." is hedged, so a card asks |
| `v_vertigo` | 2, from "minutes to hours" elsewhere in the note | heard: the dizziness clause states no duration |
| `m_photo`, `v_aural` | yes | yes |
| `r_normal` | yes, from the exam's "within normal limits" | not recorded (exam section; review round 2: until then `r_normal` was an exam item and was recorded) |
| Evidence | the whole note, for every capture | the capture's own clause |
| Clarify cards | none | 11 since the sign-off, in text order: which ear (`pr_laterality`), ear pain (`n_otalgia`), unfilled template text (a notice since review round 2), sudden hearing drop (`pr_sudden_drop`), audiogram (`pr_audiogram`), aura stated both ways (`m_aura`, conflict; since the sign-off), headache (`m_head`, hedge), tinnitus quality (`pr_tinnitus_quality`; review round 3: "not pulsatile" no longer silences it), kind of dizziness (`pr_internal_vertigo`), neck (`pr_neck`), HINTS (`pr_head_impulse`) |

The lead's runny-nose example, "Reports runny nose.", asks the lead's question word for word, with
`pr_purulence`'s two answers. "Yes, purulent or culture-positive" writes `x_purulent` yes; "Clear or
no drainage" writes no.

The rubric's change-log entry, verbatim (rewritten at the sign-off and dated 2026-10-12, the day of
the lead's decisions):

- **lexicon** (`/lexicon/version`, `/lexicon/clauses`, `/lexicon/clarify`, `/lexicon/goldSet`, `/lexicon/negation/cues`): Lexicon 0.3.2 → 0.3.3 (release 0.4.7), from the clinical lead's request and decisions of 2026-10-11, signed off by the clinical lead on 2026-10-12 (sign-off page and chat): every row the team drafted and the lead approved is marked lead-approved; the 18 rows the lead struck are gone (the mask aural, kept struck after the lead was told that "aural fullness" then reads as aura; the chart red-flag phrases sudden onset headache, sudden-onset headache, facial numbness, aphasia, vision loss, visual loss, visual obscuration, jaw pain with chewing, jaw pain when chewing, jaw pain on chewing, periorbital swelling, periorbital edema, periorbital oedema, orbital swelling, eye pain, pain with eye movement and pain on eye movement); and the rows the lead approved at the sign-off are added (deny: not associated with, not accompanied by, neg for; hedge: +/-; rf_progressive: progressively worse, progressively worsening, worse each week; rf_asym: left-sided hearing loss, right-sided hearing loss, asymmetric hearing loss). Chart reading (clauses) applies to every line, typed chart text, spoken and demo lines alike (the lead's decision D9 of 2026-10-12; review round 2 had kept it to typed chart text): a statement, a pasted chart note or a spoken line is read clause by clause; a clause ends at . ! ? or ; followed by whitespace (a "?" opening a clause belongs to the words after it, so "? aura" is hedged; since review round 3 the "." of an abbreviation inside a sentence ends nothing: "No assoc. nausea."), at a line end that is not a wrapped line, after a section label, before a second "Label:" on a line of labels and before a break word, and never crosses a header. Every phrase and every negation, attribution and history cue matches only at a word start (wordStart); the clauses cue lists match as whole words, so "yes" never reads at the start of "yesterday"; and a phrase lying inside a mask word is no hit (mask: number, and since review round 2 the report headers ct showed, scope showed, lund-mackay, audiogram showed, hearing test showed, which name a test rather than its result, and hay fever). A mention is denied by a negation cue within the window inside its clause with no scopeEnd word between (a negation cue holding another at its end, as "didn't" holds "n't", is measured from that cue, so a contraction keeps its 0.3.2 reach), by a deny cue earlier in its clause, or on a line heading its list ("Patient denies:" over bullets or short lines), with no affirm cue between (a list denial, which a scopeEnd word or, since review round 3, a complement word ends, and which reaches a later list item only when that item is the finding alone: a mention it does not reach is set aside, recorded neither yes nor no; a window cue reaches a later item on the same terms), or by a post cue that closes the mention's item right after it (a ":", one word, or a list of findings it closes, between); an affirm cue between a negation cue and the mention keeps it affirmed, and one governing the mention keeps a post cue from denying it; a prefix cue glued to it drops the mention without recording a denial. A negation, deny, post or prefix cue lying inside a longer affirm or hedge cue is no cue ("no relief" holds "no ", "not sure" holds "not "); an affirm cue right after a finding (only a ":" or "-" between, or nothing before a sign such as "(+)") that closes the item answers it as a label and affirms it unless a denial in the label's own item governs it, and a deny cue so placed answers its label only and opens no list; a sign between two findings with only spaces around it is the prefix of the finding after it, and a plus sign before a word affirms it (review round 3). affirm (lead: endorses, reports, has, yes; lead-approved: endorsed, reported, admits, positive for, complains of, c/o, describes, presents with, (+), and the failed-treatment cues no improvement, no relief, no response, no benefit, without improvement, without relief, without benefit, failed, refractory to, despite); deny (lead: denies, no, lacks, doesn't have; lead-approved: denied, negative for, without, does not have, don't have, do not have, haven't had, hasn't had, (-), rather than, and since the sign-off not associated with, not accompanied by, neg for); post (lead-approved: negative, denied, absent, not present, : no, : none, (-), : denies, - no); prefix (lead-approved: non-, non); breaks (lead-approved: but, however, although, though, except, whereas, —, other than, besides, apart from); scopeEnd (lead-approved: with, so, now, until, is, are, was, were, to, from); complement (lead-approved, review round 3: for, in, about, after, since, on, none of). A yes/no item mentioned only affirmed records yes and only denied records no; one finding (the same phrase) both affirmed and denied records nothing and is asked instead, while different phrases of one item that disagree record yes (the affirmed mention wins: "It's not the weather … it's when I skip meals."), except for the rule-out items (strictConflict, lead-approved: x_purulent, x_objective, x_lowfreq, x_anosmia), where a "yes" lowers the index, so any affirmed and denied mention records nothing and is asked; context, scale and multi-answer entries take their first undenied mention in text order; in typed chart text a heard entry takes its duration only from its cue's own clause (a spoken line keeps release 0.4.6's band choice). A hedged clause (hedge: reportedly, possible, possibly, probable, questionable, suspected, unclear whether, unclear if, rule out, r/o, ?, maybe, unsure, uncertain, not sure, might, and since the sign-off +/-) and a clause holding unfilled template text (placeholder: ***, ___, [ ], []) record nothing; each is asked instead. Attribution and history windows stop at the clause; relatives named in chart wording are attribution cues (thirdParty: mother, father, mom, dad, sister, brother, daughter, son, parents, sibling, aunt, uncle, cousin, grandmother, grandfather, family history of, family hx of); in typed chart text the attribution cues "her " and "his " name the patient when a finding follows them and then do not gate (chartIgnoreThirdParty, lead-approved; a spoken line reads every cue, D19), while before any other word ("Her husband has tinnitus."), relatives and every other cue still gate. Section headers (sections; exam: physical exam, physical examination, exam, examination, otoscopic exam, otoscopy, objective, vital signs; family: family history, family hx, fhx; skip: allergies, allergy, medications, medication, meds, current medications; read: hpi, history of present illness, interval history, ros, review of systems, past medical history, pmh, past surgical history, psh, social history, assessment, plan, assessment and plan, assessment/plan, a/p, impression, impression and plan): nothing captures under an allergy or medication header, every capture under a family-history header is attributed to someone else (m_fhx excepted), and under an exam header nothing captures (examItems, empty since review round 2); a read header is read normally and ends any section, an exam's own sub-labels ("HEENT:", "Neuro:") keep the exam, any other header ends a skip or family-history section, and a section word as an inline label ("Allergies: NKDA") holds for its line only. Red flags (redFlagNegation; the lead's decision of 2026-10-11): a red flag whose every mention is denied is not raised and not listed; one undenied mention still raises it, and hedges, placeholders and sections never lower one. Only a denial that governs the flag phrase directly denies it (narrowed in review round 3): a prefix; in its own list item, a window or deny cue before it with only plain words between (no complement or scopeEnd word, affirm cue or plus sign); a deny cue heading its list when its later item is the bare flag phrase; or a closing post cue right after it; a list denial that does not reach it this way ("Migraine without aura, now with worst headache of her life.") or a distant post cue ("Reports pulsatile tinnitus with negative CTA.") never lowers one. Each flag also reads chart-register phrases (clauses.redFlags, review round 2, lead-approved: e.g. sudden hearing loss, ssnhl, unilateral hearing loss, slurred speech, pulsatile wording, epistaxis, nasal mass, proptosis, painful eye movement, diplopia, facial droop, dysarthria, worse with cough, wakes from sleep, steadily worsening, scalp tenderness, jaw claudication, new headache over 50, fever, weight loss), a hit inside a longer hit of the same flag being part of it. Spoken and demo lines keep their carry-over (heard slots, carryRefuse, yieldTo) exactly as before, and in a spoken line a deny cue that opens its clause before a word starting no finding answers the clinician's question ("no it's more of a whooshing with my heartbeat") and lowers no red flag; typed chart text sets no context marker, which the clinician sets (the lead's D8 answer). Negation cues appended (lead-approved): wasn't, weren't, aren't, hadn't. Clarification prompts (clarify), read only by the clarification section, for typed chart text only, and never by extraction: when a mention lacks its qualifier the clinician is asked the module's own question with its own answers: cl_rhinorrhea → pr_purulence; cl_tinnitus_quality → pr_tinnitus_quality; cl_laterality → pr_laterality; cl_hearing_onset → pr_sudden_drop; cl_audiogram → pr_audiogram; cl_dizziness_kind → pr_internal_vertigo; cl_otalgia → n_otalgia; cl_smell → pr_smell; cl_nasal_side → pr_nasal_mass; cl_hints → pr_head_impulse; cl_neck → pr_neck; cl_viral_onset → n_viral; cl_scan_report → pr_scan_detail and cl_audiogram_report → pr_audiogram (review round 2: a masked report header asks what the report showed). Since review round 3 a qualifier the text denies resolves nothing ("not bilateral"), and a trigger set aside as uncertain still asks. Review round 2 removed from the safety entries' qualifiers every word that states the dangerous answer without raising its flag (left, right, unilateral, one ear, same ear, one side, one-sided, sudden, pulsing, pulses, heartbeat, bloody) and the test names audiogram, audiometry and hearing test. The sign-off removed the qualifiers deep (cl_otalgia), clicking and steady (cl_tinnitus_quality), progressive (cl_hearing_onset) and the positive-answer qualifiers of the rule-out entries (cl_rhinorrhea: purulent, thick, green, yellow, cloudy, discolored, discoloured, colored, coloured, culture; cl_audiogram: low-frequency, low frequency; cl_smell: between episodes, between flares, persistent, constant, all the time; cl_scan_report: scan showed inflammation, opacification, mucosal thickening, polyps; cl_audiogram_report: low frequency loss, hearing drops during, hearing comes back). cl_rhinorrhea asks the lead's question "is the rhinorrhea clear or purulent?" with pr_purulence's answers; every trigger and qualifier is lead-approved. Instrument 0.2 and probe set 1.0.0 unchanged. Gold set 0.3.0 → 0.4.0: the 0.3.0 cases and dialogues verbatim, the chart cases (the lead's history and physical, 50 catalogue rows, 14 review-fix cases k052-k065, 57 review-round-1 cases k066-k122, 64 review-round-2 cases k123-k186, 73 review-round-3 cases k187-k259 and 14 sign-off cases k260-k273) and a supersede table for the 0.2.0 and 0.3.0 outputs that lexicon 0.3.3 changes (since the lead's decision D9 five cases, each read now as a spoken line under chart reading: e16, r02, f02, t007, w019; no dialogue step).

### Four fixes before review (2026-10-11)

Four known problems of the first 0.4.7 build were fixed before review, and nothing else was
re-tuned. Each new data row is a draft and is in the sign-off list below (rows 121-122 and 276-279,
numbered as after review round 3).

1. **Pronouns in chart text.** The shipped attribution cues "her " and "his " made a chart note's
   "Her tinnitus is bilateral." or "His dizziness is episodic." read as someone else's symptom, so
   nothing was recorded. In a chart note these pronouns name the patient. The new draft list
   `clauses.chartIgnoreThirdParty` (`"her "`, `"his "`) names the lexicon's attribution cues that do
   not gate in typed chart text. The engine reads it only with `opts.chart` (typed text: the Scribe
   passes it to `extractInContext` and to `clarifyCues`); spoken and demo lines read every cue as
   before. Relatives (`clauses.thirdParty`: "Her mother has headaches." stays the mother's), "family
   history of" and the lexicon's other cues ("my mother", "they get") still gate, and `m_fhx` still
   records "Her mother gets migraines." (Corrected in review round 1: as built here, the pronoun
   before any other person, as in "Her husband has tinnitus." or "Her children have tinnitus.", did
   not gate either; it now gates unless a finding follows it.) V28 requires each row to be a cue of
   `lexicon.thirdParty.cues`. The gold set 0.4.0 chart cases are now read as typed chart text
   (`{includeHeard: true, chart: true}`), as the Scribe reads them; no earlier chart case changes.
2. **The conflict rule.** "A yes/no item affirmed and denied in one text records nothing" also
   fired when different phrases named different findings of one item: reference case n07 ("It's
   not the weather, I checked — it's when I skip meals.") lost its correct `m_trig` yes, and so
   would any item that covers several sub-findings. Now a conflict needs one finding said both
   ways: the same phrase of the entry, or two of its phrases whose spans overlap, affirmed in one
   mention and denied in another. When different phrases disagree, the affirmed mention wins and
   records yes. n07 gives its 0.2.0 output again and leaves the supersede table.

   **The rule-out items keep the strict rule** (draft list `clauses.strictConflict`: `x_purulent`,
   `x_objective`, `x_lowfreq`, `x_anosmia`, the yes/no items of the Discriminators domain). For
   them any affirmed and any denied mention is still a conflict: nothing is recorded and a conflict
   card asks. A "yes" on these items lowers the index by 5 or 8 points. Letting the affirmed
   mention win would lower the index on a chart that also denies the finding ("No purulent
   drainage. Thick discharge last month."), which can hide a positive screen. Letting the denial
   win would record a "no" that the text contradicts (absent data is never negative data).
   Recording nothing leaves the index where it was and asks the clinician (gate, don't warn), so
   it is the conservative choice for the index. V28 requires each id to be a yes/no item of a
   negative domain, and the extractor checks that the list is exactly those items.
3. **Whole-word cues.** The lead's affirm cue "yes" matched the start of "yesterday", so in
   "Denies vertigo since yesterday, nausea, photophobia." the list denial stopped and nausea and
   photophobia read yes. The cue lists of `clauses` (affirm, deny, post, prefix, breaks, hedge,
   placeholder, thirdParty) now match as whole words: at a word start and at a word end, except on
   a side where the cue's own first or last character is not a letter or digit (`"has "`, `"non-"`,
   `" negative"`, `"?"`). Symptom phrases still match as stems ("light sensitiv"), and the lexicon's
   own negation, attribution and history cues still match at a word start only. "Nausea: yes."
   still affirms.
4. **Editor locks.** `derive.js` gains lock rows for `/lexicon/clauses` and `/lexicon/clarify`, with
   the "approved lexicon configuration" wording of the other capture locks (reworded in review round
   1: the rows are drafts, not approved) and no clinical-lead claim (the `editor` suite checks both, and that neither path is editable). The Rubric Editor's
   lexicon section shows both fields as read-only summary lines (`data-clauses-config`,
   `data-clarify-config`), as it shows `normalize`.

Tests: 17 new chart-reading cases and 6 clarification cases on the neutral fixture of the `capture`
suite (both directions of each fix), the default-off proof extended to `opts.chart`, 14 new gold
set 0.4.0 chart cases (`k052`-`k065`), AD18 rule P (below) with a 20th self-check, 8 new mutation
generators, two new `render-scribe` blocks (a typed "Her tinnitus is bilateral." records `v_aural`
and shows the tinnitus-quality card; the same line spoken records nothing) and 44 new `editor`
checks.

### Review round 1 (2026-10-11)

The review of the release found the problems below, each confirmed in the browser. Each is fixed at
its root cause and pinned by tests in both directions. Every new data row is a draft in the sign-off
list (rows 59-68 and 140-156, and the bases of rows 269-272, numbered as after review round 3), so the release still waits for the
lead's sign-off and nothing is uploaded. The frozen-baseline parity stays strict, and the lead's
history and physical gives exactly what it gave before the round (the same captures, set-aside
mentions and nine cards).

1. **Red flags hidden by a denial of something else** (critical). With `redFlagNegation` a flag was
   dropped whenever the general negation rules read its phrase as denied. So a denial earlier or
   later in the clause hid it: "Vertigo without hearing loss, with double vision and slurred
   speech.", "Migraine without aura, now with worst headache of her life.", "No relief with
   meclizine, now with pulsatile tinnitus.", "Reports pulsatile tinnitus with negative CTA head and
   neck." and "Not relieved, worse lying down." raised nothing, in chart and spoken lines alike,
   where 0.4.6 raised every one. The lead's decision covers a clear denial. A flag is now lowered
   only by a denial that governs its phrase directly:
   - a prefix ("non-pulsatile");
   - a window cue with nothing but other words between ("Tinnitus is not pulsatile", "Denies
     pulsatile tinnitus"): no comma, ";", ":", "/", joining word, finding, affirm cue or scopeEnd
     word between;
   - a deny cue naming it first in its own list item, or first in a later item of the same list,
     with no finding before it there, at most two other words before it and one after ("No vision
     loss, diplopia, facial droop, weakness, or slurred speech." and "Denies double vision, slurred
     speech, facial numbness, or weakness." still lower `rf_focal`);
   - a post cue that closes its item right after it ("Pulsatile tinnitus denied.").

   A list denial that does not reach the flag this way, a distant or unclosed post cue, and a mention
   set aside (fix 3) never lower a flag.
2. **A denial heading a list of lines** (major). "Patient denies:", "Denies:", "Negative for:" or a
   bare "Denies" over bullets or one item per line opened no scope, so every listed symptom read yes.
   Such a line now heads a list: it holds a deny cue, no affirm cue after it and no finding, and it is
   a header or ends with that cue. Its bullet and deeper-indented lines, and under a header its plain
   lines of at most four words with no cue and no scopeEnd word, read as if the denial opened them,
   until a blank line, a header or any other line. "Negative for:" over "- nausea", "- aura",
   "- double vision" records `m_nausea` and `m_aura` no and raises no `rf_focal`.
3. **List denials and post cues that reached too far** (major). A deny cue reached to the clause end,
   and a post cue anywhere later in the list item. "No interpreter available, so nausea, photophobia
   and tinnitus were not reviewed." recorded all three as no; "Nausea and vomiting negative."
   recorded `m_nausea` yes; "Photophobia: no change since last visit." recorded `m_photo` no; and
   "Positional vertigo with negative Dix-Hallpike." recorded `v_head` no. Now:
   - **scopeEnd.** A new draft list `clauses.scopeEnd` (with, so, now, until, is, are, was, were, to,
     from, rows 59-68) ends a list denial. A scopeEnd word between the deny cue and the mention, or
     after the mention in a later list item, stops it. A mention the denial does not reach is set
     aside: it records neither yes nor no (`suppressedBy: "scope"`), so absent data is never
     negative data. A window cue with a scopeEnd word between it and the mention does not reach it
     either.
   - **Post cues.** A post cue denies a mention only when it closes the mention's item (the clause
     end, punctuation, "and" or "or" after it). It must stand right after the mention, with only a
     ":", one other word ("Positional testing negative.", catalogue PN3) or a list of findings it
     closes between ("Nausea, photophobia: negative." denies both). An affirm cue governing the
     mention keeps a post cue from denying it. An affirm cue later in the clause that names no
     finding takes the denial back ("Pulsatile tinnitus previously denied, now endorsed.": set
     aside).
4. **Exam sub-labels and inline section labels** (major). An all-capitals sub-label inside an exam
   ("HEENT:") ended the exam, so a normal sensory exam recorded `n_allo` yes. An inline "Allergies:
   NKDA", "Medications: …", "Exam: …" or "Family history: …" silenced or gated every line below it,
   with no sign on screen. Now:
   - a header inside an exam is a sub-label and keeps the exam, whatever its case;
   - a new draft section kind `read` (rows 140-156: hpi, history of present illness, interval
     history, ros, review of systems, past medical history, pmh, past surgical history, psh, social
     history, assessment, plan, assessment and plan, assessment/plan, a/p, impression, impression and
     plan) is read normally and ends any section, so an assessment after the exam is read;
   - any other header ends an allergy, medication or family-history section;
   - a section word as an inline label holds for its line and its wrapped continuation only.
5. **The rescue card** (major). The Clarify card for `pr_internal_vertigo`, a rescue probe that
   re-asks `v_vertigo` only while it is unanswered or 0, stayed open after `v_vertigo` was recorded.
   Answering it overwrote the recorded duration (5 min – 72 h became Under 5 min). `clarifyPrompts`
   now shows a rescue probe's card only while the probe is live as Ask next reads it (`liveProbes`,
   its `when`). It drops any other probe's card when its target is answered or an option would write
   an answered item. A rescue's item counts as its target, so the card and the item's heard or
   suggestion card are one target. In the Scribe an open card also holds the rail's other probes for
   its item: the strict-conflict card for `x_anosmia` and the rule-out probe `pr_smell` were both
   shown.
6. **Pronouns before a person** (major). As first built, `chartIgnoreThirdParty` made "her " and "his "
   never gate in chart text. So "Her husband has tinnitus.", "His wife reports dizziness.", "Her
   friend has vertigo lasting hours." and "Her children have tinnitus." were recorded as the
   patient's, although the fixes before review said relatives and the other cues still gated. Now
   the pronoun names the patient only when a finding follows it ("Her tinnitus is bilateral."); before
   any other word it gates as in speech. The cost: "Her symptoms include tinnitus." records nothing in
   chart text, as in 0.4.6.
7. **Contractions** (major). Under `wordStart` the 0.3.2 cue "n't" no longer read inside "didn't",
   and the full-word cues start three characters earlier. So 276 of 672 templated denials ("I didn't
   have any nausea.", "Patient doesn't report thick discharge.") flipped from no to yes, and AD18's
   rule Wc excused the flip. A negation cue that holds another negation cue at its end is now
   measured from that cue, so every contraction keeps exactly its 0.3.2 reach. Wc no longer excuses
   such a cue (a contraction that is no cue, such as "can't", still is). Gold cases v025 and v042 give
   their 0.3.0 labels again and leave the supersede table. The basis of the four appended
   contractions is corrected, and each has its own basis row.
8. **A leading "?"** (major). "? aura - pt unsure." ended an empty clause at the "?", so "aura" was
   recorded yes. A "?" with no word before it in its clause now belongs to the words after it, which
   it hedges.
9. **Offsets after "İ"** (minor). Lowercasing "İ" gives two characters, which shifted every later
   offset (wrong `cueIndex` and `cueText`, possibly the wrong clause). Chart reading now lowercases
   without changing the length.
10. **Wording and records** (minor).
    - The lock rows and the Rubric Editor's read-only lines no longer call `clauses` and `clarify`
      "approved lexicon configuration". They say each row is tagged with its source (lead, module or
      draft).
    - The Clarify caption read " · the text names these without the detail the screen needs — ask,
      then record the answer; nothing is recorded until you do", which is wrong for hedge, conflict
      and placeholder cards. It now reads " · the text leaves these open; nothing is recorded until
      you answer". It, the "and" joining a conflict card's two quotes and the new screen-reader
      status are rows C9-C11 of the sign-off list.
    - The chart-case counts in SOURCES ("51") and in the rubric's change-log note ("50 catalogue
      rows") were stale; both now count every chart case.
    - `opts.chart` is not inert without `lexicon.clauses`: `extractInContext` with it never carries,
      for any lexicon (spec §3.8). The extractor's header, 02 and 06 said otherwise. They now say so,
      and the capture suite pins it on the lexicon equivalent to 0.3.2.
11. **Tests that could not catch a wrong clause** (minor). AD18's evidence rule and the capture
    suite's evidence checks accepted any clause consistent with its evidence. Both now also require
    the clause to hold the capture's `cueIndex`; AD18 also requires that the clause neither starts nor
    ends inside a word. Two new self-check pairs prove it.
12. **The Clarify section for assistive technology** (minor). An always-mounted, visually hidden
    status ("2 questions to clarify") announces the cards. The section is a region labelled
    "Clarify", and each card is a group named by its question. After an answer or Skip, focus moves to
    the card now in its place, or back to the box when none is left.

Tests:
- `capture`: 40 new chart-reading cases on the neutral fixture (both directions of each fix), 4
  `clarifyPrompts` checks (rescue liveness, one target), the cue-holding check on every chart case,
  and the `opts.chart` pin on the lexicon equivalent to 0.3.2;
- gold set 0.4.0: 57 new chart cases (`k066`-`k122`) and 2 supersede rows fewer;
- `extraction`: block 3's own corpus gains scopeEnd, pronoun and list frames; AD18's rule L reads
  scopeEnd, its sentences treat a leading "?" as the engine does, and Wc is narrowed; 2 new self-check
  pairs and 4 contraction checks;
- `render-scribe`: one block (rescue-card liveness through the Scribe, never twice on a rule-out
  conflict card, the section's accessibility and focus) and the updated typed-chart check;
- `editor`: the lock wording;
- `validate`: a short cue of a whole-word `clauses` list is no V29 warning, so the mutation for a
  short cue now uses a mask word, which is still matched inside words.

A sensitivity run with the old `scribe.js` and `Scribe.jsx` failed 12 checks of `render-scribe`.

### Review round 2 (2026-10-11)

The second review found that chart reading also ran on spoken and demo lines, that chart-worded red
flags had no phrases while the clarification qualifiers silenced the safety cards, and that several
chart forms of the reviewers' held-out corpus read wrongly (treatment failure, chart notation,
report headers, exam lines). The lead's working choice stays "Draft, you sign off". Every new
phrase, cue and question below is a draft row with a basis, its basis starting "(review round 2)" in
the sign-off list. Nothing is approved beyond the lead's own words and decisions, and nothing is
uploaded before the lead signs the list off.

1. **Chart reading is for typed chart text only** (critical). `lexicon.clauses` (word starts, masks,
   sections, post and prefix cues, list scope, label answers and red-flag negation) now applies only
   to text read with `opts.chart`, which is what the Scribe's box submits. A spoken or demo line
   extracts exactly as in release 0.4.6, whatever the lexicon's `clauses` hold: the same captures,
   the same evidence (the whole utterance), the same carry-over, and red flags never lowered. A new
   `extraction` block 4 proves it. It loads the frozen 0.4.6 engine
   (`app/tests/fixtures/engine-0.4.6/`, the git blobs of `f57780b`, SHA-256 pinned, local-only) with
   the lexicon equivalent to 0.3.2, and this engine with lexicon 0.3.3 and no `opts.chart`. The two
   are deep-equal over the 44 reference cases, the 218 cases and 93 dialogues of gold set 0.3.0, the
   module's demo transcript, the baseline Scribe's script, the 186 chart cases read as spoken lines,
   block 3's cue texts and 5,000 synthetic utterances. That is 17,399 extract comparisons and 220
   `extractInContext` steps compared whole.
   - AD18 now excuses only comparisons of typed chart text. Block 3's 117,333 spoken comparisons of
     lexicon 0.3.2 and 0.3.3 are strict, and all are identical.
   - `clarifyCues` stays typed-only: the Scribe calls it for typed text, with `opts.chart`. Without
     it, `clarifyCues` reads the triggers structurally and gives no hedge, conflict or placeholder
     cue.
   - The supersede table of gold set 0.4.0 is empty: its seven rows were spoken cases.
   - Reference case r02 raises `rf_focal` from speech again, as the reference file says.
   - The data stage's rule that a duration in another sentence blocks carry-over applied to voice
     lines only through chart reading. Voice lines now carry exactly as in 0.4.6.
   - In typed text the lead's decision holds as before: a clearly denied red flag is not raised.
2. **Chart-register red flags** (critical). A new draft list `clauses.redFlags` gives each of the
   twelve flags chart wording, read in typed chart text only (111 phrases; rows 157-268 as numbered after review round 3, which added row 177). Each phrase
   is taken from the flag's own text: "sudden hearing loss", "ssnhl", "unilateral hearing loss",
   "asymmetric hearing", "pulse-synchronous", "epistaxis", "unilateral nasal obstruction", "nasal
   mass", "periorbital swelling", "proptosis", "pain on eye movement", "eye pain", "diplopia",
   "facial droop", "dysarthria", "worse with cough", "worse with valsalva", "wakes from sleep",
   "steadily worsening", "sudden severe headache", "scalp tenderness", "jaw claudication", "new
   headache after age 50", "fever", "weight loss" and the others in the list.
   - A hit inside a longer hit of the same flag is part of it, so the shipped "droop" inside "facial
     droop" does not escape a list of negatives.
   - A draft mask ("hay fever") keeps "fever" from raising `rf_systemic`, and word starts keep
     "febrile" out of "afebrile".
   - The safety clarification entries lose every qualifier that states the dangerous answer without
     raising its flag: `cl_laterality` (left, right, unilateral, one ear, same ear),
     `cl_hearing_onset` (sudden), `cl_nasal_side` (one side, one-sided, unilateral, left, right),
     `cl_tinnitus_quality` (pulsing, pulses, heartbeat) and `cl_rhinorrhea` (bloody). A stated
     dangerous detail now raises its flag through a phrase or leaves the card visible; it never
     silences the card. `cl_tinnitus_quality` keeps "pulsatile" and "whooshing", which are
     `rf_pulsatile` phrases, and the safe answers stay qualifiers (bilateral, both ears, alternating,
     gradual, steady, clicking).
3. **Treatment failure** (major). New draft affirm cues "no improvement", "no relief", "no
   response", "no benefit", "without improvement", "without relief", "without benefit", "failed",
   "refractory to" and "despite" (rows 14-23). A new engine rule protects their scope: a negation,
   deny, post or prefix cue lying inside a longer affirm or hedge cue is no cue. "No improvement with
   antibiotics." records `r_abx` yes (it read no) and "No benefit after sinus surgery." records
   `r_surg` yes. "No antibiotics to date." still records `r_abx` no.
4. **Chart notation and hedges** (major). New drafts: the deny cue "(-)", the affirm cue "(+)", the
   post cues "(-)", ": denies" and " - no", the placeholders "[ ]" and "[]", and the hedges "maybe",
   "unsure", "uncertain", "not sure" and "might". A new engine rule reads label answers: a cue right
   after a finding, with only a ":" or "-" between (or nothing, before a sign such as "(+)"),
   answers that finding.
   - An affirm cue so placed affirms the finding, whatever else would deny it ("Denies nausea,
     photophobia: endorses.").
   - A deny cue so placed answers its label only and opens no list ("Aura: (-), nausea" records
     nausea yes).
   - An affirm cue that answers another finding's label no longer takes a post cue back ("Aura (-),
     nausea (+).").

   So "(-) aura", "Aura: (-)", "Nausea: denies", "Nausea: denied" and "Nausea - no" read no, and
   "(+) photophobia" and "Photophobia: (+)" read yes. "Nausea: [ ]" or "Nausea: ___" records nothing
   and shows the template notice. "Nausea maybe sometimes." is asked, not recorded. "Not sure if the
   tinnitus is pulsatile." still raises `rf_pulsatile`, because the hedge shields its "not " and a
   hedge never lowers a flag.
5. **Report headers** (major). New draft masks for the rule-out phrases that name a test rather than
   its result: `x_objective`'s "ct showed", "scope showed" and "lund-mackay", and `x_lowfreq`'s
   "audiogram showed" and "hearing test showed" (rows 78-82). In typed chart text they capture
   nothing by themselves. A result phrase in the same text still does: "CT showed mucosal
   thickening" records `x_objective` yes.
   - Two draft clarification entries ask what the report showed: `cl_scan_report` (pr_scan_detail's
     question) and `cl_audiogram_report` (pr_audiogram's). Clarification triggers are matched
     without the mask.
   - `cl_audiogram` no longer counts the test names "audiogram", "audiometry" and "hearing test" as
     resolving it.
   - Held-out H09 now records `x_objective` no from the endoscopy line instead of showing a conflict
     card.
6. **Exam items** (major). `clauses.examItems` is empty, so nothing is captured inside an exam
   section.
   - The lead's history and physical no longer records `r_normal` from "lids, lashes and lacrimal
     glands within normal limits".
   - An office exam line ("Nose: no polyps.") no longer answers `x_objective`.

   Part D asks the lead whether a normal exam may answer `r_normal` or `x_objective`.
7. **The template-text card** (minor). The placeholder card is now a notice. It quotes the line and
   shows the draft text "This line holds unfilled template text (***)." (`clauses.placeholderAsk`,
   row 274). Its one control is "Dismiss" (row C12), with no answers and no Skip. The screen-reader
   status counts it as a notice ("8 questions to clarify, 1 notice").

**The lead's history and physical after round 2.**
- **Captured:** `m_photo` yes, `m_aura` no, `v_aural` yes, `x_purulent` no, `x_anosmia` no;
  `v_vertigo` heard (no duration).
- **Set aside:** `rf_pulsatile` (denied), `v_head` ("non-positional"), `n_allo` and `r_normal` (exam
  section). No red flag is raised.
- **Clarify cards:** the same nine, in order: which ear (`cl_laterality`), ear pain (`cl_otalgia`),
  the template-text notice (Dismiss only), sudden hearing drop (`cl_hearing_onset`), audiogram
  (`cl_audiogram`), headache (a hedge card for `m_head`), kind of dizziness (`cl_dizziness_kind`),
  neck (`cl_neck`) and HINTS (`cl_hints`).

**The reviewers' held-out corpus (30 chart texts written before any engine run), before and after
round 2.** Every case not listed gives what it gave before.

| Case | Before round 2 | After round 2 |
|---|---|---|
| H01 | `m_aura` yes from "(-) aura" | `m_aura` no |
| H04 | `rf_pulsatile` raised; no laterality card | the same, and the laterality card ("right ear" no longer silences it) |
| H09 | `x_objective` conflict card ("Lund-Mackay 0" against "no polyps") | `x_objective` no; the scan card leaves at once (its item is answered) |
| H11 | `rf_ssnhl` not raised; no laterality or onset card | `rf_ssnhl` raised; laterality and onset cards |
| H12 | no laterality card ("left" silenced it) | the laterality card |
| H18 | `m_head` none ("without improvement in facial pain" read as a denial) | `m_head` 1 |
| H20 | `rf_gca` not raised | `rf_gca` raised |
| H21 | `rf_orbital` not raised | `rf_orbital` raised; `rf_systemic` not raised ("Afebrile"); the nasal-side card |
| H22 | `rf_mass` not raised | `rf_mass` raised; the nasal-side card |
| H23 | `m_nausea` yes ("Nausea maybe sometimes.") | asked (a hedge card), not recorded |
| H24 | `m_nausea` yes ("Nausea: [ ]") | nothing; the template notice |
| H25 | `x_objective` no from an office exam | nothing |
| H27 | `rf_progressive` not raised | `rf_progressive` raised (`v_head` is still recorded from "bending over", Part E) |

The corpus names eight red flags explicitly. Three were raised before round 2 and all eight are
raised after it, and no flag the text denies is raised. Its four implicit flags (`rf_asym` in H04,
H11 and H12; `rf_new50` in H20) need inference that no phrase can make. The laterality card now
asks in H04, H11 and H12.

Tests:
- `extraction`: block 4 (new). Block 3 asserts that its spoken comparisons are identical. AD18 gains
  rule C (chart red-flag phrases) and a widened rule L (an affirm cue anywhere in the sentence). Its
  self-checks add rule C and a label answer, check that no spoken comparison is excused, and check
  that every self-check text reads identically on both lexicons when spoken (29 self-checks).
- `capture`:
  - every chart-reading case of block 1 is also read without `opts.chart` and found identical to
    the fixture without the chart block;
  - 17 new fixture cases (shielded cues, label answers, chart red flags, the inner hit, a chart
    phrase read as speech) and the unmasked trigger;
  - block 5 gains 40 chart texts with explicit expectations, each also read as a spoken line, and a
    guard that no safety entry keeps a removed qualifier;
  - gold set 0.4.0 is updated (below).
- `render-scribe`: the notice (its text, Dismiss only, role `note`, nothing recorded) and the status
  line; `r_normal` absent from the history and physical.
- `validate`: six mutations (the shape of `clauses.redFlags`, an unknown flag, an empty list, a
  source, a capital letter; `examItems` that is not a list). `examItems` may be empty.
- **Sensitivity:** the new `extraction` and `capture` suites fail against the round-1 engine, with
  400 differences each (the cap).

### Review round 3 (2026-10-11)

The third review read held-out chart texts written before any engine run, typed red-flag sentences
through the real box, and the round-2 label-answer rule. It confirmed ten defects: three that hid an
affirmed red flag in typed text, and seven that read a denial as "yes" (or a finding as "no"). Each is
fixed at its root in the engine, with draft rows only where a word list was needed. The lead's
working choice stays "Draft, you sign off". Every new row is a draft with a basis starting "(review
round 3)" in the sign-off list, and nothing is approved beyond the lead's own words and decisions.
Nothing is uploaded before the lead signs the list off. Spoken and demo lines are untouched: block 4
still finds them identical to release 0.4.6.

1. **Signs between findings** (major). In a review-of-systems line with a sign before every finding
   and only spaces between ("(+) a (-) b"), each sign was read as the answer of the finding before
   it. Now a sign with only spaces around it, between two findings, is the prefix of the finding
   after it. A sign, like any cue, answers the finding before it as a label only when it closes the
   item (the clause end, punctuation, "and" or "or" after it).
   - "ROS: (+) headache (-) aura (-) nausea" records `m_aura` and `m_nausea` no (they read yes).
   - "(-) fever (-) chills (-) weight loss" raises nothing (it raised `rf_systemic`).
   - "(-) diplopia (-) dysarthria" and held-out Q01's ROS line no longer raise `rf_focal`.
   - "Aura (-), nausea (+)." and "Aura: (-), nausea" read as before.
2. **Abbreviations** (major). Chart reading cut a clause at every "." followed by a space, so a
   denial before "assoc.", "hx.", "sx.", "e.g." or "approx." no longer reached the finding after it,
   which then read yes. Now such a "." ends nothing when a lower-case word follows it, the clause it
   would end opens with a capital and names no finding before it, and the word before it has at most
   six letters or holds a dot.
   - "No assoc. nausea.", "Denies hx. of aura.", "No sx. of nausea.", "Pt. reports no assoc.
     nausea." and "Denies e.g. nausea or photophobia." read no again, as in 0.4.6.
   - "No assoc. diplopia." no longer raises `rf_focal`.
   - A "." still ends the clause after a finding ("Denies vertigo at rest. nausea with movement."
     records nausea yes) and for a writer who does not capitalise sentences ("no aura. nausea
     present.").
3. **An affirmed red flag in a later list item** (critical). A deny cue heading a list lowered a flag
   in a later item whenever the item had at most two words before the flag phrase and one after,
   whatever those words were. Now a later item, or an item of a list carried from a line above,
   lowers a flag only when it is the bare flag phrase: no other word, no affirm cue and no plus sign
   in it. A plus sign before a word ("+double vision", "+ night sweats") now affirms it, like an
   affirm cue.
   - Now raised: "No nausea, double vision reported.", "No N/V, night sweats noted.", "No nausea,
     +double vision.", "Without warning, she developed double vision.", "No trauma, then
     nosebleeds.", "No headache, only nosebleeds.", "No nausea, sudden hearing loss reported." (with
     the hearing cards), "Neuro: no facial droop, diplopia present." and "No headache history, sudden
     severe headache today."
   - A new draft phrase, `"slurred speech"` for `rf_focal` (row 177, the flag's own ask), keeps "No
     vision loss, diplopia, facial droop, weakness, or slurred speech." a list of bare flag phrases,
     so nothing is raised there.
4. **A denial whose object is something else** (critical). A deny or window cue lowered a flag in
   its own item whatever words lay between, so "No steroids given for sudden hearing loss." lowered
   `rf_ssnhl`. A new draft list `clauses.complement` (rows 69-75: for, in, about, after, since, on,
   none of) holds the words after which the denied word is something else. Past one of them no
   denial lowers a flag, and a list denial reaches no item (the mention is set aside). New draft
   breaks "other than", "besides" and "apart from" (rows 56-58) end the clause, as "except" does.
   - Now raised: "No steroids given for sudden hearing loss." (`rf_ssnhl`, with the hearing cards),
     "No workup for the double vision.", "No CT for diplopia.", "No MRI for vision loss yet.", "No
     change in the whooshing since last visit.", "None of her epistaxis episodes needed packing.",
     "Denies complaints other than nosebleeds." and "Negative for everything other than fever."
   - "No workup for pulsatile tinnitus." and "No change in pulsatile tinnitus since last visit."
     raise `rf_pulsatile` and no longer record `v_aural` no.
   - "of" is not a row, so "No history of malignancy." still lowers `rf_systemic` (Part D).
   - The lexicon's 14-character window still reaches past a complement word for a yes/no item, as
     in 0.4.6: "No hx of aura." reads no, and so does "No CT for tinnitus." (Part D).
5. **Lists under a denial** (critical). A line opening with "+" was read as a short item of the
   denied list, and so was an unbulleted line after the bullets. Now a line opening with "+" or
   holding an affirm cue ends the list, and once a bullet was read a plain line ends it too. A plain
   item line under a denial header is its own item, never part of a wrapped line.
   - "Denies:" over "- nausea" and "+ night sweats" raises `rf_systemic` and records nausea no.
   - "Patient denies:" over "- fever", "- chills" and "New nosebleed this week." raises `rf_mass`
     and not `rf_systemic`.
   - "Patient denies:" over the plain lines "fever" and "chills" raises nothing.
6. **A denied safe-answer qualifier** (major). A clarification qualifier silenced its card whether
   or not the text denied it, so "Tinnitus, not bilateral" silenced the laterality card while stating
   the dangerous answer. Now a qualifier the text denies resolves nothing: it states the other answer,
   which the card then asks the clinician to confirm. This applies to every entry, because the
   extractor does not know a probe's kind, and asking is the safe side. A new draft deny cue "rather
   than" (row 37) denies what follows it.
   - The laterality card asks for "Tinnitus, not bilateral; left ear only." and "Hearing loss in the
     left ear, not bilateral."
   - The sudden-onset card asks for "Hearing loss, not gradual." and "Hearing loss, abrupt rather
     than gradual."
   - The one-sided-nose card asks for "Nasal obstruction, non-alternating, always the right side."
     and "Congestion, not alternating, left side only."
   - The lead's history and physical now shows ten cards: "Tinnitus is not pulsatile" no longer
     silences the tinnitus-quality card.
7. **Affirmed tinnitus after an unrelated denial** (major). A list denial, and the window across a
   comma, recorded a later item as "no" even when the item said more than the finding. Now such an
   item is set aside (no capture), never "no", and a clarification trigger set aside this way still
   asks.
   - "No nausea, tinnitus reported." and "No dizziness, tinnitus in the right ear only." record no
     `v_aural`, and the tinnitus-quality and laterality cards ask (they recorded `v_aural` no and
     showed no card).
   - A bare later item is still denied: "No nausea, tinnitus." records `v_aural` no.
8. **Records** (minor). Part D told the lead that the red-flag rule "never hides one the text
   affirms". That was not true. Part D now states the exact conditions under which a flag is lowered,
   lists the lowering cases still known, and points to the new red-flag battery that tests them.
9. **An affirm cue after "Finding -" or "Finding:"** (major). The round-2 label-answer rule took any
   affirm cue after a dash or colon as the finding's answer, even when more words followed and even
   against a denial before the label. Now a cue answers a label only when it closes the item, and a
   label answer never overrides a prefix or a negation or deny cue in the label's own list item.
   - "No nausea - reports good appetite.", "Denies photophobia - has been sleeping well." and "No aura
     - has had headaches for years." read no again.
   - "ROS: negative for nausea - positive for photophobia." reads nausea no and photophobia yes.
   - "Denies sudden hearing loss - reports gradual decline over years." and "Denies diplopia -
     reports blurry vision when tired." raise nothing.
   - "Non-pulsatile tinnitus: yes." records `v_aural` yes and does not raise `rf_pulsatile`.
   - "Non-positional vertigo - reports episodes lasting hours." records no `v_head`.
   - "Denies nausea, photophobia: endorses." still affirms the photophobia: its own item holds no
     denial.
10. **A deny cue after "Finding:" or "Finding -"** (major). The same rule took a deny cue right after
    a label as that label's answer, so it opened no list. Now a deny cue followed by findings opens
    its list as before.
    - "Headache: denies nausea, vomiting, photophobia, phonophobia." denies all four.
    - "Dizziness: denies hearing loss, tinnitus, diplopia or dysarthria." records `v_aural` no and
      raises nothing.
    - "Headache - no fever, weight loss, jaw claudication or scalp tenderness." raises neither
      `rf_gca` nor `rf_systemic`.

Two related engine fixes came up while testing these:
- **The slash.** A "/" separates list items only when a space or a finding touches it ("nausea/
  vomiting", "fever/chills/night sweats"). Between two other words it joins them inside one item. So
  the lead's history and physical keeps "visual/auditory auras" as one denied item (`m_aura` no),
  and "No h/o malignancy." stays a clear denial.
- **A second label on a line.** On a line of labels, a second "Label:" starts a clause of its own.
  "Nausea: no Photophobia: yes" now records nausea no and photophobia yes; it read nausea yes and
  photophobia no.

**The lead's history and physical after round 3.**
- **Captured:** `m_photo` yes, `m_aura` no, `v_aural` yes, `x_purulent` no, `x_anosmia` no;
  `v_vertigo` heard (no duration).
- **Set aside:** `rf_pulsatile` (denied), `v_head` ("non-positional"), `n_allo` and `r_normal` (exam
  section). No red flag is raised.
- **Clarify cards, in order (ten):** which ear (`cl_laterality`), ear pain (`cl_otalgia`), the
  template-text notice (Dismiss only), sudden hearing drop (`cl_hearing_onset`), audiogram
  (`cl_audiogram`), headache (a hedge card for `m_head`), tinnitus quality (`cl_tinnitus_quality`,
  new in round 3), kind of dizziness (`cl_dizziness_kind`), neck (`cl_neck`) and HINTS (`cl_hints`).

**The round-3 reviewers' held-out corpus** (30 chart texts written before any engine run), scored
with the reviewers' own script on typed chart text:

| Measure | Before round 3 | After round 3 |
|---|---|---|
| Strict expectations (`expect`) | 18 correct, 2 missed, 1 wrong (of 21) | the same |
| Red flags the text states (`rfRaise`) | 9 of 11 raised | the same |
| Red flags the text denies (`rfNot`) | 35 of 37 not raised | 36 of 37 not raised |
| Soft expectations | 19 correct, 48 missed, 1 wrong | the same |
| Clarify cards expected | 3 of 3 | 3 of 3 |

Q01's ROS line no longer raises `rf_focal`. The one denied flag still raised is Q05's `rf_systemic`
from the review-of-systems form "- fever, - chills, - weight loss", a lead item in Part D. The two
flags still missed are `rf_asym` (Q09) and `rf_progressive` (Q16), the chart-wording gap in Part D.

Tests:
- `capture` block 1: 35 new fixture cases and 2 changed ones (signs, abbreviations, later list
  items, plus signs, complement words, the end of a list, label answers, a second label, the slash);
  two new `clarifyCues` cases (a denied qualifier, an uncertain trigger). Each case is also read as
  a spoken line and found identical to the fixture without the chart block.
- `capture` block 5:
  - 68 round-3 texts with explicit expectations, each also read as a spoken line exactly as on
    lexicon 0.3.2;
  - a red-flag battery: every red-flag phrase of the shipped lexicon (181 phrases of 12 flags) in
    21 templates that affirm it (it must be raised) and 17 that clearly deny it (it must not be),
    6,878 texts;
  - gold set 0.4.0 (below), with the history-and-physical card list.
- `extraction` block 3: new cue frames for complement words, signs, abbreviations, later list items
  and "+" lines; AD18 explains every typed difference, and every spoken comparison is identical.
- `validate`: two mutations of the new list (empty, a capital letter). `render-scribe`: the ten
  cards of the history and physical through the real box.
- `values`: a new check that this change log quotes every rubric change-log entry verbatim, once.
  It found that the 0.4.7 records had replaced the 2026-10-04 section's quote of the approved 0.3.2
  entry with the 0.4.7 one; that quote is restored.
- **Sensitivity:** against the round-2 engine, `capture` fails with 400 differences (the cap) and
  `render-scribe` with 9.

### Version axes (release 0.4.7)

| Axis | Release 0.4.6 | Release 0.4.7 | Owner |
|---|---|---|---|
| Release | 0.4.6 | **0.4.7** | `app/src/engine/policy.js` `APP_VERSION` |
| Instrument | 0.2 | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | 0.3.2 | **0.3.3** | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.3.0 (lexicon 0.3.2) | **0.4.0** (lexicon 0.3.3) | `masque.rubric.json` `lexicon.goldSet` |

The five numbers stay separate. The gold set moves with the lexicon, so no footer reads
"(benchmarked on lexicon 0.3.2; not re-run)".

### Gold set 0.4.0

`app/tests/fixtures/goldset/masque_extraction_goldset_0.4.0.json` (local-only, never deployed;
SHA-256 `99dff3ac…`, 269,705 bytes after the sign-off; `f3339e9b…`, 254,161 bytes after review
round 3) holds:

- **the 0.3.0 cases and dialogues, verbatim.** `_meta.includes` pins gold set 0.3.0 (SHA-256
  `729492ef…`, 218 cases, 93 dialogues), and `_meta.basedOn` still pins the reference file and its
  44 cases;
- **273 chart cases** (register `chart`, id prefix `k`), read as typed chart text
  (`{includeHeard: true, chart: true}`). `k001` is the lead's history and physical, verbatim.
  `k002`-`k051` are the 50 rows of the team's chart-text catalogue, drafted on 2026-10-11 to probe
  the chart-reading failure modes. `k052`-`k065` test the four fixes before review (chart pronouns,
  the conflict rule, whole-word cues), `k066`-`k122` the fixes of review round 1, `k123`-`k186` those
  of review round 2, `k187`-`k259` those of review round 3 and `k260`-`k273` what the lead's
  sign-off of 2026-10-12 added or changed (the hedge "+/-", the three deny cues, the new
  `rf_progressive` and `rf_asym` phrases, no context marker from typed chart text, the removed
  clarification qualifiers, the struck `rf_orbital` phrases). The round-3 cases are mostly the
  round-3 reviewers' own texts: signs between findings, abbreviations, later list items that hold
  more than the finding, complement words, the end of a list under a denial, denied clarification
  qualifiers, label answers that close their label, a second label on a line and the slash. Each case
  has `expect`, `expectAbsent` and `expectClarify`, and `k001` and `k122` also have
  `expectEvidence`;
- **a supersede table of five case labels since the sign-off** (empty from review round 2 until then).
  The lead's decision D9 reads spoken lines with chart reading too, which changes the output of five
  spoken-register cases; each row gives the 0.3.0 label (`was`, still the file's), the 0.4.0 label
  (`now`), cites D9 of 2026-10-12 and names the rule:
  - **e16** (0.2.0) "My hearing test showed it drops during the spells.": `x_lowfreq` yes → nothing.
    The lead-approved mask "hearing test showed" (a report header) now applies to speech; for the
    lead: a spoken report of the result records nothing and no card asks (clarification stays typed
    only), and `x_lowfreq` is a rule-out item, so the index is not lowered;
  - **r02** (0.2.0) "No, I've never had double vision or anything like that.": `rf_focal` → not
    raised (the lead's red-flag decision, now read in speech: "never" denies the phrase directly);
  - **f02** (0.2.0) "Symptoms reportedly began following a viral upper respiratory illness.":
    `n_viral` yes → nothing (the hedge "reportedly");
  - **t007** (0.3.0) "My headache lasts all day, maybe a week.": `m_dur` 2 and `m_head` 1 → nothing
    (the hedge "maybe" drops the whole clause; "hedge = nearest finding" was offered at D8 and not
    picked, a known limit);
  - **w019** (0.3.0) "How long am I dizzy? For two days at a time.": the heard `v_vertigo` → nothing
    (the hedge "?").
  No dialogue step of gold set 0.3.0 changes: carry-over is as before (D9).

Every 0.4.0 label is a draft test expectation (`labelStatus: "draft"`): the lead signed off the
lexicon rows on 2026-10-12, not the cases. The 0.3.3 output agrees with the catalogue's own draft
expectation on 32 of the 50 rows (33 before review round 3: k027 no longer records `x_purulent` no;
the sign-off changed no row's agreement: k035 now agrees on `c_dismiss` but still misses `m_fhx`, and
k006 and k037 now also record `m_aura`). Each row that differs says why.

The sign-off changed ten chart labels, each to the engine's output and each with a note citing the
decision:
- **k001** (the lead's history and physical), **k006**, **k037:** the mask "aural" struck, so "aural
  fullness" reads aura. k001 then states and denies aura (a conflict card, eleven cards); k006 and
  k037 record `m_aura` yes, which leaves their `expectAbsent` (the team's draft superseded by the
  lead's decision);
- **k004:** the `rf_focal` phrase "facial numbness" struck, so "numbness" (`n_burn`) stands in a later
  list item after "facial" and is set aside rather than recorded no;
- **k126, k166, k223:** `rf_orbital` and `rf_vision` phrases struck: no flag;
- **k035, k243:** the D8 answer: typed chart text sets no context marker (`c_dismiss`, `c_dur`);
- **k162:** the D8 answer removed the scan report's positive-answer qualifiers, so `clarifyCues` lists
  the trigger (the Scribe drops the card: `x_objective` is recorded from the same words).

Review round 3 changed eleven chart labels, each to the engine's output and each with a note:
- **k001, k015:** "not pulsatile" no longer silences the tinnitus-quality card;
- **k070, k074, k075, k099, k102:** a trigger set aside as uncertain asks (the tinnitus cards);
- **k071:** the window's denial of "pulsatile" across a comma leaves the tinnitus-quality card
  asking (the flag stays raised);
- **k027:** "purulent drainage" in a later list item is set aside, so `x_purulent` is not recorded;
- **k061:** "since" is a complement word, so `m_nausea` and `m_photo` are set aside (added to its
  `expectAbsent`);
- **k104:** a later item with another word is set aside, so `m_photo` is not recorded (added to its
  `expectAbsent`). This reverses the round-1 label "a clean denied list still denies every item, a
  trailing word included".

Review round 2 changed six chart labels (k001, k017, k068, k079, k081, k121), each with a note.

Gold set 0.3.0 is byte for byte unchanged and still pinned. It and its benchmark run on the lexicon
equivalent to 0.3.2 (the shipped lexicon with the 0.3.3 delta reverted), the only oracle of 0.3.2
behaviour. Since D9 the shipped lexicon read as speech gives the same outputs except the five
superseded cases.

**The labels superseded earlier, restored, and superseded again.**
- **Superseded again at the sign-off:** r02, f02 and w019 (and e16 and t007, new) with D9, above.
- **Restored in review round 2:** the first build and review round 1 superseded seven
  spoken-register labels: r02, f02, y032, t013, w011, w013 and w019 (a red flag denied in speech, a
  hedge, a duration from another clause, a word start, a "?"). Spoken lines are read exactly as in
  0.3.2 again, so all seven keep their 0.2.0 and 0.3.0 labels.
- **Dropped earlier:** review round 1 dropped v025 and v042, whose contractions keep their 0.3.2
  reach. The fixes before review dropped n07: a denied weather trigger and an affirmed meal trigger
  are different findings of `m_trig`.

### Benchmark, gold set 0.4.0 (in-sample regression snapshot: development figures, not performance)

Copied from the `capture` suite's notes in the final run of 2026-10-12 after the clinical lead's
sign-off (seed 1296126801, in the headless Edge browser: the in-app browser could not open a tab),
which reported no difference. `GOLD_0_4_0_SHA256` (`99dff3ac…`) and
`EXPECTED_BENCHMARK_040` (tp 470, fp 0, fn 0, 93 and 93 dialogues, 273 chart cases, catalogue agreement 32, 5 superseded labels) in `app/tests/suites/capture.js` were
re-taken from that run (after review round 3: `f3339e9b…`, tp 466, 259 chart cases, no superseded
label). `GOLD_0_3_0_SHA256` (`729492ef…`) and `EXPECTED_BENCHMARK` are unchanged. The 0.3.0 block of
the same run matches the block printed under 2026-10-04 except its first line, which now names the
features `clauses` and `clarify` the engine offers.

```text
lexicon 0.3.3 · rule-based / phrase-match with local negation · features scale.heard, scale.carry, scale.carryExclude, scale.yieldTo, scale.anchor, carryRefuse, normalize.apostrophes, normalize.numbers, clauses, clarify · development set 0.4.0
!! AUTHORED — written by hand to probe known failure modes.
!! These are development figures, not validation results; every 0.4.0 label is a draft test expectation.
!! The 0.3.0 labels are the 0.3.2 extractor's own output and the chart labels the 0.3.3 extractor's (regression snapshots); P/R/F1 on them is tautological, not a measurement.

utterances 535 (44 from 0.2.0 + 218 from 0.3.0 + 273 chart) · labelled extractions 470
  micro  P 100.0%  R 100.0%  F1 100.0%  (tp 470 fp 0 fn 0)
  supersede table 5 labels (5 cases, 0 dialogue steps); outputs changed against lexicon 0.3.2: 5 cases, 0 dialogue steps
  chart-text catalogue: the 0.3.3 output agrees with the team's draft expectation on 32/50 rows

DIALOGUES (93)
  carry applied as labelled   93/93
  refused as labelled         93/93
```

### SIGN-OFF: the rows the clinical lead decided (decided 2026-10-12)

**Decided.** The clinical lead decided every row below on 2026-10-12 on the sign-off page; the
"Lead" column now gives each row's outcome (approved or struck), and "Clinical-lead sign-off
(2026-10-12)" below gives the counts, the struck rows, the Part D answers and the follow-up answers.
The list is kept as the lead saw it (rows numbered as in commit `cd34934`, sources and bases as they
were then): a struck row is removed from `lexicon-delta-033.js`, the gold cases it affected are
relabelled and the rubric is regenerated, and every approved draft row is marked `lead-approved` in
the data. The sign-off is recorded in `LEXICON_DELTA_033.signOff` with its date, as the EMR sign-off
was in release 0.4.4. Rows carrying the lead's own words or the lead's decision are listed for
completeness and needed no sign-off. A phrase is shown in quotes with any boundary space it carries
(`"has "`, `" negative"`).

**A. Chart-reading cues and switches (`lexicon.clauses`, `lexicon.negation.cues`).** 280 rows: 268
phrases (8 the lead's, 260 drafts), 4 appended negation cues (drafts), 7 draft switch values and the
lead's red-flag decision. Review round 1 added rows 59-68 (`scopeEnd`) and 140-156 (`sections.read`)
and gave rows 269-272 their own basis. Review round 2 added rows 13-23 (the sign "(+)" and the
treatment-failure cues), 36 ("(-)"), 44-46 (post cues), 78-83 (masks), 95-99 (hedges), 102-103 (empty
checkboxes) and 157-268 except row 177 (`clauses.redFlags`, 111 chart-register red-flag phrases),
changed rows 274 (the notice text) and 275 (`examItems`, now empty) and removed the two `examItems`
rows. Review round 3 added rows 37 (the deny cue "rather than"), 56-58 (the breaks "other than",
"besides" and "apart from"), 69-75 (the new list `clauses.complement`) and 177 (`"slurred speech"`
for `rf_focal`). Every row is numbered afresh after each round. The basis of each round-2 row starts
with "(review round 2)" and of each round-3 row with "(review round 3)".

| # | Where (lexicon) | Phrase | Source | Basis (`lexicon-delta-033.js` `basis`) | Lead |
|---|---|---|---|---|---|
| 1 | `clauses.affirm[0]` | `"endorses"` | lead | The clinical lead's request of 2026-10-11, verbatim: endorsement verbiage ("e.g. endorses, reports, has, yes") | the lead's own word (no sign-off needed) |
| 2 | `clauses.affirm[1]` | `"reports"` | lead | The clinical lead's request of 2026-10-11, verbatim: endorsement verbiage ("e.g. endorses, reports, has, yes") | the lead's own word (no sign-off needed) |
| 3 | `clauses.affirm[2]` | `"has "` | lead | The clinical lead's request of 2026-10-11, verbatim: endorsement verbiage ("e.g. endorses, reports, has, yes"); written with its boundary space so it never reads inside hash or chase | the lead's own word (no sign-off needed) |
| 4 | `clauses.affirm[3]` | `"yes"` | lead | The clinical lead's request of 2026-10-11, verbatim: endorsement verbiage ("e.g. endorses, reports, has, yes"); a clauses cue matches as a whole word, so it never reads at the start of "yesterday" | the lead's own word (no sign-off needed) |
| 5 | `clauses.affirm[4]` | `"endorsed"` | draft | the past-tense form of the lead's "endorses" | **approved** (2026-10-12) |
| 6 | `clauses.affirm[5]` | `"reported"` | draft | the past-tense form of the lead's "reports" | **approved** (2026-10-12) |
| 7 | `clauses.affirm[6]` | `"admits"` | draft | chart wording that endorses a finding, like the lead's "endorses" (catalogue LE2 "Admits to phonophobia") | **approved** (2026-10-12) |
| 8 | `clauses.affirm[7]` | `"positive for"` | draft | review-of-systems wording that endorses a finding (catalogue WR2 "Positive for dizziness, tinnitus") | **approved** (2026-10-12) |
| 9 | `clauses.affirm[8]` | `"complains of"` | draft | chart wording that endorses a finding, like the lead's "reports" | **approved** (2026-10-12) |
| 10 | `clauses.affirm[9]` | `"c/o"` | draft | the chart abbreviation of "complains of" | **approved** (2026-10-12) |
| 11 | `clauses.affirm[10]` | `"describes"` | draft | chart wording that endorses a finding, like the lead's "reports" | **approved** (2026-10-12) |
| 12 | `clauses.affirm[11]` | `"presents with"` | draft | chart wording that endorses a finding (the H&P "who presents with") | **approved** (2026-10-12) |
| 13 | `clauses.affirm[12]` | `"(+)"` | draft | (review round 2): the chart sign for a present finding, before it ("(+) nausea") or as its label answer ("Nausea: (+)", "Nausea (+)"), as the lead's "endorses" | **approved** (2026-10-12) |
| 14 | `clauses.affirm[13]` | `"no improvement"` | draft | (review round 2): a failed treatment ("No improvement with antibiotics"): the treatment was given, so the cue affirms what it names and shields the deny cue "no " it holds; r_abx and r_surg no longer read "no" (held-out review) | **approved** (2026-10-12) |
| 15 | `clauses.affirm[14]` | `"no relief"` | draft | (review round 2): a failed treatment ("No relief from steroid sprays"), as "no improvement" | **approved** (2026-10-12) |
| 16 | `clauses.affirm[15]` | `"no response"` | draft | (review round 2): a failed treatment ("No response to amoxicillin"), as "no improvement" | **approved** (2026-10-12) |
| 17 | `clauses.affirm[16]` | `"no benefit"` | draft | (review round 2): a failed treatment ("No benefit after sinus surgery"), as "no improvement" | **approved** (2026-10-12) |
| 18 | `clauses.affirm[17]` | `"without improvement"` | draft | (review round 2): a failed treatment (held-out H18 "S/p septoplasty and bilateral FESS 2020 without improvement in facial pain"), as "no improvement"; it shields the cue "without" it holds | **approved** (2026-10-12) |
| 19 | `clauses.affirm[18]` | `"without relief"` | draft | (review round 2): a failed treatment, as "without improvement" | **approved** (2026-10-12) |
| 20 | `clauses.affirm[19]` | `"without benefit"` | draft | (review round 2): a failed treatment, as "without improvement" | **approved** (2026-10-12) |
| 21 | `clauses.affirm[20]` | `"failed"` | draft | (review round 2): a failed treatment (held-out H08 "Failed 3 courses of antibiotics") affirms the treatment and ends a denial before it | **approved** (2026-10-12) |
| 22 | `clauses.affirm[21]` | `"refractory to"` | draft | (review round 2): a failed treatment ("Refractory to two courses of antibiotics"), as "failed" | **approved** (2026-10-12) |
| 23 | `clauses.affirm[22]` | `"despite"` | draft | (review round 2): a failed treatment (held-out H09 "despite 4 rounds of antibiotics"), as "failed" | **approved** (2026-10-12) |
| 24 | `clauses.deny[0]` | `"denies"` | lead | The clinical lead's request of 2026-10-11, verbatim: denial verbiage ("e.g. denies, no, lacks, doesn't have") | the lead's own word (no sign-off needed) |
| 25 | `clauses.deny[1]` | `"no "` | lead | The clinical lead's request of 2026-10-11, verbatim: denial verbiage ("e.g. denies, no, lacks, doesn't have"); written with its boundary space so it never reads inside a word | the lead's own word (no sign-off needed) |
| 26 | `clauses.deny[2]` | `"lacks"` | lead | The clinical lead's request of 2026-10-11, verbatim: denial verbiage ("e.g. denies, no, lacks, doesn't have") | the lead's own word (no sign-off needed) |
| 27 | `clauses.deny[3]` | `"doesn't have"` | lead | The clinical lead's request of 2026-10-11, verbatim: denial verbiage ("e.g. denies, no, lacks, doesn't have") | the lead's own word (no sign-off needed) |
| 28 | `clauses.deny[4]` | `"denied"` | draft | the past-tense form of the lead's "denies" (catalogue LD4, MV3 "Patient denied nausea.") | **approved** (2026-10-12) |
| 29 | `clauses.deny[5]` | `"negative for"` | draft | review-of-systems denial wording (catalogue WR2 "Negative for headache, nausea, vomiting"); already a negation cue of the lexicon, here also spread over its list | **approved** (2026-10-12) |
| 30 | `clauses.deny[6]` | `"without"` | draft | chart denial wording (the H&P "EOMI without nystagmus"); already a negation cue of the lexicon, here also spread over its list | **approved** (2026-10-12) |
| 31 | `clauses.deny[7]` | `"does not have"` | draft | the uncontracted form of the lead's "doesn't have" | **approved** (2026-10-12) |
| 32 | `clauses.deny[8]` | `"don't have"` | draft | the first-person form of the lead's "doesn't have" (gold v023 "I don't have the world moving around me.") | **approved** (2026-10-12) |
| 33 | `clauses.deny[9]` | `"do not have"` | draft | the uncontracted first-person form of the lead's "doesn't have" | **approved** (2026-10-12) |
| 34 | `clauses.deny[10]` | `"haven't had"` | draft | the perfect-tense denial (gold u003 "I haven’t had any nausea."): under wordStart the cue "n't" no longer reads inside "haven't", and "haven't" alone falls outside the 14-character window there | **approved** (2026-10-12) |
| 35 | `clauses.deny[11]` | `"hasn't had"` | draft | the third-person form of "haven't had" | **approved** (2026-10-12) |
| 36 | `clauses.deny[12]` | `"(-)"` | draft | (review round 2): the chart sign for an absent finding before it ("(-) aura", held-out H01), a list denial as the lead's "denies"; right after a finding ("Aura: (-)", "Aura (-)") it answers that label only and opens no list (the post cue "(-)" denies it) | **approved** (2026-10-12) |
| 37 | `clauses.deny[13]` | `"rather than"` | draft | (review round 3): a contrast that denies what follows it ("Hearing loss, abrupt rather than gradual." denies the safe answer "gradual", so the sudden-onset card keeps asking); a list denial as the lead's "denies" | **approved** (2026-10-12) |
| 38 | `clauses.post[0]` | `" negative"` | draft | a finding followed by "negative" (catalogue PN3 "Positional testing negative."; open question Q2: a negative test then reads as a denial). Review round 1: a post cue denies only a mention right before it (a ":" or one word between, or a list it closes: "Nausea, photophobia: negative.") and only when it closes the item (punctuation or the clause end after it), so "Dizziness with negative Dix-Hallpike." and "Reports pulsatile tinnitus with negative CTA head and neck." no longer deny the finding | **approved** (2026-10-12) |
| 39 | `clauses.post[1]` | `" denied"` | draft | a finding followed by "denied" ("Positional vertigo denied.") | **approved** (2026-10-12) |
| 40 | `clauses.post[2]` | `" absent"` | draft | a finding followed by "absent" | **approved** (2026-10-12) |
| 41 | `clauses.post[3]` | `" not present"` | draft | a finding followed by "not present" | **approved** (2026-10-12) |
| 42 | `clauses.post[4]` | `": no"` | draft | a label answered no (catalogue PN4 "Photophobia: no."); it must end at a word end, so ": normal" and ": none" do not read as ": no", and it must close the item (review round 1), so "Photophobia: no change since last visit." is no denial | **approved** (2026-10-12) |
| 43 | `clauses.post[5]` | `": none"` | draft | a label answered none | **approved** (2026-10-12) |
| 44 | `clauses.post[6]` | `"(-)"` | draft | (review round 2): the chart sign for an absent finding after it ("Aura: (-)", "Aura (-)") | **approved** (2026-10-12) |
| 45 | `clauses.post[7]` | `": denies"` | draft | (review round 2): a label answered with the lead's own "denies" ("Nausea: denies"); "Nausea: denied" is the post cue " denied" | **approved** (2026-10-12) |
| 46 | `clauses.post[8]` | `" - no"` | draft | (review round 2): a label answered no after a dash ("Nausea - no") | **approved** (2026-10-12) |
| 47 | `clauses.prefix[0]` | `"non-"` | draft | attribute negation glued to the phrase (the H&P "non-positional"; catalogue PN2): the mention is dropped, never recorded as a denial; a red-flag phrase so negated is not raised | **approved** (2026-10-12) |
| 48 | `clauses.prefix[1]` | `"non "` | draft | the spaced form of "non-" (the H&P "Weber non lateralizing") | **approved** (2026-10-12) |
| 49 | `clauses.breaks[0]` | `"but "` | draft | a contrast word ends the clause, so a denial before it does not reach past it (reference n01 "No nausea at all, but the light sensitivity is awful."; catalogue MX1) | **approved** (2026-10-12) |
| 50 | `clauses.breaks[1]` | `"however"` | draft | a contrast word ends the clause, as "but" does | **approved** (2026-10-12) |
| 51 | `clauses.breaks[2]` | `"although"` | draft | a contrast word ends the clause, as "but" does | **approved** (2026-10-12) |
| 52 | `clauses.breaks[3]` | `"though "` | draft | a contrast word ends the clause, as "but" does | **approved** (2026-10-12) |
| 53 | `clauses.breaks[4]` | `"except "` | draft | an exception ends the clause ("Denies all symptoms except tinnitus") | **approved** (2026-10-12) |
| 54 | `clauses.breaks[5]` | `"whereas"` | draft | a contrast word ends the clause, as "but" does | **approved** (2026-10-12) |
| 55 | `clauses.breaks[6]` | `" — "` | draft | a spaced dash ends the clause (reference n07 "It's not the weather, I checked — it's when I skip meals.") | **approved** (2026-10-12) |
| 56 | `clauses.breaks[7]` | `"other than"` | draft | (review round 3): an exception ends the clause, as "except" does ("Denies complaints other than nosebleeds." and "Negative for everything other than fever." raise their flags) | **approved** (2026-10-12) |
| 57 | `clauses.breaks[8]` | `"besides"` | draft | (review round 3): an exception ends the clause, as "except" does | **approved** (2026-10-12) |
| 58 | `clauses.breaks[9]` | `"apart from"` | draft | (review round 3): an exception ends the clause, as "except" does | **approved** (2026-10-12) |
| 59 | `clauses.scopeEnd[0]` | `"with"` | draft | (review round 1): a word that ends a list denial before the mention ("Vertigo without hearing loss, with double vision and slurred speech."; "Vertigo attacks without hearing loss, associated with nausea and photophobia."): a mention past it is set aside (no capture) and a red flag past it is raised | **approved** (2026-10-12) |
| 60 | `clauses.scopeEnd[1]` | `"so"` | draft | (review round 1): a word that ends a list denial ("No interpreter available, so nausea, photophobia and tinnitus were not reviewed." records none of them as "no") | **approved** (2026-10-12) |
| 61 | `clauses.scopeEnd[2]` | `"now"` | draft | (review round 1): a word that ends a list denial ("Migraine without aura, now with worst headache of her life." raises rf_thunderclap; "No relief with meclizine, now with pulsatile tinnitus." raises rf_pulsatile) | **approved** (2026-10-12) |
| 62 | `clauses.scopeEnd[3]` | `"until"` | draft | (review round 1): a word that ends a list denial ("No hearing complaints until 2 weeks ago, now whooshing in right ear." raises rf_pulsatile) | **approved** (2026-10-12) |
| 63 | `clauses.scopeEnd[4]` | `"is"` | draft | (review round 1): a verb after a denied list starts a new statement ("No change in hearing, tinnitus is pulsatile." no longer records v_aural "no") | **approved** (2026-10-12) |
| 64 | `clauses.scopeEnd[5]` | `"are"` | draft | (review round 1): a verb after a denied list starts a new statement, as "is" | **approved** (2026-10-12) |
| 65 | `clauses.scopeEnd[6]` | `"was"` | draft | (review round 1): a verb after a denied list starts a new statement, as "is" | **approved** (2026-10-12) |
| 66 | `clauses.scopeEnd[7]` | `"were"` | draft | (review round 1): a verb after a denied list starts a new statement, as "is" | **approved** (2026-10-12) |
| 67 | `clauses.scopeEnd[8]` | `"to"` | draft | (review round 1): a word that ends a list denial ("No time today to review nausea or photophobia." and "No prior audiogram, tinnitus status to be determined." record nothing) | **approved** (2026-10-12) |
| 68 | `clauses.scopeEnd[9]` | `"from"` | draft | (review round 1): a word that ends a list denial ("Without records from the outside ENT, history of sinus surgery and antibiotic courses unknown." records neither r_surg nor r_abx as "no") | **approved** (2026-10-12) |
| 69 | `clauses.complement[0]` | `"for"` | draft | (review round 3): a word after which a denial no longer governs the finding, because the denied word is something else ("No workup for pulsatile tinnitus.", "No steroids given for sudden hearing loss.", "No CT for diplopia."): a list denial does not reach past it (the mention is set aside) and no denial lowers a red flag past it; the lexicon's 14-character window still reaches past it for a yes/no item, as in release 0.4.6 | **approved** (2026-10-12) |
| 70 | `clauses.complement[1]` | `"in"` | draft | (review round 3): as "for" ("No change in pulsatile tinnitus since last visit." raises rf_pulsatile and no longer records v_aural "no") | **approved** (2026-10-12) |
| 71 | `clauses.complement[2]` | `"about"` | draft | (review round 3): as "for" ("No concerns raised about sudden hearing loss." raises rf_ssnhl) | **approved** (2026-10-12) |
| 72 | `clauses.complement[3]` | `"after"` | draft | (review round 3): as "for" ("No imaging after the epistaxis." raises rf_mass) | **approved** (2026-10-12) |
| 73 | `clauses.complement[4]` | `"since"` | draft | (review round 3): as "for" ("No follow-up since the double vision began." raises rf_focal) | **approved** (2026-10-12) |
| 74 | `clauses.complement[5]` | `"on"` | draft | (review round 3): as "for" ("No comment on weight loss." raises rf_systemic) | **approved** (2026-10-12) |
| 75 | `clauses.complement[6]` | `"none of"` | draft | (review round 3): a quantifier that presupposes what it counts ("None of her epistaxis episodes needed packing." affirms the epistaxis). "of" alone is not a row: "No history of malignancy." and "No episodes of vertigo." stay denials | **approved** (2026-10-12) |
| 76 | `clauses.mask[0]` | `"aural"` | draft | "aura" (m_aura) inside "aural" is no hit (the H&P "aural fullness" captured m_aura; catalogue SB1) | **struck** (2026-10-12) |
| 77 | `clauses.mask[1]` | `"number"` | draft | "numb" (n_burn) inside "number" is no hit ("number of episodes" would read as numbness) | **approved** (2026-10-12) |
| 78 | `clauses.mask[2]` | `"ct showed"` | draft | (review round 2): the x_objective phrase "ct showed" names a test, not its result ("CT showed clear sinuses"): masked in chart text, it captures nothing by itself, and the pr_scan_detail card asks (cl_scan_report) | **approved** (2026-10-12) |
| 79 | `clauses.mask[3]` | `"scope showed"` | draft | (review round 2): the x_objective phrase "scope showed" names a test, not its result: masked in chart text, as "ct showed" | **approved** (2026-10-12) |
| 80 | `clauses.mask[4]` | `"lund-mackay"` | draft | (review round 2): the x_objective phrase "lund-mackay" names a score, not its value (held-out H09 "Lund-Mackay 0" was read as objective inflammation and set against "no polyps"): masked in chart text, as "ct showed" | **approved** (2026-10-12) |
| 81 | `clauses.mask[5]` | `"audiogram showed"` | draft | (review round 2): the x_lowfreq phrase "audiogram showed" names a test, not its result: masked in chart text, it captures nothing by itself, and the pr_audiogram card asks (cl_audiogram_report) | **approved** (2026-10-12) |
| 82 | `clauses.mask[6]` | `"hearing test showed"` | draft | (review round 2): the x_lowfreq phrase "hearing test showed" names a test, not its result: masked in chart text, as "audiogram showed" | **approved** (2026-10-12) |
| 83 | `clauses.mask[7]` | `"hay fever"` | draft | (review round 2): the chart red-flag phrase "fever" (clauses.redFlags rf_systemic) inside "hay fever" (seasonal allergic rhinitis) is no hit | **approved** (2026-10-12) |
| 84 | `clauses.hedge[0]` | `"reportedly"` | draft | hedged wording records nothing and asks (spec 0.4.7 §3.7; the H&P "Reportedly has known headaches."; catalogue HG1) | **approved** (2026-10-12) |
| 85 | `clauses.hedge[1]` | `"possible"` | draft | hedging chart wording (spec example; catalogue HG2 "Possible visual aura") | **approved** (2026-10-12) |
| 86 | `clauses.hedge[2]` | `"possibly"` | draft | hedging chart wording (spec example) | **approved** (2026-10-12) |
| 87 | `clauses.hedge[3]` | `"probable"` | draft | hedging chart wording (inventory CL-H) | **approved** (2026-10-12) |
| 88 | `clauses.hedge[4]` | `"questionable"` | draft | hedging chart wording (spec example) | **approved** (2026-10-12) |
| 89 | `clauses.hedge[5]` | `"suspected"` | draft | hedging chart wording (inventory CL-H) | **approved** (2026-10-12) |
| 90 | `clauses.hedge[6]` | `"unclear whether"` | draft | hedging chart wording (spec example; catalogue HG3) | **approved** (2026-10-12) |
| 91 | `clauses.hedge[7]` | `"unclear if"` | draft | hedging chart wording, as "unclear whether" | **approved** (2026-10-12) |
| 92 | `clauses.hedge[8]` | `"rule out"` | draft | a differential to rule out is not a finding (inventory CL-H) | **approved** (2026-10-12) |
| 93 | `clauses.hedge[9]` | `"r/o"` | draft | the chart abbreviation of "rule out" | **approved** (2026-10-12) |
| 94 | `clauses.hedge[10]` | `"?"` | draft | a question mark after a finding (spec example; inventory CL-H); in patient speech a question also hedges its clause (gold w019) | **approved** (2026-10-12) |
| 95 | `clauses.hedge[11]` | `"maybe"` | draft | (review round 2): hedging chart wording (held-out H23 "Nausea maybe sometimes.") | **approved** (2026-10-12) |
| 96 | `clauses.hedge[12]` | `"unsure"` | draft | (review round 2): hedging chart wording (held-out H23 "? aura - pt unsure") | **approved** (2026-10-12) |
| 97 | `clauses.hedge[13]` | `"uncertain"` | draft | (review round 2): hedging chart wording, as "unsure" | **approved** (2026-10-12) |
| 98 | `clauses.hedge[14]` | `"not sure"` | draft | (review round 2): hedging chart wording, as "unsure"; it shields the negation cue "not " it holds, so a hedged red flag ("not sure if pulsatile") is never lowered | **approved** (2026-10-12) |
| 99 | `clauses.hedge[15]` | `"might"` | draft | (review round 2): hedging chart wording ("might have nausea") | **approved** (2026-10-12) |
| 100 | `clauses.placeholder[0]` | `"***"` | draft | the Epic wildcard, unfilled template text (the H&P holds three; inventory CL-P1; catalogue PL1, PL2) | **approved** (2026-10-12) |
| 101 | `clauses.placeholder[1]` | `"___"` | draft | a blank template line (inventory CL-P1) | **approved** (2026-10-12) |
| 102 | `clauses.placeholder[2]` | `"[ ]"` | draft | (review round 2): an empty checkbox ("Nausea: [ ]", held-out H24): the line is unanswered, nothing is captured, and the template-text notice shows | **approved** (2026-10-12) |
| 103 | `clauses.placeholder[3]` | `"[]"` | draft | (review round 2): an empty checkbox written without its space, as "[ ]" | **approved** (2026-10-12) |
| 104 | `clauses.thirdParty[0]` | `"mother"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 105 | `clauses.thirdParty[1]` | `"father"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 106 | `clauses.thirdParty[2]` | `"mom "` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 107 | `clauses.thirdParty[3]` | `"dad "` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 108 | `clauses.thirdParty[4]` | `"sister"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 109 | `clauses.thirdParty[5]` | `"brother"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 110 | `clauses.thirdParty[6]` | `"daughter"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 111 | `clauses.thirdParty[7]` | `"son "` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 112 | `clauses.thirdParty[8]` | `"parents"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 113 | `clauses.thirdParty[9]` | `"sibling"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 114 | `clauses.thirdParty[10]` | `"aunt"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 115 | `clauses.thirdParty[11]` | `"uncle "` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 116 | `clauses.thirdParty[12]` | `"cousin"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 117 | `clauses.thirdParty[13]` | `"grandmother"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 118 | `clauses.thirdParty[14]` | `"grandfather"` | draft | a relative named in chart wording (no "my"), added to the attribution gate (catalogue FH3 "Sister with vertigo and hearing loss.") | **approved** (2026-10-12) |
| 119 | `clauses.thirdParty[15]` | `"family history of"` | draft | chart wording about the family (the H&P "No family history of hearing loss."; inventory CL-04): added to the attribution gate | **approved** (2026-10-12) |
| 120 | `clauses.thirdParty[16]` | `"family hx of"` | draft | the chart abbreviation of "family history of" | **approved** (2026-10-12) |
| 121 | `clauses.chartIgnoreThirdParty[0]` | `"her "` | draft | in typed chart text the shipped attribution cue "her " names the patient when a finding follows it ("Her tinnitus is bilateral."), so it does not gate there; followed by anything else it gates as before (review round 1: "Her husband has tinnitus.", "Her friend has vertigo lasting hours." and "Her children have tinnitus." stay someone else's); spoken lines still read it, and a relative ("Her mother has …", a clauses.thirdParty cue) still gates | **approved** (2026-10-12) |
| 122 | `clauses.chartIgnoreThirdParty[1]` | `"his "` | draft | in typed chart text the shipped attribution cue "his " names the patient when a finding follows it ("His dizziness is episodic."), so it does not gate there; followed by anything else it gates as before (review round 1: "His wife reports dizziness." stays hers); spoken lines still read it, and a relative ("His father has …") still gates | **approved** (2026-10-12) |
| 123 | `clauses.sections.exam[0]` | `"physical exam"` | draft | an exam header (the H&P "PHYSICAL EXAM:"): only the examItems capture under it (none since review round 2: examItems is empty) (catalogue EX1 shows such a line without its header) | **approved** (2026-10-12) |
| 124 | `clauses.sections.exam[1]` | `"physical examination"` | draft | an exam header, as "physical exam" | **approved** (2026-10-12) |
| 125 | `clauses.sections.exam[2]` | `"exam"` | draft | an exam header, as "physical exam" | **approved** (2026-10-12) |
| 126 | `clauses.sections.exam[3]` | `"examination"` | draft | an exam header, as "physical exam" | **approved** (2026-10-12) |
| 127 | `clauses.sections.exam[4]` | `"otoscopic exam"` | draft | an exam header (the H&P "OTOSCOPIC EXAM", an all-capitals line that would otherwise end the exam section) | **approved** (2026-10-12) |
| 128 | `clauses.sections.exam[5]` | `"otoscopy"` | draft | an exam header, as "physical exam" | **approved** (2026-10-12) |
| 129 | `clauses.sections.exam[6]` | `"objective"` | draft | an exam header, as "physical exam" | **approved** (2026-10-12) |
| 130 | `clauses.sections.exam[7]` | `"vital signs"` | draft | an exam header, as "physical exam" | **approved** (2026-10-12) |
| 131 | `clauses.sections.family[0]` | `"family history"` | draft | a family-history header (the H&P "FAMILY HISTORY:"; catalogue WR4): every capture under it is third-party gated except a thirdPartyExempt entry (m_fhx) | **approved** (2026-10-12) |
| 132 | `clauses.sections.family[1]` | `"family hx"` | draft | a family-history header, as "family history" | **approved** (2026-10-12) |
| 133 | `clauses.sections.family[2]` | `"fhx"` | draft | a family-history header, as "family history" | **approved** (2026-10-12) |
| 134 | `clauses.sections.skip[0]` | `"allergies"` | draft | an allergy list (the H&P "ALLERGIES:"; catalogue PH2 "ALLERGIES: penicillin, amoxicillin (rash)."): nothing captures under it | **approved** (2026-10-12) |
| 135 | `clauses.sections.skip[1]` | `"allergy"` | draft | an allergy or medication list header, as "allergies" / "medications" | **approved** (2026-10-12) |
| 136 | `clauses.sections.skip[2]` | `"medications"` | draft | a medication list (the H&P "Medications"): nothing captures under it (a listed drug is not a failed course) | **approved** (2026-10-12) |
| 137 | `clauses.sections.skip[3]` | `"medication"` | draft | an allergy or medication list header, as "allergies" / "medications" | **approved** (2026-10-12) |
| 138 | `clauses.sections.skip[4]` | `"meds"` | draft | an allergy or medication list header, as "allergies" / "medications" | **approved** (2026-10-12) |
| 139 | `clauses.sections.skip[5]` | `"current medications"` | draft | an allergy or medication list header, as "allergies" / "medications" | **approved** (2026-10-12) |
| 140 | `clauses.sections.read[0]` | `"hpi"` | draft | (review round 1): a history header, read normally; it ends an exam, family-history or skip section ("PHYSICAL EXAM: … HPI"), while an exam's own sub-labels ("HEENT:", "Neuro:") no longer end the exam | **approved** (2026-10-12) |
| 141 | `clauses.sections.read[1]` | `"history of present illness"` | draft | (review round 1): a history header, read normally, as "hpi" | **approved** (2026-10-12) |
| 142 | `clauses.sections.read[2]` | `"interval history"` | draft | (review round 1): a history header, read normally, as "hpi" | **approved** (2026-10-12) |
| 143 | `clauses.sections.read[3]` | `"ros"` | draft | (review round 1): the review-of-systems header (the H&P "ROS:"), read normally, as "hpi" | **approved** (2026-10-12) |
| 144 | `clauses.sections.read[4]` | `"review of systems"` | draft | (review round 1): the review-of-systems header, read normally, as "hpi" | **approved** (2026-10-12) |
| 145 | `clauses.sections.read[5]` | `"past medical history"` | draft | (review round 1): the past-medical-history header (the H&P "PAST MEDICAL HISTORY:"), read normally, as "hpi" | **approved** (2026-10-12) |
| 146 | `clauses.sections.read[6]` | `"pmh"` | draft | (review round 1): the past-medical-history abbreviation, read normally, as "hpi" | **approved** (2026-10-12) |
| 147 | `clauses.sections.read[7]` | `"past surgical history"` | draft | (review round 1): the past-surgical-history header, read normally (a sinus surgery listed there is r_surg), as "hpi" | **approved** (2026-10-12) |
| 148 | `clauses.sections.read[8]` | `"psh"` | draft | (review round 1): the past-surgical-history abbreviation, read normally, as "hpi" | **approved** (2026-10-12) |
| 149 | `clauses.sections.read[9]` | `"social history"` | draft | (review round 1): the social-history header, read normally, as "hpi" | **approved** (2026-10-12) |
| 150 | `clauses.sections.read[10]` | `"assessment"` | draft | (review round 1): an assessment header, read normally; after an exam it ends the exam ("PHYSICAL EXAM: … ASSESSMENT: Vestibular migraine with photophobia.") | **approved** (2026-10-12) |
| 151 | `clauses.sections.read[11]` | `"plan"` | draft | (review round 1): a plan header, read normally, as "assessment" | **approved** (2026-10-12) |
| 152 | `clauses.sections.read[12]` | `"assessment and plan"` | draft | (review round 1): an assessment-and-plan header, read normally, as "assessment" | **approved** (2026-10-12) |
| 153 | `clauses.sections.read[13]` | `"assessment/plan"` | draft | (review round 1): an assessment-and-plan header ("Assessment/Plan:"), read normally, as "assessment" | **approved** (2026-10-12) |
| 154 | `clauses.sections.read[14]` | `"a/p"` | draft | (review round 1): the assessment-and-plan abbreviation, read normally, as "assessment" | **approved** (2026-10-12) |
| 155 | `clauses.sections.read[15]` | `"impression"` | draft | (review round 1): an impression header, read normally, as "assessment" | **approved** (2026-10-12) |
| 156 | `clauses.sections.read[16]` | `"impression and plan"` | draft | (review round 1): an impression-and-plan header, read normally, as "assessment" | **approved** (2026-10-12) |
| 157 | `clauses.redFlags.rf_thunderclap[0]` | `"sudden severe headache"` | draft | (review round 2): chart wording of rf_thunderclap, whose text is "Headache that reached maximum intensity within seconds to a minute"; read in typed chart text only | **approved** (2026-10-12) |
| 158 | `clauses.redFlags.rf_thunderclap[1]` | `"sudden onset headache"` | draft | (review round 2): chart wording of rf_thunderclap, whose text is "Headache that reached maximum intensity within seconds to a minute"; read in typed chart text only | **struck** (2026-10-12) |
| 159 | `clauses.redFlags.rf_thunderclap[2]` | `"sudden-onset headache"` | draft | (review round 2): chart wording of rf_thunderclap, whose text is "Headache that reached maximum intensity within seconds to a minute"; read in typed chart text only | **struck** (2026-10-12) |
| 160 | `clauses.redFlags.rf_thunderclap[3]` | `"sudden onset severe headache"` | draft | (review round 2): chart wording of rf_thunderclap, whose text is "Headache that reached maximum intensity within seconds to a minute"; read in typed chart text only | **approved** (2026-10-12) |
| 161 | `clauses.redFlags.rf_thunderclap[4]` | `"sudden-onset severe headache"` | draft | (review round 2): chart wording of rf_thunderclap, whose text is "Headache that reached maximum intensity within seconds to a minute"; read in typed chart text only | **approved** (2026-10-12) |
| 162 | `clauses.redFlags.rf_thunderclap[5]` | `"maximal at onset"` | draft | (review round 2): chart wording of rf_thunderclap, whose text is "Headache that reached maximum intensity within seconds to a minute"; read in typed chart text only | **approved** (2026-10-12) |
| 163 | `clauses.redFlags.rf_thunderclap[6]` | `"maximum intensity within"` | draft | (review round 2): chart wording of rf_thunderclap, whose text is "Headache that reached maximum intensity within seconds to a minute"; read in typed chart text only | **approved** (2026-10-12) |
| 164 | `clauses.redFlags.rf_thunderclap[7]` | `"peak intensity within"` | draft | (review round 2): chart wording of rf_thunderclap, whose text is "Headache that reached maximum intensity within seconds to a minute"; read in typed chart text only | **approved** (2026-10-12) |
| 165 | `clauses.redFlags.rf_focal[0]` | `"diplopia"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **approved** (2026-10-12) |
| 166 | `clauses.redFlags.rf_focal[1]` | `"facial droop"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; the shipped phrase "droop" inside it is part of it, so "No vision loss, diplopia, facial droop, weakness, or slurred speech." still denies the flag; read in typed chart text only | **approved** (2026-10-12) |
| 167 | `clauses.redFlags.rf_focal[2]` | `"facial weakness"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **approved** (2026-10-12) |
| 168 | `clauses.redFlags.rf_focal[3]` | `"facial numbness"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **struck** (2026-10-12) |
| 169 | `clauses.redFlags.rf_focal[4]` | `"dysarthria"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **approved** (2026-10-12) |
| 170 | `clauses.redFlags.rf_focal[5]` | `"aphasia"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **struck** (2026-10-12) |
| 171 | `clauses.redFlags.rf_focal[6]` | `"dysphagia"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **approved** (2026-10-12) |
| 172 | `clauses.redFlags.rf_focal[7]` | `"hemiparesis"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **approved** (2026-10-12) |
| 173 | `clauses.redFlags.rf_focal[8]` | `"unilateral weakness"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **approved** (2026-10-12) |
| 174 | `clauses.redFlags.rf_focal[9]` | `"focal weakness"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **approved** (2026-10-12) |
| 175 | `clauses.redFlags.rf_focal[10]` | `"focal deficit"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **approved** (2026-10-12) |
| 176 | `clauses.redFlags.rf_focal[11]` | `"focal neurologic deficit"` | draft | (review round 2): chart wording of rf_focal, whose text is "New focal deficit — weakness, numbness, speech or swallowing change, facial droop, or persistent double vision"; read in typed chart text only | **approved** (2026-10-12) |
| 177 | `clauses.redFlags.rf_focal[12]` | `"slurred speech"` | draft | (review round 3): the flag's own ask ("Any new weakness, numbness, slurred speech, or double vision?"); one phrase, so a list of negatives ending "or slurred speech" denies it now that a later list item must be the bare flag phrase | **approved** (2026-10-12) |
| 178 | `clauses.redFlags.rf_vision[0]` | `"vision loss"` | draft | (review round 2): chart wording of rf_vision, whose text is "Progressive vision loss, transient visual obscurations, or known papilloedema"; read in typed chart text only | **struck** (2026-10-12) |
| 179 | `clauses.redFlags.rf_vision[1]` | `"visual loss"` | draft | (review round 2): chart wording of rf_vision, whose text is "Progressive vision loss, transient visual obscurations, or known papilloedema"; read in typed chart text only | **struck** (2026-10-12) |
| 180 | `clauses.redFlags.rf_vision[2]` | `"loss of vision"` | draft | (review round 2): chart wording of rf_vision, whose text is "Progressive vision loss, transient visual obscurations, or known papilloedema"; read in typed chart text only | **approved** (2026-10-12) |
| 181 | `clauses.redFlags.rf_vision[3]` | `"visual obscuration"` | draft | (review round 2): chart wording of rf_vision, whose text is "Progressive vision loss, transient visual obscurations, or known papilloedema"; read in typed chart text only | **struck** (2026-10-12) |
| 182 | `clauses.redFlags.rf_vision[4]` | `"papilledema"` | draft | (review round 2): chart wording of rf_vision, whose text is "Progressive vision loss, transient visual obscurations, or known papilloedema"; read in typed chart text only | **approved** (2026-10-12) |
| 183 | `clauses.redFlags.rf_vision[5]` | `"papilloedema"` | draft | (review round 2): chart wording of rf_vision, whose text is "Progressive vision loss, transient visual obscurations, or known papilloedema"; read in typed chart text only | **approved** (2026-10-12) |
| 184 | `clauses.redFlags.rf_gca[0]` | `"scalp tenderness"` | draft | (review round 2): chart wording of rf_gca, whose text is "Age over 50 with scalp tenderness, jaw claudication, or visual symptoms" (held-out H20 "scalp tenderness when brushing her hair"); read in typed chart text only | **approved** (2026-10-12) |
| 185 | `clauses.redFlags.rf_gca[1]` | `"jaw claudication"` | draft | (review round 2): chart wording of rf_gca, whose text is "Age over 50 with scalp tenderness, jaw claudication, or visual symptoms"; read in typed chart text only | **approved** (2026-10-12) |
| 186 | `clauses.redFlags.rf_gca[2]` | `"jaw pain with chewing"` | draft | (review round 2): chart wording of rf_gca, whose text is "Age over 50 with scalp tenderness, jaw claudication, or visual symptoms"; read in typed chart text only | **struck** (2026-10-12) |
| 187 | `clauses.redFlags.rf_gca[3]` | `"jaw pain when chewing"` | draft | (review round 2): chart wording of rf_gca, whose text is "Age over 50 with scalp tenderness, jaw claudication, or visual symptoms"; read in typed chart text only | **struck** (2026-10-12) |
| 188 | `clauses.redFlags.rf_gca[4]` | `"jaw pain on chewing"` | draft | (review round 2): chart wording of rf_gca, whose text is "Age over 50 with scalp tenderness, jaw claudication, or visual symptoms"; read in typed chart text only | **struck** (2026-10-12) |
| 189 | `clauses.redFlags.rf_gca[5]` | `"temporal artery tenderness"` | draft | (review round 2): chart wording of rf_gca, whose text is "Age over 50 with scalp tenderness, jaw claudication, or visual symptoms" (pr_temporal_artery's option "Tender or pulseless" raises the flag); read in typed chart text only | **approved** (2026-10-12) |
| 190 | `clauses.redFlags.rf_orbital[0]` | `"periorbital swelling"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement" (held-out H21 "Left periorbital swelling"); read in typed chart text only | **struck** (2026-10-12) |
| 191 | `clauses.redFlags.rf_orbital[1]` | `"periorbital edema"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement"; read in typed chart text only | **struck** (2026-10-12) |
| 192 | `clauses.redFlags.rf_orbital[2]` | `"periorbital oedema"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement"; read in typed chart text only | **struck** (2026-10-12) |
| 193 | `clauses.redFlags.rf_orbital[3]` | `"orbital swelling"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement"; read in typed chart text only | **struck** (2026-10-12) |
| 194 | `clauses.redFlags.rf_orbital[4]` | `"proptosis"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement"; read in typed chart text only | **approved** (2026-10-12) |
| 195 | `clauses.redFlags.rf_orbital[5]` | `"eye pain"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement"; the flag's own words ("eye pain"); it raises the flag on any undenied mention, for the lead to confirm; read in typed chart text only | **struck** (2026-10-12) |
| 196 | `clauses.redFlags.rf_orbital[6]` | `"pain with eye movement"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement"; read in typed chart text only | **struck** (2026-10-12) |
| 197 | `clauses.redFlags.rf_orbital[7]` | `"pain on eye movement"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement" (held-out H21 "pain on eye movement"); read in typed chart text only | **struck** (2026-10-12) |
| 198 | `clauses.redFlags.rf_orbital[8]` | `"painful eye movement"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement"; read in typed chart text only | **approved** (2026-10-12) |
| 199 | `clauses.redFlags.rf_orbital[9]` | `"restricted eye movement"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement"; read in typed chart text only | **approved** (2026-10-12) |
| 200 | `clauses.redFlags.rf_orbital[10]` | `"ophthalmoplegia"` | draft | (review round 2): chart wording of rf_orbital, whose text is "Orbital or periorbital swelling, proptosis, eye pain, or restricted eye movement"; read in typed chart text only | **approved** (2026-10-12) |
| 201 | `clauses.redFlags.rf_ssnhl[0]` | `"sudden hearing loss"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days" (held-out H11 "sudden hearing loss in the left ear"); read in typed chart text only | **approved** (2026-10-12) |
| 202 | `clauses.redFlags.rf_ssnhl[1]` | `"sudden sensorineural"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days"; read in typed chart text only | **approved** (2026-10-12) |
| 203 | `clauses.redFlags.rf_ssnhl[2]` | `"ssnhl"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days"; read in typed chart text only | **approved** (2026-10-12) |
| 204 | `clauses.redFlags.rf_ssnhl[3]` | `"sudden snhl"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days"; read in typed chart text only | **approved** (2026-10-12) |
| 205 | `clauses.redFlags.rf_ssnhl[4]` | `"sudden deafness"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days"; read in typed chart text only | **approved** (2026-10-12) |
| 206 | `clauses.redFlags.rf_ssnhl[5]` | `"sudden onset hearing loss"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days"; read in typed chart text only | **approved** (2026-10-12) |
| 207 | `clauses.redFlags.rf_ssnhl[6]` | `"sudden-onset hearing loss"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days"; read in typed chart text only | **approved** (2026-10-12) |
| 208 | `clauses.redFlags.rf_ssnhl[7]` | `"sudden loss of hearing"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days"; read in typed chart text only | **approved** (2026-10-12) |
| 209 | `clauses.redFlags.rf_ssnhl[8]` | `"sudden drop in hearing"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days"; read in typed chart text only | **approved** (2026-10-12) |
| 210 | `clauses.redFlags.rf_ssnhl[9]` | `"sudden decrease in hearing"` | draft | (review round 2): chart wording of rf_ssnhl, whose text is "Hearing dropped suddenly, over hours to a day, within the last 30 days"; read in typed chart text only | **approved** (2026-10-12) |
| 211 | `clauses.redFlags.rf_asym[0]` | `"unilateral hearing loss"` | draft | (review round 2): chart wording of rf_asym, whose text is "Hearing loss or tinnitus consistently in one ear only"; read in typed chart text only | **approved** (2026-10-12) |
| 212 | `clauses.redFlags.rf_asym[1]` | `"unilateral tinnitus"` | draft | (review round 2): chart wording of rf_asym, whose text is "Hearing loss or tinnitus consistently in one ear only"; read in typed chart text only | **approved** (2026-10-12) |
| 213 | `clauses.redFlags.rf_asym[2]` | `"unilateral snhl"` | draft | (review round 2): chart wording of rf_asym, whose text is "Hearing loss or tinnitus consistently in one ear only"; read in typed chart text only | **approved** (2026-10-12) |
| 214 | `clauses.redFlags.rf_asym[3]` | `"unilateral sensorineural"` | draft | (review round 2): chart wording of rf_asym, whose text is "Hearing loss or tinnitus consistently in one ear only"; read in typed chart text only | **approved** (2026-10-12) |
| 215 | `clauses.redFlags.rf_asym[4]` | `"asymmetric hearing"` | draft | (review round 2): chart wording of rf_asym, whose text is "Hearing loss or tinnitus consistently in one ear only"; read in typed chart text only | **approved** (2026-10-12) |
| 216 | `clauses.redFlags.rf_asym[5]` | `"asymmetrical hearing"` | draft | (review round 2): chart wording of rf_asym, whose text is "Hearing loss or tinnitus consistently in one ear only"; read in typed chart text only | **approved** (2026-10-12) |
| 217 | `clauses.redFlags.rf_asym[6]` | `"asymmetric snhl"` | draft | (review round 2): chart wording of rf_asym, whose text is "Hearing loss or tinnitus consistently in one ear only"; read in typed chart text only | **approved** (2026-10-12) |
| 218 | `clauses.redFlags.rf_asym[7]` | `"asymmetric sensorineural"` | draft | (review round 2): chart wording of rf_asym, whose text is "Hearing loss or tinnitus consistently in one ear only"; read in typed chart text only | **approved** (2026-10-12) |
| 219 | `clauses.redFlags.rf_pulsatile[0]` | `"pulse-synchronous"` | draft | (review round 2): chart wording of rf_pulsatile, whose text is "Tinnitus that pulses in time with the heartbeat"; read in typed chart text only | **approved** (2026-10-12) |
| 220 | `clauses.redFlags.rf_pulsatile[1]` | `"pulse synchronous"` | draft | (review round 2): chart wording of rf_pulsatile, whose text is "Tinnitus that pulses in time with the heartbeat"; read in typed chart text only | **approved** (2026-10-12) |
| 221 | `clauses.redFlags.rf_pulsatile[2]` | `"pulsing tinnitus"` | draft | (review round 2): chart wording of rf_pulsatile, whose text is "Tinnitus that pulses in time with the heartbeat"; read in typed chart text only | **approved** (2026-10-12) |
| 222 | `clauses.redFlags.rf_pulsatile[3]` | `"pulsating tinnitus"` | draft | (review round 2): chart wording of rf_pulsatile, whose text is "Tinnitus that pulses in time with the heartbeat"; read in typed chart text only | **approved** (2026-10-12) |
| 223 | `clauses.redFlags.rf_progressive[0]` | `"steadily worsening"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat" (the flag's own words; held-out H27 "steadily worsening over 6 weeks"); read in typed chart text only | **approved** (2026-10-12) |
| 224 | `clauses.redFlags.rf_progressive[1]` | `"worsening headache"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 225 | `clauses.redFlags.rf_progressive[2]` | `"progressive headache"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 226 | `clauses.redFlags.rf_progressive[3]` | `"worse on waking"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 227 | `clauses.redFlags.rf_progressive[4]` | `"worse upon waking"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 228 | `clauses.redFlags.rf_progressive[5]` | `"worse with cough"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat" (held-out H27 "worse with coughing"; a stem, so "coughing" too); read in typed chart text only | **approved** (2026-10-12) |
| 229 | `clauses.redFlags.rf_progressive[6]` | `"worse with valsalva"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 230 | `clauses.redFlags.rf_progressive[7]` | `"worse with strain"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 231 | `clauses.redFlags.rf_progressive[8]` | `"worse lying flat"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 232 | `clauses.redFlags.rf_progressive[9]` | `"worse when lying flat"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 233 | `clauses.redFlags.rf_progressive[10]` | `"worse when supine"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 234 | `clauses.redFlags.rf_progressive[11]` | `"wakes from sleep"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 235 | `clauses.redFlags.rf_progressive[12]` | `"waking from sleep"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 236 | `clauses.redFlags.rf_progressive[13]` | `"wakes him from sleep"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 237 | `clauses.redFlags.rf_progressive[14]` | `"wakes her from sleep"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 238 | `clauses.redFlags.rf_progressive[15]` | `"waking him from sleep"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat" (held-out H27 "now waking him from sleep"); read in typed chart text only | **approved** (2026-10-12) |
| 239 | `clauses.redFlags.rf_progressive[16]` | `"waking her from sleep"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 240 | `clauses.redFlags.rf_progressive[17]` | `"awakens from sleep"` | draft | (review round 2): chart wording of rf_progressive, whose text is "Headache steadily worsening, or worse on waking, coughing, straining, or lying flat"; read in typed chart text only | **approved** (2026-10-12) |
| 241 | `clauses.redFlags.rf_new50[0]` | `"new headache over 50"` | draft | (review round 2): chart wording of rf_new50, whose text is "First-ever severe headache beginning after age 50" (the team's draft wording; the flag also needs the age, which no phrase can check); read in typed chart text only | **approved** (2026-10-12) |
| 242 | `clauses.redFlags.rf_new50[1]` | `"new headache after 50"` | draft | (review round 2): chart wording of rf_new50, whose text is "First-ever severe headache beginning after age 50"; read in typed chart text only | **approved** (2026-10-12) |
| 243 | `clauses.redFlags.rf_new50[2]` | `"new headache after age 50"` | draft | (review round 2): chart wording of rf_new50, whose text is "First-ever severe headache beginning after age 50"; read in typed chart text only | **approved** (2026-10-12) |
| 244 | `clauses.redFlags.rf_new50[3]` | `"new onset headache after 50"` | draft | (review round 2): chart wording of rf_new50, whose text is "First-ever severe headache beginning after age 50"; read in typed chart text only | **approved** (2026-10-12) |
| 245 | `clauses.redFlags.rf_new50[4]` | `"new-onset headache after 50"` | draft | (review round 2): chart wording of rf_new50, whose text is "First-ever severe headache beginning after age 50"; read in typed chart text only | **approved** (2026-10-12) |
| 246 | `clauses.redFlags.rf_new50[5]` | `"new onset headache after age 50"` | draft | (review round 2): chart wording of rf_new50, whose text is "First-ever severe headache beginning after age 50"; read in typed chart text only | **approved** (2026-10-12) |
| 247 | `clauses.redFlags.rf_new50[6]` | `"new-onset headache after age 50"` | draft | (review round 2): chart wording of rf_new50, whose text is "First-ever severe headache beginning after age 50"; read in typed chart text only | **approved** (2026-10-12) |
| 248 | `clauses.redFlags.rf_new50[7]` | `"first-ever severe headache"` | draft | (review round 2): chart wording of rf_new50, whose text is "First-ever severe headache beginning after age 50"; read in typed chart text only | **approved** (2026-10-12) |
| 249 | `clauses.redFlags.rf_new50[8]` | `"first ever severe headache"` | draft | (review round 2): chart wording of rf_new50, whose text is "First-ever severe headache beginning after age 50"; read in typed chart text only | **approved** (2026-10-12) |
| 250 | `clauses.redFlags.rf_mass[0]` | `"epistaxis"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness" (held-out H22 "recurrent right epistaxis"); read in typed chart text only | **approved** (2026-10-12) |
| 251 | `clauses.redFlags.rf_mass[1]` | `"unilateral nasal obstruction"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 252 | `clauses.redFlags.rf_mass[2]` | `"one-sided nasal obstruction"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 253 | `clauses.redFlags.rf_mass[3]` | `"right-sided nasal obstruction"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness" (held-out H22 "Progressive right-sided nasal obstruction"); read in typed chart text only | **approved** (2026-10-12) |
| 254 | `clauses.redFlags.rf_mass[4]` | `"left-sided nasal obstruction"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 255 | `clauses.redFlags.rf_mass[5]` | `"right nasal obstruction"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 256 | `clauses.redFlags.rf_mass[6]` | `"left nasal obstruction"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 257 | `clauses.redFlags.rf_mass[7]` | `"nasal mass"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 258 | `clauses.redFlags.rf_mass[8]` | `"intranasal mass"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 259 | `clauses.redFlags.rf_mass[9]` | `"sinonasal mass"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 260 | `clauses.redFlags.rf_mass[10]` | `"nasal cavity mass"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 261 | `clauses.redFlags.rf_mass[11]` | `"cheek numbness"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; the chart form of the shipped "cheek is numb"; read in typed chart text only | **approved** (2026-10-12) |
| 262 | `clauses.redFlags.rf_mass[12]` | `"v2 numbness"` | draft | (review round 2): chart wording of rf_mass, whose text is "One-sided nasal obstruction with bleeding, a visible mass, or new facial numbness"; read in typed chart text only | **approved** (2026-10-12) |
| 263 | `clauses.redFlags.rf_systemic[0]` | `"fever"` | draft | (review round 2): chart wording of rf_systemic, whose text is "Fever, night sweats, unintended weight loss, immunosuppression, or known malignancy"; a stem ("fevers", "feverish"); never inside "afebrile" (word start, held-out H21) and masked inside "hay fever"; read in typed chart text only | **approved** (2026-10-12) |
| 264 | `clauses.redFlags.rf_systemic[1]` | `"febrile"` | draft | (review round 2): chart wording of rf_systemic, whose text is "Fever, night sweats, unintended weight loss, immunosuppression, or known malignancy"; never inside "afebrile" (word start); read in typed chart text only | **approved** (2026-10-12) |
| 265 | `clauses.redFlags.rf_systemic[2]` | `"weight loss"` | draft | (review round 2): chart wording of rf_systemic, whose text is "Fever, night sweats, unintended weight loss, immunosuppression, or known malignancy"; any undenied weight loss, intended or not, for the lead to confirm; read in typed chart text only | **approved** (2026-10-12) |
| 266 | `clauses.redFlags.rf_systemic[3]` | `"immunosuppress"` | draft | (review round 2): chart wording of rf_systemic, whose text is "Fever, night sweats, unintended weight loss, immunosuppression, or known malignancy"; a stem (immunosuppressed, immunosuppression); read in typed chart text only | **approved** (2026-10-12) |
| 267 | `clauses.redFlags.rf_systemic[4]` | `"immunocompromised"` | draft | (review round 2): chart wording of rf_systemic, whose text is "Fever, night sweats, unintended weight loss, immunosuppression, or known malignancy"; read in typed chart text only | **approved** (2026-10-12) |
| 268 | `clauses.redFlags.rf_systemic[5]` | `"malignancy"` | draft | (review round 2): chart wording of rf_systemic, whose text is "Fever, night sweats, unintended weight loss, immunosuppression, or known malignancy"; "known malignancy" in the flag text; a mention to rule out also raises it (hedges never lower a flag); read in typed chart text only | **approved** (2026-10-12) |
| 269 | `negation.cues[15]` (appended) | `"wasn't"` | draft | the negating contraction "wasn't" (appended; window-only, measured from its "n't" so it reaches as far as the 0.3.2 cue "n't" did; gold v025 "It wasn't as if the world was moving.") | **approved** (2026-10-12) |
| 270 | `negation.cues[16]` (appended) | `"weren't"` | draft | the negating contraction "weren't" (appended; window-only, measured from its "n't") | **approved** (2026-10-12) |
| 271 | `negation.cues[17]` (appended) | `"aren't"` | draft | the negating contraction "aren't" (appended; window-only, measured from its "n't") | **approved** (2026-10-12) |
| 272 | `negation.cues[18]` (appended) | `"hadn't"` | draft | the negating contraction "hadn't" (appended; window-only, measured from its "n't") | **approved** (2026-10-12) |
| 273 | `clauses.wordStart` | `true` | draft | (engine switch): every phrase and cue matches only at a word start ("stress" inside "distress", "fess" inside "professional", the attribution cue "her " inside "other" and "whether"; catalogue SB2, SB4, HG3); a contained word needs a mask | **approved** (2026-10-12) |
| 274 | `clauses.placeholderAsk.text` | `"This line holds unfilled template text (***)."` | draft | engine-neutral wording of the one placeholder notice (review round 2: a notice with a Dismiss control, no longer a question with only Skip; the module has no wording for unfilled template text). It names "***", the Epic wildcard, and shows for the other placeholder cues too; the card quotes the line | **approved** (2026-10-12) |
| 275 | `clauses.examItems` | `[]` (none) | draft | (review round 2): no item is captured inside an exam section (the default). r_normal and x_objective were removed: the lead's history and physical recorded r_normal from "lids, lashes and lacrimal glands within normal limits", and an office nasal exam line ("Nose: no polyps.") answered x_objective, which names endoscopy or CT; lead question in the CHANGELOG Part D | **approved** (2026-10-12) |
| 276 | `clauses.strictConflict[0]` | `x_purulent` | draft | x_purulent is a rule-out item (Discriminators, w -8): a "yes" lowers the index, so a chart that affirms and denies it in different words records nothing and asks (a conflict card) rather than letting the affirmed mention win | **approved** (2026-10-12) |
| 277 | `clauses.strictConflict[1]` | `x_objective` | draft | x_objective is a rule-out item (Discriminators, w -8): a "yes" lowers the index, so a chart that affirms and denies it in different words records nothing and asks (a conflict card) rather than letting the affirmed mention win | **approved** (2026-10-12) |
| 278 | `clauses.strictConflict[2]` | `x_lowfreq` | draft | x_lowfreq is a rule-out item (Discriminators, w -8): a "yes" lowers the index, so a chart that affirms and denies it in different words records nothing and asks (a conflict card) rather than letting the affirmed mention win | **approved** (2026-10-12) |
| 279 | `clauses.strictConflict[3]` | `x_anosmia` | draft | x_anosmia is a rule-out item (Discriminators, w -5): a "yes" lowers the index, so a chart that affirms and denies it in different words records nothing and asks (a conflict card) rather than letting the affirmed mention win | **approved** (2026-10-12) |
| 280 | `clauses.redFlagNegation` | `true` | lead (decision) | The clinical lead's decision of 2026-10-11 (decisions.redFlags, "Don't raise, no listing"): a red flag whose every mention is denied is not raised and not listed | the lead's decision of 2026-10-11 (no sign-off needed) |

**B. Clarification entries (`lexicon.clarify`).** 14 entries. Every trigger and qualifier list is a
draft. Each question is the module's own, except the lead's rhinorrhea question. The answers are
always the module's options, shown as written. Review round 2 added rows 293-294 (`cl_scan_report`,
`cl_audiogram_report`: a report header asks what the report showed) and removed qualifiers from rows
281-285 and 289: every qualifier of a safety entry that states the dangerous answer without raising
its flag (left, right, unilateral, one ear, same ear, one side, one-sided, sudden, pulsing, pulses,
heartbeat, bloody) and the test names audiogram, audiometry and hearing test. Review round 3 changed
no entry; since then a qualifier resolves a card only when the text states it undenied (an engine
rule: "not bilateral" asks the laterality question).

| # | Entry | Triggers `ph` (draft) | Resolved by `unless` (draft) | Asks through | Question (source) | Answers (module) | Lead |
|---|---|---|---|---|---|---|---|
| 281 | `cl_rhinorrhea` (lead) | `"runny nose"`, `"rhinorrhea"`, `"rhinorrhoea"`, `"nasal discharge"`, `"nasal drainage"`, `"post-nasal drip"`, `"postnasal drip"`, `"post nasal drip"`, `"drippy nose"` | `"purulent"`, `"clear"`, `"watery"`, `"thin "`, `"thick"`, `"green"`, `"yellow"`, `"cloudy"`, `"discolored"`, `"discoloured"`, `"colored"`, `"coloured"`, `"culture"` | probe `pr_purulence` | "is the rhinorrhea clear or purulent?" (lead, verbatim, never re-cased) | Yes, purulent or culture-positive / Clear or no drainage | triggers and qualifiers: approve / strike each phrase; the question is the lead's; the lead's D8 answer (2026-10-12) removed the positive-answer qualifiers purulent, thick, green, yellow, cloudy, discolored, discoloured, colored, coloured, culture |
| 282 | `cl_tinnitus_quality` (draft) | `"tinnitus"`, `"ringing"`, `"ear ring"`, `"ears ring"`, `"roaring"`, `"buzzing"`, `"hissing"` | `"pulsatile"`, `"whooshing"`, `"clicking"`, `"steady"` | probe `pr_tinnitus_quality` | "The ringing — has the quality changed at all? Does it pulse in time with your heartbeat, or click?" (module: the probe's say) | Pulses with heartbeat / Clicking / Steady tone, unchanged | **approved** (2026-10-12); the lead's D8 answer then removed the qualifier(s) clicking, steady |
| 283 | `cl_laterality` (draft) | `"tinnitus"`, `"ringing"`, `"ear full"`, `"ears feel full"`, `"fullness in my ear"`, `"plugged"`, `"hearing loss"`, `"decreased hearing"` | `"bilateral"`, `"both ears"`, `"alternat"` | probe `pr_laterality` | "When the ringing or fullness happens, is it always the same ear?" (module: the probe's say) | Always the same ear / Both ears, or it moves | **approved** (2026-10-12) |
| 284 | `cl_hearing_onset` (draft) | `"hearing loss"`, `"decreased hearing"`, `"muffled hearing"`, `"trouble hearing"`, `"hard of hearing"` | `"gradual"`, `"progressive"`, `"slowly"` | probe `pr_sudden_drop` | "Has your hearing ever dropped suddenly — over hours or a day — rather than gradually?" (module: the probe's say) | Yes, suddenly / Gradual, or no change | **approved** (2026-10-12); the lead's D8 answer then removed the qualifier(s) progressive |
| 285 | `cl_audiogram` (draft) | `"hearing loss"`, `"decreased hearing"`, `"fluctuating hearing"` | `"low-frequency"`, `"low frequency"` | probe `pr_audiogram` | "Have you had two hearing tests at different times — did the low tones drop and then come back?" (module: the probe's say) | Yes, it fluctuates / Stable, or never tested twice | **approved** (2026-10-12); the lead's D8 answer then removed the qualifier(s) low-frequency, low frequency |
| 286 | `cl_dizziness_kind` (draft) | `"dizziness"`, `"dizzy"` | `"vertigo"`, `"spinning"`, `"room spins"`, `"lightheaded"`, `"light-headed"`, `"imbalance"`, `"unsteady"`, `"off balance"`, `"rocking"`, `"swaying"`, `"bobbing"` | probe `pr_internal_vertigo` | "Does your head ever feel like it's bobbing, rocking, or swaying side to side — like still being on a boat after you've stepped off — even while you're sitting perfectly still?" (module: the probe's say) | Yes — rocking or bobbing / Yes, but only seconds at a time / No sensation of self-motion | **approved** (2026-10-12) |
| 287 | `cl_otalgia` (draft) | `"ear pain"`, `"otalgia"`, `"ear hurts"`, `"ear discomfort"` | `"deep"` | item `n_otalgia` | "Any deep ear or throat pain, even when the ear looks normal?" (module: the item's ask) | Yes / No | **approved** (2026-10-12); the lead's D8 answer then removed the qualifier(s) deep |
| 288 | `cl_smell` (draft) | `"hyposmia"`, `"anosmia"`, `"loss of smell"`, `"decreased smell"`, `"reduced smell"` | `"between episodes"`, `"between flares"`, `"persistent"`, `"constant"`, `"all the time"`, `"only during"` | probe `pr_smell` | "Between the bad episodes, is your sense of smell normal?" (module: the probe's say) | Reduced even between flares / Normal in between | **approved** (2026-10-12); the lead's D8 answer then removed the qualifier(s) between episodes, between flares, persistent, constant, all the time |
| 289 | `cl_nasal_side` (draft) | `"nasal obstruction"`, `"nasal congestion"`, `"congestion"`, `"stuffy"`, `"blocked nose"`, `"stuffed up"` | `"bilateral"`, `"both sides"`, `"alternat"` | probe `pr_nasal_mass` | "Is one side of the nose blocked more than the other, with any bleeding or numbness of the cheek?" (module: the probe's say) | Yes, one-sided / Symmetric, no bleeding | **approved** (2026-10-12) |
| 290 | `cl_hints` (draft) | `"hints negative"`, `"hints normal"`, `"hints positive"`, `"hints benign"` | `"saccade"`, `"skew"`, `"direction-changing"`, `"head impulse"` | probe `pr_head_impulse` | "Head impulse, and check for skew and direction-changing nystagmus." (module: the probe's say) | Normal impulse (points central) / Corrective saccade (peripheral) / Deferred | **approved** (2026-10-12) |
| 291 | `cl_neck` (draft) | `"cervicalgia"`, `"neck pain"`, `"neck ache"`, `"neck stiffness"` | `"during"`, `"before"`, `"after"`, `"with the episodes"`, `"attack"` | probe `pr_neck` | "Does your neck ache or stiffen up as part of it — before, during, or after?" (module: the probe's say) | Yes, neck involved / No | **approved** (2026-10-12) |
| 292 | `cl_viral_onset` (draft) | `"upper respiratory infection"`, `"respiratory infection"`, `"covid"`, `"influenza"`, `"viral"` | `"after"`, `"since"`, `"following"`, `"post"` | item `n_viral` | "Did this start after a viral illness or COVID?" (module: the item's ask) | Yes / No | **approved** (2026-10-12) |
| 293 | `cl_scan_report` (draft) | `"ct showed"`, `"scope showed"`, `"lund-mackay"` | `"scan showed inflammation"`, `"opacification"`, `"mucosal thickening"`, `"polyps"` | probe `pr_scan_detail` | "What did the scan actually report — any mucosal thickening, opacification, or polyps?" (module: the probe's say) | Real inflammation reported / Genuinely clear | **approved** (2026-10-12); the lead's D8 answer then removed the qualifier(s) scan showed inflammation, opacification, mucosal thickening, polyps |
| 294 | `cl_audiogram_report` (draft) | `"audiogram showed"`, `"hearing test showed"` | `"low frequency loss"`, `"hearing drops during"`, `"hearing comes back"` | probe `pr_audiogram` | "Have you had two hearing tests at different times — did the low tones drop and then come back?" (module: the probe's say) | Yes, it fluctuates / Stable, or never tested twice | **approved** (2026-10-12); the lead's D8 answer then removed the qualifier(s) low frequency loss, hearing drops during, hearing comes back |

**C. Ambient Scribe wording (generic copy, not lexicon).** These strings name no module and live in
`apps/Scribe.jsx`. They are drafted by the team and are listed here so the lead can approve or
change them too.

| # | Where | Text | Lead |
|---|---|---|---|
| C1 | the box's placeholder | "Type a patient statement or paste a chart note (H&P) — Ctrl+Enter to capture" | **approved** (2026-10-12) |
| C2 | the box's accessible name | "Patient statement or chart note" | **approved** (2026-10-12) |
| C3 | the Capture button's tooltip | "Capture (Ctrl+Enter)" | **approved** (2026-10-12) |
| C4 | the section caption | "Clarify" | **approved** (2026-10-12) |
| C5 | why a card is shown | "unclear" (trigger), "hedged", "stated both ways" (conflict), "template text" (placeholder) | **approved** (2026-10-12) |
| C6 | a question card's dismiss button | "Skip" | **approved** (2026-10-12) |
| C7 | the clarify tag on a transcript bubble | "clarify “<the words that triggered it>” · <the item's short label>" | **approved** (2026-10-12) |
| C8 | the unsaved-work warning | "text not yet captured" | **approved** (2026-10-12) |
| C9 | the section caption's text after "Clarify" (review round 1; it read " · the text names these without the detail the screen needs — ask, then record the answer; nothing is recorded until you do", wrong for hedge, conflict and placeholder cards) | " · the text leaves these open; nothing is recorded until you answer" | **approved** (2026-10-12) |
| C10 | the word joining a conflict card's two quotes | "and" | **approved** (2026-10-12) |
| C11 | the screen-reader status of the section (review round 1; not shown on screen; review round 2 counts the template notice apart) | "1 question to clarify" / "<n> questions to clarify", then ", 1 notice" / ", <n> notices" (empty with no card) | **approved** (2026-10-12) |
| C12 | the template-text notice's one control (review round 2; the notice text itself is row 274) | "Dismiss" | **approved** (2026-10-12) |

**D. Points for the lead: team design choices and known risks.** Decided 2026-10-12: the lead's
answer to each question (D1-D19) is quoted under "Clinical-lead sign-off (2026-10-12)" below; the
text here is as the lead read it. Each comes from the basis rows above or from a catalogue row of
gold set 0.4.0. The first eight came with review round 3 (the last
of them lists the lead items that round recorded), the next seven with review round 2.

- **Red flags: exactly when a flag is lowered** (review round 3; this replaces the round-1 point,
  which said the rule "never hides one the text affirms", and that was not true). With the lead's
  decision ("Don't raise, no listing"), a flag phrase in typed chart text is lowered by exactly
  these, and by nothing else:
  1. a prefix glued to the phrase ("non-pulsatile tinnitus");
  2. in the phrase's own list item, a negation cue within 14 characters, or a deny cue, before it,
     with only plain words between: no ":", no other finding, no affirm cue or plus sign, no scopeEnd
     word (rows 59-68) and no complement word (rows 69-75). Examples: "Denies pulsatile tinnitus",
     "Tinnitus is not pulsatile", "No assoc. diplopia.";
  3. a deny cue heading the list (in the clause, or a denial header on a line above), when the flag
     sits in a later item that is the bare flag phrase: no other word, no affirm cue and no plus sign
     in that item. Example: "No vision loss, diplopia, facial droop, weakness, or slurred speech.";
  4. a closing post cue right after the phrase, with only findings between and no affirm cue before
     the phrase in its item ("Pulsatile tinnitus denied.", "Diplopia: no.", "Aura (-)").

  A label answer, an uncertain reading, a section, a hedge and a placeholder never lower a flag.
  The `capture` suite's red-flag battery checks every red-flag phrase (181 phrases of 12 flags) in
  21 templates that affirm it and 17 that clearly deny it.

  Two kinds of lowering are still known, and each case below is lowered although a reader could take
  the flag as present:
  - Words after a governing denial that limit it in time are not read: "No diplopia until this
    morning.", "No diplopia before today.", "Never had diplopia before this week." and "No diplopia
    now, but had it last week." are lowered.
  - A bare later item of a denied list is read as one more negative: "No nausea, diplopia." is
    lowered.

  No other affirmed flag is known to be lowered. In the other direction the rule over-raises on
  purpose:
  - a later item with any other word: "Denies fever, chills, or unintentional weight loss." raises
    `rf_systemic`;
  - any complement word: "No change in the whooshing" raises `rf_pulsatile`.

  The lead may want to confirm the rule, or strike rows 69-75.
- **"of" is not a complement word** (review round 3, rows 69-75). "No history of malignancy.", "No
  episodes of vertigo." and "No hx of aura." stay denials. With "of" as a row, every "No history of
  <flag>" would raise its flag. Only "none of" is a row, because it presupposes what it counts ("None
  of her epistaxis episodes needed packing."). The lead may add "of" or strike any of these rows.
- **A complement word does not stop the 14-character window for a yes/no item** (review round 3).
  This keeps release 0.4.6's reach ("No hx of aura." reads no). So "No CT for tinnitus." still
  records `v_aural` no, while "No workup for pulsatile tinnitus." (beyond the window) sets it aside.
- **Later list items with other words are set aside** (review round 3). They are never "no", which
  costs some pertinent negatives:
  - "Nasal endoscopy: no septal deviation, polyps, or purulent drainage." no longer records
    `x_purulent` no (gold k027), because "drainage" follows the phrase "purulent";
  - "Denies nausea, new photophobia." records no photophobia.

  The item is asked only when a clarification trigger names it.
- **Abbreviations** (review round 3). A "." that a lower-case word follows ends nothing when the
  word before it has at most six letters (or holds a dot), the clause opens with a capital and no
  finding comes before it in the clause. So a sentence-cased note in which a new sentence starts in
  lower case after a short word, with no finding before it, is read as one clause.
- **Every denied qualifier asks** (review round 3). The engine does not know which probes are
  safety probes, so a denied qualifier resolves no entry. Examples:
  - "Rhinorrhea, not cloudy." asks the lead's rhinorrhea question;
  - "Dizziness, no vertigo." asks the rocking question.

  Asking is the safe side.
- **Signs and the plus sign** (review round 3). These are engine rules, not rows.
  - A sign with only spaces around it, between two findings, belongs to the finding after it.
  - A plus sign before a word ("+photophobia", "+ night sweats") affirms it.
  - "+/-" and "2+" are not read.
- **Lead items recorded in review round 3, not fixed** (each needs the lead's words or decision):
  - Common chart denials still read as "yes": "not associated with", "not accompanied by", the
    review-of-systems "- x", "neg for" and "X: N". The red flags they deny are raised.
  - Chart red-flag phrases match only the wording of earlier held-out cases. A fresh battery raises
    24 of 42 affirmed chart red flags, and the corpus misses `rf_progressive` (with no card) and
    `rf_asym`.
  - In chart wording a spouse, partner or child is not gated as a third party: "Wife has vertigo
    lasting hours." records the patient's vertigo duration.
  - Chart wording sets the gap-rule markers: "PMH: anxiety" or "Stress test" sets `c_dismiss`, and
    "past year" sets `c_dur` >12 mo, so the note prints a diagnostic-gap line.
  - One hedge word drops every finding in its clause. In unpunctuated dictation a single "maybe" turns
    a denial into a hedge card.
  - The `cl_otalgia` qualifier "deep" hides the card when the extraction did not capture the ear
    pain, so the ear pain is neither recorded nor asked.
  - Clarify: "steady", "clicking" and "progressive" silence the safety card even when the same clause
    states the danger in wording that has no flag phrase.
  - Rule-out clarify qualifiers silence the card when the text states the positive answer, and
    nothing captures it.

- **Spoken lines: a decision for the lead** (review round 2). Chart reading now applies only to
  typed chart text. Spoken and demo lines read exactly as in 0.4.6, so a spoken "No, I've never had
  double vision" still raises `rf_focal` (the upstream rule), and a spoken denial still reaches only
  14 characters. Should chart reading, and with it the lead's red-flag decision, apply to spoken
  lines too? The team's default is no, until the lead decides: browser speech transcripts carry no
  punctuation, so a reply opening with "no" would put every flag phrase after it under one denial.
  Related: everything typed in the box is read as chart text, including a typed patient statement.
- **Exam items: a question for the lead** (review round 2). May a normal exam answer `r_normal`
  ("Exam or imaging is normal or minimal relative to symptom burden") or `x_objective` ("Objective
  sinus inflammation on endoscopy or CT")? The default is no: nothing is captured inside an exam
  section (row 275). With r_normal as an exam item, one normal-sounding exam line ("lacrimal glands
  within normal limits") recorded it however abnormal the other exam lines were. With x_objective,
  an office rhinoscopy line ("no polyps") answered the endoscopy or CT question. An exam section
  still raises any red flag it states.
- **Chart red-flag phrases** (review round 2, rows 157-268; review round 3 added row 177). Each raises its flag on any undenied
  mention in typed text, whatever the context.
  - Some are broad by design, being the flag's own words: "eye pain", "fever", "weight loss" (also
    intended weight loss), "malignancy" (also "rule out malignancy": a hedge never lowers a flag),
    "dysphagia" and "steadily worsening" (also of hearing).
  - No phrase checks the flag's own conditions: age over 50 (`rf_gca`, `rf_new50`), one side
    (`rf_mass`: "epistaxis" alone raises it, as the shipped "nosebleed" does), or within 30 days
    (`rf_ssnhl`).
  - The lead may strike any row.
- **A safety card beside a raised flag** (review round 2). With the dangerous qualifiers removed, a
  safety card can show while its flag is already raised: "Sudden hearing loss in the right ear."
  raises `rf_ssnhl` and still asks which ear and how fast. That errs toward asking.
- **Treatment-failure cues** (review round 2, rows 14-23). They affirm what they name, so "No relief
  of nausea" records nausea yes (it persists). A denial before them ends there ("Denies nausea,
  refractory to antibiotics." records `m_nausea` no, `r_abx` yes).
- **Label answers** (review round 2, narrowed in review round 3). "Nausea: denies, photophobia" still
  reads photophobia no (the window of the lexicon's own cue "denies" reaches it), while "Aura: (-),
  nausea" reads nausea yes (the sign opens no list). Since review round 3 a cue answers a label only
  when it closes the item, and never against a denial in the label's own item ("No nausea - reports
  good appetite." reads no; "Denies photophobia: endorses." reads no). Charts that mix forms may read
  differently from the writer's intent; the lead may want examples tested.
- **The template notice** (review round 2, row 274) names "***" even when the line holds "___" or
  "[ ]". The card quotes the line itself.
- **The conflict rule** (the fixes before review). A conflict needs one finding said both ways;
  different phrases of an item that disagree record yes (n07 keeps its yes). A chart that says one
  finding both ways in different words ("Denies tinnitus. Ringing in both ears.") therefore records
  yes, not a conflict card. The rule-out items stay strict (`strictConflict`, rows 276-279): any
  mixed mentions record nothing and are asked, so a mixed chart never lowers the index.
- **A negative test reads as a denial** (open question Q2), narrowed in review round 1. The draft post
  cue `" negative"` still makes "Positional testing negative." record `v_head` no (catalogue PN3:
  one word between the finding and a cue that closes the item). It no longer reads "Dizziness with
  negative Dix-Hallpike." or "Photophobia with negative MRI brain." as a denial: the cue must close
  the mention's item right after it.
- **Mentions set aside** (review round 1). A mention that a list denial earlier in its clause does not
  reach (a scopeEnd word between, or after it in a later item: "No interpreter available, so nausea
  … were not reviewed.") is recorded neither yes nor no, and no card asks about it. The scopeEnd list
  (rows 59-68) is short: other wording can still let a denial run on. Since review round 3 a
  complement word (rows 69-75) also ends it, and a later list item that holds any other word is set
  aside too ("No nausea, tinnitus reported."), by a list denial or by the window across the
  separator; a clarification trigger set aside this way still asks.
- **Lists under a denying line** (review round 1). Under "Patient denies:", "Negative for:" or a bare
  "Denies", every bullet or deeper-indented line, and under a header every plain line of at most four
  words with no cue, is read as denied until a blank line or a header. Since review round 3 a line
  opening with "+" or holding an affirm cue ends the list, a plain line after the bullets ends it,
  plain item lines are never one wrapped line, and an item that holds more than the finding is set
  aside (a flag in it stays raised).
- **Sections** (review round 1). An exam's sub-labels keep the exam; the exam ends only at a section
  word (rows 140-156 are read normally and end it). Text after an exam under any other header (for
  example "DISPOSITION:") is read as exam text and captures nothing but the exam items. A section word as an inline label holds for its line only, so a
  medication list continued on unindented lines below "Medications: …" is read as history
  ("Augmentin" there records `r_abx` yes, as in 0.4.6).
- **A list denial reaches the plain symptom.** "Denies pulsatile tinnitus" records `v_aural` no as
  well as not raising `rf_pulsatile` (catalogue RF2).
- **Whole-word cues** (the fixes before review). "yes" no longer reads in "yesterday". A
  `clauses` cue now also needs a word end, so a plural relative no longer gates: "Sisters with
  vertigo." or "Two cousins have tinnitus." are read as the patient's ("parents" is a cue of its
  own). Plural forms would be new draft rows for the lead.
- **Pronouns in chart text** (the fixes before review, narrowed in review round 1). In typed chart
  text "her " and "his " name the patient when a finding follows them (rows 121-122): "Her tinnitus is
  bilateral." Before any other word they gate as in speech, so "Her husband has tinnitus." is not
  the patient's, and neither is "Her symptoms include tinnitus." (nothing recorded, as in 0.4.6).
  The cue "they get" still gates there: in a chart note "they" usually names the symptoms or someone
  else. Spoken lines read every cue as before.
- **Typed text never carries** (review round 1, stated). The Scribe reads typed text as chart text,
  and `extractInContext` with `opts.chart` never carries a reply into an open slot, for any module,
  with or without chart reading: "Usually for a few hours." typed after a spoken "I get dizzy."
  records no duration.
- **Exam text needs a header.** Without an exam header an exam line is read as history:
  "within normal limits" records `r_normal` yes and "light touch" records `n_allo` yes (catalogue
  PN5, EX1). A past-medical-history header is read as normal text (catalogue WR3; since review round
  1 it is a `read` header, row 145).
- **Engine limits.** A history cue after the phrase ("as a teenager") is not read (catalogue PH1). A
  duration in the clause after `;` is not the cue's (catalogue W2: `v_vertigo` stays heard).
- **Contractions.** can't, couldn't, won't, wouldn't and cannot are not negation cues: in symptom
  talk they usually affirm ("can't stand loud sounds", "won't go away"). "history of" is not a
  history cue (spec). Since review round 1 the contractions that are cues ("didn't", "doesn't",
  "isn't", "hasn't", "haven't", "don't" and rows 269-272) reach exactly as far as "n't" did in 0.3.2,
  so "I didn't have any nausea." records no again.

**E. Not landed: proposals with no row in the data.** Each would need the lead's words or approval
(the sign-off of 2026-10-12 landed none of these; its additions came from Part D):

- the vocabulary for "aural fullness" (`v_aural`; catalogue LE1, SB1), "phonophobia" (LE2),
  "imbalance" and "unsteadiness" (`v_vertigo`; MX2; in 0.3.2 the lead approved narrower forms only),
  and "mother has migraines" or "migraine(s)" for `m_fhx` (FH2, PH1, WR3, WR4). ("sudden hearing
  loss" for `rf_ssnhl`, RF3, is a draft row since review round 2: row 201);
- the held-out review's other recall and precision gaps (review round 2 left them for the lead):
  chart forms of durations, counts and frequencies ("x 3 years", ">20 lifetime episodes", "15 days
  per month"), "thick green nasal discharge" and "no purulence" for `x_purulent`, "low-frequency
  SNHL that fluctuates" for `x_lowfreq`, "sense of smell intact" for `x_anosmia`, `v_aural` from
  tinnitus not tied to the episodes, `v_head` from a headache's "bending over" (held-out H27),
  `m_head` "Occasional" from one acute headache, and "negative for numbness" writing `n_burn` no;
- a phrase that infers a flag from context: `rf_asym` from a side stated once ("SNHL left, right
  normal"), `rf_new50` from an age (the laterality card now asks in held-out H04, H11 and H12);
- the clarification triggers of the inventory left out: CL-07 (the episode duration, already a
  heard card), CL-08 (headache frequency: an unhedged headache records its fallback, Occasional,
  and no card asks, RF5; a hedged one is asked through the hedge card), CL-09 (headache attack duration), CL-11 (an aural symptom tied to the episodes), CL-14 (antibiotic
  courses), CL-15 (sinus procedure outcome), CL-16 (a vague duration; PL1), CL-17 (allergies: no
  target), a card for one-sided or new facial numbness (`rf_focal` has no probe; CL4) and a card for
  empty template sections (CL-P2).

### Clinical-lead sign-off (2026-10-12)

**The sign-off.** On 2026-10-12 the user, who is the project's clinical lead, decided every row of the
sign-off list on the sign-off page (306 rows, read from commit `cd34934`: the 280 cue rows and
switches of part A, the 14 clarification entries of part B and the 12 Scribe wording rows of part
C), answered the 19 Part D questions there, answered two follow-up questions on D8 and one on the
struck mask "aural" in chat, and wrote in chat:

> done, re-rest and upload 0.4.7

The decisions are final and are applied exactly: a struck row is gone, an approved row is as it was
(its source now `lead-approved`, its basis still the drafting record), the rows the lead approved in
the answers are added in the wording the options quoted, and nothing is worded that the lead did not
approve. `LEXICON_DELTA_033.signOff` (`app/tests/harness/lexicon-delta-033.js`) records the outcome of
every row, the struck rows with the basis they had, every answer verbatim and what was applied; the
`values` suite and the extractor check that the record is complete and applied (no plain draft left,
every struck row absent, every approved row present).

**Outcome by list.**

| List | Rows | Approved | Struck | The lead's own words or decision |
|---|---|---|---|---|
| `clauses.affirm` | 23 | 19 | 0 | 4 |
| `clauses.deny` | 14 | 10 | 0 | 4 |
| `clauses.post` | 9 | 9 | 0 | 0 |
| `clauses.prefix` | 2 | 2 | 0 | 0 |
| `clauses.breaks` | 10 | 10 | 0 | 0 |
| `clauses.scopeEnd` | 10 | 10 | 0 | 0 |
| `clauses.complement` | 7 | 7 | 0 | 0 |
| `clauses.mask` | 8 | 7 | 1 | 0 |
| `clauses.hedge` | 16 | 16 | 0 | 0 |
| `clauses.placeholder` | 4 | 4 | 0 | 0 |
| `clauses.thirdParty` | 17 | 17 | 0 | 0 |
| `clauses.chartIgnoreThirdParty` | 2 | 2 | 0 | 0 |
| `clauses.sections.exam` | 8 | 8 | 0 | 0 |
| `clauses.sections.family` | 3 | 3 | 0 | 0 |
| `clauses.sections.skip` | 6 | 6 | 0 | 0 |
| `clauses.sections.read` | 17 | 17 | 0 | 0 |
| `clauses.redFlags.rf_thunderclap` | 8 | 6 | 2 | 0 |
| `clauses.redFlags.rf_focal` | 13 | 11 | 2 | 0 |
| `clauses.redFlags.rf_vision` | 6 | 3 | 3 | 0 |
| `clauses.redFlags.rf_gca` | 6 | 3 | 3 | 0 |
| `clauses.redFlags.rf_orbital` | 11 | 4 | 7 | 0 |
| `clauses.redFlags.rf_ssnhl` | 10 | 10 | 0 | 0 |
| `clauses.redFlags.rf_asym` | 8 | 8 | 0 | 0 |
| `clauses.redFlags.rf_pulsatile` | 4 | 4 | 0 | 0 |
| `clauses.redFlags.rf_progressive` | 18 | 18 | 0 | 0 |
| `clauses.redFlags.rf_new50` | 9 | 9 | 0 | 0 |
| `clauses.redFlags.rf_mass` | 13 | 13 | 0 | 0 |
| `clauses.redFlags.rf_systemic` | 6 | 6 | 0 | 0 |
| `negation.cues (appended)` | 4 | 4 | 0 | 0 |
| `switch` | 8 | 7 | 0 | 1 |
| `clarify` | 14 | 13 | 0 | 1 |
| `apps/Scribe.jsx` | 12 | 12 | 0 | 0 |
| **All** | **306** | **278** | **18** | **10** |

The 12 Scribe wording rows (part C) were all approved; their text in `apps/Scribe.jsx` is unchanged.

**The 18 struck rows.**

| Row | Where (as listed) | Phrase | Effect |
|---|---|---|---|
| 76 | `clauses.mask[0]` | `"aural"` | "aural fullness" reads the aura phrase again: k001 states and denies aura (a conflict card), k006 and k037 record `m_aura` yes |
| 158 | `clauses.redFlags.rf_thunderclap[1]` | `"sudden onset headache"` | no flag from these words ("sudden severe headache", "sudden onset severe headache" and "maximal at onset" remain) |
| 159 | `clauses.redFlags.rf_thunderclap[2]` | `"sudden-onset headache"` | as row 158 |
| 168 | `clauses.redFlags.rf_focal[3]` | `"facial numbness"` | no flag; "numbness" alone is `n_burn` (k004: set aside in a later list item) |
| 170 | `clauses.redFlags.rf_focal[5]` | `"aphasia"` | no flag |
| 178 | `clauses.redFlags.rf_vision[0]` | `"vision loss"` | no flag (k223); "loss of vision" remains |
| 179 | `clauses.redFlags.rf_vision[1]` | `"visual loss"` | no flag; "loss of vision" remains |
| 181 | `clauses.redFlags.rf_vision[3]` | `"visual obscuration"` | no flag (k166) |
| 186 | `clauses.redFlags.rf_gca[2]` | `"jaw pain with chewing"` | no flag; "jaw claudication" remains |
| 187 | `clauses.redFlags.rf_gca[3]` | `"jaw pain when chewing"` | as row 186 |
| 188 | `clauses.redFlags.rf_gca[4]` | `"jaw pain on chewing"` | as row 186 |
| 190 | `clauses.redFlags.rf_orbital[0]` | `"periorbital swelling"` | no flag (k126, the held-out H21); "proptosis", "painful eye movement", "restricted eye movement" and "ophthalmoplegia" remain, and the module's own "swelling around my eye" |
| 191 | `clauses.redFlags.rf_orbital[1]` | `"periorbital edema"` | as row 190 |
| 192 | `clauses.redFlags.rf_orbital[2]` | `"periorbital oedema"` | as row 190 |
| 193 | `clauses.redFlags.rf_orbital[3]` | `"orbital swelling"` | as row 190 |
| 195 | `clauses.redFlags.rf_orbital[5]` | `"eye pain"` | no flag from the flag's own words "eye pain" |
| 196 | `clauses.redFlags.rf_orbital[6]` | `"pain with eye movement"` | as row 190 (k126) |
| 197 | `clauses.redFlags.rf_orbital[7]` | `"pain on eye movement"` | as row 190 (k126) |

**The mask "aural": the lead's confirmation (chat, 2026-10-12).** Asked after the strike:

> You struck the mask "aural". Without it, "aural fullness" matches the aura phrase, so your H&P would read aura as stated (or as stated both ways, since it also says "denies auras"). Keep it struck?
>
> - Restore the mask (Recommended)
> - Keep it struck

The lead's answer (verbatim): "Keep it struck".

The mask stays struck. On the lead's history and physical, "aural fullness" now reads the aura phrase
("aura" at a word start), and the note also says "denies auras": one finding said both ways is not
recorded, so `m_aura` (no until the sign-off) is left for a conflict card.

**Part D: the 19 answers.**

| Part D | Title | Question (verbatim) | The lead's answer (verbatim) | Applied |
|---|---|---|---|---|
| D1 | Red flags: exactly when a flag is lowered | Confirm the rule for lowering a red flag in typed chart text (the four conditions), or change it? | "Confirm the four conditions (recommended)" | no change: the four conditions stand for typed chart text |
| D2 | "of" is not a complement word | Should "of" be a complement word? | "Keep "of" out (recommended)" | no change |
| D3 | A complement word does not stop the 14-character window for a yes/no item | Should a complement word also stop the lexicon's 14-character window for yes/no items? | "No, keep release 0.4.6's reach (recommended)" | no change |
| D4 | Later list items with other words are set aside | Accept that a later list item holding any other word is left unrecorded (never "no")? | "Accept (recommended)" | no change |
| D5 | Abbreviations | Accept the abbreviation rule (a short or dotted token before a lower-case word ends no clause in a capitalised clause with no finding yet)? | "Accept (recommended)" | no change |
| D6 | Every denied qualifier asks | Should a denied qualifier keep every clarification card asking, or only the safety cards? | "Every card (recommended)" | no change |
| D7 | Signs and the plus sign | Accept the engine notation rules (a spaced sign belongs to the next finding; "+" before a word affirms; "+/-" not read)? | "Treat "+/-" as a hedge (a new draft row)" | applied: `"+/-"` is a `clauses.hedge` row (lead-approved); the engine reads it as any hedge (k260, k261) |
| D8 | Lead items recorded in review round 3, not fixed | For each of the eight recorded items: supply wording (new draft rows) or leave as known limits? | "Supply or approve wording for some items before upload" | applied: the follow-up questions below |
| D9 | Spoken lines: a decision for the lead | Should chart reading, and with it the red-flag decision, apply to spoken lines too? | "Yes" | applied: chart reading and the red-flag rule read spoken and demo lines too (engine "Spoken lines"); carry-over as before; the pronoun exception (D19) and clarification stay typed only; a reply word lowers no flag in speech |
| D10 | Exam items: a question for the lead | May a normal exam answer r_normal or x_objective? | "No: nothing is captured inside an exam section (recommended)" | no change (`examItems` stays empty) |
| D11 | Chart red-flag phrases | Approve the chart-register red-flag phrases (rows 157-268), or strike some? | "Approve all (recommended)" | recorded verbatim; the lead's row-by-row strikes on the sign-off page (07:16-07:24 UTC, after this answer at 06:43 UTC) are applied: 17 chart red-flag phrases struck, every other one approved |
| D12 | A safety card beside a raised flag | Accept that a safety card can show while its flag is already raised? | "Accept (recommended)" | no change |
| D13 | Treatment-failure cues | Approve the treatment-failure affirm cues (rows 14-23)? | "Approve (recommended)" | no change (rows 14-23 approved) |
| D14 | Label answers | Accept how label answers read mixed chart forms, or ask for more examples tested? | "Accept (recommended)" | no change |
| D15 | The template notice | Approve the notice text (row 274), which names "***" for every placeholder? | "Approve (recommended)" | no change (row 274 approved) |
| D16 | The conflict rule | Accept that different phrases of an item said both ways record yes, except for the strict rule-out items? | "Accept (recommended)" | no change |
| D17 | A negative test reads as a denial | Keep the post cue " negative" ("Positional testing negative." records v_head no)? | "Keep (recommended)" | no change (row 38 " negative" approved) |
| D18 | Whole-word cues | Add plural relatives ("sisters", "cousins") as draft attribution rows? | "No for 0.4.7 (recommended)" | no change |
| D19 | Pronouns in chart text | Accept that "her"/"his" name the patient only before a finding in typed chart text? | "Accept (recommended)" | no change: the pronoun exception stays with typed chart text, also under D9 |

**D8: the follow-up questions and answers (chat, 2026-10-12).** Part 1:

> D8 part 1 — which of these new-wording fixes should go into 0.4.7? (each adds draft rows you are approving here)
>
> - **More chart denials**: Add denial cues "not associated with", "not accompanied by", "neg for". (The ROS "- fever" dash form stays a known limit: a dash is usually a bullet.)
> - **Spouse/partner/child**: Add as someone else's history: wife, husband, spouse, partner, son, daughter, child, children, friend. "Wife has vertigo" stops counting as the patient's.
> - **Progressive & one-ear**: Add red-flag phrases: rf_progressive "progressively worse", "progressively worsening", "worse each week"; rf_asym "unilateral tinnitus", "left-sided hearing loss", "right-sided hearing loss", "asymmetric hearing loss".
> - **No gap markers from charts**: Typed chart text no longer sets the gap-rule context markers ("PMH: anxiety", "stress test", "past year"); the clinician sets them.

The lead's answer (verbatim): "More chart denials,Progressive & one-ear,No gap markers from charts".

Part 2:

> D8 part 2 — which of these rule fixes should go into 0.4.7? (they remove qualifiers or narrow a rule; no new clinical words)
>
> - **Hedge = nearest finding**: A hedge word (maybe, possibly…) covers only the finding next to it, not every finding in the sentence.
> - **Ear-pain card stays**: Remove "deep" from the ear-pain card's qualifiers, so ear pain that wasn't captured is still asked about.
> - **Safety cards stay**: Remove "steady", "clicking", "progressive" from the safety cards' qualifiers, so a stated danger without a flag phrase still gets asked.
> - **Rule-out cards stay**: Remove positive-answer qualifiers from the rule-out cards, so a stated positive that wasn't captured is still asked and recorded.

The lead's answer (verbatim): "Ear-pain card stays,Safety cards stay,Rule-out cards stay".

Applied as answered:
- **"More chart denials":** the deny cues "not associated with", "not accompanied by" and "neg for"
  (lead-approved; gold k262-k264). The ROS dash form "- fever" stays a known limit, as the option
  said.
- **"Progressive & one-ear":** the `rf_progressive` phrases "progressively worse", "progressively
  worsening" and "worse each week", and the `rf_asym` phrases "left-sided hearing loss",
  "right-sided hearing loss" and "asymmetric hearing loss" (lead-approved; k265-k267). The option's
  "unilateral tinnitus" was already a row (row 212, approved on the page), so it is not listed twice.
- **"No gap markers from charts":** typed chart text captures no context marker (`c_dismiss`, `c_dur`,
  `c_clin`: no capture of kind ctx); the clinician sets them. Spoken lines still capture them. This is
  an engine rule, with no word list (k268; k035 and k243 relabelled).
- **"Ear-pain card stays":** `cl_otalgia` loses its one qualifier, "deep" (k269).
- **"Safety cards stay":** `cl_tinnitus_quality` loses "clicking" and "steady", and
  `cl_hearing_onset` loses "progressive" (k271, k272).
- **"Rule-out cards stay":** every rule-out entry loses the qualifiers that state the positive (the
  rule-out "yes") answer, so a stated positive that nothing captured is still asked and recorded:
  - `cl_rhinorrhea` (`pr_purulence`, "Yes, purulent or culture-positive"): purulent, thick, green,
    yellow, cloudy, discolored, discoloured, colored, coloured, culture; clear, watery and thin stay;
  - `cl_audiogram` (`pr_audiogram`, "Yes, it fluctuates"): low-frequency, low frequency; none left;
  - `cl_smell` (`pr_smell`, "Reduced even between flares"): between episodes, between flares,
    persistent, constant, all the time; only during stays;
  - `cl_scan_report` (`pr_scan_detail`, "Real inflammation reported"): scan showed inflammation,
    opacification, mucosal thickening, polyps; none left;
  - `cl_audiogram_report` (`pr_audiogram`): low frequency loss, hearing drops during, hearing comes
    back; none left.
  (k270; k162 relabelled.)
- **Not picked, so still known limits:** "Spouse/partner/child" (a wife, husband, partner or child in
  chart wording is not gated as a third party) and "Hedge = nearest finding" (one hedge word drops
  every finding of its clause; in speech too, gold t007).

**D7 and D9: what changed in the engine.**
- **D7.** `"+/-"` is a `clauses.hedge` row (lead-approved). The engine needed no new rule: a hedge cue
  whose ends are no letters is matched unbounded, and the plus-sign rule already skips a "+" before
  "/". A clause holding "+/-" records nothing and asks (k260), and a hedge never lowers a red flag
  (k261).
- **D9.** Chart reading (clause segmentation, list-scope denial, post and prefix negation, sections,
  word-start matching, masks, hedges, the chart red-flag phrases) and the red-flag rule read spoken and
  demo lines too (`engine/extraction.js`, "Spoken lines"). Kept for speech as before: carry-over (heard
  slots, `carryRefuse`, `yieldTo`, and a heard entry's duration taken from the whole utterance, as
  release 0.4.6 chose it), the attribution cues "her" and "his" (the pronoun exception stays with typed
  chart text, D19), and no clarification (the Clarify section reads typed text only). One rule is new
  for speech, because a speech transcript has no punctuation: a deny cue that opens its clause before
  a word starting no finding, with no list separator before the next finding, answers the clinician's
  question and lowers no red flag ("no it's more of a whooshing with my heartbeat" raises
  `rf_pulsatile`). A direct denial ("No, I've never had double vision.", "no double vision") and a
  list of negatives still lower one. Typed chart text keeps D1's four conditions, so typed "no I hear
  a whooshing" still lowers it.
- In the gold sets D9 changes five spoken-register outputs (the supersede table, under "Gold set
  0.4.0") and no dialogue step; the module's demo transcript reads as before.

**Decided after the final review (2026-10-12, before the upload).** The final review of the sign-off
found two points the lead had not decided. The main session put both to the lead in chat the same
day; both answers keep what was built, so nothing in the data, the engine or the tests changed
(`signOff.followUp` records them):
- **Row 281, `cl_rhinorrhea`.** The sign-off page had listed the row as the lead's own words (for
  the lead's question), so it offered no approve or strike for the drafted triggers and qualifiers.
  Question: "Your rhinorrhea question ("is the rhinorrhea clear or purulent?") is triggered by drafted words you never approved: runny nose, rhinorrhea, rhinorrhoea, nasal discharge, nasal drainage, post-nasal drip / postnasal drip / post nasal drip, drippy nose. A mention that already says "clear", "watery" or "thin" does not ask. Approve?" Answer: **Approve all (Recommended)**. The eight drafted triggers and the qualifiers "clear",
  "watery" and "thin " are lead-approved, so the rubric's change-log note ("every trigger and
  qualifier is lead-approved") holds.
- **The reply-word rule applied with D9** (the team's rule until then). Question: "Spoken lines (your D9): a reply that opens with "no" and then names something — e.g. "no it's more of a whooshing with my heartbeat" — should it lower a red flag named later in the reply?" Answer:
  **Don't lower (Recommended)**. So a spoken reply that opens with "no" lowers no red flag named later in the reply
  ("no it's more of a whooshing with my heartbeat" raises `rf_pulsatile`); the cost the question
  named stays: "no I haven't noticed any slurred speech" also raises `rf_focal`, and the clinician
  clears it. Typed text keeps D1's four conditions.

**The lead's history and physical after the sign-off** (gold k001; `includeSuppressed` shows why a
mention is set aside):
- **Typed** (pasted into the box, as the Scribe reads it): recorded `m_photo` yes, `v_aural` yes, `x_purulent` no, `x_anosmia` no and `v_vertigo` heard (no duration in its clause); set aside `rf_pulsatile` ("not pulsatile": denied, not raised, not listed), `m_aura` (stated and denied: a conflict, since the strike of "aural"), `v_head` ("non-positional"), `n_allo` and `r_normal` (the exam section), and `m_head` (hedged); no red flag raised; eleven Clarify cards in text order: which ear (`cl_laterality`), ear pain (`cl_otalgia`), the template notice, sudden hearing drop (`cl_hearing_onset`), audiogram (`cl_audiogram`), aura stated both ways (`m_aura`, conflict, new), headache (`m_head`, hedge), tinnitus quality (`cl_tinnitus_quality`), kind of dizziness (`cl_dizziness_kind`), neck (`cl_neck`), HINTS (`cl_hints`).
- **Spoken** (the same text read as one spoken line, D9): the same captures and set-asides, except `v_vertigo` 2 ("5 min – 72 h"): a spoken line keeps release 0.4.6's band choice, which takes "minutes to hours" from elsewhere in the note; no red flag raised; no Clarify card (clarification reads typed text only); no carry-over slot opens.
- **Release 0.4.6** (lexicon 0.3.2): `rf_pulsatile` raised; `m_photo`, `m_aura`, `v_aural`, `v_head`, `n_allo`, `r_normal`, `x_purulent` and `x_anosmia` yes; `m_head` 1; `v_vertigo` 2; no card.

**The records and tests of the sign-off.**
- `lexicon-delta-033.js`: the 18 rows removed, every basis re-indexed, 257 source tags turned
  `lead-approved`, the 10 added rows with their basis, the clarification qualifiers removed, the
  `signOff` record, the header and the change-log note (dated 2026-10-12). The rubric is regenerated.
- `engine/extraction.js`: chart reading for every line under `clauses` (D9) with the reply-word rule
  for spoken lines, no context marker from typed chart text (D8), `clarifyCues` typed only;
  `engine/contract.js` and `engine/validate.js` accept the source `lead-approved`;
  `apps/RubricEditor.jsx` counts the source tags in its read-only summary lines; `apps/Scribe.jsx`
  comments only.
- Gold set 0.4.0: ten chart labels relabelled, k260-k273 added, five superseded labels; both pins
  re-taken.
- `extraction`: block 4 is now the speech-mode audit (lexicon 0.3.2 vs 0.3.3 on spoken lines under
  AD18, the dialogues' slots and carry results compared strictly, the 0.3.2 side still checked against
  the frozen 0.4.6 engine) with 15 explicit speech red-flag tests; AD18 audits spoken comparisons too
  (rules P and the new X stay typed only), with self-checks. `capture`: each fixture chart case also
  read the other way (typed or spoken), the reply-word and context-marker cases, nine spoken MASQUE
  lines with explicit expectations, the round-2 and round-3 texts' spoken readings audited under
  AD18, the H&P's eleven cards. `values`: the sign-off record, complete and applied, and its
  mutations refused. `render-scribe`: the H&P's eleven cards, `m_aura` not recorded.

### Release 0.4.7

`APP_VERSION` (`app/src/engine/policy.js`) and the test harness's `NEW_RELEASE` move together to
0.4.7, with the AD4 text. 0.4.6 is the deployed release, and every printed export carries the
release, so the two must not print the same number.

**Lineage.** `lexiconHash` changes. A derivation saved on 0.4.6 therefore no longer verifies against
the built-in module: lineage reports the root record's `lexiconVersion` and `lexiconHash`, and a
`goldSet` mismatch is V53 when the root is supplied. This is inherent to any built-in lexicon
update; re-derive edits made before 0.4.7 from the current built-in module. `instrumentHash` and
`scoringHash` are unchanged, so calibration still applies. A 0.4.6 download-all zip holding the
built-in rubric no longer matches it byte for byte, so its rubric is offered as "Load as derived".
Neither was tested separately in this release.

**Rubric Editor.** It has no control for `clauses` or `clarify`. They are not editable and are kept
byte for byte in every derived lexicon (the `editor` suite checks this). Since the fixes before
review each has a lock row and a read-only summary line in the lexicon section, as `carryRefuse` and
`normalize` have. Since review round 1 the lock reason and the summary line say the rows are lexicon
configuration, each tagged with its source, never "approved"; since the sign-off the tags are lead,
lead-approved, module or draft, and the summary line counts each tag.

### Verification (2026-10-12, after the records fixes)

The final review of the sign-off found records that still said the 0.4.7 rows await the lead's
sign-off (the version-axes paragraph at the top of this file, the `APP_VERSION` comment in
`policy.js`, the comment over the entry box and Clarify wording in `Scribe.jsx`, and the
`changelog[14]` row of `SOURCES.md`), a README sentence that kept "+/-" to typed text (since D9 the
hedge row is read in every line), and statements in this entry that D9 superseded (r02, the scope
of chart reading). They are corrected. The two points the lead had not decided were then decided
in chat ("Decided after the final review", above). No data, engine rule, gold label or
user-facing text changed: `policy.js` and `Scribe.jsx` change in comments only, and the rubric is
not regenerated. Regression tests: `values` checks that, while the sign-off is recorded, the
deployed records and source comments hold none of those statements and the README does not keep
"+/-" to typed text (each detector first catches the statement as it shipped); `capture` reads
"+/-" in two spoken lines with explicit expectations (11 spoken MASQUE lines in all).

Run of 12 October 2026 on branch `claude/release-0.4.7`, after these records, in the in-app browser:

- `extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `b2943f8ac3dd6c045220bb8da43448571391a4a4c221fcbedd30c7dd2ba13819`, 167 checks passed, 180,587
  bytes (unchanged).
- The full suite at `?seed=1296126801`: **23/23 PASS, 0 fail, 0 invalid**, 1,596,236 checks
  (1,596,196 after the sign-off): values 3,886 → 3,918 and capture 293,863 → 293,871; every other
  suite has the same count. Gold set 0.4.0 and its pins (`99dff3ac…`, `EXPECTED_BENCHMARK_040`) are
  unchanged.
- The lead's history and physical reads as recorded under "Clinical-lead sign-off (2026-10-12)":
  typed, `m_photo` yes, `v_aural` yes, `x_purulent` no, `x_anosmia` no and `v_vertigo` heard, with
  `rf_pulsatile`, `m_aura`, `v_head`, `n_allo` and `r_normal` set aside, no red flag and eleven Clarify
  cards; spoken, the same captures and set-asides with `v_vertigo` 2, no red flag and no card.

### Verification (2026-10-12, after the clinical lead's sign-off)

Run of 12 October 2026 on branch `claude/release-0.4.7`, after the sign-off and these records, in the
headless Edge browser (the in-app browser could not open a tab).

- `extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `b2943f8ac3dd6c045220bb8da43448571391a4a4c221fcbedd30c7dd2ba13819`, 167 checks passed (ten for the 0.3.3 delta: the tenth is the sign-off
  record), 180,587 bytes (after review round 3: `5e899364…`, 166 checks, 177,796 bytes).
  `scoringHash` (`32cc4f44…`) and `instrumentHash` are unchanged.
- The full suite at `?seed=1296126801`: **23/23 PASS, 0 fail, 0 invalid**, 1,596,196 checks (1,575,855 after review
  round 3). The suites whose count moved: values 3,928 → 3,886 (the sign-off record's checks added; the provenance leaves of the struck rows and removed qualifiers gone), extraction 311,445 → 331,727, capture 293,763 → 293,863 and render-scribe 404 → 405; every other suite has the same count.
- `extraction` block 4 (the speech-mode audit): 591 named texts × 7 option sets, and 2,263 cue texts and 5,000 synthetic utterances × 2: 18,663 comparisons of the frozen 0.4.6 engine and this one on lexicon 0.3.2, all identical, and 18,663 of lexicon 0.3.2 vs 0.3.3 as spoken lines under AD18 (16,346 differ raw, all explained); 95 dialogues, 220 `extractInContext` steps: identical to release 0.4.6 on lexicon 0.3.2, the 0.3.3 captures audited (126 steps differ, all explained), the slot and carry results identical; 15 explicit speech red-flag texts through `extract` and `extractInContext`, all as expected.
- `extraction` block 3: 125,663 comparisons of lexicon 0.3.2 vs 0.3.3 (120,591 without `opts.chart`, read as spoken lines since D9); 98,220 differ raw and AD18 explains all of them; of the first 4,000 with captures, 1,742 keep a capture compared strictly; 35 AD18 self-checks. Blocks 1 (35,364 strict comparisons on lexicon 0.3.1) and 2 (132,039 comparisons of 0.3.1 vs 0.3.2 under AD13) are unchanged.
- `capture` block 5: gold set 0.4.0 on lexicon 0.3.3: 535 cases (273 chart) and 93 dialogues; tp 470, fp 0, fn 0; 5 superseded labels, and exactly those 5 cases (no dialogue step) change against lexicon 0.3.2; catalogue agreement 32 of 50. The 68 round-3 and 40 round-2 chart texts pass, each spoken reading audited under AD18; the 9 spoken MASQUE lines pass; the red-flag battery: 170 phrases of 12 flags × 21 affirming and 17 denying templates (6,460 texts), every affirmed flag raised and no clearly denied one. `GOLD_0_4_0_SHA256` (`99dff3ac…`) and `EXPECTED_BENCHMARK_040` were re-taken from this run; `GOLD_0_3_0_SHA256` (`729492ef…`) and `EXPECTED_BENCHMARK` are unchanged.
- The built-in module validates with 0 errors and the one V12 warning it had before.

### Verification (2026-10-11)

After review round 3 and these records (before the sign-off):

- `extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `5e8993646a577ba5da95b88671e2ee6490af5a5c511368de4e029227eb95a2b5`, 166 checks passed (nine for
  the 0.3.3 delta), 177,796 bytes. Earlier hashes:

  | Build | SHA-256 | Bytes |
  |---|---|---|
  | after review round 2 | `27dbda77…` | 175,785 |
  | after review round 1 | `2db1e0ec…` | 160,506 |
  | after the fixes before review | `6ebfe3f0…` | 156,482 |
  | first 0.4.7 build | `dfa669b0…` | 155,468 |
  | release 0.4.6 (157 checks) | `173f28b9…` | 138,226 |

  `scoringHash` (`32cc4f44…`) and `instrumentHash` are unchanged.
- The full suite at `?seed=1296126801`: **23/23 PASS**, 0 fail, 0 invalid, 1,575,855 checks. Earlier
  totals were 1,570,551 after review round 2, 1,547,839 after review round 1, 1,541,059 after the
  fixes before review, 1,530,336 in the first 0.4.7 build and 1,407,588 in release 0.4.6. The suites
  whose count moved in review round 3:

  | Suite | Checks | After review round 2 |
  |---|---|---|
  | extraction | 311,445 | 307,323 |
  | capture | 293,763 | 292,623 |
  | values | 3,928 | 3,889 |
  | validate | 471 | 469 |
  | render-scribe | 404 | 403 |

  Every other suite has the same count (editor 301, static 1,040, golden 412).
- `extraction`:
  - **Block 4:** the frozen 0.4.6 engine on lexicon 0.3.2 against this engine on lexicon 0.3.3
    without `opts.chart`. All 18,342 extract comparisons and 220 `extractInContext` steps (95
    dialogues) are identical.
  - **Block 3:** 124,860 comparisons of lexicon 0.3.2 vs 0.3.3. The 119,934 without `opts.chart`
    are all identical. The 4,716 that differ raw are typed chart text, and AD18 explains all of
    them. Of the first 4,000 with captures, 1,766 keep a capture that no AD18 rule touches, compared
    strictly. 29 AD18 self-checks.
  - **Blocks 1 and 2:** block 1 (35,364 strict comparisons on lexicon 0.3.1) and block 2 (132,039
    comparisons of 0.3.1 vs 0.3.2 under AD13) are unchanged.
- `capture` block 5:
  - Gold set 0.4.0 on lexicon 0.3.3: 521 cases (259 chart) and 93 dialogues; tp 466, fp 0, fn 0.
  - No label is superseded, and no output changes against lexicon 0.3.2. The catalogue agrees on 32
    of 50 rows.
  - 68 round-3 and 40 round-2 chart texts with explicit expectations pass, and each reads as
    lexicon 0.3.2 when spoken.
  - The red-flag battery: 181 phrases of 12 flags, 6,878 texts; every affirmed flag is raised and no
    clearly denied flag is.
- The built-in module validates with 0 errors and the one V12 warning it had before.
- The app page (`app/tests/dev/scribe.html`): typed the review's sentences through the real box; the
  console stayed clean.
- The lead's history and physical, and the held-out corpus, are given under "Review round 3" above.
- The files, the deploy list and the AD rows: `docs/refactor/02-app-divergences.md` ("screenAIr
  0.4.7"). The design: `docs/refactor/06-chart-capture.md` (§13 for review round 3).

## 2026-10-12: release 0.4.8, the clinical lead's three fixes and two follow-up requests

Release screenAIr 0.4.8 (0.4.7 → 0.4.8) makes the three fixes the clinical lead asked for on
12 October 2026 and, in a follow-up the same day, the lead's plan line for the EMR Friendly Template
and the Ambient Scribe's Question review (below). Instrument 0.2, lexicon 0.3.3, probe set 1.0.0 and
gold set 0.4.0 are unchanged, and `masque.logic.js` is not touched (`logicSha256` unchanged). In the
rubric only one item's clinician question (`ask`), the EMR template's new plan line
(`emrTemplate.planAdvice`) and the change log change: `instrumentHash` (`b06dfaad…`), `scoringHash`
(`32cc4f44…`, so the illustrative calibration still applies) and `lexiconHash` (`90edcfd5…`) do not
move, because `ask` and `emrTemplate` are outside their projections; `contentHash` (`523df8a1…`) and
the rubric's bytes change. Derivations saved on 0.4.7 still verify against the built-in module (a changed built-in
rubric alone is reported, not refused). Everything else is engine, app and shell code, the
module's media and its registry entry.

### The requests (verbatim, 2026-10-12, chat)

The user, who is the project's clinical lead, wrote:

> Fix 1: For the Spanish patient companion, the print out in the end should print findings in both spanish and English so an English speaking clinician can analyze it as well.
>
> Fix 2: Question: recalcitrance
> How long has this been going on?
> Is a yes/no, if phrasing it as such it should ask "Have symptoms persisted over 3 months despite trials of medical management?"
>
> Fix 3: Add the attached video above the patient companion instructions, make it a collapsible/hideable iframe. Feel free to compress it if needed.

The same message also asked for a methodology brief (a Word document on how the data-set results
were obtained); that is not part of this release and changes nothing here.

### Fix 2: the clinician question of item `r_dur`

"Question: recalcitrance" is the Ambient Scribe's Ask-next card of item `r_dur`: its tag is the
domain label lowercased ("recalcitrance"), its question the item's `ask`, and its answers the
boolean item's Yes / No. The question asked for a duration while the answers are Yes / No; it is now
the lead's sentence, stored and shown exactly as written.

The rubric's change-log entry, verbatim:

- **question** (`/domains/0/items/0/ask`): Clinician question of item r_dur, recorded in release 0.4.8 from the clinical lead's request in chat of 2026-10-12 ("Fix 2: Question: recalcitrance / How long has this been going on? / Is a yes/no, if phrasing it as such it should ask "Have symptoms persisted over 3 months despite trials of medical management?""): the item's ask "How long has this been going on?" becomes the lead's sentence, verbatim, "Have symptoms persisted over 3 months despite trials of medical management?". Its answers stay Yes / No. The item's statement, weight, short label and patient wording, and the patient context question c_dur, are unchanged; ask is outside instrumentHash and scoringHash, so instrument 0.2 and the calibration stand; contentHash changes. Lexicon 0.3.3, probe set 1.0.0 and gold set 0.4.0 unchanged.

- **How it lands.** Through a delta, like the earlier clinical-lead changes:
  `app/tests/harness/question-delta-048.js` (the request verbatim, the one changed row
  `{path: "/domains/0/items/0/ask", item: "r_dur", from, to}`, its basis and the change-log entry),
  applied last by `extract-rubric.js` with `applyQuestionDelta` and proven by `revertQuestionDelta`
  (`app/tests/harness/diff.js`). The extractor's six new checks (173 in all) and the `values` suite
  pin it (`SOURCES.md`, "Clinician question for item r_dur (release 0.4.8)").
- **Where the question is shown.** Wherever an item's clinician question is shown: the Scribe's
  Ask-next card and heard card (`scribe.js` `itemSuggestion`: `ask = item.ask ?? item.text`), a
  Clarify item card that names the item (no clarify entry names `r_dur`), the Rubric Editor's
  `ask` field and the rubric in every download. The Clinician Screener's item card shows the item's
  statement (`text`, "Symptoms have persisted or recurred for more than 3 months"), never `ask`, so
  it is unchanged; the FHIR Questionnaire, the bundle, the CDS documents and the EMR template do not
  print `ask`. No locale carries an item `ask` for `r_dur` and the clinician surfaces are English, so
  there is no Spanish counterpart. The patient context question `c_dur` also reads "How long has
  this been going on?", but it offers three durations (not Yes / No) and is untouched.
- **Instrument identity.** `engine/hash.js` projects an item as `id, w, text, ref, scale` for
  `instrumentHash` and `id, w, scale` for `scoringHash`; `ask` is in `contentHash` only. So the
  instrument is the same published instrument (design 03 D8: version and `instrumentHash` determine
  each other; Q11: copy edits keep the version), instrument 0.2 stays, and no decision is needed.
- **For the lead.** The new question is narrower than the scored statement it asks about: the
  statement reads "persisted or recurred for more than 3 months", the question "persisted over 3
  months despite trials of medical management". A patient whose symptoms recur, or who has not tried
  medical management, may now be answered No where the statement would read Yes (the separate item
  `r_abx` asks about failed antibiotic or steroid courses). If the statement itself should change to
  match, that is an instrument change: `instrumentHash` moves and the lead must name a new instrument
  version (D8), with the calibration then no longer applying.
- **Tests.** `values` (the ASK pin reads the reverted rubric; the record, the item, refusals, the
  change-log position, the sweep exemption), `rules` (rankSuggestions under the new allowed
  difference AD19, expected on 1,722 of 1,722 suggestion lists that hold `r_dur`; AD19 self-checks),
  `render-scribe` (`r_dur`'s Ask-next card reads the lead's sentence under "recalcitrance" with Yes /
  No, and the old question is printed nowhere).

### Fix 3: the introduction video above the instructions

**The video.** The lead's file, as supplied: an MP4 of 60.04 s, 1280 × 720 H.264 with AAC audio,
14,783,849 bytes, SHA-256 `3ce9088b6c26bcb4d3c370c8d20f0269d8d7a973d8f4be3ab2d745eb89800a28`, the
index (moov) at the front, so it streams. It is not re-encoded (no encoder here, and none was
needed: it loads only when the viewer presses play). Viewed frame by frame before it was added (0,
5, 10, 15, 20, 23, 26, 30, 35, 40, 45, 50, 55 and 59 s): a hand-drawn, grey-pencil animated
explainer with English captions burned in (the audio was not listened to). A woman holds her face by
a rainy window with tablets and a nasal spray ("Ever get sinus headaches", "No antibiotic",
"makes it go away?"); a dizzy man at home and a clinician with pill bottles; a crowd in which many
figures turn red ("Surprisingly, up to eighty", "percent with sinus headaches", "dizziness actually
have migraine,"); a head-and-brain diagram with a sinus picture and a pill chart; a body diagram with
nerve paths and crossed-out tablets ("how do you know?"); a bandaged man with germ and brain icons
("Maybe ear or sinus", "Even mild allergies or"); a timeline of calendars from 2014 to 2025 ("On
average, people wait", "to spotlight it, bringing", "relief sooner, without surgery."), ending with
the woman relieved. Its people are drawings; it shows no patient identifier, no score, band or
probability and no research capture, so it does not conflict with the Patient Companion's rules.
It does carry population claims of its own ("up to eighty percent", an average wait): they are the
lead's content, shown as supplied and not checked by the team (below).

**Where it lives.** It is the built-in module's own media, not engine content:
`app/modules/masque/media/` holds the MP4, a poster (`patient-companion-intro-poster.jpg`, the frame
at 0.5 s, 1280 × 720 JPEG, 78,113 bytes, SHA-256 `d3c0a2c2…`) and the frame page
`patient-companion-intro.html` (no script, `noindex, nofollow`, the English prototype marker as a
corner badge, one `<video controls preload="none" playsinline>` with the poster and the MP4, no
autoplay, no loop). `modules/registry.json` names it on the built-in's entry
(`"patientVideo": "./modules/masque/media/patient-companion-intro.html"`); `shell/registry.js`
(`patientVideoPath`) keeps only an `.html` page under `./modules/<folder>/`. The shell's Patient tab,
patient mode and `patient.html` pass it to the companion; an uploaded or derived module never
carries one, so a module about something else never shows this video. `.htaccess` declares
`video/mp4`.

**The panel.** On the Patient Companion's first step, right above the instructions card ("Before
your appointment"): a button and, while shown, a 16:9 frame of the page. Shown by default; "Hide the
video" collapses it (the frame is removed, so a playing video stops), "Watch a 1-minute introduction"
shows it again. The button carries `aria-expanded` and `aria-controls`; the frame is titled
"Introduction video"; the video's own controls are the browser's (keyboard accessible, full screen
allowed). The frame is sandboxed without scripts (`sandbox="allow-same-origin"`, as the clinician
apps' EMR template frame; the in-app browser refuses a frame with an opaque origin). Nothing plays
or downloads until the viewer presses play; there is no animation, so reduced motion has nothing to
stop. The collapsed state is remembered for the browser tab only (`sessionStorage`, inside
try/catch; design D20 keeps `localStorage` for modules and drafts). It is `noprint` and hidden by the
print stylesheet, never in the `.txt` or `.html`. At 375 px it fills the width with no horizontal
scroll. In Spanish the button reads "Ver una introducción de 1 minuto (video en inglés)" / "Ocultar
el video" and the frame "Video de introducción (en inglés)": the captions are English.

**Tests.** `render-patient` (the panel above the instructions on the first step only, en and es; the
button, the frame and its sandbox and title; hide, remembered across a remount, show; the es DOM
scan; no panel without a video; the print rule; the frame page; the MP4 and the poster served by
size), `omissions` (the panel on the Patient tab, in patient mode by Hand to patient and by address,
and on `patient.html` for the built-in, never for the upload or the derivation; never in an export),
`upload` (the registry entry; `patientVideoPath` accepts and refuses), `values` (the chrome keys).

### Fix 1: the findings in English in a Spanish printout

When the companion runs in Spanish, the summary keeps its Spanish findings and adds, after them, an
**English version of the same findings**, titled "Versión en inglés, para un médico de habla
inglesa" and "English version, for an English-speaking clinician". Its content is the English
summary of the same answers, context and flags, exactly as the English companion shows it: the
flags with what to say, the opening line, what the patient wants to describe and to ask, the
not-sure questions and "For my clinician" with its lede and the items' English clinician lines
(`patientClin`, with the English option label). Right under its title it repeats, in English, the
caveat lines English mode prints for the same questionnaire: for an uploaded or locally changed
questionnaire the provenance line ("This questionnaire was loaded from a file and has not been
reviewed." / "This version of the questionnaire was changed locally and has not been reviewed."),
and when the English wording itself was edited locally, "Wording in this language was edited
locally and has not been reviewed."; the built-in module has none. It is on the screen (a section
tagged `lang="en"` after the Spanish clinician block), in the printed page, in the `.txt` (between
rules, before the Spanish footer, its headings upper-cased) and in the `.html` (one
`<section lang="en">` before the disclaimer). In print its title is kept whole and on the same page
as the block under it. No score, band, probability or research capture is added, and English output
(the `.txt`, the `.html` and the screen) is unchanged byte for byte from release 0.4.7 apart from
the release number and the date.

- **Engine.** `buildPatientSummary` attaches `english` (the English summary) to a non-English
  summary; if the English summary is withheld, so is the Spanish one (its error is returned), so no
  bilingual summary is handed over without its English part. `summaryText` and `summaryHtml` render
  it; the findings of both languages come from one function each (`summaryTextBody`,
  `summaryHtmlBody`), and on screen from one component (`SummaryBody`). The English caveat lines are
  `englishVersionNotices` (exactly what English output prints for the view; the strings already in
  `policy.js` `CAVEATS`, no new wording); the English version's styles (`ENVER_CSS`) are added to an
  `.html` only when it holds that section, so an English `.html` keeps release 0.4.7's stylesheet.
- **Parity.** The baseline's Spanish output had no English lines, so a new allowed difference,
  **AD20**, excuses exactly the English version: in a `.txt` the block `ad20Block` builds (the two
  titles and the English findings, `ad20EnglishBody` of the English `.txt` of the same answers)
  right before the footer rule; on screen the section's text right before the disclaimer. It applies
  only where the comparison's locale is Spanish, never in English; it is listed right after AD4, so
  AD14, AD10 and AD16 then see the Spanish output as before. Its `.txt` block includes the English
  caveat lines (`ad20EnglishNotices` of the English `.txt`) and a blank line after them when the view
  has any; the built-in module, which the parity suites compare, has none. The English part is checked on its own
  against the baseline's English summary and `.txt` of the same answers (`patient`, 10,160 Spanish
  summaries), against the English export of the same screen (`golden`), and on screen against the
  English findings rendered by the companion's own `SummaryBody` (`render-patient`, innerHTML
  equal).
- **Tests.** `patient` (the twin, AD20 expected on every es export, a full bilingual export checked
  line by line and block by block, withheld together, AD20 self-checks; the English caveat lines on
  four views; the `.html` stylesheets), `golden`, `render-patient` (the section, AD20 on every es
  summary, the clinician lines' tags, the scans; the English caveat lines against English mode's for
  the upload and the derivation; the print rules), `omissions` (the section's tags in the `.html`;
  the English caveat lines inside it and the Spanish ones outside it; the es DOM scans allow the
  section's own `lang="en"`).

### Final review (2026-10-12): four findings, fixed

A final review of the release found four minor defects, each fixed at its cause with a regression
test that fails on the unfixed code:

1. **The English version's title could end a printed page alone** (screen print and the `.html`).
   Nothing kept the title with the block under it (and keeping it there alone, with `break-after`,
   let its two lines, Spanish and English, part across pages). Now the title carries the section's
   dashed rule and, in print, is kept whole
   and with the block under it (`break-inside: avoid; break-after: avoid`); in the companion the
   English version's urgent box is kept whole too (the `.html` already did). Checked through the CSSOM
   (`patient`, `render-patient`) and by printing the review's four reproductions (seeds 56433, 88109,
   103947, 111866 of its driver) to PDF in headless Edge: the whole title now opens the next page with
   the English findings.
2. **The English version left out the English caveats** for an uploaded or locally changed
   questionnaire: they were printed in Spanish only, so an English-speaking clinician reading the
   English part was not told, in English, that the questionnaire was uploaded or changed and
   unreviewed, or that its English wording had been edited. It now repeats the lines English output
   prints for the same view (above). Tests: `patient` (built-in, upload, derivation with an edited
   English, derivation of an upload with an edited English and a stale Spanish; `.txt` and `.html`),
   `render-patient`, `omissions`, AD20 self-checks.
3. **The English `.html` had gained four unused CSS rules** while the records said English output was
   unchanged byte for byte. The rules are now added only where the section is; the `patient` suite
   pins the English stylesheet to release 0.4.7's (SHA-256 `74440b2f…`).
4. **The records quoted a `contentHash` the rubric never had** (`58745f31…`; it was then `7674bf7d…`). The
   extractor had reported the hashes of the rubric before its calibration's `scoringHash` was stored
   (`contentHash` covers it); it now reports the written rubric's hashes and shows `contentHash` and
   `lexiconHash` too, and the `values` suite checks every hash this entry quotes against the shipped
   rubric. The rubric itself is unchanged (Identical, `57a8445d…`).

### Follow-up (2026-10-12): the lead's two new requests

After the three fixes the clinical lead wrote (verbatim, 2026-10-12, chat):

> The ambient scribe feature should also have a Question Review section (to the right of "Ask Next") where a clinician can double check all responses and modify them if needed to adjust the screener/produced note.
>
> Also recommendations in the plan should also add "recommend a trial of migraine abortives if not contra-indicated due to other conditions." so that a primary doctor can offer this as an option to the patient for relief in the interim.

and answered two questions (verbatim, 2026-10-12, AskUserQuestion; the label of the option chosen,
then its description as shown):

- "When should the plan print "recommend a trial of migraine abortives if not contra-indicated due
  to other conditions."?" — **"With the treatment refs, no red flag (Recommended)"**: "In the EMR
  note's plan, beside the empiric-treatment references, whenever they print and no red flag is open
  (screen points to a migrainous driver)."
- "Which outputs should carry it?" — **"EMR template note (Recommended)"**: "The EMR Friendly
  Template plan, on both the Screener and the Scribe." (So not the Scribe's encounter note and not
  the Screener's result cards.)

#### The plan line (EMR Friendly Template)

The EMR template's plan now prints the lead's sentence, verbatim (lower-case first word, final full
stop, never re-cased), as a plan line right after the empiric-treatment reference lines and before
the "treatment offered today" placeholders:

```
Empiric treatment references (for use before specialist review):
- Migraine prevention guideline — AAN/AHS (endorsed by AAFP), 2026: …
- …
- recommend a trial of migraine abortives if not contra-indicated due to other conditions.
Acute (abortive) treatment offered today: [agent, dose - or not offered, reason]
```

It prints wherever those references print with no red flag open: the referral gate open (decision
D4), on the Screener and the Scribe, for every phenotype (the references without `showFor` print for
all three). It never prints under an open red flag, not even in the screen-based block under the
heading "Screen-based referral and references (the FHIR bundle withholds the referral while a red
flag is open):", which keeps the references (release 0.4.6); nor at the lowest band, on an
unscorable screen, before the Scribe's red-flag review is recorded or after a module rule error
(where the references do not print either); nor in the Scribe's encounter note, the FHIR bundle or
the Screener's result cards.

The rubric's change-log entry, verbatim:

- **emr-plan** (`/emrTemplate/planAdvice`): Plan advice of the EMR Friendly Template, recorded in release 0.4.8 from the clinical lead's request in chat of 2026-10-12 ("Also recommendations in the plan should also add "recommend a trial of migraine abortives if not contra-indicated due to other conditions." so that a primary doctor can offer this as an option to the patient for relief in the interim.") and the lead's answers of the same day (when: "With the treatment refs, no red flag (Recommended)"; outputs: "EMR template note (Recommended)"): emrTemplate.planAdvice holds the lead's sentence, verbatim, "recommend a trial of migraine abortives if not contra-indicated due to other conditions.", with its source and date. The EMR template's plan prints it right after the empiric-treatment reference lines, before the treatment-offered placeholders, only where those references print and no red flag is open; never under an open red flag's screen-based block, and never in the encounter note, the FHIR bundle or the Screener's result cards. The signed-off emrTemplate block of release 0.4.3 and the 0.4.6 additions are unchanged. Recorded in tests/harness/emr-plan-delta-048.js. Instrument 0.2, lexicon 0.3.3, probe set 1.0.0 and gold set 0.4.0 are unchanged; only contentHash changes.

- **Data, not engine copy.** The sentence is module data, `emrTemplate.planAdvice`
  (`[{text, source: "lead", decided: "2026-10-12"}]`); `engine/emr.js` prints each line's `text`
  ("- " and the text) on the no-flag path only and names no condition. `source` and `decided` are
  the line's record and are not printed. A module without the key prints no line.
- **How it lands.** Through a delta, like the earlier clinical-lead changes:
  `app/tests/harness/emr-plan-delta-048.js` (the request and the two answers verbatim, the one added
  row, its basis and the change-log entry), applied last by `extract-rubric.js` with the 0.4.6
  answers' `applyEmrDecisionsDelta` and proven by `revertEmrDecisionsDelta`. The extractor's eight
  new checks (181 in all) and the `values` suite pin it (`SOURCES.md`, "Plan line of the EMR
  template (release 0.4.8, follow-up)"). The signed-off `emrTemplate` block of release 0.4.3 still
  hashes `fb63a2b9…` under every delta, and the block of release 0.4.6 `0152cfd8…` under this one;
  the shipped block now hashes `5f740853…`.
- **Validator.** V61 knows the key: a list of `{text, source, decided}`, `text` a non-empty string
  without `[ ] { }`, `source` a non-empty string and `decided` a real YYYY-MM-DD date (errors); any
  other field is never read (warning). Seven new mutation generators.
- **Tests.** `emr` (line-exact placement for every phenotype and the Scribe's derived picture on
  both surfaces; absent under each red flag alone with each Scribe capture source, both tiers, a
  probe-raised flag and an unrecorded review, where the references still print; absent at the
  lowest band, unscorable, unreviewed and after routing and derive rule errors; absent from the
  bundle and the encounter note; no app or other engine file reads the key; a module without the
  key prints the same template minus the line; V61; and the oracle expects the line from the data in
  every state of the matrix, the red flags and the fuzz), `values` (record, line, hashes, change-log
  position, sweep exemption), `validate` (the generators).

#### Question review (Ambient Scribe)

The Ambient Scribe's view switch gains a **Question review** tab right of Ask next: Safety, Ask next,
Question review, Note, FHIR (the lead's placement, "to the right of "Ask Next""). The view switch is
now a tab list (`role="tablist"`, each view a `tab` with `aria-selected` and `aria-controls`, one
`tabpanel`; only the selected tab is in the tab order, and the arrow keys, Home and End move between
tabs and select them). The default view is unchanged (Safety, the red-flag review first, as since the
baseline); Question review never opens by itself.

- **What it lists.** Every scored item of the module, once, by domain (the domain order, each domain
  headed by its label), with the item's clinician question and short label as Ask next shows them
  (for `r_dur`, the lead's question of Fix 2), its current answer and where this encounter recorded
  it. An absent answer (or "unsure") reads **"not answered"**, never no; an unanswered item skipped in
  Ask next adds "skipped in Ask next", also when a review edit is on record (review fix, below).
  Context items, information prompts and red flags are not listed (the Safety tab
  holds the flags). New engine helper: `questionReview` (`engine/scribe.js`), with the source names
  `REVIEW_SOURCE`.
- **Sources.** heard in encounter (a spoken line: the microphone or the demo transcript), typed chart
  text, probe (an Ask next probe option that wrote the item), Clarify card, Ask next (a suggestion or
  a heard card), question review edit. The Scribe keeps the record for the session only (display
  only: no score, note, bundle or export reads it).
- **Editing.** Each row offers the item's own answers (its scale labels, or Yes / No) and **Clear
  answer**. An answer goes through the same path as an Ask next card, so the score, the coverage, the
  suggestions, the probes, the Clarify cards, the encounter note, the FHIR bundle and the EMR
  template follow at once; choosing the current answer changes nothing. Clearing deletes the answer
  (and its skip, so Ask next can ask it again): the item is unanswered, back in the attainable
  range, never a no. A row whose current answer came from the review carries an **edited** chip and,
  when there was an answer before, "First recorded: <answer> · <source>". The notes keep their
  format (they do not mark edits). Changing or clearing an answer that a probe wrote retracts that
  probe's answer (review fix, below): its note leaves the encounter note's supporting features and
  the EMR template's probe notes, its probe-keyed EMR checklist entry leaves, the history and
  review-of-systems rows lose their "recorded by clinician via probe" label, and the probe can be
  asked again while it is live; the row keeps "First recorded: <answer> · probe".
- **Reset and unsaved work.** Reset clears the record; the module switch's unsaved-work summary
  counts the answers as before, and a review edit that cleared the only answer still counts as a
  screen in progress.
- **Chrome.** English, generic, no module id: the tab label "Question review", the line "Every
  scored item, with its current answer and where it came from. Change or clear an answer here: the
  score, coverage, suggestions, encounter note and EMR template follow. Not answered is never a
  no.", "not answered", "skipped in Ask next", "Clear answer", "edited", "First recorded:", the
  tab list's name "Encounter views", and the source names above. The Patient Companion is untouched
  (it still shows no score, band, probability or research capture).
- **Parity.** The baseline Scribe has no such tab, so a new allowed difference, **AD21**, excuses
  exactly its text in the right card's Safety, Ask-next and Note views: the tab's own text, once,
  right after the Ask next tab's text and right before the Note tab's. The review view itself is
  never part of a parity comparison.
- **Tests.** `render-scribe` (the tab list, its order, roles and keys, the default view; every scored
  item once by domain, each row a group named by its question; a fresh Scribe all "not answered";
  the demo's answers with "heard in encounter"; an edit moving the published answers, the readout,
  the encounter note and the EMR template (equal to `buildEmrTemplate` of the edited answers), with
  the edited chip and what was first recorded; a clear returning the item to unanswered with
  coverage down; a typed chart answer corrected the same way; the Ask next, skip, probe and Clarify
  sources; no Ask next card inside the review; the dirty summary; Reset; AD21 self-checks and AD21
  expected at every compared snapshot; after the review fixes, also: the cleared item shown again in
  Ask next, a skip after a review clear, and a probe-written item changed and cleared), `shape` (the
  fixture's review: every item once, each answered row from Ask next), `capture` (after the review
  fixes: `retractProbeAnswers` and `probeNoteList`), the foundations export list.

#### Review of the follow-up (2026-10-12): eight findings, fixed

A review of the follow-up found one major and seven minor defects. Each is fixed at its cause; the
code fixes carry a regression test that fails on the unfixed code (proven by putting the old code
back, then restoring it):

1. **Major: a corrected probe answer left the probe's note and checklist entry stating the old
   finding.** The review rewrote only the answer; the probe answer that first wrote the item stayed
   on record, and the probe's note (the encounter note's "SUPPORTING FEATURES AND EXAM", the EMR
   template's "Probe notes (recorded by clinician):") and its probe-keyed EMR checklist entry come
   from the probe answer, not from the item. So after the patient's nausea was corrected to yes, the
   note still said "Head-motion dizziness without nausea — does not qualify as a Bárány vestibular
   symptom"; after a scan result "Genuinely clear" was corrected or cleared, the checklist still
   ticked "recorded by clinician via probe: Genuinely clear". Before this release nothing could
   change an item after a probe wrote it, and this entry's own sentence said the opposite. Now a
   review change or clear retracts every probe answer whose chosen option wrote that item (new
   engine helper `retractProbeAnswers`), and the encounter note's probe notes are derived from the
   probe answers on record (`probeNoteList`), no longer an append-only list, so the note goes with
   its answer; the probe can be asked again while it is live. The other items the option wrote keep
   their answers (and their review rows still say "probe"), without the EMR template's probe label,
   which would quote the option the clinician corrected; a red flag it raised stays raised. Tests: `render-scribe` (a rescue probe's
   option with a note, cleared and then changed in the review: the note gone from the encounter
   note, the EMR template equal to `buildEmrTemplate` with no probe answer, the rail as `liveProbes`
   gives it; a probe-keyed checklist signal, made live by one review answer, gone after a change
   and after a clear; the EMR expectation now takes the probe answers, which it had always left
   empty), `capture` (the two helpers on crafted probe answers). The sentence above is corrected.
2. **A skip after a review clear never showed on the row.** A cleared item that came back to Ask next
   and was skipped there still read "question review edit". An unanswered skipped item now reads
   "skipped in Ask next" whatever source is recorded (the edited chip and the first answer stay).
   Test: `render-scribe` (review answer, clear, the skip dropped, skipped again in Ask next).
3. **The `shape` suite's probe-rail check could not fail**: it ran after the Question review was
   opened, and the rail is shown only in the Ask next view. It now runs in the Ask next view, before
   the review, and requires that view.
4. **The "cleared item returns to Ask next" check passed without checking**: it passed whenever the
   item was not shown, and in the seed-1296126801 run it was not (the Ask next source check was then
   skipped). The edited item is now one Ask next shows once its answer is cleared (computed with the
   engine), the shown suggestions must equal `rankSuggestions` for the published answers, and the
   item must be shown and answered from its card. A review clear that kept a skip now fails it.
5. **AD21's row fell outside its table** in `docs/refactor/02-app-divergences.md` (a blank line ended
   the table before it); removed.
6. **`SOURCES.md` listed every rubric change-log entry but this follow-up's** (and the table stopped
   at `changelog[14]`): the paragraph now ends with the `emr-plan` entry, and the table has rows for
   `changelog[15]` (`question`) and `changelog[16]` (`emr-plan`).
7. **The Rubric Editor's lock reason for `/emrTemplate` did not know the plan line**: it called the
   block cited content signed off on 2026-10-07 with additions of 2026-10-10, including the lead's
   uncited line of 2026-10-12. It now reads "The EMR template data is clinical content (the built-in
   module's was signed off by the clinical lead on 2026-10-07, with the lead's additions of 2026-10-10
   and 2026-10-12; all of it cited except the 2026-10-12 plan line, the lead's own recommendation);
   not editable in the Rubric Editor." (`engine/derive.js`, which joins the deploy list); `editor`
   pins it, probes `/emrTemplate/planAdvice` and edits the plan line.
8. **`policy.js`'s release comment described 0.4.8 as the three fixes only**; it now names the two
   follow-up requests too.

#### For the lead (follow-up)

1. **Where the tab sits.** "To the right of "Ask Next"" is read as the Scribe's view switch: the
   review is its own tab right of Ask next, and the default view stays Safety. If a tab inside the
   Ask next view was meant instead, say so.
2. **When the plan line prints.** With the references, which print for every picture once the
   referral gate opens (the vestibular rows only for otologic and both), so the line prints for the
   sinonasal picture too; your chosen option's description says "(screen points to a migrainous
   driver)". It never prints under an open red flag.
3. **A corrected probe answer is retracted, not annotated.** When the review changes or clears an
   answer a probe wrote, the probe's answer (and so its note and checklist entry) is withdrawn and the
   probe may be asked again; the review row still shows what the probe first recorded. Keeping the
   probe's observation and marking it as superseded is the other option, if the clinician's original
   observation should stay in the note.

### New strings (AI translation, unreviewed)

Engine chrome (`PATIENT_CHROME`, `app/src/engine/patient.js`), recorded with a basis each in
`app/tests/harness/patient-chrome-048.js`. The English was written by the team as interface labels
(not clinical content); the Spanish is an AI translation (Claude), not reviewed by a qualified
medical translator or a bilingual clinician, like the 0.4.2 Spanish. `locales.es.reviewed` stays
false and the "Traducción sin revisar" banner stays.

| Key | English | Spanish |
|---|---|---|
| `videoShow` | Watch a 1-minute introduction | Ver una introducción de 1 minuto (video en inglés) |
| `videoHide` | Hide the video | Ocultar el video |
| `videoTitle` | Introduction video | Video de introducción (en inglés) |
| `englishVersion` | English version, for an English-speaking clinician | Versión en inglés, para un médico de habla inglesa |

### For the lead

1. **`r_dur`'s question and statement** differ in scope (Fix 2, above). Keeping the statement keeps
   instrument 0.2; changing it is an instrument change with a new version.
2. **The video's claims** ("up to eighty percent" of people with "sinus headaches" or dizziness
   "actually have migraine"; an average wait) are shown as supplied. The project's invariant "say
   what a number is" asks for a source; none is recorded.
3. **The video is English-only.** In Spanish the button and title say so; a Spanish-captioned
   version would need a new file from the lead.
4. **The Spanish strings** above await the bilingual reviewer with the 0.4.2 Spanish.
5. **Deployment.** The MP4 adds 14.8 MB; the host must serve it as `video/mp4` with range requests
   (Apache does). `.jsx` files have been served stale after earlier uploads (`Scribe.jsx` changes in
   the follow-up: confirm the Question review tab after upload).

### Verification

Run of 12 October 2026 on branch `claude/release-0.4.8`, in the in-app browser.

- `extract-rubric.html` reports "Identical" to the committed rubric (again after the review of the
  follow-up, which changes no rubric byte): SHA-256
  `371b875cc8c4eaa8677f16ae8dbe7e927951b44c8f9455eca183c7bc5ba6644e`, 181 checks passed (six for the
  question delta, eight for the follow-up's plan line), 183,194 bytes. `instrumentHash` `b06dfaad…`,
  `scoringHash` `32cc4f44…` and `lexiconHash` `90edcfd5…` unchanged; `contentHash` `523df8a1…`
  (before the follow-up: 181,583 bytes, `57a8445d…`, 173 checks).
- The suites at `app/tests/index.html?seed=1296126801` (no filter), after the review of the
  follow-up and these records: **23/23 PASS, 0 fail, 0 invalid**, 1,650,669 checks (after the
  follow-up, before its review: 1,650,620; after the final review's fixes, before the follow-up:
  1,647,342; release 0.4.7: 1,596,236). The suites whose count moved:

  | Suite | Checks | Before the follow-up's review | Before the follow-up | Release 0.4.7 |
  |---|---|---|---|---|
  | patient | 354,233 | 354,233 | 354,233 | 303,615 |
  | capture | 293,888 | 293,871 | 293,871 | 293,871 |
  | rules | 221,866 | 221,866 | 221,866 | 221,845 |
  | emr | 128,196 | 128,196 | 125,013 | 125,013 |
  | shape | 77,610 | 77,610 | 77,608 | 77,608 |
  | omissions | 20,508 | 20,508 | 20,508 | 20,480 |
  | render-patient | 9,306 | 9,306 | 9,306 | 8,964 |
  | values | 3,976 | 3,976 | 3,958 | 3,918 |
  | static | 1,074 | 1,074 | 1,058 | 1,040 |
  | validate | 478 | 478 | 471 | 471 |
  | render-scribe | 491 | 462 | 410 | 405 |
  | golden | 442 | 442 | 442 | 412 |
  | editor | 304 | 301 | 301 | 301 |
  | upload | 91 | 91 | 91 | 87 |

  Every other suite has the same count (integrity 78, sweep 104,273, extraction 331,727, probes
  100,049, cohort-gen 10, render-screener 1,290, research 160, research-parity 436, roundtrip 183).
- Review of the follow-up, each code fix proven by revert: with `Scribe.jsx` as it was before the
  review (commit ce27797) `render-scribe` fails 16 checks (the skip after a review clear; the probe
  note left in the encounter note and the EMR template after a clear and after a change; the probe
  rail; the probe-keyed checklist entry after a change and after a clear); with `reviewClear` keeping
  a skip instead of dropping it, 9 (the cleared item missing from the suggestions, which no longer
  equal `rankSuggestions`, its card, the skip still on the row); with the probe rail rendered
  unconditionally, `shape` fails `/render/scribe/probeRail`, which the old placement let pass. In `screenair.html` the review's two
  reproductions now hold: after "No nausea" (`pr_headmotion_nausea`) and the nausea corrected to Yes
  in the Question review, the encounter note lists nausea and no longer prints "Head-motion dizziness
  without nausea — does not qualify as a Bárány vestibular symptom"; after "Genuinely clear"
  (`pr_scan_detail`) and the finding corrected to Yes, the EMR template's checklist reads "recorded
  on screen: Objective sinus inflammation on endoscopy/CT when symptomatic" with no "via probe:
  Genuinely clear", and after "Clear answer" the row is "[ ] … not recorded" and the probe is back on
  the rail. The console of a fresh tab stayed clean.
- Follow-up, the plan line: printing it under an open red flag too (the engine changed on purpose,
  then restored) fails the `emr` suite (400 differences, in the matrix's flag states and every
  red flag), so the gating is tested. AD21 observed at every compared `render-scribe` snapshot.
- Follow-up, `screenair.html`: the Screener's "Sample: dizziness" (otologic, no flag) EMR template
  prints, in the plan, the six reference entries and then "- recommend a trial of migraine abortives
  if not contra-indicated due to other conditions." right before "Acute (abortive) treatment offered
  today: [agent, dose - or not offered, reason]"; "Sample: red flag" prints the references under
  "Screen-based referral and references (the FHIR bundle withholds the referral while a red flag is
  open):" and no plan line. In the Scribe, a chart note typed into the box ("Her tinnitus is
  bilateral. Endorses photophobia.", Ctrl+Enter) and six demo lines: the Question review tab right of
  Ask next lists all 30 scored items, the typed answers as "typed chart text" and the demo's as
  "heard in encounter"; changing the typed tinnitus answer to No moved the index range (0–97 →
  0–93) and the vestibular domain (4/25 → 0/25), showed "edited" and "First recorded: Yes · typed
  chart text", and the EMR template then read "Answered no: Fluctuating aural fullness or tinnitus
  with episodes"; clearing the typed photophobia answer returned it to "not answered" (coverage 20%
  → 17%), and the encounter note and the EMR template dropped it. Keyboard: from Ask next,
  ArrowRight selects and focuses Question review, Tab moves to the first row's first answer button,
  Shift+Tab back to the selected tab; only the selected tab is in the tab order. At 375 px no
  horizontal scroll (the review 309 px wide). The console of a fresh tab stayed clean through the
  Scribe and the Screener.
- AD19 observed on 1,722 of 1,722 baseline suggestion lists holding `r_dur` (`rules`); AD20 on
  10,160 of 10,160 es exports (`patient`, each English twin equal to the baseline's English summary
  and `.txt`), on every es screen of `golden` and on 95 of 95 es summary checkpoints
  (`render-patient`).
- `screenair.html`: the Scribe's Ask-next card for `r_dur` reads "Have symptoms persisted over 3
  months despite trials of medical management?" under "recalcitrance" with Yes / No; the Screener's
  item card still shows the statement ("Symptoms have persisted or recurred for more than 3 months")
  and neither question; patient mode in English and Spanish shows the video panel right above the
  instructions ("Hide the video" / "Ocultar el video"), the video plays, hides and shows; a Spanish
  run to the summary shows the English version on screen, and its `.txt` and `.html` carry both
  languages (one English section; the Spanish footer and dated marker last); at 375 px the page
  has no horizontal scroll (frame 343 px); the console of a fresh tab stayed clean. `patient.html`
  the same.
- The video was viewed before it was added (frames at 0 to 59 s; description above).
- Final review fixes, beyond the suites (headless Edge 155): the review's four reproductions (its
  driver's seeds 56433, 88109, 103947 and 111866, Spanish, with and without red flags) printed to PDF
  from patient mode, and the `.html` export of 111866: the English version's whole title opens page 3
  together with its first block (the urgent box, or "What I want to describe"); before the fix the
  title ended page 2 (in 111866 its English line moved to page 3 even with `break-after` alone, so
  the title is also kept whole). Twenty answer sets (five fixed patterns with and without red flags, ten
  random) driven through release 0.4.7 (b516872, served from a `git archive`) and this release in
  patient mode: in English the `.txt`, the `.html` and the screen text are identical once the release
  and the date are normalised; in Spanish the same holds once the English version (and, in the
  `.html`, its styles) is removed.
- No cloud Playwright run (no Node on this machine).

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
