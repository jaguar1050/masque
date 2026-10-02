// engine/scribe.js — Ambient Scribe engine: capture ingestion, suggestion ranking, capture
// labels and the encounter note (design 03 §4.11). Owner: WP5.
//
// Every function takes the bound module; nothing here names a module's items, flags,
// context ids, domains or phenotypes. The note skeleton and its safety-critical lines are
// engine-owned and moved verbatim from the baseline Scribe (Scb L1337-1393); the module
// supplies only the copy.note.* slots, the item short labels, the info-prompt tag prefix
// and the gap-rule note labels. Pure; no React; no import-time side effects.
import { CAPTURE_KIND, INDETERMINATE } from "./vocab.js";
import { renderTpl } from "./evaluate.js";
import { activeDomains, copyVars, gapSignals } from "./rules.js";
import { provenanceLines } from "./lineage.js";
import { ENGINE_COPY_DEFAULTS } from "./generic.js";

const arr = (x) => (Array.isArray(x) ? x : []);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const obj = (x) => (isObj(x) ? x : {});

// ---------------------------------------------------------------------------------------
// Capture ingestion (Scb L772-784)
// ---------------------------------------------------------------------------------------

/**
 * Fold one utterance's captures into the encounter state. Returns new objects; never
 * mutates its inputs (with no captures the inputs come back as they are).
 *   item     first write wins: an answer already on the record is not overwritten by a
 *            later phrase match (including a later capture in the same batch);
 *   ctx      overwrite;
 *   redflag  raise-only, recorded as "nlp"; a flag already set (by the clinician, "md", or a
 *            probe, "probe") is never downgraded and nothing here ever clears one.
 * touchedDomainItemIds: the distinct item-capture ids in capture order; the caller maps them
 * to domains through module.itemById for the "domains touched" pulse.
 * @returns {{answers:Object, ctx:Object, rf:Object, touchedDomainItemIds:string[]}}
 */
export function ingestCaptures({ answers = {}, ctx = {}, rf = {} } = {}, captures = []) {
  const caps = arr(captures).filter(isObj);
  if (!caps.length) return { answers, ctx, rf, touchedDomainItemIds: [] };
  const a = { ...obj(answers) };
  caps.filter(c => c.kind === CAPTURE_KIND.ITEM).forEach(c => { if (a[c.id] === undefined) a[c.id] = c.value; });
  const cx = { ...obj(ctx) };
  caps.filter(x => x.kind === CAPTURE_KIND.CTX).forEach(x => { cx[x.id] = x.value; });
  const flags = { ...obj(rf) };
  caps.filter(x => x.kind === CAPTURE_KIND.REDFLAG).forEach(x => { if (!flags[x.id]) flags[x.id] = "nlp"; });
  const touched = [...new Set(caps.filter(c => c.kind === CAPTURE_KIND.ITEM).map(c => c.id))];
  return { answers: a, ctx: cx, rf: flags, touchedDomainItemIds: touched };
}

// ---------------------------------------------------------------------------------------
// Suggestions (Scb L856-879)
// ---------------------------------------------------------------------------------------

/** The Scribe short label of an item: item.short, else its id (Scb L1309-1321). */
export function itemShort(item) {
  return item.short ?? item.id;
}

/**
 * Suggested questions: unanswered items, prioritised by active domain, then tag boost, then
 * weight (Scb L856-879). While the screen is unscorable the pool widens to every unanswered,
 * unskipped item, so headroom parked in an inactive domain can never hold the screen
 * indeterminate with nothing on screen to resolve it.
 *   - active domains come from rules.activeDomains (every domain on a phenotype or
 *     activation error);
 *   - items with a `tag` rank first while phenotypes.tagBoostDomain is active;
 *   - the top infoPrompts.maxScored items are shown, then the module's info prompts not yet
 *     covered in `vmp`, while infoPrompts.gateDomain is active, up to infoPrompts.maxTotal.
 * Suggestion = {id, ask, tag, scale, kind: "scored"} | {id, ask, tag, kind: "info"}.
 * @returns {{list: Object[], error: (null|Object)}}
 */
