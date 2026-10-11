// tests/suites/render-scribe.js — the generic Ambient Scribe against the frozen baseline Scribe
// (design 03 §8.3 `render`, §5.4, §9.9). Owner: WP8.
//
// Parity (done-when 1). The baseline Scribe (tests/baseline/src) and apps/Scribe.jsx with the
// built-in module on its 0.3.1-equivalent lexicon (design 05 §7.1, §7.3: revertLexiconDelta of
// the shipped lexicon and tests/harness/lexicon-delta.js, the exact inverse the values suite
// proves) are mounted side by side in detached containers and driven identically:
// every demo-transcript Step, then the safety review, three suggestion answers, a probe answer
// and one red flag. After every action the textContent of the same regions is compared:
// banner, brand row, the encounter card (transport, transcript, capture tags), the readout,
// the coverage and domain bars, the right card in the Safety, Ask-next and Note views (probe
// rail, suggestions, routing recommendations, note), the about box and the footer. Only AD4
// (release string), AD5 ("re-asking" short label) and AD6 (canonical red-flag wording) are
// normalised; nothing else may differ. No heard tag or card can appear there: the reverted
// lexicon has no `heard` field, so the footer reads "extraction lexicon 0.3.1" as the baseline's.
//
// Behaviour (new app only, on the shipped module):
//   skip      Skip writes nothing: readout, coverage, note and the published answers unchanged
//             (the first suggestion may be a heard card: it is a .prompt[data-suggestion])
//   sign      the Sign button is disabled with the outstanding message until the review
//   routing   on a completed screen: no recommendation and no referral ServiceRequest before the
//             review; both after it (routing withheld until review)
//   shape     the data-only fixture (no lexicon, no transcript, no probes): Listen, Play, Step and
//             typed input hidden, the no-lexicon notice shown, no probe rail, no heard group
//   derive    an injected throwing derive rule: the rule-error card, the note's engine A&P line,
//   routing   a bundle without a referral, onModuleError called (and the same for a throwing
//             routing rule)
//   mic       micAllowed=false disables Listen (when the browser has speech recognition)
//   referral  (release 0.4.5) the module's clinician rules reach the Scribe's EMR template: on a
//             fixture copy whose clinician rule names every phenotype, with a probe answered, the
//             template prints the rule block right after the consultant placeholders, its referral
//             and reason lines are the bundle's, the referral is the module data's destination for
//             the derived picture (a recorded probe answer changes nothing: no escalation), and no
//             line names an escalation or an evidence
//
// Heard / carry-over / yield (design 05 §7.3 blocks 1-9), each on the shipped module rebound with
// its own demo transcript and driven by Step (typed input where the block says so):
//   heard     one dashed heard tag, no capture tag, no answer, readout and coverage unchanged; the
//             heard card in Ask next, its item suggested exactly once, the view count includes it
//   order     Safety probes, then the heard card, then the Re-ask probe and every other suggestion
//   carry     the reported case (design 05 §3.7 row 1): the value arrives via carry on the fourth
//             turn, tagged "follow-up to"
//   carry-md  (review F3, tests; gold d071) [heard, "ok", physician question, "a few hours"]: the
//             physician turn sits between a used reply and the last allowed one, so the value
//             carries (answer 2, "follow-up to “dizzy”") only if it consumes nothing
//   expiry    two replies without a value: no answer, the heard card stays
//   skip      Skip on the heard card: no answer, no card, no carry
//   R5        (round 2, review UI-1; gold d072) the attack-duration line scores its entry on its
//             own, but not after a heard cue whose card was skipped or answered: the yield lasts
//             the rest of the reply window and nothing is carried into the closed item. Each
//             block asserts that its last line was ingested (line count and bubble text), and
//             the answer uses an option other than the one a carry of that line would give
//             (round 3, review T6)
//   R5 reach  (round 3, review T1) the yield lasts the WHOLE reply window, not only the first
//             reply: [heard, Skip, "ok", attack line] and [heard, answer, "ok", attack line]
//             leave the attack duration unanswered; the d072 sequence (answered on line 1,
//             re-armed by a heard cue on line 2, attack line 3) through this Scribe leaves it
//             unanswered; the expiry control [heard, Skip, "ok", "fine", attack line] scores it
//             again, because the window has closed
//   R3b       (round 3b, design 05 §13.10; gold d086) a line whose duration is withheld ("split
//             second" and "hours" disagree) arms a yield-only slot: the attack line that follows
//             leaves the attack duration unanswered (round 3 scored it), nothing is carried into
//             the heard item, which keeps its heard tag on line 1 and its card; line count and
//             bubble texts asserted
//   answer    the heard card's own buttons write the answer; the card goes, the bubble tag stays
//   reset     Reset clears the pending slot: a later bare duration captures nothing
//   F4        the yielding entry is not captured when the entry it yields to is named
//   demo      the whole shipped demo: answers, readout and coverage equal the 0.3.1-lexicon walk;
//             exactly one heard tag (demo line 7) and its heard card; the shipped footer reads
//             instrument 0.2 · extraction lexicon 0.3.2 · probe set 1.0.0, gold set not "not
//             re-run" (review F5, tests)
// The live microphone (interim/final, stops, lang, the interim carry preview) is the Playwright
// `voice` spec.
//
// Release 0.4.3 (the EMR Friendly Template): the Note view holds one more button, right after Sign
// to chart, which AD15 alone excuses in the parity snapshots (h.expect at every Note view). On the
// new app only: the button's label and place, nothing mounted and no iframe until it is opened;
// the panel's instruction line, the iframe (sandbox "allow-same-origin", its title, no script); a
// srcdoc equal to emrFrameDoc(buildEmrTemplate(...)) for the encounter's state before the review
// (the template withholds routing as the encounter note does while Sign is blocked), after it,
// after an exam probe answered by the clinician (recorded, never shown as a finding) and after a
// red flag marked by the clinician ("Source: marked by clinician.", routing withheld); Copy through
// the clipboard (stubbed) with the success and failure toasts; Download of
// <filePrefix>-emr-template-scribe.txt; with the container attached off screen (review round 4),
// the frame's live textarea holds the template, an edit typed into it (a marker line) is what Copy
// and Download take, and leaving the Note view remounts the frame with the generated text; close,
// reopen and Reset.
import React from "react";
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { ad6Pairs, revertLexiconDelta } from "../harness/diff.js";
import { LEXICON_DELTA } from "../harness/lexicon-delta.js";

// AD6 before AD5: AD5 applies only when the rest of the string already matches (a whole card
// can carry both). AD15 (release 0.4.3, the EMR Friendly Template button after Sign to chart)
// applies only to the Note view and also needs the rest to match, so it follows AD4 and AD6.
const ALLOW = ["AD4", "AD6", "AD15", "AD5"];
const INJECTED = "injected by the render-scribe suite";
const tick = () => new Promise((r) => setTimeout(r, 0));

