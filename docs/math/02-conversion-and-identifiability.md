# Conversion goals and identifiability

::: summary
"The same crosshair" can mean two things: the same pixels on the game image, or
the same share of the screen height when your resolution changes. The converter
offers both and uses the same pixels by default. A second question is what the
new game does with the new settings, and old settings cannot answer it: any
number of old crosshairs tells us how the old game drew, never how the new one
draws. Only screenshots of the new game can settle the remaining choices, so the
converter states the assumptions it uses.
:::

::: key
For an old 2 px bar at gap −4 at equal heights, three plausible readings of the
new gap suggest new gaps 0, 1 and 3, and each one reproduces the old edges
exactly in its own model; no amount of old data separates them.
:::

::: technical
## Question

Two questions are separated here. First, which target should a conversion
reach? Second, which parts of the new game's drawing rule can be learned from
the data the repository holds? The manual lab (`lib/manual/conversion.js`, model
`conditional-static-v4`) exposes every assumption of this chapter as a control;
the automatic converter fixes them as described in
[Community static conversion](12-community-conversion.md).

## Model

### Four things called "size"

1. The old console value, such as `cl_crosshairsize 2`.
2. The old drawn arm, such as $L=4$ at 1080.
3. A website generator's preview coordinates.
4. The new values at their authored height $H_{\mathrm{auth}}$.

Only the map from 1 to 2 is source-derived. The map from 4 to drawn pixels is
a hypothesis: the build inventory names `cl_crosshair_screen_height` as the
height used when authoring size settings, says editing a size updates it, and
describes length and thickness as resolution-scaled with a one-pixel minimum.
It shows no arithmetic, pixel origin, quantizer or migration function. The
working hypothesis multiplies a stored dimension by $r=H_{\mathrm{cur}}/H_{\mathrm{auth}}$
before quantization. Website coordinates identify none of this.

### Two goals {#goals}

The **pixel goal** keeps the old drawn geometry:

$$
(L^{*},W^{*},a^{*},b^{*})=(L,W,a,b).
$$

The **screen goal** scales the old drawn geometry by $q=H_{\mathrm{cur}}/H_{\mathrm{old}}$:

$$
(L^{*},W^{*},a^{*},b^{*})=q\,(L,W,a,b).
$$

