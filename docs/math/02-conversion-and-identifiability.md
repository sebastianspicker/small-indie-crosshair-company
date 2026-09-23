# 02 — Conversion, inverse models and identifiability

**Status:** proposed, conditional post-update conversion. **Native validation:** none.
**Code:** `lib/conversion.js`, version `conditional-static-v4`.
**Build inventory:** [S03](../research/source-ledger.md#s03-new-build-inventory).

## 1. Separate four coordinate systems

There are at least four quantities that are often confusingly called “crosshair size”:

1. The old console parameter, such as `cl_crosshairsize 2`.
2. The old colored arm measured in game-image pixels, such as four pixels at 1080p.
3. A website generator's own preview/reference coordinates.
4. The new game's parameters at their recorded authored height.

Only the first-to-second relationship has the source-derived model in this repository.
The fourth-to-rendered-pixels relationship is a *hypothesis*. Website coordinates do
not identify it. Renaming a variable or multiplying by a popular website's scale is
not sufficient to establish visual equivalence.

The new inventory contains a hidden authored-height setting, `cl_crosshair_screen_height`.
Its description ties it to the height used when authoring size settings and says that
editing a size setting updates it. Length and thickness are described as resolution
scaled; thickness retains a one-pixel minimum. The inventory does not show the exact
native arithmetic, pixel origin, quantizer, callback ordering or migration function.

Our natural working model uses an authored height $A$ and a target/current height $H_n$:

$$
r=\frac{H_n}{A}.
$$

A stored dimension is multiplied by $r$ before pixel quantization. This interpretation
is plausible from the descriptions, but not established by running the renderer. Both
the code and exported reports retain that qualification.

## 2. Decide what “looks the same” means

Let the old source model at $H_o$ produce $(L_o,W_o,a_o,b_o)$. There are two different
matching objectives.

### A. Same number of game pixels

The target remains

$$
(L_*,W_*,a_*,b_*)=(L_o,W_o,a_o,b_o).
$$

This is useful when restoring the old picture at the same playing resolution or when
deliberately preserving its raw game-pixel footprint. It does not guarantee the same
physical size on a different monitor or under a changed display scaler.

### B. Same proportion of screen height

Define $q=H_n/H_o$ and target

$$
(L_*,W_*,a_*,b_*)=q(L_o,W_o,a_o,b_o).
$$

This scales the *already quantized old geometry*. It does not recompute the old renderer
at $H_n$. Those operations differ because the old arms were quantized and the old gap
did not scale with height. The target may now contain noninteger edges or dimensions.
The solver reports the inevitable residual where no legal discrete setting attains it.

This is an ideal geometric objective, not a simulation of every GPU/monitor interpolation
filter. A physical display's final nearest-neighbor, bilinear or proprietary scaling
is outside the current model.

## 3. Conditional new dimensions

The selectable new-dimension hypotheses use

$$
L_n=Q(r\ell),\qquad W_n=\max(1,Q(rt)),
$$

where $\ell,t$ are candidate new length/thickness parameters. $Q$ is either truncation
or nearest integer with positive ties rounded upward. Native dimensions are nonnegative,
so the truncation variant equals floor there. This is deliberately **not** an assertion
that either quantizer is known to be Valve's actual choice.

At $A=H_n$, $r=1$, so the same-resolution ideal candidates are

$$
\ell\approx L_o,\qquad t\approx W_o.
$$

At a different authored height, the continuous inverse is

$$
\ell_{\mathrm{ideal}}=\frac{L_*}{r}=L_*\frac{A}{H_n},\qquad
 t_{\mathrm{ideal}}=\frac{W_*}{r}=W_*\frac{A}{H_n}.
$$

These are ideal *parameter* values before checking available discrete settings. The
lab searches integers within the documented slider ranges: length 0–255, thickness
0–31, gap 0–128. Restricting candidates to integers is a tool policy aligned with the
inspected integer-granularity UI. It is not a separately measured claim that every
possible native console input or serializer rejects fractional values.

For a floor model without saturation, reproducing an integer arm length $L$ means

$$
L\le r\ell<L+1,
$$

so all legal integers in $[L/r,(L+1)/r)$ are equivalent for that one dimension at that
height. There may be several, one, or none. The midpoint of an inverse interval is not
necessarily expressible in the UI, and picking the nearest ideal parameter does not
always minimize rendered error after quantization. This motivates evaluating predictions.

## 4. Zero thickness is a semantic branch

The old parameter $T=0$ still produces $W_o=1$ in the source model. The new inventory
allows zero and describes minimum one-pixel rendering. Under the scale-then-minimum
hypothesis, a stored literal zero remains the one-pixel branch at every height, whereas
a positive stored one can scale to two or more pixels.

Therefore the revised policy is

$$
t=0\quad\text{when the old literal parameter }T=0.
$$

For positive old thickness, the solver normally inverts the desired rendered width.
It may still choose zero when that is the best available discrete candidate at an
unusual scale; the report warns about the change in future-resolution behavior.

A subtle conflict appears with the screen-relative objective. If old $T=0$ gave one
pixel at 1080p and the target is 2160p, proportional scaling asks for two pixels. Keeping
the literal-zero branch asks for one. These goals cannot both hold in the current model.
The repository prioritizes preserving the branch by default and reports the one-pixel
residual. Manual candidate editing lets the user prioritize a different objective.

This corrects the first chat proposal, which always promoted a minimum-width result to
positive one. The correction is still conditional on the new renderer's minimum/scaling
semantics; it is not an independently confirmed native behavior.

## 5. Gap baseline: the unresolved part must stay explicit

Matching $p_o=\operatorname{trunc}(G+4)$ alone is not enough. The target is an actual
inner-edge coordinate, including width:

$$
a_o=\lfloor W_o/2\rfloor+p_o.
$$

Model the new near edge as a function of its gap parameter $g$. The two unmeasured
hypotheses implemented in the workbench are

$$
a_n=B(W_n)+Q(rg),
$$

with either

$$
B(W_n)=\lfloor W_n/2\rfloor\quad\text{(thickness-relative)},
$$

or

$$
B(W_n)=0\quad\text{(center-relative)}.
$$

At $r=1$, matching $a_*$ gives the ideal candidate

$$
g_{\mathrm{ideal}}=a_*-B(W_n).
$$

At a general ratio,

$$
g_{\mathrm{ideal}}=\frac{a_*-B(W_n)}r.
$$

Notice that $W_n$, the *predicted new width*, belongs in the new baseline. When perfect
width matching is impossible, substituting $W_o$ instead can conceal an extra placement
error. The solver first picks width, then uses that chosen width when solving gap.

For the same-resolution thickness-relative hypothesis and an exact width match, this
reduces to the earlier candidate

$$
g_{\mathrm{ideal}}=p_o=\operatorname{trunc}(G+4).
$$

For the center-relative hypothesis, it instead becomes

$$
g_{\mathrm{ideal}}=\lfloor W_o/2\rfloor+\operatorname{trunc}(G+4).
$$

The original formula was therefore a **special case**, not a complete established
mapping. For a two-pixel-wide donk-style fixture, the alternatives suggest gap zero or
one respectively while targeting the same old inner edge. A native gap-zero screenshot
at that effective width can discriminate them.

## 6. Measured affine gap model

With scoped observations, use

$$
a_n(g)=B+Kg,\qquad K>0,
$$

and the ideal inverse

$$
g_{\mathrm{ideal}}=\frac{a_*-B}{K}.
$$

Here $B$ is an intercept measured in **current-resolution pixels** and $K$ is current
pixels per stored gap unit. Do not multiply them by $H_n/A$ again. Do not automatically
apply a second quantizer to $Kg$ after fitting measured offsets: that would silently
replace the fitted affine model with a different staircase model. The repository's
measured branch uses the affine relationship directly; length and thickness still
use their explicitly selected hypotheses.

An affine fit may be only a local approximation to a quantized renderer. Fractional
predicted edges are not proof of native subpixel rendering. The preview displays them
using its stated illustrative sampling convention. Residuals, independent holdouts
and alternative quantized models are essential before making a renderer claim.

The calibration-to-workbench action checks build, current height, authored height,
effective thickness, static style and disabled outline/recoil. It refuses a mismatched
scope. Subsequent edits that change the heights or effective width block export until the
recorded conditions are restored or an unmeasured hypothesis is selected. The exported
math report retains the applied fit, observation points, provenance and scope. Editing
B or K by hand detaches the fit and returns to an unscoped, explicitly hypothetical input.

## 7. Near and far must both agree

The simulation makes the far-side displacement explicit:

$$
b_n=a_n+\delta_n.
$$

Its default is $\delta_n=1$, inherited as a hypothesis from the old reconstruction,
not measured from the new client. The core API permits a different finite displacement
for experiments; the current GUI uses the default.

If the new near edge matches but $\delta_n\ne b_*-a_*$, the far edge still differs.
A scalar gap adjustment translates both offsets together and cannot repair their
relative displacement. The solver reports `farError` and refuses to call the complete
coordinate match exact within its own model.

For ideal screen-relative scaling of the old convention, $b_*-a_*=q$. A new fixed
displacement of one cannot match both exactly when $q\ne1$, even before integer
parameter restrictions. That is a representability issue in the chosen coordinate
models. Rasterization may hide a fractional discrepancy visually, but it does not
make the continuous coordinate equations identical.

Width parity may also change native centering. Test odd and even widths independently;
one two-pixel fixture cannot establish the rule for widths one, three and four.

## 8. Bounded discrete search and tie-breaking

For each dimension, let $P(v)$ be its predicted pixel value for a legal integer setting
$v$ and let $d$ be the target. The solver evaluates

$$
v^*\in\operatorname*{arg\,min}_{v\in\mathcal V}|P(v)-d|.
$$

Length has at most 256 candidates, thickness 32 and gap 129. Exhaustive bounded search
is tiny, transparent and easier to validate than clever implicit rounding. The default
sequence is length, then thickness, then gap. It is **not** a global optimization of
perceptual appearance or joint mask difference. In particular, sacrificing one pixel
of width to improve a whole bitmap is not the selected policy.

When pixel errors tie, choose the candidate closest to the continuous ideal parameter;
if that also ties, retain the smaller integer encountered first. Literal-zero thickness
is a deliberate special branch. Reports retain the ideal parameter, selected integer,
predicted pixel result, absolute residual, whether the ideal is in range, and whether
that dimension matches within the selected model.

`geometryExact` requires length and thickness agreement, and for existing arms also
near and far agreement. It never means native validation. Outline, alpha, transverse
origin and unsupported dynamic behavior are not included in that boolean.

Values outside a native range may receive the nearest legal suggestion, but never a
silent claim that the suggestion is the original crosshair. The `.cfg` includes those
warnings. Unsupported styles and weapon-dependent gap are stronger blockers: the
converter does not export a falsely static substitute.

## 9. Identifiability: old examples cannot reveal the new renderer

Suppose we observe only old inputs and old-model outputs. Those observations constrain
$F_o$, the old rendering function. They contain no direct observation of $F_n$, the
new rendering function. Many different new baselines, quantizers and authored-height
rules remain compatible with the same old data.

The inverse problem is therefore underdetermined until new-renderer measurements are
introduced. Passing all old-code tests cannot identify the new scale. Matching two
synthetic previews is circular: both were generated with assumptions supplied by us.

Even old-scale identification can be deceptively weak. Every selected preset has equal
length/thickness results at 960p and 1080p in the tested model. A constant factor two
therefore appears successful on all eight at either height. Across seven controlled
heights it disagrees in 32 of 56 cases. That does not give the constant factor a “57%
probability of being wrong”; it reports disagreement over this particular test matrix.
The matrix is not a random sample of all settings or all players.

Deliberately choose inputs around quantization transitions. Old size four at 1080p,
zero thickness, negative fractional gap, odd/even widths and several authored/current
height ratios carry more discriminating information than many copies of the same
small, two-pixel pro crosshair.

## 10. Safe application order

Choose the real in-game resolution first. Apply new dimensions, colors and flags using
new variable names. Set the authored-height reference **last**, then read back all
values, including that reference. Compare stationary captures under identical weapon,
stance and graphics/display conditions. Do not mix hidden legacy geometry assignments
into the same candidate configuration; their migration side effects were not inspected.

The exported commands do not change resolution, connect to a server, bind a key, inject
anything into the game or execute game-process actions. They are a candidate configuration
for the user to inspect and apply manually. Preserve the original configuration before
experimenting. See [settings migration](../research/settings-migration.md) for the
complete name mapping and unsupported preferences.
