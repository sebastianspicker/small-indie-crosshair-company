# 09 — Joint inversion, exact shape loss, and evidence integrity

**Implementation:** `quant-static-v5`, release 0.3.0. **Native renderer evidence shipped:** zero capture pairs. This chapter updates the algorithmic details in chapters 05–07 without replacing their original derivations or promoting a hypothetical renderer into an observed game implementation. The corpus, historical binary32 arithmetic, 27-model family and target build remain unchanged.

The changes are mathematical as well as architectural: optimize dependent variables together; keep numerical certificates distinct from visual search; score the entire visible shape instead of whichever part fits on a preview; use one canonical observation per capture; and make uncertainty robust to a grossly inconsistent measurement. None of these improvements increases native sample size.

## 1. Separate the objects being estimated

An old configuration and its game height define an old-geometry reconstruction. A segmented original image instead supplies a measured binary target and an uncertain geometric summary. A renderer hypothesis maps a legal new tuple to a predicted geometry. A decision rule then selects a tuple using losses under those hypotheses. These are distinct operations.

Let the target be:

\[
y=(L_o,W_o,a_o,b_o).
\]

The entries are arm length, thickness, near inner edge and far inner edge in the declared comparison coordinates. Under the reconstructed old static painter, `b_o = a_o + 1` at the original height. A screen-relative target can multiply both edges by a non-unit scale. Independent native component measurements can also have another edge separation. The solver must not overwrite either case with its preferred centering convention.

For a new tuple, the declared legal integer domain is:

\[
\mathcal D=\{0,\ldots,255\}\times\{0,\ldots,31\}\times\{0,\ldots,128\}.
\]

These coordinates are new length, thickness and gap. The authored height is fixed during each solve. Literal old thickness zero restricts the thickness coordinate to zero for non-image inputs, preserving that semantic branch even when the requested screen-relative target conflicts with it. An inferred one-pixel image thickness is not evidence of a literal old zero, so image targets do not impose that restriction.

The historical renderer is still a source-based reconstruction; the 27 new renderers remain competing assumptions. Optimization answers what a declared model would require, not which model Valve uses.

## 2. Why thickness and gap must be solved jointly

The previous geometry initialization chose the nearest thickness, then solved a gap for that thickness. For a thickness-relative gap, changing the integer width changes the baseline. A locally nearest width can therefore make the overall geometry unnecessarily poor, especially when a negative old overlap cannot be represented by a nonnegative new gap.

The revised geometry objective is:

\[
J(L,T,G)=(\widehat L-L_o)^2+(\widehat W-W_o)^2+
\mathbf{1}_{L_o>0}\left[(\widehat a-a_o)^2+(\widehat b-b_o)^2\right].
\]

This objective uses squared pixel residuals with unit coefficients. Those coefficients are a design choice, not learned human-perception weights. The geometry inverse is an initialization for the later binary-shape objective; it is not a substitute for that objective.

Length is separable in the current model family. For a fixed renderer and authored/current height, evaluate all 256 legal length values and retain the one minimizing its squared length residual. Thickness is not separable from a thickness-relative gap. For each of the 32 legal thickness values, calculate the rendered width, then evaluate all 129 gap values against both edges. Select the width/gap branch with the smallest combined residual.

This is at most:

\[
256+32\cdot129=4384
\]

small scalar evaluations per renderer before reuse. Width values that quantize to the same rendered width share their gap search. The literal-zero branch needs only one thickness branch. There are no dense images or game executions in this enumeration.

The finite enumeration proves a **global minimum of the declared geometry objective on the declared integer domain**: every possible width/gap branch was evaluated, and length was minimized independently. The implementation compares computed losses strictly before using the ideal-value preference for exact ties; a small real loss difference must not be rounded into a tie. It does not prove global binary-mask optimality. In the report, `inverseCertificate.stage` is `initial-geometry-inverse`; the certificate contains the initialization tuple, prediction, objective minimum and branch counts. Subsequent visual refinement can change the tuple, so the certificate is never silently reattached to that final tuple as though it certified the new objective.

### Counterexample that motivated the joint solve

