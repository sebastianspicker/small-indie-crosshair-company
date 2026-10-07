# Learned emulators and the ML cross-check

::: summary
The project trained small machine-learning models to imitate its own converter.
One question was whether a fast learned shortcut could replace the exact search:
it cannot, because it gets too many answers wrong. The other use is a second
opinion. A separately built learner predicts the whole export for the input on
screen, and the page says whether it agrees. It learned from our converter, so
agreement means two implementations of our method agree, not that the game
agrees, and it never changes what is exported.
:::

::: key
The ML cross-check reproduces the whole export on
{{fig:summary.learners.crosscheck.reusedHoldout.learner.exactRate|pct}} of
{{fig:summary.learners.crosscheck.reusedHoldout.rows|int}} reserved synthetic
rows (learner trained for
`{{fig:summary.learners.crosscheck.targetVersion|version}}`); a rule baseline
reaches {{fig:summary.learners.crosscheck.reusedHoldout.ruleBaseline|pct}}.
:::

::: technical
## Question

Can a learned model stand in for the exact solver, and can one serve as an
independent per-input check of the export? Learned code reaches the app only
through an ADR (ADR-0001, ADR-0007); the only one that does is the cross-check
(ADR-0016).

## Model

### Common protocol

Every label below comes from our own solver (`infer()` or `solveCommunity`) on
inputs we designed; corpus rows are published settings labelled the same way.
Splits are by setting group, never by row, so every conversion of one old
setting falls on one side. Capacity is chosen on a validation fold carved from
training groups. Brackets are group-resampling stability intervals. Split names:

- **fresh** (shown as *reused holdout*): groups drawn and hashed before the
  first fit. Releases since 0.12.0 have scored them again, so for the current
  version they are regression evidence, not new independent validation;
- **edge challenge**: a reserved set restricted to crossed arms, size 0, zero
  length and weapon gap;
- **regression**: splits whose labels earlier work had already seen.

### The historical quant emulator

`quant-emulator-v1` (`research/generated/quant-emulator.json`, snapshot
{{fig:generated.quant-emulator.snapshot|date}}) maps an old setting and target
to the tuple of the historical 27-model solver: boosted trees of depth
{{fig:generated.quant-emulator.maxDepth|int}},
{{fig:generated.quant-emulator.rounds|int}} rounds, learning rate
{{fig:generated.quant-emulator.learningRate|text}}, over 26 declared features.
It trained on {{fig:generated.quant-emulator.training.trainSamples|int}} samples
and was tested on {{fig:generated.quant-emulator.training.testSamples|int}}
samples of {{fig:generated.quant-emulator.training.settings|int}} settings, split
by `hash(signature(settings)) % 5 === 0`. Seven added features (fractional
residues, boundary distances, width parity) were neutral to slightly negative
at matched capacity; the gain over an earlier stump model came from depth. A
forward block learned the declared `forward()` renderer, offline only: on
{{fig:generated.quant-emulator.forward.metrics.count|int}} held-out samples its
mean absolute errors are {{fig:generated.quant-emulator.forward.metrics.lengthMae|d3}}
px (length), {{fig:generated.quant-emulator.forward.metrics.widthMae|d3}} px
(width) and {{fig:generated.quant-emulator.forward.metrics.nearMae|d3}} px (near
and far edges).

A learned shortlist with exact verification (`ranker-benchmark.json`) returns
the exact minimum of the declared loss over the shortlist's $K$ tuples, so it is
never worse than the best shortlisted tuple, but can be worse than the solver.
An analytic advisory measures each coordinate's distance to the nearest
quantizer boundary; a learned fragility classifier predicts whether the
emulator misses.

### Learners of the community converter

- **Community emulator v2** (frozen, `community-static-v2` labels): boosted
  residual corrections to a rounded analytic guess.
- **Accuracy emulator**: residual, quantized, regime and scale-free regime
  variants that predict length, thickness and gap from input features alone.
- **Structured ranker**: ranks at most eight legal candidates from
  `lib/solver/community-axis.js`; it cannot check the export because its
  candidates come from the code under check.
- **Export-state learner v1**: a ranker over the solver's candidates and an
  appearance head (outline mode and alpha). Its fixed candidate set cannot reach
  every export the window chooses:
  {{fig:generated.export-emulator.models.ranker.labelMisses|int}} training labels
  fall outside it (`labelMisses`).

### The ML cross-check {#crosscheck}

The export-state learner v2 (`sicc-export-emulator-v2`, inference
`lib/solver/ml-crosscheck.js`, parameters `data/ml-crosscheck.json`) predicts the
whole export: length, thickness, gap, outline mode and alpha, colour, fill
alpha and T. It never calls the solver, the axis search, the edge-case planner or
`infer()`; a boundary test checks that it imports only `lib/geometry/`,
`lib/settings/` and `lib/solver/statistics.js`.

