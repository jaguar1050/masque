// apps/ResearchTab.jsx — the Research tab (design 03 §5.6, D11, D24). Owner: WP10.
//
// Two sections behind a segmented control:
//   - Population estimates: the shipped survey estimates, shown only for a built-in module that
//     declares them, or under a banner for a module verified as derived from one (§3.11 row 3).
//     Never for an upload or a derivation of an upload; the gate follows the classification
//     the registry assigned, never a provenance block in the file.
//   - Research readiness: the shared readiness panel, fed from the session store with the last
//     screen of the Screener or the Scribe and the rows each captured. The two apps' rows are
//     never merged silently: the user picks Screener, Scribe, both, or none.
// Every module-specific word comes from the bound module; nothing here names a module. The
// population files resolve against env.appBase (D25), so the tab works from any page depth.

import React, { useMemo, useState } from "react";
import { BarChart3, ClipboardCheck } from "lucide-react";
import ResearchReadinessPanel from "../ResearchReadinessPanel.jsx";
import PopulationEstimates from "../MASQUE_Population.jsx";
import { scopeCss } from "../engine/css.js";
import { calibrationGate } from "../engine/gates.js";
import { APP_VERSION } from "../engine/policy.js";
import { ProvenanceBadge, TabNote, useSession } from "../ui/common.jsx";

/** Non-clinical chrome of this tab (English only, §7.5). Exported for the tests. */
export const RESEARCH_COPY = {
  segPopulation: "Population estimates",
  segReadiness: "Research readiness",
  popOnlyBuiltin: "Population estimates are shown only for built-in modules and modules verified as derived from one.",
  popNone: "No population estimates for this module.",
  popBanner: "These estimates describe the {rootName} population phenotype measured in public survey files. They use no item weights, so this module's edits do not change them, and they were not recomputed for it.",
  noResearch: "This module declares no research configuration; the readiness panel needs one.",
  screenLabel: "Current screen from:",
  rowsLabel: "Captured rows:",
  screener: "Clinician Screener",
  scribe: "Ambient Scribe",
  allRows: "Both",
  none: "None",
  calibrationNoRoot: "another rubric's",
  routingWithheld: {
    screener: "Safety review not recorded in the Clinician Screener — no routing decision.",
    scribe: "Safety review not recorded in the Ambient Scribe — no routing decision.",
  },
  routingFlagOpen: {
    screener: "A red flag is open in the Clinician Screener — no routing decision.",
    scribe: "A red flag is open in the Ambient Scribe — no routing decision.",
  },
  routingNotCleared: {
    screener: "Routing was not cleared in the Clinician Screener — no routing decision.",
    scribe: "Routing was not cleared in the Ambient Scribe — no routing decision.",
  },
  rowsNote: "Rows from the Screener and the Scribe are never pooled unless you choose both.",
};

const ROOT = ".sa-research";
const RESEARCH_CSS = `
.sa-rt-wrap{max-width:1080px;margin:0 auto;padding:16px 16px 0;box-sizing:border-box}
.sa-rt-wrap.sa-rt-body{padding:0 16px 64px}
.sa-rt-head{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:0 0 12px}
.sa-rt-seg{display:inline-flex;border:1px solid #D7E1DF;border-radius:10px;overflow:hidden;background:#fff;max-width:100%}
.sa-rt-seg button{font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;border:0;background:#fff;color:#0C2B2F;padding:8px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.sa-rt-seg button + button{border-left:1px solid #D7E1DF}
.sa-rt-seg button[aria-selected="true"]{background:#0F5C61;color:#fff}
.sa-rt-seg button:focus-visible{outline:2px solid #137A80;outline-offset:-2px}
.sa-rt-msg{background:#fff;border:1px solid #D7E1DF;border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.5;color:#3D4F51}
.sa-rt-banner{background:#FBF4E6;border:1px solid #E4C88E;color:#6B4A18;border-radius:12px;padding:10px 14px;margin:14px 0 0;font-size:12.5px;line-height:1.5}
.sa-rt-sources{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;background:#fff;border:1px solid #D7E1DF;border-radius:12px;padding:10px 14px;font-size:12.5px;color:#3D4F51}
.sa-rt-sources label{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.sa-rt-sources select{font:inherit;font-size:12.5px;border:1px solid #D7E1DF;border-radius:8px;padding:5px 8px;background:#fff;color:#0C2B2F;max-width:100%}
.sa-rt-sources .sa-rt-note{flex-basis:100%;color:#5C6E6C;font-size:11.5px}
.sa-rt-pop{border-radius:12px;overflow-x:auto;max-width:100%}
.sa-rt-scroll{overflow-x:auto;max-width:100%}
`;
const CSS = scopeCss(RESEARCH_CSS, ROOT);

// ----------------------------------------------------------------------------- gates

function rootOf(module) {
  const c = module && module.classification;
  return c && c.root && c.root !== module ? c.root : null;
}

