import React, { useMemo, useRef, useState } from "react";
import {
  Activity, BarChart3, Check, ChevronDown, ClipboardCheck, Copy, Database,
  Download, FileJson, Gauge, Info, Scale, ShieldCheck, TriangleAlert, Upload
} from "lucide-react";

/*
  Shared research-readiness layer for MASQUE, VOICED, and BREATHE.

  What this adds now, before restricted/public datasets are connected:
  - calibrated probability + confidence/abstention behavior
  - transparent feature/domain contribution explanations
  - CSV/JSON ingestion with schema inspection and data-quality checks
  - validation metrics when reference labels are present
  - subgroup/fairness metrics when sex/gender fields are present
  - prevalence, utilization, and avoidable-cost summaries when fields are present
  - downloadable model card, provenance record, and ingestion manifest (the instrument data dictionary is published by the clinical app, which owns the item set)

  It intentionally does NOT claim that the illustrative calibration constants or demo rows are
  clinically validated. Replace the project adapter's calibration and field mappings with estimates
  learned from the approved datasets and clinician-in-the-loop reference cohort.
*/

const PROJECTS = {
  MASQUE: {
    title: "MASQUE research & deployment readiness",
    target: "masked migrainous / neuropathic driver",
    threshold: 0.5,
    calibration: { midpoint: 48, slope: 0.075 },
    sources: [
      ["NHANES", "ENT, audiometry, balance, and headache phenotype inputs"],
      ["NHIS", "Headache, dizziness, hearing, and burden prevalence"],
      ["MEPS", "Utilization, medication, procedure, and cost estimates"],
      ["CMS PUF / DE-SynPUF", "Repeat visits, imaging, sinus/ear procedures, care pathways"],
      ["HCUPnet", "ED/inpatient sinonasal and dizziness context"],
      ["openFDA / FAERS", "Narrative NLP development and medication safety context"],
      ["CDC WONDER / BRFSS", "Demographic and geographic burden"],
      ["All of Us", "Optional linked EHR/survey validation"],
    ],
    expected: ["score", "label", "sex", "gender", "age", "weight", "annual_cost", "avoidable_cost"],
    demo: [
      { score: 79, label: 1, sex: "female", gender: "woman", age: 42, weight: 1.2, annual_cost: 6200, avoidable_cost: 3400 },
      { score: 68, label: 1, sex: "female", gender: "woman", age: 51, weight: 0.9, annual_cost: 5100, avoidable_cost: 2700 },
      { score: 57, label: 1, sex: "male", gender: "man", age: 39, weight: 0.8, annual_cost: 4100, avoidable_cost: 1800 },
      { score: 43, label: 0, sex: "female", gender: "woman", age: 35, weight: 1.1, annual_cost: 2700, avoidable_cost: 700 },
      { score: 25, label: 0, sex: "male", gender: "man", age: 60, weight: 1.0, annual_cost: 1900, avoidable_cost: 300 },
      { score: 14, label: 0, sex: "female", gender: "woman", age: 29, weight: 1.3, annual_cost: 1200, avoidable_cost: 100 },
      // The two axes deliberately diverge in these rows, and one row records gender
      // without sex. Under the old `sex ?? gender` collapse both would have been
      // silently folded into the sex table. The small stratum is expected to be
      // suppressed — that is the minimum-cell rule working, not a gap in the data.
      { score: 61, label: 1, sex: "female", gender: "man", age: 33, weight: 1.0, annual_cost: 4400, avoidable_cost: 2100 },
      { score: 31, label: 0, sex: "male", gender: "nonbinary", age: 27, weight: 1.1, annual_cost: 2200, avoidable_cost: 500 },
      { score: 52, label: 1, gender: "woman", age: 47, weight: 1.0, annual_cost: 3900, avoidable_cost: 1600 },
    ],
  },
  BREATHE: {
    title: "BREATHE research & deployment readiness",
    target: "laryngeal-hypersensitivity driver",
    threshold: 0.5,
    calibration: { midpoint: 47, slope: 0.078 },
    sources: [
      ["NHANES", "Spirometry plus respiratory and reflux phenotype inputs"],
      ["NHIS", "Asthma, cough, reflux, and prevalence trends"],
      ["MEPS", "Inhaler/PPI utilization and avoidable-cost estimates"],
      ["CMS PUF / DE-SynPUF", "Repeat asthma visits, ED dyspnea, laryngoscopy, medication fills"],
      ["HCUPnet", "Population ED/inpatient dyspnea and stridor context"],
      ["openFDA / FAERS", "PPI/inhaled-steroid narratives and NLP development"],
      ["BRFSS / CDC WONDER", "Asthma burden and subgroup/geographic context"],
      ["All of Us", "Optional linked EHR/survey validation"],
    ],
    expected: ["score", "label", "sex", "gender", "age", "weight", "annual_cost", "avoidable_cost"],
    demo: [
      { score: 84, label: 1, sex: "female", age: 28, weight: 1.1, annual_cost: 7600, avoidable_cost: 4300 },
      { score: 72, label: 1, sex: "female", age: 37, weight: 1.0, annual_cost: 5900, avoidable_cost: 3100 },
      { score: 61, label: 1, sex: "male", age: 34, weight: 0.9, annual_cost: 4800, avoidable_cost: 2300 },
      { score: 46, label: 0, sex: "female", age: 49, weight: 1.2, annual_cost: 3500, avoidable_cost: 900 },
      { score: 29, label: 0, sex: "male", age: 55, weight: 1.0, annual_cost: 2100, avoidable_cost: 350 },
      { score: 17, label: 0, sex: "female", age: 31, weight: 1.3, annual_cost: 1700, avoidable_cost: 180 },
    ],
  },
  VOICED: {
    title: "VOICED research & deployment readiness",
    target: "clinically significant dysphonia",
    threshold: 0.5,
    calibration: { midpoint: 42, slope: 0.085 },
    sources: [
      ["Bridge2AI-Voice", "Primary task-level recordings, EHR-linked labels, and PROM anchors"],
      ["NHIS", "Voice/speech prevalence and burden"],
      ["MEPS", "ENT/SLP utilization, botulinum toxin, and cost estimates"],
      ["CMS PUF / synthetic claims", "Laryngoscopy, stroboscopy, botulinum cadence, speech therapy"],
      ["openFDA / FAERS", "Botulinum toxin safety and narrative NLP development"],
      ["NIDCD statistics", "Authoritative voice-disorder burden context"],
      ["Saarbrücken Voice Database", "Supplementary pathological-voice external checks"],
      ["All of Us", "Optional linked EHR/survey validation"],
    ],
    expected: ["score", "label", "sex", "gender", "age", "weight", "annual_cost", "avoidable_cost", "device", "language", "accent"],
    demo: [
      { score: 82, label: 1, sex: "female", age: 46, weight: 1.1, annual_cost: 4800, avoidable_cost: 2400, device: "phone", language: "English" },
      { score: 69, label: 1, sex: "female", age: 53, weight: 1.0, annual_cost: 4100, avoidable_cost: 1900, device: "laptop", language: "English" },
      { score: 58, label: 1, sex: "male", age: 44, weight: 0.9, annual_cost: 3600, avoidable_cost: 1500, device: "phone", language: "Spanish" },
      { score: 39, label: 0, sex: "female", age: 38, weight: 1.2, annual_cost: 2300, avoidable_cost: 600, device: "tablet", language: "English" },
      { score: 24, label: 0, sex: "male", age: 62, weight: 1.0, annual_cost: 1700, avoidable_cost: 240, device: "laptop", language: "English" },
      { score: 12, label: 0, sex: "female", age: 26, weight: 1.3, annual_cost: 900, avoidable_cost: 80, device: "phone", language: "Spanish" },
    ],
  },
};

const CSS = `
.rrp{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0C2B2F;background:#fff;border:1px solid #D7E1DF;border-radius:14px;padding:17px;margin-top:14px;line-height:1.45}
.rrp *{box-sizing:border-box}.rrp h3,.rrp h4,.rrp p{margin:0}.rrp-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rrp-mark{width:34px;height:34px;border-radius:9px;background:#0F5C61;color:#fff;display:flex;align-items:center;justify-content:center}.rrp-title{font-size:16px;font-weight:700}.rrp-sub{font-size:12px;color:#5C6E6C}.rrp-spacer{flex:1}.rrp-badge{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;border:1px solid #D7E1DF;border-radius:999px;padding:4px 8px;color:#4F6466}.rrp-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:14px 0 11px}.rrp-tab{font:600 12px inherit;border:1px solid #D7E1DF;background:#fff;color:#0C2B2F;border-radius:8px;padding:7px 10px;cursor:pointer}.rrp-tab.on{background:#0F5C61;border-color:#0F5C61;color:#fff}.rrp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px}.rrp-kpi{border:1px solid #D7E1DF;border-radius:10px;padding:10px;background:#fff}.rrp-k{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;color:#5C6E6C}.rrp-v{font:650 22px ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:3px}.rrp-small{font-size:11.5px;color:#5C6E6C;margin-top:3px}.rrp-call{border-left:3px solid #0F5C61;background:#F4F8F7;border-radius:0 10px 10px 0;padding:11px 13px;margin-top:10px;font-size:12.5px}.rrp-warn{border-left-color:#B26C1F;background:#FFF9EF}.rrp-danger{border-left-color:#A93124;background:#F7E1DD}.rrp-row{display:grid;grid-template-columns:145px 1fr 58px;gap:9px;align-items:center;padding:5px 0}.rrp-l{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rrp-track{height:8px;border-radius:5px;background:#D7E1DF;overflow:hidden}.rrp-fill{height:100%;background:#137A80;border-radius:5px}.rrp-n{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right;color:#5C6E6C}.rrp-btnrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rrp-btn{font:600 12.5px inherit;cursor:pointer;border-radius:9px;padding:8px 11px;border:1px solid #0F5C61;background:#0F5C61;color:#fff;display:inline-flex;align-items:center;gap:6px}.rrp-btn.ghost{background:#fff;color:#0C2B2F;border-color:#D7E1DF}.rrp-code{font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#0C2B2F;color:#CFE6E2;border-radius:10px;padding:12px;max-height:260px;overflow:auto;white-space:pre-wrap;margin-top:9px}.rrp-table{width:100%;border-collapse:collapse;font-size:11.5px}.rrp-table th,.rrp-table td{border-bottom:1px solid #D7E1DF;padding:7px;text-align:left;vertical-align:top}.rrp-table th{font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.04em;color:#5C6E6C}.rrp-upload{border:1px dashed #9BB2AF;border-radius:10px;padding:13px;text-align:center;background:#FAFCFB}.rrp-note{font-size:11px;color:#5C6E6C;margin-top:10px;display:flex;gap:7px}.rrp details summary{cursor:pointer;font-size:12px;font-weight:650;color:#0F5C61}.rrp-good{color:#2C7A57}.rrp-mid{color:#B26C1F}.rrp-bad{color:#A93124}@media(max-width:650px){.rrp-row{grid-template-columns:105px 1fr 48px}}
`;

