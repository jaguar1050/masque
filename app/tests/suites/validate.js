// tests/suites/validate.js — the validator and engine-core checks of WP3 (design 03 §8.3
// `validate`, §9.4 done-when 3-8). Owner: WP3.
//
//  1. mutation corpus: every generator in tests/fixtures/mutations produces its code at its
//     path, the unmutated base does not, and every code V1-V60 is covered;
//  2. the mutation base, the shape fixture (and its bound variant) validate with zero errors;
//  3. MASQUE validates with zero errors; its warnings are only the expected V12 (an item
//     without a short label) and V33 (es fallbacks); validation stays within 300 ms;
//  4. bindModule is deterministic: same bytes, same hashes, same frozen structure;
//  5. classifyLineage on every §3.11 row, including failed verifications and a forged root;
//  6. fail-closed (§3.3): a throwing routing rule and a throwing derive rule, on both surfaces.
//
// The checks live in core(deps) so they run unchanged outside the browser too; run(h) builds
// deps from the harness. Nothing happens at import time.
import { CODES, MUTATIONS } from "../fixtures/mutations/index.js";

const BUDGET_MS = 300;
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

function deepCopyJson(x) {
  return JSON.parse(JSON.stringify(x));
}

function findings(report, sev) {
  return sev === "W" ? report.warnings : report.errors;
}

function has(report, code, path, sev) {
  return findings(report, sev).some(f => f.code === code && f.path === path);
}

function summarise(report) {
  return {
    errors: report.errors.map(e => `${e.code} ${e.path}`),
    warnings: report.warnings.map(e => `${e.code} ${e.path}`),
  };
}

/**
 * @param {Object} deps
 *   engine: {bind, validate, lineage, hash, policy, rules, gates, scoring, generic}
 *   baseRubricText, baseLogicText: the mutation base files
 *   importLogic(text, name) → Promise<logic object>
 *   inspect(path) → Promise<inspectSource result | null>
 *   loadShape() → Promise<{module, validation}[]>        the shape fixture(s), bound and validated
 *   shapeBytes() → Promise<{rubricText}>                  for the determinism check
 *   loadMasque() → Promise<{module, validation, rubricText?, logicText?, logic?}>  (may throw: not present yet)
 *   note(msg)
 */
