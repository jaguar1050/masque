# Design candidate B — Parity-first / migration-risk

Module system for Project MASQUE, optimised for zero behavioural regression against `reference/fixed-src/` (0.3.1). Every section below is written against `docs/refactor/01-inventory.md` (line numbers cited as `Scr L…`, `Scb L…`, `Pat L…`, `RRP L…`, `Sim L…`, `Ext L…`, `Prb L…`) and within lead decisions D1–D12.

## 0. Lens and operating principles

Inventory §7 risks 1–5 (identifier drift, scoring regression, rule mistranslation, module-optional gates, drift guards not re-run) drive every choice here. The principles that follow from them:

| # | Principle | Consequence in this design |
|---|---|---|
| P1 | **Verbatim move, never rewrite.** Engine functions are the Screener's / Scribe's / Extraction's / Probes' bodies with globals replaced by parameters and nothing else touched. | `engine/score.js` is Scr L321-408 minus `useMemo`; `engine/extraction.js` is Ext L172-300 with the lexicon injected; `engine/probes.js` is Prb L47-54 + L301-345 with the probe list injected; `engine/fhir.js` is Scr L424-558 + Scb L1254-1316 with constants substituted. |
| P2 | **Data blocks stay byte-identical and are checked by value, not by eye.** The MASQUE module's source files hold each upstream block unchanged (same key order, same strings); `modules/masque/index.js` folds parallel maps (ASK, shortLabel, VMPATHI_TAG, P, ES_P …) into the contract shape at assembly time. | The parity page deep-equals every module data block against the old constant lifted from the reference file (§6). Divergences are enumerated, not discovered. |
| P3 | **Gates are engine code paths, not rule entries.** Override → routing withheld, unscorable → no result, safety review → routing, coverage → band, `{cards: []}`: all hard-wired in engine/shell (D8). Module rule lists only ever run *after* the gates. | A module that ships zero routing rules still gets the withheld/incomplete/none behaviour. |
| P4 | **Behaviour-as-data uses JS closures over a frozen, documented state shape** (D3), and every closure family has an old-vs-new oracle in the parity page. | §3.3 defines the state shapes; §6.4 defines the oracles (lifted inline functions). |
| P5 | **Something runs at every step.** Legacy pages (`app/screener.html` …) keep mounting the legacy files until the final retire package; each new app has a `dev/*.html` page that mounts it with the MASQUE module directly, without the shell. | Work packages are individually demonstrable and individually verifiable against `reference/fixed-src`. |
| P6 | **Enumerated allowed differences only.** The golden-file suite fails on any difference not listed in §6.3. D7 fixes are the list. | No "approximately equal". |

---

## 1. File layout under `app/`

All paths relative to `C:\Users\User\Documents\MASQUE\app\`. Every `.jsx` starts with `import React from "react"`; every relative import carries its extension; no other bare specifiers than `react`, `react-dom`, `react-dom/client`, `lucide-react`.

### 1.1 Pages and runtime

| File | Purpose | Exports |
|---|---|---|
| `index.html` | The one shell page (D11): import map, Babel standalone, `<div id="root">`, `noindex,nofollow`, boots `./src/shell/App.jsx` through the loader. Replaces today's card index. | — |
| `assets/masque-loader.js` | Unchanged runtime loader. | `boot` |
| `dev/screener.html`, `dev/scribe.html`, `dev/patient.html`, `dev/panel.html` | Per-app development pages: boot `./src/dev/Mount{Screener,Scribe,Patient,Panel}.jsx`, which render the generic app with the MASQUE module and no shell. Exist so each work package can be verified alone (P5). Not linked from the shell; deleted or kept at lead's discretion at the end. | — |
| `tests/index.html` | Browser self-check page (D10). Boots `./src/tests/TestRunner.jsx` via the normal loader. Served from the **repository root** (`python -m http.server` from `MASQUE\`, open `/app/tests/`) so `../../reference/fixed-src/` is fetchable; falls back to committed snapshots under `tests/golden/` when it is not. | — |
| `tests/golden/*.json` | Snapshots exported by the test page from a green run against the reference (questionnaire, cds, dictionary, cohort row, bundle ×2, sample-case scores, sample-case recs/summaries). Used when reference is unreachable (deployed host). | — |
| `screener.html`, `scribe.html`, `patient.html`, `simulator.html`, `src/MASQUE_*.jsx`, `src/MASQUE_*.js`, `src/ResearchReadinessPanel.jsx` | **Legacy** copies already in `app/src/`. Kept untouched until WP-Z (retire) so the site is runnable at every step. | as today |

### 1.2 `src/shell/`

| File | Purpose | Exports |
|---|---|---|
| `shell/App.jsx` | Shell root: module dropdown, app tabs (Clinician Screener / Ambient Scribe / Patient Companion), locale toggle (shown when the active app declares `supportsLocale`), unconditional caveat banner, footer with `module_id` + all version axes. Renders the active app under `key={module.id + ':' + tab}` so all app state resets on module change. Runs `validateModule` on selection; renders a blocking error panel on errors. Renders `module.copy.walkthrough` cards when present (D1). | `default App` |
| `shell/ModuleSelect.jsx` | `<select>` over `SCREENING_MODULES` from the registry; label = `module.label`, value = `module.id`. | `default ModuleSelect` |
| `shell/SampleRail.jsx` | Generic sample-case rail (D1): one button per `module.sampleCases[]` (`buttonLabel`, icon by name via `icons.js`, `why` as `title` attribute), plus Clear. Used by the Screener. | `default SampleRail` |
| `shell/CaveatBanner.jsx` | "Prototype · not for clinical use" strip + unreviewed-translation strip when `!module.locales[loc].reviewed`. Not parameterised by module beyond the reviewed flag. | `default CaveatBanner` |
| `shell/Footer.jsx` | `MODULE {module.id} · release {APP_VERSION} · instrument {instrumentVersion} · lexicon {lexicon.version} · probe set {probes.version} · gold set {lexicon.goldSet.version}`. | `default Footer` |
| `shell/constants.js` | `APP_VERSION = "0.4.0"`; `SITE = { REQUIRE_SAFETY_REVIEW_TO_SIGN: true, SITE_SALT: "CHANGE-ME-PER-SITE", SALT_IS_DEFAULT: true }`; `CAVEATS = { prototype: "Prototype · not for clinical use", illustrative: "illustrative — replace after validation", unreviewed: {es: "Traducción sin revisar", …} }`; `TIER_DISPLAY = { emergent: { patientKey: 'now' }, urgent: { patientKey: 'soon' } }`; `BAND_ORDER`, `LOCALE_NAMES`, `PATIENT_CHROME` (the locale-keyed shell part of Pat `UI`, see §2.14); `ABSTAIN_FLOOR = 0.55`. | named constants |
| `shell/icons.js` | Name → lucide component map for module data (`Stethoscope, Ban, ScanLine, Activity, TriangleAlert, Zap, FlaskConical, Users`). `iconFor(name)` returns `Info` for unknown names. | `ICONS, iconFor` |
| `shell/css.js` | Shell CSS string: design tokens on `.masque-shell` (the `--ink --petrol … --sans` set from Scr L629-640 verbatim), tab bar, dropdown, banner, footer. `scopeCss(css, rootSelector)` helper (§7). | `SHELL_CSS, scopeCss` |

### 1.3 `src/engine/` (plain JS, no React except `useScore`)

| File | Purpose | Exports |
|---|---|---|
| `engine/vocab.js` | Engine-wide fixed vocabularies (D2): `BANDS = ['low','moderate','high']`, `INDETERMINATE = 'indeterminate'`, `TIERS = ['emergent','urgent']`, `TIER_RANK`, `ANSWER_YES = 'yes'`, `ANSWER_NO = 'no'`, `PATIENT_UNSURE = 'unsure'`, `INTERP_BY_BAND = {low:'L', moderate:'N', high:'H'}`, `CAPTURE_KINDS = ['redflag','item','ctx']`, `PROBE_KINDS` order. | named constants |
| `engine/score.js` | Scr L321-408 verbatim, parameterised. | `scoreItem, itemBounds, bandFor, computeScore, useScore, bandLiterals` |
| `engine/rules.js` | Ordered-rule evaluator and the six rule families' state builders. | `evalRules, makeRoutingState, evalRouting, derivePhenotype, activeDomains, evalGap, evalReferral, evalCdsPreview` |
| `engine/suggest.js` | Scb L780-803 verbatim, parameterised (Scribe suggestion ranking + info prompts). | `rankSuggestions` |
| `engine/patient.js` | Patient core: locale accessors, generic `buildSummary` (Pat L902-975 with the L910-953 tree replaced by rule evaluation), `askForm`, `list`, `summaryText`, `download`. | `copyFor, flagCopyFor, buildSummary, askForm, list, summaryText, download` |
| `engine/fhir.js` | Questionnaire, CDS discovery/examples, data dictionary, transaction bundle. | `buildQuestionnaire, buildCdsHooks, buildDataDictionary, buildBundle, fhirHtml` |
| `engine/cohort.js` | Canonical fields, cohort row capture (ctx fix), CSV, pseudonym, downloads. | `CANONICAL_FIELDS, subjectPseudonym, screenToCohortRow, rowsToCsv, downloadText, downloadJsonFile` |
| `engine/cohortGen.js` | Sim L285-305 generalised: deterministic LCG cohort generator driven by a spec. | `makeCohort` |
| `engine/extraction.js` | Ext L172-300 with lexicon injection. | `EXTRACTOR_KIND, firstHit, allHits, cueBefore, createExtractor, faersToUtterances` |
| `engine/probes.js` | Prb L47-54 (+ `caption`, `truncate`), L301-345 with probe list injection and the two added rescue checks. | `PROBE_KIND, PROBE_KIND_ORDER, liveProbes, validateProbes` |
| `engine/note.js` | Scb L1195-1252 verbatim skeleton with module copy/labels substituted. | `buildNote` |
| `engine/validate.js` | `validateModule` (§3.10). | `validateModule` |
| `engine/index.js` | Re-exports. | * |

### 1.4 `src/apps/`

| File | Purpose | Exports |
|---|---|---|
| `apps/Screener.jsx` | Generic Clinician Screener (from Scr L824-1444 + StepCard/QGroup/ContextQ/ResultView). Takes `module`. CSS string = Scr L629-810 wrapped by `scopeCss(…, '.app-screener')`. | `default Screener` |
| `apps/Scribe.jsx` | Generic Ambient Scribe (from Scb L703-1153). CSS scoped under `.app-scribe`. | `default Scribe` |
| `apps/PatientCompanion.jsx` | Generic Patient Companion (from Pat L644-1094). `.mp` CSS unchanged. | `default PatientCompanion` |
| `apps/ResearchReadinessPanel.jsx` | RRP moved with the minimal edits listed in §4.4; `.rrp-` CSS unchanged. | `default ResearchReadinessPanel` |

### 1.5 `src/modules/`

| File | Purpose | Exports |
|---|---|---|
| `modules/contract.js` | The module contract as JSDoc typedefs (§2), plus `freezeModule(m)` (deep-freeze) and `assembleModule(parts)` (the fold: item.ask/short/tag/patient, flag.patient, domain.patientLabel, ctx labels). No clinical content. | `assembleModule, freezeModule` (types via JSDoc) |
| `modules/registry.js` | `SCREENING_MODULES = [masque]` (D9, exactly one); `PANEL_PROJECTS = { MASQUE: masque.research, BREATHE: …, VOICED: … }` (RRP L57-106 moved verbatim, panel-only); `getModule(id)`, `getPanelProject(key)`. | `SCREENING_MODULES, PANEL_PROJECTS, getModule, getPanelProject` |
| `modules/_template/TEMPLATE.md` | How to add a module as a data-only change: field-by-field checklist, the conventions (§2.0), how to run the self-check. | — |
| `modules/_template/template.module.js` | Skeleton `assembleModule({...})` call with every field present and placeholder values that make `validateModule` fail loudly until filled. | `default` |
| `modules/masque/index.js` | Assembles the MASQUE module from the parts below; `export default freezeModule(assembleModule({...}))`. | `default masque` |
| `modules/masque/identity.js` | `id 'masque'`, `name 'MASQUE'`, `label 'Dizziness'`, `icon 'Stethoscope'`, `INSTRUMENT_VERSION "0.2"` (Scr L45). | named |
| `modules/masque/instrument.js` | `ITEMS` (Scr L172-255 verbatim), `DOMAIN_ORDER` (Scr L257), `BAND_CUTS` (Scr L334), `DOMAIN_EXTRAS` (patientLabel per locale from Pat UI.sections[3..7], `shortTag: 'vestibular'` on vestibular, story domain flag). | named |
| `modules/masque/itemCopy.js` | `ASK` (Scb L239-270), `SHORT` (Scb L1168-1178 map literal), `TAG` (Scb L272-277), `INFO_PROMPTS` (Scb L279-282). | named |
| `modules/masque/redFlags.js` | `RED_FLAGS` (Scr L110-147), `RF_ASK` (the `ask` strings from Scb L186-235), `RF_PATIENT_EN` (q/say from Pat L225-262). | named |
| `modules/masque/steps.js` | `SCREENER_STEPS` (Scr L82-92 + the step copy from Scr L1023-1027, L1068-1070, L1086, L1090-1094, L1098-1100), `PATIENT_SECTIONS` (Pat L531-541 + UI.sections titles per locale), `COMPLAINT_PICKER` (Scr L1072-1076). | named |
| `modules/masque/context.js` | `CONTEXT_ITEMS` (Scr L1191-1193 values/labels; patient q per locale from Pat L522-529 with the D6-aligned values; `scribeLabel` from Scb L1160; `noteLabel` from Scb L1204-1206; gap marker labels from Scr L874-876 and Scb L836-838), `GAP_RULE = { threshold: 2, markers: ['c_clin','c_dur','c_dismiss'] }`. | named |
| `modules/masque/phenotypes.js` | `COMPLAINTS` vocab + default, `DERIVE` rules (Scb L771-773), `ACTIVATION` (Scb L781-783), `REFERRAL` rules (Scr L1456/L1577 ≡ Scb L1259/L1311). | named |
| `modules/masque/rules.js` | `ROUTING_RULES` (5; Scr L917-945 predicates, copy for screener from Scr, for scribe from Scb L1187-1191), `ROUTING_COPY` (Scr L896-911, L946-950 gate/fallback cards), `CDS_PREVIEW` (Scr L1334-1348), `PATIENT_SUMMARY` (groups/derived/said/ask from Pat L910-953). | named |
| `modules/masque/samples.js` | `SAMPLE_CASES` (Scr L261-312 + buttonLabels from Scr L994-997; Sim L314-330 scenarios re-keyed `sim-*`, icons by name, `FULL_HIGH` Sim L308-312), `DEMO_PATIENT` (Scr L314-317), `DEMO_TRANSCRIPT` (Scb L566-581). | named |
| `modules/masque/lexicon.js` | Ext L24 + L38-166 verbatim as `LEXICON = { version, negation, thirdParty, historical, bool, ctx, scale, multi, redFlags, goldSet: { version: '0.2.0', file: './goldset.json' } }`. | `default LEXICON` |
| `modules/masque/goldset.json` | Copy (not edit) of `masque_extraction_goldset.json` from the reference release. | — |
| `modules/masque/probes.js` | Prb L56-287 verbatim (`PROBES`, `VM_PROBES`), `PROBE_SET_VERSION = "1.0.0"`. | named |
| `modules/masque/locales/en.js` | `P` (Pat L137-188), `SUM.en` (Pat L428-464), `BLURB` (Pat L761-774 en), module part of `UI.en` (Pat L381, L383 + the English literals of Intro/Safety/Summary), `reviewed: true`. | `default` |
| `modules/masque/locales/es.js` | `ES_P` (Pat L297-348), `ES_RF` (Pat L350-375), `SUM.es` (L465-501), `BLURB_ES`, module part of `UI.es`, `reviewed: false`. | `default` |
| `modules/masque/research.js` | `PROJECTS.MASQUE` (RRP L25-56 verbatim) + `scoreAliases ['masque_score']`, `artifactKey 'masqueArtifact'`, `etlScript 'etl/masque_population_etl.R'`, `fairnessAxes ['sex','gender']`, `demoCohorts` (Sim L677-681 + specs from Sim L295-302), `citations`. | named |
| `modules/masque/fhir.js` | Systems and identities (Scr L80, L421-422, L429-438, L443, L447, L467, L1537; Scb L1303-1304). | named |
| `modules/masque/cds.js` | CDS ids/prose (Scr L476-517) as data with the example cards generated (§2.19). | named |
| `modules/masque/copy.js` | Titles/subtitles/indexName/patternName/note headings/about/disclaimer sources/walkthrough cards (Scr L1003-1006, L1137, L1243, L1428, L1433-1439; Scb L876-877, L1127, L1132-1137, L1210-1250; Sim L992-1013, L1511-1547). | named |
| `modules/masque/CHANGELOG.md` | Reconciliation log (D6): every divergence in inventory §2 and the choice made. | — |
| `modules/masque/README.md` | Header comments from all seven files (clinical rationale, instrument names, data sources). | — |

### 1.6 `src/dev/` and `src/tests/`

| File | Purpose |
|---|---|
| `dev/MountScreener.jsx` … `dev/MountPanel.jsx` | `() => <Screener module={masque} appVersion={APP_VERSION} site={SITE}/>` etc. |
| `tests/TestRunner.jsx` | Renders suite table; runs suites sequentially; exposes "Export snapshots". |
| `tests/harness/legacyImport.js` | `importLegacy(name, {appendExports, reactShim})`: fetch reference file → append `export {…}` → optionally rewrite `from "react"` to a shim → Babel classic → resolve its relative imports through the same routine → blob import (§6.1). |
| `tests/harness/lift.js` | `liftBody(source, startMarker, endMarker, params)` / `liftExpr(...)` → `Function` built from an inline block of the reference source (§6.1). |
| `tests/harness/prng.js` | `mulberry32(seed)`, `pick`, answer-set generators (§6.4). |
| `tests/harness/clock.js` | `withFixedClock(iso, fn)`, `withSeededRandom(seed, fn)` — swap `Date`/`Math.random` around old and new calls. |
| `tests/harness/deepEqual.js` | Structural equality with a path-reporting diff and `normalize(obj, allowedDiffs)`. |
| `tests/suites/validate.test.js`, `values.test.js`, `golden.test.js`, `sweep.test.js`, `rules.test.js`, `patient.test.js`, `extraction.test.js`, `probes.test.js`, `cohort.test.js`, `omissions.test.js` | §6. |

---

## 2. The module contract (`src/modules/contract.js`)

### 2.0 Conventions a module must obey (documented in TEMPLATE.md, asserted by `validateModule`)

- Answers: boolean items are `'yes'|'no'`, scale items a numeric option index, `undefined` = unanswered (never defaulted by the module). The patient app additionally stores `'unsure'`, which every engine function treats as unanswered.
- Bands `low|moderate|high|indeterminate`; tiers `emergent|urgent`; capture kinds `redflag|item|ctx`; probe kinds `safety|rescue|criteria|ruleout|phenotype|exam`. Fixed engine-wide (D2).
- Positive domain maxima sum to `bands.scaleMax` (100); each domain's `|w|` sum equals its declared `max`; every scale has an option with `f = 0`.
- Lexicon phrases lowercase; `scale[].bands` order significant; `multi` ctx values must equal a context option value.
- Rescue probes carry `rescues` and never `target`; phenotype options carry only `l`/`note`.
- Identifiers under `fhir`, `cds`, `id`, item/flag/group ids are opaque and must never be edited to match `label` (D4).
- Predicates are pure functions of the state object handed to them (§3.3). They must not read module globals other than their own module's constants and must not mutate.
- A module never renders JSX and never imports React.

### 2.1 Typedefs

```js
/**
 * @typedef {'low'|'moderate'|'high'} Band
 * @typedef {Band|'indeterminate'} BandOrIndeterminate
 * @typedef {'emergent'|'urgent'} Tier
 * @typedef {'yes'|'no'|number|undefined} Answer
 * @typedef {'en'|'es'} Locale                           // the shell's supported set; a module may ship a subset
 * @typedef {string|((s: object) => string)} Tpl        // literal or template closure over the family's state
 */

