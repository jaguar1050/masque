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
//                 the last cue phrase of a flag removed → V28; a yes/no phrase, or a cue and a
//                 band phrase of the heard entry, added → every scale entry's heard, carry,
//                 yieldTo and anchor, carryRefuse and normalize kept as the root's (0.3.2-local)
//   capture       (design 05 §5.3, §7.2) heard / carry / carryExclude / yieldTo / anchor /
//                 carryRefuse / normalize are locked with a reason that says "approved lexicon
//                 configuration" and never claims any module's clinical-lead approval (round 2
//                 R6); a child naming a new item in a yield rule deletes it with the yield rule
//                 restored, no lock violation and no V28; a direct edit of any of those fields is
//                 a "Read-only" lock violation, also when it rides along with a deletion (round 2
//                 R7: deleting an unrelated red flag, or an item, exempts nothing else under
//                 /lexicon/scale). Round 3 (review T8, R13): deleting an item that owns a scale
//                 entry (carrying heard / carry / carryExclude) with entries after it is no lock
//                 violation; a whole added scale entry carrying heard or carryExclude is; a
//                 /lexicon/multi edit riding along with an item or a red-flag deletion is
//                 (DER-R7-1), while deleting an item named in multi-answer entries is not; and
//                 deleteItem removes duplicate entries of one id at /lexicon/scale/2 and /10
//                 without touching /11 (numeric order, DER-R7-2)
//   locales       English edit → es stale path and reviewed:false, stale-translation line (in
//                 Spanish for es since release 0.4.2, lang es; English for en);
//                 an English red-flag edit → staleRedFlagPaths; release 0.4.2 (D3): an es clin
//                 line survives a derivation, a patientClin edit makes it stale, and a clin in
//                 English or an empty one is V32; changedClinItems (read by deriveRubric and by
//                 the editor's "English changed" tag) follows patientClin or, without one, the
//                 item text, by item id
//   add-item      the Add item rules (V11, V13, V15, V32) and a valid item round trip;
//                 domains cannot be added, removed or reordered (lockViolations)
//   shape         Create lexicon (V28 names every flag) and Create English patient wording
//                 (V23/V32), then a valid derivation of the upload (row 6)
//   emr           (release 0.4.3) /emrTemplate and every pointer below it are locked with the
//                 clinical-lead reason (since release 0.4.4 it names the sign-off); any direct
//                 edit of the block (a label, a URL, a reorder, an added citation or key, a
//                 removed row, the whole block) is a Read-only
//                 lock violation; deleting a red flag removes exactly its redFlagRefs and
//                 redFlagPlaceholders entries (listed by flagDeletePlan; the placeholder case is
//                 checked on its own flag) and deleting an item exactly the history rows and checklist
//                 signals naming it (listed by itemDependents), with no lock violation, while an edit
//                 riding along is still one; a derivation keeps the block byte for byte before the
//                 change log, and the flag deletion leaves no V61 error
//   referral      (release 0.4.5) phenotypes.referral with the clinical lead's clinician rule
//                 stays locked like /phenotypes: every pointer below it read-only, any edit (a
//                 destination, the both row, a definition or clarification line, the rule text, a
//                 placeholder label, removing the rule) a Read-only lock violation, and a derivation
//                 keeps it byte for byte
//   identity      a label equal to a built-in's is refused; id and label collisions get -2 / (2)
//   locks         locked fields are reported; revertChange and Revert all restore the parent
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
const arr = (x) => (Array.isArray(x) ? x : []);
// The lexicon's capture configuration (design 05 §1-§4, §11.6): read-only in the editor, so a
// derivation must carry it unchanged.
const captureConfig = (lx) => ({
  scale: (lx && Array.isArray(lx.scale) ? lx.scale : []).map((e) => ({ id: e.id, heard: e.heard, carry: e.carry, yieldTo: e.yieldTo, anchor: e.anchor, carryExclude: e.carryExclude })),
  carryRefuse: lx ? lx.carryRefuse : undefined,
  normalize: lx ? lx.normalize : undefined,
});

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
      c.check(m.label === `${M.label} — edited ${NOW.slice(0, 10)}`, "/instrument/label", null, `${M.label} — edited ${NOW.slice(0, 10)}`, m.label);
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
      // The capture configuration survives the derivation unchanged (design 05 §7.2 editor b).
      const rootCfg = captureConfig(M.lexicon);
      c.check(M.lexicon.version === "0.3.2" && rootCfg.scale.some((e) => e.heard === true) && rootCfg.scale.some((e) => Array.isArray(e.yieldTo)) && Array.isArray(rootCfg.carryRefuse) && !!rootCfg.normalize,
        "/lexicon/capture-config/root", null, "lexicon 0.3.2 with heard, yieldTo, carryRefuse and normalize", [M.lexicon.version, rootCfg]);
      c.check(/^0\.3\.2-local\.[0-9a-f]{6}$/.test(r.module.lexicon.version), "/lexicon/capture-config/version", null, "0.3.2-local.<hash6>", r.module.lexicon.version);
      c.check(canon(captureConfig(r.module.lexicon)) === canon(rootCfg), "/lexicon/capture-config/kept", { edit: "yes/no phrase added" }, rootCfg, captureConfig(r.module.lexicon));
      c.check(canon(captureConfig(r.rubric.lexicon)) === canon(rootCfg), "/lexicon/capture-config/kept-rubric", { edit: "yes/no phrase added" }, rootCfg, captureConfig(r.rubric.lexicon));
      const hi = M.lexicon.scale.findIndex((e) => e.heard === true);
      if (hi >= 0) {
        const b = fresh();
        b.lexicon.scale[hi].cue.push("a cue phrase added by the editor suite");
        b.lexicon.scale[hi].bands[0].ph.push("a band phrase added by the editor suite");
        const rb = await run(M, b);
        c.check(rb.validation.ok && /^0\.3\.2-local\.[0-9a-f]{6}$/.test(rb.module.lexicon.version), "/lexicon/capture-config/band-edit/ok", null, "no errors, 0.3.2-local.<hash6>", [rb.module.lexicon.version, codes(rb.validation)]);
        c.check(canon(captureConfig(rb.module.lexicon)) === canon(rootCfg), "/lexicon/capture-config/band-edit/kept", { edit: `cue and band phrase on /lexicon/scale/${hi}` }, rootCfg, captureConfig(rb.module.lexicon));
        c.check(rb.module.versions.goldSetLexicon && rb.module.versions.goldSetLexicon !== rb.module.versions.lexicon, "/lexicon/capture-config/band-edit/not-re-run", null, "gold set lexicon ≠ lexicon (footer: not re-run)", rb.module.versions);
      }
      const z = fresh();
      const fid = Object.keys(z.lexicon.redFlags)[0];
      z.lexicon.redFlags[fid] = [];
      const rz = await run(M, z);
      c.check(codes(rz.validation).includes(`V28 /lexicon/redFlags/${fid}`), "/lexicon/last-cue/V28", null, `V28 /lexicon/redFlags/${fid}`, codes(rz.validation));
    }

    // --------------------------------------------------------------- capture
    {
      // (a) Locks, at the indices the approval record names (scale 1 = the heard entry, scale 2
      // = the yielding entry), checked by id so a reordered lexicon cannot pass by accident.
      const sc = M.lexicon.scale;
      c.check(sc[1] && sc[1].id === "v_vertigo" && sc[1].heard === true && Number.isInteger(sc[1].carry) && sc[2] && sc[2].id === "m_dur" && Array.isArray(sc[2].yieldTo) && Array.isArray(sc[2].anchor),
        "/capture/indices", null, "scale 1 v_vertigo (heard, carry), scale 2 m_dur (yieldTo, anchor)", sc.map((e) => [e.id, Object.keys(e)]));
      c.check(!!sc[1] && Array.isArray(sc[1].carryExclude) && sc[1].carryExclude.length > 0, "/capture/indices/carryExclude", null, "scale 1 v_vertigo has carryExclude (round 2 R3a)", sc[1] && sc[1].carryExclude);
      const lockedPaths = ["/lexicon/scale/1/heard", "/lexicon/scale/1/carry", "/lexicon/scale/1/carryExclude", "/lexicon/scale/1/carryExclude/0",
        "/lexicon/scale/2/yieldTo", "/lexicon/scale/2/anchor", "/lexicon/scale/2/anchor/0",
        "/lexicon/carryRefuse", "/lexicon/carryRefuse/0", "/lexicon/normalize", "/lexicon/normalize/numbers"];
      for (const p of lockedPaths) c.check(derive.lockReason(p) !== null, `/capture/lock${p}`, null, "a lock reason", derive.lockReason(p));
      // The engine is module-agnostic: its lock reasons cannot know who approved a module's
      // configuration (round 2 R6, review F8).
      for (const p of lockedPaths) {
        const why = derive.lockReason(p) || "";
        c.check(why.includes("approved lexicon configuration") && !/clinical[- ]lead/i.test(why), `/capture/lock-wording${p}`, null,
          "\"… approved lexicon configuration …\", no clinical-lead claim", why);
      }
      for (const p of ["/lexicon/scale/1/cue/0", "/lexicon/scale/1/bands/0/ph/0", "/lexicon/scale/2/cue"]) {
        c.check(derive.isEditablePath(p), `/capture/editable${p}`, null, "editable", derive.lockReason(p));
      }

      // (c) Deletion: a child that adds a yes/no item and names it in the yield rule (written
      // straight into the draft; the editor itself would refuse that edit, see (d)).
      const r = M.rubric;
      const yi = r.lexicon.scale.findIndex((e) => Array.isArray(e.yieldTo));
      if (c.check(yi >= 0, "/capture/delete/yield-entry", null, "a scale entry with yieldTo", null)) {
        let d = derive.addItem(r, { id: "zz_new", domain: r.domains[posDomain].key, type: "boolean", w: 2, text: "Placeholder item text", q: "Placeholder question?", lexicon: { ph: ["placeholder phrase"] } });
        d = derive.setMaxToSum(d, posDomain);
        d.lexicon.scale[yi].yieldTo.push("zz_new");
        const child = await run(M, d, { note: "a child naming a new item in a yield rule" });
        c.check(child.validation.ok, "/capture/delete/child-ok", null, "no errors", codes(child.validation));
        const CM = child.module;
        c.check(canon(CM.lexicon.scale[yi].yieldTo) === canon([...r.lexicon.scale[yi].yieldTo, "zz_new"]), "/capture/delete/child-yieldTo", null, [...r.lexicon.scale[yi].yieldTo, "zz_new"], CM.lexicon.scale[yi].yieldTo);
        c.check(derive.canDeleteItem(CM, "zz_new"), "/capture/delete/can-delete", null, true, false);
        const draft = derive.deleteItem(derive.createDraft(CM).rubric, "zz_new");
        const ye = draft.lexicon.scale[yi], ry = r.lexicon.scale[yi];
        c.check(canon(ye.yieldTo) === canon(ry.yieldTo) && canon(ye.anchor) === canon(ry.anchor), "/capture/delete/yieldTo-restored", null, { yieldTo: ry.yieldTo, anchor: ry.anchor }, { yieldTo: ye.yieldTo, anchor: ye.anchor });
        c.check(!derive.findId(draft, "zz_new") && !draft.lexicon.bool.some((e) => e.id === "zz_new"), "/capture/delete/item-gone", null, "item and its phrases removed", null);
        const lv = derive.lockViolations(CM, draft);
        c.check(!lv.length, "/capture/delete/no-lock", null, [], lv);
        const back = await derive.deriveAndBind(CM, draft, { loaded: [M, CM], now: NOW, note: "delete the new item" });
        const v28 = codes(back.validation).filter((x) => x.startsWith("V28 "));
        c.check(!v28.length, "/capture/delete/no-V28", null, "no V28", codes(back.validation));
        // Round 2 R7: the deletion exempts only what it produces; a locked edit of another scale
        // entry riding along with it is still a lock violation.
        const ride = JSON.parse(JSON.stringify(draft));
        ride.lexicon.scale[1].carry = ride.lexicon.scale[1].carry === 1 ? 2 : 1;
        const lvRide = derive.lockViolations(CM, ride);
        c.check(lvRide.some((v) => v.path === "/lexicon/scale/1/carry" && v.msg.startsWith("Read-only")), "/capture/delete/ride-along-carry", { edit: "delete zz_new + change /lexicon/scale/1/carry" },
          "Read-only at /lexicon/scale/1/carry", lvRide);
      }

      // (e) Round 2 R7 (review F10 / ENG-2 / UI-2): a red-flag deletion never touches the scale
      // entries, so it exempts nothing under /lexicon/scale. Delete a flag the logic does not read
      // (no lock violation on its own), then also set /lexicon/scale/0/heard: a lock violation.
      {
        const flag = arr(M.rubric.redFlags).map((f) => f && f.id).find((id) => derive.flagDeletePlan(M, M.rubric, id).allowed) || null;
        if (c.check(!!flag, "/capture/flag-delete/flag", null, "a red flag the logic does not read", null)) {
          const base = derive.deleteFlag(M, fresh(), flag);
          const lv0 = derive.lockViolations(M, base);
          c.check(!lv0.length, "/capture/flag-delete/no-lock", { flag }, [], lv0);
          const x = JSON.parse(JSON.stringify(base));
          x.lexicon.scale[0].heard = x.lexicon.scale[0].heard === true ? false : true;
          const lv = derive.lockViolations(M, x);
          const hit = lv.find((v) => v.path === "/lexicon/scale/0/heard");
          c.check(!!hit && hit.code === "LOCK" && hit.msg.startsWith("Read-only") && hit.msg.includes("approved lexicon configuration"), "/capture/flag-delete/heard-locked",
            { flag, edit: "/lexicon/scale/0/heard" }, "LOCK at /lexicon/scale/0/heard (Read-only: … approved lexicon configuration …)", lv);
        }
      }

      // (f) Round 3 (review T8; R13, DER-R7-1 and DER-R7-2): the other branches of the deletion
      // exemption. lockViolations reads only the parent's rubric and logic, so the hand-built
      // parents here are {rubric, logic: the built-in's logic}.
      {
        const parentOf = (rubric) => ({ rubric, logic: M.logic });
        const domain = r.domains[posDomain].key;
        const scaleSpec = {
          id: "zz_scale", domain, type: "scale", w: 2, text: "Placeholder scale item text", q: "Placeholder scale question?",
          options: [{ label: "Placeholder none", f: 0 }, { label: "Placeholder some", f: 1 }], patientOpts: ["Placeholder none", "Placeholder some"],
          lexicon: { cue: ["placeholder scale cue"], bands: [{ ph: ["placeholder scale band"], v: 1 }] },
        };
        const boolSpec = (id) => ({ id, domain, type: "boolean", w: 2, text: "Placeholder item text", q: "Placeholder question?" });
        const ids = (xs) => arr(xs).map((e) => e && e.id);

        // (f1) Deleting an item that owns a scale entry, with entries after it: the entry goes
        // (its heard, carry and carryExclude with it), every later entry shifts up, and nothing
        // is a lock violation. The child's own entry is put first, so all of the built-in's
        // entries (heard, carry, carryExclude, yieldTo, anchor) sit after it.
        const p1 = derive.setMaxToSum(derive.addItem(r, scaleSpec), posDomain);
        const own = p1.lexicon.scale.pop();
        Object.assign(own, { heard: true, carry: 1, carryExclude: ["placeholder scale band"] });
        p1.lexicon.scale.unshift(own);
        c.check(ids(p1.lexicon.scale).join() === ["zz_scale", ...ids(r.lexicon.scale)].join(), "/capture/delete-scale-item/fixture", null,
          ["zz_scale", ...ids(r.lexicon.scale)], ids(p1.lexicon.scale));
        const del1 = derive.deleteItem(p1, "zz_scale");
        c.check(canon(del1.lexicon.scale) === canon(r.lexicon.scale), "/capture/delete-scale-item/entries", null, ids(r.lexicon.scale), ids(del1.lexicon.scale));
        const lv1 = derive.lockViolations(parentOf(p1), del1);
        c.check(!lv1.length, "/capture/delete-scale-item/no-lock", { deleted: "zz_scale, its entry at /lexicon/scale/0 with heard, carry and carryExclude" }, [], lv1);

        // (f2) A whole scale entry added by the draft must not bring locked fields in with it.
        const p2 = derive.setMaxToSum(derive.addItem(r, scaleSpec), posDomain);
        const n2 = p2.lexicon.scale.length - 1;
        const lv2plain = derive.lockViolations(M, p2);
        c.check(!lv2plain.length, "/capture/added-entry/plain", { added: `/lexicon/scale/${n2}` }, [], lv2plain);
        const p2cfg = JSON.parse(JSON.stringify(p2));
        Object.assign(p2cfg.lexicon.scale[n2], { heard: true, carryExclude: ["placeholder scale band"] });
        const lv2 = derive.lockViolations(M, p2cfg);
        for (const k of ["heard", "carryExclude"]) {
          const at = `/lexicon/scale/${n2}/${k}`;
          const hit = lv2.find((v) => v.path === at);
          c.check(!!hit && hit.code === "LOCK" && hit.msg.startsWith("Read-only"), `/capture/added-entry/${k}`, { added: `/lexicon/scale/${n2}`, with: k }, `LOCK at ${at}`, lv2);
        }

        // (f3) DER-R7-1: an item or red-flag deletion exempts only what deleteItem does to the
        // multi-answer entries. A changed answer value riding along is a lock violation.
        const k3 = arr(r.lexicon && r.lexicon.multi).findIndex((e) => e && typeof e === "object" && arr(e.ids).length > 0);
        if (c.check(k3 >= 0, "/capture/multi/entry", null, "a multi-answer entry with ids", null)) {
          const mp = `/lexicon/multi/${k3}/ids/0/value`;
          const editValue = (rubric) => {
            const x = JSON.parse(JSON.stringify(rubric));
            x.lexicon.multi[k3].ids[0].value = `${x.lexicon.multi[k3].ids[0].value} (edited)`;
            return x;
          };
          const lvItem = derive.lockViolations(parentOf(p1), editValue(del1));
          c.check(lvItem.some((v) => v.path === mp && v.code === "LOCK"), "/capture/multi/item-delete-ride-along", { edit: `delete zz_scale + change ${mp}` }, `LOCK at ${mp}`, lvItem);
          const flag = arr(M.rubric.redFlags).map((f) => f && f.id).find((id) => derive.flagDeletePlan(M, M.rubric, id).allowed) || null;
          if (flag) {
            const lvFlag = derive.lockViolations(M, editValue(derive.deleteFlag(M, fresh(), flag)));
            c.check(lvFlag.some((v) => v.path === mp && v.code === "LOCK"), "/capture/multi/flag-delete-ride-along", { edit: `delete ${flag} + change ${mp}` }, `LOCK at ${mp}`, lvFlag);
          }
          // Deleting an item named in multi-answer entries: it leaves every ids list, and an entry
          // left with no ids goes. Exactly that is exempt.
          const p4 = derive.setMaxToSum(derive.addItem(r, { ...boolSpec("zz_multi"), lexicon: { ph: ["placeholder multi item phrase"] } }), posDomain);
          p4.lexicon.multi[k3].ids.push({ id: "zz_multi", value: "yes", kind: "item" });
          p4.lexicon.multi.push({ ids: [{ id: "zz_multi", value: "yes", kind: "item" }], ph: ["placeholder multi phrase"] });
          const del4 = derive.deleteItem(p4, "zz_multi");
          c.check(canon(del4.lexicon.multi) === canon(r.lexicon.multi), "/capture/multi/delete-item/entries", null, r.lexicon.multi, del4.lexicon.multi);
          const lv4 = derive.lockViolations(parentOf(p4), del4);
          c.check(!lv4.length, "/capture/multi/delete-item/no-lock", { deleted: "zz_multi, named in two multi-answer entries" }, [], lv4);
        }

        // (f4) DER-R7-2: duplicate scale entries of one id at /lexicon/scale/2 and /10. Both go,
        // and the entry after them survives (a string sort spliced /2 first, then the original
        // /11 at the shifted index 10).
        const p5 = derive.addItem(r, boolSpec("zz_dup"));
        const entry = (id, k) => ({ id, cue: [`placeholder ${id} cue ${k}`], bands: [{ ph: [`placeholder ${id} band ${k}`], v: 1 }], fallback: null });
        const s5 = [...arr(r.lexicon.scale).slice(0, 2), entry("zz_dup", 1), ...arr(r.lexicon.scale).slice(2)];
        let kf = 1;
        while (s5.length < 10) s5.push(entry(`zz_fill_${kf}`, kf++));
        const survivor = `zz_fill_${kf}`;
        s5.push(entry("zz_dup", 2), entry(survivor, kf));
        p5.lexicon.scale = JSON.parse(JSON.stringify(s5));
        const dupAt = ids(p5.lexicon.scale).map((id, i) => (id === "zz_dup" ? i : -1)).filter((i) => i >= 0);
        if (c.check(dupAt.join() === "2,10", "/capture/delete-duplicates/fixture", null, [2, 10], dupAt)) {
          const del5 = derive.deleteItem(p5, "zz_dup");
          const want = ids(p5.lexicon.scale).filter((id) => id !== "zz_dup");
          c.check(ids(del5.lexicon.scale).join() === want.join(), "/capture/delete-duplicates/entries", { survivor }, want, ids(del5.lexicon.scale));
          const lv5 = derive.lockViolations(parentOf(p5), del5);
          c.check(!lv5.length, "/capture/delete-duplicates/no-lock", null, [], lv5);
        }
      }

      // (d) A direct edit of a read-only capture field is a lock violation.
      const ro2 = (edit, prefix, mutate) => {
        const x = fresh();
        mutate(x.lexicon);
        const lv = derive.lockViolations(M, x);
        c.check(lv.some((v) => v.path.startsWith(prefix) && v.msg.startsWith("Read-only")), `/capture/direct-edit/${edit}`, null, `Read-only at ${prefix}`, lv);
      };
      if (yi >= 0) {
        ro2("yieldTo", `/lexicon/scale/${yi}/yieldTo`, (lx) => { lx.scale[yi].yieldTo.push(lx.bool[0].id); });
        ro2("anchor", `/lexicon/scale/${yi}/anchor`, (lx) => { lx.scale[yi].anchor = [...(lx.scale[yi].anchor || []), "an anchor added by the editor suite"]; });
      }
      ro2("heard", "/lexicon/scale/1/heard", (lx) => { lx.scale[1].heard = lx.scale[1].heard === true ? false : true; });
      ro2("carry", "/lexicon/scale/1/carry", (lx) => { lx.scale[1].carry = lx.scale[1].carry === 1 ? 2 : 1; });
      ro2("carryExclude-remove", "/lexicon/scale/1/carryExclude", (lx) => { lx.scale[1].carryExclude = arr(lx.scale[1].carryExclude).slice(1); });
      ro2("carryExclude-add", "/lexicon/scale/1/carryExclude", (lx) => {
        const extra = arr(lx.scale[1].bands).flatMap((b) => arr(b && b.ph)).find((ph) => !arr(lx.scale[1].carryExclude).includes(ph));
        lx.scale[1].carryExclude = [...arr(lx.scale[1].carryExclude), extra || "a band phrase added by the editor suite"];
      });
      ro2("carryRefuse", "/lexicon/carryRefuse", (lx) => { lx.carryRefuse = [...(lx.carryRefuse || []), "a refusal added by the editor suite"]; });
      ro2("normalize", "/lexicon/normalize", (lx) => { if (lx.normalize === undefined) lx.normalize = { apostrophes: true }; else delete lx.normalize; });
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
      // Release 0.4.2: the patient caveats follow the patient locale, so the es line is the Spanish
      // stale-translation caveat (and never the English one); the English locale keeps English.
      const plines = lineage.provenanceLines(r.module, "patient", { locale: "es" });
      c.check(plines.includes(CAV.staleTranslation.es) && !plines.includes(CAV.staleTranslation.en) && !plines.some((l) => policy.OMISSION_PATTERNS.some((re) => re.test(l))),
        "/locales/stale-line", null, "staleTranslation (es), no score words", plines);
      const enLines = lineage.provenanceLines(r.module, "patient", { locale: "en" });
      c.check(enLines.includes(CAV.editedWording.en) && enLines.includes(CAV.patient.edited.en) && !enLines.some((l) => l === CAV.staleTranslation.en),
        "/locales/stale-line/en", null, "edited (en) + editedWording (en); en is not stale", enLines);
      const parts = typeof lineage.provenanceLineParts === "function" ? lineage.provenanceLineParts(r.module, "patient", { locale: "es" }) : [];
      c.check(parts.length === plines.length && parts.every((x, i) => x.text === plines[i] && x.lang === "es"), "/locales/stale-line/lang", null, "each es line tagged lang es", parts);
      // Decision D3: an es clinician line (locales.es.items.<id>.clin) survives a derivation, and an
      // edit of the item's patientClin marks it stale; an English clin, or an empty one, is V32.
      {
        const dc = fresh();
        const clinEdit = "Línea clínica editada por la suite del editor";
        dc.locales.es.items.r_dur.clin = clinEdit;
        const rc = await run(M, dc);
        c.check(rc.validation.ok && rc.rubric.locales.es.items.r_dur.clin === clinEdit, "/locales/clin/derive", null, "the es clin edit kept, no errors", codes(rc.validation));
        c.check(rc.module.classification && rc.module.classification.kind === "verified", "/locales/clin/classification", null, "verified", rc.module.classification && rc.module.classification.kind);
        const dp = fresh();
        const it0 = dp.domains[0].items[0];
        it0.patientClin += " (edited)";
        const rp = await run(M, dp);
        const st = arr(rp.rubric.locales.es.stale);
        c.check(st.includes(`/locales/es/items/${it0.id}/clin`) && rp.rubric.locales.es.reviewed === false, "/locales/clin/stale", null, `/locales/es/items/${it0.id}/clin stale, reviewed:false`, st);
        const dn = fresh();
        dn.locales.en.items.r_dur.clin = "An English clinician line";
        const rn = await run(M, dn);
        c.check(codes(rn.validation).includes("V32 /locales/en/items/r_dur/clin"), "/locales/clin/en-V32", null, "V32 /locales/en/items/r_dur/clin", codes(rn.validation));
        const de = fresh();
        de.locales.es.items.r_dur.clin = "  ";
        const re2 = await run(M, de);
        c.check(codes(re2.validation).includes("V32 /locales/es/items/r_dur/clin"), "/locales/clin/empty-V32", null, "V32 /locales/es/items/r_dur/clin", codes(re2.validation));
        // deriveRubric's stale marking and the editor's "English changed" tag read one helper,
        // changedClinItems: the English clinician line is patientClin, or the item text without
        // one, compared by item id.
        c.check(typeof derive.changedClinItems === "function", "/locales/clin/changedClinItems", null, "exported by derive.js", typeof derive.changedClinItems);
        if (typeof derive.changedClinItems === "function") {
          const pc = fresh();
          const pit = pc.domains[0].items[0];
          delete pit.patientClin;
          const textEdit = JSON.parse(JSON.stringify(pc));
          textEdit.domains[0].items[0].text += " (edited)";
          const sameLine = JSON.parse(JSON.stringify(pc));
          sameLine.domains[0].items[0].patientClin = pit.text;
          const clinEdit = fresh();
          clinEdit.domains[0].items[0].patientClin += " (edited)";
          const ch = [derive.changedClinItems(pc, textEdit), derive.changedClinItems(pc, sameLine), derive.changedClinItems(fresh(), clinEdit), derive.changedClinItems(fresh(), fresh())];
          c.diff([[pit.id], [], [pit.id], []], ch, { at: "/locales/clin/changedClinItems/cases",
            input: ["text edit, no patientClin", "patientClin added equal to the old text", "patientClin edit", "no edit"] });
        }
      }
      const f = fresh();
      const flagId = Object.keys(f.locales.en.redFlags)[0];
      f.locales.en.redFlags[flagId].q += " (edited)";
      const ch = await derive.classifyChanges(M, f, { readsObserved: ro });
      c.check(ch.staleRedFlagPaths.includes(`/locales/es/redFlags/${flagId}/q`), "/locales/staleRedFlag", null, `/locales/es/redFlags/${flagId}/q`, ch.staleRedFlagPaths);
      // Updating the translation together with the English leaves nothing stale.
      f.locales.es.redFlags[flagId].q += " (editado)";
      const ch2 = await derive.classifyChanges(M, f, { readsObserved: ro });
      c.check(!ch2.staleRedFlagPaths.length, "/locales/staleRedFlag/updated", null, [], ch2.staleRedFlagPaths);
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

    // ---------------------------------------------------- EMR template (release 0.4.3)
    {
      const T = M.rubric.emrTemplate;
      if (c.check(!!T && typeof T === "object" && !Array.isArray(T), "/emr/present", null, "the built-in carries emrTemplate", T === undefined ? "absent" : typeof T)) {
        const REASON = "The EMR template data is cited clinical content (the built-in module's was signed off by the clinical lead on 2026-10-07, with the lead's additions of 2026-10-10); not editable in the Rubric Editor.";
        const firstCite = Object.keys(T.citations || {})[0];
        const firstRefFlag = Object.keys(T.redFlagRefs || {})[0];
        const probe = ["/emrTemplate", `/emrTemplate/citations/${firstCite}/url`, "/emrTemplate/references/0/label", `/emrTemplate/redFlagRefs/${firstRefFlag}/0`,
          "/emrTemplate/history/0", "/emrTemplate/checklist/0/label", "/emrTemplate/checklist/0/signals", "/emrTemplate/examRows/0/label"];
        for (const p of probe) {
          c.check(derive.lockReason(p) === REASON && !derive.isEditablePath(p), `/emr/locked${p}`, null, REASON, derive.lockReason(p));
        }
        const emrViolations = (lv) => lv.filter((v) => v.path === "/emrTemplate" || v.path.startsWith("/emrTemplate/"));
        c.check(!emrViolations(derive.lockViolations(M, fresh())).length, "/emr/unchanged", null, "no lock violation", emrViolations(derive.lockViolations(M, fresh())));
        // Every direct edit of the block, a reorder included, is a Read-only lock violation.
        const edits = [
          ["label", (t) => { t.checklist[0].label += " (edited)"; }],
          ["url", (t) => { t.citations[firstCite].url = "https://example.org/edited"; }],
          ["reorder", (t) => { t.references.reverse(); }],
          ["add-citation", (t) => { t.citations["EX-EDITOR"] = { ...t.citations[firstCite] }; }],
          ["add-key", (t) => { t.extra = []; }],
          ["remove-row", (t) => { t.examRows.pop(); }],
        ];
        for (const [name, fn] of edits) {
          const x = fresh();
          fn(x.emrTemplate);
          const lv = emrViolations(derive.lockViolations(M, x));
          c.check(lv.length > 0 && lv.every((v) => v.msg === `Read-only: ${REASON}`), `/emr/edit/${name}`, { edit: name }, `Read-only: ${REASON}`, lv);
        }
        {
          const x = fresh();
          delete x.emrTemplate;
          c.check(emrViolations(derive.lockViolations(M, x)).length > 0, "/emr/edit/remove-block", null, "a lock violation", "none");
        }
        // Deleting a red flag removes its references (the plan lists it); nothing else under /emrTemplate changes.
        const flag = Object.keys(T.redFlagRefs || {}).find((id) => derive.flagDeletePlan(M, M.rubric, id).allowed) || null;
        if (c.check(!!flag, "/emr/flag-delete/flag", null, "a deletable flag with EMR references", null)) {
          const plan = derive.flagDeletePlan(M, M.rubric, flag);
          c.check(plan.removes.some((r) => r.path === `/emrTemplate/redFlagRefs/${flag}`), "/emr/flag-delete/plan", { flag }, `/emrTemplate/redFlagRefs/${flag}`, plan.removes.map((r) => r.path));
          const x = derive.deleteFlag(M, fresh(), flag);
          const want = JSON.parse(JSON.stringify(T));
          delete want.redFlagRefs[flag];
          if (want.redFlagPlaceholders) delete want.redFlagPlaceholders[flag];
          c.check(JSON.stringify(x.emrTemplate) === JSON.stringify(want), "/emr/flag-delete/cascade", { flag }, "the block without that flag's references, byte for byte", derive.diffRubrics({ emrTemplate: want }, { emrTemplate: x.emrTemplate }).slice(0, 3));
          c.check(!emrViolations(derive.lockViolations(M, x)).length, "/emr/flag-delete/no-lock", { flag }, [], emrViolations(derive.lockViolations(M, x)));
          const ride = JSON.parse(JSON.stringify(x));
          ride.emrTemplate.checklist[0].label += " (edited)";
          const lvRide = emrViolations(derive.lockViolations(M, ride));
          c.check(lvRide.some((v) => v.path === "/emrTemplate/checklist/0/label"), "/emr/flag-delete/ride-along", { flag, edit: "/emrTemplate/checklist/0/label" }, "Read-only at /emrTemplate/checklist/0/label", lvRide);
          const back = await run(M, x, { note: "editor suite: delete a flag with EMR references" });
          const v61 = back.validation.errors.filter((e) => e.code === "V61");
          c.check(!v61.length, "/emr/flag-delete/no-V61-error", { flag }, "no V61 error", v61.map((e) => `${e.path}: ${e.msg}`));
        }
        // Deleting a red flag with a workup placeholder (round 1) removes the placeholder with its references.
        const holderFlag = Object.keys(T.redFlagPlaceholders || {}).find((id) => derive.flagDeletePlan(M, M.rubric, id).allowed) || null;
        if (c.check(!!holderFlag, "/emr/flag-delete/placeholder/flag", null, "a deletable flag with an EMR workup placeholder", null)) {
          const plan = derive.flagDeletePlan(M, M.rubric, holderFlag);
          c.check(plan.removes.some((r) => r.path === `/emrTemplate/redFlagPlaceholders/${holderFlag}`), "/emr/flag-delete/placeholder/plan", { flag: holderFlag },
            `/emrTemplate/redFlagPlaceholders/${holderFlag}`, plan.removes.map((r) => r.path));
          const x = derive.deleteFlag(M, fresh(), holderFlag);
          const want = JSON.parse(JSON.stringify(T));
          if (want.redFlagRefs) delete want.redFlagRefs[holderFlag];
          delete want.redFlagPlaceholders[holderFlag];
          c.check(JSON.stringify(x.emrTemplate) === JSON.stringify(want), "/emr/flag-delete/placeholder/cascade", { flag: holderFlag }, "the block without that flag's references and placeholder, byte for byte",
            derive.diffRubrics({ emrTemplate: want }, { emrTemplate: x.emrTemplate }).slice(0, 3));
          c.check(!emrViolations(derive.lockViolations(M, x)).length, "/emr/flag-delete/placeholder/no-lock", { flag: holderFlag }, [], emrViolations(derive.lockViolations(M, x)));
          const back = await run(M, x, { note: "editor suite: delete a flag with an EMR workup placeholder" });
          const v61 = back.validation.errors.filter((e) => e.code === "V61");
          c.check(!v61.length, "/emr/flag-delete/placeholder/no-V61-error", { flag: holderFlag }, "no V61 error", v61.map((e) => `${e.path}: ${e.msg}`));
        }
        // Deleting an item named in history rows or checklist signals removes them (the rows of the checklist stay).
        const named = new Set([...(T.history || []).map((r) => r.item), ...(T.checklist || []).flatMap((r) => (r.signals || []).map((s) => s.item))].filter(Boolean));
        const item = [...named].find((id) => (T.history || []).some((r) => r.item === id) && (T.checklist || []).some((r) => (r.signals || []).some((s) => s.item === id))) || [...named][0];
        if (c.check(!!item, "/emr/item-delete/item", null, "an item the block names", null)) {
          const deps = derive.itemDependents(M.rubric, item).map((x) => x.path).filter((p) => p.startsWith("/emrTemplate/"));
          const wantDeps = [];
          (T.history || []).forEach((r, i) => { if (r.item === item) wantDeps.push(`/emrTemplate/history/${i}`); });
          (T.pastHistory || []).forEach((r, i) => { if (r.item === item) wantDeps.push(`/emrTemplate/pastHistory/${i}`); });
          (T.checklist || []).forEach((r, i) => (r.signals || []).forEach((s, j) => { if (s.item === item) wantDeps.push(`/emrTemplate/checklist/${i}/signals/${j}`); }));
          c.diff(wantDeps, deps, { at: "/emr/item-delete/dependents", input: { item } });
          const x = derive.deleteItem(fresh(), item);
          const want = JSON.parse(JSON.stringify(T));
          if (Array.isArray(want.history)) want.history = want.history.filter((r) => r.item !== item);
          for (const r of want.checklist || []) if (Array.isArray(r.signals)) r.signals = r.signals.filter((s) => s.item !== item);
          c.check(JSON.stringify(x.emrTemplate) === JSON.stringify(want), "/emr/item-delete/cascade", { item }, "history rows and signals naming it removed, every row of the checklist kept",
            derive.diffRubrics({ emrTemplate: want }, { emrTemplate: x.emrTemplate }).slice(0, 3));
          c.check(!emrViolations(derive.lockViolations(M, x)).length, "/emr/item-delete/no-lock", { item }, [], emrViolations(derive.lockViolations(M, x)));
        }
        // Release 0.4.6 (review round 1): deleting an item named by a past-history row removes that row
        // (dependents, cascade, no lock violation, no V61 error), whatever the logic reads.
        const pastItem = ((T.pastHistory || []).find((r) => r.item !== undefined) || {}).item;
        if (c.check(!!pastItem, "/emr/past-delete/item", null, "an item a past-history row names", null)) {
          const deps = derive.itemDependents(M.rubric, pastItem).map((x) => x.path).filter((p) => p.startsWith("/emrTemplate/"));
          const wantDeps = [];
          (T.history || []).forEach((r, i) => { if (r.item === pastItem) wantDeps.push(`/emrTemplate/history/${i}`); });
          (T.pastHistory || []).forEach((r, i) => { if (r.item === pastItem) wantDeps.push(`/emrTemplate/pastHistory/${i}`); });
          (T.checklist || []).forEach((r, i) => (r.signals || []).forEach((s, j) => { if (s.item === pastItem) wantDeps.push(`/emrTemplate/checklist/${i}/signals/${j}`); }));
          c.diff(wantDeps, deps, { at: "/emr/past-delete/dependents", input: { item: pastItem } });
          c.check(wantDeps.some((p) => p.startsWith("/emrTemplate/pastHistory/")), "/emr/past-delete/dependents/listed", { item: pastItem }, "the past-history row among the dependents", deps);
          const x = derive.deleteItem(fresh(), pastItem);
          const want = JSON.parse(JSON.stringify(T));
          if (Array.isArray(want.history)) want.history = want.history.filter((r) => r.item !== pastItem);
          if (Array.isArray(want.pastHistory)) want.pastHistory = want.pastHistory.filter((r) => r.item !== pastItem);
          for (const r of want.checklist || []) if (Array.isArray(r.signals)) r.signals = r.signals.filter((s) => s.item !== pastItem);
          c.check(JSON.stringify(x.emrTemplate) === JSON.stringify(want), "/emr/past-delete/cascade", { item: pastItem }, "the past-history row naming it removed, the other rows kept",
            derive.diffRubrics({ emrTemplate: want }, { emrTemplate: x.emrTemplate }).slice(0, 3));
          c.check(!(x.emrTemplate.pastHistory || []).some((r) => r.item === pastItem), "/emr/past-delete/gone", { item: pastItem }, "no past-history row names it", x.emrTemplate.pastHistory);
          c.check(!emrViolations(derive.lockViolations(M, x)).length, "/emr/past-delete/no-lock", { item: pastItem }, [], emrViolations(derive.lockViolations(M, x)));
        }
        // A derivation keeps the block byte for byte, before the change log.
        const keys = Object.keys(R1.rubric);
        c.check(JSON.stringify(R1.rubric.emrTemplate) === JSON.stringify(T) && keys.indexOf("emrTemplate") >= 0 && keys.indexOf("emrTemplate") < keys.indexOf("changelog"),
          "/emr/derive/preserved", null, "emrTemplate byte for byte, before changelog", keys);
        c.check(R1.module.emrTemplate !== null && JSON.stringify(R1.module.emrTemplate) === JSON.stringify(T), "/emr/derive/module", null, "module.emrTemplate bound", null);
      }
    }

    // ---------------------------------------------------- referral rule (release 0.4.5)
    // phenotypes.referral, with the clinical lead's clinician rule, stays locked as /phenotypes is:
    // every pointer below it is read-only, any edit is a lock violation, and a derivation keeps the
    // table byte for byte.
    {
      const ref = M.rubric.phenotypes && M.rubric.phenotypes.referral;
      if (c.check(!!ref && Array.isArray(ref.clinicianRules) && ref.clinicianRules.length > 0, "/referral/present", null, "the built-in carries phenotypes.referral.clinicianRules", ref)) {
        const REASON = "Not editable in the Rubric Editor.";
        for (const p of ["/phenotypes/referral", "/phenotypes/referral/byPhenotype/otologic/specialty", "/phenotypes/referral/byPhenotype/both/specialty", "/phenotypes/referral/clinicianRules",
          "/phenotypes/referral/clinicianRules/0/rule", "/phenotypes/referral/clinicianRules/0/definition/0", "/phenotypes/referral/clinicianRules/0/clarification/0",
          "/phenotypes/referral/clinicianRules/0/confirm/0", "/phenotypes/referral/clinicianRules/0/phenotypes/1"]) {
          c.check(derive.lockReason(p) === REASON && !derive.isEditablePath(p), `/referral/locked${p}`, null, REASON, derive.lockReason(p));
        }
        const refViolations = (lv) => lv.filter((v) => v.path === "/phenotypes" || v.path.startsWith("/phenotypes/"));
        c.check(!refViolations(derive.lockViolations(M, fresh())).length, "/referral/unchanged", null, "no lock violation", refViolations(derive.lockViolations(M, fresh())));
        const edits = [
          ["destination", (r) => { r.byPhenotype.otologic.specialty = "Neuro-otology"; }],
          ["both-row", (r) => { delete r.byPhenotype.both; }],
          ["rule", (r) => { r.clinicianRules[0].rule += " (edited)"; }],
          ["definition", (r) => { r.clinicianRules[0].definition[0] += " (edited)"; }],
          ["clarification", (r) => { r.clinicianRules[0].clarification[0] += " (edited)"; }],
          ["confirm", (r) => { r.clinicianRules[0].confirm.pop(); }],
          ["phenotypes", (r) => { r.clinicianRules[0].phenotypes = ["otologic"]; }],
          ["remove-rule", (r) => { delete r.clinicianRules; }],
        ];
        for (const [name, fn] of edits) {
          const x = fresh();
          fn(x.phenotypes.referral);
          const lv = refViolations(derive.lockViolations(M, x));
          c.check(lv.length > 0 && lv.every((v) => v.msg === `Read-only: ${REASON}`), `/referral/edit/${name}`, { edit: name }, `Read-only: ${REASON}`, lv);
        }
        c.check(JSON.stringify(R1.rubric.phenotypes.referral) === JSON.stringify(ref), "/referral/derive/preserved", null, "phenotypes.referral byte for byte", R1.rubric.phenotypes.referral);
        c.check(JSON.stringify(R1.module.phenotypes.referral) === JSON.stringify(ref), "/referral/derive/module", null, "module.phenotypes.referral bound", null);
      }
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
    }

    c.note(`MASQUE readsObserved: ${Object.keys(ro.items || {}).length} items; acknowledgePaths: ${derive.acknowledgePaths(M, ro).length} fields`);
    return c.result();
  }),
};
