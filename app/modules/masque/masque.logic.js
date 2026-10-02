// masque.logic.js — logic layer of the built-in MASQUE module (screenAIr design 03 §3.3, §3.8; WP2).
//
// format "screenair-logic", contractVersion 1, moduleId "masque". Closures appear only on
// contract LOGIC_PATHS; everything else is plain data. This file imports nothing: the registry
// fetches it as text and runs it through the loader's importSource, so the bytes executed are
// the bytes served. screenAIr never edits it; it is replaced only by uploading a whole file.
//
// MOVE RULE. Every block below is moved from the frozen baseline (app/tests/baseline/src/,
// byte-identical to app/src at commit 5448d42) without rewording, renumbering or reordering.
// The probe and SUM blocks are verbatim line ranges. In the closures, free variables are
// renamed mechanically to the state fields of design §3.3 and nothing else changes:
//   Screener/Scribe locals answers, domains, band, complaint  -> s.answers, s.domains, s.band, s.complaint
//   Screener ITEMS.discriminators                             -> s.items.discriminators
//   the band literal "low" in `strong`                        -> s.lowestBand (engine vocabulary, same value)
//   Patient yes(id), scale(id), S, L(xs)                      -> s.yes(id), s.scale(id), s.S, s.L(xs)
//   Patient locals mig, vOther, neu, disc                     -> s.groups.mig, .vOther, .neu, .disc (engine-built)
//   Patient locals migPattern, vestPattern                    -> s.migPattern, s.vestPattern (derived)
//   Patient locals mHead, mDur, vDur, days, role              -> s.scale("m_head"), ("m_dur"), ("v_vertigo"), ("i_days"), ("i_role")
//   `if (xs.length)`                                          -> `xs.length > 0` (same truth value; `when` returns a boolean)
//
// SOURCE MAP (Scr = MASQUE_Screener_v0_3.jsx, Scb = MASQUE_Scribe_v0_3.jsx,
// Pat = MASQUE_Patient_v0_3.jsx, Prb = MASQUE_Probes.js; baseline line numbers):
//   PROBES (const)              Prb L21-46 (rationale comment) and L56-143, verbatim.
//   VM_PROBES (const)           Prb L145-287, verbatim, comments included.
//   probes                      {version: Prb L290 PROBE_SET_VERSION, list: Prb L289 ALL_PROBES order}.
//                               PROBE_KIND (Prb L47-54) is engine/vocab.js; liveProbes and
//                               validateProbes (Prb L293-345) are engine/probes.js, which keeps the
//                               rescue and supporting-probe enforcement in the engine.
//   SUM (const)                 Pat L426-502, verbatim -> locales.en.sum, locales.es.sum.
//   sin, oto                    Scb L847, L848 (the Scribe complaint inputs).
//   phenotypes.derive           Scb L849: "both" when sin && oto, then "otologic" when oto. The
//                               fall-through "sinonasal" is rubric phenotypes.scribeDefault.
//   phenotypes.activation       Scb L858 (vestibular), L859 (neuro). The always-active set of
//                               Scb L857 is rubric phenotypes.alwaysActive.
//   route.strong/sinus/oto      Scr L914-916 (= Scb L1326-1328).
//   routing, 5 rules            when: Scr L917, L922, L927, L934, L941 (= Scb L1329-1333);
//                               copy.screener: Scr L918-920, L923-925, L928-930, L935-937, L942-944;
//                               copy.scribe: the object literals of Scb L1329-1333;
//                               the rationale comments Scr L932-933 and L939-940, verbatim.
//   routing no_driver           Scr L946-950, Screener only (Scb buildRecs, L1324-1335, has none).
//                               The gates ahead of these rules (Scr L895-913: red-flag override and
//                               incomplete screen; Scb L1325 with L928-930: not scorable or routing
//                               not cleared) are engine-owned (engine/rules.js routingRecs).
//   patientSummary.groups       Pat L919 (mig), L926 (vOther), L929 (neu), L936 (disc).
//   patientSummary.derived      Pat L940 (migPattern), L941 (vestPattern).
//   patientSummary.said         Pat L910-937: the 16 pushes, in order.
//   patientSummary.ask          Pat L945-953: the 9 pushes, in order; the if/else of L945-946 is
//                               two mutually exclusive rules (askBoth, askMig); askNext has no `when`.
//                               The rationale comment Pat L942-944 is kept verbatim above askBoth.
//   Elsewhere, not in this file: the gap line (Pat L955-958; engine + rubric gapRule, which calls
//   sum.gap with its booleans in reads.gapMarkers order); unsureList and the clinician block
//   (Pat L960-972, engine); referral (Scr L1456, Scb L1401/L1453; rubric phenotypes.referral);
//   CDS preview (Scr L1329-1349; rubric cds.preview + engine cdsPreview); suggestion ranking
//   (Scb L860-879, engine scribe.js).
//   reads                       design §3.8: every item, domain, flag, phenotype value and gap
//                               marker any closure or probe reads or writes.
//
// Closures are pure: they read only their state argument (or a probe's two frozen arguments)
// and the constants of this file.

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

