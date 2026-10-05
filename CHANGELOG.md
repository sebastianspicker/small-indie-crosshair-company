# Changelog

## Unreleased

## 0.13.0 (unreleased)

- Advance the automatic converter to `community-static-v7`
  (`lib/solver/community.js`); model id, build and report schema are unchanged.
- Old style 5 uses its own at-rest gap, a height-scaled rounded distance, and
  always warns `legacy-style-5-gap`; the styles 2/3 `style-dynamic-at-rest`
  note is reworded and the style 0/1 blocker cites the pre-update dump
  (ADR-0018, `lib/geometry/community.js`).
- The appearance window follows the old shape (ADR-0019,
  `lib/solver/community-refine.js`): its reach extends to the old shape's edges
  and the dot outline, a second length window keeps the outer edge of the bars,
  the thickness reach covers thick short bars, a crossed T may export as a
  plain cross (`t-flipped-for-shape`), the window runs for every old outline
  width, and the reach cap is 32 px. Against a brute-force oracle
  (`docs/research/oracle-sweeps-2026-10-05.md`, `research/scripts/oracle-sweep.mjs`),
  the plain 5,000-input sweep goes from 106 shortfalls to 0 and the exotic
  2,000-input sweep from 624 to 18, with no export scoring worse.
- The share-code size field is 13 bits; sizes above 25.5 decoded wrongly before
  (`lib/settings/sharecode.js`).
- The CFG importer accepts vcfg quoted names, `name = value` echo lines and
  `]`/`[Console]` prompts, and skips binds, aliases and unknown cvars with a
  note (`lib/settings/cfg.js`).
- The converter is one page with an in-place Expert toggle, a Clear button, an
  "Examples" strip of exotic shapes and a graphite/orange palette
  (`app/convert/view.js`, `app/convert/samples.js`, `app/convert.css`).
- The Simple preview marks the true screen centre with a ring and rules crossed
  arms by their span, and the expert "Proposed values" note is aligned
  (`app/convert/preview.js`, `app/convert/presentation.js`).
- The edge-case audit adds the categories seam, frame, strokes-crossed and
  thick, and labels size-0 shapes with T as `-t` so a flipped three-stroke T
  counts as a flip (`research/scripts/edge-case-audit.mjs`).
- The ML cross-check is retrained on v7 (`lib/solver/ml-crosscheck.js`,
  `research/generated/crosscheck-emulator.json`): fresh held-out agreement 99.38% (99.08–99.63%, 5,632 rows),
  edge challenge 99.49% (99.12–99.77%); rule baselines 65.94% and 50.91%.
- What this release does and does not verify. "Exact" means exact under the
  reconstructed old renderer (its port matched the leaked source pixel for
  pixel on 483,840 cases) and the new-renderer equations carried over from
  build 2000918; no capture of build 2000922 checks any edge case (size 0,
  crossed arms, the T flip, wide outlines, style 5). The oracle sweeps measure
  the converter's own objective, and the ML cross-check rate is agreement with
  the converter, not with the game. 18 exotic inputs stay short of the best
  tuple on purpose (wide outlines where the only gain doubles the bar into the
  black band, strokes beyond the 32 px reach cap). Overpaint seams, outlines
  wider than 1 px, additive colour, weapon gaps and odd-width centring are
  approximated and each export says so. A paste that omits a cvar gets the
  pre-update game default, which for the outline means on; the table marks
  those rows as added.

## 0.12.0

