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

/* known M1 limits */
.sa-shell .sa-limits{max-width:1080px;margin:10px auto 0;padding:0 16px}
.sa-shell .sa-limits-box{background:var(--amberbg);border:1px solid #E7D3AE;color:#6B4512;border-radius:10px;
  padding:8px 12px;font-size:12.5px}
.sa-shell .sa-limits-box summary{cursor:pointer;font-weight:650}
.sa-shell .sa-limits-box ul{margin:6px 0 2px;padding-left:18px}
.sa-shell .sa-limits-box a{color:var(--petrol)}

/* print frame: on screen the table is plain blocks and the header is hidden */
.sa-shell .sa-print-frame,.sa-shell .sa-print-frame > tbody,.sa-shell .sa-print-frame > tbody > tr,
.sa-shell .sa-print-frame > tbody > tr > td{display:block;width:100%;margin:0;padding:0;border:0}
.sa-shell .sa-print-frame{border-collapse:collapse}
.sa-shell .sa-print-frame > thead{display:none}
/* a panel wider than the viewport scrolls inside itself, never the page (§5.10, 375 px) */
.sa-shell .sa-panel{min-width:0;max-width:100%;overflow-x:auto}

/* placeholder panel (Rubric Editor at M1) */
.sa-shell .sa-placeholder{max-width:720px;margin:28px auto;padding:0 16px}
.sa-shell .sa-placeholder-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px 20px;
  display:flex;gap:14px;align-items:flex-start}
.sa-shell .sa-placeholder-card h2{margin:0 0 4px;font-size:17px;font-weight:650}
.sa-shell .sa-placeholder-card p{margin:0;color:var(--muted);font-size:14px}

/* version footer */
.sa-shell .sa-footer{max-width:1080px;margin:8px auto 0;padding:14px 16px 56px;border-top:1px solid var(--line);
  font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.02em;text-align:center}
.sa-shell .sa-footer .sa-axes{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 0}
.sa-shell .sa-footer .sa-axis{white-space:nowrap}
.sa-shell .sa-footer .sa-axis + .sa-axis::before{content:"·";padding:0 6px;color:var(--line)}
.sa-shell .sa-footer p{margin:4px 0 0}

@media (max-width:640px){
  .sa-shell .sa-note{flex-basis:100%}
  .sa-shell .sa-select{flex:1 1 200px}
}
@media (prefers-reduced-motion:reduce){.sa-shell *{transition:none!important;animation:none!important}}

@page{margin:14mm}
@media print{
  .sa-shell{background:#fff;min-height:0}
  .sa-shell .sa-top .sa-controls,.sa-shell .sa-tabs,.sa-shell #sa-mic,.sa-shell .sa-limits,
  .sa-shell .sa-restore,.sa-shell .sa-unsaved,.sa-shell .sa-patient-bar,.sa-shell .sa-dialog,
  .sa-shell [role="tabpanel"][hidden]{display:none!important}
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
