// tests/harness/shell.js — mount and drive the screenAIr shell, its patient mode and the
// patient page inside the test page (design 03 §5.1, §5.5, §5.11, §8.3 `shape`, `omissions`,
// `static` t-css). Owner: WP13. Nothing happens at import time.
//
//   sandbox(opts, fn)        runs fn({errors}) with the page address, title, sessionStorage and
//                            localStorage restored afterwards, and every console.error, window
//                            error and unhandled rejection recorded in `errors` (and kept off
//                            the test page's console, so the suite that caused it reports it)
//   mountApp(el)             createRoot into a detached container; {container, unmount}
//   waitFor(pred, opts)      polls until pred() is truthy; throws with `what` on timeout
//   click / choose / setFiles  DOM drivers (flushSync around the event)
//   visibleText(el, drop)    textContent without <style>, [hidden] subtrees and `drop` selectors
//   captureDownloads(fn)     the files fn saves through engine/download.js, and its print calls
//   walkPatient(root, …)     answers a mounted PatientCompanion through its own buttons
//   openShell(h, …)          mounts ScreenAIr and waits for the first module
//   selectModule / openTab   the module picker and the tab bar, as a pointer user would
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll `pred` every `every` ms until it returns something truthy (returned). */
export async function waitFor(pred, { timeout = 15000, every = 10, what = "a condition" } = {}) {
  const t0 = performance.now();
  for (;;) {
    let v = null;
    try { v = pred(); } catch (_) { v = null; }
    if (v) return v;
    if (performance.now() - t0 > timeout) throw new Error(`timed out after ${timeout} ms waiting for ${what}`);
    await sleep(every);
  }
}

export function click(el) {
  if (!el) throw new Error("click: no element");
  flushSync(() => { el.click(); });
}

