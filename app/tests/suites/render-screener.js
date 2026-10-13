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
//             by "View FHIR bundle" (AD1; release 0.4.5: AD17 on the otologic and both referral
//             destinations, the clinical lead's rule, expected wherever the baseline refers one);
//             "Append this screen"; then Back through every step,
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
// Release 0.4.3 (the EMR Friendly Template): the result card holds one more button, right after
// the write button, which AD15 alone excuses (card text and DOM shape, h.expect wherever the button
// is shown). Its panel, on the new app only: the toggle (label, place, aria-expanded), nothing
// mounted and no iframe until it is opened; then the instruction line, an iframe with sandbox
// "allow-same-origin" exactly, its title, and a srcdoc equal to emrFrameDoc(buildEmrTemplate(...))
// for every sample (the panel stays open while samples change, so the text is rebuilt), whose
// textarea holds exactly the template; the template's referral and reason lines equal the shown
// bundle's referral ServiceRequest, or are absent with it; every open flag's module action is
// listed; Copy writes the template through navigator.clipboard (stubbed) with the success toast,
// and the failure toast when the clipboard refuses; Download saves <filePrefix>-emr-template-
// screener.txt with the template; with the container attached off screen (review round 4), the
// frame's live textarea holds the template, an edit typed into it (a marker line) is what Copy and
// Download take, and leaving the result view (Back, then See screen result) remounts the frame with
// the generated text; closing, and Clear, unmount the panel and the iframe; the shape
// fixture gets the neutral template (no references, no checklist, no unrendered placeholder); a
// throwing routing rule gives the engine's withheld-routing line and no referral.
import React from "react";
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need } from "../harness/kit.js";
import { appendFor } from "../harness/oracles.js";
import { ALLOWED_DIFFERENCES } from "../harness/diff.js";
import { REFERRAL_DELTA } from "../harness/referral-delta.js";

const AD17 = ALLOWED_DIFFERENCES.find((d) => d.id === "AD17");

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

// ----------------------------------------------------------------------------- EMR panel helpers (release 0.4.3)

const tick = () => new Promise((r) => setTimeout(r, 0));
/** The textarea value of the EMR panel's srcdoc, parsed as the browser would (null without a frame). */
function frameText(root, testid) {
  const f = root.querySelector(`[data-testid=${testid}]`);
  if (!f) return null;
  const doc = new DOMParser().parseFromString(f.getAttribute("srcdoc") || "", "text/html");
  const ta = doc.querySelector("textarea");
  return ta ? ta.value : null;
}
/** The referral ServiceRequest of a bundle as the two lines a template prints, or null. */
function bundleReferral(bundle) {
  const sr = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === "ServiceRequest" && r.priority === "routine");
  return sr ? { code: sr.code.text, reason: `  Reason: ${sr.reasonCode[0].text}` } : null;
}
/** The referral lines of a template (a "Referral:" line that is not the placeholder, and the line after it), or null. */
function noteReferral(text) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /^Referral: (?!\[)/.test(l));
  return i < 0 ? null : { code: lines[i], reason: lines[i + 1] };
}
/** Swap navigator.clipboard.writeText for `fn` while `body` runs. */
async function withClipboard(fn, body) {
  const clip = navigator.clipboard;
  const had = !!clip;
  if (had) Object.defineProperty(clip, "writeText", { value: fn, configurable: true, writable: true });
  else Object.defineProperty(navigator, "clipboard", { value: { writeText: fn }, configurable: true });
  try {
    return await body();
  } finally {
    if (had) delete clip.writeText; else delete navigator.clipboard;
  }
}
/** Wait a few event-loop turns until `pred()` holds; returns whether it did. */
async function until(pred, turns = 40) {
  for (let i = 0; i < turns; i++) { if (pred()) return true; await tick(); }
  return pred();
}
/** The marker line the round-4 edit check appends to the template in the frame. */
const EDIT_MARKER = "render-screener edit marker: typed into the frame";
/**
 * The live textarea of an attached EMR frame once its srcdoc has loaded (review round 4), or null
 * after `ms`. Polls contentDocument, waking on the frame's load event or every 50 ms, so a
 * background tab's timer throttling cannot stall it past the load.
 */
