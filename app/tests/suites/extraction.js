// tests/suites/extraction.js — free-text extraction parity (design 03 §8.3 `extraction`). Owner:
// WP13; accepts WP5 (with WP1's lexicon).
//
// baseline extract(text, opts) (MASQUE_Extraction.js, its own constants) vs the engine's
// extract(masque.lexicon, text, opts), deep-equal arrays with key order, over:
//   - the 44 utterances of the v0.3.1 gold set (reference/MASQUE_v0.3.1/masque_extraction_goldset.json,
//     SHA-256 pinned below; a mismatch is INVALID);
//   - every patient turn of the demo transcript (baseline Scribe SCRIPT);
//   - 5,000 synthetic utterances (1,000 with ?quick=1): 1-3 phrases drawn from the baseline
//     lexicon, each with a random negation / third-party / historical prefix or none;
// each × includeSuppressed ∈ {false, true} × negationWindow ∈ {8, 14, 20}.
// Also: createExtractor(lexicon) agrees with extract and reports the lexicon version;
// cueBefore/negatedNear agree with the baseline negatedNear; faersToUtterances agrees with the
// baseline on FAERS-shaped records (array and {results} forms, missing ids, records without
// reactions or narrative). Also: a lowercase form of a different length ("İ") does not shift
// the hit positions or the cue window. No difference is allowed: extraction has no AD (§8.4).
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { pick, sizes } from "../harness/matrix.js";

const GOLDSET_PATH = "../reference/MASQUE_v0.3.1/masque_extraction_goldset.json";
const GOLDSET_SHA256 = "e1d6573695e554e57dd44cfab3de6699dccc6518c42f2b28afa32d9ddcab6cb2";
const WINDOWS = [8, 14, 20];
const FILLERS = ["", "really ", "honestly ", "sometimes ", "I think ", "and ", "but ", "also "];
const JOINS = [", ", ". ", " and ", " — ", "; ", ", but "];

/** All phrases the baseline lexicon matches, by family (the synthetic vocabulary). */
function lexiconPhrases(ext) {
  const out = [];
  for (const e of ext.BOOL_EX) out.push(...e.ph);
  for (const e of ext.CTX_EX) out.push(...e.ph);
  for (const e of ext.SCALE_EX) { out.push(...e.cue); for (const b of e.bands) out.push(...b.ph); }
  for (const e of ext.MULTI_EX) out.push(...e.ph);
  for (const ph of Object.values(ext.RF_PHRASES)) out.push(...ph);
  return [...new Set(out)];
}

/** FAERS-shaped records (openFDA drug/event shape), built here so nothing is fetched. */
function faersFixture() {
  const records = [
    { safetyreportid: "10000001", patient: { reaction: [{ reactionmeddrapt: "Vertigo" }, { reactionmeddrapt: "Tinnitus" }] },
      narrativeincludeclinical: "The patient reported spinning dizziness with ringing in the ears after the second dose." },
    { safetyReportId: "10000002", patient: { reaction: [{ reactionmeddrapt: "Migraine" }] } },
    { patient: { reaction: [{ reactionmeddrapt: "Photophobia" }, { reactionmeddrapt: "" }, {}] },
      narrativeincludeclinical: "Reporter states light sensitivity and nausea; no family history provided." },
    { safetyreportid: "10000004", patient: {} },
    { safetyreportid: "10000005" },
    { safetyreportid: "10000006", narrativeincludeclinical: "Hearing dropped suddenly in one ear over a day." },
    { safetyreportid: 10000007, patient: { reaction: [{ reactionmeddrapt: "Headache" }] }, narrativeincludeclinical: "" },
    {},
  ];
  return [
    { name: "array", input: records },
    { name: "results", input: { results: records } },
    { name: "empty-results", input: { results: [] } },
    { name: "no-results", input: {} },
    { name: "null", input: null },
  ];
}

