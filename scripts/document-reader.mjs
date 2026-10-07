import { readFile, writeFile } from 'node:fs/promises';
import { siteChrome } from './site-chrome.mjs';

const file = new URL('../docs/read.html', import.meta.url), { header, footer } = await siteChrome('docs/read.html');
const source = await readFile(file, 'utf8');
await writeFile(file, source.replace(/<header[\s\S]*?<\/header>/, header).replace(/<footer>[\s\S]*?<\/footer>/, footer));
