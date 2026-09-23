# 06 — Likelihood, confidence, and what the data can identify

**Version note:** the v4 derivation below is preserved. [Chapter 09](09-solver-and-integrity.md) specifies the implemented v5 joint inverse, full-domain shape metric, robust likelihood and evidence-integrity changes.

The most important statistical distinction in this project is between
**realistic old inputs** and **observed new outputs**. The 138-record corpus
contains the former. It contains zero paired native new-renderer captures.
More old presets increase coverage of input geometries; they do not create
labels for the unknown new renderer.

## 6.1 The unidentifiability result

Write \(X_o\) for legacy codes and old resolutions, \(M\) for the unknown
new renderer, and \(Y_n\) for actual new-client pixels. Under the explicit
sampling assumption that the collected pre-update settings do not depend
on an unreleased new rendering implementation,

\[
p(X_o\mid M=m)=p(X_o),
\]

and Bayes' rule gives

\[
p(M=m\mid X_o)=p(M=m).
\]

This is not pessimism about research. It states what observations are
needed to learn this particular unknown. Adding 10,000 copied old codes
cannot change it. Native observations \((v_i,H_i,A_i,Y_i)\), or an
independently established new rendering implementation, can change the
posterior. A capture of an arbitrary *new* setting is useful even without
an old/new pair: it constrains the forward renderer. An old/new pair is
additionally useful to validate the complete conversion pipeline.

The implementation enforces this boundary: the corpus informs input
coverage and the historical surrogate benchmark. It never enters the new
renderer likelihood. Records explicitly marked `synthetic` are excluded
from native posterior updates. Their number is reported so the exclusion
is visible, not silently performed.

## 6.2 Four different quantities, four different interpretations

1. **Selected-model mask overlap** compares a chosen simulator with the
   target mask. It is a geometric score, not a probability.
2. **Prior/posterior scenario mass** sums weights of enumerated scenarios
   under which a candidate exactly matches. It is conditional on the
   scenario family, priors, noise assumptions and supplied measurements.
3. **Corpus stability intervals** describe resampling variation of a
   historical benchmark over distinct geometry groups. They say nothing
   directly about new-native correctness.
4. **Native empirical validation** tests an independently chosen model on
   user-declared held-out native capture groups. Its Wilson interval refers
   to that forward-geometry test population, not an individualized chance
   that this user's converted crosshair is identical.

The JSON key `nativeMatchProbability` is therefore `null` throughout this
release. The UI says **Not identified**, not `0%`: absence of evidence is
not proof that a candidate fails. Conversely, a simulator score of `100%`
is not permission to display `100% native confidence`.

## 6.3 Prior specification and sensitivity

The default hypothesis set is the 27 scenarios of chapter 05. Initial
weights are

\[
\pi_m=1/27.
\]

This is a transparent sensitivity prior, not an estimated distribution of
Valve's implementation choices. The authored-height description gives a
qualitative reason to consider the authored family especially plausible,
but translating that reason into a number such as `93%` would be invented.
We consequently expose the family weights and explicitly avoid calling
this default an empirical likelihood.

Model enumeration can itself distort conclusions. Copying a model label
must not multiply its prior probability. The three scale families each
receive one third of the prior mass; each has nine predefined alternatives.
For a candidate \(v\), let \(E_m(v)\) be one when its uncropped simulated
mask is exactly equal to the target and zero otherwise. Reported scenario
mass is

\[
C(v)=\sum_m w_m E_m(v).
\]

We also renormalize weights within each scale family and report

\[
[\min_f C_f(v),\;\max_f C_f(v)].
\]

This is a **family-sensitivity range**, not a confidence interval. It shows
how much a result changes with a different scale-family assumption. It is
not a sweep over every possible prior, and does not account for renderers
outside the family. The research report always includes the full weights.

## 6.4 Native observation schema

A native observation records an ID, build, measurement kind, role,
independent capture/session group, capture SHA-256, explicit user
attestation, new cvars, current height, measured geometry and a declared
pixel noise scale. Accepted native observations must match target build
`2000914`. Cvars are range-checked. The noise scale is bounded between
0.25 and 32 pixels. There are at most 256 records per session.

