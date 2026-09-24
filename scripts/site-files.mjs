import { relative, sep } from 'node:path';

const LOCAL_DIRECTORIES = new Set(['node_modules', '__pycache__', 'venv', 'coverage', 'test-results', 'playwright-report', 'artifacts']);
const LOCAL_FILE = /(?:\.(?:py[co]|log|pem|key|p12|pfx|swp|swo)$|~$|^(?:Thumbs\.db|credentials\.json|secrets\.json)$)/i;

/** Single source of truth for what the build and the dev/preview server publish. */
export const PUBLISHED_DOCUMENTS = ['index.html', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md'];
export const PUBLISHED_DIRECTORIES = ['app', 'lib', 'data', 'public', 'docs', 'research', 'licenses'];
// Repo tooling that must stay private even though it lives under a published root directory.
const EXCLUDED_SUBPATHS = ['research/scripts'];
const isExcludedSubpath = rel => EXCLUDED_SUBPATHS.some(sub => rel === sub || rel.startsWith(sub + '/'));
const directoryPattern = new RegExp(`^(?:${PUBLISHED_DIRECTORIES.join('|')})/`);

/** Build filtering is independent of Git: a source ZIP may contain local files. */
export function isSiteFile(root, path) {
  const rel = relative(root, path).split(sep).join('/');
  if (isExcludedSubpath(rel)) return false;
  const parts = rel.split('/');
  return parts.every(part => part && !part.startsWith('.') && !LOCAL_DIRECTORIES.has(part) && !LOCAL_FILE.test(part));
}

/** True when a server-relative path (no leading slash) is one the dev/preview server may serve. */
export function isPublishedPath(path) {
  if (isExcludedSubpath(path)) return false;
  return PUBLISHED_DOCUMENTS.includes(path) || directoryPattern.test(path);
}
