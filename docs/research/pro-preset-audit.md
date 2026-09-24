# Pro-preset experiment: eight codes, seven heights

**Evidence type:** numerical comparison with a source-derived old static model.
**Independent native-client observations in this experiment:** zero.

## Fixed inputs, not “current pro settings”

The source material associated the following legacy v1 codes with dated match observations
on xhair.pro. These attributions/dates are retained from the supplied archive; the
repository independently checks decoding and checksums, but did not reparse the match
demos. The karrigan entry is specifically the August 27 Inferno record, not whatever
code happens to lead a mutable player page now. Sources and map metadata are in
`data/presets.json`; full provenance is in the [source ledger](source-ledger.md).

| Player | Reported date | Size | Thickness | Gap | Dot | Exact legacy code |
|---|---|---:|---:|---:|---|---|
| donk | 2026-08-31 | 1.0 | 1.0 | -4.0 | False | `CSGO-aNQn2-upV5w-M8dOd-OOwcf-2pFKO` |
| ZywOo | 2026-09-04 | 2.0 | 0.0 | -3.0 | False | `CSGO-hzGdv-OVFPn-OarUo-OSZCY-wwXsO` |
| s1mple | 2026-05-21 | 1.0 | 1.0 | -4.5 | False | `CSGO-UseJt-3oTvn-47wPX-hEyER-WZfiK` |
| NiKo | 2026-09-04 | 0.0 | 2.0 | -4.0 | True | `CSGO-vhjbH-yLYcD-bvXQo-aswEA-8P6ZJ` |
| m0NESY | 2026-09-04 | 1.0 | 1.0 | -4.0 | False | `CSGO-EvvTA-D6U88-mXTHk-acm3G-bkMHA` |
| ropz | 2026-09-04 | 2.0 | 0.5 | -3.0 | False | `CSGO-RLHnF-xbYw5-ZBiB5-MEOKJ-edK5O` |
| XANTARES | 2026-09-20 | 3.0 | 0.5 | 0.0 | False | `CSGO-xbpe2-E24RJ-YXNuO-pQvt8-ppNAK` |
| karrigan | 2026-08-27 | 1.5 | 1.0 | -3.0 | False | `CSGO-Lc7iH-DjpDS-pUNGq-Yvaw7-NM6FP` |

All selected codes decode to style 4 with weapon-dependent gap and outline disabled.
The sample deliberately includes zero thickness (ZywOo), zero length with a dot (NiKo),
fractional negative gap (s1mple), fractional length (karrigan), and a larger/open cross
(XANTARES). The pair donk/m0NESY is intentionally not deduplicated: the original
experiment counted presets, not unique geometry families. Its weighting should not be
mistaken for a representative distribution of all possible crosshairs.

## Controlled grid

Each fixture is evaluated at heights **720, 768, 960, 1024, 1080, 1440 and 2160**. These
are controlled inputs. They are not claims of each player's actual resolution or
aspect-ratio preferences. The legacy scale uses height, and no width or monitor size
is inferred from the codes. This yields eight times seven, or 56 numerical cases.

For every case, retain the original input decimals; binary32 old geometry; three
alternative length/width pairs; and the original conditional candidate outputs in the
archive. The current JS-generated audit separately records its own source-model
results and comparator data. It is compared against the unchanged Python experiment.

## Comparators

**Round-scaled:** use the same binary32 scale and product, but round to nearest with
positive ties upward instead of truncating. Minimum width remains one.

**Fixed ×2:** multiply old size and thickness by two and truncate, keeping a one-pixel
minimum. This is deliberately resolution-independent and therefore a useful shortcut
to challenge.

**Historical hauptrolle preview:** truncate size before multiplying by two; add one
when that truncated size is greater than two; thickness is simply twice the original
parameter. This is a fixed browser-coordinate preview. Its gap reads a different
variable, so gap is excluded from numerical scoring. Skarbo's 1.9 helpers were inspected
as source evidence but its complete application was not run or scored.

## Reproduced counts

| Comparator | Length disagreements | Width disagreements | At least one |
|---|---:|---:|---:|
| Round-scaled | 17 | 15 | 22 / 56 |
| Fixed ×2 | 28 | 22 | 32 / 56 |
| hauptrolle fixed preview | 32 | 29 | 41 / 56 |

“At least one” is the union, not the sum of the first two columns. A case with both
wrong dimensions counts once there. The historical preview's cross-resolution number
is only a diagnostic comparison of coordinate conventions, not a native accuracy
ranking or a claim about the author's design intent.

At 1080p, the historical preview differs on three of the eight presets:

| Fixture | Source-model length × width | Historical preview |
|---|---:|---:|
| ZywOo | 4 × 1 | 4 × 0 |
| XANTARES | 6 × 1 | 7 × 1 |
| karrigan | 3 × 2 | 2 × 2 |

These results explain why an attractive browser preview is not automatically a valid
engine reference. Different generators choose different scales, rounding and minimum
rules; no consensus formula emerges merely because they all draw crosses.

## The identifiability trap

All eight selected presets have identical computed length and width at 960p and 1080p.
The fixed ×2 shortcut therefore agrees with the source-model dimensions for every one
at either height. That local success hides its cross-resolution failure. A discriminating
size-four fixture at 1080p produces nine pixels under the reference but eight with ×2.

These are not independent statistical samples with an estimated population error rate.
They are a deliberately structured regression/diagnostic matrix. The central finding
is logical: agreement inside a quantization bucket cannot identify the underlying
scale or rounding rule. It says even less about a new renderer that has not been observed.

## Reproduce it

```sh
npm run audit:research
python3 research/scripts/reproduce.py
```

The first writes `research/generated/audit.json` and `audit.csv` using the JS implementation.
The second checks original archive hashes, executes its 21 self-checks, reproduces its
stored result object, and compares all 56 JS geometry records to the Python reference.
`npm test` also contains individually named parity cases and separate boundary, codec,
calibration, export and range checks.

A native post-update experiment belongs in a new evidence record. Do not append a
synthetic prediction to the observations and then report an improved native match rate.
