import { legacyGeometry } from './legacy.js';
import { finite, height as validHeight } from './validation.js';
import { validateNative, rgba, nativeCommands, safeComment } from './native-settings.js';
import { RASTER_CONVENTION, RAW_EDGE_CONVENTION } from './raster.js';
export { validateNative, rgba } from './native-settings.js';

/**
 * Manual lab. It is deliberately NOT unified with the automatic `quant-static-v5` family:
 * this model has a `measured` gap branch the quant family does not, and the quant family
 * has `ceil` and `opening` which this lab does not. Unifying them is a later patch with its
 * own model id. See docs/engineering/v0.4-conversion-improvement-plan.md §5.2.
 */
export const MODEL_VERSION = 'conditional-static-v4';
export const TARGET_BUILD = '2000914';
/** Build-specific: stationary static output still selects style 4 on build 2000914. */
export const STATIC_STYLE_ON_BUILD_2000914 = 4;
export const DEFAULT_MODEL = Object.freeze({
  gapBaseline: 'thickness', rounding: 'trunc', farDelta: 1, measuredBase: 0, measuredStep: 1,
});
export function validateModel(m) {
  if (!['thickness','center','measured'].includes(m.gapBaseline)) throw new Error('Unknown gap baseline.');
  if (!['trunc','nearest'].includes(m.rounding)) throw new Error('Unknown rounding rule.');
  finite(m.farDelta,'Far-side displacement',0,4);
  finite(m.measuredBase,'Measured gap intercept',-128,256);
  finite(m.measuredStep,'Measured gap slope',0.001,100);
}
export function quantize(v, mode) {
  // Positive dimensions only; explicit ties-up avoids language-dependent banker's rounding.
  return mode === 'nearest' ? Math.floor(v + 0.5) : Math.trunc(v);
}
export function predictedGeometry(n, currentHeight, model = DEFAULT_MODEL) {
  validateNative(n); validHeight(currentHeight); validateModel(model);
  const ratio = currentHeight / n.authoredHeight;
  const length = Math.max(0, quantize(n.length * ratio, model.rounding));
  const width = Math.max(1, quantize(n.thickness * ratio, model.rounding));
  const base = model.gapBaseline === 'thickness' ? Math.floor(width/2) : model.gapBaseline === 'center' ? 0 : model.measuredBase;
  // Measured intercept/slope are CURRENT-resolution pixels for this exact calibration scope.
  const step = model.gapBaseline === 'measured' ? model.measuredStep : ratio;
  const near = base + (model.gapBaseline === 'measured' ? n.gap * step : quantize(n.gap * step, model.rounding));
  return { model: MODEL_VERSION, rasterConvention: model.gapBaseline === 'measured' ? RAW_EDGE_CONVENTION : RASTER_CONVENTION, height: currentHeight, length, width, near,
    far: near + model.farDelta, interval: length > 0 ? 2 * near + model.farDelta : null,
    gapOffset: near-base, scale: ratio, minimumBranch: n.thickness===0 };
}

/** Search legal settings. Never disguise an out-of-range exact candidate as an exact match. */
function solve(target, raw, max, predict) {
  let best = null;
  for (let value = 0; value <= max; value++) {
    const pixels = predict(value), error = Math.abs(pixels-target);
    const preference = Math.abs(value-raw);
    if (!best || error < best.error || (error === best.error && preference < best.preference))
      best = { value, pixels, error, preference };
  }
  return { raw, value: best.value, predicted: best.pixels, error: best.error,
    inRange: raw >= 0 && raw <= max, exactWithinModel: best.error < 1e-9 };
}
function conversionScope(options) {
  const oldHeight = options.oldHeight ?? 1080;
  const currentHeight = options.currentHeight ?? oldHeight;
  const authoredHeight = options.authoredHeight ?? currentHeight;
  validHeight(oldHeight); validHeight(currentHeight); validHeight(authoredHeight);
  const goal = options.goal ?? 'pixels';
  if (!['pixels','screen'].includes(goal)) throw new Error('Unknown matching goal.');
  const model = { ...DEFAULT_MODEL, ...options.model }; validateModel(model);
  return {oldHeight,currentHeight,authoredHeight,goal,model};
}

