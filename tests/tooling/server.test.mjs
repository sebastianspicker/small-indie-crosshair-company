import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, symlink, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root=fileURLToPath(new URL('../..',import.meta.url));
const port=23000+Math.floor(Math.random()*18000),base=`http://127.0.0.1:${port}`;
let server,publicTemp,privateTemp;
before(async()=>{
  server=spawn(process.execPath,['scripts/serve.mjs','--port',String(port)],{cwd:root,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Static server startup timeout')),5000);
    server.once('error',reject);server.once('exit',code=>{if(code!==null&&code!==0)reject(new Error(`Server exited ${code}`));});
    server.stdout.on('data',data=>{if(String(data).includes('Serving')){clearTimeout(timer);resolve();}});
  });
  publicTemp=await mkdtemp(join(root,'public/http-test-'));
  privateTemp=await mkdtemp(join(tmpdir(),'sicc-http-private-'));
  await symlink(join(root,'package.json'),join(publicTemp,'internal.json'));
  await symlink('/etc/hosts',join(publicTemp,'external.txt'));
});
after(async()=>{
  if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}
  await rm(publicTemp??'/nonexistent-sicc-test-dir',{force:true,recursive:true});
  await rm(privateTemp??'/nonexistent-sicc-test-private-dir',{force:true,recursive:true});
});

function rawRequest(path,options={}) {
  return new Promise((resolve,reject)=>{
    const request=http.request({host:'127.0.0.1',port,path,method:options.method??'GET',headers:options.headers??{}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));
    });request.on('error',reject);request.end();
  });
}

test('HTTP root serves actual HTML',async()=>{
  const res=await fetch(base);assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/html/);
  assert.match(await res.text(),/Small Indie Crosshair Company/);
});
test('HTTP headers are restrictive without inline/eval allowance',async()=>{
  const res=await fetch(base),policy=res.headers.get('content-security-policy');
  assert.match(policy,/script-src 'self'/);assert.match(policy,/frame-ancestors 'none'/);assert.doesNotMatch(policy,/unsafe-inline|unsafe-eval/);
  assert.equal(res.headers.get('x-content-type-options'),'nosniff');assert.equal(res.headers.get('referrer-policy'),'no-referrer');
});
test('HTTP JSON fixture matches source payload',async()=>{
  const res=await fetch(base+'/data/presets.json');assert.match(res.headers.get('content-type'),/application\/json/);
  assert.deepEqual(await res.json(),JSON.parse(await readFile(join(root,'data/presets.json'),'utf8')));
});
test('HTTP module has correct MIME type',async()=>{
  const res=await fetch(base+'/lib/geometry/legacy.js');assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/javascript/);
});
test('converter entry uses a URL that avoids the ad-block rule',async()=>{
  const main=await(await fetch(base+'/app/main.js')).text();assert.match(main,/import\('\.\/convert\/converter\.js'\)/);assert.doesNotMatch(main,/quant\.js/);
  const entry=await fetch(base+'/app/convert/converter.js');assert.equal(entry.status,200);assert.match(entry.headers.get('content-type'),/text\/javascript/);
  assert.equal((await fetch(base+'/app/quant.js')).status,404);
});
test('HTTP styles are served without API dependencies',async()=>{
  const res=await fetch(base+'/app/styles.css');assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/css/);
});
test('HTTP HEAD carries length without payload',async()=>{
  const res=await rawRequest('/index.html',{method:'HEAD'});assert.equal(res.status,200);assert.equal(res.body,'');assert.ok(Number(res.headers['content-length'])>0);
});
test('HTTP POST is refused',async()=>{
  const res=await rawRequest('/',{method:'POST'});assert.equal(res.status,405);assert.equal(res.headers.allow,'GET, HEAD');
});
test('HTTP untrusted Host is refused',async()=>{
  const res=await rawRequest('/',{headers:{Host:'attacker.invalid'}});assert.equal(res.status,403);
});
for(const path of ['/package.json','/.git/config','/scripts/serve.mjs','/tests/lib/core.test.mjs','/%00','/%5Cetc%5Cpasswd','/%ZZ','/app/../../package.json','/app/%2e%2e/%2e%2e/package.json','/research/scripts/corpus.mjs']) {
  test(`HTTP rejects non-public or malformed path ${path}`,async()=>assert.equal((await rawRequest(path)).status,404));
}
test('HTTP refuses within-root symlink to private source',async()=>assert.equal((await fetch(base+'/public/'+publicTemp.split('/').pop()+'/internal.json')).status,404));
test('HTTP refuses outside-root symlink',async()=>assert.equal((await fetch(base+'/public/'+publicTemp.split('/').pop()+'/external.txt')).status,404));
test('HTTP research and documentation are readable',async()=>{
  for(const path of ['/docs/math/01-legacy-geometry.md','/docs/engineering/testing.md','/LICENSE','/THIRD_PARTY_NOTICES.md','/licenses/akiver-MIT.txt']){
    const res=await fetch(base+path);assert.equal(res.status,200,path);assert.match(res.headers.get('content-type'),/text\/plain/);
  }
});
test('Pages HTML contains worker-compatible meta CSP without unsupported frame-ancestors',async()=>{
  const text=await(await fetch(base)).text();const meta=text.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);assert.ok(meta);assert.match(meta[1],/worker-src 'self'/);assert.doesNotMatch(meta[1],/frame-ancestors|unsafe-inline|unsafe-eval/);
});
test('quant worker and research CSV have safe usable MIME types',async()=>{
  const w=await fetch(base+'/app/worker/worker.js');assert.equal(w.status,200);assert.match(w.headers.get('content-type'),/text\/javascript/);assert.match(w.headers.get('content-security-policy'),/worker-src 'self'/);
  const c=await fetch(base+'/research/generated/quant-study.csv');assert.equal(c.status,200);assert.match(c.headers.get('content-type'),/text\/csv/);
});
test('HTTP rejects unbounded request targets',async()=>assert.equal((await rawRequest('/?q='+'a'.repeat(2050))).status,414));
test('HTTP hardened header policy also applies to worker responses',async()=>{
 const response=await fetch(base+'/app/worker/worker.js');assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.match(response.headers.get('content-security-policy'),/connect-src 'self'/);
});
