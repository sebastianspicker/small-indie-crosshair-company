import { $, el, download, docLink, table, sheetHead } from '../ui/dom.js';
import { loadCorpusPage } from '../data.js';
import { summarizeConversions } from '../../lib/solver/corpus-metrics.js';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';
import { selectRecords, percent, resultLabel } from './corpus-data.js';
import { showRecord } from './corpus-detail.js';

const option = (value, label) => el('option', { value }, label);
const control = (title, input) => el('label', {}, el('span', {}, title), input);
const names = { source_f32: 'Source reconstruction (target)', round_scaled: 'Round scaled values',
  fixed_2x: 'Fixed 2× shortcut', historical_preview: 'Historical preview', ridge_group_cv: 'Grouped ridge surrogate' };

export async function initCorpus() {
  const [records, meta, study, evaluation] = await loadCorpusPage();
  if (evaluation.schema !== 'sicc-pro-conversions-v1' || evaluation.model !== COMMUNITY_MODEL.version ||
    evaluation.build !== COMMUNITY_MODEL.build) throw new Error('Conversion results do not match the current model.');
  if (evaluation.corpusSha256 !== meta.sha256) throw new Error('Conversion results do not match the bundled settings.');
  let page = 0, selected = null, filtered = [];
  const pageSize = 20, root = $('corpus'), expansion = meta.expansion;
  const query = el('input', { id: 'corpus-search', type: 'search', placeholder: 'Player, team, country or code…' });
  const height = el('select', { id: 'corpus-height' }, meta.heights.map(h => option(String(h), `${h}p`)));
  height.value = '1080';
  const cohort = el('select', { id: 'corpus-cohort' }, option('all', 'All records'),
    option('new', 'New harvest'), option('original', 'Original 138'));
  const result = el('select', { id: 'corpus-result' }, option('all', 'All results'), option('improved', 'Improved by corrections'),
    ...['exact', 'shifted', 'approximate', 'empty', 'excluded'].map(key => option(key, resultLabel(key))));
  const rows = el('tbody', { id: 'corpus-rows' }), detail = el('aside', { id: 'corpus-detail', 'aria-label': 'Selected record' });
  const status = el('p', { id: 'corpus-page-status', role: 'status', class: 'small' });
  const comparison = el('div', { id: 'corpus-comparison' }), selection = el('p', { id: 'corpus-selection', class: 'small' });
  const previous = el('button', { id: 'corpus-prev', class: 'button secondary' }, 'Previous');
  const next = el('button', { id: 'corpus-next', class: 'button secondary' }, 'Next');

  function drawSelection() {
    for (const button of rows.querySelectorAll('button[data-record]'))
      button.setAttribute('aria-pressed', String(button.dataset.record === selected));
    showRecord(detail, filtered.find(entry => entry.record.id === selected), Number(height.value));
  }
  function draw() {
    filtered = selectRecords(records, evaluation,
      { query: query.value, cohort: cohort.value, status: result.value, height: Number(height.value) });
    page = Math.max(0, Math.min(page, Math.ceil(filtered.length / pageSize) - 1));
    const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
    if (!visible.some(entry => entry.record.id === selected)) selected = visible[0]?.record.id ?? null;
    rows.replaceChildren(...visible.map(({ record: r, score }) => el('tr', {},
      el('td', {}, el('button', { class: 'corpus-player', 'data-record': r.id, 'aria-controls': 'corpus-detail',
        onclick: () => {
          selected = r.id; drawSelection();
          if (matchMedia('(max-width: 1000px)').matches) detail.scrollIntoView({ block: 'start' });
        } }, r.player),
      el('small', { class: 'block small' }, r.team ?? r.country ?? '—')),
      el('td', {}, r.observed_date ?? 'Unknown', el('small', { class: 'block small' },
        r.cohort === expansion.cohort ? 'New harvest' : 'Original collection')),
      el('td', { class: 'corpus-tuple' }, `${r.size} / ${r.thickness} / ${r.gap}`),
      el('td', {}, resultLabel(score?.current.status ?? 'excluded'),
        el('small', { class: 'block small' }, score ? `${percent(score.current.alignedIou)} aligned` : 'Outside study')))));
    if (!visible.length) rows.append(el('tr', {}, el('td', { colspan: '4' }, 'No matching records. Clear a filter to continue.')));
    const scored = filtered.flatMap(entry => entry.score ? [entry.score] : []), summary = summarizeConversions(scored);
    comparison.replaceChildren(table(['Conversion', 'Exact', 'Shifted 1 px', 'Approximate',
      'Mean, same position', 'Mean, aligned', 'Geometry mean'],
      [['current', 'v11 default'], ['plain', 'Corrections off']].map(([key, name]) => {
        const s = summary[key];
        return [name, s.visible ? `${s.exact} / ${s.visible}` : '—', String(s.shifted), String(s.approximate),
          percent(s.meanIou), percent(s.meanAlignedIou), percent(s.geometryMacroAlignedIou)];
      })));
    selection.textContent = `${scored.length} scored records at ${height.value}p · ${summary.current.geometryGroups} ` +
      `visible geometry groups · ${summary.improved} improved · ${summary.regressed} worse · ` +
      `${summary.current.empty} empty targets · ${filtered.length - scored.length} not scored. Filters apply to both methods.`;
    status.textContent = `${filtered.length} records, page ${page + 1} of ${Math.max(1, Math.ceil(filtered.length / pageSize))}.`;
    previous.disabled = page === 0;
    next.disabled = (page + 1) * pageSize >= filtered.length;
    drawSelection();
  }
  query.oninput = () => { page = 0; draw(); };
  for (const select of [height, cohort, result]) select.onchange = () => { page = 0; draw(); };
  previous.onclick = () => { page--; draw(); };
  next.onclick = () => { page++; draw(); };

  root.replaceChildren(sheetHead({ title: 'Settings data',
    lede: 'Published pro crosshairs, tested through v11. Inspect the source, compare the conversion, and open any scored record.',
    fields: [['Records', String(meta.records)], ['Players', String(meta.players)],
      ['Added', `+${expansion.addedRecords}`], ['Retrieved', meta.snapshot]] }),
  el('p', { class: 'corpus-intro' }, `${expansion.newCodes} new codes and ${expansion.newGeometrySignatures} new geometry groups. ` +
    `${meta.datedRecords} records have a provider-reported observation date. Dates describe past use, not current settings.`),
  el('section', { id: 'corpus-records', class: 'corpus-workbench' },
    el('h2', {}, 'Browse and compare'),
    el('div', { class: 'corpus-controls' }, control('Search records', query), control('Test height', height),
      control('Collection', cohort), control('v11 result', result)),
    el('div', { id: 'corpus-results' }, selection, comparison),
    el('p', { class: 'small corpus-method' }, 'Model agreement only; in-game accuracy remains unmeasured. ' +
      'Exact means the same visible pixels at the same position. Shifted means a match ' +
      'after moving the whole shape by at most 1 px. Aligned means include this shift; geometry mean gives each geometry ' +
      'group equal weight. Empty targets are excluded from means and exact-rate denominators.'),
    el('div', { class: 'corpus-browser' }, el('div', {}, el('div', { class: 'table-scroll' }, el('table', {},
      el('thead', {}, el('tr', {}, ...['Player', 'Observation', 'Old size / width / gap', 'v11 result']
        .map(text => el('th', { scope: 'col' }, text)))), rows)),
    el('div', { class: 'export-actions' }, previous, next), status), detail),
    el('div', { class: 'export-actions' },
      el('button', { class: 'button secondary', id: 'corpus-download', onclick: () => download('crosshair-selection.json',
        JSON.stringify({ model: evaluation.model, height: Number(height.value), nativeAccuracy: null,
          scope: evaluation.scope, corpusSha256: meta.sha256, records: filtered }, null, 2)) }, 'Download selection'),
      el('a', { class: 'button ghost', href: './data/pro-conversions.json', download: 'pro-conversions.json' },
        `All ${evaluation.rows.length.toLocaleString('en')} conversion tests`))),
  el('section', { class: 'math-sheet' }, el('h2', {}, 'What this measures'),
    el('p', {}, `Each eligible setting is tested at ${meta.heights.length} controlled heights. ` +
      'Old, new and authored heights are equal; the goal is pixel preservation and T is kept. ' +
      'Scores compare core, outline and colour with the converter’s shape check. Scene-dependent additive blending ' +
      'and recoil animation are outside that check.'),
    el('p', {}, `Native old/new capture pairs: ${meta.nativeCapturePairs}. In-game conversion accuracy is not established. ` +
      'A published code supplies an input, not a measured output. Player resolutions are unknown.'),
    el('p', {}, `${expansion.fetchedRecords} directory entries retrieved; ${expansion.addedRecords} added, ` +
      `${expansion.excluded.filter(r => r.reason === 'Existing player/code association').length} existing associations skipped, ` +
      `${expansion.excluded.filter(r => r.reason !== 'Existing player/code association').length} unsupported codes excluded. ` +
      `${evaluation.excluded.length} stored records are outside this static conversion study. The v11 solver and learners are frozen.`),
    docLink('research/pro-data-expansion-2026-10-07.md', 'Source, exclusions and evaluation method')),
  el('details', { class: 'corpus-reconstruction' }, el('summary', {}, 'Old-renderer reconstruction study'),
    el('p', { class: 'small' }, 'This separate benchmark compares ways of reconstructing old geometry. ' +
      'Its baseline defines the target; a perfect baseline score is expected and says nothing about the new game.'),
    table(['Method', 'Matching cases', 'Geometry mean'], study.ablations.map(x =>
      [names[x.name] ?? x.name, `${x.allExact} / ${study.eligibleRows}`, percent(x.clusterStability.mean)]))),
  el('section', { class: 'reading-list' }, docLink('research/quant-sources.md', 'Source ledger'),
    el('a', { href: './data/corpus.json', download: 'pro-crosshair-corpus.json' }, 'Download all source records'),
    el('a', { href: './research/generated/quant-study.csv', download: 'quant-study.csv' }, 'Old-reconstruction study (CSV)')));
  draw();
  let width = 0;
  const observer = new ResizeObserver(entries => {
    const nextWidth = entries[0].contentRect.width;
    if (!root.hidden && nextWidth !== width) { width = nextWidth; drawSelection(); }
  });
  observer.observe(detail);
  return { refresh: draw };
}
