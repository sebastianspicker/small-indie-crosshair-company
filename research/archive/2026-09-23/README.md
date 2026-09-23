# CS2 crosshair conversion: reproducible research kit

Date: 2026-09-23. Tested game-data revision: 2000914.

**This package contains a source-based legacy geometry audit and conditional conversion
candidates. It is not a pixel-verified old-client/new-client converter. No CS2 client was
executed. No new-renderer screenshots or fitted native rendering coefficients were used.**

## Run

Python 3.10 or later; standard library only. No installation or network access required.

```sh
python crosshair_lab.py --self-test
python crosshair_lab.py --audit --output reproduced_results.json
python crosshair_lab.py --code CSGO-RLHnF-xbYw5-ZBiB5-MEOKJ-edK5O --height 1080
python crosshair_lab.py --size 1.5 --thickness 1 --gap -3 --height 960
```

Unknown share-code versions are rejected rather than decoded using the wrong field layout.
The script does not write game configs, inspect the game process, or contact any service.

## What was tested

Eight fixed pre-update pro presets, independently decoded with checksums, at seven
controlled heights: 720, 768, 960, 1024, 1080, 1440 and 2160. This gives 56 cases.
These heights are test inputs, not statements about each player's actual video settings.
All eight fixtures are static style 4 without weapon-dependent gap or outlines. NiKo's
fixture is a pure dot. karrigan's fixture includes fractional size 1.5.

The baseline is the documented CS2KZ reconstruction of the pre-update static painter:

```
L = trunc(H * old_size / 480)
W = max(1, trunc(H * old_thickness / 480))
p = trunc(old_gap + 4)
near_inner_offset = floor(W / 2) + p
far_inner_offset = near_inner_offset + 1
```

The implementation uses float32 intermediate arithmetic. `trunc` is toward zero.
This is especially important for gaps between -5 and -4.

### Calculated disagreements with the baseline

| Alternative | Length | Thickness | Either dimension | Cases |
|---|---:|---:|---:|---:|
| Round scaled values instead of truncate | 17 | 15 | 22 | 56 |
| Fixed 2x, then truncate; retain thickness minimum | 28 | 22 | 32 | 56 |
| Literal hauptrolle preview calculations | 32 | 29 | 41 | 56 |

The last row compares a fixed-coordinate browser preview against engine-pixel targets;
it is not a cross-resolution accuracy rating of that website. At 1080 only, that
preview disagrees for 3/8 fixtures. It drops karrigan's fractional length, draws zero
thickness for ZywOo, and adds a length pixel for XANTARES.

Both 960 and 1080 happen to produce identical (L,W) targets for ALL eight fixtures.
Consequently, a 2x shortcut looks perfect on this small sample at those heights, despite
failing in 32 of the 56 full-grid cases. This is quantization, not evidence of a universal 2x rule.

## Conditional post-update candidates

Use the same in-game height and confirm `cl_crosshair_screen_height` is that height.
Assume (pending measurement) one new length/thickness unit means one pixel at that
reference. Then length candidate is L. Thickness candidate is W, **except preserve
literal old thickness 0 as new thickness 0**, to retain the documented one-pixel minimum
branch when resolution changes. Positive 1 is a same-resolution alternative, not the
same scaling behavior as literal zero.

Gap cannot be established from old-only data. The JSON deliberately gives two candidates:

- If the new zero-gap near-arm baseline is floor(W/2), candidate gap is p.
- If the new zero-gap near-arm baseline is zero, candidate gap is floor(W/2)+p.

These are alternatives to test, not claims that either native geometry model was verified.
Both also assume the new far-arm +1 convention matches the old one.

More generally, measure the new near-arm inner-edge offset at new gap 0 (b), and its
pixel displacement per gap unit (s). Then solve:

```
new_gap = (old_near_inner_offset - b) / s
```

For example, after measuring b=1 and s=1 at the chosen thickness/resolution:

```sh
python crosshair_lab.py --size 1 --thickness 1 --gap -4 --height 1080 \
  --new-gap-zero-near-offset 1 --new-gap-step 1
```

Check neighboring supported values when this is fractional, and check all opposing
edges, not just total width. The script flags out-of-range values rather than silently
clamping and pretending the resulting image is identical.

Do not take a website's normalized 720-height dimensions as native convar values without
verifying its reference system and conversion. Share-code version, website reference height,
authored game height, actual playing height and pixel rounding are distinct concepts.

## Remaining evidence needed

New length/thickness unit scale, rounding, and zero-gap origin need measurements of the
actual updated client. The native old/new near/far centering rules need a paired edge
comparison for pixel-perfect identity. Outline widths, blending, dynamic styles, recoil
states, weapon-dependent gaps and different display-stretch modes are outside this audit.

Sources, pinned commits, methodology and licensing are in SOURCES.md and
LICENSE_csgo-sharecode.txt. The raw 56-case result and full decoded configurations are
in results.json. Code self-tests verify the implementation, not the updated CS2 renderer.
