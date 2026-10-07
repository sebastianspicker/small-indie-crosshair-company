import { readFile } from 'node:fs/promises';

/** index.html owns the site chrome; standalone documentation adjusts paths, not its design. */
export function renderSiteChrome(index, page, active = '') {
  const prefix = '../'.repeat(page.split('/').length - 1);
  const rewrite = html => html.replace(/href="([^"]+)"/g, (_, href) => {
    const target = /^[a-z]+:/i.test(href) ? href : prefix + href.replace(/^\.\//, '');
    return `href="${target}"` + (active && href === active ? ' aria-current="page"' : '');
  });
  const header = index.match(/<header class="masthead">[\s\S]*?<\/header>/)?.[0];
  const footer = index.match(/<footer>[\s\S]*?<\/footer>/)?.[0];
  if (!header || !footer) throw new Error('index.html must define the shared masthead and footer.');
  return { header: rewrite(header), footer: rewrite(footer) };
}

export async function siteChrome(page, active) {
  return renderSiteChrome(await readFile(new URL('../index.html', import.meta.url), 'utf8'), page, active);
}
