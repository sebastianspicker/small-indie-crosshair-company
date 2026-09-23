# Build-specific settings and migration scope

Target inventory: build 2000914, pinned in [S03](source-ledger.md#s03-new-build-inventory).
This is a snapshot, not a promise that these names/ranges will remain unchanged.
The name mapping does not by itself establish a pixel conversion.
The machine-readable source of truth for the ranges, defaults, hidden leftovers,
removed names and styles is [`lib/cvar-inventory.js`](../../lib/cvar-inventory.js);
this document quotes it and must not become a second copy.

| Purpose | Old setting | New setting / treatment |
|---|---|---|
| Arm length | `cl_crosshairsize` | `cl_crosshair_length`, 0–255, dump says scaled |
| Thickness | `cl_crosshairthickness` | `cl_crosshair_thickness`, 0–31, dump says scaled, minimum one pixel |
| Gap | `cl_crosshairgap` | `cl_crosshair_gap`, 0–128; the dump does **not** say it scales, so baseline and scaling are unresolved |
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

### Names absent from the 2000914 dump

A grep of `cl_crosshair` / `cl_fixedcrosshair` over the full `convars.txt` did not
find these names. Absence is a snapshot fact, not a promise about later builds:

- `cl_crosshairgap` — replaced in name by `cl_crosshair_gap`, and the range changed
  from a signed raw offset to 0–128.
- `cl_crosshairusealpha`
- `cl_crosshaircolor` — the preset index; the RGB components remain.
- `cl_crosshair_outlinethickness`
- `cl_crosshairgap_useweaponvalue`
- `cl_fixedcrosshairgap`

The old size, thickness and alpha variables still appear **hidden** in the new inventory
(`cl_crosshairsize` 3.9, `cl_crosshairthickness` 0.6, `cl_crosshairalpha` 200). Existence
does not prove that assigning them updates the new settings or migration state correctly.
Their native callbacks were not recovered. Export uses the new names and avoids mixing
hidden legacy geometry into the same command block.

## Style identifiers are not timeless semantics

The new inventory enumerates:

| ID | New described style | Tracks weapon inaccuracy | Implemented here |
|---:|---|---|---|
| 0 | Dynamic Cross | Yes | No |
| 1 | Dynamic Circle | Yes | No |
| 2 | Dynamic Cross (Legacy) | No time model | No; do not treat as the old classic |
| 3 | Static Circle | No | No |
| 4 | Static Cross | No | Yes, conditional static geometry |
| 5 | Static Cross (Shot Feedback) | Firing feedback, not modeled | No |
| 6 | Dot Only | No | Not substituted for old style-4 dot construction |
| 7 | Dynamic Quad (new default) | Yes | No |

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

## Post-update evidence fixes the gap sign and the shipped default

Re-read 2026-09-23. The build 2000914 dump still gives `cl_crosshair_gap 4`
(`min: 0, max: 128`), and the post-update community confirms the new variable cannot be
set negative — the top feedback request is literally "please allow negative crosshair
gaps again". So the new gap is a **non-negative integer**, exactly as
[`lib/native-settings.js`](../../lib/native-settings.js) assumes. Two consequences:

- The external `Horizzon1/cs2-crosshair-migrator` reconstruction clamps the new gap to
  -50…50. That signed clamp lies outside the build's range and is not a valid target, so
  the migrator was treated as a second community reconstruction rather than evidence and
  no code was copied from it.
- A published post-update pro-settings round-up that reports `cl_crosshair_gap -9` or
  `-7` is inconsistent with the dump and the community behavior; those entries are not
  treated as reference outputs. A reconstructed negative old offset stays
  unrepresentable: [`pixelCopyCandidate`](../../lib/migration.js) clamps it to 0 and
  discloses the residual.

The same round-up anchors the renderer. donk, m0NESY and s1mple share the old crosshair
size 1 / thickness 1 / gap -4, whose frozen old pixels at 1080 are length 2 / thickness 2
/ gap 0; the published new settings are length 2 / thickness 2 / gap 0. The `authored`
model's own inverse reproduces that tuple, and the real gap 0 selects the `thickness` gap
formula (center gives 1, opening gives 3). Across the 137 published static style-4
records, the weighted 27-model hedge instead changes the authored length in 88 cases and
carries a nonzero geometric residual in 93, versus 5 for the authored inverse.

The app's automatic choice therefore ships the authored model's pixel-exact inverse when
there are no native measurements, matching the dump's `cl_crosshair_screen_height`
mechanism. The weighted hedge stays available as an explicit option ("weighted model
hedge") and is used automatically once measurement evidence exists. This is an
application default only: [`infer()`](../../lib/quant/inference.js), the bounded search,
the declared losses and the trained artifacts are unchanged, and the default is
reversible from the same control.

The published settings are a consumer-facing reference, not a native capture pair. Zero
native old/new capture pairs still exist; the choice is conditional on the dump and the
published settings.
