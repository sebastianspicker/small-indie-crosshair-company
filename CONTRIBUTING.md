# Contributing

Bug fixes, clearer explanations, and reproducible measurements are welcome.
For a conversion mismatch, include the input settings, game heights, selected
model, and exported report so someone else can reproduce it.

## Development setup

Use Node.js 22.12+ and Python 3.10+. No npm packages are required.

```sh
npm run dev
npm run verify
```

For UI changes, also run the [browser checks](docs/engineering/testing.md).
`lib/` contains pure model functions; `app/` handles the DOM and worker;
`scripts/` contains local tooling. Keep imports as validated data, and keep the
app usable without accounts, remote services, or persistence.

## Before opening a pull request

- Describe the problem and the resulting behavior. Include a small reproducible case.
- Add a regression test for changed behavior. Geometry changes should cover relevant
  zero, fractional, negative, odd/even width, and resolution boundaries.
- For changes to formula families, update the model ID, affected derivations, and
  [formula history](docs/research/formula-evolution.md). Explain the source or measurements.
- Run `npm run verify`. For UI work, include screenshots and browser results.
- Regenerate research output with the scripts; do not hand-edit it. Leave the
  frozen archive and its hash manifest unchanged.

## Measurements and model claims

Use the measurement issue template and [measurement policy](docs/evidence/measurement-policy.md).
Record build, resolution, authored height, style, outline/recoil state, and uncertainty.
Supply original-scale lossless PNGs with unnecessary personal information removed.
If you crop an image, record its original dimensions and the crop offset.

Label generated observations as synthetic. Reserve independent holdouts before
fitting; do not fit against a measurement and then report it as a holdout.
A zero residual or high R² alone does not establish native renderer behavior.

Give new fields explicit units. In particular, distinguish gap settings, near/far
inner edges, full opening width, game pixels, CSS pixels, and stretched display pixels.
Preserve binary32 intermediate order and truncation toward zero in the old model.
The supported scope is stationary style 4; new styles need their own models and evidence.

## Before publishing source

Review `git diff --cached` and run a secret scan if Gitleaks is installed:

```sh
gitleaks dir . --redact
gitleaks git . --redact   # once the repository has commits
```

The ignore file excludes common local credentials and generated output. It cannot
remove a file that was already committed, and a clean scan cannot prove every
possible secret is absent. See [SECURITY.md](SECURITY.md) for reporting issues.
