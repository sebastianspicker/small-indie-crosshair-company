# Structured learning and exact axis inversion

## Prespecified experiment

Protocol written before evaluating the new setting groups on September 29, 2026.
The earlier 596 setting groups are excluded. Seed 29092028 generates 320 new
settings for grouped train/validation/calibration/test partitions and another
80 settings for shared interior/exterior resolution challenges. Scope sets,
strata and hash partition rule follow the previous accuracy experiment.
Previously observed resolution shifts inform this design: only the setting
triples are fresh, not the shift families.

The ranker uses two fixed capacities: 24 depth-3 rounds or 48 depth-4 rounds,
learning rate 0.2. Validation tuple fidelity chooses capacity, with ties going
to the smaller first configuration. Refit uses train plus validation only.
The residual comparison uses the same fitting settings and the previously
selected 32 depth-4 rounds. Calibration remains reserved. Neither test nor
challenge scores select architecture, features or capacity.

Comparisons are canonical geometric preference, the frozen preceding residual
model, a fresh residual fit, its constrained projection, and the learned
structured ranker. Report exact tuple fidelity, paired rescues/damage and
setting-group bootstrap stability intervals. Report candidate recall separately.
Calibrate group-maximum errors separately for each fitted predictor, retaining
input-feature range abstention and reporting its acceptance denominators.

## Algorithms

The runtime inverse now binary-searches the monotone quantized axis. Its two
adjacent output levels contain every nearest dimension; further boundary
searches recover each entire tied plateau. Canonical integer preferences and
all pixel tie choices remain unchanged. Tests compare complete solutions with
independent exhaustive enumeration, including negative targets, zero, fractional
half ties, odd/even widths, saturation and extreme supported height ratios.
This preserves `community-static-v3`; it is an implementation optimization.

The research decoder constructs at most eight canonical legal shapes using
source arithmetic and the partial analytic inverse. Projection chooses the
nearest tuple to the existing residual predictor. The new ranker fits candidate
preference with boosted regression trees on ambiguous cases. Candidate features
contain edge residuals, pixel-cell boundary offsets and canonical distances.
Prediction reads no label, solver winner or exact overlap score. Analytic
constraints provide much of the benefit, which the projection and canonical
ablations make visible. Scores are not calibrated class probabilities.

Each candidate has equal training weight: ambiguous samples with more choices
contribute more rows. Unique-candidate inputs bypass learning. Labels must match
exactly one candidate or training stops.

Tree training now retains local sorted feature orders in descendants, avoids
copying candidate splits during scans, shares the initial sort across outputs,
and stops partitioning at the last split. Floating-point summation and tie order
are preserved so preceding trained artifacts can reproduce byte for byte.

## Results of the fixed experiment

Training contains 191 groups, validation 35, calibration 34 and test 60. Each
has 40 rows per group; both challenges contain the same 80 new triples with 16
rows each. Validation selects 48 depth-4 ranker rounds. Candidate recall is
100% in all three evaluations; this is recall under the declared model only.

| Predictor | Test (2,400 rows) | Interior (1,280 rows) | Exterior (1,280 rows) |
| --- | ---: | ---: | ---: |
| Canonical geometric preference | 91.58% | 67.27% | 94.14% |
| Frozen preceding residual | 98.29% | 71.56% | 74.77% |
| Residual, refit on new fitting groups | 97.33% | 66.02% | 80.63% |
| Same residual with legal projection | 97.75% | 73.36% | 95.70% |
| Structured learned ranker | 98.75% | 84.22% | 96.02% |

The ranker rescues 37/304/203 residual errors but damages 3/71/6 previously
correct rows, respectively. Its net gains over the same-data residual are
1.42/18.20/15.39 percentage points. Setting-group resampling stability ranges
are 0.67–2.33, 13.51–22.81 and 12.34–18.67 points. These are descriptive
stability intervals, not native correctness confidence. The new residual fit
performs worse than the frozen residual on the test and interior challenge;
new data alone is not an improvement. The exterior canonical baseline is
already strong, and most of that gain comes from enforcing analytic constraints.

Only 572/572/168 rows have multiple candidates. Mean candidate counts are
1.345/2.003125/1.175; singleton cases bypass learning. No model or design change
was made after these results were inspected.

All three calibrated predictors have group-maximum radius 1 at rank 32 of 34
calibration groups. Test intervals accept all 2,400 rows/60 groups. Interior
intervals accept 660/1,280 rows and only 5/80 complete groups. Both accepted
row and complete-group coverage are 100% in those accepted subsets. Exterior
intervals abstain on all 1,280 rows; the exterior fidelity above is a diagnostic
point-prediction score, not an accepted uncertainty claim.

The generated [artifact](../../research/generated/structured-emulator.json)
contains models, exact metrics, input/label hashes, selected configurations,
calibration and provenance. Development verification retrained the experiment
and rejected byte drift. Training implementation and tests are kept separately
from the public release, which retains the experiment protocol and artifacts.

Across the preceding 15,360-case design, runtime axis evaluations fall from
6,583,140 to 366,064 (94.44% fewer; mean 428.59 to 23.83, maximum now 41).
This excludes unchanged visual comparisons and is not a wall-clock speed claim.
The tree optimization reproduces the preceding v2/v3 model bytes; a local
8,000-row, 40-feature, three-output, 32-round depth-4 microbenchmark was about
1.31× faster (1,316 ms to 1,008 ms). Timing is machine-dependent and secondary
to the byte-equivalence verification.

## Limits

All labels imitate a declared mathematical reconstruction. There are no native
old/new capture pairs. The runtime remains exact and the ML speed gate remains
closed. Interior/exterior challenges share setting groups and are not independent
replications. Designed synthetic groups do not establish exchangeability; range
checks alone cannot validate distribution support.
