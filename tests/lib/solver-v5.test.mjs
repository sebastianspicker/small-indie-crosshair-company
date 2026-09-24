import test from 'node:test';
import assert from 'node:assert/strict';
import { compileShape, compileMask, compareShapes, validateMask } from '../../lib/geometry/pixel-shape.js';
import { raster, compareMasks } from '../../lib/geometry/raster.js';
import { infer } from '../../lib/solver/inference.js';
import { exportQuantCFG } from '../../lib/solver/export.js';
import { DEFAULT_SETTINGS } from '../../lib/settings/cfg.js';
import { MODELS, forward, getModel, geometryError, scope } from '../../lib/solver/renderer.js';
import { solveInverse, solveTarget } from '../../lib/solver/inverse.js';
import { posterior, robustLogLikelihood } from '../../lib/solver/evidence.js';
import { validateMeasurements } from '../../lib/solver/observations.js';
import { visualContext } from '../../lib/solver/visual.js';
import { rankCandidates } from '../../lib/solver/selection.js';
const settings = { ...DEFAULT_SETTINGS, size: 2, thickness: .5, gap: -3, style: 4, weapon_gap: false, outline: false };
const close = (a, b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
let seed = 1709;
const random = () => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed/4294967296; };
const shape = () => ({ length: Math.floor(random()*40)/2, width: 1+Math.floor(random()*20)/2, near: Math.floor(random()*30)/2-5, far: Math.floor(random()*30)/2-5 });
const observation = (extra = {}) => {
 const native = { length: 5, thickness: 3, gap: 1, authoredHeight: 960 };
 return { id:'test', captureGroup:'unit-only', captureSha256:'a'.repeat(64), kind:'native-user', attested:true,
  role:'calibration', build:'2000914', currentHeight:1440, native, sigma:.5,
  observed:forward(native,1440,getModel('authored:trunc:thickness')), ...extra };
};

