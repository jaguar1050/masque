// shell/PatientPage.jsx — the at-home patient page, patient.html (design 03 §5.11, D26).
// Owner: WP12. Default export; receives {env} from the page through boot (D25).
//
// A patient fills in the companion at home and prints or downloads the summary to bring to
// the visit or send ahead. The page offers nothing else: a slim header with the module name
// and the Patient title, the caveat strip, the Patient Companion inside the print frame and
// the patient footer. No tabs, no module menu, no upload, no editor, no research, no
// microphone, no link to the clinician program, and nothing is stored.
//
// The module is the default built-in, or ?module=<built-in id> when that names one; any other
// value shows "This questionnaire is not available." and never falls back to another module.
// It loads through registry.loadBuiltins, the same verified path as the shell.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { APP_VERSION, CAVEATS } from "../engine/policy.js";
import { PATIENT_CHROME, projectForPatient } from "../engine/patient.js";
import PatientCompanion, { patientPrintHeader } from "../apps/PatientCompanion.jsx";
import { loadBuiltins } from "./registry.js";
import { CaveatStrip, PatientFooter, PrintFrame } from "./chrome.jsx";
import { SHELL_CSS } from "./shell.css.js";

export const NOT_AVAILABLE = "This questionnaire is not available.";
export const LOAD_FAILED = "The questionnaire could not be loaded. Please try again later.";

function requestedId() {
  try { return new URLSearchParams(location.search).get("module"); } catch (_) { return null; }
}

export default function PatientPage({ env }) {
  const [state, setState] = useState({ status: "loading" });
  const [printCtx, setPrintCtx] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const entries = await loadBuiltins({ env });
        const want = requestedId();
        const builtins = entries.filter((e) => e.origin === "builtin");
        const entry = want
          ? builtins.find((e) => (e.module ? e.module.id : null) === want) || null
          : builtins.find((e) => e.isDefault) || builtins[0] || null;
        if (!entry) { if (live) setState({ status: "missing" }); return; }
        if (!entry.module || !entry.validation || !entry.validation.ok) {
          const detail = entry.validation ? entry.validation.errors.map((x) => `${x.code} · ${x.path || "/"} · ${x.msg}`) : [];
          if (live) setState({ status: "failed", detail });
          return;
        }
        if (live) setState({ status: "ready", module: entry.module });
      } catch (err) {
        if (live) setState({ status: "failed", detail: [String(err && err.message ? err.message : err)] });
      }
    })();
    return () => { live = false; };
  }, [env]);

  const view = useMemo(() => (state.status === "ready" ? projectForPatient(state.module) : null), [state]);
  const onPrintContext = useCallback((pc) => setPrintCtx(pc || null), []);
  const loc = printCtx && printCtx.loc ? printCtx.loc : "en";
  const title = (PATIENT_CHROME[loc] && PATIENT_CHROME[loc].title) || PATIENT_CHROME.en.title;

  useEffect(() => {
    document.title = view ? `${view.name} · ${PATIENT_CHROME.en.title}` : PATIENT_CHROME.en.title;
  }, [view]);

  let content;
  if (state.status === "loading") content = <p className="sa-patient-msg" role="status">…</p>;
  else if (state.status === "missing") content = <p className="sa-patient-msg" role="alert" data-testid="patient-page-missing">{NOT_AVAILABLE}</p>;
  else if (state.status === "failed") {
    content = (
      <div className="sa-patient-msg" role="alert" data-testid="patient-page-failed">
        <p>{LOAD_FAILED}</p>
        {state.detail && state.detail.length ? <details><summary>Technical detail</summary><ul>{state.detail.map((d, i) => <li key={i}>{d}</li>)}</ul></details> : null}
      </div>
    );
  } else {
    content = (
      <main className="sa-main sa-patient-page-main" data-module={view.id}>
        <div role="region" aria-label={title} className="sa-panel sa-panel-patient" data-panel="patient">
          <PatientCompanion view={view} appVersion={APP_VERSION} onPrintContext={onPrintContext} />
        </div>
      </main>
    );
  }

  return (
    <div className="sa-shell sa-patient-page" data-mode="patient" data-page="patient">
      <style>{SHELL_CSS}</style>
      <header className="sa-top">
        <div className="sa-top-in">
          <div className="sa-brand" data-testid="patient-page-header">
            <span className="sa-mark" aria-hidden="true"><HeartHandshake size={16} /></span>
            <span>{view ? `${view.name} · ` : ""}{title}</span>
          </div>
        </div>
        <CaveatStrip lines={view ? view.provenanceLines : []} />
      </header>
      <PrintFrame header={view ? patientPrintHeader(view, printCtx) : CAVEATS.prototype}>
        {content}
      </PrintFrame>
      <PatientFooter view={view} appVersion={APP_VERSION} />
    </div>
  );
}