export function rankSuggestions(module, { answers = {}, complaint = "", phenotypeError = null, vmp = {}, scorable = false, skipped = {} } = {}) {
  const a = obj(answers), sk = obj(skipped), covered = obj(vmp);
  const { domains: active, error } = activeDomains(module, { answers: a, complaint, phenotypeError });
  const domainByKey = {};
  for (const d of module.domains) domainByKey[d.key] = d;
  const ph = module.phenotypes || null;
  const boostActive = !!(ph && ph.tagBoostDomain && active.has(ph.tagBoostDomain));
  const info = module.infoPrompts || null;
  const maxScored = info && Number.isInteger(info.maxScored) ? info.maxScored : 4;
  const maxTotal = info && Number.isInteger(info.maxTotal) ? info.maxTotal : maxScored;

  const open = module.allItems.filter(it => a[it.id] === undefined && !sk[it.id] && (scorable || active.has(it.domain)));
  open.sort((x, y) => {
    const xa = active.has(x.domain) ? 1 : 0, ya = active.has(y.domain) ? 1 : 0;
    if (xa !== ya) return ya - xa;
    const xv = boostActive && x.tag ? 1 : 0;
    const yv = boostActive && y.tag ? 1 : 0;
    if (xv !== yv) return yv - xv;
    return y.w - x.w;
  });
  const list = open.slice(0, maxScored).map(it => {
    const d = domainByKey[it.domain] || {};
    return {
      id: it.id, ask: it.ask ?? it.text, tag: it.tag || d.shortTag || String(d.label || "").toLowerCase(),
      scale: it.scale, kind: "scored",
    };
  });
  if (info && active.has(info.gateDomain)) {
    for (const p of arr(info.prompts)) if (covered[p.id] === undefined && list.length < maxTotal)
      list.push({ id: p.id, ask: p.ask, tag: p.tag, kind: "info" });
  }
  return { list, error };
}

// ---------------------------------------------------------------------------------------
// Capture labels (Scb L1299-1308)
// ---------------------------------------------------------------------------------------

function kindOf(module, c) {
  if (c.kind === CAPTURE_KIND.REDFLAG || c.kind === CAPTURE_KIND.CTX || c.kind === CAPTURE_KIND.ITEM) return c.kind;
  // A capture stored without its kind (e.g. {id, value} on a transcript line) is resolved by
  // membership, never by an id pattern.
  if (module.flagById && module.flagById[c.id]) return CAPTURE_KIND.REDFLAG;
  if (arr(module.contextItems).some(ci => ci.id === c.id)) return CAPTURE_KIND.CTX;
  return CAPTURE_KIND.ITEM;
}

/**
 * The capture tag text: redflag → "RED FLAG: " + the flag's points (else the id); ctx → the
 * context item's captureLabel (else the id); item → short label, with the scale option label
 * for a scale item, or "no " before a denied boolean item. Unknown ids show the id.
 */
export function captureLabel(module, capture) {
  const c = obj(capture);
  const kind = kindOf(module, c);
  if (kind === CAPTURE_KIND.REDFLAG) return "RED FLAG: " + ((module.flagById && module.flagById[c.id])?.points || c.id);
  if (kind === CAPTURE_KIND.CTX) {
    const ci = arr(module.contextItems).find(x => x.id === c.id);
    return (ci && ci.captureLabel) || c.id;
  }
  const it = module.itemById && module.itemById[c.id]; if (!it) return c.id;
  if (it.scale) return `${itemShort(it)}: ${it.scale[c.value]?.label ?? c.value}`;
  return (c.value === "no" ? "no " : "") + itemShort(it);
}

// ---------------------------------------------------------------------------------------
// The encounter note (Scb L1337-1393)
// ---------------------------------------------------------------------------------------

/** The variables note slots may use: {name} {id} {instrument} {scaleMax} {indexName}. */
function noteVars(module) {
  const base = copyVars(module);
  const indexName = typeof base.indexName === "string" ? renderTpl(base.indexName, null, base) : base.indexName;
  return { ...base, indexName };
}

/** copy.note.<key>, rendered; the engine default when the module has none. */
function noteSlot(module, key, vars) {
  const fromModule = module.copy && isObj(module.copy.note) ? module.copy.note[key] : undefined;
  const v = typeof fromModule === "string" ? fromModule : ENGINE_COPY_DEFAULTS.note[key];
  return renderTpl(typeof v === "string" ? v : "", null, vars);
}

/**
 * The draft encounter note. The skeleton is the baseline's, verbatim; the module supplies
 * copy.note.{title, screenHeading, likelihoodOf, patternPhrase, infoCovered, gapLine,
 * supportingFooter, noDriver, signOff}, the item short labels, the info-prompt tag prefix
 * and the gap-rule note labels; "/100" is `/{scaleMax}`. A non-built-in module's note opens
 * with its clinician provenance line(s).
 *
 * A&P order: red flags → safety review not recorded → not scorable → routing error (the
 * engine line, never a rec and never copy.note.noDriver) → recs → noDriver.
 *
 * input = {patient, answers, ctx, vmp, score, complaint, recs, routingError, gapAlert,
 *          activeFlags, safetyReviewed, emergent, probeNotes}
 *   score       computeScore(module, answers)
 *   recs        routingRecs(module, scribe state).recs
 *   activeFlags flag records {id, tier, group, text, points, action} in rubric order
 * @returns {string}
 */
