# Pro settings expansion — October 7, 2026

The app remains **0.17.0**, with public converter model **community-static-v11**.
This change expands the published-input database and its evaluation. It does not
change the solver, train a new learner, or establish native renderer accuracy.

## Source and inclusion

The [xhair.pro directory](https://www.xhair.pro/en/players) loads its public
[directory response](https://www.xhair.pro/api/seo/player-directory?v=team-context-v2).
The provider's [methodology](https://www.xhair.pro/en/methodology) describes
demo-derived records and distinguishes last observed use from current endorsement.
`research/scripts/harvest-players.mjs` retrieves that response once and saves
player names, codes, source URLs, provider-reported observation timestamps,
team and country in `research/corpus/xhair-2026-10-07.json`. It records SHA-256
fingerprints for the response bytes and retained facts. Images, Steam IDs and
third-party implementation code are not retained. Normal builds are offline.

Of 1,002 retrieved entries, 992 decode as checksum-valid legacy v1 codes.
Ten unsupported-format entries are retained in the source snapshot and listed
as exclusions in the generated metadata. Twenty-eight existing player/code
associations are skipped, using case-insensitive player names plus exact code.
The remaining **964 records** are appended without changing the original 138
records' identifiers. The corpus now has 1,102 records, 998 named players,
938 distinct codes and 334 geometry signatures: gains of 819 codes and 284
geometry signatures. Player names are source labels, not verified identities.

An observation date is the provider's timestamp, not the retrieval date or an
independently verified match date. Team is the directory attribution at retrieval;
it may differ from the player's team when the code was observed. Actual player
resolutions remain unknown. This is a convenience sample of published inputs,
not a representative sample of all players. Q03 and this harvest share xhair.pro;
Q01 and Q02 share ProCrosshairs. More rows do not mean more independent sources.

## Conversion comparison

`research/scripts/pro-conversions.mjs` tests all 1,061 static-style-4 records
without weapon-dependent gap at 720, 768, 960, 1024, 1080, 1440 and 2160 pixels
of game height: **7,427 cases**. The other 41 records stay browsable with an
explicit exclusion. Each case uses equal old, new and authored height, pixel
preservation, automatic outline choice and the default T-preservation policy.

Two paths use the same public conversion and export APIs: v11 defaults and v11
with appearance corrections disabled. Each export must pass command validation.
Scores include core, outline, colour and export overrides under the declared
renderer models. They are reproducible model predictions, not game captures.
They reuse the converter's shape check. Scene-dependent additive blending and
recoil animation are outside its scope: an exact shape score does not imply
identical brightness on a game scene, particularly with `cl_crosshairusealpha 0`.

- Exact: the same visible appearance at the same position.
- Shifted: exact only after translating the entire shape by at most one pixel.
- Approximate: some visible differences remain after alignment.
- Empty: the old target has no visible pixels; overlap is undefined.

Overlap is intersection over union of same-colour pixels. Record means weight
each visible record/height equally. Geometry means first average within each
geometry signature, then weight signatures equally; signatures intentionally
exclude colour, alpha and outline. Empty targets are excluded from means and
exact-rate denominators. Neither statistic is a confidence interval or probability
of matching the game. The Settings data filters recompute both methods over the
same selected records and test height; changing filters changes the denominator.

Across all heights, the default is exact in 3,507 cases, shifted in 3,449,
approximate in 469 and empty in two. Corrections improve aligned overlap in
196 cases and reduce it in none. The full rows, tuples, exclusions and summary
are generated in `data/pro-conversions.json`, bound to the corpus SHA-256.
Native old/new capture pairs for these player inputs: **zero**. The separate
issue #11 captures are development checks and do not validate these conversions.

## Frozen learners and reproduction

The new data are evaluation inputs only. The export and cross-check trainers
select their original three cohorts through `research/lib/frozen-corpus.js`.
This preserves their prespecified exclusions, training partitions and shipped
parameters when the browseable database expands. The new data may share
geometry with prior training or evaluation inputs; no independent-holdout claim
is made. The old-reconstruction study is regenerated over the expanded corpus.

Run `npm run research:quant` to regenerate the corpus and comparisons, then
`npm run verify` for the complete gate, including frozen learner reproduction.
The focused tests are `tests/research/pro-conversions.test.mjs` and
`tests/app/corpus-data.test.mjs`; the browser flow is
`tests/browser/corpus_browser.py`.
