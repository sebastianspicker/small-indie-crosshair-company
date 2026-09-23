# Sources and evidence boundaries

Research date: 2026-09-23. Only public source code and public match-record pages were used.

## Legacy static geometry

KZGlobalTeam, cs2kz-metamod, commit `20e376c2b1647fb34a263e13445da00fc2ca02f7`,
`src/kz/hud/layout/crosshair.cpp`:
https://github.com/KZGlobalTeam/cs2kz-metamod/blob/20e376c2b1647fb34a263e13445da00fc2ca02f7/src/kz/hud/layout/crosshair.cpp

This is a community reconstruction explicitly identifying the old client.dll painter as its
reference. It is not Valve-published native renderer source. Our numerical baseline ports its
480-height scaling, integer truncation, minimum thickness, raw-pixel gap offset, and
near/far longitudinal placement. We did not run this server plugin or either CS2 client.
Its 5%-opacity approximation and Panorama layout-class quantization are NOT used as
native rendering truth in this experiment.

## Legacy generators audited

hauptrolle, csgo-crosshair-generator, commit `5210ae71166411e9d962cf372b7b72ad94464cc2`:
https://github.com/hauptrolle/csgo-crosshair-generator/blob/5210ae71166411e9d962cf372b7b72ad94464cc2/src/components/CrosshairPreview/CrosshairPreview.js

The fixed preview uses size truncation before multiplication by two, an extra length unit
when truncated size exceeds two, un-clamped thickness times two, and cl_fixedcrosshairgap.
These are preview-coordinate calculations, NOT an independently verified CS2 renderer.
The audit implements its length/thickness calculation literally for comparison. Its gap
is excluded because it reads a different setting from classic-static cl_crosshairgap.

Skarbo, CSGOCrosshair, commit `69fe7d263aecab6a5ed6a2310cce967074fc8da0`:
https://github.com/Skarbo/CSGOCrosshair/blob/69fe7d263aecab6a5ed6a2310cce967074fc8da0/javascript/javascript.js

The inspected helpers multiply size and thickness by 19/10. This is another historical
browser preview convention, not evidence that 1.9 is an engine conversion factor. We
source-audited these helpers; we did not run the complete browser application or include
its fractional canvas dimensions in the numerical match score.

## Share-code decoding

AkiVer, csgo-sharecode, commit `753f16fe97f9bbb121fb56675b40f035ad403d05`:
https://github.com/akiver/csgo-sharecode/blob/753f16fe97f9bbb121fb56675b40f035ad403d05/src/index.ts

The standalone Python decoder follows this code's v1 field layout and checksum. It
additionally rejects unknown versions, invalid alphabet characters and oversized input.
See LICENSE_csgo-sharecode.txt for the upstream MIT license.

## Post-update variable inventory, not native rendering implementation

SteamTracking/GameTracking-CS2, build 2000914, commit
`98da94fc084706334e85fcde5105d02224e30f0a`, 2026-09-23 03:09:29 UTC:
https://github.com/SteamTracking/GameTracking-CS2/blob/98da94fc084706334e85fcde5105d02224e30f0a/DumpSource2/convars.txt

The inspected region documents cl_crosshair_length, cl_crosshair_thickness,
cl_crosshair_gap, and cl_crosshair_screen_height. It establishes ranges, intended scaling,
and the authored-height description. It does NOT expose exact rasterization, callbacks,
centering/parity, migration code, or the new share-code representation.

## Dated pro observations

The complete codes, decoded values and dates are in results.json. The eight fixtures are:

- donk: 2026-08-31, cache, https://www.xhair.pro/en/players/donk
- ZywOo: 2026-09-04, dust2, https://www.xhair.pro/en/players/zywoo
- s1mple: 2026-05-21, anubis, https://www.xhair.pro/en/players/s1mple
- NiKo: 2026-09-04, dust2, https://www.xhair.pro/en/players/niko
- m0NESY: 2026-09-04, dust2, https://www.xhair.pro/en/players/m0nesy
- ropz: 2026-09-04, dust2, https://www.xhair.pro/en/players/ropz
- XANTARES: 2026-09-20, cache, https://www.xhair.pro/en/players/xantares
- karrigan: 2026-08-27, inferno, code CSGO-Lc7iH-DjpDS-pUNGq-Yvaw7-NM6FP,
  https://www.xhair.pro/en/players/karrigan

The last fixture is deliberately an older entry in the visible history. Do not substitute
a differently dated latest code and assume its settings should match this fixture.
These dates are reported by xhair.pro; match demos were NOT downloaded or reparsed by us.

xhair.pro describes its first-hand demo-extraction pipeline at:
https://www.xhair.pro/en/methodology

## 720-height website reference

https://www.xhair.pro/en/crosshairs

On the retrieved page, xhair.pro distinguishes current vs version:1 legacy searches and
states that current dimensions use a 720px reference height. This establishes a site
coordinate convention, not proof that native game convars should be authored at 720.
We could not inspect its updated conversion implementation or fetch per-code generator
pages. No 720-based native conversion is asserted by this package.
