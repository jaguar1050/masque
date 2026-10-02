// engine/css.js — runtime CSS scoping (design 03 §4.3, §5.10).
//
// The app CSS strings move unedited from the baseline and are wrapped here, so two apps
// mounted on one page cannot restyle each other or the shell.
// Pure; no imports, no side effects.

// At-rules whose block holds further rules (recursed into).
const NESTING_AT_RULES = new Set(["media", "supports", "container", "layer", "document", "-moz-document"]);

// Leading `:root`, `html` or `body` of a selector, when followed by the end or a boundary.
const ROOTISH_RE = /^(?::root|html|body)(?=$|[\s>+~.#:[,])/i;

/** Index just past the comment that starts at `i` (css[i] === "/" && css[i+1] === "*"). */
function skipComment(css, i) {
  const end = css.indexOf("*/", i + 2);
  return end === -1 ? css.length : end + 2;
}

/** Index just past the quoted string that starts at `i`. */
function skipString(css, i) {
  const q = css[i];
  let j = i + 1;
  while (j < css.length && css[j] !== q) {
    if (css[j] === "\\") j++;
    j++;
  }
  return Math.min(j + 1, css.length);
}

/** Index of the "}" that closes the block whose "{" is at `open`, or css.length. */
function matchBrace(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") { i = skipComment(css, i) - 1; continue; }
    if (c === '"' || c === "'") { i = skipString(css, i) - 1; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return i; }
  }
  return css.length;
}

/** Index of the first top-level "{" or ";" from `i` (skipping strings, comments, parens). */
function findPreludeEnd(css, i) {
  let paren = 0, bracket = 0;
  for (let j = i; j < css.length; j++) {
    const c = css[j];
    if (c === "/" && css[j + 1] === "*") { j = skipComment(css, j) - 1; continue; }
    if (c === '"' || c === "'") { j = skipString(css, j) - 1; continue; }
    if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    else if (c === "[") bracket++;
    else if (c === "]") bracket = Math.max(0, bracket - 1);
    else if (!paren && !bracket && (c === "{" || c === ";" || c === "}")) return j;
  }
  return css.length;
}

/** Split a selector list on top-level commas, keeping every character. */
function splitSelectors(prelude) {
  const parts = [];
  let paren = 0, bracket = 0, start = 0;
  for (let j = 0; j < prelude.length; j++) {
    const c = prelude[j];
    if (c === "/" && prelude[j + 1] === "*") { j = skipComment(prelude, j) - 1; continue; }
    if (c === '"' || c === "'") { j = skipString(prelude, j) - 1; continue; }
    if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    else if (c === "[") bracket++;
    else if (c === "]") bracket = Math.max(0, bracket - 1);
    else if (c === "," && !paren && !bracket) { parts.push(prelude.slice(start, j)); start = j + 1; }
  }
  parts.push(prelude.slice(start));
  return parts;
}

/** Scope one selector, keeping its leading and trailing whitespace and comments. */
function scopeSelector(part, root) {
  let i = 0;
  // Leading whitespace and comments stay where they are.
  for (;;) {
    while (i < part.length && /\s/.test(part[i])) i++;
    if (part[i] === "/" && part[i + 1] === "*") { i = skipComment(part, i); continue; }
    break;
  }
  let j = part.length;
  while (j > i && /\s/.test(part[j - 1])) j--;
  const lead = part.slice(0, i), body = part.slice(i, j), trail = part.slice(j);
  if (!body) return part;
  const m = body.match(ROOTISH_RE);
  if (m) {
    const rest = body.slice(m[0].length);
    if (!rest.trim()) return lead + root + trail;
    // `:root .x` → `${root} .x`; `body.dark` → `${root}.dark`
    return lead + root + rest + trail;
  }
  return lead + root + " " + body + trail;
}

function scopeBlock(css, root) {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (/\s/.test(c) || c === ";" || c === "}") { out += c; i++; continue; }
    if (c === "/" && css[i + 1] === "*") { const e = skipComment(css, i); out += css.slice(i, e); i = e; continue; }

    const end = findPreludeEnd(css, i);
    const prelude = css.slice(i, end);
    if (end >= css.length || css[end] !== "{") {
      // A statement (`@import …;`, `@charset …;`) or trailing text: kept verbatim.
      out += css.slice(i, Math.min(end + 1, css.length));
      i = end + 1;
      continue;
    }
    const close = matchBrace(css, end);
    const inner = css.slice(end + 1, close);
    const closing = close < css.length ? "}" : "";
    if (prelude[0] === "@") {
      const name = (prelude.match(/^@([-\w]+)/) || [, ""])[1].toLowerCase();
      if (NESTING_AT_RULES.has(name)) out += prelude + "{" + scopeBlock(inner, root) + closing;
      else out += prelude + "{" + inner + closing;   // @keyframes, @font-face, @page …: body untouched
    } else {
      out += splitSelectors(prelude).map((p) => scopeSelector(p, root)).join(",") + "{" + inner + closing;
    }
    i = close + 1;
  }
  return out;
}

/**
 * Scope a stylesheet under `rootSelector`. Every selector of every comma list becomes
 * `${root} sel`; `:root`, `html` and `body` become `${root}` itself (so the custom
 * properties land on the app's root element); `*` becomes `${root} *`. Recurses into
 * @media / @supports (and @container / @layer blocks); leaves @keyframes, @font-face and
 * @page bodies alone; keeps comments and whitespace. Deterministic.
 * @param {string} css
 * @param {string} rootSelector  e.g. ".sa-screener"
 * @returns {string}
 */
export function scopeCss(css, rootSelector) {
  return scopeBlock(String(css), String(rootSelector));
}
