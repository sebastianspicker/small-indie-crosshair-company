# 0007 — A source-labelled static default and six visible choices

## Context

The September 28 comparison found material disagreement between the previous
default and external converter outputs. The full 27-model family was also too
large as a list of user choices. No native capture pairs are available.

## Decision

Use the independently implemented `community-static-v1` reconstruction as the
app default, citing its external evidence. Keep the historical model family and
manual lab distinct. Expose six choices: default, historical hedge and four
authored-height alternatives. Do not claim the remaining hypotheses equivalent.

Use a finite per-axis inverse that preserves bar dimensions before centre
radius. Disclose pixel-centre shifts instead of widening bars to hide them.
Keep direct evidence checks separated by build. Current reports use schema v5;
the app version advances to 0.5.0. Export remains cvars per ADR-0003.

New ML experiments must label their deterministic target and use disjoint
setting groups for training, capacity selection and testing. The improved
community emulator remains research-only under ADR-0001/0002.

## Consequences

The default no longer executes the 27-model search. Historical hypotheses remain
available to research and the optional hedge. Existing archive artifacts remain
byte-stable. External software agreement is tested separately from native
accuracy, which remains unknown. See the [audit](../../research/converter-audit-2026-09-28.md).
