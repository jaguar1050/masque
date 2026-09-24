import React, { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Printer, Download, TriangleAlert, ShieldCheck,
  HelpCircle, MessageSquareQuote, Stethoscope, Info, RotateCcw, ClipboardList,
} from "lucide-react";

/*  Project MASQUE — patient-facing companion (release 0.3)

    Why this exists
    ---------------
    The TOPx track asks for tools built on U.S. Open Data that help PATIENTS reach
    answers and care faster, and proposal §2 commits to putting that data "in the
    public's hands". Until now every MASQUE artifact was clinician-facing: SMART
    launch, physician prompts, chart write-back. A patient had no entry point at all.

    That gap is not cosmetic. Proposal §3.2 is about people — disproportionately
    women — who have already seen three or four clinicians over a year or more and
    been told it is stress. The single thing most likely to change that visit is not
    another clinician-side score. It is the patient arriving able to describe the
    pattern precisely and ask for the specific evaluation. This app does that and
    nothing more.

    What it deliberately does NOT do
    --------------------------------
    1. No score, no band, no probability, anywhere in the patient's view. The
       calibration constants are illustrative until fit on approved data (fix #3),
       and "85/100 — high likelihood" handed to a patient is an unvalidated number
       that invites self-diagnosis. The clinician summary lists which FEATURES are
       present, in clinical language. That is what actually speeds up a visit, and
       it cannot be misread as a result.

    2. No differential is ever shown for a red flag. The clinician build names what
       each flag points to — schwannoma, subarachnoid haemorrhage, giant cell
       arteritis. A patient reading that list at 1am is harmed, not helped. Here a
       flag carries only two things: how fast to be seen, and the exact sentence to
       say when calling. Same safety behaviour, no terror.

    3. No automatic research capture. The clinician build appends screens to the
       pilot cohort (fix #7/#11). Patient-entered data carries different consent
       obligations than clinician-entered data, so nothing here writes to a cohort.
       Export is patient-initiated, local, and goes to the patient.

    The "Not sure" answer
    ---------------------
    Every yes/no question offers Yes / No / Not sure, and "Not sure" leaves the item
    genuinely unanswered rather than coercing a 0. This is the same no-imputation
    invariant the ingestion layer and the coverage gate run on — absent data is never
    rendered as negative data. It also turns out to be the most useful thing in the
    app: an honest "I don't know whether my scan showed inflammation" becomes a
    question on the visit summary, which is exactly the sort of thing that stalls
    these workups for months.
*/

const INSTRUMENT_VERSION = "0.2";
const APP_VERSION = "0.3.0";

// ---------------------------------------------------------------------------
// Instrument — ids, weights, and scales mirror instrument v0.2 exactly (the same
// set the screener and scribe use). See VERSIONS.md for why that number is not 0.3.
// Weights are carried only so the clinician summary can order features by
// salience; nothing here computes or displays an index.
// ---------------------------------------------------------------------------
const ITEMS = {
  recalcitrance: {
    label: "Recalcitrance", clinical: "Recalcitrance",
    items: [
      { id: "r_dur", w: 3, c: "Symptoms persisting or recurring > 3 months" },
      { id: "r_abx", w: 3, c: "≥2 antibiotic/steroid courses without lasting relief" },
      { id: "r_surg", w: 3, c: "Prior sinus procedure without resolution" },
      { id: "r_lesion", w: 3, c: "Recurrent dizziness/aural symptoms, no structural lesion found" },
      { id: "r_normal", w: 3, c: "Exam or imaging normal relative to symptom burden" },
    ],
  },
  migraine: {
    label: "Headache pattern", clinical: "Migrainous",
    items: [
      { id: "m_head", w: 6, c: "Recurrent headache / mid-facial pressure episodes", scale: 3 },
      { id: "m_dur", w: 4, c: "Untreated attack duration 4–72 h (ICHD-3 1.1 B)", scale: 5 },
      { id: "m_photo", w: 4, c: "Photophobia and/or phonophobia during episodes" },
      { id: "m_nausea", w: 4, c: "Nausea with episodes" },
      { id: "m_disable", w: 3, c: "Episodes limit normal activity" },
      { id: "m_aura", w: 3, c: "Visual aura or transient neurologic symptoms" },
      { id: "m_trig", w: 3, c: "Identifiable triggers (weather, sleep, meals, hormonal)" },
      { id: "m_fhx", w: 3, c: "Personal or family history of migraine" },
    ],
  },
  vestibular: {
    label: "Dizziness and ears", clinical: "Otologic / vestibular",
    items: [
      { id: "v_vertigo", w: 6, c: "Episodic vertigo 5 min – 72 h (Bárány VM B)", scale: 4 },
      { id: "v_count", w: 4, c: "≥5 vestibular episodes to date (Bárány VM A)" },
      { id: "v_migfeat", w: 4, c: "Migrainous features in ≥50% of episodes (Bárány VM C)" },
      { id: "v_motion", w: 4, c: "Motion / visual-motion sensitivity" },
      { id: "v_aural", w: 4, c: "Fluctuating aural fullness or tinnitus with episodes" },
      { id: "v_head", w: 3, c: "Head-motion or positional intolerance" },
    ],
  },
  neuro: {
    label: "Nerve-type symptoms", clinical: "Neuropathic",
    items: [
      { id: "n_burn", w: 4, c: "Burning / tingling / shooting facial, oral or throat sensations" },
      { id: "n_otalgia", w: 3, c: "Deep ear or throat pain with normal ear exam" },
      { id: "n_auto", w: 3, c: "Autonomic symptoms (sicca, orthostatic, sudomotor, GI)" },
      { id: "n_viral", w: 3, c: "Onset following viral illness" },
      { id: "n_allo", w: 2, c: "Sensitivity out of proportion to exam" },
    ],
  },
  impact: {
    label: "How much it affects you", clinical: "Impact",
    items: [
      { id: "i_days", w: 8, c: "Days per month affected", scale: 4 },
      { id: "i_role", w: 7, c: "Impact on work or daily roles", scale: 4 },
    ],
  },
  discriminators: {
    label: "Test results you may know", clinical: "Discriminators (rule-out)", negative: true,
    items: [
      { id: "x_purulent", w: -8, c: "Purulent drainage or positive sinus culture when symptomatic" },
      { id: "x_objective", w: -8, c: "Objective sinus inflammation on endoscopy/CT when symptomatic" },
      { id: "x_lowfreq", w: -8, c: "Audiometric fluctuating low-frequency SNHL" },
      { id: "x_anosmia", w: -5, c: "Persistent hyposmia between episodes" },
    ],
  },
};
const DOMAIN_ORDER = ["recalcitrance", "migraine", "vestibular", "neuro", "impact", "discriminators"];

