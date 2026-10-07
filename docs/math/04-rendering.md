# Pixels, outlines and draw order

::: summary
A crosshair is a handful of rectangles: four bars, a dot, and a black outline
around each. The old game drew each bar's outline and then its fill, one bar
after the other, so a later outline could paint over an earlier bar. The current
game draws all outlines first and all fills on top, with an outline at most one
pixel wide. The converter compares the old and the new crosshair pixel by pixel
and by colour, and it says so when an old detail, such as a dark seam or a 2 px
outline, cannot be drawn any more.
:::

::: key
{{fig:generated.edge-case-audit.rules.corpus.overpaint.rows|int}} corpus
rows (published crosshairs at 768 to 2160) had old outline pixels over a fill;
the current game cannot draw them, and
{{fig:generated.edge-case-audit.rules.corpus.overpaint.warned|int}} of them are
reported approximate with `outline-overpaint-lost`
({{fig:generated.edge-case-audit.version|version}} edge-case audit).
:::

::: technical
## Question

Given the old geometry of [Legacy geometry](01-legacy-geometry.md) and a new
native tuple, which pixels does each game draw, in which colour, and how is the
difference between the two measured? The rectangles here are the shared model
of both games in `lib/geometry/raster.js` and `lib/geometry/appearance.js`; they
are a declared reconstruction, not an extracted shader.

## Model

### Rectangles

The old bars are the intervals of [Legacy geometry](01-legacy-geometry.md):

$$
\begin{aligned}
R_{\text{left}}&=[-a-L,-a)\times[t,t+W), & R_{\text{right}}&=[b,b+L)\times[t,t+W),\\
R_{\text{top}}&=[t,t+W)\times[-a-L,-a), & R_{\text{bottom}}&=[t,t+W)\times[b,b+L),
\end{aligned}
$$

with $t=-\lfloor W/2\rfloor$, $b=a+(W \bmod 2)$ and the dot $[t,t+W)^2$. The old
T omits $R_{\text{top}}$. If $L=0$ no bar exists; the dot can still draw.

The current game (convention `community-static-pixels-v1`) draws the same four
rectangles from

$$
L'=P_r(\ell),\quad W'=P_r(\theta),\quad a'=P_r(g),\quad b'=a'-(W' \bmod 2),\quad t'=-\lceil W'/2\rceil,
$$

where $P_r(x)=0$ for $x=0$ and $\max(1,\operatorname{round}(xr))$ otherwise. The
gap is a radius from the centre, and odd bars sit one pixel up and left of the
old odd bars. No setting moves the whole crosshair, so an odd-width export that
draws the old pixels one pixel off is reported as *shifted*, not approximate.

### Sampling

A cell $i$ belongs to the half-open interval $[x, x+w)$ when its centre does:

$$
x\le i+\tfrac12<x+w
\iff
\left\lceil x-\tfrac12\right\rceil\le i<\left\lceil x+w-\tfrac12\right\rceil .
$$

Integer rectangles give the expected integer counts; fractional ones, which the
screen goal and the historical study produce, get a deterministic sampling that
is a model choice, not native subpixel rendering. Previews use an odd inspection
window of 161 px (at most 513); larger shapes set `cropped`, which disables any
whole-shape agreement claim. The analytical scorer has no window.

### The old outline

The old outline is the leaked cstrike15 `CWeaponCSBase::DrawCrosshairRect`: with
`cl_crosshair_drawoutline` on it draws `DrawFilledRect(x0 - t, y0 - t, x1 + t, y1 + t)`
in black at the crosshair alpha, with the float width truncated to an integer.
On screen-positive coordinates this grows each rectangle by

$$
o_{\mathrm{lo}}=\lceil u\rceil \text{ (left and top)},\qquad o_{\mathrm{hi}}=\lfloor u\rfloor \text{ (right and bottom)},
$$

(`legacyOutlineExtent` in `lib/settings/native.js`). $u=0$ adds nothing, $u=0.5$
adds one pixel on the left and top only, $u=1$ one pixel all round, $u=1.5$ two
on the low sides and one on the high sides. Widths above 3 draw as 3, and the
importers clamp them to 3. A share-code width 0 with the outline on means a
stored width below 0.5 and is read as $u=0.25$. Every bar and the dot is
outlined, so zero-length bars still left their outline: size 0, thickness 3.4,
gap $-5$, $u=0.01$ at 1080 drew four 1 px strokes forming a `#` (issue #11,
confirmed by a user screenshot).

### Old draw order

The old renderer drew left, right, top, bottom and then the dot, each as its
outline followed by its fill (`legacyElements`, ADR-0015). A later outline
covered earlier fills: the vertical arms' outline could blacken the inner pixel
of each horizontal arm, or a dot outline could swallow short arms. The current
game keeps only the highest-alpha primitive per layer and draws the fill layer
over the outline layer once, so overlapping outlines never stack and no outline
covers a fill. Old outline-over-fill pixels are therefore lost in any export.

