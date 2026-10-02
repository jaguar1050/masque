// Test fixture (design 03 §2.9): the logic for shape-bound.rubric.json. Placeholder text only;
// no clinical content. Fetched as text and run through importSource, never imported by path.
export default {
  format: "screenair-logic",
  contractVersion: 1,
  moduleId: "shape",
  logicVersion: "fixture-1",
  reads: {
    items: { ex_a1: "boolean", ex_a3: { scale: 3 } },
    domains: { alpha: {} },
  },
  routing: [
    {
      id: "example-high",
      when: (s) => s.band === s.highestBand && s.yes("ex_a1"),
      copy: {
        screener: { h: "Example routing heading", p: "Example routing paragraph.", chips: ["Example chip"] },
        scribe: { h: "Example routing heading", p: "Example routing paragraph.", chips: ["Example chip"] },
      },
    },
    {
      id: "example-scale",
      when: (s) => s.scale("ex_a3") === 2 && s.items.alpha.max > 0,
      copy: {
        screener: { h: (s) => "Example heading for " + s.band, p: "Example paragraph.", chips: (s) => ["Example chip " + s.total] },
      },
    },
    {
      id: "example-fallback",
      fallback: true,
      copy: {
        screener: { h: "Example fallback heading", p: "Example fallback paragraph.", chips: [] },
      },
    },
  ],
};
