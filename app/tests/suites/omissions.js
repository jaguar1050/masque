// tests/suites/omissions.js — what the Patient surfaces must never carry (design 03 §8.3
// `omissions`, D15, §4.2 OMISSION_PATTERNS). Owner: WP13; accepts WP6 now and WP9/WP12 later.
//
// Engine half (runs now):
//   graph     the transitive import graph of src/engine/patient.js (sources fetched, specifiers
//             collected; nothing executed) excludes scoring.js, fhir.js, rules.js, cohort.js,
//             probes.js, extraction.js, scribe.js and ResearchReadinessPanel.jsx; the same for
//             src/apps/PatientCompanion.jsx and patient.html's entry once they exist;
//   view      projectForPatient(module) carries no flag text, points or action, no clinician
//             provenance line and no CAVEATS.scoringChanged;
//   exports   summaryText (.txt) and summaryHtml (.html, text content) with all flags on and
//             every item answered, en and es: no flag text/points/action, no OMISSION_PATTERNS
//             match; the patient provenance, edited-wording and stale-translation lines appear
//             where they apply and never a clinician provenance line;
//   modules   MASQUE, the shape fixture (a plain upload), and a verified derivation with
//             changed scoring, an edited English locale and a stale es locale.
// Render half (waits on WP9's PatientCompanion and WP12-M2's patient mode / patient.html):
//   the Safety, domain and Summary sections, the caveat strip and the print header while a
//   Patient view is shown. Until those exist this suite FAILS with a "waits on" note.
import { collector, guarded, loadMasque, need, validationNote } from "../harness/kit.js";
import { bumpFirstWeight, derivedFixture } from "../harness/derivation.js";

const NOW = "2026-10-01T12:00:00.000Z";
const FORBIDDEN_FILES = ["scoring.js", "fhir.js", "rules.js", "cohort.js", "probes.js", "extraction.js", "scribe.js", "ResearchReadinessPanel.jsx"];
const IMPORT_RE = /(?:^|[\s;}])(?:import|export)\s*(?:[\w*{}\s,$]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

/** Transitive relative-import graph from `entry` (an app-relative path). Returns the file URLs. */
async function moduleGraph(h, entry) {
  const seen = new Set();
  const order = [];
  const visit = async (url) => {
    if (seen.has(url)) return;
    seen.add(url);
    order.push(url);
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = (await res.text()).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1] || m[2];
      if (spec && (spec.startsWith("./") || spec.startsWith("../"))) await visit(new URL(spec, url).href);
    }
  };
  await visit(h.appUrl(entry));
  return order;
}

const nameOf = (url) => decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));

function htmlText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const el of doc.querySelectorAll("style, script")) el.remove();
  return doc.body ? doc.body.textContent : "";
}

