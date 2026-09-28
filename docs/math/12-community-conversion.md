# 12 — Source-labelled static conversion and smaller choices

The default is now `community-static-v1` for inspected build 2000918.
[The September 28 audit](../research/converter-audit-2026-09-28.md) records
sources, immutable data references and the external comparison. The previous
chapters remain the historical reconstruction and 27-hypothesis study.

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
thickness = clamp(W, 1, 31)
gap = clamp(d + ceil(W / 2), 0, 128)
```

When dimensions saturate or resolutions differ, finite per-axis enumeration
fits length and width first, then the symmetric radius of the old drawn edges.
There are only 256 length, 32 thickness and 129 gap values to inspect. This is
an exact per-axis geometric objective, not a global pixel-overlap objective.

New bars use the transverse interval `[-ceil(W/2), floor(W/2))`. Left arms end
at `-gap`; right arms start at `gap - (W % 2)`. Old odd-width bars sit one pixel
differently. The preview retains this shift instead of silently aligning images
or changing thickness to chase IoU. Uploaded masks are compared as supplied.

For the screen-relative goal, scale old *drawn* edges and transverse origin
before rasterizing. Scaling raw arithmetic offsets and then applying a parity
correction would create a false extra pixel for doubled even-width bars.

## Evidence and interface

The six UI choices are the community default, historical hedge and four
authored-height controls. The full factorial remains a historical research
comparison. Imported measurements are scoped to their build; the new direct
model reports measurement residuals without inventing probability weights.
The report schema is `sicc-quant-report-v5`. An unavailable pixel preimage has
`complete: false` and `count: null`, never an unrelated exact-match count.

## Learning after the audit

The new synthetic distillation experiment compares the historical feature map
with geometry and authoring-height features on the same new-target test set.
Exact tuple fidelity rises from 29.17% to 90.48% across 21 untouched setting
groups (672 rows). Capacity selection uses separate validation groups.
This is not comparable to chapter 10's 35.7% on a different historical target.
The deterministic converter remains exact for its declared size objective and
the learned approximation remains outside the runtime path.
