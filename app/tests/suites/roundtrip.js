// tests/suites/roundtrip.js — Download all → upload round trip (design 03 §5.8, §8.3
// `roundtrip`, §9.12). Owner: WP11.
//
// Modules exported: the built-in; an upload (the shape fixture); a verified derivation of the
// built-in with changed scoring; a second-generation derivation of that one; a derivation of
// the upload (row 6); and an entry that failed to load. Checked:
//   determinism   two exports with a fixed `now` are byte-equal; the zip reads back with every
//                 CRC verified; the manifest lists the failed entry under `failed`, without files
//   reload        a fresh registry holding only the built-ins (as after a reload) → the zip →
//                 the upload path: the built-in is "already loaded" (row 1); every other module
//                 comes back with a deep-equal rubric, identical logic bytes and SHA-256,
//                 identical hashes and classification, and identical computeScore, routingRecs
//                 (both surfaces), buildPatientSummary (every locale) and buildBundle outputs
//                 over the sweep (5k; 1k with ?quick=1)
//   derived       a re-uploaded derivation is verified (row 3): origin derived, "edited" badge,
//                 population estimates under the banner; its <id>.logic.js is the built-in's
//                 bytes and binds by SHA-256 without running, with ALLOW_JS_UPLOAD false too
//   tampering     the same zip with one weight changed by hand → Load as derived (row 4); a
//                 root record copied onto unrelated content is never a verified derivation
//   module-js     a self-contained .js module (uploaded with consent) and a derivation of it:
//                 the module file is exported once as <id>.logic.js, no sibling rubric.json,
//                 and the zip loads again with no blocking error and identical outputs
// The upload path is registry.classifyFiles + prepareUpload (WP12-M3). While those are WP12
// stubs, the suite runs the same §3.9 steps itself (unzip → pair rubric and logic → built-in
// logic recognised by SHA-256, never run → classifyLineage → bindModule → validateModule) so
// every other property is still proven, and reports the suite as waiting on WP12-M3.
import React from "react";
import { collector, guarded, loadMasque, need, waitsOn } from "../harness/kit.js";

const NOW = "2026-10-01T12:00:00.000Z";
const dec = (b) => new TextDecoder("utf-8", { fatal: true }).decode(b);
const canon = (x) => JSON.stringify(sortKeys(x));
function sortKeys(x) {
  if (Array.isArray(x)) return x.map(sortKeys);
  if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().map((k) => [k, sortKeys(x[k])]));
  return x;
}
const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** The §3.9 zip upload, run by the suite while registry.prepareUpload is a WP12 stub. */
async function localZipUpload(eng, zipBytes, entries) {
  const { zip, hash, lineage, bind, validate, contract } = eng;
  const files = await zip.unzip(zipBytes);
  const byName = new Map(files.map((f) => [f.name, f.bytes]));
  const manifest = JSON.parse(dec(byName.get("manifest.json")));
  if (manifest.format !== contract.FORMAT.export) throw new Error("not a screenAIr export");
  const loaded = entries.filter((e) => e && e.module).map((e) => e.module);
  const builtins = loaded.filter((m) => m.origin === "builtin");
  const items = [];
  for (const mm of manifest.modules) {
    const rb = byName.get(`${mm.id}/${mm.id}.rubric.json`);
    const lb = byName.get(`${mm.id}/${mm.id}.logic.js`) || null;
    const rubricText = dec(rb);
    items.push({ id: mm.id, rubric: JSON.parse(rubricText), rubricText, rubricSha256: await hash.sha256Hex(rb), logicBytes: lb, logicText: lb ? dec(lb) : null, logicSha256: lb ? await hash.sha256Hex(lb) : null });
  }
  // Plain modules first, then derivations by lineage depth, so a root in the same upload is bound first.
  const depth = (it) => (it.rubric.provenance && Array.isArray(it.rubric.provenance.lineage) ? it.rubric.provenance.lineage.length : 0);
  const order = [...items].sort((a, b) => depth(a) - depth(b));
  const out = [];
  for (const it of order) {
    let logic = null;
    if (it.logicBytes) {
      const owner = loaded.find((m) => m.hashes.logicSha256 === it.logicSha256 && m.logic);
      if (!owner) { out.push({ id: it.id, error: "the logic file is not a loaded logic: it would need consent", consentNeeded: true }); continue; }
      logic = owner.logic;                                  // recognised by SHA-256, never run
    }
    const sameUpload = items.filter((x) => x !== it).map((x) => ({ rubric: x.rubric, rubricSha256: x.rubricSha256 }));
    const classification = await lineage.classifyLineage(it.rubric, { builtins, loaded, sameUpload, logicSha256: it.logicSha256, rubricSha256: it.rubricSha256 });
    if (classification.row === 1) { out.push({ id: it.id, classification, skipped: "already loaded" }); continue; }
    if (classification.kind === "rederive") { out.push({ id: it.id, classification, rederive: true }); continue; }
    const module = await bind.bindModule(it.rubric, it.rubric.logicBinding === "generic" ? null : logic, {
      origin: classification.origin, classification, key: `upload:${it.id}`,
      sources: { rubricText: it.rubricText, logicText: it.logicText },
      files: { rubric: { name: `${it.id}.rubric.json`, text: it.rubricText, sha256: it.rubricSha256 }, logic: it.logicBytes ? { name: `${it.id}.logic.js`, text: it.logicText, sha256: it.logicSha256 } : null },
      loadedAt: NOW,
    });
    const root = classification.root && classification.root.hashes ? classification.root : null;
    const validation = await validate.validateModule({ module, loaded, root });
    loaded.push(module);
    out.push({ id: it.id, classification, module, validation, logicSha256: it.logicSha256 });
  }
  return { manifest, files, results: out };
}

