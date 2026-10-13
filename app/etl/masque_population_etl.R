#!/usr/bin/env Rscript
# masque_population_etl.R  v0.6.0
#
# Reads a survey public-use file, applies the MASQUE §7.1 computable phenotype from
# a versioned mapping file, and emits a design-aware population-estimates artifact
# that the Population page (app/population.html) and ResearchReadinessPanel render.
#
#   Rscript app/etl/masque_population_etl.R \
#     --data           ./adult24.csv \
#     --map            app/etl/phenotype_map_nhis_2024.json \
#     --out            app/data/population-estimates.nhis-2024.json \
#     --downloaded-at  2026-09-24
#
# Requires:  install.packages(c("survey", "jsonlite", "digest"))
#
# ---------------------------------------------------------------------------
# WHY THIS IS A SCRIPT AND NOT A PANEL FEATURE
#
# ResearchReadinessPanel's population() computes a weighted mean. That is the right
# point estimate and NO standard error at all. NHIS and NHANES are stratified
# multi-stage cluster samples: ignoring strata and PSUs does not merely lose
# precision, it produces standard errors that are wrong in a known direction — too
# small — so every interval and every fairness verdict built on them would be
# falsely confident. NCHS says this in its own survey description.
#
# So the split is deliberate: variance estimation happens here, in a tool that can
# do it, and the panel becomes a renderer of estimates rather than a calculator of
# them. Uploading a 30,000-row NHIS file into the panel's cohort loader would
# produce authoritative-looking numbers that are wrong, which is worse than the
# current honest blank.
#
# ---------------------------------------------------------------------------
# CHANGES 0.1.0 -> 0.2.0 (app/etl; reference/MASQUE_v0.3.1/etl keeps 0.1.0)
#
# Four defects found by running 0.1.0 against its own shipped map, each reproduced
# before it was fixed:
#
#   1. The TODO scan iterated every entry of `phenotype_concepts`, including the
#      string-valued `_instruction` note, and `$` on a character vector halted R
#      before the map was even checked. Only list-valued entries are concepts.
#   2. `as.integer(NA %in% codes)` is 0, so a respondent coded Refused / Not
#      Ascertained / Don't Know became phenotype-NEGATIVE after the 7/8/9 recode —
#      the exact "absent data rendered as negative data" error this project's
#      first invariant forbids. Missing now stays missing and leaves the denominator.
#   3. `list(domain = NULL)` keeps a NULL element, which jsonlite writes as `{}`;
#      the renderer's total/subgroup split then misfiled the total row and tried to
#      render an object. The key is now omitted for the total, as the schema says.
#   4. `sapply` over a single mapped variable can simplify to a vector, and the
#      `apply(m, 1, ...)` that followed fails on a vector. The matrix is now built
#      explicitly.
#
# And two hard stops added so the §7.1 decisions are made by the clinical lead, not
# by whatever the map happened to contain: a `phenotype_definition` still marked
# TODO, or a conjunction that references a concept the map declares unmapped, both
# refuse to run.
#
# CHANGES 0.2.0 -> 0.3.0 — the first real run (NHANES 1999-2004) needed three
# things the map could not say:
#
#   1. The phenotype rule now lives in the map as data, `phenotype_rule`
#      {"all": [...], "any": [...]}: positive when every `all` concept is positive
#      and at least one `any` concept is positive. Different surveys express
#      different concept sets (NHANES has a tinnitus item; NHIS does not), so one
#      hard-coded conjunction could not serve both. The stops still hold: every
#      referenced concept must be mapped, `any` must be non-empty, and the
#      definition in words must not be TODO. Complete cases only — a respondent
#      missing ANY referenced item is NA and leaves the denominator, so a missing
#      arm can neither make someone positive nor negative.
#   2. `eligibility` {"var","min","max","missing","reason"} restricts estimation to the
#      subpopulation the phenotype items were asked of (NHANES asked the balance
#      questionnaire of adults 40+). Applied as a DESIGN subset, so variances stay
#      right. Recorded in the artifact. `missing` lists codes of the eligibility
#      variable that mean "unknown" (NHIS age 97/98/99); those respondents are
#      ineligible rather than counted as very old.
#   3. `skipNegative` {"var","codes"} on a concept: respondents routed past the
#      concept's detail items by a gate question ("any dizziness, balance or
#      falling problems?" = No) are negative for the concept, not missing. Only a
#      documented skip pattern belongs here; a genuine non-response stays NA.
#
# CHANGES 0.3.0 -> 0.4.0 — NAMCS (physician office visits, diagnosis-coded):
#
#   1. `positivePrefixes` on a concept: code-list fields (ICD diagnoses) are read as
#      text and a concept is positive when any listed field starts with any prefix.
#      Requires `absentIsNegative: true`, stated in the map: on a diagnosis list, no
#      matching code means the condition was not recorded, which is a negative for
#      the estimand "visits where it was recorded", not a missing answer.
#   2. `eligibility.concept`: restrict the domain to records positive for a concept
#      (e.g. visits with a sinusitis diagnosis), alone or with an age floor.
#   3. `_meta.unitOfAnalysis` ("person" default, or "visit") and `_meta.estimateName`
#      are carried into the artifact so a share of visits is never labelled a
#      population prevalence.
#   4. `_meta.minPositiveCases`: suppress unless at least this many sample records
#      are phenotype-positive (NAMCS: 30, the NCHS standard for visit estimates).
#      Every estimate now reports `unweightedPositives`.
#   5. `caveats` in the map replace the default survey caveats, which describe
#      self-reported questionnaire items and do not fit diagnosis-coded records.
#
# CHANGES 0.4.0 -> 0.5.0 — FAERS (spontaneous adverse-event reports):
#
#   1. `positiveTerms` + `delimiter` on a concept: a field holding a delimited list
#      (FAERS MedDRA preferred terms joined by '|') is positive when any list element
#      EQUALS any listed term, case-insensitively. Exact match, not substring: 'SINUS'
#      must not catch SINUS TACHYCARDIA. Requires `absentIsNegative: true`.
#   2. `design.varianceMethod` in the map overrides the stated variance method, so a
#      source with no sampling design (FAERS: every report weight 1, one stratum, each
#      report its own PSU, i.e. a simple binomial variance) says so in the artifact
#      instead of claiming Taylor linearization of a survey design it does not have.
#   3. `_meta.unitOfAnalysis` may be "report".
#
# CHANGES 0.5.0 -> 0.6.0 — MEPS (persons, reported conditions, linked expenditures):
#
#   1. `positivePrefixes` with a `delimiter`: prefix match on each element of a
#      delimited code list (MEPS: a person's condition codes joined by '|').
#   2. Records with zero or missing weight are never in any domain. MEPS carries
#      out-of-scope persons with PERWTyyF = 0; they contribute nothing to an estimate
#      and must not be counted in an unweighted denominator either.
#   3. `_meta.minUnweightedN` (default 30): minimum unweighted denominator.
#   4. `costEstimates` in the map: [{name, var, statistic: "mean"|"total", unit, domain}],
#      computed within the eligible domain ("eligible") or among its phenotype-positive
#      records ("positive", the default), overall
#      and by sex, with the same suppression rules. This is the cost-of-illness half
#      of proposal 7.3; the panel and page render usd rows as dollars.
#   5. An interval that cannot be computed (too few PSUs in a tiny subgroup) forces
#      suppression and is written as [null, null], never as a number.
#   6. The eligibility caveat strips the reason's own closing full stop, so it no
#      longer ends in "..". Caveat text only; no estimate changes.
#   7. `_meta.suppressionStandard` names whose reliability rule the thresholds are, in
#      each suppressReason. Unset keeps the NCHS wording.
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(survey); library(jsonlite); library(digest)
})

