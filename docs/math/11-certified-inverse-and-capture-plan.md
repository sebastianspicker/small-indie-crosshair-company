# 11 — Certified inverse, decision rules, and a capture plan

**Implementation:** `quant-static-v5`, release 0.3.0. **Native renderer
evidence shipped:** zero capture pairs. This chapter adds a certification layer
around the *declared* decision loss, a complete integer preimage, three declared
decision rules, a behavioural partition of the 27-model family, and a synthetic
discriminating capture plan. Every number below is reproducible from the
committed generated artifacts, the code in `lib/solver/` and `research/lib/`, and the scripts named in
each section.

None of these results observe the game. The certificate says a tuple is the best
available choice *inside a declared loss* and nothing about Valve's renderer.
The default automatic path still returns its bounded-search candidate; the
certified expansion is **opt-in** (`infer({ certify: true })`) so the shipped
default does not silently drift.

## 1. What "certified" means here

The automatic solver ranks legal tuples by a declared loss over the 27 hypothesis
scores. The loss key depends on the declared decision rule (`lib/solver/selection.js`):

```text
expected  -> expectedLoss   = sum_m  w_m * loss_m
worst     -> worstCaseLoss  = max_m  loss_m
cvar      -> cvarLoss       = prior-free weighted CVaR at alpha = 0.5
```

The weights `w_m` are prior-only in every study in this chapter (no native
calibration). A "certificate" therefore establishes a minimum of *that* declared
objective on the declared integer domain, or it refuses. It is not renderer
truth, not a probability, and not native accuracy.

## 2. W1 — the shipped bounded search is not globally optimal

The runtime search is bounded: 27 initial proposals, at most two local
neighbourhood passes, two extra length probes, and no full enumeration. That
choice is fast and its trace is exact, but it can stop before the declared
optimum.

`research/scripts/certify-inverse.mjs` (`npm run certify:inverse`) re-solves the corpus
with `rankAndCertify` and the adaptive Chebyshev-shell certificate
(`certifyOptimum` in `lib/solver/certify.js`), then measures how often the shipped
bounded choice differs from the certified minimum.

Inputs and tally (`research/generated/inverse-certification.json`):

```text
corpus records            138
eligible records          133   (pro-026 dgt and pro-064 sFade8 skipped:
                                unsupported legacy color preset)
eligible geometry groups  48
heights                   720, 1080, 1440, 2160
decisions                 expected, worst
scheduled cases           1064  (133 x 4 x 2)

method tally              loss-zero          16
                          shell-monotone   1032   (conditional)
                          domain-exhaustive   0
                          unproven            16   (pure-dot plateaus)
certified fraction        0.9849624 (98.5%)
```

The shipped search was **not** globally optimal in **114 of 1064** cases
(rate `0.1071429`, about **10.7%**). The split by rule is the useful part: about
**0.19%** of the `expected` cases (1 of 532) and about **21%** of the `worst`
cases (113 of 532) had a strictly better certified tuple. The worst-case rule is
where a bounded local search misses a globally better trade-off most often.

Representative counterexamples from the artifact:

| Case | Chosen (shipped) | Certified best | Shipped loss | Certified loss |
| --- | --- | --- | --- | --- |
| pro-001 donk @ 2160, worst | 4/2/0 | 6/1/0 | 0.8421053 | 0.7931034 |
| pro-002 ZywOo @ 720, worst | 3/0/2 | 5/0/0 | 0.75 | 0.6 |

(The three numbers are new length/thickness/gap; `authoredHeight` equals the
current height in both cases.)

**The cross-check is bounded, not complete.** The shell certificate rests on a
documented monotonicity assumption: the declared loss cannot decrease once every
rendered geometric distance strictly grows from the best cell. That assumption is
not proved. It is spot-checked offline against an exhaustive enumeration on a
sub-domain probe (length `0..32`, thickness `0..31`, gap `0..32`), not the full
declared domain:

```text
shellMonotonicityCheck.targets          6
shellMonotonicityCheck.certifiedGlobal  6
shellMonotonicityCheck.agrees           6
shellMonotonicityCheck.assumptionFailures 0
scope: checked against a bounded sub-domain probe, not the full domain
```

So `shell-monotone` is a **conditional** claim. Do not call it a proof, and do
not read "certified fraction 98.5%" as "98.5% correct in the game."

### The runtime exposes the certificate only when asked

