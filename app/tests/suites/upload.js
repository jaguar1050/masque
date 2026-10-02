// tests/suites/upload.js — the upload path, model level (design 03 §8.3 `upload`, §3.9, §3.11,
// §5.2, §7.4). Owner: WP12. The dialog itself is driven by tests/playwright/specs/upload.mjs.
//
// Every file goes through shell/registry.js exactly as the dialog sends it: classifyFiles
// (bytes, limits, UTF-8, SHA-256, kind; nothing runs) → prepareUpload (consented import,
// pairing, classifyLineage, bindModule, validateModule). Fixture text that holds an import is
// fetched from tests/fixtures/modules/*.txt, never inlined (§8.0).
//
//   rejections   import, dynamic import, re-export, JSX, a syntax error (line:col), no default
//                export, logic alone, needs logic, reserved logic id, duplicate id, a built-in
//                label, V38 caveat, V9 template, V46 throwing closure, V47 undeclared read, V48
//                non-deterministic closure, invalid UTF-8, oversize, zip CRC / traversal / ZIP64,
//                .xlsx and .csv, V37 population on a plain upload, not JSON, newer contract,
//                not a screenAIr file
//   derived      the built-in rubric with three weights changed (reserved id, row 2) and with
//                only the id changed (kin, row 5) are offered "Load as derived"; through
//                derive.js the result is a verified derivation whose instrument version carries
//                "-local"; a forged provenance block is never verified
//   acceptances  the shape JSON (generic), a verified derivation's JSON (logicBinding + SHA),
//                a screenair-module .js, a zip of modules, identical-bytes dedupe; each with
//                its availability summary
//   consent      inspectSource classifies a .js whose top level would set a global while the
//                global stays unset; the V59 API list is read before anything runs; JS needs
//                consent; with ALLOW_JS_UPLOAD off, JS is refused except recognised built-in
//                logic, which binds by SHA-256 without running
//   inert        injected markup renders as text
//   saved        remember / list / restore re-verifies the stored rubric; a hand-edited stored
//                rubric does not restore as the derivation
import React from "react";
import { collector, guarded, loadMasque, need } from "../harness/kit.js";
import { derivedFixture, bumpFirstWeight } from "../harness/derivation.js";

const enc = new TextEncoder();
const FIX = "modules/";

