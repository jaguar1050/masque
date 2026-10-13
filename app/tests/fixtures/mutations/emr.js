// Mutation generators V61: the EMR template data (release 0.4.3; design 03 §4.14, §8.3 `validate`).
// Placeholder text only; nothing here is clinical content or a real citation.
//
// withEmrTemplate(ctx) returns the base rubric with a valid emrTemplate block (every shape the
// validator reads: citations, a label and a note reference, instrument recs, red-flag references
// and a red-flag placeholder, item (with a qualifier), label and probe history rows, a checklist row
// with item, scale and probe signals, a qualifier, a placeholder and onlyWithSignal, a status row
// without a box, an exam row tied to an exam probe, and (release 0.4.8) a plan-advice line with its
// source and date; instrumentRecs names a rule whose chips are fixed lists on every surface). withEmrLogic(ctx) returns the base logic with that exam probe (pr_exam) added:
// the base logic has none. The validate suite also asserts that this block, on that logic, alone
// produces no V61 finding, so every generator below proves one rule and nothing else.

const CITE = (n) => ({
  title: `Example title ${n}`,
  publisher: "Example publisher",
  citation: `Example author. Example title ${n}. Example journal. 2026.`,
  url: `https://example.org/citation-${n}`,
  accessed: "2026-10-06",
});

export function withEmrTemplate(ctx) {
  const r = ctx.rubric();
  r.emrTemplate = {
    citations: { "EX-A": CITE("a"), "EX-B": CITE("b") },
    references: [
      { label: "Example reference", citations: ["EX-A"] },
      { note: "Example note line.", citations: ["EX-B"], showFor: { phenotypes: ["kind_x"] } },
    ],
    instrumentRecs: ["example-fallback"],
    redFlagRefs: { p_rf_a: ["EX-A"] },
    redFlagPlaceholders: { p_rf_a: "Example workup detail" },
    history: [{ item: "p_one", qualifier: "example history qualifier" }, { label: "Example history heading" }, { label: "Example probe heading", probe: "pr_pheno" }],
    checklist: [
      { id: "ex_one", group: "example", label: "Example checklist row", placeholder: "example detail", onlyWithSignal: true, citations: ["EX-A"],
        signals: [
          { item: "p_one", value: "yes", render: "done" },
          { item: "p_two", value: 1, render: "note", qualifier: "example qualifier" },
          { probe: "pr_pheno", option: 0, render: "note" },
        ] },
      { id: "ex_two", group: "example", label: "Example second row", citations: ["EX-B"], signals: [] },
      { id: "ex_three", group: "example", label: "Example status row", box: false, citations: ["EX-B"], signals: [] },
    ],
    examRows: [{ label: "Example exam row", citations: ["EX-B"], probe: "pr_exam" }],
    planAdvice: [{ text: "example plan advice line.", source: "example source", decided: "2026-10-12" }],
  };
  return r;
}

/** The base logic with one exam probe (pr_exam, list index 4), which the valid block's exam row names. */
export function withEmrLogic(ctx) {
  const l = ctx.logic();
  l.probes.list.push({ id: "pr_exam", kind: "exam", when: (a) => a.p_one === "yes", say: "Example exam manoeuvre.", why: "Example why exam.",
    opts: [{ l: "Example finding", note: "Example exam note." }, { l: "Example deferred" }] });
  return l;
}

/** A mutated copy: `fn(emrTemplate, rubric, logic)` edits the valid block (or its logic) in place. */
const mutate = (fn, extra = {}) => (ctx) => {
  const r = withEmrTemplate(ctx);
  const l = withEmrLogic(ctx);
  fn(r.emrTemplate, r, l);
  return { rubric: r, logic: l, ...extra };
};

