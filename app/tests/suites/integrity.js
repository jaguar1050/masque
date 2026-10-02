// tests/suites/integrity.js — the oracles are what the design assumes (design 03 §8.1, §8.2).
//
//   1. tests/baseline/MANIFEST.sha256 matches its own pin (harness/divergences.js) and
//      verifies against the served bytes (all eleven files);
//   2. every reference/fixed-src file matches its SHA-256 pin (harness/divergences.js);
//   3. divergence audit: the line diff fixed-src → baseline equals the pinned hunk list,
//      hunk for hunk (header and content hash); the other files are identical;
//   4. every oracle compiles with its §8.2 export list appended, from the baseline and from
//      reference/fixed-src, and every appended name is defined.
// 1-3 failing is INVALID (the oracle is not the one the design assumes); 4 failing is FAIL
// (the harness cannot read an oracle it promises).
import { FIXED_SRC_SHA256, HUNKS, lineDiff, hunkPinText } from "../harness/divergences.js";
import { ORACLE_EXPORTS, BASELINE_FILES } from "../harness/oracles.js";

export default {
  name: "integrity",
  owner: "WP13",
  async run(h) {
    const notes = [];
    const invalid = [];
    const failed = [];
    let n = 0;

    // 1. Baseline manifest.
    const manifest = await h.verifyManifest();
    n += 1;
    if (!manifest.ok) {
      if (manifest.error) invalid.push(manifest.error);
      for (const m of manifest.mismatches) invalid.push(`baseline ${m.path}: sha256 ${m.got} ≠ manifest ${m.expected}`);
      for (const m of manifest.missing) invalid.push(`baseline ${m.path}: ${m.error}`);
      for (const p of manifest.unlisted) invalid.push(`baseline ${p} is not listed in MANIFEST.sha256`);
    } else {
      notes.push(`baseline manifest: matches its pin; ${manifest.checked} files verify`);
    }

    // 2. fixed-src pins.
    let pinsOk = 0;
    for (const file of Object.keys(FIXED_SRC_SHA256)) {
      const r = await h.verifyReference(file);
      n += 1;
      if (r.ok) pinsOk += 1;
      else invalid.push(`reference/fixed-src/${file}: ${r.error || `sha256 ${r.got} ≠ pin ${r.expected}`}`);
    }
    notes.push(`fixed-src pins: ${pinsOk}/${Object.keys(FIXED_SRC_SHA256).length} match`);

    // 3. Divergence audit (only meaningful when 1 and 2 hold).
    if (!invalid.length) {
      let hunksSeen = 0;
      const auditInvalid = invalid.length;
      for (const [file, pin] of Object.entries(HUNKS)) {
        const [oldText, newText] = await Promise.all([h.referenceText(file), h.baselineText(file)]);
        const hunks = lineDiff(oldText, newText);
        n += 1;
        const got = [];
        for (const hk of hunks) got.push({ header: hk.header, sha256: await h.sha256(hunkPinText(hk)) });
        hunksSeen += got.length;
        const want = pin.hunks;
        const extra = got.filter((g) => !want.some((w) => w.header === g.header && w.sha256 === g.sha256));
        const missing = want.filter((w) => !got.some((g) => g.header === w.header && g.sha256 === w.sha256));
        if (extra.length || missing.length || got.length !== want.length) {
          invalid.push(`divergence audit ${file}: ` +
            (extra.length ? `unexpected hunk(s) ${extra.map((x) => x.header).join(", ")}` : "") +
            (extra.length && missing.length ? "; " : "") +
            (missing.length ? `missing hunk(s) ${missing.map((x) => x.header).join(", ")}` : "") +
            (!extra.length && !missing.length ? `hunk order/count ${got.length} ≠ ${want.length}` : ""));
        }
      }
      const audited = `divergence audit: ${hunksSeen} hunks over ${Object.keys(HUNKS).length} files`;
      notes.push(invalid.length === auditInvalid ? `${audited}, as pinned` : `${audited}, NOT as pinned (see below)`);
    }

    if (invalid.length) {
      return { verdict: "invalid", n, diffs: [], expectedMissing: [], notes: [...notes, ...invalid] };
    }

    // 4. Oracles compile with their export lists.
    let oraclesOk = 0;
    for (const file of BASELINE_FILES) {
      n += 1;
      try {
        const ns = await h.oracle(file);
        const undef = (ORACLE_EXPORTS[file] || []).filter((name) => ns[name] === undefined);
        if (undef.length) failed.push(`oracle ${file}: undefined export(s) ${undef.join(", ")}`);
        else oraclesOk += 1;
      } catch (err) {
        if (err.invalid) throw err;
        failed.push(`oracle ${file}: ${String(err.message).split("\n")[0]}`);
      }
    }
    notes.push(`baseline oracles: ${oraclesOk}/${BASELINE_FILES.length} compile with their export lists`);
    let refsOk = 0;
    for (const file of Object.keys(FIXED_SRC_SHA256)) {
      n += 1;
      try {
        const ns = await h.reference(file);
        const undef = (ORACLE_EXPORTS[file] || []).filter((name) => ns[name] === undefined);
        if (undef.length) failed.push(`reference ${file}: undefined export(s) ${undef.join(", ")}`);
        else refsOk += 1;
      } catch (err) {
        if (err.invalid) throw err;
        failed.push(`reference ${file}: ${String(err.message).split("\n")[0]}`);
      }
    }
    notes.push(`reference oracles: ${refsOk}/${Object.keys(FIXED_SRC_SHA256).length} compile with their export lists`);

    // The pinned slice mechanism (§8.2) works end to end on the day-1 slice.
    n += 1;
    try {
      const { fn, params } = await h.slice("screener.gapFlags");
      const out = fn(...params.map((p) => (p === "ctx" ? { c_clin: "3+", c_dur: ">12mo" } : undefined)));
      if (!Array.isArray(out) || out.length !== 2) failed.push(`slice screener.gapFlags returned ${JSON.stringify(out)}`);
      else notes.push("slice screener.gapFlags: hash verified, compiled and evaluated");
    } catch (err) {
      if (err.invalid) throw err;
      failed.push(`slice screener.gapFlags: ${String(err.message).split("\n")[0]}`);
    }

    return { verdict: failed.length ? "fail" : "pass", n, diffs: [], expectedMissing: [], notes: [...notes, ...failed] };
  },
};
