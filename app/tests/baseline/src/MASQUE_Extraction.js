/*  Project MASQUE — free-text extraction module

    Proposal §7.2 commits to "developing and benchmarking free-text extraction on
    openFDA narratives". The conformance audit found the extraction built but the
    benchmark absent: rules lived inline in the scribe, the negation window was an
    unexplained constant, the phrase lists carried no version, and no precision or
    recall had ever been measured.

    Splitting the engine out of the UI is the precondition for the rest. A rule set
    embedded in a React component cannot be benchmarked, swept, versioned, or run
    against a corpus — so this module owns the lexicon and the extract function, and
    MASQUE_Scribe imports it. MASQUE_Extraction_Benchmark.mjs imports the same
    module, which is the point: the harness scores the code that ships, not a copy.

    LEXICON_VERSION changes whenever a phrase list changes. Benchmark reports record
    it, so a claimed precision/recall is always attributable to a specific rule set.

    Honest scope: this is a transparent rule-based extractor, not a learned model.
    That is a deliberate choice for a safety-adjacent prototype — every capture can
    be traced to the phrase that produced it — but it caps achievable recall, and the
    benchmark exists to say by how much rather than to flatter it.
*/

export const LEXICON_VERSION = "0.3.1";
export const EXTRACTOR_KIND = "rule-based / phrase-match with local negation";

/*  Negation.

    The window was 22 characters with no recorded justification. It is now a named,
    swept parameter — MASQUE_Extraction_Benchmark.mjs reports F1 across window sizes
    so the shipped value is an empirical choice rather than a guess.

    Known limitation, and the main source of false positives: this is a character
    window, not a syntactic scope. "No nausea, but the light sensitivity is awful"
    negates correctly; "I don't get the aura my sister gets" does not, because the
    negation attaches to a clause the window cannot see.
*/
export const NEGATION = {
  // 14 chars, set by the sweep in MASQUE_Extraction_Benchmark.mjs rather than by
  // guess. F1 plateaus across 14/18/22 and falls at 26 and above; the smallest
  // window on a plateau is preferred because a narrower scope is the more
  // conservative reading of a negation — it errs toward capturing a symptom the
  // patient mentioned rather than deleting one they didn't deny.
  // Re-run the sweep after any phrase-list change; the optimum moves with the lexicon.
  window: 14,
  cues: ["no ", "not ", "n't", "never", "without", "none", "haven't", "hasn't",
         "didn't", "don't", "doesn't", "isn't", "denies", "negative for"],
};

/*  Attribution cues — symptoms belonging to someone other than the patient.

    Added after benchmarking: "my mother gets migraines" was being captured as the
    patient's own migraine features rather than as family history. The clause is real
    information, just about a different person, so these suppress the symptom capture
    while family-history phrases still fire independently.
*/
export const THIRD_PARTY = {
  window: 34,
  cues: ["my mother", "my mom", "my father", "my dad", "my sister", "my brother",
         "my daughter", "my son", "my wife", "my husband", "my partner",
         "her ", "his ", "they get", "runs in"],
};

/*  Historical cues — resolved or past-tense symptoms.

    "I used to get auras" is not a current finding. Without this the extractor
    reports a symptom the patient has just told you they no longer have.
*/
export const HISTORICAL = {
  window: 30,
  cues: ["used to", "years ago", "as a teenager", "when i was young", "back then",
         "no longer", "stopped getting", "haven't had that in"],
};

// ---------------------------------------------------------------------------
// Lexicon
// ---------------------------------------------------------------------------