1. **Regime transforms.** Source arithmetic rebuilds the old shape, then the
   dot-only, outline-only and crossed (full or partial) transforms, and the
   T-shape family with the planned flag for the `tShape` option in use.
2. **Candidates.** Per axis, a scan of the integers around $x^{*}=y/r$ keeps the
   values whose drawn size $P_r(x)$ has the least squared error, one per drawn
   size (closest to $x^{*}$); the gap is solved per width. At most eight
   $(\ell,\theta,g)$ candidates remain.
3. **Ranker.** Boosted trees
   ({{fig:generated.crosscheck-emulator.selected.ranker.rounds|int}} rounds, depth
   {{fig:generated.crosscheck-emulator.selected.ranker.maxDepth|int}}) score each
   candidate; features include the exact overlap of its cell boxes with the
   target, best over shifts of at most one pixel.
4. **Heads.** Four small boosted heads predict outline mode, outline alpha,
   colour and fill alpha. The T flag is not predicted: it is planned and may be
   moved by the window, as in the converter.
5. **Window.** An independent re-derivation of the appearance window, the
   exact screen endpoints and the plain fallback moves the chosen tuple as the
   converter does. The ranker trains on "the window of this candidate is the
   label".

The trainer records SHA-256 hashes of the feature code and capacity lists and
refuses to run when they change without `--refreeze`. The page row reads
"Agrees on this input", "Differs on this input: predicts …", "not retrained for
this version" (other version, edited file, feature mismatch or stale summary),
"Not checked for this input" (image and measured targets), "Not checked:
corrections off" or "Not available". The export is always the solver's.

## Result

Cross-check, scored on {{fig:summary.learners.crosscheck.evaluated|date}} for
`{{fig:summary.learners.crosscheck.targetVersion|version}}`:

| Split | Rows | Groups | Learner | Interval | Rule baseline |
|---|---:|---:|---:|---:|---:|
| Reused holdout | {{fig:summary.learners.crosscheck.reusedHoldout.rows|int}} | {{fig:summary.learners.crosscheck.reusedHoldout.groups|int}} | {{fig:summary.learners.crosscheck.reusedHoldout.learner.exactRate|pct}} | {{fig:summary.learners.crosscheck.reusedHoldout.learner.lower|pct}}–{{fig:summary.learners.crosscheck.reusedHoldout.learner.upper|pct}} | {{fig:summary.learners.crosscheck.reusedHoldout.ruleBaseline|pct}} |
| Edge challenge | {{fig:summary.learners.crosscheck.edgeChallenge.rows|int}} | {{fig:summary.learners.crosscheck.edgeChallenge.groups|int}} | {{fig:summary.learners.crosscheck.edgeChallenge.learner.exactRate|pct}} | {{fig:summary.learners.crosscheck.edgeChallenge.learner.lower|pct}}–{{fig:summary.learners.crosscheck.edgeChallenge.learner.upper|pct}} | {{fig:summary.learners.crosscheck.edgeChallenge.ruleBaseline|pct}} |
| Corpus, cross heights | {{fig:summary.learners.crosscheck.corpusCrossHeight.rows|int}} | | {{fig:summary.learners.crosscheck.corpusCrossHeight.exactRate|pct}} | | |

Research learners, exact-tuple agreement with the solver:

| Learner | Labels | Test | Shifted challenges |
|---|---|---:|---|
| Accuracy emulator, regime | `{{fig:summary.learners.accuracy.targetVersion|version}}` | {{fig:summary.learners.accuracy.exactTuple.test.regime|pct}} | interior {{fig:summary.learners.accuracy.exactTuple.interior.regime|pct}}, exterior {{fig:summary.learners.accuracy.exactTuple.exterior.regime|pct}} |
| Accuracy emulator, scale-free regime | same | {{fig:summary.learners.accuracy.exactTuple.test.regimeAxis|pct}} | interior {{fig:summary.learners.accuracy.exactTuple.interior.regimeAxis|pct}}, exterior {{fig:summary.learners.accuracy.exactTuple.exterior.regimeAxis|pct}} |
| Accuracy emulator, quantized | same | {{fig:summary.learners.accuracy.exactTuple.test.quantized|pct}} | interior {{fig:summary.learners.accuracy.exactTuple.interior.quantized|pct}}, exterior {{fig:summary.learners.accuracy.exactTuple.exterior.quantized|pct}} |
| Accuracy emulator, residual | same | {{fig:summary.learners.accuracy.exactTuple.test.residual|pct}} | interior {{fig:summary.learners.accuracy.exactTuple.interior.residual|pct}}, exterior {{fig:summary.learners.accuracy.exactTuple.exterior.residual|pct}} |
| Structured ranker | `{{fig:summary.learners.structured.targetVersion|version}}` | {{fig:summary.learners.structured.exactTuple.test|pct}} | interior {{fig:summary.learners.structured.exactTuple.interior|pct}}, exterior {{fig:summary.learners.structured.exactTuple.exterior|pct}} |
| Export-state learner v1 | `{{fig:summary.learners.exportState.targetVersion|version}}` | {{fig:summary.learners.exportState.exportExact.test|pct}} | challenge {{fig:summary.learners.exportState.exportExact.challenge|pct}}, corpus cross heights {{fig:summary.learners.exportState.exportExact.corpusCrossHeight|pct}} |
| Community emulator v2, residual | `community-static-v2` (frozen) | {{fig:generated.community-emulator.test.residual.exactTupleRate|pct}} | challenge {{fig:generated.community-emulator.challenge.scores.residual.exactTupleRate|pct}} against the analytic guess's {{fig:generated.community-emulator.challenge.scores.analytic.exactTupleRate|pct}} |
| Quant emulator v1 | historical 27-model solver | {{fig:generated.quant-emulator.metrics.exactTupleRate|pct}} | naive direct assignment {{fig:generated.quant-emulator.metrics.naiveExactTupleRate|pct}} |

The quant emulator's per-dimension exact rates are
{{fig:generated.quant-emulator.metrics.lengthExactRate|pct}} (length),
{{fig:generated.quant-emulator.metrics.thicknessExactRate|pct}} (thickness) and
{{fig:generated.quant-emulator.metrics.gapExactRate|pct}} (gap). The verified
shortlist contains the solver's tuple in
{{fig:generated.ranker-benchmark.coverageSummary.32|pct}} of
{{fig:generated.ranker-benchmark.counts.testSamples|int}} test settings at
$K=32$ and loses to the solver on
{{fig:generated.ranker-benchmark.verifiedVsSolver.32.worse|int}} of them, at a
median {{fig:generated.ranker-benchmark.timing.verifiedShortlistUs.p50|d1}} µs
against {{fig:generated.ranker-benchmark.timing.exactInferMs.p50|d3}} ms for the
exact solver (local timings). The fragility classifier reaches
{{fig:generated.ranker-benchmark.fragility.accuracyAt0_5|d3}} accuracy against a
{{fig:generated.ranker-benchmark.fragility.majorityBaselineAccuracy|d3}} majority
baseline. The speed gate therefore stays closed (`closed-not-exact-equivalent`,
ADR-0002), and the residual modulator, which would add a correction of at most
±{{fig:generated.quant-modulator.deltaClip|int}} px, returns zero until at least
40 reviewed native pairs exist (`closed-no-native-pairs`).

### Where a learner changed the converter

- **Cross-height ties.** The export learner's disagreements pointed at ties
  where its choice matched the old shape better once the odd-width shift was
  removed; the fix was the aligned tie rule of
  [Community static conversion](12-community-conversion.md), not a model.
- **Outline thresholds.** Export learner v1 failed exactly at outline widths
  just above 0 and just below 1, where a tree threshold falls between training
  values, so the outline mode stays closed form.
- **Regimes.** Scoring by regime showed the size-0 dot as the largest error
  block of the accuracy emulator and the outline-only `#` as invisible to the v1
  head; this added regime features to the learners, not rules to the solver.
- **Window labels.** Labels outside a ranker's candidate set led the v2 learner
  to re-derive the window itself, which is why its agreement is partly by
  construction.

The appearance rules came from issues #11 and #15, the window from a brute-force
geometry audit, and the draw order and outline cap from the leaked old renderer;
none came from a learner. Scores on earlier label versions (v2 to v10) are kept
in the [learner note](../research/learners-2026-10-02.md), the
[accuracy study](../research/accuracy-improvements-2026-09-29.md) and the
[structured-learning study](../research/structured-learning-2026-09-29.md).

## Limits

The cross-check shares the declared old reconstruction, the new drawing model and
the window rule with the converter, so on refined inputs agreement is partly
by construction, and it is quoted only inside its evaluated design (equal heights
at the pixel goal and three listed cross-height scopes). A model trained on
solver labels learns the declared equations and cannot learn a renderer the
repository never observed; the forward surrogate approximates one hypothesis
among 27, which says nothing about whether that hypothesis is true. When the
solver version changes, the row reads "not retrained for this version" until
`npm run emulator:crosscheck` runs. `accuracy-emulator.json` is not published
because of its size; its figures enter this page through `data/quant-summary.json`.
:::
