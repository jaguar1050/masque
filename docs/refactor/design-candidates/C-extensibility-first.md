# Design candidate C — Extensibility & shell first

Module system for Project MASQUE 0.4.0. Written against `docs/refactor/01-inventory.md` (line references below are to `reference/fixed-src/` exactly as the inventory cites them) and the lead decisions D1–D12. Lens: what a second module's author must write, and what the general application's shell must own so that no module can weaken a gate, drop a caveat or collide in CSS.

Design stance in one paragraph: a **module is a plain-JS data object** (with closures only where D3 allows: `when(state)` predicates and string templates), validated by `validateModule` before it is ever rendered; the **engine** is a set of side-effect-free ES modules parameterised by that object and containing no branch on any domain key, item id, flag id, complaint value or brand string; the **shell** owns tokens, gates, caveats, versions, locale plumbing and reset semantics; the **four generic apps** (Screener, Scribe, PatientCompanion, ResearchReadinessPanel) receive `module` as a prop and never import module content. A module with three domains, no negative domain, no phenotype picker and English only must run with zero engine edits — those four degrees of freedom are tested by the template module in `app/tests/`.

Runtime constraints obeyed throughout: no build step; import map + Babel standalone + blob-URL loader; explicit `.js`/`.jsx` extensions on relative imports; only `react`, `react-dom`, `lucide-react` bare specifiers; every `.jsx` imports React; plain JS; `const` before first use; UTF-8/LF; no import-time side effects other than exports (all load-time assertions become `validateModule`, run by the shell on selection and by the test page).

Contents

0. Terminology and fixed vocabularies
1. File layout under `app/src/`
2. The module contract (JSDoc typedefs, every field, consumer, MASQUE source lines)
3. Engine API
4. Component contracts, state ownership, reset semantics
5. Appendix §5 rows → new mechanism (all files)
6. Parity harness (D10)
7. CSS scoping and shell chrome
8. Migration order and work packages for parallel implementers
9. Open questions for the clinical lead; self-assessed risks

---

## 0. Terminology and fixed vocabularies (D2)

Owned by `engine/vocab.js`, never by a module. A module that tries to define its own band/tier/answer/probe-kind vocabulary fails `validateModule`.

| Vocabulary | Values | Notes |
|---|---|---|
| `BANDS` | `['low','moderate','high']` ordered low→high, plus `'indeterminate'` | Cut-points are module data (`module.bands.cuts`); names, order, "lowest band" and "highest band" are engine. `BAND_INTERP = {low:'L', moderate:'N', high:'H'}` (FHIR v3) is engine. |
| `TIERS` | `['emergent','urgent']` ordered by urgency | Patient-facing display mapping `TIER_DISPLAY = {emergent:'now', urgent:'soon'}` is a shell/locale concern; module flags carry `tier` only. |
| Answers | `'yes' \| 'no' \| number (scale index) \| undefined` | `undefined` = unanswered, never imputed. Patient `'unsure'` is stored by the Patient app and treated as `undefined` by every engine function (`normalizeAnswer`). |
| Red-flag state | Screener `{[id]: true}`; Scribe `{[id]: 'nlp'\|'md'\|'probe'}` | Engine treats any truthy value as "open". |
| `CAPTURE_KIND` | `'item' \| 'ctx' \| 'redflag'` | Replaces every `startsWith('rf_')` / `startsWith('c_')` test. |
| `PROBE_KIND` | `safety(0) rescue(1) criteria(2) ruleout(3) phenotype(4) exam(5)` + `caption`, `truncate`, `mayWrite` | `PROBE_KIND_ORDER` exported; `truncate:false` for safety/rescue; `mayWrite:false` for phenotype. |
| `STEP_KIND` | `'safety' \| 'domain' \| 'story' \| 'result'` (+ Patient-only `'intro'`, `'summary'` are shell steps, not module steps) | Safety is always first and always mandatory; the engine prepends it if the module omits it. |
| `PHENOTYPE_NONE` | `''` | A module without `phenotypes` runs with complaint `''`; predicates that read `state.complaint` simply never match. |

---

## 1. File layout under `app/src/`

One line per file: purpose → exports. Everything is plain JS / classic-runtime JSX. `.jsx` only where JSX is present.

### `app/src/engine/` — generic, module-parameterised, side-effect free

| File | Purpose | Exports |
|---|---|---|
| `engine/vocab.js` | Fixed vocabularies (§0), band/tier/probe-kind tables, capture kinds, lowest/highest band helpers | `BANDS, BAND_ORDER, lowestBand, highestBand, BAND_INTERP, TIERS, TIER_DISPLAY, ANSWER, normalizeAnswer, isAnswered, CAPTURE_KIND, PROBE_KIND, PROBE_KIND_ORDER, STEP_KIND, PHENOTYPE_NONE` |
| `engine/policy.js` | Shell/site policy constants that no module may override (D8) | `APP_VERSION = "0.4.0", REQUIRE_SAFETY_REVIEW_TO_SIGN = true, ABSTAIN_FLOOR = 0.55, SITE_SALT, SALT_IS_DEFAULT, CAVEATS = {prototype, unreviewedTranslation, illustrative}` (English + es for the two the Patient app renders) |
| `engine/scoring.js` | Screener L321-408 verbatim minus React: score arithmetic, two-sided bounds, coverage gate, band derivation, everything derived from cuts | `scoreItem, itemBounds, bandFor(cuts), computeScore(module, answers), scaleMax(module), negativeMin(module), bandRanges(module), bandRangeText(module), meterZones(module), meterTicks(module), allItems(module), itemById(module), openItems(module, answers)` |
| `engine/rules.js` | Ordered-rule evaluator and the state builders for each rule family (D3) | `evaluateRules(rules, state, opts), buildRoutingState, routingRecs, buildPhenotypeState, derivePhenotype, activeDomains, gapSignals, referralFor, cdsIndexCard, renderTemplate` |
| `engine/patientSummary.js` | Generic Patient summary core (Patient L902-994 with the tree replaced by rule evaluation) | `buildPatientSummary(module, locale, input), askForm(module, locale, id), joinList(localeDef, xs), summaryText(module, locale, summary, meta)` |
| `engine/fhir.js` | Questionnaire / CDS discovery+examples / data dictionary / transaction bundle, all from the module; standard HL7/UCUM systems as engine constants | `buildQuestionnaire(module, opts), buildCdsHooks(module), buildDataDictionary(module, opts), buildBundle(module, screen), FHIR_SYSTEMS, WEIGHT_EXT` |
| `engine/cohort.js` | Canonical row schema, capture, CSV, pseudonym, deterministic synthetic cohorts (Simulator makeCohort salvaged, D1) | `CANONICAL_COHORT_FIELDS, screenToCohortRow(module, screen, opts), rowsToCsv, subjectPseudonym(salt, mrn), makeCohort(spec, opts), cohortTemplateCsv(module)` |
| `engine/extraction.js` | Extraction L25 + L172-300 with the eight lexicon globals injected | `EXTRACTOR_KIND, createExtractor(lexicon), extract(lexicon, text, opts), firstHit, allHits, cueBefore, faersToUtterances` |
| `engine/probes.js` | Probes L47-54 (kind table now in vocab), L301-345 with the probe list injected; adds the rescue/target rules | `liveProbes(probes, answers, redFlags, answered), validateProbes(probes, itemIds, redFlagIds), truncateProbes(probes, cap)` |
| `engine/scribe.js` | Scribe ingestion and suggestion ranking with no ids: first-write-wins, ctx overwrite, raise-only flags, active-domain pool, tag boost, info prompts, capture labels, note skeleton | `ingestCaptures(module, state, captures), rankSuggestions(module, state), captureLabel(module, capture), buildNote(module, input)` |
| `engine/locale.js` | Locale resolution and merge (pFor/rfFor generalised), reviewed flags, names | `LOCALE_NAMES, resolveLocale(module, code), itemCopy(module, code, id), flagCopy(module, code, id), ui(module, code), localesOf(module)` |
| `engine/validateModule.js` | Complete authoring/loading validator (§3.9) | `validateModule(module, opts) → {ok, errors[], warnings[]}, formatReport` |
| `engine/gates.js` | The gate predicates every app must call (D8); no module switch | `safetyGate({safetyReviewed, activeFlags})`, `routingGate({override, safetyReviewed})`, `signGate({safetyReviewed})`, `coverageGate(score)`, `referralGate({cleared, score})`, `abstainGate(p)` |
| `engine/css.js` | Selector scoping for app stylesheets (§7) | `scopeCss(css, rootSelector), SHELL_TOKENS` |
| `engine/icons.js` | Icon lookup by name for module data (D1 icons by name) | `iconByName(name, fallback)` |
| `engine/download.js` | Screener L618-625, L813-820 | `downloadText, downloadJsonFile, fhirHtml` |
| `engine/prng.js` | mulberry32 seeded PRNG (used by makeCohort and the sweep) | `mulberry32(seed), pick(rng, xs)` |
| `engine/contract.js` | The typedefs of §2 as JSDoc plus the `MODULE_CONTRACT_VERSION` constant and key lists used by validateModule | `MODULE_CONTRACT_VERSION = 1, REQUIRED_TOP_KEYS, OPTIONAL_TOP_KEYS, LOCALE_UI_KEYS, SUM_TEMPLATE_KEYS` |

### `app/src/modules/` — content

| File | Purpose | Exports |
|---|---|---|
| `modules/registry.js` | The dropdown source (D9) and the panel's legacy project table | `SCREENING_MODULES` (array, exactly `[masque]`), `DEFAULT_MODULE_ID`, `getModule(id)`, `PANEL_PROJECTS` (`{MASQUE: masque.research, BREATHE, VOICED}`), `panelProject(key)` |
| `modules/legacy-panel-projects.js` | RRP L57-106 BREATHE/VOICED descriptors moved verbatim; panel-only, never in the dropdown | `BREATHE, VOICED` |
| `modules/masque/index.js` | Assembles the MASQUE module from the part files, freezes it | `default` (the module object), `MODULE_ID = 'masque'` |
| `modules/masque/instrument.js` | Screener L172-258 items/domains (+ `short` from Scribe L1168-1178, `ask` from Scribe L239-270, `tag` from Scribe L272-277), L334 cuts, L1190-1194 context items, L110-147 red flags merged with Scribe `ask`, Patient q/say | `domains, items (by domain), bands, contextItems, redFlags` |
| `modules/masque/steps.js` | Screener L82-92 + L1021-1117 copy, Patient L531-541 sections, as explicit steps | `screenerSteps, patientSteps` |
| `modules/masque/phenotypes.js` | Screener L1072-1076 vocab/picker copy; Scribe L770-783 derivation + activation; L1456/L1577 referral; L1344 CDS card summary | `phenotypes` |
| `modules/masque/rules.routing.js` | Screener L914-950 / Scribe L1184-1192 as one ordered array with per-surface copy | `routing` |
| `modules/masque/rules.patient.js` | Patient L910-953 as derived predicates + ordered `said`/`ask` rules; L955-957 gap | `patientSummary` |
| `modules/masque/infoPrompts.js` | Scribe L279-282 VM-PATHI info prompts + gate domain | `infoPrompts` |
| `modules/masque/lexicon.js` | Extraction L24, L38-166 verbatim + gold-set reference | `lexicon` |
| `modules/masque/probes.js` | Probes L56-289 verbatim + L290 version | `probes` |
| `modules/masque/samples.js` | Screener L261-317 sample cases + Simulator L314-330 scenarios merged; Scribe L566-584 demo; Simulator L677-681 cohort kinds | `sampleCases, demo, demoCohorts` |
| `modules/masque/research.js` | RRP L25-56 + aliases/artifact key/ETL/axes | `research` |
| `modules/masque/fhir.js` | Screener L80, L421-422, L429-438, L447/467, L476-517 identifiers (byte-identical, D4) | `fhir, cds` |
| `modules/masque/copy.en.js` | English: Patient P (L137-188), RF q/say (L225-262), UI module keys (L379-401 module part), SUM templates (L428-464), blurbs (L761-774), intro bullets, titles/subtitles, note headings, walkthrough cards (Simulator L992-1013, L1511-1547) | `en` |
| `modules/masque/copy.es.js` | Spanish: ES_P, ES_RF, UI.es, SUM.es, BLURB_ES with `reviewed:false` | `es` |
| `modules/masque/CHANGELOG.md` | Every reconciled divergence (D6) and the D7 fixes as they affect module data | — |
| `modules/masque/README.md` | Header comments of the seven files (clinical rationale, instrument names) | — |
| `modules/_template/module.js` | A complete, validating, minimal module ("Template", 2 domains, no negative domain, no phenotypes, en only, 2 flags, 3 probes, tiny lexicon) — the second-module authoring starting point; also the fixture for the "different shape" tests | `default` |
| `modules/_template/README.md` | Authoring guide: field-by-field, what validateModule will say, the mandatory things you cannot change (gates, caveats, vocabularies), how to add a locale, how to register | — |

### `app/src/apps/` — generic apps

