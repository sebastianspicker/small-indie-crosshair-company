#!/usr/bin/env node
// Optional authoring dependency, not needed by verify, build or the deployed site.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { chapters, key, mathTokens, root } from './notebook-source.mjs';
const require = createRequire(import.meta.url), base = resolve(process.env.SICC_MATHJAX_ROOT ?? '.notebook-tools/node_modules/mathjax-full/js');
let mathjax, TeX, liteAdaptor, RegisterHTMLHandler, SerializedMmlVisitor;
try {
    ({ mathjax } = require(base + '/mathjax.js'));
    ({ TeX } = require(base + '/input/tex.js'));
    ({ liteAdaptor } = require(base + '/adaptors/liteAdaptor.js'));
    ({ RegisterHTMLHandler } = require(base + '/handlers/html.js'));
    ({ SerializedMmlVisitor } = require(base + '/core/MmlTree/SerializedMmlVisitor.js'));
    require(base + '/input/tex/AllPackages.js');
}
catch {
    throw new Error('Optional authoring tool missing. npm install --prefix .notebook-tools --no-save mathjax-full@3.2.2');
}
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: ['base', 'ams', 'newcommand', 'noundefined'] }), doc = mathjax.document('', { InputJax: tex }), visitor = new SerializedMmlVisitor(), cache = {};
for (const chapter of await chapters())
    mathTokens(chapter.text, (source, display) => {
        const id = key(source, display);
        if (!cache[id]) {
            const item = new doc.options.MathItem(source, tex, display);
            item.start.node = adaptor.body(doc.document);
            item.compile(doc);
            const mml = visitor.visitTree(item.root);
            if (mml.includes('<merror'))
                throw new Error('Invalid TeX: ' + source);
            cache[id] = { tex: source, display, mathml: mml };
        }
        return '';
    });
await writeFile(new URL('docs/math/mathml-cache.json', root), JSON.stringify({ schema: 'sicc-static-mathml-v1', generator: 'MathJax TeX input / serialized MathML; no fonts or runtime JS', equations: cache }, null, 2) + '\n');
console.log(`Compiled ${Object.keys(cache).length} unique equations to static native MathML.`);
