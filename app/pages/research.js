import { $,el,heading,docLink,table,fmt } from '../ui/dom.js';
import { legacyGeometry,idealBucket } from '../../lib/geometry/legacy.js';
export function initResearch() {
  const root=$('research');
  root.append(heading('How the conversion works',
    'The equations, tests and open questions behind each proposed setting, from the first shortcut to the current solver.',
    {sheet:'03',label:'Mathematics',fields:[['Build','2000918'],['Chapters','12'],['Cases','945'],['Capture pairs','0','tb-flag']]}));
  root.append(el('section',{class:'math-sheet'},el('h2',{},'The current default: a source-labelled reconstruction'),
    el('p',{},'The September 29 audit checked the newest tracked build 2000919; its crosshair metadata matches build 2000918. ' +
      'The default now uses round-to-even old dimensions and a centre-based new gap. ' +
      'It preserves the visible old minimum thickness with a positive new value. Odd-width centring can still shift pixels.'),
    el('pre',{class:'formula'},'old scale = f32(H / 480)\nold length = roundEven(f32(scale × f32(size)))\n' +
      'old width = max(1, roundEven(f32(scale × f32(thickness))))\nold offset = trunc(f32(f32(gap) + 4))\n\n' +
      'At equal heights, before native limits:\nnew length = old length\nnew thickness = old width\n' +
      'new gap = old offset + ceil(old width / 2)'),
    el('p',{},'The new reconstruction matches 12 diagnostic and 12 later comparison tuples from crosshair.club; ' +
      'the previous default matches none. These are external-software comparisons, not game captures. ' +
      'The direct solver uses exact monotone axis searches and preserves minimum dimension errors. ' +
      'It compares up to eight tied shapes: 750 of 8,640 synthetic cases improve versus v2, with zero regressions. ' +
      'Six UI choices replace the former 27 alternatives; the historical study remains below.'),
    docLink('research/converter-audit-2026-09-29.md','Read the latest dump audit, comparisons and limitations'),
    docLink('research/accuracy-improvements-2026-09-29.md','V3 conversion and learning accuracy, with evaluation limits'),
    docLink('math/12-community-conversion.md','12 · Current equations, rounding and pixel centres')));
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
  root.append(el('section',{class:'math-sheet'},el('h2',{},'The historical 27-model study'),
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

  const sheet=el('article',{class:'math-sheet'},el('h2',{},'The historical truncation model, in full view'),
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
    ['56-case comparisons','Recorded numerical comparison'],['New convar names and ranges','Pinned build inventory'],
    ['New native pixel snapping / parity / migration','Community evidence, not independently native-validated'],
    ['Current transverse centring','Source-labelled reconstruction; historical previews remain illustrative'],
    ['Custom outline equivalence / dynamic motion','Outside the implemented equivalence claim'],
  ]),el('p',{},'A low test error only validates the thing the test observes. A code regression test cannot validate a renderer that was never executed.')));
  root.append(el('section',{class:'math-sheet'},el('h2',{},'Improved learning, with a fair comparison'),
    el('p',{},'The new research-only emulator learns the current deterministic converter, not Valve’s renderer. ' +
      'Quantization-aware features raise exact tuple fidelity from 96.31% to 97.29% on the same reserved v3 test groups. ' +
      'Training, capacity selection, interval calibration and testing use separate setting groups.'),
    el('pre',{class:'formula'},'12800 synthetic development rows · 320 new setting groups\n' +
      '198 train / 34 validation / 29 calibration / 59 test groups\n' +
      'heights, goals and shape flags stay within their setting group\n' +
      'capacity chosen on validation only; final refit on train + validation\n' +
      'test: 2360 rows, but only 59 setting groups\nexact tuple: residual 96.31% → quantization-aware 97.29%\n' +
      'rendered exact masks: 96.57% → 97.37%\nspeed gate closed · nativeEvidence = false'),
    el('p',{},'On 80 additional groups at unseen resolutions, the new features improve interior fidelity ' +
      'from 52.97% to 73.91%, and exterior fidelity from 63.59% to 77.66%. Interior intervals accept only 8/80 complete ' +
      'groups; all exterior groups abstain. These are solver-imitation results, not in-game accuracy. ' +
      'The fixed experiment was rerun after a reviewed converter tie correction; no ML choices were tuned on test scores. ' +
      'The exact solver remains authoritative.'),
    docLink('research/accuracy-improvements-2026-09-29.md','Training protocol, correction history and selective coverage')));
  root.append(el('section',{class:'math-sheet'},el('h2',{},'Historical learning experiment (different target)'),
    el('p',{},'We trained a small dependency-free learned model to imitate the exact solver. Its labels are the solver’s own output, not game measurements. A capacity revision raised its held-out full-tuple fidelity from about 11.6% to about 35.7%, but it is still wrong on the full tuple about two times out of three, so it is not wired into the app. The exact solver stays authoritative.'),
    el('pre',{class:'formula'},'training: 5000 samples · 607 distinct legacy settings\nsplit: group-disjoint by setting signature → 3991 train / 1009 test\nmodel: depth-3 boosted trees · 120 rounds · 26 declared features\nexact full tuple: learned 0.35679 vs naive 0.03568 (earlier revision 0.11596)\nexact per dimension: length 0.563 · thickness 0.783 · gap 0.644\nMAE (px): length 0.561 · thickness 0.308 · gap 0.575 vs naive 2.610\nablation: the 7 extra declared-math features did NOT help; capacity did\nforward surrogate held-out MAE: 0.392 / 0.286 / 0.540 / 0.540 px\nfingerprint: 137061144 · speedGate = "closed-not-exact-equivalent" · nativeEvidence = false'),
    el('p',{},'Two things follow. First, a model trained on our equations can only measure fidelity to our equations; with zero old/new capture pairs it cannot show anything about Valve’s renderer. Second, speed is not enough. The learned shortlist plus exact verification is about 6.7× faster than the solver but still loses to it on 13 of 125 samples, and the learned fragility classifier is barely better than guessing (0.736 vs a 0.704 majority). None of it is wired into inference.'),
    docLink('math/10-learned-emulator.md','10 · The learned emulator, its metrics and the closed speed gate')));

  root.append(el('section',{class:'math-sheet'},el('h2',{},'Certifying the declared search, and a capture plan'),
    el('p',{},'This historical study predates the current default and the widened historical search. Re-solving 1064 corpus cases showed the certified best beat the then-shipped choice in 114 (about 10.7%), almost all under the worst-case rule. The opt-in certificate concerns that declared historical objective only. Its shell-monotone method rests on a documented, spot-checked monotonicity assumption, not a proof or a claim about Valve’s renderer.'),
    el('pre',{class:'formula'},'cases: 1064 = 133 eligible records × 4 heights × 2 rules\nshipped search not globally optimal: 114 (10.7%)\nmethods: loss-zero 16 · shell-monotone 1032 (conditional) · unproven 16\nrules: expected / worst / cvar (weighted CVaR, alpha = 0.5)\nrules disagree on the chosen native: 508 / 532 cases\nmodel partition: 27 / 27 distinct over a declared finite sample\ndiscriminating capture plan: 2 designs separate all 351 model pairs\nopt-in only: infer({ certify: true }) · default path unchanged'),
    el('p',{},'The two crosshairs in the capture plan are the most informative synthetic measurements we could design; they are a plan, not measurements, and they do not exist as native data.'),
    docLink('math/11-certified-inverse-and-capture-plan.md','11 · Certified inverse, decision rules and the capture plan')));
  root.append(el('div',{class:'reading-list'},el('h2',{},'The complete research notebook'),
    docLink('math/01-legacy-geometry.md','01 — Old geometry and binary32'),
    docLink('math/02-conversion-and-identifiability.md','02 — Conversion, inverse problems and zero thickness'),
    docLink('math/03-calibration-protocol.md','03 — Calibration, residuals and experimental design'),
    docLink('math/04-rendering.md','04 — Pixel placement, masks, stretching and limitations'),
    docLink('math/09-solver-and-integrity.md','09 — Joint inverse, exact shape loss and robust evidence integrity'),
    docLink('math/10-learned-emulator.md','10 — Learned emulator and the closed speed gate'),
    docLink('math/11-certified-inverse-and-capture-plan.md','11 — Certified inverse and capture plan'),
    docLink('math/12-community-conversion.md','12 — Current conversion, external comparison and centring'),
    docLink('research/formula-evolution.md','Formula evolution and correction log'),
    docLink('research/source-ledger.md','Pinned sources and claim-level evidence')));
}