| File | Purpose | Exports |
|---|---|---|
| `apps/Screener.jsx` | Clinician Screener on `module` | `default Screener` |
| `apps/Scribe.jsx` | Ambient Scribe on `module` | `default Scribe` |
| `apps/PatientCompanion.jsx` | Patient Companion on `module` + `locale` | `default PatientCompanion` |
| `apps/ResearchReadinessPanel.jsx` | RRP moved; PROJECTS externalised; `research` prop added; `project` prop kept | `default ResearchReadinessPanel, FAIRNESS_POLICY, TOLERANCE_ATTRIBUTED` |
| `apps/parts/SampleRail.jsx` | Generic sample-case rail (D1 #1): buttons from `module.sampleCases`, icon by name, "Clear" | `default SampleRail` |
| `apps/parts/StepCard.jsx`, `QGroup.jsx`, `ContextQ.jsx`, `ResultView.jsx`, `RedFlagList.jsx`, `Meter.jsx`, `DomainBars.jsx`, `RecList.jsx`, `CdsPreview.jsx`, `PilotCapture.jsx` | Screener parts, module-driven | one default each |
| `apps/parts/scribe/*.jsx` | Transcript, Readout, ProbeRail, PromptList, NoteView, FhirView | one default each |
| `apps/parts/patient/*.jsx` | Intro, Safety, QBlock, Story, Summary | one default each |
| `apps/styles/screener.css.js`, `scribe.css.js`, `patient.css.js`, `panel.css.js` | The four CSS template strings, scoped per §7 | `CSS` |

### `app/src/shell/`

| File | Purpose | Exports |
|---|---|---|
| `shell/App.jsx` | The one page: module select, app tabs, locale toggle, walkthrough, footer, reset-by-key, validateModule on selection | `default App` |
| `shell/ModuleSelect.jsx` | `<select>` over `SCREENING_MODULES` (label = `module.label`) | `default` |
| `shell/AppTabs.jsx` | Clinician Screener / Ambient Scribe / Patient Companion; declares which tabs support locale | `default, APP_TABS` |
| `shell/LocaleToggle.jsx` | Buttons over `localesOf(module)`; hidden when one locale or tab unsupported; unreviewed glyph | `default` |
| `shell/Walkthrough.jsx` | Renders `module.copy.walkthrough[tab]` cards as a side rail when present (D1 #4) | `default` |
| `shell/Footer.jsx` | `Prototype · not for clinical use · release · module_id · instrument · lexicon · probe set · gold set` | `default, versionLine(module)` |
| `shell/Caveats.jsx` | Unconditional caveat banner + per-locale unreviewed banner | `default` |
| `shell/shell.css.js` | Tokens on `.mx-shell`, chrome styles, `*{box-sizing}` scoped | `SHELL_CSS` |
| `shell/InvalidModule.jsx` | What renders when validateModule fails (errors listed, apps not mounted) | `default` |

### `app/` pages and tests

| File | Purpose |
|---|---|
| `app/index.html` | The shell page (D11): import map, Babel, `boot({entry:'./src/shell/App.jsx'})`, noindex |
| `app/tests/index.html` | Self-check page (D10); `?ref=` overrides the reference base URL |
| `app/tests/harness.js` | Runner, reporter, deep-diff with normalisers, hash utilities |
| `app/tests/refImport.js` | Fetch → rewrite → append exports → Babel → blob import of the 0.3.1 files (§6.1) |
| `app/tests/t-validate.js` | validateModule over every registry module + the template + mutation cases |
| `app/tests/t-golden.js` | Golden parity of generated artifacts (§6.2) |
| `app/tests/t-scoring.js` | Seeded sweep new `computeScore` vs old `useScore` (§6.4) |
| `app/tests/t-rules.js` | Rule parity over sample cases + sweep (§6.5) |
| `app/tests/t-shape.js` | The template module through every engine function (different-shape guarantee) |
| `app/tests/t-css.js` | No unscoped selectors in any app stylesheet |
| `app/screener.html`, `scribe.html`, `patient.html`, `simulator.html`, `src/MASQUE_*.jsx` | **Deleted** from `app/` in 0.4.0 (the prototype lives on at `/masque/demo/`, D12). |

---

## 2. The module contract

Authoritative form lives in `engine/contract.js` as JSDoc. Conventions: **R** required, **O** optional (engine has a defined behaviour when absent, stated in the row). "Consumer" names the engine function or component that reads the field. "MASQUE source" gives where the value is lifted from (inventory line numbers). Closures are allowed only where the type says `function`; every closure receives one argument, an engine-built state object documented in §3.3; closures return data, never JSX.

### 2.1 Top level

```js
/**
 * @typedef {Object} ScreeningModule
 * @property {number}  contractVersion   R  must equal MODULE_CONTRACT_VERSION (1). validateModule.
 * @property {string}  id                R  slug, /^[a-z][a-z0-9-]*$/. Prefix of screen_id, filenames, modelVersion, console prefixes, module_id column. MASQUE: 'masque' (Screener L574 'masque-', L966, L1407-1413).
 * @property {string}  name              R  instrument/brand name used inside artifacts and clinician copy: 'MASQUE' (Screener L1005, Scribe L876, RRP L26 key).
 * @property {string}  label             R  dropdown label / page title only: 'Dizziness' (D4). Never used in any identifier or artifact.
 * @property {string}  icon              O  lucide icon name, default 'Stethoscope' (Screener L1003). engine/icons.
 * @property {Versions} versions         R  §2.2
 * @property {Domain[]} domains          R  §2.3 ordered (Screener L257 DOMAIN_ORDER; per-domain label/max/negative L172-255)
 * @property {Object<string, Item[]>} items R  keyed by domain key, in instrument order (Screener L172-255). §2.4
 * @property {Bands}   bands             R  §2.5 (Screener L334)
 * @property {ContextItem[]} contextItems O  default []. §2.6 (Screener L1190-1194; Patient L522-529 aligned per D6)
 * @property {GapRule} gapRule           O  default {threshold: 2}; only meaningful with contextItems that carry signal options. §2.6
 * @property {RedFlag[]} redFlags        R  ≥1 (Screener L110-147 + Scribe ask + Patient q/say). §2.7. Gate is engine (D8); a module with an empty array is rejected — see open question Q1.
 * @property {Steps}   steps             R  §2.8
 * @property {Phenotypes} phenotypes     O  absent ⇒ no picker, complaint '' everywhere, referral falls back to phenotypes.default-less branch (§2.9)
 * @property {Rules}   rules             R  §2.10 (routing may be [] — engine still emits override/incomplete/default)
 * @property {InfoPrompt[]} infoPrompts  O  default []. §2.11 (Scribe L272-282)
 * @property {SampleCase[]} sampleCases  O  default []. §2.12 (Screener L261-312 + Simulator L314-330)
 * @property {Demo}    demo              R  §2.12 (Screener L314-317, Scribe L566-584)
 * @property {Lexicon} lexicon           O  absent ⇒ Scribe hides transcript capture (typed input still drives probes/prompts). §2.13 (Extraction L24, L38-166)
 * @property {ProbeSet} probes           O  absent ⇒ Scribe probe rail hidden. §2.14 (Probes L56-290)
 * @property {Object<string, LocaleDef>} locales R  must contain module.defaultLocale. §2.15 (Patient L137-502, L761-774)
 * @property {string}  defaultLocale     R  'en'
 * @property {Research} research         R  §2.16 (RRP L25-56)
 * @property {Fhir}    fhir              R  §2.17 (Screener L80, L421-422, L429-438, L447, L467, L1537)
 * @property {Cds}     cds               R  §2.17 (Screener L476-517)
 * @property {Copy}    copy              R  §2.18 (module-specific, non-caveat copy only)
 * @property {string}  changelog         R  relative path of the module's CHANGELOG.md ('./CHANGELOG.md'); shell links it from the footer
 */
```

### 2.2 Versions (D5)

```js
/**
 * @typedef {Object} Versions
 * @property {string} instrument  R '0.2'  (Screener L45). Consumers: fhir (URL, Questionnaire.version, dictionary), cohort row, footers, panel instrumentVersion, patient clinNote.
 * NOTE lexicon/probe/gold-set versions live with their owners: lexicon.version '0.3.1', lexicon.goldSet.version '0.2.0', probes.version '1.0.0'.
 * APP_VERSION is NOT here — engine/policy.js APP_VERSION = '0.4.0'. versionLine(module) in shell/Footer.jsx assembles all five axes + module id.
 */
```

### 2.3 Domains

```js
/**
 * @typedef {Object} Domain
 * @property {string}  key          R  e.g. 'migraine'. Also the FHIR group linkId and the `domain-${key}` component code (byte-identical for MASQUE, D4).
 * @property {string}  label        R  clinician label (Screener L174 'Recalcitrance', L185 'Migrainous', L203 'Otologic / vestibular', L220 'Neuropathic', L232 'Impact', L242 'Discriminators (rule-out)'). Consumers: computeScore domains[k].label, Questionnaire group text, dictionary domainLabel, note, bars, Observation component display.
 * @property {number}  max          R  declared domain max; validateModule asserts Σw === max (15, 30, 25, 15, 15, −29).
 * @property {boolean} [negative]   O  default false (only 'discriminators' true, L244). Consumers: computeScore (negative flag), fhir dictionary discriminatorMin = Σ max over negative domains, routing state negativeDomains, Patient clin '-' marker, Cronbach exclusion.
 * @property {string}  [shortTag]   O  Scribe suggestion tag when the item has no tag; default label.toLowerCase(). MASQUE: vestibular → 'vestibular' (Scribe L796 special case).
 * @property {string}  [intro]      O  clinician StepCard intro (Screener L1086 recalcitrance intro, L1090-1094 per-card intros) — copied into steps instead when it belongs to a step; kept here for domain-level reuse (Simulator L546-547).
 */
```

Patient-facing domain labels and blurbs are locale data (`LocaleDef.domains[key] = {label, blurb}`), Patient L383/L405 sections 3-7 and L761-774.

### 2.4 Items

```js
/**
 * @typedef {Object} ScaleOption
 * @property {string} label  R  clinician option label (Screener L188-238)
 * @property {number} f      R  factor 0..1; validateModule asserts some option has f === 0 (m_dur "No attacks" rule, §4.5)
 *
 * @typedef {Object} Item
 * @property {string}  id     R  unique across the module; FHIR linkId, cohort column, lexicon/probe/locale key (Screener L177-252)
 * @property {number}  w      R  weight; sign gives direction (negative only inside negative domains — asserted)
 * @property {string}  text   R  clinician item text (Screener `text`, canonical per §2 (d))
 * @property {string}  short  R  short clinical label (Scribe shortLabel L1168-1178). Consumers: Scribe capture tags, note lines, probe "re-asking" (D7), routing chips for negative items.
 * @property {string}  [ask]  O  physician question (Scribe ASK L239-270). Consumer: Scribe suggestions; falls back to text.
 * @property {ScaleOption[]} [scale] O  present ⇒ choice item; absent ⇒ boolean 'yes'/'no'
 * @property {string}  [ref]  O  criterion citation emitted as FHIR criteria code (L193, L208, L210, L212)
 * @property {{group:string,label:string}} [tag] O  Scribe tag. MASQUE tag.group 'VM-PATHI', labels 'motion sensitivity' / 'disequilibrium' / 'headache equivalents' (Scribe L272-277; rendered as `${group} · ${label}`; the note strips the group — Scribe L1202 `.replace("VM-PATHI · ","")` becomes structural)
 * @property {string}  [symbol] O  reserved: symbolic names for scale indices used in rules (risk 3), e.g. m_dur: ['none','under4h','typical','over72h','varies']; validateModule asserts length === scale.length when present
 */
```

Patient wording per item (`q`, `opts`, `ask`, `help`) is locale data (`LocaleDef.items[id]`, Patient L137-188 / L297-348), never on the clinician item, so the patient build cannot reach clinician text (risk 8).

### 2.5 Bands

```js
/** @typedef {Object} Bands
 * @property {{moderate:number, high:number}} cuts R  {moderate:34, high:67} (Screener L334). Keys are exactly the non-lowest BANDS. Consumers: bandFor, bandRanges (dictionary text '< 34', '34–66', '≥ 67' generated), meterZones ([34,33,33] → zone widths derived, replaces L1216-1218), meterTicks ([0,34,67,100], L1264).
 */
```

### 2.6 Context items and gap rule

```js
/** @typedef {Object} ContextOption
 * @property {string}  value        R  stored ctx value ('0-1','2','3+'; '<3mo','3-12mo','>12mo'; 'no','yes') — Screener L1191-1193 canonical; Patient values aligned to these (D6; logged in CHANGELOG)
 * @property {string}  label        R  clinician label (Screener L1191-1193)
 * @property {boolean} [signal]     O  this option counts toward the gap rule (Screener L874-876: c_clin '3+', c_dur '>12mo', c_dismiss 'yes')
 *
 * @typedef {Object} ContextItem
 * @property {string} id            R  'c_clin' | 'c_dur' | 'c_dismiss' (Screener L1191-1193). Not scored, not in Questionnaire, not a cohort column (invariant kept).
 * @property {string} text          R  clinician question (Screener L1191-1193)
 * @property {ContextOption[]} options R
 * @property {string} signalLabel   O  Screener gap-alert bullet for the signal option (L874 'Seen by 3+ clinicians for this problem', L875, L876)
 * @property {string} noteLabel     O  Scribe note phrase (L1204-1206) and capture label (L1160 'prior dismissal' / 'duration >12 mo' / '3+ clinicians' — capLabel uses `shortLabel`, note uses `noteLabel`; both kept)
 * @property {string} shortLabel    O  Scribe capture tag (L1160)
 * Patient question and option labels are LocaleDef.contextItems[id] = {q, opts:[label per option]} (Patient L523-528; option VALUES come from here, labels from the locale)
 *
 * @typedef {Object} GapRule
 * @property {number} threshold     R  2 (Screener L878, Scribe L840, Patient L956)
 */
```

### 2.7 Red flags

```js
/** @typedef {Object} RedFlag
 * @property {string} id      R  'rf_thunderclap' … (Screener L110-147); FHIR linkId/code, Flag code, lexicon key, probe rf target
 * @property {'emergent'|'urgent'} tier R  engine vocab
 * @property {string} group   R  Screener group ('Neurologic', …) — Questionnaire/dictionary/safety-step grouping
 * @property {string} text    R  Screener text (canonical, fullest — §2 row 4)
 * @property {string} points  R  Screener points (differential). Clinician surfaces only.
 * @property {string} action  R  Screener action. Clinician surfaces + CDS example detail (generated, D7) + ServiceRequest.
 * @property {string} [ask]   O  Scribe L186-235 `ask` (kept as data; unread today — Q3)
 * Patient-safe copy (q, say) is LocaleDef.redFlags[id] (Patient L225-262 / L350-375). The Patient app receives only {id, tier} + locale copy from flagCopy(); `points`/`action` are unreachable there (t-shape test asserts no clinician string appears in the Patient render).
 * Cue phrases are lexicon.redFlags[id] (Extraction L153-166); validateModule asserts every flag id has phrases when a lexicon exists.
 */
```

### 2.8 Steps

```js
/** @typedef {Object} Step
 * @property {string} key            R  unique in its list; safety step key must be 'safety'
 * @property {'safety'|'domain'|'story'|'result'} kind R  engine STEP_KIND
 * @property {string[]} [domainKeys] O  for kind 'domain'/'story': one or more domain keys rendered in order (Screener L1086 recalcitrance, L1090 migraine, L1091 vestibular, L1092 neuro, L1094 discriminators, L1101 impact)
 * @property {('phenotypePicker'|'contextItems')[]} [extras] O  Screener L1072-1076 picker on 'intake'; L1101 ContextQ on 'impact'
 * @property {boolean} [requiresPhenotype] O  gate: step cannot advance until complaint chosen (Screener L888 'intake' → !!complaint). Engine-evaluated; ignored when module has no phenotypes.
 * @property {string} eyebrow        R  Screener L83-90 ('00'…'07')
 * @property {string} title          R  Screener L83-90
 * @property {string} [sub]          O  Screener step subtitles (L1023-1027, L1068-1070, L1098-1100)
 * @property {string} [intro]        O  StepCard intro copy (L1086, L1090-1094)
 *
 * @typedef {Object} Steps
 * @property {Step[]} screener       R  MASQUE: safety, intake(story: recalcitrance + phenotypePicker), migraine, vestibular, neuro, impact(+contextItems), discriminators, result (Screener L82-92 + JSX)
 * @property {Step[]} patient        R  keys and copy are locale data (LocaleDef.steps[key] = {title, lede?}); this list carries only key/kind/domainKeys/extras. MASQUE: safety, story(recalcitrance + contextItems), migraine, vestibular, neuro, impact, discriminators (Patient L531-541 minus the shell's intro/summary; recalcitrance folded into story L720; CONTEXT_Q on story L709)
 * Engine rules: the first step must be kind 'safety' (validateModule inserts an error, not a default — the author must write it, so the gate is visible in the module); exactly one 'result' at the end of screener; patient list has no 'result' (shell adds intro + summary). Every domain key must appear in at least one screener step and at least one patient step (else warning "domain never asked").
 */
```

### 2.9 Phenotypes (complaint vocabulary, derivation, activation, referral)

```js
/** @typedef {Object} Phenotype
 * @property {string} key           R  'sinonasal' | 'otologic' | 'both' (Screener L1072-1076)
 * @property {string} pickerTitle   R  Screener L1073-1075 `h`
 * @property {string} pickerDesc    R  Screener L1073-1075 `d`
 * @property {{specialty:string, reason:string}} referral R  L1456/L1577, Scribe L1259/L1311: otologic → {'Neuro-otology','vestibular migraine'}; sinonasal and both → {'Headache medicine / Neurology','mid-facial / migrainous cause'}
 * @property {string} [cdsCardKey]  O  which phenotype's CDS preview summary to use (Screener L1344: both → 'sinonasal'); default own key
 *
 * @typedef {Object} Phenotypes
 * @property {Phenotype[]} vocab    R  picker order
 * @property {string} default       R  Scribe L773 fallback 'sinonasal'
 * @property {Array<{key:string, when?:function(PhenotypeState):boolean}>} derive R  ordered; first truthy wins; entry without `when` is the fallback. MASQUE (Scribe L771-773): [{key:'both', when: s => s.sin && s.oto}, {key:'otologic', when: s => s.oto}, {key:'sinonasal'}] with s.sin/s.oto supplied by `signals`.
 * @property {Object<string, function(PhenotypeState):boolean>} [signals] O  named sub-predicates computed once and exposed on the state (sin: L771, oto: L772)
 * @property {{always:string[], rules:Array<{when:function(ActivationState):boolean, domains:string[]}>}} activation R  Scribe L781-783: always ['migraine','impact','recalcitrance','discriminators']; rules [{when: s => s.complaint==='otologic'||s.complaint==='both', domains:['vestibular']}, {when: s => (s.answers.n_burn ?? 'no') !== 'no' || s.answers.n_viral === 'yes', domains:['neuro']}]
 * @property {string} [tagBoostDomain] O  Scribe L790: items with a tag rank first while this domain is active ('vestibular')
 * Absent phenotypes ⇒ derivePhenotype returns '', activeDomains returns all domain keys, no picker, referral undefined ⇒ ServiceRequest referral omitted (open question Q4).
 */
```

### 2.10 Rules (D3)

```js
/** Common rule shape. `when` omitted ⇒ always true. `id` required and unique within the family (parity tests key on it).
 * @typedef {Object} RoutingRule
 * @property {string} id
 * @property {function(RoutingState):boolean} [when]
 * @property {boolean} [fallback]   O  emitted only if no other routing rule fired (Screener L946-950). At most one.
 * @property {('screener'|'scribe')[]} [surfaces] O  default both. MASQUE fallback rule: ['screener'] (Scribe buildRecs returns [] and buildNote L1248 has its own line — kept as copy.note.noDriver).
 * @property {Object<'screener'|'scribe', RecCopy>} copy R  per-surface {h, p, chips}; 'scribe' falls back to 'screener' per field. p/chips may be `function(RoutingState):string|string[]`.
 * MASQUE routing (Screener L914-950 ≡ Scribe L1184-1192 in condition, different copy):
 *   sinusMigraine   when s.sinus && s.strong
 *   vestibularMigraine when s.oto && (s.strong || s.domains.vestibular.pct >= 50)
 *   neuroOverlay    when s.domains.neuro.pct >= 50
 *   tinnitus        when s.answers.v_aural === 'yes'
 *   competing       when s.negativePts < 0   ; p: s => `Rule-out items subtracted ${Math.abs(s.negativePts)} points. …`; chips screener: s => s.negativeItemsYes.map(it => it.text.split(/[—(]/)[0].trim().slice(0,46)), scribe: []
 *   noDriver        fallback, surfaces ['screener']
 * Engine-owned, not module rules (they are gates, D8): override rec (Screener L895-903) and incomplete rec (L904-913); their copy lives in engine with `${module.copy.indexName}` interpolated.
 *
 * @typedef {Object} PatientSaidRule   // Patient L910-937 in order
 * @property {string} id
 * @property {function(PatientState):boolean} [when]
 * @property {string|function(PatientState):string} text   R  key into locale.sum (string) or template fn receiving state (state.S is the locale sum table, state.L the list joiner)
 *
 * @typedef {Object} PatientAskRule    // Patient L945-953 in order
 * (same shape; an `else` chain is written as explicit negated predicates)
 *
 * @typedef {Object} PatientSummaryRules
 * @property {Object<string, string[]>} groups   R  named item groups counted on the state: mig [m_photo,m_nausea,m_disable,m_aura,m_trig,m_fhx] (L919), vOther [v_motion,v_aural,v_head] (L926), neu [n_*] (L929), disc [x_*] (L936)
 * @property {Object<string, function(PatientState):boolean>} derived R  computed after groups, in key order, exposed on state: migPattern (L940), vestPattern (L941)
 * @property {PatientSaidRule[]} said  R
 * @property {PatientAskRule[]}  ask   R  (last MASQUE rule askNext has no `when`)
 *
 * @typedef {Object} Rules
 * @property {RoutingRule[]} routing               R
 * @property {PatientSummaryRules} patientSummary  R (may be {groups:{},derived:{},said:[],ask:[]})
 */
```

Gap: expressed by `ContextOption.signal` + `gapRule.threshold` (no separate rule array). CDS example generation: `cds.examples` (§2.17). Referral: `Phenotype.referral`. Scribe phenotype derivation/activation: §2.9.

### 2.11 Info prompts (Scribe L279-282)

```js
/** @typedef {Object} InfoPrompt
 * @property {string} id      R  'vmp_cog' | 'vmp_affect' (namespace must not collide with item ids — asserted)
 * @property {{group:string,label:string}} tag R  {'VM-PATHI','cognition'} / {'VM-PATHI','anxiety / emotion'}
 * @property {string} ask     R
 * @property {string} gateDomain R  offered only while this domain is active ('vestibular', Scribe L800); max 2 shown, pool cap 6 (engine constants)
 * @property {string} [noteHeading] O  buildNote L1224 'VM-PATHI domains additionally covered' — module.copy.note.infoCovered instead (§2.18)
 */
```

### 2.12 Samples and demo (D1 #1, #2)

```js
/** @typedef {Object} SampleCase
 * @property {string} key          R  'sinonasal'|'otologic'|'redflag'|'competing' (Screener L261-312) + 'empty'|'partial'|'high'|'ruleout' (Simulator L314-330; 'redflag' merged)
 * @property {string} label        R  Screener `label` / Simulator `label`
 * @property {string} buttonLabel  R  Screener L994-997 'Sample: sinus' … ; Simulator labels for the rest
 * @property {string} [why]        O  Simulator `why` (shown as tooltip/caption)
 * @property {string} [icon]       O  lucide name (Simulator icons by name: 'Ban','ScanLine','Zap','TriangleAlert','FlaskConical')
 * @property {string} [complaint]  O  phenotype key
 * @property {Object<string,string>} [ctx] O
 * @property {Object<string,boolean>} [rf] O
 * @property {Object<string,string|number>} a R  answers (may be {})
 * @property {boolean} [safetyReviewed] O  default true when loaded (Screener jumps to result, L856); 'empty' sets false
 * No `step` — SampleRail jumps to the result step unless `a` is empty.
 *
 * @typedef {Object} Demo
 * @property {{id,given,family,sex,gender,age,mrn,synthetic}} patient R  Screener L314-317 (≡ Scribe L584); no DOB by design
 * @property {Array<['md'|'pt', string]>} transcript R  Scribe SCRIPT L566-581 (canonical; Simulator LINES dropped, §6 #4)
 *
 * demoCohorts live in research (§2.16).
 */
```

### 2.13 Lexicon (Extraction L24, L38-166)

```js
/** @typedef {Object} Lexicon
 * @property {string} version        R  '0.3.1'
 * @property {{window:number, cues:string[]}} negation   R  {14, 14 cues} — window travels with the module (D5)
 * @property {{window:number, cues:string[]}} thirdParty R  {34, 15 cues}
 * @property {{window:number, cues:string[]}} historical R  {30, 8 cues}
 * @property {Array<{id:string, ph:string[], thirdPartyExempt?:boolean}>} bool R  24 entries (m_fhx exempt)
 * @property {Array<{id:string, val:string, ph:string[]}>} ctx R  c_dismiss
 * @property {Array<{id:string, cue:string[], bands:Array<{ph:string[], v:number}>, fallback:number|null}>} scale R  5 entries; band order significant
 * @property {Array<{ids:Array<{id:string, value:string|number, kind:'item'|'ctx'}>, ph:string[]}>} multi R  2 entries
 * @property {Object<string,string[]>} redFlags R  12 keys
 * @property {{version:string, path:string, utterances?:number}} goldSet R  {'0.2.0', '../reference/MASQUE_v0.3.1/…/masque_extraction_goldset.json'} — reported in footer/model card; not loaded by the app
 * validateModule: every phrase lowercase (error), every id resolves (item / context item / red flag), ctx values exist as context options, scale ids are scale items and band v within range.
 */
```

### 2.14 Probes (Probes L56-290)

```js
/** @typedef {Object} ProbeOption  {l:string, rf?:string, a?:Object<string,any>, note?:string}
 * @typedef {Object} Probe
 * @property {string} id  R 'pr_*'
 * @property {keyof PROBE_KIND} kind R
 * @property {function(answers, redFlags):boolean} when R  (unchanged closure signature — the engine keeps passing redFlags second, L134)
 * @property {string} [target]  O  retires when answered; forbidden on kind 'rescue'
 * @property {string} [rescues] O  required on kind 'rescue', forbidden elsewhere
 * @property {string} say R, why R
 * @property {ProbeOption[]} opts R  phenotype kind: no `a`
 *
 * @typedef {Object} ProbeSet
 * @property {string} version R  '1.0.0'
 * @property {Probe[]} list   R  ALL_PROBES order (PROBES then VM_PROBES; stable sort depends on it)
 */
```

### 2.15 Locales (Patient file throughout)

```js
/** @typedef {Object} LocaleDef
 * @property {string}  code       R  'en' | 'es'
 * @property {string}  name       R  'English' | 'Español' (Patient L295)
 * @property {boolean} reviewed   R  en true, es false (Patient L294). Shell renders the unreviewed banner whenever false (caveat text is shell-owned, D8; Patient L411 reviewBanner text becomes engine/policy CAVEATS.unreviewedTranslation[code] — Q5)
 * @property {Object<string,{q:string, opts?:string[], ask?:string, help?:string}>} items R  P / ES_P (L137-188, L297-348); opts length must equal scale length
 * @property {Object<string,{q:string, say:string}>} redFlags R  L225-262 / L350-375
 * @property {Object<string,{q:string, opts:string[]}>} contextItems R  Patient L523-528 labels, re-bound to Screener values (D6)
 * @property {Object<string,{label:string, blurb?:string}>} domains R  section titles L383/L405[3..7] + BLURB/BLURB_ES L761-774; recalcitrance has label only
 * @property {Object<string,{title:string, lede?:string}>} steps R  keyed by patient step key: safety, story (L705-707 heading/lede, L721 recalcitrance intro) — English-only literals today become en entries and es entries are added (Q6 lists them)
 * @property {Object} ui  R  the module part of UI (L379-424): sub, forYouIf[] (L787-788 bullets), patternName (L1067), plus every generic key the shell needs (title, step, of, back, next, start, seeSummary, yes, no, unsure, tierNow, tierSoon, tierNowWhat, tierSoonWhat, sayThis, print, download, startOver, summaryTitle, openWith, describe, askAbout, notSure, notSureLede, forClinician, thinTitle, thin, txtSeenToday, txtSeenWeek, txtSay, txtClinNote, txtFooter, fileName). LOCALE_UI_KEYS in contract.js is the authoritative list; validateModule asserts every locale has every key.
 * @property {Object} sum R  SUM[loc] (L428-464 / L466-500): string entries and template functions exactly as written, except `gap(signals)` takes `{c_clin:boolean, c_dur:boolean, c_dismiss:boolean}` instead of three positional booleans (mechanical, logged) and `clinNote(v, name)` receives module.name so the string can stop embedding 'MASQUE' — keep the literal text, substitute `${name}`.
 * @property {{listAnd:string, oxford:boolean, askTransform:function(string):string|null}} grammar R  L988-994 ('and', true) / ('y', false); askForm transform L984-985 (en regex; es → replace '.' with '?')
 * @property {Object} [scribe] O  reserved for future scribe localisation; unused
 */
```

### 2.16 Research (RRP L25-56 + brand strings)

```js
/** @typedef {Object} Research
 * @property {string} projectKey  R  'MASQUE' — the legacy `project` prop value that maps to this module (RRP L25)
 * @property {string} title       R  L26
 * @property {string} target      R  L27
 * @property {number} threshold   R  0.5
 * @property {{midpoint:number, slope:number}} calibration R  {48, 0.075}
 * @property {Array<[string,string]>} sources R  8 rows L31-39
 * @property {string[]} expected  R  L40
 * @property {Object[]} demo      R  9 rows L41-55 (sex/gender divergence preserved)
 * @property {string[]} scoreAliases R  ['masque_score'] (L197/L216 brand slice; generic 'score','index' stay engine)
 * @property {string} artifactKey R  'masqueArtifact' (L864)
 * @property {string} etlScript   R  'etl/masque_population_etl.R' (L991)
 * @property {string[]} fairnessAxes R  ['sex','gender'] (L775, L823, L967) — first is default axis
 * @property {{selectionGapTolerance?, sensitivityGapTolerance?, specificityGapTolerance?, toleranceSetBy, toleranceRationale, toleranceSetOn}} [fairnessPolicyOverride] O  merged over FAIRNESS_POLICY only if all three attribution fields present (invariant 3); minGroupN/minCellN/confidence/z NOT overridable (validateModule error)
 * @property {Array<{id:'balanced'|'unlabeled'|'disparate'|string, label:string, why:string, spec:CohortSpec}>} demoCohorts R  Simulator L677-681 + makeCohort L285-305 parameters as data: spec = {n, seed, scoreRange:[lo,hi], labeled:boolean, groups:[{axis:'sex', value, share, positiveRate}], midpoint}
 * @property {string[]} [citations] O  proposal § strings the panel prints (L425, L874, L893, L895, L925, L1003, L1050); absent ⇒ panel omits the parenthetical
 * @property {string[]} [knownLimitations] O  model-card list (L879); absent ⇒ engine default list
 */
```

### 2.17 FHIR and CDS identity (D4, byte-identical)

```js
/** @typedef {Object} Fhir
 * @property {string} questionnaireUrl R  `http://masque.example/Questionnaire/masque-screener-v${versions.instrument}` — module writes it as a function of instrument version: `questionnaireUrl: v => \`http://masque.example/Questionnaire/masque-screener-v${v}\`` so the URL cannot drift from the version (Screener L80)
 * @property {string} questionnaireName R  'MASQUEScreener' (L429)
 * @property {string} questionnaireTitle R  L430
 * @property {string} publisher      R  'Project MASQUE — TOPx prototype' (L434)
 * @property {string} description    R  L435-438
 * @property {string} safetyGroupText R  L443 'Red flags — evaluated before screening; not scored' (module because it names the gate wording used in a published artifact)
 * @property {string} codeSystem     R  'http://masque.example/codes' (L447 etc.)
 * @property {string} answerSystem   R  'http://masque.example/answer' (L421)
 * @property {string} criteriaSystem R  'http://masque.example/criteria' (L467)
 * @property {string} indexCode      R  'masque-index' (L1537)
 * @property {string} indexDisplay   R  'MASQUE migraine/neuropathy screen index' (L1537, Scribe L1283)
 * @property {string} documentType   R  Scribe L1303 'ENT encounter note — MASQUE ambient screen'
 * @property {string} documentTitle  R  Scribe L1304 'MASQUE encounter note (draft)'
 * WEIGHT_EXT stays engine (§4.3). Component codes domain-*, screen-coverage, attainable-range, routing-override are engine.
 *
 * @typedef {Object} Cds
 * @property {string} serviceId   R  'masque-screen' (L479)
 * @property {string} title       R  L480
 * @property {string} description R  L481-483
 * @property {{label:string, url:string}} source R  {'Project MASQUE','http://masque.example'} (L500)
 * @property {string} safetyCardUuid R 'masque-safety' ; indexCardUuid R 'masque-index' (L496, L507)
 * @property {{redFlagPresent:{flagId:string, summary:string}, settled:{score:number, summaryTail:string, detail:string}}} examples R  generated (D7): redFlagPresent.detail = `${redFlags[flagId].action}. The screening index is withheld from routing.` (rf_asym, L499); settled.summary = `${copy.indexName} ${score}/${scaleMax} — ${bandFor(score)} likelihood ${summaryTail}` (78, 'of a masked migrainous driver', L508); detail L510. Byte-identity to L474-519 is checked by t-golden.
 * @property {Object<string,{summary:string|function(RoutingState):string}>} previewByPhenotype R  ResultView CDS preview (Screener L1334, L1344) keyed by phenotype key (with Phenotype.cdsCardKey resolving 'both')
 */
```

### 2.18 Copy (module-specific, never a caveat)

```js
/** @typedef {Object} Copy
 * @property {string} indexName        R  'MASQUE index' (Screener L1243, L1437, L532, Scribe L922, L1313)
 * @property {string} patternName      R  'masked migrainous / neuropathic driver' (Screener L1255 band suffix source, Scribe L1228, panel target reuses research.target)
 * @property {{title:string, subtitle:string}} screener R  L1005-1006
 * @property {{title:string, subtitle:string, banner:string}} scribe R  L876-877, L865
 * @property {{clinicalDisclaimer:string}} scribeExtra O  L1127 VM-PATHI licence sentence (module-specific, not the generic caveat)
 * @property {{sources:string}} disclaimer O  Screener L1428 data-source list sentence; the generic "not for clinical use" line is shell
 * @property {{aboutParagraphs:string[]}} about O  Screener/Scribe About details (L1132-1137)
 * @property {Object} note R  Scribe buildNote headings/phrases: title ('ENT ENCOUNTER — MASQUE ambient screen (DRAFT)'), screenHeading ('MASQUE SCREEN'), likelihoodOf ('likelihood of a masked migrainous / neuropathic driver'), infoCovered ('VM-PATHI domains additionally covered'), supportingFooter ('Not Barany criteria; contribute nothing to the index. Instrument v0.3 candidates.' — see Q7 on the version literal), noDriver ('No masked driver flagged; continue standard ENT management.'), signOff ('Screening aid, not a diagnosis. Confirmatory instruments administered under license.'), gapLine ('Diagnostic-gap pattern flagged (repeat visits + prior dismissal).')
 * @property {{heading:string, body:string}} gapAlert R  Screener L1303-1308 (screener), Scribe L954
 * @property {string} bandSuffix R  Screener L1255 ' of a masked migrainous / neuropathic driver' appended to bandMeta label (engine labels 'Low likelihood' etc.)
 * @property {Object<'screener'|'scribe'|'patient', Array<{title:string, body:string}>>} [walkthrough] O  Simulator rails L992-1013 (patient), L1511-1547 (scribe), L1493-1497; rendered by shell/Walkthrough.jsx when present (D1 #4)
 * @property {string} [screenerResultEyebrow] O  L1221
 */
```

Caveats deliberately absent from Copy: "Prototype · not for clinical use", "Traducción sin revisar / preliminary translation", "illustrative — replace after validation", "not a survey estimate", "Screening aid, not a diagnosis" (this one is note copy the module owns — but the shell appends its own caveat line to every export regardless).

### 2.19 What a second module must write (the template)

`modules/_template/module.js` is the smallest object that passes `validateModule` with zero warnings: identity + versions, 2 domains (positive only), 5 items (one scaled), bands, 2 red flags, 2 screener steps + result, 2 patient steps, no phenotypes, `rules.routing` with one rule + fallback, `rules.patientSummary` with one said rule and the mandatory askNext-style final rule, no infoPrompts, one sample case, demo patient + 2-turn transcript, lexicon with 2 bool entries + flag phrases, probes with one safety probe, en locale only, research with demo rows ≥ 2 and one demoCohort, fhir/cds identifiers under `http://example.invalid/template/…`, copy. It is registered only by the test page (`app/tests/t-shape.js`), never in `SCREENING_MODULES` (D9).

---

## 3. Engine API

All functions are pure unless they end in `download*`. Every function takes `module` first (or a sub-object of it); nothing reads a global. Signatures are given as JSDoc-style prose; return shapes are exact.

### 3.1 `engine/scoring.js` (Screener L321-408 verbatim in arithmetic)

| Function | Signature | Behaviour |
|---|---|---|
| `scoreItem(item, val)` | → number | L321-327 exactly (`typeof val !== 'number'` → 0 for scaled; `'yes'` → w). |
| `itemBounds(item)` | → `{min, max}` | L360-367 exactly. |
| `bandFor(cuts, v)` | → `'low'\|'moderate'\|'high'` | L336-340 with cuts injected. |
| `computeScore(module, answers)` | → `Score` | L369-408 without `useMemo`. `Score = {domains: {[k]: {pts, max, pct, label, openPts, negative}}, total, floor, ceiling, coverage, scorable, answered, count, band, open: Array<Item & {domain, domainLabel}>}`. `answers` values pass through `normalizeAnswer` (`'unsure'` → undefined) so the Patient app can call it too (it never renders it). Clamp is `[0, scaleMax(module)]`. |
| `scaleMax(module)` | → number | Σ `max` over non-negative domains (100 for MASQUE). Replaces literal 100 (L395-397, "SCORE / 100", dictionary positiveMax). |
| `negativeMin(module)` | → number | Σ `max` over negative domains (−29). Replaces `ITEMS.discriminators.max` (L527, Scribe L452). 0 when no negative domain. |
| `bandRanges(module)` | → `[{band, lo, hi}]` | from cuts + scaleMax: low [0,33], moderate [34,66], high [67,100]. |
| `bandRangeText(module)` | → `{low:'< 34', moderate:'34–66', high:'≥ 67'}` | byte-identical to L528 for MASQUE (t-golden). |
| `meterZones(module)` | → `[{band, w}]` | widths 34/33/33 as percentages of scaleMax. (Old literal was 33/33/34 — visual only, not in any artifact; recorded as an intentional derivation in CHANGELOG.) |
| `meterTicks(module)` | → `[0, 34, 67, 100]` | |
| `allItems(module)` | → `Array<Item & {domain}>` | DOMAIN order then item order (Scribe ALL_ITEMS). |
| `itemById(module)` | → `Object<string, Item & {domain}>` | memoised per module object (WeakMap). |
| `openItems(module, answers)` | → same as `Score.open` | convenience. |
| `useScore(module, answers)` | React hook wrapper `useMemo(() => computeScore(module, answers), [module, answers])` | lives in `apps/parts/useScore.js`, not the engine (keeps engine React-free). |

### 3.2 `engine/rules.js` — evaluator

```
evaluateRules(rules, state, opts?) → Array<{rule, id, ...resolvedPayload}>
```
- Iterates in array order. A rule fires when `rule.when` is absent or returns truthy for `state`.
- `opts.fallbackKey` (default `'fallback'`): a rule flagged fallback is appended only when nothing else fired.
- `opts.surface`: rules with `surfaces` not containing it are skipped; `copy[surface]` is selected with per-field fallback to `copy.screener`.
- `opts.resolve` (default `true`): every payload field that is a function is called with `state` (templates). Objects/arrays are resolved recursively one level (chips array of functions is not supported; chips is either an array or one function returning an array).
- Never throws on a predicate error: it catches, records `{id, error}` on `state.__ruleErrors` and treats the rule as not fired (the shell shows rule errors in the dev banner; the test page fails on any).
- `renderTemplate(value, state)` is the single resolver: string → string; function → `String(fn(state))`; array → mapped.

### 3.3 State shapes handed to predicates (documented contract; `Object.freeze`d in dev)

**RoutingState** (`buildRoutingState(module, {score, answers, ctx, complaint, activeFlags, safetyReviewed})`), used by `rules.routing`, `cds.previewByPhenotype`, `Phenotype.referral` selection:
```
{
  module,                                   // read-only reference (for labels)
  band, scorable, total, floor, ceiling, coverage, answered, count,   // from Score
  domains,                                  // Score.domains: {[k]: {pts, max, pct, label, openPts, negative}}
  answers,                                  // normalised answers (unsure → undefined)
  ctx,                                      // context item values
  complaint,                                // phenotype key or ''
  strong,                                   // band !== lowestBand
  lowestBand, highestBand,
  // complaint convenience flags: for every phenotype key K, `is[K]` = complaint === K;
  // plus module-declared aliases from phenotypes.signals evaluated on answers (sin, oto)
  is: {sinonasal, otologic, both}, sinus, oto,   // sinus = is.sinonasal || is.both ; oto = is.otologic || is.both  (derived from Phenotypes.vocab entry `alsoMatches` — see note)
  negativeDomains: [{key, label, pts, max, items}],    // domains with negative:true
  negativePts,                              // Σ pts over negativeDomains (0 when none)
  negativeItemsYes: [Item],                 // items in negative domains answered 'yes' (or scale > 0)
  activeFlags: [RedFlag], override, emergent,
  safetyReviewed,
  gap: {signals: {[ctxId]: boolean}, count, alert},
}
```
Note on `sinus`/`oto`: rather than hard-code "both" semantics, `Phenotype` gets an optional `alsoMatches: string[]` (MASQUE: `both.alsoMatches = ['sinonasal','otologic']`) and the state exposes `matches(K)` = `complaint === K || vocab[complaint]?.alsoMatches?.includes(K)`; MASQUE rules are written `s.matches('sinonasal')`. `sinus`/`oto` are not engine fields.

**PhenotypeState** (`buildPhenotypeState(module, answers)`), used by `phenotypes.signals` and `phenotypes.derive`:
```
{ module, answers, answered(id) → boolean, yes(id), no(id), scaleGt(id, n), ...signals }   // signals are added after evaluation in declaration order; a signal may read earlier signals
```

**ActivationState** (`activeDomains(module, {answers, complaint})`), used by `phenotypes.activation.rules`: `{ module, answers, complaint, matches(K) }`.

**PatientState** (`buildPatientState(module, locale, {a, ctx})`), used by `patientSummary.derived/said/ask` and `locale.sum` templates:
```
{
  module, loc, S,                            // S = locale.sum
  a,                                         // raw patient answers (may contain 'unsure')
  yes(id), scale(id) → number|null, unsure(id),
  groups: {[name]: string[]},                // ids in the group answered 'yes' (order preserved)
  n: {[name]: number},                       // group counts
  ...derived,                                // migPattern, vestPattern booleans
  ctx, gap: {signals, count, alert},
  L(xs) → string,                            // locale list joiner
  words(groupName, tableKey) → string,       // L(ids.map(id => S[tableKey][id]))  — replaces mig.map(k => S.migWords[k]) etc.
}
```

### 3.4 `engine/rules.js` — family helpers

| Function | Signature → return |
|---|---|
| `routingRecs(module, routingState, surface)` | → `Rec[]` where `Rec = {id, h, p, chips}`. Engine prepends the two gate recs: if `override` → `[overrideRec]` and returns; else if `!scorable` → `[incompleteRec]` and returns (Screener L895-913; Scribe: `buildRecs` returned `[]` when unscorable, so for surface 'scribe' the incomplete rec is not emitted, matching L1183 — the note handles the wording L1244). Then `evaluateRules(module.rules.routing, state, {surface})`. |
| `derivePhenotype(module, answers)` | → key or `''` (no phenotypes). Evaluates `signals`, then `derive`. |
| `activeDomains(module, {answers, complaint})` | → `Set<string>`: `activation.always` ∪ fired rule domains; all keys when no phenotypes. |
| `gapSignals(module, ctx)` | → `{signals: {[ctxId]: boolean}, count, alert, labels: string[]}`; `labels` are `signalLabel`s of fired items (Screener L873-878). |
| `referralFor(module, complaint)` | → `{specialty, reason}` or `undefined`. |
| `cdsIndexCard(module, routingState)` | → `{summary, detail?}` from `cds.previewByPhenotype[cdsCardKey(complaint)]`. |

### 3.5 `engine/patientSummary.js`

| Function | Signature → return |
|---|---|
| `buildPatientSummary(module, locale, {a, ctx, flags, urgent})` | → `{said: string[], ask: string[], gapLine: string\|null, unsureList: string[], clin: [{w, neg, t}], flags, urgent, ctx, loc}` — same shape as Patient L974. `said`/`ask` via `evaluateRules` on `patientSummary.said/ask` with `PatientState`; `gapLine` = `gap.count >= threshold ? S.gap(gap.signals) : null`; `unsureList` in module item order (Patient L960 used P key order — identical for MASQUE because P is in instrument order; verified by t-rules); `clin` from L962-972 using `locale.items[id].opts[v]` and `item.text`? — **No**: L969 uses `it.c`, the Patient's clinical abbreviation, which the inventory maps to `item.short`. Uses `item.short`. |
| `askForm(module, locale, id)` | L981-986 with `locale.grammar.askTransform`. |
| `joinList(localeDef, xs)` | L988-994 with `grammar.listAnd`/`oxford`. |
| `summaryText(module, locale, summary, {appVersion})` | L1096-1125; footer line uses `module.name` + `APP_VERSION`; shell caveat appended by caller. |

### 3.6 `engine/fhir.js`

| Function | Signature → return |
|---|---|
| `buildQuestionnaire(module, {date?})` | Screener L424-472 with `module.fhir.*`, `module.redFlags`, `module.domains/items`; `date` defaults to today (injectable for golden). Keeps the `initialSelected:false` no-op so output is byte-identical (documented as legacy in a comment; removal is a future instrument-neutral change — Q8). |
| `buildCdsHooks(module)` | L474-519 generated from `module.cds` + `module.redFlags` + `bandFor` + `scaleMax` (§2.17). |
| `buildDataDictionary(module, {appVersion})` | L521-558 with: `positiveMax = scaleMax`, `discriminatorMin = negativeMin`, `bands = bandRangeText`, canonical fields = `CANONICAL_COHORT_FIELDS` (adds `module_id` and `complaint` — D5/§2 row 5f; enumerated golden exceptions), items/redFlags from module; `note` strings interpolate `copy.indexName`. |
| `buildBundle(module, screen)` | Scribe L1254-1316 as base (reports `floor`), plus: `screen.referralCleared` replaces `routingCleared` (Screener passes `!override`, Scribe passes `routingGate(...)`), `DocumentReference` emitted only when `screen.note !== undefined`, referral text from `referralFor(module, complaint)` (omitted when undefined), all systems from `module.fhir`, reasonCode `${copy.indexName} ${total}/${scaleMax} (${band}); administer confirmatory instrument.` (Scribe wording; Screener's "(band likelihood)" variant is an enumerated golden difference — Q9). `screen = {patient, answers, score: Score, complaint, activeFlags, emergent, referralCleared, note?, now?}`. |
| `FHIR_SYSTEMS` | observation-category, flag-category, v3-ObservationInterpretation, data-absent-reason, UCUM — engine constants. |

### 3.7 `engine/cohort.js`

| Function | Signature → return |
|---|---|
| `CANONICAL_COHORT_FIELDS` | `[screen_id, captured_at, module_id, instrument_version, app_version, score, label, reference_diagnosis, subject_id, visit_label, sex, gender, age, weight, annual_cost, avoidable_cost, complaint, coverage, scorable, band, red_flags]` — every 0.3.1 column kept, `module_id` inserted after `captured_at` (D5; nothing renamed/dropped, invariant 9). |
| `screenToCohortRow(module, screen, {appVersion, salt, now?, id?})` | L572-606 with the `ctx` fix (`visit_label: screen.ctx?.visit_label ?? ''`), `screen_id` prefix `${module.id}-`, `module_id`, item columns in `allItems` order. `now`/`id` injectable for golden. |
| `rowsToCsv(rows)` | L608-616. |
| `subjectPseudonym(salt, mrn)` | L69-79 with salt injected (`policy.SITE_SALT` passed by the app). |
| `makeCohort(spec, {module?})` | Simulator L285-305 generalised: `spec = {n, seed, scoreRange, labeled, midpoint, groups:[{axis, value, share, positiveRate}]}` → rows in the canonical schema (module_id, instrument_version filled from `module` when given; item columns omitted, as the Simulator did). Deterministic: `mulberry32(spec.seed)`. |
| `cohortTemplateCsv(module)` | header-only CSV (replaces the hand-maintained template). |

### 3.8 `engine/extraction.js`

| Function | Signature → return |
|---|---|
| `createExtractor(lexicon)` | → `{extract(text, opts), lexicon}`; validates nothing (validateModule does). |
| `extract(lexicon, text, opts = {negationWindow?, includeSuppressed?})` | L217-268 exactly with `NEGATION/THIRD_PARTY/HISTORICAL/BOOL_EX/CTX_EX/SCALE_EX/MULTI_EX/RF_PHRASES` read from `lexicon.{negation, thirdParty, historical, bool, ctx, scale, multi, redFlags}`. Output contract unchanged: `[{id, value, kind:'item'\|'ctx'\|'redflag', evidence, cueIndex, suppressedBy?}]`. |
| `firstHit, allHits, cueBefore` | L172-200 exported (cueBefore newly exported for the benchmark). |
| `faersToUtterances(rows)` | L284-300. |
| `EXTRACTOR_KIND` | L25. |

### 3.9 `engine/probes.js`

| Function | Signature → return |
|---|---|
| `liveProbes(probes, answers, redFlags, answered)` | L301-307 with the list injected; additionally skips the `target` retirement for `kind === 'rescue'` (belt and braces; validateProbes forbids target there). |
| `validateProbes(probes, itemIds, redFlagIds)` | L322-345 plus: rescue must have `rescues` and no `target`; non-rescue must not have `rescues`; `mayWrite:false` kinds (phenotype) with `o.a` → error (replaces the literal `kind === 'phenotype'`); duplicate option labels warning. Returns `errs`; does not `console.error` (validateModule reports). |
| `truncateProbes(live, cap)` | groups by `PROBE_KIND_ORDER`; kinds with `truncate:false` untouched, others sliced to `cap` with `{shown, total}` counts (Scribe cap 2; the Simulator's 3 is gone). |

### 3.10 `engine/scribe.js`

| Function | Signature → return |
|---|---|
| `ingestCaptures(module, state, captures)` | Scribe L728-738: `state = {answers, ctx, rf}` → new state. Branches on `capture.kind` only. |
| `rankSuggestions(module, {answers, complaint, vmp, scorable})` | L780-803 with `activeDomains`, `tagBoostDomain`, `domain.shortTag`, `infoPrompts` (gateDomain, max 2, pool 6). Returns `[{id, ask, tag, scale?, kind:'scored'\|'info'}]`. |
| `captureLabel(module, capture)` | L1157-1166 via `capture.kind`: redflag → flag.text, ctx → contextItem.shortLabel, item → item.short. |
| `buildNote(module, input)` | L1195-1252 with `copy.note.*`, `item.short`, `contextItems[].noteLabel`, `infoPrompts` tags, `patient.sex?.[0] ?? ''` guard, `${versions.instrument}`; `input` = same fields as today plus `module`. |

### 3.11 `engine/locale.js`

| Function | Signature → return |
|---|---|
| `localesOf(module)` | → `[{code, name, reviewed}]` in `Object.keys(module.locales)` order. |
| `resolveLocale(module, code)` | → the `LocaleDef` merged over `defaultLocale` (item/flag/context/domain/step/ui/sum key-wise, so a partial locale degrades to the default's string rather than `undefined`; validateModule still requires completeness for shipped locales, but a `reviewed:false` locale may be partial with warnings — authoring aid). |
| `itemCopy(module, code, id)`, `flagCopy(...)`, `ctxCopy(...)`, `ui(module, code)`, `sum(module, code)` | typed accessors over the resolved locale (pFor/rfFor generalised, Patient L193-194). |
| `LOCALE_NAMES` | fallback names for codes a module forgets to name. |

### 3.12 `engine/gates.js` (D8 — every app calls these; no module input)

| Gate | Signature → boolean | Where used |
|---|---|---|
| `safetyGate({safetyReviewed, activeFlags})` | `safetyReviewed \|\| activeFlags.length > 0` (Screener L886) | Screener step advance; Patient safety step (`safetyDone`) |
| `routingGate({override, safetyReviewed})` | `!override && safetyReviewed` (Scribe L847) | Scribe recs/referral/rec block; Screener referral (`safetyReviewed` is necessarily true past the safety step) |
| `signGate({safetyReviewed})` | `!REQUIRE_SAFETY_REVIEW_TO_SIGN \|\| safetyReviewed` | Scribe sign button |
| `coverageGate(score)` | `score.scorable` | ResultView band, CDS card, Observation value |
| `referralGate({cleared, score})` | `cleared && score.scorable && score.band !== lowestBand` | buildBundle |
| `abstainGate(p)` | `p >= ABSTAIN_FLOOR` | panel (already there; exported for symmetry) |

### 3.13 `engine/validateModule.js`

`validateModule(module, {strict = true} = {}) → {ok, errors: [{path, msg}], warnings: [{path, msg}]}`. Never throws. The shell refuses to mount apps when `errors.length > 0` (renders `InvalidModule`), and prints warnings in the dev banner. The complete assertion list (E = error, W = warning):

Identity / shape
1. E `contractVersion === MODULE_CONTRACT_VERSION`.
2. E `id` matches `/^[a-z][a-z0-9-]*$/`; `name`, `label`, `defaultLocale`, `changelog` non-empty strings; `label !== id` not required.
3. E every `REQUIRED_TOP_KEYS` present; W unknown top-level keys (typo detection).
4. E `versions.instrument` non-empty string; W if it does not match `/^\d+(\.\d+)*$/`.
5. E `Object.isFrozen(module)` is not required, but W if any top-level object is not frozen (mutation hazard under the shell's shared reference).

Domains / items / bands (§4.5 loader assertions)
6. E domains array non-empty, keys unique, `items[key]` exists for every domain and no `items` key without a domain.
7. E every domain: `Σ w === max` (exact, integers) — the "per-domain weights match max" rule.
8. E `Σ max` over non-negative domains equals `scaleMax` and ≥ `bands.cuts.high` (bands must be reachable).
9. E negative-domain items all have `w < 0`; non-negative-domain items all `w > 0`.
10. E item ids unique across domains, context items, info prompts and red flags (single id namespace).
11. E every scaled item has ≥ 2 options, every option has numeric `f ∈ [0,1]` and a string label, and some option has `f === 0`.
12. E `symbol` length equals scale length when present.
13. E every item has `text` and `short`; W missing `ask` (Scribe falls back to `text`).
14. E `bands.cuts` has exactly keys `moderate`, `high` with `0 < moderate < high ≤ scaleMax`.

Context items / gap
15. E context ids unique; each option has `value` and `label`; W a module with context items but no option carrying `signal:true` ("gap rule can never fire").
16. E `gapRule.threshold` integer ≥ 1 and ≤ number of signal options.

Red flags / gates
17. E `redFlags.length ≥ 1` (Q1); ids unique; `tier ∈ TIERS`; `group`, `text`, `points`, `action` non-empty.
18. E no red flag has a `w`, `weight`, `scale` or `f` property (flags are never scored).

Steps
19. E `steps.screener[0].kind === 'safety'` and `steps.patient[0].kind === 'safety'`; exactly one `result` at the end of `screener`; no `result` in `patient`.
20. E every `domainKeys` entry is a domain key; `extras` ⊆ {phenotypePicker, contextItems}; `phenotypePicker` only when `phenotypes` present; `requiresPhenotype` only with phenotypes.
21. W a domain appearing in no screener step; W a domain in no patient step; E a domain in more than one screener step (double-asked).

Phenotypes
22. E when present: vocab keys unique, `default` ∈ vocab, `derive` non-empty, last derive entry has no `when` or `default` covers it, every `derive.key` ∈ vocab, `alsoMatches` ⊆ vocab, `cdsCardKey` ∈ vocab, `activation.always` ⊆ domain keys, every activation rule `domains` ⊆ domain keys and `when` is a function, `tagBoostDomain` ∈ domain keys, each vocab entry has `referral.specialty` and `referral.reason`.

Rules
23. E every routing rule has unique `id`, `copy.screener.h`; `when` is a function when present; at most one `fallback`; `surfaces` ⊆ {screener, scribe}; W no fallback rule (Screener result would show nothing when no rule fires).
24. E `patientSummary.groups` values are item ids; `derived` values are functions; every said/ask rule has `id` and `text` (string keys must exist in **every** locale's `sum`); E the last `ask` rule has no `when` (the patient always gets at least one question — Patient L953 invariant).
25. Smoke: E every predicate/template in routing, phenotype, activation, patientSummary runs without throwing against (a) the empty state and (b) each sample case (rule authoring feedback with the offending sample named).

Info prompts
26. E ids unique and outside item namespace (rule 10); `gateDomain` ∈ domain keys; `tag.group`/`tag.label`/`ask` strings.

Samples / demo
27. E every sample `a` key is an item id and value is valid for the item type (`'yes'|'no'` or index within scale); `ctx` keys/values valid; `rf` keys are flag ids; `complaint` ∈ vocab; unique `key`; `buttonLabel` present; W icon name not found in lucide.
28. E `demo.patient` has `id, sex, gender, age, mrn, synthetic:true` and no `dob`/`birthDate` (no-DOB rule); E `demo.transcript` is `Array<['md'|'pt', string]>`.
29. W gate rehearsal coverage: no sample with a red flag; no sample that is unscorable; no sample with `negativePts < 0` (when a negative domain exists) (§4.5 "demo sets must keep exercising the gates").

Lexicon (when present)
30. E every `bool/scale/multi(kind item)` id is an item id; `scale` ids are scaled items and every band `v` < scale length, `fallback` null or in range; `ctx` and `multi(kind ctx)` ids are context ids and values are declared option values; `redFlags` keys ⊆ flag ids **and** every flag id has ≥ 1 phrase (drift guard, Scribe L555-558).
31. E every phrase and cue is lowercase and non-empty; W a phrase shorter than 3 characters.
32. E `negation/thirdParty/historical` each `{window: positive integer, cues: string[]}`; E `version` string; E `goldSet.version` string.

Probes (when present)
33. E `validateProbes(list, itemIds, flagIds)` returns no errors (full list in §3.9); E `version` string; E `list` non-empty.
34. Smoke: E every `when(answers, rf)` runs without throwing on `{}`/`{}` and on each sample case.

Locales
35. E `locales[defaultLocale]` exists; every locale has `code === key`, `name`, boolean `reviewed`.
36. E per locale: `items[id]` for every item, `opts.length === scale.length` for scaled items, no `opts` on boolean items (Patient L198-211 assertCoverage); `redFlags[id]` `{q, say}` for every flag; `contextItems[id]` with `opts.length === options.length`; `domains[key].label` for every domain; `steps[key].title` for every patient step; every `LOCALE_UI_KEYS` key; every `sum` key referenced by rules; `grammar.listAnd` string, `askTransform` function.
37. E a locale entry (`items`, `redFlags`) must not contain the keys `points`, `action`, `differential` (patient build cannot carry clinician differentials, risk 8).
38. W `reviewed:true` on a non-default locale without `reviewedBy`/`reviewedOn` fields.

Research / FHIR / CDS / copy
39. E `research.projectKey`, `title`, `target`, numeric `threshold ∈ (0,1)`, `calibration.midpoint/slope` numbers, `sources` array of pairs, `expected` includes `'score'` and `'label'`, `demo` array ≥ 1 with each row carrying a score column resolvable via `scoreAliases ∪ ['score','index']`, `scoreAliases` array of lowercase strings, `artifactKey`, `etlScript`, `fairnessAxes` non-empty and ⊆ `expected`, every `demoCohorts[].spec` has `n ≥ 1`, `seed` integer, `scoreRange` inside `[0, scaleMax]`.
40. E `fairnessPolicyOverride` when present has all three attribution fields and touches only the three tolerance keys.
41. E `fhir.questionnaireUrl` is a function returning a URL containing `versions.instrument`; all other `fhir.*` and `cds.*` strings non-empty; `cds.examples.redFlagPresent.flagId` ∈ flag ids; `cds.examples.settled.score` within `[0, scaleMax]`; `cds.previewByPhenotype` has a key for every phenotype's `cdsCardKey`.
42. E `copy.indexName`, `patternName`, `screener.title/subtitle`, `scribe.title/subtitle/banner`, `note.*` (all keys listed in §2.18), `gapAlert.heading/body`, `bandSuffix` present; W `walkthrough` keys outside {screener, scribe, patient}.
43. E no copy string anywhere in the module (deep walk, all locales) equals or contains one of the shell caveat strings (`CAVEATS.*`) — caveats are shell-owned, and a module that duplicates them would let a later edit drop one silently.
44. W any string containing the substring of `module.label` inside `fhir`, `cds`, item ids, or cohort-facing fields (D4 guard: "Dizziness" must not leak into identifiers).

`formatReport(result)` renders these as the authoring feedback panel in `app/tests/index.html` and in `InvalidModule.jsx`.

---

## 4. Component contracts, state ownership, reset semantics

### 4.1 Shell — `shell/App.jsx`

State owned by the shell (and only the shell): `moduleId` (default `DEFAULT_MODULE_ID`, persisted in `sessionStorage['mx.module']`), `tab` (`'screener'|'scribe'|'patient'`, persisted), `locale` (per module: reset to `module.defaultLocale` on module change; persisted per `moduleId`), `walkthrough` (boolean, only offered when `module.copy.walkthrough?.[tab]` exists), `validation` (result of `validateModule(module)` computed in `useMemo` keyed by the module object).

Render tree:
```
<div className="mx-shell">                       ← tokens + chrome styles (SHELL_CSS)
  <Caveats />                                    ← unconditional "Prototype · not for clinical use"; unreviewed-translation banner when !locale.reviewed
  <header> <Mark/> <ModuleSelect/> <AppTabs/> <LocaleToggle/> <WalkthroughToggle/> </header>
  {validation.ok
     ? <main key={module.id}>                    ← key = module.id: every app subtree unmounts on module change (D11)
         <Screener  key="screener" module={module} appVersion={APP_VERSION} policy={policy} hidden={tab!=='screener'} />
         <Scribe    key="scribe"   module={module} appVersion={APP_VERSION} policy={policy} hidden={tab!=='scribe'} />
         <PatientCompanion key="patient" module={module} locale={locale} appVersion={APP_VERSION} hidden={tab!=='patient'} />
         {walkthrough && <Walkthrough cards={module.copy.walkthrough[tab]} />}
       </main>
     : <InvalidModule module={module} report={validation} />}
  <Footer module={module} appVersion={APP_VERSION} />
</div>
```
Tabs stay mounted (hidden with `hidden` attribute) so switching between Screener and Scribe does not lose a half-entered screen — the old separate pages had independent state, and this preserves that while adding persistence within a session. The `main` key guarantees that no answer keyed by an item id, no rf, ctx, complaint, cohort row, probe answer, transcript cursor or panel upload survives a module change (risk 6). Apps are lazy: a tab's component is created on first activation (`useState` set of visited tabs) to avoid compiling/mounting all three at once.

`document.title = \`${module.label} — ${APP_TABS[tab].title}\``. The page never displays `module.label` anywhere else (D4).

### 4.2 `shell/ModuleSelect.jsx`
Props: `{modules: SCREENING_MODULES, value: id, onChange(id)}`. Renders `<label>Screening module <select>` with `option.textContent = m.label`. When exactly one module is registered the select is still rendered (it is the affordance the whole refactor exists for) but with a subtitle "1 module registered". Ships with exactly one option (D9).

### 4.3 `shell/AppTabs.jsx`
`APP_TABS = [{key:'screener', title:'Clinician Screener', supportsLocale:false}, {key:'scribe', title:'Ambient Scribe', supportsLocale:false}, {key:'patient', title:'Patient Companion', supportsLocale:true}]`. `LocaleToggle` renders only if `APP_TABS[tab].supportsLocale && localesOf(module).length > 1`. The research panel is not a tab: it stays embedded in Screener and Scribe (D11).

### 4.4 `shell/Footer.jsx`
`versionLine(module) → \`release ${APP_VERSION} · module ${module.id} · instrument ${module.versions.instrument} · lexicon ${module.lexicon?.version ?? '—'} · probe set ${module.probes?.version ?? '—'} · gold set ${module.lexicon?.goldSet?.version ?? '—'}\``, preceded by the caveat and followed by a link to `module.changelog`. Each app's own footer line (Screener L1144, Scribe L1148, Patient L753) is removed; the shell footer is the single version surface. Exports (`summaryText`, note, manifest, model card) call `versionLine` too.

### 4.5 `apps/Screener.jsx`
Props: `{module: ScreeningModule, appVersion: string, policy: {SITE_SALT, SALT_IS_DEFAULT}, hidden?: boolean, onCapture?(row)}`.
Owned state (all reset by the shell key): `step` (index into `module.steps.screener`), `answers`, `ctx`, `rf` (`{[id]: true}`), `safetyReviewed`, `complaint` (`''` when no phenotypes), `patient` (initialised from `module.demo.patient`), `cohort` rows, `showJson`, `toast`, `copied`.
Derived: `score = useScore(module, answers)`; `activeFlags = module.redFlags.filter(f => rf[f.id])`; `override`, `emergent`; `stepDef = module.steps.screener[step]`; `canContinue = stepDef.kind === 'safety' ? safetyGate(...) : stepDef.requiresPhenotype ? !!complaint : true`; `routingState = buildRoutingState(...)`; `recs = routingRecs(module, routingState, 'screener')`; `gap = gapSignals(module, ctx)`.
Step rendering is a loop over `stepDef.kind`: `safety` → `RedFlagList` grouped by `f.group`, plus the mandatory "none of these apply" control; `domain`/`story` → one `StepCard` per `domainKeys` entry + extras (`PhenotypePicker` when `'phenotypePicker'` ∈ extras and module has phenotypes; `ContextQ` when `'contextItems'`); `result` → `ResultView`.
`SampleRail` sits in the brand row: `<SampleRail cases={module.sampleCases} onLoad={loadSample} onClear={reset}/>`; `loadSample(c)` sets `answers=c.a`, `ctx=c.ctx??{}`, `rf=c.rf??{}`, `complaint=c.complaint??''`, `safetyReviewed=c.safetyReviewed??true`, `step = Object.keys(c.a).length ? lastStep : 0`.
Panel embed: `<ResearchReadinessPanel research={module.research} moduleId={module.id} project={module.research.projectKey} score={total} ceiling scorable band domains coverage sex gender phenotype={complaint} redFlags={activeFlags.map(f => f.points)} itemIds={allItems(module).map(i=>i.id)} reverseItemIds={negative items} capturedRows={cohort} instrumentVersion={module.versions.instrument} modelVersion={\`${module.id}-prototype-${appVersion}\`} />`.
Capture: `screenToCohortRow(module, {patient, answers, ctx, score, activeFlags, complaint}, {appVersion, salt: policy.SITE_SALT})` (D7 ctx fix). Filenames: `${module.id}-pilot-cohort-<date>.csv`, `${module.id}-questionnaire-v${instrument}.json`, `${module.id}-cds-hooks.json`, `${module.id}-data-dictionary.json`.
No literal in the file names a domain, item, flag, complaint or brand. `t-css`/grep check: `apps/**` must not contain any id from the MASQUE module (enforced by a test that greps the app sources for every MASQUE item/flag/ctx id and phenotype key).

### 4.6 `apps/Scribe.jsx`
Props: `{module, appVersion, policy: {SITE_SALT, SALT_IS_DEFAULT, REQUIRE_SAFETY_REVIEW_TO_SIGN}, hidden?}`.
Owned state: `transcript` (from `module.demo.transcript`), `cursor`, `playing`, `answers`, `ctx`, `vmp` (info prompt answers), `asked`, `cohort`, `rf` (`{[id]: 'nlp'|'md'|'probe'}`), `safetyReviewed`, `probeAns`, `probeNotes`, `input`, `view`, `toast`.
Derived: `extractor = useMemo(() => module.lexicon && createExtractor(module.lexicon), [module])`; `score = useScore`; `complaint = derivePhenotype(module, answers)`; `active = activeDomains(module, {answers, complaint})`; `suggestions = rankSuggestions(...)`; `probes = module.probes ? truncateProbes(liveProbes(module.probes.list, answers, rf, probeAns), 2) : []`; `routingCleared = routingGate({override, safetyReviewed})`; `recs = routingCleared ? routingRecs(module, state, 'scribe') : []`; `canSign = signGate({safetyReviewed})`.
`skipPrompt(s)`: scored → **no write** (D7); info → `vmp[id] = 'skip'`. Probe "re-asking" shows `itemById(module)[p.rescues].short` (D7). Capture tags via `captureLabel`. Note via `buildNote(module, …)`. Bundle via `buildBundle(module, {…, referralCleared: routingCleared, note})`. Panel embed as Screener with `modelVersion = \`${module.id}-scribe-prototype-${appVersion}\``. Absent `module.lexicon` hides the transport/typing capture affordances (probes and prompts still work by clicking); absent `module.probes` hides the probe rail.

### 4.7 `apps/PatientCompanion.jsx`
Props: `{module, locale: string, appVersion, hidden?}`. The shell owns the locale; the app renders its own toggle **only** as a controlled proxy (`onLocaleChange` prop) so the toggle keeps its current in-page position for users while state lives in the shell.
Owned state: `sec` (index into the shell-built patient step list `[intro, ...module.steps.patient, summary]`), `a` (answers incl. `'unsure'`), `ctx`, `rf`, `safetyDone`.
Derived: `L = resolveLocale(module, locale)`; `t = L.ui`; `flags = module.redFlags.map(f => ({id: f.id, tier: f.tier, ...flagCopy(module, locale, f.id)}))` — the object handed to `Safety` and `Summary` contains no `points`/`action` by construction; `urgent = flags.some(f => rf[f.id] && f.tier === 'emergent')` displayed via `TIER_DISPLAY`; `summary = buildPatientSummary(module, locale, {a, ctx, flags: flags.filter(f=>rf[f.id]), urgent})`.
Sections: `intro` (shell copy from `t` + `L.ui.forYouIf`), `safety`, `story` (`domainKeys` items + `contextItems` extra with `ctxCopy`), each `domain` step (`QBlock` for every key in `domainKeys`, lede from `L.domains[key].blurb`), `summary`. Never imports `engine/scoring.js` (CLAUDE.md: no score in the patient app; the test asserts the Patient module graph excludes `scoring.js` and `fhir.js`).
Export: `summaryText(module, L, summary, {appVersion})` + shell caveat + (if `!L.reviewed`) `CAVEATS.unreviewedTranslation[locale]`.

### 4.8 `apps/ResearchReadinessPanel.jsx` (backward-compatible, §4.1 #13, risk 10)
Props (all optional except that one of `research`/`project` must resolve):
`{research?: Research, moduleId?: string, project?: string, score=0, band=null, domains={}, coverage=0, sex=null, gender=null, signalQuality=null, scorable=true, ceiling=null, phenotype='', modelVersion, redFlags=[], itemIds=[], reverseItemIds=[], capturedRows=[], instrumentVersion=null}`.
Resolution: `cfg = research ?? panelProject(project)`; unknown `project` → renders an error card "Unknown research project '<key>'" and nothing else (the silent `|| PROJECTS.MASQUE` fallback L798 is removed — an unknown key now fails loudly; VOICED/BREATHE keep working through `PANEL_PROJECTS`). `band` default becomes `null` (L783 assumed `'low'`); when `null` the panel renders '—' and treats the screen as not scorable for the decision line. `modelVersion` default `\`${cfg.projectKey.toLowerCase()}-prototype-unversioned\``. `normalizeRows` takes `cfg.scoreAliases` (engine aliases `score`, `index` always). `FAIRNESS_POLICY` merged with `cfg.fairnessPolicyOverride` only when attributed. Fairness axes from `cfg.fairnessAxes` (buttons generated). Artifact key/ETL name from cfg. Manifest/model card gain `moduleId` and `instrumentVersion` (D5). Filenames `${moduleId ?? projectKey.toLowerCase()}-…`. "Load demo cohort" dropdown over `cfg.demoCohorts` → `makeCohort(spec, {module})` next to "Restore demo". `reverseItemIds` replaces the host's exclusion-by-convention for Cronbach. `FAIRNESS_POLICY`, `ABSTAIN_FLOOR` stay defined in the panel file (import order invariant) and are re-exported; `engine/policy.js` imports `ABSTAIN_FLOOR` from the panel to keep one definition.

### 4.9 `apps/parts/SampleRail.jsx`
Props: `{cases: SampleCase[], onLoad(case), onClear(), compact?}`. Renders one button per case: `iconByName(c.icon)` + `c.buttonLabel`, `title={c.why ?? c.label}`; a trailing "Clear". Renders nothing when `cases` is empty.

### 4.10 State ownership summary

| State | Owner | Reset on module change | Reset on tab change | Persisted |
|---|---|---|---|---|
| moduleId, tab | shell | — | — | sessionStorage |
| locale | shell | yes (→ defaultLocale) | no | sessionStorage per module |
| walkthrough | shell | yes | no | no |
| Screener/Scribe/Patient screen state | each app | yes (key) | no (hidden, mounted) | no |
| cohort rows (per app) | each app | yes | no | no |
| panel uploads (rows, popArtifact, axis) | panel instance | yes | no | no |

---

## 5. Appendix §5 rows → new mechanism

Every row of inventory §5, all files. "Mechanism" names the module field (§2) or engine vocabulary (§0/§3) that replaces the literal. Line = old line.

### 5.1 Screener

| Line | Old branch | Mechanism |
|---|---|---|
| 83-92 | STEPS keys | `module.steps.screener[].{kind, domainKeys, extras, requiresPhenotype}`; Screener loops over it (§4.5) |
| 290 | SAMPLE_CASES.redflag `rf: {rf_asym:true}` | `sampleCases[].rf` data; loaded by `SampleRail` |
| 499 | CDS example detail hand-copies rf_asym.action | `cds.examples.redFlagPresent.flagId = 'rf_asym'` → `buildCdsHooks` interpolates `redFlags[flagId].action` |
| 527 | `ITEMS.discriminators.max` | `negativeMin(module)` |
| 874 | `ctx.c_clin === "3+"` | `contextItems[c_clin].options['3+'].signal = true` → `gapSignals` |
| 875 | `ctx.c_dur === ">12mo"` | same, option `'>12mo'` |
| 876 | `ctx.c_dismiss === "yes"` | same, option `'yes'` |
| 882 (897, 1230, 1332, 1561) | `f.tier === "emergent"` | engine `TIERS` vocabulary; `emergent = activeFlags.some(f => f.tier === TIERS[0])` in engine helper `flagUrgency(activeFlags)` |
| 888 | `stepKey === "safety"` / `"intake"` | `stepDef.kind === 'safety'` → `safetyGate`; `stepDef.requiresPhenotype` |
| 914 (1340, 1455) | `band !== "low"` | `RoutingState.strong` = `band !== lowestBand`; `referralGate` |
| 915 | `complaint === "sinonasal" \|\| "both"` | rule predicate `s.matches('sinonasal')` with `both.alsoMatches` |
| 916 | `complaint === "otologic" \|\| "both"` | `s.matches('otologic')` |
| 922 | `domains.vestibular.pct >= 50` | routing rule `vestibularMigraine.when: s => s.matches('otologic') && (s.strong \|\| s.domains.vestibular.pct >= 50)` (module data) |
| 927 | `domains.neuro.pct >= 50` | routing rule `neuroOverlay.when` |
| 934 | `answers.v_aural === "yes"` | routing rule `tinnitus.when` |
| 941 | `domains.discriminators.pts < 0` | routing rule `competing.when: s => s.negativePts < 0` (`negativePts` is engine-computed over negative domains) |
| 943 | `Math.abs(domains.discriminators.pts)` | template `p: s => …${Math.abs(s.negativePts)}…` |
| 944 | `ITEMS.discriminators.items.filter(answers==='yes')` | `s.negativeItemsYes` (engine) → chips template |
| 994-997 | `loadSample("sinonasal"…)` + labels | `SampleRail` over `sampleCases[].buttonLabel` |
| 1086 | `<QGroup domainKey="recalcitrance">` | step `intake` `{kind:'story', domainKeys:['recalcitrance'], extras:['phenotypePicker'], requiresPhenotype:true}` |
| 1090 | `<StepCard dk="migraine">` | step `{kind:'domain', domainKeys:['migraine']}` |
| 1091 | vestibular | step data |
| 1092 | neuro | step data |
| 1094 | discriminators | step data |
| 1101 | impact + `<ContextQ>` | step `{kind:'domain', domainKeys:['impact'], extras:['contextItems']}` |
| 1191-1193 | ContextQ rows | `ContextQ` renders `module.contextItems` |
| 1344 | `complaint === "otologic" ? "otologic" : "sinonasal"` | `Phenotype.cdsCardKey` (`both` → `'sinonasal'`) + `cds.previewByPhenotype` |
| 1450 | `{low:"L", moderate:"N", high:"H"}[band]` | engine `BAND_INTERP` |
| 1456 | specialty by complaint | `phenotypes.vocab[].referral.specialty` via `referralFor` |
| 1577 | referral reason by complaint | `phenotypes.vocab[].referral.reason` |

### 5.2 Scribe

| Line | Old branch | Mechanism |
|---|---|---|
| 452 | `ITEMS.discriminators.max` | `negativeMin(module)` |
| 771 | sin = r_abx/r_surg yes ∨ m_head answered | `phenotypes.signals.sin: s => s.yes('r_abx') \|\| s.yes('r_surg') \|\| s.answered('m_head')` |
| 772 | oto = any v_* answered ∧ ≠ 'no' | `phenotypes.signals.oto: s => ['v_vertigo','v_motion','v_aural','v_head'].some(id => s.answered(id) && !s.no(id))` |
| 773 | both / otologic / sinonasal | `phenotypes.derive` ordered array with fallback = `default` |
| 781 | base active set | `phenotypes.activation.always` |
| 782 | otologic/both → vestibular | `activation.rules[0]` (`when: s => s.matches('otologic')`, `domains:['vestibular']`) |
| 783 | n_burn/n_viral → neuro | `activation.rules[1]` |
| 786 | `active.has("vestibular")` | `infoPrompts[].gateDomain` and `phenotypes.tagBoostDomain` checked against the engine-computed active set |
| 790 | `vestActive && VMPATHI_TAG[a.id]` | `item.tag` present ∧ `active.has(tagBoostDomain)` inside `rankSuggestions` |
| 796 | `it.domain === "vestibular" ? "vestibular" : label.toLowerCase()` | `item.tag ? \`${tag.group} · ${tag.label}\` : (domain.shortTag ?? domain.label.toLowerCase())` |
| 800 | `if (vestActive) for VMPATHI_INFO` | `infoPrompts.filter(p => active.has(p.gateDomain) && vmp[p.id] === undefined)` |
| 836-838 | gap markers | `contextItems` signal options (as 5.1) |
| 844 (1000, 1215, 1306) | `tier === "emergent"` | `TIERS` vocabulary / `flagUrgency` |
| 1027 | kind order list | `PROBE_KIND_ORDER` |
| 1035-1037 | per-kind suffix copy | `PROBE_KIND[kind].caption` (engine, English UI copy; localisable later via shell) |
| 1158 | `startsWith("rf_")` | `capture.kind === CAPTURE_KIND.redflag` (ingest keeps `kind`; L737 drop removed) |
| 1159 | `startsWith("c_")` | `capture.kind === CAPTURE_KIND.ctx` |
| 1160 | ctx label map | `contextItems[].shortLabel` |
| 1168-1178 | shortLabel ×30 | `item.short` |
| 1185 | sinonasal/both | rule predicate `matches('sinonasal')` (same routing array as Screener, surface 'scribe') |
| 1186 | otologic/both | `matches('otologic')` |
| 1188 | vestibular.pct ≥ 50 | routing rule |
| 1189 | neuro.pct ≥ 50 | routing rule |
| 1190 | v_aural yes | routing rule |
| 1191 | discriminators.pts < 0 | `negativePts` |
| 1202 | `VMPATHI_INFO.find(i => i.id === k)` + `.replace("VM-PATHI · ","")` | `infoPrompts` lookup; note prints `tag.label` (group stripped structurally) |
| 1204-1206 | ctx note phrases | `contextItems[].noteLabel` for fired signal options, in `contextItems` order (old order was dur, clin, dismiss — see CHANGELOG entry; `noteOrder` optional field on ContextItem preserves the old order: `noteOrder: 2,1,3` — Q10) |
| 1256 | interp map | `BAND_INTERP` |
| 1259 | specialty by complaint | `referralFor(module, complaint).specialty` |
| 1311 | referral reason | `referralFor(module, complaint).reason` |

### 5.3 Patient

| Line | Old branch | Mechanism |
|---|---|---|
| 383, 405 | UI.sections[3..7] index-aligned | `locale.domains[key].label`; shell builds the section list from `steps.patient` |
| 437 | SUM.migWords keyed by ids | stays a locale table `sum.migWords` (copy, keyed by item id); accessed only through `state.words('mig','migWords')` in module rules — the engine never names the key |
| 443 | SUM.vWords | same, `words('vOther','vWords')` |
| 445 | SUM.nWords | `words('neu','nWords')` |
| 449, 457 | SUM.dWords / dShort | `words('disc','dWords')`, `words('disc','dShort')` |
| 523-529 | CONTEXT_Q ids | `module.contextItems` values + `locale.contextItems[id]` labels |
| 535-539 | SECTIONS keys | `module.steps.patient[]` |
| 655 (829, 837, 838, 1023, 1024) | `tier === "now"` | `f.tier === TIERS[0]` via `TIER_DISPLAY`; module never says now/soon |
| 656 | `key === "safety"` | `stepDef.kind === 'safety'` → `safetyGate` |
| 720 | `<QBlock domain="recalcitrance">` inside story | step `story {kind:'story', domainKeys:['recalcitrance'], extras:['contextItems']}` with `locale.steps.story.lede` |
| 726 | `[five keys].includes(key)` | `stepDef.kind === 'domain'` |
| 729 | `BLURB[key]` | `locale.domains[key].blurb` |
| 910 | `yes("r_dur")` | said rule `{id:'dur', when: s => s.yes('r_dur'), text:'dur'}` |
| 911 | r_abx | said rule `abx` |
| 912 | r_surg | said rule `surg` |
| 913 | r_normal | said rule `normal` |
| 914 | r_lesion | said rule `lesion` |
| 916 | `scale("m_head")`, `scale("m_dur")` | `s.scale(id)` on PatientState |
| 917 | `mHead > 0` | said rule `headFreq {when: s => s.scale('m_head') > 0, text: s => s.S.headFreq(s.scale('m_head'))}` |
| 918 | `mDur === 2` | said rule `durTypical {when: s => s.scale('m_dur') === 2}` (index kept; `item.symbol` lets the author write `s.scaleIs('m_dur','typical')` — optional) |
| 919 | mig group | `patientSummary.groups.mig` |
| 920, 940 | `mig.length >= 2` | said rule `migWith {when: s => s.n.mig >= 2, text: s => s.S.migWith(s.words('mig','migWords'))}`; derived `migPattern` |
| 922-923 | v_vertigo → vertigoT | said rule `vertigo {when: s => s.scale('v_vertigo') > 0, text: s => s.S.vertigo(s.S.vertigoT[s.scale('v_vertigo')])}` |
| 924 | v_count | said rule `vCount` |
| 925 | v_migfeat | said rule `vMig` |
| 926 | vOther group | `groups.vOther`; said rule `vAlso {when: s => s.n.vOther > 0}` |
| 929 | neu group | `groups.neu`; said rule `neuro {when: s => s.n.neu > 0}` |
| 932-934 | i_days / i_role → daysT/roleT | said rules `days`, `role` (`when: scale > 0`) |
| 936 | disc group | `groups.disc`; said rule `disc` |
| 940 | migPattern | `derived.migPattern: s => (s.scale('m_head') ?? 0) > 0 && (s.n.mig >= 2 \|\| s.scale('m_dur') === 2)` |
| 941 | vestPattern | `derived.vestPattern: s => s.scale('v_vertigo') === 2 \|\| s.yes('v_count') \|\| s.yes('v_migfeat')` |
| 945-953 | ask tree | ordered ask rules: `askBoth {when: s => s.migPattern && s.n.disc > 0}`, `askMig {when: s => s.migPattern && s.n.disc === 0}`, `askVest {when: s => s.vestPattern}`, `askRefer {when: s => s.migPattern \|\| s.vestPattern}`, `askNeuro {when: s => s.n.neu >= 2}`, `askNormal {when: s => s.yes('r_normal') \|\| s.yes('r_lesion')}`, `askDisc {when: s => s.n.disc > 0, text: s => s.S.askDisc(s.words('disc','dShort'))}`, `askTried {when: s => s.yes('r_abx') \|\| s.yes('r_surg')}`, `askNext {}` |
| 949 | `neu.length >= 2` | `askNeuro.when` |
| 950 | r_normal ∨ r_lesion | `askNormal.when` |
| 952 | r_abx ∨ r_surg | `askTried.when` |
| 955 | gapCount on three ctx values | `gapSignals(module, ctx).count >= gapRule.threshold` |
| 957 | `S.gap(three booleans)` | `S.gap(gap.signals)` (signature change logged) |
| 967 | `it.scale && v === 0` skip | engine `buildPatientSummary` clin loop (answer convention: index 0 = none) |

### 5.4 ResearchReadinessPanel

| Old | Mechanism |
|---|---|
| `band = "low"` default L783 | default `null`; '—' rendering |
| axes 'sex'/'gender' L533, L648, L775-776, L823, L827, L967 | `research.fairnessAxes` (first = default axis) |
| score aliases L197, L216 | `research.scoreAliases` merged once into `normalizeRows(rows, cfg)` |
| `parsed.masqueArtifact` L864 | `research.artifactKey` |
| `PROJECTS[project] \|\| PROJECTS.MASQUE` L798 | `research` prop ?? `panelProject(project)`; unknown → error card |

### 5.5 Simulator (retired; rows map to where the salvaged data lands)

| Line | Old | Mechanism |
|---|---|---|
| 320 | SCENARIOS.partial answers | `sampleCases.partial.a` |
| 326 | SCENARIOS.redflag rf_asym | merged into existing `sampleCases.redflag` (same flag, same purpose); Simulator's `high` becomes `sampleCases.high.a = FULL_HIGH` |
| 329 | SCENARIOS.ruleout x_* | `sampleCases.ruleout.a` |
| 317-329 | `step: 6` | `SampleRail` jumps to the result step when `a` non-empty |
| 397-398 | `.tier.emergent/.urgent` CSS | shell CSS classes `.mx-tier-emergent/.mx-tier-urgent` generated from `TIERS` |
| 467 | STEP_DOMAIN | `steps.screener` |
| 480, 499, 532, 550, 556, 637, 640 | step index literals | `stepDef.kind` |
| 537, 552 | Items recalcitrance / discriminators | step data |
| 546-547 | domain intros by step index | `Step.intro` |
| 614 | `band !== "low"` | `strong` |
| 616 | `band === "high"` | `band === highestBand` (used only in the CDS preview; MASQUE preview copy keyed by phenotype instead) |
| 685, 689-690, 784 | axes | `research.fairnessAxes` |
| 892-915 | PITEMS subset | dropped — Patient locale copy is the complete 30-item set (§2 row 9 canonical) |
| 931-943 | patient ask rules subset | dropped — `patientSummary.ask` is the full Patient tree |
| 954, 958 | locale list / Spanish banner | `localesOf(module)`; caveat is shell |
| 1004 | "the migraine question" rail copy | `copy.walkthrough.patient[]` |
| 1020-1026 | LINES | dropped (Scribe SCRIPT canonical) |
| 1029-1039 | CUES | dropped (module lexicon is the full one) |
| 1041 | NEG | dropped (`lexicon.negation`) |
| 1080-1304 | probe whens/targets | `module.probes.list` (single copy) |
| 1332 | 14-char window | `lexicon.negation.window` |
| 1340 | `!c.id.startsWith("c_")` | `capture.kind` |
| 1400, 1494-1497, 1517-1544 | rail copy | `copy.walkthrough.scribe[]` |
| 1409, 1413-1420, 1422, 1454 | kind order, captions, truncation | `PROBE_KIND_ORDER`, `PROBE_KIND[k].caption`, `PROBE_KIND[k].truncate` |
| 1432 | raw `p.rescues` | `itemById(module)[p.rescues].short` |

### 5.6 Extraction / 5.7 Probes
No engine branch on an id remains; the content entries listed in §5.6/§5.7 move verbatim into `modules/masque/lexicon.js` and `modules/masque/probes.js`. Engine kind literals (`'redflag'|'item'|'ctx'`, `unnegated === undefined ? 'no' : 'yes'`, `p.kind === 'phenotype'`) become `CAPTURE_KIND`, `ANSWER.yes/no`, `PROBE_KIND[k].mayWrite`.

---

## 6. Parity harness (D10) — `app/tests/`

### 6.1 Importing the 0.3.1 code at runtime (`refImport.js`)

The reference files are never edited. The harness fetches their text, rewrites it in memory, compiles with the page's Babel, and blob-imports it — the same mechanism as `masque-loader.js`, extended with a `rewrite(source)` step and an `append` string.

Reference base URL: `new URLSearchParams(location.search).get('ref')` → else `'../../reference/fixed-src/'` (serve the repo root: `python -m http.server 8901` from `C:\Users\User\Documents\MASQUE`, open `/app/tests/`) → on the deployed site `'/masque/demo/src/'` (the untouched prototype ships the same files, D12). The page shows which base it resolved and the SHA-256 of each fetched file next to the expected hash recorded in `refImport.js` (`EXPECTED_SHA256`), so a run against a drifted reference is reported as INVALID rather than as a parity failure.

Per file:

| File | Rewrite | Appended exports |
|---|---|---|
| `MASQUE_Screener_v0_3.jsx` | (1) replace `import React, { useState, useMemo, useEffect } from "react";` (exact first import line, asserted) with `import React from "react"; const useState = React.useState, useEffect = React.useEffect; const useMemo = (f) => f();` — the "hook-neutralising rewrite": `useScore(answers)` becomes a plain function; components are never rendered. (2) replace `import ResearchReadinessPanel from "./ResearchReadinessPanel.jsx";` with `const ResearchReadinessPanel = () => null;` (the panel is not needed and would otherwise be compiled twice). (3) `globalThis.ctx = {}` is set by the harness before calling old `screenToCohortRow` so the L585 free identifier resolves and yields `visit_label: ''` — this is how the old row is obtained without touching the bug. | `export { INSTRUMENT_VERSION as OLD_INSTRUMENT_VERSION, APP_VERSION as OLD_APP_VERSION, QUESTIONNAIRE_URL, STEPS, RED_FLAGS, ITEMS, DOMAIN_ORDER, ALL_ITEM_IDS, SAMPLE_CASES, DEMO_PATIENT, BAND_CUTS, scoreItem, bandFor, itemBounds, useScore, buildQuestionnaire, buildCdsHooks, buildDataDictionary, screenToCohortRow, rowsToCsv, subjectPseudonym, buildBundle };` plus **sliced closures** (below) `export function __oldRecs(s) {…}` and `export function __oldGapFlags(ctx) {…}` |
| `MASQUE_Scribe_v0_3.jsx` | same react rewrite (`useRef` added); panel stub; extraction/probes imports left intact (they resolve through the same blob graph, so old `extract`/`liveProbes` are also the old code) | `export { ITEMS as S_ITEMS, RED_FLAGS as S_RED_FLAGS, ASK, VMPATHI_TAG, VMPATHI_INFO, BAND_CUTS as S_BAND_CUTS, computeScore, buildQuestionnaire as s_buildQuestionnaire, buildCdsHooks as s_buildCdsHooks, buildDataDictionary as s_buildDataDictionary, screenToCohortRow as s_screenToCohortRow, buildRecs, buildNote, buildBundle as s_buildBundle, capLabel, shortLabel, SCRIPT, PATIENT };` + sliced `__oldComplaint(answers)`, `__oldActive(answers, complaint)`, `__oldSuggestions(...)` |
| `MASQUE_Patient_v0_3.jsx` | react rewrite (`useMemo`, `useState`) | `export { ITEMS as P_ITEMS, P, ES_P, ES_RF, RED_FLAGS as P_RED_FLAGS, UI, SUM, CONTEXT_Q, SECTIONS, BLURB, BLURB_ES, REVIEWED, buildSummary, askForm, list, summaryText, pFor, rfFor };` |
| `MASQUE_Extraction.js` | none | none needed (already exports) |
| `MASQUE_Probes.js` | none | none needed |
| `ResearchReadinessPanel.jsx` | react rewrite | `export { PROJECTS, FAIRNESS_POLICY, normalizeRows, metrics, calibration, fairness };` (used only by the demo-cohort and manifest checks) |
| `MASQUE_Simulator.jsx` | react rewrite | `export { makeCohort, COHORTS, SCENARIOS, FULL_HIGH };` (for the demoCohort parity and sample merge check) |

**Sliced closures.** Logic that lives inside a component's `useMemo` (Screener `recs` L891-952, `gapFlags` L873-878; Scribe `complaint` L770-774, `suggestions` L780-803) is lifted textually: `slice(source, startMarker, endMarker)` takes the text between two exact anchor strings (e.g. start `const recs = useMemo(() => {`, end `}, [band, complaint, domains, answers, scorable, answered, floor, ceiling, override, emergent, activeFlags]);`), asserts the slice's SHA-256 against a constant, and wraps it: `export function __oldRecs({override, emergent, activeFlags, scorable, answered, floor, ceiling, domains, band, complaint, answers}) { <slice body with the useMemo wrapper removed: 'const out = []; … return out;'> }`. The parameter list is exactly the free variables the inventory lists for that block. A hash mismatch fails the run as INVALID.

### 6.2 Golden parity (`t-golden.js`)

Inputs are fixed: `now = '2026-01-01T00:00:00.000Z'` and `date = '2026-01-01'` are passed to the new builders and the old outputs are normalised by replacing any ISO timestamp / `YYYY-MM-DD` with the same constants; `screen_id` and `Bundle.timestamp`/`authored`/`effectiveDateTime`/`date`/`period.start`/`authoredOn` are normalised likewise; `Math.random` is stubbed to a constant during old `screenToCohortRow`.

| Artifact | Old | New | Enumerated allowed differences (applied as JSON-pointer edits to the OLD before deep-equal; anything else is a failure) |
|---|---|---|---|
| Questionnaire | `buildQuestionnaire()` (Screener) and Scribe's (must equal each other — sanity) | `buildQuestionnaire(masque, {date})` | none |
| CDS document | `buildCdsHooks()` | `buildCdsHooks(masque)` | none (generation must reproduce L474-519 byte for byte, including `78/100`, `high likelihood`, `MRI internal auditory canals.`) |
| Data dictionary | `buildDataDictionary()` (Screener) | `buildDataDictionary(masque, {appVersion: APP_VERSION})` | `/instrument/appVersion` `"0.3.0"→"0.4.0"`; `/canonicalCohortFields` gains `{name:'module_id', …}` after `captured_at`-equivalent position (index 0, since the old list starts at `score`) and `{name:'complaint', …}` before `coverage` — the test removes exactly these two entries from the new list and then requires equality; also the two new entries' `type` strings are asserted literally. Scribe's dictionary (lacking subject_id/visit_label/gender) is *not* a golden — it is recorded as a superseded variant. |
| Cohort row | `screenToCohortRow({patient, answers, total, coverage, scorable, band, activeFlags, complaint})` with `globalThis.ctx = {}` for each of the 4 sample cases + empty answers | `screenToCohortRow(masque, {…, ctx: {}}, {appVersion, salt, now, id})` | `/app_version`; `/screen_id` normalised to `masque-<fixed>`; new row has `module_id: 'masque'` (removed before compare, asserted separately); column **order** compared too (old key order + `module_id` inserted after `captured_at`). |
| FHIR bundle (Scribe surface) | Scribe `buildBundle({…, routingCleared, note})` | `buildBundle(masque, {…, referralCleared: routingCleared, note})` | none, over: 4 sample cases × routingCleared ∈ {true,false} × scorable/unscorable (empty answers) × with/without rf_asym. |
| FHIR bundle (Screener surface) | Screener `buildBundle({…})` | `buildBundle(masque, {…, referralCleared: !override})` (no `note`) | (a) old `/entry/…/Observation/component[attainable-range]/valueRange/low/value` = total → new = floor (D7); (b) old referral `reasonCode[0].text` "(band likelihood)" → new "(band)" (Scribe wording adopted — Q9); (c) new omits nothing / old has no DocumentReference — equal. Compared over the same matrix. |
| Data dictionary items / Questionnaire linkIds vs module | — | assert set equality of item ids, group linkIds, flag ids with `OLD ALL_ITEM_IDS`, `DOMAIN_ORDER`, `RED_FLAGS.map(id)` (D4) |
| Identifier constants | literal strings in the old source (regex-extracted): `masque.example/codes`, `/answer`, `/criteria`, `masque-index`, `masque-screen`, `masque-safety`, `MASQUEScreener`, `Project MASQUE — TOPx prototype` | `masque.fhir.*`, `masque.cds.*` | none |
| CSV header | `rowsToCsv([oldRow])` header | `cohortTemplateCsv(masque)` | `module_id` column inserted; `complaint` present in both (old row emitted it) |
| Patient summary text | `summaryText(oldSummary, UI.en)` / es | `summaryText(masque, L, newSummary, {appVersion})` | footer version line (`MASQUE v0.3.0` → shell `versionLine`); clinNote `${name}` substitution yields identical text |
| Scribe note | `buildNote(old input)` | `buildNote(masque, input)` | `patient.sex[0]` guard produces identical output for the demo patient; "Instrument v0.3 candidates." line identical unless Q7 is decided otherwise |
| Demo cohorts | Simulator `makeCohort(kind)` for balanced/unlabeled/disparate | `makeCohort(masque.research.demoCohorts[k].spec)` | none if the LCG is ported verbatim; if the spec-driven generator cannot reproduce the LCG stream, the test degrades to distributional assertions (n, labeled fraction, per-group shares ±0, score range) and the CHANGELOG records that demo cohorts are regenerated, not identical — Q11 |

### 6.3 validateModule (`t-validate.js`)
(a) `validateModule(m).errors.length === 0` for every entry of `SCREENING_MODULES` and for the template; warnings printed. (b) Mutation cases: 30 deliberately broken copies of the template (one per assertion group in §3.13) each produce ≥ 1 error whose `path` starts with the mutated field — this is what proves the validator gives useful authoring feedback rather than a generic failure. (c) `validateModule` on a structurally different module (template: 2 domains, no negative, no phenotypes, en only) returns zero errors *and* every engine function in §3 runs on it (`t-shape.js`), including `buildBundle` without a referral, `routingRecs` with `matches()` never true, `derivePhenotype → ''`, `activeDomains → all`, `buildPatientSummary` with the single mandatory ask rule, `buildCdsHooks`, `screenToCohortRow`.

### 6.4 Scoring sweep (`t-scoring.js`)

- PRNG: `mulberry32(0x4d415351)` ("MASQ"). Fixed forever; the report prints the seed.
- N = 50,000 answer sets (browser: ~1–2 s). Generator per item: `u < 0.25` → unanswered; else scaled → uniform index in `[0, scale.length)`, boolean → `'yes'|'no'` uniform. Additionally the four sample cases, the empty set, the full-high set, "all no / all zero", "only negative domain answered", "everything but one negative item" are appended as deterministic edge cases (they exercise the floor/ceiling straddle).
- Old: `useScore(answers)` (Screener, hook-neutralised) and `computeScore(answers)` (Scribe) — both compared to new `computeScore(masque, answers)`.
- Comparison keys, exact equality: `total, floor, ceiling, coverage, scorable, band, answered, count`; per domain `pts, max, pct, label, openPts, negative`; `open.map(i => i.id)` (order — identical stable sort on identical input order); `scoreItem` and `itemBounds` per item over every value.
- Pass: zero mismatches. First 20 mismatches are printed with the answer set as JSON so they can be replayed.

### 6.5 Rule parity (`t-rules.js`)

State generation reuses the scoring sweep stream (first 20,000 sets) plus, per set, `complaint` uniform over `['sinonasal','otologic','both']`, `ctx` per context item uniform over its options ∪ undefined, `rf` empty with p 0.85 else one random flag, `safetyReviewed` true with p 0.9. Patient inputs use a second generator where each item is `undefined`/`'unsure'`/value with p 0.15/0.10/0.75 and ctx over the **aligned** values (the old Patient CONTEXT_Q values `'1'|'2'|'<6mo'|'6-12mo'` are not generated; the gap-relevant values `'3+'`, `'>12mo'`, `'yes'` are identical in both vocabularies, and the non-signal values only need to be non-signals — the test also feeds the old function the old non-signal values and asserts the gap line is unaffected).

| Family | Old | New | Keys compared |
|---|---|---|---|
| Screener routing | `__oldRecs(state)` | `routingRecs(masque, buildRoutingState(...), 'screener')` | `map(r => [r.h, r.p, r.chips])` deep-equal (includes override/incomplete engine recs) |
| Scribe routing | `buildRecs(band, complaint, domains, scorable, answers)` | `routingRecs(masque, state, 'scribe')` filtered to non-gate recs, `[]` when !scorable | same |
| Gap | `__oldGapFlags(ctx)` (labels) and Scribe `gapFlags` behaviour via `buildNote` ctx line | `gapSignals(masque, ctx).labels`, `.alert` | labels array, alert boolean |
| Phenotype | `__oldComplaint(answers)` | `derivePhenotype(masque, answers)` | string |
| Activation | `__oldActive(answers, complaint)` | `activeDomains(masque, {answers, complaint})` | sorted keys |
| Suggestions | `__oldSuggestions({answers, complaint, vmp, scorable})` | `rankSuggestions(masque, …)` | `map(s => [s.id, s.ask, s.tag, s.kind])` — tag strings equal because `${group} · ${label}` reproduces `VM-PATHI · …` |
| Referral | old ternaries (extracted as tiny functions from L1456/L1577 text — a 2-line slice) | `referralFor(masque, complaint)` | specialty, reason |
| CDS preview | slice of L1344 | `cdsIndexCard(masque, state).summary` | string |
| Patient summary | `buildSummary({a, ctx, flags, urgent, loc})` for en and es | `buildPatientSummary(masque, loc, …)` | `said, ask, gapLine, unsureList, clin` deep-equal (clin `t` uses `item.short` — the harness asserts `short === old P_ITEMS c` for every item as a precondition) |
| askForm / list | old | `askForm`, `joinList` | over every item id × locale, and lists of length 1..5 |
| Extraction | old `extract(text, opts)` (Extraction blob) | `extract(masque.lexicon, text, opts)` | over the demo transcript's pt turns, the 44 gold-set utterances (fetched from `reference/MASQUE_v0.3.1/…` when reachable, else skipped with a notice), and 2,000 synthetic utterances built by concatenating 1–3 random phrases from the lexicon with random negation/third-party/historical cues prepended; keys: full output array with `includeSuppressed` true and false, windows 10/14/18 |
| Probes | old `liveProbes(answers, rf, answered)` | `liveProbes(masque.probes.list, …)` | `map(p => p.id)` over the sweep with random `answered` |
| validateProbes | old `validateProbes(itemIds, flagIds)` | new with the module list | old errors ⊆ new errors (new adds rescue/target rules, which MASQUE satisfies: both empty) |

Pass = zero mismatches in every family; per-family counts and first 20 diffs printed. The page's overall verdict is PASS only when 6.2, 6.3, 6.4, 6.5 and `t-css` all pass and no reference hash was INVALID.

### 6.6 Static checks
`t-css.js`: fetch each `apps/styles/*.css.js`, evaluate, parse selectors, assert every rule outside `@keyframes` starts with the app root class (`.mx-screener`, `.mx-scribe`, `.mp`, `.rrp-`-prefixed class) and that no `:root` block exists outside `shell.css.js`. `t-ids.js`: fetch `apps/**` and `engine/**` sources and assert none contains any MASQUE item id, flag id, context id, phenotype key, `masque.example`, `'MASQUE'`, `'Dizziness'` — the mechanical proof that nothing module-specific leaked into generic code.

---

## 7. CSS scoping plan and shell chrome

### 7.1 Tokens
`shell/shell.css.js` defines on `.mx-shell` (not `:root`, so the shell can host inside any page) the union of the four token sets: `--ink --petrol --petrol2 --surface --panel --bg --line --muted --amber --amberbg --coral --coralbg --green --greenbg --slate --mono --sans`. Values are the Screener's (Screener and Scribe share one set; Patient's `--bg` added; the Patient's differing values, if any, are checked at port time and the Screener's win — visual only). `PROBE_KIND` colours already reference these names. The panel keeps its fixed palette (`rrp-`), unchanged.

### 7.2 App stylesheets
Each app's `CSS` string is passed through `scopeCss(css, root)` at module-evaluation time: `.mx-screener` for Screener, `.mx-scribe` for Scribe; Patient keeps `.mp` (already scoped, D11) and the panel keeps `rrp-` (already prefixed). `scopeCss` prefixes every selector in every comma list (`.card, .btn` → `.mx-screener .card, .mx-screener .btn`), descends into `@media`/`@supports`, leaves `@keyframes` bodies and `@font-face` alone, rewrites `*{…}` to `.root *{…}`, and drops any `:root{}` block with a console warning (tokens belong to the shell). App root elements: Screener `<div className="mx-screener mq">` (the old `.mq` kept so unprefixed rules that use `.mq` as an ancestor still match), Scribe `<div className="mx-scribe mq">`. `:focus-visible` and reduced-motion rules are scoped the same way. Duplicated class names between Screener and Scribe (`.card`, `.btn`, `.rec`, `.chip`, `.tier`…) therefore no longer collide (risk 12). Nothing in `.mp` or `.rrp-*` changes byte-wise.

### 7.3 Tier and band classes
Engine-generated: `.mx-band-low/-moderate/-high/-indeterminate` and `.mx-tier-emergent/-urgent` are emitted by the shell stylesheet from `BANDS`/`TIERS` so an app never writes a vocabulary literal in JSX beyond `className={\`mx-tier-${f.tier}\`}`.

### 7.4 Shell chrome
- Top bar (sticky): brand mark, `Screening` wordmark, `ModuleSelect`, `AppTabs` (segmented control, ARIA tablist), `LocaleToggle` (only when applicable), walkthrough toggle (only when `copy.walkthrough[tab]`), all inside `.mx-shell header.mx-top`.
- Caveat strip directly under the top bar: `CAVEATS.prototype` ("Prototype · not for clinical use") always; `CAVEATS.unreviewedTranslation[locale]` when `!L.reviewed` on the Patient tab (also the ⚠ glyph next to the locale button, Patient L685 behaviour).
- Walkthrough rail: right-hand column at ≥ 1100 px, collapsible drawer below; cards `{title, body}` from the module; the rail is inert (no state).
- Footer: `versionLine(module)` + caveat + changelog link + "Prototype served as source; compiled in your browser" note.
- Loading/failure: `masque-loader.js` unchanged; `index.html` status element text becomes "Loading screening application…"; the loader's red panel remains the failure surface. `InvalidModule` is the in-app failure surface for validateModule errors (the loader cannot know about them).
- Print: `.mx-top`, `.mx-caveat` printed (caveat must appear on every printed page — invariant 4), tabs hidden.
- Responsive: shell adds no breakpoints beyond the top bar collapsing to two rows below 820 px; apps keep theirs.

### 7.5 Pages
`app/index.html` is the only page: same import map and Babel tag as today, `<title>Screening · 0.4.0</title>` replaced at runtime by the shell, `noindex, nofollow`, `boot({entry: './src/shell/App.jsx'})`. The four per-app pages are deleted (their content is reachable through the tabs); `.htaccess` gains 301s from `screener.html` etc. to `index.html#tab=screener` — Q12 (lead handles deployment, but the redirects belong in `app/`). `app/tests/index.html` carries the same import map plus `<script type="module" src="./harness.js">`; it is deployed alongside (`/masque/app/tests/`) with `?ref=/masque/demo/src/` prefilled by a link on the page.

---

## 8. Migration order and work packages

### 8.1 Preconditions for parallel work
Two things must exist before anyone else starts, in this order:

1. **WP0 Contract & scaffold** (one implementer, first): `engine/contract.js` (§2 typedefs, key lists), `engine/vocab.js`, `engine/policy.js`, `engine/prng.js`, `engine/icons.js`, `engine/download.js`, `modules/registry.js` (stub that imports `modules/masque/index.js`), `modules/_template/module.js` + README, `engine/validateModule.js` **skeleton** (shape checks 1-5, 35, 39-42 only; the rest are `TODO` entries returning warnings), `app/tests/index.html` + `harness.js` + `refImport.js` (fetch/rewrite/append/hash — verified against the 7 files), and `app/index.html` booting an `App.jsx` that renders a placeholder with the dropdown. Acceptance: `validateModule(template)` runs; `refImport` blob-imports all seven files and the exported old functions are callable (`useScore({})` returns a Score).
2. **WP1 MASQUE module extraction** (one implementer, immediately after WP0; the other packages may start on WP0 + the template but their acceptance needs WP1): every file under `modules/masque/`, `CHANGELOG.md` with each D6 reconciliation and D7 fix, `README.md`. Acceptance: `t-validate` zero errors; identifier constants equal the regex-extracted 0.3.1 literals; `short === Patient it.c` and `ask === Scribe ASK[id]` for all 30; sample cases ⊇ 4 Screener + 5 Simulator (8 after merging redflag); every `sum` template function is a byte-identical move; git-style diff of moved blocks against the reference shows only syntactic wrapping.

Everything from WP2 on runs in parallel once WP0 is merged (and rebases onto WP1 when it lands, typically a day later).

### 8.2 Packages

| WP | Owned files | Depends on | Must provide | Acceptance |
|---|---|---|---|---|
| **WP2 Scoring & rules engine** | `engine/scoring.js`, `engine/rules.js`, `engine/patientSummary.js`, `engine/gates.js`, `engine/locale.js`, `apps/parts/useScore.js`, full `engine/validateModule.js` | WP0; WP1 for parity | §3.1-3.5, 3.11-3.13 signatures exactly; state shapes of §3.3 frozen in dev | `t-scoring` 50k PASS vs old useScore+computeScore; `t-rules` routing/gap/phenotype/activation/patient/askForm/list PASS; `t-validate` mutation cases (30) each yield a targeted error; template passes with zero errors |
| **WP3 Artifact engines** | `engine/fhir.js`, `engine/cohort.js`, `engine/extraction.js`, `engine/probes.js`, `engine/scribe.js` | WP0; WP1 for goldens | §3.6-3.10 signatures | `t-golden` all rows PASS with only the enumerated differences; extraction and probe families in `t-rules` PASS; `makeCohort` reproduces Simulator cohorts or the documented degradation (Q11) |
| **WP4 Screener app** | `apps/Screener.jsx`, `apps/parts/{SampleRail,StepCard,QGroup,ContextQ,ResultView,RedFlagList,Meter,DomainBars,RecList,CdsPreview,PilotCapture}.jsx`, `apps/styles/screener.css.js` | WP0 (+ template module for dev), WP2/WP3 interfaces (can start against the §3 signatures with stubs) | `Screener({module, appVersion, policy, hidden, onCapture})` | Manual parity script (8 sample cases, each step, capture, downloads, bundle copy) against `/masque/demo/screener.html`; `t-ids` clean; `t-css` clean; renders the template module (2 domains, no picker) without console errors; capture writes `visit_label` without throwing |
| **WP5 Scribe app** | `apps/Scribe.jsx`, `apps/parts/scribe/*.jsx`, `apps/styles/scribe.css.js` | WP0, WP2/WP3 interfaces | `Scribe({module, appVersion, policy, hidden})` | Demo transcript playback yields the same captures/answers/ctx/rf as the 0.3.1 scribe at every cursor position (scripted comparison via old `extract`); skip leaves item unanswered; "re-asking" shows `short`; sign gate; note/bundle equal engine outputs; hides transcript when module has no lexicon (template) |
| **WP6 Patient app** | `apps/PatientCompanion.jsx`, `apps/parts/patient/*.jsx`, `apps/styles/patient.css.js` | WP0, WP2 interfaces | `PatientCompanion({module, locale, appVersion, hidden, onLocaleChange})` | en/es walkthrough equal to `/masque/demo/patient.html` (summary text golden); module graph excludes `scoring.js`/`fhir.js`; no `points`/`action` string reachable (t-shape assertion on rendered text of the safety and summary sections for all 12 flags); works with the template's single locale (toggle hidden) |
| **WP7 Research panel & legacy registry** | `apps/ResearchReadinessPanel.jsx`, `apps/styles/panel.css.js`, `modules/legacy-panel-projects.js`, "Load demo cohort" UI | WP0; WP3 `makeCohort` | Props of §4.8; `PANEL_PROJECTS` behaviour; `FAIRNESS_POLICY` export | Panel renders with `project="MASQUE"` (legacy), `project="VOICED"`, `project="BREATHE"` and with `research={masque.research}`; unknown project → error card; manifest/model card contain `moduleId` + `instrumentVersion`; demo rows and demo cohorts flow through `normalizeRows`; every 0.3.1 prop still accepted with the same default (diff of the destructuring line) |
| **WP8 Shell** | `shell/*.jsx`, `shell/shell.css.js`, `engine/css.js`, `app/index.html`, `.htaccess` redirects | WP0 | `App` per §4.1; `scopeCss`; `versionLine`; `CAVEATS` rendering | Module change resets every app (scripted: fill screener, switch module to the template registered in a test-only registry, switch back → empty); tab switch preserves state; locale toggle only on patient tab; footer shows all six values; `document.title` uses `label`; caveat present on every tab and in print; `t-css` PASS; Lighthouse-free sanity: no horizontal scroll at 375 px |
| **WP9 Test page** | `app/tests/t-*.js`, `harness.js` extensions, hash constants | WP0; consumes WP1-3 outputs | The PASS/FAIL page of §6 | Runs from repo root and from `/masque/app/tests/?ref=/masque/demo/src/`; INVALID on hash drift; every table row of §6.2/6.5 present with counts |

Coupling is limited to: (a) the §2 contract file (WP0), (b) the §3 signatures (documented here; WP4-6 code against them with a local stub until WP2/3 land), (c) `useScore.js` (WP2) used by WP4/5, (d) `SampleRail` (WP4) which WP8's walkthrough does not touch. No package edits another's files; interface changes go through a contract PR that bumps nothing (contractVersion stays 1 until a second module ships).

### 8.3 Order of merges
WP0 → WP1 → {WP2, WP3, WP7, WP8} → {WP4, WP5, WP6} → WP9 finalisation → delete `app/src/MASQUE_*.jsx`, `app/screener.html|scribe.html|patient.html|simulator.html` → lead deploys `/masque/app/` (D12). The 0.3.1 `app/src` copies stay until the last app is ported so the old pages keep working locally during the migration.

---

## 9. Open questions for the clinical lead; self-assessed risks

### 9.1 Open questions (the code will not decide these silently)
- **Q1 Empty red-flag list.** §4.1 #2 says a module with a short/empty list still gets the "none of these apply" step. This design rejects `redFlags.length === 0` at validation (a screening module with no safety content is more likely an authoring error than a decision). Confirm, or lower to a warning with the mandatory step rendered empty.
- **Q2 Routing copy divergence.** Screener recs and Scribe buildRecs share conditions but differ in body text and chips (Scribe shorter; competing rule has no chips in Scribe; no fallback in Scribe). The design keeps both surfaces' text byte-identical to 0.3.1 via per-surface copy. Should they be unified to one text (which one)?
- **Q3 Red-flag `ask` (Scribe L186-235).** Unread today. Kept as data; drop, or wire it as the Scribe safety-tab phrasing?
- **Q4 Referral when a module has no phenotypes.** Design omits the referral ServiceRequest entirely. Alternative: module-level default referral `{specialty, reason}`.
- **Q5 Unreviewed-translation banner wording.** Patient L411 (Spanish reviewBanner) and L421 (export line) become shell-owned caveats (D8). Confirm the shell may own Spanish caveat text, and who reviews it.
- **Q6 Untranslated Patient chrome (§2 row 9a).** Intro, story heading/lede, safety headings/buttons, CONTEXT_Q, thin text, "Get seen today/this week", clinician paragraph, disclaimer are English in both locales today. The contract requires every locale key; the Spanish entries will be *new strings*, which CLAUDE.md forbids inventing. Proposal: ship `es` entries equal to the English strings with `reviewed:false` and a CHANGELOG list of the keys needing translation. Confirm.
- **Q7 "Instrument v0.3 candidates" literal** (Scribe L1236, note footer). Keep verbatim in `copy.note.supportingFooter`, or rewrite to `${versions.instrument}`-based wording ("not part of instrument v0.2")?
- **Q8 `initialSelected: false` no-op** in the Questionnaire (L461). Kept for byte parity; remove in a later instrument-neutral release?
- **Q9 Screener bundle reasonCode** "(band likelihood)" vs Scribe "(band)". Design adopts Scribe's (bundle base per D7) and lists it as an allowed golden difference for the Screener surface. Confirm.
- **Q10 Scribe note context order.** Old order dur, clin, dismiss (L1204-1206) vs contextItems order clin, dur, dismiss. Design adds an optional `noteOrder` so the note is byte-identical; drop it and accept reordering?
- **Q11 Demo cohorts.** If the spec-driven `makeCohort` cannot reproduce the Simulator's LCG stream exactly, accept regenerated (statistically equivalent, still deterministic) cohorts?
- **Q12 Redirects** from the deleted per-app pages (screener.html etc.) to `index.html#tab=…` — wanted, or 404?
- **Q13 Meter zones** 33/33/34 (old) vs derived 34/33/33 (matches the band text `< 34`). Visual only; confirm derivation.
- **Q14 Patient CONTEXT_Q realignment (D6)** — the patient-language labels for the Screener bins `0-1 / 2 / 3+` and `<3mo / 3-12mo / >12mo` are new patient-facing strings ("Just one or two"? "Under 3 months"?). The module cannot invent them; the CHANGELOG will list the six labels awaiting wording.

### 9.2 Self-assessed risks of this design
1. **Contract breadth.** ~45 required fields is a lot for a second author; mitigated by the template module, `validateModule` paths and the README, but a module that is 90% copy is still the reality of a clinical instrument — the breadth is the content, not the framework.
2. **Closures in data.** `when(state)` closures cannot be introspected by `validateModule`; the smoke checks (25, 34) catch throws, not wrong logic. Rule parity (t-rules) covers MASQUE only; a second module's rules are its author's responsibility. Optional `item.symbol` reduces magic indices but is not enforced.
3. **Hook-neutralising rewrite fragility.** The harness depends on exact import lines and slice anchors in frozen files; guarded by SHA-256 of files and slices, so the failure mode is INVALID, never a false PASS — but a reference change (there should be none) breaks the harness entirely.
4. **Per-surface copy** duplicates routing text in the module. Chosen for byte parity; Q2 may collapse it.
5. **Shell-owned locale + app-owned toggle proxy** adds one prop; if a future tab supports locale (Scribe), `supportsLocale` flips and the engine PROBE_KIND labels/captions still need a locale layer — flagged, not solved.
6. **Panel default `band:null`** is a behaviour change for VOICED/BREATHE hosts that relied on `'low'` — they pass `band` explicitly today per the inventory, but this must be verified in those repos before release.
7. **Deleting the per-app pages** removes deep links people may have; Q12.
8. **`makeCohort` port** may not be bit-exact (Q11).
9. **Lazy tab mounting** means the Scribe's `validateProbes` side effect (now inside `validateModule`) runs once per module selection rather than per app load — an improvement, but any app-level import-time assertion that survives the port by accident would run late; `t-ids` and a grep for top-level IIFEs in `apps/**` guard it.

