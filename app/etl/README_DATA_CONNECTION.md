# Connecting a dataset to MASQUE

There are **two** connections, they go to different places, and conflating them is the mistake worth avoiding.

| | What it is | How it connects |
|---|---|---|
| **Cohort rows** | Individual patients from your clinical pilot | Upload CSV/JSON into the research readiness panel (screenAIr, `app/screenair.html`, Research tab → Research readiness → Data ingestion) |
| **Population estimates** | National figures from NHIS / NHANES / NAMCS / FAERS / MEPS | Offline ETL → JSON artifact → committed under `app/data/` → rendered by the Population estimates section of screenAIr's Research tab (`app/population.html` now redirects there) |

This folder (`app/etl/`) is the published copy of the estimator. `reference/MASQUE_v0.3.1/etl/` is the 0.3.1 release copy and stays as it was; the differences are listed in `docs/refactor/02-app-divergences.md`.

## Why survey data must not go through the cohort loader

`population()` in the panel computes a weighted mean. That gives the right point estimate and **no standard error at all** — no strata, no PSUs, no design degrees of freedom.

NHIS and NHANES are stratified multi-stage cluster samples. Ignoring the design doesn't just lose precision; it produces standard errors that are wrong in a known direction — too small. NCHS says this in its own survey description: analysts who apply simple-random-sample techniques to NHIS will understate sampling error.

So dropping `adult24.csv` into the cohort uploader would give you an authoritative-looking prevalence with a falsely tight interval, and every fairness verdict downstream would inherit that false confidence. That's worse than the honest blank the Population page currently shows. The page says so explicitly.

**The split:** variance estimation happens in a tool that can do it. The page and the panel are renderers of finished estimates, not calculators of them. Neither performs arithmetic on an artifact.

---

## The path, concretely

### 1. Get the file

NHIS 2024 Sample Adult, public use, no credentialing:

```
https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Datasets/NHIS/2024/adult24csv.zip
```

Codebook (you will live in this):

```
https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Dataset_Documentation/NHIS/2024/adult-codebook.pdf
```

Note the date you downloaded it; the ETL records it in the artifact (`--downloaded-at`).

### 2. Fill in the variable map

`app/etl/phenotype_map_nhis_2024.json`. The **design block is already filled and verified** — `WTFA_A` (weight), `PSTRAT` (stratum), `PPSU` (PSU), nested. Those are stable across the 2019+ redesign.

The **symptom block is deliberately left as TODO and nobody guessed at it.** NHIS variable names change between cycles and rotating content means a concept present one year is absent the next, so inventing names would have cost you an afternoon discovering they don't exist. Open the codebook, find each concept, and record the variable name, the positive code set, **and the question wording**.

Each concept carries a `_status` the ETL reads:

| `_status` | Meaning | What the ETL does |
|---|---|---|
| anything beginning `TODO` | not decided yet | refuses to run and names the concept |
| `unmapped` (with `vars: []`) | this cycle cannot express it | runs; the artifact lists it under `unmapped` and the page shows the "narrower than §7.1" banner |
| `mapped` (with `vars` filled) | in use | runs |

The map is data rather than code on purpose: a cycle change becomes a reviewable diff, and the ETL refuses to run while anything is still TODO. Three more things the map declares, all read by the ETL: `phenotype_rule` `{"all": [...], "any": [...]}` — positive when every `all` concept is positive and at least one `any` concept is positive, complete cases only, and every concept it names must be mapped (an unmapped arm would otherwise silently narrow the phenotype instead of being reported as absent); `eligibility` `{"var", "min", "max", "missing", "concept", "reason"}` — the subpopulation the items were asked of, applied as a design subset (`missing`: codes of `var` that mean unknown, e.g. NHIS age 97/98/99, which make the respondent ineligible rather than very old; `concept`: restrict to records positive for that concept, e.g. sinusitis; `reason` is required and copied into the artifact); per-concept `skipNegative` `{"var", "codes", "missingCodes"}` — a gate answer that routed respondents past the detail items counts as no, not as missing; and per-concept `missingCodes` — the item codes recoded to missing (absent: 7/8/9, the NHIS convention every current map relies on; `[]`: none). `demographics.sex` and `demographics.gender` each take `{"var", "recode", "missing"}`. When you declare a concept unmapped, drop it from the rule and say so in `phenotype_definition`.