ETL_VERSION <- "0.6.0"

# Lonely PSUs (a stratum contributing a single PSU after subsetting) are common in
# domain analysis. "adjust" centres them at the population mean rather than erroring
# or, worse, silently dropping them.
options(survey.lonely.psu = "adjust")

args <- commandArgs(trailingOnly = TRUE)
getarg <- function(flag, default = NULL) {
  i <- match(flag, args); if (is.na(i) || i == length(args)) default else args[i + 1]
}
data_path     <- getarg("--data")
map_path      <- getarg("--map")
out_path      <- getarg("--out", "masque-population-estimates.json")
downloaded_at <- getarg("--downloaded-at")
if (is.null(data_path) || is.null(map_path)) stop("--data and --map are required")

map <- fromJSON(map_path, simplifyVector = FALSE)

# --- refuse to run on an unfinished map ------------------------------------
# A half-filled map is the failure mode that produces a confident wrong number, so
# it is a hard stop rather than a warning. Concepts the cycle genuinely cannot
# express are declared unmapped (status "unmapped", empty vars) — that is a
# different thing from a concept nobody got round to filling in.
#
# Status vocabulary, checked with startsWith so "TODO-verify" and
# "TODO-OR-ACCEPT-UNMAPPED" also stop the run until someone decides:
#   TODO*      not decided yet                      -> refuse to run
#   unmapped   the cycle cannot express it           -> reported in the artifact
#   anything else, with vars filled                  -> mapped
concepts <- Filter(is.list, map$phenotype_concepts)   # metadata keys are strings
if (!length(concepts)) stop("The map has no phenotype_concepts.")
concept_status <- function(c) if (is.null(c$`_status`)) "" else as.character(c$`_status`)[1]

