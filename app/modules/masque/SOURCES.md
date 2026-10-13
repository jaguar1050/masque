# MASQUE rubric — source map

`masque.rubric.json` is generated, not written. `app/tests/tools/extract-rubric.html` (with
`extract-rubric.js`) imports the frozen baseline `app/tests/baseline/src/` through the parity
harness's oracles, so `MANIFEST.sha256` is verified first. It builds the rubric from the live
constants, the outputs of the baseline builders and JSX/template text cut from the SHA-pinned
source at the lines below. JSX cuts are compiled with Babel, so whitespace and entities come out
as React renders them. The tool writes `JSON.stringify(rubric, null, 2) + "\n"`: UTF-8 without
BOM, LF, no `\u` escapes. Opening the page shows whether a regeneration is byte-identical to the
committed file, and it runs 181 cross-checks, every one of which must pass (123 until release
0.4.2, which added six for the Spanish delta; 129 until release 0.4.3, which added eight for the
EMR template data; 137 until release 0.4.4, which added one for the sign-off change-log entry;
138 until release 0.4.5, which added nine for the clinical lead's referral rule and, on
2026-10-10, a tenth for the lead's amendment of its definition; 148 until release 0.4.6, which
added nine for the clinical lead's answers on the EMR template's open items; 157 until release
0.4.7, which added ten for the lexicon change 0.3.2 → 0.3.3: nine, and a tenth for the clinical
lead's sign-off record of 2026-10-12; 167 until release 0.4.8, which added six for the clinical
lead's question for item `r_dur`; 173 until the 0.4.8 follow-up, which added eight for the clinical
lead's plan line for the EMR template).
After the baseline extraction it applies the
clinical-lead-approved lexicon delta 0.3.1 → 0.3.2 (`app/tests/harness/lexicon-delta.js`, design
05 §6.2; see "Approved lexicon delta" below) and, since release 0.4.2, the unreviewed Spanish
translation delta (`app/tests/harness/locale-delta.js`; see "Spanish translation delta
(unreviewed)" below) and, since release 0.4.3, the EMR template data, which AI agents assembled
from verified sources and the clinical lead signed off on 2026-10-07 (recorded in release 0.4.4;
`app/tests/harness/emr-delta.js`; see "EMR template data (release 0.4.3, signed off by the
clinical lead in 0.4.4)" below) and, since release 0.4.5, the clinical lead's referral rule for
dizziness cases (`app/tests/harness/referral-delta.js`; see "Referral rule for dizziness cases
(release 0.4.5)" below) and, since release 0.4.6, the clinical lead's answers on the EMR
template's open items (`app/tests/harness/emr-decisions-delta.js`; see "EMR template: the clinical
lead's answers (release 0.4.6)" below) and, since release 0.4.7, the lexicon change 0.3.2 → 0.3.3
for chart text and clarification prompts, applied right after the 0.3.2 delta
(`app/tests/harness/lexicon-delta-033.js`; signed off by the clinical lead on 2026-10-12; see
"Lexicon delta 0.3.2 → 0.3.3 (release 0.4.7; signed off by the clinical lead on 2026-10-12)"
below) and, since release 0.4.8, the clinical lead's question for item `r_dur`, applied last
(`app/tests/harness/question-delta-048.js`; see "Clinician question for item r_dur (release 0.4.8)"
below). Release 0.4.8 also adds engine chrome and module media that are not rubric data: see
"Patient chrome of release 0.4.8 (AI translation, unreviewed)" and "Patient introduction video
(release 0.4.8)" below.

This file restates the extractor's map (design 03 §3.8, §9.2). Line numbers refer to
`app/tests/baseline/src/` (identical to `app/src` at the WP0 commit).

| Abbreviation | Baseline file |
|---|---|
| Scr | `MASQUE_Screener_v0_3.jsx` |
| Scb | `MASQUE_Scribe_v0_3.jsx` |
| Pat | `MASQUE_Patient_v0_3.jsx` |
| Sim | `MASQUE_Simulator.jsx` |
| Ext | `MASQUE_Extraction.js` |
| RRP | `ResearchReadinessPanel.jsx` |
| Voice | `MASQUE_Voice.js` |
| Pop | `MASQUE_Population.jsx` |

## Hand-written values (design §9.2 item 6)

Everything else is read from the baseline. Each value here is typed once in `HAND` at the top of
`extract-rubric.js`.

| Field | Value | Why it is hand-written / how it is checked |
|---|---|---|
| `label` | `Dizziness and Sinusitis (MASQUE v1)` | User requirement of 2026-10-02. Display only (Q1); it appears in no identifier. |
| `id`, `name`, `icon` | `masque`, `MASQUE`, `Stethoscope` | Module identity. `icon` matches the Screener brand mark (Scr L1003). |
| `logicBinding` | `{moduleId: "masque"}` | The registry pairs the rubric and logic files, so there is no SHA pin (§3.8). |
| `fhir.questionnaireUrl`, `codeSystem`, `answerSystem`, `criteriaSystem`, `weightExtension`, `indexCode`, `screenIdPrefix`, `filePrefix`; `cds.serviceId`, `safetyCardUuid`, `indexCardUuid`, `source.url` | `{id}`/`{instrument}` templates | Identity templates (D8, V9). Each one is rendered with `id = "masque"` and `instrument = "0.2"` and compared with the literal it replaces: `QUESTIONNAIRE_URL` (Scr L80), the Questionnaire code systems (Scr L447, L467), `ANSWER_SYSTEM` and `WEIGHT_EXT` (Scr L421-422), the index Observation code (Scr L1537, Scb L1425), the `screen_id` prefix (Scr L574), the download-name prefix (Scr L966, L1407-1413), the CDS service id, card uuids and source url (Scr L479, L496-511). |
| `lexicon.goldSet.lexiconVersion`, `lexicon.goldSet.file` | `0.3.1`, `masque_extraction_goldset.json` | The goldSet of the baseline 0.3.1 lexicon: the lexicon the reference gold set was benchmarked against, and its file name. `goldSet.version` is read from that file's `_meta.version` in `reference/MASQUE_v0.3.1/`, after its SHA-256 is checked against that folder's `MANIFEST.sha256`. The approved delta then replaces the whole `goldSet` (exact `from` match) with `{version: "0.3.0", lexiconVersion: "0.3.2", file: "masque_extraction_goldset_0.3.0.json"}`. That file lives in `app/tests/fixtures/goldset/` (local-only, never deployed); it is a superset of reference v0.2.0 by reference (its `_meta.basedOn` pins the reference file's SHA-256 and its 44 cases, which are not copied) and is SHA-256 pinned in `tests/suites/capture.js` (`GOLD_0_3_0_SHA256`). The extractor checks its `_meta` against `goldSet` and the reference pin. Release 0.4.7: the 0.3.3 delta replaces `goldSet` again (exact `from` match) with `{version: "0.4.0", lexiconVersion: "0.3.3", file: "masque_extraction_goldset_0.4.0.json"}`. That file, in the same folder, copies the 0.3.0 cases and dialogues verbatim and pins the 0.3.0 file by its SHA-256 in `_meta.includes` (the 0.3.0 file stays, unchanged and pinned); it adds 273 chart cases (`k001` the lead's history and physical, `k002`-`k051` the chart-text catalogue, `k052`-`k065` the fixes before review, `k066`-`k122` review round 1, `k123`-`k186` review round 2, `k187`-`k259` review round 3, `k260`-`k273` the clinical lead's sign-off of 2026-10-12) and a supersede table: five 0.2.0 / 0.3.0 case outputs (e16, r02, f02, t007, w019) that change since the lead's decision D9 of 2026-10-12 reads spoken lines with chart reading too (empty from review round 2 until then), and is pinned in `capture.js` (`GOLD_0_4_0_SHA256`). The extractor checks its `_meta` against `goldSet`, the reference pin and the 0.3.0 file's SHA-256. |
| `changelog[].note`, `date` | 2026-10-02 | The reconciliation, extraction and open-question entries (§3.8). |
| `changelog[8]` | 2026-10-04 | The approved lexicon change, `LEXICON_DELTA.changelog` in `tests/harness/lexicon-delta.js` (design 05 §6.3), appended after the 2026-10-02 notes. Its note was reworded in rounds 2 and 3 of release 0.4.1 (design 05 §12.7, §13.5) so that it states only what the extractor does. |
| `changelog[9]` | 2026-10-06 | The Spanish translation (kind `translation`, release 0.4.2), `LOCALE_DELTA.changelog` in `tests/harness/locale-delta.js`, appended after the lexicon entry. It names the 36 added paths. |
| `changelog[10]` | 2026-10-06 | The EMR template data (kind `emr-template`, release 0.4.3), `EMR_DELTA.changelog` in `tests/harness/emr-delta.js`, appended after the translation entry. It says the data was not reviewed by the clinical lead, which was true when it was written; it is kept as history. |
| `changelog[11]` | 2026-10-07 | The clinical lead's sign-off of that data (kind `sign-off`, release 0.4.4), `EMR_DELTA.signOffChangelog` in the same file, appended right after it. It states the sign-off's scope and what it does not cover. |
| `changelog[12]` | 2026-10-10 | The clinical lead's referral rule for dizziness cases (kind `referral`, release 0.4.5), `REFERRAL_DELTA.changelog` in `tests/harness/referral-delta.js`, appended after the sign-off entry and dated as the last of the lead's decisions (2026-10-07 to 2026-10-10; it was dated 2026-10-09 until the lead amended the definition on 2026-10-10). It names the changed and the two added paths. |
| `changelog[13]` | 2026-10-10 | The clinical lead's answers on the EMR template's open items (kind `emr-decisions`, release 0.4.6), `EMR_DECISIONS_DELTA.changelog` in `tests/harness/emr-decisions-delta.js`, appended after the referral entry. It names the two added paths. |
| `changelog[14]` | 2026-10-12 | The lexicon change 0.3.2 → 0.3.3 (kind `lexicon`, release 0.4.7: chart text and clarification prompts), `LEXICON_DELTA_033.changelog` in `tests/harness/lexicon-delta-033.js`, appended after the emr-decisions entry. Its note states the outcome of the clinical lead's sign-off of 2026-10-12 (the approved rows marked lead-approved, the struck rows gone, the rows added), quotes the lead's question and names the five paths the delta touches. It is dated 2026-10-12, as that sign-off (until then 2026-10-11, as the lead's request and decisions). |
| `changelog[15]` | 2026-10-12 | The clinical lead's question for item `r_dur` (kind `question`, release 0.4.8), `QUESTION_DELTA.changelog` in `tests/harness/question-delta-048.js`, appended after the lexicon entry. It quotes the lead's request and names the one changed path, `/domains/0/items/0/ask`. |
| `changelog[16]` | 2026-10-12 | The clinical lead's plan line for the EMR template (kind `emr-plan`, release 0.4.8, follow-up), `EMR_PLAN_DELTA.changelog` in `tests/harness/emr-plan-delta-048.js`, appended after the question entry. It quotes the lead's request and answers of 2026-10-12 and names the one added path, `/emrTemplate/planAdvice`. |

### Approved lexicon delta 0.3.1 → 0.3.2 (design 05 §6.2)

These values are typed once, in `app/tests/harness/lexicon-delta.js`, not in `HAND`. Source of
every row below: applied by `extract-rubric.js` from `tests/harness/lexicon-delta.js` after the
baseline extraction (`applyLexiconDelta`, then `revertLexiconDelta` must give back the baseline
lexicon exactly). Paths in the delta use the 0.3.1 positions; each `entryId` is checked against the
entry at its position. Approved by the clinical lead on 2026-10-04 (lead decisions D1-D4; round 2,
design 05 §12: L1 `carryExclude`, L2 digits for durations only, L3 `carryRefuse` confirmed). Round 3
(design 05 §13) changes no value below: it changes how the extractor reads them (R9-R11) and
rewords the change-log note (`changelog[8]`). Drafts that were struck, and the known risks, are
listed in `CHANGELOG.md`. The gold set 0.3.0 case text, from all three rounds, was drafted by the
team and has not been reviewed by the clinical lead.

| Field | Value | Approval | Origin | Source |
|---|---|---|---|---|
| `lexicon.version` | `0.3.2` | clinical-lead approval 2026-10-04 | the lexicon axis moves with any phrase or lexicon-field change | `lexicon-delta.js` `fields[0]` (replaces `0.3.1`) |
| `lexicon.scale[1].heard` (v_vertigo) | `true` | clinical-lead approval 2026-10-04 (F1, Q1) | design 05 §3.6 | `lexicon-delta.js` `fields[1]` |
| `lexicon.scale[1].carry` (v_vertigo) | `2` | clinical-lead approval 2026-10-04 (F2, Q1) | design 05 §3.6 | `lexicon-delta.js` `fields[2]` |
| `lexicon.scale[1].carryExclude` (v_vertigo) | `about a day`, `overnight`, `for a day or two`, `for a couple of days`, `for two days`, `for three days` | clinical-lead decision 2026-10-04 (L1: day ranges are same-sentence only) | design 05 §12.3; review finding F1 (clinical): the reply "For two days." to the module's own question "How long has this been going on?" was carried as the episode duration. Each is an approved v 2 band phrase; it still sets a value in a cue sentence, and from round 3 only there (R11: a sentence ends at `.` `!` `?` or `;` followed by whitespace or the end of the text; from round 3c a cue sentence is any sentence holding a cue hit that is not negated, attributed or historical, and elsewhere the phrase still counts for the negation and disagreement tests and withholds the value). In a carried reply it never supplies the value but, from round 3, still counts for the negation and disagreement tests (R10) | `lexicon-delta.js` `fields[3]` |
| `lexicon.scale[2].yieldTo` (m_dur) | `["v_vertigo"]` | clinical-lead approval 2026-10-04 (F4, Q2, including the cross-turn effect) | design 05 §4.5 | `lexicon-delta.js` `fields[4]` |
| `lexicon.scale[2].anchor` (m_dur) | `headache`, `facial pressure`, `facial pain`, `pressure in my face`, `behind my eyes`, `migraine lasts`, `migraines last`, `head pain` | clinical-lead approval 2026-10-04 (F4, Q2) | the first five are existing `m_head` cues; `migraine lasts`, `migraines last` and `head pain` are new | `lexicon-delta.js` `fields[5]` |
| `lexicon.carryRefuse` | `ago`, `since`, `started`, `began` | confirmed by the clinical lead on 2026-10-04 (proposed by the team as a carry-over guard); Q3, L3 | design 05 Appendix A4: an onset ("a few hours ago") is not a duration. In a heard entry's own utterance it withholds the duration and no carry-over opens from that utterance (R3b, round 3 R9 c and f); in a carried reply it refuses the carry. It can only prevent a capture, never cause one: from round 3 a withheld duration no longer arms carry-over, so no later reply can supply a value because of it | `lexicon-delta.js` `fields[6]` |
| `lexicon.normalize` | `{apostrophes: true, numbers: "en"}` | clinical-lead approval 2026-10-04 (lead decision D4; numbers for band phrases only, lead decision L2) | new: typographic apostrophes are matched as `'` everywhere; standalone small integers are matched as words in duration band phrases only (known risk: digits are not read in red-flag phrases, "numb on 1 side") | `lexicon-delta.js` `fields[7]` |
| `lexicon.goldSet` | `{version: "0.3.0", lexiconVersion: "0.3.2", file: "masque_extraction_goldset_0.3.0.json"}` | the version change is part of the approved lexicon change of 2026-10-04; the gold set 0.3.0 case text was drafted by the team and has **not** been reviewed by the clinical lead | see the `lexicon.goldSet` row above | `lexicon-delta.js` `fields[8]` (replaces the 0.3.1 value) |

Appended phrases, one row per phrase, each at the end of its list in delta order ("problem report"
is the clinical lead's reported failure, design 05 §0.1):

| Field | Phrase | Approval | Origin | Source |
|---|---|---|---|---|
| `lexicon.scale[1].cue` (v_vertigo) | `world is moving` | clinical-lead approval 2026-10-04 (F3) | problem report ("as if the world is moving around me") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `world moving around` | clinical-lead approval 2026-10-04 (F3) | problem report ("as if the world is moving around me") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `world's moving` | clinical-lead approval 2026-10-04 (F3) | new: variant of the problem report wording | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `world was moving` | clinical-lead approval 2026-10-04 (F3) | new: variant of the problem report wording | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `everything spins` | clinical-lead approval 2026-10-04 (F3) | new: lay variant of the existing cue "room spins" | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `everything spun` | clinical-lead approval 2026-10-04 (F3) | new: lay variant of the existing cue "room spins" | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `room spun` | clinical-lead approval 2026-10-04 (F3) | new: lay variant of the existing cue "room spins" | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `room is moving` | clinical-lead approval 2026-10-04 (F3) | new: variant of the problem report wording | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `everything is moving` | clinical-lead approval 2026-10-04 (F3) | new: variant of the problem report wording | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `like i'm on a boat` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_internal_vertigo` ("…bobbing, rocking, or swaying side to side — like still being on a boat…") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `like i was on a boat` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_internal_vertigo` ("…bobbing, rocking, or swaying side to side — like still being on a boat…") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `like i am on a boat` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_internal_vertigo` ("…bobbing, rocking, or swaying side to side — like still being on a boat…") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `like being on a boat` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_internal_vertigo` ("…bobbing, rocking, or swaying side to side — like still being on a boat…") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `rocking feeling` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_mdds` ("a rocking feeling") and `pr_internal_vertigo` ("rocking") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `rocking sensation` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_internal_vertigo` ("rocking") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `swaying side to side` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_internal_vertigo` ("swaying side to side") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `feel unsteady` | clinical-lead approval 2026-10-04 (F3) | problem report ("I feel unsteady") | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `unsteady on my feet` | clinical-lead approval 2026-10-04 (F3) | new: variant of the problem report wording | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `losing my balance` | clinical-lead approval 2026-10-04 (F3) | new: lay variant of the existing cue "off balance" | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `lose my balance` | clinical-lead approval 2026-10-04 (F3) | new: lay variant of the existing cue "off balance" | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].cue` (v_vertigo) | `balance is off` | clinical-lead approval 2026-10-04 (F3) | new: lay variant of the existing cue "off balance" | `lexicon-delta.js` `appended[0]` |
| `lexicon.scale[1].bands[0].ph` (v_vertigo, v 1 Under 5 min) | `split second` | clinical-lead approval 2026-10-04 (F3) | new: lay duration | `lexicon-delta.js` `appended[1]` |
| `lexicon.scale[1].bands[0].ph` (v_vertigo, v 1 Under 5 min) | `a second or two` | clinical-lead approval 2026-10-04 (F3) | new: lay duration | `lexicon-delta.js` `appended[1]` |
| `lexicon.scale[1].bands[0].ph` (v_vertigo, v 1 Under 5 min) | `a couple minutes` | clinical-lead approval 2026-10-04 (F3) | new: lay duration | `lexicon-delta.js` `appended[1]` |
| `lexicon.scale[1].bands[0].ph` (v_vertigo, v 1 Under 5 min) | `under five minutes` | clinical-lead approval 2026-10-04 (F3) | new: lay duration | `lexicon-delta.js` `appended[1]` |
| `lexicon.scale[1].bands[0].ph` (v_vertigo, v 1 Under 5 min) | `less than five minutes` | clinical-lead approval 2026-10-04 (F3) | new: lay duration | `lexicon-delta.js` `appended[1]` |
| `lexicon.scale[1].bands[0].ph` (v_vertigo, v 1 Under 5 min) | `two minutes` | clinical-lead approval 2026-10-04 (F3) | new: lay duration (known risk: every spelled compound from "twenty-two" to "ninety-two minutes", with or without the hyphen, contains it; "twenty-two" and "thirty-two" accepted by the lead, the rest recorded as accepted with the phrase and flagged) | `lexicon-delta.js` `appended[1]` |
| `lexicon.scale[1].bands[0].ph` (v_vertigo, v 1 Under 5 min) | `three minutes` | clinical-lead approval 2026-10-04 (F3) | new: lay duration (known risk: every spelled compound from "twenty-three" to "ninety-three minutes", with or without the hyphen, contains it; "twenty-three" and "thirty-three" accepted by the lead, the rest recorded as accepted with the phrase and flagged) | `lexicon-delta.js` `appended[1]` |
| `lexicon.scale[1].bands[0].ph` (v_vertigo, v 1 Under 5 min) | `four minutes` | clinical-lead approval 2026-10-04 (F3) | new: lay duration (known risk: every spelled compound from "twenty-four" to "ninety-four minutes", with or without the hyphen, contains it; "twenty-four" and "thirty-four" accepted by the lead, the rest recorded as accepted with the phrase and flagged) | `lexicon-delta.js` `appended[1]` |
| `lexicon.scale[1].bands[2].ph` (v_vertigo, v 2 5 min – 72 h) | `half the day` | clinical-lead approval 2026-10-04 (F3) | new: lay duration | `lexicon-delta.js` `appended[2]` |
| `lexicon.scale[1].bands[2].ph` (v_vertigo, v 2 5 min – 72 h) | `half a day` | clinical-lead approval 2026-10-04 (F3) | new: lay duration | `lexicon-delta.js` `appended[2]` |
| `lexicon.scale[1].bands[2].ph` (v_vertigo, v 2 5 min – 72 h) | `about a day` | clinical-lead approval 2026-10-04 (F3) | new: lay duration. In `carryExclude` (L1: same sentence only); known risk: in the cue's own sentence it can read an illness duration | `lexicon-delta.js` `appended[2]` |
| `lexicon.scale[1].bands[2].ph` (v_vertigo, v 2 5 min – 72 h) | `all night` | clinical-lead approval 2026-10-04 (F3) | new: lay duration | `lexicon-delta.js` `appended[2]` |
| `lexicon.scale[1].bands[2].ph` (v_vertigo, v 2 5 min – 72 h) | `for a day or two` | clinical-lead approval 2026-10-04 (F3) | new: lay duration; the same words as the existing `m_dur` band phrase "a day or two". In `carryExclude` (L1); known risk as `about a day` | `lexicon-delta.js` `appended[2]` |
| `lexicon.scale[1].bands[2].ph` (v_vertigo, v 2 5 min – 72 h) | `for a couple of days` | clinical-lead approval 2026-10-04 (F3) | new: lay duration; the same words as the existing `m_dur` band phrase "couple of days". In `carryExclude` (L1); known risk as `about a day` | `lexicon-delta.js` `appended[2]` |
| `lexicon.scale[1].bands[2].ph` (v_vertigo, v 2 5 min – 72 h) | `for two days` | clinical-lead approval 2026-10-04 (F3) | new: lay duration; the same words as the existing `m_dur` band phrase "two days". In `carryExclude` (L1); known risks: "I've been dizzy for two days" reads 5 min – 72 h, and so does another symptom's duration in the cue's sentence, "My migraines last for two days and I get dizzy with them" | `lexicon-delta.js` `appended[2]` |
| `lexicon.scale[1].bands[2].ph` (v_vertigo, v 2 5 min – 72 h) | `for three days` | clinical-lead approval 2026-10-04 (F3) | new: lay duration; the same words as the existing `m_dur` band phrase "three days". In `carryExclude` (L1); known risk as `for two days` | `lexicon-delta.js` `appended[2]` |
| `lexicon.scale[1].bands[2].ph` (v_vertigo, v 2 5 min – 72 h) | `overnight` | clinical-lead approval 2026-10-04 (F3) | new: lay duration. In `carryExclude` (L1); known risk: "it came on overnight" reads 5 min – 72 h | `lexicon-delta.js` `appended[2]` |
| `lexicon.scale[1].bands[1].ph` (v_vertigo, v 3 Over 72 h) | `lasts more than three days` | clinical-lead approval 2026-10-04 (F3) | new: lay duration; the same words as the existing `m_dur` band phrase "more than three days" | `lexicon-delta.js` `appended[3]` |
| `lexicon.scale[1].bands[1].ph` (v_vertigo, v 3 Over 72 h) | `lasted more than three days` | clinical-lead approval 2026-10-04 (F3) | new: lay duration; the same words as the existing `m_dur` band phrase "more than three days" | `lexicon-delta.js` `appended[3]` |
| `lexicon.scale[1].bands[1].ph` (v_vertigo, v 3 Over 72 h) | `days at a time` | clinical-lead approval 2026-10-04 (F3) | new: lay duration | `lexicon-delta.js` `appended[3]` |
| `lexicon.bool[8].ph` (v_head) | `roll over` | clinical-lead approval 2026-10-04 (F3) | problem report; module probe wording `pr_positional` ("rolling over in bed") (known risk: "It doesn't happen when I roll over" reads yes, the denial lies beyond the 14-character window) | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `rolled over` | clinical-lead approval 2026-10-04 (F3) | new: variant of "roll over" | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `turning over` | clinical-lead approval 2026-10-04 (F3) | new: lay variant of `pr_positional` ("rolling over in bed") (known risk: the idiom "my stomach keeps turning over") | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `over in bed` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_positional` ("rolling over in bed") | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `when i turn my head` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_headmotion_nausea` ("When you turn your head quickly…") | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `when i look up` | clinical-lead approval 2026-10-04 (F3) | new: lay variant of the existing phrase "looking up" | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `when i lie back` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_positional` ("lying back") | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `lying back in` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_positional` ("lying back") | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `tip my head back` | clinical-lead approval 2026-10-04 (F3) | new | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `high shelf` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_positional` ("reaching up to a high shelf") | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[8].ph` (v_head) | `bending over` | clinical-lead approval 2026-10-04 (F3) | new: lay variant of the existing phrase "bend over" | `lexicon-delta.js` `appended[4]` |
| `lexicon.bool[6].ph` (v_motion) | `driving through a tunnel` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_visual_vertigo` ("driving through a tunnel") | `lexicon-delta.js` `appended[5]` |
| `lexicon.bool[6].ph` (v_motion) | `drive through a tunnel` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_visual_vertigo` ("driving through a tunnel") | `lexicon-delta.js` `appended[5]` |
| `lexicon.bool[6].ph` (v_motion) | `patterned` | clinical-lead approval 2026-10-04 (F3) | module probe wording: `pr_visual_vertigo` ("patterned carpet") | `lexicon-delta.js` `appended[5]` |
| `lexicon.bool[6].ph` (v_motion) | `busy visual` | clinical-lead approval 2026-10-04 (F3) | module wording: `v_motion` `ask` ("busy visual scenes") and the patient summary ("busy visual patterns") | `lexicon-delta.js` `appended[5]` |
| `lexicon.bool[6].ph` (v_motion) | `dizzy riding in a car` | clinical-lead approval 2026-10-04 (F3) | module wording: the patient summary and the Patient item ("riding in a car") | `lexicon-delta.js` `appended[5]` |
| `lexicon.bool[6].ph` (v_motion) | `sick riding in a car` | clinical-lead approval 2026-10-04 (F3) | module wording: the patient summary and the Patient item ("riding in a car") | `lexicon-delta.js` `appended[5]` |
| `lexicon.bool[7].ph` (v_aural) | `ears feel full` | clinical-lead approval 2026-10-04 (F3) | new: plural variant of the existing phrase "ear feels full" | `lexicon-delta.js` `appended[6]` |
| `lexicon.bool[7].ph` (v_aural) | `ears ring` | clinical-lead approval 2026-10-04 (F3) | new: plural variant of the existing phrase "ear ring" | `lexicon-delta.js` `appended[6]` |
| `lexicon.bool[7].ph` (v_aural) | `roaring` | clinical-lead approval 2026-10-04 (F3) | new (known risks: "I haven't noticed any roaring" reads yes, the denial lies beyond the window; "the crowd was roaring") | `lexicon-delta.js` `appended[6]` |
| `lexicon.bool[19].ph` (v_migfeat) | `headache during the dizz` | clinical-lead approval 2026-10-04 (F3) | new: variant of the existing phrase "headache with the dizz" | `lexicon-delta.js` `appended[7]` |
| `lexicon.bool[19].ph` (v_migfeat) | `headaches during the dizz` | clinical-lead approval 2026-10-04 (F3) | new: variant of the existing phrase "headache with the dizz" | `lexicon-delta.js` `appended[7]` |
| `lexicon.negation.cues` | `fewer than` | clinical-lead approval 2026-10-04 (D3) | new (lead decision D3) (known risks: "no fewer than five episodes" reads as a denial; "fewer than five minutes" in the cue's own sentence reads 5 min – 72 h, the cue lying outside the window before "minutes") | `lexicon-delta.js` `appended[8]` |
| `lexicon.thirdParty.cues` | `my grandmother` | clinical-lead approval 2026-10-04 (D3) | new (lead decision D3), extending the existing family cues | `lexicon-delta.js` `appended[9]` |
| `lexicon.thirdParty.cues` | `my grandma` | clinical-lead approval 2026-10-04 (D3) | new (lead decision D3), extending the existing family cues | `lexicon-delta.js` `appended[9]` |
| `lexicon.thirdParty.cues` | `my aunt` | clinical-lead approval 2026-10-04 (D3) | new (lead decision D3), extending the existing family cues | `lexicon-delta.js` `appended[9]` |
| `lexicon.thirdParty.cues` | `my uncle` | clinical-lead approval 2026-10-04 (D3) | new (lead decision D3), extending the existing family cues | `lexicon-delta.js` `appended[9]` |
| `lexicon.thirdParty.cues` | `my friend` | clinical-lead approval 2026-10-04 (D3) | new (lead decision D3), extending the existing family cues (known risk: it can suppress the patient's own report, "I drove with my friend and got dizzy for hours") | `lexicon-delta.js` `appended[9]` |

### Spanish translation delta (unreviewed), release 0.4.2

These values are typed once, in `app/tests/harness/locale-delta.js` (`LOCALE_DELTA`), not in
`HAND`. Source of every row in the first table: applied by `extract-rubric.js` after
`locales.es` is built from the baseline (`applyLocaleDelta`, then `revertLocaleDelta` must give
back the baseline `locales.es` exactly, key order included). `applyLocaleDelta` refuses a path
that already exists, so no existing Spanish string can be overwritten: every baseline Spanish
string is unchanged, byte for byte.

**Who made it, and its status.** Requested by the user on 2026-10-06 ("Fix the Spanish patient
companion to make sure it is completely translated"). The Spanish was produced by AI agents: two
independent drafts (A and B), merged, then a clinical review, a language review and a mechanical
review, also by AI agents. It was **not** produced or checked by a qualified human medical
translator or by a bilingual clinician. It is therefore recorded as an unreviewed team translation
(`LOCALE_DELTA.translated.reviewed: false`), `locales.es.reviewed` stays `false`, and the
"Traducción sin revisar" banner, the print-header title and the `.txt` line stay on every Spanish
surface until a bilingual clinical reviewer signs it off. The items awaiting that reviewer are
listed at the end of this section; the safety strings are to be reviewed first.

**Reading the Basis column** (copied verbatim from the merged translation record): "A" or "B"
names the draft whose wording was kept, "A=B" means both drafts gave the same wording, and "new"
means no existing Spanish was reused. A quoted fragment names the existing Spanish that the row
reuses (in the rubric's `locales.es`, the logic's `SUM.es`, `PATIENT_CHROME.es`, or the
Simulator's `PQ.es`), so terms stay consistent with what was already shipped. The English source
column is what the extractor checks the row against: `locales.en` at the same path, or, for an
item's `clin`, the item's `patientClin`. A later English edit therefore shows up as a mismatch.

**Where each kind of row lands.** `contextItems` is inserted after `redFlags` (whole block: the
three questions with their `q` and `opts`; the option values are the English ones, in the English
order, checked by the extractor because the gap rule reads `3+`, `>12mo` and `yes`).
`steps.story` gains `heading`, `lede` and `intro` after its existing `title`. `ui` gains
`forYouIf` and `clinicianLede` after its existing `sub`. Each of the 30 items gains `clin` (new
optional locale key, release 0.4.2) after its last existing key. `clin` is the item's clinician
line in Spanish, which the patient summary's "Para mi médico" block shows in place of the English
`patientClin`, followed by the Spanish option label in brackets as before. English has no `clin`
(V32 error): its clinician line is `patientClin`.

Rows added to `locales.es` (48 leaves in 36 delta rows; a composite row is split into its leaves
here):

| Path | Spanish | English source | Basis | Source |
|---|---|---|---|---|
| `/locales/es/contextItems/c_clin/q` | `¿A cuántos médicos diferentes ha visto por esto?` | `How many different clinicians have you seen about this?` | B; built from SUM.es.gap 'He visto a … médicos por esto' | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_clin/opts/0` | `["1", "Solo uno"]` | `["1", "Just one"]` | A=B; new | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_clin/opts/1` | `["2", "Dos"]` | `["2", "Two"]` | A=B; new | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_clin/opts/2` | `["3+", "Tres o más"]` | `["3+", "Three or more"]` | SUM.es.gap 'tres o más médicos' (A=B) | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_dur/q` | `¿Cuánto tiempo lleva con esto?` | `How long has this been going on?` | A=B; 'lleva' as in locales.es items.r_dur 'Esto lleva más de 3 meses' | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_dur/opts/0` | `["<6mo", "Menos de 6 meses"]` | `["<6mo", "Under 6 months"]` | A=B; pattern of locales.es m_dur / v_vertigo opts 'Menos de 4 horas' / 'Menos de 5 minutos' | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_dur/opts/1` | `["6-12mo", "6 a 12 meses"]` | `["6-12mo", "6 to 12 months"]` | A=B; pattern of locales.es i_days opts '1 a 3', '4 a 9' | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_dur/opts/2` | `[">12mo", "Más de un año"]` | `[">12mo", "Over a year"]` | SUM.es.gap ', por más de un año' (A=B) | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_dismiss/q` | `¿Le han dicho que es estrés o ansiedad, o que todo salió normal?` | `Have you been told it's stress or anxiety, or that everything looks normal?` | A=B; wording of SUM.es.gap 'me lo han atribuido al estrés o a que todo salió normal' | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_dismiss/opts/0` | `["no", "No"]` | `["no", "No"]` | PATIENT_CHROME.es.no (A=B) | `locale-delta.js` `added[0]` |
| `/locales/es/contextItems/c_dismiss/opts/1` | `["yes", "Sí"]` | `["yes", "Yes"]` | PATIENT_CHROME.es.yes (A=B) | `locale-delta.js` `added[0]` |
| `/locales/es/steps/story/heading` | `Su historia hasta ahora` | `Your story so far` | A=B; extends locales.es steps.story.title 'Su historia' | `locale-delta.js` `added[1]` |
| `/locales/es/steps/story/lede` | `Esta parte importa más de lo que la gente cree. Cuánto tiempo lleva con esto y cuántas puertas ya ha tocado cambian lo que sería un buen próximo paso.` | `This part matters more than people expect. How long you've been at this, and how many doors you've already knocked on, changes what a good next step looks like.` | A's parallel structure without the commas; 'lleva con esto' as in rubric.contextItems.c_dur.q | `locale-delta.js` `added[2]` |
| `/locales/es/steps/story/intro` | `Algunas cosas sobre lo que ya se ha probado.` | `A few things about what's been tried already.` | B; 'probado' as in SUM.es.askTried 'Hemos probado' | `locale-delta.js` `added[3]` |
| `/locales/es/ui/forYouIf/0` | `Lleva meses con síntomas de senos nasales, presión en la cara, oídos o mareos.` | `You've had sinus, face-pressure, ear or dizziness symptoms for months.` | B; 'senos nasales, oídos o mareos' from locales.es ui.sub; 'presión en la cara' from steps.migraine.lede; 'lleva ... con' as in c_dur.q | `locale-delta.js` `added[4]` |
| `/locales/es/ui/forYouIf/1` | `Los tratamientos no le han dado alivio duradero, o sus estudios salieron normales y todavía se siente mal.` | `Treatments haven't held, or your scans came back normal and you still feel unwell.` | B; 'alivio duradero' from SUM.es.abx ('no me han dado alivio duradero'); 'estudios ... salieron normales' and 'me siento mal' from locales.es items.r_normal | `locale-delta.js` `added[4]` |
| `/locales/es/ui/forYouIf/2` | `Ha visto a más de un médico por esto.` | `You've seen more than one clinician about it.` | SUM.es.gap 'más de un médico por esto' (A=B) | `locale-delta.js` `added[4]` |
| `/locales/es/ui/clinicianLede` | `Síntomas reportados por el paciente, instrumento MASQUE v{instrument}. Auto-reportado y no es un resultado de tamizaje — no se calculó ningún índice. Los ítems marcados con **−** apuntan en contra del patrón migrañoso/neuropático.` | `Patient-reported features, MASQUE instrument v{instrument}. Self-reported and not a screening result — no index was calculated. Items marked **−** point away from the migrainous/neuropathic pattern.` | sentences 1-2 = SUM.es.clinNote byte-for-byte with ${v} -> {instrument}; sentence 3 new (A), verb from PATIENT_CHROME.es.txtClinNote 'apunta en contra del patrón' | `locale-delta.js` `added[5]` |
| `/locales/es/items/r_dur/clin` | `Síntomas persistentes o recurrentes > 3 meses` | `Symptoms persisting or recurring > 3 months` | A=B; new | `locale-delta.js` `added[6]` |
| `/locales/es/items/r_abx/clin` | `≥2 ciclos de antibióticos/esteroides sin alivio duradero` | `≥2 antibiotic/steroid courses without lasting relief` | A=B; 'ciclos de antibióticos o esteroides' from locales.es items.r_abx, 'alivio duradero' from SUM.es.abx | `locale-delta.js` `added[7]` |
| `/locales/es/items/r_surg/clin` | `Procedimiento previo de senos nasales sin resolución` | `Prior sinus procedure without resolution` | A=B; 'procedimiento de los senos nasales' as in SUM.es.surg | `locale-delta.js` `added[8]` |
| `/locales/es/items/r_lesion/clin` | `Mareos/síntomas del oído recurrentes, sin lesión estructural identificada` | `Recurrent dizziness/aural symptoms, no structural lesion found` | B; 'Los mareos o síntomas del oído' as in SUM.es.lesion and locales.es items.r_lesion | `locale-delta.js` `added[9]` |
| `/locales/es/items/r_normal/clin` | `Examen o estudios de imagen normales frente a la carga de síntomas` | `Exam or imaging normal relative to symptom burden` | A=B, with 'frente a' from the language review | `locale-delta.js` `added[10]` |
| `/locales/es/items/m_head/clin` | `Episodios recurrentes de dolor de cabeza / presión en el centro de la cara` | `Recurrent headache / mid-facial pressure episodes` | B; 'dolor de cabeza' as in every existing Spanish string (steps.migraine.title, SUM.es.headFreq) | `locale-delta.js` `added[11]` |
| `/locales/es/items/m_dur/clin` | `Duración del episodio sin tratamiento 4–72 h (ICHD-3 1.1 B)` | `Untreated attack duration 4–72 h (ICHD-3 1.1 B)` | A=B; 'episodio' as in locales.es items.m_dur and SUM.es.durTypical | `locale-delta.js` `added[12]` |
| `/locales/es/items/m_photo/clin` | `Fotofobia y/o fonofobia durante los episodios` | `Photophobia and/or phonophobia during episodes` | A; new | `locale-delta.js` `added[13]` |
| `/locales/es/items/m_nausea/clin` | `Náuseas con los episodios` | `Nausea with episodes` | A=B; 'náuseas' as in locales.es items.m_nausea | `locale-delta.js` `added[14]` |
| `/locales/es/items/m_disable/clin` | `Los episodios limitan la actividad habitual` | `Episodes limit normal activity` | A; new | `locale-delta.js` `added[15]` |
| `/locales/es/items/m_aura/clin` | `Aura visual o síntomas neurológicos transitorios` | `Visual aura or transient neurologic symptoms` | A=B; new | `locale-delta.js` `added[16]` |
| `/locales/es/items/m_trig/clin` | `Desencadenantes identificables (clima, sueño, comidas, hormonales)` | `Identifiable triggers (weather, sleep, meals, hormonal)` | A=B; new | `locale-delta.js` `added[17]` |
| `/locales/es/items/m_fhx/clin` | `Antecedentes personales o familiares de migraña` | `Personal or family history of migraine` | A=B; new | `locale-delta.js` `added[18]` |
| `/locales/es/items/v_vertigo/clin` | `Vértigo episódico 5 min – 72 h (Bárány VM B)` | `Episodic vertigo 5 min – 72 h (Bárány VM B)` | A=B; new | `locale-delta.js` `added[19]` |
| `/locales/es/items/v_count/clin` | `≥5 episodios vestibulares hasta la fecha (Bárány VM A)` | `≥5 vestibular episodes to date (Bárány VM A)` | A=B; new | `locale-delta.js` `added[20]` |
| `/locales/es/items/v_migfeat/clin` | `Características migrañosas en ≥50% de los episodios (Bárány VM C)` | `Migrainous features in ≥50% of episodes (Bárány VM C)` | A=B; new (figure written as in the English) | `locale-delta.js` `added[21]` |
| `/locales/es/items/v_motion/clin` | `Sensibilidad al movimiento / al movimiento visual` | `Motion / visual-motion sensitivity` | A=B; new | `locale-delta.js` `added[22]` |
| `/locales/es/items/v_aural/clin` | `Plenitud ótica o tinnitus fluctuantes con los episodios` | `Fluctuating aural fullness or tinnitus with episodes` | A; new | `locale-delta.js` `added[23]` |
| `/locales/es/items/v_head/clin` | `Intolerancia al movimiento de la cabeza o a los cambios de posición` | `Head-motion or positional intolerance` | B; 'cambiar de posición' as in locales.es items.v_head | `locale-delta.js` `added[24]` |
| `/locales/es/items/n_burn/clin` | `Sensaciones de ardor / hormigueo / punzadas en la cara, la boca o la garganta` | `Burning / tingling / shooting facial, oral or throat sensations` | A=B; wording of locales.es items.n_burn | `locale-delta.js` `added[25]` |
| `/locales/es/items/n_otalgia/clin` | `Dolor profundo de oído o garganta con examen del oído normal` | `Deep ear or throat pain with normal ear exam` | A=B; SUM.es.nWords.n_otalgia 'con examen del oído normal' ('hondo' -> clinical 'profundo') | `locale-delta.js` `added[26]` |
| `/locales/es/items/n_auto/clin` | `Síntomas autonómicos (sequedad de ojos/boca, ortostáticos, de sudoración, gastrointestinales)` | `Autonomic symptoms (sicca, orthostatic, sudomotor, GI)` | B; new | `locale-delta.js` `added[27]` |
| `/locales/es/items/n_viral/clin` | `Inicio después de una enfermedad viral` | `Onset following viral illness` | A=B; SUM.es.nWords.n_viral 'enfermedad viral' | `locale-delta.js` `added[28]` |
| `/locales/es/items/n_allo/clin` | `Sensibilidad desproporcionada en relación con el examen` | `Sensitivity out of proportion to exam` | B; new | `locale-delta.js` `added[29]` |
| `/locales/es/items/i_days/clin` | `Días afectados al mes` | `Days per month affected` | A=B; 'días al mes' as in locales.es items.i_days | `locale-delta.js` `added[30]` |
| `/locales/es/items/i_role/clin` | `Impacto en el trabajo o en las actividades diarias` | `Impact on work or daily roles` | B; 'Impacto en el trabajo' as in SUM.es.role | `locale-delta.js` `added[31]` |
| `/locales/es/items/x_purulent/clin` | `Secreción purulenta o cultivo positivo de senos nasales cuando hay síntomas` | `Purulent drainage or positive sinus culture when symptomatic` | B; 'senos nasales' per glossary | `locale-delta.js` `added[32]` |
| `/locales/es/items/x_objective/clin` | `Inflamación objetiva de senos nasales en endoscopia/tomografía cuando hay síntomas` | `Objective sinus inflammation on endoscopy/CT when symptomatic` | B; 'tomografía' as in locales.es items.x_objective.help ('reporte de tomografía') | `locale-delta.js` `added[33]` |
| `/locales/es/items/x_lowfreq/clin` | `Pérdida auditiva neurosensorial fluctuante en frecuencias bajas, por audiometría` | `Audiometric fluctuating low-frequency SNHL` | B, with the clinical review's 'en frecuencias bajas, por audiometría' | `locale-delta.js` `added[34]` |
| `/locales/es/items/x_anosmia/clin` | `Hiposmia persistente entre episodios` | `Persistent hyposmia between episodes` | A; new | `locale-delta.js` `added[35]` |

The 17 `PATIENT_CHROME.es` keys added by the same release. They are engine chrome, not module
data, so they live in `app/src/engine/patient.js` (appended after the baseline keys under a
comment naming release 0.4.2); `LOCALE_DELTA.chrome` records each key with its English and basis,
and the extractor checks that `PATIENT_CHROME.en[key]` equals the recorded English and that
`PATIENT_CHROME.es` carries the key. Before 0.4.2 these keys fell back to English under `es`.
`whatItIsnt` is the only new string that names a score ("puntuación", "riesgo"); it is rendered
inside the "What it isn't" box, which the omission scan excludes by `data-testid`, as it does for
the English.

| `PATIENT_CHROME.es` key | Spanish | English (`PATIENT_CHROME.en`) | Basis | Safety review first |
|---|---|---|---|---|
| `introHeading` | `Antes de su consulta` | `Before your appointment` | A=B; 'su consulta' as in PATIENT_CHROME.es.title 'Preparándose para su consulta' |  |
| `introLede` | `Esto toma unos cinco minutos. Al final recibe un resumen de una página que puede imprimir o mostrar en su teléfono — qué decir, qué preguntar y de qué no está seguro.` | `This takes about five minutes. At the end you get a one-page summary you can print or show on your phone — what to say, what to ask, and what you're unsure about.` | B; main clause reused from the Simulator's existing PQ.es.lede ('Al final recibe un resumen de una página que puede imprimir o mostrar en su teléfono.'); 'qué decir' as PATIENT_CHROME.es.sayThis; 'no está seguro' as unsure/notSure |  |
| `forYouIfTitle` | `Es para usted si` | `It's for you if` | A=B; new |  |
| `whatItIsntTitle` | `Lo que no es` | `What it isn't` | A=B; new |  |
| `whatItIsnt` | `No diagnostica nada y no le dirá qué tiene. No le da una puntuación ni un número de riesgo. Lo que sí hace es ayudarle a describir el patrón con exactitud, lo cual muchas veces es la parte que ha estado fallando.` | `It doesn't diagnose anything and it won't tell you what you have. It gives you no score and no risk number. What it does is help you describe the pattern accurately, which is often the part that's been going wrong.` | B ('lo cual' for the clause-level relative; A had 'que'); 'No diagnostica' as in txtFooter |  |
| `privacyNote` | `Todo se queda en su navegador. Nada se sube a internet, se guarda en una cuenta ni se comparte — el resumen solo sale de este dispositivo si usted lo imprime o lo descarga.` | `Everything stays in your browser. Nothing is uploaded, saved to an account, or shared — the summary only leaves this device if you print or download it yourself.` | B; 'imprime/descarga' match PATIENT_CHROME.es print/download ('Imprimir', 'Descargar') |  |
| `safetyHeading` | `Primero, una revisión de seguridad` | `First, a safety check` | A=B; PATIENT_CHROME.es.sections.safety 'Revisión de seguridad' | yes |
| `safetyLede` | `Algunos síntomas necesitan revisarse rápidamente, sin importar qué más esté pasando. Marque todo lo que sea cierto en su caso. Si nada es cierto en su caso, esa es la respuesta habitual.` | `A few symptoms need looking at quickly, whatever else is going on. Tick anything that's true for you. If none of them are, that's the common answer.` | A's 'rápidamente' and 'la respuesta habitual'; last sentence from the clinical review, mirroring 'cierto en su caso' in the sentence before | yes |
| `callNow` | `Por favor no espere` | `Please don't wait on this` | B; 'Por favor' without a comma and 'No espere' as in PATIENT_CHROME.es.tierNowWhat | yes |
| `callSoon` | `Vale la pena atender esto pronto` | `Worth moving this along` | B; 'Vale la pena' as in PATIENT_CHROME.es.notSureLede | yes |
| `carryOn` | `Puede continuar y terminar el resumen — esto aparecerá en la parte de arriba del resumen.` | `You can carry on and finish the summary — it'll include this at the top.` | A=B for the first clause; 'en la parte de arriba' from the language review | yes |
| `noneApply` | `Ninguno de estos es mi caso` | `None of these apply to me` | A (restored after clinical review); 'mi caso' echoes 'cierto en su caso' in chrome.safetyLede | yes |
| `summaryLede` | `Imprímalo o déjelo abierto en su teléfono. Entregarlo al principio de la consulta funciona mejor que tratar de recordarlo todo.` | `Print this, or keep it open on your phone. Handing it over at the start of the appointment works better than trying to remember it all.` | B; 'Imprimir' (PATIENT_CHROME.es.print), 'entregarlo' as in PATIENT_CHROME.es.thin, 'consulta' |  |
| `seenToday` | `Busque atención hoy` | `Get seen today` | PATIENT_CHROME.es.txtSeenToday '** BUSQUE ATENCIÓN HOY **' in sentence case (A=B) | yes |
| `seenWeek` | `Busque atención esta semana` | `Get seen this week` | PATIENT_CHROME.es.txtSeenWeek '** BUSQUE ATENCIÓN ESTA SEMANA **' in sentence case (A=B) | yes |
| `disclaimer` | `Este es un prototipo de investigación, no es consejo médico. No diagnostica. No ha sido validado en un estudio clínico. Si siente que algo no está bien, o si algo está empeorando, comuníquese con un médico, sin importar lo que diga esta página.` | `This is a research prototype and not medical advice. It doesn't diagnose, and it hasn't been validated in a clinical study. If something feels wrong or is getting worse, contact a clinician regardless of what this page says.` | B; sentences 1-2 = PATIENT_CHROME.es.txtFooter byte-for-byte ('prototipo de investigación, no es consejo médico. No diagnostica. No ha sido validado en un estudio clínico.') with 'Este es un' prefixed; sentence 3 new |  |
| `footer` | `Guía {name} v{appVersion} para el paciente · instrumento v{instrument} · prototipo de investigación · nada de lo que escriba sale de este dispositivo` | `{name} patient companion v{appVersion} · instrument v{instrument} · research prototype · nothing you type leaves this device` | merge: A's product name 'Guía para el paciente'; {name} placed as in the existing ui.sub 'Una herramienta MASQUE'; 'instrumento' from SUM.es.clinNote; 'prototipo de investigación' from txtFooter; B's subjunctive 'escriba' |  |

**Revised after the rendered-Spanish review, round 3 (2026-10-06).** A review of the Spanish as
rendered (screens, `.txt` and `.html` captures) changed three of these values, and the two short
markers below, as decisions of the release; the Basis column above stays the record's verbatim
basis, and the merged translation record (`es-final.json`) carries the new values with the note
"revised after rendered-Spanish review, round 3". All five wait for the reviewer like the rest
(item 12 below).

| Key | Before round 3 | Now | Why |
|---|---|---|---|
| `carryOn` | `Puede continuar y terminar el resumen — esto aparecerá en la parte de arriba.` | `Puede continuar y terminar el resumen — esto aparecerá en la parte de arriba del resumen.` | "la parte de arriba" had no owner; on screen the alert box itself sits at the top of the page. "del resumen" names it, as the English "it'll include this at the top" does. |
| `summaryLede` | `Imprímalo, o déjelo abierto en su teléfono. …` | `Imprímalo o déjelo abierto en su teléfono. …` (rest unchanged) | Spanish puts no comma before "o" in a simple two-way choice; the comma copied the English. |
| `footer` | `Guía {name} para el paciente v{appVersion} · …` | `Guía {name} v{appVersion} para el paciente · …` (rest unchanged) | "para el paciente v0.4.2" read as a versioned patient; the release now follows the name. Placeholders unchanged. |
| `CAVEATS.patient.edited.esShort` (engine) | `modificado localmente, sin revisar` | `cuestionario modificado localmente, sin revisar` | Without a noun the masculine participle read as a broken agreement after "Traducción sin revisar ·" (print header, `.html` header, patient footer). |
| `CAVEATS.patient.uploaded.esShort` (engine) | `cargado desde un archivo, sin revisar` | `cuestionario cargado desde un archivo, sin revisar` | The same. |

Declined in the same review: lower-casing the three "Es para usted si" bullets
(`locales.es.ui.forYouIf`). They stay capitalised, parallel with the English source, which
capitalises its bullets under "It's for you if" too; no delta row changed, so the rubric is
unchanged by round 3.

The engine-owned Spanish of release 0.4.2 is not module data either and is not in this file's
tables: the patient caveats (`CAVEATS.patient.edited`/`uploaded` `es` and `esShort`,
`CAVEATS.editedWording.es`, `CAVEATS.staleTranslation.es`) and the companion line
`CAVEATS.prototypeCompanion.es` ("Prototipo · no apto para uso clínico") in
`app/src/engine/policy.js`; the engine cards `UNAVAILABLE_NOTICE.es` and `SUMMARY_ERROR.es` in
`app/src/apps/PatientCompanion.jsx`; the patient-mode lines `PATIENT_MODE_TEXT.es` in
`app/src/shell/ScreenAIr.jsx`; and the footer line `PATIENT_FOOTER_TEXT.es` in
`app/src/shell/chrome.jsx`. They come from the same merged translation record and carry the same
status (unreviewed). The validator's V38 bans every one of them, and the bare phrase "no apto para
uso clínico", from module data; it compares both sides after canonical decomposition with the
accents removed and lower-cased, so a caveat typed without its accents ("uso clinico") is caught
too, in either language.

**Awaiting the bilingual clinical reviewer** (items 1-10 restate the review flags of the
translation record, none of which this release resolves; items 11-12 come from the release's own
verification and its round-3 revision):

1. Safety: `noneApply` ("Ninguno de estos es mi caso") and `safetyLede` ("Si nada es cierto en
   su caso") were changed after the clinical review so that they carry no tense, so that a patient
   whose thunderclap headache, sudden hearing drop or weight loss has already passed does not
   dismiss the screen. Confirm that a Spanish-speaking patient would not read either as "not
   happening right now".
2. Urgency of the safety headings: `callNow` "Por favor no espere" and `callSoon` "Vale la pena
   atender esto pronto" ("Worth moving this along"). Check that `callSoon` neither raises nor
   lowers the "Esta semana" tier, and that `callNow` matches "Hoy" without going beyond it.
3. Safety: `carryOn` "esto aparecerá en la parte de arriba del resumen" (position, not time;
   "del resumen" added in round 3, see above), and the third
   sentence of `disclaimer`, which keeps "o si algo está empeorando" as its own condition and the
   unconditional "comuníquese con un médico, sin importar lo que diga esta página".
4. The patient-mode return dialog body (`PATIENT_MODE_TEXT.es.returnDialog.body`): the omission
   rule forces "scores" → "resultados de tamizaje", a small change of meaning. Confirm it still
   tells the patient the view is not for them.
5. The product name "Guía para el paciente" for "Patient Companion" (`footer`, the
   `UNAVAILABLE_NOTICE` card and the patient-mode microphone toast), including the footer order
   "Guía {name} para el paciente". If the lead prefers another name or the English brand, only
   these three strings change. (Round 3 moved the release in the footer: "Guía {name}
   v{appVersion} para el paciente".)
6. Negative discriminators and mismatch items, which drive the **−** reading: `x_lowfreq` ("en
   frecuencias bajas, por audiometría"), `x_objective` ("tomografía" for CT), `x_purulent`
   ("cuando hay síntomas"), `r_normal` ("frente a la carga de síntomas"). Check clinical
   precision.
7. Clinician lines where a standard term was replaced or spelled out: `m_head` "dolor de cabeza"
   (not "cefalea"), `n_auto` (sicca, sudomotor and GI spelled out), `v_aural` ("plenitud ótica",
   "tinnitus" rather than "acúfenos"), `i_role` ("actividades diarias"; the alternative is
   "funciones diarias").
8. `ui.clinicianLede`: sentences 1-2 are `SUM.es.clinNote` byte for byte; sentence 3 ("Los ítems
   marcados con **−** apuntan en contra del patrón migrañoso/neuropático") is new. It is the only
   new string that names MASQUE, as the English module data does.
9. A wiring decision for the lead: the baseline Patient (`MASQUE_Patient_v0_3.jsx` L1116-1118)
   says the clinician block "stays in clinical English regardless of locale". Release 0.4.2
   translates the 30 clinician lines and shows them under `es`, because the request was for a
   complete translation. Reversing it needs no engine change: without `clin` the block falls
   back to the English `patientClin`.
10. All 82 strings of the record are new and unreviewed. The "Traducción sin revisar" banner
    applies until a bilingual clinician signs off; only then may `locales.es.reviewed` become
    `true` (the `values` suite pins it to `false` until that decision is recorded).
11. Wording points raised by the release's verification (2026-10-06). Two were resolved in round 3
    (above); the rest are left unchanged until this reviewer decides:
    - Resolved in round 3: `footer` (the release number read as if it belonged to "el paciente";
      now "Guía {name} v{appVersion} para el paciente · …") and the short markers (now
      "cuestionario modificado localmente, sin revisar" / "cuestionario cargado desde un archivo,
      sin revisar").
    - The patient footer's version line (`PATIENT_FOOTER_TEXT.es`): "versión {appVersion}" does
      not name the axis as the English "release" does, and sits under the companion footer that
      prints the same numbers as "v…"; "versión de la aplicación" was suggested.
    - `callNow` "Por favor no espere" (safety, item 2): standard punctuation puts a comma after a
      leading "Por favor", and the heading repeats "Por favor" and "no espere" from the baseline
      body under it (`tierNowWhat`, unchanged byte for byte).
    - Repetitions: `safetyLede` repeats "en su caso" in consecutive sentences (wording chosen in
      the clinical review, item 1), and `UNAVAILABLE_NOTICE.es` repeats "este módulo".

12. The five values changed in round 3 (`carryOn`, `summaryLede`, `footer`, and the two
    `esShort` markers; table above). They were changed by the team after the rendered-Spanish
    review, not by this reviewer; `carryOn` is a safety string (item 3).

Also for the reviewer, outside the 82 strings (baseline Spanish, which this release does not
reword because existing Spanish stays byte for byte; changing any of it is the reviewer's
decision, made together with the pins that hold it):

- The existing Spanish uses masculine generics ("No estoy seguro", "el paciente") and mixes
  registers.
- Composed baseline `SUM.es` phrases read ungrammatically when many items are endorsed: a list
  mixes noun phrases, a finite verb and a "que" clause, for example "Síntomas de los nervios:
  ardor u hormigueo en la cara, la boca o la garganta, dolor hondo de oído o garganta con examen
  del oído normal, resequedad, mareo al pararme, o cambios del estómago, empezó después de una
  enfermedad viral y que un roce suave duela más de lo normal." (`SUM.es.nWords`; also `vWords`,
  `vAlso` "También mover la cabeza o cambiar de posición.", `migWords`, and `days` "Esto me afecta
  4 a 9 días al mes." without "de").
- Voice and register mismatches across the composed summary: "Cosas de las que no estoy seguro"
  (first person) lists questions in the usted voice ("¿Cuántos días al mes le afecta esto?"), as
  the English mixes "I" and "you"; the `.txt` label "Decir:" (`txtSay`) against "Qué decir" on
  screen and in the `.html` (`sayThis`); the `.txt` prints `clinNote` and then the near-identical
  `txtClinNote`.
- "Auto-reportado" (baseline `SUM.es.clinNote`, copied byte for byte into the new
  `ui.clinicianLede`) neither agrees with the plural "Síntomas" nor follows RAE spelling
  ("autorreportados"). It is a joint change for the reviewer: `clinNote` (in `masque.logic.js`,
  whose SHA-256 every derived module pins), `ui.clinicianLede` (the delta row) and
  `PATIENT_CHROME.es.txtClinNote` ("Auto-reportado;") together, so the `.txt` and the `.html` keep
  agreeing; fixing only the lede would make them disagree.

**For the clinical lead** (baseline summary logic, not translation; `masque.logic.js` must not be
edited in this release): a clinician line shows "+" (supports the criterion) next to a bracketed
scale option that lies outside the criterion's window, in both locales. Examples: `m_dur` "Menos
de 4 horas" gives "+ Duración del episodio sin tratamiento 4–72 h (ICHD-3 1.1 B) [Menos de 4
horas]" (English "[Less than 4 hours]"), and "Más de 3 días" likewise; `v_vertigo` "Menos de 5
minutos" or "Más de 3 días" gives "+ Vértigo episódico 5 min – 72 h (Bárány VM B) […]". The
translation did not cause it: the English renders the same way.

`format` and `contractVersion` come from `engine/contract.js` (`FORMAT.rubric`,
`CONTRACT_VERSION`). `lexicon.lang` and the `research.population` paths, which §9.2 allows to be
typed, are read from the baseline instead (Voice L47, Pop L31-33). `defaultLocale` is left out, so
it takes its default, `"en"`. The registry `docs` list is in `modules/registry.json`, not in the
rubric.

### EMR template data (release 0.4.3, signed off by the clinical lead in 0.4.4)

These values are typed once, in `app/tests/harness/emr-delta.js` (`EMR_DELTA`), not in `HAND`.
`extract-rubric.js` builds the rubric without them (`rubric0`) and then inserts `EMR_DELTA.value`
as the top-level key `emrTemplate`, just before `changelog`, with `applyEmrDelta`.
`applyEmrDelta` refuses a key that already exists, so nothing existing can be overwritten.
`revertEmrDelta` must then give back `rubric0` exactly, key order included. The `emr-template`
change-log entry follows the `translation` entry, and since release 0.4.4 the `sign-off` entry
follows it. The extractor's nine EMR checks:

1. `drafted.reviewed` is `true` only together with a complete clinical-lead `signOff` record (by,
   date, scope, channel), and a delta that is not reviewed carries none (until release 0.4.4: the
   delta is not reviewed);
2. the revert is exact;
3. every citation key named exists;
4. all 35 citations are used;
5. every red flag, item, probe and routing rule (from `masque.logic.js`), answer value, probe
   option and phenotype named exists, and every exam row names an exam-kind probe; since review
   round 2 also that every `instrumentRecs` rule has fixed chips on every surface, that each item
   signal's render matches its answer's polarity, that no history row carries citations, that a
   history qualifier sits on an item row, and that `onlyWithSignal` is a boolean on a row with
   signals;
6. every citation has a title, publisher, citation, https URL and accessed date;
7. no string carries `[ ] { }`;
8. there is exactly one basis per entry;
9. the sign-off change-log entry (kind `sign-off`, dated as the sign-off, paths `/emrTemplate`) is
   there exactly when the delta is signed off, as the last entry, right after the `emr-template`
   entry (release 0.4.4).

**Who made it, and its status.** Requested by the user on 2026-10-06 ("EMR Friendly Template" in
the Clinician Screener and the Ambient Scribe). AI agents assembled it from the verified citation
register: citation verification, the content basis and the implementation. Only sources with
status `verified` or `corrected` are used. It was not written by the clinical lead. **The clinical
lead signed it off on 2026-10-07**, in chat, and release 0.4.4 records the sign-off:
`EMR_DELTA.signOff` = {by: "clinical lead", date: "2026-10-07", scope: "emrTemplate content and
the generated note as implemented in release 0.4.3 (decisions D1-D16, review rounds 1-4)",
channel: "chat"}, and `EMR_DELTA.drafted.reviewed` is `true`. The generator refuses `true` without a
complete sign-off record. Until then `reviewed` was `false` and decisions D1-D16 (`CHANGELOG.md`,
release 0.4.3) awaited the lead. The template it feeds is a prototype aid for drafting a note, not
a clinical document.

**Sign-off status of every string in this section.** Every `emrTemplate` string listed below is
covered by the clinical lead's sign-off of 2026-10-07. That is all 35 citation records, the
reference rows, the instrument-recs list, the red-flag references and placeholder, the history
rows, the checklist rows and the exam rows: 97 entries, each with its basis. Their status is
**signed off 2026-10-07 (release 0.4.4)**. No string is left out, and none was signed off on its
own. The strings are those release 0.4.3 shipped, unchanged: the `values` suite pins the block's
SHA-256 (`fb63a2b9…`), so any later change to a string, a row or a citation falls outside
this sign-off and fails there until a new one is recorded. The sign-off does not cover the
Spanish translation (its rows above stay unreviewed). The follow-ups `CHANGELOG.md` lists for
release 0.4.4 stay known limitations, accepted at sign-off unless the lead asks for changes.

**Cite and link only.** A citation is metadata and a link: title, publisher, citation, https URL
and accessed date. No guideline text is pasted or paraphrased. AAFP, AAO-HNSF (entnet.org: "No
External Use or Transfer (Including AI-Based Technologies)") and AAN terms forbid it. No agent,
dose, threshold or duration is stored. The labels are short therapy-class, exam or section names,
each with the citation keys it rests on (decision D1). No string carries `[`, `]`, `{` or `}`
(V61 error): the engine adds every placeholder.

**Reading the Basis column.** It is `EMR_DELTA.basis`, verbatim: one entry per citation,
reference, the instrument-recs list, red-flag list, red-flag placeholder, history row, checklist
row and exam row (97 since review round 3). The letters are the content basis's source classes:

| Letter | Source class |
|---|---|
| C | Verified citation |
| N | New short label from a cited source (D1) |
| M | Module text the label rests on |
| S | Structural heading |
| P | Placeholder heading |

"emr-basis §n" is a section of the release's content basis, a working document that is not in
the repository. Its substance is recorded here and in `CHANGELOG.md`.

**Citations** (`/emrTemplate/citations/<key>`; 35 records, every one `accessed: "2026-10-06"`,
and every Basis entry reads "citation and link only"). The status is the citation verifier's.
"Corrected" means the verifier fixed a detail of the citation as first proposed (an ID, a URL,
an attribution, a scope or a caveat) and the corrected form is the one stored.

| Key | `title` | `publisher` | `citation` | `url` | Status |
|---|---|---|---|---|---|
| `AAN26` | Pharmacologic Treatment for Migraine Prevention in Adults Practice Guideline Recommendations: Report of the AAN Guidelines Subcommittee and the American Headache Society | American Academy of Neurology / American Headache Society (endorsed by AAFP) | Potrebic S, Tanveer S, Becker WJ, et al. Pharmacologic Treatment for Migraine Prevention in Adults Practice Guideline Recommendations: Report of the AAN Guidelines Subcommittee and the American Headache Society. Neurology. 2026;107(7):e214881. | https://www.aan.com/Guidelines/Home/GuidelineDetail/1158 | corrected |
| `AFP-PROPH25` | Migraine Headache Prophylaxis | American Academy of Family Physicians (American Family Physician) | Moreland P, Gaffney B, Lanham JS. Migraine Headache Prophylaxis. Am Fam Physician. 2025;111(5):443-450. | https://www.aafp.org/afp/2025/0500/migraine-headache-prophylaxis | verified |
| `AFP-ACUTE25` | Acute Migraine Headache: Treatment Strategies | American Academy of Family Physicians (American Family Physician) | Wiley AT, Watson JC, Lehmann DN. Acute Migraine Headache: Treatment Strategies. Am Fam Physician. 2025;111(4):317-327 (updated 2026-04-02). | https://www.aafp.org/afp/2025/0400/acute-migraine-headache | corrected |
| `AFP-IHSACUTE26` | Acute Migraine Treatment: Guidelines From the International Headache Society | American Family Physician (summary of International Headache Society guidance) | Arnold MJ. Acute Migraine Treatment: Guidelines From the International Headache Society. Am Fam Physician. 2026;113(2):196-198. | https://www.aafp.org/afp/2026/0200/practice-guidelines-acute-migraine-treatment | verified |
| `AFP-DIZZ23` | Dizziness: Evaluation and Management | American Academy of Family Physicians (American Family Physician) | Rogers TS, Noel MA, Garcia B. Dizziness: Evaluation and Management. Am Fam Physician. 2023;107(5):514-523. | https://www.aafp.org/afp/2023/0500/dizziness | corrected |
| `COCH-VMPROPH23` | Pharmacological interventions for prophylaxis of vestibular migraine | Cochrane (Cochrane ENT) | Webster K, Dor A, Galbraith K, et al. Pharmacological interventions for prophylaxis of vestibular migraine. Cochrane Database Syst Rev. 2023;4(4):CD015187. | https://pmc.ncbi.nlm.nih.gov/articles/PMC10093999/ | verified |
| `COCH-VMACUTE23` | Pharmacological interventions for acute attacks of vestibular migraine | Cochrane (Cochrane ENT) | Webster KE, Dor A, Galbraith K, et al. Pharmacological interventions for acute attacks of vestibular migraine. Cochrane Database Syst Rev. 2023;4(4):CD015322. | https://pmc.ncbi.nlm.nih.gov/articles/PMC10097606/ | corrected |
| `BARANY22` | Vestibular migraine: Diagnostic criteria (Update). Literature update 2021: consensus document of the Bárány Society and the International Headache Society | Bárány Society / International Headache Society | Lempert T, Olesen J, Furman J, et al. Vestibular migraine: Diagnostic criteria (Update). J Vestib Res. 2022;32(1):1-6. | https://pmc.ncbi.nlm.nih.gov/articles/PMC9249276/ | verified |
| `ACR-HA22` | ACR Appropriateness Criteria: Headache (2022 Update) | American College of Radiology | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Headache (2022 Update). J Am Coll Radiol. 2023;20(5S):S70-S93. | https://acsearch.acr.org/docs/69482/Narrative/ | verified |
| `AFP-HA22` | Acute Headache in Adults: A Diagnostic Approach | American Academy of Family Physicians (American Family Physician) | Viera AJ, Antono B. Acute Headache in Adults: A Diagnostic Approach. Am Fam Physician. 2022;106(3):260-268. | https://www.aafp.org/afp/2022/0900/acute-headache-adults | verified |
| `ACR-STROKE23` | ACR Appropriateness Criteria: Cerebrovascular Diseases-Stroke and Stroke-Related Conditions | American College of Radiology | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Cerebrovascular Diseases-Stroke and Stroke-Related Conditions. J Am Coll Radiol. 2024;21(6S):S21-S64. | https://acsearch.acr.org/docs/3149012/Narrative/ | verified |
| `AHA26` | 2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke | American Heart Association / American Stroke Association | Prabhakaran S, Gonzalez NR, Zachrison KS, et al. 2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke. Stroke. 2026;57(8):e316-e436. | https://doi.org/10.1161/STR.0000000000000513 | verified |
| `GRACE3-23` | Guidelines for reasonable and appropriate care in the emergency department 3 (GRACE-3): Acute dizziness and vertigo in the emergency department | Society for Academic Emergency Medicine | Edlow JA, Carpenter C, Akhter M, et al. Guidelines for reasonable and appropriate care in the emergency department 3 (GRACE-3): Acute dizziness and vertigo in the emergency department. Acad Emerg Med. 2023;30(5):442-486. | https://doi.org/10.1111/acem.14728 | verified |
| `IIH18` | Idiopathic intracranial hypertension: consensus guidelines on management | UK IIH specialist interest group (with consultation of ABN, SBNS, RCOphth, BASH) | Mollan SP, Davies B, Silver NC, et al. Idiopathic intracranial hypertension: consensus guidelines on management. J Neurol Neurosurg Psychiatry. 2018;89(10):1088-1100. | https://pmc.ncbi.nlm.nih.gov/articles/PMC6166610/ | verified |
| `AFP-VISION25` | Sudden Vision Loss: A Diagnostic Approach | American Academy of Family Physicians (American Family Physician) | Fraser JA, Son M, Vinokurtseva A. Sudden Vision Loss: A Diagnostic Approach. Am Fam Physician. 2025;111(1):54-61. | https://www.aafp.org/afp/2025/0100/sudden-vision-loss | verified |
| `AFP-GCA22` | Polymyalgia Rheumatica and Giant Cell Arteritis: Rapid Evidence Review | American Academy of Family Physicians (American Family Physician) | Raleigh MF, Stoddard J, Darrow HJ. Polymyalgia Rheumatica and Giant Cell Arteritis: Rapid Evidence Review. Am Fam Physician. 2022;106(4):420-426. | https://www.aafp.org/afp/2022/1000/polymyalgia-rheumatica-giant-cell-arteritis | verified |
| `ACR-GCA21` | 2021 American College of Rheumatology/Vasculitis Foundation Guideline for the Management of Giant Cell Arteritis and Takayasu Arteritis | American College of Rheumatology / Vasculitis Foundation | Maz M, Chung SA, Abril A, et al. 2021 American College of Rheumatology/Vasculitis Foundation Guideline for the Management of Giant Cell Arteritis and Takayasu Arteritis. Arthritis Rheumatol. 2021;73(8):1349-1365. | https://pmc.ncbi.nlm.nih.gov/articles/PMC12344528/ | verified |
| `ACR-SINO21` | ACR Appropriateness Criteria: Sinonasal Disease (2021 Update) | American College of Radiology | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Sinonasal Disease (2021 Update). J Am Coll Radiol. 2022;19(5S):S175-S193. | https://acsearch.acr.org/docs/69502/Narrative/ | verified |
| `AFP-HL19` | Hearing Loss in Adults: Differential Diagnosis and Treatment | American Academy of Family Physicians (American Family Physician) | Michels TC, Duffy MT, Rogers DJ. Hearing Loss in Adults: Differential Diagnosis and Treatment. Am Fam Physician. 2019;100(2):98-108. | https://www.aafp.org/afp/2019/0715/p98 | verified |
| `ACR-HLV18` | ACR Appropriateness Criteria: Hearing Loss and/or Vertigo | American College of Radiology | Expert Panel on Neurologic Imaging. ACR Appropriateness Criteria: Hearing Loss and/or Vertigo. J Am Coll Radiol. 2018;15(11S):S321-S331. | https://acsearch.acr.org/docs/69488/Narrative/ | verified |
| `ACR-TINN23` | ACR Appropriateness Criteria: Tinnitus (2023 Update) | American College of Radiology | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Tinnitus (2023 Update). J Am Coll Radiol. 2023;20(11S):S574-S591. | https://acsearch.acr.org/docs/3094199/Narrative | verified |
| `AFP-TINN21` | Tinnitus: Diagnosis and Management | American Academy of Family Physicians (American Family Physician) | Dalrymple SN, Lewis SH, Philman S. Tinnitus: Diagnosis and Management. Am Fam Physician. 2021;103(11):663-671. | https://www.aafp.org/afp/2021/0601/p663 | verified |
| `AAO-TINN14` | Clinical Practice Guideline: Tinnitus | American Academy of Otolaryngology–Head and Neck Surgery Foundation | Tunkel DE, Bauer CA, Sun GH, et al. Clinical Practice Guideline: Tinnitus. Otolaryngol Head Neck Surg. 2014;151(2 Suppl):S1-S40. | https://doi.org/10.1177/0194599814545325 | verified |
| `NICE-CG150` | Headaches in over 12s: diagnosis and management (CG150) | National Institute for Health and Care Excellence (NICE, UK) | NICE. Headaches in over 12s: diagnosis and management (CG150). Published 2012-09-19; last updated 2025-06-03. | https://www.nice.org.uk/guidance/cg150/chapter/Recommendations | corrected |
| `SNNOOP10` | Red and orange flags for secondary headaches in clinical practice: SNNOOP10 list | Neurology (AAN journal); a narrative review, not an AAN guideline or position | Do TP, Remmers A, Schytz HW, et al. Red and orange flags for secondary headaches in clinical practice: SNNOOP10 list. Neurology. 2019;92(3):134-144 (narrative review). | https://pmc.ncbi.nlm.nih.gov/articles/PMC6340385/ | corrected |
| `ACR-CN22` | ACR Appropriateness Criteria: Cranial Neuropathy (2022 Update) | American College of Radiology | Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Cranial Neuropathy (2022 Update). J Am Coll Radiol. 2022;19(11S):S266-S303. | https://acsearch.acr.org/docs/69509/Narrative | verified |
| `AFP-AR23` | Allergic Rhinitis: Rapid Evidence Review | American Academy of Family Physicians (American Family Physician) | Weaver-Agostoni J, Kosak Z, Bartlett S. Allergic Rhinitis: Rapid Evidence Review. Am Fam Physician. 2023;107(5):466-473. | https://www.aafp.org/afp/2023/0500/allergic-rhinitis | corrected |
| `AAO-AR15` | Clinical Practice Guideline: Allergic Rhinitis | American Academy of Otolaryngology–Head and Neck Surgery Foundation | Seidman MD, Gurgel RK, Lin SY, et al. Clinical Practice Guideline: Allergic Rhinitis. Otolaryngol Head Neck Surg. 2015;152(1 Suppl):S1-S43. | https://doi.org/10.1177/0194599814561600 | verified |
| `JTF-RHIN20` | Rhinitis 2020: A practice parameter update | AAAAI/ACAAI Joint Task Force on Practice Parameters | Dykewicz MS, Wallace DV, Amrol DJ, et al. Rhinitis 2020: A practice parameter update. J Allergy Clin Immunol. 2020;146(4):721-767. | https://doi.org/10.1016/j.jaci.2020.07.007 | verified |
| `ICAR-AR23` | International consensus statement on allergy and rhinology: Allergic rhinitis – 2023 | International Forum of Allergy & Rhinology (ARS/AAOA); synopsis in an AAAAI journal | Wise SK, et al. International consensus statement on allergy and rhinology: Allergic rhinitis – 2023. Int Forum Allergy Rhinol. 2023;13(4):293-859. Synopsis: J Allergy Clin Immunol Pract. 2023;11(3):773-796. | https://doi.org/10.1002/alr.23090 | verified |
| `AAO-SIN25` | Clinical Practice Guideline: Adult Sinusitis Update | American Academy of Otolaryngology–Head and Neck Surgery Foundation | Payne SC, McKenna M, Buckley J, et al. Clinical Practice Guideline: Adult Sinusitis Update. Otolaryngol Head Neck Surg. 2025;173 Suppl 1:S1-S56. | https://doi.org/10.1002/ohn.1344 | verified |
| `AFP-CRS23` | Chronic Rhinosinusitis | American Academy of Family Physicians (American Family Physician) | Keating MK, Phillips JC, Phillips J. Chronic Rhinosinusitis. Am Fam Physician. 2023;108(4):370-377. | https://www.aafp.org/afp/2023/1000/chronic-rhinosinusitis | corrected |
| `AAO-CRSSURG25` | Clinical Practice Guideline: Surgical Management of Chronic Rhinosinusitis | American Academy of Otolaryngology–Head and Neck Surgery Foundation | Shin JJ, Wilson M, McKenna M, et al. Clinical Practice Guideline: Surgical Management of Chronic Rhinosinusitis. Otolaryngol Head Neck Surg. 2025;172 Suppl 2:S1-S47. | https://doi.org/10.1002/ohn.1287 | verified |
| `AAO-BPPV17` | Clinical Practice Guideline: Benign Paroxysmal Positional Vertigo (Update) | American Academy of Otolaryngology–Head and Neck Surgery Foundation | Bhattacharyya N, Gubbels SP, Schwartz SR, et al. Clinical Practice Guideline: Benign Paroxysmal Positional Vertigo (Update). Otolaryngol Head Neck Surg. 2017;156(3_suppl):S1-S47. | https://doi.org/10.1177/0194599816689667 | verified |
| `AAO-SSNHL19` | Clinical Practice Guideline: Sudden Hearing Loss (Update) | American Academy of Otolaryngology–Head and Neck Surgery Foundation | Chandrasekhar SS, Tsai Do BS, Schwartz SR, et al. Clinical Practice Guideline: Sudden Hearing Loss (Update). Otolaryngol Head Neck Surg. 2019;161(1_suppl):S1-S45. | https://doi.org/10.1177/0194599819859885 | corrected |

Two records, since review rounds 1 and 3:

- **AFP-ARS25 is no longer carried.** It was cited only under `rf_orbital` ("Emergency ENT and
  imaging"), and the verifier could not find "CT and ENT referral for recurrence or
  complications" in its accessible text (content basis §3: "Do not cite AFP-ARS25 for 'CT and
  ENT referral'"). A Ref line directly under that action read as its source, so the key was
  dropped from `rf_orbital` and from the register (V61 requires every carried citation to be
  used). ACR-SINO21 stays.
- **AHA26 links to the register's DOI** (review round 3). Until round 3 the stored URL was the
  PubMed record https://pubmed.ncbi.nlm.nih.gov/41582814/, which the content basis (§7 risk 2,
  §9) offered as a fallback for DOI-only sources; the verified register's own URL is
  https://doi.org/10.1161/STR.0000000000000513. Every other DOI-only source already stored its
  DOI, so AHA26 was the one exception. Now every stored URL is the register's, exactly. The
  publisher's pages return 403 to automated checks, not to readers.

**Empiric-treatment references** (`/emrTemplate/references`). They are printed only while the
referral gate is open (D4). A `label` row prints `- <label>: <citation> <url>`; the `note` row
prints `- <note>` followed by one `Ref:` line per key.

| Pointer | String | Citation keys | Shown for | Basis (EMR_DELTA.basis, verbatim) |
|---|---|---|---|---|
| `/emrTemplate/references/0/label` | `Migraine prevention guideline — AAN/AHS (endorsed by AAFP), 2026` | AAN26 | every picture | N label + C AAN26 (emr-basis §2.10d; D4, D15): AAN/AHS 2026, endorsed by AAFP; listed first as the current prevention guideline (fixer round 1) |
| `/emrTemplate/references/1/label` | `Migraine prophylaxis — American Family Physician (AAFP journal), 2025; predates AAN/AHS 2026` | AFP-PROPH25 | every picture | N label + C AFP-PROPH25 (emr-basis §2.10d; D4, D15): the AAFP journal page the user asked for; labelled as an American Family Physician review, not AAFP policy, and as predating AAN/AHS 2026 (verifier caveat; fixer round 1) |
| `/emrTemplate/references/2/label` | `Acute (abortive) migraine treatment — American Family Physician (AAFP journal), 2025` | AFP-ACUTE25 | every picture | N label + C AFP-ACUTE25 (emr-basis §2.10d; D4): acute (abortive) treatment; labelled as an American Family Physician review (fixer round 1) |
| `/emrTemplate/references/3/label` | `Acute treatment (IHS recommendations, summarized in AFP 2026)` | AFP-IHSACUTE26 | every picture | N label + C AFP-IHSACUTE26 (emr-basis §2.10d; D4, optional, included): attributed to IHS, summarized in AFP |
| `/emrTemplate/references/4/label` | `Dizziness and vestibular migraine — American Family Physician (AAFP journal), 2023` | AFP-DIZZ23 | otologic, both | N label + C AFP-DIZZ23 (emr-basis §2.10d; D4): shown for the otologic and both pictures; labelled as an American Family Physician review (fixer round 1) |
| `/emrTemplate/references/5/note` | `Vestibular migraine: no consensus treatment; drug evidence low or very-low certainty.` | AFP-DIZZ23, COCH-VMPROPH23, COCH-VMACUTE23, BARANY22 | otologic, both | N (D1): the VM empiric line, from AFP-DIZZ23 (no consensus treatment), COCH-VMPROPH23 and COCH-VMACUTE23 (low or very-low certainty, as the line now says: fixer round 1), BARANY22 §4.10 (emr-basis §2.10d); shown for the otologic and both pictures |

**Instrument recommendations** (`/emrTemplate/instrumentRecs`; review round 1). The routing rules
whose chips are all confirmatory instruments. Their chips print as `  Instruments: a; b`. Other
fixed chips print as `  Named on screen: a; b`; chips a rule computes from the answers are not
repeated. The ids are checked against `masque.logic.js` routing (V61, logic half).

| Pointer | Value | Basis |
|---|---|---|
| `/emrTemplate/instrumentRecs` | `sinus_migraine, vestibular_migraine, tinnitus` | S scope (fixer round 1): the routing recommendations whose chips are all confirmatory instruments (masque.logic.js chips SNOT-22, ID Migraine, HIT-6, MIDAS; VM-PATHI, DHI, MIDAS; THI, TFI) print them under the label Instruments; neuro_overlay (its Screener chips add the referral Neurology) and competing (chips cut from rule-out item text) are left out |

**Red-flag references** (`/emrTemplate/redFlagRefs`). Each holds keys only. They are printed as
`Ref:` lines under the flag's module action, which is read from `redFlags` and never restated
here (D5).

| Flag (module action, read from `redFlags`) | Citation keys | Basis |
|---|---|---|
| `rf_thunderclap` (Emergency imaging today) | ACR-HA22, AFP-HA22 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V1), AFP-HA22; ACEP19 background only, not printed |
| `rf_focal` (Emergency neurologic evaluation) | ACR-STROKE23, AHA26, GRACE3-23 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-STROKE23 (V2), AHA26 (governing guideline only), GRACE3-23 |
| `rf_vision` (Same-day fundoscopy and neuro-imaging) | ACR-HA22, IIH18, ACR-STROKE23, AFP-VISION25 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V4), IIH18, ACR-STROKE23 (V7), AFP-VISION25 |
| `rf_gca` (Same-day ESR/CRP and rheumatology — do not wait for biopsy) | AFP-GCA22, ACR-GCA21, AFP-VISION25 | C (D5: module action + Ref only, no cited additions): emr-basis §3: AFP-GCA22, ACR-GCA21, AFP-VISION25 |
| `rf_orbital` (Emergency ENT and imaging) | ACR-SINO21 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-SINO21 (V2, V4); AFP-ARS25 dropped (fixer round 1): its accessible text does not support the action Emergency ENT and imaging (verifier caveat), and a Ref line under the action would read as its source |
| `rf_ssnhl` (Same-day audiogram) | AFP-HL19, ACR-HLV18 | C (D5: module action + Ref only, no cited additions): emr-basis §3: AFP-HL19, ACR-HLV18 (V3); AAO-SSNHL19 dropped here (fixer round 1) because emr-basis §3 says not to attribute same-day to AAO-HNSF (it gives audiometry within 14 days; it stays the examRows/5 citation). AFP-HL19 does not give same-day either (audiometry plus otolaryngology within one week): it is kept, like every Ref line, only under the line saying Ref lines are background reading, not the source of an action or its timing; the lead chooses one rule for both (fixer round 3) |
| `rf_asym` (MRI internal auditory canals) | ACR-HLV18, ACR-TINN23, AFP-HL19, AFP-TINN21, AAO-TINN14 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HLV18 (V3), ACR-TINN23 (V3), AFP-HL19, AFP-TINN21, AAO-TINN14 |
| `rf_pulsatile` (Vascular imaging) | ACR-TINN23, AFP-TINN21, ACR-HA22 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-TINN23 (V1), AFP-TINN21, ACR-HA22 (V4) |
| `rf_progressive` (Neuro-imaging) | ACR-HA22, NICE-CG150, SNNOOP10 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V7; V5 positional), NICE-CG150 1.1.1 (UK), SNNOOP10 (review) |
| `rf_new50` (Neuro-imaging and inflammatory markers) | ACR-HA22, AFP-HA22, AFP-GCA22 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V7), AFP-HA22, AFP-GCA22 |
| `rf_mass` (Endoscopy and cross-sectional imaging) | ACR-SINO21, ACR-CN22 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-SINO21 (V5), ACR-CN22 (V2) |
| `rf_systemic` (Directed workup before symptomatic management) | ACR-HA22, NICE-CG150 | C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V7, imaging only), NICE-CG150 1.1.2 (UK) |

Since review round 1 a structural line precedes the red-flag actions whenever one of them prints a
reference: "Actions are the module's own wording; Ref lines are background reading, not the source
of an action or its timing." `rf_ssnhl` no longer cites AAO-SSNHL19, which gives audiometry
within 14 days, not same-day (content basis §3: "Do not attribute 'same-day' to AAO-HNSF"); the
module's "Same-day audiogram" stays, unattributed. AAO-SSNHL19 is still cited by the Weber / Rinne
exam row. Review round 3 corrected the reason recorded here: AFP-HL19, which stays, gives
audiometry plus otolaryngology within one week, not same-day either. It is kept only under the
line above (Ref lines are not the source of an action or its timing), and the lead should choose
one rule for both sources: restore AAO-SSNHL19 with that caveat, or drop AFP-HL19 too.

**Red-flag workup placeholders** (`/emrTemplate/redFlagPlaceholders`; review round 1). Printed in
square brackets after the flag's references. The engine adds the brackets.

| Pointer | String | Basis |
|---|---|---|
| `/emrTemplate/redFlagPlaceholders/rf_systemic` | `directed workup — specify` | P (emr-basis §3 and §5: rf_systemic has no verified lab panel, so it gets the placeholder directed workup — specify); the engine adds the brackets (fixer round 1) |

**Treatment and workup to date** (`/emrTemplate/history`). An `item` row prints the item's own
`patientClin` (M) and its recorded state: "yes", "answered no" or "not recorded". It is never "no"
for an unanswered item. When a Scribe probe the clinician answered wrote the item's current answer,
`(recorded by clinician via probe: <option label>)` follows (review round 1). Otherwise a negative
answer is followed by the row's `qualifier` in parentheses, when it has one (review round 2). A
`label` row prints `<label>: [ ]`; with a `probe`, the Scribe adds that probe's recorded answer the
same way. History rows carry no citations (V61, round 2). Review round 3 added the qualifier
"workup not recorded" to `r_normal` and `r_lesion` and the placeholder row
`/emrTemplate/history/13`.

| Pointer | String or item | Basis |
|---|---|---|
| `/emrTemplate/history/0/item` | `r_abx` (prints its `patientClin`: "≥2 antibiotic/steroid courses without lasting relief") | item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5) |
| `/emrTemplate/history/1/item` | `r_surg` (prints its `patientClin`: "Prior sinus procedure without resolution") | item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5) |
| `/emrTemplate/history/2/item`, `/qualifier` | `r_normal` (prints its `patientClin`: "Exam or imaging normal relative to symptom burden"); qualifier `workup not recorded` | item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5); S qualifier workup not recorded after a negative answer no probe wrote: an answered no does not say the exam or imaging was abnormal, only that the patient did not endorse the item (emr-basis §2.5 implies a prior exam or imaging study, modality unknown; fixer round 3) |
| `/emrTemplate/history/3/item`, `/qualifier` | `r_lesion` (prints its `patientClin`: "Recurrent dizziness/aural symptoms, no structural lesion found"); qualifier `workup not recorded` | item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5); S qualifier workup not recorded after a negative answer no probe wrote: an answered no does not say a lesion was found, only that the patient did not endorse the item (emr-basis §2.5 implies a prior workup, tests unknown; fixer round 3) |
| `/emrTemplate/history/4/item`, `/qualifier` | `x_objective` (prints its `patientClin`: "Objective sinus inflammation on endoscopy/CT when symptomatic"); qualifier `testing not recorded` | item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5); S qualifier testing not recorded after a negative answer no probe wrote: an answered no does not record whether endoscopy or CT was done (emr-basis §2.5; fixer round 2) |
| `/emrTemplate/history/5/item` | `x_purulent` (prints its `patientClin`: "Purulent drainage or positive sinus culture when symptomatic") | item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5) |
| `/emrTemplate/history/6/item`, `/qualifier` | `x_lowfreq` (prints its `patientClin`: "Audiometric fluctuating low-frequency SNHL"); qualifier `testing not recorded` | item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5); S qualifier testing not recorded after a negative answer no probe wrote: no does not mean an audiogram was done (emr-basis §2.5, §7 risk 6; fixer round 2) |
| `/emrTemplate/history/7/item` | `x_anosmia` (prints its `patientClin`: "Persistent hyposmia between episodes") | item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5) |
| `/emrTemplate/history/8/label` | `Antibiotic / steroid courses — agent, route (oral / intranasal), dates, response` | P heading (emr-basis §2.5); the engine adds the [ ] placeholder |
| `/emrTemplate/history/9/label` | `Prior imaging — modality, date, result; Lund-Mackay score if CT` | P heading (emr-basis §2.5); the engine adds the [ ] placeholder |
| `/emrTemplate/history/10/label` | `Audiograms / vestibular testing — dates, results` | P heading (emr-basis §2.5); the engine adds the [ ] placeholder |
| `/emrTemplate/history/11/label` (probe `pr_treatment_trial`) | `Prior migraine abortive or preventive trials — agent, dose, duration, response` | P heading (emr-basis §2.5); the engine adds the [ ] placeholder; on the Scribe the recorded pr_treatment_trial answer follows it, labelled as recorded by the clinician (emr-basis §2.5, migraine-directed therapy line; fixer round 1) |
| `/emrTemplate/history/12/label` | `Vestibular rehabilitation / repositioning manoeuvres to date` | P heading (emr-basis §2.5); the engine adds the [ ] placeholder |
| `/emrTemplate/history/13/label` | `Acute headache medication use — days per month, by class` | P heading, verbatim from emr-basis §2.6 (optional D13 row; C AAN26 rec. 12A/B, AFP-IHSACUTE26, medication-overuse limits); no number is printed; the engine adds the [ ] placeholder. Data, not an engine heading, because the engine names no condition (t-emr); it sits with the treatment-to-date rows, before the empiric-treatment references it informs (fixer round 3) |

**Checklist** (`/emrTemplate/checklist`; the D7 core items, AL1 merged with SI3). The engine
prints the heading "Medical management not yet offered — checklist (allergy / sinusitis /
dizziness):", the group words joined from the rows' `group` values, then the key line "Key: ticked
= recorded as done; unticked = not recorded (not confirmed as not offered)." (review round 1, a D7
amendment awaiting the lead). A signal renders as one of:

- `done`: the box is ticked, `recorded on screen: <text>`;
- `answeredNo`: `; screen answered no: <text>`;
- `note`: `; screen records (context only): <text>`;
- `neverTried`: "patient reports never tried" (a probe signal only).

`<text>` is the item's wording, or the probe option's note (else its label). A probe signal's
source always reads "recorded by clinician via probe" instead of "recorded on screen" or "screen
…" (a note: "recorded by clinician via probe (context only)", review round 2). Since review round
3 an item signal whose answer a Scribe probe wrote reads the same way ("recorded by clinician via
probe, answered no" for `answeredNo`), with the probe's recorded answer in parentheses after the
item wording, as the history rows print it. A signal's
`qualifier` is added to its source in parentheses (for a note, "(context only; <qualifier>)"). An
item signal's render must match its answer's polarity: `done` and `note` a positive answer,
`answeredNo` a negative one (V61 error; the engine skips a contradicting signal; round 2). A row's
`placeholder` follows the line in square brackets. A row with `box: false` is a status line,
`<label>: <status>`, with no box; a row with `onlyWithSignal: true` prints only when one of its
signals holds (round 2). A row with no signals is never ticked. Each printed row names its sources
by number after its label ("(sources 1, 3)"; review rounds 1 and 2, replacing implementation
choice I4). Since review round 3 the exam rows and the checklist share one numbering by first use,
and one list after the plan, "REFERENCES (cited by number in the exam rows and checklist)",
holds each citation once.

| Pointer | `label` (group) | Citation keys | Signals | Basis |
|---|---|---|---|---|
| `/emrTemplate/checklist/0` (`al1_si3`) | `Intranasal corticosteroid trial (allergic rhinitis or sinus indication)` (allergy) | AFP-AR23, AAO-AR15, JTF-RHIN20, ICAR-AR23, AAO-SIN25, AFP-CRS23 | r_abx = yes → note (qualifier "agent/route not recorded") | N (D1, D7: AL1 merged with SI3): AFP-AR23 (SOR A), AAO-AR15, JTF-RHIN20, ICAR-AR23 synopsis, AAO-SIN25 KAS 11, AFP-CRS23; r_abx is context only (it does not prove an intranasal steroid trial), qualified agent/route not recorded as emr-basis §4 AL1 gives it (fixer round 1) |
| `/emrTemplate/checklist/1` (`al2`) | `Second-generation antihistamine trial (oral or intranasal)` (allergy) | AAO-AR15, AFP-AR23, ICAR-AR23 | none (never ticked) | N (D1, D7: AL2): AAO-AR15, AFP-AR23, ICAR-AR23 synopsis |
| `/emrTemplate/checklist/2` (`al3`) | `Specific-IgE allergy testing (skin or serum)` (allergy); placeholder `date / result` | AFP-AR23, AAO-AR15 | none (never ticked) | N (D1, D7: AL3): AFP-AR23 (skin testing preferred, SOR A), AAO-AR15; the date / result placeholder as emr-basis §4 AL3 gives it (fixer round 1); the label cut to the class name, words of the §4 AL3 label: its indication clause restated the AFP-AR23 recommendation (risk 1, reuse terms), and the linked sources carry the indication: a D1 deviation (fixer round 3) |
| `/emrTemplate/checklist/3` (`si1`) | `Objective sinus evaluation (rhinoscopy, endoscopy or CT)` (sinusitis) | AAO-SIN25, AFP-CRS23 | pr_scan_detail option 1 ("Genuinely clear") → done; x_objective = yes → done; x_objective = no → answeredNo; r_normal = yes → note (qualifier "modality not recorded") | N (D1, D7: SI1): AAO-SIN25 KAS 7B, AFP-CRS23; x_objective yes ticks it, no is answered no, r_normal is context only; labelled as the evaluation, not a confirmed diagnosis: x_objective records objective inflammation when symptomatic, not chronic rhinosinusitis (which also needs the symptom criteria), so a ticked row never reads as a diagnosis: a D1 deviation from the §4 SI1 label (fixer round 3). The Scribe's rule-out probe pr_scan_detail answered Genuinely clear (the module's option label, M) also ticks it, as recorded by the clinician via probe, first among the signals: a clear scan the clinician recorded is an evaluation done, though it writes x_objective no; the item's answered no still follows. S qualifier modality not recorded on the r_normal note: the item says an exam or imaging study was normal, not which (emr-basis §2.5; fixer round 4) |
| `/emrTemplate/checklist/4` (`si2`) | `Saline irrigation` (sinusitis) | AAO-SIN25, AFP-CRS23, AFP-AR23 | none (never ticked) | N (D1, D7: SI2): AAO-SIN25 KAS 11, AFP-CRS23 (SOR A), AFP-AR23 |
| `/emrTemplate/checklist/5` (`si4`) | `Antibiotic stewardship reviewed` (sinusitis); `box: false` (a status line); `onlyWithSignal: true` | AAO-SIN25, AFP-CRS23, AAO-CRSSURG25 | r_abx = yes → note (qualifier "agent/route not recorded") | N (D1, D7: SI4, a stewardship line): AAO-SIN25 KAS 14, AFP-CRS23 (SOR B), AAO-CRSSURG25 KAS 3; r_abx is context only (agent/route not recorded); printed as a status line without a box, as emr-basis §4 SI4 asks (fixer round 1); printed only when r_abx = yes, as the §4 rendering gives it (onlyWithSignal), and labelled without the presumed diagnosis: a D1 deviation from the §4 SI4 label, whose wording restates the guideline (fixer round 2) |
| `/emrTemplate/checklist/6` (`dz1`) | `Canalith repositioning (if positional vertigo)` (dizziness) | AAO-BPPV17, AFP-DIZZ23, GRACE3-23 | pr_dix_hallpike option 0 → note; pr_dix_hallpike option 1 → note; v_head = yes → note | N (D1, D7: DZ1): AAO-BPPV17, AFP-DIZZ23 (SOR A), GRACE3-23; the recorded Dix–Hallpike probe result and v_head are context only; the label names the treatment only, words of the §4 DZ1 label (the test is the examRows/13 row), so a recorded test never sits next to not recorded: a D1 deviation (fixer round 2) |
| `/emrTemplate/checklist/7` (`dz2`) | `Vestibular rehabilitation (vestibular physical therapy)` (dizziness) | AFP-DIZZ23 | none (never ticked) | N (D1, D7: DZ2): AFP-DIZZ23; APTA22 (peripheral hypofunction only) deliberately not cited |
| `/emrTemplate/checklist/8` (`dz3`) | `Migraine-directed trial for suspected vestibular migraine (empiric)` (dizziness) | AFP-DIZZ23, COCH-VMPROPH23, COCH-VMACUTE23, BARANY22 | pr_treatment_trial option 0 → done; pr_treatment_trial option 1 → done; pr_treatment_trial option 2 → neverTried | N (D1, D7: DZ3): AFP-DIZZ23 VM section, COCH-VMPROPH23, COCH-VMACUTE23, BARANY22 §4.10; pr_treatment_trial improved / no change ticks it with the module note verbatim, Never tried reads 'patient reports never tried' |
| `/emrTemplate/checklist/9` (`dz4`) | `Audiogram (episodic vertigo with aural symptoms, or unilateral tinnitus)` (dizziness) | AFP-DIZZ23, AFP-TINN21, AAO-TINN14 | x_lowfreq = yes → done | N (D1, D7: DZ4, included): AFP-DIZZ23 (SOR C), AFP-TINN21, AAO-TINN14; only x_lowfreq yes ticks it (no does not prove testing); the label with its indication as emr-basis §4 DZ4 gives it (fixer round 1) |

**Exam rows** (`/emrTemplate/examRows`). Each prints `<label>: [ ]`, with its sources by number
after the label when it has citations ("Dix–Hallpike (right, left) (sources 6, 1): [ ]"; round 2).
When the row names a probe
(always an exam-kind probe: V61) the clinician answered on the Scribe, it adds
`(recorded by clinician via probe: <option label>; <note>)` and keeps the placeholder
(implementation choice I6; a deferred probe reads "(recorded by clinician via probe: Deferred)").
The engine adds "Vitals: BP [ ] HR [ ] Temp [ ] Wt [ ]" and "General: [ ]" before the rows, and
"[Additional examination findings]" after them. The rows' citations are numbered first in the one
list after the plan, which the checklist rows continue (review round 3; rounds 1 and 2 listed them
under the exam as "Exam row sources:").

| Pointer | `label` | Citation keys | Probe | Basis |
|---|---|---|---|---|
| `/emrTemplate/examRows/0/label` | `Orthostatic BP` | AFP-DIZZ23 | — | N label (D1) from C AFP-DIZZ23 (orthostatic BP) |
| `/emrTemplate/examRows/1/label` | `Head / neck` | — | — | S heading (emr-basis §2.8) |
| `/emrTemplate/examRows/2/label` | `Cervical` | — | — | S heading (emr-basis §2.8) |
| `/emrTemplate/examRows/3/label` | `Temporal arteries — tenderness, thickening, pulse` | — | pr_temporal_artery | M probe pr_temporal_artery say (emr-basis §2.8); N noun-phrase label (D1) |
| `/emrTemplate/examRows/4/label` | `Ears / otoscopy (right, left)` | — | — | S heading; n_otalgia presumes an ear exam (emr-basis §2.8) |
| `/emrTemplate/examRows/5/label` | `Weber / Rinne (512 Hz)` | AAO-SSNHL19 | pr_tuning_fork | M probe pr_tuning_fork; C AAO-SSNHL19 KAS 1 (emr-basis §2.8); N label (D1) |
| `/emrTemplate/examRows/6/label` | `Nose — anterior rhinoscopy` | AAO-SIN25 | — | N label (D1) from C AAO-SIN25 KAS 7B |
| `/emrTemplate/examRows/7/label` | `Nasal endoscopy (if performed)` | AFP-CRS23 | — | M x_objective names endoscopy; C AFP-CRS23 (emr-basis §2.8) |
| `/emrTemplate/examRows/8/label` | `Unilateral obstruction / bleeding / visible mass / facial numbness` | — | — | M rf_mass text (emr-basis §2.8) |
| `/emrTemplate/examRows/9/label` | `Oral cavity / oropharynx` | — | — | S heading (emr-basis §2.8) |
| `/emrTemplate/examRows/10/label` | `Eyes — periorbital findings, extraocular movements` | — | — | M rf_orbital text (emr-basis §2.8) |
| `/emrTemplate/examRows/11/label` | `Fundoscopy — papilloedema present / absent / not examined` | IIH18 | — | M rf_vision action; C IIH18 (emr-basis §2.8); N label (D1) |
| `/emrTemplate/examRows/12/label` | `Nystagmus (spontaneous / gaze-evoked / positional)` | AFP-DIZZ23 | — | N label (D1) from C AFP-DIZZ23 |
| `/emrTemplate/examRows/13/label` | `Dix–Hallpike (right, left)` | AAO-BPPV17, AFP-DIZZ23 | pr_dix_hallpike | M probe pr_dix_hallpike; C AAO-BPPV17, AFP-DIZZ23 (emr-basis §2.8); N label (D1) |
| `/emrTemplate/examRows/14/label` | `Head impulse / nystagmus / test of skew (HINTS)` | AFP-DIZZ23, GRACE3-23 | pr_head_impulse | M probe pr_head_impulse; C AFP-DIZZ23, GRACE3-23 (accurate only in trained hands) (emr-basis §2.8); N label (D1); D6: no plan line |
| `/emrTemplate/examRows/15/label` | `Gait / Romberg` | GRACE3-23 | — | N label (D1) from C GRACE3-23 |
| `/emrTemplate/examRows/16/label` | `Neurologic — cranial nerves incl. facial sensation, motor, sensory, coordination, speech` | — | — | M rf_focal and rf_mass text (emr-basis §2.8) |
| `/emrTemplate/examRows/17/label` | `Cardiac` | AFP-DIZZ23 | — | N label (D1) from C AFP-DIZZ23 (full cardiac and neurologic examination) |

**Engine-owned text of the template (not module data).** `app/src/engine/emr.js` holds the rest.
None of it is in the rubric:

- **Verbatim engine sentences.** Each one's source is named at its constant (`S`): `buildNote`
  (`engine/scribe.js`), `buildBundle` (`engine/fhir.js`), and the Screener's override box and
  outstanding-items note. Also `CAVEATS.prototype` and `CAVEATS.illustrative`
  (`engine/policy.js`). "Screening routing withheld — red flag present" is the routing-override
  display of the Screener's bundle (`engine/fhir.js`, emitted only there); the content basis (§1,
  §2.10b) prints it under an open flag on both surfaces, so on the Scribe it is the Screener
  bundle's wording (review round 2). The Scribe bundle has no such component, and neither bundle
  issues a referral under a flag.
