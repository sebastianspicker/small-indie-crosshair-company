import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEW_CVARS, HIDDEN_LEFTOVERS, REMOVED_NAMES, STYLE_ON_BUILD_2000914,
  STYLE_DEFAULT_ON_BUILD_2000914, STYLE_MAX_ON_BUILD_2000914,
  DUMP_DESCRIPTION_FACTS, INVENTORY_BUILD, INVENTORY_RETRIEVED,
} from '../../lib/settings/cvars.js';
import { NATIVE_RANGES } from '../../lib/settings/native.js';
import { TARGET_BUILD } from '../../lib/manual/conversion.js';
import { BUILD } from '../../lib/solver/renderer.js';

test('inventory ranges match the build 2000914 dump', () => {
  assert.equal(NEW_CVARS.length.max, 255);
  assert.equal(NEW_CVARS.thickness.max, 31);
  assert.equal(NEW_CVARS.gap.min, 0);
  assert.equal(NEW_CVARS.gap.max, 128);
  assert.equal(NEW_CVARS.authoredHeight.min, 240);
  assert.equal(STYLE_MAX_ON_BUILD_2000914, 7);
  assert.equal(STYLE_DEFAULT_ON_BUILD_2000914, 7);
  assert.equal(INVENTORY_BUILD, '2000914');
  assert.equal(INVENTORY_RETRIEVED, '2026-09-23');
});

// The manual lab (conversion.js TARGET_BUILD), the automatic renderer (renderer.js BUILD) and
// this inventory (INVENTORY_BUILD) each declare their own build id: three separate facts about
// the same CS2 build, not one shared source of truth, that must be changed deliberately together.
test('the manual, automatic and inventory build ids agree today', () => {
  assert.equal(TARGET_BUILD, INVENTORY_BUILD);
  assert.equal(BUILD, INVENTORY_BUILD);
});

test('export validator and inventory share one range object', () => {
  assert.equal(NEW_CVARS.length.min, NATIVE_RANGES.length.min);
  assert.equal(NEW_CVARS.thickness.max, NATIVE_RANGES.thickness.max);
  assert.equal(NEW_CVARS.gap.max, NATIVE_RANGES.gap.max);
  assert.equal(NEW_CVARS.authoredHeight.min, NATIVE_RANGES.authoredHeightMin);
});

test('the dump does not state that gap scales', () => {
  assert.equal(DUMP_DESCRIPTION_FACTS.gapScalingStatedInDump, false);
  assert.equal(DUMP_DESCRIPTION_FACTS.lengthScalingStatedInDump, true);
  assert.equal(DUMP_DESCRIPTION_FACTS.thicknessScalingStatedInDump, true);
});

test('removed names are recorded exactly once each', () => {
  for (const name of ['cl_crosshairgap', 'cl_crosshairusealpha', 'cl_crosshaircolor',
    'cl_crosshair_outlinethickness', 'cl_crosshairgap_useweaponvalue', 'cl_fixedcrosshairgap']) {
    assert.ok(REMOVED_NAMES.includes(name), `missing removed name ${name}`);
  }
});

test('hidden leftovers are recorded and are not new cvars', () => {
  const names = HIDDEN_LEFTOVERS.map(x => x.name);
  for (const name of ['cl_crosshairsize', 'cl_crosshairthickness', 'cl_crosshairalpha'])
    assert.ok(names.includes(name), `missing hidden leftover ${name}`);
  for (const hidden of HIDDEN_LEFTOVERS)
    assert.ok(!Object.values(NEW_CVARS).some(c => c.name === hidden.name), `${hidden.name} must not be a new cvar`);
});

test('style 4 is Static Cross and style 2 is not Classic', () => {
  const style = id => STYLE_ON_BUILD_2000914.find(x => x.id === id);
  assert.equal(style(4).label, 'Static Cross');
  assert.equal(style(4).modeledHere, true);
  assert.ok(!/Classic/.test(style(2).label));
  assert.equal(STYLE_ON_BUILD_2000914.length, STYLE_MAX_ON_BUILD_2000914 + 1);
  assert.equal(style(STYLE_DEFAULT_ON_BUILD_2000914).label, 'Dynamic Quad');
});