### The current outline

Build 2000922 has no outline width. `cl_crosshair_drawoutline` is 0 (none),
1 (full) or 2 (half, top and left only, added on September 24, 2026). An old
outline maps by width: $u=0$ to none, $0<u<1$ to half, $u\ge1$ to full. Full is
assumed to draw 1 px all round (no capture); half has one user capture
(issue #11). The 2000922 shader tests a rectangle as `p >= xy && p <= zw` on
integer pixels and the outline as `p >= xy - m3.x && p <= zw + m3.y`, which is
consistent with a half outline that grows only left and top. Old outlines of 2
or 3 px cannot be drawn and warn `outline-width-reduced`. The exported outline
alpha is the old crosshair opacity: capture C (outline 70 70 0 at 230) shows an
effective alpha of 0.88 to 0.90, which fits $230/255$ and not
$230^2/255^2=0.81$.

### Zero-length bars

The current game draws nothing for a zero-length bar, outline included. This
rests on the issue #11 user statement and decompile notes (source ledger S17);
the dumped shader alone would still outline an empty rectangle, so the rule
assumes CPU-side culling. A decompile note claims the dot draws at length 0;
no capture shows either way.

### Colour

Old preset colours resolve to fixed RGB before conversion (source ledger S01):

| Old colour index | RGB |
|---:|---|
| 0 | 250, 50, 50 |
| 1 | 50, 250, 50 |
| 2 | 250, 250, 50 |
| 3 | 50, 50, 250 |
| 4 | 50, 250, 250 |
| 5 | custom `cl_crosshaircolor_r/g/b` |

Indexes 6 and 7 are not presets; the stored RGB is used with
`color-index-unknown`. With `cl_crosshairusealpha 0` the old fill was added to
the scene at a fixed alpha of 200, and the outline blended normally at 200. The
current game only blends normally. A least-squares normal-blend alpha for the
additive fill depends on the error measure: for the default green it is
{{fig:generated.additive-alpha.presets.color=1.closedForm|int}} under a
per-channel error and
{{fig:generated.additive-alpha.presets.color=1.luminanceFit|int}} under a
luminance error; for red,
{{fig:generated.additive-alpha.presets.color=0.closedForm|int}} and
{{fig:generated.additive-alpha.presets.color=0.luminanceFit|int}}
(`research/generated/additive-alpha.json`, over 256 neutral grey backgrounds).
The export rule that follows is in [What decides the export](13-what-decides-the-export.md#export-line).

### Measuring the difference

For pixel sets $A$ and $B$ the comparison reports the count of differing cells
$N_{\ne}=\lvert A\,\triangle\,B\rvert$ and, for a non-empty union,

$$
\operatorname{IoU}(A,B)=\frac{\lvert A\cap B\rvert}{\lvert A\cup B\rvert},\qquad
\operatorname{IoU}_{\pm1}(A,B)=\max_{dx,dy\in\{-1,0,1\}}\operatorname{IoU}(A+(dx,dy),B).
$$

An empty union has no IoU (`null`), never 100%. The *shape check*
(`shapeCheck`, `lib/solver/community-edge.js`) applies this per colour: the old
core and outline painted in the old draw order against the new core and outline
as exported. Two pixels agree when they show the same colour, whichever layer
drew them, so a black fill can stand in for a black outline. The status is
`exact` ($\operatorname{IoU}=1$), `shifted` ($\operatorname{IoU}_{\pm1}=1$),
`approximate` or `empty`. `appearanceScorer` paints each appearance once on
coordinate-compressed axes, so the shape check and the search that maximises it
use the same code. Alpha stacking is ignored: the old game blended the four
crossings of the issue #11 `#` twice ($1-(1-0.90)^2\approx0.99$), the new game
once.

## Result

The model reproduces the user captures of issue #11: the current game drew
length 1, thickness 8, gap 2 with the half outline exactly as `communityForward`
predicts, and the old screenshot matches the old outline model row for row,
with its columns offset by +3 px (cause unexplained). Over the corpus and
presets at 768, 1080, 1440 and 2160, the overpaint rule marks
{{fig:generated.edge-case-audit.rules.corpus.overpaint.rows|int}} corpus and
{{fig:generated.edge-case-audit.rules.presets.overpaint.rows|int}} preset
row-heights; their exports are unchanged by it.

## Limits

The metric covers colour-keyed pixels at rest. It excludes alpha blending,
gamma, antialiasing and the HUD compositing path, so equal alpha numbers do not
prove equal displayed colour. Dynamic styles, weapon-dependent spread, firing,
scopes and spectating are not modelled; old styles 2, 3 and 5 are drawn at rest.
A display stretch (for example 4:3 shown as 16:9) scales both previews by the
same factor and never changes the exported numbers; one scalar setting cannot
undo independent horizontal and vertical scaling. Zoom is $n$ CSS pixels per
game pixel and says nothing about the game's pixel density.
:::
