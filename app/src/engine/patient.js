// engine/patient.js — the Patient Companion's engine (design 03 §3.7, §4.12, §5.5). Owner: WP6.
//
// Imports only evaluate.js, vocab.js and policy.js. It never imports scoring, fhir, rules,
// cohort, probes, extraction or scribe, so nothing reachable from the Patient Companion can
// compute or name a score, band or probability (D15, the `omissions` graph test).
//
// What lives here:
//   PATIENT_CHROME   the locale-keyed chrome of Pat `UI` (Pat L379-424) minus the module-owned
//                    keys (sub, sections[2..7]) and the shell caveats (reviewBanner, txtUnreviewed,
//                    which are policy.js CAVEATS.unreviewed), moved verbatim; plus the English
//                    JSX literals of Intro, Safety, Summary and the footer (es falls back to en,
//                    exactly as the baseline showed English there).
//   TIER_DISPLAY     red-flag tier → patient display key and colours (Pat L263-272).
//   GRAMMAR          the list joiners and statement-to-question transforms (Pat L981-994).
//   projectForPatient, localeText, flagCopy, buildPatientSummary, askForm, joinList,
//   summaryText, summaryHtml, richText (§4.12), plus chromeFor (the en-fallback chrome view)
//   and localeFallback (whether a locale string is English standing in for a translation).
//
// Plain data and pure functions; nothing runs at import time. Module closures (the summary
// rules, derived values and sum templates) are only ever called inside try/catch: a throw
// withholds the whole summary and is returned as {family:"patient", ruleId, message} (D6).
import { evaluateRules, renderTpl } from "./evaluate.js";
import { ANSWER, TIERS } from "./vocab.js";
import { APP_VERSION, CAVEATS } from "./policy.js";

// ---------------------------------------------------------------------------------------
// Chrome (design §3.7). Values moved byte-for-byte from the baseline Patient file.
// ---------------------------------------------------------------------------------------

/**
 * Patient chrome per locale. `en` carries every key; `es` carries the keys the baseline
 * translated (Pat L402-423), and falls back to `en` for the rest (chromeFor).
 *
 * Key → baseline source (Pat):
 *   title … fileName        UI[loc] L380-423, verbatim, minus sub / sections / reviewBanner / txtUnreviewed
 *   sections.{intro,safety,summary}   UI[loc].sections[0,1,8]
 *   introHeading, introLede           L781-785 (Intro)
 *   forYouIfTitle                     L787 (the bullets are module wording: locales.en.ui.forYouIf)
 *   whatItIsntTitle, whatItIsnt       L794-799 (the "What it isn't" box)
 *   privacyNote                       L803-806
 *   safetyHeading, safetyLede         L815-819
 *   callNow, callSoon                 L839
 *   carryOn                           L849
 *   noneApply                         L855
 *   summaryLede                       L1016-1019
 *   seenToday, seenWeek               L1025
 *   disclaimer                        L1087-1091
 *   footer                            L753-754, with {name}, {appVersion}, {instrument}
 * JSX text is given as React renders it: each line trimmed, line breaks joined by one space.
 */
