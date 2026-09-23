#!/usr/bin/env python3
"""Capture the README tour from a running app using real browser workers.

Requires optional Python Playwright. Start `npm run dev` first. Use --base-url
for a built site or a Pages repository URL. No in-memory transport is used.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:4173/')
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/screenshots')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    base = args.base_url.rstrip('/') + '/'
    errors, external = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1050}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('request', lambda request: external.append(request.url)
                if urlsplit(request.url).scheme in ('http', 'https')
                and urlsplit(request.url).netloc != urlsplit(base).netloc else None)
        page.goto(base, wait_until='networkidle')
        page.wait_for_selector('#quant[data-result="ready"]')
        assert 'Small Indie Crosshair Company' in page.title()
        assert page.locator('.quant-previews canvas').count() == 3
        page.screenshot(path=str(args.output / 'converter.png'))

        page.click('[data-route="corpus"]')
        page.wait_for_selector('#corpus-records')
        page.locator('#corpus-records').evaluate('(element) => element.scrollIntoView({block: "start", behavior: "instant"})')
        page.screenshot(path=str(args.output / 'settings.png'))
        page.fill('#corpus-search', 'XANTARES')
        assert 'XANTARES' in page.locator('#corpus tbody').last.inner_text()

        page.goto(base + 'docs/notebook.html', wait_until='networkidle')
        assert page.locator('math').count() > 0
        page.locator('#chapter-1 h3').filter(has_text='Continuous scale').evaluate('(element) => window.scrollTo({top: element.getBoundingClientRect().top + window.scrollY - 40, behavior: "instant"})')
        page.screenshot(path=str(args.output / 'notebook.png'))

        page.set_viewport_size({'width': 390, 'height': 844})
        page.goto(base, wait_until='networkidle')
        page.wait_for_selector('#quant[data-result="ready"]')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.screenshot(path=str(args.output / 'mobile.png'), full_page=True)
        assert not errors, errors
        assert not external, external
        browser_version = browser.version
        browser.close()
    print(json.dumps({'baseURL': base, 'viewports': ['1440x1050', '390x844'],
                      'screenshots': ['converter.png', 'settings.png', 'notebook.png', 'mobile.png'],
                      'pageErrors': errors, 'externalRequests': external, 'browser': browser_version,
                      'transport': 'HTTP with production browser worker', 'nativeGameCapture': False}, indent=2))


if __name__ == '__main__':
    main()
