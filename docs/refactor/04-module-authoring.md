# 04 — Writing a screenAIr module

How to write, check, upload, edit and download a screenAIr module. The binding definitions are
`app/src/engine/contract.js` (constants and JSDoc typedefs), `app/src/engine/validate.js` (the
checks) and `docs/refactor/03-design.md` §3-§5 (the design). This file explains them; where it and
the code disagree, the code and the design win, and this file is the one to fix.

Dated 2 October 2026, for release 0.4.0 and contract version 1. Updated 4 October 2026 for release
0.4.1 (optional lexicon fields `heard`, `carry`, `yieldTo`, `anchor`, `carryRefuse` and
`normalize`; contract version still 1), and again the same day for release 0.4.1 round 2 (the
optional scale field `carryExclude`; `normalize.numbers` applies to band phrases only;
`05-scribe-capture-fixes.md` §12). Updated 5 October 2026 for release 0.4.1 round 3 (removal-only
band choice for `heard` entries, `carryExclude` sentence scope, the two roles of `carryRefuse`;
`05-scribe-capture-fixes.md` §13), and again the same day for round 3b (a withheld value keeps
the yield without opening carry-over; `05-scribe-capture-fixes.md` §13.10). Updated 6 October
2026 for release 0.4.3: the optional top-level block `emrTemplate` (the clinician EMR template's
data, §2.13) and validator rule V61; contract version still 1. Updated 7 October 2026 for release
0.4.4: the clinical lead signed off the built-in module's `emrTemplate` content (no format change;
the Rubric Editor's lock reason names the sign-off). Updated 10 October 2026 for release 0.4.5:
the optional clinician rules of the referral table, `phenotypes.referral.clinicianRules` (§2.6,
V27), printed for the clinician in the EMR template and never acted on; contract version still 1.
Updated 10 October 2026 for release 0.4.6: two optional `emrTemplate` fields, `pastHistory` and an
exam row's `optionPlaceholders` (§2.13, V61), and the engine's reading of an open red flag (the
references row below); contract version still 1. Updated 12 October 2026 for release 0.4.8: the
optional `emrTemplate` field `planAdvice` (plan lines printed beside the references with no red flag
open; §2.13, V61); contract version still 1.

**Prototype · not for clinical use.** Nothing in this guide makes a module clinically valid.
screenAIr checks that a module is well formed and that it cannot impersonate another one; it
cannot check that its questions, weights or cut-points are right.

---

## 1. What a module is

A module is two files plus, for a built-in, one line in the registry.

| Layer | File | Format | Holds | Can contain code? |
|---|---|---|---|---|
| **Rubric** | `<id>.rubric.json` | `format: "screenair-rubric"`, `contractVersion: 1` | Everything that is data: identity, domains and items with weights, band cut-points, red flags, context questions, steps, phenotype vocabulary, samples, extraction lexicon, patient wording per language, research configuration, FHIR/CDS identity, copy, provenance, change log. | **No.** A function, `undefined`, `NaN`, `Infinity` or a cycle anywhere is error V4. |
| **Logic** (optional) | `<id>.logic.js` | `export default { format: "screenair-logic", contractVersion: 1, moduleId, reads, … }` | Closures only, plus the data that sits next to them: phenotype derivation and domain activation, routing rules with their copy, the patient-summary rules and templates, the probe set, and the `reads` declaration. | Yes, at the `LOGIC_PATHS` only (§4.2). It imports nothing. |
| **Bound module** | — (runtime) | built by `bindModule(rubric, logic)` and deep-frozen | Rubric + logic + engine defaults + derived lookups + rendered identifiers + hashes + provenance. | — |

A rubric with `"logicBinding": "generic"` needs no logic file. It runs on the engine's
`GENERIC_LOGIC` (§3): no phenotypes, every domain active, no module routing, a patient summary
that only quotes the module's own item wording, no probes, no CDS index card and no referral.
This is the right starting point for a new module.

A self-contained module is also accepted as one `.js` file:
`export default { format: "screenair-module", contractVersion: 1, rubric: {…}, logic: {…} }`.
`rubric` must still be pure JSON; Download writes it back out as the two files above.

### 1.1 Ground rules

These come from `CLAUDE.md` and the four upstream invariants; the validator enforces the ones a
machine can check.

