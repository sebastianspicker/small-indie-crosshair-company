# Design brief: Small Indie Crosshair Company

Written 2026-09-27 on branch `redesign/inspection-sheet`. Phases 1 and 2 are
written before any UI code. Phase 3 follows the direction chosen at the end of
this file.

---

## 1. Product summary

A client-only browser tool for one specific problem. The September 2026 CS2
update (build 2000914) replaced the old crosshair cvars (`cl_crosshairsize`,
`cl_crosshairthickness`, signed `cl_crosshairgap`) with new ones
(`cl_crosshair_length` 0–255, `cl_crosshair_thickness` 0–31, `cl_crosshair_gap`
0–128, `cl_crosshair_screen_height`). The new renderer draws differently, so
copying the old numbers into the new names doesn't reproduce the old crosshair.

The app:

1. takes an old crosshair (a `CSGO-…` share code, pasted console lines, typed
   values, a published pro preset, or an original PNG screenshot),
2. reconstructs the exact old pixels,
3. solves for the legal new integer settings that reproduce those pixels under a
   stated model of the new renderer (27 competing hypotheses),
4. shows the old shape, a naive copy and the proposal side by side at pixel
   magnification, and
5. exports cvar commands (`.cfg`) and a JSON research report.

It runs entirely in the tab: no account, backend, network call or persistence.
Every claim is labelled with its evidence status. Nothing has been checked
against a real old/new capture pair, and the product says so.

**Moment of value.** Three integers (new length, thickness and gap) next to a
preview in which the new shape visibly matches the old one, with the commands
ready to copy. Everything else supports trusting or questioning those numbers.

### Routes (all load-bearing, hash-routed)

| Route | Name in nav | Role |
|---|---|---|
| `#quant` | Convert | Primary journey. Simple view (default) and Expert lab (27-model table, derivations, trace, evidence). |
| `#corpus` | Settings data | 138 published pro records, study results, search and pagination. |
| `#research` | Mathematics | Timeline of formula versions, equations, bucket explorer, ML notes, links to the notebook. |
| `#workbench` | Manual tool | Separate manual conversion model (`conditional-static-v4`) with hypothesis controls. |
| `#calibration` | Measurements | Affine calibration from measurements, PNG pixel inspector, JSON import and export. |
| `#evidence` | (footer link) | Re-runnable 56-case archive audit. |
| `docs/notebook.html` | via Mathematics | Generated long-form math notebook (MathML). |

## 2. Audience

**Primary: a competitive CS2 player whose crosshair changed after the update.**
They have played for years and know their crosshair as a share code or a line
of console commands, often copied from a pro (the corpus names 106 players).
They are fluent in `cl_` vocabulary and resolutions such as 1280×960 stretched,
and usually have never thought about how a crosshair is rasterized. They are
irritated because muscle memory is tied to a few pixels, and they are
suspicious: Reddit threads, "pro settings" sites full of ads and guesswork, and
generators that say "just multiply by 2" (the corpus shows this fails in 32 of
56 cases).

- **Goals:** get the old crosshair back quickly, without trial and error in
  the console.
- **Anxieties:** "Is this actually the same?" and "Will this break my config?"
  They are anxious about pasting things into the console.
- **They distrust:** hype, esports-loud styling, false certainty, ads and
  account walls.
- **What reads as quality to them:** exact integers, a pixel-for-pixel
  preview, console-ready text, speed, and a tool that admits what it doesn't
  know. They think in pixels, and a blurry preview is an instant tell.
- **Daily tools:** the CS2 console, Discord, Leetify or FACEIT, crosshair
  generator sites, `autoexec.cfg`.
- **Context:** usually at a desk next to the game, often at night with a dark
  OS theme. Sometimes on a phone next to the PC, reading the values to **type
  them into the console by hand**.

**Secondary: the technically curious** (other tool makers, maintainers,
reviewers, the odd graphics nerd). They read the Mathematics, Settings data and
Measurements pages. For them quality means reproducibility, labelled evidence
and legible equations.

## 3. Key journeys