export default {
  name: "omissions",
  owner: "WP13",
  run: guarded("omissions", async (h) => {
    const { module, validation } = await loadMasque(h);
    const [patient, policy] = await Promise.all([h.engine("patient.js"), h.engine("policy.js")]);
    need(typeof patient.projectForPatient === "function", "waits on WP6: patient.js");
    const c = collector(h);
    c.note(validationNote(validation));
    const waits = [];

    // ------------------------------------------------------------------ module graphs
    const graphs = [["src/engine/patient.js", "WP6"], ["src/apps/PatientCompanion.jsx", "WP9"], ["src/shell/PatientPage.jsx", "WP12-M2"]];
    for (const [entry, owner] of graphs) {
      if (!(await h.fileExists(h.appUrl(entry)))) { waits.push(`${entry} (${owner})`); continue; }
      const files = await moduleGraph(h, entry);
      const bad = files.filter((u) => FORBIDDEN_FILES.includes(nameOf(u)));
      c.check(!bad.length, `/graph/${entry}`, { entry }, `no ${FORBIDDEN_FILES.join(", ")}`, bad.map(nameOf));
      c.note(`graph ${entry}: ${files.length} files (${files.map(nameOf).join(", ")})`);
    }

    // ------------------------------------------------------------------ the three modules
    const subjects = [{ name: "masque", module }];
    try {
      const shape = await h.loadFixture("shape", { builtins: [module], loaded: [module] });
      subjects.push({ name: "shape (uploaded)", module: shape.module });
    } catch (err) {
      c.check(false, "/modules/shape", null, "the shape fixture", String(err.message).split("\n")[0]);
    }
    try {
      const EDIT = " (edited locally for the omissions suite)";
      const d = await derivedFixture(h, module, {
        id: `local-${module.id}-omissions`,
        mutate(r) {
          bumpFirstWeight(r);
          const first = r.domains[0].items[0].id;
          r.locales.en.items[first].q += EDIT;
          r.locales.en.reviewed = false;
          r.locales.en.editedLocally = true;
          r.locales.es.reviewed = false;
          r.locales.es.stale = [`/locales/en/items/${first}/q`];
        },
      });
      c.check(d.classification && d.classification.kind === "verified", "/modules/derived/classification", null, "verified", d.classification && d.classification.kind);
      subjects.push({ name: "derived (scoring, en edited, es stale)", module: d.module, derived: true });
    } catch (err) {
      c.check(false, "/modules/derived", null, "a verified derivation", String(err.message).split("\n")[0]);
    }

    let noticeChecks = 0;
    const clinicianLines = [policy.CAVEATS.uploaded.en, policy.CAVEATS.edited.en, policy.CAVEATS.scoringChanged.en.split("{root}")[0]];
    for (const s of subjects) {
      const m = s.module;
      const at = `/${s.name}`;
      const view = patient.projectForPatient(m);
      const viewText = JSON.stringify(view);
      const flagStrings = (m.redFlags || []).flatMap((f) => [f.text, f.points, f.action]).filter(Boolean);
      for (const str of flagStrings) c.check(!viewText.includes(str), `${at}/view/@flagText`, { text: str }, "absent", "present");
      for (const line of clinicianLines) c.check(!viewText.includes(line), `${at}/view/@clinicianProvenance`, { line }, "absent", "present");
      const a = {};
      for (const d of m.domains) for (const it of d.items) a[it.id] = Array.isArray(it.scale) ? it.scale.length - 1 : "yes";
      const rf = Object.fromEntries((m.redFlags || []).map((f) => [f.id, true]));
      const ctx = {};
      for (const ci of m.contextItems || []) if (ci.signal) ctx[ci.id] = ci.signal.value;
      for (const loc of Object.keys(view.locales || {})) {
        const { summary, error } = patient.buildPatientSummary(view, loc, { a, ctx, flags: rf });
        if (!c.check(!error && !!summary, `${at}/${loc}/summary`, null, "a summary", error)) continue;
        const txt = patient.summaryText(view, loc, summary, { generatedAt: NOW });
        const html = patient.summaryHtml(view, loc, summary, { generatedAt: NOW });
        const htmlBody = htmlText(html);
        for (const [kind, text] of [["txt", txt], ["html", htmlBody]]) {
          for (const str of flagStrings) c.check(!text.includes(str), `${at}/${loc}/${kind}/@flagText`, { text: str }, "absent", "present");
          for (const re of policy.OMISSION_PATTERNS) {
            const hit = re.exec(text);
            c.check(!hit, `${at}/${loc}/${kind}/@pattern`, { pattern: String(re) }, "no match", hit && text.slice(Math.max(0, hit.index - 40), hit.index + 40));
          }
          for (const line of clinicianLines) c.check(!text.includes(line), `${at}/${loc}/${kind}/@clinicianProvenance`, { line }, "absent", "present");
          c.check(text.includes(policy.CAVEATS.prototype), `${at}/${loc}/${kind}/@caveat`, null, policy.CAVEATS.prototype, "absent");
          if (m.origin !== "builtin") {
            const want = m.origin === "derived" ? policy.CAVEATS.patient.edited.en : policy.CAVEATS.patient.uploaded.en;
            c.check(text.includes(want), `${at}/${loc}/${kind}/@patientProvenance`, null, want, "absent");
          }
          const L = (m.locales || {})[loc] && m.locales[loc].data;
          if (L && L.editedLocally) noticeChecks++;
          if (L && Array.isArray(L.stale) && L.stale.length) noticeChecks++;
          if (L && L.editedLocally) c.check(text.includes(policy.CAVEATS.editedWording.en), `${at}/${loc}/${kind}/@editedWording`, null, policy.CAVEATS.editedWording.en, "absent");
          if (L && Array.isArray(L.stale) && L.stale.length) c.check(text.includes(policy.CAVEATS.staleTranslation.en), `${at}/${loc}/${kind}/@stale`, null, policy.CAVEATS.staleTranslation.en, "absent");
        }
        c.check(!/<script|javascript:|https?:\/\//i.test(html), `${at}/${loc}/html/@inert`, null, "no script and no URL", "found");
      }
    }
    c.note(`exports checked: ${subjects.map((s) => s.name).join("; ")}; ${noticeChecks} edited-wording / stale-translation notices checked`);
    if (subjects.some((s) => s.derived)) c.check(noticeChecks >= 4, "/derived/@noticeCoverage", null, ">= 4 (en edited, es stale; .txt and .html)", noticeChecks);

    // The rendered half (§8.3) has no subject until the Patient app, patient mode and
    // patient.html exist, so the suite cannot pass yet; it never passes on the engine half alone.
    const res = c.result();
    const renderWaits = [...waits, "the rendered Patient tab, patient mode and patient.html text (WP9, WP12-M2)"];
    return { ...res, verdict: res.verdict === "pass" ? "fail" : res.verdict,
      notes: [...res.notes, `engine half ${res.verdict.toUpperCase()}; the suite waits on ${renderWaits.join("; ")}`] };
  }),
};
