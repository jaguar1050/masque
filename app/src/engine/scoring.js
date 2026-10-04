// engine/scoring.js — the index arithmetic (design 03 §4.4). Owner: WP3.
//
// Moved from the baseline Screener scoring block, arithmetic verbatim: scoreItem, itemBounds
// and the attainable-range computation of useScore, with the band cut-points, the domain
// order and the scale maximum injected from the bound module instead of module constants.
// The arithmetic is two-sided: an unanswered item contributes its best case to the ceiling
// and its worst case to the floor, and a band is issued only when the whole attainable range
// lands in one band. The range also covers the exact best- and worst-case completions (run
// through the same rounding), so fractional contributions cannot let completing the open items
// contradict a settled band. An unanswered item is never scored as a denial; "unsure" (Patient
// Companion only) scores as unanswered.
//
// Pure: no React, no side effects. Apps call
//   useMemo(() => computeScore(module, answers), [module, answers]).
import { INDETERMINATE, normalizeAnswer } from "./vocab.js";

/** Points an answered item contributes. A scale item's answer is its option index. */
export function scoreItem(item, val) {
  if (item.scale) {
    if (typeof val !== "number") return 0;
    return item.w * (item.scale[val]?.f ?? 0);
  }
  return val === "yes" ? item.w : 0;
}

/**
 * The band of an index value, with the cut-points injected: "low" below `cuts.moderate`,
 * "high" from `cuts.high` on, "moderate" between.
 * @param {{moderate:number, high:number}} cuts
 * @param {number} v
 */
export function bandFor(cuts, v) {
  if (v >= cuts.high) return "high";
  if (v >= cuts.moderate) return "moderate";
  return "low";
}

/** The least and the most an unanswered item can still contribute (two-sided). */
export function itemBounds(item) {
  if (item.scale) {
    const fs = item.scale.map(s => s.f);
    const a = item.w * Math.min(...fs), b = item.w * Math.max(...fs);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return item.w >= 0 ? { min: 0, max: item.w } : { min: item.w, max: 0 };
}

const domainsOf = (m) => (m && Array.isArray(m.domains) ? m.domains : []);
const finite = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** Σ declared max over the positive domains (the top of the index scale). Module or rubric. */
export function scaleMaxOf(module) {
  let s = 0;
  for (const d of domainsOf(module)) if (d && d.negative !== true) s += finite(d.max);
  return s;
}

/** Σ declared max over the negative domains (≤ 0). Module or rubric. */
export function negativeMinOf(module) {
  let s = 0;
  for (const d of domainsOf(module)) if (d && d.negative === true) s += finite(d.max);
  return s;
}

const cutsOf = (module) => module.bands.cuts;
const scaleMaxFor = (module) => (typeof module.scaleMax === "number" ? module.scaleMax : scaleMaxOf(module));

/**
 * The score of an answer set (baseline useScore without useMemo). Keys, rounding, clamping
 * and the stable sort of `open` are those of the baseline; the clamp at the top of the scale
 * is the module's scaleMax.
 * @returns {{domains:Object<string,{pts:number,max:number,pct:number,label:string,openPts:number,negative:boolean}>,
 *            total:number, floor:number, ceiling:number, coverage:number, scorable:boolean, answered:number,
 *            count:number, band:string, open:Array<Object>}}
 */
export function computeScore(module, answers = {}) {
  const src = answers || {};
  const cuts = cutsOf(module);
  const scaleMax = scaleMaxFor(module);
  const domains = {};
  let total = 0, posHead = 0, negHead = 0, answered = 0, count = 0;
  // The best-case and worst-case completions, run through the same pipeline as `total`
  // (item order, per-domain round to 0.1, sum, round, clamp): every open item at its
  // itemBounds max (resp. min). Each step is non-decreasing, so these are the exact highest and
  // lowest totals any completion can reach.
  let totalHi = 0, totalLo = 0;
  const open = [];
  for (const d of domainsOf(module)) {
    const key = d.key;
    let sum = 0, sumHi = 0, sumLo = 0, dOpen = 0;
    for (const it of d.items) {
      count++;
      const v = normalizeAnswer(src[it.id]);
      if (v === undefined) {
        const b = itemBounds(it);
        posHead += b.max; negHead += -b.min;
        sumHi += b.max; sumLo += b.min;
        // Attainable headroom (max − min), not |w|: a scale item whose top option is below
        // f = 1 cannot move the index by its full weight.
        dOpen += b.max - b.min;
        open.push({ ...it, domain: key, domainLabel: d.label });
      } else {
        answered++;
        const p = scoreItem(it, v);
        sum += p; sumHi += p; sumLo += p;
      }
    }
    sum = Math.round(sum * 10) / 10;
    dOpen = Math.round(dOpen * 10) / 10;
    domains[key] = {
      pts: sum, max: d.max, pct: Math.round((sum / d.max) * 100),
      label: d.label, openPts: dOpen, negative: !!d.negative,
    };
    total += sum;
    totalHi += Math.round(sumHi * 10) / 10;
    totalLo += Math.round(sumLo * 10) / 10;
  }
  const clampTotal = (x) => Math.max(0, Math.min(scaleMax, Math.round(x)));
  total = clampTotal(total);
  // The range is the union of the baseline bound (headroom added to the clamped, rounded total)
  // and the exact pipeline bound above. The baseline bound alone can be too narrow when
  // contributions are fractional (rounding the total before adding headroom), which let a
  // settled band be contradicted by completing the open items; the pipeline bound alone would
  // be narrower than the baseline's where the total clamps at 0, which changes built-in output.
  // The union is never narrower than either: it gates at least as often as both.
  const ceiling = Math.max(total, Math.min(scaleMax, Math.round(total + posHead)), clampTotal(totalHi));
  const floor   = Math.min(total, Math.max(0,        Math.round(total - negHead)), clampTotal(totalLo));
  const coverage = count ? Math.round((answered / count) * 100) : 0;

  const scorable = bandFor(cuts, floor) === bandFor(cuts, ceiling);

  return {
    domains, total, floor, ceiling, coverage, scorable, answered, count,
    band: scorable ? bandFor(cuts, total) : INDETERMINATE,
    open: open.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)),
  };
}

/** Band ranges as display text: {low:"< 34", moderate:"34–66", high:"≥ 67"} for cuts 34/67. */
export function bandRangeText(module) {
  const { moderate, high } = cutsOf(module);
  return { low: `< ${moderate}`, moderate: `${moderate}–${high - 1}`, high: `≥ ${high}` };
}

/** Meter zone widths derived from the cuts and the scale maximum (AD7). */
export function meterZones(module) {
  const { moderate, high } = cutsOf(module);
  const scaleMax = scaleMaxFor(module);
  return [
    { band: "low", w: moderate },
    { band: "moderate", w: high - moderate },
    { band: "high", w: scaleMax - high },
  ];
}

/** Meter tick values: 0, the two cuts and the scale maximum. */
export function meterTicks(module) {
  const { moderate, high } = cutsOf(module);
  return [0, moderate, high, scaleMaxFor(module)];
}

/**
 * The "negative answer" of an item: "no" for a boolean item; for a scale item the index of
 * the first option with f === 0 (validator V13 guarantees one), or null when there is none.
 */
export function negativeValueOf(item) {
  if (!item || !Array.isArray(item.scale)) return "no";
  const i = item.scale.findIndex(o => o && o.f === 0);
  return i >= 0 ? i : null;
}
