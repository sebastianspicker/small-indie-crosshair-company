# Documentation

This project converts crosshair settings under stated renderer assumptions.
These docs describe the models, how the results were produced, and what evidence
would be needed to check them in CS2.

The default converter is the community static reconstruction for inspected
build **2000922**; the rendered notebook prints the current model id and release
at the top. The historical 27-model study (corpus snapshot **2026-09-23**) and the
library-only manual model (`conditional-static-v4`, no app page since 0.17.0) are kept separately. None of them is a
verified native renderer, and no original old/new game capture pairs are
included.

Research notes, newest first: the [oracle sweeps](research/oracle-sweeps-2026-10-05.md),
the [October 2 learner findings](research/learners-2026-10-02.md) and
[capture protocol](research/capture-protocol-2026-10-02.md), the
[build 2000922 note](research/build-2000922-update-2026-10-01.md), the
[September 29 audit](research/converter-audit-2026-09-29.md), the
[accuracy study](research/accuracy-improvements-2026-09-29.md) and the
[structured-learning study](research/structured-learning-2026-09-29.md). They are
declared-model studies, not native game validation.

## Start here

- **Use the app:** [live demo](https://sebastianspicker.github.io/small-indie-crosshair-company/) and [screenshot tour](../README.md#screenshot-tour).
- **Understand a result:** [conversion and identifiability](math/02-conversion-and-identifiability.md).
- **Run or publish it:** [local and static hosting](engineering/deployment.md),
  [GitHub Pages](engineering/github-pages.md).
- **Change the code:** [contributing](../CONTRIBUTING.md) and
  [architecture](engineering/architecture.md).
- **Supply evidence:** [measurement policy](evidence/measurement-policy.md) and
  [calibration protocol](math/03-calibration-protocol.md).

## Mathematical notebook

Use the app's **Mathematics** tab to open the [rendered notebook](notebook.html),
or read the sources in `math/`. The notebook opens with an
[introduction](math/intro.md) and [how one conversion is decided](math/pipeline.md).
Each chapter starts with a plain summary and a key result; the technical text
follows. Chapter files keep their numbers, which the app's `#chapter-N` links use,
and `scripts/notebook-source.mjs` sets the reading order below.

| Part | Chapter | Question |
| --- | --- | --- |
| I. The old crosshair | [Legacy geometry](math/01-legacy-geometry.md) | How did old values become pixels? |
| | [Pixels, outlines and draw order](math/04-rendering.md) | Which pixels does each game draw, and how is the difference measured? |
| II. Converting | [Conversion goals and identifiability](math/02-conversion-and-identifiability.md) | What can be matched, and what remains unknown? |
| | [Community static conversion](math/12-community-conversion.md) | How are the new values solved, tie-broken and refined? |
| | [What decides the export](math/13-what-decides-the-export.md) | Which rules redraw old shapes, set the T flag and choose the exported lines? |
| III. Evidence and uncertainty | [Model families](math/05-model-families.md) | Where do the 27 historical scenarios come from? |
| | [Historical joint solver](math/09-solver-and-integrity.md) | How do joint search, shape loss and evidence checks work? |
| | [Statistical inference](math/06-statistical-inference.md) | What do model weights and intervals mean? |
| | [Screenshot inversion](math/07-image-inverse-and-feedback.md) | What can a screenshot tell us? |
| | [Calibration and capture protocol](math/03-calibration-protocol.md) | Which measurements distinguish the models? |
| | [Certified inverse and capture plan](math/11-certified-inverse-and-capture-plan.md) | Is the search the declared optimum, and which captures separate the models? |
| IV. Learning | [Corpus study](math/08-expanded-corpus-study.md) | What does the historical input benchmark measure? |
| | [Learned emulators and the ML cross-check](math/10-learned-emulator.md) | What does each learned model do, and why does none decide an export? |

Appendices: [notation](math/appendix-notation.md), [glossary](math/appendix-glossary.md)
and [model history](math/appendix-history.md). Figures in the chapters are
`{{fig:…}}` tokens that `node scripts/notebook.mjs` resolves from
`data/quant-summary.json`, `research/generated/` and `package.json`; a missing
value fails the build unless `SICC_NOTEBOOK_ALLOW_PENDING=1` marks it as pending.
After TeX edits, regenerate `math/mathml-cache.json` with
`npm install --prefix .notebook-tools --no-save mathjax-full@3.2.2` and
`node scripts/notebook-cache.mjs`. The [formula history](research/formula-evolution.md)
and the [source ledger](research/quant-sources.md) record corrections and
provenance.

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

## Build the site

`npm run build` regenerates the mathematical notebook and builds the static site.
Do not edit the [frozen archive](../research/archive/2026-09-23/README.md) to correct
an assumption; record corrections in the formula history.

## Formula notation

`trunc` rounds toward zero; `floor` rounds toward negative infinity. `f32` rounds
to binary32. Intervals such as `[x, x+L)` exclude the far boundary. Length and
thickness usually describe the colored core, excluding outlines. A gap setting,
an inner edge, and the full opening width are different quantities.
