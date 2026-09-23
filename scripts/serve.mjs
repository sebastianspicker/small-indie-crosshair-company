#!/usr/bin/env node
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADERS, validateRequest, resolvePublic } from './http-policy.mjs';
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)),process.argv.includes('--dist')?'dist':'.');
const index=process.argv.indexOf('--port'),port=Number(index>=0?process.argv[index+1]:process.env.PORT??4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Port must be an integer from 1024 to 65535.');
const server=http.createServer({maxHeaderSize:8192,headersTimeout:5000,requestTimeout:5000},async(req,res)=>{
  for(const [key,value] of Object.entries(HEADERS))res.setHeader(key,value);
  const blocked=validateRequest(req);
  if(blocked){res.writeHead(blocked.status,blocked.headers);res.end(blocked.message);return;}
  try{
    const {file,mime}=await resolvePublic(ROOT,req.url),bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Content-Length':bytes.length});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found.');}
});
server.keepAliveTimeout=2000;server.maxRequestsPerSocket=100;server.maxConnections=32;
server.listen(port,'127.0.0.1',()=>console.log(`Small Indie Crosshair Company: http://127.0.0.1:${port}\nServing ${ROOT}\nLocal development/preview server; not an internet-facing production server.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
