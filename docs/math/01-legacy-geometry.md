# 01 — Legacy geometry, quantization and numerical precision

**Status:** source-derived static geometry, not a native-renderer verification.
**Implementation:** `lib/geometry/legacy.js`, model `legacy-static-kz-f32-v1`.
**Principal evidence:** [S01](../research/source-ledger.md#s01-old-static-geometry).

## 1. Define the problem before changing the numbers

A crosshair configuration is a parameter vector, not a bitmap. The same parameter can
produce different pixel dimensions at different heights. Several different parameters
can also collapse to the same bitmap at one height. Restoring a picture therefore
requires identifying a *rendering function*, not merely renaming console variables.

The original task was to recover the pre-update visual appearance after the September
23 update. Our first tractable subproblem is the stationary Classic Static crosshair,
with its weapon-dependent gap disabled. This eliminates time-varying spread and weapon
state, while retaining the arm length, thickness, gap, optional center dot, T omission,
color and opacity that define many ordinary crosshairs.

The principal old-model reference is the CS2KZ project's documented reconstruction of
the old client painter. That is more directly relevant than an arbitrary website's
preview coordinates. Nevertheless, it is a community reconstruction. We have not
executed the old client or verified its full raster independently. In particular, the
Panorama replica's opacity classes, layout quantization and final transverse centering
must not be quietly treated as native-renderer truth.

## 2. Variables and units

| Symbol | Meaning | Unit |
|---|---|---|
| $H_o$ | Original in-game resolution height | Game pixels |
| $S$ | Old `cl_crosshairsize` | Legacy size units |
| $T$ | Old `cl_crosshairthickness` | Legacy thickness units |
| $G$ | Old `cl_crosshairgap` | Legacy offset parameter |
| $s$ | Old height scale | Pixels per legacy size unit |
| $L_o$ | Colored length of one arm | Game pixels |
| $W_o$ | Colored thickness of an arm / square dot | Game pixels |
| $p_o$ | Adjusted old gap offset | Game pixels |
| $a_o$ | Near-side inner-edge offset in the reference convention | Game pixels |
| $b_o$ | Far-side inner-edge offset in the same convention | Game pixels |

Use the resolution selected **inside the game**, not automatically the monitor's native
height. A 1440p display receiving a 960p game image introduces a later display transform;
it does not make the source image's height 1440. Browser CSS dimensions are yet another
coordinate system and are not inputs to these equations.

## 3. Continuous scale followed by discrete pixels

Ignoring floating-point representation for one moment, the source-derived dimensions are

$$
s=\frac{H_o}{480},\qquad L_o=\operatorname{trunc}(sS),
$$

$$
W_o=\max\left(1,\operatorname{trunc}(sT)\right),
$$

$$
p_o=\operatorname{trunc}(G+4).
$$

There are three separate rules here. Length scales with height and then becomes an
integer. Thickness does the same, but cannot render below the one-pixel minimum in the
reference model. Gap has a fixed additive offset and an integer conversion **without**
the height multiplier. A universal multiplicative conversion of all three settings
cannot reproduce this mixed system.

The old model accepts zero arm length. With no dot that can produce no colored shape;
with a dot, it is a dot-only construction. Zero *thickness* is different: minimum
clamping preserves a one-pixel line or dot rather than removing it.

## 4. The binary32 implementation

The production JS model and the archived Python model explicitly apply binary32
rounding at the following points:

$$
s=\operatorname{f32}(H_o/480),
$$

$$
L_o=\operatorname{trunc}\bigl(\operatorname{f32}(s\operatorname{f32}(S))\bigr),
$$

$$
W_o=\max\bigl(1,\operatorname{trunc}(\operatorname{f32}(s\operatorname{f32}(T)))\bigr),
$$

$$
p_o=\operatorname{trunc}\bigl(\operatorname{f32}(\operatorname{f32}(G)+\operatorname{f32}(4))\bigr).
$$

JavaScript's ordinary arithmetic uses binary64 numbers. Evaluating everything in that
format until the final integer conversion is not always equivalent to a sequence of
binary32 operations. Close to a pixel threshold, a tiny difference can change the
integer result by one. `Math.fround` is used explicitly to reproduce the supplied
reference model's operation boundaries. Python uses a binary32 pack/unpack helper.

This matches the **archived model**. It is not proof of native instruction ordering,
compiler contraction, graphics API conversion rules or a specific shader implementation.
The distinction matters particularly when adding pathological boundary fixtures.

Do not introduce an undocumented epsilon to force a desired pixel count. An epsilon
changes the model. A better test records the exact input, binary32 intermediate values,
expected integer and evidence for the chosen arithmetic order.

The lab imposes finite magnitudes, nonnegative size/thickness, and integer heights from
240 through 16384 to keep arithmetic and the preview bounded. The upper bound is a lab
safety policy, **not** an assertion about CS2's maximum rendering resolution. Negative
legacy size or thickness behavior is not modeled.

## 5. Truncation is not floor for negative values

For positive values, truncation and floor agree. They differ on a negative noninteger:

$$
\operatorname{trunc}(-0.5)=0,\qquad \lfloor-0.5\rfloor=-1.
$$

The selected s1mple fixture has $G=-4.5$. Its reference offset is

$$
p_o=\operatorname{trunc}(-4.5+4)=0.
$$

The selected donk and m0NESY fixtures use $G=-4$, which also gives $p_o=0$. With their
otherwise equal tested dimensions, those different negative gap values occupy the
same integer bucket in this model. Treating every negative fractional parameter as a
negative physical overlap is a mistake.

For $G=-5.1$, the float32 expression is still below $-1$, so truncation gives $-1$.
That really is a negative *adjusted offset*. It still does not establish an overlapping
final bitmap until thickness and arm coordinates have also been considered.

## 6. Complete arm placement

The source-derived longitudinal placement also incorporates thickness:

$$
a_o=\left\lfloor\frac{W_o}{2}\right\rfloor+p_o,\qquad b_o=a_o+1.
$$

In the reference coordinate convention, the near horizontal arm occupies the half-open
interval

$$
[-a_o-L_o,\,-a_o),
$$

while the far arm occupies

$$
[b_o,\,b_o+L_o).
$$

The near/far distinction applies similarly to the top and bottom arms. The far-side
one-pixel displacement is part of the reference's longitudinal model. It is not a
statement that the new renderer must use the same centering convention.

For existing separated opposing arms, the signed interval between their inner edges is

$$
D_o=a_o+b_o=2a_o+1.
$$

Do not universally label $D_o$ the empty center width. If a dot occupies the center, the
interval contains colored pixels. An outline can intrude into the interval. Negative
coordinates can produce overlap. If $L_o=0$, no opposing arms exist and this lab reports
the interval as `null`, not a geometrically meaningful empty gap.

Transverse placement—where a horizontal bar's top edge lies relative to the reference
center—requires another convention. Our illustrative mask chooses an integer grid with
start $-\lfloor W_o/2\rfloor$. The exact native transverse origin, especially for odd
versus even width, remains a separate measurement question. See [04](04-rendering.md).

## 7. Why width and gap cannot be separated casually

Consider the tested 1080p presets. With old thickness 1, $W_o=2$. An adjusted offset
$p_o=0$ gives $a_o=1$. With old thickness 0.5, $W_o=1$. An adjusted offset $p_o=1$ also
gives $a_o=1$.

Thus donk's and ropz's selected presets can have different adjusted gap values but the
same near inner-edge offset. A conversion that interprets `old gap + 4` as a direct
center-to-arm distance loses the half-width contribution. Conversely, adding that
contribution again when the new renderer already includes it double-counts it.

This is the key reason the new gap conversion must explicitly name its baseline. Match
the rendered width first, then solve the new inner-edge placement under an identified
or measured baseline. Finally check the *other* edge; one matching edge is insufficient.

## 8. Integer buckets and non-unique old settings

For nonnegative $S$ in ideal real-number arithmetic, a fixed arm length $L$ corresponds to

$$
L\le \frac{H_o}{480}S<L+1,
$$

or

$$
\frac{480L}{H_o}\le S<\frac{480(L+1)}{H_o}.
$$

At 1080p, a four-pixel arm occupies the ideal old-size interval

$$
\frac{16}{9}\le S<\frac{20}{9},
$$

approximately $[1.7778,2.2222)$. Those old decimals are not individually recoverable from
a four-pixel arm alone. Binary32 perturbs threshold details but does not remove the
many-to-one character of the mapping.

Minimum thickness creates an even larger merged bucket. With nonnegative $T$, the
output $W_o=1$ occurs whenever $\operatorname{trunc}(sT)$ is zero **or** one. In ideal
arithmetic, that means $0\le T<2/s$. At 1080p, thickness 0.5 and 0.8 both produce one
pixel under the reference. Treating their continuous products as visible fractional
widths can change the picture we are trying to preserve.

The `idealBucket` helper deliberately describes real-number buckets. It does not
pretend to enumerate every neighboring binary32 representable input at a boundary.

## 9. Worked examples

### A common thin static cross

Take $H_o=1080$, $S=2$, $T=0.5$, $G=-3$. Then $s=2.25$ and

$$
L_o=4,\quad W_o=1,\quad p_o=1,\quad a_o=1,\quad b_o=2.
$$

The conversion target is a four-pixel arm with one-pixel width and those two inner-edge
positions—not the original decimal vector $(2,0.5,-3)$.

### A dot-only preset

For the selected NiKo record, $S=0$ and $T=2$. At 1080p, $L_o=0$ and $W_o=4$. The dot
is a four-by-four square in the reference geometry. Rounding $4.5$ to five rather than
truncating it makes the dot 25% wider and increases its square area from 16 to 25 pixels.
This illustrates sensitivity, not a measured post-update NiKo change.

### Fractional arm length

For the selected karrigan record, $S=1.5$, $T=1$, $G=-3$. At 960p the arm is three pixels;
at 1080p it is also three. A generator that truncates $S$ first and then multiplies by
two produces two preview units. That is not equivalent to truncating the scaled product.

### A discriminating larger arm

At 1080p and $S=4$, the reference gives nine pixels. A fixed multiplier of two gives
eight. The eight chosen small pro presets happen to hide this distinction at 960p and
1080p, but this additional input exposes it immediately.

## 10. What the old-model tests establish

All 56 fixture geometries match the archived Python calculations. The original archive
reproduces its stored JSON exactly. Invalid values and several boundary cases are tested.
This establishes consistent implementation of a documented model and preserves the
original experiment. It does **not** establish native old-client raster fidelity, the
new renderer's mapping, or that a reported player record was correctly extracted from
the actual match demo. Those are separate evidence obligations.
