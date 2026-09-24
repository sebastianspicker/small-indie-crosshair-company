import { $,el,download,copy,fmt } from '../ui/dom.js';
import { decodeLegacy,encodeLegacy } from '../../lib/settings/sharecode.js';
import { parseLegacyText } from '../../lib/settings/import.js';
import { convert,DEFAULT_MODEL,TARGET_BUILD,predictedGeometry,exportCFG } from '../../lib/manual/conversion.js';
import { rgba,validateNative } from '../../lib/settings/native.js';
import { raster,compareMasks } from '../../lib/geometry/raster.js';
import { paint } from './preview.js';
import { decimal } from '../../lib/settings/validation.js';

export function initEditor(presets) {
  let settings=decodeLegacy(presets[0].code),result,manual=null,design=false,difference=false,lastValidNative,activeCalibration=null;
  const opts={oldHeight:1080,currentHeight:1080,authoredHeight:1080,goal:'pixels',model:{...DEFAULT_MODEL}};
  const view={zoom:12,stretch:1,grid:true};
  for(const p of presets)$('preset').append(el('option',{value:p.id},`${p.player} · ${p.observed_date}`));
  function reflectLegacy() {
    for(const [id,key] of [['old-size','size'],['old-thickness','thickness'],['old-gap','gap'],['alpha','alpha']])$(id).value=settings[key];
    for(const [id,key] of [['dot','dot'],['t-style','t_style'],['outline','outline'],['recoil','recoil']])$(id).checked=settings[key];
    const c=rgba(settings);$('color').value='#'+c.rgb.map(v=>v.toString(16).padStart(2,'0')).join('');$('alpha').value=c.alpha;
  }
  function reflectSource() {
    const p=presets.find(p=>p.id===$('preset').value);
    $('preset-source').replaceChildren(el('span',{},`${p.map} · reported match observation. `),el('a',{href:p.source,target:'_blank',rel:'noopener noreferrer'},'Source ↗'));
  }
  function native() {return manual??result.native;}
  function validateInputs() {
      for (const id of ['old-size','old-thickness','old-gap','old-height','current-height','authored-height','alpha']) {
        decimal($(id).value, $(id).labels?.[0]?.textContent ?? id);
      }
      if (manual) for (const id of ['new-length','new-thickness','new-gap']) decimal($(id).value,id);
      if (opts.model.gapBaseline === 'measured') for (const id of ['measured-base','measured-step']) decimal($(id).value,id);
  }
  function validateCalibration(n) {
      if (activeCalibration && opts.model.gapBaseline === 'measured') {
        const s=activeCalibration.scope,w=predictedGeometry(n,opts.currentHeight,opts.model).width;
        if (s.currentHeight!==opts.currentHeight || s.authoredHeight!==n.authoredHeight || s.effectiveThickness!==w)
          throw new Error('Measured-fit scope no longer matches these heights or effective width. Restore the recorded scope or select an unmeasured gap hypothesis.');
      }
  }
  function renderCanvases(n,prediction,color) {
      for(const [id,key] of [['new-length','length'],['new-thickness','thickness'],['new-gap','gap']])if(document.activeElement!==$(id))$(id).value=n[key];
      $('old-res-label').textContent=`${opts.oldHeight}p`;
      $('old-preview-title').textContent=design?'Legacy reference (not a target)':'Legacy reconstruction';
      $('candidate-caption').textContent=difference?'Green = overlap · amber = new-only · lilac = old-only':`${opts.currentHeight}p target / ${n.authoredHeight}p authored · ${opts.model.gapBaseline} gap`;
      paint($('old-canvas'),result.old,settings,color,view);
      paint($('new-canvas'),prediction,settings,color,view,difference?result.old:null);
      const labels=[['Arm length',result.old.length,prediction.length],['Line thickness',result.old.width,prediction.width],['Near inner edge',result.old.near,prediction.near]];
      $('geometry-stats').replaceChildren(...labels.map(([label,a,b])=>el('div',{class:'metric'},el('span',{},label),el('strong',{},`${fmt(a)} → ${fmt(b)}`),el('small',{},'old → simulated · game pixels'))));
  }
  function renderStatus(prediction) {
      const mask=compareMasks(raster(result.old,settings),raster(prediction,settings));
      $('match-status').textContent=design?'Direct design: no legacy-equivalence claim.':opts.oldHeight!==opts.currentHeight&&opts.goal==='screen'?'Cross-resolution target: inspect numeric residuals in the report.':
        mask.cropped?'Preview mask is cropped; no whole-shape agreement claim.':`${mask.different} differing pixels in model masks · not an in-game test`;
      $('candidate-mode').textContent=design?'Direct native design. Commands are valid-range settings; the preview still uses unverified rendering assumptions.':manual?'Manually edited candidate. Automatic residuals no longer describe this candidate.':
        'Calculated from legacy pixels. Fields are editable; exporting never hides the selected assumptions.';
      const messages=[...result.blockers.map(t=>['blocked',t]),...result.warnings.map(t=>['warning',t])];
      if(manual)messages.push(['warning','Manual edits are included in the report separately from the automatic solution.']);
      $('warnings').replaceChildren(...messages.map(([type,message])=>el('p',{class:type},message)));
      const blocked=result.blockers.length>0;
      for(const id of ['download-cfg','copy-cfg'])$(id).disabled=blocked;
      $('cfg-output').value=blocked?'Export blocked: '+result.blockers.join(' '):exportCFG(result,settings,manual);
      $('cfg-output').removeAttribute('aria-invalid');
  }
  function render() {
    try {
      validateInputs();
      result=convert(settings,opts);const n=native();validateNative(n);lastValidNative={...n};
      validateCalibration(n);
      const prediction=predictedGeometry(n,opts.currentHeight,opts.model),color=rgba(settings);
      renderCanvases(n,prediction,color);
      renderStatus(prediction);
    } catch(error) {
      $('warnings').replaceChildren(el('p',{class:'blocked',role:'alert'},error.message));
      for(const id of ['download-cfg','copy-cfg','download-report'])$(id).disabled=true;
      $('cfg-output').value='No export: correct invalid inputs first.';return;
    }
    $('download-report').disabled=false;
  }
  function schedule(){cancelAnimationFrame(schedule.id);schedule.id=requestAnimationFrame(render);}
  function edit(fn){try{fn();$('export-status').textContent='';render();}catch(e){$('warnings').replaceChildren(el('p',{class:'blocked',role:'alert'},e.message));$('download-cfg').disabled=true;$('copy-cfg').disabled=true;$('download-report').disabled=true;}}
  function loadPreset(){settings=decodeLegacy(presets.find(p=>p.id===$('preset').value).code);manual=null;reflectLegacy();reflectSource();render();}
  $('preset').addEventListener('change',loadPreset);$('reset').addEventListener('click',loadPreset);
  $('import-legacy').addEventListener('click',()=>{
    try {const val=$('legacy-import').value.trim();const next=parseLegacyText(val);convert(next,opts);rgba(next);settings=next;
      manual=null;reflectLegacy();$('preset-source').textContent='Imported legacy settings · player provenance not inferred.';
      $('import-status').textContent='Imported as data only. No commands were executed.';render();}
    catch(e){$('import-status').textContent=e.message;}
  });
  for(const [id,key] of [['old-size','size'],['old-thickness','thickness'],['old-gap','gap']])$(id).addEventListener('input',()=>edit(()=>{settings={...settings,[key]:decimal($(id).value,key)};manual=null;$('preset-source').textContent='Edited settings · no longer the dated preset.';}));
  for(const [id,key] of [['old-height','oldHeight'],['current-height','currentHeight'],['authored-height','authoredHeight']])$(id).addEventListener('input',()=>edit(()=>{
    opts[key]=decimal($(id).value,key);manual=null;
    if(key==='currentHeight'){opts.authoredHeight=opts.currentHeight;$('authored-height').value=opts.currentHeight;}
  }));
  $('match-goal').addEventListener('change',()=>edit(()=>{opts.goal=$('match-goal').value;manual=null;}));
  $('gap-model').addEventListener('change',()=>edit(()=>{opts.model.gapBaseline=$('gap-model').value;activeCalibration=null;$('measured-fields').hidden=opts.model.gapBaseline!=='measured';manual=null;}));
  $('rounding').addEventListener('change',()=>edit(()=>{opts.model.rounding=$('rounding').value;manual=null;}));
  for(const [id,key] of [['measured-base','measuredBase'],['measured-step','measuredStep']])$(id).addEventListener('input',()=>edit(()=>{opts.model[key]=decimal($(id).value,key);activeCalibration=null;manual=null;}));
  for(const [id,key] of [['new-length','length'],['new-thickness','thickness'],['new-gap','gap']])$(id).addEventListener('input',()=>edit(()=>{
    manual={...(manual??result.native)};manual[key]=decimal($(id).value,key);
  }));
  $('use-conversion').addEventListener('click',()=>{manual=null;design=false;setMode();render();});
  for(const [id,key] of [['dot','dot'],['t-style','t_style'],['outline','outline'],['recoil','recoil']])$(id).addEventListener('change',()=>edit(()=>{settings={...settings,[key]:$(id).checked};}));
  $('color').addEventListener('input',()=>edit(()=>{settings={...settings,color:5,rgb:[1,3,5].map(i=>parseInt($('color').value.slice(i,i+2),16))};}));
  $('alpha').addEventListener('input',()=>edit(()=>{settings={...settings,alpha_enabled:true,alpha:decimal($('alpha').value,'Alpha')};}));
  $('zoom').addEventListener('change',()=>{view.zoom=Number($('zoom').value);render();});
  $('stretch').addEventListener('change',()=>{view.stretch=Number($('stretch').value);render();});
  $('grid').addEventListener('change',()=>{view.grid=$('grid').checked;render();});
  $('difference-toggle').addEventListener('click',()=>{difference=!difference;$('difference-toggle').ariaPressed=String(difference);$('difference-toggle').textContent=difference?'Show candidate color':'Show mask difference';render();});
  function setMode(){for(const [id,value]of [['mode-design',design],['mode-restore',!design]]){$(id).classList.toggle('active',value);$(id).ariaPressed=String(value);}}
  $('mode-design').addEventListener('click',()=>{design=true;manual={...lastValidNative};settings={...settings,style:4,weapon_gap:false};setMode();render();});
  $('mode-restore').addEventListener('click',()=>{design=false;manual=null;setMode();render();});
  $('copy-cfg').addEventListener('click',()=>copy($('cfg-output').value,$('export-status')));
  $('download-cfg').addEventListener('click',()=>download('small-indie-candidate.cfg',$('cfg-output').value,'text/plain'));
  $('download-report').addEventListener('click',()=>{
    const report={schema:'sicc-report-v1',createdAt:new Date().toISOString(),researchSnapshot:'2026-09-23',
      statement:'No native renderer validation. Synthetic predictions are not independent evidence.',
      mode:design?'direct-design':'legacy-restoration',settings,result,manualCandidate:manual,
      calibration:activeCalibration,actualPreview:predictedGeometry(native(),opts.currentHeight,opts.model)};
    download('small-indie-math-report.json',JSON.stringify(report,null,2)+'\n');
  });
  $('legacy-code').addEventListener('click',()=>{try{copy(encodeLegacy(settings),$('export-status'));}catch(e){$('export-status').textContent=e.message;}});
  const observer=new ResizeObserver(schedule);observer.observe($('new-canvas'));
  reflectLegacy();reflectSource();render();
  return {refresh:render,applyCalibration(fit,scope,evidence){
    if(scope.build!==TARGET_BUILD)throw new Error('Calibration build differs from the targeted game snapshot.');
    if(scope.style!==4||scope.outline||scope.recoil)throw new Error('Unsupported calibration scope.');
    if(scope.currentHeight!==opts.currentHeight||scope.authoredHeight!==opts.authoredHeight||scope.effectiveThickness!==predictedGeometry(native(),opts.currentHeight,opts.model).width)
      throw new Error('Calibration scope does not match the workbench heights/effective thickness. Set matching conditions first.');
    activeCalibration={scope:{...scope},fit,provenance:evidence?.provenance??'user-entered',points:evidence?.points??[]};
    opts.model={...opts.model,gapBaseline:'measured',measuredBase:fit.intercept,measuredStep:fit.slope};
    $('gap-model').value='measured';$('measured-fields').hidden=false;$('measured-base').value=fit.intercept;$('measured-step').value=fit.slope;manual=null;render();
  }};
}
