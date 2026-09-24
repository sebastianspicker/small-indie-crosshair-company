# 05 — Competing renderer families and inverse conversion

**Version note:** the v4 derivation below is preserved. [Chapter 09](09-solver-and-integrity.md) specifies the implemented v5 joint inverse, full-domain shape metric, robust likelihood and evidence-integrity changes.

Research snapshot: **2026-09-23**, target build **2000914**, implementation
`quant-static-v4`. Read [sources](../research/quant-sources.md) and
[the confidence chapter](06-statistical-inference.md) before treating any
percentage as evidence about the actual game.

This chapter extends, rather than replaces, chapters 01–04. Their frozen
historical reconstruction remains the reference. The new project does not
pretend that a large legacy dataset reveals an unobserved native renderer.
It makes the candidate explanations executable, distinguishes their
predictions, solves their bounded inverse problems, and records what
additional observations could discriminate them.

## 5.1 Variables, measurement conventions, and the inverse problem

Let an old configuration be

\[
x=(S,T,G,d,t),
\]

where size, thickness and gap are real-valued old cvars, `d` is the dot flag,
and `t` is the T-shape flag. Let \(H_o\) be the old game height, \(H\) the new
game height and \(A\) the new authored height. Heights are actual in-game
pixel dimensions, not the monitor's native dimensions or a web preview's
CSS height. Color and alpha are transferred separately. Our objective
optimizes the colored core, not outlines, antialiasing, blending, movement,
recoil, or a particular weapon's dynamic gap.

An admissible new tuple is

\[
v=(L_n,T_n,G_n,A),\quad
L_n\in\{0,\ldots,255\},\;
T_n\in\{0,\ldots,31\},\;
G_n\in\{0,\ldots,128\}.
\]

These ranges and the existence of the authored-height cvar are documented
in distributed game data [Q04]. The cvar inventory is not the native
shader, a promise of integer-to-pixel equivalence, or the implementation
of the game's automatic migration callbacks.

We use a compact geometry vector

\[
z=(L,W,a,b),
\]

with arm length, colored width, near inner-edge offset, and far inner-edge
offset. Left and top arms are the near arms. Right and bottom arms are the
far arms. For a rectangle on the horizontal axis, its coordinates are
`[-a-L, -a)` on the left and `[b, b+L)` on the right. Coordinates are
half-open intervals relative to the selected center pixel. This convention
must accompany native measurements; an off-by-one definition can otherwise
look like a renderer change.

The task is not simply to rename three variables. It is to find a legal
\(v\) for which a new renderer's output resembles a historical target:

\[
v^*=\arg\min_{v\in\mathcal V}
\mathcal L\bigl(R_m(v;H,A),z_*\bigr).
\]

The index \(m\) matters. Without knowing \(R_m\), the inverse has competing
answers. The UI shows the renderer assumption beside both new previews.

## 5.2 Historical reconstruction and target selection

The executable old baseline [Q05] is

\[
s_o=\operatorname{f32}(H_o/480),
\]
\[
L_o=\operatorname{trunc}(\operatorname{f32}(s_o\operatorname{f32}(S))),
\quad
W_o=\max\{1,\operatorname{trunc}(\operatorname{f32}(s_o\operatorname{f32}(T)))\},
\]
\[
p_o=\operatorname{trunc}(\operatorname{f32}(\operatorname{f32}(G)+4)),
\quad
 a_o=\lfloor W_o/2\rfloor+p_o,
\quad b_o=a_o+1.
\]

Truncation is toward zero. For example, `G=-4.5` gives `trunc(-0.5)=0`,
not `-1`. The term \(G+4\) is a raw-pixel offset; it must not be multiplied
by \(H_o/480\). Quantization happens after scaling size and thickness.

The **same-pixel** goal uses \(z_*=z_o\). The **screen-relative** goal uses
\(z_*=(H/H_o)z_o\), prior to new rasterization. The latter can produce
fractional targets for which no legal tuple has exact pixel equivalence.
The screen-relative target is a clearly chosen convention, not a claim
that the old renderer scales all its fields this way: its gap did not.

A screenshot instead supplies measured target geometry and a segmented
mask. It does not identify the old cvars uniquely. This version accepts
image masks in same-pixel mode, or same-height screen-relative mode.
Changing an image target to a different screen-relative resolution is
rejected, rather than secretly changing the measured mask by interpolation.

