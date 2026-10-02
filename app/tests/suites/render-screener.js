// tests/suites/render-screener.js — the generic Clinician Screener against the frozen baseline
// Screener, rendered (design 03 §8.3 `render`, §5.3, §8.4, §9.8). Owner: WP7.
//
// Both components are mounted into detached containers (h.mount, outside StrictMode) and driven
// through their own buttons with flushSync, under a fixed clock. Compared, region by region:
//   samples   for each of the nine sample cases (the four baseline samples and the five sim-*
//             scenarios): load it through the rail, then compare the banner (button labels under
//             AD11, the rest exactly), the brand row (AD4), the rail, the result card (text
//             exactly, DOM tag/class sequence exactly, meter zones under AD7, needle and range
//             band positions exactly), the nav, the toast and the footer; the FHIR bundle shown
//             by "View FHIR bundle" (AD1); "Append this screen"; then Back through every step,
//             comparing each step card the same way. The baseline has no button for a scenario,
//             so its first sample slot is pointed at the scenario in a private copy of the
//             baseline module (a separate compile, patched at run time; the file is untouched),
//             and its own loadSample renders it.
//   replay    fresh mounts driven answer by answer through the step cards (a full case with
//             context answers, a red-flag case, and an empty walk), every card compared.
//   layout    the panel the baseline mounts under the screen is replaced by the Research link
//             card in the same place (AD8); the tab note leads the panel (AD12 chrome).
// Beyond parity (§9.8 done-when): capture appends a row with module_id through onCapture; the
// spec and cohort downloads are named per fhir.filePrefix and byte-equal to the engine
// builders; nine rail buttons in two groups; the snapshot carries safetyReviewed,
// routingCleared, answers and ctx; the shape fixture renders (no picker, no context, the
// engine fallback card, the uploaded-module badge); a throwing routing rule withholds the
// referral and the CDS index card and is reported once through onModuleError; no probability
// is shown and the research panel is not mounted.
import React from "react";
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need } from "../harness/kit.js";
import { appendFor } from "../harness/oracles.js";

const NOW = "2026-10-01T12:00:00.000Z";
const SCR = "MASQUE_Screener_v0_3.jsx";
const INJECTED = "injected by the render-screener suite";

// ----------------------------------------------------------------------------- DOM helpers

const qa = (root, sel) => [...root.querySelectorAll(sel)];
const click = (el) => flushSync(() => el.click());

/** textContent without <style> elements (the scoped stylesheets are rendered inline). */
function textOf(el) {
  if (!el) return null;
  const c = el.cloneNode(true);
  for (const s of c.querySelectorAll("style")) s.remove();
  return c.textContent;
}

/** Tag and class of every element of a subtree in document order (svg internals skipped). */
function shapeOf(el) {
  const out = [];
  const walk = (n) => {
    for (const ch of n.children) {
      const tag = ch.tagName.toLowerCase();
      if (tag === "style") continue;
      if (tag === "svg") { out.push("svg"); continue; }
      out.push(`${tag}.${(ch.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).join(".")}`);
      walk(ch);
    }
  };
  if (el) walk(el);
  return out;
}

const pct = (s) => (s === "" ? null : parseFloat(s));

/** The comparable regions of a mounted Screener (baseline `.mq` or new `.sa-screener .mq`). */
function regions(container) {
  const mq = container.querySelector(".mq");
  const banner = mq.querySelector(".banner");
  const card = mq.querySelector(".mq-wrap > .card");
  const meter = card && card.querySelector(".meter");
  return {
    bannerButtons: qa(banner, "button").map((b) => textOf(b).trim()),
    bannerText: textOf(banner.querySelector(".who")) + "|" + textOf(banner.querySelector(".badge")),
    brand: textOf(mq.querySelector(".brandrow")),
    rail: { text: textOf(mq.querySelector(".rail")), segs: qa(mq, ".rail .seg").map((s) => s.className + "/" + s.querySelector(".bar").className) },
    card: textOf(card),
    cardShape: shapeOf(card),
    zones: meter ? qa(meter, ".z").map((z) => pct(z.style.width)) : null,
    needle: meter ? (meter.querySelector(".needle") || {}).style?.left ?? null : null,
    range: meter && meter.querySelector(".rangeband") ? [meter.querySelector(".rangeband").style.left, meter.querySelector(".rangeband").style.width] : null,
    nav: { text: textOf(mq.querySelector(".nav")), disabled: qa(mq, ".mq-wrap > .nav button").map((b) => b.disabled) },
    toast: textOf(mq.querySelector(".toast")),
    foot: textOf(mq.querySelector(".foot")),
  };
}

