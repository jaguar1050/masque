import React, { useMemo, useState } from "react";
import {
  Activity, TriangleAlert, ShieldCheck, Check, ArrowLeft, ArrowRight, Stethoscope,
  FlaskConical, Users, FileText, Info, RotateCcw, Play, Zap, Ban, ScanLine,
} from "lucide-react";

/*  MASQUE — interactive simulation, release 0.3.0 · instrument 0.2

    A condensed but behaviourally faithful build of the three MASQUE apps and the
    shared research panel, in one file so it runs in a chat artifact.

    FAITHFUL: the item set (all 30 ids, weights, scales, and the four negative-weight
    discriminators), band cutpoints, the attainable-range coverage gate, all twelve
    red flags and their tiers, the no-imputation ingestion rule, the fairness audit
    with minimum cell sizes and Newcombe intervals, the §11 deployment gate,
    calibration-in-the-large and slope, and the equity threshold adjustment.

    CONDENSED: FHIR bundle construction, the ambient-capture lexicon (a small subset
    runs here), cohort CSV export, the model card JSON, and the population artifact
    renderer. Those are unchanged in the release and not what a click-through tests.

    The probe rail is not in the real apps. It exists because this codebase is
    defined by what it refuses to do, and a refusal you cannot reach is a refusal
    you cannot check.
*/

const INSTRUMENT_VERSION = "0.2";
const RELEASE = "0.3.0";

// ---------------------------------------------------------------- instrument
const ITEMS = {
  recalcitrance: { label: "Recalcitrance", max: 15, items: [
    { id: "r_dur", w: 3, t: "Symptoms persisting or recurring > 3 months" },
    { id: "r_abx", w: 3, t: "≥2 antibiotic/steroid courses without lasting relief" },
    { id: "r_surg", w: 3, t: "Prior sinus procedure without resolution" },
    { id: "r_lesion", w: 3, t: "Recurrent dizziness/aural symptoms, no structural lesion" },
    { id: "r_normal", w: 3, t: "Exam or imaging normal relative to symptom burden" },
  ]},
  migraine: { label: "Migrainous", max: 30, items: [
    { id: "m_head", w: 6, t: "Recurrent headache / mid-facial pressure episodes", scale: ["Never","Sometimes","Often"] },
    { id: "m_dur", w: 4, t: "Untreated attack duration 4–72 h (ICHD-3 1.1 B)", scale: ["None","<4 h","4–72 h",">72 h","Varies"] },
    { id: "m_photo", w: 4, t: "Photophobia and/or phonophobia during episodes" },
    { id: "m_nausea", w: 4, t: "Nausea with episodes" },
    { id: "m_disable", w: 3, t: "Episodes limit normal activity" },
    { id: "m_aura", w: 3, t: "Visual aura or transient neurologic symptoms" },
    { id: "m_trig", w: 3, t: "Identifiable triggers (weather, sleep, meals, hormonal)" },
    { id: "m_fhx", w: 3, t: "Personal or family history of migraine" },
  ]},
  vestibular: { label: "Otologic / vestibular", max: 25, items: [
    { id: "v_vertigo", w: 6, t: "Episodic vertigo 5 min – 72 h (Bárány VM B)", scale: ["None","<5 min","5 min–72 h",">72 h"] },
    { id: "v_count", w: 4, t: "≥5 vestibular episodes to date (Bárány VM A)" },
    { id: "v_migfeat", w: 4, t: "Migrainous features in ≥50% of episodes (Bárány VM C)" },
    { id: "v_motion", w: 4, t: "Motion / visual-motion sensitivity" },
    { id: "v_aural", w: 4, t: "Fluctuating aural fullness or tinnitus with episodes" },
    { id: "v_head", w: 3, t: "Head-motion or positional intolerance" },
  ]},
  neuro: { label: "Neuropathic", max: 15, items: [
    { id: "n_burn", w: 4, t: "Burning / tingling / shooting facial, oral or throat sensations" },
    { id: "n_otalgia", w: 3, t: "Deep ear or throat pain with normal ear exam" },
    { id: "n_auto", w: 3, t: "Autonomic symptoms (sicca, orthostatic, sudomotor, GI)" },
    { id: "n_viral", w: 3, t: "Onset following viral illness" },
    { id: "n_allo", w: 2, t: "Sensitivity out of proportion to exam" },
  ]},
  impact: { label: "Impact", max: 15, items: [
    { id: "i_days", w: 8, t: "Days per month affected", scale: ["None","1–3","4–9","10+"] },
    { id: "i_role", w: 7, t: "Impact on work or daily roles", scale: ["None","Mild","Moderate","Severe"] },
  ]},
  discriminators: { label: "Discriminators (rule-out)", max: 0, negative: true, items: [
    { id: "x_purulent", w: -8, t: "Purulent drainage or positive sinus culture when symptomatic" },
    { id: "x_objective", w: -8, t: "Objective sinus inflammation on endoscopy/CT when symptomatic" },
    { id: "x_lowfreq", w: -8, t: "Audiometric fluctuating low-frequency SNHL" },
    { id: "x_anosmia", w: -5, t: "Persistent hyposmia between episodes" },
  ]},
};
const ORDER = ["recalcitrance","migraine","vestibular","neuro","impact","discriminators"];
const ALL = ORDER.flatMap(k => ITEMS[k].items.map(i => ({ ...i, domain: k })));
const CUTS = { moderate: 34, high: 67 };
const bandFor = v => v >= CUTS.high ? "high" : v >= CUTS.moderate ? "moderate" : "low";

function scoreItem(it, v) {
  if (v === undefined) return 0;
  if (it.scale) return (Number(v) / (it.scale.length - 1)) * it.w;
  return v === "yes" ? it.w : 0;
}

/*  The coverage gate. Positive items can only ADD and discriminators can only
    SUBTRACT, so unanswered items bound the index from both sides. A band is
    reported only when the whole attainable range sits inside one band.  */
function useScore(a) {
  return useMemo(() => {
    const domains = {}; let total = 0, up = 0, down = 0, answered = 0;
    const open = [];
    for (const k of ORDER) {
      let sum = 0, dOpen = 0;
      for (const it of ITEMS[k].items) {
        if (a[it.id] === undefined) {
          if (it.w > 0) up += it.w; else down += it.w;
          dOpen += Math.abs(it.w); open.push({ ...it, domainLabel: ITEMS[k].label });
        } else { answered++; sum += scoreItem(it, a[it.id]); }
      }
      sum = Math.round(sum * 10) / 10;
      domains[k] = { pts: sum, max: ITEMS[k].max, label: ITEMS[k].label, openPts: dOpen, neg: !!ITEMS[k].negative };
      total += sum;
    }
    total = Math.max(0, Math.min(100, Math.round(total)));
    const floor = Math.max(0, Math.min(100, Math.round(total + down)));
    const ceil = Math.max(0, Math.min(100, Math.round(total + up)));
    const coverage = Math.round((answered / ALL.length) * 100);
    const scorable = bandFor(floor) === bandFor(ceil);
    return { domains, total, floor, ceiling: ceil, coverage, scorable, answered,
      band: scorable ? bandFor(floor) : "indeterminate",
      open: open.sort((x, y) => Math.abs(y.w) - Math.abs(x.w)) };
  }, [a]);
}

// ---------------------------------------------------------------- red flags
const RED_FLAGS = [
  { id:"rf_thunderclap", tier:"emergent", group:"Neurologic", t:"Headache reaching maximum intensity within seconds to a minute", p:"Subarachnoid haemorrhage / vascular event", act:"Emergency imaging today" },
  { id:"rf_focal", tier:"emergent", group:"Neurologic", t:"New focal deficit — weakness, numbness, speech change, persistent diplopia", p:"Central or cranial-nerve lesion", act:"Emergency neurologic evaluation" },
  { id:"rf_vision", tier:"emergent", group:"Neurologic", t:"Progressive vision loss or transient visual obscurations", p:"Raised intracranial pressure / IIH", act:"Same-day fundoscopy and imaging" },
  { id:"rf_gca", tier:"emergent", group:"Systemic", t:"Age over 50 with scalp tenderness or jaw claudication", p:"Giant cell arteritis", act:"Same-day ESR/CRP — do not wait for biopsy" },
  { id:"rf_orbital", tier:"emergent", group:"Systemic", t:"Orbital swelling, proptosis, or restricted eye movement", p:"Orbital complication / invasive fungal disease", act:"Emergency ENT and imaging" },
  { id:"rf_ssnhl", tier:"emergent", group:"Otologic", t:"Hearing dropped over hours to a day within the last 30 days", p:"Sudden SNHL — a closing steroid window", act:"Same-day audiogram" },
  { id:"rf_asym", tier:"urgent", group:"Otologic", t:"Hearing loss or tinnitus consistently in one ear only", p:"Retrocochlear lesion / vestibular schwannoma", act:"MRI internal auditory canals" },
  { id:"rf_pulsatile", tier:"urgent", group:"Otologic", t:"Tinnitus pulsing in time with the heartbeat", p:"Vascular lesion or raised ICP", act:"Vascular imaging" },
  { id:"rf_progressive", tier:"urgent", group:"Neurologic", t:"Headache worsening, or worse on waking, coughing, or lying flat", p:"Raised ICP / mass lesion", act:"Neuro-imaging" },
  { id:"rf_new50", tier:"urgent", group:"Neurologic", t:"First-ever severe headache beginning after age 50", p:"Secondary headache until proven otherwise", act:"Imaging and inflammatory markers" },
  { id:"rf_mass", tier:"urgent", group:"Sinonasal", t:"One-sided obstruction with bleeding or new facial numbness", p:"Sinonasal or skull-base malignancy", act:"Endoscopy and imaging" },
  { id:"rf_systemic", tier:"urgent", group:"Systemic", t:"Fever, night sweats, weight loss, or immunosuppression", p:"Infection, inflammatory or metastatic disease", act:"Directed workup first" },
];
const RF_GROUPS = [...new Set(RED_FLAGS.map(f => f.group))];

// ---------------------------------------------------------------- panel math
const POLICY = { minGroupN: 30, minCellN: 10, tol: 0.10, z: 1.959963985 };
const CFG = { midpoint: 48, slope: 0.075, threshold: 0.5 };
const logistic = s => 1 / (1 + Math.exp(-CFG.slope * (Number(s || 0) - CFG.midpoint)));
const isLabeled = r => r.label === 0 || r.label === 1;

/*  No-imputation ingestion: a missing value stays null. It is never coerced to 0,
    because an absent label is not a negative case.  */
function normalize(raw) {
  const num = v => (v === null || v === undefined || v === "" ? null : Number(v));
  const str = v => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim().toLowerCase());
  return raw.map(r => ({
    score: num(r.score), label: num(r.label),
    sex: str(r.sex), gender: str(r.gender),
    subject_id: str(r.subject_id), captured_at: str(r.captured_at),
    weight: num(r.weight) ?? 1,
  }));
}
function wilson(k, n) {
  if (!n) return [null, null];
  const p = k / n, z = POLICY.z, d = 1 + z*z/n;
  const c = (p + z*z/(2*n)) / d, h = z*Math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / d;
  return [Math.max(0, c-h), Math.min(1, c+h)];
}
/*  Newcombe hybrid-score interval for a difference of proportions.

    The caller orders the groups so the higher rate is `a`, which makes d >= 0 and
    lets the signed bounds be used directly. Taking absolute values of each bound
    instead would inflate the lower limit whenever the interval crosses zero, and a
    lower limit is exactly what the FAIL rule tests — a comparable cohort would be
    judged to have a disparity it does not have.
*/
function newcombe(a, b) {
  const pa = a.k/a.n, pb = b.k/b.n;
  const [l1,u1] = wilson(a.k, a.n), [l2,u2] = wilson(b.k, b.n);
  const d = pa - pb;
  return { d,
    lo: Math.max(-1, d - Math.sqrt((pa-l1)**2 + (u2-pb)**2)),
    hi: Math.min( 1, d + Math.sqrt((u1-pa)**2 + (pb-l2)**2)) };
}

