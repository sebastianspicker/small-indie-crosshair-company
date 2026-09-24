# Quant research source ledger — 2026-09-23

All dates below describe retrieval/snapshot unless an observation date is
explicitly supplied. Factual data transcription is not independently
verified native rendering evidence. Original sources and the v0.1.0 frozen
research archive remain intact.

## Q01 — Pinned 100-player archive

- Source: https://github.com/Kava4/cs2-crosshair-studio/blob/41122124c761f6602b3dd35345026c62b6a1d4b8/scripts/procrosshairs_raw.json
- Commit: `41122124c761f6602b3dd35345026c62b6a1d4b8`.
- Original Git blob SHA-1: `210e17ca65ca68bd906774f4b332fe40f8487cef`.
- Collection script: https://github.com/Kava4/cs2-crosshair-studio/blob/41122124c761f6602b3dd35345026c62b6a1d4b8/scripts/fetch_pro_crosshairs.py
- Retained facts: player name, code, HLTV identifier. The script describes
  ProCrosshairs as the upstream. No third-party implementation or art is
  copied from this repository.
- Transcription: `research/corpus/procrosshairs-archive.tsv`; rebuilt JSON
  is verified against the original Git blob in `research/scripts/corpus.mjs`.
- Limit: individual match dates, resolutions and original demos not supplied.
  Source association, not a claim of current player settings.

## Q02 — ProCrosshairs published index

- Source: https://procrosshairs.com/
- Retrieved 2026-09-23; 30 published player/code associations retained in
  `research/corpus/procrosshairs-published-2026-09-23.tsv`.
- Same upstream family as Q01, not independent corroboration.
- Individual observation dates and player resolutions are unknown.
- Page content can change. The frozen TSV and generated JSON preserve the
  facts used by this study, not an assertion that the live page is immutable.

## Q03 — Eight original dated fixtures

- Sources: player pages and methodology at https://www.xhair.pro/en/players
  and https://www.xhair.pro/en/methodology .
- Exact individual URLs, dates and codes remain in `data/presets.json` and
  the original user-supplied research archive.
- This release does not claim to reparse underlying match demos.
- The current guide https://www.xhair.pro/en/guides/how-to-import-crosshair
  discusses v1/v3 migration and resolution-dependent approximation. Its
  native conversion implementation was not obtained; it is not used as
  a hidden oracle or copied into this model.
- Historical claims about a website reference height remain downgraded in
  the previous correction ledger. Fixed 720/1080 families in this release
  are sensitivity alternatives, not confirmation of that old claim.

## Q04 — Distributed game cvars

https://github.com/SteamTracking/GameTracking-CS2/blob/98da94fc084706334e85fcde5105d02224e30f0a/DumpSource2/convars.txt

Supports new cvar names, ranges, minimum thickness and authored-height
metadata for the inspected build. Does not expose exact shader coverage,
rounding, native code-import migration, or outlines. The game data are
published through a community tracker, not a public Valve renderer source.

## Q05 — Old static-painter reconstruction

https://github.com/KZGlobalTeam/cs2kz-metamod/blob/20e376c2b1647fb34a263e13445da00fc2ca02f7/src/kz/hud/layout/crosshair.cpp

Community implementation documents the old static geometry and its scope.
It is the baseline source, not an official proof that every old native
configuration used identical arithmetic. Pinning and reproducing it makes
our baseline inspectable; independent old captures would strengthen it.

## Q06 — Audited historical preview

https://github.com/hauptrolle/csgo-crosshair-generator/blob/5210ae71166411e9d962cf372b7b72ad94464cc2/src/components/CrosshairPreview/CrosshairPreview.js

Used to audit length/thickness shortcuts. The study's `historical_preview`
combines those dimension rules with a stated legacy near-edge calculation;
it does not emulate that application's unrelated fixed-gap UI.

## Q07 — Legacy share-code format

https://github.com/akiver/csgo-sharecode/blob/753f16fe97f9bbb121fb56675b40f035ad403d05/src/index.ts

Format reference retained from the prior project, with its MIT notice in
`licenses/`. Only legacy v1 input is accepted. A checksum establishes
internal format consistency, not player identity or historical authenticity.

## Q08 — Wilson interval

NIST/SEMATECH e-Handbook:
https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm

