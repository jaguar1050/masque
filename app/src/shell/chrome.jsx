// shell/chrome.jsx — shell chrome (design 03 §2.6, §5.1, §5.2, §5.10, §5.11). Owner: WP12.
//
// CaveatStrip, PrintFrame, VersionFooter, PatientFooter, MicIndicator, InvalidModule,
// ModuleInfo, ConfirmDialog, Toast and PatientModeBar, plus the small text helpers the shell,
// the upload dialog and the patient page share (availability summary, print markers). Styles
// live in shell.css.js and apply under .sa-shell. Imports react, lucide-react and engine files
// only, so the standalone patient page can use the strip and the frame without pulling in any
// clinician tab. No module literal: every module-specific value arrives as a prop.

import React, { useEffect, useRef, useState } from "react";
import { Copy, Download, Info, RotateCcw, Save, Trash2, TriangleAlert, X } from "lucide-react";
import { APP_VERSION, CAVEATS } from "../engine/policy.js";
import { availability } from "../engine/lineage.js";

const DASH = "—";
const arr = (x) => (Array.isArray(x) ? x : []);

// ----------------------------------------------------------------------------- helpers

/** Live voice states: the indicator shows and a patient-facing view stops capture (D16). */
export const LIVE_VOICE = ["starting", "listening", "restarting"];

/** Tab names (§5.1). */
export const TAB_LABELS = {
  screener: "Clinician Screener",
  scribe: "Ambient Scribe",
  patient: "Patient Companion",
  research: "Research",
  editor: "Rubric Editor",
};

/**
 * The per-tab availability summary (§5.2 item 4, §4.16), e.g. "Clinician Screener ✓ ·
 * Ambient Scribe: no voice capture (no lexicon) · Patient Companion ✓ · Research: no research
 * configuration".
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

/** The clinician print/title marker of a non-built-in module (§5.10). */
export function clinicianMarkers(module) {
  if (!module || module.origin === "builtin") return [];
  const kind = module.classification && module.classification.kind;
  const out = [];
  if (module.origin === "derived") out.push(CAVEATS.edited.short);
  if (module.origin !== "derived" || kind === "derived-from-upload") out.push(CAVEATS.uploaded.short);
  return out;
}

/** "edited" / "uploaded" for a non-built-in (picker labels, document title). */
export function originWord(module) {
  if (!module || module.origin === "builtin") return "";
  return module.origin === "derived" ? "edited" : "uploaded";
}

/** The "Module logic error — …" caveat line (§5.1 item 2). */
export function moduleErrorLine(err) {
  if (!err) return null;
  return `Module logic error — ${err.family || "logic"} rule ${err.ruleId || "?"}: ${err.message || "failed"}. Affected output is withheld.`;
}

// ----------------------------------------------------------------------------- strip, frame, footers

/**
 * The caveat strip (§5.1 item 2), always rendered.
 * @param {{lines?: string[], errorLine?: (string|null), lang?: string}} props
 *   lines: provenance lines for a non-built-in module (none for a built-in);
 *   errorLine: the "Module logic error — …" line while a closure error is recorded.
 */
