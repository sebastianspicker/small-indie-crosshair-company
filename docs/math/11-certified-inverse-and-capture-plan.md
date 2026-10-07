# Certified inverse, decision rules and a capture plan

::: summary
For the historical 27-guess study this chapter asks four questions: does the
fast search find the best answer by its own measure, how many different
settings draw exactly the same pixels, how often do different ways of hedging
between the guesses disagree, and which two screenshots of the new game would
tell all 27 guesses apart. The answers are measured on our own models. They plan
the captures; they are not captures.
:::

::: key
Two designed captures separate all {{fig:generated.discriminating-set.totalPairs|int}}
pairs of the 27 hypotheses; the shipped bounded search misses the certified
optimum of its own loss in {{fig:generated.inverse-certification.inferredBetter.count|int}}
of {{fig:generated.inverse-certification.cases|int}} corpus cases.
:::

::: technical
## Question

On the declared integer domain and under prior-only weights, (1) is the bounded
decision search optimal, (2) what is the complete set of exact preimages, (3)
how do the decision rules differ, (4) are the 27 hypotheses distinct, and (5)
which captures separate them? Code: `lib/solver/certify.js`, `inverse.js`
(`exactPreimage`), `selection.js`, `experiments.js` (`discriminatingSet`).

## Model

### Certificates

The rules score a tuple by its 27 hypothesis losses $\ell_m(v)$:

$$
\text{expected: }\sum_m w_m\ell_m(v),\qquad \text{worst: }\max_m\ell_m(v),\qquad
\text{cvar: mean of the worst half of the weight } (\alpha=0.5).
$$

`certifiedExpansion` sweeps Chebyshev shells around the current best tuple: a
strictly better cell moves the best and restarts; a full shell that is strictly
worse certifies `shell-monotone`; a domain small enough is enumerated
(`domain-exhaustive`); a zero loss is `loss-zero`; budget or radius exhaustion is
`unproven`, which claims nothing. `shell-monotone` rests on an assumption, that
the loss cannot decrease once every drawn distance from the best cell grows; it
is spot-checked, not proved. The default path reports
`decision.certificate.method = not-evaluated` (or `loss-zero`);
`infer({ certify: true })` switches the policy to
`bounded-neighborhood-plus-certified-expansion-v2`.

### Preimages

Drawn length and width are intervals of stored values, so the exact preimage of
a target under one hypothesis is a union of integer boxes: per thickness, runs
of lengths and gaps, with a count and a sample of at most 64 tuples.

### Partition and design

Two hypotheses are behaviourally identical on a domain when they draw the same
$(L',W',a',b'_{\mathrm f})$ on every sampled cell. A design $e$ (a tuple and a
current height) partitions the hypotheses by prediction; `discriminatingSet`
greedily covers the weighted hypothesis pairs with such partitions over a
finite design grid.

## Result

**Certification** (`research/generated/inverse-certification.json`;
{{fig:generated.inverse-certification.inputs.eligibleRecords|int}} eligible
records, heights 720, 1080, 1440 and 2160, rules expected and worst):

| Method | Cases |
|---|---|
| `loss-zero` | {{fig:generated.inverse-certification.tally.loss-zero|int}} |
| `shell-monotone` (conditional) | {{fig:generated.inverse-certification.tally.shell-monotone|int}} |
| `domain-exhaustive` | {{fig:generated.inverse-certification.tally.domain-exhaustive|int}} |
| `unproven` (pure-dot plateaus) | {{fig:generated.inverse-certification.tally.unproven|int}} |

The certified fraction is {{fig:generated.inverse-certification.certifiedFraction|pct}},
a statement about the declared loss, not the game. The bounded search was not
optimal in {{fig:generated.inverse-certification.inferredBetter.count|int}} cases
({{fig:generated.inverse-certification.inferredBetter.rate|pct}}), almost all
under the worst-case rule: 113 of 532 worst-case and 1 of 532 expected-loss
cases when the study was first run (release 0.4.0). Example: donk at 2160 under `worst` exported 4/2/0 at loss 0.8421; the
certified best is 6/1/0 at 0.7931. On a probe (length 0 to 32, thickness 0 to
31, gap 0 to 32) the shell assumption agreed with exhaustive enumeration on
{{fig:generated.inverse-certification.shellMonotonicityCheck.agrees|int}} of
{{fig:generated.inverse-certification.shellMonotonicityCheck.targets|int}}
targets, with {{fig:generated.inverse-certification.shellMonotonicityCheck.assumptionFailures|int}}
failures.

