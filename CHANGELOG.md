# Changelog

## Unreleased

## 0.11.0 — 2026-10-02

- Advance to `community-static-v5`: tied shapes are ranked by pixel
  overlap maximised over whole-shape shifts of at most 1 px, then plain overlap,
  then the canonical order, so the odd-width centring shift no longer decides
  ties. 74 of 1,755 corpus record-scope rows (48 records) change, all at cross
  heights; equal-height exports and the 24 crosshair.club tuples are unchanged.
  Example: ZywOo 1.5/0/-3 at 720 → 1080 (authored 960) now exports 3/1/3, not
  3/2/2. Reports add `tieBreak.ranking` and aligned scores; `searchPolicy` is
  `finite-dimension-ties-v4`.
- Old styles 2, 3 and 5 now export `cl_crosshairstyle 4` by default: the old
  source draws them exactly like style 4 at rest (weapon_csbase.cpp L2002-2050).
  They warn `style-dynamic-at-rest` and the "What changed" style row is
  `approximated`. Old styles 0 and 1 and the weapon gap stay blocked. This
  applies to the automatic, historical and manual paths; the family option is
  unchanged.
- Report schema bumped to `sicc-quant-report-v6` (contract change): reports
  carry `clamped[]`, `options {outlineMode, styleTarget}` and, in `settings`,
  `outline_width_rounded`.
- Old share-code colour indexes 6 and 7 convert with the stored RGB and the
  warning `color-index-unknown` instead of failing (corpus pro-064).
- Old outline widths 2 and 3 warn `outline-width-reduced` and are listed in
  `report.clamped`; unequal widths keep `outline-asymmetric-approx`.
- Regression tests pin binary32 old arithmetic and the thickness-32 inner-edge clamp.
- Simple view "What changed" table with a status per setting (converted,
  approximated, assumed, dropped, ignored, user-choice) and its reason, also in
  the expert lab; stacked rows on narrow screens.
- Per-value confidence chips, a plain-text warnings list, a limits line next to
  Copy/Download, the checked build (2000922, convar dump 2026-10-01), a "save
  your current crosshair first" hint and a short import status.
- Pure `lib/settings/outcomes.js` (`settingOutcomes`, `confidenceLabel`).
- Opt-in export options: outline mode (Auto/None/Full/Half) and style target
  (Static Cross by default; "Keep old style family (experimental)" maps old
  2/3 → 2 and 5 → 5). They warn `outline-user-override` and
  `style-family-experimental` and are recorded in `report.options`; the manual
  lab gets the outline select.
- A pasted current `CS…` share code (read-only decoder) is explained
  as already using the new settings, with its values listed; not an error.
- Specific share-code errors (format, characters, length, overflow, checksum,
  version); `CSGO-` version-3 codes get a new-format message.
- Style labels follow the 2000922 UI.
- Historical models report `outline-only-legacy`; new
  `outline-asymmetric-approx`; `report.clamped` lists clamped or approximated
  outputs.
- Shared raster arm placement, checked per pixel against a reference.
- New regression tests cover the export contract (screen height last, allowlisted
  lines, legacy gap -5 → 3) and a 2000922 range snapshot.
- Research: export-state learner (`research/generated/export-emulator.json`); cross-tool baselines (JDD310, cursed, Horizzon1,
  crosshairrestore); gap-origin sensitivity (floor versus ceil changes 388 of
  945 corpus rows); outline mask evaluation; tie-break audit; capture protocol
  2026-10-02 with a calibration harness (research tooling, not
  published; the issue #11 screenshot matches the old outline
  model exactly at a +3 px x offset); the old-client observation; research note
  addendum and source ledger S12–S14.
- Learners labelled by the public solver are retrained on v5 labels (accuracy
  889, structured 835 and export 882 labels change); the frozen v2 distillation
  is unchanged. The conversion-accuracy study now guards aligned overlap.
