# Oracle sweeps and the v7 retrain, 2026-10-05

Measurement of the automatic converter (`community-static-v7`,
[ADR-0018](../engineering/decisions/0018-legacy-style-5-rest-gap.md),
[ADR-0019](../engineering/decisions/0019-shape-derived-window.md)) against a
brute-force oracle on random old crosshairs, before and after the changes of
2026-10-05, plus the retraining of the ML cross-check
([ADR-0016](../engineering/decisions/0016-per-input-ml-cross-check.md)).

Everything here is computed under the declared models (the old renderer
reconstruction and the new-renderer equations). It is a software comparison:
it says whether the converter finds the best tuple *by its own measure*, not
whether that measure matches the game. No capture was taken.

## 1. Method

Script: [`research/scripts/oracle-sweep.mjs`](../../research/scripts/oracle-sweep.mjs)
(not part of `research:quant`; run by hand).

1. Draw a random old crosshair from a grid (below), at old height 1080, style
   4, alpha 255, white or (10 %) black, and convert it with the automatic
   model (`infer`, `selectedModelId: COMMUNITY_MODEL.id`).
2. Score the export exactly as the converter's own shape check does:
   `appearanceScorer(oldAppearance)` applied to `exportedAppearance` (old core
   and outline in the old draw order, by colour, against the new core and
   outline as exported; best over whole-shape shifts of at most 1 px: the
   "aligned IoU").
3. Score every native tuple in a bounded box with the same flags, colour and
   outline mode as the export: length 0 … 2L+8, thickness 1 … 2W+6 (or +8),
   gap 0 … 24 (plain) or 0 … |a|+W+10 (exotic), capped at 60/32/60.
4. A **shortfall** is an export that some tuple in the box beats on aligned
   IoU (ties on raw IoU). Each input is also labelled with its shape family
   (the ADR-0019 taxonomy, from the old geometry alone).

Two grids:

| Grid | Inputs | Sizes | Thickness | Gaps | Outlines | Dot / T |
|---|---|---|---|---|---|---|
| plain (seed 101) | 5,000 | 0 … 8 | 0 … 4 | −14 … 5 | off, rounded 0, 0.5, 1 | 40 % / 20 % |
| exotic (seed 202) | 2,000 | 0 … 20 | 0 … 10 (W up to 22 px) | −40 … 10 | off, rounded 0, 0.5, 1, 2, 3 | 50 % / 30 % |

The oracle fixes the T flag to the export's (so an ADR-0019 T flip is scored
as exported), and its box is finite: a tuple outside it is not seen.
Different seeds (7, 11) gave the same picture on 1,500-input runs.

## 2. Results

| Run | Shortfalls | Exact or shifted | Mean aligned IoU |
|---|---|---|---|
| plain 5,000, converter of 2026-10-04 (v6) | 106 (2.1 %) | 3,630 | 0.930 |
| plain 5,000, v7 | **0** | 3,637 | 0.939 |
| exotic 2,000, v7 before the wide-outline rule | 624 (31 %) | 991 | 0.804 |
| exotic 2,000, v7 final | **18** (0.9 %) | 1,049 | 0.857 |

Row by row (same seed, same inputs), no export scored lower after the changes:
plain 261 better, 0 worse; exotic 628 better, 0 worse.

Both final rows were re-run on the rebuilt checkout later the same day (the
working copy was lost and restored from snapshots and transcripts): plain
5,000 again 0 shortfalls, 3,637 exact or shifted, mean 0.939; exotic 2,000
again 18 shortfalls, 1,049 exact or shifted, mean 0.857, the same 18 rows.

### 2.1 Where the v6 converter fell short (plain, 106)