- **Placeholders (`P`)**:
  - the identity line `Patient: [name]   Age / sex: [ ]   MRN: [ ]` (a synthetic demo patient is
    never copied into the text; review round 1);
  - the Scribe's `Presenting picture: [ ]` (the module rule's category follows, to confirm, only
    when a derive rule fired; review round 1);
  - the header (DOB, date of service, referring clinician, consultant, encounter type);
  - reason for consult and the HPI narrative;
  - past medical history, pregnancy status, medications, both allergy lines, social and family
    history (the acute-medication row is module data, `history/13`, because its heading names a
    condition; review round 3);
  - additional review of systems and examination findings, the clinician assessment;
  - the red-flag workup line, "Referral: [clinician decision]", the two consultant questions;
  - the three "offered today" lines, follow-up and the signature.

  D8 and D13 give the allergy and pregnancy lines verbatim. The red-flag workup line is the
  spec's, verbatim.
- **Verbatim engine sentences added in review round 3:** the encounter note's context line
  ("Context: <the note labels of the gap markers that hit>.", `engine/scribe.js` L295, L312),
  printed when the gap rule fires on fewer than all its markers, and its "NOT YET REVIEWED — no
  routing issued. Complete the red-flag review before signing." after open flags on the Scribe
  while the review is not recorded.
