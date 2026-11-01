import { relative, sep } from 'node:path';

const LOCAL_DIRECTORIES = new Set(['node_modules', '__pycache__', 'venv', 'coverage', 'test-results', 'playwright-report', 'artifacts',
  'local-tests', 'scratch', 'private']);
const LOCAL_FILE = /(?:\.(?:py[co]|log|pem|key|p12|pfx|swp|swo)$|~$|^(?:Thumbs\.db|credentials\.json|secrets\.json)$)/i;

// Agent guides and local maintenance records; authored source ledgers and frozen evidence stay publishable.
const PRIVATE_DOCUMENTS = new Set(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'CODEX.md',
  'THINGS_TO_DO_LEDGER.md', 'THINGS_TO_DO_INDEX.md', 'ALPHA_AUDIT_LEDGER.md',
  'ALPHA_IMPLEMENTATION_LEDGER.md', 'ALPHA_AUDIT_REPORT.md'].map(name => name.toLowerCase()));
const isLocalPath = path => path.split('/').some(part => !part || part.startsWith('.') ||
  LOCAL_DIRECTORIES.has(part.toLowerCase()) || LOCAL_FILE.test(part) ||
  PRIVATE_DOCUMENTS.has(part.toLowerCase()) || /^THINGS_TO_DO_.*\.md$/i.test(part));

/** Single source of truth for what the build and the dev/preview server publish. */
export const PUBLISHED_DOCUMENTS = ['index.html', '404.html', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md'];
// Written into dist/ by the build; the preview server serves it like Pages does (the source tree has none).
const BUILD_OUTPUTS = ['build-manifest.json'];
export const PUBLISHED_DIRECTORIES = ['app', 'lib', 'data', 'public', 'docs', 'research', 'licenses'];
// Internal documents under docs/. Mirrors the docs/ entries of .gitignore (checked by the site-files test), so a local
// build from a full working copy publishes what CI publishes from a clean checkout.
export const INTERNAL_DOCUMENTS = [
  'docs/engineering/design.md',
  'docs/engineering/testing.md',
  'docs/engineering/decisions',
  'docs/engineering/archive',
  'docs/plans',
  'docs/drafts',
  'docs/roadmap',
  'docs/specs',
];
// Repo tooling that must stay private even though it lives under a published root directory.
const EXCLUDED_SUBPATHS = [
  'research/lib',
  'research/scripts',
  'research/generated/complexity-comparison.json',
  'research/generated/performance-local.json',
  'research/generated/accuracy-emulator.json',
  ...INTERNAL_DOCUMENTS,
];
const isExcludedSubpath = rel => EXCLUDED_SUBPATHS.some(sub => rel === sub || rel.startsWith(sub + '/'));
const directoryPattern = new RegExp(`^(?:${PUBLISHED_DIRECTORIES.join('|')})/`);

/** Build filtering is independent of Git: a source ZIP may contain local files. */
export function isSiteFile(root, path) {
  const rel = relative(root, path).split(sep).join('/');
  if (isExcludedSubpath(rel)) return false;
  return !isLocalPath(rel);
}

/** True when a server-relative path (no leading slash) is one the dev/preview server may serve. */
export function isPublishedPath(path) {
  if (isLocalPath(path) || isExcludedSubpath(path)) return false;
  return PUBLISHED_DOCUMENTS.includes(path) || BUILD_OUTPUTS.includes(path) || directoryPattern.test(path);
}