// Design 05 §2.1 (wording approved 2026-10-04) and §7.3. The heard item of the shipped module and
// the exact strings its tags and cards show.
const HEARD_ID = "v_vertigo";
const DIZZY = "I'm feeling really dizzy";
const HEARD_TAG = "heard “dizzy” · episode duration: not stated";
const HEARD_CARD_TAG = "VM-PATHI · disequilibrium · heard “dizzy”";
const HEARD_GROUP = "Heard · named by the patient, value not stated — nothing is recorded until it is answered";
const VALUE_TAG = "+ episode duration: 5 min – 72 h";
// §3.7 row 1 under the approved 0.3.2 vocabulary: turn 2 contains the approved cue "world is
// moving", which is heard again and re-arms the slot with that cue, so the carry names it (not
// "dizzy" as in the §7.3 draft). answers.v_vertigo is 2 either way.
const ROW1 = [
  ["pt", DIZZY],
  ["pt", "as if the world is moving around me and I'm sitting still"],
  ["md", "How long does it last?"],
  ["pt", "a few hours"],
];
const ROW1_CARRY_TAG = "+ episode duration: 5 min – 72 h · follow-up to “world is moving”";
const ROW1_HEARD_TAG_2 = "heard “world is moving” · episode duration: not stated";
// Review F3 (tests), gold d071: a physician turn between a used reply ("ok", refused no-band) and
// the last allowed reply. Had the physician turn consumed a reply, the window would be closed by
// the fourth line and nothing would carry.
const MD_BETWEEN = [
  ["pt", DIZZY],
  ["pt", "ok"],
  ["md", "How long does it last?"],
  ["pt", "a few hours"],
];
const DIZZY_CARRY_TAG = "+ episode duration: 5 min – 72 h · follow-up to “dizzy”";
// Round 2 R5 (review UI-1), gold d072: the attack-duration entry keeps yielding to the heard item
// for the rest of its reply window after the heard card is skipped or answered.
const YIELDING_ID = "m_dur";
const ATTACK_LINE = "it lasts a couple of hours";
// Review T1 (round 3), gold d072 run through this Scribe: the heard item is answered on line 1,
// line 2 hears its cue again (re-arming the slot; the heard tag is dropped because the item is
// answered), line 3 is the attack-duration line, read with { carry: false }.
const D072 = [
  ["pt", "The dizziness lasts a few seconds"],
  ["pt", "I feel dizzy again"],
  ["pt", ATTACK_LINE],
];
// Round 3b (design 05 §13.10), gold d086: the first line states two durations that disagree, so the
// heard item is heard with no value and no carry-over opens; it arms a yield-only slot, which keeps
// the attack-duration entry yielding on the next line and is never carried into. Round 3 left no
// slot here and recorded the attack duration as Under 4 h.
const WITHHELD_LINE = "It hit me in a split second and the spinning lasted for hours";
const WITHHELD_YIELD = [
  ["pt", WITHHELD_LINE],
  ["pt", ATTACK_LINE],
];
const WITHHELD_HEARD_TAG = "heard “spinning” · episode duration: not stated";
// The heard card's option used by the answer blocks (review T6): option 1, whose value differs
// from the value a carry of ATTACK_LINE would give (2), so an overwrite by a carry would show.
const ANSWER_OPTION = 1;
// Review F5 (tests): the shipped footer names the five version axes' owners unchanged except the
// lexicon (design 05 §6: instrument 0.2 and probe set 1.0.0 unchanged, lexicon 0.3.1 → 0.3.2).
const SHIPPED_FOOTER_VERSIONS = "instrument 0.2 · extraction lexicon 0.3.2 · probe set 1.0.0";

async function act(fn) {
  flushSync(fn);
  await tick();
}

/** Swap navigator.clipboard.writeText for `fn` while `body` runs (release 0.4.3, the EMR panel's Copy). */
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

