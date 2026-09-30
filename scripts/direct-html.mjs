import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import {formatConfig} from './catalog.mjs';
import {root,safe,read,json,write,immutable,atomic,sha,canonical,id,tree} from './core.mjs';

const [command,...argv]=process.argv.slice(2),args={};let attempt=null,stage=null;
const fail=message=>{throw Error(message);};
const parse=allowed=>{for(let i=0;i<argv.length;i+=2){if(!allowed.includes(argv[i])||!argv[i+1]||args[argv[i]])fail('Unknown, duplicate or missing argument');args[argv[i]]=argv[i+1];}};
const relHtml=value=>{if(typeof value!=='string')fail('--html is required');const absolute=path.isAbsolute(value)?path.resolve(value):path.resolve(root,value);const rel=path.relative(root,absolute).split(path.sep).join('/');if(!/^(?:work\/html\/[a-z][a-z0-9-]{1,60}|work\/[a-z][a-z0-9-]{1,60}\/(?:c[1-5]|c1-(?:quiet|plate-ink|plate-blue|scrim)))\/poster\.html$/.test(rel))fail('HTML must be a local work/html/<name>/poster.html or work/<run>/<variant>/poster.html path inside this package');safe(rel);return rel;};
const workDirectory=value=>{if(typeof value!=='string'||!/^work\/[a-z][a-z0-9-]{1,60}\/c[1-5]$/.test(value))fail('--directory must be a local work/<run>/<variant> path');safe(value);return value;};
const decode=file=>{const png=PNG.sync.read(fs.readFileSync(file));return jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data??null;};
const localAsset=(src,label)=>{if(!src)return null;if(/^(?:[a-z]+:|\/\/|\/)/i.test(src)||src.includes('\\')||src.split('/').includes('..'))fail(label+' must use a local relative path');return src;};
const addAttr=(tag,name,value)=>tag.replace(/>$/,` ${name}="${value}">`);
const visible=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const roleFor=(composition,tag,text)=>{
 const lower=text.toLowerCase();
 if(tag==='h3')return 'headline';
 if(['demo venue','demo class','sample','notice','closing sunday','what is bouldering?'].includes(lower))return 'status';
 if(/^(first visit|kids climbing|who it'?s for|dates|price|format|coach|last climb|wall closed|new set|hours|get(?:ting)? here)$/i.test(text))return 'fact-label';
 if(/^(book your|sign up|ask any of us|bring this in)/i.test(text))return 'cta';
 if(/kabago\.ru\/cases\/sandbox-print\/|123 Demo Street/i.test(text))return 'address-url';
 if(tag==='p')return 'supporting-text';
 if(/^(demo intro|demo groups)/i.test(text))return /(?:£|\bages\b)/i.test(text)?'fact-value price conditions':'fact-value';
 if(/(?:£|\bprice\b)/i.test(text))return /\b(?:ages|two hours|per term|per 4 weeks|drop in)\b/i.test(text)?'price conditions':'price';
 if(composition==='C4'&&/\bmon|\btue|\bwed|\bthu|\bfri|\bsat|\bsun/i.test(text))return 'conditions';
 if(/\b(mon|tue|wed|thu|fri|sat|sun)(day)?\b|\bsep\b|\bweeks?\b|\bclose of day\b|\bfrom opening\b/i.test(text))return 'date';
 if(/\b(?:ages|places confirmed|parking|two hours|per term|all levels welcome)\b/i.test(text))return 'conditions';
 if(/^(all levels|weekly coached|alex demo|monday, all day)/i.test(text))return 'fact-value';
 return null;
};
function annotateTextRoles(source,composition){
 const matches=[...source.matchAll(/<(h[1-6]|p|span|b)\b[^>]*>/gi)].reverse();
 for(const match of matches){const tag=match[1],start=match.index,end=source.indexOf(`</${tag}`,start+match[0].length);if(end<0)continue;const text=visible(source.slice(start+match[0].length,end)),role=roleFor(composition,tag.toLowerCase(),text);if(!role)continue;const marker=`<!-- EDITABLE ${role.toUpperCase()}: change visible words only; keep this tag and its style. -->`;
  source=source.slice(0,start)+marker+addAttr(match[0],'data-sandbox-role',role)+source.slice(start+match[0].length);
 }
 source=source.replace(/<div\b([^>]*)>([^<\n][^<]*)<\/div>/gi,(whole,attributes,text)=>{const role=roleFor(composition,'div',visible(text));return role?`<!-- EDITABLE ${role.toUpperCase()}: change visible words only; keep this tag and its style. -->${addAttr(`<div${attributes}>`,'data-sandbox-role',role)}${text}</div>`:whole;});
 return source;
}
function annotate(source,composition,format){
 let first=true;source=source.replace(/<body><div\b([^>]*)>/i,(m,a)=>{first=false;return `<body>\n<!-- LAYOUT-SENSITIVE ROOT: keep this element, its size, hierarchy, inline styles and the <head> CSS intact. -->\n<div${a} data-sandbox-composition="${composition}" data-sandbox-format="${format}">`;});if(first)fail('Template body root was not found');
 source=annotateTextRoles(source,composition);
 source=source.replace(/<img\b[^>]*>/gi,m=>{const src=m.match(/\bsrc=["']([^"']+)["']/i)?.[1]??'';let role='fixed-asset',note='FIXED ASSET: keep this logo/decorative asset and its geometry.';if(src.includes('/photos/')){role='photo';note='EDITABLE PHOTO: use npm run html:photo to replace it. To adjust the visible crop, change only object-position to X% Y% (0–100%); keep the element, dimensions and other styles.';}else if(src.includes('gradient-')){role='gradient';note='LAYOUT-SENSITIVE GRADIENT: keep this local file, element and geometry.';}else if(src.includes('/qr-')){role='qr';note='EDITABLE QR: use npm run html:qr; do not replace QR pixels by hand.';}return `<!-- ${note} -->${addAttr(m,'data-sandbox-'+role,role)}`;});
 return source.replace('</head>',`<!--\nSANDBOX DIRECT HTML WORKING COPY\nEditable zones are marked below. HTML comments and data-sandbox-* attributes are nonvisual.\nKeep CSS, root size, hierarchy, inline layout styles, local asset paths and markers intact.\nUse npm run html:qr for QR destinations and npm run html:pdf -- --html <this path> to export.\n--></head>`);
}
function metadataFor(source,composition,format,name){
 const imgs=[...source.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(x=>x[1]);const one=(test,label)=>{const xs=imgs.filter(test);if(xs.length>1)fail('Template has multiple '+label+' assets');return xs[0]??null;};
 const photo=one(x=>x.includes('/photos/'),'photo'),gradient=one(x=>x.includes('gradient-'),'gradient'),qrOriginal=one(x=>x.includes('/qr-'),'QR');
 const config=formatConfig(composition,format);return {schema_version:1,material_id:name,composition,format,html:'poster.html',print_css:'print.css',photo:photo?{path:photo}:null,gradient:gradient?{path:gradient}:null,qr:qrOriginal?{path:'assets/qr-current.png',destination:null}:null,source_template:config.template,source_template_sha256:sha(read(config.template)),source_print_css_sha256:sha(read(config.printCSS))};
}
function requiredAssets(source,printCSS){
 const refs=new Set();
 for(const content of [source,printCSS]){
  for(const match of content.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi))if(match[1].startsWith('assets/'))refs.add(localAsset(match[1],'template asset'));
  for(const match of content.matchAll(/\burl\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi))if(match[2].startsWith('assets/'))refs.add(localAsset(match[2],'template asset'));
 }
 return [...refs].sort();
}
function validateMetadata(meta){
 const exact=['schema_version','material_id','composition','format','html','print_css','photo','gradient','qr','source_template','source_template_sha256','source_print_css_sha256'];for(const key of Object.keys(meta))if(!exact.includes(key))fail('sandbox-print.json has unknown field '+key);for(const key of exact)if(!(key in meta))fail('sandbox-print.json missing '+key);
 if(meta.schema_version!==1||!/^[a-z][a-z0-9-]{1,60}$/.test(meta.material_id)||!/^C[1-5]$/.test(meta.composition)||!['DL','A6','A5','A4','A3'].includes(meta.format)||meta.html!=='poster.html'||meta.print_css!=='print.css'||!/^[a-f0-9]{64}$/.test(meta.source_template_sha256)||!/^[a-f0-9]{64}$/.test(meta.source_print_css_sha256))fail('Invalid direct HTML metadata');const config=formatConfig(meta.composition,meta.format);if(meta.source_template!==config.template)fail('sandbox-print.json source template does not match composition/format');
 for(const [label,item] of [['photo',meta.photo],['gradient',meta.gradient],['QR',meta.qr]])if(item){if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.path!=='string')fail('Invalid '+label+' metadata');localAsset(item.path,label);}
 if(meta.qr){const u=new URL(meta.qr.destination);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.href!==meta.qr.destination)fail('QR requires a canonical HTTPS URL without credentials or fragment');}
 return meta;
}
function snapshot(sourceDir,target){const files=tree(sourceDir);if(files.length>500)fail('RESOURCE_LIMIT: working copy exceeds 500 files');let bytes=0;const hashes={};for(const file of files){const rel=file.slice(sourceDir.length+1),data=read(file);bytes+=data.length;if(bytes>100_000_000)fail('RESOURCE_LIMIT: working copy exceeds 100 MB');if(!/\.(?:html|css|svg|png|jpe?g|webp|ttf|otf|json|md|txt)$/i.test(rel))fail('Unsupported working-copy file type: '+rel);write(target+'/'+rel,data);hashes[rel]=sha(data);}return hashes;}
function liveHashes(dir){const result={};for(const file of tree(dir))result[file.slice(dir.length+1)]=sha(read(file));return result;}

