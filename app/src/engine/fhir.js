// engine/fhir.js — the published FHIR and CDS Hooks artifacts and the screen Bundle
// (design 03 §4.7). Owner: WP4.
//
// Moved from the baseline Screener builders (Scr L413-558) and the baseline Scribe bundle
// (Scb L1396-1458), with every identifier, system and module noun phrase read from the bound
// module instead of file constants:
//   - systems and identifiers come from the rendered `module.fhir` / `module.cds` (the
//     IDENTITY_TEMPLATE_FIELDS, rendered from {id} and {instrument} by the binder);
//   - domains, items and red flags come from the module, in module order;
//   - the scale maximum, the negative minimum and the band ranges are derived (scoring.js);
//   - the index name in the referral reason is `module.copy.indexName`.
// Engine-owned sentences (the CDS safety detail, the dictionary rule and field notes, the
// Observation notes and the component displays) are kept byte-for-byte from the baseline.
//
// Generated artifacts say what they are (§3.10): for every non-built-in module the
// Questionnaire title and publisher carry the clinician provenance marker, the description
// carries the clinician provenance line, and a verified derivation also carries `derivedFrom`;
// the CDS service and every example card source carry the same; the dictionary gains a
// `provenance` object and the bundle Observation a provenance note.
//
// Pure: no React, no side effects, no module closures run here. Time enters only through the
// `date` / `now` parameters, so goldens are deterministic.
import { APP_VERSION, CAVEATS } from "./policy.js";
import { BAND_INTERP, TIERS, normalizeAnswer } from "./vocab.js";
import { scaleMaxOf, negativeMinOf, bandRangeText } from "./scoring.js";
import { referralFor } from "./rules.js";
import { referralGate } from "./gates.js";
import { provenanceLines } from "./lineage.js";

// ----------------------------------------------------------------------------- helpers

const todayIso = () => new Date().toISOString().slice(0, 10);

const isBuiltin = (module) => module.origin === "builtin";

const scaleMaxFor = (module) => (typeof module.scaleMax === "number" ? module.scaleMax : scaleMaxOf(module));
const negativeMinFor = (module) => (typeof module.negativeMin === "number" ? module.negativeMin : negativeMinOf(module));

/**
 * The clinician provenance marker appended to titles (§3.11 "Provenance display"):
 * `CAVEATS.edited.short` for a derivation, `CAVEATS.uploaded.short` for an upload, both for a
 * derivation from an upload. `null` for a built-in.
 */