- **Structural labels.** Section headings (round 3: "REVIEW OF SYSTEMS (screen items, as answered;
  not today's examination)" and "REFERENCES (cited by number in the exam rows and checklist)"),
  "Endorsed:", "Answered no:", "Not answered:",
  "Instruments:", "Named on screen:", "Ref:", "Source:",
  "Empiric treatment references (for use before specialist review):", the checklist heading, key
  line and status words, "Supporting features
  (recorded, not scored):", "Probe notes (recorded by clinician):", "recorded by clinician via
  probe" (", answered no", round 3), "(context only)", the rows' "(sources 1, 3)" marks and the
  source-list numbers (round 2), the domains' "(n of m items answered)" and "<domain> not
  answered" (round 3), the Scribe's referral destination lines ("(destination from the screen
  phenotype by module rule: …; confirm)", "(destination from the module's default phenotype: …;
  confirm)", "(destination from the screen phenotype: …; confirm)"; round 3),
  "Screen:" before the band headline, "(screen phenotype by module rule: …; confirm)",
  the line above the red-flag actions ("Actions are the module's own wording; Ref lines are
  background reading, not the source of an action or its timing."), "Reference links accessed:",
  and the panel chrome (`EMR_UI`, whose rebuild sentence names the screen on the Screener and the
  encounter on the Scribe, round 2, and since round 4 says that leaving the view discards edits
  too). "Criteria items recorded on screen:" was removed in round 2.

They name no module id, phenotype value or condition (the `static` suite's t-ids rule). A module
without `emrTemplate` therefore gets only these and its own text.

**Review round 1 (6 October 2026): content decisions recorded for the lead.**

- **SI4 is a status line, not a "to offer" box** (content basis §4: "A stewardship status line,
  not a 'to offer' box"). The module's own sentence "Reassess before further antibiotics, steroids,
  or sinus surgery." (`sinus_migraine`) is not attached to it: the engine would have to read a
  routing recommendation's text by id, and that recommendation already prints in the plan when it
  fires. The lead may ask for it.
- **The AL3 and DZ4 labels carry their indications, and AL3 its "[date / result]"**, as the content
  basis §4 gives them; the `r_abx` signals are qualified "agent/route not recorded" (§4 AL1).
- **Reference labels.** The AFP rows are American Family Physician review articles, not AAFP
  policy, so they read "— American Family Physician (AAFP journal), <year>"; AAN/AHS 2026 is
  listed first and the AFP 2025 prophylaxis row says it "predates AAN/AHS 2026" (verifier caveat).
  The vestibular-migraine note says "low or very-low certainty", as COCH-VMPROPH23 and
  COCH-VMACUTE23 rate the evidence.
- **Bárány criterion labels (known risk).** The item texts and `ref`s printed under "Criteria
  items recorded on screen" are baseline instrument text, moved verbatim. They label the 5 min –
  72 h episode duration "Bárány VM B" and five or more episodes "Bárány VM A", whereas BARANY22
  has duration within criterion A and migraine history as B. A fix is a versioned instrument
  change for the lead (`CHANGELOG.md`, release 0.4.3, risk 14). Review round 2 removed that block
  from the template, so no `ref` is printed; the instrument text itself is unchanged.

**Review round 2 (7 October 2026): content decisions recorded for the lead.**

- **DZ1 names the treatment only** ("Canalith repositioning (if positional vertigo)"; it was
  "Dix–Hallpike test / canalith repositioning (if positional vertigo)"). The words are a subset of
  the content basis §4 DZ1 label; the test is the exam row "Dix–Hallpike (right, left)", and a
  recorded result in the checklist row is context. A D1 deviation from the basis label.
- **SI4 prints only with its signal** (`onlyWithSignal`: `r_abx` = yes, the basis §4 rendering)
  and reads "Antibiotic stewardship reviewed" (no "(chronic rhinosinusitis)": the screen makes no
  such diagnosis). A D1 deviation from the basis §4 SI4 label, whose wording restates AAO-SIN25
  KAS 14; keys AAO-SIN25 (KAS 14), AFP-CRS23, AAO-CRSSURG25 (KAS 3).
- **History qualifiers** "testing not recorded" on `x_lowfreq` and `x_objective` (S; basis §2.5,
  risk 6): an answered "no" no probe wrote never reads as a negative test.
- **History rows carry no citations** (none did; V61 now refuses them, because the template never
  printed them).
- **Lead items, not changed:** the AL3 and DZ4 indication clauses (D1), a placeholder under a
  recorded central HINTS pattern (D6), the checklist under an emergent flag (I3, D7), the otologic
  referral to "Neuro-otology" (D3) and the reading of "also" under a red flag (`CHANGELOG.md`,
  release 0.4.3).

**Review round 3 (7 October 2026): content decisions recorded for the lead.**

- **AL3 is cut to its class name**, "Specific-IgE allergy testing (skin or serum)", with "[date /
  result]": the clause "if empiric treatment fails or diagnosis uncertain" restated the AFP-AR23
  recommendation (reuse terms). Words of the basis §4 AL3 label; a D1 deviation. The DZ4 clause
  stays a lead item.
- **SI1 names the evaluation**, "Objective sinus evaluation (rhinoscopy, endoscopy or CT)": ticked
  by `x_objective`, "Objective confirmation of chronic rhinosinusitis" read as a confirmed
  diagnosis, which also needs the symptom criteria. A D1 deviation from the basis §4 SI1 label;
  keys unchanged.
- **History qualifiers "workup not recorded"** on `r_normal` and `r_lesion` (S): an answered no is
  the patient not endorsing the item, never a found lesion or an abnormal workup.
- **The acute-medication placeholder** (`history/13`, basis §2.6 verbatim, optional D13 row) is
  included, with no number.
- **AHA26 stores the register's DOI** (see the citation records above).
- **`rf_ssnhl`'s recorded reason corrected** (see the red-flag references above).
- **D7, recorded:** the checklist also shows while the Scribe's safety review is not recorded (the
  content basis §1 table had "Withheld (D7)"; the spec is silent and I3 keeps it). The lead
  confirms or withholds it.
- **Lead items, not changed:** the module's `gapLine` and `gapAlert.body` wording (the template
  prints `gapLine` only when every marker hit), the Scribe derive rule behind the referral
  destination (D14; the template names the destination's source), a recorded central HINTS
  pattern (D6), item-prompt capture labels on the Scribe (optional), the DZ4 clause (D1) and one
  rule for the `rf_ssnhl` Ref lines.

**Review round 4 (7 October 2026): content decisions recorded for the lead.**

- **SI1 is ticked by a clear scan the clinician recorded**: its first signal is `pr_scan_detail`
  option 1, the module's own label "Genuinely clear" (index checked against `masque.logic.js`),
  rendered done, so the row reads "[x] Objective sinus evaluation (rhinoscopy, endoscopy or CT) -
  recorded by clinician via probe: Genuinely clear", followed by the item's answered no the probe
  wrote. Before, the row read "not recorded" next to that recorded result. Only the Scribe's probe
  answer ticks it this way; a screen "no" stays answered no.
- **The `r_normal` note on SI1 is qualified "modality not recorded"** (S): "screen records (context
  only; modality not recorded): Exam or imaging normal relative to symptom burden".
- **V61 warns on row fields the engine never reads** (W), so a misspelt or misplaced key (an
  item signal's `option`, a probe signal's `value`) no longer passes silently.

### Referral rule for dizziness cases (release 0.4.5)

These values are typed once, in `app/tests/harness/referral-delta.js` (`REFERRAL_DELTA`), not in
`HAND`. They are the clinical lead's decisions in chat (`REFERRAL_DELTA.quotes`, verbatim, each
with its date): on 2026-10-07 the rule, "Yes, dizziness cases should be referred to neurology, and
neuro-otology if there is a true vertiginous component or a history of ear or brain surgeries",
and, asked directly how true vertigo is to be recognised, the lead's definition of true vertigo,
in the lead's own words; on 2026-10-09 "both cases should follow the dizziness rule" and, three
minutes later, the lead's clarification of what counts as true vertigo (among it, that a rocking or
bobbing sensation is not true vertigo); on 2026-10-10, in two messages, "classify rocking or
bobbing as dizziness and not true vertigo, it counts toward the vestibular score still as it is
imbalance" and "Swaying is imbalance also" (`quotes.amendment`): the definition's
internal-vertigo line no longer lists "swaying, bobbing, " (`REFERRAL_DELTA.amendments`), and the
instrument, probes and lexicon are unchanged (such a sensation still scores, as imbalance, into
`v_vertigo`, "Episodic vertigo or imbalance"). The definition as given on 2026-10-07 stays
verbatim in `quotes.definition`. `extract-rubric.js` applies the delta last, with
`applyReferralDelta`, under `/phenotypes/referral` only: the `changed` row replaces the
baseline-extracted value, which it must still find, and the `added` rows add `byPhenotype.both`
at the end of `byPhenotype` and `clinicianRules` at the end of `phenotypes.referral`, keys that
must not exist yet. `revertReferralDelta` must then give back the rubric without them exactly, key
order included. The `referral` change-log entry follows the 0.4.4 `sign-off` entry. Nothing
escalates: the table holds no evidence or destination of its own (see `CHANGELOG.md`, release
0.4.5, for why).
The extractor's ten referral checks (nine until the amendment of 2026-10-10, which added the
fourth and changed the third):

