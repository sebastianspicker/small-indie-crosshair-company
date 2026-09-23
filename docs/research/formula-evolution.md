# Formula evolution and correction log

All stages below describe the same 2026-09-23 investigation. The labels are research
stages, **not** separate measured game updates. The original archive is immutable.
Repository refinements do not retroactively improve its evidence strength.

## v0 — A convenient global factor

**Proposal examined:** multiply legacy size/thickness by a fixed factor (especially two),
and possibly apply the same idea to gap.

**Why it looked plausible:** small pro crosshairs often sit in broad integer buckets.
Every one of the eight selected presets has the same computed arm length and thickness
at both 960p and 1080p in the source-derived old model. The factor-two shortcut agrees
on those dimensions for all eight at either of those heights.

**Why it is not universal:** the source-derived old scale is height/480. Gap is not
height-scaled by the old equations. Over the seven-height controlled grid, fixed ×2
length/thickness disagrees in 32/56 cases. A simple larger counterexample is size four
at 1080p: the baseline gives nine pixels, not eight.

**Disposition:** rejected as a universal mapping. Retained as an explicit audit
comparator so future readers can reproduce the failure instead of trusting a verdict.
This did not identify the new renderer; it evaluated an old-model shortcut.

## v1 — Recover rendered pixels first

**First chat proposal:**

$$
\ell\approx\operatorname{trunc}(SH_o/480),\qquad
 t\approx\max(1,\operatorname{trunc}(TH_o/480)),\qquad
 g\approx\operatorname{trunc}(G+4).
$$

**Improvement:** separate old arms from old gap, apply the old pixel quantizer rather
than preserving arbitrary decimals, and use new variable names. Distinguish the
playing height from the authored reference. Treat the final assignment into new
parameters as a candidate, not a Valve-published conversion.

**Evidence:** the old side is grounded in CS2KZ's reconstruction. The new variable
inventory supports ranges and the authored-height concept, but does not expose exact
native pixel arithmetic.

**Limitations identified:** always replacing old zero thickness with positive one can
lose minimum-branch behavior under later height changes. The simple gap equation
assumes the new renderer includes the same half-width baseline and compatible near/far
placement. Silent clipping of negative or oversized ideal values would conceal failed
equivalence. Native outline and dynamic behavior were not reconstructed.

**Disposition:** retain the old pixel equations. Treat positive-one minimum substitution
as superseded for literal old thickness zero. Retain `gap = trunc(G+4)` only as a named
thickness-relative special case, not a universally established mapping.

## v2 — Preserve the zero branch and use complete edge coordinates

**Refinement after generator-source and pro-code comparisons:** keep old literal zero
thickness as a distinct candidate branch; derive the actual old near/far offsets; and
make the new gap origin explicit.

$$
a_o=\lfloor W_o/2\rfloor+\operatorname{trunc}(G+4),\qquad b_o=a_o+1.
$$

For a specified new affine near-edge relationship $a_n=B+Kg$,

$$
g_{\mathrm{ideal}}=(a_o-B)/K.
$$

**What became stronger:** old-model comparisons were reproducibly evaluated for eight
dated legacy codes and seven heights. The sampled settings include zero thickness,
zero arm length with a dot, fractional arm length, negative fractional gap and a more
open crosshair. The hauptrolle generator's early size truncation, zero-width preview
and different gap variable were identified as preview conventions, not engine truth.
Skarbo's helper factor of 1.9 was source-audited but not assigned a native accuracy score.

**What did not become stronger:** no new-client pixel measurements were introduced.
Old examples do not supply new-renderer observations. The new baseline, scale, quantizer
and parity remain hypotheses. The two proposed gap baselines can both reproduce an old
synthetic target when each is paired with its own compensating candidate number.

**Disposition:** these are the principal model distinctions preserved in the GUI and
in the original Python archive. The archive self-tests and stored result object now
reproduce exactly during repository verification.

## v3 — Make assumptions, constraints and residuals executable

**Repository model:** `conditional-static-v3`.

The repository adds the following engineering and mathematical precision without
claiming new native evidence:

- Binary32 intermediates remain explicit, with JS/Python equality checked over all 56
  cases. Negative-gap truncation is tested independently from floor.
- Same-pixel and same-screen-relative targets are separately defined. The latter scales
  already quantized old coordinates; it is not a rerun of the old renderer at a new height.
- Length and thickness use selectable new quantizers. Gap has thickness-relative,
  center-relative and explicitly measured-affine branches.
- A legal integer search reports the ideal parameter, selected candidate, predicted
  pixels, range status and residual. It is a sequential geometric objective, not a
  global perceptual optimizer.
- Width-zero branch preservation can conflict with proportional scaling; the conflict
  is visible instead of hidden behind an “exact” output.
- Both near and far edges are checked. Matching one cannot conceal a different far-side
  displacement or a cross-resolution parity issue.
- Fitted affine offsets are not quantized a second time or rescaled again. Applied fits
  retain their original measurement scope and provenance; stale heights/width block use.
- Native generator output is a `.cfg`. Legacy v1 codes can be round-tripped, while
  unknown/new share-code versions are rejected rather than interpreted with old fields.
- Model-mask agreement, code tests and native validation are explicitly different things.

**Disposition:** current implementation. New evidence should refine it, not be forced to
fit it. A stronger native-renderer model needs a new version and explicit acceptance
records rather than replacing the label on existing synthetic tests.

## Correction C01 — The reported 720p website reference