todo <- names(Filter(function(c) startsWith(concept_status(c), "TODO"), concepts))
if (length(todo)) {
  stop(sprintf(
    "Mapping incomplete. These concepts are still TODO: %s\nFill them from %s (set _status to \"mapped\"), or set _status to \"unmapped\" with empty vars for any the cycle cannot express.",
    paste(todo, collapse = ", "), map$`_meta`$codebook))
}
half <- names(Filter(function(c) concept_status(c) != "unmapped" && !length(unlist(c$vars)), concepts))
if (length(half)) {
  stop(sprintf("These concepts have no variables but are not declared unmapped: %s", paste(half, collapse = ", ")))
}
unmapped <- names(Filter(function(c) concept_status(c) == "unmapped" || !length(unlist(c$vars)), concepts))

definition <- map$phenotype_definition
if (is.null(definition) || !nzchar(trimws(definition)) || startsWith(toupper(trimws(definition)), "TODO")) {
  stop("phenotype_definition in the map is still TODO. Write the boolean combination in words before running; it is copied into the artifact verbatim.")
}

# --- the phenotype rule, from the map --------------------------------------
# phenotype_rule: {"all": [...concepts...], "any": [...concepts...]}. Positive when
# every `all` concept is positive and at least one `any` concept is positive.
# Complete cases only: any referenced concept NA -> phenotype NA (leaves the
# denominator). Every referenced concept must be mapped; an unmapped arm would
# otherwise silently narrow the phenotype instead of being reported as absent.
rule <- map$phenotype_rule
if (is.null(rule) || (!length(unlist(rule$all)) && !length(unlist(rule$any)))) {
  stop("The map has no phenotype_rule. Add {\"all\": [...], \"any\": [...]} naming the concepts the phenotype combines.")
}
rule_all <- as.character(unlist(rule$all)); rule_any <- as.character(unlist(rule$any))
if (!length(rule_any)) stop("phenotype_rule.any is empty; name at least one concept.")
PHENOTYPE_USES <- unique(c(rule_all, rule_any))
used_unmapped <- intersect(PHENOTYPE_USES, unmapped)
if (length(used_unmapped)) {
  stop(sprintf(
    "phenotype_rule uses concepts this map declares unmapped: %s.\nRemove them from the rule, and say so in phenotype_definition.",
    paste(used_unmapped, collapse = ", ")))
}
missing_from_map <- setdiff(PHENOTYPE_USES, names(concepts))
if (length(missing_from_map)) {
  stop(sprintf("phenotype_rule uses concepts the map does not define: %s", paste(missing_from_map, collapse = ", ")))
}
phenotype_of <- function(df) {
  cols <- lapply(PHENOTYPE_USES, function(nm) df[[paste0("C_", nm)]])
  names(cols) <- PHENOTYPE_USES
  complete <- Reduce(`&`, lapply(cols, function(x) !is.na(x)))
  all_ok <- if (length(rule_all)) Reduce(`&`, lapply(rule_all, function(nm) cols[[nm]] == 1)) else rep(TRUE, nrow(df))
  any_ok <- Reduce(`|`, lapply(rule_any, function(nm) cols[[nm]] == 1))
  out <- as.integer(all_ok & any_ok)
  out[!complete] <- NA_integer_
  out
}

