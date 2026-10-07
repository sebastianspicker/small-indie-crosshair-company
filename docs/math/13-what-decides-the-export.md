# What decides the export: appearance rules, the T flag and export groups

::: summary
Some old crosshairs drew shapes the current game cannot draw from the same
settings: arms that crossed through the centre, a `#` made only of outline, a
dot made by size 0, or a T whose stem pointed up. For each of these the converter
uses a fixed rule that draws the same pixels another way, and it tells you when
it cannot. An old T stays a T by default; you can let the converter choose a
full cross where that looks closer, or force either shape. Every exported line
group that your old settings did not set can be left out, so the game keeps your
current value.
:::

::: key
Over the published corpus at 768, 1080, 1440 and 2160, the shape check reports
{{fig:generated.edge-case-audit.summary.corpus.exact|int}} exact,
{{fig:generated.edge-case-audit.summary.corpus.shifted|int}} shifted,
{{fig:generated.edge-case-audit.summary.corpus.approximate|int}} approximate and
{{fig:generated.edge-case-audit.summary.corpus.empty|int}} empty of
{{fig:generated.edge-case-audit.summary.corpus.rows|int}} rows
({{fig:generated.edge-case-audit.version|version}} edge-case audit).
:::

::: technical
## Question

Which rules, beyond the inverse of
[Community static conversion](12-community-conversion.md), decide an exported
value, and which components only report on it? "Decides" means the component
can change an exported number or line.

## Model

### Appearance rules {#appearance-rules}

The rules apply to the old reconstruction only; measured targets and images
stay literal (ADR-0014, `lib/geometry/edge-cases.js`, `lib/solver/community-edge.js`).
They act on the target before the inverse; under the screen goal they act on
the whole current pixels the scaled old shape covers (`snapToCells`).