async function frameTextarea(frame, ms = 10000) {
  const read = () => {
    try { const d = frame.contentDocument; return d ? d.querySelector("textarea") : null; } catch (_) { return null; }
  };
  const t0 = Date.now();
  while (!read() && Date.now() - t0 < ms) {
    await new Promise((res) => {
      const done = () => { frame.removeEventListener("load", done); clearTimeout(timer); res(); };
      const timer = setTimeout(done, 50);
      frame.addEventListener("load", done);
    });
  }
  return read();
}

// ----------------------------------------------------------------------------- the suite

export default {
  name: "render-screener",
  owner: "WP7",
  run: guarded("render-screener", async (h) => {
    const { module: masque } = await loadMasque(h);
    const [fhir, scoring, bind, policy, common, emr] = await Promise.all([
      h.engine("fhir.js"), h.engine("scoring.js"), h.engine("bind.js"), h.engine("policy.js"),
      h.env.loader.importModule(h.appUrl("src/ui/common.jsx")), h.engine("emr.js"),
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

    let observedAD7 = false, observedAD11 = false, sawAD1Pre = false, sawAD1 = false, ad17Pre = 0, ad17Seen = 0;
    // AD15 (release 0.4.3): the EMR Friendly Template button, right after the write button.
    const EMR_ADDED = ` ${emr.EMR_UI.button}`;
    const ad15 = { AD15: { text: [["Write result to chart", EMR_ADDED], ["Write partial screen to chart", EMR_ADDED]],
      shape: { anchor: ["button.btn", "svg"], added: ["button.btn.ghost", "svg"] } } };
    let ad15Pre = 0, ad15Seen = 0;

    /** Compare every region of the two mounted screens. */
    const compare = (bc, nc, at, input) => {
      const a = regions(bc), b = regions(nc);
      const r11 = c.diff(a.bannerButtons, b.bannerButtons, { at: `${at}/banner/buttons`, input, allow: ["AD11"], ctx: { AD11: ad11 } });
      if (r11.observed.has("AD11")) observedAD11 = true;
      c.diff(a.bannerText, b.bannerText, { at: `${at}/banner/text`, input });
      c.diff(a.brand, b.brand, { at: `${at}/brand`, input, allow: ["AD4"] });
      c.diff(a.rail, b.rail, { at: `${at}/rail`, input });
      const rt = c.diff(a.card, b.card, { at: `${at}/card/text`, input, allow: ["AD15"], ctx: ad15 });
      const rd = c.diff(a.cardShape, b.cardShape, { at: `${at}/card/dom`, input, allow: ["AD15"], ctx: ad15 });
      // The button is on every result card; there AD15 must be what excuses both the text and the shape.
      if (nc.querySelector(".mq-wrap > .card [data-testid=scr-emr-toggle]")) {
        ad15Pre++;
        if (rt.observed.has("AD15") && rd.observed.has("AD15")) ad15Seen++;
        h.expect("AD15", { precondition: true, observed: rt.observed.has("AD15") && rd.observed.has("AD15") });
      }
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
          const p17 = { delta: REFERRAL_DELTA, complaint: sc.complaint ?? "" };
          const r1 = c.diff(ba, bb, { at: `${at}/bundle`, input, allow: ["AD1", "AD17"], ctx: { AD1: { total: score.total, floor: score.floor }, AD17: p17 } });
          if (pre) { sawAD1Pre = true; if (r1.observed.has("AD1")) sawAD1 = true; }
          h.expect("AD1", { precondition: pre, observed: r1.observed.has("AD1") });
          // Release 0.4.5: the baseline refers the otologic or both phenotype to the destination the lead's rule changed.
          const baseRef = (ba.entry || []).map((e) => e.resource).find((r) => r.resourceType === "ServiceRequest" && r.priority === "routine");
          const pre17 = AD17.detector({ p: p17, baseline: baseRef ? baseRef.code.text : null });
          if (pre17) { ad17Pre++; if (r1.observed.has("AD17")) ad17Seen++; }
          h.expect("AD17", { precondition: pre17, observed: r1.observed.has("AD17") });
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
    c.check(ad17Pre > 0 && ad17Seen === ad17Pre, "/samples/@AD17", null, "AD17 at every referral of a dizziness case (otologic or both) shown (at least one sample)", `${ad17Seen} of ${ad17Pre}`);
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
        // Release 0.4.3: a module without emrTemplate gets the neutral template.
        const emrToggle = root.querySelector("[data-testid=scr-emr-toggle]");
        if (c.check(!!emrToggle && !shape.emrTemplate, "/shape/emr/toggle", null, "the button, on a module without emrTemplate", { button: !!emrToggle, emrTemplate: !!shape.emrTemplate })) {
          click(emrToggle);
          const st = spies.snapshots[spies.snapshots.length - 1] || {};
          const wantShape = emr.buildEmrTemplate(shape, { patient: shape.demo.patient, answers: st.answers, ctx: st.ctx, complaint: st.phenotype, rf: {}, appVersion: policy.APP_VERSION }, { surface: "screener" });
          const gotShape = frameText(root, "scr-emr-frame") || "";
          c.diff(wantShape.split("\n"), gotShape.split("\n"), { at: "/shape/emr/text" });
          const lines = gotShape.split("\n");
          c.check(!/[{}]/.test(gotShape) && !lines.some((l) => /^Empiric treatment references|^Medical management not yet offered|^\s*Ref: |^\[[ x]\] /.test(l))
            && lines.includes("Treatment and investigations to date: [ ]") && lines[0] === policy.CAVEATS.prototype && lines[lines.length - 1] === policy.CAVEATS.prototype,
            "/shape/emr/neutral", null, "the neutral template: no references, no checklist, no unrendered placeholder, the marker first and last", lines.filter((l) => /[{}]|Ref: |^\[[ x]\] |^Empiric|^Medical management/.test(l)).slice(0, 5));
        }
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
            // Release 0.4.3: the EMR template follows the same gate.
            click(root.querySelector("[data-testid=scr-emr-toggle]"));
            const emrText = frameText(root, "scr-emr-frame") || "";
            c.diff(bundleReferral(bundle), noteReferral(emrText), { at: `/routingError/${name}/emr/referral`, input: { sample: routed.id } });
            if (name === "ok") {
              c.check(!!noteReferral(emrText) && emrText.split("\n").includes("Empiric treatment references (for use before specialist review):"), "/routingError/ok/emr", { sample: routed.id },
                "the referral and the empiric-treatment references", emrText.split("\n").filter((l) => /^Referral|^Empiric/.test(l)));
            } else {
              c.check(emrText.split("\n").includes(`Screening routing withheld: module rule "harness_throwing_route" failed, so no referral was issued.`)
                && !emrText.includes("Empiric treatment references") && !noteReferral(emrText), "/routingError/emr", { sample: routed.id },
                "the engine's withheld-routing line; no referral, no references", emrText.split("\n").filter((l) => /^Referral|^Empiric|^Screening routing/.test(l)));
            }
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

    // ------------------------------------------------------------------ EMR Friendly Template (release 0.4.3)
    {
      const UI = emr.EMR_UI;
      const stateOf = (sc) => ({ patient: masque.demo.patient, answers: sc.a, ctx: sc.ctx || {}, complaint: sc.complaint ?? "", rf: sc.rf || {}, appVersion: policy.APP_VERSION });
      const want = (sc) => emr.buildEmrTemplate(masque, stateOf(sc), { surface: "screener" });
      const nm = mountNew(masque, spiesFor());
      const root = nm.container;
      const toggle = () => root.querySelector("[data-testid=scr-emr-toggle]");
      const toastText = () => textOf(root.querySelector("[data-testid=scr-toast]")) || "";
      const sib = (el, k) => (el && el[k] ? textOf(el[k]).trim() : "");
      try {
        h.withFixedClock(NOW, () => click(railButtons(root).find((b) => b.dataset.sample === cases[0].id)));
        const t = toggle();
        if (c.check(!!t, "/emr/toggle", null, "the EMR Friendly Template button", "none")) {
          c.check(textOf(t).trim() === UI.button && UI.button === "EMR Friendly Template" && t.tagName === "BUTTON" && t.className === "btn ghost", "/emr/toggle/label", null,
            "button.btn.ghost \"EMR Friendly Template\"", `${t.tagName.toLowerCase()}.${t.className} "${textOf(t).trim()}"`);
          c.check(!!t.closest("[data-testid=scr-writeback]") && /^Write (?:result|partial screen) to chart$/.test(sib(t, "previousElementSibling")) && /FHIR bundle$/.test(sib(t, "nextElementSibling")),
            "/emr/toggle/place", null, "in the write-back row, right after the write button and before the FHIR toggle", [sib(t, "previousElementSibling"), sib(t, "nextElementSibling")]);
          c.check(t.getAttribute("aria-expanded") === "false", "/emr/toggle/closed", null, "false", t.getAttribute("aria-expanded"));
          c.check(!root.querySelector("[data-testid=scr-emr-panel]") && !root.querySelector("iframe"), "/emr/closed/nothing-mounted", null, "no panel, no iframe", "mounted");
          click(t);
          const panel = root.querySelector("[data-testid=scr-emr-panel]");
          const frame = root.querySelector("[data-testid=scr-emr-frame]");
          c.check(t.getAttribute("aria-expanded") === "true" && !!panel && !!frame, "/emr/open", null, "panel and frame mounted, aria-expanded true", { panel: !!panel, frame: !!frame });
          if (panel && frame) {
            c.check(textOf(panel.querySelector(".sa-scr-emr-hint")) === `${UI.instruction} ${UI.regenerates}`, "/emr/hint", null, `${UI.instruction} ${UI.regenerates}`, textOf(panel.querySelector(".sa-scr-emr-hint")));
            c.check(UI.instruction === "Plain text for pasting into an EMR. Complete every [bracketed] field; edits here are not saved.", "/emr/hint/spec", null, "the spec's instruction line", UI.instruction);
            c.check(frame.tagName === "IFRAME" && frame.getAttribute("sandbox") === "allow-same-origin", "/emr/frame/sandbox", null, "allow-same-origin (no allow-scripts)", frame.getAttribute("sandbox"));
            c.check(frame.getAttribute("title") === UI.frameTitle && UI.frameTitle === "EMR friendly consult note template", "/emr/frame/title", null, "EMR friendly consult note template", frame.getAttribute("title"));
            c.check(!/<script/i.test(frame.getAttribute("srcdoc") || ""), "/emr/frame/no-script", null, "no script in the frame document", "a <script");
            c.diff([UI.copy, UI.download], qa(panel, "button").map((b) => textOf(b).trim()), { at: "/emr/buttons" });
            c.check(qa(root, "iframe").length === 1, "/emr/frame/one", null, 1, qa(root, "iframe").length);
          }
        }
        // Every sample with the panel open (the text is rebuilt as the screen changes) and the FHIR bundle shown.
        if (!root.querySelector("[data-testid=scr-bundle]")) click(cardButton(root, /FHIR bundle$/));
        let referrals = 0;
        for (const sc of cases) {
          const at = `/emr/samples/${sc.id}`;
          const input = { sample: sc.id };
          h.withFixedClock(NOW, () => click(railButtons(root).find((b) => b.dataset.sample === sc.id)));
          const w = want(sc);
          const frame = root.querySelector("[data-testid=scr-emr-frame]");
          if (!c.check(!!frame, `${at}/frame`, input, "the panel stays open", "closed")) continue;
          c.check(frame.getAttribute("srcdoc") === emr.emrFrameDoc(w), `${at}/srcdoc`, input, "emrFrameDoc(buildEmrTemplate(module, screen, screener))", (frame.getAttribute("srcdoc") || "").slice(0, 160));
          const got = frameText(root, "scr-emr-frame") || "";
          c.diff(w.split("\n"), got.split("\n"), { at: `${at}/text`, input });
          const pre = root.querySelector("[data-testid=scr-bundle]");
          if (c.check(!!pre, `${at}/bundle`, input, "the FHIR bundle shown", "hidden")) {
            const br = bundleReferral(JSON.parse(textOf(pre)));
            if (br) referrals++;
            // Release 0.4.6: under an open red flag the bundle carries no referral, while the note may
            // print the screen-based one under its heading (its lines are the emr suite's to check).
            const flagged = masque.redFlags.some((x) => sc.rf && sc.rf[x.id]);
            if (!flagged) c.diff(br, noteReferral(got), { at: `${at}/referral`, input });
            else {
              const gl = got.split("\n");
              const also = gl.indexOf("Screen-based referral and references (the FHIR bundle withholds the referral while a red flag is open):");
              const nr = noteReferral(got);
              c.check(br === null && also >= 0 && (nr === null || gl.indexOf(nr.code) > also), `${at}/referral`, input,
                "no referral in the bundle; the note's only under the 0.4.6 heading", { bundle: br, heading: also, note: nr && nr.code });
            }
          }
          const lines = got.split("\n");
          for (const f of masque.redFlags.filter((x) => sc.rf && sc.rf[x.id])) c.check(lines.includes(`- ${f.action} (${f.points}).`), `${at}/flag/${f.id}`, input, `- ${f.action} (${f.points}).`, "absent");
          c.check(lines[0] === policy.CAVEATS.prototype && lines[lines.length - 1] === policy.CAVEATS.prototype, `${at}/marker`, input, "the marker first and last", [lines[0], lines[lines.length - 1]]);
        }
        c.check(referrals > 0, "/emr/samples/@referral", null, "at least one sample issues a referral", referrals);
        // Copy: the template through the clipboard, then a refusal.
        const last = cases[cases.length - 1];
        const copyBtn = root.querySelector("[data-testid=scr-emr-copy]");
        if (c.check(!!copyBtn, "/emr/copy/button", null, "Copy text", "none")) {
          let copied = null;
          await withClipboard(async (x) => { copied = x; }, async () => {
            click(copyBtn);
            await until(() => toastText().includes(UI.copied));
          });
          c.check(copied === want(last), "/emr/copy/text", { sample: last.id }, "the template", copied && copied.slice(0, 120));
          c.check(toastText().includes(UI.copied), "/emr/copy/toast", null, UI.copied, toastText());
          await withClipboard(async () => { throw new Error("refused by the render-screener suite"); }, async () => {
            click(copyBtn);
            await until(() => toastText().includes(UI.copyFailed));
          });
          c.check(toastText().includes(UI.copyFailed), "/emr/copy/failure-toast", null, UI.copyFailed, toastText());
        }
        // Download.
        const dlBtn = root.querySelector("[data-testid=scr-emr-download]");
        if (c.check(!!dlBtn, "/emr/download/button", null, "Download .txt", "none")) {
          const realCreate = URL.createObjectURL, realClick = HTMLAnchorElement.prototype.click;
          const got = [];
          let pending = null;
          URL.createObjectURL = (blob) => { pending = blob; return "blob:render-screener-emr"; };
          HTMLAnchorElement.prototype.click = function () { got.push({ name: this.download, blob: pending }); };
          try { click(dlBtn); } finally { URL.createObjectURL = realCreate; HTMLAnchorElement.prototype.click = realClick; }
          if (c.check(got.length === 1, "/emr/download/count", null, 1, got.length)) {
            c.check(got[0].name === `${masque.fhir.filePrefix}-emr-template-screener.txt`, "/emr/download/name", null, `${masque.fhir.filePrefix}-emr-template-screener.txt`, got[0].name);
            c.check((await got[0].blob.text()) === want(last) && /^text\/plain/.test(got[0].blob.type), "/emr/download/content", { sample: last.id }, "the template, text/plain", got[0].blob.type);
          }
        }
        // Review round 4: Copy and Download take the text as edited in the frame, and leaving the
        // result view discards the edit. A frame loads its srcdoc only inside a document, so the
        // container is attached off screen while the frame's textarea is edited, then detached again.
        {
          const host = document.createElement("div");
          host.style.cssText = "position:fixed;left:-10000px;top:0;width:960px;height:900px;overflow:hidden";
          document.body.appendChild(host);
          host.appendChild(root);
          try {
            const frame = root.querySelector("[data-testid=scr-emr-frame]");
            const ta = frame ? await frameTextarea(frame) : null;
            if (c.check(!!ta, "/emr/edit/frame", { sample: last.id }, "the frame's textarea, loaded from its srcdoc", "none within 10 s")) {
              c.check(ta.value === want(last), "/emr/edit/loaded", { sample: last.id }, "the live textarea holds the template", ta.value.slice(0, 120));
              const edited = `${want(last)}\n${EDIT_MARKER}`;
              ta.value = edited;
              let copied = null;
              await withClipboard(async (x) => { copied = x; }, async () => {
                click(root.querySelector("[data-testid=scr-emr-copy]"));
                await until(() => copied !== null);
              });
              c.check(copied === edited, "/emr/edit/copy", { sample: last.id }, "the edited text (the template plus the marker line)", copied && copied.slice(-120));
              const realCreate = URL.createObjectURL, realClick = HTMLAnchorElement.prototype.click;
              const got = [];
              let pending = null;
              URL.createObjectURL = (blob) => { pending = blob; return "blob:render-screener-emr-edited"; };
              HTMLAnchorElement.prototype.click = function () { got.push({ name: this.download, blob: pending }); };
              try { click(root.querySelector("[data-testid=scr-emr-download]")); } finally { URL.createObjectURL = realCreate; HTMLAnchorElement.prototype.click = realClick; }
              const blobText = got.length === 1 && got[0].blob ? await got[0].blob.text() : null;
              c.check(blobText === edited, "/emr/edit/download", { sample: last.id }, "one download holding the edited text", blobText === null ? `${got.length} downloads` : blobText.slice(-120));
              // Leaving the result view (Back, then See screen result) remounts the panel with the
              // generated text: the edit is gone, as the instruction line says.
              const back = navButton(root, "Back");
              if (c.check(!!back, "/emr/edit/leave/back", null, "the Back button", "none")) {
                click(back);
                c.check(!root.querySelector("[data-testid=scr-emr-frame]"), "/emr/edit/leave/unmounted", null, "no panel outside the result view", "still mounted");
                const fwd = navButton(root, "See screen result");
                if (c.check(!!fwd && !fwd.disabled, "/emr/edit/leave/return", null, "See screen result, enabled", fwd ? "disabled" : "none")) {
                  click(fwd);
                  const again = root.querySelector("[data-testid=scr-emr-frame]");
                  const ta2 = again ? await frameTextarea(again) : null;
                  c.check(!!ta2 && again !== frame && ta2.value === want(last), "/emr/edit/leave/discarded", { sample: last.id }, "a new frame holding the generated template, the edit discarded",
                    ta2 ? ta2.value.slice(-120) : "no textarea");
                }
              }
            }
          } finally { host.remove(); }
        }
        // Closing unmounts; Clear closes it for good.
        click(toggle());
        c.check(!root.querySelector("[data-testid=scr-emr-panel]") && !root.querySelector("iframe") && toggle().getAttribute("aria-expanded") === "false", "/emr/close", null, "unmounted", "still mounted");
        click(toggle());
        c.check(!!root.querySelector("[data-testid=scr-emr-frame]"), "/emr/reopen", null, "mounted", "absent");
        click(root.querySelector("[data-testid=scr-clear]"));
        c.check(!root.querySelector("[data-testid=scr-emr-panel]") && !root.querySelector("iframe"), "/emr/clear", null, "Clear unmounts the panel", "still mounted");
        h.withFixedClock(NOW, () => click(railButtons(root).find((b) => b.dataset.sample === cases[0].id)));
        c.check(!!toggle() && toggle().getAttribute("aria-expanded") === "false" && !root.querySelector("iframe"), "/emr/clear/closed", null, "closed after Clear", toggle() && toggle().getAttribute("aria-expanded"));
      } finally { nm.unmount(); }
      c.note(`EMR Friendly Template: ${cases.length} samples through the open panel; AD15 observed on ${ad15Seen} of ${ad15Pre} result cards`);
    }
    c.check(ad15Pre > 0 && ad15Seen === ad15Pre, "/AD15/@observed", null, "AD15 on every result card compared", `${ad15Seen} of ${ad15Pre}`);

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

    c.note(`AD1 precondition seen: ${sawAD1Pre}, observed: ${sawAD1}; AD7 observed: ${observedAD7}; AD11 observed: ${observedAD11}; AD17 ${ad17Seen} of ${ad17Pre}`);
    c.note("AD8: the baseline panel and the new Research link card occupy the same place in the layout (compared as one region kind); AD12: the tab note is shell chrome and is not compared");
    return c.result();
  }),
};