The hash is content identity, not authenticity proof. An attestation means
the user says the image is native and uses the specified settings. This
application cannot cryptographically prove which game build or settings
produced a screenshot. Exporting that limitation is essential. Evidence
files are local to the tab unless explicitly downloaded; the application
does not upload captures or contact a game process.

Native automatic image measurements use direct component bounds rather
than the historical template search. In particular, the extraction does
not force `far=near+1`. Otherwise the observation procedure would already
contain the assumption we want to test. Difficult captures are refused;
manual scoped measurement JSON remains available for cases outside the
component extractor's bounds.

## 6.5 A conservative grouped pseudo-likelihood

For a measurement \(i\), prediction \(f_m(v_i)\), observed geometry
\(y_i\), and declared standard deviation \(\sigma_i\), define

\[
D_{im}=\sum_{k\in K_i}
\left(\frac{y_{ik}-f_{mk}(v_i)}{\sigma_i}\right)^2.
\]

For bars, \(K_i=\{L,W,a,b\}\). For a pure dot, only length and width are
used; assigning an arbitrary near/far pair cannot create extra evidence.
The diagonal-noise assumption is a pragmatic working model. In real
captures, width and edge errors can be correlated through segmentation,
scaling, and center selection. The implementation does not pretend to
estimate a full covariance matrix from one image.

Rows sharing a capture hash **or** a declared session group are joined into
one group, including transitive links. The dependence graph is joined before duplicate
observations are removed, so a renamed repeated image cannot split one
dependent session into multiple supposedly independent groups. Canonical
keys use observable features rather than JSON property ordering. Exact repeated measurements of the
same image/settings/observed values/noise are deduplicated. Let \(g\)
denote a resulting group. The log weights are

\[
\ell_m=\log\pi_m-
\frac12\sum_g\frac{1}{|g|}\sum_{i\in g}D_{im}.
\]

The within-group average is intentional tempering: repeated correlated
views do not contribute a full independent likelihood each. This is a
**generalized or pseudo-posterior**, not a claim that the grouped captures
have a fully specified independent Gaussian sampling distribution. A
large number of poorly declared “independent” groups can still overstate
information. The export retains group labels so that reviewers can audit
that assumption.

Normalize with log-sum-exp:

\[
w_m=\exp\{\ell_m-\operatorname{LSE}(\ell_1,\ldots,\ell_M)\}.
\]

This avoids underflow when several models have large residuals. Posterior
entropy, in bits, is

\[
\mathcal H(w)=-\sum_mw_m\log_2w_m.
\]

Concentrated mass means the data distinguish this family under the chosen
noise scale. It is not proof that the family contains the real renderer.

## 6.6 All models can be wrong

Normalization always produces a winner, even when every model fails.
For each calibration group we inspect its smallest average standardized
squared error. If even the best exceeds 25, the report sets
`allModelConflict` and warns of possible misspecification.

The threshold 25 is an engineering alert, **not a calibrated statistical
hypothesis test or p-value**. Feature correlation and chosen noise scales
prevent that interpretation. The right response is to inspect capture
provenance, center convention, image scaling, outline segmentation, actual
build, and missing renderer families. Repeatedly rendering the current
winner until it looks convincing is not an acceptable response.

The model family currently shares a one-pixel near/far relationship.
Native measurements violating it are an example of evidence that should
cause a family revision rather than a hidden target adjustment. Candidate
reports preserve the model version, so a revised family is a new research
result, not a silent rewrite of an old result.

## 6.7 Posterior predictive candidate selection

After each model proposes and locally refines a legal tuple, identical
new tuples are merged. Every remaining tuple is evaluated under every
scenario. Let \(I\) and \(U\) be the target/candidate mask intersection and
union counts. For a nonempty uncropped mask,

\[
\operatorname{IoU}=I/U,\qquad
\mathcal L_{\mathrm{mask}}=1-\operatorname{IoU}.
\]

The implementation falls back to a disclosed geometry penalty when masks
are cropped or empty. It never labels an empty union or clipped preview
an exact visual success. The automatic candidate minimizes

