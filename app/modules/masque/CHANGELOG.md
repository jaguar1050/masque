# MASQUE module — change log

**Prototype · not for clinical use.**

The change log of the built-in screenAIr module "Dizziness and Sinusitis (MASQUE v1)" (module id `masque`).
The entries are the rubric's own `changelog` (`masque.rubric.json`), quoted verbatim, followed by
the header of `masque.logic.js`, which records how the logic was moved. When screenAIr derives an
edited module from this one, the edit is appended to that module's own `changelog`, never here.

## Version axes

| Axis | Value | Where |
|---|---|---|
| Instrument | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | 0.3.1 | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.2.0 (lexicon 0.3.1) | `masque.rubric.json` `lexicon.goldSet` |

The release (screenAIr's own) is `APP_VERSION` in `app/src/engine/policy.js`. The label's
"v1" is display copy, not a version axis.

## 2026-10-02

- **extraction** (`/`): Extracted from the frozen baseline (app/tests/baseline/src, MANIFEST.sha256) by app/tests/tools/extract-rubric.html; field-by-field sources in modules/masque/SOURCES.md. Instrument 0.2 unchanged: item ids, weights, scale factors, cut-points and wording are moved, not edited.
- **reconciliation** (`/redFlags`): Red flags take the canonical Screener wording (text, points, action). The Scribe's shortened copy and the Simulator's third variant are dropped; the Scribe's per-flag `ask` is kept as unread data (Q5, Q6).
- **reconciliation** (`/domains`): Item text is canonical from the Screener (byte-identical to the Scribe's). The Scribe's ASK map becomes `ask`, its shortLabel map becomes `short` (n_allo has none, so the id is shown as today, Q24), VMPATHI_TAG becomes `tag`, and the Patient's clinician line `c` becomes `patientClin`. The Simulator's item copy (no scale factors, linear scoring) is dropped.
- **reconciliation** (`/contextItems`, `/locales/en/contextItems`): Patient context options keep the Patient's own values and labels (1/2/3+, <6mo/6-12mo/>12mo, no/yes); they are not realigned to the clinician bins (Q8). The gap-rule signal values (3+, >12mo, yes) are identical in both vocabularies.
- **reconciliation** (`/locales/en/steps`, `/locales/es/steps`): The Patient ITEMS domain `label`/`clinical` fields (never read) are dropped; the patient step titles come from the Patient section titles (UI.sections).
- **reconciliation** (`/sampleCases`): The five Simulator scenarios are added as sample cases sim-empty, sim-partial, sim-high, sim-redflag and sim-ruleout (group "scenario", `why` kept as the button title, FULL_HIGH inlined, `step` dropped, no complaint) (Q3).
- **reconciliation** (`/research`): The research panel's PROJECTS.MASQUE entry moves to `research`, with the brand-named knobs (score alias, artifact key, ETL script, fairness axes) and the Simulator's demo cohorts as data. BREATHE and VOICED stay in the panel as panel-only projects.
- **note** (`/label`, `/copy/note/supportingFooter`): Open questions shipped with their stated defaults: the label is display-only (Q1); the Scribe note keeps "Instrument v0.3 candidates." verbatim (Q7).

## Logic (`masque.logic.js`)

The header of `masque.logic.js` as of this change log, verbatim (the loaded file's SHA-256 is
shown in screenAIr's module information drawer and in the export manifest):

```text
// masque.logic.js — logic layer of the built-in MASQUE module (screenAIr design 03 §3.3, §3.8; WP2).
//
// format "screenair-logic", contractVersion 1, moduleId "masque". Closures appear only on
// contract LOGIC_PATHS; everything else is plain data. This file imports nothing: the registry
// fetches it as text and runs it through the loader's importSource, so the bytes executed are
// the bytes served. screenAIr never edits it; it is replaced only by uploading a whole file.
//
// MOVE RULE. Every block below is moved from the frozen baseline (app/tests/baseline/src/,
// byte-identical to app/src at commit 5448d42) without rewording, renumbering or reordering.
// The probe and SUM blocks are verbatim line ranges. In the closures, free variables are
// renamed mechanically to the state fields of design §3.3 and nothing else changes:
//   Screener/Scribe locals answers, domains, band, complaint  -> s.answers, s.domains, s.band, s.complaint
//   Screener ITEMS.discriminators                             -> s.items.discriminators
//   the band literal "low" in `strong`                        -> s.lowestBand (engine vocabulary, same value)
//   Patient yes(id), scale(id), S, L(xs)                      -> s.yes(id), s.scale(id), s.S, s.L(xs)
//   Patient locals mig, vOther, neu, disc                     -> s.groups.mig, .vOther, .neu, .disc (engine-built)
//   Patient locals migPattern, vestPattern                    -> s.migPattern, s.vestPattern (derived)
//   Patient locals mHead, mDur, vDur, days, role              -> s.scale("m_head"), ("m_dur"), ("v_vertigo"), ("i_days"), ("i_role")
//   `if (xs.length)`                                          -> `xs.length > 0` (same truth value; `when` returns a boolean)
//
// SOURCE MAP (Scr = MASQUE_Screener_v0_3.jsx, Scb = MASQUE_Scribe_v0_3.jsx,
// Pat = MASQUE_Patient_v0_3.jsx, Prb = MASQUE_Probes.js; baseline line numbers):
//   PROBES (const)              Prb L21-46 (rationale comment) and L56-143, verbatim.
//   VM_PROBES (const)           Prb L145-287, verbatim, comments included.
//   probes                      {version: Prb L290 PROBE_SET_VERSION, list: Prb L289 ALL_PROBES order}.
//                               PROBE_KIND (Prb L47-54) is engine/vocab.js; liveProbes and
//                               validateProbes (Prb L293-345) are engine/probes.js, which keeps the
//                               rescue and supporting-probe enforcement in the engine.
//   SUM (const)                 Pat L426-502, verbatim -> locales.en.sum, locales.es.sum.
//   sin, oto                    Scb L847, L848 (the Scribe complaint inputs).
//   phenotypes.derive           Scb L849: "both" when sin && oto, then "otologic" when oto. The
//                               fall-through "sinonasal" is rubric phenotypes.scribeDefault.
//   phenotypes.activation       Scb L858 (vestibular), L859 (neuro). The always-active set of
//                               Scb L857 is rubric phenotypes.alwaysActive.
//   route.strong/sinus/oto      Scr L914-916 (= Scb L1326-1328).
//   routing, 5 rules            when: Scr L917, L922, L927, L934, L941 (= Scb L1329-1333);
//                               copy.screener: Scr L918-920, L923-925, L928-930, L935-937, L942-944;
//                               copy.scribe: the object literals of Scb L1329-1333;
//                               the rationale comments Scr L932-933 and L939-940, verbatim.
//   routing no_driver           Scr L946-950, Screener only (Scb buildRecs, L1324-1335, has none).
//                               The gates ahead of these rules (Scr L895-913: red-flag override and
//                               incomplete screen; Scb L1325 with L928-930: not scorable or routing
//                               not cleared) are engine-owned (engine/rules.js routingRecs).
//   patientSummary.groups       Pat L919 (mig), L926 (vOther), L929 (neu), L936 (disc).
//   patientSummary.derived      Pat L940 (migPattern), L941 (vestPattern).
//   patientSummary.said         Pat L910-937: the 16 pushes, in order.
//   patientSummary.ask          Pat L945-953: the 9 pushes, in order; the if/else of L945-946 is
//                               two mutually exclusive rules (askBoth, askMig); askNext has no `when`.
//                               The rationale comment Pat L942-944 is kept verbatim above askBoth.
//   Elsewhere, not in this file: the gap line (Pat L955-958; engine + rubric gapRule, which calls
//   sum.gap with its booleans in reads.gapMarkers order); unsureList and the clinician block
//   (Pat L960-972, engine); referral (Scr L1456, Scb L1401/L1453; rubric phenotypes.referral);
//   CDS preview (Scr L1329-1349; rubric cds.preview + engine cdsPreview); suggestion ranking
//   (Scb L860-879, engine scribe.js).
//   reads                       design §3.8: every item, domain, flag, phenotype value and gap
//                               marker any closure or probe reads or writes.
//
// Closures are pure: they read only their state argument (or a probe's two frozen arguments)
// and the constants of this file.
```