Primary reference for binomial proportion interval reasoning. The app's
Wilson interval is scoped to user-declared independent held-out groups;
that independence is not established by merely computing the formula.

## Q09 — Browser and deployment documentation

- MDN, Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
- GitHub, custom Pages workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Actions references checked through their GitHub tag APIs on 2026-09-23:
  configure-pages v5 `983d7736d9b0ae728b81ab479565c72886d7745b`;
  upload-pages-artifact v4 `7b1f4a764d45c48632c6b24a0339c27f5614fb0b`;
  deploy-pages v4 `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`.

These support implementation/deployment choices, not renderer mathematics.
No claim that a Pages URL is live is made until an actual deployment has
succeeded and been inspected.

## Q10 — Conformal prediction boundary

Angelopoulos and Bates, *A Gentle Introduction to Conformal Prediction and
Distribution-Free Uncertainty Quantification*: https://arxiv.org/abs/2107.07511

Used to explain why synthetic old masks cannot supply guaranteed coverage
for a different native-output population. No conformal method is currently
implemented, calibrated or advertised as a product feature.

## Q11 — Learned-emulator labels (self-generated, not a source)

The learned emulator artifact `research/generated/quant-emulator.json` has no external source.
Its training labels are produced by this project's own declared automatic solver
(`infer`) over a deterministic grid of legacy settings; its forward block learns
the project's declared `forward()` renderer. It therefore distills the repository's
hypotheses and is **not** an independent observation of the native renderer. The
project ships zero native old/new capture pairs, so no emulator metric is native
accuracy and `provenance.nativeEvidence` is `false`. See chapter 10.

## Q12 — Declared-loss certification study (self-generated, not a source)

`research/generated/inverse-certification.json` has no external source. It is
produced by `research/scripts/certify-inverse.mjs` (`npm run certify:inverse`) from the
frozen corpus and the project's own declared 27-hypothesis solver: the targets,
losses, weights and certificates are declared math, and the weights are
prior-only. It records how often the shipped bounded search differs from the
declared optimum and the certificate method for each case. The `shell-monotone`
certificate rests on a documented, spot-checked (not proved) monotonicity
assumption. It is not an observation of the native renderer; no native capture
pairs exist. See chapter 11.

## Q13 — Decision, partition and capture-plan artifacts (self-generated, not sources)

These have no external source and are generated by the project's declared
models:

- `research/generated/decision-study.json` (`research/scripts/decision-study.mjs`,
  `npm run study:decision`) compares the declared `expected`, `worst` and `cvar`
  rules on source-derived targets.
- `research/generated/model-partition.json` (`research/scripts/model-partition.mjs`,
  `npm run study:partition`) partitions the 27 hypotheses by behavioural
  equivalence over a declared finite sample.
- `research/generated/discriminating-set.json`
  (`research/scripts/discriminating-set.mjs`, `npm run study:discriminating`) is a greedy
  capture **plan** whose partitions come from `forward()`. Perfect separation of
  simulated predictions is not a measurement and does not prove native
  correctness.

None of these artifacts is native evidence or a sufficient statistic for Valve's
renderer. See chapter 11.

## Q14 — Learned ranker and fragility advisory (self-generated, not sources)

`research/generated/ranker-benchmark.json` (`research/scripts/benchmark-ranker.mjs`,
`npm run bench:ranker`) benchmarks `research/lib/ranker.js` (learned shortlist plus
exact verification of the declared loss) and `research/lib/sensitivity.js` (analytic
boundary-margin advisory and an optional learned mismatch classifier). Every
label and loss comes from the project's own declared solver; the fragility model
uses schema `sicc-fragility-v1`. The artifact records a `NEGATIVE (fidelity)`
verdict for the ranker (it lost to the solver on 13 of 125 samples) and a weak
learned classifier (0.736 accuracy against a 0.704 majority baseline). Neither
is wired into inference and neither is native evidence. See chapters 10 and 11.

## Rights and independence

The new corpus is a transcription of factual associations (names, codes,
identifiers), with provenance. Third-party game names, marks, settings and
source collections are not relicensed by this project's MIT software
license. No third-party pro portraits, game backgrounds, proprietary game
binaries, or unlicensed application code are shipped. Archive and live
index records sharing an upstream are explicitly not independent samples.
