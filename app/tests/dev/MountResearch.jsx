// tests/dev/MountResearch.jsx — mounts the Research tab alone, with no shell (design 03 §2.9,
// §5.6, WP10). Local-only; never deployed.
//
// Module: the default built-in through shell/registry.js loadBuiltins (the one built-in load
// path), or
//   ?module=derived    a verified derivation of it with one weight changed (scoring differs, so
//                      the calibration is withheld and the population shows under the banner)
//   ?module=wording    a verified derivation with a wording-only change (calibration applies)
//   ?fixture=<name>    tests/fixtures/modules/<name>.rubric.json bound as an upload (data-only
//                      fixtures, e.g. "shape": no research block)
//
// The dev bar stands in for the Screener and the Scribe: it publishes a screen built from one of
// the module's sample cases and captures a cohort row, through the same session API the shell's
// workspace uses. What the tab reports is mirrored on window.__researchDev:
//   {ready, moduleId, origin, kind, validation, dirty: [[tab, summary]], published, captured}

import React, { useEffect, useState } from "react";
import ResearchTab from "../../src/apps/ResearchTab.jsx";
import { loadBuiltins } from "../../src/shell/registry.js";
import * as bind from "../../src/engine/bind.js";
import * as hash from "../../src/engine/hash.js";
import * as lineage from "../../src/engine/lineage.js";
import * as validate from "../../src/engine/validate.js";
import { computeScore } from "../../src/engine/scoring.js";
import { screenToCohortRow } from "../../src/engine/cohort.js";
import { APP_VERSION } from "../../src/engine/policy.js";
import { SessionProvider, useSession } from "../../src/ui/common.jsx";
import { derivedFixture, bumpFirstWeight } from "../harness/derivation.js";

const CSS = `
.dev-rt-bar{position:sticky;top:0;z-index:30;display:flex;flex-wrap:wrap;gap:8px;align-items:center;
  padding:8px 12px;background:#0C2B2F;color:#EAF3F1;font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.dev-rt-bar b{font-weight:650}
.dev-rt-bar button,.dev-rt-bar select{font:inherit;color:inherit;background:transparent;border:1px solid rgba(255,255,255,.3);
  border-radius:7px;padding:4px 9px;cursor:pointer}
.dev-rt-bar select option{color:#0C2B2F}
.dev-rt-caveat{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#F6E1DA;margin-left:auto}
.dev-rt-body{max-width:1120px;margin:0 auto;padding:16px}
.dev-rt-msg{padding:24px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0C2B2F}
.dev-rt-msg pre{white-space:pre-wrap;font-size:12px}
`;

const DEV = { ready: false, moduleId: null, origin: null, kind: null, validation: null, dirty: [], published: [], captured: [] };

/** The harness object derivation.js expects, backed by static engine imports. */
const ENGINE = { "bind.js": bind, "hash.js": hash, "lineage.js": lineage, "validate.js": validate };
const devHarness = { engine: async (file) => ENGINE[file] };

