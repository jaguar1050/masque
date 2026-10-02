// engine/prng.js — seeded pseudo-random numbers for deterministic smoke states, sweeps and
// tests (design 03 §4.3, V46). Pure; no imports, no side effects.

/**
 * mulberry32: a 32-bit seeded generator returning floats in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One element of `xs`, chosen with `rng`. Undefined for an empty array.
 * @template T
 * @param {() => number} rng
 * @param {T[]} xs
 * @returns {T}
 */
export function pick(rng, xs) {
  return xs[Math.floor(rng() * xs.length)];
}
