// Mutation generators V21-V30: red flags, steps, phenotypes, lexicon (design 03 §4.14,
// §8.3 `validate`). WP3. Placeholder text only.

export default [
  {
    code: "V21", sev: "E", path: "/redFlags/0/tier", what: "an unknown tier",
    build: (ctx) => { const r = ctx.rubric(); r.redFlags[0].tier = "soon"; return { rubric: r }; },
  },
  {
    code: "V21", sev: "E", path: "/redFlags", what: "no red flags at all",
    build: (ctx) => { const r = ctx.rubric(); r.redFlags = []; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V22", sev: "E", path: "/redFlags/0/w", what: "a red flag carrying a weight",
    build: (ctx) => { const r = ctx.rubric(); r.redFlags[0].w = 3; return { rubric: r }; },
  },
  {
    code: "V23", sev: "E", path: "/locales/en/redFlags/p_rf_b", what: "no English patient wording for a flag",
    build: (ctx) => { const r = ctx.rubric(); delete r.locales.en.redFlags.p_rf_b; return { rubric: r }; },
  },
  {
    code: "V23", sev: "W", path: "/locales/es/redFlags/p_rf_b", what: "a flag falling back to English",
    build: (ctx) => { const r = ctx.rubric(); delete r.locales.es.redFlags.p_rf_b; return { rubric: r }; },
  },
  {
    code: "V24", sev: "E", path: "/locales/en/redFlags/p_rf_a/say", what: "patient wording repeating the clinician points",
    build: (ctx) => { const r = ctx.rubric(); r.locales.en.redFlags.p_rf_a.say = "Example advice about example point a."; return { rubric: r }; },
  },
  {
    code: "V25", sev: "E", path: "/steps/screener", what: "no result step",
    build: (ctx) => { const r = ctx.rubric(); r.steps.screener.pop(); return { rubric: r }; },
  },
  {
    code: "V25", sev: "E", path: "/steps/screener/1/extras/0", what: "a complaint picker without phenotypes",
    build: (ctx) => {
      const r = ctx.rubric(); delete r.phenotypes; delete r.steps.screener[1].requires;
      for (const s of r.sampleCases) delete s.complaint;
      return { rubric: r, via: "shape" };
    },
  },
  {
    code: "V26", sev: "E", path: "/steps/patient/2/domainKeys/0", what: "a domain in two patient steps",
    build: (ctx) => { const r = ctx.rubric(); r.steps.patient[2].domainKeys = ["first", "second", "minus"]; return { rubric: r }; },
  },
  {
    code: "V26", sev: "E", path: "/steps/patient/0/kind", what: "a patient step of kind result",
    build: (ctx) => { const r = ctx.rubric(); r.steps.patient[0].kind = "result"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V27", sev: "E", path: "/phenotypes/scribeDefault", what: "scribeDefault outside the values",
    build: (ctx) => { const r = ctx.rubric(); r.phenotypes.scribeDefault = "kind_z"; return { rubric: r }; },
  },
  {
    code: "V27", sev: "E", path: "/phenotypes/referral/byPhenotype/kind_z", what: "a referral for an unknown phenotype",
    build: (ctx) => { const r = ctx.rubric(); r.phenotypes.referral.byPhenotype.kind_z = { specialty: "Example", reason: "Example" }; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V27", sev: "E", path: "/phenotypes/values/0/value", what: "a phenotype value that names an Object.prototype property (audit e1)",
    build: (ctx) => {
      const r = ctx.rubric(); r.phenotypes.values[0].value = "toString"; r.phenotypes.scribeDefault = "toString";
      for (const s of r.sampleCases) if (s.complaint === "kind_x") s.complaint = "toString";
      return { rubric: r, via: "shape" };
    },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/redFlags/p_rf_b", what: "a red flag with an empty phrase list",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.redFlags.p_rf_b = []; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/bands/0/v", what: "a scale band value out of range",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].bands[0].v = 3; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/ctx/0/val", what: "a context phrase value outside the clinician options",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.ctx[0].val = "z"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V29", sev: "E", path: "/lexicon/bool/0/ph/0", what: "an uppercase phrase",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.bool[0].ph[0] = "Example Item One"; return { rubric: r }; },
  },
  {
    code: "V29", sev: "W", path: "/lexicon/bool/1/ph/0", what: "a phrase under 3 characters",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.bool[1].ph[0] = "ex"; return { rubric: r }; },
  },
  {
    code: "V30", sev: "E", path: "/lexicon/negation/window", what: "a zero negation window",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.negation.window = 0; return { rubric: r }; },
  },
  {
    code: "V30", sev: "E", path: "/lexicon/lang", what: "a malformed language tag",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.lang = "english"; return { rubric: r, via: "shape" }; },
  },
];
