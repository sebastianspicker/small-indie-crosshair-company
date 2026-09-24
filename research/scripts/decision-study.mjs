#!/usr/bin/env node
// Compare the declared decision rules on the corpus: agreement, worst-case loss and regret.
// Every target is a source-derived legacy prediction; no native capture enters this study.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { infer } from '../../lib/solver/inference.js';
import { groupedCorpus } from '../../lib/solver/corpus.js';

const root = new URL('../../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');
const corpus = JSON.parse(await read('data/corpus.json'));
const heights = [720, 1080, 1440, 2160], rules = ['expected', 'worst', 'cvar'];
const limit = Number(process.env.SICC_DECISION_LIMIT ?? Infinity);
const solvable = x => x.style === 4 && !x.weapon_gap && [1, 2, 3, 4, 5].includes(x.color) && (x.color !== 5 || (Array.isArray(x.rgb) && x.rgb.length === 3));
const skipped = corpus.filter(x => x.style === 4 && !x.weapon_gap && !solvable(x)).map(x => ({ id: x.id, player: x.player, reason: `Unsupported legacy color preset ${x.color}.` }));
const records = corpus.filter(solvable);

const nativeKey = n => `${n.length}/${n.thickness}/${n.gap}@${n.authoredHeight}`;
const schedule = [];
for (const settings of records) for (const height of heights) schedule.push({ settings, height });
const cases = [];
for (const { settings, height } of Number.isFinite(limit) ? schedule.slice(0, limit) : schedule) {
  const chosen = {}, worst = {}, expected = {};
  for (const rule of rules) {
    const report = infer({ settings, options: { oldHeight: height }, decision: rule });
    chosen[rule] = nativeKey(report.chosen.native);
    worst[rule] = report.chosen.worstCaseLoss;
    expected[rule] = report.chosen.expectedLoss;
  }
  const unique = new Set(rules.map(r => chosen[r]));
  const bestWorst = Math.min(...rules.map(r => worst[r]));
  cases.push({ id: settings.id, player: settings.player, height, chosen, worst, expected,
    agree: unique.size === 1, regret: Object.fromEntries(rules.map(r => [r, worst[r] - bestWorst])) });
}

const stat = values => values.length ? { mean: values.reduce((a, b) => a + b, 0) / values.length, max: Math.max(...values), min: Math.min(...values) } : { mean: null, max: null, min: null };
const pairDiff = (a, b) => cases.filter(c => c.chosen[a] !== c.chosen[b]).length;
const disagreement = cases.filter(c => !c.agree);
const summary = {
  schema: 'sicc-decision-study-v1', generatedBy: 'research/scripts/decision-study.mjs',
  snapshot: '2026-09-23', targetBuild: '2000914',
  inputs: { corpusRecords: corpus.length, eligibleRecords: records.length, skippedRecords: skipped,
    eligibleGeometryGroups: groupedCorpus(records).length, heights, rules, caseLimit: Number.isFinite(limit) ? limit : null, scheduledCases: schedule.length },
  cases: cases.length,
  agreement: { allRulesAgree: cases.length - disagreement.length, anyDisagreement: disagreement.length,
    disagreementRate: cases.length ? disagreement.length / cases.length : null,
    pairwiseChosenDifferent: { 'expected-worst': pairDiff('expected', 'worst'), 'expected-cvar': pairDiff('expected', 'cvar'), 'worst-cvar': pairDiff('worst', 'cvar') } },
  chosenWorstCaseLoss: Object.fromEntries(rules.map(r => [r, stat(cases.map(c => c.worst[r]))])),
  chosenExpectedLoss: Object.fromEntries(rules.map(r => [r, stat(cases.map(c => c.expected[r]))])),
  worstCaseRegret: Object.fromEntries(rules.map(r => [r, stat(cases.map(c => c.regret[r]))])),
  disagreementExamples: disagreement.slice(0, 12).map(c => ({ id: c.id, player: c.player, height: c.height, chosen: c.chosen, worstCaseLoss: c.worst })),
  scope: 'Source-derived old targets scored under 27 declared renderer hypotheses with prior-only weights. ' +
    'Agreement and regret describe the declared objective rules, not native CS2 rendering accuracy.',
};
await mkdir(new URL('research/generated/', root), { recursive: true });
await writeFile(new URL('research/generated/decision-study.json', root), JSON.stringify(summary, null, 2) + '\n');
const pct = x => `${(100 * x).toFixed(1)}%`;
console.log(`cases ${cases.length} | rules disagree ${disagreement.length} (${pct(summary.agreement.disagreementRate ?? 0)}) | pairwise ${JSON.stringify(summary.agreement.pairwiseChosenDifferent)}`);
for (const rule of rules) console.log(`${rule.padEnd(8)} worst mean ${summary.chosenWorstCaseLoss[rule].mean.toFixed(4)} max ${summary.chosenWorstCaseLoss[rule].max.toFixed(4)} | regret mean ${summary.worstCaseRegret[rule].mean.toFixed(4)} max ${summary.worstCaseRegret[rule].max.toFixed(4)}`);