- **Never invent clinical content.** Items, weights, cut-points, red flags, phrases, probes,
  patient copy and translations come from a clinical author and are moved into the module
  verbatim. The built-in MASQUE module was *extracted* from the frozen source
  (`app/tests/tools/extract-rubric.html`), not retyped; its `SOURCES.md` maps every field to a
  source line. One recorded exception: the Spanish that release 0.4.2 added to it at the user's
  request is a translation by AI agents, not by a clinical author or a qualified medical
  translator; it is added row by row with its basis (`SOURCES.md`, "Spanish translation delta
  (unreviewed)") and the locale stays `reviewed: false` until a bilingual clinician reviews it.
  A second recorded exception: the EMR template data that release 0.4.3 added to it
  (`emrTemplate`, §2.13). AI agents assembled it from verified specialty-society and journal
  sources. It is citation metadata and links, and short labels each carrying the citation keys
  they rest on. It is recorded row by row with its basis (`SOURCES.md`, "EMR template data"). The
  clinical lead signed it off on 7 October 2026, as implemented in release 0.4.3 (recorded in
  release 0.4.4); the sign-off does not cover the Spanish exception above.
- **Licensed instruments are not embedded** (VM-PATHI, SNOT-22, DHI, HIT-6, MIDAS, ID Migraine,
  THI/TFI, SFN-SIQ, COMPASS-31 and the like). Name them as the confirmatory step; do not paste
  their items. screenAIr cannot detect a pasted licensed item (open question Q25).
- **Caveats are not module data.** "Prototype · not for clinical use", the unreviewed-translation
  banner and the illustrative-calibration label live in `engine/policy.js CAVEATS` and are drawn
  by the shell on every surface. So do, since release 0.4.2, the Spanish patient caveats and the
  Spanish line "Prototipo · no apto para uso clínico" that a Spanish patient surface shows next to
  the English marker (never instead of it). Putting any of them, or the phrase "no apto para uso
  clínico", in a module is error V38, which ignores case and accents ("uso clinico" is caught too).
- **The Patient Companion shows no score, band, probability or research capture.** Patient
  wording may not contain "score", "likelihood", "probability", "puntuación"/"puntaje" or a
  "number / number" pattern (V60, `OMISSION_PATTERNS`), may not name the module's own
  `copy.indexName` or a band label built from its `copy.screener.bandSuffix` (V60, matched as a
  whole phrase, any case; the bare words "low", "moderate", "high" and "index" are not flagged),
  and may not repeat a red flag's clinician `points` or `action` (V24).
- **Absent is not negative.** An unanswered item is never scored as "no". Every scale needs an
  option with `f === 0` (V13) so that "none" is something a person says, not a default.
- **Gate, don't warn.** Red flags, the coverage gate, the sign gate, the referral gate and the
  calibration gate are engine code. A module supplies their noun phrases (copy slots), never their
  sentences or their conditions.

### 1.2 The smallest useful module

A data-only rubric with two domains, one red flag and English patient wording (this is the
`shape` test fixture, `app/tests/fixtures/modules/shape.rubric.json`, abridged; the text is
placeholder text):

```json
{
  "format": "screenair-rubric",
  "contractVersion": 1,
  "id": "shape",
  "label": "Shape fixture (example module)",
  "name": "Shape example",
  "instrumentVersion": "1.0",
  "logicBinding": "generic",
  "domains": [
    { "key": "alpha", "label": "Example domain Alpha", "max": 60, "items": [
      { "id": "ex_a1", "w": 20, "text": "Example item A1", "short": "Example A1" },
      { "id": "ex_a2", "w": 15, "text": "Example item A2", "short": "Example A2" },
      { "id": "ex_a3", "w": 25, "text": "Example item A3", "short": "Example A3",
        "scale": [ { "label": "Example option none", "f": 0 },
                   { "label": "Example option some", "f": 0.5 },
                   { "label": "Example option all", "f": 1 } ] } ] },
    { "key": "beta", "label": "Example domain Beta", "max": 40, "items": [
      { "id": "ex_b1", "w": 25, "text": "Example item B1", "short": "Example B1" },
      { "id": "ex_b2", "w": 15, "text": "Example item B2", "short": "Example B2" } ] }
  ],
  "bands": { "cuts": { "moderate": 35, "high": 70 } },
  "redFlags": [
    { "id": "ex_rf1", "tier": "urgent", "group": "Example group",
      "text": "Example warning sign 1", "points": "Example point 1", "action": "Example action 1" }
  ],
  "defaultLocale": "en",
  "locales": { "en": { "reviewed": true,
    "items": { "ex_a1": { "q": "Example question A1?" }, "…": "one entry per item" },
    "redFlags": { "ex_rf1": { "q": "Example warning question 1?", "say": "Example advice for warning 1." } } } },
  "changelog": []
}
```

Upload it from the module menu ("Upload") and every tab works: the Screener has a safety step, one
step per domain and a result; the Ambient Scribe offers prompts but no voice capture (there is no
lexicon); the Patient Companion runs in English; Research says the module declares no research
configuration; the Rubric Editor can edit it and create a lexicon or more patient wording.

---

## 2. Rubric field reference

**R** = required, **O** = optional. Field names and shapes are those of the `Rubric` typedef in
`engine/contract.js`; `RUBRIC_KEYS` lists the top-level keys and V3 warns on any other (a typo).
§3 says what the engine does when an optional field is absent.

### 2.1 Top level

| Field | | Meaning |
|---|---|---|
| `format` | R | `"screenair-rubric"` (V1) |
| `contractVersion` | R | `1` (V1; a higher number reads "Made for a newer screenAIr") |
| `id` | R | `/^[a-z][a-z0-9-]{1,47}$/`, not ending in `-` (V2). It becomes the cohort `module_id`, `{id}` in every identifier template, file names and the model version. A built-in id (`masque`) is reserved, and no other module's id may start with `<built-in id>-` (V8). |
| `label` | R | What the module menu and page title show (≤ 80 characters, V2). Display only: it may not appear in an identifier (V7), and may not equal a built-in's label (V8). |
| `name` | R | Display name for `{name}` in copy and engine sentences. |
| `icon` | O | A lucide icon name; default `Stethoscope`. |
| `instrumentVersion` | R | The **instrument** axis: `Questionnaire.version`, `{instrument}`, cohort `instrument_version`. `/^\d+(\.\d+)*(-[a-z0-9.-]+)?$/` (V6). |
| `logicBinding` | R | `"generic"`, or `{ "moduleId": "<logic moduleId>", "logicSha256": "<64 hex>" }` (the hash is optional; §6.2). |
| `domains` | R | Ordered; the order is the domain order everywhere (§2.2). |
| `bands` | R | `{ "cuts": { "moderate": m, "high": h } }`, integers with `0 < m < h ≤ scaleMax` (V16). |
| `contextItems`, `gapRule` | O | Unscored context questions and the gap alert (§2.3). |
| `redFlags` | R | At least one (§2.4). |
| `steps` | O | `{ screener?: [...], patient?: [...] }` (§2.5). |
| `phenotypes` | O | Complaint vocabulary, referral and CDS terms (§2.6). |
| `infoPrompts` | O | Unscored information prompts the Scribe offers when a gate domain is active. |
| `sampleCases`, `demo` | O | Sample-case buttons; demo patient and scripted transcript (§2.7). |
| `lexicon` | O | The extraction lexicon for the Ambient Scribe (§2.8). |
| `defaultLocale` | O | `"en"`, the only value accepted in contract 1. |
| `locales` | O | Patient-facing wording per language, keys ⊆ `["en", "es"]` (§2.9). |
| `research` | O | The Research tab's configuration (§2.10). |
| `fhir`, `cds` | O | Identity templates and Questionnaire/CDS strings (§2.11). |
| `copy` | O | Copy slots (§2.12). |
| `emrTemplate` | O | Data of the clinician EMR template: citations, references, instrument recommendations, red-flag references and workup placeholders, treatment history rows, checklist, exam rows (§2.13; V61). Clinician surfaces only. |
| `provenance` | O | Written only by screenAIr when it derives a module; verified on every load, never trusted (§5.3). |
| `changelog` | R | A list, may be empty: `{date, kind: "reconciliation"\|"extraction"\|"derived"\|"note"\|"lexicon"\|"translation"\|"emr-template", note, author?, paths?, axes?, acknowledged?}`. |

### 2.2 Domains and items

| Field | | Meaning |
|---|---|---|
| `domain.key` | R | `/^[a-z][a-z0-9_]*$/`; the FHIR group `linkId` and the `domain-{key}` code. |
| `domain.label` | R | Clinician label. |
| `domain.max` | R | Σ of the domain's item weights, exactly (V15). Negative for a negative domain. |
| `domain.negative` | O | `true` for a domain whose items lower the index (rule-out discriminators). Every weight's sign must match (V15). |
| `domain.shortTag` | O | Scribe suggestion tag for items with no `tag` (default: label in lower case). |
| `domain.items` | R | At least one item, in instrument order. |
| `item.id` | R | `/^[a-z][a-z0-9_]*$/`, unique across items, context items, red flags and info prompts (V11). |
| `item.w` | R | Finite and non-zero (V12). |
| `item.text` | R | Clinician wording: the Questionnaire item text, the Screener question, chips. |
| `item.scale` | O | `[{label, f}, …]`: present makes the item a choice item whose answer is the option index; absent makes it yes/no. At least two options, `f ∈ [0, 1]`, and at least one `f === 0` (V13). A yes/no item has no `scale` (V14). |
| `item.short` | O | Scribe short label (capture tags, note lines, "re-asking"). Absent: the id is shown (V12 warning). |
| `item.ask` | O | Physician phrasing for Scribe suggestions (default: `text`). Phrase it to match the item's answers: a yes/no item takes a yes/no question (release 0.4.8 changed the built-in `r_dur`'s "How long has this been going on?" to the clinical lead's yes/no question). `ask` is outside `instrumentHash` and `scoringHash` (§5.2): changing it keeps the instrument version. |
| `item.tag` | O | Full tag string shown on Scribe suggestions. |
| `item.ref` | O | Criterion code, emitted to `fhir.criteriaSystem`. |
| `item.patientClin` | O | The clinical line in the patient summary's "For my clinician" block (default: `text`). It is the English line; a translation may give its own as `locales.<loc>.items.<id>.clin` (§2.9). |

**Scoring.** An item scores `w` for "yes", `w × scale[i].f` for option `i`, and nothing when
unanswered. `scaleMax` is the sum of the positive domains' `max`; the negative domains together
can subtract down to `negativeMin`. The index is reported with its attainable range
(`floor`–`ceiling`), and no band is issued until the range sits inside one band. A `scaleMax`
other than 100 is allowed but warned (V17): the meter, the CDS example and the illustrative
calibration were written for 0–100.

### 2.3 Context items and the gap rule

Context items are unscored, are not in the Questionnaire and are not cohort columns.

| Field | | Meaning |
|---|---|---|
| `id`, `text` | R | Id in the shared namespace; clinician question. |
| `options` | R | `[[value, label], …]`, at least two, unique values (V18). |
| `captureLabel` | O | Scribe capture-tag text for any captured value. |
| `signal` | O | `{value, screenerLabel, scribeLabel, noteLabel}`: the option value that counts toward the gap alert, and how each surface names it. |
| `gapRule` | O | `{threshold, markers, noteOrder?}`: `markers` are context ids with a `signal`, in the positional order the logic's `sum.gap` template expects; the alert fires when `threshold` of them are signalled (V19). Every patient context option list must still contain each signal value (V20). |

### 2.4 Red flags

Clinician wording only; the patient wording lives in `locales`.

| Field | | Meaning |
|---|---|---|
| `id` | R | Shared id namespace. |
| `tier` | R | `"emergent"` or `"urgent"` (shown to patients as "now" and "soon"). |
| `group` | R | Display group; groups appear in order of first appearance. |
| `text`, `points`, `action` | R | The flag, what it points to and what to do. `points` and `action` never reach a patient view (V24, V34). |
| `ask` | O | Kept as data; not read in v1 (Q6). |

A flag never carries `w`, `weight`, `f`, `scale` or `score` (V22): red flags gate, they do not score.
Every flag needs at least one lexicon cue phrase when the module has a lexicon (V28), or speech
could never raise it.

### 2.5 Steps

`steps.screener` is a list of `{key, kind: "safety"|"domain"|"result", domainKeys?, extras?,
requires?, rail: {eyebrow, title}, card?: {eyebrow, heading, sub?}, domainIntro?}`: safety first,
result last, exactly one of each, every domain in exactly one step (V25). `extras` may hold
`"complaintPicker"` (only with `phenotypes`) and `"context"` (only with `contextItems`);
`requires: "complaint"` keeps Next disabled until a complaint is picked.

`steps.patient` is a list of `{key, kind: "story"|"domain", domainKeys, extras?}` between the
fixed intro and safety sections and the summary; every domain exactly once, `context` at most
once (V26). Patient step titles, headings and ledes are locale data (`locales.<loc>.steps`).

### 2.6 Phenotypes

`phenotypes = {values: [{value, h, d}], scribeDefault, alwaysActive?, tagBoostDomain?, referral?,
cdsTerm?}`. `values` is the complaint picker (heading `h`, description `d`); `scribeDefault` is the
Scribe's complaint when no derive rule fires; `alwaysActive` lists the domains always in the
Scribe's suggestion pool; `referral = {byPhenotype: {value: {specialty, reason}}, default,
clinicianRules?}` feeds the bundle's referral and the EMR template's; `cdsTerm = {byPhenotype, default}`
feeds the CDS index card (V27). Without `referral` there is no referral ServiceRequest; without
`cdsTerm` there is no CDS index card.

**Clinician rules (release 0.4.5).** `referral.clinicianRules` is an optional list of rules that
the EMR template prints for the clinician, for the phenotype values each names. They are text a
clinician applies: the engine never acts on them, and the referral stays `byPhenotype[complaint]`
or `default` whatever the encounter records. The engine names no phenotype or condition: the rule
is data.

```json
"clinicianRules": [{
  "phenotypes": ["otologic", "both"],
  "source": "clinical lead, 2026-10-07",
  "rule": "…the rule, verbatim…",
  "definition": ["…definition line, verbatim…", "…"],
  "clarificationSource": "clinical lead, 2026-10-09",
  "clarification": ["…clarification line, verbatim…"],
  "confirm": ["True vertigo (internal or external)", "Prior ear or brain surgery"]
}]
```

| Field | Required | What it does |
|---|---|---|
| `phenotypes` | yes | The phenotype values the rule is printed for (non-empty, distinct, each a `values[].value`). |
| `source` | with a rule or a definition | Who stated the rule and the definition, and when. Printed in parentheses after "Referral rule" and "Definition". |
| `rule` | no | The rule as its author stated it; printed "Referral rule (<source>): <rule>". |
| `definition` | no | Definition lines, printed verbatim under "Definition (<source>):". |
| `clarificationSource` | with a clarification | Who stated the clarification, and when. Printed in parentheses after "Clarification". |
| `clarification` | no | Clarification lines, printed verbatim under "Clarification (<clarificationSource>):", right after the definition. |
| `confirm` | no | The conditions a clinician confirms; each printed "<label>: [ ]", never pre-filled. |

A rule needs at least one of `rule`, `definition`, `clarification` or `confirm`.

How the engine reads it (`engine/emr.js`):

- The EMR template prints each rule naming the complaint (rule, definition, clarification, then
  the `confirm` placeholders) right above the routing recommendations, whenever its plan prints a
  referral line or the "Referral: [clinician decision]" placeholder; never on an unrecorded Scribe
  safety review, an unscorable screen or a rule error (gate, don't warn). Under an open red flag it
  prints since release 0.4.6 with the screen-based referral block, under the heading "Screen-based
  referral and references (the FHIR bundle withholds the referral while a red flag is open):",
  wherever the plan would print it with no flag open.
- Nothing else reads it. The FHIR referral ServiceRequest and the EMR template's referral line
  both come from `rules.js` `referralFor` (`byPhenotype` or `default`), so they agree, except
  that under an open red flag the bundle carries no referral while the note prints the
  screen-based one under that heading (release 0.4.6); no
  probe answer, item answer or heard capture changes the destination. A module that wants a
  different destination for a picture changes `byPhenotype`.
- The rules sit outside `instrumentHash` and `scoringHash`; they change `contentHash` only.
- V27 checks the shape; no string may carry `[ ] { }`, and a field the engine never reads (an
  escalation destination `to` or `evidence` among them: the engine escalates nothing) is a
  warning, as is a `clarificationSource` without a `clarification`.
- The Rubric Editor keeps `/phenotypes` (the rules included) read-only, and a derivation carries
  it unchanged.

The built-in module's rule is the clinical lead's (decided in chat on 7, 9 and 10 October 2026:
dizziness cases, the otologic picture and "both", to neurology, and to neuro-otology with a true
vertiginous component or a prior ear or brain surgery, with the lead's definition of true vertigo,
as the lead amended it on 10 October, and the lead's clarification; recorded in
`app/tests/harness/referral-delta.js` and the module's `CHANGELOG.md`, release 0.4.5). Because no question of the module reliably records either
condition, the referral stays "Neurology" and the rule is printed for the clinician. A rule in your
own module is your clinical content: write down who decided it and when (`source`,
`clarificationSource`).

### 2.7 Sample cases and demo

`sampleCases[]`: `{id, label, buttonLabel, group?: "sample"|"scenario", icon?, why?, complaint?,
ctx?, rf?, a, safetyReviewed?}`. `a` maps item id → `"yes"`, `"no"` or an option index, never
`"unsure"`; `ctx` uses the clinician option values (V49). V51 warns when no sample rehearses a red
flag, an unscorable screen or a positive rule-out item, because the gates then go untried.

`demo.patient` is a synthetic patient `{id, given, family, sex?, gender?, age?, mrn, synthetic:
true}` with no date of birth (V50); `demo.transcript` is `[["md"|"pt", text], …]`.

### 2.8 Lexicon (Ambient Scribe extraction)

| Field | | Meaning |
|---|---|---|
| `version` | R | The **lexicon** axis. |
| `lang` | O | BCP-47 tag for voice capture, default `"en-US"` (V30). |
| `negation`, `thirdParty`, `historical` | R | `{window, cues}`: integer window > 0 (characters before the phrase) and a non-empty cue list (V30). |
| `bool` | R | `[{id, ph, thirdPartyExempt?}]`: phrases that answer a yes/no item "yes" (or "no" when negated). |
| `ctx` | R | `[{id, val, ph}]`: phrases that set a context item to a clinician option value. |
| `scale` | R | `[{id, cue, bands: [{ph, v}], fallback}]`: a cue opens a scale item and a band phrase picks option `v`; `fallback` (or `null`) applies when the cue has no band. Optional keys `heard`, `carry`, `yieldTo`, `anchor`, `carryExclude` (rows below); any other key is warned as a likely misspelling and ignored (V28). |
| `multi` | R | `[{ids: [{id, value, kind: "item"|"ctx"}], ph}]`: one phrase that sets several answers. |
| `redFlags` | R | flag id → phrases. Keys equal the flag ids both ways, and every list is non-empty (V28). |
| `goldSet` | R for built-ins | `{version, lexiconVersion, file?}` of the benchmark the lexicon was measured on, or `null`. |
| `scale[i].heard` | O | `true` turns on the **heard** signal for that entry: when its cue is heard (not negated, not attributed to someone else, not historical) but no band phrase matches and the entry has no `fallback`, the Ambient Scribe shows the cue on the transcript bubble and as a Heard card in Ask next. The item stays unanswered; a heard cue never scores. `heard: true` also changes the **scored** output: band choice follows the stricter rule below the table (every band match counts, and a negated match, a `carryRefuse` phrase or a disagreement withholds the value). Only `true` means anything (V28). |
| `scale[i].carry` | O | Integer 1-3 (`LEXICON_CARRY_MAX`): how many following **patient** replies may supply the value of a heard cue. Requires `heard: true`. Physician lines and blank segments do not count. Not allowed when any band of the entry records an option with `f = 0`, because a bare follow-up reply must never record a negative answer (V28). |
| `scale[i].yieldTo` | O | Non-empty list of ids of other scale or yes/no entries of this lexicon. In an utterance where one of them is present (any of its cue or phrase list occurs, negated or not, or it is the item of an open reply window, including a yield-only window that follows a withheld value), this entry captures nothing, shows nothing as heard and arms nothing, unless one of its own `anchor` phrases occurs **unnegated**. Not itself, no duplicates, no cycle among scale entries (V28). |
| `scale[i].anchor` | O | Non-empty phrase list; only meaningful with `yieldTo` (V28). An unnegated anchor in the utterance stops the yield. |
| `scale[i].carryExclude` | O | Non-empty list of band phrases of this entry, each written exactly as in one of its bands' `ph` lists. A carried reply never takes its value from them, but they still count there: a reply holding one that is negated, or whose band differs from another match in the reply, is refused, and a reply holding only these phrases is refused. In direct extraction they set a value only in the **same sentence** as the cue; a sentence ends at `.` `!` `?` or `;` followed by a space or the end of the text, so "2.5" does not end one and "e.g. " does. In any other sentence of the same line they are ignored. Use it for phrases that a bare reply could mean differently, such as a day range that may describe how long the illness has lasted rather than one episode. Requires `carry` on the same entry. Lowercase, no duplicates (V28). |
| `carryRefuse` | O | Non-empty phrase list with two roles. In a **carried reply**, one of these phrases refuses the carry (for example an onset, "a few hours ago", rather than a duration). In the **own utterance** of an entry with `heard: true`, one of these phrases withholds the band value, the entry is shown as heard, and no carry-over opens from that utterance (the clinician asks). So it can only prevent a capture, never cause one. Warned when no scale entry has `heard: true` or `carry` (V28). |
| `normalize` | O | `{apostrophes?, numbers?}`, applied to the text before matching. `apostrophes: true` folds the typographic apostrophes U+2018, U+2019, U+02BC and U+2032 to `'`, so "don’t" typed on a phone meets the same cues as "don't". `numbers: "en"` spells standalone whole numbers 0-20 and the round tens 30-90 as English words **for band phrase matching only** ("2 minutes" matches the band phrase "two minutes") and leaves every other number as digits: 21-29 and the other non-round numbers, 100 and above, decimals, times (`10:30`), fractions (`1/2`), ranges (`3-4`), percentages and digits next to letters (`B12`, `2nd`, `x2`); a period that ends a sentence is not part of the number. `numbers` requires an English `lang`. Unknown keys are refused (V28). Number spelling never reaches cue, yes/no, context, multi-item or red-flag phrases, `anchor`, `carryRefuse` or any negation, third-party or historical window: these run on the apostrophe-folded text, so a typed "10 days" does not meet a cue "ten days" and "numb on 1 side" does not meet "numb on one side". A band match is mapped back to the original text before any window is checked. Reported positions refer to the original text, and the evidence shown is the original text. |
| `clauses` | O | **Chart reading** (release 0.4.7), for every line: typed chart text (extracted with `opts.chart`, the Ambient Scribe's box) and, since the MASQUE clinical lead's decision of 2026-10-12 (D9), spoken and demo lines too. A spoken line keeps carry-over as before (heard slots, `carryRefuse`, `yieldTo`, a heard entry's band from the whole utterance), every attribution cue gates it (`chartIgnoreThirdParty` is typed only), and a deny cue that opens its clause before a word starting no finding (a reply, "no it's more of a whooshing …") lowers no red flag there; typed chart text captures no context marker (kind ctx). An object. When it is absent, every family extracts exactly as without it. Keys (any other is a V28 error): `wordStart`, a boolean that makes every phrase and the lexicon's own negation, attribution and history cues match only at a word start; the lists `affirm`, `deny`, `post`, `prefix`, `breaks`, `scopeEnd`, `complement` (release 0.4.7 review round 3), `mask`, `hedge`, `placeholder`, `thirdParty` and `chartIgnoreThirdParty`, each a non-empty list of `{ph, source}` rows; `placeholderAsk`, `{text, source}`, the question of the one placeholder card; `sections`, `{exam?, family?, skip?, read?}`, each a `{ph, source}` list of header words, a word in one kind only; `examItems`, the item ids that may capture under an exam header (may be empty: nothing captures there); `strictConflict`, yes/no item ids of a negative (rule-out) domain; `redFlags` (review round 2), an object keyed by red-flag ids of the module, each a `{ph, source}` list of chart-register phrases read after `lexicon.redFlags[flag]` (a hit inside a longer hit of the same flag is part of it); `redFlagNegation`, a boolean. A row's `source` is `lead` (the clinical lead's own words), `module` (module text), `draft` (awaiting sign-off) or `lead-approved` (drafted and approved by the clinical lead; MASQUE's drafted rows since its sign-off of 2026-10-12); `placeholderAsk.source` is `lead`, `draft` or `lead-approved`. What the lists do: `affirm` ends a denial, and a nearer affirm cue wins; `deny` denies the mentions after it in its clause, and on a line heading a list of lines ("Patient denies:") the items below it (a list denial; the lexicon's own negation cues stay window-only, the window clipped to the clause); `complement` words (review round 3) say the denied word is something else ("No workup for diplopia"): a list denial does not reach past one and no denial lowers a red flag past one, while the lexicon's window still reaches past one for a yes/no item; `scopeEnd` words end a list denial (and a window): a mention past one, or followed by one in a later list item, is set aside, neither yes nor no; `post` denies the mention right before it (a ":", one word or a list of findings it closes between) when it closes the item; `prefix`, glued to a phrase, drops the mention (attribute negation, never a "no"); `breaks` end a clause; a phrase hit inside a `mask` word is no hit; a clause holding a `hedge` or `placeholder` cue records nothing and is asked instead; `thirdParty` joins the attribution gate; `chartIgnoreThirdParty` names cues of `lexicon.thirdParty.cues` that do not gate in typed chart text (`opts.chart`) when a finding follows them (pronouns such as "her " that name the patient in a chart note: "Her tinnitus …", not "Her husband …"). A negation cue of the lexicon, or a `deny`, `post` or `prefix` cue, lying inside a longer `affirm` or `hedge` cue is no cue (review round 2: "no relief" holds "no ", "not sure" holds "not "). A cue right after a finding, with only a ":" or "-" between (or nothing, before a cue that starts with no letter or digit, such as "(+)"), answers that finding as a label: an `affirm` cue so placed affirms it whatever else would deny it, and a `deny` cue so placed opens no list denial (review round 2). The cue lists (`affirm` to `thirdParty`, not `mask`) match as whole words: at a word start and a word end, except on a side where the cue's own character is no letter or digit (`"has "`, `"non-"`, `" negative"`, `"?"`); phrases still match as stems. Under an exam header only `examItems` capture (its sub-labels, "HEENT:" or "Neuro:", keep the exam); under a family header every capture is attributed to someone else except a `thirdPartyExempt` entry; under a skip header nothing captures; a `read` header is read normally and ends any section, any other header ends a skip or family section, and a section word as an inline label ("Allergies: NKDA") holds for its line only. A yes/no entry with one finding said both ways (the same phrase, or overlapping spans of two of its phrases, affirmed and denied) records nothing; when different phrases disagree the affirmed mention wins, except for a `strictConflict` item, where any affirmed and any denied mention records nothing (a rule-out item's "yes" lowers the index). With `redFlagNegation: true`, a red flag whose every mention is denied is neither raised nor listed, a mention of a flag being denied only by a denial that governs it directly (a prefix, a window cue with nothing but other words between, a deny cue naming it first in its list item or in a later item, a closing post cue right after it); without it, red flags are never negated. Every capture's evidence becomes its clause, and `clause: {start, end}` is added. The exact segmentation and negation order are in `engine/extraction.js` ("Chart reading") and design 06. |
| `clarify` | O | **Clarification triggers** (release 0.4.7). Read only by the Ambient Scribe's Clarify section (`clarifyCues`), never by extraction, so no capture depends on it. A non-empty list of `{id, ph, unless?, probe` or `item, ask?, source}`: `id` matches `^[a-z][a-z0-9_]*$` and is unique; `ph` is a non-empty list of trigger phrases; `unless`, when present, is a non-empty list of qualifiers that resolve the mention when one is in the same clause; exactly one of `probe` (a probe of the module's logic) or `item` (an item); `ask` (`{text, source}`, `source` `lead` or `draft`) overrides the question; `source` is `lead`, `module` or `draft`. A trigger in a clause that is not denied, attributed, historical, in a skip or family section or holding a placeholder, and with no `unless` phrase in that clause, puts a card under the box; triggers and `unless` phrases are matched without the `clauses.mask` (review round 2). The card shows the clause, the question (`ask.text`, else the probe's `say`, else the item's `ask`), the answers (the probe's options, or the item's own) and Skip. A click records the clinician's answer: a probe answer through the probe path (flags only raised), an item answer as a clinician answer. With `clauses` (typed chart text), an item mentioned only in hedged clauses and a yes/no item stated both ways are asked in the same way, and unfilled template text shows a notice (`clauses.placeholderAsk.text`) with one Dismiss control (review round 2). Cards come in text order, one per target, and a card whose target is already answered is not shown. |

The optional fields above have no effect when absent: a lexicon without them behaves exactly as it
did before release 0.4.1, and every scale entry is a separate decision (there is no engine
default). The Rubric Editor shows `heard`, `carry`, `yieldTo`, `anchor` and `carryRefuse` read-only
and keeps every one of these fields byte for byte (§6.3). Band order stays significant for an entry
without `heard`: the first band in list order with any match wins, so an appended band phrase can
change a value where an earlier band now wins. Append phrases at the end of their list and add a
collision case to the gold set. For an entry with `heard: true`, every band match counts, and a
match contained in a longer match is dropped. If any remaining match is negated, a `carryRefuse`
phrase occurs, or the remaining matches name two or more different options, no value is taken and
the entry is shown as heard. A `carryExclude` match counts in all of these tests wherever it lies,
but it supplies the option only in a sentence where one of the entry's cues is said (not negated,
attributed or historical); when every remaining match is an excluded one outside such a sentence,
no value is taken either (release 0.4.1 round 3c). When that
happens with a band match present, no carry-over opens from the utterance, so a later reply cannot
supply the withheld value; an utterance with no band match at all still opens carry-over as
before. Exactly one option → that option.