| Family | Rows | Shortfalls | Cause, fix |
|---|---|---|---|
| size 0, dot, outline (boxed dot in `#` strokes) | 274 | 79 | The old strokes lay 5 … 14 gap steps from the dimension-first choice, outside the ±4 window. ADR-0019: the gap window reaches the old shape's own edges and the dot's outline edge. |
| crossed T (partial or full), outline | 101 | 19 | The stem of an old crossed T sits above the centre; keeping T drew it below. ADR-0019: a full cross is exported when it draws the old pixels better (`t-flipped-for-shape`). |
| crossed partial, outline, dot | 152 | 4 | The exact tuple keeps the arms apart where the old dot outline cut them; it needed the gap to move 6 and the length to follow. ADR-0019: outer-edge length window. |
| regular, outline, dot | 745 | 1 | Same mechanism (size 8, thickness 2.5, gap −7: 18/6/0 at 0.96 → 14/6/4 exact). |
| crossed T, no outline | 44 | 2 | T flip. |

### 2.2 The exotic grid

Before the last rule every one of the 624 shortfalls had an old outline of
1.5 px or more a side: ADR-0017 had switched the window off for them, so those
exports were the plain dimension-first guess. With the window on for every
outline width (the score is colour-aware, so a coloured core widens only
when that matches more old pixels), 606 of them are resolved; black cores
with a wide outline become exact (the silhouette is the look), coloured ones
gain 5 … 20 points.

The 18 left (mean gain 0.05, max 0.26):

- 12 old outlines of 3 px where the only better tuple doubles the coloured
  bar width into the old black band (e.g. size 5 / 4 / −12, outline 3:
  10/11/0 at 0.46 vs 4/18/1 at 0.49). Accepted: the gain is marginal and the
  trade is not one a player would call the same crosshair.
- 3 size-0 dots with gap −40, whose strokes lie beyond the 32 px reach cap
  (the cap bounds the search cost).
- 3 wide-outline crossings with gains below 0.07.

The bar-width window is capped at ±8 (`REFINE_THICKNESS_REACH_MAX`) because
the uncapped window made a worst-case inference take 316 ms and the
cross-check retrain hours; re-running the exotic grid with the cap changed
no export (same 18 shortfalls, same mean).

### 2.3 Per family, final

Plain grid, v7 (rows / exact-or-shifted; shortfalls are 0 everywhere):
regular 394/394, regular+outline 1,051/731, regular+outline+dot 745/611,
regular+outline+T 267/188, size-0 outline-only 431/406, size-0 dot+outline
274/80, crossed partial+outline 240/28, crossed full+outline 155/100, crossed
T variants 181/24, touching and thick families all exact.

Approximate rows that remain are the unrepresentable ones the warnings name:
overpaint seams of the old draw order (`outline-overpaint-lost`), old outlines
wider than the new 1 px (`outline-width-reduced`), the size-0 dot with
strokes that no 1 px outline draws (`zero-length-outline-dropped`), and the
odd-width centring shift (`pixel-centering-shift`, counted as shifted).

## 3. Taxonomy check

An independent agent ported the leaked old renderer (lines 405-440 and
2025-2214 of `weapon_csbase.cpp`) and matched `oldAppearance(communityLegacy)`
pixel for pixel on 483,840 cases. It added three families to ADR-0019
(overpaint without crossing: the d = 0 seam, the hollow centre at d < 0 with
a ≥ 0, and a dot outline that swallows short arms), corrected three
boundaries, and found the 13-bit share-code size field
(`lib/settings/sharecode.js`). The overpaint families are unrepresentable in
the new game (all outlines lie beneath all fills) and stay approximate with
`outline-overpaint-lost`; the sweep confirms no better tuple exists for them.

## 4. ML cross-check retrain

The cross-check learner imitates the converter, so it is retrained whenever
the solver changes (ADR-0016). `lib/solver/ml-crosscheck.js` re-derives the
ADR-0019 window (reach, outer-edge lengths, thickness reach, T flip, every
outline width) from geometry helpers; on 600 random inputs with T and dot
flags it agreed with the solver on every export, 51 of them T flips. The
feature file changed, so the trainer was re-run with `--refreeze`, which
records the deliberate change in `training.freeze` of
`research/generated/crosscheck-emulator.json`.