export default {
  name: "upload",
  owner: "WP12",
  run: guarded("upload", async (h) => {
    const { module: masque, entry: masqueEntry, validation } = await loadMasque(h);
    need(validation && validation.ok, "the built-in module did not validate (waits on WP1-WP3)");
    const reg = await h.env.loader.importModule(h.appUrl("src/shell/registry.js"));
    need(typeof reg.prepareUpload === "function" && typeof reg.classifyFiles === "function", "waits on WP12-M3: registry upload functions");
    const chrome = await h.env.loader.importModule(h.appUrl("src/shell/chrome.jsx"));
    const policy = await h.engine("policy.js");
    const bind = await h.engine("bind.js");
    const c = collector(h);
    const entries = [masqueEntry];
    const builtinLogicId = masque.logic.moduleId;

    const file = (name, data) => ({ name, bytes: typeof data === "string" ? enc.encode(data) : data });
    const fx = async (name, as = "text") => h.fixture(FIX + name, as);
    async function upload(files, { consent = true, list = entries } = {}) {
      const cl = await reg.classifyFiles(files, { entries: list, env: h.env });
      const res = await reg.prepareUpload(cl, { entries: list, consent, env: h.env });
      return { cl, res };
    }
    const errorsOf = (res) => res.flatMap((r) => [...r.errors, ...(r.report ? r.report.errors.map((e) => `${e.code} ${e.path} ${e.msg}`) : [])]);
    const summary = (res) => res.map((r) => ({ file: r.file, ok: !!r.entry, skipped: r.skipped, errors: errorsOf(r ? [r] : []).slice(0, 4) }));
    function rejects(label, res, re) {
      const errs = errorsOf(res);
      c.check(res.length > 0 && res.every((r) => !r.entry) && errs.some((e) => re.test(e)), `/reject/${label}`, null, String(re), summary(res));
    }
    function accepts(label, res, { origin = null } = {}) {
      const ok = res.filter((r) => r.entry);
      const bad = res.filter((r) => !r.entry && !r.skipped);
      if (!c.check(ok.length > 0 && bad.length === 0, `/accept/${label}`, null, "every module validates", summary(res))) return null;
      for (const r of ok) {
        if (origin) c.check(r.entry.origin === origin, `/accept/${label}/origin`, null, origin, r.entry.origin);
        const av = chrome.availabilityText(r.entry.module);
        c.check(/^Clinician Screener ✓ · Ambient Scribe/.test(av) && /Patient Companion/.test(av) && /Research/.test(av), `/accept/${label}/availability`, null, "availability summary", av);
      }
      return ok[0].entry;
    }

    const shapeText = await fx("shape.rubric.json");
    const shapeBound = await fx("shape-bound.rubric.json");
    const shapeLogic = await fx("shape.logic.js");

    // ------------------------------------------------------------------ rejections
    const logicPair = async (label, fixture, re) => {
      const { res } = await upload([file("shape-bound.rubric.json", shapeBound), file(`${label}.logic.js`, await fx(fixture))]);
      rejects(label, res, re);
    };
    await logicPair("import", "upload-import.logic.txt", /imports other files \(line \d+\): logic files must be self-contained/);
    await logicPair("dynamic-import", "upload-dynamic-import.logic.txt", /imports other files \(line \d+\)/);
    await logicPair("reexport", "upload-reexport.logic.txt", /imports other files \(line \d+\)/);
    await logicPair("jsx", "upload-jsx.logic.txt", /jsx\.logic\.js line \d+:\d+: /);
    await logicPair("syntax", "upload-syntax.logic.txt", /syntax\.logic\.js line 4:\d+: /);
    await logicPair("no-default", "upload-no-default.logic.txt", /has no default export/);
    rejects("logic-alone", (await upload([file("shape.logic.js", shapeLogic)])).res, /^Logic file without a rubric: select the rubric JSON together with it$/);
    rejects("needs-logic", (await upload([file("shape-bound.rubric.json", shapeBound)])).res, /^Needs the logic file for 'shape'$/);
    rejects("reserved-logic", (await upload([file("shape-bound.rubric.json", shapeBound), file("x.logic.js", await fx("upload-reserved-logic.logic.txt"))])).res,
      new RegExp(`^Logic id '${builtinLogicId}' is reserved for the built-in logic$`));
    rejects("builtin-label", (await upload([file("label.rubric.json", await fx("upload-builtin-label.rubric.json"))])).res, /V8 \/label Label '.*' belongs to a built-in module/);
    rejects("v38-caveat", (await upload([file("v38.rubric.json", await fx("upload-v38-caveat.rubric.json"))])).res, /^V38 /);
    rejects("v9-template", (await upload([file("v9.rubric.json", await fx("upload-v9-template.rubric.json"))])).res, /^V9 /);
    rejects("v37-population", (await upload([file("v37.rubric.json", await fx("upload-v37-population.rubric.json"))])).res, /^V37 /);
    await logicPair("v46-throwing", "upload-throwing.logic.txt", /^V46 /);
    await logicPair("v47-undeclared-read", "upload-undeclared-read.logic.txt", /^V47 /);
    await logicPair("v48-nondeterministic", "upload-nondeterministic.logic.txt", /^V48 /);
    rejects("invalid-utf8", (await upload([file("bad.json", await fx("upload-invalid-utf8.json.bin", "bytes"))])).res, /^Not valid UTF-8$/);
    rejects("oversize", (await upload([file("big.json", new Uint8Array(policy.LIMITS.rubricBytes + 1))])).res, new RegExp(`^Too large \\(${policy.LIMITS.rubricBytes + 1} > ${policy.LIMITS.rubricBytes}\\)$`));
    rejects("oversize-js", (await upload([file("big.logic.js", new Uint8Array(policy.LIMITS.logicBytes + 1))])).res, /^Too large/);
    rejects("not-json", (await upload([file("x.json", await fx("upload-not-json.json.txt"))])).res, /^Not valid JSON: /);
    rejects("newer-contract", (await upload([file("x.json", await fx("upload-newer-contract.rubric.json"))])).res, /^Made for a newer screenAIr/);
    rejects("not-screenair", (await upload([file("x.json", await fx("upload-not-screenair.json"))])).res, /^Not a screenAIr file$/);
    rejects("unknown-ext", (await upload([file("notes.txt", "hello")])).res, /^Not a screenAIr file$/);
    const SHEET = /^Spreadsheets and documents are not supported\. Download the current module's rubric \(\.json\) and edit its weights, or use the Rubric Editor\.$/;
    rejects("xlsx", (await upload([file("sheet.xlsx", await fx("upload-sheet.xlsx", "bytes"))])).res, SHEET);
    rejects("csv", (await upload([file("sheet.csv", await fx("upload-sheet.csv", "bytes"))])).res, SHEET);
    rejects("zip-crc", (await upload([file("crc.zip", await fx("upload-crc-error.zip", "bytes"))])).res, /CRC/);
    rejects("zip-traversal", (await upload([file("trav.zip", await fx("upload-traversal.zip", "bytes"))])).res, /not allowed|\.\./);
    rejects("zip64", (await upload([file("z64.zip", await fx("upload-zip64.zip", "bytes"))])).res, /ZIP64/);
    rejects("too-many", (await upload(Array.from({ length: policy.LIMITS.uploadFiles + 1 }, (_, i) => file(`m${i}.rubric.json`, shapeText)))).res, /^Too many files/);

    // Duplicate id: a loaded module's id with other bytes.
    const shapeEntry = accepts("shape", (await upload([file("shape.rubric.json", shapeText)])).res, { origin: "uploaded" });
    if (shapeEntry) {
      c.check(shapeEntry.module.rubric.logicBinding === "generic" && shapeEntry.jsonOnly === true, "/accept/shape/generic", null, "generic logic", shapeEntry.module.rubric.logicBinding);
      c.check(chrome.availabilityText(shapeEntry.module).includes("Ambient Scribe: no voice capture (no lexicon)"), "/accept/shape/availability-text", null, "Ambient Scribe: no voice capture (no lexicon)", chrome.availabilityText(shapeEntry.module));
      const withShape = [masqueEntry, shapeEntry];
      const other = JSON.parse(shapeText);
      other.label = "Shape fixture, second copy";
      rejects("duplicate-id", (await upload([file("shape2.rubric.json", JSON.stringify(other, null, 2))], { list: withShape })).res, /V8 \/id Module id 'shape' is already loaded/);
      // Identical bytes: skipped as already loaded.
      const dup = (await upload([file("shape.rubric.json", shapeText)], { list: withShape })).res;
      c.check(dup.length === 1 && !dup[0].entry && /^already loaded/.test(dup[0].skipped || ""), "/dedupe/shape", null, "already loaded", summary(dup));
    }
    // Identical bytes of the built-in (rubric + logic): skipped, the logic not run.
    {
      const rubricBytes = enc.encode(masque.sources.rubricText);
      const logicBytes = enc.encode(masque.sources.logicText);
      const { cl, res } = await upload([file("m.rubric.json", rubricBytes), file("m.logic.js", logicBytes)], { consent: false });
      const lg = cl.find((x) => x.name === "m.logic.js");
      c.check(lg && lg.kind === "builtin-logic" && lg.needsConsent === false, "/builtin-logic/classified", null, "built-in logic (not run)", lg && { kind: lg.kind, needsConsent: lg.needsConsent });
      c.check(res.length === 1 && /^already loaded/.test(res[0].skipped || ""), "/dedupe/builtin", null, "already loaded", summary(res));
    }

    // ------------------------------------------------------------------ before consent
    {
      delete globalThis.__uploadFixtureSideEffect;
      const text = await fx("upload-global-side-effect.logic.txt");
      const { cl } = await upload([file("side.logic.js", text)], { consent: false });
      const x = cl[0];
      c.check(x.kind === "logic" && x.needsConsent === true, "/consent/inspect-kind", null, "logic, needs consent", { kind: x.kind, needsConsent: x.needsConsent, error: x.error });
      const refs = (x.inspect && x.inspect.apiRefs) || [];
      c.check(["window", "globalThis", "localStorage"].every((k) => refs.includes(k)), "/consent/apiRefs", null, ["window", "globalThis", "localStorage"], refs);
      c.check(globalThis.__uploadFixtureSideEffect === undefined, "/consent/not-run-by-inspect", null, undefined, globalThis.__uploadFixtureSideEffect);
      const res = await reg.prepareUpload(cl, { entries, consent: false, env: h.env });
      c.check(errorsOf(res).some((e) => /consent is required/.test(e)), "/consent/required", null, "consent is required", summary(res));
      c.check(globalThis.__uploadFixtureSideEffect === undefined, "/consent/not-run-without-consent", null, undefined, globalThis.__uploadFixtureSideEffect);
      const computed = (await upload([file("computed.logic.js", await fx("upload-computed-format.logic.txt"))], { consent: false })).cl[0];
      c.check(computed.kind === "executable" && /determined after consent/.test(computed.kindLabel), "/consent/computed-format", null, "executable (kind determined after consent)", { kind: computed.kind, label: computed.kindLabel });
      delete globalThis.__uploadFixtureSideEffect;
    }

    // ------------------------------------------------------------------ acceptances
    // A self-contained module (.js) with consent.
    const modEntry = accepts("module-js", (await upload([file("shape-module.js", await fx("upload-module.module.txt"))])).res, { origin: "uploaded" });
    if (modEntry) c.check(modEntry.module.id === "shape-module" && modEntry.files.logic && modEntry.files.logic.name === "shape-module.js", "/accept/module-js/files", null, "shape-module with its file", modEntry.files.logic);
    // Logic + rubric pair with consent.
    accepts("logic-pair", (await upload([file("shape-bound.rubric.json", shapeBound), file("shape.logic.js", shapeLogic)])).res, { origin: "uploaded" });
    // A verified derivation's JSON: binds the built-in logic by moduleId + SHA, no logic file.
    const derived = await derivedFixture(h, masque, { mutate: bumpFirstWeight, id: `local-${masque.id}-upload-suite` });
    c.check(derived.validation.ok, "/fixture/derived", null, "the harness derivation validates", derived.validation.errors.slice(0, 3));
    const derivedText = bind.serializeRubric(derived.rubric);
    const dEntry = accepts("derived-json", (await upload([file("derived.rubric.json", derivedText)], { consent: false })).res, { origin: "derived" });
    if (dEntry) {
      c.check(dEntry.classification.kind === "verified" && dEntry.classification.row === 3, "/accept/derived-json/verified", null, "verified (row 3)", dEntry.classification && { kind: dEntry.classification.kind, row: dEntry.classification.row });
      c.check(dEntry.module.logic === masque.logic, "/accept/derived-json/logic", null, "the loaded built-in logic object", "another logic");
      c.check(dEntry.jsonOnly === true, "/accept/derived-json/json-only", null, true, dEntry.jsonOnly);
    }
    // A zip of modules: the derivation with the built-in's logic bytes binds without consent,
    // also with ALLOW_JS_UPLOAD off.
    {
      const zip = await h.engine("zip.js");
      let zipped = null;
      try {
        const manifest = { format: "screenair-export", formatVersion: 1, modules: [], failed: [] };
        zipped = zip.zipStore([
          { name: "manifest.json", bytes: enc.encode(JSON.stringify(manifest)) },
          { name: `${derived.rubric.id}/${derived.rubric.id}.rubric.json`, bytes: enc.encode(derivedText) },
          { name: `${derived.rubric.id}/${derived.rubric.id}.logic.js`, bytes: enc.encode(masque.sources.logicText) },
          { name: "shape/shape.rubric.json", bytes: enc.encode(shapeText) },
          { name: "shape/README.md", bytes: enc.encode("Example") },
        ]);
      } catch (err) {
        c.check(false, "/zip/build", null, "zipStore (WP11)", String(err.message));
      }
      if (zipped) {
        const allow = policy.SITE.ALLOW_JS_UPLOAD;
        try {
          policy.SITE.ALLOW_JS_UPLOAD = false;
          const { cl, res } = await upload([file("modules.zip", zipped)], { consent: false });
          c.check(cl.some((x) => x.kind === "builtin-logic"), "/zip/builtin-logic", null, "built-in logic recognised inside the zip", cl.map((x) => [x.name, x.kind, x.error]));
          const ok = res.filter((r) => r.entry);
          c.check(ok.length === 2 && res.every((r) => r.entry || r.skipped), "/zip/accept", null, "derived + shape", summary(res));
          const d = ok.find((r) => r.entry.module.id === derived.rubric.id);
          c.check(!!d && d.entry.classification.kind === "verified" && d.entry.module.logic === masque.logic, "/zip/derived-verified", null, "verified, bound to the built-in logic", d && d.entry.classification);
          // JS that is not built-in logic is refused while the switch is off.
          const off = await upload([file("shape-bound.rubric.json", shapeBound), file("shape.logic.js", shapeLogic)]);
          rejects("js-disabled", off.res, /^JavaScript modules are disabled on this site; upload a JSON rubric$/);
        } finally {
          policy.SITE.ALLOW_JS_UPLOAD = allow;
        }
        // A zip without a screenAIr manifest is not a screenAIr file.
        const bare = zip.zipStore([{ name: "shape/shape.rubric.json", bytes: enc.encode(shapeText) }]);
        rejects("zip-no-manifest", (await upload([file("bare.zip", bare)])).res, /^Not a screenAIr file/);
      }
    }

    // ------------------------------------------------------------------ Load as derived
    const masqueRubric = JSON.parse(masque.sources.rubricText);
    const threeWeights = JSON.parse(JSON.stringify(masqueRubric));
    {
      const d = threeWeights.domains.find((x) => !x.negative && x.items.length >= 3 && x.items.every((it) => Math.abs(it.w) >= 3));
      need(!!d, "no domain with three items to edit");
      d.items[0].w += 1; d.items[1].w += 1; d.items[2].w -= 2;   // Σw (and the domain max) unchanged
    }
    const rowOf = (res) => res[0] && res[0].rederive ? { root: res[0].rederive.root && res[0].rederive.root.id, row: res[0].classification && res[0].classification.row } : summary(res);
    const tw = (await upload([file(`${masque.id}.rubric.json`, JSON.stringify(threeWeights, null, 2))])).res;
    c.check(tw.length === 1 && !tw[0].entry && tw[0].rederive && tw[0].rederive.root === masque && tw[0].classification.row === 2, "/derive/reserved-id", null, { root: masque.id, row: 2 }, rowOf(tw));
    c.check(tw[0] && tw[0].errors.some((e) => e.startsWith(`Module id '${masque.id}' is reserved for the built-in module`)), "/derive/reserved-id/message", null, "Module id … is reserved for the built-in module", tw[0] && tw[0].errors);
    const idOnly = JSON.parse(JSON.stringify(masqueRubric));
    idOnly.id = "local-copy";
    const io = (await upload([file("copy.rubric.json", JSON.stringify(idOnly, null, 2))])).res;
    c.check(io.length === 1 && !io[0].entry && io[0].rederive && io[0].rederive.root === masque && io[0].classification.row === 5, "/derive/kin", null, { root: masque.id, row: 5 }, rowOf(io));
    // Forged provenance: a root record copied onto other content is never verified.
    {
      const forged = JSON.parse(JSON.stringify(threeWeights));
      forged.id = "local-forged";
      forged.label = "Forged example";
      forged.provenance = JSON.parse(JSON.stringify(derived.rubric.provenance));
      const fr = (await upload([file("forged.rubric.json", JSON.stringify(forged, null, 2))])).res;
      c.check(fr.length === 1 && !(fr[0].entry && fr[0].entry.classification.kind === "verified"), "/derive/forged", null, "not verified", summary(fr));
      const forgedShape = JSON.parse(shapeText);
      forgedShape.id = "shape-forged";
      forgedShape.label = "Shape with a forged root";
      forgedShape.provenance = JSON.parse(JSON.stringify(derived.rubric.provenance));
      const fs = (await upload([file("shape-forged.rubric.json", JSON.stringify(forgedShape, null, 2))])).res;
      c.check(fs.length === 1 && !(fs[0].entry && fs[0].entry.classification.kind === "verified"), "/derive/forged-shape", null, "not verified", summary(fs));
    }
    // Through derive.js (WP11): Load as derived gives a verified derivation with a -local version.
    try {
      const derive = await h.engine("derive.js");
      const root = masque;
      const changes = await derive.classifyChanges(root, threeWeights, { root });
      const ident = derive.proposeIdentity(root, threeWeights, changes, [masque], { now: "2026-10-02T12:00:00.000Z" });
      const rubric = await derive.deriveRubric(root, threeWeights, {
        root, id: ident.id, label: ident.label, instrumentVersion: ident.instrumentVersion, lexiconVersion: ident.lexiconVersion,
        note: "upload suite: three weights changed by hand", acknowledged: [...(changes.needsAcknowledgement || []), ...(changes.staleRedFlagPaths || [])],
        now: "2026-10-02T12:00:00.000Z", source: { name: `${masque.id}.rubric.json`, sha256: await h.sha256(enc.encode(JSON.stringify(threeWeights, null, 2))) },
      });
      const r = await reg.prepareRubric(rubric, { entries, env: h.env });
      c.check(!!r.entry && r.entry.classification.kind === "verified", "/derive/load-as-derived/verified", null, "verified derivation", summary([r]));
      c.check(/-local/.test(rubric.instrumentVersion), "/derive/load-as-derived/-local", null, "-local tag", rubric.instrumentVersion);
      const io2 = await derive.deriveRubric(root, idOnly, {
        root, id: "local-copy-derived", label: `${root.label} — copy`, instrumentVersion: root.instrumentVersion,
        lexiconVersion: root.lexicon ? root.lexicon.version : null, note: "upload suite: id changed only", acknowledged: [], now: "2026-10-02T12:00:00.000Z",
        source: { name: "copy.rubric.json", sha256: "0".repeat(64) },
      });
      const r2 = await reg.prepareRubric(io2, { entries, env: h.env });
      c.check(!!r2.entry && r2.entry.classification.kind === "verified", "/derive/kin/verified", null, "verified derivation", summary([r2]));
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      c.check(false, "/derive/load-as-derived", null, "derive.js classifyChanges / proposeIdentity / deriveRubric", /not implemented: WP11/.test(msg) ? `waits on WP11 (${msg})` : msg);
    }

    // ------------------------------------------------------------------ inert markup
    {
      delete window.__injected;
      const res = (await upload([file("markup.rubric.json", await fx("upload-markup.rubric.json"))])).res;
      const e = accepts("markup", res, { origin: "uploaded" });
      if (e) {
        const [{ default: Screener }, { default: PatientCompanion }, patient] = await Promise.all([
          h.env.loader.importModule(h.appUrl("src/apps/Screener.jsx")),
          h.env.loader.importModule(h.appUrl("src/apps/PatientCompanion.jsx")),
          h.engine("patient.js"),
        ]);
        const a = h.mount(React.createElement(Screener, { module: e.module, appVersion: policy.APP_VERSION, site: policy.SITE }));
        const b = h.mount(React.createElement(PatientCompanion, { view: patient.projectForPatient(e.module), appVersion: policy.APP_VERSION }));
        const info = h.mount(React.createElement(chrome.ModuleInfo, { open: true, entry: e, entries: [masqueEntry, e], appVersion: policy.APP_VERSION, onClose: () => {} }));
        await new Promise((r) => setTimeout(r, 50));
        const imgs = [a, b, info].reduce((n, m) => n + m.container.querySelectorAll("img, script, iframe").length, 0);
        c.check(imgs === 0, "/inert/elements", null, 0, imgs);
        c.check(window.__injected === undefined, "/inert/no-handler-ran", null, undefined, window.__injected);
        c.check(info.container.textContent.includes("<img"), "/inert/as-text", null, "the markup shown as text", info.container.textContent.slice(0, 120));
        a.unmount(); b.unmount(); info.unmount();
      }
    }

    // ------------------------------------------------------------------ session list and saved modules
    {
      if (!reg.registered().some((x) => x.key === masqueEntry.key)) reg.register(masqueEntry);
      const before = reg.registered().length;
      if (dEntry) {
        reg.register(dEntry);
        c.check(reg.registered().some((x) => x.key === dEntry.key), "/register", null, "registered", reg.registered().map((x) => x.key));
        let threw = false;
        try { reg.register({ ...dEntry, key: `${dEntry.key}#other` }); } catch (_) { threw = true; }
        c.check(threw, "/register/duplicate-id", null, "refused", "accepted");
        const savedAt = reg.saveModule(dEntry);
        c.check(typeof savedAt === "string", "/saved/save", null, "savedAt", savedAt);
        const listed = reg.listSaved({ entries }).find((x) => x.id === dEntry.module.id);
        c.check(!!listed && listed.needsLogicUpload === false && listed.logicRef && listed.logicRef.sha256 === masque.hashes.logicSha256, "/saved/list", null, "listed, logic by SHA", listed);
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem(reg.SAVED_KEY)).find((x) => x.id === dEntry.module.id); } catch (_) { stored = null; }
        c.check(!!stored && !("logicText" in stored) && !/export default/.test(JSON.stringify(stored)), "/saved/json-only", null, "rubric text and a logic reference only", stored && Object.keys(stored));
        reg.unregister(dEntry.key);
        try {
          const restored = await reg.restoreSaved(dEntry.module.id, { entries });
          c.check(restored.classification.kind === "verified" && restored.module.logic === masque.logic, "/saved/restore", null, "verified, built-in logic", restored.classification);
        } catch (err) { c.check(false, "/saved/restore", null, "restored", String(err.message)); }
        // A stored rubric edited by hand (or by uploaded code) is re-verified, never trusted.
        try {
          const list = JSON.parse(localStorage.getItem(reg.SAVED_KEY));
          const rec = list.find((x) => x.id === dEntry.module.id);
          const r = JSON.parse(rec.rubricText);
          const dom = r.domains.find((x) => !x.negative);
          dom.items[0].w += 1; dom.max += 1;
          rec.rubricText = JSON.stringify(r, null, 2);
          localStorage.setItem(reg.SAVED_KEY, JSON.stringify(list));
          let restored = null, err = null;
          try { restored = await reg.restoreSaved(dEntry.module.id, { entries }); } catch (e) { err = e; }
          c.check(!restored || restored.classification.kind !== "verified", "/saved/tampered", null, "not restored as the verified derivation", restored ? restored.classification : String(err && err.message));
        } catch (err) { c.check(false, "/saved/tampered", null, "tamper check ran", String(err.message)); }
        reg.forgetSaved(dEntry.module.id);
        c.check(!reg.listSaved({ entries }).some((x) => x.id === dEntry.module.id), "/saved/forget", null, "forgotten", "still listed");
      }
      let threw = false;
      try { reg.unregister(masqueEntry.key); } catch (_) { threw = true; }
      c.check(threw && reg.registered().some((x) => x.key === masqueEntry.key), "/unregister/builtin", null, "built-ins cannot be removed", "removed");
      c.check(reg.registered().length === before, "/register/cleanup", null, before, reg.registered().length);
    }

    c.note(`built-in logic id '${builtinLogicId}'; ${entries.length} built-in entr${entries.length === 1 ? "y" : "ies"}`);
    return c.result();
  }),
};
