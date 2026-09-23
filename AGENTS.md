# Small Indie Crosshair Company — agent instructions

## Mission

Maintain a runnable local static crosshair generator and a mathematical research
record for the September 23, 2026 snapshot. Mathematical correctness, provenance,
reproducibility and honest uncertainty are first-class product requirements.
Read README and docs/README before changing the project.

## Evidence boundaries

- The old model is a community reconstruction, not a native Valve code disclosure.
- `quant-static-v5` and retained manual `conditional-static-v4` are hypothesis families, not proven new renderers.
- Native old/new captures included at release: **zero**. Do not invent evidence.
- Passing a synthetic or archived numerical test is not passing an in-game test.
- Only 8 of 138 pro records have observation dates. Preserve null dates/resolutions; do not call the records current.
- Do not mutate the frozen archive or its hash manifest. Log corrections separately.
- Keep the uncorroborated archived 720p website-reference claim out of conversion
  defaults. A website's coordinate convention is not the native authored height.

## Invariants

Preserve binary32 intermediate order in the legacy model, truncation toward zero,
the one-pixel minimum, literal-zero semantics, and thickness-dependent near/far
placement. New integer candidate policy is an implementation choice informed by
the UI, not proof that the console cannot accept any other values. Both sides,
visibility and ranges matter. Fitted affine pixel relations must not be quantized
or resolution-scaled a second time.

All output must identify its model and evidence level. Maintain raw ideal values,
legal candidates, residuals, blockers and warnings. Unknown code versions must
fail closed; never pass them to a legacy decoder and present the result as valid.
A measured fit is scoped and remains unverified; a height/width mismatch blocks
its continued use. An independent held-out observation must not be used to fit
the model against which it is reported as a holdout.

## Architecture and workflow

`lib/` has pure shared functions; `app/` is browser-only DOM orchestration.
Node's built-in tools suffice; do not turn this into a service or add auth,
analytics, packages, frameworks, remote images, remote fonts or persistence
without an explicit requirement. Import data with allowlists, never eval/HTML.
The local preview server is not a production internet-facing server.

For changes: inspect -> formulate falsifiable expectation -> implement narrowly
-> add tests -> update derivations/evolution -> reproduce -> browser check if UI
changed. Use `npm run verify`; optional browser harness is in testing.md. Do not
claim full HTTP browser verification when only in-memory DOM checks ran.

Do not touch user services, remote repos, deployment settings or publish evidence
without authorization. The user has requested a GitHub Pages deployment. The packaged workflow is authorized; actual publication still requires the correct remote/account and permissions. Do not claim a live page until the deployment succeeds.
Keep the joke in branding, not in correctness, error messages or fake statistics.

## Quant v4 invariants

A legacy corpus supplies coverage, not native outputs. Its rows, resolutions,
codes and duplicate geometries must not inflate new-renderer posterior mass.
Only scoped user-attested native calibration groups update model weights.
Synthetic observations and holdouts never fit the model. Preserve both edges
in native image measurements; never use a template that forces a tested
centering assumption to label native evidence. All-model failure is a useful
result. Do not erase it with normalized weights or an altered historical mask.

Every change to formula families updates the mathematical chapters and
versioned model IDs. Keep the default prior explicit and native correctness
probability unidentified absent a reviewed calibration procedure. The built
MathML notebook has a content-addressed formula cache; optional authoring
dependencies are not deployed or bundled.


## Quant v5 implementation invariants

- The integer geometry certificate belongs to the initialization tuple. Visual refinement
  and cross-scenario decision refinement have different, bounded objectives.
- Optimize automatic thickness/gap jointly; preserve both target inner edges and known
  literal-zero semantics. Manual measured calibration remains effective-width-scoped.
- Analytical union loss and dense illustration must agree on uncropped cells. Preserve
  measured image pixels independently; cropped evidence cannot claim exactness.
- Deduplicating candidate tuples never merges model-specific traces or provenance.
- Fixed robust noise hyperparameters are assumptions, not native-calibrated parameters.
- Canonicalize hash case, reject contradictory readings of a shared capture, preserve
  transitive groups, and prevent calibration/holdout leakage.
- Editing an image selection invalidates acceptance. Worker tasks are bounded and
  stale requests cannot silently resurrect exports. No production main-thread fallback.
