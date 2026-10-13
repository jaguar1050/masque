// shell/ModuleWorkspace.jsx — the five tab panels of one module (design 03 §2.6, §5.1, §5.9).
// Owner: WP12.
//
// Rendered inside the shell's <main key={entry.key}>, so a module switch remounts it, and with
// it every app and the session store. It owns the SessionProvider and builds onScreen /
// onCapture from the session API. Panels mount on their first visit and stay mounted with
// `hidden` afterwards, so a tab switch keeps each app's state. In patient mode only the
// Patient panel is shown; the others stay mounted (the clinician's screens survive) but
// carry `hidden` and `inert`.
//
// The Rubric Editor is compiled on its first visit through env.loader.importModule: it is the
// largest tab and only the clinician who opens it pays for it. It shares the page's module
// cache, so it sees the same engine and session instances as every other tab.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionProvider, useSession } from "../ui/common.jsx";
import { PATIENT_CHROME, langTag, projectForPatient } from "../engine/patient.js";
import Screener from "../apps/Screener.jsx";
import Scribe from "../apps/Scribe.jsx";
import PatientCompanion from "../apps/PatientCompanion.jsx";
import ResearchTab from "../apps/ResearchTab.jsx";
import { PatientModeBar, TAB_LABELS } from "./chrome.jsx";

/** The tab keys in tab-bar order (§5.1 item 3). */
export const TAB_KEYS = ["screener", "scribe", "patient", "research", "editor"];

/** Where the Rubric Editor is compiled from, relative to app/ (D25). */
const EDITOR_PATH = "src/apps/RubricEditor.jsx";

/**
 * @param {{module: Object, entry: Object, entries: Object[], env: Object, appVersion: string, site: Object,
 *          tab: string, mode: ("clinician"|"patient"), micAllowed: boolean, stopSignal: number,
 *          onDirty: function(string, (string|null)): void, onModuleError: function(Object): void,
 *          onVoiceState: function({state: string}): void, onOpenTab: function(string): void,
 *          onPrintContext: function(Object): void, onApply: function(Object): Promise<Object>,
 *          onDownloadAll: function(): Promise<any>, onDownloaded: function(string[]): void,
 *          onHandToPatient: function(): void, patientSession?: number, patientLoc?: string}} props
 *   patientSession: bumped by the shell to start a new Patient Companion session (a fresh instance).
 *   patientLoc: the companion's locale (release 0.4.2): in patient mode the Patient panel is
 *               labelled with the locale's patient title (PATIENT_CHROME[loc].title), tagged, and
 *               outside English the hidden clinician panels carry lang="en". In patient mode the
 *               Patient panel has no aria-labelledby (no tab bar is rendered); its aria-label names it.
 */
export default function ModuleWorkspace(props) {
  return (
    <SessionProvider>
      <Panels {...props} />
    </SessionProvider>
  );
}

