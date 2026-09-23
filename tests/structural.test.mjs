import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyGeometry } from '../lib/legacy.js';
import { NEW_CVARS } from '../lib/cvar-inventory.js';
import { pixelCopyCandidate, renameCandidate, rivalSummary, structuralCandidate } from '../lib/migration.js';
import {
  structuralForward, invertStructural, enumerateReducedFamily, phiId, validatePhi,
  inverseLengthScan, inverseLengthInterval, DEFAULT_PHI,
} from '../lib/quant/structural.js';

const row1 = { size: 2, thickness: 0, gap: -4 };
const row3 = { size: 3.9, thickness: 0.6, gap: 0 };
const row5 = { size: 4, thickness: 0, gap: -5.1 };
const PHI_SCALED = { ...DEFAULT_PHI, gapScale: 'same-as-length' };
const PHI_UNSCALED = { ...DEFAULT_PHI, gapScale: 'unscaled' };

test('legacy fixtures match the frozen reconstruction', () => {
  const rows = [
    [row1, 1080, 4, 1, 0, 0, 1],
    [{ size: 4, thickness: 1, gap: -3 }, 1080, 9, 2, 1, 2, 3],
    [row3, 1080, 8, 1, 4, 4, 5],
    [{ size: 1, thickness: 1, gap: -4 }, 1080, 2, 2, 0, 1, 2],
    [row5, 1080, 9, 1, -1, -1, 0],
  ];
  for (const [settings, height, length, width, gapOffset, near, far] of rows) {
    const g = legacyGeometry(settings, height);
    assert.deepEqual([g.length, g.width, g.gapOffset, g.near, g.far], [length, width, gapOffset, near, far]);
  }
});

test('pixel copy of the size-2 fixture is the rendered old pixels', () => {
  const input = { ...row1 };
  const copy = pixelCopyCandidate(input, 1080);
  assert.equal(copy.length, 4);
  assert.equal(copy.thickness, 0);
  assert.equal(copy.gap, 0);
  assert.equal(copy.authoredHeight, 1080);
  assert.equal(copy.gapClamped, false);
  assert.equal(copy.status, 'hypothesis-not-native');
  assert.deepEqual(input, row1, 'pixelCopyCandidate must not mutate its input');
});

test('rename and pixel copy of one input disagree and are not native-correct', () => {
  const copy = pixelCopyCandidate({ ...row1 }, 1080);
  const rename = renameCandidate({ ...row1 }, 1080);
  assert.equal(rename.length, 2);
  assert.equal(rename.thickness, 0);
  assert.equal(rename.gap, 0);
  assert.notEqual(copy.length, rename.length);
  assert.equal(copy.status, 'hypothesis-not-native');
  assert.equal(rename.status, 'hypothesis-not-native');
});

test('dump defaults are a coincidence, not a migrated pair', () => {
  const copy = pixelCopyCandidate({ ...row3 }, 1080);
  // 0.6 must NOT be special-cased into the literal-zero branch.
  assert.equal(copy.thickness, 1);
  assert.equal(NEW_CVARS.thickness.default, 2);
  assert.notEqual(copy.thickness, NEW_CVARS.thickness.default,
    'coincidence-not-migration: the new default thickness 2 does not match the reconstructed width 1');
  assert.equal(copy.gap, NEW_CVARS.gap.default);
  assert.equal(copy.length, NEW_CVARS.length.default);
});

test('negative old gap offset clamps with an explicit residual', () => {
  const copy = pixelCopyCandidate({ ...row5 }, 1080);
  assert.equal(copy.gapClamped, true);
  assert.equal(copy.gap, 0);
  assert.equal(copy.unclampedGap, -1);
  assert.ok(copy.warnings.some(w => w.code === 'negative-gap-unrepresentable' && w.text.includes('-1')));
  assert.ok(copy.warnings.some(w => w.text.includes('no length shift')));
});

const PLUS_FOUR_TEST_NAME = 'plus-four-is-in-the-old-painter: rename drops the +4, pixel copy and structural inverse keep it';

test(PLUS_FOUR_TEST_NAME, () => {
  // The old painter does gapOffset = trunc(gap + 4). That +4 lives in legacyGeometry only.
  // Rename truncates the raw old console gap and drops it; pixel copy and the pixel-matching
  // structural inverse keep it. biasGap stays 0 so the offset is not added twice.
  assert.match(PLUS_FOUR_TEST_NAME, /plus-four/);
  assert.doesNotMatch(PLUS_FOUR_TEST_NAME, /native-correct/);
  const opts = { oldHeight: 1080, currentHeight: 1080, goal: 'pixels' };
  const g = legacyGeometry({ ...row3 }, 1080);
  assert.equal(g.gapOffset, 4);
  assert.equal(g.width, 1);
  const copy = pixelCopyCandidate({ ...row3 }, 1080);
  assert.equal(copy.gap, 4);
  assert.equal(copy.thickness, 1, '0.6 truncates to a one-pixel width, not the literal zero branch');
  const rename = renameCandidate({ ...row3 }, 1080);
  const structural = invertStructural({ ...row3 }, opts, DEFAULT_PHI);
  assert.equal(rename.gap, 0);
  assert.notEqual(copy.gap, rename.gap);
  assert.equal(structural.native.gap, 4);
  assert.equal(DEFAULT_PHI.biasGap, 0);
});

