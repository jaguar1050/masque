// apps/Screener.jsx — the generic Clinician Screener (design 03 §5.3, §5.9, §5.10). Owner: WP7.
//
// The baseline Screener component (Scr L824-1444) driven by a bound module instead of module
// constants. The DOM structure and class names are the baseline's; the CSS string is moved
// unedited (Scr L629-810) and scoped at runtime under `.sa-screener` (§5.10). Every clinical
// string comes from the module (items, flags, steps, copy slots, sample cases); the
// safety-critical sentences come from the engine (rules.js: override, incomplete, rule-error
// and CDS safety cards) or are kept here verbatim from the baseline with the module supplying
// only noun-phrase slots ({indexName}). The arithmetic is engine scoring.js; the gates are
// engine-owned: an open red flag withholds routing, an unsettled index issues no band, and a
// module rule that throws withholds routing, the referral and the CDS index card (D6).
//
// What changed from the baseline, and nothing else:
//   - the research-readiness panel is replaced by a link card to the Research tab (AD8);
//   - the sample rail carries the module's samples and scenarios (AD11, SampleRail.jsx);
//   - meter zones are derived from the cut-points (AD7); the release is the shell's (AD4);
//   - the tab note, and the provenance badge above the index for a non-built-in (§5.3);
//   - the screen is published to the session store and captured rows are reported (§5.3).
// It never computes or shows a probability, and never shows a band while the index is
// unsettled (coverageGate).
//
// No module literal. No side effects at import time.

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowRight, ArrowLeft, RotateCcw, ShieldCheck, TriangleAlert, ChevronDown, Copy, Check, Send, User, FileJson,
  Info, Plus, Download, Activity, FlaskConical,
} from "lucide-react";
import { computeScore, meterTicks, meterZones } from "../engine/scoring.js";
import { TIER_RANK } from "../engine/vocab.js";
import { safetyGate } from "../engine/gates.js";
import { activeFlagsOf, buildRoutingState, cdsPreview, gapSignals, routingRecs } from "../engine/rules.js";
import { buildBundle, buildCdsHooks, buildDataDictionary, buildQuestionnaire } from "../engine/fhir.js";
import { rowsToCsv, screenToCohortRow } from "../engine/cohort.js";
import { downloadJsonFile, downloadText, fhirHtml } from "../engine/download.js";
import { scopeCss } from "../engine/css.js";
import { APP_VERSION, SITE } from "../engine/policy.js";
import { richText } from "../engine/patient.js";
import { ProvenanceBadge, TabNote } from "../ui/common.jsx";
import SampleRail, { SAMPLE_ICONS } from "./SampleRail.jsx";

// ----------------------------------------------------------------------------- styles