/**
 * @typedef ScaleOption
 * @property {string} label            // Scr L172-255; also the FHIR answerOption display
 * @property {number} f                // factor 0..1 (may be non-monotone)
 */

/**
 * @typedef Item                       // folded from Scr ITEMS + Scb ASK/SHORT/TAG + Pat P/ES_P
 * @property {string} id               // e.g. 'm_dur' — linkId, cohort column, lexicon/probe target (D4)
 * @property {number} w                // weight; negative in negative domains
 * @property {string} text             // clinician text (Scr)
 * @property {string} short            // Scb L1168-1178 short label — shown wherever a raw id was shown (D7)
 * @property {string} ask              // Scb L239-270 physician phrasing — Scribe suggestions
 * @property {ScaleOption[]} [scale]
 * @property {string} [ref]            // criterion code, emitted to fhir.criteriaSystem (Scr L467)
 * @property {string} [tag]            // Scb L272-277 'VM-PATHI · …' — suggestion boost + note (§2.11)
 * @property {Record<Locale,{q:string, opts?:string[], ask?:string, help?:string}>} patient // Pat P / ES_P per id
 */

/**
 * @typedef Domain                     // Scr ITEMS[key] + extras
 * @property {string} key              // 'recalcitrance' … — FHIR group linkId, `domain-${key}` code (D4)
 * @property {string} label            // clinician label (Scr)
 * @property {number} max              // signed declared max (−29 for discriminators)
 * @property {boolean} [negative]
 * @property {string} [shortTag]       // Scb L796: 'vestibular' — else label.toLowerCase()
 * @property {Record<Locale,string>} patientLabel   // Pat UI.sections[3..7] per locale
 * @property {Record<Locale,string>} [blurb]        // Pat BLURB/BLURB_ES[key]
 * @property {Item[]} items
 */

/**
 * @typedef RedFlag                    // Scr L110-147 + Scb ask + Pat q/say + ES_RF
 * @property {string} id               // 'rf_*' (D4)
 * @property {Tier} tier
 * @property {string} group            // 'Neurologic' | 'Systemic' | 'Otologic' | 'Sinonasal' — order of first appearance = display order
 * @property {string} text
 * @property {string} points           // clinician-only; never handed to the patient app
 * @property {string} action           // clinician-only
 * @property {string} [ask]            // Scb ask (kept; unread today — open question Q2)
 * @property {Record<Locale,{q:string, say:string}>} patient   // Pat L225-262 / ES_RF
 */
/* cue phrases live in lexicon.redFlags[id] (Ext L153-166); validateModule requires one list per flag */

/**
 * @typedef ContextItem                // Scr L1191-1193 canonical values; Pat CONTEXT_Q aligned (D6)
 * @property {string} id               // 'c_clin' | 'c_dur' | 'c_dismiss' — capture kind 'ctx'
 * @property {string} text             // Scr `t`
 * @property {Array<[string,string]>} opts          // [[value,label]] — Scr values '0-1'|'2'|'3+', '<3mo'|'3-12mo'|'>12mo', 'no'|'yes'
 * @property {Record<Locale,{q:string, opts:Array<[string,string]>}>} patient   // same values, patient-language labels (Q1)
 * @property {string} scribeLabel      // Scb L1160 capture tag
 * @property {string} noteLabel        // Scb L1204-1206
 * @property {{value:string, screenerLabel:string, scribeLabel:string}} [gapMarker]  // Scr L874-876 / Scb L836-838
 */

/**
 * @typedef GapRule
 * @property {number} threshold        // 2
 * @property {string[]} markers        // ordered ctx ids; order = positional args of locales[].sum.gap (Pat L460)
 */

/**
 * @typedef Step                       // Scr STEPS + step JSX copy (Scr L82-92, L1021-1105)
 * @property {string} key              // 'safety' | 'intake' | 'migraine' … 'result'
 * @property {'safety'|'domain'|'result'} kind      // safety first & mandatory; result last (engine enforces)
 * @property {string} eyebrow          // '00'
 * @property {string} title            // rail title
 * @property {string[]} domainKeys     // [] for safety/result
 * @property {('complaintPicker'|'context')[]} extras
 * @property {'complaint'} [requires]  // Scr L888 intake gate
 * @property {{eyebrow:string, heading:string, sub:string, intro?:string}} copy  // e.g. '01 · Intake', 'Presenting picture', …
 */

/**
 * @typedef PatientSection             // Pat SECTIONS + UI.sections + JSX (L705-729)
 * @property {string} key              // 'intro'|'safety'|'story'|<domainKey>|'summary'
 * @property {'intro'|'safety'|'story'|'domain'|'result'} kind
 * @property {string[]} domainKeys     // story: ['recalcitrance']; domain: [key]
 * @property {('context')[]} extras    // story carries the context questions (Pat L709)
 * @property {Record<Locale,string>} title          // UI.sections[i]
 * @property {Record<Locale,{heading?:string, lede?:string, intro?:string}>} [copy]  // Pat L705-707, L721 (English in both locales today — Q4)
 */

/**
 * @typedef Complaint                  // Scr L1073-1075
 * @property {string} value            // 'sinonasal'|'otologic'|'both' — cohort `complaint` column value (D4)
 * @property {string} h
 * @property {string} d
 */

/**
 * @typedef Phenotypes
 * @property {Complaint[]} values
 * @property {string} scribeDefault    // 'sinonasal' (Scb L773 fallthrough)
 * @property {Array<{value:string, when:(s: PhenotypeState)=>boolean}>} derive   // ordered, first match (Scb L771-773)
 * @property {string[]} alwaysActive   // Scb L781
 * @property {Array<{domains:string[], when:(s: PhenotypeState)=>boolean}>} activation  // Scb L782-783
 * @property {Array<{when:(s: RoutingState)=>boolean, specialty:string, reason:string}>} referral  // ordered; last is the fallback (Scr L1456/L1577)
 */

/**
 * @typedef RoutingRule                // Scr L917-945 ≡ Scb L1187-1191 predicates
 * @property {string} id
 * @property {(s: RoutingState)=>boolean} when
 * @property {Record<'screener'|'scribe', {h:Tpl, p:Tpl, chips:string[]|((s:RoutingState)=>string[])}>} copy  // missing app key = rule not shown in that app
 */

/**
 * @typedef RoutingCopy                // engine gate cards, module-worded (Scr L896-911, L946-950)
 * @property {{h:Tpl, p:Tpl}} withheld     // chips = activeFlags.map(f => f.action) (engine)
 * @property {{h:Tpl, p:Tpl}} incomplete   // chips = open domains `${label} · ${openPts} pts unanswered` (engine)
 * @property {{h:string, p:string}} none    // fallback card
 * @property {string} scribeNone           // Scb L1248 note line
 */

/**
 * @typedef CdsPreview                 // Scr L1330-1350
 * @property {string} safetyTitle      // 'MASQUE: red flag present — do not attribute to migraine before evaluation'
 * @property {string} safetyTail       // '. The screening index is withheld from routing.'
 * @property {Array<{when:(s:RoutingState)=>boolean, title:string}>} indexTitle  // ordered; L1344 branch
 * @property {Tpl} indexBody           // L1347-1348
 */

