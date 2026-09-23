import { $,el,heading,table,download,docLink } from './dom.js';
import { runAudit } from '../lib/audit.js';
export function initEvidence(presets) {
  const root=$('evidence');let audit=runAudit(presets);
  root.append(heading('Archive audit','Re-run the original numerical experiment in this browser. The archive contains no native game screenshots.'));
  const stats=el('div',{class:'evidence-stats'},...[[String(audit.cases),'source-model cases'],['8','dated legacy codes'],['7','controlled heights'],['0','native captures shipped']].map(([v,l])=>el('div',{},el('strong',{},v),el('span',{},l))));
  root.append(stats,el('p',{class:'disclosure'},'These are eight presets × seven controlled test heights, not each player’s actual display settings. Dates and associations were reported by xhair.pro in the supplied archive; this project did not reparse the demos.'));
  const summary=el('article',{class:'math-sheet'},el('h2',{},'Compare the shortcuts'));
  const renderSummary=()=>summary.replaceChildren(el('h2',{},'Compare the shortcuts'),table(['Comparator','Length differs','Thickness differs','Either differs'],
    Object.entries(audit.counts).map(([k,v])=>[k,v.length_disagreements,v.thickness_disagreements,`${v.any_dimension_disagreements} / ${audit.cases}`])),
    el('p',{class:'small'},'The historical browser preview is fixed-coordinate; its cross-resolution disagreement is diagnostic, not a native-engine accuracy ranking.'));
  renderSummary();root.append(summary);
  const toolbar=el('div',{class:'section-heading'},el('h2',{},'Inspect every case'));
  const filter=el('select',{id:'audit-filter','aria-label':'Filter audit by player'},el('option',{value:''},'All eight presets'),presets.map(p=>el('option',{value:p.player},p.player)));
  const actions=el('div',{class:'toolbar-group'},filter,
    el('button',{class:'button secondary',onClick:()=>{audit=runAudit(presets);renderSummary();renderRows();$('audit-status').textContent=`Recomputed ${audit.cases} numerical cases locally.`;}},'Re-run audit'),
    el('button',{class:'button primary',onClick:()=>download('crosshair-audit.json',JSON.stringify(audit,null,2)+'\n')},'Export results'));
  toolbar.append(actions);root.append(toolbar,el('p',{id:'audit-status',role:'status',class:'small'}));
  const rows=el('div');root.append(rows);
  function renderRows(){rows.replaceChildren(table(['Player','Height','Old S / T / G','L / W / near','Round L / W','×2 L / W'],
    audit.rows.filter(r=>!filter.value||r.player===filter.value).map(r=>[r.player,r.height,`${r.size} / ${r.thickness} / ${r.gap}`,`${r.old.length} / ${r.old.width} / ${r.old.near}`,r.alternatives.round_scaled.join(' / '),r.alternatives.fixed_2x.join(' / ')])));}
  filter.addEventListener('change',renderRows);renderRows();
  root.append(el('div',{class:'reading-list'},docLink('research/pro-preset-audit.md','Methods, all presets and controlled-grid results'),docLink('research/source-ledger.md','Source provenance and archive hashes'),docLink('evidence/measurement-policy.md','What qualifies as new evidence')));
}