test('exact cell-union overlap equals dense pixel-center raster on 1000 seeded pairs', () => {
 for(let i=0;i<1000;i++) {
  const a=shape(),b=shape(),flags={dot:random()>.5,t_style:random()>.5};
  const ar=raster(a,flags,129),br=raster(b,flags,129),expected=compareMasks(ar,br);
  const actual=compareShapes(compileShape(a,flags),compileShape(b,flags));
  for(const k of ['union','intersection','different','iou']) assert.equal(actual[k],expected[k]);
  assert.deepEqual(compareShapes(compileMask(ar),compileMask(br)),actual);
 }
});
test('mask compiler preserves arbitrary image pixels without fitting a historical template',()=>{
 const mask={side:129,data:new Uint8Array(129*129)};
 for(let i=0;i<500;i++) mask.data[Math.floor(random()*mask.data.length)]=1;
 const compiled=compileMask(mask); assert.equal(compiled.area,mask.data.reduce((a,b)=>a+b,0));
 assert.equal(compareShapes(compiled,compiled).iou,1);
});
test('binary mask boundary rejects malformed, oversize, fractional and non-binary inputs',()=>{
 for(const mask of [null,{side:128,data:new Uint8Array(128*128)},{side:259,data:new Uint8Array(259*259)},
  {side:129,data:[]},{side:129,data:new Uint8Array(129*129).fill(2)}]) assert.throws(()=>validateMask(mask));
});
test('empty geometry has undefined IoU, zero decision loss and no exact-match evidence',()=>{
 const s={...settings,size:0,dot:false},r=infer({settings:s});
 assert.equal(r.convertedFit.iou,null); assert.equal(r.chosen.exactMass,0); assert.equal(r.chosen.expectedLoss,0);
 assert.equal(r.search.status,'empty-shape');
});
test('cropped measured masks still prohibit an exact claim',()=>{
 const target={length:4,width:2,near:1,far:2},mask=raster(target,{},129);mask.cropped=true;
 const r=infer({settings,targetOverride:target,targetMask:mask});
 assert.equal(r.convertedFit.iou,null);assert.equal(r.chosen.exactMass,0);
});
test('joint thickness/gap inverse improves a previously separable overlap counterexample',()=>{
 const r=solveInverse({...settings,gap:-7},{oldHeight:2160},getModel('authored:trunc:thickness'));
 assert.equal(r.inverseCertificate.globalGeometryMinimum,9);
 assert.ok(r.inverseCertificate.globalGeometryMinimum<18);
 assert.equal(r.predicted.width,1);
});
test('finite inverse equals an exhaustive thickness/gap oracle in 30 seeded scopes',()=>{
 for(let i=0;i<30;i++) {
  const s={...settings,size:random()*5,thickness:.1+random()*2,gap:-8+random()*10};
  const options={oldHeight:[768,960,1080,1440][i%4],currentHeight:[720,1080,1440][i%3],authoredHeight:[720,1080][i%2],goal:i%2?'screen':'pixels'};
  const model=MODELS[i%27],r=solveInverse(s,options,model);let best=Infinity;
  for(let t=0;t<=31;t++)for(let g=0;g<=128;g++){
   const n={...r.native,thickness:t,gap:g}; best=Math.min(best,geometryError(forward(n,options.currentHeight,model),r.target));
  }
  close(best,r.inverseCertificate.globalGeometryMinimum);close(best,geometryError(r.predicted,r.target));
 }
});
test('near and far edge residuals determine a midpoint, not just the near edge',()=>{
 const target={length:4,width:2,near:1,far:6},model=getModel('authored:trunc:center');
 const r=solveTarget(settings,scope(),model,target,target,true);
 assert.equal(r.native.gap,3);assert.equal(r.predicted.near,3);assert.equal(r.predicted.far,4);
});
test('finite inverse prefers a tiny real loss improvement over the ideal-value tie break',()=>{
 const model=getModel('authored:trunc:center');
 const target={length:2+1e-13,width:1,near:0,far:1};
 const r=solveTarget(settings,{oldHeight:1080,currentHeight:1080,authoredHeight:720,goal:'pixels'},model,target,target,true);
 assert.equal(r.native.length,2);
 assert.ok((r.predicted.length-target.length)**2<(1-target.length)**2);
 close(r.inverseCertificate.globalGeometryMinimum,geometryError(r.predicted,target));
});
test('forward renderer rejects unknown IDs and ignores spoofed fields on a valid ID',()=>{
 const native={length:5,thickness:2,gap:2,authoredHeight:960},m=getModel('authored:trunc:thickness');
 assert.deepEqual(forward(native,1440,{...m,scale:'reference720',gap:'opening'}),forward(native,1440,m));
 assert.throws(()=>forward(native,1440,{id:'__proto__'}));
});
test('selected renderer retains its own inverse trace after native-value deduplication',()=>{
 for(const m of MODELS){const r=infer({settings,selectedModelId:m.id});
  const own=r.models.find(x=>x.id===m.id);assert.equal(r.chosen.traceModelId,m.id);
  assert.deepEqual(r.chosen.trace,own.refinement);assert.deepEqual(r.chosen.native,own.native);
  assert.equal(r.chosen.inverseCertificate.stage,'initial-geometry-inverse');
 }
});
test('aggregate visual refinement is bounded and monotone for both decision policies',()=>{
 for(const decision of ['expected','worst'])for(const gap of [-7,-4,-1,3]){
  const r=infer({settings:{...settings,gap},options:{oldHeight:1440},decision});
  const key=decision==='worst'?'worstCaseLoss':'expectedLoss',trace=r.decision.trace;
  assert.ok(trace.length<=3);assert.ok(r.candidates.length<=81);
  for(let i=1;i<trace.length;i++)assert.ok(trace[i][key]<=trace[i-1][key]+1e-12);
  assert.equal(r.confidence.nativeMatchProbability,null);assert.equal(r.search.uniqueRasterEvaluations,0);
 }
});
test('aggregate search crosses a one-cell length plateau when it lowers expected loss',()=>{
 const s={...settings,size:3,thickness:0,gap:-1},r=infer({settings:s,options:{oldHeight:720}});
 assert.equal(r.decision.trace[0].native.length,4);
 assert.equal(r.chosen.native.length,6);
 assert.ok(r.chosen.expectedLoss<r.decision.trace[0].expectedLoss);
 assert.equal(r.chosen.native.thickness,0);
 assert.equal(r.decision.searchPolicy,'bounded-neighborhood-plus-length-two-v1');
 assert.equal(r.confidence.nativeMatchProbability,null);
});
test('both two-cell probes use the same length origin',()=>{
 const native={length:5,thickness:0,gap:0,authoredHeight:720};
 const losses=new Map([[3,.6],[4,.9],[5,.7],[6,.9],[7,.1]]);
 const visual={score:geometry=>{
  const loss=losses.get(geometry.length)??1;
  return {loss,iou:1-loss,cropped:false,geometryLoss:loss};
 }};
 const state={weights:MODELS.map((_,i)=>Number(i===0))};
 const ranked=rankCandidates([{id:MODELS[0].id,native,preserveZero:true}],state,720,visual);
 assert.equal(ranked.decisionTrace[0].native.length,5);
 assert.equal(ranked.candidates[0].native.length,7);
 assert.equal(ranked.candidates[0].expectedLoss,.1);
});
test('visual cache keys geometry rather than scenario labels',()=>{
 const target={length:4,width:2,near:1,far:2},v=visualContext(target,{});
 v.score({...target,model:'a'});v.score({...target,model:'b'});assert.equal(v.size(),1);
});
test('capture hashes are case-normalized before grouping and leakage detection',()=>{
 const a=observation(),b={...a,id:'repeat',captureGroup:'renamed',captureSha256:a.captureSha256.toUpperCase()};
 assert.deepEqual(posterior([a,b]).weights,posterior([a]).weights);
 assert.throws(()=>posterior([a,{...b,role:'holdout'}]),/leakage/);
});
test('conflicting readings of one capture cannot manufacture independent calibration evidence',()=>{
 const a=observation(),b={...a,id:'other',observed:{...a.observed,length:19}};
 assert.throws(()=>posterior([a,b]),/Conflicting/);
});
test('evidence canonicalization drops unused objects and rejects empty session groups',()=>{
 const record=validateMeasurements([observation({unused:{malicious:'not exported'}})])[0];
 assert.equal(record.unused,undefined);assert.throws(()=>validateMeasurements([observation({captureGroup:'  '})]));
});
test('robust mixture is finite, monotone and less sensitive to extreme residual growth',()=>{
 for(const dimensions of [2,4]){
  assert.ok(robustLogLikelihood(0,dimensions)>robustLogLikelihood(25,dimensions));
  assert.ok(Number.isFinite(robustLogLikelihood(1e100,dimensions)));
  assert.ok(Math.abs(robustLogLikelihood(1e6,dimensions)-robustLogLikelihood(2e6,dimensions))<5);
 }
 for(const args of [[-1,2],[Infinity,2],[0,3],[NaN,4]])assert.throws(()=>robustLogLikelihood(...args));
});
test('outlier evidence never turns normalized relative weights into native correctness',()=>{
 const p=posterior([observation({observed:{length:8000,width:40,near:400,far:401}})]);
 assert.ok(p.weights.every(Number.isFinite));close(p.weights.reduce((a,b)=>a+b,0),1);
 assert.equal(p.allModelConflict,true);assert.equal(p.nativeMatchProbability,null);
});
test('export sanitizes comments and validates all command values',()=>{
 const report=infer({settings});report.warnings=[{code:'injected',text:'first\nquit\r\nexec evil.cfg\u2028bind f quit'}];
 const cfg=exportQuantCFG(report);assert.ok(!cfg.split('\n').some(x=>/^(quit|exec|bind)\b/.test(x)));
 assert.throws(()=>exportQuantCFG({...report,chosen:{...report.chosen,native:{...report.chosen.native,length:'1;quit'}}}));
});
test('native pure-dot path rejects an unexplained noisy mask, just like the bar path',async()=>{
 const {measureNativeMask}=await import('../../lib/image/screenshot.js');
 const mask=raster({length:0,width:4,near:0,far:0},{dot:true},129);
 for(let y=10;y<15;y++)for(let x=10;x<15;x++)mask.data[y*129+x]=1;
 assert.throws(()=>measureNativeMask(mask),/90%/);
});
test('default automatic tuple is locked and every report warns that gap scaling is unresolved',()=>{
 const settings={...DEFAULT_SETTINGS,size:2,thickness:0,gap:-4,style:4,weapon_gap:false,outline:false};
 const report=infer({settings,options:{oldHeight:1080,currentHeight:1080,goal:'pixels'}});
 assert.deepEqual(report.chosen.native,{length:4,thickness:0,gap:0,authoredHeight:1080});
 assert.ok(report.warnings.some(w=>/Gap scaling is not stated in the build 2000914/.test(w.text)));
 assert.ok(report.warnings.some(w=>w.code==='gap-scale-unresolved'));
});