The default path records `decision.certificate.method = not-evaluated` (or
`loss-zero` when the chosen tuple already attains the zero floor) and keeps the
existing search policy `bounded-neighborhood-plus-length-two-v1`. Passing
`certify: true` runs `certifiedExpansion` over the ranking pool, sets the policy
to `bounded-neighborhood-plus-certified-expansion-v2`, and may report
`loss-zero`, `shell-monotone` (conditional), `domain-exhaustive` (when the whole
declared domain fits the evaluation budget), or `unproven`. `unproven` never
claims a global optimum. Default outputs are deliberately unchanged.

## 3. W2 — complete integer preimages

The inverse is many-to-one: several legal integer tuples can render exactly the
same geometry. `solveTarget` returns one minimum per hypothesis; the new
`exactPreimage` (`lib/solver/inverse.js`) returns the **whole finite equivalence
class** for one hypothesis, derived directly from `forward()`. Rendering is
quantised and a rendered length or width is an interval of stored values, so the
preimage is a union of integer boxes, not a single tuple.

Each entry carries `byThickness` bands with `lengths` and `gaps` run-length
intervals, a `count`, and a bounded deterministic `sample` of at most 64 tuples.
The exported report exposes it as `report.preimage` (`model`, `complete`,
`count`, `constrainedNearFar`, `sample`, `scope`).

Two facts matter for reading it honestly:

- **An empty preimage can occur even for a target that looks reachable.** With
  old size 2, thickness 1 and gap −3 at 1080, a same-pixel target under the
  `reference720:nearest:thickness` hypothesis is length 4, width 2, near 2,
  far 3. The width 2 *is* reachable (stored thickness 1), but the length interval
  is empty: the scale is 1080/720 = 1.5, and nearest rounding maps stored length
  2 to 3 and stored length 3 to 5 (4.5 rounds up), skipping rendered length 4.
  The result is `count = 0` with one width band and no lengths. Other hypotheses
  do reach that target, so the residue is a property of this hypothesis, not a
  claim that the target is unrepresentable in general.
- **A pure dot leaves the near/far edges unconstrained.** For size 0, thickness
  2 and gap −4 at the authored `trunc:thickness` hypothesis, the target length is
  0, so `constrainedNearFar` is false and every legal gap is an exact match:
  `gaps = [[0, 128]]` and `count = 129`.

Quantisation plateaus are visible as larger classes. The half-scale truncation
case from the regression suite returns `count = 8`: stored lengths `[8, 9]`,
thicknesses `[4, 5]` and gaps `[2, 3]`, i.e. 2 × 2 × 2 exact tuples. A preimage
is exact on the declared integer domain under **one** hypothesis; its union over
hypotheses is not an equivalence class of the game.

## 4. W3 — three declared decision rules disagree often

`lib/solver/selection.js` defines `DECISION_RULES = [expected, worst, cvar]` and
`DEFAULT_ALPHA = 0.5`. The `cvar` rule is a prior-free weighted conditional
value-at-risk: sort the scenario losses from worst to best, take the worst
`alpha` share of the declared weight, and average those losses weighted by their
mass. It is a declared risk attitude, not a fitted risk model.

`research/scripts/decision-study.mjs` (`npm run study:decision`) evaluates all three rules
on the same source-derived targets (`research/generated/decision-study.json`):

```text
cases                        532   (133 eligible records x 4 heights)
all rules agree               24
any disagreement             508   (disagreement rate 0.9548872, ~95.5%)
pairwise chosen different    expected-worst 502
                             expected-cvar  381
                             worst-cvar     362
```

The rules disagree on the chosen native in about 19 of every 20 cases. That is
expected: they encode different risk attitudes over the same 27 scores. What
distinguishes them is the loss they leave on the table, measured as worst-case
regret against the best worst-case loss available in that case:

| Rule | mean chosen worst-case loss | mean worst-case regret | max regret |
| --- | --- | --- | --- |
| expected | 0.81404 | 0.16971 | 0.44444 |
| worst | 0.64519 | 0.00087 | 0.08631 |
| cvar | 0.71008 | 0.06575 | 0.44444 |

By construction `worst` has near-zero regret against a worst-case yardstick.
`expected` minimises the mean expected loss (0.41415) but can be badly beaten in
the worst case. `cvar` sits between the two. All of this is prior-only and
source-derived; the regret values describe the declared objective rules, not
native CS2 rendering accuracy.

