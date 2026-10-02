// Mutation generators V40-V48: the logic layer (design 03 §4.14, §8.3 `validate`). WP3.
// The closures below are placeholder test logic; nothing here is clinical content.

export default [
  {
    code: "V40", sev: "E", path: "/logic/extraHook", what: "a function outside the closure paths",
    build: (ctx) => { const l = ctx.logic(); l.extraHook = () => true; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V40", sev: "E", path: "/logic/reads/items/p_one", what: "a function where reads expects data",
    build: (ctx) => { const l = ctx.logic(); l.reads.items.p_one = () => "boolean"; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V41", sev: "E", path: "/logic/reads/items/p_two", what: "a declared scale length that differs",
    build: (ctx) => { const l = ctx.logic(); l.reads.items.p_two = { scale: 4 }; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V41", sev: "E", path: "/logic/reads/domains/minus", what: "a negative domain declared positive",
    build: (ctx) => { const l = ctx.logic(); l.reads.domains.minus = { negative: false }; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V41", sev: "E", path: "/logic/reads/gapMarkers", what: "gapMarkers out of step with gapRule.markers",
    build: (ctx) => { const l = ctx.logic(); l.reads.gapMarkers = []; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V42", sev: "E", path: "/logic/routing/1/id", what: "duplicate routing ids",
    build: (ctx) => { const l = ctx.logic(); l.routing[1].id = l.routing[0].id; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V42", sev: "E", path: "/logic/routing/4/fallback", what: "two fallbacks on one surface",
    build: (ctx) => {
      const l = ctx.logic();
      l.routing.push({ id: "example-fallback-2", fallback: true, copy: { screener: { h: "Example second fallback", p: "Example paragraph.", chips: [] } } });
      return { rubric: ctx.rubric(), logic: l };
    },
  },
  {
    code: "V43", sev: "E", path: "/logic/patientSummary/ask/1/when", what: "a last ask rule with a when",
    build: (ctx) => { const l = ctx.logic(); l.patientSummary.ask[1].when = (s) => s.yes("p_one"); return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V43", sev: "E", path: "/logic/patientSummary/groups/firstYes/0", what: "a summary group naming an unknown item",
    build: (ctx) => { const l = ctx.logic(); l.patientSummary.groups.firstYes[0] = "p_nope"; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V44", sev: "E", path: "/logic/locales/es/sum/askFour", what: "a summary key missing in one locale",
    build: (ctx) => { const l = ctx.logic(); delete l.locales.es.sum.askFour; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V45", sev: "E", path: "/logic/probes/list/2/opts/0/a/p_nope", what: "a probe writing to an unknown item",
    build: (ctx) => { const l = ctx.logic(); l.probes.list[2].opts[0].a = { p_nope: "yes" }; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V45", sev: "E", path: "/logic/probes/list/3/opts/0/a/p_four", what: "a supporting probe writing to a scored item",
    build: (ctx) => { const l = ctx.logic(); l.probes.list[3].opts[0].a = { p_four: "yes" }; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V45", sev: "E", path: "/logic/probes/list/1/target", what: "a rescue with a target",
    build: (ctx) => { const l = ctx.logic(); l.probes.list[1].target = "p_one"; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V46", sev: "E", path: "/logic/routing/0/when", what: "a routing closure that throws",
    build: (ctx) => {
      const l = ctx.logic();
      l.routing[0].when = (s) => { if (s.yes("p_one")) throw new Error("Example failure"); return false; };
      return { rubric: ctx.rubric(), logic: l };
    },
  },
  {
    code: "V46", sev: "E", path: "/logic/probes/list/1/when", what: "a rescue that retires on a negative answer (a[x] === undefined)",
    build: (ctx) => { const l = ctx.logic(); l.probes.list[1].when = (a) => a.p_one === undefined; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V46", sev: "E", path: "/logic/routing/1/copy/screener/chips", what: "chips that are not a list of strings",
    build: (ctx) => {
      const l = ctx.logic();
      l.routing[1].when = (s) => s.yes("p_minus");
      l.routing[1].copy.screener.chips = (s) => "Example chip " + s.total;
      return { rubric: ctx.rubric(), logic: l };
    },
  },
  {
    code: "V46", sev: "E", path: "/logic/patientSummary/said/0/text", what: "a summary text that is not a string",
    build: (ctx) => { const l = ctx.logic(); l.patientSummary.said[0].text = (s) => s.groups.firstYes.length; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V47", sev: "E", path: "/logic/reads/items/p_four", what: "an undeclared item read",
    build: (ctx) => { const l = ctx.logic(); delete l.reads.items.p_four; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V47", sev: "E", path: "/logic/reads/context/p_ctx", what: "an undeclared context read",
    build: (ctx) => { const l = ctx.logic(); delete l.reads.context; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V47", sev: "W", path: "/logic/reads/redFlags/p_rf_b", what: "a declared flag nothing reads",
    build: (ctx) => { const l = ctx.logic(); l.reads.redFlags = ["p_rf_a", "p_rf_b"]; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V48", sev: "E", path: "/logic/routing/0/when", what: "a closure whose result changes between calls",
    build: (ctx) => {
      const l = ctx.logic();
      let calls = 0;
      l.routing[0].when = (s) => { calls += 1; return s.isAnswered("p_one") && calls % 2 === 0; };
      return { rubric: ctx.rubric(), logic: l };
    },
  },
];
