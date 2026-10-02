// tests/dev/MountEditor.jsx — mounts the Rubric Editor alone, with no shell (design 03 §2.9,
// §5.7, WP11). Local-only; never deployed.
//
// The page plays the shell's part with a small local registry:
//   - modules: the built-ins through shell/registry.js loadBuiltins (the one built-in load path),
//     plus, on request,
//       ?fixture=shape            the data-only shape fixture, bound as an upload
//       ?fixture=shape-bare       the same with its patient wording removed (Create English
//                                 patient wording; it also has no lexicon: Create lexicon)
//       ?derived=1                a verified derivation of the default built-in (one weight up)
//   - ?active=<key>               the active module (default: the default built-in)
//   - ?screens=1                  publishes the first sample case as the current Screener and
//                                 Scribe screens (the editor's current-screen impact rows)
//   - ?now=<ISO>                  a fixed clock for Apply and the downloads
// onApply registers the derived entry here (and calls registry.saveModule when "Remember" is
// ticked and WP12-M3 provides it); "Create and switch" goes through a dev confirmation that
// lists what a switch clears, like the shell's. Everything the editor reports is mirrored on
// window.__editorDev = {ready, activeKey, keys(), applied, switches, downloads, downloaded,
// screenResets, savedCalls, registryM3, error}.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RubricEditor from "../../src/apps/RubricEditor.jsx";
import * as registry from "../../src/shell/registry.js";
import * as bind from "../../src/engine/bind.js";
import * as hash from "../../src/engine/hash.js";
import * as lineage from "../../src/engine/lineage.js";
import * as validate from "../../src/engine/validate.js";
import * as derive from "../../src/engine/derive.js";
import { computeScore } from "../../src/engine/scoring.js";
import { buildExportZip, fetchBytesFor } from "../../src/engine/exportAll.js";
import { downloadBytes } from "../../src/engine/download.js";
import { APP_VERSION } from "../../src/engine/policy.js";
import { SessionProvider, useSession } from "../../src/ui/common.jsx";

const CSS = `
.dev-ed-bar{position:sticky;top:0;z-index:30;display:flex;flex-wrap:wrap;gap:8px;align-items:center;
  padding:8px 12px;background:#0C2B2F;color:#EAF3F1;font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.dev-ed-bar b{font-weight:650}
.dev-ed-caveat{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#F6E1DA;margin-left:auto}
.dev-ed-body{max-width:1320px;margin:0 auto;padding:16px}
.dev-ed-msg{padding:24px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0C2B2F}
.dev-ed-msg pre{white-space:pre-wrap;font-size:12px}
.dev-ed-confirm{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:90;display:flex;align-items:center;justify-content:center;padding:12px}
.dev-ed-confirm > div{background:#fff;border-radius:12px;padding:16px;max-width:520px;font:13px/1.5 -apple-system,sans-serif}
.dev-ed-confirm button{font:inherit;margin:8px 8px 0 0;padding:6px 12px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer}
`;

const DEV = {
  ready: false, error: null, activeKey: null, keys: () => [], applied: [], switches: [], downloads: [], downloaded: [],
  screenResets: 0, savedCalls: [], registryM3: null,
};

