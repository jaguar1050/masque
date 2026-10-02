# 04 — Writing a screenAIr module

How to write, check, upload, edit and download a screenAIr module. The binding definitions are
`app/src/engine/contract.js` (constants and JSDoc typedefs), `app/src/engine/validate.js` (the
checks) and `docs/refactor/03-design.md` §3-§5 (the design). This file explains them; where it and
the code disagree, the code and the design win, and this file is the one to fix.

Dated 2 October 2026, for release 0.4.0 and contract version 1.

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
  source line.
- **Licensed instruments are not embedded** (VM-PATHI, SNOT-22, DHI, HIT-6, MIDAS, ID Migraine,
  THI/TFI, SFN-SIQ, COMPASS-31 and the like). Name them as the confirmatory step; do not paste
  their items. screenAIr cannot detect a pasted licensed item (open question Q25).
- **Caveats are not module data.** "Prototype · not for clinical use", the unreviewed-translation
  banner and the illustrative-calibration label live in `engine/policy.js CAVEATS` and are drawn
  by the shell on every surface. Putting one in a module is error V38.
- **The Patient Companion shows no score, band, probability or research capture.** Patient
  wording may not contain "score", "likelihood", "probability", "puntuación"/"puntaje" or a
  "number / number" pattern (V60, `OMISSION_PATTERNS`), and may not repeat a red flag's clinician
  `points` or `action` (V24).
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
| `provenance` | O | Written only by screenAIr when it derives a module; verified on every load, never trusted (§5.3). |
| `changelog` | R | A list, may be empty: `{date, kind: "reconciliation"\|"extraction"\|"derived"\|"note", note, author?, paths?, axes?, acknowledged?}`. |

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
| `item.ask` | O | Physician phrasing for Scribe suggestions (default: `text`). |
| `item.tag` | O | Full tag string shown on Scribe suggestions. |
| `item.ref` | O | Criterion code, emitted to `fhir.criteriaSystem`. |
| `item.patientClin` | O | The clinical line in the patient summary's "For my clinician" block (default: `text`). |

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
Scribe's suggestion pool; `referral = {byPhenotype: {value: {specialty, reason}}, default}` feeds the
bundle's referral; `cdsTerm = {byPhenotype, default}` feeds the CDS index card (V27). Without
`referral` there is no referral ServiceRequest; without `cdsTerm` there is no CDS index card.

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
| `scale` | R | `[{id, cue, bands: [{ph, v}], fallback}]`: a cue opens a scale item and a band phrase picks option `v`; `fallback` (or `null`) applies when the cue has no band. |
| `multi` | R | `[{ids: [{id, value, kind: "item"|"ctx"}], ph}]`: one phrase that sets several answers. |
| `redFlags` | R | flag id → phrases. Keys equal the flag ids both ways, and every list is non-empty (V28). |
| `goldSet` | R for built-ins | `{version, lexiconVersion, file?}` of the benchmark the lexicon was measured on, or `null`. |

Every phrase and cue is lowercase and non-empty (V29). Without a lexicon the Scribe hides its
transport (Listen, Play, Step, typed input) and says why; nothing is captured from speech that
could have no structured use.

### 2.9 Patient wording (`locales`)

`locales.<loc> = {reviewed, editedLocally?, stale?, items, redFlags, contextItems?, steps?, ui?}`.

- `items`: item id → `{q, opts?, ask?, help?}`; every item covered and `opts.length ===
  scale.length` when `en.items` exists (V32). `redFlags`: flag id → `{q, say}` (V23).
- `contextItems`: id → `{q, opts: [[value, label]]}` in the *patient's* own vocabulary.
- `steps`: patient step key → `{title?, heading?, lede?, intro?}`; `ui`: `{sub?, forYouIf?,
  clinicianLede?}`.
- `reviewed` is `true` only for wording a qualified reviewer has checked. A non-English string that
  falls back to English is a warning, and an error when the locale claims `reviewed: true` (V33).
  An unreviewed locale shows the unreviewed-translation banner on screen, in print and in exports.
- No locale entry has a `points`, `action` or `differential` key (V34).

Without `locales.en.items` the Patient Companion is disabled for the module, and says so.

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
| `locales` / `locales.en.items` | The Patient Companion is unavailable for the module, with a notice. |
| `research` | Research shows the population state and "This module declares no research configuration". |
| `research.population` | "No population estimates for this module." |
| `fhir` / `cds` | `DEFAULT_FHIR`; no CDS settled example. |
| `copy.*` | `ENGINE_COPY_DEFAULTS` (lead question Q10). |

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
| `probes` | `{version, list: [{id, kind, when(answers, redFlags), target?, rescues?, say, why, opts: [{l, rf?, a?, note?}]}]}`; `version` is the **probe set** axis (V45). |

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
| Release | `engine/policy.js APP_VERSION` (0.4.0) | Any app-level change ships. |
| Instrument | `rubric.instrumentVersion` | Anything in the instrument hash changes (§5.2). |
| Lexicon | `rubric.lexicon.version` | A phrase, cue or window changes. |
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
| `lexiconHash` | the lexicon without `version`, `lang`, `goldSet` | The lexicon axis |
| `contentHash` | the whole rubric without `provenance` | Detects a derived rubric edited after it was created |
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
| V27 | E | Phenotype values, default, always-active, tag-boost, referral or CDS-term keys inconsistent. |
| V28 | E | Lexicon references a missing item, option or flag, or a flag has no cue phrase. |
| V29 | E/W | A phrase is empty or not lowercase (E); shorter than 3 characters (W). |
| V30 | E | Negation/third-party/historical window or cues invalid, gold-set fields missing, bad `lang`. |
| V31 | E | Unsupported locale key, non-boolean `reviewed`, or `defaultLocale` not `"en"`. |
| V32 | E | English patient wording misses an item, or `opts` do not match the scale. |
| V33 | W/E | A non-English string falls back to English (W); E when that locale claims `reviewed: true`. |
| V34 | E | A locale entry has a `points`, `action` or `differential` key. |
| V35 | E | FHIR systems not absolute URLs, templates do not render, or Questionnaire strings empty. |
| V36 | E | CDS examples name a missing flag, or the settled example's score and band disagree. |
| V37 | E | Research configuration invalid, or `population` on a module that may not carry it. |
| V38 | E | Module data contains a caveat string. |
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
| V60 | E | A patient-facing module string (or a summary sentence produced during the smoke run) matches an omission pattern. |

The built-in MASQUE module validates with zero errors and the expected warnings (V12 for
`n_allo`, which has no short label; V33 for the Spanish strings that fall back to English).

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
