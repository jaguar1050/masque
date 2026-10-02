// tests/suites/patient.js — Patient Companion summary parity (design 03 §8.3 `patient`, §8.5).
// Owner: WP13; accepts WP6 (with WP1's locales and WP2's summary logic).
//
// Over 20,000 Patient states (2,000 with ?quick=1; §8.5: each item undefined .15 / "unsure" .10
// / a value .75, Patient-vocabulary context, red flags, loc ∈ {en, es}):
//   - baseline buildSummary({a, ctx, flags, urgent, loc}) vs
//     buildPatientSummary(projectForPatient(masque), loc, {a, ctx, flags: rf, urgent}) on
//     said, ask, gapLine, unsureList, clin (deep-equal, key order) and urgent;
//   - the summary's flags vs the baseline's rfFor(loc, f): id, q, say, and the tier through
//     TIER_DISPLAY (emergent → now, urgent → soon);
//   - summaryText: the baseline's (summary, UI[loc]) vs the engine's, with AD4 (release
//     string) and AD10 (the final dated caveat line) as the only normalisations; the dated
//     line is expected on every export ("expected difference missing" otherwise).
// Exhaustively: askForm × every item id × {en, es}; list/joinList for 1-5 words × {en, es};
// flagCopy for every flag × {en, es}.
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { flatItems, patientStream, sizes } from "../harness/matrix.js";

const GENERATED_AT = "2026-10-01T12:00:00.000Z";
const LOCALES = ["en", "es"];
const SUMMARY_KEYS = ["said", "ask", "gapLine", "unsureList", "clin", "urgent"];

const pickKeys = (o, keys) => Object.fromEntries(keys.map((k) => [k, o ? o[k] : undefined]));

export default {
  name: "patient",
  owner: "WP13",
  run: guarded("patient", async (h) => {
    const { module, validation } = await loadMasque(h);
    const patient = await h.engine("patient.js");
    need(typeof patient.projectForPatient === "function" && typeof patient.buildPatientSummary === "function", "waits on WP6: patient.js");
    const [pat, scr] = await Promise.all([h.oracle("MASQUE_Patient_v0_3.jsx"), h.oracle("MASQUE_Screener_v0_3.jsx")]);
    const c = collector(h);
    c.note(validationNote(validation));
    const view = patient.projectForPatient(module);
    const tierKey = (t) => (patient.TIER_DISPLAY[t] ? patient.TIER_DISPLAY[t].key : `?${t}`);

    // askForm × every item id × locale.
    const ids = Object.keys(pat.P);
    for (const loc of LOCALES) for (const id of ids) {
      c.diff(pat.askForm(id, loc), patient.askForm(view, loc, id), { at: `/askForm/${loc}/${id}`, input: { id, loc } });
    }
    // list / joinList, lengths 1-5.
    const words = ["alpha", "beta y gamma", "delta, epsilon", "zeta", "eta"];
    for (const loc of LOCALES) for (let k = 1; k <= 5; k++) {
      const xs = words.slice(0, k);
      c.diff(pat.list(xs, loc), patient.joinList(loc, xs), { at: `/list/${loc}/${k}`, input: { xs, loc } });
    }
    // flagCopy.
    for (const loc of LOCALES) {
      const want = pat.RED_FLAGS.map((f) => pat.rfFor(loc, f)).map((f) => ({ id: f.id, tier: f.tier, q: f.q, say: f.say }));
      const got = patient.flagCopy(view, loc).map((f) => ({ id: f.id, tier: tierKey(f.tier), q: f.q, say: f.say }));
      c.diff(want, got, { at: `/flagCopy/${loc}`, input: { loc }, keyOrder: true });
    }

    // The §8.5 Patient matrix.
    const rng = h.rng(h.seed ^ 0x50415449); // "PATI"
    const spec = {
      items: flatItems(scr.ITEMS, scr.DOMAIN_ORDER),
      contextOptions: Object.fromEntries(pat.CONTEXT_Q.map((q) => [q.id, q.opts.map(([v]) => v)])),
      flagIds: pat.RED_FLAGS.map((f) => f.id),
      locales: LOCALES,
    };
    let n = 0, errors = 0, caveatSeen = 0;
    for (const s of patientStream(rng, spec, sizes(h.quick).patient)) {
      const flags = pat.RED_FLAGS.filter((f) => s.rf[f.id]).map((f) => pat.rfFor(s.loc, f));
      const urgent = flags.some((f) => f.tier === "now");
      const input = { a: s.a, ctx: s.ctx, rf: s.rf, loc: s.loc };
      const want = pat.buildSummary({ a: s.a, ctx: s.ctx, flags, urgent, loc: s.loc });
      const { summary, error } = patient.buildPatientSummary(view, s.loc, { a: s.a, ctx: s.ctx, flags: s.rf, urgent });
      n++;
      if (error || !summary) {
        errors++;
        c.check(false, "/buildPatientSummary/error", input, "a summary", error ? `${error.ruleId}: ${error.message}` : "null");
        continue;
      }
      c.diff(pickKeys(want, SUMMARY_KEYS), pickKeys(summary, SUMMARY_KEYS), { at: "/summary", input, keyOrder: true });
      c.diff(want.flags.map((f) => ({ id: f.id, tier: f.tier, q: f.q, say: f.say })),
        (summary.flags || []).map((f) => ({ id: f.id, tier: tierKey(f.tier), q: f.q, say: f.say })), { at: "/summary/flags", input, keyOrder: true });
      const wantText = pat.summaryText(want, pat.UI[s.loc]);
      const gotText = patient.summaryText(view, s.loc, summary, { generatedAt: GENERATED_AT });
      const r = c.diff(wantText, gotText, { at: "/summaryText", input, allow: ["AD4", "AD10"], ctx: { AD10: { notices: [], date: GENERATED_AT.slice(0, 10) } } });
      if (r.observed.has("AD10")) caveatSeen++;
      if (n % 2000 === 0) await new Promise((res) => setTimeout(res, 0));
    }
    h.expect("AD10", { precondition: n > errors, observed: caveatSeen === n - errors });
    c.note(`${n} Patient states (seed 0x${h.seed.toString(16)}); ${errors} withheld summaries; the dated caveat line closed ${caveatSeen} exports`);
    return c.result();
  }),
};
