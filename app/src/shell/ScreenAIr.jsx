// shell/ScreenAIr.jsx — the screenAIr shell (design 03 §5.1, §5.2, §5.9, §5.10; D10, D12, D16,
// D20, D26, D27). Owner: WP12. Default export; receives {env} from the page through boot (D25).
//
// Top to bottom: the header (wordmark, the module picker as the first control, the
// provenance badge of a non-built-in, the ⓘ button) with the caveat strip; the tab bar with
// the microphone indicator; the restore banner and the unsaved-module notice; the module
// workspace (or InvalidModule) inside the print frame; the version footer; overlays.
//
// Every module comes from shell/registry.js: the built-ins through loadBuiltins({env}), the
// rest through the upload dialog, the editor's Apply or a restore from this browser. A module
// switch goes through switchModule(), which first lists what the switch clears. The
// microphone stops whenever a patient-facing view is shown, and on every module switch.
// No side effects at import time; no module literal.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, HeartHandshake, Info, Mic, PencilRuler, Stethoscope } from "lucide-react";
import { APP_VERSION, CAVEATS, SITE } from "../engine/policy.js";
import { provenanceLines } from "../engine/lineage.js";
import { projectForPatient } from "../engine/patient.js";
import { downloadBytes } from "../engine/download.js";
import { buildExportFiles } from "../engine/exportAll.js";
import { zipStore } from "../engine/zip.js";
import { ProvenanceBadge } from "../ui/common.jsx";
import { patientPrintHeader } from "../apps/PatientCompanion.jsx";
import {
  forgetSaved, listSaved, loadBuiltins, markEntry, prepareRubric, register, registered, restoreSaved, saveModule, unregister,
} from "./registry.js";
import {
  CaveatStrip, ConfirmDialog, InvalidModule, LIVE_VOICE, MicIndicator, ModuleInfo, PatientFooter, PrintFrame, TAB_LABELS,
  Toast, VersionFooter, clinicianMarkers, moduleErrorLine, originWord,
} from "./chrome.jsx";
import ModulePicker from "./ModulePicker.jsx";
import ModuleWorkspace, { TAB_KEYS } from "./ModuleWorkspace.jsx";
import UploadDialog from "./UploadDialog.jsx";
import { SHELL_CSS } from "./shell.css.js";

const TABS = [
  { key: "screener", Icon: Stethoscope },
  { key: "scribe", Icon: Mic },
  { key: "patient", Icon: HeartHandshake },
  { key: "research", Icon: FlaskConical },
  { key: "editor", Icon: PencilRuler },
];
const DEFAULT_TAB = "screener";
const TAB_STORAGE_KEY = "screenair.tab";
const MODULE_STORAGE_KEY = "screenair.module";
const EMPTY_DIRTY = { screener: null, scribe: null, patient: null, research: null };
const DIRTY_ORDER = ["screener", "scribe", "patient", "research"];

export const MIC_TOAST = "Microphone stopped — the Patient Companion never runs with the microphone on.";
export const RETURN_TEXT = "The clinician view shows scores, research data and module tools. Hand the device back to the clinician before continuing.";
export const HAND_TEXT = "The Patient Companion still holds the answers entered in this session. Start a new session so the next patient does not see them, or continue this one.";
export const NO_LONGER_LOADED = "This questionnaire is no longer loaded on this device. Please hand the device back to your clinician.";

// ----------------------------------------------------------------------------- routing

