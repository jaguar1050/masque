// tests/suites/shape.js — the data-only shape fixture through every engine function (design 03
// §8.3 `shape`, §3.5). Owner: WP13; accepts WP3-WP6 now and WP7-WP12 later.
//
// Engine half (runs now), on tests/fixtures/modules/shape.rubric.json bound generic (a plain
// upload next to the built-ins): it validates with zero errors; every engine function runs on
// it without throwing over a seeded answer sweep; and the §3.5 defaults hold:
//   - routing: the screener shows the engine card "No routing rules in this module" once the
//     screen is cleared and scorable; the scribe shows nothing; override and incomplete cards
//     still come first;
//   - phenotypes: complaint "" everywhere, every domain active, no referral, no CDS index card;
//   - the generic patient summary quotes each item's own `q` verbatim (" — option" for a scale
//     value > 0), asks nothing and has no gap line;
//   - no lexicon: extract captures nothing, availability says "no voice capture (no lexicon)";
//   - no probes: the probe rail is empty; no research: no population estimates;
//   - the Patient Companion works, and its .txt / .html exports match no OMISSION_PATTERNS.
// Render half (waits on WP7-WP10 and WP12-M2): all five tabs render with no console error and
// the card texts appear. Until then this suite FAILS with a "waits on" note.
import { collector, guarded, loadMasque, need } from "../harness/kit.js";
import { drawAnswers } from "../harness/matrix.js";

const NOW = "2026-10-01T12:00:00.000Z";
const NO_ROUTING = { h: "No routing rules in this module", p: "This module defines no routing rules, so no next step is suggested from the index." };

