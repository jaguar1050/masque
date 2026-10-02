// Loader check fixture: statically imports every engine file and ui/common.jsx, so compiling
// this one module proves the whole set resolves and compiles through the loader.
import * as contract from "../../src/engine/contract.js";
import * as vocab from "../../src/engine/vocab.js";
import * as policy from "../../src/engine/policy.js";
import * as hash from "../../src/engine/hash.js";
import * as css from "../../src/engine/css.js";
import * as download from "../../src/engine/download.js";
import * as prng from "../../src/engine/prng.js";
import * as scoring from "../../src/engine/scoring.js";
import * as evaluate from "../../src/engine/evaluate.js";
import * as rules from "../../src/engine/rules.js";
import * as gates from "../../src/engine/gates.js";
import * as bind from "../../src/engine/bind.js";
import * as lineage from "../../src/engine/lineage.js";
import * as generic from "../../src/engine/generic.js";
import * as validate from "../../src/engine/validate.js";
import * as fhir from "../../src/engine/fhir.js";
import * as cohort from "../../src/engine/cohort.js";
import * as extraction from "../../src/engine/extraction.js";
import * as probes from "../../src/engine/probes.js";
import * as scribe from "../../src/engine/scribe.js";
import * as patient from "../../src/engine/patient.js";
import * as derive from "../../src/engine/derive.js";
import * as zip from "../../src/engine/zip.js";
import * as exportAll from "../../src/engine/exportAll.js";
import * as common from "../../src/ui/common.jsx";

export const modules = {
  contract, vocab, policy, hash, css, download, prng, scoring, evaluate, rules, gates, bind, lineage,
  generic, validate, fhir, cohort, extraction, probes, scribe, patient, derive, zip, exportAll,
};
export { common };
