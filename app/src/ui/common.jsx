// ui/common.jsx — app-shared UI used by the apps and the shell alike (design 03 §2.5, §5.1, §5.6).
//
// Imports only engine files, react and lucide-react, and never an app or shell file, so no
// import cycle can pass through it. No module literal: everything module-specific comes from
// the bound module passed in.

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { CAVEATS } from "../engine/policy.js";

// ----------------------------------------------------------------------------- session

const SessionContext = createContext(null);

const EMPTY_SCREENS = { screener: null, scribe: null };
const EMPTY_COHORTS = { screener: [], scribe: [] };
const SOURCES = ["screener", "scribe"];

/**
 * Holds the session of one module workspace: the last screen each clinician app published
 * and the rows each one captured. It sits inside the shell's `<main key>`, so a module switch
 * resets it together with the apps. Never persisted (D20).
 */
export function SessionProvider({ children }) {
  const [screens, setScreens] = useState(EMPTY_SCREENS);
  const [cohorts, setCohorts] = useState(EMPTY_COHORTS);

  /** Record `snapshot` as the latest screen of `snapshot.source`. */
  const publish = useCallback((snapshot) => {
    if (!snapshot || !SOURCES.includes(snapshot.source)) return;
    setScreens((prev) => (prev[snapshot.source] === snapshot ? prev : { ...prev, [snapshot.source]: snapshot }));
  }, []);

  /** Append one captured cohort row from `source`. */
  const addRow = useCallback((source, row) => {
    if (!SOURCES.includes(source) || !row) return;
    setCohorts((prev) => ({ ...prev, [source]: [...prev[source], row] }));
  }, []);

  const value = useMemo(() => ({ screens, cohorts, publish, addRow }), [screens, cohorts, publish, addRow]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * The session API: `{screens: {screener, scribe}, cohorts: {screener: Row[], scribe: Row[]},
 * publish(snapshot), addRow(source, row)}`. Must be called inside a SessionProvider: a
 * missing provider is a wiring error, never an empty session (absent data is not negative data).
 * @returns {Object} SessionApi (engine/contract.js typedef)
 */
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession() must be called inside a <SessionProvider>.");
  return value;
}

// ----------------------------------------------------------------------------- chrome

const CSS = `
.sa-common-badge{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11.5px;line-height:1.35;
  font-weight:600;color:#7A3B12;background:#FBEBDD;border:1px solid #EFC9A8;border-radius:999px;padding:3px 10px}
.sa-common-badge.full{border-radius:10px;padding:6px 10px;font-size:12px}
.sa-common-badge .sa-common-sub{font-weight:500}
.sa-common-badge.patient{color:#4F4A3A;background:#F3EFE3;border-color:#DDD3B8}
.sa-common-tabnote{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.45;color:#3D4F51;
  background:#F1F5F4;border:1px solid #D7E1DF;border-radius:10px;padding:8px 12px;margin:0 0 12px}
.sa-common-tabnote svg{flex:0 0 auto;margin-top:1px}
`;

function Style() {
  return <style>{CSS}</style>;
}

// Root of a classified module (a Module), or null. Labels follow the classification, never a
// provenance block alone (design §3.4 step 7, §3.11).
function rootOf(module) {
  const c = module && module.classification;
  return c && c.root && c.root !== module ? c.root : null;
}

function scoringDiffersFromRoot(module) {
  const root = rootOf(module);
  return !!(root && root.hashes && module.hashes && root.hashes.scoringHash !== module.hashes.scoringHash);
}

/**
 * Provenance marker for a non-built-in module (design §3.11 "Provenance display", §5.1, §5.3).
 * Renders nothing for a built-in.
 *
 * - `audience="clinician"`, `variant="compact"` (shell header): "uploaded" / "edited" /
 *   "edited · scoring changed".
 * - `audience="clinician"`, `variant="full"` (above a score): "Edited module" / "Uploaded module",
 *   plus "scores not comparable with {root} {rootVersion}" when the scoring differs from the root's.
 * - `audience="patient"`: the patient marker only (CAVEATS.patient.*.short); never a score word.
 *
 * @param {{module: Object, audience?: "clinician"|"patient", variant?: "compact"|"full"}} props
 */
export function ProvenanceBadge({ module, audience = "clinician", variant = "compact" }) {
  if (!module || module.origin === "builtin" || !module.origin) return null;
  const kind = module.classification && module.classification.kind;
  const edited = module.origin === "derived";
  const uploaded = module.origin === "uploaded" || kind === "derived-from-upload";

  if (audience === "patient") {
    const lines = [];
    if (edited) lines.push(CAVEATS.patient.edited);
    if (uploaded) lines.push(CAVEATS.patient.uploaded);
    if (!lines.length) return null;
    return (
      <>
        <Style />
        <span className="sa-common-badge patient" data-testid="provenance-badge" title={lines.map((l) => l.en).join(" ")}>
          {lines.map((l) => l.short).join(" · ")}
        </span>
      </>
    );
  }

  const scoringChanged = scoringDiffersFromRoot(module);
  const titles = [];
  if (edited) titles.push(CAVEATS.edited.en);
  if (uploaded) titles.push(CAVEATS.uploaded.en);
  const root = rootOf(module);
  if (scoringChanged) {
    titles.push(CAVEATS.scoringChanged.en.replace("{root}", root.name).replace("{rootVersion}", root.instrumentVersion));
  }

  if (variant === "full") {
    const heads = [];
    if (edited) heads.push("Edited module");
    if (uploaded) heads.push("Uploaded module");
    return (
      <>
        <Style />
        <div className="sa-common-badge full" data-testid="provenance-badge" title={titles.join(" ")}>
          <TriangleAlert size={14} aria-hidden="true" />
          <span>{heads.join(" · ")}</span>
          {scoringChanged && (
            <span className="sa-common-sub">scores not comparable with {root.name} {root.instrumentVersion}</span>
          )}
        </div>
      </>
    );
  }

  const parts = [];
  if (edited) parts.push("edited");
  if (uploaded) parts.push("uploaded");
  if (scoringChanged) parts.push("scoring changed");
  return (
    <>
      <Style />
      <span className="sa-common-badge" data-testid="provenance-badge" title={titles.join(" ")}>
        {parts.join(" · ")}
      </span>
    </>
  );
}

/** The fixed tab notes (design §5.1). Engine chrome, English only (§7.5). */
export const TAB_NOTES = {
  clinician: "This tab keeps its own answers. The Clinician Screener, the Ambient Scribe and the Patient Companion are separate screens; none of them reads another's answers.",
  research: "Research reads the last screen and the captured rows of the Screener and the Scribe; choose the source below.",
};

/**
 * The note a tab panel opens with. `kind="clinician"` for the Screener and Scribe,
 * `kind="research"` for Research; `children` replaces the text when given.
 * @param {{kind?: "clinician"|"research", children?: React.ReactNode}} props
 */
export function TabNote({ kind = "clinician", children }) {
  return (
    <>
      <Style />
      <div className="sa-common-tabnote" data-testid="tab-note" role="note">
        <Info size={14} aria-hidden="true" />
        <span>{children ?? TAB_NOTES[kind]}</span>
      </div>
    </>
  );
}
