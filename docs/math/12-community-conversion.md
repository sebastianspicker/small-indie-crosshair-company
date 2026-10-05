# 12 — Source-labelled static conversion and smaller choices

The default is now `community-static-v6` for inspected build 2000922
(thickness range 0..32; the equations below are unchanged from v3 and an
unverified carry-over, see the
[October 1 note](../research/build-2000922-update-2026-10-01.md)). Version 5
changed the tie ranking and version 6 added the old-appearance rules and a
refinement window; both are described below.
[The September 28 audit](../research/converter-audit-2026-09-28.md) records
sources, immutable data references and the external comparison. The previous
chapters remain the historical reconstruction and 27-hypothesis study.
[Chapter 13](13-what-decides-the-export.md) walks through the whole pipeline and
separates the closed-form math and rules that decide the export from the
learned models, which only check it or served as research evidence.

## Old dimensions and signed gap

Use binary32 inputs and products, then nearest integer with ties to even:

```text
s = f32(oldHeight / 480)
L = roundEven(f32(s * f32(size)))
W = max(1, roundEven(f32(s * f32(thickness))))
d = trunc(f32(f32(gap) + 4))
```

Truncation remains the historical baseline, not an interchangeable spelling
of rounding. At 1080, size 2.5 yields length 6 here and 5 under truncation.
At 720, size 3 yields 4 here and 5 under half-up rounding. Near a boundary,
binary32 and real-number arithmetic can differ.

## New static pixels

For a native integer v and ratio `r = currentHeight / authoredHeight`, predict
zero when v is zero and `max(1, round(v * r))` otherwise. New zero thickness
therefore hides the bars; a visible old minimum is exported as positive width.
The new gap is a centre radius. At equal heights the direct conversion is:

```text
length = clamp(L, 0, 255)
thickness = clamp(W, 1, 32)
gap = clamp(d + ceil(W / 2), 0, 128)
```

When dimensions saturate or resolutions differ, exact monotone per-axis search
fits length and width first, then the symmetric radius of the old drawn edges.
The legal domains contain 256 length, 32 positive thickness and 129 gap values;
boundary searches recover all nearest plateaus without scanning every value.
Version 3 retains all minimum-error lengths and widths, recomputes radius for
each width's parity, then compares at most eight distinct shapes by exact overlap.
Equal overlap retains the old length/width/gap canonical ordering. Edge loss is
diagnostic, not globally minimized across widths. At v3 this improved 750 of
8,640 synthetic cases versus v2 with no regressions. In the current artifact
(`research/generated/conversion-accuracy.json`, v6) 1,196 of those cases are
v6 edge cases with another target and are excluded; of the other 7,444, 671
improve in shift-aligned overlap with none worse (436 better and 96 worse in
plain overlap, the trade the v5 tie ranking accepts). It does not establish global visual
optimality over arbitrary dimensions or gaps. V2 and its study remain frozen.

Version 5 changes only the tie ranking. Old odd-width bars are centred on
`-floor(W/2)` and new ones on `-ceil(W/2)`, and no cvar moves the whole
crosshair, so absolute overlap rewarded shapes that cover the misplaced centre.
Tied shapes are now ranked by the aligned overlap

```text
alignedIoU(A, B) = max over dx, dy in {-1, 0, 1} of IoU(A shifted by (dx, dy), B)
```

then by plain overlap, then by the canonical ordering. Equal-height
conversions have no ties and are unchanged; on the corpus, 74 of 1,755
record-scope rows (48 records) change, all at cross heights.

New bars use the transverse interval `[-ceil(W/2), floor(W/2))`. Left arms end
at `-gap`; right arms start at `gap - (W % 2)`. Old odd-width bars sit one pixel
differently. The preview retains this shift instead of silently aligning images
or sacrificing thickness accuracy to chase IoU. Uploaded masks are compared as supplied.

For the screen-relative goal, scale old *drawn* edges and transverse origin
before rasterizing. Scaling raw arithmetic offsets and then applying a parity
correction would create a false extra pixel for doubled even-width bars.

Version 6 changes the legacy target before that search and adds an appearance
window after it. Crossed arms are folded into the same pixels with a
non-negative gap, outline-only and dot-only shapes export drawable cores, and
zero-length bars draw nothing in the new game.
The old shape is painted in the old draw order (each outline, then its fill),
`cl_crosshairusealpha 0` exports fill alpha 255 with the outline at 200, outline
thickness above 3 is clamped on import, and a weapon gap converts with the non-weapon goal.
The appearance window comes last. When the
colour-aware shape check of the chosen tuple (old core and outline in the old
draw order against the new core and outline) is neither exact nor exact after
a 1 px shift, every tuple within 3 drawn pixels of bar length, 3 of bar width
and 4 of the gap edge (at least the same number of native steps; at equal
heights exactly length ±3, thickness ±3 and gap ±4) is scored by that check's
aligned overlap. A neighbour replaces the choice only if it scores strictly
higher; ties keep the dimension-first result. Whenever a v6 rule or the window
changed the export, the plain conversion is solved too and exported instead
if its aligned overlap is strictly higher (`corrections-fallback`). Thickness stays at least 1, and length at least 1 when the choice draws
arms. Scope: legacy inputs at the pixel goal, for every old outline width
(ADR-0019; the score is colour-aware, so a coloured core widens only when that
matches more old pixels). A screen goal keeps the dimension-first result, because its
fractionally scaled target is a model artefact. The window is local: it does not change the dot, T or outline flags,
and it is not a global optimum.