/**
 * @typedef PatientSummaryRules        // Pat L910-953
 * @property {Record<string,string[]>} groups        // mig, vOther, neu, disc → item ids (Pat L919, L926, L929, L936)
 * @property {Record<string,(s:PatientState)=>any>} derived   // migPattern, vestPattern (Pat L940-941)
 * @property {Array<{id:string, when:(s:PatientState)=>boolean, text:(S:object, s:PatientState)=>string}>} said  // ordered (L910-937)
 * @property {Array<{id:string, when:(s:PatientState)=>boolean, text:(S:object, s:PatientState)=>string}>} ask   // ordered (L945-953)
 */

/**
 * @typedef InfoPrompt                 // Scb L279-282 — unscored, answers kept in `vmp` state
 * @property {string} id               // 'vmp_cog' | 'vmp_affect' — must NOT be an item id
 * @property {string} tag
 * @property {string} ask
 */
/** @typedef {{gateDomain:string, tagPrefix:string, items:InfoPrompt[], max:number}} InfoPrompts  // gateDomain 'vestibular', tagPrefix 'VM-PATHI · ', max 6 (Scb L786, L800, L1202) */

/**
 * @typedef SampleCase                 // Scr SAMPLE_CASES + Sim SCENARIOS (D1)
 * @property {string} id               // 'sinonasal'|'otologic'|'redflag'|'competing'|'sim-empty'|'sim-partial'|'sim-high'|'sim-redflag'|'sim-ruleout'
 * @property {string} label            // Scr label / Sim label
 * @property {string} buttonLabel      // Scr L994-997 'Sample: sinus' … ; Sim labels for sim-*
 * @property {string} [icon]           // lucide name (Sim: Ban, ScanLine, Activity, TriangleAlert, Zap)
 * @property {string} [why]            // Sim why
 * @property {string} complaint        // '' for sim-*
 * @property {Record<string,string>} ctx
 * @property {Record<string,boolean>} [rf]
 * @property {Record<string,Answer>} a
 */

/**
 * @typedef DemoPatient                // Scr L314-317 ≡ Scb L584 — no DOB by design
 * @property {string} id  @property {string} given  @property {string} family
 * @property {string} sex @property {string} gender @property {number} age @property {string} mrn @property {true} synthetic
 */

/**
 * @typedef Lexicon                    // Ext L24, L38-166 verbatim, renamed keys only
 * @property {string} version          // '0.3.1'
 * @property {{window:number, cues:string[]}} negation       // window 14 travels with the lexicon (D5)
 * @property {{window:number, cues:string[]}} thirdParty
 * @property {{window:number, cues:string[]}} historical
 * @property {Array<{id:string, ph:string[], thirdPartyExempt?:boolean}>} bool
 * @property {Array<{id:string, val:string, ph:string[]}>} ctx
 * @property {Array<{id:string, cue:string[], bands:Array<{ph:string[], v:number}>, fallback:number|null}>} scale
 * @property {Array<{ids:Array<{id:string, value:any, kind:'item'|'ctx'}>, ph:string[]}>} multi
 * @property {Record<string,string[]>} redFlags     // RF_PHRASES
 * @property {{version:string, file:string}} goldSet  // '0.2.0', './goldset.json'
 */

/**
 * @typedef Probe                      // Prb exact shape
 * @property {string} id @property {string} kind
 * @property {(answers:Record<string,Answer>, redFlags:Record<string,any>)=>boolean} when
 * @property {string} [target] @property {string} [rescues]
 * @property {string} say @property {string} why
 * @property {Array<{l:string, rf?:string, a?:Record<string,Answer>, note?:string}>} opts
 */
/** @typedef {{version:string, list:Probe[]}} ProbeSet */

/**
 * @typedef LocalePack
 * @property {boolean} reviewed                    // en true, es false (Pat L294)
 * @property {Record<string,{q:string, opts?:string[], ask?:string, help?:string}>} items   // P / ES_P (key order preserved — Pat L960)
 * @property {Record<string,{q:string, say:string}>} redFlags                              // RF patient copy / ES_RF
 * @property {object} sum                          // SUM[loc] verbatim (Pat L427-502) — templates referenced by PatientSummaryRules
 * @property {Record<string,string>} blurbs        // BLURB/BLURB_ES
 * @property {{sub:string, forYouIf:string[], storyHeading:string, storyLede:string, storyIntro:string,
 *             clinPattern:string, listAnd:string, listOxford:boolean, askTransform:'en'|'none'}} ui
 *   // sub: Pat L381/L403; forYouIf: Pat L787-788; story*: Pat L705-707, L721; clinPattern: L1067 'migrainous/neuropathic pattern';
 *   // listAnd/listOxford: Pat L989-992 ('and', true / 'y', false); askTransform: Pat L984-985
 */

/**
 * @typedef Research                   // RRP PROJECTS.MASQUE (L25-56) + brand-derived knobs
 * @property {string} title @property {string} target @property {number} threshold
 * @property {{midpoint:number, slope:number}} calibration
 * @property {Array<[string,string]>} sources @property {string[]} expected @property {object[]} demo
 * @property {string[]} scoreAliases   // ['masque_score'] (RRP L197/L216)
 * @property {string} artifactKey      // 'masqueArtifact' (RRP L864)
 * @property {string} etlScript        // 'etl/masque_population_etl.R' (RRP L991)
 * @property {string[]} fairnessAxes   // ['sex','gender'] (RRP L775, L967)
 * @property {Array<{id:string, label:string, why:string, spec:CohortSpec}>} demoCohorts  // Sim L677-681 + L295-302
 * @property {Record<string,string>} [citations]   // §7.1 … strings used by the panel prose (RRP L425, L874, …)
 * @property {{selectionGapTolerance?:number, sensitivityGapTolerance?:number, specificityGapTolerance?:number,
 *             toleranceSetBy:string, toleranceRationale:string, toleranceSetOn:string}} [toleranceOverride] // only honoured when all three attribution fields present (§4.1 #3)
 */
/** @typedef {{seed:number, prevalence:number, hi:{pos:[number,number], neg:[number,number]}, lo:{pos:[number,number], neg:[number,number]},
 *             groups:Array<{sex:string, gender:string, n:number, hi:boolean, labeled:boolean}>, extraRows?:object[]}} CohortSpec */

/**
 * @typedef Fhir                       // all opaque (D4)
 * @property {string} questionnaireUrl // `http://masque.example/Questionnaire/masque-screener-v${instrumentVersion}` (Scr L80)
 * @property {string} questionnaireName   // 'MASQUEScreener'
 * @property {string} questionnaireTitle  // Scr L430
 * @property {string} publisher            // 'Project MASQUE — TOPx prototype'
 * @property {string} description          // Scr L436-438
 * @property {string} safetyGroupText      // Scr L443
 * @property {string} codeSystem           // 'http://masque.example/codes'
 * @property {string} answerSystem         // 'http://masque.example/answer'
 * @property {string} criteriaSystem       // 'http://masque.example/criteria'
 * @property {string} weightExt            // 'http://masque.example/StructureDefinition/item-weight'
 * @property {string} indexCode            // 'masque-index'
 * @property {string} indexDisplay         // 'MASQUE migraine/neuropathy screen index'
 * @property {{type:string, title:string}} documentReference  // Scb L1303-1304
 * @property {string} screenIdPrefix       // 'masque-' (Scr L574)
 * @property {string} filePrefix           // 'masque' → `${filePrefix}-pilot-cohort-…csv`, `-questionnaire-v…json` (Scr L966, L1407-1413)
 */

/**
 * @typedef Cds                        // Scr L476-517
 * @property {string} serviceId        // 'masque-screen'
 * @property {string} hook             // 'order-select'
 * @property {string} title @property {string} description
 * @property {{label:string, url:string}} source     // {'Project MASQUE', 'http://masque.example'}
 * @property {string} safetyCardUuid   // 'masque-safety'
 * @property {string} indexCardUuid    // 'masque-index'
 * @property {{redFlagPresent:{flagId:string, summary:string, detailSuffix:string},
 *             settledNonLowBand:{total:number, tail:string, detail:string}}} examples
 *   // flagId 'rf_asym' (detail = redFlags[flagId].action + '. ' + detailSuffix); total 78, tail 'high likelihood of a masked migrainous driver'
 * @property {CdsPreview} preview
 */

/**
 * @typedef Copy
 * @property {string} screenerTitle    // 'MASQUE Screener' (Scr L1005)
 * @property {string} screenerSubtitle // Scr L1006
 * @property {string} scribeTitle      // 'MASQUE Scribe' (Scb L876)
 * @property {string} scribeSubtitle   // Scb L877
 * @property {string} indexName        // 'MASQUE index'
 * @property {string} patternName      // 'migrainous / neuropathic driver' — used in Scr L1255 band suffix and note lines
 * @property {RoutingCopy} routing
 * @property {{screenerTitle:string, screenerBody:string, scribeTitle:string}} gapAlert  // Scr L1303-1308, Scb L954
 * @property {{title:string, footer:string, probeNotesFooter:string, screenHeading:string, incompleteSuffix:string}} note
 *   // Scb L1210, L1250, L1236 ('… Instrument v0.3 candidates.'), L1226
 * @property {{screener:string[], scribe:string[]}} about        // Scr L1433-1439, Scb L1132-1137
 * @property {{screenerSources:string, scribeVmpathi:string}} disclaimers  // module-specific parts (Scr L1428, Scb L1127); generic caveat is shell
 * @property {Array<{app:'screener'|'scribe'|'patient'|'panel', title:string, body:string}>} [walkthrough]  // Sim rails (D1)
 */

/**
 * @typedef ScreeningModule
 * @property {string} id               // 'masque'
 * @property {string} name             // 'MASQUE'
 * @property {string} label            // 'Dizziness' — dropdown/page title only
 * @property {string} icon             // 'Stethoscope'
 * @property {string} instrumentVersion // '0.2'
 * @property {string[]} domainOrder
 * @property {Record<string,Domain>} domains
 * @property {Item[]} allItems         // derived: flatMap in domainOrder, each with `.domain`
 * @property {Record<string,Item>} itemById
 * @property {Step[]} steps
 * @property {PatientSection[]} patientSections
 * @property {ContextItem[]} contextItems
 * @property {GapRule} gapRule
 * @property {RedFlag[]} redFlags
 * @property {string[]} redFlagGroups  // derived, order of first appearance
 * @property {{cuts:{moderate:number, high:number}, scaleMax:number}} bands   // {34, 67}, 100
 * @property {Phenotypes} phenotypes
 * @property {{routing:RoutingRule[], patientSummary:PatientSummaryRules}} rules
 * @property {InfoPrompts} infoPrompts
 * @property {SampleCase[]} sampleCases
 * @property {{patient:DemoPatient, transcript:Array<['md'|'pt',string]>}} demo
 * @property {Lexicon} lexicon
 * @property {ProbeSet} probes
 * @property {Record<Locale,LocalePack>} locales
 * @property {Research} research
 * @property {Fhir} fhir
 * @property {Cds} cds
 * @property {Copy} copy
 * @property {string} changelog        // './CHANGELOG.md' relative path (documentation pointer)
 */
