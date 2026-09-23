# Changelog

## Unreleased

- Correct even-width preview alignment while preserving measured image pixels.
- Keep the automatic search bounded and prefer the lower pixel error before applying
  tie-break rules.
- Cache repeated model lookups and remove duplicate input validation.
- Simplify the app and docs; add a reproducible README screenshot tour.
- Keep local files and credentials out of Git and the Pages build.
- Disclose when a positive legacy thickness resolves to the automatic zero-thickness
  branch instead of silently exporting `cl_crosshair_thickness 0`.
- Make **Simple** the default converter view (import, values, resolution, appearance,
  proposed values, two previews, copy/download) and move the full lab behind an
  **Advanced** Expert mode; mode is DOM-only with no persistence.
- Add a dependency-free learned-emulator research artifact (`npm run emulator:train`).
  It distills the declared solver on self-generated labels, records
  `speedGate: "closed-not-exact-equivalent"`, ships zero native evidence, and is
  not wired into the app or its Simple view.
- Raise the learned inverse to a depth-3 boosted-tree block over 26 declared
  features; held-out full-tuple fidelity rises from ~11.6% to ~35.7% (new artifact
  fingerprint `137061144`). Record honestly that the 7 added features were
  neutral-to-slightly-negative in ablation and the gain came from capacity.
- Add an opt-in certified-global expansion (`infer({ certify: true })`) for the
  declared decision loss; the default bounded search and its outputs are unchanged.
  Document the `shell-monotone` certificate as conditional on a documented,
  spot-checked (not proved) monotonicity assumption.
- Add the `cvar` decision rule alongside `expected` and `worst`, `decision.certificate`,
  and `exactPreimage` (complete integer equivalence classes, including empty
  classes and pure-dot plateaus); bump the research report schema to
  `sicc-quant-report-v4`.
- Add the learned-shortlist ranker (exact verification over the declared loss;
  coverage at K=32 is 84.8% and it lost to the solver on 13/125 samples, so it is
  not wired into inference) and the sensitivity layer (analytic boundary margins
  plus a weak learned classifier, 0.736 vs 0.704 majority).
- Add the model-family behavioural partition (27/27 distinct over a declared finite
  sample) and a two-design discriminating capture plan; both are synthetic and not
  native evidence.
- Add chapter 11 and the formula-history corrections C05 (bounded search is not
  globally optimal; opt-in certificate) and C06 (emulator capacity change,
  fingerprint move, ranker/sensitivity results). Version stays 0.3.0.

## 0.3.0 — 2026-09-23

- Rebuilt the quantitative view around actual values, pixel targets and assumptions.
- Joint finite-domain thickness/gap inversion and two-edge gap midpoint; certificates
  distinguish initialization geometry from subsequent bounded visual optimization.
- Exact full-domain cell-union overlap, geometry caching and aggregate-loss refinement;
  explicit expected-loss and worst-case policies.
- Robust declared likelihood mixture; canonical hashes and conflict-aware evidence;
  per-model trace provenance survives candidate deduplication.
- Bounded latest-only worker queue, hard failure/timeout cleanup, invalidated image
  acceptance after crop edits, and shared validated console-command formatting.
- Refactored monolithic inference, native image measurement and editor rendering into
  focused functions; ninth mathematical chapter and offline MathML reader.
- Target build, frozen historical arithmetic, corpus and zero-native-pair status unchanged.

## 0.2.0 — 2026-09-23

- Added 138 sourced records covering 106 players, 119 distinct codes and 50
  parameter geometry signatures; verified the 100-row archive transcription hash.
- Added 945 eligible record-height study cases, geometry-group cross-validation,
  a weighted ridge old-target surrogate, deterministic cluster-bootstrap intervals,
  and 336 unique geometry-height inversion cases per renderer family.
- Implemented 27 explicit renderer scenarios, bounded inverses, cached mask
  scoring, local visual refinement, cross-scenario candidate ranking, prior
  sensitivity and user-attested grouped native likelihood updates.
- Separated synthetic fits, input coverage, native calibration and held-out
  validation; no native correctness probability is fabricated.
- Added three-way previews, a module worker, lazy views, paginated corpus search,
  old-image template inference and independent native-component measurement.
- Added four mathematical chapters and a complete eight-chapter static-MathML
  notebook, preserving all original mathematical documentation and archive data.
- Added pinned GitHub Pages workflow and explicit publication helper; no hosted
  deployment is claimed without a successfully inspected real environment URL.

## 0.1.0 — 2026-09-23

Initial repository release.

- Runnable zero-dependency local static generator, legacy-v1 code/CFG imports,
  native candidate editing, CFG and mathematical report exports.
- Pinned old binary32 reconstruction, conditional new-model selection, bounded
  legal-candidate search, zero-branch preservation and explicit range residuals.
- Thickness-relative, center-relative and scoped affine gap hypotheses; selectable
  new rounding assumption; both near/far alignment tracked.
- Interactive notebook, quantization explorer, 56-case audit and extensive
  mathematical, historical and evidence documentation.
- Frozen original research, hashes, JS/Python parity and comparator regressions.
- Scoped calibration, residuals, synthetic-data provenance and local PNG inspection.
- Fail-closed unsupported style/weapon-gap handling, strict input validation,
  local server hardening and static build with a hash manifest.
- Added correction C01: the archived report of a site's 720p reference was not
  independently corroborated in the current parsed page. Retained as an archival
  report, not promoted into a native conversion rule.

No claim of native client validation, universal crosshair equivalence, dynamic
renderer implementation, outline fidelity or remotely published release.
