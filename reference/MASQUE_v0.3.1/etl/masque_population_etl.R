#!/usr/bin/env Rscript
# masque_population_etl.R  v0.1.0
#
# Reads a survey public-use file, applies the MASQUE §7.1 computable phenotype from
# a versioned mapping file, and emits a design-aware population-estimates artifact
# that ResearchReadinessPanel renders.
#
#   Rscript masque_population_etl.R \
#     --data   ./adult24.csv \
#     --map    ./phenotype_map_nhis_2024.json \
#     --out    ../masque-population-estimates.json
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
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(survey); library(jsonlite); library(digest)
})

# Lonely PSUs (a stratum contributing a single PSU after subsetting) are common in
# domain analysis. "adjust" centres them at the population mean rather than erroring
# or, worse, silently dropping them.
options(survey.lonely.psu = "adjust")

args <- commandArgs(trailingOnly = TRUE)
getarg <- function(flag, default = NULL) {
  i <- match(flag, args); if (is.na(i)) default else args[i + 1]
}
data_path <- getarg("--data")
map_path  <- getarg("--map")
out_path  <- getarg("--out", "masque-population-estimates.json")
if (is.null(data_path) || is.null(map_path)) stop("--data and --map are required")

map <- fromJSON(map_path, simplifyVector = FALSE)

# --- refuse to run on an unfinished map ------------------------------------
# A half-filled map is the failure mode that produces a confident wrong number, so
# it is a hard stop rather than a warning. Concepts the cycle genuinely cannot
# express are declared unmapped in the artifact — that is a different thing from
# a concept nobody got round to filling in.
todo <- names(Filter(function(c) identical(c$`_status`, "TODO"), map$phenotype_concepts))
if (length(todo)) {
  stop(sprintf(
    "Mapping incomplete. These concepts are still TODO: %s\nFill them from %s, or move any the cycle cannot express into the 'unmapped' list.",
    paste(todo, collapse = ", "), map$`_meta`$codebook))
}

# --- load -------------------------------------------------------------------
df <- read.csv(data_path, stringsAsFactors = FALSE)
names(df) <- toupper(names(df))
file_hash <- digest(file = data_path, algo = "sha256")

d <- map$design
for (v in c(d$weight, d$strata, d$psu)) {
  if (!v %in% names(df)) stop(sprintf("Design variable %s not found in %s", v, data_path))
}

# --- recode missing ---------------------------------------------------------
# NHIS uses 7 = Refused, 8 = Not Ascertained, 9 = Don't Know on most items. These
# MUST become NA. Leaving them as numbers makes "Refused" count as a positive
# response, which is the same class of error as imputing an absent label to 0 —
# the defect the ingestion layer was rebuilt to remove.
na_codes <- function(x, codes) { x[x %in% codes] <- NA; x }

pos <- function(varnames, codes) {
  if (!length(varnames)) return(rep(NA_integer_, nrow(df)))
  m <- sapply(varnames, function(v) {
    if (!v %in% names(df)) stop(sprintf("Mapped variable %s not present in the data file", v))
    as.integer(na_codes(df[[v]], c(7, 8, 9)) %in% unlist(codes))
  })
  as.integer(apply(m, 1, function(r) if (all(is.na(r))) NA else max(r, na.rm = TRUE)))
}

concepts <- map$phenotype_concepts
for (nm in names(concepts)) {
  df[[paste0("C_", nm)]] <- pos(unlist(concepts[[nm]]$vars), concepts[[nm]]$positiveCodes)
}

# Sex / gender kept strictly separate — see fix #16. If the cycle carries no gender
# item the column stays NA and the artifact reports gender estimates as unavailable
# rather than reusing sex.
sx <- map$demographics$sex
df$SEX_LBL <- NA_character_
if (!is.null(sx$var) && sx$var %in% names(df)) {
  raw <- na_codes(df[[sx$var]], unlist(sx$missing))
  for (code in names(sx$recode)) df$SEX_LBL[raw == as.integer(code)] <- sx$recode[[code]]
}
gd <- map$demographics$gender
df$GENDER_LBL <- if (!is.null(gd$var) && gd$var %in% names(df)) as.character(df[[gd$var]]) else NA_character_

