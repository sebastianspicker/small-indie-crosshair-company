#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { countLongLines, compareToBaseline } from './line-length.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const LINE_LIMIT = 140;
const baselinePath = resolve(root, 'scripts/line-length-baseline.json');
const updateBaseline = process.argv.includes('--update-line-baseline');

let count = 0;
const lineCounts = {};

async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const f = join(path, entry.name);
    if (entry.isDirectory()) {
      await walk(f);
      continue;
    }
    if (!/\.m?js$/.test(entry.name)) continue;
    const result = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    const text = await readFile(f, 'utf8');
    const rel = relative(root, f);
    const inAppOrLib = rel.startsWith('app/') || rel.startsWith('lib/') || rel.startsWith('research/lib/');
    if (inAppOrLib && /(?:\.innerHTML\s*=|\beval\s*\(|new Function\s*\()/m.test(text)) {
      throw new Error('Unsafe dynamic execution/rendering in ' + f);
    }
    if (inAppOrLib) lineCounts[rel] = countLongLines(text, LINE_LIMIT);
    count++;
  }
}

for (const path of ['app', 'lib', 'scripts', 'tests', 'research/lib', 'research/scripts']) await walk(resolve(root, path));

if (updateBaseline) {
  const files = {};
  for (const file of Object.keys(lineCounts).sort()) {
    if (lineCounts[file] > 0) files[file] = lineCounts[file];
  }
  await writeFile(baselinePath, JSON.stringify({ limit: LINE_LIMIT, files }, null, 2) + '\n');
  console.log(`Line-length baseline updated: ${Object.keys(files).length} file(s) over ${LINE_LIMIT} characters.`);
} else {
  let baseline = { limit: LINE_LIMIT, files: {} };
  try {
    baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const [file, fileCount] of Object.entries(lineCounts)) {
    const allowed = baseline.files[file] ?? 0;
    if (fileCount < allowed) {
      console.log(`${file}: ${fileCount} lines over ${LINE_LIMIT} characters, below its baseline of ${allowed}. `
        + 'Ratchet down with --update-line-baseline.');
    }
  }
  const violations = compareToBaseline(lineCounts, baseline.files);
  if (violations.length) {
    const message = violations
      .map(v => `${v.file}: ${v.count} lines over ${LINE_LIMIT} characters exceeds its baseline of ${v.baseline}.`)
      .join('\n');
    throw new Error(`Line-length ratchet violated:\n${message}`);
  }
}

console.log(`Syntax checked ${count} JavaScript modules. App and lib contain no eval/new Function/innerHTML assignment.`);
