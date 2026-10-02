// apps/PatientCompanion.jsx — the generic Patient Companion, with print and download
// (design 03 §5.5, §5.10, §7.3, AD10). Owner: WP9.
//
// The baseline Patient component (Pat L644-1094) driven by a patient projection instead of
// module constants. Its DOM structure, class names and `.mp` stylesheet are the baseline's
// (the stylesheet is already scoped under `.mp`, so it moves unedited, §5.10). Every clinical
// and patient-facing word comes from the projection (`view`) or from the engine's patient
// chrome (PATIENT_CHROME, CAVEATS); nothing here names a module.
//
// Input is only `view = projectForPatient(module)` (D15). This file and everything it
// imports cannot reach a score, band, probability, clinician flag text, points, action, FHIR
// or research: the import graph is patient.js (evaluate.js, vocab.js, policy.js), gates.js
// and download.js only (the `omissions` graph test). There is no capture and no persistence
// (D20); "Not sure" stays unanswered.
//
// What changed from the baseline, and nothing else:
//   - the unreviewed banner is printed (its `noprint` class is gone) and carries the
//     edited-wording and stale-translation notices where they apply (AD10, §5.5);
//   - a non-built-in module shows the patient provenance lines under the banner (§3.11);
//   - es shows the existing Spanish thin and not-sure ledes (AD10);
//   - the summary offers Download (.txt) and Download (.html); both are dated and caveated,
//     and Print and both downloads are disabled when the summary rules fail (§5.5);
//   - the locale's review state is reported to the host for the print header (onPrintContext);
//   - the release is the host's (AD4).
//
// No side effects at import time.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Printer, Download, TriangleAlert, ShieldCheck,
  HelpCircle, MessageSquareQuote, Stethoscope, Info, RotateCcw, ClipboardList,
} from "lucide-react";
import {
  TIER_DISPLAY, chromeFor, localeText, localeFallback, flagCopy, buildPatientSummary,
  askForm, summaryText, summaryHtml, richText,
} from "../engine/patient.js";
import { ANSWER } from "../engine/vocab.js";
import { safetyGate } from "../engine/gates.js";
import { downloadText } from "../engine/download.js";
import { APP_VERSION, CAVEATS, LOCALE_NAMES } from "../engine/policy.js";

// ----------------------------------------------------------------------------- styles

