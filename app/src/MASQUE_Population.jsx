import React, { useState, useEffect } from "react";
import { BarChart3, Info, ShieldCheck, TriangleAlert, Database, FileJson, Terminal } from "lucide-react";
import PopulationArtifact, { hasCostRows, isTotal, fmtValue, eligibilityText } from "./PopulationArtifact.jsx";
import { checkSchema, checkArtifactMarker } from "./MASQUE_SchemaCheck.js";

/*  Project MASQUE — Population estimates page
    ------------------------------------------------------------------
    The open-data half of the proposal (§1, §4, §7.3 first output, §9 weeks 4–7 and
    11–12): hidden-prevalence estimates of the recalcitrant-ENT phenotype computed
    from U.S. public-use survey files.

    This page does no arithmetic. Every number it shows was produced offline by
    app/etl/masque_population_etl.R, which had the strata, the PSUs and the survey
    weights; the page fetches the committed artifact, checks it against the schema
    the ETL was written to, and renders it. See app/etl/README_DATA_CONNECTION.md for
    why the split is not negotiable.

    Three states, and only three:
      - no artifact listed     -> says so, in words, and shows the live state of the
                                  variable map plus the exact command that would
                                  produce one. Nothing on the page is a number.
      - artifact fails checks  -> refused, with the failures printed. Never rendered.
      - artifact passes        -> rendered, with its caveats, unmapped concepts,
                                  design specification and source hash.

    Adding an estimate is a data commit, not a code change: run the ETL, commit the
    JSON under app/data/, add one line to population-estimates.index.json.
*/

const APP_VERSION = "0.3.0";
const INDEX_PATH  = "./data/population-estimates.index.json";
const SCHEMA_PATH = "./etl/population_estimates.schema.json";
const MAP_PATH    = "./etl/phenotype_map_nhis_2024.json";
const ETL_COMMAND =
  "Rscript app/etl/masque_population_etl.R \\\n" +
  "  --data           ./adult24.csv \\\n" +
  "  --map            app/etl/phenotype_map_nhis_2024.json \\\n" +
  "  --out            app/data/population-estimates.nhis-2024.json \\\n" +
  "  --downloaded-at  YYYY-MM-DD";

