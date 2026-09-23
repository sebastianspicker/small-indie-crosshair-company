"""Offline UI fixture harness for managed Chromium that blocks navigation/workers.

Uses only repository-owned source files. Worker transport is explicitly adapted
to async same-thread calls; production worker entry is tested independently in
node:worker_threads. Secure-origin SHA-256 can use a Python hashlib test bridge.
This does not test HTTP navigation, CSP enforcement, native browser Worker
startup or browser WebCrypto. Do not claim those passed from this harness.
"""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[1]
def mount(page, start_route="quant", crypto_bridge=False):
 html=(ROOT/'index.html').read_text()
 html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
 html=re.sub(r'<link\b[^>]*>','',html)
 html=re.sub(r'<meta\b[^>]*http-equiv[^>]*>','',html)
 page.set_content(html);page.evaluate('(route)=>{location.hash=route}',start_route);page.add_style_tag(content=(ROOT/'app/styles.css').read_text());page.add_style_tag(content=(ROOT/'app/quant.css').read_text())
 if crypto_bridge:
  # about:blank is not a secure context. Python hashlib is test transport only.
  import hashlib
  page.expose_function('siccTestSHA256', lambda values:list(hashlib.sha256(bytes(values)).digest()))
  page.evaluate("()=>Object.defineProperty(crypto,'subtle',{value:{digest:async(name,bytes)=>new Uint8Array(await window.siccTestSHA256([... (ArrayBuffer.isView(bytes)?new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength):new Uint8Array(bytes))])).buffer},configurable:true})")
 data={p.name:json.loads(p.read_text()) for p in (ROOT/'data').glob('*.json')}
 page.evaluate('''data=>{window.fetch=async input=>{const key=String(input).split('/').pop();if(key in data)return new Response(JSON.stringify(data[key]),{status:200,headers:{'Content-Type':'application/json'}});throw Error('Unexpected fetch in local test harness '+input);};}''',data)
 urls={}
 static=re.compile(r"((?:\bfrom\s*|\bimport\s*)[\"'])(\.{1,2}/[^\"']+)([\"'])")
 dynamic=re.compile(r"(\bimport\s*\(\s*[\"'])(\.{1,2}/[^\"']+)([\"']\s*\))")
 def module(path):
  path=path.resolve()
  if path in urls:return urls[path]
  s=path.read_text()
  if path.name=='worker-client.js':
   # UI testing transport only: managed Chromium blocks native Workers as well as all navigations.
   # Same source algorithms; actual worker event transport tested separately with node:worker_threads.
   s="""import {infer} from '../lib/quant/inference.js';import {analyzeScreenshot,analyzeNativeScreenshot} from '../lib/quant/screenshot.js';
export class ResearchWorker{constructor(records){this.records=records;this.ready=Promise.resolve();} async call(type,payload){await new Promise(r=>setTimeout(r,0));return type==='infer'?infer({...payload,records:this.records}):type==='screenshot'?analyzeScreenshot(payload):analyzeNativeScreenshot(payload);} close(){}}"""

  s=static.sub(lambda m:m[1]+module(path.parent/m[2])+m[3],s)
  s=dynamic.sub(lambda m:m[1]+module(path.parent/m[2])+m[3],s)
  if path.name=='worker-client.js':
   s=s.replace("new URL('./quant-worker.js',import.meta.url)",json.dumps(module(path.parent/'quant-worker.js')))
  s=s.replace('import.meta.url',json.dumps('https://sicc.invalid/'+str(path.relative_to(ROOT))))
  url=page.evaluate("s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}))",s);urls[path]=url;return url
 page.evaluate('async url=>{await import(url)}',module(ROOT/'app/main.js'))