// Scr L629-810, moved unedited; scoped below.
const SCREENER_CSS = `
:root{
  --ink:#0C2B2F; --petrol:#0F5C61; --petrol2:#137A80; --surface:#EDF3F1;
  --panel:#FFFFFF; --line:#D7E1DF; --muted:#5C6E6C;
  --amber:#B26C1F; --amberbg:#F6ECD9; --coral:#B84A33; --coralbg:#F6E1DA;
  --green:#2C7A57; --greenbg:#E0EEE7; --slate:#4F6466;
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
.mq{font-family:var(--sans);color:var(--ink);background:var(--surface);
  min-height:100%;line-height:1.45;-webkit-font-smoothing:antialiased}
.mq-wrap{max-width:960px;margin:0 auto;padding:18px 18px 60px}
.mq h1,.mq h2,.mq h3{margin:0;font-weight:650;letter-spacing:-.01em}
.mq p{margin:0}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}

/* banner */
.banner{background:var(--ink);color:#EAF3F1;border-radius:14px;padding:14px 16px;
  display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.banner .who{display:flex;align-items:center;gap:11px;min-width:0}
.avatar{width:38px;height:38px;border-radius:10px;background:var(--petrol2);
  display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.banner .meta{font-size:12px;color:#9FC1BE;letter-spacing:.02em}
.banner .name{font-size:16px;font-weight:650}
.badge{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;
  padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.28);color:#Bfe0dc;white-space:nowrap}
.spacer{flex:1 1 auto}
.gbtn{font:inherit;font-size:12.5px;cursor:pointer;border-radius:9px;padding:7px 11px;
  border:1px solid rgba(255,255,255,.28);background:transparent;color:#EAF3F1;display:inline-flex;
  align-items:center;gap:6px}
.gbtn:hover{background:rgba(255,255,255,.08)}

/* header row */
.brandrow{display:flex;align-items:center;gap:12px;margin:20px 2px 6px}
.mark{width:34px;height:34px;border-radius:9px;background:var(--petrol);color:#fff;
  display:flex;align-items:center;justify-content:center}
.brandrow .t1{font-size:19px;font-weight:700;letter-spacing:-.02em}
.brandrow .t2{font-size:12.5px;color:var(--muted)}

/* progress */
.rail{display:flex;gap:6px;margin:14px 2px 20px;flex-wrap:wrap}
.rail .seg{flex:1 1 120px;min-width:96px}
.rail .lab{font-family:var(--mono);font-size:10.5px;color:var(--muted);letter-spacing:.04em;
  display:flex;gap:6px;align-items:center;margin-bottom:5px}
.rail .bar{height:4px;border-radius:3px;background:var(--line)}
.rail .bar.on{background:var(--petrol)}
.rail .bar.cur{background:var(--petrol2)}
.rail .seg.cur .lab{color:var(--ink);font-weight:650}

/* card + questions */
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px}
.card + .card{margin-top:14px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--petrol);font-weight:600}
.steptitle{font-size:20px;margin:4px 0 2px}
.stepsub{font-size:13px;color:var(--muted);margin-bottom:6px}
.q{padding:15px 0;border-top:1px solid var(--line)}
.q:first-of-type{border-top:0}
.q .qtext{font-size:14.5px;margin-bottom:10px;font-weight:520}
.opts{display:flex;gap:7px;flex-wrap:wrap}
.opt{font:inherit;font-size:13px;cursor:pointer;border:1px solid var(--line);background:#fff;
  color:var(--ink);border-radius:9px;padding:8px 14px;min-width:58px;text-align:center;transition:.12s}
.opt:hover{border-color:var(--petrol2)}
.opt.sel{background:var(--petrol);border-color:var(--petrol);color:#fff;font-weight:600}
.opt.selno{background:var(--slate);border-color:var(--slate);color:#fff}

/* segmented single-select big */
.pick{display:flex;gap:8px;flex-wrap:wrap}
.pick .p{flex:1 1 150px;border:1px solid var(--line);border-radius:11px;padding:13px 14px;cursor:pointer;background:#fff;transition:.12s}
.pick .p:hover{border-color:var(--petrol2)}
.pick .p.sel{border-color:var(--petrol);background:#F1F7F5;box-shadow:inset 0 0 0 1px var(--petrol)}
.pick .p .ph{font-weight:640;font-size:14px;margin-bottom:2px}
.pick .p .pd{font-size:12px;color:var(--muted)}

/* footer nav */
.nav{display:flex;gap:10px;align-items:center;margin-top:18px}
.btn{font:inherit;font-size:14px;font-weight:600;cursor:pointer;border-radius:10px;padding:11px 18px;
  border:1px solid var(--petrol);background:var(--petrol);color:#fff;display:inline-flex;align-items:center;gap:8px}
.btn:hover{background:var(--petrol2);border-color:var(--petrol2)}
.btn.ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.btn.ghost:hover{border-color:var(--petrol2);background:#fff}
.btn:disabled{opacity:.45;cursor:not-allowed}

/* result readout */
.readout{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end}
.score{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:600;
  font-size:74px;line-height:.9;letter-spacing:-.03em}
.scorecap{font-family:var(--mono);font-size:12px;color:var(--muted);letter-spacing:.06em;margin-bottom:8px}
.pill{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:650;
  padding:7px 13px;border-radius:999px}
.meter{margin:20px 0 6px;position:relative;height:14px;border-radius:8px;overflow:hidden;display:flex}
.meter .z{height:100%}
.meterticks{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10.5px;color:var(--muted);margin-top:6px}
.needle{position:absolute;top:-5px;width:3px;height:24px;background:var(--ink);border-radius:2px;transform:translateX(-1.5px);transition:left .5s cubic-bezier(.2,.7,.2,1)}
.rangeband{position:absolute;top:0;height:100%;border-left:2px solid var(--ink);border-right:2px solid var(--ink);
  background:repeating-linear-gradient(135deg,rgba(12,43,47,.30) 0 4px,rgba(12,43,47,.10) 4px 9px);transition:left .5s ease,width .5s ease}
.scorerange{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:600;
  font-size:50px;line-height:.95;letter-spacing:-.03em}
.scorerange .sep{font-size:32px;color:var(--muted);padding:0 4px}
.openlist{margin-top:14px;border:1px dashed var(--line);border-radius:11px;padding:13px 15px;background:#FAFCFB}
.openlist .oh{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:9px}
.openlist .oi{display:flex;gap:10px;align-items:baseline;font-size:12.5px;padding:3px 0;color:#33474A}
.openlist .ow{font-family:var(--mono);font-size:11px;color:var(--petrol);font-weight:650;flex:0 0 auto}
.openlist .om{font-size:11.5px;color:var(--muted);margin-top:8px}

/* domain bars */
.dbar{display:grid;grid-template-columns:150px 1fr 62px;gap:12px;align-items:center;padding:8px 0}
.dbar .dl{font-size:13px}
.dtrack{height:9px;border-radius:6px;background:var(--line);overflow:hidden}
.dfill{height:100%;border-radius:6px;background:var(--petrol2);transition:width .5s ease}
.dpts{font-family:var(--mono);font-size:12px;text-align:right;color:var(--muted)}

/* rec cards */
.rec{border-left:3px solid var(--petrol);background:#F4F8F7;border-radius:0 11px 11px 0;padding:13px 15px;margin-top:10px}
.rec h4{font-size:13.5px;margin:0 0 4px}
.rec p{font-size:13px;color:#33474A}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
.chip{font-family:var(--mono);font-size:11px;border:1px solid var(--line);background:#fff;border-radius:7px;padding:4px 8px;color:var(--slate)}

.alert{display:flex;gap:12px;background:var(--amberbg);border:1px solid #E4C88E;border-radius:12px;padding:14px 15px;margin-top:6px}
.alert .at{font-size:13.5px;font-weight:660;color:#7A4E12;margin-bottom:2px}
.alert .ap{font-size:12.5px;color:#6B4A18}

/* safety gate + red-flag override */
.rf{border:1px solid var(--line);border-radius:11px;padding:12px 14px;margin-top:8px;background:#fff;display:flex;gap:11px;
  align-items:flex-start;cursor:pointer;transition:.12s}
.rf:hover{border-color:#C98476}
.rf.on{border-color:var(--coral);background:#FDF4F1;box-shadow:inset 0 0 0 1px var(--coral)}
.rf .box{width:19px;height:19px;border-radius:5px;border:1.5px solid #B7C4C2;flex:0 0 auto;margin-top:1px;
  display:flex;align-items:center;justify-content:center;background:#fff}
.rf.on .box{background:var(--coral);border-color:var(--coral);color:#fff}
.rf .rt{font-size:13.5px;font-weight:520;line-height:1.35}
.rf .rm{font-size:11.5px;color:var(--muted);margin-top:4px}
.rf .tier{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;
  border-radius:5px;padding:2px 6px;margin-left:7px;vertical-align:1px}
.tier.emergent{background:var(--coralbg);color:#8E3520}
.tier.urgent{background:var(--amberbg);color:#7A4E12}
.rfgroup{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);margin:18px 0 2px}
.override{border:1.5px solid var(--coral);background:var(--coralbg);border-radius:13px;padding:16px 17px;margin-bottom:18px}
.override .ot{font-size:15px;font-weight:700;color:#8E3520;display:flex;gap:9px;align-items:center}
.override .os{font-size:12.5px;color:#6E3020;margin-top:5px}
.override .oitem{background:#fff;border-radius:9px;padding:10px 12px;margin-top:9px;font-size:12.5px}
.override .oitem b{display:block;font-size:13px;margin-bottom:3px}
.override .oact{color:#8E3520;font-weight:600}
.capture{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-top:16px;padding:14px 15px;
  border:1px dashed var(--line);border-radius:12px;background:#FAFCFB}
.capture .ct{font-size:13px;font-weight:660;margin-bottom:3px}
.capture .cp{font-size:12px;color:var(--muted);max-width:52ch;line-height:1.45}
.safetybar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}
.safetybar .sm{font-size:12.5px;color:var(--muted);flex:1 1 200px}

/* fhir */
.code{font-family:var(--mono);font-size:11.5px;line-height:1.5;background:#0C2B2F;color:#CFE6E2;
  border-radius:11px;padding:15px;overflow:auto;max-height:340px;white-space:pre;margin-top:10px}
.code .k{color:#8FD3CC}.code .s{color:#E7C08A}.code .n{color:#F0A992}

.cds{border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:0 11px 11px 0;background:#fff;padding:13px 15px;margin-top:10px}
.cds .src{font-family:var(--mono);font-size:10.5px;color:var(--muted);letter-spacing:.05em;text-transform:uppercase}

.note{font-size:12px;color:var(--muted);display:flex;gap:8px;margin-top:14px;align-items:flex-start}
.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--ink);color:#EAF3F1;
  padding:11px 18px;border-radius:11px;font-size:13.5px;display:flex;gap:9px;align-items:center;z-index:40;
  box-shadow:0 8px 30px rgba(0,0,0,.22)}
.disc{background:#fff;border:1px dashed var(--line);border-radius:11px;padding:12px 14px;font-size:12px;color:var(--muted);margin-top:14px}
.foot{font-family:var(--mono);font-size:10.5px;color:var(--muted);letter-spacing:.04em;text-align:center;margin-top:26px}
.about summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--petrol);display:flex;gap:7px;align-items:center;list-style:none}
.about summary::-webkit-details-marker{display:none}
.about[open] .chev{transform:rotate(180deg)}
.chev{transition:.2s}
.abgrid{font-size:12.5px;color:#33474A;margin-top:10px;display:grid;gap:8px}

:focus-visible{outline:2px solid var(--petrol2);outline-offset:2px;border-radius:6px}
@media (max-width:640px){
  .score{font-size:58px}
  .scorerange{font-size:38px}
  .scorerange .sep{font-size:25px}
  .dbar{grid-template-columns:110px 1fr 52px;gap:9px}
  .readout{gap:14px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

// New chrome of this app only (the link card that replaces the panel, AD8). Engine chrome.
const LINK_CSS = `
.sa-scr-link{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:22px;padding:14px 15px;
  border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.sa-scr-link .sa-scr-link-t{flex:1 1 280px;font-size:13px;color:#33474A;line-height:1.45}
.sa-scr-link svg{flex:0 0 auto}
`;

const ROOT = ".sa-screener";
const CSS = scopeCss(SCREENER_CSS, ROOT) + scopeCss(LINK_CSS, ROOT);

// Band presentation (Scr L865-870): engine chrome, the same for every module.
const BAND_META = {
  low:      { c: "var(--green)",  bg: "var(--greenbg)",  label: "Low likelihood" },
  moderate: { c: "var(--amber)",  bg: "var(--amberbg)",  label: "Moderate likelihood" },
  high:     { c: "var(--coral)",  bg: "var(--coralbg)",  label: "High likelihood" },
  indeterminate: { c: "var(--slate)", bg: "#E3EAE9", label: "Not scorable — screen incomplete" },
};
const ZONE_COLOR = { low: "var(--green)", moderate: "var(--amber)", high: "var(--coral)" };

/** A position on the 0…scaleMax index as a CSS percentage (exact for scaleMax 100). */
const pctOf = (v, scaleMax) => (v * 100) / scaleMax;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The one-line dirty summary of §5.1 ("12 answers, 2 captured rows"), or null. */
export function screenerDirtySummary({ answers, ctx, rf, complaint, safetyReviewed, cohort }) {
  const nAnswers = Object.values(answers || {}).filter(v => v !== undefined).length;
  const touched = nAnswers > 0
    || Object.values(ctx || {}).some(v => v !== undefined)
    || Object.values(rf || {}).some(Boolean)
    || !!complaint || !!safetyReviewed || (cohort || []).length > 0;
  if (!touched) return null;
  const parts = [];
  if (nAnswers) parts.push(plural(nAnswers, "answer", "answers"));
  if ((cohort || []).length) parts.push(plural(cohort.length, "captured row", "captured rows"));
  return parts.length ? parts.join(", ") : "screen in progress";
}

/** Text with `**bold**` runs (the only markup module data carries, §3.6). */
function Rich({ text }) {
  return richText(text).map((part, i) => (typeof part === "string" ? part : <b key={i}>{part.b}</b>));
}

// ----------------------------------------------------------------------------- component

/**
 * @param {{module: Object, appVersion?: string, site?: Object,
 *          onScreen?: function(Object): void, onCapture?: function({source: string, row: Object}): void,
 *          onDirty?: function(string, (string|null)): void, onModuleError?: function(Object): void,
 *          onOpenTab?: function(string): void}} props
 */
export default function Screener({
  module, appVersion = APP_VERSION, site = SITE, onScreen, onCapture, onDirty, onModuleError, onOpenTab,
}) {
  const steps = module.steps.screener;
  const LAST_STEP = steps.length - 1;
  const copy = module.copy;

  const [step, setStep] = useState(0);
  const [cohort, setCohort] = useState([]);              // captured screens (pilot loop)
  const [rf, setRf] = useState({});                      // red-flag checkboxes
  const [safetyReviewed, setSafetyReviewed] = useState(false);
  const [patient, setPatient] = useState(module.demo.patient);
  const [complaint, setComplaint] = useState("");        // a phenotype value, "" = none
  const [answers, setAnswers] = useState({});
  const [ctx, setCtx] = useState({});                    // context items (unscored)
  const [showJson, setShowJson] = useState(false);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  const score = useMemo(() => computeScore(module, answers), [module, answers]);
  const { domains, total, floor, ceiling, coverage, scorable, band, open } = score;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const set = (id, v) => setAnswers(a => ({ ...a, [id]: a[id] === v ? undefined : v }));
  const setC = (id, v) => setCtx(c => ({ ...c, [id]: c[id] === v ? undefined : v }));

  function loadSample(s) {
    setComplaint(s.complaint ?? "");
    setAnswers({ ...s.a });
    setCtx({ ...(s.ctx || {}) });
    setPatient(module.demo.patient);
    setRf({ ...(s.rf || {}) });
    setSafetyReviewed(s.safetyReviewed ?? true);   // sample cases carry an explicit safety review
    setStep(LAST_STEP);
    setToast("Sample case loaded");
  }
  function reset() {
    setAnswers({}); setCtx({}); setComplaint(""); setStep(0); setShowJson(false);
    setRf({}); setSafetyReviewed(false);
    setToast("Screen cleared");
  }

  const bandMeta = BAND_META[band];

  // gap alert: the module's context markers of a probable missed diagnosis
  const gap = useMemo(() => gapSignals(module, ctx), [module, ctx]);
  const gapFlags = gap.hits.map(x => x.screenerLabel);
  const gapAlert = gap.alert;

  const activeFlags = useMemo(() => activeFlagsOf(module, rf), [module, rf]);
  const override = activeFlags.length > 0;
  const emergent = activeFlags.some(f => TIER_RANK[f.tier] === 0);
  // The safety step must be dealt with explicitly — either a flag is checked, or the
  // clinician actively records that none apply.
  const safetyDone = safetyGate({ safetyReviewed, activeFlags });
  const stepDef = steps[step];
  const canContinue = stepDef.kind === "safety" ? safetyDone : stepDef.requires === "complaint" ? !!complaint : true;

  // The Screener routes once its safety step has been passed, so the state is built with the
  // review recorded; an open red flag still withholds everything (engine gate order).
  const routingState = useMemo(() => buildRoutingState(module, {
    surface: "screener", answers, ctx, complaint, score, activeFlags, safetyReviewed: true,
  }), [module, answers, ctx, complaint, score, activeFlags]);
  const routing = useMemo(() => routingRecs(module, routingState), [module, routingState]);
  const recs = routing.recs;
  const routingError = routing.error;
  const preview = useMemo(
    () => cdsPreview(module, routingState, { routingError, bandLabel: bandMeta.label }),
    [module, routingState, routingError, bandMeta.label],
  );

  // FHIR write-back bundle (illustrative)
  const bundle = useMemo(
    () => buildBundle(module, { patient, answers, score, complaint, activeFlags, emergent, routingError }, { surface: "screener" }),
    [module, patient, answers, score, complaint, activeFlags, emergent, routingError],
  );

  // The host's callbacks, read through a ref: the effects below run on data changes only, so a
  // host that passes new function identities on every render never causes a publish loop.
  const hostRef = useRef({});
  hostRef.current = { onScreen, onCapture, onDirty, onModuleError, onOpenTab };
  const callHost = (name, ...args) => {
    const fn = hostRef.current[name];
    if (typeof fn === "function") fn(...args);
  };

  // A failed module rule is reported once per distinct failure (the shell's error strip).
  const reportedError = useRef("");
  useEffect(() => {
    const key = routingError ? `${routingError.family}|${routingError.ruleId}|${routingError.message}` : "";
    if (key && key !== reportedError.current) callHost("onModuleError", routingError);
    reportedError.current = key;
  }, [routingError]); // eslint-disable-line react-hooks/exhaustive-deps

  // The latest screen goes to the session store (§5.3); never persisted (D20). Nothing is
  // published until the screen is touched; once published, a cleared screen replaces it.
  const published = useRef(false);
  const dirty = screenerDirtySummary({ answers, ctx, rf, complaint, safetyReviewed, cohort });
  useEffect(() => {
    if (!dirty && !published.current) return;
    published.current = true;
    callHost("onScreen", {
      source: "screener",
      at: new Date().toISOString(),
      moduleKey: module.key ?? null,
      score: total, floor, ceiling, scorable, band, domains, coverage,
      sex: patient.sex ?? null,
      gender: patient.gender ?? null,
      phenotype: complaint,
      redFlags: activeFlags.map(f => f.points),
      safetyReviewed,
      // false before the safety step is done, and while any red flag is open (§5.3)
      routingCleared: safetyDone && !override && !!safetyReviewed,
      answers, ctx,
    });
    // `dirty` changes with the cohort only, which the snapshot does not carry.
  }, [module, answers, ctx, score, complaint, activeFlags, safetyReviewed, patient]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    callHost("onDirty", "screener", dirty);
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  function captureScreen() {
    const row = screenToCohortRow(module, { patient, answers, ctx, score, activeFlags, complaint },
      { appVersion, salt: site.SITE_SALT });
    setCohort(c => [...c, row]);
    callHost("onCapture", { source: "screener", row });
    setToast(`Screen appended — ${cohort.length + 1} in session cohort`);
  }
  function downloadCohort() {
    downloadText(`${module.fhir.filePrefix}-pilot-cohort-${new Date().toISOString().slice(0,10)}.csv`, rowsToCsv(cohort), "text/csv");
  }

  async function copyBundle() {
    try { await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2)); }
    catch (_) {}
    setCopied(true); setToast("FHIR bundle copied");
    setTimeout(() => setCopied(false), 1600);
  }

  const BrandIcon = SAMPLE_ICONS[module.icon] || (module.icon ? Info : SAMPLE_ICONS.Stethoscope);

  return (
    <div className="sa-app sa-screener" data-module={module.id}>
      <style>{CSS}</style>
      <div className="mq">
      <div className="mq-wrap">

        <TabNote kind="clinician" />

        {/* patient banner — SMART on FHIR launch context */}
        <div className="banner" data-testid="scr-banner">
          <div className="who">
            <div className="avatar"><User size={19} color="#EAF3F1" /></div>
            <div>
              <div className="name">{patient.family}, {patient.given}</div>
              <div className="meta num">
                {patient.age ?? "—"} yr · {patient.sex ?? "—"} · {patient.mrn}{patient.synthetic && " · synthetic sandbox record"}
              </div>
            </div>
          </div>
          <div className="spacer" />
          <span className="badge">SMART on FHIR · sandbox</span>
          <SampleRail module={module} onLoad={loadSample} />
          <button className="gbtn" data-testid="scr-clear" onClick={reset}><RotateCcw size={14}/> Clear</button>
        </div>

        {/* brand */}
        <div className="brandrow" data-testid="scr-brand">
          <div className="mark"><BrandIcon size={19} /></div>
          <div>
            <div className="t1">{copy.screener.title} <span className="num" style={{fontSize:12,color:"var(--muted)",fontWeight:400}}>v{appVersion}</span></div>
            <div className="t2">{copy.screener.subtitle}</div>
          </div>
        </div>

        {/* progress rail */}
        <div className="rail" data-testid="scr-rail">
          {steps.map((s, i) => (
            <div className={"seg" + (i === step ? " cur" : "")} key={s.key}>
              <div className="lab"><span>{s.rail.eyebrow}</span>{s.rail.title}</div>
              <div className={"bar" + (i < step ? " on" : i === step ? " cur" : "")} />
            </div>
          ))}
        </div>

        {/* step body */}
        {stepDef.kind === "safety" && (
          <SafetyCard module={module} stepDef={stepDef} rf={rf} setRf={setRf} activeFlags={activeFlags} override={override}
            safetyReviewed={safetyReviewed} setSafetyReviewed={setSafetyReviewed} />
        )}

        {stepDef.kind === "domain" && (
          <DomainCard key={stepDef.key} module={module} stepDef={stepDef} answers={answers} set={set}
            complaint={complaint} setComplaint={setComplaint} ctx={ctx} setC={setC} />
        )}

        {stepDef.kind === "result" && (
          <ResultView
            module={module} stepDef={stepDef}
            total={total} floor={floor} ceiling={ceiling} coverage={coverage} scorable={scorable} open={open}
            band={band} bandMeta={bandMeta} domains={domains}
            activeFlags={activeFlags} override={override} emergent={emergent}
            cohort={cohort} captureScreen={captureScreen} downloadCohort={downloadCohort}
            recs={recs} gapAlert={gapAlert} gapFlags={gapFlags} preview={preview}
            bundle={bundle} showJson={showJson} setShowJson={setShowJson}
            copyBundle={copyBundle} copied={copied} setToast={setToast} appVersion={appVersion} site={site}
          />
        )}

        {/* nav */}
        <div className="nav" data-testid="scr-nav">
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(s => s - 1)}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <div style={{flex:1}} />
          {step < LAST_STEP && (
            <button className="btn" disabled={!canContinue} onClick={() => setStep(s => s + 1)}>
              {step === LAST_STEP - 1 ? "See screen result" : "Continue"} <ArrowRight size={16} />
            </button>
          )}
          {step === LAST_STEP && (
            <button className="btn ghost" onClick={reset}><RotateCcw size={16} /> New screen</button>
          )}
        </div>

        {/* research readiness moved to the Research tab (AD8) */}
        <div className="sa-scr-link" data-testid="research-link">
          <FlaskConical size={18} color="var(--petrol)" aria-hidden="true" />
          <div className="sa-scr-link-t">
            Research readiness for this screen — calibration, validation, fairness and the model card — is in
            the <b>Research</b> tab. Captured this session: <span className="num">{cohort.length}</span>.
          </div>
          <button className="btn ghost" type="button" onClick={() => callHost("onOpenTab", "research")}>
            Open Research <ArrowRight size={16} />
          </button>
        </div>

        <p className="foot" data-testid="scr-foot">PROTOTYPE · not for clinical use · screening aid, not a diagnosis · no PHI leaves this browser</p>
      </div>

      {toast && <div className="toast" data-testid="scr-toast"><Check size={16} /> {toast}</div>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------- sub-components

/** Card heading of a step: the rubric's `card`, or a neutral one built from its rail entry. */
function cardOf(stepDef) {
  const rail = stepDef.rail || {};
  return stepDef.card || { eyebrow: `${rail.eyebrow} · ${rail.title}`, heading: rail.title };
}

function SafetyCard({ module, stepDef, rf, setRf, activeFlags, override, safetyReviewed, setSafetyReviewed }) {
  const card = cardOf(stepDef);
  return (
    <div className="card" data-testid="scr-step" data-step={stepDef.key}>
      <div className="eyebrow">{card.eyebrow}</div>
      <h2 className="steptitle">{card.heading ?? stepDef.rail.title}</h2>
      {card.sub && <p className="stepsub">{card.sub}</p>}
      {module.redFlagGroups.map(g => (
        <div key={g}>
          <div className="rfgroup">{g}</div>
          {module.redFlags.filter(f => f.group === g).map(f => (
            <div key={f.id} className={"rf" + (rf[f.id] ? " on" : "")}
                 role="checkbox" aria-checked={!!rf[f.id]} tabIndex={0}
                 onClick={() => setRf(v => ({ ...v, [f.id]: !v[f.id] }))}
                 onKeyDown={e => (e.key === "Enter" || e.key === " ") && setRf(v => ({ ...v, [f.id]: !v[f.id] }))}>
              <div className="box">{rf[f.id] && <Check size={13} />}</div>
              <div>
                <div className="rt">{f.text}<span className={"tier " + f.tier}>{f.tier}</span></div>
                <div className="rm">{f.points} · {f.action}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
      <div className="safetybar">
        {override
          ? <span className="pill" style={{color:"var(--coral)",background:"var(--coralbg)"}}>
              <TriangleAlert size={15}/> {activeFlags.length} red flag{activeFlags.length === 1 ? "" : "s"} — screening routing will be withheld
            </span>
          : <>
              <button className={"btn" + (safetyReviewed ? "" : " ghost")}
                      onClick={() => setSafetyReviewed(v => !v)}>
                {safetyReviewed ? <Check size={16}/> : <ShieldCheck size={16}/>} None of these apply
              </button>
              <span className="sm">
                {safetyReviewed
                  ? "Recorded as reviewed. This is written to the chart alongside the screen."
                  : "Confirm the review to continue — the screen will not proceed on an unexamined safety step."}
              </span>
            </>}
      </div>
    </div>
  );
}

function DomainCard({ module, stepDef, answers, set, complaint, setComplaint, ctx, setC }) {
  const card = cardOf(stepDef);
  const extras = Array.isArray(stepDef.extras) ? stepDef.extras : [];
  const intro = stepDef.domainIntro || {};
  const values = (module.phenotypes && module.phenotypes.values) || [];
  return (
    <div className="card" data-testid="scr-step" data-step={stepDef.key}>
      <div className="eyebrow">{card.eyebrow}</div>
      <h2 className="steptitle">{card.heading}</h2>
      {card.sub && <p className="stepsub">{card.sub}</p>}
      {extras.includes("complaintPicker") && values.length > 0 && (
        <>
          <div className="pick" style={{margin:"12px 0 4px"}}>
            {values.map(o => (
              <div key={o.value} className={"p" + (complaint === o.value ? " sel" : "")}
                   role="button" tabIndex={0}
                   onClick={() => setComplaint(o.value)}
                   onKeyDown={e => (e.key === "Enter" || e.key === " ") && setComplaint(o.value)}>
                <div className="ph">{o.h}</div><div className="pd">{o.d}</div>
              </div>
            ))}
          </div>
          <div style={{height:6}} />
        </>
      )}
      {(stepDef.domainKeys || []).map(k => (
        <QGroup key={k} domain={module.domains.find(d => d.key === k)} answers={answers} set={set} intro={intro[k]} />
      ))}
      {extras.includes("context") && module.contextItems.length > 0 && (
        <>
          <div style={{height:4}} />
          <ContextQ items={module.contextItems} ctx={ctx} setC={setC} />
        </>
      )}
    </div>
  );
}

function QGroup({ domain, answers, set, intro }) {
  if (!domain) return null;
  return (
    <div>
      {intro && <p className="stepsub" style={{marginTop:6}}>{intro}</p>}
      {domain.items.map(it => (
        <div className="q" key={it.id} data-item={it.id}>
          <div className="qtext">{it.text}</div>
          <div className="opts">
            {it.scale
              ? it.scale.map((o, i) => (
                  <button key={i} className={"opt" + (answers[it.id] === i ? " sel" : "")}
                          onClick={() => set(it.id, i)}>{o.label}</button>))
              : (["no", "yes"].map(v => (
                  <button key={v}
                    className={"opt" + (answers[it.id] === v ? (v === "yes" ? " sel" : " selno") : "")}
                    onClick={() => set(it.id, v)}>{v === "yes" ? "Yes" : "No"}</button>)))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContextQ({ items, ctx, setC }) {
  return (
    <div>
      {items.map(r => (
        <div className="q" key={r.id} data-context={r.id}>
          <div className="qtext">{r.text}</div>
          <div className="opts">
            {r.options.map(([v, l]) => (
              <button key={v} className={"opt" + (ctx[r.id] === v ? " sel" : "")}
                      onClick={() => setC(r.id, v)}>{l}</button>))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultView(props) {
  const { module, stepDef, total, floor, ceiling, coverage, scorable, open, band, bandMeta, domains, recs, gapAlert, gapFlags,
          activeFlags = [], override, emergent, preview,
          cohort = [], captureScreen, downloadCohort,
          bundle, showJson, setShowJson, copyBundle, copied, setToast, appVersion, site } = props;
  const copy = module.copy;
  const scaleMax = module.scaleMax;
  const indexName = copy.indexName;
  const zones = meterZones(module).map(z => ({ w: pctOf(z.w, scaleMax), c: ZONE_COLOR[z.band] }));
  const ticks = meterTicks(module);
  const fhir = module.fhir;
  const card = cardOf(stepDef);
  return (
    <div className="card" data-testid="scr-step" data-step={stepDef.key}>
      <div className="eyebrow">{card.eyebrow}</div>

      {/* safety override — always first, above the index */}
      {override && (
        <div className="override" style={{marginTop:12}} data-testid="scr-override">
          <div className="ot"><TriangleAlert size={20} /> Red flag — evaluate before screening routing</div>
          <div className="os">
            {activeFlags.length} finding{activeFlags.length === 1 ? "" : "s"} require
            {activeFlags.length === 1 ? "s" : ""} evaluation on {activeFlags.length === 1 ? "its" : "their"} own terms.
            {emergent ? " At least one needs same-day assessment." : " Expedited workup — days, not weeks."}
            {" "}The {indexName} is shown below for the record; it proposes no referral and no reassurance while this is open.
          </div>
          {activeFlags.map(f => (
            <div className="oitem" key={f.id}>
              <b>{f.text}</b>
              {f.points} — <span className="oact">{f.action}</span>
              <span className={"tier " + f.tier}>{f.tier}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="steptitle" style={{marginBottom:14}}>{indexName}</h2>

      <ProvenanceBadge module={module} audience="clinician" variant="full" />

      <div className="readout" data-testid="scr-readout">
        <div>
          <div className="scorecap">{scorable ? `SCORE / ${scaleMax}` : `POSSIBLE RANGE · ${coverage}% ANSWERED`}</div>
          {scorable
            ? <div className="score" style={{color:bandMeta.c}}>{total}</div>
            : <div className="scorerange" style={{color:bandMeta.c}}>{floor}<span className="sep">–</span>{ceiling}</div>}
        </div>
        <div style={{flex:"1 1 260px",minWidth:220}}>
          <span className="pill" style={{color:bandMeta.c,background:bandMeta.bg}}>
            {scorable
              ? <><Activity size={15}/> {bandMeta.label} {copy.screener.bandSuffix}</>
              : <><TriangleAlert size={15}/> {bandMeta.label}</>}
          </span>
          <div className="meter" data-testid="scr-meter">
            {zones.map((z, i) => <div key={i} className="z" style={{width:z.w+"%",background:z.c,opacity:.28}} />)}
            {scorable
              ? <div className="needle" style={{left:pctOf(total, scaleMax)+"%"}} />
              : <div className="rangeband" style={{left:pctOf(floor, scaleMax)+"%",width:Math.max(1,pctOf(ceiling-floor, scaleMax))+"%"}} />}
          </div>
          <div className="meterticks">{ticks.map((t, i) => <span key={i}>{t}</span>)}</div>
        </div>
      </div>

      {/* outstanding items — what would resolve the screen */}
      {!scorable && (
        <div className="openlist" data-testid="scr-open">
          <div className="oh">Outstanding items · {open.length} unanswered</div>
          {open.slice(0, 6).map(it => (
            <div className="oi" key={it.id}>
              <span className="ow">+{it.w}</span>
              <span>{it.text}</span>
            </div>
          ))}
          {open.length > 6 && <div className="om">…and {open.length - 6} more. Highest-weight items are listed first.</div>}
          <div className="om">
            No band, referral, or CDS prompt is issued until the answered items settle the index into a single band.
            Unanswered items are <b>not</b> counted as denials.
          </div>
        </div>
      )}

      {/* domain contributions */}
      <div style={{marginTop:20}} data-testid="scr-domains">
        <div className="eyebrow" style={{marginBottom:6}}>Contribution by domain</div>
        {module.domainOrder.map(k => (
          <div className="dbar" key={k}>
            <div className="dl">{domains[k].label}</div>
            <div className="dtrack"><div className="dfill" style={{width:Math.abs(domains[k].pct)+"%",background:domains[k].negative?"var(--coral)":"var(--petrol2)"}} /></div>
            <div className="dpts num">{domains[k].pts}/{domains[k].max}</div>
          </div>
        ))}
      </div>

      {/* gap alert */}
      {gapAlert && (
        <div className="alert" style={{marginTop:18}} data-testid="scr-gap">
          <TriangleAlert size={20} color="#B26C1F" style={{flex:"0 0 auto",marginTop:1}} />
          <div>
            <div className="at">{copy.screener.gapAlert.title}</div>
            <div className="ap">
              {gapFlags.join(" · ")}. {copy.screener.gapAlert.body}
            </div>
          </div>
        </div>
      )}

      {/* recommendations / routing */}
      <div style={{marginTop:20}} data-testid="scr-recs">
        <div className="eyebrow" style={{marginBottom:2}}>Recommended next steps</div>
        {recs.map((r, i) => (
          <div className="rec" key={i} data-rec={r.id}>
            <h4>{r.h}</h4>
            <p>{r.p}</p>
            {r.chips.length > 0 && (
              <div className="chips">
                {r.chips.map((c, j) => <span className="chip" key={j}>{c}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CDS Hooks preview — safety card pre-empts the screening card */}
      {preview.safety ? (
        <div className="cds" style={{borderLeftColor:"var(--coral)"}} data-testid="cds-preview" data-card="safety">
          <div className="src">{preview.safety.src}</div>
          <div style={{fontSize:13.5,fontWeight:640,margin:"5px 0 3px",color:"#8E3520"}}>
            {preview.safety.title}
          </div>
          <div style={{fontSize:12.5,color:"#33474A"}}>
            {preview.safety.body}
          </div>
        </div>
      ) : preview.index && (
        <div className="cds" data-testid="cds-preview" data-card="index">
          <div className="src">{preview.index.src}</div>
          <div style={{fontSize:13.5,fontWeight:640,margin:"5px 0 3px"}}>
            {preview.index.title}
          </div>
          <div style={{fontSize:12.5,color:"#33474A"}}>
            {preview.index.body}
          </div>
        </div>
      )}

      {/* FHIR write-back */}
      <div style={{marginTop:20}} data-testid="scr-writeback">
        <div className="eyebrow" style={{marginBottom:8}}>Write back to chart</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button className="btn" onClick={() => setToast(scorable ? "Written to chart (simulated)" : "Partial screen written as in-progress (simulated)")}>
            <Send size={16}/> {scorable ? "Write result to chart" : "Write partial screen to chart"}
          </button>
          <button className="btn ghost" onClick={() => setShowJson(v => !v)}>
            <FileJson size={16}/> {showJson ? "Hide" : "View"} FHIR bundle
          </button>
          {showJson && (
            <button className="btn ghost" onClick={copyBundle}>
              {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>

        {/* pilot capture — the clinician-in-the-loop loop, closed */}
        <div className="capture">
          <div>
            <div className="ct">Pilot capture</div>
            <div className="cp">
              Appends this screen to a session cohort in the canonical import schema, then loads or exports it
              for the research panel. <b>Reference label and diagnosis are left empty</b> — there is no reference
              standard at screening time, and an empty column is what the follow-up visit fills in.
              Rows carry a site-local pseudonym so repeat screens on the same patient link across sessions,
              which is what makes test-retest and responsiveness measurable at all.
            </div>
            {site.SALT_IS_DEFAULT && (
              <div className="alert" style={{marginTop:10}}>
                <TriangleAlert size={17} color="#B26C1F" style={{flex:"0 0 auto",marginTop:1}}/>
                <div><div className="at">Pseudonymisation salt not configured</div>
                  <div className="ap">
                    <code>SITE_SALT</code> is still the shipped default, so <code>subject_id</code> is reversible by
                    anyone holding this source and a list of MRNs. Set a site-specific salt and keep it with your
                    other study secrets before capturing real patients.
                  </div></div>
              </div>
            )}
          </div>
          <div className="spacer"/>
          <button className="btn ghost" onClick={captureScreen}><Plus size={15}/> Append this screen</button>
          <button className="btn ghost" disabled={!cohort.length} onClick={downloadCohort}>
            <Download size={15}/> Export cohort ({cohort.length})
          </button>
        </div>

        {/* deployable specification — real resources, generated from the running module */}
        <details className="about" style={{marginTop:14}}>
          <summary><FileJson size={15}/> Published specification <ChevronDown size={14} className="chev"/></summary>
          <div className="abgrid">
            <div>{copy.screener.specIntro}</div>
            <div className="nav" style={{marginTop:2,flexWrap:"wrap"}}>
              <button className="btn ghost" data-download="questionnaire" onClick={()=>downloadJsonFile(`${fhir.filePrefix}-questionnaire-v${module.instrumentVersion}.json`, buildQuestionnaire(module))}>
                <Download size={15}/> FHIR Questionnaire
              </button>
              <button className="btn ghost" data-download="cds-hooks" onClick={()=>downloadJsonFile(`${fhir.filePrefix}-cds-hooks.json`, buildCdsHooks(module))}>
                <Download size={15}/> CDS Hooks service
              </button>
              <button className="btn ghost" data-download="data-dictionary" onClick={()=>downloadJsonFile(`${fhir.filePrefix}-data-dictionary-v${module.instrumentVersion}.json`, buildDataDictionary(module, { appVersion }))}>
                <Download size={15}/> Data dictionary
              </button>
            </div>
          </div>
        </details>
        {showJson && (
          <pre className="code" data-testid="scr-bundle" dangerouslySetInnerHTML={{ __html: fhirHtml(bundle) }} />
        )}
      </div>

      <div className="note">
        <ShieldCheck size={15} style={{flex:"0 0 auto",marginTop:1}} />
        <span>{copy.screener.disclaimer}</span>
      </div>

      <details className="about" style={{marginTop:16}}>
        <summary><Info size={15}/> How EMR integration works <ChevronDown className="chev" size={15}/></summary>
        <div className="abgrid">
          {(copy.screener.emrDetails || []).map((d, i) => <div key={i}><Rich text={d} /></div>)}
        </div>
      </details>
    </div>
  );
}