1. the change is exact: one destination changed from its baseline value, `byPhenotype.both` added
   last in `byPhenotype` and `clinicianRules` added last in `phenotypes.referral`, and the revert
   gives back the rubric without them;
2. release 0.4.5, decided by the clinical lead in chat on real calendar dates in order, each the
   date of a quote and every quote dated with one of them;
3. each clinician rule's `rule` is the lead's sentence without its opening reply word "Yes, ", its
   `clarification` the lead's words verbatim, its `definition` the lead's (`quotes.definition`)
   line for line with only the lead's recorded amendments applied, its `source` the lead and the
   date of the rule (and of each amendment of the definition: "; definition amended <date>") and
   its `clarificationSource` the lead and the date of the clarification;
4. each amendment of the definition (`amendments`) removes exactly one occurrence of its text from
   the lead's line and nothing else, rests on a later dated decision of the lead (`quotes.amendment`)
   whose words name every word it removes, and leaves none of those words in the printed line;
5. the delta's `destinations` are exactly the referral destinations that differ from the baseline
   (otologic Neuro-otology → Neurology; both Headache medicine / Neurology → Neurology), and no
   reason changes;
6. every phenotype a clinician rule names exists, and the rule names exactly the phenotypes of
   `destinations` (the dizziness cases);
7. no escalation: `phenotypes.referral` is `{byPhenotype, default, clinicianRules}` and a clinician
   rule has only display fields;