export default {
  name: "extraction",
  owner: "WP13",
  run: guarded("extraction", async (h) => {
    const { module, validation } = await loadMasque(h);
    const extraction = await h.engine("extraction.js");
    need(typeof extraction.extract === "function", "waits on WP5: extraction.extract");
    need(module.lexicon, "waits on WP1: the MASQUE rubric has no lexicon");
    const [ext, scb] = await Promise.all([h.oracle("MASQUE_Extraction.js"), h.oracle("MASQUE_Scribe_v0_3.jsx")]);
    const c = collector(h);
    c.note(validationNote(validation));
    const lex = module.lexicon;

    // Gold set, pinned.
    let gold = [];
    try {
      const bytes = await h.fetchBytes(GOLDSET_PATH);
      const sha = await h.sha256(bytes);
      if (sha !== GOLDSET_SHA256) {
        const e = new Error(`gold set ${GOLDSET_PATH}: sha256 ${sha.slice(0, 12)}… ≠ pinned ${GOLDSET_SHA256.slice(0, 12)}…`);
        e.invalid = true;
        throw e;
      }
      gold = JSON.parse(new TextDecoder().decode(bytes)).cases.map((x) => ({ src: `gold:${x.utteranceId}`, text: x.text }));
    } catch (err) {
      if (err.invalid) throw err;
      c.check(false, "/goldset", { path: GOLDSET_PATH }, "the v0.3.1 gold set (44 utterances)", `unreadable: ${err.message}`);
    }
    c.check(gold.length === 44 || !gold.length, "/goldset/length", null, 44, gold.length);
    const demo = scb.SCRIPT.filter(([role]) => role === "pt").map(([, text], i) => ({ src: `demo:pt#${i}`, text }));

    // Synthetic utterances.
    const rng = h.rng(h.seed ^ 0x45585452); // "EXTR"
    const phrases = lexiconPhrases(ext);
    const prefixes = [
      ...ext.NEGATION.cues.map((cue) => ({ kind: "negation", cue })),
      ...ext.THIRD_PARTY.cues.map((cue) => ({ kind: "third-party", cue })),
      ...ext.HISTORICAL.cues.map((cue) => ({ kind: "historical", cue })),
    ];
    const synth = [];
    const nSynth = sizes(h.quick).extraction;
    for (let i = 0; i < nSynth; i++) {
      const k = 1 + Math.floor(rng() * 3);
      const parts = [];
      for (let j = 0; j < k; j++) {
        const r = rng();
        const pre = r < 0.5 ? "" : `${pick(rng, prefixes).cue}${rng() < 0.5 ? " " : ""}`;
        const filler = pick(rng, FILLERS);
        let ph = pick(rng, phrases);
        if (rng() < 0.15) ph = ph.charAt(0).toUpperCase() + ph.slice(1);
        parts.push(`${pre}${filler}${ph}`);
      }
      let text = parts[0];
      for (let j = 1; j < parts.length; j++) text += pick(rng, JOINS) + parts[j];
      synth.push({ src: `synthetic#${i}`, text });
    }

    const corpus = [...gold, ...demo, ...synth];
    let compared = 0;
    for (const u of corpus) {
      for (const includeSuppressed of [false, true]) {
        for (const negationWindow of WINDOWS) {
          const opts = { includeSuppressed, negationWindow };
          const want = ext.extract(u.text, opts);
          let got;
          try {
            got = extraction.extract(lex, u.text, opts);
          } catch (err) {
            if (/not implemented/.test(err.message)) throw err;
            c.check(false, `/extract/threw`, { text: u.text, opts }, "captures", String(err.message));
            continue;
          }
          c.diff(want, got, { at: `/extract/${u.src}`, input: { text: u.text, opts }, keyOrder: true });
          compared++;
        }
      }
      // The shipped defaults (no opts) too.
      c.diff(ext.extract(u.text), extraction.extract(lex, u.text), { at: `/extract/${u.src}/defaults`, input: { text: u.text }, keyOrder: true });
      compared++;
      if (compared % 3000 < 7) await new Promise((r) => setTimeout(r, 0));
    }
    c.note(`extract: ${gold.length} gold + ${demo.length} demo turns + ${synth.length} synthetic utterances × includeSuppressed {false, true} × negationWindow {${WINDOWS.join(", ")}} (+ defaults) = ${compared} comparisons`);

    // createExtractor and the negation helper.
    if (typeof extraction.createExtractor === "function") {
      const ex = extraction.createExtractor(lex);
      c.check(ex.lexiconVersion === ext.LEXICON_VERSION, "/createExtractor/lexiconVersion", null, ext.LEXICON_VERSION, ex.lexiconVersion);
      for (const u of [...gold, ...demo].slice(0, 60)) {
        c.diff(ext.extract(u.text), ex.extract(u.text), { at: `/createExtractor/${u.src}`, input: { text: u.text }, keyOrder: true });
        for (let idx = 0; idx <= u.text.length; idx += 7) {
          c.diff(ext.negatedNear(u.text, idx), ex.negatedNear(u.text, idx), { at: `/negatedNear/${u.src}/${idx}`, input: { text: u.text, idx } });
        }
      }
    } else {
      c.check(false, "/createExtractor", null, "function", "absent (waits on WP5)");
    }
    c.check(extraction.EXTRACTOR_KIND === ext.EXTRACTOR_KIND, "/EXTRACTOR_KIND", null, ext.EXTRACTOR_KIND, extraction.EXTRACTOR_KIND);

    // FAERS adapter.
    for (const f of faersFixture()) {
      let want, got;
      try { want = ext.faersToUtterances(f.input); } catch (err) { want = `throws: ${err.message}`; }
      try { got = extraction.faersToUtterances(f.input); } catch (err) { got = `throws: ${err.message}`; }
      c.diff(want, got, { at: `/faersToUtterances/${f.name}`, input: f.input, keyOrder: true });
    }

    // Lowercasing that changes the length ("İ" → "i̇") must not shift the cue window: hit
    // positions and the window are measured in the original text's index space.
    {
      const tiny = { version: "t", negation: { window: 12, cues: ["no "] }, thirdParty: { window: 10, cues: [] }, historical: { window: 10, cues: [] },
        bool: [{ id: "spin", ph: ["spinning"] }], ctx: [], scale: [], multi: [], redFlags: {} };
      for (const text of ["no Istanbul spinning", "no İstanbul spinning", "no İİ spinning"]) {
        const got = extraction.extract(tiny, text).map((x) => `${x.id}=${x.value}@${x.cueIndex}`);
        const want = [`spin=no@${text.indexOf("spinning")}`];
        c.diff(want, got, { at: "/extract/@unicodeLowercase", input: { text } });
      }
      c.check(extraction.allHits("İİ spinning SPINNING", ["spinning"]).join(",") === "3,12", "/allHits/@unicodeLowercase", { text: "İİ spinning SPINNING" }, "3,12",
        extraction.allHits("İİ spinning SPINNING", ["spinning"]).join(","));
    }
    return c.result();
  }),
};
