// Loader check fixture: imports two siblings that import each other, so the loader builds
// them in parallel and each finds the other already pending in its cache.
import { x } from "./sib-x.js";
import { y } from "./sib-y.js";
export default function SibRoot() { return x + y; }