// Pat L546-640, moved unedited (already scoped under .mp), then the few rules this
// component adds for its new chrome (provenance notices, the rule-error card).
const PATIENT_CSS = `
.mp *{box-sizing:border-box;margin:0;padding:0}
.mp{--ink:#12302F;--muted:#5E7573;--line:#DCE5E3;--panel:#fff;--bg:#F5F8F7;
  --petrol:#1C6B63;--petrol2:#2A8A80;--coral:#C4553A;--coralbg:#FBEDE9;
  --amber:#B26C1F;--amberbg:#FBF2E2;--green:#2F7D53;--greenbg:#E8F4EC;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  background:var(--bg);color:var(--ink);min-height:100%;padding:20px 16px 64px;
  font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased}
.mp .wrap{max-width:640px;margin:0 auto}

.mp .top{display:flex;align-items:center;gap:11px;margin-bottom:6px}
.mp .logo{width:36px;height:36px;border-radius:10px;background:var(--petrol);color:#fff;
  display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.mp .tt{font-size:19px;font-weight:700;letter-spacing:-.01em}
.mp .ts{font-size:13.5px;color:var(--muted)}

.mp .prog{height:5px;border-radius:3px;background:var(--line);margin:16px 0 18px;overflow:hidden}
.mp .prog i{display:block;height:100%;background:var(--petrol);transition:width .35s ease}
.mp .stepof{font-family:var(--mono);font-size:12px;color:var(--muted);letter-spacing:.04em;margin-bottom:6px}

.mp .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px}
.mp .card + .card{margin-top:14px}
.mp h2{font-size:23px;line-height:1.25;letter-spacing:-.01em;margin-bottom:8px}
.mp h3{font-size:17px;margin-bottom:6px}
.mp .lede{font-size:16px;color:#38504F;margin-bottom:4px}

.mp .q{padding:20px 0;border-top:1px solid var(--line)}
.mp .q:first-of-type{border-top:0;padding-top:4px}
.mp .qt{font-size:17px;line-height:1.45;margin-bottom:13px}
.mp .qh{font-size:14px;color:var(--muted);margin:-8px 0 12px}
.mp .opts{display:flex;gap:9px;flex-wrap:wrap}
.mp .o{font:inherit;font-size:16px;cursor:pointer;border:1.5px solid var(--line);background:#fff;color:var(--ink);
  border-radius:12px;padding:13px 20px;min-height:50px;min-width:88px;text-align:center;transition:.12s;flex:0 1 auto}
.mp .o:hover{border-color:var(--petrol2)}
.mp .o.sel{background:var(--petrol);border-color:var(--petrol);color:#fff;font-weight:640}
.mp .o.no.sel{background:#5E7573;border-color:#5E7573}
.mp .o.unsure.sel{background:#fff;border-color:var(--amber);color:var(--amber);font-weight:640;
  box-shadow:inset 0 0 0 1px var(--amber)}
.mp .o.wide{flex:1 1 100%;text-align:left}

.mp .flag{display:flex;gap:13px;align-items:flex-start;border:1.5px solid var(--line);background:#fff;
  border-radius:13px;padding:15px 16px;margin-top:10px;cursor:pointer;transition:.12s}
.mp .flag:hover{border-color:#C98476}
.mp .flag.on{border-color:var(--coral);background:#FDF5F2}
.mp .box{width:23px;height:23px;border-radius:6px;border:1.8px solid #B7C4C2;flex:0 0 auto;margin-top:1px;
  display:flex;align-items:center;justify-content:center;background:#fff}
.mp .flag.on .box{background:var(--coral);border-color:var(--coral);color:#fff}
.mp .flag .ft{font-size:16px;line-height:1.4}
.mp .tier{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;
  border-radius:6px;padding:3px 8px;margin-left:8px;white-space:nowrap;vertical-align:2px}

.mp .call{border-radius:14px;padding:17px 18px;margin-top:16px}
.mp .call .ct{font-size:17px;font-weight:700;display:flex;gap:9px;align-items:center;margin-bottom:6px}
.mp .call p{font-size:15.5px}
.mp .say{background:#fff;border-radius:11px;padding:13px 15px;margin-top:11px;font-size:16px;line-height:1.45}
.mp .say .sl{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--muted);display:block;margin-bottom:5px}
.mp .say q{font-style:normal;font-weight:560}

.mp .nav{display:flex;gap:11px;align-items:center;margin-top:20px}
.mp .btn{font:inherit;font-size:16.5px;font-weight:640;cursor:pointer;border-radius:12px;padding:14px 22px;
  min-height:52px;border:1.5px solid var(--petrol);background:var(--petrol);color:#fff;
  display:inline-flex;align-items:center;gap:9px;justify-content:center}
.mp .btn:hover{background:var(--petrol2);border-color:var(--petrol2)}
.mp .btn.ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.mp .btn.ghost:hover{border-color:var(--petrol2)}
.mp .btn:disabled{opacity:.45;cursor:not-allowed}

.mp .sum{border-left:4px solid var(--petrol);background:#F3F8F7;border-radius:0 13px 13px 0;
  padding:15px 17px;margin-top:13px}
.mp .sum h3{font-size:16px;margin-bottom:7px}
.mp .sum li{font-size:15.5px;margin:7px 0 0 19px;line-height:1.45}
.mp .sum p{font-size:15.5px}
.mp .ask{border-left-color:var(--amber);background:var(--amberbg)}
.mp .unsure{border-left-color:var(--amber);background:#fff;border:1px solid var(--line);border-left:4px solid var(--amber)}
.mp .clin{border-left-color:var(--slate,#5E7573);background:#F4F6F6}
.mp .clin li{font-family:var(--mono);font-size:13px;margin-top:5px}

.mp .disc{border:1px dashed var(--line);border-radius:12px;padding:14px 16px;margin-top:16px;
  font-size:14px;color:var(--muted);display:flex;gap:11px;align-items:flex-start}
.mp .foot{font-family:var(--mono);font-size:11.5px;color:var(--muted);text-align:center;margin-top:28px;letter-spacing:.03em}

@media print{
  .mp{background:#fff;padding:0;font-size:12pt}
  .mp .noprint{display:none!important}
  .mp .card{border:0;padding:0}
  .mp .sum{break-inside:avoid}
}
@media (max-width:520px){
  .mp .o{flex:1 1 100%}
  .mp h2{font-size:21px}
}
@media (prefers-reduced-motion:reduce){.mp *{transition:none!important}}

.mp .sum .notice{font-size:14px;margin-top:6px}
.mp .sum.prov{background:#fff;border:1px solid var(--line);border-left:4px solid var(--amber);margin-top:10px}
.mp .sum.prov p + p{margin-top:4px}
.mp .sum.err{border-left-color:var(--coral);background:var(--coralbg)}
.mp .nav.exports{flex-wrap:wrap}
@media print{
  .mp .sum.prov{break-inside:avoid}
}
`;

