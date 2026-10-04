// shell/UploadDialog.jsx — the Upload modal (design 03 §5.2, §3.9, §3.11, §7.4). Owner: WP12.
//
// 1. Choose files (a real <input type="file" multiple>, so no programmatic click is needed),
//    or drop them. A link downloads the current module's files to edit and re-upload.
// 2. registry.classifyFiles reads bytes, limits, UTF-8 and SHA-256 and determines each kind
//    WITHOUT executing anything (a .js is parsed by inspectSource; a loaded built-in's logic
//    is recognised by its SHA-256 and never run).
// 3. Executable files need the explicit consent box (or are refused when the site disables
//    JavaScript uploads); the page/network APIs each one references are listed first.
// 4. Validate: registry.prepareUpload imports the consented files, pairs, classifies, binds
//    and validates. Each module gets a result card with its errors, warnings and the
//    availability summary. A file that may only load as a derivation of a loaded module gets
//    "Load as a module derived from <label>", which opens the Rubric Editor's Apply dialog in
//    its "prepare" mode (compiled on first use; a minimal form over derive.js stands in if
//    it cannot load): new id, label, versions per the family rule, a required change note.
// 5. Load registers every validated module and hands the last one to the shell's switch.
//    Cancel discards everything; nothing was registered.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, CircleX, Copy, Download, FileUp, ShieldAlert, X } from "lucide-react";
import { SITE } from "../engine/policy.js";
import { classifyChanges, deriveRubric, proposeIdentity } from "../engine/derive.js";
import { classifyFiles, prepareUpload, prepareRubric, register, saveModule, loadedModules, markEntry } from "./registry.js";
import { availabilityText, useModal } from "./chrome.jsx";

const arr = (x) => (Array.isArray(x) ? x : []);
const msgOf = (e) => String(e && e.message ? e.message : e).split("\n")[0];

function size(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function CopyHash({ value }) {
  const [done, setDone] = useState(false);
  if (!value) return <code>—</code>;
  return (
    <span className="sa-hashcell">
      <code title={value}>{value.slice(0, 16)}</code>
      <button type="button" className="sa-icon-btn" aria-label="Copy the full SHA-256"
        onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); } catch (_) { setDone(false); } }}>
        <Copy size={12} aria-hidden="true" />
      </button>
      {done ? <span className="sa-copied">copied</span> : null}
    </span>
  );
}

function ReportList({ report }) {
  if (!report) return null;
  return (
    <>
      {arr(report.errors).length ? (
        <ul className="sa-report" data-testid="upload-errors">
          {report.errors.map((e, i) => <li key={i}><code>{e.code}</code> · <code>{e.path || "/"}</code> · {e.msg}</li>)}
        </ul>
      ) : null}
      {arr(report.warnings).length ? (
        <details className="sa-warnings"><summary>{report.warnings.length} warning{report.warnings.length === 1 ? "" : "s"}</summary>
          <ul className="sa-report">{report.warnings.map((w, i) => <li key={i}><code>{w.code}</code> · <code>{w.path || "/"}</code> · {w.msg}</li>)}</ul>
        </details>
      ) : null}
    </>
  );
}