# --- the phenotype ----------------------------------------------------------
# EDIT THIS to match phenotype_definition in the map file. Left as an explicit
# conjunction rather than something clever so it stays reviewable by a clinician.
df$MASQUE_PHENO <- as.integer(
  df$C_headache_migraine == 1 &
  (df$C_dizziness_balance == 1 | df$C_hearing_difficulty == 1)
)

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
est_row <- function(name, domain, obj, sub) {
  e  <- as.numeric(coef(obj))[1]
  se <- as.numeric(SE(obj))[1]
  ci <- as.numeric(confint(obj, df = degf(sub)))[1:2]
  n  <- sum(!is.na(sub$variables$MASQUE_PHENO))
  rse <- if (is.finite(e) && e != 0) se / abs(e) else NA_real_
  # NCHS presentation standards suppress unreliable proportions. Applied here rather
  # than in the panel: the steward's rule belongs with the steward's data.
  suppress <- is.na(rse) || (!is.na(rse) && rse > 0.30) || n < 30
  list(name = name, domain = domain, estimate = e, se = se, ci = ci,
       unweightedN = n, weightedN = sum(weights(sub), na.rm = TRUE),
       df = degf(sub), rse = rse, suppress = suppress,
       suppressReason = if (suppress) "RSE > 30% or unweighted n < 30 (NCHS presentation standard)" else NULL)
}

estimates <- list()
whole <- subset(des, !is.na(MASQUE_PHENO))
estimates[[length(estimates) + 1]] <-
  est_row("phenotype_prevalence", NULL, svymean(~MASQUE_PHENO, whole, na.rm = TRUE), whole)

for (lvl in stats::na.omit(unique(df$SEX_LBL))) {
  sub <- subset(des, !is.na(MASQUE_PHENO) & SEX_LBL == lvl)
  estimates[[length(estimates) + 1]] <-
    est_row("phenotype_prevalence", paste0("sex=", lvl), svymean(~MASQUE_PHENO, sub, na.rm = TRUE), sub)
}
if (all(is.na(df$GENDER_LBL))) {
  message("No gender variable mapped for this cycle — gender-stratified estimates omitted, not substituted from sex.")
} else {
  for (lvl in stats::na.omit(unique(df$GENDER_LBL))) {
    sub <- subset(des, !is.na(MASQUE_PHENO) & GENDER_LBL == lvl)
    estimates[[length(estimates) + 1]] <-
      est_row("phenotype_prevalence", paste0("gender=", lvl), svymean(~MASQUE_PHENO, sub, na.rm = TRUE), sub)
  }
}

unmapped <- names(Filter(function(c) !length(unlist(c$vars)), concepts))

artifact <- list(
  masqueArtifact = "population-estimates",
  generatedAt = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  producedBy = sprintf("masque_population_etl.R 0.1.0 / R survey %s", packageVersion("survey")),
  source = list(dataset = map$`_meta`$dataset, cycle = map$`_meta`$cycle,
                file = basename(data_path), steward = map$`_meta`$steward,
                url = map$`_meta`$url, downloadedAt = NA, sha256 = file_hash),
  design = list(weight = d$weight, strata = d$strata, psu = d$psu, nest = isTRUE(d$nest),
                lonelyPsu = "adjust", varianceMethod = "Taylor linearization",
                domainAnalysis = TRUE),
  phenotype = list(definition = map$phenotype_definition,
                   variableMap = lapply(concepts, function(c) unlist(c$vars)),
                   mapFile = map$`_meta`$mapFile, mapVersion = map$`_meta`$mapVersion,
                   unmapped = unmapped),
  estimates = estimates,
  caveats = c(
    "Screening-level phenotype prevalence, not diagnosed prevalence. No vestibular-testing or ICHD/Barany reference standard exists in these data.",
    "Self-reported survey items; coding inconsistency may bias phenotype capture.",
    "Hypothesis-generating estimate, not a diagnostic count.",
    if (length(unmapped)) sprintf("Concepts this cycle could not express: %s. The phenotype reported here is narrower than the one defined in proposal 7.1.", paste(unmapped, collapse = ", "))
  )
)

write(toJSON(artifact, auto_unbox = TRUE, pretty = TRUE, na = "null"), out_path)
cat(sprintf("wrote %s — %d estimates, %d unmapped concepts, source sha256 %s\n",
            out_path, length(estimates), length(unmapped), substr(file_hash, 1, 12)))
