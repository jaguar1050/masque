# Design candidate A — contract-first module system for Project MASQUE 0.4.0

Lens: the smallest fully-specified module contract and engine API that carries every feature of the 0.3.1 prototype, with strict layering **module → engine → components → shell** (no upward imports) and a strict `validateModule`. Every field below names the consumer that reads it; a field with no consumer is not in the contract.

Conventions used in this document:

- `Inv §x` / `Inv Lnnn` = `docs/refactor/01-inventory.md` section / the source line it cites (in `reference/fixed-src/`). "Scr", "Scb", "Pat", "Sim", "RRP", "Ext", "Prb" = the seven reference files.
- Engine-fixed vocabularies (D2): `Band = 'low'|'moderate'|'high'|'indeterminate'`; `Tier = 'emergent'|'urgent'`; `Answer = 'yes'|'no'|number|undefined` (Patient state additionally holds `'unsure'`, which the engine treats as `undefined` everywhere except the "Not sure" list); `ProbeKind = 'safety'|'rescue'|'criteria'|'ruleout'|'phenotype'|'exam'`; `CaptureKind = 'redflag'|'item'|'ctx'`.
- Module-owned vocabularies: complaint/phenotype values, domain keys, item/flag/context ids, context option values, sample ids.
- Layering rule, enforced by a test (§6.6): files under `engine/` import only `engine/`; files under `modules/<id>/` import only files in that folder; `components/` import `engine/` + react/lucide; `shell/` imports everything. Module files therefore never import the engine — a module is data plus closures over engine-documented state shapes.

---

## 1. File layout under `app/src/`

One line per file: purpose — exports. All relative imports carry extensions; every `.jsx` starts with `import React from "react"`.

```
app/
  index.html                          shell page (D11): import map, Babel, boots ./src/shell/App.jsx via assets/masque-loader.js
  assets/masque-loader.js             unchanged runtime (fetch → Babel → blob-link → import)
  tests/                              see §6
    index.html                        self-check page; boots ./tests/main.js through the same loader
    main.js                           runs the four suites, renders the report table — default export none; side effect: window.__masqueTests
    legacy.js                         loads reference/fixed-src files at runtime with appended exports — loadLegacy(file, exportNames) → Promise<namespace>
    prng.js                           mulberry32(seed) → () => number; drawAnswers(module, rnd, opts); drawContext(module, rnd)
    diff.js                           deepDiff(a, b, {ignore, allow}) → Diff[]; formatDiff
    suites/validate.js                suite (a)
    suites/golden.js                  suite (b)
    suites/sweep.js                   suite (c)
    suites/rules.js                   suite (d) + (e) patient-never-shows-clinician-text
  src/
    engine/
      contract.js                     the contract: JSDoc typedefs (§2), vocab constants — BANDS, BAND_ORDER, TIERS, TIER_RANK, ANSWER, PROBE_KIND, CAPTURE_KIND, STEP_EXTRAS, ICON_NAMES, ENGINE_LOCALES, LOCALE_NAMES
      validate.js                     validateModule(module) → {errors:string[], warnings:string[]}; assertModule(module) throws
      score.js                        scoreItem, itemBounds, bandFor, computeScore, bandGeometry, BAND_INTERP, BAND_META, positiveMax, negativeMin
      rules.js                        makeRoutingState, evaluateRouting, derivePhenotype, activeDomains, gapSignals, evaluatePatientSummary (state shapes §3.3)
      fhir.js                         buildQuestionnaire, buildCdsHooks, buildDataDictionary, buildBundle
      cohort.js                       CANONICAL_COLUMNS, screenToCohortRow, rowsToCsv, subjectPseudonym, makeCohort
      extract.js                      EXTRACTOR_KIND, createExtractor(lexicon) → {extract, negatedNear, firstHit, allHits}, faersToUtterances
      probes.js                       PROBE_KIND_ORDER, liveProbes(probes, answers, redFlags, answered), validateProbes(probes, itemIds, flagIds)
      scribe.js                       ingest, rankSuggestions, buildNote, captureLabel
      patient.js                      PATIENT_CHROME (en/es), TIER_DISPLAY, localeFor, buildSummary, askForm, list, summaryText
      download.js                     downloadText, downloadJsonFile, fhirHtml
    modules/
      registry.js                     MODULES: Module[] (exactly [masque]); getModule(id); DEFAULT_MODULE_ID
      TEMPLATE.md                     the documented module template (every field, with the validateModule rule that checks it); not imported
      masque/
        index.js                      assembles and default-exports the module object (spreads the files below); nothing else
        instrument.js                 domains (with items), bands, contextItems, gap, redFlags  — moved from Scr L110-147, L172-258, L334, L1190-1194; Scb ASK/shortLabel/VMPATHI_TAG folded into items
        steps.js                      steps.screener, steps.patient — from Scr STEPS + step JSX copy; Pat SECTIONS
        phenotypes.js                 phenotypes (values, default, derive rules, referral, cdsTerm) — from Scr L1072-1076/L1456/L1577, Scb L770-783/L1259/L1311
        scribe.js                     scribe.activation, scribe.infoPrompts — from Scb L781-783, L279-282
        rules.js                      rules.routing (Scr L891-952), rules.patientSummary (Pat L909-953 as ordered rules)
        cds.js                        cds + fhir constants — from Scr L80, L421-438, L447, L467, L476-517, L1537; Scb L1303-1304
        probes.js                     probes (PROBES + VM_PROBES verbatim from Prb L56-287); no engine functions
        lexicon.js                    lexicon (Ext L38-166 verbatim + goldSet ref)
        samples.js                    samples.cases (Scr SAMPLE_CASES + Sim SCENARIOS merged), samples.patient (Scr DEMO_PATIENT), samples.transcript (Scb SCRIPT)
        research.js                   research (RRP PROJECTS.MASQUE + aliases, artifactKey, etlScript, fairnessAxes, citations, demoCohorts from Sim COHORTS/makeCohort specs)
        copy.js                       copy (titles, subtitles, indexName, gate copy, cds preview, note slots, disclaimers, walkthrough)
        locales/en.js                 locales.en (Pat P, RED_FLAGS q/say, CONTEXT_Q, BLURB, SUM.en, patient UI content keys, reviewed:true)
        locales/es.js                 locales.es (Pat ES_P, ES_RF, BLURB_ES, SUM.es, UI.es content keys, reviewed:false)
        CHANGELOG.md                  reconciliation log (D6/D7): every divergence resolved and which copy won; also exported as `changelog` array from index.js
    research/
      registry.js                     PANEL_PROJECTS = {MASQUE: masque.research (derived), BREATHE, VOICED} — legacy panel-only entries (D9); resolveProject(projectOrResearch)
    components/
      icons.js                        ICONS: name → lucide component (exactly the names in contract.ICON_NAMES); Icon({name, size})
      SampleRail.jsx                  SampleRail({cases, onLoad, onClear}) — generic sample buttons (D1)
      Screener.jsx                    Screener({module, onCapturedRows?}) — root class .scr
      Scribe.jsx                      Scribe({module}) — root class .asc
      PatientCompanion.jsx            PatientCompanion({module, locale, onLocale}) — root class .mp (unchanged CSS)
      ResearchReadinessPanel.jsx      ResearchReadinessPanel(props) — moved from reference with the minimal edits in §4.4; .rrp- unchanged
    shell/
      App.jsx                         default export App: module dropdown, app tabs, locale toggle, caveat banner, footer, walkthrough drawer, About
      constants.js                    APP_VERSION='0.4.0', REQUIRE_SAFETY_REVIEW_TO_SIGN=true, ABSTAIN_FLOOR re-export, SITE_SALT, SALT_IS_DEFAULT, CAVEATS {prototype, unreviewed, illustrative}
      css.js                          SHELL_CSS: :root tokens, box-sizing reset, :focus-visible, reduced-motion, shell chrome classes (.sh-*)
```

Retired: `MASQUE_Simulator.jsx`, `simulator.html`, `screener.html`, `scribe.html`, `patient.html`, the five `src/MASQUE_*` copies (they remain only under `reference/`, which the tests fetch). `/masque/demo/` is untouched (D12).

---

## 2. The module contract

Written as the JSDoc that goes into `engine/contract.js`. "Consumer" names the engine function or component that reads the field; "MASQUE" cites where the value is extracted from. R = required, O = optional.

