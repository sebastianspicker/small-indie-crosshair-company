# Crosshair source and quality audit — September 29, 2026

The newest public tracker snapshot located for the requested date is build
**2000919**, committed September 28 at 22:43 UTC. Its crosshair convar inventory
is unchanged from **2000918**, September 25. The app therefore retains 2000918
as the inspected reconstruction target and advances its conversion policy to
`community-static-v2`. Metadata continuity is not proof that compiled rendering
behavior stayed identical. There are still no independently reviewed native
old/new capture pairs in this repository.

Two research agents independently checked sources and code; one also reproduced
image and solver defects. Their agreement is a cross-check, not additional native
evidence. Implementation and verification remained with a single checkout writer.

## Pinned sources and currentness

| Evidence | Inspected version | What it establishes |
| --- | --- | --- |
| [Pre-redesign convars](https://github.com/SteamTracking/GameTracking-CS2/blob/d8e2c7a4f9b86e60d5a1b584a83ee0e15f59cc54/DumpSource2/convars.txt) | Build 2000908, September 9 | Names and descriptions before the redesign |
| [First redesigned convars](https://github.com/SteamTracking/GameTracking-CS2/blob/10f3693c381475016b128c549928d14eb3adfcf2/DumpSource2/convars.txt) | Build 2000913, September 23 00:05 UTC | New units, ranges, authoring-height metadata and style meanings |
| [Latest changed convars](https://github.com/SteamTracking/GameTracking-CS2/blob/3fc98e763328f7d1627405b389d1b6b69c5b0e38/DumpSource2/convars.txt) | Build 2000918, September 25 | Half-outline and Static Square additions; current settings inventory |
| [Newest tracked commit](https://github.com/SteamTracking/GameTracking-CS2/commit/ce2a2deb0cba2f7e8443901690c0abdb5191b7ab) and [build metadata](https://github.com/SteamTracking/GameTracking-CS2/blob/ce2a2deb0cba2f7e8443901690c0abdb5191b7ab/game/csgo/steam.inf) | Build 2000919, September 28 | Nine changed files; no convar or crosshair UI change in this commit |
| [Valve September 22 announcement](https://www.counter-strike.net/newsentry/674006995886407685) and [update feed](https://www.counter-strike.net/news/updates?l=english) | September 22–28 entries inspected | Redesign, pixel-unit explanation, resolution rescaling, gap-zero fix and added styles; September 28 entry contains no crosshair change |
| [Public community renderer](https://crosshair.club/static/js/cs2-crosshair-render.js?v=1790553505) | Retrieved September 29 | Same bytes as September 28; useful reconstruction, not Valve code |
| [Crosshair Restore methodology](https://crosshairrestore.com/conversion-method/) | Existing September 28 inspection | Author's account of captures and half-even rounding, without independently downloadable raw measurements |

Complete `convars.txt` SHA-256 values, in the order old / first-new / latest-relevant:

```text
5f7d0b3e965fc9aa5260f7ef084f86f46557e8ed87835fe6e4d6644121f9a079
43ef1be9823540a229c759a8b30a55c6bd8952ba90d1f7064a3113fcb9c968c9
58428ff69e1580052d5ef5da403c50bc600eb415d520f3a58c15008dc2217273
```

Retrieve the pinned `raw.githubusercontent.com/SteamTracking/GameTracking-CS2/`
revision and `DumpSource2/convars.txt`, hash the complete bytes, then extract
crosshair entries with `rg -i -A 1 '^cl_crosshair|^cl_fixedcrosshair'`.
The corresponding excerpt hashes are:

```text
1714c792c4907b193e5a3b6c56a62dedd11926e066073e4313f182524bf64a31
5639abc9f0c464f2ab7fbbcd777b4ecbc2d0e91d7129deb4d584706611165c72
5f5ac07080791a3631c97924167741a4393fd0167e20e73796497e0ea303dff6
```

The current community renderer still hashes to
`afd299f092e6e12bb005096cc4febc4dc83f76d6558af49529f423cf4a2fa2a9`.
All 24 frozen observations from the
[previous audit](converter-audit-2026-09-28.md) still match the new policy.
These are regression comparisons, not fresh holdouts for v2. One additional
diagnostic converter GET was made during research; it did not affect fitting
and is excluded from the reported frozen comparison set.

## Old and new crosshair generation

| Property | Old system | Redesigned system / evidence limit |
| --- | --- | --- |
| Length | `cl_crosshairsize`, arbitrary units scaled by display height | `cl_crosshair_length`, integer 0–255, authored pixel units |
| Thickness | `cl_crosshairthickness`, arbitrary units and visible minimum | `cl_crosshair_thickness`, integer 0–31; dump says minimum one pixel, community renderer hides literal zero |
| Gap | Signed `cl_crosshairgap`, including negative overlap | `cl_crosshair_gap`, 0–128, described relative to the centre |
| Resolution | Recompute old dimensions using height/480 | `cl_crosshair_screen_height` records authoring height; positive dimensions rescale with current/authored height |
| Alpha/color | Preset color plus `cl_crosshairalpha` and use-alpha switch | Explicit RGBA, including `cl_crosshaircolor_a`; old preset/use-alpha controls absent from inspected inventory |
| Outline | Boolean plus separate outline thickness | Outline modes 0/1/2, including half outline; pixel coverage not validated here |
| Style | Old meanings, default 2 | Reassigned meanings, default 7; new 8 = Static Square. Equal style numbers do not establish equal appearance |
| Dynamics | Weapon-gap and split controls | Reworked dynamics; unsupported by this static-core converter |

Old size, thickness and alpha symbols persist as hidden variables. Their presence
does not establish supported migration behavior. The first redesigned crosshair
convar entries are byte-identical to 2000914; the changes by 2000918 are the
outline modes and the additional style. UI metadata also changed separately:
the initial thickness slider showed 32, subsequently 31. Do not substitute a UI
slider for the actual cvar bound.

A source discrepancy remains: the current dynamic-spread convar description
mentions a 128-pixel baseline, while Valve's September 23 notes describe 64.
Treat the description as potentially stale; neither supplies a validated dynamic
renderer. Layout metadata disabling fractional-position clamping likewise does
not specify native rounding or raster coverage.

The static reconstruction continues to use binary32 half-even old length/width,
signed truncated old gap offset, and rounded positive new dimensions with
centre-based gap. At 1080p, old size 2.5 / thickness 0 / gap -3 becomes length 6 /
thickness 1 / gap 2. The historical truncation dimension would be length 5.
These equations follow inspected community behavior. Dumps and release notes
alone cannot prove their native pixel accuracy.

## Converter and image improvements

The converter retains its dimension-first policy. It now compares exact preview
overlap among gap settings tied for minimum radius error, scoring each distinct
rendered radius once. It never widens a bar merely to improve overlap. On a
prespecified synthetic grid of 4,620 conversions, **180 improve, zero regress**;
average IoU moves from 0.44804 to 0.45408, with largest improvement 0.66667.
For size .5 / thickness .5 / gap -2 at old/current 1080 and authored 720, choosing
gap 1 instead of equally good gap 2 increases IoU from 1/9 to 1/4.
This is a tie-policy improvement, not a globally optimal image solver.

The image search previously double-counted overlapping rectangles when ranking
candidates, then only checked the top 48 exactly. An exact length-8, width-9,
near-0 mask consequently returned IoU 0.99556. Integral-image scoring now uses
rectangle-union inclusion/exclusion for every candidate, with at most 31 terms.
Signed near edges extend the bounded domain to -16–24. All 24 overlapping/thin/
thick/T-shape study masks reconstruct exactly; multiple explanations are counted
and are not presented as unique recovered settings.

Screenshot representative cvars now follow half-even dimensions and round-trip
through the current old reconstruction. Previously one-pixel inferred lengths
could become two pixels because representatives used truncation buckets.
White cores can be automatically segmented. Acceptance requires at least 90%
mask agreement, no foreground at a crop boundary, and at least 98% mask agreement
under RGB tolerances eight units either side of the selected tolerance. This is
a sensitivity check, not a probability. Native measurements additionally require
consistent solid components, matching dot/T/bar presence and equal dot/bar width.
Missing arms cannot silently become a different declared style.

Current-model native holdouts now have deduplicated capture-group success rates
and Wilson intervals. Calibration rows do not enter the holdout score. Only fields
actually measured are checked, including transverse origin when present. User
attestation does not prove independence; individual native-match probability
remains unidentified. Synthetic rows never increase that confidence.

## Learning and confidence evaluation

The new residual model learns corrections to an input-only rounded analytic
guess. It uses the existing dependency-free boosted trees, not the exact inverse
as an input feature. Raw, geometry and residual variants use the same label task,
same capacity grid, same splits and validation-only selection. Final models refit
training plus validation, excluding calibration and test.

The 3,200 synthetic rows represent 100 setting triples: 43 train groups, 20
validation, 16 calibration and 21 test. All height/goal/dot/T variants stay within
their setting group. The previous release's 90.48% used a different target/tie
policy and no separate calibration split; compare the freshly retrained models
below instead of treating these as identical experiments.

| Predictor | 672 test rows / 21 groups | 1,152 challenge rows / 96 groups |
| --- | ---: | ---: |
| Naive assignment | 0.00% | 0.35% |
| Rounded analytic guess | 80.21% | 80.12% |
| Raw-feature boosted trees | 25.89% | 3.13% |
| Geometry-feature boosted trees | 87.05% | 14.41% |
| Analytic guess + learned residual | **93.90%** | **72.66%** |

These are exact native-tuple agreement rates with **our deterministic solver**.
The challenge was defined before evaluation and covers novel fractional values,
binary32 boundaries, large dimensions and three unseen resolution triples.
Residual learning improves the former learned model substantially, but its lower
challenge fidelity than the analytic guess prevents an extrapolation claim.

The residual model has zero length/width MAE on the test set and 0.06845-pixel
near/far MAE. Cluster bootstrap stability for test tuple fidelity is approximately
91.07–96.43%, resampling 21 groups, not 672 independent rows. This interval
describes the synthetic sample, not CS2 correctness.

Reserved calibration uses the maximum absolute tuple error over every row/output
in a setting group. The [split-conformal rank rule](https://arxiv.org/abs/2107.07511)
at alpha .1 selects rank 16 of 16, yielding a one-cvar-step residual radius. All
21 test groups fall within the intervals. All 96 shifted challenge groups trigger
feature-range abstention: **no shifted-group interval coverage is assessed**.
Too few calibration groups also produce abstention. Marginal feature ranges are
only a rejection heuristic; membership does not prove distributional support.
Exchangeability is not established by this designed grid, so no guaranteed 90%
coverage or native-game confidence is advertised.

## Recorded verification and remaining limits

The retained outputs are `research/generated/converter-comparison.json`,
`quality-study.json` and `community-emulator.json`. The development verification
regenerated quality studies and exactly retrained the committed ML artifact.
Checks covered prior failures, split separation, calibration/abstention and
artifact hashes. Browser QA covered the worker-backed image acceptance flow.
Training implementation and development tests are not included in this public
release; the artifacts retain the experiment design and measured results.

No research model enters runtime. No dependency, remote request or persistence
was added to the app. Original native captures at pinned builds and resolutions
are still required to validate rounding, zero visibility, outline/color coverage,
dynamic styles and native accuracy.
