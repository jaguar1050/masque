// tests/dev/MountScreener.jsx — mounts the generic Clinician Screener alone, with the built-in
// module and no shell (design 03 §2.9, §9.0 B P5). Local-only; never deployed. Owner: WP7.
//
// The module comes through shell/registry.js loadBuiltins({env}), the one built-in load path.
// `?fixture=<name>` instead binds tests/fixtures/modules/<name>.rubric.json as an upload
// (data-only fixtures only, e.g. ?fixture=shape), classified against the loaded built-ins.
// The session callbacks are recorded on window.__screenerDev for browser checks:
//   {module, snapshots, rows, dirty, errors, opened}.

import React, { useEffect, useState } from "react";
import { loadBuiltins } from "../../src/shell/registry.js";
import { bindModule } from "../../src/engine/bind.js";
import { validateModule } from "../../src/engine/validate.js";
import { classifyLineage } from "../../src/engine/lineage.js";
import { sha256Hex } from "../../src/engine/hash.js";
import { APP_VERSION, SITE } from "../../src/engine/policy.js";
import { SessionProvider, useSession } from "../../src/ui/common.jsx";
import Screener from "../../src/apps/Screener.jsx";

const DEV = { module: null, snapshots: [], rows: [], dirty: [], errors: [], opened: [] };

async function loadFixture(env, name, builtins) {
  const at = (p) => new URL(p, env.appBase).href;
  const res = await fetch(at(`tests/fixtures/modules/${name}.rubric.json`), { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for fixture ${name}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const rubricText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const rubric = JSON.parse(rubricText);
  if (rubric.logicBinding !== "generic") throw new Error(`fixture ${name} binds logic; the dev page mounts data-only fixtures only`);
  const mods = builtins.filter((e) => e.module).map((e) => e.module);
  const classification = await classifyLineage(rubric, { builtins: mods, loaded: mods, sameUpload: [], logicSha256: null, contentHash: null });
  const module = await bindModule(rubric, null, {
    origin: classification.origin, classification, key: `fixture:${name}`,
    sources: { rubricText, logicText: null },
    files: { rubric: { name: `${name}.rubric.json`, text: rubricText, sha256: await sha256Hex(bytes) }, logic: null },
    loadedAt: new Date().toISOString(),
  });
  const validation = await validateModule({ module, loaded: mods });
  return { module, validation };
}

function Wired({ module }) {
  const session = useSession();
  return (
    <Screener
      module={module} appVersion={APP_VERSION} site={SITE}
      onScreen={(s) => { DEV.snapshots.push(s); session.publish(s); }}
      onCapture={({ source, row }) => { DEV.rows.push({ source, row }); session.addRow(source, row); }}
      onDirty={(tab, summary) => DEV.dirty.push([tab, summary])}
      onModuleError={(e) => DEV.errors.push(e)}
      onOpenTab={(t) => DEV.opened.push(t)}
    />
  );
}

const box = { maxWidth: 960, margin: "24px auto", padding: "14px 16px", borderRadius: 12, font: "14px/1.5 -apple-system, sans-serif" };

export default function MountScreener({ env }) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const fixture = new URLSearchParams(location.search).get("fixture");
        const entries = await loadBuiltins({ env });
        const r = fixture ? await loadFixture(env, fixture, entries) : (() => {
          const e = entries[0];
          if (!e || !e.module) throw new Error(`the built-in module did not load: ${JSON.stringify(e && e.validation && e.validation.errors)}`);
          return { module: e.module, validation: e.validation };
        })();
        if (!r.validation.ok) throw new Error(`validation: ${r.validation.errors.map((x) => `${x.code} ${x.path}: ${x.msg}`).join("; ")}`);
        DEV.module = r.module;
        if (live) setState({ status: "ready", module: r.module });
      } catch (err) {
        if (live) setState({ status: "error", error: String(err && err.stack ? err.stack : err) });
      }
    })();
    return () => { live = false; };
  }, [env]);
  useEffect(() => { window.__screenerDev = DEV; }, []);

  if (state.status === "loading") return <div style={box} data-testid="dev-loading">Loading the module…</div>;
  if (state.status === "error") {
    return <pre style={{ ...box, background: "#F6E1DA", color: "#8E3520", whiteSpace: "pre-wrap" }} data-testid="dev-error">{state.error}</pre>;
  }
  return (
    <SessionProvider>
      <Wired module={state.module} />
    </SessionProvider>
  );
}
