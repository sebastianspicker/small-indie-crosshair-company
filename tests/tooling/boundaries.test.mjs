import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEdges, reachable, stripComments } from '../../scripts/import-graph.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const toPosix = p => p.split('\\').join('/');
const readRepoFile = path => readFileSync(posix.join(root, path), 'utf8');
const resolveRepoSpecifier = (fromPath, specifier) => toPosix(posix.normalize(posix.join(posix.dirname(fromPath), specifier)));

// --- shipped app never reaches research/ --------------------------------------------------------
// Research code (learned emulator, ranker, sensitivity, modulator, modulation contract, partition,
// regression) lives entirely under research/lib/ and must never enter the shipped conversion path
// (docs/engineering/decisions/0001-learned-emulator-research-only.md and successors).

const shipped = reachable(['app/main.js', 'app/worker/worker.js'], { readFile: readRepoFile, resolve: resolveRepoSpecifier });

test('shipped app never reaches any research/ module', () => {
  const reached = shipped.filter(path => path.startsWith('research/'));
  assert.deepEqual(reached, [],
    `the shipped app roots (app/main.js, app/worker/worker.js) reach research/ modules: ${reached.join(', ')}; ` +
    'docs/engineering/decisions/0001-learned-emulator-research-only.md requires research code to stay unreachable from the shipped app');
});

// --- generic recursive .js file listing ----------------------------------------------------------

function walkJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(posix.join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkJsFiles(path));
    else if (entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}
const libFiles = walkJsFiles('lib').sort();
const appFiles = walkJsFiles('app').sort();
const researchLibFiles = walkJsFiles('research/lib').sort();

test('lib/ and research/lib/ contain at least the modules this suite expects to exist', () => {
  assert.ok(libFiles.length > 0);
  assert.ok(researchLibFiles.length > 0);
  assert.ok(researchLibFiles.includes('research/lib/emulator.js'));
});

// --- app/ and lib/ never import research/ --------------------------------------------------------

for (const path of [...appFiles, ...libFiles]) {
  test(`${path} does not import research/`, () => {
    const { specifiers, nonLiteralDynamic } = extractEdges(readRepoFile(path));
    // A computed import() path cannot be checked statically, so it could reach research/ unseen.
    assert.equal(nonLiteralDynamic, 0, `${path} has a non-literal dynamic import(); app/ and lib/ must use literal specifiers`);
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const resolved = resolveRepoSpecifier(path, specifier);
      assert.ok(!resolved.startsWith('research/'), `${path} resolves '${specifier}' into ${resolved}; app/ and lib/ must never reach research/`);
    }
  });
}

// --- lib/ layers: a directory-shaped dependency rule replaces the old exact reachable-set snapshot,
// so adding/removing a shipped module no longer requires hand-updating a 29-path list; the table
// itself is the invariant. ------------------------------------------------------------------------

const LAYER_RULES = {
  'lib/settings/': ['lib/settings/'],
  'lib/geometry/': ['lib/geometry/', 'lib/settings/'],
  'lib/image/': ['lib/image/', 'lib/geometry/', 'lib/settings/'],
  'lib/solver/': ['lib/solver/', 'lib/geometry/', 'lib/settings/'],
  'lib/manual/': ['lib/manual/', 'lib/geometry/', 'lib/settings/'],
};

/** Which layer a repo-relative lib/ path belongs to, or null if it is not under a declared layer. */
function layerOf(path) {
  return Object.keys(LAYER_RULES).find(prefix => path.startsWith(prefix)) ?? null;
}

/** True if a file in `layer` is allowed to import a module resolving to `resolved`. */
function layerAllows(layer, resolved) {
  return LAYER_RULES[layer].some(allowed => resolved.startsWith(allowed));
}

test('layerAllows() detects a synthetic cross-layer violation', () => {
  // lib/settings/ may only import lib/settings/: a settings module reaching into the solver
  // (layer inversion) must be flagged.
  assert.equal(layerAllows('lib/settings/', 'lib/solver/renderer.js'), false);
  // lib/solver/ may import lib/geometry/: the declared, allowed direction.
  assert.equal(layerAllows('lib/solver/', 'lib/geometry/legacy.js'), true);
});

for (const path of libFiles) {
  test(`${path} only imports its declared lib/ layers`, () => {
    const layer = layerOf(path);
    assert.ok(layer, `${path} is not under a declared lib/ layer (lib/settings, lib/geometry, lib/image, lib/solver, lib/manual)`);
    const { specifiers } = extractEdges(readRepoFile(path));
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const resolved = resolveRepoSpecifier(path, specifier);
      assert.ok(layerAllows(layer, resolved),
        `${path} resolves '${specifier}' into ${resolved}, which layer ${layer} may not import`);
    }
  });
}

// --- lib/ and research/lib/ stay pure: relative specifiers only, no reach into app/, no DOM/worker
// globals. research/lib/ is pure the same way lib/ is (docs/engineering/architecture.md); it is
// just not reachable from the shipped app roots. --------------------------------------------------

for (const path of [...libFiles, ...researchLibFiles]) {
  test(`${path} only imports relative modules, never app/`, () => {
    const { specifiers } = extractEdges(readRepoFile(path));
    for (const specifier of specifiers) {
      assert.ok(specifier.startsWith('.'), `${path} has a bare or absolute specifier '${specifier}'; lib/ and research/lib/ must only use relative imports`);
      const resolved = resolveRepoSpecifier(path, specifier);
      assert.ok(!resolved.startsWith('app/'), `${path} resolves '${specifier}' into ${resolved}; it must stay pure and never import app/`);
    }
  });
}

