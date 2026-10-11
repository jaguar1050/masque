// Mutation generators V21-V30: red flags, steps, phenotypes, lexicon (design 03 §4.14,
// §8.3 `validate`). WP3. Placeholder text only.
//
// Release 0.4.5: V27 covers phenotypes.referral.clinicianRules (the clinician rules printed in the
// EMR template; the engine escalates nothing). withClinicianRules(ctx) returns the base rubric with
// a valid rule (every field the engine reads); the validate suite asserts it alone produces no V27
// finding, so each generator below that starts from it proves one rule.

/** The base rubric with one valid clinician rule (release 0.4.5). */
export function withClinicianRules(ctx) {
  const r = ctx.rubric();
  r.phenotypes.referral.clinicianRules = [{
    phenotypes: ["kind_y"],
    source: "Example source, 2026-10-07",
    rule: "Example rule text.",
    definition: ["Example definition line one.", "Example definition line two."],
    clarificationSource: "Example source, 2026-10-09",
    clarification: ["Example clarification line."],
    confirm: ["Example condition one", "Example condition two"],
  }];
  return r;
}

/** A mutated copy of the valid rule: `fn(rule, rubric)` edits it in place. */
const clinicianRule = (fn, extra = {}) => (ctx) => {
  const r = withClinicianRules(ctx);
  fn(r.phenotypes.referral.clinicianRules[0], r);
  return { rubric: r, ...extra };
};
const CR = "/phenotypes/referral/clinicianRules";

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
  // Release 0.4.5: the clinician rules of the referral table.
  {
    code: "V27", sev: "E", path: CR, what: "clinicianRules that is not a list",
    build: (ctx) => { const r = ctx.rubric(); r.phenotypes.referral.clinicianRules = { phenotypes: ["kind_y"] }; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V27", sev: "E", path: `${CR}/0`, what: "a clinician rule that is not an object",
    build: (ctx) => { const r = ctx.rubric(); r.phenotypes.referral.clinicianRules = ["kind_y"]; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/phenotypes/0`, what: "a clinician rule for an unknown phenotype",
    build: clinicianRule((e) => { e.phenotypes = ["kind_z"]; }, { via: "shape" }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/phenotypes`, what: "a clinician rule naming no phenotype",
    build: clinicianRule((e) => { e.phenotypes = []; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/phenotypes/1`, what: "a phenotype named twice",
    build: clinicianRule((e) => { e.phenotypes = ["kind_y", "kind_y"]; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/rule`, what: "a rule text with a square-bracket placeholder",
    build: clinicianRule((e) => { e.rule = "Example rule [text]."; }, { via: "shape" }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/rule`, what: "an empty rule text",
    build: clinicianRule((e) => { e.rule = " "; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/definition/1`, what: "a definition line with template braces",
    build: clinicianRule((e) => { e.definition[1] = "Example {definition} line."; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/definition/0`, what: "an empty definition line",
    build: clinicianRule((e) => { e.definition[0] = ""; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/clarification`, what: "an empty clarification list",
    build: clinicianRule((e) => { e.clarification = []; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/clarification/0`, what: "a clarification line with a square-bracket placeholder",
    build: clinicianRule((e) => { e.clarification[0] = "Example [clarification]."; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/confirm`, what: "confirm that is not a list",
    build: clinicianRule((e) => { e.confirm = "Example condition one"; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/source`, what: "a rule shown without its source",
    build: clinicianRule((e) => { delete e.source; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/source`, what: "an empty source",
    build: clinicianRule((e) => { e.source = ""; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0/clarificationSource`, what: "a clarification shown without its source",
    build: clinicianRule((e) => { delete e.clarificationSource; }),
  },
  {
    code: "V27", sev: "E", path: `${CR}/0`, what: "a clinician rule that prints nothing",
    build: clinicianRule((e) => { for (const k of ["source", "rule", "definition", "clarificationSource", "clarification", "confirm"]) delete e[k]; }),
  },
  {
    code: "V27", sev: "W", path: `${CR}/0/clarificationSource`, what: "a clarification source without a clarification",
    build: clinicianRule((e) => { delete e.clarification; }),
  },
  {
    code: "V27", sev: "W", path: `${CR}/0/extra`, what: "a clinician-rule field the engine never reads",
    build: clinicianRule((e) => { e.extra = "Example"; }),
  },
  {
    code: "V27", sev: "W", path: `${CR}/0/evidence`, what: "escalation evidence, which the engine never reads (it escalates nothing)",
    build: clinicianRule((e) => { e.evidence = [{ probe: "pr_rescue", options: [0] }]; }),
  },
  {
    code: "V27", sev: "W", path: `${CR}/0/to`, what: "an escalation destination, which the engine never reads (it escalates nothing)",
    build: clinicianRule((e) => { e.to = { specialty: "Example escalated specialty", reason: "Example reason Y" }; }),
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
  // Heard signal, carry-over, the yield rule, carry refusal and text normalization (lexicon
  // scale fields and top-level lexicon fields, design 05 §5.2, §7.5, §11.6). The base p_two is
  // scale[0] with options f = 0 / 0.5 / 1 and bands v 2 and 1; the yes/no entries are p_one,
  // p_three, p_four and p_minus.
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/heard", what: "heard that is not a boolean",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].heard = "yes"; return { rubric: r }; },
  },
  {
    code: "V28", sev: "W", path: "/lexicon/scale/0/heard", what: "heard on an entry with a fallback",
    build: (ctx) => { const r = ctx.rubric(); const e = r.lexicon.scale[0]; e.heard = true; e.fallback = 1; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/carry", what: "carry outside 1 to 3",
    build: (ctx) => { const r = ctx.rubric(); const e = r.lexicon.scale[0]; e.heard = true; e.carry = 9; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/carry", what: "carry without heard",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].carry = 2; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/carry", what: "carry on an entry whose band records an f = 0 option",
    build: (ctx) => { const r = ctx.rubric(); const e = r.lexicon.scale[0]; e.heard = true; e.carry = 2; e.bands[1].v = 0; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/yieldTo", what: "an empty yieldTo",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].yieldTo = []; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/yieldTo/0", what: "yieldTo naming no lexicon entry",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].yieldTo = ["p_missing"]; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/yieldTo/0", what: "an entry yielding to itself",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].yieldTo = ["p_two"]; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/yieldTo/1", what: "yieldTo listing an id twice",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].yieldTo = ["p_one", "p_one"]; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/yieldTo", what: "a yield cycle between two scale entries",
    build: (ctx) => {
      const r = ctx.rubric();
      r.domains[0].items.push({
        id: "p_cycle", w: 10, text: "Example cycle item", short: "Example cycle",
        scale: [{ label: "Example cycle level 0", f: 0 }, { label: "Example cycle level 1", f: 1 }],
      });
      r.domains[0].max += 10;
      r.locales.en.items.p_cycle = { q: "Example patient question cycle?", opts: ["Example cycle no", "Example cycle yes"] };
      r.lexicon.scale.push({ id: "p_cycle", cue: ["example cycle"], bands: [{ ph: ["example cycle high"], v: 1 }], fallback: null, yieldTo: ["p_two"] });
      r.lexicon.scale[0].yieldTo = ["p_cycle"];
      return { rubric: r };
    },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/anchor", what: "anchor without yieldTo",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].anchor = ["example anchor"]; return { rubric: r }; },
  },
  {
    code: "V29", sev: "E", path: "/lexicon/scale/0/anchor/0", what: "an uppercase anchor phrase",
    build: (ctx) => { const r = ctx.rubric(); const e = r.lexicon.scale[0]; e.yieldTo = ["p_one"]; e.anchor = ["Example Anchor"]; return { rubric: r }; },
  },
  // carryExclude (round 2 R3a): band phrases of the entry that never supply a carried value.
  // p_two's bands hold "example high level" (v 2) and "example some level" (v 1).
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/carryExclude", what: "carryExclude without carry",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].carryExclude = ["example high level"]; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/carryExclude", what: "an empty carryExclude",
    build: (ctx) => { const r = ctx.rubric(); const e = r.lexicon.scale[0]; e.heard = true; e.carry = 2; e.carryExclude = []; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/carryExclude/0", what: "carryExclude naming no band phrase of the entry",
    build: (ctx) => { const r = ctx.rubric(); const e = r.lexicon.scale[0]; e.heard = true; e.carry = 2; e.carryExclude = ["example not a band"]; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/carryExclude/0", what: "an uppercase carryExclude phrase",
    build: (ctx) => { const r = ctx.rubric(); const e = r.lexicon.scale[0]; e.heard = true; e.carry = 2; e.carryExclude = ["Example High Level"]; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/carryExclude/1", what: "carryExclude listing a phrase twice",
    build: (ctx) => { const r = ctx.rubric(); const e = r.lexicon.scale[0]; e.heard = true; e.carry = 2; e.carryExclude = ["example high level", "example high level"]; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/scale/0/carryExclude/0", what: "carryExclude naming a band phrase that was removed",
    build: (ctx) => {
      const r = ctx.rubric(); const e = r.lexicon.scale[0]; e.heard = true; e.carry = 2;
      e.bands[1].ph.push("example other level"); e.carryExclude = ["example other level"]; e.bands[1].ph.pop();
      return { rubric: r };
    },
  },
  {
    code: "V28", sev: "W", path: "/lexicon/scale/0/yeildTo", what: "a misspelt scale field",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.scale[0].yeildTo = ["p_one"]; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/carryRefuse", what: "carryRefuse that is not a phrase list",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.carryRefuse = "x"; return { rubric: r }; },
  },
  {
    code: "V28", sev: "W", path: "/lexicon/carryRefuse", what: "carryRefuse with no carry anywhere",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.carryRefuse = ["example refusal"]; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/normalize", what: "normalize that is not an object",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.normalize = "x"; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/normalize/foo", what: "an unknown normalize option",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.normalize = { foo: true }; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/normalize/apostrophes", what: "normalize.apostrophes that is not a boolean",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.normalize = { apostrophes: "yes" }; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/normalize/numbers", what: "normalize.numbers other than \"en\"",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.normalize = { numbers: "fr" }; return { rubric: r }; },
  },
  {
    code: "V28", sev: "E", path: "/lexicon/normalize/numbers", what: "normalize.numbers \"en\" on a lexicon whose lang is not English",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.lang = "es"; r.lexicon.normalize = { numbers: "en" }; return { rubric: r }; },
  },
  {
    code: "V29", sev: "W", path: "/lexicon/bool/0/ph/1", what: "a phrase with a typographic apostrophe while apostrophes are folded",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.normalize = { apostrophes: true }; r.lexicon.bool[0].ph.push("example item one’s"); return { rubric: r }; },
  },
  // Round 2 R4: numbers are spelled out for band phrase matching only, so only a band phrase
  // holding a standalone small number can never match (a yes/no phrase with a digit matches typed
  // digits again and gets no V29).
  {
    code: "V29", sev: "W", path: "/lexicon/scale/0/bands/0/ph/1", what: "a band phrase with a standalone small number while numbers are spelled out",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.normalize = { numbers: "en" }; r.lexicon.scale[0].bands[0].ph.push("example 2 units"); return { rubric: r }; },
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
