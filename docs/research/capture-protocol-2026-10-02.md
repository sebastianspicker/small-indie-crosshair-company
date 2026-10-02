# Native capture protocol — October 2, 2026

This extends and, where they differ, supersedes the
[capture protocol in the October 1 note](build-2000922-update-2026-10-01.md#native-capture-protocol).
It adds the styles the October 1 update touched, the zero-length and outline
cases from issue #11
and the gap-origin question. Nothing here is a result: the repository still holds
no native 2000922 capture. Model predictions are labelled as such and are not
evidence.

## Setup

- Build 2000922 or newer (record `steam.inf` / the in-game version). Native
  1920x1080, no scaling, `cl_crosshair_screen_height 1080`, default HUD scale.
- A static position facing a flat, neutral, evenly lit wall; no weapon sway, no
  other HUD element within 40 px of the screen centre. Fixed weapon, standing
  still, no recoil (`cl_crosshair_recoil 0`).
- Colour opaque white (`cl_crosshaircolor_r/g/b 255`, `_a 255`) unless the case
  says otherwise; outline colour black.
- Take unedited PNG screenshots at the native resolution. Do not crop, resize or
  re-encode. Compute the SHA-256 of each file straight after saving it
  (`shasum -a 256 *.png`) and keep the files outside this repository.
- Retake rather than edit. Record every failed capture and the reason.

## Roles are fixed in advance

Each case has its `calibration` or `holdout` role in the research harness
(development tooling, not published), assigned before any capture exists.
Do not change a role after seeing a result. A holdout is looked at once, to score
a model that was fitted on calibration cases only. Per the
[measurement policy](../evidence/measurement-policy.md), never fit and validate on
the same capture, and never promote an imported record without a separate review.

## Console lines and predictions

The research harness (development tooling, not published) lists all cases with their
console lines and predicted ASCII mask, can select one case such as `s8-hash-g3`,
and can emit the cases as JSON.

The lines are typed into the console in order. For each case the harness also prints
the mask our model predicts (`#` colour, `o` outline only, `.` empty, centre pixel
in the middle of the 41 x 41 window). The prediction is the
`community-static-v5` forward model (equations unchanged since v4) with the assumed outline modes (mode 1 one
pixel all round, mode 2 top and left); it is a hypothesis to be tested. Negative
gaps and styles without a model print `none`.

Comparing a capture (for example a screenshot against case `s1-t2-g4` with the
centre pixel at 960,540) is done by a second research script. It crops 41 x 41 around the centre pixel, thresholds against the background (median
of the window border), and reports agreement and IoU with the prediction at zero
offset and at the best offset within +-4 px. A best offset other than (0,0) is a
finding in its own right (the old-client reporter case shows a +3 px x offset). It
reads only geometry; read alpha from the printed mean luma of outline and core
pixels. Use `--threshold` when the background is textured.

## Cases

Step 0. **Valve's own migration.** Before touching any cvar, `exec` an old cfg
(old `cl_crosshairsize`, `thickness`, `gap`, `outlinethickness`, outline on, colour,
alpha) in the new client. Screenshot the crosshair, then screenshot the crosshair
settings screen and note every cvar value the new client now shows. Do this for at
least: size 0 with outline, gap -5, and thickness 3.4 (the reporter's settings), and
the default crosshair. This is the only direct evidence of how Valve maps old values.
(`s0-migration`)

Step 1. **Style 4 control.** Length 8, outline off. Thickness 1 gap 4; thickness 2
gaps 4, 0 and -2. The gap -2 case is console-only and outside the model domain.
(`s1-t1-g4`, `s1-t2-g4`, `s1-t2-g0`, `s1-t2-gm2`)

Step 2. **Style 2 at rest** with the step 1 values. Does it equal style 4? If the
console gap does not take effect, set the classic gap in the UI and note it.
(`s2-style2-rest`)

Step 3. **Style 5 at rest and after a burst.** At rest against style 4; then
immediately after a 10 round burst and again 3 seconds later. (`s3-style5-rest`,
`s3-style5-burst`)

Step 4. **Style 3** with the step 1 values. (`s4-style3`)

Step 5. **Style 8**: gap 4 and 8, thickness 2 and 6, and the dot on.
(`s5-style8-g4-t2`, `-g8-t2`, `-g4-t6`, `-g8-t6`, `-dot`)

Step 6. **Style 9**: `cl_crosshair_dynamic_maxdist_splitratio` 0, 0.5 and 1 (the
"Quadrant Size" slider). (`s6-style9-r0`, `-r05`, `-r1`)

Step 7. **Style 6** (the UI shows no sliders). (`s7-style6`)

Step 8. **Zero-length bars and the '#'.** Style 4, length 0, thickness 3, gap 3 with
`cl_crosshair_drawoutline` 0, 1 and 2. Question: does a zero-length bar draw nothing
or a 1 px rect, and does it keep an outline? Then the '#' attempt: length 0,
thickness 8, gap 3 and gap -1 with drawoutline 2, which should reproduce the old
reporter shape if outlines of empty bars survive. (`s8-zero-o0`, `-o1`, `-o2`,
`s8-hash-g3`, `s8-hash-gm1`)

Step 9. **Gap origin at odd thickness.** Length 8, gap 4, outline off, thickness 1, 3
and 5. Decides whether the gap counts from the centre pixel's near edge (ceil) or
its far edge (floor); the best-offset search shows a one-pixel difference.
(`s9-t1`, `s9-t3`, `s9-t5`)

Step 10. **Outline alpha.** Drawoutline 1, crosshair alpha 128, outline alpha 255
and then 128. Compare the mean luma of the outline pixels over the same background.
Decides whether the new outline is multiplied by the crosshair alpha.
(`s10-a128-o255`, `s10-a128-o128`)

Step 11. **Old-client reference, if available.** On a pre-update client (Steam beta
branch or an old install), capture the reporter's settings
(`old-reporter-issue11`) and the step 1 control. This tells whether the unexplained
+3 px x offset in [issue #11's screenshot](../../research/measurements/old-client-issue-11.json)
comes from the old renderer or from that capture.

## Submitting

Open a GitHub issue per session titled `Native capture: build NNNNNNN`. For each
capture give: case id, role, the exact console lines (paste the tool output), game
build, resolution, the SHA-256 of the unedited PNG, an attestation that it is
unedited, and the PNG itself or a link. Mention the comparer output. Records enter
the repository only through the measurement import (`native-user`, build 2000922)
and stay user-attested until reviewed. Old-client observations cannot enter that
import; they are stored as documented, unregistered files next to
`research/measurements/index.json`.
