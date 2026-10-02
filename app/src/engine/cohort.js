// engine/cohort.js — DAY-1 STUB committed by WP0 (design 03 §9.0). Owner: WP4 (design §4.8).
//
// The export names are final, so every relative import resolves from the first day. Each
// export throws Error("not implemented: WP4") when used: a function when called, a constant
// on any property access. WP4 replaces this whole file; nobody else edits it.

const NOT_IMPLEMENTED = "not implemented: WP4";

// A stand-in for a constant: any property access, call or enumeration throws.
function stubConstant() {
  const fail = () => { throw new Error(NOT_IMPLEMENTED); };
  return new Proxy(function stub() {}, {
    get: fail, has: fail, ownKeys: fail, apply: fail, construct: fail,
    getOwnPropertyDescriptor: fail, set: fail, defineProperty: fail, deleteProperty: fail,
  });
}

export const CANONICAL_FIELDS = stubConstant();

export function subjectPseudonym() { throw new Error(NOT_IMPLEMENTED); }
export function screenToCohortRow() { throw new Error(NOT_IMPLEMENTED); }
export function rowsToCsv() { throw new Error(NOT_IMPLEMENTED); }
export function cohortColumnsCsv() { throw new Error(NOT_IMPLEMENTED); }
export function makeCohort() { throw new Error(NOT_IMPLEMENTED); }
