# Connecting a dataset to MASQUE

There are **two** connections, they go to different places, and conflating them is the mistake worth avoiding.

| | What it is | How it connects |
|---|---|---|
| **Cohort rows** | Individual patients from your clinical pilot | Upload CSV/JSON straight into the panel — already works |
| **Population estimates** | National figures from NHIS / NHANES / MEPS | Offline ETL → JSON artifact → panel renders it |

## Why survey data must not go through the cohort loader

`population()` in the panel computes a weighted mean. That gives the right point estimate and **no standard error at all** — no strata, no PSUs, no design degrees of freedom.

NHIS and NHANES are stratified multi-stage cluster samples. Ignoring the design doesn't just lose precision; it produces standard errors that are wrong in a known direction — too small. NCHS says this in its own survey description: analysts who apply simple-random-sample techniques to NHIS will understate sampling error.

So dropping `adult24.csv` into the cohort uploader would give you an authoritative-looking prevalence with a falsely tight interval, and every fairness verdict downstream would inherit that false confidence. That's worse than the honest blank the panel currently shows. The panel now says so explicitly on the population tab.

**The split:** variance estimation happens in a tool that can do it. The panel becomes a renderer of finished estimates, not a calculator of them.

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

### 2. Fill in the variable map

`etl/phenotype_map_nhis_2024.json`. The **design block is already filled and verified** — `WTFA_A` (weight), `PSTRAT` (stratum), `PPSU` (PSU), nested. Those are stable across the 2019+ redesign.

The **symptom block is deliberately left as TODO and I did not guess at it.** NHIS variable names change between cycles and rotating content means a concept present one year is absent the next, so inventing names would have cost you an afternoon discovering they don't exist. Open the codebook, find each concept, and record the variable name, the positive code set, **and the question wording**.

The map is data rather than code on purpose: a cycle change becomes a reviewable diff, and the ETL refuses to run while anything is still marked TODO.

Two things to expect while you do this:

- **NHIS's dizziness/balance content has historically been a supplement, not annual core.** If 2024 doesn't carry it, say so in `unmapped` rather than approximating from a general functioning item. The vestibular arm isn't decoration — it's half the §3.1 phenotype.
- **`recalcitrance_proxy` is probably unmappable in NHIS at all.** §7.1 defines recalcitrance by repeat antibiotic/steroid courses, prior procedure, and persistence — a utilization construct. MEPS can approximate it; an interview survey can't. Declaring it unmapped is the honest outcome, and the panel renders that as a banner saying the measured phenotype is narrower than the proposed one.

### 3. Run the ETL

```bash
install.packages(c("survey", "jsonlite", "digest"))

Rscript etl/masque_population_etl.R \
  --data ./adult24.csv \
  --map  ./etl/phenotype_map_nhis_2024.json \
  --out  ./masque-population-estimates.json
```

What it does that matters:

- Builds a proper `svydesign` with `nest = TRUE` and `survey.lonely.psu = "adjust"`.
- **Produces subgroup estimates by subsetting the design, not the data frame.** Filtering rows before `svydesign()` drops the strata and PSUs that contribute to a subpopulation's variance and silently gives you wrong standard errors. This is the single most common error in survey analysis.
- Recodes 7/8/9 (Refused / Not Ascertained / Don't Know) to `NA`. Leaving them as numbers makes "Refused" count as a positive response — the same class of error as imputing an absent label to 0.
- Applies NCHS presentation standards (RSE > 30% or unweighted n < 30 → suppressed) in the ETL, where the steward's rule belongs.
- Hashes the source file so the §8 reproducibility check has something to check against.
- Keeps sex and gender strictly separate. If the cycle has no gender item, gender estimates are **omitted, not substituted from sex**.

### 4. Load the artifact

Same uploader as cohort data. The panel keys on `masqueArtifact: "population-estimates"`, switches to the population tab, and renders the estimates with their intervals, degrees of freedom, design specification, phenotype definition, unmapped concepts, caveats, and source hash.

It performs no arithmetic on them. Every number was computed where the strata were.

---

## Which dataset for which question

| Question | Dataset | Why |
|---|---|---|
| Migraine / severe headache prevalence | **NHANES 1999–2004** | Carried a severe-headache/migraine item; also the only source with audiometry and balance exam components — the "objective ENT measures" §6 claims |
| Hearing difficulty, annual trend | **NHIS** | Annual core, Functioning and Disability section |
| Dizziness / balance | **NHANES 1999–2004** or an NHIS supplement year | Not in NHIS annual core |
| Cost of illness (§2, §7.3) | **MEPS** | The only one with expenditures. Own design variables, own map file — never carry a cost figure from one survey into another survey's artifact |

**If you only do one thing:** NHANES 1999–2004 is the strongest single starting point for MASQUE specifically, because it's the one cycle range where the headache item, audiometry, and the balance exam coexist in the same respondents. Its design variables are `WTMEC2YR`, `SDMVSTRA`, `SDMVPSU`, also nested. Copy the map file and change the design block.

---

## What this does and doesn't close

Closes the mechanism for §7.3's first output. **Does not by itself close the deliverable** — that needs a filled map and a real run. What exists now is the contract, the estimator, and the renderer, so the remaining work is codebook lookup and one command rather than architecture.

Still out of scope here: pooling multiple cycles (needs cycle-specific weight adjustment), inflation-adjusting MEPS dollars, and the reproducibility rebuild in §8, which needs the ETL under version control with the file hash pinned.
