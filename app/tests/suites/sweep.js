// tests/suites/sweep.js — scoring parity (design 03 §8.3 `sweep`, §8.5). Owner: WP13; accepts WP3.
//
//   1. computeScore(masque, a) vs the baseline Scribe computeScore(a) on the §8.5 stream
//      (50,000 answer sets in five strata + the edge cases), on every key the Scribe returns;
//      `open` is compared as the ordered list of {id, w, domain} (the Scribe's open entries are
//      its items plus `domain`).
//   2. computeScore(masque, a) vs renderHook(baseline Screener useScore, a) on 2,000 of them, on
//      every output key, `count` and `open` (id order and every baseline field) included.
//   3. scoreItem and itemBounds for every item and every value (each option index, the two
//      out-of-range indices, "yes", "no", "unsure" and undefined) vs the baseline Screener's.
//   4. The attainable range on non-MASQUE arithmetic (fractional weights and scale factors, a
//      negative domain): for seeded random modules and partial answer sets with up to 5 open
//      items, every completion's total lies in [floor, ceiling], and a settled band is the band
//      of every completion; domain openPts is the attainable headroom (Σ max − min over the open
//      items), rounded to 0.1. Includes the audit's two counterexamples.
// No difference is allowed: scoring has no AD (§8.4).
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { flatItems, scoringStream, sizes } from "../harness/matrix.js";

const SCRIBE_KEYS = ["domains", "total", "floor", "ceiling", "coverage", "scorable", "answered", "band"];
const SCREENER_KEYS = [...SCRIBE_KEYS, "count"];

function pickKeys(o, keys) {
  const out = {};
  for (const k of keys) out[k] = o[k];
  return out;
}