If the entry has `carry`, a withheld value opens a **yield-only** reply window instead (release
0.4.1 round 3b). For the next `carry` patient replies the entry still counts as present for the
entries that list it in `yieldTo`, so they keep yielding, but no reply supplies its value. If a
reply window of the entry is already open and its item is still unanswered and not skipped, a
withheld value turns it yield-only and renews it for `carry` replies (round 3c); it does not close it. A later utterance that names the entry's cue with no band match
at all opens a normal window again. A withheld value of an entry with `carry` also ends an open
normal window of another entry, unless that line withholds the other entry's value too (round 3d,
release 0.4.3). The withheld entry's yield-only window replaces it; when two or more such entries
are withheld on one line, no window stays open. A cue heard on that same line with no band match
at all is decided first, as on any line: if the only such cue is the other entry's own, the other
entry's normal window opens afresh and the next reply may still be carried into it (design 05
§13.12, follow-up F-3D-1); any other such cue opens its own entry's window or closes the window.
Otherwise no reply after that line is carried into the other entry until its cue is heard again
with no band match. From the next line, while the window would otherwise still be open, an entry
that yields to the other entry, and not to the withheld one, stops yielding: its value may be recorded, and its cue heard with no band match may close the
window, keep a third entry's window from opening, or, if it has `carry`, open its own. An entry
that yields to such a third entry may then record the value that window would have carried (design
05 §13.12, follow-up F-3D-4). This needs no module data: it follows from `heard`, `carry` and
`yieldTo`, and it needs two entries with `carry`.

