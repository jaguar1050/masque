// The validator mutation corpus (design 03 §4.14, §8.3 `validate`). Owner: WP3.
//
// Every validator code V1-V60 has at least one generator. A generator mutates the base module
// (base.rubric.json + base.logic.js, placeholder text only, which validates with zero errors)
// and states the code, severity and JSON pointer the validator must report for it. The
// `validate` suite (tests/suites/validate.js) runs them; nothing happens at import time.
//
// The suite hands each `build(ctx)` this context:
//   ctx.rubric()          a fresh, mutable copy of the base rubric
//   ctx.logic()           a fresh, mutable copy of the base logic (closures shared, data copied)
//   ctx.root              the base bound as a built-in module (the root of the derivation cases)
//   ctx.bind(rubric, logic, {origin, classification, key})  → Promise<Module>
//   ctx.derive(rubric, {parent, instrumentVersion, lexiconVersion, keepSettled, keepReviewed})
//                          → Promise<rubric> with the §3.11 derived-module rules applied
//   ctx.inspect(path)     → Promise<inspectSource result | null> for a fixture text file
//   ctx.LIMITS            engine/policy.js LIMITS
// and it returns {rubric, logic?, logicSha256?, origin?, classification?, loaded?, root?, upload?, via?}.
// `via: "shape"` asks the suite to run validateRubricShape (the editor's synchronous path)
// as well as validateModule; either may report the finding.
import shape from "./shape.js";
import instrument from "./instrument.js";
import safety from "./safety.js";
import locales from "./locales.js";
import logic from "./logic.js";
import provenance from "./provenance.js";

/** Every validator code. */
export const CODES = Array.from({ length: 60 }, (_, i) => `V${i + 1}`);

/** Every generator, in code order. */
export const MUTATIONS = [...shape, ...instrument, ...safety, ...locales, ...logic, ...provenance];
