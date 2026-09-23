import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchWorker } from '../app/worker-client.js';
class FakeWorker {
 sent=[];terminated=false;
 postMessage(message){if(this.failPost){this.failPost=false;throw new DOMException('bad clone','DataCloneError');}this.sent.push(message);}
 reply(result={ready:true}){this.onmessage({data:{id:this.sent.at(-1).id,result}});}
 terminate(){this.terminated=true;}
}
async function fixture(){const worker=new FakeWorker(),client=new ResearchWorker([],{factory:()=>worker});worker.reply();await client.ready;return{worker,client};}
test('only newest queued inference survives while active work remains coherent',async()=>{
 const {worker,client}=await fixture();const first=client.call('infer',{v:1}),old=client.call('infer',{v:2});
 const oldRejected=assert.rejects(old,{name:'AbortError'}),latest=client.call('infer',{v:3});
 assert.equal(worker.sent.length,2);await oldRejected;worker.reply('one');assert.equal(await first,'one');
 assert.equal(worker.sent.at(-1).payload.v,3);worker.reply('three');assert.equal(await latest,'three');client.close();
});
test('postMessage cloning failures release active request and the following call works',async()=>{
 const {worker,client}=await fixture();worker.failPost=true;await assert.rejects(client.call('infer',{}),/bad clone/);
 const next=client.call('infer',{});worker.reply('ok');assert.equal(await next,'ok');client.close();
});
test('decode failure terminates worker, rejects pending calls and prevents future work',async()=>{
 const {worker,client}=await fixture();const task=client.call('infer',{}),rejected=assert.rejects(task,/decoded/);
 worker.onmessageerror();await rejected;assert.ok(worker.terminated);await assert.rejects(client.call('infer',{}),/closed/);
});
test('queued image work is bounded and closure settles all requests',async()=>{
 const {worker,client}=await fixture(),pending=[];
 for(let i=0;i<9;i++)pending.push(client.call('screenshot',{}).catch(x=>x.message));
 await assert.rejects(client.call('screenshot',{}),/queue is full/);client.close();
 assert.ok((await Promise.all(pending)).every(x=>x.includes('closed')));assert.ok(worker.terminated);
});
test('a hard deadline terminates computation rather than only forgetting the promise',async()=>{
 const worker=new FakeWorker(),client=new ResearchWorker([],{factory:()=>worker,deadline:15});worker.reply();await client.ready;
 await assert.rejects(client.call('infer',{}),/deadline/);assert.ok(worker.terminated);client.close();
});
test('unexpected response IDs fail closed',async()=>{
 const {worker,client}=await fixture(),task=client.call('infer',{}),rejected=assert.rejects(task,/Unexpected/);
 worker.onmessage({data:{id:99,result:{}}});await rejected;assert.ok(worker.terminated);
});
