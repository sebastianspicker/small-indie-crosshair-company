import { $, el, download, docLink, table } from '../ui/dom.js';
import { loadCorpusPage } from '../data.js';
const pct = x => (x * 100).toFixed(1) + '%';
const names = { source_f32: 'Source-reconstruction baseline', round_scaled: 'Round scaled values', fixed_2x: 'Fixed 2× shortcut', historical_preview: 'Historical length/thickness preview', ridge_group_cv: 'Grouped ridge surrogate' };
export async function initCorpus() {
    const [records, meta, study] = await loadCorpusPage();
    let page = 0;
    const pageSize = 20, query = el('input', { id: 'corpus-search', type: 'search', placeholder: 'Search player, code or geometry…', 'aria-label': 'Search the corpus' }), rows = el('tbody'), status = el('p', { id: 'corpus-page-status', role: 'status', class: 'small' }), prev = el('button', { id: 'corpus-prev', class: 'button secondary' }, 'Previous'), next = el('button', { id: 'corpus-next', class: 'button secondary' }, 'Next');
    function draw() {
        const q = query.value.toLowerCase(), filtered = records.filter(r => `${r.player} ${r.code} ${r.signature}`.toLowerCase().includes(q));
        page = Math.max(0, Math.min(page, Math.ceil(filtered.length / pageSize) - 1));
        rows.replaceChildren(...filtered.slice(page * pageSize, (page + 1) * pageSize).map(r => el('tr', {}, el('td', {}, el('strong', {}, r.player), el('small', { class: 'block small' }, r.observed_date ?? 'Observation date unknown')), el('td', {}, `${r.size} / ${r.thickness} / ${r.gap}`, el('small', { class: 'block small' }, `style ${r.style}${r.dot ? ' · dot' : ''}${r.weapon_gap ? ' · weapon gap' : ''}`)), el('td', {}, el('code', {}, r.code)), el('td', {}, el('a', { href: r.source, target: '_blank', rel: 'noopener noreferrer' }, r.provider ?? r.sourceId ?? 'Source')))));
        status.textContent = `${filtered.length} records · page ${page + 1} of ${Math.max(1, Math.ceil(filtered.length / pageSize))}. These settings were published; they are not measurements of the new renderer.`;
        prev.disabled = page === 0;
        next.disabled = (page + 1) * pageSize >= filtered.length;
    }
    query.oninput = () => { page = 0; draw(); };
    prev.onclick = () => { page--; draw(); };
    next.onclick = () => { page++; draw(); };
    const summaries = study.ablations;
    const root = $('corpus');
    root.replaceChildren(el('div', { class: 'page-heading' }, el('div', {}, el('h1', {}, 'Published crosshair settings'), el('p', {}, 'Browse the source records behind the old settings.'))), el('p', { class: 'small' }, `${meta.records} records · ${meta.players} players · ${meta.uniqueCodes} distinct codes · ${meta.uniqueGeometrySignatures} geometry signatures. Observation dates are known for ${meta.datedRecords} records; the rest are undated.`), el('section', { class: 'math-sheet' }, el('h2', {}, 'What the records tell us'), el('p', {}, 'These published settings give us real old inputs. They do not show how the new game draws a crosshair. We tested each eligible record at seven chosen game heights; the players’ actual resolutions are usually unknown.'), el('p', {}, `${meta.staticSupported} eligible records × 7 heights = ${meta.staticSupported * 7} numerical cases. Settings that draw the same shape are grouped so repeated inputs do not count as independent evidence. Native old/new capture pairs in this release: 0.`), docLink('math/08-expanded-corpus-study.md', 'Study methods and exclusions')), el('section', { class: 'math-sheet', id: 'corpus-results' }, el('h2', {}, 'Comparing ways to reconstruct the old crosshair'), el('p', { class: 'small' }, 'Each method is compared with the documented old reconstruction. The baseline defines the target, so its perfect score is expected. These scores do not measure accuracy in the new game.'), el('div', { id: 'corpus-comparison' })), el('section', { class: 'math-sheet', id: 'corpus-records' }, el('h2', {}, 'Browse the source records'), query, el('div', { class: 'table-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, ...['Player / observation', 'Old size / thickness / gap', 'Legacy v1 code', 'Source'].map(x => el('th', { scope: 'col' }, x)))), rows)), el('div', { class: 'export-actions' }, prev, next, el('button', { class: 'button ghost', onclick: () => download('pro-crosshair-corpus.json', JSON.stringify({ metadata: meta, records }, null, 2)) }, 'Download source records')), status), el('section', { class: 'reading-list' }, docLink('research/quant-sources.md', 'Sources and dataset limits'), docLink('math/06-statistical-inference.md', 'How model weights are interpreted'), el('a', { href: './research/generated/quant-study.csv', download: 'quant-study.csv' }, 'Download all study rows (CSV)'), el('a', { href: './research/generated/quant-study.json', download: 'quant-study.json' }, 'Download the full study (JSON)')));
    // Support only the versioned study shape emitted by research/scripts/quant-study.mjs.
    const entries = Array.isArray(summaries) ? summaries : Object.entries(summaries).map(([id, v]) => ({ id, ...v }));
    $('corpus-comparison').replaceChildren(table(['Method', 'Cases matching', 'Micro agreement', 'Geometry-macro agreement', '95% cluster-bootstrap stability'], entries.map(x => { const ci = x.clusterStability; return [names[x.name] ?? x.name, `${x.allExact} / ${meta.staticSupported * 7}`, pct(x.microExact), pct(x.clusterStability.mean), ci ? `${pct(ci.lower ?? ci[0])} – ${pct(ci.upper ?? ci[1])}` : 'See complete research JSON']; })));
    draw();
    return { refresh: draw };
}