export function CaveatStrip({ lines = [], errorLine = null }) {
  return (
    <div className="sa-caveat" id="sa-caveat" role="note" data-testid="caveat-strip">
      <div className="sa-caveat-in">
        <b>{CAVEATS.prototype}</b>
        {lines.map((l, i) => <span className="sa-caveat-line" lang="en" key={i}>{l}</span>)}
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

/**
 * The five version axes, each from its owner, never collapsed (D9): release, instrument,
 * lexicon, probe set, gold set.
 * @param {{appVersion: string, moduleId: string,
 *          versions: {instrument: string, lexicon?: (string|null), probeSet?: (string|null),
 *                     goldSet?: (string|null), goldSetLexicon?: (string|null)}}} props
 */
export function VersionFooter({ appVersion, moduleId, versions }) {
  return (
    <footer className="sa-footer" id="sa-footer" data-testid="version-footer">
      <VersionAxes appVersion={appVersion} moduleId={moduleId} versions={versions} />
      <p>{CAVEATS.prototype}</p>
      <p>Served as source; compiled in your browser.</p>
    </footer>
  );
}

function axesOf(appVersion, moduleId, versions) {
  const v = versions || {};
  const goldSet = v.goldSet ? v.goldSet : `${DASH} (not benchmarked)`;
  const stale = v.goldSet && v.goldSetLexicon && v.lexicon && v.goldSetLexicon !== v.lexicon
    ? ` (benchmarked on lexicon ${v.goldSetLexicon}; not re-run)` : "";
  return [
    ["release", `release ${appVersion}`],
    ["module", `module ${moduleId}`],
    ["instrument", `instrument ${v.instrument || DASH}`],
    ["lexicon", `lexicon ${v.lexicon || DASH}`],
    ["probe-set", `probe set ${v.probeSet || DASH}`],
    ["gold-set", `gold set ${goldSet}${stale}`],
  ];
}

function VersionAxes({ appVersion, moduleId, versions, block = false }) {
  const axes = axesOf(appVersion, moduleId, versions);
  if (block) return <ul className="sa-axes-list">{axes.map(([k, t]) => <li key={k} data-axis={k}>{t}</li>)}</ul>;
  return (
    <div className="sa-axes">
      {axes.map(([k, text]) => <span className="sa-axis" data-axis={k} key={k}>{text}</span>)}
    </div>
  );
}

/**
 * The patient footer (§5.1 patient mode, §5.11): `{name} · release {APP_VERSION} · instrument
 * {instrumentVersion}`, the patient provenance marker of a non-built-in, and the caveat.
 * Reads only the patient projection (never a score, band or clinician text).
 * @param {{view: Object, appVersion?: string}} props
 */
export function PatientFooter({ view, appVersion = APP_VERSION }) {
  const markers = arr(view && view.provenanceMarkers);
  return (
    <footer className="sa-footer sa-patient-footer" id="sa-footer" data-testid="patient-page-footer">
      <p>{view ? `${view.name} · release ${appVersion} · instrument ${view.instrumentVersion}` : `release ${appVersion}`}</p>
      {markers.length ? <p lang="en">{markers.join(" · ")}</p> : null}
      <p>{CAVEATS.prototype}</p>
    </footer>
  );
}

// ----------------------------------------------------------------------------- microphone

/**
 * "● Listening — Ambient Scribe [Stop]" on the Scribe tab, "● Listening — captures go to the
 * Ambient Scribe [Stop]" on every other tab, while the voice state is live (§5.1 item 3).
 * @param {{state: string, tab: string, onStop: function(): void}} props
 */
export function MicIndicator({ state, tab, onStop }) {
  if (!LIVE_VOICE.includes(state)) return null;
  const where = tab === "scribe" ? "Ambient Scribe" : "captures go to the Ambient Scribe";
  return (
    <div className="sa-mic" id="sa-mic" role="status" data-testid="mic-indicator" data-state={state}>
      <span className="sa-mic-dot" aria-hidden="true">●</span>
      <span className="sa-mic-text">Listening — {where}</span>
      <button type="button" className="sa-mic-stop" onClick={onStop}>Stop</button>
    </div>
  );
}

// ----------------------------------------------------------------------------- dialogs
//
// Every shell modal goes through useModal: one stack for the page, so Escape and Tab act on
// the topmost dialog only; focus is placed once per open, kept inside the dialog, and given
// back to the control that opened it; everything outside the topmost dialog is `inert`.
// The callbacks are read from a ref, so a parent re-render never re-runs the open effect.

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

/** The innermost aria-modal element under a backdrop: a nested modal (the editor's Apply dialog inside Upload) owns Tab. */
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
 * Shared modal behaviour for the shell dialogs.
 * @param {boolean} open
 * @param {{backdropRef: {current: ?Element}, initialFocusRef?: {current: ?HTMLElement},
 *          onClose: function(): void, canClose?: function(): boolean, fallbackFocus?: string}} opts
 */
export function useModal(open, { backdropRef, initialFocusRef = null, onClose, canClose = null, fallbackFocus = "#sa-module" }) {
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
    const isTop = () => MODAL_STACK.length > 0 && MODAL_STACK[MODAL_STACK.length - 1] === token;
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

/**
 * A modal confirmation (no window.confirm). `lines` are listed as bullets, `notes` follow as
 * paragraphs. Escape and the backdrop cancel. The confirm button takes focus unless
 * `initialFocus` is "cancel" (the safe action of a patient-facing dialog). `extra` adds a
 * second, non-primary action between Cancel and the confirm button.
 * @param {{open: boolean, title: string, body?: React.ReactNode, lines?: string[], notes?: string[],
 *          confirmLabel: string, cancelLabel?: string, onConfirm: function(): void, onCancel: function(): void,
 *          initialFocus?: ("confirm"|"cancel"), extra?: ({label: string, onClick: function(): void, testId?: string}|null),
 *          testId?: string}} props
 */
export function ConfirmDialog({ open, title, body = null, lines = [], notes = [], confirmLabel, cancelLabel = "Cancel", onConfirm, onCancel, initialFocus = "confirm", extra = null, testId = "confirm-dialog" }) {
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const backdropRef = useRef(null);
  useModal(open, { backdropRef, initialFocusRef: initialFocus === "cancel" ? cancelRef : confirmRef, onClose: onCancel });
  if (!open) return null;
  return (
    <div className="sa-dialog sa-backdrop" ref={backdropRef} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="sa-modal sa-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sa-confirm-title" data-testid={testId}>
        <h2 id="sa-confirm-title">{title}</h2>
        {body ? <div className="sa-confirm-body">{body}</div> : null}
        {lines.length ? <ul className="sa-confirm-lines" data-testid="confirm-lines">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : null}
        {notes.map((n, i) => <p className="sa-confirm-note" key={i}>{n}</p>)}
        <div className="sa-actions">
          <button type="button" className="sa-btn" ref={cancelRef} onClick={onCancel} data-testid="confirm-cancel">{cancelLabel}</button>
          {extra ? <button type="button" className="sa-btn" onClick={extra.onClick} data-testid={extra.testId || "confirm-extra"}>{extra.label}</button> : null}
          <button type="button" className="sa-btn sa-btn-primary" ref={confirmRef} onClick={onConfirm} data-testid="confirm-ok">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * A transient message. `message` changes restart the timer; null hides it.
 * @param {{message: (string|null), onDone: function(): void, ms?: number}} props
 */
export function Toast({ message, onDone, ms = 5000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [message, onDone, ms]);
  if (!message) return null;
  return (
    <div className="sa-toast" role="status" aria-live="polite" data-testid="toast" data-sa-live="">
      <span>{message}</span>
      <button type="button" className="sa-toast-x" onClick={onDone} aria-label="Dismiss"><X size={14} aria-hidden="true" /></button>
    </div>
  );
}

// ----------------------------------------------------------------------------- modules

/**
 * A module that failed to load or validate (§5.1 item 6, "Built-in load failure"): the
 * code · path · message list plus Retry. Upload stays available in the header.
 * @param {{entry: Object, onRetry?: function(): void}} props
 */
export function InvalidModule({ entry, onRetry }) {
  const v = (entry && entry.validation) || { errors: [], warnings: [] };
  const label = entry ? (entry.module ? entry.module.label : entry.label) : "module";
  return (
    <div className="sa-invalid" role="alert" data-testid="invalid-module">
      <div className="sa-invalid-card">
        <h2><TriangleAlert size={18} aria-hidden="true" /> {label} could not be loaded</h2>
        <p>The module failed to load or did not pass validation, so no tab is shown for it. Nothing from it runs.</p>
        <ul className="sa-report">
          {arr(v.errors).map((e, i) => <li key={i}><code>{e.code}</code> · <code>{e.path || "/"}</code> · {e.msg}</li>)}
        </ul>
        {onRetry ? <button type="button" className="sa-btn" onClick={onRetry}><RotateCcw size={14} aria-hidden="true" /> Retry</button> : null}
      </div>
    </div>
  );
}

function Hash({ label, value }) {
  return (
    <div className="sa-kv">
      <span className="sa-k">{label}</span>
      <code className="sa-v sa-hash">{value || DASH}</code>
    </div>
  );
}

function KV({ label, children }) {
  return (
    <div className="sa-kv">
      <span className="sa-k">{label}</span>
      <span className="sa-v">{children}</span>
    </div>
  );
}

function recordLine(rec) {
  if (!rec) return DASH;
  return `${rec.label || rec.moduleId} (${rec.moduleId}, instrument ${rec.instrumentVersion}${rec.lexiconVersion ? `, lexicon ${rec.lexiconVersion}` : ""})`;
}

/**
 * The ⓘ drawer (§5.1 "ModuleInfo shows"): identity and classification, the five axes, hashes,
 * provenance, availability, change log, validation warnings, remember/download for an unsaved
 * derived module, "Remove from this session" for non-built-ins, and the About section that
 * index.html carried (D27).
 * @param {{open: boolean, entry: Object, entries: Object[], appVersion: string,
 *          onClose: function(): void, onRemember?: function(Object): void, onDownload?: function(Object): void,
 *          onRemove?: function(Object): void}} props
 */
export function ModuleInfo({ open, entry, entries = [], appVersion = APP_VERSION, onClose, onRemember, onDownload, onRemove }) {
  const closeRef = useRef(null);
  const backdropRef = useRef(null);
  useModal(open && !!entry, { backdropRef, initialFocusRef: closeRef, onClose, fallbackFocus: '[data-testid="module-info-button"]' });
  if (!open || !entry) return null;
  const m = entry.module;
  const c = (m && m.classification) || entry.classification || null;
  const prov = m && m.provenance;
  const v = entry.validation || { errors: [], warnings: [] };
  const builtin = entry.origin === "builtin";
  const unsaved = entry.origin === "derived" && !entry.savedAt && !entry.downloadedAt;
  const rootModule = c && c.root && c.root !== m ? c.root : null;
  const rootRec = prov && prov.root;
  const rootChanged = !!(rootModule && rootRec && rootModule.hashes && rootRec.rubricSha256 && rootModule.hashes.rubricSha256 !== rootRec.rubricSha256);
  const h = (m && m.hashes) || {};
  return (
    <div className="sa-dialog sa-backdrop" ref={backdropRef} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="sa-drawer" role="dialog" aria-modal="true" aria-labelledby="sa-info-title" data-testid="module-info">
        <div className="sa-drawer-head">
          <h2 id="sa-info-title"><Info size={17} aria-hidden="true" /> {m ? m.label : entry.label}</h2>
          <button type="button" className="sa-icon-btn" onClick={onClose} ref={closeRef} aria-label="Close module information"><X size={16} aria-hidden="true" /></button>
        </div>

        <section className="sa-info-sec">
          <h3>Module</h3>
          <KV label="id">{m ? m.id : DASH}</KV>
          <KV label="label">{m ? m.label : entry.label}</KV>
          <KV label="name">{m ? m.name : DASH}</KV>
          <KV label="origin">{entry.origin}</KV>
          <KV label="classification">{c ? `${c.kind}${c.row ? ` (§3.11 row ${c.row})` : ""}` : DASH}</KV>
          {c && arr(c.reasons).length ? <ul className="sa-info-list">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
        </section>

        {m ? (
          <section className="sa-info-sec">
            <h3>Version axes</h3>
            <VersionAxes appVersion={appVersion} moduleId={m.id} versions={m.versions} block />
          </section>
        ) : null}

        {m ? (
          <section className="sa-info-sec">
            <h3>Hashes (SHA-256)</h3>
            <Hash label="rubric" value={h.rubricSha256} />
            <Hash label="logic" value={h.logicSha256} />
            <Hash label="instrument" value={h.instrumentHash} />
            <Hash label="scoring" value={h.scoringHash} />
            <Hash label="lexicon" value={h.lexiconHash} />
            <Hash label="content" value={h.contentHash} />
          </section>
        ) : null}

        {!builtin ? (
          <section className="sa-info-sec">
            <h3>Provenance</h3>
            <KV label="root">{rootRec ? recordLine(rootRec) : (rootModule ? rootModule.label : DASH)}</KV>
            <KV label="derived from">{prov && prov.derivedFrom ? recordLine(prov.derivedFrom) : DASH}</KV>
            {prov && arr(prov.lineage).length ? (
              <div className="sa-kv"><span className="sa-k">lineage</span>
                <ol className="sa-v sa-info-list">{prov.lineage.map((r, i) => <li key={i}>{recordLine(r)}</li>)}</ol></div>
            ) : null}
            {prov && prov.source ? <KV label="derived from file">{`${prov.source.name || DASH} (sha256 ${String(prov.source.sha256 || "").slice(0, 16)}…)`}</KV> : null}
            {entry.files && entry.files.rubric ? (
              // A rubric made in this page (the editor's Apply, Load as derived, a restore) was never
              // a file: its hash is shown without a file name.
              arr(entry.sourceFileNames).includes(entry.files.rubric.name)
                ? <KV label="rubric file">{`${entry.files.rubric.name} (sha256 ${String(entry.files.rubric.sha256 || "").slice(0, 16)}…)`}</KV>
                : <KV label="rubric">{`no file: made in this page or restored from this browser (sha256 ${String(entry.files.rubric.sha256 || "").slice(0, 16)}…)`}</KV>
            ) : null}
            {entry.files && entry.files.logic ? <KV label="logic file">{`${entry.files.logic.name} (sha256 ${String(entry.files.logic.sha256 || "").slice(0, 16)}…)`}</KV> : null}
            {arr(entry.sourceFileNames).length ? <KV label="uploaded as">{entry.sourceFileNames.join(", ")}</KV> : null}
            {rootChanged ? <p className="sa-info-note">The root built-in's rubric file has changed since this module was derived (scoring, instrument and lexicon unchanged).</p> : null}
          </section>
        ) : null}

        {m ? (
          <section className="sa-info-sec">
            <h3>Availability</h3>
            <p className="sa-avail" data-testid="module-info-availability">{availabilityText(m)}</p>
          </section>
        ) : null}

        {m && arr(m.changelog).length ? (
          <section className="sa-info-sec">
            <h3>Change log</h3>
            <ul className="sa-info-list">
              {m.changelog.map((e, i) => <li key={i}><b>{e.date}</b> · {e.kind}{e.note ? ` — ${e.note}` : ""}</li>)}
            </ul>
          </section>
        ) : null}

        <section className="sa-info-sec">
          <h3>Validation</h3>
          <p>{arr(v.errors).length} error{arr(v.errors).length === 1 ? "" : "s"}, {arr(v.warnings).length} warning{arr(v.warnings).length === 1 ? "" : "s"}</p>
          {arr(v.warnings).length ? (
            <details><summary>Warnings</summary>
              <ul className="sa-report">{v.warnings.map((w, i) => <li key={i}><code>{w.code}</code> · <code>{w.path || "/"}</code> · {w.msg}</li>)}</ul>
            </details>
          ) : null}
        </section>

        {!builtin ? (
          <section className="sa-info-sec">
            <h3>This session</h3>
            {unsaved ? <p className="sa-info-note">This edited module exists only in this tab and will be lost on reload.</p> : null}
            <div className="sa-actions sa-actions-left">
              {onRemember ? <button type="button" className="sa-btn" onClick={() => onRemember(entry)}><Save size={14} aria-hidden="true" /> {entry.savedAt ? "Remembered in this browser" : "Remember in this browser"}</button> : null}
              {onDownload ? <button type="button" className="sa-btn" onClick={() => onDownload(entry)}><Download size={14} aria-hidden="true" /> Download</button> : null}
              {onRemove ? <button type="button" className="sa-btn sa-btn-danger" onClick={() => onRemove(entry)}><Trash2 size={14} aria-hidden="true" /> Remove from this session</button> : null}
            </div>
          </section>
        ) : null}

        <section className="sa-info-sec" data-testid="module-info-about">
          <h3>About</h3>
          <p>screenAIr is one screening program: choose a module at the top, then work across the Clinician Screener, Ambient Scribe, Patient Companion, Research and Rubric Editor tabs.</p>
          {m && m.fhir && m.fhir.description ? <p lang="en">{m.fhir.description}</p> : null}
          <p className="sa-about-notice"><b>{CAVEATS.prototype}</b> Calibration constants are illustrative until fit on approved data. Nothing here has been validated in a clinical study. Each tab repeats this on its own face rather than relying on this page.</p>
          {m ? <VersionAxes appVersion={appVersion} moduleId={m.id} versions={m.versions} block /> : null}
          <p className="sa-about-small">Served as source: the modules are compiled in your browser. {entries.length} module{entries.length === 1 ? "" : "s"} loaded in this tab.</p>
        </section>
      </aside>
    </div>
  );
}

/**
 * The bar the Patient panel opens with (§5.1 item 6): Hand to patient, and the at-home link
 * for a built-in module.
 * @param {{module: Object, appBase: string, onHand: function(): void, onCopied?: function(string): void}} props
 */
export function PatientModeBar({ module, appBase, onHand, onCopied }) {
  const [copied, setCopied] = useState(false);
  const builtin = module && module.origin === "builtin";
  const rel = builtin ? `patient.html?module=${encodeURIComponent(module.id)}` : null;
  const href = rel ? new URL(rel, appBase).href : null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(href); setCopied(true); if (onCopied) onCopied(href); }
    catch (_) { setCopied(false); }
  };
  return (
    <div className="sa-patient-bar" data-testid="patient-mode-bar">
      <button type="button" className="sa-btn sa-btn-primary" onClick={onHand} data-testid="hand-to-patient">Hand to patient</button>
      {builtin ? (
        <span className="sa-patient-link">
          At-home link: <a href={href} target="_blank" rel="noopener noreferrer"><code>{rel}</code></a>
          <button type="button" className="sa-btn sa-btn-small" onClick={copy} data-testid="copy-at-home-link"><Copy size={13} aria-hidden="true" /> {copied ? "Copied" : "Copy link"}</button>
        </span>
      ) : (
        <span className="sa-patient-link">At-home use is available for built-in modules only.</span>
      )}
    </div>
  );
}