test('the size-2 structural inverse matches the locked shipped tuple', () => {
  const structural = invertStructural({ ...row1 }, { oldHeight: 1080, currentHeight: 1080, goal: 'pixels' }, DEFAULT_PHI);
  assert.deepEqual(structural.native, { length: 4, thickness: 0, gap: 0, authoredHeight: 1080 });
});

test('a negative old gap offset stays unrepresentable in the structural inverse', () => {
  const copy = pixelCopyCandidate({ ...row5 }, 1080);
  assert.equal(copy.gapClamped, true);
  assert.equal(copy.unclampedGap, -1);
  const structural = invertStructural({ ...row5 }, { oldHeight: 1080, currentHeight: 1080, goal: 'pixels' }, DEFAULT_PHI);
  assert.equal(structural.native.gap, 0);
  // Do not assert the near residual is 0: a negative old offset cannot be stored in a 0–128 cvar.
});

test('rival summary lists four hypotheses and never selects one', () => {
  const chosen = { length: 4, thickness: 0, gap: 0, authoredHeight: 1080 };
  const settings = { ...row1 };
  const options = { oldHeight: 1080, currentHeight: 1080, goal: 'pixels' };
  const rows = rivalSummary(settings, options, chosen);
  assert.equal(rows.length, 4);
  const shipped = rows[0];
  assert.equal(shipped.kind, 'shipped');
  assert.equal(shipped.status, 'conditional-not-game-validated');
  assert.deepEqual(shipped.native, chosen);
  assert.notEqual(shipped.native, chosen, 'shipped native must be a copy, not the caller object');
  const rename = rows.find(r => r.kind === 'rename');
  const copy = rows.find(r => r.kind === 'pixel-copy');
  const unscaled = rows.find(r => r.kind === 'structural-unscaled');
  assert.equal(rename.length, 2);
  assert.equal(copy.length, 4);
  assert.notEqual(rename.length, copy.length);
  for (const row of [rename, copy, unscaled]) assert.equal(row.status, 'hypothesis-not-native');
  // Ratio 1 is non-identifying: both gap scales agree here, so this is not evidence of scaling.
  assert.equal(unscaled.native.gap, shipped.native.gap);
  assert.deepEqual(chosen, { length: 4, thickness: 0, gap: 0, authoredHeight: 1080 },
    'rivalSummary must not mutate chosenNative');
  assert.deepEqual(settings, row1, 'rivalSummary must not mutate settings');

  // §2.4 stored cvars at 1080 authored / 2160 current: same-as-length near 4, unscaled near 3.
  const stored = { length: 9, thickness: 2, gap: 1, authoredHeight: 1080 };
  const scaledForward = structuralForward(stored, 2160, PHI_SCALED);
  const unscaledForward = structuralForward(stored, 2160, PHI_UNSCALED);
  assert.equal(scaledForward.near, 4);
  assert.equal(unscaledForward.near, 3);
  assert.notEqual(unscaledForward.near, scaledForward.near,
    'the unscaled rival predicted near must differ from the same-as-length predicted near');

  // The displayed unscaled rival really is that unscaled hypothesis and replays its own forward.
  const rows2160 = rivalSummary({ ...row1 }, { ...options, currentHeight: 2160 }, chosen);
  const unscaled2160 = rows2160.find(r => r.kind === 'structural-unscaled');
  assert.equal(unscaled2160.phi.gapScale, 'unscaled');
  const replay = structuralForward(unscaled2160.native, 2160, unscaled2160.phi);
  assert.equal(replay.near, unscaled2160.predicted.near);
  assert.equal(replay.length, unscaled2160.predicted.length);
});

test('scaled and unscaled gap disagreement at 1080 authored / 2160 current', () => {
  const stored = { length: 9, thickness: 2, gap: 1, authoredHeight: 1080 };
  const scaled = structuralForward(stored, 2160, PHI_SCALED);
  const unscaled = structuralForward(stored, 2160, PHI_UNSCALED);
  assert.equal(scaled.width, 4);
  assert.equal(scaled.near, 4);
  assert.equal(unscaled.width, 4);
  assert.equal(unscaled.near, 3);
  assert.notEqual(scaled.near, unscaled.near);
});

test('at 1080 authored and current, both gap scales agree', () => {
  const stored = { length: 9, thickness: 2, gap: 1, authoredHeight: 1080 };
  const scaled = structuralForward(stored, 1080, PHI_SCALED);
  const unscaled = structuralForward(stored, 1080, PHI_UNSCALED);
  assert.equal(scaled.near, 2);
  assert.equal(unscaled.near, 2);
  assert.equal(scaled.near, unscaled.near); // agreement at r = 1 is non-identifying
});