```

### 2.2 Consumer map (which field is read where)

| Field | Screener | Scribe | Patient | Panel | Engine |
|---|---|---|---|---|---|
| id/name/label/icon | title, rail | title | footer | project key, filenames | screen_id prefix, modelVersion `${id}-prototype-${APP_VERSION}` |
| instrumentVersion | footer, spec names | footer, note | footer | prop | Questionnaire.version, dictionary, cohort row |
| domainOrder/domains/allItems | QGroup, ResultView bars | coverage, note, suggestions | QBlock, clin list | itemIds | score, fhir, cohort, validate |
| steps / patientSections | step body, rail, gates | — | section switch | — | validate (safety first) |
| contextItems / gapRule | ContextQ, gap alert | capLabel, note, gap alert | CONTEXT_Q, gap line | — | evalGap |
| redFlags | safety step, Flag resources | safety tab | Safety (patient copy only) | redFlags points strings | fhir, validate |
| bands | meter, ticks, dictionary text | readout | — | — | bandFor, bandLiterals |
| phenotypes | picker, referral | derive, activation, referral | — | phenotype prop | rules |
| rules.routing / copy.routing | recs | recs, note | — | — | evalRouting |
| rules.patientSummary | — | — | Summary | — | buildSummary |
| infoPrompts | — | prompts tab, note | — | — | rankSuggestions |
| sampleCases | SampleRail | — | — | — | tests |
| demo | patient banner | transcript playback, patient | — | — | — |
| lexicon | — | ingest | — | — | createExtractor |
| probes | — | probe rail | — | — | liveProbes/validateProbes |
| locales | — | — | everything | — | patient core |
| research | panel props | panel props | — | cfg | makeCohort |
| fhir / cds | builders, CDS preview | builders | — | — | fhir.js |
| copy | titles, about, disclaimers | titles, note | sub, forYouIf | — | note.js |

### 2.3 MASQUE values — source of every field (extraction map)

| Field | Take from | Fold/reconcile (logged in CHANGELOG) |
|---|---|---|
| domains/items | Scr L172-258 | + `short` Scb L1168-1178, `ask` Scb L239-270, `tag` Scb L272-277, `patient` Pat P/ES_P. Simulator/Patient item variants dropped. |
| domains.patientLabel | Pat UI.sections[3..7] en/es | Pat ITEMS `label`/`clinical` (never read) dropped. |
| domains.blurb | Pat L761-774 | recalcitrance has none (story step uses `ui.storyIntro`). |
| steps | Scr L82-92 + JSX copy | eyebrow `"05 · Impact & context"` etc. as typed. |
| contextItems | Scr L1191-1193 | Patient values aligned to `0-1/2/3+`, `<3mo/3-12mo/>12mo`; patient labels for changed bins are **new strings → Q1**; Scribe/Note/gap labels folded. |
| redFlags | Scr L110-147 | + `ask` Scb; + `patient` Pat L225-262/ES_RF (tiers now/soon → emergent/urgent mapping, display in shell). Scb/Sim shortened variants dropped (Scribe now displays Screener wording — allowed diff U3). |
| bands | Scr L334 | scaleMax 100 (derived and asserted). |
| phenotypes | Scr L1073-1075, Scb L771-783, Scr L1456/L1577 | — |
| rules.routing | Scr L914-945 predicates; copy Scr L917-945 / Scb L1187-1191 | Scribe copy differs from Screener copy by design — both kept, keyed by app. |
| copy.routing | Scr L896-911, L946-950; Scb L1248 | — |
| cds.preview | Scr L1330-1350 | — |
| rules.patientSummary | Pat L910-953 | SUM templates untouched. |
| infoPrompts | Scb L279-282, L786, L800 | — |
| sampleCases | Scr L261-312 (+ L994-997 labels), Sim L308-330 | sim-* ids prefixed; `step` dropped; icons by name. |
| demo | Scr L314-317, Scb L566-581 | Sim LINES dropped (superseded). |
| lexicon | Ext L24, L38-166 | Sim CUES/NEG dropped. |
| probes | Prb L56-290 | Sim copy dropped. |
| locales | Pat L137-188, L294, L297-375, L379-502, L761-774 | UI split: chrome keys → shell `PATIENT_CHROME`; content keys → `locales[].ui`. English-only literals stay English in es (Q4). |
| research | RRP L25-56 + L197, L864, L991, L775; Sim L677-681, L285-305 | — |
| fhir / cds | Scr L80, L421-438, L443, L447, L467, L476-517, L1537; Scb L1303-1304 | — |
| copy | Scr L1003-1006, L1226-1231, L1243, L1255, L1303-1308, L1428, L1433-1439; Scb L876-877, L954, L1127, L1132-1137, L1210-1250; Sim L992-1013, L1511-1547 | Sim "What to notice" → `copy.walkthrough`. |

---

## 3. Engine API

All functions pure unless stated. `module` is a `ScreeningModule`.

### 3.1 `engine/score.js`

```js
scoreItem(item, val)                       // Scr L321-327 verbatim
itemBounds(item)                           // Scr L360-367 verbatim
bandFor(v, cuts)                           // Scr L336-340 with cuts param → 'high'|'moderate'|'low'
computeScore(module, answers)              // Scr L369-408 body: DOMAIN_ORDER→module.domainOrder, ITEMS→module.domains,
                                           //   BAND_CUTS→module.bands.cuts, 100→module.bands.scaleMax.
                                           //   → { domains:{[k]:{pts,max,pct,label,openPts,negative}}, total, floor, ceiling,
                                           //       coverage, scorable, answered, count, band, open:[{...item, domain, domainLabel}] }
useScore(module, answers)                  // useMemo(() => computeScore(module, answers), [module, answers])
bandLiterals(bands)                        // → { rangeText:{low:'< 34', moderate:'34–66', high:'≥ 67'},
                                           //     ticks:[0,34,67,100], zones:[{w:34},{w:33},{w:33}], scaleMax:100 }
```

`computeScore` treats `'unsure'` as answered? No — the Patient never scores; the Screener/Scribe never produce `'unsure'`. `computeScore` keeps the verbatim `=== undefined` test. (`validateModule` refuses a module whose sample cases contain `'unsure'`.)

### 3.2 `engine/rules.js` — evaluator

```js
evalRules(rules, state, { mode: 'all'|'first' })   // runs `rule.when(state)` in array order; returns matching rules (all) or the first
```

### 3.3 State shapes handed to predicates (frozen contract)

```js
/** RoutingState — routing rules, referral rules, CDS preview */
{
  app: 'screener'|'scribe',
  answers, ctx, complaint,                         // raw app state
  band, total, floor, ceiling, coverage, scorable, answered, count, domains,  // computeScore output
  override, emergent, activeFlags,                 // RedFlag[]
  routingCleared,                                  // screener: safetyDone && !override; scribe: !override && safetyReviewed
  lowestBand: 'low', bands: ['low','moderate','high'],
  items: module.domains, domainOrder, negativeDomainKeys,
  yes(id), scale(id)                               // helpers: answers[id]==='yes'; numeric or null
}
/** PhenotypeState — derive + activation */
{ answers, complaint /* undefined during derive */, yes(id), answered(id) }
/** PatientState — patient summary rules */
{ a, ctx, yes(id), scale(id), unsure(id), L(xs) /* locale list joiner */, groups: {mig:[ids], …}, derived: {migPattern, vestPattern}, S /* locales[loc].sum */ }
/** GapState */ { ctx }
```

### 3.4 Rule-family functions

```js
makeRoutingState(module, { app, answers, ctx, complaint, score, activeFlags, routingCleared })
evalRouting(module, state)                 // ENGINE GATES FIRST (D8), then rules, then fallback:
  // if (state.override)      return app==='screener' ? [card(copy.routing.withheld, chips: activeFlags.map(f=>f.action))] : []
  // if (!state.scorable)     return app==='screener' ? [card(copy.routing.incomplete, chips: open domains)] : []
  // if (app==='scribe' && !state.routingCleared) return []
  // out = evalRules(rules.routing, state, 'all').filter(r => r.copy[app]).map(render)
  // if (app==='screener' && !out.length) out.push(copy.routing.none)
  // → Rec[] = [{h, p, chips}]
derivePhenotype(module, answers)           // evalRules(phenotypes.derive, PhenotypeState, 'first')?.value ?? phenotypes.scribeDefault
activeDomains(module, { answers, complaint })   // Set(alwaysActive ∪ activation rules that fire)
evalGap(module, ctx)                       // → { hits:[{id, screenerLabel, scribeLabel, noteLabel}], count, alert: count >= threshold, flags: markers.map(m => ctx[m]===gapMarker.value) }
evalReferral(module, state)                // evalRules(phenotypes.referral, state, 'first') → {specialty, reason}
evalCdsPreview(module, state)              // → { indexTitle, indexBody }
```

Parity notes: Screener recs order (Scr L895-950) = withheld → incomplete → rules → none; Scribe `buildRecs` returns `[]` when `!scorable` and is called with `scorable && routingCleared` (Scb L849) — both reproduced exactly by the gate order above.

### 3.5 `engine/suggest.js`

```js
rankSuggestions(module, { answers, complaint, vmp, scorable })
  // Scb L780-803 verbatim with: active = activeDomains(module,…); tagBoost = active.has(infoPrompts.gateDomain) && it.tag;
  // tag: it.tag || (domains[it.domain].shortTag ?? domains[it.domain].label.toLowerCase()); info prompts appended while items.length < infoPrompts.max
  // → [{ id, ask, tag, scale?, kind:'scored'|'info' }]
```

### 3.6 `engine/patient.js`

```js
copyFor(module, loc, id)                   // Pat L193: loc==='en' ? en.items[id] : {...en.items[id], ...locales[loc].items[id]}
flagCopyFor(module, loc, flag)             // Pat L194 generalised
list(xs, localeUi)                         // Pat L988-994 with {listAnd, listOxford}
askForm(module, loc, id)                   // Pat L981-986 with ui.askTransform
buildSummary(module, loc, { a, ctx, flags, urgent })
  // said/ask via rules.patientSummary; gapLine via evalGap + S.gap(...flags) (positional, Pat L957);
  // unsureList = Object.keys(locales.en.items).filter(unsure)  (Pat L960 key-order parity);
  // clin loop Pat L962-972 verbatim with it.c → it.text? NO: it.c is the Patient's clinical abbreviation; parity keeps it → item.short? See Q5.
  // → { said, ask, gapLine, unsureList, clin, flags, urgent, ctx, loc }
summaryText(module, loc, summary, chrome, { appVersion })   // Pat L1096-1125; footer `${module.name} v${appVersion}`
download(filename, text)                   // Pat L1127-1133
```

### 3.7 `engine/fhir.js`

```js
buildQuestionnaire(module, { date = today })      // Scr L424-472 with fhir.* substituted; keeps initialSelected no-op
buildCdsHooks(module)                             // Scr L474-519: ids/prefetch/source from cds+fhir; example cards generated:
  //   redFlagPresent.detail = redFlags.find(id===examples.redFlagPresent.flagId).action + '. ' + detailSuffix
  //   settledNonLowBand.summary = `${copy.indexName} ${total}/${bands.scaleMax} — ${tail}`; indicator 'warning'; notScorable: {cards: []}
buildDataDictionary(module, { appVersion })       // Scr L521-558; discriminatorMin = Σ max over negative domains; bands text from bandLiterals;
                                                  //   canonicalCohortFields = CANONICAL_FIELDS (adds module_id, complaint — allowed diff G5)
buildBundle(module, state, { now = new Date().toISOString() })
  // base Scb L1254-1316; state = { patient, answers, total, floor, ceiling, coverage, scorable, band, domains, complaint, activeFlags, emergent, routingCleared, note? }
  // + Screener's routing-override component (Scr L1516-1521) when override
  // + DocumentReference only when `note` is provided (Scribe)
  // referral gate: routingCleared && scorable && band !== lowestBand  (Screener passes routingCleared = !override → Scr L1455 exactly)
  // specialty/reason: evalReferral; reasonCode `${indexName} ${total}/${scaleMax} (${band} likelihood); administer confirmatory instrument.`
  // attainable-range low = floor (D7)
fhirHtml(obj)                                     // Scr L813-820
```

### 3.8 `engine/cohort.js`

```js
CANONICAL_FIELDS   // screen_id, captured_at, instrument_version, app_version, module_id, score, label, reference_diagnosis, subject_id, visit_label,
                   // sex, gender, age, weight, annual_cost, avoidable_cost, complaint, coverage, scorable, band, red_flags   (nothing renamed/dropped; module_id inserted after app_version)
subjectPseudonym(mrn, salt)                       // Scr L69-79
screenToCohortRow(module, { patient, answers, total, coverage, scorable, band, activeFlags, complaint, ctx = {} }, { appVersion, salt })
                   // Scr L572-606 with ctx param (D7 fix), screen_id `${fhir.screenIdPrefix}${…}`, module_id: module.id, item columns in domainOrder
rowsToCsv(rows); downloadText(...); downloadJsonFile(...)   // verbatim
```

### 3.9 `engine/extraction.js`, `engine/probes.js`, `engine/note.js`, `engine/cohortGen.js`

```js
createExtractor(lexicon) → { extract(text, opts), negatedNear(text, idx, window), lexiconVersion }
  // Ext L217-268 verbatim; NEGATION/THIRD_PARTY/HISTORICAL/BOOL_EX/CTX_EX/SCALE_EX/MULTI_EX/RF_PHRASES read from `lexicon`
firstHit, allHits, cueBefore, EXTRACTOR_KIND, faersToUtterances   // verbatim

PROBE_KIND         // Prb L47-54 + caption: {safety:' · could surface a red flag', rescue:' · alternate phrasing, not a repeated question',
                   //   phenotype:' · supporting features, recorded not scored', others ''} + truncate: {safety:false, rescue:false, others:true}
PROBE_KIND_ORDER   // ['safety','rescue','criteria','ruleout','phenotype','exam']  (Scb L1027)
liveProbes(probes, answers, redFlags, answered)   // Prb L301-307 with list param
validateProbes(probes, itemIds, redFlagIds, { moduleId })  // Prb L322-345 + (a) kind==='rescue' && !p.rescues → error; (b) p.rescues && p.target → error;
                   // (c) p.rescues && kind!=='rescue' → error; console prefix `[${moduleId} probes]`

