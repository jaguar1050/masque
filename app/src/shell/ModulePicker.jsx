// shell/ModulePicker.jsx — the module <select> at the very top of screenAIr (design 03 §5.2).
// Owner: WP12.
//
// Options, in order: the built-ins in registry.json order (the default first), then "Upload",
// then an optgroup "Loaded this session" with uploaded and derived modules.
//
// Only committed choices act. A closed native select changes its value on arrow keys, and
// some browsers fire `change` for every step, so a keyboard user moving through the list
// would otherwise open the upload dialog or switch module on the way. After a pointer
// interaction `change` commits at once; after a keyboard change the option is only pending:
// Enter commits it, Escape or leaving the control restores the active module.

import React, { useEffect, useRef, useState } from "react";
import { originWord } from "./chrome.jsx";

/** The value of the Upload option. */
export const UPLOAD_VALUE = "__upload__";

const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);

function labelOf(entry) {
  const m = entry.module;
  const label = m ? m.label : entry.label;
  if (entry.origin === "builtin") return entry.module && entry.validation && entry.validation.ok !== false ? label : `${label} (failed to load)`;
  return `${label} · ${originWord(m) || "uploaded"}`;
}

/**
 * @param {{entries: Object[], activeKey: string, onSelect: function(string): void,
 *          onUploadRequest: function(): void, disabled?: boolean}} props
 */
export default function ModulePicker({ entries, activeKey, onSelect, onUploadRequest, disabled = false }) {
  const [value, setValue] = useState(activeKey);
  const lastInput = useRef("pointer");
  const pending = useRef(false);

  useEffect(() => { setValue(activeKey); pending.current = false; }, [activeKey]);

  const builtins = entries.filter((e) => e.origin === "builtin");
  const session = entries.filter((e) => e.origin !== "builtin");

  const commit = (v) => {
    pending.current = false;
    setValue(activeKey);
    if (v === UPLOAD_VALUE) { onUploadRequest(); return; }
    if (v && v !== activeKey) onSelect(v);
  };

  const onKeyDown = (e) => {
    if (NAV_KEYS.has(e.key) || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ")) {
      lastInput.current = "keyboard";
      return;
    }
    if (e.key === "Enter") {
      if (pending.current || value !== activeKey) { e.preventDefault(); commit(value); }
      return;
    }
    if (e.key === "Escape" && (pending.current || value !== activeKey)) {
      e.preventDefault();
      pending.current = false;
      setValue(activeKey);
    }
  };

  const onChange = (e) => {
    const v = e.target.value;
    if (lastInput.current === "keyboard") {
      pending.current = true;
      setValue(v);
      return;
    }
    commit(v);
  };

  const onPointer = () => { lastInput.current = "pointer"; };
  const onBlur = () => {
    if (pending.current) { pending.current = false; setValue(activeKey); }
    lastInput.current = "pointer";
  };

  return (
    <>
      <label htmlFor="sa-module">Module</label>
      <select
        id="sa-module"
        className="sa-select"
        value={value || ""}
        disabled={disabled}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onMouseDown={onPointer}
        onPointerDown={onPointer}
        onTouchStart={onPointer}
        onBlur={onBlur}
        data-testid="module-picker"
        aria-describedby="sa-module-hint"
      >
        {builtins.map((e) => <option key={e.key} value={e.key}>{labelOf(e)}</option>)}
        <option value={UPLOAD_VALUE}>Upload</option>
        {session.length ? (
          <optgroup label="Loaded this session">
            {session.map((e) => <option key={e.key} value={e.key}>{labelOf(e)}</option>)}
          </optgroup>
        ) : null}
      </select>
      <span className="sa-sr" id="sa-module-hint">With the keyboard, choose a module with the arrow keys and press Enter to open it.</span>
    </>
  );
}