/** The same through registry.classifyFiles + prepareUpload (WP12-M3). */
async function registryZipUpload(registry, env, zipBytes, entries) {
  const file = new File([zipBytes], "screenair-modules.zip", { type: "application/zip" });
  const classified = await registry.classifyFiles([file], { entries, env });
  const prepared = await registry.prepareUpload(classified, { entries, consent: false, env });
  return prepared.map((p) => {
    const m = p.entry && p.entry.module;
    const c = p.classification || (p.entry && p.entry.classification) || null;
    const errs = (p.errors || []).join("; ");
    return {
      id: m ? m.id : (c && c.root && /already loaded/i.test(errs + (c.reasons || []).join(" ")) ? c.root.id : null),
      classification: c, module: m || null, validation: p.report || (p.entry && p.entry.validation) || null,
      skipped: !m && (c && c.row === 1 || /already loaded/i.test(errs)) ? "already loaded" : null,
      rederive: !!(c && c.kind === "rederive"), errors: p.errors || [],
    };
  });
}

function drawState(rng, module) {
  const a = {};
  for (const it of module.allItems) {
    if (rng() < 0.2) continue;
    a[it.id] = Array.isArray(it.scale) ? Math.min(it.scale.length - 1, Math.floor(rng() * it.scale.length)) : (rng() < 0.5 ? "yes" : "no");
  }
  const ctx = {};
  for (const ci of module.contextItems) if (rng() >= 0.2) ctx[ci.id] = ci.options[Math.min(ci.options.length - 1, Math.floor(rng() * ci.options.length))][0];
  const rf = {};
  const x = rng();
  if (x >= 0.8 && module.redFlags.length) rf[module.redFlags[Math.min(module.redFlags.length - 1, Math.floor(rng() * module.redFlags.length))].id] = true;
  const values = module.phenotypes ? module.phenotypes.values.map((v) => v.value) : [];
  const complaint = values.length && rng() < 0.75 ? values[Math.min(values.length - 1, Math.floor(rng() * values.length))] : "";
  return { a, ctx, rf, complaint, safetyReviewed: rng() < 0.8 };
}

function outputs(eng, module, s) {
  const { scoring, rules, patient, fhir } = eng;
  const score = scoring.computeScore(module, s.a);
  const flags = rules.activeFlagsOf(module, s.rf);
  const recs = ["screener", "scribe"].map((surface) => rules.routingRecs(module, rules.buildRoutingState(module, {
    surface, answers: s.a, ctx: s.ctx, complaint: s.complaint, score, activeFlags: flags, safetyReviewed: s.safetyReviewed,
  })));
  const view = patient.projectForPatient(module);
  const summaries = view.available ? Object.keys(view.locales).map((loc) => patient.buildPatientSummary(view, loc, { a: s.a, ctx: {}, flags: s.rf })) : [];
  const bundle = fhir.buildBundle(module, { patient: module.demo.patient, answers: s.a, score, complaint: s.complaint, activeFlags: flags, routingCleared: s.safetyReviewed && !flags.length }, { surface: "screener", now: NOW });
  return JSON.stringify([score, recs, summaries, bundle]);
}

