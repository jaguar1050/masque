// tests/dev/MountPatient.jsx — mounts the generic Patient Companion alone, inside the shell's
// print frame, with no tabs (design 03 §2.9, §5.5, §5.10, WP9). Local-only; never deployed.
//
// Module: the default built-in through shell/registry.js loadBuiltins({env}).
//   ?fixture=<name>    bind tests/fixtures/modules/<name>.rubric.json instead (data-only, e.g.
//                      "shape": a plain upload, en only), classified against the built-ins
//   &strip=locales     with ?fixture: drop the rubric's locales (no patient wording → the
//                      "not available" notice)
//   ?derived=1         a verified derivation of the built-in (tests/harness/derivation.js) with
//                      changed scoring, an edited English locale and a stale es locale
//   ?inject=summary    rebind the built-in with a summary rule that throws (the rule-error card)
//   ?inject=gap        rebind the built-in with sum.gap replaced by a throwing template
//
// Chrome around the component, as the shell and patient.html draw it (§5.10, §5.11): the
// PrintFrame whose repeating header is filled from onPrintContext, the caveat strip with the
// patient provenance lines, and a dev bar hidden in print. Everything the component reports
// is mirrored on window.__patientDev for browser checks:
//   {ready, moduleId, origin, printContexts, dirty, errors, header}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PatientCompanion, { patientPrintHeader } from "../../src/apps/PatientCompanion.jsx";
import { projectForPatient } from "../../src/engine/patient.js";
import { loadBuiltins } from "../../src/shell/registry.js";
import { bindModule } from "../../src/engine/bind.js";
import { validateModule } from "../../src/engine/validate.js";
import { classifyLineage } from "../../src/engine/lineage.js";
import { sha256Hex } from "../../src/engine/hash.js";
import { APP_VERSION, CAVEATS } from "../../src/engine/policy.js";
import { CaveatStrip, PrintFrame } from "../../src/shell/chrome.jsx";
import { SHELL_CSS } from "../../src/shell/shell.css.js";
import { bumpFirstWeight, derivedFixture } from "../harness/derivation.js";

const CSS = `
.dev-pat-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px;background:#0C2B2F;color:#EAF3F1;
  font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.dev-pat-bar b{font-weight:650}
.dev-pat-bar .dev-pat-st{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#BFE0DC;min-width:0;overflow-wrap:anywhere}
.dev-pat-msg{padding:24px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0C2B2F}
.dev-pat-msg pre{white-space:pre-wrap;font-size:12px}
@media print{.dev-pat-bar{display:none!important}}
`;

function devLog() {
  if (!window.__patientDev) {
    window.__patientDev = { ready: false, moduleId: null, origin: null, printContexts: [], dirty: [], errors: [], header: null };
  }
  return window.__patientDev;
}

