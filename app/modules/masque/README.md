# MASQUE module — clinical rationale

**Prototype · not for clinical use.**

This file keeps the rationale that headed the source files of the MASQUE apps before they
became the screenAIr module "Dizziness and Sinusitis (MASQUE v1)". Each block below is the
header comment of one of those files, moved byte-for-byte from the frozen copy in
`app/tests/baseline/src/` (pinned by its `MANIFEST.sha256`); nothing in a block was reworded.
The blocks are the authors' notes as they stood at release 0.3.x: file names, release numbers
and "the real apps" refer to that code base, not to screenAIr. Six of those files are retired
from `app/src/` (see `docs/refactor/02-app-divergences.md`, "screenAIr 0.4.0"); the frozen copies,
`reference/fixed-src/` and git history keep them.

Where the module's content now lives:

- `masque.rubric.json` — items, weights, cut-points, red flags, context items, lexicon, patient
  wording, research configuration, FHIR/CDS identity and copy; `SOURCES.md` maps each field to
  its source lines.
- `masque.logic.js` — routing rules, phenotype derivation, the patient-summary rules and
  templates, and the probe set, with a header that maps each block to its source lines.
- `CHANGELOG.md` — the module's change log.

Version axes: instrument 0.2, lexicon 0.3.3, probe set 1.0.0, gold set 0.4.0 (the release is
screenAIr's own, `app/src/engine/policy.js`).

Since lexicon 0.3.2 (screenAIr 0.4.1) the Ambient Scribe shows a cue heard without its value and,
when no duration was stated with it, may take the value from the next replies; a heard cue never
scores. A duration stated with the cue but negated, ambiguous or given as an onset ("ago", "since",
"started", "began") is withheld: the clinician asks, and no later reply supplies it. A reply whose
duration is negated or ambiguous is not taken either. Day ranges ("for two days", "overnight" and
four more) set the dizziness duration only in a sentence that names the dizziness, never from a
reply; anywhere else they can only withhold a duration. Typed digits are read only in duration
phrases. Known risks are listed in `CHANGELOG.md`. Edits derived
from this module before 0.4.1 no longer verify against it: re-derive edits made before 0.4.1 (see
`CHANGELOG.md`). Edits derived under 0.4.1 still verify after 0.4.2, which changes only the
Spanish patient wording.

Since screenAIr 0.4.2 the Patient Companion is fully in Spanish when the patient chooses Español:
the context questions, the story step, the intro and safety text, the clinician paragraph and the
30 clinician lines of the "Para mi médico" block (new locale key `clin`) and the footer. The marker "Prototype · not for clinical use" stays in English, with the Spanish
line "Prototipo · no apto para uso clínico" beside it. The Spanish was produced by AI agents (two
independent drafts, then clinical, language and mechanical review by AI agents), not by a
qualified human medical translator, so the locale stays `reviewed: false` and the "Traducción sin
revisar" banner stays until a bilingual clinical reviewer signs it off. No existing Spanish was
changed. The rows and their basis, and the items awaiting the reviewer, are in `SOURCES.md`
("Spanish translation delta (unreviewed)"); what changed and what stays English are in
`CHANGELOG.md` (2026-10-06).

Since screenAIr 0.4.3 the Clinician Screener and the Ambient Scribe have an "EMR Friendly
Template" button. It opens a plain-text consult-note template with bracketed placeholders, for
pasting into an EMR. The rubric's new `emrTemplate` block gives it this module's data:

- citation metadata and links to specialty-society and journal sources;
- the empiric-treatment references shown when the referral gate is open;
- which routing recommendations' chips are instruments;
- the references under each red flag's own action, and one workup placeholder;
- the treatment-and-workup rows;
- an allergy / sinusitis / dizziness management checklist;
- the exam rows.

AI agents assembled this content from verified sources. On 2026-10-07 the clinical lead signed
off the content and the note it generates, as implemented in 0.4.3 (decisions D1-D16, review
rounds 1-4); screenAIr 0.4.4 records the sign-off and changes nothing else. The sign-off does not
cover the Spanish translation, and the recorded follow-ups stay known limitations, accepted at
sign-off (`CHANGELOG.md`, release 0.4.4). It stores no guideline text and no agent, dose or
threshold.
The template is a prototype aid. Every row and its basis are in `SOURCES.md` ("EMR template
data"); the states, the citation register and the known risks are in `CHANGELOG.md` (release
0.4.3). No version axis but the release moves.

screenAIr 0.4.5 records the clinical lead's referral rule for dizziness cases (decided in chat on
2026-10-07, 2026-10-09 and 2026-10-10): dizziness cases, the otologic picture and "both", are
referred to Neurology, and to neuro-otology if there is a true vertiginous component or a history
of ear or brain surgeries. No question the module asks reliably records true vertigo as the lead
describes it, or a prior surgery, so nothing escalates automatically: the referral reads Neurology
in the FHIR referral and the EMR note alike, and the note prints the lead's rule, definition and
clarification, with a placeholder for each condition, above the recommendations, so that
neuro-otology stays the clinician's decision. The rule and the clarification print verbatim; the
definition prints as the lead amended it on 2026-10-10: a rocking or bobbing sensation is
dizziness, not true vertigo, and swaying is imbalance too, so its internal-vertigo line no longer
lists swaying and bobbing. All three still count toward the vestibular score as imbalance (the item
"Episodic vertigo or imbalance"), so the instrument, probes and lexicon are unchanged. The rule is
module data (`phenotypes.referral.clinicianRules`); `CHANGELOG.md` (release 0.4.5) and
`SOURCES.md` give the details. The lead also confirmed showing the EMR checklist under an open red
flag (2026-10-07) and before the Scribe's safety review is recorded (2026-10-09). No version axis
but the release moves.