# --- eligibility: the subpopulation the items were asked of ---------------
elig <- map$eligibility
has_elig <- !is.null(elig) && (!is.null(elig$var) || !is.null(elig$concept))
if (has_elig) {
  if (is.null(elig$reason) || !nzchar(elig$reason)) stop("eligibility needs a reason (why this subpopulation), which is copied into the artifact.")
  if (!is.null(elig$concept) && !elig$concept %in% names(concepts)) stop(sprintf("eligibility.concept %s is not a concept in the map", elig$concept))
  if (!is.null(elig$concept) && elig$concept %in% unmapped) stop(sprintf("eligibility.concept %s is unmapped", elig$concept))
}

# --- load -------------------------------------------------------------------
prefix_cols <- unique(unlist(lapply(Filter(function(c) length(unlist(c$positivePrefixes)) || length(unlist(c$positiveTerms)), concepts), function(c) unlist(c$vars))))
col_classes <- if (length(prefix_cols)) setNames(rep("character", length(prefix_cols)), prefix_cols) else NA
df <- read.csv(data_path, stringsAsFactors = FALSE, colClasses = col_classes)
names(df) <- toupper(names(df))
file_hash <- digest(file = data_path, algo = "sha256")

d <- map$design
for (v in c(d$weight, d$strata, d$psu)) {
  if (!v %in% names(df)) stop(sprintf("Design variable %s not found in %s", v, data_path))
}

# --- recode missing ---------------------------------------------------------
# NHIS uses 7 = Refused, 8 = Not Ascertained, 9 = Don't Know on most items. These
# MUST become NA, and NA must stay NA through the positive-code test: a respondent
# who refused is neither positive nor negative and leaves the denominator.
na_codes <- function(x, codes) { x[x %in% codes] <- NA; x }

