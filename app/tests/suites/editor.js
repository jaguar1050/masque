// tests/suites/editor.js — the Rubric Editor's model: drafts, locks, acknowledgements,
// classification, identity and the §3.11 derivation rules (design 03 §8.3 `editor`, §9.12).
// Owner: WP11. The UI half (locked inputs, Apply gating, Create / Create and switch, current
// screen rows, Revert, the last-phrase guard, 375 px) is the Playwright spec specs/editor.mjs.
//
// Every derivation goes through derive.deriveAndBind, which is what the editor's preview and
// the Apply dialog run: classifyChanges → proposeIdentity → deriveRubric → bindDerived
// (classifyLineage as an upload would, bindModule with the root's logic, validateModule
// against the root). Checked, on MASQUE and the shape fixture:
//   weights       weight edit → V15 at the domain max; "set max = Σw" → no error, V17 warning
//   instrument    Apply on an instrument change: id local-<root>-<hex6>, default label, -local
//                 version, new Questionnaire URL / code system / index code, calibration gate
//                 closed, settled CDS example removed (and logged), "edited · scoring changed",
//                 verified (row 3), provenance and change log per §3.11, logic pinned by SHA
//   family        second generation: -local default; claiming "0.2" → V53; restoring the
//                 root's instrument locks "0.2" and drops "scoring changed"
//   wording       patient/ask-only edit → version locked to the root's, scoring equal,
//                 calibration applies; clinician text edit → -local, scoring equal
//   ack           m_dur option 2 and r_dur patient q need an acknowledgement, with dependents,
//                 and the rules they feed produce a sentence / a routing heading in the cases;
//                 the acknowledged pointers reach the change log
//   lexicon       a phrase added → lexicon -local, instrument locked, gold set "not re-run";
//                 the last cue phrase of a flag removed → V28
//   locales       English edit → es stale path and reviewed:false, stale-translation line;
//                 an English red-flag edit → staleRedFlagPaths; a hand-edited "reviewed": true
//                 never rises above the parent's
//   add-item      the Add item rules (V11, V13, V15, V32) and a valid item round trip;
//                 domains cannot be added, removed or reordered (lockViolations)
//   shape         Create lexicon (V28 names every flag) and Create English patient wording
//                 (V23/V32), then a valid derivation of the upload (row 6)
//   identity      a label equal to a built-in's is refused; id and label collisions get -2 / (2)
//   locks         locked fields are reported; revertChange and Revert all restore the parent;
//                 setAt refuses __proto__ / constructor / prototype segments
import React from "react";
import { collector, guarded, loadMasque, need } from "../harness/kit.js";

const NOW = "2026-10-01T12:00:00.000Z";
const canon = (x) => JSON.stringify(sortKeys(x));
function sortKeys(x) {
  if (Array.isArray(x)) return x.map(sortKeys);
  if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().map((k) => [k, sortKeys(x[k])]));
  return x;
}
const codes = (v) => (v ? v.errors.map((e) => `${e.code} ${e.path}`) : []);

