// Mutation generators V31-V39: locales, identity, research, caveats, copy (design 03 §4.14,
// §8.3 `validate`). WP3. Placeholder text only.

export default [
  {
    code: "V31", sev: "E", path: "/locales/fr", what: "an unsupported locale",
    build: (ctx) => { const r = ctx.rubric(); r.locales.fr = { reviewed: false, items: {} }; return { rubric: r }; },
  },
  {
    code: "V31", sev: "E", path: "/locales/es/reviewed", what: "reviewed is not a boolean",
    build: (ctx) => { const r = ctx.rubric(); r.locales.es.reviewed = "no"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V32", sev: "E", path: "/locales/en/items/p_two/opts", what: "patient options of the wrong length",
    build: (ctx) => { const r = ctx.rubric(); r.locales.en.items.p_two.opts = ["Example never", "Example often"]; return { rubric: r }; },
  },
  {
    code: "V32", sev: "E", path: "/locales/en/items/p_three", what: "an item without English patient wording",
    build: (ctx) => { const r = ctx.rubric(); delete r.locales.en.items.p_three; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V32", sev: "E", path: "/locales/en/items/p_one/clin", what: "a clinician line in English (English takes patientClin; release 0.4.2)",
    build: (ctx) => { const r = ctx.rubric(); r.locales.en.items.p_one.clin = "Example clinician line."; return { rubric: r }; },
  },
  {
    code: "V32", sev: "E", path: "/locales/es/items/p_one/clin", what: "an empty translated clinician line (release 0.4.2)",
    build: (ctx) => { const r = ctx.rubric(); r.locales.es.items.p_one.clin = " "; return { rubric: r }; },
  },
  {
    code: "V33", sev: "E", path: "/locales/es/items/p_one/help", what: "a reviewed locale falling back to English",
    build: (ctx) => { const r = ctx.rubric(); r.locales.es.reviewed = true; return { rubric: r }; },
  },
  {
    code: "V33", sev: "W", path: "/locales/es/items/p_four/q", what: "an unreviewed locale falling back to English",
    build: (ctx) => { const r = ctx.rubric(); delete r.locales.es.items.p_four; return { rubric: r }; },
  },
  {
    code: "V34", sev: "E", path: "/locales/en/redFlags/p_rf_a/points", what: "clinician points inside patient wording",
    build: (ctx) => { const r = ctx.rubric(); r.locales.en.redFlags.p_rf_a.points = "Example"; return { rubric: r }; },
  },
  {
    code: "V35", sev: "E", path: "/fhir/codeSystem", what: "a code system that is not an absolute URL",
    build: (ctx) => { const r = ctx.rubric(); r.fhir.codeSystem = "{id}-codes"; return { rubric: r }; },
  },
  {
    code: "V35", sev: "E", path: "/fhir/questionnaireTitle", what: "an empty Questionnaire title",
    build: (ctx) => { const r = ctx.rubric(); r.fhir.questionnaireTitle = ""; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V36", sev: "E", path: "/cds/examples/redFlagPresent/flagId", what: "a CDS example naming an unknown flag",
    build: (ctx) => { const r = ctx.rubric(); r.cds.examples.redFlagPresent.flagId = "p_rf_z"; return { rubric: r }; },
  },
  {
    code: "V36", sev: "E", path: "/cds/examples/settled/band", what: "a settled example in the wrong band",
    build: (ctx) => { const r = ctx.rubric(); r.cds.examples.settled.score = 40; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V37", sev: "E", path: "/research/threshold", what: "a threshold outside (0, 1)",
    build: (ctx) => { const r = ctx.rubric(); r.research.threshold = 1.5; return { rubric: r }; },
  },
  {
    code: "V37", sev: "E", path: "/research/population", what: "population estimates on a plain upload",
    build: (ctx) => {
      const r = ctx.rubric();
      r.research.population = { index: "./data/example.index.json", schema: "./etl/example.schema.json", map: "./etl/example.map.json" };
      return { rubric: r, origin: "uploaded", classification: { kind: "uploaded", root: null, origin: "uploaded", row: 7, reasons: [] } };
    },
  },
  {
    code: "V37", sev: "E", path: "/research/fairnessPolicyOverride/minGroupN", what: "a fairness override beyond the three tolerances",
    build: (ctx) => {
      const r = ctx.rubric();
      r.research.fairnessPolicyOverride = { minGroupN: 5, toleranceSetBy: "Example", toleranceRationale: "Example", toleranceSetOn: "2026-10-02" };
      return { rubric: r, via: "shape" };
    },
  },
  {
    code: "V38", sev: "E", path: "/copy/indexName", what: "a caveat string in module copy",
    build: (ctx) => { const r = ctx.rubric(); r.copy.indexName = "Example index — prototype · not for clinical use"; return { rubric: r }; },
  },
  {
    code: "V38", sev: "E", path: "/logic/routing/0/copy/scribe/p", what: "a caveat string in logic data",
    build: (ctx) => { const l = ctx.logic(); l.routing[0].copy.scribe.p = "Example paragraph. Traducción sin revisar."; return { rubric: ctx.rubric(), logic: l }; },
  },
  // Release 0.4.2: the Spanish caveats are engine-owned too (CAVEATS.patient.*.es/esShort,
  // editedWording.es, staleTranslation.es, prototypeCompanion.es and the bare phrase).
  {
    code: "V38", sev: "E", path: "/locales/es/items/p_one/clin", what: "the Spanish companion of the prototype marker in a translated clinician line",
    build: (ctx) => { const r = ctx.rubric(); r.locales.es.items.p_one.clin = `Línea de ejemplo. ${ctx.CAVEATS.prototypeCompanion.es}`; return { rubric: r }; },
  },
  {
    code: "V38", sev: "E", path: "/locales/es/ui/forYouIf/0", what: "a Spanish patient provenance marker in patient wording",
    build: (ctx) => { const r = ctx.rubric(); r.locales.es.ui = { forYouIf: [`Ejemplo, ${ctx.CAVEATS.patient.uploaded.esShort}`, "Ejemplo dos", "Ejemplo tres"] }; return { rubric: r }; },
  },
  {
    code: "V38", sev: "E", path: "/locales/es/redFlags/p_rf_a/say", what: "the Spanish stale-translation notice in red-flag advice",
    build: (ctx) => { const r = ctx.rubric(); r.locales.es.redFlags.p_rf_a.say = `Consejo de ejemplo. ${ctx.CAVEATS.staleTranslation.es}`; return { rubric: r }; },
  },
  {
    code: "V38", sev: "E", path: "/logic/locales/es/sum/twoOften", what: "the bare Spanish phrase of the marker in a logic sum string",
    build: (ctx) => { const l = ctx.logic(); l.locales.es.sum.twoOften = "Frase de ejemplo, no apto para uso clínico."; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    // V38 matches after NFD, removing the combining marks and lower-casing both sides.
    code: "V38", sev: "E", path: "/locales/es/items/p_one/q", what: "a Spanish patient caveat typed without its accents",
    build: (ctx) => {
      const r = ctx.rubric();
      const bare = ctx.CAVEATS.patient.edited.es.normalize("NFD").replace(/\p{M}/gu, "");
      if (bare === ctx.CAVEATS.patient.edited.es) throw new Error("the caveat has no accent to strip");
      r.locales.es.items.p_one.q = `Pregunta de ejemplo uno? ${bare}`;
      return { rubric: r };
    },
  },
  {
    code: "V39", sev: "E", path: "/copy/screener/title", what: "a placeholder the slot does not allow",
    build: (ctx) => { const r = ctx.rubric(); r.copy.screener.title = "Example title {total}"; return { rubric: r }; },
  },
  {
    code: "V39", sev: "E", path: "/copy/screener/emrDetails/0", what: "unbalanced bold markers",
    build: (ctx) => { const r = ctx.rubric(); r.copy.screener.emrDetails[0] = "**Example. Example detail."; return { rubric: r, via: "shape" }; },
  },
];
