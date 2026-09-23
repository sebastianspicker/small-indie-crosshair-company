# Measurement policy

**Native measurements included in this release: zero.** The examples used in the
calibration UI and browser tests are synthetic and must remain labeled synthetic.

Evidence is classified as a pinned-source statement, source-derived model,
reproduced archival calculation, synthetic test, user-entered observation, or
independently reviewed native observation. These are different kinds of evidence,
not steps an arbitrary imported file may self-certify.

## Required record

Use the app's `sicc-measurement-v1` JSON export. Its scope records game build,
current height, authored height, effective rendered thickness, style, outline and
recoil. Notes should record full resolution, stretching, weapon, stance, sample
location and whether coordinates are cells or half-open boundaries. Include
separate near/far measurements; do not halve a total opening without accounting
for centering and thickness.

A screenshot hash checks that bytes have not changed. It does not establish when,
where or how a capture was produced. An exported filename can contain personal
information, so review it. PNG inspection is manual; no arm-edge measurements are
automatically invented from image colors.

Minimum inputs for the UI's affine fit are three distinct settings. A credible
native claim additionally requires discriminating cases and independent holdouts.
Do not train and validate on the same points. R² and RMSE are descriptive summaries,
not confidence probabilities or proof of engine implementation.

## Review and storage

Store proposed observations outside the frozen archive. Use an explicit version,
source date and raw data. Never overwrite a failed experiment with a successful one.
Track exclusions and their reasons. Capture only data you have permission to share;
prefer local empty scenes that avoid other players' identities and private chats.

The v1 importer accepts only `user-entered` or `synthetic-example` provenance.
An untrusted JSON field cannot mark itself verified. A future reviewed-evidence
registry must cite reviewer decisions and immutable captures rather than weaken
this input boundary. `research/measurements/index.json` is the empty registry for
this release and is not populated with fabricated observations.

Updating a rendering model requires the code, tests, derivations, source ledger,
formula evolution and a new model identifier together. Native evidence can support
a scoped model; it need not establish universal behavior at every resolution,
style, graphics API, patch and compositing configuration.
