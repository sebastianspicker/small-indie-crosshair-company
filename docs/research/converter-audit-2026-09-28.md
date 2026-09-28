# Converter audit — 2026-09-28

The default now uses `community-static-v1`, targeting the inspected build
2000918. The previous truncation/thickness-relative default disagreed with
every tested crosshair.club tuple. Its own exact previews were self-consistency
checks, not evidence that it represented the game. The historical model and
frozen archive remain available; no archive equations or hashes were rewritten.

## Sources and their limits

| Source | What we inspected | What it establishes |
| --- | --- | --- |
| [crosshair.club converter](https://crosshair.club/convert) | Public page, scripts, and 24 synthetic GET requests to `/api/convert` on September 28 | Actual external-software outputs at the requested resolution; not game captures |
| [Public renderer](https://crosshair.club/static/js/cs2-crosshair-render.js?v=1790553505) | `rescale`, static arms, dot and thickness placement | An inspectable community reconstruction: centre-based radius, odd-width placement, zero visibility and positive-value rescaling |
| [CS2 Crosshair Restore methodology](https://crosshairrestore.com/conversion-method/) | Owner's descriptions of old/new captures at 1080 and 960 lines | Reports round-to-even old dimensions and centre-based new gaps; images and measurement files are not published, so we cannot independently validate them |
| [Pinned current game cvars](https://github.com/SteamTracking/GameTracking-CS2/blob/3fc98e763328f7d1627405b389d1b6b69c5b0e38/DumpSource2/convars.txt) | Build 2000918, September 25 tracker commit | Gap refers to the centre, size settings record authoring height, length 0–255, thickness 0–31, gap 0–128; outline now has three modes |
| [Valve's update notes](https://www.counter-strike.net/news/CS2?l=english) | September 23 statement, retrieved through indexed official text | New dimensions are pixels and rescale with display resolution; does not specify rounding or raster placement |
| [KZ static painter](https://github.com/KZGlobalTeam/cs2kz-metamod/blob/20e376c2b1647fb34a263e13445da00fc2ca02f7/src/kz/hud/layout/crosshair.cpp) | Existing pinned reconstruction | The historical truncation baseline, retained as a distinct source assumption |

The inspected renderer's SHA-256 is
`afd299f092e6e12bb005096cc4febc4dc83f76d6558af49529f423cf4a2fa2a9`.
The website script is mutable even with a version query. No third-party source
code was copied into the repository; the equations were implemented independently.
Returned codes, settings, warnings and dates are stored as factual observations
in `research/comparisons/`. The conversion endpoint is called only during this
audit. The shipped app still performs no external requests.

The sources are not interchangeable. Restore describes a pre-hotfix gap clamp
and says thickness zero was invisible despite the cvar's minimum-pixel wording.
The inspected later community renderer also hides zero thickness, but permits
overlap at small centre radii. We therefore do not clamp every negative *old*
gap: first convert it to the new centre radius, then clamp that radius to its
legal range. Nor do we infer native correctness from agreement between websites.

## Frozen comparison

Twelve diagnostic queries informed the reconstruction. After freezing the
formulas, twelve additional inputs were chosen and queried without refitting.
They cover 720–2160 heights, fractional and zero dimensions, negative gaps,
odd/even widths, a dot, large values, and a binary32 half-integer boundary.

| External tuple agreement | Diagnostic cases | Subsequent comparison holdout |
| --- | --- | --- |
| Historical authored/trunc/thickness model, current bounded search | 0 / 12 | 0 / 12 |
| Community static reconstruction | 12 / 12 | 12 / 12 |

These are software comparison cases, not independently sampled players or
native-game holdouts. The external service's returned code is decoded for
length, thickness, gap and authoring height; we do not implement new-code export.
The saved observations include the decoded tuple plus envelope, version and
checksum metadata. The field layout is documented in the converter's
[public decoder](https://crosshair.club/static/js/crosshair.js?v=1790553505).
The retained `research/generated/converter-comparison.json` records the offline
comparison of both frozen files.

The choice of old rounding matters beyond the selected examples: the two old
dimension formulas disagree on 276 of the existing 945 record-height rows.
Those rows contain duplicate settings and have no independent native truth
label. This is sensitivity, not an accuracy score.

## Equations and deliberate tradeoffs

At old height H, round binary32 `(H / 480) * value` to nearest with ties to even
for bar length and width, enforcing old width at least one. Retain signed
`trunc(f32(gap + 4))` for the old gap offset. This binary32 ordering is explicit:
at 1080, size `2.0000001` rounds to length 4, while thickness `2.0000003` rounds
to width 5. The later comparison query agreed with this distinction.

At equal heights and within ranges, new length and width copy those pixels;
new gap is `oldGapOffset + ceil(oldWidth / 2)`, clamped to 0–128. Export a
positive new thickness even when the old cvar was zero. New odd-width bars
have transverse start `-ceil(width / 2)` and far edge `gap - width % 2`.
Positive native dimensions rescale as `max(1, round(value * current / authored))`;
actual zero remains zero. See [chapter 12](../math/12-community-conversion.md).

The direct solver enumerates only three small axes (417 values), preserving
length and thickness before fitting centre radius. It deliberately does not
thicken a one-pixel bar to improve overlap with a one-pixel position shift.
Absolute preview overlap and the centring warning disclose that unavoidable
translation. No global visual optimum or native-match probability is claimed.

The UI exposes six choices: this default, the historical weighted hedge, and
four authored-height alternatives (truncation with thickness-relative gap, and
truncation/nearest/ceil with centre-relative gap). This is curation based on
interpretability and the authored-height evidence, not a claim of equivalence.
The full historical factorial stays in the research core and its hedge.

## Correctness repairs

- Historical visual refinement searches two cells along each integer axis;
  the 2160p `(size 1, thickness 2, gap -5)` case improves from IoU 0.7714 to at
  least 0.8 under that historical model.
- Screenshot reports no longer show the unrelated legacy target's preimage.
  Unsupported measured-pixel preimages are explicitly unavailable.
- Zero-preserving inverse certificates state their restricted thickness domain.
  Historical inverse APIs reject the separate community renderer.
- Screen-relative targets scale drawn edges and transverse origins, preserving
  odd/even placement instead of applying parity correction twice.
- Independent screenshot components can record either transverse origin.
  Evidence remains separated by build across model switches and exports.

## Learning experiment

The old learned artifact approximates a historical 27-model solver and cannot
be quoted as fidelity to the new default. A new recorded ablation distils
`solveCommunity` with the existing dependency-free boosted trees. The historical
feature map omitted authored height, so different legal answers could have
identical feature vectors. The improved map adds authored ratio, target
dimensions, radius and quantization residues derived from inputs only.

The 3,200 synthetic rows are split by entire size/thickness/gap triples:
59 train groups, 20 validation groups and 21 test groups. Heights, goals and
dot/T flags never cross groups. Two fixed capacities are selected using only
validation; both variants select depth 3, 24 rounds. Final models refit the
train and validation groups before evaluating the untouched test groups.

| Same 672 held-out rows | Exact tuple fidelity |
| --- | --- |
| Direct numeric assignment | 0% |
| Historical features, retrained on the new target | 29.17% |
| Geometry and authored-height features | 90.48% |
| Exact deterministic label generator | 100% by definition |

The improved model has zero rendered length/width MAE on this test set and
0.137 px near/far MAE. The effective test sample is 21 setting groups, not
672 independent observations. This limited grid is not an extrapolation or
game-accuracy guarantee. The retained artifact records its labels, split,
fingerprint and predictions. The learned model remains research-only: it still
loses information versus a small exact solver.

## Remaining evidence needed

Capture original old/new game images with exact builds and heights, including
ties, literal zero, odd widths, negative overlap and a resolution change after
authoring. Reserve capture groups before fitting. Until then, colours,
outline coverage, dynamic styles and native pixel identity remain unverified.
