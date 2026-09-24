# 0002 — Speed/shortcut gates stay closed without native pairs

**Source:** [`docs/math/10-learned-emulator.md`](../../math/10-learned-emulator.md) §8,
[archived v0.4 plan §0.4 and §2.7](../archive/v0.4-conversion-improvement-plan.md).

## Context

Two independent shortcuts exist around the exact solver, and both carry an
explicit machine-readable gate:

- The learned emulator/ranker artifact (`research/generated/quant-emulator.json`) records
  `provenance.speedGate = "closed-not-exact-equivalent"`: the learned inverse
  reproduces the exact solver's full tuple only about 35.7% of the time, and
  the verified shortlist ranker still loses to the exact solver on 13 of 125
  benchmark samples.
- The residual modulator (`research/lib/modulator.js`) always returns
  `reason: 'closed-no-native-pairs'` and a zero delta. Its trainer
  (`research/scripts/train-residual-modulator.mjs`) reads
  `research/measurements/index.json`; the registry is empty and no
  reviewed-registry provenance value is defined, so the trainer always takes
  the closed branch and exits 0 with a closed artifact.

Both numbers describe fidelity to the project's own solver, not accuracy
against CS2. Neither gate has a native-evidence path to open through today.

## Decision

A speed or correction shortcut may only report a non-closed gate once
reviewed native capture pairs exist and meet the documented minimum evidence
bar (at least 40 reviewed pairs, 24 distinct old-setting signatures, 3
distinct current heights including one `H ≠ A` and one `H = A` pair, both odd
and even rendered widths, at least one literal and one positive thickness,
and at least one negative and one nonnegative old gap). Until then, every
such gate stays closed, and the code must not add a branch that could open it
on synthetic or self-generated data. `REVIEWED_REGISTRY_PROVENANCE` in
`research/lib/modulator.js` is deliberately `null`; no provenance value is
defined that a test fixture or import could forge.

## Consequences

- `tests/research/modulator.test.mjs` and `tests/research/emulator.test.mjs` assert the closed
  gate strings (`closed-no-native-pairs`, `closed-not-exact-equivalent`)
  directly; changing either string, or making either trainer take an open
  branch, is a decision this ADR must be revised for, not a silent patch.
- `research/lib/modulator.js` is not imported by `lib/solver/inference.js`. A
  future patch may not "just" wire in a small nonzero delta — opening the
  gate requires a new model id and reviewed evidence, per
  [ADR-0001](0001-learned-emulator-research-only.md).
- Any future shortcut (a new learned surrogate, a new modulator revision)
  must ship with its own explicit gate string and closed default, following
  this same pattern, rather than an implicit "off" achieved only by not being
  called yet.