**Crossed arms.** An old arm starts at its near edge, so $a<0$ puts both arms
of an axis past the centre (issue #15). `foldCrossedArms` distinguishes:

- *full*, $a+L\le0$ and $b+L\le0$: each arm lies entirely on the opposite side.
  The same pixels are a cross with $L^{*}=L$, near edge $-(b+L)$ and far edge
  $-a-L$, both non-negative.
- *partial*: the two arms of an axis overlap into one solid bar over
  $[x_0,x_1)=[\min(-a-L,b),\max(-a,b+L))$, exported at gap 0; an odd span moves
  by one pixel as for odd widths.
- *none*: no crossing, or a union that arms cannot express.

The export warns `crossed-arms-folded`. Without the rule, `community-static-v5`
clamped the gap to 0 and drew a solid plus (`negative-gap-static-unverified`).

**Outline only.** Size 0 with an outline and no dot drew only the outlines of
zero-length bars. `outlineAsCore` redraws those strokes as a black core: length
$o_{\mathrm{lo}}+o_{\mathrm{hi}}$, width $W+o_{\mathrm{lo}}+o_{\mathrm{hi}}$,
near edge $a-o_{\mathrm{hi}}$, far edge $b-o_{\mathrm{lo}}$, axis start
$t-o_{\mathrm{lo}}$, with `cl_crosshair_drawoutline 0` and colour 0 0 0 at the
old opacity (`outline-only-as-core`). The black colour and opacity groups are
then required.

**Dot only.** Size 0 with a dot drew the $W\times W$ square. `dotAsArms` adds arms
at gap 0 of length $\lceil W/2\rceil$ whose union with the dot is exactly that
square, with the dot on (`dot-only-as-arms`). With an outline, the old
zero-length bars also drew strokes around the gap; the window draws part of them
with the outline of short arms, and `zero-length-outline-dropped` names the rest
when the result stays approximate.

**Zero length.** The current game is modelled as drawing nothing for a
zero-length bar, outline included (see
[Pixels, outlines and draw order](04-rendering.md)). The converter therefore
never exports length 0 once the old shape drew arms or a dot.

**Corrections switch.** The expert switch "Automatic appearance corrections"
(`options.corrections`, default on) skips the fold, the black core, the dot
arms and the appearance window; the export is the plain conversion and warns
`corrections-off`. The old draw order and the zero-length model are models, not
corrections, and stay.

**Styles and weapon gap.** Old styles 2 and 3 drew the style-4 gap at rest and
export Static Cross with `style-dynamic-at-rest`; style 5 uses its own gap
([Legacy geometry](01-legacy-geometry.md)); styles 0 and 1 drew a different
reticle and are refused. A weapon-dependent gap converts with the non-weapon
goal 4 and warns `weapon-gap-dropped`.

### T shapes and the exported T flag {#t-shapes}

The leaked old renderer has no `cl_crosshair_t`. The converter assumes an old T
omitted the code's top bar, so its single vertical stem is the bottom bar
$[b,b+L)$ next to the horizontal band $[t,t+W)$. The stem reached past the band
by (`tStem`)

$$
e_{\uparrow}=\max(0,\,t-b)=\max(0,\,-W-d),\qquad
e_{\downarrow}=\max\bigl(0,\,b+L-(t+W)\bigr)=\max(0,\,d+L),
$$

which agrees with the drawn cells on 60,912 cases (styles 4 and 5, heights 720
to 1440, ADR-0020). `tShape` sorts every old T into seven families:

| Family | Condition | Old look | Planned flag (`auto`) | Flippable |
|---|---|---|---|---|
| `upright` | $L>0$, $e_{\uparrow}=0$, $e_{\downarrow}>0$ | a T | T | no |
| `stem-hidden` | $L>0$, $e_{\uparrow}=e_{\downarrow}=0$ | stem inside the bar, no T visible | T | yes |
| `straddle` | $e_{\uparrow}>0$, $e_{\downarrow}>0$, $e_{\uparrow}\ne e_{\downarrow}$ | stem through the bar | T | yes |
| `straddle-symmetric` | $e_{\uparrow}=e_{\downarrow}>0$ | a full cross | cross | yes |
| `inverted` | $e_{\uparrow}>0$, $e_{\downarrow}=0$ | an upside-down T | cross | yes |
| `strokes` | $L=0$ with an outline, dot or not | outline strokes, the top one dropped | T | yes |
| `no-effect` | $L=0$ without an outline | T changes no pixel | T | no |

For `strokes` the stem is computed on the outline-as-core strokes, and the
family is *crossed* when those strokes cross the centre. An upright T is upright
whether or not its arms crossed: the issue input size 2, thickness 0.5, gap −5,
outline 1 at 1080 ($d=-1$, $W=1$) is upright.

The option `tShape` (`tShapeChoice` in `lib/settings/native.js`, recorded in
`report.options.tShape`) decides what is exported:

- `keep` (default, ADR-0025): the old flag. The search and the window use it
  and try no other flag. A kept inverted T draws its stem below the bar, the
  closest T the current game can draw.
- `auto` (ADR-0020): the planned flag above. `inverted` and `straddle-symmetric`
  export a cross, whose top arm reproduces the old stem; flippable families also
  let the window try the other flag, which must win strictly.
- `on`, `off`: the forced flag on the corrected and the plain path.

Warnings: `inverted-t-unrepresentable` when T is exported, the family is
flippable and not `stem-hidden` (for `strokes`, only if crossed), and the shape
check is approximate; `t-flipped-for-shape` when `auto` exports a cross for an
old T; `t-user-choice` when `on` or `off` exports a flag other than the old one.
The report carries `edgeCase.tShape` and, whenever the exported flag differs
from the old one, `exportOverrides.t_style`.

On the synthetic grid of the edge-case audit
({{fig:generated.edge-case-audit.version|version}}, default options):

| Family | Rows | Exported T | Exported cross |
|---|---|---|---|
| `upright` | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.upright.rows|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.upright.keptT|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.upright.flipped|int}} |
| `stem-hidden` | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.stem-hidden.rows|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.stem-hidden.keptT|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.stem-hidden.flipped|int}} |
| `straddle` | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.straddle.rows|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.straddle.keptT|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.straddle.flipped|int}} |
| `straddle-symmetric` | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.straddle-symmetric.rows|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.straddle-symmetric.keptT|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.straddle-symmetric.flipped|int}} |
| `inverted` | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.inverted.rows|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.inverted.keptT|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.inverted.flipped|int}} |
| `strokes` | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.strokes.rows|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.strokes.keptT|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.strokes.flipped|int}} |
| `no-effect` | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.no-effect.rows|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.no-effect.keptT|int}} | {{fig:generated.edge-case-audit.rules.synthetic.tShapes.no-effect.flipped|int}} |

### The export line {#export-line}

The export is console commands only, never a share code (ADR-0003), joined by
`;` with the authored height last (`nativeCommands` in `lib/settings/native.js`,
`exportQuantCFG` in `lib/solver/export.js`). The style is Static Cross 4 unless
the experimental family option keeps old styles 2, 3 and 5. The outline alpha is
the old crosshair opacity. With `cl_crosshairusealpha 0` the fill exports alpha
255 and the outline 200 (`additive-blend-approximated`, ADR-0015): the additive
old fill never dimmed the background, a fitted alpha depends on the error
measure ([Pixels, outlines and draw order](04-rendering.md)), and the other five
converters surveyed export 255.