async function fixtureEntry(env, name, builtins) {
  const file = name === "shape-bare" ? "shape" : name;
  const res = await fetch(new URL(`tests/fixtures/modules/${file}.rubric.json`, env.appBase).href, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for fixture ${file}`);
  let rubricText = await res.text();
  let rubric = JSON.parse(rubricText);
  if (name === "shape-bare") {
    delete rubric.locales;
    rubric.id = "shape-bare";
    rubric.label = "Shape fixture without patient wording";
    rubricText = bind.serializeRubric(rubric);
  }
  if (rubric.logicBinding !== "generic") throw new Error(`fixture ${name} binds logic; the dev page mounts data-only fixtures only`);
  const classification = await lineage.classifyLineage(rubric, { builtins, loaded: builtins, sameUpload: [], logicSha256: null });
  const sha = await hash.sha256Hex(rubricText);
  const files = { rubric: { name: `${rubric.id}.rubric.json`, text: rubricText, sha256: sha }, logic: null };
  const key = `upload:${rubric.id}`;
  const module = await bind.bindModule(rubric, null, {
    origin: classification.origin, classification, key, sources: { rubricText, logicText: null }, files, loadedAt: new Date().toISOString(),
  });
  const validation = await validate.validateModule({ module, loaded: builtins });
  return { key, origin: module.origin, classification, module, validation, files, loadedAt: module.loadedAt };
}

async function registryM3Available() {
  try { registry.listSaved(); return true; } catch (err) { return !/not implemented/.test(String(err && err.message)); }
}

function ScreensProbe({ module, publishSample }) {
  const { publish, screens } = useSession();
  const done = useRef(false);
  useEffect(() => {
    if (!publishSample || done.current || !module) return;
    done.current = true;
    const s = (module.sampleCases || [])[0];
    if (!s) return;
    const score = computeScore(module, s.a || {});
    const flags = Object.keys(s.rf || {}).filter((k) => s.rf[k]).map((k) => module.flagById[k]).filter(Boolean);
    for (const source of ["screener", "scribe"]) {
      publish({
        source, at: new Date().toISOString(), moduleKey: module.key, score: score.total, floor: score.floor, ceiling: score.ceiling,
        scorable: score.scorable, band: score.band, domains: score.domains, coverage: score.coverage, sex: null, gender: null,
        phenotype: s.complaint || "", redFlags: flags.map((f) => f.points), safetyReviewed: s.safetyReviewed !== false,
        routingCleared: !flags.length, answers: { ...(s.a || {}) }, ctx: { ...(s.ctx || {}) },
      });
    }
  }, [module, publishSample, publish]);
  return <span data-testid="dev-screens">{`screens: ${["screener", "scribe"].filter((k) => screens[k]).join(", ") || "none"}`}</span>;
}

export default function MountEditor({ env }) {
  const q = useMemo(() => new URLSearchParams(location.search), []);
  const fixedNow = q.get("now") || null;
  const [state, setState] = useState({ status: "loading" });
  const [entries, setEntries] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [pendingSwitch, setPendingSwitch] = useState(null);
  const [resetCount, setResetCount] = useState(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const built = await registry.loadBuiltins({ env });
        const builtins = built.filter((e) => e && e.module).map((e) => e.module);
        if (!builtins.length) throw new Error(`the built-in module did not load: ${JSON.stringify(built[0] && built[0].validation && built[0].validation.errors)}`);
        const list = [...built];
        const fx = q.get("fixture");
        if (fx) list.push(await fixtureEntry(env, fx, builtins));
        if (q.get("derived")) {
          const root = builtins[0];
          let draft = derive.createDraft(root).rubric;
          const d = draft.domains.find((x) => !x.negative);
          d.items[0].w += 1;
          d.max += 1;
          const res = await derive.deriveAndBind(root, draft, { loaded: builtins, now: fixedNow || "2026-10-01T12:00:00.000Z", note: "dev page: one weight up" });
          if (!res.validation.ok) throw new Error(`derived fixture invalid: ${res.validation.errors.map((e) => `${e.code} ${e.path}`).join("; ")}`);
          list.push(res.entry);
        }
        DEV.registryM3 = await registryM3Available();
        if (DEV.registryM3) {
          try {
            for (const s of registry.listSaved()) {
              try { list.push(await registry.restoreSaved(s.id, { entries: list, env })); } catch (err) { DEV.savedCalls.push({ restoreError: String(err && err.message) }); }
            }
          } catch (_) { /* nothing saved */ }
        }
        const active = q.get("active") || list[0].key;
        if (!live) return;
        setEntries(list);
        setActiveKey(active);
        setState({ status: "ready" });
        Object.assign(DEV, { ready: true, activeKey: active });
      } catch (err) {
        DEV.error = String(err && err.stack ? err.stack : err);
        if (live) setState({ status: "error", error: DEV.error });
      }
    })();
    return () => { live = false; };
  }, [env]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    DEV.activeKey = activeKey;
    DEV.keys = () => entriesRef.current.map((e) => e.key);
    DEV.entries = () => entriesRef.current;
    window.__editorDev = DEV;
  }, [activeKey, entries]);

  const onApply = useCallback(async ({ rubric, remember, switchTo, entry }) => {
    DEV.applied.push({ id: rubric.id, label: rubric.label, remember, switchTo, origin: entry.origin, kind: entry.classification && entry.classification.kind });
    setEntries((prev) => [...prev, entry]);
    if (remember && DEV.registryM3) {
      try { registry.saveModule(entry); DEV.savedCalls.push({ saved: entry.key }); } catch (err) { DEV.savedCalls.push({ saveError: String(err && err.message) }); }
    }
    if (switchTo) setPendingSwitch(entry.key);
    return { ok: true };
  }, []);

  const onDownloadAll = useCallback(async () => {
    const z = await buildExportZip(entriesRef.current, { appVersion: APP_VERSION, now: fixedNow || new Date().toISOString(), fetchBytes: fetchBytesFor(env.appBase) });
    DEV.downloads.push({ name: z.name, size: z.bytes.length, files: z.files.map((f) => f.name) });
    downloadBytes(z.name, z.bytes, "application/zip");
  }, [env, fixedNow]);

  if (state.status === "loading") return <div className="dev-ed-msg" data-testid="dev-loading"><style>{CSS}</style>Loading the modules…</div>;
  if (state.status === "error") return <div className="dev-ed-msg" data-testid="dev-error"><style>{CSS}</style><pre>{state.error}</pre></div>;
  const active = entries.find((e) => e.key === activeKey);
  return (
    <SessionProvider key={activeKey}>
      <style>{CSS}</style>
      <div className="dev-ed-bar" data-testid="dev-bar">
        <b>Rubric Editor (dev)</b>
        <span data-testid="dev-active">active: {activeKey}</span>
        <span data-testid="dev-resets">screen resets: {resetCount}</span>
        <ScreensProbe module={active && active.module} publishSample={!!q.get("screens")} />
        <span className="dev-ed-caveat">Prototype · not for clinical use</span>
      </div>
      <div className="dev-ed-body">
        <RubricEditor entries={entries} activeKey={activeKey} env={env} onApply={onApply} onDownloadAll={onDownloadAll}
          onDownloaded={(keys) => DEV.downloaded.push(keys)} now={fixedNow} />
      </div>
      {pendingSwitch && (
        <div className="dev-ed-confirm" role="dialog" aria-label="Switch module" data-testid="dev-switch-confirm">
          <div>
            <b>Switch module?</b>
            <p>Switching clears the Clinician Screener, Ambient Scribe and Patient Companion screens and the captured rows. Rubric Editor drafts are kept.</p>
            <button type="button" data-dev-switch="cancel" onClick={() => { DEV.switches.push({ to: pendingSwitch, confirmed: false }); setPendingSwitch(null); }}>Cancel</button>
            <button type="button" data-dev-switch="ok" onClick={() => {
              DEV.switches.push({ to: pendingSwitch, confirmed: true });
              DEV.screenResets += 1;
              setResetCount((n) => n + 1);
              setActiveKey(pendingSwitch);
              setPendingSwitch(null);
            }}>Switch module</button>
          </div>
        </div>
      )}
    </SessionProvider>
  );
}
