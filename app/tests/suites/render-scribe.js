// tests/suites/render-scribe.js — the generic Ambient Scribe against the frozen baseline Scribe
// (design 03 §8.3 `render`, §5.4, §9.9). Owner: WP8.
//
// Parity (done-when 1). The baseline Scribe (tests/baseline/src) and apps/Scribe.jsx with the
// built-in module on its 0.3.1-equivalent lexicon (design 05 §7.1, §7.3: revertLexiconChain of
// the shipped lexicon and tests/harness/lexicon-delta.js, then, since release 0.4.7,
// tests/harness/lexicon-delta-033.js: the exact inverse the values suite proves) are mounted side by
// side in detached containers and driven identically:
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
//   shape     the data-only fixture (no lexicon, no transcript, no probes): Listen, Play, Step,
//             typed input and Clarify hidden, the no-lexicon notice shown, no probe rail, no heard group
//   derive    an injected throwing derive rule: the rule-error card, the note's engine A&P line,
//   routing   a bundle without a referral, onModuleError called (and the same for a throwing
//             routing rule)
//   mic       micAllowed=false disables Listen (when the browser has speech recognition)
//   question  (release 0.4.8) r_dur's Ask-next card reads the clinical lead's question of 2026-10-12
//             ("Have symptoms persisted over 3 months despite trials of medical management?") under
//             its tag "recalcitrance" with Yes / No, and the old question is printed nowhere
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
//             instrument 0.2 · extraction lexicon 0.3.3 · probe set 1.0.0 (release 0.4.7), gold set
//             not "not re-run" (review F5, tests)
// Typed chart text and Clarify (release 0.4.7, spec 0.4.7 §3.8, §5, §6), on the shipped module:
//   typed     a typed line is chart text: typed "dizzy" is heard (tag and card) but arms no slot, so
//             the spoken "a few hours" after it carries nothing; the control (both lines spoken)
//             carries; a typed "Her tinnitus is bilateral." records v_aural yes (the lexicon's
//             chartIgnoreThirdParty: "her " names the patient in chart text) and shows the tinnitus
//             quality card, while the same line spoken is attributed to someone else (nothing recorded)
//   clarify   the lead's history and physical (gold 0.4.0 k001) through the real box: a textarea of 8
//             rows whose value keeps every line and whose draft counts as unsaved work; Enter and a
//             composing Ctrl+Enter capture nothing, Ctrl+Enter captures; the bubble is the note; the
//             lead's checks on the published answers (x_purulent, x_anosmia "no"; m_photo, v_aural
//             "yes"; no n_allo, no v_head, no r_normal, and since the lead struck the mask "aural" on
//             2026-10-12 no m_aura: stated and denied, a conflict card; rf_pulsatile not raised); one clarify tag per cue
//             (clarifyLabel, never a captag); the Clarify section right under the box with the
//             capture suite's cards (clarifyPrompts: clause quoted, question, the probe's or item's own
//             answers, Skip), no data-suggestion / data-heard / data-probe, not transcript rows; their
//             probes off the Ask next rail and their items off the suggestions while open (a live
//             probe shows the check is not vacuous); computed layout (resize vertical, min 200 px,
//             max 60vh, pre-wrap bubble, no overflow); Skip on a Safety probe's card records nothing
//             and puts the probe back on the rail; a probe option raises its flag as a probe flag, one
//             writes its item; an item card's "No"; the placeholder card's Skip; the EMR template
//             equals buildEmrTemplate with those probe answers ("recorded by clinician via probe");
//             Reset clears cards, lines and box; the lead's "runny nose" example (Cmd+Enter): the
//             lead's question verbatim, pr_purulence's answers, the clear answer recorded
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
//
// Release 0.4.8, follow-up (the clinical lead's request of 2026-10-12): the Question review tab, right
// of Ask next, which AD21 alone excuses in the parity snapshots (h.expect at every compared view). On
// the new app only (block "question-review"): the view switch is a tab list (Safety, Ask next,
// Question review, Note, FHIR; roles, aria-selected, aria-controls, one tab in the tab order, the
// arrow keys, Home and End move and select, focus follows) and the default view is unchanged; the
// review lists every scored item once, by domain in domainOrder (each domain a group named by its
// label, each row a group named by its question), with the Ask next question and short label; a
// fresh Scribe reads "not answered" everywhere (never no; Clear disabled); after the demo every
// answered row shows its answer's label and "heard in encounter"; an Ask next answer, a skipped
// suggestion ("skipped in Ask next"), a probe on the rail, a Clarify card and typed chart text show
// their sources; editing a demo answer moves the published answers, the readout, the coverage, the
// encounter note and the EMR template (= buildEmrTemplate of the new answers), marks the row
// "edited" with what was first recorded and takes the item off the suggestions; a typed chart answer
// is corrected the same way; clearing returns the item to unanswered (coverage down, Clear disabled,
// the EMR template not recorded) and back to Ask next; choosing the current answer changes nothing;
// the review holds no Ask next card (no .prompt, data-suggestion, data-heard or data-probe) and the
// Ask next tab's count is unchanged by opening it; the dirty summary counts its edits; Reset clears it.
// Review fixes (0.4.8 follow-up): the edited item is one Ask next shows once cleared, and the shown
// suggestions must equal rankSuggestions; a review clear drops the item's skip and a later skip in Ask
// next shows on the row; changing or clearing an item a probe answer wrote retracts that probe answer
// (its note leaves the encounter note, the EMR template equals buildEmrTemplate with no probe answer,
// a probe-keyed checklist signal leaves, and the probe is back on the rail as liveProbes gives it).
import React from "react";
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { ad6Pairs, allowedDifference, revertLexiconChain } from "../harness/diff.js";
import { LEXICON_DELTA } from "../harness/lexicon-delta.js";
import { LEXICON_DELTA_033 } from "../harness/lexicon-delta-033.js";

// AD6 before AD5: AD5 applies only when the rest of the string already matches (a whole card
// can carry both). AD15 (release 0.4.3, the EMR Friendly Template button after Sign to chart)
// applies only to the Note view and also needs the rest to match, so it follows AD4 and AD6.
// AD21 (release 0.4.8, follow-up: the Question review tab in the view switch) strips only its own tab
// text, so it is listed before AD15 and AD5.
const ALLOW = ["AD4", "AD6", "AD21", "AD15", "AD5"];
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
// lexicon (design 05 §6: instrument 0.2 and probe set 1.0.0 unchanged, lexicon 0.3.1 → 0.3.2; release
// 0.4.7: lexicon 0.3.3, gold set 0.4.0 re-run on it).
const SHIPPED_FOOTER_VERSIONS = "instrument 0.2 · extraction lexicon 0.3.3 · probe set 1.0.0";
// Release 0.4.7 (spec 0.4.7 §3.8, §5, §6): the typed chart text and the Clarify section. The lead's
// history and physical is gold set 0.4.0 case k001 (verbatim); its cards are the capture suite's
// HP_CARD_IDS (clarifyPrompts on clarifyCues, nothing answered, in order).
const GOLD_0_4_0_FIXTURE = "goldset/masque_extraction_goldset_0.4.0.json";
const HP_CASE = "k001";
// Review round 3: "not pulsatile" denies the tinnitus-quality qualifier, so its card asks too (a denied
// qualifier resolves nothing). Sign-off (2026-10-12): the lead struck the mask "aural" (and kept it struck
// after being told this effect), so "aural fullness" states aura and "denies auras" denies it: the
// conflict card m_aura asks.
const HP_CARD_IDS = ["cl_laterality", "cl_otalgia", "@placeholder", "cl_hearing_onset", "cl_audiogram", "m_aura", "m_head", "cl_tinnitus_quality",
  "cl_dizziness_kind", "cl_neck", "cl_hints"];
// The lead's checks on that note (spec 0.4.7 §6), read from the answers the Scribe publishes. m_aura,
// "no" until the sign-off, is now stated both ways and not recorded (HP_ABSENT).
const HP_LEAD_CHECKS = { x_purulent: "no", x_anosmia: "no", m_photo: "yes", v_aural: "yes" };
// Review round 2: nothing is captured inside the exam section, so no r_normal either; sign-off: no m_aura.
const HP_ABSENT = ["n_allo", "v_head", "r_normal", "m_aura"];
const HP_DENIED_FLAG = "rf_pulsatile";
// The cards the flow answers or skips, and how (a probe option index, an item value, or "skip").
const HP_SKIP_PROBE_CARD = "cl_hearing_onset";   // a Safety probe: back on the rail once skipped
const HP_FLAG_CARD = "cl_laterality";            // option 0 raises a flag (source "probe")
const HP_WRITE_CARD = "cl_dizziness_kind";       // option 0 writes an item (probe option `a`)
const HP_ITEM_CARD = "cl_otalgia";               // an item card, answered "no"
const HP_NOTE_CARD = "@placeholder";             // the template-text notice: Dismiss only (review round 2)
// The lead's example, and the lead's question stored verbatim (the UI may not re-case it).
const RUNNY = "Reports runny nose.";
// Review fixes of release 0.4.7: a pronoun in typed chart text names the patient.
const PRONOUN = "Her tinnitus is bilateral.";
const PRONOUN_ITEM = "v_aural";
const PRONOUN_CARD = "cl_tinnitus_quality";
const RUNNY_CARD = "cl_rhinorrhea";
const LEAD_QUESTION = "is the rhinorrhea clear or purulent?";
// Engine chrome (draft wording, release 0.4.7).
const CLARIFY_CAPTION = "Clarify · the text leaves these open; nothing is recorded until you answer";
// Review round 1 (release 0.4.7): typed lines for the rescue card's liveness, the never-twice rule on a
// rule-out conflict card, and the Clarify section's accessibility; the status wording (draft).
const R1_DURATION = "Endorses episodic dizziness lasting hours at a time.";
const R1_BARE = "Endorses dizziness.";
const R1_DURATION_LATER = "Dizziness lasting hours at a time.";
const R1_CONFLICT = "Finished a course of augmentin. Denies anosmia. Reports anosmia.";
const R1_TWO_CARDS = "Reports runny nose. Endorses ear pain.";
const R1_STATUS = (n) => `${n} ${n === 1 ? "question" : "questions"} to clarify`;
const DRAFT_DIRTY = "text not yet captured";

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

