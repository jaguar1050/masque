import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Play, Pause, RotateCcw, ArrowRight, Stethoscope,
  Activity, ShieldCheck, TriangleAlert, HelpCircle, Check, Copy, FileJson,
  FileText, Sparkles, User, MessageSquare, ChevronDown, Info, Plus, Download
} from "lucide-react";
import { createVoiceCapture, isVoiceSupported, isSecureForMicrophone, VOICE_ENGINE, VOICE_LANG, VOICE_ERRORS } from "../MASQUE_Voice.js";
import { computeScore } from "../engine/scoring.js";
import { createExtractor } from "../engine/extraction.js";
import { liveProbes, truncateProbes } from "../engine/probes.js";
import { ingestCaptures, rankSuggestions, captureLabel, itemShort, buildNote } from "../engine/scribe.js";
import { derivePhenotype, activeFlagsOf, buildRoutingState, routingRecs, gapSignals } from "../engine/rules.js";
import { routingGate, signGate } from "../engine/gates.js";
import { buildBundle, buildQuestionnaire, buildCdsHooks, buildDataDictionary } from "../engine/fhir.js";
import { screenToCohortRow, rowsToCsv } from "../engine/cohort.js";
import { downloadText, downloadJsonFile, fhirHtml } from "../engine/download.js";
import { scopeCss } from "../engine/css.js";
import { richText } from "../engine/patient.js";
import { PROBE_KIND, LOWEST_BAND, INDETERMINATE } from "../engine/vocab.js";
import { APP_VERSION, SITE } from "../engine/policy.js";
import { ProvenanceBadge, TabNote } from "../ui/common.jsx";

/*  apps/Scribe.jsx — the generic Ambient Scribe (design 03 §5.4, §9.9). Owner: WP8.

    Ported from the baseline Scribe component (Scb L727-1297, VoiceMeter included). The DOM
    structure, the class names and the CSS are the baseline's; every module-specific value
    comes from the bound `module` prop and every computation from the engine:

      capture       createExtractor(module.lexicon) → ingestCaptures (raise-only red flags,
                    first-wins items); interim speech is only ever previewed
      suggestions   rankSuggestions (the pool widens while the screen is not scorable)
      probes        liveProbes / truncateProbes over module.logic.probes.list
      routing       routingGate → buildRoutingState → routingRecs; a throwing phenotype or
                    routing rule withholds routing behind the engine rule-error card
      note, bundle  buildNote / buildBundle on the scribe surface; signGate gates signing

    Microphone. The browser's speech recognition, through the shared voice module, which is
    imported unchanged: a getUserMedia level meter, interim and final results, a speaker
    toggle, automatic restart and error mapping. Only final segments are captured. The
    recogniser language comes from the module lexicon. Capture stops on `stopSignal`, on
    `pagehide`, on unmount and on Reset; while `micAllowed` is false Listen is disabled and a
    capture that reports a live state (a permission prompt answered late) is destroyed at once.
    Nothing audio is stored.

    Without a lexicon the transport (Listen, Play, Step, typed input) is hidden: no speech or
    typed text is gathered when it can have no structured use. Without a demo transcript Play
    and Step are hidden; without probes the probe rail is empty.

    Skip writes nothing: a skipped item stays unanswered and keeps its headroom.

    Never names a module id, item, flag, context id, phenotype value or brand (t-ids).
*/

// ------------------------- styles (Scb L591-716, moved unedited) ----------------

