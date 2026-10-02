// Test fixture (design 03 §2.9): the logic for placeholder.rubric.json, exercising every
// optional logic family. Placeholder text only; no clinical content. Fetched as text and run
// through importSource, never imported by path.
export default {
  format: "screenair-logic",
  contractVersion: 1,
  moduleId: "placeholder",
  logicVersion: "fixture-1",
  reads: {
    items: { p_one: "boolean", p_two: { scale: 3 }, p_three: "boolean", p_four: "boolean", p_minus: "boolean" },
    domains: { first: {}, second: {}, minus: { negative: true } },
    redFlags: ["p_rf_a"],
    phenotypes: ["kind_x", "kind_y"],
    context: { p_ctx: ["b"] },
    gapMarkers: ["p_ctx"],
  },
  phenotypes: {
    derive: [
      { value: "kind_y", when: (s) => s.yes("p_three") && s.yes("p_four") },
      { value: "kind_x", when: (s) => s.yes("p_one") },
    ],
    activation: [
      { id: "second-when-y", domains: ["second", "minus"], when: (s) => s.complaint === "kind_y" || s.answered("p_three") },
    ],
  },
  routing: [
    {
      id: "example-y-high",
      when: (s) => s.complaint === "kind_y" && s.band === s.highestBand,
      copy: {
        screener: { h: "Example routing heading Y", p: "Example routing paragraph Y.", chips: (s) => s.items.first.items.map((it) => it.text) },
        scribe: { h: "Example routing heading Y", p: "Example routing paragraph Y.", chips: ["Example chip Y"] },
      },
    },
    {
      id: "example-negative",
      when: (s) => s.yes("p_minus") && s.domains.minus !== undefined,
      copy: {
        screener: { h: "Example negative heading", p: "Example negative paragraph.", chips: [] },
      },
    },
    {
      id: "example-context",
      when: (s) => s.ctx.p_ctx === "b" && s.scale("p_two") !== null,
      copy: {
        scribe: { h: "Example context heading", p: (s) => "Example context paragraph " + s.total + ".", chips: [] },
      },
    },
    {
      id: "example-fallback",
      fallback: true,
      copy: {
        screener: { h: "Example fallback heading", p: "Example fallback paragraph.", chips: [] },
        scribe: { h: "Example fallback heading", p: "Example fallback paragraph.", chips: [] },
      },
    },
  ],
  patientSummary: {
    groups: { firstYes: ["p_one", "p_three"], secondYes: ["p_four"] },
    derived: {
      twoOften: (s) => s.scale("p_two") === 2,
    },
    said: [
      { id: "said-first", when: (s) => s.groups.firstYes.length > 0, text: (s) => s.S.first + " " + s.L(s.groups.firstYes.map((id) => s.S.words[id])) + "." },
      { id: "said-two", when: (s) => s.twoOften, text: (s) => s.S.twoOften },
    ],
    ask: [
      { id: "ask-four", when: (s) => s.yes("p_four"), text: (s) => s.S.askFour },
      { id: "ask-default", text: (s) => s.S.askDefault },
    ],
  },
  locales: {
    en: { sum: { first: "Example summary:", words: { p_one: "example one", p_three: "example three" }, twoOften: "Example sentence for level two.", askFour: "Example question to bring.", askDefault: "Example default question to bring." } },
    es: { sum: { first: "Resumen de ejemplo:", words: { p_one: "ejemplo uno", p_three: "ejemplo tres" }, twoOften: "Frase de ejemplo para el nivel dos.", askFour: "Pregunta de ejemplo para llevar.", askDefault: "Pregunta de ejemplo por defecto." } },
  },
  probes: {
    version: "0.1.0",
    list: [
      { id: "pr_safety", kind: "safety", when: (a, rf) => !rf.p_rf_a, say: "Example safety probe?", why: "Example why safety.",
        opts: [{ l: "Example yes", rf: "p_rf_a" }, { l: "Example no" }] },
      { id: "pr_rescue", kind: "rescue", rescues: "p_one", when: (a) => a.p_one === undefined || a.p_one === "no", say: "Example rescue probe?", why: "Example why rescue.",
        opts: [{ l: "Example yes", a: { p_one: "yes" } }, { l: "Example unsure", note: "Example note." }] },
      { id: "pr_criteria", kind: "criteria", target: "p_two", when: (a) => a.p_two === undefined, say: "Example criteria probe?", why: "Example why criteria.",
        opts: [{ l: "Example often", a: { p_two: 2 } }, { l: "Example never", a: { p_two: 0 } }] },
      { id: "pr_pheno", kind: "phenotype", when: (a) => a.p_three === "yes", say: "Example phenotype probe?", why: "Example why phenotype.",
        opts: [{ l: "Example noted", note: "Example supporting note." }] },
    ],
  },
};
