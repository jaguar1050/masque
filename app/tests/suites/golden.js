// tests/suites/golden.js — FHIR, CDS, dictionary, cohort row, bundle, note, summaryText vs baseline (WP4/WP5/WP6). Design 03 §8.3.
// Day-1 skeleton (WP13): reports FAIL "not implemented" until the suite is written.
export default {
  name: "golden",
  owner: "WP13",
  async run(h) {
    return h.notImplemented("golden suite: waits on WP4 (fhir.js, cohort.js), WP5 (scribe.js) and WP6 (patient.js)");
  },
};
