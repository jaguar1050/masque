// engine/exportAll.js — DAY-1 STUB committed by WP0 (design 03 §9.0). Owner: WP11 (design §4.15, §5.8).
//
// The export names are final, so every relative import resolves from the first day. Each
// export throws Error("not implemented: WP11") when used: a function when called, a constant
// on any property access. WP11 replaces this whole file; nobody else edits it.

const NOT_IMPLEMENTED = "not implemented: WP11";

// A stand-in for a constant: any property access, call or enumeration throws.
function stubConstant() {
  const fail = () => { throw new Error(NOT_IMPLEMENTED); };
  return new Proxy(function stub() {}, {
    get: fail, has: fail, ownKeys: fail, apply: fail, construct: fail,
    getOwnPropertyDescriptor: fail, set: fail, defineProperty: fail, deleteProperty: fail,
  });
}

export const README_TEXT = stubConstant();

export function buildExportFiles() { throw new Error(NOT_IMPLEMENTED); }
