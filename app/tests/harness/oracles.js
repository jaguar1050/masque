// tests/harness/oracles.js — the frozen baseline (primary oracle) and reference/fixed-src
// (secondary oracle), imported without editing them (design 03 §8.1, §8.2).
//
// Each oracle is compiled by the page's loader with an `export { … };` list appended, so
// module-private constants and functions become reachable. The baseline manifest (itself
// pinned by MANIFEST_SHA256) is verified before the first baseline import, and a reference file's pinned SHA-256 before
// its import; a mismatch throws an error with `invalid = true`, which makes the calling
// suite INVALID instead of a false PASS. Nothing happens at import time.
import { FIXED_SRC_SHA256, MANIFEST_SHA256 } from "./divergences.js";

/** Appended export lists (§8.2). Files absent here are imported without an append. */
export const ORACLE_EXPORTS = {
  "MASQUE_Screener_v0_3.jsx": [
    "ITEMS", "DOMAIN_ORDER", "ALL_ITEM_IDS", "RED_FLAGS", "RF_GROUPS", "STEPS", "SAMPLE_CASES", "DEMO_PATIENT",
    "BAND_CUTS", "QUESTIONNAIRE_URL", "ANSWER_SYSTEM", "WEIGHT_EXT", "INSTRUMENT_VERSION", "APP_VERSION", "SITE_SALT",
    "scoreItem", "bandFor", "itemBounds", "useScore", "buildQuestionnaire", "buildCdsHooks", "buildDataDictionary",
    "screenToCohortRow", "rowsToCsv", "subjectPseudonym", "buildBundle",
  ],
  "MASQUE_Scribe_v0_3.jsx": [
    "ITEMS", "DOMAIN_ORDER", "ALL_ITEMS", "ITEM_BY_ID", "RED_FLAGS", "ASK", "VMPATHI_TAG", "VMPATHI_INFO", "BAND_CUTS",
    "SCRIPT", "PATIENT", "REQUIRE_SAFETY_REVIEW_TO_SIGN", "computeScore", "buildQuestionnaire", "buildCdsHooks",
    "buildDataDictionary", "screenToCohortRow", "buildRecs", "buildNote", "buildBundle", "capLabel", "shortLabel",
  ],
  "MASQUE_Patient_v0_3.jsx": [
    "ITEMS", "DOMAIN_ORDER", "P", "ES_P", "ES_RF", "RED_FLAGS", "TIER", "UI", "SUM", "CONTEXT_Q", "SECTIONS", "BLURB",
    "BLURB_ES", "REVIEWED", "LOCALE_NAMES", "buildSummary", "askForm", "list", "summaryText", "pFor", "rfFor",
  ],
  "MASQUE_Simulator.jsx": ["makeCohort", "COHORTS", "SCENARIOS", "FULL_HIGH"],
  "ResearchReadinessPanel.jsx": [
    "PROJECTS", "FAIRNESS_POLICY", "normalizeRows", "metrics", "calibration", "repeatMeasures", "population",
    "fairness", "equityAdjustment", "internalConsistency", "dataQuality", "fingerprint",
  ],
};

/** The eleven baseline files (§2.9). */
export const BASELINE_FILES = [
  "MASQUE_Screener_v0_3.jsx", "MASQUE_Scribe_v0_3.jsx", "MASQUE_Patient_v0_3.jsx", "MASQUE_Simulator.jsx",
  "MASQUE_Extraction.js", "MASQUE_Probes.js", "ResearchReadinessPanel.jsx", "MASQUE_Voice.js",
  "MASQUE_Population.jsx", "PopulationArtifact.jsx", "MASQUE_SchemaCheck.js",
];

export function appendFor(file) {
  const names = ORACLE_EXPORTS[file];
  return names && names.length ? `export { ${names.join(", ")} };` : "";
}

export function invalidError(message) {
  const e = new Error(message);
  e.invalid = true;
  return e;
}

export async function sha256HexOf(data) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}

