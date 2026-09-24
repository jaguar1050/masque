#!/usr/bin/env node
/*  Probe-set integrity check.  Run: node MASQUE_Probes_Check.mjs

    Probes reference instrument item ids and red-flag ids by string. A typo fails
    silently at runtime — the clinician answers and nothing records — so the ids are
    checked against the live instrument here rather than trusted to review.

    The rule this exists to enforce above all others: a phenotype probe must never
    write to a scored item. Supporting features are not Bárány criteria, and totalling
    them would invent a measurement instrument v0.2 does not make.
*/
import fs from "node:fs";
import { ALL_PROBES, PROBES, VM_PROBES, PROBE_KIND, PROBE_SET_VERSION, validateProbes, liveProbes }
  from "./MASQUE_Probes.js";

// Read item and red-flag ids straight out of the shipped screener, so the check is
// against the instrument that ships rather than a copy of it.
const src = fs.readFileSync("./MASQUE_Screener_v0_3.jsx", "utf8");
const itemIds = [...src.matchAll(/\bid:\s*"([rmvnix]_[a-z]+)"/g)].map(m => m[1]);
const flagIds = [...src.matchAll(/\bid:\s*"(rf_[a-z0-9]+)"/g)].map(m => m[1]);

const bar = "─".repeat(66);
console.log(bar);
console.log(`MASQUE PROBE SET ${PROBE_SET_VERSION}`);
console.log(bar);
console.log(`  ${ALL_PROBES.length} probes · ${PROBES.length} encounter + ${VM_PROBES.length} vestibular-migraine`);
const byKind = {};
ALL_PROBES.forEach(p => byKind[p.kind] = (byKind[p.kind] || 0) + 1);
console.log("  " + Object.entries(PROBE_KIND)
  .sort((a,b) => a[1].rank - b[1].rank)
  .map(([k,v]) => `${v.label.toLowerCase()} ${byKind[k] || 0}`).join(" · "));
console.log(`  checked against ${itemIds.length} instrument items and ${flagIds.length} red flags`);

const errs = validateProbes(itemIds, flagIds);
console.log(`\n  referential integrity: ${errs.length ? "FAIL" : "pass"}`);
errs.forEach(e => console.log("    " + e));

// The invariant, stated separately because it is the one worth failing loudly on.
const scoring = VM_PROBES.filter(p => p.kind === "phenotype").flatMap(p => p.opts).filter(o => o.a);
console.log(`  phenotype probes writing to a scored item: ${scoring.length} (must be 0)`);

/*  Rescues must survive a negative answer — that is the whole point of the kind.

    Tested as a DIFFERENCE, not against a bare state: several probes have compound
    triggers (asking about migrainous features accompanying vertigo is meaningless
    before vertigo is established). So the question is not "does it fire from nothing"
    but "does setting its target negative kill it", which is the property that matters.
*/
const rescues = ALL_PROBES.filter(p => p.kind === "rescue");
const base = { v_vertigo:2, v_motion:"yes", v_head:"yes", v_migfeat:"yes", v_aural:"yes",
               m_head:2, m_nausea:"yes", m_photo:"yes", r_normal:"yes", r_abx:"yes" };
let survives = 0, untested = [];
for (const p of rescues) {
  const numeric = typeof p.opts.find(o => o.a)?.a?.[p.rescues] === "number";
  const open = { ...base }; delete open[p.rescues];
  const neg  = { ...base, [p.rescues]: numeric ? 0 : "no" };
  if (!p.when(open, {})) { untested.push(p.id); continue; }   // trigger never satisfied
  if (p.when(neg, {})) survives++;
}
console.log(`  rescues live after a negative answer: ${survives}/${rescues.length} (must be all)`);
if (untested.length) console.log(`    not exercised by the base state: ${untested.join(", ")}`);

// Reachability: a red flag only some transcripts mention should still be askable.
const reach = [...new Set(ALL_PROBES.flatMap(p => p.opts.filter(o => o.rf).map(o => o.rf)))];
console.log(`  red flags reachable by asking: ${reach.length}/${flagIds.length}`);

// Ranking: nothing may outrank safety.
const demo = { v_vertigo: 0, m_head: 1, v_motion: "no", v_head: "no", v_aural: "yes", r_normal: "yes" };
const order = liveProbes(demo, {}, {});
const firstNonSafety = order.findIndex(p => p.kind !== "safety");
const anySafetyAfter = firstNonSafety >= 0 && order.slice(firstNonSafety).some(p => p.kind === "safety");
console.log(`  safety ranked first: ${anySafetyAfter ? "FAIL" : "pass"} (${order.length} live on the demo state)`);

const ok = !errs.length && !scoring.length && survives === rescues.length && !untested.length && !anySafetyAfter;
console.log(`\n  ${ok ? "ALL CHECKS PASS" : "CHECKS FAILED"}`);
console.log(bar);
process.exit(ok ? 0 : 1);
