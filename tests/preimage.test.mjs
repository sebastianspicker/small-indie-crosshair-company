import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, getModel, forward, geometryError, targetGeometry } from '../lib/quant/renderer.js';
import { solveInverse, exactPreimage, exactPreimageForAll } from '../lib/quant/models.js';

const BASE = { style: 4, weapon_gap: false, outline: false };
const BOX = { length: [0, 40], thickness: [0, 31], gap: [0, 40] };

// A handful of declared targets and renderer hypotheses. Options chosen so the rendered target
// sits inside the reduced brute-force box (length <= 40, width <= 31).
const CASES = [
  { label: 'same-height trunc thickness',
    settings: { ...BASE, size: 2, thickness: 1, gap: -3 },
    model: 'authored:trunc:thickness', options: { oldHeight: 1080, currentHeight: 1080, authoredHeight: 1080 } },
  { label: 'half-scale trunc thickness plateau',
    settings: { ...BASE, size: 2, thickness: 1, gap: -3 },
    model: 'authored:trunc:thickness', options: { oldHeight: 1080, currentHeight: 540, authoredHeight: 1080 } },
  { label: 'opening model',
    settings: { ...BASE, size: 1, thickness: 1, gap: -4 },
    model: 'authored:trunc:opening', options: { oldHeight: 1080, currentHeight: 1080, authoredHeight: 1080 } },
  { label: 'nearest plateaus at half scale',
    settings: { ...BASE, size: 3, thickness: 1, gap: -2 },
    model: 'authored:nearest:center', options: { oldHeight: 960, currentHeight: 540, authoredHeight: 1080 } },
  { label: 'pure dot ignores edges',
    settings: { ...BASE, size: 0, thickness: 2, gap: -4 },
    model: 'authored:trunc:thickness', options: { oldHeight: 1080, currentHeight: 1080, authoredHeight: 1080 } },
];

const key = n => `${n.length}/${n.thickness}/${n.gap}`;

/** Independent oracle: forward-render every native in the box and keep the exact geometry matches. */
function bruteMatchSet(settings, options, model, box) {
  const { target, options: o } = targetGeometry(settings, options);
  const set = new Set();
  for (let length = box.length[0]; length <= box.length[1]; length++)
    for (let thickness = box.thickness[0]; thickness <= box.thickness[1]; thickness++)
      for (let gap = box.gap[0]; gap <= box.gap[1]; gap++) {
        const native = { length, thickness, gap, authoredHeight: o.authoredHeight };
        if (geometryError(forward(native, o.currentHeight, model), target) === 0) set.add(key(native));
      }
  return set;
}

/** The intervals of a preimage result, restricted to the same box, as a comparable set. */
function intervalMatchSet(result, box) {
  const set = new Set();
  for (const entry of result.byThickness) {
    if (entry.thickness < box.thickness[0] || entry.thickness > box.thickness[1]) continue;
    for (const [llo, lhi] of entry.lengths)
      for (let length = Math.max(llo, box.length[0]); length <= Math.min(lhi, box.length[1]); length++)
        for (const [glo, ghi] of entry.gaps)
          for (let gap = Math.max(glo, box.gap[0]); gap <= Math.min(ghi, box.gap[1]); gap++)
            set.add(`${length}/${entry.thickness}/${gap}`);
  }
  return set;
}

test('exact preimage intervals equal a reduced-box brute force', () => {
  for (const c of CASES) {
    const model = getModel(c.model);
    const result = exactPreimage({ settings: c.settings, options: c.options, model });
    const expected = bruteMatchSet(c.settings, c.options, model, BOX);
    assert.deepEqual([...intervalMatchSet(result, BOX)].sort(), [...expected].sort(), c.label);
  }
});