\[
\widehat v=\arg\min_{v\in\mathcal C}
\sum_m w_m\mathcal L\bigl(R_m(v),Y_*\bigr),
\]

where \(\mathcal C\) is the finite deduplicated proposal/refinement set.
This is Bayes-action-like selection under the specified pseudo-posterior
and loss. It is not a global optimizer over all possible rendering code,
nor a global minimizer of mask loss over every legal cvar tuple.

The target stays frozen during refinement. Synthetic comparisons change
candidate tuples, **never posterior model weights**. A new native capture
changes weights through the independent evidence path, then the inverse
and visual search run again. This separation prevents a circular process
where an algorithm awards itself higher confidence for matching its own
picture.

## 6.8 Holdouts and Wilson intervals

A capture is assigned to calibration or holdout before use. Any shared
capture hash or session-group label across these roles is rejected. Exact
captures cannot be relabeled to leak into both. Entire groups are the unit
of validation, not each duplicate frame. Models are selected using only
calibration weights; holdouts never update them.

The implemented held-out test asks whether the MAP forward model predicts
all observable geometry features within **0.5 pixel** for every member of
a held-out group. A group succeeds only if all its relevant observations
pass. This threshold is an operational definition of success; it is not
an assertion that 0.5-pixel differences are always invisible.

For \(s\) successful independent groups out of \(n\), the Wilson interval
with \(z=1.959963984540054\) is [Q08]:

\[
\widehat p=s/n,\qquad
c=\frac{\widehat p+z^2/(2n)}{1+z^2/n},
\]
\[
h=\frac{z}{1+z^2/n}
\sqrt{\frac{\widehat p(1-\widehat p)}n+\frac{z^2}{4n^2}},
\qquad [c-h,c+h].
\]

For \(n=0\), the interval is undefined (`null`), not `[0,1]` disguised as
an estimate. Its interpretation requires the supplied groups to represent
an appropriate independent test population. Opportunistically selected
screenshots do not automatically meet that assumption. The result is
reported as held-out **forward-model** geometry agreement, not a calibrated
per-user conversion probability.

The report also records the predictive mass assigned to models that pass
each holdout and its negative log score. This is a thresholded predictive
score, not the continuous Gaussian likelihood itself. No claim of formal
probability calibration, conformal coverage, Brier-score calibration or
frequentist validity is made from absent or tiny native samples.

## 6.9 Active experiment selection

The next-experiment tool examines 48 combinations of current height,
authored height and gap, using fixed discriminating length/thickness.
For each setting, models are partitioned by their predicted geometry. If
partition masses are \(q_j\), the score is

\[
J(e)=-\sum_jq_j\log_2q_j.
\]

The highest score is a useful **noiseless disagreement heuristic**. In an
ideal deterministic observation it equals the entropy of the distinct
predictions. It is not the expected information gain under correlated
measurement noise. The current implementation does not integrate noise
kernels or posterior updates over all possible noisy pixels.

A recommended experiment prints cvars and both heights. Set the game
resolution separately. Captures with intentionally varied authored/current
ratios are more informative about scaling than repeatedly collecting the
same small crosshair at 1080p. Independent holdouts must still be reserved
before using the resulting captures for model choice.

## 6.10 Limits and a route to real confidence

To support an empirically calibrated confidence estimate, collect native
captures with recorded build, settings, original dimensions, center,
scaling mode and capture provenance across discriminating geometries.
Separate geometry/session groups before model fitting. Expand a model
family only when calibration residuals justify it, then evaluate on
untouched holdout groups. Quantify sampling and extraction uncertainty.
Cross-patch transport requires fresh validation; a later patch is not
covered by build 2000914 evidence.

Conformal methods can provide certain coverage guarantees under their
assumptions [Q10], but plugging synthetic old masks into a conformal
calculator would not create coverage for native new renderers. Such a
method is deliberately not implemented or advertised here.

The project's contribution is to preserve those distinctions in executable
code while still returning useful candidates, explicit alternatives,
measured residuals and reproducible experiments. Its uncertainty is
observable data in the report, not a disclaimer pasted below a fabricated
probability.