```js
/**
 * @typedef {Object} Module
 * @property {string} id            R  'masque'. Consumers: cohort.screenToCohortRow (screen_id prefix `${id}-`, module_id column),
 *                                     Screener/Scribe filenames (`${id}-pilot-cohort-`, `${id}-questionnaire-v…`), modelVersion
 *                                     `${id}-prototype-${APP_VERSION}` / `${id}-scribe-prototype-…`, App (React key for reset), registry.
 *                                     MASQUE: Scr L574 'masque-', L966, L1142, L1407-1413.
 * @property {string} name          R  'MASQUE'. Consumers: research/registry (legacy panel `project` key), RRP manifest/model card,
 *                                     App footer, validate console prefix `[${name}]`. MASQUE: Scr L1137 project="MASQUE".
 * @property {string} label         R  'Dizziness'. Consumers: App dropdown option text and <title>. Nowhere else (D4).
 * @property {string} icon          R  lucide name in ICON_NAMES; 'Stethoscope'. Consumers: App brand mark, Screener/Scribe brand row. MASQUE: Scr L1003.
 * @property {Versions} versions    R
 * @property {Domain[]} domains     R  ordered; the order is DOMAIN_ORDER (Scr L257) and every iteration order in the engine.
 * @property {BandConfig} bands     R
 * @property {ContextItem[]} contextItems R
 * @property {GapConfig} gap        R
 * @property {RedFlag[]} redFlags   R  ≥ 1 (validate); the safety step renders regardless (D8).
 * @property {Steps} steps          R
 * @property {Phenotypes} phenotypes R
 * @property {ScribeConfig} scribe  R
 * @property {Rules} rules          R
 * @property {Fhir} fhir            R
 * @property {Cds} cds              R
 * @property {Samples} samples      R
 * @property {Lexicon} lexicon      R
 * @property {Probe[]} probes       R  may be [] (validate warns)
 * @property {Record<string, Locale>} locales R  keys ⊆ ENGINE_LOCALES ('en','es'); 'en' required
 * @property {Research} research    R
 * @property {Copy} copy            R
 * @property {ChangelogEntry[]} changelog R  {date, entry}; rendered by App About drawer and tests page. MASQUE: CHANGELOG.md mirrored.
 */

/**
 * @typedef {Object} Versions   Consumers: App footer, RRP (instrumentVersion prop), fhir.* (Questionnaire.version, dictionary),
 *                              cohort rows, Scribe footer, tests report. Nothing derives one from another (CLAUDE.md: five axes).
 * @property {string} instrument  R '0.2'   Scr L45
 * @property {string} lexicon     R '0.3.1' Ext L24
 * @property {string} probeSet    R '1.0.0' Prb L290
 * @property {string} goldSet     R '0.2.0' goldset _meta.version
 */

/**
 * @typedef {Object} Domain
 * @property {string}  key       R  'recalcitrance'…  Consumers: score (domains[key]), fhir (linkId, `domain-${key}` code), cohort, steps.domainKeys, Screener/Scribe/Patient rendering.
 * @property {string}  label     R  clinician label 'Migrainous'. Consumers: score.domains[k].label, fhir group text, dictionary, Scribe note, RRP domains prop. Scr L173-242.
 * @property {number}  max       R  declared max (negative for negative domains). Consumers: score (pct), validate (Σw === max). Scr L175 etc.
 * @property {boolean} [negative] O  true only on discriminators. Consumers: score, dictionary discriminatorMin (Σ max over negative), routing state `negativeDomains`, Patient clin sign. Scr L244.
 * @property {string}  [shortTag] O  Scribe suggestion tag when the item has no `tag`; default label.toLowerCase(). MASQUE: vestibular → 'vestibular' (Scb L796).
 * @property {Item[]}  items     R  ≥ 1
 */

/**
 * @typedef {Object} Item
 * @property {string} id      R  unique across domains and contextItems and redFlags and infoPrompts. Consumers: everything.
 * @property {number} w       R  weight; sign = direction (dictionary 'reverse'). Scr L177…
 * @property {string} text    R  clinician item text. Consumers: Screener QGroup, fhir Questionnaire/QR/dictionary, Screener rec chips (Scr L944 split). Scr text.
 * @property {string} short   R  short label. Consumers: Scribe capture tags, note lines, "re-asking" line (D7), probes rail. Scb shortLabel L1168-1178 (30 entries; validate: every item).
 * @property {string} ask     R  physician phrasing. Consumers: Scribe suggestion prompt. Scb ASK L239-270.
 * @property {string} [tag]   O  full tag string 'VM-PATHI · disequilibrium'. Consumers: scribe.rankSuggestions boost + display; buildNote strips scribe.infoPrompts.tagPrefix. Scb L272-277 (4 items).
 * @property {{label:string, f:number}[]} [scale] O  ordered options; answer = index. Consumers: score, fhir answerOption (code String(i)), dictionary, Screener/Patient option buttons. Scr L188-238.
 * @property {string} [ref]   O  criterion code 'ICHD-3 1.1 criterion B'. Consumers: fhir (criteria coding), dictionary. Scr L193, L208-212.
 */

/** @typedef {Object} BandConfig  @property {{moderate:number, high:number}} cuts  R  {34, 67}. Consumers: score.bandFor/bandGeometry (zones, ticks, '< 34' texts), dictionary. Scr L334. */

/**
 * @typedef {Object} ContextItem   unscored; not in Questionnaire or cohort (as today)
 * @property {string} id      R  'c_clin' | 'c_dur' | 'c_dismiss'
 * @property {string} text    R  clinician prompt. Consumer: Screener ContextQ. Scr L1191-1193 `t`.
 * @property {ContextOption[]} options R  ordered
 */
/**
 * @typedef {Object} ContextOption
 * @property {string} value   R  stored value; lexicon.ctx/multi values must match (validate). Scr: '0-1','2','3+' / '<3mo','3-12mo','>12mo' / 'no','yes'.
 * @property {string} label   R  clinician label ('0–1', '<3 mo'). Consumer: Screener ContextQ.
 * @property {GapSignal} [signal] O  marks the gap-rule option. Exactly one per context item for MASQUE (validate: ≥ 2 signal options module-wide or gap.threshold unreachable → error).
 */
/**
 * @typedef {Object} GapSignal   Consumers: rules.gapSignals → Screener gap alert list (alert), Scribe gap alert + capture label (short), buildNote Context line (note).
 * @property {string} alert   R  'Seen by 3+ clinicians for this problem'  Scr L874-876
 * @property {string} short   R  '3+ clinicians'                          Scb L836-838, L1160
 * @property {string} note    R  'seen by 3+ clinicians'                   Scb L1204-1206
 */
/** @typedef {Object} GapConfig  @property {number} threshold R 2 (Inv §4.5: three markers, threshold two — content; sex-neutrality is a constraint, checked by review not code). Consumers: rules.gapSignals. */

/**
 * @typedef {Object} RedFlag     never weighted (engine has no field for it)
 * @property {string} id      R  'rf_asym'
 * @property {Tier}   tier    R  'emergent'|'urgent'. Consumers: Screener/Scribe emergent branch, bundle priority, Patient TIER_DISPLAY (now/soon).
 * @property {string} group   R  Consumers: Screener safety step grouping (RF_GROUPS derived in component), dictionary.
 * @property {string} text    R  clinician text. Consumers: safety step, Questionnaire, bundle Flag.text, note. Scr L110-147 (canonical, Inv §2).
 * @property {string} points  R  points-to. Consumers: Questionnaire code display, bundle, note, dictionary. Never passed to PatientCompanion (test e).
 * @property {string} action  R  Consumers: rec chips, CDS example detail (generated), ServiceRequest, note.
 */
/* Dropped: Scribe RED_FLAGS.ask (never read, Inv §2 red flags (d)) — logged in CHANGELOG. Patient q/say live in Locale.redFlags; cue phrases in Lexicon.redFlags. */

/**
 * @typedef {Object} Steps   Engine-fixed steps are added by the components: Screener = [safety] + steps.screener + [result];
 *                           Patient = [intro, safety] + steps.patient + [summary]. A module cannot add, remove or reorder the fixed ones (D8).
 * @property {Step[]} screener R  MASQUE: intake{domainKeys:['recalcitrance'], extras:['complaint'], intro:'Recalcitrance markers — the premise of the screen'}, migraine, vestibular, neuro,
 *                                   impact{domainKeys:['impact'], extras:['context']}, discriminators. Scr L82-92 + JSX L1066-1105 (picker then QGroup at L1086; QGroup then ContextQ at L1101-1103).
 * @property {Step[]} patient  R  MASQUE: story{domainKeys:['recalcitrance'], extras:['context']}, migraine, vestibular, neuro, impact, discriminators. Pat L531-541, L720.
 */
/**
 * @typedef {Object} Step
 * @property {string}   key        R  unique within its list; not 'safety'|'result'|'intro'|'summary' (reserved).
 * @property {string[]} domainKeys R  may be []; validate: every domain key appears in exactly one screener step and exactly one patient step.
 * @property {('complaint'|'context')[]} extras R  'complaint' renders the phenotype picker and gates Next on a choice (Scr L888); 'context' renders contextItems.
 *                                   Fixed render order inside a step (engine, not module): complaint picker → domainKeys in order (intro on the first) → context items. Matches Scr L1071-1086 and L1101-1103.
 * @property {string}   [eyebrow]  O  Screener only ('01 · Intake'). Scr L1068, L1023…
 * @property {string}   title      R  Screener: h2 (Scr L1069). Patient: ignored; title comes from Locale.patient.steps[key] (bilingual).
 * @property {string}   [sub]      O  Screener stepsub (Scr L1070).
 * @property {string}   [intro]    O  Screener intro paragraph (Scr L1086 recalcitrance, L1090-1094 StepCard subs).
 */

/**
 * @typedef {Object} Phenotypes   the complaint vocabulary (module-owned, D2)
 * @property {string} default     R  'sinonasal' (Scb L773 fall-through).
 * @property {PhenotypeValue[]} values R  ordered as the picker shows them. Scr L1072-1076.
 * @property {{id:string, when:(s:PhenotypeState)=>boolean, value:string}[]} derive R  ordered; first true wins; else default. Consumers: Scribe (complaint memo replacement). Scb L770-774.
 */
/**
 * @typedef {Object} PhenotypeValue
 * @property {string} k   R 'sinonasal'|'otologic'|'both'      Consumers: Screener picker, cohort `complaint` column, RRP phenotype prop, rule predicates.
 * @property {string} h   R 'Otologic / vestibular'             Screener picker heading  Scr L1073-1075
 * @property {string} d   R 'Dizziness, aural fullness, …'      Screener picker description
 * @property {{specialty:string, reason:string}} referral R  Consumers: fhir.buildBundle referral ServiceRequest. Scr L1456/L1577, Scb L1259/L1311.
 *                                                          MASQUE: otologic {'Neuro-otology','vestibular migraine'}; sinonasal and both {'Headache medicine / Neurology','mid-facial / migrainous cause'}.
 * @property {string} cdsTerm R  word in the Screener CDS preview title ('…before escalating {cdsTerm} therapy'). Scr L1344: otologic→'otologic', sinonasal/both→'sinonasal'.
 */
/** @typedef {{answers: Record<string, Answer>}} PhenotypeState */

/**
 * @typedef {Object} ScribeConfig
 * @property {{always:string[], rules:{id:string, when:(s:ActivationState)=>boolean, domains:string[]}[]}} activation R
 *           Consumers: scribe.rankSuggestions (pool + ranking). MASQUE: always ['migraine','impact','recalcitrance','discriminators'];
 *           rule 'oto' → ['vestibular'] when complaint ∈ {otologic, both}; rule 'neuro' → ['neuro'] when (n_burn ?? 'no') !== 'no' || n_viral === 'yes'. Scb L781-783.
 * @property {InfoPrompts} infoPrompts R
 */
/** @typedef {{answers: Record<string, Answer>, complaint: string}} ActivationState */
/**
 * @typedef {Object} InfoPrompts   unscored informational prompts (VM-PATHI domains not in the numeric model)
 * @property {string} gateDomain  R  'vestibular' — prompts offered, and item.tag boost applied, only while this domain is active. Scb L786, L790, L800.
 * @property {string} tagPrefix   R  'VM-PATHI · ' — stripped in buildNote coverage line. Scb L1202.
 * @property {number} maxTotal    R  6 — suggestion list cap (4 scored + up to 2 info). Scb L795, L800.
 * @property {number} maxScored   R  4
 * @property {{id:string, tag:string, ask:string}[]} prompts R  vmp_cog, vmp_affect. Scb L279-282. Answers live in Scribe `vmp` state ('yes'|'no'|'skip').
 */

/**
 * @typedef {Object} Rules
 * @property {{rules: RoutingRule[], fallback: {h:string, p:string, chips:string[]}}} routing R
 *           Consumers: rules.evaluateRouting → Screener recs block, Scribe recs tab + note + (unused today) bundle. MASQUE: the five rules Scr L917-945 in order
 *           (sinus-migraine, vestibular-migraine, neuro-overlay, tinnitus, competing) + fallback Scr L946-950. Override/incomplete are NOT rules (engine gates, copy in Copy.gate).
 * @property {{said: SummaryRule[], ask: SummaryRule[]}} patientSummary R
 *           Consumers: rules.evaluatePatientSummary via patient.buildSummary. MASQUE: said = Pat L910-937 as 15 ordered rules; ask = Pat L945-953 as 9 ordered rules
 *           (askBoth: migPattern && disc; askMig: migPattern && !disc; askVest; askRefer; askNeuro; askNormal; askDisc; askTried; askNext when:()=>true).
 */
/**
 * @typedef {Object} RoutingRule
 * @property {string} id
 * @property {(s:RoutingState)=>boolean} when
 * @property {string} h
 * @property {string|((s:RoutingState)=>string)} p        e.g. competing: s => `Rule-out items subtracted ${Math.abs(s.domains.discriminators.pts)} points. …`
 * @property {string[]|((s:RoutingState)=>string[])} chips  e.g. competing: s => s.negativeItems.filter(it => s.answers[it.id]==='yes').map(it => it.text.split(/[—(]/)[0].trim().slice(0,46))
 */
/** @typedef {{id:string, when:(s:PatientSummaryState)=>boolean, text:(s:PatientSummaryState)=>string}} SummaryRule */

/**
 * @typedef {Object} Fhir   opaque identifiers, byte-identical for MASQUE (D4, Inv §4.3)
 * @property {string} questionnaireUrl   R 'http://masque.example/Questionnaire/masque-screener-v0.2' (literal, not templated — validate only checks it is a URL). Scr L80.
 * @property {string} questionnaireName  R 'MASQUEScreener'  Scr L429
 * @property {string} questionnaireTitle R Scr L430
 * @property {string} publisher          R 'Project MASQUE — TOPx prototype' Scr L434
 * @property {string} description        R Scr L435-438
 * @property {string} safetyGroupText    R 'Red flags — evaluated before screening; not scored' Scr L443
 * @property {string} codeSystem         R 'http://masque.example/codes'   Scr L447 (8×)
 * @property {string} answerSystem       R 'http://masque.example/answer'  Scr L421
 * @property {string} criteriaSystem     R 'http://masque.example/criteria' Scr L467
 * @property {string} weightExtension    R 'http://masque.example/StructureDefinition/item-weight' Scr L422 (module, not engine: it is in the module's URL space)
 * @property {string} indexCode          R 'masque-index'  Scr L1537
 * @property {string} indexDisplay       R 'MASQUE migraine/neuropathy screen index' Scr L1537
 * @property {string} documentType       R 'ENT encounter note — MASQUE ambient screen' Scb L1303
 * @property {string} documentTitle      R 'MASQUE encounter note (draft)' Scb L1304
 */
/**
 * @typedef {Object} Cds   Consumers: fhir.buildCdsHooks (generated document), Screener CDS preview.
 * @property {string} serviceId     R 'masque-screen'  Scr L479
 * @property {string} title         R Scr L480
 * @property {string} description   R Scr L481-483
 * @property {{label:string, url:string}} source R {'Project MASQUE','http://masque.example'} Scr L500
 * @property {{safety:string, index:string}} cardIds R {'masque-safety','masque-index'} Scr L496, L507
 * @property {{flagId:string, summary:string}} exampleRedFlag R  {'rf_asym', 'Red flag present — do not attribute to migraine before evaluation'}; detail is GENERATED:
 *           `${redFlags[flagId].action}. ${copy.cds.withheld}` (fixes the hand copy at Scr L499; D7).
 * @property {{summary:string, detail:string}} exampleSettled R  Scr L508, L510 verbatim (the '78/100' is illustrative example text, kept as data).
 */

/**
 * @typedef {Object} Samples
 * @property {SampleCase[]} cases   R  Consumers: SampleRail (Screener). MASQUE (merged, D1): sinonasal, otologic, redflag, competing (Scr L261-312, buttonLabels Scr L994-997,
 *                                     icons Activity/TriangleAlert) + empty, partial, high, high_redflag, ruleout (Sim L308-330; icons Ban/ScanLine/Activity/TriangleAlert/Zap; `why` kept).
 * @property {DemoPatient} patient  R  Scr L314-317 (≡ Scb PATIENT). Consumers: Screener, Scribe, RRP sex/gender props, cohort, bundle.
 * @property {['md'|'pt', string][]} transcript R  Scb L566-581. Consumers: Scribe playback. Sim LINES dropped (superseded, Inv §6.4).
 */
/**
 * @typedef {Object} SampleCase
 * @property {string} id            R
 * @property {string} buttonLabel   R 'Sample: sinus'
 * @property {string} label         R 'Recalcitrant facial pressure' (toast / rail tooltip)
 * @property {string} icon          R name in ICON_NAMES
 * @property {string} [why]         O  Sim scenario rationale; shown as the rail tooltip
 * @property {string} [complaint]   O  must be a phenotypes.values[].k
 * @property {Record<string,string>} [ctx] O  contextItem id → option value (validate)
 * @property {Record<string,true>}   [rf]  O  flag ids (validate)
 * @property {Record<string,Answer>} answers R  item ids (validate: ids and scale index ranges)
 */
/** @typedef {{id:string, given:string, family:string, sex:string, gender:string, age:number, mrn:string, synthetic:true}} DemoPatient  — no DOB field exists (validate rejects `dob`) */

/**
 * @typedef {Object} Lexicon   Ext L38-166 verbatim; engine createExtractor(lexicon) (Inv §3.6 file notes)
 * @property {{window:number, cues:string[]}} negation    R {14, 14 cues}
 * @property {{window:number, cues:string[]}} thirdParty  R {34, 15 cues}
 * @property {{window:number, cues:string[]}} historical  R {30, 8 cues}
 * @property {{id:string, ph:string[], thirdPartyExempt?:boolean}[]} bool R  24 entries; ids ∈ items; phrases lowercase (validate)
 * @property {{id:string, val:string, ph:string[]}[]} ctx  R  ids ∈ contextItems, val ∈ its option values
 * @property {{id:string, cue:string[], bands:{ph:string[], v:number}[], fallback:number|null}[]} scale R  ids ∈ scale items; v < scale.length
 * @property {{ids:{id:string, value:*, kind:'item'|'ctx'}[], ph:string[]}[]} multi R
 * @property {Record<string,string[]>} redFlags R  keys === set of redFlags ids (validate, replaces Scb L555-558 drift guard)
 * @property {string} goldSet  R  'masque_extraction_goldset.json' (file name only; benchmark harness is out of scope)
 */

/**
 * @typedef {Object} Probe   Prb file notes shape, verbatim
 * @property {string} id  @property {ProbeKind} kind  @property {(answers:Record<string,Answer>, redFlags:Record<string,*>)=>boolean} when
 * @property {string} [target]  @property {string} [rescues]  @property {string} say  @property {string} why
 * @property {{l:string, rf?:string, a?:Record<string,Answer>, note?:string}[]} opts
 */

/**
 * @typedef {Object} Locale
 * @property {boolean} reviewed  R  en true, es false (Pat L294). Consumers: App/PatientCompanion unreviewed banner (shell caveat text, unconditional when false — D8).
 * @property {Record<string,{q:string, opts?:string[], ask?:string, help?:string}>} items R  every item (validate: keys === item ids; opts.length === scale.length; no opts on boolean). Pat P / ES_P.
 * @property {Record<string,{q:string, say:string}>} redFlags R  every flag. Pat L225-262 / ES_RF.
 * @property {Record<string,{q:string, opts:string[]}>} contextItems R  every context item; opts index-aligned to options (D6: values aligned to Screener bins; labels patient-language). Pat L522-529 (en; es = open question Q1).
 * @property {Record<string,string>} blurbs R  domain key → lede, for every domain key of every patient step that does NOT carry extras 'context' (the story step renders patient.storyIntro instead). MASQUE: migraine, vestibular, neuro, impact, discriminators. Pat L761-774.
 * @property {PatientSum} sum R  the SUM[loc] object verbatim (functions allowed: templates). Pat L427-502. Rule closures reach it as s.S.
 * @property {PatientContent} patient R
 */
/**
 * @typedef {Object} PatientContent   module content that the Patient app shows (chrome lives in engine PATIENT_CHROME)
 * @property {string} sub                       R  Pat UI.sub L381/L403
 * @property {Record<string,string>} steps      R  step key → title, including 'intro','safety','summary' (Pat UI.sections, re-keyed)
 * @property {string} storyIntro                R  Pat L721 recalcitrance intro (en); es falls back to en (open question Q2)
 * @property {string} storyHeading  @property {string} storyLede   R  Pat L705-707 (en today)
 * @property {string[]} forYouIf                R  Pat L787-788 bullets
 * @property {string} forClinicianLede          R  Pat L1067 'MASQUE instrument v{v} … migrainous/neuropathic pattern' with `{v}` placeholder (patient.js substitutes versions.instrument)
 */

/**
 * @typedef {Object} Research   RRP PROJECTS.MASQUE L25-56 plus the brand-derived knobs (Inv §3.4)
 * @property {string} title  @property {string} target  @property {number} threshold  @property {{midpoint:number, slope:number}} calibration
 * @property {[string,string][]} sources  @property {string[]} expected  @property {Object[]} demo   (all verbatim; consumers unchanged in RRP)
 * @property {string[]} scoreAliases  R ['masque_score'] — RRP normalizeRows adds these to ['score','index'] (L197/L216 single source)
 * @property {string} artifactKey     R 'masqueArtifact'  (RRP L864)
 * @property {string} etlScript       R 'etl/masque_population_etl.R' (RRP L991)
 * @property {string[]} fairnessAxes  R ['sex','gender'] (RRP L775/L967 Stratify buttons; default axis = [0])
 * @property {Record<'population'|'mitigation'|'consistency'|'gate'|'calibration', string>} citations R  '§7.1','§7.2','§8','§11','§7.2' (RRP L425, L1003, L925, L893/L874, L1050)
 * @property {{ranges:{hi:CohortRange, lo:CohortRange}, cohorts:DemoCohort[]}} demoCohorts R  Sim L285-305 + L677-681 (D1). Consumers: cohort.makeCohort + RRP "Load demo cohort".
 * @property {ToleranceOverride} [tolerance] O  {selectionGapTolerance?, sensitivityGapTolerance?, specificityGapTolerance?, toleranceSetBy, toleranceRationale, toleranceSetOn} — all three provenance fields required when present (validate); merged over FAIRNESS_POLICY by RRP. MASQUE: absent.
 */
/** @typedef {{pos:[number,number], neg:[number,number]}} CohortRange  base + span: hi {pos:[58,40], neg:[12,38]}, lo {pos:[26,42], neg:[6,34]} (Sim L291) */
/** @typedef {{id:string, label:string, why:string, seed:number, groups:{sex:string, gender:string, n:number, range:'hi'|'lo', labeled:boolean}[], extraRows?:Object[]}} DemoCohort  balanced / unlabeled / disparate (Sim L295-302, seed 7) */

/**
 * @typedef {Object} Copy   every string in Inv §3 "Hardcoded text" that names the module, the condition or the instrument. Everything else is engine chrome.
 * @property {string} indexName            R 'MASQUE index'  (Scr L1231/1243/1437, Scb L922, RRP L895 `${indexName} above is unaffected`, dictionary note, bundle reasonCode)
 * @property {{title:string, subtitle:string, bandSuffix:string, safety:{eyebrow,title,sub,body}, gapAlert:{title,body}, disclaimer:string}} screener R
 *           Scr L1005-1006, L1255, L1023-1027 + L1049-1059, L1303-1308, L1426-1429
 * @property {{redFlagTitle:string, indexTitle:(term:string)=>string, indexDetail:string}} cds R  Scr L1334, L1344, L1347-1348 + withheld 'The screening index is withheld from routing.' (Scr L1337, L499)
 * @property {{withheld:(s:{emergent:boolean})=>{h:string,p:string}, incomplete:(s:{answered:number, floor:number, ceiling:number})=>{h:string,p:string}}} gate R
 *           Scr L897-899, L906-908. Chips are engine-derived (flag actions; open-domain labels). Scribe uses the same copy in its rec block + note.
 * @property {{title:string, subtitle:string, vmpDisclaimer:string, about:string[], gapAlert:string, note:NoteCopy}} scribe R  Scb L876-877, L1127, L1132-1137, L954
 * @property {NoteCopy} scribe.note   R  slots for engine buildNote: {title:'ENT ENCOUNTER — MASQUE ambient screen (DRAFT)', screenHeading:'MASQUE SCREEN', indexLine:(total,band)=>string (Scb L1228),
 *           supportingFooter:'Not Barany criteria; contribute nothing to the index. Instrument v0.3 candidates.' (Scb L1236, kept verbatim; open question Q5), planDefault (Scb L1248),
 *           footer (Scb L1250), overrideLine (Scb L1240), gapLine (Scb L1232), infoCoverageLabel:'VM-PATHI domains additionally covered' (Scb L1224)}
 * @property {{screener?:WalkCard[], scribe?:WalkCard[], patient?:WalkCard[]}} [walkthrough] O  Sim L992-1013, L1511-1547 "What to notice" cards {title, body}. Consumer: App drawer (D1).
 */
```

