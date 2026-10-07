# Statistical inference: what the data can identify

::: summary
Old crosshair settings, however many, describe the old game. They contain no
observation of the new one, so they cannot make any guess about the new game
more or less likely. The project therefore never shows a "probability that the
conversion is right". It shows how well a candidate fits each declared model,
and it has the machinery to learn from real screenshots of the new game once
they exist, counting repeated screenshots of one session only once.
:::

::: key
The repository holds {{fig:summary.nativeEvidence.calibrationCaptures|int}}
calibration and {{fig:summary.nativeEvidence.holdoutCaptures|int}} holdout
captures of the new game, so every model weight equals its prior and the
held-out agreement interval is undefined.
:::

::: technical
## Question

What can the available data identify about the unknown new renderer $M$, and
how should screenshots of the new game update the 27 hypotheses of
[Model families](05-model-families.md) without overstating their information?
Code: `lib/solver/evidence.js`, `observations.js`, `experiments.js`.

## Model

### Unidentifiability from old inputs

Let $X_{\mathrm{old}}$ be old codes and heights, $M$ the new renderer and $Y$ new
game pixels. If the collected old settings do not depend on how the new renderer
was implemented,

$$
p(X_{\mathrm{old}}\mid M=m)=p(X_{\mathrm{old}})\quad\Longrightarrow\quad p(M=m\mid X_{\mathrm{old}})=p(M=m).
$$

Adding old codes cannot move the posterior. Native observations
$(v_i,H_i,H_{\mathrm{auth},i},Y_i)$ can: a capture of any new setting constrains
the forward renderer, and an old/new pair also tests the full conversion. The
corpus informs input coverage and the historical benchmark only, and records
marked `synthetic` are excluded from updates, with their count reported.

### Four quantities

1. **Mask overlap** under a chosen simulator: a geometric score.
2. **Scenario mass** $C(v)=\sum_m w_m E_m(v)$, with $E_m(v)=1$ when the
   uncropped simulated mask equals the target: conditional on the family,
   priors and noise.
3. **Corpus stability intervals**: resampling variation of a historical
   benchmark over geometry groups ([Corpus study](08-expanded-corpus-study.md)).
4. **Held-out native agreement**: a Wilson interval over independent capture
   groups.

`nativeMatchProbability` is `null` throughout; the interface says "Not
identified", which is neither 0% nor 100%.

### Prior

The default prior is $\pi_m=1/27$: each scale family gets one third, split over
its nine members, so copying a label cannot add mass. Renormalizing within each
scale family $f$ gives the **family-sensitivity range**
$[\min_f C_f(v),\max_f C_f(v)]$, which shows how a result moves with the scale
assumption. It is not a confidence interval and does not cover renderers
outside the family.

### Observations

A native observation records id, build (2000914 for this study), measurement
kind, role, capture/session group, capture SHA-256, a user attestation, the new
cvars, current height, measured geometry and a pixel noise scale between 0.25
and 32 (at most 256 records per session). A hash proves file identity, not
authenticity. Native images are measured by component bounds that do not force
$b'=a'+1$, so the measurement does not contain the hypothesis under test
([Screenshot inversion](07-image-inverse-and-feedback.md)).

### Grouped pseudo-likelihood

For measurement $i$ with prediction $f_m(v_i)$, observation $y_i$ and noise
$\sigma_i$,

$$
D_{im}=\sum_{k\in K_i}\left(\frac{y_{ik}-f_{mk}(v_i)}{\sigma_i}\right)^2,
$$

with $K_i=\{L,W,a,b\}$ for bars and $\{L,W\}$ for a pure dot. Rows sharing a hash
or a session are joined transitively into groups $g$ before duplicates are
removed, and

$$
\ell_m=\log\pi_m-\frac12\sum_g\frac{1}{\lvert g\rvert}\sum_{i\in g}D_{im},\qquad
w_m=\exp\bigl\{\ell_m-\operatorname{LSE}(\ell_1,\dots,\ell_{27})\bigr\},\qquad
\mathcal H(w)=-\sum_m w_m\log_2 w_m .
$$

The within-group average tempers correlated views: this is a generalized
posterior, not a fully specified sampling model. Version 5 replaces the Gaussian
term by the robust mixture of [Historical joint solver](09-solver-and-integrity.md).
Diagonal noise ignores correlated segmentation and centring errors.

### All models can be wrong

Normalization always produces a winner. If the smallest group-averaged
standardized squared error of any calibration group exceeds 25, the report sets
`allModelConflict`. The threshold is an engineering alert, not a p-value; the
response is to inspect provenance, centring, scaling, outline segmentation and
build, or to revise the family, never to re-render the winner.

### Candidate selection

Each scenario proposes and refines a legal tuple; distinct tuples are scored
under every scenario with $\mathcal L_{\mathrm{mask}}=1-\operatorname{IoU}$
(a disclosed geometry penalty for cropped or empty masks), and

$$
\hat v=\operatorname*{arg\,min}_{v\in\mathcal C}\sum_m w_m\,\mathcal L\bigl(R_m(v),Y^{*}\bigr)
$$

over the finite candidate set $\mathcal C$. The target stays frozen; synthetic
comparisons change candidates, never weights.

### Holdouts and Wilson intervals

Captures are assigned to calibration or holdout before use; a shared hash or
session across roles is rejected, and holdouts never update weights. A held-out
group succeeds when the MAP model predicts every observable feature of every
member within 0.5 px. For $s$ successes in $n$ groups, with $z=1.959963984540054$,

$$
\hat p=\frac sn,\qquad
c=\frac{\hat p+z^2/(2n)}{1+z^2/n},\qquad
h=\frac{z}{1+z^2/n}\sqrt{\frac{\hat p(1-\hat p)}{n}+\frac{z^2}{4n^2}},
$$

and the interval is $[c-h,c+h]$; for $n=0$ it is `null`. It describes
forward-model agreement on the supplied groups, not a per-user probability.
The report also records the predictive mass of passing models and its negative
log score.

### Choosing the next experiment

Over 48 combinations of current height, authored height and gap at fixed
discriminating length and thickness, models are partitioned by predicted
geometry, and with partition masses $q_j$

$$
J(e)=-\sum_j q_j\log_2 q_j .
$$

This is a noiseless disagreement heuristic; it equals the entropy of the
distinct predictions, not the expected information gain under noise. A designed
two-capture plan is in [Certified inverse and capture plan](11-certified-inverse-and-capture-plan.md).

## Result

With no native captures, $w_m=\pi_m$ and $\mathcal H(w)=\log_2 27\approx4.75$
bits; candidate selection reduces to the prior-weighted rule.

## Limits

A calibrated confidence would need registered native captures across
discriminating geometries, groups fixed before fitting, model expansion only
when residuals require it, and untouched holdouts; a later patch needs fresh
validation. Conformal methods give coverage only under their assumptions;
plugging synthetic old masks into one would not create coverage for the new
renderer, so none is implemented.
:::