function fairness(rows, axis) {
  const on = rows.filter(r => r[axis] != null && Number.isFinite(r.score));
  const notRecorded = rows.length - on.length;
  const names = [...new Set(on.map(r => r[axis]))].sort();
  const flagged = r => logistic(r.score) >= CFG.threshold;
  const groups = names.map(g => {
    const all = on.filter(r => r[axis] === g);
    const lab = all.filter(isLabeled);
    const pos = lab.filter(r => r.label === 1), neg = lab.filter(r => r.label === 0);
    return { group: g, n: all.length,
      sel: { k: all.filter(flagged).length, n: all.length },
      sens: { k: pos.filter(flagged).length, n: pos.length },
      spec: { k: neg.filter(r => !flagged(r)).length, n: neg.length },
      suppressed: all.length < POLICY.minGroupN };
  });
  const usable = groups.filter(g => !g.suppressed);
  const gapOf = key => {
    const el = usable.filter(g => g[key].n >= POLICY.minCellN);
    if (el.length < 2) return { assessable: false };
    const rates = el.map(g => ({ ...g, p: g[key].k / g[key].n })).sort((a,b) => b.p - a.p);
    const hi = rates[0], lo = rates[rates.length-1];
    const nc = newcombe(hi[key], lo[key]);
    return { assessable: true, ...nc, high: hi.group, low: lo.group };
  };
  const gaps = { selection: gapOf("sel"), sensitivity: gapOf("sens"), specificity: gapOf("spec") };
  const verdict = g => !g.assessable ? "NOT ASSESSABLE"
    : g.hi <= POLICY.tol ? "PASS"
    : g.lo > POLICY.tol ? "FAIL" : "INCONCLUSIVE";
  const verdicts = Object.fromEntries(Object.entries(gaps).map(([k,v]) => [k, verdict(v)]));
  const vals = Object.values(verdicts);
  const overall = vals.includes("FAIL") ? "FAIL"
    : vals.every(v => v === "PASS") ? "PASS"
    : vals.includes("INCONCLUSIVE") ? "INCONCLUSIVE" : "NOT ASSESSABLE";
  return { groups, gaps, verdicts, overall, axis, notRecorded, onN: on.length };
}

function calibration(rows) {
  const u = rows.filter(r => isLabeled(r) && Number.isFinite(r.score));
  if (!u.length) return null;
  const eps = 1e-6;
  const pts = u.map(r => { const p = Math.min(1-eps, Math.max(eps, logistic(r.score)));
    return { p, y: r.label, l: Math.log(p/(1-p)) }; });
  const meanP = pts.reduce((a,q) => a+q.p, 0) / pts.length;
  const obs = pts.reduce((a,q) => a+q.y, 0) / pts.length;
  const nPos = pts.filter(q => q.y === 1).length, nNeg = pts.length - nPos;
  let b0 = 0, b1 = 1, ok = false;
  const estimable = nPos >= POLICY.minCellN && nNeg >= POLICY.minCellN;
  if (estimable) for (let it = 0; it < 60; it++) {
    let g0=0,g1=0,h00=0,h01=0,h11=0;
    for (const q of pts) { const mu = 1/(1+Math.exp(-(b0+b1*q.l))), v = mu*(1-mu), res = q.y-mu;
      g0+=res; g1+=res*q.l; h00+=v; h01+=v*q.l; h11+=v*q.l*q.l; }
    const det = h00*h11-h01*h01; if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
    const da = (h11*g0-h01*g1)/det, db = (-h01*g0+h00*g1)/det;
    b0+=da; b1+=db; if (Math.abs(da)<1e-9 && Math.abs(db)<1e-9) { ok = true; break; }
  }
  const edges = [0,.2,.4,.6,.8,1.0001];
  const bins = edges.slice(0,-1).map((lo,i) => {
    const inb = pts.filter(q => q.p >= lo && q.p < edges[i+1]);
    return { lo, hi: Math.min(1, edges[i+1]), n: inb.length,
      pred: inb.length ? inb.reduce((a,q)=>a+q.p,0)/inb.length : null,
      obs: inb.length ? inb.reduce((a,q)=>a+q.y,0)/inb.length : null,
      suppressed: inb.length < POLICY.minCellN };
  });
  return { n: u.length, nPos, nNeg, meanP, obs, citl: meanP - obs,
    slope: ok ? b1 : null, estimable, bins };
}

function equityAdjust(rows, axis) {
  const u = rows.filter(r => isLabeled(r) && Number.isFinite(r.score) && r[axis] != null);
  if (!u.length) return null;
  const hash = (s, i) => { let h = 0x811c9dc5; const t = String(s ?? `row-${i}`);
    for (let k = 0; k < t.length; k++) { h ^= t.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  const dev = [], hold = [];
  u.forEach((r,i) => (hash(r.subject_id, i) % 2 === 0 ? dev : hold).push(r));
  const groups = [...new Set(u.map(r => r[axis]))].sort();
  const sens = (set, thr) => { const p = set.filter(r => r.label===1);
    return p.length ? p.filter(r => logistic(r.score) >= thr).length/p.length : null; };
  const spec = (set, thr) => { const n = set.filter(r => r.label===0);
    return n.length ? n.filter(r => logistic(r.score) < thr).length/n.length : null; };
  const base = groups.map(g => { const rs = dev.filter(r => r[axis]===g);
    return { g, rs, nPos: rs.filter(r=>r.label===1).length, s: sens(rs, CFG.threshold) }; });
  const el = base.filter(x => x.nPos >= POLICY.minCellN && x.s != null);
  if (el.length < 2) return { insufficient: true, devN: dev.length, holdN: hold.length };
  const target = Math.max(...el.map(x => x.s));       // level UP, never down
  const thr = {};
  for (const x of el) {
    const ps = x.rs.filter(r=>r.label===1).map(r=>logistic(r.score)).sort((a,b)=>b-a);
    thr[x.g] = ps[Math.min(Math.max(1, Math.ceil(target*ps.length)), ps.length)-1];
  }
  const rep = el.map(x => { const h = hold.filter(r => r[axis]===x.g);
    return { group: x.g, threshold: thr[x.g], moved: thr[x.g]-CFG.threshold, nHold: h.length,
      sensB: sens(h, CFG.threshold), sensA: sens(h, thr[x.g]),
      specB: spec(h, CFG.threshold), specA: spec(h, thr[x.g]) }; });
  const span = v => { const f = v.filter(Number.isFinite); return f.length>1 ? Math.max(...f)-Math.min(...f) : null; };
  return { insufficient: false, target, devN: dev.length, holdN: hold.length, rep,
    sensGapB: span(rep.map(r=>r.sensB)), sensGapA: span(rep.map(r=>r.sensA)),
    specGapB: span(rep.map(r=>r.specB)), specGapA: span(rep.map(r=>r.specA)) };
}

// ---------------------------------------------------------------- demo data
/*  Deterministic synthetic cohorts.

    Group sizes are not arbitrary. A verdict of PASS requires the whole confidence
    interval to sit inside the 10% tolerance, which at a true gap near zero needs
    roughly 200 rows per group — so the comparable cohort carries 250 each. Sizing it
    smaller would produce INCONCLUSIVE and teach the wrong lesson: that the audit is
    broken, rather than that small cohorts cannot clear a disparity claim.

    Math.imul, not `*`: a plain multiply here exceeds 2^53 and the generator degrades
    into a non-uniform stream, which silently biases every group it fills.
*/
function makeCohort(kind) {
  let s = 7 >>> 0;
  const R = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 4) / 0x10000000; };
  const rows = [];
  const push = (sex, gender, n, hi, labeled) => { for (let i=0;i<n;i++) {
    const y = R() < 0.45 ? 1 : 0;
    rows.push({ score: Math.round(hi ? (y?58+R()*40:12+R()*38) : (y?26+R()*42:6+R()*34)),
      label: labeled ? y : "", sex, gender,
      subject_id: `s-${sex[0]}${gender[0]}${i}`, captured_at: "2026-04-01" });
  } };
  if (kind === "balanced") { push("female","woman",400,true,true); push("male","man",400,true,true); }
  if (kind === "unlabeled") { push("female","woman",400,true,false); push("male","man",400,true,false); }
  if (kind === "disparate") {
    push("female","woman",200,false,true);       // instrument under-detects women
    push("male","man",200,true,true);
    push("female","man",22,false,true);          // axes diverge
    push("male","nonbinary",6,true,true);        // small stratum → suppressed
    rows.push({ score: 61, label: 1, sex: "", gender: "woman", subject_id: "s-x1", captured_at: "2026-04-02" });
  }
  return rows;
}

// ---------------------------------------------------------------- scenarios
const FULL_HIGH = { r_dur:"yes", r_abx:"yes", r_surg:"no", r_lesion:"yes", r_normal:"yes",
  m_head:2, m_dur:2, m_photo:"yes", m_nausea:"yes", m_disable:"yes", m_aura:"no", m_trig:"yes", m_fhx:"yes",
  v_vertigo:2, v_count:"yes", v_migfeat:"yes", v_motion:"yes", v_aural:"yes", v_head:"yes",
  n_burn:"no", n_otalgia:"no", n_auto:"no", n_viral:"no", n_allo:"no", i_days:3, i_role:3,
  x_purulent:"no", x_objective:"no", x_lowfreq:"no", x_anosmia:"no" };

const SCENARIOS = [
  { id:"empty", icon:Ban, label:"Nothing answered",
    why:"The original defect. This used to print “Low likelihood — continue standard ENT management” from zero data.",
    apply:()=>({ answers:{}, rf:{}, safety:true, step:6 }) },
  { id:"partial", icon:ScanLine, label:"Vestibular domain only",
    why:"20% coverage. Used to score 25/100 and report “Low”. Unanswered discriminators can subtract too, so the range is two-sided and spans every band.",
    apply:()=>({ answers:{ v_vertigo:2, v_count:"yes", v_migfeat:"yes", v_motion:"yes", v_aural:"yes", v_head:"yes" }, rf:{}, safety:true, step:6 }) },
  { id:"high", icon:Activity, label:"Complete — high index",
    why:"Fully answered masked-migraine picture. Settles into one band, so routing is issued.",
    apply:()=>({ answers:FULL_HIGH, rf:{}, safety:true, step:6 }) },
  { id:"redflag", icon:TriangleAlert, label:"Same index + one-sided hearing",
    why:"Identical answers, one extra fact. Before the safety gate this referred her for vestibular migraine.",
    apply:()=>({ answers:FULL_HIGH, rf:{ rf_asym:true }, safety:true, step:6 }) },
  { id:"ruleout", icon:Zap, label:"Same index + positive rule-outs",
    why:"Discriminators carry negative weight, so the screen can argue against its own hypothesis.",
    apply:()=>({ answers:{ ...FULL_HIGH, x_objective:"yes", x_purulent:"yes", x_anosmia:"yes" }, rf:{}, safety:true, step:6 }) },
];