export async function core(deps) {
  const { bind, validate, lineage, hash, policy, rules, gates } = deps.engine;
  const diffs = [];
  let n = 0;
  const fail = (path, input, a, b) => diffs.push({ path, input, a, b });
  const check = (ok, path, input, a, b) => { n++; if (!ok) fail(path, input, a, b); return ok; };

  // ------------------------------------------------------------------ the mutation base
  const baseRubric = JSON.parse(deps.baseRubricText);
  const baseLogic = await deps.importLogic(deps.baseLogicText, "base");
  const baseLogicSha = await hash.sha256Hex(deps.baseLogicText);
  const freshLogic = () => bind.cloneData(baseLogic);
  const UPLOADED = { kind: "uploaded", root: null, origin: "uploaded", row: 7, reasons: [] };

  async function bindWith(rubric, logic, { origin = "uploaded", classification = UPLOADED, key = "mutation:subject", logicSha256 = null } = {}) {
    const lb = isObj(rubric) ? rubric.logicBinding : undefined;
    const sha = logicSha256 || (logic && isObj(lb) ? baseLogicSha : null);
    return bind.bindModule(rubric, logic, {
      origin, classification, key, logicSha256: sha || undefined,
      sources: { rubricText: null, logicText: logic ? deps.baseLogicText : null },
      loadedAt: "2026-10-01T12:00:00.000Z",
    });
  }

  const root = await bindWith(deepCopyJson(baseRubric), freshLogic(), { origin: "builtin", classification: "builtin", key: "builtin:mutation-base" });

  const stripMeta = (L) => {
    if (!isObj(L)) return null;
    const out = {};
    for (const k of Object.keys(L)) if (!["reviewed", "editedLocally", "stale"].includes(k)) out[k] = L[k];
    return hash.canonicalJson(out);
  };

  /** §3.11 derived-module rules over a mutated copy (deriveRubric's job in WP11, restated for the corpus). */
  async function derive(rubric, { parent = root, instrumentVersion, lexiconVersion, keepSettled = false, keepReviewed = false } = {}) {
    const r = deepCopyJson(rubric);
    const rootRec = parent.provenance && parent.provenance.root ? parent.provenance.root : lineage.ancestorRecord(parent);
    const parentRec = lineage.ancestorRecord(parent);
    const lin = [...(parent.provenance && Array.isArray(parent.provenance.lineage) ? parent.provenance.lineage : []), parentRec];
    delete r.provenance;
    r.logicBinding = { moduleId: parent.logic.moduleId, logicSha256: parent.hashes.logicSha256 };
    const h = await hash.rubricHashes(r);
    if (r.id === parent.id || r.id === rootRec.moduleId) r.id = `local-${rootRec.moduleId}-${h.contentHash.slice(0, 6)}`;
    if (r.label === parent.label || r.label === rootRec.label) r.label = `${rootRec.label} — edited 2026-10-02`;
    if (!keepSettled && h.scoringHash !== rootRec.scoringHash && r.cds && r.cds.examples) delete r.cds.examples.settled;
    r.instrumentVersion = instrumentVersion !== undefined ? instrumentVersion
      : (h.instrumentHash === rootRec.instrumentHash ? rootRec.instrumentVersion : `${rootRec.instrumentVersion}-local.${h.instrumentHash.slice(0, 6)}`);
    if (r.lexicon) {
      r.lexicon.version = lexiconVersion !== undefined ? lexiconVersion
        : (h.lexiconHash === rootRec.lexiconHash ? rootRec.lexiconVersion : `${rootRec.lexiconVersion || "0.1"}-local.${String(h.lexiconHash).slice(0, 6)}`);
    }
    if (!keepReviewed && isObj(r.locales)) {
      const rootLocs = isObj(root.rubric.locales) ? root.rubric.locales : {};
      for (const loc of Object.keys(r.locales)) {
        if (stripMeta(r.locales[loc]) !== stripMeta(rootLocs[loc])) { r.locales[loc].reviewed = false; r.locales[loc].editedLocally = true; }
      }
    }
    r.changelog = [...(Array.isArray(r.changelog) ? r.changelog : []), { date: "2026-10-02", kind: "derived", note: "Example derivation for the mutation corpus.", paths: [] }];
    const contentHash = (await hash.rubricHashes(r)).contentHash;
    r.provenance = { root: rootRec, derivedFrom: parentRec, lineage: lin, contentHash, createdAt: "2026-10-02" };
    return r;
  }

  const ctx = {
    rubric: () => deepCopyJson(baseRubric),
    logic: freshLogic,
    root,
    bind: (rubric, logic, opts = {}) => bindWith(rubric, logic, opts),
    derive,
    inspect: deps.inspect,
    LIMITS: policy.LIMITS,
  };

  async function runCase(out) {
    const rubric = out.rubric;
    const lb = isObj(rubric) ? rubric.logicBinding : undefined;
    const logic = out.logic !== undefined ? out.logic : (isObj(lb) ? freshLogic() : null);
    const reports = [];
    if (out.via === "shape") reports.push(validate.validateRubricShape(rubric, { origin: out.origin, classification: out.classification }));
    let module = null;
    try {
      module = await bindWith(rubric, logic, {
        origin: out.origin || "uploaded",
        classification: out.classification !== undefined ? out.classification : UPLOADED,
        key: "mutation:subject",
        logicSha256: out.logicSha256 || null,
      });
    } catch (err) {
      if (err && err.code && typeof err.path === "string") reports.push({ ok: false, errors: [{ code: err.code, path: err.path, msg: err.message }], warnings: [] });
      else reports.push({ ok: false, errors: [{ code: "BIND", path: "", msg: String(err && err.message || err) }], warnings: [] });
    }
    if (module) reports.push(await validate.validateModule({ module, loaded: out.loaded || [], root: out.root || null, upload: out.upload || null }));
    return {
      ok: reports.every(r => r.ok),
      errors: reports.flatMap(r => r.errors),
      warnings: reports.flatMap(r => r.warnings),
    };
  }

  // The base itself: no finding any generator targets may already be present.
  const baseReport = await runCase({ rubric: ctx.rubric(), via: "shape" });
  check(baseReport.ok, "/base", { what: "mutation base validates with zero errors" }, [], summarise(baseReport));
  const baseBuiltin = await validate.validateModule({ module: root, loaded: [] });
  check(baseBuiltin.ok, "/base/builtin", { what: "mutation base bound as a built-in validates" }, [], summarise(baseBuiltin));

  const covered = new Set();
  for (let i = 0; i < MUTATIONS.length; i++) {
    const g = MUTATIONS[i];
    const input = { generator: i, code: g.code, sev: g.sev, path: g.path, what: g.what };
    let rep;
    try {
      rep = await runCase(await g.build(ctx));
    } catch (err) {
      check(false, `/mutations/${i}`, input, `${g.code} ${g.path}`, `generator threw: ${err && err.message}`);
      continue;
    }
    const before = has(baseReport, g.code, g.path, g.sev);
    const produced = has(rep, g.code, g.path, g.sev);
    if (check(produced && !before, `/mutations/${i}`, input, `${g.sev} ${g.code} ${g.path}`, before ? "already present in the base" : summarise(rep))) covered.add(g.code);
  }
  for (const code of CODES) check(covered.has(code), `/coverage/${code}`, { code }, "≥ 1 passing mutation", "none");

  // ------------------------------------------------------------- the shape fixture(s)
  try {
    for (const { name, module, validation } of await deps.loadShape()) {
      check(validation.ok, `/fixtures/${name}`, { fixture: name }, "0 errors", summarise(validation));
      void module;
    }
  } catch (err) {
    check(false, "/fixtures/shape", {}, "loads", String(err && err.message || err));
  }

  // ---------------------------------------------------------------------------- MASQUE
  let masque = null;
  try {
    masque = await deps.loadMasque();
  } catch (err) {
    check(false, "/masque", {}, "built-in loads", `not present: ${String(err && err.message || err).split("\n")[0]}`);
  }
  if (masque && masque.module) {
    const v = masque.validation;
    check(v && v.ok, "/masque/errors", {}, "0 errors", v ? summarise(v) : "no validation");
    const unexpected = v ? v.warnings.filter(w => !(w.code === "V33" || (w.code === "V12" && /\/short$/.test(w.path)))) : [];
    check(!unexpected.length, "/masque/warnings", {}, "only V12 (short) and V33 (es fallbacks)", unexpected.map(w => `${w.code} ${w.path}: ${w.msg}`));
    const v12 = v ? v.warnings.filter(w => w.code === "V12") : [];
    deps.note(`MASQUE: ${v ? v.errors.length : "?"} errors, ${v ? v.warnings.length : "?"} warnings (V12 ×${v12.length}, V33 ×${v ? v.warnings.filter(w => w.code === "V33").length : "?"})`);
    // Budget: the best of three runs (the first warms the JIT).
    let best = Infinity;
    for (let k = 0; k < 3; k++) {
      const t0 = performance.now();
      await validate.validateModule({ module: masque.module, loaded: [] });
      best = Math.min(best, performance.now() - t0);
    }
    deps.note(`MASQUE validation: ${Math.round(best)} ms (budget ${BUDGET_MS} ms)`);
    check(best <= BUDGET_MS, "/masque/budget", {}, `≤ ${BUDGET_MS} ms`, `${Math.round(best)} ms`);
    check(gates.calibrationGate(masque.module), "/masque/calibrationGate", {}, true, false);
  }

  // ------------------------------------------------------------- bindModule determinism
  {
    const texts = [{ name: "mutation-base", rubricText: deps.baseRubricText, logicText: deps.baseLogicText }];
    if (masque && masque.rubricText && masque.logicText) texts.push({ name: "masque", rubricText: masque.rubricText, logicText: masque.logicText });
    for (const t of texts) {
      const meta = () => ({ origin: "builtin", classification: "builtin", key: `builtin:${t.name}`, sources: { rubricText: t.rubricText, logicText: t.logicText }, loadedAt: "2026-10-01T12:00:00.000Z" });
      const l1 = await deps.importLogic(t.logicText, `${t.name}-a`);
      const l2 = await deps.importLogic(t.logicText, `${t.name}-b`);
      const m1 = await bind.bindModule(JSON.parse(t.rubricText), l1, meta());
      const m2 = await bind.bindModule(JSON.parse(t.rubricText), l2, meta());
      check(hash.canonicalJson(m1.hashes) === hash.canonicalJson(m2.hashes), `/bind/${t.name}/hashes`, {}, m1.hashes, m2.hashes);
      check(bind.moduleFingerprint(m1) === bind.moduleFingerprint(m2), `/bind/${t.name}/structure`, {}, "identical", "differs");
      check(Object.isFrozen(m1) && Object.isFrozen(m1.domains) && Object.isFrozen(m1.logic) && Object.isFrozen(m1.rubric), `/bind/${t.name}/frozen`, {}, true, false);
    }
  }

  // ------------------------------------------------------------- classifyLineage, §3.11
  {
    const cls = (r, opts = {}) => lineage.classifyLineage(r, { builtins: [root], loaded: [root], ...opts });
    const rowIs = async (name, r, kind, row, opts) => {
      const c = await cls(r, opts);
      check(c.kind === kind && c.row === row, `/lineage/${name}`, { name }, `${kind} row ${row}`, `${c.kind} row ${c.row}: ${c.reasons.join("; ")}`);
      return c;
    };
    await rowIs("duplicate", ctx.rubric(), "duplicate", 1, { logicSha256: baseLogicSha });
    { const r = ctx.rubric(); r.domains[0].items[0].w = 15; r.domains[0].items[1].w = 35; await rowIs("reserved-id", r, "rederive", 2); }
    const edited = ctx.rubric();
    edited.domains[0].items[0].text = "Example item one, edited";
    const okDerived = await derive(edited);
    const verifiedC = await rowIs("verified", okDerived, "verified", 3);
    check(verifiedC.root === root && verifiedC.origin === "derived", "/lineage/verified/root", {}, "root = the built-in, origin derived", `${verifiedC.root && verifiedC.root.id} ${verifiedC.origin}`);
    { const r = deepCopyJson(okDerived); r.domains[0].items[0].w = 15; r.domains[0].items[1].w = 35; await rowIs("content-changed", r, "rederive", 4); }
    { const r = deepCopyJson(okDerived); r.provenance.root.scoringHash = "f".repeat(64); r.provenance.lineage[0].scoringHash = "f".repeat(64); r.provenance.derivedFrom.scoringHash = "f".repeat(64); await rowIs("root-record-mismatch", r, "rederive", 4); }
    { const r = deepCopyJson(okDerived); r.logicBinding = { moduleId: root.logic.moduleId, logicSha256: "e".repeat(64) }; await rowIs("logic-binding-changed", r, "rederive", 4); }
    { const r = ctx.rubric(); r.id = "example-kin"; r.label = "Example kin"; delete r.logicBinding; r.logicBinding = "generic"; await rowIs("kin-name", r, "rederive", 5); }
    { const r = ctx.rubric(); r.id = "example-kin"; r.label = "Example kin"; r.name = "Example other name"; r.fhir.questionnaireName = "ExampleOther"; r.fhir.questionnaireTitle = "Example other title"; r.fhir.publisher = "Example other publisher"; r.cds.title = "Example other CDS"; r.cds.source.label = "Example other source"; await rowIs("kin-logic", r, "rederive", 5); }
    // A plain upload R (unrelated to the built-in), then a derivation of R.
    const unrelated = () => {
      const r = ctx.rubric();
      r.id = "example-upload"; r.label = "Example upload"; r.name = "Example upload"; r.logicBinding = "generic";
      r.fhir.questionnaireName = "ExampleUpload"; r.fhir.questionnaireTitle = "Example upload title"; r.fhir.publisher = "Example upload publisher";
      r.cds.title = "Example upload CDS"; r.cds.source.label = "Example upload source";
      return r;
    };
    await rowIs("plain-upload", unrelated(), "uploaded", 7);
    const R = await bindWith(unrelated(), null, { origin: "uploaded", classification: UPLOADED, key: "upload:example-upload" });
    {
      const r = unrelated(); r.domains[0].items[0].text = "Example item one, edited";
      const d = await derive(r, { parent: R });
      d.logicBinding = "generic";
      d.provenance.contentHash = (await hash.rubricHashes(d)).contentHash;
      await rowIs("derived-from-upload", d, "derived-from-upload", 6, { loaded: [root, R] });
      const tampered = deepCopyJson(d); tampered.domains[0].items[0].text = "Example item one, edited twice";
      await rowIs("derived-from-upload-changed", tampered, "rederive", 6, { loaded: [root, R] });
      const forged = deepCopyJson(d); forged.provenance.root = { ...forged.provenance.root, moduleId: "example-unknown", label: "Example unknown" };
      forged.provenance.lineage[0] = forged.provenance.root; forged.provenance.derivedFrom = forged.provenance.root;
      const fc = await rowIs("forged-root", forged, "uploaded", 7, { loaded: [root, R] });
      check(/not verified/.test(fc.reasons.join(" ")), "/lineage/forged-root/reason", {}, "claims derivation …; not verified", fc.reasons);
    }
    // A forged derivedFrom pointing at the built-in, on content that is not the built-in's.
    {
      const r = unrelated();
      const rec = lineage.ancestorRecord(root);
      r.provenance = { root: rec, derivedFrom: rec, lineage: [rec], contentHash: "a".repeat(64), createdAt: "2026-10-02" };
      const c = await cls(r);
      check(c.kind !== "verified", "/lineage/forged-derivedFrom", {}, "never verified", `${c.kind} row ${c.row}`);
    }
  }

  // --------------------------------------------- provenance wording and availability, §3.11
  {
    const { CAVEATS } = policy;
    check(lineage.provenanceLines(root, "clinician").length === 0 && lineage.provenanceLines(root, "patient").length === 0, "/provenance/builtin", {}, [], "lines");
    const up = await bindWith(ctx.rubric(), freshLogic(), { key: "prov:upload" });
    check(lineage.provenanceLines(up, "clinician").join("|") === CAVEATS.uploaded.en, "/provenance/uploaded/clinician", {}, [CAVEATS.uploaded.en], lineage.provenanceLines(up, "clinician"));
    check(lineage.provenanceLines(up, "patient").join("|") === CAVEATS.patient.uploaded.en, "/provenance/uploaded/patient", {}, [CAVEATS.patient.uploaded.en], lineage.provenanceLines(up, "patient"));
    const r = ctx.rubric(); r.domains[1].items[0].w = 20; r.domains[1].items[1].w = 30;
    r.locales.en.items.p_one.q = "Example patient question one, edited?";
    const d = await bindWith(await derive(r, {}), freshLogic(), { origin: "derived", classification: { kind: "verified", root, origin: "derived", row: 3, reasons: [] }, key: "prov:derived" });
    const cl = lineage.provenanceLines(d, "clinician");
    const scoringLine = CAVEATS.scoringChanged.en.replace("{root}", root.name).replace("{rootVersion}", root.instrumentVersion);
    check(cl[0] === CAVEATS.edited.en && cl.includes(scoringLine), "/provenance/derived/clinician", {}, [CAVEATS.edited.en, scoringLine], cl);
    const pl = lineage.provenanceLines(d, "patient", { locale: "en" });
    check(pl[0] === CAVEATS.patient.edited.en && pl.includes(CAVEATS.editedWording.en) && !pl.includes(scoringLine), "/provenance/derived/patient", {}, "patient set only, edited wording", pl);
    const dv = await validate.validateModule({ module: d, loaded: [root], root });
    check(dv.ok, "/provenance/derived/validates", {}, "a correctly derived module validates", summarise(dv));
    const av = lineage.availability(d);
    check(av.research.population === false && av.research.readiness === true && av.scribe.voice && av.patient.available, "/availability/derived", {}, "no population (none declared), readiness, voice, patient", av);
    const shapeList = await deps.loadShape();
    const shapeAv = lineage.availability(shapeList[0].module);
    check(shapeAv.scribe.voice === false && shapeAv.scribe.reason === "no voice capture (no lexicon)" && shapeAv.patient.available && !shapeAv.research.readiness,
      "/availability/shape", {}, "no voice (no lexicon), patient available, no research", shapeAv);
  }

  // ------------------------------------------------------------- fail-closed, §3.3 / D6
  {
    const throwing = () => { throw new Error("Example failure"); };
    const lRouting = freshLogic(); lRouting.routing = [{ id: "example-throws", when: throwing, copy: { screener: { h: "x", p: "x", chips: [] }, scribe: { h: "x", p: "x", chips: [] } } }, ...lRouting.routing];
    const lDerive = freshLogic(); lDerive.phenotypes.derive = [{ value: "kind_y", when: throwing }, ...lDerive.phenotypes.derive];
    const lActivation = freshLogic(); lActivation.phenotypes.activation = [{ id: "example-throws", domains: ["second"], when: throwing }];
    const mR = await bindWith(ctx.rubric(), lRouting, { key: "failclosed:routing" });
    const mD = await bindWith(ctx.rubric(), lDerive, { key: "failclosed:derive" });
    const mA = await bindWith(ctx.rubric(), lActivation, { key: "failclosed:activation" });
    const a = { p_one: "yes", p_two: 2, p_three: "yes", p_four: "yes", p_minus: "no" };
    for (const surface of ["screener", "scribe"]) {
      // Routing rule throws.
      const score = deps.engine.scoring.computeScore(mR, a);
      const st = rules.buildRoutingState(mR, { surface, answers: a, ctx: {}, complaint: "kind_y", score, activeFlags: [], safetyReviewed: true });
      check(typeof st.answered === "number" && typeof st.isAnswered === "function" && Object.isFrozen(st), `/failclosed/${surface}/state`, {}, "answered count + isAnswered(id), frozen", { answered: typeof st.answered, isAnswered: typeof st.isAnswered });
      const rr = rules.routingRecs(mR, st);
      check(rr.gate === "error" && rr.recs.length === 1 && rr.recs[0].h === "Module rule error — no routing issued" && rr.error && rr.error.ruleId === "example-throws",
        `/failclosed/${surface}/routing`, { surface }, "rule-error card only, routingError set", rr);
      check(!gates.referralGate({ surface, override: false, routingCleared: true, score, routingError: rr.error }), `/failclosed/${surface}/routing/referralGate`, {}, false, true);
      check(rules.referralFor(mR, "kind_y", { routingError: rr.error }) === null, `/failclosed/${surface}/routing/referralFor`, {}, null, "a referral");
      check(rules.cdsPreview(mR, st, { routingError: rr.error }).index === null, `/failclosed/${surface}/routing/cds`, {}, "no index card", "index card");
      // Derive rule throws: a routing error on both surfaces, whatever complaint display shows.
      const dp = rules.derivePhenotype(mD, a);
      check(dp.value === "" && dp.error && dp.error.family === "phenotype", `/failclosed/${surface}/derive/value`, {}, "{value:'', error}", dp);
      const sd = rules.buildRoutingState(mD, { surface, answers: a, ctx: {}, complaint: dp.value, phenotypeError: dp.error, activeFlags: [], safetyReviewed: true });
      const rd = rules.routingRecs(mD, sd);
      check(rd.gate === "error" && rd.recs.length === 1 && rd.recs[0].h === "Module rule error — no routing issued" && rd.error === sd.phenotypeError,
        `/failclosed/${surface}/derive`, { surface }, "rule-error card naming the derive rule", rd);
      check(!gates.referralGate({ surface, override: false, routingCleared: true, score: deps.engine.scoring.computeScore(mD, a), routingError: rd.error }), `/failclosed/${surface}/derive/referralGate`, {}, false, true);
      check(rules.referralFor(mD, dp.value, { routingError: rd.error }) === null, `/failclosed/${surface}/derive/referralFor`, {}, null, "a referral");
      check(rules.cdsPreview(mD, sd, { routingError: rd.error }).index === null, `/failclosed/${surface}/derive/cds`, {}, "no index card", "index card");
      const ad = rules.activeDomains(mD, { answers: a, complaint: dp.value, phenotypeError: dp.error });
      check(ad.domains.size === mD.domainOrder.length, `/failclosed/${surface}/derive/activeDomains`, {}, "every domain", [...ad.domains]);
      // The red-flag override still pre-empts everything (safety card unaffected by routingError).
      const so = rules.buildRoutingState(mD, { surface, answers: a, ctx: {}, complaint: "", phenotypeError: dp.error, activeFlags: ["p_rf_a"], safetyReviewed: true });
      const ro = rules.routingRecs(mD, so);
      check(ro.gate === "override" && ro.error === dp.error, `/failclosed/${surface}/derive/override`, {}, "override gate, error still reported", { gate: ro.gate });
      check(rules.cdsPreview(mD, so, { routingError: ro.error }).safety !== null, `/failclosed/${surface}/derive/safetyCard`, {}, "safety card", null);
    }
    const aa = rules.activeDomains(mA, { answers: a, complaint: "kind_x" });
    check(aa.error && aa.error.family === "activation" && aa.domains.size === mA.domainOrder.length, "/failclosed/activation", {}, "every domain + error", { error: aa.error, domains: [...aa.domains] });
  }

  return { verdict: diffs.length ? "fail" : "pass", n, diffs, expectedMissing: [] };
}