const CSS = `
:root{--ink:#0C2B2F;--petrol:#0F5C61;--petrol2:#137A80;--surface:#EDF3F1;--panel:#FFFFFF;
--line:#D7E1DF;--muted:#5C6E6C;--amber:#B26C1F;--amberbg:#F6ECD9;--coral:#B84A33;--coralbg:#F6E1DA;
--green:#2C7A57;--greenbg:#E0EEE7;--slate:#4F6466;
--mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
*{box-sizing:border-box}
.pop{font-family:var(--sans);color:var(--ink);background:var(--surface);min-height:100%;-webkit-font-smoothing:antialiased;line-height:1.45}
.pop .wrap{max-width:1080px;margin:0 auto;padding:16px 16px 64px}
.pop h1,.pop h2,.pop h3{margin:0;font-weight:650;letter-spacing:-.01em}
.pop .brandrow{display:flex;align-items:center;gap:12px;margin:18px 2px 4px}
.pop .mark{width:34px;height:34px;border-radius:9px;background:var(--petrol);color:#fff;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.pop .t1{font-size:18px;font-weight:700;letter-spacing:-.02em}.pop .t2{font-size:12.5px;color:var(--muted)}
.pop .num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.pop .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;margin-top:14px}
.pop .chdr{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.pop .chdr .ct{font-size:13px;font-weight:660}.pop .chdr .ce{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--petrol);font-weight:600}
.pop .empty{font-size:14px;padding:8px 0 4px}
.pop .empty b{font-size:15px}
.pop .call{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:10px;font-size:12.5px;background:#F4F8F7}
.pop .call.warn{background:var(--amberbg);border-color:#E4C88E;color:#6B4A18}
.pop .call.bad{background:var(--coralbg);border-color:#E3B3A6;color:#6E3020}
.pop .steps{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:10px}
.pop .step{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12.5px;background:#fff}
.pop .step b{display:block;font-size:12px;margin-bottom:3px}
.pop .step .n{font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--petrol);text-transform:uppercase}
.pop table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12.5px}
.pop th,.pop td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.pop th{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
.pop .st{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;border-radius:5px;padding:2px 6px;white-space:nowrap}
.pop .st.todo{background:var(--amberbg);color:#7A4E12}.pop .st.unmapped{background:#E9EEED;color:var(--slate)}.pop .st.mapped{background:var(--greenbg);color:#1E5A40}
.pop .sumwrap{overflow-x:auto;margin-top:4px}
.pop table.sum{min-width:760px}
.pop table.sum td.v{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.pop table.sum td.v small{display:block;color:var(--muted);font-size:10.5px}
.pop table.sum td.src b{display:block;font-size:12.5px}
.pop table.sum td.src span{font-size:11px;color:var(--muted)}
.pop .arm{display:inline-block;font-family:var(--mono);font-size:10px;border:1px solid var(--line);border-radius:5px;padding:1px 5px;margin:1px 3px 1px 0;background:#fff}
.pop .rev{display:grid;gap:10px;margin-top:4px}
.pop .revi{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff;font-size:12.5px}
.pop .revh{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px}
.pop .revh b{font-size:13px}
.pop .revi p{margin:4px 0 0}
.pop .revi .wc{color:var(--muted)}
.pop pre{font-family:var(--mono);font-size:11.5px;line-height:1.55;white-space:pre;overflow:auto;background:#0C2B2F;color:#CFE6E2;border-radius:11px;padding:13px;margin:8px 0 0}
.pop ul{margin:6px 0 0 18px;padding:0}.pop li{margin:2px 0}
.pop code{font-family:var(--mono);font-size:11.5px;background:#F1F5F4;border:1px solid var(--line);border-radius:5px;padding:1px 5px}
.pop .notew{font-size:11.5px;color:var(--muted);display:flex;gap:7px;margin-top:12px;align-items:flex-start}
.pop .foot{font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.04em;text-align:center;margin-top:22px}
.pop a{color:var(--petrol)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

async function fetchJson(rel) {
  // Modules run from blob: URLs under the loader, so resolve against the page, not the module.
  const url = new URL(rel, document.baseURI).href;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${rel}`);
  return res.json();
}

function conceptStatus(c) {
  const s = String((c && c._status) || "");
  if (s.toUpperCase().startsWith("TODO")) return "todo";
  if (s === "unmapped" || (Array.isArray(c?.vars) && c.vars.length === 0 && s !== "")) return s === "unmapped" ? "unmapped" : "todo";
  if (Array.isArray(c?.vars) && c.vars.length > 0) return "mapped";
  return "todo";
}

