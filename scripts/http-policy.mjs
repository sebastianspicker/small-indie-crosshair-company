import { realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep, relative } from 'node:path';
import { isPublishedPath } from './site-files.mjs';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml',
  '.json':'application/json', '.md':'text/plain', '.csv':'text/csv', '.tsv':'text/tab-separated-values', '.txt':'text/plain',
  '.py':'text/plain', '.png':'image/png', '.ico':'image/x-icon' };
const isPublic = isPublishedPath;
export const HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'no-referrer',
  'Cross-Origin-Resource-Policy':'same-origin', 'Permissions-Policy':'camera=(), microphone=(), geolocation=()', 'Cache-Control':'no-cache',
});
export function validateRequest(req) {
  if (!['GET','HEAD'].includes(req.method)) return {status:405,message:'Read-only static server.',headers:{Allow:'GET, HEAD'}};
  if (!['127.0.0.1','localhost','[::1]'].includes((req.headers.host ?? '').replace(/:\d+$/,''))) return {status:403,message:'Local host only.'};
  if (req.url.length > 2048) return {status:414,message:'Request target too long.'};
  return null;
}
export async function resolvePublic(root, url) {
  const path = decodeURIComponent(new URL(url,'http://localhost').pathname);
  if(path.includes('\0')||path.includes('\\')||path.split('/').some(p=>p.startsWith('.'))) throw new Error('Forbidden path.');
  const requested = path==='/'?'index.html':path.slice(1);
  if(!isPublic(requested)) throw new Error('Private path.');
  const file=await realpath(resolve(root,requested)),rel=relative(root,file).split(sep).join('/');
  if(!file.startsWith(root+sep)||!isPublic(rel)||!(await stat(file)).isFile()) throw new Error('Not a public file.');
  const mime=MIME[extname(file)] ?? (rel==='LICENSE'?'text/plain':null);
  if(!mime)throw new Error('Unsupported asset type.');
  return {file,mime};
}