pos <- function(varnames, codes, skip = NULL, prefixes = NULL, absent_negative = FALSE, terms = NULL, delimiter = "|") {
  if (!length(varnames)) return(rep(NA_integer_, nrow(df)))
  terms <- toupper(unlist(terms))
  if (length(terms)) {
    if (!isTRUE(absent_negative)) stop("positiveTerms needs absentIsNegative: true in the map, stating that a term not listed on the record counts as not reported.")
    delim <- if (is.null(delimiter)) "|" else delimiter
    hit <- Reduce(`|`, lapply(varnames, function(v) {
      if (!v %in% names(df)) stop(sprintf("Mapped variable %s not present in the data file", v))
      x <- as.character(df[[v]]); x[is.na(x)] <- ""
      vapply(strsplit(toupper(x), delim, fixed = TRUE), function(el) any(trimws(el) %in% terms), logical(1))
    }))
    return(as.integer(hit))
  }
  prefixes <- unlist(prefixes)
  if (length(prefixes)) {
    if (!isTRUE(absent_negative)) stop("positivePrefixes needs absentIsNegative: true in the map, stating that no matching code counts as not recorded.")
    hit <- Reduce(`|`, lapply(varnames, function(v) {
      if (!v %in% names(df)) stop(sprintf("Mapped variable %s not present in the data file", v))
      x <- as.character(df[[v]]); x[is.na(x)] <- ""
      if (!is.null(delimiter)) {
        vapply(strsplit(x, delimiter, fixed = TRUE), function(el) any(vapply(prefixes, function(p) any(startsWith(el, p)), logical(1))), logical(1))
      } else Reduce(`|`, lapply(prefixes, function(p) startsWith(x, p)))
    }))
    return(as.integer(hit))
  }
  codes <- unlist(codes)
  cols <- lapply(varnames, function(v) {
    if (!v %in% names(df)) stop(sprintf("Mapped variable %s not present in the data file", v))
    x <- na_codes(df[[v]], c(7, 8, 9))
    ifelse(is.na(x), NA_integer_, as.integer(x %in% codes))
  })
  m <- do.call(cbind, cols)
  out <- as.integer(apply(m, 1, function(r) if (all(is.na(r))) NA_integer_ else max(r, na.rm = TRUE)))
  # A documented skip pattern: a gate answer that routed the respondent past the
  # detail items means "no", not "unknown". Only applied where the detail is NA.
  if (!is.null(skip) && !is.null(skip$var)) {
    if (!skip$var %in% names(df)) stop(sprintf("skipNegative variable %s not present in the data file", skip$var))
    g <- na_codes(df[[skip$var]], c(7, 8, 9))
    out[is.na(out) & !is.na(g) & g %in% unlist(skip$codes)] <- 0L
  }
  out
}

for (nm in names(concepts)) {
  df[[paste0("C_", nm)]] <- pos(unlist(concepts[[nm]]$vars), concepts[[nm]]$positiveCodes, concepts[[nm]]$skipNegative,
                                concepts[[nm]]$positivePrefixes, concepts[[nm]]$absentIsNegative,
                                concepts[[nm]]$positiveTerms, concepts[[nm]]$delimiter)
}

# Sex / gender kept strictly separate — see fix #16. If the cycle carries no gender
# item the column stays NA and the artifact reports gender estimates as unavailable
# rather than reusing sex.
sx <- map$demographics$sex
df$SEX_LBL <- NA_character_
if (!is.null(sx$var) && sx$var %in% names(df)) {
  raw <- na_codes(df[[sx$var]], unlist(sx$missing))
  for (code in names(sx$recode)) df$SEX_LBL[!is.na(raw) & raw == as.integer(code)] <- sx$recode[[code]]
}
gd <- map$demographics$gender
df$GENDER_LBL <- if (!is.null(gd$var) && gd$var %in% names(df)) as.character(df[[gd$var]]) else NA_character_

df$MASQUE_PHENO <- phenotype_of(df)
if (all(is.na(df$MASQUE_PHENO))) {
  stop("Every respondent is NA on the phenotype: the mapped variables carry no usable codes. Check the positive code sets and the variable names against the codebook.")
}

# --- design object ----------------------------------------------------------
des <- svydesign(
  ids     = as.formula(paste0("~", d$psu)),
  strata  = as.formula(paste0("~", d$strata)),
  weights = as.formula(paste0("~", d$weight)),
  data    = df,
  nest    = isTRUE(d$nest)
)