`clauses` and `clarify` follow the same rule: absent, the lexicon behaves exactly as before release
0.4.7 (no chart reading, no clarification card). They are module data: which words affirm, deny,
break a clause, hedge or head a section, and which mention asks which question, is the module's,
and the engine names no item, probe or condition. Each row records where it comes from (`source`),
so a built-in module can ship drafted rows clearly marked until its clinical lead signs them off,
and then mark them `lead-approved` (MASQUE: every drafted row since the sign-off of 2026-10-12).
The Rubric Editor has no control for either field and keeps both byte for byte in every derived
lexicon. Both are locked ("approved lexicon configuration") and shown as read-only summary lines in
its lexicon section.

Every phrase and cue, `anchor` and `carryRefuse` phrases and the `clauses` and `clarify` lists included, is lowercase and non-empty (V29). Without a lexicon the Scribe hides its
transport (Listen, Play, Step, typed input) and says why; nothing is captured from speech that
could have no structured use.

### 2.9 Patient wording (`locales`)

`locales.<loc> = {reviewed, editedLocally?, stale?, items, redFlags, contextItems?, steps?, ui?}`.

- `items`: item id → `{q, opts?, ask?, help?, clin?}`; every item covered and `opts.length ===
  scale.length` when `en.items` exists (V32). `redFlags`: flag id → `{q, say}` (V23).
- `clin` (optional, release 0.4.2) is for translations only: the item's clinician line in that
  language, shown in the summary's "For my clinician" block instead of the English
  `item.patientClin`, followed by the locale's option label in brackets. Each line carries its own
  `lang`. Without it the block uses `patientClin`, tagged as English. A `clin` in `en` and an
  empty `clin` are V32 errors (English takes its line from `patientClin`); V60 checks it like
  every patient string. It is not a fallback leaf, so its absence raises no V33. In the Rubric
  Editor it is the optional field "Clinician line (patient summary)" of a non-English locale; it
  is marked stale when the item's `patientClin` changes.
- `contextItems`: id → `{q, opts: [[value, label]]}` in the *patient's* own vocabulary.
- `steps`: patient step key → `{title?, heading?, lede?, intro?}`; `ui`: `{sub?, forYouIf?,
  clinicianLede?}`.
- `reviewed` is `true` only for wording a qualified reviewer has checked. A non-English string that
  falls back to English is a warning, and an error when the locale claims `reviewed: true` (V33).
  Such a fallback is shown as English. Most fallback surfaces are tagged `lang="en"`: chrome, step
  titles, item questions, help and options, and, since release 0.4.2, a "not sure" question whose
  `q` falls back, which also takes the English question form ("Do I …?"), never the locale's
  grammar. Red-flag text and the summary-template fallback are not yet tagged (see the built-in
  module's CHANGELOG, Known limits).
  An unreviewed locale shows the unreviewed-translation banner on screen, in print and in exports.
  A complete translation is not a reviewed one: the built-in MASQUE `es` has no fallback since
  release 0.4.2, but its added Spanish was produced by AI agents (two independent drafts, then
  clinical, language and mechanical review by AI agents), not by a qualified human medical
  translator, so it stays `reviewed: false` until a bilingual clinical reviewer signs it off
  (`app/modules/masque/SOURCES.md`).
- No locale entry has a `points`, `action` or `differential` key (V34).

Without `locales.en.items` the Patient Companion is disabled for the module, and says so.

**English version of a translated summary (release 0.4.8).** In any locale other than English the
summary (screen, print, `.txt`, `.html`) adds, after the locale's findings, the English summary of
the same answers, titled in the locale and in English (`PATIENT_CHROME.englishVersion`), so an
English-speaking clinician can read the findings. Under its title it repeats, in English, the
caveat lines English output prints for the module (the patient provenance of an uploaded or derived
module, and the edited-wording notice when `locales.en.editedLocally`). It needs `locales.en` and the
module's English summary templates; if the English summary fails, the translated summary is withheld
too.

### 2.10 Research

`research = {projectKey, title, target, threshold, calibration: {midpoint, slope, appliesTo:
{scoringHash}}, sources, expected, demo, scoreAliases, artifactKey, etlScript, fairnessAxes,
fairnessPolicyOverride?, demoCohorts?, population?}`. The calibration is **illustrative** and
applies only while `appliesTo.scoringHash` equals the module's computed `scoringHash` (§4.2);
otherwise the Research tab withholds every figure that runs through it and says why.
A tolerance override must carry `toleranceSetBy`, `toleranceRationale` and `toleranceSetOn`
(V37). `population = {index, schema, map}` (paths under `./data/` or `./etl/`) is accepted only on
a built-in or a verified derivation of one (V37, V54): the population estimates describe a
specific phenotype from survey items, not any rubric's weights.

### 2.11 FHIR and CDS identity

Twelve fields are **identity templates** (`IDENTITY_TEMPLATE_FIELDS`): `fhir.questionnaireUrl`,
`codeSystem`, `answerSystem`, `criteriaSystem`, `weightExtension`, `indexCode`, `screenIdPrefix`,
`filePrefix`, and `cds.serviceId`, `safetyCardUuid`, `indexCardUuid`, `source.url`. Each must
contain `{id}`, and `questionnaireUrl` must also contain `{instrument}` (V9), so a new id always
yields a new code-system namespace. The rendered systems must be absolute URLs (V35), and a
rendered identity value may not equal another loaded module's (V56). Without `fhir`/`cds` the
engine uses `DEFAULT_FHIR` (`http://screenair.example/{id}/…`).

The remaining strings (`questionnaireName`, `questionnaireTitle`, `publisher`, `description`,
`safetyGroupText`, `indexDisplay`, `documentType`, `documentTitle`, `cds.hook`, `title`,
`description`, `source.label`, `examples`, `preview`) are plain text. `cds.examples.settled`, when
present, must be a score the module's own cut-points put in the stated band (V36).

### 2.12 Copy slots and placeholders

`copy` holds the module's noun phrases and paragraphs for engine-drawn surfaces; every key is
optional and falls back to `ENGINE_COPY_DEFAULTS`, which name the module only as `{name}`. The slots
are listed in `COPY_SLOTS` (`indexName`, `gate.patternPhrase`, `screener.*`, `scribe.*`, `note.*`,
`cds.preview.*`, plus `locales.en.ui.clinicianLede`).

Placeholders allowed everywhere: `{name}`, `{id}`, `{instrument}`, `{scaleMax}`, `{indexName}`.
`cds.preview.indexTitle` also takes `{cdsTerm}`; `cds.preview.indexBody` takes `{total}`,
`{scaleMax}`, `{bandLabel}`. Any other placeholder, or unbalanced `**bold**` markers, is V39.
The only markup in data is `**bold**`; there is no HTML anywhere in module data.

### 2.13 EMR template (`emrTemplate`)

Since release 0.4.3 the Clinician Screener and the Ambient Scribe have an **EMR Friendly
Template** button. It opens a script-free iframe with a plain-text consult note for pasting into
an EMR (`engine/emr.js`, `buildEmrTemplate`). The engine writes the note's structure, its gates
and every placeholder. The module supplies its own text (items, red flags, phenotypes, copy,
routing recommendations, probes) and, optionally, this block. The block holds everything
module-specific the engine may not name:

- which citation goes under which red flag, and which flag needs a workup placeholder;
- which items and probes signal which checklist row;
- which references show for which complaint;
- which routing recommendations' chips are instruments;
- which exam rows a probe can fill.

The engine itself names no id, phenotype value or condition.

Without the block a module gets the **neutral template**: the same sections and gates, the
screen result, the red-flag module actions and the routing recommendations, generic placeholders,
and no references, checklist or exam rows. That is the right default for a new module: add the
block only with sources a clinical author has checked.

```json
"emrTemplate": {
  "citations": {
    "SRC-A": { "title": "Example guideline title", "publisher": "Example society",
               "citation": "Author A, et al. Example guideline title. Journal. 2026;1(1):1-2.",
               "url": "https://example.org/guideline", "accessed": "2026-10-06" }
  },
  "references":  [ { "label": "Example treatment reference", "citations": ["SRC-A"],
                     "showFor": { "phenotypes": ["<a phenotype value>"] } },
                   { "note": "Example short note", "citations": ["SRC-A"] } ],
  "instrumentRecs": [ "<a routing rule id>" ],
  "redFlagRefs": { "ex_rf1": ["SRC-A"] },
  "redFlagPlaceholders": { "ex_rf1": "example workup - specify" },
  "history":     [ { "item": "ex_a1", "qualifier": "testing not recorded" },
                   { "label": "Prior treatment - agent, dates, response" },
                   { "label": "Prior trial - agent, dates, response", "probe": "<a probe id>" } ],
  "checklist":   [ { "id": "step1", "group": "example group", "label": "Example management step",
                     "placeholder": "date / result", "citations": ["SRC-A"],
                     "signals": [ { "item": "ex_b1", "value": "yes", "render": "done" },
                                  { "item": "ex_b2", "value": "yes", "render": "note",
                                    "qualifier": "detail not recorded" } ] },
                   { "id": "step2", "group": "example group", "label": "Example status line",
                     "box": false, "onlyWithSignal": true, "citations": ["SRC-A"],
                     "signals": [ { "item": "ex_b3", "value": "yes", "render": "note" } ] } ],
  "examRows":    [ { "label": "Example examination", "citations": ["SRC-A"], "probe": "<an exam probe id>",
                     "optionPlaceholders": [ { "option": 0, "placeholder": "example interpretation - specify" } ] } ],
  "pastHistory": [ { "label": "Example past-history heading", "group": "medical" },
                   { "item": "ex_a2", "group": "family" } ],
  "planAdvice":  [ { "text": "example plan line written by the module's clinical author.", "source": "clinical author", "decided": "2026-10-12" } ]
}
```

| Key | Shape | What the engine does with it |
|---|---|---|
| `citations` | `{KEY: {title, publisher, citation, url, accessed}}`. Key `/^[A-Z0-9][A-Za-z0-9-]*$/`; `url` https; `accessed` `YYYY-MM-DD` | Printed as `<citation> <url>`, metadata and a link only. The footer adds `Reference links accessed: <dates>` when any citation was printed. Every key must be used. |
| `references` | `[{label \| note, citations, showFor?: {phenotypes: [...]}}]` | Printed under "Empiric treatment references (for use before specialist review):" **where the referral gate opens** (safety reviewed, scorable, band above the lowest, no rule error) **or, under an open red flag, where it would open with the flags removed** (release 0.4.6): the plan then prints, after the red-flag actions, the workup placeholder and the routing-withheld line, the heading "Screen-based referral and references (the FHIR bundle withholds the referral while a red flag is open):" and under it the referral block and these references exactly as it would with no flag open (the gate re-run without the flags only). The FHIR bundle withholds the referral under the flag; it never carries the references. `showFor` limits a row to those complaints. A `label` row prints `- <label>: <citation>`; a `note` row prints `- <note>` and one `Ref:` line per key. |
| `instrumentRecs` | `[routing rule id]`, distinct, each a rule of the module's logic whose chips are a fixed list of strings on every surface it has copy for (V61 error otherwise) | The chips of these recommendations print as `  Instruments: a; b`. Other fixed chips print as `  Named on screen: a; b`, and chips a rule computes from the answers are never repeated (the engine checks that first, whatever the list says). List a rule only when every chip of it, on both surfaces, is an instrument. |
| `redFlagRefs` | `{flagId: [KEY]}` | Under each open flag's own `action (points)` line, one `Ref:` line per key. The flag's action is never restated here. Above the actions the engine prints once that Ref lines are background reading, not the source of an action or its timing. Cite under an action only a source that does not contradict it. |
| `redFlagPlaceholders` | `{flagId: text}` | After the flag's `Ref:` lines, `  [<text>]`. Use it where no verified source gives the workup (the engine adds the brackets). |
| `history` | `[{item, qualifier?} \| {label, probe?}]`; no `citations` (V61 error: they would never print) | "TREATMENT AND WORKUP TO DATE": an item prints its own wording (`patientClin`, or `short` for a scale item) and its recorded state: "yes", "answered no", the option label, or "not recorded", never "no" for an unanswered item; when a Scribe probe wrote the answer, `(recorded by clinician via probe: <option>)` follows, otherwise a negative answer is followed by `(<qualifier>)` when the row has one (use it where "no" does not prove a test was done, or could read as a positive finding: MASQUE qualifies `x_lowfreq` and `x_objective` "testing not recorded" and `r_normal` and `r_lesion` "workup not recorded"). A label prints `<label>: [ ]`, and with `probe` the Scribe adds that probe's recorded answer the same way. A label row is also the place for a placeholder heading that names a condition (the engine names none), such as MASQUE's "Acute headache medication use — days per month, by class". Items listed here are left out of the review of systems. |
| `checklist` | `[{id, group, label, placeholder?, box?, onlyWithSignal?, citations, signals?}]`; a signal is `{item, value, render, qualifier?}` or `{probe, option, render, qualifier?}`; `render` is one of `done`, `answeredNo`, `note`, `neverTried`. An item signal's render must match its answer's polarity: `done` and `note` a positive answer, `answeredNo` a negative one ("no", or a scale option with `f` 0); `neverTried` only on a probe signal (V61 errors) | One line per printed row under `Medical management not yet offered — checklist (<groups>):` and a key line ("ticked = recorded as done; unticked = not recorded (not confirmed as not offered)"), in every state. `[x] <label> (sources 1, 3) - recorded on screen: <text>` only when a `done` signal matches (a probe: `recorded by clinician via probe: <note>`; an item answer a Scribe probe wrote: `recorded by clinician via probe: <item wording> (<probe answer>)`). Otherwise `[ ] <label> … - patient reports never tried` (a `neverTried` signal) or `- not recorded`. Then "; screen answered no: …" for `answeredNo` and "; screen records (context only): …" for `note` (a probe, or an item a probe wrote: "; recorded by clinician via probe, answered no: …" and "; recorded by clinician via probe (context only): …"). A `qualifier` is added to the signal's source in parentheses; `placeholder` follows the line as `[<placeholder>]`; `box: false` makes a status line `<label> …: <status>` with no box; `onlyWithSignal: true` prints the row only when one of its signals holds (W when the row has no signals). A row with no matching signal is never ticked, and a signal whose render contradicts its answer is skipped. Each row names its sources by number after its label; the numbers continue the exam rows' numbering, and one list after the plan, "REFERENCES (cited by number in the exam rows and checklist)", holds each cited key once. Keep labels to the class or test name: an indication clause that restates a guideline recommendation is paraphrase, and a label that a tick would turn into a diagnosis (for example "confirmation of <condition>") overclaims. |
| `examRows` | `[{label, citations?, probe?, optionPlaceholders?}]`; `probe` names an exam-kind probe; `optionPlaceholders` (release 0.4.6) is `[{option, placeholder}]` on a row with a probe, one per option, each an option the probe has | `<label> (sources 1, 3): [ ]` (the mark only when the row has citations), after the engine's vitals and general rows. When `probe` names a probe the clinician answered on the Scribe, it adds `(recorded by clinician via probe: <option>; <note>)` and keeps the placeholder; when the recorded option has an `optionPlaceholders` entry, `  [<placeholder>]` follows the row (MASQUE: under the HINTS row for "Normal impulse (points central)"). The rows' citations are numbered first in the one list after the plan, which the checklist continues. |
| `pastHistory` (release 0.4.6) | `[{item, group} \| {label, group}]`; `group` is `medical` or `family`; an item may not also be a `history` row or repeat | "PAST HISTORY / MEDICATIONS / ALLERGIES": a `medical` row after the engine's pregnancy line, a `family` row before its family-history placeholder, which then reads "Other family history: [ ]". An item prints its own wording and its recorded state (as `history` rows do, a probe that wrote it labelled as recorded) and leaves the review of systems; a label prints `<label>: [ ]`. No citations. |
| `planAdvice` (release 0.4.8) | `[{text, source, decided}]`; `text` a non-empty string, `source` non-empty (who decided the line), `decided` a real `YYYY-MM-DD` date | Each `text`, verbatim, as a plan line `- <text>` right after the reference lines (`references`) and before the engine's "treatment offered today" placeholders, **only where the references print with no red flag open**: never under an open flag's screen-based block, never without reference lines, never in the encounter note, the FHIR bundle or the Screener's result cards. `source` and `decided` are the line's record and are not printed. Use it only for a line the module's clinical author wrote and dated (MASQUE: the clinical lead's line of 2026-10-12); it is not the place for guideline text, agents or doses. |

