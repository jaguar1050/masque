// shell/shell.css.js — shell tokens, chrome, tab bar and print stylesheet (design 03 §5.10).
// Owner: WP12. Every rule is rooted at .sa-shell (or is the @page / print block), and the
// shell's classes use the `sa-` prefix. The token set is the Screener's (Scr L630-638),
// carried on .sa-shell rather than :root so the shell owns no global custom property.
// Plain data; no imports, no side effects.

export const SHELL_CSS = `
.sa-shell{
  --ink:#0C2B2F; --petrol:#0F5C61; --petrol2:#137A80; --surface:#EDF3F1;
  --panel:#FFFFFF; --line:#D7E1DF; --muted:#5C6E6C;
  --amber:#B26C1F; --amberbg:#F6ECD9; --coral:#B84A33; --coralbg:#F6E1DA;
  --green:#2C7A57; --greenbg:#E0EEE7; --slate:#4F6466;
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color-scheme:light;
  font-family:var(--sans);color:var(--ink);background:var(--surface);
  min-height:100vh;line-height:1.45;-webkit-font-smoothing:antialiased;
}
.sa-shell *,.sa-shell *::before,.sa-shell *::after{box-sizing:border-box}

/* header: wordmark + module picker, first control on the page */
.sa-shell .sa-top{position:sticky;top:0;z-index:30;background:var(--ink);color:#EAF3F1;
  border-bottom:1px solid rgba(255,255,255,.08)}
.sa-shell .sa-top-in{max-width:1080px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;
  gap:10px 16px;flex-wrap:wrap}
.sa-shell .sa-brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:17px;letter-spacing:-.01em;
  white-space:nowrap}
.sa-shell .sa-mark{width:28px;height:28px;border-radius:8px;background:var(--petrol2);color:#EAF3F1;
  display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
.sa-shell .sa-brand .sa-ai{color:#9FE0D8}
.sa-shell .sa-controls{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap;flex:1 1 280px;min-width:0}
.sa-shell .sa-controls label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9FC1BE;font-weight:600}
.sa-shell .sa-select{font:inherit;font-size:14px;color:var(--ink);background:#fff;border:1px solid var(--line);
  border-radius:9px;padding:6px 28px 6px 10px;max-width:100%;min-width:0;flex:0 1 auto}
.sa-shell .sa-select:focus-visible{outline:2px solid #9FE0D8;outline-offset:2px}
.sa-shell .sa-note{font-size:12px;color:#9FC1BE}

/* caveat strip */
.sa-shell .sa-caveat{background:var(--coralbg);color:#7A2E1F;border-bottom:1px solid #EBC3B6;font-size:12.5px}
.sa-shell .sa-caveat-in{max-width:1080px;margin:0 auto;padding:6px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sa-shell .sa-caveat b{font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:11.5px}
.sa-shell .sa-caveat .sa-caveat-line{display:block}
.sa-shell .sa-caveat .sa-caveat-error{color:#fff;background:var(--coral);border-radius:6px;padding:2px 8px}

/* tab bar: scrolls inside itself on narrow screens, never the page */
.sa-shell .sa-tabs{background:var(--panel);border-bottom:1px solid var(--line)}
.sa-shell .sa-tabs-in{max-width:1080px;margin:0 auto;padding:0 8px;display:flex;gap:2px;overflow-x:auto;
  scrollbar-width:thin;-webkit-overflow-scrolling:touch}
.sa-shell .sa-tab{font:inherit;font-size:13.5px;font-weight:600;color:var(--muted);background:transparent;border:0;
  border-bottom:3px solid transparent;padding:11px 12px 9px;cursor:pointer;white-space:nowrap;display:inline-flex;
  align-items:center;gap:7px;flex:0 0 auto}
.sa-shell .sa-tab:hover{color:var(--ink)}
.sa-shell .sa-tab[aria-selected="true"]{color:var(--petrol);border-bottom-color:var(--petrol)}
.sa-shell .sa-tab:focus-visible{outline:2px solid var(--petrol2);outline-offset:-2px;border-radius:6px}

/* print frame: on screen the table is plain blocks and the header is hidden */
.sa-shell .sa-print-frame,.sa-shell .sa-print-frame > tbody,.sa-shell .sa-print-frame > tbody > tr,
.sa-shell .sa-print-frame > tbody > tr > td{display:block;width:100%;margin:0;padding:0;border:0}
.sa-shell .sa-print-frame{border-collapse:collapse}
.sa-shell .sa-print-frame > thead{display:none}
/* a panel never widens the page (§5.10, 375 px). overflow-x:clip, not auto: clip makes no
   scroll container, so position:sticky inside a panel (the Rubric Editor's section nav and side
   panel) sticks while the page scrolls. Wide content scrolls in its own wrapper (.sa-table-wrap,
   the editor's .re-scroll, the population tables). */
.sa-shell .sa-panel{min-width:0;max-width:100%;overflow-x:clip}
/* the Rubric Editor: the centred column and side gutter of the other tabs */
.sa-shell .sa-panel-editor .sa-editor{max-width:1080px;margin:0 auto;padding:16px 16px 64px}

/* placeholder panel (loading, editor unavailable) */
.sa-shell .sa-placeholder{max-width:720px;margin:28px auto;padding:0 16px}
.sa-shell .sa-placeholder-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px 20px;
  display:flex;gap:14px;align-items:flex-start}
.sa-shell .sa-placeholder-card h2{margin:0 0 4px;font-size:17px;font-weight:650}
.sa-shell .sa-placeholder-card p{margin:0;color:var(--muted);font-size:14px}

/* buttons and small controls */
.sa-shell .sa-btn{font:inherit;font-size:13px;font-weight:600;color:var(--ink);background:#fff;border:1px solid var(--line);
  border-radius:9px;padding:6px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;line-height:1.3}
.sa-shell .sa-btn:hover:not(:disabled){border-color:var(--petrol2)}
.sa-shell .sa-btn:disabled{opacity:.5;cursor:not-allowed}
.sa-shell .sa-btn:focus-visible,.sa-shell .sa-icon-btn:focus-visible,.sa-shell .sa-link:focus-visible{outline:2px solid var(--petrol2);outline-offset:2px}
.sa-shell .sa-btn-primary{background:var(--petrol);border-color:var(--petrol);color:#fff}
.sa-shell .sa-btn-primary:hover:not(:disabled){background:var(--petrol2)}
.sa-shell .sa-btn-danger{color:var(--coral);border-color:#EBC3B6}
.sa-shell .sa-btn-small{font-size:12px;padding:3px 9px;border-radius:7px}
.sa-shell .sa-icon-btn{font:inherit;background:transparent;border:1px solid transparent;border-radius:8px;color:inherit;
  padding:4px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.sa-shell .sa-icon-btn:hover:not(:disabled){border-color:var(--line)}
.sa-shell .sa-top .sa-icon-btn{color:#EAF3F1}
.sa-shell .sa-top .sa-icon-btn:hover:not(:disabled){border-color:rgba(255,255,255,.3)}
.sa-shell .sa-link{font:inherit;background:none;border:0;padding:0;color:var(--petrol);text-decoration:underline;cursor:pointer;
  display:inline-flex;align-items:center;gap:4px}
.sa-shell .sa-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.sa-shell .sa-chip{font-size:11px;font-weight:600;border:1px solid var(--line);border-radius:999px;padding:1px 8px;color:var(--muted)}
.sa-shell .sa-err{color:var(--coral)}
.sa-shell .sa-hint{display:block;font-size:12px;color:var(--muted);font-weight:400}
.sa-shell .sa-check{display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer}
.sa-shell .sa-check input{margin-top:2px;flex:0 0 auto}
.sa-shell code{font-family:var(--mono);font-size:.92em;overflow-wrap:anywhere}
.sa-shell .sa-patient-title{font-size:14px;color:#BFE0DC;font-weight:600}

/* tab bar row with the microphone indicator at its right */
.sa-shell .sa-tabs-row{max-width:1080px;margin:0 auto;display:flex;align-items:center;gap:8px;min-width:0}
.sa-shell .sa-tabs-row .sa-tabs-in{flex:1 1 auto;min-width:0;max-width:none;margin:0}
.sa-shell .sa-mic{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--coral);
  background:var(--coralbg);border:1px solid #EBC3B6;border-radius:999px;padding:3px 4px 3px 10px;margin-right:8px;max-width:60%}
.sa-shell .sa-mic-dot{animation:sa-pulse 1.4s ease-in-out infinite}
.sa-shell .sa-mic-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.sa-shell .sa-mic-stop{font:inherit;font-size:11.5px;font-weight:700;color:#fff;background:var(--coral);border:0;border-radius:999px;
  padding:3px 10px;cursor:pointer}
@keyframes sa-pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* restore banner and unsaved-module notice */
.sa-shell .sa-banner{max-width:1080px;margin:10px auto 0;padding:8px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;
  font-size:13px;border-radius:10px;width:calc(100% - 32px)}
.sa-shell .sa-restore{background:#E7F0EF;border:1px solid #C6DAD7;color:#123E42}
.sa-shell .sa-unsaved{background:var(--amberbg);border:1px solid #E7D3AE;color:#6B4512}
.sa-shell .sa-banner > span{flex:1 1 240px;min-width:0}

/* main area */
.sa-shell .sa-main{display:block;min-width:0}

/* the Patient panel's bar (clinician mode) and patient mode */
.sa-shell .sa-patient-bar{max-width:1080px;margin:12px auto 0;padding:8px 16px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;
  font-size:13px;color:var(--slate)}
.sa-shell .sa-patient-link{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;min-width:0}
.sa-shell .sa-patient-link a{color:var(--petrol)}
.sa-shell .sa-return{max-width:1080px;margin:0 auto;padding:0 16px 64px;display:flex;justify-content:center}
.sa-shell .sa-patient-footer p{white-space:normal}
.sa-shell .sa-patient-msg{max-width:720px;margin:32px auto;padding:0 16px;font-size:15px}

/* invalid module */
.sa-shell .sa-invalid{max-width:820px;margin:28px auto;padding:0 16px}
.sa-shell .sa-invalid-card{background:var(--panel);border:1px solid #EBC3B6;border-radius:14px;padding:18px 20px}
.sa-shell .sa-invalid-card h2{margin:0 0 6px;font-size:17px;display:flex;gap:8px;align-items:center;color:var(--coral)}
.sa-shell .sa-report{margin:8px 0;padding-left:18px;font-size:12.5px;overflow-wrap:anywhere}
.sa-shell .sa-report li{margin:2px 0}

/* dialogs: modal, drawer, confirm */
.sa-shell .sa-backdrop{position:fixed;inset:0;z-index:60;background:rgba(12,43,47,.45);display:flex;align-items:flex-start;
  justify-content:center;padding:24px 12px;overflow-y:auto}
.sa-shell .sa-modal{background:var(--panel);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25);width:100%;max-width:760px;
  padding:16px 18px;min-width:0}
.sa-shell .sa-modal h2,.sa-shell .sa-drawer h2{margin:0;font-size:17px;display:flex;gap:8px;align-items:center}
.sa-shell .sa-confirm{max-width:520px;margin-top:10vh}
.sa-shell .sa-confirm h2{margin-bottom:8px}
.sa-shell .sa-confirm-lines{margin:8px 0;padding-left:20px;font-size:14px}
.sa-shell .sa-confirm-note{margin:6px 0;font-size:13px;color:var(--slate)}
.sa-shell .sa-confirm-body{font-size:14px;margin:6px 0}
.sa-shell .sa-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:14px}
.sa-shell .sa-actions-left{justify-content:flex-start;margin-top:6px}
.sa-shell .sa-drawer{background:var(--panel);width:100%;max-width:560px;margin-left:auto;border-radius:14px;padding:14px 18px 22px;
  box-shadow:0 18px 50px rgba(0,0,0,.25);min-width:0}
.sa-shell .sa-drawer-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
.sa-shell .sa-info-sec{border-top:1px solid var(--line);padding:10px 0 4px}
.sa-shell .sa-info-sec h3{margin:0 0 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.sa-shell .sa-info-sec p{margin:4px 0;font-size:13px}
.sa-shell .sa-kv{display:grid;grid-template-columns:120px minmax(0,1fr);gap:8px;font-size:13px;margin:2px 0}
.sa-shell .sa-k{color:var(--muted)}
.sa-shell .sa-v{min-width:0;overflow-wrap:anywhere}
.sa-shell .sa-hash{font-size:11px}
.sa-shell .sa-info-list{margin:4px 0;padding-left:18px;font-size:12.5px}
.sa-shell .sa-info-note{color:#6B4512}
.sa-shell .sa-axes-list{list-style:none;margin:4px 0;padding:0;font-family:var(--mono);font-size:12px}
.sa-shell .sa-about-notice{background:var(--coralbg);border-radius:8px;padding:6px 10px}
.sa-shell .sa-about-small{color:var(--muted);font-size:12px}
.sa-shell .sa-avail{font-size:12.5px;color:var(--slate);margin:6px 0}

/* toast */
.sa-shell .sa-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:70;background:var(--ink);color:#EAF3F1;
  border-radius:10px;padding:8px 8px 8px 14px;font-size:13px;display:flex;gap:8px;align-items:center;max-width:calc(100vw - 24px);
  box-shadow:0 8px 24px rgba(0,0,0,.25)}
.sa-shell .sa-toast-x{background:none;border:0;color:inherit;cursor:pointer;padding:2px;display:inline-flex}

/* upload dialog */
.sa-shell .sa-upload{max-width:860px}
.sa-shell .sa-drop{border:2px dashed var(--line);border-radius:12px;padding:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;
  justify-content:center;font-size:13px;color:var(--muted);margin:8px 0}
.sa-shell .sa-drop.on{border-color:var(--petrol2);background:#F1F7F6}
.sa-shell .sa-file{position:relative;display:inline-flex;cursor:pointer}
.sa-shell .sa-file input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}
.sa-shell .sa-file:focus-within .sa-btn{outline:2px solid var(--petrol2);outline-offset:2px}
.sa-shell .sa-guide p{margin:4px 0;font-size:12.5px;color:var(--slate)}
.sa-shell .sa-busy{font-size:13px;color:var(--muted)}
.sa-shell .sa-table-wrap{overflow-x:auto;margin:10px 0;border:1px solid var(--line);border-radius:10px}
.sa-shell .sa-table{border-collapse:collapse;width:100%;font-size:12.5px}
.sa-shell .sa-table th,.sa-shell .sa-table td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.sa-shell .sa-table th{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);background:#F6F9F8}
.sa-shell .sa-table tr.bad td{background:#FBF1EE}
.sa-shell .sa-fname{overflow-wrap:anywhere;min-width:140px}
.sa-shell .sa-hashcell{display:inline-flex;gap:4px;align-items:center}
.sa-shell .sa-copied{font-size:11px;color:var(--green)}
.sa-shell .sa-consent{background:var(--coralbg);border:1px solid #EBC3B6;color:#7A2E1F;border-radius:10px;padding:10px 12px;margin:10px 0;
  font-size:13px}
.sa-shell .sa-consent ul{margin:6px 0;padding-left:18px;overflow-wrap:anywhere}
.sa-shell .sa-results{display:flex;flex-direction:column;gap:8px;margin:10px 0}
.sa-shell .sa-result{border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:13px;min-width:0}
.sa-shell .sa-result.ok{border-color:#B9D8C8;background:#F3FAF6}
.sa-shell .sa-result.bad{border-color:#EBC3B6;background:#FDF6F4}
.sa-shell .sa-result.skip{background:#F6F9F8}
.sa-shell .sa-result-head{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.sa-shell .sa-result-files{font-size:11.5px;color:var(--muted);overflow-wrap:anywhere}
.sa-shell .sa-result-msg{margin:4px 0}
.sa-shell .sa-warnings summary{cursor:pointer;font-size:12px;color:var(--muted)}
.sa-shell .sa-derive{border:1px solid var(--petrol2);border-radius:10px;padding:10px 12px;font-size:13px}
.sa-shell .sa-derive h3{margin:0 0 6px;font-size:14px}
.sa-shell .sa-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 12px;margin:8px 0}
.sa-shell .sa-form label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:600;color:var(--slate)}
.sa-shell .sa-form input,.sa-shell .sa-form textarea{font:inherit;font-size:13px;font-weight:400;border:1px solid var(--line);border-radius:7px;
  padding:5px 8px;color:var(--ink);min-width:0}
.sa-shell .sa-form input[readonly]{background:#F1F5F4}
.sa-shell .sa-notices{margin:6px 0;padding-left:18px;font-size:12.5px;color:#6B4512}
.sa-shell .sa-acks{border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:8px 0}
.sa-shell .sa-acks legend{font-size:12px;font-weight:600;padding:0 4px}

/* version footer */
.sa-shell .sa-footer{max-width:1080px;margin:8px auto 0;padding:14px 16px 56px;border-top:1px solid var(--line);
  font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.02em;text-align:center}
.sa-shell .sa-footer .sa-axes{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 0}
.sa-shell .sa-footer .sa-axis{white-space:nowrap}
.sa-shell .sa-footer .sa-axis + .sa-axis::before{content:"·";padding:0 6px;color:var(--line)}
.sa-shell .sa-footer p{margin:4px 0 0}

@media (max-width:640px){
  .sa-shell .sa-note{flex-basis:100%}
  .sa-shell .sa-select{flex:1 1 200px;width:100%}
  .sa-shell .sa-tabs-row{flex-wrap:wrap}
  .sa-shell .sa-mic{max-width:calc(100% - 16px);margin:0 8px 6px}
  .sa-shell .sa-kv{grid-template-columns:minmax(0,1fr)}
  .sa-shell .sa-drawer{border-radius:12px}
}
@media (prefers-reduced-motion:reduce){.sa-shell *{transition:none!important;animation:none!important}}

@page{margin:14mm}
@media print{
  .sa-shell{background:#fff;min-height:0}
  /* The print frame's header carries the caveat (and the provenance marker) on every page,
     so the screen header, its controls and every overlay stay off paper. */
  .sa-shell .sa-top,.sa-shell .sa-top .sa-controls,.sa-shell .sa-tabs,.sa-shell #sa-mic,
  .sa-shell .sa-restore,.sa-shell .sa-unsaved,.sa-shell .sa-patient-bar,.sa-shell .sa-dialog,.sa-shell .sa-toast,
  .sa-shell .sa-return,.sa-shell [role="tabpanel"][hidden]{display:none!important}
  .masque-proto,.masque-back{display:none!important}
  .sa-shell .sa-top{position:static;background:#fff;color:#000;border-bottom:1px solid #000}
  .sa-shell .sa-caveat{background:#fff;color:#000;border-bottom:0}
  .sa-shell .sa-print-frame{display:table;width:100%}
  .sa-shell .sa-print-frame > thead{display:table-header-group}
  .sa-shell .sa-print-frame > tbody{display:table-row-group}
  .sa-shell .sa-print-frame > tbody > tr,.sa-shell .sa-print-frame > thead > tr{display:table-row}
  .sa-shell .sa-print-frame > tbody > tr > td,.sa-shell .sa-print-frame > thead > tr > td{display:table-cell}
  .sa-shell .sa-print-head td{font:11px/1.4 sans-serif;border-bottom:1px solid #000;padding-bottom:2mm;color:#000}
  .sa-shell .sa-footer{border-top:1px solid #000;color:#000;padding-bottom:0}
}
`;