export default {
  name: "shape",
  owner: "WP13",
  run: guarded("shape", async (h) => {
    const { module: masque } = await loadMasque(h);
    const E = {};
    for (const f of ["scoring.js", "rules.js", "gates.js", "scribe.js", "fhir.js", "cohort.js", "patient.js", "probes.js", "extraction.js", "lineage.js", "policy.js"]) E[f.replace(".js", "")] = await h.engine(f);
    need(typeof E.scoring.computeScore === "function", "waits on WP3");
    const c = collector(h);
    const { module: m, validation } = await h.loadFixture("shape", { builtins: [masque], loaded: [masque] });
    c.check(!(validation.errors || []).length, "/validation/errors", null, [], (validation.errors || []).map((e) => `${e.code} ${e.path}`));
    c.note(`shape: ${m.domains.length} domains, ${m.allItems.length} items, origin ${m.origin}; ${validation.warnings.length} warning(s)`);
    c.check(m.origin === "uploaded", "/origin", null, "uploaded", m.origin);

    // Availability (§4.16).
    const av = E.lineage.availability(m);
    c.check(av.scribe.voice === false && av.scribe.reason === "no voice capture (no lexicon)", "/availability/scribe", null, { voice: false, reason: "no voice capture (no lexicon)" }, av.scribe);
    c.check(av.scribe.probes === false, "/availability/scribe/probes", null, false, av.scribe.probes);
    c.check(av.patient.available === true, "/availability/patient", null, true, av.patient);
    c.check(av.research.population === false && av.research.readiness === false, "/availability/research", null, { population: false, readiness: false }, av.research);

    // A seeded sweep through every engine function.
    const rng = h.rng(h.seed ^ 0x53484150); // "SHAP"
    const items = m.allItems.map((it) => ({ id: it.id, scale: it.scale }));
    const flagIds = m.redFlags.map((f) => f.id);
    const view = E.patient.projectForPatient(m);
    let sawCard = 0, sawScorable = 0;
    const N = h.quick ? 300 : 2000;
    for (let i = 0; i < N; i++) {
      const p = [0, 0.15, 0.3, 0.6, 1][i % 5];
      const answers = drawAnswers(rng, items, p);
      const rf = rng() < 0.15 ? { [flagIds[0]]: true } : {};
      const safetyReviewed = rng() < 0.8;
      const input = { answers, rf, safetyReviewed };
      try {
        const score = E.scoring.computeScore(m, answers);
        const ph = E.rules.derivePhenotype(m, answers);
        c.check(ph.value === "" && ph.error === null, "/derivePhenotype", input, { value: "", error: null }, ph);
        const act = E.rules.activeDomains(m, { answers, complaint: "" });
        c.check(act.domains.size === m.domains.length, "/activeDomains", input, m.domainOrder, [...act.domains]);
        for (const surface of ["screener", "scribe"]) {
          const st = E.rules.buildRoutingState(m, { surface, answers, ctx: {}, complaint: "", score, activeFlags: rf, safetyReviewed });
          const out = E.rules.routingRecs(m, st);
          const override = Object.keys(rf).length > 0;
          if (surface === "screener" && !override && score.scorable) {
            sawCard++;
            c.check(out.recs.length === 1 && out.recs[0].h === NO_ROUTING.h && out.recs[0].p === NO_ROUTING.p, "/routingRecs/screener/@generic", input, NO_ROUTING, out.recs);
          }
          if (surface === "scribe" && !override && score.scorable) c.check(out.recs.length === 0, "/routingRecs/scribe", input, [], out.recs);
          c.check(out.error === null, `/routingRecs/${surface}/error`, input, null, out.error);
          const pv = E.rules.cdsPreview(m, st, { routingError: null });
          c.check(pv.index === null, `/cdsPreview/${surface}/index`, input, null, pv.index);
          const bundle = E.fhir.buildBundle(m, { patient: m.demo.patient, answers, score, complaint: "", activeFlags: E.rules.activeFlagsOf(m, rf),
            routingCleared: !override && safetyReviewed, routingError: null }, { surface, now: NOW });
          c.check(!bundle.entry.some((e) => e.resource.resourceType === "ServiceRequest" && e.resource.priority === "routine"), `/buildBundle/${surface}/referral`, input, "none", "a referral");
          if (surface === "scribe") {
            const note = E.scribe.buildNote(m, { patient: m.demo.patient, answers, ctx: {}, vmp: {}, score, complaint: "", recs: out.recs, routingError: null,
              gapAlert: false, activeFlags: E.rules.activeFlagsOf(m, rf), safetyReviewed, probeNotes: [] });
            c.check(typeof note === "string" && note.length > 0, "/buildNote", input, "a note", typeof note);
          }
        }
        if (score.scorable) sawScorable++;
        c.check(E.rules.referralFor(m, "") === null, "/referralFor", input, null, E.rules.referralFor(m, ""));
        const sug = E.scribe.rankSuggestions(m, { answers, complaint: "", vmp: {}, scorable: score.scorable, skipped: {} });
        c.check(Array.isArray(sug.list) && sug.list.every((s) => s.kind === "scored"), "/rankSuggestions", input, "scored items only", sug.list);
        c.check(E.probes.liveProbes(m.logic && m.logic.probes ? m.logic.probes.list : [], answers, rf, {}).length === 0, "/liveProbes", input, [], "probes");
        c.check(E.extraction.extract(m.lexicon, "Example item A1 and example item B1", {}).length === 0, "/extract", input, [], "captures");
        const row = E.cohort.screenToCohortRow(m, { patient: m.demo.patient, answers, score, activeFlags: [], complaint: "", ctx: {} }, { now: Date.parse(NOW), nonce: "aaaaa" });
        c.check(row.module_id === m.id && row.complaint === "", "/screenToCohortRow", input, { module_id: m.id, complaint: "" }, { module_id: row.module_id, complaint: row.complaint });
        // Generic summary: the module's own wording, verbatim.
        const { summary, error } = E.patient.buildPatientSummary(view, "en", { a: answers, ctx: {}, flags: rf });
        if (c.check(!error && !!summary, "/buildPatientSummary", input, "a summary", error)) {
          const en = m.rubric.locales.en.items;
          const want = [];
          for (const it of m.allItems) {
            const v = answers[it.id];
            if (it.scale) { if (typeof v === "number" && v > 0) want.push(`${en[it.id].q} — ${en[it.id].opts[v]}`); }
            else if (v === "yes") want.push(en[it.id].q);
          }
          c.diff(want, summary.said, { at: "/summary/said", input });
          c.diff([], summary.ask, { at: "/summary/ask", input });
          c.check(summary.gapLine === null, "/summary/gapLine", input, null, summary.gapLine);
          const txt = E.patient.summaryText(view, "en", summary, { generatedAt: NOW });
          const html = E.patient.summaryHtml(view, "en", summary, { generatedAt: NOW });
          for (const re of E.policy.OMISSION_PATTERNS) {
            c.check(!re.test(txt), "/summaryText/@pattern", { ...input, pattern: String(re) }, "no match", "match");
            const body = new DOMParser().parseFromString(html, "text/html").body.textContent;
            c.check(!re.test(body), "/summaryHtml/@pattern", { ...input, pattern: String(re) }, "no match", "match");
          }
        }
      } catch (err) {
        if (/not implemented/.test(err.message)) throw err;
        c.check(false, "/threw", input, "no throw", String(err.stack || err.message).split("\n").slice(0, 3).join(" | "));
      }
    }
    c.check(sawCard > 0, "/@coverage/genericCard", null, "> 0", sawCard);
    // The published artifacts build.
    for (const [name, fn] of [["buildQuestionnaire", () => E.fhir.buildQuestionnaire(m, { date: NOW.slice(0, 10) })], ["buildCdsHooks", () => E.fhir.buildCdsHooks(m)],
      ["buildDataDictionary", () => E.fhir.buildDataDictionary(m, {})], ["cohortColumnsCsv", () => E.cohort.cohortColumnsCsv(m)]]) {
      try { fn(); c.check(true, `/${name}`); } catch (err) { c.check(false, `/${name}`, null, "builds", String(err.message)); }
    }
    const cds = E.fhir.buildCdsHooks(m);
    c.check(!cds.exampleResponses.settledNonLowBand && Array.isArray(cds.exampleResponses.notScorable.cards) && !!cds.exampleResponses.redFlagPresent,
      "/buildCdsHooks/examples", null, "redFlagPresent + notScorable, no settled", Object.keys(cds.exampleResponses));
    c.note(`${N} answer sets (${sawScorable} scorable; the generic screener card checked ${sawCard} times)`);
    const res = c.result();
    return { ...res, verdict: res.verdict === "pass" ? "fail" : res.verdict,
      notes: [...res.notes, `engine half ${res.verdict.toUpperCase()}; the suite waits on WP7-WP10 and WP12-M2 for the five-tab render with no console error`] };
  }),
};
