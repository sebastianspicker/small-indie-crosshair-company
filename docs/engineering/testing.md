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

## Learned emulator

`tests/emulator.test.mjs` covers the dependency-free emulator artifact. It reads
the committed `data/quant-emulator.json` once, checks that the fail-closed parser
rejects a wrong schema/version/feature order/bounds, verifies the canonical
fingerprint, checks that prediction is deterministic and stays inside the native
domain, and checks that the committed model beats the naive baseline on fresh
solver labels. The forward-surrogate tests assert that the stored and fresh
held-out mean absolute errors stay below one pixel.

The artifact is regenerated offline by:

```sh
npm run emulator:train
```

Training is deterministic: fixed seeds, sorted and seeded subsampling, and no
clock or `Math.random` in the artifact. Re-running it should reproduce the same
fingerprint. Every number it reports is **solver fidelity** — how well the model
reproduces the declared automatic solver — and **not** game accuracy. The
project ships zero native capture pairs, so no native accuracy test exists and
the artifact records `speedGate: "closed-not-exact-equivalent"`. A passing
emulator test therefore says the learned model matches our equations, not CS2.

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

The [paired benchmark](../../research/generated/solver-polish-benchmark.json) compares five alternating runs against the supplied v0.3.0 source archive.

The research-only learned emulator has its own reproducible comparison against the
exact core on identical samples:

```sh
npm run bench:emulator
```

It reports speed only. The learned model is not on the runtime path and its
fidelity ceiling is recorded in `data/quant-emulator.json`; see chapter 10.

This times the inference core in Node. Compare runs on the same machine, with the
same inputs and warmup. It does not measure browser responsiveness or game FPS.
The historical comparison scripts accept a separate baseline checkout:

```sh
node scripts/benchmark-compare.mjs /path/to/baseline
node scripts/compare-inverse.mjs /path/to/baseline
```

CI runs `npm run verify` on Node.js 22 and 24 for pushes and pull requests. Browser
checks are optional and described above. No automated check here runs CS2; preview
agreement only describes the selected mathematical model.
