# Exotic crosshairs and user-issue audit — 2026-10-07

This audits the local 0.19.0 working tree. It is not a claim that these changes
are deployed, that a closed issue was independently validated, or that the
reconstructed renderer matches every native frame. GitHub issue bodies and
comments were retrieved on 2026-10-07; the latest reporter comment in #11 is
from 2026-10-05.

## Reported cases

| Feedback | Local result | Remaining limit |
| --- | --- | --- |
| [#11: fractional outline/share code](https://github.com/sebastianspicker/small-indie-crosshair-company/issues/11) | The reported legacy code retains half-outline intent despite share-code quantization. Console booleans are accepted; unrelated crosshair cvars are listed and skipped. | Old outline thickness is quantized by share codes; exact lost decimals cannot be recovered. |
| [#11: size-zero `#`](https://github.com/sebastianspicker/small-indie-crosshair-company/issues/11#issuecomment-5932744145) | Recognized as `Hash (#)`, material `outline-only`, one enclosed opening. At 1080p the reconstructed shape exports length 1 / thickness 9 / gap 3, black at alpha 230, outline off; all 32 modeled pixels match. | The old capture has an unexplained +3 px horizontal offset. Old overlapping strokes also double-blend alpha. This is not an end-to-end native capture match. |
| [#11: latest tiny-dot paste and extra commands](https://github.com/sebastianspicker/small-indie-crosshair-company/issues/11#issuecomment-6001809141) | At 900p, length 1 / thickness 1 / gap 0 preserves the single visible aiming pixel. The final duplicate usealpha assignment wins. RGB and recoil are unticked when unspecified; RGB, opacity, outline mode/colour, recoil and authored height can be selected independently. | Total appearance is still 9/21 (42.9%) because the native model cannot retain the old broad outline with that aiming pixel. Required black redraw commands stay enabled for outline-only shapes; height is enabled to make the pixel sizes reproducible. |
| [#15: negative gap](https://github.com/sebastianspicker/small-indie-crosshair-company/issues/15) | The supplied three-line paste folds crossed arms instead of clamping their original geometry; corrections-off remains available and explicitly described. | Missing settings still use declared game defaults. Native crossed-arm exports lack a registered validation capture. |
| [#16: command copy](https://github.com/sebastianspicker/small-indie-crosshair-company/issues/16) | Copy/export uses one comment-free semicolon-separated console line; group selections reach the report and downloads too. Existing worst-case-length regression stays below the reported 510-character limit. | The console limit is reporter evidence, not a new measurement in this audit. |

No issue comments or state changes were submitted.

## What changed

Visible classification now distinguishes hashes, hollow squares and hollow
rectangles from ordinary crosses. Area, bounds, connected components and
edge-connected enclosed openings are measured on coordinate-compressed visible
cells. Both coloured cores and outline-only silhouettes can form these shapes.
A dot filling the centre or a missing T arm changes the topology; the cvar flag
alone does not determine the visible family. The UI names the resulting shape
and compares enclosed-opening counts. Cross/T recognition also detects exchanged
bar orientations: very short, wide arms can draw a cross even with the T flag
enabled. The chip names the visible cross while the export retains the chosen
flag. An old straddling T can now match the previous cross score while keeping T.

Screenshot analysis now tries neutral/dark colours when bright-core discovery
fails, but only accepts them as candidates when the segmented pixels themselves
form a hash or rectangular frame. A usable bright core keeps priority over its
dark outline. The original crop, 90% template fit and 98% threshold-stability
gates remain. Solid dark patches and uniform backgrounds do not qualify.
Hollow rectangles outside the symmetric template family are recognized but fail
the quality gate and receive no commands. Selected colour/centre controls remain
available for noisy, translucent or displaced captures.

The previous search explored a local neighbourhood of the original dimensions.
The new search also fits visible horizontal/vertical runs in each colour and
in the whole silhouette, with ±1 pixel neighbours and centre-spanning proposals.
It preserves explicit flags, outline choices and the existing objective. Exact
matches bypass refinement. Candidates are bounded by native ranges and need a
strict objective gain; this is not a global solver or a topology guarantee.

A deterministic 240-case synthetic A/B audit found 10 objective improvements
and no regressions or flag changes. One example (size 3, thickness .75, gap -12,
T, .01 outline; 1080p→900p screen goal, half outline) improves aligned appearance
from 52.17% to 62.67%. Some higher aligned scores have lower unshifted scores;
the two metrics remain separate. Winning cases are development regressions,
not reserved holdouts or native evidence.

## Regression evidence

- `tests/lib/exotic-crosshairs.test.mjs`: reported hash; hollow/dot/T boundaries;
  320 combinations checked against an independent dense flood-fill oracle;
  large-coordinate compressed geometry; 10 search improvements and mirror parity.
- `tests/lib/image-quality.test.mjs`: automatic black hash/hollow-square masks,
  coloured-core priority, background/solid-patch rejection and unsupported-frame
  quality rejection. These fixtures are synthetic PNG-like byte arrays.
- Existing shape/appearance suites retain zero, fractional, negative, odd/even,
  transparent, single-ink, screen-endpoint and aiming/outline alignment checks.
- `tests/browser/exotic_browser.py`: actual browser worker and commands for hash,
  hollow-square, exchanged-arm cross and tiny-dot inputs at 1440 and 390 px; no horizontal overflow.
- Legacy smoke expectations now follow the current static Mathematics page and
  scope the primary navigation independently of footer links. Converter corpus
  counts are checked against the generated artifact instead of an old literal.

The ML mirror independently scans native axes and does not call the converter's
candidate generator. Learner regeneration retains existing seeds and split
membership. Re-evaluated holdouts remain reused regression evidence.
