import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Play, Pause, RotateCcw, ArrowRight, Stethoscope,
  Activity, ShieldCheck, TriangleAlert, HelpCircle, Check, Copy, FileJson,
  FileText, Sparkles, User, MessageSquare, ChevronDown, Info, Plus, Download, ClipboardList, ListChecks
} from "lucide-react";
import { createVoiceCapture, isVoiceSupported, isSecureForMicrophone, VOICE_ENGINE, VOICE_LANG, VOICE_ERRORS } from "../MASQUE_Voice.js";
import { computeScore } from "../engine/scoring.js";
import { createExtractor } from "../engine/extraction.js";
import { liveProbes, truncateProbes } from "../engine/probes.js";
import { ingestCaptures, rankSuggestions, captureLabel, itemShort, buildNote, heardPrompts, askNextSections, clarifyPrompts, clarifyLabel, questionReview, REVIEW_SOURCE, retractProbeAnswers, probeNoteList } from "../engine/scribe.js";
import { derivePhenotype, activeFlagsOf, buildRoutingState, routingRecs, gapSignals } from "../engine/rules.js";
import { routingGate, signGate } from "../engine/gates.js";
import { buildBundle, buildQuestionnaire, buildCdsHooks, buildDataDictionary } from "../engine/fhir.js";
import { screenToCohortRow, rowsToCsv } from "../engine/cohort.js";
import { downloadText, downloadJsonFile, fhirHtml } from "../engine/download.js";
import { EMR_UI, buildEmrTemplate, emrFrameDoc } from "../engine/emr.js";
import { scopeCss } from "../engine/css.js";
import { richText } from "../engine/patient.js";
import { PROBE_KIND, LOWEST_BAND, INDETERMINATE, CAPTURE_KIND } from "../engine/vocab.js";
import { APP_VERSION, SITE } from "../engine/policy.js";
import { ProvenanceBadge, TabNote } from "../ui/common.jsx";