Rules for authors (V61 checks the mechanical ones, §7):

- **Cite and link only.** Store a citation's metadata and URL, never its text. Do not paste or
  paraphrase guideline wording: many societies' terms forbid it, and some (AAO-HNSF) explicitly
  forbid AI-based reuse. Do not store agents, doses, thresholds or durations: the clinician
  writes what was offered into the engine's "offered today" placeholders.
- **Labels are short names** (a therapy class, an exam, a section heading), each with the
  citation keys it rests on. A label is not a recommendation sentence.
- **No `[`, `]`, `{` or `}` in any string** (V61 error). Square brackets are the engine's
  placeholders, and curly braces are template syntax. Keep square brackets out of the module
  strings the template prints too, including probe questions, options and notes and routing copy
  in the logic (V61 warning): use parentheses.
- **Absent is not negative.** Tick a row (`done`) only from an answer that proves the step was
  done. An answer that merely suggests it (a course of "antibiotic/steroid" for an intranasal
  steroid trial) is a `note`, never `done`. A "no" that may mean "never tested" is neither: it
  ticks nothing, and on the history row it gets a `qualifier`. V61 checks the polarity mechanically
  (a negative answer as `done` or `note`, a positive one as `answeredNo`, or `neverTried` on an
  item is an error); whether an answer proves a step is the author's judgement.
- **No caveats** (V38): the engine adds "Prototype · not for clinical use" as the first and last
  line, and the illustrative label after the index.
