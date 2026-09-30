import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {safe,read,write,atomic,canonical,sha} from './core.mjs';
import {runPath,hashes,measureC1,buildOverlay,overlayKinds} from './v2-overlays-lib.mjs';
import {overlayReadiness,checkCommand} from './v2-run-state.mjs';
import {refreshIndex} from './v2-index.mjs';
import {previewManifest,posterPreview} from './v2-preview.mjs';
import {browser,openPage} from './render.mjs';

const argv=process.argv.slice(2);
if(argv.length!==2||argv[0]!=='--run'){
 console.error('Use --run work/<name>-<format>');
 process.exit(1);
}

let staging=null,run=null,originalIndex=null;
const installed=[],backed=[],installedPreviews=[],backedPreviews=[];
try{
 const info=runPath(argv[1]);run=info.run;
 refreshIndex(run);
 const unready=overlayReadiness(run);
 if(unready.length)throw Error('C1–C5 must all pass v2:check before overlays. '+unready.map(item=>item.variant+': '+item.state.label.toLowerCase()).join('; ')+'. Run: '+checkCommand(run));
 const baseHashes=hashes(info.base),geometry=await measureC1(info.base);
 originalIndex=read(run+'/index.html').toString();
 staging=run+'/overlay-next-'+randomUUID().slice(0,8);
 fs.mkdirSync(safe(staging+'/new'),{recursive:true});
 fs.mkdirSync(safe(staging+'/old'),{recursive:true});
 const created=[];
 for(const kind of overlayKinds){
  const variant='c1-'+kind,target=staging+'/new/'+variant;
  created.push(buildOverlay(info.base,target,kind,geometry,{run}));
 }
 if(canonical(baseHashes)!==canonical(hashes(info.base)))throw Error('C1 changed while overlays were being built; run the command again');
 for(const kind of overlayKinds){
  const variant='c1-'+kind,target=run+'/'+variant;
  if(fs.existsSync(safe(target))){fs.renameSync(safe(target),safe(staging+'/old/'+variant));backed.push(variant);}
 }
 for(const kind of overlayKinds){
  const variant='c1-'+kind;
  fs.renameSync(safe(staging+'/new/'+variant),safe(run+'/'+variant));installed.push(variant);
 }
 const previewRecords={...previewManifest(run)},b=await browser();
 try{
  for(const kind of overlayKinds){
   const variant='c1-'+kind,{page,blocked}=await openPage(b,run+'/'+variant+'/poster.html');
   try{
    if(blocked.length)throw Error(variant+' uses blocked external resources: '+blocked.join(', '));
    write(staging+'/new-previews/'+variant+'.png',await posterPreview(page));
    previewRecords[variant]={posterSha256:sha(read(run+'/'+variant+'/poster.html'))};
   }finally{await page.close();}
  }
 }finally{await b.close();}
 if(canonical(baseHashes)!==canonical(hashes(info.base)))throw Error('C1 changed while overlay previews were being captured; run the command again');
 write(staging+'/new-previews/manifest.json',{schemaVersion:1,variants:previewRecords});
 fs.mkdirSync(safe(run+'/previews'),{recursive:true});
 for(const file of [...overlayKinds.map(kind=>'c1-'+kind+'.png'),'manifest.json']){
  const target=run+'/previews/'+file;
  if(fs.existsSync(safe(target))){fs.renameSync(safe(target),safe(staging+'/old/'+file));backedPreviews.push(file);}
  fs.renameSync(safe(staging+'/new-previews/'+file),safe(target));installedPreviews.push(file);
 }
 refreshIndex(run);
 fs.rmSync(safe(staging),{recursive:true,force:true});staging=null;
 console.log(canonical({run,index:run+'/index.html',derived:created.map(item=>({variant:'c1-'+item.kind,html:run+'/c1-'+item.kind+'/poster.html',materialId:item.materialId})),hint:'Derived copies are read-only: edit c1/poster.html and rerun v2:overlays to rebuild them.'}));
}catch(error){
 const rollbackErrors=[];
 if(run&&staging){
  for(const variant of installed.reverse())try{fs.rmSync(safe(run+'/'+variant),{recursive:true,force:true});}catch(e){rollbackErrors.push('remove '+variant+': '+e.message);}
  for(const variant of backed.reverse())try{fs.renameSync(safe(staging+'/old/'+variant),safe(run+'/'+variant));}catch(e){rollbackErrors.push('restore '+variant+': '+e.message);}
  for(const file of installedPreviews.reverse())try{fs.rmSync(safe(run+'/previews/'+file),{force:true});}catch(e){rollbackErrors.push('remove preview '+file+': '+e.message);}
  for(const file of backedPreviews.reverse())try{fs.renameSync(safe(staging+'/old/'+file),safe(run+'/previews/'+file));}catch(e){rollbackErrors.push('restore preview '+file+': '+e.message);}
  if(originalIndex!==null)try{if(read(run+'/index.html').toString()!==originalIndex)atomic(run+'/index.html',originalIndex);}catch(e){rollbackErrors.push('restore index.html: '+e.message);}
  if(!rollbackErrors.length)try{fs.rmSync(safe(staging),{recursive:true,force:true});}catch(e){rollbackErrors.push('remove staging: '+e.message);}
 }
 console.error('V2 overlays failed: '+error.message);
 if(rollbackErrors.length)console.error('Rollback incomplete: '+rollbackErrors.join('; '));
 process.exitCode=1;
}