async function loadFixture(env, name, builtins) {
  const res = await fetch(new URL(`tests/fixtures/modules/${name}.rubric.json`, env.appBase).href, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for fixture ${name}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const rubricText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const rubric = JSON.parse(rubricText);
  if (rubric.logicBinding !== "generic") throw new Error(`fixture ${name} binds logic; the dev page mounts data-only fixtures only`);
  const classification = await lineage.classifyLineage(rubric, { builtins, loaded: builtins, sameUpload: [], logicSha256: null });
  const module = await bind.bindModule(rubric, null, {
    origin: classification.origin, classification, key: `fixture:${name}`,
    sources: { rubricText, logicText: null },
    files: { rubric: { name: `${name}.rubric.json`, text: rubricText, sha256: await hash.sha256Hex(bytes) }, logic: null },
    loadedAt: new Date().toISOString(),
  });
  return { module, validation: await validate.validateModule({ module, loaded: builtins }) };
}

/** The first wording-only change available: an item's clinician text gains a suffix. */
function rewordFirstItem(rubric) {
  const it = rubric.domains[0].items[0];
  it.text = `${it.text} (edited)`;
}

function DevBar({ module }) {
  const { publish, addRow, screens, cohorts } = useSession();
  const cases = module.sampleCases || [];
  const [pick, setPick] = useState(cases.length ? cases[0].id : "");
  const sample = cases.find((c) => c.id === pick) || null;
  const screenFor = (source) => {
    const answers = sample ? { ...sample.a } : {};
    const score = computeScore(module, answers);
    const flags = sample && sample.rf ? Object.keys(sample.rf).filter((k) => sample.rf[k]).map((k) => module.flagById[k]).filter(Boolean) : [];
    const patient = module.demo && module.demo.patient ? module.demo.patient : {};
    return {
      source, at: new Date().toISOString(), moduleKey: module.key,
      score: score.total, floor: score.floor, ceiling: score.ceiling, scorable: score.scorable, band: score.band,
      domains: score.domains, coverage: score.coverage,
      sex: patient.sex ?? null, gender: patient.gender ?? null,
      phenotype: sample && sample.complaint ? sample.complaint : "",
      redFlags: flags.map((f) => f.points), safetyReviewed: true, routingCleared: flags.length === 0,
      answers, ctx: sample && sample.ctx ? sample.ctx : {},
      _row: () => screenToCohortRow(module, { patient, answers, ctx: sample && sample.ctx ? sample.ctx : {}, score, activeFlags: flags, complaint: sample ? sample.complaint : "" }, { appVersion: APP_VERSION }),
    };
  };
  const doPublish = (source) => {
    const { _row, ...snap } = screenFor(source);
    DEV.published.push({ source, id: pick });
    publish(snap);
  };
  const doCapture = (source) => {
    const row = screenFor(source)._row();
    DEV.captured.push({ source, id: pick });
    addRow(source, row);
  };
  return (
    <div className="dev-rt-bar" data-testid="dev-bar">
      <b>Research (dev)</b>
      <select data-testid="dev-sample" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Sample case">
        {cases.map((c) => <option key={c.id} value={c.id}>{c.label || c.id}</option>)}
        <option value="">(empty screen)</option>
      </select>
      <button type="button" data-testid="dev-publish-screener" onClick={() => doPublish("screener")}>Publish as Screener</button>
      <button type="button" data-testid="dev-publish-scribe" onClick={() => doPublish("scribe")}>Publish as Scribe</button>
      <button type="button" data-testid="dev-capture-screener" onClick={() => doCapture("screener")}>Capture row (Screener)</button>
      <button type="button" data-testid="dev-capture-scribe" onClick={() => doCapture("scribe")}>Capture row (Scribe)</button>
      <span data-testid="dev-session">{`screens: ${["screener", "scribe"].filter((k) => screens[k]).join(", ") || "none"} · rows: ${cohorts.screener.length}/${cohorts.scribe.length}`}</span>
      <span className="dev-rt-caveat">Prototype · not for clinical use</span>
    </div>
  );
}

export default function MountResearch({ env }) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const q = new URLSearchParams(location.search);
        const entries = await loadBuiltins({ env });
        const builtins = entries.filter((e) => e && e.module).map((e) => e.module);
        const root = builtins[0];
        if (!root) throw new Error(`the built-in module did not load: ${JSON.stringify(entries[0] && entries[0].validation && entries[0].validation.errors)}`);
        let r;
        const which = q.get("module");
        if (q.get("fixture")) r = await loadFixture(env, q.get("fixture"), builtins);
        else if (which === "derived") r = await derivedFixture(devHarness, root, { mutate: bumpFirstWeight });
        else if (which === "wording") r = await derivedFixture(devHarness, root, { mutate: rewordFirstItem, id: `local-${root.id}-wording` });
        else r = { module: root, validation: entries[0].validation };
        if (r.validation && !r.validation.ok) throw new Error(`validation: ${r.validation.errors.map((x) => `${x.code} ${x.path}: ${x.msg}`).join("; ")}`);
        Object.assign(DEV, { ready: true, moduleId: r.module.id, origin: r.module.origin, kind: r.module.classification && r.module.classification.kind, validation: r.validation });
        if (live) setState({ status: "ready", module: r.module });
      } catch (err) {
        if (live) setState({ status: "error", error: String(err && err.stack ? err.stack : err) });
      }
    })();
    return () => { live = false; };
  }, [env]);
  useEffect(() => { window.__researchDev = DEV; }, []);

  if (state.status === "loading") return <div className="dev-rt-msg" data-testid="dev-loading"><style>{CSS}</style>Loading the module…</div>;
  if (state.status === "error") {
    return <div className="dev-rt-msg" data-testid="dev-error"><style>{CSS}</style><pre>{state.error}</pre></div>;
  }
  return (
    <SessionProvider>
      <style>{CSS}</style>
      <DevBar module={state.module} />
      <div className="dev-rt-body">
        <ResearchTab module={state.module} appVersion={APP_VERSION} env={env}
          onDirty={(tab, summary) => DEV.dirty.push([tab, summary])} />
      </div>
    </SessionProvider>
  );
}