buildNote(module, state)   // Scb L1195-1252: shortLabel→item.short, VMPATHI_INFO→infoPrompts, ctx labels→contextItems.noteLabel (order c_dur, c_clin, c_dismiss as Scb L1204-1206 — kept by listing noteOrder in module copy), strings→copy.note
makeCohort(spec)           // Sim L285-305 generalised: seed, prevalence, ranges, groups, extraRows
```

### 3.10 `engine/validate.js` — `validateModule(module) → { ok, errors[], warnings[] }`

Errors (any → shell refuses to mount the module):

1. Identity: `id` matches `/^[a-z][a-z0-9-]*$/`; `name`, `label`, `instrumentVersion` non-empty strings.
2. Domains: `domainOrder` non-empty, every key in `domains`, no extra keys; each domain has `label`, numeric `max`, non-empty `items`.
3. Items: ids unique across domains; each has numeric `w`, `text`, `short`, `ask`; scale items have ≥2 options each `{label, f:number}`; **every scale has an option with `f === 0`**; boolean items have no `scale`.
4. Weights: per domain `Σ|w| === |max|` (sign of max matches `negative`); `Σ max` over non-negative domains `=== bands.scaleMax`.
5. Bands: `0 < cuts.moderate < cuts.high ≤ scaleMax`, integers.
6. Red flags: ≥1 flag; ids unique, `tier ∈ TIERS`, `group`, `text`, `points`, `action` present; `patient[loc].q/say` for every shipped locale; **no `w`/`points:number`/`scale` key on a flag** (flags never scored).
7. Lexicon: `redFlags` has a non-empty list for every flag id and no unknown ids; every `bool/scale/multi(item)` id is an item id; every `ctx/multi(ctx)` id is a context item id and its value is one of that item's option values; all phrases/cues lowercase and non-empty; `negation.window` positive integer; `scale[].fallback` is `null` or a valid index; `scale[].bands[].v` valid indices; `version`, `goldSet.version` present.
8. Probes: `validateProbes(list, itemIds, redFlagIds)` returns no errors; `version` present; option `a` writes only valid indices/`'yes'|'no'` per item type.
9. Steps: first step `kind === 'safety'`, last `kind === 'result'`, exactly one of each; every `domainKeys` entry is a domain; every domain appears in exactly one step; extras ⊆ {complaintPicker, context}; if any step has `context` extra, `contextItems` non-empty; `requires:'complaint'` only if `phenotypes.values` non-empty.
10. Patient sections: first `intro`, second `safety`, last `result`; every domain appears exactly once (story counts); titles for every shipped locale.
11. Context/gap: ids unique and prefixed `c_`? — no prefix rule (D2 says kinds, not prefixes): ids unique and disjoint from item ids; `gapRule.markers` ⊆ context ids, each with a `gapMarker`; `threshold ≤ markers.length`; `patient[loc].opts` values equal canonical values in the same order.
12. Phenotypes: values unique; `scribeDefault ∈ values`; `derive[].value ∈ values`; `activation[].domains ⊆ domains`; `alwaysActive ⊆ domains`; `referral` non-empty and last entry's `when` returns true for an empty state (fallback).
13. Rules: `routing[]` ids unique, `when` functions, each `copy[app]` has `h`,`p`,`chips`; `patientSummary.groups` ids are item ids; `said/ask` are arrays of `{id, when, text}` functions; every `text` template key referenced resolves in `locales[loc].sum` for every shipped locale (checked by calling each `text` with a probe `S` proxy that records lookups).
14. Info prompts: ids disjoint from item ids; `gateDomain` is a domain.
15. Locales: `en` present; for every locale: `items` covers every item id (Pat L198-211: opts length === scale length; no opts on booleans); `redFlags` covers every flag; `sum` has the same key set as `en.sum`; `blurbs` keys ⊆ domain keys; `reviewed` boolean; locale ∈ shell-supported set.
16. Samples: ids unique; `a` keys ⊆ item ids with values valid for the item type (never `'unsure'`); `ctx` keys/values valid; `rf` keys ⊆ flag ids; `complaint ∈ values ∪ {''}`; `buttonLabel`; icon names resolve (warning if not).
17. Demo: patient has `id, mrn, sex, gender, age` and no `dob`/`birthDate` key; transcript entries `['md'|'pt', string]`.
18. FHIR/CDS: every field present and a string; `questionnaireUrl` ends with `instrumentVersion`; `examples.redFlagPresent.flagId` is a flag; `bandFor(examples.settledNonLowBand.total) !== 'low'`.
19. Research: `calibration.midpoint/slope`, `threshold`, `scoreAliases[]`, `artifactKey`, `fairnessAxes` non-empty; `demoCohorts[].spec.groups` supply both `sex` and `gender`; `toleranceOverride` (if present) has all three attribution fields or is rejected.
20. Copy: every key in §2.1 `Copy` present; `routing.withheld/incomplete/none` present.
21. Deep-frozen; no function values outside `rules`, `phenotypes`, `probes[].when`, `locales[].sum`, `copy.routing`, `cds.preview`.

Warnings: icon names unknown; locale `reviewed` true for non-`en`; `redFlags[].ask` present but unused; `citations` missing; sample set does not exercise all gates (no case with rf, no incomplete case, no negative-domain positive) — gate-rehearsal check from §4.5.

`omissions.test.js` additionally asserts, from outside the module: no clinician `points`/`action` string of any flag occurs in the Patient app's rendered text or `summaryText` output for any locale.

---

## 4. Component contracts

### 4.1 `Screener({ module, appVersion, site })`

- State (unchanged from Scr L825-835): `step, cohort, rf, safetyReviewed, patient, complaint, answers, ctx, showJson, toast, copied`. All owned locally; shell resets by remounting (`key`).
- Derived: `score = useScore(module, answers)`; `activeFlags = module.redFlags.filter(f => rf[f.id])`; `override/emergent`; `safetyDone`; `canContinue = step.kind==='safety' ? safetyDone : step.requires==='complaint' ? !!complaint : true`; `gap = evalGap(module, ctx)`; `recs = evalRouting(module, makeRoutingState(...,'screener'))`; `bundle = buildBundle(module, {...}, {})`.
- Renders steps from `module.steps`: `safety` → red-flag checklist grouped by `redFlagGroups`; `domain` → one `StepCard` per `domainKeys` entry, `complaintPicker` extra before, `context` extra after (Scr L1101-1103 order); `result` → `ResultView`.
- SampleRail in the brand row; `loadSample(case)` = Scr L848-858 (sets `safetyReviewed = true`, jumps to result).
- Panel: `<ResearchReadinessPanel project={module.name} research={module.research} moduleId={module.id} score=… itemIds={module.allItems.map(i=>i.id)} instrumentVersion={module.instrumentVersion} modelVersion={`${module.id}-prototype-${appVersion}`} … />`.
- Caveats: the disclaimer block keeps the generic sentence from shell `CAVEATS` and appends `copy.disclaimers.screenerSources`.

### 4.2 `Scribe({ module, appVersion, site })`

- State as Scb L703-726. `extractor = useMemo(() => createExtractor(module.lexicon), [module])`; `ingest` = Scb L728-738 using `extractor.extract`; captures keep `kind` (needed by `capLabel`).
- `complaint = derivePhenotype(module, answers)`; `suggestions = rankSuggestions(...)`; `probes = liveProbes(module.probes.list, answers, rf, probeAns)`; `recs = evalRouting(module, state{app:'scribe', routingCleared})`; `note = buildNote(...)`; `bundle = buildBundle(module, {..., routingCleared, note})`.
- `capLabel(c)`: branch on `c.kind` (`'redflag'` → `"RED FLAG: " + flag.points`; `'ctx'` → `contextItems.scribeLabel`; item → `item.short`).
- `skipPrompt`: info → `vmp[id]='skip'`; scored → **no write** (D7).
- Probe rail: iterate `PROBE_KIND_ORDER`, `shown = PROBE_KIND[k].truncate ? grp.slice(0,2) : grp`, caption from `PROBE_KIND[k].caption`, "re-asking {item.short}".
- Sign gate: `site.REQUIRE_SAFETY_REVIEW_TO_SIGN`.
- Drift guards (Scb L555-562) are replaced by `validateModule` at selection (shell) — Scribe additionally asserts at mount in dev (`console.assert`).

### 4.3 `PatientCompanion({ module, appVersion, locale, onLocaleChange })`

- State: `sec, a, ctx, rf, safetyDone`, and `loc` = controlled by `locale` prop when given, else internal (`'en'`).
- Locale buttons from `Object.keys(module.locales)`; chrome strings from shell `PATIENT_CHROME[loc]`; content from `module.locales[loc].ui`.
- Sections from `module.patientSections`; `QBlock` reads `module.domains[key]`; `Safety` reads `flag.patient[loc]` only (never `points/action` — the component receives a projected `{id, tier, q, say}` list, so it cannot).
- Summary via `buildSummary(module, loc, …)`; unreviewed banner from shell when `!module.locales[loc].reviewed`.
- Never receives `score` props; nothing in the module schema gives it a number to show (§4.2 of inventory).

### 4.4 `ResearchReadinessPanel(props)` — backward compatible (§4.1 #13, risk 10)

Existing props unchanged and defaults unchanged: `project, score=0, band='low', domains={}, coverage=0, sex=null, gender=null, signalQuality=null, scorable=true, ceiling=null, phenotype='', modelVersion, redFlags=[], itemIds=[], capturedRows=[], instrumentVersion=null`.

New optional props: `research` (a `Research` object; when present it wins over `project`), `moduleId` (default: `project.toLowerCase()`).

Minimal edits: `cfg = research || getPanelProject(project)`; unknown project → render a visible `rrp-error` block ("Unknown project …") instead of silently using MASQUE (RRP L798); score aliases = `cfg.scoreAliases ?? []` merged into the alias list once (L197/L216 collapse); `parsed[cfg.artifactKey]` (L864); ETL path `cfg.etlScript` (L991); axes from `cfg.fairnessAxes ?? ['sex','gender']` (L775, L967, default axis = first); filenames from `moduleId`; manifest/model card gain `module_id` and interpolate `cfg.title`/`${moduleId} index` where 'MASQUE' was literal (L874, L895); default `modelVersion` becomes `${moduleId}-prototype-unknown` rather than the stale `'prototype-0.2'`; "Load demo cohort" dropdown from `cfg.demoCohorts` calling `makeCohort(spec)` → `normalizeRows`. `PANEL_PROJECTS.BREATHE/VOICED` keep working via `project` (their configs gain nothing; defaults cover the new keys). No engine function of the panel changes.

### 4.5 Shell

`App`: state `{ moduleId (default SCREENING_MODULES[0].id), tab ('screener'|'scribe'|'patient'), locale ('en') }`. `module = getModule(moduleId)`; `validation = useMemo(() => validateModule(module), [module])`. On module change: `setLocale('en')`, `setTab(tab)` unchanged, and the app remounts via `key`. Locale toggle rendered only when `tab === 'patient'` and `Object.keys(module.locales).length > 1`. Document title `${module.label} · ${module.name} screening`. Persisted nothing (no localStorage — parity with today's stateless pages).

`ModuleSelect({ modules, value, onChange })`, `SampleRail({ cases, onLoad, onClear })`, `CaveatBanner({ locale, reviewed })`, `Footer({ module, appVersion })`.

---

## 5. Appendix §5 — old line → new mechanism (every row)

### 5.1 Screener

| Line | Old branch | New mechanism |
|---|---|---|
| 83-92 | STEPS keys | `module.steps[]` with `kind/domainKeys/extras/requires`; Screener iterates; `stepKey` comparisons become `step.kind`. |
| 290 | `rf: {rf_asym: true}` in sample | `sampleCases[id].rf` data; validated against flag ids. |
| 499 | CDS detail hand-copies rf_asym.action | `buildCdsHooks`: `redFlags.find(f => f.id === cds.examples.redFlagPresent.flagId).action + '. ' + detailSuffix`. |
| 527 | `ITEMS.discriminators.max` | `buildDataDictionary`: `domainOrder.filter(k => domains[k].negative).reduce((s,k) => s + domains[k].max, 0)`. |
| 874 | `ctx.c_clin === "3+"` | `evalGap`: `contextItems.find(id==='c_clin').gapMarker.value` compared to `ctx.c_clin`; label `gapMarker.screenerLabel`. |
| 875 | `ctx.c_dur === ">12mo"` | same, marker `c_dur`. |
| 876 | `ctx.c_dismiss === "yes"` | same, marker `c_dismiss`. |
| 882 (897, 1230, 1332, 1561) | `f.tier === "emergent"` | Engine vocab: `emergent = activeFlags.some(f => TIER_RANK[f.tier] === 0)`; CSS class `tier ${f.tier}` kept (fixed vocab). |
| 888 | `stepKey === "safety"/"intake"` | `step.kind === 'safety' ? safetyDone : step.requires === 'complaint' ? !!complaint : true`. |
| 914 (1340, 1455) | `band !== "low"` | `band !== lowestBand` (engine constant `BANDS[0]`) in the engine; module predicates may write `s.band !== s.lowestBand`. |
| 915 | `complaint === "sinonasal" \|\| "both"` | `rules.routing[0].when = s => (s.complaint==='sinonasal' \|\| s.complaint==='both') && s.band !== s.lowestBand` (module closure). |
| 916 | `complaint === "otologic" \|\| "both"` | `rules.routing[1].when` (module closure). |
| 922 | `domains.vestibular.pct >= 50` | inside `rules.routing[1].when`: `… && (s.band !== s.lowestBand \|\| s.domains.vestibular.pct >= 50)`. |
| 927 | `domains.neuro.pct >= 50` | `rules.routing[2].when = s => s.domains.neuro.pct >= 50`. |
| 934 | `answers.v_aural === "yes"` | `rules.routing[3].when = s => s.yes('v_aural')`. |
| 941 | `domains.discriminators.pts < 0` | `rules.routing[4].when = s => s.domains.discriminators.pts < 0`. |
| 943 | `Math.abs(domains.discriminators.pts)` | `rules.routing[4].copy.screener.p = s => \`Rule-out items subtracted ${Math.abs(s.domains.discriminators.pts)} points. …\``. |
| 944 | discriminator chips | `rules.routing[4].copy.screener.chips = s => s.items.discriminators.items.filter(it => s.yes(it.id)).map(it => it.text.split(/[—(]/)[0].trim().slice(0,46))`. |
| 994-997 | `loadSample("sinonasal"…)` + labels | `SampleRail` renders `module.sampleCases` (`buttonLabel`); `loadSample(case)`. |
| 1086 | `<QGroup domainKey="recalcitrance">` | step `intake`: `domainKeys:['recalcitrance'], extras:['complaintPicker'], copy.intro`. |
| 1090 | `<StepCard dk="migraine">` | step `migraine`: `domainKeys:['migraine']`, copy eyebrow/heading/sub. |
| 1091 | `dk="vestibular"` | step `vestibular`. |
| 1092 | `dk="neuro"` | step `neuro`. |
| 1094 | `dk="discriminators"` | step `discriminators`. |
| 1101 | `QGroup impact` + `ContextQ` | step `impact`: `domainKeys:['impact'], extras:['context']`. |
| 1191-1193 | ContextQ rows | `ContextQ` renders `module.contextItems` (`text`, `opts`). |
| 1344 | `complaint === "otologic" ? "otologic" : "sinonasal"` | `cds.preview.indexTitle = [{when: s => s.complaint==='otologic', title:'MASQUE: … escalating otologic therapy'}, {when: () => true, title:'MASQUE: … escalating sinonasal therapy'}]`; `evalCdsPreview`. |
| 1450 | `{low:"L", moderate:"N", high:"H"}[band]` | `INTERP_BY_BAND[band]` (engine vocab). |
| 1456 | specialty by complaint | `phenotypes.referral = [{when: s => s.complaint==='otologic', specialty:'Neuro-otology', reason:'vestibular migraine'}, {when: () => true, specialty:'Headache medicine / Neurology', reason:'mid-facial / migrainous cause'}]`; `evalReferral`. |
| 1577 | reason by complaint | same rule's `reason`. |