const VIEW_RE = { safety: /^Safety/, prompts: /^Ask next/, review: /^Question review$/, note: /^Note$/, fhir: /^FHIR$/ };

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
    const REVIEW_TAB = "Question review";
    const ctx = { AD5: { short }, AD6: ad6Pairs(scb.RED_FLAGS, scr.RED_FLAGS), AD15: { text: [["Sign to chart", ` ${EMR_BUTTON}`]] },
      AD21: { text: ` ${REVIEW_TAB}`, before: " Note" } };
    const seen = new Set();
    let ad5Pre = false, ad15Pre = 0, ad15Seen = 0, ad21Pre = 0, ad21Seen = 0;

    // ------------------------------------------------------------------ parity
    // Subject: the generic Scribe + the 0.3.1-equivalent data (design 05 §7.1). The 0.3.2
    // behaviour is proven by the blocks below, by AD13 and by the capture suite.
    // When the revert fails (FAIL at /parity/lexicon031) the parity still runs, on the shipped
    // module, so the differences that follow show what the unreverted data changes.
    const lex031 = revertLexiconChain(module.rubric.lexicon, [LEXICON_DELTA, LEXICON_DELTA_033]);
    const has031 = c.check(lex031 !== null, "/parity/lexicon031",
      { delta: `${LEXICON_DELTA.from} → ${LEXICON_DELTA.to} → ${LEXICON_DELTA_033.to}`, shipped: module.rubric.lexicon && module.rubric.lexicon.version },
      "the shipped lexicon is exactly 0.3.1 + LEXICON_DELTA + LEXICON_DELTA_033 (revertLexiconChain)", null);
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
      // Release 0.4.8, follow-up: every compared view carries the Question review tab; AD21 must excuse it.
      if (["view_safety", "view_prompts", "view_note"].every((k) => (sb[k] || "").includes(` ${REVIEW_TAB} Note`))) { ad21Pre++; if (r.observed.has("AD21")) ad21Seen++; }
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
    h.expect("AD21", { precondition: ad21Pre > 0, observed: ad21Pre > 0 && ad21Seen === ad21Pre });
    c.check(ad21Pre > 0 && ad21Seen === ad21Pre, "/AD21/@observed", null, "AD21 at every compared snapshot", `${ad21Seen} of ${ad21Pre}`);
    {
      // AD21 self-checks: it excuses its tab where it belongs, exactly once, and nothing else.
      const AD21 = allowedDifference("AD21");
      const p = ctx.AD21;
      const base = "Safety ✓ Ask next (4) Note FHIR";
      const ok = (a, b) => { const [x, y] = AD21.normalise(a, b, { AD21: p }); return x === y; };
      const cases = [
        ["excused: right of Ask next (with a count)", base, "Safety ✓ Ask next (4) Question review Note FHIR", true],
        ["excused: right of Ask next (no count)", "Safety ✓ Ask next  Note FHIR", "Safety ✓ Ask next  Question review Note FHIR", true],
        ["refused: left of Ask next", base, "Safety ✓ Question review Ask next (4) Note FHIR", false],
        ["refused: twice", base + " Question review Note", "Safety ✓ Ask next (4) Question review Note FHIR Question review Note", false],
        ["refused: another label", base, "Safety ✓ Ask next (4) Question Review Note FHIR", false],
        ["refused: another difference too", base, "Safety ✓ Ask next (5) Question review Note FHIR", false],
        ["refused: after Note", base, "Safety ✓ Ask next (4) Note Question review FHIR", false],
      ];
      const bad = cases.filter(([, a, b, want]) => ok(a, b) !== want).map(([n]) => n);
      c.check(!bad.length && AD21.appliesTo("/x/view_note", ctx) && AD21.appliesTo("/x/view_safety", ctx) && !AD21.appliesTo("/x/note", ctx) && !AD21.appliesTo("/x/prompts/0", ctx) && !AD21.appliesTo("/x/view_note", {}),
        "/AD21/@selfChecks", null, "AD21 excuses its tab right of Ask next, once, in the three view texts only", bad);
    }
    c.note(`parity: ${module.demo.transcript.length} demo steps plus review, 3 answers, 1 probe, 1 flag; ADs observed: ${[...seen].sort().join(", ") || "none"}${ad5Pre ? "" : " (no re-ask shown, AD5 not exercised)"}`);
    c.note(has031
      ? `parity subject: extraction lexicon ${lex031.version} (${lex031 === module.rubric.lexicon ? "the shipped lexicon itself, no delta landed" : `revertLexiconChain of the shipped ${module.rubric.lexicon.version}`})`
      : "parity subject: the shipped lexicon (revertLexiconChain failed)");

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

    // Release 0.4.8: the clinical lead's question for r_dur (tests/harness/question-delta-048.js). The
    // Ask-next card of r_dur reads the lead's sentence under its tag "recalcitrance" with Yes / No,
    // and the old question is printed nowhere in the Scribe. From a fresh Scribe (the demo transcript
    // records r_dur itself), suggestions are answered in turn until r_dur's card comes up.
    {
      const m = mountNew(module);
      try {
        let card = null;
        for (let k = 0; k < 80 && !card; k++) {
          await setView(m.container, "prompts");
          card = rightCard(m.container).querySelector('.prompt[data-suggestion="r_dur"]');
          if (card) break;
          const p = rightCard(m.container).querySelector(".prompt[data-suggestion]");
          if (!p) break;
          const it = module.itemById[p.getAttribute("data-suggestion")];
          const btns = all(p, ".prow .pbtn").filter((x) => !x.classList.contains("skip"));
          let idx = 0;
          if (it && it.scale) { const fs = it.scale.map((s) => s.f); idx = fs.indexOf(Math.max(...fs)); }
          else if (it && it.w < 0) idx = 1;
          await act(() => btns[idx].click());
        }
        if (c.check(!!card, "/question048/card", null, "r_dur's Ask-next card", "never suggested")) {
          const q = card.querySelector(".qq");
          c.check(!!q && q.textContent === "Have symptoms persisted over 3 months despite trials of medical management?", "/question048/text", null,
            "Have symptoms persisted over 3 months despite trials of medical management?", q && q.textContent);
          c.check(txt(card).toLowerCase().includes("recalcitrance"), "/question048/tag", null, "the tag recalcitrance", txt(card));
          const labels = all(card, ".prow .pbtn").filter((x) => !x.classList.contains("skip")).map((x) => x.textContent.trim());
          c.diff(["Yes", "No"], labels, { at: "/question048/answers" });
          c.check(!txt(m.container).includes("How long has this been going on?"), "/question048/old-question", null, "the old question printed nowhere", "printed");
        }
      } finally { m.unmount(); }
    }

    // Release 0.4.8, follow-up: the Question review (the clinical lead's request of 2026-10-12). The
    // container is attached off screen so focus and keyboard events reach the tabs.
    {
      const at = "/question-review";
      const [emr, policy, scribeE, probesE, rulesE, scoringE] = await Promise.all([h.engine("emr.js"), h.engine("policy.js"), h.engine("scribe.js"), h.engine("probes.js"), h.engine("rules.js"), h.engine("scoring.js")]);
      const SRC = scribeE.REVIEW_SOURCE;
      const m = mountNew(module);
      const R = m.container;
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-10000px;top:0;width:960px;height:900px;overflow:hidden";
      document.body.appendChild(host);
      host.appendChild(R);
      const q = (id) => R.querySelector(`[data-testid=${id}]`);
      const tabs = () => all(R, "[data-testid=scribe-views] > button");
      const rowsOf = () => all(R, "[data-testid=scribe-review-list] [data-review-item]");
      const rowOf = (id) => R.querySelector(`[data-testid=scribe-review-list] [data-review-item="${id}"]`);
      const stateOf = (id) => { const r = rowOf(id); return r ? txt(r.querySelector("[data-testid=scribe-review-state]")) : null; };
      const answers = () => (m.log.screens.at(-1) || {}).answers || {};
      const pressRow = async (id, label) => {
        await setView(R, "review");
        const r = rowOf(id);
        const b = r && all(r, ".prow .pbtn").find((x) => txt(x).trim() === label);
        if (!b) return false;
        await act(() => b.click());
        return true;
      };
      const clearRow = async (id) => { await setView(R, "review"); const r = rowOf(id); const b = r && r.querySelector("[data-testid=scribe-review-clear]"); if (!b || b.disabled) return false; await act(() => b.click()); return true; };
      // Typed chart text through the box (the helpers further down are declared after this block).
      const setTA = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      const typeCap = async (root, value) => {
        const input = root.querySelector("[data-testid=scribe-input]"), cap = root.querySelector("[data-testid=scribe-capture]");
        if (!input || !cap) return false;
        await act(() => { setTA.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
        await act(() => cap.click());
        return true;
      };
      const labelOf = (it, v) => (Array.isArray(it.scale) ? (it.scale[v] || {}).label : v === "yes" ? "Yes" : v === "no" ? "No" : String(v));
      const emrOpen = async () => { await setView(R, "note"); const t = q("scribe-emr-toggle"); if (t && t.getAttribute("aria-expanded") !== "true") await act(() => t.click()); };
      const emrText = () => { const f = q("scribe-emr-frame"); const ta = f ? new DOMParser().parseFromString(f.getAttribute("srcdoc") || "", "text/html").querySelector("textarea") : null; return ta ? ta.value : null; };
      // probeAns: the probe answers the test expects on record (review fix: it was always {}).
      const emrWant = (rf, probeAns = {}) => { const snap = m.log.screens.at(-1) || {}; return emr.buildEmrTemplate(module, { answers: snap.answers, ctx: snap.ctx, rf, safetyReviewed: snap.safetyReviewed, probeAns, vmp: {}, appVersion: policy.APP_VERSION }, { surface: "scribe" }); };
      const heardShown = () => all(rightCard(R), "[data-testid=scribe-heard] [data-heard]").map((el) => el.getAttribute("data-heard"));
      const railIds = () => all(rightCard(R), "[data-probe]").map((el) => el.getAttribute("data-probe"));
      const flagsBy = (how) => { const pts = (m.log.screens.at(-1) || {}).redFlags || []; const o = {}; for (const f of module.redFlags) if (pts.includes(f.points)) o[f.id] = how; return o; };
      try {
        // (a) The tab list: order, roles, the default view, one tab in the tab order.
        const labels = tabs().map((b) => txt(b).trim().replace(/\s*\(\d+\)$/, ""));
        c.diff(["Safety !", "Ask next", REVIEW_TAB, "Note", "FHIR"], labels, { at: `${at}/tabs/order` });
        const list = q("scribe-views");
        const panel = q("scribe-view-panel");
        c.check(!!list && list.getAttribute("role") === "tablist" && !!list.getAttribute("aria-label") && tabs().every((b) => b.getAttribute("role") === "tab" && b.getAttribute("aria-controls") === (panel && panel.id)),
          `${at}/tabs/roles`, null, "a labelled tablist of tabs that control the one tabpanel", list && { role: list.getAttribute("role"), label: list.getAttribute("aria-label") });
        const sel = () => tabs().filter((b) => b.getAttribute("aria-selected") === "true").map((b) => b.getAttribute("data-testid"));
        const inOrder = () => tabs().filter((b) => b.tabIndex === 0).map((b) => b.getAttribute("data-testid"));
        c.diff(["scribe-view-safety"], sel(), { at: `${at}/tabs/default` });
        c.diff(["scribe-view-safety"], inOrder(), { at: `${at}/tabs/tab-order` });
        c.check(!!panel && panel.getAttribute("role") === "tabpanel" && panel.getAttribute("aria-labelledby") === q("scribe-view-safety").id, `${at}/tabs/panel`, null, "the tabpanel labelled by the selected tab", panel && panel.getAttribute("aria-labelledby"));
        const reviewTab = q("scribe-view-review");
        c.check(!!reviewTab && reviewTab.previousElementSibling === q("scribe-view-prompts") && reviewTab.nextElementSibling === q("scribe-view-note"), `${at}/tabs/right-of-ask-next`, null,
          "right of Ask next, before Note", reviewTab && txt(reviewTab.previousElementSibling));
        // The keyboard: ArrowRight from Ask next selects and focuses the review; Home and End; ArrowLeft wraps.
        const key = async (el, k) => { await act(() => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }))); };
        await setView(R, "prompts");
        q("scribe-view-prompts").focus();
        await key(q("scribe-view-prompts"), "ArrowRight");
        c.check(sel()[0] === "scribe-view-review" && document.activeElement === q("scribe-view-review") && !!q("scribe-review-list") && inOrder().join() === "scribe-view-review",
          `${at}/keys/arrow-right`, null, "the review selected, focused, shown, the only tab in the tab order", { selected: sel(), focus: document.activeElement && document.activeElement.getAttribute("data-testid") });
        await key(q("scribe-view-review"), "End");
        c.check(sel()[0] === "scribe-view-fhir" && document.activeElement === q("scribe-view-fhir"), `${at}/keys/end`, null, "FHIR", sel());
        await key(q("scribe-view-fhir"), "ArrowRight");
        c.check(sel()[0] === "scribe-view-safety" && document.activeElement === q("scribe-view-safety"), `${at}/keys/wrap`, null, "Safety (wraps)", sel());
        await key(q("scribe-view-safety"), "ArrowLeft");
        await key(q("scribe-view-fhir"), "Home");
        c.check(sel()[0] === "scribe-view-safety" && document.activeElement === q("scribe-view-safety"), `${at}/keys/home`, null, "Safety", sel());
        // (b) Every scored item once, by domain; fresh: nothing answered, never no.
        await setView(R, "review");
        const wantIds = module.domainOrder.flatMap((k) => (module.domains.find((d) => d.key === k) || { items: [] }).items.map((it) => it.id));
        c.diff(wantIds, rowsOf().map((r) => r.getAttribute("data-review-item")), { at: `${at}/rows` });
        c.check(new Set(rowsOf().map((r) => r.getAttribute("data-review-item"))).size === rowsOf().length && rowsOf().length === module.allItems.length, `${at}/rows/once`, null, `${module.allItems.length} rows, one per scored item`, rowsOf().length);
        const groups = all(R, "[data-testid=scribe-review-list] [data-review-domain]");
        c.diff(module.domainOrder.map((k) => (module.domains.find((d) => d.key === k) || {}).label),
          groups.map((g) => { const l = document.getElementById(g.getAttribute("aria-labelledby") || ""); return g.getAttribute("role") === "group" && l ? txt(l) : null; }), { at: `${at}/domains` });
        const named = rowsOf().map((r) => { const l = document.getElementById(r.getAttribute("aria-labelledby") || ""); const it = module.itemById[r.getAttribute("data-review-item")]; return r.getAttribute("role") === "group" && !!l && txt(l) === (it.ask ?? it.text) && txt(r).includes(it.short ?? it.id); });
        c.check(named.every(Boolean), `${at}/rows/named`, null, "every row a group named by the item's Ask next question, with its short label", named.filter((x) => !x).length);
        c.check(rowsOf().every((r) => r.getAttribute("data-answered") === "false" && txt(r.querySelector("[data-testid=scribe-review-state]")) === "not answered" && r.querySelector("[data-testid=scribe-review-clear]").disabled
            && all(r, ".prow .pbtn").every((b) => b.getAttribute("aria-pressed") !== "true")), `${at}/fresh`, null, "every row not answered, nothing pressed, Clear disabled", rowsOf().slice(0, 3).map(txt));
        c.check(!R.querySelector("[data-testid=scribe-review-list] .prompt, [data-testid=scribe-review-list] [data-suggestion], [data-testid=scribe-review-list] [data-heard], [data-testid=scribe-review-list] [data-probe]"),
          `${at}/no-ask-next-cards`, null, "no Ask next card in the review", null);
        // Options: the item's own answers, then Clear.
        const optsOk = rowsOf().every((r) => { const it = module.itemById[r.getAttribute("data-review-item")]; const want = Array.isArray(it.scale) ? it.scale.map((o) => o.label) : ["Yes", "No"]; return JSON.stringify(all(r, ".prow .pbtn").map((b) => txt(b).trim())) === JSON.stringify([...want, "Clear answer"]); });
        c.check(optsOk, `${at}/options`, null, "each row: the item's scale labels or Yes / No, then Clear answer", null);
        // (c) The demo: every answered row shows its answer and "heard in encounter".
        await playAll(R);
        await setView(R, "review");
        const a1 = answers();
        const ans = Object.keys(a1);
        c.check(ans.length > 0 && ans.every((id) => stateOf(id) === `${labelOf(module.itemById[id], a1[id])} · ${SRC.heard}` && rowOf(id).getAttribute("data-source") === "heard"),
          `${at}/demo/heard`, null, `each answered row "<answer> · ${SRC.heard}"`, ans.filter((id) => stateOf(id) !== `${labelOf(module.itemById[id], a1[id])} · ${SRC.heard}`).map((id) => [id, stateOf(id)]));
        c.check(rowsOf().filter((r) => !ans.includes(r.getAttribute("data-review-item"))).every((r) => txt(r.querySelector("[data-testid=scribe-review-state]")) === "not answered"), `${at}/demo/unanswered`, null, "the rest not answered", null);
        const askNow = txt(q("scribe-view-prompts"));
        await setView(R, "review");
        c.check(txt(q("scribe-view-prompts")) === askNow, `${at}/ask-count/unchanged`, null, "the Ask next count unchanged by opening the review", txt(q("scribe-view-prompts")));
        await review(R);
        // (d) Edit a demo answer: a positive yes / no item answered "yes" becomes "no". Review fix: the
        // item is one Ask next shows among its suggestions once the answer is cleared (rankSuggestions
        // of the answers without it, the heard cards excluded as the Scribe excludes them), so step
        // (e) must find it there.
        await setView(R, "prompts");
        const heard0 = heardShown();
        const rankWithout = (a, id) => {
          const b = { ...a }; delete b[id];
          const ph = rulesE.derivePhenotype(module, b);
          return scribeE.rankSuggestions(module, { answers: b, complaint: ph.value, phenotypeError: ph.error || null, vmp: {}, scorable: scoringE.computeScore(module, b).scorable, skipped: {}, exclude: heard0 }).list.map((x) => x.id);
        };
        const cands = ans.filter((id) => { const it = module.itemById[id]; return !Array.isArray(it.scale) && it.w > 0 && a1[id] === "yes"; });
        const edit = cands.find((id) => rankWithout(a1, id).includes(id));
        if (c.check(!!edit, `${at}/edit/@item`, null, "a demo answer Yes on a positive yes / no item that Ask next shows once it is cleared", cands)) {
          const before = { readout: txt(R.querySelector(".readout")), cov: (m.log.screens.at(-1) || {}).coverage, note: await noteText(R) };
          await emrOpen();
          const emr0 = emrText();
          c.check(await pressRow(edit, "No"), `${at}/edit/press`, { item: edit }, "the row's No", null);
          const after = { readout: txt(R.querySelector(".readout")), cov: (m.log.screens.at(-1) || {}).coverage, note: await noteText(R) };
          c.check(answers()[edit] === "no", `${at}/edit/answer`, { item: edit }, "no", answers()[edit]);
          c.check(after.readout !== before.readout && after.cov === before.cov, `${at}/edit/score`, { item: edit }, "the readout moves, coverage unchanged (still answered)", { before, after: { readout: after.readout, cov: after.cov } });
          c.check(after.note !== before.note, `${at}/edit/note`, { item: edit }, "the encounter note follows", "unchanged");
          await emrOpen();
          const w = emrWant(flagsBy("nlp"));
          c.check(emrText() === w && w !== emr0, `${at}/edit/emr`, { item: edit }, "the EMR template = buildEmrTemplate of the edited answers, and it moved", (emrText() || "").slice(0, 80));
          await setView(R, "review");
          c.check(stateOf(edit) === `No · ${SRC.review} edited` && !!rowOf(edit).querySelector("[data-testid=scribe-review-edited]")
              && txt(rowOf(edit).querySelector(".sa-scribe-qr-first")) === `First recorded: Yes · ${SRC.heard}`
              && all(rowOf(edit), ".prow .pbtn").find((b) => txt(b).trim() === "No").getAttribute("aria-pressed") === "true",
            `${at}/edit/row`, { item: edit }, `No · ${SRC.review}, edited, "First recorded: Yes · ${SRC.heard}", No pressed`, { state: stateOf(edit), first: txt(rowOf(edit).querySelector(".sa-scribe-qr-first")) });
          // Choosing the current answer changes nothing.
          const snapN = m.log.screens.length;
          await pressRow(edit, "No");
          c.check(m.log.screens.length === snapN && answers()[edit] === "no", `${at}/edit/same-answer`, { item: edit }, "no new screen", m.log.screens.length - snapN);
          // (e) Clear: unanswered again (never no), coverage down, back in the attainable range.
          const covBefore = (m.log.screens.at(-1) || {}).coverage;
          c.check(await clearRow(edit), `${at}/clear/press`, { item: edit }, "Clear answer", null);
          c.check(answers()[edit] === undefined && (m.log.screens.at(-1) || {}).coverage < covBefore, `${at}/clear/answer`, { item: edit }, "unanswered, coverage down", { answer: answers()[edit], coverage: [covBefore, (m.log.screens.at(-1) || {}).coverage] });
          c.check(stateOf(edit) === `not answered · ${SRC.review} edited` && rowOf(edit).querySelector("[data-testid=scribe-review-clear]").disabled && rowOf(edit).getAttribute("data-answered") === "false",
            `${at}/clear/row`, { item: edit }, `not answered · ${SRC.review}, edited, Clear disabled`, stateOf(edit));
          await emrOpen();
          c.check(emrText() === emrWant(flagsBy("nlp")), `${at}/clear/emr`, { item: edit }, "the EMR template = buildEmrTemplate without the answer", (emrText() || "").slice(0, 80));
          // Back to Ask next (review fix: this check passed whenever the item was not shown): the
          // suggestions shown are exactly rankSuggestions for the published answers with no skip and
          // the heard cards excluded, and the cleared item is shown again.
          await setView(R, "prompts");
          const heardIds = heardShown();
          const shown = all(rightCard(R), "[data-testid=scribe-suggestions] [data-suggestion]").map((el) => el.getAttribute("data-suggestion"));
          const snap = m.log.screens.at(-1) || {};
          const ranked = scribeE.rankSuggestions(module, { answers: snap.answers, complaint: snap.phenotype, phenotypeError: null, vmp: {}, scorable: snap.scorable, skipped: {}, exclude: heardIds }).list.map((x) => x.id);
          c.diff(ranked, shown, { at: `${at}/clear/ask-next/ranked` });
          c.check(shown.includes(edit) || heardIds.includes(edit), `${at}/clear/ask-next`, { item: edit }, "the cleared item shown again in Ask next", { shown, heard: heardIds, ranked });
          // And answered from Ask next again: the source reads "Ask next".
          const card = rightCard(R).querySelector(`.prompt[data-suggestion="${edit}"]`);
          if (c.check(!!card, `${at}/ask-next/card`, { item: edit }, "its Ask next card", "absent")) {
            await act(() => card.querySelector(".pbtn.y").click());
            await setView(R, "review");
            c.check(stateOf(edit) === `Yes · ${SRC.askNext}` && !rowOf(edit).querySelector("[data-testid=scribe-review-edited]"), `${at}/ask-next/source`, { item: edit }, `Yes · ${SRC.askNext}, no edited chip`, stateOf(edit));
          }
        }
        // (f) An answer from Ask next takes its item off the suggestions and shows its source; a skip shows as skipped.
        await setView(R, "prompts");
        const sugs = all(rightCard(R), ".prompt[data-suggestion]").filter((el) => module.itemById[el.getAttribute("data-suggestion")]);
        if (sugs.length >= 2) {
          const [s1, s2] = sugs;
          const id1 = s1.getAttribute("data-suggestion"), id2 = s2.getAttribute("data-suggestion");
          await act(() => s1.querySelector(".prow .pbtn:not(.skip)").click());
          await setView(R, "prompts");
          const sk = rightCard(R).querySelector(`.prompt[data-suggestion="${id2}"] [data-testid=scribe-skip]`);
          if (c.check(!!sk, `${at}/ask-next/skip-button`, { item: id2 }, "the second suggestion still shown", "gone")) await act(() => sk.click());
          await setView(R, "review");
          c.check(stateOf(id1) === `${labelOf(module.itemById[id1], answers()[id1])} · ${SRC.askNext}`, `${at}/ask-next/answered`, { item: id1 }, `<answer> · ${SRC.askNext}`, stateOf(id1));
          c.check(stateOf(id2) === "not answered · skipped in Ask next", `${at}/ask-next/skipped`, { item: id2 }, "not answered · skipped in Ask next", stateOf(id2));
          // A review answer to the skipped item goes the Ask next way: answered, off the suggestions.
          const it2 = module.itemById[id2];
          const lab2 = Array.isArray(it2.scale) ? it2.scale[0].label : "No";
          await pressRow(id2, lab2);
          c.check(answers()[id2] !== undefined && stateOf(id2) === `${lab2} · ${SRC.review} edited` && !txt(rowOf(id2)).includes("First recorded"), `${at}/review-answers-skipped`, { item: id2 }, `${lab2} · ${SRC.review}, edited, nothing first recorded`, stateOf(id2));
          await setView(R, "prompts");
          c.check(!rightCard(R).querySelector(`.prompt[data-suggestion="${id2}"]`), `${at}/review-answer/off-suggestions`, { item: id2 }, "off the suggestions", "still suggested");
          // Review fix: clearing it in the review drops its skip as well (the row no longer says
          // skipped), so it is back in Ask next; skipped there again, the row says so although a
          // review edit is on record (it read as the review edit only).
          c.check(await clearRow(id2), `${at}/review-clear/press`, { item: id2 }, "Clear answer", null);
          c.check(answers()[id2] === undefined && stateOf(id2) === `not answered · ${SRC.review} edited`, `${at}/review-clear/skip-dropped`, { item: id2 },
            `not answered · ${SRC.review}, edited (the skip dropped)`, stateOf(id2));
          await setView(R, "prompts");
          const sk2 = rightCard(R).querySelector(`.prompt[data-suggestion="${id2}"] [data-testid=scribe-skip]`);
          if (c.check(!!sk2, `${at}/review-clear/back-in-ask-next`, { item: id2 }, "its Ask next card again", "absent")) await act(() => sk2.click());
          await setView(R, "review");
          c.check(answers()[id2] === undefined && stateOf(id2) === "not answered · skipped in Ask next edited" && !!rowOf(id2).querySelector("[data-testid=scribe-review-edited]"),
            `${at}/review-clear/skipped-again`, { item: id2 }, "not answered · skipped in Ask next, the edited chip kept", stateOf(id2));
        } else c.note("question review: fewer than two suggestions left after the demo; the Ask next and skip sources not exercised here");
        // (g) A probe on the rail that writes an item: "probe".
        await setView(R, "prompts");
        const plist = (module.logic.probes || {}).list || [];
        const writer = all(rightCard(R), "[data-probe]").map((el) => [el, plist.find((pr) => String(pr.id) === el.getAttribute("data-probe"))])
          .map(([el, pr]) => [el, pr, pr ? pr.opts.findIndex((o) => o && o.a && Object.keys(o.a).length) : -1]).find(([, , k]) => k >= 0);
        if (writer) {
          const [el, pr, k] = writer;
          const written = Object.keys(pr.opts[k].a);
          await act(() => all(el, ".prow .pbtn")[k].click());
          await setView(R, "review");
          c.check(written.every((id) => rowOf(id) && rowOf(id).getAttribute("data-source") === "probe" && stateOf(id) === `${labelOf(module.itemById[id], answers()[id])} · ${SRC.probe}`),
            `${at}/probe/source`, { probe: pr.id, option: k }, `<answer> · ${SRC.probe}`, written.map((id) => [id, stateOf(id)]));
        } else c.note("question review: no live probe on the rail writes an item; the probe source is covered by the engine helper");
        // (g2) Review fix: changing or clearing an item a probe answer wrote retracts that probe answer,
        // so its note leaves the encounter note and the EMR template (= buildEmrTemplate with no probe
        // answer on record) and the probe can be asked again: the rail is then what liveProbes and
        // truncateProbes give with no probe answered.
        const railWant = () => probesE.truncateProbes(probesE.liveProbes(plist, answers(), {}, {})).flatMap((g) => g.shown.map((pr) => String(pr.id))).sort();
        await act(() => q("scribe-reset").click());
        await setView(R, "prompts");
        const noted = all(rightCard(R), "[data-probe]").map((el) => plist.find((pr) => String(pr.id) === el.getAttribute("data-probe")))
          .map((pr) => [pr, pr ? pr.opts.findIndex((o) => o && o.a && Object.keys(o.a).length && typeof o.note === "string" && o.note) : -1]).find(([, k]) => k >= 0);
        if (c.check(!!noted, `${at}/probe-retract/@probe`, null, "a probe on a fresh rail whose option writes an item and records a note", railIds())) {
          const [pr, k] = noted;
          const opt = pr.opts[k];
          const target = Object.keys(opt.a)[0];
          const it = module.itemById[target];
          const noteLine = `  - ${opt.note}`;
          const where = { probe: pr.id, option: k, item: target };
          const answerIt = async () => { await setView(R, "prompts"); const e2 = rightCard(R).querySelector(`[data-probe="${pr.id}"]`); if (!e2) return false; await act(() => all(e2, ".prow .pbtn")[k].click()); return true; };
          c.check(await answerIt(), `${at}/probe-retract/answer`, where, "the probe's option", null);
          let n = await noteText(R);
          await emrOpen();
          c.check(n.includes(noteLine) && emrText() === emrWant(flagsBy("nlp"), { [pr.id]: k }) && emrText().includes(opt.note), `${at}/probe-retract/recorded`, where,
            "the note in the encounter note, the EMR template = buildEmrTemplate with the probe answer", { note: n.includes(noteLine), emr: (emrText() || "").includes(opt.note) });
          // Cleared in the review: no note anywhere, and the probe back on the rail.
          c.check(await clearRow(target), `${at}/probe-retract/clear/press`, where, "Clear answer", null);
          n = await noteText(R);
          await emrOpen();
          c.check(answers()[target] === undefined && !n.includes(opt.note) && emrText() === emrWant(flagsBy("nlp"), {}) && !emrText().includes(opt.note), `${at}/probe-retract/clear`, where,
            "unanswered; the note gone from the encounter note and the EMR template (= buildEmrTemplate with no probe answer)", { note: n.includes(opt.note), emr: (emrText() || "").includes(opt.note) });
          await setView(R, "prompts");
          c.diff(railWant(), railIds().sort(), { at: `${at}/probe-retract/clear/rail` });
          c.check(railIds().includes(String(pr.id)), `${at}/probe-retract/clear/asked-again`, where, "the probe on the rail again", railIds());
          // Asked again, then changed in the review to another answer: retracted again.
          c.check(await answerIt(), `${at}/probe-retract/answer-again`, where, "the probe's option", null);
          c.check((await noteText(R)).includes(noteLine), `${at}/probe-retract/recorded-again`, where, "the note back in the encounter note", null);
          const choices = Array.isArray(it.scale) ? it.scale.map((o, i) => [o.label, i]) : [["Yes", "yes"], ["No", "no"]];
          const other = choices.find(([, v]) => v !== opt.a[target]);
          c.check(await pressRow(target, other[0]), `${at}/probe-retract/edit/press`, where, other[0], null);
          n = await noteText(R);
          await emrOpen();
          c.check(answers()[target] === other[1] && !n.includes(opt.note) && emrText() === emrWant(flagsBy("nlp"), {}) && !emrText().includes(opt.note), `${at}/probe-retract/edit`, where,
            "the new answer; the note gone from the encounter note and the EMR template (= buildEmrTemplate with no probe answer)", { answer: answers()[target], note: n.includes(opt.note), emr: (emrText() || "").includes(opt.note) });
          await setView(R, "review");
          c.check(stateOf(target) === `${other[0]} · ${SRC.review} edited` && txt(rowOf(target).querySelector(".sa-scribe-qr-first")) === `First recorded: ${labelOf(it, opt.a[target])} · ${SRC.probe}`,
            `${at}/probe-retract/row`, where, `${other[0]} · ${SRC.review}, edited, first recorded from the probe`, { state: stateOf(target), first: txt(rowOf(target).querySelector(".sa-scribe-qr-first")) });
          await setView(R, "prompts");
          c.diff(railWant(), railIds().sort(), { at: `${at}/probe-retract/edit/rail` });
        }
        // (g3) Review fix: a probe-keyed EMR checklist signal leaves with its probe answer. A checklist
        // signal names a probe whose option writes an item; one review answer makes that probe live.
        await act(() => q("scribe-reset").click());
        const sig = (Array.isArray(module.emrTemplate && module.emrTemplate.checklist) ? module.emrTemplate.checklist : [])
          .flatMap((row) => (Array.isArray(row && row.signals) ? row.signals : [])).map((sg) => [sg, sg && typeof sg.probe === "string" ? plist.find((pr) => pr.id === sg.probe) : null])
          .find(([sg, pr]) => pr && pr.opts[sg.option] && pr.opts[sg.option].a && Object.keys(pr.opts[sg.option].a).length);
        const valuesOf = (x) => (Array.isArray(x.scale) ? x.scale.map((o, i) => [o.label, i]) : [["Yes", "yes"], ["No", "no"]]);
        let enable = null;
        if (sig) {
          const [, pr] = sig;
          const writes = new Set(pr.opts.flatMap((o) => (o && o.a ? Object.keys(o.a) : [])));
          for (const x of module.allItems) {
            if (enable || writes.has(x.id)) continue;
            for (const [label, v] of valuesOf(x)) {
              let threw = false;
              const on = probesE.liveProbes([pr], { [x.id]: v }, {}, {}, { onError: () => { threw = true; } }).length > 0;
              if (on && !threw) { enable = { id: x.id, label }; break; }
            }
          }
        }
        if (c.check(!!sig && !!enable, `${at}/probe-checklist/@signal`, null, "a checklist signal keyed on a probe that writes an item, and one answer that makes the probe live", sig && sig[0])) {
          const [sg, pr] = sig;
          const opt = pr.opts[sg.option];
          const target = Object.keys(opt.a)[0];
          const shownAs = `via probe: ${typeof opt.note === "string" && opt.note ? opt.note : opt.l}`;
          const where = { probe: pr.id, option: sg.option, item: target, enabledBy: enable.id };
          c.check(await pressRow(enable.id, enable.label), `${at}/probe-checklist/enable`, where, enable.label, null);
          await setView(R, "prompts");
          const el = rightCard(R).querySelector(`[data-probe="${pr.id}"]`);
          if (c.check(!!el, `${at}/probe-checklist/rail`, where, "the probe on the rail", railIds())) {
            await act(() => all(el, ".prow .pbtn")[sg.option].click());
            await emrOpen();
            c.check(emrText() === emrWant(flagsBy("nlp"), { [pr.id]: sg.option }) && emrText().includes(shownAs), `${at}/probe-checklist/recorded`, where,
              `the EMR template = buildEmrTemplate with the probe answer, "${shownAs}"`, (emrText() || "").includes(shownAs));
            const other = valuesOf(module.itemById[target]).find(([, v]) => v !== opt.a[target]);
            c.check(await pressRow(target, other[0]), `${at}/probe-checklist/edit/press`, where, other[0], null);
            await emrOpen();
            c.check(answers()[target] === other[1] && emrText() === emrWant(flagsBy("nlp"), {}) && !emrText().includes(shownAs), `${at}/probe-checklist/edit`, where,
              `the EMR template = buildEmrTemplate with no probe answer, no "${shownAs}"`, (emrText() || "").includes(shownAs));
            c.check(await clearRow(target), `${at}/probe-checklist/clear/press`, where, "Clear answer", null);
            await emrOpen();
            c.check(answers()[target] === undefined && emrText() === emrWant(flagsBy("nlp"), {}) && !emrText().includes(shownAs), `${at}/probe-checklist/clear`, where,
              `cleared: the EMR template = buildEmrTemplate with no probe answer, no "${shownAs}"`, (emrText() || "").includes(shownAs));
            await setView(R, "prompts");
            c.check(railIds().includes(String(pr.id)), `${at}/probe-checklist/asked-again`, where, "the probe on the rail again once its item is cleared", railIds());
          }
        }
        // (h) Typed chart text, corrected in the review; a Clarify item card.
        await act(() => q("scribe-reset").click());
        await setView(R, "review");
        c.check(rowsOf().every((r) => r.getAttribute("data-answered") === "false" && r.getAttribute("data-source") === "" && !r.querySelector("[data-testid=scribe-review-edited]")),
          `${at}/reset`, null, "Reset: every row not answered, no source, no edited chip", rowsOf().filter((r) => r.getAttribute("data-source")).map((r) => r.getAttribute("data-review-item")));
        if (c.check(await typeCap(R, PRONOUN), `${at}/typed/capture`, { typed: PRONOUN }, "typed input and Capture", null)) {
          await setView(R, "review");
          c.check(answers()[PRONOUN_ITEM] === "yes" && stateOf(PRONOUN_ITEM) === `Yes · ${SRC.typed}`, `${at}/typed/source`, { item: PRONOUN_ITEM }, `Yes · ${SRC.typed}`, stateOf(PRONOUN_ITEM));
          const note0 = await noteText(R);
          await pressRow(PRONOUN_ITEM, "No");
          c.check(answers()[PRONOUN_ITEM] === "no" && stateOf(PRONOUN_ITEM) === `No · ${SRC.review} edited` && txt(rowOf(PRONOUN_ITEM).querySelector(".sa-scribe-qr-first")) === `First recorded: Yes · ${SRC.typed}`
              && (await noteText(R)) !== note0, `${at}/typed/corrected`, { item: PRONOUN_ITEM }, `No · ${SRC.review}, first recorded Yes · ${SRC.typed}, the note follows`, stateOf(PRONOUN_ITEM));
          await emrOpen();
          c.check(emrText() === emrWant(flagsBy("nlp")), `${at}/typed/emr`, { item: PRONOUN_ITEM }, "the EMR template = buildEmrTemplate of the corrected answers", (emrText() || "").slice(0, 80));
        }
        if (c.check(await typeCap(R, R1_TWO_CARDS), `${at}/clarify/capture`, { typed: R1_TWO_CARDS }, "typed input and Capture", null)) {
          const ic = all(R, "[data-testid=scribe-clarify] .sa-scribe-clarify-card").find((el) => el.getAttribute("data-clarify-kind") === "item");
          if (c.check(!!ic, `${at}/clarify/item-card`, null, "an item card", null)) {
            const target = ic.getAttribute("data-target");
            const no = all(ic, ".prow .pbtn").find((b) => txt(b).trim() === "No") || all(ic, ".prow .pbtn:not(.skip)")[0];
            await act(() => no.click());
            await setView(R, "review");
            c.check(answers()[target] !== undefined && rowOf(target).getAttribute("data-source") === "clarify" && stateOf(target) === `${labelOf(module.itemById[target], answers()[target])} · ${SRC.clarify}`,
              `${at}/clarify/source`, { item: target }, `<answer> · ${SRC.clarify}`, stateOf(target));
          }
        }
        // (i) The dirty summary counts review edits: an answer given in the review, then cleared, still leaves work.
        await act(() => q("scribe-reset").click());
        const any = module.allItems.find((it) => !Array.isArray(it.scale));
        await pressRow(any.id, "Yes");
        c.check(/1 answer/.test(m.log.dirty.at(-1) || ""), `${at}/dirty/answer`, null, "1 answer", m.log.dirty.at(-1));
        await clearRow(any.id);
        c.check((m.log.dirty.at(-1) || "") === "screen in progress", `${at}/dirty/cleared`, null, "screen in progress", m.log.dirty.at(-1));
        await act(() => q("scribe-reset").click());
        c.check(m.log.dirty.at(-1) === null, `${at}/dirty/reset`, null, null, m.log.dirty.at(-1));
      } finally { host.remove(); m.unmount(); }
      c.note("question review: the tab list and keys, every scored item once by domain, the demo's heard sources, an edit and a clear moving the answers, readout, coverage, note and EMR template, Ask next (the cleared item shown again), skip (also after a review clear), probe, typed chart text and Clarify sources, a probe-written item changed and cleared (the probe answer, its note and its checklist entry retracted), the dirty summary and Reset");
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
        for (const id of ["scribe-listen", "scribe-play", "scribe-step", "scribe-input", "scribe-capture", "scribe-clarify"]) c.check(!q(id), `/shape/${id}`, null, "hidden", "shown");
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
    // The entry box is a textarea since release 0.4.7: its own native value setter (HTMLInputElement's
    // throws "Illegal invocation" on a textarea), then one input event, as typing or a paste does.
    const setNativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    const typeInto = async (root, value) => {
      const input = root.querySelector("[data-testid=scribe-input]");
      if (!input) return null;
      await act(() => { setNativeValue.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
      return input;
    };
    const typeAndCapture = async (root, value) => {
      const cap = root.querySelector("[data-testid=scribe-capture]");
      if (!cap || !(await typeInto(root, value))) return false;
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
      if (!has031) c.note("demo block: the 0.3.1 reference walk ran on the shipped module (revertLexiconChain failed)");
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
        // The shipped footer (review F5, tests): the lexicon axis moved to 0.3.3 (release 0.4.7),
        // instrument and probe set did not, and the gold set was re-run on this lexicon (no "not re-run").
        const footer = txt(R.querySelector("[data-testid=scribe-footer]")) || "";
        c.check(footer.includes(SHIPPED_FOOTER_VERSIONS), `${at}/footer/versions`, null, SHIPPED_FOOTER_VERSIONS, footer);
        c.check(footer.includes(`extraction lexicon ${module.rubric.lexicon && module.rubric.lexicon.version} `), `${at}/footer/lexicon`, null,
          `extraction lexicon ${module.rubric.lexicon && module.rubric.lexicon.version}`, footer);
        c.check(!footer.includes("not re-run"), `${at}/footer/gold-set`, null, "benchmarked on this lexicon", footer);
      } finally { m.unmount(); }
    }
    c.note(`heard / carry / yield: 18 blocks on the shipped module (lexicon ${module.rubric.lexicon && module.rubric.lexicon.version})`);

    // ------------------------------------------------------------------ typed chart text and Clarify
    // Release 0.4.7 (spec 0.4.7 §3.8, §5, §6), on the shipped module.
    // 10. Typed text is chart text: it never arms, consumes or carries into the slot. The control
    // shows the same two lines carry when both are patient speech.
    await block("typed-control", [["pt", DIZZY], ["pt", "a few hours"]], async (m, R, at) => {
      if (!(await steps(R, 2, at))) return;
      c.check(answersOf(m.log)[HEARD_ID] === 2, `${at}/carried`, null, 2, answersOf(m.log)[HEARD_ID]);
    });
    await block("typed-chart", [["pt", "a few hours"]], async (m, R, at) => {
      if (!c.check(await typeAndCapture(R, DIZZY), `${at}/typed`, null, "typed input and Capture", null)) return;
      const tags = heardTags(R);
      c.check(tags.length === 1 && txt(tags[0]) === HEARD_TAG, `${at}/heard-tag`, null, HEARD_TAG, tags.map(txt));
      if (!(await steps(R, 1, at))) return;
      ingested(R, at, 2, "a few hours");
      c.check(answersOf(m.log)[HEARD_ID] === undefined, `${at}/no-carry`, { typed: DIZZY, spoken: "a few hours" }, undefined, answersOf(m.log)[HEARD_ID]);
      c.check(capTags(R).length === 0, `${at}/no-captag`, null, [], capTags(R).map(txt));
      // The item is still asked: by its heard card, or (review round 1) by the open Clarify card of the
      // probe that re-asks it (a rescue card and the heard card are one target, shown once).
      const rescueCard = all(R, "[data-testid=scribe-clarify] .sa-scribe-clarify-card[data-clarify-kind=probe]").find((el) => {
        const pr = ((module.logic && module.logic.probes && module.logic.probes.list) || []).find((p) => p && p.id === el.getAttribute("data-target"));
        return !!pr && pr.rescues === HEARD_ID;
      });
      await setView(R, "prompts");
      c.check(!!heardCard(R) !== !!rescueCard, `${at}/card-stays`, null, "the item still asked once: its heard card or the Clarify card re-asking it", { heard: !!heardCard(R), clarify: !!rescueCard });
      await setView(R, "safety");
    });

    // 10b. A pronoun in typed chart text names the patient (clauses.chartIgnoreThirdParty, read only with
    // { chart: true }, which the Scribe passes to extractInContext and clarifyCues); the same line
    // spoken is still attributed to someone else.
    await block("typed-pronoun", [["pt", "a few hours"]], async (m, R, at) => {
      if (!c.check(await typeAndCapture(R, PRONOUN), `${at}/typed`, null, "typed input and Capture", null)) return;
      c.check(answersOf(m.log)[PRONOUN_ITEM] === "yes", `${at}/recorded`, { typed: PRONOUN }, "yes", answersOf(m.log)[PRONOUN_ITEM]);
      const cards = all(R, "[data-testid=scribe-clarify] .sa-scribe-clarify-card").map((el) => el.getAttribute("data-clarify"));
      c.check(cards.includes(PRONOUN_CARD), `${at}/clarify-card`, { typed: PRONOUN }, `a ${PRONOUN_CARD} card`, cards);
    });
    await block("typed-pronoun-spoken", [["pt", PRONOUN]], async (m, R, at) => {
      if (!(await steps(R, 1, at))) return;
      c.check(answersOf(m.log)[PRONOUN_ITEM] === undefined, `${at}/attributed`, { spoken: PRONOUN }, undefined, answersOf(m.log)[PRONOUN_ITEM]);
      c.check(!R.querySelector("[data-testid=scribe-clarify]"), `${at}/no-clarify`, null, "no Clarify section (spoken lines are never read for clarification)", null);
    });

    // 11. The lead's history and physical pasted through the real box: the textarea keeps its lines,
    // Enter is a newline, an IME composition never captures, Ctrl+Enter captures; the lead's checks
    // hold on the published answers; the Clarify cards are clarifyPrompts' (clause quoted, question,
    // the probe's or item's own answers, Skip), under the box, outside the transcript and Ask next,
    // never twice (their probes and items leave Ask next while open); answers go through the probe or
    // the item and the card leaves; Skip records nothing; Reset clears them; then the lead's example.
    {
      const at = "/clarify";
      const [xE, sE, pE, emr, policy] = await Promise.all([h.engine("extraction.js"), h.engine("scribe.js"), h.engine("probes.js"), h.engine("emr.js"), h.engine("policy.js")]);
      let gold = null;
      try { gold = await h.fixture(GOLD_0_4_0_FIXTURE, "json"); } catch (err) { c.check(false, `${at}/@gold`, null, GOLD_0_4_0_FIXTURE, String(err.message)); }
      const hpCase = gold && Array.isArray(gold.cases) ? gold.cases.find((k) => k && k.utteranceId === HP_CASE) : null;
      const probeById = new Map(probeList.map((p) => [String(p.id), p]));
      if (c.check(!!hpCase && typeof hpCase.text === "string" && hpCase.text.includes("not pulsatile"), `${at}/@hp`, null, `gold 0.4.0 ${HP_CASE}, the lead's history and physical`, hpCase && hpCase.utteranceId)) {
        const HP = hpCase.text;
        const HPT = HP.trim();   // what Capture ingests
        const cues = xE.clarifyCues(module.lexicon, HPT, { chart: true });
        const want = sE.clarifyPrompts(module, cues, {});
        c.diff(HP_CARD_IDS, want.map((w) => w.id), { at: `${at}/hp/engine-cards` });
        const m = mountNew(module);
        const R = m.container;
        const q = (id) => R.querySelector(`[data-testid=${id}]`);
        const cardsOf = () => all(R, "[data-testid=scribe-clarify] .sa-scribe-clarify-card");
        const cardOf = (id) => cardsOf().find((el) => el.getAttribute("data-clarify") === id) || null;
        const answerBtn = (el, i) => (el ? all(el, ".prow .pbtn").filter((b) => !b.classList.contains("skip"))[i] || null : null);
        const quoteOf = (w) => `“${w.evidence}”` + (w.against && typeof w.against.evidence === "string" ? `and“${w.against.evidence}”` : "");
        const key = async (box, init) => act(() => box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init })));
        const flagRow = (id) => R.querySelector(`.rf[data-flag="${id}"]`);
        try {
          c.check(!q("scribe-clarify"), `${at}/hp/none-before`, null, "no Clarify section before a capture", "shown");
          const box = q("scribe-input");
          if (!c.check(!!box && box.tagName === "TEXTAREA" && box.rows === 8, `${at}/textarea`, null, "a textarea with 8 rows", box && `${box.tagName.toLowerCase()} rows ${box.rows}`)) return c.result();
          c.check(/chart note/.test(box.placeholder) && /Ctrl\+Enter/.test(box.placeholder) && box.getAttribute("aria-keyshortcuts") === "Control+Enter Meta+Enter",
            `${at}/textarea/hint`, null, "placeholder names a chart note and Ctrl+Enter; aria-keyshortcuts", { placeholder: box.placeholder, keys: box.getAttribute("aria-keyshortcuts") });
          const capBtn = q("scribe-capture");
          c.check(!!capBtn && txt(capBtn).trim() === "Capture", `${at}/capture-button`, null, "Capture", capBtn && txt(capBtn).trim());
          // Paste: every line kept; the draft counts as unsaved work.
          await typeInto(R, HP);
          c.check(box.value === HP, `${at}/hp/paste`, null, `${HP.split("\n").length} lines kept`, `${box.value.split("\n").length} lines`);
          c.check((m.log.dirty.at(-1) || "").includes(DRAFT_DIRTY), `${at}/hp/dirty-draft`, null, DRAFT_DIRTY, m.log.dirty.at(-1));
          await key(box, {});
          c.check(lines(R).length === 0, `${at}/hp/enter-is-newline`, null, "no capture on Enter", lines(R).length);
          await key(box, { ctrlKey: true, isComposing: true });
          c.check(lines(R).length === 0, `${at}/hp/ime`, null, "no capture while composing", lines(R).length);
          await key(box, { ctrlKey: true });
          if (!c.check(lines(R).length === 1, `${at}/hp/ctrl-enter`, null, "one line captured on Ctrl+Enter", lines(R).length)) return c.result();
          c.check(box.value === "" && !(m.log.dirty.at(-1) || "").includes(DRAFT_DIRTY), `${at}/hp/box-cleared`, null, "an empty box, no draft in the dirty summary", { value: box.value.slice(0, 40), dirty: m.log.dirty.at(-1) });
          c.check(bubText(lines(R)[0]) === HPT, `${at}/hp/bubble`, null, `the note, ${HPT.split("\n").length} lines`, (bubText(lines(R)[0]) || "").split("\n").length);
          // The lead's checks, on what the Scribe publishes and shows.
          const snap = m.log.screens.at(-1) || {};
          const ans = snap.answers || {};
          c.diff(HP_LEAD_CHECKS, Object.fromEntries(Object.keys(HP_LEAD_CHECKS).map((k) => [k, ans[k]])), { at: `${at}/hp/the-lead's-checks` });
          c.diff([], HP_ABSENT.filter((k) => ans[k] !== undefined), { at: `${at}/hp/absent` });
          const denied = flagRow(HP_DENIED_FLAG);
          c.check(!!denied && denied.getAttribute("aria-checked") === "false" && !(snap.redFlags || []).includes(module.flagById[HP_DENIED_FLAG].points),
            `${at}/hp/denied-flag`, { flag: HP_DENIED_FLAG }, "not raised (“not pulsatile”)", denied && denied.getAttribute("aria-checked"));
          // Bubble tags: one clarify tag per cue, never a captag.
          const ctags = all(R, ".tsc .sa-scribe-clarifytag");
          c.diff(cues.map((cue) => sE.clarifyLabel(module, cue)), ctags.map(txt), { at: `${at}/hp/bubble-tags` });
          c.check(ctags.every((t) => !t.classList.contains("captag") && !t.classList.contains("sa-scribe-heardtag")), `${at}/hp/bubble-tags/class`, null, "their own class", ctags.map((t) => t.className));
          // The section and its cards.
          const sec = q("scribe-clarify");
          if (!c.check(!!sec, `${at}/hp/section`, null, "the Clarify section", "absent")) return c.result();
          c.check(txt(sec.querySelector(".sa-scribe-clarify-cap")) === CLARIFY_CAPTION, `${at}/hp/caption`, null, CLARIFY_CAPTION, txt(sec.querySelector(".sa-scribe-clarify-cap")));
          const entry = R.querySelector(".sa-scribe-entry");
          c.check(!!entry && entry.nextElementSibling === sec && leftCard(R).contains(sec) && !R.querySelector(".tsc").contains(sec) && !rightCard(R).contains(sec),
            `${at}/hp/place`, null, "right under the box, in the encounter card, outside the transcript", null);
          const shown = cardsOf().map((el) => ({ id: el.getAttribute("data-clarify"), quote: txt(el.querySelector(".sa-scribe-clarify-quote")), ask: txt(el.querySelector(".qq")),
            labels: all(el, ".prow .pbtn").filter((b) => !b.classList.contains("skip")).map(txt),
            control: txt(el.querySelector("[data-testid=scribe-clarify-skip]") || el.querySelector("[data-testid=scribe-clarify-dismiss]")) }));
          // Review round 2: a question card ends with Skip; the template-text notice has Dismiss only.
          c.diff(want.map((w) => ({ id: w.id, quote: quoteOf(w), ask: w.ask, labels: w.opts.map((o) => o.label), control: w.kind === "note" ? "Dismiss" : "Skip" })), shown, { at: `${at}/hp/cards` });
          const nNotes = want.filter((w) => w.kind === "note").length;
          c.check(nNotes === 1 && txt(q("scribe-clarify-status")) === `${want.length - nNotes} questions to clarify, 1 notice`, `${at}/hp/status`, null,
            `${want.length - nNotes} questions to clarify, 1 notice`, txt(q("scribe-clarify-status")));
          c.check(cardsOf().every((el) => el.matches(".prompt.sa-scribe-clarify-card") && !el.hasAttribute("data-suggestion") && !el.hasAttribute("data-heard") && !el.hasAttribute("data-probe")),
            `${at}/hp/cards/attributes`, null, "no data-suggestion / data-heard / data-probe", cardsOf().map((el) => el.getAttributeNames().join(" ")));
          c.check(lines(R).length === 1, `${at}/hp/not-transcript-rows`, null, 1, lines(R).length);
          // Never twice: a probe or item an open card asks is not in Ask next; the rail is live
          // (a carded probe would be on it: liveProbes says so), so the check is not vacuous.
          const rfNow = {};
          for (const f of module.redFlags) { const row = flagRow(f.id); if (row && row.getAttribute("aria-checked") === "true") rfNow[f.id] = "nlp"; }
          const live = new Set(pE.liveProbes(probeList, ans, rfNow, {}).map((p) => String(p.id)));
          await setView(R, "prompts");
          let carded = 0;
          for (const w of want) {
            const rc = rightCard(R);
            if (w.kind === "probe") {
              if (live.has(String(w.target))) carded++;
              c.check(!rc.querySelector(`[data-probe="${w.target}"]`), `${at}/hp/once/probe/${w.target}`, { card: w.id }, "not on the Ask next rail", "shown");
              const ti = (probeById.get(String(w.target)) || {}).target;
              if (typeof ti === "string") c.check(!rc.querySelector(`[data-suggestion="${ti}"]`), `${at}/hp/once/item/${ti}`, { card: w.id }, "not suggested", "shown");
            } else if (w.kind === "item") {
              c.check(!rc.querySelector(`[data-suggestion="${w.target}"]`), `${at}/hp/once/item/${w.target}`, { card: w.id }, "not suggested", "shown");
            }
          }
          c.check(carded > 0, `${at}/hp/once/@live`, null, "at least one carded probe is live (it would be on the rail)", carded);
          c.check(all(rightCard(R), "[data-probe]").length > 0, `${at}/hp/once/rail`, null, "the rail still shows the other live probes", 0);
          const n = all(R, "[data-testid=scribe-heard] .prompt[data-heard]").length + all(R, "[data-testid=scribe-suggestions] .prompt[data-suggestion]").length;
          c.check(askLabel(R) === (n ? `Ask next (${n})` : "Ask next"), `${at}/hp/view-count`, { n }, n ? `Ask next (${n})` : "Ask next", askLabel(R));
          await setView(R, "safety");
          // Layout, with the container attached off screen (computed styles need a document).
          {
            const host = document.createElement("div");
            host.style.cssText = "position:fixed;left:-10000px;top:0;width:960px;height:900px;overflow:hidden";
            document.body.appendChild(host);
            host.appendChild(R);
            try {
              const cs = getComputedStyle(box);
              c.diff({ resize: "vertical", minHeight: "200px", overflowY: "auto", whiteSpace: "pre-wrap", maxHeight: `${Math.round(window.innerHeight * 0.6)}px` },
                { resize: cs.resize, minHeight: cs.minHeight, overflowY: cs.overflowY, whiteSpace: cs.whiteSpace, maxHeight: `${Math.round(parseFloat(cs.maxHeight))}px` }, { at: `${at}/layout/textarea` });
              c.check(box.offsetHeight >= 200, `${at}/layout/textarea/height`, null, ">= 200 px", box.offsetHeight);
              c.check(getComputedStyle(R.querySelector(".tsc .row.pt .bub")).whiteSpace === "pre-wrap", `${at}/layout/bubble`, null, "pre-wrap", getComputedStyle(R.querySelector(".tsc .row.pt .bub")).whiteSpace);
              const lc = leftCard(R);
              c.check(lc.scrollWidth <= lc.clientWidth, `${at}/layout/no-overflow`, null, `scrollWidth <= ${lc.clientWidth}`, lc.scrollWidth);
            } finally { host.remove(); }
          }
          // Skip a Safety probe's card: nothing recorded, the card goes, the probe is back on the rail.
          const before = JSON.stringify(answersOf(m.log));
          const sk = cardOf(HP_SKIP_PROBE_CARD);
          const skProbe = want.find((w) => w.id === HP_SKIP_PROBE_CARD);
          if (c.check(!!sk && !!skProbe, `${at}/skip/card`, { card: HP_SKIP_PROBE_CARD }, "the card", null)) {
            await act(() => sk.querySelector("[data-testid=scribe-clarify-skip]").click());
            c.check(!cardOf(HP_SKIP_PROBE_CARD) && JSON.stringify(answersOf(m.log)) === before, `${at}/skip/nothing-recorded`, null, "card gone, answers unchanged", { card: !!cardOf(HP_SKIP_PROBE_CARD), answers: JSON.stringify(answersOf(m.log)) });
            await setView(R, "prompts");
            if (live.has(String(skProbe.target))) c.check(!!rightCard(R).querySelector(`[data-probe="${skProbe.target}"]`), `${at}/skip/back-on-rail`, { probe: skProbe.target }, "on the rail again", "absent");
            await setView(R, "safety");
          }
          // A probe option that raises a flag: raised as a probe flag (not "heard in encounter"); the card goes.
          const fc = cardOf(HP_FLAG_CARD);
          const fw = want.find((w) => w.id === HP_FLAG_CARD);
          const fp = fw ? probeById.get(String(fw.target)) : null;
          const flagId = fp && fp.opts[0] ? fp.opts[0].rf : null;
          if (c.check(!!fc && !!flagId, `${at}/flag/card`, { card: HP_FLAG_CARD }, "the card, option 0 raising a flag", { card: !!fc, flag: flagId })) {
            c.check(answerBtn(fc, 0).classList.contains("n"), `${at}/flag/button-class`, null, "pbtn n (raises a flag)", answerBtn(fc, 0).className);
            await act(() => answerBtn(fc, 0).click());
            const row = flagRow(flagId);
            c.check(!cardOf(HP_FLAG_CARD), `${at}/flag/card-gone`, null, "gone", "shown");
            c.check(!!row && row.getAttribute("aria-checked") === "true" && !row.querySelector(".tier.heard"), `${at}/flag/raised`, { flag: flagId }, "raised, not marked heard in encounter",
              row && { checked: row.getAttribute("aria-checked"), heard: !!row.querySelector(".tier.heard") });
          }
          // A probe option that writes an item: the answer is the probe's; the card goes.
          const wc = cardOf(HP_WRITE_CARD);
          const ww = want.find((w) => w.id === HP_WRITE_CARD);
          const wp = ww ? probeById.get(String(ww.target)) : null;
          const writes = wp && wp.opts[0] && wp.opts[0].a ? wp.opts[0].a : null;
          if (c.check(!!wc && !!writes, `${at}/write/card`, { card: HP_WRITE_CARD }, "the card, option 0 writing an answer", { card: !!wc, writes })) {
            await act(() => answerBtn(wc, 0).click());
            const a = answersOf(m.log);
            c.diff(writes, Object.fromEntries(Object.keys(writes).map((k) => [k, a[k]])), { at: `${at}/write/answer` });
            c.check(!cardOf(HP_WRITE_CARD), `${at}/write/card-gone`, null, "gone", "shown");
          }
          // An item card: "No" through answerPrompt; the card goes.
          const ic = cardOf(HP_ITEM_CARD);
          const iw = want.find((w) => w.id === HP_ITEM_CARD);
          if (c.check(!!ic && !!iw && iw.kind === "item", `${at}/item/card`, { card: HP_ITEM_CARD }, "an item card", iw && iw.kind)) {
            const noIdx = iw.opts.findIndex((o) => o.value === "no");
            c.check(noIdx >= 0 && txt(answerBtn(ic, noIdx)) === "No" && answerBtn(ic, noIdx).classList.contains("n"), `${at}/item/no-button`, null, "pbtn n “No”", noIdx >= 0 && answerBtn(ic, noIdx).className);
            await act(() => answerBtn(ic, noIdx).click());
            c.check(answersOf(m.log)[iw.target] === "no" && !cardOf(HP_ITEM_CARD), `${at}/item/answer`, { item: iw.target }, "no, card gone", { answer: answersOf(m.log)[iw.target], card: !!cardOf(HP_ITEM_CARD) });
          }
          // The template-text card is a notice (review round 2): the lexicon's notice text, one Dismiss
          // control, no answers and no Skip; Dismiss records nothing.
          const pc = cardOf(HP_NOTE_CARD);
          const noticeText = module.lexicon.clauses && module.lexicon.clauses.placeholderAsk && module.lexicon.clauses.placeholderAsk.text;
          if (c.check(!!pc && all(pc, ".prow .pbtn").map(txt).join("|") === "Dismiss" && !pc.querySelector("[data-testid=scribe-clarify-skip]")
              && pc.getAttribute("role") === "note" && txt(pc.querySelector(".qq")) === noticeText && noticeText === "This line holds unfilled template text (***).",
            `${at}/note/card`, null, "the template-text notice: its text, Dismiss only, role note",
            pc && { buttons: all(pc, ".prow .pbtn").map(txt), role: pc.getAttribute("role"), text: txt(pc.querySelector(".qq")) })) {
            const b2 = JSON.stringify(answersOf(m.log));
            await act(() => pc.querySelector("[data-testid=scribe-clarify-dismiss]").click());
            c.check(!cardOf(HP_NOTE_CARD) && JSON.stringify(answersOf(m.log)) === b2, `${at}/note/dismiss`, null, "notice gone, answers unchanged", null);
          }
          const gone = new Set([HP_SKIP_PROBE_CARD, HP_FLAG_CARD, HP_WRITE_CARD, HP_ITEM_CARD, HP_NOTE_CARD]);
          c.diff(HP_CARD_IDS.filter((id) => !gone.has(id)), cardsOf().map((el) => el.getAttribute("data-clarify")), { at: `${at}/remaining` });
          // The EMR template: the probe answers given on the cards print as the Ask next ones do
          // ("recorded by clinician via probe"); the text is buildEmrTemplate's for this state.
          {
            const s2 = m.log.screens.at(-1) || {};
            const rf2 = {};
            for (const f of module.redFlags) { const row = flagRow(f.id); if (row && row.getAttribute("aria-checked") === "true") rf2[f.id] = row.querySelector(".tier.heard") ? "nlp" : "probe"; }
            const probeAns2 = {};
            if (fw) probeAns2[fw.target] = 0;
            if (ww) probeAns2[ww.target] = 0;
            const w2 = emr.buildEmrTemplate(module, { answers: s2.answers, ctx: s2.ctx, rf: rf2, safetyReviewed: false, probeAns: probeAns2, vmp: {}, appVersion: policy.APP_VERSION }, { surface: "scribe" });
            await setView(R, "note");
            await act(() => q("scribe-emr-toggle").click());
            const f = q("scribe-emr-frame");
            c.check(!!f && f.getAttribute("srcdoc") === emr.emrFrameDoc(w2), `${at}/emr/srcdoc`, { probeAns: probeAns2, rf: rf2 }, "emrFrameDoc(buildEmrTemplate(module, encounter, scribe))", f && (f.getAttribute("srcdoc") || "").slice(0, 120));
            c.check(w2.includes("recorded by clinician via probe"), `${at}/emr/recorded-by-clinician`, null, "a “recorded by clinician via probe” label", null);
            await act(() => q("scribe-emr-toggle").click());
            await setView(R, "safety");
          }
          // Reset clears the cards, the transcript and the box.
          await typeInto(R, "unsent draft");
          await act(() => q("scribe-reset").click());
          c.check(!q("scribe-clarify") && lines(R).length === 0 && q("scribe-input").value === "" && m.log.dirty.at(-1) === null, `${at}/reset`, null,
            "no Clarify section, no line, an empty box, nothing dirty", { clarify: !!q("scribe-clarify"), lines: lines(R).length, box: q("scribe-input").value, dirty: m.log.dirty.at(-1) });
          // The lead's example, captured with Cmd+Enter: the lead's question verbatim, the probe's own answers.
          await typeInto(R, RUNNY);
          await key(q("scribe-input"), { metaKey: true });
          c.check(lines(R).length === 1 && bubText(lines(R)[0]) === RUNNY, `${at}/runny/captured`, null, RUNNY, bubText(lines(R)[0]));
          const rw = sE.clarifyPrompts(module, xE.clarifyCues(module.lexicon, RUNNY, { chart: true }), {});
          const rc = cardOf(RUNNY_CARD);
          const pur = rw[0] ? probeById.get(String(rw[0].target)) : null;
          if (c.check(cardsOf().length === 1 && !!rc && !!pur, `${at}/runny/card`, null, `one card, ${RUNNY_CARD}`, cardsOf().map((el) => el.getAttribute("data-clarify")))) {
            c.check(txt(rc.querySelector(".qq")) === LEAD_QUESTION, `${at}/runny/question`, null, LEAD_QUESTION, txt(rc.querySelector(".qq")));
            c.diff(pur.opts.map((o) => o.l), all(rc, ".prow .pbtn").filter((b) => !b.classList.contains("skip")).map(txt), { at: `${at}/runny/answers` });
            c.check(txt(rc.querySelector(".sa-scribe-clarify-quote")) === `“${RUNNY}”`, `${at}/runny/quote`, null, `“${RUNNY}”`, txt(rc.querySelector(".sa-scribe-clarify-quote")));
            const k = pur.opts.findIndex((o) => o.a && Object.values(o.a).includes("no"));
            const item = k >= 0 ? Object.keys(pur.opts[k].a)[0] : null;
            if (c.check(k >= 0, `${at}/runny/clear-option`, null, "an option writing no", null)) {
              await setView(R, "prompts");
              c.check(!rightCard(R).querySelector(`[data-suggestion="${item}"]`), `${at}/runny/once`, { item }, "not suggested while the card is open", "shown");
              await setView(R, "safety");
              await act(() => answerBtn(cardOf(RUNNY_CARD), k).click());
              c.check(answersOf(m.log)[item] === "no" && !q("scribe-clarify"), `${at}/runny/answered`, { option: pur.opts[k].l }, `${item} no, the section gone`, { answer: answersOf(m.log)[item], section: !!q("scribe-clarify") });
            }
          }
        } finally { m.unmount(); }
      }
    }
    // 12. Review round 1. (a) A rescue card (re-asking an item, here the dizziness kind for v_vertigo) is
    // shown only while its probe is live: not when the text records the duration, and gone once a
    // later line records it, so a card never overwrites a recorded answer; while it is open the item's
    // heard card is held back (one target). (b) A rule-out conflict card holds its probe off the rail
    // (never asked twice), the probe being live. (c) The Clarify section is a labelled region, each
    // card a group named by its question; an always-mounted status counts the cards; after a Skip,
    // focus moves to the card now first, and to the box once none is left.
    {
      const at = "/review-r1";
      const pE = await h.engine("probes.js");
      const rescueOf = (el) => { const pr = probeList.find((p) => p && p.id === el.getAttribute("data-target")); return pr && typeof pr.rescues === "string" ? pr.rescues : null; };
      const m = mountNew(module);
      const R = m.container;
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-10000px;top:0;width:960px;height:900px;overflow:hidden";
      document.body.appendChild(host);
      host.appendChild(R);
      const q = (id) => R.querySelector(`[data-testid=${id}]`);
      const cardsOf = () => all(R, "[data-testid=scribe-clarify] .sa-scribe-clarify-card");
      const rescueCards = () => cardsOf().filter((el) => rescueOf(el) === HEARD_ID);
      const ids = () => cardsOf().map((el) => el.getAttribute("data-clarify"));
      try {
        // (a)
        if (c.check(await typeAndCapture(R, R1_DURATION), `${at}/rescue/typed-duration`, null, "typed input and Capture", null)) {
          c.check(answersOf(m.log)[HEARD_ID] !== undefined && rescueCards().length === 0, `${at}/rescue/not-live-once-recorded`, { typed: R1_DURATION },
            "the duration recorded and no card re-asking it", { answer: answersOf(m.log)[HEARD_ID], cards: ids() });
        }
        await act(() => q("scribe-reset").click());
        if (c.check(await typeAndCapture(R, R1_BARE), `${at}/rescue/typed-bare`, null, "typed input and Capture", null)) {
          c.check(answersOf(m.log)[HEARD_ID] === undefined && rescueCards().length === 1, `${at}/rescue/live-while-unanswered`, { typed: R1_BARE },
            "one card re-asking the item", { answer: answersOf(m.log)[HEARD_ID], cards: ids() });
          await setView(R, "prompts");
          c.check(!heardCard(R), `${at}/rescue/heard-card-held-back`, null, "no heard card while the card re-asking its item is open", "shown");
          await setView(R, "safety");
          if (c.check(await typeAndCapture(R, R1_DURATION_LATER), `${at}/rescue/typed-later`, null, "typed input and Capture", null)) {
            c.check(answersOf(m.log)[HEARD_ID] !== undefined && rescueCards().length === 0, `${at}/rescue/gone-once-recorded`, { typed: R1_DURATION_LATER },
              "the duration recorded, the card gone", { answer: answersOf(m.log)[HEARD_ID], cards: ids() });
          }
        }
        await act(() => q("scribe-reset").click());
        // (b)
        if (c.check(await typeAndCapture(R, R1_CONFLICT), `${at}/once/typed`, null, "typed input and Capture", null)) {
          const ic = cardsOf().find((el) => el.getAttribute("data-clarify-kind") === "item" && el.getAttribute("data-reason") === "conflict");
          const item = ic ? ic.getAttribute("data-target") : null;
          const forItem = (p) => !!p && (p.target === item || p.rescues === item);
          const live = pE.liveProbes(probeList, answersOf(m.log), {}, {}).filter(forItem).map((p) => String(p.id));
          c.check(!!ic && live.length > 0, `${at}/once/@live`, { typed: R1_CONFLICT }, "a conflict card whose item has a live probe (it would be on the rail)", { card: item, live });
          await setView(R, "prompts");
          const onRail = all(rightCard(R), "[data-probe]").map((el) => el.getAttribute("data-probe")).filter((id) => forItem(probeList.find((p) => p && p.id === id)));
          c.check(onRail.length === 0, `${at}/once/conflict-card-and-rail`, { item }, "no probe for the carded item on the rail", onRail);
          await setView(R, "safety");
        }
        await act(() => q("scribe-reset").click());
        // (c)
        const st = q("scribe-clarify-status");
        c.check(!!st && txt(st) === "" && st.getAttribute("role") === "status" && st.getAttribute("aria-live") === "polite" && !q("scribe-clarify"),
          `${at}/a11y/status-mounted`, null, "an empty polite status, mounted with no card", st && { text: txt(st), role: st.getAttribute("role"), live: st.getAttribute("aria-live") });
        if (c.check(await typeAndCapture(R, R1_TWO_CARDS), `${at}/a11y/typed`, null, "typed input and Capture", null)) {
          const n = cardsOf().length;
          const sec = q("scribe-clarify");
          c.check(n >= 2 && txt(q("scribe-clarify-status")) === R1_STATUS(n), `${at}/a11y/status-count`, { typed: R1_TWO_CARDS }, R1_STATUS(n), txt(q("scribe-clarify-status")));
          const lab = sec ? document.getElementById(sec.getAttribute("aria-labelledby") || "") : null;
          c.check(!!sec && sec.getAttribute("role") === "region" && !!lab && txt(lab) === "Clarify", `${at}/a11y/region`, null, "a region labelled “Clarify”",
            sec && { role: sec.getAttribute("role"), label: lab && txt(lab) });
          const named = cardsOf().map((el) => { const l = document.getElementById(el.getAttribute("aria-labelledby") || ""); return el.getAttribute("role") === "group" && !!l && txt(l) === txt(el.querySelector(".qq")); });
          c.check(named.length === n && named.every(Boolean), `${at}/a11y/cards-are-named-groups`, null, "every card a group named by its question", named);
          const first = cardsOf()[0];
          await act(() => first.querySelector("[data-testid=scribe-clarify-skip]").click());
          const now = cardsOf();
          c.check(now.length === n - 1 && !!document.activeElement && document.activeElement.tagName === "BUTTON" && now[0].contains(document.activeElement),
            `${at}/a11y/focus-after-skip`, null, "focus on a button of the card now first", document.activeElement && document.activeElement.tagName);
          for (let k = 0; k < n && cardsOf().length; k++) await act(() => cardsOf()[0].querySelector("[data-testid=scribe-clarify-skip]").click());
          c.check(!q("scribe-clarify") && document.activeElement === q("scribe-input") && txt(q("scribe-clarify-status")) === "", `${at}/a11y/focus-back-to-the-box`, null,
            "no card left, focus on the box, the status empty", { section: !!q("scribe-clarify"), focus: document.activeElement && document.activeElement.tagName, status: txt(q("scribe-clarify-status")) });
        }
      } finally { host.remove(); m.unmount(); }
    }
    c.note("typed chart text and Clarify: the typed-chart block and its control, the lead's history and physical through the box, the lead's runny-nose example; review round 1: rescue-card liveness, never twice on a rule-out conflict card, the Clarify section's accessibility");

    return c.result();
  }),
};
