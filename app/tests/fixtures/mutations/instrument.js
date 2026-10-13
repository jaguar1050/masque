// Mutation generators V10-V20: instrument and context (design 03 §4.14, §8.3 `validate`). WP3.
// Placeholder text only.

export default [
  {
    code: "V10", sev: "E", path: "/domains/1/key", what: "duplicate domain key",
    build: (ctx) => { const r = ctx.rubric(); r.domains[1].key = "first"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V10", sev: "E", path: "/domains/2/items", what: "a domain without items",
    build: (ctx) => { const r = ctx.rubric(); r.domains[2].items = []; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V11", sev: "E", path: "/redFlags/1/id", what: "a flag id equal to an item id",
    build: (ctx) => { const r = ctx.rubric(); r.redFlags[1].id = "p_one"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V11", sev: "E", path: "/domains/0/items/0/id", what: "an item id that is not a slug",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].items[0].id = "Example One"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V11", sev: "E", path: "/domains/0/items/0/id", what: "an item id that names an Object.prototype property",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].items[0].id = "constructor"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V11", sev: "E", path: "/domains/0/items/0/id", what: "an item id that names the canonical cohort column `label`",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].items[0].id = "label"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V11", sev: "E", path: "/domains/1/items/0/id", what: "an item id that names the canonical cohort column `score`",
    build: (ctx) => { const r = ctx.rubric(); r.domains[1].items[0].id = "score"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V11", sev: "E", path: "/redFlags/0/id", what: "a red flag id that names an Object.prototype property",
    build: (ctx) => { const r = ctx.rubric(); r.redFlags[0].id = "constructor"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V10", sev: "E", path: "/domains/0/key", what: "a domain key that names an Object.prototype property",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].key = "constructor"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V12", sev: "E", path: "/domains/0/items/0/w", what: "w = 0",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].items[0].w = 0; return { rubric: r }; },
  },
  {
    code: "V12", sev: "W", path: "/domains/1/items/0/short", what: "no short label",
    build: (ctx) => { const r = ctx.rubric(); delete r.domains[1].items[0].short; return { rubric: r }; },
  },
  {
    code: "V13", sev: "E", path: "/domains/0/items/1/scale", what: "a scale without an f = 0 option",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].items[1].scale[0].f = 0.2; return { rubric: r }; },
  },
  {
    code: "V13", sev: "E", path: "/domains/0/items/1/scale/2/f", what: "f outside [0, 1]",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].items[1].scale[2].f = 1.5; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V14", sev: "E", path: "/domains/1/items/0/scale", what: "a boolean item with a scale key that is not a list",
    build: (ctx) => { const r = ctx.rubric(); r.domains[1].items[0].scale = null; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V15", sev: "E", path: "/domains/0/max", what: "Σw ≠ max",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].max = 60; return { rubric: r }; },
  },
  {
    code: "V15", sev: "E", path: "/domains/2/items/0/w", what: "a positive weight in a negative domain",
    build: (ctx) => { const r = ctx.rubric(); r.domains[2].items[0].w = 10; r.domains[2].max = 10; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V16", sev: "E", path: "/bands/cuts/high", what: "high cut above the scale maximum",
    build: (ctx) => { const r = ctx.rubric(); r.bands.cuts.high = 120; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V16", sev: "E", path: "/bands/cuts/moderate", what: "a non-integer cut",
    build: (ctx) => { const r = ctx.rubric(); r.bands.cuts.moderate = 33.5; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V17", sev: "W", path: "/domains", what: "scale maximum other than 100",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].items[1].w = 40; r.domains[0].max = 60; return { rubric: r }; },
  },
  {
    code: "V18", sev: "E", path: "/contextItems/0/options/1", what: "duplicate context option value",
    build: (ctx) => { const r = ctx.rubric(); r.contextItems[0].options[1][0] = "a"; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V18", sev: "E", path: "/contextItems/0/options", what: "a context item with one option",
    build: (ctx) => { const r = ctx.rubric(); r.contextItems[0].options = [["b", "Example only"]]; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V19", sev: "E", path: "/gapRule/threshold", what: "threshold above the marker count",
    build: (ctx) => { const r = ctx.rubric(); r.gapRule.threshold = 5; return { rubric: r }; },
  },
  {
    code: "V19", sev: "E", path: "/gapRule/markers/0", what: "a marker that is not a context item",
    build: (ctx) => { const r = ctx.rubric(); r.gapRule.markers = ["p_nope"]; r.gapRule.noteOrder = ["p_nope"]; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V20", sev: "E", path: "/locales/en/contextItems/p_ctx/opts", what: "patient context options without the signal value",
    build: (ctx) => { const r = ctx.rubric(); r.locales.en.contextItems.p_ctx.opts = [["a", "Example patient context A"], ["c", "Example patient context C"]]; return { rubric: r }; },
  },
];
