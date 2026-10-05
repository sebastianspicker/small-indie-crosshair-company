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
