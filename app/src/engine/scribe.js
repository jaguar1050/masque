// engine/scribe.js — Ambient Scribe engine: capture ingestion, suggestion ranking, capture
// labels and the encounter note (design 03 §4.11). Owner: WP5.
//
// Every function takes the bound module; nothing here names a module's items, flags,
// context ids, domains or phenotypes. The note skeleton and its safety-critical lines are
// engine-owned and moved verbatim from the baseline Scribe (Scb L1337-1393); the module
// supplies only the copy.note.* slots, the item short labels, the info-prompt tag prefix
// and the gap-rule note labels. Pure; no React; no import-time side effects.
//
// Heard and carry-over (design 05 §1.4, §2.1, §2.4): the engine owns only the words "heard",
// "not stated" and "follow-up to"; every clinical word comes from the module (item short
// label, scale option label, ask/text, tag) and the quoted word is the patient's own cue text.
// Clarifications (release 0.4.7): the engine owns only the words "clarify", "Yes" and "No"; every
// question and answer label comes from the module (a clarify entry's ask, a probe's say and opts,
// an item's ask or text and scale labels, clauses.placeholderAsk).
// Question review (release 0.4.8, follow-up): the engine owns only "Yes", "No" and the source names
// (REVIEW_SOURCE); every question, short label, tag and scale label comes from the module.
import { ANSWER, CAPTURE_KIND, INDETERMINATE, PROBE_KIND, isAnswered } from "./vocab.js";
import { renderTpl } from "./evaluate.js";
import { activeDomains, copyVars, gapSignals } from "./rules.js";
import { provenanceLines } from "./lineage.js";
import { ENGINE_COPY_DEFAULTS } from "./generic.js";
import { liveProbes } from "./probes.js";

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
 *   heard    a cue heard without its value — never an answer (absent stays absent); ignored here.
 *   clarify  a clarification cue (extraction.clarifyCues) — a question, never an answer; ignored
 *            here, as is any other kind.
 * An item capture with via "carry" is an ordinary item capture: first write wins.
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

/** domain key → domain record. */
function domainIndex(module) {
  const domainByKey = {};
  for (const d of arr(module.domains)) domainByKey[d.key] = d;
  return domainByKey;
}

/**
 * The one builder behind a scored suggestion and a heard prompt: {id, ask, tag, scale, kind}.
 * ask = item.ask ?? item.text; tag = item.tag, else the domain's shortTag, else its label
 * lowercased.
 */
