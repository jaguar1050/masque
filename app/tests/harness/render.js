// tests/harness/render.js — renderHook, detached mounting and textContent capture
// (design 03 §8.0, §8.2). Everything renders outside StrictMode, into containers that are
// never attached to the document, with createRoot + flushSync.
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

/**
 * Call a hook inside a throwaway component and return what it returned on the first render
 * (A §6.1). The component is unmounted before this returns.
 */
export function renderHook(hook, ...args) {
  let value;
  let error = null;
  function HookProbe() {
    try {
      value = hook(...args);
    } catch (err) {
      error = err;
    }
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    flushSync(() => root.render(React.createElement(HookProbe)));
  } finally {
    root.unmount();
  }
  if (error) throw error;
  return value;
}

/**
 * Render `element` into a detached container.
 * @returns {{container: HTMLDivElement, rerender(el): void, unmount(): void}}
 */
export function mount(element) {
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => root.render(element));
  let mounted = true;
  return {
    container,
    rerender(next) { flushSync(() => root.render(next)); },
    unmount() { if (mounted) { mounted = false; root.unmount(); } },
  };
}

/**
 * textContent of a named region. A bare name (letters, digits, "-", "_", ".") is a
 * data-testid; anything else is used as a CSS selector. No selector: the whole container.
 * Throws when the region does not exist, so a missing region is never compared as "".
 */
export function text(container, selector) {
  if (!selector) return container.textContent;
  const css = /^[A-Za-z0-9_.-]+$/.test(selector) ? `[data-testid="${selector}"]` : selector;
  const el = container.querySelector(css);
  if (!el) throw new Error(`region not found: ${css}`);
  return el.textContent;
}
