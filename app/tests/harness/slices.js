// tests/harness/slices.js — SHA-256-pinned inline-logic slices of the frozen baseline
// (design 03 §8.2). No imports; nothing happens at import time.
//
// A slice is the exact text from `start` through `end` (both exact substrings of the file,
// each found exactly once in that order). Its SHA-256 and its parameter list are pinned
// here; any mismatch makes the calling suite INVALID. A slice becomes a function in three
// steps: wrap it by shape, compile the wrapper with Babel (classic JSX runtime, script
// mode), and bind it with `new Function(...params, code)`.
//
// Wrap kinds:
//   "value": `${slice}\nreturn ${returns};`  (a declaration such as `const recs = useMemo(...)`,
//            or plain statements such as the gapFlags array)
//   "jsx":   `return (<React.Fragment>${slice}</React.Fragment>);`  (a JSX expression container)
//   "expr":  `return (${slice});`  (a bare expression, e.g. the probe rail's kind list)
//
// The §8.2 slices: Screener `recs` (Scr L891-952), `gapFlags` (Scr L873-878) and the CDS
// preview (Scr L1329-1349, with the `bandMeta` table it reads); Scribe `complaint`
// (Scb L846-850), the active-domain set (Scb L857-859), `suggestions` (Scb L856-879, with
// `skipped`) and `gapFlags` (Scb L916-920); and the probe rail's grouping and truncation
// (Scb L1152-1155) for the probes suite.

export const SLICES = {
  // Screener: the gap-alert labels (Scr L873-877).
  "screener.gapFlags": {
    file: "MASQUE_Screener_v0_3.jsx",
    start: "  const gapFlags = [",
    end: "].filter(Boolean);",
    sha256: "9a5f32e36023f9afaf7445826e73e12a1b05b58e9cf6438805bdd96d6f8fb909",
    wrap: "value",
    returns: "gapFlags",
    params: ["ctx"],
  },
  // Screener: the band display metadata (Scr L865-870); bandMeta.label feeds the CDS preview.
  "screener.bandMeta": {
    file: "MASQUE_Screener_v0_3.jsx",
    start: "  const bandMeta = {",
    end: "  }[band];",
    sha256: "5122578895f92ce0f8fb0010dff6ad39b8d9fb01f00353661beaaeefe4b2445d",
    wrap: "value",
    returns: "bandMeta",
    params: ["band"],
  },
  // Screener: the routing recommendations (Scr L891-952).
  "screener.recs": {
    file: "MASQUE_Screener_v0_3.jsx",
    start: "  const recs = useMemo(() => {",
    end: "  }, [band, complaint, domains, answers, scorable, answered, floor, ceiling, override, emergent, activeFlags]);",
    sha256: "13c8f29985e337ddd07983fd3d40faff312c255c626a6bc6399db2b57e898c7a",
    wrap: "value",
    returns: "recs",
    params: ["React", "useMemo", "ITEMS", "DOMAIN_ORDER", "band", "complaint", "domains", "answers", "scorable", "answered",
      "floor", "ceiling", "override", "emergent", "activeFlags"],
  },
  // Screener: the CDS Hooks preview, a JSX expression container (Scr L1330-1350).
  "screener.cdsPreview": {
    file: "MASQUE_Screener_v0_3.jsx",
    start: "{override ? (\n        <div className=\"cds\"",
    end: "place the indicated referral.\n          </div>\n        </div>\n      )}",
    sha256: "0ff570da7b5e65ce1caef109a6f5d334ced265213cdf8ff64d6a838075c8d315",
    wrap: "jsx",
    params: ["React", "override", "emergent", "activeFlags", "scorable", "band", "complaint", "total", "bandMeta"],
  },
  // Scribe: the derived complaint (Scb L846-850).
  "scribe.complaint": {
    file: "MASQUE_Scribe_v0_3.jsx",
    start: "  const complaint = useMemo(() => {",
    end: "  }, [answers]);",
    sha256: "9f270390e521f95b0150640d9ab72378d2b7027254374cb371b445b2b7bcec2c",
    wrap: "value",
    returns: "complaint",
    params: ["React", "useMemo", "answers"],
  },
  // Scribe: the active-domain set (Scb L857-859).
  "scribe.activeDomains": {
    file: "MASQUE_Scribe_v0_3.jsx",
    start: "    const active = new Set([\"migraine\"",
    end: "active.add(\"neuro\");",
    sha256: "615f674bf6860ffb2cc3bdcd6ece662b236cca9f98273483800200053d13c314",
    wrap: "value",
    returns: "active",
    params: ["complaint", "answers"],
  },
  // Scribe: the suggested questions, with skipped prompts (Scb L856-879).
  "scribe.suggestions": {
    file: "MASQUE_Scribe_v0_3.jsx",
    start: "  const suggestions = useMemo(() => {",
    end: "  }, [answers, complaint, vmp, scorable, skipped]);",
    sha256: "031e8f53dce7a967afffd5a1c749644df7b9e0a65678566df6bed3ff5ef11b59",
    wrap: "value",
    returns: "suggestions",
    params: ["React", "useMemo", "ALL_ITEMS", "ITEMS", "ASK", "VMPATHI_TAG", "VMPATHI_INFO", "answers", "complaint", "vmp",
      "scorable", "skipped"],
  },
  // Scribe: the gap-alert labels (Scb L916-920).
  "scribe.gapFlags": {
    file: "MASQUE_Scribe_v0_3.jsx",
    start: "  const gapFlags = [",
    end: "].filter(Boolean);",
    sha256: "00fea65344257eb7ee75e61a2adddd155873258912fa46730a57d573338d2e6c",
    wrap: "value",
    returns: "gapFlags",
    params: ["ctx"],
  },
  // Scribe: the probe rail's kind order (Scb L1152).
  "scribe.railKinds": {
    file: "MASQUE_Scribe_v0_3.jsx",
    start: "[\"safety\",\"rescue\",\"criteria\"",
    end: "\"exam\"]",
    sha256: "167124eefcee21b4db5fe162a2bf04cc2785fe5506f333ac9bb37ec1f68c7678",
    wrap: "expr",
    params: [],
  },
  // Scribe: one rail group — the kind's live probes and the truncation (Scb L1153-1155).
  "scribe.railGroup": {
    file: "MASQUE_Scribe_v0_3.jsx",
    start: "                      const grp = probes.filter(x => x.kind === kind);",
    end: "grp : grp.slice(0, 2);",
    sha256: "d5b6a47ff58123e94f9629528a457cce54bc6b59375f54d3c52070e33161cbab",
    wrap: "value",
    returns: "{ kind, shown, total: grp.length }",
    params: ["probes", "kind"],
  },
  // Screener: the clinician context questions (Scr L1190-1194), for the values suite.
  "screener.contextRows": {
    file: "MASQUE_Screener_v0_3.jsx",
    start: "  const rows = [\n    { id: \"c_clin\"",
    end: "  ];",
    sha256: "38a510a421019a912bfdcab99fb45db06065991655baddaea7955c4a5ce1f628",
    wrap: "value",
    returns: "rows",
    params: [],
  },
  // Screener: the phenotype picker options (Scr L1072-1076), for the values suite.
  "screener.phenotypePicker": {
    file: "MASQUE_Screener_v0_3.jsx",
    start: "[\n                { k: \"sinonasal\"",
    end: "\"Mixed sinonasal and otologic\" },\n              ]",
    sha256: "ddc40e47a70e4b692f0902ae23cc13b0ca646210c7242f5b9dd1d2ab62d1b5db",
    wrap: "expr",
    params: [],
  },
};

