import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const script=path.join(root,'scripts','v2-variants.mjs');
const runName='m4-test-'+process.pid+'-'+Date.now();
const runFolder=path.join(root,'work',runName+'-a4');
const run=(...args)=>spawnSync(process.execPath,[script,...args],{cwd:root,encoding:'utf8'});

try{
 const first=run('--format','A4','--name',runName);
 assert.equal(first.status,0,first.stderr||first.stdout);
 const result=JSON.parse(first.stdout.trim());
 assert.equal(result.folder,'work/'+runName+'-a4');
 assert.equal(result.index,result.folder+'/index.html');
 assert.equal(result.variants.length,5);
 assert.equal(new Set(result.variants.map(variant=>variant.material_id)).size,5);
 assert.match(result.hint,/refresh the poster tab/i);
 assert.doesNotMatch(result.hint,/refresh the index tab/i);
 assert.match(result.hint,/complete html:pdf command/i);

 const index=fs.readFileSync(path.join(runFolder,'index.html'),'utf8');
 assert.equal((index.match(/target="_blank"/g)||[]).length,5);
 assert.doesNotMatch(index,/<iframe\b/i);
 assert.doesNotMatch(index,/data:image\//i);
 assert.match(index,/edit its <code>poster\.html<\/code>, then refresh the poster tab/);
 assert.doesNotMatch(index,/refresh this tab to see the current file/);
 assert.match(index,/Click a PDF command to select the whole line for copying/);
 assert.equal(index.includes('src:url("../../assets/fonts/Figtree-450.ttf")'),true);
 assert.equal((index.match(/No preview yet — run v2:check/g)||[]).length,5);
 for(const composition of ['c1','c2','c3','c4','c5']){
  assert.equal(index.includes('href="'+composition+'/poster.html" target="_blank"'),true);
  assert.equal(index.includes('npm run html:pdf -- --html work/'+runName+'-a4/'+composition+'/poster.html'),true);
  assert.equal(index.includes('<span class="path" style="white-space:nowrap;overflow-x:auto;overflow-wrap:normal;max-width:100%">work/'+runName+'-a4/'+composition+'/poster.html</span>'),true);
  assert.equal(index.includes('<code tabindex="0" title="Click to select the complete command" style="white-space:nowrap;overflow-x:auto;overflow-wrap:normal;max-width:100%;user-select:all;cursor:text">npm run html:pdf -- --html work/'+runName+'-a4/'+composition+'/poster.html</code>'),true);
  const poster=path.join(runFolder,composition,'poster.html');
  const metadata=JSON.parse(fs.readFileSync(path.join(runFolder,composition,'sandbox-print.json'),'utf8'));
  assert.equal(metadata.composition,composition.toUpperCase());
  assert.equal(metadata.format,'A4');
  assert.match(metadata.material_id,new RegExp('^'+runName+'-a4-'+composition+'$'));
  assert.equal(fs.existsSync(poster),true);
 }

 const preserved=fs.readFileSync(path.join(runFolder,'index.html'));
 const second=run('--format','A4','--name',runName);
 assert.notEqual(second.status,0);
 assert.match(second.stderr,/Working folder already exists/);
 assert.deepEqual(fs.readFileSync(path.join(runFolder,'index.html')),preserved);
}finally{
 fs.rmSync(runFolder,{recursive:true,force:true});
}

const rollbackName='m4-rollback-'+process.pid+'-'+Date.now();
const rollbackFolder=path.join(root,'work',rollbackName+'-a4');
const rollback=await new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[script,'--format','A4','--name',rollbackName],{cwd:root,encoding:'utf8'});
 let stdout='',stderr='',sabotaged=false;
 const timer=setInterval(()=>{
  const firstVariant=path.join(rollbackFolder,'c1');
  const secondVariant=path.join(rollbackFolder,'c2');
  if(!sabotaged&&fs.existsSync(firstVariant)){
   fs.mkdirSync(secondVariant);
   sabotaged=true;
  }
 },1);
 child.stdout.on('data',chunk=>{stdout+=chunk;});
 child.stderr.on('data',chunk=>{stderr+=chunk;});
 child.once('error',reject);
 child.once('close',(status,signal)=>{clearInterval(timer);resolve({status,signal,stdout,stderr,sabotaged});});
});
try{
 assert.equal(rollback.sabotaged,true,'rollback test did not fail after the first variant was created');
 assert.notEqual(rollback.status,0,rollback.stderr||rollback.stdout);
 assert.match(rollback.stderr,/Rolled back the entire run folder/);
 assert.equal(fs.existsSync(rollbackFolder),false);
}finally{
 fs.rmSync(rollbackFolder,{recursive:true,force:true});
}

const source=fs.readFileSync(script,'utf8');
assert.match(source,/--directory/);
assert.match(source,/fs\.mkdirSync\(safe\('work'\),\{recursive:true\}\)/);
assert.doesNotMatch(source,/\.variant a\{[^}]*min-height:92px/);
assert.match(source,/fs\.rmSync\(safe\(runDirectory\),\{recursive:true,force:true\}\)/);
console.log('test-v2-variants: ok');
