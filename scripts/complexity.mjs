#!/usr/bin/env node
/** Optional source audit using the Acorn parser already bundled with Node 22.
 * Run with --expose-internals. Not used in the app, worker, build or deployment.
 */
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
const require = createRequire(import.meta.url);
const { parse, version } = require('internal/deps/acorn/acorn/dist/acorn');
const functions = new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression']);
const branches = new Set(['IfStatement','ConditionalExpression','ForStatement','ForInStatement','ForOfStatement','WhileStatement','DoWhileStatement','CatchClause','LogicalExpression']);
const children = node => Object.entries(node).filter(([key])=>!['loc','start','end'].includes(key)).flatMap(([,value])=>Array.isArray(value)?value:value&&typeof value==='object'?[value]:[]).filter(x=>x?.type);
function decisions(node) {
 let count = 0;
 for(const child of children(node)) {
  if(functions.has(child.type)) continue;
  count += Number(branches.has(child.type) || (child.type==='SwitchCase' && child.test!==null) || child.optional===true);
  count += decisions(child);
 }
 return count;
}
async function inventory(root) {
 const rows=[];
 async function walk(path) {
  for(const e of await readdir(path,{withFileTypes:true})) {
   const full=join(path,e.name);
   if(e.isDirectory()) { await walk(full); continue; }
   if(!/\.m?js$/.test(e.name))continue;
   const text=await readFile(full,'utf8'),ast=parse(text,{ecmaVersion:'latest',sourceType:'module',locations:true});
   function visit(node,parent=null) {
    if(functions.has(node.type))rows.push({file:relative(root,full),line:node.loc.start.line,
     name:node.id?.name??parent?.key?.name??parent?.id?.name??'<callback>',complexity:1+decisions(node)});
    for(const child of children(node))visit(child,node);
   }
   visit(ast);
  }
 }
 for(const folder of ['app','lib','scripts'])await walk(join(root,folder));
 rows.sort((a,b)=>b.complexity-a.complexity);
 const values=rows.map(x=>x.complexity).sort((a,b)=>a-b);
 return {functionCount:rows.length,totalDecisions:values.reduce((a,b)=>a+b-1,0),maximum:values.at(-1),
  functionsAbove20:values.filter(x=>x>20).length,p95:values[Math.floor(.95*(values.length-1))],functions:rows};
}
const args=process.argv.slice(2),roots=args.filter(x=>!x.startsWith('--'));
const report={schema:'sicc-source-complexity-v1',parser:`Node bundled Acorn ${version}`,runtime:process.version,
 definition:'Per-function 1 + if/conditional/loop/catch/logical/switch-case/optional branches. Nested functions excluded from parent. AST decision-count proxy, not a full control-flow graph proof.',
 results:await Promise.all((roots.length?roots:['.']).map(async path=>({root:resolve(path),...await inventory(resolve(path))})))};
if(args.includes('--save'))await writeFile('research/generated/complexity-local.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
