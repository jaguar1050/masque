// tests/suites/research.js — the Research tab, the edited readiness panel and the population gate
// (design 03 §5.6, §8.3 `research`, §9.11). Owner: WP10.
//
// Everything is mounted into detached containers (h.mount, outside StrictMode) and driven through
// its own buttons with flushSync. Checked:
//   compat        the edited panel with legacy props renders textContent-identical to the baseline
//                 panel, tab by tab, for project MASQUE (three screen states); BREATHE and VOICED
//                 render (every tab but the model card, whose deployment-gate sentence now names
//                 the project's own index); an unknown project gives the error card; `band` null
//                 reads "—" and decides nothing. Whether MASQUE is driven by `project` alone or by
//                 the module's `research` follows what the edited panel exports (PROJECTS.MASQUE
//                 is removed by WP14, §9.15). The legacy Population page renders
//                 textContent-identical to the baseline; the legacy Screener and Scribe sources are
//                 retired (§9.15) and not compared.
//   screen        no snapshot withholds score, probability and decision; a snapshot whose routing
//                 is not cleared withholds the decision only, naming the app it came from.
//   calibration   MASQUE computes; a verified derivation with changed scoring withholds every
//                 calibration-dependent figure on every tab and in the manifest and model card,
//                 keeps counts, AUROC, costs, repeat measures and internal consistency, and hides
//                 "Load demo cohort"; a wording-only derivation still computes.
//   rowscope      captured rows plus a CSV mixing module_id / instrument_version values.
//   cohorts       the three demo cohorts against their `why` text (Q26), and the dirty summary.
//   population    the gate for each classification (built-in, verified derivation, derivation
//                 from an upload, plain upload with and without research, forged derivedFrom),
//                 and the embedded page rendering every index-listed artifact through baseUrl.
//   sources       the "Current screen from" and "Captured rows" selectors and the model version.
//   audit         the audit fixes (docs/refactor/02-app-divergences.md, "Audit fixes — research and
//                 data"): PPV/NPV denominators, calibration-in-the-large and slope withheld below the
//                 reporting minimum, the avoidable share on rows carrying both costs (compat compares
//                 these KPIs on their own and the rest of each tab exactly); the attainable floor
//                 (F14); an uploaded population artifact schema-checked (refused with its failures);
//                 PopulationArtifact's suppression rule, money() and error boundary; the section
//                 tablist (roles, aria-controls, roving tabindex, arrow keys).
import React from "react";
import { flushSync } from "react-dom";
import { collector, guarded, loadMasque, need, waitError } from "../harness/kit.js";
import { derivedFixture, bumpFirstWeight } from "../harness/derivation.js";

const E = React.createElement;
const NOW = "2026-10-01T12:00:00.000Z";
const RRP = "ResearchReadinessPanel.jsx";
const TABS = ["risk", "data", "validation", "fairness", "population", "model"];

// ----------------------------------------------------------------------------- DOM helpers

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

/** The panel's tab buttons in order. */
const tabButtons = (root) => qa(root, ".rrp-tab");

/** Open panel tab `i` (0-based, TABS order) and return the panel's textContent. */
function tabText(root, i) {
  const rrp = root.querySelector(".rrp");
  click(tabButtons(rrp)[i]);
  return textOf(rrp);
}

/** {value, detail} of the KPI labelled `label` in the visible panel tab. */
function kpi(root, label) {
  const k = qa(root, ".rrp .rrp-kpi").find((x) => textOf(x.querySelector(".rrp-k")) === label);
  if (!k) return null;
  return { value: textOf(k.querySelector(".rrp-v")), detail: textOf(k.querySelector(".rrp-small")) };
}

/** The panel's textContent with the KPIs labelled in `labels` removed (compared on their own). */
function textWithoutKpis(root, labels) {
  const copy = root.querySelector(".rrp").cloneNode(true);
  for (const s of copy.querySelectorAll("style")) s.remove();
  for (const k of copy.querySelectorAll(".rrp-kpi")) if (labels.includes(textOf(k.querySelector(".rrp-k")))) k.remove();
  return copy.textContent;
}

/** KPIs the audit fixes changed on purpose (02-app-divergences.md, "Audit fixes — research and data"). */
const AUDIT_KPIS = ["PPV", "NPV", "Calibration-in-the-large", "Calibration slope", "Potential avoidable share"];

/** Baseline vs edited panel on the audit-fix KPIs of the visible tab: same value, the new detail. */
function auditKpis(c, ra, rb, at) {
  for (const label of AUDIT_KPIS) {
    const ka = kpi(ra, label), kb = kpi(rb, label);
    if (!ka && !kb) continue;
    const where = `${at}/audit-fix/${label}`;
    if (!c.check(!!ka && !!kb, `${where}/present`, null, "on both panels", [!!ka, !!kb])) continue;
    if (label === "PPV" || label === "NPV") {
      const re = label === "PPV" ? /^denominator: \d+ flagged rows?$/ : /^denominator: \d+ unflagged rows?$/;
      c.check(ka.value === kb.value && re.test(kb.detail || ""), where, null, `${ka.value} · ${re}`, kb);
    } else if (label === "Potential avoidable share") {
      c.check(ka.value === kb.value && /^(from \d+ rows? carrying both costs|no scored row carries both costs)$/.test(kb.detail || ""), where, null, `${ka.value} · from n rows carrying both costs`, kb);
    } else {
      // Every compat cohort is the adapter's demo (< 30 labeled rows): withheld (M3).
      c.check(kb.value === "withheld" && /below the 30-row reporting minimum$/.test(kb.detail || ""), where, { baseline: ka }, "withheld · … below the 30-row reporting minimum", kb);
    }
  }
}

/** Feed an artifact file to the panel and wait until it renders (.pa) or is refused (.rrp-danger). */
async function loadArtifact(root, name, text) {
  const input = root.querySelector('.rrp input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(new File([text], name, { type: "application/json" }));
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => root.querySelector(".rrp .pa") || root.querySelector(".rrp-danger"), 10000);
  await tick(10);
}

/** Feed `text` to the panel's hidden file input as `name`, and wait for the rows to land. */
async function loadFile(root, name, text) {
  const input = root.querySelector('.rrp input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(new File([text], name, { type: name.endsWith(".csv") ? "text/csv" : "application/json" }));
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => (textOf(root.querySelector(".rrp-upload")) || "").includes(name) || root.querySelector(".rrp-danger"), 3000);
  await tick(10);
}

/** Run `fn` (which clicks download buttons) and return [{name, json}] for every downloadJson. */
async function captureDownloads(fn) {
  const blobs = new Map();
  const out = [];
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL, realEl = document.createElement;
  let n = 0;
  URL.createObjectURL = (blob) => { const href = `blob:research-suite/${n++}`; blobs.set(href, blob); return href; };
  URL.revokeObjectURL = () => {};
  document.createElement = function (tag, opts) {
    const el = realEl.call(document, tag, opts);
    if (String(tag).toLowerCase() === "a") el.click = () => out.push({ name: el.download, blob: blobs.get(el.getAttribute("href")) });
    return el;
  };
  try {
    fn();
  } finally {
    document.createElement = realEl;
    URL.createObjectURL = realCreate;
    setTimeout(() => { URL.revokeObjectURL = realRevoke; }, 700);
  }
  for (const o of out) o.json = o.blob ? JSON.parse(await o.blob.text()) : null;
  return out;
}

/** Session wrapper: renders `child` inside a SessionProvider and exposes the API on `api.current`. */
function sessionTree(common, child, api) {
  function Grab() { api.current = common.useSession(); return null; }
  return E(common.SessionProvider, null, E(Grab), child);
}

