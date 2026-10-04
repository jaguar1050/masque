// apps/RubricEditor.jsx — the Rubric Editor tab and the Apply dialog (design 03 §5.7, §5.8,
// §3.11). Owner: WP11.
//
// RubricEditor({entries, activeKey, env, onApply, onDownloadAll, onDownloaded?, now?})
//   - Editing: any loaded module that validated, defaulting to the active one. Choosing another
//     opens its draft without switching the active module, so no screen changes.
//   - The draft is a structured clone of the rubric (derive.createDraft), autosaved per module
//     to localStorage (debounced 1 s, inside try/catch); the module itself is never changed.
//   - Only the §5.7 fields are editable; everything else shows a lock and its reason. Wording
//     the logic reads stays editable behind an acknowledgement.
//   - Live validation (250 ms): the draft is derived as Apply would derive it, bound with the
//     parent's logic and validated against the root, so the list shows exactly what Apply
//     would refuse. Apply is disabled while any error, lock or open acknowledgement exists.
//   - Impact preview over the sample cases (and the session's current screens when the edited
//     module is the active one), the Changes pane with per-field Revert and Revert all.
//   - Apply → ApplyDialog → onApply({rubric, remember, switchTo, entry, module, validation,
//     classification}); the shell registers the module (and switches only for Create and switch).
//   - Downloads: all modules (.zip, via onDownloadAll), this module (.zip), rubric (.json),
//     logic (.js).
// ApplyDialog is exported for the upload dialog's "Load as derived" (mode "prepare").
//
// All wording here is non-clinical chrome (§7.5). Every clinical word on screen is read from
// the module being edited, and every edit is written back to the draft at its JSON pointer.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, Check, Download, FileCode, FileJson, Info, ListChecks, Lock, Plus, RotateCcw, Trash2, TriangleAlert, Undo2, X,
} from "lucide-react";
import { scopeCss } from "../engine/css.js";
import {
  acknowledgePaths, addFlag, addItem, bindDerived, canDeleteItem, caseFromSnapshot, classifyChanges, closureLabel,
  closureOutput, createEnglishPatientWording, createLexicon, deleteFlag, deleteItem, deriveAndBind, deriveRubric,
  diffRubrics, domainSum, flagDeletePlan, getAt, identityProblems, impactCases, impactRow, itemDependents, lockReason,
  lockViolations, newFlagProblems, newItemProblems, proposeIdentity, ptrOverlaps, ptrParse, revertChange, setAt,
  setMaxToSum,
} from "../engine/derive.js";
import { serializeRubric } from "../engine/bind.js";
import { buildExportZip, fetchBytesFor } from "../engine/exportAll.js";
import { downloadBytes, downloadText } from "../engine/download.js";
import { APP_VERSION, CAVEATS, LOCALE_NAMES } from "../engine/policy.js";
import { COPY_SLOTS } from "../engine/contract.js";
import { ENGINE_COPY_DEFAULTS } from "../engine/generic.js";
import { availabilityText, useModal, useSession } from "../ui/common.jsx";

// ------------------------------------------------------------------------------- chrome

/** Non-clinical chrome of the editor (English only, §7.5). Exported for the tests. */
export const EDITOR_COPY = {
  editing: "Editing",
  active: "active",
  sections: {
    identity: "Identity & versions", domains: "Domains & items", bands: "Bands", flags: "Red flags",
    context: "Context items", patient: "Patient wording", lexicon: "Lexicon", copy: "Copy", logic: "Logic (read-only)",
    downloads: "Downloads",
  },
  apply: "Apply…",
  applyBlocked: {
    none: "No changes yet.",
    errors: "Fix the validation errors first.",
    locks: "Undo the read-only changes first.",
    ack: "Acknowledge every edited wording the logic reads first.",
    busy: "Checking the draft…",
  },
  resume: "Resume saved draft",
  discard: "Discard it",
  savedDraft: "A draft of this module was saved in this browser on {date}.",
  savedDraftOther: "It was saved against a different version of this module.",
  draftNote: "Drafts are saved in this browser as you type. The loaded module never changes until you Apply.",
  ackLabel: "The new wording keeps the meaning these rules depend on.",
  readBy: "Read by:",
  produces: "In the sample cases these rules produce:",
  notProduced: "Not produced by any sample case.",
  validation: "Validation",
  validationOk: "No errors.",
  impact: "Impact preview",
  impactNote: "Sample cases and this session's screens only; this is not a validation.",
  impactEmpty: "Edit a field to see its impact on the sample cases.",
  changes: "Changes",
  changesEmpty: "No changes.",
  revert: "Revert",
  revertAll: "Revert all",
  locked: "Read-only",
  setMax: "set max = Σw",
  sumW: "Σw",
  addItem: "Add item",
  addFlag: "Add red flag",
  deleteItem: "Delete item",
  deleteFlag: "Delete red flag",
  safetyTitle: "This changes the safety gate",
  confirm: "Confirm",
  cancel: "Cancel",
  createLexicon: "Create lexicon",
  createPatient: "Create English patient wording",
  noLexicon: "This module has no extraction lexicon, so the Ambient Scribe cannot capture speech or typed statements for it.",
  noPatient: "This module carries no patient wording, so the Patient Companion is not available for it.",
  lastPhrase: "Every red flag needs at least one cue phrase, or speech can never raise it",
  negationWarn: "swept against this lexicon (Inv §4.1 #12); the gold set will not have been re-run",
  goldNone: "gold set — (not benchmarked)",
  logicNote: "Logic is code; edit it as a .js file and upload it.",
  downloadAll: "Download all modules (.zip)",
  downloadModule: "Download this module (.zip)",
  downloadRubric: "Download rubric (.json)",
  downloadLogic: "Download logic (.js)",
  downloadsNote: "Downloads hold the module as it is loaded. Edits that have not been applied are not included.",
  genericLogic: "Data-only module: no logic file (generic logic).",
  stale: "English changed",
  english: "English:",
  created: "Created {label}. Choose it from the Module menu when you want to use it.",
  createdSwitch: "Created {label}.",
  addItemRules: "The new item must satisfy: V11 (an id matching /^[a-z][a-z0-9_]*$/, unused by any item, context item, flag or info prompt); V13–V15 (a scale needs ≥ 2 labelled options with f from 0 to 1 and at least one f of 0; w ≠ 0 with the domain's sign; Σw must still equal the domain max — adjust another weight or use “set max = Σw”, which changes the scale and therefore the instrument); V32 (English patient wording when the module has it); V28 (lexicon phrases are lowercase and name existing items).",
  domainsFixed: "Domains cannot be added, removed or reordered here. Change the domain structure in a rubric JSON and upload it.",
};

const LS_PREFIX = "screenair.draft.v1.";
const SECTION_ORDER = ["identity", "domains", "bands", "flags", "context", "patient", "lexicon", "copy", "logic", "downloads"];

const EDITOR_CSS = `
.re-wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0C2B2F;font-size:13.5px;line-height:1.45}
.re-wrap *{box-sizing:border-box}
.re-top{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;background:#fff;border:1px solid #D7E1DF;border-radius:12px;padding:10px 12px;margin:0 0 12px}
.re-top label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5C6E6C;font-weight:650}
.re-top select{font:inherit;border:1px solid #D7E1DF;border-radius:8px;padding:6px 8px;background:#fff;color:#0C2B2F;max-width:100%;min-width:0;flex:1 1 220px}
.re-top .re-grow{flex:1 1 auto}
.re-top .re-status{font-size:12px;color:#5C6E6C}
.re-btn{font:inherit;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;border-radius:9px;border:1px solid #D7E1DF;background:#fff;color:#0C2B2F;padding:6px 11px;cursor:pointer;max-width:100%}
.re-btn:hover:not(:disabled){border-color:#137A80}
.re-btn:disabled{opacity:.55;cursor:not-allowed}
.re-btn.re-primary{background:#0F5C61;border-color:#0F5C61;color:#fff}
.re-btn.re-danger{color:#B84A33;border-color:#EBC3B6}
.re-btn.re-small{font-size:12px;padding:3px 8px;border-radius:7px}
.re-btn:focus-visible,.re-in:focus-visible{outline:2px solid #137A80;outline-offset:1px}
.re-banner{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;background:#FBF4E6;border:1px solid #E4C88E;color:#6B4A18;border-radius:12px;padding:8px 12px;margin:0 0 12px;font-size:12.5px}
.re-result{background:#E0EEE7;border:1px solid #B9D8C8;color:#1F5A40;border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:13px}
.re-result .re-av{display:block;font-size:12px;color:#2C5A47;margin-top:4px}
.re-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
@media (min-width:760px){.re-grid{grid-template-columns:170px minmax(0,1fr)}.re-side,.re-wide{grid-column:2}}
@media (min-width:1280px){.re-grid{grid-template-columns:170px minmax(0,1fr) 340px}.re-side{grid-column:3;grid-row:1 / span 2;align-self:start;position:sticky;top:var(--sa-sticky-top,8px);max-height:calc(100vh - var(--sa-sticky-top,8px) - 8px);overflow-y:auto}.re-wide{grid-column:2}}
.re-nav{display:flex;gap:4px;overflow-x:auto;padding:2px;align-self:start}
@media (min-width:760px){.re-nav{flex-direction:column;position:sticky;top:var(--sa-sticky-top,8px);overflow:visible}}
.re-nav button{font:inherit;font-size:12.5px;font-weight:600;text-align:left;border:1px solid transparent;background:transparent;color:#4F6466;border-radius:8px;padding:6px 9px;cursor:pointer;white-space:nowrap;flex:0 0 auto}
.re-nav button[aria-current="true"]{background:#0F5C61;color:#fff}
.re-nav button .re-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#B26C1F;margin-left:6px;vertical-align:middle}
.re-main{min-width:0}
.re-card{background:#fff;border:1px solid #D7E1DF;border-radius:12px;padding:12px 14px;margin:0 0 12px;min-width:0}
.re-card h3{font-size:14px;margin:0 0 8px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.re-card h4{font-size:13px;margin:10px 0 6px}
.re-sub{font-size:12px;color:#5C6E6C}
.re-mono{font-family:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;font-size:12px;word-break:break-all}
.re-field{margin:0 0 8px;min-width:0}
.re-field > label,.re-field > .re-flabel{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:11.5px;font-weight:650;color:#4F6466;margin:0 0 3px}
.re-in{font:inherit;font-size:13px;width:100%;max-width:100%;border:1px solid #D7E1DF;border-radius:8px;padding:6px 8px;background:#fff;color:#0C2B2F}
textarea.re-in{min-height:52px;resize:vertical}
.re-in[readonly]{background:#F3F6F5;color:#4F6466}
.re-field.re-changed .re-in{border-color:#B26C1F;background:#FFFBF3}
.re-field.re-err .re-in{border-color:#B84A33}
.re-tag{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:650;border-radius:999px;padding:1px 7px;background:#EEF2F1;color:#4F6466}
.re-tag.re-edit{background:#F6ECD9;color:#8A5414}
.re-tag.re-lock{background:#EEF2F1;color:#5C6E6C}
.re-tag.re-stale{background:#F6E1DA;color:#8E3520}
.re-msg{font-size:12px;color:#B84A33;margin-top:3px}
.re-hint{font-size:11.5px;color:#5C6E6C;margin-top:3px}
.re-ack{margin-top:5px;background:#FBF4E6;border:1px solid #E4C88E;border-radius:8px;padding:6px 8px;font-size:12px;color:#5F4316}
.re-ack label{display:flex;gap:6px;align-items:flex-start;font-weight:600;margin-top:4px}
.re-ack ul{margin:3px 0 0;padding-left:18px}
.re-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0 10px}
.re-item{border-top:1px solid #E5ECEA;padding:10px 0 4px}
.re-item:first-of-type{border-top:0}
.re-item-head{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:0 0 6px}
.re-opts{display:grid;grid-template-columns:minmax(0,1fr) 90px;gap:4px 8px;align-items:start;margin:4px 0 8px}
.re-chips{display:flex;flex-wrap:wrap;gap:5px;margin:3px 0}
.re-chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;background:#EEF4F3;border:1px solid #D7E1DF;border-radius:999px;padding:2px 4px 2px 9px;max-width:100%;word-break:break-word}
.re-chip button{border:0;background:transparent;cursor:pointer;color:#5C6E6C;padding:0 2px;display:inline-flex}
.re-chip button:disabled{opacity:.4;cursor:not-allowed}
.re-chip-add{display:flex;gap:6px;margin-top:4px}
.re-chip-add .re-in{flex:1 1 auto}
.re-list{list-style:none;margin:0;padding:0}
.re-list li{padding:5px 0;border-top:1px solid #EEF2F1;font-size:12.5px;display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap}
.re-list li:first-child{border-top:0}
.re-list li button.re-link{border:0;background:transparent;color:#0F5C61;cursor:pointer;font:inherit;text-align:left;padding:0;text-decoration:underline;word-break:break-word}
.re-list .re-e{color:#B84A33;font-weight:700}
.re-warns{margin-top:6px;font-size:12.5px}
.re-warns summary{cursor:pointer;color:#8A5414;font-weight:600}
.re-list .re-w{color:#B26C1F;font-weight:700}
.re-scroll{overflow-x:auto;max-width:100%}
.re-table{border-collapse:collapse;font-size:12px;min-width:640px;width:100%}
.re-table th,.re-table td{border-bottom:1px solid #EEF2F1;padding:5px 6px;text-align:left;vertical-align:top}
.re-table th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5C6E6C}
.re-table td.re-diff{background:#FFF4DE}
.re-table .re-cur td{background:#F1F5F4}
.re-table ul{margin:0;padding-left:14px}
.re-table details summary{cursor:pointer;color:#4F6466;white-space:nowrap}
.re-table ul.re-delta{list-style:none;padding-left:0;margin:0 0 4px}
.re-table .re-del{color:#8E3520;text-decoration:line-through}
.re-table .re-add{color:#1F5A40;font-weight:600}
.re-warn{background:#FBF4E6;border:1px solid #E4C88E;color:#6B4A18;border-radius:8px;padding:6px 9px;font-size:12px;margin:4px 0 8px}
.re-ro pre{white-space:pre-wrap;word-break:break-word;font-size:11.5px;background:#F3F6F5;border-radius:8px;padding:8px;max-height:280px;overflow:auto}
.re-dl{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.re-form{background:#F7FAF9;border:1px dashed #C9D6D3;border-radius:10px;padding:10px 12px;margin-top:10px}
.re-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.re-scroll:focus-visible,.re-ro pre:focus-visible,.re-side:focus-visible{outline:2px solid #137A80;outline-offset:2px}
`;