/** Cut a slice out of `text`. Throws (with `invalid = true`) when an anchor is missing or repeated. */
export function cutSlice(text, spec, name = "slice") {
  const fail = (msg) => { const e = new Error(`slice ${name}: ${msg}`); e.invalid = true; return e; };
  const s = text.indexOf(spec.start);
  if (s < 0) throw fail("start anchor not found");
  if (text.indexOf(spec.start, s + 1) >= 0) throw fail("start anchor is not unique");
  const e = text.indexOf(spec.end, s + spec.start.length);
  if (e < 0) throw fail("end anchor not found after the start anchor");
  return text.slice(s, e + spec.end.length);
}

/** The wrapper source for a slice, by its wrap kind. */
export function wrapSlice(slice, spec) {
  if (spec.wrap === "value") return `${slice}\nreturn ${spec.returns};`;
  if (spec.wrap === "jsx") return `return (<React.Fragment>${slice}</React.Fragment>);`;
  if (spec.wrap === "expr") return `return (${slice});`;
  throw new Error(`unknown slice wrap "${spec.wrap}"`);
}

/** Compile a wrapper with Babel standalone (classic runtime) and bind it with `new Function`. */
export function compileSlice(wrapper, params, Babel) {
  const code = Babel.transform(wrapper, {
    presets: [["react", { runtime: "classic" }]],
    sourceType: "script",
    parserOpts: { allowReturnOutsideFunction: true },
    compact: false,
  }).code;
  // eslint-disable-next-line no-new-func
  return new Function(...params, code);
}