/** A snapshot of the module's sample case `id`, shaped as the apps publish it (§5.1, contract.js). */
function snapshotOf(module, scoring, id, source, at, extra = {}) {
  const c = (module.sampleCases || []).find((s) => s.id === id) || { a: {}, ctx: {} };
  const answers = { ...(c.a || {}) };
  const sc = scoring.computeScore(module, answers);
  const flags = c.rf ? Object.keys(c.rf).filter((k) => c.rf[k]).map((k) => module.flagById[k]).filter(Boolean) : [];
  const patient = (module.demo && module.demo.patient) || {};
  return {
    source, at, moduleKey: module.key,
    score: sc.total, floor: sc.floor, ceiling: sc.ceiling, scorable: sc.scorable, band: sc.band,
    domains: sc.domains, coverage: sc.coverage, sex: patient.sex ?? null, gender: patient.gender ?? null,
    phenotype: c.complaint || "", redFlags: flags.map((f) => f.points), safetyReviewed: true,
    routingCleared: flags.length === 0, answers, ctx: c.ctx || {}, ...extra,
  };
}

function rowOf(module, scoring, cohort, id, nonce) {
  const c = (module.sampleCases || []).find((s) => s.id === id) || { a: {}, ctx: {} };
  const sc = scoring.computeScore(module, c.a || {});
  return cohort.screenToCohortRow(module, { patient: module.demo.patient, answers: c.a || {}, ctx: c.ctx || {}, score: sc, activeFlags: [], complaint: c.complaint || "" },
    { appVersion: "0.4.0", now: Date.parse(NOW), nonce });
}

/** A module bound from `rubric` (generic logic unless `logic`), classified against `loaded`. */
async function bindAs(h, rubric, { logic = null, builtins, loaded, key, logicSha256 = null }) {
  const [bind, lineage] = await Promise.all([h.engine("bind.js"), h.engine("lineage.js")]);
  const classification = await lineage.classifyLineage(rubric, { builtins, loaded, sameUpload: [], logicSha256 });
  return bind.bindModule(rubric, logic, {
    origin: classification.origin, classification, key, sources: { rubricText: bind.serializeRubric(rubric), logicText: null }, loadedAt: NOW,
  });
}

const clone = (x) => JSON.parse(JSON.stringify(x));

// ----------------------------------------------------------------------------- the suite

