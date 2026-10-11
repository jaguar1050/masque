// tests/harness/referral-delta.js — the clinical-lead referral rule for dizziness cases, release 0.4.5.
// Plain data only: no imports, no logic, nothing happens at import time. Local-only, never deployed.
//
// One source of truth, as tests/harness/emr-delta.js is for the EMR template data:
//   tests/tools/extract-rubric.js  applies it to the baseline-extracted phenotypes.referral
//                                  (applyReferralDelta, tests/harness/diff.js): each `changed` row
//                                  replaces exactly its `from` value, each `added` row adds a key
//                                  that must not exist yet, at the end of its parent; it proves the
//                                  result exact with revertReferralDelta, proves `destinations` to be
//                                  exactly the referral destinations that differ from the baseline,
//                                  checks the lead's words, the lead's amendment of the definition
//                                  (`amendments`) and every phenotype the rule names, and appends
//                                  `changelog` after the release 0.4.4 sign-off entry;
//   tests/harness/diff.js AD17     excuses exactly the rows of `destinations` (baseline specialty →
//                                  new specialty, same reason, for the phenotype the row names) in a
//                                  referral ServiceRequest's code text; it reads the delta from
//                                  ctx.AD17, never by import;
//   tests/suites/values.js         pins this data and exempts exactly its leaves (pointer + value)
//                                  from the provenance sweep.
//
// THE DECISIONS. The user, who is the project's clinical lead, wrote in chat (verbatim, `quotes`):
//   2026-10-07  `quotes.referral`: the rule. Asked how true vertigo is to be recognised, the lead
//               gave the definition in `quotes.definition` (the lead's own words, given verbatim in
//               chat in answer to that direct question). The same day the lead confirmed the EMR
//               checklist under an open red flag (`quotes.checklist`; no data change).
//   2026-10-09  `quotes.both`: the phenotype "both" is a dizziness case. Three minutes later, in one
//               message, `quotes.clarification`: which episodes count as vertigo, and that a rocking or
//               bobbing sensation is not true vertigo; and `quotes.checklistUnreviewed`: the checklist
//               may be shown whether or not the safety screen is done (no data change).
//   2026-10-10  `quotes.amendment`, two messages: a rocking or bobbing sensation is dizziness, not
//               true vertigo, and still counts toward the vestibular score as imbalance; swaying is
//               imbalance too. The lead's answer to the two questions 0.4.5 recorded for the lead:
//               the definition's internal-vertigo line is amended (`amendments`: "swaying, bobbing, "
//               removed, nothing else), and no instrument, probe or lexicon change is wanted.
// Each date is the local calendar date (UTC-7) of the chat message.
// The lead also chose (2026-10-07) that the rule applies to the EMR note and the FHIR referral
// ServiceRequest alike (they stay identical), and that the routing recommendation text of
// masque.logic.js ("Refer neuro-otology / vestibular therapy.") is left unchanged, with the note
// stating the rule right above the recommendations.
//
// HOW IT IS READ (main session, recorded in CHANGELOG.md release 0.4.5):
//   - dizziness cases = the phenotypes "otologic" (its picture: "Dizziness, aural fullness, tinnitus,
//     fluctuating hearing") and "both" (lead, 2026-10-09); their destination specialty is
//     "Neurology". The reasons stay the module's own: "vestibular migraine" for otologic, and for
//     both the "mid-facial / migrainous cause" it had through the default. The sinonasal phenotype
//     and the default keep "Headache medicine / Neurology" and print no rule;
//   - NO automatic escalation. The Scribe probe pr_internal_vertigo asks about a bobbing, rocking or
//     swaying sensation, which the lead's clarification (2026-10-09) and amendment (2026-10-10) say
//     is not true vertigo; the episode duration item asks about a "dizzy or spinning spell" and its
//     band "5 min – 72 h" cannot isolate 30 min – 12 h; a prior ear or brain surgery is captured
//     nowhere. So the referral is "Neurology" in every state in which one prints, and neuro-otology
//     is the clinician's decision through the printed rule: the note prints the lead's rule,
//     definition and clarification with a [ ] placeholder for each condition;
//   - `rule` is the lead's sentence without the reply word "Yes, " that opens it (the extractor
//     checks that this is the only difference); `clarification` is verbatim. `definition` is the
//     lead's definition of 2026-10-07 (`quotes.definition`, kept verbatim as history) with the
//     lead's amendment of 2026-10-10 applied: its internal-vertigo line no longer lists "swaying,
//     bobbing, " (`amendments`; the extractor checks that this removal is the only difference and
//     that every word it removes is named in `quotes.amendment`). The clarification is printed
//     unchanged. `source` reads "clinical lead, 2026-10-07; definition amended 2026-10-10": the
//     engine prints one source after "Referral rule" and after "Definition", so the label names
//     what was amended and the rule line stays accurate (a separate definition source would be an
//     engine change).
//   - A rocking, bobbing or swaying sensation still counts toward the vestibular score as
//     imbalance (the item v_vertigo, "Episodic vertigo or imbalance", through the probe
//     pr_internal_vertigo and the lexicon cues the lead approved): the instrument, probe set and
//     lexicon are unchanged, by the lead's decision of 2026-10-10.
//
// Shape (validator V27; contract.js ClinicianRule):
//   changed       [{path, from, to}]   JSON pointers under /phenotypes/referral; `from` must be the
//                 baseline-extracted value
//   added         [{path, value}]      a new key under /phenotypes/referral, appended to its parent
//   destinations  [{phenotype, reason, from, to}]  every referral destination that differs from the
//                 baseline (proven exact by the extractor and `values`); what AD17 excuses
//   quotes        {key: {date, text}}  the lead's words, verbatim (chat)
//   amendments    [{path, quote, removed}]  a definition line of an added clinician rule that differs
//                 from the lead's `quotes.definition` line at the same index only by one removal of
//                 `removed`, on the decision quoted in `quotes[quote]`, which names every word removed
//   decided       {by, channel, dates}
//   basis         {pointer: what the entry rests on}: one per changed path, one per added
//                 byPhenotype row and one per field of each clinician rule
//   changelog     the rubric's `referral` change-log entry, appended after the 0.4.4 sign-off entry

