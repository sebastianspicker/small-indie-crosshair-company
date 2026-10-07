#!/usr/bin/env node
/** Bounded Markdown subset for our checked-in notebook. No runtime Markdown or HTML evaluation.
 * Extensions: `::: summary`, `::: key` and `::: technical` blocks closed by `:::`, heading ids `## Title {#id}`, and
 * figure tokens `{{fig:…}}` (scripts/notebook-source.mjs). Unresolved figures fail the build unless
 * SICC_NOTEBOOK_ALLOW_PENDING=1, which marks them "[figure pending retrain]" and lists them. */
import { readFile, writeFile } from 'node:fs/promises';
import { NOTEBOOK, chapters, figure, figureData, FIGURE_PATTERN, key, mathTokens, root } from './notebook-source.mjs';
const allowPending = process.env.SICC_NOTEBOOK_ALLOW_PENDING === '1';
const files = await chapters(), data = await figureData();
const cache = JSON.parse(await readFile(new URL('docs/math/mathml-cache.json', root), 'utf8')).equations;
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const CONTAINERS = { summary: ['<div class="chapter-summary">', '</div>'],
    key: ['<div class="key-result"><span class="key-label">Key result</span>', '</div>'],
    technical: ['<details class="technical"><summary>Read the technical chapter</summary>', '</details>'] };
let count = 0;
const unresolved = [];

