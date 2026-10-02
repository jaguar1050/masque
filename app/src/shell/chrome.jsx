// shell/chrome.jsx — shell chrome (design 03 §2.6, §5.1, §5.10). Owner: WP12.
//
// M1 parts: CaveatStrip, PrintFrame, VersionFooter. MicIndicator, InvalidModule, ModuleInfo,
// ConfirmDialog, Toast and PatientModeBar arrive at M2/M3. Styles live in shell.css.js and
// apply under .sa-shell. Imports only react and engine/policy.js (no WP3 file), so the M1
// shell works whatever else has merged. No module literal: every module-specific value
// arrives as a prop.

import React from "react";
import { CAVEATS } from "../engine/policy.js";

/**
 * The caveat strip (§5.1 item 2), always rendered.
 * @param {{lines?: string[], errorLine?: (string|null)}} props
 *   lines: provenance lines for a non-built-in module (none for a built-in);
 *   errorLine: the "Module logic error — …" line while a closure error is recorded.
 */
export function CaveatStrip({ lines = [], errorLine = null }) {
  return (
    <div className="sa-caveat" id="sa-caveat" role="note" data-testid="caveat-strip">
      <div className="sa-caveat-in">
        <b>{CAVEATS.prototype}</b>
        {lines.map((l, i) => <span className="sa-caveat-line" key={i}>{l}</span>)}
        {errorLine ? <span className="sa-caveat-line sa-caveat-error" role="alert">{errorLine}</span> : null}
      </div>
    </div>
  );
}

/**
 * Print frame (§5.10): a table whose thead repeats at the top of every printed page and
 * reserves its own space there. On screen the table is plain blocks and the thead is hidden.
 * @param {{header: string, children: React.ReactNode}} props
 */
export function PrintFrame({ header, children }) {
  return (
    <table className="sa-print-frame" role="presentation">
      <thead className="sa-print-head"><tr><td>{header}</td></tr></thead>
      <tbody><tr><td>{children}</td></tr></tbody>
    </table>
  );
}

const DASH = "—";

/**
 * The five version axes, each from its owner, never collapsed (D9): release, instrument,
 * lexicon, probe set, gold set.
 * @param {{appVersion: string, moduleId: string,
 *          versions: {instrument: string, lexicon?: (string|null), probeSet?: (string|null),
 *                     goldSet?: (string|null), goldSetLexicon?: (string|null)}}} props
 */
export function VersionFooter({ appVersion, moduleId, versions }) {
  const v = versions || {};
  const goldSet = v.goldSet ? v.goldSet : `${DASH} (not benchmarked)`;
  const stale = v.goldSet && v.goldSetLexicon && v.lexicon && v.goldSetLexicon !== v.lexicon
    ? ` (benchmarked on lexicon ${v.goldSetLexicon}; not re-run)` : "";
  const axes = [
    ["release", `release ${appVersion}`],
    ["module", `module ${moduleId}`],
    ["instrument", `instrument ${v.instrument || DASH}`],
    ["lexicon", `lexicon ${v.lexicon || DASH}`],
    ["probe-set", `probe set ${v.probeSet || DASH}`],
    ["gold-set", `gold set ${goldSet}${stale}`],
  ];
  return (
    <footer className="sa-footer" id="sa-footer" data-testid="version-footer">
      <div className="sa-axes">
        {axes.map(([k, text]) => <span className="sa-axis" data-axis={k} key={k}>{text}</span>)}
      </div>
      <p>{CAVEATS.prototype}</p>
      <p>Served as source; compiled in your browser.</p>
    </footer>
  );
}