/** The marker line the round-4 edit check appends to the template in the frame. */
const EDIT_MARKER = "render-scribe edit marker: typed into the frame";
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
    const EMR_BUTTON = "EMR Friendly Template";
    const ctx = { AD5: { short }, AD6: ad6Pairs(scb.RED_FLAGS, scr.RED_FLAGS), AD15: { text: [["Sign to chart", ` ${EMR_BUTTON}`]] } };
    const seen = new Set();
    let ad5Pre = false, ad15Pre = 0, ad15Seen = 0;

    // ------------------------------------------------------------------ parity
    // Subject: the generic Scribe + the 0.3.1-equivalent data (design 05 §7.1). The 0.3.2
    // behaviour is proven by the blocks below, by AD13 and by the capture suite.
    // When the revert fails (FAIL at /parity/lexicon031) the parity still runs, on the shipped
    // module, so the differences that follow show what the unreverted data changes.
    const lex031 = revertLexiconDelta(module.rubric.lexicon, LEXICON_DELTA);
    const has031 = c.check(lex031 !== null, "/parity/lexicon031",
      { delta: `${LEXICON_DELTA.from} → ${LEXICON_DELTA.to}`, shipped: module.rubric.lexicon && module.rubric.lexicon.version },
      "the shipped lexicon is exactly 0.3.1 + LEXICON_DELTA (or 0.3.1 itself)", null);
    const module031 = has031
      ? await bind.bindModule({ ...module.rubric, lexicon: lex031 }, module.logic,
        { origin: "builtin", classification: "builtin", key: "fixture:masque-lexicon-0.3.1",
          sources: { rubricText: null, logicText: module.sources.logicText } })
      : module;
    const a = h.mount(React.createElement(Baseline));
    const b = h.mount(React.createElement(Scribe, { module: module031 }));
    const A = a.container, B = b.container;
    const compare = async (label, input) => {
      const sa = await snapshot(A);
      const sb = await snapshot(B);
      const r = c.diff(sa, sb, { allow: ALLOW, ctx, at: `/${label}`, input });
      for (const id of r.observed) seen.add(id);
      // Release 0.4.3: the Note view always carries the EMR Friendly Template button; AD15 must excuse it there.
      if ((sb.view_note || "").includes(`Sign to chart ${EMR_BUTTON}`)) { ad15Pre++; if (r.observed.has("AD15")) ad15Seen++; }
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
    h.expect("AD15", { precondition: ad15Pre > 0, observed: ad15Pre > 0 && ad15Seen === ad15Pre });
    c.check(ad15Pre > 0 && ad15Seen === ad15Pre, "/AD15/@observed", null, "AD15 at every Note view compared", `${ad15Seen} of ${ad15Pre}`);
    c.note(`parity: ${module.demo.transcript.length} demo steps plus review, 3 answers, 1 probe, 1 flag; ADs observed: ${[...seen].sort().join(", ") || "none"}${ad5Pre ? "" : " (no re-ask shown, AD5 not exercised)"}`);
    c.note(has031
      ? `parity subject: extraction lexicon ${lex031.version} (${lex031 === module.rubric.lexicon ? "the shipped lexicon itself, no delta landed" : `revertLexiconDelta of the shipped ${module.rubric.lexicon.version}`})`
      : "parity subject: the shipped lexicon (revertLexiconDelta failed)");

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

    // EMR Friendly Template (release 0.4.3), on the shipped module: the button right after Sign to
    // chart, the panel and its frame, the text equal to buildEmrTemplate for the encounter's state
    // through review, an exam probe and a clinician-marked red flag, Copy, Download, close and Reset.
    {
      const [emr, policy] = await Promise.all([h.engine("emr.js"), h.engine("policy.js")]);
      const UI = emr.EMR_UI;
      const m = mountNew(module);
      const root = m.container;
      const q = (id) => root.querySelector(`[data-testid=${id}]`);
      const toastText = () => txt(q("scribe-toast")) || "";
      const frameText = () => {
        const f = q("scribe-emr-frame");
        if (!f) return null;
        const ta = new DOMParser().parseFromString(f.getAttribute("srcdoc") || "", "text/html").querySelector("textarea");
        return ta ? ta.value : null;
      };
      // The encounter's red flags, by source: ambient capture ("nlp") unless this block set them.
      const rf = {};
      const syncFlags = (how) => {
        const pts = (m.log.screens.at(-1) || {}).redFlags || [];
        for (const f of module.redFlags) if (pts.includes(f.points) && !rf[f.id]) rf[f.id] = how;
        for (const id of Object.keys(rf)) if (!pts.includes(module.flagById[id].points)) delete rf[id];
      };
      const probeAns = {};
      let reviewed = false;
      const want = () => {
        const snap = m.log.screens.at(-1) || {};
        return emr.buildEmrTemplate(module, { answers: snap.answers, ctx: snap.ctx, rf: { ...rf }, safetyReviewed: reviewed, probeAns: { ...probeAns }, vmp: {}, appVersion: policy.APP_VERSION }, { surface: "scribe" });
      };
      const compareText = async (at) => {
        await setView(root, "note");
        const f = q("scribe-emr-frame");
        if (!c.check(!!f, `${at}/frame`, null, "the panel open in the Note view", "closed")) return "";
        const w = want();
        c.check(f.getAttribute("srcdoc") === emr.emrFrameDoc(w), `${at}/srcdoc`, null, "emrFrameDoc(buildEmrTemplate(module, encounter, scribe))", (f.getAttribute("srcdoc") || "").slice(0, 160));
        const got = frameText() || "";
        c.diff(w.split("\n"), got.split("\n"), { at: `${at}/text` });
        const lines = got.split("\n");
        c.check(lines[0] === policy.CAVEATS.prototype && lines[lines.length - 1] === policy.CAVEATS.prototype, `${at}/marker`, null, "the marker first and last", [lines[0], lines[lines.length - 1]]);
        return got;
      };
      try {
        await playAll(root);
        syncFlags("nlp");
        await setView(root, "note");
        const sign = q("scribe-sign"), t = q("scribe-emr-toggle");
        if (c.check(!!t, "/emr/toggle", null, "the EMR Friendly Template button", "none")) {
          c.check(txt(t).trim() === UI.button && t.tagName === "BUTTON" && t.className === "act ghost", "/emr/toggle/label", null, `button.act.ghost "${UI.button}"`, `${t.tagName.toLowerCase()}.${t.className} "${txt(t).trim()}"`);
          c.check(!!sign && sign.nextElementSibling === t, "/emr/toggle/place", null, "right after Sign to chart", sign && sign.nextElementSibling && txt(sign.nextElementSibling));
          c.check(t.getAttribute("aria-expanded") === "false" && !q("scribe-emr-panel") && !root.querySelector("iframe"), "/emr/closed", null, "closed: no panel, no iframe", "mounted");
          await act(() => t.click());
          const panel = q("scribe-emr-panel"), f = q("scribe-emr-frame");
          c.check(t.getAttribute("aria-expanded") === "true" && !!panel && !!f, "/emr/open", null, "panel and frame mounted", { panel: !!panel, frame: !!f });
          if (panel && f) {
            c.check(txt(panel.querySelector(".sa-scribe-emr-hint")) === `${UI.instruction} ${UI.regeneratesScribe}`, "/emr/hint", null, `${UI.instruction} ${UI.regeneratesScribe}`, txt(panel.querySelector(".sa-scribe-emr-hint")));
            c.check(f.tagName === "IFRAME" && f.getAttribute("sandbox") === "allow-same-origin" && f.getAttribute("title") === UI.frameTitle, "/emr/frame/attributes", null,
              { sandbox: "allow-same-origin", title: UI.frameTitle }, { sandbox: f.getAttribute("sandbox"), title: f.getAttribute("title") });
            c.check(!/<script/i.test(f.getAttribute("srcdoc") || ""), "/emr/frame/no-script", null, "no script in the frame document", "a <script");
            c.diff([UI.copy, UI.download], all(panel, "button").map((b) => txt(b).trim()), { at: "/emr/buttons" });
          }
          // Before the review: the same outstanding state as the encounter note and the blocked Sign button.
          const before = await compareText("/emr/before-review");
          if (!Object.keys(rf).length) {
            c.check(before.split("\n").includes("Safety review not recorded — no screening routing issued.") && (await noteText(root)).includes("Safety review not recorded — no screening routing issued."),
              "/emr/before-review/gate", null, "the template and the encounter note both withhold routing", before.split("\n").filter((l) => /review/i.test(l)));
          }
          await setView(root, "note");
          c.check(!!q("scribe-sign-blocked") && q("scribe-sign").disabled, "/emr/before-review/sign-blocked", null, "Sign blocked while the template says the review is outstanding", null);
          await review(root);
          reviewed = true;
          syncFlags("nlp");
          const after = await compareText("/emr/after-review");
          if (!Object.keys(rf).length) c.check(after.split("\n").includes("Red-flag review completed; none present."), "/emr/after-review/line", null, "Red-flag review completed; none present.", null);
          // An exam probe answered by the clinician: recorded, never presented as a finding.
          await setView(root, "prompts");
          const kindOf = new Map(((module.logic.probes || {}).list || []).map((p) => [String(p.id), p]));
          const examEl = all(root, "[data-probe]").find((el) => (kindOf.get(el.getAttribute("data-probe")) || {}).kind === "exam");
          if (examEl) {
            const pid = examEl.getAttribute("data-probe");
            await act(() => examEl.querySelector(".prow .pbtn").click());
            probeAns[pid] = 0;
            syncFlags("probe");
            const got = await compareText(`/emr/exam/${pid}`);
            const row = ((module.emrTemplate || {}).examRows || []).find((r) => r.probe === pid);
            if (row) {
              const opt = kindOf.get(pid).opts[0];
              const line = got.split("\n").find((l) => l.startsWith(`${row.label}: [ ]`));
              c.check(!!line && line.includes("(recorded by clinician via probe: ") && line.includes(opt.l), `/emr/exam/${pid}/line`, { probe: pid, option: 0 },
                `${row.label}: [ ] (recorded by clinician via probe: ${opt.l}…)`, line);
            }
          } else c.note("EMR: no exam probe was live after the demo; the probe line is covered by the emr suite");
          // A red flag marked by the clinician: its module action, its source, routing withheld.
          const flag = module.redFlags.find((f) => !rf[f.id]);
          await setView(root, "safety");
          const fe = root.querySelector(`.rf[data-flag="${flag.id}"]`);
          if (c.check(!!fe, "/emr/flag/element", { flag: flag.id }, "the flag row", "none")) {
            await act(() => fe.click());
            rf[flag.id] = "md";
            syncFlags("nlp");
            const got = await compareText("/emr/flag");
            const lines = got.split("\n");
            c.check(lines.includes(`- ${flag.action} (${flag.points}). Source: marked by clinician.`), "/emr/flag/line", { flag: flag.id }, `- ${flag.action} (${flag.points}). Source: marked by clinician.`, lines.filter((l) => l.startsWith(`- ${flag.action}`)));
            // Release 0.4.6: a referral line or the references only under the heading that says the
            // FHIR bundle withholds the referral (the text itself equals buildEmrTemplate, checked above).
            const also = lines.indexOf("Screen-based referral and references (the FHIR bundle withholds the referral while a red flag is open):");
            const after = (re) => lines.every((l, i) => !re.test(l) || (also >= 0 && i > also));
            c.check(lines.includes("Screening routing withheld — red flag present") && also > lines.indexOf("Screening routing withheld — red flag present")
                && after(/^Referral: /) && after(/^Empiric treatment references /),
              "/emr/flag/withheld", { flag: flag.id }, "routing withheld; a referral line or references only under the 0.4.6 heading", lines.filter((l) => /^Referral|^Empiric|withheld|^Screen-based/.test(l)));
          }
          // Copy and Download.
          await setView(root, "note");
          const w = want();
          let copied = null;
          await withClipboard(async (x) => { copied = x; }, async () => {
            await act(() => q("scribe-emr-copy").click());
            for (let i = 0; i < 40 && !toastText().includes(UI.copied); i++) await tick();
          });
          c.check(copied === w && toastText().includes(UI.copied), "/emr/copy", null, "the template copied, with the toast", { copied: copied && copied.slice(0, 80), toast: toastText() });
          await withClipboard(async () => { throw new Error("refused by the render-scribe suite"); }, async () => {
            await act(() => q("scribe-emr-copy").click());
            for (let i = 0; i < 40 && !toastText().includes(UI.copyFailed); i++) await tick();
          });
          c.check(toastText().includes(UI.copyFailed), "/emr/copy/failure-toast", null, UI.copyFailed, toastText());
          const realCreate = URL.createObjectURL, realClick = HTMLAnchorElement.prototype.click;
          const saved = [];
          let pending = null;
          URL.createObjectURL = (blob) => { pending = blob; return "blob:render-scribe-emr"; };
          HTMLAnchorElement.prototype.click = function () { saved.push({ name: this.download, blob: pending }); };
          try { await act(() => q("scribe-emr-download").click()); } finally { URL.createObjectURL = realCreate; HTMLAnchorElement.prototype.click = realClick; }
          if (c.check(saved.length === 1, "/emr/download/count", null, 1, saved.length)) {
            c.check(saved[0].name === `${module.fhir.filePrefix}-emr-template-scribe.txt`, "/emr/download/name", null, `${module.fhir.filePrefix}-emr-template-scribe.txt`, saved[0].name);
            c.check((await saved[0].blob.text()) === w && /^text\/plain/.test(saved[0].blob.type), "/emr/download/content", null, "the template, text/plain", saved[0].blob.type);
          }
          // Review round 4: Copy and Download take the text as edited in the frame, and leaving the
          // Note view discards the edit. A frame loads its srcdoc only inside a document, so the
          // container is attached off screen while the frame's textarea is edited, then detached again.
          {
            const host = document.createElement("div");
            host.style.cssText = "position:fixed;left:-10000px;top:0;width:960px;height:900px;overflow:hidden";
            document.body.appendChild(host);
            host.appendChild(root);
            try {
              const frame = q("scribe-emr-frame");
              const ta = frame ? await frameTextarea(frame) : null;
              if (c.check(!!ta, "/emr/edit/frame", null, "the frame's textarea, loaded from its srcdoc", "none within 10 s")) {
                c.check(ta.value === w, "/emr/edit/loaded", null, "the live textarea holds the template", ta.value.slice(0, 120));
                const edited = `${w}\n${EDIT_MARKER}`;
                ta.value = edited;
                let copiedEdit = null;
                await withClipboard(async (x) => { copiedEdit = x; }, async () => {
                  await act(() => q("scribe-emr-copy").click());
                  for (let i = 0; i < 40 && copiedEdit === null; i++) await tick();
                });
                c.check(copiedEdit === edited, "/emr/edit/copy", null, "the edited text (the template plus the marker line)", copiedEdit && copiedEdit.slice(-120));
                const realCreate2 = URL.createObjectURL, realClick2 = HTMLAnchorElement.prototype.click;
                const got = [];
                let pending2 = null;
                URL.createObjectURL = (blob) => { pending2 = blob; return "blob:render-scribe-emr-edited"; };
                HTMLAnchorElement.prototype.click = function () { got.push({ name: this.download, blob: pending2 }); };
                try { await act(() => q("scribe-emr-download").click()); } finally { URL.createObjectURL = realCreate2; HTMLAnchorElement.prototype.click = realClick2; }
                const blobText = got.length === 1 && got[0].blob ? await got[0].blob.text() : null;
                c.check(blobText === edited, "/emr/edit/download", null, "one download holding the edited text", blobText === null ? `${got.length} downloads` : blobText.slice(-120));
                // Leaving the Note view and coming back remounts the panel with the generated text:
                // the edit is gone, as the instruction line says.
                await setView(root, "prompts");
                c.check(!q("scribe-emr-frame"), "/emr/edit/leave/unmounted", null, "no panel outside the Note view", "still mounted");
                await setView(root, "note");
                const again = q("scribe-emr-frame");
                const ta2 = again ? await frameTextarea(again) : null;
                c.check(!!ta2 && again !== frame && ta2.value === want(), "/emr/edit/leave/discarded", null, "a new frame holding the generated template, the edit discarded",
                  ta2 ? ta2.value.slice(-120) : "no textarea");
              }
            } finally { host.remove(); }
          }
          // Close, reopen, Reset.
          await act(() => q("scribe-emr-toggle").click());
          c.check(!q("scribe-emr-panel") && !root.querySelector("iframe"), "/emr/close", null, "unmounted", "mounted");
          await act(() => q("scribe-emr-toggle").click());
          c.check(!!q("scribe-emr-frame"), "/emr/reopen", null, "mounted", "absent");
          await act(() => q("scribe-reset").click());
          await setView(root, "note");
          c.check(!q("scribe-emr-panel") && !root.querySelector("iframe") && q("scribe-emr-toggle") && q("scribe-emr-toggle").getAttribute("aria-expanded") === "false",
            "/emr/reset", null, "Reset closes the panel", "still open");
        }
      } finally { m.unmount(); }
    }

    // Release 0.4.5: the module's clinician rules (phenotypes.referral.clinicianRules) reach the
    // Scribe's EMR template, and a recorded probe answer never changes the referral. A fixture copy of
    // the module (test data, not clinical content) whose clinician rule names every phenotype makes
    // the block observable whatever picture the encounter derives; the shipped rule's own text is
    // the emr suite's.
    {
      const probeList0 = (module.logic.probes || {}).list || [];
      const byId0 = new Map(probeList0.map((p) => [String(p.id), p]));
      // the first probe on an empty encounter's rail whose first option raises no flag (so routing stays open)
      const scratch = await bind.bindModule({ ...module.rubric, demo: { ...module.rubric.demo, transcript: [] } }, module.logic,
        { origin: "builtin", classification: "builtin", key: "fixture:render-scribe-referral-scratch", sources: module.sources });
      let pid = null;
      {
        const s = mountNew(scratch);
        try {
          await setView(s.container, "prompts");
          const el = all(s.container, "[data-probe]").find((x) => { const p = byId0.get(x.getAttribute("data-probe")); return p && p.kind !== "safety" && !(p.opts[0] || {}).rf; });
          pid = el ? el.getAttribute("data-probe") : null;
        } finally { s.unmount(); }
      }
      if (c.check(!!pid, "/referral045/probe", null, "a probe on the rail of an empty encounter whose first option raises no flag", null)) {
        const FX = {
          phenotypes: module.phenotypes.values.map((v) => v.value),
          source: "Fixture source, 2026-10-07",
          rule: "Fixture rule text.",
          definition: ["Fixture definition line."],
          clarificationSource: "Fixture source, 2026-10-09",
          clarification: ["Fixture clarification line."],
          confirm: ["Fixture condition"],
        };
        const FX_BLOCK = ["Referral rule (Fixture source, 2026-10-07): Fixture rule text.", "Definition (Fixture source, 2026-10-07):", "Fixture definition line.",
          "Clarification (Fixture source, 2026-10-09):", "Fixture clarification line.", "Fixture condition: [ ]"];
        const referral = { ...module.rubric.phenotypes.referral, clinicianRules: [FX] };
        const fx = await bind.bindModule({ ...module.rubric, phenotypes: { ...module.rubric.phenotypes, referral }, demo: { ...module.rubric.demo, transcript: [] } }, module.logic,
          { origin: "builtin", classification: "builtin", key: "fixture:render-scribe-referral", sources: module.sources });
        const m = mountNew(fx);
        const root = m.container;
        try {
          await setView(root, "prompts");
          const el = root.querySelector(`[data-probe="${pid}"]`);
          if (c.check(!!el, "/referral045/probe/shown", { probe: pid }, "the probe on the rail", "absent")) {
            await act(() => el.querySelector(".prow .pbtn").click());
            await complete(root, fx);
            await review(root);
            const snap = m.log.screens.at(-1);
            if (c.check(snap.scorable && snap.band !== "low" && snap.routingCleared === true, "/referral045/@setup", null, "a settled, routed, non-lowest screen", { scorable: snap.scorable, band: snap.band, routingCleared: snap.routingCleared })) {
              const bundle = JSON.parse(await bundleText(root));
              const sr = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === "ServiceRequest" && r.priority === "routine");
              // the module data's destination for the derived picture, whatever the recorded probe answer
              const dest = (referral.byPhenotype && Object.prototype.hasOwnProperty.call(referral.byPhenotype, snap.phenotype) ? referral.byPhenotype[snap.phenotype] : null) || referral.default;
              const want = `Referral: ${dest.specialty} — evaluate for ${dest.reason}`;
              c.check(!!sr && sr.code.text === want, "/referral045/bundle", { probe: pid, phenotype: snap.phenotype }, want, sr && sr.code.text);
              await setView(root, "note");
              await act(() => root.querySelector("[data-testid=scribe-emr-toggle]").click());
              const f = root.querySelector("[data-testid=scribe-emr-frame]");
              const ta = f ? new DOMParser().parseFromString(f.getAttribute("srcdoc") || "", "text/html").querySelector("textarea") : null;
              const lines = ta ? ta.value.split("\n") : [];
              c.check(lines.includes(want) && !!sr && lines.includes(`  Reason: ${sr.reasonCode[0].text}`), "/referral045/emr", { probe: pid }, [want, "  Reason: <the bundle's>"], lines.filter((l) => l.startsWith("Referral") || l.startsWith("  Reason")));
              // the clinician rule block, once, right after the consultant placeholders
              const i = lines.indexOf(FX_BLOCK[0]);
              c.diff(FX_BLOCK, i >= 0 ? lines.slice(i, i + FX_BLOCK.length) : null, { at: "/referral045/emr/block", input: { probe: pid } });
              c.check(lines.filter((l) => l === FX_BLOCK[0]).length === 1 && i > 0 && lines[i - 1] === "Urgency / preferred clinic: [ ]", "/referral045/emr/block/place", { probe: pid },
                "once, right after the consultant placeholders", lines.slice(Math.max(0, i - 2), i + 1));
              // no escalation: no evidence line, no escalation words
              c.check(!lines.some((l) => l.includes("escalated by the module's referral rule") || l.startsWith("True vertigo recorded") || l.startsWith("Escalation evidence")),
                "/referral045/emr/no-escalation", { probe: pid }, "no escalation line", lines.filter((l) => /escalat/.test(l)));
            }
          }
        } finally { m.unmount(); }
      }
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
        c.check(!q("scribe-heard"), "/shape/heard", null, "no heard group", "shown");
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

    // ------------------------------------------------------------------ heard / carry / yield
    // Design 05 §7.3 blocks 1-9, on the shipped module. Each block rebinds it with its own demo
    // transcript and drives it with Step, so voice, typed and demo lines take the same path.
    const vocab = await h.engine("vocab.js");
    const probeList = module.logic && module.logic.probes && Array.isArray(module.logic.probes.list) ? module.logic.probes.list : [];
    const probeKind = new Map(probeList.map((p) => [String(p.id), p.kind]));
    const isSafetyTier = (kind) => !!(vocab.PROBE_KIND && vocab.PROBE_KIND[kind] && vocab.PROBE_KIND[kind].rank === 0);
    const rescueOfHeard = probeList.find((p) => p.kind === "rescue" && p.rescues === HEARD_ID) || null;
    const heardItem = module.itemById[HEARD_ID];
    const scripted = (name, T) => bind.bindModule({ ...module.rubric, demo: { ...module.rubric.demo, transcript: T } }, module.logic,
      { origin: "builtin", classification: "builtin", key: `fixture:render-scribe-${name}`, sources: module.sources });
    const step = async (root) => {
      const s = buttonByText(root, ".transport", /^Step$/);
      if (!s || s.disabled) return false;
      await act(() => s.click());
      return true;
    };
    const steps = async (root, k, at, from = 0) => {
      for (let i = from; i < from + k; i++) if (!c.check(await step(root), `${at}/step/${i + 1}`, null, "an enabled Step button", "none")) return false;
      return true;
    };
    const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const typeAndCapture = async (root, value) => {
      const input = root.querySelector("[data-testid=scribe-input]");
      const cap = root.querySelector("[data-testid=scribe-capture]");
      if (!input || !cap) return false;
      await act(() => { setNativeValue.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
      await act(() => cap.click());
      return true;
    };
    const answersOf = (log) => ((log.screens.at(-1) || {}).answers) || {};
    const coverageOf = (log) => (log.screens.at(-1) || {}).coverage;
    const readoutOf = (root) => txt(root.querySelector(".readout"));
    const lines = (root) => all(root, ".tsc .row:not([data-testid])");
    const bubText = (row) => (row ? txt(row.querySelector(".bub")) : null);
    const heardTags = (root) => all(root, ".tsc .sa-scribe-heardtag");
    const capTags = (root) => all(root, ".tsc .captag");
    const heardGroup = (root) => root.querySelector("[data-testid=scribe-heard]");
    const heardCard = (root) => root.querySelector(`[data-testid=scribe-heard] [data-heard="${HEARD_ID}"]`);
    const askLabel = (root) => { const t = txt(root.querySelector("[data-testid=scribe-view-prompts]")); return t === null ? null : t.trim(); };
    const precedes = (x, y) => !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    const sortedJson = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
    const block = async (name, T, body) => {
      const m = mountNew(await scripted(name, T));
      try { await body(m, m.container, `/heard-ui/${name}`); } finally { m.unmount(); }
    };
    if (!c.check(!!heardItem, "/heard-ui/item", null, `the built-in item ${HEARD_ID}`, null)) return c.result();

    // 1. heard: a cue without its value is shown, never recorded.
    await block("heard", [["pt", DIZZY]], async (m, R, at) => {
      const before = { readout: readoutOf(R), coverage: coverageOf(m.log) };
      if (!(await steps(R, 1, at))) return;
      const tags = heardTags(R);
      c.check(tags.length === 1, `${at}/tag/count`, null, 1, tags.length);
      c.check(tags.length === 1 && txt(tags[0]) === HEARD_TAG, `${at}/tag/text`, null, HEARD_TAG, tags.map(txt));
      c.check(tags.length === 1 && tags[0].getAttribute("data-heard") === HEARD_ID, `${at}/tag/id`, null, HEARD_ID, tags.map((t) => t.getAttribute("data-heard")));
      c.check(capTags(R).length === 0, `${at}/no-captag`, null, [], capTags(R).map(txt));
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer`, null, undefined, answersOf(m.log)[HEARD_ID]);
      c.check(readoutOf(R) === before.readout, `${at}/readout`, null, before.readout, readoutOf(R));
      c.check(coverageOf(m.log) === before.coverage, `${at}/coverage`, null, before.coverage, coverageOf(m.log));
      await setView(R, "prompts");
      const group = heardGroup(R);
      c.check(!!group && txt(group.querySelector(".qtag")) === HEARD_GROUP, `${at}/group/caption`, null, HEARD_GROUP, group && txt(group.querySelector(".qtag")));
      const card = heardCard(R);
      if (c.check(!!card, `${at}/card`, null, "the heard card in Ask next", null)) {
        c.check(card.matches(".prompt.sa-scribe-heard") && card.getAttribute("data-suggestion") === HEARD_ID, `${at}/card/shape`, null,
          `.prompt.sa-scribe-heard[data-suggestion=${HEARD_ID}]`, `${card.className} [data-suggestion=${card.getAttribute("data-suggestion")}]`);
        c.check(!card.style.borderLeft, `${at}/card/no-inline-border`, null, "", card.style.borderLeft);
        const tagLine = txt(card.querySelector(".qtag"));
        c.check(!!tagLine && tagLine.trim() === HEARD_CARD_TAG, `${at}/card/tag`, null, HEARD_CARD_TAG, tagLine);
        const ask = heardItem.ask ?? heardItem.text;
        c.check(txt(card.querySelector(".qq")) === ask, `${at}/card/question`, null, ask, txt(card.querySelector(".qq")));
      }
      const once = all(R, `[data-suggestion="${HEARD_ID}"]`).length;
      c.check(once === 1, `${at}/suggested-once`, null, 1, once);
      const n = all(R, "[data-testid=scribe-heard] .prompt[data-heard]").length + all(R, "[data-testid=scribe-suggestions] .prompt[data-suggestion]").length;
      c.check(askLabel(R) === `Ask next (${n})`, `${at}/view-count`, { n }, `Ask next (${n})`, askLabel(R));
      await setView(R, "safety");
    });

    // 2. order: Safety first, then Heard, then Re-ask and everything else.
    await block("order", [["pt", "my ear feels full and it rings"], ["pt", DIZZY]], async (m, R, at) => {
      if (!(await steps(R, 2, at))) return;
      await setView(R, "prompts");
      const card = heardCard(R);
      if (c.check(!!card, `${at}/card`, null, "the heard card in Ask next", null)) {
        const safety = all(R, ".prompt[data-probe]").filter((p) => isSafetyTier(probeKind.get(p.getAttribute("data-probe"))));
        c.check(safety.length > 0, `${at}/safety/shown`, null, "at least one Safety probe", 0);
        for (const p of safety) c.check(precedes(p, card), `${at}/safety/${p.getAttribute("data-probe")}`, null, "before the heard card", "after it");
        const rescue = rescueOfHeard ? R.querySelector(`.prompt[data-probe="${rescueOfHeard.id}"]`) : null;
        if (c.check(!!rescue, `${at}/rescue/shown`, { rescues: HEARD_ID }, `the Re-ask probe of ${HEARD_ID}`, rescueOfHeard ? null : "no such probe in the module")) {
          c.check(precedes(card, rescue), `${at}/rescue/${rescueOfHeard.id}`, null, "after the heard card", "before it");
        }
        const others = all(R, ".prompt[data-suggestion]:not([data-heard])");
        c.check(others.length > 0, `${at}/suggestions/shown`, null, "ranked suggestions", 0);
        for (const s of others) c.check(precedes(card, s), `${at}/suggestion/${s.getAttribute("data-suggestion")}`, null, "after the heard card", "before it");
      }
      await setView(R, "safety");
    });

    // 3. carry: the reported case. Turn 2 re-arms the slot, so this transcript cannot show that
    // the physician turn consumes nothing; block 3b does.
    await block("carry", ROW1, async (m, R, at) => {
      if (!(await steps(R, 3, at))) return;
      const heard = heardTags(R).map(txt);
      c.check(heard.length === 2 && heard[0] === HEARD_TAG && heard[1] === ROW1_HEARD_TAG_2, `${at}/heard-tags`, null, [HEARD_TAG, ROW1_HEARD_TAG_2], heard);
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer-before`, null, undefined, answersOf(m.log)[HEARD_ID]);
      const cov = coverageOf(m.log);
      if (!(await steps(R, 1, at, 3))) return;
      c.check(answersOf(m.log)[HEARD_ID] === 2, `${at}/answer`, null, 2, answersOf(m.log)[HEARD_ID]);
      const last = lines(R).at(-1);
      const lastTags = last ? all(last, ".captag").map(txt) : [];
      c.check(lastTags.length === 1 && lastTags[0] === ROW1_CARRY_TAG, `${at}/carry-tag`, null, [ROW1_CARRY_TAG], lastTags);
      c.check(typeof cov === "number" && coverageOf(m.log) > cov, `${at}/coverage`, null, `> ${cov}`, coverageOf(m.log));
      await setView(R, "prompts");
      c.check(!heardCard(R), `${at}/no-card`, null, "no heard card", "shown");
      await setView(R, "safety");
    });

    // 3b. carry-md: a physician turn between a used reply and the last allowed reply does not
    // consume the window (review F3, tests; gold d071).
    await block("carry-md", MD_BETWEEN, async (m, R, at) => {
      if (!(await steps(R, 3, at))) return;
      const heard = heardTags(R).map(txt);
      c.check(heard.length === 1 && heard[0] === HEARD_TAG, `${at}/heard-tags`, null, [HEARD_TAG], heard);
      c.check(capTags(R).length === 0, `${at}/no-captag-before`, null, [], capTags(R).map(txt));
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer-before`, null, undefined, answersOf(m.log)[HEARD_ID]);
      if (!(await steps(R, 1, at, 3))) return;
      c.check(answersOf(m.log)[HEARD_ID] === 2, `${at}/answer`, null, 2, answersOf(m.log)[HEARD_ID]);
      const last = lines(R).at(-1);
      const lastTags = last ? all(last, ".captag").map(txt) : [];
      c.check(lastTags.length === 1 && lastTags[0] === DIZZY_CARRY_TAG, `${at}/carry-tag`, null, [DIZZY_CARRY_TAG], lastTags);
      await setView(R, "prompts");
      c.check(!heardCard(R), `${at}/no-card`, null, "no heard card", "shown");
      await setView(R, "safety");
    });

    // 4. expiry: two replies without a value close the window; the item is still worth asking.
    await block("expiry", [["pt", DIZZY], ["pt", "ok"], ["pt", "fine"], ["pt", "a few hours"]], async (m, R, at) => {
      if (!(await steps(R, 4, at))) return;
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer`, null, undefined, answersOf(m.log)[HEARD_ID]);
      c.check(capTags(R).length === 0, `${at}/no-captag`, null, [], capTags(R).map(txt));
      await setView(R, "prompts");
      c.check(!!heardCard(R), `${at}/card-stays`, null, "the heard card still shown", null);
      await setView(R, "safety");
    });

    // 5. skip: Skip on the heard card writes nothing, hides it, and a skipped item is never carried.
    await block("skip", [["pt", DIZZY], ["pt", "a few hours"]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      await setView(R, "prompts");
      const card = heardCard(R);
      const skip = card && card.querySelector("[data-testid=scribe-skip]");
      if (!c.check(!!skip, `${at}/skip-button`, null, "a Skip button on the heard card", null)) { await setView(R, "safety"); return; }
      await act(() => skip.click());
      await setView(R, "safety");
      if (!(await steps(R, 1, at, 1))) return;
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer`, null, undefined, answersOf(m.log)[HEARD_ID]);
      c.check(capTags(R).length === 0, `${at}/no-carry-tag`, null, [], capTags(R).map(txt));
      await setView(R, "prompts");
      c.check(!heardCard(R), `${at}/no-card`, null, "no heard card", "shown");
      await setView(R, "safety");
    });

    // 5b. yield after Skip / after an answer (round 2 R5, review UI-1, gold d072). The control
    // shows the attack-duration line scores the yielding entry on its own; after a heard cue whose
    // card is skipped or answered it must not, because the slot stays present for the yield for
    // the rest of its reply window (and nothing is carried into the closed item).
    await block("yield-control", [["pt", ATTACK_LINE]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      c.check(answersOf(m.log)[YIELDING_ID] !== undefined, `${at}/scored`, { line: ATTACK_LINE }, `${YIELDING_ID} answered (the line scores it on its own)`, answersOf(m.log)[YIELDING_ID]);
    });
    // Close the heard card by Skip, or by its option ANSWER_OPTION (asserting the answer it
    // writes); false when the card or its control is missing (reported).
    const closeHeardCard = async (m, R, at, how) => {
      await setView(R, "prompts");
      const card = heardCard(R);
      let ok;
      if (how === "skip") {
        const skip = card && card.querySelector("[data-testid=scribe-skip]");
        ok = c.check(!!skip, `${at}/skip-button`, null, "a Skip button on the heard card", null);
        if (ok) await act(() => skip.click());
      } else {
        const btn = card ? all(card, ".prow .pbtn").filter((x) => !x.classList.contains("skip"))[ANSWER_OPTION] : null;
        const label = heardItem.scale && heardItem.scale[ANSWER_OPTION] ? heardItem.scale[ANSWER_OPTION].label : null;
        ok = c.check(!!btn && txt(btn) === label, `${at}/button`, { option: ANSWER_OPTION }, label, btn ? txt(btn) : null);
        if (ok) await act(() => btn.click());
      }
      await setView(R, "safety");
      if (ok && how !== "skip") c.check(answersOf(m.log)[HEARD_ID] === ANSWER_OPTION, `${at}/answer`, null, ANSWER_OPTION, answersOf(m.log)[HEARD_ID]);
      return ok;
    };
    // The transcript holds `n` lines and the last one is `last` (review T6): a Step that stopped
    // ingesting, or re-played an earlier line, cannot pass the absence checks that follow.
    const ingested = (R, at, n, last) => {
      const ls = lines(R);
      c.check(ls.length === n, `${at}/lines`, null, n, ls.length);
      c.check(bubText(ls.at(-1)) === last, `${at}/last-line`, null, last, bubText(ls.at(-1)));
    };
    await block("skip-yield", [["pt", DIZZY], ["pt", ATTACK_LINE]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      if (!(await closeHeardCard(m, R, at, "skip"))) return;
      if (!(await steps(R, 1, at, 1))) return;
      ingested(R, at, 2, ATTACK_LINE);
      c.check(answersOf(m.log)[YIELDING_ID] === undefined, `${at}/no-yielded-answer`, { line: ATTACK_LINE }, undefined, answersOf(m.log)[YIELDING_ID]);
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer`, null, undefined, answersOf(m.log)[HEARD_ID]);
      c.check(capTags(R).length === 0, `${at}/no-captag`, null, [], capTags(R).map(txt));
    });
    // Items are first-write-wins (ingestCaptures), so today a carried value could not replace
    // the answer; answer-kept would catch a carry if that changed, and no-captag catches the
    // carry capture itself.
    await block("answer-yield", [["pt", DIZZY], ["pt", ATTACK_LINE]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      if (!(await closeHeardCard(m, R, at, "answer"))) return;
      if (!(await steps(R, 1, at, 1))) return;
      ingested(R, at, 2, ATTACK_LINE);
      c.check(answersOf(m.log)[YIELDING_ID] === undefined, `${at}/no-yielded-answer`, { line: ATTACK_LINE }, undefined, answersOf(m.log)[YIELDING_ID]);
      c.check(answersOf(m.log)[HEARD_ID] === ANSWER_OPTION, `${at}/answer-kept`, null, ANSWER_OPTION, answersOf(m.log)[HEARD_ID]);
      const last = lines(R).at(-1);
      const lastTags = last ? all(last, ".captag").map(txt) : [];
      c.check(lastTags.length === 0, `${at}/no-captag`, null, [], lastTags);
    });
    // 5c. The yield lasts the whole reply window (round 3, review T1). The slot is armed on line
    // 1 and its card closed; the attack-duration line is the SECOND reply, so it is still present
    // for the yield only if the Scribe kept the slot of a closed item through the first reply.
    await block("skip-yield-reach", [["pt", DIZZY], ["pt", "ok"], ["pt", ATTACK_LINE]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      if (!(await closeHeardCard(m, R, at, "skip"))) return;
      if (!(await steps(R, 2, at, 1))) return;
      ingested(R, at, 3, ATTACK_LINE);
      c.check(answersOf(m.log)[YIELDING_ID] === undefined, `${at}/no-yielded-answer`, { line: ATTACK_LINE, reply: 2 }, undefined, answersOf(m.log)[YIELDING_ID]);
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer`, null, undefined, answersOf(m.log)[HEARD_ID]);
      c.check(capTags(R).length === 0, `${at}/no-captag`, null, [], capTags(R).map(txt));
    });
    await block("answer-yield-reach", [["pt", DIZZY], ["pt", "ok"], ["pt", ATTACK_LINE]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      if (!(await closeHeardCard(m, R, at, "answer"))) return;
      if (!(await steps(R, 2, at, 1))) return;
      ingested(R, at, 3, ATTACK_LINE);
      c.check(answersOf(m.log)[YIELDING_ID] === undefined, `${at}/no-yielded-answer`, { line: ATTACK_LINE, reply: 2 }, undefined, answersOf(m.log)[YIELDING_ID]);
      c.check(answersOf(m.log)[HEARD_ID] === ANSWER_OPTION, `${at}/answer-kept`, null, ANSWER_OPTION, answersOf(m.log)[HEARD_ID]);
      c.check(capTags(R).length === 0, `${at}/no-captag`, null, [], capTags(R).map(txt));
    });
    // Gold d072 through this Scribe (not the capture suite's emulation): an item answered from
    // speech keeps a slot newly armed by a later heard cue, and that slot yields.
    await block("d072", D072, async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      c.check(answersOf(m.log)[HEARD_ID] === 1, `${at}/answered-line-1`, { line: D072[0][1] }, 1, answersOf(m.log)[HEARD_ID]);
      if (!(await steps(R, 2, at, 1))) return;
      ingested(R, at, 3, ATTACK_LINE);
      c.check(answersOf(m.log)[YIELDING_ID] === undefined, `${at}/no-yielded-answer`, { line: ATTACK_LINE }, undefined, answersOf(m.log)[YIELDING_ID]);
      c.check(answersOf(m.log)[HEARD_ID] === 1, `${at}/answer-kept`, null, 1, answersOf(m.log)[HEARD_ID]);
      c.check(heardTags(R).length === 0, `${at}/heard-tag-dropped`, { line: D072[1][1] }, "no heard tag (the item is answered)", heardTags(R).map(txt));
      const later = lines(R).slice(1).flatMap((l) => all(l, ".captag").map(txt));
      c.check(later.length === 0, `${at}/no-captag-after-line-1`, null, [], later);
    });
    // 5d. Round 3b (gold d086): a withheld duration arms a yield-only slot. The attack-duration line
    // must not score its entry, and nothing may be carried into the heard item, which stays heard and
    // unanswered with its card shown. The yield-control block above shows the same line scores the
    // entry on its own.
    await block("withheld-yield", WITHHELD_YIELD, async (m, R, at) => {
      if (!(await steps(R, 2, at))) return;
      ingested(R, at, 2, ATTACK_LINE);
      c.check(bubText(lines(R)[0]) === WITHHELD_LINE, `${at}/first-line`, null, WITHHELD_LINE, bubText(lines(R)[0]));
      c.check(answersOf(m.log)[YIELDING_ID] === undefined, `${at}/no-yielded-answer`, { line: ATTACK_LINE }, undefined, answersOf(m.log)[YIELDING_ID]);
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer`, { line: WITHHELD_LINE }, undefined, answersOf(m.log)[HEARD_ID]);
      c.check(capTags(R).length === 0, `${at}/no-captag`, null, [], capTags(R).map(txt));
      const heard = heardTags(R);
      c.check(heard.length === 1 && txt(heard[0]) === WITHHELD_HEARD_TAG && !!lines(R)[0] && lines(R)[0].contains(heard[0]), `${at}/heard-tag`, null,
        `one heard tag on line 1: ${WITHHELD_HEARD_TAG}`, heard.map(txt));
      await setView(R, "prompts");
      c.check(!!heardCard(R), `${at}/card-stays`, null, "the heard card still shown", null);
      await setView(R, "safety");
    });
    // The expiry control: after two replies the window is closed, so the attack-duration line
    // scores its entry again. Without it, the reach blocks could pass with a yield that never ends.
    await block("skip-yield-expired", [["pt", DIZZY], ["pt", "ok"], ["pt", "fine"], ["pt", ATTACK_LINE]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      if (!(await closeHeardCard(m, R, at, "skip"))) return;
      if (!(await steps(R, 3, at, 1))) return;
      ingested(R, at, 4, ATTACK_LINE);
      c.check(answersOf(m.log)[YIELDING_ID] !== undefined, `${at}/scored`, { line: ATTACK_LINE, reply: 3 }, `${YIELDING_ID} answered (the window has closed)`, answersOf(m.log)[YIELDING_ID]);
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer`, null, undefined, answersOf(m.log)[HEARD_ID]);
    });

    // 6. answer: the heard card's own option buttons answer the item.
    await block("answer", [["pt", DIZZY]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      await setView(R, "prompts");
      const card = heardCard(R);
      const btn = card ? all(card, ".prow .pbtn").filter((x) => !x.classList.contains("skip"))[2] : null;
      const label = heardItem.scale && heardItem.scale[2] ? heardItem.scale[2].label : null;
      if (c.check(!!btn && txt(btn) === label, `${at}/button`, null, label, btn ? txt(btn) : null)) {
        await act(() => btn.click());
        c.check(answersOf(m.log)[HEARD_ID] === 2, `${at}/answer`, null, 2, answersOf(m.log)[HEARD_ID]);
        c.check(!heardCard(R), `${at}/card-gone`, null, "no heard card", "shown");
        c.check(heardTags(R).length === 1, `${at}/tag-stays`, null, 1, heardTags(R).length);
      }
      await setView(R, "safety");
    });

    // 7. reset: the pending slot is cleared with the transcript.
    await block("reset", [["pt", DIZZY]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      const reset = R.querySelector("[data-testid=scribe-reset]");
      if (!c.check(!!reset, `${at}/reset-button`, null, "Reset", null)) return;
      await act(() => reset.click());
      c.check(lines(R).length === 0, `${at}/cleared`, null, 0, lines(R).length);
      if (!c.check(await typeAndCapture(R, "a few hours"), `${at}/typed`, null, "typed input and Capture", null)) return;
      c.check(lines(R).length === 1, `${at}/typed-line`, null, 1, lines(R).length);
      c.check(capTags(R).length === 0 && heardTags(R).length === 0, `${at}/nothing-captured`, null, { captags: [], heard: [] }, { captags: capTags(R).map(txt), heard: heardTags(R).map(txt) });
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-answer`, null, undefined, answersOf(m.log)[HEARD_ID]);
      await setView(R, "prompts");
      c.check(!heardGroup(R), `${at}/no-group`, null, "no heard group", "shown");
      await setView(R, "safety");
    });

    // 8. F4: the attack-duration entry yields to the episode duration it would misread.
    await block("yield", [["pt", "I get dizzy and it lasts a couple of hours"]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      const tags = capTags(R).map(txt);
      c.check(tags.includes(VALUE_TAG), `${at}/value-tag`, null, VALUE_TAG, tags);
      c.check(!tags.some((t) => t.includes("attack duration")), `${at}/no-yielded-tag`, null, "no attack duration tag", tags);
      c.check(answersOf(m.log)[HEARD_ID] === 2, `${at}/answer`, null, 2, answersOf(m.log)[HEARD_ID]);
    });

    // 9. demo: the whole shipped walk scores as the 0.3.1-lexicon walk; one heard tag, on line 7.
    {
      const at = "/heard-ui/demo";
      const DEMO_HEARD_LINE = 7;   // 1-based: "…really dizzy too — kind of spinning … lasts a while."
      let ref = null;
      const r = mountNew(module031);
      try {
        await playAll(r.container);
        ref = { answers: sortedJson(answersOf(r.log)), readout: readoutOf(r.container), coverage: coverageOf(r.log), heard: heardTags(r.container).length };
      } finally { r.unmount(); }
      if (!has031) c.note("demo block: the 0.3.1 reference walk ran on the shipped module (revertLexiconDelta failed)");
      c.check(ref.heard === 0, `${at}/lexicon031/no-heard`, null, 0, ref.heard);
      const m = mountNew(module);
      try {
        const R = m.container;
        await playAll(R);
        c.check(lines(R).length === module.demo.transcript.length, `${at}/lines`, null, module.demo.transcript.length, lines(R).length);
        c.check(sortedJson(answersOf(m.log)) === ref.answers, `${at}/answers`, null, ref.answers, sortedJson(answersOf(m.log)));
        c.check(readoutOf(R) === ref.readout, `${at}/readout`, null, ref.readout, readoutOf(R));
        c.check(coverageOf(m.log) === ref.coverage, `${at}/coverage`, null, ref.coverage, coverageOf(m.log));
        const tags = heardTags(R);
        c.check(tags.length === 1, `${at}/heard/count`, null, 1, tags.map(txt));
        const line = lines(R)[DEMO_HEARD_LINE - 1];
        c.check(tags.length === 1 && !!line && line.contains(tags[0]), `${at}/heard/line`, null, `demo line ${DEMO_HEARD_LINE}`,
          tags.map((t) => lines(R).findIndex((l) => l.contains(t)) + 1));
        c.check(tags.length === 1 && txt(tags[0]) === HEARD_TAG, `${at}/heard/text`, null, HEARD_TAG, tags.map(txt));
        await setView(R, "prompts");
        c.check(!!heardCard(R), `${at}/card`, null, "the heard card in Ask next", null);
        await setView(R, "safety");
        // The shipped footer (review F5, tests): the lexicon axis moved to 0.3.2, instrument and
        // probe set did not, and the gold set was re-run on this lexicon (no "not re-run").
        const footer = txt(R.querySelector("[data-testid=scribe-footer]")) || "";
        c.check(footer.includes(SHIPPED_FOOTER_VERSIONS), `${at}/footer/versions`, null, SHIPPED_FOOTER_VERSIONS, footer);
        c.check(footer.includes(`extraction lexicon ${module.rubric.lexicon && module.rubric.lexicon.version} `), `${at}/footer/lexicon`, null,
          `extraction lexicon ${module.rubric.lexicon && module.rubric.lexicon.version}`, footer);
        c.check(!footer.includes("not re-run"), `${at}/footer/gold-set`, null, "benchmarked on this lexicon", footer);
      } finally { m.unmount(); }
    }
    c.note(`heard / carry / yield: 18 blocks on the shipped module (lexicon ${module.rubric.lexicon && module.rubric.lexicon.version})`);

    return c.result();
  }),
};
