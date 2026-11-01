#!/usr/bin/env node
// Guards the npm scripts that need the maintainers' private test and research harness, which is gitignored and so
// absent from a public checkout. Without the guard, `npm test` there passed with 0 tests and other scripts died with
// MODULE_NOT_FOUND. Usage in package.json: `node scripts/require-private.mjs <path>... && <command>`.
import { existsSync } from 'node:fs';

const missing = process.argv.slice(2).filter(path => !existsSync(path));
if (missing.length) {
  console.error(`${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} part of the maintainers' private test and ` +
    'research harness, which is not in the public repository.\n' +
    'A public checkout needs only npm run dev, npm run build and npm run preview; see CONTRIBUTING.md.');
  process.exit(1);
}
