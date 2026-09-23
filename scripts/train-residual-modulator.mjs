#!/usr/bin/env node
/**
 * Residual-modulator trainer (closed).
 *
 * Reads `research/measurements/index.json`, evaluates the evidence gate, and always writes
 * a zero artifact. There is deliberately no open branch in this file: the reviewed-registry
 * provenance value the gate needs is not defined by the v0.4 plan, so the trainer cannot
 * train. Exit code is 0 either way; the output records the closed speed gate.
 * See docs/engineering/v0.4-conversion-improvement-plan.md §2.7 and Phase 5.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { gateDecision, CLOSED_GATE, MODULATOR_VERSION, DELTA_CLIP, REVIEWED_REGISTRY_PROVENANCE } from '../lib/quant/modulator.js';

const root = new URL('../', import.meta.url);
let index = { nativeMeasurements: [] };
try {
  index = JSON.parse(await readFile(new URL('research/measurements/index.json', root), 'utf8'));
} catch {
  // A missing registry is the empty registry, not a crash.
}
const pairs = Array.isArray(index.nativeMeasurements) ? index.nativeMeasurements : [];
const decision = gateDecision(pairs);

const artifact = {
  schema: 'sicc-residual-modulator-v1',
  version: MODULATOR_VERSION,
  weights: null,
  speedGate: CLOSED_GATE,
  nativeEvidence: false,
  trainedOnSolverLabels: false,
  deltaClip: DELTA_CLIP,
  reviewedRegistryProvenance: REVIEWED_REGISTRY_PROVENANCE,
  eligible: decision.eligible,
  gateReasons: decision.reasons,
  counts: decision.counts,
  generatedFrom: 'research/measurements/index.json',
  interpretation: 'Closed by construction. The residual modulator returns a zero delta and is not imported by inference; the exact solver remains authoritative.',
};

await writeFile(new URL('data/quant-modulator.json', root), JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify({ speedGate: artifact.speedGate, reviewedPairs: pairs.length, eligible: decision.eligible, reasons: decision.reasons.length }));