## Open calibration questions (October 2, 2026)

The v4 equations stay unverified on build 2000922. The shader's integer-bounds rule is
verified for rectangles, but the CPU layout that supplies the bounds is not observable
(see the [build note addendum](../research/build-2000922-update-2026-10-01.md#2026-10-02-addendum)).
The issue #11 captures settle two earlier questions: the outline alpha
rule (`s10-*`, outline alpha equals the old crosshair opacity, not multiplied) and zero-length
bars with outlines (`s8-*`, they draw nothing in the new game, on one user capture
and statement). Open: the gap origin at odd thickness (ceil against floor, `s9-*`), negative gaps on
static styles (`s1-t2-gm2`), and the styles 2, 3, 5, 6, 8 and 9 without a model. The research-only
harness (development tooling, not published) prints the console lines and the
predicted mask for each case and scores a screenshot against it, including a
best-offset search. Neither enters the runtime.

## Evidence and interface

The six UI choices are the community default, historical hedge and four
authored-height controls. The full factorial remains a historical research
comparison. Imported measurements are scoped to their build; the new direct
model reports measurement residuals without inventing probability weights.
The report schema is `sicc-quant-report-v6`. An unavailable pixel preimage has
`complete: false` and `count: null`, never an unrelated exact-match count.

## Learning after the audit

**Historical values.** This section and the next keep the numbers measured on
the v3 and v4 labels when the experiments were first run. The current
`community-static-v6` values (accuracy emulator, structured ranker, export-state
learners v1 and v2) and the role of each learner are in
[chapter 13](13-what-decides-the-export.md), section 3. None of these learners
decides an exported value.

The September 28 experiment reached 90.48% synthetic tuple fidelity with geometry
features. The [September 29 audit](../research/converter-audit-2026-09-29.md) adds
learned residuals around an analytic guess and reserves 16 calibration groups
separately. Under the new target/split, same-test fidelity is 87.05% for geometry
features and 93.90% for the residual learner, over 21 groups (672 rows).

On 96 unseen fractional/resolution challenge groups, residual fidelity falls to
72.66%, below the analytic guess's 80.12%. Calibration uses group-max residuals;
all challenge groups exceed fitted feature ranges and abstain from interval
claims. Cluster intervals and held-out scores describe solver imitation, not
native correctness. No guaranteed coverage is inferred from a designed grid.
Capacity selection uses validation only; learned inference remains research-only.

The [v3 follow-up](../research/accuracy-improvements-2026-09-29.md) excludes all 196
earlier setting groups. Its 320 development groups split into 198 train, 34
validation, 29 calibration and 59 test; 80 additional groups form two shifted
resolution challenges. On v3 labels, quantization-aware input features improved
same-test tuple fidelity from 96.31% to 97.29%; on v4 labels (thickness up to 32)
the same protocol gives 95.21% to 96.99%. Interior challenge fidelity rises from
51.48% to 69.92% and exterior from 57.89% to 77.89% (v3: 52.97% to 73.91% and
63.59% to 77.66%). These are different labels/data from v2.
After a reviewed converter tie correction the fixed protocol was rerun; the
report discloses that re-evaluation instead of claiming a pristine one-shot test.
Interior intervals accept only 8/80 complete groups, and all exterior groups
abstain. No learned approximation enters the runtime or establishes native confidence.

## Structured learning and exact search acceleration

The [next experiment](../research/structured-learning-2026-09-29.md) reserves
another 400 setting groups and learns to rank analytically legal candidates.
On v3 labels its same-data residual / structured test fidelity was 97.33% / 98.75%,
with 84.22% and 96.02% on shifted interior and exterior scopes; on v4 labels the
ranker gives 98.50%, 83.91% and 96.09%. Canonical
arithmetic and projection ablations separate deterministic constraints from
learned selection. Exterior uncertainty intervals abstain on every row despite
high diagnostic tuple fidelity. These remain synthetic reconstruction results.

Runtime axis inversion now finds adjacent quantized levels and their complete
plateaus by binary search, preserving all v3 cvars and pixel choices. On 15,360
existing research cases, axis evaluations fall from 6,583,140 to 366,064. This
operation count excludes the unchanged exact visual tie scoring and is not a
claim of equivalent wall-clock speedup.
