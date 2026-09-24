# 0004 — No runtime dependencies or persistence

**Source:** [CONTRIBUTING.md](../../../CONTRIBUTING.md),
[archived v0.4 plan §0.7](../archive/v0.4-conversion-improvement-plan.md).

## Context

The project is a local, account-free converter. Adding an npm runtime
dependency or any form of client-side persistence (`localStorage`,
`IndexedDB`, cookies, a service worker) would change that promise: it would
add a supply chain to audit, or make the app remember data across sessions
without the user exporting it.

## Decision

No production dependency is required to run, build, verify or deploy the
app. `package.json` declares no `dependencies` entry. `app/` and `lib/` never
read or write `localStorage`, `IndexedDB`, cookies or a service worker; state
lives only in the current tab, and anything durable is an explicit user
export (a downloaded `.cfg` or JSON report). The only optional tooling that
touches a package registry is the authoring-only MathJax cache compiler
(`.notebook-tools`, gitignored, not installed by `npm run verify` or the
Pages build).

## Consequences

- `scripts/check.mjs` syntax-checks every `app/`, `lib/`, `scripts/` and
  `tests/` module and rejects `eval`, `new Function` and `.innerHTML =` in
  `app/` and `lib/`; `npm run verify` never runs `npm install`.
  `tests/tooling/boundaries.test.mjs` additionally asserts that no `lib/**/*.js`
  module contains a bare (package) import specifier or a DOM/worker global
  (`document`, `window.`, `self.`, `postMessage`, `localStorage`, `fetch(`).
- A grep of `app/` and `lib/` for `localStorage`, `indexedDB` and
  `IndexedDB` currently returns nothing; a reviewer adding any of them to a
  shipped module is introducing persistence and must get this ADR revised
  first, not add it quietly.
- `scripts/build.mjs` and `scripts/serve.mjs` make no network request and
  need no installed package; `npm run verify` (check, research regeneration,
  tests, audits, archive reproduction, build) is runnable offline after
  `git clone`.
- Adding a *dev-only* tool (for example TypeScript for type-checking, see
  the maintenance plan's phase 4) is a distinct, separately-approved
  decision: it must stay out of the runtime and shipped `dist/` output.
