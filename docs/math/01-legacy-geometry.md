# Legacy geometry: how the old game turned settings into pixels

::: summary
The old game did not draw "size 2" directly. It multiplied size and thickness by
the game height divided by 480, rounded the results to whole pixels, and placed
the bars by the gap plus four pixels, without scaling the gap by height. So the
same settings drew different pixels at different resolutions, and many different
settings drew the same pixels. The converter therefore starts from the pixels
the old game drew at your old resolution, not from the numbers you typed.
:::

::: key
At 1080 the old game drew a size-2 arm 4 px long. The converter's rounding and
the historical truncation model disagree on
{{fig:generated.converter-comparison.oldRoundingSensitivity.dimensionDisagreements|int}}
of {{fig:generated.converter-comparison.oldRoundingSensitivity.tested|int}}
corpus rows, so the rounding rule is pinned by regression tests.
:::

::: technical
## Question

Which pixels did an old static crosshair (style 4, or styles 2, 3 and 5 at
rest) draw for settings $S$, $T$, $G$ at game height $H_{\mathrm{old}}$? The
height is the one selected inside the game: a 1440p monitor showing a 960p game
image draws at $H_{\mathrm{old}} = 960$, and browser CSS pixels are a third
coordinate system that enters no equation here.

## Model

### The converter's old arithmetic

`communityLegacy` in `lib/geometry/community.js` evaluates, with binary32
intermediates and rounding to nearest with ties to even:

$$
s=\operatorname{f32}(H_{\mathrm{old}}/480),\qquad
L=\operatorname{roundEven}\bigl(\operatorname{f32}(s\,\operatorname{f32}(S))\bigr),\qquad
W=\max\bigl(1,\operatorname{roundEven}(\operatorname{f32}(s\,\operatorname{f32}(T)))\bigr),
$$

$$
d=\operatorname{trunc}\bigl(\operatorname{f32}(\operatorname{f32}(G)+\operatorname{f32}(4))\bigr),\qquad
a=\lfloor W/2\rfloor+d.
$$

Length and width scale with height and are then rounded; the width never drops
below one pixel; the gap offset $d$ adds a fixed 4 and is not multiplied by $s$.
No single multiplier maps all three settings.

Old style 5 placed its bars by its own at-rest rule (ADR-0018, leaked
`weapon_csbase.cpp` lines 2025 to 2050):

$$
d_5=\operatorname{roundEven}\Bigl(\operatorname{f32}\bigl(\operatorname{f32}(\operatorname{f32}(4H_{\mathrm{old}})/1200)+\operatorname{f32}(G)\bigr)\Bigr).
$$

Every style-5 export warns `legacy-style-5-gap` with both readings; no capture
of old style 5 exists.

### Placement

The left arm covers columns $[-a-L, -a)$ and the right arm $[b, b+L)$; the top
and bottom arms use the same intervals on rows. The bars share the transverse
band $[t, t+W)$ with $t = -\lfloor W/2\rfloor$, and the far drawing edge is
$b = a + (W \bmod 2)$. Even bars straddle the centre line and odd bars have a
centre pixel; the shape is symmetric in both cases. A dot is the square
$[t,t+W)^2$. A negative near edge makes the arms start past the centre, so they
cross (see [What decides the export](13-what-decides-the-export.md)).

### The historical reconstruction

The 27-model study and the manual lab use the older CS2KZ reconstruction
`legacy-static-kz-f32-v1` (`lib/geometry/legacy.js`, source ledger S01). It
truncates instead of rounding:

$$
L_{\mathrm{kz}}=\operatorname{trunc}\bigl(\operatorname{f32}(s\,\operatorname{f32}(S))\bigr),\qquad
W_{\mathrm{kz}}=\max\bigl(1,\operatorname{trunc}(\operatorname{f32}(s\,\operatorname{f32}(T)))\bigr),
$$

with the same $d$ and $a$ and the far formula offset $b_{\mathrm f}=a+1$. At
1080, size 2.5 gives $L=6$ and $L_{\mathrm{kz}}=5$; at 720, size 3 gives 4 with
ties to even and 5 with ties up. A report warns `legacy-rounding-disagreement`
when the two old models disagree for its input.

### Binary32 and truncation

JavaScript evaluates in binary64. Near a pixel threshold, binary64 and a
sequence of binary32 operations can round to different integers, so
`Math.fround` reproduces each binary32 step and the archived Python reference
uses a pack/unpack helper. This matches the archived reference; it is not a
claim about native instruction order, compiler contraction or shader
conversion. No epsilon is added to force a pixel count, because an epsilon
changes the model.

Truncation is not floor for negative values:
$\operatorname{trunc}(-0.5)=0$ while $\lfloor -0.5\rfloor=-1$. Gaps $-4$ and
$-4.5$ both give $d=0$; $G=-5.1$ gives $d=-1$. A negative fractional gap is not
automatically a negative pixel offset.

### Width and gap interact

At 1080, thickness 1 gives $W=2$ and thickness 0.5 gives $W=1$. Gap $-4$ with
$W=2$ ($d=0$) and gap $-3$ with $W=1$ ($d=1$) both give $a=1$. A conversion that
reads $G+4$ as a centre-to-arm distance loses the half-width term; one that adds
it again where the new renderer already includes it counts it twice. The near
edge has to be matched in pixels, and the far edge checked as well.

### Buckets: many settings, one picture

Under truncation in real arithmetic, a drawn length $L$ comes from every size in

$$
\frac{480L}{H_{\mathrm{old}}}\le S<\frac{480(L+1)}{H_{\mathrm{old}}},
$$

and under rounding from $480(L-\tfrac12)/H_{\mathrm{old}}$ to
$480(L+\tfrac12)/H_{\mathrm{old}}$, with the tie rule at the ends. At 1080 a 4 px
arm under truncation is any size in $[16/9, 20/9)\approx[1.778, 2.222)$. The
minimum width merges more settings: at 1080 every thickness below $2/3$ draws
1 px under rounding (below $8/9$ under truncation), so thickness 0.5 and 0.6
draw the same bar. The `idealBucket` helper describes these real-number buckets;
binary32 moves the boundaries slightly and is not enumerated.

## Result

Worked values at $H_{\mathrm{old}}=1080$, $s=2.25$:

| Settings $S, T, G$ | $L$ | $W$ | $d$ | $a$ | Note |
|---|---|---|---|---|---|
| 2, 0.5, −3 | 4 | 1 | 1 | 1 | Common thin cross |
| 0, 2, any | 0 | 4 | | | Dot only: a 4 × 4 square; rounding 4.5 up would draw 25 px instead of 16 |
| 1.5, 1, −3 | 3 | 2 | 1 | 2 | Truncating $S$ before scaling by 2 gives 2 |
| 4, 1, −3 | 9 | 2 | 1 | 2 | A fixed factor of 2 gives 8 |

A fixed factor 2 agrees with the reconstruction for all eight original presets
at 960 and 1080 and disagrees in 32 of 56 cases over seven heights; the archived
56 fixture geometries match the archived Python reference exactly. An
independent audit (2026-10-05) ported the leaked old renderer and matched
`oldAppearance(communityLegacy)` pixel for pixel on 483,840 cases (ADR-0019).

## Limits

The lab accepts integer heights 240 to 16384 and non-negative size and
thickness; the upper height bound is a safety policy, not a CS2 limit, and
negative size or thickness is not modelled. The leaked renderer has no
`cl_crosshair_t`, so how an old T drew is an assumption, stated in
[What decides the export](13-what-decides-the-export.md#t-shapes). Whether a
published pro code was the setting used in a given match is outside this model.
:::
