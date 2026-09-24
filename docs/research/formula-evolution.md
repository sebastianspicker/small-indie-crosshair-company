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

## C03 — Automatic zero-branch disclosure (2026-09-23)

The automatic lab could return `cl_crosshair_thickness 0` for a positive legacy
thickness without any warning. Observed case: old thickness 0.5, old height 1080 and
target height 2160 with the same-pixel goal. The legacy one-pixel width is matched only
by the stored zero, because at `r = H_n/A = 2` the next legal integer renders two pixels.

The v5 report now names that branch in its warning list, and the `.cfg` export carries
the same comment; the manual lab already warned. The renderer arithmetic, model family,
inverse certificate and native-evidence status are unchanged. Clamping to thickness 1
was rejected as a fix: at the same scale it converts a disclosed one-pixel under-shoot
into a hidden two-pixel over-shoot.

## C04 — Learned emulator: measured fidelity and the closed speed gate (2026-09-23)

**Proposal examined:** replace the exact finite-domain inverse with a small,
dependency-free learned model that predicts the converted tuple directly, for a
large speedup.

**What was built:** a deterministic boosted-stump inverse emulator and a
depth-3 boosted-tree forward surrogate in `research/lib/emulator.js`, trained offline
by `research/scripts/train-quant-emulator.mjs` into `research/generated/quant-emulator.json`. This entry
describes the **first** artifact, whose fingerprint was `1027764490`; the later
capacity revision (fingerprint `137061144`) is correction C06. The inverse's
labels come from the project's own `infer` solver on 5000 deterministic samples
across 607 distinct legacy settings. The split is
group-disjoint by setting signature (`hash(signature(settings)) % 5 === 0 -> test`),
giving 3991 training and 1009 held-out samples with 0 excluded.

**Measured result (initial artifact):** on held-out solver labels the learned
inverse reproduced the exact solver's **full tuple only about 11.6%** of the time
(naive direct assignment: 3.57%). Per-dimension exact rates were length 0.334,
thickness 0.589, gap 0.403; mean absolute errors were length 1.269, thickness
0.667, gap 1.062 px against a naive combined MAE of 2.610. The forward surrogate
reached held-out MAE below one pixel on all four outputs (length 0.392, width
0.286, near 0.540, far 0.540). The initial depth-1 emulator ran in roughly 0.4 µs
per call versus a 1.0–1.1 ms p50 for the exact core (`npm run bench:emulator`),
about **2500× faster**.

**Disposition:** rejected as a substitute. The artifact records
`speedGate: "closed-not-exact-equivalent"`; it is not wired into the app or the
Simple view, and the exact solver remains authoritative. The forward surrogate is
also not wired into inference. The labels are self-generated by the declared
solver, the project ships zero native old/new capture pairs, and
`provenance.nativeEvidence` is `false`, so the experiment can neither improve nor
measure native accuracy. Refuting a favored approach with a measured result is a
successful outcome; the full account is in chapter 10. This entry records the
first measured artifact and its 11.6% figure; the later capacity revision (fidelity
0.3567889, fingerprint `137061144`, per-call cost ~3.8 µs p50) is correction C06.

## C05 — Bounded search is not globally optimal; opt-in certificate (2026-09-23)

**Proposal examined:** whether the shipped automatic search already returns the
global minimizer of the declared decision loss, and whether that can be certified.

**What was checked:** `research/scripts/certify-inverse.mjs` (`npm run certify:inverse`)
re-solves every eligible corpus record at four heights under the `expected` and
`worst` rules (1064 cases) with `rankAndCertify` and the adaptive Chebyshev-shell
`certifyOptimum`, then validates the `shell-monotone` assumption against a
bounded sub-domain exhaustive oracle (probe length `0..32`, thickness `0..31`,
gap `0..32`). The corpus, targets, model family, prior-only weights and default
runtime path are unchanged.

**Measured result:** the shipped bounded search was **not** the declared optimum
in **114 of 1064** cases (`0.1071429`, about 10.7%): about 0.19% under the
`expected` rule (1 of 532) and about 21% under the `worst` rule (113 of 532).
Certificate methods were `loss-zero` 16, `shell-monotone` 1032 (conditional),
`domain-exhaustive` 0 and `unproven` 16 (pure-dot plateaus), a certified fraction
of 98.5%. Representative case: pro-001 donk at 2160 under `worst`, chosen
length 4 / thickness 2 / gap 0 at loss 0.8421053 versus certified length 6 /
thickness 1 / gap 0 at loss 0.7931034. The six offline shell probes all agreed
with exhaustive enumeration on the bounded probe (0 assumption failures).