test('structural forward rejects out-of-range cvars and unsupported hypotheses', () => {
  const stored = { length: 9, thickness: 2, gap: 1, authoredHeight: 1080 };
  assert.throws(() => structuralForward({ ...stored, gap: 129 }, 2160, DEFAULT_PHI));
  assert.throws(() => structuralForward({ ...stored, thickness: 32 }, 2160, DEFAULT_PHI));
  assert.throws(() => structuralForward({ ...stored, length: -1 }, 2160, DEFAULT_PHI));
  assert.throws(() => structuralForward(stored, 2160, { ...DEFAULT_PHI, biasGap: 0.5 }));
  assert.throws(() => structuralForward(stored, 2160, { ...DEFAULT_PHI, gapScale: 'magic' }));
  assert.throws(() => structuralForward(stored, 2160, { ...DEFAULT_PHI, farDelta: 2 }));
  assert.throws(() => structuralForward(stored, 100.5, DEFAULT_PHI));
  assert.throws(() => validatePhi({ ...DEFAULT_PHI, quantLength: 'round' }));
});

test('zero thickness stays the one-pixel branch at height 2160', () => {
  const stored = { length: 9, thickness: 0, gap: 1, authoredHeight: 1080 };
  assert.equal(structuralForward(stored, 2160, DEFAULT_PHI).width, 1);
  assert.equal(structuralForward(stored, 2160, { ...DEFAULT_PHI, zeroBranch: 'positive-minimum' }).width, 1);
});

test('a positive stored thickness of 1 renders 2 pixels at r = 2', () => {
  const stored = { length: 9, thickness: 1, gap: 1, authoredHeight: 1080 };
  assert.equal(structuralForward(stored, 2160, DEFAULT_PHI).width, 2);
});

test('the reduced family has 24 hypotheses with distinct ids', () => {
  const family = enumerateReducedFamily();
  assert.equal(family.length, 24);
  assert.equal(new Set(family.map(phiId)).size, 24);
  assert.ok(family.every(p => p.thicknessRef === p.lengthRef));
  assert.ok(family.every(p => p.quantLength === p.quantThickness && p.quantThickness === p.quantGap));
  assert.ok(family.some(p => p.gapScale === 'unscaled') && family.some(p => p.gapScale === 'same-as-length'));
});

test('structural inverse warns about the unresolved gap scale', () => {
  const result = invertStructural({ ...row1 }, { oldHeight: 1080, currentHeight: 2160, goal: 'pixels' }, DEFAULT_PHI);
  assert.equal(result.status, 'hypothesis-not-native');
  assert.ok(result.warnings.some(w => w.code === 'gap-scale-unresolved'));
  assert.ok(result.warnings.some(w => w.text.includes('unscaled-gap rival')));
  const rival = invertStructural({ ...row1 }, {}, PHI_UNSCALED);
  assert.ok(rival.warnings.some(w => w.code === 'gap-scale-rival'));
  assert.ok(rival.warnings.some(w => w.text.includes('length-scaled rival')));
});

test('structural inverse predicts its own native tuple and is scope-limited', () => {
  for (const height of [720, 1080, 1440, 2160]) {
    const result = invertStructural({ ...row1 }, { oldHeight: 1080, currentHeight: height, goal: 'pixels' }, DEFAULT_PHI);
    const replay = structuralForward(result.native, height, result.phi);
    assert.deepEqual([replay.length, replay.width, replay.near, replay.far],
      [result.predicted.length, result.predicted.width, result.predicted.near, result.predicted.far]);
    assert.ok(result.assumptions.includes('authored height was supplied, not identified'));
    assert.match(result.scope, /not native validation/);
  }
});

test('structuralCandidate wraps the inverse with a named kind', () => {
  const candidate = structuralCandidate({ ...row1 }, {}, DEFAULT_PHI);
  assert.equal(candidate.kind, 'structural');
  assert.equal(candidate.status, 'hypothesis-not-native');
  assert.ok(Number.isInteger(candidate.native.length));
});

test('interval length inverse equals the full scan on 200 deterministic samples', () => {
  let seed = 0x9e3779b9;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const ratios = [1, 1080 / 1440, 2160 / 1080, 720 / 1080];
  for (let i = 0; i < 200; i++) {
    const r = ratios[i % ratios.length];
    const target = i % 5 === 0 ? 0 : i % 7 === 0 ? 255 : Math.floor(next() * 300) - 10;
    const quant = i % 2 === 0 ? 'trunc' : 'nearest';
    const interval = inverseLengthInterval(target, r, quant, 255);
    const scan = inverseLengthScan(target, r, quant, 255);
    assert.equal(interval.value, scan.value, `interval ${interval.value} != scan ${scan.value} at r=${r} target=${target} ${quant}`);
    assert.equal(interval.predicted, scan.predicted);
  }
});

test('interval length inverse covers the documented boundaries', () => {
  for (const r of [1, 1080 / 1440, 2160 / 1080, 720 / 1080]) {
    for (const quant of ['trunc', 'nearest']) {
      for (const target of [0, 1, 254, 255]) {
        assert.equal(inverseLengthInterval(target, r, quant, 255).value, inverseLengthScan(target, r, quant, 255).value);
      }
    }
  }
});