- Third-party notice for cursed-crosshair-generator (MIT).
- Fixed after review:
  - Outline warnings and `clamped` follow the exported outline mode, including the export override; one shared
    `outlineWarnings` helper serves the community and historical reports, so the hedge path now also emits
    `outline-sharecode-rounded`, `outline-half-mapping` and `outline-alpha-unverified`.
  - What-changed outcomes and confidence chips read `report.clamped` (hedge size 400, gap 200, gap -10 are approximated).
  - `clamped` lists thickness 0 only if the export differs; historical models are judged against build 2000914 (0..31).
  - The CFG parser accepts only `crosshair` and `cl_*` names and uses own-property lookup (`constructor`, `__proto__` rejected).
  - A `CS` code whose payload starts with `GO` is read as a current share code.
  - `encodeLegacy` accepts colour indexes 6 and 7; the lab's copy note explains the 0.5-step outline width.
  - The conversion-accuracy study records the raw-IoU regression (96 cases, worst 0.471) and fails if it grows; the
    tie-search regression test uses an independent raw-mask shift oracle.

## 0.10.0 — 2026-10-02

- Outline opacity: the old outline used the crosshair opacity (cstrike15
  `DrawCrosshairRect`, confirmed by a user screenshot), so exports now write
  `cl_crosshairoutline_a` as the old crosshair opacity instead of 255 whenever the
  outline is on. This changes the exported values of every outlined crosshair. The
  `outline-alpha-unverified` warning now states that, if 2000922 also multiplies the
  outline by `cl_crosshaircolor_a`, it will be lighter (unverified).
- Outline geometry: the old outline rect grows by ceil(t) on the left/top and floor(t)
  on the right/bottom. `lib/geometry/raster.js` gains `outlineRectangles`,
  `outlineRaster` and `outlineOnly`, and the previews draw the outline in black at the
  crosshair alpha beneath the core (new outline assumed). The core-shape objective,
  solver and model ids are unchanged. Outline-only crosshairs (size 0 with an
  outline) warn `outline-only-legacy` instead of `empty-geometry`.

