# Model families: 27 guesses about the new renderer

::: summary
Before any converter had a tested model of the new game, this project wrote down
27 explicit guesses about how the new settings become pixels: three ways to scale
with resolution, three ways to round, and three places the gap could be measured
from. Each guess gives its own conversion. The study is kept as a historical
sensitivity analysis and as a plan for which screenshots would tell the guesses
apart; the automatic converter no longer uses it.
:::

::: key
Under its own assumptions the authored/truncation/thickness guess reproduces
{{fig:generated.quant-study.scenarios.id=authored:trunc:thickness.exactUnderOwnGeometryModel|int}}
of {{fig:generated.quant-study.scenarios.id=authored:trunc:thickness.testedGeometryHeightCells|int}}
corpus geometry-height cells exactly; such self-consistency says nothing about
which guess the game uses.
:::

::: technical
## Question

Which conversions follow from each explicit hypothesis about the new renderer,
and where do the hypotheses disagree? The study (`quant-static-v6`,
`lib/solver/renderer.js`, `inverse.js`, `inference.js`) targets build 2000914
with $\theta\in0..31$ and the historical old model `legacy-static-kz-f32-v1`.

## Model

### Variables

An old configuration is $x=(S,T,G,\text{dot},\tau)$ at $H_{\mathrm{old}}$; the
old target is $z=(L,W,a,b_{\mathrm f})$ from
[Legacy geometry](01-legacy-geometry.md) with $b_{\mathrm f}=a+1$. A legal new
tuple is

$$
v=(\ell,\theta,g,H_{\mathrm{auth}}),\qquad \ell\in\{0,\dots,255\},\ \theta\in\{0,\dots,31\},\ g\in\{0,\dots,128\},
$$

and the inverse problem under hypothesis $m$ is

$$
v^{*}_m=\operatorname*{arg\,min}_{v\in\mathcal V}\ \mathcal L\bigl(R_m(v;H_{\mathrm{cur}},H_{\mathrm{auth}}),\,z^{*}\bigr),
$$

with $z^{*}=z$ (pixel goal) or $qz$ (screen goal). Without knowing $R_m$ the
inverse has competing answers, so the preview names the hypothesis it draws.
Colour, outline, blending and motion are outside this objective.

### Scale

| Family | Scale $r_m$ | Ideal length |
|---|---|---|
| Authored | $H_{\mathrm{cur}}/H_{\mathrm{auth}}$ | $L^{*}H_{\mathrm{auth}}/H_{\mathrm{cur}}$ |
| Fixed 1080 | $H_{\mathrm{cur}}/1080$ | $1080L^{*}/H_{\mathrm{cur}}$ |
| Fixed 720 | $H_{\mathrm{cur}}/720$ | $720L^{*}/H_{\mathrm{cur}}$ |

The authored family follows the authored-height cvar; the fixed families are
sensitivity alternatives. At $H_{\mathrm{auth}}=H_{\mathrm{cur}}=1080$ the first two
agree (old size 2 gives length 4) and the third asks for $8/3$; at
$H_{\mathrm{auth}}=960$, $H_{\mathrm{cur}}=1440$ all three differ.

### Rounding

$$
Q_{\mathrm{trunc}}(x)=\lfloor x\rfloor,\qquad Q_{\mathrm{nearest}}(x)=\lfloor x+\tfrac12\rfloor,\qquad Q_{\mathrm{ceil}}(x)=\lceil x\rceil ,
$$

each with an inverse interval for a drawn integer $k$: $[k,k+1)$, $[k-\tfrac12,k+\tfrac12)$
and $(k-1,k]$. Dividing by $r_m$ and intersecting with the legal integers gives
the exact candidates; an empty intersection leaves a reported residual. The new
side runs in binary64; only the old side emulates binary32.

### Thickness

$$
W'_m(v)=\max\bigl(1,\,Q_m(r_m\theta)\bigr),
$$

with ideal values $W^{*}/r_m$. A literal old $T=0$ keeps $\theta=0$ for
cvar-derived targets; an image target cannot know whether the old value was 0,
so the branch is not imposed there. Ties go to the lowest loss, then to the
value nearest the ideal, then to the smaller integer.

### Gap

With $c=Q_m(r_mg)$:

| Family | Near edge $a'$ | Ideal gap |
|---|---|---|
| Thickness-relative | $\lfloor W'/2\rfloor+c$ | $(a^{*}-\lfloor W'/2\rfloor)/r_m$ |
| Centre-relative | $c$ | $a^{*}/r_m$ |
| Full opening | $(c-1)/2$ | $(2a^{*}+1)/r_m$ |

Every family draws $b'_{\mathrm f}=a'+1$. Gap fitting minimises both edges,

$$
E_G(g)=\bigl(a'_m(g)-a^{*}\bigr)^2+\bigl(b'_{\mathrm f}(g)-b^{*}_{\mathrm f}\bigr)^2,
$$

and a pure dot ($L=0$) contributes no gap loss and no gap evidence. The manual
lab's affine gap $a'=B+Kg$ is kept out of this family: an unconstrained fit
would need its own prior and complexity penalty.

### 27 scenarios

Three scales, three quantizers and three gap families give $3\times3\times3=27$
scenarios, each using one quantizer for every dimension. The prior gives each
scale family one third, split equally among its nine members. The family
excludes per-field quantizers, free offsets, dynamic states and arbitrary
shaders: 27 is a bounded sensitivity set, not the set of possible renderers.

### Search and refinement (v4)

The v4 search solved length, then width, then gap per scenario (fewer than 420
integer evaluations each instead of $256\times32\times129$), then refined each
proposal against the frozen target mask over the $\{-1,0,1\}^3$ neighbourhood
for at most two passes, accepting a step only if the mask loss falls, or stays
equal while the geometry loss falls. Every distinct tuple was then scored under
all 27 scenarios, so an own-model perfect fit cannot become a recommendation by
itself. The joint inverse that replaced the width-first step in v5 is in
[Historical joint solver](09-solver-and-integrity.md).

## Result

For an old 2 px bar at gap $-4$ ($a^{*}=1$, $b^{*}_{\mathrm f}=2$) at unit
scale, the three gap families ask for gaps 0, 1 and 3, and each matches its own
simulator exactly. At 1080, old thickness 2 draws 4 px, not the 5 that rounding
4.5 would give; at 1440 old thickness 1 draws 3 px, which a fixed factor 2
misses. The synthetic inversion over the corpus cells reports, per scenario,
own-model exact matches and ideal values outside the legal range
(`research/generated/quant-study.json`); it tests representability, not truth.

## Limits

Every number here is conditional on the 27 declared hypotheses and the
historical old model. Direct assignment (truncating old numbers into new
ranges) is a counterfactual preview, not Valve's migration.
:::
