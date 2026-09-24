# Maintenance plan — guardrails, CI and docs

> Archived. Implemented in 0.4.0; file paths below predate the repository
> reorganization. The current layout is in [architecture](../architecture.md).

**Status:** implemented 2026-09-24 (uncommitted at time of writing); see
"Outcome" at the end. **Written:** 2026-09-24 against `00c5eb8`
(package version 0.3.0, automatic model `authored:trunc:thickness`, build 2000914).
**Scope:** engineering hygiene only. No phase changes conversion behavior,
the 27-model grid, `data/`, or `research/archive/`.

**Audience:** a coding agent or maintainer following this file phase by phase.
Each phase is independently mergeable. Stop at the end of a phase if its
done-check fails, and paste the failure verbatim.

## 0. Hard stops

1. Do not edit `research/archive/` or its `SHA256SUMS`.
2. Do not hand-edit `data/` or `research/generated/`; regenerate with scripts.
3. Do not add runtime dependencies. Phase 4 is the only phase that may add a
   *dev-only* tool, and only after the user approves it.
4. Do not change `lib/geometry/legacy.js` geometry, solver outputs or model defaults.
   Reformatting in phase 4 must be behavior-preserving (tests unchanged).

## Findings this plan acts on

| # | Finding | Evidence |
|---|---------|----------|
| F1 | "The emulator never ships" is enforced only by prose. | `research/lib/ranker.js:16` imports `emulator.js`; nothing stops `app/` importing `ranker.js`. |
| F2 | "`lib/` stays pure" has no check. | `scripts/check.mjs` only runs `node --check` plus an `innerHTML`/`eval` regex. |
| F3 | CI checks drift in `research/generated/` but not `data/`, although `verify` regenerates `data/` via `research:quant`. | `.github/workflows/check.yml`, last step. |
| F4 | Browser checks never run in CI. | `tests/browser_smoke.py`, `tests/quant_browser.py` import Playwright; no workflow calls them. |
| F5 | `.agents/handoff.md` is described as git-ignored, but `.gitignore` has no `.agents/` entry. | `.gitignore`; AGENTS.md "Handoff". |
| F6 | Two architecture documents disagree; the docs index links the old one. | `docs/README.md:18` links `v0.3-architecture.md`; `architecture.md` does not mention `lib/quant/`. |
| F7 | Version drift. | `package.json` and `CHANGELOG.md` say 0.3.0, but the v0.4 plan is implemented and the default model changed in `00c5eb8`. |
| F8 | No type checking; some modules are hard to review. | No JSDoc types or `@ts-check` in `lib/` or `app/`; `app/main.js` has 259-character lines holding several statements. |

**Dropped from the first review:**

- *Strip emulator JSON from `dist/`.* The site intentionally publishes the
  research record, and `docs/notebook.html` chapter 10 documents
  `data/quant-emulator.json`. Nothing fetches it at runtime, so publishing it
  is correct.
- *Shipped vs research model registry.* The 27 models are the full
  `SCALES × ROUNDING × GAPS` grid in `lib/solver/renderer.js:10`. They are all
  hypotheses of the same kind, so there is nothing to split.

## Phase 1 — Boundary tests (F1, F2, F5)

No dependencies. This phase gives the most protection for the least work.

1. Add `tests/boundaries.test.mjs` with a small import-graph walker:
   - Roots: `app/main.js`, `app/quant-worker.js`.
   - Edges: static `import … from './x.js'`, `export … from './x.js'`, dynamic
     `import('./x.js')` with a string literal, and
     `new URL('./x.js', import.meta.url)`, which is how the worker is created
     (`app/worker-client.js:3`).
   - Fail on any dynamic `import(` whose argument is not a string literal, so
     the graph cannot silently go incomplete.
2. Test **shipped path excludes learned artifacts**. None of these modules
   may be reachable: `research/lib/emulator.js`, `ranker.js`, `sensitivity.js`,
   `modulator.js`. As of `00c5eb8` none of them are, so the test should pass
   on first run. If it doesn't, stop and report; don't "fix" app code.