// Minimum output confidence required before a per-patient result is issued.
const ABSTAIN_FLOOR = 0.55;

function logistic(score, calibration) {
  return 1 / (1 + Math.exp(-calibration.slope * (Number(score || 0) - calibration.midpoint)));
}
function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }
function pct(v) { return Number.isFinite(v) ? `${Math.round(v * 100)}%` : "—"; }
function money(v) { return Number.isFinite(v) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v) : "—"; }
function num(v, d = 2) { return Number.isFinite(v) ? Number(v).toFixed(d) : "—"; }
function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
}
function parseCsv(text) {
  const rows = []; let row = [], cell = "", quote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quote && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quote = !quote;
    else if (ch === "," && !quote) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quote) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell); cell = ""; if (row.some(v => v.trim() !== "")) rows.push(row); row = [];
    } else cell += ch;
  }
  row.push(cell); if (row.some(v => v.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const heads = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(heads.map((h, i) => [h, coerce(r[i])] )));
}
function coerce(v) {
  const s = String(v ?? "").trim(); if (s === "") return null;
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}
/*  Absent is not zero.

    A missing reference label is not a negative case. A missing cost is not a zero
    cost. Coercing them silently produced fabricated negatives that the validation
    tab then published as sensitivity and PPV, from a cohort that had no reference
    standard at all. Anything absent now stays null and is excluded downstream
    rather than imputed.

    Weight is the one documented exception: it stays null in the data (so it is
    reported honestly as missing), and defaults to 1 only at the point of
    computation, via weightOf().
*/
const SRC = "__srcPresent";                     // per-row provenance, stripped from column reports
const isAbsent = v => v === null || v === undefined || v === "";
const anyPresent = (...vals) => vals.some(v => !isAbsent(v));
function numOrNull(...vals) {
  for (const v of vals) {
    if (isAbsent(v)) continue;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;     // present but unparsable -> null, not 0
  }
  return null;
}
function binaryOrNull(...vals) {
  const n = numOrNull(...vals);
  return n === 0 || n === 1 ? n : null;       // a label of 2, "positive", or "" is not a label
}
const weightOf = r => (Number.isFinite(r.weight) && r.weight > 0 ? r.weight : 1);
const isLabeled = r => r.label === 0 || r.label === 1;

function strOrNull(...vals) {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const t = String(v).trim();
    if (t === "") continue;
    // Explicit non-answers stay distinct from an absent column: both are excluded
    // from stratification, but only one of them means the question was asked.
    return t.toLowerCase();
  }
  return null;
}

function normalizeRows(input) {
  const arr = Array.isArray(input) ? input : Array.isArray(input?.rows) ? input.rows : Array.isArray(input?.data) ? input.data : [];
  return arr.map(r => ({ ...r,
    score: numOrNull(r.score, r.masque_score, r.breathe_score, r.voiced_score, r.index),
    label: binaryOrNull(r.label, r.reference_label, r.outcome, r.target),
    weight: numOrNull(r.weight, r.survey_weight),
    annual_cost: numOrNull(r.annual_cost, r.total_cost, r.expenditure),
    avoidable_cost: numOrNull(r.avoidable_cost, r.misdirected_cost),
    // Sex and gender are normalized as two independent fields and never fall back
    // to one another. Collapsing them with `sex ?? gender` silently answered a
    // question nobody asked: a cohort stratified "by sex" was in fact stratified by
    // whichever column happened to exist per row, which is neither variable.
    sex: strOrNull(r.sex, r.sex_at_birth, r.birth_sex),
    gender: strOrNull(r.gender, r.gender_identity),
    // Longitudinal keys. subject_id is a pseudonym produced at capture; the panel
    // never sees, needs, or wants the identifier it was derived from.
    subject_id: strOrNull(r.subject_id, r.subjectId, r.participant_id),
    captured_at: strOrNull(r.captured_at, r.capturedAt, r.timestamp),
    // Which canonical fields the source actually supplied. Lets the panel tell
    // "column absent" apart from "column present but unreadable" — otherwise a
    // label column full of "positive"/"negative" reads as simply unlabeled.
    [SRC]: {
      score: anyPresent(r.score, r.masque_score, r.breathe_score, r.voiced_score, r.index),
      label: anyPresent(r.label, r.reference_label, r.outcome, r.target),
      weight: anyPresent(r.weight, r.survey_weight),
      annual_cost: anyPresent(r.annual_cost, r.total_cost, r.expenditure),
      avoidable_cost: anyPresent(r.avoidable_cost, r.misdirected_cost),
      sex: anyPresent(r.sex, r.sex_at_birth, r.birth_sex),
      gender: anyPresent(r.gender, r.gender_identity),
      subject_id: anyPresent(r.subject_id, r.subjectId, r.participant_id),
    },
  }));
}
function auc(rows, pfn) {
  const pairs = [];
  for (let i = 0; i < rows.length; i++) for (let j = 0; j < rows.length; j++) {
    if (rows[i].label === 1 && rows[j].label === 0) pairs.push(pfn(rows[i]) === pfn(rows[j]) ? 0.5 : pfn(rows[i]) > pfn(rows[j]) ? 1 : 0);
  }
  return pairs.length ? pairs.reduce((a, b) => a + b, 0) / pairs.length : NaN;
}
function metrics(rows, cfg) {
  // Number(null) is 0, so a null label would silently pass an includes([0,1]) test.
  // Only an explicit 0 or 1 counts, and only alongside a real score.
  const usable = rows.filter(r => isLabeled(r) && Number.isFinite(r.score));
  if (!usable.length) return null;
  let tp=0,tn=0,fp=0,fn=0,brier=0,wSum=0;
  for (const r of usable) {
    const w = weightOf(r);
    const p = logistic(r.score, cfg.calibration), pred = p >= cfg.threshold ? 1 : 0;
    if (pred===1&&r.label===1)tp+=w; if(pred===0&&r.label===0)tn+=w; if(pred===1&&r.label===0)fp+=w; if(pred===0&&r.label===1)fn+=w;
    brier += w * (p-r.label)**2; wSum += w;
  }
  const flaggedBy = r => logistic(r.score, cfg.calibration) >= cfg.threshold;
  const pos = usable.filter(r => r.label === 1), neg = usable.filter(r => r.label === 0);
  const ciPolicy = { ...FAIRNESS_POLICY, minCellN: 1 };   // report with wide intervals rather than suppress
  return {
    n: usable.length, nPos: pos.length, nNeg: neg.length,
    sensitivity: tp/(tp+fn), specificity: tn/(tn+fp), ppv: tp/(tp+fp), npv: tn/(tn+fn),
    sensCI: wRate(pos.filter(flaggedBy), pos, ciPolicy),
    specCI: wRate(neg.filter(r => !flaggedBy(r)), neg, ciPolicy),
    accuracy:(tp+tn)/(tp+tn+fp+fn), brier:brier/wSum, auc:auc(usable,r=>logistic(r.score,cfg.calibration)), tp,tn,fp,fn,
  };
}
const ciText = c => (c && !c.suppressed && Number.isFinite(c.lo)) ? `95% CI ${pct(c.lo)}–${pct(c.hi)}` : null;
/*  Calibration — the adjective in the §7.2 deliverable.

    Brier score was carrying this entire requirement, and Brier conflates calibration
    with discrimination: a model can improve its Brier by getting sharper while
    getting *worse* at being right about probabilities. §8 lists calibration as a
    requirement distinct from sensitivity/specificity, and §7.2 promises "a calibrated
    classifier that outputs the probability of an underlying migrainous/neuropathic
    driver". Probability is the product, so it needs its own statistics.

    Three, in increasing strength:

      citl    calibration-in-the-large — mean predicted minus observed rate. Zero is
              ideal. Positive means the model over-predicts across the board. This is
              the one that moves when a model is transported to a population with a
              different base rate.
      slope   from a weighted logistic regression of outcome on logit(predicted).
              One is ideal. Below one means predictions are too extreme — the usual
              overfitting signature. Above one means too conservative.
      bins    reliability table. The only one of the three that shows *where* the
              miscalibration lives, which is what tells you whether a threshold is
              safe in the range you actually operate in.

    None of these are interpretable on a handful of rows, so the same suppression
    discipline as the fairness audit applies rather than printing a confident number
    from twelve observations.
*/
function calibration(rows, cfg, policy = FAIRNESS_POLICY) {
  const usable = rows.filter(r => isLabeled(r) && Number.isFinite(r.score));
  const nPos = usable.filter(r => r.label === 1).length;
  const nNeg = usable.filter(r => r.label === 0).length;
  if (!usable.length) return null;

  const eps = 1e-6;
  const pts = usable.map(r => {
    const p = Math.min(1 - eps, Math.max(eps, logistic(r.score, cfg.calibration)));
    return { p, y: r.label, w: weightOf(r), l: Math.log(p / (1 - p)) };
  });
  const W = pts.reduce((a, q) => a + q.w, 0);
  const meanPredicted = pts.reduce((a, q) => a + q.w * q.p, 0) / W;
  const observed = pts.reduce((a, q) => a + q.w * q.y, 0) / W;

  // Weighted logistic regression y ~ intercept + slope * logit(p), Newton-Raphson.
  // Needs both classes present; with one class the likelihood has no interior
  // maximum and the slope runs off to infinity, so it is reported as unavailable
  // rather than as whatever the iteration happened to reach when it stopped.
  let intercept = 0, slope = 1, converged = false;
  const estimable = nPos >= policy.minCellN && nNeg >= policy.minCellN;
  if (estimable) {
    for (let it = 0; it < 60; it++) {
      let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
      for (const q of pts) {
        const mu = 1 / (1 + Math.exp(-(intercept + slope * q.l)));
        const v = q.w * mu * (1 - mu), res = q.w * (q.y - mu);
        g0 += res; g1 += res * q.l; h00 += v; h01 += v * q.l; h11 += v * q.l * q.l;
      }
      const det = h00 * h11 - h01 * h01;
      if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
      const da = (h11 * g0 - h01 * g1) / det, db = (-h01 * g0 + h00 * g1) / det;
      intercept += da; slope += db;
      if (!Number.isFinite(intercept) || !Number.isFinite(slope)) break;
      if (Math.abs(da) < 1e-9 && Math.abs(db) < 1e-9) { converged = true; break; }
    }
  }

  const edges = [0, 0.2, 0.4, 0.6, 0.8, 1.0001];
  const bins = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const inBin = pts.filter(q => q.p >= edges[i] && q.p < edges[i + 1]);
    const bw = inBin.reduce((a, q) => a + q.w, 0);
    bins.push({
      lo: edges[i], hi: Math.min(1, edges[i + 1]), n: inBin.length,
      predicted: bw ? inBin.reduce((a, q) => a + q.w * q.p, 0) / bw : null,
      observed:  bw ? inBin.reduce((a, q) => a + q.w * q.y, 0) / bw : null,
      suppressed: inBin.length < policy.minCellN,
    });
  }

  return {
    n: usable.length, nPos, nNeg,
    meanPredicted, observed, citl: meanPredicted - observed,
    slope: converged ? slope : null, intercept: converged ? intercept : null,
    estimable, converged, bins,
    reliable: usable.length >= policy.minGroupN,
  };
}

