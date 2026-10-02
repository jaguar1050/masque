/*  Project MASQUE — native voice capture
    Release 0.3.1 · app 0.3.0

    Live microphone capture for the ambient scribe, built on the browser's own speech
    recognition (the Web Speech API). That choice follows from the runtime: there is no
    build step and no npm package here, so the recogniser has to be one the browser
    already ships. This module owns everything that touches the microphone; the scribe
    imports it and only ever sees text.

    What it does

      - Streams INTERIM text (still being recognised) so the UI can preview what the
        extractor would capture, and FINAL text once the recogniser commits a segment.
        Only final segments are handed on for capture. Interim text changes under your
        feet: a "nausea" that becomes "no nausea" a second later must not already have
        locked m_nausea = yes, and the scribe's capture rule is first-wins.

      - Reopens the session when the browser closes it. Chrome ends a continuous
        session after a few seconds of silence and again at its own time cap; the
        clinician should not have to notice. A loop guard stops a recogniser that dies
        the instant it starts from spinning forever.

      - Meters microphone level through an AnalyserNode so the clinician can see the
        microphone is live before the first phrase lands. The meter is best-effort: if
        getUserMedia is refused or AudioContext is unavailable, recognition still runs.

    What it deliberately does not do

      - Speaker diarisation. The Web Speech API returns one stream of text with no idea
        who said it, and guessing from content would turn the physician's "any nausea
        with it?" into a patient-reported symptom. The scribe carries an explicit
        speaker toggle instead; this module stays agnostic about who is talking.

      - Retain audio. Nothing here writes audio anywhere. The recognition step itself
        is the browser's, though: Chrome and Edge send the audio to the vendor's speech
        service, Safari may process on-device. The scribe states this on its face rather
        than claiming an on-device pipeline it does not have.

    Segmentation caveat, for whoever reads the benchmark: the recogniser decides where a
    segment ends, and each segment is extracted on its own, exactly like one typed
    statement. A duration cue that lands in the segment after the symptom it describes is
    not joined back to it. That is the same limitation as typing the two halves separately
    and is left visible rather than papered over with a merge heuristic.
*/

export const VOICE_ENGINE = "Web Speech API — browser-native SpeechRecognition";
export const VOICE_LANG = "en-US";   // the extraction lexicon is English-only; see MASQUE_Extraction.js

export const VOICE_ERRORS = {
  unsupported:
    "This browser has no speech recognition. Chrome, Edge and Safari support it — otherwise type what the patient says.",
  insecure:
    "Microphone capture needs a secure page (https, or localhost while developing).",
  "not-allowed":
    "Microphone permission was refused. Allow the microphone for this site and try again.",
  "service-not-allowed":
    "The browser's speech service is not permitted here. Check site settings, or type what the patient says.",
  "audio-capture":
    "No microphone was found, or another application is holding it.",
  network:
    "The browser's speech service could not be reached. Check the connection, or type what the patient says.",
  "language-not-supported":
    "The speech service does not support the requested language.",
  "restart-loop":
    "Recognition keeps stopping the moment it starts. Try again, or type what the patient says.",
  unknown:
    "Speech recognition stopped unexpectedly. Try again, or type what the patient says.",
};

function recognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isVoiceSupported() { return !!recognitionCtor(); }

// getUserMedia and SpeechRecognition both require a secure context. localhost counts.
export function isSecureForMicrophone() {
  if (typeof window === "undefined") return false;
  return window.isSecureContext !== false;
}

const noop = () => {};

