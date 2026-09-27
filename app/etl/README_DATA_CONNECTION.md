# Connecting a dataset to MASQUE

There are **two** connections, they go to different places, and conflating them is the mistake worth avoiding.

| | What it is | How it connects |
|---|---|---|
| **Cohort rows** | Individual patients from your clinical pilot | Upload CSV/JSON straight into the research panel on the screener or scribe — already works |
| **Population estimates** | National figures from NHIS / NHANES / MEPS | Offline ETL → JSON artifact → committed under `app/data/` → rendered by `app/population.html` |

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

The map is data rather than code on purpose: a cycle change becomes a reviewable diff, and the ETL refuses to run while anything is still TODO. Three more things the map declares, all read by the ETL: `phenotype_rule` `{"all": [...], "any": [...]}` — positive when every `all` concept is positive and at least one `any` concept is positive, complete cases only, and every concept it names must be mapped (an unmapped arm would otherwise silently narrow the phenotype instead of being reported as absent); `eligibility` `{"var", "min", "max", "reason"}` — the subpopulation the items were asked of, applied as a design subset; and per-concept `skipNegative` `{"var", "codes"}` — a gate answer that routed respondents past the detail items counts as no, not as missing. When you declare a concept unmapped, drop it from the rule and say so in `phenotype_definition`.

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
- Recodes 7/8/9 (Refused / Not Ascertained / Don't Know) to `NA` **and keeps them `NA`** through the positive-code test, so a respondent who refused leaves the denominator instead of counting as negative. (0.1.0 got the first half of this right and the second half wrong; see the script header.)
- Applies NCHS presentation standards (RSE > 30% or unweighted n < 30 → suppressed) in the ETL, where the steward's rule belongs.
- Hashes the source file so the §8 reproducibility check has something to check against.
- Keeps sex and gender strictly separate. If the cycle has no gender item, gender estimates are **omitted, not substituted from sex**, and the artifact says so in its caveats.
- Tags every estimate with a `unit`, so the renderer never guesses whether a number is a proportion or dollars.

### 4. Commit the artifact and list it

Copy the JSON the ETL wrote into `app/data/` and add one line to `app/data/population-estimates.index.json`:

```json
{ "path": "./data/population-estimates.nhis-2024.json", "addedOn": "2026-09-24", "note": "NHIS 2024 Sample Adult" }
```

`app/population.html` fetches the index, validates each listed artifact against `population_estimates.schema.json`, and renders it with its intervals, degrees of freedom, design specification, phenotype definition, unmapped concepts, caveats and source hash. An artifact that fails validation is shown as **refused**, never rendered. Nothing in the page performs arithmetic on it.

To preview an artifact before committing it, upload it into the research panel on the screener or scribe page: the panel keys on `masqueArtifact: "population-estimates"`, switches to the population tab, and renders it with the same component. To check an artifact on a machine with no Node and no R, open `app/tests/population-artifact-check.html` (local only, not deployed): it runs the same schema check and can verify the source hash against the downloaded file.

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

---

## What this does and doesn't close

Closes the mechanism for §7.3's first output, end to end: estimator, contract, committed-artifact path, page. **Does not by itself close the deliverable** — that needs a filled map and a real run. What exists now is the contract, the estimator, the renderer and the page, so the remaining work is codebook lookup and one command rather than architecture.

Still out of scope here: pooling multiple cycles (needs cycle-specific weight adjustment), inflation-adjusting MEPS dollars, and the reproducibility rebuild in §8 beyond the source hash — that needs the ETL run recorded with the file hash pinned, which the artifact now carries.
