/** Illustrative binary raster, not an extracted CS2 shader. See math/04-rendering.md. */
export const RASTER_CONVENTION = 'illustrative-parity-v2';
export const RAW_EDGE_CONVENTION = 'measured-edges-v1';

/** Convert model offsets to drawing edges; measured pixel edges are already literal. */
export function drawingEdges(g, convention = g.rasterConvention ?? RASTER_CONVENTION) {
  if (![RASTER_CONVENTION, RAW_EDGE_CONVENTION].includes(convention)) throw new Error('Unknown raster convention.');
  const correction = convention === RASTER_CONVENTION && Number.isInteger(g.width) && g.width % 2 === 0 ? 1 : 0;
  return { near: g.near, far: g.far - correction };
}

export function rectangles(g, {dot=false,t_style=false}={}, convention = g.rasterConvention ?? RASTER_CONVENTION) {
  const {length:L,width:W}=g;
  const {near:a,far:b}=drawingEdges(g, convention);
  const t=-Math.floor(W/2),out=[];
  if(L>0) {
    out.push({x:-a-L,y:t,w:L,h:W},{x:b,y:t,w:L,h:W},{x:t,y:b,w:W,h:L});
    if(!t_style)out.push({x:t,y:-a-L,w:W,h:L});
  }
  if(dot)out.push({x:t,y:t,w:W,h:W});
  return out;
}
export function raster(g, flags={}, side=161, convention = g.rasterConvention ?? RASTER_CONVENTION) {
  if(!Number.isInteger(side)||side<9||side>513||side%2!==1)throw new Error('Raster side must be odd, 9–513.');
  const data=new Uint8Array(side*side),half=Math.floor(side/2);
  const boxes = rectangles(g,flags,convention);
  for(const r of boxes) {
    // Coverage at pixel centers, deterministic even for fractional research hypotheses.
    const left=Math.max(0,Math.ceil(r.x-.5)+half),top=Math.max(0,Math.ceil(r.y-.5)+half);
    const right=Math.min(side,Math.ceil(r.x+r.w-.5)+half),bottom=Math.min(side,Math.ceil(r.y+r.h-.5)+half);
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)data[y*side+x]=1;
  }
  return {data,side,convention,cropped:boxes.some(r=>r.x < -half || r.y < -half || r.x+r.w>half+1||r.y+r.h>half+1)};
}
export function compareMasks(a,b) {
  if(a.side!==b.side)throw new Error('Raster sizes must match.');
  let union=0,different=0,intersection=0;
  a.data.forEach((v,i)=>{union+=Number(!!(v||b.data[i]));intersection+=Number(!!(v&&b.data[i]));different+=Number(v!==b.data[i]);});
  return {different,intersection,union,iou:union?intersection/union:null,cropped:a.cropped||b.cropped,
    scope:'Synthetic binary geometry masks only; no color, alpha, outline or game validation.'};
}
