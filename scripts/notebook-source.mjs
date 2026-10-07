import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const root = new URL('../', import.meta.url);
export const key = (tex, display) => createHash('sha256').update(String(display) + '\n' + tex.trim()).digest('hex');

/** Reading order of the notebook. Numbered chapter files keep their names: the `#chapter-N` anchors (app/ui/dom.js) and
 * the #research chapter count follow the file number, not the position in this list. */
export const NOTEBOOK = Object.freeze({
    front: ['intro.md', 'pipeline.md'],
    parts: [
        { id: 'part-1', title: 'Part I. The old crosshair', chapters: ['01-legacy-geometry.md', '04-rendering.md'] },
        { id: 'part-2', title: 'Part II. Converting', chapters: ['02-conversion-and-identifiability.md',
            '12-community-conversion.md', '13-what-decides-the-export.md'] },
        { id: 'part-3', title: 'Part III. Evidence and uncertainty', chapters: ['05-model-families.md',
            '09-solver-and-integrity.md', '06-statistical-inference.md', '07-image-inverse-and-feedback.md',
            '03-calibration-protocol.md', '11-certified-inverse-and-capture-plan.md'] },
        { id: 'part-4', title: 'Part IV. Learning', chapters: ['08-expanded-corpus-study.md', '10-learned-emulator.md'] },
    ],
    appendices: ['appendix-notation.md', 'appendix-glossary.md', 'appendix-history.md'],
});

/** Every source file in reading order: `{ file, text, kind, part }`, kind `front`, `chapter` or `appendix`. Fails when a
 * numbered chapter in docs/math is missing from NOTEBOOK, so no chapter drops out of the page silently. */
export async function chapters() {
    const numbered = (await readdir(new URL('docs/math/', root))).filter(x => /^\d{2}-.*\.md$/.test(x));
    const listed = NOTEBOOK.parts.flatMap(p => p.chapters), missing = numbered.filter(x => !listed.includes(x));
    if (missing.length)
        throw new Error('Chapters missing from NOTEBOOK in scripts/notebook-source.mjs: ' + missing.join(', '));
    const entries = [...NOTEBOOK.front.map(file => ({ file, kind: 'front', part: null })),
        ...NOTEBOOK.parts.flatMap(part => part.chapters.map(file => ({ file, kind: 'chapter', part: part.id }))),
        ...NOTEBOOK.appendices.map(file => ({ file, kind: 'appendix', part: null }))];
    return Promise.all(entries.map(async (entry) => ({ ...entry,
        text: await readFile(new URL('docs/math/' + entry.file, root), 'utf8') })));
}

export function mathTokens(text, fn) {
    let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, t) => fn(t.trim(), true)).replace(/\$\$([\s\S]*?)\$\$/g, (_, t) => fn(t.trim(), true));
    return result.replace(/\\\(([\s\S]*?)\\\)/g, (_, t) => fn(t.trim(), false)).replace(/(?<!\\)\$([^$\n]+?)\$/g, (_, t) => fn(t.trim(), false));
}

/* Figure tokens: `{{fig:<source>.<path>|<format>}}`, resolved at build time so that no figure is typed by hand.
 * Sources: `summary` (data/quant-summary.json), `generated.<name>` (research/generated/<name>.json), `model`
 * (COMMUNITY_MODEL in lib/geometry/community.js) and `package` (package.json). Path segments are object keys, array
 * indexes, or `key=value` (value without dots) for the array element whose `key` equals `value`. Formats: `pct` (a fraction as a percentage
 * with two decimals), `int` (an integer with thousands separators), `d1` to `d6` (fixed decimals), `date` (an ISO date
 * as "October 6, 2026"), `version` (a version string) and `text` (the default: a string or a finite number as is). */
export const FIGURE_PATTERN = /\{\{fig:([^{}|\s]+)(?:\|([a-z0-9]+))?\}\}/g;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'];

export async function figureData() {
    const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
    const { COMMUNITY_MODEL } = await import(new URL('lib/geometry/community.js', root).href);
    const generated = {};
    for (const file of (await readdir(new URL('research/generated/', root))).filter(x => x.endsWith('.json')).sort())
        generated[file.slice(0, -5)] = await json('research/generated/' + file);
    return { summary: await json('data/quant-summary.json'), generated, model: { ...COMMUNITY_MODEL },
        package: await json('package.json') };
}

function lookup(data, path) {
    let value = data;
    for (const segment of path.split('.')) {
        if (value === null || typeof value !== 'object')
            return undefined;
        const pick = /^([\w-]+)=([\w:-]+)$/.exec(segment);
        if (pick && Array.isArray(value))
            value = value.find(item => item && String(item[pick[1]]) === pick[2]);
        else
            value = Object.hasOwn(value, segment) ? value[segment] : undefined;
    }
    return value;
}

const thousands = n => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** The formatted figure, or null when the value does not fit the format. */
function format(value, kind) {
    const finite = typeof value === 'number' && Number.isFinite(value);
    if (kind === 'pct')
        return finite ? `${(100 * value).toFixed(2)}%` : null;
    if (kind === 'int')
        return finite && Number.isInteger(value) ? (value < 0 ? '-' : '') + thousands(value) : null;
    const decimals = /^d([1-6])$/.exec(kind);
    if (decimals)
        return finite ? value.toFixed(Number(decimals[1])) : null;
    if (kind === 'date') {
        const date = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        return date && Number(date[2]) >= 1 && Number(date[2]) <= 12
            ? `${MONTHS[Number(date[2]) - 1]} ${Number(date[3])}, ${date[1]}` : null;
    }
    if (kind === 'version')
        return typeof value === 'string' && /^[\w.-]+$/.test(value) ? value : null;
    if (kind === 'text')
        return typeof value === 'string' ? value : finite ? String(value) : null;
    throw new Error(`Unknown figure format "${kind}".`);
}

/** Resolve one token: `{ value }` (the formatted text) or `{ error }` (why it is unresolved). */
export function figure(data, path, kind = 'text') {
    const value = lookup(data, path);
    if (value === undefined || value === null)
        return { error: 'no value at this path' };
    const text = format(value, kind);
    return text === null ? { error: `value ${JSON.stringify(value).slice(0, 40)} does not fit the format ${kind}` } : { value: text };
}

/** Every figure token in `text`: `{ token, path, kind }`. */
export const figureTokens = text => [...text.matchAll(FIGURE_PATTERN)]
    .map(([token, path, kind]) => ({ token, path, kind: kind ?? 'text' }));