/*  apps/Scribe.jsx — the generic Ambient Scribe (design 03 §5.4, §9.9). Owner: WP8.

    Ported from the baseline Scribe component (Scb L727-1297, VoiceMeter included). The DOM
    structure, the class names and the CSS are the baseline's; every module-specific value
    comes from the bound `module` prop and every computation from the engine:

      capture       createExtractor(module.lexicon).extractInContext → ingestCaptures
                    (raise-only red flags, first-wins items, heard captures ignored); interim
                    speech is only ever previewed
      suggestions   rankSuggestions (the pool widens while the screen is not scorable; items
                    shown as heard prompts are excluded)
      probes        liveProbes / truncateProbes over module.logic.probes.list
      ask next      askNextSections: Safety probes, then heardPrompts, then the other probes
      routing       routingGate → buildRoutingState → routingRecs; a throwing phenotype or
                    routing rule withholds routing behind the engine rule-error card
      note, bundle  buildNote / buildBundle on the scribe surface; signGate gates signing
      EMR template  buildEmrTemplate on the scribe surface (release 0.4.3): the "EMR Friendly
                    Template" button next to Sign to chart toggles a panel (EmrPanel) with the
                    plain-text consult-note template in a script-free iframe

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

    Heard and carry-over (design 05 §2, §3). Every patient line, typed, demo or voice, goes
    through ingest, which calls extractInContext with the one pending slot (pendingRef, a ref,
    never state). A cue heard without its value records nothing: it shows as a dashed heard tag
    on its bubble (kept for that line) and as a Heard card in Ask next, after the Safety probes
    and before the Re-ask probes, until the item is answered or skipped. The entry's next
    patient replies, up to its carry, may supply the value; that reply's tag says "follow-up
    to" the cue. Physician lines, blank segments and interim text never consume a reply. An
    item answered or skipped meanwhile keeps its slot, read with { carry: false }: the slot
    still counts replies down and still holds yields for the rest of its window, but nothing
    is carried into it (a skipped item is never carried). A heard capture for an item already
    answered is dropped before storing.
    The heard list is derived from the transcript; Reset and a module change clear the slot.

    Typed text and Clarify (release 0.4.7, spec 0.4.7 §3.8, §5). The entry box is a textarea
    that takes a statement or a whole pasted chart note: Enter is a newline, Ctrl/Cmd+Enter
    captures (never while an IME is composing), and the bubble keeps the note's line breaks.
    Typed text is clinician/chart text: it is read with { chart: true }, so it never consumes,
    carries into or arms the carry-over slot (voice and demo lines keep the path above), an
    attribution cue the lexicon lists in clauses.chartIgnoreThirdParty (a pronoun that names the
    patient in a chart note) attributes nothing, and no context marker is captured from it (the
    clinical lead's D8 answer of 2026-10-12: the clinician sets them). Since the lead's decision D9
    of 2026-10-12 voice and demo lines are read with the lexicon's chart reading too (the extractor's
    "Spoken lines"); they keep the carry-over path above and are never read for clarification. Its clarification cues (extractor.clarifyCues,
    also { chart: true }) are stored on its transcript line, shown as clarify tags on the bubble
    (never a captag: nothing was recorded) and as cards in the Clarify section under the box,
    built by clarifyPrompts over every typed line in transcript
    order (one card per target, the earliest open one first). A card shows the clause quoted,
    the question and one button per answer option: a probe card answers through answerProbe
    (flags raise-only, the EMR template's "recorded by clinician via probe" label unchanged), an
    item card through answerPrompt; Skip dismisses the card and records nothing. The template-text
    card (a placeholder cue, review round 2) is a notice, not a question: it quotes the line and the
    lexicon's notice text, with one Dismiss control and no answers. A card leaves once answered,
    skipped or dismissed, and Reset clears them. While a card is open, its probe leaves the
    Ask next rail and its item leaves the suggestions and the heard cards, so nothing is asked
    twice. The Clarify chrome is generic: every question and answer label is module data.

    Question review (release 0.4.8, follow-up: the clinical lead's request of 2026-10-12). The view
    switch is a tab list (role tablist / tab / tabpanel, the selected tab in the tab order, the arrow
    keys, Home and End move between tabs): Safety, Ask next, Question review, Note, FHIR. The default
    view is unchanged (Safety); Question review sits right of Ask next and never opens by itself. It
    lists every scored item once, by domain (questionReview), with its question and short label as
    Ask next shows them, its current answer ("not answered" when absent or unsure, never no) and the
    source this session recorded for that answer (answerSrc, REVIEW_SOURCE: heard in encounter,
    typed chart text, probe, Clarify card, Ask next, question review edit; a skipped item says it was
    skipped). Each row offers the item's own answers and "Clear answer". An answer goes through
    answerPrompt, the path of the Ask next cards, so the score, coverage, suggestions, probes, Clarify
    cards, the encounter note, the bundle and the EMR template follow; clearing deletes the answer
    (and its skip, so Ask next can ask it again): the item is unanswered, never no. A change or a
    clear also retracts the probe answer whose option wrote the item (retractProbeAnswers, review
    fix): the probe notes are derived from the probe answers on record (probeNoteList), so neither
    the encounter note nor the EMR template keeps a probe's note or checklist entry that contradicts
    the corrected answer, and the probe can be asked again while it is live. A row whose current
    answer came from the review carries an "edited" chip and what was first recorded; an unanswered
    row the clinician then skipped in Ask next says so, whatever source was recorded (review fix);
    the notes keep their format. Reset clears the record; the dirty summary counts its edits.

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
// notices, the probe evaluation-error tag and the heard tag and card (design 05 §2.2), the
// entry textarea, the patient bubble's line breaks, the clarify tag and the Clarify section
// (release 0.4.7). Classes carry the sa-scribe- prefix.
const SCRIBE_EXTRA_CSS = `
.sa-scribe-link{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:14px}
.sa-scribe-link .sa-scribe-linktext{flex:1 1 260px;font-size:12.5px;color:#33474A}
.sa-scribe-notice{display:flex;gap:7px;align-items:flex-start;font-size:12px;color:#6B4A18;background:var(--amberbg);border:1px solid #E4C88E;border-radius:10px;padding:9px 11px;margin:0 0 12px}
.sa-scribe-evalerr{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:#8E3520;background:var(--coralbg);border-radius:5px;padding:2px 6px;margin-left:6px}
.sa-scribe-prov{margin-bottom:10px}
.sa-scribe-heardtag{background:#fff;border:1px dashed var(--amber);border-radius:6px;padding:2px 6px;color:#7A4E12}
.sa-scribe-heardtag.pending{opacity:.72}
.prompt.sa-scribe-heard{border-left-style:dashed}
.sa-scribe-emr{margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:11px;background:#F7FAF9}
.sa-scribe-emr-hint{margin:0 0 8px;font-size:11.5px;color:var(--muted);line-height:1.45}
.sa-scribe-emr-frame{display:block;box-sizing:border-box;width:100%;height:380px;border:1px solid var(--line);border-radius:10px;background:#fff}
.entry.sa-scribe-entry{flex-direction:column;align-items:stretch}
.sa-scribe-entry textarea{display:block;width:100%;min-height:200px;max-height:60vh;resize:vertical;overflow:auto;font:inherit;font-size:13px;line-height:1.45;padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4}
.sa-scribe-entry textarea:focus{outline:2px solid var(--petrol2);outline-offset:1px}
.sa-scribe-entry .mini{align-self:flex-end}
.row.pt .bub{white-space:pre-wrap;overflow-wrap:anywhere}
.sa-scribe-clarifytag{background:#fff;border:1px dotted var(--amber);border-radius:6px;padding:2px 6px;color:#7A4E12}
.sa-scribe-clarify{margin-top:12px}
.sa-scribe-clarify .sa-scribe-clarify-cap{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--amber);font-weight:700;margin:0 0 4px}
.prompt.sa-scribe-clarify-card{border-left-style:dotted;margin-top:7px}
.sa-scribe-clarify-card .sa-scribe-clarify-tag{text-transform:none;letter-spacing:0}
.sa-scribe-clarify-quote{margin:0 0 6px;padding:4px 8px;border-left:2px solid var(--line);font-size:12px;color:#33474A;white-space:pre-wrap;overflow-wrap:anywhere}
.sa-scribe-clarify-quote .sa-scribe-clarify-and{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-right:4px}
.sa-scribe-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.sa-scribe-qr-domain{margin-top:12px}
.sa-scribe-qr-dlabel{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--petrol);font-weight:700;margin:0 0 2px}
.sa-scribe-qr-row{border:1px solid var(--line);border-left:3px solid var(--line);border-radius:0 11px 11px 0;background:#fff;padding:9px 12px;margin-top:7px}
.sa-scribe-qr-row.on{border-left-color:var(--petrol2)}
.sa-scribe-qr-row.edited{border-left-color:var(--amber)}
.sa-scribe-qr-tag{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;color:var(--muted);margin-bottom:2px;overflow-wrap:anywhere}
.sa-scribe-qr-q{font-size:13px;font-weight:560;margin-bottom:5px;overflow-wrap:anywhere}
.sa-scribe-qr-state{font-size:12px;color:#33474A;margin-bottom:7px;display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center}
.sa-scribe-qr-answer{font-weight:650}
.sa-scribe-qr-answer.none{font-weight:500;font-style:italic;color:var(--muted)}
.sa-scribe-qr-src{color:var(--muted)}
.sa-scribe-qr-edited{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;background:var(--amberbg);color:#7A4E12;border-radius:5px;padding:2px 6px}
.sa-scribe-qr-first{font-size:11.5px;color:var(--muted);margin:-3px 0 7px;overflow-wrap:anywhere}
.sa-scribe-qr-row .pbtn.sa-scribe-qr-on{background:var(--petrol);color:#fff;border-color:var(--petrol)}
.sa-scribe-qr-row .pbtn:disabled{opacity:.45;cursor:not-allowed}
`;

const CSS = scopeCss(SCRIBE_CSS, ".sa-scribe") + scopeCss(SCRIBE_EXTRA_CSS, ".sa-scribe");

// Engine chrome (design §3.5, §5.3, §5.4, §7.5). English, non-clinical.
const NO_LEXICON_NOTICE = "This module has no extraction lexicon: speech and typed statements cannot be captured into the screen. Use the prompts.";
const MIC_OFF_TITLE = "The microphone is off while a patient-facing view is shown.";
const LIVE_STATES = ["starting", "listening", "restarting"];
// The Ask next group of items the patient named without a value (design 05 §2.1).
const HEARD_LABEL = "Heard";
const HEARD_CAPTION = " · named by the patient, value not stated — nothing is recorded until it is answered";
// The entry box and the Clarify section (release 0.4.7; generic wording, approved by the clinical
// lead on 2026-10-12 with the 0.4.7 sign-off list, part C). The hint lives in attributes only: no
// new text node in the encounter card while Clarify is empty.
const INPUT_PLACEHOLDER = "Type a patient statement or paste a chart note (H&P) — Ctrl+Enter to capture";
const INPUT_LABEL = "Patient statement or chart note";
const CAPTURE_TITLE = "Capture (Ctrl+Enter)";
const CLARIFY_LABEL = "Clarify";
// Review round 1: worded to hold for every card reason (unclear, hedged, stated both ways, template text).
const CLARIFY_CAPTION = " · the text leaves these open; nothing is recorded until you answer";
// The always-mounted status a screen reader announces when cards appear or leave (review round 1);
// review round 2: a template-text notice is counted as a notice, not a question.
const clarifyStatus = (q, n) => [q > 0 ? `${q} ${q === 1 ? "question" : "questions"} to clarify` : "", n > 0 ? `${n} ${n === 1 ? "notice" : "notices"}` : ""]
  .filter(Boolean).join(", ");
// The template-text notice's one control (review round 2: a notice with Dismiss, no answers, no Skip).
const DISMISS_LABEL = "Dismiss";
// Why a card is shown (clarifyCues reason), in the card's tag line.
const CLARIFY_REASON = { trigger: "unclear", hedge: "hedged", conflict: "stated both ways", placeholder: "template text" };
const CLARIFY_AND = "and";
// The Question review (release 0.4.8, follow-up; English UI chrome, non-clinical): the view's tab
// label, its explanation line, and the words of a row. The source names are the engine's
// (REVIEW_SOURCE). The view switch's tab order: the review sits right of Ask next.
const VIEWS = ["safety", "prompts", "review", "note", "fhir"];
const VIEWS_LABEL = "Encounter views";
const REVIEW_LABEL = "Question review";
const REVIEW_INTRO = "Every scored item, with its current answer and where it came from. Change or clear an answer here: the score, coverage, suggestions, encounter note and EMR template follow. Not answered is never a no.";
const REVIEW_NOT_ANSWERED = "not answered";
const REVIEW_SKIPPED = "skipped in Ask next";
const REVIEW_CLEAR = "Clear answer";
const REVIEW_EDITED = "edited";
const REVIEW_FIRST = "First recorded:";

const BAND_META = {
  low: { c: "var(--green)", bg: "var(--greenbg)", l: "Low" },
  moderate: { c: "var(--amber)", bg: "var(--amberbg)", l: "Moderate" },
  high: { c: "var(--coral)", bg: "var(--coralbg)", l: "High" },
  [INDETERMINATE]: { c: "var(--slate)", bg: "#E3EAE9", l: "Not scorable" },
};

const RULE_ERROR_CARD_ID = "engine:rule-error";

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

/**
 * The transcript tag stored on a line for one engine capture (design 05 §2.2):
 *   heard  {id, kind: "heard", cueText}
 *   carry  {id, value, kind: "item", via: "carry", fromCueText}   (the cue text it followed up)
 *   other  {id, value, kind}, as before
 */