const FORBIDDEN_GLOBAL_TOKENS = [/\bdocument\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bpostMessage\b/, /\bimportScripts\b/, /\bfetch\s*\(/];
const WINDOWLIKE_GLOBALS = ['window', 'self'];

/** Blank string and template contents (comments were already stripped by the caller) so a
 * forbidden token embedded in a message string never trips the check. Interpolations inside
 * template literals are blanked too; that is a deliberate over-approximation for lib/. */
function blankStringLiterals(text) {
  let out = '', i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '\'' || c === '"' || c === '`') {
      const quote = c; out += ' '; i++;
      while (i < n && text[i] !== quote) {
        if (text[i] === '\\' && i + 1 < n) { i += 2; out += '  '; continue; }
        out += text[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < n) { out += ' '; i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

/** A local parameter/const/let/var/destructure binding of `name` shadows the DOM/worker
 * global, so `name.property` accesses are not global-scope reaches. lib/solver/certify.js
 * has exactly this case: `intersectWindow(window, domain)` binds a local `window`. */
function hasLocalBinding(code, name) {
  const declared = new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`);
  const destructured = new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b`);
  const parameter = new RegExp(`[(,]\\s*${name}\\s*[,)=]`);
  return declared.test(code) || destructured.test(code) || parameter.test(code);
}

for (const path of [...libFiles, ...researchLibFiles]) {
  test(`${path} does not use DOM/worker globals`, () => {
    const code = blankStringLiterals(stripComments(readRepoFile(path)));
    for (const pattern of FORBIDDEN_GLOBAL_TOKENS) {
      assert.doesNotMatch(code, pattern, `${path} matches forbidden global ${pattern}; lib/ and research/lib/ must stay DOM/worker-free (app/ owns that code)`);
    }
    for (const name of WINDOWLIKE_GLOBALS) {
      if (hasLocalBinding(code, name)) continue;
      assert.doesNotMatch(code, new RegExp(`\\b${name}\\.`), `${path} matches forbidden global '${name}.'; lib/ and research/lib/ must stay DOM/worker-free (app/ owns that code)`);
    }
  });
}

// --- helper fixtures: synthetic in-memory graphs, no filesystem access -------------------------

function inMemoryGraph(files) {
  return { readFile: path => files[path], resolve: (fromPath, specifier) => toPosix(posix.normalize(posix.join(posix.dirname(fromPath), specifier))) };
}

test('reachable() follows a forbidden edge', () => {
  const files = { 'a.js': "import { x } from './b.js';", 'b.js': 'export const x = 1;' };
  assert.deepEqual(reachable(['a.js'], inMemoryGraph(files)), ['a.js', 'b.js']);
});

test('reachable() throws on a non-literal dynamic import()', () => {
  const files = { 'a.js': 'const name = pick(); export const y = import(name);' };
  assert.throws(() => reachable(['a.js'], inMemoryGraph(files)), /non-literal/);
});

test('reachable() follows new URL(literal, import.meta.url)', () => {
  const files = { 'a.js': "const w = new URL('./worker.js', import.meta.url);", 'worker.js': 'export const w = 1;' };
  assert.deepEqual(reachable(['a.js'], inMemoryGraph(files)), ['a.js', 'worker.js']);
});

test('reachable() follows export {a} from', () => {
  const files = { 'a.js': "export { thing } from './b.js';", 'b.js': 'export const thing = 1;' };
  assert.deepEqual(reachable(['a.js'], inMemoryGraph(files)), ['a.js', 'b.js']);
});

test('reachable() ignores specifiers inside comments', () => {
  const files = {
    'a.js': "// import { x } from './forbidden.js';\n/* import './also-forbidden.js'; */\nexport const kept = 1;",
    'forbidden.js': 'export const x = 1;',
    'also-forbidden.js': 'export const y = 1;',
  };
  assert.deepEqual(reachable(['a.js'], inMemoryGraph(files)), ['a.js']);
});

test('regex literals containing comment openers do not hide later imports', () => {
  for (const source of [
    "const re = /\\/*foo/; import { e } from './emulator.js';",
    "const re = /[/*]/g; import { e } from './emulator.js';",
    "x = s.replace(/\\/\\//, ''); import { e } from './emulator.js';",
    "function f() { return /\\/*/.test(s); }\nimport { e } from './emulator.js';",
  ]) assert.deepEqual(extractEdges(source).specifiers, ['./emulator.js'], source);
  // Division is not a regex: the comment after it is still stripped.
  assert.deepEqual(extractEdges("const h = a / b; // import './x.js';\nconst k = (a) / 2 /* import './y.js' */;").specifiers, []);
});

test('extractEdges counts dynamic import() literal and non-literal forms separately', () => {
  const literal = extractEdges("import('./x.js');");
  assert.deepEqual(literal.specifiers, ['./x.js']);
  assert.equal(literal.nonLiteralDynamic, 0);
  const dynamic = extractEdges('import(path);');
  assert.equal(dynamic.specifiers.length, 0);
  assert.equal(dynamic.nonLiteralDynamic, 1);
});
