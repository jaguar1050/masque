// tests/harness/derivation.js — a verified derivation of a built-in, built by hand to the §3.11
// rules, for the suites that need a non-built-in module before WP11's derive.js lands (golden,
// omissions, shape). No imports; nothing happens at import time.
//
// derivedFixture(h, root, {mutate, id, label, version, locale}) clones root.rubric, applies
// `mutate(rubric)`, and records the lineage exactly as §3.11 says deriveRubric does: new id and
// label, the family version rule (`-local` tag when the instrument changed), the settled CDS
// example removed when the scoring changed, `logicBinding` pinned to the root's logic SHA-256,
// a `derived` changelog entry, and `provenance = {root, derivedFrom, lineage, contentHash,
// createdAt}`. It then classifies it with classifyLineage (expected row 3, "verified"), binds it
// with the root's logic and validates it against the root. The result is
// {module, validation, classification, rubric}.

const CREATED_AT = "2026-10-01T12:00:00.000Z";

export async function derivedFixture(h, root, {
  mutate = () => {},
  id = null,
  label = null,
  version = null,
  note = "harness fixture: a verified derivation built to the design §3.11 rules",
} = {}) {
  const [bind, hash, lineage, validate] = await Promise.all([h.engine("bind.js"), h.engine("hash.js"), h.engine("lineage.js"), h.engine("validate.js")]);
  const rubric = JSON.parse(JSON.stringify(root.rubric));
  mutate(rubric);
  const before = await hash.rubricHashes(root.rubric);
  let mid = await hash.rubricHashes(rubric);
  rubric.id = id || `local-${root.id}-harness`;
  rubric.label = label || `${root.label} — edited ${CREATED_AT.slice(0, 10)}`;
  const instrumentChanged = mid.instrumentHash !== before.instrumentHash;
  const scoringChanged = mid.scoringHash !== before.scoringHash;
  rubric.instrumentVersion = version || (instrumentChanged ? `${root.instrumentVersion}-local.${mid.instrumentHash.slice(0, 6)}` : root.instrumentVersion);
  if (scoringChanged && rubric.cds && rubric.cds.examples) delete rubric.cds.examples.settled;
  rubric.logicBinding = root.rubric.logicBinding === "generic" ? "generic" : { moduleId: root.logic.moduleId, logicSha256: root.hashes.logicSha256 };
  rubric.changelog = [...(rubric.changelog || []), {
    date: CREATED_AT.slice(0, 10), kind: "derived", note, paths: ["/domains"],
    axes: instrumentChanged ? { instrument: [root.instrumentVersion, rubric.instrumentVersion] } : {},
  }];
  delete rubric.provenance;
  mid = await hash.rubricHashes(rubric);
  const rec = lineage.ancestorRecord(root);
  rubric.provenance = { root: rec, derivedFrom: rec, lineage: [rec], contentHash: mid.contentHash, createdAt: CREATED_AT };

  const logicSha256 = root.hashes.logicSha256 || null;
  const classification = await lineage.classifyLineage(rubric, { builtins: [root], loaded: [root], sameUpload: [], logicSha256 });
  const rubricText = bind.serializeRubric(rubric);
  const module = await bind.bindModule(rubric, root.rubric.logicBinding === "generic" ? null : root.logic, {
    origin: classification.origin,
    classification,
    key: `fixture:${rubric.id}`,
    sources: { rubricText, logicText: root.sources ? root.sources.logicText : null },
    loadedAt: CREATED_AT,
  });
  const validation = await validate.validateModule({ module, loaded: [root], root });
  return { module, validation, classification, rubric };
}

/** The standard mutation: one weight up by one, with its domain max (scoring changes, V15 holds). */
export function bumpFirstWeight(rubric) {
  const d = rubric.domains.find((x) => !x.negative);
  d.items[0].w += 1;
  d.max += 1;
}