function provenanceMarker(module) {
  if (isBuiltin(module)) return null;
  const parts = [];
  if (module.origin === "derived") parts.push(CAVEATS.edited.short);
  if (module.origin === "uploaded" || module.classification?.kind === "derived-from-upload") parts.push(CAVEATS.uploaded.short);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * The clinician provenance line (lineage.js `provenanceLines`, clinician set, one sentence per
 * line, joined by a space). `null` for a built-in.
 */
function provenanceLine(module) {
  if (isBuiltin(module)) return null;
  const lines = provenanceLines(module, "clinician") || [];
  return lines.length ? lines.join(" ") : null;
}

const withMarker = (text, marker) => (marker ? `${text} · ${marker}` : text);
const withLine = (text, line) => (line ? `${text}\n\n${line}` : text);

/** A verified derivation (origin `derived`, per the classifyLineage result, never the file). */
const verifiedRoot = (module) => {
  if (module.origin !== "derived") return null;
  const root = module.classification?.root;
  return root && root.fhir && typeof root.fhir.questionnaireUrl === "string" ? root : null;
};

// ----------------------------------------------------------------------------- Questionnaire

/**
 * The FHIR Questionnaire of the instrument (Scr L424-472). Byte-identical to the baseline
 * Screener's for the built-in; keeps the `initialSelected:false` no-op on the top option.
 * @param {Object} module  bound module
 * @param {{date?:string}} [opts]  YYYY-MM-DD; default today
 */
export function buildQuestionnaire(module, { date = todayIso() } = {}) {
  const fhir = module.fhir;
  const marker = provenanceMarker(module);
  const line = provenanceLine(module);
  const root = verifiedRoot(module);
  return {
    resourceType: "Questionnaire",
    url: fhir.questionnaireUrl,
    version: module.instrumentVersion,
    name: fhir.questionnaireName,
    title: withMarker(fhir.questionnaireTitle, marker),
    ...(root ? { derivedFrom: [`${root.fhir.questionnaireUrl}|${root.instrumentVersion}`] } : {}),
    status: "draft",
    experimental: true,
    date,
    publisher: withMarker(fhir.publisher, marker),
    description: withLine(fhir.description, line),
    subjectType: ["Patient"],
    item: [
      {
        linkId: "safety",
        text: fhir.safetyGroupText,
        type: "group",
        item: module.redFlags.map(f => ({
          linkId: f.id, text: f.text, type: "boolean",
          code: [{ system: fhir.codeSystem, code: f.id, display: f.points }],
        })),
      },
      ...module.domains.map(d => ({
        linkId: d.key,
        text: d.label,
        type: "group",
        item: d.items.map(it => ({
          linkId: it.id,
          text: it.text,
          type: it.scale ? "choice" : "boolean",
          ...(it.scale
            ? { answerOption: it.scale.map((s, i) => ({
                valueCoding: { system: fhir.answerSystem, code: String(i), display: s.label },
                ...(s.f === Math.max(...it.scale.map(x => x.f)) ? { initialSelected: false } : {}),
              })) }
            : {}),
          // The scoring weight travels with the item so an implementer cannot reimplement
          // the index from the item text and get a different number.
          extension: [{ url: fhir.weightExtension, valueDecimal: it.w }],
          ...(it.ref ? { code: [{ system: fhir.criteriaSystem, code: it.ref, display: it.ref }] } : {}),
        })),
      })),
    ],
  };
}

// ----------------------------------------------------------------------------- CDS Hooks

/**
 * The CDS Hooks discovery document and example responses (Scr L474-519), generated:
 * the safety example is built from `cds.examples.redFlagPresent.flagId`'s action plus the
 * engine sentence; the settled example from `cds.examples.settled` (omitted when absent);
 * `notScorable` is always `{cards: []}` — an incomplete screen emits no reassuring card.
 * @param {Object} module  bound module
 */
export function buildCdsHooks(module) {
  const { fhir, cds } = module;
  const marker = provenanceMarker(module);
  const line = provenanceLine(module);
  const examples = cds.examples || {};
  const source = () => ({ label: withMarker(cds.source.label, marker), url: cds.source.url });

  const exampleResponses = {};
  const rfx = examples.redFlagPresent;
  const flag = rfx && module.redFlags.find(f => f.id === rfx.flagId);
  if (flag) {
    exampleResponses.redFlagPresent = {
      cards: [{
        uuid: cds.safetyCardUuid,
        summary: rfx.summary,
        indicator: "critical",
        detail: `${flag.action}. The screening index is withheld from routing.`,
        source: source(),
        suggestions: [],
        selectionBehavior: "any",
      }],
    };
  }
  if (examples.settled) {
    exampleResponses.settledNonLowBand = {
      cards: [{
        uuid: cds.indexCardUuid,
        summary: examples.settled.summary,
        indicator: "warning",
        detail: examples.settled.detail,
        source: source(),
      }],
    };
  }
  // The state that matters most: no card at all. An incomplete screen must not emit a
  // reassuring card, and an empty cards array is the correct response.
  exampleResponses.notScorable = { cards: [] };

  return {
    discovery: {
      services: [{
        hook: cds.hook,
        id: cds.serviceId,
        title: withMarker(cds.title, marker),
        description: withLine(cds.description, line),
        prefetch: {
          patient: "Patient/{{context.patientId}}",
          priorScreens: `Observation?patient={{context.patientId}}&code=${fhir.codeSystem}|${fhir.indexCode}&_sort=-date&_count=1`,
          activeFlags: "Flag?patient={{context.patientId}}&status=active",
        },
      }],
    },
    exampleResponses,
  };
}

// ----------------------------------------------------------------------------- data dictionary

/**
 * The data dictionary (Scr L521-558). One generator for both apps (AD3): `module_id` first and
 * `complaint` before `coverage` in `canonicalCohortFields`; the score field's note names the
 * module's index and its type the module's scale maximum.
 * @param {Object} module  bound module
 * @param {{appVersion?:string}} [opts]
 */
export function buildDataDictionary(module, { appVersion = APP_VERSION } = {}) {
  const typeOf = it => (it.scale ? `choice (0–${it.scale.length - 1})` : "boolean");
  const scaleMax = scaleMaxFor(module);
  const indexName = module.copy?.indexName;
  const dict = {
    instrument: { url: module.fhir.questionnaireUrl, instrumentVersion: module.instrumentVersion, appVersion },
    scoring: {
      positiveMax: scaleMax,
      discriminatorMin: negativeMinFor(module),
      bands: bandRangeText(module),
      rule: "A band is issued only when the attainable range — current total plus the best and worst cases of every unanswered item — falls inside a single band. Unanswered items are never scored as denials.",
    },
    canonicalCohortFields: [
      { name: "module_id", type: "string", note: "Id of the module the screen was captured with. Rows of another module or instrument version are kept out of this module's analyses." },
      { name: "score", type: `number 0–${scaleMax}`, note: `${indexName} at time of capture` },
      { name: "label", type: "0 | 1 | empty", note: "Reference standard. EMPTY means no reference standard yet — it is never imputed to 0." },
      { name: "reference_diagnosis", type: "free text | empty", note: "Filled at follow-up; the source for `label`." },
      { name: "subject_id", type: "string", note: "Site-local one-way pseudonym of the MRN, stable across sessions. The key that makes test-retest, responsiveness, and MCID validation possible; without it every screen is an unlinkable cross-section. Never contains or reveals the identifier it was derived from." },
      { name: "visit_label", type: "string", note: "Optional protocol visit name (baseline, 6-week). Order is derived from captured_at, not from this field." },
      { name: "sex", type: "string", note: "Fairness axis. Recorded and audited separately from gender — neither substitutes for the other, and rows missing this field are excluded from sex-stratified results rather than pooled into an unknown group." },
      { name: "gender", type: "string", note: "Fairness axis, independent of sex. Free text rather than a fixed enumeration; small strata are suppressed by the reporting minimum, not dropped." },
      { name: "age", type: "number" },
      { name: "weight", type: "number", note: "Analytic or survey weight; defaults to 1 at computation only" },
      { name: "annual_cost", type: "number USD" },
      { name: "avoidable_cost", type: "number USD" },
      { name: "complaint", type: "string | empty", note: "Phenotype value recorded with the screen. EMPTY when none was recorded." },
      { name: "coverage", type: "number 0–100", note: "Proportion of items answered" },
      { name: "scorable", type: "0 | 1", note: "Whether the attainable range settled into one band" },
      { name: "band", type: "low | moderate | high | indeterminate" },
      { name: "red_flags", type: "pipe-delimited ids", note: "Red flags recorded at the safety step" },
    ],
    items: module.domains.flatMap(d =>
      d.items.map(it => ({
        id: it.id, domain: d.key, domainLabel: d.label,
        text: it.text, type: typeOf(it), weight: it.w,
        direction: it.w < 0 ? "reverse — evidence against the hypothesis" : "forward",
        options: it.scale ? it.scale.map((s, i) => ({ code: i, label: s.label, factor: s.f })) : [true, false],
        ...(it.ref ? { criterion: it.ref } : {}),
      }))),
    redFlags: module.redFlags.map(f => ({ id: f.id, tier: f.tier, group: f.group, text: f.text, points: f.points, action: f.action, scored: false })),
  };
  if (!isBuiltin(module)) {
    const verified = module.origin === "derived" && module.provenance;
    dict.provenance = {
      origin: module.origin,
      line: provenanceLine(module),
      root: verified ? module.provenance.root ?? null : null,
      derivedFrom: verified ? module.provenance.derivedFrom ?? null : null,
      contentHash: module.hashes?.contentHash ?? null,
    };
  }
  return dict;
}

// ----------------------------------------------------------------------------- Bundle

const SURFACES = ["screener", "scribe"];

/**
 * The QuestionnaireResponse group answer for a domain's points (decision F13, AD14): FHIR
 * valueInteger only for an integer; a fractional sum (a scale factor below 1) is valueDecimal.
 */
function domainPtsAnswer(pts) {
  return Number.isInteger(pts) ? { valueInteger: pts } : { valueDecimal: pts };
}

/**
 * The transaction Bundle a screen writes back (design §4.7). Base: the baseline Scribe bundle
 * (Scb L1396-1458), with the surface switches kept verbatim from each baseline:
 *   screener — referralGate surface "screener" (no referral while a red flag is open); a
 *              routing-override component when a flag is open (Scr L1516-1521, before the
 *              attainable range); its own incomplete-note and referral-reason wording; no
 *              DocumentReference.
 *   scribe   — referralGate surface "scribe" (no referral before routing has cleared, nor
 *              while a red flag is open, whatever routingCleared says); no routing-override component; its own
 *              incomplete-note and referral-reason wording; a DocumentReference.
 * The attainable range runs from `floor` on both surfaces (AD1).
 * A routing error withholds the referral ServiceRequest and adds the withheld-routing note to
 * the Observation; the red-flag Flag and ServiceRequest are unaffected (D6).
 *
 * @param {Object} module  bound module
 * @param {{patient:Object, answers:Object, score:Object, complaint?:string, activeFlags?:Object[],
 *          emergent?:boolean, routingCleared?:boolean, routingError?:(Object|null)}} screen
 *        `score` is the computeScore result. `routingCleared` is read on the scribe surface only;
 *        anything but `true` issues no referral there, and an open red flag withholds it even then.
 * @param {{surface:("screener"|"scribe"), now?:string}} opts
 */
export function buildBundle(module, screen, { surface, now = new Date().toISOString() } = {}) {
  if (!SURFACES.includes(surface)) throw new Error(`buildBundle: unknown surface "${surface}"`);
  const fhir = module.fhir;
  const scaleMax = scaleMaxFor(module);
  const {
    patient, answers, score, complaint = "", activeFlags = [], routingCleared, routingError = null,
  } = screen;
  const { total, floor, ceiling, coverage, scorable, band, domains } = score;
  const emergent = screen.emergent ?? activeFlags.some(f => f.tier === TIERS[0]);
  const interp = BAND_INTERP[band];
  const override = activeFlags.length > 0;
  const screener = surface === "screener";
  // A referral is only proposed from a settled, non-lowest band — never while a red flag is
  // open on either surface (the indicated request is the safety workup; referralGate enforces
  // it whatever routingCleared the caller passes), never before routing has cleared on the
  // scribe, and never from a rule set that failed.
  const referral = referralGate({ surface, override, routingCleared: routingCleared === true, score, routingError })
    ? referralFor(module, complaint, { routingError })
    : null;
  const subject = { reference: `Patient/${patient.id}` };
  const line = provenanceLine(module);

  const entries = [];

  // Red flags post as Flag resources so they are visible in the chart independently of
  // whether anyone opens the screening result.
  for (const f of activeFlags) {
    entries.push({ resource: { resourceType: "Flag", status: "active",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/flag-category", code: "clinical" }] }],
      code: { coding: [{ system: fhir.codeSystem, code: f.id, display: f.points }], text: f.text },
      subject, period: { start: now } } });
  }

  // Item-level capture: asked-and-denied carries valueBoolean:false; never-asked carries no
  // answer element. Collapsing those into a zero renders absent data as negative data.
  entries.push({ resource: { resourceType: "QuestionnaireResponse", status: scorable ? "completed" : "in-progress",
    questionnaire: fhir.questionnaireUrl, subject, authored: now,
    item: module.domains.map(d => ({ linkId: d.key, text: domains[d.key].label, answer: [domainPtsAnswer(domains[d.key].pts)],
      item: d.items.map(it => {
        const v = normalizeAnswer(answers?.[it.id]);
        const node = { linkId: it.id, text: it.text };
        if (v === undefined) return node;
        node.answer = [it.scale
          ? { valueCoding: { system: fhir.answerSystem, code: String(v), display: it.scale[v]?.label } }
          : { valueBoolean: v === "yes" }];
        return node;
      }) })) } });

  const components = module.domains.map(d => ({
    code: { coding: [{ system: fhir.codeSystem, code: `domain-${d.key}`, display: domains[d.key].label }] },
    valueQuantity: { value: domains[d.key].pts, unit: "score", code: "{score}" },
  }));
  components.push({
    code: { coding: [{ system: fhir.codeSystem, code: "screen-coverage", display: "Proportion of scored items answered" }] },
    valueQuantity: { value: coverage, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
  });
  if (screener && override) {
    components.push({
      code: { coding: [{ system: fhir.codeSystem, code: "routing-override", display: "Screening routing withheld — red flag present" }] },
      valueString: activeFlags.map(f => f.points).join("; "),
    });
  }
  if (!scorable) {
    components.push({
      code: { coding: [{ system: fhir.codeSystem, code: "attainable-range", display: "Attainable index range given unanswered items" }] },
      valueRange: { low: { value: floor, unit: "score", code: "{score}" }, high: { value: ceiling, unit: "score", code: "{score}" } },
    });
  }

  const notes = [];
  if (!scorable) {
    notes.push({ text: screener
      ? `Screen incomplete (${coverage}% of items answered). Index is bounded to ${floor}–${ceiling}/${scaleMax}, which spans more than one band. No result issued.`
      : `Screen incomplete (${coverage}% of items answered). Index bounded to ${floor}–${ceiling}/${scaleMax}, spanning more than one band. No result issued.` });
  }
  if (routingError) {
    notes.push({ text: `Screening routing withheld: module rule "${routingError.ruleId}" failed, so no referral was issued.` });
  }
  if (line) notes.push({ text: line });

  // No value or interpretation until the band settles — a partial index reads downstream as
  // a completed negative screen.
  entries.push({ resource: { resourceType: "Observation", status: scorable ? "final" : "preliminary",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey" }] }],
    code: { coding: [{ system: fhir.codeSystem, code: fhir.indexCode, display: fhir.indexDisplay }] },
    subject, effectiveDateTime: now,
    ...(scorable
      ? { valueQuantity: { value: total, unit: "score", system: "http://unitsofmeasure.org", code: "{score}" },
          interpretation: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: interp, display: `${band} likelihood` }] }] }
      : { dataAbsentReason: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/data-absent-reason", code: "temp-unknown", display: "Temporarily Unknown" }] } }),
    ...(notes.length ? { note: notes } : {}),
    component: components } });

  if (!screener) {
    entries.push({ resource: { resourceType: "DocumentReference", status: "current",
      type: { text: fhir.documentType }, subject, date: now,
      content: [{ attachment: { contentType: "text/plain", title: fhir.documentTitle } }] } });
  }

  if (override) {
    entries.push({ resource: { resourceType: "ServiceRequest", status: "draft", intent: "proposal",
      priority: emergent ? "stat" : "urgent",
      code: { text: `Red-flag evaluation: ${activeFlags.map(f => f.action).join("; ")}` },
      subject, authoredOn: now,
      reasonCode: activeFlags.map(f => ({ text: `${f.text} — ${f.points}` })) } });
  }

  if (referral) {
    entries.push({ resource: { resourceType: "ServiceRequest", status: "draft", intent: "proposal", priority: "routine",
      code: { text: `Referral: ${referral.specialty} — evaluate for ${referral.reason}` },
      subject, authoredOn: now,
      reasonCode: [{ text: screener
        ? `${module.copy.indexName} ${total}/${scaleMax} (${band} likelihood); administer confirmatory instrument.`
        : `${module.copy.indexName} ${total}/${scaleMax} (${band}); administer confirmatory instrument.` }] } });
  }

  return { resourceType: "Bundle", type: "transaction", timestamp: now,
    entry: entries.map(e => ({ ...e, request: { method: "POST", url: e.resource.resourceType } })) };
}
