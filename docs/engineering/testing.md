# Testing

Use Node.js 22.12+ and Python 3.10+. Normal verification has no package installation
or network dependency:

```sh
npm run verify
```

This runs JavaScript syntax checks, regenerates the corpus study, runs Node tests,
rebuilds the audit, reproduces the frozen Python reference, and builds `dist/`.
HTTP tests bind a loopback port. A restricted execution environment may need to
permit that before the full suite can run.

## What is checked

The Node suite covers binary32 arithmetic, inverse search, legal ranges, literal
zero, both inner edges, rendering, code/CFG parsing, measurement provenance,
calibration/holdout separation, worker queues, exports, and server responses.
Shape tests compare analytical unions against dense pixel masks. Inverse tests
compare selected values against finite-domain oracles.

The Python reproduction checks the archive's hashes, runs its 21 checks, reproduces
its stored output, and compares 56 JS/Python cases. The larger study uses 135
eligible historical records at seven heights. These are numerical comparisons
against declared models, not executions of the CS2 renderer.

## Browser checks

The optional harness uses Python Playwright and Chromium. Pillow supports the
manual lab's PNG fixture. Install these in a development environment, outside the
app's runtime dependencies:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install playwright pillow
.venv/bin/python -m playwright install chromium
.venv/bin/python tests/quant_browser.py --output /tmp/sicc-quant-qa
.venv/bin/python tests/browser_smoke.py --output /tmp/sicc-manual-qa
```

Both scripts start a local server. Normal mode uses HTTP, the production module
worker, and browser WebCrypto. The converter suite covers imports, model selection,
resolution changes, export, source search, image selection, synthetic evidence,
and layouts at 390, 768, and 1440 pixels. The manual suite covers the retained editor,
calibration, and original audit. Results and screenshots go to the output directory.

The scripts also support `--in-memory` for environments that block browser
navigation. That mode mounts local sources and substitutes worker transport and
hashing. It checks DOM behavior only; it does not establish HTTP delivery, CSP,
browser-worker startup, or secure-context behavior. Earlier release records used
this mode and must be read with that limitation.

## Refresh the README tour

Start `npm run dev`, then in another terminal:

```sh
.venv/bin/python tests/capture_tour.py
```

This captures the converter, settings table, notebook, and mobile view into
`docs/screenshots/`. It uses actual HTTP and the production browser worker, rejects
page/console errors and external requests, checks mobile overflow, and exercises
settings search. All preview pixels come from the bundled models. The screenshots
are not game evidence.

Use `--base-url https://OWNER.github.io/REPO/` to capture a deployed demo, or
`--output /tmp/sicc-tour` for temporary review images. Review screenshots before
committing them; do not include personal imported files or measurements.

## Performance

```sh
npm run bench:quant
```

The [paired polish benchmark](../../research/generated/solver-polish-benchmark.json) records five alternating baseline/final runs against the supplied v0.3.0 ZIP: median core time fell from 2.030 ms to 1.376 ms on the recorded machine.

This times the inference core in Node. Compare runs on the same machine, with the
same inputs and warmup. It does not measure browser responsiveness or game FPS.
The historical comparison scripts accept a separate baseline checkout:

```sh
node scripts/benchmark-compare.mjs /path/to/baseline
node scripts/compare-inverse.mjs /path/to/baseline
```

## Release records

Keep past results as records of the code and environment they tested:

| Record | Scope |
| --- | --- |
| [Current polish checks](polish-verification.json) | 212 Node tests; 48 converter and 37 manual checks over HTTP, plus the local Pages subpath |
| [Original verification](verification.json) | Initial manual lab and archive |
| [Quantitative extension](quant-verification.json) | v0.2 corpus and automatic converter |
| [v0.3 verification](v0.3-verification.json) | Joint solver and evidence integrity changes |

Current changes require a fresh run. A local pass does not establish that GitHub
Actions or Pages has run. Native old/new game captures, a full accessibility audit,
and a multi-browser compatibility matrix remain outside these checks.

## Even-width alignment follow-up

`illustrative-parity-v2` removes the extra right/bottom pixel for even integer
widths. Literal-mask regressions cover symmetry, analytical/dense agreement,
asymmetric uploaded pixels, and independent calibration/holdout edges. The 48
converter and 37 manual browser checks pass over HTTP. A focused Chromium check
also verified all three canvases have mirror symmetry at 1×, 6×, and 16× zoom.
README screenshots were refreshed. These checks concern the illustrative renderer,
not native CS2 validation. The earlier polish timings and counts remain historical
records for the prior placement convention.