const DIALOG_CSS = `
.re-overlay{position:fixed;inset:0;background:rgba(12,43,47,.45);z-index:80;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0C2B2F;font-size:13.5px;line-height:1.45}
.re-overlay *{box-sizing:border-box}
.re-dialog{background:#fff;border-radius:14px;max-width:720px;width:100%;padding:16px 18px;box-shadow:0 18px 50px rgba(0,0,0,.25)}
.re-dialog h2{font-size:17px;margin:0 0 8px}
.re-dialog h3{font-size:13.5px;margin:14px 0 6px}
.re-dialog .re-field{margin:0 0 9px}
.re-dialog label.re-l{display:block;font-size:11.5px;font-weight:650;color:#4F6466;margin:0 0 3px}
.re-dialog .re-in{font:inherit;font-size:13px;width:100%;border:1px solid #D7E1DF;border-radius:8px;padding:6px 8px;background:#fff;color:#0C2B2F}
.re-dialog .re-in[readonly]{background:#F3F6F5;color:#4F6466}
.re-dialog textarea.re-in{min-height:60px}
.re-dialog .re-msg{font-size:12px;color:#B84A33;margin-top:3px}
.re-dialog .re-hint{font-size:11.5px;color:#5C6E6C;margin-top:3px}
.re-dialog .re-notice{background:#FBF4E6;border:1px solid #E4C88E;color:#6B4A18;border-radius:8px;padding:6px 9px;font-size:12.5px;margin:0 0 6px}
.re-dialog .re-reason{background:#F6E1DA;border:1px solid #EBC3B6;color:#7A2E1F;border-radius:8px;padding:6px 9px;font-size:12.5px;margin:0 0 10px}
.re-dialog .re-checks label{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;margin:0 0 6px}
.re-dialog .re-checks .re-mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:#4F6466;word-break:break-all}
.re-dialog .re-errs{list-style:none;margin:0;padding:0;font-size:12px;color:#B84A33}
.re-dialog .re-errs li{padding:2px 0;word-break:break-word}
.re-dialog .re-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:14px}
.re-dialog .re-btn{font:inherit;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;border-radius:9px;border:1px solid #D7E1DF;background:#fff;color:#0C2B2F;padding:7px 12px;cursor:pointer}
.re-dialog .re-btn:disabled{opacity:.55;cursor:not-allowed}
.re-dialog .re-btn.re-primary{background:#0F5C61;border-color:#0F5C61;color:#fff}
.re-dialog .re-btn:focus-visible,.re-dialog .re-in:focus-visible{outline:2px solid #137A80;outline-offset:1px}
.re-dialog ul.re-body{margin:4px 0 0;padding-left:18px;font-size:12.5px}
.re-dialog .re-caveat{margin-top:12px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#8E3520}
`;

const CSS = scopeCss(EDITOR_CSS, ".sa-editor");
const DCSS = scopeCss(DIALOG_CSS, ".re-apply");

// ------------------------------------------------------------------------------ helpers

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const short = (v, n = 90) => {
  if (v === undefined) return "—";
  const s = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};
const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
const nowIso = (now) => (typeof now === "function" ? now() : (typeof now === "string" ? now : new Date().toISOString()));

function lsGet(key) {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}
function lsSet(key, value) {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* storage blocked: the draft lives in memory */ }
}

/** The availability summary line of a result card (§5.2): the shared builder in ui/common.jsx,
 *  worded as the shell's Module info and upload dialog. Re-exported for existing callers. */
export { availabilityText };

/** An ISO timestamp as local "YYYY-MM-DD HH:MM" (the clinician's clock, not UTC); the raw
 *  text when it does not parse. */
