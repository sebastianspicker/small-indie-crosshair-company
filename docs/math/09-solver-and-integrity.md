# Historical joint solver and evidence integrity

::: summary
Version 5 of the historical study fitted thickness and gap together instead of
one after the other, scored whole shapes exactly instead of on a cropped
preview, and made the statistics robust against a single bad screenshot or a
duplicated one. These changes make the 27-guess study correct on its own terms.
They add no screenshot of the new game, so they cannot say which guess is right.
:::

::: key
Over {{fig:generated.inverse-comparison.cases|int}} corpus cases
({{fig:generated.inverse-comparison.uniqueGeometryGroups|int}} geometries, seven
heights, {{fig:generated.inverse-comparison.models|int}} hypotheses) the joint inverse lowers the geometry loss in
{{fig:generated.inverse-comparison.strictlyLowerGeometryLoss|int}} cases and
raises it in {{fig:generated.inverse-comparison.higherGeometryLoss|int}}.
:::

::: technical
## Question

Within the 27-hypothesis study of [Model families](05-model-families.md), how
are the inverse, the shape score and the evidence update made exact on their
declared domains? Implementation `quant-static-v5` (release 0.3.0), today
`quant-static-v6`: `lib/solver/inverse.js`, `certify.js`, `selection.js`,
`visual.js`, `evidence.js`, `observations.js`, `lib/geometry/pixel-shape.js`.

## Model

### Joint thickness and gap

The target is $y=(L,W,a,b_{\mathrm f})$ and the domain
$\mathcal D=\{0..255\}\times\{0..31\}\times\{0..128\}$ at fixed $H_{\mathrm{auth}}$.
For a thickness-relative gap, changing the width changes the gap baseline, so a
nearest width can force a poor gap. The v5 objective is

$$
J(\ell,\theta,g)=(L'-L)^2+(W'-W)^2+\mathbf 1_{L>0}\bigl[(a'-a)^2+(b'_{\mathrm f}-b_{\mathrm f})^2\bigr],
$$

with unit weights chosen by design, not fitted to perception. Length is
separable and searched over 256 values; for each of the 32 thicknesses all 129
gaps are scored against both edges, at most $256+32\cdot129=4384$ scalar
evaluations per hypothesis. The enumeration proves the minimum of $J$ on
$\mathcal D$ under one hypothesis; the report records it as
`inverseCertificate.stage = initial-geometry-inverse` and never attaches it to
the later, visually refined tuple. Literal old $T=0$ fixes $\theta=0$ for
cvar inputs; image inputs are not restricted.

At 2160, size 2, thickness 0.5, gap −7 reconstruct to $(9,2,-2,-1)$. Width
first chooses width 2, gap 0, edges 1 and 2, edge loss 18. The joint solve
chooses width 1, gap 0, edges 0 and 1, total width and edge loss
$1+4+4=9$. This case is a permanent regression test.

### Both edges

For hypotheses with $b'_{\mathrm f}=a'+1$,

$$
(a'-a)^2+(a'+1-b_{\mathrm f})^2=2(a'-\bar a)^2+\frac{(a+1-b_{\mathrm f})^2}{2},\qquad \bar a=\frac{a+b_{\mathrm f}-1}{2},
$$

so the ideal near edge is the midpoint $\bar a$, and with $a'=B(W')+c\,Q(rg)$