## 5. W5 — the 27 model family separates on the sampled domain

`research/lib/partition.js` asks whether two hypotheses are behaviourally identical:
they are equivalent when they produce the same `{length, width, near, far}`
geometry on every sampled cell. `research/scripts/model-partition.mjs`
(`npm run study:partition`) runs the full declared sample
(`research/generated/model-partition.json`):

```text
sampled native tuples     34560
render heights            720, 768, 960, 1080, 1440, 2160 (6)
cells per model           207360
ordered pairs checked     351
distinct classes          27 / 27
```

All 27 hypotheses are behaviourally distinct on this sample: there are no
multi-member groups. The domain is an explicit finite sample, not an exhaustive
proof over all real-valued settings, and it says nothing about which hypothesis
the game uses.

**Honest caveat:** distinctness is a property of the domain, and restricting the
domain can collapse members. Whenever the rendered width is 1 the
thickness-relative gap branch has baseline `floor(1 / 2) = 0`, exactly the
center-relative baseline, so those two branches coincide. A domain restricted to
width 1 (which includes every thickness-0 target) therefore merges some members.
The 27/27 result is reported only for the sampled domain above.

## 6. W6 — a discriminating capture plan, not measurements

A uniform prior leaves most model pairs unseparated by any single crosshair.
`lib/solver/experiments.js` (`discriminatingSet`) greedily covers the weighted
model pairs with forward-computed prediction partitions.
`research/scripts/discriminating-set.mjs` (`npm run study:discriminating`) searches the
declared finite design grid (`research/generated/discriminating-set.json`):

```text
prior                     uniform, entropy 4.7548875 bits
pair weighted total       12.999999999999925  (351 / 27)
candidate designs         2304
smallest full separation  2 designs
unseparated pairs         []  (separates all 351)
```

The two designs are:

1. **length 8, thickness 3, gap 0, authoredHeight 720, currentHeight 768.**
   Alone it separates 342 of 351 pairs and predicts 18 distinct outcomes. Its
   groups pair each authored-scale hypothesis with the corresponding
   reference720 hypothesis (9 pairs that render identically on this design) and
   list the 9 reference1080 hypotheses separately.
2. **length 3, thickness 1, gap 0, authoredHeight 1080, currentHeight 720.**
   Alone it separates 252 pairs and predicts 4 outcomes; it adds the remaining
   9 pairs.

This is a **capture PLAN**. It is a synthetic prediction partition of the
declared 27-hypothesis family under a uniform prior. Perfect separation of the
simulated predictions does not prove any hypothesis matches native pixels, and
renderers outside the family are not considered. The set tells you which two
crosshairs would be most informative to measure if native captures ever exist;
it is not evidence that they do.

## 7. What this chapter does and does not establish

It establishes, on the declared domain and under prior-only weights:

- the shipped bounded search is not always the declared optimum, and by how much
  (114 of 1064 cases, concentrated under the `worst` rule);
- an opt-in certificate that names its method and refuses to claim a global
  optimum when it cannot;
- a complete integer preimage, including empty classes and dot plateaus;
- that the three declared decision rules regularly choose different natives, with
  quantified regret;
- that the 27 hypotheses are behaviourally distinct on a stated finite sample;
- a minimal two-design plan to separate their predictions.

It does not establish any fact about Native CS2 rendering. The labels, targets,
losses and partitions are all generated from the project's own declared models.
The project ships zero native old/new capture pairs,
`nativeMatchProbability` remains `null`, and the `shell-monotone` certificate
rests on a documented, spot-checked (not proved) monotonicity assumption.

Relevant implementation: `lib/solver/certify.js`, `inverse.js` (`exactPreimage`),
`selection.js` (`cvar`, `weightedCvar`), `partition.js`, `experiments.js`
(`discriminatingSet`), and `inference.js` (`certify` option). Scripts:
`research/scripts/certify-inverse.mjs`, `decision-study.mjs`, `model-partition.mjs`,
`discriminating-set.mjs`. Generated artifacts:
`research/generated/inverse-certification.json`, `decision-study.json`,
`model-partition.json`, `discriminating-set.json`. Prior derivations remain in
chapters [05](05-model-families.md), [06](06-statistical-inference.md) and
[09](09-solver-and-integrity.md); provenance is in the
[source ledger](../research/quant-sources.md) and the correction log is in the
[formula history](../research/formula-evolution.md).
