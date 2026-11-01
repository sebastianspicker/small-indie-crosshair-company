import { COMMUNITY_MODEL, COMMUNITY_REVISION } from '../../lib/geometry/community.js';

/** The public model name shown in labels, derived from the model id (community-static-vNN). */
export const MODEL_TAG = COMMUNITY_MODEL.version.match(/v\d+$/)[0];

export const resultLabel = status => ({ exact: 'Exact', shifted: 'Shifted 1 px', approximate: 'Approximate',
  empty: 'Empty target', excluded: 'Not scored' }[status] ?? status);
export const percent = value => value === null || value === undefined ? '—' : `${(value * 100).toFixed(2)}%`;

const REMEDY = ' Reload the page. If this stays, the bundled data and the app are from different releases: report it.';
/** The Settings data results must belong to this model revision and to the bundled settings; otherwise the page must not start. */
export function checkVersionLock(evaluation, meta) {
  if (evaluation.schema !== 'sicc-pro-conversions-v1' || evaluation.model !== COMMUNITY_MODEL.version ||
    evaluation.build !== COMMUNITY_MODEL.build || evaluation.implementationRevision !== COMMUNITY_REVISION)
    throw new Error('Conversion results do not match the current model revision.' + REMEDY);
  if (evaluation.corpusSha256 !== meta.sha256) throw new Error('Conversion results do not match the bundled settings.' + REMEDY);
}

/** Keep source records without scores visible; never treat an unsupported setting as a successful conversion. */
/** `newCohort` is the id of the latest harvest (`corpus-meta.json` expansion.cohort); `height` 1080 is the page's default test height. */
export function selectRecords(records, evaluation, { query = '', cohort = 'all', status = 'all', height = 1080, newCohort } = {}) {
  const scores = new Map(evaluation.rows.filter(row => row.height === height).map(row => [row.id, row]));
  const excluded = new Map(evaluation.excluded.map(row => [row.id, row.reason]));
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return records.filter(record => {
    const isNew = record.cohort === newCohort, score = scores.get(record.id);
    if (cohort === 'new' && !isNew || cohort === 'original' && isNew) return false;
    if (status === 'improved' && !(score?.current.alignedIou > score?.plain.alignedIou + 1e-9)) return false;
    if (!['all', 'improved'].includes(status) && (score?.current.status ?? 'excluded') !== status) return false;
    // Names are the search target; most records lack a team (835 of 1,102) or country (138). A pasted share code
    // (8+ characters) also finds its record; a short word like "4" must not match every code.
    const text = [record.player, record.team, record.country].join(' ').toLowerCase(), code = (record.code ?? '').toLowerCase();
    return words.every(word => text.includes(word) || word.length >= 8 && code.includes(word));
  }).sort((a, b) => (b.observed_date ?? '').localeCompare(a.observed_date ?? '') || a.player.localeCompare(b.player))
    .map(record => ({ record, score: scores.get(record.id) ?? null, exclusion: excluded.get(record.id) ?? null }));
}
