# 03 — screenAIr: final design

The design implementers build from. It turns the four hard-wired MASQUE apps and the Simulator into **screenAIr**: one page with a module dropdown at the top and five tabs (Clinician Screener, Ambient Scribe, Patient Companion, Research, Rubric Editor). Modules are a JSON rubric plus an optional JavaScript logic file, and they can be uploaded, edited and downloaded. The first module is **"Dizziness and Sinusitis (MASQUE v1)"**, which carries MASQUE instrument 0.2 unchanged.

Dated 2 October 2026. It supersedes `design-candidates/A|B|C` (kept for rationale) and was written against `app/src` as it is at commit `bc27e74`. Revised the same day after the adversarial review: the **Review log** at the end gives the resolution of every finding.

**Citations.** `Inv §x` = `01-inventory.md`. `A/B/C §x` = the candidates. `Div` = `02-app-divergences.md`. Line references are to the *current* `app/src` files:
- `Scr L…` is the Screener. It is line-identical to `reference/fixed-src` except at L572 and L961 (the ctx fix).
- `Pat L…`, `Ext L…`, `Prb L…` and `Sim L…` are identical to `reference/fixed-src`.
- `Scb L…` is the current app Scribe (1458 lines; voice added, so its lines differ from the inventory's).
- `RRP L…` is the current panel (1046 lines; from L403 on it sits 25 lines earlier than the inventory's numbers).
- `Voice L…`, `Pop L…`, `PA L…` and `SC L…` are `MASQUE_Voice.js`, `MASQUE_Population.jsx`, `PopulationArtifact.jsx` and `MASQUE_SchemaCheck.js`.

**Checked against the code for this design.** Every point below was verified, and each one changes a decision made later in this document:

| Fact | Consequence |
|---|---|
| The Scribe `shortLabel` map has 29 entries and none for `n_allo`, which falls back to the raw id (Scb L1309-1321). | `item.short` is optional and falls back to the id, which keeps parity. A label for `n_allo` is a lead question (Q24). |
| Patient `P` keys are in exactly the instrument order: `r_lesion` comes before `r_normal` in both (Pat L137-188 vs Scr L172-255). | Iterating module items reproduces `unsureList` (Pat L960). |
| All 30 Patient `c` strings differ from the Scribe `shortLabel` strings (Pat L63-124). | The Patient clinician block keeps them as `item.patientClin`, moved verbatim (B Q5). |
| There are **32** probes: 18 in `PROBES` and 14 in `VM_PROBES`. By kind: safety 7, rescue 4, criteria 4, rule-out 4, phenotype 9, exam 4. Probe set 1.0.0 (Prb). | Probe parity is checked over 32 ids. |
| The Screener bundle still writes `attainable-range.low = total` (Scr L1526) and builds the note from `total` (L1549). The Scribe uses `floor` (Scb L1396-1458). | Allowed difference AD1. |
| The Scribe red flags are a shortened second wording (Scb L189-240). The Scribe Questionnaire download uses them, so it differs from the Screener's in the safety group. | Allowed difference AD6. |
| The Patient's Spanish review banner and its footer are both `noprint` (Pat L683-688, L752). Only the `.disc` box is printed. | Patient print needs work (§5.5). |
| `MASQUE_Population.jsx` declares `:root` tokens, an unscoped `*{box-sizing}` and an unscoped reduced-motion `*` rule (Pop L41-47, L92). It fetches its paths relative to `document.baseURI` (Pop L31-33, L95-101). | It needs scoping and a `baseUrl` prop. Every module-data path resolves against `env.appBase`, so pages at any depth work (D25). |
| `importModule(blobURL)` fails. `candidates()` appends `.jsx`, and `fetchModule` gives up on the first network error (loader L32-52). | The loader needs a source-text entry point (§6). |
| Babel standalone 7.26.4 accepts `transform(src, {ast:true, code:false, presets:[], sourceType:'module'})`. Dynamic `import()` appears as `CallExpression` with `callee.type === 'Import'`. JSX without the preset fails as "Support for the experimental syntax 'jsx'…" with (line:col). Checked here in Node with the npm-packed 7.26.4. | The design of `importSource` (§6). |
| The gold set holds 44 utterances (`reference/MASQUE_v0.3.1/masque_extraction_goldset.json`, `_meta.version` 0.2.0). Lexicon 0.3.1 has `NEGATION.window` 14, 24 `BOOL_EX`, 5 `SCALE_EX`, 2 `MULTI_EX` and 12 `RF_PHRASES` entries. | The extraction suite. |
| The loader's `REL_SPECIFIER_RE` also matches specifier-like text in comments and string literals. Compiling `masque-loader.js` through itself finds `./x` three times (its L24 comment), and `'import x from "./y.js"'` inside a string is matched too (checked in Node with Babel 7.26.4). `import(new URL(…).href)` is not matched. | Compiled code never imports the loader; the page injects it (§6.4). Source text containing imports is a data file, never inlined in a compiled module (§8.0). |
| `build()` stores a module's *pending* promise before building its dependencies (loader L70-111), so an import cycle awaits itself forever: no error, no red panel. | `build()` detects cycles, and `static` asserts an acyclic graph (§6.2). |
| The Scribe complaint falls back to `"sinonasal"` (Scb L846-850). Its referral depends only on `routingCleared`, `scorable` and the band, never on the recommendations (Scb L1400, L1452-1455). | A phenotype-derivation error is a routing error, and a routing error reaches `referralGate`, `cdsPreview`, `buildNote` and `buildBundle` (§3.3, §4.5-§4.7). |
| Every validation, calibration, flagged-rate, fairness and mitigation figure in the panel is computed from `logistic(r.score, cfg.calibration)` (RRP L243-255, L285-293, L412, L511, L628). AUROC is rank-based and `repeatMeasures` uses raw scores. | The calibration gate withholds every calibration-dependent figure, not only the live probability (§5.6). |
| Rescue probes stay live on a negative target only because each rescue's own `when` treats the negative answer like an absent one (Prb L189-231). `liveProbes` merely never retires them through `target` (Prb L301-307). | V46 checks that property for every module (§4.14). |
| The patient summary emits fixed sentences tied to item meanings: `S.durTypical` ("between 4 hours and 3 days") when `m_dur === 2`, `S.dur` when `r_dur` is yes (Pat L910-918). | Rewording an item the logic reads needs an explicit acknowledgement, and the impact preview renders the patient summary (§5.7). |
| The 15 files in `data/provenance/` are named by no path in the population index or any artifact; only a note string mentions the folder. The index, its 19 artifacts, the schema and the map come to about 160 KB. | Download-all does not copy the provenance folder (§5.8). |
| Rendered Patient text, English and Spanish, has no match for `/\bscor(e\|es\|ed\|ing)\b/i`, `/likelihood/i`, `/probabil/i`, `/puntuaci[oó]n\|puntaje/i` or `/\d{1,3}\s*\/\s*\d{2,3}/` outside source comments and the Intro "What it isn't" box (Pat L792-797; checked over every string literal, template and JSX text node). | The widened omission patterns can apply to module data (V60) without failing MASQUE. |
| `MASQUE_Voice.js` reports `idle \| starting \| listening \| restarting \| stopped \| error` (Voice L90), and `stop()` during `starting` is honoured (Voice L235-262). | Entering patient-facing views stops capture in every state except `idle`, `stopped` and `error` (§5.1). |

---

## 1. Decisions summary

| # | Decision | Rationale |
|---|---|---|
| **D1** | **Base: candidate B (parity-first)** for migration discipline. That means verbatim moves, a values suite, per-surface copy, `patientClin`, the note's context order, a site runnable at every step, and dev pages per app. Grafted on top: **C**'s optional families with engine defaults, `contractVersion`, the path-addressed validator with mutation tests, engine-owned gates and gate-card sentences, derived scoring helpers, lazy hidden-mounted tabs, the Patient module-graph test, t-ids/t-css and SHA-pinned oracle slices. **A**'s module files that import nothing, E28 smoke evaluation, E44/E45, the renderHook oracle and "expected difference missing". | Two of three judges recommended B. With no build step and no Node on the user's machine, the dominant risk is breaking a working clinical prototype mid-migration. C supplies the extensibility the new requirements need; A supplies the strongest safety checks. |
| **D2** | **The parity oracle is a frozen copy of the current `app/src`** (`app/tests/baseline/src/`, SHA-256 manifest, local-only). `reference/fixed-src` is a secondary oracle, and its diff to the baseline must equal `02-app-divergences.md`. | All three candidates diffed against `reference/`. They would have mis-enumerated fixes that `app/src` already ships (Scribe skip, Screener ctx, voice, PopulationArtifact). |
| **D3** | **A module is two layers.** The **rubric** is pure JSON. The **logic** is one JS file of closures with no imports; functions may appear only on `LOGIC_PATHS`. Built-in MASQUE ships as `app/modules/masque/masque.rubric.json` + `masque.logic.js` and loads through **the same path as an upload**: fetch bytes → SHA-256 → `importSource` → `bindModule` → `validateModule`. | This is the user's decision ("JS closures"). The JSON layer is what makes editing, serialising and uploading possible. With one load path, the upload path is exercised on every page load, and the bytes executed are the bytes downloaded. |
| **D4** | **Logic declares `reads`**: item ids with type and scale length, domains, flags, phenotype values and gap-marker order. The validator checks it against the rubric, then checks it is complete by running every closure behind recording proxies. The editor locks the structure the logic reads (ids, types, option counts, domains) and lets its wording change only with an explicit acknowledgement (§5.7). | This is the only defence against an edit silently disabling a closure such as `s.scale('m_dur') === 2` (Inv §7 risk 3). |
| **D5** | **A data-only rubric runs on engine `GENERIC_LOGIC`.** That means no phenotypes, all domains active, no module routing (engine gates plus one neutral fallback card), a patient summary that quotes the module's own item wording, no probes, no CDS index card and no referral. | The user requires JSON uploads. Nothing is invented: the generic behaviour only rearranges the module's own text. |
| **D6** | **Gates and their non-negotiable sentences are engine-owned.** Modules supply noun-phrase slots only (`indexName`, `gate.patternPhrase` …). A throwing closure **fails closed**. A routing *or phenotype-derivation* error withholds routing behind an engine error card, and the same `routingError` suppresses the referral ServiceRequest, the CDS index card and the note's routing lines. A summary error withholds the patient summary. Every error is recorded. | Inv §4.1 #2 and risk 4. Silently skipping a broken rule would be warning instead of gating (judge 1, against C §3.2). In the baseline the Scribe referral does not depend on the recommendations (Scb L1400), so withholding the cards alone would still have issued a referral (review). |
| **D7** | **Per-surface copy is kept verbatim.** Screener and Scribe routing copy, the bundle text differences and the Scribe note's context order (B §2.1, §5.2) stay as they are. **Red flags reconcile to the canonical Screener wording** (Inv §2, red-flags row). | No clinician-visible rewording (against A G8). CLAUDE.md requires the canonical copy wherever two upstream copies diverge. |
| **D8** | **Identity and lineage.** Identifier fields, *including the code, answer, criteria and weight-extension systems*, are templates over `{id}` and `{instrument}`. Built-in ids, the `<built-in id>-` prefix, built-in logic ids and built-in labels are reserved. A derived module gets a new id and records its **root** (the built-in, for every MASQUE derivation) and its whole lineage. Within a family, instrument version and `instrumentHash` determine each other, and an instrument that differs from its root's must carry the pre-release tag `-local` (`0.2-local.3f9a1c`), which no built-in version may contain. Lineage claims in uploaded or restored files are verified, never trusted (§3.11). The calibration applies only when `research.calibration.appliesTo.scoringHash` equals the module's `scoringHash`. | An edited rubric can never publish as `masque-screener-v0.2`, `masque-index` or a code in `http://masque.example/codes` (Inv §7 risk 1), and a derived instrument never prints as a plain MASQUE number. Comparing only with the immediate parent let a second-generation edit or a hand-edited download print as instrument 0.2 (review). A probability is never computed from constants fitted to another rubric. |
| **D9** | **Five version axes, each with its owner.** Release: `engine/policy.js APP_VERSION`. Instrument: `rubric.instrumentVersion`. Lexicon: `rubric.lexicon.version`. Probe set: `logic.probes.version`. Gold set: `rubric.lexicon.goldSet.version`. All five appear in the footer, manifest, model card and cohort rows (cohort rows carry release and instrument as today, plus `module_id`). The dropdown label is display copy. | CLAUDE.md, Inv §4.4. "MASQUE v1" in the label is not an axis. |
| **D10** | **The shell is one page, `app/screenair.html`.** The dropdown sits at the very top: built-ins, then **"Upload"**, then modules loaded this session. Below it are five tabs, mounted lazily and kept mounted but hidden after their first visit. `<main key={moduleKey}>` remounts everything when the module changes, after a dirty-state confirmation. The shell owns the caveat strip, provenance badge and version footer. Each clinician tab says that it keeps its own answers. | The user's layout requirement. Tab state survives tab switches; module switches cannot leak state (Inv §7 risk 6). The Screener and Scribe are separate screens, and the UI has to say so (review). |
| **D11** | **The Research tab** holds the population estimates (gated per module) and the research-readiness panel. A session store inside the module workspace feeds the panel with the last screen from each app and the captured rows. The panel is removed from under the Screener and Scribe and replaced by a link card. The panel's `band` default becomes `null`. When the calibration does not apply, *every* calibration-dependent figure is withheld. Cohort rows from another module or instrument version are excluded and counted. A screen whose source has not cleared routing gets no decision. | The user's requirement. In a standalone tab the panel often has no live screen, and a `'low'` default would render absent data as negative (invariant 1). Validation, fairness and mitigation all run through the calibration (review). |
| **D12** | **Upload accepts** a `.json` rubric, a `.js` logic or single-file module, a multi-file selection, or the `.zip` that Download-all produces. JS needs explicit consent, with its SHA-256 shown. A `.js` whose SHA-256 equals a loaded built-in's logic binds to that logic without running it and without consent. A modified copy of a built-in is offered as a derived module rather than refused. Nothing uploaded restores itself on reload. JSON uploads run no code. | The user's decision, plus the trust problem judges 1-3 raised. Download → edit → upload is the most literal reading of "Upload … would adjust all the questions and symptom weights" (review). |
| **D13** | **The Rubric Editor** edits a draft of any loaded module without switching to it. **Apply** forks a *derived* module: new id, required change note, axis bumps enforced, lineage recorded. It offers **Create** or **Create and switch**, and remembers the result in this browser unless the box is cleared. Nothing is edited in place, and logic is read-only. | An edited rubric must not claim to be MASQUE 0.2 (judges 1-3). Edits must not cost the clinician the current screens, and must survive a reload (review). |
| **D14** | **Download-all** produces a deterministic, store-only zip. It holds a manifest with the five axes kept separate, hashes, classification, provenance and change log; rubric, logic and documentation files per module; generated artifacts; and MASQUE's population artifacts. A derivation in it verifies again on re-upload. | The user's requirement. The zip is re-uploadable (round-trip test). |
| **D15** | **Patient Companion:** Print, `.txt` and a new self-contained `.html` download, both exports dated. The caveat and the unreviewed-translation banner are printed on every page, in a repeating table header that reserves its own space. A projection makes score, band, probability and clinician text structurally unreachable (§5.5), and a module-graph test guards it. Patient-facing provenance uses its own wording, which names no score. | The user's requirement, Inv §4.2 and invariant 4. A fixed-position header overlaps page 2 onward, and the clinician provenance line says "scores" (review). |
| **D16** | **Microphone:** `MASQUE_Voice.js` is unchanged. Voice language comes from `lexicon.lang`. Capture continues across the clinician tabs with a shell "● Listening" indicator and a Stop button. It **stops automatically** in any state from `starting` on when the Patient tab or patient mode opens, when the module changes and on `pagehide`. The Scribe refuses to start while a patient-facing view is shown. | The user's requirement. A patient-facing surface never coexists with a live microphone, including during the permission prompt (review). |
| **D17** | **Files stay coarse** (one `.jsx` per app). CSS strings move unedited and are scoped at runtime by `scopeCss`. Shared legacy files keep their paths (`MASQUE_Voice.js`, `PopulationArtifact.jsx`, `MASQUE_Population.jsx`, `MASQUE_SchemaCheck.js`, `ResearchReadinessPanel.jsx`). Retirement deletes an explicit list of files, never a glob. | The loader builds serially and its round trips add up (judge 3). Every candidate's `src/MASQUE_*` glob would have deleted voice and population. |
| **D18** | **Migration order:** M1 runs the shell over the *legacy* components first; then the generic apps swap in tab by tab. `simulator.html` redirects to `screenair.html` at **M2**, once the scenarios and demo cohorts exist in screenAIr. The legacy pages keep working until WP14 turns them (and `index.html`) into redirects. | The site is runnable at every merge (B P5), and a user-visible MVP exists early. Redirecting at M1 would have dropped the Simulator's cohort and fairness demos from a deployed M1 (review). |
| **D19** | **No new clinical content.** Rubric copy is moved verbatim (placeholder rule, §3.6). Patient context bins are **not** realigned. Strings untranslated today still fall back to English. New shell caveats are English-only until translated. | CLAUDE.md. Realigning bins would invent patient-facing strings (judge 1). |
| **D20** | **Persistence.** Only module definitions and editor drafts go to `localStorage`, and they are restored only on an explicit click. Answers, transcripts, cohort rows, patient data and uploaded JS are never stored. | Inv §4.2 (no patient research capture) and the upload trust boundary. |
| **D21** | **Release `0.4.0`**, pending the lead (Q2). | A new release changes routing location, exports and artifacts (VERSIONS.md: release moves on any app-level change). |
| **D22** | **Tests.** The browser page `app/tests/` is the source of truth and runs on the user's machine. A Playwright runner (cloud only) drives the same page with the CDNs routed to vendored copies. SHA-256 pins turn reference drift into INVALID rather than a false PASS. | No Node on the user's machine; the cloud cannot reach `esm.sh` or `jsdelivr` (judge 3). |
| **D23** | **The Simulator is retired as code** (Inv §6). Its five scenarios become sample cases (`sim-*`). `makeCohort` and `COHORTS` feed "Load demo cohort" in Research. The "What to notice" rails are not carried (Q4). | The user's "convert the Simulator": screenAIr is the tabbed program; the Simulator's condensed copies (wrong `scoreItem`) must not survive. |
| **D24** | **Population estimates appear only** for a built-in module that declares them, or for a module *verified* as derived from one (§3.11), under a banner. They never appear for an unverified upload. | The estimates describe the MASQUE §7.1 phenotype from survey items, not any rubric's weights (judges 1-3). A `derivedFrom` written into a file is not evidence (review). |
| **D25** | **The page injects the runtime.** Each page imports the loader natively and passes `env = {loader: {importModule, importSource, inspectSource}, appBase}` to its root through `boot`. Compiled code never imports `masque-loader.js`. Every module-data path (`registry.json`, rubric and logic files, population files, export fetches) resolves against `appBase`, the `app/` folder, never against the page. | Importing the loader by path compiles it through itself and fails on its own comment; a second instance would also have its own cache. Resolving against the page breaks the dev and test pages that sit one and two folders down (review). |
| **D26** | **Patient mode.** `patient.html` stays a standalone patient page: the default built-in module (or `?module=<built-in id>`), the Patient Companion, the caveat strip and a footer, with no tabs, module menu, upload, editor or research in its module graph. Inside screenAIr, **Hand to patient** enters the same view (`#mode=patient`), and leaving it needs a confirmation. The Patient tab shows the at-home link. | Patients fill the companion in at home to bring or send to their physician. Inside the clinician program a score was one click away (CLAUDE.md, Inv §4.2; review). |
| **D27** | **screenAIr is the home screen.** `index.html` keeps the launcher during migration and becomes a redirect to `screenair.html` in WP14. Its about text (description, notice, version list) moves into `ModuleInfo`'s About section. | The user asked for every feature "on the same home screen" (review). |

---

## 2. File layout

Every path is under `app/` unless it says otherwise. **N** = new, **C** = changed, **U** = unchanged, **R** = retired (deleted in WP14 by an explicit list), **→** = becomes a redirect page.

### 2.1 Pages

| File | St | Owner | Purpose |
|---|---|---|---|
| `screenair.html` | N | WP12 (M1) | The shell page. Same import map, Babel tag, `#masque-status`, `.masque-proto` pill and `noindex, nofollow` as today. Its module script imports the loader natively and calls `boot({entry: './src/shell/ScreenAIr.jsx', props: {env}})` with `env.appBase = new URL('./', document.baseURI).href` (D25, §6.4). Static `<title>screenAIr · Prototype</title>`; the shell sets `document.title` at runtime (§5.1). |
| `simulator.html` | → | WP12 (M2) | `noindex, nofollow`; `<meta http-equiv="refresh" content="0; url=./screenair.html">`; `location.replace('./screenair.html' + location.hash)`; a visible link plus "Prototype · not for clinical use". Until M2 it mounts the legacy Simulator (D18). |
| `index.html` | C→ | WP12 (M1), WP14 | From M1: leads with a large screenAIr card and a "For patients" card that links `patient.html`. The per-tab deep links are not repeated (the tab bar does that). The versions list gains "gold set 0.2.0", the Simulator card goes at M2, and the footer prose is updated (the panel now lives in Research). Notice and `noindex` kept. WP14 rewrites it as a redirect to `screenair.html` (D27); its about text is then in `ModuleInfo`. |
| `screener.html`, `scribe.html` | U→ | WP14 | Mount the legacy files until WP14, which rewrites them as redirects to `screenair.html#tab=screener\|scribe` (same template as `simulator.html`). |
| `patient.html` | U→C | WP12 (M2) | Mounts the legacy Patient until M2, then boots `./src/shell/PatientPage.jsx` with `props: {env}` (D26, §5.11). It keeps `noindex, nofollow` and the pill, and drops the `.masque-back` link, so the page offers no route to the clinician program. It never becomes a redirect. |
| `population.html` | U→ | WP14 | Unchanged until WP14, then redirects to `screenair.html#tab=research`. `app/etl/README_DATA_CONNECTION.md` names this page, and the redirect keeps that pointer valid. |
| `.htaccess` | U | — | No redirects in `.htaccess`: the FTP host and `python -m http.server` both ignore them (judge 3). |

### 2.2 Runtime

| File | St | Owner | Purpose |
|---|---|---|---|
| `assets/masque-loader.js` | C | WP0 | Adds `importSource(text, {filename, byteLength, maxBytes})` and `inspectSource(text, {filename})`, builds dependencies in parallel, detects import cycles, lets `boot` pass props to the root, and drops the specifier examples from its own comments (§6). `boot` and `importModule` keep their existing behaviour for every current call. |

### 2.3 Modules (served as data; fetched, never imported by relative path)

| File | St | Owner | Purpose |
|---|---|---|---|
| `modules/registry.json` | N | WP12 | `{"format":"screenair-registry","modules":[{"rubric":"./modules/masque/masque.rubric.json","logic":"./modules/masque/masque.logic.js","docs":["./modules/masque/SOURCES.md"],"default":true}]}`. Paths are relative to `app/` and resolve against `env.appBase`, never the page (D25). `docs` lists the module's other files, which Download-all copies byte-for-byte (§5.8); WP14 appends `README.md` and `CHANGELOG.md` when it creates them. |
| `modules/masque/masque.rubric.json` | N | WP1 | The MASQUE rubric (§3.2, §3.8). UTF-8 without BOM, LF, `JSON.stringify(x, null, 2)` + `"\n"`, no `\u` escapes for non-ASCII. |
| `modules/masque/masque.logic.js` | N | WP2 | The MASQUE logic (§3.3). `export default {…}`, no imports. Its header comment maps every block to its baseline source lines. |
| `modules/masque/SOURCES.md` | N | WP1 | Field-by-field source map of the rubric: field → baseline file:lines → reconciliation choice. |
| `modules/masque/CHANGELOG.md` | N | WP14 | Human-readable change log, compiled from `rubric.changelog` and the logic header. |
| `modules/masque/README.md` | N | WP14 | The clinical rationale header comments of the seven legacy files, moved verbatim (Inv §3, header rows). |

### 2.4 Engine — `src/engine/` (plain JS; no React; no module literals; no import-time side effects)

WP0 commits **every file in this table** on day 1: its own files in full, every other file as a stub with the final export names, each export throwing `Error("not implemented: WPn")`. Imports therefore resolve from the start, and the owning package replaces the body (§9.0).

| File | St | Owner | Exports (signatures in §4) |
|---|---|---|---|
| `contract.js` | N | WP0 | `CONTRACT_VERSION`, format constants, `SUPPORTED_LOCALES`, `LOGIC_PATHS`, `IDENTITY_TEMPLATE_FIELDS`, `KIN_FIELDS`, `COPY_SLOTS`, JSDoc typedefs for Rubric, Logic, Module and the state shapes |
| `vocab.js` | N | WP0 | `BANDS`, `LOWEST_BAND`, `HIGHEST_BAND`, `INDETERMINATE`, `BAND_INTERP`, `TIERS`, `TIER_RANK`, `ANSWER`, `CAPTURE_KIND`, `PROBE_KIND`, `PROBE_KIND_ORDER`, `STEP_KIND`, `isAnswered`, `normalizeAnswer` |
| `policy.js` | N | WP0 | `APP_VERSION`, `SITE`, `CAVEATS`, `LIMITS`, `LOCALE_NAMES`, `OMISSION_PATTERNS` |
| `hash.js` | N | WP0 | `sha256Hex`, `sha256HexSync`, `canonicalJson`, `utf8Bytes`, `djb2`, `hashProjections`, `rubricHashes` (the one implementation WP1's extractor and WP3's binder both call, §3.10) |
| `css.js` | N | WP0 | `scopeCss` |
| `download.js` | N | WP0 | `downloadText`, `downloadJsonFile`, `downloadBytes`, `fhirHtml` (Scr L618-625, L813-820, moved) |
| `prng.js` | N | WP0 | `mulberry32`, `pick` |
| `scoring.js` | N | WP3 | `scoreItem`, `itemBounds`, `bandFor`, `computeScore`, `scaleMaxOf`, `negativeMinOf`, `bandRangeText`, `meterZones`, `meterTicks`, `negativeValueOf` |
| `evaluate.js` | N | WP3 | `evaluateRules`, `renderTpl` (imports nothing, so the Patient graph stays small) |
| `rules.js` | N | WP3 | `buildRoutingState`, `routingRecs`, `buildPhenotypeState`, `derivePhenotype`, `activeDomains`, `gapSignals`, `referralFor`, `cdsPreview` |
| `gates.js` | N | WP3 | `safetyGate`, `routingGate`, `signGate`, `coverageGate`, `referralGate`, `calibrationGate` |
| `bind.js` | N | WP3 | `bindModule`, `renderIdentity`, `deepFreeze`, `parseRubricText`, `serializeRubric` |
| `lineage.js` | N | WP3 | `ancestorRecord`, `kinOf`, `familyOf`, `classifyLineage`, `checkVersionFamily`, `provenanceLines`, `availability` (§3.11, §4.16) |
| `generic.js` | N | WP3 | `GENERIC_LOGIC`, `ENGINE_COPY_DEFAULTS`, `defaultScreenerSteps`, `defaultPatientSteps`, `DEFAULT_DEMO_PATIENT`, `DEFAULT_FHIR` |
| `validate.js` | N | WP3 | `validateModule`, `validateRubricShape`, `formatReport` |
| `fhir.js` | N | WP4 | `buildQuestionnaire`, `buildCdsHooks`, `buildDataDictionary`, `buildBundle` |
| `cohort.js` | N | WP4 | `CANONICAL_FIELDS`, `subjectPseudonym`, `screenToCohortRow`, `rowsToCsv`, `cohortColumnsCsv`, `makeCohort` |
| `extraction.js` | N | WP5 | `EXTRACTOR_KIND`, `createExtractor`, `extract`, `firstHit`, `allHits`, `cueBefore`, `faersToUtterances` |
| `probes.js` | N | WP5 | `liveProbes`, `validateProbes`, `truncateProbes` |
| `scribe.js` | N | WP5 | `ingestCaptures`, `rankSuggestions`, `captureLabel`, `itemShort`, `buildNote` |
| `patient.js` | N | WP6 | `PATIENT_CHROME`, `TIER_DISPLAY`, `GRAMMAR`, `projectForPatient`, `localeText`, `buildPatientSummary`, `askForm`, `joinList`, `summaryText`, `summaryHtml`, `richText` |
| `derive.js` | N | WP11 | `createDraft`, `diffRubrics`, `classifyChanges`, `lockedPaths`, `acknowledgePaths`, `proposeIdentity`, `deriveRubric` |
| `zip.js` | N | WP11 | `crc32`, `zipStore`, `unzip` |
| `exportAll.js` | N | WP11 | `buildExportFiles`, `README_TEXT` |

### 2.5 Apps — `src/apps/`, and shared UI — `src/ui/`

| File | St | Owner | Purpose |
|---|---|---|---|
| `ui/common.jsx` | N | WP0 | App-shared UI used by apps and shell alike: `SessionProvider`, `useSession` (§5.6), `ProvenanceBadge`, `TabNote` (§5.1). It imports only engine files, `react` and `lucide-react`, and never an app or shell file, so no import cycle can pass through it (§8.3 `static`). |
| `Screener.jsx` | N | WP7 | Generic Clinician Screener (from Scr L824-1444). It takes the Screener CSS string verbatim (Scr L629-810) and wraps it with `scopeCss(…, '.sa-screener')`. |
| `SampleRail.jsx` | N | WP7 | Sample-case buttons (B §1.2), grouped into "Samples" and "Scenarios". |
| `Scribe.jsx` | N | WP8 | Generic Ambient Scribe (from Scb L727-1297, including `VoiceMeter`). Scribe CSS verbatim (Scb L591-716), scoped under `.sa-scribe`. |
| `PatientCompanion.jsx` | N | WP9 | Generic Patient Companion (from Pat L644-1094). The `.mp` CSS is moved byte-identical except the print rules listed in §5.5. |
| `ResearchTab.jsx` | N | WP10 | Population section plus readiness section with source selectors (§5.6). |
| `RubricEditor.jsx` | N | WP11 | Editor and the Download-all entry point (§5.7, §5.8). Also exports `ApplyDialog`, which the upload dialog reuses for "Load as derived" (§3.11). |

### 2.6 Shell — `src/shell/`

| File | St | Owner | Purpose |
|---|---|---|---|
| `ScreenAIr.jsx` | N | WP12 | Default-exported root; receives `env` from `boot` (§5.1). |
| `ModuleWorkspace.jsx` | N | WP12 (M2) | Rendered inside `<main key>`: owns the `SessionProvider`, builds `onScreen`/`onCapture` from the session API and renders the five tab panels (§5.1). |
| `PatientPage.jsx` | N | WP12 (M2) | Default-exported root of `patient.html`: loads the built-ins through `registry.loadBuiltins` and renders patient mode only (§5.11). |
| `ModulePicker.jsx` | N | WP12 | The `<select>` at the top (§5.2). |
| `UploadDialog.jsx` | N | WP12 | Upload modal, consent step, lineage classification, "Load as derived" path and error report (§5.2). |
| `registry.js` | N | WP12 | Loads built-ins, classifies and binds uploads, recognises built-in logic by SHA-256, dedupes, enforces reserved ids, saves and restores modules (§5.2). |
| `chrome.jsx` | N | WP12 | `CaveatStrip`, `PrintFrame`, `VersionFooter`, `MicIndicator`, `InvalidModule`, `ModuleInfo`, `ConfirmDialog`, `Toast`, `PatientModeBar`. |
| `shell.css.js` | N | WP12 | Shell tokens and chrome on `.sa-shell`, tab bar, print stylesheet (§5.10). |

### 2.7 Legacy and shared files under `src/`

| File | St | Owner | Fate |
|---|---|---|---|
| `ResearchReadinessPanel.jsx` | C | WP10 (WP14 removes `PROJECTS.MASQUE`) | Backward-compatible prop additions (§5.6). Stays at its path; the legacy pages keep importing it until retirement. |
| `MASQUE_Population.jsx` | C | WP10 | Optional props `{baseUrl, indexPath, schemaPath, mapPath, embedded, banner}`, whose defaults reproduce today's page (`baseUrl` defaults to `document.baseURI`). CSS wrapped by `scopeCss(CSS, '.sa-pop')` and the root becomes `<div className="sa-pop"><div className="pop">…`. |
| `PopulationArtifact.jsx` | U | — | Imported by the panel and the population page. |
| `MASQUE_SchemaCheck.js` | U | — | Also imported natively by `tests/population-artifact-check.html` (stable path). |
| `MASQUE_Voice.js` | U | — | Imported by `apps/Scribe.jsx` (`createVoiceCapture`, `isVoiceSupported`, `isSecureForMicrophone`, `VOICE_ENGINE`, `VOICE_LANG`, `VOICE_ERRORS`). |
| `MASQUE_Screener_v0_3.jsx`, `MASQUE_Scribe_v0_3.jsx`, `MASQUE_Patient_v0_3.jsx`, `MASQUE_Simulator.jsx`, `MASQUE_Extraction.js`, `MASQUE_Probes.js` | R | WP14 | Mounted by the legacy pages (and by the M1 shell) until WP14. Frozen copies live in `tests/baseline/src/`; `reference/` and git history keep the rest. |

### 2.8 Unchanged trees

`data/**`, `etl/**`, `tests/fixtures/**` (existing) and `tests/population-artifact-check.html` stay as they are. The one exception is `data/README.md`, which gets a one-sentence update in WP14: cohort rows are now uploaded "in the Research tab".

### 2.9 Tests — `tests/` (local-only, never deployed)

| Path | Owner | Purpose |
|---|---|---|
| `tests/baseline/src/*` (11 files), `tests/baseline/MANIFEST.sha256`, `tests/baseline/README.md` | WP0 | A byte-identical copy of the eleven `app/src` files as of the WP0 commit: Screener, Scribe, Patient, Simulator, Extraction, Probes, panel, Voice, Population, PopulationArtifact, SchemaCheck. It is the primary oracle (D2). |
| `tests/index.html` | WP13 | The self-check page. Same import map and Babel tag as the app pages. Its module script imports the loader natively, builds `env` with `appBase = new URL('../', location.href).href`, loads `./harness/runner.js` through `importModule` and calls its `run(env)` (§8.0). |
| `tests/harness/*.js` | WP13 | `oracles.js` (baseline and reference imports with appended exports), `slices.js` (SHA-pinned inline-logic slices), `render.js` (renderHook, detached rendering, textContent capture), `clock.js`, `diff.js` (path-reporting deep diff with allowed-difference normalisers), `divergences.js` (pinned baseline↔fixed-src hunks), `runner.js`. The API is the §8.0 contract. |
| `tests/suites/index.json` | WP13 (day 1) | The fixed, ordered list of every planned suite path. The runner loads each at run time, so a suite whose package has not merged reports FAIL "not present" instead of breaking the page (§8.0). |
| `tests/suites/*.js` | WP13 owns the core suites. WP3 adds `validate.js`; WP7–WP9 add `render-*.js`; WP10 adds `research.js` and `research-parity.js`; WP11 adds `editor.js` and `roundtrip.js`; WP12 adds `upload.js` | §8.3. |
| `tests/fixtures/mutations/**` | WP3 | Mutation-corpus generators, one or more per validator code V1–V60 (§4.14). They are compiled modules, so any source text containing an import is fetched from `tests/fixtures/modules/*.txt`, never inlined (§8.0). |
| `tests/loader-check.html` | WP0 | Local check of `importSource`, `inspectSource`, cycle detection, `boot` props and the parallel builds; WP13 later folds it into the suites. |
| `tests/fixtures/modules/*` | WP13 (day 1) | `shape.rubric.json` (a structurally different data-only rubric), `shape.logic.js`, placeholder module fixtures, and malformed or malicious uploads for the upload suite (§8.3). Non-clinical placeholder text only ("Example item A"). Fixtures are data: fetched as text or bytes, never imported by path. |
| `tests/tools/extract-rubric.html` + `extract-rubric.js` | WP1 | In-browser extractor that builds `masque.rubric.json` from the baseline constants (§3.8). Committed, so the move is reproducible. |
| `tests/dev/{screener,scribe,patient,research,editor}.html` + `tests/dev/Mount*.jsx` | WP7–WP11 (one each) | Each mounts a single generic app with the built-in MASQUE module through `shell/registry.js`, without the shell (B P5). The page passes `env` with `appBase = new URL('../../', location.href).href`. |
| `tests/playwright/run.mjs`, `vendor.mjs`, `voice-stub.js`, `.vendor/` (gitignored), `report.json` (gitignored) | WP13 | Cloud runner (§8.6). `vendor.mjs` also packs `pdfjs-dist` (test-only) for the `print` spec. |
| `tests/playwright/specs/{voice,print,editor,pages,upload}.mjs` | WP8, WP9, WP11, WP12, WP12 | The E2E specs that `run.mjs` loads (§8.3). |

### 2.10 Docs

| File | Owner | Purpose |
|---|---|---|
| `docs/refactor/03-design.md` | this document | — |
| `docs/refactor/04-module-authoring.md` | WP14 | How to write a rubric or logic file. Field reference taken from `contract.js`; the validator codes and what each one means; the upload, edit and download round trip. |
| `docs/refactor/02-app-divergences.md` | WP14 | Appends a "screenAIr 0.4.0" section: every allowed difference from §8.4, new and retired files, and the version label. |
| `.gitignore` (repo root) | WP0 | Adds `app/tests/playwright/.vendor/` and `app/tests/playwright/report.json`. |
| CLAUDE.md "Layout" paragraph | lead | WP14 drafts replacement text in its PR description. Agents do not edit CLAUDE.md. |

---

## 3. Module contract

### 3.1 Two layers and the boundary between them

| Layer | Format | What it holds | Who may edit it |
|---|---|---|---|
| **Rubric** | One JSON object. `format: "screenair-rubric"`, `contractVersion: 1`. **No functions anywhere** (V4). | Identity; instrument version; domains and items (weights, scales and `f` factors, `ref`, `ask`, `short`, `tag`, `patientClin`); band cut-points; context items and gap-rule data; red flags (clinician wording); steps; phenotype vocabulary, referral and CDS-term tables; info prompts; samples and demo; lexicon (phrases, cue lists, windows, language, gold-set reference); patient wording per locale with `reviewed` flags; FHIR/CDS identity templates and strings; research config; copy slots; provenance; change log. | Rubric Editor (editable subset, §5.7); hand-editing a downloaded file followed by Upload. A hand-edited copy of a built-in or derived module loads as a new derived module through the Apply dialog (§3.11). |
| **Logic** | One JS file, `export default {…}` with `format: "screenair-logic"`. **No `import`, no `export … from`, no dynamic `import()`, no JSX** (enforced by `importSource`). | Closures only, plus the data a closure needs next to it: phenotype derivation and activation rules, routing rules with their per-surface copy, patient-summary groups, derived predicates and `said`/`ask` rules, `SUM` templates per locale, the probe set (whole, because `when` is a closure), and the mandatory `reads` declaration. | Not editable in screenAIr v1. It is replaced only by uploading a `.js` file. The editor shows it read-only. |
| **Bound module** | Runtime object returned by `bindModule(rubric, logic)` and deep-frozen. | Rubric plus logic plus engine defaults plus derived lookups plus rendered identifiers plus hashes plus provenance (§3.4). | Nobody. Apps receive it as `module`; the Patient app receives a projection (§5.5). |

**`LOGIC_PATHS` (the closure whitelist, `engine/contract.js`).** Function values are allowed only at these paths. Anything else in the logic object must be plain JSON data, and the rubric may contain no function at all (V4, V40):

```
phenotypes.derive[].when            phenotypes.activation[].when
routing[].when                      routing[].copy.screener.{h,p,chips}   routing[].copy.scribe.{h,p,chips}
patientSummary.derived.<name>       patientSummary.said[].{when,text}     patientSummary.ask[].{when,text}
locales.<loc>.sum.<any depth>       probes.list[].when
```

### 3.2 Rubric typedef (JSON)

Written as JSDoc in `engine/contract.js`. **R** = required, **O** = optional; §3.5 gives the engine behaviour when an optional field is absent. The MASQUE source for each field is in §3.8.

```js
/**
 * @typedef {Object} Rubric
 * @property {"screenair-rubric"} format        R
 * @property {1} contractVersion                 R
 * @property {string} id                         R /^[a-z][a-z0-9-]{1,47}$/, not ending in "-". Module id: cohort `module_id`, `{id}` in identity
 *                                                 templates (a host name label in the systems), file names, modelVersion. A non-built-in id
 *                                                 may not equal a built-in id or start with "<built-in id>-" (V8, §3.10).
 * @property {string} label                      R Dropdown and page-title text only. Never in any identifier (V7). A non-built-in label may not
 *                                                 equal a built-in label (V8).
 * @property {string} name                       R Display name used by copy and engine chrome via {name} ("MASQUE").
 * @property {string} [icon]                     O lucide icon name; default "Stethoscope". Unknown → warning, falls back to "Info".
 * @property {string} instrumentVersion          R Instrument axis ("0.2"). Questionnaire.version, {instrument}, cohort `instrument_version`.
 * @property {"generic"|{moduleId:string, logicSha256?:string}} logicBinding  R  (§3.9)
 * @property {Domain[]} domains                  R ordered; the order is the domain order everywhere
 * @property {{cuts:{moderate:number, high:number}}} bands  R integers, 0 < moderate < high ≤ scaleMax
 * @property {ContextItem[]} [contextItems]      O
 * @property {{threshold:number, markers:string[], noteOrder?:string[]}} [gapRule]  O  markers = context ids in the
 *                                                 positional order the logic's sum.gap expects; noteOrder = Scribe note order
 * @property {RedFlag[]} redFlags                R ≥ 1
 * @property {{screener?:ScreenerStep[], patient?:PatientStep[]}} [steps]  O
 * @property {PhenotypeData} [phenotypes]        O
 * @property {{gateDomain:string, tagPrefix:string, maxScored:number, maxTotal:number,
 *             prompts:Array<{id:string, tag:string, ask:string}>}} [infoPrompts]  O
 * @property {SampleCase[]} [sampleCases]        O
 * @property {{patient?:DemoPatient, transcript?:Array<["md"|"pt", string]>}} [demo]  O
 * @property {Lexicon} [lexicon]                 O
 * @property {string} [defaultLocale]            O "en" (the only value accepted in contract 1)
 * @property {Record<string, LocaleData>} [locales]  O patient-facing wording; keys ⊆ SUPPORTED_LOCALES ("en","es")
 * @property {Research} [research]               O
 * @property {FhirData} [fhir]                   O
 * @property {CdsData} [cds]                     O
 * @property {Copy} [copy]                       O
 * @property {Provenance} [provenance]           O (required when the module is derived)
 * @property {ChangelogEntry[]} changelog        R (may be [])
 *
 * @typedef {Object} Domain
 * @property {string} key                        R /^[a-z][a-z0-9_]*$/. FHIR group linkId and `domain-{key}` code.
 * @property {string} label                      R clinician label
 * @property {number} max                        R declared max; Σ item w must equal it (V15); negative for a negative domain
 * @property {boolean} [negative]                O
 * @property {string} [shortTag]                 O Scribe suggestion tag when the item has no tag (default label.toLowerCase())
 * @property {Item[]} items                      R ≥ 1, instrument order
 *
 * @typedef {Object} Item
 * @property {string} id                         R unique across items, context items, flags and info prompts
 * @property {number} w                          R ≠ 0; sign must match the domain
 * @property {string} text                       R clinician text (Questionnaire item text, Screener question, chips)
 * @property {string} [short]                    O Scribe short label (capture tags, note lines, "re-asking"). Absent → the id is shown (parity: n_allo).
 * @property {string} [ask]                      O physician phrasing for Scribe suggestions. Absent → text.
 * @property {string} [tag]                      O full tag string, e.g. "VM-PATHI · disequilibrium"
 * @property {string} [ref]                      O criterion code, emitted to fhir.criteriaSystem
 * @property {Array<{label:string, f:number}>} [scale]  O present ⇒ choice item (answer = option index); absent ⇒ boolean "yes"/"no"
 * @property {string} [patientClin]              O clinical line in the patient summary's "For my clinician" block. Absent → text.
 *
 * @typedef {Object} ContextItem                 unscored; not in the Questionnaire; not a cohort column
 * @property {string} id                         R
 * @property {string} text                       R clinician question
 * @property {Array<[string,string]>} options    R [[value,label]], the Screener vocabulary (values '0-1','2','3+' …)
 * @property {string} [captureLabel]             O Scribe capture-tag text for any captured value (Scb L1301-1302)
 * @property {{value:string, screenerLabel:string, scribeLabel:string, noteLabel:string}} [signal]  O gap-rule marker
 *
 * @typedef {Object} RedFlag                     clinician wording only; patient wording lives in locales
 * @property {string} id                         R
 * @property {"emergent"|"urgent"} tier          R
 * @property {string} group                      R order of first appearance = display order
 * @property {string} text                       R
 * @property {string} points                     R clinician only; never reaches the patient projection
 * @property {string} action                     R clinician only
 * @property {string} [ask]                      O kept as data, unread (Q6)
 * (Validator V22: a flag has no w / weight / f / scale / score key.)
 *
 * @typedef {Object} ScreenerStep                safety first and result last, exactly one of each (V25)
 * @property {string} key                        R
 * @property {"safety"|"domain"|"result"} kind   R
 * @property {string[]} [domainKeys]             O rendered in order (domain kind only)
 * @property {Array<"complaintPicker"|"context">} [extras]  O fixed render order: picker → domains → context
 * @property {"complaint"} [requires]            O Next is disabled until a complaint is picked (Scr L888)
 * @property {{eyebrow:string, title:string}} rail  R e.g. {"00","Safety check"}
 * @property {{eyebrow:string, heading:string, sub?:string}} [card]  O e.g. {"01 · Intake","Presenting picture","What is …?"}
 * @property {Record<string,string>} [domainIntro]  O e.g. {recalcitrance:"Recalcitrance markers — the premise of the screen"}
 *
 * @typedef {Object} PatientStep                 between the shell-fixed intro+safety and summary sections
 * @property {string} key                        R
 * @property {"story"|"domain"} kind             R
 * @property {string[]} domainKeys               R
 * @property {Array<"context">} [extras]         O
 *
 * @typedef {Object} PhenotypeData
 * @property {Array<{value:string, h:string, d:string}>} values  R picker order (Scr L1072-1076)
 * @property {string} scribeDefault              R value when no derive rule fires (Scb L849)
 * @property {string[]} [alwaysActive]           O domains always in the Scribe pool (Scb L857); default all domains
 * @property {string} [tagBoostDomain]           O items with a tag rank first while this domain is active (Scb L862-866)
 * @property {{byPhenotype:Record<string,{specialty:string, reason:string}>, default:{specialty:string, reason:string}}} [referral]  O
 * @property {{byPhenotype:Record<string,string>, default:string}} [cdsTerm]  O
 *
 * @typedef {Object} SampleCase
 * @property {string} id, label, buttonLabel     R
 * @property {"sample"|"scenario"} [group]       O rail group (default "sample")
 * @property {string} [icon], [why]              O why → button title
 * @property {string} [complaint]                O "" or a phenotype value
 * @property {Record<string,string>} [ctx]       O Screener vocabulary
 * @property {Record<string,true>} [rf]          O
 * @property {Record<string,"yes"|"no"|number>} a  R
 * @property {boolean} [safetyReviewed]          O default true (Scr L854)
 *
 * @typedef {{id:string, given:string, family:string, sex?:string, gender?:string, age?:number, mrn:string, synthetic:true}} DemoPatient
 *   (V50: never a dob/birthDate key)
 *
 * @typedef {Object} Lexicon                     Ext L24, L38-166 verbatim, keys renamed only
 * @property {string} version                    R lexicon axis ("0.3.1")
 * @property {string} [lang]                     O BCP-47 tag for voice capture; default "en-US" (Voice L47)
 * @property {{window:number, cues:string[]}} negation, thirdParty, historical  R
 * @property {Array<{id:string, ph:string[], thirdPartyExempt?:true}>} bool  R
 * @property {Array<{id:string, val:string, ph:string[]}>} ctx  R
 * @property {Array<{id:string, cue:string[], bands:Array<{ph:string[], v:number}>, fallback:number|null}>} scale  R
 * @property {Array<{ids:Array<{id:string, value:string|number, kind:"item"|"ctx"}>, ph:string[]}>} multi  R
 * @property {Record<string,string[]>} redFlags  R keys === flag ids, both ways, and every list non-empty (V28)
 * @property {{version:string, lexiconVersion:string, file?:string}|null} goldSet  R for built-ins; O otherwise (a lexicon created in the
 *                                                 editor has none, and the footer then reads "gold set — (not benchmarked)")
 *
 * @typedef {Object} LocaleData
 * @property {boolean} reviewed                  R en true, es false (Pat L294); forced false on edit and while `stale` is non-empty (V55)
 * @property {boolean} [editedLocally]           O set by derive (§3.11)
 * @property {string[]} [stale]                  O JSON paths whose English source changed after this translation (§3.11)
 * @property {Record<string,{q:string, opts?:string[], ask?:string, help?:string}>} items       R when the Patient tab is wanted
 * @property {Record<string,{q:string, say:string}>} redFlags   R when items is present
 * @property {Record<string,{q:string, opts:Array<[string,string]>}>} [contextItems]  O the Patient's own value vocabulary (Pat L522-529)
 * @property {Record<string,{title?:string, heading?:string, lede?:string, intro?:string}>} [steps]  O keyed by patient step key
 * @property {{sub?:string, forYouIf?:string[], clinicianLede?:string}} [ui]  O
 *
 * @typedef {Object} Research                    RRP L25-56 + knobs; consumed only by the Research tab
 * @property {string} projectKey, title, target  R
 * @property {number} threshold                  R
 * @property {{midpoint:number, slope:number, appliesTo:{scoringHash:string}}} calibration  R
 * @property {Array<[string,string]>} sources    R
 * @property {string[]} expected                 R
 * @property {Object[]} demo                     R rows, verbatim (sex/gender divergence kept)
 * @property {string[]} scoreAliases             R
 * @property {string} artifactKey, etlScript     R
 * @property {string[]} fairnessAxes             R
 * @property {{selectionGapTolerance?:number, sensitivityGapTolerance?:number, specificityGapTolerance?:number,
 *             toleranceSetBy:string, toleranceRationale:string, toleranceSetOn:string}} [fairnessPolicyOverride]  O
 * @property {Array<{id:string, label:string, why:string, spec:CohortSpec}>} [demoCohorts]  O
 * @property {{index:string, schema:string, map:string}} [population]  O paths relative to app/ (resolved against env.appBase), under ./data/
 *                                                 or ./etl/; only on a built-in or a verified derivation of one (V37, V54)
 *
 * @typedef {{seed:number, prevalence:number, hi:{pos:[number,number], neg:[number,number]},
 *            lo:{pos:[number,number], neg:[number,number]},
 *            groups:Array<{sex:string, gender:string, n:number, hi:boolean, labeled:boolean}>,
 *            extraRows?:Object[]}} CohortSpec   Sim L285-305 as data (B §5.5)
 *
 * @typedef {Object} FhirData                    every IDENTITY_TEMPLATE_FIELDS value, the systems included, contains {id} (V9)
 * @property {string} questionnaireUrl           "http://{id}.example/Questionnaire/{id}-screener-v{instrument}"
 * @property {string} questionnaireName, questionnaireTitle, publisher, description, safetyGroupText
 * @property {string} codeSystem                 "http://{id}.example/codes"
 * @property {string} answerSystem               "http://{id}.example/answer"
 * @property {string} criteriaSystem             "http://{id}.example/criteria"
 * @property {string} weightExtension            "http://{id}.example/StructureDefinition/item-weight"
 *                                                 (all five render byte-identical to today's literals for id "masque")
 * @property {string} indexCode                  "{id}-index"
 * @property {string} indexDisplay, documentType, documentTitle
 * @property {string} screenIdPrefix             "{id}-"
 * @property {string} filePrefix                 "{id}"
 *
 * @typedef {Object} CdsData
 * @property {string} serviceId                  "{id}-screen"
 * @property {string} hook, title, description
 * @property {{label:string, url:string}} source   url is a template: "http://{id}.example"
 * @property {string} safetyCardUuid, indexCardUuid   "{id}-safety", "{id}-index"
 * @property {{redFlagPresent:{flagId:string, summary:string},
 *             settled?:{score:number, band:"moderate"|"high", summary:string, detail:string}}} examples
 * @property {{safetyTitle:string, indexTitle:string, indexBody:string}} [preview]
 *
 * @typedef {Object} Provenance                  written only by deriveRubric (§3.11); verified on every load, never trusted
 * @property {AncestorRecord} root               the first module of the lineage (a built-in for every MASQUE derivation)
 * @property {AncestorRecord} derivedFrom        the immediate parent (equal to root for a first-generation derivation)
 * @property {AncestorRecord[]} lineage          root first … immediate parent last; root and derivedFrom repeat its two ends (V52)
 * @property {string} contentHash                SHA-256 of canonicalJson(rubric without `provenance`), taken at Apply; detects later edits
 * @property {string} createdAt                  ISO date of Apply
 * @property {{name:string, sha256:string}} [source]   the uploaded file a "Load as derived" started from (§3.11)
 *
 * @typedef {{moduleId:string, label:string, origin:"builtin"|"uploaded"|"derived", instrumentVersion:string,
 *            lexiconVersion:string|null, rubricSha256:string, logicSha256:string|null,
 *            instrumentHash:string, scoringHash:string, lexiconHash:string|null}} AncestorRecord
 *
 * @typedef {{date:string, kind:"reconciliation"|"extraction"|"derived"|"note", note:string,
 *            author?:string, paths?:string[], axes?:Record<string,[string,string]>,
 *            acknowledged?:string[]}} ChangelogEntry    acknowledged = JSON pointers confirmed in the Apply dialog (§5.7)
 */
```

`Copy` is the slot catalog in §3.6. Every key is optional and falls back to `ENGINE_COPY_DEFAULTS`.

### 3.3 Logic typedef (JS) and the state handed to closures

```js
/**
 * @typedef {Object} Logic                        `export default` of <id>.logic.js
 * @property {"screenair-logic"} format          R
 * @property {1} contractVersion                  R
 * @property {string} moduleId                    R must equal rubric.logicBinding.moduleId
 * @property {string} [logicVersion]              O informational; not a version axis (the logic SHA-256 identifies it)
 * @property {Reads} reads                        R
 * @property {{derive?:Array<{value:string, when:(s:PhenotypeState)=>boolean}>,
 *             activation?:Array<{id:string, domains:string[], when:(s:ActivationState)=>boolean}>}} [phenotypes]
 * @property {RoutingRule[]} [routing]            ordered; evaluated only after the engine gates (§4.5)
 * @property {{groups:Record<string,string[]>, derived:Record<string,(s:PatientState)=>any>,
 *             said:SummaryRule[], ask:SummaryRule[]}} [patientSummary]   last ask rule has no `when` (V43)
 * @property {Record<string,{sum:Object}>} [locales]   SUM[loc] verbatim: strings, arrays, word maps and template functions
 * @property {{version:string, list:Probe[]}} [probes]  probe-set axis + the verbatim probe list (order = PROBES then VM_PROBES)
 *
 * @typedef {Object} Reads                        what the closures depend on; checked against the rubric (V41) and for completeness (V47)
 * @property {Record<string, "boolean"|{scale:number}>} items   every item id any closure or probe reads/writes, with type and exact option count
 * @property {Record<string, {negative?:boolean}>} [domains]    domain keys read via s.domains / s.items
 * @property {string[]} [redFlags]                flag ids read by closures or written by probe options
 * @property {string[]} [phenotypes]              phenotype values compared by closures
 * @property {Record<string,string[]>} [context]  context ids and values read by closures
 * @property {string[]} [gapMarkers]              exact order sum.gap expects its positional booleans; must equal rubric.gapRule.markers
 *
 * @typedef {Object} RoutingRule
 * @property {string} id                          R unique
 * @property {(s:RoutingState)=>boolean} [when]   O absent = always (only meaningful with fallback)
 * @property {true} [fallback]                    O emitted on a surface only if no non-fallback rule fired there
 * @property {{screener?:RecCopy, scribe?:RecCopy}} copy   R; a missing surface key = rule not shown on that surface
 * @typedef {{h:string|((s)=>string), p:string|((s)=>string), chips:string[]|((s)=>string[])}} RecCopy
 *
 * @typedef {{id:string, when?:(s:PatientState)=>boolean, text:(s:PatientState)=>string}} SummaryRule
 * @typedef {{id:string, kind:string, when:(answers:Object, redFlags:Object)=>boolean, target?:string, rescues?:string,
 *            say:string, why:string, opts:Array<{l:string, rf?:string, a?:Object, note?:string}>}} Probe   (Prb shape, unchanged)
 */
```

**State shapes.** Each is built by the engine as a fresh object and deep-frozen before any closure sees it (always, not only in development; the validator's smoke states are immutable recording proxies instead, see below). Closures must be pure: V48 calls each one twice and fails on a different result.

| State | Built by | Fields |
|---|---|---|
| `RoutingState` | `buildRoutingState` | `surface` ('screener'\|'scribe'); `answers` (copy; unanswered keys absent; Patient `'unsure'` never present); `ctx`; `complaint` ('' if none); `phenotypeError` (`null` or the derive error, which `routingRecs` turns into the rule-error gate); `band`, `total`, `floor`, `ceiling`, `coverage`, `scorable`, `answered`, `count`, `domains` (`computeScore` output); `items` (domain key → `{label, max, negative, items}` from the rubric, for chips such as Scr L944); `activeFlags` (`{id,tier,group,text,points,action}`); `override`; `emergent`; `routingCleared`; `lowestBand` 'low'; `highestBand` 'high'; `scaleMax`; helpers `yes(id)`, `no(id)`, `answered(id)` and `scale(id)` → number\|null. |
| `PhenotypeState` | `buildPhenotypeState` | `answers`, `yes`, `no`, `answered`, `scale`. |
| `ActivationState` | `activeDomains` | `answers`, `complaint`, plus the same helpers. |
| `PatientState` | `buildPatientSummary` | `a` (raw, may hold `'unsure'`); `ctx` (Patient vocabulary); `loc`; `S` = `logic.locales[loc].sum ?? logic.locales.en.sum` (Pat L903); `yes`; `scale`; `unsure`; `L(xs)` (locale list joiner); `groups` (name → ids answered `'yes'`, in group order, Pat L919/926/929/936); then every `derived` value spread onto the state in key order (`s.migPattern`, `s.vestPattern`). |

Probes keep their original signature, `when(answers, redFlags)`. Both arguments are frozen copies.

**Validator states (V46-V48).** Production states are plain deep-frozen objects. The validator's smoke states are different: each is built **with its recording proxies already in place**. Every proxy wraps an unfrozen shadow copy, and its `set`, `defineProperty` and `deleteProperty` traps throw, so the closure sees an immutable object. Nested objects are proxied bottom-up and stored as the parent's field values. A proxy over a *frozen* target could not return a wrapped child, because a `get` on a non-writable, non-configurable property must return the identical value. The helpers `yes`, `no`, `answered` and `scale` record the id they are called with, and the `s.S` proxy (V44) records the key it is asked for.

**Fail-closed rule (D6).** `evaluateRules` catches every throw. What follows depends on the family:

| Family | On a throw |
|---|---|
| routing | `recs = [ENGINE_RULE_ERROR card]` on both surfaces, and `routingRecs` returns the error as `routingError`. Every consumer withholds on it: no module recs, no referral ServiceRequest (the red-flag ServiceRequest is unaffected), no CDS index card, an A&P engine error line in the note instead of any rec or `copy.note.noDriver`, and an Observation note naming the withheld routing (§4.5-§4.7, §4.11). |
| phenotype `derive` | **treated as a routing error.** `routingRecs` shows the rule-error card naming the derive rule and returns the error as `routingError`, so everything in the routing row applies. The complaint is `""` only for display and the cohort row (where `""` means absent), and activation falls back to all domains. A fallback complaint is never used for routing, because `referralFor("")` would issue the default referral. |
| activation | all domains active. A superset is safe: the suggestion pool only widens. |
| patient `said`/`ask`/`derived`/`sum` | the summary is withheld (§5.5). Print and both downloads are disabled. |
| probe `when` | the probe is shown with an "evaluation error" tag. A safety question surfacing is the safe direction. |

Every error is recorded as `{family, ruleId, message}`. The shell shows a persistent red "Module logic error" strip while any error exists, and the test page fails on any. WP3 unit-tests every row for both surfaces, and the `rules` suite injects a throwing routing rule and a throwing derive rule into a copy of the MASQUE logic and asserts each absence above (§8.3).

### 3.4 Binding — `bindModule(rubric, logic, meta) → Promise<Module>`

1. **Shape pre-check:** `validateRubricShape`. Fatal problems (wrong `format`, wrong `contractVersion`, not an object) throw `BindError`. Everything else is reported by `validateModule`.
2. **Logic resolution:** `logicBinding === "generic"` → `GENERIC_LOGIC`. Otherwise the supplied logic; `logic.moduleId` must equal `logicBinding.moduleId`.
3. **Defaults:**
   - `copy`: `ENGINE_COPY_DEFAULTS` deep-merged *under* `rubric.copy`, so rubric keys win.
   - `fhir` and `cds`: `DEFAULT_FHIR` under the rubric.
   - `steps.screener`, `steps.patient`: `defaultScreenerSteps(rubric)` and `defaultPatientSteps(rubric)` when absent.
   - `demo.patient`: `DEFAULT_DEMO_PATIENT` when absent.
4. **Identity rendering:** `renderIdentity(rubric)` substitutes `{id}` and `{instrument}` into the template fields listed in `IDENTITY_TEMPLATE_FIELDS`.
5. **Derived lookups:**
   - `domainOrder`, `allItems` (each `{...item, domain}`), `itemById`, `flagById`, `redFlagGroups` (first-appearance order, Scr L149), `negativeDomainKeys`.
   - `scaleMax` (Σ positive max), `negativeMin` (Σ negative max), `bands = {cuts, rangeText, zones, ticks}`.
   - `locales[loc] = {data, sum, fallbacks}`. Merging over `en` is per leaf string. `fallbacks` lists the paths taken from `en`; the validator reports them (V33).
6. **Hashes:** `hash.js rubricHashes` (§3.10). `rubricSha256` is taken over the source bytes when they are known, and over `serializeRubric(rubric)` for derived modules. `logicSha256` is taken over the logic source bytes (`null` for generic).
7. **`meta`:** `{origin:'builtin'|'uploaded'|'derived', classification, key, sources:{rubricText, logicText}, files, loadedAt}`. `origin` and `classification` come from the registry: `builtin` for files listed in `registry.json`; otherwise from `classifyLineage` (§3.11), which verifies any lineage the file claims. Neither is ever read from the file, and a `provenance` block that fails verification grants nothing.
8. **Freeze:** `deepFreeze` the whole object, including the logic objects and their arrays.

### 3.5 Optional families and engine defaults (`engine/generic.js`)

A data-only rubric (`logicBinding: "generic"`) gets `GENERIC_LOGIC` = `{format, contractVersion, moduleId:"*generic", reads:{items:{}}, routing:[], phenotypes:null, patientSummary:GENERIC_SUMMARY, locales:{}, probes:null}`.

| Absent | Engine behaviour |
|---|---|
| `steps.screener` | `[safety, one domain step per domain (rail = {"0n", domain.label}, card = {eyebrow:"0n · "+label, heading:label}), result]` |
| `steps.patient` | `[a "story" step with the context extra (only if contextItems), one domain step per domain]`. Titles are the domain labels (`en`). |
| `contextItems` / `gapRule` | No context questions and no gap alert. A gap line is never produced. |
| `phenotypes` | Complaint is `''` everywhere. No picker; `requires:'complaint'` is rejected (V25). All domains are active. No referral ServiceRequest. No CDS index card. |
| `phenotypes.referral` / `cdsTerm` | No referral ServiceRequest / no CDS index preview card. |
| `logic.phenotypes.derive` (phenotypes present) | Scribe complaint = `scribeDefault`. |
| `logic.phenotypes.activation` | `alwaysActive` (default: all domains). |
| `logic.routing` (or `[]`) | The engine gates still emit override and incomplete cards. When cleared and scorable, the Screener shows the engine card **"No routing rules in this module"** / "This module defines no routing rules, so no next step is suggested from the index." The Scribe shows nothing, and its note shows `copy.note.noDriver`. |
| `logic.patientSummary` | `GENERIC_SUMMARY`. `said` = for each item in module order: `'yes'` → the item's own locale `q`, verbatim; scale value > 0 → `` `${q} — ${opts[v]}` ``. `ask = []`. `gapLine = null`. `unsureList` and `clin` are generic engine code (unchanged). It invents no sentence; Q10. |
| `logic.probes` | Probe rail hidden. Suggestions remain: unanswered items ranked by active domain, tag boost, then w (Scb L856-879). |
| `logic.locales[loc].sum` | Generic summary (above). |
| `infoPrompts` | None. |
| `sampleCases` | Rail hidden. |
| `demo.patient` | `DEFAULT_DEMO_PATIENT = {id:"{id}-demo", given:"Synthetic", family:"Patient", mrn:"SANDBOX-0000", synthetic:true}`. No sex, gender or age, so they render as "—". |
| `demo.transcript` | "Play demo visit" and "Step" are hidden. |
| `lexicon` | The Scribe transport (Listen, Play, Step, typed input) is hidden and the notice "This module has no extraction lexicon: speech and typed statements cannot be captured into the screen. Use the prompts." is shown. Gate, don't warn: no audio-derived text is gathered when it can have no structured use. The upload and Apply result cards and `ModuleInfo` say so before the module is used (`availability`, §5.2). The Rubric Editor can create a lexicon (§5.7). A transcript-only voice mode is open question Q28; this is the default until the lead answers. |
| `locales` (or `locales.en.items`) | The Patient tab is disabled and shows "This module carries no patient wording, so the Patient Companion is not available for it." Stated on the result cards like the lexicon. The Rubric Editor can create English patient wording (§5.7). |
| `research` | The Research tab shows the population section state (below) and "This module declares no research configuration; the readiness panel needs one." |
| `research.population` | "No population estimates for this module." |
| `fhir` / `cds` | `DEFAULT_FHIR`: `questionnaireUrl "http://screenair.example/{id}/Questionnaire/{id}-screener-v{instrument}"`, `codeSystem "http://screenair.example/{id}/codes"`, answer, criteria and weight URLs likewise, `cds.source.url "http://screenair.example/{id}"`; `indexCode "{id}-index"`; `serviceId "{id}-screen"`; `uuids "{id}-safety"/"{id}-index"`; `screenIdPrefix "{id}-"`; `filePrefix "{id}"`; the `questionnaireName` is generated from the id; neutral titles naming `{name}`. |
| `cds.preview` | Safety card title `ENGINE_COPY_DEFAULTS.cds.safetyTitle` (`"{name}: red flag present — evaluate before screening routing"`). No index card. |
| `cds.examples.settled` | Omitted from the CDS document. `notScorable: {cards: []}` and `redFlagPresent` are always emitted. |
| `copy.*` | `ENGINE_COPY_DEFAULTS`. They are neutral, name the module only as `{name}`, and never name a condition. WP3 writes them; they are reviewed in Q10. |

### 3.6 Copy: the move rule and the engine-owned sentence catalog

**Move rule** (checked by the values suite and V39):

1. Rubric and logic text is moved **byte-for-byte** from the baseline source.
2. A `{placeholder}` may replace (a) exactly one value the source interpolated (`${INSTRUMENT_VERSION}` → `{instrument}`, `${total}` → `{total}`), or (b) a literal restatement of the scale maximum ("100" in "/100" or "SCORE / 100"), which Inv §1.3 requires to be derived. Nothing else becomes a placeholder. A module brand literal ("MASQUE") inside *module* copy stays literal.
3. *Engine*-owned text is moved byte-for-byte into engine or app files. Within it, module noun phrases become named slots, literal 100/34/67 are derived, and a brand literal becomes `{name}` (t-ids, §8.3).
4. The only markup in data is `**bold**`, rendered by `richText`. No HTML anywhere in data.
5. Caveat strings never appear in module data (V38). They live in `engine/policy.js CAVEATS`.
6. Where two baseline copies diverge, the canonical copy in Inv §2 wins, and the choice is recorded as a `rubric.changelog` entry of kind `reconciliation`.

Placeholders available everywhere: `{name} {id} {instrument} {scaleMax} {indexName}`. Slot-specific ones are listed in `COPY_SLOTS`. An unknown placeholder fails V39.

**Rubric copy slots** (`Copy`). The MASQUE source of each is given; WP1 extracts them verbatim.

| Key | MASQUE source |
|---|---|
| `indexName` | Scr L1243 "MASQUE index" |
| `gate.patternPhrase` | Scr L898 "masked migrainous or neuropathic driver" |
| `screener.title`, `.subtitle` | Scr L1005-1006 |
| `screener.bandSuffix` | Scr L1255 "of a masked migrainous / neuropathic driver" |
| `screener.gapAlert.title`, `.body` | Scr L1303-1307. The engine prepends `labels.join(" · ") + ". "` |
| `screener.disclaimer` | Scr L1426-1429 |
| `screener.emrDetails[]` | Scr L1433-1439 (five `<div>`s; `**…**` for the `<b>` lead words) |
| `screener.specIntro` | Scr L1403-1404 |
| `scribe.title`, `.subtitle` | Scb L958-959 |
| `scribe.gapAlert.title`, `.body` | Scb L1079 |
| `scribe.vmpathiDisclaimer` | Scb L1252 |
| `scribe.about[]` | Scb L1258-1262 |
| `note.title`, `.screenHeading`, `.likelihoodOf`, `.patternPhrase`, `.infoCovered`, `.gapLine`, `.supportingFooter`, `.noDriver`, `.signOff` | Scb L1352-1393. "Instrument v0.3 candidates." is kept verbatim (Q7). |
| `cds.preview.safetyTitle`, `.indexTitle` (`{cdsTerm}`), `.indexBody` (`{total}/{scaleMax} ({bandLabel})`) | Scr L1334, L1344, L1347-1348 |
| `locales.en.ui.clinicianLede` (`{instrument}`, `**−**`) | Pat L1067-1069 |

**Engine-owned safety-critical sentences.** These stay in engine or app code verbatim from the baseline, and the module supplies only the slots in braces. The parity suites require byte equality for MASQUE.

| Where | Text (slots in braces) | Source |
|---|---|---|
| Screener rec, override | h `Red flag present — screening routing withheld ({emergent?"emergent":"urgent"})`; p `One or more findings need evaluation on their own terms before this presentation is treated as a {gate.patternPhrase}. The {indexName} below is retained for the record but issues no referral, no CDS prompt, and no reassurance while this is open.`; chips = active flag actions | Scr L895-903 |
| Screener rec, incomplete | h `Screen incomplete — no result issued`; p `The {answered} answered item{s} place the index between {floor} and {ceiling}/{scaleMax}, which spans more than one band. Complete the outstanding items before acting on this screen — an unfinished screen is not a negative screen, and no rule-out is implied.`; chips `{label} · {openPts} pts unanswered` | Scr L904-913 |
| Screener result, override box | `Red flag — evaluate before screening routing` … `The {indexName} is shown below for the record; it proposes no referral and no reassurance while this is open.` | Scr L1225-1239 |
| Screener result, outstanding list | `No band, referral, or CDS prompt is issued until the answered items settle the index into a single band. Unanswered items are **not** counted as denials.` | Scr L1280-1283 |
| CDS preview, safety | `CDS Hooks card · {critical\|warning} · order-select` + `{cds.preview.safetyTitle}` + `{actions · joined}. The screening index is withheld from routing.` | Scr L1330-1338 |
| CDS document | `redFlagPresent.detail = {flag.action}. The screening index is withheld from routing.`; `notScorable: {cards: []}` | Scr L489-515 |
| Engine rule-error card (new) | h `Module rule error — no routing issued`; p `Rule "{ruleId}" in module {id} failed ({message}). Routing is withheld rather than issued from a partial rule set; the index is unaffected.` | D6 |
| Note A&P on a routing error (new) | `  • Module rule error — no routing issued: rule "{ruleId}" in module {id} failed ({message}).` | D6 |
| Bundle Observation note on a routing error (new) | `Screening routing withheld: module rule "{ruleId}" failed, so no referral was issued.` | D6 |
| Scribe override box | `Red flag — routing withheld` / `Needs same-day evaluation.` \| `Expedited workup — days, not weeks.` + ` The index is retained but proposes nothing.` | Scb L1083-1094 |
| Scribe, review outstanding | `Safety check outstanding` / `No routing is issued until the red-flag review is recorded. Open the Safety tab.` | Scb L1095-1101 |
| Scribe safety tab | `Ambient capture can raise a flag but never clear one. Absence of a cue is not evidence of absence — confirm the review yourself.` | Scb L1117 |
| Scribe sign gate | button disabled + `Safety review outstanding — the note says so, so signing is blocked.` | Scb L1226-1231 |
| Note SAFETY REVIEW / INCOMPLETE / A&P gate lines | Scb L1355-1390 verbatim, with `{note.screenHeading}`, `{note.patternPhrase}`, `/{scaleMax}` | Scb L1355-1390 |
| Patient intro "What it isn't" | `It doesn't diagnose anything and it won't tell you what you have. It gives you no score and no risk number. …` | Pat L792-797 |
| Panel gates | the proposal-§11 fairness gate, abstention, `The {indexName} above is unaffected …`; the new calibration-gate text (§5.6) | RRP L866-880 |

### 3.7 Patient text: rubric locale data or engine chrome

| Baseline (Pat) | Destination |
|---|---|
| `P` / `ES_P` (L137-188 / L297-348) | `locales.{en,es}.items` |
| `RED_FLAGS[].q/say` / `ES_RF` (L225-262 / L350-375) | `locales.{en,es}.redFlags`. The tier maps through `TIER_DISPLAY` (emergent→now, urgent→soon). |
| `CONTEXT_Q` (L522-529, English only, the Patient's own values `1/2/3+`, `<6mo/6-12mo/>12mo`, `no/yes`) | `locales.en.contextItems`. es falls back to en, as today. **Not realigned** (D19). |
| `UI[loc].sub` | `locales[loc].ui.sub` |
| `UI[loc].sections[2..7]` | `locales[loc].steps.{story,migraine,vestibular,neuro,impact,discriminators}.title` |
| `UI[loc].sections[0,1,8]` | `PATIENT_CHROME[loc].sections.{intro,safety,summary}` |
| `BLURB` / `BLURB_ES` (L761-774) | `locales[loc].steps[domainKey].lede` |
| Story heading/lede (L705-707), recalcitrance intro (L721), English only | `locales.en.steps.story.{heading,lede,intro}` |
| Intro bullets (L787-788), clinician paragraph (L1067-1069), English only | `locales.en.ui.forYouIf`, `locales.en.ui.clinicianLede` |
| `UI.reviewBanner` (es), `UI.txtUnreviewed` (es), heading literal "Traducción sin revisar" (L685) | `CAVEATS.unreviewed.es.{body, txt, title}` (shell-owned caveat) |
| Every other `UI` key (title, step, of, back, next, start, seeSummary, yes, no, unsure, tierNow…, sayThis, print, download, startOver, summaryTitle, openWith, describe, askAbout, notSure, notSureLede, forClinician, thinTitle, thin, txtSeenToday, txtSeenWeek, txtSay, txtClinNote, txtFooter, fileName) | `PATIENT_CHROME[loc]`, verbatim |
| English JSX literals: Intro (L779-804), Safety (L815-818, L839, L849, L855), Summary (L1017-1018, L1025, L1087-1089), footer (L753-754 with `{name}`, `{appVersion}`, `{instrument}`) | `PATIENT_CHROME.en` extra keys. es falls back (parity). |
| `SUM.en` / `SUM.es` (L427-502) | `logic.locales.{en,es}.sum`, verbatim, including `clinNote` with its literal "MASQUE" |
| `LOCALE_NAMES` (L295), `TIER` colours (L263-272) | `engine/policy.js LOCALE_NAMES`, `engine/patient.js TIER_DISPLAY` |
| `askForm` transforms (L981-986), `list` joiners (L988-994) | `engine/patient.js GRAMMAR = {en:{and:"and", oxford:true, ask:"en-regex"}, es:{and:"y", oxford:false, ask:"period-to-question"}}` |

### 3.8 The MASQUE module

**Files:** `app/modules/masque/masque.rubric.json` (WP1), `app/modules/masque/masque.logic.js` (WP2), `SOURCES.md` (WP1), `CHANGELOG.md` and `README.md` (WP14). **No `index.js`**: the module is loaded, not imported.

**Loading (built-in and upload share the path; `shell/registry.js`):**

```
loadBuiltins({env}): at = p => new URL(p, env.appBase)                         // D25: never the page's URL
  for each entry of fetch(at('./modules/registry.json')):
  rubricBytes = fetch(at(entry.rubric), {cache:'no-cache'}).arrayBuffer()     // LIMITS checked on the bytes
  logicBytes  = fetch(at(entry.logic),  {cache:'no-cache'}).arrayBuffer()
  rubricText  = new TextDecoder('utf-8', {fatal:true}).decode(rubricBytes)   // invalid UTF-8 → load error
  logicText   = …same…
  rubric      = JSON.parse(rubricText)
  logicNs     = await env.loader.importSource(logicText, {filename: entry.logic,
                    byteLength: logicBytes.byteLength, maxBytes: LIMITS.logicBytes})   // §6; throws on imports/JSX/syntax
  module      = await bindModule(rubric, logicNs.default,
                    {origin:'builtin', classification:'builtin', sources:{rubricText, logicText}, docs: entry.docs})
  validation  = await validateModule({module, loaded: alreadyLoaded})
  register(entry, module, validation)          // invalid → selectable, renders InvalidModule, never mounts apps
```

**How WP1 produces the rubric.** `app/tests/tools/extract-rubric.html` loads the baseline files with `importModule(path, {append: 'export {…};'})` (the same mechanism as the parity harness, §8.2) and assembles the rubric from the live constants. It writes `JSON.stringify(rubric, null, 2) + "\n"` through a download button, and the output is committed. The extractor *is* the documented mapping; `SOURCES.md` restates it per field. Hand-copying clinical strings is not allowed.

| Rubric field | Baseline source | Notes |
|---|---|---|
| `id` "masque", `name` "MASQUE", `icon` "Stethoscope" | Scr L1003, L1137 | |
| `label` "Dizziness and Sinusitis (MASQUE v1)" | user requirement 2026-10-02 | display only (Q1) |
| `instrumentVersion` "0.2" | Scr L45 | |
| `logicBinding` `{moduleId:"masque"}` | — | the built-in registry pairs the files; no SHA pin |
| `domains[]` (key, label, max, negative, items[id,w,text,scale,ref]) | Scr L172-258, key order kept | |
| `items[].short` | Scb L1309-1321 (29 entries) | `n_allo` has none, so the id is shown (Q24) |
| `items[].ask` | Scb L242-273 | |
| `items[].tag` | Scb L275-280 | |
| `items[].patientClin` | Pat L63-124 `c` | B Q5 |
| `domains[vestibular].shortTag` "vestibular" | Scb L872 | |
| `bands.cuts` | Scr L334 | |
| `contextItems[]` (id, text, options) | Scr L1190-1194 | |
| `contextItems[].captureLabel` | Scb L1301-1302 | |
| `contextItems[].signal` (value, screenerLabel, scribeLabel, noteLabel) | Scr L874-876; Scb L916-920; Scb L1345-1349 | |
| `gapRule` `{threshold:2, markers:["c_clin","c_dur","c_dismiss"], noteOrder:["c_dur","c_clin","c_dismiss"]}` | Scr L878; Pat L955-957; Scb L1345-1349 | |
| `redFlags[]` | Scr L110-147 | `ask` from Scb L189-240; Scribe and Simulator wording dropped (reconciliation) |
| `steps.screener` | Scr L82-92 (rail); Scr L1022-1027, L1066-1070, L1086, L1090-1094, L1098-1100, L1221 (cards) | |
| `steps.patient` | Pat L531-541, L705-729 | |
| `phenotypes.values` | Scr L1072-1076 | |
| `phenotypes.scribeDefault`, `alwaysActive`, `tagBoostDomain` | Scb L849; Scb L857; Scb L862-866 | |
| `phenotypes.referral` `{byPhenotype:{otologic:{specialty:"Neuro-otology", reason:"vestibular migraine"}}, default:{specialty:"Headache medicine / Neurology", reason:"mid-facial / migrainous cause"}}` | Scr L1456/L1577 ≡ Scb buildBundle | |
| `phenotypes.cdsTerm` `{byPhenotype:{otologic:"otologic"}, default:"sinonasal"}` | Scr L1344 | |
| `infoPrompts` `{gateDomain:"vestibular", tagPrefix:"VM-PATHI · ", maxScored:4, maxTotal:6, prompts}` | Scb L282-285, L857-880, L1344 | |
| `sampleCases[]` | Scr L261-312 with buttonLabel and icon (Scr L994-997); `sim-empty`, `sim-partial`, `sim-high`, `sim-redflag`, `sim-ruleout` from Sim L307-330 (`group:"scenario"`, why kept, FULL_HIGH inlined, `step` dropped, `complaint:""`) | Q3 |
| `demo.patient`, `demo.transcript` | Scr L314-317; Scb L569-584 | |
| `lexicon` | Ext L24, L38-166 verbatim; `lang:"en-US"` (Voice L47); `goldSet:{version:"0.2.0", lexiconVersion:"0.3.1", file:"masque_extraction_goldset.json"}` | |
| `locales.en` / `locales.es` | per §3.7; `reviewed` from Pat L294 | |
| `research` | RRP L25-56 + `scoreAliases ["masque_score"]` + `artifactKey "masqueArtifact"` + `etlScript "etl/masque_population_etl.R"` (RRP L839, L966) + `fairnessAxes ["sex","gender"]` + `demoCohorts` (Sim L285-305, L677-681) + `calibration.appliesTo.scoringHash` (computed by the extractor with WP0's `rubricHashes`, the same function the binder calls) + `population {index:"./data/population-estimates.index.json", schema:"./etl/population_estimates.schema.json", map:"./etl/phenotype_map_nhis_2024.json"}` (Pop L31-33) | |
| `fhir` | Scr L80 (as template), L421-438, L443, L447, L467, L1537; `documentType`/`documentTitle` from Scb L1440-1442 | the four systems and the Questionnaire URL become `http://{id}.example/…` templates, which render byte-identical for `masque` |
| `cds` | Scr L476-517 (examples as data) + preview Scr L1330-1350 | `source.url` becomes the template `http://{id}.example` |
| `copy` | §3.6 | |
| `changelog` | the reconciliation entries below | |

**Reconciliations recorded in `rubric.changelog`** (kind `reconciliation`; this is the WP1 checklist):

1. Red flags take the canonical Screener wording (Scr L110-147). The Scribe abbreviations (Scb L189-240) and the Simulator variant are dropped. The Scribe `ask` is kept as unread data.
2. Item text is canonical from the Screener. Scribe ASK becomes `ask`; Scribe shortLabel becomes `short` (n_allo has none); Patient `c` becomes `patientClin`. The Simulator items (no `f`, linear scoring, Inv §2) are dropped.
3. Patient context options keep the Patient's own values and labels. The signal values (`3+`, `>12mo`, `yes`) are identical in both vocabularies.
4. Patient `ITEMS[].label/clinical` (never read) are dropped; the section titles are used.
5. Simulator scenarios are added as sample cases `sim-*`.
6. `PROJECTS.MASQUE` moves to `research`; BREATHE and VOICED stay in the panel (panel-only).

**MASQUE logic (`masque.logic.js`) contents, WP2.** Everything is moved verbatim, with free variables mechanically renamed to state fields:

- `phenotypes.derive`: `[{value:"both", when:s=>sin(s)&&oto(s)}, {value:"otologic", when:oto}]`, with `sin` and `oto` as file-local helpers transcribed from Scb L846-850.
- `phenotypes.activation` (Scb L857-859; `alwaysActive` in the rubric carries the L857 set): `{id:"vestibular", domains:["vestibular"], when: s => s.complaint === "otologic" || s.complaint === "both"}` and `{id:"neuro", domains:["neuro"], when: s => (s.answers.n_burn ?? "no") !== "no" || s.answers.n_viral === "yes"}`, mechanical renames of L858 and L859.
- `routing`: the five rules of Scr L914-945 (sinus_migraine, vestibular_migraine, neuro_overlay, tinnitus, competing). Each carries `copy.screener` (Scr L917-945) and `copy.scribe` (Scb L1329-1333), byte-for-byte. Add `{id:"no_driver", fallback:true, copy:{screener: Scr L946-950}}`.
- `patientSummary`: groups `mig`, `vOther`, `neu`, `disc` (Pat L919/926/929/936); derived `migPattern`, `vestPattern` (Pat L940-941); 16 `said` rules (Pat L910-937, in order); 9 `ask` rules (Pat L945-953, with `askBoth` and `askMig` as mutually exclusive predicates and `askNext` last with no `when`).
- `locales.en.sum` and `locales.es.sum`: Pat L427-502 verbatim.
- `probes`: `{version:"1.0.0", list:[…PROBES, …VM_PROBES]}` (Prb L56-290), verbatim and including comments.
- `reads`:
  - items: the routing reads (v_aural); the derive and activation reads (r_abx, r_surg, m_head, v_vertigo, v_motion, v_aural, v_head, n_burn, n_viral); every summary item; every probe `when` read and option write. Scale lengths: m_head 3, m_dur 5, v_vertigo 4, i_days 4, i_role 4.
  - domains: `{vestibular:{}, neuro:{}, discriminators:{negative:true}}`.
  - redFlags: the 7 written or read by probes (`rf_pulsatile`, `rf_asym`, `rf_ssnhl`, `rf_progressive`, `rf_thunderclap`, `rf_gca`, `rf_mass`; Prb L61-142).
  - phenotypes: `["sinonasal","otologic","both"]`.
  - gapMarkers: `["c_clin","c_dur","c_dismiss"]`.

### 3.9 Upload envelopes and pairing

Every file is classified **before anything runs** (`registry.classifyFiles`): bytes, size against `LIMITS`, UTF-8, SHA-256, then the kind.

| File | Recognised by | Becomes |
|---|---|---|
| `*.json` | parses as JSON with `format:"screenair-rubric"` | A rubric. It binds per `logicBinding`, then goes through `classifyLineage` (§3.11). |
| `*.js` / `*.mjs` whose SHA-256 equals a loaded built-in's `logicSha256` | the hash alone | **That built-in's logic, already loaded.** The file is not executed, needs no consent and is accepted even with `SITE.ALLOW_JS_UPLOAD === false`. This is what makes a downloaded zip of an edited MASQUE module re-uploadable on a JSON-only site. |
| `*.js` / `*.mjs`, any other | `inspectSource` (parse only, nothing runs, §6.1) reads the literal `format` of the `export default` object: `"screenair-logic"` → logic file; `"screenair-module"` → self-contained module; not a literal → "executable (kind determined after consent)". After consent, `importSource` confirms the kind from `default.format`. | A **logic file** needs a rubric with the same `moduleId` **in the same upload** (multi-select); a logic file on its own is refused, because code is never attached implicitly to a loaded rubric. A **self-contained module** is `default = {format, contractVersion, rubric, logic}`; `rubric` must still be JSON-serialisable (V4), and Download writes it out as `<id>.rubric.json` + `<id>.logic.js`. A logic whose `moduleId` equals a built-in logic's is refused unless byte-identical: "Logic id '{moduleId}' is reserved for the built-in logic" (V8). |
| `*.zip` | `unzip` → `manifest.json` with `format:"screenair-export"` | Each listed module goes through the rows above. Modules byte-identical to loaded ones are skipped ("already loaded"). |
| `*.csv`, `*.tsv`, `*.xls`, `*.xlsx`, `*.ods`, `*.doc`, `*.docx`, `*.pdf` | the extension | Refused with "Spreadsheets and documents are not supported. Download the current module's rubric (.json) and edit its weights, or use the Rubric Editor." |
| anything else | — | "Not a screenAIr file". |

**Binding a rubric:**

1. `logicBinding:"generic"` binds `GENERIC_LOGIC`.
2. `{moduleId, logicSha256?}` looks for, in order: a logic file in the same upload with that `moduleId` (and that SHA, if given); then a *loaded* logic with that `moduleId` and SHA; then, with no SHA given, the built-in logic with that `moduleId`. If none is found: error **"needs the logic file for '<moduleId>'"**.
3. A SHA mismatch against an otherwise matching loaded logic is shown as a **warning** in the upload dialog ("this rubric was created against logic <sha8>, binding to <sha8>"). It is recorded in `meta`, and `reads` validation still guards structural compatibility. (A verified derivation never mismatches: its binding must equal its root's, §3.11.)

**Rubric files are always complete data layers, never patches.**

### 3.10 Identity and hashes

**Hashes.** `hash.js rubricHashes(rubric)` (WP0) is the only implementation: WP1's extractor calls it to store `research.calibration.appliesTo.scoringHash`, and WP3's binder calls it on every load. Each hash is SHA-256 hex over `canonicalJson` (object keys sorted, array order kept, `JSON.stringify` scalars) of a projection built by `hashProjections`. A projection copies each listed key only when its value is not `undefined` and never defaults one, with a single exception: `negative` is always emitted as the boolean `d.negative === true`. The `values` suite asserts `calibrationGate(masque) === true`, so the stored and computed `scoringHash` cannot drift apart.

| Hash | Projection | Used for |
|---|---|---|
| `instrumentHash` | `domains[{key,label,max,negative,items:[{id,w,text,ref,scale:[{label,f}]}]}]`, `bands.cuts`, `redFlags[{id,tier,group,text,points}]`, `fhir.{questionnaireName,questionnaireTitle,publisher,description,safetyGroupText}` | "Is this the same published instrument?" Everything `buildQuestionnaire` and `computeScore` read, minus the rendered identity. |
| `scoringHash` | `domains[{key,max,negative,items:[{id,w,scale:[f…]}]}]`, `bands.cuts` | Calibration applicability; the "scores not comparable with the root" statement |
| `lexiconHash` | `lexicon` minus `version`, `lang` and `goldSet` (`null` without a lexicon) | Lexicon axis rule |
| `contentHash` | the whole rubric minus `provenance` | Detects a derived rubric changed after Apply (§3.11) |
| `rubricSha256` / `logicSha256` | source bytes | Ancestor records, dedupe, zip manifest, recognising built-in logic (§3.9) |

**Identity rules** (errors unless marked; V8, V9):

- Built-in module ids are **reserved**. A non-built-in whose `id` equals a built-in id is deduplicated to the built-in when byte-identical (rubric and logic SHA); otherwise it is never loaded under that id and is offered as a derived module instead (§3.11).
- A non-built-in id may not start with `<built-in id>-`, so no other module's `screen_id` prefix or index code begins with `masque-`. Built-in logic ids are reserved the same way (§3.9).
- Module ids are unique among loaded modules.
- A non-built-in **label** may not equal a built-in label (trimmed, case-insensitive). A label equal to another loaded module's is a warning. `document.title`, `ModuleInfo` and the patient footer add the origin for every non-built-in (§5.1).
- Every `IDENTITY_TEMPLATE_FIELDS` value contains `{id}`, and `questionnaireUrl` also contains `{instrument}` (V9). The list covers the Questionnaire URL, the code, answer and criteria systems, the weight extension, the index code, the `screen_id` and file prefixes, the CDS service id, both card uuids and `cds.source.url`. A new id therefore yields new identifiers **and** a new code-system namespace: a derived module never mints `domain-*`, `rf_*` or index codes inside `http://masque.example/codes`.
- **Generated artifacts say what they are.** For every non-built-in module, `buildQuestionnaire` appends the provenance marker to `title` and `publisher` and the provenance line to `description`, and a verified derivation also gets `derivedFrom: ["<root Questionnaire URL>|<root version>"]`. `buildCdsHooks` does the same for the service `title` and `description` and every example card's `source.label`. `buildDataDictionary` gains a `provenance` object, the bundle Observation gains the provenance note, the Scribe note opens with the provenance line, and cohort rows carry `module_id` (§4.7, §4.8, §4.11). The Screener's spec downloads and the zip's `generated/` files therefore all carry it.
- **Calibration gate:** the panel computes calibration-dependent figures only when `research.calibration.appliesTo.scoringHash === module.hashes.scoringHash`. Otherwise it withholds every one of them and names the reason (§5.6).

### 3.11 Lineage, verification and derived modules (`engine/lineage.js` WP3, `engine/derive.js` WP11)

**Lineage.** Apply records the whole ancestry (§3.2 `Provenance`): `root` is the first module of the lineage, `derivedFrom` the immediate parent, and `lineage` every ancestor in order. All three are `AncestorRecord`s with versions and hashes, and they are copied forward on every derivation, so a third-generation module still names MASQUE 0.2 as its root. `contentHash` seals the rubric as it was at Apply.

**Family.** A module's family is its root record, every record in its lineage, every loaded module whose root has the same `moduleId`, and the root module itself when it is loaded. Module ids are unique among loaded modules and built-in ids are reserved, so the root's id identifies the family.

**Family version rule (V53).** It applies to every module that has a root, and to the "Load as derived" draft of a kin upload:

1. Within a family, instrument version and `instrumentHash` determine each other. Two members with the same `instrumentVersion` must have the same `instrumentHash`, and two members with the same `instrumentHash` must have the same version. An edit that restores the root's exact instrument therefore takes the root's version back, and a second-generation module can never claim "0.2" while its instrument differs from 0.2.
2. A module whose `instrumentHash` differs from its root's must have a version containing the pre-release tag `-local` (V6 allows it after any version, including a pre-release one such as `0.3-rc.1-local.3f9a1c`). No built-in version contains `-local`, so the tag marks every locally changed instrument, and a derived instrument never prints as a plain or official-looking MASQUE number such as "0.2", "0.3" or "0.3-rc.2".
3. The same two rules hold for `lexicon.version` and `lexiconHash`, with "no lexicon" counting as one value. `lexicon.goldSet` must equal the root's.

The defaults always satisfy the rule: `${root.instrumentVersion}-local.${instrumentHash6}` (e.g. "0.2-local.3f9a1c") and `${root.lexiconVersion}-local.${lexiconHash6}`, or `0.1-local.${lexiconHash6}` for a lexicon created where the root had none. A version cannot move without an instrument change (VERSIONS.md).

**Classification on load** (`classifyLineage`). Built-ins listed in `registry.json` are `builtin`. Every other rubric — uploaded, inside a zip, or restored from this browser (§5.2) — is classified before validation. The first matching row wins:

| # | Condition | Result |
|---|---|---|
| 1 | Byte-identical to a loaded module (rubric and logic SHA). | Skipped: "already loaded". |
| 2 | `id` equals a built-in id B (bytes differ). | **Load as derived** from B (below). |
| 3 | `provenance.root` names a loaded built-in B, and every check passes: the root record's `moduleId`, versions, `instrumentHash`, `scoringHash`, `lexiconHash` and `logicSha256` equal B's current values (a changed built-in `rubricSha256` alone is reported in `ModuleInfo`, not refused); `logicBinding` names B's logic `moduleId` with B's loaded `logicSha256` (or both are generic); `contentHash` equals the recomputed hash; the lineage is well formed (V52). | **Verified derivation**: origin `derived`, badge "Edited module". V52-V55 run against B, and population estimates are allowed under the banner (§5.6). Intermediate ancestors need not be loaded and grant nothing. |
| 4 | `provenance.root` names a loaded built-in B, and any check in row 3 fails (for example a weight changed by hand after download, or a root record copied from somewhere else). | **Load as derived** from B. The dialog names the failed check. |
| 5 | Not matched above, and the file is **kin** to a loaded built-in B (`kinOf`), with or without a `provenance` block: it binds B's logic `moduleId`, or reuses one of B's `KIN_FIELDS` values (`name`, `fhir.questionnaireName`, `fhir.questionnaireTitle`, `fhir.publisher`, `cds.title`, `cds.source.label`). | **Load as derived** from B. This is the hand-edited `masque.rubric.json` with only the id changed, and any file whose claimed root is not loaded but which still carries B's logic or identity. |
| 6 | `provenance.root` names a non-built-in R that is loaded or in the same upload with the recorded `rubricSha256`, and `contentHash` and V52 pass. | Origin `derived` from an uploaded module: both provenance lines show, V52-V55 run against R, and no population estimates. If `contentHash` fails, **Load as derived** from R. |
| 7 | Anything else. | Origin `uploaded`, badge "Uploaded module". V52-V55 do not apply, and `research.population` is refused (V37). A `provenance` block whose root is unknown is kept as information only ("claims derivation from <label>; not verified"); it grants nothing, and V53 still checks the recorded lineage. |

**Load as derived** is never automatic. The upload dialog says why the file cannot load as is and offers **Load as a module derived from <label>**. That runs `classifyChanges(root, file)` and the Apply dialog of §5.7 (new id, label, required change note, versions per the family rule, every acknowledgement). Then `deriveRubric(root, file, …)` records `provenance.source = {name, sha256}`, and the result is a verified derivation. Hand-editing a download is therefore a supported path that cannot launder a changed instrument into "0.2".

**Integrity, not authentication.** Every check here is a hash comparison against modules the browser has actually loaded; nothing is signed. Someone who forges a self-consistent provenance block can obtain at most the "Edited" badge and the root's own population estimates under the banner that says they were not recomputed. They cannot obtain a built-in id, label or identifier namespace, a plain root version number for a different instrument, or a calibration for different scoring (§7.4).

**Derived module** (`deriveRubric`, Apply in the editor or Load as derived):

- `id` ≠ every loaded id. The default is `local-${root.id}-${hex6}`, where `hex6` is the first six hex digits of SHA-256 over `canonicalJson` of the draft without `id`, `label`, `provenance` and `changelog`; a collision appends `-2`, `-3` and so on.
- `label` defaults to `${root.label} — edited ${YYYY-MM-DD}` (with ` (2)` and so on on a collision) and may not equal a built-in label.
- `instrumentVersion` and `lexicon.version` follow the family version rule.
- Every locale whose patient wording was edited gets `reviewed:false` and `editedLocally:true`. Editing an English string adds the matching path to every other locale's `stale[]` and sets that locale `reviewed:false`, because a translation of the old English is no longer the reviewed text.
- `research.calibration` and `research.population` are copied unchanged, so the calibration gate fires when the scoring changed, and V54 can require both to equal the root's.
- When `scoringHash` differs from the root's, `cds.examples.settled` is removed (its "78/100 — high likelihood" was written for 0.2 scoring) and the removal is logged.
- `provenance = {root, derivedFrom: parent record, lineage: [...parent's lineage, parent record], contentHash, createdAt, source?}`. `root` is copied from the parent, or is the parent's own record when the parent has no root.
- One `changelog` entry is appended: `{date, kind:"derived", note (required), author?, paths (JSON pointers changed), axes:{instrument:[from,to]?, lexicon:[from,to]?}, acknowledged?}`.
- `logicBinding` = `{moduleId: <root logic's moduleId>, logicSha256: <root's loaded logicSha256>}`, or `"generic"` for a generic root. Logic is read-only in v1, so every generation runs its root's logic, pinned by hash.

**Provenance display.** Two sets of engine-owned wording, both English-only until translated (Q16):

- **Clinician surfaces** (the caveat strip on clinician tabs, `ProvenanceBadge`, `ModuleInfo`, the Screener and Scribe readouts, generated artifacts, the zip README): `CAVEATS.uploaded` or `CAVEATS.edited` (both for a derivation from an upload), plus `CAVEATS.scoringChanged` with `{root}` and `{rootVersion}` when `scoringHash` differs from the **root's**. A third-generation module whose scoring differs from MASQUE 0.2 keeps the label even if its parent had the same scoring.
- **Patient-facing surfaces** (the caveat strip while the Patient tab or patient mode is shown, the Patient print header, the `.txt` and `.html` exports): `CAVEATS.patient.edited` or `CAVEATS.patient.uploaded`, plus `CAVEATS.editedWording` for an edited locale and `CAVEATS.staleTranslation` for a locale with `stale[]`. None names a score, band or probability. `projectForPatient` carries only this set (§4.12), V60 checks module data, and the `omissions` suite checks the rendered result.

---

## 4. Engine API

### 4.1 Conventions (every engine file)

- Pure ES module with no React and no import-time side effects. Only relative `./x.js` imports to other engine files (layering suite, §8.3).
- `module` is always a **bound, frozen** `Module` (§3.4). Functions never mutate their inputs.
- No string literal names a module id, item, flag, context id, phenotype value, `masque`, `MASQUE`, `masque.example` or the dropdown label, comments included (t-ids). Clinical rationale comments move to `app/modules/masque/README.md`.
- Anything that runs module closures returns `{…, error}` or takes `{onError}`. It never throws to React (D6).
- Anything time- or randomness-dependent takes `now`, `date` or `nonce` parameters whose defaults are `new Date()` and `Math.random()`, so goldens are deterministic.

### 4.2 `contract.js`, `vocab.js`, `policy.js` (WP0)

```js
// contract.js
export const CONTRACT_VERSION = 1;
export const FORMAT = { rubric:"screenair-rubric", logic:"screenair-logic", module:"screenair-module",
                        export:"screenair-export", registry:"screenair-registry" };
export const SUPPORTED_LOCALES = ["en", "es"];                 // contract 1; adding one = PATIENT_CHROME + CAVEATS entries
export const LOGIC_PATHS = [ /* §3.1, as glob strings */ ];
export const IDENTITY_TEMPLATE_FIELDS = ["fhir.questionnaireUrl","fhir.codeSystem","fhir.answerSystem","fhir.criteriaSystem",
                                         "fhir.weightExtension","fhir.indexCode","fhir.screenIdPrefix","fhir.filePrefix",
                                         "cds.serviceId","cds.safetyCardUuid","cds.indexCardUuid","cds.source.url"];   // V9
export const KIN_FIELDS = ["name","fhir.questionnaireName","fhir.questionnaireTitle","fhir.publisher","cds.title","cds.source.label"];  // §3.11 row 5
export const RUBRIC_KEYS = { required:[…], optional:[…] };     // V3
export const COPY_SLOTS = { "screener.title":["name"], "cds.preview.indexBody":["total","scaleMax","bandLabel"], … };  // V39
/* JSDoc typedefs: Rubric, Logic, Reads, RoutingRule, SummaryRule, Probe, Module, PatientView, ScreenSnapshot,
   RoutingState, PhenotypeState, ActivationState, PatientState, ValidationReport, RegistryEntry, Provenance,
   AncestorRecord, Classification, Availability, Env, SessionApi (all as §3, §4, §5, §6.4). */

// vocab.js
export const BANDS = ["low","moderate","high"], LOWEST_BAND = "low", HIGHEST_BAND = "high", INDETERMINATE = "indeterminate";
export const BAND_INTERP = { low:"L", moderate:"N", high:"H" };                 // Scr L1450, Scb L1398
export const TIERS = ["emergent","urgent"], TIER_RANK = { emergent:0, urgent:1 };
export const ANSWER = { YES:"yes", NO:"no", UNSURE:"unsure" };
export const CAPTURE_KIND = { ITEM:"item", CTX:"ctx", REDFLAG:"redflag" };
export const PROBE_KIND = /* Prb L47-54 verbatim + */ { /* caption (Scb L1160-1162), truncate:false for safety & rescue, mayWrite:false for phenotype */ };
export const PROBE_KIND_ORDER = ["safety","rescue","criteria","ruleout","phenotype","exam"];   // Scb L1152
export const STEP_KIND = { SAFETY:"safety", DOMAIN:"domain", STORY:"story", RESULT:"result" };
export function isAnswered(v) { return v !== undefined && v !== "unsure"; }
export function normalizeAnswer(v) { return v === "unsure" ? undefined : v; }

// policy.js — shell/site policy; nothing here is module-overridable
export const APP_VERSION = "0.4.0";                                              // release axis (D21, Q2)
export const SITE = { REQUIRE_SAFETY_REVIEW_TO_SIGN: true, SITE_SALT: "CHANGE-ME-PER-SITE",
                      SALT_IS_DEFAULT: true, ALLOW_JS_UPLOAD: true };            // Scb L171; Scr L66-67; Q20
export const CAVEATS = {
  prototype: "Prototype · not for clinical use",
  illustrative: "illustrative—replace after validation",                         // RRP manifest literal
  unreviewed: { es: { title: "Traducción sin revisar", body: /* Pat L411 verbatim */, txt: /* Pat L421 verbatim */ } },
  // clinician surfaces (§3.11 "Provenance display"); `en` is the provenance line, `short` the marker appended to titles
  uploaded: { en: "Uploaded module — not reviewed. It runs in this page exactly as written in the file.",
              short: "uploaded, not reviewed" },
  edited:   { en: "Edited module — derived locally and not reviewed.", short: "derived locally, not reviewed" },
  scoringChanged: { en: "Scoring differs from {root} instrument {rootVersion}; scores are not comparable with it." },
  // patient-facing surfaces: never a score, band or probability word (V60, `omissions`)
  patient: {
    edited:   { en: "This version of the questionnaire was changed locally and has not been reviewed.",
                short: "changed locally, not reviewed" },
    uploaded: { en: "This questionnaire was loaded from a file and has not been reviewed.",
                short: "loaded from a file, not reviewed" },
  },
  editedWording: { en: "Wording in this language was edited locally and has not been reviewed." },
  staleTranslation: { en: "The English wording was changed locally; this translation has not been updated to match it." },
};
export const OMISSION_PATTERNS = [/\bscor(?:e|es|ed|ing)\b/i, /likelihood/i, /probabil/i, /\b\d{1,3}\s*\/\s*\d{2,3}\b/,
                                  /\bpuntuaci[oó]n|\bpuntaje\b/i];   // V60 and the omissions suite; es forms included
export const LIMITS = { rubricBytes: 2_000_000, logicBytes: 512_000, zipBytes: 20_000_000, uploadFiles: 20 };
export const LOCALE_NAMES = { en: "English", es: "Español" };                    // Pat L295
```

### 4.3 `hash.js`, `css.js`, `download.js`, `prng.js` (WP0)

```js
sha256Hex(input: string|ArrayBuffer|Uint8Array) → Promise<string>   // crypto.subtle when isSecureContext, else sha256HexSync
sha256HexSync(bytes: Uint8Array) → string                           // pure-JS FIPS 180-4; cross-checked against crypto.subtle in the tests
canonicalJson(value) → string                                       // sorted object keys, array order kept, no whitespace
utf8Bytes(str) → Uint8Array;  djb2(str) → string
hashProjections = { instrument(rubric), scoring(rubric), lexicon(rubric), content(rubric) }   // §3.10 table; plain objects;
   // a listed key is copied only when !== undefined and never defaulted, except `negative` (always `=== true`)
rubricHashes(rubric) → Promise<{instrumentHash, scoringHash, lexiconHash, contentHash}>
   // the ONLY implementation: WP1's extractor and WP3's bindModule/validateModule/deriveRubric all import it from here
scopeCss(css, rootSelector) → string
   // every selector in every comma list becomes `${root} sel`; `:root` and `html`/`body` become `${root}`;
   // `*` becomes `${root} *`; recurses into @media/@supports; leaves @keyframes/@font-face/@page bodies alone;
   // keeps comments; deterministic (same input, same bytes)
downloadText(name, text, type = "text/plain"); downloadJsonFile(name, obj); downloadBytes(name, bytes, type)
fhirHtml(obj)                                                       // Scr L813-820 verbatim (escapes & and <)
mulberry32(seed) → () => number;  pick(rng, xs)
```

### 4.4 `scoring.js` (WP3) — Scr L321-408, arithmetic verbatim

```js
scoreItem(item, val)                       // Scr L321-327
itemBounds(item)                           // Scr L360-367
bandFor(cuts, v)                           // Scr L336-340 with cuts injected → "low"|"moderate"|"high"
scaleMaxOf(module) / negativeMinOf(module) // Σ max over positive / negative domains (100 / −29 for MASQUE)
computeScore(module, answers) → Score      // Scr L369-408 without useMemo; DOMAIN_ORDER→module.domainOrder; clamp 100 → module.scaleMax;
                                           // answers pass through normalizeAnswer ('unsure' → unanswered)
   // Score = {domains:{[k]:{pts,max,pct,label,openPts,negative}}, total, floor, ceiling, coverage, scorable,
   //          answered, count, band, open:[{...item, domain, domainLabel}]}   — keys and stable sort identical to Scr useScore
bandRangeText(module) → {low:"< 34", moderate:"34–66", high:"≥ 67"}   // byte-identical to Scr L528 for MASQUE
meterZones(module) → [{band:"low",w:34},{band:"moderate",w:33},{band:"high",w:33}]   // AD7
meterTicks(module) → [0, 34, 67, 100]
negativeValueOf(item) → "no" | number      // boolean → "no"; scale → index of the first option with f === 0 (V13 guarantees one);
                                           // the "negative answer" of V46's rescue property
```

Apps call `useMemo(() => computeScore(module, answers), [module, answers])`. The engine stays React-free.

### 4.5 `evaluate.js` and `rules.js` (WP3)

```js
// evaluate.js — imports nothing
evaluateRules(rules, state, { mode = "all", surface = null } = {}) → { fired: Rule[], error: null | {ruleId, message} }
   // array order; fires when `when` is absent or truthy; with `surface`, skips rules lacking copy[surface];
   // fallback rules fire only when no other rule on that surface fired; the FIRST throw stops evaluation and returns
   // {fired: [], error} — callers must never use a partial list (D6); mode "first" returns at the first firing rule
renderTpl(tpl, state, vars) → string | string[]   // string: {placeholder} substitution from vars; function: tpl(state)

// rules.js
buildRoutingState(module, {surface, answers, ctx, complaint, phenotypeError = null, score, activeFlags, safetyReviewed})
   → RoutingState                                                                                // §3.3, frozen
routingRecs(module, state) → { recs: Rec[], gate: null|"override"|"incomplete"|"uncleared"|"error", error: RoutingError|null }
   // Rec = {id, h, p, chips}. Order is engine-fixed (Scr L891-952 ≡ Scb L930 + L1324-1335):
   //  1 state.override        → screener [withheld card §3.6]; scribe []                            gate "override"
   //  2 !state.scorable       → screener [incomplete card §3.6]; scribe []                          gate "incomplete"
   //  3 scribe && !routingCleared → []                                                              gate "uncleared"
   //  4 state.phenotypeError  → [rule-error card naming the derive rule] on both surfaces           gate "error"
   //  5 evaluateRules(logic.routing, state, {surface}); error → [rule-error card] on both surfaces   gate "error"
   //  6 nothing fired, no fallback on this surface: screener and logic.routing empty → [engine generic fallback]; else []
   // `error` (= the RoutingError every consumer below takes as `routingError`) is state.phenotypeError whatever the gate,
   // otherwise the rule error of step 5. RoutingError = {family: "routing"|"phenotype", ruleId, message}.
buildPhenotypeState(module, answers) → PhenotypeState
derivePhenotype(module, answers) → { value, error }
   // first matching derive rule; none → phenotypes.scribeDefault; no phenotypes → "". On a throw: {value: "", error};
   // the caller passes `error` on as phenotypeError and uses activeDomains' all-domains fallback (§3.3)
activeDomains(module, {answers, complaint, phenotypeError = null}) → { domains: Set<string>, error }
   // alwaysActive ∪ fired activation rules; an activation error or a phenotypeError → all domains
gapSignals(module, ctx) → { hits:[{id, value, screenerLabel, scribeLabel, noteLabel}], count, alert, flags: boolean[], noteLabels: string[] }
   // hits in contextItems order (Scr L873-877); flags in gapRule.markers order (Pat L957); noteLabels in gapRule.noteOrder (Scb L1345-1349)
referralFor(module, complaint, {routingError = null} = {}) → {specialty, reason} | null
   // null when routingError is set or without phenotypes.referral; otherwise byPhenotype[complaint] ?? default
cdsPreview(module, state, {routingError = null} = {}) → { safety: {src, title, body} | null, index: {src, title, body} | null }
   // safety when override (Scr L1330-1338), whatever routingError says; index when !override && !routingError && scorable &&
   // band !== LOWEST_BAND && cds.preview && cdsTerm resolves (Scr L1339-1349): title = renderTpl(indexTitle, {cdsTerm}),
   // body = renderTpl(indexBody, {total, scaleMax, bandLabel})
```

### 4.6 `gates.js` (WP3) — engine-owned; there is no module switch for any of them

```js
safetyGate({safetyReviewed, activeFlags}) → safetyReviewed || activeFlags.length > 0          // Scr L886, Pat L656
routingGate({override, safetyReviewed}) → !override && safetyReviewed                         // Scb L928
signGate({safetyReviewed}) → !SITE.REQUIRE_SAFETY_REVIEW_TO_SIGN || safetyReviewed            // Scb L1226
coverageGate(score) → score.scorable                                                           // Scr L400
referralGate({surface, override, routingCleared, score, routingError = null}) →
  (surface === "screener" ? !override : routingCleared) && score.scorable && score.band !== LOWEST_BAND   // Scr L1455, Scb L1400
  && !routingError                                                                               // D6: no referral from a failed rule set
calibrationGate(module) → !!module.research &&
  module.research.calibration?.appliesTo?.scoringHash === module.hashes.scoringHash            // D8
```

### 4.7 `fhir.js` (WP4)

```js
buildQuestionnaire(module, {date = todayIso()}) → Questionnaire
   // Scr L424-472 with rendered fhir.* (systems included) and module domains/flags; keeps the `initialSelected:false` no-op
   // (byte parity). Non-built-in (§3.10): title and publisher + " · " + provenance marker, description + "\n\n" + provenance
   // line; a verified derivation adds derivedFrom: ["<root questionnaireUrl>|<root instrumentVersion>"]
buildCdsHooks(module) → {discovery, exampleResponses}
   // Scr L474-519 generated: prefetch `${codeSystem}|${indexCode}`; redFlagPresent built from examples.redFlagPresent.flagId's
   // action + the engine sentence; settledNonLowBand from examples.settled (omitted if absent); notScorable {cards: []} always.
   // Non-built-in: service title/description and every example card's source.label carry the provenance marker/line
buildDataDictionary(module, {appVersion}) → Dictionary
   // Scr L521-558: positiveMax = scaleMax; discriminatorMin = negativeMin; bands = bandRangeText; the score field's type
   // `number 0–${scaleMax}` (byte-identical for MASQUE; coverage stays "number 0–100", a percentage); "MASQUE index at time
   // of capture" → `${indexName} at time of capture`; canonicalCohortFields + module_id (first) + complaint (before coverage)
   // (AD3). Non-built-in: a top-level `provenance: {origin, line, root, derivedFrom, contentHash}`
buildBundle(module, screen, {surface, now = new Date().toISOString()}) → Bundle
   // screen = {patient, answers, score, complaint, activeFlags, emergent, routingCleared, routingError}
   // routingError set: no referral ServiceRequest (referralGate) and the Observation gains the engine note "Screening routing
   // withheld: module rule … failed, so no referral was issued." (§3.6); the red-flag Flag and ServiceRequest are unaffected
   // Base: Scb L1396-1458. Surface switches, all verbatim from the baseline (D7):
   //   screener: referralGate surface "screener"; routing-override component when override (Scr L1516-1521, before
   //             attainable-range); unscorable note "Index is bounded to {floor}–{ceiling}/{scaleMax}, which spans more than
   //             one band." (Scr L1549 text, floor fix AD1); referral reasonCode "… ({band} likelihood); …"; no DocumentReference
   //   scribe:   referralGate surface "scribe"; no routing-override component; note "Index bounded to {floor}–{ceiling}/{scaleMax},
   //             spanning more than one band."; reasonCode "… ({band}); …"; DocumentReference (fhir.documentType/Title)
   // attainable-range low = floor on both surfaces (AD1). Referral code text `Referral: ${specialty} — evaluate for ${reason}`
   // from referralFor (omitted when null). Non-built-in module: the Observation gains note {text: provenance line}.
```

### 4.8 `cohort.js` (WP4)

```js
CANONICAL_FIELDS = ["screen_id","captured_at","instrument_version","app_version","module_id","score","label",
  "reference_diagnosis","subject_id","visit_label","sex","gender","age","weight","annual_cost","avoidable_cost",
  "complaint","coverage","scorable","band","red_flags"]          // Inv §4.3 + module_id (AD2); nothing renamed or dropped
subjectPseudonym(mrn, salt = SITE.SITE_SALT)                     // Scr L69-79
screenToCohortRow(module, screen, {appVersion, salt, now = Date.now(), nonce}) → Row
   // Scr L572-604 (with ctx fix): screen_id `${fhir.screenIdPrefix}${now.toString(36)}-${nonce ?? random5}`;
   // visit_label screen.visitLabel ?? ""; unanswered → ""; boolean → 1/0; scale → index; item columns in module order
rowsToCsv(rows)                                                  // Scr L608-616
cohortColumnsCsv(module) → string                                // header only: CANONICAL_FIELDS + item ids (zip "generated/")
makeCohort(spec) → Row[]                                         // Sim L285-305: the same LCG (Math.imul), the same draw order,
                                                                 // driven by CohortSpec; extraRows appended verbatim
```

### 4.9 `extraction.js` (WP5) — Ext L172-300 with the lexicon injected; no branch on any id

```js
EXTRACTOR_KIND                                                   // Ext L25
createExtractor(lexicon) → { extract(text, opts), negatedNear(text, idx, window), lexiconVersion }
extract(lexicon, text, {negationWindow, includeSuppressed} = {}) → Array<{id, value, kind, evidence, cueIndex, suppressedBy?}>
   // Ext L217-268 exactly: red-flag pass ungated with no negation; BOOL via allHits; CTX/SCALE/MULTI via firstHit;
   // third-party then historical gating; thirdPartyExempt honoured; band order significant
firstHit, allHits, cueBefore, faersToUtterances                  // verbatim (cueBefore newly exported)
```

### 4.10 `probes.js` (WP5) — Prb L301-345 with the list injected

```js
liveProbes(probes, answers = {}, redFlags = {}, answered = {}, {onError} = {}) → Probe[]
   // Prb L301-307; additionally never retires kind "rescue" through `target`; a throwing `when` keeps the probe in the list
   // and calls onError(id, err) (§3.3). The engine cannot make a rescue's own `when` stay true on a negative target; that is
   // what V46's rescue property checks for every module (§4.14), using scoring.js negativeValueOf
validateProbes(probes, itemIds, flagIds) → string[]
   // Prb L322-345 + rescue must carry `rescues` and no `target`; `rescues` only on kind rescue;
   // PROBE_KIND[kind].mayWrite === false with any option `a` → error; membership checks never skipped; no console output
truncateProbes(live) → Array<{kind, shown: Probe[], total}>      // PROBE_KIND_ORDER; truncate kinds sliced to 2 (Scb L1152-1162)
```

### 4.11 `scribe.js` (WP5)

```js
ingestCaptures({answers, ctx, rf}, captures) → {answers, ctx, rf, touchedDomainItemIds}
   // Scb L772-784: item first-write-wins; ctx overwrite; redflag → "nlp" and never downgrades "md"/"probe"; raise-only
rankSuggestions(module, {answers, complaint, phenotypeError, vmp, scorable, skipped}) → { list: Suggestion[], error }
   // Scb L856-879 verbatim: pool = unanswered && !skipped && (scorable || active domain); rank active → tag boost → w;
   // active domains from activeDomains (all domains on a phenotype or activation error, §3.3);
   // top infoPrompts.maxScored (4); info prompts while gateDomain active, up to maxTotal (6)
   // Suggestion = {id, ask: item.ask ?? item.text, tag: item.tag || domain.shortTag || domain.label.toLowerCase(), scale?, kind}
itemShort(item) → item.short ?? item.id
captureLabel(module, capture) → string
   // Scb L1299-1308 by capture.kind: redflag → "RED FLAG: " + (flag.points || id); ctx → contextItem.captureLabel || id;
   // item → scale ? `${short}: ${scale label}` : (value === "no" ? "no " : "") + short
buildNote(module, input) → string
   // Scb L1337-1393 skeleton verbatim with copy.note.* slots, itemShort, infoPrompts.tagPrefix strip, gapSignals.noteLabels,
   // `/{scaleMax}`, patient.sex?.[0] ?? "" guard; a provenance line first for non-built-in modules.
   // A&P order: red flags → safety review not recorded → not scorable → **routingError: the engine A&P error line (§3.6)
   // instead of any rec or copy.note.noDriver** → recs → noDriver.
   // input = {patient, answers, ctx, vmp, score, complaint, recs, routingError, gapAlert, activeFlags, safetyReviewed,
   //          emergent, probeNotes}
```

### 4.12 `patient.js` (WP6) — never imports `scoring`, `fhir`, `rules`, `cohort`, `probes`, `extraction` or `scribe`

```js
PATIENT_CHROME = { en: {…}, es: {…} }       // §3.7, verbatim
TIER_DISPLAY = { emergent:{key:"now", color:"var(--coral)", bg:"var(--coralbg)"},
                 urgent:{key:"soon", color:"var(--amber)", bg:"var(--amberbg)"} }   // Pat L263-272
GRAMMAR = { en:{and:"and", oxford:true, ask:"en-regex"}, es:{and:"y", oxford:false, ask:"period-to-question"} }   // Pat L981-994
projectForPatient(module) → PatientView     // frozen; the ONLY object PatientCompanion receives (D15)
   // {id, name, label, instrumentVersion, origin, provenanceLines, available,
   //  domains:[{key, negative, items:[{id, w, scaleLen, patientClin}]}], steps: module.steps.patient,
   //  contextItems:[{id, signalValue}], gapRule, redFlags:[{id, tier}],
   //  locales:{[loc]:{reviewed, editedLocally, stale: boolean, data:{items, redFlags, contextItems, steps, ui}, sum}},
   //  summaryLogic: logic.patientSummary | "generic"}
   // provenanceLines = the PATIENT set only (CAVEATS.patient.*, §3.11): never CAVEATS.scoringChanged or any clinician line
   // NO flag text/points/action, item text (beyond patientClin), fhir, cds, research, routing, probes, lexicon or copy
localeText(view, loc, path) → string        // loc value ?? en value (fallback recorded in view.locales[loc].fallbacks)
flagCopy(view, loc) → Array<{id, tier, q, say}>
buildPatientSummary(view, loc, {a, ctx, flags, urgent}) → { summary: Summary|null, error }
   // Pat L902-975: said/ask via evaluateRules over PatientState (or GENERIC_SUMMARY); gapLine = gap.count >= threshold
   // ? S.gap(...flags in markers order) : null; unsureList in module item order (= P key order, verified);
   // clin = Pat L962-972 with patientClin; Summary = {said, ask, gapLine, unsureList, clin, flags, urgent, ctx, loc}
askForm(view, loc, id); joinList(loc, xs)   // Pat L981-994
summaryText(view, loc, summary, {appVersion, generatedAt}) → string
   // Pat L1096-1125 verbatim, footer `${name} v${appVersion} — ${txtFooter}`; THEN (AD10) a final line
   // `${CAVEATS.prototype} · ${generatedAt as YYYY-MM-DD}`, plus each patient provenance line for a non-built-in module,
   // plus CAVEATS.editedWording.en when the locale was edited, plus CAVEATS.staleTranslation.en when it is stale
summaryHtml(view, loc, summary, {appVersion, generatedAt}) → string    // §5.5
richText(str) → Array<string | {b: string}>  // "**x**" → {b:"x"}; nothing else is markup
```

### 4.13 `bind.js` and `generic.js` (WP3)

```js
bindModule(rubric, logic | null, meta) → Promise<Module>          // §3.4; hashes from hash.js rubricHashes (§3.10)
renderIdentity(rubric) → {fhir, cds}                              // {id}/{instrument} substitution
parseRubricText(text) → {rubric, warnings}                        // strips a leading U+FEFF with a warning
serializeRubric(rubric) → string                                  // JSON.stringify(rubric, null, 2) + "\n" (key order preserved)
deepFreeze(obj) → obj
// generic.js
GENERIC_LOGIC, ENGINE_COPY_DEFAULTS, DEFAULT_FHIR, DEFAULT_DEMO_PATIENT, defaultScreenerSteps(rubric), defaultPatientSteps(rubric)
```

**`Module` (bound).** Every field below is deep-frozen:

- **Identity:** `id`, `label`, `name`, `icon`, `instrumentVersion`, `origin`, `classification` (the `classifyLineage` result, §3.11), `key`.
- **Instrument:** `domains` (array, items inside), `domainOrder`, `allItems`, `itemById`, `scaleMax`, `negativeMin`, `negativeDomainKeys`, `bands {cuts, rangeText, zones, ticks}`.
- **Safety and context:** `contextItems`, `gapRule`, `redFlags`, `redFlagGroups`, `flagById`.
- **Flow:** `steps {screener, patient}`, `phenotypes` (rubric data), `infoPrompts`, `sampleCases`, `demo`, `lexicon`.
- **Text and research:** `locales` (§3.4 step 5), `research`, `fhir` and `cds` (rendered), `copy` (merged).
- **Logic:** `logic` (the frozen logic object or `GENERIC_LOGIC`).
- **Provenance:** `hashes {rubricSha256, logicSha256, instrumentHash, scoringHash, lexiconHash, contentHash}`, `versions {instrument, lexicon, probeSet, goldSet, goldSetLexicon}`, `provenance` (the rubric's block, or `null`; every privilege and label follows `classification`, never this block alone), `changelog`, `docs` (built-ins: the `registry.json` list).
- **Sources:** `rubric` (the original JSON, frozen), `sources {rubricText, logicText}`.

### 4.14 `validate.js` (WP3) — `validateModule({module, loaded = [], root = null, upload = null}) → Promise<ValidationReport>`

`ValidationReport = {ok, errors:[{path, code, msg}], warnings:[{path, code, msg}], info:{hashes, readsObserved, fallbacks, smokeStates}}`. It never throws. Any **E** keeps the module from mounting (the shell shows `InvalidModule`; the upload dialog refuses it) and fails the test page; **W** is shown and passes. `validateRubricShape(rubric)` runs the rubric-only checks among V1-V39 synchronously for the editor's live feedback (V5 and V8 need the logic and the registry, so only `validateModule` runs them). `formatReport` renders the report as a list of path-addressed items. `root` is the loaded root module of a derivation (`module.classification.root`, or the parent's root in the editor's live validation); V52-V55 compare against it, never against the immediate parent alone. Budget: ≤ 300 ms for MASQUE, including smoke evaluation.

The codes below are what the mutation suite targets: one or more mutated fixtures per code must produce that code at the mutated path (§8.3). The codes run V1-V60.

| Group | # | Sev | Assertion | From |
|---|---|---|---|---|
| Shape | V1 | E | `format` and `contractVersion` correct (rubric; logic when bound) | C #1 |
| | V2 | E | `id` slug (not ending in `-`); `name` and `label` non-empty; label ≤ 80 chars | A E1-E2 |
| | V3 | W | unknown top-level key (typo) | C #3 |
| | V4 | E | rubric is pure JSON: no function, `undefined`, NaN, ±Infinity, Symbol, Date or cycle anywhere | new (B #21) |
| | V5 | E | `logic.moduleId === rubric.logicBinding.moduleId`; generic binding has no logic | new |
| | V6 | E | `instrumentVersion`, `lexicon.version`, `probes.version` match `/^\d+(\.\d+)*(-[a-z0-9.-]+)?$/`; no built-in version contains `-local` (the tag that marks derived instruments, §3.11) | C #4 |
| | V7 | W | the label text appears in an identifier field, item id or cohort-facing value | C #44 |
| | V8 | E/W | module id unique among loaded modules; a built-in id may not be reused unless byte-identical, and a non-built-in id may not start with `<built-in id>-`; a logic whose `moduleId` is a built-in logic's must be byte-identical to it; a non-built-in label may not equal a built-in label (trimmed, case-insensitive) (E); a label equal to another loaded module's (W) (§3.10) | new |
| | V9 | E | every `IDENTITY_TEMPLATE_FIELDS` value (the four systems and `cds.source.url` included) contains `{id}`; `questionnaireUrl` also contains `{instrument}` | new (C §2.17) |
| Instrument | V10 | E | ≥ 1 domain; unique keys; each ≥ 1 item | A E5 |
| | V11 | E | single id namespace across items, context items, flags and info prompts; id pattern `/^[a-z][a-z0-9_]*$/` | A E6 |
| | V12 | E/W | item: finite `w ≠ 0`, non-empty `text` (E); `short` missing (W, falls back to the id) | A E7 (relaxed) |
| | V13 | E | scale: ≥ 2 options, non-empty labels, `f ∈ [0,1]`, **at least one option with f === 0** | Inv §4.5, A E8 |
| | V14 | E | a boolean item has no `scale` | A E9 |
| | V15 | E | per domain Σw === max (\|Δ\| < 1e-9); sign consistent with `negative` | A E10-E11 |
| | V16 | E | `scaleMax > 0`; integer cuts with `0 < moderate < high ≤ scaleMax` | A E12, C #14 |
| | V17 | W | `scaleMax ≠ 100` ("the meter, the CDS example and the illustrative calibration were written for 0–100") | A W1 |
| Context | V18 | E | context ids unique; ≥ 2 options; unique values; labels | A E14 |
| | V19 | E | `gapRule.markers` ⊆ context ids, each with `signal.value` among its options; `1 ≤ threshold ≤ markers.length`; `noteOrder` a permutation of markers | A E15 |
| | V20 | E | every patient context option set (any locale) contains the signal value | new (no realignment) |
| Red flags | V21 | E | ≥ 1 flag; unique ids; `tier ∈ TIERS`; `group`, `text`, `points`, `action` non-empty | A E16 |
| | V22 | E | no flag carries `w`, `weight`, `f`, `scale` or `score` | A E17, C #18 |
| | V23 | E/W | `en` patient q/say for every flag when `locales.en.items` exists (E); other locales fall back (W) | Inv §4.5 |
| | V24 | E | no patient q/say (any locale) contains any flag's `points` or `action`, or equals its `text` (case-insensitive) | A E45 |
| Steps | V25 | E | screener steps: first `safety`, last `result`, exactly one of each; every domain in exactly one step; extras ⊆ {complaintPicker, context}; complaintPicker/requires only with phenotypes; context only with contextItems | B #9, C #19-21 |
| | V26 | E | patient steps: kinds ⊆ {story, domain}; every domain exactly once; `context` at most once | B #10 |
| Phenotypes | V27 | E | values unique; `scribeDefault ∈ values`; `alwaysActive` and `tagBoostDomain` ⊆ domains; referral/cdsTerm keys ⊆ values with a `default` | C #22 |
| Lexicon | V28 | E | bool/scale/multi item ids exist (scale ids are scale items, band v and fallback in range); ctx/multi-ctx ids exist with values among the *clinician* options; `redFlags` keys === flag ids both ways, and **every list non-empty**, so no flag is impossible to raise from speech (replaces the Scribe guard `assertRedFlagCues`, Scb L558-561) | A E34-E35 |
| | V29 | E/W | every phrase and cue lowercase and non-empty (E); a phrase < 3 characters (W) | A E36 |
| | V30 | E | negation/thirdParty/historical have integer window > 0 and a non-empty cue array; `goldSet.version` and `goldSet.lexiconVersion` present when `goldSet` is (always for a built-in); `lang` matches `/^[a-z]{2}(-[A-Z]{2})?$/` | A E36 |
| Locales | V31 | E | locale keys ⊆ `SUPPORTED_LOCALES`; `reviewed` boolean; `defaultLocale` "en" | A E38-E40 |
| | V32 | E | when `en.items` exists: every item covered; `opts.length === scale.length`; no opts on boolean items | Pat L198-211 |
| | V33 | W/E | a non-en string falling back to en (W, listed by path); **E** when that locale is `reviewed:true` | new |
| | V34 | E | no locale entry has a `points`, `action` or `differential` key | C #37 |
| Identity, research, copy | V35 | E | fhir systems are absolute URLs; identity templates render to valid strings; Questionnaire strings non-empty | A E29 |
| | V36 | E | `cds.examples.redFlagPresent.flagId` is a flag; `settled.score ∈ [0, scaleMax]` and `bandFor(score) === settled.band` | B #18, C #41 |
| | V37 | E | research: threshold ∈ (0,1); midpoint/slope finite; `appliesTo.scoringHash` 64-hex; tolerance override has all three attribution fields and touches only the three tolerances; `fairnessAxes ⊆ expected`; `population` paths under `./data/` or `./etl/`, and only when the classification is `builtin` or a verified derivation of a built-in (§3.11 row 3); anywhere else: "Population estimates are accepted only for built-in modules and verified derivations of one; remove `research.population`" | C #39-40 |
| | V38 | E | no rubric or logic string contains a `CAVEATS` string ("Prototype · not for clinical use", "not for clinical use", "Traducción sin revisar", the unreviewed body, "illustrative—replace after validation") | A E44, C #43 |
| | V39 | E | copy placeholders ⊆ the slot's allowed set; `**` balanced | new |
| Logic | V40 | E | functions only at `LOGIC_PATHS`; everything else in the logic is plain data | B #21 |
| | V41 | E | `reads` declared; every read item exists with the declared type and **exact** scale length; read domains exist (and `negative` matches when declared); read flags and phenotype values exist; read context values exist; `gapMarkers` deep-equals `gapRule.markers` | new (D4) |
| | V42 | E | routing ids unique; `when` a function; copy has ≥ 1 surface with h, p and chips; ≤ 1 fallback per surface | C #23 |
| | V43 | E | summary groups ⊆ items; rules `{id, text fn}`; the last `ask` rule has no `when` | C #24 |
| | V44 | E | every key a `said`/`ask` text reads through `s.S` exists in **every** locale's `sum` (S-proxy) | B #13 |
| | V45 | E | `validateProbes(list, itemIds, flagIds)` empty; option `a` values valid for the item type; `probes.version` present | A E37 |
| | V46 | E | **smoke:** every closure runs without throwing over the smoke states, and returns the right type (when → boolean-ish, text → string, chips → string[]). Smoke states: empty; each sample case; all-yes/max; all-no/zero; 256 seeded random states (mulberry32 0x5A1C) × complaint ∈ values ∪ {""} × rf ∈ {none, one, two flags} × safetyReviewed; Patient states add `'unsure'`; every locale. **Rescue property:** for every probe of kind `rescue` and every smoke state, `when` with the rescued item unset must equal `when` with it set to `negativeValueOf(item)` (§4.10); a rescue that retires on a negative answer is an E | A E28, C #25/#34 |
| | V47 | E/W | **reads completeness:** recording proxies (built before freezing, §3.3) over `answers`, `domains`, `items`, `ctx`, `activeFlags`, `complaint` and the `yes`/`no`/`answered`/`scale` helpers during V46, plus the references the engine follows itself (`patientSummary.groups` ids, probe `target`/`rescues`, probe option `a` keys and `rf` values). An undeclared access or reference is E; a declared id that is neither accessed nor referenced is W | new (D4) |
| | V48 | E | determinism: each closure returns a deep-equal result when called twice on the same frozen state | new |
| Samples | V49 | E/W | sample ids unique; answers valid for the item type (never `'unsure'`); ctx valid (clinician vocabulary); rf ⊆ flags; complaint ∈ values ∪ {""}; `buttonLabel` present (E); unknown icon (W) | A E31 |
| | V50 | E | demo patient has `id`, `mrn` and `synthetic:true` and no `dob`/`birthDate`; transcript entries are `["md"\|"pt", string]` | A E32-E33 |
| | V51 | W | gate rehearsal: no sample with a red flag; no unscorable sample; no sample with a positive negative-domain item | Inv §4.5 |
| Provenance | V52 | E | derived: `provenance.root`, `derivedFrom` and `lineage` complete, with `root` equal to `lineage[0]` and `derivedFrom` equal to its last entry; `contentHash` 64-hex and equal to the recomputed hash; last changelog entry is `derived` with a non-empty note and `paths` | new |
| | V53 | E | **family version rule** (§3.11), for every module with a root and for the draft of a kin upload: within the family (root, lineage records, every loaded module with the same root), equal `instrumentVersion` ⇔ equal `instrumentHash`; an `instrumentHash` different from the root's needs the `-local` tag; the same for `lexicon.version`/`lexiconHash`; `goldSet` equal to the root's | new (D8) |
| | V54 | E | derived: `research.calibration` and `research.population` equal to the root's; `cds.examples.settled` absent when `scoringHash ≠` the root's | new |
| | V55 | E | derived: every locale whose patient data differs from the root's has `reviewed:false` and `editedLocally:true`; every locale with a non-empty `stale[]` has `reviewed:false` | new |
| | V56 | E | a rendered identity value (any `IDENTITY_TEMPLATE_FIELDS` field) of a non-built-in equals one of a loaded module (defence in depth behind V8 and V9) | new |
| Upload | V57 | E | the logic source has no import, re-export or dynamic import (reported again from `importSource`) | new |
| | V58 | E | sizes within `LIMITS`; text is valid UTF-8 | new |
| | V59 | W | the logic source references page or network APIs (`window`, `document`, `globalThis`, `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator`, `eval`, `Function`, `import.meta`). They are listed in the consent dialog. This is a signal for the reviewer, not a sandbox (§7.4). | new |
| Patient | V60 | E | no patient-facing module string matches `OMISSION_PATTERNS` (§4.2): every `locales.*` string (items `q`/`opts`/`ask`/`help`, flags `q`/`say`, context `q`/labels, steps, `ui`), every string-valued `logic.locales.*.sum` entry, and every `said`/`ask`/`sum` output observed during V46 | review (D15) |

### 4.15 `derive.js`, `zip.js`, `exportAll.js` (WP11)

```js
createDraft(module) → {parentKey, rubric: structuredClone(module.rubric)}
lockedPaths(module) → Array<string>          // JSON-pointer patterns the editor renders read-only (§5.7)
acknowledgePaths(module, readsObserved) → Array<{path, dependents: string[]}>
   // fields that may change only with an acknowledgement (§5.7): text, labels and patient wording of every item, option,
   // flag and context value in logic.reads, each with the closure ids that read it (from V47's readsObserved)
diffRubrics(a, b) → Array<{path, from, to}>  // JSON pointers, stable order
classifyChanges(parent, draftRubric, {root}) → Promise<{
     vsParent: {instrumentChanged, scoringChanged, lexiconChanged},
     vsRoot:   {instrumentChanged, scoringChanged, lexiconChanged},
     localesEdited: string[], englishEditedPaths: string[], staleRedFlagPaths: string[], paths: string[],
     needsAcknowledgement: string[]}>        // staleRedFlagPaths: other-locale flag q/say left behind by an English edit
proposeIdentity(parent, draftRubric, classification, loaded, {now}) → {id, label, instrumentVersion, lexiconVersion,
     versionLocked: {instrument: string|null, lexicon: string|null}}
   // §3.11 defaults: id `local-${root.id}-${hex6}`; label `${root.label} — edited ${YYYY-MM-DD}`; versions from the family
   // rule — a version is locked (with the member it equals) when the draft's hash equals a family member's
deriveRubric(parent, draftRubric, {root, id, label, instrumentVersion, lexiconVersion, note, author, acknowledged, now, source})
   → Promise<Rubric>
   // applies every §3.11 derived rule (reviewed/editedLocally/stale, calibration and population kept, settled example
   // removed against the root, provenance {root, derivedFrom, lineage, contentHash, createdAt, source?}, changelog entry,
   // logicBinding = the root's). The same function serves Apply and "Load as derived" (parent = root there).

crc32(bytes) → number
zipStore(entries: Array<{name, bytes}>, {dosDate = 0x0021, dosTime = 0}) → Uint8Array
   // store-only (method 0); local headers + central directory + EOCD; UTF-8 name flag (bit 11); fixed DOS timestamp
   // (1980-01-01 00:00) so identical inputs give identical bytes; entries written in the given order
unzip(bytes) → Promise<Array<{name, bytes}>>
   // method 0 and method 8 (DecompressionStream("deflate-raw") when present, otherwise the error
   // "this zip is compressed and this browser cannot decompress it; re-download it from screenAIr");
   // CRC-32 is verified; names with ".." or a leading "/" are rejected; ZIP64 is rejected (LIMITS)
buildExportFiles(entries: RegistryEntry[], {appVersion, now, fetchBytes}) → Promise<Array<{name, bytes}>>   // §5.8
   // fetchBytes = p => fetch(new URL(p, env.appBase)).then(r => r.arrayBuffer()) (D25)
```

### 4.16 `lineage.js` (WP3)

```js
ancestorRecord(module) → AncestorRecord                        // §3.2
kinOf(rubric, builtins) → {builtin: Module, reasons: string[]} | null
   // reasons ⊆ {"id", "logic", ...KIN_FIELDS}: the id or logic moduleId is a built-in's, or a KIN_FIELDS value equals one
familyOf(module, loaded) → AncestorRecord[]                     // root, lineage records, loaded modules with the same root
classifyLineage(rubric, {builtins, loaded, sameUpload, logicSha256, contentHash}) →
  {kind: "duplicate"|"verified"|"derived-from-upload"|"rederive"|"uploaded", root: Module|null, origin, row: 1..7,
   reasons: string[]}                                           // §3.11 table; never reads `origin` from the file
checkVersionFamily(module, family) → Array<{path, code: "V53", msg}>
provenanceLines(module, audience: "clinician"|"patient") → string[]   // §3.11 "Provenance display"; patient set never
                                                                      // contains CAVEATS.scoringChanged
availability(module) → {screener: true, scribe: {voice: boolean, probes: boolean, reason?: string},
                        patient: {available: boolean, reason?: string}, research: {population: boolean, readiness: boolean}}
   // the per-tab summary on upload and Apply result cards and in ModuleInfo (§5.2)
```

---

## 5. Component contracts

All components are classic-runtime JSX: `import React from "react"`, extension-qualified relative imports, CSS as a template string rendered with `<style>`. Every component is safe under `React.StrictMode` (`boot` wraps the root in it): effects are idempotent and always have a cleanup.

### 5.1 `ScreenAIr` shell (`src/shell/ScreenAIr.jsx`, default export, props `{env}`)

`env = {loader: {importModule, importSource, inspectSource}, appBase}` arrives from the page through `boot` (D25, §6.4). The shell hands it to every `registry.js` call, `UploadDialog`, `ModuleWorkspace`, `ResearchTab` and `RubricEditor`. Nothing compiled imports the loader.

**Layout, top to bottom (clinician mode):**

1. `header.sa-top` (sticky):
   - the wordmark **screenAIr**;
   - the **`ModulePicker`**, the first interactive control on the page (`<label for="sa-module">Module</label>`);
   - a `ProvenanceBadge` (`ui/common.jsx`) for non-built-in modules: `uploaded` / `edited` / `edited · scoring changed`, with the scoring compared against the **root** (§3.11). While the Patient tab is shown it reads the patient marker instead (`CAVEATS.patient.*.short`), like the caveat strip below;
   - an ⓘ button that opens `ModuleInfo`.
2. `CaveatStrip#sa-caveat` (always rendered):
   - `CAVEATS.prototype`;
   - for a non-built-in module, `provenanceLines(module, audience)`: the **patient** set while the Patient tab is shown, the **clinician** set on every other tab (§3.11). The patient set never contains `CAVEATS.scoringChanged`;
   - a red **"Module logic error — <family> rule <id>: <message>. Affected output is withheld."** line while any closure error is recorded.
3. `nav.sa-tabs` (`role="tablist"`): **Clinician Screener · Ambient Scribe · Patient Companion · Research · Rubric Editor** (`data-tab="screener|scribe|patient|research|editor"`). At the right, `MicIndicator#sa-mic` is shown on every tab while the voice state is `starting`, `listening` or `restarting`. On the Scribe tab it reads "● Listening — Ambient Scribe [Stop]"; on any other tab, "● Listening — captures go to the Ambient Scribe [Stop]".
4. The restore banner, only when saved modules exist: "N modules saved in this browser — Restore · Dismiss" (D20).
5. The unsaved-module notice, while any derived module is neither remembered in this browser nor downloaded: "N edited modules exist only in this tab and will be lost on reload — Remember · Download". While such modules exist, a `beforeunload` handler asks the browser to confirm leaving.
6. `validation.ok ? <main key={entry.key}><ModuleWorkspace …/></main> : <InvalidModule entry/>`, inside the `PrintFrame` (§5.10).
   - `ModuleWorkspace` owns the `SessionProvider` and renders the five panels. Panels mount on first visit and stay mounted with `hidden` afterwards (C §4.1).
   - `role="tabpanel"`; each panel has its own scoped root class.
   - The Screener and Scribe panels open with a fixed `TabNote`: "This tab keeps its own answers. The Clinician Screener, the Ambient Scribe and the Patient Companion are separate screens; none of them reads another's answers." Research opens with "Research reads the last screen and the captured rows of the Screener and the Scribe; choose the source below." Copying answers between apps is open question Q27.
   - The Patient panel opens with the `PatientModeBar`: **[Hand to patient]** and, for a built-in module, "At-home link: `patient.html?module=<id>` [Copy link]". For any other module it reads "At-home use is available for built-in modules only."
7. `VersionFooter#sa-footer`:
   - format `release {APP_VERSION} · module {id} · instrument {instrumentVersion} · lexicon {lexicon.version|—} · probe set {probes.version|—} · gold set {goldSet.version|— (not benchmarked)}`;
   - plus " (benchmarked on lexicon {goldSetLexicon}; not re-run)" when the two differ;
   - plus `CAVEATS.prototype`, plus "Served as source; compiled in your browser."
8. Overlays: `UploadDialog`, `ConfirmDialog` (no `window.confirm`), the `ModuleInfo` drawer, `Toast`.

**Patient mode** (`mode === "patient"`, D26). It is entered with **Hand to patient** or with `#mode=patient` on load.

- Only the Patient panel is rendered inside the `PrintFrame`, with the caveat strip (patient set), a patient footer (`{name} · release {APP_VERSION} · instrument {instrumentVersion}`, the patient provenance marker for a non-built-in, and `CAVEATS.prototype`) and a small **Return to clinician view** button at the end of the page.
- Not rendered: the module picker, the ⓘ button, the clinician `ProvenanceBadge`, the tab bar, the `MicIndicator`, the restore banner and the unsaved-module notice. The other panels stay mounted, so the clinician's screens survive, but they carry `hidden` and `inert`.
- Entering patient mode stops the microphone (policy below).
- **Return to clinician view** opens `ConfirmDialog`: "The clinician view shows scores, research data and module tools. Hand the device back to the clinician before continuing." [Stay in patient mode] [Return to clinician view]. Q30 asks whether a confirmation is enough.
- A reload with `#mode=patient&module=<id>` reopens patient mode on that built-in. If `<id>` is not a built-in, which after a reload means it is no longer loaded, the page shows "This questionnaire is no longer loaded on this device. Please hand the device back to your clinician." It never substitutes another module.

**`ModuleInfo` shows:**

- id, label, name, origin, and the classification with its §3.11 row and reasons;
- the five axes on separate lines;
- hashes (rubric, logic, instrument, scoring, lexicon, content);
- provenance (root, derivedFrom, the lineage, the source file of a Load as derived, uploaded file names and SHA-256), and a note when a root built-in's rubric file changed since the derivation;
- the per-tab `availability` summary;
- change log entries;
- validation warnings;
- for a derived module that is not remembered or downloaded: **Remember in this browser** and **Download**;
- for non-built-ins, "Remove from this session";
- an **About** section with the description, the notice and the version list that `index.html` carried (D27).

**State owned by the shell:**

- `entries` (the registry), `activeKey`, `tab`, `mode` (`"clinician"` | `"patient"`);
- `voice = {state}` (the `MASQUE_Voice.js` state), `stopSignal` (a counter), and the derived `micAllowed = mode !== "patient" && tab !== "patient"`;
- `dirty = {screener, scribe, patient, research}`: each `null` or a one-line summary that the app reports with `onDirty(tab, summary)`, e.g. "12 answers, 2 captured rows". The editor autosaves its drafts (§5.7), so it never blocks a switch;
- `moduleErrors` and `savedList`;
- dialog state.

**Props** (callbacks are stable via `useCallback`; the workspace adds the session callbacks):

| Component | Props |
|---|---|
| `ModuleWorkspace` | `module, entry, entries, env, appVersion, site, tab, mode, micAllowed, stopSignal, onDirty, onModuleError, onVoiceState, onOpenTab, onPrintContext, onApply, onDownloadAll` |
| Screener | `module, appVersion, site, onScreen, onCapture, onDirty, onModuleError, onOpenTab` |
| Scribe | the Screener's props + `onVoiceState, stopSignal, micAllowed` |
| PatientCompanion | `view = projectForPatient(module)` (memoised per module), `appVersion, onDirty, onModuleError, onPrintContext` |
| ResearchTab | `module, appVersion, env, onDirty`; the session comes from `useSession()` |
| RubricEditor | `entries, activeKey, env, onApply, onDownloadAll`; the session comes from `useSession()` (current-screen impact rows, §5.7). Drafts autosave, so the editor reports no dirty state. |

**Session API** (`ui/common.jsx`). `SessionProvider` holds `{screens: {screener, scribe}, cohorts: {screener: Row[], scribe: Row[]}}`, and `useSession()` returns `{screens, cohorts, publish(snapshot), addRow(source, row)}`. `ModuleWorkspace` renders the provider and passes `onScreen = publish` and `onCapture = ({source, row}) => addRow(source, row)` to the apps. The provider sits inside `<main key>`, so a module switch resets it together with the apps; the shell never holds session data.

**Module switch.** Choosing another option, **Create and switch** in the editor and loading an upload all go through `switchModule(key)`:

1. If any `dirty` entry is set, `ConfirmDialog` lists exactly what is lost, one line per non-empty item: "Clinician Screener — 12 answers, 2 captured rows", "Ambient Scribe — transcript (14 lines), 1 captured row", "Patient Companion — answers in progress", "Research — 1 uploaded cohort file". It then says "Rubric Editor drafts are kept." and "Export captured rows from the Screener or Scribe first if you need them." [Cancel] [Switch module].
2. On confirm: `stopSignal++`, then `setActiveKey(key)`. `<main key>` remounts every app and the session store. The tab is kept (Inv §7 risk 6).

**Routing and persistence:**

- On load the shell reads `location.hash` (`#tab=<key>`, optionally `&module=<built-in id>` and `&mode=patient`) and writes it back on change with `history.replaceState`.
- `sessionStorage` (inside try/catch) holds `screenair.tab` and `screenair.module`, built-in ids only.
- Uploaded and derived modules are never auto-activated.

**Microphone policy (D16):**

- Whenever `micAllowed` becomes false (the Patient tab or patient mode) and the voice state is not `idle`, `stopped` or `error` — so in `starting`, `listening` or `restarting`, including while the browser's permission prompt is still open — the shell does `stopSignal++` and shows the toast "Microphone stopped — the Patient Companion never runs with the microphone on."
- The Scribe receives `micAllowed`. Listen is disabled while it is false, and if the capture reports `starting`, `listening` or `restarting` while it is false (a permission prompt answered after the switch), the Scribe calls `destroy()` at once.
- A module switch also does `stopSignal++`.
- The Scribe stops itself on `pagehide` and on unmount.

**Document title:** `screenAIr · ${module.label}` for a built-in; `screenAIr · ${module.label} (edited)` or `(uploaded)` otherwise; `screenAIr · Patient Companion` in patient mode.

**Built-in load failure** (network or validation) renders `InvalidModule`: the code/path/message list plus [Retry]. Upload stays available.

### 5.2 `ModulePicker`, `UploadDialog`, `shell/registry.js`

**`ModulePicker({entries, activeKey, onSelect, onUploadRequest})`** renders a native `<select id="sa-module">` with options in this order:

1. built-in modules in `registry.json` order, labelled by `module.label`; the default is "Dizziness and Sinusitis (MASQUE v1)";
2. **`Upload`** (value `__upload__`), the second option while one module is built in;
3. `<optgroup label="Loaded this session">` with uploaded and derived modules, labelled `${label} · uploaded` or `${label} · edited`.

A built-in that failed to load shows `${label} (failed to load)`.

**Only committed choices act.** A closed native select changes its value on arrow keys, and some browsers fire `change` for each step (the review reports it for Chromium on Windows), so a keyboard user moving through the list would open the upload dialog or switch module on the way. The picker therefore records the last input on it. After a pointer interaction, `change` commits at once. After a keyboard change, the new option is only *pending*: Enter commits it, while Escape or leaving the control restores `activeKey`. A committed `Upload` calls `onUploadRequest()` and resets the select to `activeKey`. The `pages` spec drives this with the keyboard.

**`UploadDialog({open, onClose, entries, env, onLoaded})`.** A modal; the visible "Choose files" control is a real `<input type="file" multiple accept=".json,.js,.mjs,.zip">`, so no programmatic click needs a user activation.

1. A drop zone plus file input. A link "Download the current module's files to edit and re-upload" calls `buildExportFiles([active])` and saves `${id}.zip`. A short format guide names the accepted formats (`.json` rubric, `.js`/`.mjs` logic or module, the `.zip` from Download-all) and says that spreadsheets are not read (§3.9).
2. On files: `classifyFiles` reads the bytes, enforces `LIMITS` and UTF-8, computes SHA-256 and determines each kind **without executing anything**: a `.js` matching a loaded built-in's logic SHA is "built-in logic (not run)"; any other `.js` is classified by `env.loader.inspectSource` (parse only, §6.1), or shown as "executable (kind determined after consent)" when its `format` is not a literal. A table shows file name, size, SHA-256 (first 16 hex + copy button), kind and the intended binding.
3. If any file is executable and is not recognised built-in logic (`.js`/`.mjs`, or JS inside a zip):
   - with `SITE.ALLOW_JS_UPLOAD === false`, the file is refused with "JavaScript modules are disabled on this site; upload a JSON rubric";
   - otherwise a red box reads: **"This file contains executable code. It will run inside this page with the same permissions as screenAIr — it can read and change anything this page can. Load it only if you trust its author. JSON rubrics contain no code."** The checkbox "I understand and want to run this code" is required.
4. On Validate (enabled once consent is given, if needed):
   - `env.loader.importSource` each consented logic or module file;
   - pair them (§3.9);
   - `classifyLineage` each rubric (§3.11), then `bindModule` with the origin it assigns;
   - `validateModule` with `loaded: entries` and, for a derivation, its `root`.
   Each module gets a result card: ✓ / ✗, then errors as `code · path · message`, then collapsible warnings, then the **availability summary**, e.g. "Clinician Screener ✓ · Ambient Scribe: no voice capture (no lexicon) · Patient Companion unavailable (no patient wording) · Research: no research configuration" (`availability`, §4.16).
   A file classified **Load as derived** (§3.11 rows 2, 4, 5, and 6 when its content check fails) gets a card that names the reason (for example "Module id 'masque' is reserved for the built-in module, and this file differs from it in 3 weights") and the button **Load as a module derived from <label>**. It opens the Apply dialog of §5.7 over `classifyChanges(root, file)`. Here the dialog only prepares the derived rubric; its result card replaces the file's, and **Load** registers it like any other module.
5. **Load** is enabled only when every selected module validates with zero errors. It calls `registry.register(entry)` and then `onLoaded(key)`, which goes through `switchModule`. A JSON-only module offers "Remember this module in this browser" (opt-in for uploads, D20). **Cancel** discards everything; nothing was registered.
6. **Error messages** (exact first sentence; the detail follows):
   - "Not a screenAIr file" (unknown format);
   - "Spreadsheets and documents are not supported. Download the current module's rubric (.json) and edit its weights, or use the Rubric Editor." (`.csv`, `.tsv`, `.xls`, `.xlsx`, `.ods`, `.doc`, `.docx`, `.pdf`);
   - "Made for a newer screenAIr" (contractVersion);
   - "Not valid JSON: {message}";
   - "Not valid UTF-8";
   - "Too large ({size} > {limit})";
   - "{file} line {l}:{c}: {Babel message}";
   - "{file} imports other files (line {l}): logic files must be self-contained";
   - "{file} has no default export";
   - "Logic file without a rubric: select the rubric JSON together with it";
   - "Needs the logic file for '{moduleId}'";
   - "Logic id '{moduleId}' is reserved for the built-in logic";
   - "Module id '{id}' is reserved for the built-in module" (followed by the Load as derived offer);
   - "This file was changed after it was created in screenAIr ({check} does not match)" (followed by the offer);
   - "Module id '{id}' is already loaded";
   - "Label '{label}' belongs to a built-in module";
   - zip errors (§4.15);
   - "{n} validation errors" (list).

**`shell/registry.js`:**

```js
loadBuiltins({env}) → Promise<RegistryEntry[]>                    // §3.8 load path; paths against env.appBase; the default first
classifyFiles(files: File[], {entries, env}) → Promise<Classified[]>
   // bytes, sha256, kind; built-in logic recognised by sha256; other JS via env.loader.inspectSource; nothing executes
prepareUpload(classified, {entries, consent, env}) → Promise<Array<{entry: RegistryEntry|null, report: ValidationReport|null,
                                                                    classification, errors: string[]}>>
   // a .js recognised as built-in logic binds to the loaded logic object, never to the uploaded bytes
register(entry); unregister(key)
saveModule(entry)                // JSON-only (rubric text + a logic reference by moduleId/sha256); never logic source
listSaved() → Array<{id, label, origin, logicRef, needsLogicUpload: boolean}>
restoreSaved(id, {entries, env}) → Promise<RegistryEntry>
   // re-runs classifyLineage and validateModule exactly as an upload does; the stored `origin` is display-only and grants
   // nothing; binds to a loaded logic with the recorded sha256, otherwise fails with "needs logic file"
forgetSaved(id)
// RegistryEntry = {key, origin, classification, module, validation, files:{rubric:{name, text, sha256},
//                  logic:{name, text, sha256}|null}, loadedAt, savedAt?, downloadedAt?, sourceFileNames?}
```

`localStorage` key: `screenair.saved.v1` = `[{id, label, origin, rubricText, logicRef:{moduleId, sha256}|null, savedAt}]`. All access is wrapped in try/catch. A derived module whose logic is a built-in's (matched by SHA) restores without any upload; one whose logic was uploaded lists "needs logic file `<name>` (sha256 …)". Uploaded JavaScript can write to `localStorage` (§7.4), which is why a restore trusts nothing stored except the rubric text, and re-verifies even that.

### 5.3 `Screener({module, appVersion, site, onScreen, onCapture, onDirty, onModuleError, onOpenTab})`

- **State** (as Scr L825-835): `step, cohort, rf ({id:true}), safetyReviewed, patient (module.demo.patient), complaint (""), answers, ctx, showJson, toast, copied`. All of it resets through the shell key.
- **Derived values:**
  - `score = useMemo(computeScore)`;
  - `activeFlags`, `override`, `emergent` (`TIER_RANK[f.tier] === 0`);
  - `safetyDone = safetyGate(...)`;
  - `stepDef = module.steps.screener[step]`;
  - `canContinue = stepDef.kind === "safety" ? safetyDone : stepDef.requires === "complaint" ? !!complaint : true` (Scr L888);
  - `gap = gapSignals(module, ctx)`;
  - `state = buildRoutingState(module, {surface:"screener", …, safetyReviewed: true})`, with `routingCleared = !override`, because the safety step has already been passed;
  - `{recs, error: routingError} = routingRecs(module, state)`;
  - `preview = cdsPreview(module, state, {routingError})`;
  - `bundle = buildBundle(module, {…, routingError}, {surface:"screener"})`. A routing error therefore withholds the referral and the CDS index card as well as the recommendations (D6).
- **Rendering.** The DOM structure and class names are those of Scr L978-1444 (D1), driven by data:
  - the rail from `steps[].rail`;
  - `safety` renders the red-flag checklist grouped by `module.redFlagGroups` (Scr L1029-1045) and the engine safety bar (Scr L1046-1060);
  - `domain` renders the card eyebrow, heading and sub, then (if `complaintPicker`) the picker from `phenotypes.values` plus the 6 px spacer, then one `QGroup` per `domainKeys` entry with `domainIntro[k]`, then (if `context`) the 4 px spacer plus `ContextQ` from `module.contextItems` (Scr L1066-1103 order);
  - `result` renders `ResultView`: engine texts from §3.6, `copy.indexName` as the h2, `SCORE / {scaleMax}`, `meterZones`, `meterTicks`, needle at `total/scaleMax`.
- **Provenance near the score.** A non-built-in module shows a `ProvenanceBadge` directly above the index readout: "Edited module" / "Uploaded module", plus "scores not comparable with {root} {rootVersion}" when the scoring differs from the root's (§3.11).
- **Tab note.** The panel opens with the `TabNote` of §5.1: this tab keeps its own answers.
- **Sample rail.** `SampleRail` (in the patient banner row, Scr L994-998) renders `module.sampleCases`: group "sample" first, then group "scenario" behind a "Scenarios" divider. Icons come from a fixed name→lucide map and `why` becomes the button title. `loadSample(c)` follows Scr L848-858 with `complaint = c.complaint ?? ""` and `safetyReviewed = c.safetyReviewed ?? true`.
- **Capture.** `screenToCohortRow(module, {patient, answers, ctx, score, activeFlags, complaint}, {appVersion, salt: site.SITE_SALT})` → `setCohort`, then `onCapture({source:"screener", row})`. Export uses `${fhir.filePrefix}-pilot-cohort-<date>.csv`. Spec downloads use `${filePrefix}-questionnaire-v${instrument}.json`, `${filePrefix}-cds-hooks.json` and `${filePrefix}-data-dictionary-v${instrument}.json` (Scr L966, L1407-1413).
- **Publishing.** `onScreen(snapshot)` runs in an effect whenever the answers, score, complaint or flags change. `ScreenSnapshot = {source, at, moduleKey, score: total, floor, ceiling, scorable, band, domains, coverage, sex, gender, phenotype: complaint, redFlags: activeFlags.map(f => f.points), safetyReviewed, routingCleared, answers, ctx}`. The Screener publishes `routingCleared = !override` once its safety step is done and `false` before; the Scribe publishes its `routingGate` value. `answers` and `ctx` feed only the editor's current-screen impact rows (§5.7); the session is never persisted (D20). `onDirty("screener", summary)` reports e.g. "12 answers, 2 captured rows" while answers, ctx, rf, complaint or cohort is non-empty or `safetyReviewed` is set, and `null` otherwise.
- **Panel link.** Where the panel was (Scr L1137-1142), a card reads "Research readiness for this screen — calibration, validation, fairness and the model card — is in the **Research** tab. Captured this session: n." with a button that calls `onOpenTab("research")` (AD8).
- **Footer.** Scr L1144 verbatim.
- **Never:** compute or show a probability; show a band while `!scorable` (engine `coverageGate`); name an id or brand in its source.

### 5.4 `Scribe({…Screener props, onVoiceState, stopSignal, micAllowed})` — microphone included

- **State:** Scb L728-765 verbatim (transcript, cursor, playing, answers, ctx, vmp, asked, skipped, cohort, rf `{id:'nlp'|'md'|'probe'}`, safetyReviewed, probeAns, probeNotes, input, view, toast, voiceState, voiceErr, voiceUsed, interim, speaker, pulse). Refs as Scb L755-765.
- **Engine wiring:**
  - `extractor = useMemo(() => module.lexicon && createExtractor(module.lexicon), [module])`;
  - `ingest(role, text, src)` follows Scb L772-784 using `extractor.extract`, and applies `ingestCaptures`, which raises flags and never clears them;
  - `{value: complaint, error: phenotypeError} = derivePhenotype(module, answers)`; a `phenotypeError` is reported through `onModuleError` and treated as a routing error (§3.3);
  - `{list: suggestions} = rankSuggestions(…, phenotypeError, skipped)`;
  - `live = liveProbes(module.logic.probes?.list ?? [], answers, rf, probeAns, {onError})` then `truncateProbes(live)`;
  - `routingCleared = routingGate({override, safetyReviewed})` (Scb L928);
  - `{recs, error: routingError} = routingRecs(module, buildRoutingState(module, {surface:"scribe", …, phenotypeError}))`;
  - `note = buildNote(module, {…, recs, routingError})`: on a routing or derive error the A&P carries the engine error line, never `copy.note.noDriver` (§4.11);
  - `bundle = buildBundle(module, {…, routingCleared, routingError}, {surface:"scribe"})`: no referral ServiceRequest on an error, and an Observation note naming the withheld routing.
- **Skip** writes nothing (Scb L909-912, baseline behaviour). **Sign** is gated by `signGate`.
- **Labels.** "re-asking …" uses `itemShort(module.itemById[p.rescues])` (AD5). Capture tags use `captureLabel`. The safety tab shows the canonical flag wording (AD6).
- **Microphone.** `MASQUE_Voice.js` is imported unchanged.
  - **Listen** is rendered only when `module.lexicon` exists, because the transport is gated with the lexicon (§3.5).
  - It is disabled with `VOICE_ERRORS.unsupported` as its title when `!isVoiceSupported()`, as at Scb L968-972.
  - When `!isSecureForMicrophone()`, the notice `VOICE_ERRORS.insecure` is shown **before** any click, with Listen disabled.
  - `startVoice()` follows Scb L793-806 with `lang: module.lexicon.lang ?? VOICE_LANG`. It does nothing while `micAllowed` is false, and Listen is disabled then.
  - **Final segments only** reach `ingest(speakerRef.current, text, "voice")`. Interim text is a dashed preview with `extractor.extract(interim)` tags (Scb L808-813, L1018-1030). The speaker toggle, level meter (`VoiceMeter`) and domain pulse are as in the baseline.
  - Effects:
    - `onVoiceState({state: voiceState})` on every change;
    - `useEffect(() => { if (stopSignal) stopVoice(); }, [stopSignal])`;
    - a `micAllowedRef` mirrors the prop; the capture's `onState` wrapper calls `voiceRef.current.destroy()` when it reports `starting`, `listening` or `restarting` while `micAllowedRef.current` is false (a permission prompt answered after the switch to a patient-facing view);
    - unmount cleanup `voiceRef.current?.destroy()` (Scb L767);
    - a `pagehide` listener that calls `destroy()`;
    - `reset()` stops voice (Scb L835).
  - The honest notes stay verbatim: the browser speech-service note (Scb L1038-1042) and the footer variants (Scb L1273-1275, with versions from the module and the shell). Nothing audio is stored. Only one Scribe instance exists per page (the shell mounts exactly one).
- **Without a lexicon:** Listen, Play, Step and typed input are hidden and the §3.5 notice is shown. **Without `demo.transcript`:** Play and Step are hidden. **Without probes:** the probe rail is hidden.
- Publishing (`onScreen` and `onCapture` with `source:"scribe"`, the snapshot carrying the Scribe's own `safetyReviewed` and `routingCleared`), `onDirty("scribe", summary)` (e.g. "transcript (14 lines), 1 captured row" while the transcript or answers are non-empty), the panel link card (replacing Scb L1266-1272), the tab note and the provenance badge near the readout are as in the Screener.

### 5.5 `PatientCompanion({view, appVersion, onDirty, onModuleError, onPrintContext})` — download and print

- **Input** is only `view = projectForPatient(module)` (§4.12). The component, and every file it imports, cannot reach a score, band, probability, clinician flag text, `points`, `action`, FHIR or research. The graph test (§8.3) proves that `PatientCompanion.jsx`'s module graph contains none of `scoring.js`, `fhir.js`, `rules.js`, `cohort.js`, `probes.js`, `extraction.js`, `scribe.js` or `ResearchReadinessPanel.jsx`.
- **State:** `sec, a, ctx, rf, safetyDone, loc` (internal, default `"en"`, reset by the shell key).
  - Locale buttons come from `Object.keys(view.locales)` with `LOCALE_NAMES` (Pat L677-680).
  - Sections are `[intro, safety, ...view.steps, summary]`. Section titles come from `PATIENT_CHROME[loc].sections` and `localeText(view, loc, "steps.<key>.title")`.
  - The safety gate is `safetyGate` (Pat L656). Flags are `flagCopy(view, loc)`, so only `{id, tier, q, say}` exist.
- **Unavailable module** (`!view.available`): the §3.5 notice, and no sections.
- **Where it runs.** The same component serves the Patient tab, the shell's patient mode and the standalone `patient.html` (§5.11). It never knows which; the surrounding chrome differs, not the component.
- **Unreviewed banner.** Shown whenever `!view.locales[loc].reviewed`:
  - es: `CAVEATS.unreviewed.es.title` (with the "⚠︎ " prefix) and `.body` (Pat L683-688);
  - a locally edited locale also gets `CAVEATS.editedWording.en` (lang="en");
  - a locale with `stale` paths also gets `CAVEATS.staleTranslation.en` (lang="en"): the English was edited and this translation was not, which matters most for red-flag wording (§5.7 asks for an acknowledgement before Apply).
  - The banner is **printed**: the `noprint` class is removed (AD10).
- **Provenance.** For a non-built-in module the patient provenance lines (`view.provenanceLines`, `CAVEATS.patient.*`) appear under the banner, are printed, and go into both exports. Clinician wording such as `CAVEATS.scoringChanged` never reaches this component.
- **Summary:**
  - `buildPatientSummary(view, loc, …)`. On error the card reads **"This summary could not be prepared because the module's summary rules failed. Nothing is shown rather than an incomplete summary."**, all three export buttons are disabled, and `onModuleError` is called.
  - The thin-summary refusal is as Pat L1003-1019, using `t.thin`/`t.notSureLede` (AD10: es now shows the existing Spanish strings).
- **Buttons** (Pat L1075-1082, chrome labels only — no new translatable words):
  - **`{t.print}`** calls `window.print()`;
  - **`{t.download} (.txt)`** saves `summaryText(...)` as `t.fileName`;
  - **`{t.download} (.html)`** saves `summaryHtml(...)` as `t.fileName` with `.txt` replaced by `.html`;
  - `{t.startOver}`.
- **`.txt` export:** Pat L1096-1125 verbatim, then (AD10) a final line `Prototype · not for clinical use · {generatedAt as YYYY-MM-DD}`. The date tells a physician who receives the file ahead of the visit when it was made. A non-built-in module adds its patient provenance lines; an edited locale adds `CAVEATS.editedWording.en`; a stale locale adds `CAVEATS.staleTranslation.en`. The unreviewed `txt` line is kept at the top (Pat L1101). An optional patient-name field is open question Q29; until then neither export carries a name.
- **`.html` export (new, `summaryHtml`).** One self-contained document: no scripts, no external URLs, no fonts.
  - `<!doctype html><html lang="{loc}">`, `<meta charset="utf-8">`, `<meta name="viewport" …>`, `<meta name="robots" content="noindex, nofollow">`, `<title>{t.summaryTitle}</title>`, inline print-friendly CSS (a subset of `.mp` summary styles plus `@page { margin: 16mm }`).
  - The body is one `<table class="frame">` whose `<thead>` holds the caveat header (`Prototype · not for clinical use`, plus " · Traducción sin revisar" when unreviewed es, plus the patient provenance marker), so a browser printing the saved file repeats it on every page without covering content (§5.10). Inside the `<tbody>`, in order:
    1. the unreviewed banner (title and body) when not reviewed;
    2. the patient provenance, edited-wording and stale-translation lines when applicable;
    3. `<h1>{t.summaryTitle}</h1>`;
    4. the same sections and order as the on-screen Summary: thin card, call-out with say-this, openWith, describe, askAbout, notSure (with `t.notSureLede`), forClinician (`clinicianLede` through `richText` plus the `+`/`−` list);
    5. the `.disc` disclaimer;
    6. a footer `{name} v{appVersion} — {t.txtFooter}` · `Prototype · not for clinical use` · `{generatedAt as an ISO date}`.
  - All text is HTML-escaped (`& < > " '`).
  - Never present in it: a match for any of `OMISSION_PATTERNS` (a number such as "78/100", "likelihood", "probability", "score" or "scores", and their Spanish forms), or any clinician flag text.
- **Print.** `window.print()` prints the active panel only (§5.10). Every page carries the shell's repeating print header: `Prototype · not for clinical use`, plus " · Traducción sin revisar" when `loc === "es"` and not reviewed, plus " · {patient provenance marker}" for non-built-ins. It sits in the `PrintFrame`'s table header, which reserves its own space on every page. The summary page also prints the full unreviewed banner once at the top. The `.mp` `@media print` rules are kept (Pat L629-634).
- **Omissions** (Inv §4.2) hold structurally: "Not sure" stays unanswered, there is no research capture, and no state is persisted (D20).

### 5.6 `ResearchTab({module, appVersion, env, onDirty})` and the panel

- **Session:** `useSession()` → `{screens:{screener, scribe}, cohorts:{screener: Row[], scribe: Row[]}}`, fed by the apps' `onScreen` and `onCapture` through `ModuleWorkspace` and reset with the shell key (§5.1).
- **Layout:** a segmented control **Population estimates | Research readiness**. The default is Population when the gate below allows it, otherwise Readiness.
- **Population estimates gate (D24).** It follows the module's classification (§3.11), never a `provenance` block alone:

| Module | Shows |
|---|---|
| built-in with `research.population` | `<MasquePopulation embedded baseUrl={env.appBase} indexPath schemaPath mapPath/>`. Brand row and footer are suppressed; the shell provides both. |
| verified derivation (§3.11 row 3) of a built-in that declares population | The same component, plus the banner (engine text, English): "These estimates describe the {rootName} population phenotype measured in public survey files. They use no item weights, so this module's edits do not change them, and they were not recomputed for it." (Q12) |
| uploaded, or derived from an upload | "Population estimates are shown only for built-in modules and modules verified as derived from one." |
| anything else | "No population estimates for this module." |

- **Research readiness.** If `module.research` is absent, the §3.5 message. Otherwise:
  - selector **"Current screen from:"** `[Clinician Screener (hh:mm) | Ambient Scribe (hh:mm) | None]`. The default is the most recent snapshot; with no snapshot it is None.
  - selector **"Captured rows:"** `[Screener (n) | Scribe (m) | Both | None]`. Rows from both apps are never merged silently.
  - the panel, mounted as:

```jsx
<ResearchReadinessPanel research={module.research} project={module.research.projectKey} moduleId={module.id}
  indexName={module.copy.indexName} scaleMax={module.scaleMax} calibrationApplies={calibrationGate(module)}
  calibrationNote={calibrationGate(module) ? null : calibrationSource(module)}   // "MASQUE 0.2" for a derivation of it;
                                                                                // "another rubric's" when there is no root
  rowScope={{moduleId: module.id, instrumentVersion: module.instrumentVersion}}
  noScreen={!snap} routingCleared={snap?.routingCleared ?? true}
  score={snap?.score ?? null} ceiling={snap?.ceiling ?? null} scorable={snap?.scorable ?? false}
  band={snap?.band ?? null} domains={snap?.domains ?? {}} coverage={snap?.coverage ?? 0}
  sex={snap?.sex ?? null} gender={snap?.gender ?? null} phenotype={snap?.phenotype ?? ""} redFlags={snap?.redFlags ?? []}
  itemIds={module.allItems.map(i => i.id)} capturedRows={rows} instrumentVersion={module.instrumentVersion}
  onDataChange={(summary) => onDirty("research", summary)}
  modelVersion={`${module.id}-${snap?.source === "scribe" ? "scribe-" : ""}prototype-${appVersion}`} />
```

- **Panel edits** (WP10, in place, every legacy prop and default kept except `band`):
  - New optional props: `research`, `moduleId`, `indexName` (default `${project} index`), `scaleMax` (default 100), `calibrationApplies` (default `true`, so legacy hosts are unchanged), `calibrationNote` (the root a withheld calibration was set for), `rowScope` (default `null`: no filtering, as today), `routingCleared` (default `true`), `noScreen` (default `false`), `onDataChange` (default no-op).
  - `cfg = research ?? PROJECTS[project]`. An unknown project with no `research` renders an `rrp-error` card "Unknown research project '<key>'" (replaces RRP L773's silent MASQUE fallback).
  - `band` default becomes `null`, rendered "—" and treated as not scorable for the decision.
  - `noScreen`: Current score shows "—" with detail "no screen in this session"; probability and decision are withheld with "No screen in this session — the panel has nothing to score; absent data is not a negative screen."
  - `routingCleared === false`: the decision is "WITHHELD" with the detail "Safety review not recorded in the Ambient Scribe — no routing decision." The probability still shows, as the index does in the Scribe; routing is what the review gates.
  - **`!calibrationApplies` withholds every calibration-dependent figure**, because each of them runs `logistic(r.score, cfg.calibration)`: the live probability and decision (`withheld = abstain || fairnessGate || !calibrationApplies`); sensitivity, specificity, PPV, NPV and accuracy; the Brier score; calibration-in-the-large, the calibration slope and the reliability table; the population "flagged" rate; every fairness verdict, gap and the fairness gate; the equity mitigation; and the `calibration`, `fairnessAudit`, `equityMitigation`, `deploymentGate` and `currentPatientOutput.probability` blocks of the manifest and model card, each replaced by `{withheld: true, reason}`. Each shows "withheld" with the stated reason: "The illustrative calibration was set for {calibrationNote} scoring; this module's scoring differs, so nothing that depends on it is computed." What stays is calibration-free: row counts and data quality, AUROC (rank-based, computed on the raw score), costs, repeat measures and internal consistency.
  - In the same state, **"Load demo cohort"** is hidden with the note "Demo cohorts were generated for {calibrationNote} scoring," and the demo rows' source name reads "illustrative demo rows (scored on {calibrationNote})".
  - **Row scope.** With `rowScope` set, every loaded row (captured, uploaded, demo) is sorted into three counted groups, shown on the Data tab and in the manifest's `cohortState`: rows whose `module_id` and `instrument_version` match the scope; rows naming another module or instrument version, which are **excluded from every computation** and listed by `module_id`/`instrument_version` with counts; and rows with neither column, which are included as today and labelled "provenance unknown". A row is never silently pooled with another instrument's rows.
  - `onDataChange(summary)` reports "n uploaded rows" or "demo cohort loaded" whenever the panel holds rows the user brought in, so a module switch asks first (§5.1).
  - `` `${Math.round(score)}/100` `` becomes `/${scaleMax}`.
  - "The MASQUE index above is unaffected" uses `${indexName}`.
  - Score aliases are built once as `["score", ...(cfg.scoreAliases ?? []), "index"]` (the RRP L198/L217 duplication removed). BREATHE and VOICED gain `scoreAliases ["breathe_score"]` / `["voiced_score"]` so their CSVs still ingest.
  - `parsed[cfg.artifactKey ?? "masqueArtifact"]`; ETL path from `cfg.etlScript`.
  - Fairness axes come from `cfg.fairnessAxes ?? ["sex","gender"]`, with the default axis `[0]`.
  - Filenames use `moduleId ?? project.toLowerCase()`. Manifest and model card gain `module_id` and `scoring_hash`.
  - The default `modelVersion` becomes `${moduleId ?? project.toLowerCase()}-prototype-unversioned`.
  - **"Load demo cohort"** (next to "Restore demo", Data tab): a select over `cfg.demoCohorts` → `normalizeRows(makeCohort(spec))`, with source name = the label.
  - BREATHE and VOICED keep working via `project`. `PROJECTS.MASQUE` stays until WP14 (the legacy pages use it) and is then removed.
  - The `research-parity` suite (§8.3) holds the baseline panel and the edited panel to the same numbers for MASQUE.
- **`MASQUE_Population.jsx` edits (WP10):**
  - Optional props `baseUrl` (default `document.baseURI`), `indexPath`, `schemaPath`, `mapPath` (defaults are the L31-33 constants), `embedded` (hides the brand row L154-160 and the footer L261), `banner` (a node rendered first). Every fetch, the index-listed artifact paths included, resolves against `baseUrl`; screenAIr passes `env.appBase` (D25).
  - The CSS is wrapped with `scopeCss(CSS, ".sa-pop")` and the root becomes `<div className="sa-pop"><div className="pop">`. `population.html` renders identically until WP14.

### 5.7 `RubricEditor({entries, activeKey, env, onApply, onDownloadAll})`

- **Which module.** An **Editing:** select at the top lists every loaded module that validated, defaulting to the active one. Choosing another module here opens its draft **without switching the active module**, so the Screener, Scribe and Patient screens are untouched. The editor's own state survives tab switches like any panel (§5.9).
- **Draft model.** `draft = createDraft(edited)`, autosaved (debounced 1 s) to `localStorage["screenair.draft.v1." + edited.key]` inside try/catch, so a draft is never lost and never blocks a module switch. Opening a module offers "Resume saved draft (date)" when one exists. The draft is a structured clone of the rubric; the edited module is **never** mutated.
- **Layout.**
  - Left nav: Identity & versions · Domains & items · Bands · Red flags · Context items · Patient wording (with a locale switch) · Lexicon · Copy · Logic (read-only) · Downloads.
  - Main pane: forms.
  - Right pane (stacked under the main pane on narrow screens): Validation, Impact preview, Changes.
- **Editable fields** (anything else is read-only, shown with a lock and a reason):

| Section | Editable | Locked |
|---|---|---|
| Identity | `label`, `name`, `copy.indexName` | `id`; `instrumentVersion` and `lexicon.version` (set only in the Apply dialog); `logicBinding` |
| Domains & items | domain `label`, `max` (with a "set max = Σw" action); item `text`, `short`, `ask`, `ref`, `patientClin`, **`w`**; scale option `label` and **`f`**; a new item through the **Add item** form below; delete an item **only** if its id is absent from `logic.reads` (or the logic is generic). Deleting lists every dependent entry (lexicon phrases, sample answers, patient wording) and removes them only after confirmation. | ids; domain and item order; boolean↔scale type; option count/order of any item in `reads`; `negative`; **adding, removing or reordering domains** in v1, because a domain is a Questionnaire group, a screener and patient step, and possibly a `reads.domains` entry ("Change the domain structure in a rubric JSON and upload it") |
| Bands | `cuts.moderate`, `cuts.high` | — |
| Red flags | `text`, `points`, `action`, `group`; patient `q`/`say` per locale. Tier change, add and delete sit behind a confirmation ("This changes the safety gate"); ≥ 1 flag stays enforced; flags in `reads` or `lexicon.redFlags` cannot be deleted (V28 would fail) unless their lexicon phrases are removed in the same edit. A new flag needs at least one cue phrase before Apply (V28). | ids |
| Context items | `text`, option labels, `signal` labels, `gapRule.threshold` | ids, option values, markers, noteOrder |
| Patient wording | per locale: item `q`, `opts`, `ask`, `help`; flag `q`/`say`; context `q`/option labels; step `title`/`heading`/`lede`/`intro`; `ui.sub`, `ui.forYouIf`, `ui.clinicianLede`. A stale marker shows when the English source changed (§3.11). A module without patient wording offers **Create English patient wording**: one form row per item (`q`, and `opts` for scale items) and per flag (`q`, `say`), created with `reviewed:false` and `editedLocally:true`, with V23 and V32 listing what is still missing. | `reviewed` (engine-managed) |
| Lexicon | phrase and cue lists (add or remove strings; lowercase enforced while typing). **The last phrase of a red flag cannot be removed** ("Every red flag needs at least one cue phrase, or speech can never raise it", V28). `negation.window` with the warning "swept against this lexicon (Inv §4.1 #12); the gold set will not have been re-run". A module without a lexicon offers **Create lexicon**: `lang` "en-US", the negation, third-party and historical cue lists and windows copied verbatim from a chosen built-in's lexicon, empty item lists, one empty phrase list per flag (V28 then names every flag still without a phrase) and `goldSet: null`. | `goldSet`, `lang` |
| Copy | every `copy.*` slot | — |
| Logic | read-only summary: routing rule ids and surfaces, summary rule ids, probe count and kinds, `reads`, the logic SHA-256, and "Logic is code; edit it as a .js file and upload it." | everything |

- **Wording the logic depends on.** Every field returned by `acknowledgePaths(edited, validation.info.readsObserved)` stays editable: the clinician text, option labels and patient wording of each item, option, flag and context value in `logic.reads`. Once edited, such a field shows the closures that read it ("Read by: patientSummary.said · mDurTypical; routing · tinnitus") and its own checkbox: **"The new wording keeps the meaning these rules depend on."** Apply stays disabled until every edited field of this kind is acknowledged, and the acknowledged pointers go into the change-log entry (`acknowledged`). The impact preview below shows the sentences those rules produce.
- **Add item form.** Fields: new id (checked live against V11's pattern and the single id namespace), domain (an existing one), type (boolean, or scale with option labels and `f` values, at least one `f` of 0), `w` (its sign must match the domain), clinician `text`; optional `short`, `ask`, `ref`, `patientClin`; English patient `q` (and `opts` for a scale), required whenever the module has `locales.en.items`; and an optional lexicon entry (bool phrases, or scale cue plus bands). The form states up front which rules it must satisfy: V11, V13-V15 (Σw must still equal the domain max, so adjust another weight or use "set max = Σw", which changes the scale and therefore the instrument), V32 and V28.
- **Live validation.** A 250 ms debounce runs `bindModule(draft, editedLogic)` → `validateModule({module, loaded, root})`, where `root` is the edited module's root, or the edited module itself when it has none. Each item is listed as `code · path · message`; clicking one focuses the field (each input carries `data-path` = its JSON pointer). **Apply is disabled while any error exists.**
- **Impact preview** (the same debounce). A table over `edited.sampleCases` (or, with none, the empty state plus all-yes and all-no) with columns: case · total, floor–ceiling, band (parent → draft) · fired routing rules per surface, as rule id and rendered heading `h` (parent → draft) · gap alert · **patient summary**: the `said` and `ask` sentences in en and es (parent → draft). When the edited module is the active one, two rows head the table: **"Current Screener screen"** and **"Current Scribe screen"**, built from the session's latest snapshots (`answers`, `ctx`). Changed cells are highlighted. A note says: "Sample cases and this session's screens only; this is not a validation."
- **Changes pane:** `diffRubrics(edited.rubric, draft)` as JSON pointer · before → after, each with a per-field **Revert**; also **Revert all**.
- **Apply dialog** (`classifyChanges(edited, draft, {root})` first):
  - fields prefilled from `proposeIdentity`: module id; label (default `${root.label} — edited ${date}`, never a built-in's label); instrument version, **locked** to a family member's version when the draft's `instrumentHash` equals that member's (the dialog names it, e.g. "same instrument as MASQUE 0.2"), otherwise editable, prefilled `${root.instrumentVersion}-local.${hash6}`, and required to contain the `-local` tag and to differ from every family version (V53); lexicon version by the same rule; **change note (required)**; author (optional);
  - read-only notices, all against the **root**: "Scoring differs from {root} {version} — the research panel will withhold every calibration-dependent figure for this module" and "The CDS example card written for {root} {version} will be removed" when the scoring differs; "Edited patient wording: {locales} will be marked unreviewed"; "Translations not updated: {locales} will be marked unreviewed and show a notice";
  - acknowledgements: the read-dependent wording above; for every other-locale red-flag `q`/`say` left stale by an English edit (`staleRedFlagPaths`), "The {locale} wording for {flag} was not updated to match the English edit"; safety confirmations for tier changes or flag deletions;
  - **"Remember this module in this browser"**, checked by default (a derived module is JSON only, D20);
  - [Cancel] [**Create module**] [**Create and switch**]. Opened from the upload dialog for **Load as derived**, the same dialog shows [Cancel] [**Prepare module**] instead, and the upload dialog's **Load** registers the result (§5.2).
  - Create: `deriveRubric(...)` → `bindModule` → `validateModule` (must pass) → `onApply({rubric, remember, switchTo})` → registry `register` (origin `derived`) → `saveModule` when remembered → the draft is cleared. The result card shows the new module's label and its `availability` summary. **Create module** leaves the active module and every screen as they are ("Created <label>. Choose it from the Module menu when you want to use it."). **Create and switch** goes through `switchModule`, whose confirmation lists exactly what switching clears (§5.1). The parent stays loaded and unchanged either way.
- **Downloads section:**
  - **Download all modules (.zip)** calls `onDownloadAll()`;
  - **Download this module (.zip)**;
  - **Download rubric (.json)** saves `serializeRubric(edited.rubric)` as `${id}.rubric.json`;
  - **Download logic (.js)**: the source bytes as loaded, or disabled for generic logic.
  - Any download that contains a derived module sets its `downloadedAt`, which clears the unsaved-module notice for it (§5.1).

### 5.8 Download-all (`exportAll.buildExportFiles` + `zipStore`)

`screenair-modules-YYYY-MM-DD.zip` contains every loaded module (built-in, uploaded, derived). A module that failed to load or validate contributes no files; it is listed in the manifest's `failed` array with its error. Entries are sorted and their timestamps fixed, so the same inputs give byte-identical zips. Every fetch goes through `fetchBytes`, which resolves against `env.appBase` (D25):

```
README.txt                         plain text: "Prototype · not for clinical use"; what each file is; how to re-upload
                                   (select the .zip, or a rubric .json together with its .js); that JSON rubrics hold no code;
                                   the five version axes and where each lives; release; generatedAt
manifest.json                      {format:"screenair-export", formatVersion:1, release, contractVersion, generatedAt,
                                    caveat:"Prototype · not for clinical use",
                                    modules:[{key, id, label, name, origin,
                                      versions:{instrument, lexicon, probeSet, goldSet, goldSetLexicon},   // separate fields
                                      hashes:{rubricSha256, logicSha256, instrumentHash, scoringHash, lexiconHash},
                                      classification, provenance, changelog, validation:{errors:0, warnings:n},
                                      files:{"<path>":"<sha256>", …}}],
                                    failed:[{key, label, error, files:{"<name>":"<sha256>"}}]}
<id>/<id>.rubric.json              serializeRubric(module.rubric) — current, including any derived provenance
<id>/<id>.logic.js                 logic source bytes exactly as loaded (absent for generic logic)
<id>/CHANGELOG.md                  generated from rubric.changelog (non-built-ins)
<id>/<doc>                          built-ins: every file in the registry entry's `docs` list (SOURCES.md, README.md,
                                   CHANGELOG.md), byte-for-byte; a listed file that cannot be fetched fails the export
                                   with its path rather than being left out silently
<id>/generated/<filePrefix>-questionnaire-v<instrument>.json   buildQuestionnaire (labelled generated in README)
<id>/generated/<filePrefix>-cds-hooks.json                     buildCdsHooks
<id>/generated/<filePrefix>-data-dictionary-v<instrument>.json buildDataDictionary
<id>/generated/<filePrefix>-cohort-columns.csv                 cohortColumnsCsv
<id>/research/…                    built-ins with research.population only: the index JSON, every artifact it lists,
                                   the schema and the map, fetched byte-for-byte (≈ 160 KB). The 15 files in
                                   data/provenance/ are not copied: nothing names them by path and the host has no
                                   directory listing; README points to app/data/provenance/ and, for the ETL, app/etl/
```

The zip never contains answers, transcripts, cohort rows or any patient data. On the user side, "Upload" accepts this zip back: a derived module verifies against its root (§3.11 row 3) and comes back as a derivation with its badge and population banner, and its `<id>.logic.js`, being the built-in's bytes, binds without running or consent, even on a site with `ALLOW_JS_UPLOAD` off (§3.9). The round-trip suite (§8.3) proves that re-uploading reproduces the same rubrics, logic bytes, classifications and engine outputs.

### 5.9 State ownership and reset

| State | Owner | Module change | Tab change | Persisted |
|---|---|---|---|---|
| registry entries | shell | kept | kept | built-ins re-fetched; remembered derived/JSON modules restored only on click, re-verified (§5.2) |
| active module, tab, mode | shell | — (mode stays clinician) | — | `sessionStorage` (built-in ids only), `#tab=`, `#mode=patient` |
| voice state, stopSignal | shell + Scribe | stop + reset | kept (auto-stop on entering Patient or patient mode) | never |
| Screener / Scribe / Patient screen state, cohorts | each app | reset (key), after a confirmation that lists them | kept (hidden-mounted; hidden and inert in patient mode) | never |
| session store (snapshots, captured rows) | `ModuleWorkspace`'s `SessionProvider` inside `<main key>` | reset | kept | never |
| Patient locale | PatientCompanion | reset to en | kept | never |
| editor draft | RubricEditor | kept per module key | kept | `localStorage` draft (opt-out by Revert all) |
| panel uploads, demo cohort | panel instance | reset, after a confirmation that lists them | kept | never |
| saved / downloaded marks of derived modules | registry | kept | kept | `savedAt` with the saved module; `downloadedAt` for the session |

### 5.10 CSS scoping and the print stylesheet

- **Scoping.**
  - Each app wraps its legacy root in a scoping element: `<div className="sa-app sa-screener"><style>{CSS}</style><div className="mq">…` where `CSS = scopeCss(SCREENER_CSS, ".sa-screener")`. The same pattern applies to `.sa-scribe` and `.sa-pop`.
  - The CSS strings are moved **unedited** (Scr L629-810, Scb L591-716). Inside the scope, `:root` tokens become scoped custom properties. The values are identical in all three, so nothing changes visually.
  - `.mp` (Patient), `.rrp-` (panel) and `.pa-` (PopulationArtifact) are untouched; they are already scoped.
  - The editor's own classes use the prefix `.re-` and the shell's use `.sa-`.
  - The t-css suite asserts that every rule in every app stylesheet starts with its root, that no `:root` exists outside `shell.css.js`, and that duplicate `@keyframes` names are identical.
- **Shell tokens.** `.sa-shell` carries the Screener token set (Scr L630-638), `box-sizing` on `.sa-shell *`, and `color-scheme: light`. On narrow screens the tab bar scrolls horizontally inside itself; the page never scrolls horizontally at 375 px.
- **Print frame.** The shell (and `PatientPage`) wraps `<main>` in `PrintFrame`: `<table class="sa-print-frame"><thead class="sa-print-head"><tr><td>{header text}</td></tr></thead><tbody><tr><td>{main}</td></tr></tbody></table>`. On screen the table, its rows and cells are `display:block` and the `thead` is `display:none`, so layout is unchanged. In print they return to table display, and the `thead` (`display: table-header-group`) **repeats at the top of every page and takes its own space there**, so it never covers the first lines of page 2 onward. A `position: fixed` header does not reserve space after the first page, which is why it is not used. Chromium and Firefox repeat table headers in print; Safari is best effort and checked by hand.
- **Print (`@media print` in `shell.css.js`):**
  - hide `.sa-top .sa-controls`, `.sa-tabs`, `#sa-mic`, the restore banner, the unsaved-module notice, the `PatientModeBar`, dialogs, `.masque-proto`, `.masque-back` and every `[hidden]` panel;
  - `.sa-print-head td { font: 11px/1.4 sans-serif; border-bottom: 1px solid #000; padding-bottom: 2mm }`; `@page { margin: 14mm }`; backgrounds white;
  - the footer is printed once.
  - The print header text is `CAVEATS.prototype`, plus the unreviewed or provenance suffixes from §5.5. While a Patient view is printed the suffix is the **patient** marker (`CAVEATS.patient.*.short`), otherwise the clinician marker. The shell fills it from the active module, the tab or mode, the Patient locale (which `PatientCompanion` reports through `onPrintContext({loc, reviewed, editedLocally, stale})` whenever it changes) and provenance.

### 5.11 `PatientPage({env})` — `patient.html`, the at-home patient page (WP12, M2)

- **Purpose.** A patient fills in the companion at home and prints or downloads the summary to bring to the visit or send ahead (D26). The page offers nothing else.
- **Loading.** `registry.loadBuiltins({env})`, the same verified path as the shell (§3.8). The module is the default built-in, or `?module=<built-in id>` when that names one. Any other value shows "This questionnaire is not available." and never falls back to a different module. Uploads, saved modules and derived modules are not available here: they live only in the clinician's browser session.
- **Renders**, in order: a slim header with the module `name` and the Patient title (no picker, no ⓘ, no badge); the caveat strip (`CAVEATS.prototype`); `PatientCompanion` with `view = projectForPatient(module)` inside the `PrintFrame`; the patient footer of §5.1 patient mode. On a load or validation failure: "The questionnaire could not be loaded. Please try again later.", with the technical detail collapsed.
- **Module graph.** `PatientPage.jsx` imports `PatientCompanion.jsx`, `registry.js`, `chrome.jsx`'s `CaveatStrip` and `PrintFrame`, `shell.css.js` and engine files only. Its graph contains none of `ScreenAIr.jsx`, `ModuleWorkspace.jsx`, `ModulePicker.jsx`, `UploadDialog.jsx`, `apps/Screener.jsx`, `apps/Scribe.jsx`, `apps/ResearchTab.jsx`, `apps/RubricEditor.jsx`, `ResearchReadinessPanel.jsx` or `MASQUE_Population.jsx`, and the page has no link to `screenair.html` or `index.html` (the `pages` and `omissions` suites assert both).
- **No microphone, no persistence.** The page never imports `MASQUE_Voice.js`, and stores nothing (D20).

---

## 6. Loader changes (`app/assets/masque-loader.js`, WP0)

**6.1 New exports `importSource` and `inspectSource`.**

`importSource(source, {filename = "module.js", byteLength = null, maxBytes = null} = {}) → Promise<namespace>` is used for the built-in logic and for every consented uploaded `.js`.

1. If `!window.Babel`, throw `Error("Babel standalone did not load.")`.
2. If the caller passes both `byteLength` (the UTF-8 byte count it measured before decoding) and `maxBytes` (`LIMITS.logicBytes` from the registry), and `byteLength > maxBytes`, throw "too large". The loader does not import `engine/policy.js`: that would create a second instance of it, and `source.length` counts UTF-16 code units, not bytes.
3. Strip a leading U+FEFF before parsing. The caller has already hashed the raw bytes.
4. Parse: `Babel.transform(src, { sourceType:"module", filename, ast:true, code:false, presets:[], babelrc:false, configFile:false })`. A syntax error, **including any JSX** (the react preset is deliberately absent), is rethrown as `` `${filename}: ${err.message}` ``, which carries Babel's `(line:col)`.
5. Walk `ast.program` recursively, skipping `loc`, `start`, `end` and comment keys. **Reject** `ImportDeclaration`, `ExportAllDeclaration`, `ExportNamedDeclaration` with a `source`, `ImportExpression`, and `CallExpression` with `callee.type === "Import"`. The error names each site as `line:col`. Logic files import nothing, not even `react` (A §1 layering rule), so this one rule covers bare and relative specifiers alike.
6. Require an `ExportDefaultDeclaration`, otherwise throw "has no default export".
7. `url = URL.createObjectURL(new Blob([src], {type:"text/javascript"}))`; `try { return await import(url); } finally { URL.revokeObjectURL(url); }`. The **original text** is what runs: no transform output, so the executed bytes are the downloaded bytes.
8. Never call `showError` (the red panel stays for fatal boot errors only), never touch the `graph` cache, and **always throw to the caller**. The caller turns errors into UI.

`inspectSource(source, {filename = "module.js"} = {}) → {format: string|null, importSites: string[], apiRefs: string[], hasDefaultExport: boolean, syntaxError: string|null}` runs steps 3-6 **without executing anything**, so the upload dialog can classify a `.js` and show its risks before consent (§5.2). `format` is read only from a literal: the `format` property (identifier or string key, string-literal value) of the `export default` object expression, or of the top-level `const` object that a bare `export default <identifier>` names; anything else yields `null` ("executable, kind determined after consent"). `apiRefs` lists the V59 identifiers the source references (`window`, `document`, `globalThis`, `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator`, `eval`, `Function`, `import.meta`), so the consent box can show them before anything runs.

This was checked against Babel 7.26.4 (header table): parsing, import detection (including dynamic `import()` as `CallExpression`/`Import`), missing default export, JSX rejection and syntax `line:col` all behave as specified.

**6.2 Parallel dependency builds, with cycle detection.** In `build()`, replace the sequential `for … await build(dep)` (loader L96-100) with collecting the unique specifiers and calling `await Promise.all(specs.map(s => build(s, url)))`. The `graph` cache already stores promises, so a dependency shared by two modules is built once. Because a module's pending promise is cached before its dependencies are built, an import cycle would otherwise wait on itself forever with no error. `build()` therefore keeps a wait-for map of the modules whose dependencies are still building. Before awaiting its dependencies, a module records its edges and searches the map for a path back to itself. Such a path is an import cycle: `build()` throws `Error("import cycle: A → B → A")`, which `boot` paints in the red panel. A chain passed down each call is not enough: two siblings built in parallel can each find the other already pending in the cache. The acceptance check is that every page still reaches `masqueReady` with a clean console, a two-module cycle fixture paints the cycle error, and the Playwright runner records time-to-ready before and after.

**6.3 `boot` props.** `boot({entry, mountId = "root", props = null})` renders `React.createElement(App, props)` inside `StrictMode`. Existing pages pass no props and behave exactly as today.

**6.4 How compiled code reaches the loader (D25).** Compiled code never imports `masque-loader.js`. Importing it by a literal path would compile the loader through itself, whose L24 comment then matches `REL_SPECIFIER_RE` and fails to resolve (header table), and would create a second instance with its own `graph`. A root-absolute path is not rewritten and does not resolve from a `blob:` module either. Each page instead imports the loader natively and injects it:

```html
<script type="module">
  import { boot, importModule, importSource, inspectSource } from './assets/masque-loader.js';
  const env = { loader: { importModule, importSource, inspectSource }, appBase: new URL('./', document.baseURI).href };
  boot({ entry: './src/shell/ScreenAIr.jsx', props: { env } });
</script>
```

- `patient.html` boots `./src/shell/PatientPage.jsx` the same way.
- `tests/dev/*.html` import `../../assets/masque-loader.js`, set `appBase = new URL('../../', location.href).href` and boot their `Mount*.jsx` with `props: {env}`.
- `tests/index.html` imports `../assets/masque-loader.js`, sets `appBase = new URL('../', location.href).href`, loads the runner with `importModule('./harness/runner.js')` and calls `run(env)` (§8.0).
- `env` is created once per page, so its identity is stable for React dependencies. `registry.js`, `UploadDialog`, `ResearchTab`, the harness and every dev mount receive it as an argument or prop.
- `appBase` is always the `app/` folder. Every module-data path (`registry.json`, rubric, logic and doc paths, `research.population`, population artifacts listed in the index, export fetches) is written relative to `app/` and resolved with `new URL(path, env.appBase)`, never against the page. A page can therefore sit at any depth.
- The `static` suite fails on any compiled file that imports `masque-loader.js` by a literal path.

**6.5 Specifier-like text.** `REL_SPECIFIER_RE` runs over the whole transformed text, comments and string literals included (header table). WP0 rewrites the loader's own L24 comment without example specifiers. Every other compiled file follows the §8.0 rule: source text that contains an import (fixtures, rejection cases) is stored as a data file and fetched, never inlined, and the `static` suite checks comments and string literals of compiled files for `from "./`, `import "./` and `import("./` (and `../`).

**6.6 Unchanged:** `importModule(spec, {baseUrl, append})` (including `append` patch keys), `candidates()`, `fetchModule()`, `showError()`. No `blob:` support is added to `importModule`. `importSource` is the only text entry point.

---

## 7. Invariants and gates

Each row gives the mechanism, how it holds for the **built-in**, an **uploaded** and an **edited** module, and the suite that proves it (§8.3). The general rule (Inv §4.1 #2): a mechanism lives in engine or shell code with no module switch. A module can *supply wording for a slot*; it can never *remove a behaviour*.

### 7.1 CLAUDE.md rules

| Rule | Mechanism | Built-in / uploaded / edited | Proven by |
|---|---|---|---|
| Never invent clinical content | Move rule (§3.6). The rubric is generated by the extractor from the baseline constants (§3.8). Logic is verbatim with only free-variable renaming. Reconciliations follow Inv §2 and are logged. `GENERIC_LOGIC` only quotes module text. Patient bins are not realigned. Untranslated strings fall back to English, as today. | Built-in: values suite deep-equal. Uploaded/edited: content is user-authored; it is labelled "not reviewed", edited locales get `reviewed:false`, and the author's note is in the change log. | `values`, `golden`, V38/V39 |
| "Prototype · not for clinical use" on every surface | `CaveatStrip` sits in the shell **outside** `<main>`. The print header repeats on every page. App footers are kept verbatim. The marker is also in the `.txt`/`.html` exports, the zip README and manifest, `screenair.html`'s and `patient.html`'s pill, patient mode and the redirect pages. It is never module data (V38), so no module can drop or reword it. | Identical for all three | `render` (5 tabs × built-in, shape, derived), `print`, `roundtrip`, `pages` |
| Pages stay `noindex, nofollow` | Meta tag on `screenair.html`, `patient.html`, every redirect page and the HTML export; `.htaccess` header unchanged | — | `static` (pages), `pages` |
| Absent data is never rendered as negative data | `computeScore`: `undefined` = unanswered (Scr L369-408); `normalizeAnswer('unsure')`; Scribe Skip writes nothing; cohort `''` for unanswered; the QuestionnaireResponse omits never-asked items; panel `band:null` and the `noScreen` state; the Research tab's "None" source; the generic summary reads only `'yes'` and scale > 0; sample cases may not hold `'unsure'` (V49); the contract has no default-answer field; a phenotype-derivation error never falls back to a default complaint for routing (§3.3); a Scribe screen without a recorded safety review gets no decision in Research (§5.6) | Engine-owned: identical | `sweep`, `golden`, `rules`, `research`, `omissions` |
| Gate, don't warn | `gates.js`; `routingRecs` order; fail-closed closures with `routingError` reaching the referral, the CDS index card, the note and the bundle (D6); the calibration gate over every calibration-dependent figure (§5.6); `signGate`; mandatory safety step (V25) with ≥ 1 flag (V21) and ≥ 1 cue phrase per flag (V28); coverage gate; `notScorable → {cards: []}`; Patient summary withheld on a rule error; capture hidden without a lexicon; the microphone refused while a patient-facing view is shown; consent gate for JS; a modified copy of a built-in loads only as a derivation (§3.11); validation errors refuse to mount | Engine-owned; a module has no field that disables any of them | `rules`, `validate` (mutations), `shape`, `upload`, `research`, `voice` |
| Report the denominator or don't report | The panel's `FAIRNESS_POLICY` is unchanged. `minGroupN`, `minCellN`, `confidence` and `z` cannot be overridden: V37 allows only the three tolerances, and only with attribution. Research selectors show row counts per source, and loaded rows are counted by `module_id` and `instrument_version`, with rows of another module or version excluded and listed (§5.6). Population renders n and suppression as today. | Identical | `research` (demo cohorts show suppression; row scope), `research-parity` |
| Say what a number is | "Illustrative" labels kept. Every calibration-dependent figure is withheld when the calibration does not apply (D8, §5.6). A provenance badge sits next to every score for non-built-ins, with "scores not comparable" when the scoring differs from the root's. Generated artifacts of non-built-ins say what they are: Questionnaire title, publisher, description and `derivedFrom`, CDS service and card source, dictionary `provenance`, bundle Observation note (§3.10). The dictionary types the score as `number 0–{scaleMax}`. The footer shows the axes plus "gold set … not re-run". Derived population carries the "not recomputed" banner. Patient exports are dated. The impact preview says what it covers. | Badges and gates appear only for non-built-ins, so the built-in is unchanged | `editor`, `research`, `render`, `golden` |
| Five version axes distinct | Owners per D9. Shown separately in the footer, `ModuleInfo`, manifest, model card (`modelVersion` + `instrumentVersion` + `module_id`) and cohort rows (`app_version`, `instrument_version`, `module_id`). Label never in identifiers (V7). The family version rule (V53): across the root, the lineage and the loaded family, equal versions mean equal hashes, and a changed instrument or lexicon carries the `-local` tag, so no derivation at any depth prints a plain or official-looking root version (§3.11). | Built-in: 0.4.0 / 0.2 / 0.3.1 / 1.0.0 / 0.2.0 | `golden`, `editor`, `upload`, `roundtrip` |
| Questionnaire URL, code system, CDS id and item ids never renamed | Identity templates, the four systems and `cds.source.url` included, render byte-identical strings for MASQUE; built-in ids, labels, logic ids and the `<id>-` prefix reserved (V8); identity read-only in the editor | Derived and uploaded get their own ids, so their identifiers and code-system namespace differ by construction (V9, V56) | `golden` (Questionnaire/CDS byte-equal), `upload`, `editor` |
| Patient app: no score, band, probability or research capture | `projectForPatient` (§4.12) carrying only the patient provenance set; module-graph exclusion; no `onCapture`/`onScreen` prop; no persistence; exports built from the same projection; V60 on every patient-facing module string and summary output; the standalone `patient.html` and the shell's patient mode, where no clinician tab, score or upload control is reachable (D26) | Identical for every module: the projection ignores fields it does not list, and V60 applies the same patterns to uploaded and edited wording | `omissions` (graph, rendered text, exports; MASQUE, the shape fixture and a derived module with changed scoring), `print`, `pages` |
| Supporting probes never write a scored item; rescue probes stay live while the target reads negative | `engine/probes.js`: `PROBE_KIND.mayWrite === false` enforced by `validateProbes` (V45); `liveProbes` never retires a rescue through `target`; a rescue's own `when` must treat its target's negative answer exactly like no answer over every smoke state (V46 rescue property), which is what keeps it live; `truncateProbes` never truncates safety or rescue | Enforced for uploaded and edited logic too: V45 and V46 run on every module | `probes`, `validate` |
| No TDZ, explicit extensions, allowed bare specifiers, `import React`, UTF-8/LF, side-effect-free modules | Static checks; logic files import nothing (§6); no compiled file imports the loader; the import graph is acyclic, and the loader reports a cycle instead of hanging (§6.2, §6.4) | — | `static`, `pages` |

### 7.2 Inventory §4.1 invariants not covered above

| # | Invariant | Mechanism |
|---|---|---|
| 5 | A band holds across the whole attainable range | `itemBounds` and `computeScore` verbatim (Scr L360-408); `bandFor(floor) === bandFor(ceiling)`; 50k sweep against the baseline (`sweep`). Edits that change weights still go through the same engine. |
| 6 | Red flags sit outside the score and override it; capture may raise, never clear; flags are not negated | No weight field (V22). The extraction red-flag pass is ungated (Ext L231-235, verbatim). `ingestCaptures` only raises. The engine override gate runs first. The clinician may still toggle a heard flag in the Scribe safety tab (Scb L1121-1122, as today). |
| 8 | One instrument, one source of truth | The rubric is the single source for all five tabs, generated artifacts, cohort columns, the probe validator, lexicon ids and patient wording. V13, V15, V28, V32 and V45 replace the import-time drift guards (Scb L558-565, Pat L198-211, L509-520). |
| 9 | The empty label column is the pilot instrument | `screenToCohortRow` leaves `label` and `reference_diagnosis` as `""` (`golden`). |
| 10 | Sex and gender are independent axes | Panel unchanged. Demo cohorts keep the divergent and sub-minimum rows (`cohort-gen`, `research`). |
| 11 | The extractor maps one phrase list to one item | `extraction.js` verbatim; `extraction` parity across three windows. |
| 12 | Gold-set integrity | `goldSet.lexiconVersion`. Editing the lexicon forces a lexicon bump and the footer note "not re-run" (V53). The benchmark itself is out of scope (reference only). |
| 13 | Panel confidence credits nothing the caller did not supply | The `signalQuality` default stays `null`; the Research tab never passes it. |

### 7.3 Inventory §4.2 deliberate omissions

| Surface | Kept by |
|---|---|
| Patient | §7.1 row. Thin summaries refuse (Pat L1003-1019, kept). "Not sure" is first-class. Discriminator reframing is `askBoth`/`askMig` in logic. The unreviewed banner is on every screen and now also on every printed page and export. The at-home page and patient mode show nothing but the companion (D26). |
| Screener incomplete | `buildBundle`: QR `in-progress`, Observation `preliminary` + `dataAbsentReason`, no ServiceRequest. The hatched range, the "Write partial screen to chart" label and "No band, referral, or CDS prompt…" are engine/app text (§3.6). |
| Scribe | Raise-only capture, no negation on flags, routing requires review (`routingGate`), signing blocked (`signGate`), the note opens with SAFETY REVIEW in all three states (`buildNote`), the pool widens when not scorable (`rankSuggestions`). |
| CDS Hooks | `notScorable: {cards: []}` always. The safety card pre-empts the index card (`cdsPreview`). |
| Research panel | Panel engine unchanged (metrics withheld without labels, cost "—", FAIL withholds, suppression, reweighting "not implemented"). Plus the new calibration gate over every calibration-dependent figure, the no-screen and routing-cleared gates, and the row scope by module and instrument version (§5.6). |
| Population | Render-only. Survey data never enters the cohort loader. The schema check refuses bad artifacts (Pop L123-134, unchanged). |
| Probe panel | Phenotype probes record notes only (mayWrite) and score zero. |

### 7.4 Security of uploaded JavaScript

- **Threat.** An uploaded `.js` (alone or inside a zip) is arbitrary code. `importSource` runs its top level inside the screenAIr origin (for the deployed site, `qurrenthealth.com/masque/…`). It can read and alter the DOM and anything typed into the apps, read `localStorage` (drafts, saved modules), make network requests, and patch globals before modules are frozen. **The import and AST checks, freezing and V59 are not a sandbox.** A Worker or iframe sandbox would break the synchronous closures the engine calls (judge 2); that is out of scope for v1.
- **Mitigations, all mandatory:**
  1. Explicit consent per upload, showing the file name, size, full SHA-256 and the V59 API list, which `inspectSource` reads before anything runs (§6.1).
  2. `SITE.ALLOW_JS_UPLOAD` lets the lead disable JS uploads on the public deployment while keeping JSON (Q20).
  3. JS is never written to storage and never auto-executed after reload.
  4. Uploaded modules are permanently badged "Uploaded module — not reviewed" on every clinician tab, export and printed page, and carry the patient provenance line on patient-facing ones.
  5. Built-in logic loads only from same-origin files listed in `registry.json`. An uploaded `.js` whose SHA-256 equals a loaded built-in's logic is never executed: the registry binds the logic object it already has (§3.9).
  6. The upload dialog suggests JSON for untrusted sources.
  7. A restore from `localStorage` trusts only the stored rubric text, and re-runs the full classification and validation on it, because uploaded code could have written to storage (§5.2).
- **JSON uploads are data:**
  - rendered as React text nodes;
  - `richText` recognises only `**bold**`;
  - `fhirHtml` escapes `&` and `<`;
  - `summaryHtml` escapes all five HTML metacharacters;
  - URLs in module data (e.g. `cds.source.url`) are rendered as text, never fetched or linked;
  - the only module-supplied paths ever fetched are `research.population.*`, and only for built-ins or verified derivations of one, under `./data/` or `./etl/` and resolved against `env.appBase` (V37, V54);
  - download names come from the module id slug (V2).
  The `upload` suite injects `<img src=x onerror=alert(1)>`-style strings into every text field of the shape fixture and asserts they render inert.
- **Provenance is integrity, not authentication.** Lineage checks compare hashes against modules the browser has actually loaded (§3.11); nothing is signed. A deliberately forged, self-consistent provenance block can at most earn the "Edited" badge and the root's own population estimates under the banner that says they were not recomputed for the module. It cannot claim a built-in id, label, logic id or identifier namespace, print a plain root version for a different instrument, or make a calibration apply to different scoring.
- **Resource limits:** `LIMITS` (rubric 2 MB, logic 512 KB, zip 20 MB, 20 files). Zip: total uncompressed ≤ 50 MB, ≤ 200 entries, ZIP64 rejected, path traversal rejected.
- **Privacy:** nothing ever leaves the browser except what the browser's speech service receives while the microphone is on (stated on the Scribe's face, Scb L1038-1042). The site has no server endpoint.

### 7.5 New user-facing strings (non-clinical)

Every string this design adds is shell or engine chrome: tab names, "Upload", dialog text, error messages, the clinician and patient provenance caveats, the stale-translation notice, the engine gate fallback, rule-error card, note line and bundle note, `ENGINE_COPY_DEFAULTS`, the research, calibration and population gate messages, the row-scope counts, the microphone toast and indicator text, the tab notes, the patient-mode bar and confirmation, the availability summary, editor labels and acknowledgements, and the zip README. **None of them lives in the MASQUE rubric or logic**, and none names a condition, item or treatment. They are English only. In the Patient tab under `es`, the new caveats render in English with `lang="en"`; a translation is Q16. Labels of patient-tab buttons reuse existing `PATIENT_CHROME` words plus file extensions ("Download (.html)"), so no new translatable word appears there.

---

## 8. Parity harness

### 8.0 Harness contract (fixed here; WP13 commits the skeleton on day 1)

Seven packages write suites while WP13 builds the harness, so its API is fixed in this design rather than discovered.

**Discovery.** `tests/suites/index.json` (WP13, day 1) is the ordered list of every planned suite file: `integrity`, `values`, `golden`, `sweep`, `rules`, `patient`, `extraction`, `probes`, `cohort-gen`, `validate`, `shape`, `render-screener`, `render-scribe`, `render-patient`, `omissions`, `research`, `research-parity`, `editor`, `roundtrip`, `upload`, `static`. `runner.js` loads each at run time with `env.loader.importModule(new URL(path, suitesUrl).href)` inside try/catch. A file that does not exist yet, or fails to compile, becomes that suite's FAIL "not present: <message>"; it never breaks the page. No compiled file names a suite in a literal `import()`, because the loader would build it at compile time (§6.5).

**Suite module.**

```js
export default {
  name: "values",                  // equals the file stem
  owner: "WP13",
  async run(h) { /* … */ return result; },   // SuiteResult; never throws (the runner turns a throw into FAIL with the stack)
};
// SuiteResult = { verdict: "pass"|"fail"|"invalid", n: number, diffs: Diff[], expectedMissing: string[], notes?: string[] }
// Diff        = { path: string /* JSON pointer */, input: any /* replayable */, a: any /* oracle */, b: any /* new */ }
```

**The harness object `h`.**

```js
h.env                                    // {loader, appBase} from the page (§6.4)
h.seed, h.quick                          // ?seed= and ?quick=1 (§8.5)
h.oracle(file) → Promise<namespace>      // tests/baseline/src/<file> with the §8.2 export list appended; MANIFEST.sha256 is
                                         // checked first, and a mismatch makes the calling suite INVALID
h.reference(file) → Promise<namespace>   // reference/fixed-src/<file>, same mechanism (integrity suite)
h.slice(name) → Promise<{fn, params}>    // a SHA-pinned inline-logic slice (§8.2); a hash mismatch is INVALID
h.renderHook(hook, ...args) → value      // createRoot + flushSync into a detached div, outside StrictMode
h.mount(element) → {container, unmount}  // detached container, outside StrictMode
h.text(container, selector) → string     // textContent of a named region (data-testid selectors)
h.diff(a, b, {allow = [], at = ""} = {}) → {diffs: Diff[], observed: Set<string>}
                                         // path-reporting deep diff; `allow` names the ADs whose normalisers apply (§8.4);
                                         // `observed` names the ADs whose difference was actually seen
h.expect(adId, {precondition, observed}) // a detector outcome; precondition && !observed → "expected difference missing"
h.withFixedClock(iso, fn); h.withSeededRandom(seed, fn); h.rng(seed) → () => number      // mulberry32
h.loadBuiltin(id = default) → Promise<{module, validation}>    // registry.loadBuiltins({env: h.env})
h.loadFixture(name) → Promise<{module, validation}>            // binds tests/fixtures/modules/<name>.rubric.json (+ .logic.js)
h.fixture(path, as = "json"|"text"|"bytes") → Promise<any>     // fetched relative to tests/fixtures/, never imported
```

`harness/diff.js` declares each allowed difference as `{id, appliesTo(path), normalise(a, b, ctx) → [a2, b2], detector(input) → boolean}`. Nothing outside that table can widen a comparison (§8.7).

**Fixture text.** Source text that contains an import, a re-export or a dynamic import (the V57 rejection cases, the upload fixtures) lives in `tests/fixtures/modules/*.txt` and is fetched with `h.fixture(…, "text")`. It is never inlined in a compiled module, mutation generators included, because the loader would try to build the specifier it contains (§6.5).

**Playwright specs.** Each `tests/playwright/specs/*.mjs` is `export default async function (page, ctx) → SuiteResult`, with `ctx = {baseUrl, routes, voiceStub, pdfText(buffer) → Array<{page, items: Array<{str, x, y, w, h}>}>, artifactsDir}`. `pdfText` uses the test-only `pdfjs-dist` that `vendor.mjs` packs. `run.mjs` imports every spec file it finds, runs each in a fresh browser context and writes all results to `report.json`.

**Voice stub.** `voice-stub.js` (an init script) installs a fake `SpeechRecognition` and exposes `window.__voiceStub = {emitInterim(text), emitFinal(text, {confidence} = {}), end(), error(code), holdStart(on), releaseStart(), state, lang, starts, instances}`. `state` mirrors the fake recogniser (`idle | starting | started | ended`), and `starts` counts `start()` calls. With `holdStart(true)`, `start()` withholds `onstart` until `releaseStart()`, which stands in for an open permission prompt and keeps `MASQUE_Voice.js` in `starting`. A spec can therefore drive interim and final results, end a session, raise `not-allowed`, switch tabs during `starting`, and assert that no session is live while a patient-facing view is shown.

### 8.1 Baselines

- **Primary oracle (D2):** `app/tests/baseline/src/`.
  - It is a byte copy of the eleven `app/src` files, taken in WP0 **before any change to `app/src`**.
  - `MANIFEST.sha256` (sha256sum format) records them, and the harness checks it first; a mismatch is **INVALID**.
  - `README.md` names the source commit.
- **Secondary oracle:** `reference/fixed-src/`, with each file's SHA-256 pinned in `harness/divergences.js`.
- **Divergence audit** (`integrity` suite). A line diff between `baseline/src/X` and `fixed-src/X` must equal the pinned hunk list taken from `02-app-divergences.md`:
  - Screener: the two hunks at L572 and L961;
  - Scribe: the voice hunks, the skip hunks and the header comment;
  - panel: the PopulationArtifact extraction and the ETL path text;
  - Patient, Extraction, Probes and Simulator: identical.
  Any other hunk means the baseline is not what this design assumes, and the result is INVALID. This replaces "diff against reference": every candidate's mis-enumeration of fixes that already shipped (skip, ctx, voice) is now structurally impossible.

### 8.2 Loading old code without editing it

- **Modules:** `oracles.js` → `env.loader.importModule(new URL("tests/baseline/src/<file>", env.appBase).href, {append: "export { … };"})` (loader API, CLAUDE.md; D25). Baseline relative imports (panel, voice, extraction, probes, PopulationArtifact) resolve inside `baseline/src/` and are built unpatched. The same function serves `new URL("../reference/fixed-src/<file>", env.appBase)` for the audit. Appended export lists:
  - Screener: `ITEMS, DOMAIN_ORDER, ALL_ITEM_IDS, RED_FLAGS, RF_GROUPS, STEPS, SAMPLE_CASES, DEMO_PATIENT, BAND_CUTS, QUESTIONNAIRE_URL, ANSWER_SYSTEM, WEIGHT_EXT, INSTRUMENT_VERSION, APP_VERSION, SITE_SALT, scoreItem, bandFor, itemBounds, useScore, buildQuestionnaire, buildCdsHooks, buildDataDictionary, screenToCohortRow, rowsToCsv, subjectPseudonym, buildBundle`.
  - Scribe: `ITEMS, DOMAIN_ORDER, ALL_ITEMS, ITEM_BY_ID, RED_FLAGS, ASK, VMPATHI_TAG, VMPATHI_INFO, BAND_CUTS, SCRIPT, PATIENT, REQUIRE_SAFETY_REVIEW_TO_SIGN, computeScore, buildQuestionnaire, buildCdsHooks, buildDataDictionary, screenToCohortRow, buildRecs, buildNote, buildBundle, capLabel, shortLabel`.
  - Patient: `ITEMS, DOMAIN_ORDER, P, ES_P, ES_RF, RED_FLAGS, TIER, UI, SUM, CONTEXT_Q, SECTIONS, BLURB, BLURB_ES, REVIEWED, LOCALE_NAMES, buildSummary, askForm, list, summaryText, pFor, rfFor`.
  - Simulator: `makeCohort, COHORTS, SCENARIOS, FULL_HIGH`.
  - Panel: `PROJECTS, FAIRNESS_POLICY, normalizeRows, metrics, calibration, repeatMeasures, population, fairness, equityAdjustment, internalConsistency, dataQuality, fingerprint` (the `research-parity` suite).
  - Population: none; the default export is mounted for the `research-parity` textContent comparison.
  - Extraction and Probes already export what is needed.
- **Hooks:** `renderHook(useScore, answers)`: a throwaway component rendered with `createRoot` + `flushSync` into a detached `<div>`, outside StrictMode (A §6.1, verified by judge 3: 0/2000 mismatches, 132 ms).
- **Inline logic:** **SHA-256-pinned slices** of the baseline text (C §6.1); a hash mismatch is INVALID. Each slice is the exact text between two anchors, which are exact substrings asserted to exist. `slices.js` turns a slice into a function in three steps:
  1. **Wrap** it by shape. A declaration such as `const recs = useMemo(() => {…}, [deps]);` (recs, complaint, suggestions, the active-domain set) becomes `${slice}\nreturn recs;`. Plain statements (the `gapFlags` arrays) become `${slice}\nreturn gapFlags;`. The JSX expression container of the CDS preview (Scr L1329-1349) becomes `return (<React.Fragment>${slice}</React.Fragment>);`.
  2. **Compile** the wrapper with `Babel.transform(wrapper, {presets: [["react", {runtime: "classic"}]], sourceType: "script"})`, so JSX becomes `React.createElement` calls.
  3. **Bind** the result with `new Function(...params, code)`. The parameters are `React`, `useMemo = (f) => f()`, the oracle constants the slice names (for example `RED_FLAGS`, `ITEMS`, `ALL_ITEMS`, `ASK`, `VMPATHI_TAG`, `VMPATHI_INFO`, `DOMAIN_ORDER`) and the component locals it reads (for example `band`, `bandMeta`, `complaint`, `domains`, `answers`, `scorable`, `answered`, `floor`, `ceiling`, `total`, `override`, `emergent`, `activeFlags`, `ctx`, `skipped`, `vmp`). Each slice's parameter list is pinned with its hash.
  A value-returning slice is compared by deep equality. The CDS slice returns an element, which `h.mount` renders so that its `textContent` is compared with the new app's CDS preview region. The slices are:
  - Screener `recs` (Scr L891-952) and `gapFlags` (Scr L873-878);
  - Scribe `complaint` (Scb L846-850), active-domain set (Scb L857-859), `suggestions` (Scb L856-879, with `skipped`) and `gapFlags` (Scb L916-920);
  - the CDS preview (Scr L1329-1349).
- **Determinism:** `withFixedClock("2026-10-01T12:00:00.000Z", fn)` swaps `Date` (subclass) and `Date.now`; `withSeededRandom(seed, fn)` swaps `Math.random`. Both are used around baseline calls. New builders get `now`, `date` and `nonce` instead.
- **Rendered oracles:** baseline app components (`default` exports) mounted into detached containers, comparing `textContent` of named regions (§8.3 `render`). Playwright E2E drives the legacy page and the new page side by side.

### 8.3 Suites (`app/tests/suites/*.js`)

| Suite | Compares / asserts | Inputs | Owner |
|---|---|---|---|
| `integrity` | baseline manifest; fixed-src pins; the divergence audit (§8.1) | files | WP13 (WP0 seeds) |
| `values` | **Rubric and logic data vs baseline constants**, deep-equal:<br>• `domains/items` vs Screener `ITEMS` (text, w, scale, ref, key order);<br>• `short` vs `shortLabel` (29, with n_allo absent); `ask` vs `ASK`; `tag` vs `VMPATHI_TAG`; `infoPrompts` vs `VMPATHI_INFO`;<br>• `redFlags` vs Screener `RED_FLAGS`, plus Scribe `ask`;<br>• `locales.*.items` vs `P`/`ES_P` (and P key order = item order); `locales.*.redFlags` vs Patient flags/`ES_RF`; context vs `CONTEXT_Q`; step titles vs `UI.sections`; ledes vs `BLURB*`;<br>• `PATIENT_CHROME` ∪ rubric `ui` ∪ `CAVEATS` vs `UI` per the §3.7 table;<br>• `logic.locales.*.sum` vs `SUM` (strings deep-equal; template functions compared by output over every reachable argument: `headFreq(1\|2)`, `vertigo(vertigoT[i])`, `days`/`role`, `gap` × 8 combinations, `clinNote("0.2")`, list templates with 1-5 words);<br>• `lexicon` vs the eight Extraction constants;<br>• `logic.probes.list` vs `ALL_PROBES` (all non-function fields, order);<br>• `sampleCases` vs `SAMPLE_CASES` plus `SCENARIOS`/`FULL_HIGH`; `demo` vs `DEMO_PATIENT`/`SCRIPT`;<br>• `research` vs `PROJECTS.MASQUE`; `demoCohorts` vs `COHORTS`;<br>• `bands.cuts`, versions, rendered identity (the four systems and `cds.source.url` included) vs the constants;<br>• `calibrationGate(masque) === true`, so the extractor's stored `scoringHash` equals the binder's `rubricHashes`. | MASQUE module | WP13 (consumes WP1/WP2) |
| `golden` | Questionnaire: byte-equal JSON vs the baseline Screener, and vs the baseline Scribe with **AD6** only. CDS: byte-equal. Dictionary (AD3, AD4). Cohort row (AD2, AD4). Bundle, screener surface (AD1). Bundle, scribe surface (AD6). Note (AD6 when flags are present). `summaryText` en/es (AD4, AD10). CSV header (AD2). Non-built-in fixtures (a verified derivation with changed scoring, an upload): their own code-system namespace; provenance marker and line in the Questionnaire title, publisher and description, `derivedFrom` for the derivation; provenance in the CDS service and card sources and the dictionary; dictionary score type `number 0–{scaleMax}`. | 9 sample cases + empty × rf ∈ {none, rf_asym, rf_thunderclap+rf_asym} × routingCleared ∈ {true, false} | WP13 (WP4/5/6) |
| `sweep` | `computeScore(masque)` vs baseline Scribe `computeScore` (50k) and vs `renderHook(baseline useScore)` (2k), on every output key, including the `open` id order; `scoreItem` and `itemBounds` for every item and value | §8.5 | WP13 (WP3) |
| `rules` | Screener `routingRecs` vs the `recs` slice (h, p, chips). Scribe `routingRecs` vs baseline `buildRecs(band, complaint, domains, scorable && routingCleared, answers)`. Also: `derivePhenotype` vs slice; `activeDomains` vs slice; `rankSuggestions` vs slice (with `skipped`); `gapSignals` labels/alert vs both `gapFlags` slices; `referralFor` vs the baseline bundle referral text; `cdsPreview` vs the preview slice; `captureLabel` vs `capLabel` (AD5/AD6 on redflag captures); `buildNote` vs baseline `buildNote` (AD6). **Fail-closed:** a copy of the MASQUE logic with an injected throwing routing rule, and one with a throwing derive rule, over 2k states each: the rule-error card on both surfaces; `routingError` set; no referral ServiceRequest while the red-flag Flag and ServiceRequest are unchanged; no CDS index card; the note's A&P carries the engine error line and never `noDriver`; the Observation carries the withheld-routing note. | 20k rule states (§8.5) | WP13 (WP3/WP5) |
| `patient` | baseline `buildSummary` vs `buildPatientSummary` (said, ask, gapLine, unsureList, clin) en/es; `askForm` × all ids × locales; `list` lengths 1-5; `summaryText` | 20k Patient states | WP13 (WP6) |
| `extraction` | baseline `extract` vs `extract(masque.lexicon, …)`, deep-equal arrays; baseline `faersToUtterances` vs the engine's on a fixture of FAERS-shaped records (array and `{results}` forms, missing ids, records without reactions or narrative) | 44 gold utterances + demo pt turns + 5,000 synthetic (1-3 lexicon phrases with random negation/third-party/historical prefixes) × includeSuppressed {false, true} × negationWindow {8, 14, 20} | WP13 (WP5) |
| `probes` | baseline `liveProbes` vs `liveProbes(module.logic.probes.list, …)` id sequence; `validateProbes` `[]` under both; `truncateProbes` vs the rail slicing at Scb L1152-1162 | 50k sets × rf × random `answered` | WP13 (WP5) |
| `cohort-gen` | baseline Simulator `makeCohort(kind)` vs `makeCohort(spec)`, deep-equal, three kinds | — | WP13 (WP4) |
| `validate` | MASQUE: 0 errors (expected warnings listed: V12 n_allo; V33 es fallbacks; V51 not raised, because the `sim-*` scenarios rehearse every gate). Shape fixture: 0 errors. **Mutation corpus:** ≥ 1 mutated fixture per code V1-V60, each producing that code at the mutated path; among them a red flag with an empty phrase list (V28), a rescue whose `when` is `a[x] === undefined` (V46 rescue property), a second-generation derivation claiming "0.2" with a changed instrument (V53), a patient string containing "score" (V60). Budget ≤ 300 ms. | fixtures | WP13 (WP3) |
| `shape` | The data-only fixture (2 domains, no negative domain, no phenotypes, en only, no lexicon, no probes, no research) goes through every engine function, and all five tabs render with no console error. Asserted: "No routing rules in this module" card; generic summary quotes `q`; probe rail and capture hidden; no CDS index card; no referral; "No population estimates for this module"; Patient works; the availability summary reads "Ambient Scribe: no voice capture (no lexicon)"; the omission patterns find nothing in its patient output. | fixture | WP13 |
| `render` | Baseline vs generic `textContent` of named regions:<br>• Screener: rail, every step card, ResultView sections, for the 9 sample cases;<br>• Scribe: demo playback step by step (readout, coverage, capture tags, suggestions, probe rail, note);<br>• Patient: every section and the summary, en and es, for 200 seeded answer sets.<br>Allowed differences normalised (§8.4). | — | WP7 / WP8 / WP9 (each its own) |
| `omissions` | **Patient module graph** (fetch sources, collect import specifiers transitively) excludes `scoring.js`, `fhir.js`, `rules.js`, `cohort.js`, `probes.js`, `extraction.js`, `scribe.js` and `ResearchReadinessPanel.jsx`. **Rendered text** of the Safety, domain and Summary sections, the caveat strip and print header while a Patient view is shown, plus `.txt` and `.html` output, with all 12 flags on and every item answered: none of any flag's `text`, `points` or `action`, and no match for any of `OMISSION_PATTERNS` (§4.2: `/\bscor(?:e\|es\|ed\|ing)\b/i`, `/likelihood/i`, `/probabil/i`, `/\b\d{1,3}\s*\/\s*\d{2,3}\b/` and the es forms); the Intro's "What it isn't" box is excluded by `data-testid`. Run on **MASQUE, the shape fixture, and a verified derivation with changed scoring, an edited English locale and a stale es locale**, in the Patient tab, in patient mode and on `patient.html`. | — | WP13 (WP9) |
| `research` | Panel backward compatibility: `project` MASQUE/BREATHE/VOICED without `research` render; an unknown project gives the error card; `band` null → "—"; `noScreen` withholds; `routingCleared: false` withholds the decision only. **Calibration gate:** MASQUE computes; for a verified derivation with changed scoring, every calibration-dependent figure (probability, decision, threshold metrics, Brier, calibration block, flagged rate, fairness verdicts and gate, mitigation, and the matching manifest and model-card blocks) is withheld with its reason, while counts, AUROC, costs, repeat measures and internal consistency stay, and "Load demo cohort" is hidden. **Row scope:** captured rows plus a CSV mixing `module_id`/`instrument_version` values: other modules and versions excluded and counted, rows without the columns included as "provenance unknown". Demo cohorts: balanced → overall PASS, unlabeled → validation withheld + NOT ASSESSABLE, disparate → FAIL + a suppressed stratum (any mismatch with the COHORTS `why` text goes to the lead). **Population gate** for each classification: built-in, verified derivation, derivation from an upload, plain upload, and a forged `derivedFrom` (never shown). | — | WP10 |
| `research-parity` | Baseline panel (`project="MASQUE"`) vs edited panel (`research=module.research`) on identical inputs: the demo rows, the three `makeCohort` kinds, a fixture CSV using the aliases (`masque_score`, `reference_label`, `sex_at_birth`, `survey_weight` …), and several screen props (scorable and not, flags, sex/gender combinations). Deep diff of `normalizeRows`, `metrics`, `calibration`, `repeatMeasures`, `population`, `fairness` on both axes, `equityAdjustment`, `internalConsistency`, `dataQuality` and `fingerprint`, and of the manifest and model-card JSON captured from their download buttons (with `URL.createObjectURL` stubbed), normalising only the AD8 fields (`module_id`, `scoring_hash`, the `modelVersion` default, file names) and AD4. The embedded `MASQUE_Population` vs the baseline component: `textContent` identical outside the brand row and the footer. | §8.5 seeds | WP10 |
| `editor` | Model-level (`derive.js`, `lineage.js`) and UI-level (Playwright):<br>• weight edit → V15 at its path; "set max = Σw" → V17 W;<br>• Apply on an instrument change → new id `local-masque-…`, default label `… — edited <date>`, instrument version with the `-local` tag, new questionnaireUrl, code system and indexCode, every calibration-dependent figure withheld, settled example removed, badge;<br>• a second-generation edit of that module cannot take "0.2" (V53), and one that restores MASQUE's exact instrument is locked to "0.2" with "edited · scoring changed" gone (scoring compared with the root);<br>• Apply on a wording-only change → instrument version locked to the root's, `scoringHash` equal, calibration still applies;<br>• editing the wording of an item the logic reads (m_dur option 2, r_dur patient `q`) blocks Apply until acknowledged, and the impact preview shows the affected patient sentence and routing heading;<br>• lexicon edit → lexicon bump plus the "not re-run" footer; the last cue phrase of a flag cannot be removed;<br>• English edit → es `stale` paths, es `reviewed:false`, the stale-translation notice; an English red-flag edit needs the stale acknowledgement;<br>• Add item: id, domain, type, w and patient `q` checked as typed; domains cannot be added, removed or reordered;<br>• Create lexicon and Create English patient wording on the shape fixture;<br>• editing a non-active module leaves every screen untouched; **Create module** keeps the active module; **Create and switch** confirms with the exact list; current-screen impact rows appear when the edited module is active;<br>• "Remember" (default on) saves the module, and it restores after a reload; without it the unsaved notice and the `beforeunload` prompt appear until a download;<br>• a label equal to a built-in's is refused;<br>• locked fields read-only; Revert and Revert all restore the parent | MASQUE, shape | WP11 |
| `roundtrip` | Download-all → **a fresh registry holding only the built-ins, as after a reload** → `unzip` → `prepareUpload` gives deep-equal rubrics, identical logic bytes and SHA-256, identical hashes and classifications, and identical `computeScore`, `routingRecs`, `buildPatientSummary` and `buildBundle` outputs over a 5k sweep for built-in, uploaded and derived modules, a second-generation derivation included. A re-uploaded derivation is verified (§3.11 row 3): origin `derived`, "Edited" badge, population banner. Its `<id>.logic.js` binds by SHA-256 without consent, also with `ALLOW_JS_UPLOAD=false`. The same zip with one weight changed by hand gives "Load as derived" (row 4); a root record copied onto unrelated content is never a verified derivation; a module that failed to load appears in the manifest's `failed` list without files. Two downloads with a fixed `now` are byte-equal. | — | WP11 |
| `upload` | **Rejections:** import, dynamic import, re-export, JSX, a syntax error (line:col), no default export, logic alone, needs logic, reserved logic id with other bytes, duplicate id, a built-in label, caveat string (V38), template without `{id}` (V9), throwing closure (V46), undeclared read (V47), non-deterministic closure (V48), invalid UTF-8, oversize, zip CRC error, zip traversal, ZIP64, a `.xlsx` and a `.csv` (the spreadsheet message), `research.population` on a plain upload (V37). **Load as derived:** `masque.rubric.json` with three weights changed by hand (reserved id, row 2) → Apply dialog → a derivation whose instrument version carries the `-local` tag; the same file with only the id changed (kin, row 5) → the same path; a forged `derivedFrom` → not verified. **Acceptances:** the shape JSON (generic); a MASQUE-derived rubric JSON with `logicBinding` + SHA; a `screenair-module` `.js`; the zip; identical-bytes dedupe. **Before consent:** `inspectSource` classifies a `.js` whose top level would set a global, and the global is still unset; the V59 API list is shown. Every result card shows the availability summary. Injected markup renders inert. JS consent is required; `ALLOW_JS_UPLOAD=false` refuses JS other than recognised built-in logic. | fixtures | WP12 |
| `static` | t-css (§5.10); t-ids (no MASQUE id, flag, context id, phenotype value, `masque`, `MASQUE`, `masque.example` or label in `src/engine`, `src/ui`, `src/apps`, `src/shell`); layering (engine imports only engine; `src/ui` imports engine, react and lucide-react; apps import engine, `src/ui`, react, lucide-react and only the five shared legacy-path files; shell imports any of those; logic files import nothing); **no compiled file imports `masque-loader.js`**; **every page's import graph is acyclic**; **no comment or string literal in a compiled file contains `from "./`, `import "./` or `import("./`** (or `../`, §6.5); encoding (every text file under `app/` is UTF-8 without BOM, with LF); pages (every `app/*.html` has `noindex, nofollow`) | sources | WP13 |
| `voice` (Playwright) | With the voice stub (§8.0):<br>• Listen shown when a lexicon exists;<br>• an interim result gives a dashed preview and writes no answer; a final result is captured ("· voice" tag);<br>• the indicator appears on the Research tab reading "captures go to the Ambient Scribe"; its Stop works;<br>• entering the Patient tab, or patient mode, stops capture and shows the toast; with `holdStart(true)`, switching to the Patient tab during `starting` and then `releaseStart()` leaves no live session; Listen is disabled while a patient-facing view is shown; a module switch destroys the capture;<br>• `lang === lexicon.lang`;<br>• an insecure-context notice appears with `isSecureContext` forced false;<br>• the shape fixture hides the transport.<br>Fake media flags drive the level meter. | — | WP8 + WP13 |
| `print` (Playwright) | `page.pdf()` of a Patient summary long enough for at least two pages (every item answered, all flags on), en and es, in the Patient tab, on `patient.html` and from the `.html` export, and of the Screener result. On every page, `ctx.pdfText` finds the caveat header as the topmost text, with the es suffix and the patient provenance marker where they apply, and no other text item's box intersects the header's box (nothing is printed under it). The unreviewed banner appears on page 1 in es. With `emulateMedia("print")`: tabs and header controls hidden, and no score or band text in the Patient print DOM. | — | WP9 + WP13 |
| `pages` (Playwright) | Every page healthy (`masqueReady`, `#root` children, clean console); redirects land on `screenair.html` with the right `#tab` (`simulator.html` from M2; `index.html`, `screener.html`, `scribe.html` and `population.html` after WP14); **`patient.html` and `#mode=patient`** render only the Patient Companion, the caveat and the footer, with no `nav.sa-tabs`, `select`, file input, link to `screenair.html` or `index.html`, or omission-pattern match, and `patient.html`'s module graph excludes the §5.11 list; leaving patient mode needs the confirmation; **keyboard**: arrow keys on the closed module select neither open Upload nor switch module, and Enter commits; time-to-ready recorded | — | WP12 + WP13 |

### 8.4 Allowed differences: new generic code vs the frozen baseline

These are the only normalisations the harness applies. Each carries a detector. When the detector's precondition occurs in the matrix but the difference does not, the result is **"expected difference missing" → FAIL** (A §6.3): the fix was not applied. Every AD is appended to `02-app-divergences.md` by WP14.

| Id | Where | Baseline | New | Reason |
|---|---|---|---|---|
| AD1 | Screener-surface bundle | `attainable-range.low = total`; note "bounded to {total}–{ceiling}" (Scr L1526, L1549) | `floor` in both | Inv §7 risk 13. Detector: `floor < total`. |
| AD2 | Cohort rows (both apps), CSV header | no `module_id`; Scribe rows lack `subject_id`, `visit_label`, `gender` (Scb L497) | `module_id` after `app_version`; the Scribe uses the engine (Screener) row | D9; one row builder (Inv §2, FHIR row (f)) |
| AD3 | Data dictionary | no `module_id` or `complaint` entry; "MASQUE index at time of capture"; Scribe download uses the shorter list | `module_id` first, `complaint` before `coverage`; `{indexName} at time of capture` (identical text for MASQUE); one generator for both apps | Inv §2, FHIR row (f) |
| AD4 | Every printed release string | `0.3.0` (`APP_VERSION`, brand rows, footers, `modelVersion`, `app_version`, `summaryText` footer) | `0.4.0` | D21 |
| AD5 | Scribe probe rail "re-asking {id}" (Scb L1169) | raw item id | `itemShort(item)` | Inv §7 risk 13 |
| AD6 | Scribe red-flag wording (safety tab, capture tags, note, bundle Flag/ServiceRequest text, Scribe Questionnaire/dictionary downloads) | Scribe abbreviations (Scb L189-240) | the canonical Screener wording | Inv §2 red flags; CLAUDE.md |
| AD7 | Screener meter zones | 33/33/34 (Scr L1216-1218) | 34/33/33 derived from the cuts | Inv §1.3 (visual only) |
| AD8 | The research-readiness panel | embedded under the Screener and Scribe; `band='low'` default; silent MASQUE fallback; `prototype-0.2` default `modelVersion`; brand score aliases for all projects | in the Research tab with a link card in its old place; `band=null`; no-screen, calibration (over every calibration-dependent figure) and routing-cleared gates; row scope by module and instrument version; unknown-project error; aliases from config; "Load demo cohort"; `module_id`/`scoring_hash` in manifest and model card | D11, Inv §5.4. For MASQUE inputs the computed figures are identical (`research-parity`). |
| AD9 | Population page content | its own page with brand row and footer | embedded in Research (shell chrome); `population.html` redirects after WP14 | D11 |
| AD10 | Patient | unreviewed banner `noprint`; es thin/not-sure ledes English literals (Pat L1010-1012, L1058); `.txt` without the exact caveat line | banner printed; existing `UI.es.thin`/`notSureLede` used; final `Prototype · not for clinical use · YYYY-MM-DD` line (+ patient provenance, edited-wording and stale-translation lines); new `.html` export | D15, Inv §4.5 "every export… on its own face" |
| AD11 | Screener sample rail | 4 buttons | 9 (4 unchanged + 5 `sim-*` scenarios) | D23 (Q3) |
| AD12 | Chrome around the apps | per-page `.masque-back` and pill | shell header, dropdown, caveat strip, tabs, footer, provenance badge, tab notes, patient-mode bar; `patient.html` without the `.masque-back` link | D10, D26 |

**No difference is permitted** in: Questionnaire and CDS output vs the baseline Screener; Screener and Scribe routing copy; scoring; extraction; probes; patient summary content; Scribe note wording outside AD6; the cohort row outside AD2/AD4; bundle text outside AD1/AD6.

### 8.5 Sweeps and matrices

- **PRNG:** `mulberry32(0x4D415351)` ("MASQ"), printed in the report. `?seed=` explores, but the default seed is the acceptance run.
- **Scoring:** 50,000 answer sets in five strata of 10,000, with unanswered probability 0, 0.15, 0.3, 0.6 and 1.0. Booleans are `'yes'|'no'` uniform; scales are uniform over indices. Edge cases are appended: the sample cases, empty, all-max, all-min, only the negative domain answered, everything but one negative item.
- **Rules:** 20,000 states drawn from the scoring stream, each with:
  - complaint ∈ {"", sinonasal, otologic, both};
  - each ctx item unanswered with p .2, otherwise a uniform option;
  - rf: none with p .8, one random flag .15, two .05;
  - safetyReviewed with p .8;
  - Scribe `skipped`: each item with p .1;
  - `vmp` random.
- **Patient:** 20,000 states; each item `undefined` .15 / `'unsure'` .10 / a value .75; ctx in the Patient vocabulary; loc ∈ {en, es}.
- **Report:** per suite N, seed, elapsed, verdict, and the first 20 diffs with a replayable JSON input and a JSON-pointer path. `?quick=1` runs 5k scoring, 2k rules and 2k Patient states for iteration; acceptance is the default run.

### 8.6 How it runs

- **User's machine (Windows, no Node):**
  1. Run `& '…\python.exe' -m http.server 8901 --directory C:\Users\User\Documents\MASQUE` (CLAUDE.md).
  2. Open `http://127.0.0.1:8901/app/tests/` in Chrome or Edge. It runs all suites except the Playwright-only ones. `?suite=<name>` and `?quick=1` are available.
  3. Results are a table plus `document.documentElement.dataset.masqueTests = "pass"|"fail"|"invalid"`.
  4. Manual acceptance (the checklist is printed on the test page):
     - (a) `http://127.0.0.1:8901/app/screenair.html` → Ambient Scribe → Listen; allow the microphone; say "the light really bothers me and I feel sick". The capture tags appear with "· voice". Switch to Patient Companion: the microphone stops.
     - (b) Patient → finish → Print preview of a summary longer than one page: the caveat heads every page and covers no text; in Español the unreviewed banner appears.
     - (c) Rubric Editor → change one weight → Apply with **Create and switch** → the Questionnaire URL and code system in the Screener's spec download have changed; Research shows every calibration-dependent figure withheld.
     - (d) Download all, **reload the page** (do not click Restore), then Upload the zip: "already loaded" for MASQUE, and the derived module loads as a verified derivation with the "Edited" badge and the population banner. Without the reload the derived module would be skipped as already loaded.
     - (e) Open `http://127.0.0.1:8901/app/patient.html`: no tabs, no module menu, no link to the clinician program. Finish the summary, download the `.html`, open it with the network off: the caveat and the date are there.
     - (f) Download the MASQUE rubric, change one weight in a text editor, upload it: the dialog offers "Load as a module derived from Dizziness and Sinusitis (MASQUE v1)", and the result's instrument version carries a `-local` suffix.
- **Cloud (this environment: Node 22, global Playwright 1.56.1, Chromium):**
  1. `python3 -m http.server 8901 --directory /home/user/masque &`
  2. `node app/tests/playwright/run.mjs`. Its steps:
     - `vendor.mjs` runs `npm pack` once for `react@18.3.1`, `react-dom@18.3.1`, `scheduler@0.23.2`, `lucide-react@0.454.0`, `@babel/standalone@7.26.4` and the test-only `pdfjs-dist` (for `ctx.pdfText`) into the gitignored `.vendor/`, and writes ESM shims over the UMD builds.
     - `page.route("https://esm.sh/**" | "https://cdn.jsdelivr.net/**")` serves those shims, because both CDNs answer 403 from this egress; the route was verified by judge 3 on all five current pages.
     - Chromium launches with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`, and `addInitScript(voice-stub.js)` installs a controllable `SpeechRecognition`.
     - It runs `pages`, then the test page (waiting for `dataset.masqueTests`), then the E2E suites (`voice`, `print`, `upload`, `editor`, `roundtrip` UI parts).
     - It writes `report.json` and exits non-zero on FAIL or INVALID.
  The runner is never deployed and changes nothing under `app/` except `report.json`.

### 8.7 What passing means

A package or the whole refactor is green when:

1. **every suite PASSes** on the default seed, with zero unexplained differences and every expected difference observed;
2. **no INVALID** occurs (baseline, reference or slice hashes intact);
3. on the cloud runner the Playwright suites pass and every page is healthy;
4. the user-machine manual checklist (§8.6) has been run once on the final build.

Any difference that is not in §8.4 is a defect, never a reason to widen the normaliser. Widening it requires a design change recorded here and in `02-app-divergences.md`.

---

## 9. Work packages

### 9.0 Order, coupling and the critical path

```
WP0 ──┬── WP1 rubric ───────────────┐
      ├── WP2 logic ────────────────┤
      ├── WP3 engine core ──────────┼── WP7 Screener ──┐
      ├── WP4 engine FHIR/cohort ───┤   WP8 Scribe ────┤
      ├── WP5 engine NLP/probes ────┤   WP9 Patient ───┼── WP12 M2 → M3 ── WP13 final ── WP14
      ├── WP6 engine patient ───────┤   WP10 Research ─┤
      ├── WP12 M1 (legacy shell) ───┘   WP11 Editor ───┘
      └── WP13 harness core (runs alongside, gates every acceptance)
```

- **Critical path:** WP0 → WP11 → WP12-M3 → WP13 (final run) → WP14, about 1.5 + 4 + 1 + 1 + 1 = 8.5 days, with every package coding against the §4/§5 signatures from day 1.
  - WP3 (2.5 days) is near-critical: WP1, WP2 and WP4-WP11 are all accepted against it, so a WP3 slip of more than a day moves the end date.
  - The WP3 → WP8 → WP12-M2 chain finishes about a day ahead of M3.
- **Coupling:**
  - WP0 publishes `engine/contract.js`, the only shared interface definition, and on day 1 commits **every §2.4 engine file and `src/ui/common.jsx`**: its own in full, the rest as stubs with the final export names, each export throwing `Error("not implemented: WPn")`. Every relative import therefore resolves from the first day, which the loader requires (one missing file fails the whole page graph). The owning package replaces the stub's body; nobody else creates or edits that file, so stubs cause no add/add conflicts.
  - Code that needs an unmerged function calls the stub and fails only where it calls it; dev pages and suites report that failure until the owner merges.
  - Packages never edit each other's files. The exceptions are the WP0 stubs above and WP14's retirement edits, listed explicitly.
  - An interface change goes through a PR to `contract.js` that names every affected WP.
  - Every app package ships a `tests/dev/<app>.html` page that mounts its app with the built-in MASQUE module and no shell, so it can be verified alone (B P5). The dev pages load the module through WP12-M1's `registry.loadBuiltins({env})`, with `env.appBase` two folders up (§6.4).
  - The harness API is the §8.0 contract, fixed in this document; WP13 commits its skeleton, `suites/index.json` and the module fixtures on day 1, so WP3 and WP7-WP12 write suites against it from the start.
- **Rule for every WP:**
  - No file is deleted by a glob.
  - No string under `src/engine`, `src/ui`, `src/apps` or `src/shell` names MASQUE or its ids (t-ids).
  - No clinical text is typed by hand: it is extracted, moved or slotted (§3.6).
  - No bundler, no `package.json` dependency and no new bare specifier in anything a page loads. The only npm use is WP13's test-only `npm pack` into the gitignored `.vendor/` on the cloud runner (§8.6), which is never deployed.

### 9.1 WP0 — Foundations (first, single agent, ~1.5 days)

- **Owns:**
  - `app/tests/baseline/**` (byte copy of the eleven `app/src` files + `MANIFEST.sha256` + `README.md`);
  - `app/assets/masque-loader.js`;
  - `app/src/engine/{contract,vocab,policy,hash,css,download,prng}.js`, and the day-1 stubs of every other §2.4 engine file (§9.0);
  - `app/src/ui/common.jsx` (`SessionProvider`, `useSession`, `ProvenanceBadge`, `TabNote`);
  - `app/tests/loader-check.html` (local; later folded into WP13);
  - the root `.gitignore` additions.
- **Assumes:** nothing.
- **Provides:**
  - §4.2 and §4.3 exactly, including `hashProjections` and `rubricHashes`, the one implementation of §3.10's hashes;
  - `importSource`, `inspectSource`, `boot` props, parallel builds with cycle detection, and the loader comment without example specifiers (§6);
  - JSDoc typedefs for every type named in §3-§5: Rubric, Logic, Reads, RoutingRule, SummaryRule, Probe, Module, PatientView, ScreenSnapshot, RoutingState, PhenotypeState, ActivationState, PatientState, ValidationReport, RegistryEntry, Provenance, AncestorRecord, Classification, Availability, Env, SessionApi.
- **Done when:**
  1. The baseline is byte-identical to `app/src` at the WP0 parent commit, and the manifest verifies in the browser. **This commit lands before any other change to `app/src`.**
  2. `importSource`:
     - accepts a closure-bearing file with non-ASCII text;
     - rejects import, dynamic import, re-export and JSX;
     - reports a syntax error as `file: msg (l:c)` and rejects a file with no default export;
     - runs the original bytes, checked through a function's `toString()` equalling the source substring;
     - never paints the red panel.
  3. Every existing page still reaches `masqueReady` with a clean console. Time-to-ready is recorded before and after the parallel-build change.
  4. `sha256HexSync` equals `crypto.subtle` on 20 vectors (empty, "abc", 1 MiB, non-ASCII).
  5. `scopeCss` outputs for the Screener, Scribe and Population CSS are deterministic and committed as test expectations.
  6. Engine files import only engine files and have no side effects.
  7. `inspectSource` reports `format` from a literal default export without executing the file (a top-level side effect stays undone) and lists the V59 identifiers. A two-module import cycle paints "import cycle: A → B → A" instead of hanging, also when the two are siblings built in parallel. `boot({…, props})` passes the props to the root. Compiling `masque-loader.js` through `importModule` no longer finds a specifier in its comments.
  8. Every §2.4 file and `src/ui/common.jsx` exist (stubs included), and a page importing all of them compiles.
  9. `rubricHashes` is deterministic across key orders and treats an absent key and `negative: false` exactly as §3.10 says.

### 9.2 WP1 — MASQUE `masque.rubric.json` (~1.5 days)

- **Owns:** `app/modules/masque/masque.rubric.json`, `app/modules/masque/SOURCES.md`, `app/tests/tools/extract-rubric.{html,js}`.
- **Depends on:** WP0.
- **Assumes:** contract typedefs; `importModule(…, {append})`; WP0's `rubricHashes`, imported by the extractor to compute `research.calibration.appliesTo.scoringHash` (never a second implementation of the projection); the §3.6 and §3.7 tables.
- **Provides:** the rubric of §3.2 and §3.8.
- **Done when:**
  1. The `values` suite is green on every rubric field.
  2. `validateModule` (WP3), with WP2's logic, reports zero errors; the expected warnings are only those listed in §8.3.
  3. Regenerating with the tool reproduces the file byte-for-byte: UTF-8 without BOM, LF, 2-space JSON, no `\u` escapes.
  4. `SOURCES.md` maps every top-level field and every copy slot to baseline file:lines.
  5. The six reconciliation entries are present.
  6. The only hand-written values are the label (user requirement); `id`, `name` and `icon`; the identity templates, systems included (each a literal with `{id}`/`{instrument}` substituted, verified by rendering back to the literal); the population paths (Pop L31-33); the registry `docs` list; `goldSet.lexiconVersion`; `lang`; and the change-log notes.
  7. `calibrationGate(masque) === true` in `values`: the stored `appliesTo.scoringHash` came from WP0's `rubricHashes`.

### 9.3 WP2 — MASQUE `masque.logic.js` (~1 day)

- **Owns:** `app/modules/masque/masque.logic.js`.
- **Depends on:** WP0.
- **Assumes:** the §3.3 state shapes and helpers; `importSource` constraints (no imports).
- **Provides:** the logic of §3.3 and §3.8, including the complete `reads`.
- **Done when:**
  1. The `rules`, `patient` and `probes` suites are green with zero diffs.
  2. V40-V48 report zero errors: `reads` complete, closures deterministic, smoke-clean.
  3. `importSource` accepts the file.
  4. The header comment maps every block to baseline lines.
  5. A text diff of every `SUM` and probe block against the baseline shows only the wrapping lines. Routing copy strings are byte-identical per surface.

### 9.4 WP3 — Engine core (~2.5 days)

- **Owns:** `app/src/engine/{scoring,evaluate,rules,gates,bind,generic,validate,lineage}.js` (replacing WP0's stubs), `app/tests/suites/validate.js`, `app/tests/fixtures/mutations/**` (the mutation corpus, one generator per code).
- **Depends on:** WP0.
- **Assumes:** §4.2 and §4.3, the §8.0 harness contract and WP13's day-1 shape fixture.
- **Provides:** §3.4, §3.5, §3.11 (classification and the family rule), §4.4-§4.6, §4.13, §4.14, §4.16.
- **Done when:**
  1. `sweep` reports 0 mismatches at 50k (Scribe `computeScore`) and 2k (Screener `useScore` via renderHook).
  2. `rules` is green, together with WP2, including its fail-closed cases.
  3. The mutation corpus produces every code V1-V60 at the mutated path.
  4. The shape fixture validates with zero errors.
  5. `bindModule` is deterministic: same bytes, same hashes, same frozen structure.
  6. The fail-closed behaviour of §3.3 is unit-tested for each family on both surfaces, including a throwing derive rule: rule-error card, `routingError` set, `referralFor`, `referralGate` and the CDS index preview withheld.
  7. `classifyLineage` is unit-tested on every §3.11 row: duplicate, reserved id, verified derivation, failed verification (content changed, root record mismatched, logic binding changed), derivation from an upload, kin without provenance, plain upload, and a forged `derivedFrom`.
  8. Validation stays within its budget of 300 ms.
  9. A reviewer confirms in the PR that `ENGINE_COPY_DEFAULTS` names no condition.

### 9.5 WP4 — Engine FHIR and cohort (~1 day)

- **Owns:** `app/src/engine/{fhir,cohort}.js`.
- **Depends on:** WP0. Uses WP3 `computeScore`, `referralFor`, `bandRangeText` and `scaleMaxOf` (stub until merged).
- **Provides:** §4.7 and §4.8.
- **Done when:**
  1. `golden` is green with only AD1/AD2/AD3/AD4/AD6. The Questionnaire and CDS document are byte-equal to the baseline Screener's, with the systems now rendered from `{id}` templates.
  2. `cohort-gen` is deep-equal for all three kinds.
  3. Derived and uploaded modules produce `{id}`-rendered identifiers and systems, the Observation provenance note, and the provenance marker and line in the Questionnaire, CDS discovery and dictionary; a verified derivation's Questionnaire carries `derivedFrom`.
  4. `buildBundle` with `routingError` emits no referral ServiceRequest, keeps the red-flag resources, and adds the withheld-routing note.

### 9.6 WP5 — Engine extraction, probes, scribe (~1.5 days)

- **Owns:** `app/src/engine/{extraction,probes,scribe}.js`.
- **Depends on:** WP0. Uses WP3 `activeDomains` and `evaluateRules`.
- **Provides:** §4.9-§4.11.
- **Done when:**
  1. `extraction` is green across 44 gold, transcript and 5k synthetic utterances × 2 × 3.
  2. `probes` is green.
  3. The suggestions, capture-label and note parts of `rules` are green (AD5/AD6 only).
  4. The new `validateProbes` rules are covered by negative fixtures (a rescue with a target; a phenotype option that writes).
  5. `buildNote` with `routingError` prints the engine A&P line and never `copy.note.noDriver`; `faersToUtterances` matches the baseline in `extraction`.

### 9.7 WP6 — Engine patient (~1.5 days)

- **Owns:** `app/src/engine/patient.js`.
- **Depends on:** WP0. Uses WP3 `evaluate.js` only.
- **Provides:** §4.12 and the §3.7 chrome split.
- **Done when:**
  1. `patient` is green for en and es.
  2. The chrome mapping in `values` is green.
  3. Its import graph is {`evaluate.js`, `vocab.js`, `policy.js`}.
  4. `summaryHtml` has unit tests for escaping all five metacharacters, caveat and banner presence, the patient provenance and stale-translation lines, the repeating `<thead>` caveat header, no scripts or URLs, and `OMISSION_PATTERNS`.
  5. The generic summary quotes `q` verbatim and produces no `ask`.
  6. `projectForPatient` never carries `CAVEATS.scoringChanged` or any clinician provenance line; `summaryText` ends with the dated caveat line.

### 9.8 WP7 — Clinician Screener (~2 days)

- **Owns:** `app/src/apps/{Screener,SampleRail}.jsx`, `app/tests/dev/{screener.html,MountScreener.jsx}`, `app/tests/suites/render-screener.js`.
- **Depends on:** WP0. Codes against WP3/WP4 signatures and is accepted after they and WP1/WP2 merge.
- **Provides:** §5.3.
- **Done when:**
  1. `render` (Screener) is green, with only AD4/AD7/AD8/AD11 normalised.
  2. Capture appends a row containing `module_id` and throws nothing.
  3. Nine sample buttons in two groups.
  4. Spec downloads are named per `filePrefix` and byte-equal to the engine builders.
  5. The link card is present; no probability anywhere.
  6. t-ids and t-css are clean.
  7. The shape fixture renders (no picker, no context, the engine fallback card).
  8. The dev page is healthy.
  9. The snapshot carries `safetyReviewed`, `routingCleared`, `answers` and `ctx`; the tab note is shown; a routing error withholds the referral and the CDS index card.

### 9.9 WP8 — Ambient Scribe with microphone (~2 days)

- **Owns:** `app/src/apps/Scribe.jsx`, `app/tests/dev/{scribe.html,MountScribe.jsx}`, `app/tests/suites/render-scribe.js`, `app/tests/playwright/specs/voice.mjs`.
- **Depends on:** WP0. Codes against WP3/WP4/WP5; accepted after WP1/WP2.
- **Provides:** §5.4.
- **Done when:**
  1. Demo playback step by step matches the baseline (readout, coverage, capture tags, suggestions, probe rail, note), with AD4/AD5/AD6 only.
  2. Skip writes nothing.
  3. The sign gate holds; routing is withheld until review.
  4. `voice` E2E is green, and the manual microphone check on localhost Chrome/Edge passes (§8.6 a).
  5. A missing lexicon hides the transport.
  6. The `pagehide`, unmount and `stopSignal` stops are all verified.
  7. `lang` comes from the lexicon.
  8. With `micAllowed` false, Listen is disabled, and a capture that reaches `starting`, `listening` or `restarting` is destroyed at once (voice-stub `holdStart` case).
  9. A throwing derive rule gives the rule-error card, the note's engine A&P line and a bundle without a referral.

### 9.10 WP9 — Patient Companion with download and print (~1.5 days)

- **Owns:** `app/src/apps/PatientCompanion.jsx`, `app/tests/dev/{patient.html,MountPatient.jsx}`, `app/tests/suites/render-patient.js`, `app/tests/playwright/specs/print.mjs`.
- **Depends on:** WP0 and WP6; accepted after WP1/WP2.
- **Provides:** §5.5.
- **Done when:**
  1. `render` (Patient) is green for en and es with AD4/AD10 only.
  2. `omissions` is green: graph, rendered text and both exports.
  3. `print` is green.
  4. The `.html` export opens with the network disabled and makes no request (Playwright offline), and shows the caveat (and the es banner); printed, it repeats its caveat header on every page.
  5. Print and both downloads are disabled when the summary rules fail.
  6. `onPrintContext` is reported, including `stale`.
  7. Both exports carry the generation date; patient provenance, edited-wording and stale-translation lines appear where they apply and never a clinician provenance line.

### 9.11 WP10 — Research tab, panel and population (~2 days)

- **Owns:** `app/src/apps/ResearchTab.jsx`, `app/src/ResearchReadinessPanel.jsx` (edits per §5.6), `app/src/MASQUE_Population.jsx` (edits per §5.6), `app/tests/dev/{research.html,MountResearch.jsx}`, `app/tests/suites/{research,research-parity}.js`.
- **Depends on:** WP0, WP3 (`calibrationGate`, `classifyLineage`) and WP4 (`makeCohort`).
- **Provides:** §5.6.
- **Done when:**
  1. The `research` and `research-parity` suites are green: for MASQUE inputs every computed figure, verdict, manifest and model card matches the baseline panel outside AD4/AD8, and the embedded population matches the baseline page outside its brand row and footer.
  2. Because the panel and population edits are backward compatible, the legacy `screener.html`, `scribe.html` and `population.html` still render textContent-identical to the baseline.
  3. The population gate works for each classification, and the population page renders from `tests/dev/research.html` through `baseUrl`.
  4. With the calibration not applying, every calibration-dependent figure is withheld with its reason; row scope and the routing-cleared decision gate behave as §5.6 says.
  5. The demo-cohort verdicts are checked, and any mismatch with the `why` text is reported to the lead (Q26).

### 9.12 WP11 — Rubric Editor and Download-all (~4 days)

- **Owns:** `app/src/apps/RubricEditor.jsx` (including the exported `ApplyDialog`), `app/src/engine/{derive,zip,exportAll}.js`, `app/tests/dev/{editor.html,MountEditor.jsx}`, `app/tests/suites/{editor,roundtrip}.js`, `app/tests/playwright/specs/editor.mjs`.
- **Depends on:** WP0, WP3 (`bindModule`, `validateModule`, `lineage.js`) and WP4 (generated artifacts).
- **Provides:** §4.15, §5.7, §5.8, and the derivation half of §3.11.
- **Done when:**
  1. `editor` and `roundtrip` are green.
  2. The zip passes `unzip -t` (cloud) and opens in Windows Explorer (manual).
  3. Two exports with a fixed `now` are byte-equal.
  4. Locked fields cannot be edited; acknowledgement-gated fields block Apply until acknowledged.
  5. Apply is impossible while errors exist.
  6. The derived-module rules of §3.11 are each asserted, the family version rule at the second generation included.
  7. Editing a non-active module and **Create module** leave every screen untouched; **Create and switch** goes through the confirmation; a remembered module restores after a reload.

### 9.13 WP12 — Shell, module picker, upload and pages (~3.5 days over three milestones)

- **Owns:** `app/src/shell/*`, `app/screenair.html`, `app/simulator.html`, `app/index.html` (until WP14), `app/patient.html` (from M2), `app/modules/registry.json`, `app/tests/suites/upload.js`, `app/tests/playwright/specs/{pages,upload}.mjs`.
- **M1, legacy shell (right after WP0):**
  - `screenair.html` plus `ScreenAIr.jsx` mounting the **legacy** default exports for tabs 1-4 (`MASQUE_Screener_v0_3.jsx`, `MASQUE_Scribe_v0_3.jsx`, `MASQUE_Patient_v0_3.jsx`, and `MASQUE_Population.jsx` for Research). Only the active tab is mounted, because legacy CSS is unscoped. The Rubric Editor tab shows "Available when the module engine lands".
  - **The M1 `ScreenAIr.jsx` imports neither `registry.js` nor any WP3 file**, so `screenair.html` works whatever has merged. It switches to the registry at M2.
  - The dropdown holds the MASQUE label and a disabled "Upload".
  - Caveat strip, version footer, print frame and CSS.
  - `index.html` leads with screenAIr and a "For patients" card. `simulator.html` keeps mounting the legacy Simulator until M2 (D18).
  - Known M1 limits, stated on the page: the microphone stops when you leave the Scribe tab, tab switches lose state, and the Simulator's scenarios and demo cohorts are still on `simulator.html`.
  - `shell/registry.js` `loadBuiltins({env})` (the §3.8 load path) and `app/modules/registry.json`, coded against the WP3 signatures and WP0's stubs. The WP7-WP11 dev pages load the built-in module through it, and it works as soon as WP3 merges. The upload functions and saved modules come at M3.
- **M2, generic apps (after WP7-WP10 and WP3):**
  - the shell switches from the legacy components to `registry.loadBuiltins` and the generic apps inside `ModuleWorkspace`, mounted lazily and kept hidden;
  - the session store, `MicIndicator` and the auto-stop rules with `micAllowed`, `ProvenanceBadge` and `TabNote` from `ui/common.jsx`, `ModuleInfo`, `InvalidModule`, `ConfirmDialog` with the itemised list, hash routing, the keyboard-safe picker;
  - patient mode and the `PatientModeBar`; `patient.html` boots `PatientPage.jsx`;
  - `simulator.html` becomes a redirect.
- **M3, upload and editor (after WP11):** `UploadDialog` and the upload path with `inspectSource`, built-in logic recognised by SHA, `classifyLineage` and "Load as derived"; availability cards; Rubric Editor wiring (`onApply`, `onDownloadAll`, Create and Create and switch); saved-module restore with re-verification; the unsaved-module notice and `beforeunload`.
- **Done when:**
  1. `upload` and `pages` are green.
  2. `shape` renders all five tabs.
  3. A scripted module switch resets every app, with the dirty confirmation listing Screener answers, Scribe transcript, Patient answers, captured rows and Research uploads.
  4. The caveat appears on all tabs, in patient mode, on `patient.html` and in print, with the patient wording on patient-facing views.
  5. No horizontal scroll at 375 px.
  6. Time-to-ready on the cloud runner is ≤ 3 s.
  7. The dropdown's first two options are exactly "Dizziness and Sinusitis (MASQUE v1)" and "Upload".
  8. No clinician tab, score, band or upload control is reachable on `patient.html` or in patient mode.

### 9.14 WP13 — Parity harness and browser tests (starts after WP0; finishes last; ~3.5 days)

- **Owns:**
  - `app/tests/index.html`;
  - `app/tests/harness/*`;
  - `app/tests/suites/{integrity,values,golden,sweep,rules,patient,extraction,probes,cohort-gen,shape,omissions,static}.js`;
  - `app/tests/fixtures/modules/*`;
  - `app/tests/playwright/{run.mjs,vendor.mjs,voice-stub.js}`.
- **Depends on:** WP0 to start; each suite turns green when its WP lands.
- **Day 1 (before any other package needs them):** the §8.0 harness skeleton (`runner.js` with run-time suite loading, the `h` API with working `oracle`, `fixture`, `loadBuiltin`, `mount` and `diff`), `tests/suites/index.json`, `tests/index.html`, the shape fixture and the placeholder module fixtures, and the voice-stub API. WP3's, WP7's and WP12's acceptance runs against them.
- **Provides:** §8. Suite skeletons and oracles come early so WP1-WP12 can run their acceptance.
- **Done when:**
  1. Every §8.3 suite exists and is green on the final tree.
  2. INVALID is demonstrated by tampering with a copy of a baseline file in a temporary path.
  3. "Expected difference missing" is demonstrated with a deliberately unapplied AD1 on a scratch branch.
  4. The cloud runner passes end to end.
  5. The user-machine checklist is printed on the test page.

### 9.15 WP14 — Docs and retirement (last; ~1 day)

- **Owns:**
  - `docs/refactor/02-app-divergences.md` (append the screenAIr section: AD1-AD12, new files, retired files, version label);
  - `docs/refactor/04-module-authoring.md`;
  - `app/modules/masque/{CHANGELOG,README}.md`;
  - `app/data/README.md` (one sentence);
  - `app/{screener,scribe,population}.html` and `app/index.html` (become redirects; `patient.html` stays the standalone patient page, D26);
  - appending `README.md` and `CHANGELOG.md` to the MASQUE entry's `docs` in `app/modules/registry.json`;
  - deleting **exactly** `app/src/MASQUE_Screener_v0_3.jsx`, `MASQUE_Scribe_v0_3.jsx`, `MASQUE_Patient_v0_3.jsx`, `MASQUE_Simulator.jsx`, `MASQUE_Extraction.js` and `MASQUE_Probes.js`;
  - removing the `PROJECTS.MASQUE` block from `ResearchReadinessPanel.jsx`;
  - the proposed CLAUDE.md "Layout" text, in the PR description for the lead.
- **Depends on:** everything green.
- **Done when:**
  1. The full suite is green after retirement (the baseline remains the oracle).
  2. Nothing imports a retired file.
  3. Every page is healthy and every redirect lands on the right tab; `index.html` lands on `screenair.html`, whose `ModuleInfo` About section carries the launcher's description, notice and versions.
  4. `MASQUE_Voice.js`, `PopulationArtifact.jsx`, `MASQUE_Population.jsx`, `MASQUE_SchemaCheck.js` and `ResearchReadinessPanel.jsx` still exist.
  5. `tests/population-artifact-check.html` works.
  6. The lead has answered or accepted the defaults in §10.

---

## 10. Open questions for the clinical lead

The implementation must not decide these. Each ships with the stated default, which is logged in `rubric.changelog` or `02-app-divergences.md` so it can be reversed.

| Q | Question | Default meanwhile |
|---|---|---|
| Q1 | The dropdown label "Dizziness and Sinusitis (MASQUE v1)" says "v1" and "Sinusitis", while the instrument is 0.2 and screens for masked migrainous or neuropathic drivers in recalcitrant sinonasal and otologic presentations. Keep it exactly? | Exactly as the user specified; display only; the footer shows the real axes. |
| Q2 | Release number for this build: 0.4.0 or 1.0.0 ("final MVP")? This also settles the 0.3.0-vs-0.3.1 label drift (Div, "Version labels"). | `APP_VERSION = "0.4.0"`. |
| Q3 | Show the five Simulator scenarios as extra sample buttons? Their `why` text describes historical defects. | Shown under "Scenarios", with `why` as the tooltip. |
| Q4 | The Simulator's "What to notice" walkthrough rails: carry them as optional module copy behind a toggle, or drop them? | Not carried; they remain in `reference/` and the baseline. |
| Q5 | Scribe red flags: canonical Screener wording, or keep the Scribe's abbreviations as a second clinician copy? | Screener wording (AD6). |
| Q6 | The red-flag `ask` field (Scribe, never read): keep, drop, or wire it in as the Scribe safety-tab phrasing? | Kept as unread data. |
| Q7 | "Not Barany criteria; contribute nothing to the index. Instrument v0.3 candidates." in the Scribe note carries a version number no axis owns. Keep or reword? | Verbatim. |
| Q8 | Patient context options keep the Patient's own values and labels, not realigned to the Screener bins. Confirm? Realigning would need new en/es patient strings that the lead authors. | Not realigned (V20 guarantees the gap rule still fires). |
| Q9 | Patient strings that are English today even under es (Intro, story heading and lede, safety headings and buttons, context questions, "Get seen today/this week", clinician paragraph, disclaimer, footer): translate now (needs a reviewer) or ship as today? | As today; listed as V33 warnings. |
| Q10 | Sign-off on `GENERIC_LOGIC` for data-only rubrics (a patient summary that quotes the module's own item wording; the neutral fallback card; no CDS index card; no referral) and on the `ENGINE_COPY_DEFAULTS` wording. | Implemented as specified (§3.5). |
| Q11 | Which edits create a new instrument version: is the `instrumentHash` scope (§3.10) right, including red-flag text and points and the Questionnaire strings? | As specified. Patient wording, lexicon, context labels and copy edits keep the version. |
| Q12 | Population estimates for a module verified as derived from MASQUE (§3.11): show the root's with the "not recomputed" banner, or hide them? | Shown with the banner. |
| Q13 | Bundle wording differs by surface (Screener "({band} likelihood)" and "Index is bounded to…", plus the routing-override component; Scribe "({band})" and "Index bounded to…"). Keep both or unify (and on which)? | Both kept, verbatim. |
| Q14 | Probe truncation: 2 (Scribe) or 3 (Simulator)? | 2. |
| Q15 | Stop the microphone automatically when the Patient Companion tab opens? | On. |
| Q16 | New shell caveats are English only: uploaded, edited, the patient provenance lines, edited wording, stale translation, calibration withheld, population not recomputed, microphone stopped, patient mode. Spanish versions need a translator and a reviewer. | English with `lang="en"`. |
| Q17 | The Scribe "re-asking" line shows the short label instead of the raw item id (AD5). Confirm? | Short label. |
| Q18 | Deployment: does screenAIr replace `/masque/demo/` (today's `app/`) or go to a new path, and is the M1 build deployed? An M1 deploy keeps `simulator.html` live (it redirects only from M2), so nothing is lost; `index.html` becomes a redirect to screenAIr in WP14 (D27). | Lead's decision. Pages resolve module data against `appBase`, so either path works. |
| Q19 | Meter zone widths: derived 34/33/33 (AD7) or the typed 33/33/34? | Derived. |
| Q20 | Allow JavaScript module uploads on the public deployment (`SITE.ALLOW_JS_UPLOAD`)? | `true` (user decision), behind the consent gate. The lead may set it to `false` for the public site. |
| Q21 | When an edit changes scoring, remove the CDS "settled" example card ("78/100 — high likelihood…"), or keep it with a warning? | Removed. |
| Q22 | Any scoring change withholds the illustrative probability. Should an attributed calibration override be allowed (like the tolerance override)? | Withheld; no override in v1. |
| Q23 | A link card replaces the embedded panel under the Screener and Scribe. Keep a compact embedded panel as well? | Link card only. |
| Q24 | `n_allo` has no Scribe short label, so capture tags and the note show "n_allo", as today. Author one? | Unchanged. |
| Q25 | Licensed instruments (VM-PATHI, SNOT-22, DHI, HIT-6, MIDAS, ID Migraine, THI/TFI, SFN-SIQ, COMPASS-31) must not be embedded (Inv §4.5). The editor and upload cannot detect pasted licensed items. Is a reminder enough? | A one-line reminder in the editor and the upload dialog. |
| Q26 | If the panel's verdicts on the Simulator demo cohorts differ from the COHORTS `why` text, which wins? | The panel's computed verdict is shown; the `why` text stays verbatim; the mismatch is reported to the lead. |
| Q27 | The Clinician Screener and the Ambient Scribe keep separate answers, and the Patient Companion's answers reach neither. Add a clinician-initiated "Copy Scribe answers into the Screener" that copies only answered items (never writing "no" for an absent one) and leaves the Screener's safety review to the clinician? | Not provided; each clinician tab says it keeps its own answers (§5.1). |
| Q28 | A module without a lexicon has no voice capture at all. Offer a transcript-only mode, where speech goes into the transcript and the note's text but never into structured answers, so nothing absent reads as negative? | Off: the transport is hidden, the notice explains why, and the upload and Apply cards say so before use (§3.5). The editor can create a lexicon. |
| Q29 | An optional, never-stored "Name (optional)" field printed at the top of the patient's print and exports, so a physician who receives several summaries ahead of the visit can tell them apart? It needs an es string and a reviewer, and must stay out of every persisted state (D20). | Not provided; exports carry the generation date. |
| Q30 | Leaving patient mode on a shared device takes a confirmation. Is that enough, or should leaving need something stronger, such as a per-session clinician code? | A confirmation (§5.1). |

---

## Review log

Adversarial review of 2 October 2026: 50 findings, numbered R1-R50 in the order received (11 must-fix, 30 should-fix, 9 nits). **No finding was rejected outright.** Every one is resolved in this document. The last column records where the resolution departs from the reviewer's proposed fix, and why; those are the only partial rejections.

| # | Sev | Finding | Resolution | Departure from the proposed fix |
|---|---|---|---|---|
| R1 | must | Only the immediate parent is checked, so a second-generation edit or a hand-edited upload can print instrument 0.2; the scoring caveat compares with the parent | `provenance.root`, `lineage`, `contentHash` (§3.2); family version rule with the `-local` tag (V53, §3.11); badge and caveat against the root (§3.11, §5.1) | The `-local` rule binds modules with a root or kin to a built-in, not every upload: an unrelated module's "1.0" is not a MASQUE number, and its identifiers already differ (V9). |
| R2 | must | A re-uploaded or restored derivation has no defined origin; `derivedFrom` is forgeable | `classifyLineage` (§3.11 table): a verified derivation (root hashes, logic binding, `contentHash`) gets origin `derived`, anything else Load as derived or a plain upload; restore re-classifies (§5.2); V37, V54; `roundtrip` and `upload` cases | Intermediate ancestors need not be loaded or in the zip: every privilege hangs off the verified root, so checking them would refuse valid round trips and add no protection. |
| R3 | must | A throwing derive rule falls back to `''` and still issues the default referral and `noDriver` | Treated as a routing error (§3.3, §4.5, §4.11); WP3 unit tests and `rules` cases | — |
| R4 | must | `referralGate`, `cdsPreview` and `buildBundle` have no rule-error input | `routingError` from `routingRecs` into `referralGate`, `referralFor`, `cdsPreview`, `buildNote` and `buildBundle`; Observation note (§3.6, §4.5-§4.7); injected-throw cases in `rules` | — |
| R5 | must | The calibration gate withholds only the live probability | Every calibration-dependent figure and manifest block withheld with its reason; demo cohorts hidden (§5.6); `research` | — |
| R6 | must | V28 accepts a flag with no cue phrase | V28 requires non-empty lists; the editor keeps the last phrase (§4.14, §5.7); mutation fixture | — |
| R7 | should | Rescue liveness is not enforced for uploaded logic | V46 rescue property (§4.10, §4.14); §7.1 corrected | — |
| R8 | should | Clinician score wording reaches patient surfaces; the omission regex misses "scores" | Patient provenance set (§3.11, §4.2) in the strip, print header and exports (§5.1, §5.5); `OMISSION_PATTERNS` and V60; `omissions` on the shape fixture and a derivation | — |
| R9 | should | Derived modules mint codes in MASQUE's code system; generated files carry no provenance | Systems and `cds.source.url` become `{id}` templates, byte-identical for MASQUE; provenance in the Questionnaire (`derivedFrom` too), CDS and dictionary (§3.10, §4.7); `golden` cases | The Questionnaire `name` is kept, because the URL is the identifier; the publisher gets the marker as well as title and description. |
| R10 | should | Wording the logic depends on stays freely editable | Per-field acknowledgement listing the dependent closures; impact preview with patient sentences and routing headings (§5.7) | Acknowledgement instead of a lock: the MASQUE summary reads nearly every item, so locking would freeze almost all wording. |
| R11 | should | No numeric oracle for the edited panel and embedded population | `research-parity` suite (§8.2, §8.3), WP10 | — |
| R12 | should | Research pools rows across modules and versions; snapshots lack `routingCleared` | Row scope with counts (§5.6); `safetyReviewed` and `routingCleared` in `ScreenSnapshot` (§5.3); decision withheld | Rows with neither column stay included, labelled "provenance unknown": external research files rarely carry them. |
| R13 | should | Derived label unspecified; uploads may copy a built-in label; titles omit the origin | Default `${root.label} — edited ${date}`; V8 (E for a built-in label, W for a loaded duplicate); title suffix (§3.10, §3.11, §5.1) | Same resolution as R30. |
| R14 | nit | Dictionary score type is the literal "number 0–100" | `number 0–${scaleMax}` (§4.7) | — |
| R15 | nit | `masque-local-…` ids pool with `masque-` filters | Default `local-<root id>-<hex6>`; non-built-in ids may not start with `<built-in id>-` (V8) | — |
| R16 | nit | A stale translation shows silently | `reviewed:false`, `CAVEATS.staleTranslation` on screen, in print and in exports; red-flag acknowledgement at Apply (§3.11, §5.5, §5.7) | Falling back to the edited English was not taken: the patient may not read English. |
| R17 | must | No patient-only view; patients land in the clinician program | `patient.html` patient page (§5.11) and shell patient mode (§5.1), D26; `pages` and `omissions` cases | Both proposed options: at-home use and in-clinic handover need different entry points. |
| R18 | must | Round trip of a derivation undefined; manual check (d) needs a reload | As R2; §8.6 (d) reloads first | The badge stays "Edited module" (origin `derived`) instead of "Uploaded · derived from…": a verified derivation should survive a round trip unchanged. |
| R19 | should | A hand-edited `masque.rubric.json` is refused with no next step | Load as derived for reserved ids, failed verification and kin files (§3.11 rows 2, 4, 5; §5.2) | — |
| R20 | should | Separate Screener and Scribe state is never stated | `TabNote` and the indicator text (§5.1) | The copy action is left to the lead (Q27). |
| R21 | should | Only the active module can be edited, and Apply clears every screen | Editing select, Create or Create and switch, current-screen impact rows (§5.7) | — |
| R22 | should | Research uploads are not dirty; the confirmation is vague | `dirty.research` via `onDataChange`; itemised confirmation (§5.1, §5.6) | The editor is left out of `dirty`: drafts autosave. |
| R23 | should | Derived modules are lost on reload | "Remember" checked by default, unsaved notice, `beforeunload` (§5.1, §5.7) | — |
| R24 | should | The Patient-tab stop misses `starting` | Stop in every state but `idle`, `stopped` and `error`; `micAllowed` in the Scribe (§5.1, §5.4); `holdStart` case | — |
| R25 | should | Lexicon-less uploads lose the microphone and the Patient tab without notice | Availability summary (§4.16, §5.2); Q28; the editor creates a lexicon and English patient wording (§5.7) | — |
| R26 | should | Adding an item is underspecified | Add item form; domains locked in v1 with the reason (§5.7) | — |
| R27 | should | The fixed print header overlaps page 2 onward | `PrintFrame` table header (§5.10), the same in the `.html` export (§5.5); PDF-based `print` spec (§8.3) | — |
| R28 | should | The `.txt` export is undated and nameless | Dated caveat line (§5.5, AD10); name field is Q29 | — |
| R29 | should | `index.html` is not screenAIr | D27: redirect in WP14, about text into `ModuleInfo` | — |
| R30 | should | Labels can claim "MASQUE v1" | As R13 | — |
| R31 | nit | The zip omits module docs; failed modules unaccounted | Registry `docs` list copied; manifest `failed` (§2.3, §5.8) | A registry list rather than the folder: the host serves no directory listing. |
| R32 | nit | Arrow keys on the closed select act at once | Keyboard choices stay pending until Enter (§5.2); `pages` keyboard case | — |
| R33 | nit | Spreadsheets get "Not a screenAIr file" | Specific message and format guide (§3.9, §5.2) | — |
| R34 | must | Compiled code cannot import the loader | D25, §6.3-§6.4: `boot` props inject `env`; `static` check; loader comment rewritten | Injection (option 1); `appBase` travels in the same object (R36). |
| R35 | must | Harness API unspecified; literal suite imports break the page | §8.0 contract: run-time suite list, suite shape, `h`, Playwright spec shape, voice stub | — |
| R36 | must | Module data resolves against the page | `env.appBase` for every module-data path (D25, §2.3, §3.8, §5.6, §5.8) | Supplied by the page script through `boot` rather than a meta tag, so R34 and R36 share one mechanism. |
| R37 | should | Consumer stubs collide; the M1 shell would import WP3 | WP0 commits every engine stub and `ui/common.jsx` (§2.4, §9.0, §9.1); the M1 shell imports no registry (§9.13) | — |
| R38 | should | Apps need shell components; cycles hang the loader | `src/ui/common.jsx` (§2.5); layering and acyclic checks (§8.3); loader cycle detection (§6.2) | Detection uses a wait-for map: a per-call ancestor chain misses two siblings built in parallel. |
| R39 | should | Session provider placement contradicts the callbacks | `ModuleWorkspace` owns it inside `<main key>`; `publish`/`addRow` (§5.1) | — |
| R40 | should | A `.js` kind is unknown before consent | `inspectSource` (§6.1); the V59 list shown before consent (§5.2, §7.4) | — |
| R41 | should | Recording proxies over frozen state break Proxy invariants | Proxies built before freezing over shadow targets; helpers record (§3.3, V47) | — |
| R42 | should | A zip's `logic.js` is refused when JS is off | Built-in logic recognised by SHA-256 and never executed (§3.9, §5.2); `roundtrip` case | — |
| R43 | should | Provenance files cannot be enumerated | Not copied; README points to the folder (§5.8) | — |
| R44 | should | Two implementations of `scoringHash` | `rubricHashes` and `hashProjections` in WP0's `hash.js`; `calibrationGate(masque)` asserted (§3.10, §4.3, §9.2) | — |
| R45 | should | Slices with JSX or `useMemo` cannot be wrapped as specified | Wrap, compile, bind procedure (§8.2) | — |
| R46 | should | `emulateMedia` cannot verify per-page headers | As R27, verified with `page.pdf()` and pdf.js boxes (§8.3) | The table header reserves its space by layout, so the `@page`-margin variant with negative offsets is not needed. |
| R47 | should | Import-like text inside fixtures breaks compilation | Fixture rule (§8.0); `static` check (§6.5, §8.3) | — |
| R48 | nit | The shape fixture has no date | WP13 day 1 (§2.9, §9.14) | — |
| R49 | nit | `importSource` compares UTF-16 length with a missing constant | Caller passes `byteLength` and `maxBytes` (§6.1) | — |
| R50 | nit | Redirecting the Simulator at M1 drops its demos | Redirect at M2 (D18, §2.1, §9.13, Q18) | — |

## Orchestrator decisions after the foundation phase (2 October 2026)

Settled after WP0, WP13 day 1 and WP12-M1 landed, binding on every later package:

| # | Decision |
|---|---|
| F1 | **t-ids exemptions (§8.3).** The rule ignores import specifiers (apps and the shell must import `MASQUE_Voice.js`, `MASQUE_Population.jsx` and so on, §2.7) and the page-contract names `masque-proto`, `masque-back`, `masque-status`, `masque-loader.js`, `data-masque-*`, `masqueReady` and `masqueTests`. |
| F2 | **t-ids is waived for `src/shell/**` until M2.** The M1 shell mounts the legacy files and must name them; its "M1 legacy block (→ M2)" and the registry's fallback label are replaced at M2, after which the rule applies to the shell in full. |
| F3 | **Encoding (§2.8, §8.3).** `data/provenance/nhanes-fetch-manifest.json`, `tests/fixtures/nhanes/nhanes_synthetic.csv` and `tests/fixtures/synthetic_nhis_like.csv` keep their CRLF line endings (data files written on the user's machine; not rewritten). The LF check exempts exactly these paths; BOM and UTF-8 checks still apply. |
| F4 | **`validateModule({loaded})` takes `BoundModule[]`** (modules, not registry entries; failed entries are never passed). §5.2's "loaded: entries" means the modules of the loaded entries. |
| F5 | **`RoutingState.answered` is the numeric count** (as in `ScoreResult`). The per-item helper on predicate states is named `isAnswered(id)`. `contract.js` is updated accordingly by WP3. |
| F6 | **Release `0.4.0`** stays the default (Q2 open with the lead). `index.html`'s versions list follows `policy.APP_VERSION` when WP14 rewrites it. |
| F7 | **Test files WP0 added under `app/tests/loader-check/`** are accepted; WP13 folds them into the suites. `.gitignore` additions are accepted as WP0's. |
| F8 | **`RegistryEntry` gains optional `label` and `isDefault`**; entry keys are `builtin:<rubric.id>` (fallback `builtin:<index>`). |
| F9 | **`.pa-table` overflow at 375 px** (`PopulationArtifact.jsx`) is fixed by WP10 with a scroll wrapper; the shell's `.sa-panel{overflow-x:auto}` guard stays. |
| F10 | **`referralGate` refuses a referral while any red flag is open on both surfaces** (`!override` applies to the Scribe too), stricter than §4.6's Scribe formula. The Scribe derives `routingCleared = !override && safetyReviewed` (Scb L928), so the two agree on every state the app can reach; the stricter gate only removes the dependence on the caller. The golden suite compares Scribe bundles on reachable states only. |
| F11 | **No referral and no CDS index card for an undeclared complaint.** `rules.referralFor` returns `null`, and `rules.cdsPreview` withholds the index card, when the complaint is not one of the module's declared `phenotypes.values` (`""` included); `buildBundle` then emits no referral ServiceRequest. The baseline fell back to the default phenotype, so a Screener result reached without a complaint (the scenario samples) issued a sinonasal referral and CDS card nobody entered. Lookups in `byPhenotype` tables read own properties only. The Scribe's complaint is always a derived, declared value, so Scribe parity is unchanged. Recorded as **AD15** (`golden` screener-surface bundle, `rules` CDS preview and referralFor). |
| F12 | **Scribe suggestions widen while the screen is NOT scorable** (`scribe.rankSuggestions`: `!scorable \|\| active.has(domain)`), as §4.2 and Inv §4.2 describe and as the baseline's own comment says (Scb L852-855); the baseline code tests `scorable \|\|`. Recorded as **AD13** (`rules`: the new list must equal the baseline slice run with `scorable` inverted). |
| F13 | **QuestionnaireResponse domain group answers** are `valueInteger` for integer points and `valueDecimal` for fractional points (a scale factor below 1); the baseline wrote `valueInteger` with a non-integer value. Recorded as **AD14** (`golden`, both bundle surfaces). |
| F15 | **Score range is the union of the legacy bound and the exact best/worst-case completion bound** (`scoring.js`). It is never narrower than the exact range, so no settled band can be contradicted by completing open items (fractional weights or best `f` < 1 in edited/uploaded modules), and MASQUE output stays byte-identical (the exact bound alone changes the clamped incomplete-note text). Edited modules may occasionally read indeterminate where the exact range would settle. |