/** Section anchor of a source file: `chapter-N` for numbered chapters (the app links to these), else the file stem. */
const anchorOf = file => /^\d{2}-/.test(file) ? 'chapter-' + Number(file.slice(0, 2)) : file.replace(/\.md$/, '');
const headingId = line => /^(#{1,4})\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/.exec(line);
/** Heading ids per file, checked unique across the page. */
const ids = new Map(), seen = new Set([...files.map(f => anchorOf(f.file)), ...NOTEBOOK.parts.map(p => p.id), 'appendices']);
for (const { file, text } of files) {
    const own = new Set();
    let code = false;
    for (const line of text.split('\n')) {
        if (line.startsWith('```'))
            code = !code;
        const id = !code && headingId(line)?.[3];
        if (!id)
            continue;
        if (seen.has(id))
            throw new Error(`Duplicate heading id #${id} in docs/math/${file}.`);
        seen.add(id);
        own.add(id);
    }
    ids.set(file, own);
}
function href(url, from) {
    if (/^https?:\/\//.test(url))
        return url;
    const [path, fragment] = url.split('#'), name = path.split('/').pop();
    if (!path) {
        if (!seen.has(fragment))
            throw new Error(`Link to unknown anchor #${fragment} in docs/math/${from}.`);
        return '#' + fragment;
    }
    if (ids.has(name) && !path.startsWith('../')) {
        if (fragment && !ids.get(name).has(fragment))
            throw new Error(`Link to unknown anchor ${url} in docs/math/${from}.`);
        return '#' + (fragment ?? anchorOf(name));
    }
    if (url.startsWith('../'))
        return url.slice(3);
    return 'math/' + url;
}

function chapterHTML({ file, text, kind }) {
    const placeholders = [], figures = [];
    text = mathTokens(text, (tex, display) => { const found = cache[key(tex, display)]; if (tex.includes('{{fig:'))
        throw new Error(`Figure token inside TeX in docs/math/${file}: ${tex}`); if (!found || found.tex !== tex || found.display !== display || !found.mathml.startsWith('<math ') || /<(?:script|iframe|img)\b|\bon\w+=|\bhref=/i.test(found.mathml))
        throw new Error('Missing/invalid cached equation. Run the optional notebook-cache tool after TeX edits.'); count++; const token = 'SICCMATH' + placeholders.length + 'END'; placeholders.push(found.mathml); return token; });
    text = text.replace(FIGURE_PATTERN, (token, path, format = 'text') => {
        const result = figure(data, path, format);
        if (result.error)
            unresolved.push(`docs/math/${file}: ${token} (${result.error})`);
        figures.push(result.error ? `<span class="figure-pending" title="${escape(path)}">[figure pending retrain]</span>` : escape(result.value));
        return 'SICCFIG' + (figures.length - 1) + 'END';
    });
    function inline(line) { let s = escape(line); s = s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); s = s.split(/(<code>.*?<\/code>)/g).map(part => part.startsWith('<code>') ? part : part.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')).join(''); s = s.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, label, url) => { const u = href(url, file); return /^(?:https?:\/\/|#|math\/|research\/|engineering\/|\.\.\/)/.test(u) ? `<a href="${escape(u)}">${label}</a>` : label; }); return s.replace(/SICCMATH(\d+)END/g, (_, i) => placeholders[Number(i)]); }
    const out = [], paragraph = [], offset = kind === 'front' ? 1 : 2;
    let code = false, codeLines = [], list = false, item = [], tab = [], container = null, title = null;
    const flush = () => { if (paragraph.length) {
        out.push('<p>' + inline(paragraph.join(' ')) + '</p>');
        paragraph.length = 0;
    } };
    const flushItem = () => { if (item.length) {
        out.push('<li>' + inline(item.join(' ')) + '</li>');
        item = [];
    } };
    const closeList = () => { if (list) {
        flushItem();
        out.push(`</${list}>`);
        list = false;
    } };
    const closeTable = () => { if (tab.length) {
        const data = tab.filter(l => !/^\|[\s:|\-]+\|$/.test(l)).map(l => l.slice(1, -1).split('|').map(x => x.trim()));
        out.push('<div class="table-scroll"><table>' + data.map((row, i) => '<tr>' + row.map(c => `<${i ? 'td' : 'th'}>${inline(c)}</${i ? 'td' : 'th'}>`).join('') + '</tr>').join('') + '</table></div>');
        tab = [];
    } };
    for (const line of text.split('\n')) {
        if (line.startsWith('```')) {
            flush();
            closeList();
            closeTable();
            if (code) {
                out.push('<pre><code>' + escape(codeLines.join('\n')) + '</code></pre>');
                codeLines = [];
            }
            code = !code;
            continue;
        }
        if (code) {
            codeLines.push(line);
            continue;
        }
        const block = /^:::\s*([a-z]*)\s*$/.exec(line);
        if (block) {
            flush();
            closeList();
            closeTable();
            const name = block[1];
            if (name ? container || !CONTAINERS[name] : !container)
                throw new Error(`Unbalanced or unknown block "${line}" in docs/math/${file}.`);
            out.push(name ? CONTAINERS[name][0] : CONTAINERS[container][1]);
            container = name || null;
            continue;
        }
        if (line.startsWith('|') && line.endsWith('|')) {
            flush();
            closeList();
            tab.push(line);
            continue;
        }
        closeTable();
        if (!line.trim()) {
            flush();
            closeList();
            continue;
        }
        const heading = headingId(line);
        if (heading) {
            flush();
            closeList();
            const level = Math.min(6, heading[1].length + offset), id = heading[3] ? ` id="${heading[3]}"` : '';
            if (heading[1].length === 1)
                title ??= heading[2];
            out.push(`<h${level}${id}>${inline(heading[2])}</h${level}>`);
            continue;
        }
        const bullet = /^(?:([-*])|\d+\.)\s+(.+)/.exec(line);
        if (bullet) {
            flush();
            const type = bullet[1] ? 'ul' : 'ol';
            if (list !== type) {
                closeList();
                out.push(`<${type}>`);
                list = type;
            }
            flushItem();
            item.push(bullet[2]);
            continue;
        }
        if (list && /^\s+\S/.test(line) && !/^\s*SICCMATH\d+END\s*$/.test(line)) {
            item.push(line.trim());
            continue;
        }
        if (line.trim() === '---') {
            flush();
            closeList();
            out.push('<hr>');
            continue;
        }
        if (/^SICCMATH\d+END$/.test(line.trim())) {
            flush();
            closeList();
            out.push('<div class="display-equation">' + inline(line.trim()) + '</div>');
            continue;
        }
        paragraph.push(line.replace(/^>\s?/, ''));
    }
    flush();
    closeList();
    closeTable();
    if (code || container)
        throw new Error(`Unclosed code fence or block in docs/math/${file}.`);
    if (!title)
        throw new Error(`docs/math/${file} has no "# " title.`);
    const html = out.join('\n').replace(/SICCFIG(\d+)END/g, (_, i) => figures[Number(i)]);
    return { title: title.replace(FIGURE_PATTERN, '').trim(),
        html: `<section id="${anchorOf(file)}" class="notebook-chapter${kind === 'chapter' ? '' : ' notebook-' + kind}">${html}</section>` };
}

const rendered = new Map(files.map(f => [f.file, chapterHTML(f)]));
if (unresolved.length && !allowPending)
    throw new Error(`Unresolved notebook figures (${unresolved.length}); fix the token or regenerate the data ` +
        `(npm run research:quant). SICC_NOTEBOOK_ALLOW_PENDING=1 builds with visible markers:\n  ${unresolved.join('\n  ')}`);
const link = file => `<a href="#${anchorOf(file)}">${escape(rendered.get(file).title)}</a>`;
const group = (title, list) => `<div class="toc-group"><span>${escape(title)}</span>${list.map(link).join('')}</div>`;
const toc = group('Overview', NOTEBOOK.front) + NOTEBOOK.parts.map(p => group(p.title, p.chapters)).join('') +
    group('Appendices', NOTEBOOK.appendices);
const body = NOTEBOOK.front.map(f => rendered.get(f).html).join('\n') +
    NOTEBOOK.parts.map(p => `<div id="${p.id}" class="notebook-part"><h2>${escape(p.title)}</h2>${p.chapters.map(f => rendered.get(f).html).join('\n')}</div>`).join('\n') +
    `<div id="appendices" class="notebook-part"><h2>Appendices</h2>${NOTEBOOK.appendices.map(f => rendered.get(f).html).join('\n')}</div>`;
const build = (label, value) => figure(data, value, 'version').value ?? (() => { throw new Error(`Notebook header: no ${label}.`); })();
const nav = [['../#quant', 'Convert'], ['../#screenshot', 'Screenshot'], ['../#corpus', 'Settings data']].map(([u, l]) => `<a href="${u}">${l}</a>`).join('') +
    '<a href="notebook.html" aria-current="page">Mathematics</a><a href="../#evidence">Audit archive</a>';
const pendingMeta = unresolved.length ? `<meta name="sicc-notebook-pending" content="${unresolved.length}">` : '';
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'">${pendingMeta}<title>Mathematics · Small Indie Crosshair Company</title><link rel="stylesheet" href="../app/styles.css"><link rel="stylesheet" href="../app/notebook.css"></head><body><header class="notebook-top"><a class="notebook-brand" href="../#quant">Small Indie Crosshair Company</a><nav aria-label="Pages">${nav}</nav></header><main class="notebook"><h1>The mathematics of the converter</h1><p class="notebook-build">Model <code>${escape(build('model version', 'model.version'))}</code> · build ${escape(build('build', 'model.build'))} · release ${escape(build('release', 'package.version'))}</p><nav class="notebook-toc" aria-label="Contents">${toc}</nav>${body}</main><footer><p>Independent parody project. Not affiliated with Valve or Volvo.</p></footer></body></html>`;
await writeFile(new URL('docs/notebook.html', root), html);
const chapterCount = files.filter(f => f.kind === 'chapter').length;
console.log(`Built readable notebook: ${chapterCount} chapters in ${NOTEBOOK.parts.length} parts, ${files.length - chapterCount} other sections, ${count} expressions, ${Buffer.byteLength(html)} bytes.`);
if (unresolved.length)
    console.log(`Pending figures (${unresolved.length}), marked "[figure pending retrain]":\n  ${unresolved.join('\n  ')}`);