function toTag(c) {
  if (c.kind === CAPTURE_KIND.HEARD) return { id: c.id, kind: CAPTURE_KIND.HEARD, cueText: c.cueText };
  if (c.via === "carry") {
    return { id: c.id, value: c.value, kind: CAPTURE_KIND.ITEM, via: "carry", fromCueText: c.carriedFrom ? c.carriedFrom.cueText : undefined };
  }
  return { id: c.id, value: c.value, kind: c.kind };
}

/**
 * The clarification cue stored on a typed line (release 0.4.7): the clarifyCues record as
 * returned (kind "clarify", id, reason, probe | item, evidence, clause, cueIndex, cueText,
 * against), copied so the line never shares objects with the engine.
 */
function toClarifyTag(q) {
  const out = { kind: q.kind, id: q.id, reason: q.reason, evidence: q.evidence, clause: q.clause ? { ...q.clause } : undefined, cueIndex: q.cueIndex, cueText: q.cueText };
  if (typeof q.probe === "string") out.probe = q.probe;
  if (typeof q.item === "string") out.item = q.item;
  if (q.against) out.against = { ...q.against, clause: q.against.clause ? { ...q.against.clause } : undefined };
  return out;
}

/**
 * A Clarify answer button's class, as the same question's button in Ask next: a probe option that
 * raises a flag " n"; an item card's Yes " y" and No " n"; a scale option or any other "".
 */
