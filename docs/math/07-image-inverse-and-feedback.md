# Screenshot inversion and measurement of the new game

::: summary
A screenshot shows pixels, not settings: many old settings draw the same picture,
and a screenshot cannot reveal your colour preset, alpha or resolution. From an
old screenshot the converter finds the crosshair shape that explains the coloured
pixels best and converts that shape directly. A screenshot of the new game is
measured by a different, simpler method that assumes nothing about how the new
game draws, so that it can later test the converter's models instead of
repeating them.
:::

::: key
The old-image fit scores every template exactly, 16 widths × 49 lengths × 41
near edges with dot and T variants, and accepts a fit only when it explains at
least 90% of the segmented pixels and the segmentation is stable under nearby
colour thresholds.
:::

::: technical
## Question

What target can an old screenshot supply, and how can a screenshot of the new
game be measured without assuming the renderer it is meant to test? Code:
`lib/image/screenshot.js`, `fit.js`, `components.js`, `app/image/input.js`.

## Model

### Input and limits

The user gives the old game height and a PNG, and may move the centre and pick
a colour. A crop's size is not the game resolution: a 129 px crop of a 1440p
game is a 1440p observation. PNG headers are checked before decoding; sides
above 8192, more than 20 million pixels or files above 16 MB are refused. These
are resource limits, not a malware check. Bytes stay in the tab; reports carry
geometry, provenance and hashes, not the image.

### Segmentation

Analysis uses an odd centre crop of 49 to 161 px (129 by default). With a
colour seed $c$ and tolerance $\tau_c\in[1,120]$ in RGB distance,

$$
B(x,y)=\mathbf 1\bigl\{\lVert I_{\mathrm{RGB}}(x,y)-c\rVert_2\le\tau_c\bigr\}\ \mathbf 1\{I_\alpha(x,y)>32\}.
$$

Without a click, `automaticColor` proposes up to five colours from the strips
within 8 px of the two centre axes: bright or saturated pixels (white included),
binned in steps of 8 and ranked by how many lie on the axes, so off-axis scene
patches cannot take the slots. An empty mask, or one covering more than 35% of
the crop, is refused. A fit is *stable* when the masks at $\tau_c\pm8$ keep an
IoU of at least 0.98 with the chosen one. Foreground touching the crop edge, or
the original image edge under transparent padding (`sourceBoundaryClipped`), is
refused as cut off.

### Old-image template fit

`fitMask` scores every template with $W\in1..16$, $L\in0..48$,
$a\in-16..24$, $b_{\mathrm f}=a+1$ and dot and T flags (pure dots without
redundant variants). With the integral image

$$
\Sigma\bigl([x_0,x_1)\times[y_0,y_1)\bigr)=S(x_1,y_1)-S(x_0,y_1)-S(x_1,y_0)+S(x_0,y_0),\qquad S(x,y)=\sum_{u<x}\sum_{v<y}B(u,v),
$$

the overlap with the union of at most five rectangles is computed exactly by
inclusion and exclusion over their at most 31 non-empty intersections, so
overlapping and crossed arms count once. The score is the exact IoU; ties
prefer a non-negative near edge, then shorter, thinner and closer templates, and
the five best are reported with the number of tied templates. A fit is
acceptable only if it is uncropped, stable and has IoU at least 0.9; that gate
is an operational threshold, not a probability.

### Buckets, not recovered settings

Under the converter's old arithmetic a drawn length $L$ comes from sizes in
$[(L-\tfrac12)/s,(L+\tfrac12)/s]$ with the half-even end rule, and $W=1$ from every
thickness below $1.5/s$. With $p=a-\lfloor W/2\rfloor$ the gap bucket, under
truncation toward zero, is

$$
p>0:\ G\in[p-4,\,p-3),\qquad p=0:\ G\in(-5,\,-3),\qquad p<0:\ G\in(p-5,\,p-4].
$$

The interface shows representative values $L/s$, $W/s$ and $p-4$ labelled as
non-unique; binary32 moves the bucket ends slightly. When the image target is
kept, the conversion uses its geometry and mask directly, and editing an old
shape field clears it.

### Measuring the new game

Fitting new captures with the old template would impose $b'=a'+1$, the
hypothesis under test. `measureNativeMask` instead labels 4-connected
components, keeps fully filled axis-aligned components that do not touch the
crop edge, and assigns left, right, bottom, optional top bars and a centred dot
from their bounds, trying both centre conventions (pixel 0 and the boundary at
−0.5). Edges are measured independently:

$$
a'=-(x_{\max,\mathrm{left}}+1),\qquad b'=x_{\min,\mathrm{right}},
$$

with vertical bars required to agree with horizontal ones, a common transverse
start, and the dot width equal to the bar width. Merged bars, inconsistent
dimensions, an unexplained centre component, declared dot, T or bar flags that
the image contradicts, or a reconstruction explaining less than 90% of the mask
are refused. A lone centred square is a pure dot whose gap is unidentified and
excluded from the likelihood.

### The feedback loop

For an old target: freeze it, generate legal proposals under every declared
model, render and compare, refine in a bounded neighbourhood, and stop on exact
agreement, stagnation or budget. None of this changes model weights. For a new
capture with declared settings: measure it as above, validate build, size,
settings, hash, role and group, file it as calibration or holdout (never both),
recompute weights from calibration groups only, and rerun the inversion against
the same old target. The target is never adjusted toward a model.

## Result

The fit search is exhaustive inside its template family, and its ties are
reported instead of resolved silently. Synthetic fixtures test both extractors;
they are not added to the native evidence.

## Limits

The template family excludes outlines, dynamics and shapes outside its ranges;
the manual old-settings form covers those. A hash proves file identity, not that
the image is native or unedited; session groups and provenance review carry the
independence argument, and every image record is user-attested.
:::