- **Record the basis.** For a built-in module the block is generated from a delta file with one
  basis entry per row (MASQUE: `app/tests/harness/emr-delta.js`, `SOURCES.md` "EMR template
  data"), and its review status is stated there.

The block is never patient-facing: `projectForPatient` does not carry it, and V60 does not apply
to it. In the Rubric Editor it is read-only (§6.3).

---

## 3. What the engine does when a field is absent

| Absent | Behaviour |
|---|---|
| `steps.screener` | Safety, one step per domain, result. |
| `steps.patient` | A story step (only with context items), then one step per domain titled by the domain label. |
| `contextItems` / `gapRule` | No context questions; no gap alert or gap line. |
| `phenotypes` | No complaint picker; complaint `""`; all domains active; no referral; no CDS index card. |
| logic `routing` | Engine gates still emit the red-flag override and incomplete-screen cards; when cleared and scorable the Screener shows "No routing rules in this module". |
| logic `patientSummary` | The generic summary: each "yes" item's own patient `q`, verbatim, and scale answers as `q — option`. Nothing is invented. |
| logic `probes` | No probe rail; suggestions rank unanswered items by active domain, tag, then weight. |
| `infoPrompts`, `sampleCases`, `demo.transcript` | Not shown. |
| `demo.patient` | A synthetic "Synthetic Patient", MRN `SANDBOX-0000`, with no sex, gender or age. |
| `lexicon` | No voice, playback or typed capture in the Scribe; a notice explains why. |
| lexicon `heard`, `carry`, `yieldTo`, `anchor`, `carryExclude`, `carryRefuse`, `normalize` | Extraction exactly as before release 0.4.1: nothing is shown as heard, nothing is carried from one reply to the next, no entry yields, and the text is matched as typed. |
| lexicon `clauses`, `clarify` | Extraction exactly as before release 0.4.7: no clause reading, sections, word-start rule or list denial; red flags are never negated; each capture's evidence is the whole utterance. No clarification card is shown. |
| `locales` / `locales.en.items` | The Patient Companion is unavailable for the module, with a notice. |
| `research` | Research shows the population state and "This module declares no research configuration". |
| `research.population` | "No population estimates for this module." |
| `fhir` / `cds` | `DEFAULT_FHIR`; no CDS settled example. |
| `copy.*` | `ENGINE_COPY_DEFAULTS` (lead question Q10). |
| `emrTemplate` | The neutral EMR template: placeholders, the screen result, the red-flag actions and the routing recommendations; no reference lines, no checklist, no exam rows beyond vitals and general (§2.13). |

The upload and Apply result cards and the ⓘ module information drawer state the per-tab
availability before the module is used, for example "Ambient Scribe: no voice capture (no lexicon)".

---

## 4. The logic file

### 4.1 Shape

```js
export default {
  format: "screenair-logic",
  contractVersion: 1,
  moduleId: "shape",            // must equal rubric.logicBinding.moduleId (V5)
  logicVersion: "fixture-1",    // informational; the file's SHA-256 identifies it
  reads: { items: { ex_a1: "boolean", ex_a3: { scale: 3 } }, domains: { alpha: {} } },
  routing: [
    { id: "example-high",
      when: (s) => s.band === s.highestBand && s.yes("ex_a1"),
      copy: { screener: { h: "…", p: "…", chips: ["…"] }, scribe: { h: "…", p: "…", chips: ["…"] } } },
    { id: "example-fallback", fallback: true,
      copy: { screener: { h: "…", p: "…", chips: [] } } },
  ],
};
```

(From `app/tests/fixtures/modules/shape.logic.js`.) The file is fetched as text and compiled by
the loader's `importSource`, which refuses `import`, `export … from`, dynamic `import()` and JSX
before anything runs (V57). It must have a default export. A file whose top level does anything
other than build that object is code with side effects; the upload dialog lists the page and
network APIs it mentions (V59) and asks for consent before running it.

### 4.2 Where functions may appear (`LOGIC_PATHS`)

```
phenotypes.derive[].when          phenotypes.activation[].when
routing[].when                    routing[].copy.screener.{h,p,chips}   routing[].copy.scribe.{h,p,chips}
patientSummary.derived.<name>     patientSummary.said[].{when,text}     patientSummary.ask[].{when,text}
locales.<loc>.sum.<any depth>     probes.list[].when
```

Anything else in the logic object is plain data (V40).

| Key | Shape |
|---|---|
| `phenotypes.derive` | `[{value, when(PhenotypeState)}]`, first match wins; none → `rubric.phenotypes.scribeDefault`. |
| `phenotypes.activation` | `[{id, domains, when(ActivationState)}]`: domains added to the Scribe pool. |
| `routing` | Ordered `[{id, when?, fallback?, copy: {screener?, scribe?}}]`, evaluated **after** the engine gates; `copy.<surface> = {h, p, chips}` (strings or functions of the state); a missing surface hides the rule there; at most one fallback per surface (V42). |
| `patientSummary` | `{groups: {name: [item ids]}, derived: {name: fn}, said: [{id, when?, text}], ask: [{id, when?, text}]}`; the last `ask` rule has no `when` (V43). |
| `locales.<loc>.sum` | Strings, lists, word maps and template functions the summary rules read through `s.S`; every key a rule reads must exist in every locale (V44). |
| `probes` | `{version, list: [{id, kind, when(answers, redFlags), target?, rescues?, say, why, opts: [{l, rf?, a?, note?}]}]}`; `version` is the **probe set** axis (V45). In the Scribe an option's `note` and the EMR checklist signals keyed on it belong to the probe answer: when the clinician changes or clears, in the Question review, an item that the chosen option's `a` wrote, the engine withdraws that probe answer, its note and signals with it, and the probe may be asked again (release 0.4.8). |

### 4.3 The `reads` declaration

`reads = {items: {id: "boolean" | {scale: n}}, domains?: {key: {negative?}}, redFlags?: [ids],
phenotypes?: [values], context?: {id: [values]}, gapMarkers?: [ids]}` lists everything any
closure or probe reads or writes. The validator checks it against the rubric (V41: every id
exists, with the declared type and the **exact** number of options) and then checks it is
complete by running every closure behind recording proxies (V47: an undeclared access is an
error; a declared id nobody reads is a warning). The Rubric Editor locks the structure the logic
reads (ids, types, option counts) and asks for an acknowledgement before the wording of anything
in `reads` changes, so an edit cannot silently disable a rule such as `s.scale("x") === 2`.

### 4.4 The states closures receive

Each state is a fresh, deep-frozen object. Closures must be **pure**: V48 calls each twice on the
same state and fails on a different result.

| State | Fields |
|---|---|
| `RoutingState` | `surface` (`"screener"`\|`"scribe"`), `answers` (unanswered keys absent; `"unsure"` never present), `ctx`, `complaint`, `phenotypeError`, `band`, `total`, `floor`, `ceiling`, `coverage`, `scorable`, `answered` (**the number** of answered items), `count`, `domains`, `items` (domain key → rubric domain), `activeFlags`, `override`, `emergent`, `routingCleared`, `lowestBand`, `highestBand`, `scaleMax`, and the helpers. |
| `PhenotypeState` | `answers` and the helpers. |
| `ActivationState` | `answers`, `complaint` and the helpers. |
| `PatientState` | `a` (may hold `"unsure"`), `ctx` (patient vocabulary), `loc`, `S` (that locale's `sum`, else English), `yes`, `scale`, `unsure`, `L(list)` (the locale's list joiner), `groups` (group → ids answered "yes"), then each `derived` value. |

Helpers: `yes(id)`, `no(id)`, `isAnswered(id)` and `scale(id)` (option index or `null`). On
`RoutingState`, `answered` is the count, so the per-item predicate is always `isAnswered(id)`
(orchestrator decision F5). Probes keep their original signature, `when(answers, redFlags)`,
with frozen copies.

### 4.5 Failing closed

The engine catches every throw and records `{family, ruleId, message}`; the shell shows a red
"Module logic error" strip while any error exists.

| Family | On a throw |
|---|---|
| routing, phenotype `derive` | No routing on either surface: an engine "Module rule error — no routing issued" card, no referral, no CDS index card, an engine line in the note's A&P and a withheld-routing note on the Observation. |
| activation | All domains active (the pool only widens). |
| patient summary rules or templates | The summary is withheld; Print and both downloads are disabled. |
| probe `when` | The probe is shown with an "evaluation error" tag (a safety question surfacing is the safe direction). |

### 4.6 Probes: what the engine enforces

Supporting (phenotype) probes never write to a scored item, and rescue probes stay live while
their target reads negative. `engine/probes.js` (`validateProbes`) enforces the first; V46 checks
the second for every rescue probe over every smoke state (`when` with the rescued item unset must
equal `when` with it set to its negative value). This enforcement is engine code and applies to
every module; a module's probe list cannot switch it off.

---

## 5. Versions, hashes and identity

### 5.1 The five version axes

They are deliberately different numbers. Each has one owner, and all five appear separately in
the footer, the ⓘ drawer, the export manifest, the model card and cohort rows.

| Axis | Owner | Moves when |
|---|---|---|
| Release | `engine/policy.js APP_VERSION` (0.4.7) | Any app-level change ships. |
| Instrument | `rubric.instrumentVersion` | Anything in the instrument hash changes (§5.2). |
| Lexicon | `rubric.lexicon.version` | A phrase, cue or window changes, or any of `heard`, `carry`, `yieldTo`, `anchor`, `carryExclude`, `carryRefuse`, `normalize`, `clauses` or `clarify` changes (all are inside `lexiconHash`). |
| Probe set | `logic.probes.version` | A probe is added, removed or reworded. |
| Gold set | `rubric.lexicon.goldSet.version` | The benchmark utterances change. |

The module-menu label (for example "Dizziness and Sinusitis (MASQUE v1)") is display copy, not an
axis.

### 5.2 Hashes

`engine/hash.js rubricHashes` is the only implementation. Each hash is SHA-256 over canonical JSON
(sorted keys, array order kept) of a projection of the rubric.

| Hash | Covers | Used for |
|---|---|---|
| `instrumentHash` | domains (key, label, max, negative; items id, w, text, ref, scale labels and f), band cuts, red flags (id, tier, group, text, points), the Questionnaire strings | "Same published instrument?" |
| `scoringHash` | domains (key, max, negative; items id, w, scale f), band cuts | Whether the illustrative calibration applies; "scores not comparable" |
| `lexiconHash` | the lexicon without `version`, `lang`, `goldSet` (so `heard`, `carry`, `yieldTo`, `anchor`, `carryExclude`, `carryRefuse`, `normalize`, `clauses` and `clarify` are covered) | The lexicon axis |
| `contentHash` | the whole rubric without `provenance` (so an item's `ask`, `short`, `tag` and `patientClin`, and the patient wording, are covered here only) | Detects a derived rubric edited after it was created |
| `rubricSha256`, `logicSha256` | source bytes | Dedupe, ancestor records, recognising built-in logic |

### 5.3 Derived modules and the `-local` tag

Editing a module never changes it in place. **Apply** in the Rubric Editor (or "Load as derived"
in the upload dialog) creates a new module:

- a new id, by default `local-<root id>-<6 hex>`, and a label by default
  `<root label> — edited <YYYY-MM-DD>`;
- `provenance = {root, derivedFrom, lineage, contentHash, createdAt, source?}`, copied forward on
  every generation, so a third-generation module still names its built-in root;
- a `derived` change-log entry with the required change note, the changed paths, the axis moves
  and every acknowledgement;
- `logicBinding` pinned to the root's logic by SHA-256 (logic is read-only in screenAIr v1);
- the root's `research.calibration` and `research.population` unchanged, so the calibration gate
  fires when scoring changed; the CDS settled example removed when scoring changed;
- edited patient wording marked `reviewed: false, editedLocally: true`, and every translation of an
  edited English string listed in that locale's `stale[]` and marked unreviewed.

**Family version rule (V53).** Within a family (the root, its lineage and every loaded module with
the same root), equal instrument versions ⇔ equal `instrumentHash`, and an instrument that differs
from the root's must carry the pre-release tag `-local` (default
`<root version>-local.<6 hex>`, e.g. `0.2-local.3f9a1c`). No built-in version contains `-local`
(V6). The same holds for the lexicon. An edited instrument therefore never prints as a plain
MASQUE number, and an edit that restores the exact instrument takes the root's version back.

Provenance is **integrity, not authentication**: every check compares hashes with modules the
browser has actually loaded, and a forged block can earn at most the "Edited" badge and the root's
population estimates under the "not recomputed" banner.

---

## 6. Upload, edit and download: the round trip

### 6.1 Uploading

Choose **Upload** in the module menu (the second option) and select one or more files, or drop
them. Accepted:

| File | Becomes |
|---|---|
| `*.json` with `format: "screenair-rubric"` | A rubric; binds per `logicBinding`. |
| `*.js`/`*.mjs` byte-identical to a loaded built-in's logic | That built-in's logic, **not executed**, no consent needed, accepted even where JS uploads are off. |
| other `*.js`/`*.mjs` | A logic file (`format: "screenair-logic"`, needs its rubric in the same upload) or a self-contained module (`"screenair-module"`). Runs only after the consent checkbox; refused where `SITE.ALLOW_JS_UPLOAD` is `false`. |
| `*.zip` from Download all | Each listed module; byte-identical ones are skipped as "already loaded". |
| `.csv`, `.tsv`, `.xls(x)`, `.ods`, `.doc(x)`, `.pdf` | Refused: "Spreadsheets and documents are not supported. Download the current module's rubric (.json) and edit its weights, or use the Rubric Editor." |

Limits (`policy.js LIMITS`): rubric 2,000,000 bytes, logic 512,000 bytes, zip 20,000,000 bytes,
20 files per upload; text must be valid UTF-8 (V58).

**Before anything runs**, every file is read, hashed and classified; a `.js` is parsed only
(`inspectSource`). Executable code shows the red box "This file contains executable code. It will
run inside this page with the same permissions as screenAIr …" and needs the checkbox. Uploaded
JavaScript is trusted code, not sandboxed: load it only if you trust its author.

On **Validate**, each module gets a result card: ✓ or ✗, errors as `code · path · message`,
warnings, and the availability summary. **Load** is enabled only with zero errors. A JSON-only
module can be remembered in this browser (opt-in); nothing uploaded restores itself on reload,
and a remembered module is re-verified when it is restored. Answers, transcripts, cohort rows and
patient data are never stored.

**How a rubric is classified** (first match wins):

1. Byte-identical to a loaded module → skipped, "already loaded".
2. Its `id` is a built-in's but the bytes differ (a hand-edited `masque.rubric.json`) → offered
   **Load as a module derived from <label>**.
3. It claims a loaded built-in root and every check passes (root hashes, logic binding,
   `contentHash`, well-formed lineage) → a **verified derivation**, badge "Edited module".
4. It claims a loaded built-in root but a check fails (for example a weight changed by hand after
   download) → **Load as derived**, naming the failed check.
5. It is kin to a built-in (binds its logic, or reuses its `name`, Questionnaire name, title,
   publisher, CDS title or source label) → **Load as derived**.
6. It claims a non-built-in root that is loaded or in the same upload, and its content checks →
   derived from an upload (no population estimates).
7. Anything else → **Uploaded module** (no population estimates; V37 refuses `research.population`).

### 6.2 Pairing a rubric with its logic

`logicBinding: "generic"` needs no logic. `{moduleId, logicSha256?}` binds to, in order: a logic
file with that `moduleId` (and SHA, if given) in the same upload; a loaded logic with that
`moduleId` and SHA; with no SHA given, the built-in logic with that `moduleId`. Otherwise:
"Needs the logic file for '<moduleId>'". A SHA mismatch against an otherwise matching loaded logic
is a warning (V5). A logic file whose `moduleId` is a built-in logic's is refused unless it is
byte-identical ("Logic id '…' is reserved for the built-in logic").

### 6.3 Editing in the Rubric Editor

The fifth tab edits a **draft** of any loaded module without switching to it; drafts autosave in
this browser. Editable: labels and names, item text and patient wording, item weights `w` and scale
`f`, band cuts, red-flag wording (tier changes and deletions behind a safety confirmation), context
labels and the gap threshold, lexicon phrases (the last phrase of a flag cannot be removed), copy
slots, and new items through the **Add item** form. Locked: ids, domain structure (add, remove and
reorder domains in a rubric JSON instead), item types and option counts the logic reads, `negative`,
the version fields (set in the Apply dialog) and the logic (edit the `.js` and upload it).
The lexicon's `heard`, `carry`, `yieldTo`, `anchor` and `carryRefuse` are shown read-only
(approved lexicon configuration) and kept byte for byte in every derived lexicon; to change
them, edit the rubric JSON and upload it. `carryExclude` and `normalize` have no editor control
and are likewise kept byte for byte, as are `clauses` and `clarify` (release 0.4.7), which are
locked with the same reason and shown as read-only summary lines. Deleting an added item
that a `yieldTo` names removes it from that list (and removes `yieldTo` and `anchor` when the list
empties), so a deletion never leaves a V28 error behind.
The `emrTemplate` block (release 0.4.3) is locked whole ("cited clinical content"; since release
0.4.4 the reason names the built-in module's sign-off of 7 October 2026). Deleting an item
removes the history rows and checklist signals that name it, and deleting a red flag removes its
`redFlagRefs` and `redFlagPlaceholders` entries, so neither leaves a V61 error. Any
other change to the block in a draft, a reorder included, is a lock violation. To change it, edit
the rubric JSON and upload it.

Live validation runs the full validator on the draft, and **Apply** stays disabled while any error
exists or any acknowledgement is outstanding. The impact preview shows, for each sample case (and
this session's current screens when the edited module is active), the total, range, band, the
routing rules that fire and the patient summary sentences, parent → draft. It is not a validation.
**Create module** keeps the active module and every screen; **Create and switch** asks first,
listing what switching clears.

### 6.4 Downloading

The Rubric Editor's Downloads section offers **Download all modules (.zip)**, **Download this
module (.zip)**, **Download rubric (.json)** and **Download logic (.js)**. The zip
(`screenair-modules-YYYY-MM-DD.zip`, deterministic, store-only) contains:

```
README.txt                    what each file is and how to re-upload; the five axes; release; date
manifest.json                 format "screenair-export"; per module: versions (each axis separate),
                              hashes, classification, provenance, change log, validation, file hashes;
                              a `failed` list for modules that did not load
<id>/<id>.rubric.json         the rubric as loaded (with any derived provenance)
<id>/<id>.logic.js            the logic source exactly as loaded (absent for generic logic)
<id>/CHANGELOG.md             generated from the change log (non-built-ins)
<id>/<doc>                    built-ins: every file in the registry entry's `docs`, byte-for-byte
<id>/generated/…              Questionnaire, CDS Hooks, data dictionary, cohort columns
<id>/research/…               built-ins with population estimates: the index, artifacts, schema, map
```

It never contains answers, transcripts, cohort rows or patient data.

### 6.5 The round trip

1. **Download** a module (or all of them).
2. **Edit** the rubric JSON in a text editor, or keep the zip as is.
3. **Upload** the `.json` (with its `.js` if it has custom logic) or the whole `.zip`.

A derived module comes back as the same verified derivation, its logic (the built-in's bytes)
binds without running, and the `roundtrip` suite checks that rubrics, logic bytes, hashes,
classifications and engine outputs are identical after the trip. A hand-edited built-in rubric
cannot come back as the built-in: it is offered as a derived module whose instrument version
carries the `-local` tag.

---

## 7. Validator codes

`validateModule` returns `{ok, errors, warnings, info}` and never throws. **E** keeps a module
from mounting (the shell shows the invalid-module card; the upload dialog refuses it); **W** is
shown and passes. `validateRubricShape` runs the rubric-only checks for the editor's live
feedback. Each code is exercised by at least one mutated fixture in `app/tests/fixtures/mutations/`.

| Code | Sev | What it means |
|---|---|---|
| V0 | E | The validator itself failed on this input (reported, never thrown). |
| V1 | E | `format` / `contractVersion` wrong (rubric, and logic when bound). |
| V2 | E | `id` not a valid slug, or `name`/`label` empty, or label over 80 characters. |
| V3 | W/E | Unknown top-level key (a typo) (W); `changelog` missing (E). |
| V4 | E | The rubric is not pure JSON (function, `undefined`, NaN, ±Infinity, Symbol, Date or a cycle). |
| V5 | E/W | Logic `moduleId` ≠ `logicBinding.moduleId`, generic binding with logic, malformed SHA (E); bound logic SHA differs from the one recorded (W). |
| V6 | E | A version (instrument, lexicon, probe set) is malformed, or a built-in version contains `-local`. |
| V7 | W | The label appears in an identifier, item id or cohort-facing value. |
| V8 | E/W | Module id not unique, or reuses a built-in id or prefix; logic id reserved; label equals a built-in's (E); label equals another loaded module's (W). |
| V9 | E | An identity template lacks `{id}` (or `questionnaireUrl` lacks `{instrument}`). |
| V10 | E | No domains, duplicate domain keys, or an empty domain. |
| V11 | E | An id is reused across items, context items, flags and info prompts, or has a bad pattern. |
| V12 | E/W | Item weight not finite and non-zero, or empty text (E); `short` missing (W). |
| V13 | E | Scale has under two options, an empty label, `f` outside [0, 1], or no option with `f === 0`. |
| V14 | E | A yes/no item carries a `scale`. |
| V15 | E | A domain's weights do not sum to its `max`, or a weight's sign disagrees with `negative`. |
| V16 | E | `scaleMax ≤ 0`, or cuts not integers with `0 < moderate < high ≤ scaleMax`. |
| V17 | W | `scaleMax ≠ 100`. |
| V18 | E | Context ids duplicated, under two options, duplicate values or missing labels. |
| V19 | E | `gapRule` markers, signals, threshold or `noteOrder` inconsistent. |
| V20 | E | A patient context option list lacks a signal value. |
| V21 | E | No red flags, duplicate flag ids, bad tier, or empty `group`/`text`/`points`/`action`. |
| V22 | E | A red flag carries a weight or score key. |
| V23 | E/W | No English patient `q`/`say` for a flag (E); another locale falls back (W). |
| V24 | E | Patient wording repeats a flag's `points` or `action`, or equals its clinician `text`. |
| V25 | E | Screener steps malformed (safety first, result last, each domain once, extras allowed). |
| V26 | E | Patient steps malformed. |
| V27 | E/W | Phenotype values, default, always-active, tag-boost, referral or CDS-term keys inconsistent. Release 0.4.5, `referral.clinicianRules` (§2.6): not a list, a rule that is not an object, an unknown or repeated phenotype, an empty `source`, `rule` or `clarificationSource`, an empty or non-list `definition`, `clarification` or `confirm` or an empty line in one, a rule that prints nothing, a rule or definition without `source`, a clarification without `clarificationSource`, or a string with `[ ] { }` (E); a field the engine never reads, an escalation `to` or `evidence` among them, or a `clarificationSource` without a clarification (W). |
| V28 | E/W | Lexicon references a missing item, option or flag, or a flag has no cue phrase (E). From release 0.4.1 also the optional lexicon fields `heard`, `carry`, `yieldTo`, `anchor`, `carryExclude`, `carryRefuse` and `normalize`, and from release 0.4.7 `clauses` and `clarify` (E/W; messages below). |
| V29 | E/W | A phrase is empty or not lowercase (E); shorter than 3 characters (W). Covers `anchor` and `carryRefuse` phrases too. With `normalize`: a phrase holding a typographic apostrophe when `apostrophes: true` (W, any list), and a **band** phrase holding a number that `numbers: "en"` spells (W). Both can never match. Release 0.4.7: covers the `clauses` lists and the `clarify` triggers and qualifiers; a `clauses` cue may carry one boundary space at either end and no tab or line break (E), and a cue made only of punctuation (`?`, `***`) is not warned as short. |
| V30 | E | Negation/third-party/historical window or cues invalid, gold-set fields missing, bad `lang`. |
| V31 | E | Unsupported locale key, non-boolean `reviewed`, or `defaultLocale` not `"en"`. |
| V32 | E | English patient wording misses an item, or `opts` do not match the scale; an item `clin` in `en`, or an empty `clin` (release 0.4.2). |
| V33 | W/E | A non-English string falls back to English (W); E when that locale claims `reviewed: true`. |
| V34 | E | A locale entry has a `points`, `action` or `differential` key. |
| V35 | E | FHIR systems not absolute URLs, templates do not render, or Questionnaire strings empty. |
| V36 | E | CDS examples name a missing flag, or the settled example's score and band disagree. |
| V37 | E | Research configuration invalid, or `population` on a module that may not carry it. |
| V38 | E | Module data contains a caveat string (English or, since release 0.4.2, Spanish, including "no apto para uso clínico"), compared with case and accents ignored. |
| V39 | E/W | Unknown placeholder or unbalanced `**` (E); a key that is not a copy slot (W). |
| V40 | E | A function outside `LOGIC_PATHS`, or non-JSON data elsewhere in the logic. |
| V41 | E | `reads` names something the rubric lacks, or with the wrong type or option count; `gapMarkers` ≠ `gapRule.markers`. |
| V42 | E | Routing ids duplicated, `when` not a function, copy incomplete, or two fallbacks on a surface. |
| V43 | E | Summary groups or rules malformed, or the last `ask` rule has a `when`. |
| V44 | E | A summary rule reads a `sum` key some locale lacks. |
| V45 | E | The probe list fails `validateProbes`, an option writes an invalid value, or `probes.version` is missing. |
| V46 | E | A closure throws or returns the wrong type over the smoke states, or a rescue probe retires on a negative answer. |
| V47 | E/W | A closure reads something `reads` does not declare (E); a declared id is never read (W). |
| V48 | E | A closure returns different results for the same state (not pure). |
| V49 | E/W | A sample case is invalid (ids, answer types, `"unsure"`, context values, flags, complaint, `buttonLabel`) (E); unknown icon (W). |
| V50 | E | Demo patient lacks `id`/`mrn`/`synthetic: true` or has a date of birth; malformed transcript. |
| V51 | W | No sample rehearses a red flag, an unscorable screen or a positive rule-out item. |
| V52 | E | A derived module's provenance, lineage, `contentHash` or `derived` change-log entry is incomplete or wrong. |
| V53 | E | The family version rule is broken (§5.3). |
| V54 | E | A derived module changed the root's calibration or population, or kept the settled example after a scoring change. |
| V55 | E | Edited or stale patient wording is not marked unreviewed. |
| V56 | E | A rendered identifier equals another loaded module's. |
| V57 | E | The logic source imports, re-exports or dynamically imports. |
| V58 | E | A file exceeds `LIMITS` or is not valid UTF-8. |
| V59 | W | The logic source mentions page or network APIs (`window`, `document`, `fetch`, `localStorage`, `eval`, …); listed in the consent dialog. A signal for the reviewer, not a sandbox. |
| V60 | E | A patient-facing module string (or a summary sentence produced during the smoke run) matches an omission pattern, or names the module's own `copy.indexName`, a full band label ("<band> likelihood <bandSuffix>"), a multi-word `copy.screener.bandSuffix` or `copy.note.likelihoodOf` (whole phrase, case-insensitive). |
| V61 | E/W | The EMR template data (release 0.4.3): a `[ ] { }` in an `emrTemplate` string, a malformed citation (key pattern, missing title/publisher/citation, non-https `url`, `accessed` not `YYYY-MM-DD`), a citation key, red flag, item, answer value, phenotype, probe, probe option or routing rule (`instrumentRecs`) that does not exist, an `instrumentRecs` rule with computed chips, an exam row naming a probe that is not exam-kind, a reference without exactly one of `label`/`note`, a history row without exactly one of `item`/`label` (or a `probe` or `citations` on it where not allowed, or a `qualifier` on a label row), a blank label, placeholder or qualifier, a `box` or `onlyWithSignal` that is not a boolean, a duplicate checklist id or `instrumentRecs` id, an unknown `render`, or an item signal whose `render` contradicts its answer's polarity (or `neverTried` on an item) (E); an unused citation, an unknown key or citation field, a row field the engine never reads (since round 4, per row kind: references `label`, `note`, `citations`, `showFor`; history `item`, `qualifier`, `label`, `probe`; checklist `id`, `group`, `label`, `citations`, `placeholder`, `box`, `onlyWithSignal`, `signals`; signals `item`, `value`, `render`, `qualifier` or `probe`, `option`, `render`, `qualifier`; exam rows `label`, `citations`, `probe`, `optionPlaceholders`; option placeholders `option`, `placeholder`; past-history rows `item`, `label`, `group`), an `onlyWithSignal` row without signals, or square brackets in a module or logic string the template prints (W). Release 0.4.6 (E): a `pastHistory` row without exactly one of `item`/`label`, with a `group` other than `medical` or `family`, or naming an item that does not exist or is already a history or past-history row; an `optionPlaceholders` list on a row without a probe, an entry that is not `{option, placeholder}`, an option index the probe does not have or that repeats, or a blank placeholder. Release 0.4.8: a `planAdvice` that is not a list, a line that is not an object, a blank `text`, a `source` that is missing or blank, or a `decided` that is not a real `YYYY-MM-DD` date (E); a plan-advice field other than `text`, `source`, `decided` (W). |

The built-in MASQUE module validates with zero errors and the expected warning V12 for `n_allo`,
which has no short label. Since release 0.4.2 it raises no V33: no Spanish string falls back to
English (until 0.4.1 there were 11 such warnings). Its `es` stays `reviewed: false`, because the
added Spanish is an unreviewed translation. Since release 0.4.3 its `emrTemplate` raises no V61
finding.

**V28 rules for the release 0.4.1 lexicon fields.** `p` is `/lexicon/scale/<i>` and `<id>` the
entry's id. They reuse V28 (and V29 for phrases), so no new code was added.

| Sev | Path | Rule | Message |
|---|---|---|---|
| E | `p/heard` | not `true` or `false` | `heard must be true or false` |
| W | `p/heard` | `heard: true` with a `fallback` | `"<id>" has a fallback, so its cue always sets a value and is never heard without one` |
| E | `p/carry` | not an integer from 1 to 3 | `carry must be an integer from 1 to 3: how many following patient replies may supply the value` |
| E | `p/carry` | without `heard: true` | `carry needs heard: true (carry-over starts from a cue heard without its value)` |
| E | `p/carry` | a band `j` records an option with `f = 0` | `band <j> of "<id>" records option <v> ("<label>", f = 0): a follow-up reply must never record a negative answer, so carry cannot be used on this entry` |
| E | `p/yieldTo` | not a non-empty array | `yieldTo must be a non-empty list of lexicon entry ids` |
| E | `p/yieldTo/<k>` | the entry's own id | `an entry cannot yield to itself` |
| E | `p/yieldTo/<k>` | not the id of a scale or yes/no entry of this lexicon | `"<x>" is not the id of another scale or yes/no entry of this lexicon` |
| E | `p/yieldTo/<k>` | listed twice (second and later) | `"<x>" is listed twice` |
| E | `p/yieldTo` | a cycle among scale entries (reported once, at the lowest-index entry) | `yield cycle <a> → <b> → <a>: an utterance that names all of them captures none of them` |
| E | `p/anchor` | without `yieldTo` | `anchor has no effect without yieldTo` |
| E | `p/anchor` | not a non-empty array | `anchor must be a non-empty phrase list` |
| E | `p/carryExclude` | without `carry` | `carryExclude has no effect without carry` |
| E | `p/carryExclude` | not a non-empty array | `carryExclude must be a non-empty list of this entry's band phrases` |
| E | `p/carryExclude/<k>` | not a non-empty string | `a carryExclude phrase must be a non-empty string` |
| E | `p/carryExclude/<k>` | not lowercase | `carryExclude phrases name band phrases, which are matched against lowercased text, so they must be lowercase` |
| E | `p/carryExclude/<k>` | not in any `ph` list of the entry's bands | `"<x>" is not a band phrase of "<id>" (carryExclude must name this entry's band phrases verbatim, so a band phrase it names cannot be removed)` |
| E | `p/carryExclude/<k>` | listed twice (second and later) | `"<x>" is listed twice` |
| W | `p/<key>` | a key that is not a lexicon scale field | `"<key>" is not a lexicon scale field and is ignored (a misspelt heard, carry, yieldTo, anchor or carryExclude?)` |
| E | `/lexicon/carryRefuse` | not a non-empty array | `carryRefuse must be a non-empty phrase list` |
| W | `/lexicon/carryRefuse` | no scale entry has `heard: true` or `carry` | `carryRefuse has no effect: no scale entry has heard: true or carry` |
| E | `/lexicon/normalize` | not an object | `normalize` must be an object |
| E | `/lexicon/normalize/<key>` | a key other than `apostrophes` or `numbers` | the key is not a normalisation option |
| E | `/lexicon/normalize/apostrophes` | not `true` or `false` | `apostrophes` must be true or false |
| E | `/lexicon/normalize/numbers` | not the string `"en"` | `numbers` must be `"en"` |
| E | `/lexicon/normalize/numbers` | `lexicon.lang` does not start with `en` | number spelling is English, so it needs an English `lang` |

The `normalize` rows give the meaning of each rule; the
exact message text is in `engine/validate.js`. Mutation fixtures for the `heard`, `carry`,
`yieldTo`, `anchor`, `carryExclude` and `carryRefuse` rules are in
`app/tests/fixtures/mutations/safety.js`.

**V28 rules for the release 0.4.7 lexicon fields** (`clauses`, `clarify`). They reuse V28 (and V29
for the phrases), so no new code was added. `C` is `/lexicon/clauses`, `Q` is `/lexicon/clarify/<i>`.

| Sev | Path | Rule | Message |
|---|---|---|---|
| E | `C` | not an object | `clauses must be an object of chart-reading lists and switches` |
| E | `C/<key>` | a key outside `LEXICON_CLAUSES_KEYS` | `"<key>" is not a clauses field (…)` |
| E | `C/wordStart`, `C/redFlagNegation` | not a boolean | `<key> must be true or false` |
| E | `C/<list>` | not a non-empty list | `<list> must be a non-empty list of {ph, source}` |
| E | `C/<list>/<k>` | not `{ph, source}` with a string `ph`, or an extra key | `an entry is {ph, source}: the phrase and where it comes from` / `"<key>" is not a field of a {ph, source} entry` |
| E | `C/<list>/<k>/source` | not `lead`, `module`, `draft` or `lead-approved` | `source must be one of "lead", "module", "draft", "lead-approved"` |
| E | `C/<list>/<k>/ph` | listed twice in its list | `"<ph>" is listed twice` |
| E | `C/sections/<kind>` | a kind other than `exam`, `family`, `skip`, `read` | `"<kind>" is not a section kind (exam, family, skip, read)` |
| E | `C/sections/<kind>/<k>/ph` | a header word already in another kind | `"<w>" is already a <kind> section word; a header word names one kind` |
| E | `C/examItems` | not a list (an empty list is allowed since review round 2: nothing captures in an exam section) | `examItems must be a list of item ids (empty: nothing is captured inside an exam section)` |
| E | `C/examItems/<k>` | not an item, or listed twice | `"<id>" is not an item` / `"<id>" is listed twice` |
| E | `C/redFlags` | not an object (review round 2) | `redFlags must be an object of chart-register phrase lists by red-flag id` |
| E | `C/redFlags/<flag>` | not a red flag of the module; not a non-empty `{ph, source}` list (the row messages above apply to its rows) | `"<flag>" is not a red flag of the module` / `redFlags.<flag> must be a non-empty list of {ph, source}` |
| W | `C/examItems` | without `sections.exam` | `examItems has no effect without sections.exam (no text is ever read as an exam)` |
| E | `C/chartIgnoreThirdParty/<k>/ph` | not a cue of `lexicon.thirdParty.cues` | `"<ph>" is not a cue of lexicon.thirdParty.cues; chartIgnoreThirdParty names the lexicon's attribution cues that do not gate in chart text` |
| E | `C/strictConflict` | not a non-empty list | `strictConflict must be a non-empty list of item ids` |
| E | `C/strictConflict/<k>` | not an item; listed twice; a scale item; not in a negative domain | `"<id>" is not an item` / `"<id>" is listed twice` / `"<id>" is a scale item; strictConflict lists yes/no items` / `"<id>" is not an item of a negative (rule-out) domain; …` |
| W | `C/strictConflict/<k>` | no `lexicon.bool` entry for the item | `"<id>" has no yes/no entry in lexicon.bool, so strictConflict has no effect for it` |
| E | `C/placeholderAsk` | not `{text, source}` (non-empty text; source `lead`, `draft` or `lead-approved`) | `placeholderAsk must be {text, source}` and its field messages |
| W | `C/placeholderAsk`, `C/placeholder` | one without the other | `placeholderAsk has no effect without placeholder …` / `placeholder without placeholderAsk: a placeholder clause records nothing, but no card can ask about it` |
| E | `/lexicon/clarify` | not a non-empty list | `clarify must be a non-empty list of clarification entries` |
| E | `Q/<key>` | a key outside `LEXICON_CLARIFY_KEYS` | `"<key>" is not a clarify field (…)` |
| E | `Q/id` | not matching `^[a-z][a-z0-9_]*$`, or a duplicate | `id must match /^[a-z][a-z0-9_]*$/` / `duplicate clarify id "<id>"` |
| E | `Q/ph`, `Q/unless` | `ph` not a non-empty list; `unless` present and not a non-empty list | `ph must be a non-empty list of trigger phrases` / `unless must be a non-empty list of qualifier phrases when present` |
| E | `Q` | both or neither of `probe` and `item` | `a clarification entry names exactly one of probe or item` |
| E | `Q/item` | not an item | `"<id>" is not an item` |
| E | `Q/probe` | not a probe of the module's logic (checked on the bound module) | `"<id>" is not a probe of this module's logic` |
| E | `Q/ask` | not `{text, source}` (non-empty text; source `lead`, `draft` or `lead-approved`) | `ask must be {text, source}` and its field messages |
| E | `Q/source` | not `lead`, `module`, `draft` or `lead-approved` | `source must be one of "lead", "module", "draft", "lead-approved"` |

Mutation fixtures for every rule, and a valid chart-reading block that raises no V28 or V29 finding,
are in `app/tests/fixtures/mutations/safety.js` (`withChartReading`). V29's warning for a phrase under
three characters does not apply to a cue of a whole-word `clauses` list or to a section word (release
0.4.7 review round 1: the `scopeEnd` cue "so" never matches inside a word); it still applies to a
`mask` word, matched inside words, and to `chartIgnoreThirdParty`.

**V29 and `normalize.numbers` (release 0.4.1 round 2).** Numbers are spelled out only for band
matching, so only a band phrase holding a standalone 0-20 or round ten (for example "2 minutes")
is warned: it can never match, so spell the number out. A cue, yes/no, context, multi-item or
red-flag phrase with digits is not warned. It matches typed digits as digits, as in 0.3.1.

---

## 8. Checking a module

- **In screenAIr:** Upload → Validate shows the full report; ⓘ (next to the module menu) shows
  the axes, hashes, provenance, availability, change log and warnings of the active module.
- **On the test page** (`http://127.0.0.1:8901/app/tests/`, local only): the `validate` suite
  runs the validator over MASQUE, the shape fixture and the mutation corpus; `shape` drives a
  data-only module through every engine function and all five tabs; `upload` and `roundtrip`
  cover the upload paths and the download → re-upload trip.
- **Dev pages** (`app/tests/dev/{screener,scribe,patient,research,editor}.html`) mount one app with
  the built-in module and no shell.

## 9. Adding a built-in module

A built-in is listed in `app/modules/registry.json`:

```json
{ "rubric": "./modules/<id>/<id>.rubric.json", "logic": "./modules/<id>/<id>.logic.js",
  "docs": ["./modules/<id>/SOURCES.md"], "default": false }
```

Paths are relative to `app/` (they resolve against the page's `appBase`, never the page URL).
`docs` lists the module's other files, which Download all copies byte-for-byte; a listed file that
cannot be fetched fails the export rather than being left out. A built-in id, its `<id>-` prefix,
its logic id and its label become reserved for every other module. No engine, UI, app or shell
file may name a module, its ids or its brand (the `static` suite's t-ids rule): everything
module-specific lives in the module's two files.

A built-in may also name a **patient introduction video** (release 0.4.8):
`"patientVideo": "./modules/<id>/media/<name>.html"`, an `.html` frame page under `./modules/`
(`registry.patientVideoPath` keeps nothing else). The Patient Companion shows it above its
instructions on the first step, in a panel the patient can hide, as a script-free iframe
(`sandbox="allow-same-origin"`, no scripts); the page should hold one `<video controls
preload="none" playsinline>` (no autoplay), carry `noindex, nofollow` and the prototype marker
tagged `lang="en"` (the `static` suite's page rules apply to it). Only the built-in's registry entry
carries it: an uploaded or derived module never shows a video, and the video is not module data (no
hash covers it, Download all does not copy it). The built-in MASQUE's is
`modules/masque/media/patient-companion-intro.html`.