function Panels({
  module, entry, entries, env, appVersion, site, tab, mode, micAllowed, stopSignal,
  onDirty, onModuleError, onVoiceState, onOpenTab, onPrintContext, onApply, onDownloadAll, onDownloaded, onHandToPatient, patientSession = 0,
  patientLoc = "en",
}) {
  const { publish, addRow } = useSession();
  const onCapture = useCallback(({ source, row }) => addRow(source, row), [addRow]);
  const shown = mode === "patient" ? "patient" : tab;
  const [visited, setVisited] = useState(() => new Set([shown]));
  useEffect(() => {
    setVisited((v) => (v.has(shown) ? v : new Set([...v, shown])));
  }, [shown]);

  const view = useMemo(() => projectForPatient(module), [module]);
  // Release 0.4.8: a built-in's patient introduction video (registry.json `patientVideo`, on its
  // registry entry only), as an absolute URL against the app/ folder; null for any other module.
  const patientVideo = useMemo(() => {
    const rel = entry && typeof entry.patientVideo === "string" ? entry.patientVideo : null;
    try { return rel && env && typeof env.appBase === "string" ? new URL(rel, env.appBase).href : null; } catch (_) { return null; }
  }, [entry, env]);

  // Patient mode: the patient panel's label is the companion's title in its locale (release 0.4.2);
  // the clinician tab label everywhere else.
  const patientLabel = mode === "patient" && patientLoc !== "en" && PATIENT_CHROME[patientLoc] && PATIENT_CHROME[patientLoc].title
    ? PATIENT_CHROME[patientLoc].title : null;

  const panel = (key, children) => {
    const isShown = key === shown;
    const blocked = mode === "patient" && key !== "patient";
    const ownLabel = key === "patient" ? patientLabel : null;
    // In patient mode with a non-English companion, <html lang> follows the companion, so the
    // hidden clinician panels (English labels and content) are tagged English (release 0.4.2).
    const panelLang = ownLabel ? langTag(patientLoc) : (blocked && patientLoc !== "en" ? "en" : undefined);
    // Patient mode renders no tab bar, so the Patient panel is named by its aria-label alone
    // (the locale's title outside English), never by a reference to a tab that is not there.
    const labelledBy = mode === "patient" && key === "patient" ? undefined : `sa-tab-${key}`;
    return (
      <div
        key={key}
        role="tabpanel"
        id={`sa-panel-${key}`}
        aria-labelledby={labelledBy}
        aria-label={ownLabel || TAB_LABELS[key]}
        lang={panelLang}
        className={`sa-panel sa-panel-${key}`}
        data-panel={key}
        hidden={!isShown}
        inert={blocked ? "" : undefined}
      >
        {visited.has(key) || isShown ? children : null}
      </div>
    );
  };

  const common = { module, appVersion, site, onScreen: publish, onCapture, onDirty, onModuleError, onOpenTab };

  return (
    <>
      {panel("screener", <Screener {...common} />)}
      {panel("scribe", <Scribe {...common} onVoiceState={onVoiceState} stopSignal={stopSignal} micAllowed={micAllowed} />)}
      {panel("patient", (
        <>
          {mode === "clinician" ? <PatientModeBar key="bar" module={module} appBase={env.appBase} onHand={onHandToPatient} /> : null}
          <PatientCompanion key={`companion-${patientSession}`} view={view} appVersion={appVersion} video={patientVideo} onDirty={onDirty} onModuleError={onModuleError} onPrintContext={onPrintContext} />
        </>
      ))}
      {panel("research", <ResearchTab module={module} appVersion={appVersion} env={env} onDirty={onDirty} />)}
      {panel("editor", <EditorPanel entries={entries} activeKey={entry.key} env={env} onApply={onApply} onDownloadAll={onDownloadAll} onDownloaded={onDownloaded} />)}
    </>
  );
}

/** Compiles apps/RubricEditor.jsx on first visit and renders it, or says why it cannot. */
function EditorPanel({ entries, activeKey, env, onApply, onDownloadAll, onDownloaded }) {
  const [state, setState] = useState({ status: "loading", Editor: null, error: null });
  const tries = useRef(0);
  const load = useCallback(() => {
    let live = true;
    tries.current += 1;
    setState({ status: "loading", Editor: null, error: null });
    env.loader.importModule(new URL(EDITOR_PATH, env.appBase).href).then(
      (ns) => {
        if (!live) return;
        if (typeof ns.default !== "function") setState({ status: "error", Editor: null, error: "The Rubric Editor has no default export." });
        else setState({ status: "ready", Editor: ns.default, error: null });
      },
      (err) => { if (live) setState({ status: "error", Editor: null, error: String(err && err.message ? err.message : err).split("\n")[0] }); },
    );
    return () => { live = false; };
  }, [env]);
  useEffect(() => load(), [load]);

  if (state.status === "loading") return <div className="sa-placeholder" data-testid="editor-loading"><div className="sa-placeholder-card"><p>Loading the Rubric Editor…</p></div></div>;
  if (state.status === "error") {
    return (
      <div className="sa-placeholder" data-testid="editor-unavailable">
        <div className="sa-placeholder-card">
          <div>
            <h2>Rubric Editor</h2>
            <p>The Rubric Editor could not be loaded: {state.error}</p>
            <button type="button" className="sa-btn" onClick={load}>Retry</button>
          </div>
        </div>
      </div>
    );
  }
  const Editor = state.Editor;
  return <Editor entries={entries} activeKey={activeKey} env={env} onApply={onApply} onDownloadAll={onDownloadAll} onDownloaded={onDownloaded} />;
}