export default {
  name: "validate",
  owner: "WP3",
  async run(h) {
    const engineFiles = ["bind", "validate", "lineage", "hash", "policy", "rules", "gates", "scoring", "generic"];
    const engine = {};
    for (const f of engineFiles) engine[f] = await h.engine(`${f}.js`);
    const importLogic = async (text, name) => (await h.env.loader.importSource(text, { filename: `${name}.logic.js` })).default;
    const deps = {
      engine,
      baseRubricText: await h.fixture("mutations/base.rubric.json", "text"),
      baseLogicText: await h.fixture("mutations/base.logic.js", "text"),
      importLogic,
      inspect: async (path) => {
        try { return h.env.loader.inspectSource(await h.fixture(path, "text"), { filename: path.split("/").pop() }); }
        catch (_) { return null; }
      },
      loadShape: async () => {
        const out = [];
        for (const name of ["shape", "shape-bound"]) {
          const { module, validation } = await h.loadFixture(name);
          out.push({ name, module, validation });
        }
        return out;
      },
      loadMasque: async () => {
        const { module, validation, entry } = await h.loadBuiltin();
        if (!module) throw new Error(validation && validation.errors && validation.errors[0] ? validation.errors[0].msg : "the built-in did not load");
        const files = (entry && entry.files) || {};
        return { module, validation, rubricText: files.rubric && files.rubric.text, logicText: files.logic && files.logic.text };
      },
      note: (m) => h.note(m),
    };
    return core(deps);
  },
};