At height 2160, old size 2, thickness 0.5 and gap −7 reconstruct to length 9, width 2, near edge −2 and far edge −1. Under the authored-height/truncation/thickness-relative hypothesis at the same height, the old width-first initialization uses new width 2 and gap 0. Its predicted edges are 1 and 2. The edge contribution is 18.

The joint solve can use a one-pixel width and gap 0. The predicted edges become 0 and 1. The combined width/edge contribution is 9: one unit of squared width error plus two squared edge errors of four each. Several native thickness values can represent the one-pixel minimum; the deterministic tie-break selects the legal value nearest the continuous ideal. This is an improvement under the stated geometry objective, not an exact reconstruction of the overlap.

The case is a permanent regression test. Other seeded cases compare the inverse certificate to a separate exhaustive width/gap oracle. Passing those checks validates the solver against its equations, not the renderer against CS2.

## 3. Both inner edges determine the gap target

Every renderer currently considered by the automatic lab predicts a one-pixel far/near displacement. Given a predicted near edge `a`, its two-edge least-squares contribution can be rearranged:

\[
(a-a_o)^2+(a+1-b_o)^2
=2(a-\bar a)^2+\frac{(a_o+1-b_o)^2}{2},
\qquad \bar a=\frac{a_o+b_o-1}{2}.
\]

The second term does not depend on the chosen gap. The ideal near edge is therefore the midpoint `bar a`, not simply the observed near edge. When the target itself has unit displacement the two are equal; otherwise solving only the near side biases the result and leaves avoidable error on the far side.

For a fixed width branch, write the renderer as:

\[
\widehat a=B(W)+c\,Q(rG),
\qquad G^*=\frac{\bar a-B(W)}{cr}.
\]

For the thickness-relative family, the baseline is half the integer width rounded down and `c=1`. For the center-relative family, the baseline is zero and `c=1`. For the full-opening family, the baseline is −0.5 and `c=0.5`. The ideal real-valued gap is only a tie-break/reference value. All legal integers are compared using the actual quantized forward function.

A measured near/far pair `(1,6)` illustrates the distinction. For the center-relative model at unit scale, the ideal predicted near edge is 3 and the predicted far edge is 4. Matching near edge 1 exactly would unnecessarily increase total two-edge squared error. No gap can fix the target's five-pixel displacement while the model insists on one pixel; the residual must remain visible.

The retained manual lab now uses the analogous midpoint with its editable `farDelta`. Its measured affine calibration is valid only at its declared effective width and heights. The manual path remains width-first to preserve that calibration scope; only the automatic v5 path carries the joint finite-domain certificate.

## 4. Score full shapes, not a cropped display

The earlier visual score allocated a dense binary mask per prediction on a fixed preview-sized grid. This made cost depend on the preview area and made very large synthetic targets unscorable when the preview cropped them. A preview is a display choice, not part of the definition of the target.

The new implementation compiles the union of colored rectangles into disjoint vertical bands. Within each band, occupied vertical intervals are merged. Overlapping arms or a center dot contribute occupied cells only once. No summation of rectangle areas is substituted for the area of their union.

A half-open horizontal interval accepts integer pixel centers according to:

\[
x\leq i+\tfrac12<x+w
\quad\Longleftrightarrow\quad
\left\lceil x-\tfrac12\right\rceil\leq i<
\left\lceil x+w-\tfrac12\right\rceil.
\]

This is exactly the illustrative dense raster's pixel-center convention. Fractional edges and negative offsets therefore preserve their previous binary-cell meaning. The method is not subpixel anti-aliasing and is not an extracted game shader.

After decomposing both shapes into nonoverlapping bands, a two-pointer sweep computes their intersection. The scalar metric is:

\[
\operatorname{IoU}(A,B)=
\frac{|A\cap B|}{|A|+|B|-|A\cap B|}.
\]

At most five rectangles describe the ordinary static crosshair. Cost depends on their edges and interval intersections, not their distances from the origin or the canvas dimensions. The engine caches results by rendered geometry rather than by model ID: different scenarios that predict identical shapes share the expensive work.

