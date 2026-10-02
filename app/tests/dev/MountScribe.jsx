import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Scribe from "../../src/apps/Scribe.jsx";
import { loadBuiltins } from "../../src/shell/registry.js";
import { bindModule } from "../../src/engine/bind.js";
import { validateModule } from "../../src/engine/validate.js";
import { APP_VERSION, SITE, CAVEATS } from "../../src/engine/policy.js";

/*  tests/dev/MountScribe.jsx — mounts the generic Ambient Scribe alone, without the shell
    (design 03 §2.9, WP8). Local-only; never deployed.

    Module: the default built-in through shell/registry.js loadBuiltins (the §3.8 load path).
      ?fixture=<name>   bind tests/fixtures/modules/<name>.rubric.json instead (a generic
                        rubric, e.g. "shape": no lexicon, no probes, no transcript)
      ?inject=<kind>    rebind the built-in with one injected failing closure:
                        derive | routing | probe (fail-closed checks, §3.3)

    The dev bar stands in for the shell's side of the microphone contract: stopSignal++,
    micAllowed on/off, remount (a module switch remounts the workspace) and unmount. What
    the Scribe reports is mirrored on window.__scribeDev for the Playwright voice spec:
      {voiceStates, errors, screens, dirty, captures, opens, ready, moduleId, validation}
*/

const CSS = `
.dev-scribe-bar{position:sticky;top:0;z-index:30;display:flex;flex-wrap:wrap;gap:8px;align-items:center;
  padding:8px 12px;background:#0C2B2F;color:#EAF3F1;font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.dev-scribe-bar b{font-weight:650}
.dev-scribe-bar button,.dev-scribe-bar label{font:inherit;color:inherit;background:transparent;border:1px solid rgba(255,255,255,.3);
  border-radius:7px;padding:4px 9px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.dev-scribe-bar .dev-scribe-st{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#BFE0DC}
.dev-scribe-caveat{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#F6E1DA;margin-left:auto}
.dev-scribe-msg{padding:24px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0C2B2F}
.dev-scribe-msg pre{white-space:pre-wrap;font-size:12px}
`;

