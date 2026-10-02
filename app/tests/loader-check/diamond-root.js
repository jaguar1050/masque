// Loader check fixture: a diamond (root -> left, right -> shared). The shared module must be
// built and instantiated once, and left and right must be fetched in parallel.
import { left } from "./diamond-left.js";
import { right } from "./diamond-right.js";
export { left, right };
