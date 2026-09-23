import { $,el,heading,download,table,fmt,docLink } from './dom.js';
import { fitAffine,inverseAffine,validateMeasurement } from '../lib/calibration.js';
import { decimal } from '../lib/validation.js';
import { TARGET_BUILD } from '../lib/conversion.js';
const input=(id,value,attrs={})=>el('input',{id,type:'number',value,...attrs});
function field(label,id,control){return el('div',{},el('label',{for:id},label),control);}
export function initCalibration(editor) {
  const root=$('calibration');let fit=null,lastDataset=null,provenance='user-entered',image=null,imageMeta=null,picks=[];
  root.append(heading('Measure first. Believe later.','Record native pixel measurements under fixed conditions. Fit an explicit model and keep an independent holdout.'));
  root.append(el('p',{class:'disclosure'},'No sample values below are native measurements. “Load synthetic example” demonstrates the workflow only. Uploaded PNGs stay in this tab; their pixels are not sent to a server.'));
  const scope=el('article',{class:'math-sheet'},el('h2',{},'01 · Lock the measurement conditions'),
    el('div',{class:'input-grid four'},
      field('Build','cal-build',el('input',{id:'cal-build',value:TARGET_BUILD,maxlength:64})),
      field('Current height','cal-current',input('cal-current',1080,{min:240,max:16384})),
      field('Authored height','cal-authored',input('cal-authored',1080,{min:240,max:16384})),
      field('Effective width (pixels)','cal-width',input('cal-width',2,{min:1,max:128}))),
    field('Quantity being measured','cal-kind',el('select',{id:'cal-kind'},
      ...[['gap-near','Near inner edge vs. new gap'],['gap-far','Far inner edge vs. new gap'],['length','Arm pixels vs. new length'],['thickness','Width pixels vs. new thickness']].map(([v,t])=>el('option',{value:v},t)))),
    el('p',{class:'small'},'Required: style 4, outline off, follow-recoil off. Positive nonsaturated dimensions for affine fits. A calibration applies only to the recorded build, heights and effective thickness.'));
  root.append(scope);
  const bench=el('div',{class:'cal-grid'}),measure=el('article',{class:'math-sheet'},el('h2',{},'02 · Enter the observations'));
  const body=el('tbody'),rowsTable=el('table',{},el('thead',{},el('tr',{},el('th',{},'Setting'),el('th',{},'Measured pixels'),el('th',{},'Remove'))),body);
  let rowId=0;
  function addRow(x='',y=''){if(body.children.length>=128)return;const id=++rowId;
    const tr=el('tr',{},el('td',{},input('point-x-'+id,x,{'aria-label':`Observation ${id} setting`,step:'any','data-kind':'setting'})),
      el('td',{},input('point-y-'+id,y,{'aria-label':`Observation ${id} pixels`,step:'any','data-kind':'pixels'})),
      el('td',{},el('button',{class:'text-button','aria-label':`Remove observation ${id}`,onClick:()=>{tr.remove();invalidate();}},'Remove')));
    tr.addEventListener('input',invalidate);body.append(tr);
  }
  function invalidate(){fit=null;lastDataset=null;if($('cal-result'))$('cal-result').textContent='Inputs changed. Fit again before exporting or applying.';if($('cal-apply'))$('cal-apply').disabled=true;}
  measure.append(rowsTable,el('div',{class:'toolbar-group'},
    el('button',{class:'button secondary',onClick:()=>{addRow();invalidate();}},'Add observation'),
    el('button',{class:'text-button',onClick:()=>{body.replaceChildren();[[0,1],[2,3],[4,5]].forEach(p=>addRow(...p));provenance='synthetic-example';$('cal-provenance').textContent='SYNTHETIC EXAMPLE · not game evidence';invalidate();}},'Load synthetic example')),
    el('p',{id:'cal-provenance',class:'small'},'User-entered observations · not independently verified'),
    field('Target pixel value for inverse','cal-target',input('cal-target',2,{step:'any'})),
    el('button',{id:'cal-fit',class:'button primary'},'Fit affine model'),el('div',{id:'cal-result',role:'status',class:'fit-result'}));
  const photo=el('article',{class:'math-sheet'},el('h2',{},'Optional · Inspect a native capture'),
    el('p',{class:'small'},'Use an original lossless PNG, not a resized stream frame. Click two cells to inspect pixel coordinates. Distances are boundary differences, not inclusive pixel counts.'),
    field('Native screenshot PNG (up to 8 MiB)','screenshot-file',el('input',{id:'screenshot-file',type:'file',accept:'image/png'})),
    el('div',{class:'input-grid'},field('Crop center X','crop-x',input('crop-x',0,{min:0})),field('Crop center Y','crop-y',input('crop-y',0,{min:0}))),
    el('canvas',{id:'screenshot-canvas',width:480,height:480,'aria-label':'Nearest-neighbor native screenshot crop; select pixel cells'}),
    el('p',{id:'screenshot-info',class:'small',role:'status'},'No image loaded. No measurements inferred.'));
  bench.append(measure,photo);root.append(bench);
  root.append(el('article',{class:'math-sheet'},el('h2',{},'03 · Export the experiment'),
    field('Notes, controls and holdout observations','cal-notes',el('textarea',{id:'cal-notes',rows:3,maxlength:2048,placeholder:'Weapon, stance, how boundaries were measured, independent holdout, observed parity, limitations…'})),
    el('div',{class:'toolbar-group'},el('button',{id:'cal-export',class:'button secondary'},'Export measurement JSON'),
      el('button',{id:'cal-apply',class:'button primary',disabled:true},'Use near-gap fit as a hypothesis')),
    field('Import measurement JSON (max 100 KiB)','cal-import',el('input',{id:'cal-import',type:'file',accept:'.json,application/json'})),
    el('p',{id:'cal-status',role:'status',class:'small'}),docLink('math/03-calibration-protocol.md','Full protocol and why three points are not proof')));
  for(let i=0;i<3;i++)addRow();
  function dataset(){return validateMeasurement({schema:'sicc-measurement-v1',kind:$('cal-kind').value,provenance,
    scope:{build:$('cal-build').value,currentHeight:decimal($('cal-current').value,'Current height'),authoredHeight:decimal($('cal-authored').value,'Authored height'),effectiveThickness:decimal($('cal-width').value,'Width'),style:4,outline:false,recoil:false},
    points:[...body.children].map(row=>({setting:decimal(row.querySelector('[data-kind=setting]').value,'Setting'),pixels:decimal(row.querySelector('[data-kind=pixels]').value,'Measured pixels')})),
    screenshot:imageMeta,notes:$('cal-notes').value});}
  for(const id of ['cal-kind','cal-build','cal-current','cal-authored','cal-width'])$(id).addEventListener('input',invalidate);
  $('cal-fit').addEventListener('click',()=>{try{
    lastDataset=dataset();fit=fitAffine(lastDataset.points);const inverse=inverseAffine(fit,decimal($('cal-target').value,'Target'),lastDataset.kind.startsWith('gap')?128:lastDataset.kind==='thickness'?31:255);
    $('cal-result').replaceChildren(el('h3',{},`pixels = ${fmt(fit.intercept)} + ${fmt(fit.slope)} × setting`),
      el('p',{},`RMSE ${fmt(fit.rmse)} px · max residual ${fmt(fit.maxResidual)} px · ideal inverse ${fmt(inverse.raw)}`),
      table(['Setting','Observed','Predicted','Residual'],fit.residuals.map(r=>[r.setting,r.pixels,fmt(r.predicted),fmt(r.residual)])),el('p',{class:'small'},fit.warning));
    $('cal-apply').disabled=lastDataset.kind!=='gap-near'||lastDataset.scope.build!==TARGET_BUILD;
    $('cal-status').textContent='Fit computed locally. Its provenance remains '+provenance+'.';
  }catch(e){fit=null;lastDataset=null;$('cal-apply').disabled=true;$('cal-result').textContent=e.message;}});
  $('cal-target').addEventListener('input',()=>{if(fit)$('cal-result').textContent='Target changed. Fit again to update the inverse display.';});
  $('cal-export').addEventListener('click',()=>{try{download('small-indie-measurements.json',JSON.stringify(dataset(),null,2)+'\n');$('cal-status').textContent='Exported observations and scope; no verification certificate.';}catch(e){$('cal-status').textContent=e.message;}});
  $('cal-apply').addEventListener('click',()=>{try{if(!fit||!lastDataset)throw new Error('Fit the current observations first.');editor.applyCalibration(fit,lastDataset.scope,lastDataset);$('cal-status').textContent='Applied as an unverified user-input hypothesis. Its current scope must remain fixed.';location.hash='workbench';}catch(e){$('cal-status').textContent=e.message;}});
  $('cal-import').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>102400)throw new Error('Measurement JSON exceeds 100 KiB.');const d=validateMeasurement(JSON.parse(await file.text()));
    body.replaceChildren();d.points.forEach(p=>addRow(p.setting,p.pixels));provenance=d.provenance;imageMeta=d.screenshot??null;
    for(const[id,v]of Object.entries({'cal-build':d.scope.build,'cal-current':d.scope.currentHeight,'cal-authored':d.scope.authoredHeight,'cal-width':d.scope.effectiveThickness,'cal-kind':d.kind,'cal-notes':d.notes??''}))$(id).value=v;
    $('cal-provenance').textContent=provenance==='synthetic-example'?'SYNTHETIC EXAMPLE · not game evidence':'Imported user observations · not independently verified';invalidate();$('cal-status').textContent='Imported safely as data. PNG contents are not included in measurement JSON.';
  }catch(error){$('cal-status').textContent=error.message;}});
  function drawCrop(){const c=$('screenshot-canvas'),ctx=c.getContext('2d');ctx.fillStyle='#111a15';ctx.fillRect(0,0,480,480);if(!image)return;
    const x=Number($('crop-x').value),y=Number($('crop-y').value);if(!Number.isFinite(x+y))return;
    ctx.imageSmoothingEnabled=false;ctx.drawImage(image,x-24,y-24,48,48,0,0,480,480);
    ctx.strokeStyle='#9aba7b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(240,0);ctx.lineTo(240,480);ctx.moveTo(0,240);ctx.lineTo(480,240);ctx.stroke();}
  let uploadToken=0;
  $('screenshot-file').addEventListener('change',async e=>{const token=++uploadToken;try{
    const f=e.target.files[0];if(!f)return;if(f.size>8*1024*1024)throw new Error('PNG exceeds 8 MiB.');
    const bytes=await f.arrayBuffer(),v=new DataView(bytes);if(bytes.byteLength<24||v.getUint32(0)!==0x89504e47||v.getUint32(4)!==0x0d0a1a0a)throw new Error('A real PNG file is required.');
    const width=v.getUint32(16),height=v.getUint32(20);if(width<1||height<1||width>8192||height>8192||width*height>16777216)throw new Error('Image exceeds the 8192-side / 16-megapixel inspection limit.');
    const bitmap=await createImageBitmap(f);if(token!==uploadToken){bitmap.close();return;}
    image?.close();image=bitmap;
    const hash=crypto.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join(''):null;
    if(token!==uploadToken)return;
    imageMeta={name:f.name.slice(0,256),width,height,sha256:hash};picks=[];$('crop-x').value=Math.floor(width/2);$('crop-y').value=Math.floor(height/2);drawCrop();
    $('screenshot-info').textContent=`${width} × ${height} original pixels. SHA-256 ${hash??'unavailable'}. Click pixel boundaries; no native dimensions have been inferred.`;
  }catch(error){$('screenshot-info').textContent=error.message;}});
  for(const id of ['crop-x','crop-y'])$(id).addEventListener('input',()=>{picks=[];drawCrop();});
  $('screenshot-canvas').addEventListener('click',e=>{
    if(!image)return;const bounds=e.currentTarget.getBoundingClientRect();
    const x=Math.floor((e.clientX-bounds.left)/bounds.width*48)+Number($('crop-x').value)-24;
    const y=Math.floor((e.clientY-bounds.top)/bounds.height*48)+Number($('crop-y').value)-24;
    if(x<0||y<0||x>=image.width||y>=image.height)return;
    picks.push({x,y});if(picks.length>2)picks.shift();
    const sample=document.createElement('canvas');sample.width=sample.height=1;const ctx=sample.getContext('2d');ctx.drawImage(image,x,y,1,1,0,0,1,1);const pixel=ctx.getImageData(0,0,1,1).data;
    $('screenshot-info').textContent=`Cell (${x}, ${y}), offset (${x-Math.floor(image.width/2)}, ${y-Math.floor(image.height/2)}), RGBA ${[...pixel].join('/')}. `+
      (picks.length===2?`Boundary difference: Δx=${Math.abs(x-picks[0].x)}, Δy=${Math.abs(y-picks[0].y)}. Choose the actual arm edges yourself.`:'Select a second boundary cell.');
  });drawCrop();
}