export const BOOL_EX = [
  { id: "m_photo",  ph: ["light bother","bright light","sensitive to light","light sensitiv","lights make","photophobia","loud sound","noise bother","sound sensitiv"] },
  { id: "m_nausea", ph: ["nausea","nauseous","queasy","throw up","vomit"] },
  { id: "m_disable",ph: ["can't work","miss work","lie down","stops me","have to stop","debilitat","couldn't function"] },
  { id: "m_aura",   ph: ["aura","see spots","zigzag","shimmer","flashing","vision changes before"] },
  { id: "m_trig",   ph: ["weather","barometric","before it rains","storm","my period","hormonal","lack of sleep","skip meal","skipped meal","missed meal"] },
  { id: "m_fhx",    ph: ["family history of migraine","mom had migraine","mother had migraine","mother gets migraine","mom gets migraine","migraines run","i get migraine","i have migraine"], thirdPartyExempt: true },
  { id: "v_motion", ph: ["busy place","grocery","aisle","scrolling","scroll on","driving makes","car sick","carsick","motion","visually busy","crowded"] },
  { id: "v_aural",  ph: ["ear feels full","fullness in my ear","ear full","plugged","ringing","tinnitus","ear ring"] },
  { id: "v_head",   ph: ["move my head","head position","rolling over","looking up","bend over","positional"] },
  { id: "n_burn",   ph: ["burning","tingling","pins and needles","numb","electric","shooting pain"] },
  { id: "n_otalgia",ph: ["deep ear pain","ear pain but","aches deep in my ear","throat pain","ear ache","earache"] },
  { id: "n_auto",   ph: ["dry eyes","dry mouth","lightheaded when i stand","dizzy when i stand","sweating more","sweating less","stomach empties"] },
  { id: "n_viral",  ph: ["after covid","after a virus","after being sick","since my cold","post viral","after the flu","following a viral","after a viral","viral illness"] },
  { id: "n_allo",   ph: ["out of proportion","overly sensitive","hurts to touch","light touch"] },
  { id: "r_abx",    ph: ["rounds of antibiotic","antibiotic","augmentin","amoxicillin","steroid spray","steroids didn't","course of steroid","prednisone"] },
  { id: "r_surg",   ph: ["sinus surgery","septoplasty","fess","had surgery on my sinus","sinus procedure"] },
  { id: "r_normal", ph: ["ct was normal","scan was normal","looked normal","basically normal","nothing on imaging","imaging was clear","ct was clear","everything looked fine","no acute abnormality","unremarkable","within normal limits"] },
  { id: "r_lesion", ph: ["didn't find anything","nothing wrong","no cause found","couldn't find a reason","workup was normal"] },
  // v0.2 items — criteria-anchored, so a miss here costs a Bárány/ICHD label.
  { id: "v_count",  ph: ["five episodes","five spells","half a dozen","dozens of","lost count","too many to count","every few weeks for"] },
  { id: "v_migfeat",ph: ["headache with the dizz","headache when i'm dizzy","headache with my spells","spells come with a headache","light bothers me during the spell"] },
  // Discriminators — negative-weight, so a false positive here pulls the index down.
  { id: "x_purulent",  ph: ["green mucus","yellow mucus","thick discharge","coloured discharge","colored discharge","culture grew","positive culture","purulent"] },
  { id: "x_objective", ph: ["ct showed","scan showed inflammation","opacification","mucosal thickening","lund-mackay","scope showed","polyps"] },
  { id: "x_lowfreq",   ph: ["hearing test showed","audiogram showed","low frequency loss","hearing drops during","hearing comes back"] },
  { id: "x_anosmia",   ph: ["can't smell","lost my smell","no sense of smell","smell is gone","anosmia"] },
];

export const CTX_EX = [
  { id: "c_dismiss", val: "yes", ph: ["anxiety","stress","in my head","all in your head","nothing wrong with you","psychosomatic"] },
];

export const SCALE_EX = [
  { id: "m_head", cue: ["facial pressure","behind my eyes","sinus headache","headache","facial pain","pressure in my face"],
    bands: [{ ph: ["every day","daily","constant","all the time","most days"], v: 2 }], fallback: 1 },
  // Duration bands, not frequency — the v0.2 scale measures how long an episode
  // lasts. Hearing "dizzy" with no duration cue leaves the item unanswered for the
  // prompt to ask rather than guessing a band that feeds a criteria-anchored label.
  { id: "v_vertigo", cue: ["dizzy","dizziness","vertigo","spinning","off balance","off-balance","room spins"],
    bands: [
      { ph: ["few seconds","seconds","a minute","couple of minutes","very brief","momentary"], v: 1 },
      { ph: ["for days","several days","all week","constant for"], v: 3 },
      { ph: ["minutes","half an hour","an hour","hours","all day","most of the day"], v: 2 },
    ], fallback: null },
  { id: "m_dur", cue: ["lasts","last for","goes on for","sticks around"],
    bands: [
      { ph: ["all day","a day or two","two days","three days","couple of days","rest of the day","into the next day"], v: 2 },
      { ph: ["more than three days","four days","a week","over 72"], v: 3 },
      { ph: ["an hour or two","couple of hours","hour or so","under an hour","half an hour"], v: 1 },
    ], fallback: null },
  { id: "i_days", cue: ["every day","daily","most days","half the month","ten days","constantly"],
    bands: [], fallback: 3 },
  { id: "i_role", cue: ["can't work","miss work","quit my job","had to stop working"],
    bands: [], fallback: 3 },
];

