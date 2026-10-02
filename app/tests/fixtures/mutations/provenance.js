// Mutation generators V49-V60: samples, provenance, upload, patient wording (design 03 §4.14,
// §8.3 `validate`). WP3. Placeholder text only.
//
// The derivation cases use ctx.derive(rubric, {parent}) — the §3.11 derived-module rules
// (provenance root/derivedFrom/lineage, contentHash, change-log entry, versions by the family
// rule) applied to a mutated copy of the base — and bind the result as a verified
// derivation of ctx.root (the base bound as a built-in).

const verified = (ctx) => ({ kind: "verified", root: ctx.root, origin: "derived", row: 3, reasons: [] });

export default [
  {
    code: "V49", sev: "E", path: "/sampleCases/0/a/p_one", what: "a sample holding \"unsure\"",
    build: (ctx) => { const r = ctx.rubric(); r.sampleCases[0].a.p_one = "unsure"; return { rubric: r }; },
  },
  {
    code: "V49", sev: "E", path: "/sampleCases/1/ctx/p_ctx", what: "a sample context value in the Patient vocabulary only",
    build: (ctx) => { const r = ctx.rubric(); r.sampleCases[1].ctx = { p_ctx: "c" }; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V50", sev: "E", path: "/demo/patient/dob", what: "a demo patient with a date of birth",
    build: (ctx) => { const r = ctx.rubric(); r.demo.patient.dob = "2000-01-01"; return { rubric: r }; },
  },
  {
    code: "V50", sev: "E", path: "/demo/transcript/0", what: "a malformed transcript entry",
    build: (ctx) => { const r = ctx.rubric(); r.demo.transcript[0] = ["nurse", "Example line."]; return { rubric: r, via: "shape" }; },
  },
  {
    code: "V51", sev: "W", path: "/sampleCases", what: "no sample rehearses the red-flag gate",
    build: (ctx) => { const r = ctx.rubric(); for (const s of r.sampleCases) delete s.rf; return { rubric: r }; },
  },
  {
    code: "V52", sev: "E", path: "/changelog/1", what: "a derivation whose last change-log entry is not \"derived\"",
    build: async (ctx) => {
      const d = await ctx.derive(ctx.rubric(), {});
      d.changelog[d.changelog.length - 1].kind = "note";
      return { rubric: d, origin: "derived", classification: verified(ctx), root: ctx.root };
    },
  },
  {
    code: "V52", sev: "E", path: "/provenance/contentHash", what: "a derivation edited after Apply",
    build: async (ctx) => {
      const d = await ctx.derive(ctx.rubric(), {});
      d.copy.indexName = "Example index, edited by hand";
      return { rubric: d, origin: "derived", classification: verified(ctx), root: ctx.root };
    },
  },
  {
    code: "V53", sev: "E", path: "/instrumentVersion", what: "a second-generation derivation claiming the root's version for a changed instrument",
    build: async (ctx) => {
      const r1 = ctx.rubric(); r1.domains[0].items[0].text = "Example item one, edited";
      const gen1 = await ctx.bind(await ctx.derive(r1, {}), ctx.logic(), { origin: "derived", classification: verified(ctx), key: "derived:gen1" });
      const r2 = JSON.parse(JSON.stringify(gen1.rubric));
      r2.domains[0].items[1].text = "Example item two, edited";
      const gen2 = await ctx.derive(r2, { parent: gen1, instrumentVersion: ctx.root.instrumentVersion });
      return { rubric: gen2, origin: "derived", classification: verified(ctx), root: ctx.root, loaded: [ctx.root, gen1] };
    },
  },
  {
    code: "V53", sev: "E", path: "/lexicon/version", what: "a changed lexicon without the -local tag",
    build: async (ctx) => {
      const r = ctx.rubric(); r.lexicon.bool[0].ph.push("example item one again");
      return { rubric: await ctx.derive(r, { lexiconVersion: "0.2.0" }), origin: "derived", classification: verified(ctx), root: ctx.root };
    },
  },
  {
    code: "V54", sev: "E", path: "/research/calibration", what: "a derivation that changes the calibration",
    build: async (ctx) => {
      const r = ctx.rubric(); r.research.calibration.slope = 0.2;
      return { rubric: await ctx.derive(r, {}), origin: "derived", classification: verified(ctx), root: ctx.root };
    },
  },
  {
    code: "V54", sev: "E", path: "/cds/examples/settled", what: "a settled example kept after the scoring changed",
    build: async (ctx) => {
      const r = ctx.rubric(); r.domains[1].items[0].w = 20; r.domains[1].items[1].w = 30;
      return { rubric: await ctx.derive(r, { keepSettled: true }), origin: "derived", classification: verified(ctx), root: ctx.root };
    },
  },
  {
    code: "V55", sev: "E", path: "/locales/en/reviewed", what: "edited English wording still marked reviewed",
    build: async (ctx) => {
      const r = ctx.rubric(); r.locales.en.items.p_one.q = "Example patient question one, edited?";
      return { rubric: await ctx.derive(r, { keepReviewed: true }), origin: "derived", classification: verified(ctx), root: ctx.root };
    },
  },
  {
    code: "V55", sev: "E", path: "/locales/es/reviewed", what: "a stale translation still marked reviewed",
    build: async (ctx) => {
      const r = ctx.rubric(); r.locales.es.stale = ["/locales/en/items/p_one/q"]; r.locales.es.reviewed = true;
      r.locales.es.editedLocally = true;
      return { rubric: await ctx.derive(r, { keepReviewed: true }), origin: "derived", classification: verified(ctx), root: ctx.root };
    },
  },
  {
    code: "V56", sev: "E", path: "/fhir/screenIdPrefix", what: "a rendered identifier equal to a loaded module's",
    build: async (ctx) => {
      const o = ctx.rubric(); o.id = "example-b"; o.label = "Example B";
      const other = await ctx.bind(o, ctx.logic(), { origin: "uploaded", key: "upload:example-b" });
      const r = ctx.rubric(); r.id = "example"; r.label = "Example A"; r.fhir.screenIdPrefix = "{id}-b-";
      return { rubric: r, loaded: [other] };
    },
  },
  {
    code: "V57", sev: "E", path: "/upload/logic", what: "a logic source that imports (inspectSource of the import fixture)",
    build: async (ctx) => {
      const inspect = (await ctx.inspect("modules/upload-import.logic.txt")) || { importSites: ["3:1"], apiRefs: [] };
      return { rubric: ctx.rubric(), upload: { inspect } };
    },
  },
  {
    code: "V58", sev: "E", path: "/upload/logic", what: "a logic file over the size limit",
    build: (ctx) => ({ rubric: ctx.rubric(), upload: { logic: { byteLength: ctx.LIMITS.logicBytes + 1 } } }),
  },
  {
    code: "V58", sev: "E", path: "/upload/rubric", what: "a rubric that is not valid UTF-8",
    build: (ctx) => ({ rubric: ctx.rubric(), upload: { rubric: { bytes: new Uint8Array([0x7b, 0xc3, 0x28, 0x80, 0x7d]) } } }),
  },
  {
    code: "V59", sev: "W", path: "/upload/logic", what: "a logic source that references page APIs",
    build: async (ctx) => {
      const inspect = (await ctx.inspect("modules/upload-global-side-effect.logic.txt")) || { importSites: [], apiRefs: ["window", "localStorage"] };
      return { rubric: ctx.rubric(), upload: { inspect } };
    },
  },
  {
    code: "V60", sev: "E", path: "/locales/en/items/p_one/q", what: "a patient question naming a score",
    build: (ctx) => { const r = ctx.rubric(); r.locales.en.items.p_one.q = "Example question about your score?"; return { rubric: r }; },
  },
  {
    code: "V60", sev: "E", path: "/logic/patientSummary/said/1/text", what: "a summary sentence naming a likelihood",
    build: (ctx) => { const l = ctx.logic(); l.patientSummary.said[1].text = () => "Example likelihood sentence."; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V60", sev: "E", path: "/logic/locales/es/sum/twoOften", what: "a Spanish sum string naming a score",
    build: (ctx) => { const l = ctx.logic(); l.locales.es.sum.twoOften = "Frase de ejemplo con puntuación."; return { rubric: ctx.rubric(), logic: l }; },
  },
  {
    code: "V60", sev: "E", path: "/name", what: "a module name (patient page header, export footer) naming a score",
    build: (ctx) => { const r = ctx.rubric(); r.name = "Example risk score"; return { rubric: r }; },
  },
  {
    code: "V60", sev: "E", path: "/domains/0/items/0/text", what: "an item text without patientClin (the patient summary's clinician block) naming a likelihood",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].items[0].text = "Example item one, likelihood 7/10"; return { rubric: r }; },
  },
  {
    code: "V60", sev: "E", path: "/domains/1/items/1/patientClin", what: "a patientClin line naming a probability",
    build: (ctx) => { const r = ctx.rubric(); r.domains[1].items[1].patientClin = "Example clinician line, high probability"; return { rubric: r }; },
  },
  {
    code: "V60", sev: "E", path: "/domains/0/label", what: "a domain label a patient step falls back to (no English step title) naming a score",
    build: (ctx) => { const r = ctx.rubric(); r.domains[0].label = "Example first score"; return { rubric: r }; },
  },
  {
    code: "V60", sev: "E", path: "/logic/locales/en/sum/clinNote", what: "a clinNote template whose output names a score",
    build: (ctx) => { const l = ctx.logic(); l.locales.en.sum.clinNote = (v) => `Example note, instrument v${v}, score 12/30.`; return { rubric: ctx.rubric(), logic: l }; },
  },
];
