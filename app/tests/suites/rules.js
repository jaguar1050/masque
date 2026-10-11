// tests/suites/rules.js — routing, phenotype, activation, suggestions, gap, referral, CDS preview,
// capture labels and the note, plus the fail-closed cases (design 03 §8.3 `rules`, §3.3, §8.5).
// Owner: WP13; accepts WP3 (rules) and WP5 (suggestions, labels, note), with WP2's logic.
//
// Over 20,000 rule states (2,000 with ?quick=1; §8.5), each compared with the frozen baseline:
//   Screener routingRecs(screener state)     vs the `recs` slice (Scr L891-952): h, p, chips
//   Scribe   routingRecs(scribe state)       vs buildRecs(band, complaint, domains, scorable && routingCleared, answers)
//   derivePhenotype                          vs the `complaint` slice (Scb L846-850)
//   activeDomains                            vs the active-domain slice (Scb L857-859)
//   rankSuggestions (with skipped, vmp)      vs the `suggestions` slice (Scb L856-879), AD18 only
//                                            (the slice run with scorable inverted is the intended list)
//   gapSignals labels / alert                vs both `gapFlags` slices (Scr L873-878, Scb L916-920)
//   cdsPreview                               vs the CDS preview slice (Scr L1329-1349), by rendered textContent,
//                                            AD20 only (no index card for an undeclared complaint)
//   buildNote(routingRecs …)                 vs buildNote(buildRecs …), AD6 only
// Exhaustively: captureLabel vs capLabel for every item value, context item and flag (AD6 on
// red-flag captures); referralFor vs the referral text of the baseline Screener and Scribe
// bundles for every complaint (release 0.4.5: AD17 on the otologic and both destinations, expected
// on both bundles of each; release 0.4.7: AD20 for "", decision F11); referralFor/cdsPreview never
// read an inherited property of the byPhenotype tables.
// Release 0.4.5, the clinical-lead referral rule (no automatic escalation): referralFor unit cases
// (otologic → Neurology — vestibular migraine and both → Neurology — mid-facial / migrainous cause,
// whatever probe answers are passed, pr_internal_vertigo's included; sinonasal keeps Headache
// medicine / Neurology through the table's default; no complaint and an unknown phenotype issue no
// referral (release 0.4.7, decision F11); a routing error → null), the referral table
// and the engine carry no escalation, the bundle on both surfaces in every sample state that
// issues a referral (and none under a red flag, uncleared routing or a routing error), and the
// AD17 self-checks (it excuses exactly otologic Neuro-otology → Neurology and both Headache
// medicine / Neurology → Neurology, each with its own reason; an exhaustive sweep over phenotypes,
// specialties and reasons, the reverse direction, another path and a malformed or missing delta).
// Fail-closed (D6, §3.3): a copy of the MASQUE logic with a throwing routing rule, and one with
// a throwing derive rule, over 2,000 states each (500 with ?quick=1): the rule-error card on
// both surfaces; routingError set; no referral ServiceRequest while the red-flag Flag and
// ServiceRequest are unchanged; no CDS index card; the note's A&P carries the engine error line
// and never copy.note.noDriver; the Observation carries the withheld-routing note.
import React from "react";
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { ALLOWED_DIFFERENCES, ad6Pairs } from "../harness/diff.js";
import { flatItems, ruleStream, sizes } from "../harness/matrix.js";
import { REFERRAL_DELTA } from "../harness/referral-delta.js";

const NOW = "2026-10-01T12:00:00.000Z";
const AD6 = ALLOWED_DIFFERENCES.find((d) => d.id === "AD6");
const AD18 = ALLOWED_DIFFERENCES.find((d) => d.id === "AD18");
const AD20 = ALLOWED_DIFFERENCES.find((d) => d.id === "AD20");
const INDEX_SRC = "CDS Hooks card · order-select";
const useMemo = (f) => f();
const hpc = (recs) => (recs || []).map((r) => ({ h: r.h, p: r.p, chips: r.chips }));
const INJECTED = "injected by the rules suite";