Vocabulary constants exported by `contract.js` (engine-fixed): `BAND_ORDER = ['low','moderate','high']`, `BANDS = [...BAND_ORDER,'indeterminate']`, `TIER_RANK = {emergent:0, urgent:1}`, `ANSWER = {YES:'yes', NO:'no', UNSURE:'unsure'}`, `PROBE_KIND` (Prb L47-54 + `caption` from Scb L1035-1037 + `truncate` false for safety/rescue, `cap` 2 otherwise), `CAPTURE_KIND`, `STEP_EXTRAS = ['complaint','context']`, `ICON_NAMES = ['Stethoscope','Activity','TriangleAlert','Ban','ScanLine','Zap','FlaskConical','Users','FileText']`, `ENGINE_LOCALES = ['en','es']`, `LOCALE_NAMES` (Pat L295).

Deliberate omissions from the contract (each has no consumer or is engine-owned): domain `patientLabel` (Patient titles are per-locale step titles → `Locale.patient.steps`); `RedFlag.ask`; `RedFlag` weight (no field exists); any gate switch; any caveat string; `APP_VERSION`; `SITE_SALT`; fairness thresholds other than the attributed tolerance override; band labels/colours; tier colours; probe kind labels; Yes/No/Not sure; step-of-N chrome.

---

## 3. The engine API

All functions are pure unless stated. `module` is a validated Module. Where a signature is "(module, …)" the engine derives its lookups (`itemsById`, `flagsById`, `negativeDomains`) once per module via `engine/score.js: indexModule(module)` (memoised on a WeakMap).

### 3.1 `engine/score.js` (Scr L321-408 verbatim, parameterised)

```
scoreItem(item, val) → number                              Scr L321-327 unchanged
itemBounds(item) → {min, max}                              Scr L360-367 unchanged
bandFor(cuts, v) → 'low'|'moderate'|'high'                 Scr L336-340
positiveMax(module) → number      Σ domain.max over !negative (100)   — replaces clamp literal Scr L395
negativeMin(module) → number      Σ domain.max over negative (−29)    — replaces ITEMS.discriminators.max (Scr L527, Scb L452)
computeScore(module, answers) → ScoreResult
   ScoreResult = { domains: Record<key,{pts,max,pct,label,openPts,negative}>, total, floor, ceiling, coverage, scorable, answered, count,
                   band: Band, open: (Item & {domain, domainLabel})[] }        // identical keys to Scr useScore; clamp to [0, positiveMax]
bandGeometry(cuts, max) → { zones:[{band:'low',w:34},{band:'moderate',w:33},{band:'high',w:33}], ticks:[0,34,67,100],
                            rangeText:{low:'< 34', moderate:'34–66', high:'≥ 67'}, lowest:'low', highest:'high' }
   NOTE: Scr L1217 typed zones 33/33/34 by hand; the derived widths are 34/33/33. The meter is visual only; recorded as an allowed difference (§6.4 G14).
BAND_INTERP = {low:'L', moderate:'N', high:'H'}                                (Scr L1450, Scb L1256)
BAND_META = {low:{c,bg,label:'Low likelihood'}, moderate, high, indeterminate:{…'Not scorable — screen incomplete'}}   (Scr L865-870; Scribe short labels 'Low'/'Moderate'/'High'/'Not scorable' as BAND_META[b].short)
```