/*  createVoiceCapture(opts)

    opts.lang        BCP-47 tag handed to the recogniser (default VOICE_LANG).
    opts.onInterim   (text) — the current not-yet-final text; "" when nothing is pending.
    opts.onFinal     (text, { confidence }) — one committed segment. Called once per segment.
    opts.onState     (state) — idle | starting | listening | restarting | stopped | error.
    opts.onError     ({ code, message, detail }) — terminal; the capture has stopped.
    opts.onLevel     (level) — microphone RMS mapped to 0..1, at most ~15 times a second;
                     null once if the meter cannot run at all.
    opts.meter       false to skip getUserMedia and the level meter entirely.

    Returns { start, stop, destroy, getState }.
*/
export function createVoiceCapture({
  lang = VOICE_LANG,
  onInterim = noop, onFinal = noop, onState = noop, onError = noop, onLevel = noop,
  meter = true,
} = {}) {
  let rec = null;
  let active = false;
  let state = "idle";
  let lastStartAt = 0;
  let rapidEnds = [];         // timestamps of sessions that ended within a second of starting
  let restartTimer = null;
  let stopFallback = null;

  // level meter
  let stream = null, audioCtx = null, raf = 0, lastLevelAt = 0;

  function setState(s) { if (s !== state) { state = s; onState(s); } }

  function detach() {
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (stopFallback) { clearTimeout(stopFallback); stopFallback = null; }
    if (!rec) return;
    const r = rec; rec = null;
    r.onstart = r.onresult = r.onerror = r.onend = null;
    try { r.abort(); } catch (_) { /* already gone */ }
  }

  function fail(code, detail) {
    active = false;
    detach();
    stopMeter();
    onInterim("");
    setState("error");
    onError({ code, message: VOICE_ERRORS[code] || VOICE_ERRORS.unknown, detail: detail ?? null });
  }

  function attach(r) {
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => { lastStartAt = Date.now(); setState("listening"); };

    r.onresult = (e) => {
      // e.resultIndex is the first result that changed; everything before it was
      // already delivered. Finals are emitted one by one, interims are concatenated.
      let interim = "";
      const results = e.results || [];
      for (let i = e.resultIndex ?? 0; i < results.length; i++) {
        const res = results[i];
        const alt = res && res[0];
        const text = (alt?.transcript || "").trim();
        if (!text) continue;
        if (res.isFinal) onFinal(text, { confidence: typeof alt.confidence === "number" ? alt.confidence : null });
        else interim += (interim ? " " : "") + text;
      }
      onInterim(interim);
    };

    r.onerror = (e) => {
      const code = e?.error || "unknown";
      // Both are followed by onend, which decides whether to reopen the session.
      if (code === "no-speech" || code === "aborted") return;
      fail(code, e?.message);
    };

    r.onend = () => {
      onInterim("");
      if (!active) { detach(); stopMeter(); setState("stopped"); return; }
      // The browser closed the session on silence or its own time cap. Reopen it —
      // unless it keeps dying instantly, which means something upstream is wrong.
      const now = Date.now();
      if (now - lastStartAt < 1000) rapidEnds.push(now);
      rapidEnds = rapidEnds.filter(t => now - t < 10000);
      if (rapidEnds.length >= 4) { fail("restart-loop"); return; }
      setState("restarting");
      restartTimer = setTimeout(() => { restartTimer = null; if (active) openSession(); }, 150);
    };
  }

  function openSession() {
    const Ctor = recognitionCtor();
    if (!Ctor) { fail("unsupported"); return false; }
    // Always a fresh instance: calling start() twice on one recogniser throws.
    detach();
    try {
      rec = new Ctor();
      attach(rec);
      rec.start();
      return true;
    } catch (err) {
      fail("unknown", err?.message);
      return false;
    }
  }

  async function startMeter() {
    if (!meter) return;
    const AC = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
    if (!AC || !navigator.mediaDevices?.getUserMedia) { onLevel(null); return; }
    let s;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (_) { onLevel(null); return; }   // recognition reports its own permission error
    if (!active) { s.getTracks().forEach(t => t.stop()); return; }
    try {
      stream = s;
      audioCtx = new AC();
      const source = audioCtx.createMediaStreamSource(s);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!audioCtx) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        if (now - lastLevelAt > 66) { lastLevelAt = now; onLevel(Math.min(1, rms * 4)); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch (_) {
      stopMeter();
      onLevel(null);
    }
  }

  function stopMeter() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (audioCtx) { const c = audioCtx; audioCtx = null; try { c.close(); } catch (_) { /* fine */ } }
    onLevel(0);
  }

  function start() {
    if (active) return;
    if (!isVoiceSupported()) { fail("unsupported"); return; }
    if (!isSecureForMicrophone()) { fail("insecure"); return; }
    active = true;
    rapidEnds = [];
    setState("starting");
    if (openSession()) startMeter();
  }

  function stop() {
    if (!active) return;
    active = false;
    // Graceful stop so any final result still in flight is delivered before onend.
    const r = rec;
    if (!r) { stopMeter(); setState("stopped"); return; }
    try { r.stop(); } catch (_) { detach(); stopMeter(); setState("stopped"); return; }
    // Some engines never fire onend after stop(); do not leave the UI stuck "listening".
    stopFallback = setTimeout(() => { stopFallback = null; if (rec === r) { detach(); stopMeter(); setState("stopped"); } }, 1500);
  }

  function destroy() {
    active = false;
    detach();
    stopMeter();
    setState("stopped");
  }

  return { start, stop, destroy, getState: () => state };
}