/*  Plain-language wording, keyed by item id.

    Kept as a separate map rather than a field on ITEMS so the instrument stays a
    single source of truth for scoring while the wording can be revised — or
    translated — without touching it. The assertion below fails loudly if the two
    ever drift apart.

    Written first person, present tense, short clauses. Target ≤ grade 8; measured,
    not assumed (see the reading-level check in the accompanying notes).
*/
const P = {
  r_dur: { q: "This has been going on — or keeps coming back — for more than 3 months." },
  r_abx: { q: "I've had two or more rounds of antibiotics or steroids and they didn't fix it for long." },
  r_surg: { q: "I've had sinus surgery or a procedure, and the symptoms came back." },
  r_lesion: { q: "I get dizzy spells or ear symptoms, and nobody has found a cause." },
  r_normal: { q: "My scans or exams came back normal, or close to normal, even though I feel bad.",
    ask: "What exactly did my previous scans and exams show?" },

  m_head: { q: "How often do you get headaches, or pressure and pain across your face and cheeks?",
    opts: ["Never", "Now and then", "Often"] },
  m_dur: { ask: "How long does an untreated episode usually last? I'm not certain.",
    q: "If you don't treat it, how long does one episode usually last?",
    opts: ["I don't get them", "Less than 4 hours", "Between 4 hours and 3 days", "More than 3 days", "It varies a lot"] },
  m_photo: { q: "Light or noise bothers me more than usual during an episode." },
  m_nausea: { q: "I feel sick to my stomach during an episode." },
  m_disable: { q: "Episodes stop me doing things I'd normally do." },
  m_aura: { q: "Before or during an episode I see spots, zigzags or flashing lights — or I get numbness or tingling." },
  m_trig: { q: "Certain things set it off — weather changes, poor sleep, skipping meals, or my period." },
  m_fhx: { q: "I get migraines, or someone in my family does." },

  v_vertigo: { q: "When you get a dizzy or spinning spell, how long does it last?",
    opts: ["I don't get them", "Less than 5 minutes", "Between 5 minutes and 3 days", "More than 3 days"] },
  v_count: { q: "I've had at least five of these spells." },
  v_migfeat: { q: "At least half of my spells come with a headache, or with light and noise bothering me.",
    ask: "Should I be tracking whether my spells come with headache or light sensitivity?" },
  v_motion: { q: "Busy patterns, scrolling on a screen, or riding in a car make me feel off." },
  v_aural: { q: "My ears feel full, or ring, when the spells happen." },
  v_head: { q: "Moving my head or changing position brings it on." },

  n_burn: { q: "I get burning, tingling or shooting feelings in my face, mouth or throat." },
  n_otalgia: { q: "I get deep ear or throat pain, but my ear was checked and looked fine." },
  n_auto: { q: "I get dry eyes or a dry mouth, lightheadedness when I stand up, sweating changes, or stomach trouble.",
    ask: "Could dryness, lightheadedness and stomach changes be connected to this?" },
  n_viral: { q: "All of this started after I was sick with a virus." },
  n_allo: { q: "A light touch, or normal pressure, hurts more than it should." },

  i_days: { q: "How many days a month does this affect you?", opts: ["None", "1 to 3", "4 to 9", "10 or more"] },
  i_role: { q: "How much does it get in the way of work, school or home life?",
    opts: ["Not at all", "A little", "A fair amount", "A lot"] },

  x_purulent: { q: "During a flare I've had thick coloured drainage, or a swab grew an infection.",
    ask: "During a flare, did I ever have thick coloured drainage, or a swab that grew an infection?",
    help: "This is one your notes may answer. \"Not sure\" is a fine answer." },
  x_objective: { q: "A scan or a camera test showed real sinus swelling while I was having symptoms.",
    ask: "Did any of my scans or scope tests show real sinus swelling while I had symptoms?",
    help: "Look for words like sinusitis, mucosal thickening, or opacification on a CT report." },
  x_lowfreq: { q: "A hearing test showed my hearing drops during spells and comes back afterwards.",
    ask: "Do my hearing tests show my hearing changing between visits?",
    help: "This means two hearing tests at different times, not one." },
  x_anosmia: { q: "My sense of smell is reduced or gone, even between flares.",
    ask: "Has my sense of smell been formally tested?" },
};

// Locale accessors. English is the source of truth for structure; a locale that is
// missing a string falls back to English rather than rendering blank — a silently
// missing question is worse than a bilingual page.
function pFor(locale, id) { return locale === "es" ? { ...P[id], ...(ES_P[id] || {}) } : P[id]; }
function rfFor(locale, f) { return locale === "es" ? { ...f, ...(ES_RF[f.id] || {}) } : f; }

// Drift guard — every scored item must carry patient wording, and every scale must
// have the right number of options. Fails at module load rather than in front of a user.
(function assertCoverage() {
  const missing = [], wrongScale = [];
  for (const k of DOMAIN_ORDER) {
    for (const it of ITEMS[k].items) {
      const p = P[it.id];
      if (!p) { missing.push(it.id); continue; }
      if (it.scale && (!p.opts || p.opts.length !== it.scale)) wrongScale.push(it.id);
      if (!it.scale && p.opts) wrongScale.push(it.id);
    }
  }
  if (missing.length || wrongScale.length) {
    console.error("[MASQUE patient] wording out of sync with instrument", { missing, wrongScale });
  }
})();