function devLog() {
  if (!window.__scribeDev) {
    window.__scribeDev = { voiceStates: [], errors: [], screens: [], dirty: [], captures: [], opens: [], ready: false, moduleId: null, validation: null };
  }
  return window.__scribeDev;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const fail = (msg) => () => { throw new Error(msg); };

/** A copy of the logic with one closure that throws (design §3.3 fail-closed rows). */
function injectedLogic(logic, kind) {
  if (kind === "derive") {
    const derive = (logic.phenotypes && logic.phenotypes.derive) || [];
    const value = derive.length ? derive[0].value : "";
    return { ...logic, phenotypes: { ...logic.phenotypes, derive: [{ id: "dev-injected-derive", value, when: fail("injected derive failure") }, ...derive] } };
  }
  if (kind === "routing") {
    const copy = { h: "dev", p: "dev", chips: [] };
    return { ...logic, routing: [{ id: "dev-injected-routing", when: fail("injected routing failure"), copy: { screener: copy, scribe: copy } }, ...(logic.routing || [])] };
  }
  if (kind === "probe") {
    const list = (logic.probes && logic.probes.list) || [];
    if (!list.length) return logic;
    return { ...logic, probes: { ...logic.probes, list: [{ ...list[0], id: "dev-injected-probe", when: fail("injected probe failure") }, ...list.slice(1)] } };
  }
  throw new Error(`unknown inject kind "${kind}" (derive | routing | probe)`);
}

async function loadModule(env, params) {
  const fixture = params.get("fixture");
  const inject = params.get("inject");
  if (fixture) {
    if (!/^[a-z0-9-]+$/.test(fixture)) throw new Error(`bad fixture name "${fixture}"`);
    const rubricText = await fetchText(new URL(`tests/fixtures/modules/${fixture}.rubric.json`, env.appBase).href);
    const rubric = JSON.parse(rubricText);
    let logic = null, logicText = null;
    if (rubric.logicBinding && typeof rubric.logicBinding === "object") {
      logicText = await fetchText(new URL(`tests/fixtures/modules/${fixture}.logic.js`, env.appBase).href);
      logic = (await env.loader.importSource(logicText, { filename: `${fixture}.logic.js` })).default;
    }
    const module = await bindModule(rubric, logic, { origin: "uploaded", key: `fixture:${fixture}`, sources: { rubricText, logicText } });
    return { module, validation: await validateModule({ module, loaded: [] }) };
  }
  const entries = await loadBuiltins({ env });
  const entry = entries[0];
  if (!entry || !entry.module) {
    const e = entry && entry.validation && entry.validation.errors && entry.validation.errors[0];
    throw new Error(`the built-in module did not load${e ? `: ${e.code} ${e.path}: ${e.msg}` : ""}`);
  }
  if (!inject) return { module: entry.module, validation: entry.validation };
  const m = entry.module;
  const module = await bindModule(m.rubric, injectedLogic(m.logic, inject), {
    origin: "builtin", classification: "builtin", key: `${m.key}+${inject}`, sources: m.sources,
  });
  return { module, validation: null };
}

export default function MountScribe({ env }) {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  const [stopSignal, setStopSignal] = useState(0);
  const [micAllowed, setMicAllowed] = useState(params.get("mic") !== "off");
  const [mountKey, setMountKey] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [voice, setVoice] = useState("idle");
  const [dirty, setDirty] = useState(null);
  const [errors, setErrors] = useState(0);
  const [rows, setRows] = useState(0);
  const log = useRef(devLog());

  useEffect(() => {
    let live = true;
    loadModule(env, params).then(
      (r) => {
        if (!live) return;
        log.current.moduleId = r.module.id;
        log.current.validation = r.validation ? { ok: r.validation.ok, errors: r.validation.errors.length, warnings: r.validation.warnings.length } : null;
        setLoaded(r);
      },
      (e) => { if (live) setError(e); });
    return () => { live = false; };
  }, [env, params]);

  useEffect(() => { log.current.ready = !!loaded; }, [loaded]);

  const onVoiceState = useCallback(({ state }) => { log.current.voiceStates.push(state); setVoice(state); }, []);
  const onModuleError = useCallback((e) => { log.current.errors.push(e); setErrors((n) => n + 1); }, []);
  const onScreen = useCallback((s) => { log.current.screens.push(s); }, []);
  const onDirty = useCallback((tab, summary) => { log.current.dirty.push({ tab, summary }); setDirty(summary); }, []);
  const onCapture = useCallback(({ source, row }) => { log.current.captures.push({ source, row }); setRows((n) => n + 1); }, []);
  const onOpenTab = useCallback((tab) => { log.current.opens.push(tab); }, []);

  if (error) {
    return (
      <div className="dev-scribe-msg"><style>{CSS}</style>
        <b>The Scribe dev page could not load its module.</b> {CAVEATS.prototype}
        <pre>{String(error && error.stack ? error.stack : error)}</pre>
      </div>
    );
  }
  if (!loaded) return <div className="dev-scribe-msg"><style>{CSS}</style>Loading the module… · {CAVEATS.prototype}</div>;

  return (
    <>
      <style>{CSS}</style>
      <div className="dev-scribe-bar" data-testid="dev-bar">
        <b>Scribe dev</b>
        <span className="dev-scribe-st">{loaded.module.id}{params.get("inject") ? ` + inject:${params.get("inject")}` : ""}</span>
        <button type="button" data-testid="dev-stop" onClick={() => setStopSignal((n) => n + 1)}>stopSignal++ ({stopSignal})</button>
        <label data-testid="dev-mic-label"><input type="checkbox" data-testid="dev-mic" checked={micAllowed} onChange={(e) => setMicAllowed(e.target.checked)} /> micAllowed</label>
        <button type="button" data-testid="dev-remount" onClick={() => { setStopSignal((n) => n + 1); setMountKey((k) => k + 1); }}>Remount (module switch)</button>
        <button type="button" data-testid="dev-unmount" onClick={() => setMounted((m) => !m)}>{mounted ? "Unmount" : "Mount"}</button>
        <span className="dev-scribe-st" data-testid="dev-voice">voice: {voice}</span>
        <span className="dev-scribe-st" data-testid="dev-dirty">dirty: {dirty || "—"}</span>
        <span className="dev-scribe-st" data-testid="dev-errors">errors: {errors}</span>
        <span className="dev-scribe-st" data-testid="dev-rows">rows: {rows}</span>
        <span className="dev-scribe-caveat">{CAVEATS.prototype}</span>
      </div>
      {mounted && (
        <Scribe key={mountKey} module={loaded.module} appVersion={APP_VERSION} site={SITE}
          onScreen={onScreen} onCapture={onCapture} onDirty={onDirty} onModuleError={onModuleError}
          onOpenTab={onOpenTab} onVoiceState={onVoiceState} stopSignal={stopSignal} micAllowed={micAllowed} />
      )}
    </>
  );
}