## 5.3 Three scale formulae for length

The project explicitly carries three scale hypotheses:

| Family | Forward scale \(r_m\) | Ideal inverse length |
|---|---|---|
| Authored pixels | \(H/A\) | \(L_n^*=L_*A/H\) |
| Fixed 1080 reference | \(H/1080\) | \(L_n^*=1080L_*/H\) |
| Fixed 720 reference | \(H/720\) | \(L_n^*=720L_*/H\) |

Thus there are at least three distinct conversion formulae for length,
not three different labels for one multiplier. The authored-pixel family
is motivated by the authored-height variable. The fixed-reference families
are **sensitivity alternatives**, not verified Valve behaviors. In
particular, an external website's coordinate convention cannot establish
that native CS2 uses the same reference.

At \(A=H=1080\), an old size `2` gives \(L_o=4\). Authored pixels and the
fixed-1080 family both suggest new length `4`; the fixed-720 family's ideal
is \(8/3\). Integer legal search must then determine what that latter
family can actually represent. Comparing only the first two families at
1080p cannot distinguish them. At \(A=960,H=1440\), their scales differ;
that is an informative experiment.

For nonnegative rendered dimensions, each scale is paired with three
quantizers:

\[
Q_{\rm trunc}(u)=\lfloor u\rfloor,\qquad
Q_{\rm nearest}(u)=\lfloor u+1/2\rfloor,\qquad
Q_{\rm ceil}(u)=\lceil u\rceil.
\]

`nearest` uses ties upward, not banker's rounding. The new simulation uses
JavaScript binary64 operations; this is not a recovered C++ arithmetic
sequence. Only the old baseline deliberately emulates the inspected
binary32 intermediate operations. Do not infer native floating-point
semantics from this simulator.

A desired rendered integer \(k\) defines an inverse interval rather than
a unique unquantized value:

\[
Q_{\rm trunc}(u)=k\iff u\in[k,k+1),
\]
\[
Q_{\rm nearest}(u)=k\iff u\in[k-1/2,k+1/2),
\]
\[
Q_{\rm ceil}(u)=k\iff u\in(k-1,k].
\]

Divide each interval by \(r_m>0\), intersect with the legal integer cvar
set, and exact candidates become evident. If that intersection is empty,
nearest legal search reports residual error rather than inventing a value.

## 5.4 Three thickness formulae and the minimum branch

The same scale alternatives produce ideal nonzero thicknesses:

\[
T_{n,A}^{*}=W_*A/H,\quad
T_{n,1080}^{*}=1080W_*/H,\quad
T_{n,720}^{*}=720W_*/H.
\]

Every forward family enforces the documented minimum:

\[
W_m(v)=\max\{1,Q_m(r_m T_n)\}.
\]

Literal old thickness zero is preserved as a distinct candidate branch:

\[
T_n=0\quad\text{when }T_o=0
\]

for cvar-derived targets. This preserves the minimum-width intent across
resolutions. It is not equivalent to storing a positive thickness `1`,
which may subsequently scale above one pixel. For image-derived targets
we cannot know whether the original cvar was zero; therefore the solver
does not impose the zero branch on a screenshot's representative value.
It reports that ambiguity in the old-value buckets.

For old thickness `2` at 1080p, the source baseline predicts width `4`,
not the `5` produced by rounding `4.5`. A one-pixel difference is large
for a compact dot. At 1440p, old thickness `1` predicts `3`, which a fixed
`×2` shortcut misses. These are arithmetic examples, not empirical
measurements of the native new renderer.

There may be multiple legal cvars producing a one-pixel width. The solver
selects the lowest-loss candidate, then the candidate nearest the ideal
real-valued inverse; ties left after that are resolved by ascending integer
iteration. The rule is deterministic and tested.

## 5.5 Three gap interpretations, including both edges

First choose a new width under the current model. Then define

\[
u=Q_m(r_mG_n).
\]

The three supported gap interpretations are:

| Family | Near edge \(a_n\) | Ideal inverse gap |
|---|---|---|
| Thickness-relative | \(\lfloor W_n/2\rfloor+u\) | \((a_*-\lfloor W_n/2\rfloor)/r_m\) |
| Center-relative | \(u\) | \(a_*/r_m\) |
| Full-opening | \((u-1)/2\) | \((2a_*+1)/r_m\) |