/**
 * Population gate (§5.6, D24), by classification:
 *   built-in with research.population             → shown
 *   verified derivation of a built-in declaring it → shown under the banner (the root's files)
 *   uploaded, or derived from an upload            → refused with the reason (when the module
 *                                                    carries a research block at all)
 *   anything else                                   → "No population estimates for this module."
 * @returns {{show: boolean, paths?: {index, schema, map}, rootName?: string, message?: string, kind: string}}
 */
export function populationGate(module) {
  const kind = module && module.classification ? module.classification.kind : null;
  const root = rootOf(module);
  if (module.origin === "builtin") {
    const p = module.research && module.research.population;
    return p ? { show: true, paths: p, kind: "builtin" } : { show: false, message: RESEARCH_COPY.popNone, kind: "none" };
  }
  if (module.origin === "derived" && kind === "verified" && root && root.origin === "builtin") {
    const p = root.research && root.research.population;
    return p
      ? { show: true, paths: p, rootName: root.name, kind: "verified" }
      : { show: false, message: RESEARCH_COPY.popNone, kind: "none" };
  }
  if ((module.origin === "uploaded" || kind === "derived-from-upload") && module.research) {
    return { show: false, message: RESEARCH_COPY.popOnlyBuiltin, kind: "refused" };
  }
  return { show: false, message: RESEARCH_COPY.popNone, kind: "none" };
}

/**
 * Whose scoring a withheld calibration was set for: "<root name> <root instrument>" when the
 * calibration's scoring hash is the root's (a derivation that changed the scoring), otherwise
 * "another rubric's". Only a classified root counts; a provenance claim in the file does not.
 */
export function calibrationSource(module) {
  const root = rootOf(module);
  const target = module && module.research && module.research.calibration && module.research.calibration.appliesTo
    ? module.research.calibration.appliesTo.scoringHash : null;
  if (root && root.hashes && target && root.hashes.scoringHash === target) return `${root.name} ${root.instrumentVersion}`;
  return RESEARCH_COPY.calibrationNoRoot;
}

// ----------------------------------------------------------------------------- helpers

/**
 * Why a snapshot's routing is withheld, from the snapshot itself: an open red flag, else a
 * safety review that was not recorded, else a plain "not cleared". Never claims the review is
 * missing when the hold comes from a flag (the safety step is done once a flag is recorded).
 */
export function routingWithheldDetail(snap) {
  const app = snap && snap.source === "screener" ? "screener" : "scribe";
  if (snap && Array.isArray(snap.redFlags) && snap.redFlags.length) return RESEARCH_COPY.routingFlagOpen[app];
  if (!snap || snap.safetyReviewed !== true) return RESEARCH_COPY.routingWithheld[app];
  return RESEARCH_COPY.routingNotCleared[app];
}

