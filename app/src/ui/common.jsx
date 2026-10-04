// ui/common.jsx — app-shared UI used by the apps and the shell alike (design 03 §2.5, §5.1, §5.6).
//
// Imports only engine files, react and lucide-react, and never an app or shell file, so no
// import cycle can pass through it. No module literal: everything module-specific comes from
// the bound module passed in.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { CAVEATS } from "../engine/policy.js";
import { availability } from "../engine/lineage.js";

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

  /** Drop every captured row of `source` (an app's Reset clears its rows here too, so Research
   *  and the module-switch confirmation never list rows the app no longer shows). */
  const clearRows = useCallback((source) => {
    if (!SOURCES.includes(source)) return;
    setCohorts((prev) => (prev[source].length ? { ...prev, [source]: [] } : prev));
  }, []);

  const value = useMemo(() => ({ screens, cohorts, publish, addRow, clearRows }), [screens, cohorts, publish, addRow, clearRows]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * The session API: `{screens: {screener, scribe}, cohorts: {screener: Row[], scribe: Row[]},
 * publish(snapshot), addRow(source, row), clearRows(source)}`. Must be called inside a
 * SessionProvider: a missing provider is a wiring error, never an empty session (absent data is
 * not negative data).
 * @returns {Object} SessionApi (engine/contract.js typedef)
 */
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession() must be called inside a <SessionProvider>.");
  return value;
}

/**
 * The session API, or null when no SessionProvider is mounted (an app on a dev page or in a
 * test, outside the shell). For an app that keeps its own copy of what it reports and only
 * mirrors it into the session when there is one; never a substitute for useSession() where a
 * session is required.
 * @returns {?Object} SessionApi or null
 */
export function useOptionalSession() {
  return useContext(SessionContext);
}

// ----------------------------------------------------------------------------- availability

/**
 * The per-tab availability summary (§5.2 item 4, §4.16), e.g. "Clinician Screener ✓ ·
 * Ambient Scribe: no voice capture (no lexicon) · Patient Companion ✓ · Research: no research
 * configuration". Worded exactly as shell/chrome.jsx's builder (Module info, the upload
 * dialog), so an app — which may not import the shell — says the same thing.
 */
export function availabilityText(module) {
  let av;
  try { av = availability(module); } catch (_) { return ""; }
  const parts = ["Clinician Screener ✓"];
  parts.push(av.scribe.reason ? `Ambient Scribe: ${av.scribe.reason}` : "Ambient Scribe ✓");
  parts.push(av.patient.available ? "Patient Companion ✓" : `Patient Companion unavailable (${av.patient.reason || "no patient wording"})`);
  if (!av.research.readiness) parts.push(`Research: ${av.research.reason || "no research configuration"}`);
  else parts.push(av.research.population ? "Research ✓ (population estimates and readiness)" : "Research: readiness only (no population estimates)");
  return parts.join(" · ");
}

// ----------------------------------------------------------------------------- modal

/*  Modal keyboard behaviour for app dialogs (the Rubric Editor's Confirm and Apply), the same
    contract as the shell's useModal: focus placed once per open, Tab kept inside the topmost
    dialog, Escape closes it (unless canClose says no), everything outside it `inert`, focus given
    back to the control that opened it. Apps may not import the shell, so the stack lives here.

    Coexistence with the shell's own stack: a dialog whose box sits under an `inert` ancestor is
    not the top (a shell dialog opened over it), so it leaves Tab and Escape to that dialog; a
    key the shell's handler already handled (defaultPrevented) is left alone; elements already
    inert are never added to, or removed from, this stack's set. */
const MODAL_STACK = [];
const INERTED = new Set();
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function syncInert() {
  for (const el of INERTED) el.removeAttribute("inert");
  INERTED.clear();
  const top = MODAL_STACK.length ? MODAL_STACK[MODAL_STACK.length - 1].current : null;
  if (!top || !top.isConnected || typeof document === "undefined") return;
  for (let node = top; node && node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sib of node.parentElement.children) {
      if (sib === node || sib.hasAttribute("inert") || sib.hasAttribute("data-sa-live") || /^(SCRIPT|STYLE|LINK|META)$/.test(sib.tagName)) continue;
      sib.setAttribute("inert", "");
      INERTED.add(sib);
    }
  }
}

/** The innermost aria-modal element under a backdrop, else the backdrop. */
function trapContainer(backdrop) {
  if (!backdrop) return null;
  const all = backdrop.querySelectorAll('[aria-modal="true"]');
  return all.length ? all[all.length - 1] : backdrop;
}

function focusables(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => !el.closest("[inert]") && el.getClientRects().length > 0);
}

/**
 * Modal behaviour for an app dialog.
 * @param {boolean} open
 * @param {{backdropRef: {current: ?Element}, initialFocusRef?: {current: ?HTMLElement},
 *          onClose: function(): void, canClose?: function(): boolean, fallbackFocus?: string}} opts
 */
export function useModal(open, { backdropRef, initialFocusRef = null, onClose, canClose = null, fallbackFocus = null }) {
  const latest = useRef({});
  latest.current = { onClose, canClose, initialFocusRef, fallbackFocus };
  // A sibling React re-created while the dialog is open is made inert again.
  useEffect(() => {
    if (open && MODAL_STACK.length && MODAL_STACK[MODAL_STACK.length - 1] === backdropRef) syncInert();
  });
  useEffect(() => {
    if (!open) return undefined;
    const token = backdropRef;
    const opener = typeof document !== "undefined" ? document.activeElement : null;
    MODAL_STACK.push(token);
    syncInert();
    const isTop = () => MODAL_STACK.length > 0 && MODAL_STACK[MODAL_STACK.length - 1] === token
      && !!token.current && !token.current.closest("[inert]");
    const t = setTimeout(() => {
      const box = trapContainer(token.current);
      if (!box || (document.activeElement && box.contains(document.activeElement))) return;
      const ref = latest.current.initialFocusRef;
      const want = ref && ref.current && !ref.current.disabled ? ref.current : focusables(box)[0];
      if (want) want.focus();
    }, 0);
    const onKey = (e) => {
      if (e.defaultPrevented || !isTop()) return;
      if (e.key === "Escape") {
        const can = latest.current.canClose;
        if (can && !can()) return;
        e.preventDefault();
        latest.current.onClose();
      } else if (e.key === "Tab") {
        const box = trapContainer(token.current);
        const items = focusables(box);
        const active = document.activeElement;
        if (!items.length) { e.preventDefault(); if (box) { if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "-1"); box.focus(); } return; }
        const first = items[0];
        const last = items[items.length - 1];
        if (!box.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      const i = MODAL_STACK.lastIndexOf(token);
      if (i >= 0) MODAL_STACK.splice(i, 1);
      syncInert();
      const fallback = latest.current.fallbackFocus;
      setTimeout(() => {
        const active = document.activeElement;
        // Something else took focus on purpose (another dialog, a switch), or a dialog is still open over it.
        if (active && active !== document.body && active.isConnected) return;
        const topBox = MODAL_STACK.length ? trapContainer(MODAL_STACK[MODAL_STACK.length - 1].current) : null;
        const usable = (el) => el && el.isConnected && !el.disabled && !el.closest("[inert]") && el.getClientRects().length > 0 && (!topBox || topBox.contains(el));
        if (usable(opener)) { opener.focus(); return; }
        const fb = fallback ? document.querySelector(fallback) : null;
        if (usable(fb)) fb.focus();
      }, 0);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
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
