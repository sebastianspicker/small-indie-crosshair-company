# Community static conversion: solving for the new values

::: summary
The converter first fits the bar length and width, then the gap, using a model of
how the current game turns each setting into pixels. At the same resolution this
is three short formulas; at another resolution it searches all legal values of
each setting. When several choices are equally accurate it takes the one whose
whole shape matches best, and a small search around the result then looks for a
neighbour that draws the old crosshair strictly better. No step can make the
match worse than the plain conversion.
:::

::: key
Against `community-static-v2`, the current search improves shift-aligned overlap
on {{fig:generated.conversion-accuracy.totals.alignedImproved|int}} of
{{fig:generated.conversion-accuracy.totals.cases|int}} synthetic cross-height
cases and worsens it on
{{fig:generated.conversion-accuracy.totals.alignedRegressed|int}}
({{fig:generated.conversion-accuracy.after|version}} study; edge cases with
another target excluded).
:::

::: technical
## Question

Given the target of [Conversion goals](02-conversion-and-identifiability.md#goals)
and the old appearance of [Pixels, outlines and draw order](04-rendering.md),
which legal tuple $v\in\mathcal V$ should the converter export? The answer is
`solveCommunity` in `lib/solver/community.js`, model `{{fig:model.version|version}}`
for build {{fig:model.build|version}}; the forward equations are carried over
unverified from build 2000918 (source ledger, ADR-0011).

## Model

### The new drawing rule

A native value $x$ draws $P_r(x)$ pixels, with $P_r(0)=0$ and
$P_r(x)=\max(1,\operatorname{round}(xr))$ otherwise, $r=H_{\mathrm{cur}}/H_{\mathrm{auth}}$
(`communityDimension`). The gap is a centre radius: $a'=P_r(g)$ and
$b'=a'-(W' \bmod 2)$ (see [Pixels, outlines and draw order](04-rendering.md)). A
new thickness 0 is modelled as hiding the bars, so a visible old minimum is
exported as a positive width.

### Equal heights

At $H_{\mathrm{old}}=H_{\mathrm{cur}}=H_{\mathrm{auth}}$ the inverse is closed
form:

$$
\ell=\min(L,255),\qquad \theta=\min(\max(W,1),32),\qquad g=\min\bigl(\max(d+\lceil W/2\rceil,0),128\bigr).
$$

For odd $W$ the export draws the old pixels moved by one pixel up and left,
because the new odd bars are centred on $-\lceil W/2\rceil$ and the old ones on
$-\lfloor W/2\rfloor$; the report calls this *shifted* and warns
`pixel-centering-shift`.

### Other heights: exact axis search

$P_r$ is monotone, so `communityAxis` (`lib/solver/community-axis.js`) inverts
each axis by binary search: the smallest $x$ with $P_r(x)\ge y$ and its
predecessor bound the closest drawn sizes, and every native value drawing one of
the minimum-error sizes is kept (its plateau). Each drawn size is represented by
the value closest to the ideal $y/r$, then the smaller one. Length and width are
fitted first. For each candidate width $W'$ the gap is fitted to the radius of
the target's drawn edges,

$$
\rho(W')=\frac{a^{*}+b^{*}+(W' \bmod 2)}{2},
$$

which at equal heights gives the formula above. The domain has 256 lengths, 32
positive thicknesses and 129 gaps; the boundary searches find every plateau
without scanning them. On 15,360 research cases the axis evaluations fall from
6,583,140 to 366,064 with identical results
([structured-learning note](../research/structured-learning-2026-09-29.md)).

### Ties

At most two lengths, two widths and two gaps per width remain, so at most eight
shapes. `searchCommunity` (`lib/solver/community-search.js`) ranks them by

$$
\operatorname{IoU}_{\pm1}\ \text{(aligned overlap)},\quad\text{then }\operatorname{IoU},\quad\text{then }
\bigl(\lvert\ell-\ell_{\mathrm{ideal}}\rvert,\ell,\lvert\theta-\theta_{\mathrm{ideal}}\rvert,\theta,\lvert g-g_{\mathrm{ideal}}\rvert,g\bigr)
$$

lexicographically (ADR-0013). Plain overlap alone rewarded shapes that cover
the misplaced centre of an odd-width bar, which no setting can move. Ties occur
only at cross heights; on the corpus the aligned ranking changed 74 of 1,755
record-scope rows (48 records), all at cross heights, and a research audit had
found the same cluster in 468 of 2,108 tied synthetic cases (ADR-0013).

### Screen goal: exact endpoints {#screen-endpoints}

The screen goal keeps fractional target dimensions for fitting, but samples the
target pixels from the old integer drawing edges $e$ with exact rational
arithmetic (ADR-0023, since v9):

$$
c(e)=\left\lceil\frac{2eH_{\mathrm{cur}}-H_{\mathrm{old}}}{2H_{\mathrm{old}}}\right\rceil ,
$$

the cell boundary of $qe$ under the pixel-centre rule, computed with integer
products and a remainder-based ceiling. Scaling the near edge and the length
separately had turned an exact 12.5 into 12.500000000000002 and invented a
column: size 0.25, thickness 1.5, gap 8 at 1080 → 900 claimed aligned overlap 1,
while exact sampling gives a target of 6 px and 0.5. Rasters, the analytical
scorer, the appearance rules (`snapToCells`) and the ML mirror use these
endpoints. Old outlines stay in whole pixels at both heights, as both games
draw outlines in fixed pixels.

### Appearance window {#window}

After the dimension-first choice $v_0$, `refineAppearance`
(`lib/solver/community-refine.js`) scores a bounded window of tuples by the
shape check's aligned colour overlap and replaces $v_0$ only on a strict gain
(more than $10^{-9}$). It runs for legacy inputs with the corrections on, at
either goal (ADR-0024) and for every old outline width (ADR-0019), unless the
shape check of $v_0$ is already exact, shifted or empty.

- **Window.** Native values that draw within 3 px of the chosen bar length,
  within 3 px of its width and within $\rho_g$ px of its gap edge, in current
  pixels, or that lie within as many native steps when that reaches further
  (`pixelWindow`, one native value per drawn size). Thickness stays at least 1,
  and length at least 1 when $v_0$ draws arms.
- **Reach.** The gap reach follows the old shape's own edges $a, b$ (and a dot's
  outline edge):

