// tests/suites/rules.js — routing, phenotype, activation, suggestions, gap, referral, CDS preview,
// capture labels and the note, plus the fail-closed cases (design 03 §8.3 `rules`, §3.3, §8.5).
// Owner: WP13; accepts WP3 (rules) and WP5 (suggestions, labels, note), with WP2's logic.
//
// Over 20,000 rule states (2,000 with ?quick=1; §8.5), each compared with the frozen baseline:
//   Screener routingRecs(screener state)     vs the `recs` slice (Scr L891-952): h, p, chips
//   Scribe   routingRecs(scribe state)       vs buildRecs(band, complaint, domains, scorable && routingCleared, answers)
//   derivePhenotype                          vs the `complaint` slice (Scb L846-850)
//   activeDomains                            vs the active-domain slice (Scb L857-859)
//   rankSuggestions (with skipped, vmp)      vs the `suggestions` slice (Scb L856-879), AD13 only
//                                            (the slice run with scorable inverted is the intended list)
//   gapSignals labels / alert                vs both `gapFlags` slices (Scr L873-878, Scb L916-920)
//   cdsPreview                               vs the CDS preview slice (Scr L1329-1349), by rendered textContent,
//                                            AD15 only (no index card for an undeclared complaint)
//   buildNote(routingRecs …)                 vs buildNote(buildRecs …), AD6 only
// Exhaustively: captureLabel vs capLabel for every item value, context item and flag (AD6 on
// red-flag captures); referralFor vs the referral text of the baseline Screener and Scribe
// bundles for every complaint (AD15 for ""); referralFor/cdsPreview never read an inherited
// property of the byPhenotype tables.
// Fail-closed (D6, §3.3): a copy of the MASQUE logic with a throwing routing rule, and one with
// a throwing derive rule, over 2,000 states each (500 with ?quick=1): the rule-error card on
// both surfaces; routingError set; no referral ServiceRequest while the red-flag Flag and
// ServiceRequest are unchanged; no CDS index card; the note's A&P carries the engine error line
// and never copy.note.noDriver; the Observation carries the withheld-routing note.
import React from "react";
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { ALLOWED_DIFFERENCES, ad6Pairs } from "../harness/diff.js";
import { flatItems, ruleStream, sizes } from "../harness/matrix.js";

const NOW = "2026-10-01T12:00:00.000Z";
const AD6 = ALLOWED_DIFFERENCES.find((d) => d.id === "AD6");
const AD13 = ALLOWED_DIFFERENCES.find((d) => d.id === "AD13");
const AD15 = ALLOWED_DIFFERENCES.find((d) => d.id === "AD15");
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
    let n = 0, ad6Pre = 0, ad6Seen = 0, cdsCards = 0, ad13Pre = 0, ad13Seen = 0, ad15Pre = 0, ad15Seen = 0;
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
      // AD13 (F12): the baseline filter tests `scorable ||`, the inverse of its own comment; the
      // slice with scorable inverted is the list the comment describes.
      const sugI = S["scribe.suggestions"](React, useMemo, scb.ALL_ITEMS, scb.ITEMS, scb.ASK, scb.VMPATHI_TAG, scb.VMPATHI_INFO,
        answers, complaintB, vmp, !sB.scorable, skipped);
      const rs = c.diff(sugB, sugN.list, { at: "/rankSuggestions", input, keyOrder: true, allow: ["AD13"], ctx: { AD13: { intended: sugI } } });
      if (AD13.detector({ baseline: sugB, intended: sugI })) { ad13Pre++; if (rs.observed.has("AD13")) ad13Seen++; }
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
      const rc = c.diff(textB, card ? `${card.src}${card.title}${card.body}` : "", { at: "/cdsPreview", input, allow: ["AD15"],
        ctx: { AD15: { complaint, declared, indexSrc: INDEX_SRC } } });
      if (AD15.detector({ complaint, declared, baselineIssued: textB.startsWith(INDEX_SRC) })) { ad15Pre++; if (rc.observed.has("AD15")) ad15Seen++; }

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
    h.expect("AD13", { precondition: ad13Pre > 0, observed: ad13Seen === ad13Pre });
    h.expect("AD15", { precondition: ad15Pre > 0, observed: ad15Seen === ad15Pre });
    c.note(`rule states: ${n} (seed 0x${h.seed.toString(16)}), ${cdsCards} with a CDS card; AD6 on the note ${ad6Seen}/${ad6Pre}; AD13 on suggestions ${ad13Seen}/${ad13Pre}; AD15 on the CDS preview ${ad15Seen}/${ad15Pre}; ${Math.round(performance.now() - t0)} ms`);

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
    const fullHigh = scr.SAMPLE_CASES.otologic.a;
    const sHigh = scb.computeScore(fullHigh);
    let refPre = 0, refSeen = 0;
    for (const complaint of ["", ...spec.phenotypeValues]) {
      const ref = rules.referralFor(module, complaint);
      const want = (bundle) => (bundle.entry.map((e) => e.resource).find((r) => r.resourceType === "ServiceRequest" && r.priority === "routine") || {}).code;
      const bScr = fixed(() => scr.buildBundle({ patient: scr.DEMO_PATIENT, answers: fullHigh, total: sHigh.total, floor: sHigh.floor, ceiling: sHigh.ceiling,
        coverage: sHigh.coverage, scorable: sHigh.scorable, band: sHigh.band, domains: sHigh.domains, complaint, ctx: {}, recs: [], activeFlags: [], emergent: false }));
      const bScb = fixed(() => scb.buildBundle({ patient: scb.PATIENT, answers: fullHigh, total: sHigh.total, floor: sHigh.floor, ceiling: sHigh.ceiling,
        coverage: sHigh.coverage, scorable: sHigh.scorable, band: sHigh.band, domains: sHigh.domains, complaint, note: "", activeFlags: [], emergent: false, routingCleared: true }));
      const got = ref ? { text: `Referral: ${ref.specialty} — evaluate for ${ref.reason}` } : undefined;
      const ad15 = { AD15: { complaint, declared, indexSrc: INDEX_SRC } };
      for (const [surface, b] of [["screener", bScr], ["scribe", bScb]]) {
        const rr = c.diff(want(b), got, { at: `/referralFor/${complaint || "(none)"}/${surface}`, input: { complaint }, allow: ["AD15"], ctx: ad15 });
        if (AD15.detector({ complaint, declared, baselineIssued: !!want(b) })) { refPre++; if (rr.observed.has("AD15")) refSeen++; }
      }
      c.check(rules.referralFor(module, complaint, { routingError: { family: "routing", ruleId: "x", message: "y" } }) === null,
        `/referralFor/${complaint || "(none)"}/@routingError`, { complaint }, null, "a referral");
    }
    h.expect("AD15", { precondition: refPre > 0, observed: refSeen === refPre });

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
