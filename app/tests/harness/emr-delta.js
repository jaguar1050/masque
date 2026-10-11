// tests/harness/emr-delta.js — the EMR Friendly Template data, release 0.4.3 (signed off in 0.4.4).
// Plain data only: no imports, no logic, nothing happens at import time. Local-only, never deployed.
//
// One source of truth, as tests/harness/locale-delta.js is for the Spanish completion:
//   tests/tools/extract-rubric.js  inserts `value` as the top-level rubric key `emrTemplate`, just
//                                  before `changelog` (applyEmrDelta, tests/harness/diff.js), proves it
//                                  exact with revertEmrDelta, checks every reference it makes, and
//                                  appends `changelog` after the translation entry and, since
//                                  release 0.4.4, `signOffChangelog` right after it;
//   tests/suites/*                 may exempt exactly these leaves (pointer + value) from the
//                                  provenance sweep.
//
// Requested by the user on 2026-10-06 ("EMR Friendly Template" in the Clinician Screener and the
// Ambient Scribe). DRAFTED BY AI AGENTS from the verified citation register (emr-verified-sources:
// statuses verified and corrected only) and the content basis (emr-basis); `drafted` keeps that
// provenance as history. SIGNED OFF BY THE CLINICAL LEAD on 2026-10-07, in chat, and recorded in
// release 0.4.4 (`signOff`): the emrTemplate content and the note it generates as implemented in
// release 0.4.3 (decisions D1-D16, review rounds 1-4). The data itself did not change. The sign-off
// does not cover the Spanish translation (locales.es stays reviewed: false), and the recorded
// follow-ups stay open as known limitations, accepted at sign-off (CHANGELOG.md, release 0.4.4).
// Rules the data keeps:
//   - citations are metadata and a link only (title, publisher, citation, https url, accessed);
//     no guideline text is pasted or paraphrased (AAFP, AAO-HNSF and AAN reuse terms), and no
//     agent, dose, threshold or duration is stored;
//   - labels are short therapy-class, exam or section names (N, with their citation keys), or a
//     section heading (S); placeholders are the engine's: no string here carries [ ] { };
//   - every id-bearing rule (flag -> citations, checklist signals keyed by item or probe id,
//     phenotype -> reference selection, exam rows tied to probes) lives here, never in the engine.
//
// Shape (validator V61):
//   value.citations    {KEY: {title, publisher, citation, url, accessed}}   only the keys used
//   value.references   [{label, citations, showFor?} | {note, citations, showFor?}]  printed only
//                      while the referral gate is open (D4); showFor.phenotypes selects by complaint
//   value.instrumentRecs  [routing rule id]  recs whose chips are instruments ("Instruments: a; b");
//                      other static chips print as "Named on screen: a; b", computed chips not at all
//   value.redFlagRefs  {flagId: [KEY]}   "Ref:" lines under each open flag's module action (D5)
//   value.redFlagPlaceholders  {flagId: text}  a [text] placeholder under that flag's references
//   value.history      [{item, qualifier?} | {label, probe?}]  treatment and workup to date: an item's
//                      patientClin and its recorded state, or a placeholder heading (a probe's recorded
//                      answer follows it, labelled as recorded); an item's qualifier follows a negative
//                      answer no probe wrote; history rows carry no citations (round 2)
//   value.checklist    [{id, group, label, placeholder?, box?, onlyWithSignal?, citations, signals:
//                      [{item, value, render, qualifier?} | {probe, option, render, qualifier?}]}]  render: done
//                      ([x], recorded), answeredNo, note (context only), neverTried (a probe only); an
//                      item signal's render matches its answer's polarity (V61); nothing is ever ticked
//                      from missing data; box false prints a status line; onlyWithSignal prints the
//                      row only when a signal holds; placeholder adds [placeholder]; each row names its
//                      own numbered sources
//   value.examRows     [{label, citations?, probe?}]  a probe's recorded answer is shown as recorded
//                      (the probe must be an exam-kind probe); each row names its own numbered sources
//   basis              {pointer under /emrTemplate: what the entry rests on}   one per entry
//   drafted            {by, date, requestedBy, sources, reviewed}: who drafted the data, kept as
//                      history; reviewed is true only together with a complete signOff, and
//                      applyEmrDelta (tests/harness/diff.js) refuses a delta that reads otherwise
//   signOff            {by, date, scope, channel}: the clinical-lead sign-off (release 0.4.4)
//   changelog          the emr-template entry of release 0.4.3, kept as it was (history)
//   signOffChangelog   the sign-off entry of release 0.4.4, appended right after it

