// Loader check fixture: one half of a two-module import cycle (cycle-a <-> cycle-b).
import { b } from "./cycle-b.js";
export const a = "a";
export default function CycleA() { return b; }