/*  Repeat measures.

    Everything longitudinal was structurally unreachable while a captured screen had
    no subject identifier: test-retest reliability, responsiveness, and MCID
    validation all need two administrations linked to one person. §5.1 justifies
    VM-PATHI as the keystone precisely on those properties (test-retest r ~ 0.90,
    MCID ~ 6 points, responsiveness to treatment), and §8 asks for psychometric
    validation of the composite screener, not only of the anchor.

    Sequence is derived from captured_at rather than stored, so a row never has to
    know what number visit it is — which is a thing the app genuinely cannot know
    across sessions and would therefore have had to guess.
*/
function repeatMeasures(rows, policy = FAIRNESS_POLICY) {
  const withId = rows.filter(r => r.subject_id && Number.isFinite(r.score));
  if (!withId.length) return null;
  const bySubject = new Map();
  for (const r of withId) {
    if (!bySubject.has(r.subject_id)) bySubject.set(r.subject_id, []);
    bySubject.get(r.subject_id).push(r);
  }
  const pairs = [];
  for (const [id, list] of bySubject) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => String(a.captured_at ?? "").localeCompare(String(b.captured_at ?? "")));
    const first = sorted[0], last = sorted[sorted.length - 1];
    pairs.push({ id, first: first.score, last: last.score, delta: last.score - first.score, k: list.length });
  }
  const n = pairs.length;
  let r = null;
  if (n >= 3) {
    const mx = pairs.reduce((a, p) => a + p.first, 0) / n, my = pairs.reduce((a, p) => a + p.last, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const p of pairs) { const dx = p.first - mx, dy = p.last - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  }
  const deltas = pairs.map(p => p.delta);
  const meanDelta = n ? deltas.reduce((a, d) => a + d, 0) / n : null;
  const sd = n > 1 ? Math.sqrt(deltas.reduce((a, d) => a + (d - meanDelta) ** 2, 0) / (n - 1)) : null;
  return {
    subjects: bySubject.size, repeated: n, singleAdministration: bySubject.size - n,
    retestR: r, meanDelta, sdDelta: sd,
    reportable: n >= policy.minCellN,
    minChangeDetectable: sd != null ? 1.96 * sd * Math.SQRT2 : null,
  };
}

function weightedMean(rows, key) {
  // An absent value is not a zero — it is excluded from both numerator and
  // denominator, so a cohort with no cost column reports NaN rather than $0.
  let n=0,d=0,used=0;
  for(const r of rows){
    if (isAbsent(r[key])) continue;
    const v=Number(r[key]); if(!Number.isFinite(v)) continue;
    const w=weightOf(r); n+=v*w; d+=w; used++;
  }
  return { value: d?n/d:NaN, n: used };
}
/*  Renderer for a design-aware population-estimates artifact.

    Deliberately dumb: it formats and displays. Every number, interval, degrees of
    freedom and suppression decision was made by the ETL, which had the strata and
    the PSUs. The panel adding any arithmetic of its own here would reintroduce
    exactly the naive-variance problem the split exists to avoid.
*/
function PopulationArtifact({art,onClear}){
  const src=art.source||{}, d=art.design||{}, ph=art.phenotype||{};
  const rows=art.estimates||[];
  const total=rows.filter(e=>!e.domain), byDomain=rows.filter(e=>e.domain);
  const show=e=>e.suppress?<span className="rrp-mid">suppressed</span>:<>{pct(e.estimate)}<div className="rrp-small">95% CI {pct(e.ci?.[0])}–{pct(e.ci?.[1])}</div></>;
  return <>
    <div className="rrp-grid">
      {total.map((e,i)=><K key={i} label="Phenotype prevalence" value={e.suppress?"—":pct(e.estimate)}
        detail={e.suppress?e.suppressReason:`95% CI ${pct(e.ci?.[0])}–${pct(e.ci?.[1])} · unweighted n=${e.unweightedN} · df=${e.df}`}/>)}
      <K label="Source" value={`${src.dataset} ${src.cycle}`} detail={src.file}/>
      <K label="Variance method" value={d.varianceMethod||"—"} detail={`weight ${d.weight} · strata ${d.strata} · PSU ${d.psu}${d.nest?" · nested":""}`}/>
    </div>
    {byDomain.length>0&&<table className="rrp-table"><thead><tr><th>Subgroup</th><th>Prevalence</th><th>Unweighted n</th><th>df</th></tr></thead>
      <tbody>{byDomain.map((e,i)=><tr key={i}><td>{e.domain}</td><td>{show(e)}</td><td>{e.unweightedN}</td><td>{e.df}</td></tr>)}</tbody></table>}
    <div className="rrp-call"><b>Phenotype.</b> {ph.definition||"not stated"}
      {ph.mapFile&&<div className="rrp-small" style={{marginTop:4}}>map {ph.mapFile} v{ph.mapVersion}</div>}</div>
    {ph.unmapped?.length>0&&<div className="rrp-call rrp-warn"><b>Narrower than proposal §7.1.</b> This cycle could not express: {ph.unmapped.join(", ")}. The phenotype measured here is not the phenotype defined in the proposal, and the difference is stated rather than absorbed.</div>}
    {art.caveats?.length>0&&<div className="rrp-call rrp-warn"><b>Caveats (from the producing script).</b><ul style={{margin:"6px 0 0 18px"}}>{art.caveats.map((c,i)=><li key={i}>{c}</li>)}</ul></div>}
    <div className="rrp-call"><b>Provenance.</b> {art.producedBy} · generated {art.generatedAt}
      {src.sha256&&<div className="rrp-small" style={{marginTop:4}}>source sha256 {String(src.sha256).slice(0,24)}…</div>}</div>
    <div className="rrp-btnrow"><button className="rrp-btn ghost" onClick={onClear}>Clear artifact and show cohort figures</button></div>
  </>;
}

function population(rows, cfg) {
  const scored = rows.filter(r => Number.isFinite(r.score));
  if (!scored.length) return null;
  let flagged=0,w=0;
  for(const r of scored){const rw=weightOf(r);w+=rw;if(logistic(r.score,cfg.calibration)>=cfg.threshold)flagged+=rw;}
  const annual = weightedMean(scored,"annual_cost"), avoidable = weightedMean(scored,"avoidable_cost");
  return { n:scored.length, dropped:rows.length-scored.length, weightedN:w, prevalence:flagged/w,
    annualCost:annual.value, annualCostN:annual.n, avoidableCost:avoidable.value, avoidableCostN:avoidable.n };
}
/*  Fairness audit policy — pre-specified, not chosen after seeing the numbers.

    The old implementation computed gaps as max − min after dropping any group whose
    rate came back NaN. A subgroup with no positive cases has an undefined
    sensitivity, so it silently disappeared — and a cohort that reduced to one
    usable group reported a 0% gap, i.e. perfect fairness measured across a single
    stratum. That is the same failure as #1 and #3: absent data rendered as a
    reassuring result.

    Three things follow, and all three are declared here rather than inferred later:

    1. Small groups are suppressed, not silently dropped. The group and its size
       stay visible; only the rates are withheld. Suppression also limits
       re-identification in small strata.
    2. Every rate carries an interval. A gap between two noisy estimates is not
       evidence of fairness or of harm.
    3. PASS requires demonstrating the disparity is below tolerance — the interval
       must sit under it. Merely failing to detect a gap in a small sample is
       INCONCLUSIVE, never PASS. §11 commits to rejecting a model that widens
       disparity; that is the FAIL branch.
*/
const FAIRNESS_POLICY = {
  minGroupN: 30,          // rows in a subgroup before any rate is reported
  minCellN: 10,           // rows in a metric's denominator before that rate is reported
  selectionGapTolerance: 0.10,
  sensitivityGapTolerance: 0.10,
  specificityGapTolerance: 0.10,
  confidence: 0.95,
  z: 1.959963985,
  // The tolerances above are placeholders chosen to make the machinery concrete.
  // A disparity tolerance is a clinical and ethical commitment, not an engineering
  // default — it needs to be set and cited by the clinical lead before submission.
  toleranceStatus: "placeholder — requires clinical sign-off and citation",
  // A pre-specified tolerance nobody signed is not pre-specified, it is just a
  // constant. These fields exist so the model card can say who committed to the
  // number and on what basis; while they are null the audit reports the tolerance
  // as unattributed and says so in the same breath as the verdict.
  toleranceSetBy: null,
  toleranceRationale: null,
  toleranceSetOn: null,
};
const TOLERANCE_ATTRIBUTED = !!(FAIRNESS_POLICY.toleranceSetBy && FAIRNESS_POLICY.toleranceRationale);

