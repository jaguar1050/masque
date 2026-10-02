// engine/patient.js — DAY-1 STUB committed by WP0 (design 03 §9.0). Owner: WP6 (design §4.12).
//
// The export names are final, so every relative import resolves from the first day. Each
// export throws Error("not implemented: WP6") when used: a function when called, a constant
// on any property access. WP6 replaces this whole file; nobody else edits it.

const NOT_IMPLEMENTED = "not implemented: WP6";

// A stand-in for a constant: any property access, call or enumeration throws.
function stubConstant() {
  const fail = () => { throw new Error(NOT_IMPLEMENTED); };
  return new Proxy(function stub() {}, {
    get: fail, has: fail, ownKeys: fail, apply: fail, construct: fail,
    getOwnPropertyDescriptor: fail, set: fail, defineProperty: fail, deleteProperty: fail,
  });
}

export const PATIENT_CHROME = stubConstant();
export const TIER_DISPLAY = stubConstant();
export const GRAMMAR = stubConstant();

export function projectForPatient() { throw new Error(NOT_IMPLEMENTED); }
export function localeText() { throw new Error(NOT_IMPLEMENTED); }
export function flagCopy() { throw new Error(NOT_IMPLEMENTED); }
export function buildPatientSummary() { throw new Error(NOT_IMPLEMENTED); }
export function askForm() { throw new Error(NOT_IMPLEMENTED); }
export function joinList() { throw new Error(NOT_IMPLEMENTED); }
export function summaryText() { throw new Error(NOT_IMPLEMENTED); }
export function summaryHtml() { throw new Error(NOT_IMPLEMENTED); }
export function richText() { throw new Error(NOT_IMPLEMENTED); }
