import fs from 'node:fs';
import {atomic,read,safe,sha} from './core.mjs';
import {baseVariants,overlayKinds,validRun} from './v2-run-state.mjs';

const variants=[...baseVariants,...overlayKinds.map(kind=>'c1-'+kind)];
export function validPreviewVariant(variant){
 if(!variants.includes(variant))throw Error('Unknown preview variant: '+variant);
 return variant;
}
export function previewPath(run,variant){validRun(run);validPreviewVariant(variant);return run+'/previews/'+variant+'.png';}
export function previewManifest(run){
 validRun(run);
 const file=run+'/previews/manifest.json';
 if(!fs.existsSync(safe(file)))return {};
 try{const data=JSON.parse(read(file));return data.schemaVersion===1&&data.variants&&typeof data.variants==='object'?data.variants:{};}
 catch{return {};}
}
export async function posterPreview(page){
 const poster=page.locator('body > [data-sandbox-composition]');
 if(await poster.count()!==1)throw Error('Cannot make preview: poster root is missing or duplicated');
 return poster.screenshot({animations:'disabled',type:'png'});
}
export function savePreviews(run,items){
 const manifest={...previewManifest(run)};
 for(const {variant,png,posterSha256} of items){
  if(!Buffer.isBuffer(png)||!png.length||!/^[a-f0-9]{64}$/.test(posterSha256))throw Error('Invalid preview data');
  atomic(previewPath(run,variant),png);
  manifest[variant]={posterSha256};
 }
 atomic(run+'/previews/manifest.json',{schemaVersion:1,variants:manifest});
}
export function previewInfo(run,variant){
 const file=previewPath(run,variant);
 if(!fs.existsSync(safe(file)))return {exists:false,stale:false};
 const record=previewManifest(run)[variant],poster=run+'/'+variant+'/poster.html';
 const stale=!record||record.posterSha256!==sha(read(poster));
 return {exists:true,stale};
}
