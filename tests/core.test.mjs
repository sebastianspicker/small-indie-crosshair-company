import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { legacyGeometry as geom } from '../lib/legacy.js';
import { decodeLegacy,encodeLegacy } from '../lib/sharecode.js';
import { convert,predictedGeometry,exportCFG,rgba } from '../lib/conversion.js';
import { nativeCommands } from '../lib/native-settings.js';
import { runAudit } from '../lib/audit.js';
import { fitAffine,inverseAffine,validateMeasurement } from '../lib/calibration.js';
import { raster,compareMasks,rectangles } from '../lib/raster.js';
import { parseLegacyCFG,DEFAULT_SETTINGS } from '../lib/cfg.js';
const presets=JSON.parse(await readFile(new URL('../data/presets.json',import.meta.url)));
const archived=JSON.parse(await readFile(new URL('../research/archive/2026-09-23/results.json',import.meta.url)));
const cfg={...DEFAULT_SETTINGS,rgb:[...DEFAULT_SETTINGS.rgb]};
for(const p of presets){test(`legacy v1 checksum and exact re-encode: ${p.player}`,()=>{
  const d=decodeLegacy(p.code);assert.equal(encodeLegacy(d),p.code);
  for(const key of ['size','thickness','gap','style','dot','outline','weapon_gap'])assert.equal(d[key],p[key]);
});}
for(const row of archived.cases){test(`Python reference geometry: ${row.player} @ ${row.height}`,()=>{
  const g=geom({size:row.input_size,thickness:row.input_thickness,gap:row.input_gap},row.height);
  for(const [k,ref]of Object.entries({length:'arm_length_px',width:'thickness_px',gapOffset:'gap_offset_px',near:'near_inner_offset_px',far:'far_inner_offset_px',interval:'opposing_arm_interval_px'}))assert.equal(g[k],row[ref]);
});}
test('audit reproduces all comparison counts',()=>assert.deepEqual(runAudit(presets).counts,archived.comparison_counts));
test('960p and 1080p conceal the wrong multiplier for all eight fixtures',()=>{
  for(const p of presets){const a=geom(p,960),b=geom(p,1080);assert.deepEqual([a.length,a.width],[b.length,b.width]);}
  assert.equal(geom({...cfg,size:4},1080).length,9);
});
test('truncation toward zero for negative fractional gap',()=>{
  assert.equal(geom({...cfg,gap:-4.5},1080).gapOffset,0);assert.equal(geom({...cfg,gap:-5.1},1080).gapOffset,-1);
});
test('float32 value at 1.6 × 5 boundary is quantized explicitly',()=>assert.equal(geom({...cfg,size:5},768).length,8));
for(const input of [NaN,Infinity,-Infinity,'2',null])test(`reject non-finite/coerced geometry: ${String(input)}`,()=>assert.throws(()=>geom({...cfg,size:input},1080)));
test('reject out-of-scope heights and magnitudes',()=>{assert.throws(()=>geom(cfg,239));assert.throws(()=>geom(cfg,1080.5));assert.throws(()=>geom({...cfg,thickness:-1},1080));});
for(const code of ['wrong','CSGO-OOOOO-OOOOO-OOOOO-OOOOO-OOOOO','CSGO-aNQn2-upV5w-M8dOd-OOwcf-2pFKA'])test(`invalid code rejected: ${code}`,()=>assert.throws(()=>decodeLegacy(code)));
test('unknown sharecode versions rejected even with correct checksum',()=>{
  const d=decodeLegacy(presets[0].code)._bytes;d[1]=2;d[0]=d.slice(1).reduce((s,b)=>s+b,0)%256;
  const alphabet='ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789';let n=d.reduce((s,b)=>(s<<8n)|BigInt(b),0n),s='';for(let i=0;i<25;i++){s+=alphabet[Number(n%BigInt(alphabet.length))];n/=BigInt(alphabet.length);}const code='CSGO-'+s.match(/.{5}/g).join('-');assert.throws(()=>decodeLegacy(code),/Version 2/);
});
test('unrepresentable legacy decimal does not silently encode',()=>assert.throws(()=>encodeLegacy({...cfg,size:1.55})));
test('zero thickness branch preserved at reference height',()=>{const r=convert({...cfg,thickness:0});assert.equal(r.native.thickness,0);assert.equal(r.predicted.width,1);});
test('zero thickness conflicts with screen-relative scaling explicitly',()=>{const r=convert({...cfg,thickness:0},{oldHeight:1080,currentHeight:2160,goal:'screen'});assert.equal(r.native.thickness,0);assert.equal(r.solutions.thickness.error,1);assert.ok(r.warnings.some(w=>w.includes('conflicts')));});
test('positive thickness can scale while zero stays minimum',()=>{const z=predictedGeometry({length:4,thickness:0,gap:1,authoredHeight:1080},2160);const p=predictedGeometry({length:4,thickness:1,gap:1,authoredHeight:1080},2160);assert.equal(z.width,1);assert.equal(p.width,2);});
test('gap hypotheses differ for a two-pixel bar',()=>{const a=convert(cfg);const b=convert(cfg,{model:{gapBaseline:'center'}});assert.equal(a.native.gap,0);assert.equal(b.native.gap,1);assert.equal(a.predicted.near,b.predicted.near);});
test('out-of-range negative gap remains visible as a limitation',()=>{const r=convert({...cfg,gap:-10});assert.equal(r.solutions.gap.inRange,false);assert.ok(r.warnings.some(w=>w.includes('outside')));assert.equal(r.geometryExact,false);});
test('large length receives a warning, never an exact conversion claim',()=>{const r=convert({...cfg,size:1000});assert.equal(r.native.length,255);assert.equal(r.solutions.length.inRange,false);assert.equal(r.geometryExact,false);});
test('dot only does not claim an empty central gap',()=>{const r=convert({...cfg,size:0,dot:true});assert.equal(r.old.interval,null);assert.equal(rectangles(r.old,{dot:true}).length,1);});
test('side matching is not guaranteed by matching near only',()=>{const r=convert(cfg,{model:{farDelta:0}});assert.equal(r.farError,-1);assert.equal(r.geometryExact,false);});
test('new nearest model and trunc model differ at scaled boundary',()=>{const n={length:3,thickness:1,gap:1,authoredHeight:1080};assert.equal(predictedGeometry(n,960).length,2);assert.equal(predictedGeometry(n,960,{gapBaseline:'thickness',rounding:'nearest',farDelta:1,measuredBase:0,measuredStep:1}).length,3);});
test('actual style and weapon-gap behavior are explicit blockers',()=>{
  for(const unsupported of [{style:2},{style:3},{style:5},{weapon_gap:true}]){const s={...cfg,...unsupported},r=convert(s);assert.ok(r.blockers.length);assert.throws(()=>exportCFG(r,s));}
});
test('export uses new variable names, alpha and last authored height',()=>{const r=convert(cfg),out=exportCFG(r,cfg);assert.match(out,/cl_crosshair_length 2/);assert.doesNotMatch(out,/\ncl_crosshairsize /);assert.ok(out.trim().endsWith('cl_crosshair_screen_height 1080'));assert.match(out,/not an exact-match certificate/);});
test('export rejects native invalid integers instead of injecting',()=>{assert.throws(()=>exportCFG(convert(cfg),cfg,{length:'1;quit',thickness:1,gap:0,authoredHeight:1080}));assert.throws(()=>exportCFG(convert(cfg),cfg,{length:1.5,thickness:1,gap:0,authoredHeight:1080}));});
test('preset color and alpha-disabled fallback resolved',()=>{assert.deepEqual(rgba({...cfg,color:1,alpha_enabled:false}),{rgb:[50,250,50],alpha:200});assert.throws(()=>rgba({...cfg,color:5,rgb:[-1,2,3]}));});
test('allowed CFG parsed without running commands',()=>{const r=parseLegacyCFG('cl_crosshairsize "1.5"; cl_crosshairgap -3\n// comment\ncl_crosshairdot 1');assert.equal(r.config.size,1.5);assert.equal(r.config.dot,true);});
for(const payload of ['exec evil','bind x "quit"','connect 1.2.3.4:27015','alias mine "quit"','host_writeconfig','cl_crosshairsize 2; quit','<script>alert(1)</script>','cl_crosshairsize NaN','cl_crosshairsize "abc"','cl_crosshairdot 2'])test(`reject non-data CFG: ${payload}`,()=>assert.throws(()=>parseLegacyCFG(payload)));
test('duplicate assignments are reported',()=>assert.equal(parseLegacyCFG('cl_crosshairgap -3;cl_crosshairgap -2').notes.length,1));
test('affine calibration recovers synthetic slope and intercept',()=>{const f=fitAffine([{setting:0,pixels:1},{setting:2,pixels:3},{setting:4,pixels:5}]);assert.equal(f.slope,1);assert.equal(f.intercept,1);assert.equal(f.maxResidual,0);assert.equal(inverseAffine(f,2).raw,1);assert.match(f.status,/not-renderer-verification/);});
test('fit rejects underdetermined, nonpositive and nonfinite inputs',()=>{
  for(const p of [[{setting:1,pixels:1}],[{setting:1,pixels:1},{setting:1,pixels:2},{setting:2,pixels:3}],[{setting:0,pixels:3},{setting:1,pixels:2},{setting:2,pixels:1}],[{setting:0,pixels:NaN},{setting:1,pixels:2},{setting:2,pixels:3}]])assert.throws(()=>fitAffine(p));
});
test('nonlinearity produces large residuals',()=>assert.ok(fitAffine([{setting:0,pixels:0},{setting:1,pixels:1},{setting:4,pixels:16}]).maxResidual>.5));
test('out-of-range inverse has no invented legal candidate',()=>{const f=fitAffine([{setting:0,pixels:1},{setting:1,pixels:2},{setting:2,pixels:3}]);assert.equal(inverseAffine(f,-10).inRange,false);assert.deepEqual(inverseAffine(f,-10).candidates,[]);});
const measurement={schema:'sicc-measurement-v1',kind:'gap-near',provenance:'synthetic-example',scope:{build:'2000914',currentHeight:1080,authoredHeight:1080,effectiveThickness:2,style:4,outline:false,recoil:false},points:[{setting:0,pixels:1},{setting:2,pixels:3},{setting:4,pixels:5}],screenshot:null,notes:''};
test('measurement import rejects unknown schemas and invented verified status',()=>{assert.doesNotThrow(()=>validateMeasurement(measurement));assert.throws(()=>validateMeasurement({...measurement,provenance:'verified'}));assert.throws(()=>validateMeasurement({...measurement,foo:1}));assert.throws(()=>validateMeasurement({...measurement,scope:{...measurement.scope,outline:true}}));});
test('mask equality is expressly synthetic, empty IoU is undefined',()=>{const a=raster(geom(cfg,1080)),b=raster(geom(cfg,1080));assert.equal(compareMasks(a,b).different,0);assert.match(compareMasks(a,b).scope,/Synthetic/);const z=raster(geom({...cfg,size:0},1080));assert.equal(compareMasks(z,z).iou,null);});
test('mask captures range clipping',()=>assert.equal(raster(geom({...cfg,size:1000},1080)).cropped,true));
test('T style omits only the top arm',()=>assert.equal(rectangles(geom(cfg,1080),{t_style:true}).length,3));
test('bounded solver chooses a legal nearest length across controlled heights',()=>{
  for(const h of [720,768,960,1024,1080,1440,2160])for(const s of [0,.1,1,1.5,2,4,20,100]){
    const r=convert({...cfg,size:s},{currentHeight:h,authoredHeight:1080});const target=r.target.length;
    for(let n=0;n<=255;n++)assert.ok(Math.abs(predictedGeometry({...r.native,length:n},h).length-target)+1e-9>=r.solutions.length.error);
  }
});
test('measured gap fit is not silently quantized a second time',()=>{
  const m={gapBaseline:'measured',rounding:'trunc',farDelta:1,measuredBase:.25,measuredStep:1.5};
  const p=predictedGeometry({length:3,thickness:2,gap:1,authoredHeight:1080},1080,m);
  assert.equal(p.near,1.75);
});
test('export and legacy encoder reject non-boolean flags',()=>{
  assert.throws(()=>encodeLegacy({...cfg,dot:'true'}));assert.throws(()=>exportCFG(convert(cfg),{...cfg,recoil:'1;quit'}));
});
const REMOVED_EXPORT_TOKENS=['cl_crosshairsize','cl_crosshairthickness','cl_crosshairalpha','cl_crosshairgap','cl_crosshairusealpha','exec','bind','connect','host_writeconfig'];
test('exports never emit removed or hidden legacy commands and keep the new gap name',()=>{
  const r=convert(cfg),outputs=[exportCFG(r,cfg),nativeCommands(cfg,r.native).join('\n')];
  for(const out of outputs){
    for(const token of REMOVED_EXPORT_TOKENS)
      assert.ok(!new RegExp(`(?:^|\\s)${token}(?:\\s|$)`,'m').test(out),`export emitted removed token ${token}`);
    assert.ok(!/(?:^|\s)cl_crosshaircolor\s+\d/m.test(out),'export emitted the removed color preset index');
    assert.match(out,/(?:^|\s)cl_crosshair_gap \d/m);
  }
});
test('new-build cvars are rejected by the legacy importer with a dedicated message',()=>{
  for(const name of ['cl_crosshair_length','cl_crosshair_thickness','cl_crosshair_gap','cl_crosshair_screen_height'])
    assert.throws(()=>parseLegacyCFG(`${name} 3`),/New-build cvars cannot be imported as legacy settings/);
  assert.throws(()=>parseLegacyCFG('cl_crosshair_length abc'),/New-build cvars cannot be imported as legacy settings/);
  const legacy=parseLegacyCFG('cl_crosshairsize 2\ncl_crosshairthickness 1\ncl_crosshairgap -3');
  assert.equal(legacy.config.size,2);assert.equal(legacy.config.gap,-3);
});
