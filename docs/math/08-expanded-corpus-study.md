# 08 — The expanded pro-crosshair corpus and quantitative study

Snapshot: **2026-09-23**. This is a reproducible observational input corpus
and a deterministic historical-model benchmark. It is not a native new
renderer accuracy study. The complete records, source URLs and generated
rows ship with the repository.

## 8.1 What was collected

Three cohorts are retained without claiming they are independent:

| Cohort | Records | Nature |
|---|---:|---|
| Pinned ProCrosshairs-derived GitHub archive | 100 | Published named-player/code/HLTV-ID facts, with no individual observation dates or resolutions |
| ProCrosshairs published index retrieved on the snapshot date | 30 | Published name/code associations; shares the archive's upstream |
| Original dated xhair.pro fixtures | 8 | User-supplied prior research records, not newly reparsed demos |
| **Total** | **138** | **106 distinct normalized player names** |

All codes decode as legacy version 1 and pass their checksum. There are
**119 distinct codes** and **50 complete old static-geometry signatures**.
Only **8 records have supplied observation dates**. The other 130 are
published legacy-format snapshots, not claims that a particular player
used that setting on September 23 or in a particular match.

There are two source-provider families, not three: the archive and current
ProCrosshairs index share an origin. They must not be counted as independent
corroborations. The data preserve different historical codes for the same
player instead of silently calling them simultaneously current settings.
Pro-player names are fixture identifiers, not endorsements or rankings.

The archive TSV was transcribed from the pinned raw source. The build
reconstructs its original JSON object ordering and verifies the Git blob
SHA-1 against `210e17ca65ca68bd906774f4b332fe40f8487cef`. This proves the
transcription matches that archived file. It does not independently verify
pro-player usage, the file collector's extraction process, or native game
pixels. Data provenance must not be inflated into renderer ground truth.

## 8.2 Inclusion, exclusions, and controlled resolutions

The automatic study includes only stationary `style=4` records with
`weapon_gap=false`. This leaves **135 eligible records**. Three records
are excluded: the archived flameZ style-5 preset and two Twistzz records
with weapon-dependent gap. They remain visible in the corpus with their
original flags, but cannot be exported as certified static conversions.

Every eligible record is evaluated at heights

\[
\mathcal H=\{720,768,960,1024,1080,1440,2160\}.
\]

Thus the micro dataset has

\[
135\times7=945
\]

record-height cases. These heights are experimental inputs. They are not
invented reports of the players' actual resolutions. The eligible records
contain **48 distinct geometry signatures**, yielding **336 distinct
geometry-height cells** for the model self-consistency experiment.

A geometry signature includes old size, thickness, gap, dot, T shape,
style and weapon-gap flag. It excludes RGB, alpha, outline width and player
name because the benchmark target concerns only core static geometry.
This is deliberately a parameter-signature grouping. Different signatures
can still rasterize to identical pixels at a particular resolution; 48 is
not necessarily 48 independent rendered shapes at each height.

## 8.3 What target is being predicted

For record \(i\) and controlled height \(h\), the target is

\[
y_{ih}=(L_o,W_o,a_o)
\]

computed from the documented old reconstruction, including binary32
intermediates. This target is generated from source-derived equations,
not measured from 945 native screenshots. Dot and T flags are carried in
the geometry signature; the numerical shortcut benchmark compares the
three displayed dimensions, not a full RGB rendered image.

Five methods are compared:

| Method | Definition | Role |
|---|---|---|
| `source_f32` | Same source-derived old equations as the target | Baseline identity; 100% is tautological |
| `round_scaled` | Round scaled size/thickness instead of truncate | Quantizer ablation |
| `fixed_2x` | Use a resolution-independent ×2 scale | Scale ablation |
| `historical_preview` | Audited old browser preview's length/thickness rule | Historical dimension shortcut |
| `ridge_group_cv` | Weighted ridge fit evaluated on held-out geometry groups | Learned old-target surrogate |

For `historical_preview`, only the audited length/thickness behavior is
reproduced. Near position is derived using that predicted width and the
legacy adjusted gap; it is **not the historical generator's full gap
implementation**, which read another cvar. This distinction prevents a
misleading claim of browser-renderer replication. Quantizer/scale ablation
near terms use truncation of `G+4` after their chosen width estimate.

## 8.4 Micro and geometry-macro summaries

Let \(e_{ihm}=1\) when all three predicted target components agree exactly,
zero otherwise. Micro agreement is

\[
\widehat A_{micro,m}=\frac{1}{N}\sum_{i,h}e_{ihm}.
\]

This describes record-weighted performance: frequently reused crosshair
geometries receive more influence. It is useful for understanding this
corpus's composition, but can make a method look better simply because a
popular preset is copied by many players.

Let \(g\) index the \(K=48\) eligible geometry signatures. First calculate
within-group agreement, then average groups equally:

\[
\bar e_{gm}=\frac{1}{|g|}\sum_{(i,h)\in g}e_{ihm},\qquad
\widehat A_{macro,m}=\frac1K\sum_g\bar e_{gm}.
\]

Every group contains the seven controlled heights for each matching
record, so duplicate records within one signature do not change its macro
contribution. Macro and micro answer different descriptive questions; the
application reports both rather than substituting whichever is larger.

The coordinate RMSE is

\[
\operatorname{RMSE}_m=
\sqrt{\frac{1}{3N}\sum_{i,h}\|\widehat y_{ihm}-y_{ih}\|_2^2}.
\]

Per-dimension exact counts and per-height counts are also retained in JSON,
so a combined score cannot hide whether a problem is primarily length,
width, or near-edge placement.

## 8.5 Actual computed results

The committed generated report gives:

| Method | All-three exact / 945 | Micro agreement | Geometry-macro agreement | 95% bootstrap stability interval |
|---|---:|---:|---:|---:|
| Source baseline | 945 | 100.00% | 100.00% | 100.00–100.00% |
| Round scaled | 539 | 57.04% | 52.38% | 46.43–58.04% |
| Fixed ×2 | 411 | 43.49% | 44.64% | 41.96–48.21% |
| Historical length/thickness preview | 257 | 27.20% | 13.10% | 8.04–18.75% |
| Grouped ridge surrogate | 755 | 79.89% | 71.73% | 63.99–79.17% |

These are **historical surrogate agreement rates**. None is a measured
success rate for a conversion formula in updated CS2. The strong learned
surrogate result merely shows that a compact smooth model can approximate
much of a piecewise-quantized old function on these inputs. It does not
replace the known reconstruction, and does not identify an unobserved new
forward function.

The original eight-preset experiment remains unchanged in the archive.
It found that a ×2 shortcut could appear correct for every selected preset
at 960p and 1080p while failing across the wider height grid. The larger
corpus reinforces the value of resolution and parameter diversity; it
does not retrospectively turn either experiment into native validation.

## 8.6 Grouped cross-validation for the learned surrogate

The ridge feature vector is

\[
\phi(x,h)=
[1,Sh/480,Th/480,G,\mathbf1\{T=0\},h/1080].
\]

Three independent response regressions predict length, width, and near
position. The design has six features and a fixed penalty \(\lambda=0.01\).
The implementation uses weighted normal equations and pivoted elimination
with numerical failure checks; inspect `research/lib/regression.js` for the
exact intercept-penalty convention. Results and coefficients for every
fold are committed, not merely a final fitted model.

Geometry signatures are deterministically assigned to one of five folds
by a seeded stable hash. Every duplicate code/player/color variant and all
seven heights of one signature remain in the same fold. This blocks the
obvious leakage in a random row split, where a near-identical code at the
same or adjacent resolution appears in training and testing.

For each training fold, rows of one geometry receive total weight one:

\[
w_{ih}=1/n_g.
\]

The weighted objective is

\[
\widehat\beta=\arg\min_\beta
\sum_{i,h\in train}w_{ih}(y_{ih}-\phi_{ih}^{T}\beta)^2
+\lambda\sum_{j=1}^{5}\beta_j^2,
\]

with an unpenalized intercept (index 0). Test predictions
are rounded to nearest integer, and nonnegative length/minimum width
constraints are applied. No hyperparameter search uses the held-out folds.
There is no separate external test provider or future-build test set.
Grouped cross-validation mitigates one leakage route; it does not remove
source selection bias, deterministic-target circularity, or all similarity
between distinct old signatures.

## 8.7 Cluster-bootstrap intervals

The reported intervals resample the 48 group-level agreement means with
replacement. Each of 2,000 draws samples 48 group indices and averages
their scores. A deterministic PRNG seed `23092026` is retained. The 2.5th
and 97.5th percentiles give the displayed stability interval.

\[
A_m^{*(b)}=\frac1K\sum_{j=1}^{K}\bar e_{G_j^{*(b)},m}.
\]

This is a descriptive resampling stability interval for this corpus under
a geometry-cluster sampling model. The source population is not a random
sample of all CS players. Duplicated upstream sources, code preferences,
unobserved match dates and non-random pro selection limit generalization.
Calling this a calibrated “95% probability the formula works in CS2” would
be mathematically incorrect.

For the ridge method, these intervals resample fixed out-of-fold errors;
they do not refit the complete cross-validation procedure within every
bootstrap draw. They therefore do not include all model-training
variability. That limitation is stated rather than hidden behind the
numerical precision of the percentiles.

## 8.8 Input-dependent coverage, not invented accuracy

For a new user input, the app calculates distance to distinct old geometry
groups. The present metric is

\[
d_g^2=((S-S_g)/2)^2+(T-T_g)^2+((G-G_g)/3)^2
+2\mathbf1\{d\ne d_g\}+2\mathbf1\{t\ne t_g\}.
\]

Kernel weights are \(k_g=\exp(-d_g^2/2)\). The report includes exact
signature matches, nearby groups, nearest groups, and Kish effective
support size

\[
n_{eff}=\frac{(\sum_gk_g)^2}{\sum_gk_g^2}.
\]

This describes how close the input is to corpus examples under a chosen
metric. Its scale constants are heuristic, documented choices. It is not
a learned probability of native conversion correctness, and never updates
the new renderer posterior. An out-of-domain input is flagged rather than
assigned confident results because some distant famous player has a code.

## 8.9 Synthetic inversion study

Separately, the 27 forward hypotheses are inverted across 336 eligible
unique geometry-height cells. The study reports own-model exact geometry
matches and ideal values outside legal ranges. This is an engineering
representability test: can a given hypothetical new coordinate system
express the legacy target? It is not evidence that the model represents
Valve's code. A model with more convenient coordinates can have excellent
self-consistency and still be entirely wrong in the game.

## 8.10 Reproduction and future study design

Run `npm run corpus:build` to check transcription identity and recreate the
versioned corpus. Run `npm run research:quant` to recreate fold assignments,
coefficients, summary JSON, per-case CSV, and model representability rows.
`npm run research:reproduce` separately checks the immutable original
Python experiment. Unit tests assert source checksums, record counts,
geometry-disjoint folds, deterministic outputs, and that legacy corpus
changes do not affect native posterior weights.

A future native study should register capture settings before measurement,
span quantization transitions and authored/current-height ratios, hold out
entire geometry/session groups, document scaling and capture processes,
and retain original PNG hashes. Collecting another hundred copied small
crosshairs at one resolution is less informative about the renderer than
several carefully chosen settings on which the competing families disagree.