The old and new methods are compared on 1,000 seeded pairs, including fractional widths/edges, overlapping bars, optional center dots and T shapes. Uncropped dense metrics and analytical metrics must agree exactly for cell counts and IoU. Arbitrary binary image masks are compiled column-by-column rather than forced through the rectangle generator; their occupied pixels are preserved losslessly.

### Empty and cropped targets

Two empty shapes have zero decision mismatch but undefined IoU. The interface says “Undefined,” and no exact-match probability mass is created from the absence of visible geometry.

A large synthetic shape can now have a complete analytical score while its preview is visibly cropped. The report discloses that display limitation. This is different from an original image crop that has already discarded source pixels. For a cropped measured target, or a candidate extending beyond its observed image frame, an exact whole-image match is disabled. The engine cannot recover missing evidence by increasing its own synthetic canvas.

## 5. Visual refinement and cross-scenario decisions

Each scenario starts from its certified geometry inverse. A maximum of two neighborhood passes examines legal tuples within one integer step of the current tuple. The target never changes. Each accepted step reduces binary mismatch or, at equal mismatch, reduces the geometry residual. This is a bounded local visual search, not a proof of the global visual optimum over all 1,056,768 tuples.

Initial proposals are deduplicated by native tuple only for evaluation cost. Their original model associations, initialization certificates and paths remain separate. Selecting a particular renderer retrieves that renderer's own proposal and trace; it must not retrieve the trace of another renderer that happened to propose identical numbers.

Automatic selection scores each tuple under all 27 scenarios. It offers two declared policies:

\[
R_{\pi}(v)=\sum_m\pi_m\ell_m(v),
\qquad R_{\max}(v)=\max_m\ell_m(v).
\]

The first minimizes expected mismatch under the explicit prior or conditional weights. The second minimizes the worst mismatch across the enumerated scenarios. Neither is equivalent to maximizing one selected preview's overlap. A sensible ensemble compromise may therefore retain a visible residual under the selected display hypothesis.

The best initial proposal receives up to two additional neighborhood passes against the aggregate decision objective. Each pass checks the 26 adjacent tuples. When that local search would stop, the solver also checks two length values at a distance of two. The extra length values can cross a one-cell quantization plateau: an adjacent length can score worse even when the next one scores better. The probe occurs once, after the ordinary local path has been evaluated. There are at most 27 initial tuples plus 26 checks in each pass plus two length probes, or 81 evaluated tuples before duplicate elimination. Both decision traces are monotone under their own objective. The report names this search policy and calls the result the best evaluated candidate, never a global visual optimum.

For example, the old settings `size=3`, literal-zero thickness and `gap=-1` at height 720 produce a best initial automatic tuple with length 4 under the equal prior. Its expected shape loss is about 0.40171. The two-cell length proposal 6 reduces that declared loss to about 0.39658 while preserving thickness zero. This is a synthetic historical-target comparison, not a native accuracy measurement. The case is a regression test; the wider search cannot increase the chosen decision loss because it retains the previous candidate as an option.

The display renderer is the explicitly selected model, or a maximum-weight model. Prior ties choose the documented authored/truncation/thickness-relative reference instead of cherry-picking whichever renderer makes the chosen tuple look best. This prevents optimistic preview selection from concealing scenario disagreement.

## 6. Robust likelihood is a sensitivity model, not calibration by assertion

A mislabeled capture, an incorrect authored height or an outline mistaken for a colored arm can produce a very large residual. A pure Gaussian likelihood can then give one point overwhelming relative influence. V5 uses a fixed contamination mixture with a narrow Gaussian component and a wider multivariate Student component.

Let the standardized residual vector have dimension `d`, and let its squared norm be:

\[
z_j=\frac{\widehat y_j-y_j}{\sigma},
\qquad q=\sum_{j=1}^{d}z_j^2.
\]

Dimensions are four for separated arms and two for a pure dot, whose unidentifiable gap must not provide evidence. Common observation-specific normalization factors cancel when comparing models for the same observation.

The relative density is:

\[
p(z\mid m)=0.95\,\phi_d(z)+0.05\,t_{4,d}(z;8).
\]

Here the Student component has four degrees of freedom and isotropic scale eight in standardized coordinates. Its density is:

\[
t_{\nu,d}(z;s)=
\frac{\Gamma((\nu+d)/2)}{\Gamma(\nu/2)(\nu\pi)^{d/2}s^d}
\left(1+\frac{q}{\nu s^2}\right)^{-(\nu+d)/2}.
\]

Mixture evaluation and posterior normalization use log-sum-exp. In the tail, the negative log density grows logarithmically in squared residual rather than linearly. This bounds the influence of increasing a gross residual relative to the Gaussian-only rule. It does not make fraudulent or systematically biased observations safe.

**The 5% contamination proportion, degrees of freedom, scale and diagonal feature-noise model are declared assumptions. They were not fitted to the old pro corpus.** Near and far measurements may have correlated errors; screenshot segmentation may be systematically biased. A reviewed native dataset would be needed to choose or calibrate a more realistic covariance/noise model. All-model conflict remains flagged even when normalized weights sum to one and necessarily have a largest member.

Within each connected capture/session group, log likelihoods are averaged before updating weights. Across groups, these pseudo-likelihood contributions are added. Holdout groups are excluded from updating; synthetic records and old configurations never update native weights. Native correctness probability remains null.

## 7. Canonical evidence and incompatible duplicate readings

SHA-256 strings are case-normalized before identity comparisons. Capture and session identifiers occupy different namespaces, so a session name cannot accidentally collide with a raw hash key. Only validated fields enter likelihoods and exports; unused nested metadata is discarded.

Grouping uses the transitive closure of “same capture hash” or “same session group” before duplicate removal. Renaming a duplicate capture cannot split connected evidence into artificial independent observations. The same capture/session cannot enter both calibration and holdout.

If one hash is submitted with conflicting native settings, measurement scope, active observed geometry or noise, the import is rejected. Averaging contradictory readings under one supposedly fixed observation would conceal the problem; counting them twice would inflate evidence. Resolve the actual measurement or its metadata first. A shared image hash still does not prove authenticity, and different hashes can arise from the same scene, so session grouping and provenance review remain essential.

The screenshot dialog captures center, seed and tolerance together with the completed analysis. Editing any crop/color/tolerance control invalidates the old fit immediately and disables acceptance. Acceptance cannot combine an old mask with new control metadata. Closing the dialog invalidates pending results and releases decoded image resources.

## 8. Operational boundaries preserve mathematical meaning

The worker runs at most one task at a time. At most one inference request waits behind active work: newer input replaces an older queued conversion. Image operations have a bounded queue. Request deadlines terminate the worker and reject pending tasks rather than merely losing track of a still-running calculation. Generation IDs separately prevent stale UI results from being applied.

This is not background research after a user closes the app. The worker is a local computation boundary. It receives parsed data, never user-written scripts. Both export paths share one allowlisted formatter and validate native numbers again; line breaks in comments cannot become executable console commands. No solver-generated confidence label bypasses unsupported-style or invalid-input export blocks.

## 9. What changed, and what did not

The numerical inverse is more rigorous on its declared domain. Shape scoring is exact for the documented binary-cell model and independent of synthetic preview cropping. The statistical update is more resistant to outliers and duplicate/provenance mistakes. The UI makes raw settings, direct assignment, proposed values, modeled residuals and uncertainty easier to inspect.

What did not change is the evidentiary boundary. Software tests establish implementation agreement with these definitions. Benchmarks measure this implementation on a particular machine. Neither is a CS2 capture. More precise mathematics can make uncertainty clearer; it cannot replace the missing native observations.

Relevant implementation modules are `lib/quant/inverse.js`, `visual.js`, `selection.js`, `evidence.js`, `observations.js`, `lib/pixel-shape.js` and the screenshot component extractor. Regression tests are in `tests/solver-v5.test.mjs` and `tests/worker-client.test.mjs`. The fixed source/data provenance remains in the [source ledger](../research/quant-sources.md) and [formula history](../research/formula-evolution.md).