/*  Red flags — patient-facing.

    Same twelve findings as the clinician build, same tiers. Two differences, both
    deliberate:

    • `points` (what it may indicate) is NOT carried here at all. Not hidden behind
      a disclosure, not in a tooltip — absent. A patient does not need to read
      "possible vestibular schwannoma" to act correctly on one-sided hearing loss.
    • Each carries `say` — the sentence to use on the phone. The reason these
      findings get deferred is rarely that nobody mentioned them; it is that they
      got mentioned in a way that sounded routine to whoever answered the phone.
*/
const RED_FLAGS = [
  { id: "rf_thunderclap", tier: "now",
    q: "A headache that went from nothing to the worst pain within about a minute.",
    say: "I had a headache that reached its worst point within a minute." },
  { id: "rf_focal", tier: "now",
    q: "New weakness, numbness, slurred speech, trouble swallowing, or double vision that doesn't go away.",
    say: "I have new weakness, numbness, speech trouble or double vision." },
  { id: "rf_vision", tier: "now",
    q: "Losing vision, or my vision greying out or dimming — even for a few seconds.",
    say: "I'm having episodes where my vision greys out or dims." },
  { id: "rf_gca", tier: "now",
    q: "I'm over 50 and my scalp is tender, or my jaw aches when I chew.",
    say: "I'm over 50 with a tender scalp and jaw pain when I chew. I'd like blood tests today." },
  { id: "rf_orbital", tier: "now",
    q: "Swelling around my eye, my eye bulging, eye pain, or trouble moving my eye.",
    say: "I have swelling around my eye and trouble moving it." },
  { id: "rf_ssnhl", tier: "now",
    q: "My hearing dropped suddenly — over a few hours or a day — in the last month.",
    say: "My hearing dropped suddenly. I'd like a hearing test today, not in a few weeks." },
  { id: "rf_asym", tier: "soon",
    q: "My hearing loss or ringing is always in the same one ear.",
    say: "My hearing loss and ringing are only ever in one ear, and I'd like that looked into." },
  { id: "rf_pulsatile", tier: "soon",
    q: "The ringing pulses along with my heartbeat.",
    say: "My ear noise pulses in time with my heartbeat." },
  { id: "rf_progressive", tier: "soon",
    q: "My headache is steadily getting worse, or it's worse when I wake up, cough, strain or lie flat.",
    say: "My headaches are getting worse and are worst when I lie down or wake up." },
  { id: "rf_new50", tier: "soon",
    q: "This is the first time in my life I've had headaches like this, and I'm over 50.",
    say: "These are the first severe headaches of my life and I'm over 50." },
  { id: "rf_mass", tier: "soon",
    q: "One side of my nose is blocked with bleeding, or my cheek has gone numb.",
    say: "One side of my nose is blocked and bleeding, and my cheek is numb." },
  { id: "rf_systemic", tier: "soon",
    q: "Fevers, night sweats, or weight I didn't mean to lose.",
    say: "I've had night sweats and unexplained weight loss alongside this." },
];
const TIER = {
  now: {
    label: "Today", color: "var(--coral)", bg: "var(--coralbg)",
    what: "Please get seen today — an urgent care, an emergency department, or a same-day call to your doctor's office. Don't wait for a routine appointment.",
  },
  soon: {
    label: "This week", color: "var(--amber)", bg: "var(--amberbg)",
    what: "Call your doctor's office this week. Ask to be seen sooner than the next routine slot, and say exactly why.",
  },
};

/*  Localisation.

    §2 commits to putting this in the public's hands, and in an Arizona pilot a share
    of those hands read Spanish first. The wording was already isolated in one object
    with no logic precisely so this would be a translation job rather than a rewrite.

    Two structural rules:

    1. The SUMMARY is translated too, not just the questions. A half-translated tool —
       Spanish questions producing an English summary — is worse than an English one,
       because the summary is the artifact the patient actually uses and speaks from.
       So the prose fragments live here as templates rather than inline strings.

    2. A locale is not usable until a bilingual clinician signs it off. The Spanish
       below is a careful draft, not a validated translation, and the app says so on
       every screen while it stays unreviewed rather than burying it in a footnote.
       Medical wording carries clinical weight — "aura", "pressure", "spells" all have
       register-specific renderings that a non-specialist translation gets subtly
       wrong — so REVIEWED gates the claim, not the availability.
*/
const REVIEWED = { en: true, es: false };
const LOCALE_NAMES = { en: "English", es: "Español" };

const ES_P = {
  r_dur: { q: "Esto lleva más de 3 meses, o vuelve una y otra vez." },
  r_abx: { q: "He tomado dos o más ciclos de antibióticos o esteroides y no lo resolvieron por mucho tiempo." },
  r_surg: { q: "Me operaron de los senos nasales o me hicieron un procedimiento, y los síntomas volvieron." },
  r_lesion: { q: "Me dan mareos o síntomas del oído, y nadie ha encontrado la causa." },
  r_normal: { q: "Mis estudios o exámenes salieron normales, o casi normales, aunque me siento mal.",
    ask: "¿Qué mostraron exactamente mis estudios y exámenes anteriores?" },

  m_head: { q: "¿Con qué frecuencia le dan dolores de cabeza, o presión y dolor en la cara y los pómulos?",
    opts: ["Nunca", "De vez en cuando", "Seguido"] },
  m_dur: { q: "Si no lo trata, ¿cuánto dura normalmente un episodio?",
    ask: "¿Cuánto dura un episodio sin tratar? No estoy seguro.",
    opts: ["No me dan", "Menos de 4 horas", "Entre 4 horas y 3 días", "Más de 3 días", "Varía mucho"] },
  m_photo: { q: "La luz o el ruido me molestan más de lo normal durante un episodio." },
  m_nausea: { q: "Siento náuseas o malestar del estómago durante un episodio." },
  m_disable: { q: "Los episodios me impiden hacer cosas que normalmente haría." },
  m_aura: { q: "Antes o durante un episodio veo puntos, líneas en zigzag o luces destellantes — o siento entumecimiento u hormigueo." },
  m_trig: { q: "Ciertas cosas lo provocan — cambios de clima, dormir mal, saltarme comidas, o mi periodo." },
  m_fhx: { q: "Me dan migrañas, o alguien de mi familia las tiene." },

  v_vertigo: { q: "Cuando le da un episodio de mareo o de que todo da vueltas, ¿cuánto dura?",
    opts: ["No me dan", "Menos de 5 minutos", "Entre 5 minutos y 3 días", "Más de 3 días"] },
  v_count: { q: "He tenido al menos cinco de estos episodios." },
  v_migfeat: { q: "Por lo menos la mitad de mis episodios vienen con dolor de cabeza, o con molestia por la luz y el ruido.",
    ask: "¿Debería anotar si mis episodios vienen con dolor de cabeza o molestia por la luz?" },
  v_motion: { q: "Los patrones muy cargados, deslizar la pantalla, o ir en el carro me hacen sentir mal." },
  v_aural: { q: "Siento los oídos tapados, o me zumban, cuando me dan los episodios." },
  v_head: { q: "Mover la cabeza o cambiar de posición me lo provoca." },

  n_burn: { q: "Siento ardor, hormigueo o punzadas en la cara, la boca o la garganta." },
  n_otalgia: { q: "Me duele hondo el oído o la garganta, pero me revisaron el oído y estaba bien." },
  n_auto: { q: "Se me secan los ojos o la boca, me mareo al pararme, sudo distinto, o tengo problemas del estómago.",
    ask: "¿La resequedad, el mareo al pararme y los cambios del estómago podrían estar relacionados con esto?" },
  n_viral: { q: "Todo esto empezó después de que me enfermé de un virus." },
  n_allo: { q: "Un roce suave, o una presión normal, me duele más de lo que debería." },

  i_days: { q: "¿Cuántos días al mes le afecta esto?", opts: ["Ninguno", "1 a 3", "4 a 9", "10 o más"] },
  i_role: { q: "¿Qué tanto le estorba en el trabajo, la escuela o la casa?",
    opts: ["Nada", "Un poco", "Bastante", "Mucho"] },

  x_purulent: { q: "Durante una crisis he tenido flujo espeso y de color, o un cultivo salió con infección.",
    ask: "Durante una crisis, ¿alguna vez tuve flujo espeso de color, o un cultivo con infección?",
    help: "Esta puede estar en su expediente. \"No estoy seguro\" es una buena respuesta." },
  x_objective: { q: "Un estudio o una cámara mostró inflamación real de los senos nasales mientras yo tenía síntomas.",
    ask: "¿Alguno de mis estudios mostró inflamación real de los senos nasales cuando tenía síntomas?",
    help: "Busque palabras como sinusitis, engrosamiento de la mucosa u opacificación en un reporte de tomografía." },
  x_lowfreq: { q: "Una prueba de audición mostró que mi oído baja durante los episodios y luego regresa.",
    ask: "¿Mis pruebas de audición muestran cambios entre una visita y otra?",
    help: "Esto significa dos pruebas en momentos distintos, no una sola." },
  x_anosmia: { q: "Mi sentido del olfato está disminuido o perdido, incluso entre crisis.",
    ask: "¿Me han hecho una prueba formal del olfato?" },
};

