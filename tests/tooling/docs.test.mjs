import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const archiveRoot = resolve(root, 'research/archive');

test('CHANGELOG top version matches package.json', async () => {
  const changelog = await readFile(resolve(root, 'CHANGELOG.md'), 'utf8');
  const heading = changelog.match(/^##\s+(\d+\.\d+\.\d+)/m);
  assert.ok(heading, 'CHANGELOG.md has no version heading of the form "## X.Y.Z"');
  assert.equal(heading[1], pkg.version);
});

// Every Markdown file the link check covers: docs/**/*.md plus the top-level
// files agents read first. research/archive/ is a frozen, independently
// hashed snapshot (checked by npm run research:reproduce instead) and is
// excluded even though nothing under docs/ points into it.
async function markdownFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (full.startsWith(archiveRoot)) continue;
    if (entry.isDirectory()) out.push(...await markdownFiles(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const targets = [
  ...await markdownFiles(resolve(root, 'docs')),
  resolve(root, 'README.md'),
  // AGENTS.md is a local maintainer file that may be absent from a clean checkout (CI).
  ...(existsSync(resolve(root, 'AGENTS.md')) ? [resolve(root, 'AGENTS.md')] : []),
];

// Known-broken relative links that are not this change's to fix, each with a
// reason. Keep this empty when possible; a real allowlist entry documents why
// a link is intentionally left broken instead of silently weakening the check.
const ALLOWLIST = new Set([
  // 'docs/example.md -> ../missing.md  # reason',
]);

test('relative Markdown links in docs/, README.md and AGENTS.md resolve to real files', async () => {
  const broken = [];
  for (const file of targets) {
    const text = await readFile(file, 'utf8');
    const linkPattern = /\]\(([^\s)]+)\)/g;
    let match;
    while ((match = linkPattern.exec(text))) {
      const url = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(url)) continue; // external scheme: http(s), mailto, ...
      if (url.startsWith('#')) continue; // anchor-only, same document
      const [path] = url.split('#');
      if (!path) continue;
      const resolved = resolve(dirname(file), path);
      const label = `${relative(root, file)} -> ${url}`;
      if (!existsSync(resolved) && !ALLOWLIST.has(label)) broken.push(label);
    }
  }
  assert.deepEqual(broken, [], `broken relative links:\n${broken.join('\n')}`);
});