export const PATIENT_CHROME = deepFreeze({
  en: {
    title: "Getting ready for your visit",
    step: "STEP", of: "OF", back: "Back", next: "Next", start: "Start", seeSummary: "See my summary",
    sections: { intro: "Start", safety: "Safety check", summary: "Your summary" },
    yes: "Yes", no: "No", unsure: "Not sure",
    tierNow: "Today", tierSoon: "This week",
    tierNowWhat: "Please get seen today — an urgent care, an emergency department, or a same-day call to your doctor's office. Don't wait for a routine appointment.",
    tierSoonWhat: "Call your doctor's office this week. Ask to be seen sooner than the next routine slot, and say exactly why.",
    sayThis: "What to say", print: "Print", download: "Download", startOver: "Start over",
    summaryTitle: "Your visit summary",
    openWith: "How I'd open", describe: "What I want to describe", askAbout: "What I want to ask",
    notSure: "Things I'm not sure about", notSureLede: "Worth checking my records or asking directly:",
    forClinician: "For my clinician",
    thinTitle: "There isn't much here yet",
    thin: "You haven't answered enough for this to be worth handing over. Go back and answer what you can — \"Not sure\" counts, and it's often the most useful answer, because it turns into something to ask about.",
    txtSeenToday: "** GET SEEN TODAY **", txtSeenWeek: "** GET SEEN THIS WEEK **", txtSay: "Say",
    txtClinNote: "Self-reported; no screening index was calculated. '-' points away from the pattern.",
    txtFooter: "research prototype, not medical advice. Does not diagnose. Not validated in a clinical study.",
    fileName: "my-visit-summary.txt",
    // English JSX literals of the baseline (es falls back to these, as it did).
    introHeading: "Before your appointment",
    introLede: "This takes about five minutes. At the end you get a one-page summary you can print or show on your phone — what to say, what to ask, and what you're unsure about.",
    forYouIfTitle: "It's for you if",
    whatItIsntTitle: "What it isn't",
    whatItIsnt: "It doesn't diagnose anything and it won't tell you what you have. It gives you no score and no risk number. What it does is help you describe the pattern accurately, which is often the part that's been going wrong.",
    privacyNote: "Everything stays in your browser. Nothing is uploaded, saved to an account, or shared — the summary only leaves this device if you print or download it yourself.",
    safetyHeading: "First, a safety check",
    safetyLede: "A few symptoms need looking at quickly, whatever else is going on. Tick anything that's true for you. If none of them are, that's the common answer.",
    callNow: "Please don't wait on this",
    callSoon: "Worth moving this along",
    carryOn: "You can carry on and finish the summary — it'll include this at the top.",
    noneApply: "None of these apply to me",
    summaryLede: "Print this, or keep it open on your phone. Handing it over at the start of the appointment works better than trying to remember it all.",
    seenToday: "Get seen today",
    seenWeek: "Get seen this week",
    disclaimer: "This is a research prototype and not medical advice. It doesn't diagnose, and it hasn't been validated in a clinical study. If something feels wrong or is getting worse, contact a clinician regardless of what this page says.",
    footer: "{name} patient companion v{appVersion} · instrument v{instrument} · research prototype · nothing you type leaves this device",
  },
  es: {
    title: "Preparándose para su consulta",
    step: "PASO", of: "DE", back: "Atrás", next: "Siguiente", start: "Empezar", seeSummary: "Ver mi resumen",
    sections: { intro: "Inicio", safety: "Revisión de seguridad", summary: "Su resumen" },
    yes: "Sí", no: "No", unsure: "No estoy seguro",
    tierNow: "Hoy", tierSoon: "Esta semana",
    tierNowWhat: "Por favor busque atención hoy — urgencias, una sala de emergencias, o una llamada el mismo día al consultorio de su doctor. No espere a una cita de rutina.",
    tierSoonWhat: "Llame al consultorio de su doctor esta semana. Pida que lo vean antes de la próxima cita de rutina, y diga exactamente por qué.",
    sayThis: "Qué decir", print: "Imprimir", download: "Descargar", startOver: "Empezar de nuevo",
    summaryTitle: "Mi resumen para la consulta",
    openWith: "Cómo empezaría", describe: "Lo que quiero describir", askAbout: "Lo que quiero preguntar",
    notSure: "Cosas de las que no estoy seguro", notSureLede: "Vale la pena revisar mi expediente o preguntar directamente:",
    forClinician: "Para mi médico",
    thinTitle: "Todavía no hay mucho aquí",
    thin: "No ha contestado lo suficiente como para que valga la pena entregarlo. Regrese y conteste lo que pueda — \"No estoy seguro\" cuenta, y muchas veces es la respuesta más útil, porque se convierte en algo que preguntar.",
    txtSeenToday: "** BUSQUE ATENCIÓN HOY **", txtSeenWeek: "** BUSQUE ATENCIÓN ESTA SEMANA **", txtSay: "Decir",
    txtClinNote: "Auto-reportado; no se calculó ningún índice de tamizaje. '-' apunta en contra del patrón.",
    txtFooter: "prototipo de investigación, no es consejo médico. No diagnostica. No ha sido validado en un estudio clínico.",
    fileName: "mi-resumen-para-la-consulta.txt",
  },
});

/** Red-flag tier → patient display: the chrome key (`tierNow`/`tierSoon` …) and colours (Pat L263-272). */
export const TIER_DISPLAY = deepFreeze({
  emergent: { key: "now", color: "var(--coral)", bg: "var(--coralbg)" },
  urgent: { key: "soon", color: "var(--amber)", bg: "var(--amberbg)" },
});

/** List joiners and the statement-to-question transform per locale (Pat L981-994). */
export const GRAMMAR = deepFreeze({
  en: { and: "and", oxford: true, ask: "en-regex" },
  es: { and: "y", oxford: false, ask: "period-to-question" },
});

const CHROME_CACHE = new Map();

/**
 * The chrome for a locale with every key present: the locale's own value, else English
 * (the baseline showed the untranslated literals in English). Frozen; cached per locale.
 * `fallbackKeys` (non-enumerable) lists the keys taken from English, so a component can mark
 * them lang="en".
 * @param {string} loc
 * @returns {Object}
 */
export function chromeFor(loc) {
  const key = typeof loc === "string" ? loc : "en";
  if (CHROME_CACHE.has(key)) return CHROME_CACHE.get(key);
  const en = PATIENT_CHROME.en;
  const own = hasOwn(PATIENT_CHROME, key) ? PATIENT_CHROME[key] : {};
  const out = {};
  const fallbackKeys = [];
  for (const k of Object.keys(en)) {
    if (k === "sections") {
      const sec = {};
      for (const s of Object.keys(en.sections)) {
        const v = own.sections && hasOwn(own.sections, s) ? own.sections[s] : undefined;
        if (v === undefined) fallbackKeys.push(`sections.${s}`);
        sec[s] = v !== undefined ? v : en.sections[s];
      }
      out.sections = sec;
      continue;
    }
    if (hasOwn(own, k)) out[k] = own[k];
    else { out[k] = en[k]; fallbackKeys.push(k); }
  }
  Object.defineProperty(out, "fallbackKeys", { value: Object.freeze(fallbackKeys), enumerable: false });
  const frozen = deepFreeze(out);
  CHROME_CACHE.set(key, frozen);
  return frozen;
}

// ---------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------

function hasOwn(o, k) { return o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k); }
function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function arr(x) { return Array.isArray(x) ? x : []; }

function deepFreeze(x) {
  if (x === null || (typeof x !== "object" && typeof x !== "function") || Object.isFrozen(x)) return x;
  Object.freeze(x);
  for (const k of Object.getOwnPropertyNames(x)) {
    const d = Object.getOwnPropertyDescriptor(x, k);
    if (d && "value" in d) deepFreeze(d.value);
  }
  return x;
}

