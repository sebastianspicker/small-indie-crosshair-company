# Quant lab architecture and resource boundaries

The existing dependency-free static application remains the foundation.
No backend, live model API, database or analytics service was added. The
new code separates corpus assembly, mathematical inference, actual
measurements, synthetic rasterization and UI so an unsupported assumption
cannot silently flow into a native validation claim.

## Modules

| Module | Responsibility |
|---|---|
| `models.js` | 27 explicit forward hypotheses and bounded integer inverses |
| `inference.js` | Frozen target, proposal deduplication, local visual search, expected-loss ranking |
| `evidence.js` | Native attestation/schema, grouping, tempered likelihood, holdouts, conflict flags |
| `statistics.js` | Stable normalization, deterministic cluster bootstrap, Wilson intervals |
| `corpus.js` | Signature grouping, folds, input-domain support |
| `regression.js` | Small weighted ridge surrogate for the old-only study |
| `screenshot.js` | Bounded segmentation; old template search; independent native component extraction |
| `quant-worker.js` | Browser worker message boundary and transferable image masks |
| `worker-client.js` | Request IDs, deadlines, error handling and disposal |
| `converter.js` | Load the corpus, start the worker, and connect the converter UI |
| `corpus.js` (app) | Paginated corpus and group-aware results; no model fitting in the UI |

Static source facts live in `research/corpus/`. `scripts/corpus.mjs`
verifies the pinned archive transcription, checks every legacy checksum,
retains original date/resolution uncertainty, and produces versioned data.
`scripts/quant-study.mjs` performs deterministic group-aware experiments.
The immutable v0.1.0 archive and its independent Python reproduction remain
separate.

## Responsiveness

Routes are initialized on demand. The first view loads only its own modules
and bundled corpus. Inference and image fitting run in a dedicated module
worker. Inputs debounce for 120 ms (text import 300 ms); request generations
prevent stale responses overwriting a later input. Exports are disabled
while a new input is pending or invalid. The worker has explicit 30-second
request deadlines and bounded computational searches, not an unbounded
retry loop.

One worker keeps the corpus in memory rather than transferring it for every
keystroke. Raster scores are cached within a search; identical cvar tuples
are merged. The candidate grid is at most 27 initial proposals, followed
by at most two local 27-neighbor passes per proposal. Canvas redraws use
`requestAnimationFrame` through ResizeObserver; DPR is capped at 2 for
preview canvases. Preview zoom is display-only. Corpus tables paginate 20
rows instead of constructing every possible record-height result on each
keystroke. Expensive native image bytes never enter unrelated table state.

There is no worker-result memoization across differing evidence sets, which
avoids silently reusing stale likelihoods. Requests can queue briefly under
rapid input, but are bounded and stale results are discarded. There is not
a claim of hard real-time deadlines or preemptive cancellation of synchronous
work already executing in the worker.

## Image and input limits

PNG: 16 MB file cap, 20-million-pixel decoded cap, maximum side 8192, center
crop up to 161 square. Legacy CFG: 32 KiB and explicit data-only cvar
allowlist. Evidence JSON: 1 MB in the UI, 256 measurements at the model
boundary. Legal integer native cvars and finite heights are checked before
rendering. Source fields, filenames and user values enter safe text nodes
or JSON, never `eval`, `new Function`, dynamic scripts or HTML assignment.

The screenshot provenance hash requires a secure origin. Canvas files and
JSON remain in memory until the tab closes or the user explicitly exports
them. No localStorage, IndexedDB, screenshot upload or remote callback is
used. Worker errors are shown rather than silently falling back to an
unbounded main-thread production solver.

## Readable mathematics without runtime dependencies

`docs/notebook.html` contains all nine chapters with native static MathML.
`scripts/notebook.mjs` renders the project's bounded Markdown subset and
uses a checked-in, content-addressed equation cache. Builds fail on missing
or invalid equation entries rather than silently displaying stale formulas.
No runtime MathJax, CDN, font download or browser TeX parser is needed.

Only authors changing TeX need the optional cache compiler:

```bash
npm install --prefix .notebook-tools --no-save mathjax-full@3.2.2
node scripts/notebook-cache.mjs
node scripts/notebook.mjs
```

The optional authoring directory is ignored and not shipped. The cache
contains serialized MathML, not font files. Normal `npm run verify` and
Pages deployment need no npm installation. Markdown source remains the
canonical editable mathematical documentation. The built reader is a
convenience view; it is not a general-purpose untrusted Markdown renderer.

## Reproducibility versus performance measurements

Corpus generation, folds, benchmark targets and bootstrap draws use fixed
inputs/seeds and produce deterministic research outputs. A performance
benchmark is different: timings naturally vary. `npm run bench:quant`
reports local runtime, CPU, warmups, 40 cases, median and 95th-percentile
core-compute time. The optional saved timing file is labeled local empirical
performance, not a deterministic CI golden file or a universal latency
promise. Browser transport, layout, worker startup and screenshot decoding
are outside that core benchmark.
