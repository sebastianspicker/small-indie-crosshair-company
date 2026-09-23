# Documentation

This project converts crosshair settings under stated renderer assumptions.
These docs describe the models, how to reproduce the results, and what evidence
would be needed to check them in CS2.

Snapshot: **2026-09-23**, target build **2000914**. The automatic converter uses
`quant-static-v5`; the manual lab uses `conditional-static-v4`. Neither is a
verified native renderer. No original old/new game capture pairs are included.

## Start here

- **Use the app:** [live demo](https://sebastianspicker.github.io/small-indie-crosshair-company/) and [screenshot tour](../README.md#screenshot-tour).
- **Understand a result:** [conversion and identifiability](math/02-conversion-and-identifiability.md).
- **Run or publish it:** [local and static hosting](engineering/deployment.md),
  [GitHub Pages](engineering/github-pages.md).
- **Change the code:** [contributing](../CONTRIBUTING.md),
  [architecture](engineering/v0.3-architecture.md), [testing](engineering/testing.md),
  [v0.4 improvement plan](engineering/v0.4-conversion-improvement-plan.md)
  (gap-scale rival, closed residual modulator, inventory facts). The plan describes
  offline research helpers; the shipped `quant-static-v5` default tuple is unchanged.
- **Supply evidence:** [measurement policy](evidence/measurement-policy.md) and
  [calibration protocol](math/03-calibration-protocol.md).

## Mathematical notebook

Use the app's **Mathematics** tab to open the [rendered notebook](notebook.html),
or read the source chapters on GitHub:

| Chapter | Question |
| --- | --- |
| [01 — Legacy geometry](math/01-legacy-geometry.md) | How did old values become pixels? |
| [02 — Conversion](math/02-conversion-and-identifiability.md) | What can be matched, and what remains unknown? |
| [03 — Calibration](math/03-calibration-protocol.md) | Which measurements distinguish the models? |
| [04 — Rendering](math/04-rendering.md) | How are shapes and preview losses calculated? |
| [05 — Model families](math/05-model-families.md) | Where do the 27 scenarios come from? |
| [06 — Statistics](math/06-statistical-inference.md) | What do model weights and intervals mean? |
| [07 — Image analysis](math/07-image-inverse-and-feedback.md) | What can a screenshot tell us? |
| [08 — Corpus study](math/08-expanded-corpus-study.md) | What does the historical input benchmark measure? |
| [09 — Current solver](math/09-solver-and-integrity.md) | How do joint search, shape loss, and evidence checks work? |
| [10 — Learned emulator](math/10-learned-emulator.md) | Can a small learned model replace the exact solver, and why was it rejected? |
| [11 — Certified inverse](math/11-certified-inverse-and-capture-plan.md) | Is the shipped search the declared optimum, and which captures would separate the models? |

Chapter 09 updates the earlier optimizer descriptions. Chapter 10 documents a
dependency-free learned emulator that **distills the declared solver**; its labels
are self-generated and it is **not native evidence**. Its held-out full-tuple
fidelity was raised from about 11.6% to about 35.7% by a capacity revision, which
is still not interchangeable, so it is left out of the conversion path. Chapter 11
adds an **opt-in** certificate for the declared loss (`infer({ certify: true })`),
complete integer preimages, the `cvar` decision rule, a behavioural partition of
the 27 scenarios, and a synthetic capture plan. The default model stays
`quant-static-v5` and the project still ships **zero native capture pairs**, so
none of this is native accuracy. Prior derivations remain available so changes can
be traced through the [formula history](research/formula-evolution.md).
The [source ledger](research/quant-sources.md) records provenance and limitations.

## Evidence labels

| Label | What it supports |
| --- | --- |
| Build inventory | A symbol, range, or description exists in the pinned game-data dump. It does not reveal the renderer implementation. |
| Source-derived | A result follows a cited community implementation. |
| Archive-reproduced | The unchanged archived experiment produces its stored results. |
| Model-tested | The code follows a specified model for the tested inputs. |
| Synthetic example | Generated data demonstrates behavior; it is not a game measurement. |
| User-entered observation | A supplied measurement has recorded conditions; its provenance is user-attested. |
| Native validation | Original captures and controlled game execution support a scoped claim, reviewed separately. |

The shipped evidence covers the first five labels. Import tools accept observations,
but do not automatically turn them into native validation. A perfect synthetic fit
is insufficient to estimate native match probability.

The corpus has 138 records, but only eight have known observation dates. The study
uses 135 eligible records at seven heights. These 945 cases test calculations;
they are not 945 independent game observations.

## Reproduce the work

`npm run verify` rebuilds the study, runs the tests, checks the archive hashes and
56 JS/Python parity cases, and builds the site. See [testing](engineering/testing.md)
for browser checks and the distinction between current runs and historical records.
Do not edit the [frozen archive](../research/archive/2026-09-23/README.md) to correct
an assumption; record corrections in the formula history.

## Formula notation

`trunc` rounds toward zero; `floor` rounds toward negative infinity. `f32` rounds
to binary32. Intervals such as `[x, x+L)` exclude the far boundary. Length and
thickness usually describe the colored core, excluding outlines. A gap setting,
an inner edge, and the full opening width are different quantities.
