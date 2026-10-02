// shell/ScreenAIr.jsx — the screenAIr shell, milestone M1 "legacy shell" (design 03 §5.1, §9.13).
// Owner: WP12. Default export; receives {env} from the page through boot (D25, §6.4).
//
// M1 runs the shell over the LEGACY apps, unchanged: tabs 1-3 mount the legacy Screener,
// Scribe and Patient default exports and Research mounts the legacy Population page. Only the
// active tab is mounted, because the legacy CSS is unscoped (:root tokens, `*` rules) and two
// legacy apps on one page could restyle each other. The Rubric Editor waits for the engine.
//
// This file deliberately imports neither shell/registry.js nor any WP3 engine file, so
// screenair.html works whatever has merged. At M2 the legacy block below is replaced by
// registry.loadBuiltins({env}) and the generic apps inside ModuleWorkspace, and the module
// literals go with it (t-ids applies to src/shell from M2 on).
//
// No side effects at import time.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stethoscope, Mic, HeartHandshake, FlaskConical, PencilRuler, Construction } from "lucide-react";
import { APP_VERSION, CAVEATS } from "../engine/policy.js";
import { CaveatStrip, PrintFrame, VersionFooter } from "./chrome.jsx";
import { SHELL_CSS } from "./shell.css.js";

// ------------------------------------------------------------------ M1 legacy block (→ M2)
import LegacyScreener from "../MASQUE_Screener_v0_3.jsx";
import LegacyScribe from "../MASQUE_Scribe_v0_3.jsx";
import LegacyPatient from "../MASQUE_Patient_v0_3.jsx";
import LegacyPopulation from "../MASQUE_Population.jsx";
import { LEXICON_VERSION } from "../MASQUE_Extraction.js";
import { PROBE_SET_VERSION } from "../MASQUE_Probes.js";

// The one built-in at M1, until the rubric and the registry carry these (§3.8, D9).
// label: user requirement 2026-10-02 (display copy, not an axis).
// instrument: Scr L45 (INSTRUMENT_VERSION, not exported by the legacy Screener).
// lexicon / probe set: read from their owners, MASQUE_Extraction.js and MASQUE_Probes.js.
// gold set: masque_extraction_goldset.json _meta.version, benchmarked on lexicon 0.3.1 (§3.8).
const M1_MODULE = {
  id: "masque",
  label: "Dizziness and Sinusitis (MASQUE v1)",
  versions: {
    instrument: "0.2",
    lexicon: LEXICON_VERSION,
    probeSet: PROBE_SET_VERSION,
    goldSet: "0.2.0",
    goldSetLexicon: "0.3.1",
  },
};

const M1_PANELS = {
  screener: LegacyScreener,
  scribe: LegacyScribe,
  patient: LegacyPatient,
  research: LegacyPopulation,
};
// ------------------------------------------------------------------ end of M1 legacy block

const UPLOAD_VALUE = "__upload__";

const TABS = [
  { key: "screener", label: "Clinician Screener", Icon: Stethoscope },
  { key: "scribe", label: "Ambient Scribe", Icon: Mic },
  { key: "patient", label: "Patient Companion", Icon: HeartHandshake },
  { key: "research", label: "Research", Icon: FlaskConical },
  { key: "editor", label: "Rubric Editor", Icon: PencilRuler },
];
const TAB_KEYS = TABS.map(t => t.key);
const DEFAULT_TAB = "screener";
const TAB_STORAGE_KEY = "screenair.tab";

