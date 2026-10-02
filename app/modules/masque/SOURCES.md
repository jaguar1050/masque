# MASQUE rubric — source map

`masque.rubric.json` is generated, not written. `app/tests/tools/extract-rubric.html` (with
`extract-rubric.js`) imports the frozen baseline `app/tests/baseline/src/` through the parity
harness's oracles, so `MANIFEST.sha256` is verified first. It builds the rubric from the live
constants, the outputs of the baseline builders and JSX/template text cut from the SHA-pinned
source at the lines below. JSX cuts are compiled with Babel, so whitespace and entities come out
as React renders them. The tool writes `JSON.stringify(rubric, null, 2) + "\n"`: UTF-8 without
BOM, LF, no `\u` escapes. Opening the page shows whether a regeneration is byte-identical to the
committed file, and it runs 120 cross-checks, every one of which must pass.

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
| `lexicon.goldSet.lexiconVersion`, `lexicon.goldSet.file` | `0.3.1`, `masque_extraction_goldset.json` | The lexicon the gold set was benchmarked against, and the gold-set file name. `goldSet.version` is read from that file's `_meta.version` in `reference/MASQUE_v0.3.1/`, after its SHA-256 is checked against that folder's `MANIFEST.sha256`. |
| `changelog[].note`, `date` | 2026-10-02 | The reconciliation, extraction and open-question entries (§3.8). |

`format` and `contractVersion` come from `engine/contract.js` (`FORMAT.rubric`,
`CONTRACT_VERSION`). `lexicon.lang` and the `research.population` paths, which §9.2 allows to be
typed, are read from the baseline instead (Voice L47, Pop L31-33). `defaultLocale` is left out, so
it takes its default, `"en"`. The registry `docs` list is in `modules/registry.json`, not in the
rubric.

## Field map

| Field | Baseline source | Notes and reconciliation choice |
|---|---|---|
| `instrumentVersion` | Scr L45 `INSTRUMENT_VERSION` | Checked equal to Scb L153 and Pat L54. |
| `domains[]` `key`, `label`, `max`, `negative`, `items[]` `id`, `w`, `text`, `scale`, `ref` | Scr L172-255 `ITEMS`, L257 `DOMAIN_ORDER` | Copied in the Screener's key order. **Canonical: the Screener** (Inv §2). It is checked deep-equal to the Scribe's `ITEMS` (Scb L51-134). The Simulator's item copy (Sim L31-74, with no `f` factors and linear scoring) is dropped (changelog). |
| `domains[].items[].short` | Scb L1309-1322 `shortLabel` | `shortLabel({id})` for every item. It has 29 entries; `n_allo` returns its own id, so it gets no `short` and the id is shown, as today (Q24, V12 warning). |
| `domains[].items[].ask` | Scb L242-273 `ASK` | Covers all 30 items. |
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
| `phenotypes.referral` | Scr L1455-1456, L1577; Scb L1401, L1453 | Taken from the baseline `buildBundle` referral text (`Referral: {specialty} — evaluate for {reason}`) for each phenotype value. Screener and Scribe are checked to give identical text; only `otologic` differs from the default. |
| `phenotypes.cdsTerm` | Scr L1344 | The `complaint === "otologic" ? "otologic" : "sinonasal"` ternary. |
| `infoPrompts` | `prompts`: Scb L282-285 `VMPATHI_INFO`; `gateDomain`: L862; `maxScored`: L871; `maxTotal`: L876; `tagPrefix`: L1344 | |
| `sampleCases[0..3]` | Scr L261-312 `SAMPLE_CASES`; `buttonLabel` and `icon` from Scr L994-997 | The object key becomes `id`. `group` defaults to "sample" and `safetyReviewed` to true (Scr L855), so neither is written. |
| `sampleCases[4..8]` | Sim L314-330 `SCENARIOS`, L308-312 `FULL_HIGH` | `sim-<id>`, `group: "scenario"`, icon by name, `why` kept, `answers` from `apply()` (FULL_HIGH inlined), `rf` only when not empty, `complaint: ""`, `step` dropped. `buttonLabel` = `label`, which is what Sim L652 renders (Q3, changelog). |
| `demo.patient` | Scr L314-317 `DEMO_PATIENT` | Checked deep-equal to Scb L587 `PATIENT`. It has no DOB (V50). |
| `demo.transcript` | Scb L569-584 `SCRIPT` | The Simulator's 7-turn transcript is not carried. |
| `lexicon` | Ext L24 `LEXICON_VERSION`; L38-48 `NEGATION`; L57-62 `THIRD_PARTY`; L69-73 `HISTORICAL`; L79-106 `BOOL_EX`; L108-110 `CTX_EX`; L112-134 `SCALE_EX`; L136-141 `MULTI_EX`; L153-166 `RF_PHRASES` | Keys are renamed only (`negation`, `thirdParty`, `historical`, `bool`, `ctx`, `scale`, `multi`, `redFlags`). `lang` comes from Voice L47 `VOICE_LANG`. `goldSet` is described under the hand-written values. The Simulator's cue lists (Sim L1028-1041) are not carried. |
| `locales.en.items` / `locales.es.items` | Pat L137-188 `P` / L297-348 `ES_P` | Copied verbatim; P key order = item order (checked). |
| `locales.en.redFlags` / `locales.es.redFlags` | Pat L225-262 `RED_FLAGS` `{q, say}` / L350-375 `ES_RF` | The Patient's `now`/`soon` tiers are checked to be emergent→now and urgent→soon; the rubric keeps the clinician tier, and `TIER_DISPLAY` maps it. |
| `locales.en.contextItems` | Pat L522-529 `CONTEXT_Q` | The Patient's own values and labels, **not realigned** (D19, Q8). es falls back to en, as today (V33 warning). |
| `locales.*.steps.*.title` | Pat L383, L405 `UI[loc].sections[2..7]` | Indexed through `SECTIONS`. |
| `locales.*.steps.<domain>.lede` | Pat L768-774 `BLURB`, L761-767 `BLURB_ES` | |
| `locales.en.steps.story` `heading`, `lede`, `intro` | Pat L705, L706-707, L720-721 | English only; es falls back (Q9). |
| `locales.*.ui.sub` | Pat L381, L403 `UI[loc].sub` | |
| `locales.en.ui.forYouIf` | Pat L787-789 | |
| `locales.en.ui.clinicianLede` | Pat L1066-1070 | `{INSTRUMENT_VERSION}` → `{instrument}`, `<b>−</b>` → `**−**`. |
| `locales.*.reviewed` | Pat L294 `REVIEWED` | en `true`, es `false`. |
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
(Q1 label, Q7 note footer).

## Regenerating

Serve the project root, open `http://127.0.0.1:8901/app/tests/tools/extract-rubric.html` and wait
for the result card. "Identical to the committed modules/masque/masque.rubric.json" means nothing
has drifted. Otherwise use **Download masque.rubric.json** to replace the file, and review the
diff.
