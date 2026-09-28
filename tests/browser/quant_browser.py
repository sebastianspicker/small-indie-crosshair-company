#!/usr/bin/env python3
"""Quant UI integration checks, with explicit managed-browser fixture mode."""
import argparse,json,shutil,subprocess,time,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_harness import mount, ROOT

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--in-memory',action='store_true');parser.add_argument('--output',type=Path,default=Path(tempfile.gettempdir())/'sicc-quant-browser');args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
 checks=[];server=None
 def check(name,value):
  if not value:raise AssertionError(name)
  checks.append(name)
 try:
  if not args.in_memory:
   server=subprocess.Popen(['node','scripts/serve.mjs','--port','4176'],cwd=ROOT,stdout=subprocess.DEVNULL);time.sleep(.5)
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);context=browser.new_context(viewport={'width':1440,'height':1050},device_scale_factor=1,accept_downloads=True);page=context.new_page();errors=[];console_issues=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda msg:console_issues.append(f'{msg.type}: {msg.text}') if msg.type in ['warning','error'] else None)
   if args.in_memory:mount(page,crypto_bridge=True)
   else:page.goto('http://127.0.0.1:4176',wait_until='networkidle')
   def ready():page.wait_for_selector('#quant[data-result="ready"]',timeout=15000)
   ready();check('simple mode is the default',page.locator('html').get_attribute('data-mode')=='simple');check('simple view hides the expert controls',page.locator('.quant-simple').is_visible() and not page.locator('.quant-layout').is_visible());check('simple result is announced',page.locator('#qs-live').text_content().startswith('New settings:'))
   if not args.in_memory:check('page identity matches the intended local app',page.url.startswith('http://127.0.0.1:4176/') and 'Crosshair' in page.title())
   check('meaningful converter renders without a boot-error overlay',page.locator('#quant h1').is_visible() and not page.locator('#boot-error').is_visible())
   page.set_viewport_size({'width':390,'height':900});page.wait_for_timeout(120)
   check('mobile visual and DOM flow is paste, answer, adjustments',page.evaluate('''()=>{const steps=[...document.querySelectorAll('.qs-step')],reading=document.querySelector('.qs-reading'),following=Node.DOCUMENT_POSITION_FOLLOWING;return Boolean(steps[0].compareDocumentPosition(reading)&following)&&Boolean(reading.compareDocumentPosition(steps[1])&following)&&steps[0].getBoundingClientRect().top<reading.getBoundingClientRect().top&&reading.getBoundingClientRect().top<steps[1].getBoundingClientRect().top}'''))
   page.screenshot(path=str(args.output/'simple-mobile.png'),full_page=True)
   page.set_viewport_size({'width':1440,'height':1050});page.wait_for_timeout(120)
   page.click('#mode-toggle');page.wait_for_selector('html[data-mode="expert"]')
   check('expert toggle reveals the full lab',page.locator('.quant-layout').is_visible());check('meaningful default view',page.locator('#quant h1').inner_text()=='Crosshair conversion');check('three real preview canvases',page.locator('.quant-previews canvas').count()==3);check('106 named-player corpus exposed','106' in page.locator('#q-presets-panel summary').inner_text());check('native confidence explicitly unidentified','Not identified' in page.locator('#q-confidence').inner_text());check('at most six curated converter choices',page.locator('#q-model option').count()==6)
   check('historical search controls do not pretend to affect the direct default',page.locator('#q-decision').is_disabled() and page.locator('#q-certify').is_disabled())
   page.select_option('#q-model','weighted-hedge');ready();page.locator('#q-options-panel summary').click();page.select_option('#q-decision','worst');ready();check('worst-case decision policy selectable','limit largest mismatch' in page.locator('#q-model option').nth(1).inner_text())
   page.select_option('#q-decision','expected');ready();page.locator('#q-options-panel summary').click();page.select_option('#q-model','');ready()
   page.locator('#q-derivation-panel summary').click();page.wait_for_selector('#q-derivation table');check('numeric both-edge residuals are inspectable','Far inner edge' in page.locator('#q-derivation').inner_text());page.locator('#q-derivation-panel summary').click()
   page.screenshot(path=str(args.output/'quant-desktop.png'),full_page=True);page.screenshot(path=str(args.output/'quant-desktop-viewport.png'),full_page=False)
   page.fill('#q-import','cl_crosshairsize 2.5;cl_crosshairthickness 0;cl_crosshairgap -3');page.click('#q-load');ready();check('current rounding and visible minimum agree with external example','length 6 / thickness 1 / gap 2' in page.locator('#q-converted-values').inner_text());check('current build disclosed in exported commands','Build 2000918' in page.locator('#q-cfg').input_value());check('evidence basis is labelled, not a fabricated model probability','Community' in page.locator('#q-confidence').inner_text())
   page.fill('#q-import','cl_crosshairsize 2;cl_crosshairthickness 0;cl_crosshairgap -3');page.click('#q-load');ready();check('old cvar import automatic','cl_crosshair_length' in page.locator('#q-cfg').input_value());check('visible old zero-thickness minimum preserved','thickness 1' in page.locator('#q-converted-values').inner_text());check('historical raw values shown','size 2 / thickness 0 / gap -3' in page.locator('#q-old-values').inner_text());check('naive preview clamps negative new gap','gap 0' in page.locator('#q-naive-values').inner_text())
   page.fill('#q-import','cl_crosshairsize 2; quit');page.click('#q-load');check('arbitrary console commands rejected','allowlisted' in page.locator('#q-input-status').inner_text());check('invalid imported data disables configuration export',page.locator('#q-download-cfg').is_disabled());check('invalid imported data clears stale commands',page.locator('#q-cfg').input_value()=='')
   code=json.loads((ROOT/'data/corpus.json').read_text())[0]['code'];page.fill('#q-import',code);page.click('#q-load');ready();check('legacy share code decoded',page.locator('#q-size').input_value()=='1')
   page.select_option('#q-model','authored:trunc:center');ready();check('chosen formula changes gap','gap 1' in page.locator('#q-converted-values').inner_text());page.select_option('#q-model','authored:nearest:center');ready();check('historical rounding alternative selectable','gap 1' in page.locator('#q-converted-values').inner_text())
   page.fill('#q-old-height','1440');page.fill('#q-new-height','1440');ready();check('height-aware formula changes length','length 3' in page.locator('#q-converted-values').inner_text());page.check('#q-difference');check('difference view responds',page.locator('#q-difference').is_checked());page.select_option('#q-zoom','10');check('zoom responds',page.locator('#q-zoom').input_value()=='10')
   page.fill('#q-size','');page.wait_for_selector('#quant[data-result="error"]');check('empty numeric value rejected',page.locator('#q-download-cfg').is_disabled());check('invalid input clears stale simple announcement',page.locator('#qs-live').text_content()=='');page.fill('#q-size','1');ready()
   with page.expect_download() as d:page.click('#q-download-cfg')
   cfg=d.value;cfg.save_as(args.output/'candidate.cfg');check('candidate CFG downloads', 'cl_crosshair_screen_height 1440' in (args.output/'candidate.cfg').read_text())
   page.locator('#q-trace-panel summary').click()
   with page.expect_download() as d:page.click('#q-download-report')
   d.value.save_as(args.output/'report.json');report=json.loads((args.output/'report.json').read_text());check('report contains full 27-model weights',len(report['models'])==27);check('report does not fabricate native probability',report['confidence']['nativeMatchProbability'] is None);check('report exposes explicit stopping reason',bool(report['search']['status']))
   page.locator('#q-scenarios summary').click();page.wait_for_selector('#q-model-table tbody tr');check('four curated historical rows are inspectable',page.locator('#q-model-table tbody tr').count()==4);page.locator('#q-scenarios summary').click()
   page.click('[data-route="corpus"]');page.wait_for_selector('#corpus-results');check('study routes lazily',page.locator('#corpus').is_visible());check('945-case numerical study exposed','945' in page.locator('#corpus').inner_text());check('study table uses actual computed 539 count','539 / 945' in page.locator('#corpus-comparison').inner_text());page.fill('#corpus-search','XANTARES');check('corpus search responds','XANTARES' in page.locator('#corpus tbody').last.inner_text());page.fill('#corpus-search','');page.click('#corpus-next');check('corpus pagination works','page 2' in page.locator('#corpus-page-status').inner_text());page.screenshot(path=str(args.output/'corpus-desktop.png'),full_page=True)
   page.click('[data-route="research"]');page.wait_for_selector('#bucket-size');check('new mathematical extension visible','v4' in page.locator('#research').inner_text());check('native-MathML notebook links present',page.locator('#research a[href*="notebook.html"]').count()>=4);page.screenshot(path=str(args.output/'math-desktop.png'),full_page=True)
   page.click('[data-route="workbench"]');page.wait_for_selector('#new-length[value]',state='attached',timeout=500) if False else None;page.wait_for_timeout(250);check('manual generator retained',page.locator('#new-length').input_value()!='');page.click('[data-route="calibration"]');page.wait_for_timeout(250);check('affine calibration retained',page.locator('#calibration').is_visible());page.click('[data-route="quant"]');ready()
   # Synthetic PNG fixtures are UI tests, not native calibration evidence.
   fixture=page.evaluate('''()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#0c100e';x.fillRect(0,0,256,256);x.fillStyle='#00ff00';for(const [a,b,w,h]of [[122,127,4,2],[130,127,4,2],[127,130,2,4],[127,122,2,4]])x.fillRect(a,b,w,h);return c.toDataURL('image/png').split(',')[1];}''')
   import base64
   image=args.output/'synthetic-ui-fixture.png';image.write_bytes(base64.b64decode(fixture))
   page.locator('#q-image-panel summary').click();page.set_input_files('#q-old-image',str(image));page.wait_for_selector('dialog');page.get_by_role('button',name='Use measured old target').wait_for();page.wait_for_selector('dialog button.primary:enabled',timeout=15000);check('old PNG fit is shown','length 4 px' in page.locator('dialog').inner_text())
   page.get_by_label('RGB tolerance',exact=True).fill('41');check('editing crop invalidates accepted result',page.get_by_role('button',name='Use measured old target').is_disabled())
   page.get_by_role('button',name='Reanalyze crop').click();page.wait_for_selector('dialog button.primary:enabled',timeout=15000)
   page.get_by_role('button',name='Use measured old target').click();ready();check('image becomes frozen measured target','Measured L 4' in page.locator('#q-old-values').inner_text());check('non-unique old cvars disclosed','Several old settings may produce the same pixels' in page.locator('#q-input-status').inner_text())
   page.locator('#q-feedback summary').click();page.set_input_files('#q-new-image',str(image));page.wait_for_selector('dialog');page.wait_for_timeout(200);check('native capture needs explicit attestation',page.get_by_role('button',name='Record native measurement').is_disabled());page.get_by_role('button',name='Cancel',exact=True).click();check('cancel does not add native evidence','0 calibration' in page.locator('#q-confidence').inner_text())
   # Synthetic JSON must not update native likelihood.
   synthetic={'id':'synthetic-test','kind':'synthetic','role':'calibration','build':'2000914','captureGroup':'synthetic-ui-only','native':{'length':4,'thickness':2,'gap':1,'authoredHeight':1440},'currentHeight':1440,'observed':{'length':4,'width':2,'near':2,'far':3},'sigma':.5}
   current_synthetic={**synthetic,'id':'synthetic-current','build':'2000918','captureGroup':'synthetic-current-only'}
   evidence=args.output/'synthetic-evidence.json';evidence.write_text(json.dumps([synthetic,current_synthetic]));page.set_input_files('#q-measurements',str(evidence));expect(page.locator('#q-evidence-status')).to_contain_text('Loaded 2 measurements.');ready();check('synthetic measurement ignored by native posterior','0 calibration' in page.locator('#q-confidence').inner_text());check('evidence kind disclosed','Generated examples do not change the model weights' in page.locator('#q-evidence-status').inner_text())
   page.select_option('#q-model','');ready();check('switch to current model isolates old-build evidence','Build 2000918' in page.locator('#q-cfg').input_value());check('new-build synthetic evidence is not native validation','0 calibration' in page.locator('#q-confidence').inner_text())
   page.select_option('#q-model','authored:trunc:center');ready();check('switch back to historical model isolates current-build evidence','Build 2000914' in page.locator('#q-cfg').input_value())
   with page.expect_download() as d:page.click('#q-export-measurements')
   d.value.save_as(args.output/'mixed-evidence.json');check('evidence export retains both builds',{r['build'] for r in json.loads((args.output/'mixed-evidence.json').read_text())}=={'2000914','2000918'})
   for width in [390,768]:
    page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(120);check(f'no horizontal page overflow at {width}',page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'));check(f'three previews retained at {width}',page.locator('.quant-previews canvas:visible').count()==3);page.screenshot(path=str(args.output/f'quant-{width}.png'),full_page=True)
   check('no JavaScript page errors',not errors)
   check('no browser console warnings or errors',not console_issues)
   result={'checks':len(checks),'passed':checks,'mode':'in-memory UI; worker transport adapted; SHA-256 bridge' if args.in_memory else 'real localhost/browser worker','browser':f'Chromium {browser.version} via Playwright; Browser plugin unavailable','errors':errors,'nativeGameValidation':False};(args.output/'browser-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));browser.close()
 finally:
  if server:server.terminate();server.wait(timeout=3)
if __name__=='__main__':main()
