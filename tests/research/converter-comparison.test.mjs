import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { externalNativeTuple } from '../../research/lib/external-code.js';
import { encodeLegacy } from '../../lib/settings/sharecode.js';
import { DEFAULT_SETTINGS } from '../../lib/settings/cfg.js';

test('all external tuple transcriptions reproduce from saved returned codes', async () => {
  for (const name of ['crosshair-club-2026-09-28', 'crosshair-club-holdout-2026-09-28']) {
    const fixture = JSON.parse(await readFile(new URL(`../../research/comparisons/${name}.json`, import.meta.url)));
    for (const row of fixture.cases) assert.deepEqual(externalNativeTuple(row.returnedCode), row.native, row.id);
  }
});

test('audit-only reader refuses malformed, wrong-version and corrupt responses', () => {
  assert.throws(() => externalNativeTuple('not a code'), /Malformed/);
  assert.throws(() => externalNativeTuple(encodeLegacy(DEFAULT_SETTINGS)), /version/);
  assert.throws(() => externalNativeTuple('CSGO-AyBdA-XitMv-cHv6r-qhBNu-pohyC'), /checksum/);
});
