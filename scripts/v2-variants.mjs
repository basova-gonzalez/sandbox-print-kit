import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {canonical,root,safe} from './core.mjs';
import {refreshIndex} from './v2-index.mjs';

const argv=process.argv.slice(2),args={};
const fail=message=>{throw Error(message);};
for(let index=0;index<argv.length;index+=2){const key=argv[index],value=argv[index+1];if(!['--format','--name','--photo'].includes(key)||!value||args[key])fail('Use --format DL|A6|A5|A4|A3 --name lowercase-slug [--photo local-file]');args[key]=value;}
if(!['DL','A6','A5','A4','A3'].includes(args['--format'])||!/^[a-z][a-z0-9-]{1,54}$/.test(args['--name']??''))fail('Use --format DL|A6|A5|A4|A3 --name lowercase-slug (up to 55 characters) [--photo local-file]');

const format=args['--format'],base=args['--name'],suffix=format.toLowerCase();
const runDirectory='work/'+base+'-'+suffix;
const variants=['C1','C2','C3','C4','C5'].map(composition=>{const materialId=base+'-'+suffix+'-'+composition.toLowerCase();return {composition,materialId,directory:runDirectory+'/'+composition.toLowerCase(),html:runDirectory+'/'+composition.toLowerCase()+'/poster.html'};});
if(new Set(variants.map(variant=>variant.materialId)).size!==variants.length)fail('Variant material IDs must be unique');
safe(runDirectory);
if(fs.existsSync(safe(runDirectory)))fail('Working folder already exists: '+runDirectory);

const run=commandArgs=>{const result=spawnSync(process.execPath,['scripts/direct-html.mjs',...commandArgs],{cwd:root,encoding:'utf8'});if(result.error)fail('Variant command failed: '+result.error.message);if(result.status!==0)fail((result.stderr||result.stdout||'Variant command failed').trim());};
const photo=args['--photo']?path.resolve(args['--photo']):null;
if(photo&&(!fs.existsSync(photo)||!fs.statSync(photo).isFile()||fs.lstatSync(photo).isSymbolicLink()||!/^\.(?:jpe?g|png)$/i.test(path.extname(photo))))fail('--photo must be a local regular .jpg, .jpeg, or .png file');
if(photo){
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sandbox-print-v2-photo-'));
 try{const result=spawnSync(path.join(root,'.venv/bin/python'),[safe('scripts/prepare-photo.py'),photo,path.join(temporary,'probe.jpg')],{encoding:'utf8'});if(result.error||result.status!==0)fail('Photo preparation failed before creating variants: '+(result.error?.message||result.stderr?.trim()||result.stdout?.trim()||'unknown error'));}
 finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
let runCreated=false;
try{
 fs.mkdirSync(safe('work'),{recursive:true});
 fs.mkdirSync(safe(runDirectory));runCreated=true;
 const created=[];
 for(const variant of variants){run(['new','--composition',variant.composition,'--format',format,'--name',variant.materialId,'--directory',variant.directory]);created.push({id:variant.composition.toLowerCase(),material_id:variant.materialId,html:variant.html});if(photo&&['C1','C4','C5'].includes(variant.composition))run(['photo','--html',variant.html,'--source',photo]);}
 refreshIndex(runDirectory);
 console.log(canonical({format,name:base,folder:runDirectory,index:runDirectory+'/index.html',variants:created,hint:'Open a variant from the index, edit its poster.html, then refresh the poster tab. Run v2:check to update status labels before overlays. Copy that variant’s complete html:pdf command from the index to issue a PDF.'}));
}catch(error){
 if(runCreated){try{if(fs.existsSync(safe(runDirectory)))fs.rmSync(safe(runDirectory),{recursive:true,force:true});}catch(cleanupError){console.error('Rollback incomplete for '+runDirectory+': '+cleanupError.message);}}
 console.error('Could not create all five variants: '+error.message);
 console.error(runCreated?'Rolled back the entire run folder.':'No run folder was created.');
 process.exitCode=1;
}
