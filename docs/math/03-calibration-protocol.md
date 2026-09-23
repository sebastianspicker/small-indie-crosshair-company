# 03 — Calibration, residuals and experimental design

**Purpose:** acquire the independent observations missing from the current conversion.
**Implemented tools:** affine fit, discrete inverse suggestions, scoped observation
JSON and a local PNG inspector. **Measurements shipped:** none.

## 1. What counts as a useful measurement

A number such as “gap 2 looks right” does not identify a rendering rule. A useful record
specifies the game build, style, native parameter vector, current resolution, authored
height, effective bar thickness and the exact pixel quantity measured. It should also
retain the original capture and enough context to reproduce the state.

Use an actual game image at its original dimensions. Do not count pixels in a browser
thumbnail, a scaled Discord image, a cropped image whose scale is unknown, or a compressed
stream frame and label the result native. Pixel rounding, antialiasing and scaling can
each change edges by the one pixel we are trying to explain.

Record at least the weapon, stationary/moving/firing state, crouch state, recoil setting,
outline state, center dot, display mode and relevant render-scaling settings. The static
protocol fixes style 4, disables recoil and outline, and initially removes the center
dot so inner arm boundaries are unobstructed. These are experiment controls, not gameplay
recommendations.

A hash establishes file identity, not truth. A PNG with a SHA-256 digest can still be a
synthetic image or a mislabeled screenshot. The project distinguishes user-supplied
provenance from independently reviewed native evidence.

## 2. Do the smallest discriminating experiment first

Start with the actual resolution you want to restore, and set the authored height to
that same value after the geometry settings. Read the values back. The inventory says
size edits can update the authored reference, so never assume a prior value persisted.

Use an easily measurable arm length such as ten units and a positive thickness outside
the minimum clamp. Count the colored core, without the outline. Determine whether ten
new length units actually give ten game pixels at that authored/current height. This
simple observation tests the new-unit assumption before fitting a complex formula.

Then separate length, width and gap experiments. Vary one parameter at a time. Do not
change thickness while fitting a gap baseline unless you are explicitly estimating the
width-dependent baseline function. A mixture of measurements from different effective
widths can give an apparently plausible but physically meaningless slope.

The initial high-value tests are:

- New gap zero at widths one, two, three and four. This distinguishes origin hypotheses
  and tests parity dependence.
- New gap values 0, 2 and 4, with additional intermediate and held-out settings. This
  measures slope and exposes possible quantization.
- Several positive dimensions at non-unit $H_n/A$ ratios. This distinguishes truncation
  from nearest rounding and identifies where scaling occurs.
- Literal new thickness zero before and after a height change. This tests the minimum
  branch separately from a positive one-pixel setting.

A hundred images of the same quantization bucket may carry less identifying information
than four carefully chosen boundary cases. Repetition is still useful for detecting
nondeterminism, capture errors and changing game state; it serves a different purpose.

## 3. Measure edges, not an ambiguous “gap”

Use the coordinate convention recorded in the experiment. Measure the near arm's inner
edge relative to the reference center, then independently measure the far arm's inner
edge. Keep the signs or positive offset convention explicit. The old reconstruction
uses $a_o$ and $b_o=a_o+1$; the new renderer may use something different.

If you instead measure the full interval between opposing colored arms, call that
quantity $D$, not the gap setting. For a hypothetical symmetric near/far displacement,

$$
D(g)=2a(g)+\delta.
$$

Its slope with respect to $g$ is twice the slope of the near edge when $\delta$ is
constant. Confusing the two produces a factor-of-two error in the inverse formula.

A dot or outline makes the visible clear region smaller than the colored-arm interval.
That is why those elements are removed in the initial geometry experiment. Restore and
test them later as separate rendering properties.

The PNG inspector reports a selected source *cell* and its reference offset. The
difference between two selected coordinates is a boundary distance. It is not an
inclusive pixel count: cells numbered 10 through 13 are four cells, but the difference
13−10 is three. For a half-open arm occupying cells 10, 11, 12 and 13, measure boundary
14 minus boundary 10 to obtain length four. The user must identify the actual boundaries;
the application does not infer them from colors automatically.

## 4. Two-point algebra and why the UI asks for three distinct settings

For the ideal affine relationship

$$
y=B+Kx,
$$

two distinct settings determine a line:

$$
K=\frac{y_2-y_1}{x_2-x_1},\qquad B=y_1-Kx_1.
$$

Any two points admit such a line. That does not test linearity. The implemented fit
requires at least three distinct settings so there is at least some possibility of
observing inconsistency. Three points still do not prove the renderer is affine. Use
additional settings and hold out independent cases instead of repeatedly fitting and
evaluating on the same samples.

For a gap fit, $x$ is the native gap parameter and $y$ is a specified inner-edge offset
in current-resolution pixels. For a length fit, $y$ is the colored arm length. For a
width fit, avoid the saturation regime where minimum width dominates the relationship.
Mixed measurement kinds are not interchangeable even if their numeric columns look alike.

## 5. Centered least squares

For observations $(x_i,y_i)$, define means

$$
\bar x=\frac1n\sum_i x_i,\qquad\bar y=\frac1n\sum_i y_i.
$$

The implemented ordinary least-squares fit is

$$
\hat K=\frac{\sum_i(x_i-\bar x)(y_i-\bar y)}{\sum_i(x_i-\bar x)^2},
\qquad\hat B=\bar y-\hat K\bar x.
$$