const SCRIBE_CSS = `
:root{--ink:#0C2B2F;--petrol:#0F5C61;--petrol2:#137A80;--surface:#EDF3F1;--panel:#FFFFFF;
--line:#D7E1DF;--muted:#5C6E6C;--amber:#B26C1F;--amberbg:#F6ECD9;--coral:#B84A33;--coralbg:#F6E1DA;
--green:#2C7A57;--greenbg:#E0EEE7;--slate:#4F6466;
--mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
*{box-sizing:border-box}
.mq{font-family:var(--sans);color:var(--ink);background:var(--surface);min-height:100%;-webkit-font-smoothing:antialiased;line-height:1.45}
.wrap{max-width:1080px;margin:0 auto;padding:16px 16px 64px}
.mq h1,.mq h2,.mq h3,.mq h4{margin:0;font-weight:650;letter-spacing:-.01em}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.banner{background:var(--ink);color:#EAF3F1;border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:13px;flex-wrap:wrap}
.avatar{width:36px;height:36px;border-radius:10px;background:var(--petrol2);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.banner .name{font-size:15.5px;font-weight:650}.banner .meta{font-size:11.5px;color:#9FC1BE}
.badge{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.28);color:#BFE0DC;white-space:nowrap;display:inline-flex;gap:5px;align-items:center}
.badge.live{color:#0C2B2F;background:#7BE0B0;border-color:#7BE0B0}
.dot{width:7px;height:7px;border-radius:50%;background:#0C2B2F;animation:pulse 1.1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.spacer{flex:1 1 auto}
.gbtn{font:inherit;font-size:12.5px;cursor:pointer;border-radius:9px;padding:7px 11px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#EAF3F1;display:inline-flex;align-items:center;gap:6px}
.gbtn:hover{background:rgba(255,255,255,.08)}
.brandrow{display:flex;align-items:center;gap:12px;margin:18px 2px 4px}
.mark{width:34px;height:34px;border-radius:9px;background:var(--petrol);color:#fff;display:flex;align-items:center;justify-content:center}
.brandrow .t1{font-size:18px;font-weight:700;letter-spacing:-.02em}.brandrow .t2{font-size:12.5px;color:var(--muted)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px;align-items:start}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
.chdr{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.chdr .ct{font-size:13px;font-weight:660}.chdr .ce{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--petrol);font-weight:600}
.transport{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.tbtn{font:inherit;font-size:13px;font-weight:600;cursor:pointer;border-radius:9px;padding:8px 13px;border:1px solid var(--petrol);background:var(--petrol);color:#fff;display:inline-flex;align-items:center;gap:7px}
.tbtn:hover{background:var(--petrol2);border-color:var(--petrol2)}
.tbtn.ghost{background:#fff;color:var(--ink);border-color:var(--line)}.tbtn.ghost:hover{border-color:var(--petrol2)}
.tbtn:disabled{opacity:.4;cursor:not-allowed}
.tsc{max-height:340px;overflow:auto;padding-right:4px}
.row{display:flex;margin:8px 0}
.row.pt{justify-content:flex-start}.row.md{justify-content:flex-end}
.bub{max-width:82%;padding:9px 12px;border-radius:13px;font-size:13.5px}
.row.pt .bub{background:#F1F5F4;border:1px solid var(--line);border-bottom-left-radius:4px}
.row.md .bub{background:var(--petrol);color:#fff;border-bottom-right-radius:4px}
.who{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 4px 2px}
.cap{font-family:var(--mono);font-size:10px;color:var(--green);margin-top:5px;display:flex;gap:5px;flex-wrap:wrap}
.captag{background:var(--greenbg);border-radius:6px;padding:2px 6px;color:#1E5A40}
.rf{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:7px;background:#fff;display:flex;gap:10px;align-items:flex-start;cursor:pointer;transition:.12s}
.rf:hover{border-color:#C98476}
.rf.on{border-color:var(--coral);background:#FDF4F1;box-shadow:inset 0 0 0 1px var(--coral)}
.rf .box{width:17px;height:17px;border-radius:5px;border:1.5px solid #B7C4C2;flex:0 0 auto;margin-top:1px;display:flex;align-items:center;justify-content:center;background:#fff}
.rf.on .box{background:var(--coral);border-color:var(--coral);color:#fff}
.rf .rt{font-size:12.5px;line-height:1.35}.rf .rm{font-size:11px;color:var(--muted);margin-top:3px}
.tier{font-family:var(--mono);font-size:9px;letter-spacing:.07em;text-transform:uppercase;border-radius:5px;padding:2px 5px;margin-left:6px;white-space:nowrap}
.tier.emergent{background:var(--coralbg);color:#8E3520}.tier.urgent{background:var(--amberbg);color:#7A4E12}
.tier.heard{background:var(--greenbg);color:#1E5A40}
.override{border:1.5px solid var(--coral);background:var(--coralbg);border-radius:12px;padding:13px 14px;margin-top:12px}
.override .ot{font-size:13.5px;font-weight:700;color:#8E3520;display:flex;gap:8px;align-items:center}
.override .os{font-size:11.5px;color:#6E3020;margin-top:4px}
.override .oitem{background:#fff;border-radius:8px;padding:8px 10px;margin-top:7px;font-size:11.5px}
.override .oitem b{display:block;font-size:12px;margin-bottom:2px}.override .oact{color:#8E3520;font-weight:600}
.entry{display:flex;gap:7px;margin-top:12px}
.entry input{flex:1;font:inherit;font-size:13px;padding:9px 11px;border:1px solid var(--line);border-radius:9px}
.entry input:focus{outline:2px solid var(--petrol2);outline-offset:1px}
.mini{font:inherit;font-size:12.5px;cursor:pointer;border-radius:8px;padding:9px 11px;border:1px solid var(--petrol);background:var(--petrol);color:#fff;display:inline-flex;gap:5px;align-items:center}

/* right column */
.score{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:600;font-size:52px;line-height:.9;letter-spacing:-.03em}
.readout{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:650;padding:5px 11px;border-radius:999px}
.covrow{display:flex;align-items:center;gap:10px;margin-top:12px}
.covtrack{flex:1;height:8px;border-radius:6px;background:var(--line);overflow:hidden}
.covfill{height:100%;background:var(--petrol2);border-radius:6px;transition:width .4s ease}
.dbar{display:grid;grid-template-columns:118px 1fr 48px;gap:9px;align-items:center;padding:5px 0}
.dbar .dl{font-size:12px}.dtrack{height:7px;border-radius:5px;background:var(--line);overflow:hidden}
.dfill{height:100%;border-radius:5px;background:var(--petrol2);transition:width .4s}
.dpts{font-family:var(--mono);font-size:11px;text-align:right;color:var(--muted)}
.prompt{border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:0 11px 11px 0;background:#FffdF8;padding:11px 13px;margin-top:9px}
.prompt .qtag{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--amber);font-weight:700;margin-bottom:3px;display:flex;gap:6px;align-items:center}
.prompt .qq{font-size:13.5px;font-weight:560;margin-bottom:8px}
.prow{display:flex;gap:6px;flex-wrap:wrap}
.pbtn{font:inherit;font-size:12px;cursor:pointer;border-radius:8px;padding:6px 12px;border:1px solid var(--line);background:#fff}
.pbtn:hover{border-color:var(--petrol2)}
.pbtn.y{background:var(--petrol);color:#fff;border-color:var(--petrol)}
.pbtn.n{background:var(--slate);color:#fff;border-color:var(--slate)}
.pbtn.skip{color:var(--muted)}
.alert{display:flex;gap:11px;background:var(--amberbg);border:1px solid #E4C88E;border-radius:12px;padding:12px 13px;margin-top:12px}
.alert .at{font-size:12.5px;font-weight:660;color:#7A4E12;margin-bottom:2px}.alert .ap{font-size:12px;color:#6B4A18}
.rec{border-left:3px solid var(--petrol);background:#F4F8F7;border-radius:0 10px 10px 0;padding:11px 13px;margin-top:9px}
.rec h4{font-size:12.5px;margin:0 0 3px}.rec p{font-size:12px;color:#33474A}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.chip{font-family:var(--mono);font-size:10px;border:1px solid var(--line);background:#fff;border-radius:6px;padding:3px 7px;color:var(--slate)}
.note{font-family:var(--mono);font-size:11.5px;line-height:1.55;white-space:pre-wrap;background:#0C2B2F;color:#CFE6E2;border-radius:11px;padding:14px;max-height:320px;overflow:auto}
.code{font-family:var(--mono);font-size:11px;line-height:1.5;background:#0C2B2F;color:#CFE6E2;border-radius:11px;padding:13px;overflow:auto;max-height:280px;white-space:pre}
.code .k{color:#8FD3CC}.code .s{color:#E7C08A}.code .n{color:#F0A992}
.btnrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.act{font:inherit;font-size:13px;font-weight:600;cursor:pointer;border-radius:9px;padding:9px 13px;border:1px solid var(--petrol);background:var(--petrol);color:#fff;display:inline-flex;gap:7px;align-items:center}
.act.ghost{background:#fff;color:var(--ink);border-color:var(--line)}.act.ghost:hover{border-color:var(--petrol2)}
.notew{font-size:11.5px;color:var(--muted);display:flex;gap:7px;margin-top:12px;align-items:flex-start}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#EAF3F1;padding:10px 17px;border-radius:11px;font-size:13px;display:flex;gap:8px;align-items:center;z-index:40;box-shadow:0 8px 30px rgba(0,0,0,.22)}
.empty{font-size:12.5px;color:var(--muted);text-align:center;padding:18px 8px}
.foot{font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.04em;text-align:center;margin-top:22px}
details.about summary{cursor:pointer;font-size:12.5px;font-weight:600;color:var(--petrol);display:flex;gap:6px;align-items:center;list-style:none}
details.about summary::-webkit-details-marker{display:none}
details.about[open] .chev{transform:rotate(180deg)}.chev{transition:.2s}
.abgrid{font-size:12px;color:#33474A;margin-top:9px;display:grid;gap:7px}
:focus-visible{outline:2px solid var(--petrol2);outline-offset:2px;border-radius:6px}
@media (max-width:820px){.grid{grid-template-columns:1fr}}

/* voice capture */
.tbtn.rec{background:var(--coral);border-color:var(--coral)}.tbtn.rec:hover{background:#A03F2A;border-color:#A03F2A}
.voice{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:-4px 0 12px;background:#F7FAF9}
.vrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.vstate{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.vstate.on{color:var(--coral)}
.vstate.on::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--coral);animation:pulse 1.1s infinite}
.vmeter{flex:1 1 80px;min-width:60px;height:6px;border-radius:4px;background:var(--line);overflow:hidden}
.vfill{height:100%;background:var(--green);border-radius:4px;transition:width .08s linear}
.spk{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-left:auto}
.spkb{font:inherit;font-size:11.5px;cursor:pointer;padding:5px 9px;border:0;background:#fff;color:var(--muted);display:inline-flex;align-items:center;gap:5px}
.spkb.on{background:var(--petrol);color:#fff}
.verr{font-size:11.5px;color:#8E3520;display:flex;gap:6px;align-items:flex-start;margin-top:6px}
.vhint{font-size:11px;color:var(--muted);margin-top:5px}
.bub.interim{opacity:.72;border-style:dashed}
.row.md .bub.interim{border:1px dashed rgba(255,255,255,.6)}
.captag.pending{background:#fff;border:1px dashed var(--green);color:var(--green)}
.dbar.hit .dl{color:var(--green);font-weight:650}.dbar.hit .dfill{background:var(--green)}
@keyframes scorepop{0%{transform:scale(1.05)}100%{transform:scale(1)}}
.score{animation:scorepop .3s ease-out;transform-origin:left bottom}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

// New chrome only (non-clinical): the panel link card, the lexicon / secure-context
// notices and the probe evaluation-error tag. Classes carry the sa-scribe- prefix.
const SCRIBE_EXTRA_CSS = `
.sa-scribe-link{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:14px}
.sa-scribe-link .sa-scribe-linktext{flex:1 1 260px;font-size:12.5px;color:#33474A}
.sa-scribe-notice{display:flex;gap:7px;align-items:flex-start;font-size:12px;color:#6B4A18;background:var(--amberbg);border:1px solid #E4C88E;border-radius:10px;padding:9px 11px;margin:0 0 12px}
.sa-scribe-evalerr{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:#8E3520;background:var(--coralbg);border-radius:5px;padding:2px 6px;margin-left:6px}
.sa-scribe-prov{margin-bottom:10px}
`;

const CSS = scopeCss(SCRIBE_CSS, ".sa-scribe") + scopeCss(SCRIBE_EXTRA_CSS, ".sa-scribe");

// Engine chrome (design §3.5, §5.3, §5.4, §7.5). English, non-clinical.
const NO_LEXICON_NOTICE = "This module has no extraction lexicon: speech and typed statements cannot be captured into the screen. Use the prompts.";
const MIC_OFF_TITLE = "The microphone is off while a patient-facing view is shown.";
const LIVE_STATES = ["starting", "listening", "restarting"];

const BAND_META = {
  low: { c: "var(--green)", bg: "var(--greenbg)", l: "Low" },
  moderate: { c: "var(--amber)", bg: "var(--amberbg)", l: "Moderate" },
  high: { c: "var(--coral)", bg: "var(--coralbg)", l: "High" },
  [INDETERMINATE]: { c: "var(--slate)", bg: "#E3EAE9", l: "Not scorable" },
};

const RULE_ERROR_CARD_ID = "engine:rule-error";

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

/** `**bold**` (the only markup in module data) as React nodes. */
function Rich({ text }) {
  return <>{richText(text).map((p, i) => (typeof p === "string" ? <React.Fragment key={i}>{p}</React.Fragment> : <b key={i}>{p.b}</b>))}</>;
}

// ------------------------- component ------------------------------------------

/**
 * @param {{module:Object, appVersion?:string, site?:Object,
 *          onScreen?:function, onCapture?:function, onDirty?:function, onModuleError?:function,
 *          onOpenTab?:function, onVoiceState?:function, stopSignal?:number, micAllowed?:boolean}} props
 */
export default function Scribe({
  module, appVersion = APP_VERSION, site = SITE,
  onScreen, onCapture, onDirty, onModuleError, onOpenTab, onVoiceState,
  stopSignal = 0, micAllowed = true,
}) {
  const patient = (module.demo && module.demo.patient) || {};
  const script = useMemo(() => (module.demo && Array.isArray(module.demo.transcript) ? module.demo.transcript : []), [module]);
  const hasLexicon = !!module.lexicon;
  const hasScript = hasLexicon && script.length > 0;
  const voiceLang = (module.lexicon && module.lexicon.lang) || VOICE_LANG;
  const copy = module.copy || {};
  const scribeCopy = copy.scribe || {};

  const [transcript, setTranscript] = useState([]);   // {id, role, text, src, caps:[{id,value,kind}]}
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [answers, setAnswers] = useState({});
  const [ctx, setCtx] = useState({});
  const [vmp, setVmp] = useState({});                  // informational prompt coverage
  const [asked, setAsked] = useState({});              // items the MD explicitly addressed via prompts
  const [skipped, setSkipped] = useState({});          // prompts dismissed without an answer — NOT denials
  const [cohort, setCohort] = useState([]);            // captured screens (pilot loop)
  const [rf, setRf] = useState({});                    // id -> "nlp" | "md" | "probe"
  const [safetyReviewed, setSafetyReviewed] = useState(false);
  const [probeAns, setProbeAns] = useState({});   // probe id -> chosen option index
  const [probeNotes, setProbeNotes] = useState([]);
  const [input, setInput] = useState("");
  const [view, setView] = useState("safety");          // safety | prompts | note | fhir
  const [toast, setToast] = useState("");
  const scrollRef = useRef(null);

  // native voice capture — see the shared voice module
  const [voiceState, setVoiceState] = useState("idle"); // idle | starting | listening | restarting | stopped | error
  const [voiceErr, setVoiceErr] = useState(null);
  const [voiceUsed, setVoiceUsed] = useState(false);
  const [interim, setInterim] = useState("");           // text the recogniser has not committed yet
  const [speaker, setSpeaker] = useState("pt");         // who the microphone is hearing: pt | md
  const [pulse, setPulse] = useState({ domains: [], at: 0 }); // domains touched by the latest capture
  const voiceRef = useRef(null);
  const ingestRef = useRef(null);
  const speakerRef = useRef("pt");
  const levelSink = useRef(null);
  const micAllowedRef = useRef(micAllowed !== false);
  const voiceSupported = useMemo(() => isVoiceSupported(), []);
  const secure = useMemo(() => isSecureForMicrophone(), []);
  const listening = LIVE_STATES.includes(voiceState);
  speakerRef.current = speaker;
  micAllowedRef.current = micAllowed !== false;

  // Host callbacks through a ref, so effects never re-run (or loop) on a new callback identity.
  const cb = useRef({});
  cb.current = { onScreen, onCapture, onDirty, onModuleError, onOpenTab, onVoiceState };

  const extractor = useMemo(() => (module.lexicon ? createExtractor(module.lexicon) : null), [module]);
  const score = useMemo(() => computeScore(module, answers), [module, answers]);
  const { domains, total, floor, ceiling, coverage, scorable, band } = score;

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2400); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [transcript, interim]);
  useEffect(() => { if (!pulse.at) return; const t = setTimeout(() => setPulse({ domains: [], at: 0 }), 1800); return () => clearTimeout(t); }, [pulse]);

  // Unmount (a module switch remounts the workspace): the capture is destroyed, and the host is
  // told, because this component cannot report its state after it is gone.
  useEffect(() => () => {
    const vc = voiceRef.current;
    if (vc) {
      voiceRef.current = null;
      vc.destroy();
      if (cb.current.onVoiceState) cb.current.onVoiceState({ state: "stopped" });
    }
  }, []);

  // Leaving or hiding the page ends the capture.
  useEffect(() => {
    const onHide = () => { if (voiceRef.current) voiceRef.current.destroy(); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // The host's stop request (switching to a patient-facing view, a module switch, the indicator's Stop).
  useEffect(() => { if (stopSignal) stopVoice(); }, [stopSignal]); // eslint-disable-line

  // The microphone is never live while a patient-facing view is shown: destroy at once.
  useEffect(() => {
    if (micAllowed === false && voiceRef.current && LIVE_STATES.includes(voiceRef.current.getState())) voiceRef.current.destroy();
  }, [micAllowed]);

  useEffect(() => { if (cb.current.onVoiceState) cb.current.onVoiceState({ state: voiceState }); }, [voiceState]);

  // ingest one utterance: run extraction, update state, return captures.
  // src records where the utterance came from — demo | typed | voice — for the transcript only;
  // capture rules are identical for all three.
  function ingest(role, text, src = "demo") {
    const caps = role === "pt" && extractor ? extractor.extract(text) : [];
    if (caps.length) {
      const touched = [...new Set(ingestCaptures({}, caps).touchedDomainItemIds.map(id => module.itemById[id]?.domain).filter(Boolean))];
      if (touched.length) setPulse({ domains: touched, at: Date.now() });
      // Items first-wins; context overwrites; red flags only ever raised and marked as heard —
      // a clinician decision already on the record is not downgraded by a later phrase match.
      setAnswers(a => ingestCaptures({ answers: a }, caps).answers);
      setCtx(c => ingestCaptures({ ctx: c }, caps).ctx);
      setRf(v => ingestCaptures({ rf: v }, caps).rf);
    }
    setTranscript(t => [...t, { id: t.length, role, text, src, caps: caps.map(c => ({ id: c.id, value: c.value, kind: c.kind })) }]);
  }
  ingestRef.current = ingest;

  /*  Microphone. The capture object lives outside React state; its callbacks reach the
      current ingest and speaker through refs so a session started minutes ago does not
      write through a stale closure. Final segments are ingested exactly like a typed
      statement; interim text is only previewed.
  */
  const bindLevel = useCallback((fn) => { levelSink.current = fn; }, []);
  function startVoice() {
    if (!hasLexicon || !micAllowedRef.current) return;
    if (voiceRef.current) voiceRef.current.destroy();
    setVoiceErr(null); setInterim(""); setPlaying(false); setVoiceUsed(true);
    let vc = null;
    vc = createVoiceCapture({
      lang: voiceLang,
      onState: (s) => {
        setVoiceState(s);
        // A permission prompt answered after the switch to a patient-facing view.
        if (vc && !micAllowedRef.current && LIVE_STATES.includes(s)) vc.destroy();
      },
      onInterim: setInterim,
      onError: setVoiceErr,
      onLevel: (v) => { if (levelSink.current) levelSink.current(v); },
      onFinal: (text) => ingestRef.current(speakerRef.current, text, "voice"),
    });
    voiceRef.current = vc;
    vc.start();
  }
  function stopVoice() { if (voiceRef.current) voiceRef.current.stop(); }

  // What the extractor would capture from the words still being recognised. Preview only —
  // nothing is written until the recogniser commits the segment.
  const previewCaps = useMemo(
    () => (interim && speaker === "pt" && extractor) ? extractor.extract(interim).map(c => ({ id: c.id, value: c.value, kind: c.kind })) : [],
    [interim, speaker, extractor]);

  // playback
  useEffect(() => {
    if (!playing) return;
    if (cursor >= script.length) { setPlaying(false); return; }
    const [role, text] = script[cursor];
    const delay = role === "md" ? 850 : 1500;
    const t = setTimeout(() => { ingest(role, text); setCursor(c => c + 1); }, delay);
    return () => clearTimeout(t);
  }, [playing, cursor]); // eslint-disable-line

  function stepOnce() {
    if (cursor >= script.length) return;
    const [role, text] = script[cursor]; ingest(role, text); setCursor(c => c + 1);
  }

  function reset() {
    stopVoice(); setInterim(""); setVoiceErr(null);
    setTranscript([]); setCursor(0); setPlaying(false); setAnswers({}); setCtx({});
    setVmp({}); setAsked({}); setSkipped({}); setRf({}); setSafetyReviewed(false); setView("safety");
    setProbeAns({}); setProbeNotes([]); setCohort([]);
    setToast("Encounter cleared");
  }
  function submitInput() {
    const v = input.trim(); if (!v) return;
    ingest("pt", v, "typed"); setInput("");
  }

  // Phenotype (complaint). A derive error is a routing error: "" here is for display and the
  // cohort row only, never a fallback for routing.
  const { value: complaint, error: phenotypeError } = useMemo(() => derivePhenotype(module, answers), [module, answers]);

  // suggested questions: unanswered items, prioritized by active pathway + weight.
  // While the screen is unscorable the pool widens to every unanswered item —
  // otherwise headroom parked in an inactive domain could hold the screen
  // indeterminate with nothing left on screen to resolve it.
  const { list: suggestions, error: activationError } = useMemo(
    () => rankSuggestions(module, { answers, complaint, phenotypeError, vmp, scorable, skipped }),
    [module, answers, complaint, phenotypeError, vmp, scorable, skipped]);

  /*  Contextual probes — what to ask or do next, ranked by what the answer could change,
      ordered safety → re-ask → criteria → rule-out → supporting → exam, so a question that
      could surface a red flag outranks one that could add points. A probe whose trigger
      throws stays on the rail (the safe direction) with an evaluation-error tag.
  */
  const { probes, probeErrors } = useMemo(() => {
    const errs = [];
    const list = (module.logic && module.logic.probes && module.logic.probes.list) || [];
    const live = liveProbes(list, answers, rf, probeAns, {
      onError: (id, err) => errs.push({ family: "probe", ruleId: String(id), message: err && err.message ? err.message : String(err) }),
    });
    return { probes: live, probeErrors: errs };
  }, [module, answers, rf, probeAns]);
  const probeGroups = useMemo(() => truncateProbes(probes), [probes]);
  const probeErrorIds = useMemo(() => new Set(probeErrors.map(e => e.ruleId)), [probeErrors]);

  function answerProbe(p, idx) {
    const o = p.opts[idx];
    setProbeAns(v => ({ ...v, [p.id]: idx }));
    // A probe may only ever RAISE a red flag, never clear one — same rule as ambient capture.
    if (o.rf) setRf(v => (v[o.rf] ? v : { ...v, [o.rf]: "probe" }));
    if (o.a) { setAnswers(a2 => ({ ...a2, ...o.a })); setAsked(k => ({ ...k, ...Object.fromEntries(Object.keys(o.a).map(x => [x, true])) })); }
    if (o.note) setProbeNotes(n => [...n, o.note]);
  }

  function answerPrompt(s, value) {
    if (s.kind === "info") { setVmp(v => ({ ...v, [s.id]: value })); }
    else { setAnswers(a => ({ ...a, [s.id]: value })); setAsked(k => ({ ...k, [s.id]: true })); }
  }
  // Skipping a prompt hides it; it never writes an answer. A skipped item stays
  // unanswered — it keeps its headroom in the attainable range, is not counted toward
  // coverage, and is absent from the note and the QuestionnaireResponse. Recording it
  // as "no" would turn "the physician chose not to ask" into "the patient denied it",
  // which is the absent-data-as-negative-data error the whole codebase is built against.
  function skipPrompt(s) {
    if (s.kind === "info") setVmp(v => ({ ...v, [s.id]: "skip" }));
    else setSkipped(k => ({ ...k, [s.id]: true }));
  }

  const bandMeta = BAND_META[band] || BAND_META[INDETERMINATE];

  const gap = useMemo(() => gapSignals(module, ctx), [module, ctx]);
  const gapFlags = gap.hits.map(h => h.scribeLabel);
  const gapAlert = gap.alert;

  const activeFlags = useMemo(() => activeFlagsOf(module, rf), [module, rf]);
  const override = activeFlags.length > 0;
  const emergent = activeFlags.some(f => f.tier === "emergent");
  // Routing requires BOTH: no open red flag, and a clinician who has actually
  // recorded the safety review. An unreviewed encounter routes nothing.
  const routingCleared = routingGate({ override, safetyReviewed });

  const { recs, error: routingError } = useMemo(() => routingRecs(module, buildRoutingState(module, {
    surface: "scribe", answers, ctx, complaint, phenotypeError, score, activeFlags, safetyReviewed,
  })), [module, answers, ctx, complaint, phenotypeError, score, activeFlags, safetyReviewed]);
  const ruleErrorShown = recs.some(r => r.id === RULE_ERROR_CARD_ID);

  const note = useMemo(() => buildNote(module, {
    patient, answers, ctx, vmp, score, complaint, recs, routingError, gapAlert, activeFlags, safetyReviewed, emergent, probeNotes,
  }), [module, patient, answers, ctx, vmp, score, complaint, recs, routingError, gapAlert, activeFlags, safetyReviewed, emergent, probeNotes]);
  const bundle = useMemo(() => buildBundle(module, {
    patient, answers, score, complaint, activeFlags, emergent, routingCleared, routingError,
  }, { surface: "scribe" }), [module, patient, answers, score, complaint, activeFlags, emergent, routingCleared, routingError]);

  const canSign = signGate({ safetyReviewed });
  const filePrefix = module.fhir.filePrefix;
  const instrument = module.instrumentVersion;
  const versions = module.versions || {};

  function captureScreen() {
    const row = screenToCohortRow(module, { patient, answers, ctx, score, activeFlags, complaint }, { appVersion, salt: site.SITE_SALT });
    setCohort(c => [...c, row]);
    if (cb.current.onCapture) cb.current.onCapture({ source: "scribe", row });
    setToast(`Screen appended — ${cohort.length + 1} in session cohort`);
  }

  // ------------------------------------------------------------- publishing to the host
  const moduleErrors = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const e of [phenotypeError, activationError, routingError, ...probeErrors]) {
      if (!e) continue;
      const k = `${e.family}\u0000${e.ruleId}\u0000${e.message}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ family: e.family, ruleId: e.ruleId, message: e.message });
    }
    return out;
  }, [phenotypeError, activationError, routingError, probeErrors]);
  const moduleErrorKey = JSON.stringify(moduleErrors);
  useEffect(() => {
    if (cb.current.onModuleError) for (const e of moduleErrors) cb.current.onModuleError(e);
  }, [moduleErrorKey]); // eslint-disable-line

  useEffect(() => {
    if (!cb.current.onScreen) return;
    cb.current.onScreen({
      source: "scribe", at: new Date().toISOString(), moduleKey: module.key ?? null,
      score: total, floor, ceiling, scorable, band, domains, coverage,
      sex: patient.sex ?? null, gender: patient.gender ?? null, phenotype: complaint,
      redFlags: activeFlags.map(f => f.points), safetyReviewed, routingCleared, answers, ctx,
    });
  }, [module, score, complaint, activeFlags, safetyReviewed, routingCleared, answers, ctx]); // eslint-disable-line

  const answeredCount = Object.keys(answers).length;
  const dirtySummary = useMemo(() => {
    const parts = [];
    if (transcript.length) parts.push(`transcript (${plural(transcript.length, "line", "lines")})`);
    if (answeredCount) parts.push(plural(answeredCount, "answer", "answers"));
    const flagCount = Object.keys(rf).length;
    if (flagCount) parts.push(plural(flagCount, "red flag", "red flags"));
    if (cohort.length) parts.push(plural(cohort.length, "captured row", "captured rows"));
    if (!parts.length && (safetyReviewed || Object.keys(ctx).length || Object.keys(vmp).length || probeNotes.length)) parts.push("screen in progress");
    return parts.length ? parts.join(", ") : null;
  }, [transcript.length, answeredCount, rf, cohort.length, safetyReviewed, ctx, vmp, probeNotes.length]);
  useEffect(() => { if (cb.current.onDirty) cb.current.onDirty("scribe", dirtySummary); }, [dirtySummary]);

  const hasContent = transcript.length > 0;
  const canListen = voiceSupported && secure && micAllowed !== false;
  const listenTitle = !voiceSupported ? VOICE_ERRORS.unsupported
    : !secure ? VOICE_ERRORS.insecure
    : micAllowed === false ? MIC_OFF_TITLE
    : "Capture the encounter from this device's microphone";
  const aboutLines = Array.isArray(scribeCopy.about) ? scribeCopy.about : [];
  const benchmark = versions.goldSet
    ? ` — benchmarked in-sample only, see EXTRACTION_BENCHMARK${versions.goldSetLexicon && versions.goldSetLexicon !== versions.lexicon ? ` (benchmarked on lexicon ${versions.goldSetLexicon}; not re-run)` : ""}`
    : " — gold set — (not benchmarked)";

  return (
    <div className="sa-app sa-scribe" data-testid="scribe-app">
      <style>{CSS}</style>
      <div className="mq">
      <div className="wrap">

        <TabNote kind="clinician" />

        {/* banner */}
        <div className="banner">
          <div className="avatar"><User size={18} color="#EAF3F1" /></div>
          <div>
            <div className="name">{patient.family}, {patient.given}</div>
            <div className="meta num">{patient.age ?? "—"} yr · {patient.sex ?? "—"} · {patient.mrn} · synthetic sandbox record</div>
          </div>
          <div className="spacer" />
          {listening ? <span className="badge live"><span className="dot" /> Listening · microphone</span>
           : playing ? <span className="badge live"><span className="dot" /> Listening · demo</span>
                     : <span className="badge">Ambient scribe · {voiceUsed ? "browser speech" : "on-device"}</span>}
          <span className="badge">SMART on FHIR · sandbox</span>
        </div>

        <div className="brandrow">
          <div className="mark"><Sparkles size={18} /></div>
          <div>
            <div className="t1">{scribeCopy.title} <span className="num" style={{fontSize:12,color:"var(--muted)",fontWeight:400}}>v{appVersion}</span></div>
            <div className="t2">{scribeCopy.subtitle}</div>
          </div>
        </div>

        <div className="grid">
          {/* LEFT — live encounter */}
          <div className="card" data-testid="scribe-encounter">
            <div className="chdr"><MessageSquare size={16} color="var(--petrol)" /><div><div className="ce">Live</div><div className="ct">Encounter</div></div></div>
            {!hasLexicon && (
              <div className="sa-scribe-notice" data-testid="scribe-no-lexicon" role="note">
                <Info size={13} style={{flex:"0 0 auto",marginTop:1}} /><span>{NO_LEXICON_NOTICE}</span>
              </div>
            )}
            <div className="transport" data-testid="scribe-transport">
              {hasLexicon && (listening
                ? <button className="tbtn rec" onClick={stopVoice} data-testid="scribe-stop"><Square size={15} /> Stop listening</button>
                : <button className="tbtn" onClick={startVoice} disabled={!canListen} data-testid="scribe-listen"
                          title={listenTitle}>
                    <Mic size={15} /> Listen</button>)}
              {hasScript && (!playing
                ? <button className="tbtn" onClick={() => setPlaying(true)} disabled={cursor >= script.length} data-testid="scribe-play"><Play size={15} /> {cursor === 0 ? "Play demo visit" : "Resume"}</button>
                : <button className="tbtn" onClick={() => setPlaying(false)} data-testid="scribe-pause"><Pause size={15} /> Pause</button>)}
              {hasScript && <button className="tbtn ghost" onClick={stepOnce} disabled={cursor >= script.length || playing} data-testid="scribe-step"><ArrowRight size={15} /> Step</button>}
              <button className="tbtn ghost" onClick={reset} data-testid="scribe-reset"><RotateCcw size={15} /> Reset</button>
            </div>

            {hasLexicon && voiceSupported && !secure && (
              <div className="voice" data-testid="scribe-insecure">
                <div className="verr"><TriangleAlert size={13} style={{flex:"0 0 auto",marginTop:2}} /><span>{VOICE_ERRORS.insecure}</span></div>
              </div>
            )}

            {(listening || voiceErr) && (
              <div className="voice" aria-live="polite" data-testid="scribe-voice">
                <div className="vrow">
                  <span className={"vstate" + (listening ? " on" : "")} data-testid="scribe-voice-state">
                    {voiceState === "starting" ? "Starting microphone…" : listening ? `Listening · ${voiceLang}` : "Stopped"}
                  </span>
                  {listening && <VoiceMeter bind={bindLevel} />}
                  <div className="spk" role="radiogroup" aria-label="Who is speaking">
                    <button className={"spkb" + (speaker === "pt" ? " on" : "")} role="radio" aria-checked={speaker === "pt"} onClick={() => setSpeaker("pt")}><User size={13} /> Patient</button>
                    <button className={"spkb" + (speaker === "md" ? " on" : "")} role="radio" aria-checked={speaker === "md"} onClick={() => setSpeaker("md")}><Stethoscope size={13} /> Physician</button>
                  </div>
                </div>
                {voiceErr && <div className="verr" data-testid="scribe-voice-error"><TriangleAlert size={13} style={{flex:"0 0 auto",marginTop:2}} /><span>{voiceErr.message}</span></div>}
                {listening && !voiceErr && (speaker === "md"
                  ? <div className="vhint">Physician turn — transcribed, not captured. Switch to Patient before they answer.</div>
                  : <div className="vhint">Patient turn — each committed phrase is captured as it lands. Switch to Physician while you speak so your questions are not read as their symptoms.</div>)}
              </div>
            )}

            <div className="tsc" ref={scrollRef} data-testid="scribe-transcript">
              {hasLexicon && !hasContent && !interim && <div className="empty">
                {voiceSupported && secure ? <>Press <b>Listen</b> to capture the encounter from the microphone, </> : <>Press </>}
                {hasScript ? <><b>Play demo visit</b> to watch a scripted one — or type what the patient says below.</> : <>or type what the patient says below.</>}</div>}
              {transcript.map(m => (
                <div key={m.id}>
                  <div className={"row " + m.role}>
                    <div style={{maxWidth:"82%"}}>
                      <div className="who" style={{textAlign: m.role === "md" ? "right" : "left"}}>{m.role === "md" ? "Physician" : "Patient"}{m.src === "voice" ? " · voice" : ""}</div>
                      <div className="bub">{m.text}</div>
                      {m.caps.length > 0 && (
                        <div className="cap">
                          {m.caps.map((c, i) => <span className="captag" key={i}>+ {captureLabel(module, c)}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {interim && (
                <div className={"row " + speaker} data-testid="scribe-interim">
                  <div style={{maxWidth:"82%"}}>
                    <div className="who" style={{textAlign: speaker === "md" ? "right" : "left"}}>{speaker === "md" ? "Physician" : "Patient"} · hearing…</div>
                    <div className="bub interim">{interim}</div>
                    {previewCaps.length > 0 && (
                      <div className="cap">
                        {previewCaps.map((c, i) => <span className="captag pending" key={i}>? {captureLabel(module, c)}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {hasLexicon && (
              <div className="entry">
                <input value={input} placeholder="Type a patient statement…" onChange={e => setInput(e.target.value)}
                       onKeyDown={e => e.key === "Enter" && submitInput()} data-testid="scribe-input" />
                <button className="mini" onClick={submitInput} data-testid="scribe-capture"><Plus size={14} /> Capture</button>
              </div>
            )}
            {hasLexicon && (
              <div className="notew"><Info size={13} style={{flex:"0 0 auto",marginTop:1}} /><span>
                Rule-based capture for the prototype. With the microphone on, transcription is the browser's own speech
                recognition ({VOICE_ENGINE.split(" — ")[0]}): Chrome and Edge send audio to the vendor's speech service for that step,
                Safari may process on-device. This app retains no audio — only text and structured findings, in this tab.
                A deployment plugs in ambient ASR + clinical NLP at the edge.</span></div>
            )}
          </div>

          {/* RIGHT — screen + prompts */}
          <div className="card" data-testid="scribe-screen">
            <div className="chdr"><Activity size={16} color="var(--petrol)" /><div><div className="ce">Live screen</div><div className="ct">{copy.indexName}</div></div></div>

            {module.origin !== "builtin" && <div className="sa-scribe-prov"><ProvenanceBadge module={module} audience="clinician" variant="full" /></div>}

            <div className="readout" data-testid="scribe-readout">
              <div><div className="score" key={scorable ? `t${total}` : `r${floor}-${ceiling}`} style={{color:bandMeta.c,fontSize:scorable?undefined:38}}>
                {scorable ? total : `${floor}–${ceiling}`}
              </div></div>
              <div style={{flex:"1 1 auto"}}>
                <span className="pill" style={{color:bandMeta.c,background:bandMeta.bg}}>
                  {scorable
                    ? <><Activity size={13} /> {bandMeta.l} likelihood</>
                    : <><TriangleAlert size={13} /> {bandMeta.l} yet — range spans a cutpoint</>}
                </span>
                <div className="covrow">
                  <span className="num" style={{fontSize:11,color:"var(--muted)"}}>coverage {coverage}%</span>
                  <div className="covtrack"><div className="covfill" style={{width:coverage+"%"}} /></div>
                </div>
              </div>
            </div>

            <div style={{marginTop:12}} data-testid="scribe-domains">
              {module.domainOrder.map(k => (
                <div className={"dbar" + (pulse.domains.includes(k) ? " hit" : "")} key={k}>
                  <div className="dl">{domains[k].label}</div>
                  <div className="dtrack"><div className="dfill" style={{width:domains[k].pct+"%"}} /></div>
                  <div className="dpts num">{domains[k].pts}/{domains[k].max}</div>
                </div>
              ))}
            </div>

            {gapAlert && (
              <div className="alert" data-testid="scribe-gap">
                <TriangleAlert size={17} color="#B26C1F" style={{flex:"0 0 auto",marginTop:1}} />
                <div><div className="at">{scribeCopy.gapAlert && scribeCopy.gapAlert.title}</div><div className="ap">{gapFlags.join(" · ")}. {scribeCopy.gapAlert && scribeCopy.gapAlert.body}</div></div>
              </div>
            )}

            {override && (
              <div className="override" data-testid="scribe-override">
                <div className="ot"><TriangleAlert size={18} /> Red flag — routing withheld</div>
                <div className="os">
                  {emergent ? "Needs same-day evaluation." : "Expedited workup — days, not weeks."} The index is retained but proposes nothing.
                </div>
                {activeFlags.map(f => (
                  <div className="oitem" key={f.id}>
                    <b>{f.text}</b>{f.points} — <span className="oact">{f.action}</span>
                  </div>
                ))}
              </div>
            )}
            {!override && !safetyReviewed && (
              <div className="alert" style={{marginTop:10}} data-testid="scribe-safety-outstanding">
                <ShieldCheck size={17} color="#B26C1F" style={{flex:"0 0 auto",marginTop:1}} />
                <div><div className="at">Safety check outstanding</div>
                  <div className="ap">No routing is issued until the red-flag review is recorded. Open the Safety tab.</div></div>
              </div>
            )}

            {/* view switch */}
            <div className="btnrow" style={{marginTop:14}} data-testid="scribe-views">
              <button className={"act" + (view === "safety" ? "" : " ghost")} onClick={() => setView("safety")} data-testid="scribe-view-safety">
                {override ? <TriangleAlert size={15} /> : <ShieldCheck size={15} />} Safety {override ? `(${activeFlags.length})` : safetyReviewed ? "✓" : "!"}
              </button>
              <button className={"act" + (view === "prompts" ? "" : " ghost")} onClick={() => setView("prompts")} data-testid="scribe-view-prompts"><HelpCircle size={15} /> Ask next {suggestions.length ? `(${suggestions.length})` : ""}</button>
              <button className={"act" + (view === "note" ? "" : " ghost")} onClick={() => setView("note")} data-testid="scribe-view-note"><FileText size={15} /> Note</button>
              <button className={"act" + (view === "fhir" ? "" : " ghost")} onClick={() => setView("fhir")} data-testid="scribe-view-fhir"><FileJson size={15} /> FHIR</button>
            </div>

            {view === "safety" && (
              <div style={{marginTop:6}} data-testid="scribe-safety">
                <div className="notew" style={{marginTop:0}}><Info size={13} style={{flex:"0 0 auto",marginTop:1}} />
                  <span>Ambient capture can raise a flag but never clear one. Absence of a cue is not evidence of absence — confirm the review yourself.</span></div>
                {module.redFlags.map(f => (
                  <div key={f.id} className={"rf" + (rf[f.id] ? " on" : "")} data-flag={f.id}
                       role="checkbox" aria-checked={!!rf[f.id]} tabIndex={0}
                       onClick={() => setRf(v => { const n = { ...v }; if (n[f.id]) delete n[f.id]; else n[f.id] = "md"; return n; })}
                       onKeyDown={e => (e.key === "Enter" || e.key === " ") && setRf(v => { const n = { ...v }; if (n[f.id]) delete n[f.id]; else n[f.id] = "md"; return n; })}>
                    <div className="box">{rf[f.id] && <Check size={12} />}</div>
                    <div>
                      <div className="rt">{f.text}<span className={"tier " + f.tier}>{f.tier}</span>
                        {rf[f.id] === "nlp" && <span className="tier heard">heard in encounter</span>}</div>
                      <div className="rm">{f.points} · {f.action}</div>
                    </div>
                  </div>
                ))}
                {!override && (
                  <div className="btnrow" style={{marginTop:12}}>
                    <button className={"act" + (safetyReviewed ? "" : " ghost")} onClick={() => setSafetyReviewed(v => !v)} data-testid="scribe-review">
                      {safetyReviewed ? <Check size={14} /> : <ShieldCheck size={14} />} {safetyReviewed ? "Review recorded" : "Record: none of these apply"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {view === "prompts" && (
              <div style={{marginTop:6}} data-testid="scribe-prompts">
                {suggestions.length === 0 && (
                  <div className="empty">{scorable
                    ? "No high-yield questions outstanding for the active pathway. Screen looks well covered."
                    : "Every scored item is answered but the index still spans a cutpoint — review the captured answers before issuing a result."}</div>
                )}
                {/* contextual probes first — a question that could surface a red flag
                    outranks one that could add points */}
                {probeGroups.length > 0 && (
                  <div style={{marginBottom:12}} data-testid="scribe-probes">
                    {probeGroups.map(({ kind, shown, total: groupTotal }) => (
                      <div key={kind}>
                        <div className="qtag" style={{color:PROBE_KIND[kind].c,margin:"10px 0 4px"}}>
                          {PROBE_KIND[kind].label}
                          {PROBE_KIND[kind].caption}
                        </div>
                        {shown.map(pr => (
                          <div className="prompt" key={pr.id} data-probe={pr.id}
                            style={{borderLeft:`3px solid ${PROBE_KIND[pr.kind].c}`}}>
                            {pr.rescues && answers[pr.rescues] !== undefined && (
                              <div className="qtag" style={{color:PROBE_KIND.rescue.c}}>
                                re-asking {module.itemById[pr.rescues] ? itemShort(module.itemById[pr.rescues]) : pr.rescues} — recorded as {String(answers[pr.rescues]) === "no" ? "denied" : `"${String(answers[pr.rescues])}"`}
                              </div>
                            )}
                            <div className="qq">{pr.say}{probeErrorIds.has(String(pr.id)) && <span className="sa-scribe-evalerr" title="This probe's trigger failed to evaluate; it is shown rather than hidden.">evaluation error</span>}</div>
                            <div className="qtag" style={{textTransform:"none",letterSpacing:0,marginTop:4}}>{pr.why}</div>
                            <div className="prow">
                              {pr.opts.map((o, i) => (
                                <button key={i} className={"pbtn" + (o.rf ? " n" : "")} onClick={() => answerProbe(pr, i)}>{o.l}</button>
                              ))}
                            </div>
                          </div>
                        ))}
                        {shown.length < groupTotal && (
                          <div className="empty" style={{padding:"4px 0"}}>
                            +{groupTotal - shown.length} more — answer one and the next moves up.
                            Safety and re-ask probes are never truncated.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div data-testid="scribe-suggestions">
                {suggestions.map(s => (
                  <div className="prompt" key={s.id} data-suggestion={s.id}>
                    <div className="qtag"><HelpCircle size={11} /> {s.tag}{s.kind === "info" ? " · not scored" : ""}</div>
                    <div className="qq">{s.ask}</div>
                    <div className="prow">
                      {s.scale
                        ? s.scale.map((o, i) => <button key={i} className="pbtn" onClick={() => answerPrompt(s, i)}>{o.label}</button>)
                        : (<>
                            <button className="pbtn y" onClick={() => answerPrompt(s, "yes")}>Yes</button>
                            <button className="pbtn n" onClick={() => answerPrompt(s, "no")}>No</button>
                          </>)}
                      <button className="pbtn skip" onClick={() => skipPrompt(s)} data-testid="scribe-skip">Skip</button>
                    </div>
                  </div>
                ))}
                </div>
                {/* routing recommendations — cleared safety, settled non-lowest band only; the
                    engine rule-error card whenever a module rule failed */}
                {(ruleErrorShown || (routingCleared && scorable && band !== LOWEST_BAND)) && (
                  <div style={{marginTop:14}} data-testid="scribe-recs">
                    {recs.map((r, i) => (
                      <div className="rec" key={i} data-rec={r.id}>
                        <h4>{r.h}</h4><p>{r.p}</p>
                        {r.chips.length > 0 && <div className="chips">{r.chips.map((c, j) => <span className="chip" key={j}>{c}</span>)}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === "note" && (
              <div style={{marginTop:8}}>
                <div className="note" data-testid="scribe-note">{note}</div>
                <div className="btnrow">
                  <button className="act ghost" onClick={() => { try { navigator.clipboard.writeText(note); } catch(_){} setToast("Note copied"); }}><Copy size={14} /> Copy note</button>
                  <button className="act" disabled={!canSign} data-testid="scribe-sign"
                    title={!canSign ? "Record the red-flag review first — the note currently states that it is outstanding" : ""}
                    onClick={() => setToast("Signed to chart (simulated)")}><Check size={14} /> Sign to chart</button>
                  {!canSign &&
                    <span className="empty" style={{padding:"0 4px",alignSelf:"center"}} data-testid="scribe-sign-blocked">Safety review outstanding — the note says so, so signing is blocked.</span>}
                </div>
              </div>
            )}

            {view === "fhir" && (<>
              <div className="btnrow" style={{marginBottom:10,flexWrap:"wrap"}}>
                <button className="act ghost" onClick={captureScreen} data-testid="scribe-append"><Plus size={14}/> Append screen to cohort</button>
                <button className="act ghost" disabled={!cohort.length} onClick={()=>downloadText(`${filePrefix}-pilot-cohort-${new Date().toISOString().slice(0,10)}.csv`, rowsToCsv(cohort), "text/csv")}><Download size={14}/> Export ({cohort.length})</button>
                <button className="act ghost" onClick={()=>downloadJsonFile(`${filePrefix}-questionnaire-v${instrument}.json`, buildQuestionnaire(module))}><Download size={14}/> Questionnaire</button>
                <button className="act ghost" onClick={()=>downloadJsonFile(`${filePrefix}-cds-hooks.json`, buildCdsHooks(module))}><Download size={14}/> CDS Hooks</button>
                <button className="act ghost" onClick={()=>downloadJsonFile(`${filePrefix}-data-dictionary-v${instrument}.json`, buildDataDictionary(module, { appVersion }))}><Download size={14}/> Dictionary</button>
              </div>
              <div style={{marginTop:8}}>
                <pre className="code" data-testid="scribe-bundle" dangerouslySetInnerHTML={{ __html: fhirHtml(bundle) }} />
                <div className="btnrow">
                  <button className="act ghost" onClick={() => { try { navigator.clipboard.writeText(JSON.stringify(bundle,null,2)); } catch(_){} setToast("FHIR bundle copied"); }}><Copy size={14} /> Copy bundle</button>
                  <button className="act" onClick={() => setToast("Posted to FHIR server (simulated)")}><FileJson size={14} /> Post bundle</button>
                </div>
              </div>
            </>)}

            {scribeCopy.vmpathiDisclaimer && <div className="notew"><ShieldCheck size={13} style={{flex:"0 0 auto",marginTop:1}} /><span>{scribeCopy.vmpathiDisclaimer}</span></div>}
          </div>
        </div>

        {aboutLines.length > 0 && (
          <details className="about card" style={{marginTop:14}}>
            <summary><Info size={14} /> How the scribe fits the visit <ChevronDown className="chev" size={14} /></summary>
            <div className="abgrid">
              {aboutLines.map((line, i) => <div key={i}><Rich text={line} /></div>)}
            </div>
          </details>
        )}

        {/* The readiness panel moved to the Research tab (AD8). */}
        <div className="card sa-scribe-link" data-testid="scribe-research-link">
          <div className="sa-scribe-linktext">
            Research readiness for this screen — calibration, validation, fairness and the model card — is in the <b>Research</b> tab. Captured this session: <span className="num">{cohort.length}</span>.
          </div>
          {onOpenTab && <button className="act ghost" onClick={() => cb.current.onOpenTab && cb.current.onOpenTab("research")} data-testid="scribe-open-research"><ArrowRight size={14} /> Open Research</button>}
        </div>

        <p className="foot" data-testid="scribe-footer">PROTOTYPE · not for clinical use · {voiceUsed
          ? "microphone capture via the browser's speech service · this app stores no audio and no PHI"
          : "ambient capture is simulated · no PHI leaves this browser"}<br/>app {appVersion} · instrument {versions.instrument ?? instrument} · extraction lexicon {versions.lexicon ?? "—"} · probe set {versions.probeSet ?? "—"}{benchmark}</p>
      </div>
      {toast && <div className="toast" data-testid="scribe-toast"><Check size={15} /> {toast}</div>}
      </div>
    </div>
  );
}

// ------------------------- helpers --------------------------------------------

/*  Microphone level bar. Holds its own state so the ~15 Hz level ticks re-render this
    one element rather than the whole scribe. `bind` hands it the setter; the voice module
    sends null once if the meter cannot run, and the bar simply disappears.
*/
function VoiceMeter({ bind }) {
  const [level, setLevel] = useState(0);
  useEffect(() => { bind(setLevel); return () => bind(null); }, [bind]);
  if (level === null) return null;
  return (
    <div className="vmeter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} data-testid="scribe-meter">
      <div className="vfill" style={{width: Math.round(level * 100) + "%"}} />
    </div>
  );
}
