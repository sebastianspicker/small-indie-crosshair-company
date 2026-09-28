import { raster, compareMasks } from '../../lib/geometry/raster.js';
const token=(css,name,fallback)=>css.getPropertyValue(name).trim()||fallback;
export function paint(canvas,geometry,flags,rgba,view,other=null) {
  const ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1,css=getComputedStyle(document.documentElement);
  const rect=canvas.getBoundingClientRect(),cssW=Math.max(200,rect.width),cssH=Math.max(100,rect.height||300);
  canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);
  ctx.scale(dpr,dpr);ctx.imageSmoothingEnabled=false;
  ctx.fillStyle=token(css,'--plate','#0c0e0d');ctx.fillRect(0,0,cssW,cssH);
  const z=view.zoom,sx=z*view.stretch,ox=Math.floor(cssW/2),oy=Math.floor(cssH/2);
  if(view.grid) {
    ctx.strokeStyle=token(css,'--plate-grid','#1b1f1c');ctx.lineWidth=.6;ctx.beginPath();
    for(let x=ox% sx;x<cssW;x+=sx){ctx.moveTo(x,0);ctx.lineTo(x,cssH);}
    for(let y=oy%z;y<cssH;y+=z){ctx.moveTo(0,y);ctx.lineTo(cssW,y);}ctx.stroke();
  }
  const a=raster(geometry,flags),b=other?raster(other,flags):null,half=(a.side-1)/2;
  ctx.globalAlpha=.35;ctx.strokeStyle=token(css,'--plate-ink','#92948c');ctx.setLineDash([3,5]);ctx.beginPath();
  ctx.moveTo(ox+sx/2,0);ctx.lineTo(ox+sx/2,cssH);ctx.moveTo(0,oy+z/2);ctx.lineTo(cssW,oy+z/2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  if(flags.outline && !other) {
    ctx.fillStyle='#000';ctx.globalAlpha=rgba.alpha/255;
    a.data.forEach((v,i)=>{if(v){const x=i%a.side-half,y=Math.floor(i/a.side)-half;ctx.fillRect(ox+(x-1)*sx,oy+(y-1)*z,3*sx,3*z);}});
  }
  ctx.fillStyle=`rgb(${rgba.rgb.join(',')})`;ctx.globalAlpha=rgba.alpha/255;
  for(let i=0;i<a.data.length;i++) {
    if(b) {if(!(a.data[i]||b.data[i]))continue;ctx.fillStyle=token(css,a.data[i]&&b.data[i]?'--diff-shared':a.data[i]?'--diff-extra':'--diff-missing','#ccc');ctx.globalAlpha=1;}
    else if(!a.data[i])continue;
    const x=i%a.side-half,y=Math.floor(i/a.side)-half;
    ctx.fillRect(ox+x*sx,oy+y*z,sx,z);
  }
  ctx.globalAlpha=1;
  return b?compareMasks(a,b):null;
}
