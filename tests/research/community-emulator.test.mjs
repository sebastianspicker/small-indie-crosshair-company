import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hash } from '../../lib/solver/statistics.js';
import { solveCommunity } from '../../lib/solver/community.js';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';
import { DATA_SEED, SCHEMA, BOUNDS, features, makeDataset, splitGroups,
  train, predict, evaluate } from '../../research/lib/community-emulator.js';

const artifact = JSON.parse(await readFile(new URL('../../research/generated/community-emulator.json',
  import.meta.url), 'utf8'));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('authored height separates otherwise identical inputs and their deterministic labels', () => {
  const settings = { size: 3, thickness: 1, gap: -2, dot: false, t_style: false };
  const a = { settings, options: { oldHeight: 1080, currentHeight: 1080, authoredHeight: 720 } };
  const b = { settings, options: { ...a.options, authoredHeight: 1080 } };
  assert.deepEqual(features(a, 'raw'), features(b, 'raw'));
  assert.notDeepEqual(features(a, 'geometry'), features(b, 'geometry'));
  assert.notDeepEqual(solveCommunity(settings, a.options).native, solveCommunity(settings, b.options).native);
});

test('dataset labels, group split, and hashes reproduce the artifact', () => {
  const { selected, samples } = makeDataset();
  const { parts, groups, groupCounts } = splitGroups(samples, hash);
  assert.equal(samples.length, 3200);
  assert.equal(selected.length, 100);
  assert.equal(artifact.seed, DATA_SEED);
  for (const name of Object.keys(parts)) {
    assert.equal(parts[name].length, artifact.training.partitions[name].samples);
    assert.equal(groupCounts[name], artifact.training.partitions[name].groups);
    assert.equal(parts[name].length, groupCounts[name] * 32);
  }
  for (const a of Object.keys(groups)) for (const b of Object.keys(groups))
    if (a !== b) assert.ok([...groups[a]].every(key => !groups[b].has(key)));
  assert.equal(digest(selected.map(([size, thickness, gap]) => `${size}/${thickness}/${gap}`)),
    artifact.training.sampledGroupsSha256);
  assert.equal(digest(samples.map(sample => [`${sample.settings.size}/${sample.settings.thickness}/${sample.settings.gap}`,
    sample.options, sample.settings.dot, sample.settings.t_style, sample.native])),
  artifact.training.labelsSha256);
});

test('fixed capacity selection and untouched test scores reproduce for both feature variants', () => {
  const { parts } = splitGroups(makeDataset().samples, hash);
  const fingerprinted = { ...artifact };
  delete fingerprinted.fingerprintSha256;
  assert.equal(digest(fingerprinted), artifact.fingerprintSha256);
  assert.equal(artifact.schema, SCHEMA);
  assert.equal(artifact.targetModel, COMMUNITY_MODEL.id);
  assert.equal(artifact.targetVersion, COMMUNITY_MODEL.version);
  assert.equal(artifact.provenance.nativeEvidence, false);
  assert.match(artifact.provenance.labels, /solveCommunity/);
  assert.equal(artifact.provenance.speedGate, 'closed-not-exact-equivalent');
  assert.deepEqual(evaluate(null, parts.test), artifact.test.naive);
  for (const variant of ['raw', 'geometry']) {
    const model = artifact.models[variant];
    assert.deepEqual(evaluate(model, parts.test), artifact.test[variant]);
    assert.ok(artifact.capacityGrid.some(config =>
      config.rounds === model.rounds && config.maxDepth === model.maxDepth &&
      config.learningRate === model.learningRate));
    const best = [...artifact.trials[variant]].sort((a, b) =>
      b.validation.exactTupleRate - a.validation.exactTupleRate ||
      a.validation.nativeMae.reduce((x, y) => x + y, 0) -
        b.validation.nativeMae.reduce((x, y) => x + y, 0))[0];
    assert.deepEqual({ rounds: model.rounds, maxDepth: model.maxDepth,
      learningRate: model.learningRate }, best.config);
    for (const sample of parts.test) {
      const native = predict(model, sample);
      for (const [key, [low, high]] of Object.entries(BOUNDS)) {
        assert.ok(Number.isInteger(native[key]) && native[key] >= low && native[key] <= high);
      }
    }
  }
  assert.ok(artifact.test.geometry.exactTupleRate > artifact.test.raw.exactTupleRate);
  assert.ok(artifact.test.raw.exactTupleRate > artifact.test.naive.exactTupleRate);
});

test('small boosted fits are deterministic', () => {
  const rows = makeDataset().samples.slice(0, 128);
  const config = { rounds: 4, maxDepth: 2, learningRate: .2 };
  assert.deepEqual(train(rows, 'geometry', config), train(rows, 'geometry', config));
});
