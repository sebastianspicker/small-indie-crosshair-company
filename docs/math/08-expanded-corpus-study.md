# The pro-crosshair corpus and the historical benchmark

::: summary
The project collected published crosshair codes of professional players to
test conversions on settings people actually use. These are real old inputs, but
none comes with a screenshot of the new game, so they show how well a shortcut
reproduces the old drawing, not how well a conversion works in the new game.
Testing every record at seven resolutions shows that popular shortcuts such as
"multiply by two" fail far more often than the original few examples suggested.
:::

::: key
A fixed factor 2 reproduces the old drawing in
{{fig:summary.ablations.name=fixed_2x.allExact|int}} of
{{fig:summary.eligibleRows|int}} record-height cases
({{fig:summary.ablations.name=fixed_2x.microExact|pct}}); rounding instead of
truncating reproduces {{fig:summary.ablations.name=round_scaled.allExact|int}}.
Both are measured against the historical old model, not the new game.
:::

::: technical
## Question

How often do simple old-to-pixel shortcuts reproduce the historical old
reconstruction on realistic inputs, and how much do the corpus records support a
given input? Snapshot {{fig:summary.dataset.snapshot|date}};
`research/generated/quant-study.json`, `data/quant-summary.json`.

## Model

### The corpus

| Cohort | Records | Nature |
|---|---:|---|
| Pinned ProCrosshairs-derived GitHub archive | 100 | published player, code and HLTV id; no dates or resolutions |
| ProCrosshairs index on the snapshot date | 30 | shares the archive's upstream |
| Original dated xhair.pro fixtures | 8 | frozen research records |
| xhair.pro directory, retrieved October 7, 2026 | {{fig:summary.dataset.expansion.addedRecords|int}} | new legacy associations; provider-reported dates |

In total {{fig:summary.dataset.records|int}} records from
{{fig:summary.dataset.players|int}} players,
{{fig:summary.dataset.uniqueCodes|int}} distinct codes,
{{fig:summary.dataset.uniqueGeometrySignatures|int}} geometry signatures and
{{fig:summary.dataset.datedRecords|int}} dated records, from
{{fig:summary.dataset.sourceProviders|int}} source families (the archive and the
index share ProCrosshairs; the dated fixtures and new harvest share xhair.pro).
Every code decodes as legacy version 1 with a valid
checksum. The archive transcription reproduces Git blob
`{{fig:summary.dataset.sourceArchiveGitBlob|version}}`; that proves the
transcription, not player usage or game pixels. Player names are fixture
labels.

### Cases

The historical study keeps static style 4 without weapon gap:
{{fig:summary.dataset.staticSupported|int}} records. Records with other styles
or weapon-dependent gap are excluded from this controlled static study, even
where the converter can offer an approximate conversion.
Each is evaluated at $\mathcal H=\{720,768,960,1024,1080,1440,2160\}$, giving
{{fig:summary.eligibleRows|int}} record-height cases over
{{fig:summary.eligibleGeometrySignatures|int}} signatures. These heights are
controlled inputs, not the players' resolutions. A signature (size, thickness,
gap, dot, T, style, weapon gap) ignores colour and outline; different signatures
can still draw the same pixels at one height.

The Settings data page also evaluates the actual v11 exports against the old
appearance, including colour and outline, with corrections on and off. That
separate comparison is in `data/pro-conversions.json`; its
[source and evaluation method](../research/pro-data-expansion-2026-10-07.md)
explain the difference between same-position and shift-aligned matches.

### Target and methods

The target is $y_{ih}=(L,W,a)$ from the historical truncation model with binary32
intermediates. Methods: `source_f32` (the target's own equations, 100% by
construction), `round_scaled` (round instead of truncate), `fixed_2x` (scale 2 at
every height), `historical_preview` (the audited length and thickness rule of an
old browser preview, with the near edge derived from it, not that generator's
full gap logic) and `ridge_group_cv` (a learned surrogate, below).

### Scores

With $e_{ihm}=1$ when all three components agree,

$$
\hat A_{\mathrm{micro},m}=\frac1N\sum_{i,h}e_{ihm},\qquad
\bar e_{gm}=\frac{1}{\lvert g\rvert}\sum_{(i,h)\in g}e_{ihm},\qquad
\hat A_{\mathrm{macro},m}=\frac1K\sum_g\bar e_{gm},
$$

over $K$ geometry groups, and

$$
\operatorname{RMSE}_m=\sqrt{\frac{1}{3N}\sum_{i,h}\lVert\hat y_{ihm}-y_{ih}\rVert_2^2}.
$$

Micro weighs popular presets more; macro weighs every geometry equally. The
interval resamples the $K$ group means 2,000 times (seed 23092026) and reports
the 2.5th and 97.5th percentiles:

$$
A_m^{*(b)}=\frac1K\sum_{j=1}^{K}\bar e_{G_j^{*(b)},m}.
$$

### Grouped ridge surrogate