export default {
  name: "sweep",
  owner: "WP13",
  run: guarded("sweep", async (h) => {
    const { module, validation } = await loadMasque(h);
    const scoring = await h.engine("scoring.js");
    const [scr, scb] = await Promise.all([h.oracle("MASQUE_Screener_v0_3.jsx"), h.oracle("MASQUE_Scribe_v0_3.jsx")]);
    const c = collector(h);
    c.note(validationNote(validation));
    const items = flatItems(scr.ITEMS, scr.DOMAIN_ORDER);
    const sz = sizes(h.quick);
    const samples = Object.entries(scr.SAMPLE_CASES).map(([k, s]) => ({ label: k, answers: s.a }));
    const rng = h.rng(h.seed);

    const t0 = performance.now();
    let i = 0, hookN = 0;
    const hookEvery = Math.max(1, Math.floor(sz.scoring / sz.hookScoring));
    for (const s of scoringStream(rng, items, sz.scoring, samples)) {
      let got;
      try {
        got = scoring.computeScore(module, s.answers);
      } catch (err) {
        if (/not implemented/.test(err.message)) throw err;
        c.check(false, `/computeScore/threw`, { answers: s.answers }, null, String(err.message));
        i++;
        continue;
      }
      const old = scb.computeScore(s.answers);
      const input = { label: s.label, answers: s.answers };
      c.diff(pickKeys(old, SCRIBE_KEYS), pickKeys(got, SCRIBE_KEYS), { at: "/scribe", input, keyOrder: true });
      c.diff(old.open.map((o) => ({ id: o.id, w: o.w, domain: o.domain })),
        (got.open || []).map((o) => ({ id: o.id, w: o.w, domain: o.domain })), { at: "/scribe/open", input });
      // The hook oracle on an even spread of the stream, plus every edge case.
      if (s.stratum === null || i % hookEvery === 0) {
        const hook = h.renderHook(scr.useScore, s.answers);
        hookN++;
        c.diff(pickKeys(hook, SCREENER_KEYS), pickKeys(got, SCREENER_KEYS), { at: "/screener", input, keyOrder: true });
        const proj = (got.open || []).map((o, k) => {
          const base = hook.open[k];
          if (!base) return o;
          const out = {};
          for (const key of Object.keys(base)) out[key] = o[key];
          return out;
        });
        c.diff(hook.open, proj, { at: "/screener/open", input, keyOrder: true });
      }
      i++;
      if (i % 2000 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    c.note(`computeScore: ${i} answer sets vs Scribe computeScore, ${hookN} vs Screener useScore (renderHook); seed 0x${h.seed.toString(16)}; ${Math.round(performance.now() - t0)} ms`);

    // scoreItem / itemBounds over every item and value.
    let itemChecks = 0;
    need(typeof scoring.scoreItem === "function" && typeof scoring.itemBounds === "function", "waits on WP3: scoring.scoreItem / itemBounds");
    for (const it of items) {
      const mine = module.itemById && module.itemById[it.id];
      if (!c.check(!!mine, `/items/${it.id}`, { id: it.id }, "present in the baseline", "absent from the module")) continue;
      const values = it.scale ? [...it.scale.map((_, k) => k), -1, it.scale.length, undefined, "yes"] : ["yes", "no", "unsure", undefined, 0];
      for (const v of values) {
        c.diff(scr.scoreItem(it, v), scoring.scoreItem(mine, v), { at: `/scoreItem/${it.id}/${String(v)}`, input: { id: it.id, value: v === undefined ? "[undefined]" : v } });
        itemChecks++;
      }
      c.diff(scr.itemBounds(it), scoring.itemBounds(mine), { at: `/itemBounds/${it.id}`, input: { id: it.id }, keyOrder: true });
      itemChecks++;
    }
    c.note(`scoreItem/itemBounds: ${itemChecks} comparisons over ${items.length} items`);

    // 4. The attainable range on fractional arithmetic.
    const cuts = { moderate: 34, high: 67 };
    const mod = (domains) => ({ domains, bands: { cuts }, scaleMax: domains.filter((d) => !d.negative).reduce((x, d) => x + d.max, 0) });
    const audit = [
      { m: mod([{ key: "d", label: "D", max: 100, items: [
        { id: "a", w: 10, scale: [{ f: 0 }, { f: 0.34 }] }, { id: "b", w: 30 }, { id: "c", w: 1, scale: [{ f: 0 }, { f: 0.4 }] }, { id: "e", w: 59 }] }]),
        a: { a: 1, b: "yes", e: "no" } },
      { m: mod([{ key: "p", label: "P", max: 100, items: [{ id: "a", w: 10 }, { id: "b", w: 56 }, { id: "s", w: 1, scale: [{ f: 0 }, { f: 0.6 }] }, { id: "c", w: 33 }] },
        { key: "n", label: "N", max: -1, negative: true, items: [{ id: "x", w: -1, scale: [{ f: 0 }, { f: 0.4 }] }] }]),
        a: { a: "yes", b: "yes", s: 1, c: "no" } },
    ];
    const frng = h.rng(h.seed ^ 0x46524143); // "FRAC"
    const r1 = (k) => Math.round(frng() * k * 10) / 10;
    const randomModule = () => {
      const domains = [];
      const nd = 1 + Math.floor(frng() * 3);
      for (let d = 0; d < nd; d++) {
        const its = [];
        for (let k = 0, n = 2 + Math.floor(frng() * 4); k < n; k++) {
          const it = { id: `d${d}i${k}`, w: Math.max(0.1, r1(40)) };
          if (frng() < 0.5) it.scale = [{ f: 0 }, ...Array.from({ length: 1 + Math.floor(frng() * 3) }, () => ({ f: Math.round(frng() * 100) / 100 }))];
          its.push(it);
        }
        domains.push({ key: `d${d}`, label: `D${d}`, max: Math.round(its.reduce((x, it) => x + it.w, 0) * 10) / 10, items: its });
      }
      if (frng() < 0.6) {
        const its = Array.from({ length: 1 + Math.floor(frng() * 2) }, (_, k) => {
          const it = { id: `n${k}`, w: -Math.max(0.1, r1(15)) };
          if (frng() < 0.5) it.scale = [{ f: 0 }, { f: Math.round(frng() * 100) / 100 }];
          return it;
        });
        domains.push({ key: "neg", label: "Neg", max: its.reduce((x, it) => x + it.w, 0), negative: true, items: its });
      }
      return mod(domains);
    };
    const valuesOf = (it) => (it.scale ? it.scale.map((_, k) => k) : ["yes", "no"]);
    function* completions(open, base, k = 0) {
      if (k === open.length) { yield base; return; }
      for (const v of valuesOf(open[k])) yield* completions(open, { ...base, [open[k].id]: v }, k + 1);
    }
    const checkRange = (m, a, input) => {
      const s = scoring.computeScore(m, a);
      const open = m.domains.flatMap((d) => d.items).filter((it) => a[it.id] === undefined);
      let lo = Infinity, hi = -Infinity;
      const bands = new Set();
      for (const full of completions(open, a)) {
        const t = scoring.computeScore(m, full);
        lo = Math.min(lo, t.total); hi = Math.max(hi, t.total); bands.add(t.band);
      }
      c.check(lo >= s.floor && hi <= s.ceiling, "/range/contains", input, `every completion in [${s.floor}, ${s.ceiling}]`, `completions span [${lo}, ${hi}]`);
      if (s.scorable) c.check(bands.size === 1 && bands.has(s.band), "/range/settledBand", input, `every completion ${s.band}`, [...bands]);
      for (const d of m.domains) {
        let head = 0;
        for (const it of d.items) if (a[it.id] === undefined) { const b = scoring.itemBounds(it); head += b.max - b.min; }
        const want = Math.round(head * 10) / 10;
        c.check(s.domains[d.key].openPts === want, `/range/openPts/${d.key}`, input, want, s.domains[d.key].openPts);
      }
      return s;
    };
    for (const [k, x] of audit.entries()) checkRange(x.m, x.a, { audit: k });
    c.check(scoring.computeScore(mod([{ key: "d", label: "D", max: 100, items: [{ id: "a", w: 0.1 }, { id: "b", w: 0.2 }, { id: "c", w: 99.7 }] }]), { c: "no" }).domains.d.openPts === 0.3,
      "/range/openPts/@rounded", { weights: [0.1, 0.2, 99.7] }, 0.3, "unrounded");
    let rangeN = 0, settled = 0;
    const nMods = h.quick ? 60 : 300;
    for (let k = 0; k < nMods; k++) {
      const m = randomModule();
      const all = m.domains.flatMap((d) => d.items);
      for (let j = 0; j < 12; j++) {
        const a = {};
        let nOpen = 0;
        for (const it of all) {
          if (nOpen < 5 && frng() < 0.35) { nOpen++; continue; }
          const vs = valuesOf(it);
          a[it.id] = vs[Math.floor(frng() * vs.length)];
        }
        const s = checkRange(m, a, { module: m.domains.map((d) => d.items.map((it) => [it.id, it.w, it.scale && it.scale.map((o) => o.f)])), answers: a });
        rangeN++;
        if (s.scorable && s.answered < s.count) settled++;
      }
    }
    c.note(`attainable range: ${audit.length} audit cases + ${rangeN} partial screens over ${nMods} random fractional modules (${settled} settled with items open)`);
    return c.result();
  }),
};