8. every clinician-rule string is non-empty and carries no `[ ] { }`;
9. there is exactly one basis per changed destination, per added `byPhenotype` row and per field
   of each clinician rule;
10. its change-log entry (kind `referral`, dated as the last decision, naming the changed and added
    paths) is the last, right after the 0.4.4 sign-off entry.

| Path | Value | Basis (`REFERRAL_DELTA.basis`) |
|---|---|---|
| `/phenotypes/referral/byPhenotype/otologic/specialty` | `Neurology` (was `Neuro-otology`, the baseline bundle's) | L: the lead's "dizziness cases should be referred to neurology"; the otologic phenotype ("Dizziness, aural fullness, tinnitus, fluctuating hearing") is a dizziness case; the reason "vestibular migraine" is unchanged; nothing escalates, so Neurology is the referral wherever one prints. |
| `/phenotypes/referral/byPhenotype/both` | `{specialty: "Neurology", reason: "mid-facial / migrainous cause"}` (was the default, `Headache medicine / Neurology`) | L: the lead's "both cases should follow the dizziness rule" (2026-10-09); only the specialty changes, the reason is the one `both` had through the default (main session). |
| `/phenotypes/referral/clinicianRules/0/phenotypes` | `["otologic", "both"]` | L: the dizziness cases (2026-10-07, 2026-10-09); sinonasal and the default print no rule. |
| `/phenotypes/referral/clinicianRules/0/source` | `clinical lead, 2026-10-07; definition amended 2026-10-10` (was `clinical lead, 2026-10-07` until the amendment) | S: who stated the rule and the definition, and when, and when the lead amended the definition. The engine prints this one source after "Referral rule" and after "Definition", so it names what was amended; the rule is unchanged since 2026-10-07. |
| `/phenotypes/referral/clinicianRules/0/rule` | the lead's sentence without "Yes, " | L verbatim. |
| `/phenotypes/referral/clinicianRules/0/definition` | the lead's three lines, as the lead amended them | L, as amended by the lead (2026-10-07; amended 2026-10-10): the internal-vertigo line without "swaying, bobbing, " (`amendments`; the lead's "classify rocking or bobbing as dizziness and not true vertigo …" and "Swaying is imbalance also"); the external-vertigo and direction lines verbatim. The 2026-10-07 text stays in `quotes.definition`. The clarification prints unchanged after it. |
| `/phenotypes/referral/clinicianRules/0/clarificationSource` | `clinical lead, 2026-10-09` | S: who stated the clarification, and when. |
| `/phenotypes/referral/clinicianRules/0/clarification` | the lead's clarification, one line | L verbatim (2026-10-09). |
| `/phenotypes/referral/clinicianRules/0/confirm` | `True vertigo (internal or external)`, `Prior ear or brain surgery` | S: one placeholder per condition of the rule a clinician confirms; the module records neither reliably. |