# --- estimation -------------------------------------------------------------
# Domains are produced by subsetting the DESIGN, never the data frame. Filtering
# rows before svydesign() drops the strata and PSUs that contribute to the variance
# of a subpopulation estimate, and the resulting standard errors are wrong.
MIN_POS <- map$`_meta`$minPositiveCases
MIN_N <- if (is.null(map$`_meta`$minUnweightedN)) 30 else map$`_meta`$minUnweightedN
EST_NAME <- if (is.null(map$`_meta`$estimateName)) "phenotype_prevalence" else map$`_meta`$estimateName
UNIT <- if (is.null(map$`_meta`$unitOfAnalysis)) "person" else map$`_meta`$unitOfAnalysis
# Whose reliability rule the thresholds are: named in the suppression reason so a suppressed
# MEPS row does not cite NCHS. Unset keeps the wording every earlier artifact carries.
STD <- map$`_meta`$suppressionStandard
est_row <- function(name, domain, obj, sub, unit = "proportion") {
  e  <- as.numeric(coef(obj))[1]
  se <- as.numeric(SE(obj))[1]
  ci <- as.numeric(confint(obj, df = degf(sub)))[1:2]
  n  <- sum(!is.na(sub$variables$MASQUE_PHENO))
  npos <- sum(sub$variables$MASQUE_PHENO == 1, na.rm = TRUE)
  rse <- if (is.finite(e) && e != 0) se / abs(e) else NA_real_
  ci_ok <- all(is.finite(ci))
  # NCHS presentation standards suppress unreliable proportions. Applied here rather
  # than in the panel: the steward's rule belongs with the steward's data.
  suppress <- !ci_ok || is.na(rse) || (!is.na(rse) && rse > 0.30) || n < MIN_N || (!is.null(MIN_POS) && npos < MIN_POS)
  row <- list(name = name, unit = unit)
  if (!is.null(domain)) row$domain <- domain      # omitted for the total, per the schema
  row$estimate    <- e
  row$se          <- se
  row$ci          <- if (ci_ok) ci else I(c(NA_real_, NA_real_))
  row$unweightedN <- n
  row$unweightedPositives <- npos
  row$weightedN   <- sum(weights(sub), na.rm = TRUE)
  row$df          <- degf(sub)
  if (!is.na(rse)) row$rse <- rse           # omitted, not null, when the estimate is zero
  row$suppress    <- suppress
  if (suppress) row$suppressReason <- if (!is.null(MIN_POS))
      sprintf("RSE > 30%%, unweighted n < %d, or fewer than %d phenotype-positive sample records (%s)", MIN_N, MIN_POS, if (is.null(STD)) "NCHS reliability standard" else STD) else
      sprintf("RSE > 30%% or unweighted n < %d (%s)", MIN_N, if (is.null(STD)) "presentation standard" else STD)
  row
}

# Eligibility is a DESIGN subset (domain), never a data-frame filter.
df$MASQUE_ELIG <- TRUE
if (has_elig && !is.null(elig$concept)) {
  cc <- df[[paste0("C_", elig$concept)]]
  df$MASQUE_ELIG <- !is.na(cc) & cc == 1
  message(sprintf("Eligibility: %s positive — %d of %d records", elig$concept, sum(df$MASQUE_ELIG), nrow(df)))
}
if (has_elig && !is.null(elig$var)) {
  ev <- toupper(elig$var)
  if (!ev %in% names(df)) stop(sprintf("eligibility variable %s not present in the data file", ev))
  x <- df[[ev]]
  if (!is.null(elig$missing)) x[x %in% unlist(elig$missing)] <- NA   # e.g. NHIS age 97/98/99 = refused / not ascertained / don't know
  df$MASQUE_ELIG <- df$MASQUE_ELIG & !is.na(x) & (if (is.null(elig$min)) TRUE else x >= elig$min) & (if (is.null(elig$max)) TRUE else x <= elig$max)
  message(sprintf("Eligibility: %s in [%s, %s] — %d of %d respondents", ev, ifelse(is.null(elig$min), "-", elig$min), ifelse(is.null(elig$max), "-", elig$max), sum(df$MASQUE_ELIG), nrow(df)))
}

