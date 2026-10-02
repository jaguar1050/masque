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
    return c.result();
  }),
};
