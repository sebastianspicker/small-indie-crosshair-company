export const $ = id => document.getElementById(id);
export function el(tag, attrs={}, ...children) {
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs)) {
    if(key==='class')node.className=value;
    else if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='text')node.textContent=value;
    else if(key==='checked'||key==='disabled'||key==='hidden')node[key]=!!value;
    else node.setAttribute(key,String(value));
  }
  children.flat().forEach(child=>{if(child!=null)node.append(typeof child==='string'?document.createTextNode(child):child);});
  return node;
}
export function download(name,text,type='application/json') {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=el('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/** How long the "Copied" confirmation stays before it clears itself. */
export const COPIED_MS = 4000;
export async function copy(text,status,note='') {
  try {
    const message='Copied to clipboard.'+(note?' '+note:'');
    await navigator.clipboard.writeText(text);status.textContent=message;
    setTimeout(()=>{if(status.textContent===message)status.textContent='';},COPIED_MS);
  }
  catch {status.textContent='Clipboard is unavailable. Select the command text, or use the download button.';}
}
/** Snapshot facts shared by every sheet's title block. */
export const SNAPSHOT = { build: '2000914', date: '2026-09-23' };

/**
 * Page header: title, lede, and a title block of [term, value] fields. A field may be [term, value, 'tb-flag'].
 */
export function sheetHead({ title, lede, fields = [] }) {
  return el('header', { class: 'sheet-head' },
    el('div', { class: 'sheet-intro' }, el('h1', {}, title), lede ? el('p', { class: 'lede' }, lede) : null),
    fields.length ? el('dl', { class: 'title-block' }, fields.map(([term, value, className]) =>
      el('div', className ? { class: className } : {}, el('dt', {}, term), el('dd', {}, value)))) : null);
}
export function heading(title, description, { fields } = {}) {
  return sheetHead({ title, lede: description, fields: fields ?? [['Build', SNAPSHOT.build], ['Snapshot', SNAPSHOT.date]] });
}
export function docLink(path,label) {const chapter=/^math\/(\d{2})-/.exec(path);return el('a',{href:chapter?'./docs/notebook.html#chapter-'+Number(chapter[1]):'./docs/'+path,target:'_blank',rel:'noopener noreferrer'},label+' ↗');}
export function table(headers,rows) {
  return el('div',{class:'table-scroll'},el('table',{},el('thead',{},el('tr',{},headers.map(h=>el('th',{scope:'col'},h)))),
    el('tbody',{},rows.map(row=>el('tr',{},row.map(cell=>el('td',{},String(cell))))))));
}
export const fmt=n=>Number.isInteger(n)?String(n):Number(n.toFixed(4)).toString();