test('every sampled tuple forward-renders exactly to its target', () => {
  for (const c of CASES) {
    const model = getModel(c.model);
    const result = exactPreimage({ settings: c.settings, options: c.options, model });
    assert.ok(result.sample.length <= 64);
    const { target, options: o } = targetGeometry(c.settings, c.options);
    for (const sample of result.sample) {
      assert.equal(result.complete, true);
      assert.equal(geometryError(forward(sample, o.currentHeight, model), target), 0, `${c.label} ${JSON.stringify(sample)}`);
    }
  }
});

test('a zero-length target leaves near/far unconstrained and keeps the whole gap range', () => {
  const settings = { ...BASE, size: 0, thickness: 2, gap: -4 };
  const result = exactPreimage({ settings, options: { oldHeight: 1080 }, model: getModel('authored:trunc:thickness') });
  assert.equal(result.constrainedNearFar, false);
  assert.equal(result.target.length, 0);
  assert.deepEqual(result.byThickness.map(e => e.gaps), [[[0, 128]]]);
  assert.equal(result.count, 129);
  assert.ok(result.sample.length > 0 && result.sample.every(s => s.length === 0));
});

test('preserveZero restricts thickness to the zero branch', () => {
  const settings = { ...BASE, size: 2, thickness: 0, gap: -3 };
  const options = { oldHeight: 1080 };
  const model = getModel('authored:trunc:thickness');
  const restricted = exactPreimage({ settings, options, model, preserveZero: true });
  assert.ok(restricted.byThickness.length > 0);
  assert.ok(restricted.byThickness.every(e => e.thickness === 0));
  const full = exactPreimage({ settings, options, model });
  assert.ok(full.byThickness.some(e => e.thickness !== 0));
  assert.ok(full.count > restricted.count);
});

test('preimage is deterministic across calls', () => {
  const c = CASES[1], model = getModel(c.model);
  const args = { settings: c.settings, options: c.options, model };
  assert.deepEqual(exactPreimage(args), exactPreimage(args));
});

test('quantization plateaus produce more than one exact native tuple', () => {
  const c = CASES[1], model = getModel(c.model);
  const result = exactPreimage({ settings: c.settings, options: c.options, model });
  assert.ok(result.count > 1);
  assert.deepEqual(result.byThickness.map(e => e.thickness), [4, 5]);
  assert.deepEqual(result.byThickness[0].lengths, [[8, 9]]);
  assert.deepEqual(result.byThickness[0].gaps, [[2, 3]]);
  // 2 lengths x 2 thicknesses x 2 gaps.
  assert.equal(result.count, 8);
});

test('existing solveInverse results are unchanged', () => {
  const settings = { ...BASE, size: 2, thickness: .5, gap: -3 };
  // Three-gap example: tests/quant.test.mjs line 23.
  const s = { ...settings, size: 1, thickness: 1, gap: -4 };
  assert.deepEqual(['thickness', 'center', 'opening'].map(g =>
    solveInverse(s, { oldHeight: 1080 }, getModel('authored:trunc:' + g)).native.gap), [0, 1, 3]);
  // Literal zero remains the minimum-thickness branch: tests/quant.test.mjs line 27.
  for (const m of MODELS) {
    const n = solveInverse({ ...settings, thickness: 0 }, { oldHeight: 1080, currentHeight: 2160 }, m).native;
    assert.equal(n.thickness, 0);
    assert.equal(forward(n, 2160, m).width, 1);
  }
  // Unrepresentable bounds: tests/quant.test.mjs line 28.
  const x = solveInverse({ ...settings, size: 1000 }, { oldHeight: 1080 }, getModel('authored:trunc:thickness'));
  assert.equal(x.native.length, 255);
  assert.equal(x.solutions.length.idealInRange, false);
});

test('exactPreimageForAll covers every declared renderer in order', () => {
  const all = exactPreimageForAll({ ...BASE, size: 2, thickness: 1, gap: -3 }, { oldHeight: 1080 }, false);
  assert.equal(all.length, 27);
  assert.deepEqual(all.map(r => r.model), MODELS.map(m => m.id));
  assert.ok(all.every(r => r.complete && Array.isArray(r.byThickness) && Number.isInteger(r.count)));
});
