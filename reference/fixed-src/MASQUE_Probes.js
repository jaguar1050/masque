/*  Project MASQUE — real-time encounter probes
    Release 0.3.1 · PROBE_SET_VERSION 1.0.0 · instrument 0.2

    What to ask or do next, while the patient is still in the room.

    This module owns the probe set for the same reason MASQUE_Extraction.js owns the
    lexicon: rules embedded in a React component cannot be validated, versioned, or
    reviewed by a clinician who does not read JSX. MASQUE_Scribe imports it, the
    simulator imports it, and validateProbes() is run at module load by both.

    PROBE_SET_VERSION moves whenever a probe is added, removed, or reworded. It is
    independent of INSTRUMENT_VERSION on purpose — see the rescue/phenotype note below.
    Adding probes has not changed a single scored item, weight, or cutpoint, so
    instrument 0.2 remains correct and cohorts stay comparable.

    Clinical content is drawn from the Bárány Society / IHS consensus criteria for
    vestibular migraine and the surrounding literature. All patient-facing wordings are
    authored for this tool rather than reproduced from those documents.
*/

/*  Real-time probes — what to ask or do next, while the patient is still in the room.

    The scribe's original suggestion list ranked unanswered scored items by weight.
    That is fine for filling in a questionnaire and wrong for a live encounter, because
    the highest-weight unanswered item is almost never the most urgent thing to say.
    These probes are triggered by what has ALREADY been captured, and ranked by what
    the answer could change rather than by how many points it is worth.

    Ranking, strictest first:

      safety    the answer could surface a red flag. Ranked above everything, including
                items worth more points. A prompt list that puts a 6-point index item
                above "does the ringing pulse with your heartbeat" is a prompt list that
                helps you score a patient faster while missing the thing that mattered.
      criteria  the answer completes an ICHD-3 or Bárány anchor definition. Without
                these the screen cannot be crosswalked to a reference label at all, so a
                missing one costs more than its weight suggests.
      ruleout   the answer can LOWER the index. Deliberately ranked above ordinary
                index items: a prompt list that only asks questions capable of
                confirming its own hypothesis is a leading question with a progress bar.
      exam      a manoeuvre rather than a question, for while you are already examining.

    The tinnitus-quality probe is the archetype. "There's a ringing" is an ordinary
    4-point aural finding. Its QUALITY is the difference between vestibular migraine and
    a dural fistula, and no patient volunteers it, because nobody has ever asked.
*/
const PROBE_KIND = {
  safety:    { rank:0, label:"Safety",    c:"var(--coral)",  bg:"var(--coralbg)" },
  rescue:    { rank:1, label:"Re-ask",    c:"#7A4DA8",       bg:"#F0EAF7" },
  criteria:  { rank:2, label:"Criteria",  c:"var(--petrol)", bg:"#E4EFED" },
  ruleout:   { rank:3, label:"Rule-out",  c:"var(--amber)",  bg:"var(--amberbg)" },
  phenotype: { rank:4, label:"Supporting",c:"#2A6E8A",       bg:"#E3EFF4" },
  exam:      { rank:5, label:"Exam",      c:"var(--slate)",  bg:"#E9EEED" },
};

