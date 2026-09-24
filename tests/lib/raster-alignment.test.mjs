import test from 'node:test';
import assert from 'node:assert/strict';
import { raster, rectangles, drawingEdges, RASTER_CONVENTION, RAW_EDGE_CONVENTION } from '../../lib/geometry/raster.js';
import { compareShapes, compileShape, compileMask } from '../../lib/geometry/pixel-shape.js';
import { legacyGeometry } from '../../lib/geometry/legacy.js';
import { predictedGeometry } from '../../lib/manual/conversion.js';
import { analyzeScreenshot } from '../../lib/image/screenshot.js';

// Independent literal bounds for the reported 2px-wide, 2px-long example.
test('even-width arms share one center instead of shifting right and bottom', () => {
  const g = legacyGeometry({size:1, thickness:1, gap:-4.5}, 1080);
  assert.equal(g.near, 1);
  assert.equal(g.far, 2); // Preserve the archived arithmetic, including its far offset.
  assert.deepEqual(rectangles(g), [
    {x:-3,y:-1,w:2,h:2}, {x:1,y:-1,w:2,h:2},
    {x:-1,y:1,w:2,h:2}, {x:-1,y:-3,w:2,h:2},
  ]);
});

test('odd/even widths remain symmetric around their pixel-grid center', () => {
  for (const width of [1,2,3,4,5,6]) for (const dot of [false,true]) {
    const near = Math.floor(width / 2) + 2;
    const mask = raster({length:3,width,near,far:near+1},{dot},49);
    const center = width % 2 ? .5 : 0, half = 24;
    const cell = (x,y) => mask.data[(y+half)*49+x+half];
    for (let y=-16;y<=16;y++) for (let x=-16;x<=16;x++) {
      assert.equal(cell(x,y),cell(2*center-x-1,y),`width ${width}, x reflection`);
      assert.equal(cell(x,y),cell(x,2*center-y-1),`width ${width}, y reflection`);
    }
    assert.equal(mask.convention, RASTER_CONVENTION);
  }
});

test('dense previews and analytical losses use the same corrected cells', () => {
  const shape = {length:2,width:2,near:1,far:2};
  const literal = {side:49,data:new Uint8Array(49*49),cropped:false};
  for (const [x,y,w,h] of [[-3,-1,2,2],[1,-1,2,2],[-1,1,2,2],[-1,-3,2,2]])
    for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)literal.data[(j+24)*49+i+24]=1;
  assert.deepEqual(raster(shape,{},49).data,literal.data);
  assert.equal(compareShapes(compileShape(shape),compileMask(literal)).iou,1);
});

test('raw measured edges and scoped affine predictions receive no parity shift', () => {
  const geometry={length:3,width:2,near:1,far:6};
  assert.equal(rectangles(geometry,{},RAW_EDGE_CONVENTION)[1].x,6);
  assert.equal(drawingEdges(geometry,RAW_EDGE_CONVENTION).far,6);
  const measured=predictedGeometry({length:3,thickness:2,gap:2,authoredHeight:1080},1080,
    {gapBaseline:'measured',rounding:'trunc',farDelta:1,measuredBase:1,measuredStep:1});
  assert.equal(rectangles(measured)[1].x,measured.far);
  assert.throws(()=>raster(geometry,{},49,'unknown'),/Unknown raster convention/);
});

test('T shapes omit the top arm and pure dots retain their original square',()=>{
  const g={length:3,width:2,near:1,far:2};
  assert.equal(rectangles(g,{t_style:true}).length,3);
  assert.deepEqual(rectangles({...g,length:0},{dot:true}),[{x:-1,y:-1,w:2,h:2}]);
});

test('old image fitting preserves asymmetric input pixels instead of centering the evidence',()=>{
  const original=raster({length:4,width:2,near:2,far:3},{},129,RAW_EDGE_CONVENTION);
  const bytes=new Uint8ClampedArray(129*129*4);
  original.data.forEach((v,i)=>bytes.set(v?[0,255,0,255]:[0,0,0,255],i*4));
  const before=bytes.slice();
  const fit=analyzeScreenshot({data:bytes,side:129,seed:[0,255,0]});
  assert.deepEqual(fit.mask.data,original.data);
  assert.deepEqual(bytes,before);
  assert.ok(fit.templateIou<1);
  assert.equal(fit.rasterConvention,RASTER_CONVENTION);
});
