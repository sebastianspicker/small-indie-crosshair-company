import { $,el,heading,docLink,table,fmt } from './dom.js';
import { legacyGeometry,idealBucket } from '../lib/legacy.js';
export function initResearch() {
  const root=$('research');
  root.append(heading('How the conversion works','The equations, tests, and open questions behind each proposed setting.'));
  const entries=[
    ['v0 · the shortcut','Multiply everything by two.','It fails against the reconstructed old geometry in 32 of 56 numerical cases. Matching a few resolutions does not make it a general rule.'],
    ['v1 · reconstruct pixels','Scale by H / 480, then truncate.','Retained for old static geometry. Gap stays in raw pixels; rounding and truncation are not interchangeable.'],
    ['v2 · keep zero, solve the gap','Preserve the minimum-width branch. Include half-width and both edges.','Legacy thickness zero stays a distinct case. Gap mapping is conditional on the new renderer’s baseline and slope.'],
    ['v3 · show the remaining error','Search legal integer settings and report residuals.','The calculator shows what each model predicts and where its result differs from the target. It does not add an in-game observation.'],
    ['v4 · test more inputs','138 records; 27 new rendering models; one fixed pixel target.','The player records exercise the old reconstruction. Only original game measurements can change the weights assigned to new rendering models.'],
    ['v5 · search both dimensions together','Solve thickness and gap as a pair.','Both inner edges help define the target. The search compares complete shapes and keeps a record of how each candidate was chosen.'],
  ];
  const timeline=el('div',{class:'timeline'});
  entries.forEach(([version,title,body])=>timeline.append(el('article',{},el('span',{class:'version'},version),el('div',{},el('h2',{},title),el('p',{},body)))));
  root.append(timeline);
  root.append(el('section',{class:'math-sheet'},el('h2',{},'The numbers behind the study'),
    el('p',{},'We ran 945 numerical cases from 48 distinct eligible shapes and compared 27 possible new renderers. This release includes zero original old/new capture pairs. The numerical cases test the reconstruction; they cannot identify the game’s new renderer.'),
    el('pre',{class:'formula'},'Lₙ* ∈ { L* A/H, 1080 L*/H, 720 L*/H }\nTₙ* ∈ { W* A/H, 1080 W*/H, 720 W*/H }; preserve known zero\nā = (a* + b* − 1) / 2\nGₙ* ∈ { (ā − floor(Wₙ/2))/r, ā/r, (2ā + 1)/r }\n\np(z | m) = 0.95 Gaussian_d(z) + 0.05 Student_t(ν=4, scale=8)\nwₘ ∝ πₘ exp(Σ_group mean_i log p(zᵢ | m))\nCandidate = argmin_v Σₘ wₘ × visual_loss(rendererₘ(v), frozen_target)'),
    el('p',{},'These are conditional formula families, not a recovered Valve implementation. The interval reported for resampled old geometry groups is not a chance of native conversion success.'),
    el('div',{class:'reading-list'},...[
      ['math/09-solver-and-integrity.md','09 · Joint inverse, exact shape loss and robust evidence integrity'],
      ['math/05-model-families.md','05 · 27 model scenarios and at least three inverses per dimension'],
      ['math/06-statistical-inference.md','06 · Likelihood, priors, confidence, holdouts and active experiments'],
      ['math/07-image-inverse-and-feedback.md','07 · Old screenshot inversion and independent native pixel measurement'],
      ['math/08-expanded-corpus-study.md','08 · Corpus, grouped cross-validation, bootstrap and actual results'],
      ['research/quant-sources.md','Expanded source and uncertainty ledger']
    ].map(([path,label])=>docLink(path,label)))));

  const sheet=el('article',{class:'math-sheet'},el('h2',{},'The current model, in full view'),
    el('p',{},'H is the original in-game height. S, T and G are old size, thickness and gap. f32 rounds each marked intermediate to binary32. These equations reconstruct a community-documented static painter; they are not a recovered Valve shader.'),
    el('pre',{class:'formula'},'s  = f32(H / 480)\nLₒ = trunc(f32(s × f32(S)))\nWₒ = max(1, trunc(f32(s × f32(T))))\npₒ = trunc(f32(f32(G) + f32(4)))\naₒ = floor(Wₒ / 2) + pₒ\nbₒ = aₒ + 1'),
    el('p',{},'The full center interval is 2aₒ + 1 only when opposing arms exist. A dot, an outline or overlapping bars makes “empty gap” a misleading name.'),
    el('h3',{},'The generalized inverse'),
    el('pre',{class:'formula'},'new near edge = B + K × new gap\ntarget near compromise = (target near + target far − farDelta) / 2\nnew gap ideal = (target near compromise − B) / K\n\nAt authored height = target height:\nnew length candidate ≈ Lₒ\nnew thickness candidate ≈ (T = 0 ? 0 : Wₒ)'),
    el('p',{},'The renderer simulation additionally applies the selected quantizer. The inverse is then only an ideal candidate; the solver evaluates every legal integer and reports error. B and K do not become verified merely because a synthetic preview matches.'),
    docLink('math/02-conversion-and-identifiability.md','Read the derivation, legal search and matching objectives'));
  root.append(sheet);
  const bucket=el('article',{class:'math-sheet'},el('h2',{},'A small preset can hide a wrong formula'),
    el('p',{},'Explore a rendered-length bucket at 1080p. Many different decimal sizes collapse to the same whole-pixel result.'),
    el('label',{for:'bucket-size'},'Legacy size for the bucket experiment'),el('input',{id:'bucket-size',type:'number',value:'2',min:0,max:20,step:.1}),el('p',{id:'bucket-result',class:'large-result'}));
  root.append(bucket);
  function update(){const s=Number($('bucket-size').value);if(!Number.isFinite(s)||s<0||s>20)return;
    const g=legacyGeometry({size:s,thickness:1,gap:-3},1080),b=idealBucket(g.length,1080);
    $('bucket-result').textContent=`Size ${s} → ${g.length}px. Ideal real-number bucket: [${fmt(b.lowerInclusive)}, ${fmt(b.upperExclusive)}). Binary32 shifts boundary details.`;
  }$('bucket-size').addEventListener('input',update);update();
  root.append(el('article',{class:'math-sheet'},el('h2',{},'Precision is not certainty'),table(['Question','Status'],[
    ['Old static length / thickness / gap equations','Source-derived community reconstruction'],
    ['56-case comparisons','Reproducible numerical tests'],['New convar names and ranges','Pinned build inventory'],
    ['New native pixel snapping / parity / migration','Unverified'],['Transverse centering in this preview','Illustrative convention'],
    ['Custom outline equivalence / dynamic motion','Outside the implemented equivalence claim'],
  ]),el('p',{},'A low test error only validates the thing the test observes. A code regression test cannot validate a renderer that was never executed.')));
  root.append(el('section',{class:'math-sheet'},el('h2',{},'What machine learning can and cannot do here'),
    el('p',{},'We trained a small dependency-free learned model to imitate the exact solver. Its labels are the solver’s own output, not game measurements. It is fast, but on held-out settings it reproduces the exact solver’s full tuple only about 11.6% of the time, so it is not wired into the app. The exact solver stays authoritative.'),
    el('pre',{class:'formula'},'training: 5000 samples · 607 distinct legacy settings\nsplit: group-disjoint by setting signature → 3991 train / 1009 test\nexact full tuple: learned 0.11596 vs naive 0.03568\nexact per dimension: length 0.334 · thickness 0.589 · gap 0.403\nMAE (px): length 1.269 · thickness 0.667 · gap 1.062 vs naive 2.610\nforward surrogate held-out MAE: 0.392 / 0.286 / 0.540 / 0.540 px\nspeed: ~0.4 µs learned vs ~1.1 ms exact p50 (~2500×, npm run bench:emulator)\nprovenance.speedGate = "closed-not-exact-equivalent" · nativeEvidence = false'),
    el('p',{},'Two things follow. First, a model trained on our equations can only measure fidelity to our equations; with zero old/new capture pairs it cannot show anything about Valve’s renderer. Second, speed is not enough. A result that is wrong on the full tuple most of the time is not a safe substitute for the exact inverse, so the learned pass and the forward surrogate are both left out of inference.'),
    docLink('math/10-learned-emulator.md','10 · The learned emulator, its metrics and the closed speed gate')));
  root.append(el('div',{class:'reading-list'},el('h2',{},'The complete research notebook'),
    docLink('math/01-legacy-geometry.md','01 — Old geometry and binary32'),
    docLink('math/02-conversion-and-identifiability.md','02 — Conversion, inverse problems and zero thickness'),
    docLink('math/03-calibration-protocol.md','03 — Calibration, residuals and experimental design'),
    docLink('math/04-rendering.md','04 — Pixel placement, masks, stretching and limitations'),
    docLink('research/formula-evolution.md','Formula evolution and correction log'),
    docLink('research/source-ledger.md','Pinned sources and claim-level evidence')));
}
