// Loader check fixture: the other half of the two-module import cycle.
import { a } from "./cycle-a.js";
export const b = "b";
export default function CycleB() { return a; }