3. Test **lib purity**. For every `lib/**/*.js`:
   - no import resolves into `app/`;
   - no bare (package) specifiers;
   - no DOM or worker globals: `document`, `window.`, `self.`,
     `postMessage`, `localStorage`, `fetch(`.

   Match on tokens, not substrings. A local named `window` exists at
   `lib/solver/certify.js:32`, so check for member access on a *global*
   `window` by rejecting it only when no local binding named `window` is
   declared in the file. Alternatively, keep an explicit allowlist with a
   comment.
4. Add a reachability snapshot. Record the sorted list of `lib/` modules
   reachable from the roots in the test itself. A module entering or leaving
   the shipped path then shows up as an explicit test diff in review.
5. Add `.agents/` to `.gitignore` under a "Local agent coordination" heading.
6. Move the learned modules to `lib/research/` (**optional, separate
   commit**). This touches `ranker.js`, `emulator.js`, `sensitivity.js`,
   `modulator.js`, their tests, `scripts/train-*.mjs`, `scripts/benchmark-*.mjs`
   and doc links (`docs/notebook.html`, `docs/math/10-*.md`). Do it only if
   the user wants location to match status. The test in step 2 already gives
   the guarantee.

**Regression coverage:** a fixture test that feeds the walker a synthetic
graph containing a forbidden edge, a non-literal `import()`, and a
`new URL` worker edge, and asserts each is detected.

**Done:** `npm test` and `npm run check` exit 0.

## Phase 2 — CI drift and browser checks (F3, F4)

1. In `.github/workflows/check.yml`, widen the last step to
   `git diff --exit-code -- research/generated/ data/`, and add
   `git status --porcelain -- data research` so new untracked output also
   fails. Run it once locally first. If `verify` is not byte-deterministic
   on `data/` (timestamps, float formatting), fix the generator, not the check.
2. Add a separate job, `browser`, in `check.yml`:
   - `needs: verify`, Ubuntu, Python 3.12, and
     `pip install playwright==<pinned>` followed by
     `python -m playwright install --with-deps chromium`.
   - Run `python3 tests/browser_smoke.py` and `python3 tests/quant_browser.py`
     against `npm run preview` (read `docs/engineering/testing.md` for the
     exact server flags each script expects).
   - Upload screenshots or traces on failure with `actions/upload-artifact`,
     pinned by SHA like the other actions.
   - Start with `continue-on-error: true`. Make it required after 10 green
     runs on `main`.
3. Keep `npm run verify` free of Playwright. The browser job is additive and
   is the only place a Python package is installed.
4. `pages.yml` already runs `verify`. Don't make deploy wait on the browser
   job until that job is required.

**Done:** both jobs green on a PR; a deliberately stale `data/` file makes
`verify` fail (then revert it).

## Phase 3 — Docs and versioning (F6, F7)

1. Make `docs/engineering/architecture.md` the single current architecture
   document:
   - Merge in the still-true parts of `v0.3-architecture.md` and
     `quant-architecture.md`.
   - Add the `lib/quant/` ownership map: solver path vs research-only modules,
     citing the phase 1 test as the enforcement.
   - Add the worker boundary (`worker-client.js` → `quant-worker.js`,
     `worker-limits.js`).
2. Move `v0.3-architecture.md`, `quant-architecture.md` and
   `v0.4-conversion-improvement-plan.md` to `docs/engineering/archive/`, each
   with a one-line "superseded by / implemented in" header. Update every link:
   `grep -rn` across `docs/`, `README.md`, `docs/notebook.html` and `app/`
   (`app/research.js` links docs). If the build's notebook generator
   (`scripts/notebook.mjs`) embeds these paths, regenerate rather than edit.
3. Add `docs/engineering/decisions/` with short ADRs (context, decision,
   consequence, ≤ 1 page each) for decisions that currently live inside
   plans:
   - 0001 learned emulator is research-only;
   - 0002 speed gate stays `closed-no-native-pairs`;
   - 0003 export cvars only, never guess a post-update share-code layout;
   - 0004 no runtime dependencies or persistence.

   Link them from AGENTS.md "Key rules" instead of restating the rules.
4. Versioning: bump to **0.4.0** in `package.json` with a CHANGELOG entry
   naming the default model change (`authored:trunc:thickness`). Add a rule to
   AGENTS.md: *a change to the automatic model or its default is at least a
   minor version bump*, because `build-manifest.json` and exported reports
   carry the version. Add a test that the CHANGELOG's top version equals
   `package.json`'s.