- Advance to `community-static-v6`: the automatic converter
  reproduces the old visible appearance in three edge cases. Crossed arms
  from negative gaps (issue #15) are folded to the same pixels with a
  non-negative gap instead of clamping to a solid plus (`crossed-arms-folded`;
  a crossed T keeps T and warns `inverted-t-unrepresentable`). Size 0
  with an outline and no dot (issue #11) exports the old strokes as black bars
  with the outline off (`outline-only-as-core`; issue #11 at 1080: length 1,
  thickness 9, gap 3, colour 0 0 0 230). Size 0 with a dot adds arms at gap 0
  inside the dot square (`dot-only-as-arms`, and `zero-length-outline-dropped`
  with an outline). The new-game model draws nothing for zero-length bars,
  outline included (user capture, issue #11). Reports add `shapeCheck`,
  `canonicalTarget`, `edgeCase` and `exportOverrides` (colour, outline mode;
  `t_style` is accepted but no longer set), which `nativeCommands` accepts. A new edge-case audit
  (part of the corpus study): published rows `approximate` were 16 at v5. After
  the edge-case rules only Jame (pro-049, 4 rows) stayed approximate; with the
  draw-order rules and the appearance window the final count is 28 of 552 corpus rows (Jame x4, and pro-006,
  016, 055, 061, 074, 129 x4 for `outline-overpaint-lost`) and 0 of 32 preset
  rows (`research/generated/edge-case-audit.json`). 39 of 938 equal-height corpus exports and 2 of the 24
  crosshair.club tuples change on purpose (the two size-0 dot cases, where
  crosshair.club exports length 0); the rest are unchanged.
- Second round of old-game edge cases (still `community-static-v6`),
  from a survey of other converters and the leaked old renderer
  (`docs/research/competitor-survey-2026-10-02.md`, ledger S15 to S18):
  - The old side of the shape check and the old previews paint in the old
    order (left, right, top, bottom, dot; each outline, then its fill), so a
    later outline covers earlier fills. Six corpus rows (pro-006, 016, 055,
    061, 074, 129) become `approximate` with `outline-overpaint-lost`; their
    exports are unchanged.
  - `cl_crosshairusealpha 0`: the old fill was additive at 200; the current
    game blends normally. The export keeps the colour at fill alpha 255
    (`cl_crosshaircolor_a 255`; the outline keeps 200, as the old outline was
    a normal black blend at 200) and warns `additive-blend-approximated`. The
    old fill never dimmed the background, a normal blend at 200 looks dimmer
    than it ever did, a luminance-weighted fit gives about 230 for the bright
    presets, and all five other converters export 255. A fitted alpha was
    rejected because it depends on the error measure
    (`research/generated/additive-alpha.json`). Example, a usealpha-0 preset
    (donk, green): `…;cl_crosshaircolor_r 50;cl_crosshaircolor_g 250;cl_crosshaircolor_b 50;cl_crosshaircolor_a 255;…`.
  - Outline thickness above 3 is clamped to 3 on import, with a note; 0 stays 0.
  - `cl_crosshairgap_useweaponvalue 1` converts with the non-weapon gap and
    warns `weapon-gap-dropped` instead of blocking. Old styles 0 and 1 stay
    blocked with a message that suggests old style 4.
  - A capture of the current game shows the outline alpha is not multiplied by
    the crosshair alpha, so `outline-alpha-unverified` is gone.
  - bindr joins the cross-tool baselines; the edge-case audit
    (`sicc-edge-case-audit-v2`) tallies each rule.
- Appearance refinement (still `community-static-v6`), from an
  independent geometry audit. At the pixel goal, when the old outline draws at
  most 1 px on each side and the shape check of the dimension-first export is
  approximate, the converter scores every tuple within length ±3, thickness ±3
  and gap ±4 by the shape check's aligned colour overlap. A tuple replaces the
  export only if it draws the old visible pixels strictly better
  (`decision.refinement`, warning `appearance-refined`). Exact and shifted
  exports never change. Screen goals and wider old outlines keep the
  dimension-first result.
  - A dot outline over short arms now exports the arms it covers (size 1,
    thickness 2, gap -4, dot, outline 1 at 1080: 2/4/2 → 1/4/3, exact).
  - Jame (pro-049, size 0, dot, outline) exports 1/1/1, aligned IoU 0.43 →
    0.81 (17 of 21 pixels). It is the only corpus or preset export that
    changes. `zero-length-outline-dropped` and `outline-overpaint-lost` now
    appear only while the check stays approximate, and call the export the
    closest shape found within the search window.
  - On the edge-case audit grid (34,560 synthetic rows at four equal heights)
    the window changes 1,817 exports, and approximate rows fall from 19,378
    to 18,787. Screen goals keep the dimension-first result, an accepted
    limitation.
  - Outline widths above 3 draw as 3 for direct `infer()` callers too.
  - The shape check compares coordinate-compressed grids, each shape painted
    once.
- Plain-language summary of the community model changes. A negative gap that
  crosses the arms (issue #15, for example size 2, gap -11.5, dot) keeps the
  crossed cross and its hole instead of a solid plus. An old outline-only `#`
  (size 0 with an outline, issue #11) becomes length-1 black bars with the
  outline off. A size-0 dot is drawn with short arms at gap 0 that fill the dot.
  Zero-length bars draw nothing in the new game, outline included. An inverted
  T (crossed T style) keeps T: the old crossed arms put its single vertical arm
  above the centre, and the new game draws it below, with a warning (for
  example size 2, thickness 1, gap -11.5, T at 1080 exports length 4, thickness 2, gap 2,
  `cl_crosshair_t 1`). The preview of the converted crosshair and the colour and
  flags line in the Simple view now show what is exported (colour, opacity,
  outline mode and T flag), not the old settings.
- Expert switch "Automatic appearance corrections" (Appearance and matching
  panel, default on). Off, the automatic converter skips the
  crossed-arm fold, the outline-only and dot-only redraws and the appearance
  window, and exports the plain dimension-first conversion with the warning
  `corrections-off` ("Automatic appearance corrections are off…"); the shape
  check shows what this loses. Issue #15 pasted alone exports gap 0 with
  corrections off (`cl_crosshair_length 4;cl_crosshair_thickness 1;cl_crosshair_gap 0;…`,
  with `negative-gap-static-unverified`), and issue #11 exports length 0 with
  the half outline, which draws nothing. Reports record `options.corrections`
  (schema unchanged, field added); the ML cross-check row reads "Not checked:
  corrections off". Historical models ignore it and the switch is disabled for
  them; the Simple view always keeps the corrections on.
- A console dump of current-game cvars is rejected as new-format input even
  when `cl_crosshair_drawoutline 2` comes first, instead of being read as an
  old crosshair.
- Confidence panel: the "Model agreement" row (the share of renderer
  hypotheses that match, which is not correctness) is gone from the main
  panel; it stays in the expert model table as "Hypothesis agreement". New
  rows: Shape check (old against converted pixels, colours and outline:
  Exact, Exact after 1 px shift, NN% overlap or Nothing visible), Game
  captures (the two user captures of the current game, re-rendered by the
  generator), Cross-tool (agreement with crosshair.club exports: 22 of 24) and
  a separately labelled ML cross-check (agreement with our own method, not
  game accuracy; per input, see below). Evidence counts live in `data/quant-summary.json`
  `evidence`, regenerated by the corpus study.
- Per-input ML cross-check. The confidence panel's "ML
  cross-check" row now checks the input on screen. It reads "Agrees on this
  input (L/T/G)" or "Differs on this input: predicts L/T/G". The note gives
  the held-out rate: 98.99% (98.56–99.36%) whole-export agreement on a fresh
  reserved set of 5,632 synthetic rows and 98.61% on an edge-case challenge
  (after the hunt fixes below; 99.18% and 98.49% before them).
  The rows were scored after training, then relabelled and rescored after
  the 0.12.0 solver changes (99.17% and 98.64% before the appearance window,
  which the evaluator now re-derives from geometry helpers; 99.09% and 98.78%
  before the T and usealpha decisions, after which it was retrained without
  the T head: the T flag is copied). The wording says
  this is agreement with our own method, not game accuracy.
  - The learner is the export-state learner v2 (`sicc-export-emulator-v2`,
    `research/generated/crosscheck-emulator.json`). Its evaluator,
    `lib/solver/ml-crosscheck.js`, never runs the solver.
  - The parameters live in `data/ml-crosscheck.json` (about 80 KB, generated;
    `app/data.js` fetches them). Stale or edited parameters show "not
    retrained for this version".
  - `quant-summary.json` `evidence.mlCrossCheck` now carries the
    fresh-evaluation numbers.
- Research learners gained v6 regime features: crossing kind and folded
  edges, dot-only, outline-only, zero length, outline extent, usealpha,
  weapon gap, width parity and T-stem extent. All of these splits were seen
  before, so these are regression numbers. First run (2026-10-02) → current
  artifacts (2026-10-03, after the appearance window and its amendment):
  - accuracy emulator test: 91.95% → 97.71% → 97.75% (new `regime` variant;
    it is worse on the shifted challenges, 77.58% / 71.88% now);
  - structured ranker test: 98.46% → 99.04% → 98.17%;
  - export-state learner v1 full export on its test split: 70.53% → 98.68%
    → 93.55% (drawoutline 71.41% → 100%). The 98.68% predates the appearance
    window; the window and the plain-conversion fallback relabelled rows with
    tuples outside its ranker's candidate set (581 training labels skipped,
    `labelMisses`), so 93.55% is the current figure
    (`research/generated/export-emulator.json`).
  - See `docs/research/learners-2026-10-02.md` section 11.
- Leftovers from the audits (2026-10-03, still `community-static-v6`; no
  corpus, preset, issue #11 or issue #15 export changes):
  - Plain-language warning texts: `legacy-rounding-disagreement` ("Two readings
    of the old game give your size or thickness different whole pixels…"),
    `pixel-centering-shift`, and the share-code outline pair, where
    `outline-sharecode-rounded` no longer repeats the half outline that
    `outline-half-mapping` names. Codes are unchanged.
  - A paste that sets only the hidden leftovers the current game still stores
    (`cl_crosshairsize`, `cl_crosshairthickness`, `cl_crosshairalpha`) and a
    style of 6 or more is rejected as "hidden leftovers from the current game"
    instead of importing as an old crosshair and blocking on the style.
  - New warning `outline-choice-moot` when a hand-chosen outline mode cannot
    draw (export length 0 and no dot).
  - Outcome rows: a gap whose edges moved by one pixel under a shifted shape
    check is `approximated` ("the same shape one pixel over"), as the shape
    check says.
  - Reports carry `exportedOverrides`, the full override set the export passes
    to `nativeCommands` (style, a hand-chosen outline mode, the edge-case
    colour and outline mode), and `exportBuild` 2000922. Historical reports
    add `shapeCheck` and an empty `exportOverrides`; their `targetBuild`
    stays 2000914, the build their hypotheses and native measurements
    describe. Their numbers are unchanged.
  - Workbench "Copy share code": an outline thickness off the 0.5 grid (for
    example 0.01 or 0.25) gets a message that old codes store 0.5 steps and
    has no code; widths below 0.5 note that the code reads back as a rounded
    0 (half outline).
  - Narrow screens: the confidence rows stack label, value and note, and the
    value table breaks cvar names after `cl_crosshair_` with the header
    fitting its column.
  - Accuracy emulator: capacity list extended (64×6, 96×6, 128×7), selected on
    validation (128×7 for every variant); new scale-free `regimeAxis`
    variant (validation 98.68% against 98.24%; test 97.50%, interior 80.70%,
    exterior 74.30%, regression numbers). The cross-check artifact records a
    freeze of its feature code and capacity lists; the trainer refuses to run
    on drift unless the freeze is renewed explicitly.
  - The remaining black-fill cases are documented (all size-0 dots with an
    outline whose better tuple lies 5 to 14 gap steps outside the window);
    `zero-thickness-branch` in `lib/solver/structural.js` matches the report
    text; `lib/settings/cvars.js` notes that build 2000924 was checked.
  - A regression test checks the headline learner numbers in
    `app/pages/research.js` and chapter 13 against the artifacts.
- Copying or downloading the converted settings (issue #16) now gives one line of commands
  separated by `;` with no `//` comments, so it can be pasted straight into the
  CS2 console (limit 510 characters per pasted line; `commandLine` throws above
  it, and the longest legal export is shorter). The `.cfg` download is that
  line plus a newline. Warnings and provenance stay in the UI and the JSON
  report. This applies to the automatic converter and the manual lab.
- Import follows the old game (audit fixes, still `community-static-v6`):
  - A pasted CFG block is complete on its own. Cvars it does not set take the
    pre-update CS2 defaults (build 2000908, `GAME_DEFAULTS_2000908`: size 3.9,
    thickness 0.6, gap -2.2, style 2, outline 1, alpha 200, colour 5 with
    0/255/0, recoil 1, weapon gap 1), not the previous crosshair, in the
    converter, the workbench and `parseLegacyText`. A note lists them; the
    status line gives a count and the outcome table the list. The converter
    also adds the warning `defaults-filled` ("Added from the old game's
    defaults because your paste did not set them: …") to the report and to
    the Simple and expert warning lists, and marks those "What changed" rows
    "added (game default)". Share codes and complete pastes get none. Issue #15 pasted
    alone (`cl_crosshairdot 1`, gap -11.5, size 2) now exports
    `cl_crosshairstyle 4;cl_crosshair_length 4;cl_crosshair_thickness 1;cl_crosshair_gap 3;cl_crosshairdot 1;…;cl_crosshair_drawoutline 1;…;cl_crosshair_recoil 1;cl_crosshaircolor_r 0;cl_crosshaircolor_g 255;cl_crosshaircolor_b 0;cl_crosshaircolor_a 200;cl_crosshair_screen_height 1080`
    with the static-style and weapon-gap warnings.
  - Bounded cvars clamp to the pre-update dump ranges with a note (alpha and
    RGB 0–255, outline thickness 0–3, split values); alpha and RGB drop a
    fraction; bool cvars are on for any non-zero number. Share codes clamp
    their stored split values the same way.
  - Specific errors for a colour index outside 0–7, a negative size or
    thickness, and hex, NaN or Infinity values. Cvar names are
    case-insensitive and `1e2` is accepted. Repeated cvars give one note with
    counts. A `CSGO` code without dashes gets a legacy-code error.
  - The new-build error names the cvars that triggered it and says the input
    already looks like current-game settings; `cl_crosshair_dynamic_spread_limit`
    and `cl_crosshaircolor_a` now trigger it.
  - A rejected crosshair no longer replaces the previous valid one, and a
    current `CS…` code leaves no stale export enabled.
- Warnings and labels match the export:
  - Old styles other than 0 to 5 (6, 7, 9, -1) are blocked as unknown to
    the old game instead of with the styles 0 and 1 text. A typed 4.5 imports as
    4 (the game reads the cvar with GetInt, which truncates).
  - `outline-sharecode-rounded` fires only when the automatic half outline is
    exported; `outline-only-as-core` names a hand-chosen outline mode;
    `empty-geometry` needs an export that draws nothing; the outline confidence
    is not "assumed" for an export without an outline.
  - Outline texts state the evidence: the half outline matches one user
    capture of the current game (issue #11), the full outline has none, and the
    shape check compares outline pixels.
  - Historical-model exports with length 0 and no dot warn
    `export-draws-nothing`.
  - Outcome rows no longer say "approximated" when old and new pixels are
    equal; pixel values show at most two decimals.
  - Every warning code is listed in `docs/engineering/architecture.md`;
    a regression test checks it.
- Converter UI: the blocked state blanks the length, thickness and gap
  readouts and the flags line; the flags line names the exported style (for
  example "Static Cross (style 4)"); the main panel shows the Shape check
  instead of "Preview overlap", which is renamed "Core overlap (no shift)"
  where it remains; non-automatic models note that the captures, cross-tool
  and ML rows apply to the automatic model; "Copied to clipboard." clears
  after four seconds; the preset heading counts entries and players
  (138 entries from 106 players). The downloaded report adds
  `exportedCommands`, the exact one-line export.
- Fixes from a hunt over about 760,000 new inputs (audit D; amended appearance window,
  still `community-static-v6`, schema unchanged, fields added):
  - With the automatic appearance corrections on, the export never has a lower
    aligned shape check than the same input with them off. When a fold, a dot
    redraw, an outline-only redraw or the appearance window applied, the
    solver also solves the plain conversion and exports it only when it is
    strictly better (`decision.correctionsFallback`, warning
    `corrections-fallback`: "The plain conversion matched the old crosshair
    better here…"). Corrections worse than off: 284 → 0 of 40,000 random
    pairs, 2,835 → 0 of 58,320 dot-sweep pairs, 1,731 → 0 of 108,000
    crossed-sweep pairs.
  - A screen goal applies the fold and the dot and outline-only redraws to the
    whole current pixels the scaled old shape covers, so redrawn arms stay
    inside the dot (size 0, thickness 2, gap -4, dot, 768 → 1080: 3/4/0 at
    50% → 2/4/0, exact after a 1 px shift). Screen-goal dot sweep mean
    aligned overlap 0.66 → 0.75, crossed sweep 0.77 → 0.80.
  - The appearance window is defined in drawn current pixels (±3 px length,
    ±3 px width, ±4 px gap edge), mapped to native values by the
    authored/current ratio, keeping as many native steps where that reaches
    further. A screen height above the current one now reaches exact tuples
    (size 4, thickness 2, gap -4, dot, outline 1 at 240 with screen height
    1440: 12/6/6 at 87.9% → 8/6/9, exact after a 1 px shift). Equal heights
    are unchanged. The ML cross-check uses the same window.
  - `zero-length-outline-dropped` and `outline-overpaint-lost` say "closest
    shape found within the search window".
  - Warnings follow the shape-check status: no `dimension-limit` on an exact
    export; an old outline-only shape with the corrections off warns
    `export-draws-nothing` instead of `empty-geometry`; every approximate
    export names a cause (new `shape-approximate` with the overlap when no
    other warning does); every shifted export warns `pixel-centering-shift`.
    Contradictions 579 → 0 of 40,000.
  - `infer()` copies the settings into the report (`structuredClone`, `rgb`
    included), so changing the input object later no longer changes the
    export.
  - The ML cross-check note states the rate only inside the evaluated scope
    (equal heights 720–2160 at the pixel goal and three cross-height scopes);
    outside it the note says "this input is outside the evaluated scope (…)"
    and that the rate does not apply. The per-input result still shows. The
    evaluator also re-derives the plain-conversion fallback. Learners
    retrained.
  - Build 2000924 (no crosshair change; only the workshop cvar whitelist)
    measurements are accepted as build 2000922 (source ledger S19). Capture
    protocol, edge-case notes (the dumped shader alone would outline an empty
    rect), draw-order notes (max-alpha outline layer) and the
    settings-migration notes (Valve's "The scale of this setting has changed…"
    tooltip, no `cl_crosshairusealpha` string after 2000913) updated. The
    historical `zero-thickness-branch` warning no longer claims a one-pixel
    minimum: thickness 0 is unverified in game.
  - Corpus, preset, issue #11 and issue #15 exports are unchanged.

## 0.11.0 — 2026-10-02

- Advance to `community-static-v5`: tied shapes are ranked by pixel
  overlap maximised over whole-shape shifts of at most 1 px, then plain overlap,
  then the canonical order, so the odd-width centring shift no longer decides
  ties. 74 of 1,755 corpus record-scope rows (48 records) change, all at cross
  heights; equal-height exports and the 24 crosshair.club tuples are unchanged.
  Example: ZywOo 1.5/0/-3 at 720 → 1080 (authored 960) now exports 3/1/3, not
  3/2/2. Reports add `tieBreak.ranking` and aligned scores; `searchPolicy` is
  `finite-dimension-ties-v4`.
- Old styles 2, 3 and 5 now export `cl_crosshairstyle 4` by default: the old
  source draws them exactly like style 4 at rest (weapon_csbase.cpp L2002-2050).
  They warn `style-dynamic-at-rest` and the "What changed" style row is
  `approximated`. Old styles 0 and 1 and the weapon gap stay blocked. This
  applies to the automatic, historical and manual paths; the family option is
  unchanged.
- Report schema bumped to `sicc-quant-report-v6` (contract change): reports
  carry `clamped[]`, `options {outlineMode, styleTarget}` and, in `settings`,
  `outline_width_rounded`.
- Old share-code colour indexes 6 and 7 convert with the stored RGB and the
  warning `color-index-unknown` instead of failing (corpus pro-064).
- Old outline widths 2 and 3 warn `outline-width-reduced` and are listed in
  `report.clamped`; unequal widths keep `outline-asymmetric-approx`.
- Regression tests pin binary32 old arithmetic and the thickness-32 inner-edge clamp.
- Simple view "What changed" table with a status per setting (converted,
  approximated, assumed, dropped, ignored, user-choice) and its reason, also in
  the expert lab; stacked rows on narrow screens.
- Per-value confidence chips, a plain-text warnings list, a limits line next to
  Copy/Download, the checked build (2000922, convar dump 2026-10-01), a "save
  your current crosshair first" hint and a short import status.
- Pure `lib/settings/outcomes.js` (`settingOutcomes`, `confidenceLabel`).
- Opt-in export options: outline mode (Auto/None/Full/Half) and style target
  (Static Cross by default; "Keep old style family (experimental)" maps old
  2/3 → 2 and 5 → 5). They warn `outline-user-override` and
  `style-family-experimental` and are recorded in `report.options`; the manual
  lab gets the outline select.
- A pasted current `CS…` share code (read-only decoder) is explained
  as already using the new settings, with its values listed; not an error.
- Specific share-code errors (format, characters, length, overflow, checksum,
  version); `CSGO-` version-3 codes get a new-format message.
- Style labels follow the 2000922 UI.
- Historical models report `outline-only-legacy`; new
  `outline-asymmetric-approx`; `report.clamped` lists clamped or approximated
  outputs.
- Shared raster arm placement, checked per pixel against a reference.
- New regression tests cover the export contract (screen height last, allowlisted
  lines, legacy gap -5 → 3) and a 2000922 range snapshot.
- Research: export-state learner (`research/generated/export-emulator.json`); cross-tool baselines (JDD310, cursed, Horizzon1,
  crosshairrestore); gap-origin sensitivity (floor versus ceil changes 388 of
  945 corpus rows); outline mask evaluation; tie-break audit; capture protocol
  2026-10-02 with a calibration harness (research tooling, not
  published; the issue #11 screenshot matches the old outline
  model exactly at a +3 px x offset); the old-client observation; research note
  addendum and source ledger S12–S14.
- Learners labelled by the public solver are retrained on v5 labels (accuracy
  889, structured 835 and export 882 labels change); the frozen v2 distillation
  is unchanged. The conversion-accuracy study now guards aligned overlap.
- Third-party notice for cursed-crosshair-generator (MIT).
- Fixed after review:
  - Outline warnings and `clamped` follow the exported outline mode, including the export override; one shared
    `outlineWarnings` helper serves the community and historical reports, so the hedge path now also emits
    `outline-sharecode-rounded`, `outline-half-mapping` and `outline-alpha-unverified`.
  - What-changed outcomes and confidence chips read `report.clamped` (hedge size 400, gap 200, gap -10 are approximated).
  - `clamped` lists thickness 0 only if the export differs; historical models are judged against build 2000914 (0..31).
  - The CFG parser accepts only `crosshair` and `cl_*` names and uses own-property lookup (`constructor`, `__proto__` rejected).
  - A `CS` code whose payload starts with `GO` is read as a current share code.
  - `encodeLegacy` accepts colour indexes 6 and 7; the lab's copy note explains the 0.5-step outline width.
  - The conversion-accuracy study records the raw-IoU regression (96 cases, worst 0.471) and fails if it grows; the
    tie-search regression test uses an independent raw-mask shift oracle.

## 0.10.0 — 2026-10-02

- Outline opacity: the old outline used the crosshair opacity (cstrike15
  `DrawCrosshairRect`, confirmed by a user screenshot), so exports now write
  `cl_crosshairoutline_a` as the old crosshair opacity instead of 255 whenever the
  outline is on. This changes the exported values of every outlined crosshair. The
  `outline-alpha-unverified` warning now states that, if 2000922 also multiplies the
  outline by `cl_crosshaircolor_a`, it will be lighter (unverified).
- Outline geometry: the old outline rect grows by ceil(t) on the left/top and floor(t)
  on the right/bottom. `lib/geometry/raster.js` gains `outlineRectangles`,
  `outlineRaster` and `outlineOnly`, and the previews draw the outline in black at the
  crosshair alpha beneath the core (new outline assumed). The core-shape objective,
  solver and model ids are unchanged. Outline-only crosshairs (size 0 with an
  outline) warn `outline-only-legacy` instead of `empty-geometry`.

- Share-code outline width 0 (issue #11): old share codes store
  `cl_crosshair_outlinethickness` in 0.5 steps, so an enabled outline with stored
  width 0 means any thickness below 0.5 and now exports `cl_crosshair_drawoutline 2`
  with the warning `outline-sharecode-rounded` instead of dropping the outline.
  A width of exactly 0 typed in a CFG still exports no outline. Decoded settings
  carry `outline_width_rounded`; a CFG that sets the thickness clears it.
- CFG import accepts `true`/`false` for boolean cvars and skips known non-shape
  cvars from a console `find crosshair` dump (grenade, ironsight, observer, sniper
  and the bare `crosshair`), listing each ignored name in the import status.
  Binds, exec, alias, unknown cvars and expressions are still rejected.

## 0.9.1 — 2026-10-01

- Map old outline widths to the new outline modes (issue #11): an enabled outline
  with `cl_crosshair_outlinethickness` below 1 exports `cl_crosshair_drawoutline 2`
  (Valve's half outline, which draws only the top-left edge), width 0 exports no
  outline, and 1 or more stays the full outline. Reports warn with
  `outline-half-mapping` or `outline-zero-width`; the mapping is not native-validated.
  Build 2000922 still has no outline-width cvar.
- Disclose outline opacity: old outlines used the crosshair opacity, while build
  2000922 has a separate `cl_crosshairoutline_a`. Exports keep 255 and warn with
  `outline-alpha-unverified` when an outlined crosshair is below full opacity.
- Old `cl_crosshairsize 0` stays zero-length arms (dot and outline preserved); the
  new integer `cl_crosshair_length` cannot express 0.3 and no evidence shows old
  size 0 drew a visible arm.

## 0.9.0 — 2026-10-01

- Advance to `community-static-v4` for CS2 build 2000922 (Valve's October 1
  crosshair update). Forward equations are unchanged from v3 and are an
  unverified carry-over across the renderer rewrite; no native capture pairs
  exist. Thickness search maximum is 32. Static Cross gaps stay 0..128 and
  an old gap that would need overlap (negative centre radius) clamps to 0 with the new warning `negative-gap-static-unverified`.
- Every CFG export now also emits `cl_crosshairoutline_r 0`, `_g 0`, `_b 0` and
  `_a 255`, pinning the legacy opaque black outline.
- Measurement intake rejects build 2000918 records; build 2000922 captures with a
  gap outside 0..128 are reported outside the model domain and excluded from holdouts.
  New-build cvar names, including outline colour, are rejected on legacy import.
- Retrain the accuracy and structured research learners on v4 labels (a regression
  re-run, not fresh holdout evidence): 1,152 of 15,360 labels change, all thickness
  31 → 32. Ranker test fidelity 98.50% (was 98.75%); quantization-aware accuracy
  learner 96.99% (was 97.29%). The frozen v2 distillation and historical models
  are unchanged.
- Document the build, shader diff, decisions and a native capture protocol in the
  [build 2000922 note](docs/research/build-2000922-update-2026-10-01.md).

## 0.8.0 — 2026-09-29

- Preserve `community-static-v3` results while replacing exhaustive dimension
  scans with monotone plateau search: 94.4% fewer axis evaluations on 15,360 cases.
- Add a research-only structured candidate ranker and constrained residual decoder.
  On 400 fresh setting groups, ranker test fidelity is 98.75%; interior/exterior
  challenges reach 84.22%/96.02%. Same-data residual baselines are
  97.33%/66.02%/80.63%. Record canonical and frozen baselines, paired regressions,
  calibration abstention and limitations in the
  [structured-learning study](docs/research/structured-learning-2026-09-29.md).
- Optimize boosted-tree training with local feature orders and shared sorting,
  preserving existing model artifact bytes. Record successful development retraining and independent exact axis/candidate
  parity checks.

## 0.7.0 — 2026-09-29

- Advance to `community-static-v3`: compare all equally accurate rendered lengths
  and widths, recompute parity-specific radius choices, and select exact overlap.
  Preserve canonical cvars when overlap ties. Across 8,640 synthetic cases,
  750 improve and none regress; 24 frozen external comparisons remain unchanged.
- Add quantization-aware research features and 400 new setting groups. With the
  same v3 labels, test tuple fidelity improves from 96.31% to 97.29%; interior
  and exterior challenge fidelity improve to 73.91% and 77.66%. Keep exact
  runtime inference, group-disjoint fitting/calibration and support abstention.
- Freeze v2 labels and artifacts. Document correction/re-evaluation history,
  selective interval coverage and native-evidence limits in the
  [accuracy report](docs/research/accuracy-improvements-2026-09-29.md).

## 0.6.0 — 2026-09-29

- Audit old, first-redesign and newest public dumps: build 2000919 retains the
  crosshair inventory inspected at 2000918. Document verified changes and the
  limits of metadata evidence in the [audit](docs/research/converter-audit-2026-09-29.md).
- Advance to `community-static-v2`: resolve equal-radius-loss gaps by exact shape
  overlap while preserving bar dimensions. Retain all 24 frozen external tuples.
  Report residuals, ambiguity and grouped current-build holdout validation.
- Fix overlapping-arm image ranking with exhaustive exact union scoring, support
  signed near edges and white auto-detection, and round-trip screenshot settings
  through half-even geometry. Block cropped/unstable captures and native dot/T mismatches.
- Add research-only boosted residual learning, a separate calibration partition,
  cluster stability intervals and unseen fraction/resolution challenges. Same-test
  tuple fidelity improves from 87.05% to 93.90%; shifted-input fidelity is 72.66%,
  below the analytic baseline's 80.12%. Learned models remain outside runtime.

## 0.5.0 — 2026-09-28

- Replace the automatic default with a source-labelled static reconstruction:
  round-to-even old dimensions, centre-based new gap, positive visible minimum,
  authored-height rescaling and explicit odd-width pixel placement. Target the
  inspected build 2000918; retain historical and manual models separately.
- Reduce visible renderer choices to six. Compare 24 recorded crosshair.club
  outputs, including twelve later holdout queries: 24/24 tuple agreement versus
  0/24 for the former authored/trunc/thickness hypothesis. This is external
  software agreement, not native game validation.
- Fix screen-relative parity, measured-target preimages, restricted-domain
  certificates and historical search plateaus. Reports advance to v5.
- Measure odd-width transverse placement independently and retain build-scoped
  capture evidence across renderer switches.
- Record a research-only ML ablation: geometry and authored-height
  features improve same-test synthetic tuple fidelity from 29.17% to 90.48%.
  The exact converter remains the runtime path. See the
  [audit](docs/research/converter-audit-2026-09-28.md).

- Redesign the interface as an "inspection sheet":
  - token-driven light and dark themes;
  - self-hosted Archivo and Martian Mono under the OFL;
  - sheet-numbered navigation and title blocks;
  - a Simple view that puts the answer (dimensioned before/after plates at an
    auto-fitted magnification, three readout values and the console lines as
    text) beside the inputs.
- The CSP changes from `font-src 'none'` to `font-src 'self'`, and the dev
  server serves `.woff2`.
- Keep the mobile Simple flow in DOM order, preserve the manual preview's pixel
  aspect ratio, and clear stale announced results.
- The interface redesign retains routes and element IDs; conversion changes
  in this release are described above.

## 0.4.0 — 2026-09-24

- Reorganize the product source by responsibility: `lib/` becomes the layered
  `settings`, `geometry`, `image`, `solver` and `manual` tree, while `app/` is
  grouped by route and worker boundary. Conversion results, exports and routes
  are unchanged.
- Published paths under `lib/` and `app/` change. `data/quant-emulator.json` and
  `data/quant-modulator.json` move to `research/generated/`; `data/reference-audit.json`
  is removed (it duplicated `research/archive/2026-09-23/results.json` and had no reader).
- Share one quantizer and one legacy-text import dispatch between the two conversion
  models; the build and dev server share one publish list; CI also checks
  `docs/notebook.html` for drift.

- Correct even-width preview alignment while preserving measured image pixels.
- Keep the automatic search bounded and prefer the lower pixel error before applying
  tie-break rules.
- Cache repeated model lookups and remove duplicate input validation.
- Simplify the app and docs; add a reproducible README screenshot tour.
- Keep local files and credentials out of Git and the Pages build.
- Disclose when a positive legacy thickness resolves to the automatic zero-thickness
  branch instead of silently exporting `cl_crosshair_thickness 0`.
- Make **Simple** the default converter view (import, values, resolution, appearance,
  proposed values, two previews, copy/download) and move the full lab behind an
  **Advanced** Expert mode; mode is DOM-only with no persistence.
- Add a dependency-free learned-emulator research artifact.
  It distills the declared solver on self-generated labels, records
  `speedGate: "closed-not-exact-equivalent"`, ships zero native evidence, and is
  not wired into the app or its Simple view.
- Raise the learned inverse to a depth-3 boosted-tree block over 26 declared
  features; held-out full-tuple fidelity rises from ~11.6% to ~35.7% (new artifact
  fingerprint `137061144`). Record honestly that the 7 added features were
  neutral-to-slightly-negative in ablation and the gain came from capacity.
- Add an opt-in certified-global expansion (`infer({ certify: true })`) for the
  declared decision loss; the default bounded search and its outputs are unchanged.
  Document the `shell-monotone` certificate as conditional on a documented,
  spot-checked (not proved) monotonicity assumption.
- Add the `cvar` decision rule alongside `expected` and `worst`, `decision.certificate`,
  and `exactPreimage` (complete integer equivalence classes, including empty
  classes and pure-dot plateaus); bump the research report schema to
  `sicc-quant-report-v4`.
- Add the learned-shortlist ranker (exact verification over the declared loss;
  coverage at K=32 is 84.8% and it lost to the solver on 13/125 samples, so it is
  not wired into inference) and the sensitivity layer (analytic boundary margins
  plus a weak learned classifier, 0.736 vs 0.704 majority).
- Add the model-family behavioural partition (27/27 distinct over a declared finite
  sample) and a two-design discriminating capture plan; both are synthetic and not
  native evidence.
- Add chapter 11 and the formula-history corrections C05 (bounded search is not
  globally optimal; opt-in certificate) and C06 (emulator capacity change,
  fingerprint move, ranker/sensitivity results). Version stays 0.3.0.
- Add `lib/cvar-inventory.js`, a frozen data table for the build 2000914 crosshair
  cvars, styles, hidden leftovers and removed names, plus `NATIVE_RANGES` in
  `lib/native-settings.js` as the one source of the export ranges.
- Add an explicit gap-scale rival
  (`same-as-length` vs `unscaled`) and named `pixelCopy` / `rename` candidates. The
  24-hypothesis structural family is offline only; the
  default `infer()` tuple, `quant-static-v5` and the 27-model worker search are
  unchanged.
- Record a closed residual-modulation study. It returns a zero delta with reason
  `closed-no-native-pairs`, is not imported by inference, and its gate cannot open
  in v1 because no reviewed-registry provenance value is defined.
- Warn on every automatic report that build 2000914 does not state gap scaling, and
  surface an unscaled-gap rival note in the Simple and Expert views. Lock the default
  tuple for the size-2 fixture.
- Harden imports and exports: reject new-build cvars in the legacy CFG importer with a
  dedicated message, test that exports never emit removed or hidden legacy commands,
  cap worker payloads at 1 MiB, and scan `lib/` as well as `app/` for `eval`,
  `new Function` and `.innerHTML =` assignment.
- Point the shipped inverse at `NATIVE_RANGES` so cvar bounds cannot drift from the
  export validator; the default tuple is unchanged.
- Let the Expert view list the rename, pixel-copy and unscaled structural rivals as
  read-only rows; none of them replaces `infer().chosen`.
- Record a pure modulation contract that rejects any delta with a component
  outside ±2 and any delta that increases geometry loss; it has no weights and
  is not imported by inference.
- Default the automatic conversion to the authored pixel-exact model
  `authored:trunc:thickness` (`resolveModelChoice`) when there is no measurement
  evidence and no explicit request, instead of the weighted 27-model hedge; published
  post-update pro settings match that model's own inverse, while the weighted hedge
  shifts the length by one in 88 of 137 static corpus records. The weighted hedge
  (`weighted-hedge`) remains available by name or once evidence exists. This is an
  application default only: `infer()`, the bounded search, the declared losses,
  `NATIVE_RANGES`, `legacyGeometry` and the trained artifacts are unchanged.
- Consolidate public architecture documentation into the current
  `docs/engineering/architecture.md`.

## 0.3.0 — 2026-09-23

- Rebuilt the quantitative view around actual values, pixel targets and assumptions.
- Joint finite-domain thickness/gap inversion and two-edge gap midpoint; certificates
  distinguish initialization geometry from subsequent bounded visual optimization.
- Exact full-domain cell-union overlap, geometry caching and aggregate-loss refinement;
  explicit expected-loss and worst-case policies.
- Robust declared likelihood mixture; canonical hashes and conflict-aware evidence;
  per-model trace provenance survives candidate deduplication.
- Bounded latest-only worker queue, hard failure/timeout cleanup, invalidated image
  acceptance after crop edits, and shared validated console-command formatting.
- Refactored monolithic inference, native image measurement and editor rendering into
  focused functions; ninth mathematical chapter and offline MathML reader.
- Target build, frozen historical arithmetic, corpus and zero-native-pair status unchanged.

## 0.2.0 — 2026-09-23

- Added 138 sourced records covering 106 players, 119 distinct codes and 50
  parameter geometry signatures; verified the 100-row archive transcription hash.
- Added 945 eligible record-height study cases, geometry-group cross-validation,
  a weighted ridge old-target surrogate, deterministic cluster-bootstrap intervals,
  and 336 unique geometry-height inversion cases per renderer family.
- Implemented 27 explicit renderer scenarios, bounded inverses, cached mask
  scoring, local visual refinement, cross-scenario candidate ranking, prior
  sensitivity and user-attested grouped native likelihood updates.
- Separated synthetic fits, input coverage, native calibration and held-out
  validation; no native correctness probability is fabricated.
- Added three-way previews, a module worker, lazy views, paginated corpus search,
  old-image template inference and independent native-component measurement.
- Added four mathematical chapters and a complete eight-chapter static-MathML
  notebook, preserving all original mathematical documentation and archive data.
- Added a pinned GitHub Pages workflow; no hosted
  deployment is claimed without a successfully inspected real environment URL.

## 0.1.0 — 2026-09-23

Initial repository release.

- Runnable zero-dependency local static generator, legacy-v1 code/CFG imports,
  native candidate editing, CFG and mathematical report exports.
- Pinned old binary32 reconstruction, conditional new-model selection, bounded
  legal-candidate search, zero-branch preservation and explicit range residuals.
- Thickness-relative, center-relative and scoped affine gap hypotheses; selectable
  new rounding assumption; both near/far alignment tracked.
- Interactive notebook, quantization explorer, 56-case audit and extensive
  mathematical, historical and evidence documentation.
- Frozen original research, hashes, JS/Python parity and comparator regressions.
- Scoped calibration, residuals, synthetic-data provenance and local PNG inspection.
- Fail-closed unsupported style/weapon-gap handling, strict input validation,
  local server hardening and static build with a hash manifest.
- Added correction C01: the archived report of a site's 720p reference was not
  independently corroborated in the current parsed page. Retained as an archival
  report, not promoted into a native conversion rule.

No claim of native client validation, universal crosshair equivalence, dynamic
renderer implementation, outline fidelity or remotely published release.
