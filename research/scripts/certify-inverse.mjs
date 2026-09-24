#!/usr/bin/env node
// Certify (or refuse to certify) the solver's chosen native against the DECLARED loss.
// Self-contained: every number is computed from the corpus and the declared model set.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { rankAndCertify } from '../../lib/solver/inference.js';
import { exhaustiveOptimum } from '../../lib/solver/certify.js';
import { groupedCorpus } from '../../lib/solver/corpus.js';
import { visualContext } from '../../lib/solver/visual.js';
import { infer } from '../../lib/solver/inference.js';

const root = new URL('../../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');
const corpus = JSON.parse(await read('data/corpus.json'));
const heights = [720, 1080, 1440, 2160], decisions = ['expected', 'worst'];
const limit = Number(process.env.SICC_CERTIFY_LIMIT ?? Infinity);
const fullValidation = Boolean(process.env.SICC_CERTIFY_FULL);
const probe = fullValidation ? null : { length: [0, 32], thickness: [0, 31], gap: [0, 32] };
const ruleLoss = (chosen, decision) => decision === 'worst' ? chosen.worstCaseLoss : chosen.expectedLoss;
const lossKeyOf = decision => decision === 'worst' ? 'worstCaseLoss' : 'expectedLoss';

const solvable = x => x.style === 4 && !x.weapon_gap && [1, 2, 3, 4, 5].includes(x.color) && (x.color !== 5 || (Array.isArray(x.rgb) && x.rgb.length === 3));
const skipped = corpus.filter(x => x.style === 4 && !x.weapon_gap && !solvable(x))
  .map(x => ({ id: x.id, player: x.player, reason: `Unsupported legacy color preset ${x.color}.` }));
const records = corpus.filter(solvable);

const schedule = [];
for (const settings of records) for (const height of heights) for (const decision of decisions) schedule.push({ settings, height, decision });
const chosenSchedule = Number.isFinite(limit) ? schedule.slice(0, limit) : schedule;
const tally = {}, counterexamples = [], cases = [];
for (const { settings, height, decision } of chosenSchedule) {
  const rc = rankAndCertify({ settings, options: { oldHeight: height }, decision });
  const method = rc.certificate.method;
  tally[method] = (tally[method] ?? 0) + 1;
  const record = { id: settings.id, player: settings.player, height, decision, method,
    chosen: rc.chosen.native, certifiedBest: rc.certificate.best.native,
    chosenRuleLoss: ruleLoss(rc.chosen, decision), certifiedLoss: rc.certificate.best.loss, inferredBetter: rc.inferredBetter };
  cases.push(record);
  if (rc.inferredBetter) counterexamples.push(record);
}

// Validate the shell-monotonicity assumption against an exhaustive oracle. Deliberately
// prefer counterexamples (most informative) and include shell-certified targets.
const deterministicTargets = [...counterexamples, ...cases.filter(c => c.method === 'shell-monotone')];
const seenTargets = new Set(), targets = [];
const targetCap = fullValidation ? 2 : 6;
for (const target of deterministicTargets) {
  const key = `${target.id}/${target.height}/${target.decision}`;
  if (seenTargets.has(key)) continue;
  seenTargets.add(key); targets.push(target);
  if (targets.length >= targetCap) break;
}
const checks = [];
for (const target of targets) {
  const settings = records.find(x => x.id === target.id);
  const result = infer({ settings, options: { oldHeight: target.height }, decision: target.decision });
  const visual = visualContext(result.target, settings);
  const authoredHeight = result.chosen.native.authoredHeight;
  const oracle = exhaustiveOptimum({ state: result.posterior, height: target.height, visual, decision: target.decision,
    preserveZero: settings.thickness === 0, window: probe ?? undefined, authoredHeight });
  const agrees = Math.abs(oracle.loss - target.certifiedLoss) < 1e-9;
  checks.push({ ...target, probe: probe ?? 'full-declared-domain', exhaustiveLoss: oracle.loss, exhaustiveNative: oracle.native,
    agrees, assumptionFailure: target.method === 'shell-monotone' && !agrees });
}

const certified = (tally['loss-zero'] ?? 0) + (tally['shell-monotone'] ?? 0) + (tally['domain-exhaustive'] ?? 0);
const failures = checks.filter(x => x.assumptionFailure);
const result = {
  schema: 'sicc-inverse-certification-v1', generatedBy: 'research/scripts/certify-inverse.mjs',
  snapshot: '2026-09-23', targetBuild: '2000914',
  inputs: { corpusRecords: corpus.length, eligibleRecords: records.length, skippedRecords: skipped,
    eligibleGeometryGroups: groupedCorpus(records).length, heights, decisions, caseLimit: Number.isFinite(limit) ? limit : null,
    scheduledCases: schedule.length },
  cases: cases.length,
  tally: { 'loss-zero': tally['loss-zero'] ?? 0, 'shell-monotone': tally['shell-monotone'] ?? 0,
    'domain-exhaustive': tally['domain-exhaustive'] ?? 0, unproven: tally.unproven ?? 0 },
  certifiedFraction: cases.length ? certified / cases.length : null,
  inferredBetter: { count: counterexamples.length, rate: cases.length ? counterexamples.length / cases.length : null,
    counterexamples: counterexamples.slice(0, 20) },
  shellMonotonicityCheck: { probe: probe ?? 'full-declared-domain', targets: checks.length,
    certifiedGlobal: checks.filter(x => x.method === 'shell-monotone').length, agrees: checks.filter(x => x.agrees).length,
    assumptionFailures: failures.length, checks },
  scope: 'Declared objective over the enumerated hypothesis set with prior-only weights (no native evidence). ' +
    'A shell-monotone certificate assumes loss cannot decrease once every rendered geometric distance strictly grows; ' +
    (fullValidation ? 'checked here against the full declared domain.' : 'checked here against a bounded sub-domain probe, not the full domain.') +
    ' No claim about Valve rendering or native accuracy.',
};
await mkdir(new URL('research/generated/', root), { recursive: true });
await writeFile(new URL('research/generated/inverse-certification.json', root), JSON.stringify(result, null, 2) + '\n');
const pct = x => `${(100 * x).toFixed(1)}%`;
console.log(`cases ${cases.length} | certified ${pct(result.certifiedFraction)} | ${JSON.stringify(result.tally)}`);
console.log(`inferredBetter (solver not globally optimal) ${counterexamples.length} (${pct(result.inferredBetter.rate ?? 0)})`);
console.log(`shell-monotonicity checks ${checks.length}: agrees ${checks.filter(x => x.agrees).length}, assumption failures ${failures.length}`);
