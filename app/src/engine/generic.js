// engine/generic.js — DAY-1 STUB committed by WP0 (design 03 §9.0). Owner: WP3 (design §3.5, §4.13).
//
// The export names are final, so every relative import resolves from the first day. Each
// export throws Error("not implemented: WP3") when used: a function when called, a constant
// on any property access. WP3 replaces this whole file; nobody else edits it.

const NOT_IMPLEMENTED = "not implemented: WP3";

// A stand-in for a constant: any property access, call or enumeration throws.
function stubConstant() {
  const fail = () => { throw new Error(NOT_IMPLEMENTED); };
  return new Proxy(function stub() {}, {
    get: fail, has: fail, ownKeys: fail, apply: fail, construct: fail,
    getOwnPropertyDescriptor: fail, set: fail, defineProperty: fail, deleteProperty: fail,
  });
}

export const GENERIC_LOGIC = stubConstant();
export const ENGINE_COPY_DEFAULTS = stubConstant();
export const DEFAULT_DEMO_PATIENT = stubConstant();
export const DEFAULT_FHIR = stubConstant();

export function defaultScreenerSteps() { throw new Error(NOT_IMPLEMENTED); }
export function defaultPatientSteps() { throw new Error(NOT_IMPLEMENTED); }