// ----------------------------------------------------------------------------- engine chrome

/** §3.5 notice for a module without patient wording (engine chrome, English only, §7.5). */
const UNAVAILABLE_NOTICE = "This module carries no patient wording, so the Patient Companion is not available for it.";

/** §5.5 rule-error card (engine chrome, English only, §7.5). */
const SUMMARY_ERROR = "This summary could not be prepared because the module's summary rules failed. Nothing is shown rather than an incomplete summary.";

/** The warning prefix of the unreviewed banner heading (Pat L685). */
const WARN = "⚠︎ ";

/** The Dirty summary the shell lists before a module switch (§5.1). */
const DIRTY_SUMMARY = "answers in progress";

// ----------------------------------------------------------------------------- helpers

const hasOwn = (o, k) => !!o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
const arr = (x) => (Array.isArray(x) ? x : []);

function localeEntry(view, loc) {
  const L = view && view.locales ? view.locales : {};
  return L[loc] || L.en || null;
}

/** Patient wording of one item / flag / context item, the locale over English (Pat L193). */
function wording(view, loc, family, id) {
  const en = view.locales && view.locales.en ? view.locales.en.data[family] : null;
  const own = localeEntry(view, loc);
  const o = own && own.data[family] ? own.data[family][id] : undefined;
  const e = en ? en[id] : undefined;
  if (!o && !e) return null;
  return { ...(e || {}), ...(o || {}) };
}

