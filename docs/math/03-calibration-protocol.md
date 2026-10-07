# Calibration and capture protocol

::: summary
The missing evidence is screenshots of the new game taken under controlled
conditions. This chapter says which screenshots are worth taking, how to measure
them without fooling ourselves, and how a measured line is fitted and turned
back into settings. A few well-chosen screenshots at the boundaries where the
models disagree tell more than a hundred screenshots of the same small
crosshair.
:::

::: key
{{fig:summary.evidence.captures.reproduced|int}} of
{{fig:summary.evidence.captures.total|int}} user captures of the current game
(issue #11, {{fig:summary.evidence.captures.date|date}}) are reproduced by the
model up to a whole-shape translation; they were used to build it and are not
independent holdouts.
:::

::: technical
## Question

Which observations would identify the parts of the new renderer that the
converter assumes, and how are they turned into a scoped, auditable fit? Tools:
the affine fit and PNG inspector of the manual lab (`lib/manual/calibration.js`),
the scoped measurement JSON (`sicc-measurement-v1`), and the paired capture
tooling of 0.16.0 (development only, not published).

## Model

### What counts as a measurement

A record names the build, style, native settings, current and authored
heights, effective bar width and the exact pixel quantity measured, and keeps
the original capture at its native size. Thumbnails, chat images, video frames
or crops of unknown scale are not native measurements: scaling and compression
move edges by the one pixel being explained. The static protocol fixes style 4,
recoil off and outline off, and first removes the dot so the inner edges are
visible. A hash proves file identity, not truth; user-entered data is labelled
`user-entered`, synthetic examples `synthetic-example`, and nothing carries an
invented `verified` flag.

### The smallest discriminating experiments

Set the resolution, set the authored height to it after the geometry, and read
every value back. Then vary one setting at a time:

- new gap 0 at widths 1, 2, 3 and 4 (gap origin and parity);
- gaps 0, 2, 4 and held-out values (slope and quantization);
- several dimensions at ratios $r\ne1$ (truncation against rounding, where
  scaling happens);
- new thickness 0 before and after a height change (the minimum branch).

Repeated captures of one bucket detect nondeterminism and capture errors; they
do not identify the rule.

### Measure edges

Measure the near inner edge and the far inner edge separately from the centre.
The full opening between opposing arms is

$$
D(g)=2a'(g)+\delta ,
$$

whose slope is twice the near-edge slope; confusing the two halves or doubles
the inverse. Cell indices are not lengths: cells 10 to 13 are four cells, and an
arm on them spans boundaries 10 to 14.

### Fitting a line

Two settings always determine a line, $K=(y_2-y_1)/(x_2-x_1)$ and $B=y_1-Kx_1$,
and so test nothing; the tool needs three distinct settings. For
$(x_i,y_i)$, with $x$ the setting and $y$ the measured pixel quantity,

$$
\bar x=\frac1n\sum_i x_i,\quad \bar y=\frac1n\sum_i y_i,\qquad
\hat K=\frac{\sum_i(x_i-\bar x)(y_i-\bar y)}{\sum_i(x_i-\bar x)^2},\qquad \hat B=\bar y-\hat K\bar x,
$$

with residuals $e_i=y_i-\hat B-\hat Kx_i$,

$$
\operatorname{RMSE}=\sqrt{\frac1n\sum_i e_i^2},\qquad e_{\max}=\max_i\lvert e_i\rvert,
$$

and $R^2$ when the outcome varies. Degenerate, decreasing or non-finite fits are
refused. The 0.5 px residual warning is a diagnostic threshold. The synthetic
example $(0,1),(2,3),(4,5)$ gives $B=1$, $K=1$.

A renderer may follow $y=B+Q(Kx)$ or $y=Q(B+Kx)$, which differ, or switch with
width parity or a minimum. Residuals by setting show it: a sawtooth suggests a
quantizer, a kink near the minimum saturation, a jump at a width change a
thickness-relative origin. The tool fits only the affine model and uses it
without a second quantizer.

### Inverting the fit

$$
x_{\mathrm{ideal}}=\frac{y^{*}-\hat B}{\hat K},
$$

and the panel lists nearby legal integers with their predicted residuals. A
negative ideal gap is a representability limit, not a value to round to 0. With
$x^{*}=(a^{*}-B)/K$, the first-order sensitivities are

$$
\frac{\partial x^{*}}{\partial a^{*}}=\frac1K,\qquad
\frac{\partial x^{*}}{\partial B}=-\frac1K,\qquad
\frac{\partial x^{*}}{\partial K}=-\frac{a^{*}-B}{K^2},
$$

and under independent errors
$\sigma_x^2\approx(\sigma_a^2+\sigma_B^2)/K^2+(a^{*}-B)^2\sigma_K^2/K^4$. Intercept
and slope are correlated in practice, so a formal estimate needs
$\nabla f^{\mathsf T}\Sigma\nabla f$; quantization makes the local
approximation fragile at thresholds. The app shows no interval from three hand-entered
points.

### Scope

A fit applies to the workbench only for a near-gap measurement with matching
build, heights and effective width; a later mismatch blocks it, another
hypothesis detaches it, and hand-typed $B$ or $K$ become an unscoped hypothesis.

### Paired captures

The paired workflow prints the console lines and the predicted mask for each
case, keeps shape families in separate roles, records exact exports, the
SHA-256 of the unedited images, and build and session per side, and compares
PNGs by raw and aligned overlap with quality flags. Provenance filled at pair
level instead of per side is refused (`PAIR_LEVEL_BLANKS`). A predicted mask
can never be promoted to evidence.

## Result

Open questions the next captures should answer, in the order the
[capture protocol](../research/capture-protocol-2026-10-02.md) lists cases for:

- **Odd-width gap origin**: $\lceil W/2\rceil$ (the converter, JDD310) against
  $\lfloor W/2\rfloor$ (cursed). It changes
  {{fig:generated.converter-comparison.gapOriginSensitivity.corpus.changedRows|int}}
  of {{fig:generated.converter-comparison.gapOriginSensitivity.corpus.rows|int}}
  corpus rows and
  {{fig:generated.converter-comparison.gapOriginSensitivity.corpus.at1080.changed|int}}
  of {{fig:generated.converter-comparison.gapOriginSensitivity.corpus.at1080.rows|int}}
  published crosshairs at 1080 (cases `s9-*`).
- **Scaling away from 1080**: $P_r$ and the centre-radius gap are carried over
  from build 2000918.
- **Negative static gap**: what Static Cross draws for a console-only negative
  gap (`s1-t2-gm2`).
- **Zero length and the dot**: whether a zero-length bar or a dot at length 0
  draws (`s8-*`).
- **Full outline width**: mode 1 is assumed to draw 1 px all round.
- **Thickness 0**: modelled as hiding the bars; never exported.
- **The +3 px column offset** of the old issue #11 screenshot.

Settled by captures: the outline alpha equals the old crosshair opacity
(`s10-*`, capture C).

## Limits

Promoting a formula needs original old and new captures with exact settings,
read-back values, both longitudinal edges and the transverse placement, zero and
positive widths, odd and even parity, negative fractional old gaps, large arms,
at least two ratios $r\ne1$, held-out groups and a record of every mismatch.
Claims stay scoped to the build, heights and shapes captured, and a game update
needs new captures.
:::
