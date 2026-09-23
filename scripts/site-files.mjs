import { relative, sep } from 'node:path';

const LOCAL_DIRECTORIES = new Set(['node_modules', '__pycache__', 'venv', 'coverage', 'test-results', 'playwright-report', 'artifacts']);
const LOCAL_FILE = /(?:\.(?:py[co]|log|pem|key|p12|pfx|swp|swo)$|~$|^(?:Thumbs\.db|credentials\.json|secrets\.json)$)/i;

/** Build filtering is independent of Git: a source ZIP may contain local files. */
export function isSiteFile(root, path) {
  const parts = relative(root, path).split(sep);
  return parts.every(part => part && !part.startsWith('.') && !LOCAL_DIRECTORIES.has(part) && !LOCAL_FILE.test(part));
}