/** The .mq-wrap children as region kinds; the panel and the link card are both "research". */
function layout(container) {
  const wrap = container.querySelector(".mq-wrap");
  return [...wrap.children].map((ch) => {
    const cls = ch.getAttribute("class") || ch.tagName.toLowerCase();
    if (/\brrp\b/.test(cls) || /\bsa-scr-link\b/.test(cls)) return "research";
    return cls.split(/\s+/)[0];
  }).filter((k) => k !== "style" && k !== "sa-common-tabnote");
}

const navButton = (container, label) => qa(container, ".mq-wrap > .nav button").find((b) => textOf(b).trim() === label);
const cardButton = (container, re) => qa(container, ".mq-wrap > .card button").find((b) => re.test(textOf(b).trim()));

// ----------------------------------------------------------------------------- the suite

export default {
  name: "render-screener",
  owner: "WP7",
  run: guarded("render-screener", async (h) => {
    const { module: masque } = await loadMasque(h);
    const [fhir, scoring, bind, policy, common] = await Promise.all([
      h.engine("fhir.js"), h.engine("scoring.js"), h.engine("bind.js"), h.engine("policy.js"),
      h.env.loader.importModule(h.appUrl("src/ui/common.jsx")),
    ]);
    need(typeof scoring.computeScore === "function", "waits on WP3");
    let App;
    try {
      App = (await h.env.loader.importModule(h.appUrl("src/apps/Screener.jsx"))).default;
    } catch (err) {
      throw Object.assign(new Error(`waits on WP7: src/apps/Screener.jsx does not compile: ${String(err.message).split("\n")[0]}`), { waits: true });
    }
    // A private baseline instance: its SAMPLE_CASES may be pointed at a scenario at run time.
    const scr = await h.oracle(SCR, { append: `${appendFor(SCR)}\n// render-screener instance\n` });
    const Base = scr.default;
    const baseKeys = Object.keys(scr.SAMPLE_CASES);
    const c = collector(h);

    const cases = masque.sampleCases;
    const scenarios = cases.filter((x) => x.group === "scenario");
    const ad11 = { added: scenarios.map((x) => x.buttonLabel) };
    const AD7 = { from: [33, 33, 34], to: [34, 33, 33] };

    const spiesFor = () => {
      const s = { snapshots: [], rows: [], dirty: [], errors: [], opened: [] };
      s.props = {
        onScreen: (x) => s.snapshots.push(x),
        onCapture: (x) => s.rows.push(x),
        onDirty: (tab, summary) => s.dirty.push([tab, summary]),
        onModuleError: (e) => s.errors.push(e),
        onOpenTab: (t) => s.opened.push(t),
      };
      return s;
    };
    const mountNew = (module, spies) => h.mount(React.createElement(App, { module, appVersion: policy.APP_VERSION, site: policy.SITE, ...spies.props }));

    let observedAD7 = false, observedAD11 = false, sawAD1Pre = false, sawAD1 = false;

    /** Compare every region of the two mounted screens. */
    const compare = (bc, nc, at, input) => {
      const a = regions(bc), b = regions(nc);
      const r11 = c.diff(a.bannerButtons, b.bannerButtons, { at: `${at}/banner/buttons`, input, allow: ["AD11"], ctx: { AD11: ad11 } });
      if (r11.observed.has("AD11")) observedAD11 = true;
      c.diff(a.bannerText, b.bannerText, { at: `${at}/banner/text`, input });
      c.diff(a.brand, b.brand, { at: `${at}/brand`, input, allow: ["AD4"] });
      c.diff(a.rail, b.rail, { at: `${at}/rail`, input });
      c.diff(a.card, b.card, { at: `${at}/card/text`, input });
      c.diff(a.cardShape, b.cardShape, { at: `${at}/card/dom`, input });
      if (a.zones || b.zones) {
        const r7 = c.diff(a.zones, b.zones, { at: `${at}/card/meter/zones`, input, allow: ["AD7"], ctx: { AD7 } });
        if (r7.observed.has("AD7")) observedAD7 = true;
        c.diff(a.needle, b.needle, { at: `${at}/card/meter/needle`, input });
        c.diff(a.range, b.range, { at: `${at}/card/meter/range`, input });
      }
      c.diff(a.nav, b.nav, { at: `${at}/nav`, input });
      c.diff(a.toast, b.toast, { at: `${at}/toast`, input });
      c.diff(a.foot, b.foot, { at: `${at}/foot`, input });
    };

    // ------------------------------------------------------------------ samples
    const railButtons = (nc) => qa(nc, "[data-testid=sample-rail] button");
    let nSteps = 0;
    for (const sc of cases) {
      const at = `/samples/${sc.id}`;
      const input = { sample: sc.id };
      const spies = spiesFor();
      const isBaseSample = baseKeys.includes(sc.id);
      const slot = isBaseSample ? sc.id : baseKeys[0];
      const saved = scr.SAMPLE_CASES[slot];
      if (!isBaseSample) {
        scr.SAMPLE_CASES[slot] = { label: sc.label, complaint: sc.complaint ?? "", ctx: { ...(sc.ctx || {}) }, rf: sc.rf ? { ...sc.rf } : undefined, a: { ...sc.a } };
      }
      const bm = h.mount(React.createElement(Base));
      const nm = mountNew(masque, spies);
      try {
        await h.withFixedClock(NOW, async () => {
          const bc = bm.container, nc = nm.container;
          c.check(spies.snapshots.length === 0, `${at}/snapshot/@untouched`, input, "nothing published before the screen is touched", spies.snapshots.length);
          click(qa(bc, ".banner button")[baseKeys.indexOf(slot)]);
          const btn = railButtons(nc).find((b) => b.dataset.sample === sc.id);
          if (!c.check(!!btn, `${at}/rail/button`, input, "a rail button", "none")) return;
          click(btn);
          compare(bc, nc, `${at}/result`, input);
          c.check(textOf(nc.querySelector("[data-testid=tab-note]")) === common.TAB_NOTES.clinician, `${at}/tabNote`, input, common.TAB_NOTES.clinician, textOf(nc.querySelector("[data-testid=tab-note]")));
          const lb = layout(bc), ln = layout(nc);
          c.diff(lb, ln, { at: `${at}/layout`, input });
          c.check(!!bc.querySelector(".rrp") && !nc.querySelector(".rrp"), `${at}/panel`, input, "the baseline panel replaced", { baseline: !!bc.querySelector(".rrp"), new: !!nc.querySelector(".rrp") });

          // Snapshot (§5.3).
          const score = scoring.computeScore(masque, sc.a);
          const snap = spies.snapshots[spies.snapshots.length - 1];
          const flagsOpen = Object.keys(sc.rf || {}).length > 0;
          const reviewed = sc.safetyReviewed ?? true;
          if (c.check(!!snap, `${at}/snapshot`, input, "published", "none")) {
            c.diff({ source: "screener", moduleKey: masque.key, score: score.total, floor: score.floor, ceiling: score.ceiling, scorable: score.scorable,
              band: score.band, coverage: score.coverage, phenotype: sc.complaint ?? "", safetyReviewed: reviewed,
              routingCleared: reviewed && !flagsOpen, redFlags: Object.keys(sc.rf || {}).map((id) => masque.flagById[id].points),
              answers: sc.a, ctx: sc.ctx || {}, at: NOW, sex: masque.demo.patient.sex ?? null, gender: masque.demo.patient.gender ?? null },
            { source: snap.source, moduleKey: snap.moduleKey, score: snap.score, floor: snap.floor, ceiling: snap.ceiling, scorable: snap.scorable,
              band: snap.band, coverage: snap.coverage, phenotype: snap.phenotype, safetyReviewed: snap.safetyReviewed,
              routingCleared: snap.routingCleared, redFlags: snap.redFlags, answers: snap.answers, ctx: snap.ctx, at: snap.at, sex: snap.sex, gender: snap.gender },
            { at: `${at}/snapshot`, input });
            c.diff(score.domains, snap.domains, { at: `${at}/snapshot/domains`, input });
          }

          // The bundle shown on the result card (AD1 on an unsettled screen).
          click(cardButton(bc, /FHIR bundle$/)); click(cardButton(nc, /FHIR bundle$/));
          const ba = JSON.parse(textOf(bc.querySelector("pre.code"))), bb = JSON.parse(textOf(nc.querySelector("pre.code")));
          const pre = !score.scorable && score.floor < score.total;
          const r1 = c.diff(ba, bb, { at: `${at}/bundle`, input, allow: ["AD1"], ctx: { AD1: { total: score.total, floor: score.floor } } });
          if (pre) { sawAD1Pre = true; if (r1.observed.has("AD1")) sawAD1 = true; }
          h.expect("AD1", { precondition: pre, observed: r1.observed.has("AD1") });
          click(cardButton(bc, /FHIR bundle$/)); click(cardButton(nc, /FHIR bundle$/));

          // Capture.
          click(cardButton(bc, /^Append this screen$/)); click(cardButton(nc, /^Append this screen$/));
          compare(bc, nc, `${at}/captured`, input);
          const row = spies.rows[spies.rows.length - 1];
          c.check(!!row && row.source === "screener" && row.row.module_id === masque.id && row.row.instrument_version === masque.instrumentVersion,
            `${at}/capture/row`, input, { source: "screener", module_id: masque.id }, row && { source: row.source, module_id: row.row.module_id });
          c.check(/Captured this session: 1\./.test(textOf(nc.querySelector("[data-testid=research-link]"))), `${at}/link/count`, input, "Captured this session: 1.", textOf(nc.querySelector("[data-testid=research-link]")));
          const nAns = Object.values(sc.a).filter((v) => v !== undefined).length;
          const wantDirty = [nAns ? `${nAns} answer${nAns === 1 ? "" : "s"}` : null, "1 captured row"].filter(Boolean).join(", ");
          c.diff(["screener", wantDirty], spies.dirty[spies.dirty.length - 1], { at: `${at}/dirty`, input });

          // Back through every step.
          for (let s = masque.steps.screener.length - 2; s >= 0; s--) {
            click(navButton(bc, "Back")); click(navButton(nc, "Back"));
            compare(bc, nc, `${at}/step/${masque.steps.screener[s].key}`, input);
            nSteps++;
          }
        });
      } finally {
        bm.unmount(); nm.unmount();
        scr.SAMPLE_CASES[slot] = saved;
      }
    }
    c.note(`samples: ${cases.length} cases (${scenarios.length} scenarios through the baseline's own loadSample), ${nSteps} step cards compared`);

    // Rail: nine buttons in two groups (AD11).
    {
      const spies = spiesFor();
      const nm = mountNew(masque, spies);
      try {
        const groups = qa(nm.container, "[data-testid=sample-rail] [role=group]").map((g) => [g.dataset.group, qa(g, "button").map((b) => b.dataset.sample)]);
        c.diff([["sample", cases.filter((x) => (x.group || "sample") === "sample").map((x) => x.id)], ["scenario", scenarios.map((x) => x.id)]], groups, { at: "/rail/groups" });
        c.check(railButtons(nm.container).length === cases.length, "/rail/count", null, cases.length, railButtons(nm.container).length);
        for (const x of scenarios) {
          const b = railButtons(nm.container).find((y) => y.dataset.sample === x.id);
          c.check(!!b && b.title === (x.why || ""), `/rail/${x.id}/title`, null, x.why, b && b.title);
        }
        click(nm.container.querySelector("[data-testid=research-link] button"));
        c.diff(["research"], spies.opened, { at: "/link/onOpenTab" });
      } finally { nm.unmount(); }
    }
    h.expect("AD11", { precondition: scenarios.length > 0, observed: observedAD11 });
    h.expect("AD7", { precondition: true, observed: observedAD7 });

    // ------------------------------------------------------------------ replay
    const itemByText = new Map(masque.allItems.map((it) => [it.text, it]));
    const ctxByText = new Map(masque.contextItems.map((ci) => [ci.text, ci]));
    const flagByText = new Map(masque.redFlags.map((f) => [f.text, f]));
    const pickLabel = (value) => ((masque.phenotypes && masque.phenotypes.values) || []).find((v) => v.value === value)?.h;
    /** Answer the current card from `plan`; returns false at the result step. */
    const act = (root, plan) => {
      const card = root.querySelector(".mq-wrap > .card");
      const rfRows = qa(card, ".rf");
      if (rfRows.length) {
        let any = false;
        for (const row of rfRows) {
          const f = flagByText.get(textOf(row.querySelector(".rt")).replace(/(emergent|urgent)$/, ""));
          if (f && plan.rf && plan.rf[f.id]) { click(row); any = true; }
        }
        if (!any) click(qa(card, ".safetybar button")[0]);
      }
      if (plan.complaint) {
        const p = qa(card, ".pick .p").find((x) => textOf(x.querySelector(".ph")) === pickLabel(plan.complaint));
        if (p) click(p);
      }
      for (const qd of qa(card, ".q")) {
        const t = textOf(qd.querySelector(".qtext"));
        const it = itemByText.get(t), ci = ctxByText.get(t);
        let label = null;
        if (it && plan.a[it.id] !== undefined) label = it.scale ? it.scale[plan.a[it.id]].label : plan.a[it.id] === "yes" ? "Yes" : "No";
        else if (ci && plan.ctx && plan.ctx[ci.id] !== undefined) label = (ci.options.find((o) => o[0] === plan.ctx[ci.id]) || [])[1];
        if (label != null) {
          const b = qa(qd, "button").find((x) => textOf(x) === label);
          if (b) click(b);
        }
      }
    };
    const plans = [
      { name: cases[cases.length > 3 ? 3 : 0].id, ...cases[cases.length > 3 ? 3 : 0] },
      { name: (cases.find((x) => x.rf) || cases[0]).id, ...(cases.find((x) => x.rf) || cases[0]) },
      { name: "empty-walk", a: {}, ctx: {}, complaint: ((masque.phenotypes && masque.phenotypes.values) || [])[0]?.value },
    ];
    for (const plan of plans) {
      const at = `/replay/${plan.name}`;
      const input = { replay: plan.name };
      const bm = h.mount(React.createElement(Base));
      const nm = mountNew(masque, spiesFor());
      try {
        await h.withFixedClock(NOW, async () => {
          for (let s = 0; s < masque.steps.screener.length; s++) {
            const key = masque.steps.screener[s].key;
            act(bm.container, plan); act(nm.container, plan);
            compare(bm.container, nm.container, `${at}/${key}`, input);
            const nextB = qa(bm.container, ".mq-wrap > .nav .btn:not(.ghost)")[0], nextN = qa(nm.container, ".mq-wrap > .nav .btn:not(.ghost)")[0];
            if (!nextB || !nextN) break;
            c.check(!nextN.disabled, `${at}/${key}/continue`, input, "enabled after the plan's answers", "disabled");
            click(nextB); click(nextN);
          }
        });
      } finally { bm.unmount(); nm.unmount(); }
    }

    // ------------------------------------------------------------------ downloads
    {
      const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL, realClick = HTMLAnchorElement.prototype.click;
      const got = [];
      let pending = null;
      URL.createObjectURL = (blob) => { pending = blob; return "blob:render-screener"; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () { got.push({ name: this.download, blob: pending }); };
      const bm = h.mount(React.createElement(Base));
      const nm = mountNew(masque, spiesFor());
      let want;
      try {
        h.withFixedClock(NOW, () => {
          click(qa(bm.container, ".banner button")[0]);
          click(railButtons(nm.container)[0]);
          for (const root of [bm.container, nm.container]) {
            click(cardButton(root, /^Append this screen$/));
            for (const re of [/^FHIR Questionnaire$/, /^CDS Hooks service$/, /^Data dictionary$/, /^Export cohort/]) click(cardButton(root, re));
          }
          want = [
            JSON.stringify(fhir.buildQuestionnaire(masque), null, 2),
            JSON.stringify(fhir.buildCdsHooks(masque), null, 2),
            JSON.stringify(fhir.buildDataDictionary(masque, { appVersion: policy.APP_VERSION }), null, 2),
          ];
        });
      } finally {
        bm.unmount(); nm.unmount();
        URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; HTMLAnchorElement.prototype.click = realClick;
      }
      if (c.check(got.length === 8, "/downloads/count", null, 8, got.length)) {
        const baseNames = got.slice(0, 4).map((x) => x.name), newNames = got.slice(4).map((x) => x.name);
        c.diff(baseNames, newNames, { at: "/downloads/names" });
        const p = masque.fhir.filePrefix, v = masque.instrumentVersion;
        c.diff([`${p}-questionnaire-v${v}.json`, `${p}-cds-hooks.json`, `${p}-data-dictionary-v${v}.json`, `${p}-pilot-cohort-${NOW.slice(0, 10)}.csv`], newNames, { at: "/downloads/filePrefix" });
        for (let i = 0; i < 3; i++) c.diff(want[i], await got[4 + i].blob.text(), { at: `/downloads/content/${newNames[i]}` });
        const csv = await got[7].blob.text();
        c.check(csv.split("\n")[0].split(",").includes("module_id") && csv.split("\n").length === 2, "/downloads/cohort", null, "a header with module_id and one row", csv.split("\n")[0]);
      }
    }

    // ------------------------------------------------------------------ shape fixture
    {
      const { module: shape, validation } = await h.loadFixture("shape", { builtins: [masque], loaded: [masque] });
      c.check(!(validation.errors || []).length, "/shape/validation", null, [], validation.errors);
      const spies = spiesFor();
      const nm = mountNew(shape, spies);
      try {
        const root = nm.container;
        c.check(!root.querySelector("[data-testid=sample-rail]"), "/shape/rail", null, "hidden", "shown");
        const all = { a: {}, ctx: {} };
        for (const it of shape.allItems) all.a[it.id] = it.scale ? 0 : "no";
        let steps = 0;
        for (let s = 0; s < shape.steps.screener.length - 1; s++) {
          c.check(!root.querySelector(".pick") && !root.querySelector("[data-context]"), `/shape/step/${s}/extras`, null, "no picker, no context", "present");
          if (s === 0) click(qa(root, ".safetybar button")[0]);
          else for (const qd of qa(root, ".mq-wrap > .card .q")) click(qa(qd, "button")[0]);
          const next = qa(root, ".mq-wrap > .nav .btn:not(.ghost)")[0];
          c.check(!!next && !next.disabled, `/shape/step/${s}/continue`, null, "enabled", next && next.disabled);
          if (next) click(next);
          steps++;
        }
        const recs = qa(root, "[data-testid=scr-recs] .rec").map((r) => textOf(r.querySelector("h4")));
        c.diff(["No routing rules in this module"], recs, { at: "/shape/recs" });
        c.check(!root.querySelector("[data-testid=cds-preview]"), "/shape/cds", null, "no CDS card", "a card");
        c.check(/Uploaded module/.test(textOf(root.querySelector("[data-testid=provenance-badge]")) || ""), "/shape/badge", null, "Uploaded module", textOf(root.querySelector("[data-testid=provenance-badge]")));
        c.check(!/\{[A-Za-z][A-Za-z0-9_.]*\}/.test(textOf(root)), "/shape/placeholders", null, "no unrendered placeholder", (textOf(root).match(/\{[A-Za-z][A-Za-z0-9_.]*\}/) || [])[0]);
        click(cardButton(root, /FHIR bundle$/));
        const bundle = JSON.parse(textOf(root.querySelector("pre.code")));
        c.check(!bundle.entry.some((e) => e.resource.resourceType === "ServiceRequest"), "/shape/bundle/referral", null, "no ServiceRequest", "present");
        c.note(`shape: ${steps} steps walked; ${recs.length} rec(s) at the result`);
      } finally { nm.unmount(); }
    }

    // ------------------------------------------------------------------ routing error (D6)
    {
      const throwing = () => { throw new Error(INJECTED); };
      const L = masque.logic;
      const bad = await bind.bindModule(masque.rubric, { ...L, routing: [
        { id: "harness_throwing_route", when: throwing, copy: { screener: { h: "x", p: "x", chips: [] }, scribe: { h: "x", p: "x", chips: [] } } },
        ...(L.routing || [])] }, { origin: "builtin", classification: "builtin", key: "fixture:throwing-routing",
        sources: { rubricText: masque.sources && masque.sources.rubricText, logicText: null }, loadedAt: NOW });
      // A sample that routes on the unmodified module: settled, non-lowest band, no red flag.
      const routed = cases.find((x) => !x.rf && (() => { const s = scoring.computeScore(masque, x.a); return s.scorable && s.band !== "low"; })());
      if (c.check(!!routed, "/routingError/@precondition", null, "a routed sample", "none")) {
        for (const [name, mod] of [["ok", masque], ["error", bad]]) {
          const spies = spiesFor();
          const nm = mountNew(mod, spies);
          try {
            h.withFixedClock(NOW, () => {
              click(railButtons(nm.container).find((b) => b.dataset.sample === routed.id));
              click(cardButton(nm.container, /FHIR bundle$/));
            });
            const root = nm.container;
            const recs = qa(root, "[data-testid=scr-recs] .rec").map((r) => textOf(r.querySelector("h4")));
            const bundle = JSON.parse(textOf(root.querySelector("pre.code")));
            const referral = bundle.entry.some((e) => e.resource.resourceType === "ServiceRequest" && e.resource.priority === "routine");
            const index = !!root.querySelector("[data-testid=cds-preview][data-card=index]");
            const obs = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === "Observation");
            const note = (obs.note || []).map((x) => x.text);
            if (name === "ok") {
              c.check(referral && index && !recs.includes("Module rule error — no routing issued"), "/routingError/ok", { sample: routed.id },
                "referral, CDS index card, module recs", { referral, index, recs });
              c.check(spies.errors.length === 0, "/routingError/ok/onModuleError", null, 0, spies.errors.length);
            } else {
              c.diff(["Module rule error — no routing issued"], recs, { at: "/routingError/recs", input: { sample: routed.id } });
              c.check(!referral, "/routingError/referral", { sample: routed.id }, "no referral ServiceRequest", "present");
              c.check(!index, "/routingError/cdsIndex", { sample: routed.id }, "no CDS index card", "present");
              c.check(note.includes(`Screening routing withheld: module rule "harness_throwing_route" failed, so no referral was issued.`),
                "/routingError/bundle/note", { sample: routed.id }, "the withheld-routing note", note);
              c.check(spies.errors.length === 1 && spies.errors[0].ruleId === "harness_throwing_route" && spies.errors[0].message === INJECTED,
                "/routingError/onModuleError", { sample: routed.id }, "reported once", spies.errors);
            }
          } finally { nm.unmount(); }
        }
      }
    }

    // ------------------------------------------------------------------ never a probability
    {
      const nm = mountNew(masque, spiesFor());
      try {
        for (const sc of cases) {
          h.withFixedClock(NOW, () => click(railButtons(nm.container).find((b) => b.dataset.sample === sc.id)));
          const root = nm.container.cloneNode(true);
          for (const el of root.querySelectorAll("style, [data-testid=scr-gap]")) el.remove();
          c.check(!/probabilit/i.test(root.textContent), `/probability/${sc.id}`, { sample: sc.id }, "no probability", (root.textContent.match(/.{0,40}probabilit.{0,40}/i) || [])[0]);
          c.check(!nm.container.querySelector(".rrp"), `/panel/${sc.id}`, { sample: sc.id }, "no research panel", "mounted");
        }
      } finally { nm.unmount(); }
    }

    c.note(`AD1 precondition seen: ${sawAD1Pre}, observed: ${sawAD1}; AD7 observed: ${observedAD7}; AD11 observed: ${observedAD11}`);
    c.note("AD8: the baseline panel and the new Research link card occupy the same place in the layout (compared as one region kind); AD12: the tab note is shell chrome and is not compared");
    return c.result();
  }),
};