Centering avoids some unnecessary cancellation compared with an uncentered normal-equation
formula. The denominator must be positive; at least three distinct settings are required.
The fitted slope must be finite and positive for the supported inverse use. The tool
rejects degenerate, decreasing or nonfinite datasets rather than producing an arbitrary
usable-looking number.

For each observation, store

$$
\hat y_i=\hat B+\hat Kx_i,\qquad e_i=y_i-\hat y_i.
$$

Report

$$
\operatorname{RMSE}=\sqrt{\frac1n\sum_i e_i^2},\qquad
 e_{\max}=\max_i|e_i|.
$$

The code also reports $R^2$ when total outcome variation is nonzero. None of these is a
native-validation probability. The 0.5-pixel residual warning in the UI is a diagnostic
threshold, not a statistically calibrated confidence level or automatic pass criterion.
A systematic half-pixel centering error may matter even when aggregate fit statistics
look excellent.

## 6. Quantization can invalidate an affine explanation

A genuine renderer can behave like

$$
y=B+Q(Kx)
$$

or like

$$
y=Q(B+Kx),
$$

which are not generally equal. It can also impose a minimum or switch behavior with
width parity. A straight line can approximate these functions over a small interval
without describing their exact thresholds.

Inspect residuals by setting, not only as a single RMSE. Alternating or sawtooth patterns
can indicate a quantizer. A slope change near the minimum can indicate saturation.
A jump when effective width changes by one can indicate a thickness-relative origin.
Do not remove “outliers” merely because they contradict the desired universal formula.

The current calibration tool fits an affine model and reports its limits. It does not
automatically select a quantized nonlinear model or estimate hidden shader parameters.
A future identified staircase model must receive its own version and fixtures. In the
current measured-gap branch the fitted intercept and slope are used directly—no silent
second quantization or resolution multiplier is added.

## 7. Invert the fit and examine discrete candidates

For target pixel quantity $y_*$, the ideal inverse is

$$
x_{\mathrm{ideal}}=\frac{y_*-\hat B}{\hat K}.
$$

The calibration panel reports nearby legal integers and their predicted residuals. It
reports when the ideal is outside the applicable range instead of inventing a valid
exact solution. The workbench's bounded solver performs exhaustive legal integer
search under its selected model.

If the result is negative for new gap, there may be a representability limitation. Do
not round it to zero and then discard the error. If the near edge matches but the far
edge cannot, a scalar gap parameter is not sufficient to reproduce the old placement.
If width differs, reconsider the width fit before interpreting a new gap intercept.

## 8. Uncertainty and correlated errors

Suppose $x_*=(a_*-B)/K$. A first-order sensitivity calculation gives

$$
\frac{\partial x_*}{\partial a_*}=\frac1K,\qquad
\frac{\partial x_*}{\partial B}=-\frac1K,\qquad
\frac{\partial x_*}{\partial K}=-\frac{a_*-B}{K^2}.
$$

With small independent uncertainties, an approximate variance would be

$$
\sigma_x^2\approx\frac{\sigma_a^2+\sigma_B^2}{K^2}
+\frac{(a_*-B)^2}{K^4}\sigma_K^2.
$$

But fit intercept and slope are usually correlated; measurements can also share a
center-origin error. The independence simplification can be misleading. If estimating
formal uncertainty, use the full covariance form $\nabla f^T\Sigma\nabla f$ and explain
the measurement-error assumptions. Quantization, saturation and discrete candidate
selection make this local differential approximation especially fragile at thresholds.

The app deliberately does **not** display invented confidence intervals from three
manually entered points. The derivation is included to show which quantities matter,
not to imply that their uncertainties have already been measured.

## 9. Scope and provenance are part of the result

A measurement JSON contains the schema version, quantity, provenance, game build,
current/authored heights, effective thickness, static-style flags, observation pairs,
notes and optional screenshot name/dimensions/hash. It does not contain the image bytes
or an invented `verified` flag. Imports explicitly reject unknown schema fields and
unsupported provenance values.

The synthetic example $(0,1),(2,3),(4,5)$ demonstrates $B=1$, $K=1$. It remains marked
`synthetic-example` when exported. User-entered data is labeled `user-entered`, not
“measured by this tool” or “Valve verified.” The math report retains the applied fit's
provenance, points and scope so a later reader knows where its parameters came from.

Applying a fit to the workbench requires a near-gap measurement with matching build,
heights and effective width. A later mismatch of height or effective width blocks that
scoped use. Selecting another hypothesis detaches it; manually typing B/K creates an
unscoped hypothesis rather than inheriting credibility from the old fit.

## 10. Native validation acceptance criteria

Before promoting a future formula to a stronger evidence label, retain original old/new
captures and exact settings; identify the tested build and resolution pair; verify
read-back values after application; measure both longitudinal edges and transverse
placement; test zero and positive widths, odd/even parity, negative legacy fractions,
larger discriminating arms and at least two non-unit scaling ratios; evaluate held-out
cases; and document every mismatch and out-of-scope behavior.

Repeat the experiment after a relevant update. Prefer a scoped claim such as “matched
these static, outline-free captures on this build and height” over “works for every
crosshair.” The project is designed to accumulate evidence and refine the model, not
to permanently preserve the first conjecture because it produced a pleasant preview.
