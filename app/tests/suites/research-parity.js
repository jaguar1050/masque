// tests/suites/research-parity.js — the edited readiness panel and population page against the
// frozen baseline (design 03 §8.3 `research-parity`, §5.6, §8.4 AD4/AD8/AD9, §9.11). Owner: WP10.
//
//   functions   baseline panel (project "MASQUE", PROJECTS.MASQUE) vs edited panel
//               (research = module.research), on identical inputs: the demo rows, the three
//               makeCohort kinds (baseline Simulator vs engine spec), a fixture CSV using the
//               aliases, and seeded random cohorts (§8.5 seed). Deep diff of normalizeRows,
//               metrics, calibration, repeatMeasures, population, fairness and equityAdjustment
//               on both axes, internalConsistency, dataQuality and fingerprint. No allowance.
//   documents   the manifest, model card and provenance JSON captured from the download buttons
//               (URL.createObjectURL stubbed), for several screen states and every dataset above,
//               loaded through each panel's own file input. Only AD8 (module_id, scoring_hash, the
//               modelVersion default, file names) and AD4 are normalised.
//   population  the embedded edited page vs the baseline component: textContent identical outside
//               the brand row and the footer (AD9); the edited page with no props identical to it.
//   audit fixes two intended document differences, normalised here and nowhere else
//               (02-app-divergences.md, "Audit fixes — research and data"):
//               F14  with a `floor` prop, currentPatientOutput.attainableRange[0] is the floor and
//                    probabilityRange[0] its probability (the baseline, which ignores `floor`, prints
//                    the score). Exercised by the "unscorable-floor" screen; checked exactly.
//               M2   an incomputable equity-mitigation gap is null where the baseline wrote 0
//                    (`?? 0`): equityMitigation.result.{sensitivity,specificity}Gap.{before,after}.
import React from "react";
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need, waitError } from "../harness/kit.js";
import { ORACLE_EXPORTS } from "../harness/oracles.js";

const E = React.createElement;
const NOW = "2026-10-01T12:00:00.000Z";
const RRP = "ResearchReadinessPanel.jsx";
const EXPORTS = `export { ${[...ORACLE_EXPORTS[RRP], "parseCsv"].join(", ")} };`;

const qa = (root, sel) => [...root.querySelectorAll(sel)];
const click = (el) => flushSync(() => el.click());
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
function textOf(el) {
  if (!el) return null;
  const c = el.cloneNode(true);
  for (const s of c.querySelectorAll("style")) s.remove();
  return c.textContent;
}
async function until(fn, ms = 15000, step = 25) {
  const t0 = performance.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (performance.now() - t0 > ms) return null;
    await tick(step);
  }
}
const openTab = (root, i) => click(qa(root, ".rrp-tab")[i]);
const button = (root, re) => qa(root, ".rrp-btn").find((b) => re.test(textOf(b)));

async function loadFile(root, name, text) {
  openTab(root, 1);
  const input = root.querySelector('.rrp input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(new File([text], name, { type: name.endsWith(".csv") ? "text/csv" : "application/json" }));
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => (textOf(root.querySelector(".rrp-upload")) || "").includes(name) || root.querySelector(".rrp-danger"), 3000);
  await tick(5);
}

/** Click the panel's three JSON downloads and return {manifest, modelCard, provenance} with file names. */
async function documents(root) {
  const blobs = new Map();
  const out = [];
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL, realEl = document.createElement;
  let n = 0;
  URL.createObjectURL = (blob) => { const href = `blob:research-parity/${n++}`; blobs.set(href, blob); return href; };
  URL.revokeObjectURL = () => {};
  document.createElement = function (tag, opts) {
    const el = realEl.call(document, tag, opts);
    if (String(tag).toLowerCase() === "a") el.click = () => out.push({ name: el.download, blob: blobs.get(el.getAttribute("href")) });
    return el;
  };
  try {
    openTab(root, 1); click(button(root, /Manifest/));
    openTab(root, 5); click(button(root, /Download model card/)); click(button(root, /Provenance/));
  } finally {
    document.createElement = realEl;
    URL.createObjectURL = realCreate;
    setTimeout(() => { URL.revokeObjectURL = realRevoke; }, 700);
  }
  const docs = {};
  for (const [i, key] of ["manifest", "modelCard", "provenance"].entries()) {
    const o = out[i];
    docs[key] = o ? { name: o.name, json: JSON.parse(await o.blob.text()) } : null;
  }
  return docs;
}

