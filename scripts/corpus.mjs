#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeLegacy } from '../lib/sharecode.js';
import { signature } from '../lib/quant/corpus.js';
const root = new URL('../', import.meta.url), load = p => readFile(new URL(p, root), 'utf8');
const tsv = text => text.trim().split('\n').slice(1).map(line => { const [player, code, hltvId] = line.split('\t'); return { player, code, ...(hltvId ? { hltvId } : {}) }; });
const archive = tsv(await load('research/corpus/procrosshairs-archive.tsv'));
const original = JSON.stringify(archive.map(x => ({ name: x.player, shareCode: x.code, hltvId: x.hltvId })), null, 2);
const blobOf = s => createHash('sha1').update(`blob ${Buffer.byteLength(s)}\0`).update(s).digest('hex');
const expected = '210e17ca65ca68bd906774f4b332fe40f8487cef';
if (![original, original + '\n'].some(s => blobOf(s) === expected))
    throw new Error('Transcribed archival factual data differs from pinned upstream Git blob.');
const archiveSource = 'https://github.com/Kava4/cs2-crosshair-studio/blob/41122124c761f6602b3dd35345026c62b6a1d4b8/scripts/procrosshairs_raw.json';
const bases = [...archive.map(x => ({ ...x, cohort: 'archive-100', source: archiveSource, sourceId: 'Q01', observed_date: null, retrieved_date: '2026-09-23', reportedResolution: null, provenance: 'Pinned published pro-code collection derived from ProCrosshairs; individual match dates and player resolutions not supplied. V1 format, not independently re-parsed demos.' })),
    ...tsv(await load('research/corpus/procrosshairs-published-2026-09-23.tsv')).map(x => ({ ...x, cohort: 'published-30', source: 'https://procrosshairs.com/', sourceId: 'Q02', observed_date: null, retrieved_date: '2026-09-23', reportedResolution: null, provenance: 'Public index player/code association retrieved on this date; original match date and resolution unknown. Same upstream as Q01, not independent corroboration.' })),
    ...JSON.parse(await load('data/presets.json')).map(x => ({ ...x, cohort: 'dated-original-8', sourceId: 'S-original', reportedResolution: null, retrieved_date: '2026-09-23' }))];
const records = bases.map((x, i) => { const d = decodeLegacy(x.code); delete d._bytes; return { ...x, ...d, id: `pro-${String(i + 1).padStart(3, '0')}`, signature: signature(d), sourceDateKnown: !!x.observed_date }; });
const body = JSON.stringify(records, null, 2) + '\n', sha = createHash('sha256').update(body).digest('hex');
const meta = { schema: 'sicc-corpus-v2', snapshot: '2026-09-23', sourceArchiveGitBlob: expected, archiveTranscriptionVerified: true, records: records.length, players: new Set(records.map(x => x.player.toLowerCase())).size, uniqueCodes: new Set(records.map(x => x.code)).size, uniqueGeometrySignatures: new Set(records.map(x => x.signature)).size, datedRecords: records.filter(x => x.sourceDateKnown).length, staticSupported: records.filter(x => x.style === 4 && !x.weapon_gap).length, heights: [720, 768, 960, 1024, 1080, 1440, 2160], sha256: sha, nativeCapturePairs: 0, sourceProviders: 2, independenceWarning: 'The archive and live index share an upstream. A code is not an independent renderer observation. Controlled heights are NOT reported pro-player resolutions.' };
if (meta.players < 100 || meta.uniqueCodes < 100)
    throw new Error('Need at least 100 named players and distinct legacy codes.');
await mkdir(new URL('data/', root), { recursive: true });
await writeFile(new URL('data/corpus.json', root), body);
await writeFile(new URL('data/corpus-meta.json', root), JSON.stringify(meta, null, 2) + '\n');
console.log(meta);
