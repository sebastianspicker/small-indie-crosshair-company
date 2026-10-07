const BASE = 'https://local.invalid/';
const TOP_LEVEL = new Set(['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md']);
const MATH_SECTIONS = new Set(['intro', 'pipeline', 'appendix-notation', 'appendix-glossary', 'appendix-history']);

/** Reader inputs are site-relative public Markdown paths, not arbitrary fetch URLs. */
export function documentPath(value) {
  if (typeof value !== 'string' || !/^[\w./-]+\.md$/.test(value)) return null;
  const parts = value.split('/');
  if (parts.some(part => !part || part.startsWith('.'))) return null;
  if (TOP_LEVEL.has(value) || value.startsWith('docs/')) return value;
  if (value.startsWith('research/') && !/^research\/(?:lib|scripts)\//.test(value)) return value;
  return null;
}

const relative = (path, page) => '../'.repeat(page.split('/').length - 1) + path;

/** Resolve from the source document, not the reader URL. Keep notebook chapter links typeset. */
export function documentLink(href, source = 'index.html', page = 'index.html', image = false) {
  if (!href || /[\u0000-\u0020\\]/.test(href)) return null;
  if (href.startsWith('#')) return image ? null : href;
  let url;
  try { url = new URL(href, new URL(source, BASE)); } catch { return null; }
  if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null;
  if (url.origin !== new URL(BASE).origin) return image ? null : url.href;
  const path = url.pathname.slice(1);
  if (image) return relative(path, page) + url.search + url.hash;
  if (path.endsWith('.md')) {
    if (!documentPath(path)) return null;
    const math = /^docs\/math\/(\d{2})-[^/]+\.md$/.exec(path);
    const section = /^docs\/math\/([^/]+)\.md$/.exec(path)?.[1];
    if (math || MATH_SECTIONS.has(section)) {
      const anchor = url.hash || `#${math ? 'chapter-' + Number(math[1]) : section}`;
      return relative('docs/notebook.html', page) + anchor;
    }
    return relative('docs/read.html', page) + '?doc=' + encodeURIComponent(path) + url.hash;
  }
  return relative(path, page) + url.search + url.hash;
}