The supplied archive and earlier chat reported that xhair.pro's current library used a
720-pixel reference and distinguished current versus legacy version-1 searches. During
repository construction, the currently retrieved parsed library page did **not** expose
the cited 720 statement. That recheck does not establish that the old observation was
false: the page could have changed, use client-rendered content or differ by retrieval.
It does mean the statement is **not presently corroborated by this retrieval**.

The archive text is preserved byte-for-byte as historical material. The active source
ledger downgrades that claim accordingly. No native factor 1.5 or globally fixed 720
reference is derived from it. The app instead uses explicit authored and current heights.
This is the safer conclusion whether or not the historical website claim was accurate.

## Correction C02 — Scope of “tests”

“56 tests” in conversation referred to source-based numerical comparisons. It did not
mean 56 executions of the updated game. The repository keeps that wording precise:
56 numerical cases, separate software test assertions, optional browser interaction
checks, and zero native validation captures shipped. No passing software assertion is
converted into an in-game evidence count.

## Rules for v4 and later

Preserve the old version and source fixtures. Identify which claim changes and what
new evidence distinguishes the hypotheses. Add the observed failing case before the
fix. Update the derivation, tests, model identifier, exported provenance and migration
notes together. If a later build differs, scope the new model to that build rather than
silently rewriting the interpretation of an earlier snapshot.

Refuting a favored formula is a successful research result. A good generator should
make that discovery easier, not make the mistake permanent.

## v4 — Quantitative family comparison, 2026-09-23

**New evidence:** a larger legacy-format input corpus and published source facts,
not a new native renderer execution. 138 records, 106 players, 119 codes, 50
parameter-geometry signatures, eight known observation dates. Three unsupported
records remain visible but are excluded from static study. 945 eligible
record-height cases are computed; 48 eligible geometry groups control duplication.

**New methods:** 27 explicit scale/rounding/gap scenarios; at least three inverse
formulae per dimension; legal search and bounded frozen-target mask refinement;
weighted cross-scenario selection; local input-domain coverage; group-disjoint
ridge ablation and cluster bootstrap. Likelihood and corpus coverage are separate.

**New observation path:** old screenshots produce non-unique cvar buckets and a
frozen measured target. Native screenshots use direct component bounds, not an
old-template fit. Native user-attested calibration groups can update conditional
weights; synthetic examples and holdouts cannot. Group dependence is preserved
before canonical measurement deduplication. Both near and far edges are measured.

**Claims not promoted:** no empirical native conversion probability, no universal
cross-build mapping, no inferred historical player resolutions, no automatic
validation through synthetic preview agreement. Actual native confidence remains
unidentified. The fixed-reference families are sensitivity alternatives, not a
resurrection of the uncorroborated website-reference claim in C01.

**UI evolution:** the default view shows old, numeric-no-conversion, and converted
hypothesis previews; the manual v3 lab is retained. Equation source is still
Markdown, with a native-MathML reader for the complete mathematical notebook.


## v5 — Joint inverse and integrity, 2026-09-23

No new native observations. The 27 scenarios and historical source reconstruction remain
hypotheses at the same frozen build. A separable width-first inverse is replaced in the
automatic lab by a globally minimal finite-domain geometry inverse over joint width/gap.
Both target inner edges determine the least-squares gap midpoint. The certificate is
explicitly attached to the initialization tuple, not to later visual/ensemble refinements.

Full-domain exact pixel-cell unions replace dense cropped masks for synthetic targets;
measured masks remain independent and cropped evidence cannot claim exactness. Equal
native tuples retain each originating model's own trace. Robust fixed Gaussian/Student
mixture weights, case-normalized hashes and conflicting-capture rejection strengthen
sensitivity analysis without creating calibrated native confidence. All derivations and
qualification details are in chapter 09. The manual lab advances to conditional-static-v4
with a both-edge midpoint while preserving effective-width calibration scope.

The v5 decision search later added a two-cell length probe when its bounded aggregate
search would stop. A quantized one-cell plateau had stopped at length 4 where length 6 reduced
the declared expected synthetic shape loss at height 720. The search policy is
recorded in reports; the renderer formula families and native evidence did not
change. Direct model lookup also removed repeated linear searches in the forward
evaluation path. These changes improve modeled optimization and local compute time,
not measured CS2 conversion accuracy.
The finite inverse now uses the ideal-value preference only for exact computed-loss
ties; a fixed epsilon could previously pick a slightly worse geometry while still
reporting a global-minimum certificate.


## C02 — Even-width preview arm alignment (2026-09-23)

The synthetic rectangle builder applied the extra center pixel to the right and
bottom arms at every thickness. For even-width bars that placed those arms one
pixel too far out relative to the transverse bar center. `illustrative-parity-v2`
subtracts that extra pixel for even integer widths; odd and fractional widths keep
the previous rule. Literal-coordinate fixtures check symmetry and agreement
between dense masks and analytical loss. This corrects a declared illustration
convention, not a newly observed native renderer.

Legacy binary32 geometry, near/far offsets, inverse certificates, and archive hashes
are unchanged. Reports distinguish raw formula offsets from drawn edges. Measured
image pixels and raw component bounds are preserved; their reconstruction and the
manual affine calibration use `measured-edges-v1`. Native likelihood and holdout
comparisons use predicted drawing edges. Earlier benchmark and verification records
describe the prior raster convention; shape scores should not be compared without
recording that difference. See chapter 04 for the updated placement contract.
