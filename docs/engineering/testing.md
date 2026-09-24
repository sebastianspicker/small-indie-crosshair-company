# Testing

Use Node.js 22.12+ and Python 3.10+. Normal verification has no package installation
or network dependency:

```sh
npm run verify
```

This runs JavaScript syntax checks, regenerates the corpus study, runs Node tests,
reproduces the frozen Python reference (which also rebuilds and compares the
audit), and builds `dist/` (regenerating `docs/notebook.html`).

Node tests live in the `tests/` folder of the tree they protect: `tests/lib/`,
`tests/app/`, `tests/research/` and `tests/tooling/` (layer boundaries, docs links,
publish list, server). `npm test` runs `node --test "tests/**/*.test.mjs"`; a single
folder runs with `node --test tests/lib/*.test.mjs`. Hand-written fixtures are in
`tests/fixtures/`; Python browser checks are in `tests/browser/`.
HTTP tests bind a loopback port. A restricted execution environment may need to
permit that before the full suite can run.

## What is checked

The Node suite covers binary32 arithmetic, inverse search, legal ranges, literal
zero, both inner edges, rendering, code/CFG parsing, measurement provenance,
calibration/holdout separation, worker queues, exports, and server responses.
Shape tests compare analytical unions against dense pixel masks. Inverse tests
compare selected values against finite-domain oracles. Certification tests check
the declared objective, the CVaR reference and the exhaustive oracle; preimage
tests compare complete equivalence classes against a reduced-box brute force;
partition and experiment tests recompute prediction partitions from `forward`;
ranker tests check shortlist determinism, exact verification and fail-closed
parsing; sensitivity tests check analytic margins and the fail-closed fragility
parser.

The Python reproduction checks the archive's hashes, runs its 21 checks, reproduces
its stored output, and compares 56 JS/Python cases. The larger study uses 135
eligible historical records at seven heights. These are numerical comparisons
against declared models, not executions of the CS2 renderer.

## Learned emulator

`tests/research/emulator.test.mjs` covers the dependency-free emulator artifact. It reads
the committed `research/generated/quant-emulator.json` once, checks that the fail-closed parser
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

## Certification, partition and capture studies

Four research-only scripts produce the versioned artifacts in
`research/generated/`. They are deterministic and offline; none of them runs CS2
or observes a capture:

```sh
npm run certify:inverse      # research/generated/inverse-certification.json
npm run study:decision       # research/generated/decision-study.json
npm run study:partition      # research/generated/model-partition.json
npm run study:discriminating # research/generated/discriminating-set.json
npm run bench:ranker         # research/generated/ranker-benchmark.json
```

- `tests/lib/certify.test.mjs` checks the declared objective (including a hand-built
  CVaR reference), the exhaustive oracle on a tiny window, and the certificate
  methods. `tests/lib/certification-runtime.test.mjs` checks the opt-in
  `infer({ certify: true })` path and that the default path makes no global
  claim.
- `tests/lib/preimage.test.mjs` checks `exactPreimage` against a reduced-box brute
  force, the pure-dot gap range and the literal-zero restriction.
- `tests/lib/decision.test.mjs` checks the `expected`/`worst`/`cvar` rules and the
  weighted CVaR helper.
- `tests/research/partition.test.mjs` and `tests/lib/experiments.test.mjs` check behavioural
  equivalence and the greedy `discriminatingSet` against recomputed partitions.
- `tests/research/ranker.test.mjs` checks the learned shortlist, exact `selectVerified`,
  `coverageAtK` / `compareToSolver`, and fail-closed parsing.
- `tests/research/sensitivity.test.mjs` checks analytic boundary margins and the fragility
  model parser.

Each artifact states its own scope and refuses to claim native accuracy: the
certificate is about the declared loss, the partition is over a finite sampled
domain, the discriminating set is a capture **plan**, and the ranker/fragility
layers distil the declared solver. The shell-monotone certificate is conditional
on a documented, spot-checked monotonicity assumption, not a proof. See
[chapter 11](../math/11-certified-inverse-and-capture-plan.md).

## Line length

`npm run check` enforces a 140-character line-length ratchet over `app/**/*.js`
and `lib/**/*.js`, using `scripts/line-length.mjs` and the committed
`scripts/line-length-baseline.json`. A file may not gain long lines beyond its
recorded baseline count, and a new file with any long line fails immediately;
a file with fewer long lines than its baseline prints a hint instead of
failing. Regenerate the baseline after intentionally changing long-line counts
with `node scripts/check.mjs --update-line-baseline`; never edit the JSON file
by hand. `tests/tooling/line-length.test.mjs` covers the pure `countLongLines` and
`compareToBaseline` helpers directly.

## Browser checks

The optional harness uses Python Playwright and Chromium. Pillow supports the
manual lab's PNG fixture. Install these in a development environment, outside the
app's runtime dependencies:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install playwright pillow
.venv/bin/python -m playwright install chromium
.venv/bin/python tests/browser/quant_browser.py --output /tmp/sicc-quant-qa
.venv/bin/python tests/browser/browser_smoke.py --output /tmp/sicc-manual-qa
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
.venv/bin/python tests/browser/capture_tour.py
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
fidelity ceiling is recorded in `research/generated/quant-emulator.json`; see chapter 10.

The learned shortlist plus exact verification has its own honest comparison
against the exact solver:

```sh
npm run bench:ranker
```

It writes `research/generated/ranker-benchmark.json`, reports shortlist coverage,
the verified-vs-solver loss gap (including losses), the p50 speed ratio and the
advisory sensitivity layers. The artifact records the result as
`NEGATIVE (fidelity)` because coverage is not 100%; see chapter 10. The committed
prediction-only `bench:emulator` figure predates the current artifact's capacity
revision, so re-run it before quoting it.

This times the inference core in Node. Compare runs on the same machine, with the
same inputs and warmup. It does not measure browser responsiveness or game FPS.
The historical comparison scripts accept a separate baseline checkout:

```sh
node research/scripts/benchmark-compare.mjs /path/to/baseline
node research/scripts/compare-inverse.mjs /path/to/baseline
```

CI runs `npm run verify` on Node.js 22 and 24 for pushes and pull requests. Browser
checks are optional and described above. No automated check here runs CS2; preview
agreement only describes the selected mathematical model.

## In CI

The `verify` job runs `npm run verify` on Node.js 22 and 24, then checks that
`research/generated/`, `data/` and `docs/notebook.html` are unchanged, and that
`data/`, `research/` and `docs/` have no new untracked files after that run (`git diff --exit-code` plus `git status --porcelain`). A red
result there means a generated artifact drifted from what is committed; run
`npm run verify` locally, review the diff, and commit the regenerated files.

The `browser` job installs Playwright and Chromium and runs
`tests/browser/browser_smoke.py` and `tests/browser/quant_browser.py` against `node
scripts/serve.mjs` (each script starts and stops its own server). It is
currently `continue-on-error: true` while it proves out on `main`; make it
required after 10 consecutive green runs. On failure it uploads the scripts'
screenshots and result JSON as a workflow artifact.