1. **Paste and go (Simple, about 80% of use):** paste a share code → the
   values fill in → the readout shows new length, thickness and gap plus
   before and after previews → copy the commands or download the `.cfg`.
2. **Resolution change:** set the old and new game heights → decide between
   "keep game pixels" and "keep screen proportion" → re-read the result.
3. **Start from a pro:** Expert → search the published settings → pick a
   record → check its provenance link → convert.
4. **Doubt the result (Expert):** switch the rendering model, compare all 27,
   open the pixel residuals, download the report.
5. **Contribute evidence:** upload an original PNG (old or new) → inspect the
   crop → accept → the model weights update, or measurements go to the
   calibration sheet.
6. **Understand:** Mathematics → notebook chapters.

## 4. Brand traits

| Trait | …not tipping into |
|---|---|
| **Exacting**: integers, pixels, sources, stated scope | pedantic: caveats repeated in every paragraph |
| **Candid about uncertainty**: says "not checked in game" once, clearly, where it matters | hedging: disclaimers that bury the answer |
| **Deadpan**: plays the parody name completely straight, like a tiny, overly serious metrology department | jokey: memes, winks, "gamer" copy |
| **Player-native**: speaks share codes, cvars and 4:3 stretched | esports-loud: angles, neon, aggressive condensed caps, hype |
| **Self-contained**: local, quiet, owned | austere: clinical white-on-black with no warmth |

## 5. Market observations

Category references (from knowledge of the category; no single competitor was
studied in depth): pro-settings databases (player-photo tables, ad-heavy),
crosshair generator sites (a crosshair over a Dust2 screenshot, sliders,
"copy code"), Leetify/FACEIT-style stat dashboards, and CS2's own settings UI.

**Conventions to keep, because users depend on them:**
- A dark viewing ground for the crosshair. Crosshairs are judged against
  darkish game scenes, and green (the default) must pop.
- The share code and console command as first-class objects with copy buttons.
- Before/after side by side.
- Integer readouts with the exact cvar name.

**Conventions to break, because they make everyone look the same:**
- Neon or glow on near-black, orange-and-black esports palettes, angled
  "gamer" shapes, map screenshots behind the crosshair, and hype copy.
- Sliders for integers (they hide exact values), and a blurry, anti-aliased
  preview.
- Certainty theatre ("100% accurate conversion").
- Dashboard card grids.

## 6. Current state

**Stack:** hand-written ES modules, no framework. Markup is built with a tiny
`el()` helper (`app/ui/dom.js`); `index.html` holds the static manual-tool
markup. The CSS is two files (`app/styles.css` minified on 9 lines,
`app/convert.css`) plus `app/notebook.css`. The canvas previews are painted in
`app/convert/preview.js` and `app/manual/preview.js` with hard-coded hex
colours.

**Existing tokens:** `--bg --panel --raised --ink --muted --line --accent
(#c8d9b8 pale mint) --amber --sans (Inter or system) --mono`.