(L: the clinical lead's words; S: a structural label.) **Status:** the destinations, the rule, the
definition (as the lead amended it on 2026-10-10) and the clarification are the clinical lead's
decisions of 2026-10-07 to 2026-10-10, in the lead's own words; keeping the module's reason for
`both`, the absence of any automatic escalation and the two placeholder labels are the main
session's, recorded in `CHANGELOG.md` (release 0.4.5). The `values` suite pins the data and
exempts exactly these leaves (pointer and value) from the provenance sweep.

### EMR template: the clinical lead's answers (release 0.4.6)

These values are typed once, in `app/tests/harness/emr-decisions-delta.js` (`EMR_DECISIONS_DELTA`),
not in `HAND` and not in `emr-delta.js`, whose signed-off release 0.4.3 data is untouched. They
rest on the clinical lead's answers in chat of 2026-10-10 (`EMR_DECISIONS_DELTA.quotes`: each
question, every option as the lead saw it and the answer, verbatim): under an open red flag the
note also prints the referral and the references ("Workup + referral + references"); the DZ4
label keeps its clause ("Keep the clause"); three I5 items are added back ("Modifying
conditions,Family history of migraine,Assessment 'Considerations'"); and a clinician line goes
under the HINTS row for a recorded central pattern ("Add a clinician line"). Two of the answers
add data, below; the reading of "also" and the Considerations line are the engine's
(`engine/emr.js`), and DZ4 changes nothing. `extract-rubric.js` applies the delta last, with
`applyEmrDecisionsDelta`, under `/emrTemplate` only: each `added` row adds a key that must not
exist yet (`pastHistory` at the end of `emrTemplate`, `optionPlaceholders` at the end of the HINTS
exam row), and `revertEmrDecisionsDelta` must give back the rubric without them exactly, key order
included, whose `emrTemplate` is `EMR_DELTA.value`. The `emr-decisions` change-log entry follows
the 0.4.5 `referral` entry.

| Path | Value | Basis |
|---|---|---|
| `/emrTemplate/pastHistory/0` | `{label: "Modifying conditions (asthma, cystic fibrosis, immunocompromise, aspirin-exacerbated respiratory disease, ciliary dyskinesia)", group: "medical"}` | L: the label is the wording the lead approved on 2026-10-10 (quotes.addBack, option "Modifying conditions", quoted in its description), printed with the engine's [ ] placeholder after the pregnancy line (group medical). It is the optional D13 modifying-conditions row of the content basis §2.6 ("Asthma / immunocompromise / AERD / cystic fibrosis / ciliary dyskinesia: [ ]", heading from C AAO-SIN25 KAS 8, modifying conditions) in the words of the basis §4 SI5 label, "Modifying conditions assessed (asthma, CF, immunocompromise, AERD, ciliary dyskinesia)", with the abbreviations written out; left out under I5 until the lead's answer. No citation is printed (past-history rows carry none, like history rows). |
| `/emrTemplate/pastHistory/1` | `{item: "m_fhx", group: "family"}` | item id only (M): the line prints the item's own patientClin, "Personal or family history of migraine", and its recorded state (yes / answered no / not recorded, never a no from missing data; a Scribe probe that wrote it follows, labelled as recorded), as the content basis §2.6 line "Personal or family history of migraine: <state>"; left out under I5 until the lead's answer of 2026-10-10 (quotes.addBack, option "Family history of migraine"). The item leaves the review of systems, and the family-history placeholder below it reads "Other family history: [ ]" (basis §2.6). |
| `/emrTemplate/examRows/14/optionPlaceholders/0` | `{option: 0, placeholder: "clinician interpretation of HINTS and any imaging decision"}` | L: the placeholder is the wording the lead approved on 2026-10-10 (quotes.hints, option "Add a clinician line", quoted in its description), printed in the engine's brackets under the HINTS row when the Scribe's pr_head_impulse probe records option 0, "Normal impulse (points central)" (M). It was the round 2 option for D6 (CHANGELOG.md, release 0.4.3). No flag, no plan line and no clinical claim: the interpretation and any imaging decision are the clinician's. |

The extractor's nine checks for this delta:

1. the addition is exact: `pastHistory` added last in `emrTemplate` and `optionPlaceholders` added
   last in the HINTS exam row, nothing else, and the revert gives back the rubric without them,
   whose `emrTemplate` is the signed-off block (`EMR_DELTA.value`);
2. release 0.4.6, decided by the clinical lead in chat on a real calendar date; four quoted
   questions of that date, each with the options the lead saw;
3. each answer is one of those options (the add-back question: one or more, comma-joined);
4. `pastHistory` is exactly the two rows the add-back answer asks for: the modifying-conditions
   label as the chosen option quotes it (group `medical`) and the item whose own wording is
   "Personal or family history of migraine" (group `family`; not also a history row);
5. the HINTS row (`pr_head_impulse`, an exam probe) carries exactly one option placeholder, for
   the option the question names ("Normal impulse (points central)", index 0), in the words the
   chosen option quotes;
6. the answers that add no data (the reading of "also", the Considerations line, the DZ4 clause)
   add no row;
7. every added string is non-empty and carries no `[ ] { }`;
8. one basis per past-history row and per option placeholder;
9. the change-log entry (kind `emr-decisions`, dated as the decision, paths the added paths) is
   the last, right after the 0.4.5 referral entry.

### Lexicon delta 0.3.2 → 0.3.3 (release 0.4.7; signed off by the clinical lead on 2026-10-12)

These values are typed once, in `app/tests/harness/lexicon-delta-033.js` (`LEXICON_DELTA_033`), not
in `HAND` and not in `lexicon-delta.js`, whose approved 0.3.1 → 0.3.2 record is untouched. They rest
on the clinical lead's request and three answers in chat of 2026-10-11 (`request`, `decisions`:
the message, each question, the chosen option's description and the answer, verbatim):

- red flags: "Don't raise, no listing";
- answers: "Clickable answers (Recommended)";
- wording: "Draft, you sign off (Recommended)".

`extract-rubric.js` applies the delta right after the 0.3.2 delta with `applyLexiconDelta`. `clauses`
and `clarify` are new top-level keys, inserted just before `goldSet`; the four negation cues are
appended at the end of `negation.cues`; `version` and `goldSet` are replaced in place (exact `from`
match). `revertLexiconDelta` must give back the 0.3.2 lexicon exactly, and `revertLexiconChain` the
baseline 0.3.1 lexicon, key order included. The `lexicon` change-log entry (`changelog[14]`) is the
last.

**Source tags.** Every `clauses` row and every `clarify` entry carries `source`:

- `lead`: the lead's own words in the request, verbatim. These are the affirm cues `endorses`,
  `reports`, `has ` and `yes`, the deny cues `denies`, `no `, `lacks` and `doesn't have`, and the
  question "is the rhinorrhea clear or purulent?". `has` and `no` carry their boundary space.
- `module`: module text. No row uses it in 0.3.3: the module's questions are read from the probe or
  item at run time, never copied into the lexicon.
- `draft`: drafted by the team, awaiting the lead's sign-off. None is left since the sign-off of
  2026-10-12.
- `lead-approved`: drafted by the team and approved by the lead on the sign-off page or, for the rows
  added at the sign-off, in the lead's chat answers of 2026-10-12. The row's basis keeps its drafting
  record ("Draft …").

The switches carry no source key in the data: `wordStart`, `placeholderAsk`, `examItems` and
`strictConflict` were drafts, approved on 2026-10-12, and `redFlagNegation` is the lead's decision. Review round 1 added two
draft lists, `clauses.scopeEnd` (words that end a list denial) and `clauses.sections.read` (headers
read normally, which end an exam, family-history or skip section), each row with its basis. Review
round 2 made chart reading apply to typed chart text only (the lead's decision D9 of 2026-10-12
extended it to spoken and demo lines again), and added:
- the draft list `clauses.redFlags`: chart-register red-flag phrases by flag id, for every flag of
  the module;
- draft rows in `affirm` (the sign "(+)" and the treatment-failure cues), `deny` ("(-)"), `post`,
  `mask` (report headers, "hay fever"), `hedge` and `placeholder` (empty checkboxes);
- two draft clarify entries (`cl_scan_report`, `cl_audiogram_report`).

Review round 3 added the draft list `clauses.complement` (words after which a denial no longer
governs the finding: for, in, about, after, since, on, none of) and draft rows in `deny` ("rather
than"), `breaks` ("other than", "besides", "apart from") and `clauses.redFlags.rf_focal` ("slurred
speech"). Round 2 also emptied `examItems`, changed the `placeholderAsk` text (the template-text notice) and
removed from six clarify entries the qualifiers that state the dangerous answer or name a test.
`LEXICON_DELTA_033.basis` holds one basis per row, switch, entry and appended negation cue (286
since the sign-off; 294 after review round 3; 282 after review round 2; 142 after review round 1),
and `CHANGELOG.md` (release 0.4.7, "SIGN-OFF") lists every row of the sign-off list with its basis and
the lead's decision.

**The sign-off (2026-10-12).** The clinical lead decided every row of the sign-off list (306 rows,
read from commit `cd34934`) on the sign-off page and answered the 19 Part D questions and two D8
follow-up questions in chat. `LEXICON_DELTA_033.signOff` records it (by "clinical lead", date
2026-10-12, channel "sign-off page + chat"): 278 rows approved, 18 struck, 10 the lead's own words or
decision; every row's outcome; the struck rows with the basis they had; every Part D answer and the
follow-up answers verbatim. Applied: the 18 struck rows are gone (the mask `aural`, which the lead
kept struck after being told its effect on the history and physical, and 17 chart red-flag phrases of
`rf_thunderclap`, `rf_focal`, `rf_vision`, `rf_gca` and `rf_orbital`); every drafted row left is
`lead-approved`; the rows the lead approved at the sign-off are added, `lead-approved` (D7: the hedge
`"+/-"`; D8: the deny cues `"not associated with"`, `"not accompanied by"`, `"neg for"`, the
`rf_progressive` phrases `"progressively worse"`, `"progressively worsening"`, `"worse each week"`
and the `rf_asym` phrases `"left-sided hearing loss"`, `"right-sided hearing loss"`, `"asymmetric
hearing loss"`; the option's `"unilateral tinnitus"` was already a row); and the D8 answers removed
clarification qualifiers (`deep` from `cl_otalgia`; `clicking`, `steady` from `cl_tinnitus_quality`;
`progressive` from `cl_hearing_onset`; the positive-answer qualifiers of the rule-out entries
`cl_rhinorrhea`, `cl_audiogram`, `cl_smell`, `cl_scan_report`, `cl_audiogram_report`). The answers
D7, D8 and D9 also changed engine rules (`engine/extraction.js`, "Spoken lines"): chart reading reads
spoken and demo lines too (D9), typed chart text sets no context marker (D8), and "+/-" is read
as a hedge through its row (D7). The gold set 0.4.0 chart cases and their expectations are team
drafts; only case `k001` is the lead's own text.

| Field | Value (each phrase with its source tag) | Source |
|---|---|---|
| `lexicon.version` | `0.3.3` (replaces `0.3.2`) | `lexicon-delta-033.js` `fields[0]` |
| `lexicon.negation.cues` (appended at the end, after the 0.3.2 cue `fewer than`) | `"wasn't"` (lead-approved), `"weren't"` (lead-approved), `"aren't"` (lead-approved), `"hadn't"` (lead-approved) | `lexicon-delta-033.js` `appended[0]` |
| `lexicon.clauses.wordStart` | `true` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.wordStart` |
| `lexicon.clauses.affirm` | `"endorses"` (lead), `"reports"` (lead), `"has "` (lead), `"yes"` (lead), `"endorsed"` (lead-approved), `"reported"` (lead-approved), `"admits"` (lead-approved), `"positive for"` (lead-approved), `"complains of"` (lead-approved), `"c/o"` (lead-approved), `"describes"` (lead-approved), `"presents with"` (lead-approved), `"(+)"` (lead-approved), `"no improvement"` (lead-approved), `"no relief"` (lead-approved), `"no response"` (lead-approved), `"no benefit"` (lead-approved), `"without improvement"` (lead-approved), `"without relief"` (lead-approved), `"without benefit"` (lead-approved), `"failed"` (lead-approved), `"refractory to"` (lead-approved), `"despite"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.affirm` |
| `lexicon.clauses.deny` | `"denies"` (lead), `"no "` (lead), `"lacks"` (lead), `"doesn't have"` (lead), `"denied"` (lead-approved), `"negative for"` (lead-approved), `"without"` (lead-approved), `"does not have"` (lead-approved), `"don't have"` (lead-approved), `"do not have"` (lead-approved), `"haven't had"` (lead-approved), `"hasn't had"` (lead-approved), `"(-)"` (lead-approved), `"rather than"` (lead-approved), `"not associated with"` (lead-approved), `"not accompanied by"` (lead-approved), `"neg for"` (lead-approved) (the last three added at the sign-off, D8) | `lexicon-delta-033.js` `fields[1].to.deny` |
| `lexicon.clauses.post` | `" negative"` (lead-approved), `" denied"` (lead-approved), `" absent"` (lead-approved), `" not present"` (lead-approved), `": no"` (lead-approved), `": none"` (lead-approved), `"(-)"` (lead-approved), `": denies"` (lead-approved), `" - no"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.post` |
| `lexicon.clauses.prefix` | `"non-"` (lead-approved), `"non "` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.prefix` |
| `lexicon.clauses.breaks` | `"but "` (lead-approved), `"however"` (lead-approved), `"although"` (lead-approved), `"though "` (lead-approved), `"except "` (lead-approved), `"whereas"` (lead-approved), `" — "` (lead-approved), `"other than"` (lead-approved), `"besides"` (lead-approved), `"apart from"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.breaks` |
| `lexicon.clauses.scopeEnd` | `"with"` (lead-approved), `"so"` (lead-approved), `"now"` (lead-approved), `"until"` (lead-approved), `"is"` (lead-approved), `"are"` (lead-approved), `"was"` (lead-approved), `"were"` (lead-approved), `"to"` (lead-approved), `"from"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.scopeEnd` |
| `lexicon.clauses.complement` | `"for"` (lead-approved), `"in"` (lead-approved), `"about"` (lead-approved), `"after"` (lead-approved), `"since"` (lead-approved), `"on"` (lead-approved), `"none of"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.complement` |
| `lexicon.clauses.mask` | `"number"` (lead-approved), `"ct showed"` (lead-approved), `"scope showed"` (lead-approved), `"lund-mackay"` (lead-approved), `"audiogram showed"` (lead-approved), `"hearing test showed"` (lead-approved), `"hay fever"` (lead-approved) (the lead struck `"aural"`, 2026-10-12) | `lexicon-delta-033.js` `fields[1].to.mask` |
| `lexicon.clauses.hedge` | `"reportedly"` (lead-approved), `"possible"` (lead-approved), `"possibly"` (lead-approved), `"probable"` (lead-approved), `"questionable"` (lead-approved), `"suspected"` (lead-approved), `"unclear whether"` (lead-approved), `"unclear if"` (lead-approved), `"rule out"` (lead-approved), `"r/o"` (lead-approved), `"?"` (lead-approved), `"maybe"` (lead-approved), `"unsure"` (lead-approved), `"uncertain"` (lead-approved), `"not sure"` (lead-approved), `"might"` (lead-approved), `"+/-"` (lead-approved) (`"+/-"` added at the sign-off, D7) | `lexicon-delta-033.js` `fields[1].to.hedge` |
| `lexicon.clauses.placeholder` | `"***"` (lead-approved), `"___"` (lead-approved), `"[ ]"` (lead-approved), `"[]"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.placeholder` |
| `lexicon.clauses.thirdParty` | `"mother"` (lead-approved), `"father"` (lead-approved), `"mom "` (lead-approved), `"dad "` (lead-approved), `"sister"` (lead-approved), `"brother"` (lead-approved), `"daughter"` (lead-approved), `"son "` (lead-approved), `"parents"` (lead-approved), `"sibling"` (lead-approved), `"aunt"` (lead-approved), `"uncle "` (lead-approved), `"cousin"` (lead-approved), `"grandmother"` (lead-approved), `"grandfather"` (lead-approved), `"family history of"` (lead-approved), `"family hx of"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.thirdParty` |
| `lexicon.clauses.chartIgnoreThirdParty` | `"her "` (lead-approved), `"his "` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.chartIgnoreThirdParty` |
| `lexicon.clauses.placeholderAsk` | `"This line holds unfilled template text (***)."` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.placeholderAsk` |
| `lexicon.clauses.sections.exam` | `"physical exam"` (lead-approved), `"physical examination"` (lead-approved), `"exam"` (lead-approved), `"examination"` (lead-approved), `"otoscopic exam"` (lead-approved), `"otoscopy"` (lead-approved), `"objective"` (lead-approved), `"vital signs"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.sections.exam` |
| `lexicon.clauses.sections.family` | `"family history"` (lead-approved), `"family hx"` (lead-approved), `"fhx"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.sections.family` |
| `lexicon.clauses.sections.skip` | `"allergies"` (lead-approved), `"allergy"` (lead-approved), `"medications"` (lead-approved), `"medication"` (lead-approved), `"meds"` (lead-approved), `"current medications"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.sections.skip` |
| `lexicon.clauses.sections.read` | `"hpi"` (lead-approved), `"history of present illness"` (lead-approved), `"interval history"` (lead-approved), `"ros"` (lead-approved), `"review of systems"` (lead-approved), `"past medical history"` (lead-approved), `"pmh"` (lead-approved), `"past surgical history"` (lead-approved), `"psh"` (lead-approved), `"social history"` (lead-approved), `"assessment"` (lead-approved), `"plan"` (lead-approved), `"assessment and plan"` (lead-approved), `"assessment/plan"` (lead-approved), `"a/p"` (lead-approved), `"impression"` (lead-approved), `"impression and plan"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.sections.read` |
| `lexicon.clauses.examItems` | `[]`: none (lead-approved; review round 2 removed `r_normal` and `x_objective`; the lead's D10 answer: nothing is captured inside an exam section) | `lexicon-delta-033.js` `fields[1].to.examItems` |
| `lexicon.clauses.redFlags.rf_thunderclap` | `"sudden severe headache"` (lead-approved), `"sudden onset severe headache"` (lead-approved), `"sudden-onset severe headache"` (lead-approved), `"maximal at onset"` (lead-approved), `"maximum intensity within"` (lead-approved), `"peak intensity within"` (lead-approved) (the lead struck sudden onset headache, sudden-onset headache, 2026-10-12) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_thunderclap` |
| `lexicon.clauses.redFlags.rf_focal` | `"diplopia"` (lead-approved), `"facial droop"` (lead-approved), `"facial weakness"` (lead-approved), `"dysarthria"` (lead-approved), `"dysphagia"` (lead-approved), `"hemiparesis"` (lead-approved), `"unilateral weakness"` (lead-approved), `"focal weakness"` (lead-approved), `"focal deficit"` (lead-approved), `"focal neurologic deficit"` (lead-approved), `"slurred speech"` (lead-approved) (the lead struck facial numbness, aphasia, 2026-10-12) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_focal` |
| `lexicon.clauses.redFlags.rf_vision` | `"loss of vision"` (lead-approved), `"papilledema"` (lead-approved), `"papilloedema"` (lead-approved) (the lead struck vision loss, visual loss, visual obscuration, 2026-10-12) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_vision` |
| `lexicon.clauses.redFlags.rf_gca` | `"scalp tenderness"` (lead-approved), `"jaw claudication"` (lead-approved), `"temporal artery tenderness"` (lead-approved) (the lead struck jaw pain with chewing, jaw pain when chewing, jaw pain on chewing, 2026-10-12) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_gca` |
| `lexicon.clauses.redFlags.rf_orbital` | `"proptosis"` (lead-approved), `"painful eye movement"` (lead-approved), `"restricted eye movement"` (lead-approved), `"ophthalmoplegia"` (lead-approved) (the lead struck periorbital swelling, periorbital edema, periorbital oedema, orbital swelling, eye pain, pain with eye movement, pain on eye movement, 2026-10-12) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_orbital` |
| `lexicon.clauses.redFlags.rf_ssnhl` | `"sudden hearing loss"` (lead-approved), `"sudden sensorineural"` (lead-approved), `"ssnhl"` (lead-approved), `"sudden snhl"` (lead-approved), `"sudden deafness"` (lead-approved), `"sudden onset hearing loss"` (lead-approved), `"sudden-onset hearing loss"` (lead-approved), `"sudden loss of hearing"` (lead-approved), `"sudden drop in hearing"` (lead-approved), `"sudden decrease in hearing"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_ssnhl` |
| `lexicon.clauses.redFlags.rf_asym` | `"unilateral hearing loss"` (lead-approved), `"unilateral tinnitus"` (lead-approved), `"unilateral snhl"` (lead-approved), `"unilateral sensorineural"` (lead-approved), `"asymmetric hearing"` (lead-approved), `"asymmetrical hearing"` (lead-approved), `"asymmetric snhl"` (lead-approved), `"asymmetric sensorineural"` (lead-approved), `"left-sided hearing loss"` (lead-approved), `"right-sided hearing loss"` (lead-approved), `"asymmetric hearing loss"` (lead-approved) (the last three added at the sign-off, D8) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_asym` |
| `lexicon.clauses.redFlags.rf_pulsatile` | `"pulse-synchronous"` (lead-approved), `"pulse synchronous"` (lead-approved), `"pulsing tinnitus"` (lead-approved), `"pulsating tinnitus"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_pulsatile` |
| `lexicon.clauses.redFlags.rf_progressive` | `"steadily worsening"` (lead-approved), `"worsening headache"` (lead-approved), `"progressive headache"` (lead-approved), `"worse on waking"` (lead-approved), `"worse upon waking"` (lead-approved), `"worse with cough"` (lead-approved), `"worse with valsalva"` (lead-approved), `"worse with strain"` (lead-approved), `"worse lying flat"` (lead-approved), `"worse when lying flat"` (lead-approved), `"worse when supine"` (lead-approved), `"wakes from sleep"` (lead-approved), `"waking from sleep"` (lead-approved), `"wakes him from sleep"` (lead-approved), `"wakes her from sleep"` (lead-approved), `"waking him from sleep"` (lead-approved), `"waking her from sleep"` (lead-approved), `"awakens from sleep"` (lead-approved), `"progressively worse"` (lead-approved), `"progressively worsening"` (lead-approved), `"worse each week"` (lead-approved) (the last three added at the sign-off, D8) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_progressive` |
| `lexicon.clauses.redFlags.rf_new50` | `"new headache over 50"` (lead-approved), `"new headache after 50"` (lead-approved), `"new headache after age 50"` (lead-approved), `"new onset headache after 50"` (lead-approved), `"new-onset headache after 50"` (lead-approved), `"new onset headache after age 50"` (lead-approved), `"new-onset headache after age 50"` (lead-approved), `"first-ever severe headache"` (lead-approved), `"first ever severe headache"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_new50` |
| `lexicon.clauses.redFlags.rf_mass` | `"epistaxis"` (lead-approved), `"unilateral nasal obstruction"` (lead-approved), `"one-sided nasal obstruction"` (lead-approved), `"right-sided nasal obstruction"` (lead-approved), `"left-sided nasal obstruction"` (lead-approved), `"right nasal obstruction"` (lead-approved), `"left nasal obstruction"` (lead-approved), `"nasal mass"` (lead-approved), `"intranasal mass"` (lead-approved), `"sinonasal mass"` (lead-approved), `"nasal cavity mass"` (lead-approved), `"cheek numbness"` (lead-approved), `"v2 numbness"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_mass` |
| `lexicon.clauses.redFlags.rf_systemic` | `"fever"` (lead-approved), `"febrile"` (lead-approved), `"weight loss"` (lead-approved), `"immunosuppress"` (lead-approved), `"immunocompromised"` (lead-approved), `"malignancy"` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.redFlags.rf_systemic` |
| `lexicon.clauses.strictConflict` | `x_purulent`, `x_objective`, `x_lowfreq`, `x_anosmia` (lead-approved) | `lexicon-delta-033.js` `fields[1].to.strictConflict` |
| `lexicon.clauses.redFlagNegation` | `true` (lead: the decision of 2026-10-11, "Don't raise, no listing") | `lexicon-delta-033.js` `fields[1].to.redFlagNegation` |
| `lexicon.clarify[0]` `cl_rhinorrhea` (lead) | probe `pr_purulence`; ask `"is the rhinorrhea clear or purulent?"` (lead, verbatim); ph `"runny nose"`, `"rhinorrhea"`, `"rhinorrhoea"`, `"nasal discharge"`, `"nasal drainage"`, `"post-nasal drip"`, `"postnasal drip"`, `"post nasal drip"`, `"drippy nose"` (triggers drafted by the team under the lead's entry); unless `"clear"`, `"watery"`, `"thin "` (triggers drafted by the team under the lead's entry); the sign-off (D8) removed purulent, thick, green, yellow, cloudy, discolored, discoloured, colored, coloured, culture | `lexicon-delta-033.js` `fields[2].to[0]` |
| `lexicon.clarify[1]` `cl_tinnitus_quality` (lead-approved) | probe `pr_tinnitus_quality`; question and answers the module's; ph `"tinnitus"`, `"ringing"`, `"ear ring"`, `"ears ring"`, `"roaring"`, `"buzzing"`, `"hissing"` (lead-approved); unless `"pulsatile"`, `"whooshing"` (lead-approved); the sign-off (D8) removed clicking, steady | `lexicon-delta-033.js` `fields[2].to[1]` |
| `lexicon.clarify[2]` `cl_laterality` (lead-approved) | probe `pr_laterality`; question and answers the module's; ph `"tinnitus"`, `"ringing"`, `"ear full"`, `"ears feel full"`, `"fullness in my ear"`, `"plugged"`, `"hearing loss"`, `"decreased hearing"` (lead-approved); unless `"bilateral"`, `"both ears"`, `"alternat"` (lead-approved) | `lexicon-delta-033.js` `fields[2].to[2]` |
| `lexicon.clarify[3]` `cl_hearing_onset` (lead-approved) | probe `pr_sudden_drop`; question and answers the module's; ph `"hearing loss"`, `"decreased hearing"`, `"muffled hearing"`, `"trouble hearing"`, `"hard of hearing"` (lead-approved); unless `"gradual"`, `"slowly"` (lead-approved); the sign-off (D8) removed progressive | `lexicon-delta-033.js` `fields[2].to[3]` |
| `lexicon.clarify[4]` `cl_audiogram` (lead-approved) | probe `pr_audiogram`; question and answers the module's; ph `"hearing loss"`, `"decreased hearing"`, `"fluctuating hearing"` (lead-approved); no qualifier; the sign-off (D8) removed low-frequency, low frequency | `lexicon-delta-033.js` `fields[2].to[4]` |
| `lexicon.clarify[5]` `cl_dizziness_kind` (lead-approved) | probe `pr_internal_vertigo`; question and answers the module's; ph `"dizziness"`, `"dizzy"` (lead-approved); unless `"vertigo"`, `"spinning"`, `"room spins"`, `"lightheaded"`, `"light-headed"`, `"imbalance"`, `"unsteady"`, `"off balance"`, `"rocking"`, `"swaying"`, `"bobbing"` (lead-approved) | `lexicon-delta-033.js` `fields[2].to[5]` |
| `lexicon.clarify[6]` `cl_otalgia` (lead-approved) | item `n_otalgia`; question and answers the module's; ph `"ear pain"`, `"otalgia"`, `"ear hurts"`, `"ear discomfort"` (lead-approved); no qualifier; the sign-off (D8) removed deep | `lexicon-delta-033.js` `fields[2].to[6]` |
| `lexicon.clarify[7]` `cl_smell` (lead-approved) | probe `pr_smell`; question and answers the module's; ph `"hyposmia"`, `"anosmia"`, `"loss of smell"`, `"decreased smell"`, `"reduced smell"` (lead-approved); unless `"only during"` (lead-approved); the sign-off (D8) removed between episodes, between flares, persistent, constant, all the time | `lexicon-delta-033.js` `fields[2].to[7]` |
| `lexicon.clarify[8]` `cl_nasal_side` (lead-approved) | probe `pr_nasal_mass`; question and answers the module's; ph `"nasal obstruction"`, `"nasal congestion"`, `"congestion"`, `"stuffy"`, `"blocked nose"`, `"stuffed up"` (lead-approved); unless `"bilateral"`, `"both sides"`, `"alternat"` (lead-approved) | `lexicon-delta-033.js` `fields[2].to[8]` |
| `lexicon.clarify[9]` `cl_hints` (lead-approved) | probe `pr_head_impulse`; question and answers the module's; ph `"hints negative"`, `"hints normal"`, `"hints positive"`, `"hints benign"` (lead-approved); unless `"saccade"`, `"skew"`, `"direction-changing"`, `"head impulse"` (lead-approved) | `lexicon-delta-033.js` `fields[2].to[9]` |
| `lexicon.clarify[10]` `cl_neck` (lead-approved) | probe `pr_neck`; question and answers the module's; ph `"cervicalgia"`, `"neck pain"`, `"neck ache"`, `"neck stiffness"` (lead-approved); unless `"during"`, `"before"`, `"after"`, `"with the episodes"`, `"attack"` (lead-approved) | `lexicon-delta-033.js` `fields[2].to[10]` |
| `lexicon.clarify[11]` `cl_viral_onset` (lead-approved) | item `n_viral`; question and answers the module's; ph `"upper respiratory infection"`, `"respiratory infection"`, `"covid"`, `"influenza"`, `"viral"` (lead-approved); unless `"after"`, `"since"`, `"following"`, `"post"` (lead-approved) | `lexicon-delta-033.js` `fields[2].to[11]` |
| `lexicon.clarify[12]` `cl_scan_report` (lead-approved) | probe `pr_scan_detail`; question and answers the module's; ph `"ct showed"`, `"scope showed"`, `"lund-mackay"` (lead-approved); no qualifier; the sign-off (D8) removed scan showed inflammation, opacification, mucosal thickening, polyps | `lexicon-delta-033.js` `fields[2].to[12]` |
| `lexicon.clarify[13]` `cl_audiogram_report` (lead-approved) | probe `pr_audiogram`; question and answers the module's; ph `"audiogram showed"`, `"hearing test showed"` (lead-approved); no qualifier; the sign-off (D8) removed low frequency loss, hearing drops during, hearing comes back | `lexicon-delta-033.js` `fields[2].to[13]` |
| `lexicon.goldSet` | `{version: "0.4.0", lexiconVersion: "0.3.3", file: "masque_extraction_goldset_0.4.0.json"}` (replaces the 0.3.0 value) | `lexicon-delta-033.js` `fields[3]` |

The extractor's ten checks for this delta:

1. the delta applies after the 0.3.2 delta (its `from` is that delta's `to`); `revertLexiconDelta`
   gives back the 0.3.2 lexicon and `revertLexiconChain` the baseline lexicon exactly, key order
   included; `clauses` and `clarify` sit just before `goldSet`;
2. release 0.4.7; the lead's request (dated 2026-10-11, by the clinical lead) and the three answers
   of that date are recorded, the answers exactly "Don't raise, no listing", "Clickable answers
   (Recommended)" and "Draft, you sign off (Recommended)"; `signOff` is the clinical lead's of
   2026-10-12;
3. the `lead` rows of `clauses` are exactly the verbs the request names (affirm `endorses`,
   `reports`, `has `, `yes`; deny `denies`, `no `, `lacks`, `doesn't have`), each found in the
   request, and every other row is `lead-approved` (no plain draft is left);
4. exactly one `clarify` entry is the lead's: it asks "is the rhinorrhea clear or purulent?",
   verbatim and found quoted in the request; every other entry is `lead-approved` with no `ask` of
   its own (it asks the module's question);
5. every `clarify` entry names exactly one probe of the logic or one item; every `examItems` id is
   an item; `redFlagNegation` and `wordStart` are on; every `chartIgnoreThirdParty` cue is a cue of
   `lexicon.thirdParty.cues`; `strictConflict` is exactly the yes/no entries of the negative
   (rule-out) domains, in item order (release 0.4.7 fixes before review); `clauses.redFlags` names
   every red flag of the module and nothing else (review round 2);
6. one basis per `clauses` row (the `clauses.redFlags` rows included), switch, `clarify` entry and
   appended negation cue (review round 1; the empty `examItems` has one basis of its own since review
   round 2), none stray; a lead row's basis cites the lead and a lead-approved row's keeps its
   drafting record ("Draft …"); the
   `redFlagNegation` basis cites the lead's decision of 2026-10-11;
7. the one appended row (negation cues) is `lead-approved`;
8. gold set 0.4.0 carries `_meta.version` and `lexiconVersion` equal to `lexicon.goldSet`,
   `basedOn` pins the reference file and its 44 cases, and `includes` pins gold set 0.3.0 by its
   SHA-256, 218 cases and 93 dialogues;
9. the change-log entry (kind `lexicon`, dated as the sign-off, 2026-10-12, paths exactly the paths
   the delta touches, the note saying the lead signed it off and quoting the lead's question) is the
   last;
10. the sign-off record is complete and applied (`lexicon033SignOffProblems` of
   `app/tests/harness/diff.js`): by, date, scope and channel; every row's outcome, the totals equal to
   them; the 19 Part D answers and the D8 follow-up answers among their options; no plain draft left;
   every struck row absent; every approved row present as `lead-approved`; the rows added and the
   qualifiers removed at the sign-off in place.

### Clinician question for item r_dur (release 0.4.8)

This value is typed once, in `app/tests/harness/question-delta-048.js` (`QUESTION_DELTA`), not in
`HAND`. It rests on the clinical lead's request in chat of 2026-10-12, kept verbatim in
`QUESTION_DELTA.request`: "Fix 2: Question: recalcitrance / How long has this been going on? / Is a
yes/no, if phrasing it as such it should ask "Have symptoms persisted over 3 months despite trials
of medical management?"". `extract-rubric.js` applies it last, with `applyQuestionDelta`, under
`/domains/<i>/items/<j>/ask` only: the item at the path must be the row's item and its `ask` must
still be the row's `from` (the baseline Scribe's `ASK`), and `revertQuestionDelta` must give back
the rubric without the change exactly, key order included. The `question` change-log entry follows
the 0.4.7 `lexicon` entry.

| Path | Value | Basis |
|---|---|---|
| `/domains/0/items/0/ask` (`r_dur`) | `Have symptoms persisted over 3 months despite trials of medical management?` (was `How long has this been going on?`, Scb L242-273 `ASK.r_dur`) | L: the clinical lead's sentence, verbatim (request, chat, 2026-10-12), replacing the baseline Scribe question, which asked for a duration while the item's answers are Yes / No. Shown wherever the item's clinician question is shown: the Scribe's Ask-next card and heard card, and the Rubric Editor's ask field. The scored statement, weight and patient wording are unchanged; `ask` is outside `instrumentHash` and `scoringHash`. |

The extractor's six checks for this delta:

1. the change is exact: one item question changed from its baseline value, nothing else, and
   `revertQuestionDelta` gives back the rubric without it, key order included;
2. release 0.4.8, requested by the clinical lead in chat on a real calendar date (2026-10-12), the
   request recorded as written;
3. each new question is a sentence the lead quoted, verbatim, on the yes / no item the request names
   by its card tag (its domain label, lowercased), and each old one is the baseline Scribe `ASK` the
   request quotes;
4. `instrumentHash`, `scoringHash` and `lexiconHash` are unchanged by it and `contentHash` changes;
   the instrument and lexicon versions are unchanged;
5. one basis per changed question;
6. the change-log entry (kind `question`, dated as the request, paths the changed paths, quoting the
   new question) follows the 0.4.7 lexicon entry; since the 0.4.8 follow-up the `emr-plan` entry
   follows it.

### Plan line of the EMR template (release 0.4.8, follow-up)

This value is typed once, in `app/tests/harness/emr-plan-delta-048.js` (`EMR_PLAN_DELTA`), not in
`HAND` and not in `emr-delta.js` or `emr-decisions-delta.js`, which are untouched. It rests on the
clinical lead's request in chat of 2026-10-12, kept verbatim in `EMR_PLAN_DELTA.request` ("Also
recommendations in the plan should also add "recommend a trial of migraine abortives if not
contra-indicated due to other conditions." so that a primary doctor can offer this as an option to
the patient for relief in the interim."), and on the lead's two answers of the same day
(`EMR_PLAN_DELTA.quotes`: each question, the chosen option's label and its description, verbatim; the
options not chosen were not kept with the answers): "With the treatment refs, no red flag
(Recommended)" and "EMR template note (Recommended)". `extract-rubric.js` applies it last, with the
0.4.6 answers' `applyEmrDecisionsDelta`, under `/emrTemplate` only: its one `added` row adds
`planAdvice` at the end of `emrTemplate`, a key that must not exist yet, and
`revertEmrDecisionsDelta` must give back the rubric without it exactly, key order included. The
`emr-plan` change-log entry follows the 0.4.8 `question` entry.

| Path | Value | Basis |
|---|---|---|
| `/emrTemplate/planAdvice/0` | `{text: "recommend a trial of migraine abortives if not contra-indicated due to other conditions.", source: "lead", decided: "2026-10-12"}` | L: the clinical lead's sentence, verbatim (request, chat, 2026-10-12), stored and printed exactly as written. Printed by `engine/emr.js` as a plan line ("- " and the text) right after the empiric-treatment reference lines and before the treatment-offered placeholders, only where those references print with no red flag open (quotes.when), in the EMR Friendly Template only, on the Screener and the Scribe (quotes.outputs). Under an open red flag the screen-based block keeps the references but not this line. No citation: the line is the lead's recommendation, not a reference. `source` and `decided` are the line's record and are not printed. |

The extractor's eight checks for this delta:

1. the addition is exact: `planAdvice` added last in `emrTemplate`, nothing else, and
   `revertEmrDecisionsDelta` gives back the rubric without it, key order included;
2. release 0.4.8, requested by the clinical lead in chat on a real calendar date (2026-10-12), the
   request recorded as written;
3. the two answers recorded with their questions and the chosen options' descriptions (when: with
   the treatment refs, no red flag; outputs: the EMR template note);
4. `planAdvice` is exactly one line, the sentence the lead quoted (in the request and in the
   question), verbatim, with `source` "lead" and `decided` the request's date;
5. every added string is non-empty and carries no `[ ] { }`;
6. `instrumentHash`, `scoringHash` and `lexiconHash` are unchanged by it and `contentHash` changes;
   the instrument and lexicon versions are unchanged;
7. one basis per plan-advice line;
8. the change-log entry (kind `emr-plan`, dated as the request, paths the added path, quoting the
   line) is the last, right after the 0.4.8 question entry.

### Patient chrome of release 0.4.8 (AI translation, unreviewed)

Not rubric data: engine chrome in `app/src/engine/patient.js` (`PATIENT_CHROME`), recorded with a
basis each in `app/tests/harness/patient-chrome-048.js` and pinned byte for byte by the `values`
suite (`PATIENT_CHROME.es` carries exactly the baseline `UI.es` keys, the 0.4.2 chrome keys and
these). The English was written by the team as interface labels for the clinical lead's requests of
2026-10-12 (Fix 1 and Fix 3); the Spanish is an AI translation, not reviewed by a qualified medical
translator or a bilingual clinician. `locales.es.reviewed` stays `false`.

| Key | English | Spanish (unreviewed) | Use |
|---|---|---|---|
| `videoShow` | Watch a 1-minute introduction | Ver una introducción de 1 minuto (video en inglés) | the video panel's button while the video is hidden |
| `videoHide` | Hide the video | Ocultar el video | the button while the video is shown |
| `videoTitle` | Introduction video | Video de introducción (en inglés) | the frame's title (accessible name) |
| `englishVersion` | English version, for an English-speaking clinician | Versión en inglés, para un médico de habla inglesa | the title of the English version of a Spanish summary (screen, print, `.txt`, `.html`), in both languages |

### Patient introduction video (release 0.4.8)

Not rubric data: media of the built-in module, named on its entry in `app/modules/registry.json`
(`patientVideo`), shown by the Patient Companion above its instructions at the clinical lead's
request of 2026-10-12 ("Add the attached video above the patient companion instructions, make it a
collapsible/hideable iframe."). None of it is in a hash of the rubric.

| File (under `app/modules/masque/media/`) | Bytes | SHA-256 | Source |
|---|---|---|---|
| `patient-companion-intro.mp4` | 14,783,849 | `3ce9088b6c26bcb4d3c370c8d20f0269d8d7a973d8f4be3ab2d745eb89800a28` | the clinical lead's video, as supplied (60.04 s, 1280 × 720 H.264 + AAC, moov at the front; English captions burned in); not re-encoded |
| `patient-companion-intro-poster.jpg` | 78,113 | `d3c0a2c2dd2e0a7ec50a7734b6401f5cc198f4b364dc250449d182a40ebb5c4b` | the video's frame at 0.5 s, drawn at 1280 × 720 and saved as JPEG (quality 0.8) |
| `patient-companion-intro.html` | — | — | the frame page, written by the team: no script, `noindex, nofollow`, the prototype marker, one `<video controls preload="none" playsinline>` with the poster and the MP4 |

## Field map

| Field | Baseline source | Notes and reconciliation choice |
|---|---|---|
| `instrumentVersion` | Scr L45 `INSTRUMENT_VERSION` | Checked equal to Scb L153 and Pat L54. |
| `domains[]` `key`, `label`, `max`, `negative`, `items[]` `id`, `w`, `text`, `scale`, `ref` | Scr L172-255 `ITEMS`, L257 `DOMAIN_ORDER` | Copied in the Screener's key order. **Canonical: the Screener** (Inv §2). It is checked deep-equal to the Scribe's `ITEMS` (Scb L51-134). The Simulator's item copy (Sim L31-74, with no `f` factors and linear scoring) is dropped (changelog). |
| `domains[].items[].short` | Scb L1309-1322 `shortLabel` | `shortLabel({id})` for every item. It has 29 entries; `n_allo` returns its own id, so it gets no `short` and the id is shown, as today (Q24, V12 warning). |
| `domains[].items[].ask` | Scb L242-273 `ASK` | Covers all 30 items. Since release 0.4.8 `r_dur`'s is the clinical lead's question of 2026-10-12 (`question-delta-048.js`). |
| `domains[].items[].tag` | Scb L275-280 `VMPATHI_TAG` | 4 items. |
| `domains[].items[].patientClin` | Pat L63-124 `ITEMS[].items[].c` | Weight, domain and scale length are checked against the Screener. The Patient domain `label`/`clinical` fields are never read and are dropped (changelog). |
| `domains[vestibular].shortTag` | Scb L872 | `it.domain === "vestibular" ? "vestibular" : label.toLowerCase()`. Other domains fall back to `label.toLowerCase()`. |
| `bands.cuts` | Scr L334 `BAND_CUTS` | Checked equal to Scb L295. |
| `contextItems[]` `id`, `text`, `options` | Scr L1190-1194 (`ContextQ` rows) | `t` → `text`, `opts` → `options` (the clinician vocabulary). |
| `contextItems[].captureLabel` | Scb L1299-1308 `capLabel` | The `c_*` map at L1302. |
| `contextItems[].signal` | `value` and `screenerLabel`: Scr L873-877; `scribeLabel`: Scb L916-920; `noteLabel`: Scb L1345-1349 | All four sources agree on the ids and values (`3+`, `>12mo`, `yes`), and so does Pat L955-957. |
| `gapRule` | `threshold`: Scr L878 (= Scb L921 = Pat L956); `markers`: Pat L957 `S.gap` argument order; `noteOrder`: Scb L1345-1349 | `markers` = `c_clin, c_dur, c_dismiss`, which is also the Screener order. `noteOrder` = `c_dur, c_clin, c_dismiss`. |
| `redFlags[]` `id`, `tier`, `group`, `text`, `points`, `action` | Scr L110-147 `RED_FLAGS` | **Canonical: the Screener wording** (Inv §2, D7, Q5). The Scribe's copy (Scb L189-238) differs in text, points or action for 11 of the 12 flags and is dropped (AD6); the Simulator's variant (Sim L117-130) is dropped. Ids, order, tiers and groups are checked equal to the Scribe's. |
| `redFlags[].ask` | Scb L189-238 `RED_FLAGS[].ask` | Kept as unread data (Q6). |
| `steps.screener[].key`, `.rail` | Scr L82-91 `STEPS` | `{eyebrow, title}`. |
| `steps.screener[]` `kind`, `domainKeys`, `extras`, `requires`, `card`, `domainIntro` | Safety card Scr L1023-1028; intake L1068-1070 with the picker L1071-1084 and QGroup L1086 (`domainIntro`); StepCards L1090-1092, L1094; impact L1098-1100 with QGroup L1101 and ContextQ L1103; result L1221; `requires`: L888 | Eyebrow, h2 and `stepsub` are compiled JSX text (`&amp;` → `&`). The result card has only its eyebrow; its heading is `copy.indexName` (§5.3). |
| `steps.patient` | Pat L531-541 `SECTIONS`; story L703-724 (context questions L709, QBlock recalcitrance L720); domain steps L726 | Intro, safety and summary are shell-fixed (§3.2). |
| `phenotypes.values` | Scr L1072-1076 | `{k, h, d}` → `{value, h, d}`, in picker order. |
| `phenotypes.scribeDefault` | Scb L849 | `"sinonasal"`. |
| `phenotypes.alwaysActive` | Scb L857 | In source order. |
| `phenotypes.tagBoostDomain` | Scb L862-866 | `vestActive` gates the tag boost. |
| `phenotypes.referral` | Scr L1455-1456, L1577; Scb L1401, L1453 | Taken from the baseline `buildBundle` referral text (`Referral: {specialty} — evaluate for {reason}`) for each phenotype value. Screener and Scribe are checked to give identical text; only `otologic` differs from the default. **Release 0.4.5:** then the clinical lead's referral rule is applied: `byPhenotype.otologic.specialty` becomes `Neurology` (the baseline value `Neuro-otology` is required by `applyReferralDelta`), `byPhenotype.both` is added (`Neurology`, with the default's reason) and `clinicianRules` is added (see "Referral rule for dizziness cases (release 0.4.5)"). |
| `phenotypes.cdsTerm` | Scr L1344 | The `complaint === "otologic" ? "otologic" : "sinonasal"` ternary. |
| `infoPrompts` | `prompts`: Scb L282-285 `VMPATHI_INFO`; `gateDomain`: L862; `maxScored`: L871; `maxTotal`: L876; `tagPrefix`: L1344 | |
| `sampleCases[0..3]` | Scr L261-312 `SAMPLE_CASES`; `buttonLabel` and `icon` from Scr L994-997 | The object key becomes `id`. `group` defaults to "sample" and `safetyReviewed` to true (Scr L855), so neither is written. |
| `sampleCases[4..8]` | Sim L314-330 `SCENARIOS`, L308-312 `FULL_HIGH` | `sim-<id>`, `group: "scenario"`, icon by name, `why` kept, `answers` from `apply()` (FULL_HIGH inlined), `rf` only when not empty, `complaint: ""`, `step` dropped. `buttonLabel` = `label`, which is what Sim L652 renders (Q3, changelog). |
| `demo.patient` | Scr L314-317 `DEMO_PATIENT` | Checked deep-equal to Scb L587 `PATIENT`. It has no DOB (V50). |
| `demo.transcript` | Scb L569-584 `SCRIPT` | The Simulator's 7-turn transcript is not carried. |
| `lexicon` | Ext L24 `LEXICON_VERSION`; L38-48 `NEGATION`; L57-62 `THIRD_PARTY`; L69-73 `HISTORICAL`; L79-106 `BOOL_EX`; L108-110 `CTX_EX`; L112-134 `SCALE_EX`; L136-141 `MULTI_EX`; L153-166 `RF_PHRASES`; then `tests/harness/lexicon-delta.js` | Keys are renamed only (`negation`, `thirdParty`, `historical`, `bool`, `ctx`, `scale`, `multi`, `redFlags`). `lang` comes from Voice L47 `VOICE_LANG`. `goldSet` is described under the hand-written values. The Simulator's cue lists (Sim L1028-1041) are not carried. That is the baseline lexicon 0.3.1; the approved delta then gives 0.3.2: phrases appended at list ends, `heard`, `carry` and `carryExclude` added at the end of `scale[1]`, `yieldTo` and `anchor` at the end of `scale[2]`, `carryRefuse` and `normalize` inserted just before `goldSet`, and `version` and `goldSet` replaced in place (see "Approved lexicon delta"). Release 0.4.7: `tests/harness/lexicon-delta-033.js` then gives 0.3.3: four negation cues appended at the end of `negation.cues`, `clauses` and `clarify` inserted just before `goldSet`, and `version` and `goldSet` replaced in place (see "Lexicon delta 0.3.2 → 0.3.3"). |
| `locales.en.items` / `locales.es.items` | Pat L137-188 `P` / L297-348 `ES_P` | Copied verbatim; P key order = item order (checked). |
| `locales.es.items.<id>.clin` (30 items; release 0.4.2) | `tests/harness/locale-delta.js` | The Spanish clinician line for the "Para mi médico" block, one per item, inserted after the item's last existing key. Its English source is the item's `patientClin` (checked). Unreviewed team translation; see "Spanish translation delta (unreviewed)". English has no `clin`. |
| `locales.en.redFlags` / `locales.es.redFlags` | Pat L225-262 `RED_FLAGS` `{q, say}` / L350-375 `ES_RF` | The Patient's `now`/`soon` tiers are checked to be emergent→now and urgent→soon; the rubric keeps the clinician tier, and `TIER_DISPLAY` maps it. |
| `locales.en.contextItems` | Pat L522-529 `CONTEXT_Q` | The Patient's own values and labels, **not realigned** (D19, Q8). Until release 0.4.2 es fell back to en (V33 warning). |
| `locales.es.contextItems` (release 0.4.2) | `tests/harness/locale-delta.js` | Spanish `q` and option labels for `c_clin`, `c_dur`, `c_dismiss`, inserted after `redFlags`. The option values are the English ones, in the English order (checked), so the gap rule's `3+`, `>12mo` and `yes` are unchanged. Unreviewed team translation. |
| `locales.*.steps.*.title` | Pat L383, L405 `UI[loc].sections[2..7]` | Indexed through `SECTIONS`. |
| `locales.*.steps.<domain>.lede` | Pat L768-774 `BLURB`, L761-767 `BLURB_ES` | |
| `locales.en.steps.story` `heading`, `lede`, `intro` | Pat L705, L706-707, L720-721 | English only in the baseline; until release 0.4.2 es fell back (Q9). |
| `locales.es.steps.story` `heading`, `lede`, `intro` (release 0.4.2) | `tests/harness/locale-delta.js` | Inserted after the existing es `title`, in the English key order. Unreviewed team translation (Q9 answered). |
| `locales.*.ui.sub` | Pat L381, L403 `UI[loc].sub` | |
| `locales.en.ui.forYouIf` | Pat L787-789 | |
| `locales.es.ui.forYouIf` (release 0.4.2) | `tests/harness/locale-delta.js` | Three bullets, element for element with the English, inserted after the es `sub`. Unreviewed team translation. |
| `locales.en.ui.clinicianLede` | Pat L1066-1070 | `{INSTRUMENT_VERSION}` → `{instrument}`, `<b>−</b>` → `**−**`. |
| `locales.es.ui.clinicianLede` (release 0.4.2) | `tests/harness/locale-delta.js` | Sentences 1-2 are `SUM.es.clinNote` (masque.logic.js) byte for byte with `${v}` → `{instrument}`; sentence 3 is new. Keeps `{instrument}` and a balanced `**−**` (V39). Unreviewed team translation. |
| `locales.*.reviewed` | Pat L294 `REVIEWED` | en `true`, es `false`. es stays `false` after the release 0.4.2 delta: the new Spanish is an unreviewed team translation. |
| `research` `title`, `target`, `threshold`, `calibration.{midpoint,slope}`, `sources`, `expected`, `demo` | RRP L26-56 `PROJECTS.MASQUE` | Copied verbatim, including the deliberate sex/gender divergence and the gender-only row. `projectKey` = the panel project named at Scr L1137 (= Scb L1266). BREATHE and VOICED stay in the panel (changelog). |
| `research.calibration.appliesTo.scoringHash` | `engine/hash.js` `rubricHashes` | Computed by the extractor with WP0's implementation, the one the binder calls. |
| `research.scoreAliases` | RRP L198 (= L217) | The brand alias among the `numOrNull` arguments (`masque_score`). |
| `research.artifactKey` | RRP L839 | `masqueArtifact`. |
| `research.etlScript` | RRP L966 (also named at L779) | `app/etl/…` made relative to `app/`: `etl/masque_population_etl.R`. |
| `research.fairnessAxes` | RRP L942 | `["sex","gender"]`. |
| `research.demoCohorts` | Sim L677-681 `COHORTS`; spec from Sim L285-305 `makeCohort` | `seed`, `prevalence`, score ranges as `[base, span]` (`base + R()*span`), groups `{sex, gender, n, hi, labeled}` in push order, and the extra row. Each spec is regenerated with the same LCG and checked deep-equal to `makeCohort(kind)` for all three kinds. |
| `research.population` | Pop L31-33 | `INDEX_PATH`, `SCHEMA_PATH`, `MAP_PATH`. |
| `fhir.questionnaireName`, `questionnaireTitle`, `publisher`, `description` | Scr L429-438 | Taken from the baseline `buildQuestionnaire()` output. |
| `fhir.safetyGroupText` | Scr L443 | |
| `fhir.indexDisplay` | Scr L1537 (= Scb L1425) | |
| `fhir.documentType`, `documentTitle` | Scb L1445-1446 | DocumentReference `type.text` and attachment title. |
| `cds.hook`, `title`, `description`, `source.label` | Scr L478-483, L500 | Taken from the baseline `buildCdsHooks()` output; checked identical to the Scribe's. |
| `cds.examples.redFlagPresent` | Scr L494-504 | `flagId` = the one flag whose `action` the example detail names (`rf_asym`); `summary` verbatim. The detail sentence and the indicator stay engine-owned (§3.6). |
| `cds.examples.settled` | Scr L505-513 | `summary`, `detail` verbatim; `score` and `band` are read from the summary and checked against `bandFor`. |
| `emrTemplate` (release 0.4.3) | `tests/harness/emr-delta.js` `EMR_DELTA.value` | Not from the baseline: the EMR template data (citations, references, instrument recs, red-flag references and placeholders, history, checklist, exam rows), inserted just before `changelog` and proven exact by `revertEmrDelta`. AI agents assembled it from verified sources; the clinical lead signed it off on 2026-10-07 (recorded in release 0.4.4); see "EMR template data (release 0.4.3, signed off by the clinical lead in 0.4.4)". Clinician surfaces only; locked in the Rubric Editor. **Release 0.4.6:** then `pastHistory` and the HINTS row's `optionPlaceholders` are added by `applyEmrDecisionsDelta` (`tests/harness/emr-decisions-delta.js`; see "EMR template: the clinical lead's answers (release 0.4.6)"). **Release 0.4.8, follow-up:** then `planAdvice` is added the same way (`tests/harness/emr-plan-delta-048.js`; see "Plan line of the EMR template (release 0.4.8, follow-up)"). |

### Copy slots (§3.6)

| Slot | Baseline source | Cut |
|---|---|---|
| `copy.indexName` | Scr L1243 | The result h2. |
| `copy.gate.patternPhrase` | Scr L898 | Between "…is treated as a " and ". " in the override recommendation. |
| `copy.screener.title` | Scr L1005 | The brand-row `t1` text before the version span, trimmed. |
| `copy.screener.subtitle` | Scr L1006 | `t2`; `&amp;` → `&`. |
| `copy.screener.bandSuffix` | Scr L1255 | The text after `{bandMeta.label}`. |
| `copy.screener.gapAlert.title` / `.body` | Scr L1303 / L1304-1308 | The body without the engine prefix `labels.join(" · ") + ". "`. |
| `copy.screener.disclaimer` | Scr L1426-1429 | |
| `copy.screener.emrDetails[]` | Scr L1435-1439 | Five `<div>`s; `<b>…</b>` → `**…**`. |
| `copy.screener.specIntro` | Scr L1404-1405 | |
| `copy.scribe.title` / `.subtitle` | Scb L958 / L959 | As for the Screener. |
| `copy.scribe.gapAlert.title` / `.body` | Scb L1079 | The body without the engine prefix. |
| `copy.scribe.vmpathiDisclaimer` | Scb L1252 | |
| `copy.scribe.about[]` | Scb L1259-1262 | Four `<div>`s; `<b>…</b>` → `**…**`. |
| `copy.note.title` | Scb L1352 | The first line of the note template. |
| `copy.note.screenHeading` | Scb L1368 | The text before `${scorable ? "" : " — INCOMPLETE, NO RESULT ISSUED"}`. |
| `copy.note.likelihoodOf` | Scb L1370 | The text after `Index ${total}/100 — ${band.toUpperCase()} `, without the final period. |
| `copy.note.patternPhrase` | Scb L1382 | The A&P red-flag line, between "…treating this as a " and the final period. |
| `copy.note.infoCovered` | Scb L1366 | The label before `": " + list + "."`. |
| `copy.note.gapLine` | Scb L1374 | Without its two-space indent. |
| `copy.note.supportingFooter` | Scb L1378 | Indent trimmed; "Instrument v0.3 candidates." kept verbatim (Q7). |
| `copy.note.noDriver` | Scb L1390 | Without `"  • "`. |
| `copy.note.signOff` | Scb L1392 | The last note line. |
| `copy.cds.preview.safetyTitle` | Scr L1333-1335 | |
| `copy.cds.preview.indexTitle` | Scr L1343-1345 | The complaint ternary → `{cdsTerm}`. |
| `copy.cds.preview.indexBody` | Scr L1346-1349 | `{total}` kept, `{bandMeta.label}` → `{bandLabel}`, and the literal scale maximum `/100` → `/{scaleMax}` (move rule 2b). |
| `locales.en.ui.clinicianLede` | Pat L1066-1070 | See the field map. |

**Slot boundaries.** Note layout (two-space indents, `"  • "` bullets, the `": "` before a list)
and every engine-owned sentence in §3.6 stay in engine code. A slot holds only the module wording
between them. The `copy.cds.preview` slots sit under `copy`, where `COPY_SLOTS` places them, not
under `cds.preview`.

## Reconciliations (`changelog`, kind `reconciliation`)

1. Red flags take the canonical Screener wording. The Scribe's abbreviations and the Simulator
   variant are dropped; the Scribe's `ask` is kept as unread data.
2. Item text is canonical from the Screener. The Scribe's ASK becomes `ask`, its shortLabel becomes
   `short` (`n_allo` has none), VMPATHI_TAG becomes `tag`, and the Patient's `c` becomes
   `patientClin`. The Simulator items are dropped.
3. Patient context options keep the Patient's own values and labels; the signal values are
   identical in both vocabularies.
4. Patient `ITEMS[].label/clinical`, which are never read, are dropped; the section titles are used.
5. The Simulator scenarios are added as sample cases `sim-*`.
6. `PROJECTS.MASQUE` moves to `research`; BREATHE and VOICED stay in the panel.

The changelog also records the extraction itself and the open-question defaults this file carries
(Q1 label, Q7 note footer), and, dated 2026-10-04, the approved lexicon change 0.3.1 → 0.3.2,
and, dated 2026-10-06, the unreviewed Spanish translation of release 0.4.2 (kind `translation`)
and the EMR template data of release 0.4.3 (kind `emr-template`), and, dated 2026-10-07, the
clinical lead's sign-off of that data (kind `sign-off`, release 0.4.4), and, dated 2026-10-10,
the clinical lead's referral rule for dizziness cases (kind `referral`, release 0.4.5), and, dated
2026-10-10, the lead's answers on the EMR template's open items (kind `emr-decisions`, release
0.4.6), and, dated 2026-10-12, the lexicon change 0.3.2 → 0.3.3 (kind `lexicon`, release 0.4.7),
the clinical lead's question for item `r_dur` (kind `question`, release 0.4.8) and the clinical
lead's plan line for the EMR template (kind `emr-plan`, release 0.4.8, follow-up).

## Regenerating

Serve the project root, open `http://127.0.0.1:8901/app/tests/tools/extract-rubric.html` and wait
for the result card. "Identical to the committed modules/masque/masque.rubric.json" means nothing
has drifted. Otherwise use **Download masque.rubric.json** to replace the file, and review the
diff.

A lexicon change goes through `tests/harness/lexicon-delta.js` only (design 05 §6.5): the clinical
lead approves each phrase, it is appended to the delta, gold cases are added to the gold set file,
and the rubric is regenerated here. The extractor checks that every `entryId` names the entry at
its 0.3.1 position, that `revertLexiconDelta` gives back the baseline lexicon exactly, and that the
gold set file named by `goldSet` carries the matching `_meta`.

A change to the patient wording in `locales.es` goes through `tests/harness/locale-delta.js` only:
a row is added (never an existing Spanish string changed), and the rubric is regenerated here. The
extractor checks that each row's `en` equals the English at the same path (an item's `clin`: its
`patientClin`), that `revertLocaleDelta` gives back the baseline `locales.es` exactly with its key
order, that the context option values equal the English ones in order, that every item has a
`clin`, and that every chrome row names a `PATIENT_CHROME` key whose English matches and which
`PATIENT_CHROME.es` carries. Setting `locales.es.reviewed` to `true` is not a regeneration step: it
needs a bilingual clinical reviewer's sign-off, recorded as a decision.

A change to the EMR template data goes through `tests/harness/emr-delta.js` only. The data is
rewritten there with one basis entry per citation, reference, red-flag list, history row,
checklist row and exam row, and the rubric is regenerated here. The extractor runs the nine checks
listed under "EMR template data". A new citation must come from a verified source and is stored
as metadata and a link only. A new label must be a short name with its citation keys.
`EMR_DELTA.drafted.reviewed` was set to `true` in release 0.4.4. That was not a regeneration
step: it went with the clinical lead's sign-off of 2026-10-07, recorded in `EMR_DELTA.signOff`, and
a matching change to the extractor's check. The sign-off covers the data as it stands. A later change to a string, a
row or a citation is new content outside it: it needs the lead's sign-off again, recorded the same
way, and the `values` suite's pin of the signed-off block moves only with it.

A change to the referral rule goes through `tests/harness/referral-delta.js` only, and only with a
new clinical-lead decision recorded there (`decided`, `quotes`): a destination is changed by a
`changed` row whose `from` is the current value or an `added` `byPhenotype` row, with its
`destinations` row, a rule by its `added` value, with one basis per changed path, per added
`byPhenotype` row and per field of each rule, and the rubric is regenerated here. A lead's
amendment of a definition line is an `amendments` row (`{path, quote, removed}`) on a dated quote
of the lead, with the lead's earlier words kept in `quotes`. The extractor runs the ten checks
listed under "Referral rule for dizziness cases", and the `values` suite pins the record, the rule
and its change-log entry.

A change to the EMR template data the clinical lead decided after the sign-off goes through
`tests/harness/emr-decisions-delta.js` (release 0.4.6), only with the lead's dated answer recorded
there (`decided`, `quotes`): an `added` row adds a key under `/emrTemplate`, with one basis per
past-history row and per option placeholder, and the rubric is regenerated here. The extractor
runs the nine checks listed under "EMR template: the clinical lead's answers", and the `values`
suite pins the record, the added data, the signed-off block under it (`fb63a2b9…`) and the shipped
block (`0152cfd8…`).

The lexicon change of release 0.4.7 goes through `tests/harness/lexicon-delta-033.js`, the second
link of the delta chain, never through `lexicon-delta.js`. Each `clauses` row and `clarify` entry
carries its source (`lead`, `module` or `draft`) and one basis. The lead's sign-off is recorded
there (`signOff`, with its date) before any upload; a struck draft row is removed, the gold set
0.4.0 cases it affects are relabelled and the rubric is regenerated here. A new phrase is appended,
never inserted, so the 0.3.2 positions the delta's paths use stay valid. The extractor runs the nine
checks listed under "Lexicon delta 0.3.2 → 0.3.3", and the `values` suite proves the shipped lexicon
exactly 0.3.1 plus both deltas (AD13, AD18) and exempts exactly the delta's leaves from the
provenance sweep.

A change to an item's clinician question (`ask`) goes through `tests/harness/question-delta-048.js`
(release 0.4.8), only with the lead's dated request recorded there (`requested`, `request`): a
`changed` row names the item, the pointer of its `ask` and the current value as `from`, with one
basis per row, and the rubric is regenerated here. The extractor runs the six checks listed under
"Clinician question for item r_dur", and the `values` suite reads the baseline `ASK` pin on the
reverted rubric and pins the record. An `ask` is outside the instrument's identity; a change to an
item's statement, weight or scale is not a question change: it moves `instrumentHash` and needs a
new instrument version.

A plan line the clinical lead asks the EMR template to print goes through
`tests/harness/emr-plan-delta-048.js` (release 0.4.8, follow-up), only with the lead's dated request
and answers recorded there (`requested`, `request`, `quotes`): the line is the lead's own sentence,
verbatim, with its `source` and `decided` date, one basis per line, and the rubric is regenerated
here. The extractor runs the eight checks listed under "Plan line of the EMR template", and the
`values` suite pins the record, the line, the block of release 0.4.6 under it (`0152cfd8…`), the
signed-off block under every delta (`fb63a2b9…`) and the shipped block (`5f740853…`).
