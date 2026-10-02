// tests/harness/kit.js — small helpers the core suites share (design 03 §8.0, §8.3). No
// imports; nothing happens at import time.
//
//   collector(h)        accumulates comparisons and Diffs (capped in memory, counted in full)
//   waitsOn(err)        "waits on WPn" from a WP0 stub's "not implemented: WPn" or a known
//                       not-yet-merged failure; null for anything else
//   pending(what, err)  the SuiteResult of a suite whose package has not merged (FAIL, never
//                       a vacuous PASS)
//   need(cond, msg)     throws a "waits on" error when an engine export is still a stub

const KEEP = 400;

/** Owner of each engine file and of the module files (design §9). */
export const OWNERS = {
  "scoring.js": "WP3", "evaluate.js": "WP3", "rules.js": "WP3", "gates.js": "WP3", "bind.js": "WP3",
  "generic.js": "WP3", "validate.js": "WP3", "lineage.js": "WP3", "fhir.js": "WP4", "cohort.js": "WP4",
  "extraction.js": "WP5", "probes.js": "WP5", "scribe.js": "WP5", "patient.js": "WP6",
  "derive.js": "WP11", "zip.js": "WP11", "exportAll.js": "WP11",
  "masque.rubric.json": "WP1", "masque.logic.js": "WP2", "registry.js": "WP12",
};

/** The "waits on WPn" phrase for an error, or null when the error is a real failure. */
export function waitsOn(err) {
  const msg = String((err && err.message) || err || "");
  const m = /not implemented: (WP\d+)/.exec(msg);
  if (m) return `waits on ${m[1]} (${msg.split("\n")[0]})`;
  if (err && err.waits) return msg.split("\n")[0];
  if (err && err.notPresent) return `waits on WP12/WP3: ${msg.split("\n")[0]}`;
  return null;
}

/** An error that marks a not-yet-merged dependency. */
export function waitError(msg) {
  const e = new Error(msg);
  e.waits = true;
  return e;
}

export function need(cond, msg) {
  if (!cond) throw waitError(msg);
}

/** FAIL result for a suite blocked on an unmerged package. */
export function pending(what, err, extraNotes = []) {
  const w = waitsOn(err);
  const why = w || `error: ${String((err && err.stack) || err)}`;
  return { verdict: "fail", n: 0, diffs: [], expectedMissing: [], notes: [`${what}: ${why}`, ...extraNotes] };
}

/**
 * Accumulates comparison results. `diff(a, b, opts)` runs h.diff (so observed ADs are recorded
 * on the run context) and keeps the first KEEP Diffs; `count` is the true total.
 */
export function collector(h) {
  const c = {
    n: 0,
    count: 0,
    diffs: [],
    notes: [],
    failedChecks: 0,
    diff(a, b, opts = {}) {
      c.n += 1;
      const r = h.diff(a, b, opts);
      c.add(r.diffs);
      return r;
    },
    add(diffs) {
      for (const d of diffs) {
        c.count += 1;
        if (c.diffs.length < KEEP) c.diffs.push(d);
      }
    },
    /** One named boolean check; a failure becomes a Diff at `path`. */
    check(ok, path, input, a, b) {
      c.n += 1;
      if (!ok) c.add([{ path, input, a, b }]);
      return ok;
    },
    note(msg) { c.notes.push(String(msg)); },
    result(extraNotes = []) {
      const notes = [...c.notes, ...extraNotes];
      if (c.count > c.diffs.length) notes.push(`${c.count} differences in total; the first ${c.diffs.length} are kept`);
      return { verdict: c.count ? "fail" : "pass", n: c.n, diffs: c.diffs, expectedMissing: [], notes };
    },
  };
  return c;
}

/** Load the built-in MASQUE module through the registry, or throw a "waits on" error. */
export async function loadMasque(h) {
  let r;
  try {
    r = await h.loadBuiltin();
  } catch (err) {
    throw waitError(`waits on WP12-M1 registry / WP3 bind / WP1-WP2 module files: ${String(err && err.message || err).split("\n")[0]}`);
  }
  if (!r || !r.module) {
    const v = (r && r.validation) || (r && r.entry && r.entry.validation);
    const e = v && Array.isArray(v.errors) && v.errors[0];
    throw waitError(`the built-in module did not load (waits on WP1/WP2/WP3): ${e ? `${e.code} ${e.path}: ${e.msg}` : "no module on the registry entry"}`);
  }
  return r;
}

/** Validation summary line for notes. */
export function validationNote(v) {
  if (!v) return "validation: none reported";
  const e = (v.errors || []).length, w = (v.warnings || []).length;
  return `validation: ${e} error(s), ${w} warning(s)${e ? " — " + v.errors.slice(0, 3).map((x) => `${x.code} ${x.path}`).join("; ") : ""}`;
}

/** Run fn over an iterable with a periodic yield so the page stays responsive. */
export async function forEachAsync(iterable, fn, every = 2000) {
  let i = 0;
  for (const x of iterable) {
    fn(x, i);
    i += 1;
    if (i % every === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return i;
}

/**
 * Wrap a suite body: a "waits on" error (an unmerged package) becomes the pending FAIL; an
 * INVALID error and any other throw propagate to the runner (FAIL with the stack).
 */
export function guarded(name, body) {
  return async (h) => {
    try {
      return await body(h);
    } catch (err) {
      if (err && err.invalid) throw err;
      if (waitsOn(err)) return pending(name, err);
      throw err;
    }
  };
}