async function fetchBytes(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

const thrower = (msg) => () => { throw new Error(msg); };

function injectedLogic(logic, kind) {
  const ps = logic.patientSummary;
  if (!ps || typeof ps !== "object") throw new Error("the built-in logic has no patientSummary to inject into");
  if (kind === "summary") {
    return { ...logic, patientSummary: { ...ps, said: [{ id: "dev-injected-said", when: thrower("injected summary rule failure"), text: () => "" }, ...(ps.said || [])] } };
  }
  if (kind === "gap") {
    const locales = {};
    for (const loc of Object.keys(logic.locales || {})) {
      const L = logic.locales[loc];
      locales[loc] = { ...L, sum: { ...(L.sum || {}), gap: thrower("injected gap template failure") } };
    }
    return { ...logic, locales };
  }
  throw new Error(`unknown inject kind "${kind}" (summary | gap)`);
}

async function loadModule(env, params) {
  const fixture = params.get("fixture");
  const inject = params.get("inject");
  const entries = await loadBuiltins({ env });
  const entry = entries[0];
  if (!entry || !entry.module) {
    const e = entry && entry.validation && entry.validation.errors && entry.validation.errors[0];
    throw new Error(`the built-in module did not load${e ? `: ${e.code} ${e.path}: ${e.msg}` : ""}`);
  }
  const builtins = entries.filter((e) => e.module).map((e) => e.module);

  if (fixture) {
    if (!/^[a-z0-9-]+$/.test(fixture)) throw new Error(`bad fixture name "${fixture}"`);
    const bytes = await fetchBytes(new URL(`tests/fixtures/modules/${fixture}.rubric.json`, env.appBase).href);
    const rubricText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const rubric = JSON.parse(rubricText);
    if (rubric.logicBinding !== "generic") throw new Error(`fixture ${fixture} binds logic; this page mounts data-only fixtures only`);
    if (params.get("strip") === "locales") { delete rubric.locales; delete rubric.defaultLocale; }
    const classification = await classifyLineage(rubric, { builtins, loaded: builtins, sameUpload: [], logicSha256: null, contentHash: null });
    const module = await bindModule(rubric, null, {
      origin: classification.origin, classification, key: `fixture:${fixture}`,
      sources: { rubricText, logicText: null },
      files: { rubric: { name: `${fixture}.rubric.json`, text: rubricText, sha256: await sha256Hex(bytes) }, logic: null },
      loadedAt: new Date().toISOString(),
    });
    return { module, validation: await validateModule({ module, loaded: builtins }) };
  }

  if (params.get("derived") === "1") {
    const h = { engine: (file) => env.loader.importModule(new URL(`src/engine/${file}`, env.appBase).href) };
    const EDIT = " (edited locally on the dev page)";
    const d = await derivedFixture(h, entry.module, {
      id: `local-${entry.module.id}-patient-dev`,
      mutate(r) {
        bumpFirstWeight(r);
        const first = r.domains[0].items[0].id;
        r.locales.en.items[first].q += EDIT;
        r.locales.en.reviewed = false;
        r.locales.en.editedLocally = true;
        if (r.locales.es) {
          r.locales.es.reviewed = false;
          r.locales.es.stale = [`/locales/en/items/${first}/q`];
        }
      },
    });
    return { module: d.module, validation: d.validation };
  }

  if (inject) {
    const m = entry.module;
    const module = await bindModule(m.rubric, injectedLogic(m.logic, inject), {
      origin: "builtin", classification: "builtin", key: `${m.key}+${inject}`, sources: m.sources,
    });
    return { module, validation: null };
  }
  return { module: entry.module, validation: entry.validation };
}

export default function MountPatient({ env }) {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  const [printCtx, setPrintCtx] = useState(null);
  const [dirty, setDirty] = useState(null);
  const [errors, setErrors] = useState(0);
  const [mountKey, setMountKey] = useState(0);
  const log = useRef(devLog());

  useEffect(() => {
    let live = true;
    loadModule(env, params).then(
      (r) => {
        if (!live) return;
        log.current.moduleId = r.module.id;
        log.current.origin = r.module.origin;
        log.current.validation = r.validation ? { ok: r.validation.ok, errors: r.validation.errors.length, warnings: r.validation.warnings.length } : null;
        setLoaded(r);
      },
      (e) => { if (live) setError(e); });
    return () => { live = false; };
  }, [env, params]);

  const view = useMemo(() => (loaded ? projectForPatient(loaded.module) : null), [loaded]);
  const header = view ? patientPrintHeader(view, printCtx) : CAVEATS.prototype;
  useEffect(() => { log.current.header = header; }, [header]);
  useEffect(() => { log.current.ready = !!view; }, [view]);

  const onPrintContext = useCallback((pc) => { log.current.printContexts.push(pc); setPrintCtx(pc); }, []);
  const onDirty = useCallback((tab, summary) => { log.current.dirty.push({ tab, summary }); setDirty(summary); }, []);
  const onModuleError = useCallback((e) => { log.current.errors.push(e); setErrors((n) => n + 1); }, []);

  if (error) {
    return (
      <div className="dev-pat-msg" data-testid="dev-error"><style>{CSS}</style>
        <b>The Patient dev page could not load its module.</b> {CAVEATS.prototype}
        <pre>{String(error && error.stack ? error.stack : error)}</pre>
      </div>
    );
  }
  if (!view) return <div className="dev-pat-msg" data-testid="dev-loading"><style>{CSS}</style>Loading the module… · {CAVEATS.prototype}</div>;

  const variant = params.get("fixture") ? `fixture:${params.get("fixture")}${params.get("strip") ? "-" + params.get("strip") : ""}`
    : params.get("derived") ? "derived" : params.get("inject") ? `inject:${params.get("inject")}` : "built-in";
  return (
    <div className="sa-shell">
      <style>{SHELL_CSS}</style>
      <style>{CSS}</style>
      <div className="dev-pat-bar" data-testid="dev-bar">
        <b>Patient dev</b>
        <span className="dev-pat-st">{loaded.module.id} · {variant}</span>
        <button type="button" data-testid="dev-remount" onClick={() => setMountKey((k) => k + 1)}>Remount</button>
        <span className="dev-pat-st" data-testid="dev-dirty">dirty: {dirty || "—"}</span>
        <span className="dev-pat-st" data-testid="dev-errors">errors: {errors}</span>
        <span className="dev-pat-st" data-testid="dev-print-ctx">print: {printCtx ? JSON.stringify(printCtx) : "—"}</span>
      </div>
      <PrintFrame header={header}>
        <CaveatStrip lines={view.provenanceLines} />
        <main role="tabpanel" className="sa-panel" data-testid="dev-patient-panel">
          <PatientCompanion key={mountKey} view={view} appVersion={APP_VERSION}
            onDirty={onDirty} onModuleError={onModuleError} onPrintContext={onPrintContext} />
        </main>
      </PrintFrame>
    </div>
  );
}
