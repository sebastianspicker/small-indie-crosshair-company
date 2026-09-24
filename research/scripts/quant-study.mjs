#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { legacyGeometry, comparators } from '../../lib/geometry/legacy.js';
import { groupedCorpus, signature } from '../../lib/solver/corpus.js';
import { MODELS, geometryError } from '../../lib/solver/renderer.js';
import { solveInverse } from '../../lib/solver/inverse.js';
import { features, ridgeFit, predictLinear } from '../../research/lib/regression.js';
import { clusterBootstrap, mean } from '../../lib/solver/statistics.js';
const root = new URL('../../', import.meta.url), read = p => readFile(new URL(p, root), 'utf8'), records = JSON.parse(await read('data/corpus.json')), meta = JSON.parse(await read('data/corpus-meta.json'));
const groups = groupedCorpus(records), rows = [], eligible = records.filter(s => s.style === 4 && !s.weapon_gap);
for (const s of eligible)
    for (const height of meta.heights) {
        const g = legacyGeometry(s, height), c = comparators(s, height);
        rows.push({ record: s.id, player: s.player, signature: signature(s), fold: groups.find(x => x.signature === signature(s)).fold, height, settings: s, target: [g.length, g.width, g.near], predictions: { source_f32: [g.length, g.width, g.near], round_scaled: [...c.round_scaled, Math.floor(c.round_scaled[1] / 2) + Math.trunc(s.gap + 4)], fixed_2x: [...c.fixed_2x, Math.floor(c.fixed_2x[1] / 2) + Math.trunc(s.gap + 4)], historical_preview: [...c.hauptrolle_preview, Math.floor(c.hauptrolle_preview[1] / 2) + Math.trunc(s.gap + 4)] } });
    }
// Split entire geometry clusters. Repeat-code colors, players, and heights cannot leak across folds.
const foldAudit = [];
for (let fold = 0; fold < 5; fold++) {
    const train = rows.filter(r => r.fold !== fold), test = rows.filter(r => r.fold === fold), counts = new Map();
    for (const r of train)
        counts.set(r.signature, (counts.get(r.signature) ?? 0) + 1);
    const X = train.map(r => features(r.settings, r.height)), weights = train.map(r => 1 / counts.get(r.signature));
    const beta = [0, 1, 2].map(k => ridgeFit(X, train.map(r => r.target[k]), weights, .01));
    for (const row of test) {
        const vals = beta.map(b => Math.floor(predictLinear(b, features(row.settings, row.height)) + .5));
        vals[0] = Math.max(0, vals[0]);
        vals[1] = Math.max(1, vals[1]);
        row.predictions.ridge_group_cv = vals;
    }
    foldAudit.push({ fold, trainRows: train.length, testRows: test.length, trainSignatures: [...new Set(train.map(r => r.signature))], testSignatures: [...new Set(test.map(r => r.signature))], beta, lambda: .01 });
}
const names = Object.keys(rows[0].predictions), ablation = names.map(name => {
    const map = new Map(), byHeight = [];
    let length = 0, width = 0, near = 0, all = 0, sq = 0;
    for (const r of rows) {
        const p = r.predictions[name], ok = p.map((v, k) => v === r.target[k]);
        length += +ok[0];
        width += +ok[1];
        near += +ok[2];
        all += +ok.every(Boolean);
        sq += p.reduce((s, v, k) => s + (v - r.target[k]) ** 2, 0);
        if (!map.has(r.signature))
            map.set(r.signature, []);
        map.get(r.signature).push(+ok.every(Boolean));
    }
    for (const height of meta.heights) {
        const rs = rows.filter(r => r.height === height);
        byHeight.push({ height, total: rs.length, exact: rs.filter(r => r.predictions[name].every((v, k) => v === r.target[k])).length });
    }
    return { name, rows: rows.length, lengthExact: length, widthExact: width, nearExact: near, allExact: all, microExact: all / rows.length, rmse: Math.sqrt(sq / (3 * rows.length)), clusterStability: clusterBootstrap([...map.values()].map(mean)), byHeight };
});
const scenarios = MODELS.map(model => { let tested = 0, exact = 0, unrepresentable = 0; for (const group of groups) {
    const s = group.representative;
    if (s.style !== 4 || s.weapon_gap)
        continue;
    for (const height of meta.heights) {
        const r = solveInverse(s, { oldHeight: height }, model);
        tested++;
        exact += Number(geometryError(r.predicted, r.target) === 0);
        unrepresentable += Number(Object.values(r.solutions).some(x => !x.idealInRange));
    }
} return { ...model, testedGeometryHeightCells: tested, exactUnderOwnGeometryModel: exact, idealOutsideRange: unrepresentable, evidence: 'synthetic inversion self-consistency only; not model selection or native validation' }; });
const summary = { schema: 'sicc-quant-study-v2', dataset: meta, eligibleRows: rows.length, excludedRecords: records.filter(s => s.style !== 4 || s.weapon_gap).map(s => ({ id: s.id, player: s.player, style: s.style, weapon_gap: s.weapon_gap })), eligibleGeometrySignatures: new Set(rows.map(r => r.signature)).size, ablations: ablation, scenarios, folds: foldAudit.map(({ beta, ...x }) => x), nativeEvidence: { calibrationCaptures: 0, holdoutCaptures: 0, actualConversionAccuracy: null }, interpretation: 'Every target in this corpus study is a source-derived legacy prediction. Cross-validation and bootstrap describe that benchmark, not undisclosed new-client rendering.' };
const detailed = { ...summary, regression: foldAudit, rows: rows.map(({ settings, ...r }) => r) };
await mkdir(new URL('research/generated/', root), { recursive: true });
for (const [path, value] of [['data/quant-summary.json', summary], ['research/generated/quant-study.json', detailed]])
    await writeFile(new URL(path, root), JSON.stringify(value, null, 2) + '\n');
const header = ['record', 'player', 'signature', 'fold', 'height', 'length', 'width', 'near', ...names.map(x => x + '_exact')];
const csv = [header.join(','), ...rows.map(r => [r.record, r.player, r.signature, r.fold, r.height, ...r.target, ...names.map(n => Number(r.predictions[n].every((v, k) => v === r.target[k])))].map(x => '"' + String(x).replaceAll('"', '""') + '"').join(','))].join('\n') + '\n';
await writeFile(new URL('research/generated/quant-study.csv', root), csv);
console.log(JSON.stringify({ records: meta.records, players: meta.players, uniqueCodes: meta.uniqueCodes, eligibleCases: rows.length, geometrySignatures: summary.eligibleGeometrySignatures, results: ablation.map(({ name, allExact, microExact, clusterStability }) => ({ name, allExact, microExact, macro: clusterStability.mean, interval: [clusterStability.lower, clusterStability.upper] })), csvSHA256: createHash('sha256').update(csv).digest('hex') }, null, 2));
