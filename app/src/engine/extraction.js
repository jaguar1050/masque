// engine/extraction.js — DAY-1 STUB committed by WP0 (design 03 §9.0). Owner: WP5 (design §4.9).
//
// The export names are final, so every relative import resolves from the first day. Each
// export throws Error("not implemented: WP5") when used: a function when called, a constant
// on any property access. WP5 replaces this whole file; nobody else edits it.

const NOT_IMPLEMENTED = "not implemented: WP5";

// A stand-in for a constant: any property access, call or enumeration throws.
function stubConstant() {
  const fail = () => { throw new Error(NOT_IMPLEMENTED); };
  return new Proxy(function stub() {}, {
    get: fail, has: fail, ownKeys: fail, apply: fail, construct: fail,
    getOwnPropertyDescriptor: fail, set: fail, defineProperty: fail, deleteProperty: fail,
  });
}

export const EXTRACTOR_KIND = stubConstant();

export function createExtractor() { throw new Error(NOT_IMPLEMENTED); }
export function extract() { throw new Error(NOT_IMPLEMENTED); }
export function firstHit() { throw new Error(NOT_IMPLEMENTED); }
export function allHits() { throw new Error(NOT_IMPLEMENTED); }
export function cueBefore() { throw new Error(NOT_IMPLEMENTED); }
export function faersToUtterances() { throw new Error(NOT_IMPLEMENTED); }