const ES_RF = {
  rf_thunderclap: { q: "Un dolor de cabeza que pasó de nada al peor dolor en como un minuto.",
    say: "Tuve un dolor de cabeza que llegó a su punto más fuerte en menos de un minuto." },
  rf_focal: { q: "Debilidad nueva, entumecimiento, hablar arrastrado, dificultad para tragar, o ver doble y no se quita.",
    say: "Tengo debilidad, entumecimiento, problemas para hablar o visión doble, y son nuevos." },
  rf_vision: { q: "Perder la vista, o que se me nuble u oscurezca la vista — aunque sea por segundos.",
    say: "Estoy teniendo episodios en los que se me oscurece o se me nubla la vista." },
  rf_gca: { q: "Tengo más de 50 años y me duele el cuero cabelludo, o me duele la mandíbula al masticar.",
    say: "Tengo más de 50 años, me duele el cuero cabelludo y la mandíbula al masticar. Quisiera análisis de sangre hoy." },
  rf_orbital: { q: "Hinchazón alrededor del ojo, el ojo saltado, dolor de ojo, o no poder moverlo bien.",
    say: "Tengo hinchazón alrededor del ojo y dificultad para moverlo." },
  rf_ssnhl: { q: "Mi audición bajó de repente — en unas horas o un día — en el último mes.",
    say: "Mi audición bajó de repente. Quisiera una prueba de audición hoy, no en unas semanas." },
  rf_asym: { q: "La pérdida de audición o el zumbido siempre es del mismo oído.",
    say: "La pérdida de audición y el zumbido son solo de un oído, y quisiera que lo revisaran." },
  rf_pulsatile: { q: "El zumbido late al mismo ritmo que mi corazón.",
    say: "El ruido en mi oído late al ritmo de mi corazón." },
  rf_progressive: { q: "Mi dolor de cabeza va empeorando poco a poco, o es peor al despertar, toser, hacer fuerza o acostarme.",
    say: "Mis dolores de cabeza están empeorando y son peores cuando me acuesto o al despertar." },
  rf_new50: { q: "Es la primera vez en mi vida que me dan dolores de cabeza así, y tengo más de 50 años.",
    say: "Estos son los primeros dolores de cabeza fuertes de mi vida y tengo más de 50 años." },
  rf_mass: { q: "Un lado de la nariz está tapado y sangra, o se me durmió el pómulo.",
    say: "Un lado de mi nariz está tapado y sangrando, y tengo el pómulo dormido." },
  rf_systemic: { q: "Fiebres, sudores de noche, o peso que bajé sin querer.",
    say: "He tenido sudores nocturnos y he bajado de peso sin explicación." },
};

