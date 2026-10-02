// tests/harness/clock.js — deterministic time and randomness for baseline calls (design 03 §8.2).
// No imports; nothing happens at import time.
//
// withFixedClock(iso, fn): swaps the global Date for a subclass whose no-argument
// constructor and Date.now() return `iso`; withSeededRandom(seed, fn): swaps Math.random
// for mulberry32(seed). Both restore the originals when fn returns or its promise settles,
// also on a throw. New engine builders take `now`, `date` and `nonce` instead.

/** mulberry32, the same generator as engine/prng.js (§8.5), as a () => [0, 1) function. */
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function settle(result, restore) {
  if (result && typeof result.then === "function") {
    return result.then((v) => { restore(); return v; }, (e) => { restore(); throw e; });
  }
  restore();
  return result;
}

export function withFixedClock(iso, fn) {
  const RealDate = globalThis.Date;
  const fixed = new RealDate(iso).getTime();
  if (Number.isNaN(fixed)) throw new Error(`withFixedClock: not a date: ${iso}`);
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed); else super(...args);
    }
    static now() { return fixed; }
  }
  globalThis.Date = FixedDate;
  let result;
  try {
    result = fn();
  } catch (err) {
    globalThis.Date = RealDate;
    throw err;
  }
  return settle(result, () => { globalThis.Date = RealDate; });
}

export function withSeededRandom(seed, fn) {
  const real = Math.random;
  Math.random = rng(seed);
  let result;
  try {
    result = fn();
  } catch (err) {
    Math.random = real;
    throw err;
  }
  return settle(result, () => { Math.random = real; });
}