Two things to expect while you do this:

- **NHIS's dizziness/balance content has historically been a supplement, not annual core.** If 2024 doesn't carry it, set `dizziness_balance` to `unmapped` rather than approximating from a general functioning item. The vestibular arm isn't decoration — it's half the §3.1 phenotype.
- **`recalcitrance_proxy` is probably unmappable in NHIS at all.** §7.1 defines recalcitrance by repeat antibiotic/steroid courses, prior procedure, and persistence — a utilization construct. MEPS can approximate it; an interview survey can't. Declaring it unmapped is the honest outcome, and the page renders that as a banner saying the measured phenotype is narrower than the proposed one.

### 3. Run the ETL

```bash
install.packages(c("survey", "jsonlite", "digest"))

Rscript app/etl/masque_population_etl.R \
  --data           ./adult24.csv \
  --map            app/etl/phenotype_map_nhis_2024.json \
  --out            app/data/population-estimates.nhis-2024.json \
  --downloaded-at  2026-09-24
```

What it does that matters:

- Builds a proper `svydesign` with `nest = TRUE` and `survey.lonely.psu = "adjust"`.
- **Produces subgroup estimates by subsetting the design, not the data frame.** Filtering rows before `svydesign()` drops the strata and PSUs that contribute to a subpopulation's variance and silently gives you wrong standard errors. This is the single most common error in survey analysis.
- Recodes 7/8/9 (Refused / Not Ascertained / Don't Know), or the concept's own `missingCodes`, to `NA` **and keeps them `NA`** through the positive-code test, so a respondent who refused leaves the denominator instead of counting as negative. (0.1.0 got the first half of this right and the second half wrong; see the script header.) A concept read from several items is positive if any item is positive, missing if none is positive and any is missing, and negative only when every item was answered no (0.6.1; before, a refusal plus a "no" scored negative).
- Applies the steward's suppression rule in the ETL, where it belongs. Every row is suppressed when its 95% interval or its RSE cannot be computed, when the RSE exceeds 30%, or when the unweighted n is below `_meta.minUnweightedN` (default 30). Maps that set `_meta.minPositiveCases` also require that many phenotype-positive sample records; `_meta.suppressionStandard` names the standard in each `suppressReason`. As the committed maps set them:

  | Maps | min unweighted n | min positive records | Standard named |
  |---|---|---|---|
  | NHIS 2019–2023, NHANES 1999–2004 | 30 | — | presentation standard |
  | NAMCS 2015–2019 (both) | 30 | 30 | NCHS reliability standard |
  | FAERS (both) | 30 | 30 | NCHS thresholds applied by analogy |
  | MEPS 2019–2021 (all eight) | 100 | 30 (prevalence rows and cost rows among phenotype-positive adults; not cost rows over all eligible adults) | AHRQ MEPS reliability standard |
- Writes the artifact as UTF-8, and refuses to run when no UTF-8 locale is available (under a POSIX locale R had written the map's "§" as the text `<U+00A7>`).
- Hashes the source file so the §8 reproducibility check has something to check against.
- Keeps sex and gender strictly separate. If the cycle has no gender item, gender estimates are **omitted, not substituted from sex**, and the artifact says so in its caveats.
- Tags every estimate with a `unit`, so the renderer never guesses whether a number is a proportion or dollars.

### 4. Commit the artifact and list it

Copy the JSON the ETL wrote into `app/data/` and add one line to `app/data/population-estimates.index.json`:

```json
{ "path": "./data/population-estimates.nhis-2024.json", "addedOn": "2026-09-24", "note": "NHIS 2024 Sample Adult" }
```

The Population estimates section of screenAIr's Research tab (built-in modules that declare `research.population`, and verified derivations of them) fetches the index, validates each listed artifact against `population_estimates.schema.json`, and renders it with its intervals, degrees of freedom, design specification, phenotype definition, unmapped concepts, caveats and source hash. An artifact that fails validation is shown as **refused**, never rendered. Nothing in the page performs arithmetic on it.

To preview an artifact before committing it, upload it into the research readiness panel (Research tab → Research readiness → Data ingestion) of a module that shows population estimates: the panel keys on `masqueArtifact: "population-estimates"`, checks it against the same schema, refuses it with the failures listed if it does not pass, and otherwise switches to the Population & cost tab and renders it with the same component. To check an artifact on a machine with no Node and no R, open `app/tests/population-artifact-check.html` (local only, not deployed): it runs the same schema check and can verify the source hash against the downloaded file.

---

## Which dataset for which question

| Question | Dataset | Why |
|---|---|---|
| Migraine / severe headache prevalence | **NHANES 1999–2004** | Carried a severe-headache/migraine item; also the only source with audiometry and balance exam components — the "objective ENT measures" §6 claims |
| Hearing difficulty, annual trend | **NHIS** | Annual core, Functioning and Disability section |
| Dizziness / balance | **NHANES 1999–2004** or an NHIS supplement year | Not in NHIS annual core |
| Cost of illness (§2, §7.3) | **MEPS** | The only one with expenditures. Own design variables, own map file — never carry a cost figure from one survey into another survey's artifact |

**If you only do one thing:** NHANES 1999–2004 is the strongest single starting point for MASQUE specifically, because it's the one cycle range where the headache item, audiometry, and the balance questionnaire coexist in the same respondents. That route is the **second map**, `phenotype_map_nhanes_<cycle>.json` (one per cycle, filled on 24 September 2026 from the files' own variable labels and the components' eligibility), not a fill-in of the NHIS map; it keeps all three §7.1 arms plus a tinnitus item NHIS lacks.

### The NHANES route, step by step

NHANES ships one SAS XPORT file per component per cycle rather than one CSV, so two helper scripts sit in front of the ETL. Both are standard-library Python — they run on the project machine with no packages — and both refuse to pass on anything that is not real data.

1. **Fetch and verify.** A previous scrape saved 28 CDC "Page Not Found" pages under `.XPT` names because the URL pattern had changed; the fetcher checks the SAS XPORT signature of every download, rejects HTML, tries the current and legacy CDC URL patterns, and writes a manifest with URL, bytes, SHA-256 and time.

   ```
   python app/etl/nhanes_fetch.py --out C:\Healthcare_Data_Extract\NHANES ^
     --cycle 1999-2000 --cycle 2001-2002 --cycle 2003-2004 ^
     --component DEMO --component BAQ --component MPQ --component AUQ
   ```

   A component reported "HTTP 404" for a cycle usually means it was not fielded that cycle; an "HTML page — REJECTED" means the URL pattern is stale again and `candidate_urls()` needs the new one from the NHANES data-files page.

2. **Merge one cycle.** Left-joins every component onto DEMO by `SEQN` and writes the CSV the ETL reads plus a provenance JSON tying it back to the component hashes.

   ```
   python app/etl/nhanes_prepare.py --dir C:\Healthcare_Data_Extract\NHANES\2001-2002 --out .\nhanes_2001_2002.csv
   ```

3. **Review the map** — `phenotype_map_nhanes_<cycle>.json` is filled: MPQ090 for headache/migraine, BAQ020A/B for dizziness/balance with BAQ010 = no as a skip-pattern negative, AUQ130 codes 2–4 for hearing difficulty, AUQ190 for tinnitus; adults 40+ as the eligible population; complete cases only. Each choice quotes the file's variable label under `questionText`. Change a choice, re-run, re-commit. If audiometry exam data (AUX) rather than the questionnaire is mapped, switch the design weight to `WTMEC2YR`.

4. **Run the ETL** exactly as above, with the NHANES map and `--downloaded-at` from the fetch manifest, then commit and index the artifact. One artifact per cycle; pooling cycles needs cycle-specific weight adjustment and is out of scope.

### NHIS 2019–2023, as run on 27 September 2026

The redesigned NHIS Sample Adult files (2019 onward) are one CSV per year, so no prepare step is needed. Headache, dizziness and tinnitus are rotating content, which decides what each year can express:

| Year | Headache item | Dizziness/balance | Hearing | Tinnitus | Artifact |
|---|---|---|---|---|---|
| 2019 | `PAIHDFC3M_A` | not fielded | `HEARINGDF_A` | not fielded | `nhis-2019`, hearing-only otologic arm |
| 2020 | not fielded | not fielded | `HEARINGDF_A` | not fielded | none: no headache item |
| 2021 | `PAIHDFC3M_A` | not fielded | `HEARINGDF_A` | not fielded | `nhis-2021`, hearing-only otologic arm |
| 2022 | not fielded | not fielded | `HEARINGDF_A` | not fielded | none: no headache item |
| 2023 | `PAIHDFC3M_A` | `BALDIZZ_A` | `HEARINGDF_A` | `HRTINNITUS_A` | `nhis-2023` (all adults) and `nhis-2023-age40` (NHANES comparator) |

Maps are `phenotype_map_nhis_<year>.json`. Four things were established from the files rather than assumed, and each is recorded in the map:

- **The headache item is behind a pain gate.** `PAIHDFC3M_A` is asked only of adults who reported any pain in the past 3 months (`PAIFRQ3M_A` 2–4). Every blank in 2019, 2021 and 2023 is a "never had pain" answer or a 7/8/9 at the gate, so `PAIFRQ3M_A = 1` is declared a `skipNegative`.
- **The headache item is broader than NHANES's.** It is a how-often scale for head or face pain with no severity qualifier; NHANES asks about severe headaches or migraines. Positive is set at "some days" or more. Counting only "most days" or "every day" roughly halves the 2023 estimate (see `docs/refactor/02-app-divergences.md`); the threshold is a clinical decision.
- **`YRSINUS_A` is not sinusitis.** It is "years in the U.S.", asked only of foreign-born adults. No 2019–2023 file carries a sinusitis item, so the sinonasal arm stays unmapped. `FDSBALANCE_A` is a food-security item, not balance.
- **Age codes 97/98/99 mean unknown.** The 40+ comparator declares them as `eligibility.missing`, so those respondents are ineligible rather than counted as the oldest.

Question wording is not in the public-use CSV; each map describes the item from its name, code frame and universe, and says so. Verify wording against the year's Sample Adult codebook before publication.

```
Rscript app/etl/masque_population_etl.R --data adult23.csv \
  --map app/etl/phenotype_map_nhis_2023.json --out app/data/population-estimates.nhis-2023.json
```

### NAMCS 2015–2019, as run on 27 September 2026

NAMCS samples physician office visits, not people, and its public-use files are fixed-width text with no column names. Three steps:

1. **Cut each year to CSV.** `namcs_prepare.py` reads the positions in `namcs_layout.json`, which are transcribed from each year's NCHS documentation, checks every field against its documented code frame, and refuses the file on a mismatch. It writes each diagnosis twice: as recorded, and as `DIAGn_CONF`, blank when the physician flagged it probable, questionable or rule out.

   ```
   python app/etl/namcs_prepare.py --year 2016 --data namcs2016 --out namcs_2016.csv
   ```

2. **Pool the years.** Single years have too few phenotype-positive visits to meet the NCHS reliability standard, so the years are stacked, as NCHS recommends for rare conditions. Weights are divided by the number of years, making totals annual averages; proportions are unchanged. `CSTRATM` encodes the year, so strata stay distinct.

   ```
   python app/etl/namcs_prepare.py --stack namcs_2015.csv namcs_2016.csv namcs_2018.csv namcs_2019.csv --out namcs_2015_2019.csv
   ```

3. **Run the ETL** with `phenotype_map_namcs_2015_2019.json` (the MASQUE phenotype in diagnoses) or `phenotype_map_namcs_2015_2019_sinus.json` (among sinusitis visits, the share also diagnosed with headache or migraine).

What is different about NAMCS, all declared in the maps:

- **Concepts are ICD code prefixes** matched across the five diagnosis fields (`positivePrefixes`, with `absentIsNegative: true`: no matching code means not recorded at that visit). The lists cover ICD-9-CM (2015) and ICD-10-CM truncated to four characters (2016–2019); the two code sets never collide.
- **The sinonasal arm is expressible for the first time** (ICD-10 J01, J32; ICD-9 461, 473).
- **Sex is coded 1 = female, 2 = male**, the reverse of NHIS and NHANES.
- **Reason-for-visit codes are not used.** The reason-for-visit classification list was not in the documentation supplied, and no code is guessed.
- **Suppression is stricter:** at least 30 phenotype-positive sample visits are required (`minPositiveCases`), the NCHS standard for NAMCS visit estimates.
- **2017 is absent:** no codebook was available for that year when the files were collected.

### FAERS (openFDA drug events), as run on 28 September 2026

FAERS is a voluntary spontaneous-reporting database. It has no sampling design, no weights and no count of people exposed to any drug, so it yields a **share of reports**, never a prevalence. The map declares `unitOfAnalysis: "report"` and a `design.varianceMethod` that says there is no design, and every artifact repeats it.

```
python app/etl/faers_prepare.py --out faers_reports.csv drug-event-0001-of-0005.json ... drug-event-0005-of-0005.json
Rscript app/etl/masque_population_etl.R --data faers_reports.csv --map app/etl/phenotype_map_faers_sample.json --out app/data/population-estimates.faers-sample.json
```

- **Use the JSON pages as downloaded.** A CSV flattening of the same records split long drug lists across lines and lost 26 reports; `faers_prepare.py` still accepts CSV but the JSON route cannot lose records. The five pages here are one openFDA query (53,990 records, matching the query's own total), 53,952 unique reports received 2001–2012. The query string itself is not recorded in the files.
- Concepts are exact MedDRA preferred-term lists (`positiveTerms`), built from the terms present in the data. Exact matching keeps SINUS TACHYCARDIA out of "sinus".
- `patientsex` follows openFDA coding (0 unknown, 1 male, 2 female); age is not used.
- **No narratives.** Only 24 records carry the narrative field and all hold a "CASE EVENT DATE" stamp, so the proposal 7.2 narrative benchmark cannot run on openFDA data. The MedDRA-term lexicon check is recorded in `docs/refactor/02-app-divergences.md`.

### MEPS 2019–2021, as run on 28 September 2026

MEPS is the only source here with expenditures, so it carries the cost half of §7.3. It is a person-level survey with its own design (`PERWTyyF`, `VARSTR`, `VARPSU`), and each year is its own map and its own artifact.

1. **Build the person file.** `meps_prepare.py` (needs `pip install pyreadstat`) reads the SAS V9 public-use files for one year: full-year consolidated, conditions, condition-event links, and the office-based, outpatient, emergency, inpatient and prescribed-medicine event files. It writes one row per person with the condition codes joined into `CONDS`, and a `COST_<concept>` column for each concept the map lists under `costConcepts`. Every input's sha256 goes into a provenance file.

   ```
   python app/etl/meps_prepare.py --year 2019 --map app/etl/phenotype_map_meps_2019_sinus.json \
       --fyc h216.sas7bdat --cond h214.sas7bdat --clnk h213if1.sas7bdat \
       --ob h213g.sas7bdat --op h213f.sas7bdat --er h213e.sas7bdat --ip h213d.sas7bdat --rx h213a.sas7bdat \
       --out meps_2019.csv
   ```

   For 2020 the files are h224 (FYC), h222 (conditions), h220if1 (links) and h220a/d/e/f/g (events); for 2021, h233, h231, h229if1 and h229a/d/e/f/g.

2. **Run the ETL** with `phenotype_map_meps_<year>.json` (the MASQUE phenotype as reported conditions) or `phenotype_map_meps_<year>_sinus.json` (among adults reporting sinusitis, the share also reporting headache or migraine, plus the spending rows).

What is different about MEPS, all declared in the maps and repeated in each artifact's caveats:

- **Conditions are household-reported**, coded by AHRQ to ICD-10-CM and truncated to three characters on the public file. Rare codes are collapsed for confidentiality, so H81/H82 (vestibular), H90 and J01 never appear, and H93 (which contains tinnitus) cannot be narrowed to tinnitus.
- **Spending is linked, not attributed.** `COST_sinus_condition` sums all-payer expenditures of every distinct event linked to a sinusitis condition (prescriptions link through `LINKIDX`). An event also linked to another condition counts in full, so the figure is an upper bound. Home health events are not included (file not supplied).
- **Dollars are nominal** for the survey year; no inflation adjustment.
- **Cost rows are declared in the map** (`costEstimates`: name, variable, `mean` or `total`, and whether the domain is all eligible adults or only the phenotype-positive ones). The spending rows for adults with both sinusitis and headache are computed and suppressed in every year (62, 46 and 49 sample adults).
- **Suppression follows AHRQ:** unweighted n at least 100 (`_meta.minUnweightedN`), RSE at most 30%, and at least 30 phenotype-positive sample persons for proportions.
- **Pooling 2019–2021.** `meps_pool.py` stacks the per-year CSVs (a person sampled in two or three years contributes one record per year), divides `PERWT` by the number of years so totals are average annual totals, and keeps the annual `VARSTR`/`VARPSU`. AHRQ's HC-036 documentation (August 2026, sections C-1 and C-2) directs exactly this when every pooled year is 2019 or later; the HC-036 strata and PSUs are required only when 2019+ years are pooled with earlier ones, and the two structures are never mixed. With `--hc036 h36u24.dat` the script also attaches `STRA9624`/`PSU9624` (merged on DUPERSID and PANEL; PANEL is the first two digits of DUPERSID from 2018 on, checked for every record), so the pooled estimate can be re-run on the HC-036 structure as a check.

   ```
   python app/etl/meps_pool.py --hc036 h36u24.dat --out meps_2019_2021.csv meps_2019.csv meps_2020.csv meps_2021.csv
   Rscript app/etl/masque_population_etl.R --data meps_2019_2021.csv --map app/etl/phenotype_map_meps_2019_2021_sinus.json --out ...
   ```

   Pooled totals are named `sinus_care_spend_annual_total_*` so they cannot be read as one year's total.
- **The sinusitis denominator is, in practice, adults with sinusitis-linked care.** All but one of the 1,566 adult person-year records reporting sinusitis across the three years have at least one linked event, so no one is averaged in at zero.
- **A few people move a year's spending.** The largest single sample adult carries 7% (2019), 16% (2020) and 24% (2021) of the weighted total; the 2021 artifact says so in its caveats.

---

## What this does and doesn't close

Closes the mechanism for §7.3's first output, end to end: estimator, contract, committed-artifact path, page. **Does not by itself close the deliverable** — that needs a filled map and a real run. What exists now is the contract, the estimator, the renderer and the page, so the remaining work is codebook lookup and one command rather than architecture.

Still out of scope here: pooling NHIS or NHANES cycles (needs cycle-specific weight adjustment) and MEPS years before 2019 (needs HC-036 and the pre-2019 files), inflation-adjusting MEPS dollars, an avoidable-cost rule (a clinical decision), and the reproducibility rebuild in §8 beyond the source hash — that needs the ETL run recorded with the file hash pinned, which the artifact now carries.