// Wilson score interval — behaves sensibly at proportions near 0 and 1 and at
// small n, where the normal approximation does not.
function wilson(p, n, z) {
  if (!Number.isFinite(p) || !(n > 0)) return [NaN, NaN];
  const d = 1 + (z*z)/n;
  const c = (p + (z*z)/(2*n)) / d;
  const h = (z * Math.sqrt((p*(1-p))/n + (z*z)/(4*n*n))) / d;
  return [Math.max(0, c-h), Math.min(1, c+h)];
}
// Newcombe hybrid-score interval for a difference of two proportions, built from
// their Wilson bounds. Valid when the groups are independent, which subgroups are.
/*  §7.2 equity mitigation — group-specific threshold adjustment.

    The proposal promises "reweighting or threshold adjustment to reduce, not encode,
    female underdiagnosis". Until now this was declared not-implemented on the stated
    grounds that measurement precedes mitigation. Measurement exists, so this is the
    other half.

    Reweighting is deliberately NOT what this does. Instance reweighting is a
    fit-time intervention and nothing here is fitted — the calibration constants are
    illustrative. Implementing a reweighting knob over constants that were never
    learned would be a control connected to nothing. Threshold adjustment is the
    intervention that applies to a scored, unfitted model, so that is the one built.

    Three things this reports that a naive implementation would hide:

    1. WHAT IT COSTS. Equalising sensitivity across groups necessarily moves
       specificity and PPV. With unequal base rates you cannot have equal sensitivity,
       equal specificity, and calibration simultaneously — that is arithmetic, not a
       tuning problem. The panel shows the whole trade, both directions.

    2. LEVEL UP, NOT DOWN. The target defaults to the BEST-served group's sensitivity.
       Parity achieved by degrading the better-served group is arithmetically a
       success and ethically a fraud, so it is not the default.

    3. FIT AND EVALUATION ARE SPLIT. Thresholds are chosen on one half and reported on
       the other. Choosing a threshold to close a gap and then reporting that the gap
       closed on the same rows is circular, and it is the most common way this kind of
       adjustment gets oversold. Split is deterministic — by subject when subject_id
       is present, so repeat screens cannot straddle it.
*/
function splitKey(r, i) {
  const s = String(r.subject_id ?? `row-${i}`);
  let h = 0x811c9dc5;
  for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

function equityAdjustment(rows, cfg, policy = FAIRNESS_POLICY, axis = "sex") {
  const usable = rows.filter(r => isLabeled(r) && Number.isFinite(r.score) && r[axis] != null);
  if (!usable.length) return null;
  const p = r => logistic(r.score, cfg.calibration);

  const dev = [], hold = [];
  usable.forEach((r, i) => (splitKey(r, i) % 2 === 0 ? dev : hold).push(r));

  const groups = [...new Set(usable.map(r => String(r[axis]).toLowerCase()))].sort();
  const inGroup = (set, g) => set.filter(r => String(r[axis]).toLowerCase() === g);
  const sensOf = (set, thr) => {
    const pos = set.filter(r => r.label === 1);
    return pos.length ? pos.filter(r => p(r) >= thr).length / pos.length : null;
  };
  const specOf = (set, thr) => {
    const neg = set.filter(r => r.label === 0);
    return neg.length ? neg.filter(r => p(r) < thr).length / neg.length : null;
  };

  // Baseline sensitivity per group on the development half, at the common threshold.
  const devGroups = groups.map(g => ({ g, rows: inGroup(dev, g) }));
  const baseline = devGroups.map(x => ({ ...x, sens: sensOf(x.rows, cfg.threshold),
    nPos: x.rows.filter(r => r.label === 1).length }));
  const eligible = baseline.filter(x => x.nPos >= policy.minCellN && x.sens != null);
  if (eligible.length < 2) {
    return { insufficient: true, reason: `fewer than two groups have ${policy.minCellN}+ positive cases in the development half`,
      devN: dev.length, holdN: hold.length, groups: groups.length };
  }
  const target = Math.max(...eligible.map(x => x.sens));   // level up, never down

  // Threshold achieving >= target sensitivity within each group: the probability of
  // the k-th highest-scoring positive case, k = ceil(target * nPos).
  const thresholds = {};
  for (const x of eligible) {
    const ps = x.rows.filter(r => r.label === 1).map(p).sort((a, b) => b - a);
    const k = Math.max(1, Math.ceil(target * ps.length));
    thresholds[x.g] = ps.length ? ps[Math.min(k, ps.length) - 1] : cfg.threshold;
  }

  // Everything below is measured on the held-out half only.
  const report = eligible.map(x => {
    const h = inGroup(hold, x.g);
    const thr = thresholds[x.g];
    return {
      group: x.g, threshold: thr, movedBy: thr - cfg.threshold,
      nHold: h.length, nPosHold: h.filter(r => r.label === 1).length,
      sensBefore: sensOf(h, cfg.threshold), sensAfter: sensOf(h, thr),
      specBefore: specOf(h, cfg.threshold), specAfter: specOf(h, thr),
      thin: h.filter(r => r.label === 1).length < policy.minCellN,
    };
  });
  const span = (vals) => { const v = vals.filter(Number.isFinite); return v.length > 1 ? Math.max(...v) - Math.min(...v) : null; };
  const sensGapBefore = span(report.map(r => r.sensBefore));
  const sensGapAfter  = span(report.map(r => r.sensAfter));
  const specGapBefore = span(report.map(r => r.specBefore));
  const specGapAfter  = span(report.map(r => r.specAfter));

  return {
    insufficient: false, axis, criterion: "sensitivity", target,
    devN: dev.length, holdN: hold.length, thresholds, report,
    sensGapBefore, sensGapAfter, specGapBefore, specGapAfter,
    reducesTargetGap: sensGapBefore != null && sensGapAfter != null && sensGapAfter < sensGapBefore,
    costsSpecificityGap: specGapBefore != null && specGapAfter != null && specGapAfter > specGapBefore,
    holdoutThin: report.some(r => r.thin),
  };
}

function newcombeDiff(a, b) {
  const d = a.p - b.p;
  return {
    d,
    lo: Math.max(-1, d - Math.sqrt((a.p-a.lo)**2 + (b.hi-b.p)**2)),
    hi: Math.min( 1, d + Math.sqrt((a.hi-a.p)**2 + (b.p-b.lo)**2)),
  };
}
/*  Weighted rate with an interval.

    The point estimate is weighted; the interval uses Kish's effective sample size,
    (Σw)² / Σw², so that a handful of heavily weighted rows cannot masquerade as a
    large sample. This is an approximation — proper design-based variance needs the
    strata and PSU variables noted on the Population tab — and it is deliberately
    the conservative direction.
*/
function wRate(numer, denom, policy) {
  const n = denom.length;
  if (n < policy.minCellN) return { n, suppressed: true };
  const sw  = denom.reduce((a,r)=>a+weightOf(r), 0);
  const sw2 = denom.reduce((a,r)=>a+weightOf(r)**2, 0);
  const nEff = sw2 > 0 ? (sw*sw)/sw2 : 0;
  const p = sw ? numer.reduce((a,r)=>a+weightOf(r), 0) / sw : NaN;
  const [lo, hi] = wilson(p, nEff, policy.z);
  return { n, nEff, p, lo, hi, suppressed: false };
}
function gapOf(groups, key, policy) {
  const usable = groups.filter(g => g[key] && !g[key].suppressed && Number.isFinite(g[key].p));
  // A gap needs two groups. One group is not a comparison, and reporting 0% from a
  // single stratum was the original defect.
  if (usable.length < 2) return { assessable: false, groupsUsed: usable.length };
  const sorted = [...usable].sort((a,b) => b[key].p - a[key].p);
  const hiG = sorted[0], loG = sorted[sorted.length-1];
  const diff = newcombeDiff(hiG[key], loG[key]);
  return { assessable: true, groupsUsed: usable.length, high: hiG.group, low: loG.group, ...diff };
}
function verdictOf(gap, tolerance) {
  if (!gap?.assessable) return { code: "NOT ASSESSABLE", why: `fewer than two subgroups meet the reporting minimum` };
  if (gap.hi <= tolerance) return { code: "PASS", why: `disparity is below the ${pct(tolerance)} tolerance across the interval` };
  if (gap.lo >  tolerance) return { code: "FAIL", why: `disparity exceeds the ${pct(tolerance)} tolerance across the interval` };
  return { code: "INCONCLUSIVE", why: `the interval spans the ${pct(tolerance)} tolerance — more labeled data needed to decide` };
}
/*  Stratification axis is now explicit and reported.

    Rows with no value on the chosen axis are counted and shown, but do not form a
    group — an "unknown" bucket built from missing data is not a subgroup, and letting
    it into the max-min gap manufactures a disparity between people and an absence.
*/
function fairness(rows, cfg, policy = FAIRNESS_POLICY, axis = "sex") {
  const keyOf = r => (r[axis] == null ? null : String(r[axis]).toLowerCase());
  const onAxis = rows.filter(r => keyOf(r) !== null);
  const notRecorded = rows.length - onAxis.length;
  const names = [...new Set(onAxis.map(keyOf))].sort();
  const flagged = r => logistic(r.score, cfg.calibration) >= cfg.threshold;

  const groups = names.map(g => {
    const all = onAxis.filter(r => keyOf(r) === g);
    const scored = all.filter(r => Number.isFinite(r.score));
    if (all.length < policy.minGroupN) {
      return { group: g, n: all.length, scored: scored.length, suppressed: true };
    }
    const labeled = scored.filter(isLabeled);
    const pos = labeled.filter(r => r.label === 1);
    const neg = labeled.filter(r => r.label === 0);
    return {
      group: g, n: all.length, scored: scored.length, labeled: labeled.length, suppressed: false,
      selection:   wRate(scored.filter(flagged), scored, policy),
      sensitivity: wRate(pos.filter(flagged), pos, policy),
      specificity: wRate(neg.filter(r => !flagged(r)), neg, policy),
    };
  });

  const gaps = {
    selection:   gapOf(groups, "selection", policy),
    sensitivity: gapOf(groups, "sensitivity", policy),
    specificity: gapOf(groups, "specificity", policy),
  };
  const verdicts = {
    selection:   verdictOf(gaps.selection, policy.selectionGapTolerance),
    sensitivity: verdictOf(gaps.sensitivity, policy.sensitivityGapTolerance),
    specificity: verdictOf(gaps.specificity, policy.specificityGapTolerance),
  };
  const codes = Object.values(verdicts).map(v => v.code);
  const overall = codes.includes("FAIL") ? "FAIL"
    : codes.every(c => c === "NOT ASSESSABLE") ? "NOT ASSESSABLE"
    : codes.every(c => c === "PASS") ? "PASS" : "INCONCLUSIVE";

  return { groups, gaps, verdicts, overall, policy, axis, notRecorded,
    onAxisN: onAxis.length,
    suppressedGroups: groups.filter(g => g.suppressed).length };
}

/*  Internal consistency — proposal §8's psychometric requirement.

    This was structurally impossible before item-level capture: the canonical schema
    ingested one aggregate `score`, so Cronbach's alpha, item-total correlations and
    factor structure had nothing to run on. §5 leans on alpha ~0.92 for VM-PATHI
    while the panel could not compute alpha for its own instrument.

    Alpha is reported only over items that ACTUALLY VARY in the cohort. A constant
    item contributes zero variance and silently inflates alpha; it is listed as
    excluded rather than quietly folded in. Reverse-scored items (the negative-weight
    discriminators) are excluded too — alpha assumes items measure one construct in
    one direction, and a rule-out measures the opposite.
*/
function variance(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a,b)=>a+b,0)/xs.length;
  return xs.reduce((a,b)=>a+(b-m)**2,0)/(xs.length-1);
}
function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return NaN;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let sxy=0,sxx=0,syy=0;
  for (let i=0;i<n;i++){const a=xs[i]-mx,b=ys[i]-my;sxy+=a*b;sxx+=a*a;syy+=b*b;}
  return (sxx>0&&syy>0) ? sxy/Math.sqrt(sxx*syy) : NaN;
}
function internalConsistency(rows, itemIds) {
  if (!itemIds?.length) return null;
  // rows that carry a numeric value for every candidate item
  const present = itemIds.filter(id => rows.some(r => Number.isFinite(Number(r[id]))));
  if (present.length < 3) return null;
  const complete = rows.filter(r => present.every(id => Number.isFinite(Number(r[id]))));
  if (complete.length < 3) return { n: complete.length, insufficient: true, items: present.length };

  const cols = Object.fromEntries(present.map(id => [id, complete.map(r => Number(r[id]))]));
  const constant = present.filter(id => variance(cols[id]) === 0);
  const used = present.filter(id => !constant.includes(id));
  if (used.length < 3) return { n: complete.length, insufficient: true, items: present.length, constant };

  const totals = complete.map((_,i) => used.reduce((a,id)=>a+cols[id][i],0));
  const k = used.length;
  const sumItemVar = used.reduce((a,id)=>a+variance(cols[id]),0);
  const alpha = (k/(k-1)) * (1 - sumItemVar/variance(totals));

  // corrected item-total correlation: item vs total EXCLUDING that item
  const itemTotal = used.map(id => {
    const rest = complete.map((_,i) => used.filter(o=>o!==id).reduce((a,o)=>a+cols[o][i],0));
    return { id, r: pearson(cols[id], rest), variance: variance(cols[id]) };
  }).sort((a,b)=>a.r-b.r);

  return { n: complete.length, k, alpha, itemTotal, constant, insufficient: false };
}