export default [
  {
    code: "V61", sev: "E", path: "/emrTemplate", what: "emrTemplate that is not an object",
    build: (ctx) => { const r = ctx.rubric(); r.emrTemplate = ["example"]; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/extra", what: "an unknown emrTemplate key",
    build: mutate((t) => { t.extra = { example: true }; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/citations/EX-A/url", what: "a citation URL that is not https",
    build: mutate((t) => { t.citations["EX-A"].url = "http://example.org/citation-a"; }, { via: "shape" }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/citations/EX-A/accessed", what: "an accessed date that is not YYYY-MM-DD",
    build: mutate((t) => { t.citations["EX-A"].accessed = "6 October 2026"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/citations/EX-A/title", what: "a citation without a title",
    build: mutate((t) => { delete t.citations["EX-A"].title; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/citations/EX-A/publisher", what: "a citation with a blank publisher",
    build: mutate((t) => { t.citations["EX-A"].publisher = "  "; }),
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/citations/EX-A/status", what: "an unknown citation field",
    build: mutate((t) => { t.citations["EX-A"].status = "verified"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/citations/ex-lower", what: "a citation key outside /^[A-Z0-9][A-Za-z0-9-]*$/",
    build: mutate((t) => { t.citations["ex-lower"] = CITE("c"); t.references[0].citations.push("ex-lower"); }),
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/citations/EX-C", what: "a citation nothing uses",
    build: mutate((t) => { t.citations["EX-C"] = CITE("c"); }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/references/0/citations/1", what: "a reference citing a key that is not in citations",
    build: mutate((t) => { t.references[0].citations.push("EX-NOPE"); }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/references/0/citations", what: "a reference with no citation",
    build: mutate((t) => { t.references[0].citations = []; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/references/0", what: "a reference with both a label and a note",
    build: mutate((t) => { t.references[0].note = "Example note."; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/references/1/showFor/phenotypes/0", what: "a reference shown for an unknown phenotype",
    build: mutate((t) => { t.references[1].showFor.phenotypes = ["kind_nope"]; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/references/0/label", what: "square brackets in a label (the template's placeholder syntax)",
    build: mutate((t) => { t.references[0].label = "Example [reference]"; }, { via: "shape" }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/citations/EX-B/citation", what: "curly braces in a citation (template syntax)",
    build: mutate((t) => { t.citations["EX-B"].citation = "Example {author}. Example title b."; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/redFlagRefs/p_rf_nope", what: "references for a red flag the module does not have",
    build: mutate((t) => { t.redFlagRefs.p_rf_nope = ["EX-A"]; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/history/0/item", what: "a history row naming an unknown item",
    build: mutate((t) => { t.history[0].item = "p_nope"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/history/1", what: "a history row with both an item and a label",
    build: mutate((t) => { t.history[1].item = "p_one"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/1/id", what: "a duplicate checklist id",
    build: mutate((t) => { t.checklist[1].id = "ex_one"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/label", what: "a checklist row without a label",
    build: mutate((t) => { t.checklist[0].label = ""; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/0/value", what: "a yes/no signal value that is not yes or no",
    build: mutate((t) => { t.checklist[0].signals[0].value = "maybe"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/1/value", what: "a scale signal value outside the scale",
    build: mutate((t) => { t.checklist[0].signals[1].value = 99; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/0/render", what: "an unknown signal render",
    build: mutate((t) => { t.checklist[0].signals[0].render = "ticked"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/0/item", what: "a signal naming an unknown item",
    build: mutate((t) => { t.checklist[0].signals[0].item = "p_nope"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/0", what: "a signal naming both an item and a probe",
    build: mutate((t) => { t.checklist[0].signals[0].probe = "pr_pheno"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/2/probe", what: "a signal naming a probe the logic does not have",
    build: mutate((t) => { t.checklist[0].signals[2].probe = "pr_nope"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/2/option", what: "a signal naming an option the probe does not have",
    build: mutate((t) => { t.checklist[0].signals[2].option = 5; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/examRows/0/probe", what: "an exam row tied to a probe the logic does not have",
    build: mutate((t) => { t.examRows[0].probe = "pr_nope"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/examRows/0/label", what: "an exam row without a label",
    build: mutate((t) => { delete t.examRows[0].label; }),
  },
  // Round 1 of the 0.4.3 review: the keys and fields the fixer added, the exam-kind rule and the
  // logic strings the template prints.
  {
    code: "V61", sev: "E", path: "/emrTemplate/examRows/0/probe", what: "an exam row tied to a probe that is not an exam probe",
    build: mutate((t) => { t.examRows[0].probe = "pr_pheno"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/instrumentRecs/0", what: "instrument recs naming a routing rule the logic does not have",
    build: mutate((t) => { t.instrumentRecs[0] = "example-nope"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/instrumentRecs/1", what: "a routing rule listed twice in instrument recs",
    build: mutate((t) => { t.instrumentRecs.push("example-fallback"); }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/redFlagPlaceholders/p_rf_nope", what: "a workup placeholder for a red flag the module does not have",
    build: mutate((t) => { t.redFlagPlaceholders.p_rf_nope = "Example workup"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/redFlagPlaceholders/p_rf_a", what: "a blank workup placeholder",
    build: mutate((t) => { t.redFlagPlaceholders.p_rf_a = " "; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/history/2/probe", what: "a history row tied to a probe the logic does not have",
    build: mutate((t) => { t.history[2].probe = "pr_nope"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/history/0/probe", what: "a probe on an item history row",
    build: mutate((t) => { t.history[0].probe = "pr_pheno"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/placeholder", what: "a blank checklist placeholder",
    build: mutate((t) => { t.checklist[0].placeholder = ""; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/2/box", what: "a checklist box that is not true or false",
    build: mutate((t) => { t.checklist[2].box = "no"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/1/qualifier", what: "a blank signal qualifier",
    build: mutate((t) => { t.checklist[0].signals[1].qualifier = "  "; }),
  },
  // Round 2 of the 0.4.3 review: a signal's render must match its answer's polarity, instrumentRecs
  // may name only rules with fixed chips, history rows carry no citations (a qualifier on item rows
  // only), and onlyWithSignal.
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/0/render", what: "a done signal on a negative yes/no answer (it would tick the row with the positive wording)",
    build: mutate((t) => { t.checklist[0].signals[0].value = "no"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/1/render", what: "a note signal on a negative scale option (f 0)",
    build: mutate((t) => { t.checklist[0].signals[1].value = 0; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/3/render", what: "an answeredNo signal on a positive answer",
    build: mutate((t) => { t.checklist[0].signals.push({ item: "p_one", value: "yes", render: "answeredNo" }); }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/signals/0/render", what: "a neverTried signal on an item (never tried comes from a probe only)",
    build: mutate((t) => { t.checklist[0].signals[0].render = "neverTried"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/instrumentRecs/0", what: "instrument recs naming a routing rule that computes its chips",
    build: mutate((t) => { t.instrumentRecs[0] = "example-y-high"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/history/1/citations", what: "citations on a history row (never printed)",
    build: mutate((t) => { t.history[1].citations = ["EX-A"]; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/history/1/qualifier", what: "a qualifier on a label history row",
    build: mutate((t) => { t.history[1].qualifier = "example qualifier"; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/history/0/qualifier", what: "a blank history qualifier",
    build: mutate((t) => { t.history[0].qualifier = " "; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/checklist/0/onlyWithSignal", what: "onlyWithSignal that is not true or false",
    build: mutate((t) => { t.checklist[0].onlyWithSignal = "yes"; }),
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/checklist/1/onlyWithSignal", what: "an onlyWithSignal row without signals (never printed)",
    build: mutate((t) => { t.checklist[1].onlyWithSignal = true; }),
  },
  // Round 4 of the 0.4.3 review: a key the engine never reads, one generator per row kind (W).
  {
    code: "V61", sev: "W", path: "/emrTemplate/references/0/extra", what: "an unknown reference field (never read)",
    build: mutate((t) => { t.references[0].extra = "example"; }),
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/history/0/extra", what: "an unknown history-row field (never read)",
    build: mutate((t) => { t.history[0].extra = "example"; }),
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/checklist/0/extra", what: "an unknown checklist-row field (never read)",
    build: mutate((t) => { t.checklist[0].extra = "example"; }),
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/checklist/0/signals/0/option", what: "a probe field on an item signal (never read)",
    build: mutate((t) => { t.checklist[0].signals[0].option = 0; }),
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/checklist/0/signals/2/value", what: "an item field on a probe signal (never read)",
    build: mutate((t) => { t.checklist[0].signals[2].value = "yes"; }),
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/examRows/0/extra", what: "an unknown exam-row field (never read)",
    build: mutate((t) => { t.examRows[0].extra = "example"; }),
  },
  // Release 0.4.8: the plan-advice lines (text printed beside the references; source and decided
  // are the line's record).
  {
    code: "V61", sev: "E", path: "/emrTemplate/planAdvice", what: "planAdvice that is not a list",
    build: mutate((t) => { t.planAdvice = { text: "example plan advice line." }; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/planAdvice/0", what: "a plan-advice line that is not an object",
    build: mutate((t) => { t.planAdvice = ["example plan advice line."]; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/planAdvice/0/text", what: "a plan-advice line with a blank text",
    build: mutate((t) => { t.planAdvice[0].text = "  "; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/planAdvice/0/text", what: "square brackets in a plan-advice text (the template's placeholder syntax)",
    build: mutate((t) => { t.planAdvice[0].text = "example [plan] advice line."; }, { via: "shape" }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/planAdvice/0/source", what: "a plan-advice line that names no source",
    build: mutate((t) => { delete t.planAdvice[0].source; }),
  },
  {
    code: "V61", sev: "E", path: "/emrTemplate/planAdvice/0/decided", what: "a plan-advice date that is not a real YYYY-MM-DD date",
    build: mutate((t) => { t.planAdvice[0].decided = "2026-02-30"; }),
  },
  {
    code: "V61", sev: "W", path: "/emrTemplate/planAdvice/0/extra", what: "an unknown plan-advice field (never read)",
    build: mutate((t) => { t.planAdvice[0].extra = "example"; }),
  },
  {
    code: "V61", sev: "W", path: "/infoPrompts/prompts/0/tag", what: "square brackets in an info-prompt tag the template prints",
    build: (ctx) => { const r = ctx.rubric(); r.infoPrompts.prompts[0].tag += " [example]"; return { rubric: r }; },
  },
  {
    code: "V61", sev: "W", path: "/logic/probes/list/3/say", what: "square brackets in a probe question the template prints",
    build: (ctx) => { const l = ctx.logic(); l.probes.list[3].say = "Example [phenotype] probe?"; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V61", sev: "W", path: "/logic/probes/list/3/opts/0/l", what: "square brackets in a probe option label the template prints",
    build: (ctx) => { const l = ctx.logic(); l.probes.list[3].opts[0].l = "Example [noted]"; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V61", sev: "W", path: "/logic/probes/list/3/opts/0/note", what: "square brackets in a probe note the template prints",
    build: (ctx) => { const l = ctx.logic(); l.probes.list[3].opts[0].note = "Example [supporting] note."; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V61", sev: "W", path: "/logic/routing/0/copy/scribe/chips/0", what: "square brackets in a routing chip the template prints",
    build: (ctx) => { const l = ctx.logic(); l.routing[0].copy.scribe.chips = ["Example [chip] Y"]; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V61", sev: "W", path: "/logic/routing/0/copy/screener/h", what: "square brackets in a routing heading the template prints",
    build: (ctx) => { const l = ctx.logic(); l.routing[0].copy.screener.h = "Example [routing] heading Y"; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V61", sev: "W", path: "/redFlags/0/text", what: "square brackets in a module string the template prints",
    build: (ctx) => { const r = ctx.rubric(); r.redFlags[0].text += " [example]"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V61", sev: "W", path: "/fhir/documentTitle", what: "square brackets in the document title the template prints",
    build: (ctx) => { const r = ctx.rubric(); r.fhir.documentTitle = "Example [document] title"; return { rubric: r }; },
  },
];
