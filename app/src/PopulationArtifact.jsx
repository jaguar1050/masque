import React from "react";

/*  Project MASQUE — renderer for a design-aware population-estimates artifact

    Extracted from ResearchReadinessPanel.jsx so that the Population page
    (app/population.html) and the panel's population tab render one artifact the same
    way, from one file.

    Deliberately dumb: it formats and displays. Every number, interval, degrees of
    freedom and suppression decision was made by the ETL, which had the strata and
    the PSUs. Adding any arithmetic here would reintroduce exactly the naive-variance
    problem the split exists to avoid.

    Two things this version does that the inline original did not, both because the
    ETL's own output showed the need:

    - The total/subgroup split is type-safe. An estimate is a total when it carries no
      string `domain`; anything else (an accidental `{}` from a serializer, a number)
      is not a subgroup label and must not be rendered as one.
    - Rows are formatted by what they are. `unit` from the artifact wins; a known
      name (`phenotype_prevalence`, `annual_cost_mean`, `avoidable_cost_mean`) supplies
      a label and a unit when the artifact predates the field; an unknown quantity
      is shown under its raw name with "unit not declared" and is never run through a
      percent formatter. A MEPS cost artifact therefore renders in dollars beside an
      NHIS prevalence artifact rendered in percent — each with its own source, design
      and caveats, never merged (README_DATA_CONNECTION.md: a cost figure is never
      carried across from another survey).

    Audit fixes (docs/refactor/02-app-divergences.md, "Audit fixes — research and data"):
    - A row is printed only when the artifact says `suppress: false` AND carries a finite
      estimate and a finite two-number interval (isSuppressed). A missing flag, a string
      "false", or a [null, null] interval reads as suppressed, never as a number.
    - Every list the renderer walks is Array.isArray-guarded, and the default export sits
      inside an error boundary: an artifact the renderer cannot draw is reported, with
      nothing from it shown, instead of blanking the host page.
    - money(): a value that rounds to $1000.0 million is shown as $1.00 billion.
*/

const QUANTITIES = {
  phenotype_prevalence: { label: "Phenotype prevalence", unit: "proportion" },
  phenotype_visit_share: { label: "Share of adult office visits", unit: "proportion" },
  headache_share_of_sinusitis_visits: { label: "Headache share of sinusitis visits", unit: "proportion" },
  phenotype_report_share: { label: "Share of adverse-event reports", unit: "proportion" },
  headache_share_of_sinusitis_reports: { label: "Headache share of sinusitis reports", unit: "proportion" },
  headache_share_of_sinusitis_adults: { label: "Headache share of adults with sinusitis", unit: "proportion" },
  sinus_care_spend_mean_all:  { label: "Sinusitis-care spending per person, all with sinusitis", unit: "usd" },
  sinus_care_spend_total_all: { label: "Sinusitis-care spending, national total, all with sinusitis", unit: "usd" },
  sinus_care_spend_mean_with_headache:  { label: "Sinusitis-care spending per person, with headache or migraine", unit: "usd" },
  sinus_care_spend_total_with_headache: { label: "Sinusitis-care spending, national total, with headache or migraine", unit: "usd" },
  sinus_care_spend_annual_total_all: { label: "Sinusitis-care spending, average annual national total, all with sinusitis", unit: "usd" },
  sinus_care_spend_annual_total_with_headache: { label: "Sinusitis-care spending, average annual national total, with headache or migraine", unit: "usd" },
  annual_cost_mean:     { label: "Mean annual cost",     unit: "usd" },
  avoidable_cost_mean:  { label: "Mean avoidable cost",  unit: "usd" },
};