**Corrective action:** the runtime gained an **opt-in** certified expansion via
`infer({ certify: true })` (`bounded-neighborhood-plus-certified-expansion-v2`).
The default path is deliberately unchanged and reports
`decision.certificate.method = not-evaluated` (or `loss-zero`), so no shipped
default output moves. The `shell-monotone` method is a documented, spot-checked
(not proved) monotonicity assumption and is not a proof; `unproven` makes no
global claim.

**Disposition:** accepted as a correctness refinement of the declared optimizer,
with the default behavior frozen. It says nothing about Valve's renderer. The
full account is chapter 11.

## C06 — Emulator capacity revision; ranker and sensitivity results (2026-09-23)

**Proposal examined:** whether the learned inverse could be improved, and whether
a learned shortlist or a learned fragility classifier could stand in for the exact
solver.

**What changed:** the inverse block moved from additive depth-1 stumps to
**depth-3 boosted trees** (120 rounds, learning rate 0.2) over **26 declared
features** — the original 19 plus 7 declared-math additions (three ratio-scaled
fractional parts, three integer-boundary distances, and legacy width parity).
On the same 1009 group-disjoint held-out samples the full-tuple fidelity rose
from 0.11596 to **0.3567889** (about 3.08x); per-dimension exact rates are length
0.563, thickness 0.783, gap 0.644, and the MAEs fell to length 0.561, thickness
0.308, gap 0.575 against a naive combined MAE of 2.610. The artifact fingerprint
moved to `137061144`.

**Ablation (the honest part):** at matched capacity the 7 appended features were
**neutral-to-slightly-negative** in a held-out ablation. The gain came from the
depth-3 capacity block, not from new features. Capacity was selected on a
group-disjoint validation fold carved from the training samples; the held-out
test split was not used for selection. The headline is "more capacity", not "new
math".

**Ranker (W4a):** `research/lib/ranker.js` proposes a learned shortlist and takes
the **exact** argmin of the declared loss over it. On 125 held-out settings the
shortlist contained the solver tuple 0.848 of the time at K = 32, but the
verified answer was **worse** than the solver on 13 of 125 samples (max gap
0.1063017), a negative fidelity result, while running about 6.65x faster at p50
(221 µs versus 1.471 ms). Artifact verdict: `NEGATIVE (fidelity)`; the speed gate
stays `closed-not-exact-equivalent`.

**Sensitivity (W4b):** `research/lib/sensitivity.js` adds an analytic boundary-margin
advisory (always available) and an optional learned mismatch classifier. The
classifier reached **0.736 accuracy against a 0.704 majority baseline** on 125
held-out settings — weak — and is recorded as such. The analytic layer stands
alone. Both flag the declared quantizer, not native renderer fragility.

**Disposition:** accepted as measured negative/advisory results. None of it is
wired into inference; the exact solver remains authoritative; the project ships
zero native capture pairs and no native claim is made. Full account in chapter 10.

## C07 — Gap scale is an unstated axiom; v0.4 records the rival (2026-09-23)

The 2026-09-22 update made length and thickness resolution scaled in the build
2000914 dump, but the `cl_crosshair_gap` description does **not** state scaling.
Every one of the 27 `quant-static-v5` ids nonetheless multiplies gap by the same
ratio `r` it applies to length and thickness. That was an unstated axiom of the
whole shipped family, not a fact read from the dump. The frozen old painter never
height-scaled gap, so a converter that does can be right only if Valve changed the
rule.

**What v0.4 adds:** an explicit structural hypothesis family
([`lib/solver/structural.js`](../../lib/solver/structural.js)) in which
`gapScale ∈ {same-as-length, unscaled}` is a named rival, plus an offline census
([`research/scripts/structural-study.mjs`](../../research/scripts/structural-study.mjs)) of where the
rivals disagree. At an authored height of 1080 and a current height of 2160 the two
predict nears four and three respectively for a stored `length 9 / thickness 2 /
gap 1`; at 1080/1080 they agree, so same-height tests cannot identify the scale. The
shipped `infer()` default tuple is **unchanged**. Every automatic report now warns
that the scale is unresolved, and the modulator that could one day adjust the tuple
stays closed (`closed-no-native-pairs`).

**Not claimed:** a measured native renderer, a selected gap scale, or a migration
callback. Opening the gate needs reviewed native pairs; the plan defines the
threshold and deliberately defines no reviewed-registry provenance value.

**Disposition:** the rival is recorded and off the default path; the default tuple
and `quant-static-v5` are frozen. Full account in the
[v0.4 plan](../engineering/archive/v0.4-conversion-improvement-plan.md).
