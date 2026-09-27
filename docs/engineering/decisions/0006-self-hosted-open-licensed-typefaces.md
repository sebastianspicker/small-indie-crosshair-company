# 0006 — Self-hosted, open-licensed typefaces

**Source:** the 2026-09 interface redesign; see [design](../design.md) and
`DESIGN_BRIEF.md`.

## Context

The interface used the system font stack so that it would not ship font files,
and the CSP set `font-src 'none'`. The redesign relies on type for most of its
character: a condensed display voice for sheet titles and a monospace for every
value a player can type into the console. Remote font services are ruled out
because the app makes no network request to a third party
([ADR-0004](0004-no-runtime-dependencies-or-persistence.md)).

## Decision

The app ships two variable WOFF2 files under `public/fonts/`, each subset to
Latin:

- Archivo (weight and width axes)
- Martian Mono (weight and width axes)

Both are licensed under the SIL Open Font License 1.1. Their license texts are
in `licenses/`, and they are listed in `THIRD_PARTY_NOTICES.md`. The CSP in
`index.html`, `scripts/http-policy.mjs` and the generated notebook changes from
`font-src 'none'` to `font-src 'self'`, and the dev server serves `.woff2` as
`font/woff2`.

The files are static assets, not packages. There is no build step, no
registry, and no runtime request beyond the same origin.

## Consequences

- There is still no `dependencies` entry, and verification still works
  offline. Fonts are fetched only from the app's own origin.
- Every `font-family` stack ends in a metric-adjusted local fallback. If the
  files are removed, the layout degrades to system fonts rather than breaking.
- Replacing or adding a typeface needs an OFL (or equally permissive) license
  text in `licenses/`, a THIRD_PARTY_NOTICES entry and a Latin-subset WOFF2.
  The weight budget is about 150 KB in total.
