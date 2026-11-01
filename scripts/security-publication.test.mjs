import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { resolvePublic } from './http-policy.mjs';
import { isPublishedPath, isSiteFile } from './site-files.mjs';

const root = resolve('publication-fixture');
test('private local documents and scratch files stay out of build and server paths', () => {
  const names = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'CODEX.md', 'THINGS_TO_DO_LEDGER.md',
    'THINGS_TO_DO_INDEX.md', 'THINGS_TO_DO_NOTES.md', 'ALPHA_AUDIT_LEDGER.md', 'ALPHA_IMPLEMENTATION_LEDGER.md', 'ALPHA_AUDIT_REPORT.md'];
  const paths = names.flatMap(name => [name, `docs/nested/${name}`, `research/${name}`]);
  paths.push('docs/codex.md', 'docs/Agents.MD', 'docs/Private/notes.md', 'app/scratch/notes.md', 'research/private/notes.md', 'docs/local-tests/fixture.js',
    'app/.agents/handoff.md', 'docs/node_modules/tool/index.js', 'public/server.key');
  for (const path of paths) {
    assert.equal(isSiteFile(root, resolve(root, path)), false, `build: ${path}`);
    assert.equal(isPublishedPath(path), false, `server: ${path}`);
  }
});

test('authored research, product records, static modules and frozen provenance remain publishable', () => {
  for (const path of ['README.md', 'app/main.js', 'docs/research/source-ledger.md',
    'docs/research/settings-migration.md', 'research/archive/2026-09-23/crosshair_lab.py',
    'docs/screenshots/converter.png', 'docs/math/mathml-cache.json']) {
    assert.equal(isSiteFile(root, resolve(root, path)), true, `build: ${path}`);
    assert.equal(isPublishedPath(path), true, `server: ${path}`);
  }
  assert.equal(isSiteFile(root, resolve(root, '../outside.md')), false);
});

test('the HTTP resolver refuses existing private files while serving authored evidence', async () => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'sicc-publication-')));
  try {
    await mkdir(join(fixture, 'docs/research'), { recursive: true });
    for (const name of ['AGENTS.md', 'CODEX.md', 'THINGS_TO_DO_NOTES.md', 'research/source-ledger.md'])
      await writeFile(join(fixture, 'docs', name), 'local fixture');
    for (const name of ['AGENTS.md', 'CODEX.md', 'codex.md', '%43ODEX.md', 'THINGS_TO_DO_NOTES.md'])
      await assert.rejects(resolvePublic(fixture, '/docs/' + name), /Private path/);
    const served = await resolvePublic(fixture, '/docs/research/source-ledger.md');
    assert.equal(served.file, join(fixture, 'docs/research/source-ledger.md'));
    assert.equal(served.mime, 'text/plain');
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