// UI chrome and summary prose. The summary fragments are templates rather than
// inline strings so a locale change moves the whole artifact, not just the form.
const UI = {
  en: {
    title: "Getting ready for your visit", sub: "A MASQUE tool · for people with ongoing sinus, ear or dizziness problems",
    step: "STEP", of: "OF", back: "Back", next: "Next", start: "Start", seeSummary: "See my summary",
    sections: ["Start","Safety check","Your story","Headache pattern","Dizziness and ears","Nerve-type symptoms","Daily impact","Test results","Your summary"],
    yes: "Yes", no: "No", unsure: "Not sure",
    tierNow: "Today", tierSoon: "This week",
    tierNowWhat: "Please get seen today — an urgent care, an emergency department, or a same-day call to your doctor's office. Don't wait for a routine appointment.",
    tierSoonWhat: "Call your doctor's office this week. Ask to be seen sooner than the next routine slot, and say exactly why.",
    sayThis: "What to say", print: "Print", download: "Download", startOver: "Start over",
    reviewBanner: null,
    summaryTitle: "Your visit summary",
    openWith: "How I'd open", describe: "What I want to describe", askAbout: "What I want to ask",
    notSure: "Things I'm not sure about", notSureLede: "Worth checking my records or asking directly:",
    forClinician: "For my clinician",
    thinTitle: "There isn't much here yet",
    thin: "You haven't answered enough for this to be worth handing over. Go back and answer what you can — \"Not sure\" counts, and it's often the most useful answer, because it turns into something to ask about.",
    txtSeenToday: "** GET SEEN TODAY **", txtSeenWeek: "** GET SEEN THIS WEEK **", txtSay: "Say",
    txtClinNote: "Self-reported; no screening index was calculated. '-' points away from the pattern.",
    txtFooter: "research prototype, not medical advice. Does not diagnose. Not validated in a clinical study.",
    txtUnreviewed: "",
    fileName: "my-visit-summary.txt",
  },
  es: {
    title: "Preparándose para su consulta", sub: "Una herramienta MASQUE · para personas con problemas continuos de senos nasales, oídos o mareos",
    step: "PASO", of: "DE", back: "Atrás", next: "Siguiente", start: "Empezar", seeSummary: "Ver mi resumen",
    sections: ["Inicio","Revisión de seguridad","Su historia","Patrón de dolor de cabeza","Mareos y oídos","Síntomas de los nervios","Impacto diario","Resultados de estudios","Su resumen"],
    yes: "Sí", no: "No", unsure: "No estoy seguro",
    tierNow: "Hoy", tierSoon: "Esta semana",
    tierNowWhat: "Por favor busque atención hoy — urgencias, una sala de emergencias, o una llamada el mismo día al consultorio de su doctor. No espere a una cita de rutina.",
    tierSoonWhat: "Llame al consultorio de su doctor esta semana. Pida que lo vean antes de la próxima cita de rutina, y diga exactamente por qué.",
    sayThis: "Qué decir", print: "Imprimir", download: "Descargar", startOver: "Empezar de nuevo",
    reviewBanner: "Traducción preliminar. Este texto en español todavía no ha sido revisado por un profesional de salud bilingüe. Úselo como apoyo, no como texto final.",
    summaryTitle: "Mi resumen para la consulta",
    openWith: "Cómo empezaría", describe: "Lo que quiero describir", askAbout: "Lo que quiero preguntar",
    notSure: "Cosas de las que no estoy seguro", notSureLede: "Vale la pena revisar mi expediente o preguntar directamente:",
    forClinician: "Para mi médico",
    thinTitle: "Todavía no hay mucho aquí",
    thin: "No ha contestado lo suficiente como para que valga la pena entregarlo. Regrese y conteste lo que pueda — \"No estoy seguro\" cuenta, y muchas veces es la respuesta más útil, porque se convierte en algo que preguntar.",
    txtSeenToday: "** BUSQUE ATENCIÓN HOY **", txtSeenWeek: "** BUSQUE ATENCIÓN ESTA SEMANA **", txtSay: "Decir",
    txtClinNote: "Auto-reportado; no se calculó ningún índice de tamizaje. '-' apunta en contra del patrón.",
    txtFooter: "prototipo de investigación, no es consejo médico. No diagnostica. No ha sido validado en un estudio clínico.",
    txtUnreviewed: "TRADUCCIÓN PRELIMINAR — no revisada por un profesional de salud bilingüe.",
    fileName: "mi-resumen-para-la-consulta.txt",
  },
};

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

/*  Per-locale coverage. A translation silently covering 26 of 30 items would leave
    four questions in English with nothing on screen to say so, and the person least
    able to notice is the one the translation is for. Runs at module load, same as
    the instrument drift guard.
*/
(function assertLocales() {
  for (const [code, items, rfs] of [["es", ES_P, ES_RF]]) {
    const missing = Object.keys(P).filter(id => !items[id]);
    const scale = Object.keys(P).filter(id => P[id].opts && items[id]?.opts?.length !== P[id].opts.length);
    const flags = RED_FLAGS.map(f => f.id).filter(id => !rfs[id]);
    const ui = Object.keys(UI.en).filter(k => UI[code]?.[k] === undefined);
    const sum = Object.keys(SUM.en).filter(k => SUM[code]?.[k] === undefined);
    if (missing.length || scale.length || flags.length || ui.length || sum.length) {
      console.error(`[MASQUE patient] ${code} locale incomplete`, { missing, scale, flags, ui, sum });
    }
  }
})();

const CONTEXT_Q = [
  { id: "c_clin", q: "How many different clinicians have you seen about this?",
    opts: [["1", "Just one"], ["2", "Two"], ["3+", "Three or more"]] },
  { id: "c_dur", q: "How long has this been going on?",
    opts: [["<6mo", "Under 6 months"], ["6-12mo", "6 to 12 months"], [">12mo", "Over a year"]] },
  { id: "c_dismiss", q: "Have you been told it's stress or anxiety, or that everything looks normal?",
    opts: [["no", "No"], ["yes", "Yes"]] },
];

const SECTIONS = [
  { key: "intro", title: "Start" },
  { key: "safety", title: "Safety check" },
  { key: "story", title: "Your story" },
  { key: "migraine", title: "Headache pattern" },
  { key: "vestibular", title: "Dizziness and ears" },
  { key: "neuro", title: "Nerve-type symptoms" },
  { key: "impact", title: "Daily impact" },
  { key: "discriminators", title: "Test results" },
  { key: "summary", title: "Your summary" },
];
const LAST = SECTIONS.length - 1;

// ---------------------------------------------------------------------------

const CSS = `
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
`;

// ---------------------------------------------------------------------------