// Summary prose, as functions of what the person entered.
const SUM = {
  en: {
    dur: "Symptoms have lasted or kept returning for more than three months.",
    abx: "Two or more courses of antibiotics or steroids haven't given lasting relief.",
    surg: "A sinus procedure didn't resolve it.",
    normal: "Exams or scans have come back normal or near-normal despite how I feel.",
    lesion: "Dizziness or ear symptoms keep happening with no cause identified.",
    headFreq: n => n === 2 ? "I get frequent headache or facial pressure episodes." : "I get occasional headache or facial pressure episodes.",
    durTypical: "Untreated, an episode typically lasts between 4 hours and 3 days.",
    migWith: l => `Episodes come with ${l}.`,
    migWords: { m_photo:"light and sound sensitivity", m_nausea:"nausea", m_disable:"having to stop what I'm doing", m_aura:"visual changes or tingling beforehand", m_trig:"clear triggers", m_fhx:"migraine in me or my family" },
    vertigo: t => `I get dizzy or spinning spells lasting ${t}.`,
    vertigoT: ["", "under 5 minutes", "between 5 minutes and 3 days", "more than 3 days"],
    vCount: "I've had at least five of these spells.",
    vMig: "At least half of the spells come with headache or light/sound sensitivity.",
    vAlso: l => `Also ${l}.`,
    vWords: { v_motion:"busy visual patterns or riding in a car", v_aural:"ear fullness or ringing", v_head:"head movement or position changes" },
    neuro: l => `Nerve-type symptoms: ${l}.`,
    nWords: { n_burn:"burning or tingling in my face, mouth or throat", n_otalgia:"deep ear or throat pain with a normal ear exam", n_auto:"dryness, lightheadedness on standing, or stomach changes", n_viral:"onset after a viral illness", n_allo:"light touch hurting more than it should" },
    days: t => `This affects me ${t} days a month.`, daysT: ["", "1 to 3", "4 to 9", "10 or more"],
    role: t => `Impact on work or home life: ${t}.`, roleT: ["", "a little", "a fair amount", "a lot"],
    disc: l => `Findings that point elsewhere: ${l}.`,
    dWords: { x_purulent:"coloured drainage or a positive swab during flares", x_objective:"sinus swelling seen on a scan or scope while symptomatic", x_lowfreq:"hearing that measurably drops during spells", x_anosmia:"reduced smell between flares" },
    askMig: "Could this be migraine, even though the pain is across my face and sinuses?",
    askBoth: "Some of my results point to a sinus or ear cause and some of my symptoms look migraine-like. Could there be more than one thing going on?",
    askVest: "Could these dizzy spells be vestibular migraine? What would rule it in or out?",
    askRefer: "Is there a headache or neuro-otology specialist you'd suggest, rather than another sinus review?",
    askNeuro: "Could a nerve cause explain the burning and pain? Is a small-fibre or autonomic assessment worth doing?",
    askNormal: "If the scans are normal, what are we ruling in — not just ruling out?",
    askDisc: l => `My results show ${l}. How does that fit with the rest of the picture?`,
    dShort: { x_purulent:"an infection during flares", x_objective:"sinus swelling on imaging", x_lowfreq:"hearing that changes with spells", x_anosmia:"reduced smell" },
    askTried: "We've tried antibiotics or surgery without lasting benefit. What does that tell us about the cause?",
    askNext: "What's the plan if this treatment doesn't work either — and when should I come back?",
    gap: (many, longTime, dismissed) => `I've seen ${many ? "three or more clinicians" : "more than one clinician"} about this` +
      (longTime ? " over more than a year" : "") + (dismissed ? ", and it's been put down to stress or a normal result" : "") +
      ". I'd like to work out what we haven't looked at yet.",
    clinNote: v => `Patient-reported features, MASQUE instrument v${v}. Self-reported and not a screening result — no index was calculated.`,
  },
  es: {
    dur: "Los síntomas han durado o han vuelto por más de tres meses.",
    abx: "Dos o más ciclos de antibióticos o esteroides no me han dado alivio duradero.",
    surg: "Un procedimiento de los senos nasales no lo resolvió.",
    normal: "Los exámenes o estudios han salido normales o casi normales a pesar de cómo me siento.",
    lesion: "Los mareos o síntomas del oído siguen pasando sin que se identifique una causa.",
    headFreq: n => n === 2 ? "Me dan episodios frecuentes de dolor de cabeza o presión en la cara." : "Me dan episodios ocasionales de dolor de cabeza o presión en la cara.",
    durTypical: "Sin tratamiento, un episodio normalmente dura entre 4 horas y 3 días.",
    migWith: l => `Los episodios vienen con ${l}.`,
    migWords: { m_photo:"molestia por la luz y el ruido", m_nausea:"náuseas", m_disable:"tener que parar lo que estoy haciendo", m_aura:"cambios en la vista u hormigueo antes", m_trig:"cosas que claramente lo provocan", m_fhx:"migraña en mí o en mi familia" },
    vertigo: t => `Me dan episodios de mareo o de que todo da vueltas que duran ${t}.`,
    vertigoT: ["", "menos de 5 minutos", "entre 5 minutos y 3 días", "más de 3 días"],
    vCount: "He tenido al menos cinco de estos episodios.",
    vMig: "Por lo menos la mitad de los episodios vienen con dolor de cabeza o molestia por la luz y el ruido.",
    vAlso: l => `También ${l}.`,
    vWords: { v_motion:"patrones visuales cargados o ir en el carro", v_aural:"oídos tapados o zumbido", v_head:"mover la cabeza o cambiar de posición" },
    neuro: l => `Síntomas de los nervios: ${l}.`,
    nWords: { n_burn:"ardor u hormigueo en la cara, la boca o la garganta", n_otalgia:"dolor hondo de oído o garganta con examen del oído normal", n_auto:"resequedad, mareo al pararme, o cambios del estómago", n_viral:"empezó después de una enfermedad viral", n_allo:"que un roce suave duela más de lo normal" },
    days: t => `Esto me afecta ${t} días al mes.`, daysT: ["", "1 a 3", "4 a 9", "10 o más"],
    role: t => `Impacto en el trabajo o la casa: ${t}.`, roleT: ["", "un poco", "bastante", "mucho"],
    disc: l => `Hallazgos que apuntan a otra cosa: ${l}.`,
    dWords: { x_purulent:"flujo de color o cultivo positivo durante las crisis", x_objective:"inflamación de los senos vista en estudio o cámara con síntomas", x_lowfreq:"audición que baja de forma medible durante los episodios", x_anosmia:"olfato disminuido entre crisis" },
    askMig: "¿Esto podría ser migraña, aunque el dolor sea en la cara y los senos nasales?",
    askBoth: "Algunos de mis resultados apuntan a una causa de senos nasales o del oído, y algunos de mis síntomas parecen de migraña. ¿Podría haber más de una cosa a la vez?",
    askVest: "¿Estos mareos podrían ser migraña vestibular? ¿Qué lo confirmaría o lo descartaría?",
    askRefer: "¿Hay un especialista en dolor de cabeza o en neuro-otología que me recomiende, en lugar de otra revisión de senos nasales?",
    askNeuro: "¿Una causa de los nervios podría explicar el ardor y el dolor? ¿Vale la pena una evaluación de fibra pequeña o autonómica?",
    askNormal: "Si los estudios están normales, ¿qué estamos confirmando — no solo descartando?",
    askDisc: l => `Mis resultados muestran ${l}. ¿Cómo encaja eso con el resto del cuadro?`,
    dShort: { x_purulent:"una infección durante las crisis", x_objective:"inflamación de senos en los estudios", x_lowfreq:"audición que cambia con los episodios", x_anosmia:"olfato disminuido" },
    askTried: "Hemos probado antibióticos o cirugía sin beneficio duradero. ¿Qué nos dice eso sobre la causa?",
    askNext: "¿Cuál es el plan si este tratamiento tampoco funciona — y cuándo debo regresar?",
    gap: (many, longTime, dismissed) => `He visto a ${many ? "tres o más médicos" : "más de un médico"} por esto` +
      (longTime ? ", por más de un año" : "") + (dismissed ? ", y me lo han atribuido al estrés o a que todo salió normal" : "") +
      ". Quisiera ver qué es lo que todavía no hemos revisado.",
    clinNote: v => `Síntomas reportados por el paciente, instrumento MASQUE v${v}. Auto-reportado y no es un resultado de tamizaje — no se calculó ningún índice.`,
  },
};