function clarifyButtonClass(cl, o) {
  if (o.rf) return " n";
  if (cl.kind === "item" && !Array.isArray(cl.scale)) return o.value === "yes" ? " y" : o.value === "no" ? " n" : "";
  return "";
}

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

  const [transcript, setTranscript] = useState([]);   // {id, role, text, src, caps:[toTag(capture)], clar:[toClarifyTag(cue)]}
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
  // The notes of the probe answers on record (release 0.4.8, follow-up; review fix): derived from
  // probeAns in the order answered, so a probe answer the Question review retracts takes its note
  // with it (it was an append-only list).
  const probeNotes = useMemo(() => probeNoteList(module, probeAns), [module, probeAns]);
  const [input, setInput] = useState("");
  const [clarifyDismissed, setClarifyDismissed] = useState({}); // clarify card id -> true (Skip: nothing recorded)
  // Question review (release 0.4.8, follow-up): where this session recorded each item's current
  // answer, item id -> {src: REVIEW_SOURCE key, first?: {value, src}} (first: the answer and source
  // before the first review edit). Display only: no score, note or bundle reads it.
  const [answerSrc, setAnswerSrc] = useState({});
  const reviewUid = React.useId();
  const viewUid = React.useId();
  const tabRefs = useRef({});
  // Clarify focus (review round 1): after a card is answered or skipped, focus moves to the card now
  // at its place (else the one before it), or back to the text box when none is left.
  const clarifyUid = React.useId();
  const clarifyRef = useRef(null);
  const inputRef = useRef(null);
  const clarifyFocusRef = useRef(null);
  const [view, setView] = useState("safety");          // safety | prompts | note | fhir
  const [showEmr, setShowEmr] = useState(false);       // the EMR Friendly Template panel (0.4.3)
  const [toast, setToast] = useState("");
  const scrollRef = useRef(null);

  // Carry-over (design 05 §3.1, §3.4): the one pending slot, a ref because it never renders by
  // itself, and synchronous mirrors of the answers and skips, so back-to-back voice finals read
  // and write the slot in order.
  const pendingRef = useRef(null);
  const answersRef = useRef(answers); answersRef.current = answers;
  const skippedRef = useRef(skipped); skippedRef.current = skipped;

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
  // A module change clears the pending slot (the workspace remounts as well; this is defensive).
  useEffect(() => { pendingRef.current = null; }, [module]);

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

  /** The pending slot and the options to read the next patient line with (read-only). An item
   *  answered or skipped since keeps its slot, which still counts replies down and still counts
   *  as present for yields, but it is read with { carry: false }: nothing is carried into it
   *  and no refusal is recorded (design 05 §12.6). */
  function pendingCall() {
    const slot = pendingRef.current;
    const closed = !!slot && (answersRef.current[slot.id] !== undefined || !!skippedRef.current[slot.id]);
    return { slot, opts: { carry: !closed } };
  }

  // ingest one utterance: run extraction, update state, return captures.
  // src records where the utterance came from — demo | typed | voice — for the transcript; voice and
  // demo lines are read alike (spoken lines), typed text as chart text (below). A patient line is read in the context of the
  // pending slot; a physician line never reaches the extractor and leaves the slot untouched.
  // Typed text (release 0.4.7) is clinician/chart text: it is read with { chart: true }, which
  // returns the slot unchanged (nothing consumed, carried into or armed) and lets a pronoun the
  // lexicon marks as the patient's in chart text attribute nothing, and its clarification cues
  // (read the same way) are kept on its line for the Clarify section.
  function ingest(role, text, src = "demo") {
    let caps = [];
    let clar = [];
    if (role === "pt" && extractor) {
      const { slot, opts } = pendingCall();
      const chart = src === "typed";
      const r = extractor.extractInContext(text, slot, chart ? { ...opts, chart: true } : opts);
      if (chart) clar = extractor.clarifyCues(text, { chart: true }).map(toClarifyTag);
      // A heard capture for an item already answered is dropped: "not stated" beside an answer
      // on the record would mislead. The returned slot is kept even when its item is answered
      // or skipped, so a yield it holds lasts the rest of its window; it never carries a value
      // into a closed item, because the next line is read with { carry: false }.
      caps = r.captures.filter(c => !(c.kind === CAPTURE_KIND.HEARD && answersRef.current[c.id] !== undefined));
      pendingRef.current = r.pending;
    }
    // Heard captures record nothing, so a line that only heard a cue leaves the state as it is.
    if (caps.some(c => c.kind !== CAPTURE_KIND.HEARD)) {
      const touched = [...new Set(ingestCaptures({}, caps).touchedDomainItemIds.map(id => module.itemById[id]?.domain).filter(Boolean))];
      if (touched.length) setPulse({ domains: touched, at: Date.now() });
      // The Question review's record (release 0.4.8, follow-up): the items this line answered (first
      // write wins, so only items unanswered before it), as heard (spoken) or typed chart text.
      const before = answersRef.current;
      const after = ingestCaptures({ answers: before }, caps).answers;
      const fresh = Object.keys(after).filter(k => before[k] === undefined && after[k] !== undefined);
      if (fresh.length) recordSource(fresh, src === "typed" ? "typed" : "heard");
      // Items first-wins; context overwrites; red flags only ever raised and marked as heard —
      // a clinician decision already on the record is not downgraded by a later phrase match.
      setAnswers(a => ingestCaptures({ answers: a }, caps).answers);
      setCtx(c => ingestCaptures({ ctx: c }, caps).ctx);
      setRf(v => ingestCaptures({ rf: v }, caps).rf);
      // The synchronous mirror, read by the next ingest before React re-renders.
      answersRef.current = ingestCaptures({ answers: answersRef.current }, caps).answers;
    }
    setTranscript(t => [...t, { id: t.length, role, text, src, caps: caps.map(toTag), clar }]);
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
  // nothing is written until the recogniser commits the segment. The returned slot is
  // discarded: interim text never arms, consumes or clears the carry-over window. The
  // transcript dependency re-reads the slot after each committed line.
  const previewCaps = useMemo(() => {
    if (!(interim && speaker === "pt" && extractor)) return [];
    const { slot, opts } = pendingCall();
    return extractor.extractInContext(interim, slot, opts).captures
      .filter(c => !(c.kind === CAPTURE_KIND.HEARD && answersRef.current[c.id] !== undefined)).map(toTag);
  }, [interim, speaker, extractor, answers, skipped, transcript]); // eslint-disable-line

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
    setProbeAns({}); setCohort([]); setShowEmr(false);
    setClarifyDismissed({}); setInput(""); setAnswerSrc({});
    pendingRef.current = null; answersRef.current = {}; skippedRef.current = {};
    setToast("Encounter cleared");
  }
  function submitInput() {
    const v = input.trim(); if (!v) return;
    ingest("pt", v, "typed"); setInput("");
  }
  // Enter is a newline; Ctrl+Enter or Cmd+Enter captures, never while an IME is composing.
  function onInputKeyDown(e) {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
    if ((e.nativeEvent && e.nativeEvent.isComposing) || e.keyCode === 229) return;
    e.preventDefault();
    submitInput();
  }

  // Phenotype (complaint). A derive error is a routing error: "" here is for display and the
  // cohort row only, never a fallback for routing.
  const { value: complaint, error: phenotypeError } = useMemo(() => derivePhenotype(module, answers), [module, answers]);

  // Heard items (design 05 §2.5): derived from the transcript, newest first, one per id. No
  // new state: the bubble tags stay with their lines, and the prompts are filtered by answers
  // and skips, so an answered or skipped item leaves Ask next on the next render.
  const heardItems = useMemo(() => {
    const seen = new Set(), out = [];
    for (let k = transcript.length - 1; k >= 0; k--)
      for (const c of transcript[k].caps)
        if (c.kind === CAPTURE_KIND.HEARD && !seen.has(c.id)) { seen.add(c.id); out.push({ id: c.id, cueText: c.cueText }); }
    return out;
  }, [transcript]);
  // Clarify (release 0.4.7): the cues of every typed line, line by line in transcript order and in
  // text order within a line (each line's cueIndex is offset past the lines before it, so
  // clarifyPrompts' text order runs line by line and its one-card-per-target rule keeps the
  // earliest open card). A card leaves once its probe or item is answered, its item skipped, or
  // the card itself skipped (clarifyDismissed); the bubble's clarify tags stay with their line.
  const clarifyCueList = useMemo(() => {
    const out = [];
    let base = 0;
    for (const m of transcript) {
      if (!Array.isArray(m.clar) || !m.clar.length) continue;
      for (const q of m.clar) out.push({ ...q, cueIndex: base + (typeof q.cueIndex === "number" ? q.cueIndex : 0) });
      base += m.text.length + 1;
    }
    return out;
  }, [transcript]);
  // rf too: a probe card is shown only while its probe is live, as on the rail (review round 1).
  const clarifyList = useMemo(() => clarifyPrompts(module, clarifyCueList, { answers, probeAns, skipped, dismissed: clarifyDismissed, rf }),
    [module, clarifyCueList, answers, probeAns, skipped, clarifyDismissed, rf]);
  useEffect(() => {
    const at = clarifyFocusRef.current;
    if (at === null) return;
    clarifyFocusRef.current = null;
    const cards = clarifyRef.current ? clarifyRef.current.querySelectorAll(".sa-scribe-clarify-card") : [];
    const target = cards.length ? cards[Math.min(at, cards.length - 1)].querySelector("button") : inputRef.current;
    if (target && typeof target.focus === "function") target.focus();
  }, [clarifyList]);
  const probeById = useMemo(() => {
    const list = (module.logic && module.logic.probes && module.logic.probes.list) || [];
    return new Map(list.filter(p => p && typeof p === "object").map(p => [p.id, p]));
  }, [module]);
  // What an open card stands for in Ask next: its probe (off the rail while the card is open), and
  // its item, an item card's target or a probe card's item (its target, or the item a rescue probe
  // re-asks), off the suggestions, the heard cards and the rail's other probes for that item, so the
  // same question is never asked in two places (review round 1: rescue items and rule-out probes).
  const probeItemOf = (pr) => (pr && typeof pr.target === "string" ? pr.target : pr && typeof pr.rescues === "string" ? pr.rescues : null);
  const clarifyProbeIds = useMemo(() => new Set(clarifyList.filter(cl => cl.kind === "probe").map(cl => cl.target)), [clarifyList]);
  const clarifyItemIds = useMemo(() => {
    const s = new Set();
    for (const cl of clarifyList) {
      if (cl.kind === "item") s.add(cl.target);
      else if (cl.kind === "probe") { const it = probeItemOf(probeById.get(cl.target)); if (it !== null) s.add(it); }
    }
    return s;
  }, [clarifyList, probeById]);

  const heardAll = useMemo(() => heardPrompts(module, { heard: heardItems, answers, skipped }), [module, heardItems, answers, skipped]);
  const heardPromptList = useMemo(() => (clarifyItemIds.size ? heardAll.filter(s => !clarifyItemIds.has(s.id)) : heardAll), [heardAll, clarifyItemIds]);
  const heardIds = useMemo(() => heardAll.map(s => s.id), [heardAll]);
  const suggestExclude = useMemo(() => (clarifyItemIds.size ? [...heardIds, ...clarifyItemIds] : heardIds), [heardIds, clarifyItemIds]);

  // suggested questions: unanswered items, prioritized by active pathway + weight.
  // While the screen is unscorable the pool widens to every unanswered item —
  // otherwise headroom parked in an inactive domain could hold the screen
  // indeterminate with nothing left on screen to resolve it. An item shown as a heard
  // prompt (or behind an open Clarify card) is left out here, so it appears once.
  const { list: suggestions, error: activationError } = useMemo(
    () => rankSuggestions(module, { answers, complaint, phenotypeError, vmp, scorable, skipped, exclude: suggestExclude }),
    [module, answers, complaint, phenotypeError, vmp, scorable, skipped, suggestExclude]);
  const askNextCount = suggestions.length + heardPromptList.length;

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
  // A probe asked by an open Clarify card leaves the rail until the card is answered or skipped, as
  // does a probe for the item an open card stands for.
  const probeGroups = useMemo(() => truncateProbes(clarifyProbeIds.size || clarifyItemIds.size
    ? probes.filter(p => !clarifyProbeIds.has(p.id) && !clarifyItemIds.has(probeItemOf(p))) : probes), [probes, clarifyProbeIds, clarifyItemIds]);
  const probeErrorIds = useMemo(() => new Set(probeErrors.map(e => e.ruleId)), [probeErrors]);
  // Ask next, most urgent first: Safety probes, then the Heard group, then Re-ask and the rest.
  const askSections = useMemo(() => askNextSections(probeGroups, heardPromptList), [probeGroups, heardPromptList]);

  /** The Question review's record: these items' current answers came from `src` (a REVIEW_SOURCE key). */
  function recordSource(ids, src) {
    setAnswerSrc(v => {
      const n = { ...v };
      for (const id of ids) n[id] = v[id] && v[id].first ? { src, first: v[id].first } : { src };
      return n;
    });
  }

  // `via` (release 0.4.8, follow-up): where the answer came from, for the Question review only.
  function answerProbe(p, idx, via = "probe") {
    const o = p.opts[idx];
    setProbeAns(v => ({ ...v, [p.id]: idx }));
    // A probe may only ever RAISE a red flag, never clear one — same rule as ambient capture.
    if (o.rf) setRf(v => (v[o.rf] ? v : { ...v, [o.rf]: "probe" }));
    if (o.a) { setAnswers(a2 => ({ ...a2, ...o.a })); setAsked(k => ({ ...k, ...Object.fromEntries(Object.keys(o.a).map(x => [x, true])) })); recordSource(Object.keys(o.a), via); }
  }

  function answerPrompt(s, value, via = "askNext") {
    if (s.kind === "info") { setVmp(v => ({ ...v, [s.id]: value })); }
    else { setAnswers(a => ({ ...a, [s.id]: value })); setAsked(k => ({ ...k, [s.id]: true })); recordSource([s.id], via); }
  }
  // Question review (release 0.4.8, follow-up): an answer goes the way an Ask next card's goes
  // (answerPrompt); the first edit keeps what was recorded before it. Choosing the current answer
  // changes nothing. A change or a clear retracts the probe answer that wrote the item
  // (retractProbeAnswers; review fix), so that probe's note and EMR checklist entry never contradict
  // the corrected answer, and the probe can be asked again while it is live.
  function reviewAnswer(row, value) {
    if (row.answered && row.value === value) return;
    setProbeAns(v => retractProbeAnswers(module, v, row.id));
    setAnswerSrc(v => ({ ...v, [row.id]: { src: "review", first: v[row.id] && v[row.id].first ? v[row.id].first : { value: row.answered ? row.value : undefined, src: v[row.id] ? v[row.id].src : null } } }));
    setAnswers(a => ({ ...a, [row.id]: value })); setAsked(k => ({ ...k, [row.id]: true }));
  }
  // Clearing deletes the answer and its skip: the item is unanswered again (never no), back in the
  // attainable range and in Ask next.
  function reviewClear(row) {
    if (!row.answered && answers[row.id] === undefined) return;
    setProbeAns(v => retractProbeAnswers(module, v, row.id));
    setAnswerSrc(v => ({ ...v, [row.id]: { src: "review", first: v[row.id] && v[row.id].first ? v[row.id].first : { value: row.answered ? row.value : undefined, src: v[row.id] ? v[row.id].src : null } } }));
    setAnswers(a => { const n = { ...a }; delete n[row.id]; return n; });
    setSkipped(k => { if (!k[row.id]) return k; const n = { ...k }; delete n[row.id]; return n; });
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
  // A Clarify card's answer goes the way the same question goes in Ask next: a probe card through
  // answerProbe (option index), an item card through answerPrompt (scale index or yes / no).
  function answerClarify(cl, idx) {
    const o = cl.opts[idx];
    if (!o) return;
    clarifyFocusRef.current = Math.max(0, clarifyList.indexOf(cl));
    if (cl.kind === "probe") { const pr = probeById.get(cl.target); if (pr) answerProbe(pr, o.value, "clarify"); }
    else if (cl.kind === "item") answerPrompt({ id: cl.target, kind: "scored" }, o.value, "clarify");
  }
  // Skip on a Clarify card hides that card only; it records nothing (not even a skipped item).
  function skipClarify(cl) { clarifyFocusRef.current = Math.max(0, clarifyList.indexOf(cl)); setClarifyDismissed(d => ({ ...d, [cl.id]: true })); }

  // The Question review's rows (release 0.4.8, follow-up), from the engine.
  const reviewSources = useMemo(() => Object.fromEntries(Object.entries(answerSrc).map(([k, v]) => [k, v.src])), [answerSrc]);
  const reviewGroups = useMemo(() => questionReview(module, { answers, sources: reviewSources }), [module, answers, reviewSources]);
  const reviewEdits = useMemo(() => Object.values(answerSrc).filter(v => v.src === "review").length, [answerSrc]);
  /** An answer value as its row shows it: the option label, or "not answered". */
  const reviewValueLabel = (row, value) => {
    if (value === undefined || value === "unsure") return REVIEW_NOT_ANSWERED;
    const o = row.options.find(x => x.value === value);
    return o ? o.label : String(value);
  };
  // The view switch's tabs (release 0.4.8, follow-up): arrow keys, Home and End move between tabs
  // and select them; only the selected tab is in the tab order.
  function onViewKeyDown(e) {
    const i = VIEWS.indexOf(view);
    let j = null;
    if (e.key === "ArrowRight") j = (i + 1) % VIEWS.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + VIEWS.length) % VIEWS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = VIEWS.length - 1;
    if (j === null) return;
    e.preventDefault();
    setView(VIEWS[j]);
    const el = tabRefs.current[VIEWS[j]];
    if (el && typeof el.focus === "function") el.focus();
  }
  const tabProps = (v) => ({
    role: "tab", id: `${viewUid}-tab-${v}`, "aria-selected": view === v, "aria-controls": `${viewUid}-panel`,
    tabIndex: view === v ? 0 : -1, onKeyDown: onViewKeyDown, ref: (el) => { tabRefs.current[v] = el; },
  });

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
  // EMR Friendly Template (release 0.4.3): the engine's plain text from the same inputs and gates as
  // the bundle, only while its panel is open; rebuilt when the encounter changes.
  const emrText = useMemo(() => (showEmr ? buildEmrTemplate(module, {
    patient, answers, ctx, complaint, phenotypeError, rf, safetyReviewed, probeAns, vmp, appVersion,
  }, { surface: "scribe" }) : ""), [showEmr, module, patient, answers, ctx, complaint, phenotypeError, rf, safetyReviewed, probeAns, vmp, appVersion]);

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
  // Text typed or pasted into the box but not captured yet (release 0.4.7): a whole chart note can
  // sit there, so a module switch asks before discarding it.
  const hasDraft = input.trim().length > 0;
  const dirtySummary = useMemo(() => {
    const parts = [];
    if (transcript.length) parts.push(`transcript (${plural(transcript.length, "line", "lines")})`);
    if (answeredCount) parts.push(plural(answeredCount, "answer", "answers"));
    const flagCount = Object.keys(rf).length;
    if (flagCount) parts.push(plural(flagCount, "red flag", "red flags"));
    if (cohort.length) parts.push(plural(cohort.length, "captured row", "captured rows"));
    // A Question review edit counts like an answer (release 0.4.8, follow-up): one that cleared the
    // only answer still leaves a screen in progress.
    if (!parts.length && (safetyReviewed || Object.keys(ctx).length || Object.keys(vmp).length || probeNotes.length || reviewEdits)) parts.push("screen in progress");
    if (hasDraft) parts.push("text not yet captured");
    return parts.length ? parts.join(", ") : null;
  }, [transcript.length, answeredCount, rf, cohort.length, hasDraft, safetyReviewed, ctx, vmp, probeNotes.length, reviewEdits]);
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
                      {(m.caps.length > 0 || (m.clar && m.clar.length > 0)) && (
                        <div className="cap">
                          {/* a heard tag is not a captag: nothing was added to the record */}
                          {m.caps.map((c, i) => c.kind === CAPTURE_KIND.HEARD
                            ? <span className="sa-scribe-heardtag" key={i} data-heard={c.id}
                                    title={module.itemById && module.itemById[c.id] ? module.itemById[c.id].text : undefined}>{captureLabel(module, c)}</span>
                            : <span className="captag" key={i}>+ {captureLabel(module, c)}</span>)}
                          {/* nor is a clarify tag: the text asks a question, it answers nothing */}
                          {(m.clar || []).map((q, i) => <span className="sa-scribe-clarifytag" key={`q${i}`} data-clarify={q.id}>{clarifyLabel(module, q)}</span>)}
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
                        {previewCaps.map((c, i) => c.kind === CAPTURE_KIND.HEARD
                          ? <span className="sa-scribe-heardtag pending" key={i}>? {captureLabel(module, c)}</span>
                          : <span className="captag pending" key={i}>? {captureLabel(module, c)}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {hasLexicon && (
              <div className="entry sa-scribe-entry">
                <textarea ref={inputRef} value={input} rows={8} spellCheck={false} placeholder={INPUT_PLACEHOLDER}
                          aria-label={INPUT_LABEL} aria-keyshortcuts="Control+Enter Meta+Enter"
                          onChange={e => setInput(e.target.value)} onKeyDown={onInputKeyDown} data-testid="scribe-input" />
                <button className="mini" onClick={submitInput} title={CAPTURE_TITLE} data-testid="scribe-capture"><Plus size={14} /> Capture</button>
              </div>
            )}
            {hasLexicon && clarifyList.length > 0 && (
              <div className="sa-scribe-clarify" data-testid="scribe-clarify" role="region" aria-labelledby={`${clarifyUid}-cap`} ref={clarifyRef}>
                <div className="sa-scribe-clarify-cap"><span id={`${clarifyUid}-cap`}>{CLARIFY_LABEL}</span>{CLARIFY_CAPTION}</div>
                {clarifyList.map((cl, ci) => (
                  <div className="prompt sa-scribe-clarify-card" key={`${cl.id}|${cl.target ?? ""}`} data-clarify={cl.id}
                       data-clarify-kind={cl.kind} data-target={cl.target ?? undefined} data-reason={cl.reason}
                       role={cl.kind === "note" ? "note" : "group"} aria-labelledby={`${clarifyUid}-q${ci}`}
                       style={cl.probeKind && PROBE_KIND[cl.probeKind] ? { borderLeftColor: PROBE_KIND[cl.probeKind].c } : undefined}>
                    <div className="qtag sa-scribe-clarify-tag"><HelpCircle size={11} /> {cl.tag ? `${cl.tag} · ` : ""}{CLARIFY_REASON[cl.reason] || CLARIFY_LABEL}{typeof cl.cueText === "string" ? ` “${cl.cueText}”` : ""}</div>
                    <div className="sa-scribe-clarify-quote" data-testid="scribe-clarify-quote">“{cl.evidence}”
                      {cl.against && typeof cl.against.evidence === "string" && <><br /><span className="sa-scribe-clarify-and">{CLARIFY_AND}</span>“{cl.against.evidence}”</>}
                    </div>
                    <div className="qq" id={`${clarifyUid}-q${ci}`}>{cl.ask}</div>
                    {cl.kind === "note" ? (
                      <div className="prow">
                        <button className="pbtn skip" onClick={() => skipClarify(cl)} data-testid="scribe-clarify-dismiss">{DISMISS_LABEL}</button>
                      </div>
                    ) : (
                      <div className="prow">
                        {cl.opts.map((o, i) => (
                          <button key={i} className={"pbtn" + clarifyButtonClass(cl, o)} onClick={() => answerClarify(cl, i)}>{o.label}</button>
                        ))}
                        <button className="pbtn skip" onClick={() => skipClarify(cl)} data-testid="scribe-clarify-skip">Skip</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Always mounted, so a screen reader announces the first cards too (review round 1). */}
            {hasLexicon && (
              <div className="sa-scribe-sr" role="status" aria-live="polite" aria-atomic="true" data-testid="scribe-clarify-status">{clarifyStatus(clarifyList.filter(cl => cl.kind !== "note").length, clarifyList.filter(cl => cl.kind === "note").length)}</div>
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

            {/* view switch: a tab list (release 0.4.8, follow-up); Question review right of Ask next */}
            <div className="btnrow" style={{marginTop:14}} data-testid="scribe-views" role="tablist" aria-label={VIEWS_LABEL}>
              <button className={"act" + (view === "safety" ? "" : " ghost")} onClick={() => setView("safety")} data-testid="scribe-view-safety" {...tabProps("safety")}>
                {override ? <TriangleAlert size={15} /> : <ShieldCheck size={15} />} Safety {override ? `(${activeFlags.length})` : safetyReviewed ? "✓" : "!"}
              </button>
              <button className={"act" + (view === "prompts" ? "" : " ghost")} onClick={() => setView("prompts")} data-testid="scribe-view-prompts" {...tabProps("prompts")}><HelpCircle size={15} /> Ask next {askNextCount ? `(${askNextCount})` : ""}</button>
              <button className={"act" + (view === "review" ? "" : " ghost")} onClick={() => setView("review")} data-testid="scribe-view-review" {...tabProps("review")}><ListChecks size={15} /> {REVIEW_LABEL}</button>
              <button className={"act" + (view === "note" ? "" : " ghost")} onClick={() => setView("note")} data-testid="scribe-view-note" {...tabProps("note")}><FileText size={15} /> Note</button>
              <button className={"act" + (view === "fhir" ? "" : " ghost")} onClick={() => setView("fhir")} data-testid="scribe-view-fhir" {...tabProps("fhir")}><FileJson size={15} /> FHIR</button>
            </div>

            <div role="tabpanel" id={`${viewUid}-panel`} aria-labelledby={`${viewUid}-tab-${view}`} data-testid="scribe-view-panel">

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
                {suggestions.length === 0 && heardPromptList.length === 0 && (
                  <div className="empty">{scorable
                    ? "No high-yield questions outstanding for the active pathway. Screen looks well covered."
                    : "Every scored item is answered but the index still spans a cutpoint — review the captured answers before issuing a result."}</div>
                )}
                {/* contextual probes first — a question that could surface a red flag
                    outranks one that could add points. The Heard group (items the patient
                    named without a value) sits after the Safety probes and before the rest. */}
                {(probeGroups.length > 0 || heardPromptList.length > 0) && (
                  <div style={{marginBottom:12}} data-testid="scribe-probes">
                    {askSections.map(sec => {
                      if (sec.kind === "heard") return (
                        <div key="heard" data-testid="scribe-heard">
                          <div className="qtag" style={{color:"var(--amber)",margin:"10px 0 4px"}}>{HEARD_LABEL}{HEARD_CAPTION}</div>
                          {sec.items.map(s => (
                            <div className="prompt sa-scribe-heard" key={s.id} data-suggestion={s.id} data-heard={s.id}>
                              <div className="qtag"><HelpCircle size={11} /> {s.tag} · heard “{s.cueText}”</div>
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
                      );
                      const { kind, shown, total: groupTotal } = sec.group;
                      return (
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
                      );
                    })}
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

            {view === "review" && (
              <div style={{marginTop:6}} data-testid="scribe-review-list">
                <div className="notew" style={{marginTop:0}}><Info size={13} style={{flex:"0 0 auto",marginTop:1}} /><span>{REVIEW_INTRO}</span></div>
                {reviewGroups.map(g => (
                  <div className="sa-scribe-qr-domain" key={g.key} role="group" aria-labelledby={`${reviewUid}-d-${g.key}`} data-review-domain={g.key}>
                    <div className="sa-scribe-qr-dlabel" id={`${reviewUid}-d-${g.key}`}>{g.label}</div>
                    {g.items.map(r => {
                      const rec = answerSrc[r.id];
                      const edited = !!rec && rec.src === "review";
                      // A skip after a review clear is the latest thing done to the row (review fix).
                      const skippedNow = !r.answered && !!skipped[r.id];
                      const first = edited && rec.first && rec.first.value !== undefined ? rec.first : null;
                      const qid = `${reviewUid}-q-${r.id}`;
                      return (
                        <div className={"sa-scribe-qr-row" + (edited ? " edited" : r.answered ? " on" : "")} key={r.id} role="group" aria-labelledby={qid}
                             data-review-item={r.id} data-answered={r.answered ? "true" : "false"} data-source={r.source || ""}>
                          <div className="sa-scribe-qr-tag">{r.tag} · {r.short}</div>
                          <div className="sa-scribe-qr-q" id={qid}>{r.ask}</div>
                          <div className="sa-scribe-qr-state" data-testid="scribe-review-state">
                            <span className={"sa-scribe-qr-answer" + (r.answered ? "" : " none")}>{r.answered ? r.answerLabel : REVIEW_NOT_ANSWERED}</span>
                            {skippedNow
                              ? <>{" "}<span className="sa-scribe-qr-src">· {REVIEW_SKIPPED}</span></>
                              : r.source ? <>{" "}<span className="sa-scribe-qr-src">· {REVIEW_SOURCE[r.source]}</span></> : null}
                            {edited && <>{" "}<span className="sa-scribe-qr-edited" data-testid="scribe-review-edited">{REVIEW_EDITED}</span></>}
                          </div>
                          {first && <div className="sa-scribe-qr-first">{REVIEW_FIRST} {reviewValueLabel(r, first.value)}{first.src && REVIEW_SOURCE[first.src] ? ` · ${REVIEW_SOURCE[first.src]}` : ""}</div>}
                          <div className="prow">
                            {r.options.map(o => {
                              const on = r.answered && r.value === o.value;
                              return <button key={String(o.value)} type="button" className={"pbtn" + (on ? " sa-scribe-qr-on" : "")} aria-pressed={on}
                                onClick={() => reviewAnswer(r, o.value)}>{o.label}</button>;
                            })}
                            <button type="button" className="pbtn skip" disabled={!r.answered} onClick={() => reviewClear(r)} data-testid="scribe-review-clear">{REVIEW_CLEAR}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
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
                  <button className="act ghost" type="button" data-testid="scribe-emr-toggle" aria-expanded={showEmr}
                    onClick={() => setShowEmr(v => !v)}><ClipboardList size={14} /> {EMR_UI.button}</button>
                  {!canSign &&
                    <span className="empty" style={{padding:"0 4px",alignSelf:"center"}} data-testid="scribe-sign-blocked">Safety review outstanding — the note says so, so signing is blocked.</span>}
                </div>
                {showEmr && <EmrPanel text={emrText} filePrefix={filePrefix} setToast={setToast} />}
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
            </div>

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

/*  The EMR Friendly Template panel (release 0.4.3): a script-free iframe (sandbox
    "allow-same-origin", so the parent can read the edited text) holding one textarea prefilled
    with the engine's plain text, plus Copy and Download. Edits live only in the frame: they are
    copied and downloaded as shown, never saved, and a change to the encounter rebuilds the text,
    as does leaving the Note view (the panel unmounts).
*/
function EmrPanel({ text, filePrefix, setToast }) {
  const frameRef = useRef(null);
  const doc = useMemo(() => emrFrameDoc(text), [text]);
  const current = () => {
    try {
      const d = frameRef.current && frameRef.current.contentDocument;
      const ta = d && d.querySelector("textarea");
      if (ta && typeof ta.value === "string") return ta.value;
    } catch (_) { /* an unreadable frame falls back to the generated text */ }
    return text;
  };
  async function copy() {
    try {
      await navigator.clipboard.writeText(current());
      setToast(EMR_UI.copied);
    } catch (_) {
      setToast(EMR_UI.copyFailed);
    }
  }
  function download() {
    downloadText(`${filePrefix}-emr-template-scribe.txt`, current(), "text/plain");
  }
  return (
    <div className="sa-scribe-emr" data-testid="scribe-emr-panel">
      <p className="sa-scribe-emr-hint">{EMR_UI.instruction} {EMR_UI.regeneratesScribe}</p>
      <iframe ref={frameRef} className="sa-scribe-emr-frame" data-testid="scribe-emr-frame" title={EMR_UI.frameTitle}
        sandbox="allow-same-origin" srcDoc={doc} />
      <div className="btnrow">
        <button className="act ghost" type="button" data-testid="scribe-emr-copy" onClick={copy}><Copy size={14} /> {EMR_UI.copy}</button>
        <button className="act ghost" type="button" data-testid="scribe-emr-download" onClick={download}><Download size={14} /> {EMR_UI.download}</button>
      </div>
    </div>
  );
}
