/**
 * Build-specific crosshair cvar inventory, as data.
 *
 * Evidence: SteamTracking / GameTracking-CS2, build 2000914, commit
 * 98da94fc084706334e85fcde5105d02224e30f0a, `DumpSource2/convars.txt`, re-read 2026-09-23.
 * Descriptions support names, ranges and which fields claim to scale. They do NOT reveal
 * the pixel arithmetic, a quantizer, a gap origin or a migration callback.
 *
 * This module is the single code source of truth for the table. Docs may quote it; do not
 * hand-copy the numbers into a second source of truth inside `lib/`.
 */
import { NATIVE_RANGES } from './native-settings.js';

export const CVAR_INVENTORY_VERSION = 'cvar-inventory-v1';
export const INVENTORY_BUILD = '2000914';
export const INVENTORY_RETRIEVED = '2026-09-23';

/** New geometry cvars. Ranges are reused from `NATIVE_RANGES`, the export validator. */
export const NEW_CVARS = Object.freeze({
  length: Object.freeze({
    name: 'cl_crosshair_length',
    default: 8,
    min: NATIVE_RANGES.length.min,
    max: NATIVE_RANGES.length.max,
    description: 'Length of each crosshair bar, scaled with screen resolution.',
    scalingStatedInDump: true,
  }),
  thickness: Object.freeze({
    name: 'cl_crosshair_thickness',
    default: 2,
    min: NATIVE_RANGES.thickness.min,
    max: NATIVE_RANGES.thickness.max,
    description: 'Thickness of the crosshair bars and circle, scaled with screen resolution (minimum 1 pixel).',
    scalingStatedInDump: true,
  }),
  gap: Object.freeze({
    name: 'cl_crosshair_gap',
    default: 4,
    min: NATIVE_RANGES.gap.min,
    max: NATIVE_RANGES.gap.max,
    // Effectively the contested statement: the dump does NOT say gap scales.
    description: 'Offset added to the gap between the crosshair center and the bars.',
    scalingStatedInDump: false,
  }),
  authoredHeight: Object.freeze({
    name: 'cl_crosshair_screen_height',
    default: 1080,
    min: NATIVE_RANGES.authoredHeightMin,
    max: null,
    description: 'Resolution at which size settings were authored; changes when a size setting is updated.',
    scalingStatedInDump: false,
  }),
});

/** Names still listed hidden in the build, with no license to export them. */
export const HIDDEN_LEFTOVERS = Object.freeze([
  Object.freeze({ name: 'cl_crosshairsize', default: 3.9, min: null, max: null, note: 'Hidden legacy size; do not export.' }),
  Object.freeze({ name: 'cl_crosshairthickness', default: 0.6, min: null, max: null, note: 'Hidden legacy thickness; do not export.' }),
  Object.freeze({ name: 'cl_crosshairalpha', default: 200, min: 0, max: 255, note: 'Hidden legacy alpha; do not export.' }),
]);

/** Absent from the 2000914 crosshair grep. Absence is a snapshot fact, not a promise. */
export const REMOVED_NAMES = Object.freeze([
  'cl_crosshairgap',
  'cl_crosshairusealpha',
  'cl_crosshaircolor',
  'cl_crosshair_outlinethickness',
  'cl_crosshairgap_useweaponvalue',
  'cl_fixedcrosshairgap',
]);

/** Style identifiers were reassigned on this build. Integer meaning is build-specific. */
export const STYLE_ON_BUILD_2000914 = Object.freeze([
  Object.freeze({ id: 0, label: 'Dynamic Cross', tracksWeaponInaccuracy: true, modeledHere: false }),
  Object.freeze({ id: 1, label: 'Dynamic Circle', tracksWeaponInaccuracy: true, modeledHere: false }),
  Object.freeze({ id: 2, label: 'Dynamic Cross (Legacy)', tracksWeaponInaccuracy: false, modeledHere: false }),
  Object.freeze({ id: 3, label: 'Static Circle', tracksWeaponInaccuracy: false, modeledHere: false }),
  Object.freeze({ id: 4, label: 'Static Cross', tracksWeaponInaccuracy: false, modeledHere: true }),
  Object.freeze({ id: 5, label: 'Static Cross (Shot Feedback)', tracksWeaponInaccuracy: false, modeledHere: false }),
  Object.freeze({ id: 6, label: 'Dot Only', tracksWeaponInaccuracy: false, modeledHere: false }),
  Object.freeze({ id: 7, label: 'Dynamic Quad', tracksWeaponInaccuracy: true, modeledHere: false }),
]);

export const STYLE_DEFAULT_ON_BUILD_2000914 = 7;
export const STYLE_MAX_ON_BUILD_2000914 = 7;

/**
 * Description-level facts, kept separate from the tables so tests and the structural
 * hypothesis can cite them without re-parsing prose. `gapScalingStatedInDump` is the
 * one that makes gap scaling a hypothesis rather than a reading of the dump.
 */
export const DUMP_DESCRIPTION_FACTS = Object.freeze({
  build: INVENTORY_BUILD,
  retrieved: INVENTORY_RETRIEVED,
  gapScalingStatedInDump: false,
  lengthScalingStatedInDump: true,
  thicknessScalingStatedInDump: true,
});
