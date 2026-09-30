import fs from 'node:fs';
import path from 'node:path';
import {root,safe,read,json,atomic,sha} from './core.mjs';

export const baseVariants=['c1','c2','c3','c4','c5'];
export const overlayKinds=['quiet','plate-ink','plate-blue','scrim'];
const demoPhrases=['demo venue','demo class','sample','notice','closing sunday','what is bouldering?','first visit','junior demo club','who it’s for','dates','price','format','coach','last climb','wall closed','new set','hours','getting here','climb with us','bouldering is climbing without ropes','demo intro, shoes included','demo groups, saturdays','ages 8–12','book your first session','123 demo street','all levels welcome','weekly coached'];
const strongDemoPhrases=['demo venue','demo class','climb with us','closing sunday','what is bouldering?','new set opens monday','demo intro, shoes included','demo groups, saturdays','book your first session','123 demo street'];
const placeholderPattern=/\[[^\]\r\n]+\]/u;
const qrPlaceholderPattern=/example\.com|placeholder|\btbd\b|\btodo\b/iu;
const runPattern=/^work\/[a-z][a-z0-9-]{1,60}$/u;
function qrImagePath(dir,relative){
 if(typeof relative!=='string'||!/^assets\/[a-z0-9/._-]+\.png$/iu.test(relative)||relative.split('/').includes('..'))throw Error('Unsafe QR asset path');
 const parent=path.resolve(dir),image=path.resolve(parent,relative);
 if(!image.startsWith(parent+path.sep))throw Error('QR asset escapes working copy');
 let current=parent;
 for(const part of relative.split('/')){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Symlink QR asset path rejected');}
 return image;
}

export function visibleHtml(html){return html.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&(?:#39|apos);/gi,"'").replace(/&(?:#8217|rsquo);/gi,'’').replace(/\s+/g,' ').trim();}
export function demos(text,sourceText=''){
 const lower=text.toLowerCase(),sourceLower=sourceText.toLowerCase(),found=[];
 for(const phrase of demoPhrases)if(lower.includes(phrase)&&!sourceLower.includes(phrase))found.push(phrase);
 if(placeholderPattern.test(text))found.push('placeholder [ … ]');
 return [...new Set(found)];
}
export function looksUnfilled(text){const lower=text.toLowerCase();return placeholderPattern.test(text)||strongDemoPhrases.some(phrase=>lower.includes(phrase));}

export function runVariantFor(htmlPath){
 const absolute=path.resolve(htmlPath),relative=path.relative(root,absolute).split(path.sep).join('/');
 const match=relative.match(/^(work\/[a-z][a-z0-9-]{1,60})\/(c[1-5])\/poster\.html$/u);
 if(!match)return null;
 safe(relative);
 return {run:match[1],variant:match[2],html:relative};
}
export function validRun(run){if(typeof run!=='string'||!runPattern.test(run))throw Error('Run must be one work/<name>-<format> folder');safe(run);return run;}

export function qrProblem(htmlPath,html){
 const dir=path.dirname(htmlPath),metaPath=path.join(dir,'sandbox-print.json');
 if(!fs.existsSync(metaPath))return /data-sandbox-qr\b/u.test(html)?'QR metadata is missing':null;
 let meta;
 try{meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));}catch{return 'QR metadata is unreadable';}
 if(!meta.qr)return ['C1','C2','C5'].includes(meta.composition)||/data-sandbox-qr\b/u.test(html)?'QR destination is missing':null;
 if(!/data-sandbox-qr\b/u.test(html))return 'QR image marker is missing';
 const destination=meta.qr.destination;
 if(typeof destination!=='string'||!destination.trim())return 'QR destination is missing';
 if(qrPlaceholderPattern.test(destination))return 'QR destination looks like a placeholder (example.com, PLACEHOLDER, TBD or TODO): '+destination;
 try{const url=new URL(destination);if(url.protocol!=='https:'||url.username||url.password||url.hash||url.href!==destination)return 'QR destination must be a complete HTTPS URL';}
 catch{return 'QR destination must be a complete HTTPS URL';}
 let image;
 try{image=qrImagePath(dir,meta.qr.path);}catch{return 'QR image path is invalid';}
 if(!fs.existsSync(image)||!fs.lstatSync(image).isFile())return 'QR image is missing';
 return null;
}

export function signatureFor(htmlPath){
 const html=fs.readFileSync(htmlPath),metaPath=path.join(path.dirname(htmlPath),'sandbox-print.json');
 let qrDestination=null,qrImageSha256=null;
 if(fs.existsSync(metaPath)){
  const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
  if(meta.qr){
   qrDestination=meta.qr.destination??null;
   const qrPath=qrImagePath(path.dirname(metaPath),meta.qr.path);
   if(fs.existsSync(qrPath)){const stat=fs.lstatSync(qrPath);if(!stat.isFile())throw Error('QR asset must be a regular file');qrImageSha256=sha(fs.readFileSync(qrPath));}
  }
 }
 return {posterSha256:sha(html),qrDestination,qrImageSha256};
}
function sameSignature(a,b){return a&&a.posterSha256===b.posterSha256&&a.qrDestination===b.qrDestination&&a.qrImageSha256===b.qrImageSha256;}
export function loadCheck(run){
 validRun(run);
 if(!fs.existsSync(safe(run+'/v2-check.json')))return null;
 try{const data=json(run+'/v2-check.json');return data.schemaVersion===1&&data.variants&&typeof data.variants==='object'?data:null;}
 catch{return null;}
}
export function saveCheck(run,sourcePath,results){
 validRun(run);
 const sourceSha256=sha(fs.readFileSync(sourcePath)),prior=loadCheck(run);
 const variants=prior?.sourceSha256===sourceSha256&&prior.sourcePath===sourcePath?{...prior.variants}:{};
 for(const result of results)variants[result.variant]={pass:result.pass,...result.signature,problems:result.problems};
 atomic(run+'/v2-check.json',{schemaVersion:1,sourcePath,sourceSha256,variants});
}
function sourceCurrent(check){
 try{
  if(!check||typeof check.sourcePath!=='string'||!fs.existsSync(check.sourcePath))return false;
  const stat=fs.lstatSync(check.sourcePath);
  return stat.isFile()&&!stat.isSymbolicLink()&&sha(fs.readFileSync(check.sourcePath))===check.sourceSha256;
 }catch{return false;}
}
export function variantState(run,variant){
 validRun(run);
 if(variant.startsWith('c1-'))return {code:'derived',label:'Derived from C1',detail:'Edit C1 and regenerate this copy.'};
 if(!baseVariants.includes(variant))throw Error('Unknown variant: '+variant);
 const htmlPath=safe(run+'/'+variant+'/poster.html'),html=fs.readFileSync(htmlPath,'utf8'),check=loadCheck(run),record=check?.variants?.[variant];
 const unfilled=looksUnfilled(visibleHtml(html))||Boolean(qrProblem(htmlPath,html));
 if(record){
  if(!sourceCurrent(check)||!sameSignature(signatureFor(htmlPath),record))return {code:'changed',label:'Changed since check',detail:'Run v2:check again.'};
  if(record.pass===true)return {code:'checked',label:'Checked',detail:'Last v2:check passed; file is unchanged.'};
  return unfilled?{code:'unfilled',label:'Not filled',detail:'Demo text, a placeholder or QR remains.'}:{code:'failed',label:'Check failed',detail:'Fix the reported problems and rerun v2:check.'};
 }
 return unfilled?{code:'unfilled',label:'Not filled',detail:'Demo text, a placeholder or QR remains.'}:{code:'unchecked',label:'Not checked',detail:'Run v2:check before creating overlays.'};
}
export function overlayReadiness(run){
 return baseVariants.map(variant=>({variant,state:variantState(run,variant)})).filter(item=>item.state.code!=='checked');
}
export function checkCommand(run){
 const check=loadCheck(run),quote=value=>"'"+String(value).replace(/'/g,"'\\''")+"'";
 const source=check?.sourcePath?quote(check.sourcePath):'<material.md>';
 return 'npm run v2:check -- --source '+source+baseVariants.map(variant=>' --html '+run+'/'+variant+'/poster.html').join('');
}