function conversionMessages(settings, model, old, target, predicted, solutions) {
  const {length,thickness,gap}=solutions;
  const warnings = [], blockers = [];
  if (settings.style !== undefined && settings.style !== 4) blockers.push('Only Classic Static (style 4) is modeled. No dynamic or circle conversion is exported.');
  if (settings.weapon_gap) blockers.push('Weapon-dependent gap is outside the static reconstruction.');
  if (settings.thickness > 0 && thickness.value === 0) warnings.push('The nearest discrete width uses the zero-minimum branch; future-resolution behavior may differ from the positive legacy setting.');
  if (old.length === 0 && !settings.dot) warnings.push('No arms and no dot: this configuration has no visible colored geometry.');
  if (settings.recoil) warnings.push('Preview is the at-rest crosshair only. Follow-recoil behavior is not simulated.');
  if (settings.outline) warnings.push('Outline width has no verified native replacement; preview uses a one-pixel illustrative border.');
  if (settings.thickness === 0 && target.width !== 1) warnings.push('Preserving the zero-thickness minimum conflicts with the requested screen-relative thickness.');
  if (model.gapBaseline === 'measured') warnings.push('Measured gap parameters are valid only at the recorded build, heights and effective thickness. This UI does not independently verify them.');
  for (const [name, result] of Object.entries({length, thickness, ...(old.length > 0 ? {gap} : {})})) {
    if (!result.inRange) warnings.push(`${name}: ideal value ${result.raw.toFixed(4)} is outside the documented range; showing the nearest legal candidate, not an exact conversion.`);
    if (!result.exactWithinModel) warnings.push(`${name}: ${result.error.toFixed(4)} pixel residual under the selected model.`);
  }
  const farError = old.length > 0 ? predicted.far-target.far : 0;
  if (Math.abs(farError)>1e-9) warnings.push('Far-side alignment differs under the selected centering convention. A gap change alone may not fix both sides.');
  if (old.near < 0) warnings.push('Legacy arms cross the reference origin. Negative-gap overlap may be unrepresentable.');
  return {warnings,blockers,farError};
}

export function convert(settings, options = {}) {
  const {oldHeight,currentHeight,authoredHeight,goal,model}=conversionScope(options);
  const old = legacyGeometry(settings,oldHeight);
  const factor = goal === 'screen' ? currentHeight/oldHeight : 1;
  const target = { length:old.length*factor, width:old.width*factor, near:old.near*factor, far:old.far*factor };
  const ratio = currentHeight/authoredHeight;
  const length = solve(target.length, target.length/ratio,255,v => quantize(v*ratio,model.rounding));
  const thickness = settings.thickness === 0
    ? {raw:0,value:0,predicted:1,error:Math.abs(1-target.width),inRange:true,exactWithinModel:target.width===1}
    : solve(target.width,target.width/ratio,31,v=>Math.max(1,quantize(v*ratio,model.rounding)));
  const width = thickness.predicted;
  const base = model.gapBaseline === 'thickness' ? Math.floor(width/2) : model.gapBaseline === 'center' ? 0 : model.measuredBase;
  const step = model.gapBaseline === 'measured' ? model.measuredStep : ratio;
  const midpoint=(target.near+target.far-model.farDelta)/2;
  const gap=solve(midpoint,(midpoint-base)/step,128,v=>base+(model.gapBaseline==='measured'?v*step:quantize(v*step,model.rounding)));
  gap.error=Math.abs(gap.predicted-target.near);
  gap.exactWithinModel=gap.error<1e-9;

  const native = {length:length.value,thickness:thickness.value,gap:gap.value,authoredHeight};
  const predicted = predictedGeometry(native,currentHeight,model);
  const {warnings,blockers,farError}=conversionMessages(settings,model,old,target,predicted,{length,thickness,gap});
  const geometryExact = length.exactWithinModel && thickness.exactWithinModel &&
    (old.length===0 || (gap.exactWithinModel && Math.abs(farError)<1e-9));
  return {version:MODEL_VERSION,status:'conditional-not-game-validated',targetBuild:TARGET_BUILD,
    options:{oldHeight,currentHeight,authoredHeight,goal,model},old,target,native,predicted,
    solutions:{length,thickness,gap},farError,geometryExact,warnings,blockers};
}

export function exportCFG(result,settings,nativeOverride=null) {
  if (result.blockers.length) throw new Error(result.blockers.join(' '));
  const n=nativeOverride??result.native, o=conversionScope(result.options);
  return [
    '// Small Indie Crosshair Company — candidate settings, not an exact-match certificate.',
    `// Target build ${TARGET_BUILD}; model ${MODEL_VERSION}.`,
    `// Illustration ${o.model.gapBaseline === 'measured' ? RAW_EDGE_CONVENTION : RASTER_CONVENTION}.`,
    `// Baseline ${o.model.gapBaseline}; rounding ${o.model.rounding}; goal ${o.goal}.`,
    `// Old height ${o.oldHeight}; intended current height ${o.currentHeight}.`,
    ...(nativeOverride?['// Manual candidate edits: automatic conversion residuals do not apply.']:[]),
    ...result.warnings.map(w=>'// WARNING: '+safeComment(w)),
    ...nativeCommands(settings,n),'',
  ].join('\n');
}
