# 0003 — Export cvars, never guess a share-code layout

**Source:** [archived v0.4 plan §0.5, §0.6 and §4](../archive/v0.4-conversion-improvement-plan.md).

## Context

The build 2000914 update changed the crosshair cvars (`cl_crosshair_length`,
`cl_crosshair_thickness`, `cl_crosshair_gap`, `cl_crosshair_screen_height`)
without publishing a new share-code format. The project's only decoder,
`lib/settings/sharecode.js`, implements the legacy v1 layout (adapted from
`akiver/csgo-sharecode`, MIT). Some pre-update cvars still exist in the build
2000914 dump as hidden leftovers (`cl_crosshairsize`, `cl_crosshairthickness`,
`cl_crosshairalpha`) that the renderer does not read for the new geometry;
writing them into an export would silently reintroduce a legacy override.

## Decision

The app exports `cl_crosshair_*` console commands only. It never decodes or
encodes a hypothetical post-update share-code layout, and legacy v1 codes are
the only share-code format accepted on import — new-format codes are
reported as unsupported rather than guessed at. Exports never contain the
hidden legacy cvars, the removed pre-update names, or other unrelated
commands (`exec`, `bind`, `connect`, `host_writeconfig`).

## Consequences

- `lib/settings/sharecode.js`'s `decodeLegacy` throws when the version byte is not
  legacy v1 ("New-format share codes are intentionally unsupported"); no
  second decoder is added speculatively.
- `lib/settings/cfg.js` rejects build-2000914 cvars on legacy import with a dedicated
  message (`New-build cvars cannot be imported as legacy settings...`),
  enforced by `tests/lib/core.test.mjs`'s
  `'new-build cvars are rejected by the legacy importer...'` test.
- `tests/lib/core.test.mjs`'s `'exports never emit removed or hidden legacy
  commands and keep the new gap name'` test asserts, by regex token match,
  that `exportCFG` and `nativeCommands` output never contains
  `cl_crosshairsize`, `cl_crosshairthickness`, `cl_crosshairalpha`,
  `cl_crosshairgap` (the removed no-underscore name), `exec`, `bind`,
  `connect` or `host_writeconfig`, and that it does contain the new
  `cl_crosshair_gap` name.
- `lib/settings/cvars.js`'s `HIDDEN_LEFTOVERS` and `REMOVED_NAMES` are the
  single source of the names this rule protects; a future cvar rename must
  update that table, not a second hard-coded list.
