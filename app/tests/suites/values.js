// tests/suites/values.js — the MASQUE module's data vs the baseline constants (design 03 §8.3
// `values`, §3.6-§3.8). Owner: WP13; accepts WP1 (rubric), WP2 (logic) and WP6 (chrome split).
//
// Structural comparisons (deep-equal, key order where the order is the data):
//   instrument   domains/items vs Screener ITEMS (key, label, max, negative; id, w, text, scale,
//                ref, in order); items[].short vs Scribe shortLabel (n_allo absent); ask vs ASK;
//                tag vs VMPATHI_TAG; patientClin vs Patient ITEMS[].c; infoPrompts vs VMPATHI_INFO;
//                bands.cuts vs BAND_CUTS; instrumentVersion vs INSTRUMENT_VERSION
//   safety       redFlags vs Screener RED_FLAGS (+ Scribe `ask`); contextItems vs the Screener's
//                ContextQ rows (pinned slice) and the Scribe capLabel; steps.screener rail vs STEPS
//   phenotypes   values vs the Screener picker (pinned slice)
//   patient      locales.{en,es}.items vs P / ES_P (P key order = item order); redFlags vs the
//                Patient flags / ES_RF; contextItems vs CONTEXT_Q; step titles vs UI.sections;
//                ledes vs BLURB / BLURB_ES; PATIENT_CHROME ∪ locales.*.ui ∪ CAVEATS vs UI (§3.7)
//   logic        locales.*.sum vs SUM (strings and word maps deep-equal; template functions by
//                output over every reachable argument); probes.list vs ALL_PROBES (every
//                non-function field, in order); probes.version vs PROBE_SET_VERSION
//   lexicon      vs the Extraction constants (version, negation, thirdParty, historical, bool,
//                ctx, scale, multi, redFlags)
//   samples      sampleCases vs SAMPLE_CASES + the rail buttons (Scr L994-997) + the Simulator
//                SCENARIOS / FULL_HIGH; demo vs DEMO_PATIENT / Scribe PATIENT / SCRIPT
//   research     vs PROJECTS.MASQUE; demoCohorts vs COHORTS
//   identity     rendered fhir/cds identifiers and strings vs what the baseline builders print
//   calibration  calibrationGate(masque) === true; the stored scoringHash equals rubricHashes
// Provenance sweep: every other string in the rubric and every string datum of the logic must
// occur in the baseline sources (whitespace, JSX tags and `**` markup normalised; placeholders
// split out), except the hand-written fields WP1 done-when 6 lists. A string found nowhere is
// invented content and FAILS.
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { pointerToken } from "../harness/diff.js";

const LOCALES = ["en", "es"];
const UI_SECTION_KEYS = ["intro", "safety", "story", "migraine", "vestibular", "neuro", "impact", "discriminators", "summary"];

