import test from'node:test';import assert from'node:assert/strict';import{Worker}from'node:worker_threads';import{readFile}from'node:fs/promises';
// Real worker thread tests the shipped worker entry with a self/postMessage transport adapter.
// This is NOT a claim that browser HTTP worker loading/CSP passed in the managed browser.
test('worker entry initializes, computes, transfers image masks, and returns bounded errors',async()=>{
 const workerURL=new URL('../app/quant-worker.js',import.meta.url).href;
 const w=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:(message,transfer)=>parentPort.postMessage(message,transfer)};import(${JSON.stringify(workerURL)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});
 let id=0;const call=(type,payload)=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(new Error('worker timeout')),5000);const listen=r=>{if(r.id===n){clearTimeout(timer);w.off('message',listen);resolve(r);}};w.on('message',listen);w.postMessage({id:n,type,payload});});
 try{const records=JSON.parse(await readFile(new URL('../data/corpus.json',import.meta.url),'utf8'));assert.match((await call('infer',{settings:records[0]})).error,/not initialized/);assert.equal((await call('init',records)).result.ready,true);assert.match((await call('init',records)).error,/already initialized/);assert.match((await call('constructor',{})).error,/Unknown/);const res=(await call('infer',{settings:records[0]})).result;assert.equal(res.models.length,27);assert.equal(res.confidence.nativeMatchProbability,null);assert.match((await call('invalid',{})).error,/Unknown/);
 const{raster}=await import('../lib/raster.js');const g={length:3,width:2,near:2,far:3},mask=raster(g,{},129),bytes=new Uint8ClampedArray(129*129*4);mask.data.forEach((v,i)=>bytes.set(v?[0,255,0,255]:[0,0,0,255],i*4));const fit=(await call('screenshot',{data:bytes,side:129,seed:[0,255,0]})).result;assert.equal(fit.templateIou,1);assert.ok(fit.mask.data instanceof Uint8Array);assert.deepEqual(fit.geometry,g);
 }finally{await w.terminate();}
});