// One decimal: national surveys give intervals narrower than a percentage point, and
// whole-percent rounding would hide the differences the table exists to show.
export function pct(v)   { if (!Number.isFinite(v)) return "—"; const p = v * 100; return `${p !== 0 && Math.abs(p) < 1 ? p.toFixed(2) : p.toFixed(1)}%`; }
// National totals carry intervals hundreds of millions of dollars wide; printing them to the
// dollar would state a precision the survey does not have.
// The unit is chosen on the ROUNDED value, so 999.96 million prints as $1.00 billion, not
// "$1000.0 million", and $999,999.60 as $1.0 million, not "$1,000,000".
export function money(v) {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v), sign = v < 0 ? "-" : "";
  if (a >= 1e9 || Number((a / 1e6).toFixed(1)) >= 1000) return `${sign}$${(a / 1e9).toFixed(2)} billion`;
  if (a >= 1e6 || Math.round(a) >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)} million`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export function isTotal(e)  { return !(e && typeof e.domain === "string" && e.domain.length > 0); }
const isRow = (e) => e !== null && typeof e === "object" && !Array.isArray(e);
const arr = (v) => (Array.isArray(v) ? v : []);
/*  Printable only when the producing script said so in so many words (suppress === false) and
    the row carries a finite estimate and a finite 95% interval. Anything else — no flag, a
    non-boolean flag, an interval of nulls — is shown as suppressed. */
export function isSuppressed(e) {
  return !isRow(e) || e.suppress !== false || !Number.isFinite(e.estimate)
    || !Array.isArray(e.ci) || e.ci.length !== 2 || !e.ci.every(Number.isFinite);
}
/** Why a row is not printed, in the producing script's words when it gave any. */
export function suppressNote(e) {
  if (isRow(e) && e.suppress === true) return e.suppressReason || "suppressed by the producing script";
  if (!isRow(e) || e.suppress !== false) return "suppressed: the artifact does not mark this row reportable";
  return "suppressed: the artifact carries no finite estimate and 95% interval for this row";
}
export function unitOf(e)   { return e.unit || QUANTITIES[e.name]?.unit || null; }
export function labelOf(e)  { return QUANTITIES[e.name]?.label || e.name; }
// NAMCS codes are the physician's visit diagnoses; MEPS codes are household-reported
// conditions that AHRQ coded. Calling the latter "diagnoses" would overstate them.
export function codeNoun(art) { return art?.unitOfAnalysis === "visit" ? "diagnosis codes" : "condition codes"; }
export function unitNoun(art) { return art?.unitOfAnalysis === "visit" ? "visits" : art?.unitOfAnalysis === "report" ? "reports" : "respondents"; }
export function eligibilityText(el) {
  if (!el) return "";
  const parts = [];
  if (el.var) parts.push(`${el.var}${el.min != null ? ` ≥ ${el.min}` : ""}${el.max != null ? ` ≤ ${el.max}` : ""}`);
  if (el.concept) parts.push(`${el.concept} recorded`);
  return parts.join(", ");
}
export function hasCostRows(art) { return arr(art?.estimates).some(e => isRow(e) && unitOf(e) === "usd"); }

export function fmtValue(e, v = e.estimate) {
  const u = unitOf(e);
  if (u === "proportion") return pct(v);
  if (u === "usd") return money(v);
  if (u === "count" || u === "years") return Number.isFinite(v) ? `${Math.round(v * 100) / 100} ${u === "years" ? "yr" : ""}`.trim() : "—";
  return Number.isFinite(v) ? `${v} (unit not declared)` : "—";
}
function fmtCi(e) {
  if (!Array.isArray(e.ci) || e.ci.length < 2) return "no interval";
  return `95% CI ${fmtValue(e, e.ci[0])}–${fmtValue(e, e.ci[1])}`;
}
function axesOf(rows) {
  const out = new Set();
  for (const e of rows) if (!isTotal(e)) out.add(String(e.domain).split("=")[0]);
  return out;
}

const CSS = `
.pa{font-size:13px;line-height:1.45;color:#0C2B2F}
.pa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:6px 0 12px}
.pa-kpi{border:1px solid #D7E1DF;border-radius:10px;padding:10px 12px;background:#fff;min-width:0}
.pa-k{font-family:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#5C6E6C}
.pa-v{font-size:22px;font-weight:650;margin-top:2px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.pa-small{font-size:11px;color:#5C6E6C;margin-top:3px;overflow-wrap:anywhere}
.pa-table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:12.5px}
.pa-table th,.pa-table td{text-align:left;padding:6px 8px;border-bottom:1px solid #D7E1DF;vertical-align:top}
.pa-table th{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#5C6E6C;font-weight:600}
.pa-mid{color:#5C6E6C;font-style:italic}
.pa-call{border:1px solid #D7E1DF;border-radius:10px;padding:10px 12px;margin-top:8px;background:#F4F8F7;font-size:12.5px}
.pa-warn{background:#F6ECD9;border-color:#E4C88E;color:#6B4A18}
.pa-call ul{margin:6px 0 0 18px;padding:0}
.pa-code{font-family:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;font-size:11px;overflow-wrap:anywhere}
.pa-btn{font:inherit;font-size:12.5px;cursor:pointer;border-radius:8px;padding:7px 11px;border:1px solid #D7E1DF;background:#fff;margin-top:10px}
.pa-btn:hover{border-color:#137A80}
`;

/*  Error boundary: a render failure inside one artifact is reported in place (with the
    clear button, when the host offers one) instead of unmounting the host page. */
class ArtifactBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.art !== this.props.art && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pa" data-testid="pa-render-error">
        <style>{CSS}</style>
        <div className="pa-call pa-warn"><b>This artifact could not be rendered.</b> Nothing from it is shown. {String(this.state.error && this.state.error.message || this.state.error)}</div>
        {this.props.onClear && <button className="pa-btn" onClick={this.props.onClear}>Clear artifact and show cohort figures</button>}
      </div>
    );
  }
}

export default function PopulationArtifact(props) {
  return <ArtifactBoundary art={props.art} onClear={props.onClear}><ArtifactBody {...props} /></ArtifactBoundary>;
}

function ArtifactBody({ art: artIn, onClear }) {
  const art = isRow(artIn) ? artIn : {};
  const src = isRow(art.source) ? art.source : {}, d = isRow(art.design) ? art.design : {}, ph = isRow(art.phenotype) ? art.phenotype : {};
  const rows = arr(art.estimates).filter(isRow);
  const total = rows.filter(isTotal), byDomain = rows.filter(e => !isTotal(e));
  const axes = axesOf(rows);
  const genderMissing = !axes.has("gender");
  const varMap = isRow(ph.variableMap) ? Object.entries(ph.variableMap) : [];
  const rule = isRow(ph.rule) ? ph.rule : null;
  const unmapped = arr(ph.unmapped);
  const caveats = arr(art.caveats);
  const el = isRow(ph.eligibility) ? ph.eligibility : null;
  const show = e => isSuppressed(e)
    ? <span className="pa-mid">suppressed</span>
    : <>{fmtValue(e)}<div className="pa-small">{fmtCi(e)}</div></>;

  return (
    <div className="pa">
      <style>{CSS}</style>
      <div className="pa-grid">
        {total.map((e, i) => (
          <div className="pa-kpi" key={i}>
            <div className="pa-k">{labelOf(e)}</div>
            <div className="pa-v">{isSuppressed(e) ? "—" : fmtValue(e)}</div>
            <div className="pa-small">{isSuppressed(e) ? suppressNote(e) : `${fmtCi(e)} · unweighted n=${e.unweightedN} · df=${e.df ?? "—"}`}</div>
          </div>
        ))}
        {total.length === 0 && <div className="pa-kpi"><div className="pa-k">Total</div><div className="pa-v">—</div><div className="pa-small">the artifact carries subgroup rows only</div></div>}
        <div className="pa-kpi"><div className="pa-k">Source</div><div className="pa-v" style={{fontSize:16}}>{src.dataset || "?"} {src.cycle || ""}</div><div className="pa-small">{src.file || "file not named"}{src.steward ? ` · ${src.steward}` : ""}</div></div>
        <div className="pa-kpi"><div className="pa-k">Variance method</div><div className="pa-v" style={{fontSize:16}}>{d.varianceMethod || "—"}</div><div className="pa-small">weight {d.weight} · strata {d.strata} · PSU {d.psu}{d.nest ? " · nested" : ""}{d.domainAnalysis ? " · subgroups by design subset" : ""}</div></div>
      </div>

      {byDomain.length > 0 && (
        <table className="pa-table">
          <thead><tr><th>Subgroup</th><th>Quantity</th><th>Estimate</th><th>Unweighted n</th><th>df</th></tr></thead>
          <tbody>{byDomain.map((e, i) => (
            <tr key={i}><td className="pa-code">{String(e.domain)}</td><td>{labelOf(e)}</td><td>{show(e)}</td><td>{e.unweightedN}</td><td>{e.df ?? "—"}</td></tr>
          ))}</tbody>
        </table>
      )}

      {genderMissing && (
        <div className="pa-call"><b>Gender: not available in this cycle.</b> Subgroup estimates above are by sex only. Gender is never substituted from sex; when a cycle carries a gender-identity item, gender rows appear here as a separate axis.</div>
      )}

      <div className="pa-call"><b>Phenotype.</b> {ph.definition || "not stated"}
        {rule && <div className="pa-small" style={{marginTop:4}}>rule: all of [{arr(rule.all).join(", ")}] and any of [{arr(rule.any).join(", ")}]{rule.completeCase ? " · complete cases only" : ""}</div>}
        {ph.mapFile && <div className="pa-small" style={{marginTop:4}}>map {ph.mapFile} v{ph.mapVersion}</div>}
        {varMap.length > 0 && (
          <ul>{varMap.map(([concept, vars]) => (
            <li key={concept} className="pa-code">{concept}: {isRow(ph.codeMap) && Array.isArray(ph.codeMap[concept]) ? `${codeNoun(art)} ${ph.codeMap[concept].join(", ")}` : isRow(ph.termMap) && Array.isArray(ph.termMap[concept]) ? `MedDRA terms ${ph.termMap[concept].join(", ")}` : Array.isArray(vars) && vars.length ? vars.join(", ") : (typeof vars === "string" && vars ? vars : "unmapped")}
              {isRow(ph.questionText) && ph.questionText[concept] ? <div style={{fontFamily:"inherit",color:"#5C6E6C",marginTop:2}}>{String(ph.questionText[concept])}</div> : null}</li>
          ))}</ul>
        )}
      </div>
      {art.unitOfAnalysis === "report" && (
        <div className="pa-call pa-warn"><b>Adverse-event reports, not people.</b> FAERS is a voluntary reporting database with no sampling design and no count of people exposed to any drug. This figure describes the reports in this dataset; it is not a prevalence and cannot be compared with the survey or office-visit rows.</div>
      )}
      {art.unitOfAnalysis === "visit" && (
        <div className="pa-call pa-warn"><b>Office visits, not people.</b> Each record is one sampled physician office visit. A patient seen several times counts several times, and a condition not coded at that visit counts as absent, so this is a share of visits and is not comparable to a population prevalence.</div>
      )}
      {el && (el.var || el.concept) && (
        <div className="pa-call"><b>Population.</b> {eligibilityText(el)} — {String(el.reason ?? "")}
          {Number.isFinite(el.eligibleRespondents) && <div className="pa-small">{el.eligibleRespondents.toLocaleString()} of {Number(el.allRespondents).toLocaleString()} {unitNoun(art)} eligible; the denominator below is the eligible {art.unitOfAnalysis === "visit" || art.unitOfAnalysis === "report" ? unitNoun(art) : "respondents with complete phenotype items"}</div>}
        </div>
      )}
      {unmapped.length > 0 && <div className="pa-call pa-warn"><b>Narrower than proposal §7.1.</b> This cycle could not express: {unmapped.join(", ")}. The phenotype measured here is not the phenotype defined in the proposal, and the difference is stated rather than absorbed.</div>}
      {caveats.length > 0 && <div className="pa-call pa-warn"><b>Caveats (from the producing script).</b><ul>{caveats.map((c, i) => <li key={i}>{String(c)}</li>)}</ul></div>}
      <div className="pa-call"><b>Provenance.</b> {art.producedBy || "producer not stated"} · generated {art.generatedAt || "—"}{src.downloadedAt ? ` · source downloaded ${src.downloadedAt}` : " · source download date not recorded"}
        {src.sha256 && <div className="pa-small pa-code" style={{marginTop:4}}>source sha256 {String(src.sha256)}</div>}
        {src.url && <div className="pa-small pa-code">{src.url}</div>}
      </div>
      {onClear && <button className="pa-btn" onClick={onClear}>Clear artifact and show cohort figures</button>}
    </div>
  );
}
