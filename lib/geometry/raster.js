/** Illustrative binary raster, not an extracted CS2 shader. See math/04-rendering.md. */
import { finite } from '../settings/validation.js';
export const RASTER_CONVENTION = 'illustrative-parity-v2';
export const RAW_EDGE_CONVENTION = 'measured-edges-v1';
export const COMMUNITY_CONVENTION = 'community-static-pixels-v1';

/** Convert model offsets to drawing edges; measured pixel edges are already literal. */
export function drawingEdges(g, convention = g.rasterConvention ?? RASTER_CONVENTION) {
  if (![RASTER_CONVENTION, RAW_EDGE_CONVENTION, COMMUNITY_CONVENTION].includes(convention))
    throw new Error('Unknown raster convention.');
  const correction = convention === RASTER_CONVENTION && Number.isInteger(g.width) && g.width % 2 === 0 ? 1 : 0;
  return { near: g.near, far: g.far - correction };
}

/** Shared arm placement: the bar rects (zero-length ones included) and the dot rect, or null when width <= 0. */
function placement(g, {dot=false,t_style=false}, convention) {
  const {length:L,width:W}=g;
  const {near:a,far:b}=drawingEdges(g, convention);
  const t = g.axisStart === undefined ? (convention === COMMUNITY_CONVENTION ? -Math.ceil(W/2) : -Math.floor(W/2))
    : finite(g.axisStart, 'Transverse edge', -1000000, 1000000);
  if (W <= 0) return null;
  const bars = [{x:-a-L,y:t,w:L,h:W},{x:b,y:t,w:L,h:W},{x:t,y:b,w:W,h:L}];
  if(!t_style)bars.push({x:t,y:-a-L,w:W,h:L});
  return {bars, dot: dot ? {x:t,y:t,w:W,h:W} : null};
}

export function rectangles(g, flags={}, convention = g.rasterConvention ?? RASTER_CONVENTION) {
  const placed = placement(g, flags, convention);
  if (!placed) return [];
  return [...(g.length>0 ? placed.bars : []), ...(placed.dot ? [placed.dot] : [])];
}
/** Outline rectangles, one per bar and dot, in the centred coordinates of `rectangles`. `outline` is
 * `{ low, high }`: pixels added left/top and right/bottom. Zero-length bars keep their outline. */
export function outlineRectangles(g, flags={}, outline, convention = g.rasterConvention ?? RASTER_CONVENTION) {
  const {low,high}=outline;
  const placed = placement(g, flags, convention);
  if (!placed || low + high <= 0) return [];
  const grow = r => ({x:r.x-low,y:r.y-low,w:r.w+low+high,h:r.h+low+high});
  return [...placed.bars, ...(placed.dot ? [placed.dot] : [])].map(grow);
}
/** True when the coloured core is empty but the outline still draws (size 0 with an outline). */
export function outlineOnly(g, {dot=false}={}, outline) {
  return g.width > 0 && !(g.length > 0) && !dot && outline.low + outline.high > 0;
}
function fill(boxes, side) {
  if(!Number.isInteger(side)||side<9||side>513||side%2!==1)throw new Error('Raster side must be odd, 9–513.');
  const data=new Uint8Array(side*side),half=Math.floor(side/2);
  for(const r of boxes) {
    // Coverage at pixel centers, deterministic even for fractional research hypotheses.
    const left=Math.max(0,Math.ceil(r.x-.5)+half),top=Math.max(0,Math.ceil(r.y-.5)+half);
    const right=Math.min(side,Math.ceil(r.x+r.w-.5)+half),bottom=Math.min(side,Math.ceil(r.y+r.h-.5)+half);
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)data[y*side+x]=1;
  }
  return {data,side,cropped:boxes.some(r=>r.x < -half || r.y < -half || r.x+r.w>half+1||r.y+r.h>half+1)};
}
export function raster(g, flags={}, side=161, convention = g.rasterConvention ?? RASTER_CONVENTION) {
  const {data,cropped}=fill(rectangles(g,flags,convention), side);
  return {data,side,convention,cropped};
}
/** Outline-only mask for previews; never part of `compareMasks` or the solver objective. */
export function outlineRaster(g, flags, outline, side=161, convention = g.rasterConvention ?? RASTER_CONVENTION) {
  const {data,cropped}=fill(outlineRectangles(g,flags,outline,convention), side);
  return {data,side,convention,cropped};
}
export function compareMasks(a,b) {
  if(a.side!==b.side)throw new Error('Raster sizes must match.');
  let union=0,different=0,intersection=0;
  a.data.forEach((v,i)=>{union+=Number(!!(v||b.data[i]));intersection+=Number(!!(v&&b.data[i]));different+=Number(v!==b.data[i]);});
  return {different,intersection,union,iou:union?intersection/union:null,cropped:a.cropped||b.cropped,
    scope:'Synthetic binary geometry masks only; no color, alpha, outline or game validation.'};
}
