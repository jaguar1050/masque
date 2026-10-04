// engine/cohort.js — pilot cohort rows, CSV and the deterministic demo cohorts (design 03 §4.8).
// Owner: WP4.
//
// A captured screen is a row in the same canonical schema the research panel ingests. Two
// columns are deliberately left EMPTY rather than filled: `label` and `reference_diagnosis`.
// At capture time there is no reference standard, so writing a 0 there would fabricate a
// negative outcome; an exported cohort correctly reports "validation withheld" until a
// clinician fills the diagnosis in at follow-up. The empty column is the pilot instrument.
//
// Moved from the baseline Screener (Scr L69-79 subjectPseudonym, Scr L572-604 the row, with the
// ctx fix; Scr L606-616 rowsToCsv) and the baseline Simulator (Sim L285-305 makeCohort), with
// the module's identity, instrument version and item order injected. One row builder serves
// both apps (AD2), and every row carries `module_id` after `app_version`.
//
// Pure: no React, no side effects. Time and randomness enter only through `now` and `nonce`.
import { APP_VERSION, SITE } from "./policy.js";
import { normalizeAnswer } from "./vocab.js";

/** The canonical cohort columns, in row order (Inv §4.3 + module_id, AD2). Item ids follow. */
export const CANONICAL_FIELDS = Object.freeze([
  "screen_id", "captured_at", "instrument_version", "app_version", "module_id", "score", "label",
  "reference_diagnosis", "subject_id", "visit_label", "sex", "gender", "age", "weight", "annual_cost", "avoidable_cost",
  "complaint", "coverage", "scorable", "band", "red_flags",
]);

/*  Pseudonymisation for the pilot cohort (Scr L50-79).

    Everything longitudinal — test-retest, responsiveness, MCID validation — needs two screens
    linked to one person, and no unauthorised PII may leave the browser. Those are reconcilable
    only through a pseudonym: a one-way, site-local hash of the medical record number that is
    stable across sessions but carries nothing back to the patient.

    The salt MUST be replaced per site and kept with the site's other study secrets. An
    unchanged salt makes the pseudonym reversible by anyone holding this source and a list of
    MRNs (SITE.SALT_IS_DEFAULT says so). This is a prototype-grade construction; a real
    deployment should use a keyed hash (HMAC-SHA-256) via SubtleCrypto with the key in the
    site's secret store — the interface here is the same shape.
*/
export function subjectPseudonym(mrn, salt = SITE.SITE_SALT) {
  if (!mrn) return "";
  const input = `${salt}::${String(mrn).trim().toUpperCase()}`;
  // FNV-1a over two offsets for a wider output. Not cryptographic — see above.
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= input.charCodeAt(input.length - 1 - i); h2 = Math.imul(h2, 0x811c9dc5) >>> 0;
  }
  return "s-" + h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

const toEpochMs = (now) => (now instanceof Date ? now.getTime() : typeof now === "string" ? Date.parse(now) : now);

/** Item columns in module (instrument) order: domains in order, items in order. */
const itemsInOrder = (module) => module.domains.flatMap(d => d.items);

/**
 * One cohort row for a captured screen (Scr L572-604 with the ctx fix; AD2).
 * @param {Object} module  bound module
 * @param {{patient:Object, answers:Object, score:Object, activeFlags?:Object[], complaint?:string,
 *          ctx?:Object, visitLabel?:string}} screen   `score` is the computeScore result
 * @param {{appVersion?:string, salt?:string, now?:(number|Date|string), nonce?:string}} [opts]
 *        `now` defaults to Date.now(); `nonce` (the screen_id suffix) to 5 random base-36 digits.
 */