**Preimages.** Old size 2, thickness 1, gap −3 at 1080 under
`reference720:nearest:thickness` targets length 4, width 2: the width is
reachable, but the scale 1.5 with nearest rounding maps stored lengths 2 and 3
to 3 and 5, so the preimage is empty. A pure dot (size 0, thickness 2, gap −4)
leaves the gap free: all 129 gaps match. A half-scale truncation case has
$2\times2\times2=8$ exact tuples.

**Decision rules** (`research/generated/decision-study.json`,
{{fig:generated.decision-study.cases|int}} cases): all three rules agree in
{{fig:generated.decision-study.agreement.allRulesAgree|int}} and disagree in
{{fig:generated.decision-study.agreement.anyDisagreement|int}}
({{fig:generated.decision-study.agreement.disagreementRate|pct}}).

| Rule | Mean chosen worst-case loss | Mean worst-case regret | Max regret |
|---|---|---|---|
| expected | {{fig:generated.decision-study.chosenWorstCaseLoss.expected.mean|d5}} | {{fig:generated.decision-study.worstCaseRegret.expected.mean|d5}} | {{fig:generated.decision-study.worstCaseRegret.expected.max|d5}} |
| worst | {{fig:generated.decision-study.chosenWorstCaseLoss.worst.mean|d5}} | {{fig:generated.decision-study.worstCaseRegret.worst.mean|d5}} | {{fig:generated.decision-study.worstCaseRegret.worst.max|d5}} |
| cvar | {{fig:generated.decision-study.chosenWorstCaseLoss.cvar.mean|d5}} | {{fig:generated.decision-study.worstCaseRegret.cvar.mean|d5}} | {{fig:generated.decision-study.worstCaseRegret.cvar.max|d5}} |

`expected` has the lowest mean expected loss
({{fig:generated.decision-study.chosenExpectedLoss.expected.mean|d5}}) and the
largest worst-case regret; `cvar` lies between.

**Partition** (`research/generated/model-partition.json`):
{{fig:generated.model-partition.distinct|int}} of
{{fig:generated.model-partition.total|int}} hypotheses are distinct over
{{fig:generated.model-partition.domain.natives|int}} sampled tuples at six
heights ({{fig:generated.model-partition.pairsChecked|int}} pairs checked).
Restricting the domain can merge members: at width 1 the thickness-relative
baseline $\lfloor1/2\rfloor=0$ equals the centre-relative one.

**Capture plan** (`research/generated/discriminating-set.json`, uniform prior of
{{fig:generated.discriminating-set.prior.entropyBits|d4}} bits,
{{fig:generated.discriminating-set.candidateCount|int}} candidate designs):

1. length {{fig:generated.discriminating-set.designs.0.native.length|int}},
   thickness {{fig:generated.discriminating-set.designs.0.native.thickness|int}},
   gap {{fig:generated.discriminating-set.designs.0.native.gap|int}}, authored
   height {{fig:generated.discriminating-set.designs.0.native.authoredHeight|int}},
   current height {{fig:generated.discriminating-set.designs.0.currentHeight|int}}:
   separates {{fig:generated.discriminating-set.designs.0.separatedPairs|int}}
   pairs with {{fig:generated.discriminating-set.designs.0.outcomes|int}}
   outcomes; it pairs each authored hypothesis with its fixed-720 twin.
2. length {{fig:generated.discriminating-set.designs.1.native.length|int}},
   thickness {{fig:generated.discriminating-set.designs.1.native.thickness|int}},
   gap {{fig:generated.discriminating-set.designs.1.native.gap|int}}, authored
   height {{fig:generated.discriminating-set.designs.1.native.authoredHeight|int}},
   current height {{fig:generated.discriminating-set.designs.1.currentHeight|int}}:
   separates {{fig:generated.discriminating-set.designs.1.separatedPairs|int}}
   pairs and adds the remaining
   {{fig:generated.discriminating-set.designs.1.newlyCoveredPairs|int}}.

## Limits

Every result is generated from the declared models under prior-only weights; the
27 hypotheses are not all possible renderers, and perfect separation of
predictions proves no hypothesis right. The shell certificate is conditional.
The plan names the most informative captures; it is not evidence that any
exists.
:::