export default {
  name: "editor",
  owner: "WP11",
  run: guarded("editor", async (h) => {
    const c = collector(h);
    const [derive, lineage, gates, policy, common, hash] = await Promise.all([
      h.engine("derive.js"), h.engine("lineage.js"), h.engine("gates.js"), h.engine("policy.js"),
      h.env.loader.importModule(h.appUrl("src/ui/common.jsx")), h.engine("hash.js"),
    ]);
    need(typeof derive.deriveAndBind === "function", "waits on WP11 derive.js");
    const { module: M, validation: V } = await loadMasque(h);
    const ro = V.info.readsObserved;
    const CAV = policy.CAVEATS;
    const fresh = () => derive.createDraft(M).rubric;
    const run = (parent, draft, opts = {}) => derive.deriveAndBind(parent, draft, { loaded: [M], readsObserved: ro, now: NOW, note: "editor suite", ...opts });
    const badge = (module) => {
      const { container, unmount } = h.mount(React.createElement(common.ProvenanceBadge, { module }));
      const el = container.querySelector("[data-testid=provenance-badge]");
      const t = el ? el.textContent : "";
      unmount();
      return t;
    };
    const posDomain = M.rubric.domains.findIndex((d) => !d.negative);

    // createDraft never shares structure with the module.
    {
      const d = derive.createDraft(M);
      c.check(d.parentKey === M.key && d.rubric !== M.rubric && canon(d.rubric) === canon(M.rubric), "/draft", null, "a structured clone", "shared or different");
      d.rubric.domains[0].items[0].w = 99;
      c.check(M.rubric.domains[0].items[0].w !== 99, "/draft/independent", null, "module unchanged", "module mutated");
    }

    // ---------------------------------------------------------------- weights
    let d1draft = fresh();
    d1draft.domains[posDomain].items[0].w += 1;
    {
      const r = await run(M, d1draft);
      c.check(codes(r.validation).includes(`V15 /domains/${posDomain}/max`), "/weights/V15", { edit: "w+1" }, `V15 /domains/${posDomain}/max`, codes(r.validation));
    }
    d1draft = derive.setMaxToSum(d1draft, posDomain);
    const R1 = await run(M, d1draft);
    c.check(R1.validation.ok, "/weights/setMax/ok", null, "no errors", codes(R1.validation));
    c.check(R1.validation.warnings.some((w) => w.code === "V17"), "/weights/setMax/V17", null, "V17 warning", R1.validation.warnings.map((w) => w.code));

    // ------------------------------------------------------------ instrument
    {
      const m = R1.module, rb = R1.rubric;
      c.check(new RegExp(`^local-${M.id}-[0-9a-f]{6}$`).test(m.id), "/instrument/id", null, `local-${M.id}-<hex6>`, m.id);
      // The label carries the date the user sees: NOW's local calendar date (functional audit L4).
      const t = new Date(NOW);
      const localDay = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      c.check(derive.localDate(NOW) === localDay && derive.localDate("2026-10-02") === "2026-10-02", "/instrument/localDate", null, localDay, derive.localDate(NOW));
      c.check(m.label === `${M.label} — edited ${localDay}`, "/instrument/label", null, `${M.label} — edited ${localDay}`, m.label);
      c.check(new RegExp(`^${M.instrumentVersion.replace(/\./g, "\\.")}-local\\.[0-9a-f]{6}$`).test(m.instrumentVersion), "/instrument/version", null, "<root>-local.<hash6>", m.instrumentVersion);
      c.check(m.instrumentVersion.endsWith(m.hashes.instrumentHash.slice(0, 6)), "/instrument/version/hash6", null, m.hashes.instrumentHash.slice(0, 6), m.instrumentVersion);
      for (const k of ["questionnaireUrl", "codeSystem", "indexCode"]) {
        c.check(m.fhir[k] !== M.fhir[k] && m.fhir[k].includes(m.id), `/instrument/fhir/${k}`, null, `new, naming ${m.id}`, m.fhir[k]);
      }
      c.check(gates.calibrationGate(M) === true && gates.calibrationGate(m) === false, "/instrument/calibration", null, "root true, derived false", [gates.calibrationGate(M), gates.calibrationGate(m)]);
      c.check(M.rubric.cds.examples.settled !== undefined && m.cds.examples.settled === undefined, "/instrument/settled", null, "removed", m.cds.examples.settled);
      const last = rb.changelog[rb.changelog.length - 1];
      c.check(last.kind === "derived" && last.note === "editor suite" && last.date === NOW.slice(0, 10), "/instrument/changelog", null, "derived entry", last);
      c.check(Array.isArray(last.removed) && last.removed.includes("/cds/examples/settled") && last.paths.includes("/cds/examples/settled"), "/instrument/changelog/removed", null, "settled removal logged", last);
      c.check(last.paths.includes(`/domains/${posDomain}/items/0/w`) && last.paths.includes(`/domains/${posDomain}/max`), "/instrument/changelog/paths", null, "the changed pointers", last.paths);
      c.check(last.axes && last.axes.instrument && last.axes.instrument[0] === M.instrumentVersion && last.axes.instrument[1] === m.instrumentVersion, "/instrument/changelog/axes", null, "instrument from→to", last.axes);
      c.check(m.origin === "derived" && m.classification.kind === "verified" && m.classification.row === 3, "/instrument/classification", null, "derived, verified, row 3", [m.origin, m.classification.kind, m.classification.row]);
      const rootRec = lineage.ancestorRecord(M);
      const p = rb.provenance;
      c.check(canon(p.root) === canon(rootRec) && canon(p.derivedFrom) === canon(rootRec) && p.lineage.length === 1 && canon(p.lineage[0]) === canon(rootRec), "/instrument/provenance/records", null, "root = derivedFrom = lineage[0] = the built-in's record", p);
      const { provenance, ...rest } = rb;
      const recomputed = (await hash.rubricHashes(rest)).contentHash;
      c.check(p.contentHash === recomputed && p.createdAt === NOW, "/instrument/provenance/contentHash", null, recomputed, p.contentHash);
      c.check(canon(rb.logicBinding) === canon({ moduleId: M.logic.moduleId, logicSha256: M.hashes.logicSha256 }), "/instrument/logicBinding", null, "the root's logic, pinned by SHA-256", rb.logicBinding);
      c.check(canon(rb.research.calibration) === canon(M.rubric.research.calibration) && canon(rb.research.population) === canon(M.rubric.research.population), "/instrument/research", null, "calibration and population unchanged", null);
      const lines = lineage.provenanceLines(m, "clinician");
      c.check(lines.includes(CAV.edited.en) && lines.some((l) => l.startsWith(CAV.scoringChanged.en.split("{root}")[0])), "/instrument/provenanceLines", null, "edited + scoring changed", lines);
      c.check(badge(m) === "edited · scoring changed", "/instrument/badge", null, "edited · scoring changed", badge(m));
      c.check(lineage.availability(m).research.population === true, "/instrument/population", null, "population allowed (verified derivation of a built-in)", lineage.availability(m).research);
      c.check(R1.identity.versionLocked.instrument === null && typeof R1.identity.versionLocked.lexicon === "string", "/instrument/locks", null, "instrument free, lexicon locked", R1.identity.versionLocked);
    }

    // ---------------------------------------------------------------- family
    const M1 = R1.module;
    {
      const d = derive.createDraft(M1).rubric;
      const di = d.domains.findIndex((x, i) => !x.negative && i !== posDomain);
      d.domains[di].items[0].w += 1;
      d.domains[di].max += 1;
      const g2 = await derive.deriveAndBind(M1, d, { loaded: [M, M1], now: NOW, note: "second generation" });
      c.check(g2.validation.ok, "/family/gen2/ok", null, "no errors", codes(g2.validation));
      c.check(/-local\./.test(g2.module.instrumentVersion) && g2.module.instrumentVersion !== M1.instrumentVersion, "/family/gen2/version", null, "a new -local version", g2.module.instrumentVersion);
      c.check(g2.rubric.provenance.lineage.length === 2 && g2.rubric.provenance.root.moduleId === M.id && g2.rubric.provenance.derivedFrom.moduleId === M1.id, "/family/gen2/lineage", null, "root, then the parent", g2.rubric.provenance.lineage.map((x) => x.moduleId));
      c.check(g2.module.classification.kind === "verified", "/family/gen2/verified", null, "verified against the built-in root", g2.module.classification);
      const claim = await derive.deriveAndBind(M1, d, { loaded: [M, M1], now: NOW, note: "claims the root version", overrides: { instrumentVersion: M.instrumentVersion } });
      c.check(codes(claim.validation).includes("V53 /instrumentVersion"), "/family/gen2/claims-root/V53", { instrumentVersion: M.instrumentVersion }, "V53 /instrumentVersion", codes(claim.validation));
      const claimParent = await derive.deriveAndBind(M1, d, { loaded: [M, M1], now: NOW, note: "claims the parent version", overrides: { instrumentVersion: M1.instrumentVersion } });
      c.check(codes(claimParent.validation).includes("V53 /instrumentVersion"), "/family/gen2/claims-parent/V53", null, "V53 (equal version, different instrument)", codes(claimParent.validation));
      const back = derive.createDraft(M1).rubric;
      back.domains[posDomain].items[0].w -= 1;
      back.domains[posDomain].max -= 1;
      const rs = await derive.deriveAndBind(M1, back, { loaded: [M, M1], now: NOW, note: "restore the root's instrument" });
      c.check(rs.validation.ok && rs.module.instrumentVersion === M.instrumentVersion, "/family/restore/version", null, M.instrumentVersion, [rs.module.instrumentVersion, codes(rs.validation)]);
      c.check(typeof rs.identity.versionLocked.instrument === "string" && rs.identity.versionLocked.instrument.includes(M.instrumentVersion), "/family/restore/locked", null, `locked to ${M.instrumentVersion}`, rs.identity.versionLocked);
      const lines = lineage.provenanceLines(rs.module, "clinician");
      c.check(lines.includes(CAV.edited.en) && !lines.some((l) => l.startsWith(CAV.scoringChanged.en.split("{root}")[0])), "/family/restore/no-scoring-line", null, "edited only", lines);
      c.check(badge(rs.module) === "edited", "/family/restore/badge", null, "edited", badge(rs.module));
      c.check(gates.calibrationGate(rs.module) === true, "/family/restore/calibration", null, true, false);
    }

    // --------------------------------------------------------------- wording
    {
      const d = fresh();
      const it = d.domains[posDomain].items[0];
      it.ask = `${it.ask || it.text} (edited)`;
      const r = await run(M, d);
      c.check(r.validation.ok && r.module.instrumentVersion === M.instrumentVersion && r.identity.versionLocked.instrument, "/wording/ask/locked", null, `${M.instrumentVersion}, locked`, [r.module.instrumentVersion, r.identity.versionLocked]);
      c.check(r.module.hashes.scoringHash === M.hashes.scoringHash && gates.calibrationGate(r.module) === true, "/wording/ask/calibration", null, "scoring equal, calibration applies", null);
      c.check(r.module.cds.examples.settled !== undefined, "/wording/ask/settled-kept", null, "settled example kept (scoring unchanged)", null);
      const d2 = fresh();
      d2.domains[posDomain].items[0].text += " (edited)";
      const r2 = await run(M, d2);
      c.check(r2.validation.ok && /-local\./.test(r2.module.instrumentVersion) && r2.module.hashes.scoringHash === M.hashes.scoringHash && gates.calibrationGate(r2.module), "/wording/text", null, "-local instrument, scoring equal, calibration applies", [r2.module.instrumentVersion, codes(r2.validation)]);
    }

    // ------------------------------------------------------------------- ack
    {
      const d = fresh();
      const loc = derive.findId(d, "m_dur");
      need(loc && Array.isArray(d.domains[loc.di].items[loc.ii].scale), "the built-in has no scale item m_dur");
      const p1 = `/domains/${loc.di}/items/${loc.ii}/scale/2/label`;
      const p2 = "/locales/en/items/r_dur/q";
      d.domains[loc.di].items[loc.ii].scale[2].label += " (edited)";
      d.locales.en.items.r_dur.q += " (edited)";
      const ch = await derive.classifyChanges(M, d, { readsObserved: ro });
      c.check(ch.needsAcknowledgement.includes(p1) && ch.needsAcknowledgement.includes(p2), "/ack/needs", null, [p1, p2], ch.needsAcknowledgement);
      const ack = derive.acknowledgePaths(M, ro);
      const a1 = ack.find((a) => a.path === p1), a2 = ack.find((a) => a.path === p2);
      c.check(a1 && a1.dependents.length && !a1.dependents[0].includes("declared"), "/ack/dependents/m_dur", null, "observed closures", a1 && a1.dependents);
      c.check(a2 && a2.dependents.some((x) => x.startsWith("summary.")), "/ack/dependents/r_dur", null, "a summary rule", a2 && a2.dependents);
      const cases = derive.impactCases(M);
      const sentence = a2 && a2.dependents.map((cid) => cases.map((k) => derive.closureOutput(M, cid, k)).find(Boolean)).find(Boolean);
      c.check(sentence && sentence.kind === "summary" && Object.keys(sentence.sentences).includes("en"), "/ack/sentence", null, "the patient sentence the rule produces", sentence);
      const routed = ack.find((a) => a.dependents.some((x) => x.startsWith("routing:")));
      const heading = routed && routed.dependents.filter((x) => x.startsWith("routing:")).map((cid) => cases.map((k) => derive.closureOutput(M, cid, k)).find(Boolean)).find(Boolean);
      c.check(heading && heading.kind === "routing" && Object.values(heading.headings).some((x) => typeof x === "string" && x), "/ack/heading", null, "a routing heading", heading);
      const r = await run(M, d, { acknowledged: [p1, p2] });
      const last = r.rubric.changelog[r.rubric.changelog.length - 1];
      c.check(r.validation.ok && canon(last.acknowledged) === canon([p1, p2]), "/ack/changelog", null, [p1, p2], last.acknowledged);
    }

    // --------------------------------------------------------------- lexicon
    {
      const d = fresh();
      d.lexicon.bool[0].ph.push("a phrase added by the editor suite");
      const r = await run(M, d);
      c.check(r.validation.ok && new RegExp(`^${M.lexicon.version.replace(/\./g, "\\.")}-local\\.[0-9a-f]{6}$`).test(r.module.lexicon.version), "/lexicon/version", null, "<root lexicon>-local.<hash6>", [r.module.lexicon.version, codes(r.validation)]);
      c.check(r.module.instrumentVersion === M.instrumentVersion, "/lexicon/instrument-locked", null, M.instrumentVersion, r.module.instrumentVersion);
      c.check(r.module.versions.goldSetLexicon && r.module.versions.goldSetLexicon !== r.module.versions.lexicon, "/lexicon/not-re-run", null, "gold set lexicon ≠ lexicon (footer: not re-run)", r.module.versions);
      c.check(canon(r.module.lexicon.goldSet) === canon(M.lexicon.goldSet), "/lexicon/goldSet", null, "the root's gold set", r.module.lexicon.goldSet);
      const z = fresh();
      const fid = Object.keys(z.lexicon.redFlags)[0];
      z.lexicon.redFlags[fid] = [];
      const rz = await run(M, z);
      c.check(codes(rz.validation).includes(`V28 /lexicon/redFlags/${fid}`), "/lexicon/last-cue/V28", null, `V28 /lexicon/redFlags/${fid}`, codes(rz.validation));
    }

    // --------------------------------------------------------------- locales
    {
      const d = fresh();
      d.locales.en.items.r_dur.q += " (edited)";
      const r = await run(M, d);
      const es = r.rubric.locales.es, en = r.rubric.locales.en;
      c.check(Array.isArray(es.stale) && es.stale.includes("/locales/es/items/r_dur/q") && es.reviewed === false, "/locales/es-stale", null, "stale path, reviewed:false", es.stale);
      c.check(en.reviewed === false && en.editedLocally === true, "/locales/en-edited", null, "reviewed:false, editedLocally:true", [en.reviewed, en.editedLocally]);
      c.check(!es.editedLocally, "/locales/es-not-edited", null, "es not edited locally", es.editedLocally);
      const plines = lineage.provenanceLines(r.module, "patient", { locale: "es" });
      c.check(plines.includes(CAV.staleTranslation.en) && !plines.some((l) => policy.OMISSION_PATTERNS.some((re) => re.test(l))), "/locales/stale-line", null, "staleTranslation, no score words", plines);
      const f = fresh();
      const flagId = Object.keys(f.locales.en.redFlags)[0];
      f.locales.en.redFlags[flagId].q += " (edited)";
      const ch = await derive.classifyChanges(M, f, { readsObserved: ro });
      c.check(ch.staleRedFlagPaths.includes(`/locales/es/redFlags/${flagId}/q`), "/locales/staleRedFlag", null, `/locales/es/redFlags/${flagId}/q`, ch.staleRedFlagPaths);
      // Updating the translation together with the English leaves nothing stale.
      f.locales.es.redFlags[flagId].q += " (editado)";
      const ch2 = await derive.classifyChanges(M, f, { readsObserved: ro });
      c.check(!ch2.staleRedFlagPaths.length, "/locales/staleRedFlag/updated", null, [], ch2.staleRedFlagPaths);
      // A hand-edited file (Load as derived) typing "reviewed": true into an unreviewed locale:
      // the derivation never raises a locale's reviewed above its parent's, so the
      // unreviewed-translation banner stays (audit e9).
      const hv = fresh();
      hv.domains[posDomain].items[0].text += " (edited)";
      c.check(M.rubric.locales.es.reviewed === false, "/locales/reviewed/root-es", null, false, M.rubric.locales.es.reviewed);
      hv.locales.es.reviewed = true;
      const rv = await run(M, hv);
      c.check(rv.validation.ok && rv.rubric.locales.es.reviewed === false && rv.rubric.locales.en.reviewed === M.rubric.locales.en.reviewed,
        "/locales/reviewed/never-rises", null, "es reviewed:false (as the parent's), en unchanged", [rv.rubric.locales.es.reviewed, rv.rubric.locales.en.reviewed, codes(rv.validation)]);
    }

    // -------------------------------------------------------------- add item
    {
      const r = M.rubric;
      const neg = r.domains.find((x) => x.negative);
      const pos = r.domains[posDomain];
      const p = (spec) => derive.newItemProblems(r, spec).map((x) => `${x.code}:${x.field}`);
      const base = { id: "zz_new", domain: pos.key, type: "boolean", w: 2, text: "Placeholder item text", q: "Placeholder question?" };
      c.check(!p(base).length, "/add/valid", base, [], p(base));
      c.check(p({ ...base, id: "Bad-Id" }).includes("V11:id"), "/add/id-pattern", null, "V11", p({ ...base, id: "Bad-Id" }));
      c.check(p({ ...base, id: r.domains[0].items[0].id }).includes("V11:id"), "/add/id-taken", null, "V11", null);
      c.check(p({ ...base, id: r.redFlags[0].id }).includes("V11:id"), "/add/id-flag-namespace", null, "V11", null);
      c.check(p({ ...base, domain: "nope" }).includes("V10:domain"), "/add/domain", null, "V10", null);
      if (neg) c.check(p({ ...base, domain: neg.key, w: 3 }).includes("V15:w"), "/add/sign", null, "V15", null);
      c.check(p({ ...base, q: "" }).includes("V32:q"), "/add/patient-q", null, "V32", null);
      const sc = { ...base, type: "scale", options: [{ label: "A", f: 0.5 }, { label: "B", f: 1 }], patientOpts: ["a", "b"] };
      c.check(p(sc).includes("V13:options"), "/add/scale-zero", null, "V13 (no f = 0)", p(sc));
      const ok = { ...sc, options: [{ label: "A", f: 0 }, { label: "B", f: 1 }] };
      c.check(!p(ok).length, "/add/scale-valid", null, [], p(ok));
      let d = derive.addItem(r, { ...base, lexicon: { ph: ["placeholder phrase"] } });
      const ra = await run(M, d);
      c.check(codes(ra.validation).includes(`V15 /domains/${posDomain}/max`), "/add/V15-until-max", null, "V15 at the domain max", codes(ra.validation));
      d = derive.setMaxToSum(d, posDomain);
      const rb = await run(M, d);
      c.check(rb.validation.ok, "/add/valid-after-max", null, "no errors", codes(rb.validation));
      c.check(!derive.lockViolations(M, d).length, "/add/no-lock", null, [], derive.lockViolations(M, d));
      const reordered = derive.createDraft(M).rubric;
      reordered.domains.reverse();
      c.check(derive.lockViolations(M, reordered).some((v) => v.path === "/domains"), "/add/domains-reorder-locked", null, "/domains", derive.lockViolations(M, reordered));
      const removed = derive.createDraft(M).rubric;
      removed.domains.pop();
      c.check(derive.lockViolations(M, removed).some((v) => v.path === "/domains"), "/add/domains-remove-locked", null, "/domains", null);
      const added = derive.createDraft(M).rubric;
      added.domains.push({ key: "zz_extra", label: "Extra", max: 1, items: [{ id: "zz_x", w: 1, text: "x" }] });
      c.check(derive.lockViolations(M, added).some((v) => v.path === "/domains"), "/add/domains-add-locked", null, "/domains", null);
      // Deleting: an item the logic reads cannot go; a new one can, with its dependents.
      const readId = Object.keys(M.logic.reads.items)[0];
      c.check(!derive.canDeleteItem(M, readId), "/add/delete-read-item", null, false, true);
      const back = derive.deleteItem(derive.addItem(r, { ...base, lexicon: { ph: ["placeholder phrase"] } }), "zz_new");
      c.check(canon(back) === canon(r), "/add/delete-new-item", null, "back to the parent", derive.diffRubrics(r, back).map((x) => x.path));
    }

    // ----------------------------------------------------------------- shape
    {
      const shapeRubric = await h.fixture("modules/shape.rubric.json");
      const bare = JSON.parse(JSON.stringify(shapeRubric));
      delete bare.locales;
      bare.id = "shape-bare";
      bare.label = "Shape fixture without patient wording";
      const [bind, validate] = await Promise.all([h.engine("bind.js"), h.engine("validate.js")]);
      const cls = await lineage.classifyLineage(bare, { builtins: [M], loaded: [M] });
      const text = bind.serializeRubric(bare);
      const S = await bind.bindModule(bare, null, { origin: cls.origin, classification: cls, key: "fixture:shape-bare", sources: { rubricText: text, logicText: null }, files: { rubric: { name: "shape-bare.rubric.json", text, sha256: await hash.sha256Hex(text) }, logic: null }, loadedAt: NOW });
      const SV = await validate.validateModule({ module: S, loaded: [M] });
      c.check(SV.ok && S.origin === "uploaded" && !S.lexicon && !lineage.availability(S).patient.available, "/shape/base", null, "an upload without lexicon or patient wording", [codes(SV), S.origin]);
      // Create lexicon.
      let d = derive.createLexicon(derive.createDraft(S).rubric, M.lexicon);
      c.check(canon(d.lexicon.negation) === canon(M.lexicon.negation) && canon(d.lexicon.thirdParty) === canon(M.lexicon.thirdParty) && canon(d.lexicon.historical) === canon(M.lexicon.historical), "/shape/lexicon/cues-verbatim", null, "copied verbatim", null);
      c.check(d.lexicon.lang === "en-US" && d.lexicon.goldSet === null && !d.lexicon.bool.length, "/shape/lexicon/empty", null, "lang en-US, goldSet null, empty lists", d.lexicon);
      const lx = await derive.deriveAndBind(S, d, { loaded: [M, S], now: NOW, note: "create lexicon" });
      const v28 = codes(lx.validation).filter((x) => x.startsWith("V28 /lexicon/redFlags/"));
      c.check(v28.length === bare.redFlags.length, "/shape/lexicon/V28-every-flag", null, `${bare.redFlags.length} × V28`, codes(lx.validation));
      for (const f of bare.redFlags) d.lexicon.redFlags[f.id] = ["placeholder cue phrase"];
      // Create English patient wording.
      d = derive.createEnglishPatientWording(d);
      const pw = await derive.deriveAndBind(S, d, { loaded: [M, S], now: NOW, note: "create wording" });
      const v23 = codes(pw.validation).filter((x) => /^V(23|32) /.test(x));
      c.check(v23.length >= bare.redFlags.length, "/shape/patient/V23-V32", null, "V23/V32 list what is missing", codes(pw.validation));
      for (const dm of bare.domains) for (const it of dm.items) d.locales.en.items[it.id] = it.scale ? { q: "Placeholder question?", opts: it.scale.map((_, k) => `Placeholder answer ${k}`) } : { q: "Placeholder question?" };
      for (const f of bare.redFlags) d.locales.en.redFlags[f.id] = { q: "Placeholder flag question?", say: "Placeholder flag advice." };
      const done = await derive.deriveAndBind(S, d, { loaded: [M, S], now: NOW, note: "lexicon and patient wording" });
      c.check(done.validation.ok, "/shape/derived/ok", null, "no errors", codes(done.validation));
      c.check(done.module.origin === "derived" && done.module.classification.kind === "derived-from-upload" && done.module.classification.row === 6, "/shape/derived/row6", null, "derived from an upload (row 6)", done.module.classification);
      c.check(done.rubric.locales.en.reviewed === false && done.rubric.locales.en.editedLocally === true, "/shape/derived/unreviewed", null, "reviewed:false, editedLocally:true", done.rubric.locales.en);
      c.check(/^0\.1-local\.[0-9a-f]{6}$/.test(done.module.lexicon.version), "/shape/derived/lexicon-version", null, "0.1-local.<hash6>", done.module.lexicon.version);
      c.check(done.rubric.logicBinding === "generic" && lineage.availability(done.module).research.population === false, "/shape/derived/generic-no-population", null, "generic, no population", null);
      c.check(badge(done.module) === "edited · uploaded", "/shape/derived/badge", null, "edited · uploaded", badge(done.module));
    }

    // -------------------------------------------------------------- identity
    {
      const ch = await derive.classifyChanges(M, d1draft, { readsObserved: ro });
      const idn = derive.proposeIdentity(M, d1draft, ch, [M, M1], { now: NOW });
      const probs = derive.identityProblems({ ...idn, label: `  ${M.label.toUpperCase()} ` }, { classification: ch, identity: idn, loaded: [M, M1] });
      c.check(probs.some((p) => p.field === "label" && /belongs to a built-in module/.test(p.msg)), "/identity/builtin-label", null, "refused", probs);
      const forced = await run(M, d1draft, { overrides: { label: M.label } });
      c.check(codes(forced.validation).some((x) => x.startsWith("V8")), "/identity/builtin-label/V8", null, "V8", codes(forced.validation));
      const again = derive.proposeIdentity(M, d1draft, ch, [M, M1], { now: NOW });
      c.check(again.id === `${M1.id}-2`, "/identity/id-collision", null, `${M1.id}-2`, again.id);
      c.check(again.label === `${M1.label} (2)`, "/identity/label-collision", null, `${M1.label} (2)`, again.label);
      const solo = derive.proposeIdentity(M, d1draft, ch, [M], { now: NOW });
      c.check(solo.versionLocked.instrument === null, "/identity/unlocked", null, "free (only the root loaded)", solo.versionLocked);
      const noTag = derive.identityProblems({ ...solo, instrumentVersion: "9.9" }, { classification: ch, identity: solo, loaded: [M] });
      c.check(noTag.some((p) => p.field === "instrumentVersion"), "/identity/local-tag", null, "the -local tag is required", noTag);
      const sameAsRoot = derive.identityProblems({ ...solo, instrumentVersion: M.instrumentVersion }, { classification: ch, identity: solo, loaded: [M] });
      c.check(sameAsRoot.some((p) => p.field === "instrumentVersion"), "/identity/root-version-refused", null, "refused", sameAsRoot);
      c.check(derive.proposeIdentity(M, d1draft, ch, [M], { now: NOW }).id === solo.id && solo.id === M1.id, "/identity/deterministic", null, M1.id, solo.id);
    }

    // ----------------------------------------------------------------- locks
    {
      const d = fresh();
      d.id = "changed";
      d.domains[0].key = "changed_key";
      d.domains[0].items[0].id = "changed_id";
      d.redFlags[0].id = "changed_flag";
      d.instrumentVersion = "9.9";
      d.logicBinding = "generic";
      const v = derive.lockViolations(M, d).map((x) => x.path);
      for (const p of ["/id", "/instrumentVersion", "/logicBinding"]) c.check(v.includes(p), `/locks${p}`, null, "locked", v);
      c.check(v.some((p) => p.startsWith("/domains")), "/locks/domain-key", null, "locked", v);
      for (const p of ["/id", "/instrumentVersion", "/lexicon/version", "/logicBinding", "/domains/0/key", "/domains/0/items/0/id", "/redFlags/0/id", "/lexicon/goldSet", "/locales/es/reviewed"]) {
        c.check(derive.lockReason(p) !== null, `/locks/reason${p}`, null, "a lock reason", derive.lockReason(p));
      }
      for (const p of ["/label", "/domains/0/items/0/w", "/domains/0/items/0/text", "/bands/cuts/high", "/locales/en/items/r_dur/q", "/lexicon/negation/window", "/copy/indexName"]) {
        c.check(derive.isEditablePath(p), `/locks/editable${p}`, null, "editable", derive.lockReason(p));
      }
      // Read items keep their option count.
      const sc = fresh();
      const loc = derive.findId(sc, "m_dur");
      sc.domains[loc.di].items[loc.ii].scale.pop();
      c.check(derive.lockViolations(M, sc).some((x) => x.path.endsWith("/scale")), "/locks/read-scale-count", null, "locked", derive.lockViolations(M, sc));
      // Revert one change and revert all.
      const e = fresh();
      e.domains[0].items[0].text += " (edited)";
      e.bands.cuts.high += 1;
      const diff = derive.diffRubrics(M.rubric, e);
      c.check(diff.length === 2, "/revert/diff", null, 2, diff.map((x) => x.path));
      let back = e;
      for (const ch of diff) back = derive.revertChange(back, M.rubric, ch);
      c.check(canon(back) === canon(M.rubric), "/revert/each", null, "the parent", derive.diffRubrics(M.rubric, back));
      const add = derive.addItem(M.rubric, { id: "zz_rev", domain: M.rubric.domains[posDomain].key, type: "boolean", w: 1, text: "x", q: "x?" });
      let b2 = add;
      for (const ch of derive.diffRubrics(M.rubric, add)) b2 = derive.revertChange(b2, M.rubric, ch);
      c.check(canon(b2) === canon(M.rubric), "/revert/added-item", null, "the parent", derive.diffRubrics(M.rubric, b2));
      // setAt refuses path segments that would reach a prototype (hardening).
      for (const p of ["/__proto__/polluted", "/domains/0/constructor/prototype/polluted", "/copy/prototype"]) {
        let threw = false;
        try { derive.setAt({ domains: [{}], copy: {} }, p, "x"); } catch (_) { threw = true; }
        c.check(threw && ({}).polluted === undefined && Object.prototype.polluted === undefined, `/setAt/refuses${p}`, null, "throws, nothing polluted", threw);
      }
      c.check(derive.getAt(derive.setAt({}, "/copy/indexName", "x"), "/copy/indexName") === "x", "/setAt/plain", null, "x", "not set");
    }

    c.note(`MASQUE readsObserved: ${Object.keys(ro.items || {}).length} items; acknowledgePaths: ${derive.acknowledgePaths(M, ro).length} fields`);
    return c.result();
  }),
};