export default function MasquePopulation() {
  const [st, setSt] = useState({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = { phase: "ready", schema: null, schemaError: null, map: null, mapError: null,
                    index: null, indexError: null, artifacts: [] };
      try { out.schema = await fetchJson(SCHEMA_PATH); } catch (e) { out.schemaError = e.message; }
      try { out.map    = await fetchJson(MAP_PATH);    } catch (e) { out.mapError = e.message; }
      try { out.index  = await fetchJson(INDEX_PATH);  } catch (e) { out.indexError = e.message; }
      const entries = Array.isArray(out.index?.artifacts) ? out.index.artifacts : [];
      for (const entry of entries) {
        const path = typeof entry === "string" ? entry : entry?.path;
        const rec = { path: path || "(no path)", entry, art: null, errors: [] };
        if (!path) { rec.errors.push("index entry has no path"); out.artifacts.push(rec); continue; }
        try {
          const art = await fetchJson(path);
          rec.errors.push(...checkArtifactMarker(art));
          if (out.schema) rec.errors.push(...checkSchema(out.schema, art));
          else rec.errors.push("the schema could not be loaded, so the artifact was not validated and is not rendered");
          rec.art = art;
        } catch (e) { rec.errors.push(e.message); }
        out.artifacts.push(rec);
      }
      if (!cancelled) setSt(out);
    })();
    return () => { cancelled = true; };
  }, []);

  const valid   = st.artifacts ? st.artifacts.filter(a => a.art && a.errors.length === 0) : [];
  const refused = st.artifacts ? st.artifacts.filter(a => a.errors.length > 0) : [];
  const anyCost = valid.some(a => hasCostRows(a.art));
  const mapVersion = st.map?._meta?.mapVersion;
  const concepts = st.map ? Object.entries(st.map.phenotype_concepts || {}).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v)) : [];
  const definition = st.map?.phenotype_definition || "";
  const definitionTodo = !definition.trim() || definition.trim().toUpperCase().startsWith("TODO");

  return (
    <div className="pop">
      <style>{CSS}</style>
      <div className="wrap">

        <div className="brandrow">
          <div className="mark"><BarChart3 size={18} /></div>
          <div>
            <div className="t1">MASQUE Population <span className="num" style={{fontSize:12,color:"var(--muted)",fontWeight:400}}>v{APP_VERSION}</span></div>
            <div className="t2">Hidden-prevalence estimates from U.S. open data — computed offline with the survey design, rendered here without arithmetic</div>
          </div>
        </div>

        <div className="card">
          <div className="chdr"><Database size={16} color="var(--petrol)" /><div><div className="ce">How a number gets here</div><div className="ct">Open in, open out</div></div></div>
          <div className="steps">
            <div className="step"><span className="n">1 · map</span><b>Name the survey variables</b>The §7.1 phenotype is a versioned map from concepts to public-use variables, with the question wording recorded so it can be reviewed.</div>
            <div className="step"><span className="n">2 · estimate</span><b>Run the ETL offline</b><code>masque_population_etl.R</code> builds a proper survey design (weight, strata, PSUs), subsets the design for subgroups, applies the NCHS suppression rule, and hashes the source file.</div>
            <div className="step"><span className="n">3 · commit</span><b>Commit the artifact</b>The JSON it writes is checked against <code>population_estimates.schema.json</code> and listed in the index. This page renders it; it never recomputes it.</div>
          </div>
        </div>

        {st.phase === "loading" && <div className="card"><div className="empty">Loading…</div></div>}

        {st.phase === "ready" && valid.length > 1 && <SummaryTable artifacts={valid} />}

        {st.phase === "ready" && valid.map(a => (
          <div className="card" key={a.path}>
            <div className="chdr"><FileJson size={16} color="var(--petrol)" /><div><div className="ce">Population estimate</div><div className="ct num">{a.path}</div></div></div>
            <PopulationArtifact art={a.art} />
          </div>
        ))}

        {st.phase === "ready" && Array.isArray(st.index?.reviewed) && st.index.reviewed.length > 0 && <ReviewedSources items={st.index.reviewed} />}

        {st.phase === "ready" && refused.map(a => (
          <div className="card" key={a.path}>
            <div className="chdr"><TriangleAlert size={16} color="var(--coral)" /><div><div className="ce" style={{color:"var(--coral)"}}>Artifact refused</div><div className="ct num">{a.path}</div></div></div>
            <div className="call bad">
              <b>Not rendered.</b> The listed file does not satisfy the artifact contract, so nothing from it is shown. Fix the ETL output or the index entry; do not edit the numbers by hand.
              <ul>{a.errors.map((e, i) => <li key={i} className="num">{e}</li>)}</ul>
            </div>
          </div>
        ))}

        {st.phase === "ready" && valid.length === 0 && (
          <div className="card">
            <div className="chdr"><Info size={16} color="var(--amber)" /><div><div className="ce" style={{color:"var(--amber)"}}>Status</div><div className="ct">No population estimate has been produced yet</div></div></div>
            <div className="empty">
              <b>Nothing on this page is a number.</b> The estimator, the schema and this renderer exist; what does not exist yet is a run of the estimator on a public-use file. The state of the variable map below is live — it is read from the same file the ETL reads — and the command beneath it is the one that would produce the first artifact.
            </div>
            {st.indexError && <div className="call warn"><b>Index unreadable.</b> {st.indexError} — expected <code>{INDEX_PATH}</code> containing <code>{"{ \"artifacts\": [] }"}</code>.</div>}
            {st.schemaError && <div className="call warn"><b>Schema unreadable.</b> {st.schemaError} — no artifact can be validated, so none would be rendered even if listed.</div>}

            <div className="chdr" style={{marginTop:14}}><Terminal size={15} color="var(--petrol)" /><div><div className="ce">Variable map</div><div className="ct">{st.map ? `${st.map._meta?.dataset || "?"} ${st.map._meta?.cycle || ""} · ${st.map._meta?.mapFile || MAP_PATH} v${mapVersion || "?"}` : "not loaded"}</div></div></div>
            {st.mapError && <div className="call warn">{st.mapError}</div>}
            {st.map && (
              <>
                <table>
                  <thead><tr><th>Concept</th><th>Status</th><th>Variables</th><th>Question wording recorded</th></tr></thead>
                  <tbody>
                    {concepts.map(([name, c]) => {
                      const s = conceptStatus(c);
                      return (
                        <tr key={name}>
                          <td className="num">{name}</td>
                          <td><span className={"st " + s}>{s === "todo" ? "TODO" : s}</span></td>
                          <td className="num">{Array.isArray(c.vars) && c.vars.length ? c.vars.join(", ") : "—"}</td>
                          <td>{c.questionText ? "yes" : "no"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="call" style={{marginTop:10}}>
                  <b>Phenotype definition:</b> {definitionTodo ? <span className="st todo" style={{marginLeft:6}}>TODO — not yet written</span> : definition}
                  <div style={{marginTop:6,fontSize:12,color:"var(--muted)"}}>
                    Design block: weight <code>{st.map.design?.weight}</code> · strata <code>{st.map.design?.strata}</code> · PSU <code>{st.map.design?.psu}</code>{st.map.design?.nest ? " · nested" : ""} — verified against the steward's documentation. The ETL refuses to run while any concept is TODO or the definition is unwritten; declaring a concept <code>unmapped</code> is an explicit decision that the artifact then reports.
                  </div>
                </div>
              </>
            )}

            <div className="chdr" style={{marginTop:14}}><Terminal size={15} color="var(--petrol)" /><div><div className="ce">To produce the first artifact</div><div className="ct">One codebook lookup, one download, one command</div></div></div>
            <ol style={{margin:"6px 0 0 18px",padding:0,fontSize:12.5}}>
              <li>Fill the symptom block of the map from the cycle's codebook, or set a concept to <code>unmapped</code> if the cycle cannot express it. NHIS carries dizziness and headache only in some cycles; NHANES 1999–2004 is the one range where headache, audiometry and the balance exam coexist, and needs its own map file with the NHANES design block.</li>
              <li>Download the public-use file (no credentialing for NHIS or NHANES) and note the date.</li>
              <li>Run the ETL — R with <code>survey</code>, <code>jsonlite</code> and <code>digest</code> — then commit the JSON under <code>app/data/</code> and add its path to the index.</li>
            </ol>
            <pre>{ETL_COMMAND}</pre>
            <div className="notew"><ShieldCheck size={13} style={{flex:"0 0 auto",marginTop:1}} /><span>Cost of illness (§2, §7.3) needs MEPS, which has its own design variables and its own map file. A cost figure is never carried across from another survey's artifact.</span></div>
          </div>
        )}

        {st.phase === "ready" && valid.length > 0 && !anyCost && (
          <div className="card">
            <div className="notew" style={{marginTop:0}}><Info size={13} style={{flex:"0 0 auto",marginTop:1}} /><span><b>No cost estimate is listed.</b> Prevalence above comes from an interview survey; the cost-of-illness half (§2, §7.3) needs MEPS with its own map and design block, and appears here as a separate artifact when produced.</span></div>
          </div>
        )}

        <div className="card">
          <div className="notew" style={{marginTop:0}}><ShieldCheck size={13} style={{flex:"0 0 auto",marginTop:1}} /><span>
            Screening-level phenotype prevalence, not diagnosed prevalence. These data carry no vestibular-testing or ICHD/Bárány reference standard; figures are hypothesis-generating estimates, not diagnostic counts (proposal §11). Every artifact repeats this in its own caveats.
          </span></div>
        </div>

        <p className="foot">PROTOTYPE · not for clinical use · screening-level, not diagnosed prevalence · this page performs no arithmetic<br/>app {APP_VERSION}{mapVersion ? ` · map ${mapVersion}` : ""}{valid.length ? ` · ${valid.length} artifact${valid.length === 1 ? "" : "s"} rendered` : " · no artifact rendered"}</p>
      </div>
    </div>
  );
}

/*  Cross-source summary. One row per rendered artifact, every figure read from that
    artifact as the ETL wrote it: no pooling, no averaging, no differences computed.
    The columns exist so a reader can see WHY two rows differ before comparing them:
    the population, the headache item and the otologic arms are part of each row's
    phenotype definition, and rows with different definitions are not the same
    measurement.
*/
function SummaryTable({ artifacts }) {
  const bySex = (art, lvl) => (art.estimates || []).find(e => e.domain === `sex=${lvl}`);
  const cell = e => !e ? <td className="v">—</td>
    : e.suppress ? <td className="v">suppressed<small>{e.suppressReason ? "NCHS standard" : ""}</small></td>
    : <td className="v">{fmtValue(e)}<small>{Array.isArray(e.ci) ? `${fmtValue(e, e.ci[0])}–${fmtValue(e, e.ci[1])}` : "no interval"}</small></td>;
  return (
    <div className="card">
      <div className="chdr"><BarChart3 size={16} color="var(--petrol)" /><div><div className="ce">Across sources</div><div className="ct">Phenotype prevalence by survey and cycle</div></div></div>
      <div className="sumwrap">
        <table className="sum">
          <thead><tr><th>Source</th><th>Population</th><th>Headache item</th><th>Rule: any of</th><th>All</th><th>Women</th><th>Men</th></tr></thead>
          <tbody>
            {artifacts.map(({ path, art }) => {
              const src = art.source || {}, ph = art.phenotype || {}, el = ph.eligibility;
              const total = (art.estimates || []).find(isTotal);
              const head = ph.codeMap?.headache_migraine ? `diagnosis ${ph.codeMap.headache_migraine.join(", ")}` : ph.variableMap?.headache_migraine;
              const visits = art.unitOfAnalysis === "visit";
              return (
                <tr key={path}>
                  <td className="src"><b>{src.dataset} {src.cycle}</b><span>{(ph.unmapped || []).length} concept{(ph.unmapped || []).length === 1 ? "" : "s"} unmapped</span></td>
                  <td>{el && (el.var || el.concept) ? eligibilityText(el) : "all respondents"}{visits && <div style={{fontSize:11,fontWeight:600}}>office visits, not people</div>}{total ? <div style={{fontSize:11,color:"var(--muted)"}}>n = {Number(total.unweightedN).toLocaleString()} {visits ? "visits" : ""}</div> : null}</td>
                  <td className="num" style={{fontSize:11.5}}>{Array.isArray(head) ? head.join(", ") : (head || "—")}</td>
                  <td>{(ph.rule?.any || []).map(a => <span className="arm" key={a}>{a}</span>)}</td>
                  {cell(total)}{cell(bySex(art, "female"))}{cell(bySex(art, "male"))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="notew"><Info size={13} style={{flex:"0 0 auto",marginTop:1}} /><span>
        Each row is its own phenotype definition. Rows differ by survey, age floor, headache item and otologic arms, so compare figures across rows only where those columns match. Weighted estimates with 95% intervals as produced by the ETL; this table computes nothing.
      </span></div>
    </div>
  );
}

/*  Sources examined that produced no estimate. Listed so an absent dataset is a
    stated finding with its reason, not a silent gap a reader has to notice.
*/
function ReviewedSources({ items }) {
  const cls = status => /awaiting/i.test(status) ? "todo" : "unmapped";
  return (
    <div className="card">
      <div className="chdr"><Database size={16} color="var(--petrol)" /><div><div className="ce">Sources reviewed</div><div className="ct">Examined, no estimate produced</div></div></div>
      <div className="rev">
        {items.map((r, i) => (
          <div className="revi" key={i}>
            <div className="revh"><b>{r.source} {r.cycle}</b><span className={"st " + cls(r.status)}>{r.status}</span>{r.reviewedOn && <span style={{fontSize:11,color:"var(--muted)"}}>reviewed {r.reviewedOn}</span>}</div>
            <p>{r.reason}</p>
            {r.wouldChange && <p className="wc"><b>What would change this:</b> {r.wouldChange}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
