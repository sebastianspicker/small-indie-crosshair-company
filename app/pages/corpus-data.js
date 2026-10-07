export const resultLabel = status => ({ exact: 'Exact', shifted: 'Shifted 1 px', approximate: 'Approximate',
  empty: 'Empty target', excluded: 'Not scored' }[status] ?? status);
export const percent = value => value === null || value === undefined ? '—' : `${(value * 100).toFixed(2)}%`;

/** Keep source records without scores visible; never treat an unsupported setting as a successful conversion. */
export function selectRecords(records, evaluation, { query = '', cohort = 'all', status = 'all', height = 1080 } = {}) {
  const scores = new Map(evaluation.rows.filter(row => row.height === height).map(row => [row.id, row]));
  const excluded = new Map(evaluation.excluded.map(row => [row.id, row.reason]));
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return records.filter(record => {
    const isNew = record.cohort === 'xhair-2026-10-07', score = scores.get(record.id);
    if (cohort === 'new' && !isNew || cohort === 'original' && isNew) return false;
    if (status === 'improved' && !(score?.current.alignedIou > score?.plain.alignedIou + 1e-9)) return false;
    if (!['all', 'improved'].includes(status) && (score?.current.status ?? 'excluded') !== status) return false;
    const text = [record.player, record.team, record.country, record.code, record.signature, record.observed_date]
      .join(' ').toLowerCase();
    return words.every(word => text.includes(word));
  }).sort((a, b) => (b.observed_date ?? '').localeCompare(a.observed_date ?? '') || a.player.localeCompare(b.player))
    .map(record => ({ record, score: scores.get(record.id) ?? null, exclusion: excluded.get(record.id) ?? null }));
}