These supply three explicit gap conversion formulae. All currently
implemented forward scenarios use \(b_n=a_n+1\), an exposed centering
assumption. Native screenshot measurement **does not enforce** that
relation. A native capture inconsistent with it can therefore reject all
families. This release does not enumerate every possible centering
convention, shader coverage rule, or UI migration mechanism.

The generalized affine version retained in the manual calibration lab is

\[
a_n=B+KG_n,\qquad G_n^*=(a_*-B)/K.
\]

It needs independent measurements of \(B\) and \(K\), scoped to height,
authored height, effective thickness, style and build. It is not silently
mixed into the 27-family posterior: the manual affine tool is exploratory,
whereas the automatic posterior has a fixed explicit family set. A future
parametric affine family would need an identified prior and complexity
penalty, not an unconstrained fit rewarded on its own training samples.

For an old two-pixel-wide crosshair with gap `-4`, the baseline has
\(a_*=1,b_*=2\). At unit scale, thickness-relative, center-relative and
full-opening inverses suggest gaps `0`, `1` and `3`, respectively. Each can
match its own simulator exactly. That self-consistency does not identify
which new cvar is right in the actual game.

Gap optimization minimizes

\[
E_G(g)=\{a_m(g)-a_*\}^2+\{b_m(g)-b_*\}^2.
\]

Both edges are included. If the measured far edge differs from the assumed
near-plus-one relation, an average near match cannot be reported as exact.
For a pure dot the gap is unobservable, so the gap loss is zero and gap
values do not count as additional evidentiary agreement.

## 5.6 Why there are 27 complete scenarios

The Cartesian product of three scales, three quantizers and three gap
interpretations contains \(3\times3\times3=27\) scenarios. Each uses one
quantizer consistently for all dimensions. The scope deliberately excludes
independently selecting 3 quantizers for each field, free offsets, rotation,
elliptical dots, dynamic weapon states, color blending, and arbitrary
shader functions. Twenty-seven is not the number of all physically
possible native renderers. It is a bounded sensitivity family.

At some inputs several scenarios make identical predictions. Their labels
must not be mistaken for independent empirical evidence. The default prior
assigns one third of its mass to each scale family, divided equally among
its nine members. Chapter 06 explains why the resulting mass is a scenario
weight, not a measured frequency of correct conversions.

## 5.7 Inverse search, residuals, and local visual refinement

The first stage enumerates each dimension's legal set rather than guessing
an arbitrary decimal. Length is solved first; width second; gap depends on
the chosen width. This separable proposal uses fewer than 420 primitive
integer evaluations per scenario, rather than the full
\(256\times32\times129\) joint space. It is optimal for those separate
squared geometry objectives, not a proof of global optimality for visual
mask overlap.

Next, each proposal is compared with a **frozen** target mask using exact
union/intersection counts. Up to two refinement passes evaluate the local
\(\{-1,0,1\}^3\) neighborhood, excluding illegal settings. Each accepted
step improves mask loss, or preserves it while reducing geometry loss.
The loop stops on an exact simulated match, stagnation, or the pass limit.
There is no unbounded recursive analysis, fabricated missing measurement,
or automatic alteration of the historical target to make a candidate win.

Masks are cached by geometry because many scenario/proposal pairs coincide.
Distinct cvar tuples are deduplicated. Every resulting tuple is then tested
under **every** renderer scenario, preventing an own-model perfect fit
from automatically becoming a universal recommendation.

The automatic selection minimizes weighted expected visual loss within
this finite candidate set. A user can instead inspect a specific scenario.
The report retains ideal values, selected integers, scope, residuals,
refinement passes, model identity, and the number of raster evaluations.
For cropped or empty targets, exact pixel-match claims are disabled.

The three previews are historical reconstruction, numeric direct assignment,
and converted candidate. Direct assignment means truncating/clamping old
numbers into the new legal ranges. It is a counterfactual, **not** an
implementation of Valve's automatic migration. Both new previews use the
same explicitly chosen forward scenario. Browser scaling and zoom do not
change the numerical comparison.

## References and executable correspondence

Old reconstruction: [Q05](../research/quant-sources.md). New cvar inventory:
[Q04](../research/quant-sources.md). Functions are in `lib/solver/renderer.js` and `lib/solver/inverse.js`,
`lib/solver/inference.js` and `lib/geometry/raster.js`. Reproduce corpus comparisons
with `npm run research:quant`; run the inverse and bounded-refinement tests
with `npm test`.