`Screener` wraps it: `const score = useMemo(() => computeScore(module, answers), [module, answers])`.

### 3.2 `engine/rules.js` — the rule evaluator and the exact predicate state shapes

```
makeRoutingState({module, score, answers, ctx, complaint}) → RoutingState
   RoutingState = {
     band, scorable, total, floor, ceiling, coverage, answered,           // from ScoreResult
     domains,                                                              // ScoreResult.domains — closures write s.domains.vestibular.pct
     answers, ctx, complaint,                                              // raw state
     items: Record<id, Item>, negativeItems: Item[], negativeDomains: string[],
     lowest: 'low', highest: 'high'                                        // from bandGeometry, so a rule can say s.band !== s.lowest
   }
evaluateRouting(module, {state, flags}) → { gate: null | 'override' | 'incomplete', recs: Rec[] }
   flags = { active: RedFlag[], override: boolean, emergent: boolean }
   Engine order (Scr L895-913, not module-configurable): override → gate 'override', recs = [ {…copy.gate.withheld({emergent}), chips: active.map(f=>f.action)} ];
   else !scorable → gate 'incomplete', recs = [ {…copy.gate.incomplete({answered,floor,ceiling}), chips: openDomainChips} ] where openDomainChips = domains with openPts>0 → `${label} · ${openPts} pts unanswered`;
   else recs = rules.routing.rules.filter(r => r.when(state)).map(materialise) ; if empty → [fallback].
   materialise = r => ({ id:r.id, h:r.h, p: typeof r.p==='function'? r.p(state): r.p, chips: typeof r.chips==='function'? r.chips(state): r.chips })
   Scribe passes the same call; it renders recs only when routingCleared (engine gate in component) and buildNote consumes gate + recs.

derivePhenotype(module, answers) → string          first rule in phenotypes.derive whose when({answers}) is true → value; else phenotypes.default
activeDomains(module, {answers, complaint}) → Set<string>   scribe.activation.always ∪ domains of every rule whose when({answers, complaint}) is true
gapSignals(module, ctx) → { hits: {ctxId, option, signal}[], alert: boolean }   hits = options with `signal` whose value === ctx[id]; alert = hits.length >= gap.threshold
evaluatePatientSummary(module, state) → { said: string[], ask: string[] }
   PatientSummaryState (built by patient.buildSummary) = {
     a: Record<id, Answer|'unsure'>, ctx, loc,
     S: module.locales[loc].sum,
     yes: id => a[id]==='yes', scale: id => typeof a[id]==='number' ? a[id] : null, unsure: id => a[id]==='unsure',
     L: xs => list(xs, loc)
   }
   said = rules.patientSummary.said.filter(r=>r.when(s)).map(r=>r.text(s)); ask likewise. Order = array order (Pat L910-953 order preserved in the MASQUE data).
```

The MASQUE `rules.js` defines module-local helpers (`const mig = s => ['m_photo',…].filter(s.yes)` etc.) and uses them inside closures; that keeps the feature groups in one place without adding a group DSL to the contract.

### 3.3 `engine/fhir.js` (Scr L424-472, L474-519, L521-558; Scb L1254-1316 as bundle base — D7)

```
buildQuestionnaire(module, {date = todayISO()}) → Questionnaire        Scr L424-472 with fhir.* substituted; keeps `initialSelected:false` no-op for byte parity
buildCdsHooks(module) → {discovery, exampleResponses}                  Scr L474-519 generated: prefetch priorScreens uses `${fhir.codeSystem}|${fhir.indexCode}`;
                                                                       redFlagPresent.detail = `${flagsById[cds.exampleRedFlag.flagId].action}. ${copy.cds.withheld}`; notScorable {cards:[]} unconditional
buildDataDictionary(module, {appVersion}) → Dictionary                 Scr L521-558 (fuller field set) + { name:'module_id', type:'string', note:'Screening module that produced the row' } inserted after app_version's implicit position
                                                                       (canonicalCohortFields lists non-item columns; module_id added — §6.4 G6); scoring.discriminatorMin = negativeMin(module); bands = bandGeometry.rangeText
buildBundle(module, {patient, answers, score, complaint, activeFlags, emergent, routingCleared, note?, now = new Date().toISOString()}) → Bundle
   Scb L1254-1316 verbatim with: fhir.* constants; referral = routingCleared && scorable && band !== lowest; specialty/reason from phenotypes.values[complaint].referral;
   DocumentReference entry only when `note` is provided (Screener passes none → matches old Screener shape); attainable-range low = floor (fix).
   Screener passes routingCleared = !override; Scribe passes !override && safetyReviewed.
```

### 3.4 `engine/cohort.js` (Scr L66-79, L572-625; Sim L285-305)

```
CANONICAL_COLUMNS = ['screen_id','captured_at','instrument_version','app_version','module_id','score','label','reference_diagnosis','subject_id','visit_label','sex','gender','age','weight','annual_cost','avoidable_cost','complaint','coverage','scorable','band','red_flags']
subjectPseudonym(salt, mrn) → 's-'+16 hex                              Scr L69-79, salt injected
screenToCohortRow(module, {patient, answers, score, activeFlags, complaint, ctx, salt, appVersion, now, id}) → Row
   row.visit_label = ctx?.visit_label ?? '' (fix D7); module_id = module.id; then item columns in domain/item order ('' | index | 1/0)
rowsToCsv(rows) → string                                               Scr L608-616
makeCohort(spec: DemoCohort, ranges) → Row[]                           Sim L285-305 generalised: LCG seeded by spec.seed; each group draws label y (p .45) and score from ranges[group.range][y?'pos':'neg'];
                                                                       subject_id `s-${sex[0]}${gender[0]}${i}`, captured_at '2026-04-01'; extraRows appended verbatim
```

### 3.5 `engine/extract.js` (Ext L25, L172-300)

```
EXTRACTOR_KIND = 'rule-based / phrase-match with local negation'
createExtractor(lexicon) → { extract(text, opts={negationWindow?, includeSuppressed?}) → Capture[], negatedNear(text, idx, window?), firstHit, allHits }
   Capture = {id, value, kind: CaptureKind, evidence, cueIndex, suppressedBy?}   — Ext L217-268 verbatim with the eight globals replaced by lexicon.*; no branch on any id
faersToUtterances(payload) → Utterance[]                                Ext L284-300 unchanged
```

### 3.6 `engine/probes.js` (Prb L47-54, L301-345)

```
PROBE_KIND_ORDER = ['safety','rescue','criteria','ruleout','phenotype','exam']       (derived from PROBE_KIND ranks; replaces Scb L1027 / Sim L1409)
liveProbes(probes, answers={}, redFlags={}, answered={}) → Probe[]                   Prb L301-307 with `probes` injected; stable sort by rank
validateProbes(probes, itemIds, redFlagIds) → string[]                               Prb L322-345 + new rules: kind==='rescue' ⇒ has `rescues` and no `target`; `rescues` only on kind==='rescue';
                                                                                     membership checks are NOT skipped when arrays are empty (the module always supplies ids)
```

### 3.7 `engine/scribe.js` (Scb L728-738, L780-803, L1157-1180, L1195-1252)

```
ingest(captures, {answers, ctx, rf}) → {answers, ctx, rf}      first-write-wins items; ctx overwrite; redflag → 'nlp' never downgrading 'md'|'probe' (Scb L728-738); keeps capture.kind on the capture log
rankSuggestions(module, {answers, complaint, vmp, skipped, scorable}) → Suggestion[]
   Scb L780-803: pool = items unanswered && !skipped && (scorable || active.has(domain)); rank active → (gateDomain active && item.tag) → w desc;
   top infoPrompts.maxScored → {id, ask: item.ask, tag: item.tag ?? domain.shortTag ?? domain.label.toLowerCase(), scale, kind:'scored'};
   + infoPrompts.prompts with vmp[id]===undefined while gateDomain active, up to maxTotal.
   `skipped` is the D7 replacement for skipPrompt writing 'no': the component keeps `skipped[id]=true`; the item stays unanswered for scoring and FHIR.
captureLabel(module, capture) → string                          Scb L1157-1166 by capture.kind: 'redflag' → flag.points; 'ctx' → matching option signal?.short ?? `${item.text}: ${label}`; 'item' → item.short (+ scale label)
buildNote(module, {patient, answers, ctx, vmp, score, complaint, routing:{gate,recs}, gapAlert, activeFlags, safetyReviewed, emergent, probeNotes, appVersion}) → string
   Scb L1209-1251 skeleton with copy.scribe.note slots; positive-item lines use item.short; context line joins gapSignals hits' `note` labels in contextItems order (Scb L1204-1206 order is c_dur, c_clin, c_dismiss — allowed difference G15, or the module lists contextItems in that order… it cannot, Screener order is c_clin, c_dur, c_dismiss; see §6.4 G15)
```

### 3.8 `engine/patient.js` (Pat L193-211, L509-520, L902-994, L1096-1133)

```
PATIENT_CHROME = { en: {…UI.en minus sub/sections}, es: {…UI.es minus sub/sections} }   + the currently-English literals (Intro headings, Safety headings/buttons, 'Get seen today/this week', thin text) as en keys with es fallback-to-en (Q2)
TIER_DISPLAY = { emergent: 'now', urgent: 'soon' }  → chrome keys tierNow/tierSoon/tierNowWhat/tierSoonWhat, colours var(--coral)/var(--amber)
localeFor(module, loc) → { items: id → merged {…en, …loc}, redFlags, contextItems, blurbs, sum, patient, chrome, reviewed }   (generalised pFor/rfFor; loc must be in module.locales)
buildSummary(module, {a, ctx, flags, urgent, loc}) → { said, ask, gapLine, unsureList, clin, flags, urgent, ctx, loc }
   said/ask via rules.evaluatePatientSummary; gapLine = hits.length >= threshold ? S.gap(...signalBooleansInContextOrder) : null;
   unsureList = items in domain/item order with a[id]==='unsure' (≡ Pat P key order — verified equal for MASQUE);
   clin loop = Pat L962-972 using `item.short` as the clinical text (Pat used `it.c`, the clinical abbreviation). WP0 diffs Pat `c` against Scb `shortLabel` for all 30 items;
   where they differ, `item.short` = Scribe's and the Patient text is kept as `locales.en.items[id].clin` (read by buildSummary in preference to item.short when present). See Q6.
askForm(module, loc, id) → string       Pat L981-986: locale transform table in engine: en {I've→Have I, I→Do I}, es {'.'→'?'}
list(xs, loc) → string                  Pat L988-994: joiner table {en:{and:'and', oxford:true}, es:{and:'y', oxford:false}}
summaryText(module, summary, loc, {appVersion}) → string   Pat L1096-1125; footer `${module.name} v${appVersion}`; unreviewed line from shell CAVEATS when !reviewed
```

### 3.9 `engine/validate.js` — `validateModule(module)`; complete assertion list

Errors (E) fail the module (App shows a red panel and does not mount apps; tests fail). Warnings (W) are shown but pass.

