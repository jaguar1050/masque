/*  Project MASQUE — minimal JSON Schema checker

    A deliberately small subset of draft-07: type, required, properties, items,
    minItems / maxItems, const, enum. That is everything population_estimates.schema.json
    uses, and it is enough to refuse an artifact that is missing its design block or
    carries a string where a number belongs — which is the whole point: the Population
    page renders only what the contract says it may, and the contract is the schema
    file the ETL was written against, not a hand-written list that could drift from it.

    Not a general validator. No $ref, no allOf/anyOf, no patternProperties, no format
    checks. If the schema grows past this subset, grow this file or the check silently
    stops covering the new keyword — so keep the two in step.

    Plain ES module, no React, so app/tests/population-artifact-check.html can import
    it natively without the loader.
*/

function typeName(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function isType(t, v) {
  switch (t) {
    case "object":  return v !== null && typeof v === "object" && !Array.isArray(v);
    case "array":   return Array.isArray(v);
    case "string":  return typeof v === "string";
    case "number":  return typeof v === "number" && Number.isFinite(v);
    case "integer": return Number.isInteger(v);
    case "boolean": return typeof v === "boolean";
    case "null":    return v === null;
    default:        return true;
  }
}

/*  checkSchema(schema, value) -> string[] of human-readable failures ("" path is "$").
    An empty array means the value satisfies the checked subset of the schema.
*/
export function checkSchema(schema, value, path = "$", errors = []) {
  if (!schema || typeof schema !== "object") return errors;

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${schema.enum.map(e => JSON.stringify(e)).join(", ")}`);
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(t => isType(t, value))) {
      errors.push(`${path}: expected ${types.join(" | ")}, got ${typeName(value)}`);
      return errors;   // no point descending into the wrong shape
    }
  }
  if (isType("object", value)) {
    for (const k of schema.required || []) {
      if (!(k in value)) errors.push(`${path}.${k}: required`);
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (k in value) checkSchema(sub, value[k], `${path}.${k}`, errors);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => checkSchema(schema.items, v, `${path}[${i}]`, errors));
  }
  return errors;
}

/*  The one rule the schema cannot express with the subset above: an artifact must
    announce itself. Kept here so the page and the validator agree on the wording.
*/
export function checkArtifactMarker(art) {
  return art && art.masqueArtifact === "population-estimates"
    ? []
    : [`$.masqueArtifact: expected "population-estimates", got ${JSON.stringify(art && art.masqueArtifact)}`];
}