/** The EMR Friendly Template data of release 0.4.3, inserted as rubric.emrTemplate; signed off in 0.4.4. */
export const EMR_DELTA = {
  release: "0.4.3",
  path: "/emrTemplate",
  before: "changelog",
  drafted: {
    "by": "screenAIr team (AI agents: content basis, citation verification and implementation; Claude)",
    "date": "2026-10-06",
    "requestedBy": "user",
    "sources": "emr-verified-sources (statuses verified and corrected only)",
    "reviewed": true
  },
  signOff: {
    "by": "clinical lead",
    "date": "2026-10-07",
    "scope": "emrTemplate content and the generated note as implemented in release 0.4.3 (decisions D1-D16, review rounds 1-4)",
    "channel": "chat"
  },
  value: {
    "citations": {
      "AAN26": {
        "title": "Pharmacologic Treatment for Migraine Prevention in Adults Practice Guideline Recommendations: Report of the AAN Guidelines Subcommittee and the American Headache Society",
        "publisher": "American Academy of Neurology / American Headache Society (endorsed by AAFP)",
        "citation": "Potrebic S, Tanveer S, Becker WJ, et al. Pharmacologic Treatment for Migraine Prevention in Adults Practice Guideline Recommendations: Report of the AAN Guidelines Subcommittee and the American Headache Society. Neurology. 2026;107(7):e214881.",
        "url": "https://www.aan.com/Guidelines/Home/GuidelineDetail/1158",
        "accessed": "2026-10-06"
      },
      "AFP-PROPH25": {
        "title": "Migraine Headache Prophylaxis",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Moreland P, Gaffney B, Lanham JS. Migraine Headache Prophylaxis. Am Fam Physician. 2025;111(5):443-450.",
        "url": "https://www.aafp.org/afp/2025/0500/migraine-headache-prophylaxis",
        "accessed": "2026-10-06"
      },
      "AFP-ACUTE25": {
        "title": "Acute Migraine Headache: Treatment Strategies",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Wiley AT, Watson JC, Lehmann DN. Acute Migraine Headache: Treatment Strategies. Am Fam Physician. 2025;111(4):317-327 (updated 2026-04-02).",
        "url": "https://www.aafp.org/afp/2025/0400/acute-migraine-headache",
        "accessed": "2026-10-06"
      },
      "AFP-IHSACUTE26": {
        "title": "Acute Migraine Treatment: Guidelines From the International Headache Society",
        "publisher": "American Family Physician (summary of International Headache Society guidance)",
        "citation": "Arnold MJ. Acute Migraine Treatment: Guidelines From the International Headache Society. Am Fam Physician. 2026;113(2):196-198.",
        "url": "https://www.aafp.org/afp/2026/0200/practice-guidelines-acute-migraine-treatment",
        "accessed": "2026-10-06"
      },
      "AFP-DIZZ23": {
        "title": "Dizziness: Evaluation and Management",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Rogers TS, Noel MA, Garcia B. Dizziness: Evaluation and Management. Am Fam Physician. 2023;107(5):514-523.",
        "url": "https://www.aafp.org/afp/2023/0500/dizziness",
        "accessed": "2026-10-06"
      },
      "COCH-VMPROPH23": {
        "title": "Pharmacological interventions for prophylaxis of vestibular migraine",
        "publisher": "Cochrane (Cochrane ENT)",
        "citation": "Webster K, Dor A, Galbraith K, et al. Pharmacological interventions for prophylaxis of vestibular migraine. Cochrane Database Syst Rev. 2023;4(4):CD015187.",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10093999/",
        "accessed": "2026-10-06"
      },
      "COCH-VMACUTE23": {
        "title": "Pharmacological interventions for acute attacks of vestibular migraine",
        "publisher": "Cochrane (Cochrane ENT)",
        "citation": "Webster KE, Dor A, Galbraith K, et al. Pharmacological interventions for acute attacks of vestibular migraine. Cochrane Database Syst Rev. 2023;4(4):CD015322.",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10097606/",
        "accessed": "2026-10-06"
      },
      "BARANY22": {
        "title": "Vestibular migraine: Diagnostic criteria (Update). Literature update 2021: consensus document of the Bárány Society and the International Headache Society",
        "publisher": "Bárány Society / International Headache Society",
        "citation": "Lempert T, Olesen J, Furman J, et al. Vestibular migraine: Diagnostic criteria (Update). J Vestib Res. 2022;32(1):1-6.",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9249276/",
        "accessed": "2026-10-06"
      },
      "ACR-HA22": {
        "title": "ACR Appropriateness Criteria: Headache (2022 Update)",
        "publisher": "American College of Radiology",
        "citation": "Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Headache (2022 Update). J Am Coll Radiol. 2023;20(5S):S70-S93.",
        "url": "https://acsearch.acr.org/docs/69482/Narrative/",
        "accessed": "2026-10-06"
      },
      "AFP-HA22": {
        "title": "Acute Headache in Adults: A Diagnostic Approach",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Viera AJ, Antono B. Acute Headache in Adults: A Diagnostic Approach. Am Fam Physician. 2022;106(3):260-268.",
        "url": "https://www.aafp.org/afp/2022/0900/acute-headache-adults",
        "accessed": "2026-10-06"
      },
      "ACR-STROKE23": {
        "title": "ACR Appropriateness Criteria: Cerebrovascular Diseases-Stroke and Stroke-Related Conditions",
        "publisher": "American College of Radiology",
        "citation": "Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Cerebrovascular Diseases-Stroke and Stroke-Related Conditions. J Am Coll Radiol. 2024;21(6S):S21-S64.",
        "url": "https://acsearch.acr.org/docs/3149012/Narrative/",
        "accessed": "2026-10-06"
      },
      "AHA26": {
        "title": "2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke",
        "publisher": "American Heart Association / American Stroke Association",
        "citation": "Prabhakaran S, Gonzalez NR, Zachrison KS, et al. 2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke. Stroke. 2026;57(8):e316-e436.",
        "url": "https://doi.org/10.1161/STR.0000000000000513",
        "accessed": "2026-10-06"
      },
      "GRACE3-23": {
        "title": "Guidelines for reasonable and appropriate care in the emergency department 3 (GRACE-3): Acute dizziness and vertigo in the emergency department",
        "publisher": "Society for Academic Emergency Medicine",
        "citation": "Edlow JA, Carpenter C, Akhter M, et al. Guidelines for reasonable and appropriate care in the emergency department 3 (GRACE-3): Acute dizziness and vertigo in the emergency department. Acad Emerg Med. 2023;30(5):442-486.",
        "url": "https://doi.org/10.1111/acem.14728",
        "accessed": "2026-10-06"
      },
      "IIH18": {
        "title": "Idiopathic intracranial hypertension: consensus guidelines on management",
        "publisher": "UK IIH specialist interest group (with consultation of ABN, SBNS, RCOphth, BASH)",
        "citation": "Mollan SP, Davies B, Silver NC, et al. Idiopathic intracranial hypertension: consensus guidelines on management. J Neurol Neurosurg Psychiatry. 2018;89(10):1088-1100.",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6166610/",
        "accessed": "2026-10-06"
      },
      "AFP-VISION25": {
        "title": "Sudden Vision Loss: A Diagnostic Approach",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Fraser JA, Son M, Vinokurtseva A. Sudden Vision Loss: A Diagnostic Approach. Am Fam Physician. 2025;111(1):54-61.",
        "url": "https://www.aafp.org/afp/2025/0100/sudden-vision-loss",
        "accessed": "2026-10-06"
      },
      "AFP-GCA22": {
        "title": "Polymyalgia Rheumatica and Giant Cell Arteritis: Rapid Evidence Review",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Raleigh MF, Stoddard J, Darrow HJ. Polymyalgia Rheumatica and Giant Cell Arteritis: Rapid Evidence Review. Am Fam Physician. 2022;106(4):420-426.",
        "url": "https://www.aafp.org/afp/2022/1000/polymyalgia-rheumatica-giant-cell-arteritis",
        "accessed": "2026-10-06"
      },
      "ACR-GCA21": {
        "title": "2021 American College of Rheumatology/Vasculitis Foundation Guideline for the Management of Giant Cell Arteritis and Takayasu Arteritis",
        "publisher": "American College of Rheumatology / Vasculitis Foundation",
        "citation": "Maz M, Chung SA, Abril A, et al. 2021 American College of Rheumatology/Vasculitis Foundation Guideline for the Management of Giant Cell Arteritis and Takayasu Arteritis. Arthritis Rheumatol. 2021;73(8):1349-1365.",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12344528/",
        "accessed": "2026-10-06"
      },
      "ACR-SINO21": {
        "title": "ACR Appropriateness Criteria: Sinonasal Disease (2021 Update)",
        "publisher": "American College of Radiology",
        "citation": "Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Sinonasal Disease (2021 Update). J Am Coll Radiol. 2022;19(5S):S175-S193.",
        "url": "https://acsearch.acr.org/docs/69502/Narrative/",
        "accessed": "2026-10-06"
      },
      "AFP-HL19": {
        "title": "Hearing Loss in Adults: Differential Diagnosis and Treatment",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Michels TC, Duffy MT, Rogers DJ. Hearing Loss in Adults: Differential Diagnosis and Treatment. Am Fam Physician. 2019;100(2):98-108.",
        "url": "https://www.aafp.org/afp/2019/0715/p98",
        "accessed": "2026-10-06"
      },
      "ACR-HLV18": {
        "title": "ACR Appropriateness Criteria: Hearing Loss and/or Vertigo",
        "publisher": "American College of Radiology",
        "citation": "Expert Panel on Neurologic Imaging. ACR Appropriateness Criteria: Hearing Loss and/or Vertigo. J Am Coll Radiol. 2018;15(11S):S321-S331.",
        "url": "https://acsearch.acr.org/docs/69488/Narrative/",
        "accessed": "2026-10-06"
      },
      "ACR-TINN23": {
        "title": "ACR Appropriateness Criteria: Tinnitus (2023 Update)",
        "publisher": "American College of Radiology",
        "citation": "Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Tinnitus (2023 Update). J Am Coll Radiol. 2023;20(11S):S574-S591.",
        "url": "https://acsearch.acr.org/docs/3094199/Narrative",
        "accessed": "2026-10-06"
      },
      "AFP-TINN21": {
        "title": "Tinnitus: Diagnosis and Management",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Dalrymple SN, Lewis SH, Philman S. Tinnitus: Diagnosis and Management. Am Fam Physician. 2021;103(11):663-671.",
        "url": "https://www.aafp.org/afp/2021/0601/p663",
        "accessed": "2026-10-06"
      },
      "AAO-TINN14": {
        "title": "Clinical Practice Guideline: Tinnitus",
        "publisher": "American Academy of Otolaryngology–Head and Neck Surgery Foundation",
        "citation": "Tunkel DE, Bauer CA, Sun GH, et al. Clinical Practice Guideline: Tinnitus. Otolaryngol Head Neck Surg. 2014;151(2 Suppl):S1-S40.",
        "url": "https://doi.org/10.1177/0194599814545325",
        "accessed": "2026-10-06"
      },
      "NICE-CG150": {
        "title": "Headaches in over 12s: diagnosis and management (CG150)",
        "publisher": "National Institute for Health and Care Excellence (NICE, UK)",
        "citation": "NICE. Headaches in over 12s: diagnosis and management (CG150). Published 2012-09-19; last updated 2025-06-03.",
        "url": "https://www.nice.org.uk/guidance/cg150/chapter/Recommendations",
        "accessed": "2026-10-06"
      },
      "SNNOOP10": {
        "title": "Red and orange flags for secondary headaches in clinical practice: SNNOOP10 list",
        "publisher": "Neurology (AAN journal); a narrative review, not an AAN guideline or position",
        "citation": "Do TP, Remmers A, Schytz HW, et al. Red and orange flags for secondary headaches in clinical practice: SNNOOP10 list. Neurology. 2019;92(3):134-144 (narrative review).",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6340385/",
        "accessed": "2026-10-06"
      },
      "ACR-CN22": {
        "title": "ACR Appropriateness Criteria: Cranial Neuropathy (2022 Update)",
        "publisher": "American College of Radiology",
        "citation": "Expert Panel on Neurological Imaging. ACR Appropriateness Criteria: Cranial Neuropathy (2022 Update). J Am Coll Radiol. 2022;19(11S):S266-S303.",
        "url": "https://acsearch.acr.org/docs/69509/Narrative",
        "accessed": "2026-10-06"
      },
      "AFP-AR23": {
        "title": "Allergic Rhinitis: Rapid Evidence Review",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Weaver-Agostoni J, Kosak Z, Bartlett S. Allergic Rhinitis: Rapid Evidence Review. Am Fam Physician. 2023;107(5):466-473.",
        "url": "https://www.aafp.org/afp/2023/0500/allergic-rhinitis",
        "accessed": "2026-10-06"
      },
      "AAO-AR15": {
        "title": "Clinical Practice Guideline: Allergic Rhinitis",
        "publisher": "American Academy of Otolaryngology–Head and Neck Surgery Foundation",
        "citation": "Seidman MD, Gurgel RK, Lin SY, et al. Clinical Practice Guideline: Allergic Rhinitis. Otolaryngol Head Neck Surg. 2015;152(1 Suppl):S1-S43.",
        "url": "https://doi.org/10.1177/0194599814561600",
        "accessed": "2026-10-06"
      },
      "JTF-RHIN20": {
        "title": "Rhinitis 2020: A practice parameter update",
        "publisher": "AAAAI/ACAAI Joint Task Force on Practice Parameters",
        "citation": "Dykewicz MS, Wallace DV, Amrol DJ, et al. Rhinitis 2020: A practice parameter update. J Allergy Clin Immunol. 2020;146(4):721-767.",
        "url": "https://doi.org/10.1016/j.jaci.2020.07.007",
        "accessed": "2026-10-06"
      },
      "ICAR-AR23": {
        "title": "International consensus statement on allergy and rhinology: Allergic rhinitis – 2023",
        "publisher": "International Forum of Allergy & Rhinology (ARS/AAOA); synopsis in an AAAAI journal",
        "citation": "Wise SK, et al. International consensus statement on allergy and rhinology: Allergic rhinitis – 2023. Int Forum Allergy Rhinol. 2023;13(4):293-859. Synopsis: J Allergy Clin Immunol Pract. 2023;11(3):773-796.",
        "url": "https://doi.org/10.1002/alr.23090",
        "accessed": "2026-10-06"
      },
      "AAO-SIN25": {
        "title": "Clinical Practice Guideline: Adult Sinusitis Update",
        "publisher": "American Academy of Otolaryngology–Head and Neck Surgery Foundation",
        "citation": "Payne SC, McKenna M, Buckley J, et al. Clinical Practice Guideline: Adult Sinusitis Update. Otolaryngol Head Neck Surg. 2025;173 Suppl 1:S1-S56.",
        "url": "https://doi.org/10.1002/ohn.1344",
        "accessed": "2026-10-06"
      },
      "AFP-CRS23": {
        "title": "Chronic Rhinosinusitis",
        "publisher": "American Academy of Family Physicians (American Family Physician)",
        "citation": "Keating MK, Phillips JC, Phillips J. Chronic Rhinosinusitis. Am Fam Physician. 2023;108(4):370-377.",
        "url": "https://www.aafp.org/afp/2023/1000/chronic-rhinosinusitis",
        "accessed": "2026-10-06"
      },
      "AAO-CRSSURG25": {
        "title": "Clinical Practice Guideline: Surgical Management of Chronic Rhinosinusitis",
        "publisher": "American Academy of Otolaryngology–Head and Neck Surgery Foundation",
        "citation": "Shin JJ, Wilson M, McKenna M, et al. Clinical Practice Guideline: Surgical Management of Chronic Rhinosinusitis. Otolaryngol Head Neck Surg. 2025;172 Suppl 2:S1-S47.",
        "url": "https://doi.org/10.1002/ohn.1287",
        "accessed": "2026-10-06"
      },
      "AAO-BPPV17": {
        "title": "Clinical Practice Guideline: Benign Paroxysmal Positional Vertigo (Update)",
        "publisher": "American Academy of Otolaryngology–Head and Neck Surgery Foundation",
        "citation": "Bhattacharyya N, Gubbels SP, Schwartz SR, et al. Clinical Practice Guideline: Benign Paroxysmal Positional Vertigo (Update). Otolaryngol Head Neck Surg. 2017;156(3_suppl):S1-S47.",
        "url": "https://doi.org/10.1177/0194599816689667",
        "accessed": "2026-10-06"
      },
      "AAO-SSNHL19": {
        "title": "Clinical Practice Guideline: Sudden Hearing Loss (Update)",
        "publisher": "American Academy of Otolaryngology–Head and Neck Surgery Foundation",
        "citation": "Chandrasekhar SS, Tsai Do BS, Schwartz SR, et al. Clinical Practice Guideline: Sudden Hearing Loss (Update). Otolaryngol Head Neck Surg. 2019;161(1_suppl):S1-S45.",
        "url": "https://doi.org/10.1177/0194599819859885",
        "accessed": "2026-10-06"
      }
    },
    "references": [
      {
        "label": "Migraine prevention guideline — AAN/AHS (endorsed by AAFP), 2026",
        "citations": [
          "AAN26"
        ]
      },
      {
        "label": "Migraine prophylaxis — American Family Physician (AAFP journal), 2025; predates AAN/AHS 2026",
        "citations": [
          "AFP-PROPH25"
        ]
      },
      {
        "label": "Acute (abortive) migraine treatment — American Family Physician (AAFP journal), 2025",
        "citations": [
          "AFP-ACUTE25"
        ]
      },
      {
        "label": "Acute treatment (IHS recommendations, summarized in AFP 2026)",
        "citations": [
          "AFP-IHSACUTE26"
        ]
      },
      {
        "label": "Dizziness and vestibular migraine — American Family Physician (AAFP journal), 2023",
        "citations": [
          "AFP-DIZZ23"
        ],
        "showFor": {
          "phenotypes": [
            "otologic",
            "both"
          ]
        }
      },
      {
        "note": "Vestibular migraine: no consensus treatment; drug evidence low or very-low certainty.",
        "citations": [
          "AFP-DIZZ23",
          "COCH-VMPROPH23",
          "COCH-VMACUTE23",
          "BARANY22"
        ],
        "showFor": {
          "phenotypes": [
            "otologic",
            "both"
          ]
        }
      }
    ],
    "instrumentRecs": [
      "sinus_migraine",
      "vestibular_migraine",
      "tinnitus"
    ],
    "redFlagRefs": {
      "rf_thunderclap": [
        "ACR-HA22",
        "AFP-HA22"
      ],
      "rf_focal": [
        "ACR-STROKE23",
        "AHA26",
        "GRACE3-23"
      ],
      "rf_vision": [
        "ACR-HA22",
        "IIH18",
        "ACR-STROKE23",
        "AFP-VISION25"
      ],
      "rf_gca": [
        "AFP-GCA22",
        "ACR-GCA21",
        "AFP-VISION25"
      ],
      "rf_orbital": [
        "ACR-SINO21"
      ],
      "rf_ssnhl": [
        "AFP-HL19",
        "ACR-HLV18"
      ],
      "rf_asym": [
        "ACR-HLV18",
        "ACR-TINN23",
        "AFP-HL19",
        "AFP-TINN21",
        "AAO-TINN14"
      ],
      "rf_pulsatile": [
        "ACR-TINN23",
        "AFP-TINN21",
        "ACR-HA22"
      ],
      "rf_progressive": [
        "ACR-HA22",
        "NICE-CG150",
        "SNNOOP10"
      ],
      "rf_new50": [
        "ACR-HA22",
        "AFP-HA22",
        "AFP-GCA22"
      ],
      "rf_mass": [
        "ACR-SINO21",
        "ACR-CN22"
      ],
      "rf_systemic": [
        "ACR-HA22",
        "NICE-CG150"
      ]
    },
    "redFlagPlaceholders": {
      "rf_systemic": "directed workup — specify"
    },
    "history": [
      {
        "item": "r_abx"
      },
      {
        "item": "r_surg"
      },
      {
        "item": "r_normal",
        "qualifier": "workup not recorded"
      },
      {
        "item": "r_lesion",
        "qualifier": "workup not recorded"
      },
      {
        "item": "x_objective",
        "qualifier": "testing not recorded"
      },
      {
        "item": "x_purulent"
      },
      {
        "item": "x_lowfreq",
        "qualifier": "testing not recorded"
      },
      {
        "item": "x_anosmia"
      },
      {
        "label": "Antibiotic / steroid courses — agent, route (oral / intranasal), dates, response"
      },
      {
        "label": "Prior imaging — modality, date, result; Lund-Mackay score if CT"
      },
      {
        "label": "Audiograms / vestibular testing — dates, results"
      },
      {
        "label": "Prior migraine abortive or preventive trials — agent, dose, duration, response",
        "probe": "pr_treatment_trial"
      },
      {
        "label": "Vestibular rehabilitation / repositioning manoeuvres to date"
      },
      {
        "label": "Acute headache medication use — days per month, by class"
      }
    ],
    "checklist": [
      {
        "id": "al1_si3",
        "group": "allergy",
        "label": "Intranasal corticosteroid trial (allergic rhinitis or sinus indication)",
        "citations": [
          "AFP-AR23",
          "AAO-AR15",
          "JTF-RHIN20",
          "ICAR-AR23",
          "AAO-SIN25",
          "AFP-CRS23"
        ],
        "signals": [
          {
            "item": "r_abx",
            "value": "yes",
            "render": "note",
            "qualifier": "agent/route not recorded"
          }
        ]
      },
      {
        "id": "al2",
        "group": "allergy",
        "label": "Second-generation antihistamine trial (oral or intranasal)",
        "citations": [
          "AAO-AR15",
          "AFP-AR23",
          "ICAR-AR23"
        ],
        "signals": []
      },
      {
        "id": "al3",
        "group": "allergy",
        "label": "Specific-IgE allergy testing (skin or serum)",
        "placeholder": "date / result",
        "citations": [
          "AFP-AR23",
          "AAO-AR15"
        ],
        "signals": []
      },
      {
        "id": "si1",
        "group": "sinusitis",
        "label": "Objective sinus evaluation (rhinoscopy, endoscopy or CT)",
        "citations": [
          "AAO-SIN25",
          "AFP-CRS23"
        ],
        "signals": [
          {
            "probe": "pr_scan_detail",
            "option": 1,
            "render": "done"
          },
          {
            "item": "x_objective",
            "value": "yes",
            "render": "done"
          },
          {
            "item": "x_objective",
            "value": "no",
            "render": "answeredNo"
          },
          {
            "item": "r_normal",
            "value": "yes",
            "render": "note",
            "qualifier": "modality not recorded"
          }
        ]
      },
      {
        "id": "si2",
        "group": "sinusitis",
        "label": "Saline irrigation",
        "citations": [
          "AAO-SIN25",
          "AFP-CRS23",
          "AFP-AR23"
        ],
        "signals": []
      },
      {
        "id": "si4",
        "group": "sinusitis",
        "label": "Antibiotic stewardship reviewed",
        "box": false,
        "onlyWithSignal": true,
        "citations": [
          "AAO-SIN25",
          "AFP-CRS23",
          "AAO-CRSSURG25"
        ],
        "signals": [
          {
            "item": "r_abx",
            "value": "yes",
            "render": "note",
            "qualifier": "agent/route not recorded"
          }
        ]
      },
      {
        "id": "dz1",
        "group": "dizziness",
        "label": "Canalith repositioning (if positional vertigo)",
        "citations": [
          "AAO-BPPV17",
          "AFP-DIZZ23",
          "GRACE3-23"
        ],
        "signals": [
          {
            "probe": "pr_dix_hallpike",
            "option": 0,
            "render": "note"
          },
          {
            "probe": "pr_dix_hallpike",
            "option": 1,
            "render": "note"
          },
          {
            "item": "v_head",
            "value": "yes",
            "render": "note"
          }
        ]
      },
      {
        "id": "dz2",
        "group": "dizziness",
        "label": "Vestibular rehabilitation (vestibular physical therapy)",
        "citations": [
          "AFP-DIZZ23"
        ],
        "signals": []
      },
      {
        "id": "dz3",
        "group": "dizziness",
        "label": "Migraine-directed trial for suspected vestibular migraine (empiric)",
        "citations": [
          "AFP-DIZZ23",
          "COCH-VMPROPH23",
          "COCH-VMACUTE23",
          "BARANY22"
        ],
        "signals": [
          {
            "probe": "pr_treatment_trial",
            "option": 0,
            "render": "done"
          },
          {
            "probe": "pr_treatment_trial",
            "option": 1,
            "render": "done"
          },
          {
            "probe": "pr_treatment_trial",
            "option": 2,
            "render": "neverTried"
          }
        ]
      },
      {
        "id": "dz4",
        "group": "dizziness",
        "label": "Audiogram (episodic vertigo with aural symptoms, or unilateral tinnitus)",
        "citations": [
          "AFP-DIZZ23",
          "AFP-TINN21",
          "AAO-TINN14"
        ],
        "signals": [
          {
            "item": "x_lowfreq",
            "value": "yes",
            "render": "done"
          }
        ]
      }
    ],
    "examRows": [
      {
        "label": "Orthostatic BP",
        "citations": [
          "AFP-DIZZ23"
        ]
      },
      {
        "label": "Head / neck"
      },
      {
        "label": "Cervical"
      },
      {
        "label": "Temporal arteries — tenderness, thickening, pulse",
        "probe": "pr_temporal_artery"
      },
      {
        "label": "Ears / otoscopy (right, left)"
      },
      {
        "label": "Weber / Rinne (512 Hz)",
        "citations": [
          "AAO-SSNHL19"
        ],
        "probe": "pr_tuning_fork"
      },
      {
        "label": "Nose — anterior rhinoscopy",
        "citations": [
          "AAO-SIN25"
        ]
      },
      {
        "label": "Nasal endoscopy (if performed)",
        "citations": [
          "AFP-CRS23"
        ]
      },
      {
        "label": "Unilateral obstruction / bleeding / visible mass / facial numbness"
      },
      {
        "label": "Oral cavity / oropharynx"
      },
      {
        "label": "Eyes — periorbital findings, extraocular movements"
      },
      {
        "label": "Fundoscopy — papilloedema present / absent / not examined",
        "citations": [
          "IIH18"
        ]
      },
      {
        "label": "Nystagmus (spontaneous / gaze-evoked / positional)",
        "citations": [
          "AFP-DIZZ23"
        ]
      },
      {
        "label": "Dix–Hallpike (right, left)",
        "citations": [
          "AAO-BPPV17",
          "AFP-DIZZ23"
        ],
        "probe": "pr_dix_hallpike"
      },
      {
        "label": "Head impulse / nystagmus / test of skew (HINTS)",
        "citations": [
          "AFP-DIZZ23",
          "GRACE3-23"
        ],
        "probe": "pr_head_impulse"
      },
      {
        "label": "Gait / Romberg",
        "citations": [
          "GRACE3-23"
        ]
      },
      {
        "label": "Neurologic — cranial nerves incl. facial sensation, motor, sensory, coordination, speech"
      },
      {
        "label": "Cardiac",
        "citations": [
          "AFP-DIZZ23"
        ]
      }
    ]
  },
  basis: {
    "/citations/AAN26": "C: emr-verified-sources.json, status corrected; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-PROPH25": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-ACUTE25": "C: emr-verified-sources.json, status corrected; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-IHSACUTE26": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-DIZZ23": "C: emr-verified-sources.json, status corrected; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/COCH-VMPROPH23": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/COCH-VMACUTE23": "C: emr-verified-sources.json, status corrected; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/BARANY22": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/ACR-HA22": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-HA22": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/ACR-STROKE23": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AHA26": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06; the url is the register's own (its DOI), as for every other key, in place of the PubMed record the basis offered as a fallback (fixer round 3)",
    "/citations/GRACE3-23": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/IIH18": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-VISION25": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-GCA22": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/ACR-GCA21": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/ACR-SINO21": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-HL19": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/ACR-HLV18": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/ACR-TINN23": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-TINN21": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AAO-TINN14": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/NICE-CG150": "C: emr-verified-sources.json, status corrected; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/SNNOOP10": "C: emr-verified-sources.json, status corrected; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/ACR-CN22": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-AR23": "C: emr-verified-sources.json, status corrected; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AAO-AR15": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/JTF-RHIN20": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/ICAR-AR23": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AAO-SIN25": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AFP-CRS23": "C: emr-verified-sources.json, status corrected; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AAO-CRSSURG25": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AAO-BPPV17": "C: emr-verified-sources.json, status verified; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/citations/AAO-SSNHL19": "C: emr-verified-sources.json, status corrected; citation and link only (emr-basis §9); accessed 2026-10-06",
    "/references/0": "N label + C AAN26 (emr-basis §2.10d; D4, D15): AAN/AHS 2026, endorsed by AAFP; listed first as the current prevention guideline (fixer round 1)",
    "/references/1": "N label + C AFP-PROPH25 (emr-basis §2.10d; D4, D15): the AAFP journal page the user asked for; labelled as an American Family Physician review, not AAFP policy, and as predating AAN/AHS 2026 (verifier caveat; fixer round 1)",
    "/references/2": "N label + C AFP-ACUTE25 (emr-basis §2.10d; D4): acute (abortive) treatment; labelled as an American Family Physician review (fixer round 1)",
    "/references/3": "N label + C AFP-IHSACUTE26 (emr-basis §2.10d; D4, optional, included): attributed to IHS, summarized in AFP",
    "/references/4": "N label + C AFP-DIZZ23 (emr-basis §2.10d; D4): shown for the otologic and both pictures; labelled as an American Family Physician review (fixer round 1)",
    "/references/5": "N (D1): the VM empiric line, from AFP-DIZZ23 (no consensus treatment), COCH-VMPROPH23 and COCH-VMACUTE23 (low or very-low certainty, as the line now says: fixer round 1), BARANY22 §4.10 (emr-basis §2.10d); shown for the otologic and both pictures",
    "/redFlagRefs/rf_thunderclap": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V1), AFP-HA22; ACEP19 background only, not printed",
    "/redFlagRefs/rf_focal": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-STROKE23 (V2), AHA26 (governing guideline only), GRACE3-23",
    "/redFlagRefs/rf_vision": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V4), IIH18, ACR-STROKE23 (V7), AFP-VISION25",
    "/redFlagRefs/rf_gca": "C (D5: module action + Ref only, no cited additions): emr-basis §3: AFP-GCA22, ACR-GCA21, AFP-VISION25",
    "/redFlagRefs/rf_orbital": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-SINO21 (V2, V4); AFP-ARS25 dropped (fixer round 1): its accessible text does not support the action Emergency ENT and imaging (verifier caveat), and a Ref line under the action would read as its source",
    "/redFlagRefs/rf_ssnhl": "C (D5: module action + Ref only, no cited additions): emr-basis §3: AFP-HL19, ACR-HLV18 (V3); AAO-SSNHL19 dropped here (fixer round 1) because emr-basis §3 says not to attribute same-day to AAO-HNSF (it gives audiometry within 14 days; it stays the examRows/5 citation). AFP-HL19 does not give same-day either (audiometry plus otolaryngology within one week): it is kept, like every Ref line, only under the line saying Ref lines are background reading, not the source of an action or its timing; the lead chooses one rule for both (fixer round 3)",
    "/redFlagRefs/rf_asym": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HLV18 (V3), ACR-TINN23 (V3), AFP-HL19, AFP-TINN21, AAO-TINN14",
    "/redFlagRefs/rf_pulsatile": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-TINN23 (V1), AFP-TINN21, ACR-HA22 (V4)",
    "/redFlagRefs/rf_progressive": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V7; V5 positional), NICE-CG150 1.1.1 (UK), SNNOOP10 (review)",
    "/redFlagRefs/rf_new50": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V7), AFP-HA22, AFP-GCA22",
    "/redFlagRefs/rf_mass": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-SINO21 (V5), ACR-CN22 (V2)",
    "/redFlagRefs/rf_systemic": "C (D5: module action + Ref only, no cited additions): emr-basis §3: ACR-HA22 (V7, imaging only), NICE-CG150 1.1.2 (UK)",
    "/instrumentRecs": "S scope (fixer round 1): the routing recommendations whose chips are all confirmatory instruments (masque.logic.js chips SNOT-22, ID Migraine, HIT-6, MIDAS; VM-PATHI, DHI, MIDAS; THI, TFI) print them under the label Instruments; neuro_overlay (its Screener chips add the referral Neurology) and competing (chips cut from rule-out item text) are left out",
    "/redFlagPlaceholders/rf_systemic": "P (emr-basis §3 and §5: rf_systemic has no verified lab panel, so it gets the placeholder directed workup — specify); the engine adds the brackets (fixer round 1)",
    "/history/0": "item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5)",
    "/history/1": "item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5)",
    "/history/2": "item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5); S qualifier workup not recorded after a negative answer no probe wrote: an answered no does not say the exam or imaging was abnormal, only that the patient did not endorse the item (emr-basis §2.5 implies a prior exam or imaging study, modality unknown; fixer round 3)",
    "/history/3": "item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5); S qualifier workup not recorded after a negative answer no probe wrote: an answered no does not say a lesion was found, only that the patient did not endorse the item (emr-basis §2.5 implies a prior workup, tests unknown; fixer round 3)",
    "/history/4": "item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5); S qualifier testing not recorded after a negative answer no probe wrote: an answered no does not record whether endoscopy or CT was done (emr-basis §2.5; fixer round 2)",
    "/history/5": "item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5)",
    "/history/6": "item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5); S qualifier testing not recorded after a negative answer no probe wrote: no does not mean an audiogram was done (emr-basis §2.5, §7 risk 6; fixer round 2)",
    "/history/7": "item id only; the line prints the item's own patientClin (M) and its recorded state (emr-basis §2.5)",
    "/history/8": "P heading (emr-basis §2.5); the engine adds the [ ] placeholder",
    "/history/9": "P heading (emr-basis §2.5); the engine adds the [ ] placeholder",
    "/history/10": "P heading (emr-basis §2.5); the engine adds the [ ] placeholder",
    "/history/11": "P heading (emr-basis §2.5); the engine adds the [ ] placeholder; on the Scribe the recorded pr_treatment_trial answer follows it, labelled as recorded by the clinician (emr-basis §2.5, migraine-directed therapy line; fixer round 1)",
    "/history/12": "P heading (emr-basis §2.5); the engine adds the [ ] placeholder",
    "/history/13": "P heading, verbatim from emr-basis §2.6 (optional D13 row; C AAN26 rec. 12A/B, AFP-IHSACUTE26, medication-overuse limits); no number is printed; the engine adds the [ ] placeholder. Data, not an engine heading, because the engine names no condition (t-emr); it sits with the treatment-to-date rows, before the empiric-treatment references it informs (fixer round 3)",
    "/checklist/0": "N (D1, D7: AL1 merged with SI3): AFP-AR23 (SOR A), AAO-AR15, JTF-RHIN20, ICAR-AR23 synopsis, AAO-SIN25 KAS 11, AFP-CRS23; r_abx is context only (it does not prove an intranasal steroid trial), qualified agent/route not recorded as emr-basis §4 AL1 gives it (fixer round 1)",
    "/checklist/1": "N (D1, D7: AL2): AAO-AR15, AFP-AR23, ICAR-AR23 synopsis",
    "/checklist/2": "N (D1, D7: AL3): AFP-AR23 (skin testing preferred, SOR A), AAO-AR15; the date / result placeholder as emr-basis §4 AL3 gives it (fixer round 1); the label cut to the class name, words of the §4 AL3 label: its indication clause restated the AFP-AR23 recommendation (risk 1, reuse terms), and the linked sources carry the indication: a D1 deviation (fixer round 3)",
    "/checklist/3": "N (D1, D7: SI1): AAO-SIN25 KAS 7B, AFP-CRS23; x_objective yes ticks it, no is answered no, r_normal is context only; labelled as the evaluation, not a confirmed diagnosis: x_objective records objective inflammation when symptomatic, not chronic rhinosinusitis (which also needs the symptom criteria), so a ticked row never reads as a diagnosis: a D1 deviation from the §4 SI1 label (fixer round 3). The Scribe's rule-out probe pr_scan_detail answered Genuinely clear (the module's option label, M) also ticks it, as recorded by the clinician via probe, first among the signals: a clear scan the clinician recorded is an evaluation done, though it writes x_objective no; the item's answered no still follows. S qualifier modality not recorded on the r_normal note: the item says an exam or imaging study was normal, not which (emr-basis §2.5; fixer round 4)",
    "/checklist/4": "N (D1, D7: SI2): AAO-SIN25 KAS 11, AFP-CRS23 (SOR A), AFP-AR23",
    "/checklist/5": "N (D1, D7: SI4, a stewardship line): AAO-SIN25 KAS 14, AFP-CRS23 (SOR B), AAO-CRSSURG25 KAS 3; r_abx is context only (agent/route not recorded); printed as a status line without a box, as emr-basis §4 SI4 asks (fixer round 1); printed only when r_abx = yes, as the §4 rendering gives it (onlyWithSignal), and labelled without the presumed diagnosis: a D1 deviation from the §4 SI4 label, whose wording restates the guideline (fixer round 2)",
    "/checklist/6": "N (D1, D7: DZ1): AAO-BPPV17, AFP-DIZZ23 (SOR A), GRACE3-23; the recorded Dix–Hallpike probe result and v_head are context only; the label names the treatment only, words of the §4 DZ1 label (the test is the examRows/13 row), so a recorded test never sits next to not recorded: a D1 deviation (fixer round 2)",
    "/checklist/7": "N (D1, D7: DZ2): AFP-DIZZ23; APTA22 (peripheral hypofunction only) deliberately not cited",
    "/checklist/8": "N (D1, D7: DZ3): AFP-DIZZ23 VM section, COCH-VMPROPH23, COCH-VMACUTE23, BARANY22 §4.10; pr_treatment_trial improved / no change ticks it with the module note verbatim, Never tried reads 'patient reports never tried'",
    "/checklist/9": "N (D1, D7: DZ4, included): AFP-DIZZ23 (SOR C), AFP-TINN21, AAO-TINN14; only x_lowfreq yes ticks it (no does not prove testing); the label with its indication as emr-basis §4 DZ4 gives it (fixer round 1)",
    "/examRows/0": "N label (D1) from C AFP-DIZZ23 (orthostatic BP)",
    "/examRows/1": "S heading (emr-basis §2.8)",
    "/examRows/2": "S heading (emr-basis §2.8)",
    "/examRows/3": "M probe pr_temporal_artery say (emr-basis §2.8); N noun-phrase label (D1)",
    "/examRows/4": "S heading; n_otalgia presumes an ear exam (emr-basis §2.8)",
    "/examRows/5": "M probe pr_tuning_fork; C AAO-SSNHL19 KAS 1 (emr-basis §2.8); N label (D1)",
    "/examRows/6": "N label (D1) from C AAO-SIN25 KAS 7B",
    "/examRows/7": "M x_objective names endoscopy; C AFP-CRS23 (emr-basis §2.8)",
    "/examRows/8": "M rf_mass text (emr-basis §2.8)",
    "/examRows/9": "S heading (emr-basis §2.8)",
    "/examRows/10": "M rf_orbital text (emr-basis §2.8)",
    "/examRows/11": "M rf_vision action; C IIH18 (emr-basis §2.8); N label (D1)",
    "/examRows/12": "N label (D1) from C AFP-DIZZ23",
    "/examRows/13": "M probe pr_dix_hallpike; C AAO-BPPV17, AFP-DIZZ23 (emr-basis §2.8); N label (D1)",
    "/examRows/14": "M probe pr_head_impulse; C AFP-DIZZ23, GRACE3-23 (accurate only in trained hands) (emr-basis §2.8); N label (D1); D6: no plan line",
    "/examRows/15": "N label (D1) from C GRACE3-23",
    "/examRows/16": "M rf_focal and rf_mass text (emr-basis §2.8)",
    "/examRows/17": "N label (D1) from C AFP-DIZZ23 (full cardiac and neurologic examination)"
  },
  changelog: {
    "date": "2026-10-06",
    "kind": "emr-template",
    "note": "EMR Friendly Template data added for release 0.4.3 (user request, 2026-10-06): emrTemplate carries citation metadata and links only (verified or corrected sources, accessed 2026-10-06), the empiric-treatment references, the routing recommendations whose chips are instruments, the red-flag references and workup placeholders, the treatment-and-workup rows, the management checklist and the exam rows. Drafted by AI agents from verified sources and not reviewed by the clinical lead (decisions D1-D16 await the lead); recorded row by row in tests/harness/emr-delta.js. No guideline text is copied and no agent, dose or threshold is stored. Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged; only contentHash changes.",
    "paths": [
      "/emrTemplate"
    ]
  },
  signOffChangelog: {
    "date": "2026-10-07",
    "kind": "sign-off",
    "note": "Clinical-lead sign-off, recorded in release 0.4.4: on 2026-10-07 the clinical lead signed off, in chat, the EMR Friendly Template content (emrTemplate) and the note it generates, as implemented in release 0.4.3 (decisions D1-D16, review rounds 1-4). The emrTemplate data is unchanged; tests/harness/emr-delta.js records the sign-off (signOff, reviewed: true) and keeps the AI-agent drafting provenance and the preceding emr-template entry as history. Not covered: the Spanish Patient Companion translation (locales.es stays reviewed: false). The recorded follow-ups stay open as known limitations, accepted at sign-off unless the lead asks for changes: a recorded central HINTS pattern with no plan response (D6), the referral destination for the complaint both (D3c), the Scribe phenotype quirk (D14), the upstream Bárány criterion labels, the gapLine copy, the unlabelled item-prompt answers on the Scribe and the round 3d follow-ups F-3D-1 to F-3D-4 (CHANGELOG.md, release 0.4.4). Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged; only contentHash changes.",
    "paths": [
      "/emrTemplate"
    ]
  },
};
