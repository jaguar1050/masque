// engine/gates.js — the engine-owned gates (design 03 §4.6). Owner: WP3.
//
// There is no module switch for any of them: a module can supply wording for a slot, never
// remove a behaviour (Inv §4.1 #2, D6). Pure; no side effects.
import { LOWEST_BAND } from "./vocab.js";
import { SITE } from "./policy.js";

/** The safety step is done when the review is recorded or a flag is checked (Scr L886, Pat L656). */
export function safetyGate({ safetyReviewed, activeFlags }) {
  return !!safetyReviewed || (Array.isArray(activeFlags) ? activeFlags.length : 0) > 0;
}

/** The Scribe routes only with no open red flag and a recorded safety review (Scb L928). */
export function routingGate({ override, safetyReviewed }) {
  return !override && !!safetyReviewed;
}

/** The note may be signed only after the safety review, unless the site switches that off (Scb L1226). */
export function signGate({ safetyReviewed }) {
  return !SITE.REQUIRE_SAFETY_REVIEW_TO_SIGN || !!safetyReviewed;
}

/** A result is issued only when the attainable range sits in one band (Scr L400). */
export function coverageGate(score) {
  return !!(score && score.scorable);
}

/**
 * A referral is proposed only from a settled, non-lowest band, never while a red flag is open
 * (Screener) or before routing is cleared (Scribe), and never from a failed rule set (D6).
 * (Scr L1455, Scb L1400.) On the Scribe surface an open red flag also withholds the referral
 * here, rather than relying on the caller to derive routingCleared as routingGate does
 * (!override && safetyReviewed, Scb L928); for every routingCleared a host derives that way the
 * result equals Scb L1400.
 */
export function referralGate({ surface, override, routingCleared, score, routingError = null }) {
  return !override && (surface === "screener" || routingCleared === true)
    && !!(score && score.scorable) && score.band !== LOWEST_BAND
    && !routingError;
}

/** The calibration applies only to the scoring it was fitted to (D8, §3.10). */
export function calibrationGate(module) {
  return !!(module && module.research)
    && !!module.hashes
    && module.research.calibration?.appliesTo?.scoringHash === module.hashes.scoringHash;
}