const PROBES = [
  // ---- safety: the answer could surface a red flag ----
  { id:"pr_tinnitus_quality", kind:"safety", when:a => a.v_aural==="yes",
    say:"The ringing — has the quality changed at all? Does it pulse in time with your heartbeat, or click?",
    why:"Pulsatile tinnitus is vascular until proven otherwise. Clicking points instead at palatal myoclonus or eustachian dysfunction.",
    opts:[{ l:"Pulses with heartbeat", rf:"rf_pulsatile" },
          { l:"Clicking", note:"Clicking quality — palatal myoclonus / ETD, not a red flag" },
          { l:"Steady tone, unchanged" }] },
  { id:"pr_laterality", kind:"safety", when:a => a.v_aural==="yes",
    say:"When the ringing or fullness happens, is it always the same ear?",
    why:"Consistently unilateral aural symptoms are retrocochlear until imaging says otherwise. This is the single most common thing a migraine-shaped story hides.",
    opts:[{ l:"Always the same ear", rf:"rf_asym" },
          { l:"Both ears, or it moves" }] },
  { id:"pr_sudden_drop", kind:"safety", when:a => a.v_aural==="yes",
    say:"Has your hearing ever dropped suddenly — over hours or a day — rather than gradually?",
    why:"Sudden SNHL has a steroid window measured in days. A gradual story and a sudden one get completely different urgency.",
    opts:[{ l:"Yes, suddenly", rf:"rf_ssnhl" }, { l:"Gradual, or no change" }] },
  { id:"pr_posture", kind:"safety", when:a => (a.m_head??0)>0,
    say:"Is the headache worse when you lie flat, first thing on waking, or when you cough or strain?",
    why:"Postural and Valsalva-dependent headache is raised intracranial pressure until excluded.",
    opts:[{ l:"Yes, clearly worse", rf:"rf_progressive" }, { l:"No positional pattern" }] },
  { id:"pr_onset", kind:"safety", when:a => (a.m_head??0)>0,
    say:"Has any one of these ever come on at full force within about a minute?",
    why:"Thunderclap onset buried inside a chronic headache history is easy to miss and is a same-day question.",
    opts:[{ l:"Yes, one came on instantly", rf:"rf_thunderclap" }, { l:"Always builds gradually" }] },
  { id:"pr_gca", kind:"safety", when:a => (a.m_head??0)>0,
    say:"If they're over 50 — any scalp tenderness when brushing hair, or jaw ache while chewing?",
    why:"Giant cell arteritis presents as a new headache and takes vision irreversibly. Ask on age alone, not on suspicion.",
    opts:[{ l:"Yes, either", rf:"rf_gca" }, { l:"Neither", }, { l:"Under 50 — not applicable" }] },
  { id:"pr_nasal_mass", kind:"safety", when:a => a.r_normal==="yes" || a.r_abx==="yes",
    say:"Is one side of the nose blocked more than the other, with any bleeding or numbness of the cheek?",
    why:"Unilateral obstruction with epistaxis or V2 numbness is a sinonasal malignancy until endoscopy says otherwise.",
    opts:[{ l:"Yes, one-sided", rf:"rf_mass" }, { l:"Symmetric, no bleeding" }] },

  // ---- criteria: completes an anchor definition ----
  { id:"pr_episode_count", kind:"criteria", when:a => (a.v_vertigo??0)>0, target:"v_count",
    say:"Roughly how many of these dizzy episodes have you had in total — more or fewer than five?",
    why:"Bárány vestibular migraine criterion A is at least five episodes. Without a count the screen cannot be crosswalked to the diagnosis at all.",
    opts:[{ l:"Five or more", a:{ v_count:"yes" } }, { l:"Fewer than five", a:{ v_count:"no" } }] },
  { id:"pr_migfeat", kind:"criteria", when:a => (a.v_vertigo??0)>0, target:"v_migfeat",
    say:"Think of your last several episodes — did at least half come with headache, or with light and sound bothering you?",
    why:"Bárány criterion C is migrainous features in at least 50% of episodes. \"Sometimes\" is not the same answer.",
    opts:[{ l:"At least half", a:{ v_migfeat:"yes" } }, { l:"Fewer than half", a:{ v_migfeat:"no" } }] },
  { id:"pr_attack_duration", kind:"criteria", when:a => (a.m_head??0)>0, target:"m_dur",
    say:"If you don't treat it at all, how long does one attack run?",
    why:"ICHD-3 1.1 B is 4 to 72 hours untreated. Treated duration answers a different question and will not map.",
    opts:[{ l:"4 to 72 hours", a:{ m_dur:2 } }, { l:"Under 4 hours", a:{ m_dur:1 } },
          { l:"Over 72 hours", a:{ m_dur:3 } }, { l:"Too variable to say", a:{ m_dur:4 } }] },

  // ---- rule-out: the answer can lower the index ----
  { id:"pr_scan_detail", kind:"ruleout", when:a => a.r_normal==="yes", target:"x_objective",
    say:"What did the scan actually report — any mucosal thickening, opacification, or polyps?",
    why:"\"Normal\" in a patient's account and \"normal\" in a radiology report are frequently different documents. Objective inflammation argues against the masquerade.",
    opts:[{ l:"Real inflammation reported", a:{ x_objective:"yes" } }, { l:"Genuinely clear", a:{ x_objective:"no" } }] },
  { id:"pr_purulence", kind:"ruleout", when:a => a.r_abx==="yes", target:"x_purulent",
    say:"During a bad stretch, is there thick coloured drainage — and did any swab ever grow something?",
    why:"Purulence with a positive culture points at genuine bacterial sinusitis, which is the diagnosis this screen exists to avoid overriding.",
    opts:[{ l:"Yes, purulent or culture-positive", a:{ x_purulent:"yes" } }, { l:"Clear or no drainage", a:{ x_purulent:"no" } }] },
  { id:"pr_audiogram", kind:"ruleout", when:a => a.v_aural==="yes", target:"x_lowfreq",
    say:"Have you had two hearing tests at different times — did the low tones drop and then come back?",
    why:"Documented fluctuating low-frequency loss is Ménière's until proven otherwise, and it pulls hard against the migraine reading.",
    opts:[{ l:"Yes, it fluctuates", a:{ x_lowfreq:"yes" } }, { l:"Stable, or never tested twice", a:{ x_lowfreq:"no" } }] },
  { id:"pr_smell", kind:"ruleout", when:a => a.r_abx==="yes" || a.r_normal==="yes", target:"x_anosmia",
    say:"Between the bad episodes, is your sense of smell normal?",
    why:"Persistent hyposmia between flares is sinonasal disease, not a migrainous driver.",
    opts:[{ l:"Reduced even between flares", a:{ x_anosmia:"yes" } }, { l:"Normal in between", a:{ x_anosmia:"no" } }] },

  // ---- exam: manoeuvres for while you are already examining ----
  { id:"pr_dix_hallpike", kind:"exam", when:a => (a.v_vertigo??0)>0,
    say:"Dix–Hallpike, both sides.",
    why:"Positional nystagmus with the classic latency and fatigue is BPPV, which is treatable at the bedside and does not need any of this.",
    opts:[{ l:"Positive — torsional, fatigable", note:"BPPV pattern on Dix–Hallpike" },
          { l:"Negative both sides", note:"Dix–Hallpike negative bilaterally" }, { l:"Deferred" }] },
  { id:"pr_head_impulse", kind:"exam", when:a => (a.v_vertigo??0)>0,
    say:"Head impulse, and check for skew and direction-changing nystagmus.",
    why:"A normal head impulse in an acutely vertiginous patient points central, not peripheral — the opposite of reassuring.",
    opts:[{ l:"Normal impulse (points central)", note:"HINTS: normal head impulse — central pattern" },
          { l:"Corrective saccade (peripheral)", note:"HINTS: corrective saccade — peripheral pattern" }, { l:"Deferred" }] },
  { id:"pr_tuning_fork", kind:"exam", when:(a,rf) => !!rf.rf_asym,
    say:"Weber and Rinne at 512 Hz before they leave.",
    why:"Thirty seconds of tuning fork tells you whether the asymmetry is conductive or sensorineural, and that changes what you order.",
    opts:[{ l:"Sensorineural pattern", note:"Weber/Rinne: sensorineural pattern on the affected side" },
          { l:"Conductive pattern", note:"Weber/Rinne: conductive pattern" }, { l:"Deferred" }] },
  { id:"pr_temporal_artery", kind:"exam", when:a => (a.m_head??0)>0,
    say:"Palpate the temporal arteries — tenderness, thickening, or absent pulse.",
    why:"Free, immediate, and the one exam finding that should send bloods off the same afternoon.",
    opts:[{ l:"Tender or pulseless", rf:"rf_gca" }, { l:"Normal" }, { l:"Deferred" }] },
];

