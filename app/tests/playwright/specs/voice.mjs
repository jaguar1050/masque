// tests/playwright/specs/voice.mjs — the Ambient Scribe microphone, end to end (design 03 §8.3
// `voice`, §5.1 microphone policy, §5.4, §9.9). Owner: WP8 (+ WP13 runner). Cloud runner only.
//
// Chromium runs with --use-fake-ui-for-media-stream --use-fake-device-for-media-stream (a real
// getUserMedia stream with a synthetic tone drives the level meter) and the voice stub
// (tests/playwright/voice-stub.js), which stands in for the browser's SpeechRecognition.
//
// Part 1 — the Scribe itself, on tests/dev/scribe.html (no shell needed):
//   Listen shown with a lexicon; the recogniser's lang equals the lexicon's; the level meter moves;
//   an interim result is a dashed preview with pending tags and writes no answer; a final result
//   is captured with the "· voice" tag; the Physician toggle captures nothing; the browser ending
//   a session reopens it (auto-restart); a recognition error is mapped to its message;
//   stopSignal, micAllowed=false (also during "starting", the holdStart case), pagehide, unmount
//   and remount (module switch) each leave no live session; the insecure-context notice shows
//   before any click; no speech recognition → Listen disabled with the unsupported title; the
//   shape fixture (no lexicon) hides the transport.
// Part 2 — the shell's half, on screenair.html (needs WP12-M2, which mounts apps/Scribe.jsx):
//   the indicator on the Research tab reads "captures go to the Ambient Scribe" and its Stop
//   works; entering the Patient tab stops capture and shows the toast; holdStart + Patient tab +
//   releaseStart leaves no live session; Listen is disabled while a patient-facing view is shown;
//   Hand to patient (patient mode) stops capture. Until the shell mounts the generic Scribe these
//   checks are reported as waiting on WP12-M2 (FAIL, never a vacuous PASS).
// Part 3 — layout, in the shell at 1280 and 375 px: after the whole demo transcript, in every
//   Scribe view (Safety, Ask next, Note, FHIR) no element of the Scribe panel ends right of the
//   panel or the viewport unless a scrolling ancestor inside the panel holds it (the FHIR <pre>
//   scrolls inside its card). "No page scroll" alone missed this: the panel clips (overflow-x).

const MIC_TOAST = "Microphone stopped — the Patient Companion never runs with the microphone on.";
const UNSUPPORTED = "This browser has no speech recognition. Chrome, Edge and Safari support it — otherwise type what the patient says.";
const INSECURE = "Microphone capture needs a secure page (https, or localhost while developing).";
const NOT_ALLOWED = "Microphone permission was refused. Allow the microphone for this site and try again.";

/** In-page: the elements of `sel` whose right edge passes the panel or the viewport without a
 *  clipping/scrolling ancestor inside the panel (those are clipped or scrolled, not cut off). */