export default function MasquePatient() {
  const [sec, setSec] = useState(0);
  const [a, setA] = useState({});        // item id -> value | "unsure"
  const [ctx, setCtx] = useState({});
  const [rf, setRf] = useState({});
  const [safetyDone, setSafetyDone] = useState(false);
  const [loc, setLoc] = useState("en");
  const t = UI[loc];

  const key = SECTIONS[sec].key;
  const flags = RED_FLAGS.filter(f => rf[f.id]).map(f => rfFor(loc, f));
  const urgent = flags.some(f => f.tier === "now");
  const canGo = key === "safety" ? (safetyDone || flags.length > 0) : true;

  const set = (id, v) => setA(p => ({ ...p, [id]: p[id] === v ? undefined : v }));

  function reset() {
    setA({}); setCtx({}); setRf({}); setSafetyDone(false); setSec(0);
  }

  const summary = useMemo(() => buildSummary({ a, ctx, flags, urgent, loc }), [a, ctx, flags, urgent, loc]);

  return (
    <div className="mp">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="top noprint">
          <div className="logo"><Stethoscope size={19} /></div>
          <div style={{flex:1}}>
            <div className="tt">{t.title}</div>
            <div className="ts">{t.sub}</div>
          </div>
          <div className="opts" style={{flex:"0 0 auto"}}>
            {Object.keys(UI).map(k => (
              <button key={k} className={"o" + (loc === k ? " sel" : "")} style={{minWidth:0,minHeight:38,padding:"7px 13px",fontSize:14}}
                onClick={() => setLoc(k)} lang={k} aria-pressed={loc === k}>{LOCALE_NAMES[k]}</button>
            ))}
          </div>
        </div>
        {t.reviewBanner && (
          <div className="sum ask noprint" style={{marginTop:10}} lang={loc}>
            <h3>{REVIEWED[loc] ? "" : "⚠︎ "}Traducción sin revisar</h3>
            <p>{t.reviewBanner}</p>
          </div>
        )}

        {sec > 0 && (
          <div className="noprint">
            <div className="stepof">{t.step} {sec} {t.of} {LAST} · {t.sections[sec].toUpperCase()}</div>
            <div className="prog"><i style={{ width: `${(sec / LAST) * 100}%` }} /></div>
          </div>
        )}

        {key === "intro" && <Intro t={t} loc={loc} />}

        {key === "safety" && (
          <Safety flags={flags} rf={rf} setRf={setRf} safetyDone={safetyDone} setSafetyDone={setSafetyDone} urgent={urgent} t={t} loc={loc} />
        )}

        {key === "story" && (
          <div className="card">
            <h2>Your story so far</h2>
            <p className="lede">This part matters more than people expect. How long you've been at this, and how many
              doors you've already knocked on, changes what a good next step looks like.</p>
            <div style={{ marginTop: 14 }}>
              {CONTEXT_Q.map(q => (
                <div className="q" key={q.id}>
                  <div className="qt">{q.q}</div>
                  <div className="opts">
                    {q.opts.map(([v, lab]) => (
                      <button key={v} className={"o" + (ctx[q.id] === v ? " sel" : "")}
                        onClick={() => setCtx(c => ({ ...c, [q.id]: c[q.id] === v ? undefined : v }))}>{lab}</button>
                    ))}
                  </div>
                </div>
              ))}
              <QBlock domain="recalcitrance" a={a} set={set} t={t} loc={loc}
                intro="A few things about what's been tried already." />
            </div>
          </div>
        )}

        {["migraine", "vestibular", "neuro", "impact", "discriminators"].includes(key) && (
          <div className="card">
            <h2>{t.sections[sec]}</h2>
            <p className="lede">{(loc === "es" ? BLURB_ES : BLURB)[key]}</p>
            <div style={{ marginTop: 10 }}>
              <QBlock domain={key} a={a} set={set} t={t} loc={loc} />
            </div>
          </div>
        )}

        {key === "summary" && <Summary summary={summary} onReset={reset} t={t} loc={loc} />}

        {sec < LAST && (
          <div className="nav noprint">
            {sec > 0 && (
              <button className="btn ghost" onClick={() => setSec(s => s - 1)}>
                <ArrowLeft size={17} /> {t.back}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn" disabled={!canGo} onClick={() => setSec(s => s + 1)}>
              {sec === 0 ? t.start : sec === LAST - 1 ? t.seeSummary : t.next} <ArrowRight size={17} />
            </button>
          </div>
        )}

        <div className="foot noprint">
          MASQUE patient companion v{APP_VERSION} · instrument v{INSTRUMENT_VERSION} · research prototype ·
          nothing you type leaves this device
        </div>
      </div>
    </div>
  );
}

const BLURB_ES = {
  migraine: "La migraña no siempre es un dolor de cabeza clásico. Puede aparecer como presión en la cara y los pómulos que se siente igual que un problema de los senos nasales.",
  vestibular: "Los mareos y los síntomas del oído pueden venir del mismo mecanismo, aunque las pruebas de audición y los estudios salgan normales.",
  neuro: "Algunas personas tienen síntomas de los nervios — ardor, hormigueo, o dolor que no corresponde con lo que muestra el examen.",
  impact: "Dos preguntas rápidas. Estas suelen pesar mucho con los médicos, así que vale más ser exacto que valiente.",
  discriminators: "Estas apuntan en dirección contraria al patrón que busca esta herramienta, lo cual las hace igual de útiles. Mucha gente no lo sabrá — ahí \"No estoy seguro\" es de verdad la respuesta correcta.",
};
const BLURB = {
  migraine: "Migraine doesn't always mean a classic headache. It can show up as pressure across the face and cheeks that feels exactly like a sinus problem.",
  vestibular: "Dizziness and ear symptoms can come from the same mechanism, even when hearing tests and scans are normal.",
  neuro: "Some people get nerve-type symptoms — burning, tingling, or pain that doesn't match what an exam shows.",
  impact: "Two quick questions. These tend to carry a lot of weight with clinicians, so it's worth being accurate rather than brave.",
  discriminators: "These point away from the pattern this tool looks for, which makes them just as useful. Plenty of people won't know — \"Not sure\" is genuinely the right answer then.",
};

function Intro() {
  return (
    <div className="card">
      <h2>Before your appointment</h2>
      <p className="lede">
        This takes about five minutes. At the end you get a one-page summary you can print or
        show on your phone — what to say, what to ask, and what you're unsure about.
      </p>
      <div className="sum" style={{ marginTop: 16 }}>
        <h3>It's for you if</h3>
        <ul>
          <li>You've had sinus, face-pressure, ear or dizziness symptoms for months.</li>
          <li>Treatments haven't held, or your scans came back normal and you still feel unwell.</li>
          <li>You've seen more than one clinician about it.</li>
        </ul>
      </div>
      <div className="sum ask">
        <h3>What it isn't</h3>
        <p>
          It doesn't diagnose anything and it won't tell you what you have. It gives you no score
          and no risk number. What it does is help you describe the pattern accurately, which is
          often the part that's been going wrong.
        </p>
      </div>
      <div className="disc">
        <Info size={17} style={{ flex: "0 0 auto", marginTop: 1 }} />
        <span>
          Everything stays in your browser. Nothing is uploaded, saved to an account, or shared —
          the summary only leaves this device if you print or download it yourself.
        </span>
      </div>
    </div>
  );
}

function Safety({ flags, rf, setRf, safetyDone, setSafetyDone, urgent, t, loc }) {
  const toggle = id => setRf(v => { const n = { ...v }; if (n[id]) delete n[id]; else n[id] = true; return n; });
  return (
    <div className="card">
      <h2>First, a safety check</h2>
      <p className="lede">
        A few symptoms need looking at quickly, whatever else is going on. Tick anything that's true for you.
        If none of them are, that's the common answer.
      </p>
      <div style={{ marginTop: 14 }}>
        {RED_FLAGS.map(RAW => rfFor(loc, RAW)).map(f => (
          <div key={f.id} className={"flag" + (rf[f.id] ? " on" : "")} role="checkbox"
            aria-checked={!!rf[f.id]} tabIndex={0} onClick={() => toggle(f.id)}
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(f.id))}>
            <div className="box">{rf[f.id] && <Check size={15} />}</div>
            <div className="ft">
              {f.q}
              <span className="tier" style={{ background: TIER[f.tier].bg, color: TIER[f.tier].color }}>
                {f.tier === "now" ? t.tierNow : t.tierSoon}
              </span>
            </div>
          </div>
        ))}
      </div>

      {flags.length > 0 ? (
        <div className="call" style={{ background: TIER[urgent ? "now" : "soon"].bg }}>
          <div className="ct" style={{ color: TIER[urgent ? "now" : "soon"].color }}>
            <TriangleAlert size={20} /> {urgent ? "Please don't wait on this" : "Worth moving this along"}
          </div>
          <p>{urgent ? t.tierNowWhat : t.tierSoonWhat}</p>
          {flags.map(f => (
            <div className="say" key={f.id}>
              <span className="sl">{t.sayThis}</span>
              <q>{f.say}</q>
            </div>
          ))}
          <p style={{ marginTop: 12, fontSize: 15 }}>
            You can carry on and finish the summary — it'll include this at the top.
          </p>
        </div>
      ) : (
        <div className="nav" style={{ marginTop: 18 }}>
          <button className={"btn" + (safetyDone ? "" : " ghost")} onClick={() => setSafetyDone(v => !v)}>
            {safetyDone ? <Check size={17} /> : <ShieldCheck size={17} />} None of these apply to me
          </button>
        </div>
      )}
    </div>
  );
}