export function localStamp(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return String(iso || "").replace("T", " ").slice(0, 16);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function sectionOf(path) {
  const s = ptrParse(path)[0] || "";
  if (path === "/copy/indexName") return "identity";
  if (["label", "name", "id", "instrumentVersion", "logicBinding", "provenance", "changelog", "format", "contractVersion"].includes(s)) return "identity";
  if (s === "domains") return "domains";
  if (s === "bands") return "bands";
  if (s === "redFlags") return "flags";
  if (s === "contextItems" || s === "gapRule") return "context";
  if (s === "locales") return "patient";
  if (s === "lexicon") return "lexicon";
  if (s === "copy") return "copy";
  if (s === "logic" || s === "upload") return "logic";
  return "identity";
}

function originWord(m) {
  return m.origin === "builtin" ? "built-in" : m.origin === "derived" ? "edited" : "uploaded";
}

// --------------------------------------------------------------------- editor context

const Ctx = createContext(null);
const useEd = () => useContext(Ctx);

function useNumberText(value) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      const cur = text.trim() === "" ? null : Number(text);
      if (cur !== value) setText(value === null || value === undefined ? "" : String(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return [text, (t) => { setText(t); }];
}

/** One editable (or locked) field at a JSON pointer. */
function Field({ path, label, kind = "text", hint = null, lower = false, placeholder = "" }) {
  const ed = useEd();
  const value = getAt(ed.rubric, path);
  const parentValue = getAt(ed.parent.rubric, path);
  const reason = lockReason(path);
  // A field inside a block this draft created (Create lexicon, Create English wording) is new,
  // not edited: the parent has no value there to differ from or revert to.
  const inCreatedBlock = parentValue === undefined && ed.changes.some((c) => path.startsWith(`${c.path}/`) && getAt(ed.parent.rubric, c.path) === undefined);
  const changed = !inCreatedBlock && (ed.changedSet.has(path) || (value !== parentValue && JSON.stringify(value) !== JSON.stringify(parentValue)));
  const errs = ed.errorsAt(path);
  const ack = ed.ackFor(path);
  const id = `re-f-${path.replace(/[^A-Za-z0-9]+/g, "-")}`;
  const [numText, setNumText] = useNumberText(kind === "number" ? value : null);
  const onText = (e) => {
    let v = e.target.value;
    if (lower) v = v.toLowerCase();
    ed.update(path, v);
  };
  const onNum = (e) => {
    const t = e.target.value;
    setNumText(t);
    const n = t.trim() === "" ? null : Number(t);
    ed.update(path, Number.isFinite(n) ? n : null);
  };
  const common = {
    id, className: "re-in", "data-path": path, readOnly: !!reason, "aria-readonly": reason ? "true" : undefined,
    title: reason || undefined, placeholder,
  };
  let input;
  if (kind === "textarea") input = <textarea {...common} value={value ?? ""} onChange={reason ? undefined : onText} rows={2} />;
  else if (kind === "number") input = <input {...common} type="text" inputMode="decimal" value={reason ? (value ?? "") : numText} onChange={reason ? undefined : onNum} />;
  else input = <input {...common} type="text" value={value ?? ""} onChange={reason ? undefined : onText} />;
  const cls = ["re-field"];
  if (changed && !reason) cls.push("re-changed");
  if (errs.length) cls.push("re-err");
  return (
    <div className={cls.join(" ")}>
      <label htmlFor={id}>
        <span>{label}</span>
        {reason && <span className="re-tag re-lock" title={reason}><Lock size={11} aria-hidden="true" />{EDITOR_COPY.locked}</span>}
        {changed && !reason && <span className="re-tag re-edit">edited</span>}
        {ed.staleAt(path) && <span className="re-tag re-stale">{EDITOR_COPY.stale}</span>}
        {changed && !reason && (
          <button type="button" className="re-btn re-small" data-revert={path} onClick={() => ed.revertPath(path)}>
            <Undo2 size={12} aria-hidden="true" />{EDITOR_COPY.revert}
          </button>
        )}
      </label>
      {input}
      {reason && <div className="re-hint">{reason}</div>}
      {hint && <div className="re-hint">{hint}</div>}
      {errs.map((e, i) => <div key={i} className="re-msg">{e.code} · {e.msg}</div>)}
      {ack && changed && <AckBox path={path} ack={ack} />}
    </div>
  );
}

/** The acknowledgement under an edited field the logic reads (§5.7). */
function AckBox({ path, ack }) {
  const ed = useEd();
  const checked = !!ed.acked[path];
  const outputs = useMemo(() => ed.outputsFor(ack.dependents), [ed.outputsFor, ack]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="re-ack" data-ack={path}>
      <div><b>{EDITOR_COPY.readBy}</b> {ack.dependents.map(closureLabel).join("; ")}</div>
      {outputs.length ? (
        <>
          <div style={{ marginTop: 4 }}>{EDITOR_COPY.produces}</div>
          <ul>{outputs.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </>
      ) : <div className="re-hint">{EDITOR_COPY.notProduced}</div>}
      <label>
        <input type="checkbox" data-ack-check={path} checked={checked} onChange={(e) => ed.setAck(path, e.target.checked)} />
        <span>{EDITOR_COPY.ackLabel}</span>
      </label>
    </div>
  );
}

/** A list of phrases (lowercase while typing); `minOne` keeps the last phrase. */
function PhraseList({ path, label, minOne = false }) {
  const ed = useEd();
  const list = arr(getAt(ed.rubric, path));
  const [text, setText] = useState("");
  const reason = lockReason(path + "/0") && lockReason(path);
  const add = () => {
    const v = text.trim().toLowerCase();
    if (!v || list.includes(v)) return;
    ed.update(path, [...list, v]);
    setText("");
  };
  return (
    <div className="re-field" data-path={path}>
      <div className="re-flabel"><span>{label}</span>{ed.changedUnder(path) && <span className="re-tag re-edit">edited</span>}</div>
      <div className="re-chips">
        {list.map((p, i) => {
          const last = minOne && list.length <= 1;
          return (
            <span className="re-chip" key={i + ":" + p}>
              {p}
              <button type="button" aria-label={`Remove ${p}`} data-remove-phrase={`${path}/${i}`} disabled={!!reason || last}
                title={last ? EDITOR_COPY.lastPhrase : undefined}
                onClick={() => ed.update(path, list.filter((_, j) => j !== i))}>
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          );
        })}
        {!list.length && <span className="re-sub">(none)</span>}
      </div>
      {minOne && list.length <= 1 && <div className="re-hint">{EDITOR_COPY.lastPhrase} (V28).</div>}
      {!reason && (
        <div className="re-chip-add">
          <input className="re-in" type="text" value={text} data-add-phrase={path} aria-label={`Add a phrase to ${label}`}
            onChange={(e) => setText(e.target.value.toLowerCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="re-btn re-small" onClick={add} disabled={!text.trim()}><Plus size={12} aria-hidden="true" />Add</button>
        </div>
      )}
      {ed.errorsAt(path).map((e, i) => <div key={i} className="re-msg">{e.code} · {e.msg}</div>)}
    </div>
  );
}

/** A modal confirmation (no window.confirm). */
function Confirm({ state, onClose }) {
  const backdropRef = useRef(null);
  const cancelRef = useRef(null);
  // Modal keyboard handling (initial focus on Cancel — the safe action, Tab trap, Escape,
  // inert background, focus returned to the opener), the shell dialogs' contract (ui/common.jsx).
  useModal(!!state, { backdropRef, initialFocusRef: cancelRef, onClose, fallbackFocus: "[data-testid=rubric-editor] [data-section-nav]" });
  if (!state) return null;
  return (
    <div className="re-apply" ref={backdropRef}>
      <style>{DCSS}</style>
      <div className="re-overlay" role="dialog" aria-modal="true" aria-label={state.title} data-testid="editor-confirm">
        <div className="re-dialog">
          <h2>{state.title}</h2>
          {state.body && <p style={{ margin: "0 0 6px" }}>{state.body}</p>}
          {arr(state.lines).length > 0 && <ul className="re-body">{state.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
          <div className="re-caveat">{CAVEATS.prototype}</div>
          <div className="re-actions">
            <button type="button" className="re-btn" ref={cancelRef} data-confirm="cancel" onClick={onClose}>{EDITOR_COPY.cancel}</button>
            <button type="button" className="re-btn re-primary" data-confirm="ok" onClick={() => { const f = state.onConfirm; onClose(); f(); }}>
              {state.confirmLabel || EDITOR_COPY.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------ sections

function IdentitySection() {
  const ed = useEd();
  const m = ed.parent;
  const v = m.versions;
  return (
    <div className="re-card" data-section="identity">
      <h3>{EDITOR_COPY.sections.identity}</h3>
      <div className="re-row">
        <Field path="/label" label="Label (menu and page title)" />
        <Field path="/name" label="Name (used in wording as {name})" />
      </div>
      <Field path="/copy/indexName" label="Index name (copy.indexName)" placeholder={String(ENGINE_COPY_DEFAULTS.indexName || "")} />
      <div className="re-row">
        <Field path="/id" label="Module id" />
        <Field path="/instrumentVersion" label="Instrument version" />
      </div>
      {ed.rubric.lexicon ? <Field path="/lexicon/version" label="Lexicon version" /> : null}
      <div className="re-field">
        <div className="re-flabel"><span>Logic binding</span><span className="re-tag re-lock"><Lock size={11} aria-hidden="true" />{EDITOR_COPY.locked}</span></div>
        <div className="re-mono" data-path="/logicBinding">{JSON.stringify(ed.rubric.logicBinding)}</div>
        <div className="re-hint">{lockReason("/logicBinding")}</div>
      </div>
      <h4>Version axes</h4>
      <div className="re-sub">
        release {APP_VERSION} · instrument {v.instrument ?? "—"} · lexicon {v.lexicon ?? "—"} · probe set {v.probeSet ?? "—"} · gold set {v.goldSet ?? "— (not benchmarked)"}
        {v.goldSet && v.goldSetLexicon && v.goldSetLexicon !== v.lexicon ? ` (benchmarked on lexicon ${v.goldSetLexicon}; not re-run)` : ""}
      </div>
      <div className="re-hint">Versions are set in the Apply dialog: an edited instrument or lexicon gets a “-local” version.</div>
    </div>
  );
}

function DomainsSection() {
  const ed = useEd();
  const r = ed.rubric;
  return (
    <>
      <div className="re-warn">{EDITOR_COPY.domainsFixed}</div>
      {arr(r.domains).map((d, di) => {
        const sum = domainSum(d);
        const off = Math.abs(sum - d.max) > 1e-9;
        return (
          <div className="re-card" key={d.key} data-section="domains" data-domain={d.key}>
            <h3>
              <span>{d.label}</span>
              <span className="re-tag re-lock re-mono">{d.key}</span>
              {d.negative ? <span className="re-tag">negative</span> : null}
            </h3>
            <div className="re-row">
              <Field path={`/domains/${di}/label`} label="Domain label" />
              <Field path={`/domains/${di}/max`} label="Max" kind="number" />
            </div>
            <div className="re-sub" data-sum={d.key}>
              {EDITOR_COPY.sumW} = {Math.round(sum * 1e6) / 1e6}{off ? ` ≠ max ${d.max}` : " = max"}{" "}
              {off && (
                <button type="button" className="re-btn re-small" data-set-max={di} onClick={() => ed.replace((x) => setMaxToSum(x, di))}>
                  {EDITOR_COPY.setMax}
                </button>
              )}
            </div>
            {arr(d.items).map((it, ii) => <ItemEditor key={it.id || ii} di={di} ii={ii} item={it} />)}
          </div>
        );
      })}
      <AddItemForm />
    </>
  );
}

function ItemEditor({ di, ii, item }) {
  const ed = useEd();
  const base = `/domains/${di}/items/${ii}`;
  const isNew = !ed.parentItemIds.has(item.id);
  const deletable = isNew || canDeleteItem(ed.parent, item.id);
  const askDelete = () => {
    const deps = itemDependents(ed.rubric, item.id);
    ed.confirm({
      title: `${EDITOR_COPY.deleteItem} “${item.id}”`,
      body: deps.length ? "These entries depend on it and are removed with it:" : "Nothing else refers to this item.",
      lines: deps.map((x) => `${x.what} (${x.path})`),
      confirmLabel: EDITOR_COPY.deleteItem,
      onConfirm: () => ed.replace((x) => deleteItem(x, item.id)),
    });
  };
  return (
    <div className="re-item" data-item={item.id}>
      <div className="re-item-head">
        <span className="re-tag re-lock re-mono" title={lockReason(base + "/id")}><Lock size={11} aria-hidden="true" />{item.id}</span>
        <span className="re-sub">{Array.isArray(item.scale) ? `scale · ${item.scale.length} options` : "yes / no"}</span>
        {isNew && <span className="re-tag re-edit">new</span>}
        <span className="re-grow" />
        <button type="button" className="re-btn re-small re-danger" disabled={!deletable} data-delete-item={item.id}
          title={deletable ? undefined : "The module's logic reads this item, so it cannot be deleted."} onClick={askDelete}>
          <Trash2 size={12} aria-hidden="true" />{EDITOR_COPY.deleteItem}
        </button>
      </div>
      <Field path={`${base}/text`} label="Clinician text" kind="textarea" />
      <div className="re-row">
        <Field path={`${base}/w`} label="Weight w" kind="number" />
        <Field path={`${base}/short`} label="Short label" />
        <Field path={`${base}/ref`} label="Criterion ref" />
      </div>
      <div className="re-row">
        <Field path={`${base}/ask`} label="Scribe phrasing (ask)" />
        <Field path={`${base}/patientClin`} label="Line for the clinician (patient summary)" />
      </div>
      {Array.isArray(item.scale) && (
        <div className="re-opts">
          {item.scale.map((o, k) => (
            <React.Fragment key={k}>
              <Field path={`${base}/scale/${k}/label`} label={`Option ${k} label`} />
              <Field path={`${base}/scale/${k}/f`} label="f" kind="number" />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_ITEM = { id: "", domain: "", type: "boolean", w: "", text: "", short: "", ask: "", ref: "", patientClin: "", q: "", options: [{ label: "", f: 0 }, { label: "", f: 1 }], patientOpts: ["", ""], lexPh: "", lexCue: "" };

function AddItemForm() {
  const ed = useEd();
  const r = ed.rubric;
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(() => ({ ...EMPTY_ITEM, domain: arr(r.domains)[0] ? r.domains[0].key : "" }));
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));
  const hasPatient = !!(r.locales && r.locales.en && isObj(r.locales.en.items));
  const spec = {
    id: s.id.trim(), domain: s.domain, type: s.type, w: s.w === "" ? NaN : Number(s.w), text: s.text, short: s.short, ask: s.ask,
    ref: s.ref, patientClin: s.patientClin, q: s.q,
    options: s.type === "scale" ? s.options.map((o) => ({ label: o.label, f: Number(o.f) })) : undefined,
    patientOpts: s.type === "scale" ? s.patientOpts : undefined,
    lexicon: r.lexicon ? (s.type === "scale"
      ? (s.lexCue.trim() ? { cue: s.lexCue.split(",").map((x) => x.trim()).filter(Boolean), bands: [], fallback: s.options.length - 1 } : null)
      : (s.lexPh.trim() ? { ph: s.lexPh.split(",").map((x) => x.trim()).filter(Boolean) } : null)) : null,
  };
  const problems = newItemProblems(r, spec);
  const pf = (f) => problems.filter((p) => p.field === f || p.field.startsWith(f + "/"));
  const msg = (f) => pf(f).map((p, i) => <div key={i} className="re-msg">{p.code} · {p.msg}</div>);
  if (!open) {
    return <button type="button" className="re-btn" data-open-add-item onClick={() => setOpen(true)}><Plus size={14} aria-hidden="true" />{EDITOR_COPY.addItem}</button>;
  }
  const add = () => {
    ed.replace((x) => addItem(x, spec));
    setS({ ...EMPTY_ITEM, domain: s.domain });
    setOpen(false);
  };
  return (
    <div className="re-form" data-testid="add-item-form">
      <h4 style={{ marginTop: 0 }}>{EDITOR_COPY.addItem}</h4>
      <div className="re-hint" style={{ marginBottom: 8 }}>{EDITOR_COPY.addItemRules}</div>
      <div className="re-row">
        <div className="re-field"><label className="re-flabel" htmlFor="re-ni-id">New id</label>
          <input id="re-ni-id" className="re-in" data-new-item="id" value={s.id} onChange={(e) => set("id", e.target.value)} />{msg("id")}</div>
        <div className="re-field"><label className="re-flabel" htmlFor="re-ni-domain">Domain</label>
          <select id="re-ni-domain" className="re-in" data-new-item="domain" value={s.domain} onChange={(e) => set("domain", e.target.value)}>
            {arr(r.domains).map((d) => <option key={d.key} value={d.key}>{d.label}{d.negative ? " (negative)" : ""}</option>)}
          </select>{msg("domain")}</div>
        <div className="re-field"><label className="re-flabel" htmlFor="re-ni-type">Type</label>
          <select id="re-ni-type" className="re-in" data-new-item="type" value={s.type} onChange={(e) => set("type", e.target.value)}>
            <option value="boolean">yes / no</option><option value="scale">scale</option>
          </select></div>
        <div className="re-field"><label className="re-flabel" htmlFor="re-ni-w">Weight w</label>
          <input id="re-ni-w" className="re-in" data-new-item="w" inputMode="decimal" value={s.w} onChange={(e) => set("w", e.target.value)} />{msg("w")}</div>
      </div>
      <div className="re-field"><label className="re-flabel" htmlFor="re-ni-text">Clinician text</label>
        <textarea id="re-ni-text" className="re-in" data-new-item="text" value={s.text} onChange={(e) => set("text", e.target.value)} />{msg("text")}</div>
      <div className="re-row">
        {["short", "ask", "ref", "patientClin"].map((k) => (
          <div className="re-field" key={k}><label className="re-flabel" htmlFor={`re-ni-${k}`}>{k} (optional)</label>
            <input id={`re-ni-${k}`} className="re-in" value={s[k]} onChange={(e) => set(k, e.target.value)} /></div>
        ))}
      </div>
      {s.type === "scale" && (
        <div className="re-field">
          <div className="re-flabel">Options (label, f){hasPatient ? " and the patient's answer label" : ""}</div>
          {s.options.map((o, k) => (
            <div className="re-row" key={k}>
              <input className="re-in" aria-label={`Option ${k} label`} value={o.label} onChange={(e) => set("options", s.options.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)))} />
              <input className="re-in" aria-label={`Option ${k} f`} inputMode="decimal" value={o.f} onChange={(e) => set("options", s.options.map((x, j) => (j === k ? { ...x, f: e.target.value } : x)))} />
              {hasPatient && <input className="re-in" aria-label={`Option ${k} patient label`} value={s.patientOpts[k] || ""} onChange={(e) => set("patientOpts", s.options.map((_, j) => (j === k ? e.target.value : (s.patientOpts[j] || ""))))} />}
            </div>
          ))}
          <div className="re-chips">
            <button type="button" className="re-btn re-small" onClick={() => { set("options", [...s.options, { label: "", f: 1 }]); set("patientOpts", [...s.patientOpts, ""]); }}><Plus size={12} aria-hidden="true" />Option</button>
            {s.options.length > 2 && <button type="button" className="re-btn re-small" onClick={() => { set("options", s.options.slice(0, -1)); set("patientOpts", s.patientOpts.slice(0, -1)); }}><X size={12} aria-hidden="true" />Last option</button>}
          </div>
          {msg("options")}{msg("patientOpts")}
        </div>
      )}
      {hasPatient && (
        <div className="re-field"><label className="re-flabel" htmlFor="re-ni-q">English patient question</label>
          <input id="re-ni-q" className="re-in" data-new-item="q" value={s.q} onChange={(e) => set("q", e.target.value)} />{msg("q")}</div>
      )}
      {r.lexicon && (
        <div className="re-field"><label className="re-flabel" htmlFor="re-ni-lex">{s.type === "scale" ? "Lexicon cue phrases (optional, comma-separated)" : "Lexicon phrases (optional, comma-separated)"}</label>
          <input id="re-ni-lex" className="re-in" value={s.type === "scale" ? s.lexCue : s.lexPh}
            onChange={(e) => set(s.type === "scale" ? "lexCue" : "lexPh", e.target.value.toLowerCase())} />{msg("lexicon")}</div>
      )}
      <div className="re-chips">
        <button type="button" className="re-btn re-primary" data-add-item-submit disabled={problems.length > 0} onClick={add}><Plus size={14} aria-hidden="true" />{EDITOR_COPY.addItem}</button>
        <button type="button" className="re-btn" onClick={() => setOpen(false)}>{EDITOR_COPY.cancel}</button>
      </div>
    </div>
  );
}

function BandsSection() {
  const ed = useEd();
  const scaleMax = arr(ed.rubric.domains).filter((d) => !d.negative).reduce((s, d) => s + (Number(d.max) || 0), 0);
  return (
    <div className="re-card" data-section="bands">
      <h3>{EDITOR_COPY.sections.bands}</h3>
      <div className="re-row">
        <Field path="/bands/cuts/moderate" label="Cut-point: moderate" kind="number" />
        <Field path="/bands/cuts/high" label="Cut-point: high" kind="number" />
      </div>
      <div className="re-sub">Scale maximum (Σ positive domain max): {scaleMax}. Cut-points are integers with 0 &lt; moderate &lt; high ≤ scale maximum (V16).</div>
    </div>
  );
}

const EMPTY_FLAG = { id: "", tier: "urgent", group: "", text: "", points: "", action: "", q: "", say: "", cues: "" };

function FlagsSection() {
  const ed = useEd();
  const r = ed.rubric;
  const [adding, setAdding] = useState(false);
  const [s, setS] = useState(EMPTY_FLAG);
  const hasPatient = !!(r.locales && r.locales.en && isObj(r.locales.en.items));
  const spec = { ...s, id: s.id.trim(), cues: s.cues.split(",").map((x) => x.trim()).filter(Boolean) };
  const problems = newFlagProblems(r, spec);
  const msg = (f) => problems.filter((p) => p.field === f).map((p, i) => <div key={i} className="re-msg">{p.code} · {p.msg}</div>);
  const tierChange = (i, f, to) => ed.confirm({
    title: EDITOR_COPY.safetyTitle,
    body: `Change the tier of red flag “${f.id}” from ${f.tier} to ${to}?`,
    onConfirm: () => ed.update(`/redFlags/${i}/tier`, to),
  });
  const del = (f) => {
    const plan = flagDeletePlan(ed.parent, r, f.id);
    ed.confirm({
      title: EDITOR_COPY.safetyTitle,
      body: `Delete red flag “${f.id}”? These entries go with it:`,
      lines: plan.removes.map((x) => `${x.what} (${x.path})`),
      confirmLabel: EDITOR_COPY.deleteFlag,
      onConfirm: () => ed.replace((x) => deleteFlag(ed.parent, x, f.id)),
    });
  };
  const submit = () => ed.confirm({
    title: EDITOR_COPY.safetyTitle,
    body: `Add red flag “${spec.id}” (${spec.tier})?`,
    onConfirm: () => { ed.replace((x) => addFlag(x, spec)); setS(EMPTY_FLAG); setAdding(false); },
  });
  return (
    <>
      {arr(r.redFlags).map((f, i) => {
        const plan = flagDeletePlan(ed.parent, r, f.id);
        return (
          <div className="re-card" key={f.id || i} data-section="flags" data-flag={f.id}>
            <h3>
              <span className="re-tag re-lock re-mono"><Lock size={11} aria-hidden="true" />{f.id}</span>
              <label className="re-sub" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                Tier
                <select className="re-in" style={{ width: "auto" }} data-path={`/redFlags/${i}/tier`} value={f.tier}
                  onChange={(e) => tierChange(i, f, e.target.value)}>
                  <option value="emergent">emergent</option><option value="urgent">urgent</option>
                </select>
              </label>
              <span className="re-grow" />
              <button type="button" className="re-btn re-small re-danger" data-delete-flag={f.id} disabled={!plan.allowed}
                title={plan.allowed ? undefined : plan.reason} onClick={() => del(f)}>
                <Trash2 size={12} aria-hidden="true" />{EDITOR_COPY.deleteFlag}
              </button>
            </h3>
            {!plan.allowed && <div className="re-hint" style={{ marginBottom: 6 }}>{plan.reason}</div>}
            <Field path={`/redFlags/${i}/text`} label="Text" kind="textarea" />
            <div className="re-row">
              <Field path={`/redFlags/${i}/group`} label="Group" />
              <Field path={`/redFlags/${i}/points`} label="Points to (clinician only)" />
            </div>
            <Field path={`/redFlags/${i}/action`} label="Action (clinician only)" kind="textarea" />
          </div>
        );
      })}
      {!adding ? (
        <button type="button" className="re-btn" data-open-add-flag onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" />{EDITOR_COPY.addFlag}</button>
      ) : (
        <div className="re-form" data-testid="add-flag-form">
          <h4 style={{ marginTop: 0 }}>{EDITOR_COPY.addFlag}</h4>
          <div className="re-hint" style={{ marginBottom: 8 }}>A new flag needs an id (V11), a tier, group, text, points and action (V21){hasPatient ? ", English patient wording (V23)" : ""}{r.lexicon ? " and at least one cue phrase (V28)" : ""}. Adding it changes the safety gate.</div>
          <div className="re-row">
            <div className="re-field"><label className="re-flabel">New id</label><input className="re-in" value={s.id} onChange={(e) => setS({ ...s, id: e.target.value })} />{msg("id")}</div>
            <div className="re-field"><label className="re-flabel">Tier</label>
              <select className="re-in" value={s.tier} onChange={(e) => setS({ ...s, tier: e.target.value })}><option value="emergent">emergent</option><option value="urgent">urgent</option></select></div>
            <div className="re-field"><label className="re-flabel">Group</label><input className="re-in" value={s.group} onChange={(e) => setS({ ...s, group: e.target.value })} />{msg("group")}</div>
          </div>
          {["text", "points", "action"].map((k) => (
            <div className="re-field" key={k}><label className="re-flabel">{k}</label><input className="re-in" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} />{msg(k)}</div>
          ))}
          {hasPatient && ["q", "say"].map((k) => (
            <div className="re-field" key={k}><label className="re-flabel">English patient {k}</label><input className="re-in" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} />{msg(k)}</div>
          ))}
          {r.lexicon && (
            <div className="re-field"><label className="re-flabel">Cue phrases (comma-separated)</label><input className="re-in" value={s.cues} onChange={(e) => setS({ ...s, cues: e.target.value.toLowerCase() })} />{msg("cues")}</div>
          )}
          <div className="re-chips">
            <button type="button" className="re-btn re-primary" disabled={problems.length > 0} onClick={submit}><Plus size={14} aria-hidden="true" />{EDITOR_COPY.addFlag}</button>
            <button type="button" className="re-btn" onClick={() => setAdding(false)}>{EDITOR_COPY.cancel}</button>
          </div>
        </div>
      )}
    </>
  );
}

function ContextSection() {
  const ed = useEd();
  const r = ed.rubric;
  if (!arr(r.contextItems).length) return <div className="re-card" data-section="context"><h3>{EDITOR_COPY.sections.context}</h3><div className="re-sub">This module has no context items.</div></div>;
  return (
    <>
      {arr(r.contextItems).map((c, i) => (
        <div className="re-card" key={c.id} data-section="context">
          <h3><span className="re-tag re-lock re-mono"><Lock size={11} aria-hidden="true" />{c.id}</span></h3>
          <Field path={`/contextItems/${i}/text`} label="Clinician question" />
          {arr(c.options).map((o, k) => (
            <Field key={k} path={`/contextItems/${i}/options/${k}/1`} label={`Option label (value “${o[0]}”, locked)`} />
          ))}
          {c.signal && (
            <>
              <h4>Gap signal (value “{c.signal.value}”, locked)</h4>
              <div className="re-row">
                <Field path={`/contextItems/${i}/signal/screenerLabel`} label="Screener label" />
                <Field path={`/contextItems/${i}/signal/scribeLabel`} label="Scribe label" />
                <Field path={`/contextItems/${i}/signal/noteLabel`} label="Note label" />
              </div>
            </>
          )}
        </div>
      ))}
      {r.gapRule && (
        <div className="re-card" data-section="context">
          <h3>Gap rule</h3>
          <Field path="/gapRule/threshold" label={`Threshold (1–${arr(r.gapRule.markers).length})`} kind="number" />
          <div className="re-sub">Markers (locked): {arr(r.gapRule.markers).join(", ")}</div>
        </div>
      )}
    </>
  );
}

function PatientSection() {
  const ed = useEd();
  const r = ed.rubric;
  const locs = isObj(r.locales) ? Object.keys(r.locales) : [];
  const loc = locs.includes(ed.patientLoc) ? ed.patientLoc : (locs[0] || "en");
  const L = isObj(r.locales) ? r.locales[loc] : null;
  const en = isObj(r.locales) ? r.locales.en : null;
  if (!en || !isObj(en.items)) {
    return (
      <div className="re-card" data-section="patient">
        <h3>{EDITOR_COPY.sections.patient}</h3>
        <p className="re-sub">{EDITOR_COPY.noPatient}</p>
        <button type="button" className="re-btn" data-create-patient onClick={() => ed.replace(createEnglishPatientWording)}>
          <Plus size={14} aria-hidden="true" />{EDITOR_COPY.createPatient}
        </button>
      </div>
    );
  }
  const P = (sub) => `/locales/${loc}${sub}`;
  const hintEn = (sub) => (loc === "en" ? null : (() => { const v = getAt(r, `/locales/en${sub}`); return v === undefined ? null : `${EDITOR_COPY.english} ${Array.isArray(v) ? v.join(" · ") : v}`; })());
  const stepKeys = [...new Set([...arr(ed.parent.steps && ed.parent.steps.patient).map((s) => s.key), ...Object.keys((L && L.steps) || {})])];
  return (
    <>
      <div className="re-card" data-section="patient">
        <h3>
          {EDITOR_COPY.sections.patient}
          <span className="re-grow" />
          <label className="re-sub" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>Language
            <select className="re-in" style={{ width: "auto" }} data-patient-locale value={loc} onChange={(e) => ed.setPatientLoc(e.target.value)}>
              {locs.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l] || l}</option>)}
            </select>
          </label>
        </h3>
        <div className="re-sub">
          {L && L.reviewed === false ? "Marked unreviewed. " : ""}{L && L.editedLocally ? "Edited locally. " : ""}
          {L && arr(L.stale).length ? `${arr(L.stale).length} translation(s) behind the English. ` : ""}
          Editing any wording here marks this language unreviewed; editing English marks the matching translations as behind it.
        </div>
      </div>
      <div className="re-card" data-section="patient">
        <h3>Questions</h3>
        {arr(r.domains).flatMap((d) => arr(d.items).map((it) => ({ ...it, domain: d.key }))).map((it) => (
          <div className="re-item" key={it.id} data-patient-item={it.id}>
            <div className="re-item-head"><span className="re-tag re-mono">{it.id}</span><span className="re-sub">{it.text}</span></div>
            <Field path={P(`/items/${it.id}/q`)} label="Question" kind="textarea" hint={hintEn(`/items/${it.id}/q`)} />
            {Array.isArray(it.scale) && it.scale.map((_, k) => (
              <Field key={k} path={P(`/items/${it.id}/opts/${k}`)} label={`Answer ${k}`} hint={hintEn(`/items/${it.id}/opts/${k}`)} />
            ))}
            {(getAt(r, P(`/items/${it.id}/ask`)) !== undefined || getAt(r, `/locales/en/items/${it.id}/ask`) !== undefined) && (
              <Field path={P(`/items/${it.id}/ask`)} label="Ask (for the clinician list)" hint={hintEn(`/items/${it.id}/ask`)} />
            )}
            {(getAt(r, P(`/items/${it.id}/help`)) !== undefined || getAt(r, `/locales/en/items/${it.id}/help`) !== undefined) && (
              <Field path={P(`/items/${it.id}/help`)} label="Help" kind="textarea" hint={hintEn(`/items/${it.id}/help`)} />
            )}
          </div>
        ))}
      </div>
      <div className="re-card" data-section="patient">
        <h3>Red flags</h3>
        {arr(r.redFlags).map((f) => (
          <div className="re-item" key={f.id} data-patient-flag={f.id}>
            <div className="re-item-head"><span className="re-tag re-mono">{f.id}</span></div>
            <Field path={P(`/redFlags/${f.id}/q`)} label="Question" kind="textarea" hint={hintEn(`/redFlags/${f.id}/q`)} />
            <Field path={P(`/redFlags/${f.id}/say`)} label="What we tell the patient" kind="textarea" hint={hintEn(`/redFlags/${f.id}/say`)} />
          </div>
        ))}
      </div>
      {arr(r.contextItems).length > 0 && (
        <div className="re-card" data-section="patient">
          <h3>Context questions</h3>
          {arr(r.contextItems).map((c) => {
            const opts = arr(getAt(r, P(`/contextItems/${c.id}/opts`)) || getAt(r, `/locales/en/contextItems/${c.id}/opts`));
            return (
              <div className="re-item" key={c.id}>
                <div className="re-item-head"><span className="re-tag re-mono">{c.id}</span></div>
                <Field path={P(`/contextItems/${c.id}/q`)} label="Question" hint={hintEn(`/contextItems/${c.id}/q`)} />
                {opts.map((o, k) => <Field key={k} path={P(`/contextItems/${c.id}/opts/${k}/1`)} label={`Answer label (value “${o[0]}”)`} hint={hintEn(`/contextItems/${c.id}/opts/${k}/1`)} />)}
              </div>
            );
          })}
        </div>
      )}
      {stepKeys.length > 0 && (
        <div className="re-card" data-section="patient">
          <h3>Steps</h3>
          {stepKeys.map((k) => (
            <div className="re-item" key={k}>
              <div className="re-item-head"><span className="re-tag re-mono">{k}</span></div>
              <div className="re-row">
                <Field path={P(`/steps/${k}/title`)} label="Title" hint={hintEn(`/steps/${k}/title`)} />
                <Field path={P(`/steps/${k}/heading`)} label="Heading" hint={hintEn(`/steps/${k}/heading`)} />
              </div>
              <Field path={P(`/steps/${k}/lede`)} label="Lede" kind="textarea" hint={hintEn(`/steps/${k}/lede`)} />
              {(getAt(r, P(`/steps/${k}/intro`)) !== undefined || getAt(r, `/locales/en/steps/${k}/intro`) !== undefined) && (
                <Field path={P(`/steps/${k}/intro`)} label="Intro" kind="textarea" hint={hintEn(`/steps/${k}/intro`)} />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="re-card" data-section="patient">
        <h3>Page wording</h3>
        <Field path={P("/ui/sub")} label="Subtitle (ui.sub)" kind="textarea" hint={hintEn("/ui/sub")} />
        {arr(getAt(r, P("/ui/forYouIf")) || getAt(r, "/locales/en/ui/forYouIf")).map((_, k) => (
          <Field key={k} path={P(`/ui/forYouIf/${k}`)} label={`“For you if” ${k + 1}`} hint={hintEn(`/ui/forYouIf/${k}`)} />
        ))}
        <Field path={P("/ui/clinicianLede")} label="Clinician lede (ui.clinicianLede)" kind="textarea" hint={hintEn("/ui/clinicianLede")} />
      </div>
    </>
  );
}

function LexiconSection() {
  const ed = useEd();
  const r = ed.rubric;
  const builtinsWithLex = ed.modules.filter((m) => m.origin === "builtin" && m.lexicon);
  const [from, setFrom] = useState(builtinsWithLex[0] ? builtinsWithLex[0].key : "");
  if (!r.lexicon) {
    const src = builtinsWithLex.find((m) => m.key === from);
    return (
      <div className="re-card" data-section="lexicon">
        <h3>{EDITOR_COPY.sections.lexicon}</h3>
        <p className="re-sub">{EDITOR_COPY.noLexicon}</p>
        {builtinsWithLex.length ? (
          <div className="re-chips">
            <label className="re-sub" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>Copy negation, third-party and historical cues from
              <select className="re-in" style={{ width: "auto" }} value={from} onChange={(e) => setFrom(e.target.value)}>
                {builtinsWithLex.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
            <button type="button" className="re-btn" data-create-lexicon onClick={() => ed.replace((x) => createLexicon(x, src.lexicon))}><Plus size={14} aria-hidden="true" />{EDITOR_COPY.createLexicon}</button>
          </div>
        ) : <p className="re-sub">No built-in module with a lexicon is loaded to copy the cue lists from.</p>}
      </div>
    );
  }
  const lx = r.lexicon;
  const nameOf = (id) => { const it = arr(ed.parent.allItems).find((x) => x.id === id); return it ? it.text : id; };
  const changedLex = ed.changes.some((c) => c.path.startsWith("/lexicon"));
  return (
    <>
      <div className="re-card" data-section="lexicon">
        <h3>{EDITOR_COPY.sections.lexicon}</h3>
        <div className="re-sub">
          language {lx.lang || "en-US"} (locked) · {lx.goldSet ? `gold set ${lx.goldSet.version} (benchmarked on lexicon ${lx.goldSet.lexiconVersion}${changedLex ? "; not re-run for this edit" : ""})` : EDITOR_COPY.goldNone}
        </div>
        {changedLex && lx.goldSet && <div className="re-warn">The lexicon changed, so Apply gives it a “-local” version and the gold set footer reads “not re-run”.</div>}
        <h4>Negation</h4>
        <Field path="/lexicon/negation/window" label="negation.window" kind="number" hint={`Warning: ${EDITOR_COPY.negationWarn}.`} />
        <PhraseList path="/lexicon/negation/cues" label="Negation cues" />
        <PhraseList path="/lexicon/thirdParty/cues" label="Third-party cues" />
        <PhraseList path="/lexicon/historical/cues" label="Historical cues" />
      </div>
      <div className="re-card" data-section="lexicon">
        <h3>Red-flag cues</h3>
        {arr(r.redFlags).map((f) => (
          <PhraseList key={f.id} path={`/lexicon/redFlags/${f.id}`} label={`${f.id} — ${f.text}`} minOne={getAt(r, `/lexicon/redFlags/${f.id}`) !== undefined} />
        ))}
      </div>
      <div className="re-card" data-section="lexicon">
        <h3>Yes / no items</h3>
        {arr(lx.bool).map((e, i) => <PhraseList key={i} path={`/lexicon/bool/${i}/ph`} label={`${e.id} — ${nameOf(e.id)}`} />)}
      </div>
      {arr(lx.scale).length > 0 && (
        <div className="re-card" data-section="lexicon">
          <h3>Scale items</h3>
          {arr(lx.scale).map((e, i) => (
            <div className="re-item" key={i}>
              <PhraseList path={`/lexicon/scale/${i}/cue`} label={`${e.id} cue — ${nameOf(e.id)}`} />
              {arr(e.bands).map((b, j) => <PhraseList key={j} path={`/lexicon/scale/${i}/bands/${j}/ph`} label={`${e.id} → option ${b.v}`} />)}
            </div>
          ))}
        </div>
      )}
      {arr(lx.ctx).length > 0 && (
        <div className="re-card" data-section="lexicon">
          <h3>Context answers</h3>
          {arr(lx.ctx).map((e, i) => <PhraseList key={i} path={`/lexicon/ctx/${i}/ph`} label={`${e.id} = ${e.val}`} />)}
        </div>
      )}
      {arr(lx.multi).length > 0 && (
        <div className="re-card" data-section="lexicon">
          <h3>Multi-answer phrases</h3>
          {arr(lx.multi).map((e, i) => <PhraseList key={i} path={`/lexicon/multi/${i}/ph`} label={arr(e.ids).map((x) => `${x.id}=${x.value}`).join(", ")} />)}
        </div>
      )}
    </>
  );
}

function slotPath(slot) {
  return "/copy/" + slot.split(".").join("/");
}

function CopySection() {
  const ed = useEd();
  const slots = Object.keys(COPY_SLOTS).filter((s) => !s.startsWith("locales.") && s !== "indexName");
  return (
    <div className="re-card" data-section="copy">
      <h3>{EDITOR_COPY.sections.copy}</h3>
      <div className="re-sub" style={{ marginBottom: 8 }}>An empty slot uses what is shown greyed in it: the module's CDS preview wording, or the engine's neutral default. Placeholders allowed everywhere: {"{name} {id} {instrument} {scaleMax} {indexName}"}.</div>
      {slots.map((slot) => {
        const p = slotPath(slot);
        const v = getAt(ed.rubric, p);
        // What applies when the slot is empty: the rubric's cds.preview wording for the preview
        // slots (the binder folds it into copy), else the engine's neutral default.
        const fromCds = slot.startsWith("cds.preview.") ? getAt(ed.rubric, "/cds/preview/" + slot.slice("cds.preview.".length)) : undefined;
        const def = fromCds !== undefined ? fromCds : slot.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), ENGINE_COPY_DEFAULTS);
        const extra = COPY_SLOTS[slot];
        const hint = extra.length ? `Also allowed here: ${extra.map((x) => `{${x}}`).join(" ")}` : null;
        if (Array.isArray(v) || Array.isArray(def)) {
          const list = Array.isArray(v) ? v : arr(def);
          return (
            <div className="re-field" key={slot}>
              <div className="re-flabel"><span className="re-mono">{slot}</span></div>
              {list.map((_, k) => (Array.isArray(v)
                ? <Field key={k} path={`${p}/${k}`} label={`${slot} [${k + 1}]`} kind="textarea" />
                : <div key={k} className="re-hint">{String(list[k])}</div>))}
              {!Array.isArray(v) && <button type="button" className="re-btn re-small" onClick={() => ed.update(p, clone(list))}>Override the default</button>}
            </div>
          );
        }
        return <Field key={slot} path={p} label={slot} kind="textarea" hint={hint} placeholder={typeof def === "string" ? def : ""} />;
      })}
    </div>
  );
}

function LogicSection() {
  const ed = useEd();
  const m = ed.parent;
  const logic = m.logic;
  if (!logic || logic.moduleId === "*generic") {
    return <div className="re-card re-ro" data-section="logic"><h3>{EDITOR_COPY.sections.logic}</h3><p className="re-sub">{EDITOR_COPY.genericLogic}</p><p className="re-sub">{EDITOR_COPY.logicNote}</p></div>;
  }
  const routing = arr(logic.routing).map((rule) => `${rule.id}${rule.fallback ? " (fallback)" : ""} — ${Object.keys(rule.copy || {}).join(", ") || "no surface"}`);
  const ps = logic.patientSummary || {};
  const probes = arr(logic.probes && logic.probes.list);
  const kinds = {};
  for (const p of probes) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
  return (
    <div className="re-card re-ro" data-section="logic">
      <h3>{EDITOR_COPY.sections.logic}</h3>
      <p className="re-sub">{EDITOR_COPY.logicNote}</p>
      <div className="re-field"><div className="re-flabel">Logic SHA-256</div><div className="re-mono" data-testid="logic-sha">{m.hashes.logicSha256}</div></div>
      <h4>Routing rules ({routing.length})</h4>
      <ul className="re-list">{routing.map((x, i) => <li key={i} className="re-mono">{x}</li>)}</ul>
      <h4>Patient summary rules</h4>
      <div className="re-sub">said: {arr(ps.said).map((x) => x.id).join(", ") || "—"}</div>
      <div className="re-sub">ask: {arr(ps.ask).map((x) => x.id).join(", ") || "—"}</div>
      <h4>Probes</h4>
      <div className="re-sub">{probes.length} probes{probes.length ? ` (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(", ")})` : ""}{logic.probes && logic.probes.version ? ` · probe set ${logic.probes.version}` : ""}</div>
      <h4>Reads</h4>
      <pre tabIndex={0} role="region" aria-label="Logic reads (read-only)">{JSON.stringify(logic.reads, null, 2)}</pre>
    </div>
  );
}

function DownloadsSection() {
  const ed = useEd();
  const m = ed.parent;
  const generic = !m.hashes.logicSha256;
  return (
    <div className="re-card" data-section="downloads">
      <h3>{EDITOR_COPY.sections.downloads}</h3>
      {ed.changes.length > 0 && <div className="re-warn">{EDITOR_COPY.downloadsNote}</div>}
      <div className="re-dl">
        <button type="button" className="re-btn" data-download="all" onClick={ed.downloadAll}><Archive size={14} aria-hidden="true" />{EDITOR_COPY.downloadAll}</button>
        <button type="button" className="re-btn" data-download="module" onClick={ed.downloadModule}><Download size={14} aria-hidden="true" />{EDITOR_COPY.downloadModule}</button>
        <button type="button" className="re-btn" data-download="rubric" onClick={ed.downloadRubric}><FileJson size={14} aria-hidden="true" />{EDITOR_COPY.downloadRubric}</button>
        <button type="button" className="re-btn" data-download="logic" disabled={generic} title={generic ? EDITOR_COPY.genericLogic : undefined} onClick={ed.downloadLogic}>
          <FileCode size={14} aria-hidden="true" />{EDITOR_COPY.downloadLogic}
        </button>
      </div>
      {ed.downloadError && <div className="re-msg" role="alert">{ed.downloadError}</div>}
      <p className="re-hint">The .zip holds the rubric, the logic exactly as loaded, documentation or a change log, generated FHIR/CDS files and, for a built-in module, its population estimates. It re-uploads through Upload.</p>
    </div>
  );
}

// ---------------------------------------------------------------------- side panes

function ValidationPane() {
  const ed = useEd();
  const v = ed.validation;
  const errs = [...ed.locks, ...(v ? v.errors : [])];
  const warns = v ? v.warnings : [];
  return (
    <div className="re-card" data-testid="editor-validation">
      <h3><ListChecks size={15} aria-hidden="true" />{EDITOR_COPY.validation}{ed.busy ? <span className="re-sub">checking…</span> : null}</h3>
      {ed.previewError && <div className="re-msg" role="alert">{ed.previewError}</div>}
      {!errs.length && !ed.previewError ? <div className="re-sub" data-testid="validation-ok">{EDITOR_COPY.validationOk}</div> : null}
      <ul className="re-list" data-testid="validation-errors">
        {errs.map((e, i) => (
          <li key={"e" + i} data-code={e.code}><span className="re-e">{e.code}</span>
            <button type="button" className="re-link" onClick={() => ed.focusPath(e.path)}>{e.path || "/"}</button><span>{e.msg}</span></li>
        ))}
      </ul>
      {warns.length > 0 && (
        <details className="re-warns">
          <summary>{warns.length} warning{warns.length === 1 ? "" : "s"} (shown, not blocking)</summary>
          <ul className="re-list" data-testid="validation-warnings">
            {warns.map((e, i) => (
              <li key={"w" + i} data-code={e.code} data-warning="true"><span className="re-w">{e.code}</span>
                <button type="button" className="re-link" onClick={() => ed.focusPath(e.path)}>{e.path || "/"}</button><span>{e.msg}</span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** A list cell of the impact table: changes as − / + lines, everything else collapsed. */
function DeltaList({ before, after, what }) {
  const removed = before.filter((x) => !after.includes(x));
  const added = after.filter((x) => !before.includes(x));
  return (
    <>
      {(removed.length > 0 || added.length > 0) && (
        <ul className="re-delta">
          {removed.map((t, i) => <li key={"r" + i} className="re-del">− {t}</li>)}
          {added.map((t, i) => <li key={"a" + i} className="re-add">+ {t}</li>)}
        </ul>
      )}
      <details>
        <summary>{after.length} {what}{removed.length || added.length ? "" : ", unchanged"}</summary>
        <ul>{after.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </details>
    </>
  );
}

function recsText(recs) {
  return recs.length ? recs.map((r) => `${r.id}: ${r.h}`) : ["—"];
}

function ImpactPane() {
  const ed = useEd();
  const rows = ed.impact;
  return (
    <div className="re-card" data-testid="editor-impact">
      <h3>{EDITOR_COPY.impact}</h3>
      <div className="re-sub" style={{ marginBottom: 6 }}>{EDITOR_COPY.impactNote}</div>
      {!rows ? <div className="re-sub">{EDITOR_COPY.impactEmpty}</div> : (
        <div className="re-scroll" tabIndex={0} role="region" aria-label="Impact preview table">
          <table className="re-table">
            <thead><tr><th>Case</th><th>Total · range · band</th><th>Routing (Screener / Scribe)</th><th>Gap</th><th>Patient summary</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const a = row.parent, b = row.draft;
                const sc = (x) => `${x.total ?? "—"} · ${x.floor ?? "—"}–${x.ceiling ?? "—"} · ${x.band ?? "—"}`;
                const rt = (x) => [...recsText(x.recs.screener).map((t) => `S ${t}`), ...recsText(x.recs.scribe).map((t) => `B ${t}`)];
                const pt = (x) => Object.entries(x.patient).flatMap(([loc, p]) => [...arr(p.said), ...arr(p.ask)].map((t) => `${loc}: ${t}`));
                const d1 = sc(a) !== sc(b), d2 = JSON.stringify(rt(a)) !== JSON.stringify(rt(b)), d3 = a.gap !== b.gap, d4 = JSON.stringify(pt(a)) !== JSON.stringify(pt(b));
                return (
                  <tr key={row.id} className={row.current ? "re-cur" : undefined} data-impact-case={row.id}>
                    <td>{row.label}</td>
                    <td className={d1 ? "re-diff" : undefined}>{d1 ? <>{sc(a)} → <b>{sc(b)}</b></> : sc(b)}</td>
                    <td className={d2 ? "re-diff" : undefined}><DeltaList before={rt(a)} after={rt(b)} what="recommendations" /></td>
                    <td className={d3 ? "re-diff" : undefined}>{d3 ? `${a.gap ? "alert" : "—"} → ${b.gap ? "alert" : "—"}` : (b.gap ? "alert" : "—")}</td>
                    <td className={d4 ? "re-diff" : undefined} data-impact-patient={row.id}><DeltaList before={pt(a)} after={pt(b)} what="sentences" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChangesPane() {
  const ed = useEd();
  return (
    <div className="re-card" data-testid="editor-changes">
      <h3>{EDITOR_COPY.changes} ({ed.changes.length})
        <span className="re-grow" />
        <button type="button" className="re-btn re-small" data-revert-all disabled={!ed.changes.length} onClick={ed.revertAll}><RotateCcw size={12} aria-hidden="true" />{EDITOR_COPY.revertAll}</button>
      </h3>
      {!ed.changes.length ? <div className="re-sub">{EDITOR_COPY.changesEmpty}</div> : (
        <ul className="re-list">
          {ed.changes.map((c, i) => (
            <li key={i} data-change={c.path}>
              <button type="button" className="re-link re-mono" onClick={() => ed.focusPath(c.path)}>{c.path}{c.op ? ` (${c.op})` : ""}</button>
              <span className="re-sub">{short(c.from)} → {short(c.to)}</span>
              <button type="button" className="re-btn re-small" onClick={() => ed.revertChange(c)}><Undo2 size={12} aria-hidden="true" />{EDITOR_COPY.revert}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------ the editor

/**
 * The Rubric Editor tab (design §5.7).
 * @param {{entries: Object[], activeKey: string, env: {loader:Object, appBase:string},
 *          onApply?: function({rubric, remember, switchTo, entry, module, validation, classification}): (Promise<*>|*),
 *          onDownloadAll?: function(): *, onDownloaded?: function(string[]): void,
 *          now?: (string|function(): string), appVersion?: string}} props
 */
export default function RubricEditor({ entries, activeKey, env, onApply, onDownloadAll, onDownloaded, now = null, appVersion = APP_VERSION }) {
  let session = null;
  try { session = useSession(); } catch (_) { session = null; }   // outside the shell (dev page): no current screens
  const valid = useMemo(() => arr(entries).filter((e) => e && e.module && e.validation && e.validation.ok), [entries]);
  const modules = useMemo(() => valid.map((e) => e.module), [valid]);
  const [pick, setPick] = useState(activeKey);
  const editKey = valid.some((e) => e.key === pick) ? pick : (valid.some((e) => e.key === activeKey) ? activeKey : (valid[0] && valid[0].key));
  const entry = valid.find((e) => e.key === editKey) || null;
  const parent = entry ? entry.module : null;

  const [drafts, setDrafts] = useState({});
  const [acks, setAcks] = useState({});
  const [section, setSection] = useState("identity");
  const [patientLoc, setPatientLoc] = useState("en");
  const [confirmState, setConfirmState] = useState(null);
  const [resume, setResume] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [check, setCheck] = useState({ busy: false, validation: null, preview: null, error: null, forRubric: null });
  const rootRef = useRef(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const dirtyKeys = useRef(new Set());
  const pendingFocus = useRef(null);

  const draft = editKey ? (drafts[editKey] || null) : null;
  const rubric = draft || (parent ? parent.rubric : null);
  const readsObserved = entry && entry.validation && entry.validation.info ? entry.validation.info.readsObserved : null;

  // Saved draft on opening a module (never auto-applied).
  useEffect(() => {
    if (!editKey || drafts[editKey]) { setResume(null); return; }
    const saved = lsGet(LS_PREFIX + editKey);
    setResume(saved && saved.rubric ? saved : null);
  }, [editKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave (debounced 1 s); a null draft removes the saved copy.
  const flush = useCallback(() => {
    for (const key of dirtyKeys.current) {
      const d = draftsRef.current[key];
      const m = valid.find((e) => e.key === key);
      lsSet(LS_PREFIX + key, d ? { savedAt: new Date().toISOString(), parentSha: m ? m.module.hashes.rubricSha256 : null, rubric: d } : null);
    }
    dirtyKeys.current.clear();
  }, [valid]);
  useEffect(() => {
    if (!dirtyKeys.current.size) return undefined;
    const t = setTimeout(flush, 1000);
    return () => clearTimeout(t);
  }, [drafts, flush]);
  useEffect(() => () => flush(), [flush]);

  const setDraft = useCallback((next) => {
    if (!editKey) return;
    dirtyKeys.current.add(editKey);
    setDrafts((prev) => ({ ...prev, [editKey]: next }));
    setResult(null);
  }, [editKey]);

  const update = useCallback((path, value) => {
    const base = structuredClone(draftsRef.current[editKey] || parent.rubric);
    setAt(base, path, value);
    setDraft(base);
  }, [editKey, parent, setDraft]);

  const replace = useCallback((fn) => {
    const base = structuredClone(draftsRef.current[editKey] || parent.rubric);
    setDraft(fn(base));
  }, [editKey, parent, setDraft]);

  // Diff, locks, acknowledgements.
  const changes = useMemo(() => (draft && parent ? diffRubrics(parent.rubric, draft) : []), [draft, parent]);
  const changedSet = useMemo(() => new Set(changes.map((c) => c.path)), [changes]);
  const locks = useMemo(() => (draft && parent ? lockViolations(parent, draft) : []), [draft, parent]);
  const ackList = useMemo(() => (parent ? acknowledgePaths(parent, readsObserved) : []), [parent, readsObserved]);
  const ackByPath = useMemo(() => new Map(ackList.map((a) => [a.path, a])), [ackList]);
  const editedAck = useMemo(() => (draft ? ackList.filter((a) => changes.some((c) => ptrOverlaps(c.path, a.path))
    && JSON.stringify(getAt(parent.rubric, a.path)) !== JSON.stringify(getAt(draft, a.path))).map((a) => a.path) : []), [ackList, changes, draft, parent]);
  const acked = (editKey && acks[editKey]) || {};
  const unacked = editedAck.filter((p) => !acked[p]);

  // Live validation (250 ms): derive as Apply would, bind, validate against the root.
  useEffect(() => {
    if (!parent) return undefined;
    if (!draft) { setCheck({ busy: false, validation: null, preview: null, error: null, forRubric: null }); return undefined; }
    let live = true;
    setCheck((c) => ({ ...c, busy: true }));
    const t = setTimeout(async () => {
      try {
        const res = await deriveAndBind(parent, draft, { loaded: modules, readsObserved, now: nowIso(now), note: "(preview)" });
        if (live) setCheck({ busy: false, validation: res.validation, preview: res, error: null, forRubric: draft });
      } catch (err) {
        if (live) setCheck({ busy: false, validation: null, preview: null, error: `The draft cannot be checked: ${err && err.message ? err.message : err}`, forRubric: draft });
      }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [draft, parent, modules, readsObserved]); // eslint-disable-line react-hooks/exhaustive-deps

  const validation = draft ? check.validation : null;
  const busy = !!draft && (check.busy || check.forRubric !== draft);
  const errorsByPath = useMemo(() => {
    const m = new Map();
    for (const e of [...locks, ...(validation ? validation.errors : [])]) {
      if (!m.has(e.path)) m.set(e.path, []);
      m.get(e.path).push(e);
    }
    return m;
  }, [locks, validation]);

  // Impact preview rows.
  const impact = useMemo(() => {
    if (!draft || !check.preview || check.forRubric !== draft || !parent) return null;
    const dm = check.preview.module;
    const cases = [];
    if (session && activeKey === editKey) {
      if (session.screens.screener) cases.push(caseFromSnapshot(parent, session.screens.screener, "Current Screener screen"));
      if (session.screens.scribe) cases.push(caseFromSnapshot(parent, session.screens.scribe, "Current Scribe screen"));
    }
    cases.push(...impactCases(parent));
    return cases.map((k) => ({ id: k.id, label: k.label, current: !!k.current, parent: impactRow(parent, k), draft: impactRow(dm, k) }));
  }, [draft, check, parent, session, activeKey, editKey]);

  const outputsFor = useCallback((dependents) => {
    if (!parent) return [];
    const dm = check.preview ? check.preview.module : null;
    const out = [];
    const cases = impactCases(parent);
    for (const cid of dependents) {
      for (const k of cases) {
        const after = dm ? closureOutput(dm, cid, k) : null;
        const before = closureOutput(parent, cid, k);
        const o = after || before;
        if (!o) continue;
        const text = o.kind === "routing"
          ? Object.entries(o.headings).map(([s, h]) => `${s}: ${h}`).join(" · ")
          : Object.entries(o.sentences).map(([l, s]) => `${l}: ${s}`).join(" · ");
        out.push(`${closureLabel(cid)} (${k.label}) — ${text}`);
        break;
      }
    }
    return out;
  }, [parent, check]);

  const staleAt = useCallback((path) => {
    const m = /^\/locales\/([^/]+)(\/.+)$/.exec(path);
    if (!m || m[1] === "en" || !rubric) return false;
    const L = rubric.locales && rubric.locales[m[1]];
    if (L && arr(L.stale).includes(path)) return true;
    const enPath = `/locales/en${m[2]}`;
    return changedSet.has(enPath) && getAt(rubric, path) !== undefined && !changedSet.has(path);
  }, [rubric, changedSet]);

  const focusPath = useCallback((path) => {
    const sec = sectionOf(path || "");
    const m = /^\/locales\/([^/]+)/.exec(path || "");
    if (m) setPatientLoc(m[1]);
    setSection(sec);
    pendingFocus.current = path;
  }, []);
  useEffect(() => {
    const p = pendingFocus.current;
    if (!p || !rootRef.current) return;
    pendingFocus.current = null;
    let probe = p;
    for (;;) {
      const el = rootRef.current.querySelector(`[data-path="${probe.replace(/["\\]/g, "\\$&")}"]`);
      if (el) {
        if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
        if (typeof el.focus === "function") el.focus();
        break;
      }
      const i = probe.lastIndexOf("/");
      if (i <= 0) break;
      probe = probe.slice(0, i);
    }
  });

  const revertPath = useCallback((path) => {
    if (!draft) return;
    const ch = changes.find((c) => c.path === path);
    if (ch) setDraft(revertChange(draft, parent.rubric, ch));
    else { const d = structuredClone(draft); setAt(d, path, clone(getAt(parent.rubric, path))); setDraft(d); }
  }, [draft, changes, parent, setDraft]);
  const doRevertChange = useCallback((ch) => { if (draft) setDraft(revertChange(draft, parent.rubric, ch)); }, [draft, parent, setDraft]);
  const revertAll = useCallback(() => {
    if (!editKey) return;
    dirtyKeys.current.add(editKey);
    setDrafts((prev) => ({ ...prev, [editKey]: null }));
    setAcks((prev) => ({ ...prev, [editKey]: {} }));
  }, [editKey]);

  const setAck = useCallback((path, on) => setAcks((prev) => ({ ...prev, [editKey]: { ...(prev[editKey] || {}), [path]: on } })), [editKey]);

  // Downloads.
  const fetchBytes = useMemo(() => fetchBytesFor(env && env.appBase ? env.appBase : (typeof location !== "undefined" ? location.href : "")), [env]);
  const guard = async (fn) => {
    setDownloadError(null);
    try { await fn(); } catch (err) { setDownloadError(String(err && err.message ? err.message : err)); }
  };
  const downloadAll = () => guard(async () => {
    if (typeof onDownloadAll === "function") { await onDownloadAll(); return; }
    const z = await buildExportZip(arr(entries), { appVersion, now: nowIso(now), fetchBytes });
    downloadBytes(z.name, z.bytes, "application/zip");
    if (onDownloaded) onDownloaded(arr(entries).filter((e) => e && e.module && e.validation && e.validation.ok).map((e) => e.key));
  });
  const downloadModule = () => guard(async () => {
    const z = await buildExportZip([entry], { appVersion, now: nowIso(now), fetchBytes, single: true });
    downloadBytes(z.name, z.bytes, "application/zip");
    if (onDownloaded) onDownloaded([entry.key]);
  });
  const downloadRubric = () => guard(async () => {
    downloadText(`${parent.id}.rubric.json`, serializeRubric(parent.rubric), "application/json");
    if (onDownloaded) onDownloaded([entry.key]);
  });
  const downloadLogic = () => guard(async () => {
    const text = (entry.files && entry.files.logic && entry.files.logic.text) || (parent.sources && parent.sources.logicText);
    if (typeof text !== "string") throw new Error("The logic source of this module is not available.");
    downloadText(`${parent.id}.logic.js`, text, "text/javascript");
  });

  const parentItemIds = useMemo(() => new Set(parent ? parent.allItems.map((x) => x.id) : []), [parent]);

  const ctx = {
    parent, rubric, modules, update, replace, changes, changedSet,
    changedUnder: (p) => changes.some((c) => c.path === p || c.path.startsWith(p + "/")),
    errorsAt: (p) => errorsByPath.get(p) || [],
    ackFor: (p) => ackByPath.get(p) || null,
    acked, setAck, outputsFor, staleAt, revertPath, revertChange: doRevertChange, revertAll, focusPath,
    confirm: setConfirmState, patientLoc, setPatientLoc, validation, locks, busy, previewError: check.error,
    impact, parentItemIds, downloadAll, downloadModule, downloadRubric, downloadLogic, downloadError,
  };

  if (!parent) {
    return (
      <div className="sa-editor" ref={rootRef}><style>{CSS}</style>
        <div className="re-wrap"><div className="re-card">No module that validated is loaded, so there is nothing to edit. Upload a module or retry loading the built-in one.</div></div>
      </div>
    );
  }

  const errorCount = locks.length + (validation ? validation.errors.length : 0) + (check.error ? 1 : 0);
  let blocked = null;
  if (!draft || !changes.length) blocked = EDITOR_COPY.applyBlocked.none;
  else if (busy) blocked = EDITOR_COPY.applyBlocked.busy;
  else if (locks.length) blocked = EDITOR_COPY.applyBlocked.locks;
  else if (errorCount) blocked = EDITOR_COPY.applyBlocked.errors;
  else if (unacked.length) blocked = EDITOR_COPY.applyBlocked.ack;

  const sectionHasChange = (s) => changes.some((c) => sectionOf(c.path) === s);

  const onCreate = async ({ rubric: derived, module, validation: v, classification, entry: newEntry, remember, switchTo }) => {
    if (typeof onApply !== "function") throw new Error("This page cannot register modules (no onApply).");
    const res = await onApply({ rubric: derived, remember, switchTo, entry: newEntry, module, validation: v, classification });
    if (res && res.ok === false) throw new Error(res.error || "The module was not registered.");
    dirtyKeys.current.add(editKey);
    setDrafts((prev) => ({ ...prev, [editKey]: null }));
    setAcks((prev) => ({ ...prev, [editKey]: {} }));
    lsSet(LS_PREFIX + editKey, null);
    setApplyOpen(false);
    setResult({ label: module.label, switchTo, availability: availabilityText(module) });
  };

  return (
    <div className="sa-editor" ref={rootRef} data-testid="rubric-editor">
      <style>{CSS}</style>
      <Ctx.Provider value={ctx}>
        <div className="re-wrap">
          <div className="re-top">
            <label htmlFor="re-editing">{EDITOR_COPY.editing}</label>
            <select id="re-editing" data-testid="editor-module" value={editKey} onChange={(e) => { setPick(e.target.value); setResult(null); }}>
              {valid.map((e) => (
                <option key={e.key} value={e.key}>{e.module.label} · {originWord(e.module)}{e.key === activeKey ? ` (${EDITOR_COPY.active})` : ""}</option>
              ))}
            </select>
            <span className="re-grow" />
            <span className="re-status" data-testid="editor-status">{changes.length} change{changes.length === 1 ? "" : "s"}{blocked && changes.length ? ` · ${blocked}` : ""}</span>
            <button type="button" className="re-btn re-primary" data-testid="editor-apply" disabled={!!blocked} title={blocked || undefined} onClick={() => setApplyOpen(true)}>
              <Check size={14} aria-hidden="true" />{EDITOR_COPY.apply}
            </button>
          </div>
          {resume && (
            <div className="re-banner" data-testid="editor-resume">
              <Info size={14} aria-hidden="true" />
              <span>{fill(EDITOR_COPY.savedDraft, { date: localStamp(resume.savedAt) })}{resume.parentSha && resume.parentSha !== parent.hashes.rubricSha256 ? ` ${EDITOR_COPY.savedDraftOther}` : ""}</span>
              <button type="button" className="re-btn re-small" data-resume onClick={() => { setDraft(resume.rubric); setResume(null); }}>{EDITOR_COPY.resume}</button>
              <button type="button" className="re-btn re-small" onClick={() => { lsSet(LS_PREFIX + editKey, null); setResume(null); }}>{EDITOR_COPY.discard}</button>
            </div>
          )}
          {result && (
            <div className="re-result" role="status" data-testid="editor-result">
              {fill(result.switchTo ? EDITOR_COPY.createdSwitch : EDITOR_COPY.created, { label: result.label })}
              <span className="re-av">{result.availability}</span>
            </div>
          )}
          <div className="re-sub" style={{ margin: "0 0 10px" }}>{EDITOR_COPY.draftNote}</div>
          <div className="re-grid">
            <nav className="re-nav" aria-label="Rubric sections">
              {SECTION_ORDER.map((s) => (
                <button key={s} type="button" data-section-nav={s} aria-current={section === s ? "true" : undefined} onClick={() => setSection(s)}>
                  {EDITOR_COPY.sections[s]}{sectionHasChange(s) ? <span className="re-dot" aria-label="edited" /> : null}
                </button>
              ))}
            </nav>
            <div className="re-main" data-testid="editor-main">
              {section === "identity" && <IdentitySection />}
              {section === "domains" && <DomainsSection />}
              {section === "bands" && <BandsSection />}
              {section === "flags" && <FlagsSection />}
              {section === "context" && <ContextSection />}
              {section === "patient" && <PatientSection />}
              {section === "lexicon" && <LexiconSection />}
              {section === "copy" && <CopySection />}
              {section === "logic" && <LogicSection />}
              {section === "downloads" && <DownloadsSection />}
            </div>
            <div className="re-side" tabIndex={0} role="region" aria-label="Validation and changes">
              <ValidationPane />
              <ChangesPane />
            </div>
            <div className="re-wide">
              <ImpactPane />
            </div>
          </div>
        </div>
      </Ctx.Provider>
      <Confirm state={confirmState} onClose={() => setConfirmState(null)} />
      {applyOpen && draft && (
        <ApplyDialog open mode="apply" parent={parent} draft={draft} loaded={modules} readsObserved={readsObserved}
          acknowledged={Object.keys(acked).filter((p) => acked[p] && editedAck.includes(p))} now={now}
          onCancel={() => setApplyOpen(false)} onCreate={onCreate} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------ Apply dialog

/**
 * The Apply dialog (§5.7), also used by the upload dialog for "Load as derived" (§3.11).
 * @param {{open: boolean, mode?: ("apply"|"prepare"), parent: Object, draft: Object, loaded: Object[],
 *          readsObserved?: Object, acknowledged?: string[], source?: {name:string, sha256:string},
 *          reason?: string, now?: (string|function(): string),
 *          onCancel: function(): void,
 *          onCreate: function({rubric, module, validation, classification, entry, remember, switchTo}): (Promise<*>|*)}} props
 *   parent   the module the draft derives from (the root for Load as derived)
 *   loaded   the loaded modules (or registry entries): id and label collisions, the family, V8
 *   onCreate receives the derived rubric already bound and validated with zero errors;
 *            apply mode: Create module (switchTo false) / Create and switch (switchTo true);
 *            prepare mode: Prepare module (remember and switchTo false; the upload dialog's
 *            Load registers it). A rejected promise is shown in the dialog.
 */
export function ApplyDialog({ open, mode = "apply", parent, draft, loaded = [], readsObserved = null, acknowledged = [], source = null, reason = null, now = null, onCancel, onCreate }) {
  const [changes, setChanges] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [form, setForm] = useState({ id: "", label: "", instrumentVersion: "", lexiconVersion: "", note: "", author: "" });
  const [acks, setAcks] = useState(() => Object.fromEntries(arr(acknowledged).map((p) => [p, true])));
  const [remember, setRemember] = useState(true);
  const [check, setCheck] = useState({ busy: true, result: null, error: null });
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const loadedMods = useMemo(() => arr(loaded).map((x) => (x && x.module && x.module.hashes ? x.module : x)).filter((m) => m && m.hashes), [loaded]);
  const at = useMemo(() => nowIso(now), [now]);
  const backdropRef = useRef(null);
  const firstFieldRef = useRef(null);
  // Modal keyboard handling, the shell dialogs' contract (ui/common.jsx): initial focus, Tab
  // trap, Escape = Cancel unless a create is in flight, inert background, focus returned. Nested
  // inside the upload dialog, the shell's trap already confines Tab to this innermost
  // aria-modal and leaves Escape to it while a derivation is open.
  const submittingRef = useRef(false);
  useModal(!!open, { backdropRef, initialFocusRef: firstFieldRef, onClose: () => onCancel && onCancel(), canClose: () => !submittingRef.current, fallbackFocus: "[data-testid=editor-apply]" });
  // The fields appear once the changes are classified: focus moves from the provisional first
  // control (Cancel) to the module id, unless the user has already moved it elsewhere.
  const ready = !!changes;
  useEffect(() => {
    if (!open || !ready || !firstFieldRef.current || !backdropRef.current) return;
    const active = document.activeElement;
    if (!active || active === document.body || (backdropRef.current.contains(active) && active.dataset.applyAction === "cancel")) firstFieldRef.current.focus();
  }, [open, ready]);

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    (async () => {
      try {
        const c = await classifyChanges(parent, draft, { readsObserved });
        const idn = proposeIdentity(parent, draft, c, loadedMods, { now: at });
        if (!live) return;
        setChanges(c);
        setIdentity(idn);
        setForm((f) => ({ ...f, id: idn.id, label: idn.label, instrumentVersion: idn.instrumentVersion || "", lexiconVersion: idn.lexiconVersion || "" }));
      } catch (err) {
        if (live) setCheck({ busy: false, result: null, error: String(err && err.message ? err.message : err) });
      }
    })();
    return () => { live = false; };
  }, [open, parent, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLex = !!draft.lexicon;
  const idProblems = changes && identity ? identityProblems(form, { classification: changes, identity, loaded: loadedMods, hasLexicon: hasLex }) : [];
  const ackItems = changes ? [
    ...changes.needsAcknowledgement.map((p) => ({ path: p, kind: "read", text: `Edited wording the logic reads: ${p}` })),
    ...changes.staleRedFlagPaths.map((p) => {
      const m = /^\/locales\/([^/]+)\/redFlags\/([^/]+)/.exec(p);
      return { path: p, kind: "stale", text: `The ${m ? (LOCALE_NAMES[m[1]] || m[1]) : "translated"} wording for ${m ? m[2] : p} was not updated to match the English edit.` };
    }),
    ...changes.safety.map((s) => ({ path: `safety:${s.kind}:${s.id}`, kind: "safety", text: s.kind === "tier" ? `${EDITOR_COPY.safetyTitle}: red flag ${s.id} moves from ${s.from} to ${s.to}.` : s.kind === "add" ? `${EDITOR_COPY.safetyTitle}: red flag ${s.id} is added.` : `${EDITOR_COPY.safetyTitle}: red flag ${s.id} is deleted.` })),
  ] : [];
  const ackDeps = useMemo(() => new Map(arr(changes && acknowledgePaths(parent, readsObserved)).map((a) => [a.path, a.dependents])), [changes, parent, readsObserved]);
  const allAcked = ackItems.every((a) => acks[a.path]);

  // Derive, bind and validate with the chosen identity (300 ms after the last change).
  useEffect(() => {
    if (!changes || !identity) return undefined;
    let live = true;
    setCheck((c) => ({ ...c, busy: true }));
    const t = setTimeout(async () => {
      try {
        const rubric = await deriveRubric(parent, draft, {
          id: form.id.trim(), label: form.label.trim(),
          instrumentVersion: identity.versionLocked.instrument ? identity.instrumentVersion : form.instrumentVersion.trim(),
          lexiconVersion: hasLex ? (identity.versionLocked.lexicon ? identity.lexiconVersion : form.lexiconVersion.trim()) : null,
          note: form.note.trim() || "(note required)", author: form.author, acknowledged: changes.needsAcknowledgement.filter((p) => acks[p]),
          now: at, source,
        });
        const bound = await bindDerived(rubric, parent, { loaded: loadedMods, now: at });
        if (live) setCheck({ busy: false, result: { rubric, ...bound }, error: null });
      } catch (err) {
        if (live) setCheck({ busy: false, result: null, error: String(err && err.message ? err.message : err) });
      }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [changes, identity, form, acks]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const vErrors = check.result ? check.result.validation.errors : [];
  const canSubmit = !!changes && !check.busy && !!check.result && !vErrors.length && !idProblems.length && allAcked && !!form.note.trim() && !submitting;
  const rootName = changes && changes.rootModule ? `${changes.rootModule.name}` : (changes ? changes.rootRecord.label : "");
  const rootVersion = changes ? changes.rootRecord.instrumentVersion : "";
  const otherLocs = changes ? Object.keys(draft.locales || {}).filter((l) => l !== "en" && arr((check.result && check.result.rubric.locales && check.result.rubric.locales[l] && check.result.rubric.locales[l].stale)).length) : [];
  // The calibration warning concerns the research panel: only a parent with a research
  // configuration has figures to withhold.
  const scoringNotice = !!changes && changes.vsRoot.scoringChanged && !!parent.research;
  const cdsNotice = !!changes && changes.vsRoot.scoringChanged && !!(parent.rubric.cds && parent.rubric.cds.examples && parent.rubric.cds.examples.settled !== undefined);
  const fieldMsg = (f) => idProblems.filter((p) => p.field === f).map((p, i) => <div key={i} className="re-msg">{p.msg}</div>);

  const submit = async (switchTo) => {
    setSubmitError(null);
    setSubmitting(true);
    submittingRef.current = true;
    try {
      const rubric = await deriveRubric(parent, draft, {
        id: form.id.trim(), label: form.label.trim(),
        instrumentVersion: identity.versionLocked.instrument ? identity.instrumentVersion : form.instrumentVersion.trim(),
        lexiconVersion: hasLex ? (identity.versionLocked.lexicon ? identity.lexiconVersion : form.lexiconVersion.trim()) : null,
        note: form.note.trim(), author: form.author, acknowledged: changes.needsAcknowledgement.filter((p) => acks[p]), now: at, source,
      });
      const bound = await bindDerived(rubric, parent, { loaded: loadedMods, now: at });
      if (!bound.validation.ok) throw new Error(`${bound.validation.errors.length} validation errors`);
      await onCreate({ rubric, module: bound.module, validation: bound.validation, classification: bound.classification, entry: bound.entry, remember: mode === "apply" ? remember : false, switchTo: !!switchTo });
    } catch (err) {
      setSubmitError(String(err && err.message ? err.message : err));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const title = mode === "prepare" ? `Load as a module derived from ${parent.label}` : "Apply changes as a new module";
  return (
    <div className="re-apply" ref={backdropRef}>
      <style>{DCSS}</style>
      <div className="re-overlay" role="dialog" aria-modal="true" aria-label={title} data-testid="apply-dialog">
        <div className="re-dialog">
          <h2>{title}</h2>
          {reason && <div className="re-reason">{reason}</div>}
          {!changes ? <p>{check.error || "Preparing…"}</p> : (
            <>
              <div className="re-field">
                <label className="re-l" htmlFor="re-ap-id">Module id</label>
                <input id="re-ap-id" ref={firstFieldRef} className="re-in" data-apply="id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase() })} />
                {fieldMsg("id")}
              </div>
              <div className="re-field">
                <label className="re-l" htmlFor="re-ap-label">Label</label>
                <input id="re-ap-label" className="re-in" data-apply="label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                {fieldMsg("label")}
              </div>
              <div className="re-field">
                <label className="re-l" htmlFor="re-ap-iv">Instrument version</label>
                <input id="re-ap-iv" className="re-in" data-apply="instrumentVersion" readOnly={!!identity.versionLocked.instrument}
                  value={identity.versionLocked.instrument ? identity.instrumentVersion : form.instrumentVersion}
                  onChange={(e) => setForm({ ...form, instrumentVersion: e.target.value })} />
                {identity.versionLocked.instrument
                  ? <div className="re-hint" data-testid="iv-locked">Locked: same instrument as {identity.versionLocked.instrument}.</div>
                  : <div className="re-hint">The instrument differs from {rootName} {rootVersion}: the version must carry “-local” and differ from every version in its family.</div>}
                {fieldMsg("instrumentVersion")}
              </div>
              {hasLex && (
                <div className="re-field">
                  <label className="re-l" htmlFor="re-ap-lv">Lexicon version</label>
                  <input id="re-ap-lv" className="re-in" data-apply="lexiconVersion" readOnly={!!identity.versionLocked.lexicon}
                    value={identity.versionLocked.lexicon ? (identity.lexiconVersion || "") : form.lexiconVersion}
                    onChange={(e) => setForm({ ...form, lexiconVersion: e.target.value })} />
                  {identity.versionLocked.lexicon
                    ? <div className="re-hint">Locked: same lexicon as {identity.versionLocked.lexicon}.</div>
                    : <div className="re-hint">The lexicon changed: the gold set was not re-run for it.</div>}
                  {fieldMsg("lexiconVersion")}
                </div>
              )}
              <div className="re-field">
                <label className="re-l" htmlFor="re-ap-note">Change note (required)</label>
                <textarea id="re-ap-note" className="re-in" data-apply="note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                {!form.note.trim() && <div className="re-hint">Say what changed and why.</div>}
              </div>
              <div className="re-field">
                <label className="re-l" htmlFor="re-ap-author">Author (optional)</label>
                <input id="re-ap-author" className="re-in" data-apply="author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </div>

              {(scoringNotice || cdsNotice || changes.localesEdited.length > 0 || otherLocs.length > 0) && <h3>Notices</h3>}
              {scoringNotice && (
                <div className="re-notice" data-notice="scoring">Scoring differs from {rootName} {rootVersion} — the research panel will withhold every calibration-dependent figure for this module.</div>
              )}
              {cdsNotice && (
                <div className="re-notice" data-notice="cds">The CDS example card written for {rootName} {rootVersion} will be removed.</div>
              )}
              {changes.localesEdited.length > 0 && (
                <div className="re-notice" data-notice="edited-wording">Edited patient wording: {changes.localesEdited.map((l) => LOCALE_NAMES[l] || l).join(", ")} will be marked unreviewed.</div>
              )}
              {otherLocs.length > 0 && (
                <div className="re-notice" data-notice="stale">Translations not updated: {otherLocs.map((l) => LOCALE_NAMES[l] || l).join(", ")} will be marked unreviewed and show a notice.</div>
              )}

              {ackItems.length > 0 && (
                <>
                  <h3>Acknowledgements</h3>
                  <div className="re-checks">
                    {ackItems.map((a) => (
                      <label key={a.path}>
                        <input type="checkbox" data-apply-ack={a.path} checked={!!acks[a.path]} onChange={(e) => setAcks({ ...acks, [a.path]: e.target.checked })} />
                        <span>
                          {a.kind === "read" ? EDITOR_COPY.ackLabel : a.text}
                          {a.kind === "read" && <><br /><span className="re-mono">{a.path} · {EDITOR_COPY.readBy} {arr(ackDeps.get(a.path)).map(closureLabel).join("; ")}</span></>}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {mode === "apply" && (
                <div className="re-checks" style={{ marginTop: 10 }}>
                  <label><input type="checkbox" data-apply="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Remember this module in this browser</span></label>
                </div>
              )}

              {check.result && (
                <div className="re-hint" data-testid="apply-availability">{availabilityText(check.result.module)}</div>
              )}
              {(vErrors.length > 0 || check.error) && (
                <>
                  <h3>Validation</h3>
                  <ul className="re-errs" data-testid="apply-errors">
                    {check.error && <li>{check.error}</li>}
                    {vErrors.map((e, i) => <li key={i}>{e.code} · {e.path || "/"} · {e.msg}</li>)}
                  </ul>
                </>
              )}
              {submitError && <div className="re-msg" role="alert" data-testid="apply-submit-error">{submitError}</div>}
              <div className="re-hint" style={{ marginTop: 8 }}>{CAVEATS.edited.en}</div>
            </>
          )}
          <div className="re-caveat" data-testid="apply-caveat">{CAVEATS.prototype}</div>
          <div className="re-actions">
            <button type="button" className="re-btn" data-apply-action="cancel" onClick={onCancel}>{EDITOR_COPY.cancel}</button>
            {mode === "prepare" ? (
              <button type="button" className="re-btn re-primary" data-apply-action="prepare" disabled={!canSubmit} onClick={() => submit(false)}>Prepare module</button>
            ) : (
              <>
                <button type="button" className="re-btn" data-apply-action="create" disabled={!canSubmit} onClick={() => submit(false)}><Check size={14} aria-hidden="true" />Create module</button>
                <button type="button" className="re-btn re-primary" data-apply-action="create-switch" disabled={!canSubmit} onClick={() => submit(true)}><TriangleAlert size={14} aria-hidden="true" />Create and switch</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
