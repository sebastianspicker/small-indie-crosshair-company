# Source and claim ledger

Snapshot 2026-09-23. Entries describe what each source supports, not a blanket guarantee
about the game. Public source files are linked rather than republished wholesale.
The original archive provides the chain of custody for the prior research.

The [October 1 note](build-2000922-update-2026-10-01.md) adds build 2000922
(see [S11](#s11-build-2000922-inventory)). The 2026-10-02 additions are
[S12](#s12-other-converters-and-calibration-tools) to [S14](#s14-leaked-old-renderer-source-and-the-reporters-screenshot), and
[S15](#s15-bindr) to [S18](#s18-valve-statements-via-secondary-outlets) from the
[October 2 survey](competitor-survey-2026-10-02.md). [S19](#s19-build-2000924) adds
build 2000924 (2026-10-03 dump comparison). The entries below otherwise retain
their original snapshot scope.

## S01 Old static geometry

KZGlobalTeam / cs2kz-metamod, commit
`20e376c2b1647fb34a263e13445da00fc2ca02f7`,
[`src/kz/hud/layout/crosshair.cpp`](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/20e376c2b1647fb34a263e13445da00fc2ca02f7/src/kz/hud/layout/crosshair.cpp).

**Supports:** a community reconstruction documenting the old static painter's height/480
size scale, truncation, minimum width, raw gap adjustment, width-dependent longitudinal
placement, color presets and alpha-disabled fallback.

**Does not support:** our own native validation, full new rendering, or treating the
replica's Panorama layout/opacity quantization as exact native behavior. The project
implements the mathematical relationships, not the server plugin or its UI machinery.

## S02 Old variable inventory

SteamTracking / GameTracking-CS2, commit
`d8e2c7a4f9b86e60d5a1b584a83ee0e15f59cc54`,
[`DumpSource2/convars.txt`](https://github.com/SteamTracking/GameTracking-CS2/blob/d8e2c7a4f9b86e60d5a1b584a83ee0e15f59cc54/DumpSource2/convars.txt).

**Supports:** the earlier investigation's old variable names and descriptions.
**Does not support:** the exact rendering arithmetic merely because a variable exists.
This is a pinned pointer retained in the historical source record.

## S03 New build inventory

SteamTracking / GameTracking-CS2, build 2000914, commit
`98da94fc084706334e85fcde5105d02224e30f0a`,
[`DumpSource2/convars.txt`](https://github.com/SteamTracking/GameTracking-CS2/blob/98da94fc084706334e85fcde5105d02224e30f0a/DumpSource2/convars.txt).

**Rechecked during repository construction:** the crosshair region lists new length,
thickness, gap, color alpha and authored-height variables; ranges are length 0–255,
thickness 0–31, gap 0–128, alpha 0–255; authored height has a minimum 240. The description
connects authored height to size edits and describes resolution-scaled length/thickness.

**Does not support:** native quantizer, precise centering, half-pixel behavior, migration
callbacks, a global 720p reference, or a new share-code serializer. This is game-derived
data in a tracker, not Valve-published renderer source.

**Re-read on 2026-09-23.** The same pinned dump was re-read for the v0.4
conversion plan. The crosshair grep found `cl_crosshairgap`, `cl_crosshairusealpha`,
`cl_crosshaircolor` (preset index), `cl_crosshair_outlinethickness`,
`cl_crosshairgap_useweaponvalue` and `cl_fixedcrosshairgap` **absent**, while the
hidden `cl_crosshairsize` (3.9), `cl_crosshairthickness` (0.6) and
`cl_crosshairalpha` (200) are still listed. The gap description reads “Offset added to
the gap between the crosshair center and the bars” and does **not** say gap scales,
although length and thickness do. The re-read still does not support a quantizer, a gap
origin, a migration callback or a share-code serializer. The machine-readable table is
[`lib/settings/cvars.js`](../../lib/settings/cvars.js).

## S04 New crosshair UI

Same pinned build,
[`settings_crosshair.xml`](https://github.com/SteamTracking/GameTracking-CS2/blob/98da94fc084706334e85fcde5105d02224e30f0a/game/csgo/pak01_dir/panorama/layout/settings/settings_crosshair.xml).
The first build's UI is pinned at
[`10f3693c381475016b128c549928d14eb3adfcf2`](https://github.com/SteamTracking/GameTracking-CS2/blob/10f3693c381475016b128c549928d14eb3adfcf2/game/csgo/pak01_dir/panorama/layout/settings/settings_crosshair.xml).

**Supports:** the prior source inspection's integer display controls and the thickness
slider maximum changing from 32 to 31. **Does not support:** another wholesale renderer
conversion simply because that slider limit changed.

## S05 Legacy share-code layout

AkiVer / csgo-sharecode, commit `753f16fe97f9bbb121fb56675b40f035ad403d05`,
[`src/index.ts`](https://github.com/akiver/csgo-sharecode/blob/753f16fe97f9bbb121fb56675b40f035ad403d05/src/index.ts).

**Supports:** the legacy byte layout, base alphabet, checksum and field decoding/encoding
used by the adapter. The repo retains the upstream MIT notice. Our adapter additionally
rejects unknown versions, invalid alphabets, nonrepresentable values and oversized codes;
it preserves reserved bytes/bits during legacy round trips.

**Does not support:** interpreting a new-format code as legacy because it shares a text
prefix, or identifying a player's actual current preferences from a checksum.

## S06 Historical hauptrolle generator

Commit `5210ae71166411e9d962cf372b7b72ad94464cc2`,
[`CrosshairPreview.js`](https://github.com/hauptrolle/csgo-crosshair-generator/blob/5210ae71166411e9d962cf372b7b72ad94464cc2/src/components/CrosshairPreview/CrosshairPreview.js).

**Supports:** a fixed preview formula that truncates size early, multiplies by two,
adds a unit above truncated size two, and doubles thickness without the old-model
minimum. Its gap reads `cl_fixedcrosshairgap`, not the tested classic-static gap.

**Does not support:** a canonical CS2 engine formula. Gap is deliberately excluded from
its numeric comparison; cross-height preview mismatch counts are diagnostic only.

## S07 Historical Skarbo generator

Commit `69fe7d263aecab6a5ed6a2310cce967074fc8da0`,
[`javascript.js`](https://github.com/Skarbo/CSGOCrosshair/blob/69fe7d263aecab6a5ed6a2310cce967074fc8da0/javascript/javascript.js).

**Supports:** helper functions using a 19/10 factor for length and thickness in a browser
preview. **Does not support:** factor 1.9 as a resolution-independent native conversion.
The full historical application was not executed; this source audit is not counted as
a renderer test.

## S08 Dated pro records and methodology

The eight source page URLs, recorded dates, map context and exact codes are retained in
[`data/presets.json`](../../data/presets.json) and the frozen archive. Their source is
xhair.pro. Its [methodology](https://www.xhair.pro/en/methodology) describes extracting
codes from public match demos and retaining match context. That page was rechecked
during construction; it describes observations, not permanent player endorsements.

**Supports:** provenance reported by the data provider and useful dated fixture inputs.
**Does not support:** a claim that this repository downloaded/reparsed those demos,
verified player identity matching, or established current settings on September 23.
Checksum and field tests independently validate only the code data, not its attribution.

## S09 Previously reported website reference height

The prior archive cites the [xhair.pro library](https://www.xhair.pro/en/crosshairs) for a
720-height reference. **Current verification status:** the retrieved parsed page during
construction did not contain that statement. Preserve it as an archived report, not
currently corroborated native or website behavior. See correction C01 in the
[formula evolution](formula-evolution.md). It is not an input to the implemented formula.

## S10 Frozen experiment archive

The original numerical experiment is retained unchanged in
`research/archive/2026-09-23/`. `SHA256SUMS` covers each original file; the
archive includes the Python experiment and its stored result.

**Supports:** exact reproducibility of the earlier numerical experiment and a stable
record of its assumptions, sources and limitations. **Does not support:** treating
historical prose as immune to later correction. The active notebook documents corrections
without modifying the archived record.

## S11 Build 2000922 inventory

SteamTracking / GameTracking-CS2, build 2000922, commit
`6ac247908a83c309b37314fd097c47dc78103746`,
[`DumpSource2/convars.txt`](https://github.com/SteamTracking/GameTracking-CS2/blob/6ac247908a83c309b37314fd097c47dc78103746/DumpSource2/convars.txt),
SHA-256 `667b1d2ecb36673097ea14058ef66447c3148acbf11f496a77eba64243e2fec4`
(identical to build 2000921), plus the Valve October 1 2026 update entry.

**Supports:** signed `cl_crosshair_gap` range -3840..3840, thickness 0..32, style 9,
outline colour cvars, shader version 2 and the renderer class change. Hashes,
the changelog table and reproduction steps are in the
[October 1 note](build-2000922-update-2026-10-01.md).

**Does not support:** native pixel behaviour of any setting, negative gaps on
static styles, or the new share-code layout.

## S12 Other converters and calibration tools

Source-level study on 2026-10-02 (code read, not run against the game). Licences
decide what may be reused: this project copies none of them. Decompile-derived
constants are **stated** (a claim by the tool's author), not verified.

| Tool | Revision | Licence | Evidence class | Findings |
|---|---|---|---|---|
| JDD310 / CS2-Crosshair-Converter | `013c559` | MIT | Stated (community model) | Our output equals it on five test inputs; the community model's formulas are the same family |
| Horizzon1 | `3a867cc` | not recorded | Stated | Gap `+ thick % 2`, stale clamps, no `screen_height` |
| patriqcs / cursed-crosshair-generator | `fa88525` | MIT | Stated; has calibration tools | Gap `+ floor(thick / 2)`; drops the outline when the stored width is 0 |
| SpiRaL-network / cs2-crosshair-lab | `72e81b8` | none (all rights reserved) | Stated; read only | Scales the legacy gap by H / 480, which contradicts S01 |
| akiver / csgo-sharecode | v6.0.0 `996e37e` | MIT | Stated (share-code codec) | Reference for the legacy v1 code layout |
| unicbm / demotracer | not recorded | AGPL | Not used | Do not copy or derive from it |
| crosshairrestore.com | n/a (closed) | closed | Claim only | Claims 13 holdout captures; none are available to inspect |

**Supports:** that independent reimplementations agree on length and width and differ
on the gap origin and outline handling, which are the open questions in the
[October 2 protocol](capture-protocol-2026-10-02.md).

**Does not support:** any native pixel claim. Agreement between tools is not
validation: they share assumptions.

## S13 Game dumps before and after the update

SteamDatabase / GameTracking-CS2, builds 2000691 through 2000922 (`d8e2c7a` is the last
pre-update build 2000908; `10f3693` 2000913 first shows the crosshair material;
`18d0779` 2000915 the first shader dump; `3b5862a`, `42d0ddd`, `6ac2479` as in the
[October 1 note](build-2000922-update-2026-10-01.md#2026-10-02-addendum)).

**Supports** (verified in the dumps): the shader's inclusive integer bounds and
independent outline expansion, the removal of the Panorama crosshair panel and of
per-weapon gap data, the per-style UI controls, the removed names that survive as
strings.

**Does not support:** CPU-side layout arithmetic, which is compiled, or any native pixel
result.

## S14 Leaked old-renderer source and the reporter's screenshot

Leaked cstrike15 `weapon_csbase.cpp`, `perilouswithadollarsign/cstrike15_src`
`f82112a` (stated; a leak). User screenshot from issue #11, recorded in
`research/measurements/old-client-issue-11.json` (user-supplied old-client observation,
SHA-256 `8c06350b289f1a959d0957a5886f68d0a2cd5113e7ca046268288410268bf115`).

**Supports:** the old outline rule `DrawFilledRect(x0 - t, y0 - t, x1 + t, y1 + t)` with
float truncation, outline alpha equal to crosshair alpha, and the rows of the reporter's
`#`. A research comparison reproduces the shape exactly at a +3 px x offset.

**Does not support:** an explanation of the +3 px offset, behaviour of the new client,
or any holdout use: the observation is outside every holdout and outside the measurement
intake.

## S15 bindr

`percdotdev/bindr` `17e906d` (2026-10-01), PR #1 by kWAYTV,
`packages/cs2/src/crosshair/legacy/migrate-legacy-crosshair.ts`. No licence file found;
read only, formula restated ([survey](competitor-survey-2026-10-02.md)).

**Supports** (code-derived): another reimplementation with the common old-side model,
`Math.round` (half up, so half away from zero for these non-negative values) instead of
half-even, thickness at least 1, gap origin `ceil(thickness / 2)`, negative gaps only for
Classic Dynamic, outline black at the crosshair alpha, usealpha 0 exported as 255. Used as
the `bindr` cross-tool baseline in the converter comparison.

**Does not support:** any native pixel claim.

## S16 Closed converter pages

cstools.io/crosshair and crosshair.club/convert, fetched 2026-10-02 (closed source).

**Supports** (stated): cstools.io says conversion needs the play resolution;
crosshair.club says its renderers were rebuilt from the game and labels results
identical or almost identical.

**Does not support:** any formula or pixel claim; neither page shows its method.

## S17 Decompile notes of the new renderer (cursed-crosshair-generator)

`patriqcs/cursed-crosshair-generator` `fa88525`, `public/js/preview.js` (MIT). Stated by its
author as Ghidra on libclient.so build 2000922 and a shader reconstructed from SPIR-V; the
calibration screenshots it cites are not in the repository.

**Supports** (stated decompile, not measured): odd widths sit one pixel up-left of centre;
length or thickness 0 draws no bar and no outline; negative static gaps clamp to 0; fill
composited over outline per pixel, normal blending in linear light, no additive mode; the
dot is a thickness square drawn when `cl_crosshairdot` is set, **independent of length**.
The last claim conflicts with the user statement behind the edge-case rules (nothing at
length 0) as far as the dot goes; it is recorded as conflicting secondary evidence.

**Does not support:** a measured result: no capture of a length-0 dot or a half outline is
published.

## S18 Valve statements via secondary outlets

Patch-note text for builds 2000914 (2026-09-22), the 2026-09-23/24 hotfix and 2000922
(2026-09-30 / 10-01), quoted by timesaver, skinsmonkey, fpshub, fragster and pley (Steam
pages were not reachable).

**Supports** (stated): pixel units with automatic rescaling; half outline draws only the
top-left portions; gap 0 respected only after the 2026-09-24 hotfix; negative gaps only for
Classic Dynamic; outline colour, Static Quadrant and a new share-code format on 2000922; no
official migration tool.

**Does not support:** exact quotes from Valve's own pages, or any pixel arithmetic.

## S19 Build 2000924

SteamDatabase / GameTracking-CS2, build 2000924, commit `7193ca8` (2026-10-02;
`steam.inf` VersionDate Oct 02 2026, SourceRevision 11076591), compared file by file
with 2000922 (`6ac2479`) and the pre-update 2000908 (`d8e2c7a`).

**Supports** (verified in the dumps): no crosshair change. Convars, renderer class,
Panorama crosshair files, schemas and `csgo_crosshair.slang` are unchanged, and the
crosshair string set is byte-identical to 2000922; `csgo_english.txt` changes one
unrelated token. `workshop_cvar_whitelist.txt` (lines 85 to 111) swaps the old crosshair
cvars for the new ones (details in
[settings migration](settings-migration.md#update-october-3-2026-what-the-dumps-say-about-migration-2000908-to-2000924)).

**Does not support:** any pixel behaviour beyond what 2000922 already leaves open.
Captures of 2000924 count as 2000922 captures.

## Claim-to-artifact traceability

| Claim / hypothesis | Evidence | Implementation / artifact |
|---|---|---|
| Old length and width use height/480 | S01 | `legacyGeometry`; retained 56-row audit |
| Old negative gap conversion truncates | S01 | -4.5 and -5.1 fixtures |
| Literal-zero branch should be preserved | S01 + S03; new behavior conditional | `convert`; explicit zero branch |
| New gap includes half-width baseline | Hypothesis, not established | `gapBaseline: thickness` |
| New gap is center-relative | Rival hypothesis, not established | `gapBaseline: center` |
| New authored scaling is current/authored | Inference from S03 | `predictedGeometry`; explicitly conditional |
| New quantizer is truncation or nearest | Rival hypotheses | Selectable `rounding`; generated study rows |
| Browser fixed ×2 is not universal | S01/S06 plus computation | `runAudit`; 32/56 mismatch result |
| Measured affine fit parameters | User-entered or synthetic data only | `fitAffine`; scope and residual checks |
| Gap scaling is unresolved on build 2000914 | S03 re-read; dump omits a scaling sentence | `structural.js` `gapScale`; `gap-scale-unresolved` warning |
| Structural gap-scale rival is not the default | This plan; zero native pairs | `research/generated/structural-disagreement.json` |
| Pixel-copy and rename candidates disagree | S01 + S03 recomputation | `lib/solver/migration.js` |
| Residual modulation stays closed | Zero reviewed native pairs | `research/generated/quant-modulator.json` |
| Old outline grows low edges by ceil(t), high by floor(t) | S14 (stated leak) + reporter's rows | `legacyOutlineExtent`; `research/measurements/old-client-issue-11.json` |
| Reporter `#` matches the old model up to +3 px in x | S14 | `research/measurements/old-client-issue-11.json` |
| Shader rect bounds are inclusive with separate outline min/max | S13 (verified) | Documentation only; no code depends on it |
| Old elements draw left, right, top, bottom, dot, each outline then fill | S14 (stated leak) | `legacyElements`, `legacyAppearance` |
| Old usealpha 0 fill is additive at alpha 200, outline normal at 200 | S14 (stated leak) | `additiveExportAlpha`; `research/generated/additive-alpha.json` |
| Old outline thickness is bounded 0.1..3 | S14 (stated leak) + S13 pre-update dump (0..3) | `clampOldRanges` |
| New outline alpha is not multiplied by the crosshair alpha | User capture (issue #11, `alphaAnalysis`) | `nativeCommands` outline alpha |
| New dot draws at length 0 | S17 (stated decompile), conflicts with the issue #11 user statement | Not relied on: dot-only exports draw the same pixels either way |
| Zero-length bars draw no outline | User statement (issue #11) + S17; the dumped shader alone would outline an empty rect (S13, slang lines 339 to 349) | `outlinesZeroLength` |
| Build 2000924 renders like 2000922 | S19 (verified dump comparison) | `RENDERER_EQUIVALENT_BUILDS` |
| Exact game compatibility | No shipped evidence | No production claim or native-verified fixture |


## September 29 follow-up

The [latest dump audit](converter-audit-2026-09-29.md) adds pinned source hashes
and compares build 2000919 with 2000918. The [accuracy study](accuracy-improvements-2026-09-29.md)
and [structured-learning study](structured-learning-2026-09-29.md) retain the new
synthetic comparisons, fitting protocols and their evidence limitations.