/** Seeded random cohort rows in the shapes ingestion accepts (aliases included). */
function randomRows(rand, n, itemIds) {
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = {};
    const scoreKey = pick(["score", "score", "score", "masque_score", "index"]);
    r[scoreKey] = pick([Math.round(rand() * 100), Math.round(rand() * 100), Math.round(rand() * 1000) / 10, String(Math.round(rand() * 100)), "", null, "n/a"]);
    const labelKey = pick(["label", "label", "reference_label", "outcome", "target"]);
    r[labelKey] = pick([0, 1, 0, 1, "", null, "positive", 2, "1"]);
    const sexKey = pick(["sex", "sex", "sex_at_birth", "birth_sex"]);
    r[sexKey] = pick(["female", "male", "Female", "female", "male", "", null, "intersex"]);
    if (rand() < 0.8) r[pick(["gender", "gender_identity"])] = pick(["woman", "man", "nonbinary", "", null, "Woman"]);
    if (rand() < 0.7) r[pick(["weight", "survey_weight"])] = pick([0.5 + rand() * 1.5, 1, "", 0, -1, "heavy"]);
    if (rand() < 0.6) r[pick(["annual_cost", "total_cost", "expenditure"])] = pick([Math.round(rand() * 9000), "", null]);
    if (rand() < 0.6) r[pick(["avoidable_cost", "misdirected_cost"])] = pick([Math.round(rand() * 4000), "", null]);
    if (rand() < 0.7) r[pick(["subject_id", "subjectId", "participant_id"])] = `s-${Math.floor(rand() * Math.max(3, n / 3))}`;
    if (rand() < 0.7) r[pick(["captured_at", "capturedAt", "timestamp"])] = `2026-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`;
    if (rand() < 0.5) for (const id of itemIds) if (rand() < 0.9) r[id] = pick([0, 1, 1, 2, "", 0]);
    rows.push(r);
  }
  return rows;
}

/** The alias fixture: every alias the MASQUE adapter accepts, with absent and unreadable cells. */
function aliasCsv(itemIds) {
  const ids = itemIds.slice(0, 6);
  const head = ["participant_id", "timestamp", "masque_score", "reference_label", "sex_at_birth", "gender_identity", "survey_weight", "total_cost", "misdirected_cost", ...ids];
  const lines = [head.join(",")];
  const vals = [
    ["p1", "2026-01-02", 72, 1, "female", "woman", 1.2, 6100, 3000],
    ["p1", "2026-03-02", 64, 1, "female", "woman", 1.2, 5000, 2100],
    ["p2", "2026-01-05", 31, 0, "male", "man", 0.8, 1900, 200],
    ["p2", "2026-04-05", 35, 0, "male", "man", 0.8, "", ""],
    ["p3", "2026-02-11", 55, "positive", "female", "", "", 3300, 900],
    ["p4", "", "", 1, "", "nonbinary", 1, "", ""],
    ["p5", "2026-02-19", 48, 0, "male", "\"man, trans\"", 1.1, 2500, 400],
    ["p3", "2026-05-11", 58, 1, "female", "woman", "", 3400, 950],
    ["p6", "2026-03-01", 81, 1, "female", "woman", 0.9, 7000, 4100],
    ["p7", "2026-03-03", 12, 0, "male", "man", 1.3, 900, 50],
  ];
  vals.forEach((v, i) => lines.push([...v, ...ids.map((_, k) => (i + k) % 3)].join(",")));
  return lines.join("\r\n") + "\r\n";
}

