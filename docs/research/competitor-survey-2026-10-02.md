# Converter and source survey, 2026-10-02

Survey of other old-to-new CS2 crosshair converters and of the leaked old
renderer, retrieved 2026-10-02. It drove the second round of 0.12.0 edge cases
(old draw order and blending) and the new ledger entries [S15 to S18](source-ledger.md#s15-bindr).

Labels: [S] stated (docs/text), [C] code-derived (read, not run against the
game), [M] measured (claimed by the tool author, not reproducible here).

Clean room: formulas are restated in our own words; no third-party code is
copied here or in the converter. Repositories were cloned outside this
repository for reading only. The "Ours" column describes the state before
the second round of edge cases; see [Follow-up](#10-follow-up-in-0120) for what changed.

## 1. Sources and revisions

| Tool | URL | Revision / retrieval | Licence |
|---|---|---|---|
| JDD310/CS2-Crosshair-Converter | github.com/JDD310/CS2-Crosshair-Converter | `013c559`, 2026-09-30 | MIT (John Dennis) |
| patriqcs/cursed-crosshair-generator | github.com/patriqcs/cursed-crosshair-generator | `fa88525`, 2026-10-01 | MIT (patriQ) |
| Horizzon1 cs2-crosshair-migrator | horizzon1.github.io/cs2-crosshair-migrator ; repo Horizzon1/cs2-crosshair-migrator | `3a867cc`, 2026-09-27 (single index.html) | none found (no LICENSE file) |
| SpiRaL-network/cs2-crosshair-lab | github.com/SpiRaL-network/cs2-crosshair-lab | `72e81b8`, 2026-10-01 | none (all rights reserved) |
| Kava4/cs2-crosshair-studio | github.com/Kava4/cs2-crosshair-studio | `4112212`, 2026-06-30 | none found. Pre-update legacy generator; no conversion. Irrelevant. |
| percdotdev/bindr (NEW) PR #1 by kWAYTV, merged | github.com/percdotdev/bindr | `17e906d`, 2026-10-01; `packages/cs2/src/crosshair/legacy/migrate-legacy-crosshair.ts` | none found (no LICENSE file at root) |
| crosshairrestore.com | /conversion-method/ | fetched 2026-10-02, closed source | closed |
| crosshair.club/convert | fetched 2026-10-02 | closed, no repo | closed |
| cstools.io/crosshair | fetched 2026-10-02 | closed, no formulas shown | closed |
| csxhair (SyberiaK) | github.com/SyberiaK/csxhair, issue #1 | search result only; issue page returned no usable content | not checked |
| unicbm/demotracer | in ledger S12 | not re-read | AGPL, do not use |
| perilouswithadollarsign/cstrike15_src (leak) | `f82112a`, 2020-04-23 | | leak, read only |

Unreachable or empty: talkesport (403), Steam changelog (429), Steam announcement pages (JS shell only), cs.money (403), escorenews (403), skin.land (403), reddit/HLTV (no thread surfaced by search). Secondary outlets (timesaver, skinsmonkey, fpshub, fragster, pley) were used for Valve patch-note text.

## 2. How each tool converts length / thickness / gap

Common old-side model (all [C], same as ours): scale = H/480; length = round(size*scale); thickness = max(1, round(thickness*scale)); old bar space = trunc(4 + gap), gap NOT scaled.

| Tool | Length rounding | Thickness | New gap (odd-width origin) |
|---|---|---|---|
| JDD310 [C] | half-to-even | max(1, ..), new range 1..31 (thickness 0 impossible) | space + ceil(t/2); gap clamp 0..128 |
| cursed migrate.js [C] | half-to-even, then max(0,..) | max(1, ..) | space + floor(t/2), explicitly a "hypothesis" hook `gapInnerEdgeOffset=0`; clamp >= 0. Assumes legacy height 960 for stored presets |
| Horizzon1 [C] | half-to-even | max(1, ..) clamp 1..20 | space + (t mod 2) (1 for odd thickness); stale clamps: length 0..100, gap -50..50, no screen_height emitted. Rationale [S]: "with an odd thickness the new game draws the gap about a pixel smaller", confirmed by one player (ropz) |
| bindr [C] | Math.round (half away from zero, NOT half-even) | max(1, ..), clamp 0..32 | space + ceil(t/2); negative allowed only for style 2 (Classic Dynamic) |
| crosshairrestore [S][M] | half-to-even, "old pixels" | min 1; "0 draws nothing" | space + ceil(t/2). Measured at 1080 and 1280x960 only; claims 13 held-back crosshairs per profile, zero pixel error, build 2000908 vs 2000914 paired screenshots. Not inspectable |
| SpiRaL [C] | Math.round(n*H/480) (half away), applied to length, thickness AND gap | no min 1 | gap scaled by H/480 as well (contradicts S01 leak, where gap is raw pixels). No odd origin term. Default H 960 |
| crosshair.club [S] | not stated | | not stated; claims renderers "rebuilt from the game" and results labelled identical / almost identical |
| cstools.io [S] | not stated | | not stated; says conversion needs the play resolution |

Which fixes `cl_crosshair_screen_height`: JDD310 emits it (= --height), cursed emits it (960 for stored presets), bindr default screenHeight, SpiRaL reference = import height; Horizzon1 does not.

## 3. Edge-case comparison table

| # | Case | JDD310 | cursed | Horizzon1 | bindr | crosshairrestore | SpiRaL | Ours (edge-case rules / community-edge.js) |
|---|---|---|---|---|---|---|---|---|
| 1 | Negative old gap, crossed arms (size 2, gap -11.5) | clamp new gap 0, warn | clamp 0 | formula allows new gap down to -50 (stale clamp), no crossing logic | clamp 0 except style 2 | -5..-4 -> touching; below -5 "manual" | scales gap, new static cross draws crossed arms (assumes negative works) | fold crossed arms into mirrored pixels / merged bar at gap 0, warn |
| 2a | size 0 | length 0 kept, nothing special | length 0 | length 0 | length 0 | not stated | length 0 | zero-length draws nothing |
| 2b | outline-only `#` (size 0 + outline, no dot) | outline flag kept, so new game draws nothing (silent loss) | drops outline if stored width 0, otherwise outline on with length 0 -> nothing | same silent loss | same | not stated | n/a | redrawn as black core |
| 2c | dot only | dot=1, length 0 | dot=1, length 0 | dot=1, len 0 | dot=1, len 0 | not stated | dot=1 | dot-only-as-arms (extra arms, gap 0) |
| 3 | outline thickness | any thickness -> full(1); note says "use half" | thickness > 0 -> full, 0 -> none | only on/off; warns if >1 px | on/off only | on/off only | n/a | <1 -> half(2); 0 typed in CFG -> none; share-code 0 -> half; widths 2/3 -> full with note |
| 4a | usealpha 0 | alpha 255 | alpha 255 | alpha 255 | alpha 255 | "suggests 255" | n/a | fill 255, outline 200 |
| 4b | outline alpha | not set | outline = black at crosshair alpha | not set | outline = black at crosshair alpha | not stated | n/a | black at crosshair alpha |
| 5 | colour presets 0-4 | 255/0/0, 0/255/0, 255/255/0, 0/0/255, 0/255/255 | 250/50/50, 50/250/50, 250/250/50, 50/50/250, 50/250/250 | same as JDD310 (full-saturation) | same as JDD310 | "undocumented, user must choose" | not converted | 250/50 set (matches leak) |
| 6 | styles | 0->0, 1->4, 2->2, 3->0, 4->4, 5->5 | same map | same map | 0->2, 1->4, 2->2, 3->2, 4->4, 5->5 | only 2, 4, 5 mapped; 0/1/3 manual | none | (see source labelled static) |
| 7 | useweaponvalue / fixedgap / T / recoil | dropped with note; T kept; recoil kept | dropped; T and recoil kept | dropped with note | dropped; T and recoil kept | removed settings listed | n/a | not re-checked |
| 8 | stretched / 4:3 / non-1080 | --height N; warns outside 1080/960 | restore height 960 | dropdown of heights; custom 240..4320 | param | only 1080 and 960 measured | default 960 | authored height from user |
| 9 | clamps | length 0..255, thick 1..31, gap 0..128 | via normalizeParams (thickness to 32, gap signed) | length 0..100, thick 1..20, gap -50..50 (stale) | length 0..255, thick 0..32, gap -3840..3840 | n/a | ranges 0..255 / 0..32 / -3840..3840 | gap 0..128 (build ranges) |
| 10 | share-code quirks | v1: gap and thickness x10 signed int8/uint8, outline thickness stored as byte/2 (0.5 steps), size 13 bits x10; v3/v4/new format decode; checksum | decode v1 to old params; new `CS` + 44 chars | decodes v1 only (decode bug: splitdist mask 7 vs 0x7F, recoil bit shift) | v1 + v3/v4 + CS; claims +-1 px vs game import | handles codes | new `CS` format only (32 bytes, outline mode 2 bits), Legacy `CSGO-` unsupported | rounded-0.5-steps note |

Horizzon1 share-code decode divergences [C]: `splitdist = b[8] & 7` (others use 0x7F), `recoil = ((b[8]>>4)&8)` (others use bit 7). Minor, not conversion-relevant.

## 4. Where tools differ from what we do, and who is probably right

1. **Colour presets (real conflict).** JDD310, Horizzon1, bindr use full-saturation 255/0/0 etc.; cursed and we use 250/50. The leaked old renderer [C] has the 250/50 table (`weapon_csbase.cpp` lines 1896-1906: case 0 = 250,50,50 ... case 4 = 50,250,250; default 50,250,50). We agree with the leak. Three tools are off by up to 50 per channel.
2. **usealpha 0 (conflict).** Four tools use 255. Leak [C]: `alpha = 200` forced (line ~1931-1935) and the fill goes through the additive texture path. We export 255 for the fill, matching the other tools, and the outline stays 200. Caveat: the new renderer has no additive path (see section 6), so 255 is only the nearest visual.
3. **Odd-width gap origin.** Three rival formulas: ceil(t/2) (JDD310, bindr, crosshairrestore [M at 1080 and 960]), floor(t/2) (cursed migrate), t mod 2 (Horizzon1, validated by one player). We equal JDD310. crosshairrestore is the only tool claiming pixel measurement; Horizzon1 and cursed are stated hypotheses. See also section 6 on cursed's decompiled layout.
4. **Negative gap.** Every tool but SpiRaL clamps to 0. We alone fold the crossed arms. cursed's decompile says static cross clamps negative distance to 0 in the game itself [C, stated decompile], which supports our fold being the only way to reproduce crossed arms with a non-negative gap. SpiRaL guesses new crossed arms work [C, README says unverified]. Valve [S]: negative gap only enabled for Classic Dynamic (style 2; menu range -10..128; cvar range -3840..3840).
5. **Outline mode.** Our <1 -> half(2) is the only tool that uses mode 2 automatically. JDD310 offers `--outline half` as manual. crosshairrestore [S]: outline on/off only. Conflict case: zero thickness in a CFG. Leak [C]: `cl_crosshair_outlinethickness` is declared with bounds (0.1, 3) (line 411), so the engine clamps 0 to 0.1, and at 0.1 the rect extends by ceil(0.1)=1 on low edges and floor(0.1)=0 on high edges, i.e. a top-left-only 1 px outline. Our `outlineMode()` maps a CFG-typed 0 to "no outline" (native.js comment). cursed maps 0 to no outline too. If bounds enforcement works as in Source 1, a typed 0 draws the half outline. Unverified; the leak is from 2020 and CS2 is Source 2.
6. **Style 0/1 mapping.** bindr maps 0 and 3 to style 2 (Classic Dynamic); others map to Dynamic Cross (0). Not a pixel matter at rest.
7. **Rounding.** bindr and SpiRaL round half away; leak [C] uses RoundFloatToInt on a float product (our roundEven with f32 arithmetic already models this; check ties only matter for e.g. size 2 at 1080 = 4.5).
8. **Gap scaling with H/480 (SpiRaL).** Contradicts the leak: `iCrosshairDistance = fCrosshairDistanceGoal + cl_crosshairgap` for style 4 (lines 2047-2050), unscaled. SpiRaL is wrong for the old side.

## 5. New edge cases we may not have considered

A. **Old outline overpaints earlier fills (leak [C]).** `DrawCrosshairRect` draws each bar's outline (black, alpha a, rect expanded by t) and then its fill, bar by bar: left, right, top, bottom, then dot (lines 419-434, 2186-2213). Each bar's outline therefore paints over the fills already drawn. When bars touch or cross (gap <= 0, negative gap, dot with small gap), the later bars' outlines blacken part of the earlier bars' fills; the dot's outline darkens adjacent arm pixels. The reporter's "cross with a one-pixel hole on each side of the dot" in issue #15 matches this mechanism. Our shape check compares by colour, but does the old-appearance model use per-bar draw order or one combined mask? Worth checking `lib/geometry/appearance.js`. The new shader (cursed port [C, stated decompile]) composites fill over outline per pixel, with no ordering effect, so folded arms can never reproduce the hole.
B. **Outline in additive mode.** Leak: fill uses the additive texture (`DrawTexturedRect`) when usealpha is 0, while the outline is still `DrawFilledRect` black at alpha 200. So the old usealpha-0 look is "additive coloured bars with alpha-blended black outline". Only matters for pixel-colour fidelity.
C. **Outline thickness cvar bounds** (0.1..3) clamp 5 to 3 and 0 to 0.1 [C] (see 4.5).
D. **New renderer scales gap too, and 0 stays 0** (cursed `scaleGap`, decompile-derived [stated]): factor = H/refH; positive values become max(1, roundHalfAway(v*factor)), 0 stays 0, negatives become min(-1, ...). Applies to length, thickness, spread limit, splitdist. This addresses the repo's open `gap-scale-unresolved` warning: if true, gap scales like length/thickness at non-authored heights. Evidence class: stated decompile, not measured; its author says rounding is "per Screenshot zu belegen".
E. **Scaled values are written back to the cvars** and clamped (length <= 255, thickness <= 32), so a scaled-up crosshair at 4K can clamp [stated decompile].
F. **Thickness 0 in new renderer** draws nothing for cross/square/dot (cursed: `if (len <= 0 || t <= 0) return`); crosshairrestore [S]: "0 draws nothing". Quadrant and ring styles do not check thickness>0 in some paths.
G. **Thickness 32.** New range is 0..32 in build 2000922 (cvar), the UI slider 31. Horizzon1 clamps 20 and JDD310 31.
H. **Old default style 0/1 are not the cvar-driven bar painter in the leak.** Scaleform reticle (`sfhudreticle.cpp`) draws styles 0/1 (hidden when style >= 2, line 1008) using the SWF pips, with `cl_fixedcrosshairgap` (default 3) as the pip offset in the non-dynamic branch (lines 1770-1790). `DrawCrosshair` itself has no style gate. See answer (b).
I. **Share code**: old v1 stores outline thickness as a byte of 0.5 steps; new `CS` format 32 bytes with 2-bit outline mode and outline RGBA (SpiRaL, cursed; client serializer RVA 0xDAD590 per SpiRaL comment [stated]). Pixel-era v3/v4 `CSGO-` codes have no outline colour: black at crosshair alpha is the import default (cursed [S], bindr [S]).
J. **Valve says gap 0 bug fixed on 2026-09-24**: "Fixed a bug preventing 0 gap width from being respected" [S, fpshub secondary]. Data captured before this hotfix may show gap 0 drawn as gap 1.
K. **Min dynamic spread distance** reduced to 64 px (same note) and again lowered to the dot size in 2000922 (cursed [C]); irrelevant for static.

## 6. Evidence about the current renderer

Valve statements [S, secondary outlets quoting Valve's notes]:
- 2026-09-22 (build 2000914): pixel units; example "1 px wide, 8 px bars, 4 px gap = thickness 1, length 8, gap 4"; game auto-rescales pixel counts on resolution change.
- 2026-09-23/24 hotfix: half outline "only draw the top-left portions of the outline"; static square style; 0 gap fixed; min dynamic spread 64 px.
- 2026-09-30 / Oct 1 (client 2000922, 1.41.8.8): outline colour option, Static Quadrant (style 9), negative gaps only for Classic Dynamic, 0.01 alpha steps, scope dot in share code, new share-code format. Valve pulled and republished the build within about 70 minutes.
- No official migration tool; old codes give "Invalid or old crosshair code" [S, timesaver/skinsmonkey].

Decompile/port evidence, cursed `public/js/preview.js` (MIT, stated: Ghidra on libclient.so build 2000922, shader reconstructed from SPIR-V; not independently verified) [stated + C]:
- Bar thickness n = max(1, round(t)), hi = (n+1)>>1 pixels before centre, lo = n - hi after. Odd widths therefore sit one pixel up-left of the screen-centre pixel.
- Static cross: horizontal arms start at floor(cx - dist) on the left and at ceil(cx + dist) - (odd ? 1 : 0) on the right; vertical equivalent. dist = max(0, gap). Arms need length > 0 and thickness > 0, otherwise nothing is drawn including the outline. **This supports our "zero-length draws nothing, outline included".**
- Dot: a thickness x thickness square, drawn when dot = 1 or style 6, **independent of length** (needs thickness > 0). A dot at length 0 therefore DOES draw. Our edge-case rules say "no capture shows a dot at length 0"; the decompile claim is that it is drawn. If the claim holds, "dot-only-as-arms" could be replaced by length 0 plus dot, since the new dot square is thickness-sized. The old dot-only shape is a W x W dot (leak lines 2207-2214) so the same square.
- Outline: mode 1 expands every rect by 1 px on all sides, mode 2 by 1 px on top/left and 0 on bottom/right; outline thickness is fixed at 1 px, not scaled. Outline colour and alpha come from the new cvars (default black, alpha 255).
- Shader: per pixel, max-alpha fill and max-alpha outline selection, fill composited over outline, premultiplied; blend is SRC_ALPHA / ONE_MINUS_SRC_ALPHA in linear light on an sRGB framebuffer (measured per its `tools/calib-compare.py` against 16 screenshots, which are not in the repo: `data/calibration-v2` is absent). The shader has no additive mode, so old usealpha 0 additive cannot be reproduced exactly.
- Negative gap on static styles: the game clamps (cross, square to 0; circle and quadrant to 1). On Classic Dynamic the negative gap shortens the spread-based distance, but the bars stay at >= 0.
- cursed ships a v3 calibration case list (`tools/calib-codes.mjs`, including "negative gap -10 on static cross must look like gap 0", "Half Outline t=4 gap=6 len=12", "thickness 32") but no captured screenshots or results in the repo, so these remain unmeasured.

Measured (claimed, not inspectable): crosshairrestore pairs of lossless screenshots build 2000908 vs 2000914 at 1080 and 960 with zero error on 13 held-back crosshairs each. No tool publishes a capture showing length 0 with a dot, half-outline pixels, or negative static gaps.

## 7. ML / data-driven approaches

None found. All tools are closed-form rules. crosshair.club and crosshairrestore say they "rebuilt" renderers and test against held-back captures but publish nothing.

## 8. The leaked old renderer, restated

Source: `weapon_csbase.cpp` at `perilouswithadollarsign/cstrike15_src` `f82112a`
(game/shared/cstrike15, 2020-04-23), a leak, read only. Line numbers refer to
that file. This is a 2020 snapshot: it lacks `cl_crosshair_t`,
`cl_crosshair_recoil` and several later cvars, and its style comments (0
default, 1 default static, 2 accurate split, 3 accurate dynamic, 4 classic
static, 5 old CS) differ from the live pre-update numbering (2 classic, 3
classic dynamic). Treat it as code-derived hints, not proof of 2026 behaviour.

(a) **`cl_crosshairusealpha 0`** [C], lines 1921-1935 and 419-436. Without
usealpha (and without night vision) the fill is drawn additively through the
`whiteAdditive` HUD texture, and the alpha is forced to 200 whatever
`cl_crosshairalpha` says. The outline is always a normal filled black rect at
that same alpha, so the old look was additive coloured bars inside a
normally blended black outline at 200. Night vision forces the normal path and
the colour 250 50 50. With usealpha 1 the alpha is `cl_crosshairalpha` clamped
to 0-255.

(b) **Styles 0 and 1** [C]. The bar painter does not special-case them: at rest
the distance is round(4 × H / 1200 + gap) (base 4 scaled by H/1200, the gap
raw, rounded after the sum, line 2030), with the dynamic distance clamped to
[goal, 25] and a firing delta for every style other than 4. Size and
thickness still scale by H/480. Separately, the Scaleform reticle
(`sfhudreticle.cpp`) is shown only for styles below 2 (line 1008) and places
its pips at the fixed offset `cl_fixedcrosshairgap` (default 3) in the
non-dynamic branch (lines 1770-1790). Whether the bar painter also runs for 0
and 1 cannot be decided from the leak.

(c) **Outline thickness** [C], line 411. The cvar is declared with bounds 0.1
to 3, so 5 is clamped to 3 and 0 to 0.1 by the cvar framework; the file adds
no clamp of its own. Each outline rect is the bar rect grown by the thickness
on every side with integer parameters (the float is truncated), so 3 draws 3
px on each side and 0.1 or 0.5 draws 1 px on the low edges and 0 on the high
edges.

(d) **`cl_crosshairgap_useweaponvalue 1`** [C], line 1981 and 2047-2050. The
distance goal is the weapon's minimum crosshair distance instead of the
constant 4, and static style 4 uses that goal too: its distance is the
truncated goal plus the gap. So the weapon value is not dynamic-only. The
per-weapon numbers live in weapon scripts, which are not in the leak (S13
records the per-weapon gap data removed in the new build). A config with
useweaponvalue 1 therefore had a per-weapon gap that one new gap cannot carry.

(e) **Draw order and size 0** [C], lines 2186-2214. The four bars and the dot
are separate rect calls in the order left, right, top, bottom, dot, and each
call paints its outline and then its fill. Later outlines therefore paint
over earlier fills where they overlap (no per-pixel maximum as in the new
shader), and with alpha below 255 overlapping regions blend twice. A bar with
size 0 has an empty fill but its outline rect still draws, giving the
outline-only `#` of issue #11. The dot is a thickness-sized square drawn
whenever `cl_crosshairdot` is set, with its outline, independent of size. The
"crossed arms with a hole beside the dot" of issue #15 is consistent with these
overpaints.

## 9. Gaps in this survey

- Reddit, HLTV, Steam discussion threads: not reachable through search or fetch; no measurement threads found. Nothing found for "cl_crosshair_length 0" dot behaviour except cursed's decompile claim.
- SyberiaK/csxhair issue #1 content not retrieved.
- The cursed calibration data (`data/calibration-v2` screenshots, `~/projects/cs2-re/NOTES.md`) is not published.

## 10. Follow-up in 0.12.0

The second round of edge cases acts on sections 4, 5 and 8:

- The old side of the shape check and the old previews paint in the old draw
  order (8e). Published rows whose old look has outline pixels over a fill warn
  `outline-overpaint-lost`.
- `cl_crosshairusealpha 0` (4.2, 5B, 8a) exports fill alpha 255 (the outline stays 200) and warns
  `additive-blend-approximated`. A least-squares normal-blend alpha
  ([`additive-alpha.json`](../../research/generated/additive-alpha.json)) was fitted and rejected.
- Outline thickness above 3 is clamped on import (5C, 8c); a typed 0 stays 0.
- `cl_crosshairgap_useweaponvalue 1` converts with the non-weapon goal 4 and
  warns `weapon-gap-dropped` (8d). Old styles 0 and 1 stay rejected with a
  clearer message (8b).
- bindr's restated formula joins the cross-tool baselines
  ([`converter-comparison.json`](../../research/generated/converter-comparison.json)).
- The cursed decompile claim that the new dot draws at length 0 (section 6) is
  recorded as conflicting secondary evidence; the dot-only export draws the
  same pixels either way.
