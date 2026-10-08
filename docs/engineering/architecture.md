# Architecture

This document describes the current public repository: where things live, how
the runtime is layered, and which files are published.

The project is a static, dependency-free, client-only web app plus the
research that justifies it. There is no server component, bundler, account,
network call or persistence at runtime.

## The repository in one picture

```text
index.html, public/, licenses/         static shell (published as-is)
app/        browser runtime            DOM, canvases, routing, worker transport
  └─ imports ─▶ lib/
lib/        pure domain                no DOM, no worker globals, no network
  settings ◀─ geometry ◀─┬─ image
                         ├─ solver     (community-static-v11; historical quant-static-v6)
                         └─ manual     (library only, conditional-static-v4)
data/       runtime data               bundled JSON files the app fetches
research/   evidence, never runtime    generated/, corpus/, comparisons/,
                                        measurements/, archive/ (frozen)
scripts/    repository tooling         build, serve, notebook
docs/       math, research notes, evidence policy, engineering docs, generated notebook
```

Arrows point from importer to imported module. Nothing points back: `lib/`
never imports `app/`; retained research files are evidence and data, not
runtime modules.

## `lib/`: the pure domain

Every module in `lib/` is a plain ES module that runs unchanged in the
browser, in the worker and in Node. Five layers, each with one job:

| Layer | Owns | May import |
|---|---|---|
| `lib/settings/` | What a setting *is*. Input validation primitives (`validation.js`), native cvar ranges, colour resolution and CFG command formatting (`native.js`), the frozen build-2000914 cvar inventory (`cvars.js`; the community model's native ranges and CFG export follow build 2000922), the legacy v1 share-code codec (`sharecode.js`, MIT-attributed), a read-only decoder for current `CS…` share codes (`sharecode-cs.js`), the per-setting outcome and confidence labels behind the "What changed" table (`outcomes.js`), the allowlisted legacy CFG parser (`cfg.js`, which also clamps outline thickness to the old maximum 3; `legacyOutlineExtent` applies the same bound for direct callers), and the single legacy-text import dispatch (`import.js`). The usealpha-0 fill exports alpha 255, the outline 200. `outcomes.js` also builds the `defaults-filled` warning for partial pastes. | `settings` |
| `lib/geometry/` | What a crosshair *looks like*. Binary32 legacy geometry (`legacy.js`), the one integer quantizer (`quantize.js`), illustrative rasterization (`raster.js`, including the old per-element draw order `legacyElements` / `legacyRaster`), colour-labelled appearance for the shape check (`appearance.js`: new composite and old draw order), the edge-case targets (`edge-cases.js`), lossless shape and mask compilation (`pixel-shape.js`), and the 56-case legacy audit shared by the #evidence page and the archive reproduction (`audit.js`). | `geometry`, `settings` |
| `lib/image/` | Reading pixels. Bounded PNG screenshot segmentation and native component measurement (`screenshot.js`, `components.js`). | `image`, `geometry`, `settings` |
| `lib/solver/` | The default direct converter (`community.js`, `community-static-v11`) and historical 27-model study (`quant-static-v6`). Forward renderers (`renderer.js`), integer inverse (`inverse.js`), visual refinement (`visual.js`) and shift-aligned tie overlap (`alignment.js`), the appearance window after the dimension-first search (`community-refine.js`), decision rules (`selection.js`), opt-in certificates (`certify.js`), the solver-independent per-input ML cross-check evaluator (`ml-crosscheck.js`), measurement evidence (`observations.js`, `evidence.js`, `community-evidence.js`), experiment design (`experiments.js`), corpus coverage (`corpus.js`, `statistics.js`), structural rivals (`structural.js`, `migration.js`), report/CFG export (`report.js`, `export.js`), and entry point `infer()` (`inference.js`). | `solver`, `geometry`, `settings` |
| `lib/manual/` | The manual lab (`conditional-static-v4`): the `convert()`/`exportCFG()` model with its `measured` gap branch (`conversion.js`) and the affine calibration fit plus `sicc-measurement-v1` schema (`calibration.js`). | `manual`, `geometry`, `settings` |

`solver` and `manual` are deliberately separate conversion models, not two
copies of one model. The manual lab has a user-measured affine gap branch
that the automatic family lacks, and the automatic family has `ceil` rounding
and the `opening` gap baseline that the manual lab lacks. Unifying them would
change results and needs its own model id. What they genuinely share lives in
`settings` and `geometry`: the quantizer, legacy geometry, validation and
CFG formatting. The three build-id constants (`TARGET_BUILD` in the manual
model, `BUILD` in the renderer, `INVENTORY_BUILD` in the cvar inventory) are
separate facts that happen to be equal today; keeping them explicit makes any
future divergence deliberate.

Export options, both opt-in (the half outline matches one user capture, issue #11; the
full outline and the style family are unverified in game): `options.outlineMode`
(`'auto'` | 0 | 1 | 2) and `options.styleTarget` (`'static'` | `'family'`), normalized by
`scope()` in `lib/solver/renderer.js`, defaulting to `'auto'` and `'static'`. They reach the
cvar text only through `nativeCommands(settings, native, { outlineMode, style, color, t_style })` in
`lib/settings/native.js` (helpers `styleTarget`, `effectiveOutlineMode`, `optionWarnings`);
the manual lab accepts the outline option only. Model ids stay unchanged. The
automatic refinement window and its fallback both score the chosen outline
and can select the plain geometry or T flag when the selected objective improves.
Reports record options and add the warnings
`outline-user-override` and `style-family-experimental`; outcome rows use the status
`user-choice`. The `color` override is not a user option: the community solver sets it in
`report.exportOverrides` and the converter previews draw what the export draws.
`t_style` is set when the exported T flag differs from the old one (ADR-0020: an upside-down or symmetric old T
exports a full cross; the window may flip other shapes whose stem left the bar), but only with the T option
`auto`: the default `keep` exports the old flag (ADR-0025), `on` and `off` force it, and the historical models honour
the forced flag through the same override.

`options.corrections` (default `true`, also normalized by `scope()`) is the expert switch
"Automatic appearance corrections". Off, the community solver skips the
crossed-arm fold, the outline-only and dot-only redraws and the appearance window
and warns `corrections-off`; the shape check still compares the old and new
pixels. Historical models ignore it, the advanced options disable it for them and send `true`. The ML cross-check row reads "Not checked: corrections off".

A pasted CFG block that leaves cvars unset takes the pre-update game defaults. The
converter adds the `defaults-filled` warning (`defaultsWarning` in
`lib/settings/outcomes.js`) to the report's warnings, so it shows in both
warning lists and the downloaded report, and the "What changed" rows of those cvars say
"added (game default)". Share codes and complete pastes get neither.

The converter's confidence panel (`app/convert/evidence.js`) shows a shape check
(`report.shapeCheck`, in every report since 2026-10-03; computed in the app only for older
historical reports), then, for the
community model only, the counts in `data/quant-summary.json` `evidence`: current-game
captures re-rendered by the research pipeline, crosshair.club agreement and,
as a separate labelled row, the per-input ML cross-check. That row evaluates
`lib/solver/ml-crosscheck.js` on the parameters in `data/ml-crosscheck.json`. The evaluator
uses source arithmetic and learned trees and never calls the solver, but it shares the
converter's rendering models and re-implements the appearance refinement rule, so
agreement is partly by construction. The row says whether
the learner's predicted export for this input agrees with the converter's export, and its
note gives the reused held-out regression rate. A parameter file for another solver version or implementation revision, or one
edited by hand, shows "not retrained for this version". None is a probability that the
export is correct.

The current community reconstruction has a separate build (2000922), geometry
module (`geometry/community.js`) and report version. It is not a 28th weighted
hypothesis. The UI defaults to this direct, per-axis solver and offers six choices:
the default, the historical hedge and four authored-height controls. Measurements
are stored together but validated and evaluated only against their matching build:
build 2000918 records are rejected, and 2000922 records with a gap outside
0..128 are reported outside the model domain and kept out of holdout validation.
The v4 default targets build 2000922; its equations are carried over from v3
unverified (see the [build 2000922 note](../research/build-2000922-update-2026-10-01.md)).
v5 keeps the equations and changes only the tie-break: tied shapes are ranked by
pixel overlap maximised over whole-shape shifts of at most 1 px (`alignment.js`),
then plain overlap, then the canonical order, so the centring difference between
the old and new renderers for odd widths no longer decides ties. Old styles 2, 3
and 5, which the old source draws like style 4 at rest, export as Static Cross by
default.

The v3 solver preserves minimum length/width errors, recomputes radius for each
tied width, and scores up to eight distinct shapes by exact overlap. The monotone
inverse in `community-axis.js` finds complete tied plateaus while preserving
canonical cvar preferences. `community-evidence.js` evaluates deduplicated,
build-scoped holdouts. Image fitting scores exact rectangle unions and rejects
cropped, unstable or inconsistent measurements.

Structured learning remains offline. Public generated artifacts record candidate
ranking and constrained residual experiments; no learned model is loaded by the
converter. See the [study](../research/structured-learning-2026-09-29.md).

`community-refine.js` runs after the dimension-first search for legacy inputs
at either goal, for every old outline width. When the shape check is neither
exact nor shifted, it scores a bounded window by the selected aiming/appearance
objective and switches only on a strict gain (`decision.refinement`, warning
`appearance-refined`). Length reach is 3; gap reach follows the old edges from
4 up to 32; thickness reach grows from 3 up to 8. These are current pixels or
native steps, whichever reaches further (`pixelWindow`). A second length
window preserves the outer edge, and flippable T families try the other flag.
The window scores the actual exported outline mode, including hand choices. When an edge-case redraw, T change
or the window applied, `solveCommunity` also solves the plain path (corrections
off) and exports it only if the same selected objective is strictly higher under
the actual exported outline. Visible dot cores prioritize aiming pixels, then
appearance at that same shift; total outline coverage may decrease (ADR-0026). A hand-selected outline can therefore change the
final tuple or T flag
(`decision.correctionsFallback`, warning `corrections-fallback`). A screen goal
applies the edge-case rules in whole current pixels (`snapToCells`). Since v9,
`scaleScreenGeometry` retains fractional dimensions but carries integer source
endpoints; `geometryCellEdges` samples them by exact rational ceiling for all
rendering and snapping consumers. Changed geometry discards that provenance.
The independent ML mirror rederives the rule (ADR-0023).
`appearance.js` compares appearances on
coordinate-compressed grids painted once per shape (`appearanceScorer`).

`inference.js` and `report.js` read `performance.now()` to record solve
timings in the report. That is the only non-deterministic input in `lib/`.

## `app/`: the browser runtime

`app/main.js` is the hash router. It lazily imports one route module on first
visit and shows a boot error for a failed route without breaking the
others. Primary pages are linked from the masthead; the historical archive is in the footer.
Routes are part of the public URL surface:

| Route | Nav label | Code |
|---|---|---|
| `#quant` (default) | Convert | `app/convert/` |
| `#screenshot` | Screenshot | `app/pages/screenshot.js` (hash parsing in `app/ui/route.js`) |
| `#corpus` | Settings data | `app/pages/corpus.js` |
| `docs/notebook.html` | Mathematics | `scripts/notebook.mjs`; `#research` redirects here |
| `docs/read.html?doc=…` | Linked documentation | `app/pages/document.js` |
| `#evidence` | Historical archive · 56 cases (footer) | `app/pages/evidence.js` |

Supporting directories:

- `app/ui/` holds shared DOM helpers. `dom.js` provides safe text-first
  element construction, doc links and explicit downloads.
- `app/data.js` is the only module that fetches bundled `data/*.json` and public Markdown.
  Presets are memoized, so every route that uses them issues one fetch.
- `app/ui/document-links.js` resolves public document paths and redirects math
  chapters to notebook anchors. Other Markdown opens in `docs/read.html`, whose
  text-first reader uses DOM construction, not source HTML execution. It renders
  headings, lists, tables, code, links and local images; non-notebook display
  equations retain their TeX notation. External images are not fetched.
- `app/convert/` is the automatic converter UI. `converter.js` boots the
  route. `outcomes.js` renders the "What changed" table, confidence chips,
  warnings and limits line from the report. `controller.js` owns the state (settings, result, measurements,
  target override and mask, source), request generations and the 90 ms
  analysis debounce; text import has its own 250 ms debounce in `sources.js`.
  `view.js` builds one page (`.quant-simple`): in the controls column the
  paste box (Input), the heights, Conversion (goal, outline, T in export,
  style), the colour and the direct values; in the results column Preview
  (the old and new plates), New settings (readouts, commands) and What happened.
  There is no separate Advanced block. Each of those five sections has a small
  Expert switch in its header (`q-expert-<key>`, `aria-controls` its
  `q-expert-<key>-panel`, `hidden` until flipped; `EXPERT_SECTIONS`) that
  reveals that section's expert content in place: other input sources
  (published settings, a link to the Screenshot page), the rendering model, decision rule and
  corrections, the difference view, the value table, confidence, exported line
  and research report, and the four deep-dive rows (pixel measurements, compare
  models, search details, game screenshot), which stay closed and render
  lazily. Panels are per section, off by default and not remembered
  (ADR-0004). There is no mode switch: every option always applies, hidden or
  not, and the defaults (automatic model, auto outline, Static Cross, the pixel
  goal, corrections on) are what the page exports until one is changed; a
  hidden Conversion option off its default puts a dot on that section's switch.
  `samples.js` paints the empty-state "What this handles" plates.
  `presentation.js` renders values, canvases,
  scenario tables and rival rows, `preview.js` paints canvases, and
  `feedback.js` handles native-evidence input. The controller
  resolves the model choice on the main thread and asks the worker to solve.
- `app/pages/screenshot.js` is the Screenshot page (`#screenshot`): an old-game
  PNG in, new settings out, nothing else. It crops 129 px around the image
  centre, calls the worker `screenshot` operation, then `infer` with the inferred
  old settings, the measured mask as the target and the converter's defaults. It
  has its own worker, created with the first image. It shows the measured crop
  next to the new plate, the readouts, commands, the inferred old settings and a
  confidence block: image measurement, identifiability and the conversion shape
  check, summarised as High, Medium or Low by a stated rule (High: image checks
  pass and the shape check is exact or exact after a 1 px shift; Medium: shape
  check approximate at 80% or more; Low: an image check fails or the shape check
  is below 80%, empty or missing). It is a reading of those checks, not a
  probability. The cross-check link `#quant?paste=<old settings>&oh=&nh=` is
  parsed by `app/ui/route.js` (text only, at most 4 KiB, heights 240 to 16384)
  and imported by `QuantController.applyRoute`; `main.js` then strips the query
  with `history.replaceState`, so nothing is stored. The old `#workbench` and
  `#calibration` links redirect to `#screenshot`.
- `app/image/` is image intake for native-capture evidence. `input.js` enforces a 16 MB file cap and
  hashes the file, `dialog.js` crops, and `view.js` displays. The
  20-million-pixel / 8192-side decode limit is enforced in
  `lib/image/screenshot.js`.

### The worker boundary (`app/worker/`)

`client.js` exports `ResearchWorker`, a bounded serial transport, not a
fallback solver. It creates `new Worker(new URL('./worker.js',
import.meta.url), { type: 'module' })`. It gives every request a sequence id
and a 30-second deadline, admits at most 8 queued tasks, and lets a newer
`infer` supersede queued ones. Clone failures, protocol failures, deadlines
and disposal reject the affected requests, and the main thread never falls
back to an unbounded solve.

`worker.js` is the only module loaded in the worker realm. It accepts exactly
`init`, `infer`, `discriminating`, `screenshot` and `native-screenshot`. It
rejects non-object messages and unknown operations. It caps the corpus at
10000 records and every payload at 1 MiB, calling `limits.js`'s
`assertPayloadSize(estimatePayloadBytes(data))` before any decoding.
`limits.js` is pure transport policy, which keeps it testable in Node.
The shared worker client projects corpus rows through `app/worker/corpus.js` before init:
only the seven fields used by geometry coverage cross the worker boundary.
Player/source metadata remains on the main thread; expanding provenance does
not raise the 1 MiB payload limit or change coverage weights.

## State and failure behavior

There is no localStorage, IndexedDB, cookie or service worker. Mode lives only
in the DOM, and state lives in one tab; anything durable is an explicit
download. Invalid or empty input disables export. A legacy import replaces
source state only after parsing and validation succeed; a rejected crosshair
leaves the previous valid one in place. A pasted CFG block is complete on its
own: in the automatic converter and the library default
(`parseLegacyText(text, base = GAME_DEFAULTS_2000908)`), every cvar the paste
does not set takes the documented pre-update game default (build 2000908,
SteamDatabase GameTracking-CS2 `d8e2c7a`, source ledger S13), never the
previous crosshair. An import note lists the filled cvars ("Not in the paste,
game defaults used: …"); the status line shows a count and the outcome table
the list. Share codes are complete and ignore the base. The importer reads
values as the old game did: bounded cvars clamp to the pre-update dump ranges
(alpha and RGB 0–255, outline thickness 0–3 with a typed 0 kept, split alpha
and ratio 0–1, outer split alpha 0.3–1) with a note each; alpha and RGB drop a
fraction (the old game stored whole numbers); a bool cvar is on for any
non-zero number; names are case-insensitive and scientific notation is
accepted. A colour index other than 0–7, a negative size or thickness, and a
non-decimal value (hex, NaN, Infinity) are rejected with a message naming the
cvar. Repeated cvars give one note with a count. New-build (2000914 and later,
including the outline colour, fill opacity and spread limit) cvars are
rejected on import with a message naming them; so is
`cl_crosshair_drawoutline 2`. A current `CS…` share code needs no conversion:
the converter says so and offers no export. Exported
configs are cvar commands only. If the worker
fails to start or breaks protocol, conversion is disabled.

## External contracts

These are the behaviours users and other tools can observe. Changing any of
them is a product change and needs a CHANGELOG entry.

- **Downloads.**
  - Automatic converter: `small-indie-crosshair.cfg`, plus
    `crosshair-quant-report.json` (schema `sicc-quant-report-v6`, model
    `version` `community-static-v11` or `quant-static-v6`, `targetBuild`).
    The app's download adds `exportedCommands`, the exact one-line export
    (null while blocked). Every report (community and historical) carries
    `exportedOverrides`, the full override set the export passes to
    `nativeCommands` (`style`, a hand-chosen `outlineMode`, and the edge-case
    `color` and `outlineMode` of `exportOverrides`, which win), and
    `exportBuild` `2000922`, the build the commands are formatted for.
    `targetBuild` is the build the model's hypotheses describe and native
    measurements must come from: `2000922` for the community model, `2000914`
    for the historical models, whose reports also carry `shapeCheck` and an
    empty `exportOverrides`; their numbers are unchanged.
    Schema v6 added `clamped[] {field, wanted, exported, reason}`,
    `options {outlineMode, styleTarget, corrections}` (0.17.0 adds `tShape`) and, in `settings`,
    `outline_width_rounded`, plus the warning codes `style-dynamic-at-rest`,
    `style-family-experimental`, `outline-user-override`,
    `outline-width-reduced`, `outline-asymmetric-approx` and, for the
    historical models, `outline-only-legacy`. The community model (v6) adds
    `exportOverrides` (colour, outline mode, and the T flag when it
    differs from the old one, ADR-0020), `shapeCheck` and
    `edgeCase`, and the warnings `crossed-arms-folded`,
    `inverted-t-unrepresentable`, `outline-only-as-core`, `dot-only-as-arms`
    and `zero-length-outline-dropped`, then `outline-overpaint-lost`,
    `additive-blend-approximated` and `weapon-gap-dropped` (`outline-alpha-unverified`
    was dropped), then `decision.refinement` and
    `appearance-refined`, then `corrections-off`,
    `decision.correctionsFallback`, `corrections-fallback` and
    `shape-approximate` and, added by
    the converter app for partial pastes, `defaults-filled`. Old styles 2, 3 and 5 export `cl_crosshairstyle 4`
    by default; old styles 0 and 1 are blockers, and a weapon gap no longer is.
    Every CFG export (automatic and manual) also emits
    `cl_crosshairoutline_r 0`, `_g 0`, `_b 0` and `_a 255`.
  - Screenshot page: `small-indie-crosshair.cfg`.
  - Other routes: `crosshair-audit.json` and `native-measurements.json`.
  - Reports carry model ids and schema ids. The `package.json` version
    appears only in `build-manifest.json`.
- **Imports.** Legacy v1 share codes (a pasted current `CS…` code is read and
  explained, not converted), the allowlisted legacy CFG subset
  (at most 32 KiB), measurement JSON, and PNG screenshots.
- **Routes.** Four active hash routes, legacy redirects, the notebook's
  `#chapter-N` anchors and the reader's validated `doc` parameter.

### Warning codes

Every warning a report carries is `{ code, text }`. This table lists every code
emitted in `lib/`. Paths: C = community model (`lib/solver/community.js`,
`community-edge.js`), H = historical models (`lib/solver/report.js`), both =
shared helpers. Structural and migration codes come from research-facing
helpers in `lib/solver/structural.js` and `lib/solver/migration.js`.

| Code | Path | When | Meaning |
|---|---|---|---|
| `community-reconstruction` | C | Always | The model is a community reconstruction, not native-validated. |
| `shape-loss-excludes-appearance` | both | Always | Core overlap (no shift) and the shape loss ignore colour, alpha, outlines and recoil. |
| `conditional-renderer-simulation` | H | Always | Previews simulate a renderer hypothesis, not a capture. |
| `direct-copy-not-migration` | H | Always | The copied column truncates and clamps; it is not Valve's migration. |
| `gap-scale-unresolved` | H | Always (structural: gap scales with length) | The build 2000914 dump does not say gap scales; the rival is open. |
| `gap-scale-rival` | structural | Hypothesis leaves gap unscaled | Same open question from the other side. |
| `legacy-rounding-disagreement` | C | Old round-to-even and truncation give different pixels | Two readings of the old game (rounding, dropping the fraction) disagree; the converter rounds, as other converters and community measurements do. |
| `pixel-centering-shift` | C | Odd width and the shape check is not exact, or the shape check is shifted | Old and new pixel centres differ, or rounding to whole current pixels moved the shape; a 1 px shift may remain. |
| `dimension-limit` | C | Converted length, width or radius differs from the target, no appearance refinement, shape check not exact | Integer steps or limits prevent keeping every dimension. |
| `corrections-fallback` | C | An edge-case redraw or the appearance window applied, and the plain conversion (corrections off) has a strictly higher selected aiming/appearance objective | The plain conversion matched the old crosshair better here, so it is exported; `decision.correctionsFallback` records both scores. |
| `shape-approximate` | C | Shape check approximate and no other loss-explaining warning (`LOSS_WARNINGS` in `community.js`) | States the aligned overlap; integer steps and whole-pixel rounding change the shape. |
| `old-shape-not-drawable` | C | `drawability.impossible`: the old visible look fails the outline-reach or mirror-symmetry proof for every colour assignment | No current setting draws the old crosshair exactly under the build 2000922 model (cvars unchanged in 2000927); the export is the closest drawable shape (ADR-0028). |
| `aim-shape-preserved` | C | A visible dot is prioritized and total appearance remains approximate | Separates aiming-core overlap from sacrificed outline coverage; model evidence only. |
| `appearance-refined` | C | The appearance window replaced the dimension-first tuple | A different length, thickness or gap improves the selected aiming/appearance objective. |
| `negative-gap-static-unverified` | C | The ideal new gap is negative (crossed arms fold to a non-negative gap unless the corrections are off) | Gap is clamped to 0; Static Cross with a negative gap is unverified. |
| `corrections-off` | C | Expert option `corrections: false`, legacy input | No crossed-arm fold, outline-only or dot-only redraw, or appearance window; the plain dimension-first export, whose loss the shape check shows. |
| `negative-gap-unrepresentable` | migration | Pixel-copy gap outside the new range | The overlap cannot be stored; the gap is clamped. |
| `visible-minimum` | C | Old thickness 0 | The old game drew a visible minimum; a positive thickness keeps it. |
| `literal-zero-conflict` | H | Old thickness 0 and target width not 1 | The zero minimum conflicts with a screen-relative thickness. |
| `zero-thickness-branch` | H, structural | Positive old thickness exports thickness 0 | How the current game draws thickness 0 is unverified; the historical model previews 1 px, the community renderer and `raster.js` draw nothing for width 0. |
| `crossed-arms-folded` | C | A negative gap made the old arms cross the centre | The export draws the same pixels with a non-negative gap |
| `inverted-t-unrepresentable` | C | T exported (the default `keep` exports every old T), the old stem stuck out above the bar or the outline strokes crossed (`edgeCase.tShape.flippable`, not `stem-hidden`), shape check approximate (ADR-0020) | Says where the old stem ran; the export keeps T, so only the part below the bar (or the arm below the centre) is drawn. |
| `t-flipped-for-shape` | C | T option `auto` and an old T exported as a full cross: planned for an upside-down T or a symmetric straddle, or a cross draws the old pixels strictly better (ADR-0020) | The export turns T off (`cl_crosshair_t 0`); the text follows the T-shape family (the cross's top arm reproduces an old arm above the bar). |
| `t-user-choice` | both | T option `on` or `off` exports another T flag than the old one (ADR-0025) | The export draws what was chosen; the text names the old shape. |
| `outline-only-as-core` | C | Size 0 drew only outline strokes | The strokes export as black bars, outline off unless chosen by hand. |
| `outline-only-legacy` | H | Size 0 drew only outline strokes | The historical export keeps length 0, which draws nothing now. |
| `dot-only-as-arms` | C | Size 0 with a dot | Arms inside the dot square are added; length 0 may draw nothing. |
| `zero-length-outline-dropped` | C | Size 0 with a dot and an outline, and the shape check approximate | The export is the closest shape found within the search window; part of the old strokes differs. |
| `outline-overpaint-lost` | C | Old draw order darkened earlier fills and the shape is approximate | The new game draws colour over outline; the export is the closest shape found within the search window. |
| `empty-geometry` | C, H | Old shape has no pixels and the export draws nothing (community: shape check empty) | Empty agreement is not evidence. |
| `export-draws-nothing` | C, H | Exported length 0 and no dot (community: and the old crosshair drew pixels, e.g. outline strokes with the corrections off) | The current game draws nothing for this export. |
| `outline-zero-width` | both | Outline on, typed width 0, automatic mode | The old game drew no outline; the export turns it off. |
| `outline-sharecode-rounded` | both | Share-code width 0 with the outline on and the automatic half outline exported | Codes round widths below 0.5 to 0, so a stored 0 means a thin outline; `outline-half-mapping` names the exported mode. |
| `outline-half-mapping` | both | Automatic export of the half outline (old width below 1) | Matches one user capture of the current game (issue #11). |
| `outline-replacement-unverified` | both | Exported full outline (mode 1) | Modelled as 1 px all round; no capture checks it. |
| `outline-asymmetric-approx` | both | Exported mode 1 and the old outline drew unequal sides | The new full outline is 1 px all round. |
| `outline-width-reduced` | both | Exported mode 1 and the old outline drew more than 1 px on every side | The new outline is 1 px. |
| `outline-user-override` | both | Outline mode chosen by hand | The export uses that mode. |
| `outline-choice-moot` | both | Outline mode 1 or 2 chosen by hand, exported length 0 and no dot | The current game draws no bars and no outline for this export, so the choice has no effect. |
| `style-family-experimental` | both | Style target `family` exports style 2 or 5 | At-rest shape assumed; motion is not modelled. |
| `style-dynamic-at-rest` | both | Old style 2, 3 or 5 exported as Static Cross | Matches the at-rest shape but does not move. |
| `legacy-style-5-gap` | C | Old style 5 | Style 5 rested at its own gap, a height-scaled rounded distance (ADR-0018); the export uses that gap, and the warning states both numbers. |
| `additive-blend-approximated` | both | `cl_crosshairusealpha 0` and no colour override | The additive fill exports as fill opacity 255 with normal blending; the outline keeps 200. |
| `weapon-gap-dropped` | both | `cl_crosshairgap_useweaponvalue 1` | The gap without the weapon value is used. |
| `color-index-unknown` | both | Share-code colour index 6 or 7 | Not a game preset; the stored RGB is used. |
| `defaults-filled` | app (`lib/settings/outcomes.js`) | A pasted CFG block left cvars unset | Lists the cvars added from the pre-update game defaults; the converter adds it to the report's warnings. Not for share codes or complete pastes. |
| `recoil-motion-not-modeled` | H | Recoil on | Follow-recoil is exported but not simulated. |
| `model-conflict` | H | Every hypothesis conflicts with native evidence | The normalized winner is not reliable. |
| `no-native-calibration` | H | No native calibration groups | Weights stay prior-only. |
| `native-capture-outside-model` | C | Supplied captures use a gap outside 0–128 | They are listed but not evaluated. |
| `native-holdout-conflict` | C | A supplied native holdout group does not match | The reconstruction conflicts with a capture. |
| `target-cropped` | C, H | The measured target or proposed image comparison is cropped | No exact image-match claim. |
| `preview-cropped` | H | The preview crops a large shape | The loss still uses the whole shape. |
| `image-mask-noisy` | H | Image-derived target | The mask does not identify the old cvars uniquely. |
- **Published files.** Everything under the published roots (below),
  served from a repository subpath with no rewrite rules.

## Data, research and generated artifacts

- `data/` holds only what the app fetches: `presets.json`, `corpus.json`,
  `corpus-meta.json`, `quant-summary.json`, `ml-crosscheck.json` and `pro-conversions.json`.
  The last is a generated comparison of v11 defaults and corrections off on
  published inputs at controlled heights. It carries the corpus fingerprint,
  exact/shifted/approximate outcomes and exclusions, never native accuracy.
  `corpus.json`, `corpus-meta.json` and `quant-summary.json` are retained
  outputs derived from the published corpus and model study;
  `ml-crosscheck.json` holds the cross-check parameters written by the
  research training pipeline.
- `research/generated/` holds committed study outputs and research artifacts
  (`quant-emulator.json`, `quant-modulator.json`). Benchmarks with timing
  fields are dated records rather than deterministic build outputs.
- `research/corpus/` and `research/comparisons/` retain the source records and
  frozen external comparison responses used by the public reports.
- `research/archive/2026-09-23/` is the frozen reference implementation and
  its outputs, hash-pinned by `research/archive/SHA256SUMS` and byte-stable
  via `.gitattributes`. Never edit it.
- `docs/notebook.html` is generated from `docs/math/*.md` by
  `scripts/notebook.mjs` (run by `npm run build`).
- `index.html` owns the shared header/footer. `scripts/site-chrome.mjs`
  adjusts their relative URLs for the notebook and document reader; the build
  stamps `docs/read.html` through `scripts/document-reader.mjs`.

CI runs `npm run build` on the supported Node versions and fails if generation
changes `docs/notebook.html` or the reader's shared chrome.

## Build and deployment

`scripts/site-files.mjs` is the single definition of what is public: the
published top-level documents, the published root directories (`app`, `lib`,
`data`, `public`, `docs`, `research`, `licenses`), the private exception
for research implementation and internal analysis outputs, and filters for local
and secret files. Both
`scripts/build.mjs` (which copies into `dist/`) and `scripts/http-policy.mjs`
(the dev/preview server allowlist) use it.

The build regenerates the notebook and reader chrome, copies the published files, and writes
`.nojekyll` and `build-manifest.json` (package version, research snapshot
date from `data/corpus-meta.json`, per-file SHA-256). It uses no minifier, network access or installed
packages. Changing the automatic model or its default needs at least a minor
version bump. See [deployment](deployment.md) and
[GitHub Pages](github-pages.md) for hosting and headers.

## Build check

CI runs the dependency-free static build on Node.js 22 and 24. The build
regenerates the notebook, copies only the public allowlist, and emits a file
hash manifest for the deployed tree.

## Where new code goes

- A new setting format or validation rule goes in `lib/settings/`.
- A pixel or geometry primitive used by more than one model goes in
  `lib/geometry/`.
- A change to the automatic converter goes in `lib/solver/`; a change to the
  manual lab goes in `lib/manual/`. If both need it, move it down a layer
  instead of importing sideways.
- DOM, canvas and worker code goes in `app/`, in the route's folder.
  Bundled data fetches go through `app/data.js`.


### v11 visible aiming-shape revision

ADR-0026 adds optional `implementationRevision`, `taxonomy` and `aimingShape`
fields to community schema-v6 reports; existing field meanings are unchanged.
`shape-taxonomy.js` recognizes composited visible pixels, recording family,
core/outline/silhouette area and bounds, connectivity, crossing, T, parity,
opacity and motion facts. Dot-like cores with distinct ink use core-first
refinement and fallback with a shared alignment shift. The full `shapeCheck`
may be lower to preserve the aiming point; `aimingShape` and warnings expose
that tradeoff. Measured/image targets have no inferred legacy taxonomy.
`community-static-v11` remains the public model name; the app is 0.19.1 and
`visible-stroke-fit-2026-10-07` distinguishes implementation provenance (unchanged
by presentation-only releases). ML
parameters and summary compatibility require the same revision. Reused
holdouts remain model regression evidence, never native accuracy.


ADR-0027 extends this taxonomy with exact hash and hollow-frame recognition,
`material`, `silhouetteFamily`, and `holes` / `holeArea` on each region's facts.
`region-structure.js` computes enclosed background components and horizontal /
vertical runs on compressed edges. An outline-only hash is named by its shape;
its material still records that no old coloured core was visible. The visible
source fill is measured with the source renderer, including screen endpoints.

`visible-candidates.js` adds proposals from visible runs in each colour and the
whole silhouette: both orientations, measured dimensions and inner edges,
plus centre-spanning half-length proposals. Each axis fits the measured size
and its ±1 px neighbours to legal native integers. These candidates can lie
outside the local window and must strictly improve the same objective; the
report records their count in `decision.refinement.window.visibleStrokeProposals`.
The ML mirror derives its own candidates with a native-axis scan and shares
only low-level compositing and run extraction. Neither search is a global
optimum or a native-renderer accuracy claim.


Screenshot colour discovery retains bright/saturated cores first. When that
path fails, it tests up to five neutral/dark colours, and only exact measured
hash/frame masks qualify for that fallback. This adds optional `detectedFrame`
to image-fit diagnostics without inferring legacy flags or changing measured
solver targets. The Screenshot page names the detected foreground and the
visible converted family; unsupported frames retain the existing quality gate.