Identity & versions: E1 id matches `/^[a-z][a-z0-9_-]*$/`; E2 name, label non-empty; E3 icon ∈ ICON_NAMES; E4 versions.{instrument,lexicon,probeSet,goldSet} non-empty strings.
Domains/items: E5 ≥ 1 domain, unique keys, ≥ 1 item each; E6 item ids unique across items ∪ contextItems ∪ redFlags ∪ infoPrompts.prompts; E7 every item has id, finite w ≠ 0, text, short, ask; E8 scale: length ≥ 2, every f finite, **at least one option with f === 0** (Inv §4.5), labels non-empty; E9 boolean items have no scale; E10 per domain Σw === max (positive domains) / Σw === max (negative domains, both negative); E11 negative domains have every w < 0 and positive domains every w > 0; E12 Σ positive max > 0 and cuts.moderate < cuts.high < positiveMax; E13 ref, tag are strings when present; W1 positiveMax !== 100 (dictionary/meter assume a 0–100 scale label; allowed but flagged).
Context/gap: E14 contextItems unique ids, ≥ 2 options each, unique values, labels; E15 signal options: count ≥ gap.threshold ≥ 1; signal has alert/short/note.
Red flags: E16 ≥ 1; unique ids; tier ∈ TIERS; group/text/points/action non-empty; E17 no `w`/`weight`/`f` key on any flag.
Steps: E18 keys unique and not reserved; extras ⊆ STEP_EXTRAS; E19 every domain key in exactly one screener step and exactly one patient step; every domainKey exists; E20 exactly one screener step has 'complaint' (the phenotype picker is where complaint state comes from) and at most one step per list has 'context'; E21 screener steps have title.
Phenotypes: E22 default ∈ values.k; values unique; each value has h, d, referral.specialty, referral.reason, cdsTerm; E23 derive rules have id, function when, value ∈ values.k.
Scribe: E24 activation.always ⊆ domain keys; rules' domains ⊆ domain keys; E25 infoPrompts.gateDomain ∈ domain keys; prompts have id/tag/ask; tagPrefix string; maxScored ≤ maxTotal.
Rules: E26 routing.rules unique ids, when is a function, h string, p string|function, chips array|function; fallback has h/p/chips; E27 patientSummary.said/ask entries have id, when fn, text fn; E28 **smoke evaluation**: every routing rule's when/p/chips and every summary rule's when/text is invoked against every sample case (and an empty state) and must not throw (catches ReferenceErrors inside closures, which static checks cannot).
FHIR/CDS: E29 all Fhir strings non-empty; questionnaireUrl/codeSystem/answerSystem/criteriaSystem/weightExtension parse as URLs; E30 cds.exampleRedFlag.flagId ∈ flag ids; cardIds, serviceId, source.label/url non-empty.
Samples: E31 case ids unique; buttonLabel/label/icon (∈ ICON_NAMES); answers keys ⊆ item ids; scale answers integer within range; boolean answers ∈ {'yes','no'}; ctx keys ⊆ context ids and values ∈ options; rf keys ⊆ flag ids; complaint ∈ values.k; E32 patient has id/given/family/sex/gender/age/mrn and synthetic === true and **no dob key**; E33 transcript entries are ['md'|'pt', string]; W2 no case with a red flag / no case with total ≥ cuts.high / no case with all items unanswered (gate rehearsal set, Inv §4.5).
Lexicon: E34 every bool/scale id ∈ item ids (scale ids must be scale items; every band v and fallback < scale.length); ctx ids ∈ context ids with val ∈ option values; multi targets likewise by kind; E35 **redFlags keys === flag id set** (both directions); E36 every phrase and cue is lowercase and non-empty; negation/thirdParty/historical have integer window > 0; goldSet non-empty.
Probes: E37 validateProbes(probes, itemIds, flagIds) returns [] (all Prb rules + rescue rules); W3 probes empty.
Locales: E38 'en' present; every locale key ∈ ENGINE_LOCALES; E39 per locale: items keys === item ids; opts.length === scale.length for scale items; no opts on boolean items; redFlags keys === flag ids with q/say; contextItems keys === context ids with opts.length === options.length; blurbs cover every domain key appearing in patient steps without 'context'; sum has every key the en sum has (typeof equal); patient.{sub, storyIntro, storyHeading, storyLede, forClinicianLede} strings, forYouIf array, steps has every patient step key + intro/safety/summary; E40 reviewed is boolean; W4 reviewed false (expected for es; surfaces the banner).
Research: E41 title/target strings; threshold in (0,1); calibration.midpoint/slope finite; sources [name,purpose] pairs; expected includes 'score','label','sex','gender'; demo array; scoreAliases non-empty; artifactKey/etlScript strings; fairnessAxes ⊆ expected; citations has the five keys; demoCohorts.ranges hi/lo with pos/neg pairs; cohorts unique ids, groups with n>0 and range ∈ {hi,lo}; E42 tolerance present ⇒ toleranceSetBy, toleranceRationale, toleranceSetOn all non-empty (attribution rule); tolerances in (0,1); W5 demo rows do not include a row with only one of sex/gender (Inv invariant 10 rehearsal).
Copy: E43 every key listed in the Copy typedef present with the right type (functions where declared); E44 no copy string contains 'Prototype' or 'not for clinical use' (caveats are shell-owned; a module must not duplicate or vary them).
Patient safety: E45 no Locale.redFlags[id].q/say equals or contains the clinician text/points/action of the same flag (guards against pasting the clinician set into the patient set).
Changelog: E46 non-empty array of {date, entry}.

`assertModule` throws `Error("[<name>] module invalid:\n" + errors.join("\n"))`. The registry calls `validateModule` for every entry at import and exposes `MODULE_ERRORS`; the App refuses to mount an invalid module (loud, not console-only — Inv risk 5).

---

## 4. Component contracts

### 4.1 `Screener({module, locale?})` — `.scr`
- State (all reset on remount): `step` (index into `[safety, ...module.steps.screener, result]`), `answers`, `ctx`, `rf` (`{id:true}`), `safetyReviewed`, `complaint`, `patient` (initial `module.samples.patient`), `cohort` rows, `showJson`, `toast`, `copied`.
- Derived: `score = computeScore`; `flags` from `rf`; `canContinue`: kind safety → `safetyReviewed || override`; step with extra 'complaint' → `!!complaint`; else true. Gates are in the component, not the module.
- Renders: banner (patient), brand row (`Icon module.icon`, `copy.screener.title v{APP_VERSION}`, subtitle), `SampleRail`, rail of steps (eyebrows from steps), safety step (RF_GROUPS derived from `module.redFlags`), content steps (StepCard per domainKey; ComplaintPicker from `phenotypes.values`; ContextQ from `contextItems`), ResultView (bandGeometry meter, outstanding list, domain bars, gap alert via gapSignals, recs via evaluateRouting, CDS preview via copy.cds + phenotype cdsTerm, write-back, pilot capture, spec downloads named `${module.id}-…`, bundle view, disclaimer from copy, EMR details with indexName), embedded `ResearchReadinessPanel` with `research={module.research}` and the same props as today (`itemIds` = positive-direction item ids? — no: unchanged, all ids; the panel excludes reverse-scored via host as today), footer.
- Props out: none (panel embedded). `locale` unused (English only, as today).

### 4.2 `Scribe({module})` — `.asc`
- State: transcript, cursor, playing, answers, ctx, vmp, `skipped` (new), asked, cohort, rf (`{id:'nlp'|'md'|'probe'}`), safetyReviewed, probeAns, probeNotes, input, view, toast.
- `extractor = useMemo(() => createExtractor(module.lexicon), [module])`; `complaint = derivePhenotype`; `suggestions = rankSuggestions`; `probes = liveProbes(module.probes, …)`; routing = `evaluateRouting` (recs shown only when `routingCleared = !override && safetyReviewed`); note = `buildNote`; bundle = `buildBundle(…, {note, routingCleared})`; Sign gated by `REQUIRE_SAFETY_REVIEW_TO_SIGN` from shell constants.
- Probe rail: grouped by `PROBE_KIND_ORDER`, caption from `PROBE_KIND[k].caption`, truncation from `PROBE_KIND[k].truncate/cap`, "re-asking {itemsById[pr.rescues].short}".
- Embedded panel as today (`phenotype={complaint}`, `modelVersion=\`${module.id}-scribe-prototype-${APP_VERSION}\``).

### 4.3 `PatientCompanion({module, locale, onLocale})` — `.mp` (CSS unchanged)
- State: `sec`, `a` (id → Answer|'unsure'), `ctx`, `rf`, `safetyDone`. Locale is lifted to the shell (D11); the in-app toggle is removed and the shell renders it; `onLocale` exists so the print/download footer can still switch if needed (used by nothing today — remove if the shell owns it fully; kept optional).
- Uses `localeFor(module, locale)`; steps `[intro, safety, ...module.steps.patient, summary]`; QBlock per domainKey with blurbs; story step renders `storyIntro`; ContextQ from `contextItems` with locale labels; Summary via `buildSummary`; never receives `redFlags[].points/action/text` (it reads `module.redFlags` only for `id`/`tier` and takes wording from the locale — enforced by test (e)).
- Unreviewed banner text comes from shell `CAVEATS.unreviewed[locale]`, shown whenever `!locale.reviewed`.

### 4.4 `ResearchReadinessPanel(props)` — backward compatible (Inv §4.1 #13, risk 10)
- Existing props unchanged with the same defaults (`project`, `score`, `band='low'`, `domains`, `coverage`, `sex`, `gender`, `signalQuality=null`, `scorable=true`, `ceiling=null`, `phenotype`, `modelVersion`, `redFlags`, `itemIds`, `capturedRows`, `instrumentVersion`).
- New optional props: `research` (a Research object; when given it wins over `project`), `moduleId` (for manifest/model card `module_id` and filenames; default derived from `project.toLowerCase()`), `indexName` (default `${project} index`), `appVersion`.
- `cfg = research ?? PANEL_PROJECTS[project]`; unknown `project` with no `research` → renders an error card "Unknown research project '{project}'" instead of silently using MASQUE (loud; siblings pass known keys).
- Score aliases: `['score', ...(cfg.scoreAliases ?? []), 'index']` in one place; legacy entries carry `scoreAliases: ['breathe_score']` / `['voiced_score']` so their CSVs still ingest.
- `parsed[cfg.artifactKey ?? 'masqueArtifact']`, `cfg.etlScript`, `cfg.fairnessAxes ?? ['sex','gender']`, `cfg.citations ?? MASQUE defaults`, tolerance override merged over `FAIRNESS_POLICY` only if attributed.
- "Load demo cohort" select next to "Restore demo": options from `cfg.demoCohorts?.cohorts`; loads `normalizeRows(makeCohort(spec, ranges))` with sourceName = label.
- Manifest/model card gain `module_id`; `modelVersion` default becomes `\`${moduleId}-prototype-${appVersion ?? 'unknown'}\``.

### 4.5 `SampleRail({cases, onLoad, onClear})`
Buttons `Icon(case.icon) case.buttonLabel` with `title={case.why ?? case.label}` and a Clear button. `onLoad(case)` — Screener applies: `answers = case.answers`, `ctx = case.ctx ?? {}`, `complaint = case.complaint ?? null`, `rf = case.rf ?? {}`, `safetyReviewed = true`, `step = last` (Scr L848-858; Sim `step:6` becomes `steps.length-1`).

### 4.6 `App` (shell) and `ModulePicker`
- State: `moduleId` (default `DEFAULT_MODULE_ID`, persisted in `localStorage['masque.module']` inside try/catch), `tab` ('screener'|'scribe'|'patient'), `locale` ('en'|'es', shown only when `tab==='patient'`), `walkOpen`.
- `module = getModule(moduleId)`; if `MODULE_ERRORS[moduleId]` → red panel listing errors, no apps.
- Renders header: brand mark (`module.icon`), `<select>` of `MODULES.map(m => m.label)` (D9: one real option), tabs, locale toggle, caveat banner `CAVEATS.prototype` (unconditional), the three apps with `key={module.id}` — all three stay mounted (`hidden` when not active) so tab switches keep state, module change remounts; walkthrough drawer when `module.copy.walkthrough?.[tab]`; About (changelog); footer `module_id · ${module.id} · release ${APP_VERSION} · instrument ${v.instrument} · lexicon ${v.lexicon} · probe set ${v.probeSet} · gold set ${v.goldSet}` + `Prototype · not for clinical use`.
- `document.title = \`${module.label} · screening · prototype\``.
- State ownership summary: shell owns moduleId/tab/locale; each app owns its screen state; the engine owns nothing (pure). Reset semantics: module change ⇒ React key change ⇒ every app's state, cohort rows, probe answers and transcript captures are discarded (Inv risk 6); tab change ⇒ nothing reset.

---

## 5. Appendix §5 — every hardcoded branch → new mechanism

### 5.1 Screener

