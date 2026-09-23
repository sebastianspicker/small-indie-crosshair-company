# Build-specific settings and migration scope

Target inventory: build 2000914, pinned in [S03](source-ledger.md#s03-new-build-inventory).
This is a snapshot, not a promise that these names/ranges will remain unchanged.
The name mapping does not by itself establish a pixel conversion.

| Purpose | Old setting | New setting / treatment |
|---|---|---|
| Arm length | `cl_crosshairsize` | `cl_crosshair_length`, 0–255 |
| Thickness | `cl_crosshairthickness` | `cl_crosshair_thickness`, 0–31, described minimum one pixel |
| Gap | `cl_crosshairgap` | `cl_crosshair_gap`, 0–128; baseline unresolved |
| Opacity | `cl_crosshairalpha` + `cl_crosshairusealpha` | `cl_crosshaircolor_a`, 0–255; resolve old enabled/fallback behavior |
| Color preset | `cl_crosshaircolor` | Resolve old preset to RGB before export |
| RGB components | `cl_crosshaircolor_r/g/b` | Same component names, 0–255 |
| Dot | `cl_crosshairdot` | Retain boolean; preview shape tied to width |
| T shape | `cl_crosshair_t` | Retain boolean |
| Outline enabled | `cl_crosshair_drawoutline` | Retain toggle, not a verified width mapping |
| Outline width | `cl_crosshair_outlinethickness` | No standalone equivalent found in the new inventory |
| Follow recoil | `cl_crosshair_recoil` | Retain preference, motion not modeled |
| Weapon-dependent gap | `cl_crosshairgap_useweaponvalue` | No standalone equivalent found; conversion blocked |
| Authored resolution | No equivalent in earlier inventory | `cl_crosshair_screen_height`, minimum 240 |

The old size, thickness and alpha variables still appear hidden in the new inventory.
Existence does not prove that assigning them updates the new settings or migration
state correctly. Their native callbacks were not recovered. Export uses the new names
and avoids mixing hidden legacy geometry into the same command block.

## Style identifiers are not timeless semantics

The new inventory enumerates:

| ID | New described style | Implemented here |
|---:|---|---|
| 0 | Dynamic Cross | No |
| 1 | Dynamic Circle | No |
| 2 | Dynamic Cross (Legacy) | No time-varying model; conversion blocked |
| 3 | Static Circle | No |
| 4 | Static Cross | Yes, conditional static geometry |
| 5 | Static Cross (Shot Feedback) | No firing-feedback model; conversion blocked |
| 6 | Dot Only | Not substituted for old style-4 dot construction |
| 7 | Dynamic Quad | No |

The earlier dump describes old disabled/reassigned style meanings for some of these
identifiers. Do not preserve an integer and assume the semantics survived. The generated
static configuration explicitly selects style 4. Direct dot designs use style 4, zero
arm length and a center dot until native style-6 equivalence is measured.

## Dynamic settings that survive are not automatically calibrated

The split ratio and inner/outer alpha modifiers remain dimensionless settings in the
inventory. Split distance now has a documented 0–127 range, and a new dynamic spread
limit is also listed. Their presence does not supply native motion equations. The
legacy codec retains corresponding v1 fields where represented, but the converter does
not claim dynamic equivalence or export a fabricated dynamic model.

The sniper-width variable retains its name and description in the inspected material.
The static candidate exporter leaves it alone. Grenade crosshair settings, spectator
options, friendly warnings and scope UI are likewise outside the conversion and not
overwritten. A broad `crosshair*` reset would be an unnecessary side effect.

## Color and alpha caveats

Resolve legacy presets from their actual mapped RGB, not simply pure named colors.
With legacy alpha enabled, use its numeric alpha as the new alpha candidate. The old
community reconstruction uses 200 when alpha is disabled; do not silently reinterpret
that as 255. Native blend equivalence still requires a background-controlled test.
The custom UI color picker switches to explicit RGB and the opacity field enables an
explicit alpha value, so edits have predictable data meaning.

## Export policy

The tool generates integer settings inside its chosen native UI ranges. It includes
model version, build, source/target heights, selected gap/rounding hypotheses and any
conversion warnings in comments. It sets authored height last because the inventory
says geometry edits can update that reference. Read the values back after applying.

No config changes your game resolution, runs `exec`, changes key binds, connects to a
server, or accesses a game process. Unsupported dynamic inputs are not silently forced
to static. Out-of-range ideal geometry may receive a nearest legal suggestion, with
its error disclosed. Preserve the original config/share code independently.

## Share codes

Legacy codes are interpreted only after validating the alphabet, 18-byte envelope,
checksum and version 1. They encode parameters, not a screenshot or a reliably recorded
playing resolution. The generator never infers a player's video settings from a code.
The inverse legacy encoder rejects decimals that cannot be represented at that format's
resolution rather than silently losing precision, and preserves reserved data during
a same-code round trip.

A new code can use a similar textual prefix while having a different representation.
The repository intentionally does not guess a new code layout or claim current-format
serialization support. Export a native `.cfg` and use the game's own sharing UI for any
new-format code until that representation is independently specified and tested.
