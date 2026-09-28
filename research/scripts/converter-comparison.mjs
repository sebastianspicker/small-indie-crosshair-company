import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DEFAULT_SETTINGS } from '../../lib/settings/cfg.js';
import { infer } from '../../lib/solver/inference.js';
import { solveCommunity } from '../../lib/solver/community.js';
import { communityLegacy } from '../../lib/geometry/community.js';
import { legacyGeometry } from '../../lib/geometry/legacy.js';
import { externalNativeTuple } from '../lib/external-code.js';

const root = new URL('../../', import.meta.url);
const path = 'research/comparisons/crosshair-club-2026-09-28.json';
const bytes = await readFile(new URL(path, root)), fixture = JSON.parse(bytes);
const holdoutPath = 'research/comparisons/crosshair-club-holdout-2026-09-28.json';
const holdoutBytes = await readFile(new URL(holdoutPath, root)), holdout = JSON.parse(holdoutBytes);
const keys = ['length', 'thickness', 'gap', 'authoredHeight'];
const equal = (a, b) => keys.every(key => a[key] === b[key]);
const cases = [...fixture.cases.map(row => ({ ...row, phase: 'diagnostic' })),
  ...holdout.cases.map(row => ({ ...row, phase: 'comparison-holdout' }))].map(row => {
  if (!equal(externalNativeTuple(row.returnedCode), row.native))
    throw new Error(`External tuple transcription differs from returned code: ${row.id}`);
  const settings = { ...DEFAULT_SETTINGS, ...row.settings }, options = { oldHeight: row.height };
  const previous = infer({ settings, options, selectedModelId: 'authored:trunc:thickness' }).chosen.native;
  const current = solveCommunity(settings, options).native;
  return { id: row.id, phase: row.phase, height: row.height, expectedExternal: row.native, historicalHypothesis: previous,
    current, historicalAgreement: equal(previous, row.native), currentAgreement: equal(current, row.native) };
});
const records = JSON.parse(await readFile(new URL('data/corpus.json', root)));
const heights = JSON.parse(await readFile(new URL('data/corpus-meta.json', root))).heights;
let tested = 0, dimensionDisagreements = 0;
for (const settings of records.filter(s => s.style === 4 && !s.weapon_gap)) for (const height of heights) {
  const old = legacyGeometry(settings, height), current = communityLegacy(settings, height);
  tested++;
  if (old.length !== current.length || old.width !== current.width) dimensionDisagreements++;
}
const report = {
  schema: 'sicc-converter-comparison-v1', fixture: path,
  fixtureSha256: createHash('sha256').update(bytes).digest('hex'), source: fixture.source,
  holdoutFixture: holdoutPath, holdoutSha256: createHash('sha256').update(holdoutBytes).digest('hex'),
  retrieved: fixture.retrieved, returnedCodesVerified: true, nativeEvidence: false, nativeAccuracy: null,
  interpretation: 'Agreement with external software on diagnostic examples, not game accuracy. Corpus disagreements have no truth label.',
  cases, externalComparison: { total: cases.length,
    historicalAgreement: cases.filter(c => c.historicalAgreement).length,
    currentAgreement: cases.filter(c => c.currentAgreement).length,
    byPhase: ['diagnostic', 'comparison-holdout'].map(phase => ({ phase,
      total: cases.filter(c => c.phase === phase).length,
      currentAgreement: cases.filter(c => c.phase === phase && c.currentAgreement).length,
      historicalAgreement: cases.filter(c => c.phase === phase && c.historicalAgreement).length })) },
  oldRoundingSensitivity: { tested, dimensionDisagreements,
    weighting: 'Record-height rows; duplicate settings are retained. This is not an independent sample count.' },
};
await writeFile(new URL('research/generated/converter-comparison.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ externalComparison: report.externalComparison, oldRoundingSensitivity: report.oldRoundingSensitivity }));
