# 13 — What decides the export: math, rules and ML

**Short answer.** No machine-learned model decides any exported value. Every
number in the exported console line comes from closed-form arithmetic, an exact
finite search and deterministic rules. Learned and
fitted models play three other roles:

- **A per-input check.** The export-state learner v2 predicts the whole export for the input on screen and the converter reports whether it agrees. It never replaces or adjusts the export. It shares the rendering models and the refinement rule with the converter, so agreement is partly by construction.
- **Research evidence.** Emulators measured whether the solver can be learned and how stable it is, and their errors pointed at regimes worth a look, such as cross-height ties.
- **A rejected fit.** A least-squares alpha for `cl_crosshairusealpha 0` was computed and rejected because it depends on the error measure; the export uses 255 by user decision.

Model: `community-static-v7` (model id `community-static-2026-10`, build
2000922, release 0.13.0). Every learned score in this chapter is agreement with
our own converter on inputs we designed, labelled by our own solver. The
repository holds no native capture of build 2000922 that could score any of it
against the game.

## 1. The pipeline, step by step

The automatic converter turns old settings into a new console line in seven
steps. Steps 1 to 6 decide the export; step 7 only reports on it.

1. **Old settings to old pixels** (closed form, `communityLegacy` in `lib/geometry/community.js`). Binary32 arithmetic with ties to even reconstructs the old bar length, width and near edge at the old height (source ledger S01). The old outline extent comes from `legacyOutlineExtent` (capped at 3 px) and the old elements are painted in the old draw order: each outline, then its fill.
2. **v6 appearance rules** (deterministic, `lib/geometry/edge-cases.js`, `lib/solver/community-edge.js`). Crossed arms are folded into the same pixels with a non-negative gap; an outline-only size 0 becomes a black core; a size-0 dot becomes short arms inside the dot square; zero-length bars draw nothing in the new game. The expert switch "Automatic appearance corrections" off skips the fold, the outline-only and dot-only rules and step 5.
3. **Dimension-first inverse** (closed form plus an exact finite search, `lib/solver/community-axis.js`, `lib/solver/community-search.js`). Length and thickness are fitted first, then the centre radius (the new gap). At equal heights it reduces to the formulas below; otherwise monotone per-axis binary searches find every minimum-error value ([chapter 12](12-community-conversion.md)).
4. **Tie-break** (rule, `lib/solver/alignment.js`). When at most eight shapes are equally accurate, the one with the best overlap after a whole-shape shift of at most 1 px wins, then plain overlap, then a fixed canonical order. Ties only occur at cross heights.
5. **Appearance refinement window** (bounded exact search, `lib/solver/community-refine.js`). Only at the pixel goal, only when the old outline draws at most 1 px a side, and only when the shape check of the step-4 choice is not already exact, shifted or empty. Every tuple within 3 drawn pixels of length, 3 of thickness and 4 of the gap edge (at equal heights: ±3, ±3, ±4 native steps) is scored; a neighbour wins only by a strictly higher aligned colour overlap. If a v6 rule or the window changed the export, the plain conversion replaces it when its aligned overlap is strictly higher (`corrections-fallback`).
6. **Export line** (rules, `nativeCommands` in `lib/settings/native.js`, `exportQuantCFG` in `lib/solver/export.js`). Cvars, not share codes; the outline alpha is the old crosshair opacity; `cl_crosshairusealpha 0` exports fill alpha 255 and outline alpha 200; `report.exportOverrides` carries the black colour of an outline-only core. One comment-free line joined by `;`.
7. **Checks after the export.** The shape check (`shapeCheck`, closed form, `lib/geometry/appearance.js`) compares the old core and outline with the new ones by colour and reports exact, shifted, approximate or empty. The ML cross-check compares the learner's prediction with the export. Neither changes the export.

The closed-form core of steps 1 and 3 at equal heights, before native limits:

```text
s = f32(oldHeight / 480)
L = roundEven(f32(s * f32(size)))
W = max(1, roundEven(f32(s * f32(thickness))))
d = trunc(f32(f32(gap) + 4))

length    = clamp(L, 0, 255)
thickness = clamp(W, 1, 32)
gap       = clamp(d + ceil(W / 2), 0, 128)
```

At other heights a native value v draws `max(1, round(v * r))` pixels for
`r = currentHeight / authoredHeight` (zero stays zero), and the search inverts
that rule axis by axis.

## 2. The parts that decide the export

None of these is learned. "Decides" means the component can change an exported
value.

| Component | Kind | Input → output | Decides? | Basis | Why it is in the path |
| --- | --- | --- | --- | --- | --- |
| Legacy arithmetic (`communityLegacy`) | Closed form | old size, thickness, gap, height → old length, width, near edge | Yes | Source-derived (ledger S01); binary32 cases pinned by regression tests | The same old arithmetic as JDD310 and crosshairrestore. Exports agree with both on 909 of 945 corpus rows; the 36 others (for example pro-006 and pro-034 with crossed arms, Jame's size-0 dot) differ by the v6 rules (`crossTool` in `research/generated/converter-comparison.json`) |
| v6 appearance rules | Rule | old shape → drawable target, export overrides | Yes | Issue #11 captures and a user statement; issue #15 | The old game drew shapes (crossed arms, outline-only `#`, size-0 dot) that no literal new tuple draws |
| Old draw order, usealpha, outline cap, weapon gap | Rule | old settings → old appearance, export alphas | Yes | Leaked old renderer (S14 to S18), capture C | Old previews and the shape check must show what the old game drew |
| Dimension-first inverse | Closed form and exact search | target pixels → length, thickness, gap | Yes | Declared reconstruction | Keeps bar dimensions before the centre radius and discloses the 1 px odd-width shift instead of widening bars |
| Tie-break | Rule | up to 8 tied tuples → one | Yes, cross heights only | Tie audit and learner disagreement audit (finding F1) | 74 of 1,755 corpus rows changed (48 records), all at cross heights; no equal-height export changed |
| Refinement window | Bounded exact search | chosen tuple and shape check → a neighbour or the same tuple | Yes, in scope only | Independent geometry audit of 118,552 cases | 3,211 audit exports changed, all better on the audit's measure, none worse; in the corpus only Jame (pro-049) changed |
| Shape check | Closed-form comparison | old and new pixels → exact, shifted, approximate or empty | No: it is the window's score and a displayed status | Declared models | Corpus at 768/1080/1440/2160: 274 exact, 249 shifted, 28 approximate, 1 empty of 552 rows (`research/generated/edge-case-audit.json`) |

## 3. Learned and fitted components

All labels below are synthetic: designed inputs, labelled by our own solver
(`infer()` or `solveCommunity`). Corpus rows are published player settings
labelled the same way, not captures. Brackets are group-resampling stability
intervals, not confidence about the game. Split names:

- **fresh**: inputs drawn and hashed before the first fit and scored only after training;
- **edge challenge**: a fresh set restricted to edge regimes (crossed arms, size 0, zero length, weapon gap);
- **regression (already seen)**: splits whose labels earlier work had already looked at; they show nothing new, only that a rerun did not break.

| Component | Kind | Input → output | Decides? | Labels | Key held-out numbers | Outcome and why |
| --- | --- | --- | --- | --- | --- | --- |
| Export-state learner v2 (per-input ML cross-check) | Learned: boosted-tree ranker (64 rounds, depth 5) over its own at most 8 candidates, plus four heads (12 rounds, depth 2) | settings and scope → whole export (length, thickness, gap, outline mode and alpha, colour, fill alpha, T) | No: check only | `infer()` v7 on 640 synthetic development groups | Fresh 99.38% [99.08–99.63] (5,632 rows, 128 groups); edge challenge 99.49% [99.12–99.77] (3,520 rows, 80 groups); rule baseline 65.94% and 50.91%. Regression: export-state learner v1 test 3,784 rows 99.68%, challenge 1,920 rows 98.23%, corpus 945 rows 100%, corpus cross-height 810 rows 99.51%, presets 56 rows 100% | Shipped as a second opinion. Never calls the solver, but re-derives its regime transforms and the appearance window, so agreement is partly by construction |
| Export-state learner v1 | Learned: ranker (48 rounds, depth 4) on the solver's candidates, appearance head (24 rounds, depth 3) | settings and scope → length, thickness, gap, outline mode, outline alpha | No: research only | `infer()` v7, 400 synthetic groups | Regression: test 76.69% [71.25–81.87] (3,784 rows), challenge 71.51% (1,920), corpus 99.26%, corpus cross-height 85.56% | Showed that trees cannot learn the exact 0 and 1 outline thresholds, so `outlineMode` stays closed form. Its candidates come from the code under check, and 3004 training labels of the window and the plain-conversion fallback fall outside them (`labelMisses`). It dropped on v7 because its fixed candidate set (at most 8 solver candidates) cannot reach the exports that the v7 shape-derived window (ADR-0019) now chooses, which also raised its training-label misses to 3,004 |
| Structured ranker | Learned ranker over at most 8 legal candidates | settings and scope → length, thickness, gap | No: research only | `solveCommunity` v7, 320 + 80 synthetic groups | Regression: test 98.17% [97.33–98.92] (2,400 rows, 60 groups); interior 90.08%, exterior 94.22% (1,280 rows each). On the v2 fresh set: 77.04% | Was the single global "ML cross-check" number before the per-input cross-check. Not usable as a per-input check: its candidates come from `lib/solver/community-axis.js`, the code it would check |
| Accuracy emulator (residual, quantized, regime and scale-free regime variants) | Learned: boosted corrections to a rounded analytic guess | settings and scope → length, thickness, gap | No: research only | `solveCommunity` v7, 320 + 80 synthetic groups | Regression, test (2,360 rows, 59 groups): residual 93.94%, quantized 96.27%, regime 97.75% [96.69–98.73], scale-free regime 97.50%. Interior: 65.00%, 78.91%, 77.58%, 80.70%. Exterior: 53.91%, 76.80%, 71.88%, 74.30%. Fresh (v2 set): regime 70.05%, quantized 57.23% | Measures how learnable the solver is from input features alone. The regime variant overfits the training heights; its scale-free revision (2026-10-03, chosen on validation) narrows but does not close the gap on the shifted challenges. No variant is close enough to stand in for the solver |
| Community emulator v2 (frozen) | Learned residual | settings → tuple of the old `community-static-v2` (build 2000918) | No: historical | `solveCommunity` v2, 100 groups | Test 93.90% [91.07–96.43] (672 rows, 21 groups) against analytic 80.21%; challenge 72.66% against analytic 80.12% (1,152 rows, 96 groups) | Worse than the analytic guess under a shift; kept byte-identical as history |
| Quant emulator v1, learned shortlist, sensitivity classifier ([chapter 10](10-learned-emulator.md)) | Learned (boosted trees) | settings → tuple of the historical 27-model solver | No: historical research | `infer()` of the historical solver, 607 settings | Exact tuple 35.68% against naive 3.57% (1,009 rows); shortlist of 32 contains the solver tuple in 84.8% and loses on 13 of 125; classifier 0.736 against a 0.704 majority baseline | Speed gate closed: a fast path that is wrong on most tuples cannot replace the exact solver |
| Residual modulator | Would be learned (±2 px correction) | solver tuple → bounded correction | No: closed | Native capture pairs only, never solver labels | 0 reviewed native pairs (needs at least 40); weights null (`research/generated/quant-modulator.json`) | Returns a zero delta until reviewed captures exist |
| Model partition | Analytic sampling tool, not learned | 27 historical models → behaviour groups | No: research only | None | 27 of 27 models behave differently on 34,560 sampled tuples (`research/generated/model-partition.json`) | Shows the historical hypotheses cannot be merged; says nothing about which one the game uses |
| Least-squares usealpha alpha | Fitted: closed-form least squares | old additive colour → normal-blend alpha | No: rejected | Declared blend models over 256 neutral grey backgrounds, not a capture | Default green: RGB error 133, luminance error 232; red: 133 and 4; 45 of 216 grid colours get 0 (`research/generated/additive-alpha.json`) | The answer depends on the error measure and makes dark colours invisible. 255 by user decision (2026-10-03), as the additive fill never dimmed the background and all five other converters export 255 |

Learner numbers are from `research/generated/crosscheck-emulator.json`,
`export-emulator.json`, `structured-emulator.json`, `accuracy-emulator.json`,
`community-emulator.json`, `quant-emulator.json` and `ranker-benchmark.json`;
the shipped rate is also in `data/quant-summary.json` (`evidence.mlCrossCheck`).
`accuracy-emulator.json` is a research artifact that is not published because of
its size; its headline numbers are quoted here and in the learner note.
The [learner note](../research/learners-2026-10-02.md) has the full designs and
earlier values.

## 4. Where an ML finding changed code, and where it did not

- **Cross-height ties → tie-break.** The export learner's disagreement audit flagged ties where the learner's choice matched the old shape better once the odd-width shift was removed. A research tie audit found the same cluster (468 of 2,108 tied synthetic cases, 74 of 222 tied corpus rows). The fix is a rule, not a model.
- **Outline thresholds → stays closed form.** Export v1 failed exactly at outline widths just above 0 and just below 1 (all 384 challenge rows with an outline error in its first evaluation, on v4 labels), because a tree threshold falls between training values. `outlineMode` stayed analytic ([learner note, section 3](../research/learners-2026-10-02.md#3-metrics-before-and-after)).
- **Regime diagnosis → regime features in the learners.** Scoring the v6 learners by regime showed the size-0 dot as the largest block of errors (36% of the accuracy emulator's test errors) and the outline-only `#` as invisible to the v1 appearance head. This changed the learners (regime features in `lib/solver/ml-crosscheck.js` and the v2 learner), not the solver: the size-0 dot rule already existed.
- **Window labels outside the candidates → the cross-check re-derives the window.** After the appearance window and its amendment some labels lie outside a ranker's candidate set (3,004 `labelMisses` in export v1 after v7). The v2 learner therefore applies its own copy of the window after its pick and trains on "the window of this candidate is the label" (0 misses). This is the main reason its agreement is partly by construction.
- **Not from ML.** The v6 appearance rules came from issues #11 and #15 and their captures; the refinement window came from an independent brute-force geometry audit; the old draw order, the outline cap and the weapon gap came from the converter survey and the leaked old renderer.

## 5. Worked examples at 1080

Each example uses old style 4, white at opacity 230, outline off, recoil off,
1080 → 1080 at the pixel goal, unless stated. The numbers come from running
`infer()`, `exportQuantCFG()` and `crossCheck()` on the current tree.

| Example | Old pixels | Rules and steps that acted | Export (length / thickness / gap and extras) | Shape check | ML cross-check |
| --- | --- | --- | --- | --- | --- |
| Issue #15: size 2, thickness 1, gap -11.5, dot | length 4, width 2, near edge -6 (arms cross the centre) | Fold (crossed full); inverse with one candidate; window not needed | 4 / 2 / 2, dot 1 | Exact (IoU 1) | Agrees (4/2/2) |
| Issue #15 as pasted: only size, gap and dot (game defaults fill the rest) | length 4, width 1, near edge -7 | Defaults note; weapon gap dropped; style 2 read at rest; fold | 4 / 1 / 3, dot 1, outline 1 at 200, green 0 255 0 at 200, recoil 1 | Shifted (aligned IoU 1, raw 0.185: the 1 px odd-width shift) | Agrees (4/1/3) |
| Issue #11: size 0, thickness 3.4, gap -5, outline 0.01 | length 0, width 8, near edge 3; only the outline strokes showed | Outline-only as core; inverse | 1 / 9 / 3, drawoutline 0, colour 0 0 0 at 230 | Exact | Agrees (1/9/3, black, drawoutline 0) |
| Size-0 dot: size 0, thickness 1, gap 0, dot | length 0, width 2 (only the dot showed) | Dot as arms (length ceil(W/2) = 1, gap 0) | 1 / 2 / 0, dot 1 | Exact | Agrees (1/2/0) |
| Inverted T: size 2, thickness 1, gap -20, T | length 4, width 2, near edge -15; the single vertical arm crossed above the centre | Fold; T kept (user decision); window ran and found nothing strictly better | 4 / 2 / 11, T 1, warning `inverted-t-unrepresentable` | Approximate (aligned IoU 0.5) | Agrees (4/2/11, T 1) |
| Refinement (appearance-window case D1): size 1, thickness 2, gap -4, dot, outline 1 | length 2, width 4, near edge 2 | Inverse gives 2/4/2 (aligned IoU 0.81); window moves to a neighbour | 1 / 4 / 3, dot 1, outline 1 at 230 | Exact | Agrees (1/4/3) |

What the examples show:

- **Issue #15.** With the corrections switch off the same input exports 4/2/0, the v5 behaviour: a solid plus, shape check approximate at IoU 0.45, warning `negative-gap-static-unverified`, and the ML row reads "Not checked: corrections off". The fold is what keeps the one-pixel hole on each side of the dot.
- **Issue #15 as pasted.** The paste sets only three cvars, so the old game's defaults (thickness 0.6, style 2, outline 1 at width 1, green 0/255/0 at alpha 200, recoil 1, weapon gap 1) fill the rest with a visible `defaults-filled` warning. Thickness 0.6 draws 1 px, so the export is 4/1/3 and the cross sits 1 px off (shifted).
- **Issue #11.** The black colour and drawoutline 0 come from `report.exportOverrides`, a rule. The learner's heads predict them independently, and here they match.
- **Size-0 dot.** With corrections off the export is 0/2/5 with the dot on. That relies on the new game drawing a dot at length 0, which no capture shows; the corrected 1/2/0 draws the same pixels whether or not it does.
- **Inverted T.** A T whose stem crossed the centre cannot be drawn in the new game. The export keeps T because the user chose T; the new arm points down instead of up, and the warning says so.
- **Refinement.** The dot outline overpainted the short old arms. The window finds 1/4/3, which draws the old pixels exactly. The learner predicts 1/4/3 too, but it applies the same window rule, so this agreement is by construction rather than independent confirmation.

## 6. What we don't know (needs captures)

The export is a deterministic answer under declared models. These model
assumptions have no capture of build 2000922 yet:

- **Dot at length 0.** The zero-length rule rests on one user statement; a decompile note says the dot draws regardless. The dot-only export avoids depending on it.
- **Odd-width gap origin.** ceil(W/2) (ours, JDD310) against floor(W/2) (cursed): it changes 382 of 945 corpus rows and 46 of 135 published crosshairs at 1080 ([learner note, section 6](../research/learners-2026-10-02.md#6-gap-origin-sensitivity)).
- **Gap scaling and rounding at other heights.** The `max(1, round(v * r))` rule and the centre-radius gap are a carry-over from build 2000918, unverified on 2000922 away from 1080.
- **Negative static gap.** What the new static style draws for a console-only negative gap (capture case `s1-t2-gm2`).
- **Full outline width.** Mode 1 is assumed to draw 1 px all round; no capture shows it, and old outlines wider than 1 px cannot be reproduced.
- **Thickness 0.** The new `cl_crosshair_thickness 0` is predicted to hide the bars; the converter never exports it, and no capture confirms it.

The [capture protocol](../research/capture-protocol-2026-10-02.md) lists the
console lines and predicted masks for these cases.
