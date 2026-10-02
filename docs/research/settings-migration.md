# Build-specific settings and migration scope

Target inventory: build 2000914, pinned in [S03](source-ledger.md#s03-new-build-inventory).
Since October 1 2026 the app targets build 2000922 ([S11](source-ledger.md#s11-build-2000922-inventory));
the tables below describe the 2000914 snapshot and the update is recorded in the
[October 1 note](build-2000922-update-2026-10-01.md).
This is a snapshot, not a promise that these names/ranges will remain unchanged.
The name mapping does not by itself establish a pixel conversion.
The machine-readable source of truth for the ranges, defaults, hidden leftovers,
removed names and styles is [`lib/settings/cvars.js`](../../lib/settings/cvars.js);
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
| Outline enabled | `cl_crosshair_drawoutline` | Mode 0/1/2 from toggle and old width; not native-validated |
| Outline width | `cl_crosshair_outlinethickness` | No standalone equivalent; width below 1 → half outline (2), 1 or more → full (1); a CFG width of exactly 0 → off, but a share-code 0 (0.5-step rounding, any width below 0.5) → half (2) |
| Outline mode (opt-in override) | `cl_crosshair_drawoutline` | Export option Outline: Auto (default, mapping above), None (0), Full (1) or Half (2). Unverified in game; reports record `options.outlineMode`, add warning `outline-user-override` and mark the "What changed" rows `user-choice`. Geometry numbers do not change |
| Style target (opt-in) | `cl_crosshairstyle` | Default: old 2, 3 and 5 export Static Cross (4) with warning `style-dynamic-at-rest` (the "What changed" row is `approximated`); old 0 and 1 stay blocked. Export option "Keep the old style family (experimental)": old 2 and 3 → 2, old 5 → 5, others → 4. Old styles 2/3/5 drew exactly like style 4 at rest (leaked old source), so the at-rest numbers stay the same, but the new styles 2 and 5 are dynamic (they move with inaccuracy and shots) and their at-rest pixels are unverified. Warning `style-family-experimental`; reports record `options.styleTarget`; without the option old styles other than 4 stay blocked |
| Outline opacity | none (old outline used the crosshair alpha) | `cl_crosshairoutline_a` is set to the old crosshair opacity (255 with the outline off); verified in the old source and a user screenshot, but whether 2000922 also multiplies by `cl_crosshaircolor_a` is unverified |
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
| 2 | Dynamic Cross (Classic) | No time model | Opt-in only (experimental style target) |
| 3 | Static Circle | No | No |
| 4 | Static Cross | No | Yes, conditional static geometry |
| 5 | Dynamic Cross (Legacy/Shot Feedback) | Firing feedback, not modeled | Opt-in only (experimental style target) |
| 6 | Dot Only | No | Not substituted for old style-4 dot construction |
| 7 | Dynamic Quadrant (new default) | Yes | No |
| 8 | Static Square | No | No |
| 9 | Static Quadrant | No | No |

Labels are the build 2000922 UI strings (`uiLabel` in `lib/settings/cvars.js`). For
style 5 the convar description still says "Static Cross (Shot Feedback)" and the tooltip
"Dynamic Cross (Legacy)"; the UI label wins here and the conflict is unresolved. Before
2000922 the 2000914 dump labelled 2 "Dynamic Cross (Legacy)".

The earlier dump describes old disabled/reassigned style meanings for some of these
identifiers. Do not preserve an integer and assume the semantics survived. The generated
static configuration explicitly selects style 4 unless the user opts in to the
experimental old-family target (see the style-target row above). Direct dot designs use style 4, zero
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

## Update, October 1 2026: the gap range is signed at cvar level

Build 2000922 widens `cl_crosshair_gap` to -3840..3840 with an unchanged
description, for every style. Valve's notes scope negative gaps to the classic
dynamic style, and the Static Cross UI slider is still 0..128 (a separate
classic slider runs -10..128). The app therefore keeps the Static Cross export
range at 0..128 and clamps a negative old gap to 0 with the warning
`negative-gap-static-unverified`; the next section is a 2000914 record. Native
negative-gap behaviour on static styles is unverified; see the
[capture protocol](build-2000922-update-2026-10-01.md#native-capture-protocol).

## Post-update evidence fixes the gap sign and the shipped default (build 2000914)

Re-read 2026-09-23. The build 2000914 dump still gives `cl_crosshair_gap 4`
(`min: 0, max: 128`), and the post-update community confirms the new variable cannot be
set negative — the top feedback request is literally "please allow negative crosshair
gaps again". So the new gap is a **non-negative integer**, exactly as
[`lib/settings/native.js`](../../lib/settings/native.js) assumes. Two consequences:

- The external `Horizzon1/cs2-crosshair-migrator` reconstruction clamps the new gap to
  -50…50. That signed clamp lies outside the build's range and is not a valid target, so
  the migrator was treated as a second community reconstruction rather than evidence and
  no code was copied from it.
- A published post-update pro-settings round-up that reports `cl_crosshair_gap -9` or
  `-7` is inconsistent with the dump and the community behavior; those entries are not
  treated as reference outputs. A reconstructed negative old offset stays
  unrepresentable: [`pixelCopyCandidate`](../../lib/solver/migration.js) clamps it to 0 and
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
application default only: [`infer()`](../../lib/solver/inference.js), the bounded search,
the declared losses and the trained artifacts are unchanged, and the default is
reversible from the same control.

The published settings are a consumer-facing reference, not a native capture pair. Zero
native old/new capture pairs still exist; the choice is conditional on the dump and the
published settings.
