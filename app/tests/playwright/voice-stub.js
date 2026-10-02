// tests/playwright/voice-stub.js — a controllable SpeechRecognition (design 03 §8.0 "Voice stub").
// Installed with page.addInitScript before any page script runs; never deployed.
//
// window.__voiceStub = {
//   emitInterim(text), emitFinal(text, {confidence} = {}), end(), error(code),
//   holdStart(on), releaseStart(),
//   state,      // "idle" | "starting" | "started" | "ended" — the newest recogniser
//   lang,       // the newest recogniser's lang (MASQUE_Voice sets it from the module lexicon)
//   starts,     // number of start() calls
//   instances,  // every recogniser constructed, oldest first
//   live,       // true while any recogniser is "starting" or "started"
// }
// With holdStart(true), start() withholds onstart until releaseStart(), which stands in for
// an open permission prompt and keeps MASQUE_Voice.js in "starting". A recogniser stopped or
// aborted while held never fires onstart afterwards.
(function installVoiceStub() {
  "use strict";
  if (window.__voiceStub) return;

  let hold = false;
  const held = [];
  const instances = [];
  let starts = 0;

  const later = (fn) => setTimeout(fn, 0);

  function makeResult(text, isFinal, confidence) {
    const alt = { transcript: text, confidence: typeof confidence === "number" ? confidence : 0.9 };
    const res = [alt];
    res.isFinal = isFinal;
    res.item = (i) => res[i];
    return res;
  }

  function makeResults(list) {
    const results = list.slice();
    results.item = (i) => results[i];
    return results;
  }

  class FakeSpeechRecognition {
    constructor() {
      this.lang = "";
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.onaudiostart = null;
      this.onaudioend = null;
      this.onspeechstart = null;
      this.onspeechend = null;
      this.onsoundstart = null;
      this.onsoundend = null;
      this.onnomatch = null;
      this.__state = "idle";
      this.__finals = [];
      instances.push(this);
    }

    start() {
      if (this.__state !== "idle") {
        const e = new Error("Failed to execute 'start' on 'SpeechRecognition': recognition has already started.");
        e.name = "InvalidStateError";
        throw e;
      }
      starts += 1;
      this.__state = "starting";
      if (hold) held.push(this);
      else later(() => this.__fireStart());
    }

    stop() { this.__finish(null); }

    abort() { this.__finish("aborted"); }

    __fireStart() {
      if (this.__state !== "starting") return;
      this.__state = "started";
      if (typeof this.onstart === "function") this.onstart({ type: "start", target: this });
    }

    __finish(errorCode) {
      if (this.__state === "ended" || this.__state === "idle") return;
      const i = held.indexOf(this);
      if (i >= 0) held.splice(i, 1);
      this.__state = "ended";
      later(() => {
        if (errorCode && typeof this.onerror === "function") this.onerror({ type: "error", error: errorCode, message: "", target: this });
        if (typeof this.onend === "function") this.onend({ type: "end", target: this });
      });
    }
  }

  function current() {
    for (let i = instances.length - 1; i >= 0; i--) if (instances[i].__state === "started") return instances[i];
    throw new Error("voice stub: no started recogniser (state " + api.state + ")");
  }

  const api = {
    emitInterim(text) {
      const r = current();
      const results = makeResults([...r.__finals, makeResult(String(text), false)]);
      if (typeof r.onresult === "function") r.onresult({ type: "result", resultIndex: r.__finals.length, results, target: r });
    },
    emitFinal(text, { confidence } = {}) {
      const r = current();
      r.__finals.push(makeResult(String(text), true, confidence));
      const results = makeResults(r.__finals);
      if (typeof r.onresult === "function") r.onresult({ type: "result", resultIndex: r.__finals.length - 1, results, target: r });
    },
    /** The browser ends the session on its own (silence, time cap). */
    end() {
      const r = current();
      r.__state = "ended";
      if (typeof r.onend === "function") r.onend({ type: "end", target: r });
    },
    /** Raise a recognition error ("not-allowed", "network", "no-speech" …); onend follows, as in browsers. */
    error(code) {
      let r = null;
      for (let i = instances.length - 1; i >= 0 && !r; i--) {
        if (instances[i].__state === "started" || instances[i].__state === "starting") r = instances[i];
      }
      if (!r) throw new Error("voice stub: no live recogniser to fail");
      const i = held.indexOf(r);
      if (i >= 0) held.splice(i, 1);
      r.__state = "ended";
      if (typeof r.onerror === "function") r.onerror({ type: "error", error: String(code), message: "", target: r });
      if (typeof r.onend === "function") r.onend({ type: "end", target: r });
    },
    holdStart(on) { hold = !!on; },
    releaseStart() {
      const list = held.splice(0, held.length);
      for (const r of list) r.__fireStart();
      return list.length;
    },
    get state() { return instances.length ? instances[instances.length - 1].__state : "idle"; },
    get lang() { return instances.length ? instances[instances.length - 1].lang : null; },
    get starts() { return starts; },
    get instances() { return instances.slice(); },
    get live() { return instances.some((r) => r.__state === "starting" || r.__state === "started"); },
  };

  Object.defineProperty(window, "__voiceStub", { value: api, configurable: false, enumerable: false, writable: false });
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;
})();
