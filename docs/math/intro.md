# Introduction

The converter reads crosshair settings written for Counter-Strike 2 before the
crosshair update of September 23, 2026 and writes console commands for the
current game, build {{fig:model.build|version}}. The commands aim to draw the
pixels the old crosshair drew, as closely as the current settings allow.

Three kinds of statement appear in this notebook, and each result says which
kind it is.

- **Exact arithmetic.** The old drawing is rebuilt from the leaked source of the
  old renderer, with its binary32 arithmetic. The search over legal new values is
  exhaustive within stated bounds. Both are checked by tests against independent
  implementations.
- **Modelled reconstruction.** How the current game draws a crosshair (its
  rounding, gap origin, outline and treatment of zero-length bars) is a model
  carried over from build 2000918, a shader dump and a few user screenshots. It
  is not derived from the game's code.
- **Partial game checks.** The forward model has been checked against
  {{fig:summary.evidence.captures.total|int}} user-supplied current-game captures,
  reused during development, not independent holdouts. The repository holds
  {{fig:summary.dataset.nativeCapturePairs|int}} native capture pairs: no
  screenshot pair of the old and the current game with the same settings.
  The corpus and learner agreement figures compare our own implementations with
  each other, with other converters or with our own models. They do not measure
  end-to-end conversion accuracy in the game.

No learned model decides an exported value. Every exported number comes from
closed-form arithmetic, an exact bounded search and fixed rules. A separately
trained learner predicts the export as a second opinion and never changes it.

This page describes model `{{fig:model.version|version}}` of release
{{fig:package.version|version}}. Symbols are defined once in the
[notation appendix](appendix-notation.md) and terms in the
[glossary](appendix-glossary.md).