/*  Provenance (§8 reproducibility check).

    The manifest carried only generatedAt, which reproduces nothing. A run is now
    identified by a stable fingerprint of the data it ran on: canonical field order,
    values normalized the same way the metrics see them. FNV-1a is not a security
    hash — it is a cheap content identifier, which is what "did we run on the same
    rows?" actually needs.
*/
function fingerprint(rows, cfg) {
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => k !== SRC).sort();
  const text = rows.map(r => cols.map(c => (isAbsent(r[c]) ? "\u0000" : String(r[c]))).join("\u001f")).join("\u001e");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return { algorithm: "fnv1a-32", value: h.toString(16).padStart(8, "0"), columns: cols.length, rows: rows.length };
}

function dataQuality(rows, cfg) {
  const columns = [...new Set(rows.flatMap(r=>Object.keys(r)))].filter(k=>k!==SRC);
  const n = rows.length;
  // This check used to run after imputation had already replaced every null with a
  // number, so it could only ever report 0% for the normalized fields. It now runs
  // against preserved nulls, and separates "column absent" from "column present
  // but unreadable" — a label column of "positive"/"negative" is the latter.
  const missing = Object.fromEntries(cfg.expected.map(k=>[k, n ? rows.filter(r=>isAbsent(r[k])).length/n : 1]));
  const unparsed = Object.fromEntries(cfg.expected.map(k=>[k, rows.filter(r=>isAbsent(r[k]) && r[SRC]?.[k]).length]));
  const duplicateCount = n - new Set(rows.map(r=>JSON.stringify(r))).size;
  const labeled = rows.filter(isLabeled).length;
  const scored = rows.filter(r=>Number.isFinite(r.score)).length;
  return { rows:n, columns, missing, unparsed, duplicateCount,
    labeled, unlabeled:n-labeled, scored,
    hasLabels: labeled>0,
    axes: { sex: rows.some(r=>r.sex!=null), gender: rows.some(r=>r.gender!=null) },
    hasGroups: rows.some(r=>r.sex!=null||r.gender!=null),
    hasCosts:rows.some(r=>Number(r.annual_cost)>0||Number(r.avoidable_cost)>0) };
}