screenAIr 0.4.6 records the clinical lead's answers of 2026-10-10 on four items the EMR template
sign-off had left open. Under an open red flag the note now also prints the screen-based referral
and the empiric-treatment references, under a heading saying that the FHIR bundle withholds the
referral (the bundle is unchanged; it never carries the references). The assessment lists the headings of the recommendations the plan
prints ("Considerations:"). The past history gains a modifying-conditions row and the
family-history-of-migraine line, with its recorded state. On the Scribe, a recorded central HINTS
pattern puts a clinician placeholder under the HINTS exam row. The DZ4 audiogram label keeps its
indication clause. The two data additions (`emrTemplate.pastHistory` and the HINTS row's
`optionPlaceholders`) sit on top of the signed-off 0.4.3 block, which is unchanged;
`CHANGELOG.md` (release 0.4.6) and `SOURCES.md` give the details. No version axis but the release
moves.

screenAIr 0.4.7 (lexicon 0.3.3, gold set 0.4.0) follows the clinical lead's request of 2026-10-11
and the lead's sign-off of 2026-10-12. The Ambient Scribe's capture box is now a large scrollable
text area that takes a patient statement or a pasted chart note (Ctrl+Enter captures). Text is read
clause by clause (typed text as chart text and, since the lead's decision of 2026-10-12, spoken and
demo lines too), with the lead's endorsement and denial words ("endorses", "reports", "has", "yes"; "denies", "no",
"lacks", "doesn't have"). A denial in a list reaches the items of the list that are the finding
alone (and the lines under "Patient denies:"), until a word such as "with", "so" or "for" ends it;
an item that says more ("No nausea, tinnitus reported.") is left unrecorded and, where a card
exists, asked. "non-" drops an attribute, a phrase inside another word no longer counts, and an
abbreviation such as "assoc." or "hx." no longer ends the sentence. Allergy, medication and family-history sections are
read as such, and nothing is captured inside an exam section. Chart signs ("(-) aura",
"Photophobia: (+)", "Nausea: denies", "(+) nausea (-) photophobia") and empty checkboxes ("[ ]") are
read, and a failed treatment
("no improvement with antibiotics") stays a treatment that was given. A report header that names a
test ("CT showed …") records nothing by itself; a card asks what it showed. In a typed chart note
"her" and "his" name the patient when a finding follows them, while a named relative or another
person still makes the finding theirs. A red flag in chart wording ("sudden hearing loss",
"proptosis", "epistaxis") is raised, and one the chart clearly denies ("not pulsatile")
is not (the lead's decision). A denial of something else does not lower it ("No steroids given
for sudden hearing loss.", "No nausea, double vision reported."); `CHANGELOG.md` (release 0.4.7,
Part D) states exactly when a flag is lowered and lists the cases still known to be lowered. In a
spoken line an opening "no" that answers the clinician's question ("no it's more of a whooshing with
my heartbeat") lowers no flag, while a direct denial ("No, I've never had double vision.") does
(the lead's decision of 2026-10-12; its known cost is that some unpunctuated spoken denials, such
as "no I haven't noticed any slurred speech", still raise their flag for the clinician to clear). Spoken lines keep their carry-over as before, and the pronoun exception and the
Clarify section stay with typed text. "+/-" is a hedge (the lead's decision) in spoken and typed
lines alike: its clause records nothing. Typed text sets no context marker (prior dismissal, duration,
clinicians seen): the clinician sets them. Each capture shows its clause as evidence. A Clarify section
under the box then asks about unclear wording, each card with the module's own question and
answers, which the clinician answers with a click. A generic "runny nose" asks the lead's question,
"is the rhinorrhea clear or purulent?". Hedged wording (including "+/-") and a finding stated both ways are asked too,
never recorded, and unfilled template text shows a notice to dismiss. A stated dangerous detail
raises its flag or keeps its safety card, and a safe answer the chart denies ("not bilateral")
never silences the card. Apart from the lead's own words and decision, every cue word, red-flag
phrase, trigger and qualifier was drafted by the team, and the lead decided each one on 2026-10-12
(the `cl_rhinorrhea` triggers and qualifiers in chat the same day, after the final review):
278 approved (marked lead-approved), 18 struck (the mask "aural" and 17 chart red-flag phrases), and a
few added or removed in the lead's answers (`CHANGELOG.md`, release 0.4.7, "Clinical-lead sign-off
(2026-10-12)"). `SOURCES.md` gives each row's source.

screenAIr 0.4.8 makes the clinical lead's three fixes of 2026-10-12. The Ambient Scribe's question
for item `r_dur` (its Ask-next card "recalcitrance", answered Yes / No) is now the lead's sentence,
"Have symptoms persisted over 3 months despite trials of medical management?"; it read "How long
has this been going on?". The item's statement, weight and patient wording are unchanged, and the
question is outside the instrument's identity, so instrument 0.2 and the calibration stand. The
Patient Companion shows the lead's one-minute introduction video above its instructions, in a panel
the patient can hide; the video loads only when played, has English captions, and is never printed
or exported. It is this built-in module's media (`media/`, named in `registry.json`), so an uploaded
or edited module does not show it. When the companion runs in Spanish, the summary (on screen,
printed, and in the `.txt` and `.html`) adds after the Spanish findings an English version of the
same findings, titled in both languages, so an English-speaking clinician can read them (for an
uploaded or edited questionnaire it carries the English caveats too); no score, band or probability
is added. The new Spanish strings are AI translations, unreviewed.
`CHANGELOG.md` (release 0.4.8) and `SOURCES.md` give the details.

Two follow-up requests of the clinical lead (also 2026-10-12) are in the same release. The EMR
Friendly Template's plan now prints the lead's line "recommend a trial of migraine abortives if not
contra-indicated due to other conditions." right after the empiric-treatment references, wherever
they print with no red flag open, on the Screener and the Scribe; never under an open red flag, and
not in the encounter note, the FHIR bundle or the Screener's result cards. It is this module's data
(`emrTemplate.planAdvice`, the lead's words with their date), so another module prints no such line.
The Ambient Scribe gains a Question review tab, right of Ask next: every scored item with its current
answer and where the encounter recorded it (heard in encounter, typed chart text, a probe, a Clarify
card, Ask next or a review edit); the clinician can change or clear any answer there, and the score,
the coverage, the encounter note and the EMR template follow. Changing or clearing an answer a probe
wrote withdraws that probe's answer, so its note and EMR checklist entry never contradict the
correction. An unanswered item reads "not answered", never no. No version axis but the release
moves.

## Clinician Screener — file header

`MASQUE_Screener_v0_3.jsx` lines 8-26 (baseline SHA-256 `b478094a4d3421d1…`).

```text
/*  Project MASQUE — clinical screening prototype
    Migraine And Sensory-neuropathy Quantification in Underdiagnosed ENT presentations
    -------------------------------------------------------------------------------
    A SMART on FHIR-style decision-support app. It screens patients with recalcitrant
    sinonasal / otologic symptoms for a masked migrainous or neuropathic driver, then
    routes to the licensed confirmatory instruments and (optionally) a referral.

    Honesty notes intentionally surfaced in the UI:
      • Screening aid, not a diagnosis.
      • The item set below is authored for this prototype; it is NOT the validated
        instruments (VM-PATHI, SNOT-22, DHI, HIT-6, ID Migraine), which are named as
        the confirmatory step and administered under their own licenses.
      • The weighted model is interpretable and illustrative, pending validation on
        the open-data sources named in the Project MASQUE proposal §6 (NHANES, NHIS,
        MEPS, CMS PUF, HCUPnet, openFDA, CDC WONDER/BRFSS, All of Us). Bridge2AI-Voice
        belongs to VOICED and is not a MASQUE source.
      • No PHI leaves the browser; a real deployment extracts features at the edge and
        writes structured results back via FHIR.
*/
```

## Clinician Screener — item set rationale (the same text heads the Scribe's copy of the item set)

`MASQUE_Screener_v0_3.jsx` lines 153-171 (baseline SHA-256 `b478094a4d3421d1…`).

```text
/*  Item set v0.2 — aligned to the criteria the proposal names as anchor labels.

    Two structural changes from v0.1, both from the conformance audit:

    1. ICHD-3 and Barany criteria are now expressible. v0.1 could not be crosswalked
       to them: "minutes to hours" excluded Barany's 5-minute floor and 72-hour
       ceiling, and there was no episode-count item and no attack-duration item.
       Since proposal 7.2 generates its training labels from those criteria, the
       old item set could not have supported the modeling plan.

    2. Discriminators carry NEGATIVE weight. Every v0.1 item added points, so the
       screen could only accumulate evidence for its own hypothesis — and that
       inflation lands hardest on the group with the highest base rate of these
       complaints, which is the opposite of the equity goal. Proposal 5 assigns
       SNOT-22 the job of separating true sinus disease from migrainous facial
       pressure; nothing in v0.1 implemented it.

    Positive domains still sum to 100. Discriminators subtract up to 29.
*/
```

## Ambient Scribe — file header

`MASQUE_Scribe_v0_3.jsx` lines 12-28 (baseline SHA-256 `62c8091fb199c001…`).

```text
/*  Project MASQUE — Ambient Scribe prototype
    ------------------------------------------------------------------
    An ambient AI scribe that listens to the ENT encounter, captures symptoms into the
    MASQUE screen automatically, tracks coverage, and prompts the physician with the
    highest-yield questions still unasked — including the VM-PATHI vestibular-migraine
    domains when the otologic pathway lights up.

    Copyright-safe: the on-screen prompts are authored for this prototype and mirror the
    VM-PATHI *domains* (motion sensitivity, disequilibrium, headache equivalents,
    cognition, affect). They are NOT the VM-PATHI items themselves — the validated
    instrument is named as the licensed confirmatory step.

    Prototype only. Screening aid, not a diagnosis. The transcript comes from the
    scripted demo, from typed statements, or live from the microphone through the
    browser's own speech recognition (MASQUE_Voice.js). A deployment plugs in ambient
    ASR at the edge with no raw audio retained.
*/
```

## Patient Companion — file header

`MASQUE_Patient_v0_3.jsx` lines 7-52 (baseline SHA-256 `dacdbfff7f722e2f…`).

```text
/*  Project MASQUE — patient-facing companion (release 0.3)

    Why this exists
    ---------------
    The TOPx track asks for tools built on U.S. Open Data that help PATIENTS reach
    answers and care faster, and proposal §2 commits to putting that data "in the
    public's hands". Until now every MASQUE artifact was clinician-facing: SMART
    launch, physician prompts, chart write-back. A patient had no entry point at all.

    That gap is not cosmetic. Proposal §3.2 is about people — disproportionately
    women — who have already seen three or four clinicians over a year or more and
    been told it is stress. The single thing most likely to change that visit is not
    another clinician-side score. It is the patient arriving able to describe the
    pattern precisely and ask for the specific evaluation. This app does that and
    nothing more.

    What it deliberately does NOT do
    --------------------------------
    1. No score, no band, no probability, anywhere in the patient's view. The
       calibration constants are illustrative until fit on approved data (fix #3),
       and "85/100 — high likelihood" handed to a patient is an unvalidated number
       that invites self-diagnosis. The clinician summary lists which FEATURES are
       present, in clinical language. That is what actually speeds up a visit, and
       it cannot be misread as a result.

    2. No differential is ever shown for a red flag. The clinician build names what
       each flag points to — schwannoma, subarachnoid haemorrhage, giant cell
       arteritis. A patient reading that list at 1am is harmed, not helped. Here a
       flag carries only two things: how fast to be seen, and the exact sentence to
       say when calling. Same safety behaviour, no terror.

    3. No automatic research capture. The clinician build appends screens to the
       pilot cohort (fix #7/#11). Patient-entered data carries different consent
       obligations than clinician-entered data, so nothing here writes to a cohort.
       Export is patient-initiated, local, and goes to the patient.

    The "Not sure" answer
    ---------------------
    Every yes/no question offers Yes / No / Not sure, and "Not sure" leaves the item
    genuinely unanswered rather than coercing a 0. This is the same no-imputation
    invariant the ingestion layer and the coverage gate run on — absent data is never
    rendered as negative data. It also turns out to be the most useful thing in the
    app: an honest "I don't know whether my scan showed inflammation" becomes a
    question on the visit summary, which is exactly the sort of thing that stalls
    these workups for months.
*/
```

## Extraction — file header

`MASQUE_Extraction.js` lines 1-22 (baseline SHA-256 `3849c0e86ba3e9cd…`).

```text
/*  Project MASQUE — free-text extraction module

    Proposal §7.2 commits to "developing and benchmarking free-text extraction on
    openFDA narratives". The conformance audit found the extraction built but the
    benchmark absent: rules lived inline in the scribe, the negation window was an
    unexplained constant, the phrase lists carried no version, and no precision or
    recall had ever been measured.

    Splitting the engine out of the UI is the precondition for the rest. A rule set
    embedded in a React component cannot be benchmarked, swept, versioned, or run
    against a corpus — so this module owns the lexicon and the extract function, and
    MASQUE_Scribe imports it. MASQUE_Extraction_Benchmark.mjs imports the same
    module, which is the point: the harness scores the code that ships, not a copy.

    LEXICON_VERSION changes whenever a phrase list changes. Benchmark reports record
    it, so a claimed precision/recall is always attributable to a specific rule set.

    Honest scope: this is a transparent rule-based extractor, not a learned model.
    That is a deliberate choice for a safety-adjacent prototype — every capture can
    be traced to the phrase that produced it — but it caps achievable recall, and the
    benchmark exists to say by how much rather than to flatter it.
*/
```

## Probes — file header

`MASQUE_Probes.js` lines 1-19 (baseline SHA-256 `e34f5976889323b5…`).

```text
/*  Project MASQUE — real-time encounter probes
    Release 0.3.1 · PROBE_SET_VERSION 1.0.0 · instrument 0.2

    What to ask or do next, while the patient is still in the room.

    This module owns the probe set for the same reason MASQUE_Extraction.js owns the
    lexicon: rules embedded in a React component cannot be validated, versioned, or
    reviewed by a clinician who does not read JSX. MASQUE_Scribe imports it, the
    simulator imports it, and validateProbes() is run at module load by both.

    PROBE_SET_VERSION moves whenever a probe is added, removed, or reworded. It is
    independent of INSTRUMENT_VERSION on purpose — see the rescue/phenotype note below.
    Adding probes has not changed a single scored item, weight, or cutpoint, so
    instrument 0.2 remains correct and cohorts stay comparable.

    Clinical content is drawn from the Bárány Society / IHS consensus criteria for
    vestibular migraine and the surrounding literature. All patient-facing wordings are
    authored for this tool rather than reproduced from those documents.
*/
```

## Research-readiness panel — file header

`ResearchReadinessPanel.jsx` lines 8-23 (baseline SHA-256 `cb099e14c93d6949…`).

```text
/*
  Shared research-readiness layer for MASQUE, VOICED, and BREATHE.

  What this adds now, before restricted/public datasets are connected:
  - calibrated probability + confidence/abstention behavior
  - transparent feature/domain contribution explanations
  - CSV/JSON ingestion with schema inspection and data-quality checks
  - validation metrics when reference labels are present
  - subgroup/fairness metrics when sex/gender fields are present
  - prevalence, utilization, and avoidable-cost summaries when fields are present
  - downloadable model card, provenance record, and ingestion manifest (the instrument data dictionary is published by the clinical app, which owns the item set)

  It intentionally does NOT claim that the illustrative calibration constants or demo rows are
  clinically validated. Replace the project adapter's calibration and field mappings with estimates
  learned from the approved datasets and clinician-in-the-loop reference cohort.
*/
```

## Simulator — file header

`MASQUE_Simulator.jsx` lines 7-25 (baseline SHA-256 `bef25d1a61809b17…`).

```text
/*  MASQUE — interactive simulation, release 0.3.0 · instrument 0.2

    A condensed but behaviourally faithful build of the three MASQUE apps and the
    shared research panel, in one file so it runs in a chat artifact.

    FAITHFUL: the item set (all 30 ids, weights, scales, and the four negative-weight
    discriminators), band cutpoints, the attainable-range coverage gate, all twelve
    red flags and their tiers, the no-imputation ingestion rule, the fairness audit
    with minimum cell sizes and Newcombe intervals, the §11 deployment gate,
    calibration-in-the-large and slope, and the equity threshold adjustment.

    CONDENSED: FHIR bundle construction, the ambient-capture lexicon (a small subset
    runs here), cohort CSV export, the model card JSON, and the population artifact
    renderer. Those are unchanged in the release and not what a click-through tests.

    The probe rail is not in the real apps. It exists because this codebase is
    defined by what it refuses to do, and a refusal you cannot reach is a refusal
    you cannot check.
*/
```