It scales the already quantized old pixels; it does not rerun the old renderer
at $H_{\mathrm{cur}}$, because the old gap was not height-scaled. Targets can be
fractional, and the inverse reports the residual where no legal tuple reaches
them. How the screen target is sampled into whole pixels is in
[Community static conversion](12-community-conversion.md#screen-endpoints). At
equal heights the two goals are the same target and give identical exports
(ADR-0024). Neither goal models a monitor's own scaler.

### New-dimension hypotheses of the manual lab

The lab predicts

$$
L'=Q(r\ell),\qquad W'=\max(1,Q(r\theta)),
$$

with $Q$ truncation or nearest with ties up; neither is known to be Valve's. At
$r=1$ the ideal values are $\ell\approx L^{*}$ and $\theta\approx W^{*}$; in
general $\ell_{\mathrm{ideal}}=L^{*}/r$ and $\theta_{\mathrm{ideal}}=W^{*}/r$.
Under truncation every legal integer in $[L^{*}/r,(L^{*}+1)/r)$ draws the same
length, so there may be several, one or no exact values, and the midpoint of
that interval need not be legal.

### The zero-thickness branch

Old $T=0$ draws $W=1$. If a stored new $\theta=0$ also means "minimum width at
every height" while $\theta=1$ scales to 2 px at $r=2$, the lab keeps $\theta=0$
for an old literal zero. Under the screen goal at 2160 this conflicts with the
2 px target; the lab keeps the branch and reports the 1 px residual. The
automatic converter models the new zero as hiding the bars and never exports
it (see [Community static conversion](12-community-conversion.md)).

### Gap hypotheses

The near edge to reach is $a^{*}$, which already contains the half width. The
lab models the new near edge as

$$
a'=B(W')+Q(r_g\,g),\qquad
B(W')=\lfloor W'/2\rfloor\ \text{(thickness-relative)}\quad\text{or}\quad B(W')=0\ \text{(centre-relative)},
$$

so that

$$
g_{\mathrm{ideal}}=\frac{a^{*}-B(W')}{r_g}.
$$

$W'$ is the width the solver chose, not $W$: substituting the old width hides
an error when the width cannot match. At $r_g=1$ with an exact width the
thickness-relative case reduces to $g=d=\operatorname{trunc}(G+4)$ and the
centre-relative case to $g=\lfloor W/2\rfloor+d$. The gap ratio $r_g$ is a
separate hypothesis: the inventory says length and thickness scale, not the
gap, and the old renderer never scaled it. Under `same-as-length`
$r_g=r$; under `unscaled` $r_g=1$. A stored length 9, thickness 2, gap 1 at
$H_{\mathrm{auth}}=1080$ shown at 2160 predicts width 4 and near edge 4 under
the first and 3 under the second (correction C07 of the
[formula history](../research/formula-evolution.md)). At $r=1$ both agree, which
confirms neither.

The old $+4$ lives in the old painter. `renameCandidate` truncates the raw old
gap and drops it; `pixelCopyCandidate` and the structural inverse copy the drawn
offset, which includes it. For size 3.9, thickness 0.6, gap 0 at 1080, rename
gives gap 0 and pixel copy gives 4. Fitting the $+4$ again as a bias would count
it twice.

### Measured affine gap

With scoped measurements the lab uses

$$
a'(g)=B+Kg,\qquad K>0,\qquad g_{\mathrm{ideal}}=\frac{a^{*}-B}{K},
$$

with $B$ in current pixels and $K$ in current pixels per gap unit; neither is
multiplied by $r$ again and no second quantizer is applied. The fit is
accepted only for its recorded build, heights, effective width and static
style, and editing $B$ or $K$ by hand detaches it. Fitting is in
[Calibration and capture protocol](03-calibration-protocol.md).

### Both edges

The lab draws the far edge as $b'=a'+\delta$ with $\delta=1$ by default, a
hypothesis inherited from the old reconstruction. If the near edge matches but
$\delta\ne b^{*}-a^{*}$, no scalar gap repairs the far edge, and the report
carries `farError` instead of an exact claim. Under the screen goal
$b^{*}-a^{*}=q$, so a fixed $\delta=1$ cannot match both edges when $q\ne1$.

### Bounded search and ties

Per dimension, with predicted pixels $P(x)$ for a legal integer $x$ and target
$y$, the lab evaluates

$$
x^{\ast}\in\operatorname*{arg\,min}_{x\in\mathcal V}\lvert P(x)-y\rvert ,
$$

over 256 lengths, 32 thicknesses and 129 gaps, in the order length, thickness,
gap. Ties go to the value closest to the continuous ideal, then to the smaller
integer. This is a sequential per-dimension rule, not a joint optimum of the
drawn shape. `geometryExact` means length and width agree and, when arms
exist, near and far agree, within the selected model.

### Identifiability

Old inputs and their old pixels constrain the old renderer only. Under the
assumption that published old settings do not depend on how the new renderer
was implemented, $p(M=m\mid X_{\mathrm{old}})=p(M=m)$ for any new-renderer
hypothesis $m$ (derivation in [Statistical inference](06-statistical-inference.md)).
Matching two of our own previews is circular, since both come from our
assumptions. Informative inputs sit at quantization boundaries: old size 4 at
1080, thickness 0, negative fractional gaps, odd and even widths, and several
ratios $r\ne1$.

## Result

For an old bar of width 2 at gap $-4$ ($a^{*}=1$, $b_{\mathrm f}=2$) at $r=1$,
the thickness-relative, centre-relative and full-opening readings (the third
from [Model families](05-model-families.md)) suggest gaps 0, 1 and 3. A native
gap-0 screenshot at that width would separate the first two. The eight original
presets cannot separate a fixed factor 2 from the old scale at 960 or 1080,
while seven heights separate them in 32 of 56 cases; that count describes this
test matrix, not a probability of error.

## Limits

The commands are a candidate for the player to inspect and apply; they do not
change the resolution, bind keys or touch the game process. Apply them at the
in-game resolution, set the authored height last (a size edit can update it),
and read every value back. Do not mix hidden legacy cvars into the same
configuration; their migration effects were not inspected. The full name map
is in [settings migration](../research/settings-migration.md).
:::
