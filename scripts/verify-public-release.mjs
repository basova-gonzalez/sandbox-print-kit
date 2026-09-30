import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {safe} from './core.mjs';

const formats=['DL','A6','A5','A4','A3'];
const compositions=['C1','C2','C3','C4','C5'];
const results=[];

function run(args){
  const result=spawnSync(process.execPath,['scripts/direct-html.mjs',...args],{cwd:safe('.'),encoding:'utf8',maxBuffer:20_000_000});
  if(result.status!==0)throw Error((result.stderr||result.stdout||`Command failed: ${args.join(' ')}`).trim());
  return result.stdout.trim();
}

for(const format of formats){
  const folder=`public-verify-${format.toLowerCase()}`;
  const runDir=`work/${folder}`;
  fs.rmSync(safe(runDir),{recursive:true,force:true});
  for(const composition of compositions){
    const variant=composition.toLowerCase();
    run(['new','--composition',composition,'--format',format,'--name',`${folder}-${variant}`,'--directory',`${runDir}/${variant}`]);
  }
  for(const composition of compositions){
    const variant=composition.toLowerCase();
    const output=JSON.parse(run(['pdf','--html',`${runDir}/${variant}/poster.html`]));
    results.push({composition,format,technicalPass:output.technicalPass,pdf:output.pdf,marks:output.marks,qa:output.qa});
  }
}

if(results.length!==25||results.some(result=>!result.technicalPass))throw Error('Expected 25 passing template exports');
fs.writeFileSync(safe('output/public-release-verification.json'),JSON.stringify({templates:25,passed:25,results},null,2)+'\n');
console.log('PASS: 25/25 templates exported with technical PDF QA');