/** `#tab=<key>` (other hash parameters are kept), or null. */
function tabFromHash() {
  if (typeof location === "undefined") return null;
  const t = new URLSearchParams(location.hash.replace(/^#/, "")).get("tab");
  return TAB_KEYS.includes(t) ? t : null;
}

/** Set `tab=<key>` in the hash with replaceState (no history entry), other parameters kept. */
function writeTabToHash(tab) {
  try {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (params.get("tab") !== tab) {
      params.set("tab", tab);
      history.replaceState(history.state, "", `${location.pathname}${location.search}#${params.toString()}`);
    }
  } catch (_) { /* history unavailable: routing still works in memory */ }
}

function tabFromSession() {
  try {
    const t = sessionStorage.getItem(TAB_STORAGE_KEY);
    return TAB_KEYS.includes(t) ? t : null;
  } catch (_) { return null; }
}

function initialTab() {
  return tabFromHash() || tabFromSession() || DEFAULT_TAB;
}

/** The module picker at M1: the built-in, then a disabled Upload (§5.2, §9.13). */
function ModulePickerM1({ module }) {
  return (
    <div className="sa-controls">
      <label htmlFor="sa-module">Module</label>
      <select
        id="sa-module"
        className="sa-select"
        value={module.id}
        onChange={() => { /* one selectable option at M1 */ }}
        aria-describedby="sa-upload-note"
      >
        <option value={module.id}>{module.label}</option>
        <option value={UPLOAD_VALUE} disabled>Upload</option>
      </select>
      <span className="sa-note" id="sa-upload-note">Upload arrives with the module engine.</span>
    </div>
  );
}

/** Known M1 limits, stated on the page (§9.13). */
function M1Limits() {
  return (
    <div className="sa-limits" data-testid="m1-limits">
      <details className="sa-limits-box" open>
        <summary>Early preview — these tabs run the existing apps unchanged</summary>
        <ul>
          <li>Switching tabs loses that tab's state: each tab starts fresh when you come back to it.</li>
          <li>The microphone stops when you leave the Ambient Scribe tab.</li>
          <li>
            The Simulator's scenarios and demo cohorts are still on the{" "}
            <a href="./simulator.html">Simulator page</a>.
          </li>
          <li>Upload and the Rubric Editor arrive with the module engine.</li>
        </ul>
      </details>
    </div>
  );
}

function EditorPlaceholder() {
  return (
    <div className="sa-placeholder">
      <div className="sa-placeholder-card">
        <Construction size={22} aria-hidden="true" />
        <div>
          <h2>Rubric Editor</h2>
          <p>Available when the module engine lands</p>
        </div>
      </div>
    </div>
  );
}

export default function ScreenAIr({ env = null }) {
  const module = M1_MODULE;
  const [tab, setTab] = useState(initialTab);
  const tabRefs = useRef({});

  const tabNow = useRef(tab);
  tabNow.current = tab;

  // Hash routing: write #tab=<key> back (other parameters kept), remember it for the session.
  useEffect(() => {
    writeTabToHash(tab);
    try { sessionStorage.setItem(TAB_STORAGE_KEY, tab); } catch (_) { /* storage blocked */ }
  }, [tab]);

  // Follow a hash changed by a link or by hand; an unknown or missing tab is rewritten to
  // the tab on screen, so the address never names a tab that is not shown.
  useEffect(() => {
    const onHash = () => {
      const t = tabFromHash();
      if (t) setTab(t);
      else writeTabToHash(tabNow.current);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Keep the active tab in view when the tab bar scrolls inside itself (narrow screens).
  useEffect(() => {
    const el = tabRefs.current[tab];
    const bar = el && el.parentElement;
    if (!bar || bar.scrollWidth <= bar.clientWidth) return;
    const left = el.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft || left + el.offsetWidth > bar.scrollLeft + bar.clientWidth) {
      bar.scrollLeft = Math.max(0, left - 16);
    }
  }, [tab]);

  useEffect(() => { document.title = `screenAIr · ${module.label}`; }, [module.label]);

  const selectTab = useCallback((key, focus = false) => {
    setTab(key);
    if (focus && tabRefs.current[key]) tabRefs.current[key].focus();
  }, []);

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

  const Panel = M1_PANELS[tab] || null;

  return (
    <div className="sa-shell" data-tab={tab} data-milestone="M1">
      <style>{SHELL_CSS}</style>

      <header className="sa-top">
        <div className="sa-top-in">
          <div className="sa-brand">
            <span className="sa-mark" aria-hidden="true"><Stethoscope size={16} /></span>
            <span>screen<span className="sa-ai">AI</span>r</span>
          </div>
          <ModulePickerM1 module={module} />
        </div>
        <CaveatStrip />
      </header>

      <nav className="sa-tabs" aria-label="screenAIr tabs">
        <div className="sa-tabs-in" role="tablist" aria-orientation="horizontal">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`sa-tab-${key}`}
              className="sa-tab"
              data-tab={key}
              aria-selected={tab === key}
              aria-controls={`sa-panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              ref={el => { tabRefs.current[key] = el; }}
              onClick={() => selectTab(key)}
              onKeyDown={onTabKeyDown}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <M1Limits />

      <PrintFrame header={CAVEATS.prototype}>
        <main className="sa-main">
          <div
            key={tab}
            role="tabpanel"
            id={`sa-panel-${tab}`}
            aria-labelledby={`sa-tab-${tab}`}
            className={`sa-panel sa-panel-${tab}`}
            data-panel={tab}
          >
            {Panel ? <Panel /> : <EditorPlaceholder />}
          </div>
        </main>
      </PrintFrame>

      <VersionFooter appVersion={APP_VERSION} moduleId={module.id} versions={module.versions} />
    </div>
  );
}