function hhmm(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function latestSource(screens) {
  const s = screens.screener, b = screens.scribe;
  if (s && b) return String(b.at) > String(s.at) ? "scribe" : "screener";
  return s ? "screener" : b ? "scribe" : "none";
}

/** Default rows choice: the current screen's app when it captured rows, else the one app that did. */
function defaultRowsChoice(screenChoice, cohorts) {
  if (screenChoice !== "none" && cohorts[screenChoice].length) return screenChoice;
  const withRows = ["screener", "scribe"].filter((k) => cohorts[k].length);
  return withRows.length === 1 ? withRows[0] : "none";
}

// ----------------------------------------------------------------------------- component

/**
 * @param {{module: Object, appVersion?: string, env: {appBase: string}, onDirty?: function(string, (string|null)): void}} props
 */
export default function ResearchTab({ module, appVersion = APP_VERSION, env, onDirty }) {
  const { screens, cohorts } = useSession();
  const gate = useMemo(() => populationGate(module), [module]);
  const [section, setSection] = useState(() => (gate.show ? "population" : "readiness"));
  const [visited, setVisited] = useState(() => ({ [gate.show ? "population" : "readiness"]: true }));
  const [screenPick, setScreenPick] = useState(null);   // null = follow the most recent snapshot
  const [rowsPick, setRowsPick] = useState(null);       // null = default (see defaultRowsChoice)

  const open = (key) => { setSection(key); setVisited((v) => (v[key] ? v : { ...v, [key]: true })); };

  const screenChoice = screenPick && (screenPick === "none" || screens[screenPick]) ? screenPick : latestSource(screens);
  const snap = screenChoice === "none" ? null : screens[screenChoice];
  const rowsChoice = rowsPick ?? defaultRowsChoice(screenChoice, cohorts);
  const rows = useMemo(() => (
    rowsChoice === "screener" ? cohorts.screener
      : rowsChoice === "scribe" ? cohorts.scribe
        : rowsChoice === "all" ? [...cohorts.screener, ...cohorts.scribe] : []
  ), [rowsChoice, cohorts]);

  const research = module.research;
  const applies = calibrationGate(module);
  const itemIds = useMemo(() => module.allItems.map((i) => i.id), [module]);
  const rowScope = useMemo(() => ({ moduleId: module.id, instrumentVersion: module.instrumentVersion }), [module]);
  const appBase = env && env.appBase ? env.appBase : new URL("./", document.baseURI).href;

  const banner = gate.rootName
    ? <div className="sa-rt-banner" data-testid="research-pop-banner" role="note">{RESEARCH_COPY.popBanner.replace("{rootName}", gate.rootName)}</div>
    : null;

  const segs = [["population", RESEARCH_COPY.segPopulation, BarChart3], ["readiness", RESEARCH_COPY.segReadiness, ClipboardCheck]];

  return (
    <div className="sa-app sa-research" data-testid="research-tab" data-module={module.id}>
      <style>{CSS}</style>
      <div className="sa-rt-wrap">
      <TabNote kind="research" />
      <div className="sa-rt-head">
        <div className="sa-rt-seg" role="tablist" aria-label="Research sections">
          {segs.map(([key, label, Icon]) => (
            <button key={key} type="button" role="tab" aria-selected={section === key ? "true" : "false"}
              data-testid={`research-seg-${key}`} onClick={() => open(key)}>
              <Icon size={14} aria-hidden="true" />{label}
            </button>
          ))}
        </div>
        <ProvenanceBadge module={module} audience="clinician" variant="compact" />
      </div>
      </div>

      {visited.population && (
        <section hidden={section !== "population"} data-testid="research-population" aria-label={RESEARCH_COPY.segPopulation}>
          {gate.show ? (
            <div className="sa-rt-pop">
              <PopulationEstimates embedded baseUrl={appBase} indexPath={gate.paths.index}
                schemaPath={gate.paths.schema} mapPath={gate.paths.map} banner={banner} />
            </div>
          ) : (
            <div className="sa-rt-wrap sa-rt-body">
              <div className="sa-rt-msg" data-testid="research-pop-message" data-gate={gate.kind}>{gate.message}</div>
            </div>
          )}
        </section>
      )}

      {visited.readiness && (
        <section hidden={section !== "readiness"} data-testid="research-readiness" aria-label={RESEARCH_COPY.segReadiness}
          className="sa-rt-wrap sa-rt-body">
          {!research ? (
            <div className="sa-rt-msg" data-testid="research-no-config">{RESEARCH_COPY.noResearch}</div>
          ) : (
            <>
              <div className="sa-rt-sources">
                <label>{RESEARCH_COPY.screenLabel}
                  <select data-testid="research-screen-select" value={screenChoice}
                    onChange={(e) => setScreenPick(e.target.value)}>
                    {screens.screener && <option value="screener">{`${RESEARCH_COPY.screener} (${hhmm(screens.screener.at)})`}</option>}
                    {screens.scribe && <option value="scribe">{`${RESEARCH_COPY.scribe} (${hhmm(screens.scribe.at)})`}</option>}
                    <option value="none">{RESEARCH_COPY.none}</option>
                  </select>
                </label>
                <label>{RESEARCH_COPY.rowsLabel}
                  <select data-testid="research-rows-select" value={rowsChoice}
                    onChange={(e) => setRowsPick(e.target.value)}>
                    <option value="screener">{`${RESEARCH_COPY.screener} (${cohorts.screener.length})`}</option>
                    <option value="scribe">{`${RESEARCH_COPY.scribe} (${cohorts.scribe.length})`}</option>
                    <option value="all">{`${RESEARCH_COPY.allRows} (${cohorts.screener.length + cohorts.scribe.length})`}</option>
                    <option value="none">{RESEARCH_COPY.none}</option>
                  </select>
                </label>
                <span className="sa-rt-note">{RESEARCH_COPY.rowsNote}</span>
              </div>
              <div className="sa-rt-scroll">
                <ResearchReadinessPanel
                  research={research} project={research.projectKey} moduleId={module.id}
                  scoringHash={module.hashes ? module.hashes.scoringHash : null}
                  indexName={module.copy && module.copy.indexName ? module.copy.indexName : undefined}
                  scaleMax={module.scaleMax}
                  calibrationApplies={applies}
                  calibrationNote={applies ? null : calibrationSource(module)}
                  rowScope={rowScope}
                  noScreen={!snap}
                  routingCleared={snap ? snap.routingCleared !== false : true}
                  routingWithheldDetail={routingWithheldDetail(snap)}
                  populationArtifacts={gate.show}
                  score={snap ? snap.score : null} ceiling={snap ? snap.ceiling ?? null : null}
                  scorable={snap ? !!snap.scorable : false}
                  band={snap ? snap.band ?? null : null} domains={snap ? snap.domains || {} : {}}
                  coverage={snap ? snap.coverage ?? 0 : 0}
                  sex={snap ? snap.sex ?? null : null} gender={snap ? snap.gender ?? null : null}
                  phenotype={snap ? snap.phenotype ?? "" : ""} redFlags={snap ? snap.redFlags || [] : []}
                  itemIds={itemIds} capturedRows={rows} instrumentVersion={module.instrumentVersion}
                  onDataChange={(summary) => { if (onDirty) onDirty("research", summary); }}
                  modelVersion={`${module.id}-${snap && snap.source === "scribe" ? "scribe-" : ""}prototype-${appVersion}`}
                />
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
