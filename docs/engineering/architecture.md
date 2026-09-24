# Architecture

This is the single current architecture document. Standing rules live as short
decision records in [`decisions/`](decisions/); superseded designs are kept in
[`archive/`](archive/). This document describes where things live and why;
the decisions describe constraints that must stay true.

The project is a static, dependency-free, client-only web app plus the
research that justifies it. There is no server component, bundler, account,
network call or persistence at runtime.

## The repository in one picture

```text
index.html, public/, licenses/         static shell (published as-is)
app/        browser runtime            DOM, canvases, routing, worker transport
  └─ imports ─▶ lib/
lib/        pure domain                no DOM, no worker globals, no network
  settings ◀─ geometry ◀─┬─ image
                         ├─ solver     (automatic converter, quant-static-v5)
                         └─ manual     (manual lab, conditional-static-v4)
data/       runtime data               the four JSON files the app fetches
research/   evidence, never runtime    lib/ (research models), scripts/ (pipelines),
                                        generated/, corpus/, measurements/, archive/ (frozen)
  └─ imports ─▶ lib/
scripts/    repository tooling         build, serve, check, notebook, import graph
tests/      one folder per tree        lib/, app/, research/, tooling/, browser/, fixtures/
docs/       math, research notes, evidence policy, engineering docs, generated notebook
```

Arrows point from importer to imported module. Nothing points back:
`lib/` never imports `app/`, and neither `app/` nor `lib/` imports
`research/`.

## `lib/`: the pure domain

Every module in `lib/` is a plain ES module that runs unchanged in the
browser, in the worker and in Node. Five layers, each with one job:

| Layer | Owns | May import |
|---|---|---|
| `lib/settings/` | What a setting *is*. Input validation primitives (`validation.js`), native cvar ranges, colour resolution and CFG command formatting (`native.js`), the frozen build-2000914 cvar inventory (`cvars.js`), the legacy v1 share-code codec (`sharecode.js`, MIT-attributed), the allowlisted legacy CFG parser (`cfg.js`), and the single legacy-text import dispatch (`import.js`). | `settings` |
| `lib/geometry/` | What a crosshair *looks like*. Binary32 legacy geometry (`legacy.js`), the one integer quantizer (`quantize.js`), illustrative rasterization (`raster.js`), lossless shape and mask compilation (`pixel-shape.js`), and the 56-case legacy audit shared by the #evidence page and the archive reproduction (`audit.js`). | `geometry`, `settings` |
| `lib/image/` | Reading pixels. Bounded PNG screenshot segmentation and native component measurement (`screenshot.js`, `components.js`). | `image`, `geometry`, `settings` |
| `lib/solver/` | The automatic converter (`quant-static-v5`, 27 forward hypotheses). Forward renderers (`renderer.js`), exact integer inverse (`inverse.js`), visual refinement (`visual.js`), decision rules (`selection.js`), opt-in certificates (`certify.js`), measurement evidence (`observations.js`, `evidence.js`), experiment design (`experiments.js`), corpus coverage (`corpus.js`, `statistics.js`), the gap-scale structural rival (`structural.js`), the read-only rival rows (`migration.js`), the report and CFG export (`report.js`, `export.js`), and the orchestrating entry point `infer()` (`inference.js`). | `solver`, `geometry`, `settings` |
| `lib/manual/` | The manual lab (`conditional-static-v4`): the `convert()`/`exportCFG()` model with its `measured` gap branch (`conversion.js`) and the affine calibration fit plus `sicc-measurement-v1` schema (`calibration.js`). | `manual`, `geometry`, `settings` |

`solver` and `manual` are deliberately separate conversion models, not two
copies of one model. The manual lab has a user-measured affine gap branch
that the automatic family lacks, and the automatic family has `ceil` rounding
and the `opening` gap baseline that the manual lab lacks. Unifying them would
change results and needs its own model id. What they genuinely share lives in
`settings` and `geometry`: the quantizer, legacy geometry, validation and
CFG formatting. The three build-id constants (`TARGET_BUILD` in the manual
model, `BUILD` in the renderer, `INVENTORY_BUILD` in the cvar inventory) are
separate facts that happen to be equal today. A test asserts that equality,
so they can only diverge deliberately.

`inference.js` and `report.js` read `performance.now()` to record solve
timings in the report. That is the only non-deterministic input in `lib/`.

