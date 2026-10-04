// tests/suites/cohort-gen.js — the demo cohorts (design 03 §8.3 `cohort-gen`). Owner: WP13; accepts WP4.
//
// For each of the three kinds the baseline Simulator generates (balanced, unlabeled,
// disparate), cohort.makeCohort(spec) with the MASQUE module's research.demoCohorts spec must
// deep-equal the Simulator's makeCohort(kind): every row, every key, in order (§4.8). The
// cohort list itself (ids, labels, why text) must match the Simulator's COHORTS. Also the
// CSV writer's quoting and formula neutralisation (rowsToCsv).
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";

export default {
  name: "cohort-gen",
  owner: "WP13",
  run: guarded("cohort-gen", async (h) => {
    const { module, validation } = await loadMasque(h);
    const cohort = await h.engine("cohort.js");
    need(typeof cohort.makeCohort === "function", "waits on WP4: cohort.makeCohort");
    const sim = await h.oracle("MASQUE_Simulator.jsx");
    const c = collector(h);
    c.note(validationNote(validation));
    const specs = (module.research && Array.isArray(module.research.demoCohorts)) ? module.research.demoCohorts : [];
    c.check(specs.length === sim.COHORTS.length, "/research/demoCohorts/length", null, sim.COHORTS.length, specs.length);
    for (const kind of sim.COHORTS) {
      const entry = specs.find((s) => s.id === kind.id);
      if (!c.check(!!entry, `/research/demoCohorts/${kind.id}`, { kind: kind.id }, "present in Simulator COHORTS", "absent from the module")) continue;
      // Every non-spec field of the Simulator's cohort entry (label, why …) moves verbatim.
      const meta = {};
      for (const k of Object.keys(kind)) meta[k] = entry[k];
      c.diff(kind, meta, { at: `/research/demoCohorts/${kind.id}`, input: { kind: kind.id }, keyOrder: true });
      let got;
      try {
        got = cohort.makeCohort(entry.spec);
      } catch (err) {
        if (/not implemented/.test(err.message)) throw err;
        c.check(false, `/makeCohort/${kind.id}/threw`, { kind: kind.id }, "rows", String(err.message));
        continue;
      }
      const want = sim.makeCohort(kind.id);
      c.diff(want, got, { at: `/makeCohort/${kind.id}`, input: { kind: kind.id }, keyOrder: true });
      c.note(`${kind.id}: ${want.length} baseline rows, ${got.length} engine rows`);
    }

    // rowsToCsv: RFC 4180 quoting (quote, comma, CR, LF) and formula neutralisation of text
    // cells (leading = + - @ tab CR get an apostrophe); numbers, negative ones included, stay as
    // they are.
    const csv = cohort.rowsToCsv([
      { a: "=1+1", b: "+x", c: "-y", d: "@z", e: -3, f: "a\rb", g: 'q"q', h: "plain", i: "\tt", j: "x=1" },
    ]);
    c.diff(["a,b,c,d,e,f,g,h,i,j", `'=1+1,'+x,'-y,'@z,-3,"a\rb","q""q",plain,'\tt,x=1`], csv.split("\n"), { at: "/rowsToCsv/@escaping" });
    return c.result();
  }),
};
