# Appendix C. Model history

One entry per version, oldest first. The research stages v0 to v5 all date from
September 23, 2026 and describe one investigation, not game updates; the
corrections C01 to C07 are in the [formula history](../research/formula-evolution.md).
Converter versions are detailed in the [changelog](../../CHANGELOG.md); the
ADR numbers name the decision records.

## Research stages (historical and manual models)

| Stage | Change |
|---|---|
| v0 | A fixed factor 2 for size and thickness: agrees on eight presets at 960 and 1080, disagrees in 32 of 56 cases over seven heights; rejected. |
| v1 | Old pixels first (`legacy-static-kz-f32-v1`, truncation, binary32), then new names; the authored height is separated from the playing height. |
| v2 | Old literal thickness 0 kept as its own branch; near and far edges and the gap origin made explicit. |
| v3 | Assumptions, ranges and residuals executable in the manual lab (`conditional-static-v4` today). |
| v4 | `quant-static-v4` (0.2.0): 27 renderer hypotheses, a 138-record corpus, grouped likelihood and holdouts for build 2000914. |
| v5 | `quant-static-v5` (0.3.0): joint thickness and gap inverse, exact cell-union overlap, robust likelihood, evidence integrity. |
| v6 | `quant-static-v6`: the frozen historical study as it ships today; certificates, decision rules and preimages are opt-in (0.4.0). |

## Converter `community-static`

| Version | Release | Change |
|---|---|---|
| v1 | 0.5.0 | Source-labelled reconstruction for build 2000918: old dimensions rounded to even, centre-radius gap, positive visible minimum, authored-height scaling; 24 of 24 crosshair.club tuples agree, against 0 of 24 for the previous default. |
| v2 | 0.6.0 | Gaps with equal radius loss resolved by exact shape overlap, bar dimensions kept. |
| v3 | 0.7.0 | All equally accurate lengths and widths compared, radius recomputed per width parity, at most eight shapes by overlap; 750 of 8,640 synthetic cases improve, none regress. 0.8.0 replaces the scans by plateau search with identical results. |
| v4 | 0.9.0 | Build 2000922: thickness up to 32; a gap that needs overlap clamps to 0 with `negative-gap-static-unverified`. |
| v5 | 0.11.0 | Ties ranked by overlap over whole-shape shifts of at most 1 px (ADR-0013). |
| v6 | 0.12.0 | Appearance rules for crossed arms, outline-only and dot-only shapes (ADR-0014); old draw order and `usealpha 0` export (ADR-0015); per-input ML cross-check (ADR-0016); appearance window at the pixel goal (ADR-0017). |
| v7 | 0.13.0 | Style 5 at-rest gap (ADR-0018); window reach from the old shape, every outline width, crossed-T flip (ADR-0019). |
| v8 | 0.14.0 | T-shape taxonomy plans the T flag (ADR-0020); optional export line groups (ADR-0021). |
| v9 | 0.15.0 | Screen targets sampled from exact integer endpoints (ADR-0023); independent RGB, opacity and outline groups (ADR-0022). |
| v10 | 0.16.0 | Appearance window at both goals, scored with the exported outline mode (ADR-0024). |
| v11 | 0.17.0 | An old T exports T by default; the option `tShape` chooses keep, auto, on or off (ADR-0025). |