/** One prepared result: ✓ / ✗, errors, warnings, availability; a rederive offer. */
function ResultCard({ r, onDerive, remember, setRemember }) {
  const ok = !!r.entry;
  const skipped = !!r.skipped;
  return (
    <div className={`sa-result ${ok ? "ok" : skipped ? "skip" : "bad"}`} data-testid="upload-result" data-ok={ok ? "true" : "false"} data-skipped={skipped ? "true" : "false"}>
      <div className="sa-result-head">
        {ok ? <CircleCheck size={16} aria-hidden="true" /> : <CircleX size={16} aria-hidden="true" />}
        <b>{r.label}</b>
        {r.id ? <code>{r.id}</code> : null}
        {r.entry ? <span className="sa-chip">{r.entry.origin === "derived" ? "edited module" : "uploaded module"}</span> : null}
      </div>
      <div className="sa-result-files">{arr(r.files).join(" + ")}</div>
      {skipped ? <p className="sa-result-msg" data-testid="upload-skipped">Skipped: {r.skipped}.</p> : null}
      {r.errors.map((e, i) => <p key={i} className="sa-result-msg sa-err" data-testid="upload-error">{e}</p>)}
      <ReportList report={r.report} />
      {r.warnings.length ? (
        <details className="sa-warnings"><summary>{r.warnings.length} binding note{r.warnings.length === 1 ? "" : "s"}</summary>
          <ul className="sa-report">{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>
      ) : null}
      {r.classification && arr(r.classification.reasons).length && ok ? (
        <ul className="sa-report">{r.classification.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
      ) : null}
      {r.entry ? <p className="sa-avail" data-testid="upload-availability">{availabilityText(r.entry.module)}</p> : null}
      {r.entry && r.entry.jsonOnly ? (
        <label className="sa-check">
          <input type="checkbox" checked={!!remember} onChange={(e) => setRemember(e.target.checked)} data-testid="upload-remember" />
          Remember this module in this browser
        </label>
      ) : null}
      {r.rederive && r.rederive.root ? (
        <button type="button" className="sa-btn" onClick={() => onDerive(r)} data-testid="load-as-derived">
          Load as a module derived from {r.rederive.root.label}
        </button>
      ) : null}
    </div>
  );
}

/**
 * The "Load as derived" form: the Apply rules of §5.7 for a file that cannot load as is
 * (§3.11 rows 2, 4, 5 and 6). It prepares a derived rubric with derive.js; the result card
 * replaces the file's, and Load registers it like any other module.
 */
function DeriveForm({ r, entries, env, onDone, onCancel }) {
  const root = r.rederive.root;
  const [state, setState] = useState({ status: "loading" });
  const [form, setForm] = useState({ id: "", label: "", instrumentVersion: "", lexiconVersion: "", note: "", author: "" });
  const [acks, setAcks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const changes = await classifyChanges(root, r.rederive.rubric, { root });
        const loaded = loadedModules(entries);
        const ident = proposeIdentity(root, r.rederive.rubric, changes, loaded, { now: new Date().toISOString() });
        if (!live) return;
        setForm((f) => ({ ...f, id: ident.id, label: ident.label, instrumentVersion: ident.instrumentVersion, lexiconVersion: ident.lexiconVersion || "" }));
        setState({ status: "ready", changes, ident });
      } catch (err) {
        if (live) setState({ status: "error", error: msgOf(err) });
      }
    })();
    return () => { live = false; };
  }, [root, r, entries]);

  if (state.status === "loading") return <div className="sa-derive" data-testid="derive-form"><p>Comparing the file with {root.label}…</p></div>;
  if (state.status === "error") {
    return (
      <div className="sa-derive" data-testid="derive-form">
        <p className="sa-err">The derived module could not be prepared: {state.error}</p>
        <div className="sa-actions"><button type="button" className="sa-btn" onClick={onCancel}>Back</button></div>
      </div>
    );
  }
  const { changes, ident } = state;
  const vsRoot = (changes && changes.vsRoot) || {};
  const ackList = [...new Set([...arr(changes.needsAcknowledgement), ...arr(changes.staleRedFlagPaths)])];
  const lockedI = ident.versionLocked && ident.versionLocked.instrument;
  const lockedL = ident.versionLocked && ident.versionLocked.lexicon;
  const hasLexicon = !!(r.rederive.rubric && r.rederive.rubric.lexicon);
  const allAcked = ackList.every((p) => acks[p]);
  const canPrepare = form.note.trim() && form.id.trim() && form.label.trim() && allAcked && !busy;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const prepare = async () => {
    setBusy(true); setError(null);
    try {
      const rubric = await deriveRubric(root, r.rederive.rubric, {
        root, id: form.id.trim(), label: form.label.trim(),
        instrumentVersion: form.instrumentVersion.trim(), lexiconVersion: hasLexicon ? form.lexiconVersion.trim() : null,
        note: form.note.trim(), author: form.author.trim() || undefined, acknowledged: ackList,
        now: new Date().toISOString(), source: { name: r.rederive.fileName, sha256: r.rederive.rubricSha256 },
      });
      const res = await prepareRubric(rubric, { entries, env, fileName: `${rubric.id}.rubric.json` });
      res.files = [r.rederive.fileName];
      if (res.entry) res.entry.sourceFileNames = [r.rederive.fileName];
      onDone(res);
    } catch (err) {
      setError(msgOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sa-derive" data-testid="derive-form">
      <h3>Load as a module derived from {root.label}</h3>
      <p>{arr(r.rederive.reasons).join(" ")}</p>
      <div className="sa-form">
        <label>Module id<input value={form.id} onChange={set("id")} data-testid="derive-id" /></label>
        <label>Label<input value={form.label} onChange={set("label")} data-testid="derive-label" /></label>
        <label>Instrument version
          <input value={form.instrumentVersion} onChange={set("instrumentVersion")} readOnly={!!lockedI} data-testid="derive-instrument" />
          {lockedI ? <span className="sa-hint">Same instrument as {lockedI}; the version is fixed.</span> : <span className="sa-hint">A changed instrument carries the "-local" tag.</span>}
        </label>
        {hasLexicon ? (
          <label>Lexicon version
            <input value={form.lexiconVersion} onChange={set("lexiconVersion")} readOnly={!!lockedL} data-testid="derive-lexicon" />
            {lockedL ? <span className="sa-hint">Same lexicon as {lockedL}; the version is fixed.</span> : null}
          </label>
        ) : null}
        <label>Change note (required)<textarea value={form.note} onChange={set("note")} rows={2} data-testid="derive-note" /></label>
        <label>Author (optional)<input value={form.author} onChange={set("author")} /></label>
      </div>
      <ul className="sa-notices">
        {vsRoot.scoringChanged ? <li>Scoring differs from {root.name} {root.instrumentVersion} — the research panel will withhold every calibration-dependent figure for this module.</li> : null}
        {vsRoot.scoringChanged ? <li>The CDS example card written for {root.name} {root.instrumentVersion} will be removed.</li> : null}
        {arr(changes.localesEdited).length ? <li>Edited patient wording: {changes.localesEdited.join(", ")} will be marked unreviewed.</li> : null}
      </ul>
      {ackList.length ? (
        <fieldset className="sa-acks">
          <legend>Acknowledge before preparing</legend>
          {ackList.map((p) => (
            <label key={p} className="sa-check">
              <input type="checkbox" checked={!!acks[p]} onChange={(e) => setAcks((a) => ({ ...a, [p]: e.target.checked }))} />
              <span>The new wording at <code>{p}</code> keeps the meaning the module's rules depend on.</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {error ? <p className="sa-err" role="alert">{error}</p> : null}
      <div className="sa-actions">
        <button type="button" className="sa-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="sa-btn sa-btn-primary" disabled={!canPrepare} onClick={prepare} data-testid="derive-prepare">Prepare module</button>
      </div>
    </div>
  );
}

/**
 * @param {{open: boolean, onClose: function(): void, entries: Object[], env: Object,
 *          onLoaded: function(string, Object[]): void, activeEntry?: Object,
 *          onDownloadCurrent?: function(): Promise<void>}} props
 */
export default function UploadDialog({ open, onClose, entries, env, onLoaded, activeEntry = null, onDownloadCurrent = null }) {
  const [classified, setClassified] = useState(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [results, setResults] = useState(null);
  const [remember, setRemember] = useState({});
  const [deriving, setDeriving] = useState(null);
  const [drag, setDrag] = useState(false);
  const [applyDialog, setApplyDialog] = useState({ status: "idle", Comp: null });
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const closeRef = useRef(null);
  const backdropRef = useRef(null);
  const loadRef = useRef(null);
  const validateRef = useRef(null);
  const derivingRef = useRef(null);
  derivingRef.current = deriving;
  const busyRef = useRef(false);
  busyRef.current = busy;

  const reset = useCallback(() => {
    setClassified(null); setConsent(false); setResults(null); setRemember({}); setDeriving(null); setError(null); setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);
  // Escape closes the dialog, but not while busy or while the Apply dialog of a "Load as derived" is open.
  useModal(open, { backdropRef, initialFocusRef: closeRef, onClose, canClose: () => !busyRef.current && !derivingRef.current });

  // A step that disables the focused button (Choose files, Validate) leaves focus on <body>:
  // put it back on the next useful action inside the dialog.
  const refocus = useCallback(() => {
    setTimeout(() => {
      const box = backdropRef.current;
      const active = document.activeElement;
      if (!box || (active && active !== document.body && box.contains(active))) return;
      for (const r of [loadRef, validateRef, closeRef]) {
        if (r.current && !r.current.disabled && r.current.isConnected) { r.current.focus(); return; }
      }
    }, 0);
  }, []);

  // The editor's Apply dialog, compiled on the first "Load as derived" (§3.11, §5.7).
  const startDerive = useCallback((r) => {
    setDeriving(r);
    if (applyDialog.status !== "idle") return;
    setApplyDialog({ status: "loading", Comp: null });
    env.loader.importModule(new URL("src/apps/RubricEditor.jsx", env.appBase).href).then(
      (ns) => setApplyDialog(typeof ns.ApplyDialog === "function" ? { status: "ready", Comp: ns.ApplyDialog } : { status: "failed", Comp: null }),
      () => setApplyDialog({ status: "failed", Comp: null }),
    );
  }, [applyDialog.status, env]);

  const finishDerive = useCallback(async (r, rubric) => {
    const res = await prepareRubric(rubric, { entries, env, fileName: `${rubric.id}.rubric.json` });
    if (!res.entry) {
      const detail = res.report ? res.report.errors.slice(0, 5).map((x) => `${x.code} · ${x.path || "/"} · ${x.msg}`) : [];
      throw new Error([...res.errors, ...detail].join("; ") || "The derived module did not validate.");
    }
    res.files = [r.rederive.fileName];
    res.entry.sourceFileNames = [r.rederive.fileName];
    setResults((rs) => rs.map((x) => (x === r ? res : x)));
    setDeriving(null);
  }, [entries, env]);

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true); setResults(null); setConsent(false); setDeriving(null); setError(null);
    try {
      setClassified(await classifyFiles(files, { entries, env }));
    } catch (err) {
      setError(msgOf(err));
    } finally {
      setBusy(false);
      refocus();
    }
  };

  const executable = useMemo(() => arr(classified).filter((c) => !c.error && c.needsConsent), [classified]);
  const usable = useMemo(() => arr(classified).filter((c) => !c.error && c.kind !== "zip"), [classified]);
  const needsConsent = executable.length > 0;
  const canValidate = !!classified && !busy && usable.length > 0 && (!needsConsent || consent);

  const validate = async () => {
    setBusy(true); setError(null); setDeriving(null);
    try {
      setResults(await prepareUpload(classified, { entries, consent, env }));
    } catch (err) {
      setError(msgOf(err));
    } finally {
      setBusy(false);
      refocus();
    }
  };

  const moduleResults = arr(results).filter((r) => r.entry || r.rederive || r.report || r.skipped || (r.id && !r.entry));
  const ready = arr(results).filter((r) => r.entry);
  const blocking = arr(results).filter((r) => !r.entry && !r.skipped);
  const canLoad = !!results && ready.length > 0 && blocking.length === 0 && !busy && !deriving;

  const load = () => {
    let last = null;
    const keys = [];
    try {
      for (const r of ready) {
        register(r.entry);
        if (remember[r.entry.key] && r.entry.jsonOnly) {
          const savedAt = saveModule(r.entry);
          if (savedAt) markEntry(r.entry.key, { savedAt });
        }
        keys.push(r.entry.key);
        last = r.entry.key;
      }
    } catch (err) {
      setError(msgOf(err));
      return;
    }
    onLoaded(last, keys);
  };

  if (!open) return null;
  const downloadLabel = activeEntry && activeEntry.module ? activeEntry.module.label : "the current module";

  return (
    <div className="sa-dialog sa-backdrop" ref={backdropRef} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="sa-modal sa-upload" role="dialog" aria-modal="true" aria-labelledby="sa-upload-title" data-testid="upload-dialog">
        <div className="sa-drawer-head">
          <h2 id="sa-upload-title"><FileUp size={17} aria-hidden="true" /> Upload a module</h2>
          <button type="button" className="sa-icon-btn" onClick={onClose} ref={closeRef} aria-label="Close the upload dialog" disabled={busy}><X size={16} aria-hidden="true" /></button>
        </div>

        <div
          className={`sa-drop ${drag ? "on" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer && e.dataTransfer.files); }}
        >
          <label className="sa-file">
            <span className="sa-btn sa-btn-primary">Choose files</span>
            <input ref={inputRef} type="file" multiple accept=".json,.js,.mjs,.zip" data-testid="upload-input"
              onChange={(e) => onFiles(e.target.files)} />
          </label>
          <span>or drop them here</span>
        </div>
        <div className="sa-guide">
          <p>Accepted: a rubric <code>.json</code> (data only, no code); a logic or single-file module <code>.js</code>/<code>.mjs</code> (select a logic file together with its rubric); or the <code>.zip</code> that “Download all” makes. Spreadsheets and documents are not read.</p>
          <p>JSON rubrics contain no code. For a file from a source you do not fully trust, ask for the JSON rubric.</p>
          {onDownloadCurrent ? (
            <p><button type="button" className="sa-link" onClick={onDownloadCurrent} data-testid="upload-download-current">
              <Download size={13} aria-hidden="true" /> Download the current module's files to edit and re-upload</button> ({downloadLabel})</p>
          ) : null}
          {!SITE.ALLOW_JS_UPLOAD ? <p className="sa-hint">JavaScript modules are disabled on this site; only JSON rubrics and recognised built-in logic are accepted.</p> : null}
        </div>

        {busy ? <p className="sa-busy" role="status">Working…</p> : null}
        {error ? <p className="sa-err" role="alert">{error}</p> : null}

        {classified ? (
          <div className="sa-table-wrap">
            <table className="sa-table" data-testid="upload-files">
              <thead><tr><th>File</th><th>Size</th><th>SHA-256</th><th>Kind</th><th>Binding</th></tr></thead>
              <tbody>
                {classified.map((c, i) => (
                  <tr key={i} data-kind={c.kind} className={c.error ? "bad" : ""}>
                    <td className="sa-fname">{c.name}{c.error ? <div className="sa-err" data-testid="upload-file-error">{c.error}</div> : null}</td>
                    <td>{size(c.size)}</td>
                    <td><CopyHash value={c.sha256} /></td>
                    <td data-testid="upload-kind">{c.kindLabel}</td>
                    <td>{c.intended}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {needsConsent ? (
          <div className="sa-consent" data-testid="upload-consent">
            <p><ShieldAlert size={16} aria-hidden="true" /> <b>This file contains executable code. It will run inside this page with the same permissions as screenAIr — it can read and change anything this page can. Load it only if you trust its author. JSON rubrics contain no code.</b></p>
            <ul>
              {executable.map((c, i) => (
                <li key={i}>
                  <code>{c.name}</code> · {size(c.size)} · sha256 <code className="sa-hash">{c.sha256}</code>
                  {c.inspect && arr(c.inspect.apiRefs).length
                    ? <div data-testid="upload-apirefs">Names page or network APIs: {c.inspect.apiRefs.join(", ")}</div>
                    : <div data-testid="upload-apirefs-none">None of the page or network API names this check looks for were found.</div>}
                </li>
              ))}
            </ul>
            <p className="sa-hint" data-testid="upload-heuristic">This list comes from a text check, which is a heuristic: code can reach anything this page can without naming it, so a short or empty list does not make a file safe.</p>
            <label className="sa-check">
              <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setResults(null); }} data-testid="upload-consent-box" />
              I understand and want to run this code
            </label>
          </div>
        ) : null}

        {results ? (
          <div className="sa-results" data-testid="upload-results">
            {arr(results).filter((r) => !moduleResults.includes(r)).map((r, i) => (
              <div key={`f${i}`} className="sa-result bad" data-testid="upload-result" data-ok="false" data-skipped="false">
                <div className="sa-result-head"><CircleX size={16} aria-hidden="true" /><b>{r.file}</b></div>
                {r.errors.map((e, j) => <p key={j} className="sa-result-msg sa-err" data-testid="upload-error">{e}</p>)}
              </div>
            ))}
            {moduleResults.map((r, i) => {
              if (deriving === r && applyDialog.status === "failed") {
                return <DeriveForm key={`m${i}`} r={r} entries={entries} env={env}
                  onCancel={() => setDeriving(null)}
                  onDone={(res) => { setResults((rs) => rs.map((x) => (x === r ? res : x))); setDeriving(null); }} />;
              }
              return <ResultCard key={`m${i}`} r={r} onDerive={startDerive}
                remember={r.entry ? remember[r.entry.key] : false}
                setRemember={(v) => setRemember((m) => ({ ...m, [r.entry.key]: v }))} />;
            })}
          </div>
        ) : null}

        {deriving && applyDialog.status === "loading" ? <p className="sa-busy" role="status">Opening the Apply dialog…</p> : null}
        {deriving && applyDialog.status === "ready" && applyDialog.Comp ? (
          <applyDialog.Comp open mode="prepare" parent={deriving.rederive.root} draft={deriving.rederive.rubric}
            loaded={entries.filter((e) => e.module && e.validation && e.validation.ok)}
            source={{ name: deriving.rederive.fileName, sha256: deriving.rederive.rubricSha256 }}
            reason={deriving.rederive.reasons.join(" ")}
            onCancel={() => setDeriving(null)}
            onCreate={({ rubric }) => finishDerive(deriving, rubric)} />
        ) : null}

        <div className="sa-actions">
          <button type="button" className="sa-btn" onClick={onClose} disabled={busy} data-testid="upload-cancel">Cancel</button>
          {!results || !canLoad ? (
            <button type="button" className="sa-btn" ref={validateRef} onClick={validate} disabled={!canValidate} data-testid="upload-validate">Validate</button>
          ) : null}
          <button type="button" className="sa-btn sa-btn-primary" ref={loadRef} onClick={load} disabled={!canLoad} data-testid="upload-load">Load</button>
        </div>
      </div>
    </div>
  );
}
