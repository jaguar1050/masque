// engine/evaluate.js — rule evaluation and copy templates (design 03 §3.3, §4.5). Owner: WP3.
//
// Imports nothing, so the Patient Companion's module graph stays small (§4.12).
//
// Fail-closed (D6): the first rule whose `when` throws stops the evaluation, and the caller
// receives {fired: [], error}. A partial list of fired rules is never returned, because a
// rule set with a broken member must not route as if the broken rule had simply not fired.

function messageOf(err) {
  if (err && typeof err.message === "string" && err.message) return err.message;
  try { return String(err); } catch (_) { return "unknown error"; }
}

function ruleIdOf(rule, index) {
  if (rule && typeof rule.id === "string" && rule.id) return rule.id;
  return `#${index}`;
}

/**
 * Evaluate an ordered rule list against a state.
 *
 * A rule fires when its `when` is absent or returns a truthy value. With `surface`, rules
 * without `copy[surface]` are skipped. Fallback rules (`fallback: true`) fire only when no
 * other rule fired (on that surface). With mode "first" the evaluation returns at the first
 * firing rule. The first throw stops everything and returns {fired: [], error}.
 *
 * @param {Array<Object>} rules
 * @param {Object} state
 * @param {{mode?: ("all"|"first"), surface?: (string|null)}} [opts]
 * @returns {{fired: Array<Object>, error: (null|{ruleId: string, index: number, message: string})}}
 */
export function evaluateRules(rules, state, { mode = "all", surface = null } = {}) {
  const list = Array.isArray(rules) ? rules : [];
  const fired = [];
  const fallbacks = [];
  let i = -1;
  let current = null;
  try {
    for (i = 0; i < list.length; i++) {
      current = list[i];
      if (!current) continue;
      if (surface && !(current.copy && current.copy[surface])) continue;
      if (current.fallback === true) { fallbacks.push([current, i]); continue; }
      const ok = typeof current.when !== "function" || !!current.when(state);
      if (ok) {
        fired.push(current);
        if (mode === "first") return { fired, error: null };
      }
    }
    if (!fired.length) {
      for (const [rule, index] of fallbacks) {
        current = rule; i = index;
        const ok = typeof rule.when !== "function" || !!rule.when(state);
        if (ok) {
          fired.push(rule);
          if (mode === "first") break;
        }
      }
    }
  } catch (err) {
    return { fired: [], error: { ruleId: ruleIdOf(current, i), index: i, message: messageOf(err) } };
  }
  return { fired, error: null };
}

function lookup(vars, path) {
  if (!vars) return undefined;
  if (Object.prototype.hasOwnProperty.call(vars, path)) return vars[path];
  let v = vars;
  for (const k of path.split(".")) {
    if (v === null || typeof v !== "object" || !Object.prototype.hasOwnProperty.call(v, k)) return undefined;
    v = v[k];
  }
  return v;
}

const PLACEHOLDER_RE = /\{([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)\}/g;

function substitute(str, vars) {
  return str.replace(PLACEHOLDER_RE, (whole, name) => {
    const v = lookup(vars, name);
    return v === undefined || v === null || typeof v === "object" || typeof v === "function" ? whole : String(v);
  });
}

/**
 * Render a copy template.
 * - a string: every `{placeholder}` (dotted paths allowed) found in `vars` is substituted;
 *   an unknown placeholder is left as written;
 * - a function: called with `state` (a module closure — callers that must fail closed wrap
 *   this call);
 * - an array: each entry rendered (chips).
 * Anything else renders as "".
 * @returns {string|string[]}
 */
export function renderTpl(tpl, state, vars = {}) {
  if (typeof tpl === "function") return tpl(state);
  if (typeof tpl === "string") return substitute(tpl, vars);
  if (Array.isArray(tpl)) return tpl.map(t => (typeof t === "function" ? t(state) : typeof t === "string" ? substitute(t, vars) : ""));
  return "";
}