try{
 if(command==='new'){
  parse(['--composition','--format','--name','--directory']);const composition=args['--composition'],format=args['--format'],name=args['--name'];if(!/^C[1-5]$/.test(composition??'')||!['DL','A6','A5','A4','A3'].includes(format??'')||!/^[a-z][a-z0-9-]{1,60}$/.test(name??''))fail('Use --composition C1..C5 --format DL|A6|A5|A4|A3 --name lowercase-slug [--directory work/<run>/<variant>]');
  const config=formatConfig(composition,format),dir=args['--directory']?workDirectory(args['--directory']):'work/html/'+name;if(fs.existsSync(safe(dir)))fail('Working copy already exists: '+dir);
  const original=read(config.template).toString(),meta=metadataFor(original,composition,format,name);
  let source=original;if(meta.qr){const match=original.match(/\bsrc=["']([^"']*\/qr-[^"']+)["']/i);const originalPath=match?.[1];if(!originalPath)fail('QR source path was not found');const destination=decode(safe(originalPath));if(!destination)fail('Template QR is unreadable');meta.qr.destination=destination;source=source.replace(originalPath,meta.qr.path);}
  const printCSS=read(config.printCSS);for(const file of requiredAssets(source,printCSS.toString())){if(file===meta.qr?.path)continue;write(dir+'/'+file,read(file));}
  if(meta.qr){const originalPath=original.match(/\bsrc=["']([^"']*\/qr-[^"']+)["']/i)[1],qrBytes=read(originalPath);write(dir+'/'+originalPath,qrBytes);write(dir+'/'+meta.qr.path,qrBytes);}
  immutable(dir+'/poster.html',annotate(source,composition,format));immutable(dir+'/print.css',printCSS);immutable(dir+'/sandbox-print.json',meta);immutable(dir+'/WORKING-COPY.md',`# ${name}\n\nEdit \`poster.html\` directly. Nonvisual comments distinguish editable semantic roles from layout-sensitive service markup.\n\nTo replace a JPEG or opaque PNG photo without changing the supplied demonstration assets: \`npm run html:photo -- --html ${dir}/poster.html --source "/path/to/your-photo.png"\`. The command makes a local JPEG copy, preserves a supplied ICC profile or embeds sRGB for PNG without one, normalizes orientation and updates the marked photo path. A PNG with transparent pixels is rejected. To adjust the visible crop, change only the marked photo's \`object-position\` to two percentages such as \`50% 35%\`: horizontal focus first, vertical focus second. Values must stay between 0% and 100%. The photo moves only along an axis where it is cropped; do not add zoom or change its dimensions.\n\nUpdate QR: \`npm run html:qr -- --html ${dir}/poster.html --destination https://example.com/path\`\n\nExport: \`npm run html:pdf -- --html ${dir}/poster.html\`\n\n${args['--directory']?"Inspect both PDFs in the run's pdf/ folder.":"Inspect both PDFs in the new versioned output folder."} Technical PASS is not copy, rights, design, recipient, printer, or production approval.\n`);console.log(canonical({created:dir,html:dir+'/poster.html',composition,format}));
 }else if(command==='photo'){
  parse(['--html','--source']);const html=relHtml(args['--html']),dir=path.posix.dirname(html),meta=validateMetadata(json(dir+'/sandbox-print.json'));if(!meta.photo)fail('This composition has no photo zone');const source=path.resolve(args['--source']);if(!fs.existsSync(source)||!fs.statSync(source).isFile()||fs.lstatSync(source).isSymbolicLink())fail('--source must be a local regular JPEG or PNG file');const extension=path.extname(source).toLowerCase();if(!/^\.(?:jpe?g|png)$/.test(extension))fail('--source must have a .jpg, .jpeg, or .png extension');const target=dir+'/assets/photos/selected-photo'+(extension==='.png'?'.jpg':extension);
  const prepared=spawnSync(path.join(root,'.venv/bin/python'),[safe('scripts/prepare-photo.py'),source,safe(target)],{encoding:'utf8'});if(prepared.status!==0)fail('Photo preparation failed: '+(prepared.stderr.trim()||prepared.stdout.trim()||'unknown error'));const oldPath=meta.photo.path,poster=read(html).toString();if(!poster.includes(`data-sandbox-photo="photo"`)||!poster.includes(`src="${oldPath}"`))fail('Marked photo path is missing from poster.html');write(html,poster.replace(`src="${oldPath}"`,`src="${target.slice(dir.length+1)}"`));meta.photo={path:target.slice(dir.length+1),source_sha256:sha(fs.readFileSync(source)),orientation_normalized:true};write(dir+'/sandbox-print.json',meta);console.log(canonical({html,photo:meta.photo.path,sourceSha256:meta.photo.source_sha256,orientationNormalized:true}));
 }else if(command==='qr'){
  parse(['--html','--destination']);const html=relHtml(args['--html']),dir=path.posix.dirname(html),meta=json(dir+'/sandbox-print.json');if(!meta.qr)fail('This composition has no QR zone');const u=new URL(args['--destination']);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.href!==args['--destination'])fail('QR requires a canonical HTTPS URL without credentials or fragment');write(dir+'/'+meta.qr.path,await QRCode.toBuffer(u.href,{type:'png',width:600,margin:4,errorCorrectionLevel:'M'}));meta.qr.destination=u.href;write(dir+'/sandbox-print.json',meta);console.log(canonical({html,qr:u.href}));
 }else if(command==='pdf'){
  parse(['--html']);attempt=id();stage='output/html-attempts/'+attempt;immutable(stage+'/attempt.json',{status:'running',attempt,result:null});atomic('output/DIRECT_LAST_ATTEMPT.json',{status:'running',attempt,result:null});const html=relHtml(args['--html']),sourceDir=path.posix.dirname(html),meta=validateMetadata(json(sourceDir+'/sandbox-print.json'));if(path.posix.basename(html)!==meta.html)fail('HTML path does not match sandbox-print.json');
  const overlayFile=sourceDir+'/v2-overlay.json';
  if(fs.existsSync(safe(overlayFile))){
   const overlay=json(overlayFile),base=path.posix.dirname(sourceDir)+'/c1';
   if(!['quiet','plate-ink','plate-blue','scrim'].includes(overlay.kind)||!/^[a-z][a-z0-9-]{1,24}$/.test(overlay.variantName??'')||path.posix.basename(sourceDir)!=='c1-'+overlay.variantName||overlay.derivedMaterialId!==meta.material_id||overlay.sourceMaterialId!==json(base+'/sandbox-print.json').material_id)fail('DIRECT_HTML_OVERLAY: derived identity does not match C1');
   if(overlay.sourcePosterSha256!==sha(read(base+'/poster.html'))||overlay.derivedPosterSha256!==sha(read(html)))fail('DIRECT_HTML_OVERLAY: edit C1 and regenerate derived copies; do not edit an overlay');
   const files=Object.fromEntries(tree(base).map(file=>[file.slice(base.length+1),sha(read(file))]));
   if(overlay.sourceTreeSha256!==sha(canonical(files)))fail('DIRECT_HTML_OVERLAY: C1 resources changed; regenerate derived copies');
   if(overlay.kind==='quiet'&&overlay.quietPhotoSha256!==sha(read(sourceDir+'/assets/photos/quiet-photo.jpg')))fail('DIRECT_HTML_OVERLAY: quiet photo changed; regenerate derived copies');
   const derivedFiles=Object.fromEntries(tree(sourceDir).filter(file=>file!==overlayFile).map(file=>[file.slice(sourceDir.length+1),sha(read(file))]));
   if(overlay.derivedTreeSha256!==sha(canonical(derivedFiles)))fail('DIRECT_HTML_OVERLAY: derived resources changed; edit C1 and regenerate derived copies');
  }
  const config=formatConfig(meta.composition,meta.format);if(sha(read(config.template))!==meta.source_template_sha256||sha(read(config.printCSS))!==meta.source_print_css_sha256)fail('DIRECT_HTML_STALE: selected template or print CSS changed; create a fresh working copy');if(sha(read(sourceDir+'/'+meta.print_css))!==meta.source_print_css_sha256)fail('DIRECT_HTML_METADATA: working print.css changed; create a fresh working copy');const before=liveHashes(sourceDir),sourceFiles=snapshot(sourceDir,stage);write(stage+'/source-files.json',sourceFiles);write(stage+'/source.html',read(stage+'/'+meta.html));write(stage+'/preview.html',read(stage+'/'+meta.html));write(stage+'/input.json',{purpose:'direct-html',composition:meta.composition,format:meta.format,qr:meta.qr?{destination:meta.qr.destination}:null});
  const {identity,prepareDirectHtml,render,qa}=await import('./render.mjs'),buildIdentity=identity({mode:'direct-html',metadata:meta,sourceFiles});await prepareDirectHtml(stage,meta);if(canonical(before)!==canonical(liveHashes(sourceDir)))fail('DIRECT_HTML_CHANGED: working copy changed during export');await render(stage);const report=qa(stage);if(!report.pass)fail('Technical PDF QA did not pass');
  const assessment={technicalPass:true,automaticChecks:['local source and resource paths','composition, format and root dimensions','fonts and image decoding','content bounds and block collisions','one-page PDF geometry','5 mm bleed and crop marks','embedded used font glyphs','photo ICC and effective PPI when applicable','QR decode and destination when applicable','marks/no-marks trim pixel identity'],notAssessed:['copy accuracy or completeness','factual truth','asset rights or licensing','visual or design approval','recipient confirmation','printer or production approval'],visualReviewRequired:true};write(stage+'/direct-html-assessment.json',assessment);
  const runInfo=html.match(/^(work\/[a-z][a-z0-9-]{1,60})\/(c[1-5]|c1-(?:quiet|plate-ink|plate-blue|scrim))\/poster\.html$/);
  if(runInfo){
   const pdfDir=runInfo[1]+'/pdf',prefix=runInfo[2];
   fs.mkdirSync(safe(pdfDir),{recursive:true});
   atomic(pdfDir+'/'+prefix+'-no-marks.pdf',read(stage+'/no-marks.pdf'));
   atomic(pdfDir+'/'+prefix+'-marks.pdf',read(stage+'/marks.pdf'));
   atomic(pdfDir+'/'+prefix+'-qa.json',read(stage+'/qa.json'));
   fs.rmSync(safe(stage),{recursive:true,force:true});stage=null;
   const record={status:'success',attempt,pdf:pdfDir+'/'+prefix+'-no-marks.pdf',marks:pdfDir+'/'+prefix+'-marks.pdf',qa:pdfDir+'/'+prefix+'-qa.json',technicalPass:true,visualReviewRequired:true,...(report.photo?.warning?{photoWarning:report.photo.warning}:{})};
   atomic('output/DIRECT_LAST_ATTEMPT.json',record);atomic('output/DIRECT_LAST_SUCCESS.json',record);
   const {refreshIndex}=await import('./v2-index.mjs');refreshIndex(runInfo[1]);
   console.log(canonical(record));
  }else{
   const version=attempt,result='output/html/'+meta.material_id+'/'+version;write(stage+'/attempt.json',{status:'success',attempt,version,result,technicalPass:true,visualReviewRequired:true});const files={};for(const file of tree(stage))if(!file.endsWith('/manifest.json'))files[file.slice(stage.length+1)]=sha(read(file));immutable(stage+'/manifest.json',{status:'success',attempt,version,materialId:meta.material_id,sourcePath:html,identity:buildIdentity,files,technicalPass:true,visualReviewRequired:true});fs.mkdirSync(path.dirname(safe(result)),{recursive:true});fs.renameSync(safe(stage),safe(result));stage=null;const record={status:'success',attempt,version,result,manifest:result+'/manifest.json',manifestSha256:sha(read(result+'/manifest.json')),technicalPass:true,visualReviewRequired:true,...(report.photo?.warning?{photoWarning:report.photo.warning}:{})};atomic('output/DIRECT_LAST_ATTEMPT.json',record);atomic('output/DIRECT_LAST_SUCCESS.json',record);console.log(canonical(record));
  }
 }else fail('Use new, qr, or pdf');
}catch(error){if(attempt){const record={status:'failed',attempt,result:null,attemptEvidence:stage,error:error.message};try{if(stage){write(stage+'/attempt.json',record);}atomic('output/DIRECT_LAST_ATTEMPT.json',record);}catch(recordError){console.error('Could not record direct HTML failure: '+recordError.message);}}console.error(error.message);process.exitCode=1;}