Six optional line groups (ADR-0022) are RGB, fill opacity, outline mode, outline
RGBA, follow recoil and authored height. A group is ticked by default only when
the old input assigned its values; the authored height is always ticked,
because the exported sizes are scaled for it. A redraw that needs black opaque
bars or an outline override makes those groups required. An omitted line keeps
the player's current game value, which the converter does not know; previews
and the shape check assume the displayed values. `report.exportedOverrides`
together with `nativeCommands` reproduces the export.

### Components and whether they decide

| Component | Kind | Decides | Basis |
|---|---|---|---|
| Old arithmetic (`communityLegacy`) | closed form | yes | leaked old renderer, source ledger S01 |
| Appearance rules | rule | yes | issues #11 and #15, their captures |
| Old draw order, `usealpha 0`, outline cap, weapon gap | rule | yes | leaked old renderer (S14 to S18), capture C |
| T plan and `tShape` option | rule | yes | ADR-0020, ADR-0025 |
| Dimension-first inverse | closed form and exact search | yes | declared reconstruction |
| Tie-break | rule | yes, at cross heights | tie audit (ADR-0013) |
| Appearance window and plain fallback | bounded exact search | yes, in scope | geometry audit (ADR-0017, ADR-0019, ADR-0024) |
| Export groups | rule | which lines appear | ADR-0022 |
| Shape check | closed-form comparison | no: it scores the window and reports a status | declared models |
| ML cross-check | learned | no: a second opinion | [Learned emulators](10-learned-emulator.md) |

## Result

Worked examples at 1080, pixel goal, old style 4, white at opacity 230, outline
off unless stated; computed with `infer()` and `exportQuantCFG()` on
`{{fig:model.version|version}}`. Exports are length / thickness / gap.

| Old settings | Old pixels $L, W, a$ | What acted | Export | Shape check |
|---|---|---|---|---|
| Issue #15: size 2, thickness 1, gap −11.5, dot | 4, 2, −6 | fold (full) | 4 / 2 / 2, dot | exact |
| The same, corrections off | 4, 2, −6 | plain conversion | 4 / 2 / 0, dot | approximate, 0.455 |
| Issue #11: size 0, thickness 3.4, gap −5, outline 0.01 | 0, 8, 3 | outline as core | 1 / 9 / 3, outline 0, colour 0 0 0 at 230 | exact |
| Size 0, thickness 1, gap 0, dot | 0, 2, 5 | dot as arms | 1 / 2 / 0, dot | exact |
| The same, corrections off | 0, 2, 5 | plain conversion | 0 / 2 / 5, dot | exact if the dot draws at length 0 |
| Inverted T: size 2, thickness 1, gap −20, T ($e_{\uparrow}=14$) | 4, 2, −15 | fold; `keep` | 4 / 2 / 11, T 1, `inverted-t-unrepresentable` | approximate, 0.5 |
| The same, `tShape` auto | 4, 2, −15 | fold; planned cross | 4 / 2 / 11, T 0, `t-flipped-for-shape` | approximate, 0.75 |
| Upright T: size 2, thickness 1, gap −3, T ($e_{\downarrow}=5$) | 4, 2, 2 | none | 4 / 2 / 2, T 1 | exact |
| The same, `tShape` off | 4, 2, 2 | forced flag | 4 / 2 / 2, T 0, `t-user-choice` | approximate, 0.75 |
| Size 1, thickness 2, gap −4, dot, outline 1 | 2, 4, 2 | window: 2 / 4 / 2 at 0.81 → neighbour | 1 / 4 / 3, dot, outline 1 at 230 | exact |

Scores are $\operatorname{IoU}_{\pm1}$. In the last row the old dot outline
painted over the short arms; 1 / 4 / 3 draws those pixels exactly after 304
evaluated tuples. In the dot-only row the corrected export draws the same pixels
whether or not the current game draws a dot at length 0; the plain export
depends on it.

## Limits

The zero-length rule rests on one user statement and conflicts with a
decompile note about the dot; the dot-only export is chosen so that both
readings draw the same pixels. How an old T drew is an assumption, since the
leaked renderer has none. The window is bounded: size-0 dots with an outline
whose strokes lie more than 32 px out stay approximate. A kept inverted T and an
old 2 or 3 px outline cannot be drawn by the current game, and the warnings say
so per input.
:::
