import { loadDocument } from '../data.js';
import { documentPath, documentLink } from '../ui/document-links.js';
import { markdownDocument } from '../ui/markdown.js';
import { el } from '../ui/dom.js';

const root = document.getElementById('document-body'), status = document.getElementById('document-status');
const path = documentPath(new URLSearchParams(location.search).get('doc'));
try {
  if (!path) throw new Error('Choose a published Markdown document from the Sources or Mathematics links.');
  const notebook = documentLink(path + location.hash, 'index.html', 'docs/read.html');
  if (notebook.includes('notebook.html')) location.replace(notebook);
  else {
    const text = await loadDocument(path);
    root.replaceChildren(...markdownDocument(text, path).childNodes);
    const title = root.querySelector('h1')?.textContent || path.split('/').at(-1).replace(/\.md$/, '');
    document.title = `${title} · Small Indie Crosshair Company`;
    if (!root.querySelector('h1')) root.prepend(el('h1', {}, title));
    const source = document.getElementById('document-source');
    source.href = '../' + path; source.hidden = false; source.download = path.split('/').at(-1);
    status.textContent = path;
    if (location.hash) {
      await document.fonts.ready;
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }
} catch (error) {
  status.textContent = 'Document unavailable';
  root.replaceChildren(el('h1', {}, 'This document could not be opened'), el('p', { role: 'alert' }, error.message));
}
