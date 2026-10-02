// apps/SampleRail.jsx — the sample-case buttons of the Clinician Screener (design 03 §5.3, B §1.2).
// Owner: WP7.
//
// Renders `module.sampleCases` as the baseline's banner buttons (Scr L994-997): the cases of
// group "sample" first, then the cases of group "scenario" behind a "Scenarios" divider (the
// converted Simulator scenarios, AD11). Each button shows the case's `buttonLabel` with an icon
// from a fixed name → lucide map (an unknown name falls back to Info, as V49 warns), and the
// case's `why` becomes its title. A module without sample cases renders nothing (§3.5).
//
// No module literal: everything shown comes from the module. No side effects at import time.

import React from "react";
import { Activity, Ban, ClipboardList, FlaskConical, Info, ScanLine, Stethoscope, TriangleAlert, Zap } from "lucide-react";
import { scopeCss } from "../engine/css.js";

/** The fixed icon map (lucide names a rubric may use for a sample case). */
export const SAMPLE_ICONS = {
  Activity, Ban, ClipboardList, FlaskConical, Info, ScanLine, Stethoscope, TriangleAlert, Zap,
};

/** Rail group order and the divider text shown before each later group. */
export const SAMPLE_GROUPS = [
  { key: "sample", label: "Samples", divider: null },
  { key: "scenario", label: "Scenarios", divider: "Scenarios" },
];

// The rail sits inside the Screener's banner, a wrapping flex row, so its wrappers take no box
// of their own (display: contents) and the buttons flow exactly as the baseline's did.
const RAIL_CSS = scopeCss(`
:root{display:contents}
.sa-rail-group{display:contents}
.sa-rail-div{font-family:var(--mono,ui-monospace,monospace);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;
  color:#9FC1BE;padding:0 2px 0 6px;border-left:1px solid rgba(255,255,255,.28);align-self:center;white-space:nowrap}
`, ".sa-rail");

/** Cases of one group, in rubric order. A case without `group` belongs to "sample". */
export function casesOf(module, group) {
  const list = Array.isArray(module && module.sampleCases) ? module.sampleCases : [];
  return list.filter(c => (c && c.group ? c.group : "sample") === group);
}

/**
 * @param {{module: Object, onLoad: function(Object): void}} props
 *   onLoad receives the sample case object (Scr L848-858 loadSample semantics live in the Screener).
 */
export default function SampleRail({ module, onLoad }) {
  const groups = SAMPLE_GROUPS.map(g => ({ ...g, cases: casesOf(module, g.key) })).filter(g => g.cases.length > 0);
  if (!groups.length) return null;
  return (
    <span className="sa-rail" data-testid="sample-rail">
      <style>{RAIL_CSS}</style>
      {groups.map(g => (
        <span key={g.key} className="sa-rail-group" role="group" aria-label={g.label} data-group={g.key}>
          {g.divider && <span className="sa-rail-div" aria-hidden="true">{g.divider}</span>}
          {g.cases.map(c => {
            const Icon = SAMPLE_ICONS[c.icon] || (c.icon ? Info : Activity);
            return (
              <button key={c.id} type="button" className="gbtn" data-sample={c.id} data-group={g.key}
                      title={c.why || undefined} onClick={() => onLoad(c)}>
                <Icon size={14}/> {c.buttonLabel}
              </button>
            );
          })}
        </span>
      ))}
    </span>
  );
}
