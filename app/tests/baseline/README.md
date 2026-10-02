# Baseline — the primary parity oracle

`src/` is a byte-identical copy of the eleven files in `app/src/` as they stood
before the screenAIr refactor changed anything there (design `03-design.md`, D2, §8.1):

- Source commit: `5448d427a628611b2f9086a6349ac7a3c2ba126f` ("Add the screenAIr design
  (03-design.md)"). `app/src/` at that commit is identical to `app/src/` at
  `bc27e74` (the commit the design was written against); the design commit only added
  `docs/refactor/03-design.md`.
- Taken by WP0, before any change to `app/src/`.

| File | Design citation prefix |
|---|---|
| `MASQUE_Screener_v0_3.jsx` | `Scr L…` |
| `MASQUE_Scribe_v0_3.jsx` | `Scb L…` |
| `MASQUE_Patient_v0_3.jsx` | `Pat L…` |
| `MASQUE_Simulator.jsx` | `Sim L…` |
| `MASQUE_Extraction.js` | `Ext L…` |
| `MASQUE_Probes.js` | `Prb L…` |
| `ResearchReadinessPanel.jsx` | `RRP L…` |
| `MASQUE_Voice.js` | `Voice L…` |
| `MASQUE_Population.jsx` | `Pop L…` |
| `PopulationArtifact.jsx` | `PA L…` |
| `MASQUE_SchemaCheck.js` | `SC L…` |

`MANIFEST.sha256` is in `sha256sum` format with paths relative to this folder. Check it with

```
cd app/tests/baseline && sha256sum -c MANIFEST.sha256
```

The test harness (`h.oracle`) verifies the manifest in the browser before it imports any
baseline file; a mismatch makes the calling suite INVALID rather than a false PASS.

**Never edit these files.** They are the frozen oracle the generic code is held to. They are
loaded through `importModule(…, {append})`, never mounted by a page. Local-only: `app/tests/`
is never deployed.