export default {
  name: "research-parity",
  owner: "WP10",
  run: guarded("research-parity", async (h) => {
    const c = collector(h);
    const { module: masque } = await loadMasque(h);
    const cohort = await h.engine("cohort.js");
    need(typeof cohort.makeCohort === "function", "waits on WP4 (cohort.makeCohort)");
    const research = masque.research;
    need(research && research.projectKey, "the built-in module has no research block (WP1)");
    const itemIds = masque.allItems.map((i) => i.id);

    const B = await h.oracle(RRP, { append: EXPORTS });
    let N;
    try { N = await h.env.loader.importModule(h.appUrl(`src/${RRP}`), { append: EXPORTS }); }
    catch (err) { throw waitError(`waits on WP10: src/${RRP} does not compile: ${String(err.message).split("\n")[0]}`); }
    const Sim = await h.oracle("MASQUE_Simulator.jsx");
    const cfgA = B.PROJECTS.MASQUE;

    // ---------------------------------------------------------------- datasets
    const datasets = [["demo", cfgA.demo, research.demo]];
    for (const kind of ["balanced", "unlabeled", "disparate"]) {
      const spec = (research.demoCohorts || []).find((d) => d.id === kind);
      c.check(!!spec, `/datasets/${kind}/spec`, null, "a demoCohorts entry", null);
      if (spec) datasets.push([`cohort-${kind}`, Sim.makeCohort(kind), cohort.makeCohort(spec.spec)]);
    }
    const csv = aliasCsv(itemIds);
    datasets.push(["alias-csv", B.parseCsv(csv), N.parseCsv(csv)]);
    const rand = h.rng(h.seed);
    const nRandom = h.quick ? 6 : 24;
    for (let i = 0; i < nRandom; i++) {
      const rows = randomRows(rand, [0, 1, 2, 9, 40, 120, 300][i % 7], itemIds);
      datasets.push([`random-${i}`, rows, JSON.parse(JSON.stringify(rows))]);
    }

    // ---------------------------------------------------------------- functions
    for (const [name, inA, inB] of datasets) {
      const at = `/functions/${name}`;
      const input = { dataset: name };
      const ra = B.normalizeRows(inA), rb = N.normalizeRows(inB, research);
      c.diff(ra, rb, { at: `${at}/normalizeRows`, input });
      const pairs = [
        ["metrics", () => B.metrics(ra, cfgA), () => N.metrics(rb, research)],
        ["calibration", () => B.calibration(ra, cfgA), () => N.calibration(rb, research)],
        ["repeatMeasures", () => B.repeatMeasures(ra), () => N.repeatMeasures(rb)],
        ["population", () => B.population(ra, cfgA), () => N.population(rb, research)],
        ["internalConsistency", () => B.internalConsistency(ra, itemIds), () => N.internalConsistency(rb, itemIds)],
        ["dataQuality", () => B.dataQuality(ra, cfgA), () => N.dataQuality(rb, research)],
        ["fingerprint", () => B.fingerprint(ra, cfgA), () => N.fingerprint(rb, research)],
      ];
      for (const axis of research.fairnessAxes || ["sex", "gender"]) {
        pairs.push([`fairness/${axis}`, () => B.fairness(ra, cfgA, B.FAIRNESS_POLICY, axis), () => N.fairness(rb, research, N.FAIRNESS_POLICY, axis)]);
        pairs.push([`equityAdjustment/${axis}`, () => B.equityAdjustment(ra, cfgA, B.FAIRNESS_POLICY, axis), () => N.equityAdjustment(rb, research, N.FAIRNESS_POLICY, axis)]);
      }
      for (const [fn, fa, fb] of pairs) c.diff(fa(), fb(), { at: `${at}/${fn}`, input });
    }
    c.diff(B.FAIRNESS_POLICY, N.FAIRNESS_POLICY, { at: "/functions/FAIRNESS_POLICY" });

    // ---------------------------------------------------------------- documents
    const BasePanel = (await h.oracle(RRP)).default;
    const Panel = N.default;
    const screen = (over) => ({
      score: 72, ceiling: 72, scorable: true, band: "high",
      domains: { a: { label: "Domain A", pts: 20, max: 30, pct: 67 }, b: { label: "Domain B", pts: 12, max: 20, pct: 60 } },
      coverage: 100, sex: "female", gender: "woman", phenotype: "", redFlags: [], itemIds,
      capturedRows: [], instrumentVersion: masque.instrumentVersion, ...over,
    });
    const screens = [
      ["scorable-high", screen({})],
      ["unscorable", screen({ score: 30, ceiling: 70, scorable: false, band: "indeterminate", coverage: 40 })],
      ["red-flags", screen({ redFlags: ["Example flag A"] })],
      ["low-coverage", screen({ score: 20, ceiling: 20, band: "low", coverage: 30, sex: null, gender: "woman" })],
      ["axes-diverge", screen({ score: 50, ceiling: 50, band: "moderate", sex: "male", gender: "nonbinary" })],
      ["unscorable-floor", screen({ score: 30, floor: 22, ceiling: 70, scorable: false, band: "indeterminate", coverage: 40 })],
    ];
    // F14: the calibrated probability of a value, as the panel computes it (research.calibration).
    const prob4 = (x) => +(1 / (1 + Math.exp(-research.calibration.slope * (x - research.calibration.midpoint)))).toFixed(4);
    let sawF14 = false, sawM2 = 0;
    /** Apply the two audit-fix normalisers to a copy of the new document (exact, or left as is). */
    const auditNormalise = (key, sname, props, a, b) => {
      const out = JSON.parse(JSON.stringify(b));
      if (key === "modelCard" && props.floor != null && out.currentPatientOutput && a.currentPatientOutput) {
        const na = a.currentPatientOutput, nb = out.currentPatientOutput;
        const exact = Array.isArray(nb.attainableRange) && nb.attainableRange[0] === Math.round(props.floor)
          && Array.isArray(na.attainableRange) && na.attainableRange[0] === Math.round(props.score)
          && Array.isArray(nb.probabilityRange) && nb.probabilityRange[0] === prob4(props.floor)
          && Array.isArray(na.probabilityRange) && na.probabilityRange[0] === prob4(props.score);
        c.check(exact, `/documents/${sname}/F14`, { floor: props.floor, score: props.score }, { attainableRange0: Math.round(props.floor), probabilityRange0: prob4(props.floor) },
          { attainableRange: nb.attainableRange, probabilityRange: nb.probabilityRange });
        if (exact) { nb.attainableRange[0] = na.attainableRange[0]; nb.probabilityRange[0] = na.probabilityRange[0]; sawF14 = true; }
      }
      const ra = a.equityMitigation && a.equityMitigation.result, rb = out.equityMitigation && out.equityMitigation.result;
      if (ra && rb) {
        for (const g of ["sensitivityGap", "specificityGap"]) for (const w of ["before", "after"]) {
          if (rb[g] && ra[g] && rb[g][w] === null && ra[g][w] === 0) { rb[g][w] = 0; sawM2 += 1; }
        }
      }
      return out;
    };
    const files = [
      ...datasets.filter(([n]) => n.startsWith("cohort-")).map(([n, a]) => [`${n}.json`, JSON.stringify(a)]),
      ["alias.csv", csv],
    ];
    const scoringHash = masque.hashes.scoringHash;
    const unversioned = `${masque.id}-prototype-unversioned`;
    const ctx = {
      AD8: { moduleId: masque.id, scoringHash, modelVersion: { from: "prototype-0.2", to: unversioned } },
    };
    let sawAD8 = false;
    await h.withFixedClock(NOW, async () => {
      for (const [sname, props] of screens) {
        // The first screen state runs with no modelVersion: the AD8 default on each side.
        const versioned = sname !== "scorable-high";
        const a = h.mount(E(BasePanel, { project: "MASQUE", ...props, ...(versioned ? { modelVersion: "masque-prototype-0.3.0" } : {}) }));
        const b = h.mount(E(Panel, {
          project: research.projectKey, research, moduleId: masque.id, scoringHash, ...props,
          ...(versioned ? { modelVersion: "masque-prototype-0.4.0" } : {}),
        }));
        try {
          const sets = sname === "scorable-high" ? [["demo", null], ...files] : [["demo", null]];
          for (const [fname, text] of sets) {
            if (text) { await loadFile(a.container, fname, text); await loadFile(b.container, fname, text); }
            const da = await documents(a.container), db = await documents(b.container);
            for (const key of ["manifest", "modelCard", "provenance"]) {
              const at = `/documents/${sname}/${fname}/${key}`;
              c.check(!!da[key] && !!db[key], `${at}/downloaded`, null, "a download", [!!da[key], !!db[key]]);
              if (!da[key] || !db[key]) continue;
              c.check(da[key].name === db[key].name, `${at}/fileName`, null, da[key].name, db[key].name);
              const nb = auditNormalise(key, sname, props, da[key].json, db[key].json);
              const r = c.diff(da[key].json, nb, { at, allow: ["AD8", "AD4"], ctx, input: { screen: sname, file: fname } });
              if (r.observed.has("AD8")) sawAD8 = true;
            }
          }
        } finally { a.unmount(); b.unmount(); }
      }
    });
    h.expect("AD8", { precondition: true, observed: sawAD8 });
    c.check(sawF14, "/documents/unscorable-floor/F14-observed", null, "the floor reached the model card", sawF14);
    c.note(`audit fixes: F14 normalised on the unscorable-floor screen; M2 (null gap where the baseline wrote 0) normalised ${sawM2} time${sawM2 === 1 ? "" : "s"}`);

    // ---------------------------------------------------------------- population (AD9)
    const BasePop = (await h.oracle("MASQUE_Population.jsx")).default;
    let Pop;
    try { Pop = (await h.env.loader.importModule(h.appUrl("src/MASQUE_Population.jsx"))).default; }
    catch (err) { throw waitError(`waits on WP10: src/MASQUE_Population.jsx does not compile: ${String(err.message).split("\n")[0]}`); }
    const paths = research.population || {};
    const base = document.createElement("base");
    base.href = h.env.appBase;
    document.head.prepend(base);
    let a, plain, emb;
    const ready = (m) => !/Loading…/.test(textOf(m.container)) && m.container.querySelector(".pop .wrap > .card:last-of-type");
    try {
      a = h.mount(E(BasePop));
      plain = h.mount(E(Pop));
      await until(() => ready(a) && ready(plain) && a.container.querySelector(".foot"), 20000);
    } finally { base.remove(); }
    emb = h.mount(E(Pop, { embedded: true, baseUrl: h.env.appBase, indexPath: paths.index, schemaPath: paths.schema, mapPath: paths.map }));
    await until(() => ready(emb) && emb.container.querySelectorAll(".pa").length === a.container.querySelectorAll(".pa").length, 20000);
    const baseText = textOf(a.container);
    c.diff(baseText, textOf(plain.container), { at: "/population/plain" });
    const regions = [textOf(a.container.querySelector(".brandrow")), textOf(a.container.querySelector(".foot"))];
    const r = c.diff(baseText, textOf(emb.container), { at: "/population/embedded", allow: ["AD9"], ctx: { AD9: { regions } } });
    h.expect("AD9", { precondition: true, observed: r.observed.has("AD9") });
    c.check(a.container.querySelectorAll(".pa").length > 0, "/population/artifacts-rendered", null, "> 0", a.container.querySelectorAll(".pa").length);
    c.note(`population: ${a.container.querySelectorAll(".pa").length} artifacts rendered by the baseline and by the embedded page`);
    c.note(`${datasets.length} datasets (${nRandom} seeded random), ${screens.length} screen states, ${files.length} uploaded files per panel`);
    a.unmount(); plain.unmount(); emb.unmount();

    return c.result();
  }),
};