export default function ResearchReadinessPanel({
  project,
  score = 0,
  band = "low",
  domains = {},
  coverage = 0,
  sex = null,
  gender = null,
  signalQuality = null,
  scorable = true,
  ceiling = null,
  phenotype = "",
  modelVersion = "prototype-0.2",
  redFlags = [],
  itemIds = [],
  capturedRows = [],
  instrumentVersion = null,
}) {
  const cfg = PROJECTS[project] || PROJECTS.MASQUE;
  const [tab,setTab]=useState("risk");
  const [rows,setRows]=useState(()=>normalizeRows(cfg.demo));
  const [sourceName,setSourceName]=useState("illustrative demo rows");
  const [error,setError]=useState("");
  const fileRef=useRef(null);
  // A design-aware estimates artifact produced offline by masque_population_etl.R.
  // Kept separate from `rows` on purpose: rows are individuals the panel may compute
  // on, this is a finished result the panel may only render.
  const [popArtifact,setPopArtifact]=useState(null);
  const probability=logistic(score,cfg.calibration);
  const probCeiling = ceiling==null ? null : logistic(ceiling,cfg.calibration);
  // Confidence is coverage-driven. Projects carrying an acoustic or physiologic
  // signal pass signalQuality and it is blended in; a questionnaire-only project
  // must not be credited for a signal-quality term it never supplied — that was
  // silently gifting a flat 0.28 and lowering the effective abstention floor.
  const confidence = signalQuality == null
    ? clamp(Number(coverage||0)/100)
    : clamp((Number(coverage||0)/100)*0.72 + clamp(signalQuality)*0.28);
  // The host app's determinacy verdict overrides the arithmetic: an unscorable
  // screen abstains regardless of how many items happen to be answered.
  const abstain = !scorable || confidence < ABSTAIN_FLOOR;
  const explanation=useMemo(()=>Object.entries(domains||{}).map(([k,v])=>({key:k,label:v.label||k,pct:Number(v.pct??((v.pts||0)/(v.max||1)*100)),pts:v.pts,max:v.max})).sort((a,b)=>b.pct-a.pct),[domains]);
  const val=useMemo(()=>metrics(rows,cfg),[rows,cfg]);
  const pop=useMemo(()=>population(rows,cfg),[rows,cfg]);
  const axes=useMemo(()=>({sex:rows.some(r=>r.sex!=null),gender:rows.some(r=>r.gender!=null)}),[rows]);
  const [axis,setAxis]=useState("sex");
  // Fall back to whichever axis the data actually has rather than reporting an
  // empty table — but the choice is always shown, never implied.
  const activeAxis=axes[axis]?axis:(axes.sex?"sex":axes.gender?"gender":axis);
  const fair=useMemo(()=>fairness(rows,cfg,FAIRNESS_POLICY,activeAxis),[rows,cfg,activeAxis]);
  const dq=useMemo(()=>dataQuality(rows,cfg),[rows,cfg]);

  /*  §11 deployment gate.

      The proposal's wording is "the model ... is rejected if audits show it widens
      disparities". A FAIL verdict IS that showing, so the model's output is withheld
      rather than annotated — which also brings this in line with the rest of the
      codebase, where coverage, red flags, and missing labels all gate rather than warn.

      Two deliberate limits:

      FAIL only. INCONCLUSIVE and NOT ASSESSABLE do not gate. Blocking on those would
      mean the model can never run until a large validated cohort exists, which is a
      stricter rule than §11 states and would turn the gate into theatre nobody could
      ship behind. "Audits show" means audits showed something.

      The MODEL, not the instrument. The MASQUE index is a transparent rule-based sum
      a clinician can inspect and re-derive by hand; the calibrated probability is what
      §11 calls the model. So the gate withholds the probability and the FLAG/NO FLAG
      decision, and leaves the index visible. Suppressing the index would remove
      information the clinician can verify independently of any model.
  */
  const fairnessGate = fair.overall === "FAIL";
  const withheld = abstain || fairnessGate;
  const patientClass = abstain
    ? (!scorable ? "Not scorable — attainable range spans a band cutpoint" : "Abstain / collect more data")
    : probability>=cfg.threshold ? `Screen positive for ${cfg.target}` : `Screen negative for ${cfg.target}`;

  async function loadFile(file){
    setError(""); if(!file)return;
    try{
      const text=await file.text(); let parsed;
      if(file.name.toLowerCase().endsWith(".csv")) parsed=parseCsv(text); else parsed=JSON.parse(text);
      // A population-estimates artifact is a finished, design-aware result — not a
      // cohort. It is displayed, never recomputed, and never mixed into `rows`.
      if(parsed&&parsed.masqueArtifact==="population-estimates"){
        setPopArtifact(parsed); setTab("population");
        return;
      }
      const next=normalizeRows(parsed);
      if(!next.length) throw new Error("No rows found. Supply a JSON array, {rows:[...]}, {data:[...]}, or CSV with a header row.");
      setRows(next);setSourceName(file.name);
    }catch(e){setError(e.message||"Could not parse file");}
  }
  const mit=useMemo(()=>equityAdjustment(rows,cfg,FAIRNESS_POLICY,activeAxis),[rows,cfg,activeAxis]);
  const manifest={project,modelVersion,instrumentVersion,generatedAt:new Date().toISOString(),provenance:{dataset:fingerprint(rows,cfg),source:sourceName,deterministic:true,note:"No stochastic component: every figure in this panel is a deterministic function of the rows above and the constants in this file. Re-running on the same fingerprint reproduces the same output."},target:cfg.target,calibration:{...cfg.calibration,threshold:cfg.threshold,status:"illustrative—replace after validation"},requiredCanonicalFields:cfg.expected,acceptedFormats:["CSV","JSON array","JSON {rows:[...]}","JSON {data:[...]}"],sourceAdapters:cfg.sources.map(([name,purpose])=>({name,purpose,status:"ready for mapping; access pending"})),missingDataPolicy:{rule:"Absent values are preserved as null and excluded; they are never imputed to 0, 1, or any other default.",weightDefault:"Rows without a weight default to 1 at computation time only; the field is still reported as missing.",labelRule:"Only an explicit 0 or 1 counts as a reference label. Unlabeled rows are excluded from validation, never scored as negatives."},fairnessPolicy:{...FAIRNESS_POLICY,prespecified:true,passRule:"PASS requires the confidence interval for the disparity to sit entirely below tolerance. Failing to detect a gap in a small sample is INCONCLUSIVE, not a pass.",suppressionRule:"Subgroups below the reporting minimum are shown with their size but without rates; they are excluded from gap calculations rather than silently dropped."},equityMitigation:{status:mit&&!mit.insufficient?"implemented — computed and evaluated on held-out data, proposed but not applied to live output":"implemented — not computable on the loaded cohort",criterion:"equal sensitivity, levelled up to the best-served group",appliedToLiveOutput:false,heldOutEvaluation:true,result:mit&&!mit.insufficient?{axis:mit.axis,target:+mit.target.toFixed(4),sensitivityGap:{before:+(mit.sensGapBefore??0).toFixed(4),after:+(mit.sensGapAfter??0).toFixed(4)},specificityGap:{before:+(mit.specGapBefore??0).toFixed(4),after:+(mit.specGapAfter??0).toFixed(4)},thresholds:mit.thresholds,devN:mit.devN,holdN:mit.holdN}:null,impossibility:"Equal sensitivity, equal specificity, and calibration cannot hold simultaneously across groups with unequal base rates. Closing one gap moves the others; both are reported.",reweighting:"Not implemented and not applicable here: instance reweighting is a fit-time intervention and this model is not fitted — the calibration constants are illustrative. A reweighting control over unlearned constants would be connected to nothing.",legacyStatus:"not implemented",measured:"Subgroup performance, disparity estimates with confidence intervals, and a pass/fail verdict against a pre-specified tolerance.",notImplemented:"Application of the adjustment to live patient-facing output, which is an institutional decision rather than a code change.",rationale:"Measurement precedes mitigation: a disparity cannot be honestly claimed reduced before there is an instrument capable of detecting it. This is a stated sequencing decision, not an oversight."},deploymentGate:{rule:"A FAIL verdict withholds the model probability and the routing decision (proposal \u00a711). INCONCLUSIVE and NOT ASSESSABLE do not gate — \u00a711 conditions rejection on an audit showing a disparity, not on the absence of evidence.",scope:"The calibrated probability and FLAG/NO FLAG decision. The rule-based MASQUE index is not gated.",triggered:fairnessGate,basis:fair.overall,axis:fair.axis},fairnessAudit:{overall:fair.overall,verdicts:Object.fromEntries(Object.entries(fair.verdicts).map(([k,v])=>[k,v.code])),gaps:Object.fromEntries(Object.entries(fair.gaps).map(([k,g])=>[k,g.assessable?{estimate:+g.d.toFixed(4),ci:[+g.lo.toFixed(4),+g.hi.toFixed(4)],high:g.high,low:g.low,groupsUsed:g.groupsUsed}:{assessable:false,groupsUsed:g.groupsUsed}])),suppressedGroups:fair.suppressedGroups},cohortState:{rows:dq.rows,labeled:dq.labeled,unlabeled:dq.unlabeled,scored:dq.scored,unparsedByField:Object.fromEntries(Object.entries(dq.unparsed).filter(([,c])=>c>0)),source:sourceName}};
  const unparsedFields=Object.entries(dq.unparsed).filter(([,c])=>c>0);
  const psy=useMemo(()=>internalConsistency(rows,itemIds),[rows,itemIds]);
  const cal=useMemo(()=>calibration(rows,cfg),[rows,cfg]);
  const rep=useMemo(()=>repeatMeasures(rows),[rows]);
  const modelCard={...manifest,intendedUse:"Screening and referral decision support only; not a diagnosis.",currentPatientOutput:{score,band,scorable,coverage:Math.round(Number(coverage||0)),attainableRange:scorable||ceiling==null?null:[Math.round(score),Math.round(ceiling)],probability:scorable?+probability.toFixed(4):null,probabilityRange:scorable||probCeiling==null?null:[+probability.toFixed(4),+probCeiling.toFixed(4)],confidence:+confidence.toFixed(4),abstainFloor:ABSTAIN_FLOOR,abstain,phenotype,sex,gender},knownLimitations:["Calibration constants are illustrative until fit on approved data.","An incomplete screen yields no band and no probability; unanswered items are never scored as negatives.","Demo rows are synthetic and must not be reported as study results.","Validation metrics are withheld entirely when no row carries an explicit 0/1 reference label.","Subgroup metrics require sufficient labeled observations in every reported group; groups below the minimum are suppressed, not dropped.","Sex and gender are separate axes; a fairness result is only valid for the axis it was computed on, and rows missing that field are excluded from stratification rather than pooled into an unknown group.","Clinical reference labels must come from the proposal-specified validated instruments and clinician reference standard."],fairnessAxis:{stratifiedBy:fair.axis,available:axes,groupsReported:fair.groups.filter(g=>!g.suppressed).length,groupsSuppressed:fair.suppressedGroups,rowsWithoutAxisValue:fair.notRecorded},safety:{redFlags,decisionRule:"Red flags and acute safety concerns override a negative screen."}};

  return <div className="rrp">
    <style>{CSS}</style>
    <div className="rrp-head"><div className="rrp-mark"><BarChart3 size={18}/></div><div><div className="rrp-title">{cfg.title}</div><div className="rrp-sub">Data-ready scaffolding · calibrated outputs · validation · fairness · population/cost analytics</div></div><div className="rrp-spacer"/><span className="rrp-badge">model {modelVersion}</span></div>
    <div className="rrp-tabs">
      {[["risk","Risk & explanation",Gauge],["data","Data ingestion",Database],["validation","Validation",ClipboardCheck],["fairness","Fairness",Scale],["population","Population & cost",BarChart3],["model","Model card",FileJson]].map(([id,l,I])=><button key={id} className={`rrp-tab${tab===id?" on":""}`} onClick={()=>setTab(id)}><I size={12} style={{verticalAlign:"-2px",marginRight:5}}/>{l}</button>)}
    </div>

    {tab==="risk"&&<>
      <div className="rrp-grid">
        <K label="Current score" value={scorable||ceiling==null?`${Math.round(score)}/100`:`${Math.round(score)}–${Math.round(ceiling)}`} detail={scorable?band:"attainable range / 100"}/>
        <K label="Calibrated probability" value={fairnessGate?"withheld":scorable||probCeiling==null?pct(probability):`${pct(probability)}–${pct(probCeiling)}`} detail={fairnessGate?"fairness gate — see below":"illustrative until fitted"}/>
        <K label="Output confidence" value={pct(confidence)} detail={signalQuality==null?`coverage ${Math.round(coverage)}% · no signal-quality input`:`coverage ${Math.round(coverage)}% · quality ${pct(signalQuality)}`}/>
        <K label="Decision" value={redFlags?.length?"OVERRIDE":fairnessGate?"WITHHELD":abstain?"ABSTAIN":probability>=cfg.threshold?"FLAG":"NO FLAG"} detail={redFlags?.length?"Red flag — model routing withheld":fairnessGate?"Model rejected on this cohort (§11)":patientClass}/>
      </div>
      {fairnessGate&&<div className="rrp-call rrp-danger"><b>Model output withheld — fairness gate.</b> The audit on the loaded cohort returned FAIL: at least one disparity exceeds its pre-specified tolerance across the whole confidence interval. Proposal §11 commits that the model is rejected when an audit shows it widens disparities, so the probability and the routing decision are withheld rather than flagged. The MASQUE index above is unaffected — it is a rule-based sum the clinician can re-derive, not the model. Address the disparity or narrow the cohort; the gate clears when the audit does.</div>}
      {abstain&&!fairnessGate&&<div className="rrp-call rrp-warn"><b>Graceful abstention:</b> {!scorable
        ? "the answered items do not yet pin the index into a single band, so no probability is issued. Unanswered items are not treated as negatives, and this is not a negative screen."
        : `output confidence is below the ${pct(ABSTAIN_FLOOR)} floor — collect more required inputs or improve signal quality before using the result for routing.`}</div>}
      {redFlags?.length>0&&<div className="rrp-call rrp-danger"><b>Safety override:</b> {redFlags.join(" · ")}. Escalate regardless of the model probability.</div>}
      <div className="rrp-call"><b>Transparent explanation.</b> The current prototype uses domain contributions rather than opaque feature attribution. When a trained model is connected, this panel can accept SHAP/permutation contributions through the same normalized explanation structure.</div>
      <div style={{marginTop:10}}>{explanation.length?explanation.map(x=><div className="rrp-row" key={x.key}><div className="rrp-l">{x.label}</div><div className="rrp-track"><div className="rrp-fill" style={{width:`${clamp(x.pct/100)*100}%`}}/></div><div className="rrp-n">{x.pts!=null?`${x.pts}/${x.max}`:`${Math.round(x.pct)}%`}</div></div>):<div className="rrp-small">No domain contributions available yet.</div>}</div>
    </>}

    {tab==="data"&&<>
      <div className="rrp-upload" onClick={()=>fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&fileRef.current?.click()}><Upload size={22}/><div style={{fontWeight:650,marginTop:5}}>Load CSV or JSON cohort data</div><div className="rrp-small">Current source: {sourceName}. Imported data remains in the browser.</div><input ref={fileRef} hidden type="file" accept=".csv,.json,application/json,text/csv" onChange={e=>loadFile(e.target.files?.[0])}/></div>
      {error&&<div className="rrp-call rrp-danger">{error}</div>}
      <div className="rrp-grid" style={{marginTop:10}}><K label="Rows" value={dq.rows}/><K label="Columns" value={dq.columns.length}/><K label="Duplicates" value={dq.duplicateCount}/><K label="Reference labels" value={dq.labeled?`${dq.labeled} of ${dq.rows}`:"None"} detail={dq.labeled?"rows with an explicit 0/1":"no rows carry a binary label"}/></div>
      {unparsedFields.length>0&&<div className="rrp-call rrp-warn"><b>Present but unreadable:</b> {unparsedFields.map(([k,c])=>`${k} (${c} row${c===1?"":"s"})`).join(", ")}. These columns exist in the source but did not parse to the expected type, so they are treated as missing rather than as zeros. Check for text codes where a number or a 0/1 is expected.</div>}
      <div className="rrp-call"><b>Canonical adapter fields:</b> {cfg.expected.join(", ")}. Source-specific names can be mapped to these fields without changing the clinical apps.</div>
      <table className="rrp-table"><thead><tr><th>Source adapter</th><th>Purpose</th><th>Status</th></tr></thead><tbody>{cfg.sources.map(([n,p])=><tr key={n}><td>{n}</td><td>{p}</td><td className="rrp-mid">Access/mapping pending</td></tr>)}</tbody></table>
      <details style={{marginTop:10}}><summary>Missingness by canonical field</summary><div style={{marginTop:8}}>{Object.entries(dq.missing).map(([k,v])=><div className="rrp-row" key={k}><div className="rrp-l">{k}{dq.unparsed[k]?<span className="rrp-small"> · {dq.unparsed[k]} unreadable</span>:null}</div><div className="rrp-track"><div className="rrp-fill" style={{width:`${v*100}%`}}/></div><div className="rrp-n">{pct(v)}</div></div>)}</div>
        <div className="rrp-small" style={{marginTop:8}}>Absent values are never imputed. A missing label is not a negative case and a missing cost is not $0 — both are excluded from the metrics below rather than counted as zeros.</div></details>
      <div className="rrp-btnrow"><button className="rrp-btn ghost" onClick={()=>downloadJson(`${project.toLowerCase()}-ingestion-manifest.json`,manifest)}><Download size={14}/> Manifest</button><button className="rrp-btn ghost" onClick={()=>{setRows(normalizeRows(cfg.demo));setSourceName("illustrative demo rows")}}><Activity size={14}/> Restore demo</button>
        {capturedRows.length>0&&<button className="rrp-btn" onClick={()=>{setRows(normalizeRows(capturedRows));setSourceName(`${capturedRows.length} screen${capturedRows.length===1?"":"s"} captured this session`)}}><Activity size={14}/> Load {capturedRows.length} captured screen{capturedRows.length===1?"":"s"}</button>}</div>
      {capturedRows.length>0&&<div className="rrp-call"><b>{capturedRows.length} screen{capturedRows.length===1?"":"s"} captured this session.</b> Loading them will report zero labeled rows and withhold validation metrics — correctly. A screen has no reference standard until the follow-up diagnosis is recorded in the <code>reference_diagnosis</code> column.</div>}
    </>}

    {tab==="validation"&&<>{val?<><div className="rrp-grid"><K label="Labeled rows" value={`${val.n} of ${dq.rows}`} detail={dq.unlabeled?`${dq.unlabeled} excluded — no reference label`:"all imported rows labeled"}/><K label="Sensitivity" value={pct(val.sensitivity)} detail={ciText(val.sensCI)||`${val.nPos} positive${val.nPos===1?"":"s"}`}/><K label="Specificity" value={pct(val.specificity)} detail={ciText(val.specCI)||`${val.nNeg} negative${val.nNeg===1?"":"s"}`}/><K label="PPV" value={pct(val.ppv)}/><K label="NPV" value={pct(val.npv)}/><K label="AUROC" value={num(val.auc,2)}/><K label="Brier score" value={num(val.brier,3)} detail="conflates calibration and discrimination"/><K label="Accuracy" value={pct(val.accuracy)}/></div><CalibrationBlock cal={cal}/><RepeatBlock rep={rep}/><div className="rrp-call rrp-warn"><b>Not study results:</b> these metrics currently use illustrative rows. They become meaningful only after importing approved records with proposal-defined reference labels.</div></>
      :<div className="rrp-call rrp-danger"><b>No validation metrics issued.</b> {dq.rows===0
        ? "No rows are loaded."
        : dq.unparsed.label
          ? `${dq.rows} row${dq.rows===1?"":"s"} loaded, but the label column did not parse to 0/1 in ${dq.unparsed.label} of them. Metrics are withheld rather than computed against imputed negatives.`
          : `${dq.rows} row${dq.rows===1?"":"s"} loaded, none carrying a binary reference label. Unlabeled rows are not treated as negative cases, so sensitivity, specificity, PPV and AUROC cannot be computed — an unlabeled cohort has no reference standard to be measured against.`}</div>}
      <div style={{marginTop:12}}>
        <div className="rrp-sub" style={{marginBottom:6}}>Internal consistency (proposal §8)</div>
        {!psy
          ? <div className="rrp-call rrp-warn">No item-level columns detected. Import a cohort carrying one column per item id to compute Cronbach's α and item-total correlations — an aggregate <code>score</code> column cannot support psychometrics.</div>
          : psy.insufficient
            ? <div className="rrp-call rrp-warn">{psy.n} complete row{psy.n===1?"":"s"} across {psy.items} item column{psy.items===1?"":"s"} — too few varying items to compute α.{psy.constant?.length?` ${psy.constant.length} item column${psy.constant.length===1?"":"s"} had no variance in this cohort.`:""}</div>
            : <>
              <div className="rrp-grid">
                <K label="Cronbach's α" value={num(psy.alpha,3)} detail={psy.alpha>=0.9?"may indicate redundant items":psy.alpha>=0.7?"acceptable":"below the conventional 0.70 floor"}/>
                <K label="Items used" value={psy.k} detail={psy.constant.length?`${psy.constant.length} excluded — no variance`:"all varying items included"}/>
                <K label="Complete rows" value={psy.n}/>
                <K label="Weakest item-total r" value={num(psy.itemTotal[0]?.r,2)} detail={psy.itemTotal[0]?.id}/>
              </div>
              <details style={{marginTop:10}}><summary>Corrected item-total correlations</summary><div style={{marginTop:8}}>
                {psy.itemTotal.map(t=><div className="rrp-row" key={t.id}><div className="rrp-l">{t.id}</div><div className="rrp-track"><div className="rrp-fill" style={{width:`${Math.max(0,Math.min(1,t.r))*100}%`}}/></div><div className="rrp-n">{num(t.r,2)}</div></div>)}
                <div className="rrp-small" style={{marginTop:8}}>Items correlating below ~0.30 with the rest of the scale are candidates for revision. Reverse-scored discriminators are excluded — α assumes one construct in one direction.</div>
              </div></details>
            </>}
      </div>
      <div className="rrp-call"><b>Planned references:</b> use the validated instruments and clinician reference standards specified in the {project} proposal. Retain held-out testing, threshold locking, calibration assessment, and external checks as separate artifacts.</div>
    </>}

    {tab==="fairness"&&<>{dq.hasGroups?<>
      <div className={"rrp-call "+(fair.overall==="FAIL"?"rrp-danger":fair.overall==="PASS"?"":"rrp-warn")}>
        <b>Fairness audit: {fair.overall}.</b>{" "}
        {fair.overall==="PASS"&&"Every assessable disparity sits below its pre-specified tolerance across the whole confidence interval."}
        {fair.overall==="FAIL"&&"At least one disparity exceeds its pre-specified tolerance across the whole interval. Per the proposal's governance commitment, the model is not fit to deploy on this cohort until this is addressed."}
        {fair.overall==="INCONCLUSIVE"&&"The data cannot yet distinguish an acceptable disparity from an unacceptable one. This is not a pass — it is an unanswered question."}
        {fair.overall==="NOT ASSESSABLE"&&"Fewer than two subgroups meet the reporting minimum, so no disparity can be measured. A single stratum is not a comparison."}
      </div>
      <table className="rrp-table"><thead><tr><th>Group</th><th>N</th><th>Flag rate</th><th>Sensitivity</th><th>Specificity</th></tr></thead>
        <tbody>{fair.groups.map(g=><tr key={g.group}>
          <td>{g.group}</td><td>{g.n}</td>
          {g.suppressed
            ? <td colSpan={3} className="rrp-mid">Suppressed — below the {fair.policy.minGroupN}-row reporting minimum</td>
            : ["selection","sensitivity","specificity"].map(k=><td key={k}>
                {g[k].suppressed
                  ? <span className="rrp-mid">n={g[k].n} &lt; {fair.policy.minCellN}</span>
                  : <>{pct(g[k].p)}<div className="rrp-small">{pct(g[k].lo)}–{pct(g[k].hi)}</div></>}
              </td>)}
        </tr>)}</tbody></table>
      <div className="rrp-btnrow" style={{marginTop:12}}>
        <span className="rrp-small" style={{alignSelf:"center",marginRight:2}}>Stratify by</span>
        {["sex","gender"].map(ax=>(
          <button key={ax} className={"rrp-btn"+(fair.axis===ax?"":" ghost")}
            disabled={!axes[ax]} onClick={()=>setAxis(ax)}
            title={axes[ax]?`Stratify the audit by ${ax}`:`No ${ax} column in this cohort`}>
            {ax}{axes[ax]?"":" — absent"}
          </button>))}
        {fair.notRecorded>0&&<span className="rrp-small" style={{alignSelf:"center"}}>
          {fair.notRecorded} of {rows.length} row{rows.length===1?"":"s"} have no {fair.axis} recorded and are excluded from stratification
        </span>}
      </div>
      <div className="rrp-grid" style={{marginTop:10}}>
        {[["selection","Flag-rate gap","selectionGapTolerance"],["sensitivity","Sensitivity gap","sensitivityGapTolerance"],["specificity","Specificity gap","specificityGapTolerance"]].map(([k,label,tol])=>{
          const g=fair.gaps[k], v=fair.verdicts[k];
          return <K key={k} label={label}
            value={g.assessable?pct(g.d):"—"}
            detail={g.assessable
              ? `95% CI ${pct(g.lo)}–${pct(g.hi)} · tolerance ${pct(fair.policy[tol])} · ${v.code}`
              : `${v.code} — ${g.groupsUsed} reportable group${g.groupsUsed===1?"":"s"}`}/>;
        })}
      </div>
      <MitigationBlock mit={mit} axis={fair.axis}/><div className="rrp-call rrp-warn"><b>How to read this.</b> These results hold for <b>{fair.axis}</b> only — a pass on one axis is not a pass on the other. {TOLERANCE_ATTRIBUTED?"":"The tolerance these verdicts are measured against is unattributed — nobody has signed for it, so treat a PASS as provisional. "}A PASS requires the interval to sit entirely below tolerance — failing to detect a gap in a small sample is INCONCLUSIVE, never a pass. Gaps are max−min across reportable groups, which is biased upward when several groups are compared; intervals are Newcombe hybrid-score intervals built on Kish effective sample sizes, and are an approximation until survey design variables are available. Do not force equal rates when underlying reference prevalence genuinely differs — investigate the cause before reweighting or moving a threshold.</div>
      {fair.suppressedGroups>0&&<div className="rrp-call"><b>{fair.suppressedGroups} group{fair.suppressedGroups===1?"":"s"} suppressed.</b> Small strata are shown with their size but without rates — both because the estimates would be uninformative and because small-cell rates risk re-identification.</div>}
    </>:<div className="rrp-call rrp-warn">Add a <code>sex</code> and/or <code>gender</code> column to enable subgroup reporting. They are audited as separate axes — supplying one does not stand in for the other.</div>}</>}

    {tab==="population"&&<>{popArtifact?<PopulationArtifact art={popArtifact} onClear={()=>setPopArtifact(null)}/>:pop?<><div className="rrp-grid"><K label="Scored rows" value={pop.n} detail={pop.dropped?`${pop.dropped} excluded — no score`:"all imported rows scored"}/><K label="Weighted denominator" value={num(pop.weightedN,1)}/><K label="Screen-positive estimate" value={pct(pop.prevalence)} detail="screening-level, not diagnosed prevalence"/><K label="Mean annual cost" value={pop.annualCostN?money(pop.annualCost):"—"} detail={pop.annualCostN?`from ${pop.annualCostN} row${pop.annualCostN===1?"":"s"}`:"no cost data"}/><K label="Mean avoidable cost" value={pop.avoidableCostN?money(pop.avoidableCost):"—"} detail={pop.avoidableCostN?`from ${pop.avoidableCostN} row${pop.avoidableCostN===1?"":"s"}`:"no cost data"}/><K label="Potential avoidable share" value={pop.annualCostN&&pop.avoidableCostN?pct(pop.avoidableCost/pop.annualCost):"—"}/></div><div className="rrp-call rrp-warn"><b>These are cohort figures, not survey estimates.</b> They are weighted means with no variance estimation — no strata, no PSUs, no design degrees of freedom. Uploading a survey public-use file here would produce a plausible point estimate and no honest interval. For national estimates run <code>etl/masque_population_etl.R</code> and load the artifact it writes; this panel will render it instead of this block.</div><div className="rrp-call"><b>Survey readiness:</b> a <code>weight</code> or <code>survey_weight</code> column is honored; rows without one default to 1 at computation time and are still reported as missing above. Final NHANES/NHIS/MEPS estimates still require their design variables, strata/PSUs, cycle pooling rules, inflation adjustments, and source-specific variance methods.</div></>:<div className="rrp-call rrp-warn">No rows carry a usable score, so no population summary is calculated.</div>}</>}

    {tab==="model"&&<><div className="rrp-btnrow"><button className="rrp-btn" onClick={()=>downloadJson(`${project.toLowerCase()}-model-card.json`,modelCard)}><Download size={14}/> Download model card</button><button className="rrp-btn ghost" onClick={()=>downloadJson(`${project.toLowerCase()}-provenance.json`,manifest.provenance)}><Download size={14}/> Provenance</button><button className="rrp-btn ghost" onClick={()=>navigator.clipboard?.writeText(JSON.stringify(modelCard,null,2))}><Copy size={14}/> Copy JSON</button></div><pre className="rrp-code">{JSON.stringify(modelCard,null,2)}</pre></>}

    <div className="rrp-note"><ShieldCheck size={13} style={{flex:"0 0 auto",marginTop:1}}/><span>This layer prepares the apps to ingest future approved data, but it does not turn synthetic/demo outputs into validated evidence. Replace calibration constants, mappings, thresholds, and model cards only through the documented validation and fairness process.</span></div>
  </div>;
}
function MitigationBlock({mit,axis}){
  if(!mit) return null;
  const d=v=>v==null?"—":(v*100).toFixed(1)+"%";
  const delta=(a,b)=>{if(a==null||b==null)return "—";const x=(b-a)*100;return (x>0?"+":"")+x.toFixed(1)+" pts";};
  return <>
    <div className="rrp-sub">Equity mitigation — proposed threshold adjustment (§7.2)</div>
    {mit.insufficient
      ? <div className="rrp-call rrp-warn"><b>Not computable on this cohort.</b> {mit.reason}. Adjustment needs at least two groups with enough positive cases in the development half to estimate a threshold from; {mit.devN} development and {mit.holdN} held-out rows are available.</div>
      : <>
        <div className="rrp-grid">
          <K label="Criterion" value="Equal sensitivity" detail={`levelled up to ${d(mit.target)} — the best-served group, never down`}/>
          <K label={`Sensitivity gap on ${axis}`} value={`${d(mit.sensGapBefore)} → ${d(mit.sensGapAfter)}`}
             detail={mit.reducesTargetGap?"reduced on held-out data":"NOT reduced on held-out data"}/>
          <K label="Specificity gap" value={`${d(mit.specGapBefore)} → ${d(mit.specGapAfter)}`}
             detail={mit.costsSpecificityGap?"widened — this is the trade, not a bug":"unchanged or narrowed"}/>
          <K label="Split" value={`${mit.devN} / ${mit.holdN}`} detail="development / held-out, deterministic by subject"/>
        </div>
        <table className="rrp-table"><thead><tr><th>Group</th><th>Threshold</th><th>Sensitivity</th><th>Specificity</th><th>Held-out n</th></tr></thead><tbody>
          {mit.report.map((r,i)=><tr key={i}>
            <td>{r.group}{r.thin&&<div className="rrp-small">thin — read with caution</div>}</td>
            <td>{r.threshold.toFixed(3)}<div className="rrp-small">{r.movedBy>0?"+":""}{r.movedBy.toFixed(3)}</div></td>
            <td>{d(r.sensBefore)} → {d(r.sensAfter)}<div className="rrp-small">{delta(r.sensBefore,r.sensAfter)}</div></td>
            <td>{d(r.specBefore)} → {d(r.specAfter)}<div className="rrp-small">{delta(r.specBefore,r.specAfter)}</div></td>
            <td>{r.nHold} ({r.nPosHold} pos)</td></tr>)}
        </tbody></table>
        <div className="rrp-call rrp-warn"><b>Proposed, not applied.</b> These thresholds are computed and evaluated; nothing in the risk tab uses them. Applying group-specific thresholds means making an explicit group-conscious decision at the point of care — that is a clinical, legal, and institutional question, not a setting, and several jurisdictions constrain it. The panel's job is to show what the adjustment would buy and what it would cost, and to leave the decision where it belongs.</div>
        <div className="rrp-call"><b>Why the specificity column matters.</b> With unequal base rates you cannot have equal sensitivity, equal specificity, and calibration at the same time — that is arithmetic, not a tuning problem. Closing the sensitivity gap moves the others, and any tool that shows you only the metric it improved is selling you something.</div>
      </>}
  </>;
}