// Scb L847-848: the inputs of the Scribe complaint.
const sin = s => ["r_abx","r_surg"].some(id => s.answers[id] === "yes") || s.answers.m_head !== undefined;
const oto = s => ["v_vertigo","v_motion","v_aural","v_head"].some(id => s.answers[id] !== undefined && s.answers[id] !== "no");

// Scr L914-916 (= Scb L1326-1328).
const route = {
  strong: s => s.band !== s.lowestBand,
  sinus: s => s.complaint === "sinonasal" || s.complaint === "both",
  oto: s => s.complaint === "otologic" || s.complaint === "both",
};

export default {
  format: "screenair-logic",
  contractVersion: 1,
  moduleId: "masque",

  reads: {
    items: {
      r_dur: "boolean", r_abx: "boolean", r_surg: "boolean", r_lesion: "boolean", r_normal: "boolean",
      m_head: { scale: 3 }, m_dur: { scale: 5 },
      m_photo: "boolean", m_nausea: "boolean", m_disable: "boolean", m_aura: "boolean", m_trig: "boolean", m_fhx: "boolean",
      v_vertigo: { scale: 4 },
      v_count: "boolean", v_migfeat: "boolean", v_motion: "boolean", v_aural: "boolean", v_head: "boolean",
      n_burn: "boolean", n_otalgia: "boolean", n_auto: "boolean", n_viral: "boolean", n_allo: "boolean",
      i_days: { scale: 4 }, i_role: { scale: 4 },
      x_purulent: "boolean", x_objective: "boolean", x_lowfreq: "boolean", x_anosmia: "boolean",
    },
    domains: { vestibular: {}, neuro: {}, discriminators: { negative: true } },
    redFlags: ["rf_pulsatile", "rf_asym", "rf_ssnhl", "rf_progressive", "rf_thunderclap", "rf_gca", "rf_mass"],
    phenotypes: ["sinonasal", "otologic", "both"],
    gapMarkers: ["c_clin", "c_dur", "c_dismiss"],
  },

  phenotypes: {
    // Scb L849
    derive: [
      { value: "both", when: s => sin(s) && oto(s) },
      { value: "otologic", when: oto },
    ],
    // Scb L858-859
    activation: [
      { id: "vestibular", domains: ["vestibular"], when: s => s.complaint === "otologic" || s.complaint === "both" },
      { id: "neuro", domains: ["neuro"], when: s => (s.answers.n_burn ?? "no") !== "no" || s.answers.n_viral === "yes" },
    ],
  },

  routing: [
    { id: "sinus_migraine", // Scr L917-921; Scb L1329
      when: s => route.sinus(s) && route.strong(s),
      copy: {
        screener: {
          h: "Consider mid-facial (“sinus”) migraine",
          p: "The recalcitrant sinonasal picture carries migrainous features. Reassess before further antibiotics, steroids, or sinus surgery.",
          chips: ["SNOT-22  (0–110)", "ID Migraine  (≥2 of 3)", "HIT-6  (≥60 severe)", "MIDAS  (disability grade)"],
        },
        scribe: { h:"Consider mid-facial (“sinus”) migraine", p:"Reassess before further antibiotics, steroids, or sinus surgery.", chips:["SNOT-22 (0–110)","ID Migraine (≥2/3)","HIT-6 (≥60)","MIDAS"] },
      } },
    { id: "vestibular_migraine", // Scr L922-926; Scb L1330
      when: s => route.oto(s) && (route.strong(s) || s.domains.vestibular.pct >= 50),
      copy: {
        screener: {
          h: "Consider vestibular migraine",
          p: "Episodic vestibular symptoms without a fixed lesion, with migrainous features. Refer neuro-otology / vestibular therapy.",
          chips: ["VM-PATHI  (25-item, MCID ≥6)", "DHI  (0–100)", "MIDAS  (disability grade)"],
        },
        scribe: { h:"Consider vestibular migraine", p:"Refer neuro-otology / vestibular therapy; administer the confirmatory instrument.", chips:["VM-PATHI (25-item, MCID ≥6)","DHI (0–100)","MIDAS"] },
      } },
    { id: "neuro_overlay", // Scr L927-931; Scb L1331
      when: s => s.domains.neuro.pct >= 50,
      copy: {
        screener: {
          h: "Cranial / small-fiber neuropathic overlay",
          p: "Sensory features suggest a neuropathic contribution — consider neurology and small-fiber / autonomic evaluation, particularly if post-viral.",
          chips: ["SFN-SIQ", "COMPASS-31", "Neurology"],
        },
        scribe: { h:"Cranial / small-fiber neuropathic overlay", p:"Consider neurology and small-fiber / autonomic evaluation, especially if post-viral.", chips:["SFN-SIQ","COMPASS-31"] },
      } },
    // Proposal §5 lists a tinnitus instrument to characterise migrainous vs otologic
    // tinnitus. v0.1 scored tinnitus but routed it nowhere.
    { id: "tinnitus", // Scr L934-938; Scb L1332
      when: s => s.answers.v_aural === "yes",
      copy: {
        screener: {
          h: "Characterise the tinnitus before attributing it",
          p: "Tinnitus tied to episodes needs its own baseline — migrainous and otologic tinnitus are managed differently, and neither is assessed by the vestibular instruments above.",
          chips: ["THI  (0–100)", "TFI  (0–100)"],
        },
        scribe: { h:"Characterise the tinnitus before attributing it", p:"Migrainous and otologic tinnitus are managed differently and neither is assessed by the vestibular instruments above.", chips:["THI (0–100)","TFI (0–100)"] },
      } },
    // Objective findings pulling the other way. Not a rule-out of migraine — the two
    // coexist — but the screen must not present a masked driver as the whole story.
    { id: "competing", // Scr L941-945; Scb L1333
      when: s => s.domains.discriminators.pts < 0,
      copy: {
        screener: {
          h: "Competing objective findings recorded",
          p: s => `Rule-out items subtracted ${Math.abs(s.domains.discriminators.pts)} points. Objective disease is documented alongside the migrainous picture; treat what is demonstrable on its own terms rather than reattributing it.`,
          chips: s => s.items.discriminators.items.filter(it => s.answers[it.id] === "yes").map(it => it.text.split(/[—(]/)[0].trim().slice(0, 46)),
        },
        scribe: { h:"Competing objective findings recorded", p: s => `Rule-out items subtracted ${Math.abs(s.domains.discriminators.pts)} points. Treat what is demonstrable on its own terms rather than reattributing it.`, chips:[] },
      } },
    { id: "no_driver", fallback: true, // Scr L946-950
      copy: {
        screener: {
          h: "No masked driver flagged on screening",
          p: "Features do not currently suggest an underlying migrainous or neuropathic driver. Continue standard ENT management and re-screen if the course changes.",
          chips: [],
        },
      } },
  ],

  patientSummary: {
    groups: {
      mig: ["m_photo", "m_nausea", "m_disable", "m_aura", "m_trig", "m_fhx"],
      vOther: ["v_motion", "v_aural", "v_head"],
      neu: ["n_burn", "n_otalgia", "n_auto", "n_viral", "n_allo"],
      disc: ["x_purulent", "x_objective", "x_lowfreq", "x_anosmia"],
    },
    derived: {
      migPattern: s => (s.scale("m_head") ?? 0) > 0 && (s.groups.mig.length >= 2 || s.scale("m_dur") === 2),
      vestPattern: s => s.scale("v_vertigo") === 2 || s.yes("v_count") || s.yes("v_migfeat"),
    },
    said: [
      { id: "dur", when: s => s.yes("r_dur"), text: s => s.S.dur },
      { id: "abx", when: s => s.yes("r_abx"), text: s => s.S.abx },
      { id: "surg", when: s => s.yes("r_surg"), text: s => s.S.surg },
      { id: "normal", when: s => s.yes("r_normal"), text: s => s.S.normal },
      { id: "lesion", when: s => s.yes("r_lesion"), text: s => s.S.lesion },
      { id: "headFreq", when: s => s.scale("m_head") > 0, text: s => s.S.headFreq(s.scale("m_head")) },
      { id: "durTypical", when: s => s.scale("m_dur") === 2, text: s => s.S.durTypical },
      { id: "migWith", when: s => s.groups.mig.length >= 2, text: s => s.S.migWith(s.L(s.groups.mig.map(k => s.S.migWords[k]))) },
      { id: "vertigo", when: s => s.scale("v_vertigo") !== null && s.scale("v_vertigo") > 0, text: s => s.S.vertigo(s.S.vertigoT[s.scale("v_vertigo")]) },
      { id: "vCount", when: s => s.yes("v_count"), text: s => s.S.vCount },
      { id: "vMig", when: s => s.yes("v_migfeat"), text: s => s.S.vMig },
      { id: "vAlso", when: s => s.groups.vOther.length > 0, text: s => s.S.vAlso(s.L(s.groups.vOther.map(k => s.S.vWords[k]))) },
      { id: "neuro", when: s => s.groups.neu.length > 0, text: s => s.S.neuro(s.L(s.groups.neu.map(k => s.S.nWords[k]))) },
      { id: "days", when: s => s.scale("i_days") !== null && s.scale("i_days") > 0, text: s => s.S.days(s.S.daysT[s.scale("i_days")]) },
      { id: "role", when: s => s.scale("i_role") !== null && s.scale("i_role") > 0, text: s => s.S.role(s.S.roleT[s.scale("i_role")]) },
      { id: "disc", when: s => s.groups.disc.length > 0, text: s => s.S.disc(s.L(s.groups.disc.map(k => s.S.dWords[k]))) },
    ],
    ask: [
      // The rule-outs carry contrary evidence. Asking "could this be migraine?" here
      // would push the tool's hypothesis past its own findings, so the question opens
      // both doors instead of one.
      { id: "askBoth", when: s => s.migPattern && s.groups.disc.length > 0, text: s => s.S.askBoth },
      { id: "askMig", when: s => s.migPattern && !(s.groups.disc.length > 0), text: s => s.S.askMig },
      { id: "askVest", when: s => s.vestPattern, text: s => s.S.askVest },
      { id: "askRefer", when: s => s.migPattern || s.vestPattern, text: s => s.S.askRefer },
      { id: "askNeuro", when: s => s.groups.neu.length >= 2, text: s => s.S.askNeuro },
      { id: "askNormal", when: s => s.yes("r_normal") || s.yes("r_lesion"), text: s => s.S.askNormal },
      { id: "askDisc", when: s => s.groups.disc.length > 0, text: s => s.S.askDisc(s.L(s.groups.disc.map(k => s.S.dShort[k]))) },
      { id: "askTried", when: s => s.yes("r_abx") || s.yes("r_surg"), text: s => s.S.askTried },
      { id: "askNext", text: s => s.S.askNext },
    ],
  },

  locales: {
    en: { sum: SUM.en },
    es: { sum: SUM.es },
  },

  probes: {
    version: "1.0.0",
    list: [...PROBES, ...VM_PROBES],
  },
};
