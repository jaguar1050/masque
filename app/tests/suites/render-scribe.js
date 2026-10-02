// tests/suites/render-scribe.js — the generic Ambient Scribe against the frozen baseline Scribe
// (design 03 §8.3 `render`, §5.4, §9.9). Owner: WP8.
//
// Parity (done-when 1). The baseline Scribe (tests/baseline/src) and apps/Scribe.jsx with the
// built-in module are mounted side by side in detached containers and driven identically:
// every demo-transcript Step, then the safety review, three suggestion answers, a probe answer
// and one red flag. After every action the textContent of the same regions is compared:
// banner, brand row, the encounter card (transport, transcript, capture tags), the readout,
// the coverage and domain bars, the right card in the Safety, Ask-next and Note views (probe
// rail, suggestions, routing recommendations, note), the about box and the footer. Only AD4
// (release string), AD5 ("re-asking" short label) and AD6 (canonical red-flag wording) are
// normalised; nothing else may differ.
//
// Behaviour (new app only):
//   skip      Skip writes nothing: readout, coverage, note and the published answers unchanged
//   sign      the Sign button is disabled with the outstanding message until the review
//   routing   on a completed screen: no recommendation and no referral ServiceRequest before the
//             review; both after it (routing withheld until review)
//   shape     the data-only fixture (no lexicon, no transcript, no probes): Listen, Play, Step and
//             typed input hidden, the no-lexicon notice shown, no probe rail
//   derive    an injected throwing derive rule: the rule-error card, the note's engine A&P line,
//   routing   a bundle without a referral, onModuleError called (and the same for a throwing
//             routing rule)
//   mic       micAllowed=false disables Listen (when the browser has speech recognition)
// The live microphone (interim/final, stops, lang) is the Playwright `voice` spec.
import React from "react";
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { ad6Pairs } from "../harness/diff.js";

// AD6 before AD5: AD5 applies only when the rest of the string already matches (a whole card
// can carry both).
const ALLOW = ["AD4", "AD6", "AD5"];
const INJECTED = "injected by the render-scribe suite";
const tick = () => new Promise((r) => setTimeout(r, 0));

async function act(fn) {
  flushSync(fn);
  await tick();
}

const txt = (el) => (el ? el.textContent : null);
const all = (root, sel) => [...root.querySelectorAll(sel)];
const buttonByText = (root, scope, re) => all(root, `${scope} button`).find((b) => re.test(b.textContent.trim())) || null;
const rightCard = (root) => all(root, ".grid > .card")[1] || null;
const leftCard = (root) => all(root, ".grid > .card")[0] || null;

const VIEW_RE = { safety: /^Safety/, prompts: /^Ask next/, note: /^Note$/, fhir: /^FHIR$/ };

async function setView(root, view) {
  const b = buttonByText(root, ".btnrow", VIEW_RE[view]);
  if (!b) throw new Error(`view button "${view}" not found`);
  await act(() => b.click());
}

/** The compared regions of one app instance, in the three text views. */
async function snapshot(root) {
  const out = {
    banner: txt(root.querySelector(".banner")),
    brandrow: txt(root.querySelector(".brandrow")),
    encounter: txt(leftCard(root)),
    transcript: txt(root.querySelector(".tsc")),
    captags: all(root, ".tsc .captag").map(txt),
    readout: txt(root.querySelector(".readout")),
    domains: all(root, ".dbar").map(txt),
    about: txt(root.querySelector("details.about")),
    footer: txt(root.querySelector(".foot")),
  };
  for (const v of ["safety", "prompts", "note"]) {
    await setView(root, v);
    out[`view_${v}`] = txt(rightCard(root));
    if (v === "prompts") {
      out.prompts = all(rightCard(root), ".prompt").map(txt);
      out.recs = all(rightCard(root), ".rec").map(txt);
    }
    if (v === "note") out.note = txt(root.querySelector(".note"));
  }
  await setView(root, "safety");
  return out;
}