## `app/`: the browser runtime

`app/main.js` is the hash router. It lazily imports one route module on first
visit, toggles Simple/Expert mode (`ui/mode.js`,
`<html data-mode="simple|expert">`), and shows a boot error for a failed
route without breaking the others. Routes are part of the public URL surface:

| Route | Nav label | Code |
|---|---|---|
| `#quant` (default) | Convert | `app/convert/` |
| `#corpus` | Settings data | `app/pages/corpus.js` |
| `#research` | Mathematics | `app/pages/research.js` |
| `#workbench` | Manual tool | `app/manual/editor.js`, `app/manual/preview.js` (static markup in `index.html`) |
| `#calibration` | Measurements | `app/manual/calibration.js` (feeds the workbench editor) |
| `#evidence` | Original 56-case archive (footer) | `app/pages/evidence.js` |

Supporting directories:

- `app/ui/` holds shared DOM helpers. `dom.js` provides safe text-first
  element construction, doc links and explicit downloads; `mode.js` handles
  Simple/Expert mode.
- `app/data.js` is the only module that fetches bundled `data/*.json`.
  Presets are memoized, so the workbench, calibration and evidence routes
  share one fetch, and #evidence no longer builds the workbench editor.
- `app/convert/` is the automatic converter UI. `converter.js` boots the
  route. `controller.js` owns the state (settings, result, measurements,
  target override and mask, source), request generations and the 90 ms
  analysis debounce; text import has its own 250 ms debounce in `sources.js`.
  `view.js` builds the controls, `presentation.js` renders values, canvases,
  scenario tables and rival rows, `preview.js` paints canvases, and
  `feedback.js` handles screenshot and native-evidence input. The controller
  resolves the model choice on the main thread and asks the worker to solve.
- `app/image/` is image intake. `input.js` enforces a 16 MB file cap and
  hashes the file, `dialog.js` crops, and `view.js` displays. The
  20-million-pixel / 8192-side decode limit is enforced in
  `lib/image/screenshot.js`.

### The worker boundary (`app/worker/`)

`client.js` exports `ResearchWorker`, a bounded serial transport, not a
fallback solver. It creates `new Worker(new URL('./worker.js',
import.meta.url), { type: 'module' })`. It gives every request a sequence id
and a 30-second deadline, admits at most 8 queued tasks, and lets a newer
`infer` supersede queued ones. Clone failures, protocol failures, deadlines
and disposal reject the affected requests, and the main thread never falls
back to an unbounded solve.

`worker.js` is the only module loaded in the worker realm. It accepts exactly
`init`, `infer`, `discriminating`, `screenshot` and `native-screenshot`. It
rejects non-object messages and unknown operations. It caps the corpus at
10000 records and every payload at 1 MiB, calling `limits.js`'s
`assertPayloadSize(estimatePayloadBytes(data))` before any decoding.
`limits.js` is pure transport policy, which keeps it testable in Node.

## State and failure behavior

There is no localStorage, IndexedDB, cookie or service worker. Mode lives only
in the DOM, and state lives in one tab; anything durable is an explicit
download. Invalid or empty input disables export. A legacy import replaces
source state only after parsing and validation succeed. The automatic
converter merges a partial CFG onto the current settings; the workbench
merges it onto the CFG defaults. New-build (2000914) cvars are rejected on
import with a dedicated message. Exported configs are cvar commands only
([ADR-0003](decisions/0003-export-cvars-not-share-codes.md)). If the worker
fails to start or breaks protocol, conversion is disabled.

## External contracts

These are the behaviours users and other tools can observe. Changing any of
them is a product change and needs a CHANGELOG entry.

- **Downloads.**
  - Automatic converter: `small-indie-crosshair.cfg`, plus
    `crosshair-quant-report.json` (schema `sicc-quant-report-v4`, model
    `version` `quant-static-v5`, `targetBuild`).
  - Workbench: `small-indie-candidate.cfg` and `small-indie-math-report.json`
    (`sicc-report-v1`).
  - Other routes: `crosshair-audit.json`, `small-indie-measurements.json`
    (`sicc-measurement-v1`) and `native-measurements.json`.
  - Reports carry model ids and schema ids. The `package.json` version
    appears only in `build-manifest.json`.
- **Imports.** Legacy v1 share codes, the allowlisted legacy CFG subset
  (at most 32 KiB), measurement JSON, and PNG screenshots.
