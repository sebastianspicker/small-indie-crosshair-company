#!/usr/bin/env node
/** Bounded Markdown subset for our checked-in notebook. No runtime Markdown or HTML evaluation. */
import { readFile, writeFile } from 'node:fs/promises';
import { chapters, key, mathTokens, root } from './notebook-source.mjs';
const files = await chapters(), cache = JSON.parse(await readFile(new URL('docs/math/mathml-cache.json', root), 'utf8')).equations;
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
let count = 0;
function chapterHTML({ file, text }, index) {
    const placeholders = [];
    text = mathTokens(text, (tex, display) => { const found = cache[key(tex, display)]; if (!found || found.tex !== tex || found.display !== display || !found.mathml.startsWith('<math ') || /<(?:script|iframe|img)\b|\bon\w+=|\bhref=/i.test(found.mathml))
        throw new Error('Missing/invalid cached equation. Run the optional notebook-cache tool after TeX edits.'); count++; const token = 'SICCMATH' + placeholders.length + 'END'; placeholders.push(found.mathml); return token; });
    const href = url => { const path = url.split('#')[0].split('/').pop(), match = files.findIndex(c => c.file === path); if (match >= 0)
        return '#chapter-' + (match + 1); if (/^https?:\/\//.test(url))
        return url; if (url.startsWith('../'))
        return url.slice(3); return 'math/' + url; };
    function inline(line) { let s = escape(line); s = s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); s = s.split(/(<code>.*?<\/code>)/g).map(part => part.startsWith('<code>') ? part : part.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')).join(''); s = s.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, label, url) => { const u = href(url); return /^(?:https?:\/\/|#|math\/|research\/|engineering\/|\.\.\/)/.test(u) ? `<a href="${escape(u)}">${label}</a>` : label; }); return s.replace(/SICCMATH(\d+)END/g, (_, i) => placeholders[Number(i)]); }
    const out = [], paragraph = [];
    let code = false, codeLines = [], list = false, tab = [];
    const flush = () => { if (paragraph.length) {
        out.push('<p>' + inline(paragraph.join(' ')) + '</p>');
        paragraph.length = 0;
    } };
    const closeList = () => { if (list) {
        out.push('</ul>');
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
        const heading = /^(#{1,4})\s+(.+)/.exec(line);
        if (heading) {
            flush();
            closeList();
            const level = Math.min(4, heading[1].length + 1);
            out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
            continue;
        }
        const bullet = /^(?:[-*]|\d+\.)\s+(.+)/.exec(line);
        if (bullet) {
            flush();
            if (!list) {
                out.push('<ul>');
                list = true;
            }
            out.push('<li>' + inline(bullet[1]) + '</li>');
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
    return `<article id="chapter-${index + 1}" class="notebook-chapter">${out.join('\n')}</article>`;
}
const articles = files.map(chapterHTML).join('\n'), toc = files.map((c, i) => `<a href="#chapter-${i + 1}">${escape(c.text.split('\n')[0].replace(/^#\s*/, ''))}</a>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'"><title>Mathematical notebook · Small Indie Crosshair Company</title><link rel="stylesheet" href="../app/styles.css"><link rel="stylesheet" href="../app/notebook.css"></head><body><header class="notebook-top"><a href="../#research">← Back to the converter</a><span>Small Indie Crosshair Company</span></header><main class="notebook"><h1>How the conversion works</h1><p>The geometry, assumptions, and experiments behind the converter. ${files.length} chapters · snapshot September 23, 2026. The models still need validation against original game captures.</p><nav class="notebook-toc" aria-label="Chapters">${toc}</nav>${articles}</main><footer><p>Model weights can use scoped native measurements. Synthetic examples do not update them.</p></footer></body></html>`;
await writeFile(new URL('docs/notebook.html', root), html);
console.log(`Built readable notebook: ${files.length} chapters, ${count} expressions, ${Buffer.byteLength(html)} bytes.`);