export default {
  name: "research",
  owner: "WP10",
  run: guarded("research", async (h) => {
    const c = collector(h);
    const { module: masque } = await loadMasque(h);
    const [scoring, cohort, gates, lineage, hash] = await Promise.all([
      h.engine("scoring.js"), h.engine("cohort.js"), h.engine("gates.js"), h.engine("lineage.js"), h.engine("hash.js"),
    ]);
    need(typeof cohort.makeCohort === "function" && typeof gates.calibrationGate === "function", "waits on WP3/WP4");
    const load = async (path, opts) => {
      try { return await h.env.loader.importModule(h.appUrl(path), opts); }
      catch (err) { throw waitError(`waits on WP10: ${path} does not compile: ${String(err.message).split("\n")[0]}`); }
    };
    const [Panel, TabMod, common] = await Promise.all([
      load(`src/${RRP}`).then((m) => m.default), load("src/apps/ResearchTab.jsx"), load("src/ui/common.jsx"),
    ]);
    const ResearchTab = TabMod.default;
    // What the edited panel actually carries: PROJECTS.MASQUE stays until WP14 retires it
    // (§5.6 "stays until WP14 ... and is then removed", §9.15). Read from the module itself, never
    // from a network probe for a retired file.
    const PANEL_PROJECTS = (await load(`src/${RRP}`, { append: "export { PROJECTS };" })).PROJECTS || {};
    const panelHasMasque = !!PANEL_PROJECTS.MASQUE;
    const COPY = TabMod.RESEARCH_COPY;
    const BasePanel = (await h.oracle(RRP)).default;
    const research = masque.research;
    const itemIds = masque.allItems.map((i) => i.id);

    // ------------------------------------------------------------------ compat (legacy props)
    const scr = (id) => snapshotOf(masque, scoring, id, "screener", NOW);
    // Design conflict, recorded: the §8.3 `research` row says project MASQUE/BREATHE/VOICED render
    // without `research`, while §9.15 removes PROJECTS.MASQUE. The suite follows §9.15 once the
    // removal has landed: MASQUE is then driven with the module's own `research` (as ResearchTab
    // passes it, without moduleId so the baseline diff stays exact), and `project: "MASQUE"` with no
    // `research` must give the error card. BREATHE and VOICED stay panel-only and keep the §8.3 case.
    const projectProps = (project) => (project === "MASQUE" && !panelHasMasque ? { project, research: masque.research } : { project });
    c.note(panelHasMasque
      ? "PROJECTS.MASQUE still in the edited panel (pre-WP14): MASQUE compat runs on legacy props without `research` (§8.3)"
      : "PROJECTS.MASQUE retired (§9.15): MASQUE compat runs with research = module.research; legacy props without `research` give the error card");
    const legacyProps = (s) => ({
      score: s.score, ceiling: s.ceiling, scorable: s.scorable, band: s.band, domains: s.domains, coverage: s.coverage,
      sex: s.sex, gender: s.gender, phenotype: s.phenotype, redFlags: s.redFlags, itemIds, capturedRows: [],
      instrumentVersion: masque.instrumentVersion, modelVersion: "masque-prototype-0.3.0",
    });
    const cases = (masque.sampleCases || []).map((s) => s.id);
    const states = [cases[0], cases.find((x) => /redflag/.test(x)) || cases[1], "__empty__"].filter(Boolean);
    await h.withFixedClock(NOW, async () => {
      for (const project of ["MASQUE", "BREATHE", "VOICED"]) {
        for (const st of project === "MASQUE" ? states : [states[0]]) {
          const props = { ...legacyProps(scr(st)), project };
          const a = h.mount(E(BasePanel, props)), b = h.mount(E(Panel, { ...props, ...projectProps(project) }));
          try {
            c.check(!b.container.querySelector('[data-testid="rrp-error"]'), `/compat/${project}/${st}/renders`, { project, st }, "panel", "error card");
            for (let i = 0; i < TABS.length; i++) {
              if (project !== "MASQUE" && TABS[i] === "model") continue;
              let want = tabText(a.container, i);
              let got = tabText(b.container, i);
              if (TABS[i] === "validation" || TABS[i] === "population") {
                auditKpis(c, a.container, b.container, `/compat/${project}/${st}/tab/${TABS[i]}`);
                want = textWithoutKpis(a.container, AUDIT_KPIS);
                got = textWithoutKpis(b.container, AUDIT_KPIS);
              }
              // Driven by module.research, the panel also offers "Load demo cohort" (AD8, from
              // research.demoCohorts, which PROJECTS.MASQUE never carried): checked present, then
              // left out of the baseline comparison.
              if ("research" in projectProps(project) && TABS[i] === "data") {
                const cohortPick = b.container.querySelector(".rrp-cohort");
                c.check(!!cohortPick, `/compat/${project}/${st}/demo-cohort-offered`, { project, st }, "Load demo cohort (AD8)", "missing");
                if (cohortPick) got = got.replace(textOf(cohortPick), "");
              }
              c.diff(want, got, { at: `/compat/${project}/${st}/tab/${TABS[i]}`, input: { project, st } });
            }
          } finally { a.unmount(); b.unmount(); }
        }
      }
    });
    {
      const m = h.mount(E(Panel, { project: "NO_SUCH_PROJECT" }));
      const t = textOf(m.container.querySelector('[data-testid="rrp-error"]')) || "";
      c.check(t.includes("Unknown research project 'NO_SUCH_PROJECT'"), "/compat/unknown-project", null, "Unknown research project 'NO_SUCH_PROJECT'", t);
      m.unmount();
    }
    for (const project of ["BREATHE", "VOICED"]) {
      c.check(!!PANEL_PROJECTS[project], `/compat/panel-projects/${project}`, null, "kept in the panel (panel-only)", Object.keys(PANEL_PROJECTS));
    }
    if (!panelHasMasque) {
      const m = h.mount(E(Panel, { project: "MASQUE", ...legacyProps(scr(states[0])) }));
      const t = textOf(m.container.querySelector('[data-testid="rrp-error"]')) || "";
      c.check(t.includes("Unknown research project 'MASQUE'"), "/compat/MASQUE-retired/no-research", null, "Unknown research project 'MASQUE'", t);
      m.unmount();
    }
    {
      const s = scr(states[0]);
      const props = { ...legacyProps(s), ...projectProps("MASQUE"), scorable: true, coverage: 100 };
      delete props.band;
      const m = h.mount(E(Panel, props));
      const cur = kpi(m.container, "Current score"), dec = kpi(m.container, "Decision");
      c.check(cur && cur.detail === "—", "/compat/band-null/current-score-detail", null, "—", cur);
      c.check(dec && dec.value === "ABSTAIN", "/compat/band-null/decision", null, "ABSTAIN", dec);
      m.unmount();
    }

    // Legacy population page: the baseline and edited components, both with no props, both
    // resolving against a <base> set to app/ as population.html's own document would.
    {
      const Base = (await h.oracle("MASQUE_Population.jsx")).default;
      const Pop = (await load("src/MASQUE_Population.jsx")).default;
      const base = document.createElement("base");
      base.href = h.env.appBase;
      document.head.prepend(base);
      let a, b;
      try {
        a = h.mount(E(Base)); b = h.mount(E(Pop));
        const ready = (m) => !/Loading…/.test(textOf(m.container)) && m.container.querySelector(".foot");
        await until(() => ready(a) && ready(b), 20000);
      } finally { base.remove(); }
      c.diff(textOf(a.container), textOf(b.container), { at: "/legacy/MASQUE_Population.jsx/page" });
      c.check(!!b.container.querySelector(".sa-pop > .pop"), "/legacy/population/scoped-root", null, ".sa-pop > .pop", "missing");
      a.unmount(); b.unmount();
    }

    // ------------------------------------------------------------------ the Research tab
    const derived = await derivedFixture(h, masque, { mutate: bumpFirstWeight });
    const wording = await derivedFixture(h, masque, { mutate: (r) => { r.domains[0].items[0].text += " (edited)"; }, id: `local-${masque.id}-wording` });
    c.check(derived.classification.kind === "verified" && derived.validation.ok, "/fixtures/derived", null, "verified, valid", { kind: derived.classification.kind, errors: derived.validation.errors });
    c.check(wording.classification.kind === "verified" && wording.validation.ok, "/fixtures/wording", null, "verified, valid", { kind: wording.classification.kind, errors: wording.validation.errors });

    const dirty = [];
    const mountTab = (module, api) => h.mount(sessionTree(common, E(ResearchTab, { module, appVersion: "0.4.0", env: h.env, onDirty: (t, s) => dirty.push([t, s]) }), api));
    const openReadiness = (root) => { const b = root.querySelector('[data-testid="research-seg-readiness"]'); if (b.getAttribute("aria-selected") !== "true") click(b); };

    // screen: no snapshot, then routing not cleared.
    {
      const api = { current: null };
      const m = mountTab(masque, api);
      openReadiness(m.container);
      const cur = kpi(m.container, "Current score"), prob = kpi(m.container, "Calibrated probability"), dec = kpi(m.container, "Decision");
      c.check(cur && cur.value === "—" && cur.detail === "no screen in this session", "/screen/none/current", null, "— / no screen in this session", cur);
      c.check(prob && prob.value === "withheld", "/screen/none/probability", null, "withheld", prob);
      c.check(dec && dec.value === "WITHHELD", "/screen/none/decision", null, "WITHHELD", dec);
      const note = textOf(m.container.querySelector('[data-testid="rrp-no-screen"]')) || "";
      c.check(note === "No screen in this session — the panel has nothing to score; absent data is not a negative screen.", "/screen/none/text", null, "the §5.6 sentence", note);
      const card = JSON.parse(tabText(m.container, 5).match(/\{[\s\S]*\}/)[0]);
      c.check(card.currentPatientOutput && card.currentPatientOutput.noScreen === true && !("score" in card.currentPatientOutput), "/screen/none/model-card", null, { noScreen: true }, card.currentPatientOutput);
      click(tabButtons(m.container)[0]);

      for (const source of ["scribe", "screener"]) {
        flushSync(() => api.current.publish(snapshotOf(masque, scoring, states[0], source, source === "scribe" ? "2026-10-01T12:05:00.000Z" : "2026-10-01T12:06:00.000Z", { routingCleared: false, redFlags: [], safetyReviewed: false })));
        const d = kpi(m.container, "Decision"), p = kpi(m.container, "Calibrated probability");
        const want = source === "scribe" ? COPY.routingWithheld.scribe : COPY.routingWithheld.screener;
        c.check(d && d.value === "WITHHELD" && d.detail === want, `/screen/routing/${source}/decision`, null, ["WITHHELD", want], d);
        c.check(p && /^\d+%(–\d+%)?$/.test(p.value), `/screen/routing/${source}/probability-shown`, null, "a percentage", p);
      }
      // routing held by an open red flag (safety step done): the reason names the flag, never a missing review.
      for (const source of ["scribe", "screener"]) {
        flushSync(() => api.current.publish(snapshotOf(masque, scoring, states[0], source, source === "scribe" ? "2026-10-01T12:06:10.000Z" : "2026-10-01T12:06:20.000Z", { routingCleared: false, redFlags: ["flag"], safetyReviewed: false })));
        const d = kpi(m.container, "Decision");
        const call = textOf(m.container.querySelector('[data-testid="rrp-routing-withheld"]')) || "";
        const want = COPY.routingFlagOpen[source];
        c.check(d && d.value === "OVERRIDE", `/screen/flag/${source}/decision`, null, "OVERRIDE", d);
        c.check(call.includes(want) && !call.includes("Safety review not recorded"), `/screen/flag/${source}/reason`, null, want, call);
      }
      {
        const snap = { source: "screener", redFlags: [], safetyReviewed: true, routingCleared: false };
        const got = TabMod.routingWithheldDetail(snap);
        c.check(got === COPY.routingNotCleared.screener, "/screen/routing/not-cleared-fallback", null, COPY.routingNotCleared.screener, got);
      }
      flushSync(() => api.current.publish(snapshotOf(masque, scoring, states[0], "screener", "2026-10-01T12:07:00.000Z")));
      const d2 = kpi(m.container, "Decision");
      c.check(d2 && ["FLAG", "NO FLAG", "ABSTAIN"].includes(d2.value), "/screen/cleared/decision", null, "FLAG | NO FLAG | ABSTAIN", d2);
      m.unmount();
    }

    // calibration: built-in, scoring-changed derivation, wording-only derivation.
    c.check(gates.calibrationGate(masque) === true, "/calibration/builtin/gate", null, true, false);
    c.check(gates.calibrationGate(derived.module) === false, "/calibration/derived/gate", null, false, true);
    c.check(gates.calibrationGate(wording.module) === true, "/calibration/wording/gate", null, true, false);
    c.check(TabMod.calibrationSource(derived.module) === `${masque.name} ${masque.instrumentVersion}`, "/calibration/derived/source", null, `${masque.name} ${masque.instrumentVersion}`, TabMod.calibrationSource(derived.module));
    for (const [label, mod, applies] of [["builtin", masque, true], ["wording", wording.module, true], ["derived", derived.module, false]]) {
      const api = { current: null };
      const m = mountTab(mod, api);
      openReadiness(m.container);
      flushSync(() => api.current.publish(snapshotOf(mod, scoring, states[0], "screener", "2026-10-01T12:10:00.000Z")));
      const root = m.container;
      const at = `/calibration/${label}`;
      const prob = kpi(root, "Calibrated probability");
      if (applies) {
        c.check(prob && /%/.test(prob.value), `${at}/probability`, null, "a percentage", prob);
        c.check(!root.querySelector('[data-testid="rrp-calibration-withheld"]'), `${at}/no-withheld-note`, null, "absent", "present");
        tabText(root, 2);
        c.check(!!kpi(root, "Sensitivity") && /Calibration-in-the-large/.test(textOf(root.querySelector(".rrp"))), `${at}/validation`, null, "sensitivity and calibration block", "missing");
        tabText(root, 1);
        c.check(!!root.querySelector('[data-testid="rrp-demo-cohort"]'), `${at}/demo-cohort-select`, null, "present", "absent");
      } else {
        const reason = `The illustrative calibration was set for ${masque.name} ${masque.instrumentVersion} scoring; this module's scoring differs, so nothing that depends on it is computed.`;
        c.check(prob && prob.value === "withheld", `${at}/probability`, null, "withheld", prob);
        c.check((kpi(root, "Decision") || {}).value === "WITHHELD", `${at}/decision`, null, "WITHHELD", kpi(root, "Decision"));
        c.check((textOf(root.querySelector('[data-testid="rrp-calibration-withheld"]')) || "").includes(reason), `${at}/reason`, null, reason, textOf(root.querySelector('[data-testid="rrp-calibration-withheld"]')));
        c.check(/^\d+\/\d+$|^\d+–\d+$/.test((kpi(root, "Current score") || {}).value || ""), `${at}/index-kept`, null, "the index", kpi(root, "Current score"));
        const v = tabText(root, 2);
        for (const gone of ["Sensitivity", "Specificity", "PPV", "NPV", "Brier score", "Accuracy", "Calibration-in-the-large", "Calibration slope"]) {
          c.check(!kpi(root, gone), `${at}/validation/${gone}`, null, "absent", kpi(root, gone));
        }
        c.check(!!kpi(root, "AUROC") && /\d/.test(kpi(root, "AUROC").value), `${at}/validation/AUROC-kept`, null, "AUROC", kpi(root, "AUROC"));
        c.check(/Internal consistency/.test(v) && (/Repeat measures/.test(v) || /No repeat measures/.test(v)), `${at}/validation/kept`, null, "repeat measures and internal consistency", v.slice(0, 200));
        const f = tabText(root, 3);
        c.check(!!root.querySelector('[data-testid="rrp-fairness-withheld"]') && !/Fairness audit: (PASS|FAIL|INCONCLUSIVE|NOT ASSESSABLE)/.test(f) && !/Equity mitigation/.test(f) && !/\d+%/.test(f), `${at}/fairness`, null, "audit withheld, no rates", f.slice(0, 300));
        tabText(root, 4);
        const sp = kpi(root, "Screen-positive estimate");
        c.check(sp && sp.value === "withheld" && !!kpi(root, "Mean annual cost") && !!kpi(root, "Scored rows"), `${at}/population`, null, "flagged rate withheld, counts and costs kept", sp);
        const d = tabText(root, 1);
        c.check(!root.querySelector('[data-testid="rrp-demo-cohort"]') && !!root.querySelector('[data-testid="rrp-demo-cohort-hidden"]'), `${at}/demo-cohort-hidden`, null, "hidden with note", "shown");
        c.check(d.includes(`Current source: illustrative demo rows (scored on ${masque.name} ${masque.instrumentVersion})`), `${at}/demo-source-name`, null, "scored on …", d.slice(0, 200));
        const [man] = await captureDownloads(() => click(qa(root, ".rrp-btn").find((b) => /Manifest/.test(textOf(b)))));
        const cardText = tabText(root, 5);
        const card = JSON.parse(cardText.match(/\{[\s\S]*\}/)[0]);
        for (const [doc, name] of [[man && man.json, "manifest"], [card, "model-card"]]) {
          for (const k of ["calibration", "fairnessAudit", "equityMitigation", "deploymentGate"]) {
            c.check(doc && doc[k] && doc[k].withheld === true && doc[k].reason === reason, `${at}/${name}/${k}`, null, { withheld: true, reason }, doc && doc[k]);
          }
          c.check(doc && doc.module_id === mod.id && doc.scoring_hash === mod.hashes.scoringHash, `${at}/${name}/identity`, null, [mod.id, mod.hashes.scoringHash], doc && [doc.module_id, doc.scoring_hash]);
          c.check(doc && doc.cohortState && Number.isFinite(doc.cohortState.rows), `${at}/${name}/counts-kept`, null, "cohortState", doc && doc.cohortState);
        }
        c.check(card.currentPatientOutput && card.currentPatientOutput.probability && card.currentPatientOutput.probability.withheld === true, `${at}/model-card/probability`, null, "withheld", card.currentPatientOutput && card.currentPatientOutput.probability);
        c.check(man && man.name === `${mod.id}-ingestion-manifest.json`, `${at}/manifest-file-name`, null, `${mod.id}-ingestion-manifest.json`, man && man.name);
      }
      m.unmount();
    }

    // rowscope: captured Screener rows, then a CSV mixing module ids and instrument versions.
    {
      const api = { current: null };
      const m = mountTab(masque, api);
      openReadiness(m.container);
      const root = m.container;
      flushSync(() => { api.current.addRow("screener", rowOf(masque, scoring, cohort, states[0], "aaaaa")); api.current.addRow("screener", rowOf(masque, scoring, cohort, states[0], "bbbbb")); });
      const rowsSel = root.querySelector('[data-testid="research-rows-select"]');
      c.check(rowsSel && rowsSel.value === "screener" && /Clinician Screener \(2\)/.test(textOf(rowsSel)), "/rowscope/rows-select-default", null, "screener (2)", rowsSel && [rowsSel.value, textOf(rowsSel)]);
      tabText(root, 1);
      click(qa(root, ".rrp-btn").find((b) => /Load 2 captured screens/.test(textOf(b))));
      c.check((kpi(root, "Rows") || {}).value === "2", "/rowscope/captured/rows", null, "2", kpi(root, "Rows"));
      c.check(/2 match this module and instrument version; 0 carry no/.test(textOf(root.querySelector('[data-testid="rrp-row-scope"]')) || ""), "/rowscope/captured/matched", null, "2 match", textOf(root.querySelector('[data-testid="rrp-row-scope"]')));
      const v = masque.instrumentVersion;
      const csv = [
        "module_id,instrument_version,score,label,sex",
        `${masque.id},${v},70,1,female`, `${masque.id},${v},40,0,male`, `${masque.id},${v},55,1,female`,
        `other-module,${v},80,1,male`, `other-module,${v},20,0,female`,
        `${masque.id},0.1,65,1,female`,
        ",,50,0,male", ",,30,0,female",
        `,${v},45,1,male`,
      ].join("\n") + "\n";
      await loadFile(root, "mixed.csv", csv);
      const scopeText = textOf(root.querySelector('[data-testid="rrp-row-scope"]')) || "";
      c.check((kpi(root, "Rows") || {}).value === "6", "/rowscope/csv/rows", { csv }, "6", kpi(root, "Rows"));
      c.check(/Of 9 loaded rows: 3 match this module and instrument version; 3 carry no .* 3 name another module or instrument version/.test(scopeText), "/rowscope/csv/groups", { csv }, "3 matched, 3 unknown, 3 excluded", scopeText);
      const excl = qa(root, '[data-testid="rrp-row-scope"] tbody tr').map((tr) => qa(tr, "td").map(textOf).join("|"));
      c.check(JSON.stringify(excl) === JSON.stringify([`other-module|${v}|2`, `${masque.id}|0.1|1`]), "/rowscope/csv/excluded-list", { csv }, [`other-module|${v}|2`, `${masque.id}|0.1|1`], excl);
      const [man] = await captureDownloads(() => click(qa(root, ".rrp-btn").find((b) => /Manifest/.test(textOf(b)))));
      const rs = man && man.json && man.json.cohortState && man.json.cohortState.rowScope;
      c.check(rs && rs.loaded === 9 && rs.matched === 3 && rs.provenanceUnknown === 3 && rs.excluded.length === 2 && rs.excluded[0].n === 2, "/rowscope/manifest", { csv }, { loaded: 9, matched: 3, provenanceUnknown: 3 }, rs);
      c.check(dirty.some(([t, s]) => t === "research" && s === "9 uploaded rows"), "/rowscope/dirty", null, ["research", "9 uploaded rows"], dirty.slice(-3));
      m.unmount();
    }

    // cohorts: the three demo cohorts against their `why` text (Q26).
    const PCAL = await load(`src/${RRP}`, { append: "export { calibration, normalizeRows, FAIRNESS_POLICY };" });
    {
      const api = { current: null };
      const m = mountTab(masque, api);
      openReadiness(m.container);
      const root = m.container;
      // A complete screen, so the decision reflects the fairness gate rather than "no screen".
      const full = (masque.sampleCases || []).find((x) => !x.rf) || masque.sampleCases[0];
      flushSync(() => api.current.publish(snapshotOf(masque, scoring, full.id, "screener", "2026-10-01T12:20:00.000Z")));
      const expectFor = { balanced: "PASS", unlabeled: "NOT ASSESSABLE", disparate: "FAIL" };
      const q26 = [];
      for (const dc of research.demoCohorts || []) {
        tabText(root, 1);
        const sel = root.querySelector('[data-testid="rrp-demo-cohort"]');
        flushSync(() => {
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
          setter.call(sel, dc.id);
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await tick(5);
        const n = cohort.makeCohort(dc.spec).length;
        c.check((kpi(root, "Rows") || {}).value === String(n), `/cohorts/${dc.id}/rows`, null, String(n), kpi(root, "Rows"));
        c.check((textOf(root.querySelector('[data-testid="rrp-demo-cohort-why"]')) || "").includes(dc.why), `/cohorts/${dc.id}/why-shown`, null, dc.why, textOf(root.querySelector('[data-testid="rrp-demo-cohort-why"]')));
        c.check(dirty.some(([t, s]) => t === "research" && s === "demo cohort loaded"), `/cohorts/${dc.id}/dirty`, null, "demo cohort loaded", dirty.slice(-2));
        const fair = tabText(root, 3);
        const verdict = (fair.match(/Fairness audit: ([A-Z ]+?)\./) || [])[1] || null;
        const val = tabText(root, 2);
        {
          // M3: calibration-in-the-large is printed only at or above the reporting minimum.
          const cal = PCAL.calibration(PCAL.normalizeRows(cohort.makeCohort(dc.spec), research), research, PCAL.FAIRNESS_POLICY);
          const citl = kpi(root, "Calibration-in-the-large");
          if (cal) c.check(!!citl && (citl.value === "withheld") === !cal.reliable, `/audit/cohorts/${dc.id}/citl`, { n: cal.n }, cal.reliable ? "a value" : "withheld", citl);
        }
        const want = expectFor[dc.id];
        const whySays = /NOT ASSESSABLE/.test(dc.why) ? "NOT ASSESSABLE" : /\bFAIL\b/.test(dc.why) ? "FAIL" : /\bPASS\b/.test(dc.why) ? "PASS" : null;
        // Q26: a verdict that disagrees with the cohort's own `why` text is reported to the lead,
        // not "fixed" here: the `why` strings are moved content, and the panel's verdict rule is
        // held to the baseline panel by research-parity. The other assertions still apply.
        if (verdict !== whySays || (want && verdict !== want)) {
          q26.push(`${dc.id}: the panel's fairness audit (sex) reads ${verdict}; its why text says ${whySays}`);
        }
        c.check(!!verdict, `/cohorts/${dc.id}/verdict-present`, { cohort: dc.id }, "a verdict", verdict);
        c.note(`demo cohort ${dc.id}: ${n} rows, fairness (sex) ${verdict}; why: "${dc.why}"`);
        if (dc.id === "unlabeled") c.check(/No validation metrics issued/.test(val), "/cohorts/unlabeled/validation-withheld", null, "withheld", val.slice(0, 200));
        tabText(root, 0);
        const dec = kpi(root, "Decision");
        const gated = !!dec && dec.value === "WITHHELD" && dec.detail === "Model rejected on this cohort (§11)";
        c.check(gated === (verdict === "FAIL"), `/cohorts/${dc.id}/fairness-gate`, { cohort: dc.id }, verdict === "FAIL" ? "withheld by the fairness gate" : "not gated", dec);
        if (dc.id === "disparate") {
          tabText(root, 3);
          const gBtn = qa(root, ".rrp-btn").find((b) => textOf(b).trim() === "gender");
          if (gBtn) click(gBtn);
          const g = textOf(root.querySelector(".rrp"));
          c.check(/group(s)? suppressed\./.test(g) && /Suppressed — below the 30-row reporting minimum/.test(g), "/cohorts/disparate/suppressed-stratum", null, "a suppressed stratum", g.slice(0, 300));
        }
      }
      if (q26.length) c.note(`Q26 — for the lead (demo cohort verdict ≠ its why text): ${q26.join("; ")}`);
      else c.note("Q26: every demo cohort's verdict matches its why text");
      tabText(root, 1);
      click(qa(root, ".rrp-btn").find((b) => /Restore demo/.test(textOf(b))));
      await tick(5);
      c.check(dirty.length && dirty[dirty.length - 1][1] === null, "/cohorts/restore-clears-dirty", null, null, dirty[dirty.length - 1]);
      m.unmount();
    }
    // The verdicts once more from the panel's own functions, on both axes, for the report.
    {
      const P = await h.env.loader.importModule(h.appUrl(`src/${RRP}`), { append: "export { normalizeRows, fairness, metrics, FAIRNESS_POLICY };" });
      for (const dc of research.demoCohorts || []) {
        const rows = P.normalizeRows(cohort.makeCohort(dc.spec), research);
        const sex = P.fairness(rows, research, P.FAIRNESS_POLICY, "sex"), gender = P.fairness(rows, research, P.FAIRNESS_POLICY, "gender");
        c.note(`demo cohort ${dc.id}: sex ${sex.overall} (${Object.entries(sex.verdicts).map(([k, v]) => `${k} ${v.code}`).join(", ")}); gender ${gender.overall}, ${gender.suppressedGroups} suppressed; validation ${P.metrics(rows, research) ? "computed" : "withheld"}`);
      }
    }

    // population: the gate for each classification.
    const [bind] = await Promise.all([h.engine("bind.js")]);
    const shapeRubric = await h.fixture("modules/shape.rubric.json");
    const withResearch = (r, id) => { const x = clone(r); x.id = id; x.label = `${r.label} ${id}`; x.research = clone(research); delete x.research.population; x.research.calibration = { ...x.research.calibration, appliesTo: { scoringHash: "0".repeat(64) } }; return x; };
    const plainNoResearch = await bindAs(h, clone(shapeRubric), { builtins: [masque], loaded: [masque], key: "t:plain" });
    const plainResearch = await bindAs(h, withResearch(shapeRubric, "shape-research"), { builtins: [masque], loaded: [masque], key: "t:plain-r" });
    // A derivation of that upload (§3.11 row 6): provenance rooted in the uploaded module.
    const fromUpload = await (async () => {
      const r = withResearch(shapeRubric, "shape-research-child");
      r.domains[0].items[0].text += " (edited)";
      delete r.provenance;
      const rec = lineage.ancestorRecord(plainResearch);
      const hs = await hash.rubricHashes(r);
      r.provenance = { root: rec, derivedFrom: rec, lineage: [rec], contentHash: hs.contentHash, createdAt: NOW };
      return bindAs(h, r, { builtins: [masque], loaded: [masque, plainResearch], key: "t:from-upload" });
    })();
    // A forged derivation: the verified derivation's file, one weight changed by hand afterwards.
    const forged = await (async () => {
      const r = clone(derived.rubric);
      r.id = "local-forged"; r.label = "Forged module";
      const d = r.domains.find((x) => !x.negative);
      d.items[1].w += 1; d.max += 1;
      return bindAs(h, r, { logic: masque.logic, builtins: [masque], loaded: [masque], key: "t:forged", logicSha256: masque.hashes.logicSha256 });
    })();
    const gateCases = [
      ["builtin", masque, { show: true, banner: false }],
      ["verified", derived.module, { show: true, banner: true }],
      ["derived-from-upload", fromUpload, { show: false, message: COPY.popOnlyBuiltin }],
      ["plain-upload-research", plainResearch, { show: false, message: COPY.popOnlyBuiltin }],
      ["plain-upload", plainNoResearch, { show: false, message: COPY.popNone }],
      ["forged", forged, { show: false, message: COPY.popOnlyBuiltin }],
    ];
    c.note(`population gate classifications: ${gateCases.map(([k, mod]) => `${k}=${mod.origin}/${mod.classification && mod.classification.kind}/row ${mod.classification && mod.classification.row}`).join(", ")}`);
    c.check(fromUpload.classification.kind === "derived-from-upload", "/population/fixture/derived-from-upload", null, "derived-from-upload", fromUpload.classification);
    c.check(forged.origin !== "derived" && forged.classification.kind !== "verified", "/population/fixture/forged-not-verified", null, "not verified", forged.classification);
    for (const [kind, mod, want] of gateCases) {
      const g = TabMod.populationGate(mod);
      const av = lineage.availability(mod).research.population;
      c.check(g.show === want.show && av === want.show, `/population/${kind}/gate`, { kind }, want.show, { gate: g.show, availability: av });
      const m = mountTab(mod, { current: null });
      const root = m.container;
      const popBtn = root.querySelector('[data-testid="research-seg-population"]');
      c.check(popBtn.getAttribute("aria-selected") === (want.show ? "true" : "false"), `/population/${kind}/default-section`, null, want.show ? "population" : "readiness", popBtn.getAttribute("aria-selected"));
      click(popBtn);
      const sec = root.querySelector('[data-testid="research-population"]');
      if (want.show) {
        c.check(!!sec.querySelector(".sa-pop > .pop"), `/population/${kind}/mounted`, null, "embedded page", textOf(sec).slice(0, 120));
        c.check(!sec.querySelector(".brandrow") && !sec.querySelector(".foot"), `/population/${kind}/embedded-chrome`, null, "no brand row, no footer", "present");
        const banner = textOf(sec.querySelector('[data-testid="research-pop-banner"]'));
        const wantBanner = want.banner ? COPY.popBanner.replace("{rootName}", masque.name) : null;
        c.check(banner === wantBanner, `/population/${kind}/banner`, null, wantBanner, banner);
      } else {
        const msg = textOf(sec.querySelector('[data-testid="research-pop-message"]'));
        c.check(msg === want.message && !sec.querySelector(".sa-pop"), `/population/${kind}/message`, null, want.message, msg);
      }
      if (kind === "builtin") {
        // Every index-listed artifact renders, fetched through baseUrl (this page sits in tests/).
        const index = JSON.parse(await h.fetchText(research.population.index.replace(/^\.\//, "")));
        const listed = (index.artifacts || []).length;
        const done = await until(() => !/Loading…/.test(textOf(sec)) && sec.querySelectorAll(".pa").length >= listed, 20000);
        const rendered = sec.querySelectorAll(".pa").length;
        c.check(!!done && rendered === listed && !/Artifact refused/.test(textOf(sec)), "/population/builtin/artifacts", null, `${listed} rendered, none refused`, { rendered, refused: /Artifact refused/.test(textOf(sec)) });
        c.note(`population: ${rendered} of ${listed} index-listed artifacts rendered through baseUrl`);
      }
      m.unmount();
    }
    // A population artifact file loaded into the panel is refused where the gate refuses.
    {
      const m = mountTab(plainResearch, { current: null });
      openReadiness(m.container);
      tabText(m.container, 1);
      const art = await h.fixture("population-estimates.synthetic.json");
      await loadFile(m.container, "pop.json", JSON.stringify(art));
      c.check(/Population estimates are shown only for built-in modules/.test(textOf(m.container.querySelector(".rrp-danger")) || ""), "/population/panel-artifact-refused", null, "refused", textOf(m.container.querySelector(".rrp-danger")));
      m.unmount();
    }

    // sources: the two selectors and the model version.
    {
      const api = { current: null };
      const m = mountTab(masque, api);
      openReadiness(m.container);
      const root = m.container;
      const screenSel = () => root.querySelector('[data-testid="research-screen-select"]');
      c.check(screenSel().value === "none" && qa(screenSel(), "option").length === 1, "/sources/empty", null, "None only", textOf(screenSel()));
      flushSync(() => api.current.publish(snapshotOf(masque, scoring, states[0], "screener", "2026-10-01T09:05:00.000Z")));
      flushSync(() => api.current.publish(snapshotOf(masque, scoring, states[0], "scribe", "2026-10-01T09:07:00.000Z")));
      const opts = qa(screenSel(), "option").map((o) => [o.value, textOf(o)]);
      c.check(screenSel().value === "scribe" && opts.length === 3 && /^Clinician Screener \(\d\d:\d\d\)$/.test(opts[0][1]) && /^Ambient Scribe \(\d\d:\d\d\)$/.test(opts[1][1]) && opts[2][1] === "None", "/sources/options", null, "Screener (hh:mm), Scribe (hh:mm), None; latest selected", { value: screenSel().value, opts });
      c.check(/model masque-scribe-prototype-0\.4\.0/.test(textOf(root.querySelector(".rrp-badge"))), "/sources/model-version-scribe", null, "model masque-scribe-prototype-0.4.0", textOf(root.querySelector(".rrp-badge")));
      const pick = (sel, value) => flushSync(() => {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, value);
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      pick(screenSel(), "screener");
      c.check(/model masque-prototype-0\.4\.0/.test(textOf(root.querySelector(".rrp-badge"))), "/sources/model-version-screener", null, "model masque-prototype-0.4.0", textOf(root.querySelector(".rrp-badge")));
      pick(screenSel(), "none");
      c.check((kpi(root, "Current score") || {}).value === "—", "/sources/none", null, "—", kpi(root, "Current score"));
      flushSync(() => { api.current.addRow("screener", rowOf(masque, scoring, cohort, states[0], "s0001")); api.current.addRow("scribe", rowOf(masque, scoring, cohort, states[0], "s0002")); api.current.addRow("scribe", rowOf(masque, scoring, cohort, states[0], "s0003")); });
      const rowsSel = root.querySelector('[data-testid="research-rows-select"]');
      c.check(rowsSel.value === "none" && qa(rowsSel, "option").map((o) => textOf(o)).join("|") === "Clinician Screener (1)|Ambient Scribe (2)|Both (3)|None", "/sources/rows-options", null, "none selected; Screener (1)|Scribe (2)|Both (3)|None", { value: rowsSel.value, opts: qa(rowsSel, "option").map((o) => textOf(o)) });
      pick(rowsSel, "all");
      tabText(root, 1);
      c.check(qa(root, ".rrp-btn").some((b) => /Load 3 captured screens/.test(textOf(b))), "/sources/rows-both", null, "Load 3 captured screens", qa(root, ".rrp-btn").map((b) => textOf(b)));
      m.unmount();
    }

    // ------------------------------------------------------------------ audit fixes
    await auditFixes(h, c, { load, Panel, mountTab, openReadiness, masque, research, scoring, itemIds, scr: snapshotOf });

    return c.result();
  }),
};

/** The audit fixes of 02-app-divergences.md ("Audit fixes — research and data"), each driven through the UI. */
async function auditFixes(h, c, { load, Panel, mountTab, openReadiness, masque, research, scoring, itemIds, scr }) {
  const cal = research.calibration;
  const logistic = (x) => 1 / (1 + Math.exp(-cal.slope * (x - cal.midpoint)));
  const pct0 = (v) => `${Math.round(v * 100)}%`;

  // F14: the attainable range runs floor–ceiling, on the risk tab and in the model card.
  {
    const props = { project: research.projectKey, research, moduleId: masque.id, scoringHash: masque.hashes.scoringHash,
      score: 40, floor: 31, ceiling: 70, scorable: false, band: null, coverage: 60, itemIds, capturedRows: [], instrumentVersion: masque.instrumentVersion };
    const m = h.mount(E(Panel, props));
    const cur = kpi(m.container, "Current score"), prob = kpi(m.container, "Calibrated probability");
    c.check(cur && cur.value === "31–70", "/audit/F14/current-score", props, "31–70", cur);
    c.check(prob && prob.value === `${pct0(logistic(31))}–${pct0(logistic(70))}`, "/audit/F14/probability-range", props, `${pct0(logistic(31))}–${pct0(logistic(70))}`, prob);
    const card = JSON.parse(tabText(m.container, 5).match(/\{[\s\S]*\}/)[0]);
    const out = card.currentPatientOutput || {};
    c.check(JSON.stringify(out.attainableRange) === "[31,70]" && Array.isArray(out.probabilityRange) && out.probabilityRange[0] === +logistic(31).toFixed(4),
      "/audit/F14/model-card", props, { attainableRange: [31, 70], probabilityRange0: +logistic(31).toFixed(4) }, { attainableRange: out.attainableRange, probabilityRange: out.probabilityRange });
    m.unmount();
    // Through the Research tab: the snapshot's floor reaches the panel.
    const api = { current: null };
    const t = mountTab(masque, api);
    openReadiness(t.container);
    const cases = (masque.sampleCases || []).map((x) => x.id);
    flushSync(() => api.current.publish(scr(masque, scoring, cases[0], "screener", "2026-10-01T12:30:00.000Z", { score: 44, floor: 29, ceiling: 66, scorable: false, band: null })));
    const cur2 = kpi(t.container, "Current score");
    c.check(cur2 && cur2.value === "29–66", "/audit/F14/research-tab", null, "29–66 (snapshot floor–ceiling)", cur2);
    t.unmount();
  }

  // M2: an incomputable equity gap is null in the model card, never 0. The cohort is built so the
  // held-out half has no female positive case (the panel's deterministic split, replicated
  // here): the held-out sensitivity gap cannot be computed.
  {
    const P = await load(`src/${RRP}`, { append: "export { normalizeRows, equityAdjustment, FAIRNESS_POLICY };" });
    const devHalf = (id) => { let x = 0x811c9dc5; for (let k = 0; k < id.length; k++) { x ^= id.charCodeAt(k); x = Math.imul(x, 0x01000193) >>> 0; } return x % 2 === 0; };
    const ids = { dev: [], hold: [] };
    for (let i = 0; ids.dev.length < 60 || ids.hold.length < 60; i++) { const id = `m2-${i}`; (devHalf(id) ? ids.dev : ids.hold).push(id); }
    const rows = [];
    const add = (half, n, sex, label) => { for (let i = 0; i < n; i++) rows.push({ subject_id: ids[half].shift(), score: label ? 80 : 20, label, sex }); };
    add("dev", 12, "female", 1); add("dev", 12, "male", 1); add("dev", 6, "female", 0); add("dev", 6, "male", 0);
    add("hold", 0, "female", 1); add("hold", 6, "male", 1); add("hold", 6, "female", 0); add("hold", 6, "male", 0);
    const mit = P.equityAdjustment(P.normalizeRows(rows, research), research, P.FAIRNESS_POLICY, "sex");
    c.check(mit && !mit.insufficient && mit.sensGapBefore === null && mit.sensGapAfter === null, "/audit/M2/precondition", null, "held-out sensitivity gap not computable", mit && { insufficient: mit.insufficient, before: mit.sensGapBefore, after: mit.sensGapAfter });
    const m = h.mount(E(Panel, { project: research.projectKey, research, score: 72, ceiling: 72, scorable: true, band: "high", coverage: 100, itemIds, capturedRows: [] }));
    tabText(m.container, 1);
    await loadFile(m.container, "equity.json", JSON.stringify(rows));
    const card = JSON.parse(tabText(m.container, 5).match(/\{[\s\S]*\}/)[0]);
    const res = card.equityMitigation && card.equityMitigation.result;
    c.check(!!res && res.sensitivityGap && res.sensitivityGap.before === null && res.sensitivityGap.after === null && Number.isFinite(res.specificityGap.before),
      "/audit/M2/model-card", null, { sensitivityGap: { before: null, after: null }, specificityGap: "numbers" }, res && { sensitivityGap: res.sensitivityGap, specificityGap: res.specificityGap });
    m.unmount();
  }

  // M3 (PPV/NPV denominators) and M4 (avoidable share on rows carrying both costs), on a CSV.
  {
    const m = h.mount(E(Panel, { project: research.projectKey, research, score: 72, ceiling: 72, scorable: true, band: "high", coverage: 100, itemIds, capturedRows: [] }));
    const csv = "score,label,annual_cost,avoidable_cost\n90,1,1000,500\n40,0,2000,\n55,1,,300\n85,1,3000,600\n20,0,800,100\n";
    tabText(m.container, 1);
    await loadFile(m.container, "costs.csv", csv);
    tabText(m.container, 4);
    const share = kpi(m.container, "Potential avoidable share");
    // Rows carrying both costs: 1000/500, 3000/600, 800/100 → 1200 / 4800 = 25%. The old
    // division of means over different rows gave (500+300+600+100)/4 ÷ (1000+2000+3000+800)/4 = 22%.
    c.check(share && share.value === "25%" && share.detail === "from 3 rows carrying both costs", "/audit/M4/avoidable-share", { csv }, "25% · from 3 rows carrying both costs", share);
    tabText(m.container, 2);
    const ppv = kpi(m.container, "PPV"), npv = kpi(m.container, "NPV");
    const flagged = [90, 40, 55, 85, 20].filter((x) => logistic(x) >= research.threshold).length;
    c.check(ppv && ppv.detail === `denominator: ${flagged} flagged row${flagged === 1 ? "" : "s"}`, "/audit/M3/ppv-denominator", { csv }, `denominator: ${flagged} flagged rows`, ppv);
    c.check(npv && npv.detail === `denominator: ${5 - flagged} unflagged row${5 - flagged === 1 ? "" : "s"}`, "/audit/M3/npv-denominator", { csv }, `denominator: ${5 - flagged} unflagged rows`, npv);
    const citl = kpi(m.container, "Calibration-in-the-large"), slope = kpi(m.container, "Calibration slope");
    c.check(citl && citl.value === "withheld" && slope && slope.value === "withheld", "/audit/M3/calibration-withheld", { csv }, "withheld below the reporting minimum", [citl, slope]);
    m.unmount();
  }

  // Uploaded population artifact: schema-checked before anything renders.
  {
    const fixture = await h.fixture("population-estimates.synthetic.json");
    const api = { current: null };
    const t = mountTab(masque, api);
    openReadiness(t.container);
    tabText(t.container, 1);
    const bad = clone(fixture);
    delete bad.estimates[0].suppress;
    bad.estimates[1].estimate = "0.12";
    await loadArtifact(t.container, "bad-artifact.json", JSON.stringify(bad));
    const danger = t.container.querySelector(".rrp-danger");
    const items = danger ? qa(danger, "li").map(textOf) : [];
    c.check(!!danger && /population-estimates file refused/.test(textOf(danger)) && !t.container.querySelector(".rrp .pa"), "/audit/upload/refused", null, "refused, nothing rendered", danger && textOf(danger));
    c.check(items.includes("$.estimates[0].suppress: required") && items.includes("$.estimates[1].estimate: expected number, got string"), "/audit/upload/errors-listed", null,
      ["$.estimates[0].suppress: required", "$.estimates[1].estimate: expected number, got string"], items);
    await loadArtifact(t.container, "good-artifact.json", JSON.stringify(fixture));
    c.check(!!t.container.querySelector(".rrp .pa") && !t.container.querySelector(".rrp-danger"), "/audit/upload/valid-rendered", null, "rendered", textOf(t.container.querySelector(".rrp")).slice(0, 200));
    t.unmount();
  }

  // PopulationArtifact: suppression rule, money(), Array guards, error boundary.
  {
    const PA = await load("src/PopulationArtifact.jsx");
    const fixture = await h.fixture("population-estimates.synthetic.json");
    const money = [[999.96e6, "$1.00 billion"], [999.94e6, "$999.9 million"], [1.5e9, "$1.50 billion"], [999999.6, "$1.0 million"], [12345, "$12,345"], [-999.96e6, "-$1.00 billion"]];
    for (const [v, want] of money) c.check(PA.money(v) === want, `/audit/money/${v}`, null, want, PA.money(v));
    const art = clone(fixture);
    const [tot, male, female] = art.estimates;
    tot.suppress = false; tot.ci = [0.1, 0.2]; tot.estimate = 0.15;
    delete male.suppress; male.estimate = 0.11; male.ci = [0.05, 0.2];
    female.suppress = false; female.estimate = 0.12; female.ci = [null, null];
    const m = h.mount(E(PA.default, { art }));
    const cells = qa(m.container, ".pa-table tbody tr").map((tr) => textOf(qa(tr, "td")[2]));
    c.check(cells.length === 2 && cells.every((x) => x === "suppressed"), "/audit/suppression/rows", null, ["suppressed", "suppressed"], cells);
    c.check(!/11\.0%|12\.0%/.test(textOf(m.container)), "/audit/suppression/no-value-printed", null, "no 11.0% / 12.0%", "printed");
    m.unmount();
    const s1 = clone(fixture); s1.estimates[0].suppress = "false"; s1.estimates[0].estimate = 0.15; s1.estimates[0].ci = [0.1, 0.2];
    const m1 = h.mount(E(PA.default, { art: s1 }));
    const k = textOf(m1.container.querySelector(".pa-kpi .pa-v"));
    c.check(k === "—", "/audit/suppression/string-flag", null, "—", k);
    m1.unmount();
    // Wrong shapes where lists belong: rendered without throwing.
    const odd = clone(fixture); odd.caveats = "one string"; odd.phenotype.unmapped = "x"; odd.phenotype.rule = { all: "a", any: null }; odd.estimates = { not: "a list" };
    let threw = null;
    try { const m2 = h.mount(E(PA.default, { art: odd })); m2.unmount(); } catch (err) { threw = String(err.message || err); }
    c.check(threw === null, "/audit/guards/no-throw", null, "rendered", threw);
    // Error boundary: an object where a count belongs throws inside the renderer; the boundary
    // reports it in place. React's development build reports the caught error to the console and
    // the window; both are absorbed for the duration of this one render, and only this one.
    const boom = clone(fixture); boom.estimates[1].unweightedN = { not: "a number" };
    const onErr = (e) => e.preventDefault();
    const realError = console.error;
    window.addEventListener("error", onErr);
    console.error = () => {};
    let mb = null;
    try { mb = h.mount(E(PA.default, { art: boom, onClear: () => {} })); }
    finally { console.error = realError; window.removeEventListener("error", onErr); }
    const fb = mb && mb.container.querySelector('[data-testid="pa-render-error"]');
    c.check(!!fb && /This artifact could not be rendered\./.test(textOf(fb)) && !!fb.querySelector(".pa-btn"), "/audit/boundary", null, "reported in place, with the clear button", mb && textOf(mb.container).slice(0, 200));
    if (mb) mb.unmount();
  }

  // The section tablist: roles, aria-controls, roving tabindex, arrow keys.
  {
    const t = mountTab(masque, { current: null });
    document.body.appendChild(t.container);
    try {
      const list = t.container.querySelector('[role="tablist"]');
      const tabs = qa(list, '[role="tab"]');
      const ok = tabs.length === 2 && tabs.every((b) => {
        const p = t.container.querySelector(`#${CSS.escape(b.getAttribute("aria-controls") || "")}`);
        return p && p.getAttribute("role") === "tabpanel" && p.getAttribute("aria-labelledby") === b.id;
      });
      c.check(ok, "/audit/tablist/controls", null, "each tab controls a tabpanel labelled by it", tabs.map((b) => [b.id, b.getAttribute("aria-controls")]));
      const state = () => tabs.map((b) => `${b.getAttribute("aria-selected")}/${b.tabIndex}`).join(",");
      c.check(state() === "true/0,false/-1", "/audit/tablist/roving-initial", null, "true/0,false/-1", state());
      const key = (k) => flushSync(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));
      tabs[0].focus();
      key("ArrowRight");
      c.check(state() === "false/-1,true/0" && document.activeElement === tabs[1] && !t.container.querySelector('[data-testid="research-readiness"]').hidden, "/audit/tablist/arrow-right", null, "readiness selected, focused, shown", state());
      key("ArrowRight");
      c.check(state() === "true/0,false/-1" && document.activeElement === tabs[0], "/audit/tablist/wraps", null, "population selected, focused", state());
      key("End");
      c.check(state() === "false/-1,true/0", "/audit/tablist/end", null, "false/-1,true/0", state());
      key("Home");
      c.check(state() === "true/0,false/-1", "/audit/tablist/home", null, "true/0,false/-1", state());
    } finally { t.container.remove(); t.unmount(); }
  }
}