function itemSuggestion(it, domainByKey, kind) {
  const d = domainByKey[it.domain] || {};
  return {
    id: it.id, ask: it.ask ?? it.text, tag: it.tag || d.shortTag || String(d.label || "").toLowerCase(),
    scale: it.scale, kind,
  };
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
 *     covered in `vmp`, while infoPrompts.gateDomain is active, up to infoPrompts.maxTotal;
 *   - ids in `exclude` (the items already shown as heard prompts) leave the open pool before
 *     sorting and slicing, so the list still fills to infoPrompts.maxScored; with exclude []
 *     (the default) the output is unchanged.
 * Suggestion = {id, ask, tag, scale, kind: "scored"} | {id, ask, tag, kind: "info"}.
 * @returns {{list: Object[], error: (null|Object)}}
 */
export function rankSuggestions(module, { answers = {}, complaint = "", phenotypeError = null, vmp = {}, scorable = false, skipped = {}, exclude = [] } = {}) {
  const a = obj(answers), sk = obj(skipped), covered = obj(vmp);
  const ex = new Set(arr(exclude));
  const { domains: active, error } = activeDomains(module, { answers: a, complaint, phenotypeError });
  const domainByKey = domainIndex(module);
  const ph = module.phenotypes || null;
  const boostActive = !!(ph && ph.tagBoostDomain && active.has(ph.tagBoostDomain));
  const info = module.infoPrompts || null;
  const maxScored = info && Number.isInteger(info.maxScored) ? info.maxScored : 4;
  const maxTotal = info && Number.isInteger(info.maxTotal) ? info.maxTotal : maxScored;

  const open = module.allItems.filter(it => a[it.id] === undefined && !sk[it.id] && !ex.has(it.id) && (scorable || active.has(it.domain)));
  open.sort((x, y) => {
    const xa = active.has(x.domain) ? 1 : 0, ya = active.has(y.domain) ? 1 : 0;
    if (xa !== ya) return ya - xa;
    const xv = boostActive && x.tag ? 1 : 0;
    const yv = boostActive && y.tag ? 1 : 0;
    if (xv !== yv) return yv - xv;
    return y.w - x.w;
  });
  const list = open.slice(0, maxScored).map(it => itemSuggestion(it, domainByKey, "scored"));
  if (info && active.has(info.gateDomain)) {
    for (const p of arr(info.prompts)) if (covered[p.id] === undefined && list.length < maxTotal)
      list.push({ id: p.id, ask: p.ask, tag: p.tag, kind: "info" });
  }
  return { list, error };
}

/**
 * Heard prompts: one per heard item id that is an item of the module, unanswered and not
 * skipped, in the order given (most recently heard first), deduplicated by id (the first,
 * newest, entry wins). ask/tag/scale are built exactly as for a scored suggestion. Domain
 * activity and scorability are NOT consulted: the patient raised it.
 * HeardPrompt = {id, ask, tag, scale, kind: "heard", cueText}.
 * @param heard [{id, cueText}]   newest first
 * @returns {Object[]}
 */
export function heardPrompts(module, { heard = [], answers = {}, skipped = {} } = {}) {
  const a = obj(answers), sk = obj(skipped);
  const byId = module.itemById || {};
  const domainByKey = domainIndex(module);
  const seen = new Set(), out = [];
  for (const h of arr(heard)) {
    if (!isObj(h) || typeof h.id !== "string" || seen.has(h.id)) continue;
    seen.add(h.id);
    const it = Object.prototype.hasOwnProperty.call(byId, h.id) ? byId[h.id] : undefined;
    if (!it || a[h.id] !== undefined || sk[h.id]) continue;
    out.push({ ...itemSuggestion(it, domainByKey, CAPTURE_KIND.HEARD), cueText: h.cueText });
  }
  return out;
}

/** The kind of a probe that re-asks an item (engine/probes.js: never retired through its item). */
const RESCUE_KIND = "rescue";

/** The probes of a bound module (logic.probes.list), objects only. */
function probeList(module) {
  const pr = module && module.logic && module.logic.probes;
  return arr(isObj(pr) ? pr.list : pr).filter(isObj);
}

/** A clarify entry's own question: ask.text when it is a non-empty string, else undefined. */
function entryAsk(entry) {
  const t = isObj(entry) && isObj(entry.ask) ? entry.ask.text : undefined;
  return typeof t === "string" && t.trim() ? t : undefined;
}

/**
 * Clarification cards (release 0.4.7) from clarification cues (extraction.clarifyCues, kind
 * "clarify"), in text order (cueIndex; ties keep the order given), one per target: the first cue
 * of a target wins. A probe card's target is the probe's own target item when it has one (a rescue
 * probe's: the item it rescues), so it and an item card for that item are one target.
 *   probe cue  (lexicon.clarify entry naming a probe of module.logic.probes.list) → {kind: "probe",
 *              target: probe id, probeKind, tag: the PROBE_KIND label, ask: the entry's ask.text,
 *              else the probe's say, opts: the probe's options [{label (verbatim), value: option
 *              index, rf: raises a flag}]}. Dropped when the probe is answered (probeAns). A rescue
 *              probe's card is shown only while the probe is live as Ask next reads it
 *              (engine/probes.js liveProbes over answers, rf and probeAns: its `when`, the module's
 *              own condition for re-asking its item), so it leaves once that item reads positive
 *              and never overwrites it (review round 1). Any other probe's card is dropped when its
 *              target item is answered or when one of its options would write an item already
 *              answered: a card never overwrites an answer. (Its `when` is not read: the text asked.)
 *   item cue   (a trigger naming an item, a hedge or a conflict) → {kind: "item", target: item id,
 *              tag and ask as for a scored suggestion (ask = item.ask ?? item.text) unless the clarify
 *              entry of that id names this item and gives an ask, scale, opts: the scale labels
 *              [{label, value: option index}] or Yes / No ["yes" / "no"]}. Dropped when the item is
 *              answered or skipped, or is not an item of the module.
 *   placeholder cue → {kind: "note", target: null, ask: lexicon.clauses.placeholderAsk.text, opts:
 *              []}: a notice, not a question (review round 2: the Scribe shows it with one Dismiss
 *              control and no answers); dropped without that text (the engine has no wording of its
 *              own).
 * Every card also carries the cue's {id, reason, evidence, clause, cueText, cueIndex} (and against,
 * for a conflict); a card whose id is in `dismissed` is dropped. Nothing here records anything.
 * @param cues  clarifyCues results (from one or more texts)
 * @param state {answers, probeAns, skipped, dismissed, rf}
 * @returns {Object[]}
 */
export function clarifyPrompts(module, cues = [], { answers = {}, probeAns = {}, skipped = {}, dismissed = {}, rf = {} } = {}) {
  const a = obj(answers), pa = obj(probeAns), sk = obj(skipped), dm = obj(dismissed);
  const byId = (module && module.itemById) || {};
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const lex = module && isObj(module.lexicon) ? module.lexicon : {};
  const entries = arr(lex.clarify).filter(isObj);
  const probes = probeList(module);
  const rescueLive = (pr) => liveProbes([pr], a, obj(rf), pa).length > 0;
  const writesAnswered = (pr) => arr(pr.opts).some(o => isObj(o) && isObj(o.a) && Object.keys(o.a).some(k => a[k] !== undefined));
  const domainByKey = domainIndex(module || {});
  const at = (c) => (typeof c.cueIndex === "number" ? c.cueIndex : Number.MAX_SAFE_INTEGER);
  const ordered = arr(cues).map((c, n) => [c, n]).filter(([c]) => isObj(c) && c.kind === CAPTURE_KIND.CLARIFY && typeof c.id === "string")
    .sort((x, y) => (at(x[0]) - at(y[0])) || (x[1] - y[1])).map(([c]) => c);
  const seen = new Set(), out = [];
  for (const cue of ordered) {
    if (own(dm, cue.id) && dm[cue.id]) continue;
    const base = { id: cue.id, reason: cue.reason, evidence: cue.evidence, clause: cue.clause, cueText: cue.cueText, cueIndex: cue.cueIndex };
    let card = null, key = null;
    if (typeof cue.probe === "string") {
      const pr = probes.find(p => p.id === cue.probe);
      if (!pr || pa[pr.id] !== undefined) continue;
      const rescue = pr.kind === RESCUE_KIND;
      const target = typeof pr.target === "string" ? pr.target : rescue && typeof pr.rescues === "string" ? pr.rescues : null;
      if (rescue ? !rescueLive(pr) : (target !== null && a[target] !== undefined) || writesAnswered(pr)) continue;
      const entry = entries.find(e => e.id === cue.id && e.probe === cue.probe);
      key = target !== null ? "item:" + target : "probe:" + pr.id;
      const k = own(PROBE_KIND, pr.kind) ? PROBE_KIND[pr.kind] : null;
      card = { ...base, kind: "probe", target: pr.id, probeKind: pr.kind, tag: k ? k.label : "", ask: entryAsk(entry) ?? pr.say,
        opts: arr(pr.opts).map((o, i) => ({ label: isObj(o) ? o.l : String(o), value: i, rf: !!(isObj(o) && o.rf) })) };
    } else if (typeof cue.item === "string") {
      const it = own(byId, cue.item) ? byId[cue.item] : undefined;
      if (!it || a[it.id] !== undefined || sk[it.id]) continue;
      const entry = entries.find(e => e.id === cue.id && e.item === cue.item);
      const s = itemSuggestion(it, domainByKey, CAPTURE_KIND.CLARIFY);
      key = "item:" + it.id;
      card = { ...base, kind: "item", target: it.id, tag: s.tag, ask: entryAsk(entry) ?? s.ask, scale: it.scale,
        opts: Array.isArray(it.scale) ? it.scale.map((o, i) => ({ label: isObj(o) ? o.label : String(o), value: i }))
          : [{ label: "Yes", value: ANSWER.YES }, { label: "No", value: ANSWER.NO }] };
    } else if (cue.reason === "placeholder") {
      const pq = isObj(lex.clauses) && isObj(lex.clauses.placeholderAsk) ? lex.clauses.placeholderAsk.text : undefined;
      if (typeof pq !== "string" || !pq.trim()) continue;
      key = "placeholder";
      card = { ...base, kind: "note", target: null, ask: pq, opts: [] };
    }
    if (card === null || seen.has(key)) continue;
    seen.add(key);
    if (cue.against !== undefined) card.against = cue.against;
    out.push(card);
  }
  return out;
}

/**
 * Ask-next sections in render order: every probe group whose PROBE_KIND rank is 0 (the safety
 * tier), then the heard prompts (only when non-empty), then every other probe group in the
 * order given (truncateProbes order). With no rank-0 group the heard section comes first.
 * @param probeGroups  the truncateProbes result: [{kind, shown, total}]
 * @param heard        the heardPrompts result
 * @returns {Array<{kind: "probes", group: Object} | {kind: "heard", items: Object[]}>}
 */
export function askNextSections(probeGroups = [], heard = []) {
  const groups = arr(probeGroups);
  const items = arr(heard);
  const isTop = (g) => isObj(g) && Object.prototype.hasOwnProperty.call(PROBE_KIND, g.kind) && PROBE_KIND[g.kind].rank === 0;
  const out = groups.filter(isTop).map(group => ({ kind: "probes", group }));
  if (items.length) out.push({ kind: "heard", items });
  for (const group of groups) if (!isTop(group)) out.push({ kind: "probes", group });
  return out;
}

// ---------------------------------------------------------------------------------------
// Question review (release 0.4.8, follow-up)
// ---------------------------------------------------------------------------------------

/**
 * Where the session recorded an item's current answer, as the Scribe's Question review names it
 * (release 0.4.8, follow-up; engine chrome, English): a spoken line (the microphone or the demo
 * transcript), typed chart text, a probe on the Ask next rail, a Clarify card, an Ask next card (a
 * suggestion or a heard card) or an edit in the review itself.
 */
export const REVIEW_SOURCE = Object.freeze({
  heard: "heard in encounter",
  typed: "typed chart text",
  probe: "probe",
  clarify: "Clarify card",
  askNext: "Ask next",
  review: "question review edit",
});

/**
 * The Question review (release 0.4.8, follow-up: the clinical lead's request of 2026-10-12): every
 * scored item of the module, once, by domain in domainOrder and each domain's item order, with its
 * question, tag and short label as the Ask next cards build them (ask = item.ask ?? item.text; the
 * Scribe short label), its answer options (the scale labels by option index, or Yes / No) and its
 * current answer. An absent answer, or "unsure", is not answered (answered false, answerLabel null):
 * never a no. `source` is the REVIEW_SOURCE key the caller recorded for the item, or null. Context
 * items, info prompts and red flags are not listed (the Safety view holds the flags). Nothing here
 * records anything.
 * ReviewRow = {id, short, ask, tag, scale, options: [{label, value}], value, answered, answerLabel, source}.
 * @param state {answers, sources: {itemId: REVIEW_SOURCE key}}
 * @returns {Array<{key: string, label: string, items: Object[]}>}
 */
export function questionReview(module, { answers = {}, sources = {} } = {}) {
  const a = obj(answers), src = obj(sources);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const byId = (module && module.itemById) || {};
  const domainByKey = domainIndex(module || {});
  const seen = new Set(), out = [];
  for (const key of arr(module && module.domainOrder)) {
    const d = domainByKey[key];
    if (!isObj(d)) continue;
    const items = [];
    for (const raw of arr(d.items)) {
      if (!isObj(raw) || typeof raw.id !== "string" || seen.has(raw.id) || !own(byId, raw.id)) continue;
      seen.add(raw.id);
      const it = byId[raw.id];
      const sug = itemSuggestion(it, domainByKey, "scored");
      const options = Array.isArray(it.scale) ? it.scale.map((o, i) => ({ label: isObj(o) ? o.label : String(o), value: i }))
        : [{ label: "Yes", value: ANSWER.YES }, { label: "No", value: ANSWER.NO }];
      const value = own(a, it.id) ? a[it.id] : undefined;
      const answered = isAnswered(value);
      const opt = answered ? options.find(o => o.value === value) : undefined;
      items.push({
        id: it.id, short: itemShort(it), ask: sug.ask, tag: sug.tag, scale: it.scale, options, value, answered,
        answerLabel: answered ? (opt ? opt.label : String(value)) : null,
        source: own(src, it.id) && own(REVIEW_SOURCE, src[it.id]) ? src[it.id] : null,
      });
    }
    if (items.length) out.push({ key, label: d.label, items });
  }
  return out;
}

/**
 * The probe answers left standing once the clinician changes or clears `itemId` in the Question
 * review (release 0.4.8, follow-up; review fix): every answered probe whose chosen option wrote that
 * item (the option's `a` names it) is retracted, so its note (probeNoteList, the EMR template's probe
 * notes) and its probe-keyed EMR checklist signals no longer state the finding the clinician
 * corrected, and the probe can be asked again while it is live. The other items that option wrote
 * keep their answers; a red flag it raised stays raised (a probe never clears a flag, and neither
 * does its retraction). Returns `probeAns` itself when nothing is retracted. Pure.
 * @param probeAns {probeId: chosen option index}
 * @returns {Object}
 */
export function retractProbeAnswers(module, probeAns, itemId) {
  const pa = obj(probeAns);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const drop = probeList(module).filter((pr) => {
    if (!own(pa, pr.id) || !Number.isInteger(pa[pr.id])) return false;
    const o = arr(pr.opts)[pa[pr.id]];
    return isObj(o) && isObj(o.a) && own(o.a, itemId);
  }).map((pr) => pr.id);
  if (!drop.length) return probeAns;
  const out = { ...pa };
  for (const id of drop) delete out[id];
  return out;
}

/**
 * The notes of the probe answers on record, in the order they were answered (probeAns key order, as
 * the EMR template reads them): the encounter note's SUPPORTING FEATURES AND EXAM lines (release
 * 0.4.8, follow-up; review fix: derived from probeAns, so a retracted probe answer takes its note
 * with it). An option without a note adds nothing.
 * @param probeAns {probeId: chosen option index}
 * @returns {string[]}
 */
export function probeNoteList(module, probeAns) {
  const pa = obj(probeAns);
  const byId = new Map(probeList(module).map((pr) => [pr.id, pr]));
  const out = [];
  for (const id of Object.keys(pa)) {
    const pr = byId.get(id);
    const o = pr && Number.isInteger(pa[id]) ? arr(pr.opts)[pa[id]] : undefined;
    if (o && o.note) out.push(o.note);
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Capture labels (Scb L1299-1308)
// ---------------------------------------------------------------------------------------

function kindOf(module, c) {
  if (c.kind === CAPTURE_KIND.REDFLAG || c.kind === CAPTURE_KIND.CTX || c.kind === CAPTURE_KIND.ITEM) return c.kind;
  // A clarification cue names its target (item or probe), never a flag: never resolved by membership.
  if (c.kind === CAPTURE_KIND.CLARIFY) return c.kind;
  // A capture stored without its kind (e.g. {id, value} on a transcript line) is resolved by
  // membership, never by an id pattern.
  if (module.flagById && module.flagById[c.id]) return CAPTURE_KIND.REDFLAG;
  if (arr(module.contextItems).some(ci => ci.id === c.id)) return CAPTURE_KIND.CTX;
  return CAPTURE_KIND.ITEM;
}

/** An item capture's label: short label, scale option label or "no "; unknown ids show the id. */
function itemLabel(module, c) {
  const it = module.itemById && module.itemById[c.id]; if (!it) return c.id;
  if (it.scale) return `${itemShort(it)}: ${it.scale[c.value]?.label ?? c.value}`;
  return (c.value === "no" ? "no " : "") + itemShort(it);
}

/**
 * The heard tag text: "heard “<cueText>” · <itemShort>: not stated"; without a cueText string,
 * "heard · <itemShort>: not stated". An unknown id shows the id in place of the short label.
 * The value is never consulted: a heard capture has none.
 */
export function heardLabel(module, capture) {
  const c = obj(capture);
  const it = module && module.itemById && module.itemById[c.id];
  const short = it ? itemShort(it) : c.id;
  const heard = typeof c.cueText === "string" ? "heard “" + c.cueText + "”" : "heard";
  return heard + " · " + short + ": not stated";
}

/**
 * The clarification tag text (release 0.4.7): "clarify “<cueText>” · <short>", short being the
 * item's short label (an item cue) or the short label of a probe's target item (a probe cue); a
 * probe without a target item and a placeholder cue add nothing after the quote. Without a cueText
 * string the quote is left out. An unknown item id shows the id. Never a value, never "RED FLAG".
 */
export function clarifyLabel(module, cue) {
  const c = obj(cue);
  const byId = (module && module.itemById) || {};
  const shortOf = (id) => (Object.prototype.hasOwnProperty.call(byId, id) ? itemShort(byId[id]) : id);
  let short = "";
  if (typeof c.item === "string") short = shortOf(c.item);
  else if (typeof c.probe === "string") {
    const pr = probeList(module).find(p => p.id === c.probe);
    short = pr && typeof pr.target === "string" ? shortOf(pr.target) : "";
  }
  return "clarify" + (typeof c.cueText === "string" ? " “" + c.cueText + "”" : "") + (short ? " · " + short : "");
}

/**
 * The capture tag text: heard → heardLabel; clarify → clarifyLabel; redflag → "RED FLAG: " + the
 * flag's points (else the id); ctx → the context item's captureLabel (else the id); item → short
 * label, with the scale option label for a scale item, or "no " before a denied boolean item.
 * Unknown ids show the id. A carry-over item capture (via "carry") appends " · follow-up to
 * “<cue text>”", the cue text being fromCueText (a stored transcript tag) or carriedFrom.cueText
 * (an engine capture); when that is not a string the suffix is " · follow-up".
 */
export function captureLabel(module, capture) {
  const c = obj(capture);
  if (c.kind === CAPTURE_KIND.HEARD) return heardLabel(module, c);
  if (c.kind === CAPTURE_KIND.CLARIFY) return clarifyLabel(module, c);
  if (c.via === "carry") {
    const from = c.fromCueText ?? (isObj(c.carriedFrom) ? c.carriedFrom.cueText : undefined);
    return itemLabel(module, c) + (typeof from === "string" ? " · follow-up to “" + from + "”" : " · follow-up");
  }
  const kind = kindOf(module, c);
  if (kind === CAPTURE_KIND.REDFLAG) return "RED FLAG: " + ((module.flagById && module.flagById[c.id])?.points || c.id);
  if (kind === CAPTURE_KIND.CTX) {
    const ci = arr(module.contextItems).find(x => x.id === c.id);
    return (ci && ci.captureLabel) || c.id;
  }
  return itemLabel(module, c);
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