- **Routes.** The six hash routes above, plus the notebook's
  `#chapter-N` anchors.
- **Published files.** Everything under the published roots (below),
  served from a repository subpath with no rewrite rules.

## Data, research and generated artifacts

- `data/` holds only what the app fetches: `presets.json`, `corpus.json`,
  `corpus-meta.json` and `quant-summary.json`. The last three are
  regenerated by `npm run research:quant` from `research/corpus/*.tsv` and
  the presets.
- `research/lib/` holds the research-only models: the learned
  inverse/forward emulator, learned shortlist ranker, sensitivity advisories,
  closed residual modulator, bounded modulation contract, behavioural
  partition and ridge regression. They may import `lib/`, but nothing in
  `app/` or `lib/` imports them
  ([ADR-0001](decisions/0001-learned-emulator-research-only.md),
  [ADR-0002](decisions/0002-speed-gate-closed-without-native-pairs.md),
  [ADR-0005](decisions/0005-layered-lib-and-research-isolation.md)).
- `research/scripts/` holds the pipelines: corpus build, quant study,
  audit, decision/structural/partition/discriminating studies, inverse
  certification, emulator and modulator training, benchmarks, and the Python
  archive reproduction `reproduce.py`. They write to `data/` or
  `research/generated/` only.
- `research/generated/` holds committed study outputs and research artifacts
  (`quant-emulator.json`, `quant-modulator.json`). Benchmarks with timing
  fields are dated records; rerunning one legitimately changes it.
- `research/archive/2026-09-23/` is the frozen reference implementation and
  its outputs, hash-pinned by `research/archive/SHA256SUMS` and byte-stable
  via `.gitattributes`. Never edit it.
- `docs/notebook.html` is generated from `docs/math/*.md` by
  `scripts/notebook.mjs` (run by `npm run build`).

CI runs `npm run verify` and then fails if `data/`, `research/generated/` or
`docs/notebook.html` differ from what is committed, or if new untracked output
appears under `data/`, `research/` or `docs/`.

## Build and deployment

`scripts/site-files.mjs` is the single definition of what is public: the
published top-level documents, the published root directories (`app`, `lib`,
`data`, `public`, `docs`, `research`, `licenses`), the private exception
`research/scripts/`, and filters for local and secret files. Both
`scripts/build.mjs` (which copies into `dist/`) and `scripts/http-policy.mjs`
(the dev/preview server allowlist) use it.

The build regenerates the notebook, copies the published files, and writes
`.nojekyll` and `build-manifest.json` (package version, research snapshot
date, per-file SHA-256). It uses no minifier, network access or installed
packages. Changing the automatic model or its default needs at least a minor
version bump. See [deployment](deployment.md) and
[GitHub Pages](github-pages.md) for hosting and headers.

## Enforcement

Mechanical checks, all run by `npm run verify`:

- `tests/tooling/boundaries.test.mjs`:
  - The shipped roots `app/main.js` and `app/worker/worker.js` reach no
    `research/` module.
  - Every `lib/` import respects the layer table above.
  - No `app/` or `lib/` file imports `research/`.
  - `lib/` and `research/lib/` use only relative specifiers and no
    DOM/worker globals.
- `scripts/check.mjs`:
  - Syntax-checks `app/`, `lib/`, `research/lib/`, `research/scripts/`,
    `scripts/` and `tests/`.
  - Rejects `eval`, `new Function` and `.innerHTML =` in shipped and
    research code.
  - Runs the line-length ratchet against `scripts/line-length-baseline.json`.
- `tests/tooling/docs.test.mjs` checks the CHANGELOG version and relative
  doc links. `tests/tooling/site-files.test.mjs` and
  `tests/tooling/server.test.mjs` check the publish list, headers and private
  paths.

## Where new code goes

- A new setting format or validation rule goes in `lib/settings/`.
- A pixel or geometry primitive used by more than one model goes in
  `lib/geometry/`.
- A change to the automatic converter goes in `lib/solver/`; a change to the
  manual lab goes in `lib/manual/`. If both need it, move it down a layer
  instead of importing sideways.
- DOM, canvas and worker code goes in `app/`, in the route's folder.
  Bundled data fetches go through `app/data.js`.
- Anything learned, experimental or offline goes in `research/`. It can
  reach the app only through a new ADR.
- Tests go in the `tests/` folder of the tree they protect.
