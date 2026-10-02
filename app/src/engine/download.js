// engine/download.js — browser download helpers and the JSON code-block highlighter, moved from
// the Screener (Scr L618-625, L813-820). Nothing runs at import time; the helpers touch the
// document only when called.

export function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
export const downloadJsonFile = (filename, obj) => downloadText(filename, JSON.stringify(obj, null, 2), "application/json");

/**
 * Save raw bytes (a zip, an exact copy of a module file) without re-encoding them.
 * @param {string} filename
 * @param {Uint8Array|ArrayBuffer} bytes
 * @param {string} [type]
 */
export function downloadBytes(filename, bytes, type = "application/octet-stream") {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// syntax-light JSON for the code block
export function fhirHtml(obj) {
  const j = JSON.stringify(obj, null, 2);
  return j
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="s">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>');
}