$$
\rho_g=\min\Bigl(32,\ \max\bigl(4,\ \lceil\max(\lvert a\rvert,\lvert b\rvert)\rceil+2,\ [\text{dot}]\,(\lceil W/2\rceil+2)\bigr)\Bigr),
$$

  and the width reach is $\min(\rho_g, 8)$ when that exceeds 3. The caps keep
  the worst input (size 0, thickness 6, gap −30, dot, $u=3$) at 6,848
  evaluations; the cap of 8 changed no export in either oracle sweep (ADR-0019).
- **Outer edge.** For every gap $g$ a second length window $\pm3$ is centred on
  $\ell_0+g_0-g$, which keeps the outer end of the bars where $v_0$ put it.
- **Score.** $\operatorname{IoU}_{\pm1}$ of old core and outline (old draw
  order) against new core and outline with the outline mode actually exported,
  including a hand choice; ties go to raw IoU, then to the preference order.
- **T flag.** Under the T option `auto`, a flippable T shape also tries every
  tuple with the other flag, which must win strictly
  ([T shapes](13-what-decides-the-export.md#t-shapes)). Under `keep`, `on` and
  `off` the flag is fixed.

### Plain fallback

Whenever an appearance rule or the window changed the export, the plain
dimension-first conversion (corrections off) is solved as well and exported
instead if its aligned shape check is strictly higher, scored with the actual
exported outline (`corrections-fallback`). Corrections therefore never score
below the plain conversion; a hand-chosen outline can change the final tuple or
T flag through this comparison (ADR-0022).

## Result

- **Against v2.** Of the {{fig:generated.conversion-accuracy.totals.cases|int}}
  cross-height cases, {{fig:generated.conversion-accuracy.totals.alignedImproved|int}}
  gain aligned overlap and none lose it; in plain overlap
  {{fig:generated.conversion-accuracy.totals.improved|int}} gain and
  {{fig:generated.conversion-accuracy.totals.rawRegressed|int}} lose, the trade
  the aligned tie rule accepts. Exact matches rise from
  {{fig:generated.conversion-accuracy.totals.exactBefore|int}} to
  {{fig:generated.conversion-accuracy.totals.exactAfter|int}};
  {{fig:generated.conversion-accuracy.totals.edgeCasesExcluded|int}} edge cases
  with another target are excluded.
- **Search completeness.** A brute-force oracle scores every tuple in a bounded
  box with the converter's own measure
  ([oracle sweeps](../research/oracle-sweeps-2026-10-05.md)). At 1080 it finds
  0 better tuples on 5,000 plain inputs and 18 on 2,000 exotic ones; nine
  cross-resolution sweeps (7,200 inputs, 720 to 1440) find 11. Every remaining
  shortfall is a wide old outline, a stroke beyond the 32 px reach, or a role
  swap outside the width reach.
- **Window.** On an independent geometry audit of 118,552 cases the window
  changed 3,211 exports, all better on the audit's measure and none worse
  (ADR-0017). The v10 screen refinement improved 162 of 400 frozen v9 cases
  with no aligned-overlap regression (ADR-0024).
- **Cost.** A local run over 50 screen cases measured a median of 15.7 ms, a
  95th percentile of 119.1 ms and a maximum of 216.0 ms; these are diagnostics,
  not a contract, and the browser runs the search in a worker.

## Limits

The window is bounded and local, and ties keep the dimension-first result, so
the export is the best tuple found, not a certified optimum. At unequal heights
some drawn sizes are unreachable (at $r=1.5$, 1, 4 and 7 px), and the lower
overlap there is representability under the model, not a search failure. The
oracle uses the converter's own objective; whether that objective is what the
game shows is the open question of the [Introduction](intro.md). The six
converter choices on the page are this model, the historical hedge and four
authored-height controls; reports use schema `sicc-quant-report-v6`.
:::