const proj = (obj, keys) => (obj && typeof obj === "object" ? Object.fromEntries(keys.map((k) => [k, obj[k]])) : obj);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** Baseline source text with JSX and JS-literal noise removed, for the provenance sweep. */
export function normaliseSource(text, { keepTags = false } = {}) {
  return text
    .replace(/(["'])\s*\+\s*\1/g, "")                // "abc " + "def" → abc def
    .replace(/\{"\s*"\}/g, " ")                        // {" "}
    .replace(keepTags ? /$^/ : /<\/?[A-Za-z][A-Za-z0-9.]*(\s[^<>]*?)?\/?>/g, " ") // JSX tags (attribute values kept with keepTags)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, " ")
    .replace(/\s+/g, " ");
}

/** The literal fragments of a module string (placeholders and `**` markup removed). */
export function fragments(s) {
  return s.replace(/\*\*/g, "").split(/\{[A-Za-z][A-Za-z0-9]*\}/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Every string leaf of a JSON-like value as [pointer, string]. Functions are skipped. */
function stringLeaves(x, path = "", out = []) {
  if (typeof x === "string") out.push([path, x]);
  else if (Array.isArray(x)) x.forEach((v, i) => stringLeaves(v, `${path}/${i}`, out));
  else if (isObj(x)) for (const k of Object.keys(x)) stringLeaves(x[k], `${path}/${pointerToken(k)}`, out);
  return out;
}

/**
 * Rubric paths whose values are hand-written by design (WP1 done-when 6; §3.8), so the
 * provenance sweep does not look for them in the baseline. Each entry is a RegExp over the
 * JSON pointer.
 */
const HAND_WRITTEN = [
  [/^\/logic\/(routing\/\d+\/id|phenotypes\/(derive\/\d+\/value|activation\/\d+\/(id|domains\/\d+))|patientSummary\/(said|ask)\/\d+\/id|patientSummary\/groups\/[^/]+\/\d+)$/, "logic rule ids and group members (§3.8)"],
  [/^\/rubric\/label$/, "the dropdown label (user requirement 2026-10-02)"],
  [/^\/rubric\/(id|name|icon|format)$/, "module identity"],
  [/^\/rubric\/logicBinding\//, "pairing"],
  [/^\/rubric\/changelog\//, "change-log notes"],
  [/^\/rubric\/research\/population\//, "population paths (Pop L31-33)"],
  [/^\/rubric\/research\/calibration\/appliesTo\//, "computed by the extractor with rubricHashes"],
  [/^\/rubric\/research\/(projectKey|scoreAliases\/\d+|artifactKey|etlScript|fairnessAxes\/\d+)$/, "research knobs (§3.8)"],
  [/^\/rubric\/lexicon\/goldSet\//, "gold-set reference"],
  [/^\/rubric\/lexicon\/lang$/, "BCP-47 tag (Voice L47)"],
  [/^\/rubric\/(fhir|cds)\/(questionnaireUrl|codeSystem|answerSystem|criteriaSystem|weightExtension|indexCode|screenIdPrefix|filePrefix|serviceId|safetyCardUuid|indexCardUuid)$/, "identity template"],
  [/^\/rubric\/cds\/source\/url$/, "identity template"],
  [/^\/rubric\/cds\/examples\/redFlagPresent\/flagId$/, "flag id"],
  [/^\/rubric\/sampleCases\/\d+\/(id|group|icon)$/, "sample ids, groups and lucide icon names"],
  [/^\/rubric\/steps\/(screener|patient)\/\d+\/(kind|extras\/\d+|requires|domainKeys\/\d+)$/, "step structure"],
  [/^\/rubric\/phenotypes\/(scribeDefault|tagBoostDomain|alwaysActive\/\d+)$/, "phenotype structure (ids)"],
  [/^\/rubric\/infoPrompts\/(gateDomain)$/, "domain key"],
  [/^\/rubric\/gapRule\//, "context ids"],
];

export default {
  name: "values",
  owner: "WP13",
  run: guarded("values", async (h) => {
    const { module, validation } = await loadMasque(h);
    const [gates, hash, policy, patient] = await Promise.all([h.engine("gates.js"), h.engine("hash.js"), h.engine("policy.js"), h.engine("patient.js")]);
    const [scr, scb, pat, sim, prb, ext, rrp] = await Promise.all([
      h.oracle("MASQUE_Screener_v0_3.jsx"), h.oracle("MASQUE_Scribe_v0_3.jsx"), h.oracle("MASQUE_Patient_v0_3.jsx"),
      h.oracle("MASQUE_Simulator.jsx"), h.oracle("MASQUE_Probes.js"), h.oracle("MASQUE_Extraction.js"),
      h.oracle("ResearchReadinessPanel.jsx"),
    ]);
    const c = collector(h);
    c.note(validationNote(validation));
    const R = module.rubric;
    need(R && Array.isArray(R.domains), "waits on WP1/WP3: module.rubric");
    const L = module.logic || {};
    const d = (a, b, at, opts = {}) => c.diff(a, b, { at, keyOrder: true, ...opts });

    // ------------------------------------------------------------------ instrument
    d(scr.DOMAIN_ORDER, R.domains.map((x) => x.key), "/domains/@order");
    const shortOf = (id) => { const s = scb.shortLabel({ id }); return s === id ? undefined : s; };
    const patientC = {};
    for (const k of pat.DOMAIN_ORDER) for (const it of pat.ITEMS[k].items) patientC[it.id] = it.c;
    for (const key of scr.DOMAIN_ORDER) {
      const base = scr.ITEMS[key];
      const mine = R.domains.find((x) => x.key === key);
      if (!c.check(!!mine, `/domains/${key}`, null, "present", "absent")) continue;
      const domainKeys = Object.keys(base).filter((k) => k !== "items");
      d(proj(base, domainKeys), proj(mine, domainKeys), `/domains/${key}`);
      c.check(mine.negative === base.negative, `/domains/${key}/negative`, null, base.negative, mine.negative);
      c.check(mine.items.length === base.items.length, `/domains/${key}/items/length`, null, base.items.length, mine.items.length);
      base.items.forEach((it, i) => {
        const m = mine.items[i] || {};
        const at = `/domains/${key}/items/${i}`;
        d(it, proj(m, Object.keys(it)), at);
        c.check(m.short === shortOf(it.id), `${at}/short`, { id: it.id }, shortOf(it.id) ?? "[absent]", m.short ?? "[absent]");
        c.check(m.ask === scb.ASK[it.id], `${at}/ask`, { id: it.id }, scb.ASK[it.id] ?? "[absent]", m.ask ?? "[absent]");
        c.check(m.tag === scb.VMPATHI_TAG[it.id], `${at}/tag`, { id: it.id }, scb.VMPATHI_TAG[it.id] ?? "[absent]", m.tag ?? "[absent]");
        c.check(m.patientClin === patientC[it.id], `${at}/patientClin`, { id: it.id }, patientC[it.id] ?? "[absent]", m.patientClin ?? "[absent]");
        // The Scribe's own copy of the item (w, scale, ref) must agree (its text is the Screener's, Inv §2).
        const sb = scb.ITEM_BY_ID[it.id];
        if (c.check(!!sb, `${at}/scribe`, { id: it.id }, "in the Scribe", "absent")) {
          d({ w: sb.w, scale: sb.scale, ref: sb.ref }, { w: m.w, scale: m.scale, ref: m.ref }, `${at}/@scribe`);
        }
      });
    }
    const shorts = R.domains.flatMap((x) => x.items).filter((it) => it.short !== undefined).length;
    c.check(shorts === 29, "/domains/*/items/*/short/@count", null, 29, shorts);
    d(scb.VMPATHI_INFO, (R.infoPrompts || {}).prompts, "/infoPrompts/prompts");
    for (const p of (R.infoPrompts || {}).prompts || []) c.check(p.tag.startsWith(R.infoPrompts.tagPrefix), `/infoPrompts/tagPrefix`, { id: p.id }, p.tag, R.infoPrompts.tagPrefix);
    d(scr.BAND_CUTS, R.bands && R.bands.cuts, "/bands/cuts");
    c.check(R.instrumentVersion === scr.INSTRUMENT_VERSION, "/instrumentVersion", null, scr.INSTRUMENT_VERSION, R.instrumentVersion);
    c.check(module.instrumentVersion === scr.INSTRUMENT_VERSION, "/module/instrumentVersion", null, scr.INSTRUMENT_VERSION, module.instrumentVersion);
    // The version axes stay distinct and each comes from its owner (CLAUDE.md, §4.13).
    const V = module.versions || {};
    d({ instrument: scr.INSTRUMENT_VERSION, lexicon: ext.LEXICON_VERSION, probeSet: prb.PROBE_SET_VERSION },
      { instrument: V.instrument, lexicon: V.lexicon, probeSet: V.probeSet }, "/module/versions");

    // ------------------------------------------------------------------ safety, context, steps
    const scbRf = Object.fromEntries(scb.RED_FLAGS.map((f) => [f.id, f]));
    d(scr.RED_FLAGS.map((f) => ({ ...f, ask: scbRf[f.id] && scbRf[f.id].ask })), R.redFlags, "/redFlags");
    d(scr.RF_GROUPS, module.redFlagGroups, "/module/redFlagGroups");
    const rows = (await h.slice("screener.contextRows")).fn();
    d(rows.map((r) => ({ id: r.id, text: r.t, options: r.opts })), (R.contextItems || []).map((ci) => ({ id: ci.id, text: ci.text, options: ci.options })), "/contextItems");
    for (const ci of R.contextItems || []) c.check(ci.captureLabel === scb.capLabel({ id: ci.id }), `/contextItems/${ci.id}/captureLabel`, null, scb.capLabel({ id: ci.id }), ci.captureLabel);
    d(scr.STEPS.map((s) => ({ key: s.key, rail: { eyebrow: s.eyebrow, title: s.title } })),
      ((R.steps || {}).screener || []).map((s) => ({ key: s.key, rail: s.rail })), "/steps/screener/@rail");
    d(pat.SECTIONS.slice(2, -1).map((s) => s.key), ((R.steps || {}).patient || []).map((s) => s.key), "/steps/patient/@keys");
    const picker = (await h.slice("screener.phenotypePicker")).fn();
    d(picker.map((o) => ({ value: o.k, h: o.h, d: o.d })), ((R.phenotypes || {}).values || []), "/phenotypes/values");

    // ------------------------------------------------------------------ patient wording
    const itemOrder = R.domains.flatMap((x) => x.items.map((it) => it.id));
    d(Object.keys(pat.P), itemOrder, "/@P-key-order");
    const loc = R.locales || {};
    d(pat.P, (loc.en || {}).items, "/locales/en/items");
    d(pat.ES_P, (loc.es || {}).items, "/locales/es/items");
    d(Object.fromEntries(pat.RED_FLAGS.map((f) => [f.id, { q: f.q, say: f.say }])), (loc.en || {}).redFlags, "/locales/en/redFlags");
    d(pat.ES_RF, (loc.es || {}).redFlags, "/locales/es/redFlags");
    d(Object.fromEntries(pat.CONTEXT_Q.map((q) => [q.id, { q: q.q, opts: q.opts }])), (loc.en || {}).contextItems, "/locales/en/contextItems");
    for (const l of LOCALES) {
      const ui = pat.UI[l];
      const steps = (loc[l] || {}).steps || {};
      const blurb = l === "es" ? pat.BLURB_ES : pat.BLURB;
      UI_SECTION_KEYS.forEach((key, i) => {
        if (["intro", "safety", "summary"].includes(key)) {
          const chrome = patient.PATIENT_CHROME[l] || {};
          c.check((chrome.sections || {})[key] === ui.sections[i], `/PATIENT_CHROME/${l}/sections/${key}`, null, ui.sections[i], (chrome.sections || {})[key]);
        } else {
          c.check((steps[key] || {}).title === ui.sections[i], `/locales/${l}/steps/${key}/title`, null, ui.sections[i], (steps[key] || {}).title);
        }
      });
      for (const key of Object.keys(blurb)) c.check((steps[key] || {}).lede === blurb[key], `/locales/${l}/steps/${key}/lede`, null, blurb[key], (steps[key] || {}).lede);
      c.check(((loc[l] || {}).ui || {}).sub === ui.sub, `/locales/${l}/ui/sub`, null, ui.sub, ((loc[l] || {}).ui || {}).sub);
      c.check((loc[l] || {}).reviewed === pat.REVIEWED[l], `/locales/${l}/reviewed`, null, pat.REVIEWED[l], (loc[l] || {}).reviewed);
      // §3.7: every other UI key is PATIENT_CHROME[loc], verbatim; the caveats are policy's.
      const chrome = patient.PATIENT_CHROME[l] || {};
      for (const [k, v] of Object.entries(ui)) {
        if (k === "sub" || k === "sections") continue;
        if (k === "reviewBanner") {
          const want = v || null;
          const got = l === "es" ? policy.CAVEATS.unreviewed.es.body : null;
          c.check(want === got, `/CAVEATS/unreviewed/${l}/body`, null, want, got);
          continue;
        }
        if (k === "txtUnreviewed") {
          const want = v || "";
          const got = l === "es" ? policy.CAVEATS.unreviewed.es.txt : "";
          c.check(want === got, `/CAVEATS/unreviewed/${l}/txt`, null, want, got);
          continue;
        }
        c.check(chrome[k] === v, `/PATIENT_CHROME/${l}/${k}`, null, v, chrome[k]);
      }
    }
    c.check(policy.LOCALE_NAMES && policy.LOCALE_NAMES.en === pat.LOCALE_NAMES.en && policy.LOCALE_NAMES.es === pat.LOCALE_NAMES.es, "/LOCALE_NAMES", null, pat.LOCALE_NAMES, policy.LOCALE_NAMES);

    // ------------------------------------------------------------------ logic: SUM
    const words = ["alpha", "beta", "gamma", "delta", "epsilon"];
    for (const l of LOCALES) {
      const base = pat.SUM[l];
      const mine = L.locales && L.locales[l] && L.locales[l].sum;
      if (!c.check(!!mine, `/logic/locales/${l}/sum`, null, "present", "absent")) continue;
      d(Object.keys(base), Object.keys(mine), `/logic/locales/${l}/sum/@keys`);
      const args = [[1], [2], [0], [3], ["0.2"], ...base.vertigoT.map((x) => [x]), ...base.daysT.map((x) => [x]), ...base.roleT.map((x) => [x]),
        ...[1, 2, 3, 4, 5].map((k) => [pat.list(words.slice(0, k), l)])];
      for (const [k, v] of Object.entries(base)) {
        const at = `/logic/locales/${l}/sum/${k}`;
        const m = mine[k];
        if (typeof v === "function") {
          if (!c.check(typeof m === "function", at, null, "function", typeof m)) continue;
          if (v.length === 3) {
            for (let mask = 0; mask < 8; mask++) {
              const bits = [!!(mask & 4), !!(mask & 2), !!(mask & 1)];
              d(v(...bits), m(...bits), `${at}(${bits.join(",")})`);
            }
          } else {
            for (const a of args) d(v(...a), m(...a), `${at}(${JSON.stringify(a[0])})`);
          }
        } else {
          d(v, m, at);
        }
      }
    }

    // ------------------------------------------------------------------ logic: probes
    const list = (L.probes && L.probes.list) || [];
    const dataOf = (p) => Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v !== "function"));
    d(prb.ALL_PROBES.map(dataOf), list.map(dataOf), "/logic/probes/list");
    c.check(L.probes && L.probes.version === prb.PROBE_SET_VERSION, "/logic/probes/version", null, prb.PROBE_SET_VERSION, L.probes && L.probes.version);
    c.check(L.moduleId === (R.logicBinding || {}).moduleId, "/logic/moduleId", null, (R.logicBinding || {}).moduleId, L.moduleId);

    // ------------------------------------------------------------------ lexicon
    const lex = R.lexicon || {};
    d({
      version: ext.LEXICON_VERSION, negation: ext.NEGATION, thirdParty: ext.THIRD_PARTY, historical: ext.HISTORICAL,
      bool: ext.BOOL_EX, ctx: ext.CTX_EX, scale: ext.SCALE_EX, multi: ext.MULTI_EX, redFlags: ext.RF_PHRASES,
    }, {
      version: lex.version, negation: lex.negation, thirdParty: lex.thirdParty, historical: lex.historical,
      bool: lex.bool, ctx: lex.ctx, scale: lex.scale, multi: lex.multi, redFlags: lex.redFlags,
    }, "/lexicon");

    // ------------------------------------------------------------------ samples and demo
    const scrText = await h.baselineText("MASQUE_Screener_v0_3.jsx");
    const buttons = {};
    for (const m of scrText.matchAll(/loadSample\("(\w+)"\)\}><(\w+) size=\{14\}\/> ([^<]+)<\/button>/g)) buttons[m[1]] = { icon: m[2], buttonLabel: m[3] };
    const want = Object.entries(scr.SAMPLE_CASES).map(([id, s]) => {
      const o = { id, label: s.label, buttonLabel: buttons[id] && buttons[id].buttonLabel, icon: buttons[id] && buttons[id].icon, complaint: s.complaint, ctx: s.ctx };
      if (s.rf) o.rf = s.rf;
      o.a = s.a;
      return o;
    });
    for (const s of sim.SCENARIOS) {
      const ap = s.apply();
      const o = { id: `sim-${s.id}`, label: s.label, group: "scenario", why: s.why, complaint: "", a: ap.answers };
      if (Object.keys(ap.rf || {}).length) o.rf = ap.rf;
      if (ap.safety !== true) o.safetyReviewed = !!ap.safety;
      want.push(o);
    }
    const cases = R.sampleCases || [];
    c.check(cases.length === want.length, "/sampleCases/length", null, want.length, cases.length);
    for (const w of want) {
      const m = cases.find((x) => x.id === w.id);
      if (!c.check(!!m, `/sampleCases/${w.id}`, null, "present", "absent")) continue;
      d(w, proj(m, Object.keys(w)), `/sampleCases/${w.id}`, { keyOrder: false });
      if (m.rf && !w.rf) c.check(Object.keys(m.rf).length === 0, `/sampleCases/${w.id}/rf`, null, "none", m.rf);
      if (w.group === "scenario") c.check(typeof m.buttonLabel === "string" && m.buttonLabel.length > 0, `/sampleCases/${w.id}/buttonLabel`, null, "non-empty", m.buttonLabel);
    }
    d(sim.FULL_HIGH, (cases.find((x) => x.id === "sim-high") || {}).a, "/sampleCases/sim-high/a/@FULL_HIGH");
    d(scr.DEMO_PATIENT, (R.demo || {}).patient, "/demo/patient");
    d(scb.PATIENT, (R.demo || {}).patient, "/demo/patient/@scribe");
    d(scb.SCRIPT, (R.demo || {}).transcript, "/demo/transcript");

    // ------------------------------------------------------------------ research
    const P = rrp.PROJECTS.MASQUE;
    const res = R.research || {};
    d(P, proj({ ...res, calibration: res.calibration && { midpoint: res.calibration.midpoint, slope: res.calibration.slope } }, Object.keys(P)), "/research");
    d(sim.COHORTS, (res.demoCohorts || []).map((x) => proj(x, ["id", "label", "why"])), "/research/demoCohorts");
    c.check(res.projectKey === "MASQUE" && Object.prototype.hasOwnProperty.call(rrp.PROJECTS, res.projectKey), "/research/projectKey", null, "MASQUE (a PROJECTS key)", res.projectKey);

    // ------------------------------------------------------------------ identity
    const q = h.withFixedClock("2026-10-01T12:00:00.000Z", () => scr.buildQuestionnaire());
    const cds = scr.buildCdsHooks();
    const svc = cds.discovery.services[0];
    const ex = cds.exampleResponses;
    const firstRef = scr.DOMAIN_ORDER.flatMap((k) => scr.ITEMS[k].items).find((it) => it.ref);
    const refItem = q.item.flatMap((g) => g.item || []).find((it) => it.linkId === firstRef.id);
    const prior = /code=([^&|]+)\|([^&]+)&/.exec(svc.prefetch.priorScreens);
    const row = h.withSeededRandom(1, () => scr.screenToCohortRow({ patient: scr.DEMO_PATIENT, answers: {}, total: 0, coverage: 0, scorable: false, band: "indeterminate", activeFlags: [], complaint: "" }));
    const bundle = h.withFixedClock("2026-10-01T12:00:00.000Z", () => scb.buildBundle({ patient: scb.PATIENT, answers: {}, total: 0, floor: 0, ceiling: 0, coverage: 0, scorable: false, band: "indeterminate", domains: scb.computeScore({}).domains, complaint: "", note: "", activeFlags: [] }));
    const obs = bundle.entry.find((e) => e.resource.resourceType === "Observation").resource;
    const doc = bundle.entry.find((e) => e.resource.resourceType === "DocumentReference").resource;
    const flagForDetail = scr.RED_FLAGS.find((f) => ex.redFlagPresent.cards[0].detail.startsWith(`${f.action}. `));
    const settled = ex.settledNonLowBand.cards[0];
    const settledScore = Number((/ (\d+)\/100 /.exec(settled.summary) || [])[1]);
    const F = module.fhir || {}, C = module.cds || {};
    d({
      questionnaireUrl: scr.QUESTIONNAIRE_URL, questionnaireName: q.name, questionnaireTitle: q.title, publisher: q.publisher,
      description: q.description, safetyGroupText: q.item[0].text, codeSystem: q.item[0].item[0].code[0].system,
      answerSystem: scr.ANSWER_SYSTEM, criteriaSystem: refItem && refItem.code[0].system, weightExtension: scr.WEIGHT_EXT,
      indexCode: prior && prior[2], indexDisplay: obs.code.coding[0].display, documentType: doc.type.text,
      documentTitle: doc.content[0].attachment.title, screenIdPrefix: (/^(.*-)[0-9a-z]+-[0-9a-z]*$/.exec(row.screen_id) || [])[1],
      filePrefix: (/downloadText\(`([a-z0-9-]+)-pilot-cohort-/.exec(scrText) || [])[1],
    }, proj(F, ["questionnaireUrl", "questionnaireName", "questionnaireTitle", "publisher", "description", "safetyGroupText", "codeSystem",
      "answerSystem", "criteriaSystem", "weightExtension", "indexCode", "indexDisplay", "documentType", "documentTitle", "screenIdPrefix", "filePrefix"]), "/fhir");
    c.check(prior && prior[1] === F.codeSystem, "/fhir/codeSystem/@prefetch", null, prior && prior[1], F.codeSystem);
    d({
      serviceId: svc.id, hook: svc.hook, title: svc.title, description: svc.description, source: ex.redFlagPresent.cards[0].source,
      safetyCardUuid: ex.redFlagPresent.cards[0].uuid, indexCardUuid: settled.uuid,
      examples: {
        redFlagPresent: { flagId: flagForDetail && flagForDetail.id, summary: ex.redFlagPresent.cards[0].summary },
        settled: { score: settledScore, band: scr.bandFor(settledScore), summary: settled.summary, detail: settled.detail },
      },
    }, proj(C, ["serviceId", "hook", "title", "description", "source", "safetyCardUuid", "indexCardUuid", "examples"]), "/cds");
    d(settled.source, C.source, "/cds/source/@settled");

    // ------------------------------------------------------------------ calibration
    c.check(gates.calibrationGate(module) === true, "/calibrationGate", null, true, gates.calibrationGate(module));
    const hs = await hash.rubricHashes(R);
    c.check(hs.scoringHash === (res.calibration && res.calibration.appliesTo && res.calibration.appliesTo.scoringHash), "/research/calibration/appliesTo/scoringHash",
      null, hs.scoringHash, res.calibration && res.calibration.appliesTo && res.calibration.appliesTo.scoringHash);
    c.check(module.hashes && module.hashes.scoringHash === hs.scoringHash, "/module/hashes/scoringHash", null, hs.scoringHash, module.hashes && module.hashes.scoringHash);

    // ------------------------------------------------------------------ provenance sweep
    const corpus = [];
    for (const f of ["MASQUE_Screener_v0_3.jsx", "MASQUE_Scribe_v0_3.jsx", "MASQUE_Patient_v0_3.jsx", "MASQUE_Simulator.jsx",
      "MASQUE_Extraction.js", "MASQUE_Probes.js", "ResearchReadinessPanel.jsx", "MASQUE_Voice.js", "MASQUE_Population.jsx"]) {
      const text = await h.baselineText(f);
      corpus.push(normaliseSource(text), normaliseSource(text, { keepTags: true }));
    }
    const all = corpus.join("\n");
    const missing = [];
    let swept = 0;
    const sweep = (root, value) => {
      for (const [path, s] of stringLeaves(value)) {
        const full = root + path;
        if (HAND_WRITTEN.some(([re]) => re.test(full))) continue;
        swept++;
        for (const frag of fragments(s)) {
          if (!all.includes(frag)) { missing.push({ path: full, text: s, fragment: frag }); break; }
        }
      }
    };
    sweep("/rubric", R);
    const logicData = {};
    for (const k of Object.keys(L)) if (!["locales", "probes", "reads", "format", "contractVersion", "moduleId", "logicVersion"].includes(k)) logicData[k] = L[k];
    sweep("/logic", logicData);
    for (const m of missing) c.check(false, `/@provenance${m.path}`, { text: m.text }, "a string moved from the baseline", `not found in the baseline: "${m.fragment}"`);
    c.n += swept;
    c.note(`provenance sweep: ${swept} rubric/logic strings checked against the baseline sources; ${missing.length} not found`);
    return c.result();
  }),
};
