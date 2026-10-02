// tests/harness/tcss.js — the static suite's t-css rule (design 03 §5.10, §8.3 `static`).
// Owner: WP13. Nothing happens at import time.
//
// The app stylesheets are built at run time (scopeCss over the moved CSS strings), so they are
// read where they end up: the <style> elements of the mounted shell (the default built-in, all
// five tabs, both Research sections with the population page and the readiness panel loaded),
// the editor's Apply dialog and the patient page. Each distinct sheet is parsed by the browser
// (CSSStyleSheet.replaceSync) and checked:
//   - every selector of every style rule (inside @media / @supports too) starts with the sheet's
//     root: the scoping class of §5.10 (.sa-screener, .sa-scribe, .sa-research, .sa-editor,
//     .re-apply, .sa-rail, .sa-pop, the shell's .sa-shell, whose print rules may also name the
//     page-contract elements .masque-proto and .masque-back), or the legacy scope the design keeps
//     unedited (.mp for the Patient Companion; the .rrp-/.pa- families of the panel and the
//     population artifact; the .sa-common- family of src/ui/common.jsx);
//   - a sheet whose root is a scoping class sits inside (or, for .mp, next to) an element with
//     that class, so the scope actually applies;
//   - no :root outside the shell's sheet; no @import;
//   - @keyframes with the same name are identical everywhere;
//   - every root of the table is seen at least once (the check is never vacuous), and no sheet
//     has a root outside the table.
import React from "react";
import { byTestId, click, importApp, mountApp, openShell, openTab, qa, sandbox, waitFor } from "./shell.js";

/** The stylesheet roots of §5.10. `family`: the root and every class `${root}-…` count. */
export const CSS_SCOPES = [
  // The shell's print rules also hide the page-contract elements outside its root (§5.10, F1).
  { root: "sa-shell", owner: "src/shell/shell.css.js", shell: true, pageContract: /^\.masque-(?:proto|back)(?![\w-])/ },
  { root: "sa-screener", owner: "src/apps/Screener.jsx" },
  { root: "sa-scribe", owner: "src/apps/Scribe.jsx" },
  { root: "mp", owner: "src/apps/PatientCompanion.jsx (the legacy .mp scope, kept unedited)", sibling: true },
  { root: "sa-research", owner: "src/apps/ResearchTab.jsx" },
  { root: "sa-editor", owner: "src/apps/RubricEditor.jsx" },
  { root: "re-apply", owner: "src/apps/RubricEditor.jsx (Apply dialog)" },
  { root: "sa-rail", owner: "src/apps/SampleRail.jsx" },
  { root: "sa-pop", owner: "src/MASQUE_Population.jsx" },
  { root: "rrp", owner: "src/ResearchReadinessPanel.jsx (.rrp- family, kept unedited)", family: true },
  { root: "pa", owner: "src/PopulationArtifact.jsx (.pa- family, kept unedited)", family: true },
  { root: "sa-common", owner: "src/ui/common.jsx (.sa-common- family)", family: true, free: true },
];

