# Source and claim ledger

Snapshot 2026-09-23. Entries describe what each source supports, not a blanket guarantee
about the game. Public source files are linked rather than republished wholesale.
The original archive provides the chain of custody for the prior research.

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
This is a pinned historical pointer retained from the conversation evidence.

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

## S10 Supplied experiment archive

`cs2_crosshair_conversion_research_2026-09-23.zip`, supplied with the conversation.
Extracted unchanged into `research/archive/2026-09-23/`. `SHA256SUMS` covers each original
file. `scripts/reproduce.py` checks those bytes and reruns the Python experiment.

**Supports:** exact reproducibility of the earlier numerical experiment and a stable
record of its assumptions, sources and limitations. **Does not support:** treating
historical prose as immune to later correction. The active notebook documents corrections
without modifying the archived record.

## Claim-to-code traceability

| Claim / hypothesis | Evidence | Code / test |
|---|---|---|
| Old length and width use height/480 | S01 | `legacyGeometry`; all 56 Python-parity cases |
| Old negative gap conversion truncates | S01 | -4.5 and -5.1 fixtures |
| Literal-zero branch should be preserved | S01 + S03; new behavior conditional | `convert`; zero and screen-goal conflict tests |
| New gap includes half-width baseline | Hypothesis, not established | `gapBaseline: thickness` |
| New gap is center-relative | Rival hypothesis, not established | `gapBaseline: center` |
| New authored scaling is current/authored | Inference from S03 | `predictedGeometry`; explicitly conditional |
| New quantizer is truncation or nearest | Rival hypotheses | Selectable `rounding`; scaled-boundary tests |
| Browser fixed ×2 is not universal | S01/S06 plus computation | `runAudit`; 32/56 mismatch result |
| Measured affine fit parameters | User-entered or synthetic data only | `fitAffine`; scope and residual checks |
| Exact game compatibility | No shipped evidence | No production claim or native-verified fixture |
