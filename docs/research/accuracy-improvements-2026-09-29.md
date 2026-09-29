# Further conversion and ML accuracy — September 29, 2026

This follows the [dump and detector audit](converter-audit-2026-09-29.md).
It changes conversion tie selection and research-only ML, not the source-labelled
rendering reconstruction or latest-dump conclusion. Native old/new capture pairs
remain zero. App 0.7.0 introduced `community-static-v3`.

## Conversion: retain equally accurate dimensions before comparing pixels

V2 fixed length/width first and considered equally good gaps. Screen scaling can
also leave two lengths or widths equally close to their targets. V3 enumerates
all distinct minimum-error lengths/widths, computes nearest centre radii for each
width's parity, and selects maximum exact pixel overlap. Remaining ties use the
old per-axis cvar preference. This preserves the v2 candidate and minimum size
errors; it does not minimize edge error globally or search arbitrary distorted
dimensions for an attractive mask. Search costs 417–546 per-axis evaluations and
at most eight distinct shape comparisons. Reports name the internal baseline
`closest-ideal-initialization`; it is not a v2 comparison.

Example: size .5, thickness 1, gap −2, old height 720, current 900, authored 960,
screen-relative goal. Target width is 2.5 px. Both rendered widths 2 and 3 have
the same squared error, but choosing width 2 improves IoU from .25 to 1.
For gap −3/current 1080 instead, a tied length choice improves .25 to .75.

The retained conversion study compares frozen v2 and current v3 on a declared grid of
8,640 settings/scope/goal/flag combinations. All numbers are synthetic:

| Result | V2 | V3 |
|---|---:|---:|
| Mean IoU over 7,768 visible targets | .460348 | .487215 |
| Exact visible masks | 1,498 | 1,640 |
| Improved / regressed cases | — | 750 / 0 |
| Changed exported tuples | — | 750 |

The grid includes zero and fractional dimensions, negative gaps, parity changes,
six resolution scopes and dot/T flags. Independent finite enumeration tests also
exercise measured masks. All 24 frozen external tuples still match. A supporting
read-only review checked another 5,760 empty-target cases without a tuple change.
These are regression results, not new external or native holdouts.

## ML design and controlled comparison

The accuracy experiment specifies seed 29092027 and 400 new unique
setting triples, excluding all 196 prior development/challenge triples. Eight
strata include ordinary fractions, zero dimensions, binary32 rounding boundaries,
negative gaps, near-limit dimensions and saturated gaps. All resolutions, goals
and flags belonging to a triple stay in the same partition.

Of 320 development triples, the fixed hash split assigns 198 to training, 34 to
validation, 29 to calibration and 59 to test. Five scopes × two goals × four flags
give 40 rows per group. Another 80 triples supply both interior and exterior
resolution challenges, 1,280 rows each. These two challenge sets deliberately
share triples and are not independent replications. Their resolutions differ
from training; exterior ratios (.222… and 4) exceed the training ratio range.

Both variants learn residuals around the same input-only analytic predictor.
The new variant exposes rounding remainders, lower/upper quantization error,
parity, pixel-cell extents and saturation flags. Features never read solver labels
or call the inverse during prediction. Both receive the same data and two fixed
capacity choices (24 depth-3 or 32 depth-4 boosted rounds, learning rate .2).
Validation selects 32/depth-4 for both; refit uses training plus validation only.

| Exact tuple fidelity | Analytic | Expanded residual | Quantization-aware |
|---|---:|---:|---:|
| Test: 59 groups / 2,360 rows | 81.82% | 96.31% | **97.29%** |
| Interior: 80 groups / 1,280 rows | 62.81% | 52.97% | **73.91%** |
| Exterior: 80 groups / 1,280 rows | 75.16% | 63.59% | **77.66%** |

The controlled feature gain on the test is .97 percentage points, approximately
26% fewer tuple errors. Test rendered-mask equality is 96.57% versus 97.37%;
mean rendered IoU against solver labels is .99234 versus .99400. Two empty masks
count as equal only for imitation metrics, never as rendering evidence. Not every
dimension improves: length MAE rises from .00593 to .00763 cvar units while gap
MAE falls from .03178 to .02161. The old-feature learner still loses to the analytic
baseline on both shifted challenges; the new features help substantially there.

The frozen previous model scores 73.18% on these test labels. That is a historical
end-to-end baseline with a different target version, not an ML-only ablation.
Do not compare the earlier 93.90% headline directly with 97.29%: both labels and
the test population changed.

Protocol history: seed, strata, scopes, split and capacity candidates were fixed
before scores were inspected. Preliminary test scores were then viewed. Code
review found equal-overlap cvar drift caused by edge-loss roundoff and cross-axis
tie preference; fixing that converter defect changed some synthetic labels.
The same fixed ML protocol was rerun after the correction. No ML features,
capacities, splits or challenge scopes were tuned using those results. Final
test groups remain excluded from fitting, but this is a disclosed re-evaluation,
not a pristine one-shot holdout claim. Future tuning needs new confirmation data.

## Uncertainty, reproducibility and remaining limits

Calibration uses group-maximum residuals on 29 separate groups, alpha .1, rank
27 and radius 1. Quantization-aware intervals accept and cover all 59 test groups.
On the interior challenge they accept 740/1,280 rows but only **8/80 complete
groups**; those accepted groups are covered. All exterior rows abstain. Report
coverage with these denominators: selective coverage does not establish coverage
for rejected groups, shifted inputs, designed synthetic populations or the game.
Feature-range membership is only a rejection heuristic, not proof of support.

Cluster-bootstrap intervals describe synthetic setting-group variability, not
native confidence or a paired significance test. The learned approximation remains
research-only; the exact runtime converter is more reliable than a 97.29% emulator.
No replacement, speed claim, native probability or capture-grounded improvement
is implied. Original game measurements remain the central evidence gap.

Development verification retrained both frozen-v2 and current-v3 artifacts with
bytewise checks and exercised grouped-label/feature/interval tests. The public
release retains results and protocols; training implementation is kept separately.
Artifacts: [ML](../../research/generated/accuracy-emulator.json),
[conversion](../../research/generated/conversion-accuracy.json).
Final ML fingerprint: `a7ef8624ed43eb05cf768cf367776d0784eeaf5177d225efe5fb72d7dfec8593`.
