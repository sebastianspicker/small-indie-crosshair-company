import test from 'node:test';
import assert from 'node:assert/strict';
import { measureNativeMask } from '../lib/quant/screenshot.js';
import { posterior, residualSquared } from '../lib/quant/evidence.js';
import { getModel } from '../lib/quant/renderer.js';
import { RASTER_CONVENTION, RAW_EDGE_CONVENTION } from '../lib/raster.js';

test('synthetic literal even-width mask keeps raw edges while drawn predictions fit calibration and holdout', () => {
  const side = 129, half = 64;
  // Both captures are entered as literal pixels, without calling the renderer.
  const literalMask = boxes => {
    const data = new Uint8Array(side * side);
    for (const [x0, x1, y0, y1] of boxes) {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
        data[(y + half) * side + x + half] = 1;
    }
    return { side, data, cropped: false };
  };
  const calibrationMask = literalMask([[-9, -4, -1, 1], [4, 9, -1, 1], [-1, 1, -9, -4], [-1, 1, 4, 9]]);
  const holdoutMask = literalMask([[-10, -5, -1, 1], [5, 10, -1, 1], [-1, 1, -10, -5], [-1, 1, 5, 10]]);
  const originalCalibrationBytes = calibrationMask.data.slice(), originalHoldoutBytes = holdoutMask.data.slice();
  const measured = measureNativeMask(calibrationMask), heldOut = measureNativeMask(holdoutMask);
  assert.deepEqual(measured.geometry, { length: 5, width: 2, near: 4, far: 4 });
  assert.deepEqual(heldOut.geometry, { length: 5, width: 2, near: 5, far: 5 });
  assert.deepEqual(calibrationMask.data, originalCalibrationBytes);
  assert.deepEqual(holdoutMask.data, originalHoldoutBytes);

  const observation = (role, id, hash, gap, observed) => ({ id, kind: 'native-user', attested: true,
    role, captureGroup: id, captureSha256: hash.repeat(64), build: '2000914',
    native: { length: 5, thickness: 2, gap, authoredHeight: 1080 },
    currentHeight: 1080, sigma: .5, observed: { ...observed } });
  // These attested-shaped records exercise code paths only; the pixels are synthetic.
  const calibration = observation('calibration', 'synthetic-calibration', 'a', 3, measured.geometry);
  const holdout = observation('holdout', 'synthetic-holdout', 'b', 4, heldOut.geometry);
  assert.equal(residualSquared(calibration, getModel('authored:trunc:thickness')), 0);
  assert.equal(residualSquared(holdout, getModel('authored:trunc:thickness')), 0);
  const result = posterior([calibration, holdout]);
  assert.deepEqual(result.weights, posterior([calibration]).weights);
  assert.equal(result.validation.successes, 1);
  assert.equal(result.holdoutTests[0].topModelCorrect, true);
  assert.deepEqual(result.edgeComparison, { predicted: RASTER_CONVENTION, observed: RAW_EDGE_CONVENTION });
  assert.deepEqual(calibration.observed, measured.geometry);
  assert.deepEqual(holdout.observed, heldOut.geometry);
  assert.deepEqual(calibrationMask.data, originalCalibrationBytes);
  assert.deepEqual(holdoutMask.data, originalHoldoutBytes);
});