Adjacent Screener literals (from §3.1 table) — mechanism: L45 `module.instrumentVersion`; L46 `APP_VERSION` shell; L80 `fhir.questionnaireUrl`; L315 `demo.patient`; L334 `bands.cuts`; L337 vocab; L395 `bands.scaleMax`; L421-422/447/467 `fhir.*`; L429-438 `fhir.questionnaire*`; L443 `fhir.safetyGroupText`; L479-510 `cds.*`; L528/545/1217/1264 `bandLiterals`; L532/1231/1243/1437/1580 `copy.indexName`; L574 `fhir.screenIdPrefix`; L585 ctx param; L602 vocab; L866 `bandMeta` engine table keyed by band (labels generic → shell); L898 `copy.routing.withheld.p`; L966/1407-1413 `fhir.filePrefix`; L1003-1006 `icon`, `copy.screenerTitle/Subtitle`; L1073-1075 `phenotypes.values`; L1137/1141 `module.name`, `${module.id}-prototype-${APP_VERSION}`; L1178 shell copy; L1255 `copy.patternName`; L1305 `copy.gapAlert.screenerBody`; L1334 `cds.preview.safetyTitle`; L1428 `copy.disclaimers.screenerSources`; L1545/1549 engine (floor fix).

### 5.2 Scribe

| Line | Old branch | New mechanism |
|---|---|---|
| 452 | `ITEMS.discriminators.max` | Σ negative domains (same as 5.1/527; Scribe now calls the engine dictionary). |
| 771 | `["r_abx","r_surg"].some(yes) \|\| m_head answered` | module `phenotypes.js`: `const sin = s => s.yes('r_abx') \|\| s.yes('r_surg') \|\| s.answered('m_head')`. |
| 772 | `["v_vertigo","v_motion","v_aural","v_head"].some(answered && !== "no")` | `const oto = s => ['v_vertigo','v_motion','v_aural','v_head'].some(id => s.answers[id] !== undefined && s.answers[id] !== 'no')`. |
| 773 | both / otologic / sinonasal fallthrough | `phenotypes.derive = [{value:'both', when: s => sin(s) && oto(s)}, {value:'otologic', when: oto}]`, `scribeDefault:'sinonasal'`; `derivePhenotype` first-match. |
| 781 | base active set | `phenotypes.alwaysActive = ['migraine','impact','recalcitrance','discriminators']`. |
| 782 | otologic/both → vestibular | `phenotypes.activation[0] = {domains:['vestibular'], when: s => s.complaint==='otologic' \|\| s.complaint==='both'}`. |
| 783 | n_burn/n_viral → neuro | `activation[1] = {domains:['neuro'], when: s => (s.answers.n_burn ?? 'no') !== 'no' \|\| s.yes('n_viral')}`. |
| 786 | `active.has("vestibular")` | `rankSuggestions`: `gateActive = active.has(module.infoPrompts.gateDomain)`. |
| 790 | `vestActive && VMPATHI_TAG[a.id]` | `gateActive && a.tag`. |
| 796 | `it.domain === "vestibular" ? "vestibular" : label.toLowerCase()` | `it.tag \|\| (domain.shortTag ?? domain.label.toLowerCase())`; MASQUE vestibular `shortTag:'vestibular'`. |
| 800 | `if (vestActive) for VMPATHI_INFO` | `if (gateActive) for (info of infoPrompts.items) if (vmp[info.id] === undefined && items.length < infoPrompts.max)`. |
| 836-838 | gap ctx values | `evalGap` (markers), labels `gapMarker.scribeLabel`. |
| 844 (1000, 1215, 1306) | `tier === "emergent"` | engine vocab / `TIER_RANK`. |
| 1027 | kind order list | `PROBE_KIND_ORDER`. |
| 1035-1037 | kind suffix copy | `PROBE_KIND[kind].caption`. |
| 1158 | `c.id.startsWith("rf_")` | `c.kind === 'redflag'` (captures keep `kind`). |
| 1159 | `c.id.startsWith("c_")` | `c.kind === 'ctx'`. |
| 1160 | ctx label map | `contextItems.find(id).scribeLabel`. |
| 1168-1178 | shortLabel map | `item.short` (folded from the same literal). |
| 1185 | sinus complaint | `rules.routing[0].when` (shared with Screener; Scribe copy under `copy.scribe`). |
| 1186 | oto complaint | `rules.routing[1].when`. |
| 1188 | `vestibular.pct >= 50` | inside `rules.routing[1].when`. |
| 1189 | `neuro.pct >= 50` | `rules.routing[2].when`. |
| 1190 | `answers?.v_aural === "yes"` | `rules.routing[3].when`. |
| 1191 | `discriminators.pts < 0` | `rules.routing[4].when`; `copy.scribe.p` template; `chips: []`. |
| 1202 | `VMPATHI_INFO.find(id)` + `.replace("VM-PATHI · ","")` | `buildNote`: `infoPrompts.items.find(...)?.tag.replace(infoPrompts.tagPrefix, '')`. |
| 1204 | `c_dur` note label | `contextItems.find('c_dur').noteLabel`; order from `copy.note.ctxOrder = ['c_dur','c_clin','c_dismiss']`. |
| 1205 | `c_clin` | same. |
| 1206 | `c_dismiss` | same. |
| 1256 | interp map | `INTERP_BY_BAND`. |
| 1259 | specialty | `evalReferral(module, state).specialty`. |
| 1311 | reason | `evalReferral(...).reason`. |

Adjacent Scribe literals: L8-9 imports → `createExtractor(module.lexicon)`, `liveProbes(module.probes.list, …)`; L150-151 versions; L169/346-347/372/392/1264-1299 `fhir.*`; L354-361 `fhir.questionnaire*`; L404-436 `cds.*`; L453/457 `bandLiterals`, `copy.indexName`; L496/508 `fhir.screenIdPrefix`, `complaint` column kept; L557 `[${module.id} scribe]`; L566 `demo.transcript`; L584 `demo.patient`; L830 skip → no write; L876-877/922 `copy.scribeTitle/Subtitle/indexName`; L954 `copy.gapAlert.scribeTitle`; L1044 `item.short`; L1113-1116 `fhir.filePrefix`; L1127/1134-1136 `copy.disclaimers.scribeVmpathi`, `copy.about.scribe`; L1141-1142/1146 `module.name`, `${module.id}-scribe-prototype-${APP_VERSION}`; L1148 footer (shell); L1210/1224/1226/1228/1236/1240/1248 `copy.note.*` (the "v0.3 candidates" literal preserved verbatim as `copy.note.probeNotesFooter`); L1211 `patient.sex?.[0] ?? ''` guard; L1303-1304 `fhir.documentReference`; L1313 `copy.indexName`.

### 5.3 Patient

| Line | Old branch | New mechanism |
|---|---|---|
| 383, 405 | UI.sections[3..7] index-aligned | `patientSections[i].title[loc]` (folded from UI.sections); domain steps also expose `domains[key].patientLabel[loc]`. |
| 437 | SUM.migWords keys | unchanged inside `locales[loc].sum.migWords`; referenced by `rules.patientSummary.said[migWith].text = (S,s) => S.migWith(s.L(s.groups.mig.map(k => S.migWords[k])))`. |
| 443 | SUM.vWords | `said[vAlso].text` uses `S.vWords`. |
| 445 | SUM.nWords | `said[neuro].text` uses `S.nWords`. |
| 449, 457 | SUM.dWords / dShort | `said[disc]`, `ask[askDisc]`. |
| 523-529 | CONTEXT_Q ids | `contextItems[].patient[loc]` (values aligned per D6). |
| 535-539 | SECTIONS domain keys | `patientSections` kinds/domainKeys. |
| 655 (829, 837, 838, 1023, 1024) | `tier === "now"` | flags reach the component as `{id, tier}` with engine tier; component compares `TIER_RANK[tier] === 0`; display label via `PATIENT_CHROME[loc].tierNow/tierSoon` keyed by `TIER_DISPLAY[tier].patientKey`. |
| 656 | `key === "safety"` | `section.kind === 'safety'`. |
| 720 | `<QBlock domain="recalcitrance">` in story | `patientSections.story.domainKeys = ['recalcitrance']`, `copy[loc].intro`. |
| 726 | five-domain `includes(key)` | `section.kind === 'domain'`. |
| 729 | `BLURB[key]` | `locales[loc].blurbs[key] ?? locales.en.blurbs[key]`. |
| 910 | `yes("r_dur")` | `said[0] = {id:'dur', when: s => s.yes('r_dur'), text: S => S.dur}`. |
| 911 | `yes("r_abx")` | `said[1]` → `S.abx`. |
| 912 | `yes("r_surg")` | `said[2]` → `S.surg`. |
| 913 | `yes("r_normal")` | `said[3]` → `S.normal`. |
| 914 | `yes("r_lesion")` | `said[4]` → `S.lesion`. |
| 916 | `scale("m_head")`, `scale("m_dur")` | `s.scale('m_head')`, `s.scale('m_dur')` inside the rules below. |
| 917 | `mHead > 0` | `said[5] = {when: s => s.scale('m_head') > 0, text: (S,s) => S.headFreq(s.scale('m_head'))}`. |
| 918 | `mDur === 2` | `said[6] = {when: s => s.scale('m_dur') === 2, text: S => S.durTypical}` (index 2 = criterion-positive; documented in module rules file as `M_DUR_TYPICAL = 2`). |
| 919 | mig group | `groups.mig = ['m_photo','m_nausea','m_disable','m_aura','m_trig','m_fhx']`. |
| 920, 940 | `mig.length >= 2` | `said[7].when = s => s.groups.mig.length >= 2`; `derived.migPattern = s => (s.scale('m_head') ?? 0) > 0 && (s.groups.mig.length >= 2 \|\| s.scale('m_dur') === 2)`. |
| 922-923 | v_vertigo → vertigoT | `said[8] = {when: s => s.scale('v_vertigo') !== null && s.scale('v_vertigo') > 0, text: (S,s) => S.vertigo(S.vertigoT[s.scale('v_vertigo')])}`. |
| 924 | `yes("v_count")` | `said[9]` → `S.vCount`. |
| 925 | `yes("v_migfeat")` | `said[10]` → `S.vMig`. |
| 926 | vOther group | `groups.vOther = ['v_motion','v_aural','v_head']`; `said[11].when = s => s.groups.vOther.length > 0`. |
| 929 | neu group | `groups.neu = ['n_burn','n_otalgia','n_auto','n_viral','n_allo']`; `said[12]`. |
| 932-934 | i_days / i_role | `said[13]`, `said[14]` with `S.days(S.daysT[v])`, `S.role(S.roleT[v])`, `when: v !== null && v > 0`. |
| 936 | disc group | `groups.disc = ['x_purulent','x_objective','x_lowfreq','x_anosmia']`; `said[15]`. |
| 940 | migPattern | `derived.migPattern` (above). |
| 941 | vestPattern | `derived.vestPattern = s => s.scale('v_vertigo') === 2 \|\| s.yes('v_count') \|\| s.yes('v_migfeat')`. |
| 945-953 | ask tree | `ask = [ {askBoth: when d.migPattern && disc.length}, {askMig: when d.migPattern && !disc.length}, {askVest: when d.vestPattern}, {askRefer: when migPattern \|\| vestPattern}, {askNeuro: when neu.length >= 2}, {askNormal: when yes r_normal \|\| r_lesion}, {askDisc: when disc.length, text S.askDisc(L(disc.map(dShort)))}, {askTried: when yes r_abx \|\| r_surg}, {askNext: when () => true} ]` — order preserved; the `else if` at L946 becomes two mutually exclusive predicates. |
| 949 | `neu.length >= 2` | `ask[askNeuro].when`. |
| 950 | r_normal/r_lesion | `ask[askNormal].when`. |
| 952 | r_abx/r_surg | `ask[askTried].when`. |
| 955 | gap ctx values | `evalGap(module, ctx).count >= threshold`. |
| 957 | positional gap args | `S.gap(...evalGap(module, ctx).flags)` — `flags` in `gapRule.markers` order (c_clin, c_dur, c_dismiss). |
| 967 | `it.scale && v === 0` skip | engine `buildSummary` clin loop (verbatim). |

Adjacent Patient literals: L54-55 versions; L193-194 `copyFor/flagCopyFor`; L209/517 `[${module.id} patient]`; L265/269 `TIER` → shell tier config; L381/403 `locales[loc].ui.sub`; L463/500 `sum.clinNote` unchanged (embeds "MASQUE" — module-owned template, fine); L510 iterate `Object.keys(module.locales)`; L644 `PatientCompanion({module})`; L650 shell default `'en'`; L685 shell `CAVEATS.unreviewed[loc]`; L697 Intro receives `t/loc`; L705-706/779/815-817/849/855/1017/1087 → `locales[loc].ui.*` / `PATIENT_CHROME[loc]` (English kept in es where it is English today — Q4); L753/1119/1123 footer from shell; L787-788 `ui.forYouIf`; L960 key order of `locales.en.items`; L984-985/989-992 `ui.askTransform`, `ui.listAnd/listOxford`; L1010/1058 use `t.thin`/`t.notSureLede` (identical strings — allowed diff U6 is nil because the strings are equal); L1067 `ui.clinPattern`; L1096 `t` required.

### 5.4 Panel (adjacent branches only)