5. Update `docs/README.md` to link only the current architecture, testing,
   deployment, decisions and this plan.

**Done:** `npm run verify` exits 0; a link check finds no references to
moved files (reuse or extend `scripts/audit.mjs` if it already scans links,
otherwise add a small test).

## Phase 4 — Types and readability (F8) — needs user approval

This phase trades a strict reading of "no npm dependencies" for static
checking. **Ask the user before starting.** Two options:

- **A (recommended): dev-only TypeScript, never shipped.** Add
  `typescript` as a pinned `devDependency` and a root `jsconfig.json` with
  `checkJs`, `strict`, `noEmit`, including only `lib/`. Add
  `npm run typecheck` and run it in CI after `npm ci`. Keep `verify`
  install-free by making typecheck its own CI step, not part of `verify`.
- **B: no tool.** Add JSDoc types anyway (they document units, integer vs
  float, and ranges), and extend `scripts/check.mjs` with a max line length
  and one-statement-per-line rule for `app/` and `lib/`.

Either way:

1. Annotate in order: `lib/geometry/legacy.js`, `lib/manual/conversion.js`,
   `lib/geometry/pixel-shape.js`, `lib/solver/renderer.js`, `lib/solver/inverse.js`.
   Record units and integer/float intent in typedefs
   (`/** @typedef {number} Px */`).
2. Reformat `app/main.js` and `scripts/check.mjs` to one statement per line,
   as a separate commit with no logic change (tests must pass unchanged).
3. Add a max line length (e.g. 140) to `check.mjs` for `app/` and `lib/`,
   with an allowlist for generated files.

**Done:** `npm run verify` exits 0 (plus `npm run typecheck` for option A).

## Phase 5 — Agent workflow

1. Add `.claude/settings.json` with a `Stop` hook running
   `npm run check && npm test`. This is fast feedback, not full `verify`, which
   regenerates data and runs Python. Document the Codex equivalent in
   AGENTS.md if Codex supports one.
2. Add `.agents/handoff.template.md` (tracked) with the AGENTS.md fields:
   status, date, goal, files changed, checks with exit codes, open
   questions. Point AGENTS.md at it.
3. Add a "Guardrails" line to AGENTS.md listing the tests that enforce its
   rules (`tests/boundaries.test.mjs`, the CI drift check), so reviewers
   know which rules the machine checks and which they must check by eye.

**Done:** a session ending with a broken test is blocked by the hook.

## Order and effort

| Phase | Effort | Depends on | Risk |
|-------|--------|------------|------|
| 1 Boundary tests | ~0.5 day | none | low |
| 2 CI drift + browser | ~0.5 day | none | medium (determinism, Playwright flakiness) |
| 3 Docs + version | ~0.5 day | 1 (cites the test) | low |
| 4 Types + readability | 1–2 days | user decision | low if reformat is kept separate |
| 5 Agent workflow | ~1 hour | 1 | low |

Phases 1, 2 and 5 are independent and can run in parallel worktrees.
Phase 3 should follow phase 1.

## Outcome

Decisions taken for the open questions:

1. **Learned modules stay in `lib/quant/`.** `tests/boundaries.test.mjs`
   gives the guarantee; moving them would churn links across the notebook
   and math docs for no extra protection.
2. **Phase 4 option B (no tool).** "No npm dependencies" is a standing rule
   ([ADR 0004](../decisions/0004-no-runtime-dependencies-or-persistence.md)).
   The 140-character limit is a ratchet
   (`scripts/line-length-baseline.json`, regenerated with
   `node scripts/check.mjs --update-line-baseline`), not a mass reformat of
   the roughly 295 existing long lines.
3. **Version 0.4.0**, with the former "Unreleased" CHANGELOG section
   converted.

Deviations from the steps above:

- Phase 5: agent coordination files are kept out of the public tree, matching
  the existing setup. The Stop hook lives in `.claude/settings.local.json`,
  and the handoff template in `.agents/`; both paths are git-ignored.
  `tests/docs.test.mjs` checks `AGENTS.md` only when it is present.
- Phase 2: the browser job passed locally on macOS (36/36 and 51/51
  checks). The Ubuntu `--with-deps` install is unproven until the first CI
  run.
