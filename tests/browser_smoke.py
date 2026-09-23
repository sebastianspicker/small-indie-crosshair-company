#!/usr/bin/env python3
"""Optional browser integration checks. Requires Python Playwright and Chromium.

Normal mode uses the actual localhost server. --in-memory uses about:blank plus
local-source blob modules without network/navigation, for managed browsers that
block all URLs. That mode verifies DOM/JS/CSS, NOT delivery headers/navigation.
"""
from pathlib import Path
import argparse
import json
import re
import shutil
import subprocess
import time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


def mount_local_sources(page):
    from browser_harness import mount
    mount(page, start_route='workbench', crypto_bridge=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--in-memory',action='store_true')
    parser.add_argument('--output',type=Path,default=ROOT/'test-results/browser')
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    process=None;results=[]
    def check(name,condition):
        assert condition,name
        results.append(name)
    try:
        if not args.in_memory:
            process=subprocess.Popen(['node','scripts/serve.mjs','--port','4175'],cwd=ROOT,stdout=subprocess.DEVNULL)
            time.sleep(.7)
        with sync_playwright() as p:
            executable=shutil.which('chromium') or shutil.which('chromium-browser')
            browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
            context=browser.new_context(viewport={'width':1440,'height':1150},device_scale_factor=1,accept_downloads=True)
            page=context.new_page();errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            if args.in_memory:mount_local_sources(page)
            else:page.goto('http://127.0.0.1:4175/#workbench',wait_until='networkidle')
            page.wait_for_selector('html[data-ready=true]')
            check('boot completes',page.locator('html').get_attribute('data-ready')=='true')
            check('donk default candidate',page.locator('#new-length').input_value()=='2' and page.locator('#new-thickness').input_value()=='2' and page.locator('#new-gap').input_value()=='0')
            page.screenshot(path=str(args.output/'workbench-desktop.png'),full_page=True)
            page.select_option('#preset',label='ZywOo · 2026-09-04')
            check('zero-thickness fixture preserved',page.locator('#new-thickness').input_value()=='0')
            page.select_option('#preset',label='donk · 2026-08-31')
            page.select_option('#gap-model','center')
            check('alternate gap hypothesis changes candidate',page.locator('#new-gap').input_value()=='1')
            page.fill('#new-length','6')
            check('manual candidate updates commands','cl_crosshair_length 6' in page.locator('#cfg-output').input_value())
            check('manual status disclosed','Manually edited' in page.locator('#candidate-mode').inner_text())
            page.click('#use-conversion')
            check('reset candidate restores formula',page.locator('#new-length').input_value()=='2')
            page.locator('.import-box summary').click()
            page.fill('#legacy-import','cl_crosshairsize 2; quit')
            page.click('#import-legacy')
            check('script injection rejected','allowlisted' in page.locator('#import-status').inner_text())
            page.fill('#legacy-import','cl_crosshairsize 2;cl_crosshairgap -3;cl_crosshairthickness 0.5')
            page.click('#import-legacy')
            check('data-only config imported',page.locator('#new-length').input_value()=='4')
            page.fill('#old-size','1000')
            check('unrepresentable range disclosed','outside' in page.locator('#warnings').inner_text())
            page.click('#reset')
            page.fill('#old-size','')
            check('empty input disables export',page.locator('#download-cfg').is_disabled())
            page.set_viewport_size({'width':1430,'height':1140});page.wait_for_timeout(150)
            check('empty input remains blocked after resize',page.locator('#download-cfg').is_disabled())
            page.click('#reset');page.set_viewport_size({'width':1440,'height':1150})
            with page.expect_download() as info:page.click('#download-cfg')
            check('candidate downloads as cfg',info.value.suggested_filename.endswith('.cfg'))
            downloaded=Path(info.value.path()).read_text()
            check('download carries model warning','not an exact-match certificate' in downloaded)
            with page.expect_download() as info:page.click('#download-report')
            report=json.loads(Path(info.value.path()).read_text())
            check('math report contains provenance and residuals',report['schema']=='sicc-report-v1' and report['result']['status']=='conditional-not-game-validated')
            page.click('[data-route=research]');page.wait_for_timeout(100)
            check('math notebook visible',page.locator('#research').is_visible())
            page.fill('#bucket-size','4')
            check('bucket explorer computes 9px','9px' in page.locator('#bucket-result').inner_text())
            page.screenshot(path=str(args.output/'mathematics-desktop.png'),full_page=True)
            page.click('[data-route=evidence]');page.wait_for_timeout(100)
            check('audit has 56 rows',page.locator('#evidence table').last.locator('tbody tr').count()==56)
            page.select_option('#audit-filter','karrigan')
            check('audit filter has seven heights',page.locator('#evidence table').last.locator('tbody tr').count()==7)
            page.get_by_role('button',name='Re-run audit',exact=True).click()
            check('audit recomputes locally','56' in page.locator('#audit-status').inner_text())
            page.screenshot(path=str(args.output/'evidence-desktop.png'),full_page=True)
            page.click('[data-route=calibration]');page.wait_for_timeout(100)
            page.click('#cal-fit')
            check('empty measurements not invented','decimal' in page.locator('#cal-result').inner_text())
            page.get_by_role('button',name='Load synthetic example',exact=True).click();page.click('#cal-fit')
            check('synthetic example clearly labeled','SYNTHETIC' in page.locator('#cal-provenance').inner_text())
            check('affine fit computes expected intercept','pixels = 1 + 1' in page.locator('#cal-result').inner_text())
            with page.expect_download() as info:page.click('#cal-export')
            measurement=json.loads(Path(info.value.path()).read_text())
            check('measurement export cannot masquerade as native evidence',measurement['provenance']=='synthetic-example')
            page.screenshot(path=str(args.output/'calibration-desktop.png'),full_page=True)
            page.click('#cal-apply');page.wait_for_timeout(100)
            check('scoped gap fit applies in workbench',page.locator('#gap-model').input_value()=='measured')
            with page.expect_download() as info:page.click('#download-report')
            scoped=json.loads(Path(info.value.path()).read_text())
            check('applied fit retains synthetic provenance',scoped['calibration']['provenance']=='synthetic-example')
            page.fill('#current-height','1440')
            check('stale measured scope disables export',page.locator('#download-cfg').is_disabled())
            page.fill('#current-height','1080')
            check('restoring scope allows export',not page.locator('#download-cfg').is_disabled())
            page.select_option('#gap-model','thickness')
            page.fill('#new-length','')
            page.set_viewport_size({'width':1430,'height':1140});page.wait_for_timeout(100)
            check('empty native candidate fails closed after resize',page.locator('#download-cfg').is_disabled())
            page.click('#reset');page.set_viewport_size({'width':1440,'height':1150})
            page.click('[data-route=calibration]');page.wait_for_timeout(100)
            page.set_input_files('#cal-import',{'name':'hostile.json','mimeType':'application/json','buffer':b'{"schema":"sicc-measurement-v1","provenance":"verified"}'})
            page.wait_for_timeout(100)
            check('invalid measurement provenance rejected','Unknown' in page.locator('#cal-status').inner_text() or 'verified' in page.locator('#cal-status').inner_text())
            # Upload a synthetic lossless capture strictly as a UI test, not as game evidence.
            try:
                from PIL import Image
                import io
                b=io.BytesIO();Image.new('RGB',(192,192),(42,100,80)).save(b,format='PNG')
                page.set_input_files('#screenshot-file',{'name':'synthetic-ui-fixture.png','mimeType':'image/png','buffer':b.getvalue()});page.wait_for_timeout(100)
                check('PNG dimensions inspected locally','192 × 192' in page.locator('#screenshot-info').inner_text())
                page.locator('#screenshot-canvas').click(position={'x':100,'y':100})
                check('pixel coordinates inspectable','Cell (' in page.locator('#screenshot-info').inner_text())
            except ImportError:results.append('PNG UI check skipped: Pillow not installed')
            page.click('[data-route=workbench]');page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
            check('mobile workbench has no page overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            page.screenshot(path=str(args.output/'workbench-mobile.png'),full_page=True)
            for tab in ['research','evidence','calibration']:
                page.click(f'[data-route={tab}]');page.wait_for_timeout(50)
                check(f'mobile {tab} has no page overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            check('no uncaught browser errors',not errors)
            browser.close()
    finally:
        if process:process.terminate();process.wait(timeout=5)
    summary={'mode':'in-memory-local-sources' if args.in_memory else 'localhost-production-files',
      'checks':len(results),'passed':results,'limitations':'In-memory mode does not validate HTTP navigation or CSP delivery. PNG fixture is synthetic. No CS2 client was run.'}
    (args.output/'results.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))

if __name__=='__main__':main()
