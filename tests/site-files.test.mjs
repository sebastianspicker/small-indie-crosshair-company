import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { isSiteFile } from '../scripts/site-files.mjs';

const root = resolve('fixture-site');
test('deployment omits local credentials and tooling nested in public directories', () => {
  for (const file of ['app/.DS_Store', 'docs/.env', 'docs/.env.production', 'data/credentials.json',
    'public/server.key', 'public/certificate.pem', 'docs/nested/secrets.json', 'research/__pycache__/a.pyc',
    'docs/node_modules/a/index.js', 'docs/.venv/bin/python', 'app/debug.log', 'docs/draft.md~']) {
    assert.equal(isSiteFile(root, resolve(root, file)), false, file);
  }
});
test('deployment keeps source, research, notebook cache and README screenshots', () => {
  for (const file of ['index.html', 'app', 'app/main.js', 'research/archive/2026-09-23/crosshair_lab.py',
    'docs/math/mathml-cache.json', 'docs/screenshots/converter.png', 'licenses/akiver-MIT.txt']) {
    assert.equal(isSiteFile(root, resolve(root, file)), true, file);
  }
  assert.equal(isSiteFile(root, resolve(root, '../outside.txt')), false);
});