/*  Vestibular-migraine phenotype probes, from the Bárány/IHS consensus literature.

    THE PROBLEM THESE EXIST FOR

    The Bárány Society and IHS consensus enumerates five qualifying vestibular symptom
    types for vestibular migraine: spontaneous vertigo — split into INTERNAL (a false
    sensation of self-motion) and EXTERNAL (the surround appears to spin or flow) —
    positional vertigo, visually-induced vertigo, head motion-induced vertigo, and head
    motion-induced dizziness WITH NAUSEA. Plain dizziness without nausea does not
    qualify; that is a deliberate line in the criteria, not an oversight.

    Instrument v0.2 asks about vertigo essentially once, in the vocabulary of external
    spinning. That under-detects, and it under-detects asymmetrically. In a published
    definite-VM cohort, internal vertigo was reported by MORE patients than external
    vertigo — so the commonest qualifying presentation is the one a "do you get spinning
    episodes?" question is least likely to capture. A patient whose head feels like it is
    rocking on a boat will answer no, and the vestibular arm of the screen collapses on a
    false negative.

    The same cohort found photophobia/phonophobia accompanying vestibular symptoms in
    about three quarters of patients while headache accompanied well under half. Criterion
    C is satisfied by headache OR photophobia-plus-phonophobia OR visual aura — so a probe
    that leads with headache is asking about the least common of the three.

    TWO KINDS, AND WHY THE DISTINCTION IS LOAD-BEARING

    rescue     An alternate PHRASING for an item that already exists in v0.2. Answering it
               sets that existing item. Nothing about the instrument changes, so cohorts
               stay comparable and INSTRUMENT_VERSION stays 0.2. Uniquely among probes, a
               rescue fires when its target has been answered NEGATIVELY — because the
               whole point is that the first phrasing may have produced a false negative.

    phenotype  A supporting feature from the literature with no home in v0.2 at all. These
               are recorded as observations and move the index by exactly zero. They are
               NOT Bárány criteria and must not be totalled as though they were: they
               raise or lower a clinician's suspicion, and scoring them would be inventing
               a measurement the validated instrument does not make. Each is tagged as an
               instrument v0.3 candidate, which is a decision for the clinical lead and a
               version bump, not something a prompt panel gets to do quietly.

    Wordings below are authored for this tool, not reproduced from the criteria documents.
*/
const VM_PROBES = [
  // ---- rescue: the five qualifying symptom types, in patient vocabulary ----
  { id:"pr_internal_vertigo", kind:"rescue", rescues:"v_vertigo",
    when:(a) => (a.v_vertigo === undefined || a.v_vertigo === 0),
    say:"Does your head ever feel like it's bobbing, rocking, or swaying side to side — like still being on a boat after you've stepped off — even while you're sitting perfectly still?",
    why:"Internal vertigo — a false sense of self-motion — qualifies under Bárány exactly as spinning does, and in published cohorts it is reported by more patients than external spinning. Someone who denies “vertigo” will often endorse this immediately.",
    opts:[{ l:"Yes — rocking or bobbing", a:{ v_vertigo:2 } },
          { l:"Yes, but only seconds at a time", a:{ v_vertigo:1 },
            note:"Internal vertigo lasting seconds — below the 5-minute Bárány floor; a recognised minority pattern that does not qualify on duration" },
          { l:"No sensation of self-motion" }] },

  { id:"pr_visual_vertigo", kind:"rescue", rescues:"v_motion",
    when:(a) => (a.v_motion === undefined || a.v_motion === "no"),
    say:"Does it get set off by moving visual scenes — driving through a tunnel, traffic streaming past, scrolling on a phone, supermarket aisles, patterned carpet, or a crowd moving around you?",
    why:"Visually-induced vertigo is its own qualifying symptom type. Patients rarely volunteer it because it feels like a quirk rather than a symptom — nobody reports a tunnel to their doctor.",
    opts:[{ l:"Yes, clearly visually triggered", a:{ v_motion:"yes" } },
          { l:"No visual trigger", a:{ v_motion:"no" } }] },

  { id:"pr_positional", kind:"rescue", rescues:"v_head",
    when:(a) => (a.v_head === undefined || a.v_head === "no"),
    say:"Does rolling over in bed, lying back, or reaching up to a high shelf bring it on?",
    why:"Positional vertigo qualifies in its own right. It also overlaps BPPV, which is why the Dix–Hallpike probe sits alongside this one rather than instead of it.",
    opts:[{ l:"Yes, positional", a:{ v_head:"yes" } },
          { l:"No positional trigger", a:{ v_head:"no" } }] },

  // Not a rescue: this fires only once v_head is already positive, so it has no negative
  // answer to correct. It supplies the nausea qualifier, which is what makes head-motion
  // dizziness qualify at all — criteria work, and mislabelling it as a rescue would have
  // put it in the never-truncate tier it does not need.
  { id:"pr_headmotion_nausea", kind:"criteria", target:"m_nausea",
    when:(a) => a.v_head === "yes" && a.m_nausea === undefined,
    say:"When you turn your head quickly and feel off, does queasiness come with it?",
    why:"Head motion-induced DIZZINESS qualifies only when nausea accompanies it — dizziness alone is explicitly excluded. The nausea is not a detail, it is the qualifying clause.",
    opts:[{ l:"Yes, nausea with it", a:{ m_nausea:"yes" } },
          { l:"No nausea", a:{ m_nausea:"no" },
            note:"Head-motion dizziness without nausea — does not qualify as a Bárány vestibular symptom" }] },

  { id:"pr_photophono_only", kind:"rescue", rescues:"v_migfeat",
    when:(a) => (a.v_migfeat === undefined || a.v_migfeat === "no") && (a.v_vertigo ?? 0) > 0,
    say:"During the episodes themselves — never mind headache — do light AND sound both bother you, or do you get any visual disturbance beforehand?",
    why:"Criterion C is satisfied by headache, or photophobia with phonophobia, or visual aura. Headache accompanies well under half of attacks while light and sound sensitivity accompanies about three quarters, so leading with headache asks about the least common of the three.",
    opts:[{ l:"Light and sound both, in ≥half", a:{ v_migfeat:"yes" } },
          { l:"Visual disturbance beforehand", a:{ v_migfeat:"yes", m_aura:"yes" } },
          { l:"Neither, in most episodes", a:{ v_migfeat:"no" } }] },

  // ---- phenotype: supporting features with no v0.2 item, recorded and not scored ----
  { id:"pr_childhood_motion", kind:"phenotype", when:(a) => (a.v_vertigo ?? 0) > 0 || (a.m_head ?? 0) > 0,
    say:"As a child, were you the one who got carsick, or couldn't manage fairground rides and swings?",
    why:"Childhood motion intolerance is a long-recognised migraine-diathesis marker and is over-represented in vestibular migraine. It costs one sentence and often reframes a story the patient thought was unrelated.",
    opts:[{ l:"Yes, markedly", note:"Childhood motion intolerance / carsickness — VM-supporting, not a Bárány criterion" },
          { l:"No more than anyone" }] },

  { id:"pr_childhood_vertigo", kind:"phenotype", when:(a) => (a.v_vertigo ?? 0) > 0,
    say:"Did you have unexplained spells of dizziness or unsteadiness as a young child that nobody ever explained?",
    why:"Benign paroxysmal vertigo of childhood is now classified alongside vestibular migraine of childhood as a migraine-related syndrome, and a history of it makes the adult picture considerably more coherent.",
    opts:[{ l:"Yes, spells as a child", note:"Childhood recurrent vertigo — precursor syndrome, VM-supporting" },
          { l:"No" }] },

  { id:"pr_osmophobia", kind:"phenotype", when:(a) => (a.m_head ?? 0) > 0 || (a.v_vertigo ?? 0) > 0,
    say:"During an episode, do smells become intolerable — perfume, cooking, petrol — or set one off?",
    why:"Osmophobia is comparatively specific to migraine and is rarely volunteered. It is not a criterion, but it discriminates well against tension-type and sinonasal explanations.",
    opts:[{ l:"Yes, marked smell sensitivity", note:"Osmophobia during episodes — migraine-supporting, comparatively specific" },
          { l:"No" }] },

  { id:"pr_mdds", kind:"phenotype", when:(a) => (a.v_vertigo ?? 0) > 0,
    say:"After a long flight, drive, or boat trip, does a rocking feeling stay with you for days afterwards?",
    why:"Persistent post-motion rocking overlaps mal de débarquement, which is strongly migraine-associated. It also tells you the patient's baseline is not as symptom-free as “episodic” implies.",
    opts:[{ l:"Yes, rocking persists after travel", note:"Post-motion persistent rocking (MdDS-like) — migraine-associated" },
          { l:"No" }] },

  { id:"pr_interictal_photo", kind:"phenotype", when:(a) => a.m_photo === "yes",
    say:"Between episodes, on an ordinary day — sunglasses indoors, supermarket lighting, screens at night?",
    why:"Interictal photophobia marks a persistently sensitised state rather than discrete attacks, and it predicts how the patient will tolerate vestibular rehabilitation.",
    opts:[{ l:"Yes, light-sensitive between attacks", note:"Interictal photophobia — persistent sensitisation" },
          { l:"Only during attacks" }] },

  { id:"pr_smd", kind:"phenotype", when:(a) => (a.v_vertigo ?? 0) > 0 || a.v_motion === "yes",
    say:"Have you started avoiding places — escalators, balconies, open shopping floors, motorway driving — because of how they make you feel?",
    why:"Space-and-motion discomfort with avoidance is the pathway from episodic vestibular migraine into persistent postural-perceptual dizziness. Catching the avoidance early changes the treatment plan more than the label does.",
    opts:[{ l:"Yes, actively avoiding situations", note:"Space-motion discomfort with avoidance — PPPD risk, changes management" },
          { l:"No avoidance" }] },

  { id:"pr_neck", kind:"phenotype", when:(a) => (a.m_head ?? 0) > 0 || (a.v_vertigo ?? 0) > 0,
    say:"Does your neck ache or stiffen up as part of it — before, during, or after?",
    why:"Neck pain accompanies a large share of migraine attacks and is routinely misread as a cervicogenic cause, which sends the patient to physiotherapy for the wrong reason for months.",
    opts:[{ l:"Yes, neck involved", note:"Cervical involvement as part of the attack — commonly misattributed as cervicogenic" },
          { l:"No" }] },

  { id:"pr_prodrome", kind:"phenotype", when:(a) => (a.m_head ?? 0) > 0 || (a.v_vertigo ?? 0) > 0,
    say:"In the hours before one starts, is there anything that warns you — yawning, food cravings, mood change, feeling wired or flat?",
    why:"A recognisable prodrome is strong evidence of a migrainous mechanism and is the single most actionable thing here, because it defines a window for abortive treatment.",
    opts:[{ l:"Yes, recognisable warning", note:"Prodromal symptoms — migrainous mechanism, defines an abortive-treatment window" },
          { l:"No warning at all" }] },

  { id:"pr_treatment_trial", kind:"phenotype", when:(a) => (a.m_head ?? 0) > 0 || (a.v_vertigo ?? 0) > 0,
    say:"Have you ever taken a triptan, or a migraine preventive like propranolol, amitriptyline or topiramate — and did the dizziness change with it?",
    why:"An existing therapeutic trial is free evidence sitting in the history. Note it is suggestive only: response does not establish the diagnosis and non-response does not exclude it, since dose and duration are usually inadequate.",
    opts:[{ l:"Tried, and dizziness improved", note:"Dizziness improved on migraine-specific therapy — suggestive, not diagnostic" },
          { l:"Tried, no change", note:"No response to migraine-specific therapy — check dose and duration before weighing this" },
          { l:"Never tried" }] },
];