export function buildNote(module, input = {}) {
  const {
    patient = {}, answers = {}, ctx = {}, vmp = {}, score = {}, recs = [], routingError = null,
    gapAlert = false, activeFlags = [], safetyReviewed = false, probeNotes = [],
  } = input;
  const emergent = input.emergent ?? arr(activeFlags).some(f => f.tier === "emergent");
  const vars = noteVars(module);
  const note = (key) => noteSlot(module, key, vars);
  const scaleMax = module.scaleMax;
  const { total, floor, ceiling, coverage, scorable, domains = {} } = score;
  const band = typeof score.band === "string" ? score.band : INDETERMINATE;
  const a = obj(answers);
  const flags = arr(activeFlags);
  const pnotes = arr(probeNotes);
  const rlist = arr(recs);
  const domainLabel = {};
  for (const d of module.domains) domainLabel[d.key] = d.label;

  // A scale answer is negative when its option has f === 0 (V13 guarantees one but not that it
  // is option 0); a value with no option behind it keeps the plain `!== 0` reading.
  const scaleNeg = (it, v) => {
    const o = Array.isArray(it.scale) && typeof v === "number" ? it.scale[v] : undefined;
    return o && typeof o === "object" && typeof o.f === "number" ? o.f === 0 : v === 0;
  };
  const pos = module.allItems.filter(it => a[it.id] !== undefined && a[it.id] !== "no" && !(Array.isArray(it.scale) ? scaleNeg(it, a[it.id]) : a[it.id] === 0));
  const line = (it) => "  • " + itemShort(it) + (it.scale ? ` (${it.scale[a[it.id]]?.label})` : "");
  const posByDom = module.domainOrder.map(k => {
    const rows = pos.filter(p => p.domain === k);
    return rows.length ? `${domainLabel[k]}:\n` + rows.map(line).join("\n") : null;
  }).filter(Boolean);
  const info = module.infoPrompts || null;
  const prompts = info ? arr(info.prompts) : [];
  const tagPrefix = info && typeof info.tagPrefix === "string" ? info.tagPrefix : "";
  const vmpCov = Object.entries(obj(vmp)).filter(([,v]) => v === "yes" || v === "no").map(([k]) => (prompts.find(i=>i.id===k)?.tag||k).replace(tagPrefix,""));
  const ctxLine = gapSignals(module, ctx).noteLabels.join("; ");
  const provenance = provenanceLines(module, "clinician");

  return (
`${provenance.length ? provenance.join("\n") + "\n" : ""}${note("title")}
Patient: ${patient.family}, ${patient.given}  ${patient.age ?? ""}${patient.sex?.[0] ?? ""}  ${patient.mrn}

SAFETY REVIEW
${flags.length
  ? `  RED FLAGS PRESENT — ${emergent ? "EMERGENT" : "URGENT"}. Screening routing withheld.\n`
    + flags.map(f => `  • ${f.text} — ${f.points}. ${f.action}.`).join("\n")
  : safetyReviewed
    ? "  Red-flag review completed; none present."
    : "  NOT YET REVIEWED — no routing issued. Complete the red-flag review before signing."}

SUBJECTIVE — captured symptoms
${posByDom.length ? posByDom.join("\n") : "  (none captured yet)"}
${ctxLine ? "\nContext: " + ctxLine + "." : ""}
${vmpCov.length ? note("infoCovered") + ": " + vmpCov.join(", ") + "." : ""}

${note("screenHeading")}${scorable ? "" : " — INCOMPLETE, NO RESULT ISSUED"}
${scorable
  ? `  Index ${total}/${scaleMax} — ${band.toUpperCase()} ${note("likelihoodOf")}.`
  : `  Screen incomplete: ${coverage}% of scored items answered. Index bounded to ${floor}–${ceiling}/${scaleMax}, which spans more than one band.
  No likelihood band is reported. Unanswered items are NOT recorded as denials, and no rule-out is implied.`}
  Domains — ${module.domainOrder.map(k => `${domainLabel[k]} ${domains[k]?.pts}/${domains[k]?.max}`).join(" · ")}
${gapAlert ? "  " + note("gapLine") : ""}

${pnotes.length ? `SUPPORTING FEATURES AND EXAM (recorded, not scored)
${pnotes.map(x => "  - " + x).join("\n")}
  ${note("supportingFooter")}

` : ""}ASSESSMENT & PLAN
${flags.length
  ? `  • Red flag present — evaluate on its own terms before treating this as a ${note("patternPhrase")}.\n`
    + flags.map(f => `  • ${f.action} (${f.points}).`).join("\n")
  : !safetyReviewed
    ? "  • Safety review not recorded — no screening routing issued."
    : !scorable
      ? "  • Screen not scorable — complete the outstanding items before acting on this screen."
      : routingError
        ? `  • Module rule error — no routing issued: rule "${routingError.ruleId}" in module ${module.id} failed (${routingError.message}).`
        : rlist.length
          ? rlist.map(r => `  • ${r.h}. ${r.p}${arr(r.chips).length ? " [" + r.chips.join("; ") + "]" : ""}`).join("\n")
          : "  • " + note("noDriver")}

${note("signOff")}`
  );
}
