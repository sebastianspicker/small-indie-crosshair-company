import { el } from './dom.js';
import { documentLink } from './document-links.js';

const slug = text => text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-');
const listItem = line => /^(\s*)([-+*]|\d+[.)])\s+(.+)$/.exec(line);
const heading = line => /^(#{1,6})\s+(.+?)(?:\s+\{#([\w-]+)\})?\s*$/.exec(line);
const divider = line => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
const fence = line => /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(s => s.trim());

/** Small, inert Markdown reader: create elements, never interpret source HTML or executable URLs. */
export function markdownDocument(text, source) {
  const ids = new Map();
  const link = (href, image = false) => documentLink(href, source, 'docs/read.html', image);
  function inline(parent, text, depth = 0) {
    if (depth > 8) { parent.append(text); return; }
    const tokens = new RegExp('(`+)([\\s\\S]*?)\\1|(!?)\\[([^\\]]*)\\]\\(([^\\s)]+)(?:\\s+"[^"]*")?\\)|' +
      '\\*\\*([^*]+)\\*\\*|\\*([^*]+)\\*|<br\\s*\\/?\\s*>|<(https?:\\/\\/[^\\s<>]+)>|' +
      '(https?:\\/\\/[^\\s<>()]+)|\\$([^$\\n]+)\\$', 'g');
    let offset = 0;
    for (const match of text.matchAll(tokens)) {
      parent.append(text.slice(offset, match.index));
      if (match[1]) parent.append(el('code', {}, match[2]));
      else if (match[4] !== undefined) {
        const url = link(match[5], !!match[3]);
        if (!url) parent.append(match[4]);
        else if (match[3]) parent.append(el('img', { src: url, alt: match[4], loading: 'lazy' }));
        else {
          const anchor = el('a', { href: url });
          if (/^https?:/.test(url)) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
          inline(anchor, match[4], depth + 1); parent.append(anchor);
        }
      } else if (match[6] || match[7]) {
        const node = el(match[6] ? 'strong' : 'em'); inline(node, match[6] || match[7], depth + 1); parent.append(node);
      } else if (match[8] || match[9]) {
        const raw = match[8] || match[9], url = match[8] || raw.replace(/[.,;]+$/, '');
        parent.append(el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, url), raw.slice(url.length));
      } else if (match[10]) {
        parent.append(el('code', { 'aria-label': 'Formula in TeX notation' }, match[10]));
      } else parent.append(el('br'));
      offset = match.index + match[0].length;
    }
    parent.append(text.slice(offset));
  }
  function blocks(lines) {
    const root = el('div');
    let i = 0;
    while (i < lines.length) {
      const line = lines[i], h = heading(line), f = fence(line), item = listItem(line);
      if (!line.trim()) { i++; continue; }
      if (line.trim() === '<details>') {
        const content = []; let nesting = 1; i++;
        while (i < lines.length) {
          const next = lines[i++];
          if (next.trim() === '<details>') nesting++;
          if (next.trim() === '</details>' && --nesting === 0) break;
          content.push(next);
        }
        root.append(el('details', {}, ...blocks(content).childNodes)); continue;
      }
      const summary = /^\s*<summary>(.*?)<\/summary>\s*$/.exec(line);
      if (summary) { const node = el('summary'); inline(node, summary[1]); root.append(node); i++; continue; }
      if (/^\s*<img\s[^>]+>\s*$/.test(line)) {
        const source = /\bsrc=["']([^"']+)["']/.exec(line)?.[1], url = source && link(source, true);
        const alt = /\balt=["']([^"']*)["']/.exec(line)?.[1] ?? '';
        const width = /\bwidth=["'](\d{1,4})["']/.exec(line)?.[1];
        root.append(url ? el('img', { src: url, alt, loading: 'lazy', ...(width ? { width } : {}) }) : el('p', {}, alt));
        i++; continue;
      }
      if (f) {
        const code = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith(f[1])) code.push(lines[i++]);
        if (i < lines.length) i++;
        root.append(el('pre', {}, el('code', {}, code.join('\n')))); continue;
      }
      if (line.trim() === '$$') {
        const formula = []; i++;
        while (i < lines.length && lines[i].trim() !== '$$') formula.push(lines[i++]);
        if (i < lines.length) i++;
        root.append(el('pre', { class: 'document-formula', 'aria-label': 'Formula in TeX notation' }, formula.join('\n')));
        continue;
      }
      if (h) {
        const base = h[3] || slug(h[2]), count = ids.get(base) || 0;
        ids.set(base, count + 1);
        const node = el('h' + h[1].length, { id: base + (count ? '-' + count : '') });
        inline(node, h[2]); root.append(node); i++; continue;
      }
      if (i + 1 < lines.length && divider(lines[i + 1])) {
        const table = el('table'), head = el('tr'), body = el('tbody');
        for (const value of cells(line)) { const cell = el('th', { scope: 'col' }); inline(cell, value); head.append(cell); }
        table.append(el('thead', {}, head), body); i += 2;
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
          const row = el('tr');
          for (const value of cells(lines[i++])) { const cell = el('td'); inline(cell, value); row.append(cell); }
          body.append(row);
        }
        root.append(el('div', { class: 'table-scroll' }, table)); continue;
      }
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
        root.append(el('blockquote', {}, ...blocks(quote).childNodes)); continue;
      }
      if (item) {
        const indent = item[1].length, ordered = /^\d/.test(item[2]);
        const list = el(ordered ? 'ol' : 'ul', ordered ? { start: parseInt(item[2], 10) } : {});
        while (i < lines.length) {
          const next = listItem(lines[i]);
          if (!next || next[1].length !== indent || /^\d/.test(next[2]) !== ordered) break;
          const content = [next[3]]; i++;
          while (i < lines.length && (lines[i].trim() === '' || /^\s+/.test(lines[i]))) {
            const nested = listItem(lines[i]);
            if (nested && nested[1].length <= indent) break;
            const continuation = lines[i++];
            content.push(continuation.slice(Math.min(indent + 2, continuation.match(/^\s*/)[0].length)));
          }
          list.append(el('li', {}, ...blocks(content).childNodes));
        }
        root.append(list); continue;
      }
      if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) { root.append(el('hr')); i++; continue; }
      const paragraph = [line]; i++;
      while (i < lines.length && lines[i].trim() && !heading(lines[i]) && !fence(lines[i]) &&
        !listItem(lines[i]) && !/^\s*>/.test(lines[i]) && lines[i].trim() !== '$$' && !divider(lines[i + 1] ?? ''))
        paragraph.push(lines[i++]);
      const node = el('p'); inline(node, paragraph.join(' ')); root.append(node);
    }
    return root;
  }
  return blocks(text.replace(/\r\n?/g, '\n').split('\n'));
}
