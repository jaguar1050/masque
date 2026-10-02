// Loader check fixture: a root component that renders the props boot() passed to it.
import React from "react";

export default function PropsRoot(props) {
  const keys = Object.keys(props).sort();
  const env = props.env || {};
  const loaderFns = Object.keys(env.loader || {}).sort();
  return (
    <pre id="props-out" data-marker={props.marker || ""}>
      {JSON.stringify({ keys, marker: props.marker, appBase: env.appBase, loaderFns })}
    </pre>
  );
}