/** Split a selector list at top-level commas (not inside parentheses or brackets). */
export function splitSelectors(text) {
  const out = [];
  let depth = 0, cur = "", quote = null;
  for (const ch of String(text)) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const leadClass = (sel) => { const m = /^\.(-?[A-Za-z_][\w-]*)/.exec(sel); return m ? m[1] : null; };
const inScope = (scope, cls) => !!cls && (cls === scope.root || (scope.family && cls.startsWith(`${scope.root}-`)));

/** The scope of a sheet: the table entry its first selector's leading class belongs to. */
function scopeOf(selectors) {
  for (const sel of selectors) {
    const cls = leadClass(sel);
    if (!cls) continue;
    const hit = CSS_SCOPES.find((s) => inScope(s, cls));
    if (hit) return hit;
    return null;
  }
  return null;
}

/** Every style rule's selector list and every @keyframes rule, recursing into grouping rules. */
function walkRules(rules, acc) {
  for (const r of rules) {
    if (r instanceof CSSStyleRule) acc.selectors.push(...splitSelectors(r.selectorText));
    else if (r instanceof CSSKeyframesRule) acc.keyframes.push({ name: r.name, text: r.cssText });
    else if (r instanceof CSSImportRule) acc.imports.push(r.cssText);
    else if (r.cssRules) walkRules(r.cssRules, acc);
  }
  return acc;
}

/**
 * Check the collected sheets ({text, el}). Returns {fails: string[], notes: string[], n}.
 */
export function checkSheets(sheets) {
  const fails = [];
  const notes = [];
  let n = 0;
  const seen = new Map();
  const keyframes = new Map();
  for (const { text, el } of sheets) {
    const sheet = new CSSStyleSheet();
    try { sheet.replaceSync(text); } catch (err) { fails.push(`t-css: a stylesheet does not parse: ${err.message}`); continue; }
    const acc = walkRules(sheet.cssRules, { selectors: [], keyframes: [], imports: [] });
    const scope = scopeOf(acc.selectors);
    const head = text.trim().slice(0, 60).replace(/\s+/g, " ");
    if (!scope) { fails.push(`t-css: a stylesheet with no known root (starts "${head}…"; roots: ${CSS_SCOPES.map((s) => "." + s.root).join(", ")})`); continue; }
    seen.set(scope.root, (seen.get(scope.root) || 0) + 1);
    for (const imp of acc.imports) fails.push(`t-css: ${scope.owner}: @import (${imp})`);
    for (const sel of acc.selectors) {
      n += 1;
      if (/:root\b/.test(sel) && !scope.shell) fails.push(`t-css: ${scope.owner}: ":root" outside shell.css.js (${sel})`);
      if (scope.pageContract && scope.pageContract.test(sel)) continue;
      if (!inScope(scope, leadClass(sel))) fails.push(`t-css: ${scope.owner}: selector "${sel}" does not start with .${scope.root}${scope.family ? ` or .${scope.root}-…` : ""}`);
    }
    // The scope must apply where the sheet is rendered.
    if (!scope.free && !scope.family && el) {
      const host = el.parentElement;
      const sel = `.${CSS.escape(scope.root)}`;
      const ok = !!host && (!!host.closest(sel) || (scope.sibling && !!host.querySelector(`:scope > ${sel}`)));
      if (!ok) fails.push(`t-css: ${scope.owner}: its <style> is not inside ${scope.sibling ? "or next to " : ""}an element with class ${scope.root}`);
    }
    for (const k of acc.keyframes) {
      n += 1;
      if (!keyframes.has(k.name)) keyframes.set(k.name, { text: k.text, owner: scope.owner });
      else if (keyframes.get(k.name).text !== k.text) fails.push(`t-css: @keyframes ${k.name} differs between ${keyframes.get(k.name).owner} and ${scope.owner}`);
    }
  }
  for (const s of CSS_SCOPES) if (!seen.has(s.root)) fails.push(`t-css: no stylesheet with root .${s.root} was rendered (${s.owner}); the check would be vacuous for it`);
  notes.push(`t-css: ${sheets.length} distinct stylesheets, ${n} selectors and keyframes checked; roots seen: ${[...seen.keys()].map((r) => "." + r).join(", ")}; ${keyframes.size} @keyframes name(s)`);
  return { fails, notes, n };
}

/**
 * Mount the shell (default built-in, all five tabs), the Apply dialog and the patient page,
 * and collect their distinct <style> sheets. Returns {sheets, errors, problems}.
 */
export async function collectSheets(h) {
  const [ScreenAIr, PatientPage, editorNs, registry] = await Promise.all([
    importApp(h, "src/shell/ScreenAIr.jsx").then((ns) => ns.default),
    importApp(h, "src/shell/PatientPage.jsx").then((ns) => ns.default),
    importApp(h, "src/apps/RubricEditor.jsx"),
    importApp(h, "src/shell/registry.js"),
  ]);
  const byText = new Map();
  const take = (root) => { for (const el of qa(root, "style")) if (!byText.has(el.textContent)) byText.set(el.textContent, { text: el.textContent, el }); };
  const problems = [];
  let errors = [];
  await sandbox({ hash: "#tab=screener" }, async (sb) => {
    const shell = await openShell(h, ScreenAIr);
    const mounted = [shell];
    try {
      const C = shell.container;
      for (const tab of ["screener", "scribe", "patient", "research", "editor"]) {
        const p = await openTab(C, tab);
        if (tab === "research") {
          for (const seg of ["population", "readiness"]) { const b = byTestId(p, `research-seg-${seg}`); if (b) click(b); else problems.push(`research: no ${seg} section button`); }
          try { await waitFor(() => p.querySelector(".pa") && p.querySelector(".rrp"), { what: "the population artifact and the readiness panel", timeout: 20000 }); }
          catch (err) { problems.push(err.message); }
        }
        if (tab === "editor") {
          try { await waitFor(() => byTestId(p, "rubric-editor"), { what: "the Rubric Editor" }); } catch (err) { problems.push(err.message); }
        }
      }
      take(C);
      // The Apply dialog, on a one-weight change of the active built-in.
      const entry = registry.registered().find((e) => e.origin === "builtin" && e.module && e.validation && e.validation.ok);
      if (entry && typeof editorNs.ApplyDialog === "function") {
        const draft = JSON.parse(JSON.stringify(entry.module.rubric));
        const d = draft.domains.find((x) => !x.negative);
        d.items[0].w += 1; d.max += 1;
        const dlg = mountApp(React.createElement(editorNs.ApplyDialog, { open: true, mode: "apply", parent: entry.module, draft, loaded: [entry], onCancel: () => {}, onCreate: () => {} }));
        mounted.push(dlg);
        try { await waitFor(() => byTestId(dlg.container, "apply-dialog"), { what: "the Apply dialog" }); } catch (err) { problems.push(err.message); }
        take(dlg.container);
      } else {
        problems.push("no built-in entry or no ApplyDialog export to render the Apply dialog");
      }
      const pg = mountApp(React.createElement(PatientPage, { env: h.env }));
      mounted.push(pg);
      try { await waitFor(() => byTestId(pg.container, "patient-app"), { what: "the patient page" }); } catch (err) { problems.push(err.message); }
      take(pg.container);
    } finally {
      for (const m of mounted) m.unmount();
      errors = sb.errors;
    }
  });
  return { sheets: [...byText.values()], errors, problems };
}
