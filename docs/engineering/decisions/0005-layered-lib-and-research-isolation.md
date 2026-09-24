# 0005 — Layered `lib/`, research isolated by directory

**Source:** the 0.4.0 architecture reconstruction; see
[architecture](../architecture.md).

## Context

`lib/` had grown into a flat mix of setting formats, geometry, the manual
model and image analysis, plus `lib/quant/`, which held the shipped solver,
image analysis *and* the research-only learned models side by side. Several
problems followed from that layout:

- The only thing keeping research code out of the app was a test with a list
  of forbidden files and an exact 29-path snapshot.
- `lib/migration.js` depended on `lib/quant/`, and the solver imported the
  manual model for a colour helper.
- There were three copies of the quantizer and two import dispatchers.
- Four re-export facades added indirection without adding a boundary.
- `scripts/` mixed build tooling with research pipelines, and `data/` mixed
  runtime data with research artifacts.

## Decision

- `lib/` is split into five layers: `settings`, `geometry`, `image`,
  `solver` and `manual`. Each layer may import only itself and the layers
  below it in the table in [architecture](../architecture.md). The two
  conversion models (`solver`, `manual`) stay separate and never import each
  other; what they share is moved down into `settings` or `geometry`.
- Research code lives in `research/lib/`, and research pipelines live in
  `research/scripts/`. Nothing in `app/` or `lib/` may import `research/`.
  Isolation is now a property of the directory, not of a list.
- `scripts/` holds repository tooling only, and `data/` holds only files the
  app fetches.
- Build, serve and publish rules come from one list in
  `scripts/site-files.mjs`. `research/scripts/` is not published.

## Consequences

- `tests/tooling/boundaries.test.mjs` enforces the layer table for every
  `lib/` file. It also enforces that no `app/` or `lib/` file imports
  `research/`, and that neither shipped root (`app/main.js`,
  `app/worker/worker.js`) can reach `research/`. A new research module is
  covered automatically.
- Published URLs under `lib/` and `app/` changed in 0.4.0, and
  `data/reference-audit.json` was removed. It duplicated the archive's
  `results.json` and had no reader. Research artifacts moved from `data/` to
  `research/generated/`.
- Adding a sideways import, such as `solver` → `manual`, fails the tests.
  The fix is to move the shared piece down a layer, not to widen the table.
  Widening the table needs a superseding ADR.
