# Interface design and browser review

The interface follows one idea: **the app is a small, very serious metrology
office that issues an inspection sheet for your crosshair.** Each route is a
numbered sheet (01 Convert through 06 Archive). Each sheet head carries a
drawing-style *title block* with the build, model, snapshot and the field
**Checked in game: Not yet**. The uncertainty is a field on the sheet, not a
repeated banner. The reasoning, the audience profile and the three directions
that were considered are in [`DESIGN_BRIEF.md`](../../DESIGN_BRIEF.md).

## System rules

- **Paper and plate.** The page is paper: graphite in the dark theme, bone in
  the light one, following the OS. The crosshair always sits on a dark
  *specimen plate*, because the plate stands in for the game screen. The
  user's crosshair colour is the only saturated colour on the plate.
- **Archivo speaks, Martian Mono measures.**
  - Archivo is used condensed for sheet titles and at normal width for text.
  - Martian Mono is used for everything a player could type into the
    console: values, cvars, codes, tags and sheet numbers.
  - Both are self-hosted OFL variable fonts
    ([ADR-0006](decisions/0006-self-hosted-open-licensed-typefaces.md)).
- **One signal colour.** Sodium yellow (ochre on light paper) marks
  annotations, focus, the primary action and conditional status. Vermilion is
  reserved for blockers and errors. Green never appears in the UI chrome, so
  the crosshair is never competing with it.
- **Hairlines, not shadows.** Square instruments, 1 px rules, and a heavy
  2 px rule to open a region. The only shadow belongs to the modal dialog.
- **Tokens first.** Every colour, size, space and duration is a custom
  property in `app/styles.css`, including the canvas colours: the preview
  painters read `--plate`, `--plate-grid`, `--plate-annot` and `--diff-*` at
  paint time.

## Primary screen

The Simple view of sheet 01 is an input column (A paste, B old values,
C resolution, D colour) beside a sticky **reading** panel. The reading panel
holds:

- two specimen plates at one shared, auto-fitted magnification (for example
  "×20 · one cell = one game pixel"), with dimension lines reporting the
  drawn arm length and thickness in game pixels;
- the three new values as large numerals;
- the console lines as text, so they can be typed by hand;
- copy and download actions.

On phones the order changes: paste, then the answer, then adjustments.

Magnification, grid and dimension lines are presentation only. They never
change geometry, inference or exports.

## States

- **Pending:** the numerals dim while the worker computes, and nothing moves.
- **Error:** the message replaces the answer under the reading heading, and
  the plates say "No valid input".
- **Blocked:** the first blocker is shown in full, and copy and download are
  disabled.
- **Status regions:** they stay `role="status"`. Colour is never the only
  signal: tags carry text, and diff colours are named in the captions.

## Accessibility

- All text roles meet WCAG 2.2 AA in both themes (ink ≥ 14:1, secondary ink
  ≥ 6:1, signal text ≥ 5.5:1).
- Control boundaries use `--edge` (≥ 3:1).
- Focus is a 2 px signal outline.
- Motion is limited to short opacity and rotation transitions, and is removed
  under `prefers-reduced-motion`.
- Forced-colours mode keeps the tag and toggle markers visible.

## Review process

Browser screenshots are taken from the real HTML, CSS and ES modules over the
local server (`npm run dev`) with Playwright:

- viewports: 1440, 768 and 390 wide;
- both colour schemes;
- every route, plus the error, blocked, dialog and focus states.

`tests/browser/quant_browser.py` and `tests/browser/browser_smoke.py` run in
both localhost and `--in-memory` modes.

No ten-out-of-ten design rating, full accessibility audit, browser-matrix
approval or native game rendering validation is asserted.
