// tests/suites/probes.js — contextual-probe parity (design 03 §8.3 `probes`). Owner: WP13;
// accepts WP5 (with WP2's probe list).
//
//   1. liveProbes: baseline liveProbes(answers, rf, answered) (MASQUE_Probes.js, ALL_PROBES) vs
//      the engine's liveProbes(module.logic.probes.list, answers, rf, answered), as the ordered
//      id sequence, over 50,000 states (5,000 with ?quick=1): answers from the §8.5 scoring
//      stream, red flags as in the rules matrix (marked "nlp" / "md" / "probe"), and each probe
//      answered with p .1. No probe `when` may throw (onError is never called).
//   2. validateProbes returns [] under both (the baseline with the Screener's item and flag
//      ids; the engine with the module's list and the module's ids).
//   3. truncateProbes(live) vs the Scribe rail's grouping and truncation (SHA-pinned slices of
//      Scb L1152-1155), as [{kind, shown ids, total}].
//   4. engine PROBE_KIND carries every baseline PROBE_KIND field unchanged, and
//      PROBE_KIND_ORDER equals the rail's kind order.
//   5. the §4.10 engine rules, on synthetic probes with placeholder text: a rescue is never
//      retired through a target; a throwing `when` keeps its probe and reports onError; and
//      validateProbes reports a rescue with a target, a rescue without `rescues`, `rescues` on
//      another kind, a phenotype option that writes, unknown targets / items / flags, and a
//      duplicate id. (No MASQUE probe exercises these, so the parity sweep cannot.)
// No difference is allowed (§8.4).
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { drawFlags, flatItems, pick, scoringStream, sizes } from "../harness/matrix.js";

const ids = (xs) => xs.map((p) => p.id);

