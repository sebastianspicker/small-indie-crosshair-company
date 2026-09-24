# 07 — Screenshot inversion and non-circular visual feedback

**Version note:** the v4 derivation below is preserved. [Chapter 09](09-solver-and-integrity.md) specifies the implemented v5 joint inverse, full-domain shape metric, robust likelihood and evidence-integrity changes.

A crosshair screenshot is an observation of pixels, not a unique encoding
of old cvars. This chapter describes both image paths: estimating a target
from an old capture, and measuring a native new capture that can challenge
our forward hypotheses. They intentionally use different procedures.

## 7.1 What a screenshot does and does not contain

An original screenshot can constrain colored arm length, width, location,
dot presence, and T shape. It generally cannot identify the original
floating-point cvars, color preset, alpha setting, actual rendering
resolution after an external resize, movement state, or weapon-dependent
gap rule. A crop's dimensions are not the game resolution. A 129-pixel crop
of a 1440p game remains a 1440p observation.

The user supplies the old game height, uploads a PNG, and may adjust the
center and select a line's color. A full image defaults its center to the
integer half-width/half-height. That is an initial coordinate choice, not
a guarantee of the correct game center. Crosshairs cropped asymmetrically,
centered between pixels, or transformed by capture software need review.

The application rejects non-PNG headers, zero dimensions, sides exceeding
8192, more than 20 million pixels, or files exceeding 16 MB before browser
image decoding. These are resource limits, not malware certification.
No OCR is used. All bytes remain in the user's tab; exports contain
geometry, declared provenance and hashes, not the original image.

## 7.2 Color segmentation

Analysis uses a 129×129 center crop by default. Supported algorithmic
crop sizes are odd values from 49 through 161. Display enlargement uses
nearest-neighbor interpolation, while analysis retains the original crop
pixels. A clicked color provides a seed \(c\). The binary foreground mask is

\[
B(x,y)=\mathbf1\{\|I_{RGB}(x,y)-c\|_2\le\tau\}
\mathbf1\{I_\alpha(x,y)>32\}.
\]

The tolerance \(\tau\) is a user-adjustable RGB-space distance between
1 and 120, not a perceptually uniform color difference. Automatic color
selection proposes up to five frequent saturated colors from a central
37×37 area. RGB values are binned for frequency counting, but each candidate
retains a sampled color. White, black, low-alpha or heavily antialiased
crosshairs may require a click because the saturated-color heuristic is
not appropriate for them.

A mask with no foreground or with more than 35% of the crop marked is
rejected as empty or likely background. This heuristic can reject a valid
very large crosshair; refusal is preferable to presenting a broad wall
color as a high-confidence aim marker. Background objects of the same
color remain a possible segmentation contaminant. The user sees the crop
and the measured fit so that contamination can be challenged.

Color distance and segmentation quality are nuisance parameters. They
must not be tuned on holdout captures to maximize a desired model's score.
Such tuning would leak the test data into the measurement procedure.

## 7.3 Old-image template search

For old-target estimation, the implementation searches a bounded static
colored-core template family:

\[
L\in\{0,\ldots,48\},\quad W\in\{1,\ldots,16\},\quad
 a\in\{0,\ldots,24\},\quad b=a+1,
\]

with dot and T flags. Pure-dot redundant gap/T combinations are removed.
Overlapping old arms and many unusual crosshairs are intentionally outside
this automatic template family. The manual old-cvar interface remains
available for them. The existence of a plausible template does not prove
that the image came from the corresponding build or cvars.

An integral image of the segmented mask accelerates rectangle intersection
estimates. For mask \(B\), define

\[
S(x,y)=\sum_{u<x}\sum_{v<y}B(u,v).
\]

Then an axis-aligned rectangle's foreground sum is obtained from four
lookups:

\[
\Sigma([x_0,x_1)\times[y_0,y_1))=
S(x_1,y_1)-S(x_0,y_1)-S(x_1,y_0)+S(x_0,y_0).
\]

Approximate template scores shortlist 48 candidates, after which exact
union-mask IoU is computed. The approximate stage can double-count
intersection where rectangles overlap; the exact stage removes that
artifact among shortlisted candidates. Consequently this is a bounded
shortlist method, **not a proof of a global mask optimum over arbitrary
crosshairs**. Its bounds, shortlist size and number of evaluated templates
are recorded. Returning the top alternatives exposes non-uniqueness.

The old image can be accepted only with mask/template agreement at least
0.75. That is an operational quality gate, not a calibrated 75% probability.
The extracted geometry and the original segmented mask both become a
frozen target for conversion. Candidate simulations compare against that
mask, not against a moving or progressively cleaned target secretly chosen
to favor the current candidate.

## 7.4 Recovering intervals, not invented exact cvars

Under ideal real arithmetic, \(s=H_o/480\). An observed arm length \(L\)
implies

\[
S\in[L/s,(L+1)/s).
\]

For width \(W>1\),

\[
T\in[W/s,(W+1)/s).
\]

For the one-pixel minimum,

\[
W=1\implies T\in[0,2/s)
\]