/** Commit a <select> choice as a pointer user would (one change event). */
export function choose(select, value) {
  if (!select) throw new Error("choose: no select");
  flushSync(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Put File objects into a file input and fire its change event. */
export function setFiles(input, files) {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  input.files = dt.files;
  flushSync(() => { input.dispatchEvent(new Event("change", { bubbles: true })); });
}

export const qa = (root, sel) => (root ? [...root.querySelectorAll(sel)] : []);
export const byTestId = (root, id) => (root ? root.querySelector(`[data-testid="${id}"]`) : null);

/** textContent with <style>/<script>, every [hidden] subtree and the `drop` selectors removed. */
export function visibleText(el, drop = []) {
  if (!el) return "";
  const c = el.cloneNode(true);
  for (const x of c.querySelectorAll(["style", "script", "[hidden]", ...drop].join(","))) x.remove();
  return c.textContent;
}

function fmt(x) {
  if (x instanceof Error) return x.stack || x.message;
  if (typeof x === "string") return x;
  try { return JSON.stringify(x); } catch (_) { return String(x); }
}

function snapshotStorage(store) {
  try {
    const out = new Map();
    for (let i = 0; i < store.length; i++) { const k = store.key(i); out.set(k, store.getItem(k)); }
    return out;
  } catch (_) { return null; }
}

function restoreStorage(store, snap) {
  if (!snap) return;
  try {
    for (const k of Array.from({ length: store.length }, (_, i) => store.key(i))) if (!snap.has(k)) store.removeItem(k);
    for (const [k, v] of snap) if (store.getItem(k) !== v) store.setItem(k, v);
  } catch (_) { /* storage blocked */ }
}

/**
 * Run `fn` with the page state the shell and the patient page touch restored afterwards: the
 * address (the shell writes #tab=…, the patient page reads ?module=), document.title, both
 * storages. `search`/`hash` set the address for the run (null keeps the current one).
 * Console errors, window errors and unhandled rejections are recorded, not printed.
 */
export async function sandbox({ search = null, hash = "" } = {}, fn) {
  const saved = { href: location.href, title: document.title, session: snapshotStorage(sessionStorage), local: snapshotStorage(localStorage) };
  const errors = [];
  const realError = console.error;
  console.error = (...args) => { errors.push(args.map(fmt).join(" ").split("\n").slice(0, 4).join(" | ")); };
  const onError = (e) => { errors.push(`window error: ${e.message || fmt(e.error)}`); };
  const onRejection = (e) => { errors.push(`unhandled rejection: ${fmt(e.reason)}`.split("\n")[0]); };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  try {
    const url = new URL(location.href);
    if (search !== null) url.search = search;
    if (hash !== null) url.hash = hash;
    history.replaceState(history.state, "", url.href);
    return await fn({ errors });
  } finally {
    await sleep(0);
    console.error = realError;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    history.replaceState(history.state, "", saved.href);
    document.title = saved.title;
    restoreStorage(sessionStorage, saved.session);
    restoreStorage(localStorage, saved.local);
  }
}

/** Render `element` into a detached container (no StrictMode). */
export function mountApp(element) {
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => { root.render(element); });
  let live = true;
  return { container, unmount() { if (live) { live = false; root.unmount(); } } };
}

/**
 * Run `fn` with every download that engine/download.js starts, and window.print, captured.
 * Returns {files: [{name, type, blob}], prints, value}.
 */
export function captureDownloads(fn) {
  const files = [];
  let prints = 0;
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
  const realClick = HTMLAnchorElement.prototype.click;
  const realPrint = window.print;
  let pending = null;
  URL.createObjectURL = (blob) => { pending = blob; return "blob:screenair-harness"; };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function captured() { files.push({ name: this.download, type: pending ? pending.type : null, blob: pending }); pending = null; };
  window.print = () => { prints += 1; };
  let value;
  try {
    value = fn();
  } finally {
    URL.createObjectURL = realCreate;
    HTMLAnchorElement.prototype.click = realClick;
    window.print = realPrint;
    // download.js revokes after 500 ms; the fake URL must never reach the real revoke.
    setTimeout(() => { URL.revokeObjectURL = realRevoke; }, 600);
  }
  return { files, prints, value };
}

// ----------------------------------------------------------------------------- patient

/**
 * Answers for "every item answered" on a module (§8.3 omissions): a scale item at its last
 * option, a yes/no item "yes", each context item at its signal value (else its first option).
 */
export function fullAnswers(module) {
  const a = {};
  for (const d of module.domains || []) for (const it of d.items || []) a[it.id] = Array.isArray(it.scale) ? it.scale.length - 1 : "yes";
  const ctx = {};
  for (const ci of module.contextItems || []) if (ci.signal) ctx[ci.id] = ci.signal.value;
  return { a, ctx };
}

function contextWording(view, loc, id) {
  const pick = (l) => view.locales && view.locales[l] && view.locales[l].data && view.locales[l].data.contextItems && view.locales[l].data.contextItems[id];
  return pick(loc) || pick("en") || null;
}

/**
 * Walk a mounted PatientCompanion (inside `root`) from wherever it is to the Summary, with every
 * flag on (`flags: "all"`) or none ("None of these apply"), answering through its buttons.
 * `snap(at)` is called at each section (intro, safety, every step, summary) and its results are
 * returned in order. Problems (a missing button) are returned, never thrown.
 */
export function walkPatient(root, view, { loc = "en", a = {}, ctx = {}, flags = "all", snap = () => null } = {}) {
  const app = byTestId(root, "patient-app");
  const out = [];
  const problems = [];
  if (!app) return { out, problems: ["no patient-app"] };
  const startOver = byTestId(app, "patient-start-over");
  if (startOver) click(startOver);
  for (let i = 0; i < 40 && byTestId(app, "patient-back"); i++) click(byTestId(app, "patient-back"));
  const lb = byTestId(app, `patient-locale-${loc}`);
  if (lb) click(lb); else if (loc !== "en" || Object.keys(view.locales || {}).length > 1) problems.push(`no locale button ${loc}`);
  const section = () => app.querySelector('[data-testid="patient-section"]');
  const next = () => byTestId(app, "patient-next");
  const ctxIds = new Set((view.contextItems || []).map((c) => c.id));
  for (let guard = 0; guard < 40; guard++) {
    const sec = section();
    const key = sec ? sec.getAttribute("data-section") : null;
    if (!sec) { problems.push("no section rendered"); break; }
    if (key === "safety") {
      if (flags === "all") { for (const f of qa(sec, ".flag")) if (f.getAttribute("aria-checked") !== "true") click(f); }
      else { const none = byTestId(sec, "patient-none-apply"); if (none) click(none); else problems.push("safety: no 'none apply' button"); }
    } else if (key !== "intro" && key !== "summary") {
      for (const q of qa(sec, ".q[data-item]")) {
        const id = q.getAttribute("data-item");
        const buttons = qa(q, ".opts button");
        let btn = null;
        if (ctxIds.has(id)) {
          if (ctx[id] === undefined) continue;
          const w = contextWording(view, loc, id);
          const idx = w && Array.isArray(w.opts) ? w.opts.findIndex(([v]) => v === ctx[id]) : -1;
          btn = buttons[idx >= 0 ? idx : 0];
        } else {
          const v = a[id];
          if (v === undefined) continue;
          btn = buttons.find((b) => b.getAttribute("data-value") === String(v)) || null;
        }
        if (!btn) { problems.push(`${key}/${id}: no button for ${JSON.stringify(ctxIds.has(id) ? ctx[id] : a[id])}`); continue; }
        if (!btn.classList.contains("sel")) click(btn);
      }
    }
    out.push({ at: key, value: snap(key, sec) });
    if (key === "summary") break;
    const n = next();
    if (!n) { problems.push(`${key}: no next button`); break; }
    if (n.disabled) { problems.push(`${key}: next is disabled`); break; }
    click(n);
  }
  return { out, problems };
}

// ----------------------------------------------------------------------------- shell

/** Compile a page component through the page's loader (shared module cache). */
export async function importApp(h, path) {
  return h.env.loader.importModule(h.appUrl(path));
}

/**
 * Mount the screenAIr shell (inside a sandbox the caller opened) and wait until a module
 * workspace (or a terminal message) is shown. Returns {container, unmount, shell}.
 */
export async function openShell(h, ScreenAIr, { ready = (c) => c.querySelector("main.sa-main") || byTestId(c, "patient-missing") } = {}) {
  const m = mountApp(React.createElement(ScreenAIr, { env: h.env }));
  try {
    await waitFor(() => ready(m.container) || byTestId(m.container, "registry-error"), { what: "the shell to load its first module" });
  } catch (err) {
    m.unmount();
    throw err;
  }
  const regErr = byTestId(m.container, "registry-error");
  if (regErr) { m.unmount(); throw new Error(`the shell could not load the module list: ${regErr.textContent}`); }
  return m;
}

/** Choose `key` in the module picker (pointer semantics) and wait for its workspace. */
export async function selectModule(container, key, moduleId) {
  const select = container.querySelector("select#sa-module");
  if (!select) throw new Error("no module picker (select#sa-module)");
  if (![...select.options].some((o) => o.value === key)) throw new Error(`the module picker has no option ${key}`);
  choose(select, key);
  await waitFor(() => container.querySelector(`main.sa-main[data-module="${CSS.escape(moduleId)}"]`), { what: `the workspace of ${moduleId}` });
}

/** Click a tab of the tab bar and wait for its panel to be shown with content. */
export async function openTab(container, key) {
  const btn = container.querySelector(`nav.sa-tabs button[data-tab="${key}"]`);
  if (!btn) throw new Error(`no tab button ${key}`);
  click(btn);
  return waitFor(() => {
    const p = container.querySelector(`#sa-panel-${key}`);
    return p && !p.hidden && p.children.length ? p : null;
  }, { what: `the ${key} panel` });
}