/** The clinical-lead referral rule for dizziness cases (release 0.4.5), applied to rubric.phenotypes.referral. */
export const REFERRAL_DELTA = {
  release: "0.4.5",
  decided: {
    "by": "clinical lead",
    "channel": "chat",
    "dates": [
      "2026-10-07",
      "2026-10-09",
      "2026-10-10"
    ]
  },
  quotes: {
    "referral": {
      "date": "2026-10-07",
      "text": "Yes, dizziness cases should be referred to neurology, and neuro-otology if there is a true vertiginous component or a history of ear or brain surgeries."
    },
    "definition": {
      "date": "2026-10-07",
      "text": [
        "• Internal Vertigo: A false sensation of self-motion. The person feels like they are spinning clockwise/counter-clockwise, tilting, swaying, bobbing, or being pulled in a specific direction.",
        "• External Vertigo: A false sensation that the surrounding environment is moving, spinning, or whirling around them.",
        "The direction is often predictable (e.g. \"always to the right\")"
      ]
    },
    "checklist": {
      "date": "2026-10-07",
      "text": "Yes, checklist showing even when red flag is open is okay to proceed"
    },
    "both": {
      "date": "2026-10-09",
      "text": "both cases should follow the dizziness rule"
    },
    "clarification": {
      "date": "2026-10-09",
      "text": "Vertigo episodes that last between 30 min and 12 hours should count as vertigo for purposes of ruling out meniere's disease, transient vertigo (true room spinning for a few seconds can count as vertigo which can be consistent with migrainous vertigo). A rocking or bobbing sensation is not true vertigo but a dizziness morphology that can be consistent with migrainous symptoms. Also some people describe \"the floor falling out from underneath them\"."
    },
    "checklistUnreviewed": {
      "date": "2026-10-09",
      "text": "The checklist can be shown regardless if the safety screen is done, the user should be able to see progress and alerted if red flags pop up."
    },
    "amendment": {
      "date": "2026-10-10",
      "text": [
        "classify rocking or bobbing as dizziness and not true vertigo, it counts toward the vestibular score still as it is imbalance",
        "Swaying is imbalance also"
      ]
    }
  },
  amendments: [
    {
      "path": "/phenotypes/referral/clinicianRules/0/definition/0",
      "quote": "amendment",
      "removed": "swaying, bobbing, "
    }
  ],
  changed: [
    {
      "path": "/phenotypes/referral/byPhenotype/otologic/specialty",
      "from": "Neuro-otology",
      "to": "Neurology"
    }
  ],
  added: [
    {
      "path": "/phenotypes/referral/byPhenotype/both",
      "value": {
        "specialty": "Neurology",
        "reason": "mid-facial / migrainous cause"
      }
    },
    {
      "path": "/phenotypes/referral/clinicianRules",
      "value": [
        {
          "phenotypes": [
            "otologic",
            "both"
          ],
          "source": "clinical lead, 2026-10-07; definition amended 2026-10-10",
          "rule": "dizziness cases should be referred to neurology, and neuro-otology if there is a true vertiginous component or a history of ear or brain surgeries.",
          "definition": [
            "• Internal Vertigo: A false sensation of self-motion. The person feels like they are spinning clockwise/counter-clockwise, tilting, or being pulled in a specific direction.",
            "• External Vertigo: A false sensation that the surrounding environment is moving, spinning, or whirling around them.",
            "The direction is often predictable (e.g. \"always to the right\")"
          ],
          "clarificationSource": "clinical lead, 2026-10-09",
          "clarification": [
            "Vertigo episodes that last between 30 min and 12 hours should count as vertigo for purposes of ruling out meniere's disease, transient vertigo (true room spinning for a few seconds can count as vertigo which can be consistent with migrainous vertigo). A rocking or bobbing sensation is not true vertigo but a dizziness morphology that can be consistent with migrainous symptoms. Also some people describe \"the floor falling out from underneath them\"."
          ],
          "confirm": [
            "True vertigo (internal or external)",
            "Prior ear or brain surgery"
          ]
        }
      ]
    }
  ],
  destinations: [
    {
      "phenotype": "otologic",
      "reason": "vestibular migraine",
      "from": "Neuro-otology",
      "to": "Neurology"
    },
    {
      "phenotype": "both",
      "reason": "mid-facial / migrainous cause",
      "from": "Headache medicine / Neurology",
      "to": "Neurology"
    }
  ],
  basis: {
    "/phenotypes/referral/byPhenotype/otologic/specialty": "L: the clinical lead's rule (chat, 2026-10-07), \"dizziness cases should be referred to neurology\"; the otologic phenotype, whose picture is \"Dizziness, aural fullness, tinnitus, fluctuating hearing\", is a dizziness case (main session). Was \"Neuro-otology\" (the baseline bundle); the reason \"vestibular migraine\" is unchanged. No captured answer reliably records true vertigo or a prior ear or brain surgery (lead's clarification, 2026-10-09; main session), so nothing escalates: Neurology is the referral wherever one prints, and neuro-otology is the clinician's decision through the printed rule.",
    "/phenotypes/referral/byPhenotype/both": "L: the clinical lead (chat, 2026-10-09), \"both cases should follow the dizziness rule\": the phenotype both (\"Mixed sinonasal and otologic\") is a dizziness case, referred to Neurology like otologic. Only the specialty changes: the reason \"mid-facial / migrainous cause\" is the one both had through the default, kept as the module's own text (main session). Was the default, \"Headache medicine / Neurology\".",
    "/phenotypes/referral/clinicianRules/0/phenotypes": "L: the rule speaks of dizziness cases (2026-10-07) and both cases follow it (2026-10-09): the otologic phenotype and both. The sinonasal phenotype and the default print no rule (main session).",
    "/phenotypes/referral/clinicianRules/0/source": "S: who stated the rule and the definition, and when (the clinical lead, chat, 2026-10-07), and when the lead amended the definition (chat, 2026-10-10). The engine prints this one source after \"Referral rule\" and after \"Definition\", so it names what was amended: the rule itself is unchanged since 2026-10-07.",
    "/phenotypes/referral/clinicianRules/0/rule": "L verbatim: the lead's sentence (quotes.referral) without the reply word \"Yes, \" that opens it; nothing else changed. The lead's own words, given in chat on 2026-10-07.",
    "/phenotypes/referral/clinicianRules/0/definition": "L, as amended by the lead: the lead's definition of true vertigo (quotes.definition, kept verbatim), line by line, given in chat on 2026-10-07 in answer to a direct question, with the lead's amendment of 2026-10-10 (quotes.amendment: rocking or bobbing is dizziness and not true vertigo, it counts toward the vestibular score as imbalance; swaying is imbalance also). The internal-vertigo line no longer lists \"swaying, bobbing, \" (amendments; that removal is the only difference); the external-vertigo line and the direction line are verbatim. The clarification of 2026-10-09 is printed unchanged after it.",
    "/phenotypes/referral/clinicianRules/0/clarificationSource": "S: who stated the clarification, and when (the clinical lead, chat, 2026-10-09).",
    "/phenotypes/referral/clinicianRules/0/clarification": "L verbatim: the lead's clarification (quotes.clarification), exactly as written, as one line (spelling and punctuation the lead's).",
    "/phenotypes/referral/clinicianRules/0/confirm": "S: one placeholder per condition of the lead's rule that a clinician confirms: true vertigo (internal or external, the lead's two kinds) and a history of ear or brain surgery. The module records neither reliably, so neither is pre-filled and nothing escalates (main session)."
  },
  changelog: {
    "date": "2026-10-10",
    "kind": "referral",
    "note": "Clinical-lead referral rule for dizziness cases, recorded in release 0.4.5 from the clinical lead's decisions in chat of 2026-10-07, 2026-10-09 and 2026-10-10. On 2026-10-07 the lead decided that dizziness cases should be referred to neurology, and to neuro-otology if there is a true vertiginous component or a history of ear or brain surgeries, and defined true vertigo (internal and external); on 2026-10-09 the lead decided that both cases follow the dizziness rule and added a clarification of what counts as true vertigo; on 2026-10-10 the lead amended the definition: a rocking or bobbing sensation is dizziness and not true vertigo, and swaying is imbalance too, so the internal-vertigo line no longer lists swaying and bobbing (the definition as given on 2026-10-07 is kept in tests/harness/referral-delta.js). Such a sensation still counts toward the vestibular score as imbalance, through the item Episodic vertigo or imbalance (the probe pr_internal_vertigo and the approved lexicon cues), so the instrument, probes and lexicon are unchanged. The otologic phenotype now refers to Neurology (was Neuro-otology) and the phenotype both to Neurology (was Headache medicine / Neurology through the default), each with its reason unchanged. No captured answer reliably records true vertigo or a prior ear or brain surgery, so nothing escalates automatically: phenotypes.referral.clinicianRules prints in the EMR note, for both phenotypes, the lead's rule and clarification verbatim and the definition as the lead amended it, with a placeholder for each condition, and neuro-otology is the clinician's decision. The FHIR referral and the EMR note agree. The sinonasal phenotype and the default keep Headache medicine / Neurology; the routing recommendation text in masque.logic.js is unchanged. Recorded in tests/harness/referral-delta.js. Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged; only contentHash changes.",
    "paths": [
      "/phenotypes/referral/byPhenotype/otologic/specialty",
      "/phenotypes/referral/byPhenotype/both",
      "/phenotypes/referral/clinicianRules"
    ]
  },
};