export function screenToCohortRow(module, screen, { appVersion = APP_VERSION, salt = SITE.SITE_SALT, now = Date.now(), nonce } = {}) {
  const { patient = {}, answers = {}, score, activeFlags, complaint, ctx = {} } = screen;
  const t = toEpochMs(now);
  const row = {
    screen_id: `${module.fhir.screenIdPrefix}${t.toString(36)}-${nonce ?? Math.random().toString(36).slice(2, 7)}`,
    captured_at: new Date(t).toISOString(),
    instrument_version: module.instrumentVersion,
    app_version: appVersion,
    module_id: module.id,
    score: score.total,
    label: "",                    // no reference standard at screening time
    reference_diagnosis: "",      // filled at follow-up — the outcome column
    // Sequence is derived at analysis time by sorting a subject's rows on captured_at, so no
    // row has to claim a visit number the app cannot know across sessions.
    subject_id: subjectPseudonym(patient.mrn, salt),
    visit_label: screen.visitLabel ?? ctx.visit_label ?? "",
    sex: patient.sex ?? "",
    gender: patient.gender ?? "",     // audited as a separate axis; never a fallback for sex
    age: patient.age ?? "",
    weight: "",
    annual_cost: "",
    avoidable_cost: "",
    complaint: complaint ?? "",
    coverage: score.coverage,
    scorable: score.scorable ? 1 : 0,
    band: score.band,
    red_flags: (activeFlags || []).map(f => f.id).join("|"),
  };
  for (const it of itemsInOrder(module)) {
    // Never let an item column overwrite a canonical one (V11 rejects such ids at load; this
    // is the engine-side gate for a module that reached here unvalidated).
    if (Object.prototype.hasOwnProperty.call(row, it.id)) {
      throw new Error(`cohort row: item id "${it.id}" names a canonical cohort column (V11)`);
    }
    const v = normalizeAnswer(answers?.[it.id]);
    // unanswered stays empty, not 0 — same invariant as the ingestion layer
    row[it.id] = v === undefined ? "" : (it.scale ? v : (v === "yes" ? 1 : 0));
  }
  return row;
}

/**
 * Rows to CSV (Scr L606-616): the union of keys in first-seen order; RFC 4180 quoting of any
 * value containing a quote, comma, CR or LF. A text value that a spreadsheet would read as a
 * formula (leading =, +, -, @, tab or CR) is neutralised with a leading apostrophe; numbers
 * are written as they are, so a negative number stays a number.
 */
export function rowsToCsv(rows) {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = v => {
    let s = v === null || v === undefined ? "" : String(v);
    if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}

/** The cohort CSV header alone: CANONICAL_FIELDS then the item ids in module order (no newline). */
export function cohortColumnsCsv(module) {
  return [...CANONICAL_FIELDS, ...itemsInOrder(module).map(it => it.id)].join(",");
}

/*  Deterministic synthetic cohorts (Sim L273-305), driven by a CohortSpec.

    Math.imul, not `*`: a plain multiply here exceeds 2^53 and the generator degrades into a
    non-uniform stream, which silently biases every group it fills. The draw order is the
    baseline's: per row one draw for the outcome, then one for the score.

    spec = {seed, prevalence, hi:{pos:[base,span], neg:[base,span]}, lo:{…},
            groups:[{sex, gender, n, hi, labeled}], extraRows?}
*/
const DEMO_CAPTURED_AT = "2026-04-01";   // Sim L294: every generated row carries this capture date

export function makeCohort(spec) {
  let s = spec.seed >>> 0;
  const R = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 4) / 0x10000000; };
  const rows = [];
  for (const g of spec.groups) {
    const r = g.hi ? spec.hi : spec.lo;
    for (let i = 0; i < g.n; i++) {
      const y = R() < spec.prevalence ? 1 : 0;
      rows.push({ score: Math.round(y ? r.pos[0] + R() * r.pos[1] : r.neg[0] + R() * r.neg[1]),
        label: g.labeled ? y : "", sex: g.sex, gender: g.gender,
        subject_id: `s-${g.sex[0]}${g.gender[0]}${i}`, captured_at: DEMO_CAPTURED_AT });
    }
  }
  for (const row of spec.extraRows || []) rows.push({ ...row });
  return rows;
}
