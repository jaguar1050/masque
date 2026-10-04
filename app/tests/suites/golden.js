// tests/suites/golden.js — the published artifacts vs the baseline builders (design 03 §8.3
// `golden`, §8.4). Owner: WP13; accepts WP4 (fhir, cohort), WP5 (note) and WP6 (summaryText).
//
// Built-in MASQUE, once:
//   Questionnaire   byte-equal (deep-equal with key order) to the baseline Screener's; vs the
//                   baseline Scribe's with AD6 only
//   CDS Hooks       byte-equal to the baseline Screener's
//   Dictionary      vs the baseline Screener's with AD3 and AD4 only
//   CSV header      cohortColumnsCsv vs the baseline row header, AD2 only
// Per screen — the 9 sample cases (4 Screener samples + 5 Simulator scenarios) and the empty
// screen × rf ∈ {none, rf_asym, rf_thunderclap + rf_asym} × routingCleared ∈ {true, false}:
//   Bundle (screener surface)   vs the baseline Screener's, AD1, AD14 and AD15 only
//   Bundle (scribe surface)     vs the baseline Scribe's, AD6 and AD14 only (its complaint is
//                               always a derived, declared phenotype value, so never AD15)
//   Note                        vs the baseline Scribe's, AD6 only (line by line)
//   Cohort row                  vs the baseline Screener's (AD2, AD4) and Scribe's (AD2 scribe, AD4)
//   CSV                         rowsToCsv of all rows, AD2 and AD4
//   summaryText en/es           vs the baseline Patient's, AD4 and AD10
// Every AD whose precondition occurs must be observed ("expected difference missing" otherwise).
// Non-built-in modules (a verified derivation with changed scoring; the shape fixture as a
// plain upload): their own code-system namespace; the provenance marker in the Questionnaire
// title and publisher and the provenance line in its description; derivedFrom for the
// derivation; the marker and line in the CDS service and every example card source; the
// dictionary's provenance object and score type `number 0–{scaleMax}`; the bundle Observation's
// provenance note.
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { ALLOWED_DIFFERENCES, ad6Pairs } from "../harness/diff.js";
import { bumpFirstWeight, derivedFixture } from "../harness/derivation.js";

const NOW = "2026-10-01T12:00:00.000Z";
const DATE = NOW.slice(0, 10);
const RF_SETS = [{}, { rf_asym: true }, { rf_thunderclap: true, rf_asym: true }];
const AD = Object.fromEntries(ALLOWED_DIFFERENCES.map((d) => [d.id, d]));

