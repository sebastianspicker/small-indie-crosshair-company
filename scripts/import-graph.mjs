/** Pure static-import graph helpers for the shipped-vs-research boundary tests.
 * No filesystem or network access happens on import; callers inject `readFile`/`resolve`. */

/** Replace `//` and slash-star comments with whitespace of the same shape, leaving string and
 * template contents untouched, so downstream regexes never match text that is only a comment. */
export function stripComments(text) {
  let out = '', i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i], c2 = text[i + 1];
    // A regex literal such as /\/*x/ contains a comment opener; copy it verbatim so the rest
    // of the file is not swallowed as a "comment" (which would hide imports: fail open).
    if (c === '/' && c2 !== '/' && c2 !== '*' && regexAllowed(out)) {
      let inClass = false;
      out += c; i++;
      while (i < n && text[i] !== '\n') {
        const d = text[i];
        if (d === '\\' && i + 1 < n) { out += d + text[i + 1]; i += 2; continue; }
        out += d; i++;
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) break;
      }
      continue;
    }
    if (c === '/' && c2 === '/') {
      while (i < n && text[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && c2 === '*') {
      out += '  '; i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) { out += text[i] === '\n' ? '\n' : ' '; i++; }
      if (i < n) { out += '  '; i += 2; }
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      const quote = c; out += c; i++;
      while (i < n && text[i] !== quote) {
        if (text[i] === '\\' && i + 1 < n) { out += text[i] + text[i + 1]; i += 2; continue; }
        out += text[i]; i++;
      }
      if (i < n) { out += text[i]; i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

/** Standard heuristic: `/` starts a regex literal unless it follows a value (identifier,
 * number, `)` or `]`); keywords such as `return` and `typeof` still allow a regex. */
function regexAllowed(before) {
  const tail = before.trimEnd();
  if (!tail) return true;
  const last = tail[tail.length - 1];
  if (last === ')' || last === ']') return false;
  if (!/[\w$]/.test(last)) return true;
  const word = /[\w$]+$/.exec(tail)[0];
  return /^(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/.test(word);
}

const STATIC_IMPORT = /\bimport\s+(?:[^'"`;]*?\sfrom\s+)?(['"])([^'"]+)\1/gs;
const EXPORT_FROM = /\bexport\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s+(['"])([^'"]+)\1/gs;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
const IMPORT_CALL = /\bimport\s*\(/g;
const NEW_URL = /\bnew\s+URL\s*\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g;

/** Extract module edges from source text: static `import`/`export … from`, dynamic
 * `import('literal')`, and `new URL('literal', import.meta.url)` (how the research worker is
 * created, see app/worker/client.js). Comments never contribute edges. Dynamic `import(x)` calls
 * whose argument is not a string literal are not statically checkable and are counted instead. */
export function extractEdges(sourceText) {
  const text = stripComments(sourceText);
  const specifiers = [];
  let m;
  STATIC_IMPORT.lastIndex = 0;
  while ((m = STATIC_IMPORT.exec(text))) specifiers.push(m[2]);
  EXPORT_FROM.lastIndex = 0;
  while ((m = EXPORT_FROM.exec(text))) specifiers.push(m[2]);
  NEW_URL.lastIndex = 0;
  while ((m = NEW_URL.exec(text))) specifiers.push(m[2]);

  const literalSpans = [];
  DYNAMIC_IMPORT.lastIndex = 0;
  while ((m = DYNAMIC_IMPORT.exec(text))) { specifiers.push(m[2]); literalSpans.push([m.index, m.index + m[0].length]); }
  let nonLiteralDynamic = 0;
  IMPORT_CALL.lastIndex = 0;
  while ((m = IMPORT_CALL.exec(text))) {
    if (!literalSpans.some(([start, end]) => m.index >= start && m.index < end)) nonLiteralDynamic++;
  }
  return { specifiers, nonLiteralDynamic };
}

/** Breadth-first module reachability from `roots` (repo-relative paths). Only relative
 * specifiers (starting with `.`) are followed; bare/absolute specifiers are left for callers
 * that check purity. Throws if any visited file has a non-literal dynamic `import(x)`, since
 * such a file cannot be proven not to reach a forbidden module. Returns a sorted, deduplicated
 * list of every reachable repo-relative path, including the roots themselves. */
export function reachable(roots, { readFile, resolve }) {
  const seen = new Set();
  const queue = [...new Set(roots)];
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const text = readFile(path);
    const { specifiers, nonLiteralDynamic } = extractEdges(text);
    if (nonLiteralDynamic > 0) {
      throw new Error(`${path}: dynamic import() with a non-literal argument cannot be statically verified not to reach the research modules`);
    }
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const next = resolve(path, specifier);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen].sort();
}