export default {
  name: "roundtrip",
  owner: "WP11",
  run: guarded("roundtrip", async (h) => {
    const c = collector(h);
    const names = ["derive.js", "exportAll.js", "zip.js", "hash.js", "lineage.js", "bind.js", "validate.js", "contract.js", "scoring.js", "rules.js", "patient.js", "fhir.js", "policy.js"];
    const mods = await Promise.all(names.map((n) => h.engine(n)));
    const eng = Object.fromEntries(names.map((n, i) => [n.replace(".js", ""), mods[i]]));
    const { derive, exportAll, zip, lineage } = eng;
    need(typeof exportAll.buildExportFiles === "function" && typeof zip.unzip === "function", "waits on WP11 exportAll.js / zip.js");
    const registry = await h.env.loader.importModule(h.appUrl("src/shell/registry.js"));
    const common = await h.env.loader.importModule(h.appUrl("src/ui/common.jsx"));
    let researchTab = null;
    try { researchTab = await h.env.loader.importModule(h.appUrl("src/apps/ResearchTab.jsx")); } catch (_) { researchTab = null; }
    const { module: M, entry: rootEntry } = await loadMasque(h);
    const fetchBytes = (p) => h.fetchBytes(p);
    const badge = (module) => {
      const { container, unmount } = h.mount(React.createElement(common.ProvenanceBadge, { module }));
      const el = container.querySelector("[data-testid=provenance-badge]");
      const t = el ? el.textContent : "";
      unmount();
      return t;
    };

    // ------------------------------------------------------------ the export set
    const shape = await h.loadFixture("shape", { builtins: [M], loaded: [M] });
    need(shape.validation.ok, "the shape fixture did not validate");
    const S = shape.module;
    const shapeEntry = { key: S.key, origin: S.origin, classification: S.classification, module: S, validation: shape.validation, files: S.files, loadedAt: NOW };
    const pos = M.rubric.domains.findIndex((d) => !d.negative);
    let d = derive.createDraft(M).rubric;
    d.domains[pos].items[0].w += 1;
    d.domains[pos].max += 1;
    const D1 = await derive.deriveAndBind(M, d, { loaded: [M, S], now: NOW, note: "roundtrip: first generation" });
    d = derive.createDraft(D1.module).rubric;
    d.locales.en.items[d.domains[pos].items[1].id].q += " (edited)";
    d.domains[pos].items[1].text += " (edited)";
    const D2 = await derive.deriveAndBind(D1.module, d, { loaded: [M, S, D1.module], now: NOW, note: "roundtrip: second generation" });
    d = derive.createDraft(S).rubric;
    d.domains[0].items[0].text += " (edited)";
    const D3 = await derive.deriveAndBind(S, d, { loaded: [M, S, D1.module, D2.module], now: NOW, note: "roundtrip: derived from an upload" });
    for (const [n, r] of [["D1", D1], ["D2", D2], ["D3", D3]]) c.check(r.validation.ok, `/setup/${n}`, null, "valid", r.validation.errors.slice(0, 3));
    c.check(D1.classification.kind === "verified" && D2.classification.kind === "verified" && D3.classification.kind === "derived-from-upload", "/setup/kinds", null, "verified, verified, derived-from-upload", [D1, D2, D3].map((r) => r.classification.kind));
    const failed = { key: "upload:broken", label: "Broken upload", origin: "uploaded", module: null, validation: { ok: false, errors: [{ code: "V1", path: "/format", msg: "Not a screenAIr file" }], warnings: [] }, files: { rubric: { name: "broken.rubric.json", text: "{}", sha256: "0".repeat(64) }, logic: null } };
    const entries = [rootEntry, shapeEntry, D1.entry, D2.entry, D3.entry, failed];
    const originals = new Map([[M.id, rootEntry], [S.id, shapeEntry], [D1.module.id, D1.entry], [D2.module.id, D2.entry], [D3.module.id, D3.entry]]);

    // ------------------------------------------------------------ determinism
    const f1 = await exportAll.buildExportFiles(entries, { appVersion: "0.4.0", now: NOW, fetchBytes });
    const f2 = await exportAll.buildExportFiles(entries, { appVersion: "0.4.0", now: NOW, fetchBytes });
    const z1 = zip.zipStore(f1), z2 = zip.zipStore(f2);
    c.check(sameBytes(z1, z2), "/determinism/zip", { now: NOW }, "byte-equal", `${z1.length} vs ${z2.length} bytes`);
    const names1 = f1.map((f) => f.name);
    c.check(canon(names1) === canon([...names1].sort()), "/determinism/sorted", null, "sorted names", names1.slice(0, 5));
    const back = await zip.unzip(z1);
    c.check(back.length === f1.length && back.every((b, i) => b.name === f1[i].name && sameBytes(b.bytes, f1[i].bytes)), "/determinism/unzip", null, "every entry back, CRC verified", back.length);
    const manifest = JSON.parse(dec(back.find((x) => x.name === "manifest.json").bytes));
    c.check(manifest.format === "screenair-export" && manifest.formatVersion === 1 && manifest.caveat === eng.policy.CAVEATS.prototype && manifest.generatedAt === NOW, "/manifest/header", null, "screenair-export v1", manifest);
    c.check(manifest.modules.length === 5 && manifest.failed.length === 1 && manifest.failed[0].key === failed.key, "/manifest/failed", null, "5 modules, 1 failed", [manifest.modules.length, manifest.failed]);
    c.check(canon(manifest.failed[0].files) === canon({ "broken.rubric.json": "0".repeat(64) }) && !back.some((x) => x.name.startsWith("broken")), "/manifest/failed/no-files", null, "listed with its SHA-256, no file in the zip", manifest.failed[0]);
    for (const mm of manifest.modules) {
      for (const [name, sha] of Object.entries(mm.files)) {
        const f = back.find((x) => x.name === name);
        c.check(f && (await h.sha256(f.bytes)) === sha, `/manifest/sha/${name}`, null, sha, f ? "differs" : "missing");
      }
      c.check(mm.versions && "probeSet" in mm.versions && "goldSet" in mm.versions && "goldSetLexicon" in mm.versions, `/manifest/versions/${mm.id}`, null, "five separate axes", mm.versions);
    }
    const rootFiles = back.filter((x) => x.name.startsWith(`${M.id}/`)).map((x) => x.name);
    c.check(rootFiles.includes(`${M.id}/SOURCES.md`) && rootFiles.some((n) => n.startsWith(`${M.id}/research/`)) && rootFiles.includes(`${M.id}/${M.id}.logic.js`), "/zip/builtin-files", null, "docs, research, logic", rootFiles.slice(0, 8));
    c.check(!back.some((x) => x.name.startsWith(`${D1.module.id}/research/`)) && back.some((x) => x.name === `${D1.module.id}/CHANGELOG.md`), "/zip/derived-files", null, "change log, no research copy", null);
    c.check(!back.some((x) => x.name === `${S.id}/${S.id}.logic.js`), "/zip/generic-no-logic", null, "no logic file for a data-only module", null);
    const readme = dec(back.find((x) => x.name === "README.txt").bytes);
    c.check(readme.includes(eng.policy.CAVEATS.prototype) && readme.includes("0.4.0") && readme.includes(NOW), "/zip/readme", null, "caveat, release, generatedAt", readme.slice(0, 120));

    // ------------------------------------------------------------ reload + upload
    const fresh = await registry.loadBuiltins({ env: h.env });
    need(fresh.some((e) => e.module && e.module.id === M.id), "a fresh registry did not load the built-in");
    let viaRegistry = true, results, registryWait = null;
    try {
      results = await registryZipUpload(registry, h.env, z1, fresh);
    } catch (err) {
      if (!waitsOn(err)) throw err;
      viaRegistry = false;
      registryWait = waitsOn(err);
      results = (await localZipUpload(eng, z1, fresh)).results;
    }
    const byId = new Map(results.filter((r) => r.id).map((r) => [r.id, r]));
    const rootBack = byId.get(M.id);
    c.check(rootBack && rootBack.skipped === "already loaded", "/reload/builtin-duplicate", null, "already loaded (row 1)", rootBack && (rootBack.classification || rootBack.errors));
    const quick = !!h.quick;
    const N = quick ? 1000 : 5000;
    const rng = h.rng(h.seed);
    let sweeps = 0;
    for (const [id, orig] of originals) {
      if (id === M.id) continue;
      const r = byId.get(id);
      if (!c.check(r && r.module, `/reload/${id}/loaded`, null, "loaded again", r ? (r.errors || r.classification) : "missing")) continue;
      const a = orig.module, b = r.module;
      c.check(r.validation && r.validation.ok, `/reload/${id}/valid`, null, "0 errors", r.validation && r.validation.errors.slice(0, 3));
      c.check(canon(a.rubric) === canon(b.rubric), `/reload/${id}/rubric`, null, "deep-equal", eng.derive.diffRubrics(a.rubric, b.rubric).slice(0, 3));
      for (const k of ["rubricSha256", "logicSha256", "instrumentHash", "scoringHash", "lexiconHash", "contentHash"]) {
        c.check(a.hashes[k] === b.hashes[k], `/reload/${id}/hashes/${k}`, null, a.hashes[k], b.hashes[k]);
      }
      const ca = a.classification, cb = b.classification;
      c.check(ca.kind === cb.kind && ca.row === cb.row && ca.origin === cb.origin && a.origin === b.origin, `/reload/${id}/classification`, null, [ca.kind, ca.row, a.origin], [cb.kind, cb.row, b.origin]);
      if (a.hashes.logicSha256) {
        const lf = back.find((x) => x.name === `${id}/${id}.logic.js`);
        const origText = (orig.files && orig.files.logic && orig.files.logic.text) || a.sources.logicText;
        c.check(lf && sameBytes(lf.bytes, new TextEncoder().encode(origText)) && (await h.sha256(lf.bytes)) === a.hashes.logicSha256, `/reload/${id}/logic-bytes`, null, "the bytes as loaded", null);
        c.check(lf && (await h.sha256(lf.bytes)) === M.hashes.logicSha256, `/reload/${id}/logic-is-builtin`, null, "the built-in logic's SHA-256", null);
      }
      let mism = 0, first = null;
      for (let i = 0; i < N; i++) {
        const s = drawState(rng, a);
        const oa = outputs(eng, a, s), ob = outputs(eng, b, s);
        if (oa !== ob) { mism += 1; if (!first) first = s; }
        if (i % 500 === 499) await new Promise((res) => setTimeout(res, 0));
      }
      sweeps += N;
      c.check(mism === 0, `/reload/${id}/outputs`, first, "identical computeScore, routingRecs, buildPatientSummary, buildBundle", `${mism}/${N} differ`);
    }
    // The re-uploaded derivation: verified, badge, population banner.
    const d1b = byId.get(D1.module.id);
    if (d1b && d1b.module) {
      const m = d1b.module;
      c.check(m.origin === "derived" && m.classification.kind === "verified" && m.classification.row === 3, "/derived/verified", null, "row 3", m.classification);
      c.check(badge(m) === "edited · scoring changed", "/derived/badge", null, "edited · scoring changed", badge(m));
      c.check(lineage.availability(m).research.population === true, "/derived/population", null, true, lineage.availability(m).research);
      if (researchTab && typeof researchTab.populationGate === "function") {
        const g = researchTab.populationGate(m);
        c.check(g.show === true && g.kind === "verified" && !!g.rootName, "/derived/population-banner", null, "shown under the banner", g);
      } else c.note("apps/ResearchTab.jsx populationGate not available: the banner is checked through availability() only");
      c.check(m.logic === fresh.find((e) => e.module && e.module.id === M.id).module.logic, "/derived/logic-object", null, "the loaded built-in logic object (not the uploaded bytes)", "another object");
    }
    // ALLOW_JS_UPLOAD = false: the built-in logic is still recognised by SHA-256.
    {
      const SITE = eng.policy.SITE;
      const prev = SITE.ALLOW_JS_UPLOAD;
      SITE.ALLOW_JS_UPLOAD = false;
      try {
        const fresh2 = await registry.loadBuiltins({ env: h.env });
        let rs;
        try { rs = await registryZipUpload(registry, h.env, z1, fresh2); }
        catch (err) { if (!waitsOn(err)) throw err; rs = (await localZipUpload(eng, z1, fresh2)).results; }
        const r = rs.find((x) => x.id === D1.module.id);
        c.check(r && r.module && r.validation && r.validation.ok && !r.consentNeeded, "/derived/no-js-upload", null, "binds by SHA-256 with ALLOW_JS_UPLOAD false", r && (r.errors || r.error));
      } finally {
        SITE.ALLOW_JS_UPLOAD = prev;
      }
    }

    // ------------------------------------------------------------ tampering
    {
      const files = back.map((f) => ({ name: f.name, bytes: f.bytes }));
      const name = `${D1.module.id}/${D1.module.id}.rubric.json`;
      const i = files.findIndex((f) => f.name === name);
      const rub = JSON.parse(dec(files[i].bytes));
      rub.domains[pos].items[2].w += 1;
      rub.domains[pos].max += 1;
      files[i] = { name, bytes: new TextEncoder().encode(eng.bind.serializeRubric(rub)) };
      const zt = zip.zipStore(files);
      const fresh3 = await registry.loadBuiltins({ env: h.env });
      let rs;
      try { rs = await registryZipUpload(registry, h.env, zt, fresh3); }
      catch (err) { if (!waitsOn(err)) throw err; rs = (await localZipUpload(eng, zt, fresh3)).results; }
      const r = rs.find((x) => (x.id === D1.module.id) || (x.classification && x.classification.kind === "rederive"));
      c.check(r && r.classification && r.classification.kind === "rederive" && r.classification.row === 4, "/tamper/weight/row4", null, "Load as derived (row 4)", r && r.classification);
      c.check(r && r.classification && /contentHash/.test(r.classification.reasons.join(" ")), "/tamper/weight/reason", null, "names the failed check", r && r.classification && r.classification.reasons);
      // A root record copied onto unrelated content.
      const forged = JSON.parse(JSON.stringify(S.rubric));
      forged.id = "forged-upload";
      forged.label = "Forged upload";
      forged.provenance = JSON.parse(JSON.stringify(D1.rubric.provenance));
      const builtins3 = fresh3.filter((e) => e.module).map((e) => e.module);
      const cl = await lineage.classifyLineage(forged, { builtins: builtins3, loaded: builtins3, sameUpload: [] });
      c.check(cl.kind !== "verified" && cl.origin !== "derived", "/tamper/forged-root", null, "never a verified derivation", cl);
    }

    // ------------------------------------------------------------ a self-contained module
    // A .js module (format "screenair-module", rubric and logic in one file) uploaded with
    // consent, and a derivation of it. Download all writes the module file once, byte for
    // byte, as <id>/<id>.logic.js with no sibling <id>.rubric.json (a readable copy goes to
    // generated/), so the zip loads again: no blocking error, the same rubric, hashes, logic
    // bytes and outputs.
    if (viaRegistry) {
      const freshA = await registry.loadBuiltins({ env: h.env });
      const modText = await h.fixture("modules/upload-module.module.txt", "text");
      const enc = new TextEncoder();
      const up = async (files, list) => registry.prepareUpload(await registry.classifyFiles(files, { entries: list, env: h.env }), { entries: list, consent: true, env: h.env });
      const first = await up([{ name: "shape-module.js", bytes: enc.encode(modText) }], freshA);
      const modEntry = first.find((r) => r.entry) ? first.find((r) => r.entry).entry : null;
      if (c.check(!!modEntry && modEntry.validation.ok, "/module-js/setup", null, "the fixture module loads", first.map((r) => r.errors))) {
        const MM = modEntry.module;
        let dm = derive.createDraft(MM).rubric;
        dm.domains[0].items[0].text += " (edited)";
        const D4 = await derive.deriveAndBind(MM, dm, { loaded: [...freshA.filter((e) => e.module).map((e) => e.module), MM], now: NOW, note: "roundtrip: derived from a self-contained module" });
        c.check(D4.validation.ok, "/module-js/setup/derived", null, "valid", D4.validation.errors.slice(0, 3));
        const builtinA = freshA.find((e) => e.module && e.module.id === M.id);
        const fz = await exportAll.buildExportFiles([builtinA, modEntry, D4.entry], { appVersion: "0.4.0", now: NOW, fetchBytes });
        const fzNames = fz.map((f) => f.name);
        const lf = fz.find((f) => f.name === `${MM.id}/${MM.id}.logic.js`);
        c.check(lf && dec(lf.bytes) === modText && (await h.sha256(lf.bytes)) === MM.hashes.logicSha256, "/module-js/export/logic-bytes", null, "the module file, byte for byte", lf ? "differs" : "missing");
        c.check(!fzNames.includes(`${MM.id}/${MM.id}.rubric.json`) && fzNames.includes(`${MM.id}/generated/${MM.id}.rubric.json`), "/module-js/export/no-sibling-rubric", null, "rubric only as a generated copy", fzNames.filter((n) => n.startsWith(`${MM.id}/`)));
        const mf = JSON.parse(dec(fz.find((f) => f.name === "manifest.json").bytes));
        c.check(mf.modules.find((x) => x.id === MM.id).selfContained === true && !mf.modules.find((x) => x.id === D4.module.id).selfContained, "/module-js/export/manifest", null, "selfContained on the module only", mf.modules.map((x) => [x.id, x.selfContained]));
        const zm = zip.zipStore(fz);
        const freshB = await registry.loadBuiltins({ env: h.env });
        const back2 = await up([new File([zm], "screenair-modules.zip", { type: "application/zip" })], freshB);
        const blocking = back2.filter((r) => !r.entry && !r.skipped && r.errors.length);
        c.check(blocking.length === 0, "/module-js/reload/no-blocking", null, "every module file loads or is skipped", blocking.map((r) => [r.file, r.errors]));
        for (const orig of [MM, D4.module]) {
          const r = back2.find((x) => x.entry && x.entry.module.id === orig.id);
          if (!c.check(!!r, `/module-js/reload/${orig.id}/loaded`, null, "loaded again", back2.map((x) => [x.file, x.errors]))) continue;
          const b = r.entry.module;
          c.check(r.entry.validation.ok, `/module-js/reload/${orig.id}/valid`, null, "0 errors", r.entry.validation.errors.slice(0, 3));
          c.check(canon(orig.rubric) === canon(b.rubric), `/module-js/reload/${orig.id}/rubric`, null, "deep-equal", eng.derive.diffRubrics(orig.rubric, b.rubric).slice(0, 3));
          for (const k of ["rubricSha256", "logicSha256", "instrumentHash", "scoringHash", "lexiconHash", "contentHash"]) {
            c.check(orig.hashes[k] === b.hashes[k], `/module-js/reload/${orig.id}/hashes/${k}`, null, orig.hashes[k], b.hashes[k]);
          }
          c.check(orig.classification.kind === b.classification.kind && orig.origin === b.origin, `/module-js/reload/${orig.id}/classification`, null, [orig.classification.kind, orig.origin], [b.classification.kind, b.origin]);
          let mism = 0, firstS = null;
          const n = Math.max(200, Math.floor(N / 5));
          for (let i = 0; i < n; i++) {
            const st = drawState(rng, orig);
            if (outputs(eng, orig, st) !== outputs(eng, b, st)) { mism += 1; if (!firstS) firstS = st; }
          }
          sweeps += n;
          c.check(mism === 0, `/module-js/reload/${orig.id}/outputs`, firstS, "identical outputs", `${mism}/${n} differ`);
        }
      }
    } else c.note("self-contained module round trip: skipped while registry.prepareUpload is a WP12-M3 stub");

    c.note(`upload path: ${viaRegistry ? "registry.classifyFiles + prepareUpload (WP12-M3)" : "the suite's own §3.9 steps (registry.prepareUpload is still a WP12-M3 stub)"}`);
    c.note(`zip ${z1.length} bytes, ${f1.length} files; output sweep ${sweeps} states over ${originals.size - 1} modules`);
    const res = c.result();
    if (!viaRegistry && res.verdict === "pass") {
      return { ...res, verdict: "fail", notes: [...res.notes, `every check passed through the suite's own upload path; the final check waits on WP12-M3: ${registryWait}`] };
    }
    return res;
  }),
};