| Old line | Branch | New mechanism |
|---|---|---|
| 83-92 | STEPS keys | `module.steps.screener` (intake{extras:complaint}, migraine, vestibular, neuro, impact{extras:context}, discriminators); Screener prepends fixed safety, appends fixed result |
| 290 | SAMPLE_CASES.redflag `rf:{rf_asym:true}` | `samples.cases[redflag].rf` (data; E31 checks the id) |
| 499 | CDS example detail hand-copies rf_asym.action | `buildCdsHooks`: `flagsById[cds.exampleRedFlag.flagId].action + '. ' + copy.cds.withheld` |
| 527 | `ITEMS.discriminators.max` | `negativeMin(module)` |
| 874 | `ctx.c_clin === "3+"` | `contextItems[c_clin].options['3+'].signal.alert` via `gapSignals` |
| 875 | `ctx.c_dur === ">12mo"` | same, option `>12mo` |
| 876 | `ctx.c_dismiss === "yes"` | same, option `yes` |
| 882 (897, 1230, 1332, 1561) | `tier === "emergent"` | engine vocabulary `TIER_RANK`; `emergent = active.some(f => f.tier === 'emergent')` computed once in the component (engine-fixed tier vocab, allowed) |
| 888 | `stepKey === "safety"` / `"intake"` | fixed step `kind==='safety'` → `safetyReviewed||override`; step `extras.includes('complaint')` → `!!complaint` |
| 914 (1340, 1455) | `band !== "low"` | `s.band !== s.lowest` inside module rule closures; Screener CDS preview and buildBundle use `bandGeometry.lowest` |
| 915 | `complaint === "sinonasal" \|\| "both"` | routing rule `sinus_migraine.when = s => ['sinonasal','both'].includes(s.complaint) && s.band !== s.lowest` |
| 916 | `complaint === "otologic" \|\| "both"` | routing rule `vestibular_migraine.when = s => ['otologic','both'].includes(s.complaint) && (s.band !== s.lowest \|\| s.domains.vestibular.pct >= 50)` |
| 922 | `domains.vestibular.pct >= 50` | inside that closure (module-owned domain key, engine-provided `s.domains`) |
| 927 | `domains.neuro.pct >= 50` | rule `neuro_overlay.when = s => s.domains.neuro.pct >= 50` |
| 934 | `answers.v_aural === "yes"` | rule `tinnitus.when = s => s.answers.v_aural === 'yes'` |
| 941 | `domains.discriminators.pts < 0` | rule `competing.when = s => s.domains.discriminators.pts < 0` |
| 943 | `Math.abs(domains.discriminators.pts)` | rule `competing.p = s => …${Math.abs(s.domains.discriminators.pts)}…` |
| 944 | `ITEMS.discriminators.items.filter(yes)` | rule `competing.chips = s => s.negativeItems.filter(it => s.answers[it.id]==='yes').map(…)` (engine supplies `negativeItems`) |
| 994-997 | `loadSample(key)` ×4 + labels | `SampleRail` over `samples.cases` (buttonLabel, icon) |
| 1086 | `<QGroup domainKey="recalcitrance" intro="Recalcitrance markers — …">` inside the intake card | step `intake{domainKeys:['recalcitrance'], extras:['complaint'], intro}`; the component renders picker → QGroup(recalcitrance, intro) in the fixed order. E19 guarantees recalcitrance is placed exactly once. |
| 1090-1092, 1094 | `<StepCard dk="migraine"/"vestibular"/"neuro"/"discriminators">` | steps `domainKeys` |
| 1101 | `<QGroup domainKey="impact"> + <ContextQ>` | step `impact{domainKeys:['impact'], extras:['context']}` |
| 1191-1193 | ContextQ rows | `module.contextItems` |
| 1344 | `complaint === "otologic" ? "otologic" : "sinonasal"` | `phenotypes.values[complaint].cdsTerm` |
| 1450 | interp map | `BAND_INTERP` (engine) |
| 1456 | specialty by complaint | `phenotypes.values[complaint].referral.specialty` |
| 1577 | referral reason by complaint | `phenotypes.values[complaint].referral.reason` |

(Non-§5 Screener literals from the §3.1 dependency table: L45→versions.instrument; L46→shell APP_VERSION; L80→fhir.questionnaireUrl; L315→samples.patient; L334→bands.cuts; L337→engine bandFor; L395→positiveMax; L421-422/447/467→fhir.*; L429-436→fhir.*; L443→fhir.safetyGroupText; L479-510→cds.*; L528/545/1217/1264→bandGeometry; L532→copy.indexName; L574/966/1407-1413→module.id; L585→ctx param (fixed); L602→engine ANSWER; L866→BAND_META; L898/906→copy.gate; L1003-1006→icon/copy.screener; L1023-1027/1049-1059→copy.screener.safety; L1068-1075→steps + phenotypes.values; L1137/1141→module.name / `${id}-prototype-`; L1178→engine chrome; L1231/1243/1437→copy.indexName; L1255→copy.screener.bandSuffix; L1305→copy.screener.gapAlert; L1334/1344→copy.cds; L1428→copy.screener.disclaimer; L1468-1537→fhir.*; L1545/1549→floor fix + BAND_META; L1580→copy.indexName.)

### 5.2 Scribe

| Old line | Branch | New mechanism |
|---|---|---|
| 452 | `ITEMS.discriminators.max` | `negativeMin(module)` (single dictionary builder) |
| 771 | `r_abx/r_surg yes \|\| m_head answered` | module helper `sin = a => ['r_abx','r_surg'].some(id => a[id]==='yes') \|\| a.m_head !== undefined` used by derive rules |
| 772 | `v_* answered && !== 'no'` | helper `oto` |
| 773 | both/otologic/sinonasal fall-through | `phenotypes.derive = [{id:'both', when: s => sin(s.answers) && oto(s.answers), value:'both'}, {id:'otologic', when: s => oto(s.answers), value:'otologic'}]`, `default:'sinonasal'` |
| 781 | base active set | `scribe.activation.always` |
| 782 | complaint → vestibular | `activation.rules[0] = {id:'oto', when: s => ['otologic','both'].includes(s.complaint), domains:['vestibular']}` |
| 783 | n_burn/n_viral → neuro | `activation.rules[1] = {id:'neuro', when: s => (s.answers.n_burn ?? 'no') !== 'no' \|\| s.answers.n_viral === 'yes', domains:['neuro']}` |
| 786 | `active.has("vestibular")` | `active.has(scribe.infoPrompts.gateDomain)` |
| 790 | VMPATHI_TAG boost | `gateActive && item.tag` |
| 796 | tag fallback `vestibular` special case | `item.tag ?? domain.shortTag ?? domain.label.toLowerCase()` (vestibular domain declares `shortTag:'vestibular'`) |
| 800 | info prompts gate | `infoPrompts.prompts` while gateActive, `maxTotal` |
| 836-838 | gap markers | `gapSignals(...).hits.map(h => h.signal.short)` |
| 844 (1000, 1215, 1306) | `tier === "emergent"` | engine tier vocab as 5.1 |
| 1027 | kind order | `PROBE_KIND_ORDER` |
| 1035-1037 | kind suffix copy | `PROBE_KIND[k].caption` |
| 1158 | `startsWith('rf_')` | `capture.kind === 'redflag'` (ingest keeps kind) |
| 1159 | `startsWith('c_')` | `capture.kind === 'ctx'` |
| 1160 | ctx label map | `option.signal.short` (`captureLabel`) |
| 1168-1178 | shortLabel ×30 | `item.short` |
| 1185-1191 | buildRecs predicates + copy | same `rules.routing` as the Screener (single copy — Screener wording; CHANGELOG entry; §6.4 G8) |
| 1202 | `VMPATHI_INFO.find` + prefix strip | `infoPrompts.prompts` + `tagPrefix` |
| 1204-1206 | ctx note labels | `signal.note` |
| 1256 | interp map | `BAND_INTERP` |
| 1259 | specialty by complaint | `phenotypes.values[complaint].referral.specialty` |
| 1311 | referral reason | `.referral.reason` |

(Others: L8-9 → engine imports + module lexicon/probes; L150-151 → versions/APP_VERSION; L169/346-347/372/392/1264-1299 → fhir.*; L404-436 → cds.*; L453/457 → bandGeometry/indexName; L496/508 → module.id / `complaint` column unchanged name (§4.3: nothing renamed); L557 → `[${name}]`; L566/584 → samples; L703 → Scribe({module}); L876-877/922/954/1127/1134-1136 → copy.scribe; L1044 → item.short; L1113-1116 → module.id; L1141-1142/1146/1148 → name/id/versions; L1210-1248 → copy.scribe.note slots; L1211 `patient.sex[0]` → `(patient.sex ?? '')[0] ?? ''`; L1303-1304 → fhir.documentType/Title; L1313 → indexName.)

### 5.3 Patient

| Old line | Branch | New mechanism |
|---|---|---|
| 383, 405 | UI.sections index-aligned | `locales[loc].patient.steps[stepKey]` (keyed, incl. intro/safety/summary) |
| 437 | SUM.migWords keys | stays inside `locales[loc].sum.migWords` (template data); rule `migWith.text = s => s.S.migWith(s.L(mig(s).map(k => s.S.migWords[k])))` |
| 443 | SUM.vWords | rule `vAlso` likewise |
| 445 | SUM.nWords | rule `neuro` likewise |
| 449, 457 | SUM.dWords / dShort | rules `disc`, `askDisc` |
| 523-529 | CONTEXT_Q ids | `module.contextItems` + `locales[loc].contextItems[id]` (values aligned, D6) |
| 535-539 | SECTIONS keys | `module.steps.patient` between fixed intro/safety and summary |
| 655 (829, 837, 838, 1023, 1024) | `tier === "now"` | `TIER_DISPLAY[flag.tier] === 'now'` ⇔ `flag.tier === 'emergent'` — `urgent = flags.some(f => f.tier==='emergent')` computed with engine vocab |
| 656 | `key === "safety"` gate | fixed step kind |
| 720 | `<QBlock domain="recalcitrance">` in story | `steps.patient[0] = {key:'story', domainKeys:['recalcitrance'], extras:['context']}` + `locales.patient.storyIntro` |
| 726 | five-domain includes | `step.domainKeys.length` (any step with domainKeys renders QBlocks) |
| 729 | BLURB[key] | `locales[loc].blurbs[domainKey]` |
| 910-914 | yes(r_dur…r_lesion) | said rules `dur, abx, surg, normal, lesion` with `when: s => s.yes('r_dur')`, `text: s => s.S.dur` |
| 916-917 | m_head > 0 | said rule `headFreq.when = s => s.scale('m_head') > 0`, `text = s => s.S.headFreq(s.scale('m_head'))` |
| 918 | mDur === 2 | said rule `durTypical.when = s => s.scale('m_dur') === 2` (index semantics stay in module data; the MASQUE rules.js names it `const M_DUR_TYPICAL = 2` with a comment citing the scale) |
| 919-920 | mig group ≥ 2 | helper `mig(s)`; rule `migWith.when = s => mig(s).length >= 2` |
| 922-923 | v_vertigo → vertigoT | rule `vertigo.when = s => (s.scale('v_vertigo') ?? 0) > 0`, `text = s => s.S.vertigo(s.S.vertigoT[s.scale('v_vertigo')])` |
| 924-925 | v_count, v_migfeat | rules `vCount`, `vMig` |
| 926-927 | vOther group | helper `vOther(s)`; rule `vAlso` |
| 929-930 | neu group | helper `neu(s)`; rule `neuro.when = s => neu(s).length > 0` |
| 932-934 | i_days / i_role | rules `days`, `role` with `> 0` |
| 936-937 | disc group | helper `disc(s)`; rule `disc` |
| 940 | migPattern | helper `migPattern(s) = (s.scale('m_head') ?? 0) > 0 && (mig(s).length >= 2 \|\| s.scale('m_dur') === 2)` |
| 941 | vestPattern | helper `vestPattern(s) = s.scale('v_vertigo') === 2 \|\| s.yes('v_count') \|\| s.yes('v_migfeat')` |
| 945-953 | ask tree | ask rules in order: `askBoth (migPattern && disc.length)`, `askMig (migPattern && !disc.length)`, `askVest (vestPattern)`, `askRefer (migPattern \|\| vestPattern)`, `askNeuro (neu.length >= 2)`, `askNormal (yes r_normal \|\| yes r_lesion)`, `askDisc (disc.length)`, `askTried (yes r_abx \|\| yes r_surg)`, `askNext (() => true)` |
| 949 | neu ≥ 2 | inside `askNeuro.when` |
| 950, 952 | r_normal/r_lesion, r_abx/r_surg | inside `askNormal`, `askTried` |
| 955, 957 | gap ctx values | `gapSignals`; `S.gap(...booleans in contextItems order)` — MASQUE contextItems order c_clin, c_dur, c_dismiss = old argument order (many, longTime, dismissed) |
| 967 | `it.scale && v === 0` skip | engine `buildSummary` clin loop (answer convention) |

(Others: L54-55 → versions/APP_VERSION; L193-194 → `localeFor`; L209/517 → `[${name}]`; L265/269 → engine TIER_DISPLAY colours; L381/403 → locales.patient.sub; L463/500 → sum.clinNote (module template, unchanged text); L510 → iterate module.locales; L644 → PatientCompanion({module,…}); L650 → shell default 'en'; L685 → shell CAVEATS.unreviewed.es; L697/705-706/779/815-817/849/855/1017/1087 → PATIENT_CHROME (en, es fallback — Q2) except condition-naming L705-707/787-788/1067 → locales.patient.*; L753/1119/1123 → name/versions/APP_VERSION; L984-985/989-992 → engine locale transform tables; L1010/1058 → chrome keys thin/notSureLede (now used).)

### 5.4 ResearchReadinessPanel