Numbers (whole-export agreement, fresh rows never used for selection):

| | v6 (shipped 2026-10-04) | v7 |
|---|---|---|
| Fresh set | 98.99 % (98.56–99.36), 5,632 rows, 128 groups | 99.38 % (99.08–99.63), 5,632 rows, 128 groups |
| Edge challenge | 98.61 % (97.87–99.23), 80 groups | 99.49 % (99.12–99.77), 3,520 rows, 80 groups |
| Rule baseline | 80.7 % fresh / 71.5 % edge | 65.94 % fresh / 50.91 % edge |

The v7 figures are pinned to the artifact by
`tests/tooling/published-numbers.test.mjs` and quoted on the research page.

## 5. Limits

- The oracle measures the converter's own objective. Whether that objective
  is the game's pixels rests on the captures listed in the
  [capture protocol](capture-protocol-2026-10-02.md); the odd-width centring
  of the new renderer and the style-5 gap have none yet.
- The brute-force box is finite and the sweeps are at 1080 only; screen
  goals and other heights were not swept.
- The ML cross-check agrees with the converter partly by construction (it
  shares the rendering models and the window rule); its rate is not game
  accuracy.

## 2026-10-06: v8 (T-shape taxonomy) and other heights

`community-static-v8` (ADR-0020) re-run with the same seeds. The sweep now also records, for T inputs, the best tuple
with the opposite T flag (`otherT`) and counts per T family where it beats the export (`tFamilies`). `--height` runs a
sweep at another equal old/new height.

| Height | Plain: shortfalls / exact or shifted / mean | Exotic: shortfalls / exact or shifted / mean | Other T flag better |
|---|---|---|---|
| 1080 (n 5,000 / 2,000) | 0 / 3,637 / 0.939 | 18 / 1,049 / 0.858 | upright 5, strokes 1 |
| 900 (n 2,000 / 1,000) | 0 / 1,475 / 0.939 | 10 / 530 / 0.854 | upright 4 |
| 960 (n 2,000 / 1,000) | 0 / 1,472 / 0.939 | 10 / 528 / 0.854 | upright 4 |
| 1440 (n 2,000 / 1,000) | 0 / 1,449 / 0.944 | 6 / 524 / 0.865 | upright 4 |

The 1080 headline numbers equal v7. Every exotic shortfall and every upright row where the other flag wins has a 2 or
3 px old outline, which the 1 px new outline cannot draw. A first v8 draft filed size 0 with a dot and an outline as
`no-effect`; the opposite-flag check found the other flag better in 9 plain and 11 exotic such rows (they draw outline
strokes, and T drops the top one), so they are `strokes` now. Declared-model pixels only; not native evidence.

## 2026-10-06: v10 screen refinement

The oracle accepts `--old-height`, `--current-height`, `--authored-height` and
`--goal pixels|screen`. `--height` still sets equal source/current heights,
with authored height defaulting to current. Each result records the actual
heights, finite native bounds, refinement evaluations and inference timings.
The native box is scaled from drawn-pixel bounds and capped at 60 length/gap
steps and 32 thickness steps; it is not a global certificate.

Two diagnostic screen runs, 12 settings each, found no bounded shortfalls:
plain seed 301 at 1080→900 authored 1080, and exotic seed 302 at 720→1440
authored 960. They are small synthetic checks, not population accuracy rates.
The 400-case frozen v9 comparison and independent dense-grid tests provide
broader regression coverage (see ADR-0024); native capture validation remains
pending. Screen refinement uses more candidate evaluations than v9's skipped
window and can be slower for exotic shapes, while retaining the same caps.
On 50 frozen screen cases, a local run measured median 15.7 ms, p95 119.1 ms
and maximum 216.0 ms, with 55,213 refinement evaluations in total. Concurrent
artifact checks were running; these timings are diagnostic rather than a
performance guarantee.

## 2026-10-07: cross-resolution sweeps of v10