export default {
  name: "render-scribe",
  owner: "WP8",
  run: guarded("render-scribe", async (h) => {
    const c = collector(h);
    const { module, validation } = await loadMasque(h);
    c.note(validationNote(validation));

    let Scribe;
    try {
      Scribe = (await h.env.loader.importModule(h.appUrl("src/apps/Scribe.jsx"))).default;
    } catch (err) {
      need(false, `waits on WP8: src/apps/Scribe.jsx (${String(err.message).split("\n")[0]})`);
    }
    need(typeof Scribe === "function", "waits on WP8: src/apps/Scribe.jsx has no default export");
    const [scr, scb, bind] = await Promise.all([h.oracle("MASQUE_Screener_v0_3.jsx"), h.oracle("MASQUE_Scribe_v0_3.jsx"), h.engine("bind.js")]);
    const Baseline = scb.default;
    need(typeof Baseline === "function", "baseline Scribe has no default export");

    const short = {};
    for (const it of module.allItems) short[it.id] = it.short ?? it.id;
    const ctx = { AD5: { short }, AD6: ad6Pairs(scb.RED_FLAGS, scr.RED_FLAGS) };
    const seen = new Set();
    let ad5Pre = false;

    // ------------------------------------------------------------------ parity
    const a = h.mount(React.createElement(Baseline));
    const b = h.mount(React.createElement(Scribe, { module }));
    const A = a.container, B = b.container;
    const compare = async (label, input) => {
      const sa = await snapshot(A);
      const sb = await snapshot(B);
      const r = c.diff(sa, sb, { allow: ALLOW, ctx, at: `/${label}`, input });
      for (const id of r.observed) seen.add(id);
      for (const p of sa.prompts || []) {
        const m = /re-asking ([a-z][a-z0-9_]*)/.exec(p);
        if (m && short[m[1]] && short[m[1]] !== m[1]) ad5Pre = true;
      }
      return sb;
    };
    try {
      await compare("initial", { step: 0 });
      const script = module.demo.transcript;
      c.check(script.length === scb.SCRIPT.length, "/script/length", null, scb.SCRIPT.length, script.length);
      for (let i = 0; i < script.length; i++) {
        const sa = buttonByText(A, ".transport", /^Step$/), sb = buttonByText(B, ".transport", /^Step$/);
        if (!c.check(!!sa && !!sb, `/step/${i + 1}/button`, { step: i + 1 }, !!sa, !!sb)) break;
        await act(() => { sa.click(); });
        await act(() => { sb.click(); });
        await compare(`step/${i + 1}`, { step: i + 1, line: script[i] });
      }
      // The safety review.
      for (const root of [A, B]) {
        const r = buttonByText(root, ".btnrow", /none of these apply/);
        if (r) await act(() => r.click());
      }
      await compare("reviewed", { action: "Record: none of these apply" });
      // Three suggestion answers (first option of the first suggestion).
      for (let k = 0; k < 3; k++) {
        for (const root of [A, B]) {
          await setView(root, "prompts");
          const btn = all(rightCard(root), ".prompt").map((p) => p).filter((p) => !p.style.borderLeft).map((p) => p.querySelector(".prow .pbtn"))[0];
          if (btn) await act(() => btn.click());
          await setView(root, "safety");
        }
        await compare(`suggestion/${k + 1}`, { action: "answer the first suggestion with its first option", k });
      }
      // One probe answer (first option of the first probe on the rail).
      for (const root of [A, B]) {
        await setView(root, "prompts");
        const p = all(rightCard(root), ".prompt").find((x) => x.style.borderLeft);
        const btn = p && p.querySelector(".prow .pbtn");
        if (btn) await act(() => btn.click());
        await setView(root, "safety");
      }
      await compare("probe/1", { action: "answer the first probe with its first option" });
      // One red flag, toggled by the clinician (AD6 in the override box, safety list and note).
      const flagId = module.redFlags[0].id;
      const ia = scb.RED_FLAGS.findIndex((f) => f.id === flagId);
      const fa = all(A, ".rf")[ia];
      const fb = B.querySelector(`.rf[data-flag="${flagId}"]`);
      if (c.check(!!fa && !!fb, "/flag/elements", { flagId }, !!fa, !!fb)) {
        await act(() => fa.click());
        await act(() => fb.click());
        await compare("flag", { flagId });
      }
    } finally {
      a.unmount(); b.unmount();
    }
    h.expect("AD4", { precondition: true, observed: seen.has("AD4") });
    h.expect("AD6", { precondition: true, observed: seen.has("AD6") });
    h.expect("AD5", { precondition: ad5Pre, observed: seen.has("AD5") });
    c.note(`parity: ${module.demo.transcript.length} demo steps plus review, 3 answers, 1 probe, 1 flag; ADs observed: ${[...seen].sort().join(", ") || "none"}${ad5Pre ? "" : " (no re-ask shown, AD5 not exercised)"}`);

    // ------------------------------------------------------------------ behaviour (new app only)
    const mountNew = (m, extra = {}) => {
      const log = { screens: [], errors: [], dirty: [] };
      const el = React.createElement(Scribe, {
        module: m,
        onScreen: (s) => log.screens.push(s),
        onModuleError: (e) => log.errors.push(e),
        onDirty: (tab, s) => log.dirty.push(s),
        ...extra,
      });
      return { ...h.mount(el), log };
    };
    const playAll = async (root) => {
      for (;;) {
        const s = buttonByText(root, ".transport", /^Step$/);
        if (!s || s.disabled) break;
        await act(() => s.click());
      }
    };
    const review = async (root) => {
      await setView(root, "safety");
      const r = buttonByText(root, ".btnrow", /none of these apply/);
      if (r) await act(() => r.click());
    };
    /**
     * Answer every remaining suggestion until none is left, towards a settled non-lowest band:
     * a positive item "Yes" (a scale item its highest-factor option), a negative item "No", an
     * info prompt "Yes". (The suggestion pool is the active domains while the screen is not
     * scorable — baseline behaviour, Scb L860 — so a screen can run out of suggestions before
     * it settles; answering towards the top of the scale settles it.)
     */
    const complete = async (root, m) => {
      for (let k = 0; k < 80; k++) {
        await setView(root, "prompts");
        const p = rightCard(root).querySelector(".prompt[data-suggestion]");
        if (!p) break;
        const it = m.itemById[p.getAttribute("data-suggestion")];
        const btns = all(p, ".prow .pbtn").filter((x) => !x.classList.contains("skip"));
        let idx = 0;
        if (it && it.scale) { const fs = it.scale.map((s) => s.f); idx = fs.indexOf(Math.max(...fs)); }
        else if (it && it.w < 0) idx = 1;
        await act(() => btns[idx].click());
      }
      await setView(root, "safety");
    };
    const bundleText = async (root) => { await setView(root, "fhir"); const t = txt(root.querySelector("[data-testid=scribe-bundle]")); await setView(root, "safety"); return t || ""; };
    const noteText = async (root) => { await setView(root, "note"); const t = txt(root.querySelector("[data-testid=scribe-note]")); await setView(root, "safety"); return t || ""; };

    // Skip writes nothing.
    {
      const m = mountNew(module);
      try {
        await playAll(m.container);
        const before = { readout: txt(m.container.querySelector(".readout")), note: await noteText(m.container), answers: JSON.stringify(m.log.screens.at(-1).answers) };
        await setView(m.container, "prompts");
        const first = m.container.querySelector(".prompt[data-suggestion]");
        const id = first && first.getAttribute("data-suggestion");
        const skip = first && first.querySelector("[data-testid=scribe-skip]");
        if (c.check(!!skip, "/skip/button", null, "a Skip button", null)) {
          await act(() => skip.click());
          const after = { readout: txt(m.container.querySelector(".readout")), note: await noteText(m.container), answers: JSON.stringify(m.log.screens.at(-1).answers) };
          c.check(after.readout === before.readout, "/skip/readout", { id }, before.readout, after.readout);
          c.check(after.note === before.note, "/skip/note", { id }, before.note, after.note);
          c.check(after.answers === before.answers, "/skip/answers", { id }, before.answers, after.answers);
          await setView(m.container, "prompts");
          c.check(!m.container.querySelector(`.prompt[data-suggestion="${id}"]`), "/skip/hidden", { id }, "skipped prompt hidden", "still shown");
        }
      } finally { m.unmount(); }
    }

    // Sign gate, and routing withheld until review (on a completed screen).
    {
      const m = mountNew(module);
      try {
        await playAll(m.container);
        await complete(m.container, module);
        const snap = m.log.screens.at(-1);
        c.note(`completed screen: scorable ${snap.scorable}, band ${snap.band}, coverage ${snap.coverage}%`);
        await setView(m.container, "note");
        const sign = m.container.querySelector("[data-testid=scribe-sign]");
        c.check(!!sign && sign.disabled, "/sign/before-review/disabled", null, true, sign && sign.disabled);
        c.check(!!m.container.querySelector("[data-testid=scribe-sign-blocked]"), "/sign/before-review/message", null, "blocked message", null);
        await setView(m.container, "prompts");
        c.check(!m.container.querySelector("[data-testid=scribe-recs]"), "/routing/before-review/recs", null, "no recommendations", txt(m.container.querySelector("[data-testid=scribe-recs]")));
        const b0 = await bundleText(m.container);
        c.check(!/Referral:/.test(b0), "/routing/before-review/referral", null, "no referral ServiceRequest", "referral present");
        c.check((await noteText(m.container)).includes("Safety review not recorded — no screening routing issued."), "/routing/before-review/note", null, "A&P gate line", null);
        await review(m.container);
        await setView(m.container, "note");
        const sign2 = m.container.querySelector("[data-testid=scribe-sign]");
        c.check(!!sign2 && !sign2.disabled, "/sign/after-review/enabled", null, false, sign2 && sign2.disabled);
        const snap2 = m.log.screens.at(-1);
        c.check(snap2.safetyReviewed === true && snap2.routingCleared === true, "/routing/after-review/snapshot", null, { safetyReviewed: true, routingCleared: true }, { safetyReviewed: snap2.safetyReviewed, routingCleared: snap2.routingCleared });
        if (snap2.scorable && snap2.band !== "low") {
          await setView(m.container, "prompts");
          c.check(all(m.container, "[data-testid=scribe-recs] .rec").length > 0, "/routing/after-review/recs", null, "recommendations", "none");
          c.check(/Referral:/.test(await bundleText(m.container)), "/routing/after-review/referral", null, "referral ServiceRequest", "none");
        } else {
          c.note("routing after review not exercised: the completed screen is not scorable with a non-lowest band");
        }
      } finally { m.unmount(); }
    }

    // Fail closed: a throwing derive rule, then a throwing routing rule.
    const throwing = () => { throw new Error(INJECTED); };
    const L = module.logic;
    const variants = [
      { name: "derive", family: "phenotype", logic: { ...L, phenotypes: { ...L.phenotypes, derive: [{ id: "suite-derive", value: (L.phenotypes.derive[0] || {}).value, when: throwing }, ...L.phenotypes.derive] } } },
      { name: "routing", family: "routing", logic: { ...L, routing: [{ id: "suite-routing", when: throwing, copy: { screener: { h: "x", p: "x", chips: [] }, scribe: { h: "x", p: "x", chips: [] } } }, ...L.routing] } },
    ];
    for (const v of variants) {
      const bad = await bind.bindModule(module.rubric, v.logic, { origin: "builtin", classification: "builtin", key: `fixture:throwing-${v.name}`, sources: module.sources });
      const m = mountNew(bad);
      const at = `/fail-closed/${v.name}`;
      try {
        await playAll(m.container);
        await complete(m.container, module);
        await review(m.container);
        const snap = m.log.screens.at(-1);
        c.check(snap.scorable === true, `${at}/scorable`, null, true, snap.scorable);
        await setView(m.container, "prompts");
        const card = m.container.querySelector('[data-rec="engine:rule-error"]');
        c.check(!!card && txt(card).includes(`failed (${INJECTED})`), `${at}/card`, null, "the rule-error card", txt(m.container.querySelector("[data-testid=scribe-recs]")));
        c.check(all(m.container, "[data-testid=scribe-recs] .rec").length === 1, `${at}/only-card`, null, 1, all(m.container, "[data-testid=scribe-recs] .rec").length);
        const note = await noteText(m.container);
        c.check(note.includes(`  • Module rule error — no routing issued: rule "suite-${v.name}" in module ${bad.id} failed (${INJECTED}).`), `${at}/note`, null, "the engine A&P line", note.split("ASSESSMENT & PLAN")[1]);
        c.check(!note.includes(bad.copy.note.noDriver), `${at}/note-no-driver`, null, "no noDriver line", "present");
        const bt = await bundleText(m.container);
        c.check(!/Referral:/.test(bt), `${at}/referral`, null, "no referral ServiceRequest", "referral present");
        c.check(bt.includes(`Screening routing withheld: module rule \\"suite-${v.name}\\" failed`) || bt.includes(`Screening routing withheld: module rule "suite-${v.name}" failed`), `${at}/observation-note`, null, "withheld-routing note", null);
        c.check(m.log.errors.some((e) => e.family === v.family && e.message === INJECTED), `${at}/onModuleError`, null, v.family, m.log.errors);
      } finally { m.unmount(); }
    }

    // The data-only shape fixture: no lexicon → no transport, the notice; no probes.
    {
      const { module: shape } = await h.loadFixture("shape", { builtins: [module], loaded: [module] });
      const m = mountNew(shape);
      try {
        const q = (id) => m.container.querySelector(`[data-testid=${id}]`);
        c.check(!shape.lexicon, "/shape/lexicon", null, null, !!shape.lexicon);
        for (const id of ["scribe-listen", "scribe-play", "scribe-step", "scribe-input", "scribe-capture"]) c.check(!q(id), `/shape/${id}`, null, "hidden", "shown");
        c.check(!!q("scribe-reset"), "/shape/reset", null, "Reset shown", "hidden");
        c.check(!!q("scribe-no-lexicon") && txt(q("scribe-no-lexicon")).includes("This module has no extraction lexicon"), "/shape/notice", null, "no-lexicon notice", txt(q("scribe-no-lexicon")));
        await setView(m.container, "prompts");
        c.check(!q("scribe-probes"), "/shape/probes", null, "no probe rail", "shown");
        c.check(all(m.container, ".prompt[data-suggestion]").length > 0, "/shape/suggestions", null, "suggestions", 0);
        c.check(txt(q("scribe-footer")).includes("extraction lexicon — · probe set —"), "/shape/footer", null, "lexicon and probe set —", txt(q("scribe-footer")));
        c.check(!!q("provenance-badge"), "/shape/badge", null, "provenance badge near the readout", null);
      } finally { m.unmount(); }
    }

    // micAllowed=false disables Listen.
    {
      const m = mountNew(module, { micAllowed: false });
      try {
        const listen = m.container.querySelector("[data-testid=scribe-listen]");
        c.check(!!listen && listen.disabled, "/mic/disabled", null, true, listen && listen.disabled);
        const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        if (supported && window.isSecureContext !== false) {
          c.check(listen.title === "The microphone is off while a patient-facing view is shown.", "/mic/title", null, "mic-off title", listen.title);
        } else c.note("mic: this browser has no speech recognition here; the disabled title is the unsupported one");
      } finally { m.unmount(); }
    }

    return c.result();
  }),
};
