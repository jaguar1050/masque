// Loader check fixture: sibling x of the parallel cycle.
import { y } from "./sib-y.js";
export const x = "x";
export const yy = () => y;