| Line | Old | New |
|---|---|---|
| 783 | `band = "low"` default | unchanged default (backward compat, §4.1 #13); documented. |
| 533, 648, 775-776, 823, 827, 967 | axes `'sex'/'gender'` | `cfg.fairnessAxes ?? ['sex','gender']`; default axis `axes[0]`. |
| 197, 216 | `masque_score\|breathe_score\|voiced_score` | `['score', ...(cfg.scoreAliases ?? []), 'index']` built once and passed to `normalizeRows(rows, cfg)`; registry entries for BREATHE/VOICED carry `scoreAliases: ['breathe_score']` / `['voiced_score']`. |
| 864 | `parsed.masqueArtifact` | `parsed[cfg.artifactKey]`. |
| 798 | `PROJECTS[project] \|\| PROJECTS.MASQUE` | `research ?? getPanelProject(project)`; unknown → visible error block. |

### 5.5 Simulator (retired — D1; each row's content destination)

| Line | Old | Destination |
|---|---|---|
| 320 | partial scenario answers | `sampleCases['sim-partial'].a`. |
| 326 | `rf: {rf_asym: true}` | `sampleCases['sim-redflag'].rf`. |
| 329 | ruleout answers | `sampleCases['sim-ruleout'].a` (spread of FULL_HIGH). |
| 317-329 | `step: 6` | dropped; `loadSample` jumps to the result step (`steps.length - 1`). |
| 397-398 | `.tier.emergent/.urgent` CSS | fixed vocab; Screener/Scribe CSS unchanged. |
| 467 | STEP_DOMAIN | `module.steps`. |
| 480 | `step === 0 ? (safety \|\| override)` | Screener `canContinue` on `step.kind`. |
| 499, 532, 550, 556, 637, 640 | step index literals | `step.kind` / data. |
| 537 | `<Items domain="recalcitrance">` | intake step. |
| 546-547 | Bárány/ICHD-3 intros by step index | Screener step `copy.sub` already carries equivalents; Sim strings → `copy.walkthrough` (screener). |
| 552 | discriminators items | discriminators step. |
| 614 | `sc.band !== "low"` | CDS preview gate in engine (`band !== lowestBand`). |
| 616 | `sc.band === "high"` | not carried (Screener has no such branch); Sim CDS copy → `copy.walkthrough`. |
| 685, 689-690, 784 | axes | `research.fairnessAxes`. |
| 892-915 | PITEMS 7-item subset | dropped — Patient copy is the full `locales[].items`. |
| 931-943 | patient ask rules subset | dropped — superseded by `rules.patientSummary` (full tree). |
| 954, 958 | locale list, Spanish banner | shell `LOCALE_NAMES`, `CAVEATS.unreviewed`. |
| 1004 | "the migraine question" rail copy | `copy.walkthrough` (patient). |
| 1020-1026 | LINES | dropped (superseded by `demo.transcript`). |
| 1029-1039 | CUES | dropped (module lexicon is Ext). |
| 1041 | NEG | dropped. |
| 1080-1164, 1216-1304 | probe copies | dropped (module `probes.js` is Prb). |
| 1332 | 14-char window | `lexicon.negation.window`. |
| 1340 | `!c.id.startsWith("c_")` | captures carry `kind`. |
| 1400, 1494-1497, 1517-1544 | rail/notes copy | `copy.walkthrough` (scribe). |
| 1409, 1413-1420, 1422, 1454 | kind order/captions/truncation | `PROBE_KIND_ORDER`, `PROBE_KIND[k].caption/truncate` (cap 2 as Scribe; Sim's cap 3 not carried). |
| 1432 | raw `p.rescues` | `item.short`. |
| 285-305 | makeCohort kinds | `engine/cohortGen.makeCohort(spec)`; specs in `research.demoCohorts`: balanced `{groups:[{female,woman,400,hi,labeled},{male,man,400,hi,labeled}]}`, unlabeled (same, `labeled:false`), disparate `{groups:[{female,woman,200,lo,labeled},{male,man,200,hi,labeled},{female,man,22,lo,labeled},{male,nonbinary,6,hi,labeled}], extraRows:[{score:61,label:1,sex:'',gender:'woman',subject_id:'s-x1',captured_at:'2026-04-02'}]}`; `seed 7`, `prevalence 0.45`, `hi:{pos:[58,40], neg:[12,38]}`, `lo:{pos:[26,42], neg:[6,34]}`. |

### 5.6 Extraction

Engine branches on kind literals only (Ext L234, L237-265, L242) — kept verbatim. Content ids (BOOL_EX, CTX_EX, SCALE_EX, MULTI_EX, RF_PHRASES; `thirdPartyExempt` on m_fhx) move unchanged into `module.lexicon`; `validateModule` #7 resolves every id.

### 5.7 Probes

Engine branches `p.target && answers[p.target] !== undefined` (L305) and `p.kind === "phenotype"` (L339) kept; every `when` closure and option id moves unchanged into `module.probes.list`; `validateModule` #8 resolves ids and applies the two new rescue rules.

---

## 6. Parity harness (D10) — `app/tests/`

### 6.1 Importing the old code at runtime (never editing `reference/`)

`importLegacy(name, opts)` in `tests/harness/legacyImport.js`:

1. `fetch(REFERENCE_BASE + name, {cache:'no-cache'})` → source text (`REFERENCE_BASE` default `../../reference/fixed-src/`, overridable by `?ref=`).
2. Append `\n` + `export { … };` with the identifier list per file:
   - Screener: `ITEMS, DOMAIN_ORDER, ALL_ITEM_IDS, RED_FLAGS, RF_GROUPS, STEPS, SAMPLE_CASES, DEMO_PATIENT, BAND_CUTS, QUESTIONNAIRE_URL, ANSWER_SYSTEM, WEIGHT_EXT, INSTRUMENT_VERSION, APP_VERSION, scoreItem, bandFor, itemBounds, useScore, buildQuestionnaire, buildCdsHooks, buildDataDictionary, screenToCohortRow, rowsToCsv, subjectPseudonym, buildBundle`.
   - Scribe: `ITEMS, DOMAIN_ORDER, ALL_ITEMS, RED_FLAGS, ASK, VMPATHI_TAG, VMPATHI_INFO, BAND_CUTS, SCRIPT, PATIENT, computeScore, buildQuestionnaire, buildCdsHooks, buildDataDictionary, screenToCohortRow, buildRecs, buildNote, buildBundle, shortLabel, capLabel`.
   - Patient: `ITEMS, DOMAIN_ORDER, P, ES_P, ES_RF, RED_FLAGS, TIER, UI, SUM, CONTEXT_Q, SECTIONS, BLURB, BLURB_ES, REVIEWED, buildSummary, askForm, list, summaryText`.
   - Simulator: `makeCohort, SCENARIOS, COHORTS, FULL_HIGH`.
   - Extraction / Probes / RRP: already export what is needed (`extract`, constants; `ALL_PROBES, liveProbes, validateProbes, PROBE_KIND`).
3. For the Screener only: rewrite `from "react"` to a shim blob exporting `default React`, `useState`, `useEffect` passthrough and `useMemo = (fn) => fn()`, so `useScore` is callable outside a render. The component itself is never rendered.
4. Babel classic transform; resolve its relative imports recursively with the same routine (no export append for dependencies); `URL.createObjectURL`; `import()`.

`liftBody(source, start, end, params)` builds a `Function` from the text strictly between `start` and `end` markers (markers are exact substrings of the frozen reference). Lifted inline functions:

| Oracle | File | start … end | params |
|---|---|---|---|
| Screener recs | Scr | `const recs = useMemo(() => {` … `}, [band, complaint, domains, answers, scorable, answered, floor, ceiling, override, emergent, activeFlags]);` | `override, emergent, activeFlags, scorable, answered, floor, ceiling, domains, DOMAIN_ORDER, band, complaint, answers, ITEMS` |
| Screener gapFlags | Scr | `const gapFlags = [` … `].filter(Boolean);` (expression) | `ctx` |
| Scribe complaint | Scb | `const complaint = useMemo(() => {` … `}, [answers]);` | `answers` |
| Scribe suggestions | Scb | `const suggestions = useMemo(() => {` … `}, [answers, complaint, vmp, scorable]);` | `answers, complaint, vmp, scorable, ALL_ITEMS, ASK, VMPATHI_TAG, VMPATHI_INFO, ITEMS` |
| Scribe gapFlags | Scb | `const gapFlags = [` … `].filter(Boolean);` | `ctx` |

Both old and new builders are called inside `withFixedClock('2026-04-01T12:00:00.000Z', …)` and `withSeededRandom(1, …)` so `date`, `timestamp`, `authored`, `screen_id`, `captured_at` are deterministic on both sides.

### 6.2 Snapshots (what is compared)

| Suite | Old | New | Comparison |
|---|---|---|---|
| values | every constant in §6.1 lists | module fields (unfolded where needed: `items.map(i => pick(i, ['id','w','text','scale','ref']))` vs `ITEMS`) | deep-equal, key order included for `locales.en.items` vs `P` |
| golden-questionnaire | `buildQuestionnaire()` (Scr and Scb) | `buildQuestionnaire(masque)` | byte-equal JSON |
| golden-cds | `buildCdsHooks()` | `buildCdsHooks(masque)` | byte-equal |
| golden-dictionary | Scr `buildDataDictionary()` | `buildDataDictionary(masque, {appVersion})` | equal after G5 normalisation |
| golden-row | Scr `screenToCohortRow` with a `ctx` global injected? — impossible (ReferenceError). Oracle = Scb `screenToCohortRow` (no visit_label/subject_id/gender) **plus** the Screener's field list from its dictionary. | `screenToCohortRow(masque, …)` for each sample case | equal after G1 normalisation |
| golden-bundle-screener | Scr `buildBundle` | `buildBundle(masque, {routingCleared: !override})` | equal after G2a normalisation |
| golden-bundle-scribe | Scb `buildBundle` | `buildBundle(masque, {..., note})` | equal after G2b normalisation |
| sample-scores | Scr `useScore(case.a)` and Scb `computeScore(case.a)` | `computeScore(masque, case.a)` | deep-equal for all 9 sample cases |
| note | Scb `buildNote` | `buildNote(masque, …)` | byte-equal text over sample cases × {reviewed, unreviewed} × {rf none, rf_asym} |
| cohortGen | Sim `makeCohort(kind)` ×3 | `makeCohort(demoCohorts[kind].spec)` | deep-equal rows |

### 6.3 Enumerated allowed differences (the only normalisations the harness applies)

| Id | Where | Old | New | Reason |
|---|---|---|---|---|
| G1 | cohort row | no `module_id`; `visit_label` throws (Scr) / absent (Scb) | `module_id: 'masque'`; `visit_label: ctx.visit_label ?? ''` | D5, D7 |
| G2a | Screener bundle | attainable-range `low = total`; note "Index is bounded to ${total}–${ceiling}"; no DocumentReference | `low = floor`; note "Index bounded to ${floor}–${ceiling}" (Scribe wording); still no DocumentReference | D7 |
| G2b | Scribe bundle | reasonCode "(${band})"; no routing-override component | "(${band} likelihood)"; routing-override component present when override | single engine builder (Screener's more explicit forms win) |
| G5 | dictionary | `appVersion '0.3.0'`; canonical fields without `module_id`, `complaint` | `'0.4.0'`; two fields added | D5; inventory §2 FHIR (f) |
| G6 | Scribe dictionary/spec download | Scribe's shorter field list | engine (Screener) list | one generator |
| V1 | model card / manifest / footers | `masque-prototype-0.3.0`, no module_id | `masque-prototype-0.4.0`, `module_id` | D5 |
| U1 | Screener meter | zones 33/33/34 | 34/33/33 | derived from cuts (visual only) |
| U2 | Scribe skipPrompt | writes `'no'` | writes nothing | D7 |
| U3 | Scribe safety tab / Flag text | Scb shortened flag wording | Screener canonical wording | D6 |
| U4 | Scribe "re-asking", Screener open list | raw item id | `item.short` | D7 |
| U5 | Patient context questions | values `1/2/3+`, `<6mo/6-12mo/>12mo` | `0-1/2/3+`, `<3mo/3-12mo/>12mo` with new labels (Q1) | D6 — gap rule unaffected (`3+`, `>12mo` unchanged) |
| U6 | Sample rail | four buttons | nine buttons (four unchanged labels + five `sim-*`) | D1 |
| U7 | Panel | silent MASQUE fallback | visible error for unknown project; "Load demo cohort" added | risk 10 |

Anything else that differs fails the suite.

### 6.4 Sweep design

- PRNG: `mulberry32(0x4D415351)`; the seed and N are printed in the report; a `?seed=` override exists for exploration but the default run is the acceptance run.
- Size: **N = 50,000** answer sets in five strata of 10,000 with unanswered probability 0.0 / 0.15 / 0.3 / 0.6 / 1.0 (the last stratum is mostly empty sets — the gate cases). Answered boolean items 50/50 `'yes'/'no'`; scale items uniform over indices.
- Scoring comparison keys (per set): `total, floor, ceiling, coverage, scorable, answered, count, band`, `domains[k].{pts,max,pct,label,openPts,negative}` for every k, and `open.map(i => i.id)` (order). Three-way: Scr `useScore` ≡ Scb `computeScore` ≡ `computeScore(masque)`.
- Rule parity (subsample 20,000 sets × context): complaint ∈ `{'', 'sinonasal', 'otologic', 'both'}`, rf ∈ `{ {}, {rf_asym:true}, {rf_thunderclap:true, rf_asym:true} }`, ctx ∈ 8 combinations of the three markers, safetyReviewed ∈ {true,false}. Compared: Screener recs (lifted) vs `evalRouting(...,'screener')` (h, p, chips); Scribe `buildRecs(band, complaint, domains, scorable && routingCleared, answers)` vs `evalRouting(...,'scribe')`; Scribe complaint (lifted) vs `derivePhenotype`; Scribe suggestions (lifted) vs `rankSuggestions` (full array, with random `vmp`); gapFlags (both) vs `evalGap`; referral specialty/reason (from bundle ServiceRequest text) vs `evalReferral`; `capLabel` over every capture kind vs new; `shortLabel` vs `item.short` for all 30 ids.
- Patient parity: 20,000 Patient answer sets (adds `'unsure'` at 0.15) × ctx (Patient values) × loc ∈ {en, es}: Pat `buildSummary` vs `buildSummary(masque, loc, …)` on `said, ask, gapLine, unsureList, clin`; `askForm` for every item, `list` for lengths 1..4, `summaryText`.
- Probe parity: over the 50,000 sets × rf × random `probeAns` subsets: `liveProbes` (old ALL_PROBES) vs `liveProbes(masque.probes.list, …)` — id sequence equality. Plus `validateProbes` returns `[]` for MASQUE under both old and new validators.
- Extraction parity: gold-set utterances (44) + `demo.transcript` pt turns + 5,000 synthetic utterances (random 1–3 phrases drawn from all lexicon lists with random negation/third-party/historical prefixes) × `includeSuppressed` ∈ {false,true} × window ∈ {14, 8, 20}: old `extract(text, opts)` vs `createExtractor(masque.lexicon).extract(text, opts)` — deep-equal arrays.
- Pass = every suite green with zero unexplained diffs; report lists per suite N, seed, elapsed, first 10 diffs with paths. The page sets `document.documentElement.dataset.masqueTests = 'pass'|'fail'`.

### 6.5 Runs

Locally before every merge (all suites); on the deployed host the page runs `validate`, `values` (against committed snapshots), `sweep` (new engine self-consistency: scorable ⇒ bandFor(floor)===bandFor(ceiling), invariants) and skips old-oracle suites with a visible "reference unavailable" note.

---

## 7. CSS scoping and shell chrome

- Shell owns tokens: `.masque-shell { --ink … --sans }` (the Screener/Scribe token set, identical values) plus its own chrome classes prefixed `sh-`. `*{box-sizing}` becomes `.masque-shell *`; `:focus-visible` and reduced-motion rules move to the shell.
- Screener and Scribe CSS strings are moved **unedited** and wrapped at module evaluation: `const CSS = scopeCss(RAW_CSS, '.app-screener')`. `scopeCss` prefixes every selector in every rule (including inside `@media`), maps `:root` → the root selector, `*` → `<root> *`, and drops the duplicated token block (tokens come from the shell). Class names in JSX stay as they are (`.card`, `.btn`, …) so no JSX edit is needed and both apps can coexist. A one-time review of the scoped output is part of WP8 acceptance (rendered diff against the legacy pages at three widths).
- `.mp` (Patient) and `.rrp-` (Panel) untouched.
- Shell chrome: top bar = brand mark + `ModuleSelect` + app tabs + (patient) locale toggle; below it `CaveatBanner` (unconditional "Prototype · not for clinical use"; plus unreviewed strip); app area; `Footer`. No module string appears in the chrome except `module.label` in the dropdown and document title (D4).

---

## 8. Migration order and work packages

### 8.1 Prerequisite (must land before anything runs in parallel)

**WP0 — Contract, registry skeleton, harness core.** Owner: lead or one implementer; ~1 day.
Files: `src/modules/contract.js`, `src/modules/registry.js` (masque import stubbed), `src/modules/_template/*`, `src/shell/constants.js`, `src/engine/vocab.js`, `tests/index.html`, `tests/TestRunner.jsx`, `tests/harness/*`, `tests/suites/_smoke.test.js` (imports Screener legacy, checks `useScore` callable via shim, lifts recs and runs it on one sample case).
Acceptance: smoke suite green; contract typedefs match §2 exactly; `assembleModule` folds a fixture correctly.

After WP0, **WP1, WP2, WP3 start in parallel**; **WP4–WP7 may start against the contract using `dev/` pages that import `modules/masque` as soon as WP1 lands** (WP1 is ~1 day and is the pacing item; until then they code against the template module).

### 8.2 Packages

| WP | Scope / owned files | Depends on | Provides | Acceptance (against reference) |
|---|---|---|---|---|
| **WP1 MASQUE module** | `src/modules/masque/**`, `CHANGELOG.md`, `README.md`, `goldset.json` | WP0 | `masque` default export conforming to §2 | `values.test.js` green for every block; `validateModule(masque).errors === []`; CHANGELOG lists every §2 divergence and Q1 wording marked *unreviewed*. |
| **WP2 Engine A (score, rules, suggest, patient, validate)** | `src/engine/score.js, rules.js, suggest.js, patient.js, validate.js` | WP0 (+ WP1 for verification) | §3.1–3.6, 3.10 | `sweep.test.js`, `rules.test.js`, `patient.test.js` green; validate suite: MASQUE passes, each of 21 assertions demonstrably fires on a mutated fixture. |
| **WP3 Engine B (fhir, cohort, cohortGen, extraction, probes, note)** | `src/engine/fhir.js, cohort.js, cohortGen.js, extraction.js, probes.js, note.js, index.js` | WP0 (+ WP1) | §3.7–3.9 | `golden.test.js`, `cohort.test.js`, `extraction.test.js`, `probes.test.js`, note parity green with only §6.3 differences. |
| **WP4 Screener** | `src/apps/Screener.jsx`, `src/shell/SampleRail.jsx`, `src/dev/MountScreener.jsx`, `dev/screener.html` | WP0; WP1–3 for integration | `Screener({module, appVersion, site})` | Side-by-side with `app/screener.html`: four sample cases render identical readouts, recs, CDS preview, bundle (mod §6.3); capture appends a row without error; nine sample buttons; no `MASQUE` literal in the JSX (grep). |
| **WP5 Scribe** | `src/apps/Scribe.jsx`, `src/dev/MountScribe.jsx`, `dev/scribe.html` | WP0; WP1–3 | `Scribe({module, appVersion, site})` | Demo transcript playback yields identical answers/ctx/rf sequence to legacy (recorded by a test hook `window.__scribeState`), identical note text mod U2/U3/U4, identical probe rail sequence; sign gate honours `site`. |
| **WP6 Patient** | `src/apps/PatientCompanion.jsx`, `src/dev/MountPatient.jsx`, `dev/patient.html` | WP0; WP1–2 | `PatientCompanion({module, appVersion, locale, onLocaleChange})` | Both locales: rendered text equals legacy for the same answers (mod U5); `omissions.test.js` green; unreviewed banner appears for es. |
| **WP7 Panel** | `src/apps/ResearchReadinessPanel.jsx`, `src/modules/registry.js` (PANEL_PROJECTS), `src/dev/MountPanel.jsx`, `dev/panel.html` | WP0; WP3 (`makeCohort`) | §4.4 props | With `project="MASQUE"` and no `research`: manifest/model card equal legacy mod V1; `project="VOICED"`/`"BREATHE"` render unchanged; demo cohorts produce PASS / withheld / suppressed states as Sim did. |
| **WP8 Shell + CSS** | `index.html`, `src/shell/App.jsx, ModuleSelect.jsx, CaveatBanner.jsx, Footer.jsx, icons.js, css.js` | WP4–WP7 mountable | shell | Module dropdown lists exactly one module; tab switch keeps app state, module change resets it; scoped CSS renders Screener/Scribe pixel-comparable to legacy at 1280/900/400 px; caveat banner present on every tab; footer shows five axes + module_id; `masqueReady` true, console clean. |
| **WP9 Test suites** | `tests/suites/*.test.js`, `tests/golden/` export | WP0 harness; consumes WP1–3 | the acceptance runs for all packages | All suites green on the default seed; snapshot export works; suites skip cleanly without reference. |
| **WP10 Docs + retire** | `docs/refactor/…`, `TEMPLATE.md` finalisation, deletion of legacy `src/MASQUE_*`, per-app html, `simulator.html` | all green | — | Site boots from `index.html` only; `/masque/demo/` untouched; grep shows no `reference/` import outside `tests/`. |

Cross-package interfaces are only: the contract file (WP0), the module object (WP1), and the engine signatures in §3 (WP2/3). Apps never import each other. The panel is imported by Screener and Scribe exactly as today.

### 8.3 Order in which the site stays runnable

1. WP0 lands: legacy pages unchanged. 2. WP1–3 land: still legacy pages; tests page green for engine/module. 3. WP4 lands with `dev/screener.html` (new Screener next to legacy). 4. WP5, WP6, WP7 likewise. 5. WP8: `index.html` becomes the shell; legacy pages still reachable by URL. 6. WP10: legacy removed.

---

## 9. Open questions for the clinical lead, and risks of this design

### 9.1 Open questions (the code must not decide these silently)

| Q | Question | Default in this design until answered |
|---|---|---|
| Q1 | Aligning Patient context bins to the Screener's (`0-1`, `<3mo`, `3-12mo`) requires **new patient-facing labels in en and es** ("None or one", "Under 3 months", "3 to 12 months" / Spanish equivalents). CLAUDE.md forbids inventing clinical content; these are UI labels but patient-facing. Who authors and reviews them? | Placeholder labels shipped, flagged `unreviewed` in CHANGELOG and shown with the unreviewed strip in **both** locales until approved. |
| Q2 | Keep or drop the Scribe red-flag `ask` field (never read)? | Kept as data, unused; warning in validateModule. |
| Q3 | Scribe will now show the Screener's full red-flag wording (U3). Acceptable, or should the Scribe keep its abbreviated set as a second clinician copy? | Screener wording (canonical per §2). |
| Q4 | The Patient app's English-only literals (Intro, story heading/lede, Safety headings, Summary lede, "Get seen today/this week", clinician paragraph, disclaimer) remain English under `es`. Translate now (needs a reviewer) or ship as today? | As today; listed in CHANGELOG. |
| Q5 | Patient clinician list uses the Patient file's `c` abbreviations (Pat L969). The module has `text` (Screener) and `short` (Scribe). Which becomes the clinician-facing line? `c` differs from both. | Carry `c` as `item.patientClin` (a fourth string, verbatim) to keep parity; ask whether it may collapse onto `short` later. |
| Q6 | Are the five Simulator scenarios and their `why` copy appropriate in the clinician Screener rail, or only in a demo mode? | Shown, with `why` as tooltip. |
| Q7 | Simulator "What to notice" rails as `copy.walkthrough`: include, or drop entirely? | Included behind a shell "Walkthrough" toggle, default off. |
| Q8 | `skipPrompt` now leaves the item unanswered (U2). Should "Skip" be relabelled ("Not asked") to make that explicit? | Behaviour changed, label unchanged. |
| Q9 | The screening rail's `bandMeta` labels ("Low likelihood", "Not scorable — screen incomplete") are engine/shell; `copy.patternName` is appended (Scr L1255). Confirm the split. | As designed. |
| Q10 | Unsure-list ordering follows the Patient file's key order (r_lesion before r_normal) rather than the instrument order. Keep for parity or switch to instrument order (a visible change)? | Parity (key order). |
| Q11 | CDS example card values (`78/100`, "high likelihood of a masked migrainous driver", VM-PATHI/DHI detail) stay as module exemplar data. Confirm they should not be regenerated from a sample case. | Exemplar data. |

### 9.2 Self-assessed risks

| # | Risk | Mitigation in this design | Residual |
|---|---|---|---|
| R1 | Closure predicates cannot be statically inspected, so `validateModule` cannot prove a rule reads only real item ids. | Parity sweep exercises every rule against the old inline functions; the `S`-proxy check (#13) verifies template keys; TEMPLATE.md asks authors to list `reads` per rule (informational). | A second module's typo in a predicate is caught only by a runtime error or by its own tests. |
| R2 | The frozen `RoutingState`/`PatientState` shapes become an API a second module depends on; extending them later is easy, changing them is not. | Shapes are documented in §3.3 and in `contract.js`; only additive changes allowed. | Low. |
| R3 | `scopeCss` is mechanical; unusual selectors (`.mq-wrap > *`, attribute selectors, comma lists inside `@media`) could be mis-prefixed. | WP8 visual acceptance at three widths; fallback is a hand-prefixed CSS string (same acceptance). | Visual only. |
| R4 | `liftBody` depends on exact marker substrings in the reference source. | Reference is frozen and read-only; markers are asserted present at suite start with a clear failure message. | None while reference is frozen. |
| R5 | Golden-file equality for the Screener cohort row has no direct old oracle (old code throws). | Oracle composed from Scribe's row plus the Screener dictionary's field list; the D7 fix is therefore verified structurally, not byte-wise, for `visit_label/subject_id/gender`. | Documented. |
| R6 | Two new `validateProbes` rules could reject a future legitimate probe design (e.g. a rescue that also targets). | Rules encode Prb L293-299 semantics explicitly; they are engine policy, documented in TEMPLATE.md. | Low. |
| R7 | Remount-on-module-change discards an in-progress screen if a user changes module mid-screen. | Shell confirms (`window.confirm`) when any app state is non-empty; apps expose `isDirty` via a ref. | UX only. |
| R8 | Single engine `buildBundle` changes Scribe output in two places (G2b) and Screener in one (G2a). | Enumerated; both are strictly more informative; identifiers untouched (§4.3). | Downstream consumers of the prototype bundle (none known). |
| R9 | The `PATIENT_CHROME` split means a module cannot ship a locale the shell lacks. | validateModule #15 rejects loudly; adding a shell locale is a shell change, not a module change. | Acceptable given D9 (one module). |
| R10 | 50,000-set sweep × rule/patient/probe suites may take tens of seconds in Babel-compiled code. | Suites run sequentially with progress; N is a constant; `?quick=1` runs 5,000 for iteration, the acceptance run is the default. | None. |
