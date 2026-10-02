# Module fixtures (design 03 §2.9, §8.0, §8.3)

Local-only test data for the screenAIr harness. **Placeholder text only** ("Example item A1"):
nothing here is clinical content, and nothing here is a MASQUE item, flag, phrase or sentence.
Every file is data: suites fetch it with `h.fixture(path, "json" | "text" | "bytes")` or bind
it with `h.loadFixture(name)`; nothing here is ever imported by path. Source text that holds an
`import`, a re-export or a dynamic `import()` is stored as `.txt`, because the loader would try
to build any specifier it found inside a compiled file (§6.5).

## Modules

| Files | What it is |
|---|---|
| `shape.rubric.json` | The **shape fixture**: a data-only rubric (`logicBinding: "generic"`) that is structurally different from MASQUE — 2 domains (Σ max 100), no negative domain, one 3-option scale item, no phenotypes, no context items, no gap rule, no lexicon, no probes, no research, English patient wording only, one red flag. `h.loadFixture("shape")`. |
| `shape.logic.js` | Logic for the shape structure (`moduleId: "shape"`): two routing rules (one with function copy) and a fallback. |
| `shape-bound.rubric.json` | The shape rubric bound to `shape.logic.js` (`logicBinding: {moduleId: "shape"}`). `h.loadFixture("shape-bound")` finds the logic by its `moduleId`. Also the rubric the V46-V48 upload fixtures pair with. |
| `placeholder.rubric.json` + `placeholder.logic.js` | The **placeholder module**: every optional family present — negative domain, context item with a gap signal, phenotypes (derive, activation, referral, CDS term), sample cases and a scenario, demo patient and transcript, lexicon (bool, ctx, scale, multi, red-flag cues), `en` + unreviewed `es` locales, patient summary rules and `sum` templates, probes (safety, rescue, criteria, phenotype). `h.loadFixture("placeholder")`. |

## Upload fixtures (the `upload` suite and the upload spec, §8.3)

| File | Expected outcome |
|---|---|
| `upload-import.logic.txt` | rejected: static import (V57) |
| `upload-dynamic-import.logic.txt` | rejected: dynamic `import()` (V57) |
| `upload-reexport.logic.txt` | rejected: re-export (V57) |
| `upload-jsx.logic.txt` | rejected: JSX is a syntax error without the react preset |
| `upload-syntax.logic.txt` | rejected: syntax error, reported as `line:col` (4:32) |
| `upload-no-default.logic.txt` | rejected: no default export |
| `upload-global-side-effect.logic.txt` | `inspectSource` classifies it as logic and lists `window`, `globalThis`, `localStorage` (V59) while `globalThis.__uploadFixtureSideEffect` stays unset |
| `upload-computed-format.logic.txt` | `inspectSource` format `null`: "executable (kind determined after consent)" |
| `upload-module.module.txt` | a self-contained `screenair-module` (`rubric` + `logic`, id `shape-module`); upload it as a `.js` |
| `upload-throwing.logic.txt` | with `shape-bound.rubric.json`: V46 (a routing closure throws) |
| `upload-undeclared-read.logic.txt` | with `shape-bound.rubric.json`: V47 (reads `ex_b2` without declaring it) |
| `upload-nondeterministic.logic.txt` | with `shape-bound.rubric.json`: V48 (different result on the second call) |
| `upload-reserved-logic.logic.txt` | V8: "Logic id 'masque' is reserved for the built-in logic" |
| `upload-builtin-label.rubric.json` | V8: "Label '…' belongs to a built-in module" |
| `upload-v38-caveat.rubric.json` | V38: a copy slot holds a caveat string |
| `upload-v9-template.rubric.json` | V9: `fhir.codeSystem` without `{id}` |
| `upload-v37-population.rubric.json` | V37: `research.population` on a plain upload |
| `upload-markup.rubric.json` | accepted; the markup in the label, an item text and a patient question must render inert (`window.__injected` stays unset) |
| `upload-newer-contract.rubric.json` | "Made for a newer screenAIr" (`contractVersion: 2`) |
| `upload-not-screenair.json` | "Not a screenAIr file" |
| `upload-not-json.json.txt` | "Not valid JSON: …" (upload it as `.json`) |
| `upload-invalid-utf8.json.bin` | "Not valid UTF-8" (upload it as `.json`; bytes `C3 28 80` inside the label) |
| `upload-crc-error.zip` | zip error: the CRC-32 of `shape/shape.rubric.json` is wrong |
| `upload-traversal.zip` | zip error: an entry named `../shape.rubric.json` |
| `upload-zip64.zip` | zip error: ZIP64 sizes (`0xFFFFFFFF` + a zip64 extra field) |
| `upload-sheet.csv`, `upload-sheet.xlsx` | the spreadsheet message |

Built at run time instead of stored: the oversize file (`LIMITS` + 1 bytes), duplicate ids
(upload the same rubric twice), "logic alone" (`shape.logic.js` without its rubric), "needs
logic" (`shape-bound.rubric.json` alone), and the MASQUE-derived cases (the built-in rubric
with weights or the id changed, a forged `derivedFrom`), which start from the served
`modules/masque/masque.rubric.json` so no MASQUE content is copied here.

The zip files are store-only archives with a fixed 1980-01-01 timestamp, written once by a
throwaway Node script; `unzip -l` lists them and `unzip -t upload-crc-error.zip` reports the
bad CRC. Their `manifest.json` follows §5.8 (`format: "screenair-export"`).