async function fetchBytes(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Parse sha256sum output: "<hex>  <path>" per line. */
export function parseManifest(text) {
  const entries = [];
  for (const line of String(text).split("\n")) {
    if (!line.trim()) continue;
    const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    if (!m) throw invalidError(`MANIFEST.sha256: unreadable line "${line}"`);
    entries.push({ sha256: m[1], path: m[2] });
  }
  return entries;
}

/**
 * @param {{loader: {importModule: Function}, appBase: string}} env
 */
export function createOracles(env) {
  const baselineBase = new URL("tests/baseline/", env.appBase).href;
  const referenceBase = new URL("../reference/fixed-src/", env.appBase).href;
  let manifestCheck = null;
  const referenceChecks = new Map();
  const textCache = new Map();

  /** Verify every manifest entry against the bytes served. Resolves to a report; never throws. */
  function verifyManifest() {
    if (!manifestCheck) {
      manifestCheck = (async () => {
        const report = { ok: true, checked: 0, mismatches: [], missing: [], unlisted: [] };
        let entries;
        try {
          const bytes = await fetchBytes(baselineBase + "MANIFEST.sha256");
          const got = await sha256HexOf(bytes);
          if (got !== MANIFEST_SHA256) {
            return { ...report, ok: false, error: `MANIFEST.sha256 itself: sha256 ${got} ≠ pin ${MANIFEST_SHA256} (harness/divergences.js)` };
          }
          entries = parseManifest(new TextDecoder().decode(bytes));
        } catch (err) {
          return { ...report, ok: false, error: `cannot read MANIFEST.sha256: ${err.message}` };
        }
        const listed = new Set(entries.map((e) => e.path));
        for (const f of BASELINE_FILES) if (!listed.has(`src/${f}`)) report.unlisted.push(`src/${f}`);
        for (const e of entries) {
          try {
            const got = await sha256HexOf(await fetchBytes(baselineBase + e.path));
            report.checked += 1;
            if (got !== e.sha256) report.mismatches.push({ path: e.path, expected: e.sha256, got });
          } catch (err) {
            report.missing.push({ path: e.path, error: err.message });
          }
        }
        report.ok = !report.mismatches.length && !report.missing.length && !report.unlisted.length;
        return report;
      })();
    }
    return manifestCheck;
  }

  async function requireManifest() {
    const r = await verifyManifest();
    if (!r.ok) {
      const what = r.error || [
        ...r.mismatches.map((m) => `${m.path} sha256 ${m.got.slice(0, 12)}… ≠ manifest ${m.expected.slice(0, 12)}…`),
        ...r.missing.map((m) => `${m.path}: ${m.error}`),
        ...r.unlisted.map((p) => `${p} is not in the manifest`),
      ].join("; ");
      throw invalidError(`baseline manifest does not verify: ${what}`);
    }
  }

  /** Verify a reference/fixed-src file against its pin. Resolves to {ok, expected, got}. */
  function verifyReference(file) {
    if (!referenceChecks.has(file)) {
      referenceChecks.set(file, (async () => {
        const expected = FIXED_SRC_SHA256[file];
        if (!expected) return { ok: false, expected: null, got: null, error: `${file} has no pinned SHA-256` };
        try {
          const got = await sha256HexOf(await fetchBytes(referenceBase + file));
          return { ok: got === expected, expected, got };
        } catch (err) {
          return { ok: false, expected, got: null, error: err.message };
        }
      })());
    }
    return referenceChecks.get(file);
  }

  async function requireReference(file) {
    const r = await verifyReference(file);
    if (!r.ok) {
      throw invalidError(`reference/fixed-src/${file} does not match its pin: ${r.error || `${String(r.got).slice(0, 12)}… ≠ ${r.expected.slice(0, 12)}…`}`);
    }
  }

  /** tests/baseline/src/<file>, compiled with its §8.2 export list appended. */
  async function oracle(file, { append } = {}) {
    if (!BASELINE_FILES.includes(file)) throw new Error(`not a baseline file: ${file}`);
    await requireManifest();
    return env.loader.importModule(new URL(`src/${file}`, baselineBase).href, { append: append ?? appendFor(file) });
  }

  /** reference/fixed-src/<file>, same mechanism, verified against divergences.js. */
  async function reference(file, { append } = {}) {
    await requireReference(file);
    return env.loader.importModule(new URL(file, referenceBase).href, { append: append ?? appendFor(file) });
  }

  /** The raw text of a baseline file (manifest-verified), for slices and the divergence audit. */
  async function baselineText(file) {
    await requireManifest();
    const key = `b:${file}`;
    if (!textCache.has(key)) textCache.set(key, fetchBytes(new URL(`src/${file}`, baselineBase).href).then((b) => new TextDecoder().decode(b)));
    return textCache.get(key);
  }

  /** The raw text of a reference/fixed-src file (pin-verified). */
  async function referenceText(file) {
    await requireReference(file);
    const key = `r:${file}`;
    if (!textCache.has(key)) textCache.set(key, fetchBytes(new URL(file, referenceBase).href).then((b) => new TextDecoder().decode(b)));
    return textCache.get(key);
  }

  return { oracle, reference, baselineText, referenceText, verifyManifest, verifyReference, baselineBase, referenceBase };
}