- Share-code outline width 0 (issue #11): old share codes store
  `cl_crosshair_outlinethickness` in 0.5 steps, so an enabled outline with stored
  width 0 means any thickness below 0.5 and now exports `cl_crosshair_drawoutline 2`
  with the warning `outline-sharecode-rounded` instead of dropping the outline.
  A width of exactly 0 typed in a CFG still exports no outline. Decoded settings
  carry `outline_width_rounded`; a CFG that sets the thickness clears it.
- CFG import accepts `true`/`false` for boolean cvars and skips known non-shape
  cvars from a console `find crosshair` dump (grenade, ironsight, observer, sniper
  and the bare `crosshair`), listing each ignored name in the import status.
  Binds, exec, alias, unknown cvars and expressions are still rejected.

## 0.9.1 — 2026-10-01

- Map old outline widths to the new outline modes (issue #11): an enabled outline
  with `cl_crosshair_outlinethickness` below 1 exports `cl_crosshair_drawoutline 2`
  (Valve's half outline, which draws only the top-left edge), width 0 exports no
  outline, and 1 or more stays the full outline. Reports warn with
  `outline-half-mapping` or `outline-zero-width`; the mapping is not native-validated.
  Build 2000922 still has no outline-width cvar.
- Disclose outline opacity: old outlines used the crosshair opacity, while build
  2000922 has a separate `cl_crosshairoutline_a`. Exports keep 255 and warn with
  `outline-alpha-unverified` when an outlined crosshair is below full opacity.
- Old `cl_crosshairsize 0` stays zero-length arms (dot and outline preserved); the
  new integer `cl_crosshair_length` cannot express 0.3 and no evidence shows old
  size 0 drew a visible arm.

## 0.9.0 — 2026-10-01

- Advance to `community-static-v4` for CS2 build 2000922 (Valve's October 1
  crosshair update). Forward equations are unchanged from v3 and are an
  unverified carry-over across the renderer rewrite; no native capture pairs
  exist. Thickness search maximum is 32. Static Cross gaps stay 0..128 and
  an old gap that would need overlap (negative centre radius) clamps to 0 with the new warning `negative-gap-static-unverified`.
- Every CFG export now also emits `cl_crosshairoutline_r 0`, `_g 0`, `_b 0` and
  `_a 255`, pinning the legacy opaque black outline.
- Measurement intake rejects build 2000918 records; build 2000922 captures with a
  gap outside 0..128 are reported outside the model domain and excluded from holdouts.
  New-build cvar names, including outline colour, are rejected on legacy import.
- Retrain the accuracy and structured research learners on v4 labels (a regression
  re-run, not fresh holdout evidence): 1,152 of 15,360 labels change, all thickness
  31 → 32. Ranker test fidelity 98.50% (was 98.75%); quantization-aware accuracy
  learner 96.99% (was 97.29%). The frozen v2 distillation and historical models
  are unchanged.
- Document the build, shader diff, decisions and a native capture protocol in the
  [build 2000922 note](docs/research/build-2000922-update-2026-10-01.md).

## 0.8.0 — 2026-09-29

- Preserve `community-static-v3` results while replacing exhaustive dimension
  scans with monotone plateau search: 94.4% fewer axis evaluations on 15,360 cases.
- Add a research-only structured candidate ranker and constrained residual decoder.
  On 400 fresh setting groups, ranker test fidelity is 98.75%; interior/exterior
  challenges reach 84.22%/96.02%. Same-data residual baselines are
  97.33%/66.02%/80.63%. Record canonical and frozen baselines, paired regressions,
  calibration abstention and limitations in the
  [structured-learning study](docs/research/structured-learning-2026-09-29.md).
- Optimize boosted-tree training with local feature orders and shared sorting,
  preserving existing model artifact bytes. Record successful development retraining and independent exact axis/candidate
  parity checks.

## 0.7.0 — 2026-09-29

- Advance to `community-static-v3`: compare all equally accurate rendered lengths
  and widths, recompute parity-specific radius choices, and select exact overlap.
  Preserve canonical cvars when overlap ties. Across 8,640 synthetic cases,
  750 improve and none regress; 24 frozen external comparisons remain unchanged.
- Add quantization-aware research features and 400 new setting groups. With the
  same v3 labels, test tuple fidelity improves from 96.31% to 97.29%; interior
  and exterior challenge fidelity improve to 73.91% and 77.66%. Keep exact
  runtime inference, group-disjoint fitting/calibration and support abstention.
- Freeze v2 labels and artifacts. Document correction/re-evaluation history,
  selective interval coverage and native-evidence limits in the
  [accuracy report](docs/research/accuracy-improvements-2026-09-29.md).

## 0.6.0 — 2026-09-29

- Audit old, first-redesign and newest public dumps: build 2000919 retains the
  crosshair inventory inspected at 2000918. Document verified changes and the
  limits of metadata evidence in the [audit](docs/research/converter-audit-2026-09-29.md).
- Advance to `community-static-v2`: resolve equal-radius-loss gaps by exact shape
  overlap while preserving bar dimensions. Retain all 24 frozen external tuples.
  Report residuals, ambiguity and grouped current-build holdout validation.
- Fix overlapping-arm image ranking with exhaustive exact union scoring, support
  signed near edges and white auto-detection, and round-trip screenshot settings
  through half-even geometry. Block cropped/unstable captures and native dot/T mismatches.
- Add research-only boosted residual learning, a separate calibration partition,
  cluster stability intervals and unseen fraction/resolution challenges. Same-test
  tuple fidelity improves from 87.05% to 93.90%; shifted-input fidelity is 72.66%,
  below the analytic baseline's 80.12%. Learned models remain outside runtime.

## 0.5.0 — 2026-09-28

- Replace the automatic default with a source-labelled static reconstruction:
  round-to-even old dimensions, centre-based new gap, positive visible minimum,
  authored-height rescaling and explicit odd-width pixel placement. Target the
  inspected build 2000918; retain historical and manual models separately.
- Reduce visible renderer choices to six. Compare 24 recorded crosshair.club
  outputs, including twelve later holdout queries: 24/24 tuple agreement versus
  0/24 for the former authored/trunc/thickness hypothesis. This is external
  software agreement, not native game validation.
- Fix screen-relative parity, measured-target preimages, restricted-domain
  certificates and historical search plateaus. Reports advance to v5.
- Measure odd-width transverse placement independently and retain build-scoped
  capture evidence across renderer switches.
- Record a research-only ML ablation: geometry and authored-height
  features improve same-test synthetic tuple fidelity from 29.17% to 90.48%.
  The exact converter remains the runtime path. See the
  [audit](docs/research/converter-audit-2026-09-28.md).

- Redesign the interface as an "inspection sheet":
  - token-driven light and dark themes;
  - self-hosted Archivo and Martian Mono under the OFL;
  - sheet-numbered navigation and title blocks;
  - a Simple view that puts the answer (dimensioned before/after plates at an
    auto-fitted magnification, three readout values and the console lines as
    text) beside the inputs.
- The CSP changes from `font-src 'none'` to `font-src 'self'`, and the dev
  server serves `.woff2`.
- Keep the mobile Simple flow in DOM order, preserve the manual preview's pixel
  aspect ratio, and clear stale announced results.
- The interface redesign retains routes and element IDs; conversion changes
  in this release are described above.

## 0.4.0 — 2026-09-24

- Reorganize the product source by responsibility: `lib/` becomes the layered
  `settings`, `geometry`, `image`, `solver` and `manual` tree, while `app/` is
  grouped by route and worker boundary. Conversion results, exports and routes
  are unchanged.
- Published paths under `lib/` and `app/` change. `data/quant-emulator.json` and
  `data/quant-modulator.json` move to `research/generated/`; `data/reference-audit.json`
  is removed (it duplicated `research/archive/2026-09-23/results.json` and had no reader).
- Share one quantizer and one legacy-text import dispatch between the two conversion
  models; the build and dev server share one publish list; CI also checks
  `docs/notebook.html` for drift.

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
- Add a dependency-free learned-emulator research artifact.
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
- Add `lib/cvar-inventory.js`, a frozen data table for the build 2000914 crosshair
  cvars, styles, hidden leftovers and removed names, plus `NATIVE_RANGES` in
  `lib/native-settings.js` as the one source of the export ranges.
- Add an explicit gap-scale rival
  (`same-as-length` vs `unscaled`) and named `pixelCopy` / `rename` candidates. The
  24-hypothesis structural family is offline only; the
  default `infer()` tuple, `quant-static-v5` and the 27-model worker search are
  unchanged.
- Record a closed residual-modulation study. It returns a zero delta with reason
  `closed-no-native-pairs`, is not imported by inference, and its gate cannot open
  in v1 because no reviewed-registry provenance value is defined.
- Warn on every automatic report that build 2000914 does not state gap scaling, and
  surface an unscaled-gap rival note in the Simple and Expert views. Lock the default
  tuple for the size-2 fixture.
- Harden imports and exports: reject new-build cvars in the legacy CFG importer with a
  dedicated message, test that exports never emit removed or hidden legacy commands,
  cap worker payloads at 1 MiB, and scan `lib/` as well as `app/` for `eval`,
  `new Function` and `.innerHTML =` assignment.
- Point the shipped inverse at `NATIVE_RANGES` so cvar bounds cannot drift from the
  export validator; the default tuple is unchanged.
- Let the Expert view list the rename, pixel-copy and unscaled structural rivals as
  read-only rows; none of them replaces `infer().chosen`.
- Record a pure modulation contract that rejects any delta with a component
  outside ±2 and any delta that increases geometry loss; it has no weights and
  is not imported by inference.
- Default the automatic conversion to the authored pixel-exact model
  `authored:trunc:thickness` (`resolveModelChoice`) when there is no measurement
  evidence and no explicit request, instead of the weighted 27-model hedge; published
  post-update pro settings match that model's own inverse, while the weighted hedge
  shifts the length by one in 88 of 137 static corpus records. The weighted hedge
  (`weighted-hedge`) remains available by name or once evidence exists. This is an
  application default only: `infer()`, the bounded search, the declared losses,
  `NATIVE_RANGES`, `legacyGeometry` and the trained artifacts are unchanged.
- Consolidate public architecture documentation into the current
  `docs/engineering/architecture.md`.

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
- Added a pinned GitHub Pages workflow; no hosted
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
