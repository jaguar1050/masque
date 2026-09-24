# Project MASQUE — general screening application

React clinical-screening prototype being refactored from four hard-wired MASQUE
apps into a general screening application with a module selector (first module:
"Dizziness", carrying the MASQUE criteria).

## Layout

- `reference/MASQUE_v0.3.1/` — pristine upstream release (docs, changelog, etl, benchmarks). **Read-only.**
- `reference/fixed-src/` — the seven source files as deployed, with three TDZ fixes applied. **Read-only. This is the feature-parity baseline and the rollback copy.**
- `app/` — the application being built. `assets/masque-loader.js` is the runtime; `src/` holds the code.
- `docs/refactor/` — phase artifacts from the refactor (inventory, design, contracts, verification).

## Runtime: there is NO build step and NO Node on this machine

Pages load React 18.3.1, react-dom and lucide-react through an `<script type="importmap">`
(esm.sh, `lucide-react` pinned `?external=react`), plus Babel standalone.
`app/assets/masque-loader.js` fetches each module, transforms JSX (classic runtime), builds
its relative dependencies recursively, rewrites those specifiers to blob: URLs and imports
the entry. Consequences every file must respect:

- **Relative imports carry explicit extensions**: `./foo.jsx`, `./bar.js`. Browsers do no extension resolution.
- **Only these bare specifiers exist**: `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `lucide-react`. No other npm packages. Adding one means adding it to the import map in every page.
- Every `.jsx` file must `import React from "react"` (classic JSX runtime → `React.createElement`).
- Plain JavaScript only. No TypeScript, no decorators, no CSS modules, no `.css` imports. Components keep the existing pattern: a `CSS` template string rendered with `<style>{CSS}</style>`, class names prefixed per component.
- Module-level `const` must be declared **before** first use — three temporal-dead-zone bugs were already fixed in the upstream source (Scribe `ALL_ITEMS`, Screener `buildBundle({answers})`, ResearchReadinessPanel `mit`). Do not reintroduce that pattern.
- Files are UTF-8 without BOM, LF line endings. Source contains non-ASCII (Bárány, em dashes, Spanish) — preserve it byte-for-byte when moving content.
- ES module top level runs once per page; there is no HMR. Keep modules side-effect free apart from exports.

## Clinical content rules

- **Never invent clinical content.** Items, weights, cut-points, red flags, phrases, probes, patient copy and Spanish strings are *moved* into module definitions, never rewritten, reworded, renumbered or "improved". If two upstream copies diverge, pick the canonical one named in `docs/refactor/01-inventory.md` and record the choice.
- Every user-facing surface keeps the marker **"Prototype · not for clinical use"**. Pages stay `noindex, nofollow`.
- The four upstream invariants hold everywhere: absent data is never rendered as negative data; gate, don't warn; report the denominator or don't report; say what a number is (illustrative stays labelled illustrative).
- The five version axes (release / instrument / lexicon / probe set / gold set) are deliberately different numbers. Do not collapse them; put each with its owner as the design doc specifies.
- The Patient app deliberately shows no score, band, probability or research capture. Generic components must not "helpfully" add them.
- Supporting (phenotype) probes never write to a scored item; rescue probes stay live while their target reads negative. `MASQUE_Probes.js` enforces these — keep that enforcement in the engine, not the content.

## Testing a change

The dev server serves the **project root** (so the parity harness can fetch `reference/`):

```
& 'C:\Users\User\AppData\Local\Python\pythoncore-3.14-64\python.exe' -m http.server 8901 --directory C:\Users\User\Documents\MASQUE
```

Then open `http://127.0.0.1:8901/app/` (pages under `app/`, reference files under
`/reference/fixed-src/`). A page is healthy when
`document.documentElement.dataset.masqueReady === "true"`, `#root` has children and the
console is clean. The loader paints a red panel with the stack on any failure. The pane may
serve stale modules — the loader uses `cache: 'no-cache'`, but hard-reload if in doubt.
The deployed site never includes `reference/`; anything under `app/tests/` is local-only.

### Loader API (`app/assets/masque-loader.js`)

- `boot({ entry, mountId })` — compile the entry module and its relative graph, mount its default export.
- `importModule(spec, { baseUrl, append })` — compile and `import()` any module, returning its
  namespace. `append` is source text added to that module before compiling; the parity harness
  uses it to export module-private internals from `reference/fixed-src/` files at runtime, e.g.
  `importModule('/reference/fixed-src/MASQUE_Screener_v0_3.jsx', { append: 'export { ITEMS, useScore };' })`.
  Patched copies get their own cache key; dependencies are always built unpatched. Verified working.

## Do not

- Modify anything under `reference/`.
- Deploy. The FTP scripts live in `Documents\FTP CREDENTIALS`; the lead handles uploads. (FTP root serves at `https://qurrenthealth.com/masque/`; the prototype is at `/masque/demo/`.)
- Add a bundler, package.json dependencies, or a framework. The no-build constraint is real.
