import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const root = new URL('../', import.meta.url);
export const key = (tex, display) => createHash('sha256').update(String(display) + '\n' + tex.trim()).digest('hex');
export async function chapters() { return Promise.all((await readdir(new URL('docs/math/', root))).filter(x => /^\d{2}-.*\.md$/.test(x)).sort().map(async (file) => ({ file, text: await readFile(new URL('docs/math/' + file, root), 'utf8') }))); }
export function mathTokens(text, fn) {
    let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, t) => fn(t.trim(), true)).replace(/\$\$([\s\S]*?)\$\$/g, (_, t) => fn(t.trim(), true));
    return result.replace(/\\\(([\s\S]*?)\\\)/g, (_, t) => fn(t.trim(), false)).replace(/(?<!\\)\$([^$\n]+?)\$/g, (_, t) => fn(t.trim(), false));
}