// ---------------------------------------------------------------- styles
const CSS = `
.mq *{box-sizing:border-box;margin:0;padding:0}
.mq{--ink:#12302F;--mid:#5E7573;--line:#DCE5E3;--bg:#F1F6F4;--panel:#fff;
  --petrol:#1C6B63;--petrol2:#2A8A80;--coral:#C4553A;--coralbg:#FBEDE9;
  --amber:#B26C1F;--amberbg:#FBF2E2;--green:#2F7D53;--greenbg:#E8F4EC;--slate:#5E7573;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  background:var(--bg);color:var(--ink);min-height:100%;padding:18px;font-size:14px;line-height:1.5}
.mq .wrap{max-width:1080px;margin:0 auto}
.mq .head{display:flex;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.mq .logo{width:38px;height:38px;border-radius:11px;background:var(--petrol);color:#fff;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.mq h1{font-size:19px;font-weight:700;letter-spacing:-.01em}
.mq .vers{font-family:var(--mono);font-size:11px;color:var(--mid);letter-spacing:.04em}
.mq .tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}
.mq .tab{font:inherit;font-size:13.5px;cursor:pointer;border:1px solid var(--line);background:#fff;color:var(--ink);
  border-radius:10px;padding:9px 14px;display:inline-flex;gap:7px;align-items:center;transition:.12s}
.mq .tab:hover{border-color:var(--petrol2)}
.mq .tab.on{background:var(--petrol);border-color:var(--petrol);color:#fff;font-weight:620}
.mq .grid{display:grid;grid-template-columns:1fr 268px;gap:14px;align-items:start}
@media (max-width:880px){.mq .grid{grid-template-columns:1fr}}
.mq .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}
.mq .card+.card{margin-top:12px}
.mq .eyebrow{font-family:var(--mono);font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--mid);margin-bottom:7px}
.mq h2{font-size:17px;margin-bottom:5px;letter-spacing:-.01em}
.mq .sub{font-size:13px;color:var(--mid);margin-bottom:12px}
.mq .q{padding:13px 0;border-top:1px solid var(--line)}
.mq .q:first-of-type{border-top:0}
.mq .qt{font-size:13.5px;margin-bottom:9px;line-height:1.4}
.mq .opts{display:flex;gap:7px;flex-wrap:wrap}
.mq .o{font:inherit;font-size:13px;cursor:pointer;border:1.5px solid var(--line);background:#fff;color:var(--ink);
  border-radius:9px;padding:8px 15px;min-height:38px;transition:.12s}
.mq .o:hover{border-color:var(--petrol2)}
.mq .o.sel{background:var(--petrol);border-color:var(--petrol);color:#fff;font-weight:620}
.mq .o.no.sel{background:var(--slate);border-color:var(--slate)}
.mq .btn{font:inherit;font-size:13.5px;font-weight:620;cursor:pointer;border-radius:10px;padding:10px 17px;
  border:1.5px solid var(--petrol);background:var(--petrol);color:#fff;display:inline-flex;gap:8px;align-items:center}
.mq .btn:hover{background:var(--petrol2);border-color:var(--petrol2)}
.mq .btn.ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.mq .btn:disabled{opacity:.42;cursor:not-allowed}
.mq .nav{display:flex;gap:9px;align-items:center;margin-top:15px}
.mq .readout{display:flex;gap:22px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px}
.mq .cap{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--mid);margin-bottom:3px}
.mq .score{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:600;font-size:56px;line-height:.92;letter-spacing:-.03em}
.mq .range{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:600;font-size:40px;line-height:.95;letter-spacing:-.03em}
.mq .range .sp{font-size:26px;color:var(--mid);padding:0 3px}
.mq .meter{position:relative;height:13px;border-radius:7px;overflow:hidden;display:flex;margin:11px 0 4px;background:var(--line)}
.mq .z{height:100%}
.mq .needle{position:absolute;top:-4px;width:3px;height:21px;background:var(--ink);border-radius:2px;transform:translateX(-1.5px);transition:left .45s cubic-bezier(.2,.7,.2,1)}
.mq .rband{position:absolute;top:0;height:100%;border-left:2px solid var(--ink);border-right:2px solid var(--ink);
  background:repeating-linear-gradient(135deg,rgba(12,43,47,.30) 0 4px,rgba(12,43,47,.09) 4px 9px);transition:left .45s ease,width .45s ease}
.mq .ticks{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;color:var(--mid)}
.mq .pill{display:inline-flex;gap:7px;align-items:center;border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:620}
.mq .call{border-radius:11px;padding:12px 14px;margin-top:11px;font-size:12.5px;background:#F3F8F7;border:1px solid var(--line)}
.mq .call.warn{background:var(--amberbg);border-color:#E4C88E;color:#6B4A18}
.mq .call.bad{background:var(--coralbg);border-color:var(--coral);color:#6E3020}
.mq .call b{display:inline}
.mq .rf{border:1px solid var(--line);border-radius:10px;padding:11px 13px;margin-top:7px;background:#fff;display:flex;gap:10px;align-items:flex-start;cursor:pointer;transition:.12s}
.mq .rf:hover{border-color:#C98476}
.mq .rf.on{border-color:var(--coral);background:#FDF4F1;box-shadow:inset 0 0 0 1px var(--coral)}
.mq .box{width:19px;height:19px;border-radius:5px;border:1.5px solid #B7C4C2;flex:0 0 auto;margin-top:1px;display:flex;align-items:center;justify-content:center;background:#fff;color:#fff}
.mq .rf.on .box{background:var(--coral);border-color:var(--coral)}
.mq .rft{font-size:13px;line-height:1.35}
.mq .rfm{font-size:11.5px;color:var(--mid);margin-top:3px}
.mq .tier{font-family:var(--mono);font-size:9px;letter-spacing:.07em;text-transform:uppercase;border-radius:5px;padding:2px 6px;margin-left:6px;white-space:nowrap}
.mq .tier.emergent{background:var(--coralbg);color:#8E3520}
.mq .tier.urgent{background:var(--amberbg);color:#7A4E12}
.mq .gname{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--mid);margin:14px 0 2px}
.mq .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:9px;margin:11px 0}
.mq .k{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#FAFCFB}
.mq .kl{font-family:var(--mono);font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--mid)}
.mq .kv{font-size:19px;font-weight:660;margin-top:3px;font-variant-numeric:tabular-nums}
.mq .kd{font-size:11px;color:var(--mid);margin-top:2px;line-height:1.35}
.mq table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px}
.mq th{text-align:left;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mid);padding:6px 8px;border-bottom:1px solid var(--line)}
.mq td{padding:7px 8px;border-bottom:1px solid #EEF3F2;vertical-align:top}
.mq .small{font-size:11px;color:var(--mid)}
.mq .rail{position:sticky;top:14px}
.mq .probe{width:100%;text-align:left;font:inherit;font-size:12.5px;cursor:pointer;border:1px solid var(--line);
  background:#fff;border-radius:10px;padding:10px 12px;margin-top:7px;display:flex;gap:9px;align-items:flex-start;transition:.12s}
.mq .probe:hover{border-color:var(--petrol2);transform:translateX(2px)}
.mq .probe.on{border-color:var(--petrol);box-shadow:inset 0 0 0 1px var(--petrol)}
.mq .probe .pl{font-weight:620;line-height:1.3}
.mq .probe .pw{font-size:11px;color:var(--mid);margin-top:3px;line-height:1.4}
.mq .verdict{font-family:var(--mono);font-weight:700;font-size:12px;letter-spacing:.06em;padding:3px 9px;border-radius:6px}
.mq .steps{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}
.mq .st{font-family:var(--mono);font-size:10px;letter-spacing:.05em;padding:4px 9px;border-radius:6px;background:#EBF2F0;color:var(--mid)}
.mq .st.on{background:var(--petrol);color:#fff}
.mq .st.done{background:#CFE3DE;color:#1C4A45}
.mq .foot{font-family:var(--mono);font-size:10.5px;color:var(--mid);text-align:center;margin-top:18px;letter-spacing:.03em}
.mq code{font-family:var(--mono);font-size:11.5px;background:#EBF2F0;padding:1px 5px;border-radius:4px}
@media (prefers-reduced-motion:reduce){.mq *{transition:none!important}}
`;

const pct = v => v == null || !Number.isFinite(v) ? "—" : (v*100).toFixed(1) + "%";
const K = ({ label, value, detail, color }) => (
  <div className="k"><div className="kl">{label}</div>
    <div className="kv" style={color?{color}:undefined}>{value}</div>
    {detail && <div className="kd">{detail}</div>}</div>
);

// ================================================================== app
export default function MasqueSim() {
  const [app, setApp] = useState("screener");
  return (
    <div className="mq">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="head">
          <div className="logo"><Stethoscope size={20} /></div>
          <div style={{ flex: 1 }}>
            <h1>Project MASQUE — working simulation</h1>
            <div className="vers">release {RELEASE} · instrument {INSTRUMENT_VERSION} · prototype, not for clinical use</div>
          </div>
        </div>
        <div className="tabs">
          {[["screener","Clinician screener",Stethoscope],["panel","Research panel",FlaskConical],
            ["patient","Patient companion",Users],["scribe","Ambient scribe",FileText]].map(([k,l,I]) => (
            <button key={k} className={"tab" + (app===k?" on":"")} onClick={()=>setApp(k)}><I size={15}/>{l}</button>
          ))}
        </div>
        {app === "screener" && <Screener />}
        {app === "panel" && <Panel />}
        {app === "patient" && <Patient />}
        {app === "scribe" && <Scribe />}
        <div className="foot">
          Condensed from the 0.3.0 release · scoring, gating, red flags, and audit maths are the shipped logic
        </div>
      </div>
    </div>
  );
}

// ================================================================== screener
const STEPS = ["Safety","Intake","Migrainous","Vestibular","Neuropathic","Impact","Result"];
const STEP_DOMAIN = { 2:"migraine", 3:"vestibular", 4:"neuro", 5:"impact" };

