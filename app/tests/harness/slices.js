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
//
// The rules suite (WP13) adds the remaining §8.2 slices: Screener `recs` (Scr L891-952);
// Scribe `complaint`, active-domain set, `suggestions` and `gapFlags`; the CDS preview.

export const SLICES = {
  "screener.gapFlags": {
    file: "MASQUE_Screener_v0_3.jsx",
    start: "  const gapFlags = [",
    end: "].filter(Boolean);",
    sha256: "9a5f32e36023f9afaf7445826e73e12a1b05b58e9cf6438805bdd96d6f8fb909",
    wrap: "value",
    returns: "gapFlags",
    params: ["ctx"],
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