Nine bounded sweeps at unequal heights, run by hand with the extended oracle
(`research/scripts/oracle-sweep.mjs`; outputs kept outside the repository in
`_notes/sicc-v10-sweeps-2026-10-07/`). Screen goals set the authored height to
the current height unless stated; the two pixel-goal runs change only the
authored height, so the native ratio is 1.5 and 0.75. Same grids and bounds as
above. Declared-model pixels only; not native evidence.

| Run | Grid, n, seed | Old → current, authored, goal | Shortfalls | Exact or shifted | Mean aligned IoU | Inference ms mean / max |
|---|---|---|---|---|---|---|
| A | plain, 800, 401 | 1080 → 1440, 1440, screen | 1 | 344 | 0.910 | 25.7 / 323 |
| B | plain, 800, 402 | 1440 → 1080, 1080, screen | 0 | 291 | 0.882 | 13.0 / 187 |
| C | plain, 800, 403 | 720 → 1080, 1080, screen | 0 | 442 | 0.907 | 15.8 / 253 |
| D | plain, 800, 404 | 1080 → 720, 720, screen | 0 | 320 | 0.869 | 9.5 / 83 |
| E | exotic, 400, 405 | 1080 → 1440, 1080, screen | 3 | 74 | 0.802 | 61.8 / 706 |
| F | exotic, 400, 406 | 1440 → 1080, 1440, screen | 1 | 110 | 0.837 | 41.2 / 420 |
| G | plain, 800, 407 | 1080 → 1080, 720, pixels | 1 (+5 policy) | 159 | 0.684 | 16.0 / 130 |
| H | plain, 800, 408 | 900 → 1200, 1200, screen | 0 | 381 | 0.902 | 26.4 / 272 |
| I | plain, 800, 409 | 1080 → 1080, 1440, pixels | 0 | 616 | 0.943 | 4.1 / 79 |

Timings were taken with three sweeps running at once and are diagnostics.

### Findings

- **Search completeness holds across heights.** The eleven shortfalls in
  7,200 inputs are all in the classes accepted at 1080 (section 2.2): one
  size-0 dot at gap −40 whose strokes lie beyond the 32 px reach cap (E), five
  wide-outline or thick-short rows where the only better tuple widens the bars
  into the black band or changes the character of the crosshair (A, E ×2, F,
  gains 0.03 to 0.06), and one role swap at ratio 1.5 (G: size 2.5, thickness
  2, gap −5.5, outline 1; the export 3/3/1 scores 0.607, while 1/9/0 draws the
  old 4 px bars with the 3 px hole filled at 0.897, because no native
  thickness draws 4 px at that ratio). The role swap is outside the ±8
  thickness reach and is not pursued: the tuple is a different crosshair in
  native terms, and the case needs an authored height below the screen.
- **Policy-excluded tuples are counted apart.** At ratio 1.5 five rows (all
  crossed-partial size-1 shapes with a dot) would score higher with length 0,
  which draws only the dot under the model. The converter never exports
  length 0 once the old shape drew arms or a dot, because the current game
  may draw nothing for it (issue #11, `dot-only-as-arms`). The oracle now
  applies the same rule (`policy`, `policyExcluded` in its output), so these
  rows are not shortfalls of the search.
- **T shapes.** With the other T flag tried on every T row (1,069 rows across
  the nine runs, all seven families), the opposite flag beats the export only
  in the policy rows above and one upright T at ratio 1.5 by 0.0005.
- **Lower means at unequal heights are representability, not search.**
  Downscaling (B, D) and ratio 1.5 (G) round old edges apart; at ratio 1.5 the
  drawn sizes 1, 4 and 7 are unreachable. The bounded oracle finds no better
  tuple for those rows, so the loss is in what the new renderer can draw at
  that height, under the declared models.

### Limits

- The boxes stay finite (60/32/60 native steps) and the grids are random
  samples; a tuple outside the box is not seen.
- Everything is measured by the converter's own objective. Whether the scaled
  old appearance is what the game shows at the new height rests on captures
  the measurement registry does not yet hold.