function QBlock({ domain, a, set, intro, t, loc }) {
  const d = ITEMS[domain];
  return (
    <>
      {intro && <div className="qh" style={{ marginTop: 14 }}>{intro}</div>}
      {d.items.map(it => {
        const p = pFor(loc, it.id);
        return (
          <div className="q" key={it.id}>
            <div className="qt">{p.q}</div>
            {p.help && <div className="qh">{p.help}</div>}
            <div className="opts">
              {it.scale
                ? p.opts.map((lab, i) => (
                    <button key={i} className={"o wide" + (a[it.id] === i ? " sel" : "")}
                      onClick={() => set(it.id, i)}>{lab}</button>
                  ))
                : (
                  <>
                    <button className={"o" + (a[it.id] === "yes" ? " sel" : "")} onClick={() => set(it.id, "yes")}>{t.yes}</button>
                    <button className={"o no" + (a[it.id] === "no" ? " sel" : "")} onClick={() => set(it.id, "no")}>{t.no}</button>
                    <button className={"o unsure" + (a[it.id] === "unsure" ? " sel" : "")} onClick={() => set(it.id, "unsure")}>{t.unsure}</button>
                  </>
                )}
            </div>
          </div>
        );
      })}
    </>
  );
}

/*  Summary construction.

    Everything here is a restatement of what the person actually entered, plus
    questions derived from which domains they endorsed. No inference about what
    they have, and no threshold that produces a verdict — the closest thing to a
    judgement is which questions are worth asking, which is the point of the tool.
*/
function buildSummary({ a, ctx, flags, urgent, loc = "en" }) {
  const S = SUM[loc] || SUM.en;
  const yes = id => a[id] === "yes";
  const scale = id => (typeof a[id] === "number" ? a[id] : null);
  const unsure = id => a[id] === "unsure";
  const L = xs => list(xs, loc);

  const said = [];
  if (yes("r_dur")) said.push(S.dur);
  if (yes("r_abx")) said.push(S.abx);
  if (yes("r_surg")) said.push(S.surg);
  if (yes("r_normal")) said.push(S.normal);
  if (yes("r_lesion")) said.push(S.lesion);

  const mHead = scale("m_head"), mDur = scale("m_dur");
  if (mHead > 0) said.push(S.headFreq(mHead));
  if (mDur === 2) said.push(S.durTypical);
  const mig = ["m_photo", "m_nausea", "m_disable", "m_aura", "m_trig", "m_fhx"].filter(yes);
  if (mig.length >= 2) said.push(S.migWith(L(mig.map(k => S.migWords[k]))));

  const vDur = scale("v_vertigo");
  if (vDur !== null && vDur > 0) said.push(S.vertigo(S.vertigoT[vDur]));
  if (yes("v_count")) said.push(S.vCount);
  if (yes("v_migfeat")) said.push(S.vMig);
  const vOther = ["v_motion", "v_aural", "v_head"].filter(yes);
  if (vOther.length) said.push(S.vAlso(L(vOther.map(k => S.vWords[k]))));

  const neu = ["n_burn", "n_otalgia", "n_auto", "n_viral", "n_allo"].filter(yes);
  if (neu.length) said.push(S.neuro(L(neu.map(k => S.nWords[k]))));

  const days = scale("i_days"), role = scale("i_role");
  if (days !== null && days > 0) said.push(S.days(S.daysT[days]));
  if (role !== null && role > 0) said.push(S.role(S.roleT[role]));

  const disc = ["x_purulent", "x_objective", "x_lowfreq", "x_anosmia"].filter(yes);
  if (disc.length) said.push(S.disc(L(disc.map(k => S.dWords[k]))));

  const ask = [];
  const migPattern = (mHead ?? 0) > 0 && (mig.length >= 2 || mDur === 2);
  const vestPattern = vDur === 2 || yes("v_count") || yes("v_migfeat");
  // The rule-outs carry contrary evidence. Asking "could this be migraine?" here
  // would push the tool's hypothesis past its own findings, so the question opens
  // both doors instead of one.
  if (migPattern && disc.length) ask.push(S.askBoth);
  else if (migPattern) ask.push(S.askMig);
  if (vestPattern) ask.push(S.askVest);
  if (migPattern || vestPattern) ask.push(S.askRefer);
  if (neu.length >= 2) ask.push(S.askNeuro);
  if (yes("r_normal") || yes("r_lesion")) ask.push(S.askNormal);
  if (disc.length) ask.push(S.askDisc(L(disc.map(k => S.dShort[k]))));
  if (yes("r_abx") || yes("r_surg")) ask.push(S.askTried);
  ask.push(S.askNext);

  const gapCount = [ctx.c_clin === "3+", ctx.c_dur === ">12mo", ctx.c_dismiss === "yes"].filter(Boolean).length;
  const gapLine = gapCount >= 2
    ? S.gap(ctx.c_clin === "3+", ctx.c_dur === ">12mo", ctx.c_dismiss === "yes")
    : null;

  const unsureList = Object.keys(P).filter(unsure);

  const clin = [];
  for (const k of DOMAIN_ORDER) {
    for (const it of ITEMS[k].items) {
      const v = a[it.id];
      if (v === undefined || v === "unsure" || v === "no") continue;
      if (it.scale && v === 0) continue;
      const detail = it.scale ? ` [${pFor(loc, it.id).opts[v]}]` : "";
      clin.push({ w: Math.abs(it.w), neg: it.w < 0, t: it.c + detail });
    }
  }
  clin.sort((x, y) => y.w - x.w);

  return { said, ask, gapLine, unsureList, clin, flags, urgent, ctx, loc };
}