function CalibrationBlock({cal}){
  if(!cal) return null;
  const arrow=v=>v==null?"—":(v>0?"+":"")+num(v,3);
  return <>
    <div className="rrp-sub">Calibration</div>
    <div className="rrp-grid">
      <K label="Calibration-in-the-large" value={arrow(cal.citl)}
         detail={`predicted ${pct(cal.meanPredicted)} vs observed ${pct(cal.observed)} · 0 is ideal`}/>
      <K label="Calibration slope" value={cal.slope==null?"not estimable":num(cal.slope,2)}
         detail={cal.slope==null
           ? (!cal.estimable?`needs both classes present (${cal.nPos} pos / ${cal.nNeg} neg)`:"regression did not converge")
           : cal.slope<0.9?"below 1 — predictions too extreme":cal.slope>1.1?"above 1 — predictions too conservative":"near 1"}/>
      <K label="Labeled rows" value={cal.n} detail={cal.reliable?"above the reporting minimum":"below the reporting minimum — read as provisional"}/>
    </div>
    <table className="rrp-table"><thead><tr><th>Predicted risk</th><th>Mean predicted</th><th>Observed</th><th>n</th></tr></thead><tbody>
      {cal.bins.map((b,i)=><tr key={i}>
        <td>{pct(b.lo)}–{pct(b.hi)}</td>
        <td>{b.suppressed?<span className="rrp-mid">—</span>:pct(b.predicted)}</td>
        <td>{b.suppressed?<span className="rrp-mid">suppressed</span>:pct(b.observed)}</td>
        <td>{b.n}</td></tr>)}
    </tbody></table>
    <div className="rrp-call rrp-warn"><b>Why this is separate from Brier.</b> A model can lower its Brier score by growing sharper while getting worse at being right about probabilities. §7.2 promises a <i>calibrated</i> classifier, so calibration-in-the-large, the slope, and the reliability table are reported on their own. The table is the one that shows <i>where</i> any miscalibration sits — which is what determines whether a threshold is safe in the range you actually operate in.</div>
  </>;
}