export const MULTI_EX = [
  { ids: [{ id: "r_dur", value: "yes", kind: "item" }, { id: "c_dur", value: ">12mo", kind: "ctx" }],
    ph: ["over a year","for years","a year now","more than a year","past year","several months","for months"] },
  { ids: [{ id: "c_clin", value: "3+", kind: "ctx" }],
    ph: ["three doctor","four doctor","three or four","several doctor","multiple doctor","bunch of specialist","every specialist","so many doctor"] },
];

/*  Red-flag cues.

    Owned here so the benchmark can score them, but with one rule that does not apply
    to anything else in this file: red flags are NEVER negation-checked, attribution-
    checked, or history-checked. A cue phrase raises the flag for clinician review and
    nothing in the text may lower one. Precision on red flags is therefore expected to
    be poor by design, and the benchmark reports it separately rather than blending it
    into the headline number — optimising it would mean letting text suppress a safety
    prompt, which is the wrong trade.
*/
export const RF_PHRASES = {
  rf_thunderclap: ["worst headache","thunderclap","came on in seconds","hit me all at once","like a thunderclap"],
  rf_focal:       ["double vision","slurred","face went numb","numb on one side","weak on one side","droop","trouble swallowing","words wouldn't come"],
  rf_vision:      ["losing my vision","vision greys","grey out","blacks out","going blind","vision dims"],
  rf_gca:         ["jaw aches when i chew","jaw hurts when i chew","scalp is tender","tender scalp","hurts to brush my hair"],
  rf_orbital:     ["eye is swollen","swelling around my eye","eye is bulging","can't move my eye","eye hurts to move"],
  rf_ssnhl:       ["hearing dropped","lost my hearing","hearing went out","went deaf","suddenly couldn't hear"],
  rf_asym:        ["only my left ear","only my right ear","just the left ear","just the right ear","only in one ear","always the same ear"],
  rf_pulsatile:   ["with my heartbeat","hear my heartbeat","whooshing","pulsing sound","pulsatile"],
  rf_progressive: ["worse when i lie down","worse lying down","wakes me up","worse in the morning","worse when i cough","when i strain","getting worse every"],
  rf_new50:       ["never had headaches before","first time i've had","started in my fifties","started in my sixties"],
  rf_mass:        ["nosebleed","bloody nose","blocked on one side","one side is blocked","cheek is numb","numb cheek"],
  rf_systemic:    ["night sweats","losing weight","lost weight without","fevers","chemotherapy","i have cancer","had cancer"],
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function firstHit(text, phrases) {
  const low = text.toLowerCase();
  for (const p of phrases) { const i = low.indexOf(p); if (i !== -1) return i; }
  return -1;
}

/*  Every position a phrase list matches, not just the first.

    First-hit-only produced a value error the benchmark caught: in "it's not the
    weather, I checked — it's when I skip meals" the extractor found the negated
    "weather", stopped, and recorded m_trig = no. The patient had just named a
    trigger. Scanning all hits and preferring an unnegated one is both more correct
    and cheap — a single unnegated mention is an affirmation regardless of what else
    in the sentence is denied.
*/
export function allHits(text, phrases) {
  const low = text.toLowerCase();
  const out = [];
  for (const p of phrases) {
    let i = low.indexOf(p);
    while (i !== -1) { out.push(i); i = low.indexOf(p, i + p.length); }
  }
  return out.sort((a, b) => a - b);
}

function cueBefore(text, idx, spec) {
  const pre = text.slice(Math.max(0, idx - spec.window), idx).toLowerCase();
  return spec.cues.some(c => pre.includes(c));
}

export const negatedNear = (text, idx, window = NEGATION.window) =>
  cueBefore(text, idx, { window, cues: NEGATION.cues });
const thirdPartyNear = (text, idx) => cueBefore(text, idx, THIRD_PARTY);
const historicalNear = (text, idx) => cueBefore(text, idx, HISTORICAL);

/*  extract(text, opts)

    Returns [{ id, value, kind, evidence, cueIndex, suppressedBy? }].

    opts.negationWindow overrides the shipped window — used by the benchmark sweep.
    opts.includeSuppressed returns items that matched but were suppressed by a
    negation, attribution, or history cue, which is what makes error analysis
    possible: a false negative caused by over-eager negation looks completely
    different from one caused by a vocabulary gap, and the fix is different too.
*/
export function extract(text, opts = {}) {
  const win = opts.negationWindow ?? NEGATION.window;
  const keep = !!opts.includeSuppressed;
  const found = [];
  const push = (o) => found.push(o);
  const gated = (id, kind, i, value, exempt = {}) => {
    // Family history is INHERENTLY third-party — "my mother gets migraines" is the
    // finding, not a misattribution of it. Gating it lost every family-history
    // capture phrased the way people actually phrase it.
    if (!exempt.thirdParty && thirdPartyNear(text, i)) { if (keep) push({ id, value, kind, evidence: text, cueIndex: i, suppressedBy: "third-party" }); return; }
    if (historicalNear(text, i)) { if (keep) push({ id, value, kind, evidence: text, cueIndex: i, suppressedBy: "historical" }); return; }
    push({ id, value, kind, evidence: text, cueIndex: i });
  };

  // Red flags: no gating of any kind. See RF_PHRASES.
  for (const [id, ph] of Object.entries(RF_PHRASES)) {
    const i = firstHit(text, ph);
    if (i !== -1) push({ id, value: true, kind: "redflag", evidence: text, cueIndex: i });
  }

  for (const ex of BOOL_EX) {
    const hits = allHits(text, ex.ph);
    if (!hits.length) continue;
    const unnegated = hits.find(i => !negatedNear(text, i, win));
    const i = unnegated ?? hits[0];
    gated(ex.id, "item", i, unnegated === undefined ? "no" : "yes",
          { thirdParty: !!ex.thirdPartyExempt });
  }

  for (const ex of CTX_EX) {
    const i = firstHit(text, ex.ph);
    if (i === -1 || negatedNear(text, i, win)) continue;
    gated(ex.id, "ctx", i, ex.val);
  }

  for (const ex of SCALE_EX) {
    const i = firstHit(text, ex.cue);
    if (i === -1 || negatedNear(text, i, win)) continue;
    let v = ex.fallback;
    for (const b of ex.bands) { if (firstHit(text, b.ph) !== -1) { v = b.v; break; } }
    if (v === null || v === undefined) continue;
    gated(ex.id, "item", i, v);
  }

  for (const ex of MULTI_EX) {
    const i = firstHit(text, ex.ph);
    if (i === -1 || negatedNear(text, i, win)) continue;
    for (const t of ex.ids) gated(t.id, t.kind, i, t.value);
  }

  return found;
}

/*  openFDA adapter.

    Proposal §6 lists openFDA / FAERS with the purpose "narrative NLP development",
    and §7.2 specifies benchmarking on those narratives. Access is pending, so this
    maps the FAERS record shape onto the harness input without having been run
    against live data — it is a declared interface, not a validated one, and the
    benchmark report says so wherever it appears.

    FAERS narratives differ from encounter speech in ways that will cost recall: third
    person throughout ("the patient reported"), clinical register rather than the
    colloquial phrasing most of the lexicon encodes, and reporter-attributed rather
    than patient-attributed symptoms. The gold set below includes narrative-register
    cases so the gap is measured rather than discovered later.
*/
export function faersToUtterances(records) {
  const arr = Array.isArray(records) ? records : (records?.results ?? []);
  return arr.flatMap(rec => {
    const id = rec.safetyreportid ?? rec.safetyReportId ?? null;
    const texts = [];
    for (const r of rec.patient?.reaction ?? []) {
      if (r.reactionmeddrapt) texts.push(r.reactionmeddrapt);
    }
    if (rec.narrativeincludeclinical) texts.push(rec.narrativeincludeclinical);
    return texts.filter(Boolean).map((text, k) => ({
      utteranceId: id ? `faers-${id}-${k}` : `faers-anon-${k}`,
      register: "narrative",
      speaker: "reporter",
      text: String(text),
    }));
  });
}