function overflowing(sel) {
  const panel = document.querySelector(sel);
  if (!panel) return ["panel not found"];
  const pr = panel.getBoundingClientRect();
  const limit = Math.min(document.documentElement.clientWidth, pr.right) + 1;
  const bad = [];
  for (const el of panel.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if ((!r.width && !r.height) || r.right <= limit) continue;
    if (getComputedStyle(el).position === "fixed" || el.closest(".toast")) continue;
    let a = el.parentElement, held = false;
    for (; a && a !== panel; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") { held = true; break; }
    if (held) continue;
    bad.push(`${el.tagName.toLowerCase()}${el.dataset.testid ? `[${el.dataset.testid}]` : ""}.${String(el.className).split(" ").filter(Boolean).slice(0, 2).join(".")} right ${Math.round(r.right)} > ${Math.round(limit)}`);
  }
  return bad.slice(0, 8);
}

async function layoutPart(ctx, check, notes) {
  const shellUrl = new URL("app/screenair.html#tab=scribe", ctx.baseUrl).href;
  for (const width of [1280, 375]) {
    const p = await ctx.newPage();
    try {
      await p.setViewportSize({ width, height: 800 });
      await p.goto(shellUrl, { waitUntil: "load" });
      await p.waitForFunction(() => document.documentElement.dataset.masqueReady === "true", null, { timeout: 60000 });
      await p.waitForSelector("#sa-panel-scribe [data-testid=scribe-app]", { timeout: 60000 });
      const step = p.locator("#sa-panel-scribe [data-testid=scribe-step]");
      for (let i = 0; i < 80 && (await step.count()) && !(await step.isDisabled()); i++) await step.click();
      for (const v of ["safety", "prompts", "note", "fhir"]) {
        await p.click(`#sa-panel-scribe [data-testid=scribe-view-${v}]`);
        await p.waitForTimeout(150);
        const bad = await p.evaluate(overflowing, "#sa-panel-scribe");
        check(bad.length === 0, `/layout/${width}/${v}`, "nothing past the panel or the viewport", bad);
      }
      const pre = await p.evaluate(() => { const e = document.querySelector("#sa-panel-scribe [data-testid=scribe-bundle]"); return e ? { sw: e.scrollWidth, cw: e.clientWidth } : null; });
      if (pre && pre.sw > pre.cw) notes.push(`layout ${width}px: the FHIR bundle scrolls inside its card (${pre.sw} > ${pre.cw})`);
    } catch (err) {
      check(false, `/layout/${width}/error`, "no error", String(err && err.message ? err.message : err).split("\n")[0]);
    } finally {
      await p.close();
    }
  }
}

export default async function voice(page, ctx) {
  const diffs = [];
  const notes = [];
  let n = 0;
  const check = (ok, path, a, b) => { n += 1; if (!ok) diffs.push({ path, input: null, a, b }); return ok; };
  const stub = () => ctx.voiceStub.read(page);
  const call = (m, ...args) => ctx.voiceStub.call(page, m, ...args);
  const waitFor = async (fn, arg, timeout = 4000) => {
    try { await page.waitForFunction(fn, arg, { timeout }); return true; } catch { return false; }
  };
  const live = async () => (await stub()).live;
  const devUrl = (q = "") => new URL(`app/tests/dev/scribe.html${q}`, ctx.baseUrl).href;
  const ready = async (p, url) => {
    await p.goto(url, { waitUntil: "load" });
    await p.waitForFunction(() => document.documentElement.dataset.masqueReady === "true", null, { timeout: 60000 });
  };
  const lastScreen = () => page.evaluate(() => { const s = window.__scribeDev.screens; return s.length ? s[s.length - 1] : null; });
  const answeredCount = async () => Object.keys(((await lastScreen()) || {}).answers || {}).length;
  const listen = async () => {
    await page.click("[data-testid=scribe-listen]");
    return waitFor(() => window.__voiceStub.state === "started" && /Listening ·/.test((document.querySelector("[data-testid=scribe-voice-state]") || {}).textContent || ""));
  };

  // ------------------------------------------------------------------ part 1: dev page
  await ready(page, devUrl());
  await page.waitForSelector("[data-testid=scribe-app]", { timeout: 30000 });
  const rubric = await (await fetch(new URL("app/modules/masque/masque.rubric.json", ctx.baseUrl))).json();
  const lexLang = (rubric.lexicon && rubric.lexicon.lang) || "en-US";

  check(await page.locator("[data-testid=scribe-listen]").count() === 1, "/dev/listen-shown", "Listen shown", "absent");
  check(await page.locator("[data-testid=scribe-listen]").isEnabled(), "/dev/listen-enabled", true, false);

  // Start, lang, meter.
  check(await listen(), "/dev/start", "listening", await stub());
  const s0 = await stub();
  check(s0.lang === lexLang, "/dev/lang", lexLang, s0.lang);
  check((await page.textContent("[data-testid=scribe-voice-state]")).includes(`Listening · ${lexLang}`), "/dev/lang-shown", lexLang, await page.textContent("[data-testid=scribe-voice-state]"));
  const meterMoved = await waitFor(() => { const m = document.querySelector("[data-testid=scribe-meter]"); return !!m && Number(m.getAttribute("aria-valuenow")) > 0; }, null, 6000);
  check(meterMoved, "/dev/meter", "the level meter shows a level from the fake microphone", await page.evaluate(() => { const m = document.querySelector("[data-testid=scribe-meter]"); return m ? m.getAttribute("aria-valuenow") : "no meter"; }));
  check(await page.evaluate(() => window.__scribeDev.voiceStates.includes("listening")), "/dev/onVoiceState", "listening reported", await page.evaluate(() => window.__scribeDev.voiceStates));

  // Interim: preview only.
  const before = await answeredCount();
  await call("emitInterim", "bright light bothers me and I feel nauseous");
  const interimShown = await waitFor(() => !!document.querySelector("[data-testid=scribe-interim] .bub.interim"));
  check(interimShown, "/dev/interim/preview", "dashed preview", "absent");
  check(await page.locator("[data-testid=scribe-interim] .captag.pending").count() > 0, "/dev/interim/pending-tags", "pending tags", 0);
  await page.waitForTimeout(200);
  check(await answeredCount() === before, "/dev/interim/no-answer", before, await answeredCount());
  check(await page.locator(".tsc .row:not([data-testid])").count() === 0, "/dev/interim/no-transcript-line", 0, await page.locator(".tsc .row:not([data-testid])").count());

  // Final: captured with the voice tag.
  await call("emitFinal", "bright light bothers me and I feel nauseous");
  const finalShown = await waitFor(() => [...document.querySelectorAll(".tsc .who")].some((w) => w.textContent === "Patient · voice"));
  check(finalShown, "/dev/final/voice-tag", "Patient · voice", await page.textContent(".tsc"));
  check(await page.locator(".tsc .row.pt .captag:not(.pending)").count() > 0, "/dev/final/captags", "capture tags", 0);
  await waitFor((b) => { const s = window.__scribeDev.screens; return s.length && Object.keys(s[s.length - 1].answers).length > b; }, before);
  const afterFinal = await answeredCount();
  check(afterFinal > before, "/dev/final/answers", `> ${before}`, afterFinal);
  check(await page.locator("[data-testid=scribe-interim]").count() === 0, "/dev/final/interim-cleared", 0, await page.locator("[data-testid=scribe-interim]").count());

  // Physician turn: transcribed, not captured.
  await page.click(".spkb >> text=Physician");
  await call("emitFinal", "any nausea or light sensitivity with it");
  await waitFor(() => [...document.querySelectorAll(".tsc .who")].some((w) => w.textContent === "Physician · voice"));
  const mdRow = page.locator(".tsc .row.md").last();
  check(await mdRow.locator(".captag").count() === 0, "/dev/physician/no-capture", 0, await mdRow.locator(".captag").count());
  check(await answeredCount() === afterFinal, "/dev/physician/answers", afterFinal, await answeredCount());
  await page.click(".spkb >> text=Patient");

  // Auto-restart when the browser ends the session.
  const startsBefore = (await stub()).starts;
  await call("end");
  const restarted = await waitFor((k) => window.__voiceStub.starts > k && window.__voiceStub.state === "started", startsBefore);
  check(restarted, "/dev/auto-restart", "a new session", await stub());
  check(await page.evaluate(() => window.__scribeDev.voiceStates.includes("restarting")), "/dev/auto-restart/state", "restarting reported", await page.evaluate(() => window.__scribeDev.voiceStates.slice(-5)));

  // Error mapping.
  await call("error", "not-allowed");
  await waitFor(() => !!document.querySelector("[data-testid=scribe-voice-error]"));
  check((await page.textContent("[data-testid=scribe-voice-error]").catch(() => "")) === NOT_ALLOWED, "/dev/error/not-allowed", NOT_ALLOWED, await page.textContent("[data-testid=scribe-voice-error]").catch(() => null));
  check(!(await live()), "/dev/error/stopped", false, await live());

  // stopSignal.
  check(await listen(), "/dev/stopSignal/start", "listening", await stub());
  await page.click("[data-testid=dev-stop]");
  check(await waitFor(() => !window.__voiceStub.live), "/dev/stopSignal/stopped", false, await live());
  check(await waitFor(() => !document.querySelector("[data-testid=scribe-stop]")), "/dev/stopSignal/ui", "Listen back", "still listening");

  // micAllowed=false while listening: destroyed at once; Listen disabled.
  check(await listen(), "/dev/micAllowed/start", "listening", await stub());
  await page.uncheck("[data-testid=dev-mic]");
  check(!(await live()), "/dev/micAllowed/destroyed-at-once", false, await live());
  check(await waitFor(() => { const b = document.querySelector("[data-testid=scribe-listen]"); return !!b && b.disabled; }), "/dev/micAllowed/listen-disabled", true, false);
  check(await page.getAttribute("[data-testid=scribe-listen]", "title") === "The microphone is off while a patient-facing view is shown.", "/dev/micAllowed/title", "mic-off title", await page.getAttribute("[data-testid=scribe-listen]", "title"));
  const startsDisabled = (await stub()).starts;
  await page.click("[data-testid=scribe-listen]", { force: true }).catch(() => {});
  check((await stub()).starts === startsDisabled, "/dev/micAllowed/no-start", startsDisabled, (await stub()).starts);
  await page.check("[data-testid=dev-mic]");

  // The holdStart case: a permission prompt still open when the view turns patient-facing.
  await call("holdStart", true);
  await page.click("[data-testid=scribe-listen]");
  check(await waitFor(() => window.__voiceStub.state === "starting"), "/dev/hold/starting", "starting", (await stub()).state);
  await page.uncheck("[data-testid=dev-mic]");
  await call("releaseStart");
  await page.waitForTimeout(300);
  check(!(await live()), "/dev/hold/no-live-session", false, await stub());
  check(!(await page.evaluate(() => /Listening ·/.test((document.querySelector("[data-testid=scribe-voice-state]") || {}).textContent || ""))), "/dev/hold/ui", "not listening", "listening");
  await call("holdStart", false);
  await page.check("[data-testid=dev-mic]");

  // pagehide.
  check(await listen(), "/dev/pagehide/start", "listening", await stub());
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  check(await waitFor(() => !window.__voiceStub.live), "/dev/pagehide/stopped", false, await live());

  // Unmount.
  check(await listen(), "/dev/unmount/start", "listening", await stub());
  await page.click("[data-testid=dev-unmount]");
  check(await waitFor(() => !window.__voiceStub.live), "/dev/unmount/stopped", false, await live());
  check(await page.evaluate(() => window.__scribeDev.voiceStates[window.__scribeDev.voiceStates.length - 1] === "stopped"), "/dev/unmount/reported", "stopped", await page.evaluate(() => window.__scribeDev.voiceStates.slice(-3)));
  await page.click("[data-testid=dev-unmount]");
  await page.waitForSelector("[data-testid=scribe-listen]");

  // Remount (a module switch remounts the workspace).
  check(await listen(), "/dev/remount/start", "listening", await stub());
  await page.click("[data-testid=dev-remount]");
  check(await waitFor(() => !window.__voiceStub.live), "/dev/remount/stopped", false, await live());
  check(await page.locator("[data-testid=scribe-listen]").isEnabled(), "/dev/remount/fresh", "Listen enabled", "disabled");

  // Insecure context: the notice is shown before any click, and Listen is disabled.
  {
    const p = await ctx.newPage();
    await p.addInitScript(() => Object.defineProperty(window, "isSecureContext", { get: () => false, configurable: true }));
    await ready(p, devUrl());
    await p.waitForSelector("[data-testid=scribe-app]");
    check((await p.textContent("[data-testid=scribe-insecure]").catch(() => "")).includes(INSECURE), "/dev/insecure/notice", INSECURE, await p.textContent("[data-testid=scribe-insecure]").catch(() => null));
    check(!(await p.locator("[data-testid=scribe-listen]").isEnabled()), "/dev/insecure/disabled", true, false);
    await p.close();
  }
  // No speech recognition: Listen disabled with the unsupported title.
  {
    const p = await ctx.newPage();
    await p.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
    await ready(p, devUrl());
    await p.waitForSelector("[data-testid=scribe-app]");
    check(!(await p.locator("[data-testid=scribe-listen]").isEnabled()), "/dev/unsupported/disabled", true, false);
    check(await p.getAttribute("[data-testid=scribe-listen]", "title") === UNSUPPORTED, "/dev/unsupported/title", UNSUPPORTED, await p.getAttribute("[data-testid=scribe-listen]", "title"));
    await p.close();
  }
  // The shape fixture (no lexicon) hides the transport.
  {
    const p = await ctx.newPage();
    await ready(p, devUrl("?fixture=shape"));
    await p.waitForSelector("[data-testid=scribe-app]");
    for (const id of ["scribe-listen", "scribe-play", "scribe-step", "scribe-input"]) check(await p.locator(`[data-testid=${id}]`).count() === 0, `/dev/shape/${id}`, "hidden", "shown");
    check(await p.locator("[data-testid=scribe-no-lexicon]").count() === 1, "/dev/shape/notice", "notice", "absent");
    await p.close();
  }
  check(ctx.consoleErrors.length === 0, "/dev/console", "clean", ctx.consoleErrors.slice(0, 5));

  // ------------------------------------------------------------------ part 2: the shell
  const shellUrl = new URL("app/screenair.html", ctx.baseUrl).href;
  await ready(page, shellUrl);
  const tab = async (key) => { await page.click(`nav.sa-tabs [data-tab="${key}"]`); await page.waitForTimeout(150); };
  let generic = false;
  try {
    await tab("scribe");
    generic = await waitFor(() => !!document.querySelector(".sa-shell [data-testid=scribe-app]"), null, 8000);
  } catch (err) {
    notes.push(`shell: could not open the Scribe tab (${String(err.message).split("\n")[0]})`);
  }
  if (!generic) {
    const ms = await page.evaluate(() => (document.querySelector(".sa-shell") || {}).dataset?.milestone || "?").catch(() => "?");
    diffs.push({ path: "/shell", input: null, a: "the shell mounts apps/Scribe.jsx", b: `shell milestone ${ms}: waits on WP12-M2` });
    notes.push(`shell checks waiting on WP12-M2 (screenair.html is at milestone ${ms} and mounts the legacy Scribe): Research-tab indicator and its Stop, Patient tab stop + toast, holdStart on the Patient tab, Listen disabled on patient-facing views, patient mode stop`);
  } else {
    const scribeListen = ".sa-shell [data-testid=scribe-listen]";
    const shellListen = async () => { await page.click(scribeListen); return waitFor(() => window.__voiceStub.state === "started"); };
    // Indicator on the Research tab, and its Stop.
    check(await shellListen(), "/shell/research/start", "listening", await stub());
    await tab("research");
    const ind = await waitFor(() => /captures go to the Ambient Scribe/.test((document.getElementById("sa-mic") || {}).textContent || ""));
    check(ind, "/shell/research/indicator", "● Listening — captures go to the Ambient Scribe [Stop]", await page.textContent("#sa-mic").catch(() => null));
    await page.click("#sa-mic button").catch(() => {});
    check(await waitFor(() => !window.__voiceStub.live), "/shell/research/stop", false, await live());
    // Entering the Patient tab stops capture and shows the toast.
    await tab("scribe");
    check(await shellListen(), "/shell/patient/start", "listening", await stub());
    await tab("patient");
    check(await waitFor(() => !window.__voiceStub.live), "/shell/patient/stopped", false, await live());
    check(await waitFor((t) => document.body.textContent.includes(t), MIC_TOAST), "/shell/patient/toast", MIC_TOAST, "absent");
    check(await page.evaluate((sel) => { const b = document.querySelector(sel); return !!b && b.disabled; }, scribeListen), "/shell/patient/listen-disabled", true, false);
    // holdStart: the prompt still open while switching to the Patient tab.
    await tab("scribe");
    await call("holdStart", true);
    await page.click(scribeListen);
    check(await waitFor(() => window.__voiceStub.state === "starting"), "/shell/hold/starting", "starting", (await stub()).state);
    await tab("patient");
    await call("releaseStart");
    await page.waitForTimeout(300);
    check(!(await live()), "/shell/hold/no-live-session", false, await stub());
    await call("holdStart", false);
    // Patient mode: the clinician screens stay mounted (hidden, inert); Listen cannot start there.
    await tab("patient");
    const hand = page.locator("button", { hasText: "Hand to patient" });
    if (await hand.count()) {
      await hand.first().click();
      await page.waitForTimeout(200);
      const startsPm = (await stub()).starts;
      const disabled = await page.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return "absent"; b.click(); return b.disabled; }, scribeListen);
      await page.waitForTimeout(200);
      check(disabled === true || disabled === "absent", "/shell/mode/listen-disabled", true, disabled);
      check((await stub()).starts === startsPm && !(await live()), "/shell/mode/no-start", startsPm, await stub());
    } else {
      diffs.push({ path: "/shell/mode", input: null, a: "a Hand to patient button on the Patient tab", b: "absent" });
    }
    notes.push("shell: module switch with a live capture is not exercised here (needs a second module, WP12-M3 upload); the Scribe's remount stop is covered on the dev page");
  }

  // ------------------------------------------------------------------ part 3: layout
  if (generic) await layoutPart(ctx, check, notes);

  notes.unshift(`${n} checks; lexicon lang ${lexLang}`);
  return { verdict: diffs.length ? "fail" : "pass", n, diffs, expectedMissing: [], notes };
}