export default {
  name: "rules",
  owner: "WP13",
  run: guarded("rules", async (h) => {
    const { module, validation } = await loadMasque(h);
    const [rules, scoring, scribe, fhir, bind, policy] = await Promise.all(
      ["rules.js", "scoring.js", "scribe.js", "fhir.js", "bind.js", "policy.js"].map((f) => h.engine(f)));
    need(typeof rules.routingRecs === "function" && typeof scribe.rankSuggestions === "function", "waits on WP3/WP5: rules.js / scribe.js");
    const [scr, scb] = await Promise.all([h.oracle("MASQUE_Screener_v0_3.jsx"), h.oracle("MASQUE_Scribe_v0_3.jsx")]);
    const S = {};
    for (const name of ["screener.recs", "screener.gapFlags", "screener.cdsPreview", "screener.bandMeta", "screener.contextRows",
      "screener.phenotypePicker", "scribe.complaint", "scribe.activeDomains", "scribe.suggestions", "scribe.gapFlags"]) {
      S[name] = (await h.slice(name)).fn;
    }
    const c = collector(h);
    c.note(validationNote(validation));
    const pairs = ad6Pairs(scb.RED_FLAGS, scr.RED_FLAGS);
    const fixed = (fn) => h.withFixedClock(NOW, fn);
    const contextRows = S["screener.contextRows"]();
    const spec = {
      items: flatItems(scr.ITEMS, scr.DOMAIN_ORDER),
      contextOptions: Object.fromEntries(contextRows.map((r) => [r.id, r.opts.map(([v]) => v)])),
      flagIds: scr.RED_FLAGS.map((f) => f.id),
      phenotypeValues: S["screener.phenotypePicker"]().map((o) => o.k),
      infoIds: scb.VMPATHI_INFO.map((x) => x.id),
      samples: Object.entries(scr.SAMPLE_CASES).map(([k, s]) => ({ label: k, answers: s.a })),
    };

    // ------------------------------------------------------------------ the rule matrix
    const rng = h.rng(h.seed ^ 0x52554c45); // "RULE"
    let n = 0, ad6Pre = 0, ad6Seen = 0, cdsCards = 0, ad18Pre = 0, ad18Seen = 0, ad20Pre = 0, ad20Seen = 0;
    const declared = ((module.phenotypes && module.phenotypes.values) || []).map((v) => v.value);
    const t0 = performance.now();
    for (const st of ruleStream(rng, spec, sizes(h.quick).rules)) {
      const { answers, complaint, ctx, rf, safetyReviewed, skipped, vmp } = st;
      const input = { label: st.label, answers, complaint, ctx, rf, safetyReviewed, skipped, vmp };
      const sB = scb.computeScore(answers);
      const sN = scoring.computeScore(module, answers);
      const flagsScr = scr.RED_FLAGS.filter((f) => rf[f.id]);
      const flagsScb = scb.RED_FLAGS.filter((f) => rf[f.id]);
      const override = flagsScr.length > 0;
      const emergent = flagsScr.some((f) => f.tier === "emergent");

      // Screener routing.
      const recsB = S["screener.recs"](React, useMemo, scr.ITEMS, scr.DOMAIN_ORDER, sB.band, complaint, sB.domains, answers, sB.scorable,
        sB.answered, sB.floor, sB.ceiling, override, emergent, flagsScr);
      const stS = rules.buildRoutingState(module, { surface: "screener", answers, ctx, complaint, phenotypeError: null, score: sN, activeFlags: rf, safetyReviewed });
      const outS = rules.routingRecs(module, stS);
      c.diff(recsB, hpc(outS.recs), { at: "/routingRecs/screener", input, keyOrder: true });
      c.check(outS.error === null, "/routingRecs/screener/error", input, null, outS.error);

      // Scribe: complaint, activation, suggestions, routing.
      const complaintB = S["scribe.complaint"](React, useMemo, answers);
      const ph = rules.derivePhenotype(module, answers);
      c.diff({ value: complaintB, error: null }, ph, { at: "/derivePhenotype", input });
      const activeB = S["scribe.activeDomains"](complaintB, answers);
      const act = rules.activeDomains(module, { answers, complaint: ph.value, phenotypeError: ph.error });
      c.diff(activeB, act.domains, { at: "/activeDomains", input });
      const sugB = S["scribe.suggestions"](React, useMemo, scb.ALL_ITEMS, scb.ITEMS, scb.ASK, scb.VMPATHI_TAG, scb.VMPATHI_INFO,
        answers, complaintB, vmp, sB.scorable, skipped);
      const sugN = scribe.rankSuggestions(module, { answers, complaint: ph.value, phenotypeError: ph.error, vmp, scorable: sN.scorable, skipped });
      // AD18 (F12): the baseline filter tests `scorable ||`, the inverse of its own comment; the
      // slice with scorable inverted is the list the comment describes.
      const sugI = S["scribe.suggestions"](React, useMemo, scb.ALL_ITEMS, scb.ITEMS, scb.ASK, scb.VMPATHI_TAG, scb.VMPATHI_INFO,
        answers, complaintB, vmp, !sB.scorable, skipped);
      const rs = c.diff(sugB, sugN.list, { at: "/rankSuggestions", input, keyOrder: true, allow: ["AD18"], ctx: { AD18: { intended: sugI } } });
      if (AD18.detector({ baseline: sugB, intended: sugI })) { ad18Pre++; if (rs.observed.has("AD18")) ad18Seen++; }
      const routingCleared = !override && safetyReviewed;
      const recsSB = scb.buildRecs(sB.band, complaintB, sB.domains, sB.scorable && routingCleared, answers);
      const stB = rules.buildRoutingState(module, { surface: "scribe", answers, ctx, complaint: ph.value, phenotypeError: ph.error, score: sN, activeFlags: rf, safetyReviewed });
      const outB = rules.routingRecs(module, stB);
      c.diff(recsSB, hpc(outB.recs), { at: "/routingRecs/scribe", input, keyOrder: true });

      // Gap signals.
      const gS = S["screener.gapFlags"](ctx), gB = S["scribe.gapFlags"](ctx);
      const gN = rules.gapSignals(module, ctx);
      c.diff({ screener: gS, scribe: gB, alert: gS.length >= 2 },
        { screener: gN.hits.map((x) => x.screenerLabel), scribe: gN.hits.map((x) => x.scribeLabel), alert: gN.alert }, { at: "/gapSignals", input });

      // CDS preview (rendered textContent).
      const bandMeta = S["screener.bandMeta"](sB.band);
      const el = S["screener.cdsPreview"](React, override, emergent, flagsScr, sB.scorable, sB.band, complaint, sB.total, bandMeta);
      const mounted = h.mount(el);
      const textB = mounted.container.textContent;
      mounted.unmount();
      const pv = rules.cdsPreview(module, stS, { routingError: outS.error });
      const card = pv.safety || pv.index;
      if (card) cdsCards++;
      const rc = c.diff(textB, card ? `${card.src}${card.title}${card.body}` : "", { at: "/cdsPreview", input, allow: ["AD20"],
        ctx: { AD20: { complaint, declared, indexSrc: INDEX_SRC } } });
      if (AD20.detector({ complaint, declared, baselineIssued: textB.startsWith(INDEX_SRC) })) { ad20Pre++; if (rc.observed.has("AD20")) ad20Seen++; }

      // The note, end to end (AD6).
      const vmpNote = vmp;
      const gapAlert = gB.length >= 2;
      const nB = scb.buildNote({ patient: scb.PATIENT, answers, ctx, vmp: vmpNote, total: sB.total, floor: sB.floor, ceiling: sB.ceiling,
        coverage: sB.coverage, scorable: sB.scorable, band: sB.band, complaint: complaintB, domains: sB.domains, recs: recsSB, gapAlert,
        activeFlags: flagsScb, safetyReviewed, emergent, probeNotes: [] });
      const nN = scribe.buildNote(module, { patient: module.demo.patient, answers, ctx, vmp: vmpNote, score: sN, complaint: ph.value,
        recs: outB.recs, routingError: outB.error, gapAlert: gN.alert, activeFlags: rules.activeFlagsOf(module, rf), safetyReviewed, emergent, probeNotes: [] });
      const rn = c.diff(nB.split("\n"), String(nN).split("\n"), { at: "/buildNote", input, allow: ["AD6"], ctx: { AD6: pairs } });
      if (AD6.detector({ strings: flagsScb.flatMap((f) => [f.text, f.points, f.action]), pairs })) { ad6Pre++; if (rn.observed.has("AD6")) ad6Seen++; }
      n++;
      if (n % 1000 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    h.expect("AD6", { precondition: ad6Pre > 0, observed: ad6Seen === ad6Pre });
    h.expect("AD18", { precondition: ad18Pre > 0, observed: ad18Seen === ad18Pre });
    h.expect("AD20", { precondition: ad20Pre > 0, observed: ad20Seen === ad20Pre });
    c.note(`rule states: ${n} (seed 0x${h.seed.toString(16)}), ${cdsCards} with a CDS card; AD6 on the note ${ad6Seen}/${ad6Pre}; AD18 on suggestions ${ad18Seen}/${ad18Pre}; AD20 on the CDS preview ${ad20Seen}/${ad20Pre}; ${Math.round(performance.now() - t0)} ms`);

    // ------------------------------------------------------------------ captureLabel vs capLabel
    let capN = 0, capPre = 0, capSeen = 0;
    for (const it of spec.items) {
      const values = it.scale ? it.scale.map((_, i) => i) : ["yes", "no"];
      for (const value of values) {
        c.diff(scb.capLabel({ id: it.id, value }), scribe.captureLabel(module, { id: it.id, value, kind: "item" }), { at: `/captureLabel/${it.id}/${value}`, input: { id: it.id, value } });
        c.diff(scb.capLabel({ id: it.id, value }), scribe.captureLabel(module, { id: it.id, value }), { at: `/captureLabel/${it.id}/${value}/@nokind`, input: { id: it.id, value } });
        capN += 2;
      }
    }
    for (const r of contextRows) for (const [value] of r.opts) {
      c.diff(scb.capLabel({ id: r.id, value }), scribe.captureLabel(module, { id: r.id, value, kind: "ctx" }), { at: `/captureLabel/${r.id}/${value}`, input: { id: r.id, value } });
      capN++;
    }
    for (const f of scb.RED_FLAGS) {
      const rc = c.diff(scb.capLabel({ id: f.id, value: true }), scribe.captureLabel(module, { id: f.id, value: true, kind: "redflag" }),
        { at: `/captureLabel/${f.id}`, input: { id: f.id }, allow: ["AD6"], ctx: { AD6: pairs } });
      if (AD6.detector({ strings: [f.points], pairs })) { capPre++; if (rc.observed.has("AD6")) capSeen++; }
      capN++;
    }
    h.expect("AD6", { precondition: capPre > 0, observed: capSeen === capPre });
    c.note(`captureLabel: ${capN} captures; AD6 on red-flag captures ${capSeen}/${capPre}`);

    // ------------------------------------------------------------------ referralFor vs the baseline bundles
    // Release 0.4.5: the destinations of the dizziness cases (the otologic phenotype and both) are the
    // clinical lead's "Neurology"; AD17 excuses exactly those two changes and is expected wherever the
    // baseline refers a phenotype of the referral delta's destinations (otologic and both, on both
    // baseline bundles).
    const fullHigh = scr.SAMPLE_CASES.otologic.a;
    const sHigh = scb.computeScore(fullHigh);
    const AD17 = ALLOWED_DIFFERENCES.find((d) => d.id === "AD17");
    let ad17Pre = 0, ad17Seen = 0, refPre = 0, refSeen = 0;
    for (const complaint of ["", ...spec.phenotypeValues]) {
      const ref = rules.referralFor(module, complaint);
      const want = (bundle) => (bundle.entry.map((e) => e.resource).find((r) => r.resourceType === "ServiceRequest" && r.priority === "routine") || {}).code;
      const bScr = fixed(() => scr.buildBundle({ patient: scr.DEMO_PATIENT, answers: fullHigh, total: sHigh.total, floor: sHigh.floor, ceiling: sHigh.ceiling,
        coverage: sHigh.coverage, scorable: sHigh.scorable, band: sHigh.band, domains: sHigh.domains, complaint, ctx: {}, recs: [], activeFlags: [], emergent: false }));
      const bScb = fixed(() => scb.buildBundle({ patient: scb.PATIENT, answers: fullHigh, total: sHigh.total, floor: sHigh.floor, ceiling: sHigh.ceiling,
        coverage: sHigh.coverage, scorable: sHigh.scorable, band: sHigh.band, domains: sHigh.domains, complaint, note: "", activeFlags: [], emergent: false, routingCleared: true }));
      const got = ref ? { text: `Referral: ${ref.specialty} — evaluate for ${ref.reason}` } : undefined;
      const adRef = { AD17: { delta: REFERRAL_DELTA, complaint }, AD20: { complaint, declared, indexSrc: INDEX_SRC } };
      for (const [surface, b] of [["screener", bScr], ["scribe", bScb]]) {
        const r = c.diff(want(b), got, { at: `/referralFor/${complaint || "(none)"}/${surface}/code`, input: { complaint }, allow: ["AD17", "AD20"], ctx: adRef });
        if (AD17.detector({ p: adRef.AD17, baseline: (want(b) || {}).text })) { ad17Pre++; if (r.observed.has("AD17")) ad17Seen++; }
        if (AD20.detector({ complaint, declared, baselineIssued: !!want(b) })) { refPre++; if (r.observed.has("AD20")) refSeen++; }
      }
      c.check(rules.referralFor(module, complaint, { routingError: { family: "routing", ruleId: "x", message: "y" } }) === null,
        `/referralFor/${complaint || "(none)"}/@routingError`, { complaint }, null, "a referral");
    }
    c.check(ad17Pre === 4, "/referralFor/@AD17", null, "AD17's precondition on both baseline bundles of otologic and of both", ad17Pre);
    h.expect("AD17", { precondition: ad17Pre > 0, observed: ad17Seen === ad17Pre });
    h.expect("AD20", { precondition: refPre > 0, observed: refSeen === refPre });

    // Inherited properties never resolve a lookup (the byPhenotype tables are plain objects): a
    // declared value named like an Object.prototype member falls back to the default.
    {
      const ph = { values: [{ value: "toString" }, { value: "constructor" }, { value: "x" }],
        referral: { byPhenotype: { x: { specialty: "X", reason: "x" } }, default: { specialty: "D", reason: "d" } },
        cdsTerm: { byPhenotype: { x: "xterm" }, default: "dterm" } };
      const fake = { ...module, phenotypes: { ...module.phenotypes, ...ph } };
      for (const v of ["toString", "constructor"]) {
        c.diff({ specialty: "D", reason: "d" }, rules.referralFor(fake, v), { at: `/referralFor/@inherited/${v}`, input: { complaint: v } });
      }
      c.check(rules.referralFor(fake, "__proto__") === null, "/referralFor/@inherited/__proto__", { complaint: "__proto__" }, null, rules.referralFor(fake, "__proto__"));
      c.check(rules.referralFor(fake, "hasOwnProperty") === null, "/referralFor/@undeclared", { complaint: "hasOwnProperty" }, null, rules.referralFor(fake, "hasOwnProperty"));
      const st = rules.buildRoutingState(fake, { surface: "screener", answers: fullHigh, ctx: {}, complaint: "toString",
        score: scoring.computeScore(fake, fullHigh), activeFlags: {}, safetyReviewed: true });
      const pv = rules.cdsPreview(fake, st);
      c.check(!!pv.index && pv.index.title.includes("dterm"), "/cdsPreview/@inherited", { complaint: "toString" }, "an index card with the default term", pv.index && pv.index.title);
    }

    // ------------------------------------------------------------------ referralFor: the dizziness rule (release 0.4.5)
    // The clinical lead's rule as decided on 2026-10-07 to 2026-10-09: the otologic phenotype and both
    // go to Neurology (each with its own reason), the sinonasal phenotype and the default keep
    // Headache medicine / Neurology, and nothing escalates: no probe answer (pr_internal_vertigo's
    // included, whichever option) changes a destination, on either surface, in any state in which
    // a referral is issued; a routing error issues none.
    {
      const ref = module.phenotypes.referral;
      const line = (r) => (r ? `${r.specialty} — ${r.reason}` : null);
      const NEURO_VM = "Neurology — vestibular migraine";
      const NEURO_MID = "Neurology — mid-facial / migrainous cause";
      const HM_MID = "Headache medicine / Neurology — mid-facial / migrainous cause";
      c.diff({ otologic: { specialty: "Neurology", reason: "vestibular migraine" }, both: { specialty: "Neurology", reason: "mid-facial / migrainous cause" } },
        ref.byPhenotype, { at: "/dizziness/byPhenotype" });
      c.diff({ specialty: "Headache medicine / Neurology", reason: "mid-facial / migrainous cause" }, ref.default, { at: "/dizziness/default" });
      // No escalation: the referral table holds no evidence or destination of its own, and the
      // engine has no escalation helper.
      c.diff(["byPhenotype", "default", "clinicianRules"], Object.keys(ref), { at: "/dizziness/no-escalation/table" });
      c.check(["referralEscalations", "escalationEvidence", "referralEscalation"].every((k) => rules[k] === undefined), "/dizziness/no-escalation/engine", null,
        "rules.js exports no escalation helper", ["referralEscalations", "escalationEvidence", "referralEscalation"].filter((k) => rules[k] !== undefined));
      const probe = module.logic.probes.list.find((p) => p.id === "pr_internal_vertigo");
      c.diff(["Yes — rocking or bobbing", "Yes, but only seconds at a time", "No sensation of self-motion"], probe ? probe.opts.map((o) => o.l) : null, { at: "/dizziness/probe-options" });
      const PROBE_SETS = [
        ["none", undefined], ["empty", {}], ["option-0", { pr_internal_vertigo: 0 }], ["option-1", { pr_internal_vertigo: 1 }], ["option-2", { pr_internal_vertigo: 2 }],
        ["out-of-range", { pr_internal_vertigo: 3 }], ["not-an-index", { pr_internal_vertigo: "0" }], ["other-probes", { pr_visual_vertigo: 0, pr_positional: 0 }],
      ];
      // Release 0.4.7 (decision F11, AD20): no complaint and an undeclared phenotype issue no
      // referral at all (0.4.5 expected the table's default here); the destination rule is unchanged.
      const WANT = { otologic: NEURO_VM, both: NEURO_MID, sinonasal: HM_MID, "": null, "not-a-phenotype": null };
      for (const [complaint, want] of Object.entries(WANT)) {
        for (const [name, probeAns] of PROBE_SETS) {
          const got = rules.referralFor(module, complaint, probeAns === undefined ? {} : { probeAns });
          c.check(line(got) === want, `/dizziness/referralFor/${complaint || "(none)"}/${name}`, { complaint, probeAns }, want, line(got));
          c.check(rules.referralFor(module, complaint, { routingError: { family: "routing", ruleId: "x", message: "y" }, probeAns: probeAns || {} }) === null,
            `/dizziness/referralFor/${complaint || "(none)"}/${name}/@routingError`, { complaint, probeAns }, null, "a referral");
        }
      }
      // The bundle in every state that issues a referral: each settled, non-lowest sample screen, on
      // both surfaces (the Scribe with routing cleared), whatever probe answers the caller passes;
      // and the states that withhold it (a red flag, routing not cleared on the Scribe, a routing
      // error) issue no referral ServiceRequest for a dizziness case either.
      const sr = (b) => b.entry.map((e) => e.resource).find((r) => r.resourceType === "ServiceRequest" && r.priority === "routine");
      const routed = Object.entries(scr.SAMPLE_CASES).map(([id, cs]) => [id, cs.a, scoring.computeScore(module, cs.a)]).filter(([, , s]) => s.scorable && s.band !== "low");
      c.check(routed.length >= 2 && new Set(routed.map(([, , s]) => s.band)).size >= 1, "/dizziness/bundle/@setup", null, "at least two settled, non-lowest sample screens", routed.map(([id, , s]) => `${id}:${s.band}`));
      let issued = 0;
      for (const [id, answers, sN] of routed) {
        for (const surface of ["screener", "scribe"]) {
          for (const [complaint, want] of [["otologic", NEURO_VM], ["both", NEURO_MID]]) {
            for (const [name, probeAns] of PROBE_SETS) {
              const screen = { patient: module.demo.patient, answers, score: sN, complaint, activeFlags: [], routingCleared: true, routingError: null, ...(probeAns === undefined ? {} : { probeAns }) };
              const r = sr(fhir.buildBundle(module, screen, { surface, now: NOW }));
              const text = r ? r.code.text : null;
              const wantText = `Referral: ${want.replace(" — ", " — evaluate for ")}`;
              c.check(text === wantText, `/dizziness/bundle/${surface}/${id}/${complaint}/${name}`, { surface, id, complaint, probeAns }, wantText, text);
              if (text === wantText) issued++;
            }
          }
        }
      }
      c.check(issued > 0, "/dizziness/bundle/@issued", null, "referrals issued", issued);
      const [id0, a0, s0] = routed[0] || [];
      if (a0) {
        const flag = module.redFlags[0];
        for (const complaint of ["otologic", "both"]) {
          const base = { patient: module.demo.patient, answers: a0, score: s0, complaint, routingError: null, probeAns: { pr_internal_vertigo: 0 } };
          const withheld = [
            ["screener/red-flag", "screener", { ...base, activeFlags: [flag], routingCleared: true }],
            ["scribe/red-flag", "scribe", { ...base, activeFlags: [flag], routingCleared: true }],
            ["scribe/not-cleared", "scribe", { ...base, activeFlags: [], routingCleared: false }],
            ["screener/routing-error", "screener", { ...base, activeFlags: [], routingCleared: true, routingError: { family: "routing", ruleId: "x", message: "y" } }],
            ["scribe/routing-error", "scribe", { ...base, activeFlags: [], routingCleared: true, routingError: { family: "routing", ruleId: "x", message: "y" } }],
          ];
          for (const [name, surface, screen] of withheld) {
            const r = sr(fhir.buildBundle(module, screen, { surface, now: NOW }));
            c.check(!r, `/dizziness/bundle/withheld/${name}/${complaint}`, { id: id0, complaint }, "no referral ServiceRequest", r && r.code.text);
          }
        }
      }
    }

    // ------------------------------------------------------------------ AD17 self-checks (release 0.4.5)
    // AD17 excuses exactly two changes, each for its own phenotype and with its own reason: otologic
    // "Neuro-otology" → "Neurology" (vestibular migraine) and both "Headache medicine / Neurology" →
    // "Neurology" (mid-facial / migrainous cause). Every other phenotype, specialty, reason,
    // direction, place, and a malformed or missing delta stays a difference.
    {
      const NO_VM = "Referral: Neuro-otology — evaluate for vestibular migraine";
      const NE_VM = "Referral: Neurology — evaluate for vestibular migraine";
      const HM_MID = "Referral: Headache medicine / Neurology — evaluate for mid-facial / migrainous cause";
      const NE_MID = "Referral: Neurology — evaluate for mid-facial / migrainous cause";
      const P = (complaint, delta = REFERRAL_DELTA) => ({ AD17: { delta, complaint } });
      const at = "/bundle/entry/3/resource/code/text";
      const run = (a, b, ctx, path = at) => h.diff(a, b, { at: path, allow: ["AD17"], ctx });
      c.diff([
        { phenotype: "otologic", reason: "vestibular migraine", from: "Neuro-otology", to: "Neurology" },
        { phenotype: "both", reason: "mid-facial / migrainous cause", from: "Headache medicine / Neurology", to: "Neurology" },
      ], REFERRAL_DELTA.destinations, { at: "/AD17/destinations" });
      for (const [name, a, b, ctx] of [["otologic", NO_VM, NE_VM, P("otologic")], ["both", HM_MID, NE_MID, P("both")],
        ["otologic/probe-answers-ignored", NO_VM, NE_VM, { AD17: { delta: REFERRAL_DELTA, complaint: "otologic", probeAns: { pr_internal_vertigo: 0 } } }]]) {
        const r = run(a, b, ctx);
        c.check(!r.diffs.length && r.observed.has("AD17"), `/AD17/excuses/${name}`, { a, b }, "excused", r.diffs);
      }
      const D = REFERRAL_DELTA;
      const refused = [
        ["otologic/other-from", HM_MID.replace("mid-facial / migrainous cause", "vestibular migraine"), NE_VM, P("otologic")],
        ["otologic/other-to", NO_VM, "Referral: Headache medicine / Neurology — evaluate for vestibular migraine", P("otologic")],
        ["otologic/other-reason", "Referral: Neuro-otology — evaluate for mid-facial / migrainous cause", NE_MID, P("otologic")],
        ["otologic/reason-changed", NO_VM, NE_MID, P("otologic")],
        ["otologic/both-change", HM_MID, NE_MID, P("otologic")],
        ["both/otologic-change", NO_VM, NE_VM, P("both")],
        ["both/other-from", "Referral: Neuro-otology — evaluate for mid-facial / migrainous cause", NE_MID, P("both")],
        ["both/other-to", HM_MID, "Referral: Neuro-otology — evaluate for mid-facial / migrainous cause", P("both")],
        ["both/other-reason", "Referral: Headache medicine / Neurology — evaluate for vestibular migraine", NE_VM, P("both")],
        ["reversed/otologic", NE_VM, NO_VM, P("otologic")],
        ["reversed/both", NE_MID, HM_MID, P("both")],
        ["sinonasal", HM_MID, NE_MID, P("sinonasal")],
        ["sinonasal/otologic-change", NO_VM, NE_VM, P("sinonasal")],
        ["default", HM_MID, NE_MID, P("")],
        ["unknown-phenotype", HM_MID, NE_MID, P("not-a-phenotype")],
        ["not-a-referral", "Neuro-otology", "Neurology", P("otologic")],
        ["malformed/not-a-list", NO_VM, NE_VM, P("otologic", { ...D, destinations: { otologic: D.destinations[0] } })],
        ["malformed/row", NO_VM, NE_VM, P("otologic", { ...D, destinations: [...D.destinations, { phenotype: "sinonasal" }] })],
        ["malformed/same", NO_VM, NE_VM, P("otologic", { ...D, destinations: [...D.destinations, { phenotype: "sinonasal", reason: "x", from: "y", to: "y" }] })],
        ["malformed/duplicate", NO_VM, NE_VM, P("otologic", { ...D, destinations: [...D.destinations, D.destinations[0]] })],
        ["malformed/empty", NO_VM, NE_VM, P("otologic", { ...D, destinations: [] })],
        ["no-destinations", NO_VM, NE_VM, P("otologic", { ...D, destinations: undefined })],
        ["no-delta", NO_VM, NE_VM, { AD17: { complaint: "otologic" } }],
        ["no-ctx", NO_VM, NE_VM, {}],
      ];
      for (const [name, a, b, ctx] of refused) {
        const r = run(a, b, ctx);
        c.check(r.diffs.length === 1 && !r.observed.has("AD17"), `/AD17/refuses/${name}`, { a, b }, "a difference, not excused", r.diffs.length ? "observed" : "excused");
      }
      for (const [name, a, b, ph] of [["otologic", NO_VM, NE_VM, "otologic"], ["both", HM_MID, NE_MID, "both"]]) {
        const wrongPlace = run(a, b, P(ph), "/bundle/entry/3/resource/reasonCode/0/text");
        c.check(wrongPlace.diffs.length === 1, `/AD17/refuses/other-path/${name}`, null, "only at …/code/text", "excused");
      }
      // Exhaustive over phenotypes × specialties × reasons: excused exactly for the two rows.
      const SPECIALTIES = ["Neuro-otology", "Neurology", "Headache medicine / Neurology", "Otolaryngology"];
      const REASONS = ["vestibular migraine", "mid-facial / migrainous cause"];
      let sweep = 0, wrong = [];
      for (const ph of ["", ...spec.phenotypeValues, "not-a-phenotype"]) {
        for (const sa of SPECIALTIES) for (const sb of SPECIALTIES) for (const ra of REASONS) for (const rb of REASONS) {
          const a = `Referral: ${sa} — evaluate for ${ra}`, b = `Referral: ${sb} — evaluate for ${rb}`;
          if (a === b) continue;
          const r = run(a, b, P(ph));
          const want = D.destinations.some((d) => d.phenotype === ph && d.from === sa && d.to === sb && d.reason === ra && d.reason === rb);
          const excused = !r.diffs.length;
          if (excused !== want) wrong.push({ ph, a, b, excused });
          sweep++;
        }
      }
      c.check(wrong.length === 0 && sweep > 0, "/AD17/sweep", { sweep }, "excused exactly for otologic Neuro-otology → Neurology and both Headache medicine / Neurology → Neurology, same reason", wrong.slice(0, 5));
      c.check(AD17.detector({ p: P("otologic").AD17, baseline: NO_VM }) && AD17.detector({ p: P("both").AD17, baseline: HM_MID })
        && !AD17.detector({ p: P("sinonasal").AD17, baseline: HM_MID }) && !AD17.detector({ p: P("").AD17, baseline: HM_MID })
        && !AD17.detector({ p: P("otologic").AD17, baseline: NE_VM }) && !AD17.detector({ p: P("both").AD17, baseline: NO_VM })
        && !AD17.detector({ p: P("otologic").AD17, baseline: HM_MID }), "/AD17/detector", null,
        "the precondition only for the otologic and both baseline destinations (each with its own reason)", null);
    }

    // ------------------------------------------------------------------ fail-closed
    const throwing = () => { throw new Error(INJECTED); };
    const L = module.logic;
    const variants = [
      { name: "routing", ruleId: "harness_throwing_route", logic: { ...L, routing: [
        { id: "harness_throwing_route", when: throwing, copy: { screener: { h: "x", p: "x", chips: [] }, scribe: { h: "x", p: "x", chips: [] } } },
        ...(L.routing || [])] } },
      { name: "phenotype", ruleId: null, logic: { ...L, phenotypes: { ...(L.phenotypes || {}), derive: [{ id: "harness_throwing_derive", value: spec.phenotypeValues[0], when: throwing }, ...((L.phenotypes || {}).derive || [])] } } },
    ];
    const failN = h.quick ? 500 : 2000;
    const noDriver = module.copy && module.copy.note && module.copy.note.noDriver;
    for (const v of variants) {
      let bad;
      try {
        bad = await bind.bindModule(module.rubric, v.logic, { origin: "builtin", classification: "builtin", key: `fixture:throwing-${v.name}`,
          sources: { rubricText: module.sources && module.sources.rubricText, logicText: null }, loadedAt: NOW });
      } catch (err) {
        c.check(false, `/failClosed/${v.name}/bind`, null, "bound", String(err.message));
        continue;
      }
      const frng = h.rng(h.seed ^ (v.name === "routing" ? 0x46524f55 : 0x46504845));
      let gated = 0;
      for (const st of ruleStream(frng, spec, failN)) {
        const { answers, complaint, ctx, rf, safetyReviewed } = st;
        const input = { variant: v.name, label: st.label, answers, complaint, rf, safetyReviewed };
        const sN = scoring.computeScore(bad, answers);
        const override = Object.keys(rf).length > 0;
        const ph = v.name === "phenotype" ? rules.derivePhenotype(bad, answers) : { value: complaint, error: null };
        if (v.name === "phenotype") {
          c.check(!!ph.error && ph.value === "", `/failClosed/phenotype/derivePhenotype`, input, { value: "", error: "set" }, ph);
          const act = rules.activeDomains(bad, { answers, complaint: ph.value, phenotypeError: ph.error });
          c.diff([...module.domainOrder].sort(), [...act.domains].sort(), { at: "/failClosed/phenotype/activeDomains", input });
        }
        for (const surface of ["screener", "scribe"]) {
          const at = `/failClosed/${v.name}/${surface}`;
          const state = rules.buildRoutingState(bad, { surface, answers, ctx, complaint: ph.value, phenotypeError: ph.error, score: sN, activeFlags: rf, safetyReviewed });
          const out = rules.routingRecs(bad, state);
          const gatesPass = !override && sN.scorable && (surface === "screener" || safetyReviewed);
          const expectError = v.name === "phenotype" || gatesPass;
          if (gatesPass) {
            gated++;
            c.check(out.gate === "error", `${at}/gate`, input, "error", out.gate);
            c.check(out.recs.length === 1 && out.recs[0].h === "Module rule error — no routing issued" &&
              out.recs[0].p.includes(`in module ${bad.id} failed (${INJECTED})`), `${at}/recs`, input, "the rule-error card", hpc(out.recs));
          }
          if (expectError) {
            c.check(!!out.error && (v.ruleId === null || out.error.ruleId === v.ruleId) && out.error.message === INJECTED, `${at}/routingError`, input, "set", out.error);
          } else {
            c.check(out.error === null, `${at}/routingError`, input, null, out.error);
          }
          const routingError = out.error;
          // The bundle: no referral; the red-flag resources equal the unmodified module's.
          const screen = { patient: bad.demo.patient, answers, score: sN, complaint: ph.value, activeFlags: rules.activeFlagsOf(bad, rf),
            emergent: rules.activeFlagsOf(bad, rf).some((f) => f.tier === "emergent"), routingCleared: !override && safetyReviewed, routingError };
          const bundle = fhir.buildBundle(bad, screen, { surface, now: NOW });
          const ok = fhir.buildBundle(module, { ...screen, routingError: null, complaint: ph.value }, { surface, now: NOW });
          const res = (b) => b.entry.map((e) => e.resource);
          if (routingError) {
            c.check(!res(bundle).some((r) => r.resourceType === "ServiceRequest" && r.priority === "routine"), `${at}/bundle/referral`, input, "no referral ServiceRequest", "present");
            const obs = res(bundle).find((r) => r.resourceType === "Observation");
            c.check((obs.note || []).some((x) => x.text === `Screening routing withheld: module rule "${routingError.ruleId}" failed, so no referral was issued.`),
              `${at}/bundle/Observation/note`, input, "the withheld-routing note", obs.note);
            const pv = rules.cdsPreview(bad, state, { routingError });
            c.check(pv.index === null, `${at}/cdsPreview/index`, input, null, pv.index);
          }
          const redFlagRes = (b) => res(b).filter((r) => r.resourceType === "Flag" || (r.resourceType === "ServiceRequest" && r.priority !== "routine"));
          c.diff(redFlagRes(ok), redFlagRes(bundle), { at: `${at}/bundle/redFlags`, input, keyOrder: true });
          if (surface === "scribe") {
            const note = scribe.buildNote(bad, { patient: bad.demo.patient, answers, ctx, vmp: {}, score: sN, complaint: ph.value, recs: out.recs,
              routingError, gapAlert: false, activeFlags: rules.activeFlagsOf(bad, rf), safetyReviewed, probeNotes: [] });
            const ap = note.slice(note.indexOf("ASSESSMENT & PLAN"));
            if (routingError && gatesPass) {
              c.check(ap.includes(`  • Module rule error — no routing issued: rule "${routingError.ruleId}" in module ${bad.id} failed (${routingError.message}).`),
                `${at}/note/A&P`, input, "the engine error line", ap.split("\n").slice(0, 3));
            }
            if (routingError) c.check(!noDriver || !ap.includes(noDriver), `${at}/note/noDriver`, input, "never copy.note.noDriver", "present");
          }
        }
      }
      c.check(gated > 0, `/failClosed/${v.name}/@coverage`, null, "states that reach the module rules", gated);
      c.note(`fail-closed (${v.name}): ${failN} states × 2 surfaces; ${gated} reached the module rules`);
    }
    void policy;
    return c.result();
  }),
};