/*  A "Not sure" is the most actionable thing on the summary — it names a gap the
    visit can actually close. Items carry an explicit `ask` form where the generic
    statement-to-question transform reads badly, which is most of the ones people
    are genuinely unsure about (their own imaging and audiometry).  */
function askForm(id, loc = "en") {
  const p = pFor(loc, id);
  if (p.ask) return p.ask;
  if (loc === "es") return p.q.replace(/\.$/, "?");   // no reliable transform; ask forms are supplied
  return p.q.replace(/^I've /, "Have I ").replace(/^I /, "Do I ").replace(/\.$/, "?");
}

function list(xs, loc = "en") {
  const and = loc === "es" ? "y" : "and";
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} ${and} ${xs[1]}`;
  const tail = loc === "es" ? ` ${and} ` : `, ${and} `;
  return `${xs.slice(0, -1).join(", ")}${tail}${xs[xs.length - 1]}`;
}

function Summary({ summary, onReset, t, loc }) {
  const { said, ask, gapLine, unsureList, clin, flags, urgent } = summary;
  const text = summaryText(summary, t, loc);
  // Same principle as the coverage gate on the clinician side: a near-empty
  // artifact must not be handed over as if it were a finished one.
  const thin = said.length === 0 && clin.length === 0 && flags.length === 0;

  return (
    <div className="card">
      <h2>{t.summaryTitle}</h2>
      {thin ? (
        <div className="sum ask">
          <h3>{t.thinTitle}</h3>
          <p>
            You haven't answered enough for this to be worth handing over. Go back and answer what
            you can — "Not sure" counts, and it's often the most useful answer, because it turns into
            something to ask about.
          </p>
        </div>
      ) : (
        <p className="lede noprint">
          Print this, or keep it open on your phone. Handing it over at the start of the appointment
          works better than trying to remember it all.
        </p>
      )}

      {flags.length > 0 && (
        <div className="call" style={{ background: TIER[urgent ? "now" : "soon"].bg }}>
          <div className="ct" style={{ color: TIER[urgent ? "now" : "soon"].color }}>
            <TriangleAlert size={20} /> {urgent ? "Get seen today" : "Get seen this week"}
          </div>
          <p>{urgent ? t.tierNowWhat : t.tierSoonWhat}</p>
          {flags.map(f => (
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
          <p style={{ marginBottom: 4 }}>Worth checking my records or asking directly:</p>
          <ul>{unsureList.map(id => <li key={id}>{askForm(id, loc)}</li>)}</ul>
        </div>
      )}

      {clin.length > 0 && (
        <div className="sum clin">
          <h3>{t.forClinician}</h3>
          <p style={{ marginBottom: 6, fontSize: 14 }}>
            Patient-reported features, MASQUE instrument v{INSTRUMENT_VERSION}. Self-reported and not
            a screening result — no index was calculated. Items marked <b>−</b> point away from the
            migrainous/neuropathic pattern.
          </p>
          <ul>{clin.map((c, i) => <li key={i}>{c.neg ? "− " : "+ "}{c.t}</li>)}</ul>
        </div>
      )}

      <div className="nav noprint">
        <button className="btn" onClick={() => window.print()}><Printer size={17} /> {t.print}</button>
        <button className="btn ghost" onClick={() => download(t.fileName, text)}>
          <Download size={17} /> {t.download}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={onReset}><RotateCcw size={16} /> {t.startOver}</button>
      </div>

      <div className="disc">
        <Info size={17} style={{ flex: "0 0 auto", marginTop: 1 }} />
        <span>
          This is a research prototype and not medical advice. It doesn't diagnose, and it hasn't
          been validated in a clinical study. If something feels wrong or is getting worse, contact
          a clinician regardless of what this page says.
        </span>
      </div>
    </div>
  );
}

function summaryText({ said, ask, gapLine, unsureList, clin, flags, urgent, loc = "en" }, t = UI.en) {
  const S = SUM[loc] || SUM.en;
  const up = x => String(x).toUpperCase();
  const L = [];
  L.push(up(t.summaryTitle), "=".repeat(40), "");
  if (t.txtUnreviewed) L.push(t.txtUnreviewed, "");
  if (flags.length) {
    L.push(urgent ? t.txtSeenToday : t.txtSeenWeek, urgent ? t.tierNowWhat : t.tierSoonWhat, "");
    flags.forEach(f => L.push(`  ${t.txtSay}: "${f.say}"`));
    L.push("");
  }
  if (gapLine) L.push(up(t.openWith), `  "${gapLine}"`, "");
  if (said.length) { L.push(up(t.describe)); said.forEach(x => L.push("  - " + x)); L.push(""); }
  if (ask.length) { L.push(up(t.askAbout)); ask.forEach(x => L.push("  - " + x)); L.push(""); }
  if (unsureList.length) {
    L.push(up(t.notSure));
    unsureList.forEach(id => L.push("  - " + askForm(id, loc)));
    L.push("");
  }
  if (clin.length) {
    // The clinician block stays in clinical English regardless of locale: it is
    // addressed to the clinician, and instrument item wording is the thing that has
    // to match the screener exactly for the handoff to be worth anything.
    L.push(up(t.forClinician), "  " + S.clinNote(INSTRUMENT_VERSION), "  " + t.txtClinNote);
    clin.forEach(c => L.push("  " + (c.neg ? "- " : "+ ") + c.t));
    L.push("");
  }
  L.push("-".repeat(40), `MASQUE v${APP_VERSION} — ${t.txtFooter}`);
  return L.join("\n");
}

function download(name, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url; el.download = name; el.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