**Brand assets:** the name and its parody positioning ("not affiliated with
Valve or Volvo"), the `⌖` glyph in the masthead, and a favicon with four pale
green arms on a dark rounded square.

**What to keep:**
- The name and the deadpan parody stance.
- The crosshair-mark idea for the logo, evolved into a pixel-built mark that
  matches the favicon.
- The dark ground, the honesty of the copy and the evidence labels.
- The Simple/Expert split.
- Every ID, route, data contract and export.
- The "Local · no uploads" promise, which is real equity in this audience.

**Weaknesses:**
1. **Generic system look.** Inter/system sans, pale mint accent, bordered
   cards. Nothing says "pixels" or "measurement" except the canvases.
2. **Simple view is a form, not an answer.** Five full-width stacked cards;
   the result sits at the bottom (y ≈ 1200 px at 1440 wide) below four input
   cards. The preview shows the crosshair at 6×, a tiny 3-pixel blob in a huge
   empty canvas.
3. **No command text in Simple.** A phone user can't read the commands to
   type them.
4. **Caveat fatigue.** "Not an in-game capture" appears 3–4 times per screen
   in near-identical words, so none of them are read.
5. **Type scale chaos.** Sizes 8, 8.5, 9, 9.5, 10, 10.5, 11, 12, 13… and many
   one-off paddings. Sizes of 8–9 px on mobile are illegible.
6. **Inconsistent systems.** The manual tool (#workbench) and the converter
   look like two different products (green-tinted panels against grey).
   Headings use three different treatments.
7. **Weak hierarchy in Expert.** Primary actions are at the same weight as
   secondary ones, and the value table and metrics compete.
8. **Hard-coded canvas colours** are not tied to any token.

## 7. Constraints (load-bearing)

- **Functional:** every element ID used by `app/**` and by
  `tests/browser/*.py` stays (for example `#quant h1` text, `.quant-simple`,
  `.quant-layout`, `.quant-previews canvas` count = 3, the `#q-*`, `#qs-*` and
  manual-tool IDs, `[data-route]`, `#mode-toggle`, `html[data-mode]`,
  `html[data-ready]`, `#quant[data-result]`).
- **Exports:** `.cfg` text, report JSON and filenames are unchanged. No
  change to `lib/`.
- **Security:** the CSP stays strict (`style-src 'self'`, no inline styles, no
  `unsafe-inline`). No `innerHTML =` in `app/` (checked by
  `scripts/check.mjs`). Fonts need `font-src 'self'`, a documented change
  (ADR-0006).
- **Offline and private:** no remote font, CDN or analytics. Fonts are
  self-hosted, OFL-licensed and listed in `THIRD_PARTY_NOTICES.md` and
  `licenses/`.
- **Line-length ratchet:** `app/` JS lines over 140 characters must not
  increase per file.
- **Test harness:** `tests/browser/browser_harness.py` injects only
  `app/styles.css` and `app/convert.css`, so the design lives in those two
  files (plus `notebook.css`).
- **Accessibility:** WCAG 2.2 AA contrast, visible focus, keyboard,
  `prefers-reduced-motion`, and status regions kept.
- **Performance:** two variable WOFF2 subsets (≈128 KB total, Latin only),
  `font-display: swap`, matched fallback metrics to limit layout shift, and no
  JS added for decoration.
- **Generated files:** `docs/notebook.html` is regenerated by the script,
  never edited by hand.

## 8. Assumptions log

| # | Assumption | Evidence | Confidence |
|---|---|---|---|
| A1 | The primary user is a CS2 player recovering a pre-update crosshair, not a researcher. | The Simple mode is the default (CHANGELOG 0.4.0); README step 1 is "paste a share code"; the corpus is pro settings. | High |
| A2 | Most users are on desktop next to the game; phone use is "read and type into the console". | The tool outputs console commands and `.cfg` files; its value is on a PC. Nothing in the repo says this outright. | Medium |
| A3 | Users prefer a dark UI by default, but a light OS theme should be respected. | Gaming context and the existing dark design. No analytics exist. | Medium |
| A4 | The crosshair preview needs a dark "screen" ground in any theme. | Default green `#32fa32` and most pro colours are bright; the game view is mostly mid-dark. | High |
| A5 | Self-hosting two OFL fonts is acceptable under the "no runtime dependencies" rule. | ADR-0004 is about npm packages and persistence; fonts are static assets like the favicon. THIRD_PARTY_NOTICES currently says "no external font files are distributed", so this changes a stated fact and gets an ADR. | Medium |
| A6 | The parody tone should stay in the name and footer, with the interface completely straight-faced. | The copy is uniformly sober; the only joke is "Volvo". | High |
| A7 | Players will accept larger magnification if it's labelled. Auto-fitting the Simple preview is a display-only change. | `design.md`: "Canvas display zoom … are explicitly presentation operations". | High |
| A8 | Showing the cvar lines as text in Simple is additive and safe. | It uses the same `exportQuantCFG` output already placed in `#q-cfg`. | High |
| A9 | No brand colour has real equity. | The mint accent `#c8d9b8` is low-chroma and generic; there is no logo file beyond the `⌖` character and the favicon. | Medium |

---

## 9. Design direction

### Mining the domain

- **Materials:** pixels (the atomic unit here, literally counted), the console,
  `.cfg` text files, share codes (`CSGO-xxxxx-…`), build numbers, the game's
  dark scene.
- **Tools:** the console; screenshot, zoom and pixel-peeping; rulers and
  calipers in the metaphorical sense ("inner edge", "near/far", "residual
  px"); the repo's vocabulary is metrology: *measurement, calibration,
  holdout, residual, scope, certificate*.
- **Artifacts:** engineering drawings with dimension lines, title blocks with
  sheet numbers, revisions and "checked by" fields; inspection tags;
  calibration certificates.
- **Rituals:** "copy pro's crosshair", "test it on a bot map", dropping
  commands into the console one by one.
- **Emotional state:** mildly annoyed, suspicious, wants exactness and then to
  leave.

The strongest idea: **the app is a tiny, overly serious metrology office that
issues an inspection sheet for your crosshair.** The crosshair is the
specimen, the numbers are dimensions, and the uncertainty is a field on the
sheet ("Checked in game: not yet"), not a banner.

### Direction A: "Inspection sheet"

- **Concept:** every route is a numbered sheet in a small drawing set. Each
  page carries a **title block**, like the corner stamp of an engineering
  drawing, with *build 2000914 · model quant-static-v5 · snapshot 2026-09-23 ·
  scale ×N · checked in game: not yet*. The crosshair sits on a dark
  **specimen plate** (the game screen) with **dimension lines** reporting its
  measured arm length and thickness in game pixels. The UI is the paper; the
  plate is the game. This fits because it turns the product's defining
  honesty (scope, evidence, "not checked") into its visual form instead of
  disclaimers. It's exacting and deadpan, and it's native to pixels.
- **Typography:**
  - *Archivo* (OFL, variable width 62–125 and weight 100–900) is the voice.
    Condensed (wdth 72, wght 620) is used for display: sheet titles and the
    readout labels, like lettering on instrument plates. Normal width 400–500
    is used for text.
  - *Martian Mono* (OFL, variable width and weight) is used for everything a
    user could type into the console: numerals, cvars, codes, tags, sheet
    numbers.
  - The pairing rule: **Archivo speaks, Martian measures.**
  - Scale: a 1.25 ratio on a 15 px base, `12 · 13 · 15 · 17 · 21 · 26 · 33 ·
    41 · 52`. Readout numerals are 64–88 px mono. No text below 12 px, and 11 px
    only for all-caps mono tags.
- **Colour:** each colour has one role.

  | Role | Dark | Light |
  |---|---|---|
  | Paper (page) | graphite `#131514` | bone `#ECE9E1` |
  | Sheet (raised surface) | `#1A1D1B` | `#F5F3ED` |
  | Ink | bone `#E8E4DA` | graphite `#1A1C1B` |
  | Muted ink | 7:1 on paper | 7:1 on paper |
  | Rule (hairlines) | yes | yes |
  | Signal: annotation, focus, primary action, "conditional" | sodium `#E7C74E` | ochre `#7A5A00` for text on paper |
  | Alarm: blockers only | vermilion `#FF7A57` | `#B8361A` |
  | Plate (game screen, always dark) | `#0D0F0E` | `#0D0F0E` |

  The user's crosshair colour is the **only** saturated colour on the plate.
  The UI never uses green, so the crosshair is always the thing that glows,
  and it glows because of contrast, not because of a glow effect.
- **Layout:** a 12-column sheet at a max width of 1320 px, on a 4 px baseline
  with an 8 px rhythm. Simple view has two panels: *Input* (5 columns) and
  *Reading* (7 columns, sticky). Expert keeps its rail and bench. Section
  rules are hairlines with a sheet coordinate on the left (`A1`, `A2`…).
  Density is medium: generous around the readout, tight in tables.
- **Motion:** almost none. On a new result the readout numerals fade from 40%
  to 100% opacity over 140 ms, so a changed number is noticed. Details
  disclosure markers rotate. All motion is removed under reduced motion.
- **Signatures:**
  1. The **dimensioned specimen**: dimension lines with end ticks and px
     labels drawn on the canvas in the signal colour, with auto-fit
     magnification stated on the plate (`×20`).
  2. The **title block** in the page header, with the field *Checked in game —
     not yet*.
- **How it stands apart:** it reads as an engineering document rather than a
  game UI or a SaaS dashboard, so no neon, no angles, no cards with shadows,
  no gradients.
- **What it refuses:** gradients, glows, shadows, rounded cards, icon sets,
  hover lifts, marketing hero, repeated disclaimers, green UI chrome.

### Direction B: "Errata": the lab journal

- **Concept:** the product is a living research paper that happens to compute.
  It uses light paper, numbered figures ("Fig. 1: old shape; Fig. 2:
  proposal"), marginal notes for caveats and footnote markers on every claim.
  Honesty is expressed as scholarly apparatus.
- **Typography:** *Newsreader* (serif, optical sizes) for text and headings,
  *IBM Plex Mono* for values; small caps for labels.
- **Colour:** paper white, black ink, one red for errata and corrections, and
  a blue link colour.
- **Layout:** a single 68-character text column with a wide right margin for
  notes; figures break into the margin.
- **Motion:** none.
- **Signatures:** margin notes that attach caveats to the exact number they
  qualify, and an "Errata" box listing what is unverified.
- **Stands apart:** nobody in gaming looks like a journal.
- **Refuses:** dark mode by default, and UI chrome that looks like controls.
- **Weakness:** it is perfect for the notebook and research pages but wrong
  for a player pasting a code at 1 a.m. It would feel like homework, and a
  light, bright page beside a dark game is hostile.

### Direction C: "Diff": the config file as interface

- **Concept:** the whole converter is a `.cfg` file. The input is the old cfg
  with editable tokens (`cl_crosshairsize [2]`), and the result is a code diff:
  red old lines, green new lines. The preview sits in a gutter.
- **Typography:** monospace throughout (*Commit Mono*), with one grotesk for
  page titles.
- **Colour:** editor-dark palette with diff red and green, plus a selection
  highlight.
- **Layout:** full-width editor panes and a line-number gutter.
- **Motion:** a caret blink, and typed-out results.
- **Signatures:** a "migration diff" from old cvars to new ones with line
  numbers.
- **Stands apart:** it is completely native to the console.
- **Refuses:** prose and cards.
- **Weakness:** it collides with the terminal and hacker cliché, puts diff
  green right next to the (usually green) crosshair, is poor for long research
  prose, and has lower accessibility for users who don't read diffs.

### Evaluation and choice

| Criterion | A: Inspection sheet | B: Errata | C: Diff |
|---|---|---|---|
| Fits the primary player (A1 to A3) | strong | weak | medium |
| Carries the honesty without disclaimer spam | strong (title block field and tags) | strong | weak |
| Specific to this product | strong (pixels and dimensions) | medium | medium (any cfg tool) |
| Avoids category and AI clichés | strong | strong | weak (terminal) |
| Works for the research pages | good | best | poor |
| Works on mobile | good | good | poor |

**Chosen: A, "Inspection sheet".** It is the only direction whose central
metaphor is the product's own substance: measuring pixels and stating scope.
From B it borrows the discipline of stating each caveat once, next to the thing
it qualifies. From C it borrows a legible list of console commands in the
Simple readout.

**What this trades away:** B's literary warmth on the long-form pages (the
notebook stays in Archivo rather than a serif), and C's immediate "this is a
config tool" read. There is also a risk: drafting motifs can drift into kitsch
(blueprint blue, fake paper, stamps). The rule against that is **hairlines,
type and dimension lines only. No textures, no blueprint colours, no rubber
stamps.**

**Robustness against weak assumptions:**
- *A3 (dark vs light):* both themes are designed from the same tokens and
  follow the OS, and the plate stays dark in either.
- *A2 (mobile use):* mobile is designed as "paste → readout → type the
  commands", with commands as large, legible text.
- *A5 (fonts allowed):* fallback stacks with metric overrides mean that
  deleting the two WOFF2 files degrades gracefully to system fonts without
  breaking layout.