export const ALL_PROBES = [...PROBES, ...VM_PROBES];
export const PROBE_SET_VERSION = "1.0.0";
export { PROBE_KIND, PROBES, VM_PROBES };

/*  Live-probe selection.

    Ordinary probes retire once their target item is known. A RESCUE does not: it exists
    because the first phrasing may have produced a false negative, so it stays live while
    its target reads negative and retires only when answered or when the target turns
    positive. That asymmetry is the entire point of the kind — a rescue that behaved like
    an ordinary probe would be silently disabled by the very answer it exists to correct.
*/
export function liveProbes(answers = {}, redFlags = {}, answered = {}) {
  return ALL_PROBES
    .filter(p => p.when(answers, redFlags))
    .filter(p => answered[p.id] === undefined)
    .filter(p => !(p.target && answers[p.target] !== undefined))
    .sort((a, b) => PROBE_KIND[a.kind].rank - PROBE_KIND[b.kind].rank);
}

/*  Referential integrity, run at load by every consumer.

    A probe that writes to an item id the instrument does not have, or raises a red flag
    that does not exist, fails silently at runtime: the clinician answers the question and
    nothing happens. Checking it here turns that into a console error at startup instead
    of a finding nobody records.

    The phenotype rule is the one worth enforcing in code rather than trusting to review:
    a phenotype probe MUST NOT write to a scored item. These are supporting features, not
    Bárány criteria, and totalling them would invent a measurement instrument v0.2 does
    not make. If a future version decides one of them earns a score, that is a new item,
    a bumped INSTRUMENT_VERSION, and a re-derived cohort — not a quietly added field.
*/
export function validateProbes(itemIds = [], redFlagIds = []) {
  const items = new Set(itemIds), flags = new Set(redFlagIds);
  const errs = [];
  const seen = new Set();
  for (const p of ALL_PROBES) {
    if (seen.has(p.id)) errs.push(`duplicate probe id ${p.id}`);
    seen.add(p.id);
    if (!PROBE_KIND[p.kind]) errs.push(`${p.id}: unknown kind ${p.kind}`);
    if (typeof p.when !== "function") errs.push(`${p.id}: no trigger`);
    if (!p.say || !p.why) errs.push(`${p.id}: missing wording or rationale`);
    if (!p.opts?.length) errs.push(`${p.id}: no options`);
    if (p.target && items.size && !items.has(p.target)) errs.push(`${p.id}: target ${p.target} not in instrument`);
    if (p.rescues && items.size && !items.has(p.rescues)) errs.push(`${p.id}: rescues ${p.rescues} not in instrument`);
    for (const o of p.opts ?? []) {
      if (o.rf && flags.size && !flags.has(o.rf)) errs.push(`${p.id}: raises unknown red flag ${o.rf}`);
      for (const k of Object.keys(o.a ?? {})) {
        if (items.size && !items.has(k)) errs.push(`${p.id}: writes to unknown item ${k}`);
        if (p.kind === "phenotype") errs.push(`${p.id}: phenotype probe writes to scored item ${k} — supporting features must not score`);
      }
    }
  }
  if (errs.length) console.error("[MASQUE probes] validation failed", errs);
  return errs;
}
