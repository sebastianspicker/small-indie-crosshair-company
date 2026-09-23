// Stable public facade; renderer definitions and inverse optimization have distinct ownership.
export * from './renderer.js';
export { bestInteger, solveInverse, solveTarget } from './inverse.js';
export { exactPreimage, exactPreimageForAll } from './inverse.js';