export default {
  name: "golden",
  owner: "WP13",
  run: guarded("golden", async (h) => {
    const { module, validation } = await loadMasque(h);
    const [fhir, cohort, scoring, rules, scribe, patient, policy] = await Promise.all(
      ["fhir.js", "cohort.js", "scoring.js", "rules.js", "scribe.js", "patient.js", "policy.js"].map((f) => h.engine(f)));
    need(typeof fhir.buildQuestionnaire === "function", "waits on WP4: fhir.js");
    const [scr, scb, pat, sim, prb] = await Promise.all([h.oracle("MASQUE_Screener_v0_3.jsx"), h.oracle("MASQUE_Scribe_v0_3.jsx"),
      h.oracle("MASQUE_Patient_v0_3.jsx"), h.oracle("MASQUE_Simulator.jsx"), h.oracle("MASQUE_Probes.js")]);
    const complaintSlice = (await h.slice("scribe.complaint")).fn;
    const scbGapSlice = (await h.slice("scribe.gapFlags")).fn;
    const c = collector(h);
    c.note(validationNote(validation));
    const pairs = ad6Pairs(scb.RED_FLAGS, scr.RED_FLAGS);
    const useMemo = (f) => f();
    const fixed = (fn) => h.withFixedClock(NOW, fn);

    // ------------------------------------------------------------------ once per module
    const qB = fixed(() => scr.buildQuestionnaire());
    const qN = fhir.buildQuestionnaire(module, { date: DATE });
    c.diff(qB, qN, { at: "/questionnaire", keyOrder: true });
    c.check(JSON.stringify(qB) === JSON.stringify(qN), "/questionnaire/@bytes", null, "byte-equal JSON", "differs");
    const qS = fixed(() => scb.buildQuestionnaire());
    const rq = c.diff(qS, qN, { at: "/questionnaire/@scribe", keyOrder: true, allow: ["AD6"], ctx: { AD6: pairs } });
    h.expect("AD6", { precondition: AD.AD6.detector({ strings: scb.RED_FLAGS.flatMap((f) => [f.text, f.points]), pairs }), observed: rq.observed.has("AD6") });
    const cB = scr.buildCdsHooks();
    const cN = fhir.buildCdsHooks(module);
    c.diff(cB, cN, { at: "/cds", keyOrder: true });
    c.check(JSON.stringify(cB) === JSON.stringify(cN), "/cds/@bytes", null, "byte-equal JSON", "differs");
    const dB = scr.buildDataDictionary();
    const dN = fhir.buildDataDictionary(module, { appVersion: policy.APP_VERSION });
    const rd = c.diff(dB, dN, { at: "/dictionary", keyOrder: true, allow: ["AD3", "AD4"], ctx: { AD3: {} } });
    h.expect("AD3", { precondition: true, observed: rd.observed.has("AD3") });
    h.expect("AD4", { precondition: true, observed: rd.observed.has("AD4") });

    // ------------------------------------------------------------------ the screen matrix
    const cases = [
      ...Object.entries(scr.SAMPLE_CASES).map(([id, s]) => ({ id, a: s.a, complaint: s.complaint, ctx: s.ctx })),
      ...sim.SCENARIOS.map((s) => ({ id: `sim-${s.id}`, a: s.apply().answers, complaint: "", ctx: {} })),
      { id: "empty", a: {}, complaint: "", ctx: {} },
    ];
    const probeNotes = prb.ALL_PROBES.flatMap((p) => p.opts.map((o) => o.note).filter(Boolean)).slice(0, 3);
    const rowsB = [], rowsN = [], rowsS = [], rowsSN = [];
    let seed = 1;
    let ad1Pre = 0, ad1Seen = 0, ad6Pre = 0, ad6Seen = 0, ad10Seen = 0, ad10Pre = 0, ad2Seen = 0, ad2Pre = 0;
    let ad14Pre = 0, ad14Seen = 0, ad15Pre = 0, ad15Seen = 0;
    const declared = ((module.phenotypes && module.phenotypes.values) || []).map((v) => v.value);
    const hasReferral = (b) => b.entry.some((e) => e.resource.resourceType === "ServiceRequest" && e.resource.priority === "routine");
    for (const cs of cases) for (const rf of RF_SETS) for (const routingCleared of [true, false]) {
      const input = { case: cs.id, rf, routingCleared };
      const a = cs.a;
      const sB = scb.computeScore(a);
      const sN = scoring.computeScore(module, a);
      const flagsScr = scr.RED_FLAGS.filter((f) => rf[f.id]);
      const flagsScb = scb.RED_FLAGS.filter((f) => rf[f.id]);
      const flagsN = rules.activeFlagsOf(module, rf);
      const emergent = flagsScr.some((f) => f.tier === "emergent");
      const override = flagsScr.length > 0;

      // Bundle, screener surface (AD1).
      const bB = fixed(() => scr.buildBundle({ patient: scr.DEMO_PATIENT, answers: a, total: sB.total, floor: sB.floor, ceiling: sB.ceiling,
        coverage: sB.coverage, scorable: sB.scorable, band: sB.band, domains: sB.domains, complaint: cs.complaint, ctx: cs.ctx, recs: [],
        activeFlags: flagsScr, emergent }));
      const bN = fhir.buildBundle(module, { patient: module.demo.patient, answers: a, score: sN, complaint: cs.complaint, activeFlags: flagsN,
        emergent, routingCleared, routingError: null }, { surface: "screener", now: NOW });
      const ad1 = { AD1: { total: sB.total, floor: sB.floor } };
      const rb = c.diff(bB, bN, { at: "/bundle/screener", input, keyOrder: true, allow: ["AD1", "AD14", "AD15"],
        ctx: { ...ad1, AD14: {}, AD15: { complaint: cs.complaint, declared, indexSrc: "CDS Hooks card · order-select" } } });
      const ad14Here = AD.AD14.detector({ domains: sB.domains });
      if (ad14Here) { ad14Pre++; if (rb.observed.has("AD14")) ad14Seen++; }
      if (AD.AD15.detector({ complaint: cs.complaint, declared, baselineIssued: hasReferral(bB) })) {
        ad15Pre++;
        if (rb.observed.has("AD15") && !hasReferral(bN)) ad15Seen++;
      }
      if (AD.AD1.detector({ surface: "screener", score: sB })) {
        // AD1 has two sites (the attainable-range low value and the Observation note); each
        // must show the floor, so each is checked on its own.
        const obsOf = (b) => b.entry.map((e) => e.resource).find((r) => r.resourceType === "Observation");
        const lowOf = (o) => ((o.component || []).find((x) => x.code.coding[0].code === "attainable-range") || {}).valueRange;
        const oB = obsOf(bB), oN = obsOf(bN);
        const site1 = h.diff(lowOf(oB) && lowOf(oB).low.value, lowOf(oN) && lowOf(oN).low.value, { at: "/bundle/screener/AD1/valueRange/low/value", allow: ["AD1"], ctx: ad1 });
        const site2 = h.diff(oB.note && oB.note[0].text, oN.note && oN.note[0].text, { at: "/bundle/screener/AD1/note/0/text", allow: ["AD1"], ctx: ad1 });
        ad1Pre += 2;
        if (site1.observed.has("AD1")) ad1Seen++;
        if (site2.observed.has("AD1")) ad1Seen++;
      }

      // Bundle, scribe surface (AD6). The Scribe derives routingCleared = !override && safetyReviewed
      // (Scb L928), so only that reachable combination is compared: the engine's referral gate also
      // refuses a referral while a red flag is open (decision F10), which differs from the baseline
      // formula only for inputs the app cannot produce.
      const safetyReviewed = routingCleared;
      const cleared = !override && safetyReviewed;
      const complaintS = complaintSlice(null, useMemo, a);
      const bS = fixed(() => scb.buildBundle({ patient: scb.PATIENT, answers: a, total: sB.total, floor: sB.floor, ceiling: sB.ceiling,
        coverage: sB.coverage, scorable: sB.scorable, band: sB.band, domains: sB.domains, complaint: complaintS, note: "",
        activeFlags: flagsScb, emergent, routingCleared: cleared }));
      const bSN = fhir.buildBundle(module, { patient: module.demo.patient, answers: a, score: sN, complaint: complaintS, activeFlags: flagsN,
        emergent, routingCleared: cleared, routingError: null }, { surface: "scribe", now: NOW });
      c.check(declared.includes(complaintS), "/bundle/scribe/complaint", input, `a declared phenotype value (${declared.join(", ")})`, complaintS);
      const r2 = c.diff(bS, bSN, { at: "/bundle/scribe", input, keyOrder: true, allow: ["AD6", "AD14"], ctx: { AD6: pairs, AD14: {} } });
      if (ad14Here) { ad14Pre++; if (r2.observed.has("AD14")) ad14Seen++; }
      const ad6Strings = flagsScb.flatMap((f) => [f.text, f.points, f.action]);
      const ad6Here = AD.AD6.detector({ strings: ad6Strings, pairs });
      if (ad6Here) { ad6Pre++; if (r2.observed.has("AD6")) ad6Seen++; }

      // Note (AD6).
      const recsB = scb.buildRecs(sB.band, complaintS, sB.domains, sB.scorable && cleared, a);
      const vmp = seed % 2 ? { vmp_cog: "yes", vmp_affect: "skip" } : {};
      const notes = seed % 3 ? [] : probeNotes;
      const gapAlert = scbGapSlice(cs.ctx).length >= 2;
      const nB = scb.buildNote({ patient: scb.PATIENT, answers: a, ctx: cs.ctx, vmp, total: sB.total, floor: sB.floor, ceiling: sB.ceiling,
        coverage: sB.coverage, scorable: sB.scorable, band: sB.band, complaint: complaintS, domains: sB.domains, recs: recsB, gapAlert,
        activeFlags: flagsScb, safetyReviewed, emergent, probeNotes: notes });
      const nN = scribe.buildNote(module, { patient: module.demo.patient, answers: a, ctx: cs.ctx, vmp, score: sN, complaint: complaintS,
        recs: recsB, routingError: null, gapAlert, activeFlags: flagsN, safetyReviewed, emergent, probeNotes: notes });
      const r3 = h.diff(nB.split("\n"), String(nN).split("\n"), { at: "/note", input: { ...input, vmp, probeNotes: notes.length }, allow: ["AD6"], ctx: { AD6: pairs } });
      c.n++;
      c.add(r3.diffs);
      if (ad6Here) { ad6Pre++; if (r3.observed.has("AD6")) ad6Seen++; }

      // Cohort rows (AD2, AD4).
      const nonce = h.rng(seed)().toString(36).slice(2, 7);
      const rowB = fixed(() => h.withSeededRandom(seed, () => scr.screenToCohortRow({ patient: scr.DEMO_PATIENT, answers: a, total: sB.total,
        coverage: sB.coverage, scorable: sB.scorable, band: sB.band, activeFlags: flagsScr, complaint: cs.complaint, ctx: cs.ctx })));
      const rowN = cohort.screenToCohortRow(module, { patient: module.demo.patient, answers: a, score: sN, activeFlags: flagsN, complaint: cs.complaint, ctx: cs.ctx },
        { appVersion: policy.APP_VERSION, now: Date.parse(NOW), nonce });
      const r4 = c.diff(rowB, rowN, { at: "/row/screener", input, keyOrder: true, allow: ["AD2", "AD4"], ctx: { AD2: { moduleId: module.id } } });
      ad2Pre++; if (r4.observed.has("AD2")) ad2Seen++;
      const rowS = fixed(() => h.withSeededRandom(seed, () => scb.screenToCohortRow({ patient: scb.PATIENT, answers: a, total: sB.total,
        coverage: sB.coverage, scorable: sB.scorable, band: sB.band, activeFlags: flagsScb, complaint: complaintS })));
      const rowSN = cohort.screenToCohortRow(module, { patient: module.demo.patient, answers: a, score: sN, activeFlags: flagsN, complaint: complaintS, ctx: {} },
        { appVersion: policy.APP_VERSION, now: Date.parse(NOW), nonce });
      const r5 = c.diff(rowS, rowSN, { at: "/row/scribe", input, keyOrder: true, allow: ["AD2", "AD4"], ctx: { AD2: { moduleId: module.id, scribe: true } } });
      ad2Pre++; if (r5.observed.has("AD2")) ad2Seen++;
      rowsB.push(rowB); rowsN.push(rowN); rowsS.push(rowS); rowsSN.push(rowSN);

      // summaryText en/es (AD4, AD10), once per case and flag set.
      if (routingCleared) {
        const view = patient.projectForPatient(module);
        for (const loc of ["en", "es"]) {
          const pflags = pat.RED_FLAGS.filter((f) => rf[f.id]).map((f) => pat.rfFor(loc, f));
          const urgent = pflags.some((f) => f.tier === "now");
          const sumB = pat.buildSummary({ a, ctx: cs.ctx, flags: pflags, urgent, loc });
          const { summary } = patient.buildPatientSummary(view, loc, { a, ctx: cs.ctx, flags: rf, urgent });
          const tB = pat.summaryText(sumB, pat.UI[loc]);
          const tN = summary ? patient.summaryText(view, loc, summary, { appVersion: policy.APP_VERSION, generatedAt: NOW }) : "[summary withheld]";
          const r6 = c.diff(tB, tN, { at: `/summaryText/${loc}`, input: { ...input, loc }, allow: ["AD4", "AD10"], ctx: { AD10: { notices: [], date: DATE } } });
          ad10Pre++; if (r6.observed.has("AD10")) ad10Seen++;
        }
      }
      seed++;
    }
    h.expect("AD1", { precondition: ad1Pre > 0, observed: ad1Seen === ad1Pre });
    h.expect("AD6", { precondition: ad6Pre > 0, observed: ad6Seen === ad6Pre });
    h.expect("AD2", { precondition: ad2Pre > 0, observed: ad2Seen === ad2Pre });
    h.expect("AD10", { precondition: ad10Pre > 0, observed: ad10Seen === ad10Pre });
    h.expect("AD14", { precondition: ad14Pre > 0, observed: ad14Seen === ad14Pre });
    h.expect("AD15", { precondition: ad15Pre > 0, observed: ad15Seen === ad15Pre });
    c.note(`screens: ${cases.length} cases × ${RF_SETS.length} flag sets × routingCleared {true, false}; AD1 seen ${ad1Seen}/${ad1Pre}, AD6 ${ad6Seen}/${ad6Pre}, AD2 ${ad2Seen}/${ad2Pre}, AD10 ${ad10Seen}/${ad10Pre}, AD14 ${ad14Seen}/${ad14Pre}, AD15 ${ad15Seen}/${ad15Pre}`);

    // CSV (AD2, AD4) and the header-only CSV.
    c.diff(scr.rowsToCsv(rowsB), cohort.rowsToCsv(rowsN), { at: "/csv/screener", allow: ["AD2", "AD4"], ctx: { AD2: { moduleId: module.id } } });
    c.diff(scr.rowsToCsv(rowsS), cohort.rowsToCsv(rowsSN), { at: "/csv/scribe", allow: ["AD2", "AD4"], ctx: { AD2: { moduleId: module.id, scribe: true } } });
    const headerB = scr.rowsToCsv(rowsB).split("\n")[0];
    const rh = c.diff(headerB, cohort.cohortColumnsCsv(module), { at: "/csv/header", allow: ["AD2"], ctx: { AD2: { moduleId: module.id } } });
    h.expect("AD2", { precondition: true, observed: rh.observed.has("AD2") });

    // ------------------------------------------------------------------ non-built-in modules
    const others = [];
    try {
      others.push({ kind: "derived", ...(await derivedFixture(h, module, { mutate: bumpFirstWeight })) });
    } catch (err) {
      c.check(false, "/nonbuiltin/derived", null, "a verified derivation", `could not build: ${String(err.message).split("\n")[0]}`);
    }
    try {
      const up = await h.loadFixture("shape", { builtins: [module], loaded: [module] });
      others.push({ kind: "uploaded", ...up });
    } catch (err) {
      c.check(false, "/nonbuiltin/uploaded", null, "the shape fixture as a plain upload", `could not load: ${String(err.message).split("\n")[0]}`);
    }
    for (const o of others) {
      const m = o.module;
      const at = `/nonbuiltin/${o.kind}`;
      const marker = o.kind === "derived" ? policy.CAVEATS.edited.short : policy.CAVEATS.uploaded.short;
      const line = o.kind === "derived" ? policy.CAVEATS.edited.en : policy.CAVEATS.uploaded.en;
      c.check(m.origin === o.kind, `${at}/origin`, null, o.kind, m.origin);
      if (o.kind === "derived") c.check(o.classification && o.classification.kind === "verified", `${at}/classification`, null, "verified (row 3)", o.classification && `${o.classification.kind} (row ${o.classification.row}): ${(o.classification.reasons || []).join("; ")}`);
      c.check(!(o.validation.errors || []).length, `${at}/validation`, null, "0 errors", (o.validation.errors || []).map((e) => `${e.code} ${e.path}`).slice(0, 5));
      const q = fhir.buildQuestionnaire(m, { date: DATE });
      const cds = fhir.buildCdsHooks(m);
      const dict = fhir.buildDataDictionary(m, { appVersion: policy.APP_VERSION });
      const sys = m.fhir.codeSystem;
      c.check(sys !== module.fhir.codeSystem && sys.includes(m.id), `${at}/codeSystem`, null, `its own namespace (contains "${m.id}")`, sys);
      const { derivedFrom, ...qRest } = q;
      for (const [name, doc] of [["questionnaire", qRest], ["cds", cds], ["dictionary", dict]]) {
        const text = JSON.stringify(doc);
        c.check(!text.includes(module.fhir.codeSystem), `${at}/${name}/@namespace`, null, `no identifier in ${module.fhir.codeSystem}`, "found");
      }
      c.check(q.title === `${m.fhir.questionnaireTitle} · ${marker}`, `${at}/questionnaire/title`, null, `${m.fhir.questionnaireTitle} · ${marker}`, q.title);
      c.check(q.publisher === `${m.fhir.publisher} · ${marker}`, `${at}/questionnaire/publisher`, null, `${m.fhir.publisher} · ${marker}`, q.publisher);
      c.check(typeof q.description === "string" && q.description.startsWith(`${m.fhir.description}\n\n`) && q.description.includes(line),
        `${at}/questionnaire/description`, null, `description + "\\n\\n" + a provenance line containing "${line}"`, q.description);
      if (o.kind === "derived") {
        c.diff([`${module.fhir.questionnaireUrl}|${module.instrumentVersion}`], derivedFrom, { at: `${at}/questionnaire/derivedFrom` });
      } else {
        c.check(derivedFrom === undefined, `${at}/questionnaire/derivedFrom`, null, "[absent]", derivedFrom);
      }
      const svc = cds.discovery.services[0];
      c.check(svc.title === `${m.cds.title} · ${marker}`, `${at}/cds/title`, null, `${m.cds.title} · ${marker}`, svc.title);
      c.check(typeof svc.description === "string" && svc.description.includes(line), `${at}/cds/description`, null, `contains "${line}"`, svc.description);
      for (const [k, resp] of Object.entries(cds.exampleResponses)) {
        for (const card of resp.cards || []) c.check(card.source && card.source.label === `${m.cds.source.label} · ${marker}`, `${at}/cds/exampleResponses/${k}/source/label`, null, `${m.cds.source.label} · ${marker}`, card.source && card.source.label);
      }
      c.check(dict.provenance && dict.provenance.origin === m.origin && typeof dict.provenance.line === "string" && dict.provenance.line.includes(line),
        `${at}/dictionary/provenance`, null, { origin: m.origin, line: `contains "${line}"` }, dict.provenance);
      const score = (dict.canonicalCohortFields || []).find((f) => f.name === "score");
      c.check(score && score.type === `number 0–${m.scaleMax}`, `${at}/dictionary/score/type`, null, `number 0–${m.scaleMax}`, score && score.type);
      const sN = scoring.computeScore(m, {});
      const bundle = fhir.buildBundle(m, { patient: m.demo.patient, answers: {}, score: sN, complaint: "", activeFlags: [], routingCleared: true }, { surface: "screener", now: NOW });
      const obs = bundle.entry.find((e) => e.resource.resourceType === "Observation").resource;
      c.check((obs.note || []).some((n) => n.text.includes(line)), `${at}/bundle/Observation/note`, null, `a note containing "${line}"`, obs.note);
      c.check(obs.code.coding[0].system === sys, `${at}/bundle/Observation/code/system`, null, sys, obs.code.coding[0].system);
      if (o.kind === "derived" && m.hashes.scoringHash !== module.hashes.scoringHash) {
        c.check(!(m.cds.examples && m.cds.examples.settled) && !cds.exampleResponses.settledNonLowBand, `${at}/cds/settled`, null, "removed (scoring changed)", "present");
      }
    }
    c.note(`non-built-in modules checked: ${others.map((o) => `${o.module.id} (${o.kind})`).join(", ") || "none"}`);
    return c.result();
  }),
};