$$
g^{*}=\frac{\bar a-B(W')}{c\,r},
$$

where $(B,c)$ is $(\lfloor W'/2\rfloor,1)$, $(0,1)$ or $(-\tfrac12,\tfrac12)$
for the thickness-relative, centre-relative and full-opening families. $g^{*}$
is only a tie reference; every legal integer is scored with the quantized
forward function. A measured pair $(1,6)$ under the centre-relative model at
unit scale has $\bar a=3$: no gap fixes a five-pixel separation while the model
insists on one, and the residual stays visible.

### Complete preimages

`exactPreimage` returns every legal tuple that draws the target exactly under
one hypothesis, as integer boxes: per reachable thickness, run-length intervals
of lengths and gaps, a count and a deterministic sample of at most 64 tuples
(`report.preimage`). Worked cases are in
[Certified inverse and capture plan](11-certified-inverse-and-capture-plan.md).

### Exact shape score

Shapes are unions of at most five rectangles. `pixel-shape.js` compiles a union
into disjoint vertical bands with merged intervals, so overlaps count once, and
a two-pointer sweep gives

$$
\operatorname{IoU}(A,B)=\frac{\lvert A\cap B\rvert}{\lvert A\rvert+\lvert B\rvert-\lvert A\cap B\rvert}
$$

under the pixel-centre rule of [Pixels, outlines and draw order](04-rendering.md).
Cost depends on edges, not on canvas size; on 1,000 seeded pairs the dense and
analytical scores agree exactly. Two empty shapes have no IoU. A cropped image
target, or a candidate leaving the observed frame, cannot claim a whole-image
match.

### Decision rules

Each scenario starts from its certified geometry inverse and runs at most two
passes over the 26 neighbours. Distinct tuples are then scored under all 27
scenarios with losses $\ell_m(v)$, and one of three declared rules picks:

$$
R_{\pi}(v)=\sum_m\pi_m\ell_m(v),\qquad R_{\max}(v)=\max_m\ell_m(v),
$$

and `cvar`, the mass-weighted mean of the worst half of the declared weight
($\alpha=0.5$). The best proposal gets two more passes against the decision
loss, plus one probe of the lengths two steps away to cross a quantization
plateau: at most $27+2\cdot26+2=81$ tuples
(`bounded-neighborhood-plus-length-two-v1`). Old settings size 3, thickness 0,
gap −1 at 720 move from length 4 (expected loss 0.40171) to length 6 (0.39658).
`infer({ certify: true })` adds the certified expansion of
[Certified inverse and capture plan](11-certified-inverse-and-capture-plan.md).
The preview draws the selected or highest-weight hypothesis, with prior ties
going to authored/truncation/thickness-relative.

### Robust likelihood

For a measurement with standardized residuals $z_j=(\hat y_j-y_j)/\sigma$ over
$d$ features ($d=4$ for bars, 2 for a pure dot) and $q_z=\sum_j z_j^2$:

$$
p(z\mid m)=0.95\,\phi_d(z)+0.05\,t_{4,d}(z;8),\qquad
t_{\nu,d}(z;s)=\frac{\Gamma\bigl(\tfrac{\nu+d}{2}\bigr)}{\Gamma\bigl(\tfrac{\nu}{2}\bigr)(\nu\pi)^{d/2}s^{d}}
\Bigl(1+\frac{q_z}{\nu s^{2}}\Bigr)^{-(\nu+d)/2}.
$$

In the tail the negative log density grows with $\log q_z$ instead of $q_z$,
which bounds the influence of one gross error. The 5% contamination, 4 degrees
of freedom, scale 8 and diagonal noise are declared, not fitted. Log likelihoods
are averaged within a capture group and summed across groups; holdouts,
synthetic records and old configurations never update weights.

### Evidence integrity

Hashes are case-normalized; capture and session ids live in separate
namespaces. Groups are the transitive closure of shared hash or session, formed
before duplicates are removed, so renaming a copy cannot split a group, and a
group cannot be both calibration and holdout. One hash with conflicting
settings, scope, geometry or noise is rejected. The screenshot dialog
invalidates a fit when crop, colour or tolerance changes. The worker runs one
task at a time with one queued inference, enforces deadlines by terminating, and
both export paths share one allowlisted command formatter.

## Result

The joint inverse never raises the initialization loss and lowers it in the
cases counted above (`research/generated/inverse-comparison.json`). Seeded cases
match a separate exhaustive width-and-gap oracle. A learned distillation of this
solver and a learned shortlist were measured and rejected
([Learned emulators](10-learned-emulator.md)).

## Limits

These are guarantees about declared objectives on declared domains. The
bounded decision search is not the declared optimum in every case (measured in
[Certified inverse and capture plan](11-certified-inverse-and-capture-plan.md)),
and the likelihood constants would need reviewed captures to be calibrated.
:::