function readHash() {
  try {
    const p = new URLSearchParams(location.hash.replace(/^#/, ""));
    const tab = p.get("tab");
    return { tab: TAB_KEYS.includes(tab) ? tab : null, module: p.get("module") || null, mode: p.get("mode") === "patient" ? "patient" : null };
  } catch (_) { return { tab: null, module: null, mode: null }; }
}

function writeHash({ tab, module, mode }) {
  try {
    const p = new URLSearchParams(location.hash.replace(/^#/, ""));
    p.set("tab", tab);
    if (module) p.set("module", module); else p.delete("module");
    if (mode === "patient") p.set("mode", "patient"); else p.delete("mode");
    const next = p.toString();
    if (next !== location.hash.replace(/^#/, "")) history.replaceState(history.state, "", `${location.pathname}${location.search}#${next}`);
  } catch (_) { /* history unavailable: routing still works in memory */ }
}

function sessionGet(key) {
  try { return sessionStorage.getItem(key); } catch (_) { return null; }
}
function sessionSet(key, value) {
  try { if (value == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch (_) { /* storage blocked */ }
}

function isUsable(entry) {
  return !!(entry && entry.module && entry.validation && entry.validation.ok);
}

function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ----------------------------------------------------------------------------- shell

export default function ScreenAIr({ env }) {
  const initialHash = useMemo(readHash, []);
  const [phase, setPhase] = useState({ status: "loading", error: null });
  const [loadSeq, setLoadSeq] = useState(0);
  const [entries, setEntries] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [tab, setTab] = useState(() => initialHash.tab || (TAB_KEYS.includes(sessionGet(TAB_STORAGE_KEY)) ? sessionGet(TAB_STORAGE_KEY) : DEFAULT_TAB));
  const [mode, setMode] = useState(initialHash.mode === "patient" ? "patient" : "clinician");
  const [patientMissing, setPatientMissing] = useState(false);
  const [voice, setVoice] = useState("idle");
  const [stopSignal, setStopSignal] = useState(0);
  const [dirty, setDirty] = useState(EMPTY_DIRTY);
  const [moduleErrors, setModuleErrors] = useState([]);
  const [printCtx, setPrintCtx] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [restoreDismissed, setRestoreDismissed] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [patientSession, setPatientSession] = useState(0);
  const tabRefs = useRef({});
  const activeRef = useRef(null);
  activeRef.current = activeKey;
  // The sticky header's height, as --sa-sticky-top for sticky content inside a panel (the
  // Rubric Editor's section nav and side panel), so it sticks below the header, not under it.
  const headerRef = useRef(null);
  const [stickyTop, setStickyTop] = useState(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver !== "function") return undefined;
    const measure = () => setStickyTop(Math.ceil(el.getBoundingClientRect().height) + 8);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const entry = useMemo(() => entries.find((e) => e.key === activeKey) || null, [entries, activeKey]);
  const module = isUsable(entry) ? entry.module : null;
  const patientView = useMemo(() => (module ? projectForPatient(module) : null), [module]);
  const patientFacing = mode === "patient" || tab === "patient";
  const micAllowed = mode !== "patient" && tab !== "patient";

  const refreshSaved = useCallback((list) => {
    const loadedIds = new Set(list.filter((e) => e.module).map((e) => e.module.id));
    setSavedList(listSaved({ entries: list }).filter((s) => !loadedIds.has(s.id)));
  }, []);

  // ------------------------------------------------------------------ built-ins
  useEffect(() => {
    let live = true;
    setPhase({ status: "loading", error: null });
    loadBuiltins({ env }).then(
      (list) => {
        if (!live) return;
        for (const e of list) register(e);
        const all = registered();
        setEntries(all);
        refreshSaved(all);
        const builtins = all.filter((e) => e.origin === "builtin");
        const byId = (id) => builtins.find((e) => (e.module ? e.module.id : null) === id) || null;
        const fallback = builtins.find((e) => e.isDefault) || builtins[0] || null;
        const cur = activeRef.current;
        let next = null;
        if (cur && all.some((e) => e.key === cur)) next = cur;
        else if (initialHash.mode === "patient" && initialHash.module) {
          const hit = byId(initialHash.module);
          if (!hit) setPatientMissing(true);
          next = hit ? hit.key : (fallback ? fallback.key : null);
        } else {
          const hit = byId(initialHash.module) || byId(sessionGet(MODULE_STORAGE_KEY));
          next = (hit || fallback || {}).key || null;
        }
        setActiveKey(next);
        setPhase({ status: "ready", error: null });
      },
      (err) => { if (live) setPhase({ status: "error", error: String(err && err.message ? err.message : err) }); },
    );
    return () => { live = false; };
  }, [env, loadSeq, initialHash, refreshSaved]);

  // ------------------------------------------------------------------ routing
  useEffect(() => {
    if (phase.status !== "ready") return;
    const id = entry && entry.module ? entry.module.id : null;
    const builtin = entry && entry.origin === "builtin";
    writeHash({ tab, module: mode === "patient" ? (patientMissing ? initialHash.module : id) : (builtin ? id : null), mode });
    sessionSet(TAB_STORAGE_KEY, tab);
    if (builtin && id) sessionSet(MODULE_STORAGE_KEY, id);
  }, [phase.status, tab, mode, entry, patientMissing, initialHash]);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    const onHash = () => {
      const h = readHash();
      if (h.tab && h.tab !== tabRef.current) setTab(h.tab);
      if (h.mode === "patient" && modeRef.current !== "patient") setMode("patient");
      // Leaving patient mode needs the confirmation: a hand edit of the address does not.
      if (h.mode !== "patient" && modeRef.current === "patient") writeHash({ tab: tabRef.current, module: h.module, mode: "patient" });
      if (!h.tab) writeHash({ tab: tabRef.current, module: h.module, mode: modeRef.current });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // ------------------------------------------------------------------ title
  useEffect(() => {
    if (mode === "patient") { document.title = "screenAIr · Patient Companion"; return; }
    if (!entry) { document.title = "screenAIr"; return; }
    const label = entry.module ? entry.module.label : entry.label;
    const word = entry.module ? originWord(entry.module) : "";
    document.title = `screenAIr · ${label}${word ? ` (${word})` : ""}`;
  }, [mode, entry]);

  // ------------------------------------------------------------------ microphone (D16)
  const stopped = useRef(false);
  useEffect(() => {
    const live = LIVE_VOICE.includes(voice);
    if (!micAllowed && live) {
      setStopSignal((n) => n + 1);
      if (!stopped.current) { stopped.current = true; setToast(MIC_TOAST); }
    }
    if (micAllowed) stopped.current = false;
  }, [micAllowed, voice]);
  useEffect(() => {
    const onHide = () => setStopSignal((n) => n + 1);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // ------------------------------------------------------------------ unsaved derived modules
  const unsaved = useMemo(() => entries.filter((e) => e.origin === "derived" && !e.savedAt && !e.downloadedAt), [entries]);
  useEffect(() => {
    if (!unsaved.length) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; return ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved.length]);

  // ------------------------------------------------------------------ callbacks from the apps
  const onDirty = useCallback((which, summary) => {
    setDirty((d) => (d[which] === (summary || null) ? d : { ...d, [which]: summary || null }));
  }, []);
  const onModuleError = useCallback((err) => {
    if (!err) return;
    setModuleErrors((list) => (list.some((x) => x.family === err.family && x.ruleId === err.ruleId && x.message === err.message) ? list : [...list, err]));
  }, []);
  const onVoiceState = useCallback(({ state }) => setVoice(state || "idle"), []);
  const onPrintContext = useCallback((pc) => setPrintCtx(pc || null), []);
  const closeToast = useCallback(() => setToast(null), []);

  const selectTab = useCallback((key, focus = false) => {
    setTab(key);
    if (focus && tabRefs.current[key]) tabRefs.current[key].focus();
  }, []);
  const onOpenTab = useCallback((key) => { if (TAB_KEYS.includes(key)) setTab(key); }, []);

  // ------------------------------------------------------------------ module switch (§5.1)
  const doSwitch = useCallback((key, after) => {
    setStopSignal((n) => n + 1);
    setVoice("idle");
    setDirty(EMPTY_DIRTY);
    setModuleErrors([]);
    setPrintCtx(null);
    setActiveKey(key);
    if (after) after();
  }, []);

  const dirtyLines = useMemo(() => DIRTY_ORDER.filter((k) => dirty[k]).map((k) => `${TAB_LABELS[k]} — ${dirty[k]}`), [dirty]);

  const switchModule = useCallback((key, { after = null, title = "Switch module?", confirmLabel = "Switch module" } = {}) => {
    if (!key || key === activeKey) { if (after) after(); return; }
    if (!dirtyLines.length) { doSwitch(key, after); return; }
    setConfirm({
      kind: "switch", title, lines: dirtyLines,
      notes: ["Rubric Editor drafts are kept.", "Export captured rows from the Screener or Scribe first if you need them."],
      confirmLabel,
      onConfirm: () => { setConfirm(null); doSwitch(key, after); },
    });
  }, [activeKey, dirtyLines, doSwitch]);

  // ------------------------------------------------------------------ downloads
  const fetchBytes = useCallback(async (p) => {
    const res = await fetch(new URL(p, env.appBase).href, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${p}`);
    return res.arrayBuffer();
  }, [env]);

  const downloadEntries = useCallback(async (list, filename) => {
    try {
      const files = await buildExportFiles(list, { appVersion: APP_VERSION, now: new Date().toISOString(), fetchBytes });
      downloadBytes(filename, zipStore(files), "application/zip");
      const at = new Date().toISOString();
      for (const e of list) if (e.origin === "derived") markEntry(e.key, { downloadedAt: at });
      setEntries(registered());
      return true;
    } catch (err) {
      setToast(`Download failed: ${String(err && err.message ? err.message : err).split("\n")[0]}`);
      return false;
    }
  }, [fetchBytes]);

  const onDownloaded = useCallback((keys) => {
    const at = new Date().toISOString();
    for (const k of keys || []) {
      const e = registered().find((x) => x.key === k);
      if (e && e.origin === "derived") markEntry(k, { downloadedAt: at });
    }
    setEntries(registered());
  }, []);

  const onDownloadAll = useCallback(() => downloadEntries(registered(), `screenair-modules-${localDate()}.zip`), [downloadEntries]);
  const downloadOne = useCallback((e) => downloadEntries([e], `${e.module ? e.module.id : "module"}.zip`), [downloadEntries]);

  // ------------------------------------------------------------------ editor Apply (§5.7)
  const onApply = useCallback(async ({ rubric, remember = true, switchTo = false } = {}) => {
    const r = await prepareRubric(rubric, { entries: registered(), env });
    if (!r.entry) {
      const detail = r.report ? r.report.errors.slice(0, 5).map((x) => `${x.code} · ${x.path || "/"} · ${x.msg}`) : [];
      const errors = r.skipped ? [`This module is ${r.skipped}`] : [...r.errors, ...detail];
      return { ok: false, error: errors.join("; "), errors, report: r.report, skipped: r.skipped };
    }
    let e = r.entry;
    register(e);
    if (remember) {
      const savedAt = saveModule(e);
      if (savedAt) { markEntry(e.key, { savedAt }); e = { ...e, savedAt }; }
    }
    const all = registered();
    setEntries(all);
    refreshSaved(all);
    if (switchTo) switchModule(e.key);
    else setToast(`Created ${e.module.label}. Choose it from the Module menu when you want to use it.`);
    return { ok: true, entry: e, key: e.key, module: e.module, label: e.module.label, report: r.report };
  }, [env, refreshSaved, switchModule]);

  // ------------------------------------------------------------------ uploads, saved modules
  const onLoaded = useCallback((key) => {
    const all = registered();
    setEntries(all);
    refreshSaved(all);
    setUploadOpen(false);
    if (key) switchModule(key);
  }, [refreshSaved, switchModule]);

  const restoreAll = useCallback(async () => {
    const problems = [];
    let n = 0;
    for (const s of savedList) {
      try { register(await restoreSaved(s.id, { entries: registered() })); n += 1; }
      catch (err) { problems.push(`${s.label}: ${String(err && err.message ? err.message : err)}`); }
    }
    const all = registered();
    setEntries(all);
    refreshSaved(all);
    setRestoreDismissed(true);
    setToast(problems.length ? `Restored ${n} module${n === 1 ? "" : "s"}; not restored — ${problems.join(" · ")}` : `Restored ${n} module${n === 1 ? "" : "s"}. Choose one from the Module menu.`);
  }, [savedList, refreshSaved]);

  const rememberEntries = useCallback((list) => {
    for (const e of list) {
      const savedAt = saveModule(e);
      if (savedAt) markEntry(e.key, { savedAt });
    }
    const all = registered();
    setEntries(all);
    refreshSaved(all);
  }, [refreshSaved]);

  const removeEntry = useCallback((e) => {
    const finish = () => {
      try { unregister(e.key); } catch (_) { /* built-ins stay */ }
      const all = registered();
      setEntries(all);
      refreshSaved(all);
      setInfoOpen(false);
    };
    if (e.key === activeKey) {
      const fallback = entries.find((x) => x.origin === "builtin" && x.isDefault) || entries.find((x) => x.origin === "builtin");
      switchModule(fallback ? fallback.key : null, { after: finish, title: "Remove the active module?", confirmLabel: "Remove and switch module" });
    } else {
      finish();
    }
  }, [activeKey, entries, switchModule, refreshSaved]);

  // ------------------------------------------------------------------ patient mode (D26)
  // A companion that holds answers is not handed on silently: the next patient would see them.
  const patientDirtyRef = useRef(null);
  patientDirtyRef.current = dirty.patient;
  const handToPatient = useCallback(() => {
    if (!patientDirtyRef.current) { setMode("patient"); return; }
    setConfirm({
      kind: "hand", title: "Start a new patient session?", body: HAND_TEXT, lines: [], notes: [],
      cancelLabel: "Cancel", confirmLabel: "Start a new patient session",
      extra: { label: "Continue this session", testId: "confirm-continue", onClick: () => { setConfirm(null); setMode("patient"); } },
      onConfirm: () => {
        setConfirm(null);
        setDirty((d) => ({ ...d, patient: null }));
        setPatientSession((n) => n + 1);
        setMode("patient");
      },
    });
  }, []);
  const askReturn = useCallback(() => {
    setConfirm({
      kind: "return", title: "Return to clinician view?", body: RETURN_TEXT, lines: [], notes: [],
      cancelLabel: "Stay in patient mode", confirmLabel: "Return to clinician view", initialFocus: "cancel",
      onConfirm: () => { setConfirm(null); setPatientMissing(false); setMode("clinician"); },
    });
  }, []);
  const closeConfirm = useCallback(() => setConfirm(null), []);
  const closeUpload = useCallback(() => setUploadOpen(false), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);

  // Roving focus across the tab list (arrow keys, Home, End).
  const onTabKeyDown = useCallback((e) => {
    const i = TAB_KEYS.indexOf(tab);
    let next = null;
    if (e.key === "ArrowRight") next = TAB_KEYS[(i + 1) % TAB_KEYS.length];
    else if (e.key === "ArrowLeft") next = TAB_KEYS[(i - 1 + TAB_KEYS.length) % TAB_KEYS.length];
    else if (e.key === "Home") next = TAB_KEYS[0];
    else if (e.key === "End") next = TAB_KEYS[TAB_KEYS.length - 1];
    if (next) { e.preventDefault(); selectTab(next, true); }
  }, [tab, selectTab]);

  // Keep the active tab in view when the tab bar scrolls inside itself (narrow screens).
  useEffect(() => {
    const el = tabRefs.current[tab];
    const bar = el && el.parentElement;
    if (!bar || bar.scrollWidth <= bar.clientWidth) return;
    const left = el.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft || left + el.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = Math.max(0, left - 16);
  }, [tab]);

  // ------------------------------------------------------------------ chrome text
  const lastError = moduleErrors.length ? moduleErrors[moduleErrors.length - 1] : null;
  const caveatLines = module
    ? (patientFacing ? provenanceLines(module, "patient", { locale: printCtx ? printCtx.loc : "en" }) : provenanceLines(module, "clinician"))
    : [];
  const printHeader = module && patientFacing && patientView
    ? patientPrintHeader(patientView, printCtx)
    : [CAVEATS.prototype, ...clinicianMarkers(module)].join(" · ");

  // ------------------------------------------------------------------ render
  const clinician = mode === "clinician";
  let content;
  if (phase.status === "loading") {
    content = <div className="sa-placeholder" data-testid="shell-loading"><div className="sa-placeholder-card"><p>Loading the module…</p></div></div>;
  } else if (phase.status === "error") {
    content = (
      <div className="sa-invalid" role="alert" data-testid="registry-error">
        <div className="sa-invalid-card">
          <h2>The module list could not be loaded</h2>
          <p>{phase.error}</p>
          <button type="button" className="sa-btn" onClick={() => setLoadSeq((n) => n + 1)}>Retry</button>
        </div>
      </div>
    );
  } else if (mode === "patient" && patientMissing) {
    content = <div className="sa-invalid" role="alert" data-testid="patient-missing"><div className="sa-invalid-card"><p>{NO_LONGER_LOADED}</p></div></div>;
  } else if (!entry) {
    content = <div className="sa-invalid" role="alert"><div className="sa-invalid-card"><p>No module is loaded.</p></div></div>;
  } else if (!module) {
    content = <InvalidModule entry={entry} onRetry={entry.origin === "builtin" ? () => setLoadSeq((n) => n + 1) : null} />;
  } else {
    content = (
      <main key={entry.key} className="sa-main" data-module={module.id}>
        <ModuleWorkspace
          module={module} entry={entry} entries={entries} env={env} appVersion={APP_VERSION} site={SITE}
          tab={tab} mode={mode} micAllowed={micAllowed} stopSignal={stopSignal}
          onDirty={onDirty} onModuleError={onModuleError} onVoiceState={onVoiceState} onOpenTab={onOpenTab}
          onPrintContext={onPrintContext} onApply={onApply} onDownloadAll={onDownloadAll} onDownloaded={onDownloaded}
          onHandToPatient={handToPatient} patientSession={patientSession}
        />
      </main>
    );
  }

  const restoreShown = clinician && phase.status === "ready" && savedList.length > 0 && !restoreDismissed;

  return (
    <div className="sa-shell" data-tab={tab} data-mode={mode} data-milestone="M3" style={stickyTop ? { "--sa-sticky-top": `${stickyTop}px` } : undefined}>
      <style>{SHELL_CSS}</style>

      <header className="sa-top" ref={headerRef}>
        <div className="sa-top-in">
          <div className="sa-brand">
            <span className="sa-mark" aria-hidden="true"><Stethoscope size={16} /></span>
            <span>screen<span className="sa-ai">AI</span>r</span>
          </div>
          {clinician ? (
            <div className="sa-controls">
              <ModulePicker entries={entries} activeKey={activeKey} disabled={phase.status !== "ready"}
                onSelect={(key) => switchModule(key)} onUploadRequest={() => setUploadOpen(true)} />
              {module && module.origin !== "builtin" ? <ProvenanceBadge module={module} audience={patientFacing ? "patient" : "clinician"} /> : null}
              <button type="button" className="sa-icon-btn sa-info-btn" onClick={() => setInfoOpen(true)} disabled={!entry}
                aria-label="Module information" title="Module information" data-testid="module-info-button">
                <Info size={17} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="sa-patient-title" data-testid="patient-mode-title">{patientView ? patientView.name : ""}</div>
          )}
        </div>
        <CaveatStrip lines={caveatLines} errorLine={clinician || !patientFacing ? moduleErrorLine(lastError) : null} />
      </header>

      {clinician ? (
        <nav className="sa-tabs" aria-label="screenAIr tabs">
          <div className="sa-tabs-row">
            <div className="sa-tabs-in" role="tablist" aria-orientation="horizontal">
              {TABS.map(({ key, Icon }) => (
                <button
                  key={key} type="button" role="tab" id={`sa-tab-${key}`} className="sa-tab" data-tab={key}
                  aria-selected={tab === key} aria-controls={`sa-panel-${key}`} tabIndex={tab === key ? 0 : -1}
                  ref={(el) => { tabRefs.current[key] = el; }}
                  onClick={() => selectTab(key)} onKeyDown={onTabKeyDown}
                >
                  <Icon size={15} aria-hidden="true" />
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>
            <MicIndicator state={voice} tab={tab} onStop={() => setStopSignal((n) => n + 1)} />
          </div>
        </nav>
      ) : null}

      {restoreShown ? (
        <div className="sa-banner sa-restore" role="region" aria-label="Saved modules" data-testid="restore-banner">
          <span>{savedList.length} module{savedList.length === 1 ? "" : "s"} saved in this browser{savedList.some((s) => s.needsLogicUpload) ? " (some need their logic file uploaded again)" : ""}</span>
          <button type="button" className="sa-btn sa-btn-small" onClick={restoreAll} data-testid="restore-saved">Restore</button>
          <button type="button" className="sa-btn sa-btn-small" onClick={() => setRestoreDismissed(true)}>Dismiss</button>
          <button type="button" className="sa-link" onClick={() => { for (const s of savedList) forgetSaved(s.id); refreshSaved(registered()); }}>Forget them</button>
        </div>
      ) : null}

      {clinician && unsaved.length ? (
        <div className="sa-banner sa-unsaved" role="region" aria-label="Unsaved modules" data-testid="unsaved-notice">
          <span>{unsaved.length} edited module{unsaved.length === 1 ? "" : "s"} exist{unsaved.length === 1 ? "s" : ""} only in this tab and will be lost on reload</span>
          <button type="button" className="sa-btn sa-btn-small" onClick={() => rememberEntries(unsaved)}>Remember</button>
          <button type="button" className="sa-btn sa-btn-small" onClick={() => downloadEntries(unsaved, unsaved.length === 1 && unsaved[0].module ? `${unsaved[0].module.id}.zip` : `screenair-modules-${localDate()}.zip`)}>Download</button>
        </div>
      ) : null}

      <PrintFrame header={printHeader}>
        {content}
      </PrintFrame>

      {clinician
        ? (module ? <VersionFooter appVersion={APP_VERSION} moduleId={module.id} versions={module.versions} /> : <footer className="sa-footer" id="sa-footer"><p>{CAVEATS.prototype}</p></footer>)
        : <PatientFooter view={patientMissing ? null : patientView} appVersion={APP_VERSION} />}

      {!clinician ? (
        <div className="sa-return">
          <button type="button" className="sa-btn sa-btn-small" onClick={askReturn} data-testid="return-to-clinician">Return to clinician view</button>
        </div>
      ) : null}

      <UploadDialog open={uploadOpen} onClose={closeUpload} entries={entries} env={env} onLoaded={onLoaded}
        activeEntry={entry} onDownloadCurrent={entry && entry.module ? () => downloadOne(entry) : null} />
      <ModuleInfo open={infoOpen && clinician} entry={entry} entries={entries} appVersion={APP_VERSION} onClose={closeInfo}
        onRemember={entry && entry.origin !== "builtin" ? (e) => rememberEntries([e]) : null}
        onDownload={entry && entry.module ? downloadOne : null}
        onRemove={entry && entry.origin !== "builtin" ? removeEntry : null} />
      <ConfirmDialog open={!!confirm} title={confirm ? confirm.title : ""} body={confirm ? confirm.body : null}
        lines={confirm ? confirm.lines : []} notes={confirm ? confirm.notes : []}
        confirmLabel={confirm ? confirm.confirmLabel : "OK"} cancelLabel={confirm && confirm.cancelLabel ? confirm.cancelLabel : "Cancel"}
        onConfirm={confirm ? confirm.onConfirm : () => {}} onCancel={closeConfirm}
        initialFocus={confirm && confirm.initialFocus ? confirm.initialFocus : "confirm"} extra={confirm && confirm.extra ? confirm.extra : null}
        testId={confirm ? ({ return: "return-dialog", hand: "hand-dialog" }[confirm.kind] || "switch-dialog") : "switch-dialog"} />
      <Toast message={toast} onDone={closeToast} />
    </div>
  );
}
