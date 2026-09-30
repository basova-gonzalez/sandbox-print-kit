import {formatConfig} from './catalog.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {root,safe,read,json,write,sha,canonical,tree} from './core.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH=safe('.browsers');
const {chromium}=await import('playwright');
const {PDFDocument,rgb}=await import('pdf-lib');
const mm=v=>v*72/25.4;
export function identity(d){
 const lock=json('toolchain.json');
 if(process.version!==lock.node)throw Error('Node version mismatch: expected '+lock.node);
 const require=createRequire(import.meta.url);for(const name of ['playwright','pdf-lib','qrcode','pngjs','jsqr'])if(!fs.realpathSync(require.resolve(name)).startsWith(root+path.sep))throw Error('Dependency resolved outside package: '+name);
 const executable=chromium.executablePath();
 if(!executable.startsWith(safe('.browsers')+path.sep))throw Error('Browser must be package-local');
 const actual=sha(fs.readFileSync(executable));if(actual!==lock.browserSha256)throw Error('Browser identity changed: reinstall pinned browser');
 const sourceFile=f=>!f.split('/').some(part=>['__pycache__','.pytest_cache','.DS_Store'].includes(part))&&!/\.py[co]$/.test(f);
 const hashes={};for(const f of [...tree('templates'),...tree('assets'),...tree('scripts'),'package.json','package-lock.json','requirements.lock','toolchain.json'].filter(sourceFile))hashes[f]=sha(read(f));
 return {input:sha(canonical(d)),files:hashes,browser:lock.browser,browserSha256:actual,node:process.version};
}
export async function browser(){const b=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:chromium.executablePath(),args:['--disable-gpu']});if(b.version()!==json('toolchain.json').browser){await b.close();throw Error('Browser version mismatch');}return b;}
export async function openPage(b,rel){
 const page=await b.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1});const requests=[],blocked=[];const allowed=new Set(tree(path.dirname(rel)).map(f=>pathToFileURL(safe(f)).href));
 await page.route('**/*',route=>{const url=route.request().url();if(allowed.has(url))return route.continue();blocked.push(url);return route.abort('blockedbyclient');});
 page.on('request',r=>{if(allowed.has(r.url()))requests.push(r.url().replace(pathToFileURL(root).href,'PACKAGE'));});
 await page.goto(pathToFileURL(safe(rel)).href,{waitUntil:'networkidle'});
 await page.evaluate(async()=>{await document.fonts.ready;for(const i of document.images)await i.decode();});
 return {page,requests,blocked};
}
export const measure=e=>{const base=e.getBoundingClientRect();const nodes=[...e.querySelectorAll('*')].map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {tag:n.tagName,text:n.children.length?null:n.textContent,x:r.x-base.x,y:r.y-base.y,w:r.width,h:r.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,lineHeight:s.lineHeight,objectFit:s.objectFit,objectPosition:s.objectPosition,opacity:s.opacity};});const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),ranges=[];let n;while(n=walker.nextNode()){if(!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);ranges.push({text:n.textContent,rects:[...r.getClientRects()].map(v=>({x:v.x-base.x,y:v.y-base.y,w:v.width,h:v.height}))});}return {nodes,ranges};};
export async function prepareDirectHtml(dir,metadata){
 const overlay=fs.existsSync(safe(dir+'/v2-overlay.json'))?json(dir+'/v2-overlay.json'):null;
 const config={...formatConfig(metadata.composition,metadata.format),composition:metadata.composition,directHtml:true,printCSS:dir+'/print.css',photo:metadata.photo?.path??null,directPhoto:metadata.photo??null,qr:metadata.qr?.path??null,systemFontDependency:read(dir+'/preview.html').toString().includes('✳')?'macOS Zapf Dingbats for rendered U+2733; not redistributed; portability unverified':null,...(metadata.composition==='C1'?{measuredPhoto:true}: {})};
 write(dir+'/composition.json',config);
 const baselineSource=read(config.template).toString();
 write(dir+'/template-baseline.html',baselineSource);
 // The comparison uses the unedited master, whose demo photo may no longer be
 // needed by the derived working copy. Stage missing master assets only for QA.
 for(const match of baselineSource.matchAll(/\b(?:src|href)\s*=\s*["'](assets\/[^"']+)["']/gi)){
  const asset=match[1];
  if(!fs.existsSync(safe(dir+'/'+asset)))write(dir+'/'+asset,read(asset));
 }
 const source=read(dir+'/preview.html').toString();
 if(/<\s*(script|iframe|object|embed|base)\b/i.test(source)||/\son[a-z]+\s*=/i.test(source)||/javascript\s*:/i.test(source))throw Error('DIRECT_HTML_UNSAFE: scripts, embedded documents, event handlers, base URLs and javascript URLs are forbidden');
 const urls=[...source.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)].map(x=>x[2]);
 for(const url of urls){if(/^(?:[a-z]+:|\/\/|\/)/i.test(url)||url.includes('\\')||url.split('/').includes('..'))throw Error('DIRECT_HTML_LOCAL_ONLY: external, absolute and parent-relative resources are forbidden: '+url);safe(dir+'/'+url);}
 const b=await browser();try{
  const {page,requests,blocked}=await openPage(b,dir+'/preview.html');if(blocked.length)throw Error('DIRECT_HTML_LOCAL_ONLY: blocked runtime request '+blocked.join(', '));
  const roots=page.locator('body>div');if(await roots.count()!==1)throw Error('DIRECT_HTML_STRUCTURE: exactly one body root div is required');
  const declared=await roots.evaluate(e=>({composition:e.dataset.sandboxComposition,format:e.dataset.sandboxFormat,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,photo:[...e.querySelectorAll('[data-sandbox-photo]')].map(x=>x.getAttribute('src')),gradient:[...e.querySelectorAll('[data-sandbox-gradient]')].map(x=>x.getAttribute('src')),qr:[...e.querySelectorAll('[data-sandbox-qr]')].map(x=>x.getAttribute('src'))}));
  if(declared.composition!==metadata.composition||declared.format!==metadata.format)throw Error('DIRECT_HTML_METADATA: HTML composition/format markers do not match sandbox-print.json');
  const expected=[config.width*96/25.4,config.height*96/25.4];if(Math.abs(declared.width-expected[0])>.02||Math.abs(declared.height-expected[1])>.02)throw Error('DIRECT_HTML_METADATA: rendered root dimensions do not match selected format');
  const exact=(actual,item,label)=>{const expected=item?[item.path]:[];if(canonical(actual)!==canonical(expected))throw Error('DIRECT_HTML_METADATA: '+label+' marker/path does not match sandbox-print.json');};exact(declared.photo,metadata.photo,'photo');exact(declared.gradient,metadata.gradient,'gradient');exact(declared.qr,metadata.qr,'QR');
  const g=await roots.evaluate(measure);write(dir+'/screen-geometry.json',g);
  const baselineOpened=await openPage(b,dir+'/template-baseline.html'),baseline=await baselineOpened.page.locator('body>div').evaluate(measure);write(dir+'/template-baseline-geometry.json',baseline);write(dir+'/template-baseline-requests.json',baselineOpened.requests);
  if(metadata.composition==='C1'){
   const layout=await roots.evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,images:[...e.children].slice(0,2).map(i=>({path:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight,position:getComputedStyle(i).objectPosition}))};});
   write(dir+'/photo-layout.json',layout);const p=spawnSync(path.join(root,'.venv/bin/python'),[safe('scripts/pad-c1.py'),safe(dir)],{encoding:'utf8'});if(p.status!==0)throw Error('C1 padding failed '+p.stderr);
  }
  const cdp=await page.context().newCDPSession(page);const capture=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:Math.ceil(expected[0]),height:Math.ceil(expected[1]),scale:254/96}});write(dir+'/preview-expanded.png',Buffer.from(capture.data,'base64'));
  const baselineCdp=await baselineOpened.page.context().newCDPSession(baselineOpened.page),baselineCapture=await baselineCdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:Math.ceil(expected[0]),height:Math.ceil(expected[1]),scale:254/96}});write(dir+'/template-baseline-expanded.png',Buffer.from(baselineCapture.data,'base64'));await baselineOpened.page.close();
  const overflow=r=>[Math.max(0,-r.x),Math.max(0,-r.y),Math.max(0,r.x+r.w-expected[0]),Math.max(0,r.y+r.h-expected[1])],violations=[];for(let i=0;i<g.ranges.length;i++)for(const r of g.ranges[i].rects){const value=overflow(r);if(value.some(x=>x>.01))violations.push({range:i,text:g.ranges[i].text,rect:r,overflow:value});}write(dir+'/direct-capacity.json',{pass:!violations.length,absoluteTrimBounds:true,baselineExceptions:[],violations});if(violations.length)throw Error('NATIVE_CAPACITY: Content exceeds trim bounds');
  const blocks=await roots.evaluate((e,{composition,overlayKind})=>{
   const children=[...(composition==='C1'?e.children[2]:composition==='C5'?e.children[0]:e).children];
   const decorative=children.filter(n=>n.hasAttribute('data-v2-overlay'));
   const expected=overlayKind==='quiet'||!overlayKind?0:1;
   if(decorative.length!==expected)throw Error('Unexpected decorative C1 overlay count');
   for(const n of decorative){const style=getComputedStyle(n);if(composition!=='C1'||n.getAttribute('data-v2-overlay')!==overlayKind||n.textContent.trim()||style.position!=='absolute'||style.pointerEvents!=='none')throw Error('Invalid decorative C1 overlay');}
   return children.filter(n=>!decorative.includes(n)).map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom};});
  },{composition:metadata.composition,overlayKind:overlay?.kind??null});for(let i=1;i<blocks.length;i++)if(blocks[i].top<blocks[i-1].bottom-.01)throw Error('NATIVE_CAPACITY: Content blocks collide');
  write(dir+'/preview-requests.json',requests);return {geometry:g,previewSha256:sha(read(dir+'/preview.html'))};
 }finally{await b.close();}
}
export async function render(dir){
 const config=json(dir+'/composition.json');let print=read(config.measuredPhoto?dir+'/photo-print.css':config.printCSS).toString();
 write(dir+'/print.html',read(dir+'/preview.html').toString().replace('</head>',`<style>${print}</style></head>`));
 const b=await browser();try{const {page,requests}=await openPage(b,dir+'/print.html');await page.emulateMedia({media:'print'});const printed=await page.locator('body>div').evaluate(measure),screen=json(dir+'/screen-geometry.json');
 if(canonical(printed.ranges)!==canonical(screen.ranges))throw Error('Print changed text Range geometry');
 const differences=screen.nodes.map((a,i)=>({before:a,after:printed.nodes[i]})).filter(x=>canonical(x.before)!==canonical(x.after));
 const color=['C3','C4'].includes(config.composition)?'rgb(240, 196, 100)':'rgb(2, 83, 214)';if(config.composition==='C1'?differences.length!==0:(differences.length!==1||differences[0].before.background!==color))throw Error('Unexpected print geometry/style changes');
 write(dir+'/print-geometry.json',{screen,printed,differences});write(dir+'/print-requests.json',requests);
 if(config.measuredPhoto){const cdp=await page.context().newCDPSession(page);const capture=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:Math.ceil((config.width+10)*96/25.4),height:Math.ceil((config.height+10)*96/25.4),scale:254/96}});write(dir+'/bleed-preview-expanded.png',Buffer.from(capture.data,'base64'));}
 await page.pdf({path:safe(dir+'/raw.pdf'),printBackground:true,preferCSSPageSize:true,margin:{top:0,right:0,bottom:0,left:0}});
 }finally{await b.close();}
 const art=await PDFDocument.load(read(dir+'/raw.pdf'));if(art.getPageCount()!==1)throw Error('Raw PDF must have one page');const p=art.getPages()[0],native=p.getMediaBox(),aw=mm(config.width+10),ah=mm(config.height+10),tw=mm(config.width),th=mm(config.height),bleed=mm(5),dy=ah-native.height;
 p.translateContent(0,dy);p.setMediaBox(0,0,aw,ah);p.setCropBox(0,0,aw,ah);p.setBleedBox(0,0,aw,ah);p.setTrimBox(bleed,bleed,tw,th);const bytes=await art.save();write(dir+'/no-marks.pdf',bytes);
 const marks=await PDFDocument.create(),mp=marks.addPage([mm(config.width+30),mm(config.height+30)]),slug=mm(10),offset=mm(2),length=mm(5);const [embedded]=await marks.embedPdf(bytes);mp.drawPage(embedded,{x:slug,y:slug,width:aw,height:ah});const segments=[];const mark=(start,end)=>{segments.push({start,end});mp.drawLine({start,end,thickness:.55,color:rgb(0,0,0)});};for(const y of [slug+bleed,slug+bleed+th]){mark({x:slug-offset-length,y},{x:slug-offset,y});mark({x:slug+aw+offset,y},{x:slug+aw+offset+length,y});}for(const x of [slug+bleed,slug+bleed+tw]){mark({x,y:slug-offset-length},{x,y:slug-offset});mark({x,y:slug+ah+offset},{x,y:slug+ah+offset+length});}mp.setBleedBox(slug,slug,aw,ah);mp.setTrimBox(slug+bleed,slug+bleed,tw,th);write(dir+'/marks.pdf',await marks.save());write(dir+'/pdf-geometry.json',{native,translation:[0,dy],scale:1,segments});
}
export function qa(dir){const py=path.join(safe('.venv'),process.platform==='win32'?'Scripts/python.exe':'bin/python');if(fs.realpathSync(py).includes('/.codex/'))throw Error('Python cannot resolve to a personal Codex runtime');const result=spawnSync(py,[safe('scripts/qa.py'),safe(dir)],{encoding:'utf8',env:{...process.env,PYTHONPATH:'',PYTHONNOUSERSITE:'1'}});if(result.status!==0)throw Error('PDF QA failed: '+result.stdout+result.stderr);return json(dir+'/qa.json');}