function messageOf(err) {
  if (err && typeof err.message === "string" && err.message) return err.message;
  try { return String(err); } catch (_) { return "unknown error"; }
}

function patientError(ruleId, err) {
  return { family: "patient", ruleId, message: messageOf(err) };
}

/** The patient-wording copy of plain data (strings, numbers, booleans, arrays, objects). */
function cloneData(x) {
  if (Array.isArray(x)) return x.map(cloneData);
  if (isObj(x)) {
    const out = {};
    for (const k of Object.keys(x)) out[k] = cloneData(x[k]);
    return out;
  }
  return typeof x === "function" ? undefined : x;
}

function pick(obj, keys) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const k of keys) if (obj[k] !== undefined) out[k] = cloneData(obj[k]);
  return out;
}

function pickMap(map, keys) {
  const out = {};
  if (!isObj(map)) return out;
  for (const id of Object.keys(map)) if (isObj(map[id])) out[id] = pick(map[id], keys);
  return out;
}

/** YYYY-MM-DD for a Date, a timestamp or an ISO string ("2026-10-02…" is taken as written). */
function isoDate(generatedAt) {
  if (typeof generatedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(generatedAt)) return generatedAt.slice(0, 10);
  const d = generatedAt instanceof Date ? generatedAt : new Date(generatedAt === undefined || generatedAt === null ? Date.now() : generatedAt);
  if (Number.isNaN(d.getTime())) return isoDate(undefined);
  const p2 = n => String(n).padStart(2, "0");
  // The calendar date where the patient made the file: local time.
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

// ---------------------------------------------------------------------------------------
// Projection (design §4.12, D15)
// ---------------------------------------------------------------------------------------

const ITEM_WORDING_KEYS = ["q", "opts", "ask", "help"];
const FLAG_WORDING_KEYS = ["q", "say"];
const CONTEXT_WORDING_KEYS = ["q", "opts"];
const STEP_WORDING_KEYS = ["title", "heading", "lede", "intro"];
const UI_WORDING_KEYS = ["sub", "forYouIf", "clinicianLede"];

const VIEW_CACHE = new WeakMap();

/** Patient provenance (design §3.11 "Provenance display"): CAVEATS.patient.* only. */
function patientProvenance(module) {
  const lines = [];
  const markers = [];
  if (!module || module.origin === "builtin") return { lines, markers };
  const kind = module.classification && typeof module.classification === "object" ? module.classification.kind : null;
  if (module.origin === "derived") {
    lines.push(CAVEATS.patient.edited.en);
    markers.push(CAVEATS.patient.edited.short);
    if (kind === "derived-from-upload") {
      lines.push(CAVEATS.patient.uploaded.en);
      markers.push(CAVEATS.patient.uploaded.short);
    }
  } else {
    lines.push(CAVEATS.patient.uploaded.en);
    markers.push(CAVEATS.patient.uploaded.short);
  }
  return { lines, markers };
}

function projectLocale(entry) {
  const src = isObj(entry) && isObj(entry.data) ? entry.data : {};
  const stalePaths = arr(src.stale).filter(p => typeof p === "string");
  const steps = {};
  if (isObj(src.steps)) for (const k of Object.keys(src.steps)) if (isObj(src.steps[k])) steps[k] = pick(src.steps[k], STEP_WORDING_KEYS);
  return {
    reviewed: src.reviewed === true,
    editedLocally: src.editedLocally === true,
    stale: stalePaths.length > 0,
    stalePaths: stalePaths.slice(),
    data: {
      items: pickMap(src.items, ITEM_WORDING_KEYS),
      redFlags: pickMap(src.redFlags, FLAG_WORDING_KEYS),
      contextItems: pickMap(src.contextItems, CONTEXT_WORDING_KEYS),
      steps,
      ui: pick(src.ui, UI_WORDING_KEYS),
    },
    sum: isObj(entry) && entry.sum && typeof entry.sum === "object" ? entry.sum : null,
    fallbacks: arr(isObj(entry) ? entry.fallbacks : null).filter(p => typeof p === "string"),
  };
}

/**
 * The only object the Patient Companion receives (D15). Frozen, memoised per module.
 *
 * Carries: identity (id, name, label, instrumentVersion, origin), the PATIENT provenance set
 * (CAVEATS.patient.* lines and their short markers — never CAVEATS.scoringChanged or any
 * clinician line), availability, the item structure the summary needs (id, w, scale length,
 * which scale options are negative answers (f === 0, as booleans only), patientClin), the patient steps, context signal values, the gap rule, flag ids and tiers,
 * the patient wording per locale (whitelisted keys only) with its review state, the logic's
 * SUM templates and its patientSummary rules (or "generic").
 * Never carries: flag text/points/action, item clinician text (beyond patientClin, which falls
 * back to it), fhir, cds, research, routing, probes, lexicon, copy, hashes or classification.
 *
 * `available` is a boolean (§5.5 `!view.available`); `unavailableReason` names why not.
 *
 * @param {Object} module   a bound, frozen Module
 * @returns {Object} PatientView
 */
export function projectForPatient(module) {
  if (!module || typeof module !== "object") throw new TypeError("projectForPatient: a bound module is required");
  if (VIEW_CACHE.has(module)) return VIEW_CACHE.get(module);

  const domains = arr(module.domains).filter(isObj).map(d => ({
    key: d.key,
    negative: d.negative === true,
    items: arr(d.items).filter(isObj).map(it => ({
      id: it.id,
      w: it.w,
      scaleLen: Array.isArray(it.scale) ? it.scale.length : null,
      // V13 guarantees some option with f === 0 but not that it is option 0; the summary needs
      // to know which options say nothing, and only that (booleans, never f or points).
      scaleZero: Array.isArray(it.scale) ? it.scale.map(o => !!(o && typeof o === "object" && o.f === 0)) : null,
      patientClin: typeof it.patientClin === "string" ? it.patientClin : it.text,
    })),
  }));

  const labelOf = {};
  for (const d of arr(module.domains)) if (isObj(d) && typeof d.key === "string") labelOf[d.key] = d.label;
  const patientSteps = module.steps && Array.isArray(module.steps.patient) ? module.steps.patient : [];
  const steps = patientSteps.filter(isObj).map(st => {
    const out = { key: st.key, kind: st.kind, domainKeys: arr(st.domainKeys).slice() };
    if (Array.isArray(st.extras)) out.extras = st.extras.slice();
    // §3.5: without patient step wording, a domain step's title is its domain label.
    const labels = out.domainKeys.map(k => labelOf[k]).filter(l => typeof l === "string" && l);
    out.fallbackTitle = st.kind === "domain" && labels.length ? labels.join(" · ") : null;
    return out;
  });

  const contextItems = arr(module.contextItems).filter(isObj).map(ci => ({
    id: ci.id,
    signalValue: isObj(ci.signal) && typeof ci.signal.value === "string" ? ci.signal.value : null,
  }));

  const gr = isObj(module.gapRule) ? module.gapRule : null;
  const gapRule = gr ? { threshold: gr.threshold, markers: arr(gr.markers).slice() } : null;

  const redFlags = arr(module.redFlags).filter(isObj).map(f => ({ id: f.id, tier: f.tier }));

  const locales = {};
  const ml = isObj(module.locales) ? module.locales : {};
  for (const loc of Object.keys(ml)) locales[loc] = projectLocale(ml[loc]);

  const en = locales.en;
  const available = !!(en && Object.keys(en.data.items).length);

  const ps = module.logic && module.logic.patientSummary;
  const summaryLogic = !ps || ps.generic === true ? "generic" : ps;

  const prov = patientProvenance(module);

  const view = {
    id: module.id,
    name: module.name,
    label: module.label,
    instrumentVersion: module.instrumentVersion,
    origin: module.origin,
    provenanceLines: prov.lines,
    provenanceMarkers: prov.markers,
    available,
    unavailableReason: available ? null : "no patient wording",
    domains,
    steps,
    contextItems,
    gapRule,
    redFlags,
    locales,
    summaryLogic,
  };
  deepFreeze(view);
  VIEW_CACHE.set(module, view);
  return view;
}

// ---------------------------------------------------------------------------------------
// Locale access
// ---------------------------------------------------------------------------------------

function localeEntry(view, loc) {
  const L = view && isObj(view.locales) ? view.locales : {};
  return L[loc] || L.en || null;
}

function getPath(obj, path) {
  let v = obj;
  for (const k of String(path).split(".")) {
    if (!hasOwn(v, k)) return undefined;
    v = v[k];
  }
  return v;
}

function placeholderVars(view, extra) {
  return { name: view.name, id: view.id, instrument: view.instrumentVersion, ...(extra || {}) };
}

/**
 * Patient wording at `path` inside the locale data ("items.<id>.q", "steps.<key>.title",
 * "ui.clinicianLede" …): the locale's value, else English (the binder merged per leaf and
 * recorded each fallback in view.locales[loc].fallbacks); for "steps.<key>.title" the step's
 * domain label when neither has one (§3.5). {name}, {id} and {instrument} are rendered.
 * @returns {string|string[]|null} null when no locale has the path
 */
export function localeText(view, loc, path) {
  const own = localeEntry(view, loc);
  const en = view && view.locales ? view.locales.en : null;
  let v = own ? getPath(own.data, path) : undefined;
  if (v === undefined && en) v = getPath(en.data, path);
  if (v === undefined) {
    const m = /^steps\.([^.]+)\.title$/.exec(String(path));
    if (m) {
      const st = arr(view && view.steps).find(s => s.key === m[1]);
      if (st && st.fallbackTitle) v = st.fallbackTitle;
    }
  }
  if (v === undefined || v === null) return null;
  if (typeof v === "string" || Array.isArray(v)) return renderTpl(v, null, placeholderVars(view));
  return null;
}

/**
 * True when the wording at `path` in locale `loc` is the English text standing in for a
 * missing translation (the binder's fallback record), or when the locale is absent and
 * English is used. A component marks such text lang="en".
 * @returns {boolean}
 */
export function localeFallback(view, loc, path) {
  if (loc === "en") return false;
  const own = view && view.locales ? view.locales[loc] : null;
  if (!own) return true;
  const ptr = `/locales/${loc}/` + String(path).split(".").map(k => k.replace(/~/g, "~0").replace(/\//g, "~1")).join("/");
  return arr(own.fallbacks).some(f => f === ptr || f.startsWith(ptr + "/"));
}

/**
 * The patient copy of every red flag, in module order: {id, tier, q, say}. Nothing else —
 * the clinician text, points and action are not in the view at all.
 * @returns {Array<{id:string, tier:string, q:string, say:string}>}
 */
export function flagCopy(view, loc) {
  const own = localeEntry(view, loc);
  const en = view && view.locales ? view.locales.en : null;
  return arr(view && view.redFlags).map(f => {
    const p = (own && own.data.redFlags[f.id]) || {};
    const e = (en && en.data.redFlags[f.id]) || {};
    return {
      id: f.id,
      tier: f.tier,
      q: p.q !== undefined ? p.q : e.q,
      say: p.say !== undefined ? p.say : e.say,
    };
  });
}

function itemWording(view, loc, id) {
  const own = localeEntry(view, loc);
  const en = view && view.locales ? view.locales.en : null;
  const p = own && own.data.items[id];
  const e = en && en.data.items[id];
  if (!p && !e) return null;
  return { ...(e || {}), ...(p || {}) };
}

/**
 * Join a list in the locale's grammar (Pat L988-994): "a and b"; "a, b, and c" (en, Oxford
 * comma); "a, b y c" (es).
 * @param {string} loc
 * @param {string[]} xs
 * @returns {string}
 */
export function joinList(loc, xs) {
  const list = Array.from(xs || []);
  const g = GRAMMAR[loc] || GRAMMAR.en;
  const and = g.and;
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} ${and} ${list[1]}`;
  const tail = g.oxford ? `, ${and} ` : ` ${and} `;
  return `${list.slice(0, -1).join(", ")}${tail}${list[list.length - 1]}`;
}

/**
 * The question form of an item for the "not sure" list (Pat L981-986): the item's own
 * patient `ask` when it has one; otherwise the locale transform — en: "I've " → "Have I ",
 * "I " → "Do I ", final "." → "?"; es: only the final "." → "?" (ask forms are supplied).
 * @returns {string}
 */
export function askForm(view, loc, id) {
  const p = itemWording(view, loc, id);
  if (!p || typeof p.q !== "string") return p && typeof p.ask === "string" ? p.ask : String(id);
  if (p.ask) return p.ask;
  const g = GRAMMAR[loc] || GRAMMAR.en;
  if (g.ask === "period-to-question") return p.q.replace(/\.$/, "?");
  return p.q.replace(/^I've /, "Have I ").replace(/^I /, "Do I ").replace(/\.$/, "?");
}

// ---------------------------------------------------------------------------------------
// Summary (Pat L902-975)
// ---------------------------------------------------------------------------------------

function isUrgentTier(tier) {
  const d = TIER_DISPLAY[tier];
  return d ? d.key === "now" : tier === TIERS[0];
}

function normaliseFlags(view, loc, flags) {
  if (Array.isArray(flags)) return flags.filter(isObj).map(f => ({ ...f }));
  if (isObj(flags)) {
    // A {flagId: true} map, as the Safety section keeps it.
    return flagCopy(view, loc).filter(f => flags[f.id]);
  }
  return [];
}

/**
 * Whether scale answer `v` picks a negative option (f === 0; V13: at least one, at any
 * position): true / false, or null when no option stands behind `v`.
 */
function scaleNegative(it, v) {
  const z = typeof v === "number" && Array.isArray(it.scaleZero) ? it.scaleZero[v] : undefined;
  return typeof z === "boolean" ? z : null;
}

function allItems(view) {
  const out = [];
  for (const d of arr(view.domains)) for (const it of arr(d.items)) out.push(it);
  return out;
}

/**
 * Generic said list (§3.5): "yes" → the item's own q; a scale answer that scores (f > 0) →
 * `${q} — ${opts[v]}`. A value with no option behind it keeps the plain `v > 0` reading.
 * This is the rule's only implementation (generic.js GENERIC_SUMMARY documents it).
 */
function genericSaid(view, loc, a) {
  const out = [];
  for (const it of allItems(view)) {
    const p = itemWording(view, loc, it.id);
    if (!p || typeof p.q !== "string") continue;
    const v = a[it.id];
    if (it.scaleLen !== null) {
      const neg = scaleNegative(it, v);
      if (typeof v === "number" && (neg === null ? v > 0 : !neg)) {
        const opt = Array.isArray(p.opts) ? p.opts[v] : undefined;
        out.push(opt !== undefined ? `${p.q} — ${opt}` : p.q);
      }
    } else if (v === ANSWER.YES) {
      out.push(p.q);
    }
  }
  return out;
}

function runRules(rules, state, list) {
  const { fired, error } = evaluateRules(arr(rules), state, { mode: "all" });
  if (error) return { texts: null, error: { family: "patient", ruleId: `${list}:${error.ruleId}`, message: error.message } };
  const texts = [];
  for (const rule of fired) {
    try {
      if (typeof rule.text !== "function") throw new Error("summary rule has no text function");
      const t = rule.text(state);
      if (typeof t !== "string") throw new Error("summary text is not a string");
      texts.push(t);
    } catch (err) {
      return { texts: null, error: patientError(`${list}:${rule.id}.text`, err) };
    }
  }
  return { texts, error: null };
}

/**
 * Build the patient summary.
 *
 * said/ask come from the logic's patientSummary rules evaluated over a frozen PatientState
 * ({a, ctx, loc, S, yes, scale, unsure, L, groups, ...derived}) — or, for a data-only module,
 * from the generic rule (the module's own wording, verbatim; no ask, no gap line). The gap
 * line is S.gap(...) with the marker booleans in gapRule.markers order once at least
 * `threshold` markers carry their signal value. unsureList is every item answered "unsure",
 * in module order; clin is every endorsed item (patientClin plus the scale option in
 * brackets), ordered by |w|. Any throw withholds the summary: {summary: null, error}.
 *
 * @param {Object} view   projectForPatient(module)
 * @param {string} loc
 * @param {{a?:Object, ctx?:Object, flags?:(Array|Object), urgent?:boolean}} input
 * @returns {{summary: (Object|null), error: (null|{family:string, ruleId:string, message:string})}}
 */
export function buildPatientSummary(view, loc, { a = {}, ctx = {}, flags = [], urgent } = {}) {
  const answers = isObj(a) ? { ...a } : {};
  const context = isObj(ctx) ? { ...ctx } : {};
  const flagList = normaliseFlags(view, loc, flags);
  const isUrgent = typeof urgent === "boolean" ? urgent : flagList.some(f => isUrgentTier(f.tier));
  const entry = localeEntry(view, loc);
  const S = entry ? entry.sum : null;
  const generic = view.summaryLogic === "generic";

  let said, ask, gapLine = null, clinNote = null;
  try {
    if (generic) {
      said = genericSaid(view, loc, answers);
      ask = [];
    } else {
      const ps = view.summaryLogic;
      const yes = id => answers[id] === ANSWER.YES;
      const scale = id => (typeof answers[id] === "number" ? answers[id] : null);
      const unsure = id => answers[id] === ANSWER.UNSURE;
      const L = xs => joinList(loc, xs);
      const groups = {};
      const g = isObj(ps.groups) ? ps.groups : {};
      for (const name of Object.keys(g)) groups[name] = arr(g[name]).filter(yes);
      const base = {
        a: deepFreeze({ ...answers }), ctx: deepFreeze({ ...context }), loc, S,
        yes, scale, unsure, L, groups: deepFreeze(groups),
      };
      const derivedFns = isObj(ps.derived) ? ps.derived : {};
      for (const name of Object.keys(derivedFns)) {
        const fn = derivedFns[name];
        if (typeof fn !== "function") continue;
        try {
          base[name] = fn(Object.freeze({ ...base }));
        } catch (err) {
          return { summary: null, error: patientError(`derived:${name}`, err) };
        }
      }
      const state = Object.freeze({ ...base });
      const s1 = runRules(ps.said, state, "said");
      if (s1.error) return { summary: null, error: s1.error };
      const s2 = runRules(ps.ask, state, "ask");
      if (s2.error) return { summary: null, error: s2.error };
      said = s1.texts;
      ask = s2.texts;

      const markers = view.gapRule ? arr(view.gapRule.markers) : [];
      if (markers.length) {
        const signal = {};
        for (const ci of arr(view.contextItems)) signal[ci.id] = ci.signalValue;
        const bools = markers.map(id => signal[id] !== null && signal[id] !== undefined && context[id] === signal[id]);
        const count = bools.filter(Boolean).length;
        if (count >= view.gapRule.threshold) {
          try {
            if (!S || typeof S.gap !== "function") throw new Error("sum.gap is not a template function");
            gapLine = S.gap(...bools);
            if (typeof gapLine !== "string") throw new Error("sum.gap did not return a string");
          } catch (err) {
            return { summary: null, error: patientError("sum.gap", err) };
          }
        }
      }
    }

    if (S && typeof S.clinNote === "function") {
      try {
        clinNote = S.clinNote(view.instrumentVersion);
        if (typeof clinNote !== "string") throw new Error("sum.clinNote did not return a string");
      } catch (err) {
        return { summary: null, error: patientError("sum.clinNote", err) };
      }
    }
  } catch (err) {
    return { summary: null, error: patientError("summary", err) };
  }

  const items = allItems(view);
  const unsureList = items.filter(it => answers[it.id] === ANSWER.UNSURE).map(it => it.id);

  const clin = [];
  for (const it of items) {
    const v = answers[it.id];
    if (v === undefined || v === ANSWER.UNSURE || v === ANSWER.NO) continue;
    if (it.scaleLen !== null) {
      // An f === 0 option is a negative answer, wherever it sits in the scale (V13).
      const neg = scaleNegative(it, v);
      if (neg === null ? v === 0 : neg) continue;
    }
    let detail = "";
    if (it.scaleLen !== null) {
      const p = itemWording(view, loc, it.id);
      const opt = p && Array.isArray(p.opts) ? p.opts[v] : undefined;
      detail = ` [${opt !== undefined ? opt : v}]`;
    }
    clin.push({ w: Math.abs(it.w), neg: it.w < 0, t: it.patientClin + detail });
  }
  clin.sort((x, y) => y.w - x.w);

  const summary = { said, ask, gapLine, unsureList, clin, flags: flagList, urgent: isUrgent, ctx: context, loc, clinNote };
  return { summary: deepFreeze(summary), error: null };
}

// ---------------------------------------------------------------------------------------
// Exports: .txt and .html (§5.5, AD10)
// ---------------------------------------------------------------------------------------

/** Lines that close every export of a module/locale: patient provenance, edited wording, stale translation. */
function patientNotices(view, loc) {
  const out = arr(view.provenanceLines).slice();
  const e = localeEntry(view, loc);
  if (e && e.editedLocally) out.push(CAVEATS.editedWording.en);
  if (e && e.stale) out.push(CAVEATS.staleTranslation.en);
  return out;
}

function unreviewedCaveat(view, loc) {
  const e = localeEntry(view, loc);
  if (!e || e.reviewed) return null;
  return CAVEATS.unreviewed && CAVEATS.unreviewed[loc] ? CAVEATS.unreviewed[loc] : null;
}

/**
 * The plain-text summary (Pat L1096-1125 verbatim; footer `${name} v${appVersion} — ${txtFooter}`),
 * then (AD10) the patient provenance, edited-wording and stale-translation lines where they
 * apply, and last the dated caveat line `Prototype · not for clinical use · YYYY-MM-DD`.
 * @param {Object} view
 * @param {string} loc
 * @param {Object} summary   buildPatientSummary(...).summary
 * @param {{appVersion?:string, generatedAt?:(Date|string|number)}} [opts]
 * @returns {string}
 */
export function summaryText(view, loc, summary, { appVersion = APP_VERSION, generatedAt } = {}) {
  if (!summary || typeof summary !== "object") throw new TypeError("summaryText: a summary is required");
  const { said, ask, gapLine, unsureList, clin, flags, urgent } = summary;
  const t = chromeFor(loc);
  const up = x => String(x).toUpperCase();
  const L = [];
  L.push(up(t.summaryTitle), "=".repeat(40), "");
  const unrev = unreviewedCaveat(view, loc);
  if (unrev && unrev.txt) L.push(unrev.txt, "");
  if (arr(flags).length) {
    L.push(urgent ? t.txtSeenToday : t.txtSeenWeek, urgent ? t.tierNowWhat : t.tierSoonWhat, "");
    flags.forEach(f => L.push(`  ${t.txtSay}: "${f.say}"`));
    L.push("");
  }
  if (gapLine) L.push(up(t.openWith), `  "${gapLine}"`, "");
  if (arr(said).length) { L.push(up(t.describe)); said.forEach(x => L.push("  - " + x)); L.push(""); }
  if (arr(ask).length) { L.push(up(t.askAbout)); ask.forEach(x => L.push("  - " + x)); L.push(""); }
  if (arr(unsureList).length) {
    L.push(up(t.notSure));
    unsureList.forEach(id => L.push("  - " + askForm(view, loc, id)));
    L.push("");
  }
  if (arr(clin).length) {
    // The clinician block stays in clinical English regardless of locale (Pat L1112-1114).
    const note = typeof summary.clinNote === "string" ? summary.clinNote : null;
    L.push(up(t.forClinician));
    if (note !== null) L.push("  " + note);
    L.push("  " + t.txtClinNote);
    clin.forEach(c => L.push("  " + (c.neg ? "- " : "+ ") + c.t));
    L.push("");
  }
  L.push("-".repeat(40), `${view.name} v${appVersion} — ${t.txtFooter}`);
  for (const line of patientNotices(view, loc)) L.push(line);
  L.push(`${CAVEATS.prototype} · ${isoDate(generatedAt)}`);
  return L.join("\n");
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]); }

/**
 * "**x**" → {b:"x"}; nothing else is markup (§3.6 rule 4). An unpaired "**" stays literal.
 * @param {string} str
 * @returns {Array<string|{b:string}>}
 */
export function richText(str) {
  if (typeof str !== "string" || !str) return [];
  const out = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) out.push(str.slice(last, m.index));
    out.push({ b: m[1] });
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

function richHtml(str) {
  return richText(str).map(part => (typeof part === "string" ? esc(part) : `<b>${esc(part.b)}</b>`)).join("");
}

// A subset of the on-screen summary styles (Pat L559-628), plus the repeating caveat header.
const EXPORT_CSS = `:root{--ink:#12302F;--muted:#5E7573;--line:#DCE5E3;--petrol:#1C6B63;--coral:#C4553A;--coralbg:#FBEDE9;--amber:#B26C1F;--amberbg:#FBF2E2;--mono:ui-monospace,"SF Mono",Menlo,monospace}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.55;padding:16px}
table.frame{width:100%;max-width:680px;margin:0 auto;border-collapse:collapse}
table.frame thead{display:table-header-group}
table.frame th{font-family:var(--mono);font-size:11.5px;font-weight:600;letter-spacing:.03em;text-align:left;color:var(--muted);padding:0 0 8px;border-bottom:1px solid var(--line)}
table.frame td{padding:12px 0 0;vertical-align:top}
h1{font-size:22px;line-height:1.25;letter-spacing:-.01em;margin:6px 0 8px}
h3{font-size:16px;margin-bottom:7px}
.sum{border-left:4px solid var(--petrol);background:#F3F8F7;border-radius:0 13px 13px 0;padding:15px 17px;margin-top:13px}
.sum li{font-size:15.5px;margin:7px 0 0 19px;line-height:1.45}
.sum p{font-size:15.5px}
.ask{border-left-color:var(--amber);background:var(--amberbg)}
.unsure{background:#fff;border:1px solid var(--line);border-left:4px solid var(--amber)}
.clin{border-left-color:#5E7573;background:#F4F6F6}
.clin li{font-family:var(--mono);font-size:13px;margin-top:5px}
.notice{font-size:14px;color:var(--ink);margin-top:6px}
.call{border-radius:14px;padding:17px 18px;margin-top:16px}
.call .ct{font-size:17px;font-weight:700;margin-bottom:6px}
.call p{font-size:15.5px}
.say{background:#fff;border-radius:11px;padding:13px 15px;margin-top:11px;font-size:16px;line-height:1.45}
.say .sl{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px}
.say q{font-style:normal;font-weight:560}
.disc{border:1px dashed var(--line);border-radius:12px;padding:14px 16px;margin-top:16px;font-size:14px;color:var(--muted)}
.foot{font-family:var(--mono);font-size:11.5px;color:var(--muted);text-align:center;margin-top:28px;letter-spacing:.03em}
@page{margin:16mm}
@media print{body{padding:0;font-size:12pt}.sum,.call{break-inside:avoid}}
`;

/**
 * The self-contained HTML summary (§5.5): no scripts, no URLs, no fonts. One table whose
 * <thead> holds the caveat header, so a browser printing the saved file repeats it on every
 * page; in the body the unreviewed banner, the patient notices, the summary sections in
 * on-screen order, the disclaimer and a dated footer. Every text is HTML-escaped.
 * @param {Object} view
 * @param {string} loc
 * @param {Object} summary
 * @param {{appVersion?:string, generatedAt?:(Date|string|number)}} [opts]
 * @returns {string}
 */
export function summaryHtml(view, loc, summary, { appVersion = APP_VERSION, generatedAt } = {}) {
  if (!summary || typeof summary !== "object") throw new TypeError("summaryHtml: a summary is required");
  const { said, ask, gapLine, unsureList, clin, flags, urgent } = summary;
  const t = chromeFor(loc);
  const fb = new Set(t.fallbackKeys || []);
  const docLang = typeof loc === "string" && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(loc) ? loc : "en";
  const isEn = docLang === "en";
  // English text inside a non-English document is marked lang="en".
  const en = html => (isEn ? html : `<span lang="en">${html}</span>`);
  const chrome = key => (fb.has(key) ? en(esc(t[key])) : esc(t[key]));
  const date = isoDate(generatedAt);
  const unrev = unreviewedCaveat(view, loc);
  const notices = patientNotices(view, loc);
  const markers = arr(view.provenanceMarkers);
  const flagList = arr(flags);
  const thin = arr(said).length === 0 && arr(clin).length === 0 && flagList.length === 0;

  const header = [en(esc(CAVEATS.prototype))];
  if (unrev && unrev.title) header.push(`<span lang="${esc(docLang)}">${esc(unrev.title)}</span>`);
  for (const m of markers) header.push(en(esc(m)));

  const body = [];
  if (unrev) {
    body.push(`<div class="sum ask" lang="${esc(docLang)}"><h3>${esc("⚠︎ " + (unrev.title || ""))}</h3><p>${esc(unrev.body || "")}</p></div>`);
  }
  for (const line of notices) body.push(`<p class="notice" lang="en">${esc(line)}</p>`);
  body.push(`<h1>${esc(t.summaryTitle)}</h1>`);

  if (thin) {
    body.push(`<div class="sum ask"><h3>${chrome("thinTitle")}</h3><p>${chrome("thin")}</p></div>`);
  }
  if (flagList.length) {
    const tier = TIER_DISPLAY[urgent ? "emergent" : "urgent"];
    const say = flagList.map(f => `<div class="say"><span class="sl">${chrome("sayThis")}</span><q>${esc(f.say)}</q></div>`).join("");
    body.push(`<div class="call" style="background:${esc(tier.bg)}"><div class="ct" style="color:${esc(tier.color)}">${chrome(urgent ? "seenToday" : "seenWeek")}</div><p>${chrome(urgent ? "tierNowWhat" : "tierSoonWhat")}</p>${say}</div>`);
  }
  if (gapLine) {
    body.push(`<div class="sum ask"><h3>${chrome("openWith")}</h3><p><q>${esc(gapLine)}</q></p></div>`);
  }
  if (arr(said).length) {
    body.push(`<div class="sum"><h3>${chrome("describe")}</h3><ul>${said.map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>`);
  }
  if (arr(ask).length) {
    body.push(`<div class="sum ask"><h3>${chrome("askAbout")}</h3><ul>${ask.map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>`);
  }
  if (arr(unsureList).length) {
    body.push(`<div class="sum unsure"><h3>${chrome("notSure")}</h3><p>${chrome("notSureLede")}</p><ul>${unsureList.map(id => `<li>${esc(askForm(view, loc, id))}</li>`).join("")}</ul></div>`);
  }
  if (arr(clin).length) {
    const lede = localeText(view, loc, "ui.clinicianLede");
    const ledeIsEn = !isEn && localeFallback(view, loc, "ui.clinicianLede");
    const ledeHtml = typeof lede === "string" && lede ? `<p${ledeIsEn ? ' lang="en"' : ""}>${richHtml(lede)}</p>` : "";
    // The clinician lines are clinical English in every locale (Pat L1112-1114).
    body.push(`<div class="sum clin"><h3>${chrome("forClinician")}</h3>${ledeHtml}<ul${isEn ? "" : ' lang="en"'}>${clin.map(c => `<li>${esc((c.neg ? "− " : "+ ") + c.t)}</li>`).join("")}</ul></div>`);
  }
  body.push(`<div class="disc">${chrome("disclaimer")}</div>`);
  body.push(`<p class="foot">${esc(`${view.name} v${appVersion} — `)}${chrome("txtFooter")} · ${en(esc(CAVEATS.prototype))} · ${esc(date)}</p>`);

  return [
    "<!doctype html>",
    `<html lang="${esc(docLang)}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    `<title>${esc(t.summaryTitle)}</title>`,
    `<style>\n${EXPORT_CSS}</style>`,
    "</head>",
    "<body>",
    '<table class="frame">',
    `<thead><tr><th>${header.join(" · ")}</th></tr></thead>`,
    "<tbody><tr><td>",
    ...body,
    "</td></tr></tbody>",
    "</table>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