wv <- suppressWarnings(as.numeric(df[[d$weight]]))
df$MASQUE_ELIG <- df$MASQUE_ELIG & !is.na(wv) & wv > 0   # zero-weight (out-of-scope) records are in no domain
des <- update(des, MASQUE_ELIG = df$MASQUE_ELIG)   # attach the flag to the design in every case

estimates <- list()
whole <- subset(des, MASQUE_ELIG & !is.na(MASQUE_PHENO))
estimates[[length(estimates) + 1]] <-
  est_row(EST_NAME, NULL, svymean(~MASQUE_PHENO, whole, na.rm = TRUE), whole)

for (lvl in stats::na.omit(unique(df$SEX_LBL))) {
  sub <- subset(des, MASQUE_ELIG & !is.na(MASQUE_PHENO) & SEX_LBL == lvl)
  estimates[[length(estimates) + 1]] <-
    est_row(EST_NAME, paste0("sex=", lvl), svymean(~MASQUE_PHENO, sub, na.rm = TRUE), sub)
}
gender_available <- !all(is.na(df$GENDER_LBL))
if (!gender_available) {
  message("No gender variable mapped for this cycle — gender-stratified estimates omitted, not substituted from sex.")
} else {
  for (lvl in stats::na.omit(unique(df$GENDER_LBL))) {
    sub <- subset(des, MASQUE_ELIG & !is.na(MASQUE_PHENO) & GENDER_LBL == lvl)
    estimates[[length(estimates) + 1]] <-
      est_row(EST_NAME, paste0("gender=", lvl), svymean(~MASQUE_PHENO, sub, na.rm = TRUE), sub)
  }
}

# --- cost estimates among phenotype-positive records ---------------------------
for (ce in map$costEstimates) {
  v <- ce$var
  if (is.null(v) || !v %in% names(df)) stop(sprintf("costEstimates variable %s not present in the data file", v))
  if (!ce$statistic %in% c("mean", "total")) stop("costEstimates statistic must be 'mean' or 'total'")
  df[[v]] <- suppressWarnings(as.numeric(df[[v]]))
  des <- update(des, COSTV = df[[v]])
  fml <- ~COSTV
  stat <- function(sub) if (ce$statistic == "mean") svymean(fml, sub, na.rm = TRUE) else svytotal(fml, sub, na.rm = TRUE)
  among_all <- identical(ce$domain, "eligible")
  if (!is.null(ce$domain) && !ce$domain %in% c("eligible", "positive")) stop("costEstimates domain must be 'eligible' or 'positive'")
  des <- update(des, COSTDOM = if (among_all) df$MASQUE_ELIG else df$MASQUE_ELIG & !is.na(df$MASQUE_PHENO) & df$MASQUE_PHENO == 1)
  pos_dom <- subset(des, COSTDOM & !is.na(COSTV))
  MIN_POS_SAVED <- MIN_POS; if (among_all) MIN_POS <- NULL   # an all-eligible cost row is not a count of positives
  estimates[[length(estimates) + 1]] <- est_row(ce$name, NULL, stat(pos_dom), pos_dom, unit = if (is.null(ce$unit)) "usd" else ce$unit)
  for (lvl in stats::na.omit(unique(df$SEX_LBL))) {
    sub <- subset(des, COSTDOM & !is.na(COSTV) & SEX_LBL == lvl)
    estimates[[length(estimates) + 1]] <- est_row(ce$name, paste0("sex=", lvl), stat(sub), sub, unit = if (is.null(ce$unit)) "usd" else ce$unit)
  }
  MIN_POS <- MIN_POS_SAVED
}

source_block <- list(dataset = map$`_meta`$dataset, cycle = map$`_meta`$cycle,
                     file = basename(data_path), steward = map$`_meta`$steward,
                     url = map$`_meta`$url, sha256 = file_hash)
if (!is.null(downloaded_at)) source_block$downloadedAt <- downloaded_at else
  message("No --downloaded-at given; the artifact will not say when the source file was fetched.")