| Old | Branch | New mechanism |
|---|---|---|
| L783 `band = "low"` default | keep default (backward compat) — documented as the legacy default; hosts on the engine always pass band |
| L533, L648, L775-776, L823, L827, L967 axes | `cfg.fairnessAxes` (default `['sex','gender']`; axis default `[0]`) |
| L197, L216 score aliases | `['score', ...cfg.scoreAliases, 'index']` in one helper |
| L864 `parsed.masqueArtifact` | `parsed[cfg.artifactKey]` |
| L798 `PROJECTS[project] \|\| PROJECTS.MASQUE` | `research ?? PANEL_PROJECTS[project]`, unknown → error card |

### 5.5 Simulator (retired — D1/§6; every row lands somewhere or is dropped)

| Old line | Branch | Disposition |
|---|---|---|
| 320, 326, 329 | SCENARIOS answers/rf | `samples.cases` partial/high_redflag/ruleout (data) |
| 317-329 `step: 6` | SampleRail → `steps.length - 1` |
| 397-398 `.tier.emergent/.urgent` | engine tier vocab; CSS lives in Screener/Scribe scoped blocks |
| 467 STEP_DOMAIN | `module.steps.screener` |
| 480, 499, 532, 550, 556, 637, 640 step indices | fixed-step kinds + step arrays |
| 537, 552 `<Items domain=…>` | steps.domainKeys |
| 546-547 step intros by index | `steps.screener[].intro` (Screener wording wins; Sim wording dropped, CHANGELOG) |
| 614, 616 band literals | `bandGeometry.lowest/highest` |
| 685, 689-690, 784 axes | `research.fairnessAxes` |
| 892-915 PITEMS (7-item patient subset) | dropped — full `locales.*.items` supersedes (CHANGELOG) |
| 931-943 patient ask rules (3 items) | dropped — full `rules.patientSummary` supersedes |
| 954, 958 locale list / banner | shell locale toggle + CAVEATS.unreviewed |
| 1004 "the migraine question" rail copy | `copy.walkthrough.patient[]` (kept verbatim as walkthrough cards) |
| 1020-1026 LINES | dropped (Scb SCRIPT is `samples.transcript`) |
| 1029-1039 CUES, 1041 NEG, 1332 window | dropped — `module.lexicon` (full 0.3.1 set) |
| 1080-1304 probes | `module.probes` (from Prb, identical) |
| 1340 `startsWith("c_")` | `capture.kind` |
| 1409, 1413-1420, 1422, 1454 kind order/captions/truncation | `PROBE_KIND_ORDER`, `PROBE_KIND[k].caption/truncate/cap` (cap 2 — Scribe's value wins; Q7) |
| 1432 raw `p.rescues` | `item.short` |
| 285-305 makeCohort, 677-681 COHORTS | `cohort.makeCohort` + `research.demoCohorts` |
| 1400, 1494-1497, 1517-1544 rail copy | `copy.walkthrough.scribe[]` |
| 80-84 linear scoreItem, 134 POLICY, 135 CFG, 31-74 ITEMS, 117-130 RED_FLAGS | dropped (wrong / duplicated) |

### 5.6 Extraction
No engine branch on ids. `thirdPartyExempt` (L85) stays a per-entry flag in `Lexicon.bool[]`, read by `createExtractor` at the same point (L243). Kind literals `'redflag'|'item'|'ctx'` and `unnegated === undefined ? 'no' : 'yes'` are engine vocabulary (`CAPTURE_KIND`, `ANSWER`). Comments naming MASQUE move to `modules/masque/lexicon.js`.

### 5.7 Probes
`p.target && answers[p.target] !== undefined` (L305) unchanged; `p.kind === 'phenotype'` (L339) unchanged (kind literal is engine vocab); `'[MASQUE probes]'` (L343) → the error list is returned and prefixed by `validateModule` with `[${name}]`. All `when` closures and option ids are module content in `modules/masque/probes.js`, checked by E37 against the module's own ids (replaces the `[rmvnix]_` regex scrape).

---

## 6. The parity harness (D10) — `app/tests/`

### 6.1 Importing the 0.3.1 code at runtime (`tests/legacy.js`)
`loadLegacy(file, exportNames)`:
1. `fetch('../reference/fixed-src/' + file, {cache:'no-cache'})` — the tests page is served from `app/`, and the reference tree is served read-only beside it (the dev server root is the repo root for tests: `python -m http.server 8901` from `C:\Users\User\Documents\MASQUE`, page at `/app/tests/`). Nothing under `reference/` is written.
2. Append `\nexport { ${exportNames.join(', ')} };` to the source text.
3. Transform with `window.Babel.transform(src, {presets:[['react',{runtime:'classic'}]], sourceType:'module', filename})`.
4. Rewrite relative specifiers (`./ResearchReadinessPanel.jsx`, `./MASQUE_Extraction.js`, `./MASQUE_Probes.js`) to blob URLs built the same way (a 60-line copy of the loader's `build`, with the append hook; the runtime loader is not modified).
5. `import(blobUrl)` → namespace. Import-time side effects of the old files (Scb `assertRedFlagCues`, `validateProbes`) run against their own inline copies and pass.

Exports appended per file: Screener `{ITEMS, DOMAIN_ORDER, RED_FLAGS, SAMPLE_CASES, DEMO_PATIENT, BAND_CUTS, useScore, scoreItem, itemBounds, bandFor, buildQuestionnaire, buildCdsHooks, buildDataDictionary, screenToCohortRow, rowsToCsv, buildBundle, subjectPseudonym}`; Scribe `{ITEMS, computeScore, buildRecs, buildNote, buildBundle, buildQuestionnaire, buildCdsHooks, buildDataDictionary, screenToCohortRow, SCRIPT, PATIENT, ASK, VMPATHI_TAG, VMPATHI_INFO}`; Patient `{ITEMS, P, ES_P, ES_RF, RED_FLAGS, UI, SUM, CONTEXT_Q, buildSummary, askForm, list, summaryText, BLURB, BLURB_ES}`; Extraction and Probes need no append (already export).

Two old pieces are not plain functions: Scr `useScore` (hook) and Scr `recs` / Scb `complaint`+`suggestions` (inline `useMemo`s). Handling:
- `useScore`: `renderHook(fn, args)` — a throwaway component calls the hook and stores the result on a ref; rendered with `createRoot` + `flushSync` into a detached div. Used for 2,000 cases to prove Scr useScore ≡ Scb computeScore on the compared keys; the 50,000-case sweep uses Scb `computeScore` as the oracle.
- Inline logic: the suite files contain **transcribed oracles** — the 3-line override/incomplete/fallback logic (Scr L895-913, L946-950), the complaint memo (Scb L770-774) and the activation set (Scb L781-783) — each quoted verbatim in a comment next to its transcription. Everything longer is imported.

Determinism: before each golden generation the harness installs a fixed clock (`globalThis.Date` replaced by a subclass whose no-arg constructor and `Date.now` return 2026-09-22T12:00:00.000Z) and a seeded `Math.random`; restored after. For the old `screenToCohortRow` it sets `globalThis.ctx = {}` so the free identifier `ctx` (the L585 bug) resolves to an object and the old row can be produced; `screen_id` is compared by pattern.

### 6.2 Suite (a) — validate
`validateModule(m)` for every `MODULES` entry: pass iff `errors.length === 0`; warnings listed. Also asserts `MODULES.length === 1` and `MODULES[0].id === 'masque'` (D9) and that `PANEL_PROJECTS` has BREATHE/VOICED with `scoreAliases`.

### 6.3 Suite (b) — golden parity (computed both sides at run time; report shows a key-by-key diff)
For the MASQUE module, with the fixed clock:
| Artefact | New | Old | Allowed differences |
|---|---|---|---|
| Questionnaire | `buildQuestionnaire(m)` | Scr `buildQuestionnaire()` | none |
| CDS document | `buildCdsHooks(m)` | Scr `buildCdsHooks()` | none |
| Data dictionary | `buildDataDictionary(m,{appVersion:'0.3.0'})` | Scr `buildDataDictionary()` | G6 (+module_id field) |
| Data dictionary (scribe download) | same builder | Scb `buildDataDictionary()` | G6, G7 (new has subject_id/visit_label/gender) |
| Cohort row ×4 samples | `screenToCohortRow(m, …appVersion:'0.3.0')` | Scr `screenToCohortRow(…)` with `globalThis.ctx={}` | G1 (+module_id, position after app_version), screen_id by pattern |
| Bundle — screener context ×4 samples (+ redflag with override) | `buildBundle(m,{…, routingCleared:!override})` | Scr `buildBundle(…)` | G2 |
| Bundle — scribe context ×4 samples | `buildBundle(m,{…, note, routingCleared:true})` | Scb `buildBundle(…)` | none |
| Note ×4 samples | `buildNote(m, …)` | Scb `buildNote(…)` with old `buildRecs` output | G8 (rec copy), G15 (context line order) |
| Patient summaryText ×2 locales × 4 samples (answers + 'unsure' on 3 items) | `summaryText(m, buildSummary(...))` | Pat `summaryText(Pat.buildSummary(...))` | G11 (ctx values mapped), G13 |
Pass = every diff key is in the artefact's allowed list and every allowed difference actually appears (an allowed difference that does not appear is reported as "expected difference missing" — it means the fix was not applied).

### 6.4 Enumerated allowed differences
- **G1** cohort row: `module_id` column present (after `app_version`); `visit_label` '' (old only produces a value via the `globalThis.ctx` shim).
- **G2** screener bundle: `attainable-range.low = floor` and the Observation note text uses floor (D7); referral `reasonCode.text` ends `(${band})` not `(${band} likelihood)` (Scribe base, D7).
- **G6** dictionary: `canonicalCohortFields` gains `module_id`.
- **G7** Scribe's dictionary download is the full builder (gains subject_id, visit_label, gender, and G6).
- **G8** Scribe rec block/note/plan lines use the Screener rec copy (single copy). Headings identical; bodies and chips differ from old Scb L1187-1191.
- **G9** Scribe "Skip" leaves the item unanswered (was `'no'`).
- **G10** Scribe "re-asking" line shows `item.short` not the id.
- **G11** Patient context values are the Screener's (`0-1|2|3+`, `<3mo|3-12mo|>12mo`); old Patient labels 'Just one' etc. re-binned (Q1).
- **G13** every `app_version`/footer says 0.4.0 (compared against '0.3.0' by explicit expectation, not ignored).
- **G14** Screener meter zone widths 34/33/33 (derived) vs typed 33/33/34 — visual only, not in any artefact; listed for completeness.
- **G15** note Context line lists gap markers in `contextItems` order (c_clin, c_dur, c_dismiss) vs old Scb L1204-1206 (c_dur, c_clin, c_dismiss). Alternative: give `GapSignal` a `noteOrder` — rejected as speculative; Q8 asks the lead which order the note should use.
- **G16** `RedFlag.ask` dropped; `PROBE_KIND` gains caption/truncate; `initialSelected:false` kept (no artefact change).
No other difference is permitted.

### 6.5 Suite (c) — scoring sweep
- PRNG: mulberry32, seed `0x4D415351` (fixed; printed in the report).
- Size: 50,000 answer sets. Per item: `r < 0.25` → unanswered; else scale → uniform index `0..len-1`; boolean → `'yes'|'no'` uniform. Every 1,000th set is fully answered; every 1,001st is empty.
- Compare `computeScore(m, a)` with old Scb `computeScore(a)` on keys: `total, floor, ceiling, coverage, scorable, band, answered`, `domains[k].{pts,max,pct,openPts,negative,label}` for every k, and `open.map(o=>o.id)` (order). Plus 2,000 sets through `renderHook(Scr.useScore)` on the same keys + `count`.
- Pass = 0 mismatches; report prints first 10 mismatches with the answer set.

### 6.6 Suite (d) — rule parity, and structural checks
Over the 4 Screener sample cases, the 5 Simulator scenarios, and 20,000 sweep sets each paired with `complaint ∈ values.k` uniform, `ctx` (each context item: unanswered p .2 else uniform option), `rf` (p .1 one random flag), `safetyReviewed` (p .8):
- Routing: `evaluateRouting` vs oracle = old Scb `buildRecs(band, complaint, domains, scorable, answers)` for the five rules when `!override && scorable` — compare firing pattern (rule ids by heading equality) and count; override/incomplete/fallback vs transcribed Scr logic — compare gate value and `h`.
- Phenotype: `derivePhenotype` vs transcribed Scb L770-774.
- Activation: `activeDomains` vs transcribed Scb L781-783.
- Gap: `gapSignals(...).alert` vs `[c_clin==='3+', c_dur==='>12mo', c_dismiss==='yes'].filter(Boolean).length >= 2`.
- Patient: draw `a` with `'unsure'` (p .1) and compare `buildSummary` vs Pat `buildSummary` on `said, ask, gapLine, unsureList, clin[].{w,neg,t}` for both locales (old ctx values mapped through G11 so the gap booleans agree).
- Probes: `liveProbes(m.probes, …)` vs Prb `liveProbes(…)` on the same 20,000 states (ids and order) — the module's probe array must reproduce the reference set exactly.
- Extraction: `createExtractor(m.lexicon).extract(t, opts)` vs Ext `extract(t, opts)` over every `samples.transcript` line, every gold-set utterance (fetched from `reference/MASQUE_v0.3.1/…goldset.json`), and 5,000 random phrase concatenations drawn from the lexicon's own phrase lists with random negation/third-party prefixes — deep-equal captures for `includeSuppressed` true and false.
- (e) Patient never shows clinician text: render `PatientCompanion` for each locale with every item answered 'yes'/max, every flag on, into a detached root; assert `innerText` contains none of `redFlags[].{text,points,action}` and none of the strings 'score', 'band', '/100' (case-insensitive, whole-word).
- Layering: fetch each `src/engine/*.js` and assert its import specifiers are `./*.js` only; each `src/modules/masque/*.js` imports only `./` or `./locales/`; no `src/components/*` imports `../shell/`.
Pass = all zero mismatches.

### 6.7 What constitutes pass
The page shows one row per suite with counts; `document.documentElement.dataset.masqueTests = 'pass'|'fail'`; the lead runs it before deploying. There is no CI on this machine (no Node); the page is the CI.

---

## 7. CSS scoping plan and shell chrome

- `shell/css.js` owns `:root` tokens: the union of Screener/Scribe/Patient tokens (`--ink --petrol --petrol2 --surface --panel --line --muted --amber --amberbg --coral --coralbg --green --greenbg --slate --mono --sans --bg`), the global `* { box-sizing: border-box }`, `:focus-visible`, `prefers-reduced-motion`, and shell classes prefixed `.sh-` (header, brand, select, tabs, tab, locale, caveat, foot, drawer, about, errpanel).
- Screener CSS: every selector in Scr L629-810 is rewritten by prefixing `.scr ` (descendant) — `.card` → `.scr .card`, `.tier.emergent` → `.scr .tier.emergent`; token declarations and the three globals are deleted (moved to shell). Root element `className="scr"`. JSX class names are unchanged.
- Scribe CSS: same with `.asc `. Scribe's own `.mq` root class is dropped (Screener and Scribe both used `.mq` — the collision Inv risk 12 names).
- Patient: `.mp` rules unchanged, byte-for-byte, except the `:root`-less token block that Pat scopes on `.mp` already — left as is.
- Panel: `.rrp-` unchanged, fixed palette unchanged.
- Each component keeps `<style>{CSS}</style>`; three apps mounted concurrently inject three scoped blocks and one shell block; no unscoped rule survives (a test greps each CSS string for a selector not starting with its prefix).
- Shell chrome: header row = brand mark (module icon) · `<select class="sh-select">` labelled "Screening module" · tab strip (Clinician Screener / Ambient Scribe / Patient Companion) · locale segmented control (Patient tab only) · About button. Below it the unconditional caveat strip `CAVEATS.prototype`. Footer = module_id · release · instrument · lexicon · probe set · gold set · caveat. Unreviewed-locale banner is rendered by the shell above the Patient app whenever `!module.locales[locale].reviewed`. Walkthrough drawer (right edge, collapsed) when `copy.walkthrough[tab]` exists.
- Print: shell hides header/tabs/drawer; Patient's print rules unchanged.

---

## 8. Migration order and work packages

Preconditions for parallel work (must be merged first, in this order):
- **WP0 Contract + module extraction** (one implementer, serial): `engine/contract.js` (typedefs + vocab constants exactly as §2), `engine/validate.js` (§3.9 E1–E46), `modules/masque/**` extracted verbatim from the canonical copies with `CHANGELOG.md` listing every reconciliation (D6/D7: Screener red-flag text over Scribe/Sim; Screener rec copy; Patient context bins; dropped `RedFlag.ask`; Sim scale labels/scoreItem dropped; Patient `c` vs Scribe `short` comparison), `modules/registry.js`, `modules/TEMPLATE.md`. Acceptance: `validateModule(masque)` → 0 errors in a scratch page; every clinical string diff-checked against its source line (a throwaway script in the tests page that compares `module.domains[*].items[*].text` etc. to the legacy namespaces — this becomes part of suite (b)).
  Interface it provides to everyone else: the module object shape and the vocab constants. Nothing else can start until WP0 lands; after it, WP1–WP8 run in parallel against the signatures in §3/§4 (implementers stub what they consume).

Parallel packages:

| WP | Owned files | Depends on | Provides | Acceptance |
|---|---|---|---|---|
| WP1 engine-core | `engine/score.js`, `engine/rules.js`, `engine/cohort.js`, `engine/fhir.js`, `engine/download.js` | WP0 | §3.1–3.4 signatures | suites (b) golden for Questionnaire/CDS/dictionary/row/bundle, (c) sweep, (d) routing/phenotype/activation/gap parity |
| WP2 engine-nlp | `engine/extract.js`, `engine/probes.js`, `engine/scribe.js` | WP0 (and WP1's ScoreResult shape, on paper) | §3.5–3.7 | (d) extraction + probes parity; note golden (G8/G15); validateProbes new rules covered by a negative test (a probe with kind rescue + target must error) |
| WP3 engine-patient + PatientCompanion | `engine/patient.js`, `components/PatientCompanion.jsx` | WP0 | §3.8, §4.3 | (d) patient parity both locales; (e) no clinician text; summaryText golden; manual: es banner shows, print works |
| WP4 Screener | `components/Screener.jsx`, `components/SampleRail.jsx`, `components/icons.js` | WP0, WP1 signatures | §4.1, §4.5 | all four samples reproduce the 0.3.1 result screens (index, band, recs headings, CDS preview, capture row, bundle) side by side with `/masque/demo/`; 9 rail buttons; capture no longer throws |
| WP5 Scribe | `components/Scribe.jsx` | WP0, WP1, WP2 signatures | §4.2 | transcript playback reproduces the 0.3.1 captures and probes; skip leaves unanswered; re-asking shows short label; sign gate unchanged |
| WP6 Panel + research registry | `components/ResearchReadinessPanel.jsx`, `research/registry.js` | WP0 | §4.4 | legacy props render unchanged with `project="MASQUE"`, `"BREATHE"`, `"VOICED"` (screenshot compare); unknown project → error card; "Load demo cohort" produces the three cohorts with the Sim's verdicts (balanced PASS-able, unlabeled → validation withheld, disparate → FAIL + suppressed stratum); manifest/model card carry module_id |
| WP7 Shell | `shell/App.jsx`, `shell/constants.js`, `shell/css.js`, `app/index.html`, deletion of the four per-app pages and `src/MASQUE_*` copies | WP0; WP4–WP6 for integration | §4.6, §7 | page healthy per CLAUDE.md (`masqueReady`), dropdown has one option, tabs keep state, module key resets, caveats present on every tab and in print, CSS scoping test passes |
| WP8 Tests | `app/tests/**` | WP0 (can start immediately: legacy loader, PRNG, diff, suite skeletons with the oracles) | §6 | runs green against WP1–WP6 outputs; each allowed difference detected as "expected" |

Integration order: WP0 → {WP1, WP2, WP3, WP6, WP8} → {WP4, WP5} (they can start on day 1 against stubs but can only be *accepted* once WP1/WP2 land) → WP7 → full tests green → lead deploys to `/masque/app/` (D12).

Cross-package coupling deliberately minimised: components never import each other (the panel is imported by Screener/Scribe only, as today); engine files import only engine files; the only shared mutable surface is React state inside each component; the shell passes `module` down and nothing up except `onLocale`.

---

## 9. Open questions for the clinical lead, and self-assessed risks

Open questions (the code will not decide these silently; where a default is needed to ship, it is stated and logged in CHANGELOG):
- **Q1** Patient context bins (D6): aligning to `0-1 / 2 / 3+` and `<3mo / 3-12mo / >12mo` needs new patient labels ("Just one" → "One or none"? "Under 6 months" → "Under 3 months", "6 to 12 months" → "3 to 12 months") in English and Spanish. Proposed en labels: `["One or none","Two","Three or more"]`, `["Under 3 months","3 to 12 months","Over a year"]`; es: `["Uno o ninguno","Dos","Tres o más"]`, `["Menos de 3 meses","De 3 a 12 meses","Más de un año"]`. Needs sign-off; CONTEXT_Q was English-only, so the es strings are new content.
- **Q2** Un-localised Patient chrome (Intro, story heading/lede, Safety headings, "Get seen today/this week", thin text, disclaimer): ship with English fallback under the unreviewed banner (today's behaviour) or supply Spanish now?
- **Q3** Routing copy: one copy (Screener's fuller wording) now drives the Scribe rec block and note (G8). Confirm, or keep Scribe's shorter wording as a second copy set (adds `scribe:{p,chips}` to `RoutingRule`).
- **Q4** `RedFlag.ask` (Scribe, never read): dropped. Confirm.
- **Q5** `copy.scribe.note.supportingFooter` keeps the literal "Instrument v0.3 candidates" verbatim; it contains a version number that no constant owns. Reword or keep?
- **Q6** Patient clinician block uses Patient `c` strings; Scribe uses `shortLabel`. If the two sets differ for any item (WP0 reports the diff), which becomes `item.short`? Default: `item.short` = Scribe shortLabel; Patient keeps its `c` as `locales.en.items[id].clin` only where different.
- **Q7** Probe truncation cap: Scribe 2 vs Simulator 3 — 2 chosen.
- **Q8** Note "Context:" marker order (G15): contextItems order (clinicians, duration, dismissal) or the old note order (duration, clinicians, dismissal)?
- **Q9** Data dictionary: add `complaint` (emitted by the cohort row but never listed) alongside `module_id`? Default: not added (only D5's module_id).
- **Q10** CDS `exampleSettled` keeps "MASQUE index 78/100 …" as illustrative text rather than being computed from a sample case. Confirm.
- **Q11** Simulator scenario `why` copy refers to historical defects ("used to print Low likelihood from zero data") — keep as rail tooltips (default) or drop?
- **Q12** Meter zone widths (G14): derived 34/33/33 vs typed 33/33/34.

Self-assessed risks of this design:
- **R1 Closures in module data are opaque to `validateModule`.** A typo inside a `when` cannot be caught structurally; E28 smoke-evaluates every rule against every sample case and the empty state, and suite (d) covers 20,000 states, but a branch that only fires on an unsampled state could still hide a ReferenceError. Mitigation: E28 also evaluates against a synthetic "everything answered yes/max" and "everything answered no/0" state; second-module authors are told to add sample cases per rule.
- **R2 Single rec copy (G8) is a visible Scribe change.** It is the only place this design changes clinician-visible wording; Q3 can reverse it at the cost of one optional field.
- **R3 Screener/Scribe JSX rewrite volume.** WP4/WP5 rewrite ~2,900 lines of JSX around the new props; the parity suites cover the data paths, not the layout. Mitigation: side-by-side with `/masque/demo/` on the four samples as the acceptance check, and CSS prefixing done by a mechanical script rather than by hand.
- **R4 Old `useScore` via `renderHook`** depends on React 18 `flushSync` semantics under StrictMode; the tests page renders outside StrictMode. If it proves flaky, the 2,000-case cross-check is downgraded to a warning and the Scribe `computeScore` remains the oracle (the inventory already states their equivalence).
- **R5 Panel default `band='low'` retained** for sibling compatibility contradicts "never default to negative"; the engine-hosted apps always pass a band, so the default is reachable only from the legacy prototypes. Documented, not fixed here.
- **R6 Three apps mounted concurrently** triple the memory/CPU of the page versus one app per page and inject three `<style>` blocks; acceptable on desktop, untested on low-end mobile. Fallback is to mount only the active tab (loses tab-switch state, which is today's behaviour anyway).
- **R7 Locale coupling to the engine**: a module can only declare locales for which `PATIENT_CHROME` exists (`en`, `es`). A third language needs an engine chrome entry — a deliberate limit that keeps chrome strings out of the module, but it means "data-only second module" holds only for en/es.
- **R8 Tests fetch `reference/`** so the dev server root must be the repo root for the tests page, while the app is served from `app/` in production. The tests page is not deployed (D12 deploys `/masque/app/` only); if the lead wants it live, `reference/fixed-src` would have to be published too.
