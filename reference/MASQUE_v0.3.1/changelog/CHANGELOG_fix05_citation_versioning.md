# Fix #5 — Citation, versioning, and demo hygiene

Closes audit section **5** (copy and consistency), and records the two open items agreed after #4.
Files changed: all three.

**With this, every blocker on the fix list is closed.** What remains is the "before submission" tier (#6–#12), which is feature work, not defect work.

---

## 1. Bridge2AI

Removed from both places in the screener. Bridge2AI-Voice is a VOICED source and appears nowhere in the MASQUE §6 table — a reviewer reading both proposals would have caught it immediately.

Replaced with the sources MASQUE actually claims: NHANES, NHIS, MEPS, CMS PUF, HCUPnet, openFDA, CDC WONDER/BRFSS, All of Us. The header comment now also states explicitly that Bridge2AI belongs to VOICED, so the next person to copy between projects doesn't reintroduce it.

The panel's own `Bridge2AI-Voice` entry is inside the VOICED project config and was always correctly scoped — untouched.

## 2. Versioning — two numbers, and they are supposed to differ

The audit called this "version drift four ways." Working through it, only part of it was drift. The Questionnaire canonical URL at `v0.1` was *correct*, for a reason worth making explicit rather than papering over:

```js
const INSTRUMENT_VERSION = "0.1";   // the item set: 21 questions, wording, weights
const APP_VERSION        = "0.3.0"; // scoring interpretation, routing, safety logic
```

**The instrument has not changed.** No item has been added, removed, or reweighted across fixes #1–#4. The FHIR Questionnaire canonical URL identifies the instrument, and bumping it without changing an item would break comparability with responses already recorded against it.

**The app has changed materially.** The same answers now produce different outputs: a band can be withheld, a referral can be suppressed, absent values are no longer imputed. A version string that didn't move would have misled anyone comparing behaviour against the v0.2 artifacts.

Every version string in both files now derives from one of these two constants. The genuine drift — a UI badge reading `v0.1` while `modelVersion` said `0.2` for the same build — is gone.

**One inconsistency remains and it is deliberate:** the filenames still say `v0_2`. See the note at the end.

## 3. Demo patient

Dropped the DOB and relabelled the record.

The old banner rendered `41 yr · female · MRN-77-2210 · DOB 1985-02-14`. An age *plus* a birth date is a date of birth, and a realistic-looking MRN in a clinical banner is the wrong signal for a submission whose §11 leans on privacy discipline. Now: `41 yr · female · SANDBOX-77-2210 · synthetic sandbox record`, with the MRN prefix doing the same work as the label.

## 4. Two items recorded, per the discussion after #4

**Tolerance status.** `FAIRNESS_POLICY.toleranceStatus` now reads `"placeholder — requires clinical sign-off and citation"`, so the 10% figure cannot be mistaken for a settled clinical commitment by anyone reading the model card.

**Mitigation sequencing.** The model card gains an `equityMitigation` block stating plainly what is measured, what is *not* implemented (reweighting and threshold adjustment per §7.2), and the rationale — that measurement precedes mitigation because a disparity cannot honestly be claimed reduced before there is an instrument capable of detecting it, and that this is a sequencing decision rather than an oversight.

A reviewer now finds this stated in the artifact rather than inferring it from an absence.

---

## Verification

All three build clean. Full regression across every prior fix:

```
#1  200,000-set band sweep                     0 unsafe assignments
#2  red-flag bundles                           routine -> urgent -> stat, Flags emitted
#3  unlabeled cohort                           validation WITHHELD, missingness 100%
#4  single-positive-group cohort               sensitivity NOT ASSESSABLE, selection FAIL
```

---

## Two things to decide, both outside the code

**The filenames.** `APP_VERSION` is now `0.3.0` while the files are still named `v0_2`. I did not rename them, because renaming properly means also regenerating `IMPLEMENTATION_README.md` — and that README describes all six prototypes, four of which I don't have.

**Which leads to the more important point.** `ResearchReadinessPanel.jsx` is shared across all six prototypes, so fixes #3 and #4 propagate to VOICED and BREATHE automatically. I checked the prop changes for backward compatibility: `scorable` and `ceiling` default safely, and `signalQuality` moving from `1` to `null` only affects callers that never passed it — VOICED and BREATHE do pass it, so their confidence arithmetic is unchanged.

Fixes **#1 and #2 do not propagate.** Band assignment and red-flag interception live in each app's own scoring logic, which is duplicated per prototype. If VOICED and BREATHE follow the same structure MASQUE did, then:

- both can still report a low-likelihood band from an incomplete screen;
- VOICED has no red-flag step, and BREATHE's is limited to whatever its existing `redFlags` prop carries.

For BREATHE especially — airway and breathing complaints — a confirm-only screen with no safety interception is the same failure MASQUE had, in a domain with less forgiving red flags. I have not seen those files, so this is inference from the shared architecture rather than a finding. Worth checking before the four other prototypes ship alongside these two.