caveats <- if (length(unlist(map$caveats))) unlist(map$caveats) else c(
  "Screening-level phenotype prevalence, not diagnosed prevalence. No vestibular-testing or ICHD/Barany reference standard exists in these data.",
  "Self-reported survey items; coding inconsistency may bias phenotype capture.",
  "Hypothesis-generating estimate, not a diagnostic count.",
  "Respondents coded Refused / Not Ascertained / Don't Know on a phenotype item are excluded from the denominator, never counted as negative.",
  "Complete-case phenotype: a respondent missing any item the rule uses is excluded from the denominator."
)
if (has_elig) caveats <- c(caveats, sprintf("Estimated within the eligible subpopulation only (%s): %s.", paste(c(
    if (!is.null(elig$var)) paste0(toupper(elig$var), if (!is.null(elig$min)) paste0(" >= ", elig$min) else "", if (!is.null(elig$max)) paste0(" <= ", elig$max) else "") else NULL,
    if (!is.null(elig$concept)) paste0(elig$concept, " positive") else NULL), collapse = ", "), sub("[.[:space:]]+$", "", elig$reason)))
if (length(unmapped)) caveats <- c(caveats, sprintf("Concepts this cycle could not express: %s. The phenotype reported here is narrower than the one defined in proposal 7.1.", paste(unmapped, collapse = ", ")))
if (!gender_available) caveats <- c(caveats, "No gender-identity item in this cycle: estimates are stratified by sex only. Gender is not substituted from sex.")

artifact <- list(
  masqueArtifact = "population-estimates",
  unitOfAnalysis = UNIT,
  generatedAt = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  producedBy = sprintf("masque_population_etl.R %s / R survey %s", ETL_VERSION, packageVersion("survey")),
  source = source_block,
  design = list(weight = d$weight, strata = d$strata, psu = d$psu, nest = isTRUE(d$nest),
                lonelyPsu = "adjust", varianceMethod = if (is.null(d$varianceMethod)) "Taylor linearization" else d$varianceMethod,
                domainAnalysis = TRUE),
  phenotype = list(definition = definition,
                   rule = list(all = I(rule_all), any = I(rule_any), completeCase = TRUE),
                   eligibility = if (has_elig) Filter(Negate(is.null), list(var = if (!is.null(elig$var)) toupper(elig$var) else NULL, min = elig$min, max = elig$max,
                                                                              concept = elig$concept, reason = elig$reason,
                                                                              eligibleRespondents = sum(df$MASQUE_ELIG), allRespondents = nrow(df))) else NULL,
                   variableMap = lapply(concepts, function(c) unlist(c$vars)),
                   codeMap = lapply(Filter(function(c) length(unlist(c$positivePrefixes)), concepts), function(c) I(unlist(c$positivePrefixes))),
                   termMap = lapply(Filter(function(c) length(unlist(c$positiveTerms)), concepts), function(c) I(toupper(unlist(c$positiveTerms)))),
                   questionText = lapply(concepts, function(c) if (is.null(c$questionText)) "" else c$questionText),
                   mapFile = map$`_meta`$mapFile, mapVersion = map$`_meta`$mapVersion,
                   unmapped = I(unmapped)),   # I(): a single unmapped concept must stay a list, not collapse to a string
  estimates = estimates,
  caveats = caveats
)

if (is.null(artifact$phenotype$eligibility)) artifact$phenotype$eligibility <- NULL
if (!length(artifact$phenotype$codeMap)) artifact$phenotype$codeMap <- NULL
if (!length(artifact$phenotype$termMap)) artifact$phenotype$termMap <- NULL
write(toJSON(artifact, auto_unbox = TRUE, pretty = TRUE, na = "null", null = "null", digits = NA), out_path)
cat(sprintf("wrote %s — %d estimates, %d unmapped concepts, source sha256 %s\n",
            out_path, length(estimates), length(unmapped), substr(file_hash, 1, 12)))