/** {name}, {appVersion} and {instrument} in an engine chrome template. */
function fill(tpl, vars) {
  return String(tpl).replace(/\{(name|appVersion|instrument)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

/** Tier display for a red flag's tier (Pat L263-272); an unknown tier reads as the slower one. */
function tierOf(tier) {
  return TIER_DISPLAY[tier] || TIER_DISPLAY.urgent;
}

/** The review state of a locale as the host's print header needs it (§5.10). */
export function printContextOf(view, loc) {
  const e = view && view.locales ? view.locales[loc] : null;
  return {
    loc,
    reviewed: !!(e && e.reviewed === true),
    editedLocally: !!(e && e.editedLocally === true),
    stale: !!(e && e.stale === true),
  };
}

/**
 * The repeating print-header text for a Patient view (§5.5 Print, §5.10): the prototype
 * caveat, plus the unreviewed-translation title when the locale is not reviewed and a caveat
 * exists for it (" · Traducción sin revisar" for es), plus the patient provenance marker of a
 * non-built-in module. Never a clinician marker.
 * @param {Object} view   projectForPatient(module)
 * @param {{loc: string, reviewed: boolean}} printContext   as reported by onPrintContext
 * @returns {string}
 */
export function patientPrintHeader(view, printContext) {
  const parts = [CAVEATS.prototype];
  const pc = printContext || { loc: "en", reviewed: true };
  const unrev = CAVEATS.unreviewed && CAVEATS.unreviewed[pc.loc];
  if (!pc.reviewed && unrev && unrev.title) parts.push(unrev.title);
  for (const m of arr(view && view.provenanceMarkers)) parts.push(m);
  return parts.join(" · ");
}

// ----------------------------------------------------------------------------- component

/**
 * The Patient Companion (§5.5). It serves the Patient tab, the shell's patient mode and the
 * standalone patient page; the surrounding chrome differs, not the component.
 *
 * @param {{view: Object, appVersion?: string,
 *          onDirty?: function(string, (string|null)): void,
 *          onModuleError?: function({family: string, ruleId: string, message: string}): void,
 *          onPrintContext?: function({loc: string, reviewed: boolean, editedLocally: boolean, stale: boolean}): void}} props
 */
export default function PatientCompanion({ view, appVersion = APP_VERSION, onDirty, onModuleError, onPrintContext }) {
  const [sec, setSec] = useState(0);
  const [a, setA] = useState({});        // item id -> value | "unsure"
  const [ctx, setCtx] = useState({});
  const [rf, setRf] = useState({});
  const [safetyDone, setSafetyDone] = useState(false);
  const [loc, setLoc] = useState(() => (view && view.locales && view.locales.en ? "en" : Object.keys((view && view.locales) || {})[0] || "en"));

  const host = useRef({});
  host.current = { onDirty, onModuleError, onPrintContext };

  const t = chromeFor(loc);
  const fbLang = (key) => (loc !== "en" && arr(t.fallbackKeys).includes(key) ? "en" : undefined);
  const txLang = (path) => (loc !== "en" && localeFallback(view, loc, path) ? "en" : undefined);
  const available = !!(view && view.available);
  const entry = available ? localeEntry(view, loc) : null;

  const sections = useMemo(() => {
    const steps = available ? arr(view.steps) : [];
    return [{ key: "intro", kind: "intro" }, { key: "safety", kind: "safety" }, ...steps, { key: "summary", kind: "summary" }];
  }, [view, available]);
  const LAST = sections.length - 1;
  const current = sections[Math.min(sec, LAST)];

  const sectionTitle = (s) => {
    if (s.kind === "intro" || s.kind === "safety" || s.kind === "summary") return t.sections[s.key];
    return localeText(view, loc, `steps.${s.key}.title`) || s.key;
  };

  const allFlags = available ? flagCopy(view, loc) : [];
  const flags = allFlags.filter((f) => rf[f.id]);
  const urgent = flags.some((f) => tierOf(f.tier).key === "now");
  const canGo = current.kind === "safety" ? safetyGate({ safetyReviewed: safetyDone, activeFlags: flags }) : true;

  const set = (id, v) => setA((p) => ({ ...p, [id]: p[id] === v ? undefined : v }));

  function reset() {
    setA({}); setCtx({}); setRf({}); setSafetyDone(false); setSec(0);
  }

  const built = useMemo(
    () => (available ? buildPatientSummary(view, loc, { a, ctx, flags: rf }) : { summary: null, error: null }),
    [view, available, loc, a, ctx, rf],
  );

  // Host reports ---------------------------------------------------------------------------
  const printKey = available ? JSON.stringify(printContextOf(view, loc)) : JSON.stringify(printContextOf(null, loc));
  useEffect(() => {
    const cb = host.current.onPrintContext;
    if (typeof cb === "function") cb(JSON.parse(printKey));
  }, [printKey]);

  const dirty = safetyDone || Object.values(a).some((v) => v !== undefined) || Object.values(ctx).some((v) => v !== undefined)
    || Object.values(rf).some(Boolean) ? DIRTY_SUMMARY : null;
  useEffect(() => {
    const cb = host.current.onDirty;
    if (typeof cb === "function") cb("patient", dirty);
  }, [dirty]);

  const errKey = built.error ? `${built.error.family}|${built.error.ruleId}|${built.error.message}` : null;
  const reported = useRef(null);
  useEffect(() => {
    if (!errKey || errKey === reported.current) return;
    reported.current = errKey;
    const cb = host.current.onModuleError;
    if (typeof cb === "function") cb(built.error);
  }, [errKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render ---------------------------------------------------------------------------------
  const sub = available ? localeText(view, loc, "ui.sub") : null;
  const localeKeys = available ? Object.keys(view.locales) : [];

  return (
    <div className="sa-app sa-patient" data-testid="patient-app">
      <style>{PATIENT_CSS}</style>
      <div className="mp" lang={loc}>
        <div className="wrap">
          <div className="top noprint" data-testid="patient-header">
            <div className="logo"><Stethoscope size={19} /></div>
            <div style={{ flex: 1 }}>
              <div className="tt" lang={fbLang("title")}>{t.title}</div>
              {sub ? <div className="ts" lang={txLang("ui.sub")}>{sub}</div> : null}
            </div>
            {localeKeys.length > 0 && (
              <div className="opts" style={{ flex: "0 0 auto" }}>
                {localeKeys.map((k) => (
                  <button key={k} className={"o" + (loc === k ? " sel" : "")} style={{ minWidth: 0, minHeight: 38, padding: "7px 13px", fontSize: 14 }}
                    onClick={() => setLoc(k)} lang={k} aria-pressed={loc === k} data-testid={`patient-locale-${k}`}>{LOCALE_NAMES[k] || k}</button>
                ))}
              </div>
            )}
          </div>

          {!available ? (
            <div className="card" data-testid="patient-unavailable" lang="en">
              <p className="lede">{UNAVAILABLE_NOTICE}</p>
            </div>
          ) : (
            <>
              <Banner entry={entry} loc={loc} />
              <Provenance lines={view.provenanceLines} />

              {sec > 0 && (
                <div className="noprint" data-testid="patient-progress">
                  <div className="stepof">{t.step} {sec} {t.of} {LAST} · {String(sectionTitle(current)).toUpperCase()}</div>
                  <div className="prog"><i style={{ width: `${(sec / LAST) * 100}%` }} /></div>
                </div>
              )}

              {current.kind === "intro" && <Intro view={view} t={t} loc={loc} fbLang={fbLang} txLang={txLang} />}

              {current.kind === "safety" && (
                <Safety allFlags={allFlags} flags={flags} rf={rf} setRf={setRf} safetyDone={safetyDone}
                  setSafetyDone={setSafetyDone} urgent={urgent} t={t} fbLang={fbLang} />
              )}

              {current.kind !== "intro" && current.kind !== "safety" && current.kind !== "summary" && (
                <StepCard view={view} step={current} title={sectionTitle(current)} a={a} set={set} ctx={ctx} setCtx={setCtx}
                  t={t} loc={loc} txLang={txLang} />
              )}

              {current.kind === "summary" && (
                <Summary view={view} built={built} onReset={reset} t={t} loc={loc} appVersion={appVersion}
                  fbLang={fbLang} txLang={txLang} />
              )}

              {sec < LAST && (
                <div className="nav noprint" data-testid="patient-nav">
                  {sec > 0 && (
                    <button className="btn ghost" onClick={() => setSec((s) => s - 1)} data-testid="patient-back">
                      <ArrowLeft size={17} /> {t.back}
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button className="btn" disabled={!canGo} onClick={() => setSec((s) => Math.min(s + 1, LAST))} data-testid="patient-next">
                    {sec === 0 ? t.start : sec === LAST - 1 ? t.seeSummary : t.next} <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </>
          )}

          <div className="foot noprint" data-testid="patient-footer" lang={fbLang("footer")}>
            {fill(t.footer, { name: view && view.name, appVersion, instrument: view && view.instrumentVersion })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------- banner & provenance

/**
 * The unreviewed banner (Pat L683-688), printed (AD10): the locale's CAVEATS.unreviewed title
 * and body when it has one, plus the edited-wording and stale-translation notices (English,
 * lang="en"). Nothing when the locale is reviewed.
 */
function Banner({ entry, loc }) {
  if (!entry || entry.reviewed) return null;
  const unrev = CAVEATS.unreviewed && CAVEATS.unreviewed[loc] ? CAVEATS.unreviewed[loc] : null;
  const notices = [];
  if (entry.editedLocally) notices.push(CAVEATS.editedWording.en);
  if (entry.stale) notices.push(CAVEATS.staleTranslation.en);
  if (!unrev && !notices.length) return null;
  return (
    <div className="sum ask" style={{ marginTop: 10 }} lang={loc} data-testid="patient-banner">
      {unrev ? <h3>{WARN}{unrev.title}</h3> : null}
      {unrev ? <p>{unrev.body}</p> : null}
      {notices.map((n, i) => <p className="notice" lang="en" key={i}>{n}</p>)}
    </div>
  );
}

/** The patient provenance lines of a non-built-in module (§3.11), printed. */
function Provenance({ lines }) {
  const xs = arr(lines);
  if (!xs.length) return null;
  return (
    <div className="sum prov" lang="en" data-testid="patient-provenance">
      {xs.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  );
}

// ----------------------------------------------------------------------------- sections

function Intro({ view, t, loc, fbLang, txLang }) {
  const forYouIf = localeText(view, loc, "ui.forYouIf");
  const bullets = Array.isArray(forYouIf) ? forYouIf.filter((s) => typeof s === "string" && s) : [];
  return (
    <div className="card" data-testid="patient-section" data-section="intro">
      <h2 lang={fbLang("introHeading")}>{t.introHeading}</h2>
      <p className="lede" lang={fbLang("introLede")}>{t.introLede}</p>
      {bullets.length > 0 && (
        <div className="sum" style={{ marginTop: 16 }}>
          <h3 lang={fbLang("forYouIfTitle")}>{t.forYouIfTitle}</h3>
          <ul lang={txLang("ui.forYouIf")}>
            {bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}
      <div className="sum ask" data-testid="patient-what-it-isnt">
        <h3 lang={fbLang("whatItIsntTitle")}>{t.whatItIsntTitle}</h3>
        <p lang={fbLang("whatItIsnt")}>{t.whatItIsnt}</p>
      </div>
      <div className="disc">
        <Info size={17} style={{ flex: "0 0 auto", marginTop: 1 }} />
        <span lang={fbLang("privacyNote")}>{t.privacyNote}</span>
      </div>
    </div>
  );
}

function Safety({ allFlags, flags, rf, setRf, safetyDone, setSafetyDone, urgent, t, fbLang }) {
  const toggle = (id) => setRf((v) => { const n = { ...v }; if (n[id]) delete n[id]; else n[id] = true; return n; });
  const call = tierOf(urgent ? "emergent" : "urgent");
  return (
    <div className="card" data-testid="patient-section" data-section="safety">
      <h2 lang={fbLang("safetyHeading")}>{t.safetyHeading}</h2>
      <p className="lede" lang={fbLang("safetyLede")}>{t.safetyLede}</p>
      <div style={{ marginTop: 14 }}>
        {allFlags.map((f) => {
          const d = tierOf(f.tier);
          return (
            <div key={f.id} className={"flag" + (rf[f.id] ? " on" : "")} role="checkbox" data-flag={f.id}
              aria-checked={!!rf[f.id]} tabIndex={0} onClick={() => toggle(f.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(f.id))}>
              <div className="box">{rf[f.id] && <Check size={15} />}</div>
              <div className="ft">
                {f.q}
                <span className="tier" style={{ background: d.bg, color: d.color }}>
                  {d.key === "now" ? t.tierNow : t.tierSoon}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {flags.length > 0 ? (
        <div className="call" style={{ background: call.bg }}>
          <div className="ct" style={{ color: call.color }}>
            <TriangleAlert size={20} /> <span lang={fbLang(urgent ? "callNow" : "callSoon")}>{urgent ? t.callNow : t.callSoon}</span>
          </div>
          <p>{urgent ? t.tierNowWhat : t.tierSoonWhat}</p>
          {flags.map((f) => (
            <div className="say" key={f.id}>
              <span className="sl">{t.sayThis}</span>
              <q>{f.say}</q>
            </div>
          ))}
          <p style={{ marginTop: 12, fontSize: 15 }} lang={fbLang("carryOn")}>{t.carryOn}</p>
        </div>
      ) : (
        <div className="nav" style={{ marginTop: 18 }}>
          <button className={"btn" + (safetyDone ? "" : " ghost")} onClick={() => setSafetyDone((v) => !v)} data-testid="patient-none-apply">
            {safetyDone ? <Check size={17} /> : <ShieldCheck size={17} />} <span lang={fbLang("noneApply")}>{t.noneApply}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** A story or domain step (Pat L703-734): heading, lede, the context questions, the items. */
function StepCard({ view, step, title, a, set, ctx, setCtx, t, loc, txLang }) {
  const p = `steps.${step.key}`;
  const story = step.kind === "story";
  const heading = story ? (localeText(view, loc, `${p}.heading`) || title) : title;
  const headingLang = story && localeText(view, loc, `${p}.heading`) ? txLang(`${p}.heading`) : txLang(`${p}.title`);
  const lede = localeText(view, loc, `${p}.lede`);
  const intro = story ? localeText(view, loc, `${p}.intro`) : null;
  const withContext = arr(step.extras).includes("context");
  const domains = arr(step.domainKeys).map((k) => arr(view.domains).find((d) => d.key === k)).filter(Boolean);
  return (
    <div className="card" data-testid="patient-section" data-section={step.key}>
      <h2 lang={headingLang}>{heading}</h2>
      {lede ? <p className="lede" lang={txLang(`${p}.lede`)}>{lede}</p> : null}
      <div style={{ marginTop: story ? 14 : 10 }}>
        {withContext && arr(view.contextItems).map((ci) => {
          const w = wording(view, loc, "contextItems", ci.id);
          if (!w || typeof w.q !== "string") return null;
          const lang = txLang(`contextItems.${ci.id}.q`);
          return (
            <div className="q" key={ci.id} data-item={ci.id}>
              <div className="qt" lang={lang}>{w.q}</div>
              <div className="opts">
                {arr(w.opts).map(([v, lab]) => (
                  <button key={v} className={"o" + (ctx[ci.id] === v ? " sel" : "")} lang={lang}
                    onClick={() => setCtx((c) => ({ ...c, [ci.id]: c[ci.id] === v ? undefined : v }))}>{lab}</button>
                ))}
              </div>
            </div>
          );
        })}
        {domains.map((d, i) => (
          <QBlock key={d.key} view={view} domain={d} a={a} set={set} t={t} loc={loc} txLang={txLang}
            intro={i === 0 ? intro : null} introLang={txLang(`${p}.intro`)} />
        ))}
      </div>
    </div>
  );
}

function QBlock({ view, domain, a, set, intro, introLang, t, loc, txLang }) {
  return (
    <>
      {intro && <div className="qh" style={{ marginTop: 14 }} lang={introLang}>{intro}</div>}
      {arr(domain.items).map((it) => {
        const p = wording(view, loc, "items", it.id);
        if (!p || typeof p.q !== "string") return null;
        const lang = txLang(`items.${it.id}.q`);
        const scale = it.scaleLen !== null && it.scaleLen !== undefined;
        return (
          <div className="q" key={it.id} data-item={it.id}>
            <div className="qt" lang={lang}>{p.q}</div>
            {p.help && <div className="qh" lang={txLang(`items.${it.id}.help`)}>{p.help}</div>}
            <div className="opts">
              {scale
                ? arr(p.opts).map((lab, i) => (
                    <button key={i} className={"o wide" + (a[it.id] === i ? " sel" : "")} data-value={i}
                      onClick={() => set(it.id, i)} lang={txLang(`items.${it.id}.opts`)}>{lab}</button>
                  ))
                : (
                  <>
                    <button className={"o" + (a[it.id] === ANSWER.YES ? " sel" : "")} data-value={ANSWER.YES} onClick={() => set(it.id, ANSWER.YES)}>{t.yes}</button>
                    <button className={"o no" + (a[it.id] === ANSWER.NO ? " sel" : "")} data-value={ANSWER.NO} onClick={() => set(it.id, ANSWER.NO)}>{t.no}</button>
                    <button className={"o unsure" + (a[it.id] === ANSWER.UNSURE ? " sel" : "")} data-value={ANSWER.UNSURE} onClick={() => set(it.id, ANSWER.UNSURE)}>{t.unsure}</button>
                  </>
                )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ----------------------------------------------------------------------------- summary

function RichText({ str }) {
  return (
    <>
      {richText(str).map((part, i) => (typeof part === "string" ? <React.Fragment key={i}>{part}</React.Fragment> : <b key={i}>{part.b}</b>))}
    </>
  );
}

function htmlFileName(name) {
  return /\.txt$/i.test(name) ? name.replace(/\.txt$/i, ".html") : `${name}.html`;
}

function Summary({ view, built, onReset, t, loc, appVersion, fbLang, txLang }) {
  const summary = built.summary;
  const blocked = !summary;

  const exportTxt = () => {
    if (!summary) return;
    downloadText(t.fileName, summaryText(view, loc, summary, { appVersion, generatedAt: new Date() }), "text/plain");
  };
  const exportHtml = () => {
    if (!summary) return;
    downloadText(htmlFileName(t.fileName), summaryHtml(view, loc, summary, { appVersion, generatedAt: new Date() }), "text/html");
  };
  const doPrint = () => {
    if (!summary) return;
    if (typeof window !== "undefined" && typeof window.print === "function") window.print();
  };

  const nav = (
    <div className="nav noprint exports" data-testid="patient-summary-actions">
      <button className="btn" onClick={doPrint} disabled={blocked} data-testid="patient-print"><Printer size={17} /> {t.print}</button>
      <button className="btn ghost" onClick={exportTxt} disabled={blocked} data-testid="patient-download-txt">
        <Download size={17} /> {t.download} (.txt)
      </button>
      <button className="btn ghost" onClick={exportHtml} disabled={blocked} data-testid="patient-download-html">
        <Download size={17} /> {t.download} (.html)
      </button>
      <div style={{ flex: 1 }} />
      <button className="btn ghost" onClick={onReset} data-testid="patient-start-over"><RotateCcw size={16} /> {t.startOver}</button>
    </div>
  );
  const disclaimer = (
    <div className="disc">
      <Info size={17} style={{ flex: "0 0 auto", marginTop: 1 }} />
      <span lang={fbLang("disclaimer")}>{t.disclaimer}</span>
    </div>
  );

  if (blocked) {
    return (
      <div className="card" data-testid="patient-section" data-section="summary">
        <h2>{t.summaryTitle}</h2>
        <div className="sum err" role="alert" lang="en" data-testid="patient-summary-error">
          <p>{SUMMARY_ERROR}</p>
        </div>
        {nav}
        {disclaimer}
      </div>
    );
  }

  const { said, ask, gapLine, unsureList, clin, flags, urgent } = summary;
  // A near-empty summary must not be handed over as if it were a finished one (Pat L999-1001).
  const thin = said.length === 0 && clin.length === 0 && flags.length === 0;
  const call = tierOf(urgent ? "emergent" : "urgent");
  const clinicianLede = clin.length > 0 ? localeText(view, loc, "ui.clinicianLede") : null;

  return (
    <div className="card" data-testid="patient-section" data-section="summary">
      <h2>{t.summaryTitle}</h2>
      {thin ? (
        <div className="sum ask" data-testid="patient-thin">
          <h3>{t.thinTitle}</h3>
          <p>{t.thin}</p>
        </div>
      ) : (
        <p className="lede noprint" lang={fbLang("summaryLede")}>{t.summaryLede}</p>
      )}

      {flags.length > 0 && (
        <div className="call" style={{ background: call.bg }}>
          <div className="ct" style={{ color: call.color }}>
            <TriangleAlert size={20} /> <span lang={fbLang(urgent ? "seenToday" : "seenWeek")}>{urgent ? t.seenToday : t.seenWeek}</span>
          </div>
          <p>{urgent ? t.tierNowWhat : t.tierSoonWhat}</p>
          {flags.map((f) => (
            <div className="say" key={f.id}><span className="sl">{t.sayThis}</span><q>{f.say}</q></div>
          ))}
        </div>
      )}

      {gapLine && (
        <div className="sum ask">
          <h3><MessageSquareQuote size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{t.openWith}</h3>
          <p><q style={{ fontStyle: "normal", fontWeight: 560 }}>{gapLine}</q></p>
        </div>
      )}

      {said.length > 0 && (
        <div className="sum">
          <h3><ClipboardList size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{t.describe}</h3>
          <ul>{said.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {ask.length > 0 && (
        <div className="sum ask">
          <h3><HelpCircle size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{t.askAbout}</h3>
          <ul>{ask.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {unsureList.length > 0 && (
        <div className="sum unsure">
          <h3>{t.notSure}</h3>
          <p style={{ marginBottom: 4 }}>{t.notSureLede}</p>
          <ul>{unsureList.map((id) => <li key={id}>{askForm(view, loc, id)}</li>)}</ul>
        </div>
      )}

      {clin.length > 0 && (
        <div className="sum clin">
          <h3>{t.forClinician}</h3>
          {clinicianLede ? (
            <p style={{ marginBottom: 6, fontSize: 14 }} lang={txLang("ui.clinicianLede")}>
              <RichText str={clinicianLede} />
            </p>
          ) : null}
          <ul lang={loc !== "en" ? "en" : undefined}>{clin.map((c, i) => <li key={i}>{c.neg ? "− " : "+ "}{c.t}</li>)}</ul>
        </div>
      )}

      {nav}
      {disclaimer}
    </div>
  );
}