$$
\phi(x,h)=\bigl[1,\ Sh/480,\ Th/480,\ G,\ \mathbf 1\{T=0\},\ h/1080\bigr],\qquad
\hat\beta=\operatorname*{arg\,min}_\beta\sum_{(i,h)\in\text{train}}w_{ih}\bigl(y_{ih}-\phi_{ih}^{\mathsf T}\beta\bigr)^2+\lambda\sum_{j=1}^{5}\beta_j^2,
$$

with $\lambda=0.01$, an unpenalized intercept and $w_{ih}=1/n_g$ so each geometry
weighs one. Signatures go to five folds by a seeded hash, so all copies and all
heights of a geometry stay on one side. Predictions are rounded and clamped to
non-negative length and minimum width; no hyperparameter search uses the test
folds.

### Coverage of a new input

For input settings the app measures distance to each corpus geometry $g$,

$$
d_g^2=\Bigl(\frac{S-S_g}{2}\Bigr)^2+(T-T_g)^2+\Bigl(\frac{G-G_g}{3}\Bigr)^2+2\cdot\mathbf 1\{\text{dot}\ne\text{dot}_g\}+2\cdot\mathbf 1\{\tau\ne\tau_g\},
$$

kernel weights $k_g=e^{-d_g^2/2}$ and the Kish effective support
$n_{\mathrm{eff}}=(\sum_g k_g)^2/\sum_g k_g^2$. The constants are heuristic; the
figure describes support in the corpus and never updates model weights.

## Result

| Method | All three exact | Micro | Macro | Macro stability interval | RMSE |
|---|---:|---:|---:|---:|---:|
| `source_f32` | {{fig:summary.ablations.name=source_f32.allExact|int}} | {{fig:summary.ablations.name=source_f32.microExact|pct}} | {{fig:summary.ablations.name=source_f32.clusterStability.mean|pct}} | {{fig:summary.ablations.name=source_f32.clusterStability.lower|pct}}–{{fig:summary.ablations.name=source_f32.clusterStability.upper|pct}} | {{fig:summary.ablations.name=source_f32.rmse|d3}} |
| `round_scaled` | {{fig:summary.ablations.name=round_scaled.allExact|int}} | {{fig:summary.ablations.name=round_scaled.microExact|pct}} | {{fig:summary.ablations.name=round_scaled.clusterStability.mean|pct}} | {{fig:summary.ablations.name=round_scaled.clusterStability.lower|pct}}–{{fig:summary.ablations.name=round_scaled.clusterStability.upper|pct}} | {{fig:summary.ablations.name=round_scaled.rmse|d3}} |
| `fixed_2x` | {{fig:summary.ablations.name=fixed_2x.allExact|int}} | {{fig:summary.ablations.name=fixed_2x.microExact|pct}} | {{fig:summary.ablations.name=fixed_2x.clusterStability.mean|pct}} | {{fig:summary.ablations.name=fixed_2x.clusterStability.lower|pct}}–{{fig:summary.ablations.name=fixed_2x.clusterStability.upper|pct}} | {{fig:summary.ablations.name=fixed_2x.rmse|d3}} |
| `historical_preview` | {{fig:summary.ablations.name=historical_preview.allExact|int}} | {{fig:summary.ablations.name=historical_preview.microExact|pct}} | {{fig:summary.ablations.name=historical_preview.clusterStability.mean|pct}} | {{fig:summary.ablations.name=historical_preview.clusterStability.lower|pct}}–{{fig:summary.ablations.name=historical_preview.clusterStability.upper|pct}} | {{fig:summary.ablations.name=historical_preview.rmse|d3}} |
| `ridge_group_cv` | {{fig:summary.ablations.name=ridge_group_cv.allExact|int}} | {{fig:summary.ablations.name=ridge_group_cv.microExact|pct}} | {{fig:summary.ablations.name=ridge_group_cv.clusterStability.mean|pct}} | {{fig:summary.ablations.name=ridge_group_cv.clusterStability.lower|pct}}–{{fig:summary.ablations.name=ridge_group_cv.clusterStability.upper|pct}} | {{fig:summary.ablations.name=ridge_group_cv.rmse|d3}} |

The ridge surrogate shows that a smooth model approximates much of a
piecewise-quantized function on these inputs; it does not replace the known
equations. The original eight-preset experiment, where factor 2 looked right at
960 and 1080, stays unchanged in the archive. Separately, every one of the 27
historical hypotheses was inverted over the corpus geometry-height cells to test
representability ([Model families](05-model-families.md)).

## Limits

The source population is published pro settings, not a random sample of
players; duplicated upstreams, unobserved match dates and selection limit any
generalization, and the interval is a descriptive resampling interval, not a
probability that a formula works in CS2. For the ridge method it resamples fixed
out-of-fold errors and omits refitting variability. A useful native study would
register settings before capture, span quantization boundaries and ratios, hold
out whole geometry and session groups, and keep the original PNG hashes.
:::