export default {
  name: "probes",
  owner: "WP13",
  run: guarded("probes", async (h) => {
    const { module, validation } = await loadMasque(h);
    const [probes, vocab] = await Promise.all([h.engine("probes.js"), h.engine("vocab.js")]);
    need(typeof probes.liveProbes === "function", "waits on WP5: probes.liveProbes");
    const list = module.logic && module.logic.probes && module.logic.probes.list;
    need(Array.isArray(list), "waits on WP2: module.logic.probes.list");
    const [prb, scr] = await Promise.all([h.oracle("MASQUE_Probes.js"), h.oracle("MASQUE_Screener_v0_3.jsx")]);
    const [railKindsS, railGroupS] = await Promise.all([h.slice("scribe.railKinds"), h.slice("scribe.railGroup")]);
    const railKinds = railKindsS.fn();
    const rail = (live) => railKinds.map((kind) => railGroupS.fn(live, kind)).filter(Boolean)
      .map((g) => ({ kind: g.kind, shown: ids(g.shown), total: g.total }));
    const c = collector(h);
    c.note(validationNote(validation));

    // 4. Vocabulary.
    for (const [kind, spec] of Object.entries(prb.PROBE_KIND)) {
      const mine = vocab.PROBE_KIND[kind] || null;
      const proj = mine ? Object.fromEntries(Object.keys(spec).map((k) => [k, mine[k]])) : null;
      c.diff(spec, proj, { at: `/PROBE_KIND/${kind}`, input: { kind }, keyOrder: true });
    }
    c.diff(railKinds, vocab.PROBE_KIND_ORDER, { at: "/PROBE_KIND_ORDER" });

    // 2. validateProbes.
    const itemIds = flatItems(scr.ITEMS, scr.DOMAIN_ORDER).map((it) => it.id);
    const flagIds = scr.RED_FLAGS.map((f) => f.id);
    const realError = console.error;
    let baseErrs;
    console.error = () => {};   // the baseline logs its (expected empty) result; keep the console clean
    try { baseErrs = prb.validateProbes(itemIds, flagIds); } finally { console.error = realError; }
    c.diff([], baseErrs, { at: "/validateProbes/baseline" });
    c.diff([], probes.validateProbes(list, module.allItems.map((it) => it.id), module.redFlags.map((f) => f.id)), { at: "/validateProbes/engine" });
    c.diff(prb.PROBE_SET_VERSION, module.logic.probes.version, { at: "/probes/version" });

    // 5. The §4.10 engine rules.
    const mk = (o) => ({ say: "Example question", why: "Example reason", opts: [{ l: "Example option" }], when: () => true, ...o });
    const ITEMS = ["ex_item", "ex_other"], FLAGS = ["ex_flag"];
    const rescue = mk({ id: "t_rescue", kind: "rescue", rescues: "ex_item" });
    const crit = mk({ id: "t_crit", kind: "criteria", target: "ex_item" });
    const rescueT = mk({ id: "t_rescue_target", kind: "rescue", rescues: "ex_item", target: "ex_item" });
    c.diff(["t_rescue", "t_rescue_target"], ids(probes.liveProbes([rescue, crit, rescueT], { ex_item: "no" }, {}, {})), { at: "/rules/rescueNeverRetiredByTarget" });
    c.diff(["t_crit"], ids(probes.liveProbes([crit], {}, {}, {})), { at: "/rules/criteriaLiveUntilTarget" });
    const seen = [];
    const thrower = mk({ id: "t_throw", kind: "safety", when: () => { throw new Error("example"); } });
    c.diff(["t_throw"], ids(probes.liveProbes([thrower], {}, {}, {}, { onError: (id) => seen.push(id) })), { at: "/rules/throwingWhenKept" });
    c.diff(["t_throw"], seen, { at: "/rules/onError" });
    const invalid = [
      ["rescue with a target", [rescueT], "t_rescue_target"],
      ["rescue without rescues", [mk({ id: "t_r0", kind: "rescue" })], "t_r0"],
      ["rescues on a criteria probe", [mk({ id: "t_c1", kind: "criteria", rescues: "ex_item" })], "t_c1"],
      ["phenotype option writes", [mk({ id: "t_ph", kind: "phenotype", opts: [{ l: "Example", a: { ex_item: "yes" } }] })], "t_ph"],
      ["unknown target", [mk({ id: "t_ut", kind: "criteria", target: "ex_missing" })], "t_ut"],
      ["unknown written item", [mk({ id: "t_ui", kind: "criteria", opts: [{ l: "Example", a: { ex_missing: "yes" } }] })], "t_ui"],
      ["unknown flag", [mk({ id: "t_uf", kind: "safety", opts: [{ l: "Example", rf: "ex_missing_flag" }] })], "t_uf"],
      ["duplicate id", [mk({ id: "t_dup", kind: "exam" }), mk({ id: "t_dup", kind: "exam" })], "t_dup"],
      ["unknown kind", [mk({ id: "t_kind", kind: "example-kind" })], "t_kind"],
    ];
    for (const [what, list2, id] of invalid) {
      const errs = probes.validateProbes(list2, ITEMS, FLAGS);
      c.check(Array.isArray(errs) && errs.some((e) => String(e).includes(id)), `/rules/validateProbes/${what}`, { probes: list2.map((p) => p.id) }, `an error naming ${id}`, errs);
    }
    c.diff([], probes.validateProbes([rescue, crit, mk({ id: "t_ok", kind: "safety", opts: [{ l: "Example", rf: "ex_flag" }] })], ITEMS, FLAGS), { at: "/rules/validateProbes/valid" });

    // 1 + 3. liveProbes and the rail over the matrix.
    const rng = h.rng(h.seed ^ 0x50524f42); // "PROB"
    const items = flatItems(scr.ITEMS, scr.DOMAIN_ORDER);
    const probeIds = prb.ALL_PROBES.map((p) => p.id);
    const marks = ["nlp", "md", "probe"];
    const errors = [];
    const onError = (id, err) => errors.push({ id, message: String(err && err.message) });
    let n = 0;
    const samples = Object.entries(scr.SAMPLE_CASES).map(([k, s]) => ({ label: k, answers: s.a }));
    for (const s of scoringStream(rng, items, sizes(h.quick).probes, samples)) {
      const rf = {};
      for (const id of Object.keys(drawFlags(rng, flagIds))) rf[id] = pick(rng, marks);
      const answered = {};
      for (const pid of probeIds) {
        const r = rng();
        if (r < 0.1) answered[pid] = Math.floor(rng() * 3);
      }
      const input = { label: s.label, answers: s.answers, rf, answered };
      const want = prb.liveProbes(s.answers, rf, answered);
      const got = probes.liveProbes(list, s.answers, rf, answered, { onError });
      c.diff(ids(want), ids(got), { at: "/liveProbes", input });
      c.diff(rail(want), (probes.truncateProbes(got) || []).map((g) => ({ kind: g.kind, shown: ids(g.shown), total: g.total })),
        { at: "/truncateProbes", input, keyOrder: true });
      n++;
      if (n % 3000 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    c.check(errors.length === 0, "/liveProbes/onError", errors.slice(0, 5), 0, errors.length);
    c.note(`liveProbes + truncateProbes: ${n} states (seed 0x${h.seed.toString(16)}), ${list.length} probes`);
    return c.result();
  }),
};