function RepeatBlock({rep}){
  if(!rep) return <div className="rrp-call rrp-warn"><b>No repeat measures.</b> No row carries a <code>subject_id</code>, so test-retest reliability, responsiveness, and MCID validation cannot be computed. Screens captured by the screener carry one; imported cohorts need the column added.</div>;
  return <>
    <div className="rrp-sub">Repeat measures</div>
    <div className="rrp-grid">
      <K label="Subjects" value={rep.subjects} detail={`${rep.repeated} with ≥2 administrations · ${rep.singleAdministration} with one`}/>
      <K label="Test-retest r" value={rep.reportable&&rep.retestR!=null?num(rep.retestR,2):"—"}
         detail={rep.reportable?"first vs last administration":`needs more repeated subjects (${rep.repeated} so far)`}/>
      <K label="Mean change" value={rep.reportable&&rep.meanDelta!=null?(rep.meanDelta>0?"+":"")+num(rep.meanDelta,1):"—"}
         detail={rep.sdDelta!=null?`SD ${num(rep.sdDelta,1)} points`:"—"}/>
      <K label="Smallest detectable change" value={rep.minChangeDetectable!=null?"±"+num(rep.minChangeDetectable,1):"—"}
         detail="95% — change below this is measurement noise"/>
    </div>
    <div className="rrp-call rrp-warn"><b>Stability is a protocol property, not a data property.</b> A test-retest correlation only means reliability if nothing clinically changed between the two administrations, and no field in this schema can establish that. Read this figure only against a protocol that fixed the interval and confirmed stability; otherwise it is measuring change, not error.</div>
  </>;
}

function K({label,value,detail}){return <div className="rrp-kpi"><div className="rrp-k">{label}</div><div className="rrp-v">{value}</div>{detail&&<div className="rrp-small">{detail}</div>}</div>}
