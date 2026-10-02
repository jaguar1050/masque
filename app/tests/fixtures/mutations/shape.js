// Mutation generators V1-V9: shape and identity (design 03 §4.14, §8.3 `validate`). WP3.
//
// Each generator takes the suite's ctx (see index.js) and returns the mutated material:
//   {rubric, logic?, origin?, classification?, loaded?, root?, upload?, via?}
// The mutated rubric/logic must produce `code` at `path` (with severity `sev`). Placeholder
// text only; nothing here is clinical content.

export default [
  {
    code: "V1", sev: "E", path: "/format", what: "rubric format is not screenair-rubric",
    build: (ctx) => { const r = ctx.rubric(); r.format = "screenair-rubrik"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V1", sev: "E", path: "/contractVersion", what: "a newer contractVersion",
    build: (ctx) => { const r = ctx.rubric(); r.contractVersion = 2; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V1", sev: "E", path: "/logic/format", what: "logic format is not screenair-logic",
    build: (ctx) => { const l = ctx.logic(); l.format = "screenair-logik"; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V2", sev: "E", path: "/id", what: "id is not a slug",
    build: (ctx) => { const r = ctx.rubric(); r.id = "Example_Module"; return { rubric: r }; },
  },
  {
    code: "V2", sev: "E", path: "/label", what: "label over 80 characters",
    build: (ctx) => { const r = ctx.rubric(); r.label = "Example ".repeat(12); return { rubric: r }; },
  },
  {
    code: "V3", sev: "W", path: "/domainz", what: "unknown top-level key",
    build: (ctx) => { const r = ctx.rubric(); r.domainz = []; return { rubric: r }; },
  },
  {
    code: "V4", sev: "E", path: "/domains/0/items/0/ask", what: "a function inside the rubric",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].items[0].ask = () => "Example?"; return { rubric: r }; },
  },
  {
    code: "V4", sev: "E", path: "/sampleCases/0/why", what: "undefined inside the rubric",
    build: (ctx) => { const r = ctx.rubric(); r.sampleCases[0].why = undefined; return { rubric: r }; },
  },
  {
    code: "V5", sev: "E", path: "/logicBinding/moduleId", what: "logic moduleId differs from the binding",
    build: (ctx) => { const l = ctx.logic(); l.moduleId = "example-other"; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V5", sev: "E", path: "/logicBinding", what: "a generic rubric given a logic file",
    build: (ctx) => { const r = ctx.rubric(); r.logicBinding = "generic"; return { rubric: r, logic: ctx.logic() }; },
  },
  {
    code: "V6", sev: "E", path: "/instrumentVersion", what: "instrument version is not a version",
    build: (ctx) => { const r = ctx.rubric(); r.instrumentVersion = "v1"; return { rubric: r }; },
  },
  {
    code: "V6", sev: "E", path: "/lexicon/version", what: "a built-in lexicon version with the -local tag",
    build: (ctx) => { const r = ctx.rubric(); r.lexicon.version = "0.1.0-local.abc123"; return { rubric: r, origin: "builtin", classification: "builtin" }; },
  },
  {
    code: "V7", sev: "W", path: "/id", what: "the label text appears in the id",
    build: (ctx) => { const r = ctx.rubric(); r.label = "mutation-base"; return { rubric: r }; },
  },
  {
    code: "V8", sev: "E", path: "/id", what: "id already loaded",
    build: async (ctx) => {
      const other = await ctx.bind(ctx.rubric(), ctx.logic(), { origin: "uploaded", key: "upload:other" });
      return { rubric: ctx.rubric(), loaded: [other] };
    },
  },
  {
    code: "V8", sev: "E", path: "/label", what: "label of a built-in",
    build: (ctx) => { const r = ctx.rubric(); r.id = "example-other"; r.label = ctx.root.label.toUpperCase(); return { rubric: r, loaded: [ctx.root] }; },
  },
  {
    code: "V8", sev: "E", path: "/label", what: "label of a built-in disguised with invisible characters and no-break spaces",
    build: (ctx) => { const r = ctx.rubric(); r.id = "example-other"; r.label = ctx.root.label.replace(/ /g, " ") + "​"; return { rubric: r, loaded: [ctx.root] }; },
  },
  {
    code: "V8", sev: "E", path: "/id", what: "id with a built-in id as prefix",
    build: (ctx) => { const r = ctx.rubric(); r.id = `${ctx.root.id}-copy`; r.label = "Example copy"; return { rubric: r, loaded: [ctx.root] }; },
  },
  {
    code: "V8", sev: "E", path: "/logicBinding/moduleId", what: "a built-in logic id with other bytes",
    build: (ctx) => {
      const r = ctx.rubric(); r.id = "example-other"; r.label = "Example other";
      return { rubric: r, logic: ctx.logic(), logicSha256: "1".repeat(64), loaded: [ctx.root] };
    },
  },
  {
    code: "V8", sev: "W", path: "/label", what: "label equal to another loaded module's",
    build: async (ctx) => {
      const o = ctx.rubric(); o.id = "example-other"; o.fhir.screenIdPrefix = "{id}-x-";
      const other = await ctx.bind(o, ctx.logic(), { origin: "uploaded", key: "upload:other" });
      return { rubric: ctx.rubric(), loaded: [other] };
    },
  },
  {
    code: "V9", sev: "E", path: "/fhir/codeSystem", what: "an identity system without {id}",
    build: (ctx) => { const r = ctx.rubric(); r.fhir.codeSystem = "http://screenair.example/shared/codes"; return { rubric: r }; },
  },
  {
    code: "V9", sev: "E", path: "/fhir/questionnaireUrl", what: "questionnaireUrl without {instrument}",
    build: (ctx) => { const r = ctx.rubric(); r.fhir.questionnaireUrl = "http://screenair.example/{id}/Questionnaire/{id}"; return { rubric: r }; },
  },
];