within the supported nonnegative old-thickness domain. Literal zero is
only one member of that interval. A screenshot cannot justify recovering
`T=0` rather than, for example, `T=0.5` at 1080p when both give one pixel.

Let \(p=a-\lfloor W/2\rfloor\). The gap buckets depend on truncation toward
zero:

\[
p>0:\;G\in[p-4,p-3),
\]
\[
p=0:\;G\in(-5,-3),
\]
\[
p<0:\;G\in(p-5,p-4].
\]

For \(p=0\), both `-4` and `-4.5` belong to the bucket. Replacing truncation
with floor would produce the wrong inverse interval. The actual baseline
uses binary32 intermediate rounding, so these ideal intervals need
endpoint analysis before asserting an exact boundary. The existing
chapter 01 explains that distinction. The UI supplies midpoint
representatives for convenient old-value editing and explicitly labels
them **non-unique representative values**, not recovered original cvars.

If the measured target is retained, the conversion uses its geometry and
mask directly; midpoint arithmetic is not allowed to overwrite the image
observation. Editing old shape fields intentionally clears the image target
and returns to cvar-driven reconstruction. The report records which target
kind was used.

## 7.5 Native-image measurement must not assume the answer

Using the old template fitter to generate new-native calibration labels
would introduce a circular bias: its `b=a+1` rule would already enforce a
hypothesis being tested. Therefore the native-image path instead uses
four-neighbor connected-component labeling of the segmented foreground.

Each component yields an axis-aligned bounding rectangle, area and fill
ratio. Candidate bar components must be at least 95% filled and must not
touch the crop edge. The extractor identifies separated left, right,
bottom, and optional top bars by their positions relative to the selected
center. A separate square component crossing the center is a possible dot.
Multiple competing components along an axis are refused.

The left inner edge is measured from its exclusive endpoint:

\[
a=-(x_{\max,left}+1),\quad b=x_{\min,right}.
\]

These are measured **independently**. Top/bottom measurements must agree
with their horizontal counterparts, and colored dimensions must agree
across the bars. No `b=a+1` correction is imposed. A model-violating
near/far pair remains model-violating evidence.

Merged bars, inconsistent lengths/widths, anisotropic stretching, ambiguous
backgrounds, insufficient components, and a reconstructed component mask
with less than 90% overlap are refused. A centered square-only component
is accepted as a pure dot, for which gap coordinates are explicitly
unidentified and excluded from the likelihood. The 90% acceptance threshold
is a measurement gate, not native-match confidence.

The extractor covers a limited axis-aligned static core. It does not
provide a general semantic screenshot-understanding system. The manual
measurement JSON route can represent additional inspected cases, but still
requires declared scope and native attestation. Unrepresentable center
conventions or unknown rendering transforms need explicit model expansion,
not silent repair of measured coordinates.

## 7.6 The visual refinement loop

For an imported code, entered cvars, or an accepted old image:

1. Freeze the target and record its origin.
2. Generate legal inverse proposals under every declared forward scenario.
3. Render the candidate colored-core masks and compare to the target.
4. Refine within a bounded local neighborhood when visual error remains.
5. Stop on exact simulated agreement, stagnation or budget exhaustion.
6. Rank distinct tuples across all scenarios and expose residuals.

Those steps occur in a browser module worker. They do **not** produce
independent new-renderer evidence, so posterior weights remain unchanged.
A result of `exact-under-selected-simulation` is intentionally different
from `native-validated`—the latter is not emitted by this release.

When a user uploads a real new-client result with declared cvars:

1. Measure foreground components independently of the renderer hypotheses.
2. Validate build, dimensions, native cvars, hash, role and group.
3. Add it to calibration or reserve it as a holdout, never both.
4. Recompute posterior weights only from native calibration groups.
5. Run the candidate inversion/refinement again against the **same old
   target**, preserving a trace of the conditional result.

This satisfies the request to restart analysis after a visual mismatch
without an infinite “try until success” loop. It also avoids a more subtle
failure: continually modifying the old target until it agrees with the
selected new model. When all models fit native data poorly, the report
asks for measurement inspection or family revision rather than hiding the
residual behind a normalized winning score.

## 7.7 Scope, provenance, and reproducibility

The report includes capture SHA-256, image dimensions, crop center,
selected color, tolerance, template/component agreement, extraction
method, cvars, declared game height, matching goal, model version and
native measurement groups. Image bytes are not bundled in reports by
default. A reviewer who needs pixel-level replication must receive the
original image separately and verify its hash.

Hash equality detects the same file, not equivalent re-encoded images.
Session grouping is therefore also required. Two screenshots with altered
metadata can have different hashes while being nearly identical; their
independence is a research-design responsibility. Likewise, one PNG can
be correctly hashed yet be a browser-generated preview falsely attested
as native. The system labels evidence user-attested and never claims
forensic authenticity.

Executable implementations: `lib/image/screenshot.js`,
`app/image/input.js`, `lib/solver/inference.js` and
`lib/solver/evidence.js`. Synthetic fixtures test extraction mechanics;
they are not added to the native evidence set.