function Screener() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [rf, setRf] = useState({});
  const [safety, setSafety] = useState(false);
  const [probe, setProbe] = useState(null);
  const sc = useScore(answers);

  const flags = RED_FLAGS.filter(f => rf[f.id]);
  const override = flags.length > 0;
  const emergent = flags.some(f => f.tier === "emergent");
  const canGo = step === 0 ? (safety || override) : true;
  const set = (id, v) => { setProbe(null); setAnswers(a => ({ ...a, [id]: a[id] === v ? undefined : v })); };

  const runProbe = s => { const st = s.apply(); setAnswers(st.answers); setRf(st.rf);
    setSafety(st.safety); setStep(st.step); setProbe(s.id); };
  const reset = () => { setAnswers({}); setRf({}); setSafety(false); setStep(0); setProbe(null); };

  const meta = { low:{c:"var(--green)",bg:"var(--greenbg)",l:"Low likelihood"},
    moderate:{c:"var(--amber)",bg:"var(--amberbg)",l:"Moderate likelihood"},
    high:{c:"var(--coral)",bg:"var(--coralbg)",l:"High likelihood"},
    indeterminate:{c:"var(--slate)",bg:"#E3EAE9",l:"Not scorable — screen incomplete"} }[sc.band];

  return (
    <div className="grid">
      <div>
        <div className="steps">
          {STEPS.map((s,i) => <span key={s} className={"st" + (i===step?" on":i<step?" done":"")}>{s}</span>)}
        </div>

        {step === 0 && (
          <div className="card">
            <div className="eyebrow">00 · Safety</div>
            <h2>Before screening — red flags</h2>
            <p className="sub">Not scored and not weighed against the index. Any one of these stops the screen
              from routing this patient as a masked migraine or neuropathy.</p>
            {RF_GROUPS.map(g => (
              <div key={g}>
                <div className="gname">{g}</div>
                {RED_FLAGS.filter(f => f.group===g).map(f => (
                  <div key={f.id} className={"rf"+(rf[f.id]?" on":"")} role="checkbox" aria-checked={!!rf[f.id]} tabIndex={0}
                    onClick={()=>{setProbe(null);setRf(v=>({...v,[f.id]:!v[f.id]}));}}
                    onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),setRf(v=>({...v,[f.id]:!v[f.id]})))}>
                    <div className="box">{rf[f.id] && <Check size={12}/>}</div>
                    <div><div className="rft">{f.t}<span className={"tier "+f.tier}>{f.tier}</span></div>
                      <div className="rfm">{f.p} · {f.act}</div></div>
                  </div>
                ))}
              </div>
            ))}
            <div className="nav">
              {override
                ? <span className="pill" style={{color:"var(--coral)",background:"var(--coralbg)"}}>
                    <TriangleAlert size={15}/> {flags.length} red flag{flags.length===1?"":"s"} — routing will be withheld</span>
                : <><button className={"btn"+(safety?"":" ghost")} onClick={()=>setSafety(v=>!v)}>
                    {safety?<Check size={15}/>:<ShieldCheck size={15}/>} None of these apply</button>
                  <span className="small" style={{flex:1}}>{safety
                    ? "Recorded as reviewed."
                    : "Confirm the review to continue — the screen will not proceed on an unexamined safety step."}</span></>}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="card">
            <div className="eyebrow">01 · Intake</div>
            <h2>Recalcitrance</h2>
            <p className="sub">The §7.1 computable phenotype: what has already been tried and what it did.</p>
            <Items domain="recalcitrance" a={answers} set={set}/>
          </div>
        )}

        {STEP_DOMAIN[step] && (
          <div className="card">
            <div className="eyebrow">{String(step).padStart(2,"0")} · {ITEMS[STEP_DOMAIN[step]].label}</div>
            <h2>{ITEMS[STEP_DOMAIN[step]].label} features</h2>
            <p className="sub">{step===3
              ? "Duration and episode-count items map to Bárány vestibular-migraine criteria."
              : step===2 ? "Attack duration maps to ICHD-3 1.1 B."
              : "Answer what the encounter established. Unanswered is not the same as denied."}</p>
            <Items domain={STEP_DOMAIN[step]} a={answers} set={set}/>
            {step === 5 && (<><div className="gname">Discriminators — negative weight</div>
              <p className="small" style={{marginBottom:4}}>These point away from the pattern, so the screen can argue against itself.</p>
              <Items domain="discriminators" a={answers} set={set}/></>)}
          </div>
        )}

        {step === 6 && (
          <div className="card">
            <div className="eyebrow">06 · Result</div>
            {override && (
              <div className="call bad" style={{marginTop:2}}>
                <div style={{fontSize:15,fontWeight:700,display:"flex",gap:8,alignItems:"center",color:"#8E3520"}}>
                  <TriangleAlert size={19}/> Red flag — evaluate before screening routing</div>
                <div style={{marginTop:5}}>
                  {emergent ? "At least one finding needs same-day assessment." : "Expedited workup — days, not weeks."}
                  {" "}The index below is retained for the record; it proposes no referral and no reassurance while this is open.</div>
                {flags.map(f => <div key={f.id} style={{background:"#fff",borderRadius:8,padding:"9px 11px",marginTop:8}}>
                  <b>{f.t}</b><br/>{f.p} — <span style={{color:"#8E3520",fontWeight:600}}>{f.act}</span></div>)}
              </div>
            )}
            <h2 style={{marginTop:override?14:0}}>MASQUE index</h2>
            <div className="readout">
              <div>
                <div className="cap">{sc.scorable ? "SCORE / 100" : `ATTAINABLE RANGE · ${sc.coverage}% ANSWERED`}</div>
                {sc.scorable
                  ? <div className="score" style={{color:meta.c}}>{sc.total}</div>
                  : <div className="range" style={{color:meta.c}}>{sc.floor}<span className="sp">–</span>{sc.ceiling}</div>}
              </div>
              <div style={{flex:"1 1 240px",minWidth:210}}>
                <span className="pill" style={{color:meta.c,background:meta.bg}}>
                  {sc.scorable ? <><Activity size={14}/> {meta.l}</> : <><TriangleAlert size={14}/> {meta.l}</>}
                </span>
                <div className="meter">
                  {[[33,"var(--green)"],[33,"var(--amber)"],[34,"var(--coral)"]].map(([w,c],i)=>
                    <div key={i} className="z" style={{width:w+"%",background:c,opacity:.28}}/>)}
                  {sc.scorable
                    ? <div className="needle" style={{left:sc.total+"%"}}/>
                    : <div className="rband" style={{left:sc.floor+"%",width:Math.max(1,sc.ceiling-sc.floor)+"%"}}/>}
                </div>
                <div className="ticks"><span>0</span><span>34</span><span>67</span><span>100</span></div>
              </div>
            </div>

            {!sc.scorable && (
              <div className="call">
                <b>Outstanding items · {sc.open.length} unanswered</b>
                <div style={{marginTop:7}}>
                  {sc.open.slice(0,5).map(it => (
                    <div key={it.id} style={{display:"flex",gap:9,padding:"2px 0"}}>
                      <span style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:650,
                        color:it.w<0?"var(--coral)":"var(--petrol)",flex:"0 0 auto"}}>{it.w>0?"+":""}{it.w}</span>
                      <span>{it.t}</span></div>))}
                  {sc.open.length>5 && <div className="small" style={{marginTop:6}}>…and {sc.open.length-5} more, highest-weight first.</div>}
                </div>
                <div className="small" style={{marginTop:8}}>
                  No band, referral, or CDS prompt is issued until the answered items settle the index into a
                  single band. Unanswered items are <b>not</b> counted as denials.</div>
              </div>
            )}

            {override ? (
              <div className="call bad"><b>CDS Hooks card · {emergent?"critical":"warning"}</b><br/>
                MASQUE: red flag present — do not attribute to migraine before evaluation.<br/>
                <span style={{marginTop:4,display:"inline-block"}}>{flags.map(f=>f.act).join(" · ")}</span></div>
            ) : sc.scorable && sc.band !== "low" ? (
              <div className="call"><b>CDS Hooks card · info</b><br/>
                MASQUE index {sc.total}/100 — consider {sc.band==="high"?"":"further evaluation for "}
                a masked migrainous driver. Draft referral: Headache medicine / Neuro-otology.</div>
            ) : sc.scorable ? (
              <div className="call"><b>No masked driver flagged.</b> Continue standard ENT management —
                issued only because the screen is complete and the whole attainable range sits below 34.</div>
            ) : null}

            <table>
              <thead><tr><th>Domain</th><th>Points</th><th>Unanswered weight</th></tr></thead>
              <tbody>{ORDER.map(k => (
                <tr key={k}><td>{sc.domains[k].label}</td>
                  <td style={{fontFamily:"var(--mono)"}}>{sc.domains[k].pts}{sc.domains[k].neg?"":` / ${sc.domains[k].max}`}</td>
                  <td className="small">{sc.domains[k].openPts ? `${sc.domains[k].openPts} pts open` : "complete"}</td></tr>))}
              </tbody>
            </table>
          </div>
        )}

        <div className="nav">
          {step > 0 && <button className="btn ghost" onClick={()=>setStep(s=>s-1)}><ArrowLeft size={15}/> Back</button>}
          <div style={{flex:1}}/>
          {step === 6
            ? <button className="btn ghost" onClick={reset}><RotateCcw size={15}/> Clear screen</button>
            : <button className="btn" disabled={!canGo} onClick={()=>setStep(s=>s+1)}>
                {step===5?"See result":"Continue"} <ArrowRight size={15}/></button>}
        </div>
      </div>

      <div className="rail">
        <div className="card">
          <div className="eyebrow">Probe</div>
          <h2 style={{fontSize:15}}>Drive at the refusals</h2>
          <p className="sub" style={{marginBottom:4}}>Each jumps straight to a state the gates exist for.</p>
          {SCENARIOS.map(s => (
            <button key={s.id} className={"probe"+(probe===s.id?" on":"")} onClick={()=>runProbe(s)}>
              <s.icon size={15} style={{flex:"0 0 auto",marginTop:2,color:"var(--petrol)"}}/>
              <div><div className="pl">{s.label}</div><div className="pw">{s.why}</div></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Items({ domain, a, set }) {
  return <>{ITEMS[domain].items.map(it => (
    <div className="q" key={it.id}>
      <div className="qt">{it.t}
        <span style={{fontFamily:"var(--mono)",fontSize:11,color:it.w<0?"var(--coral)":"var(--mid)",marginLeft:7}}>
          {it.w>0?"+":""}{it.w}</span></div>
      <div className="opts">
        {it.scale
          ? it.scale.map((lab,i) => <button key={i} className={"o"+(a[it.id]===i?" sel":"")} onClick={()=>set(it.id,i)}>{lab}</button>)
          : <><button className={"o"+(a[it.id]==="yes"?" sel":"")} onClick={()=>set(it.id,"yes")}>Yes</button>
              <button className={"o no"+(a[it.id]==="no"?" sel":"")} onClick={()=>set(it.id,"no")}>No</button></>}
      </div>
    </div>))}</>;
}

// ================================================================== panel
const COHORTS = [
  { id:"balanced", label:"Comparable groups · 800", why:"Labelled, similar scoring across sex. All three gaps clear the tolerance across the whole interval — PASS, and the model runs." },
  { id:"unlabeled", label:"No reference labels · 800", why:"Real pre-label screening data. Used to be imputed to all-negative and scored; now validation is withheld and the audit reports NOT ASSESSABLE rather than a verdict." },
  { id:"disparate", label:"Female under-detection · 429", why:"The §3.2 defect in data, plus divergent gender and a 6-row stratum. FAIL, so §11's gate withholds the model." },
];

function Panel() {
  const [kind, setKind] = useState(null);
  const [axis, setAxis] = useState("sex");
  const [tab, setTab] = useState("quality");
  const rows = useMemo(() => kind ? normalize(makeCohort(kind)) : [], [kind]);

  const axes = useMemo(() => ({ sex: rows.some(r=>r.sex!=null), gender: rows.some(r=>r.gender!=null) }), [rows]);
  const useAxis = axes[axis] ? axis : (axes.sex ? "sex" : "gender");
  const fair = useMemo(() => rows.length ? fairness(rows, useAxis) : null, [rows, useAxis]);
  const cal = useMemo(() => rows.length ? calibration(rows) : null, [rows]);
  const mit = useMemo(() => rows.length ? equityAdjust(rows, useAxis) : null, [rows, useAxis]);
  const labeled = rows.filter(isLabeled).length;
  const gate = fair?.overall === "FAIL";

  const vcol = v => v==="FAIL" ? {background:"var(--coralbg)",color:"#8E3520"}
    : v==="PASS" ? {background:"var(--greenbg)",color:"#1E5A40"}
    : {background:"var(--amberbg)",color:"#7A4E12"};

  return (
    <div className="grid">
      <div>
        {!kind ? (
          <div className="card">
            <div className="eyebrow">Research readiness</div>
            <h2>Load a cohort to begin</h2>
            <p className="sub">The panel computes nothing until there are rows. Pick one on the right —
              each is built to exercise a different guard.</p>
            <div className="call"><b>Canonical schema.</b> <code>score</code>, <code>label</code>,
              <code>sex</code>, <code>gender</code>, <code>subject_id</code>, <code>captured_at</code>,
              <code>weight</code>, plus item-level columns. Missing values stay missing.</div>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="eyebrow">Cohort · {COHORTS.find(c=>c.id===kind).label}</div>
              <div className="kpis">
                <K label="Rows" value={rows.length}/>
                <K label="Reference labels" value={labeled ? `${labeled} labelled` : "none"}
                   color={labeled?undefined:"var(--amber)"}
                   detail={labeled?"validation available":"validation withheld — nothing imputed"}/>
                <K label="Sex recorded" value={rows.filter(r=>r.sex!=null).length}/>
                <K label="Gender recorded" value={rows.filter(r=>r.gender!=null).length}/>
              </div>
              <div className="opts">
                {["quality","validation","fairness","mitigation"].map(t => (
                  <button key={t} className={"o"+(tab===t?" sel":"")} onClick={()=>setTab(t)}
                    style={{textTransform:"capitalize"}}>{t}</button>))}
              </div>
            </div>

            {tab === "quality" && (
              <div className="card">
                <h2>Data quality</h2>
                <p className="sub">Missingness is measured on what arrived, not on what normalization filled in.</p>
                <table><thead><tr><th>Field</th><th>Present</th><th>Missing</th></tr></thead><tbody>
                  {["score","label","sex","gender","subject_id","captured_at"].map(f => {
                    const p = rows.filter(r => r[f] != null).length;
                    return <tr key={f}><td><code>{f}</code></td><td>{p}</td>
                      <td style={{color: p<rows.length ? "var(--amber)":"inherit"}}>{rows.length-p}</td></tr>;})}
                </tbody></table>
                {!labeled && <div className="call warn"><b>No reference labels in this cohort.</b> Sensitivity,
                  specificity, PPV, AUROC, Brier, and calibration are all withheld. Before the ingestion rewrite this
                  cohort reported “labels detected”, 0% missingness on every field, and a full metrics table computed
                  from labels that were never there.</div>}
              </div>
            )}

            {tab === "validation" && (
              <div className="card">
                <h2>Validation</h2>
                {!labeled ? (
                  <div className="call warn"><b>Withheld.</b> A metric needs a reference standard. There isn't one
                    here, so nothing is reported — including nothing that looks like a result.</div>
                ) : !cal ? null : (
                  <>
                    <div className="kpis">
                      <K label="Labelled rows" value={cal.n} detail={`${cal.nPos} positive · ${cal.nNeg} negative`}/>
                      <K label="Calibration-in-the-large" value={(cal.citl>0?"+":"")+cal.citl.toFixed(3)}
                         detail={`predicted ${pct(cal.meanP)} vs observed ${pct(cal.obs)} · 0 is ideal`}/>
                      <K label="Calibration slope" value={cal.slope==null?"not estimable":cal.slope.toFixed(2)}
                         detail={cal.slope==null?"needs both classes":cal.slope<0.9?"below 1 — too extreme":cal.slope>1.1?"above 1 — too conservative":"near 1"}/>
                    </div>
                    <table><thead><tr><th>Predicted risk</th><th>Mean predicted</th><th>Observed</th><th>n</th></tr></thead><tbody>
                      {cal.bins.map((b,i)=><tr key={i}><td>{pct(b.lo)}–{pct(b.hi)}</td>
                        <td>{b.suppressed?"—":pct(b.pred)}</td>
                        <td>{b.suppressed?<span className="small">suppressed</span>:pct(b.obs)}</td>
                        <td>{b.n}</td></tr>)}
                    </tbody></table>
                    <div className="call warn"><b>Why this is separate from Brier.</b> A model can lower its Brier
                      score by growing sharper while getting worse at being right about probabilities. §7.2 promises a
                      calibrated classifier, so calibration gets its own statistics.</div>
                  </>
                )}
              </div>
            )}

            {tab === "fairness" && fair && (
              <div className="card">
                <h2>Fairness audit</h2>
                <div className="opts" style={{marginBottom:4}}>
                  <span className="small" style={{alignSelf:"center",marginRight:3}}>Stratify by</span>
                  {["sex","gender"].map(ax => (
                    <button key={ax} className={"o"+(fair.axis===ax?" sel":"")} disabled={!axes[ax]}
                      onClick={()=>setAxis(ax)}>{ax}{axes[ax]?"":" — absent"}</button>))}
                </div>
                {fair.notRecorded>0 && <p className="small">{fair.notRecorded} of {rows.length} rows have no {fair.axis} recorded
                  and are excluded from stratification rather than pooled into an “unknown” group.</p>}
                <div className="kpis">
                  {Object.entries(fair.gaps).map(([k,g]) => (
                    <K key={k} label={k+" gap"} value={g.assessable?pct(g.d):"—"}
                       color={fair.verdicts[k]==="FAIL"?"var(--coral)":undefined}
                       detail={g.assessable?`CI ${pct(g.lo)} to ${pct(g.hi)} · ${fair.verdicts[k]}`:"not assessable"}/>))}
                </div>
                <div style={{margin:"8px 0"}}>
                  <span className="verdict" style={vcol(fair.overall)}>{fair.overall}</span>
                  <span className="small" style={{marginLeft:9}}>tolerance {pct(POLICY.tol)} · unattributed, so a PASS is provisional</span>
                </div>
                <table><thead><tr><th>Group</th><th>n</th><th>Flag rate</th><th>Sensitivity</th></tr></thead><tbody>
                  {fair.groups.map(g => (
                    <tr key={g.group}><td>{g.group}</td><td>{g.n}</td>
                      <td>{g.suppressed?<span className="small">suppressed — below {POLICY.minGroupN}</span>:pct(g.sel.k/g.sel.n)}</td>
                      <td>{g.suppressed||g.sens.n<POLICY.minCellN?<span className="small">—</span>:pct(g.sens.k/g.sens.n)}</td></tr>))}
                </tbody></table>
                {gate && (
                  <div className="call bad"><b>Model output withheld — §11 deployment gate.</b> At least one
                    disparity exceeds its tolerance across the whole confidence interval. The proposal commits that
                    the model is rejected when an audit shows it widens disparities, so the calibrated probability and
                    the routing decision are withheld rather than flagged. The rule-based index is unaffected — a
                    clinician can re-derive it by hand.</div>
                )}
                <div className="call"><b>Why FAIL only.</b> INCONCLUSIVE and NOT ASSESSABLE do not gate. Blocking on
                  those would mean the model can never run until a large validated cohort exists — stricter than §11
                  states, and a gate nobody could ship behind.</div>
              </div>
            )}

            {tab === "mitigation" && (
              <div className="card">
                <h2>Equity mitigation — proposed threshold adjustment</h2>
                {!mit || mit.insufficient ? (
                  <div className="call warn"><b>Not computable on this cohort.</b> Adjustment needs two groups with
                    enough positive cases in the development half to estimate a threshold from.</div>
                ) : (
                  <>
                    <div className="kpis">
                      <K label="Criterion" value="Equal sensitivity" detail={`levelled up to ${pct(mit.target)} — never down`}/>
                      <K label="Sensitivity gap" value={`${pct(mit.sensGapB)} → ${pct(mit.sensGapA)}`}
                         detail={mit.sensGapA<mit.sensGapB?"reduced on held-out data":"not reduced"}/>
                      <K label="Specificity gap" value={`${pct(mit.specGapB)} → ${pct(mit.specGapA)}`}
                         color={mit.specGapA>mit.specGapB?"var(--amber)":undefined}
                         detail={mit.specGapA>mit.specGapB?"widened — this is the trade":"unchanged"}/>
                      <K label="Split" value={`${mit.devN} / ${mit.holdN}`} detail="development / held-out, by subject"/>
                    </div>
                    <table><thead><tr><th>Group</th><th>Threshold</th><th>Sensitivity</th><th>Specificity</th></tr></thead><tbody>
                      {mit.rep.map(r => (
                        <tr key={r.group}><td>{r.group}</td>
                          <td style={{fontFamily:"var(--mono)"}}>{r.threshold.toFixed(3)}
                            <div className="small">{r.moved>0?"+":""}{r.moved.toFixed(3)}</div></td>
                          <td>{pct(r.sensB)} → {pct(r.sensA)}</td>
                          <td>{pct(r.specB)} → {pct(r.specA)}</td></tr>))}
                    </tbody></table>
                    <div className="call warn"><b>Proposed, not applied.</b> Nothing uses these thresholds. Applying
                      group-specific thresholds at the point of care is a clinical, legal, and institutional decision,
                      not a setting.</div>
                    <div className="call"><b>Why the specificity column is there.</b> With unequal base rates you cannot
                      have equal sensitivity, equal specificity, and calibration at once — arithmetic, not a tuning
                      problem. A tool that shows you only the metric it improved is selling you something.</div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="rail">
        <div className="card">
          <div className="eyebrow">Probe</div>
          <h2 style={{fontSize:15}}>Load a cohort</h2>
          <p className="sub" style={{marginBottom:4}}>Synthetic and deterministic. Each triggers a different guard.</p>
          {COHORTS.map(c => (
            <button key={c.id} className={"probe"+(kind===c.id?" on":"")} onClick={()=>{setKind(c.id);setTab("quality");}}>
              <Play size={14} style={{flex:"0 0 auto",marginTop:2,color:"var(--petrol)"}}/>
              <div><div className="pl">{c.label}</div><div className="pw">{c.why}</div></div>
            </button>
          ))}
          {kind && <button className="probe" onClick={()=>setKind(null)}>
            <RotateCcw size={14} style={{flex:"0 0 auto",marginTop:2,color:"var(--mid)"}}/>
            <div><div className="pl">Clear</div></div></button>}
        </div>
      </div>
    </div>
  );
}

// ================================================================== patient
const PQ = {
  en: { title:"Getting ready for your visit", lede:"Five minutes. At the end you get a one-page summary you can print or show on your phone.",
    yes:"Yes", no:"No", unsure:"Not sure", summary:"Your visit summary",
    open:"How I'd open", describe:"What I want to describe", ask:"What I want to ask", notsure:"Things I'm not sure about",
    thin:"You haven't answered enough for this to be worth handing over. \u201CNot sure\u201D counts — it turns into something to ask about.",
    banner:null },
  es: { title:"Preparándose para su consulta", lede:"Cinco minutos. Al final recibe un resumen de una página que puede imprimir o mostrar en su teléfono.",
    yes:"Sí", no:"No", unsure:"No estoy seguro", summary:"Mi resumen para la consulta",
    open:"Cómo empezaría", describe:"Lo que quiero describir", ask:"Lo que quiero preguntar", notsure:"Cosas de las que no estoy seguro",
    thin:"No ha contestado lo suficiente como para que valga la pena entregarlo. \u201CNo estoy seguro\u201D cuenta — se convierte en algo que preguntar.",
    banner:"Traducción preliminar. Este texto en español todavía no ha sido revisado por un profesional de salud bilingüe." },
};
const PITEMS = [
  { id:"r_dur", en:"This has been going on — or keeps coming back — for more than 3 months.",
    es:"Esto lleva más de 3 meses, o vuelve una y otra vez.",
    sEn:"Symptoms have lasted or kept returning for more than three months.",
    sEs:"Los síntomas han durado o han vuelto por más de tres meses." },
  { id:"r_abx", en:"I've had two or more rounds of antibiotics or steroids and they didn't fix it for long.",
    es:"He tomado dos o más ciclos de antibióticos o esteroides y no lo resolvieron por mucho tiempo.",
    sEn:"Two or more courses of antibiotics or steroids haven't given lasting relief.",
    sEs:"Dos o más ciclos de antibióticos o esteroides no me han dado alivio duradero." },
  { id:"r_normal", en:"My scans or exams came back normal, or close to normal, even though I feel bad.",
    es:"Mis estudios o exámenes salieron normales, o casi normales, aunque me siento mal.",
    sEn:"Exams or scans have come back normal or near-normal despite how I feel.",
    sEs:"Los exámenes o estudios han salido normales o casi normales a pesar de cómo me siento.",
    askEn:"What exactly did my previous scans and exams show?",
    askEs:"¿Qué mostraron exactamente mis estudios y exámenes anteriores?" },
  { id:"m_photo", en:"Light or noise bothers me more than usual during an episode.",
    es:"La luz o el ruido me molestan más de lo normal durante un episodio.",
    sEn:"Light and sound bother me during episodes.", sEs:"La luz y el ruido me molestan durante los episodios." },
  { id:"m_nausea", en:"I feel sick to my stomach during an episode.", es:"Siento náuseas durante un episodio.",
    sEn:"I feel nauseated during episodes.", sEs:"Siento náuseas durante los episodios." },
  { id:"m_trig", en:"Certain things set it off — weather changes, poor sleep, skipping meals, or my period.",
    es:"Ciertas cosas lo provocan — cambios de clima, dormir mal, saltarme comidas, o mi periodo.",
    sEn:"Clear things set it off — weather, sleep, meals, or my period.",
    sEs:"Hay cosas que claramente lo provocan — el clima, el sueño, las comidas, o mi periodo." },
  { id:"x_objective", en:"A scan or a camera test showed real sinus swelling while I was having symptoms.",
    es:"Un estudio o una cámara mostró inflamación real de los senos nasales mientras yo tenía síntomas.",
    sEn:"A scan showed real sinus swelling while I had symptoms.",
    sEs:"Un estudio mostró inflamación real de los senos nasales mientras tenía síntomas.",
    askEn:"Did any of my scans show real sinus swelling when I had symptoms?",
    askEs:"¿Alguno de mis estudios mostró inflamación real de los senos nasales cuando tenía síntomas?" },
];

function Patient() {
  const [loc, setLoc] = useState("en");
  const [a, setA] = useState({});
  const t = PQ[loc];
  const answered = Object.values(a).filter(v => v !== undefined).length;

  const said = PITEMS.filter(i => a[i.id]==="yes").map(i => loc==="es"?i.sEs:i.sEn);
  const unsure = PITEMS.filter(i => a[i.id]==="unsure");
  const mig = ["m_photo","m_nausea","m_trig"].filter(id => a[id]==="yes").length;
  const disc = a.x_objective === "yes";
  const ask = [];
  if (mig >= 2 && disc) ask.push(loc==="es"
    ? "Algunos de mis resultados apuntan a una causa de senos nasales y algunos de mis síntomas parecen de migraña. ¿Podría haber más de una cosa a la vez?"
    : "Some of my results point to a sinus cause and some of my symptoms look migraine-like. Could there be more than one thing going on?");
  else if (mig >= 2) ask.push(loc==="es"
    ? "¿Esto podría ser migraña, aunque el dolor sea en la cara y los senos nasales?"
    : "Could this be migraine, even though the pain is across my face and sinuses?");
  if (a.r_normal==="yes") ask.push(loc==="es"
    ? "Si los estudios están normales, ¿qué estamos confirmando — no solo descartando?"
    : "If the scans are normal, what are we ruling in — not just ruling out?");
  if (a.r_abx==="yes") ask.push(loc==="es"
    ? "Hemos probado antibióticos sin beneficio duradero. ¿Qué nos dice eso sobre la causa?"
    : "We've tried antibiotics without lasting benefit. What does that tell us about the cause?");

  return (
    <div className="grid">
      <div>
        <div className="card">
          <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}><h2>{t.title}</h2><p className="sub" style={{marginBottom:0}}>{t.lede}</p></div>
            <div className="opts" style={{flex:"0 0 auto"}}>
              {["en","es"].map(k => <button key={k} className={"o"+(loc===k?" sel":"")} lang={k}
                onClick={()=>setLoc(k)}>{k==="en"?"English":"Español"}</button>)}
            </div>
          </div>
          {t.banner && <div className="call warn" lang="es"><b>⚠︎ Traducción sin revisar.</b> {t.banner}</div>}
          <div style={{marginTop:6}}>
            {PITEMS.map(i => (
              <div className="q" key={i.id}>
                <div className="qt">{loc==="es"?i.es:i.en}</div>
                <div className="opts">
                  {["yes","no","unsure"].map(v => (
                    <button key={v} className={"o"+(v==="no"?" no":"")+(a[i.id]===v?" sel":"")}
                      style={v==="unsure"&&a[i.id]===v?{background:"#fff",borderColor:"var(--amber)",color:"var(--amber)"}:undefined}
                      onClick={()=>setA(p=>({...p,[i.id]:p[i.id]===v?undefined:v}))}>{t[v]}</button>))}
                </div>
              </div>))}
          </div>
        </div>

        <div className="card">
          <h2>{t.summary}</h2>
          {answered === 0 ? <div className="call warn">{t.thin}</div> : (
            <>
              {said.length>0 && <div className="call"><b>{t.describe}</b>
                <ul style={{margin:"6px 0 0 18px"}}>{said.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
              {ask.length>0 && <div className="call warn"><b>{t.ask}</b>
                <ul style={{margin:"6px 0 0 18px"}}>{ask.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
              {unsure.length>0 && <div className="call"><b>{t.notsure}</b>
                <ul style={{margin:"6px 0 0 18px"}}>{unsure.map(i=>
                  <li key={i.id}>{loc==="es"?(i.askEs||i.es):(i.askEn||i.en)}</li>)}</ul></div>}
            </>
          )}
          <div className="call"><Info size={14} style={{verticalAlign:-2,marginRight:6}}/>
            No score, no band, no probability appears anywhere in this view — and a red flag would show only
            how fast to be seen and what to say, never what it might be.</div>
        </div>
      </div>

      <div className="rail">
        <div className="card">
          <div className="eyebrow">What to notice</div>
          <div className="probe" style={{cursor:"default"}}>
            <Info size={14} style={{flex:"0 0 auto",marginTop:2,color:"var(--petrol)"}}/>
            <div><div className="pl">“Not sure” is real</div><div className="pw">It leaves the item unanswered
              rather than coercing a no — and becomes a question on the summary. Same no-imputation rule as the
              cohort loader.</div></div>
          </div>
          <div className="probe" style={{cursor:"default"}}>
            <Zap size={14} style={{flex:"0 0 auto",marginTop:2,color:"var(--petrol)"}}/>
            <div><div className="pl">Answer the last item yes</div><div className="pw">With a rule-out positive,
              the migraine question reframes to open both doors instead of pushing the tool's own hypothesis.</div></div>
          </div>
          <div className="probe" style={{cursor:"default"}}>
            <TriangleAlert size={14} style={{flex:"0 0 auto",marginTop:2,color:"var(--amber)"}}/>
            <div><div className="pl">Switch to Español</div><div className="pw">The summary translates too, not just
              the questions — and the unreviewed-translation banner stays up because no bilingual clinician has
              signed it off.</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================== scribe
const LINES = [
  { s:"Patient", t:"It's this pressure right behind my eyes, most days now. Feels like my sinuses." },
  { s:"Patient", t:"Bright lights and busy places make it worse — grocery store aisles are the worst." },
  { s:"Patient", t:"I get nauseous with it too, and it usually sticks around all day." },
  { s:"Patient", t:"I've had three rounds of antibiotics this year and the CT was normal." },
  { s:"Patient", t:"The dizzy spells last a couple of hours. My ear feels full and there's a ringing when it happens." },
  { s:"Doctor",  t:"And has anyone suggested what might be behind all this?" },
  { s:"Patient", t:"They said it was probably stress and anxiety." },
];
const CUES = [
  { id:"m_head", v:1, ph:["facial pressure","behind my eyes","sinus headache","headache","pressure in my face"] },
  { id:"m_photo", v:"yes", ph:["bright light","light bother"] },
  { id:"v_motion", v:"yes", ph:["grocery","busy place","aisle"] },
  { id:"m_nausea", v:"yes", ph:["nauseous","nausea"] },
  { id:"m_dur", v:2, ph:["all day","rest of the day"] },
  { id:"r_abx", v:"yes", ph:["antibiotic","rounds of"] },
  { id:"r_normal", v:"yes", ph:["ct was normal","scan was normal"] },
  { id:"v_vertigo", v:2, ph:["couple of hours","a few hours"] },
  { id:"v_aural", v:"yes", ph:["ear feels full","ringing"] },
  { id:"c_dismiss", v:"yes", ph:["stress","anxiety"] },
  { id:"rf_asym", v:true, rf:true, ph:["only in one ear","always the same ear"] },
];
const NEG = ["no ","not ","n't","never","without","denies"];

/*  Real-time probes — what to ask or do next, while the patient is still in the room.

    The scribe's original suggestion list ranked unanswered scored items by weight.
    That is fine for filling in a questionnaire and wrong for a live encounter, because
    the highest-weight unanswered item is almost never the most urgent thing to say.
    These probes are triggered by what has ALREADY been captured, and ranked by what
    the answer could change rather than by how many points it is worth.

    Ranking, strictest first:

      safety    the answer could surface a red flag. Ranked above everything, including
                items worth more points. A prompt list that puts a 6-point index item
                above "does the ringing pulse with your heartbeat" is a prompt list that
                helps you score a patient faster while missing the thing that mattered.
      criteria  the answer completes an ICHD-3 or Bárány anchor definition. Without
                these the screen cannot be crosswalked to a reference label at all, so a
                missing one costs more than its weight suggests.
      ruleout   the answer can LOWER the index. Deliberately ranked above ordinary
                index items: a prompt list that only asks questions capable of
                confirming its own hypothesis is a leading question with a progress bar.
      exam      a manoeuvre rather than a question, for while you are already examining.

    The tinnitus-quality probe is the archetype. "There's a ringing" is an ordinary
    4-point aural finding. Its QUALITY is the difference between vestibular migraine and
    a dural fistula, and no patient volunteers it, because nobody has ever asked.
*/
const PROBE_KIND = {
  safety:    { rank:0, label:"Safety",    c:"var(--coral)",  bg:"var(--coralbg)" },
  rescue:    { rank:1, label:"Re-ask",    c:"#7A4DA8",       bg:"#F0EAF7" },
  criteria:  { rank:2, label:"Criteria",  c:"var(--petrol)", bg:"#E4EFED" },
  ruleout:   { rank:3, label:"Rule-out",  c:"var(--amber)",  bg:"var(--amberbg)" },
  phenotype: { rank:4, label:"Supporting",c:"#2A6E8A",       bg:"#E3EFF4" },
  exam:      { rank:5, label:"Exam",      c:"var(--slate)",  bg:"#E9EEED" },
};

const PROBES = [
  // ---- safety: the answer could surface a red flag ----
  { id:"pr_tinnitus_quality", kind:"safety", when:a => a.v_aural==="yes",
    say:"The ringing — has the quality changed at all? Does it pulse in time with your heartbeat, or click?",
    why:"Pulsatile tinnitus is vascular until proven otherwise. Clicking points instead at palatal myoclonus or eustachian dysfunction.",
    opts:[{ l:"Pulses with heartbeat", rf:"rf_pulsatile" },
          { l:"Clicking", note:"Clicking quality — palatal myoclonus / ETD, not a red flag" },
          { l:"Steady tone, unchanged" }] },
  { id:"pr_laterality", kind:"safety", when:a => a.v_aural==="yes",
    say:"When the ringing or fullness happens, is it always the same ear?",
    why:"Consistently unilateral aural symptoms are retrocochlear until imaging says otherwise. This is the single most common thing a migraine-shaped story hides.",
    opts:[{ l:"Always the same ear", rf:"rf_asym" },
          { l:"Both ears, or it moves" }] },
  { id:"pr_sudden_drop", kind:"safety", when:a => a.v_aural==="yes",
    say:"Has your hearing ever dropped suddenly — over hours or a day — rather than gradually?",
    why:"Sudden SNHL has a steroid window measured in days. A gradual story and a sudden one get completely different urgency.",
    opts:[{ l:"Yes, suddenly", rf:"rf_ssnhl" }, { l:"Gradual, or no change" }] },
  { id:"pr_posture", kind:"safety", when:a => (a.m_head??0)>0,
    say:"Is the headache worse when you lie flat, first thing on waking, or when you cough or strain?",
    why:"Postural and Valsalva-dependent headache is raised intracranial pressure until excluded.",
    opts:[{ l:"Yes, clearly worse", rf:"rf_progressive" }, { l:"No positional pattern" }] },
  { id:"pr_onset", kind:"safety", when:a => (a.m_head??0)>0,
    say:"Has any one of these ever come on at full force within about a minute?",
    why:"Thunderclap onset buried inside a chronic headache history is easy to miss and is a same-day question.",
    opts:[{ l:"Yes, one came on instantly", rf:"rf_thunderclap" }, { l:"Always builds gradually" }] },
  { id:"pr_gca", kind:"safety", when:a => (a.m_head??0)>0,
    say:"If they're over 50 — any scalp tenderness when brushing hair, or jaw ache while chewing?",
    why:"Giant cell arteritis presents as a new headache and takes vision irreversibly. Ask on age alone, not on suspicion.",
    opts:[{ l:"Yes, either", rf:"rf_gca" }, { l:"Neither", }, { l:"Under 50 — not applicable" }] },
  { id:"pr_nasal_mass", kind:"safety", when:a => a.r_normal==="yes" || a.r_abx==="yes",
    say:"Is one side of the nose blocked more than the other, with any bleeding or numbness of the cheek?",
    why:"Unilateral obstruction with epistaxis or V2 numbness is a sinonasal malignancy until endoscopy says otherwise.",
    opts:[{ l:"Yes, one-sided", rf:"rf_mass" }, { l:"Symmetric, no bleeding" }] },

  // ---- criteria: completes an anchor definition ----
  { id:"pr_episode_count", kind:"criteria", when:a => (a.v_vertigo??0)>0, target:"v_count",
    say:"Roughly how many of these dizzy episodes have you had in total — more or fewer than five?",
    why:"Bárány vestibular migraine criterion A is at least five episodes. Without a count the screen cannot be crosswalked to the diagnosis at all.",
    opts:[{ l:"Five or more", a:{ v_count:"yes" } }, { l:"Fewer than five", a:{ v_count:"no" } }] },
  { id:"pr_migfeat", kind:"criteria", when:a => (a.v_vertigo??0)>0, target:"v_migfeat",
    say:"Think of your last several episodes — did at least half come with headache, or with light and sound bothering you?",
    why:"Bárány criterion C is migrainous features in at least 50% of episodes. \"Sometimes\" is not the same answer.",
    opts:[{ l:"At least half", a:{ v_migfeat:"yes" } }, { l:"Fewer than half", a:{ v_migfeat:"no" } }] },
  { id:"pr_attack_duration", kind:"criteria", when:a => (a.m_head??0)>0, target:"m_dur",
    say:"If you don't treat it at all, how long does one attack run?",
    why:"ICHD-3 1.1 B is 4 to 72 hours untreated. Treated duration answers a different question and will not map.",
    opts:[{ l:"4 to 72 hours", a:{ m_dur:2 } }, { l:"Under 4 hours", a:{ m_dur:1 } },
          { l:"Over 72 hours", a:{ m_dur:3 } }, { l:"Too variable to say", a:{ m_dur:4 } }] },

  // ---- rule-out: the answer can lower the index ----
  { id:"pr_scan_detail", kind:"ruleout", when:a => a.r_normal==="yes", target:"x_objective",
    say:"What did the scan actually report — any mucosal thickening, opacification, or polyps?",
    why:"\"Normal\" in a patient's account and \"normal\" in a radiology report are frequently different documents. Objective inflammation argues against the masquerade.",
    opts:[{ l:"Real inflammation reported", a:{ x_objective:"yes" } }, { l:"Genuinely clear", a:{ x_objective:"no" } }] },
  { id:"pr_purulence", kind:"ruleout", when:a => a.r_abx==="yes", target:"x_purulent",
    say:"During a bad stretch, is there thick coloured drainage — and did any swab ever grow something?",
    why:"Purulence with a positive culture points at genuine bacterial sinusitis, which is the diagnosis this screen exists to avoid overriding.",
    opts:[{ l:"Yes, purulent or culture-positive", a:{ x_purulent:"yes" } }, { l:"Clear or no drainage", a:{ x_purulent:"no" } }] },
  { id:"pr_audiogram", kind:"ruleout", when:a => a.v_aural==="yes", target:"x_lowfreq",
    say:"Have you had two hearing tests at different times — did the low tones drop and then come back?",
    why:"Documented fluctuating low-frequency loss is Ménière's until proven otherwise, and it pulls hard against the migraine reading.",
    opts:[{ l:"Yes, it fluctuates", a:{ x_lowfreq:"yes" } }, { l:"Stable, or never tested twice", a:{ x_lowfreq:"no" } }] },
  { id:"pr_smell", kind:"ruleout", when:a => a.r_abx==="yes" || a.r_normal==="yes", target:"x_anosmia",
    say:"Between the bad episodes, is your sense of smell normal?",
    why:"Persistent hyposmia between flares is sinonasal disease, not a migrainous driver.",
    opts:[{ l:"Reduced even between flares", a:{ x_anosmia:"yes" } }, { l:"Normal in between", a:{ x_anosmia:"no" } }] },

  // ---- exam: manoeuvres for while you are already examining ----
  { id:"pr_dix_hallpike", kind:"exam", when:a => (a.v_vertigo??0)>0,
    say:"Dix–Hallpike, both sides.",
    why:"Positional nystagmus with the classic latency and fatigue is BPPV, which is treatable at the bedside and does not need any of this.",
    opts:[{ l:"Positive — torsional, fatigable", note:"BPPV pattern on Dix–Hallpike" },
          { l:"Negative both sides", note:"Dix–Hallpike negative bilaterally" }, { l:"Deferred" }] },
  { id:"pr_head_impulse", kind:"exam", when:a => (a.v_vertigo??0)>0,
    say:"Head impulse, and check for skew and direction-changing nystagmus.",
    why:"A normal head impulse in an acutely vertiginous patient points central, not peripheral — the opposite of reassuring.",
    opts:[{ l:"Normal impulse (points central)", note:"HINTS: normal head impulse — central pattern" },
          { l:"Corrective saccade (peripheral)", note:"HINTS: corrective saccade — peripheral pattern" }, { l:"Deferred" }] },
  { id:"pr_tuning_fork", kind:"exam", when:(a,rf) => !!rf.rf_asym,
    say:"Weber and Rinne at 512 Hz before they leave.",
    why:"Thirty seconds of tuning fork tells you whether the asymmetry is conductive or sensorineural, and that changes what you order.",
    opts:[{ l:"Sensorineural pattern", note:"Weber/Rinne: sensorineural pattern on the affected side" },
          { l:"Conductive pattern", note:"Weber/Rinne: conductive pattern" }, { l:"Deferred" }] },
  { id:"pr_temporal_artery", kind:"exam", when:a => (a.m_head??0)>0,
    say:"Palpate the temporal arteries — tenderness, thickening, or absent pulse.",
    why:"Free, immediate, and the one exam finding that should send bloods off the same afternoon.",
    opts:[{ l:"Tender or pulseless", rf:"rf_gca" }, { l:"Normal" }, { l:"Deferred" }] },
];

/*  Vestibular-migraine phenotype probes, from the Bárány/IHS consensus literature.

    NOTE ON DUPLICATION: the shipped build keeps this set in MASQUE_Probes.js, which the
    scribe imports and MASQUE_Probes_Check.mjs validates. The copy below exists because a
    chat artifact must be a single file. They are kept in step deliberately; the module is
    the source of truth, and the check runs against the instrument, not against this copy.

    THE PROBLEM THESE EXIST FOR

    The Bárány Society and IHS consensus enumerates five qualifying vestibular symptom
    types for vestibular migraine: spontaneous vertigo — split into INTERNAL (a false
    sensation of self-motion) and EXTERNAL (the surround appears to spin or flow) —
    positional vertigo, visually-induced vertigo, head motion-induced vertigo, and head
    motion-induced dizziness WITH NAUSEA. Plain dizziness without nausea does not
    qualify; that is a deliberate line in the criteria, not an oversight.

    Instrument v0.2 asks about vertigo essentially once, in the vocabulary of external
    spinning. That under-detects, and it under-detects asymmetrically. In a published
    definite-VM cohort, internal vertigo was reported by MORE patients than external
    vertigo — so the commonest qualifying presentation is the one a "do you get spinning
    episodes?" question is least likely to capture. A patient whose head feels like it is
    rocking on a boat will answer no, and the vestibular arm of the screen collapses on a
    false negative.

    The same cohort found photophobia/phonophobia accompanying vestibular symptoms in
    about three quarters of patients while headache accompanied well under half. Criterion
    C is satisfied by headache OR photophobia-plus-phonophobia OR visual aura — so a probe
    that leads with headache is asking about the least common of the three.

    TWO KINDS, AND WHY THE DISTINCTION IS LOAD-BEARING

    rescue     An alternate PHRASING for an item that already exists in v0.2. Answering it
               sets that existing item. Nothing about the instrument changes, so cohorts
               stay comparable and INSTRUMENT_VERSION stays 0.2. Uniquely among probes, a
               rescue fires when its target has been answered NEGATIVELY — because the
               whole point is that the first phrasing may have produced a false negative.

    phenotype  A supporting feature from the literature with no home in v0.2 at all. These
               are recorded as observations and move the index by exactly zero. They are
               NOT Bárány criteria and must not be totalled as though they were: they
               raise or lower a clinician's suspicion, and scoring them would be inventing
               a measurement the validated instrument does not make. Each is tagged as an
               instrument v0.3 candidate, which is a decision for the clinical lead and a
               version bump, not something a prompt panel gets to do quietly.

    Wordings below are authored for this tool, not reproduced from the criteria documents.
*/
const VM_PROBES = [
  // ---- rescue: the five qualifying symptom types, in patient vocabulary ----
  { id:"pr_internal_vertigo", kind:"rescue", rescues:"v_vertigo",
    when:(a) => (a.v_vertigo === undefined || a.v_vertigo === 0),
    say:"Does your head ever feel like it's bobbing, rocking, or swaying side to side — like still being on a boat after you've stepped off — even while you're sitting perfectly still?",
    why:"Internal vertigo — a false sense of self-motion — qualifies under Bárány exactly as spinning does, and in published cohorts it is reported by more patients than external spinning. Someone who denies “vertigo” will often endorse this immediately.",
    opts:[{ l:"Yes — rocking or bobbing", a:{ v_vertigo:2 } },
          { l:"Yes, but only seconds at a time", a:{ v_vertigo:1 },
            note:"Internal vertigo lasting seconds — below the 5-minute Bárány floor; a recognised minority pattern that does not qualify on duration" },
          { l:"No sensation of self-motion" }] },

  { id:"pr_visual_vertigo", kind:"rescue", rescues:"v_motion",
    when:(a) => (a.v_motion === undefined || a.v_motion === "no"),
    say:"Does it get set off by moving visual scenes — driving through a tunnel, traffic streaming past, scrolling on a phone, supermarket aisles, patterned carpet, or a crowd moving around you?",
    why:"Visually-induced vertigo is its own qualifying symptom type. Patients rarely volunteer it because it feels like a quirk rather than a symptom — nobody reports a tunnel to their doctor.",
    opts:[{ l:"Yes, clearly visually triggered", a:{ v_motion:"yes" } },
          { l:"No visual trigger", a:{ v_motion:"no" } }] },

  { id:"pr_positional", kind:"rescue", rescues:"v_head",
    when:(a) => (a.v_head === undefined || a.v_head === "no"),
    say:"Does rolling over in bed, lying back, or reaching up to a high shelf bring it on?",
    why:"Positional vertigo qualifies in its own right. It also overlaps BPPV, which is why the Dix–Hallpike probe sits alongside this one rather than instead of it.",
    opts:[{ l:"Yes, positional", a:{ v_head:"yes" } },
          { l:"No positional trigger", a:{ v_head:"no" } }] },

  { id:"pr_headmotion_nausea", kind:"criteria", target:"m_nausea",
    when:(a) => a.v_head === "yes" && a.m_nausea === undefined,
    say:"When you turn your head quickly and feel off, does queasiness come with it?",
    why:"Head motion-induced DIZZINESS qualifies only when nausea accompanies it — dizziness alone is explicitly excluded. The nausea is not a detail, it is the qualifying clause.",
    opts:[{ l:"Yes, nausea with it", a:{ m_nausea:"yes" } },
          { l:"No nausea", a:{ m_nausea:"no" },
            note:"Head-motion dizziness without nausea — does not qualify as a Bárány vestibular symptom" }] },

  { id:"pr_photophono_only", kind:"rescue", rescues:"v_migfeat",
    when:(a) => (a.v_migfeat === undefined || a.v_migfeat === "no") && (a.v_vertigo ?? 0) > 0,
    say:"During the episodes themselves — never mind headache — do light AND sound both bother you, or do you get any visual disturbance beforehand?",
    why:"Criterion C is satisfied by headache, or photophobia with phonophobia, or visual aura. Headache accompanies well under half of attacks while light and sound sensitivity accompanies about three quarters, so leading with headache asks about the least common of the three.",
    opts:[{ l:"Light and sound both, in ≥half", a:{ v_migfeat:"yes" } },
          { l:"Visual disturbance beforehand", a:{ v_migfeat:"yes", m_aura:"yes" } },
          { l:"Neither, in most episodes", a:{ v_migfeat:"no" } }] },

  // ---- phenotype: supporting features with no v0.2 item, recorded and not scored ----
  { id:"pr_childhood_motion", kind:"phenotype", when:(a) => (a.v_vertigo ?? 0) > 0 || (a.m_head ?? 0) > 0,
    say:"As a child, were you the one who got carsick, or couldn't manage fairground rides and swings?",
    why:"Childhood motion intolerance is a long-recognised migraine-diathesis marker and is over-represented in vestibular migraine. It costs one sentence and often reframes a story the patient thought was unrelated.",
    opts:[{ l:"Yes, markedly", note:"Childhood motion intolerance / carsickness — VM-supporting, not a Bárány criterion" },
          { l:"No more than anyone" }] },

  { id:"pr_childhood_vertigo", kind:"phenotype", when:(a) => (a.v_vertigo ?? 0) > 0,
    say:"Did you have unexplained spells of dizziness or unsteadiness as a young child that nobody ever explained?",
    why:"Benign paroxysmal vertigo of childhood is now classified alongside vestibular migraine of childhood as a migraine-related syndrome, and a history of it makes the adult picture considerably more coherent.",
    opts:[{ l:"Yes, spells as a child", note:"Childhood recurrent vertigo — precursor syndrome, VM-supporting" },
          { l:"No" }] },

  { id:"pr_osmophobia", kind:"phenotype", when:(a) => (a.m_head ?? 0) > 0 || (a.v_vertigo ?? 0) > 0,
    say:"During an episode, do smells become intolerable — perfume, cooking, petrol — or set one off?",
    why:"Osmophobia is comparatively specific to migraine and is rarely volunteered. It is not a criterion, but it discriminates well against tension-type and sinonasal explanations.",
    opts:[{ l:"Yes, marked smell sensitivity", note:"Osmophobia during episodes — migraine-supporting, comparatively specific" },
          { l:"No" }] },

  { id:"pr_mdds", kind:"phenotype", when:(a) => (a.v_vertigo ?? 0) > 0,
    say:"After a long flight, drive, or boat trip, does a rocking feeling stay with you for days afterwards?",
    why:"Persistent post-motion rocking overlaps mal de débarquement, which is strongly migraine-associated. It also tells you the patient's baseline is not as symptom-free as “episodic” implies.",
    opts:[{ l:"Yes, rocking persists after travel", note:"Post-motion persistent rocking (MdDS-like) — migraine-associated" },
          { l:"No" }] },

  { id:"pr_interictal_photo", kind:"phenotype", when:(a) => a.m_photo === "yes",
    say:"Between episodes, on an ordinary day — sunglasses indoors, supermarket lighting, screens at night?",
    why:"Interictal photophobia marks a persistently sensitised state rather than discrete attacks, and it predicts how the patient will tolerate vestibular rehabilitation.",
    opts:[{ l:"Yes, light-sensitive between attacks", note:"Interictal photophobia — persistent sensitisation" },
          { l:"Only during attacks" }] },

  { id:"pr_smd", kind:"phenotype", when:(a) => (a.v_vertigo ?? 0) > 0 || a.v_motion === "yes",
    say:"Have you started avoiding places — escalators, balconies, open shopping floors, motorway driving — because of how they make you feel?",
    why:"Space-and-motion discomfort with avoidance is the pathway from episodic vestibular migraine into persistent postural-perceptual dizziness. Catching the avoidance early changes the treatment plan more than the label does.",
    opts:[{ l:"Yes, actively avoiding situations", note:"Space-motion discomfort with avoidance — PPPD risk, changes management" },
          { l:"No avoidance" }] },

  { id:"pr_neck", kind:"phenotype", when:(a) => (a.m_head ?? 0) > 0 || (a.v_vertigo ?? 0) > 0,
    say:"Does your neck ache or stiffen up as part of it — before, during, or after?",
    why:"Neck pain accompanies a large share of migraine attacks and is routinely misread as a cervicogenic cause, which sends the patient to physiotherapy for the wrong reason for months.",
    opts:[{ l:"Yes, neck involved", note:"Cervical involvement as part of the attack — commonly misattributed as cervicogenic" },
          { l:"No" }] },

  { id:"pr_prodrome", kind:"phenotype", when:(a) => (a.m_head ?? 0) > 0 || (a.v_vertigo ?? 0) > 0,
    say:"In the hours before one starts, is there anything that warns you — yawning, food cravings, mood change, feeling wired or flat?",
    why:"A recognisable prodrome is strong evidence of a migrainous mechanism and is the single most actionable thing here, because it defines a window for abortive treatment.",
    opts:[{ l:"Yes, recognisable warning", note:"Prodromal symptoms — migrainous mechanism, defines an abortive-treatment window" },
          { l:"No warning at all" }] },

  { id:"pr_treatment_trial", kind:"phenotype", when:(a) => (a.m_head ?? 0) > 0 || (a.v_vertigo ?? 0) > 0,
    say:"Have you ever taken a triptan, or a migraine preventive like propranolol, amitriptyline or topiramate — and did the dizziness change with it?",
    why:"An existing therapeutic trial is free evidence sitting in the history. Note it is suggestive only: response does not establish the diagnosis and non-response does not exclude it, since dose and duration are usually inadequate.",
    opts:[{ l:"Tried, and dizziness improved", note:"Dizziness improved on migraine-specific therapy — suggestive, not diagnostic" },
          { l:"Tried, no change", note:"No response to migraine-specific therapy — check dose and duration before weighing this" },
          { l:"Never tried" }] },
];

const ALL_PROBES = [...PROBES, ...VM_PROBES];

function Scribe() {
  const [n, setN] = useState(0);
  const [caps, setCaps] = useState([]);
  const [rfSeen, setRfSeen] = useState({});
  const [reviewed, setReviewed] = useState(false);
  const [probeAns, setProbeAns] = useState({});     // probe id -> chosen option index
  const [manual, setManual] = useState({});         // items answered via a probe
  const [notes, setNotes] = useState([]);
  const [openProbe, setOpenProbe] = useState(null);

  const advance = () => {
    if (n >= LINES.length) return;
    const text = LINES[n].t.toLowerCase();
    const hits = [];
    for (const c of CUES) {
      const i = Math.min(...c.ph.map(p => { const k = text.indexOf(p); return k === -1 ? 1e9 : k; }));
      if (i === 1e9) continue;
      if (c.rf) { setRfSeen(v => ({ ...v, [c.id]: "nlp" })); hits.push({ ...c, negated: false }); continue; }
      const pre = text.slice(Math.max(0, i - 14), i);
      hits.push({ ...c, negated: NEG.some(g => pre.includes(g)) });
    }
    setCaps(p => [...p, ...hits.filter(h => !p.some(q => q.id === h.id))]);
    setN(n + 1);
  };

  const heard = useMemo(() => Object.fromEntries(
    caps.filter(c => !c.rf && !c.id.startsWith("c_")).map(c => [c.id, c.negated ? "no" : c.v])), [caps]);
  const answers = useMemo(() => ({ ...heard, ...manual }), [heard, manual]);
  const sc = useScore(answers);
  const flags = RED_FLAGS.filter(f => rfSeen[f.id]);
  const routing = flags.length === 0 && reviewed && sc.scorable;

  /*  A probe is live when its trigger has fired, it hasn't been answered, and its
      target item isn't already known. That last clause is what stops the panel
      suggesting a question the patient has already answered out loud — the failure
      that makes a prompt list feel like it isn't listening.  */
  const live = useMemo(() => ALL_PROBES
    .filter(p => p.when(answers, rfSeen))
    .filter(p => probeAns[p.id] === undefined)
    // Ordinary probes retire once their target is known. A rescue does not: it exists
    // because the first phrasing may have produced a false negative, so it stays live
    // until it is either answered or its target turns positive.
    .filter(p => !(p.target && answers[p.target] !== undefined))
    .sort((a, b) => PROBE_KIND[a.kind].rank - PROBE_KIND[b.kind].rank),
    [answers, rfSeen, probeAns]);

  const answerProbe = (p, idx) => {
    const o = p.opts[idx];
    setProbeAns(v => ({ ...v, [p.id]: idx }));
    if (o.rf) setRfSeen(v => ({ ...v, [o.rf]: "probe" }));
    if (o.a) setManual(v => ({ ...v, ...o.a }));
    if (o.note) setNotes(v => [...v, o.note]);
    setOpenProbe(null);
  };
  const reset = () => { setN(0); setCaps([]); setRfSeen({}); setReviewed(false);
    setProbeAns({}); setManual({}); setNotes([]); setOpenProbe(null); };

  const byKind = k => live.filter(p => p.kind === k);
  const answeredCount = Object.keys(probeAns).length;

  return (
    <div className="grid">
      <div>
        <div className="card">
          <div className="eyebrow">Ambient capture · simulated</div>
          <h2>Encounter</h2>
          <p className="sub">Play the transcript. Findings are extracted as they are said —
            and each one opens the next thing worth asking.</p>
          <div style={{maxHeight:210,overflowY:"auto",border:"1px solid var(--line)",borderRadius:10,padding:12}}>
            {LINES.slice(0, n).map((l,i) => (
              <div key={i} style={{marginBottom:9}}>
                <span className="small" style={{fontFamily:"var(--mono)",marginRight:7}}>{l.s}</span>{l.t}</div>))}
            {n === 0 && <div className="small">Nothing captured yet.</div>}
          </div>
          <div className="nav">
            <button className="btn" disabled={n>=LINES.length} onClick={advance}>
              <Play size={15}/> {n===0?"Start encounter":n>=LINES.length?"Transcript ended":"Next line"}</button>
            <button className="btn ghost" onClick={reset}><RotateCcw size={15}/> Reset</button>
          </div>
        </div>

        {/* ---- the live prompt list ---- */}
        <div className="card">
          <div className="eyebrow">Ask next · {live.length} open{answeredCount?` · ${answeredCount} answered`:""}</div>
          <h2>While you're with the patient</h2>
          <p className="sub">Ranked by what the answer could change, not by what it scores.
            Safety first — a prompt that puts a 6-point item above “does the ringing pulse” helps you
            score faster while missing the thing that mattered.</p>

          {live.length === 0 && (
            <div className="call">{n === 0
              ? "Nothing to suggest yet — probes are triggered by findings, so start the encounter."
              : "Nothing outstanding for what's been captured so far. Keep going, or record the safety review."}</div>
          )}

          {["safety","rescue","criteria","ruleout","phenotype","exam"].map(k => byKind(k).length > 0 && (
            <div key={k}>
              <div className="gname" style={{color:PROBE_KIND[k].c}}>
                {PROBE_KIND[k].label} · {byKind(k).length}
                {k==="ruleout" && <span style={{textTransform:"none",letterSpacing:0,marginLeft:8,color:"var(--mid)"}}>
                  answers here can lower the index</span>}
                {k==="safety" && <span style={{textTransform:"none",letterSpacing:0,marginLeft:8,color:"var(--mid)"}}>
                  could surface a red flag</span>}
                {k==="rescue" && <span style={{textTransform:"none",letterSpacing:0,marginLeft:8,color:"var(--mid)"}}>
                  alternate phrasing for an item the first wording may have missed</span>}
                {k==="phenotype" && <span style={{textTransform:"none",letterSpacing:0,marginLeft:8,color:"var(--mid)"}}>
                  supporting features — recorded, never scored</span>}
              </div>
              {(k === "safety" || k === "rescue" ? byKind(k) : byKind(k).slice(0, 3)).map(p => (
                <div key={p.id} className="rf" style={{cursor:"default",display:"block",
                  borderColor: openProbe===p.id ? PROBE_KIND[k].c : undefined}}>
                  <div style={{display:"flex",gap:9,alignItems:"flex-start"}}>
                    <span className="tier" style={{background:PROBE_KIND[k].bg,color:PROBE_KIND[k].c,margin:"2px 0 0 0"}}>
                      {PROBE_KIND[k].label}</span>
                    <div style={{flex:1}}>
                      <div className="rft" style={{fontWeight:560}}>“{p.say}”</div>
                      {p.rescues && answers[p.rescues] !== undefined && (
                        <div className="rfm" style={{color:PROBE_KIND.rescue.c,fontWeight:600}}>
                          Re-asking {p.rescues} — currently recorded as{" "}
                          {String(answers[p.rescues])==="no" ? "denied" : `“${String(answers[p.rescues])}”`}.
                          A different phrasing, not a repeated question.
                        </div>
                      )}
                      <div className="rfm">{p.why}</div>
                      {openProbe === p.id ? (
                        <div className="opts" style={{marginTop:9}}>
                          {p.opts.map((o,i) => (
                            <button key={i} className="o" style={o.rf?{borderColor:"var(--coral)",color:"var(--coral)"}:undefined}
                              onClick={()=>answerProbe(p,i)}>{o.l}</button>))}
                        </div>
                      ) : (
                        <div style={{marginTop:8}}>
                          <button className="btn ghost" style={{padding:"6px 12px",fontSize:12.5,minHeight:0}}
                            onClick={()=>setOpenProbe(p.id)}>Asked — record answer</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {k !== "safety" && k !== "rescue" && byKind(k).length > 3 && (
                <div className="small" style={{marginTop:6}}>
                  +{byKind(k).length - 3} more {PROBE_KIND[k].label.toLowerCase()} probe{byKind(k).length-3===1?"":"s"} —
                  answer one above and the next moves up. Safety and re-ask probes are never truncated.
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <h2>Live screen</h2>
          <div className="kpis">
            <K label="Attainable range" value={sc.scorable?`${sc.total}`:`${sc.floor}–${sc.ceiling}`}
               detail={sc.scorable?sc.band:"spans a cutpoint — no band"}/>
            <K label="Coverage" value={sc.coverage+"%"} detail={`${sc.answered} of ${ALL.length} items`}/>
            <K label="Captured" value={caps.length+answeredCount} detail={`${caps.length} heard · ${answeredCount} asked`}/>
            <K label="Routing" value={routing?"issued":"withheld"}
               color={routing?undefined:"var(--amber)"}
               detail={flags.length?"red flag open":!reviewed?"safety review not recorded":!sc.scorable?"screen not scorable":"—"}/>
          </div>
          {(caps.length>0 || Object.keys(manual).length>0) && (
            <table><thead><tr><th>Finding</th><th>Value</th><th>Source</th></tr></thead><tbody>
              {caps.map((c,i)=>(
                <tr key={"c"+i}><td>{c.rf?<b style={{color:"var(--coral)"}}>RED FLAG: {RED_FLAGS.find(f=>f.id===c.id)?.p}</b>
                  :(ALL.find(a=>a.id===c.id)?.t || c.id)}</td>
                  <td style={{fontFamily:"var(--mono)"}}>{c.rf?"raised":c.negated?"no":String(c.v)}</td>
                  <td className="small">heard</td></tr>))}
              {Object.entries(manual).map(([id,v])=>(
                <tr key={"m"+id}><td>{ALL.find(a=>a.id===id)?.t || id}</td>
                  <td style={{fontFamily:"var(--mono)"}}>{String(v)}</td>
                  <td className="small">asked</td></tr>))}
              {Object.entries(rfSeen).filter(([,src])=>src==="probe").map(([id])=>(
                <tr key={"r"+id}><td><b style={{color:"var(--coral)"}}>RED FLAG: {RED_FLAGS.find(f=>f.id===id)?.p}</b></td>
                  <td style={{fontFamily:"var(--mono)"}}>raised</td>
                  <td className="small">asked</td></tr>))}
            </tbody></table>
          )}
          {notes.length>0 && (
            <div className="call"><b>Recorded, not scored.</b> Exam manoeuvres have no item in a
              questionnaire-only instrument, and the vestibular-migraine supporting features are not Bárány
              criteria. Both move the index by exactly zero. Totalling them would invent a measurement
              instrument v0.2 does not make — they are v0.3 candidates and a version bump, not something a
              prompt panel decides.
              <ul style={{margin:"6px 0 0 18px"}}>{notes.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
          )}
          {flags.length>0 && <div className="call bad"><b>Red flag open — routing withheld.</b>{" "}
            {flags.map(f=>`${f.p}: ${f.act}`).join(" · ")}. Capture may raise a flag but never clear one;
            a denial later in the transcript would not remove it.</div>}
          {!reviewed && flags.length===0 && n>0 && (
            <div className="call warn"><b>Safety review outstanding.</b> No routing is issued until it's recorded,
              and the draft note says so in capitals.
              <div style={{marginTop:8}}><button className="btn ghost" onClick={()=>setReviewed(true)}>
                <ShieldCheck size={15}/> Record: none apply</button></div></div>)}
        </div>
      </div>

      <div className="rail">
        <div className="card">
          <div className="eyebrow">What to notice</div>
          <div className="probe" style={{cursor:"default"}}>
            <TriangleAlert size={14} style={{flex:"0 0 auto",marginTop:2,color:"var(--coral)"}}/>
            <div><div className="pl">The red flag is not in the transcript</div><div className="pw">
              The patient says “there's a ringing” and stops. Laterality and pulsatility only surface if you ask —
              which is the entire point of the prompt. Ambient capture hears what was said, not what wasn't.</div></div>
          </div>
          <div className="probe" style={{cursor:"default"}}>
            <Zap size={14} style={{flex:"0 0 auto",marginTop:2,color:"#7A4DA8"}}/>
            <div><div className="pl">Answer “No” to the vertigo item</div><div className="pw">
              The re-ask probes stay live and offer the rocking, visual-trigger and positional phrasings.
              Bárány counts five qualifying symptom types and internal vertigo outnumbers spinning in
              published cohorts, so one wording of one question decides the whole vestibular arm.</div></div>
          </div>
          <div className="probe" style={{cursor:"default"}}>
            <Zap size={14} style={{flex:"0 0 auto",marginTop:2,color:"var(--amber)"}}/>
            <div><div className="pl">Rule-outs outrank index items</div><div className="pw">
              A prompt list that only asks questions capable of confirming its own hypothesis is a leading
              question with a progress bar.</div></div>
          </div>
          <div className="probe" style={{cursor:"default"}}>
            <ScanLine size={14} style={{flex:"0 0 auto",marginTop:2,color:"var(--petrol)"}}/>
            <div><div className="pl">Criteria probes cost more than their weight</div><div className="pw">
              Episode count is worth 4 points and is Bárány criterion A. Miss it and the screen cannot be
              crosswalked to a diagnosis at all.</div></div>
          </div>
          <div className="probe" style={{cursor:"default"}}>
            <Info size={14} style={{flex:"0 0 auto",marginTop:2,color:"var(--mid)"}}/>
            <div><div className="pl">Supporting features stay notes</div><div className="pw">
              Childhood carsickness, osmophobia and a positive Dix–Hallpike all change your thinking and move
              the index by zero. They are not Bárány criteria and v0.2 has no item for them — scoring them
              would be inventing a measurement. They are tagged as v0.3 candidates instead.</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
