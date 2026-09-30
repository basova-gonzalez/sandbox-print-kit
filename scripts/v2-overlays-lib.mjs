import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,safe,read,json,write,sha,canonical,tree} from './core.mjs';

export const overlayKinds=['quiet','plate-ink','plate-blue','scrim'];
const round=value=>Math.round(value*1000)/1000;

export function runPath(value){
 if(typeof value!=='string')throw Error('--run is required');
 const absolute=path.isAbsolute(value)?path.resolve(value):path.resolve(root,value);
 const relative=path.relative(root,absolute).split(path.sep).join('/');
 if(!/^work\/[a-z][a-z0-9-]{1,60}$/.test(relative))throw Error('--run must be one work/<name>-<format> folder inside this package');
 safe(relative);
 if(!fs.statSync(safe(relative)).isDirectory())throw Error('Run folder does not exist');
 const base=relative+'/c1',meta=json(base+'/sandbox-print.json');
 if(meta.composition!=='C1'||!meta.photo||!meta.gradient||!fs.existsSync(safe(relative+'/index.html')))throw Error('Run must contain a C1 working copy and index.html');
 return {run:relative,base,meta};
}

export function hashes(directory){
 return Object.fromEntries(tree(directory).map(file=>[file.slice(directory.length+1),sha(read(file))]));
}

export async function measureC1(base){
 const {browser,openPage}=await import('./render.mjs');
 const b=await browser();
 try{
  const {page,blocked}=await openPage(b,base+'/poster.html');
  if(blocked.length)throw Error('C1 uses blocked external resources: '+blocked.join(', '));
  return await page.locator('body>div').evaluate(rootElement=>{
   const content=rootElement.children[2];
   const headline=content?.querySelector('h3[data-sandbox-role="headline"]');
   const subtitle=content?.querySelector('p[data-sandbox-role="supporting-text"]');
   if(!content||!headline||!subtitle)throw Error('C1 headline or subtitle marker is missing');
   const origin=content.getBoundingClientRect();
   const lines=element=>{
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),boxes=[];
    for(let text; (text=walker.nextNode());){
     if(!text.textContent.trim())continue;
     const range=document.createRange();range.selectNodeContents(text);
     for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0)boxes.push({x:rect.x-origin.x,y:rect.y-origin.y,w:rect.width,h:rect.height});
    }
    boxes.sort((a,b)=>a.y-b.y||a.x-b.x);
    const groups=[];
    for(const box of boxes){
     const group=groups.find(item=>Math.abs(item.y-box.y)<2);
     if(group){const right=Math.max(group.x+group.w,box.x+box.w),bottom=Math.max(group.y+group.h,box.y+box.h);group.x=Math.min(group.x,box.x);group.y=Math.min(group.y,box.y);group.w=right-group.x;group.h=bottom-group.y;}
     else groups.push({...box});
    }
    if(!groups.length)throw Error('No visible text lines were measured');
    const bounds=element.getBoundingClientRect();
    return {boxes:groups,fontSize:parseFloat(getComputedStyle(element).fontSize),top:bounds.top-origin.top,bottom:bounds.bottom-origin.top};
   };
   return {width:origin.width,height:origin.height,headline:lines(headline),subtitle:lines(subtitle)};
  });
 }finally{await b.close();}
}

export function plateRects(geometry){
 const groups={};
 for(const kind of ['headline','subtitle']){
  const {boxes,fontSize,top,bottom}=geometry[kind],side=fontSize*.6,vertical=Math.max(1.5,fontSize*.06);
  const lines=boxes.map(box=>({
   left:Math.max(0,box.x-side),right:Math.min(geometry.width,box.x+box.w+side),
   top:Math.max(0,top-1,box.y-vertical),bottom:Math.min(geometry.height,bottom+1,box.y+box.h+vertical),
  }));
  for(let index=1;index<lines.length;index++)if(lines[index-1].bottom<lines[index].top){
   const middle=(lines[index-1].bottom+lines[index].top)/2;
   lines[index-1].bottom=middle;lines[index].top=middle;
  }
  groups[kind]=lines;
 }
 // Use the lower subtitle line as the shared left edge. This keeps the headline
 // plate off the trim while preserving a visible photo gap between the blocks.
 const sharedLeft=groups.subtitle.at(-1).left;
 const rightLimit=geometry.width-sharedLeft;
 const inset=Math.max(2,geometry.subtitle.fontSize*.25);
 for(const kind of ['headline','subtitle'])for(const box of geometry[kind].boxes){
  if(box.x<sharedLeft+inset||box.x+box.w>rightLimit-inset)throw Error('C1 text is too close to trim for an aligned plate; revise the C1 copy or layout');
 }
 for(const line of groups.headline){line.left=sharedLeft;line.right=Math.min(line.right,rightLimit);}
 for(const line of groups.subtitle)line.left=sharedLeft;
 const headlineRight=Math.max(...groups.headline.map(line=>line.right));
 const longestSubtitle=groups.subtitle.reduce((best,line,index,all)=>line.right>all[best].right?index:best,0);
 groups.subtitle[longestSubtitle].right=Math.min(rightLimit,Math.max(groups.subtitle[longestSubtitle].right,headlineRight));
 return ['headline','subtitle'].flatMap(kind=>groups[kind].map(line=>({kind,x:round(line.left),y:round(line.top),w:round(line.right-line.left),h:round(line.bottom-line.top)})));
}

function layerHtml(kind,geometry){
 if(kind==='plate-ink'||kind==='plate-blue'){
  const color=kind==='plate-ink'?'#111':'#0253D6',rects=plateRects(geometry);
  return '<div data-v2-overlay="'+kind+'" aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;z-index:-1">'+
   rects.map(rect=>'<i data-v2-plate-part="'+rect.kind+'" style="position:absolute;display:block;left:'+rect.x+'px;top:'+rect.y+'px;width:'+rect.w+'px;height:'+rect.h+'px;background:'+color+'"></i>').join('')+'</div>';
 }
 if(kind==='scrim'){
  const first=geometry.headline.boxes[0].y;
  const top=round(Math.max(0,first-geometry.height*.37));
  const gradient='linear-gradient(180deg,rgba(9,11,14,0) 0%,rgba(9,11,14,.2) 35%,rgba(9,11,14,.54) 68%,rgba(9,11,14,.78) 100%)';
  return '<div data-v2-overlay="scrim" aria-hidden="true" style="position:absolute;left:0;right:0;top:'+top+'px;bottom:0;pointer-events:none;z-index:-1;background:'+gradient+'"></div>';
 }
 throw Error('Unsupported overlay: '+kind);
}

function derivedMaterialId(base,kind){
 const long=base+'-'+kind;
 if(long.length<=60)return long;
 const hash=sha(long).slice(0,8),keep=60-kind.length-hash.length-2;
 return base.slice(0,keep)+'-'+hash+'-'+kind;
}

export function buildOverlay(base,target,kind,geometry,{run,variantName=kind}={}){
 if(!overlayKinds.includes(kind))throw Error('Unsupported overlay: '+kind);
 if(!/^[a-z][a-z0-9-]{1,24}$/.test(variantName))throw Error('Invalid derived variant name');
 if(fs.existsSync(safe(target)))throw Error('Refusing to overwrite staged overlay: '+target);
 const sourceMeta=json(base+'/sandbox-print.json'),basePoster=read(base+'/poster.html');
 const references=basePoster.toString()+read(base+'/print.css').toString();
 for(const file of tree(base)){
  const relative=file.slice(base.length+1);
  if(relative.startsWith('assets/photos/')&&relative!==sourceMeta.photo?.path&&!references.includes(relative))continue;
  write(target+'/'+relative,read(file));
 }
 const meta=json(target+'/sandbox-print.json');
 if(meta.composition!=='C1')throw Error('Overlays can only be built from C1');
 let html=basePoster.toString(),quietPhotoSha256=null;
 if(kind==='quiet'){
  if(!/\.jpe?g$/i.test(meta.photo?.path??''))throw Error('Quiet needs a prepared JPEG: run html:photo on c1 first');
  const source=target+'/'+meta.photo.path,destination=target+'/assets/photos/quiet-photo.jpg';
  const processPhoto=spawnSync(path.join(root,'.venv/bin/python'),[safe('scripts/v2-quiet-photo.py'),safe(source),safe(destination)],{encoding:'utf8'});
  if(processPhoto.error||processPhoto.status!==0)throw Error('Quiet photo failed: '+(processPhoto.error?.message||processPhoto.stderr?.trim()||processPhoto.stdout?.trim()));
  const old=`src="${meta.photo.path}"`;
  if(html.split(old).length!==2)throw Error('Marked C1 photo path is not unique');
  html=html.replace(old,'src="assets/photos/quiet-photo.jpg"');
  meta.photo={...meta.photo,path:'assets/photos/quiet-photo.jpg'};
  quietPhotoSha256=sha(read(destination));
 }else{
  if(!geometry)throw Error('Text geometry is required for '+kind);
  const opening=html.match(/<div style="position:absolute;inset:0;box-sizing:border-box;padding:[^"]*;display:flex;flex-direction:column">/g);
  if(opening?.length!==1)throw Error('C1 text container was not found uniquely');
  const layer=layerHtml(kind,geometry);
  html=html.replace(opening[0],opening[0].replace('">',';isolation:isolate">')+layer);
 }
 html=html.replace('</head>',`<!-- V2 DERIVED ${kind}: do not edit; edit c1/poster.html and rerun v2:overlays. --></head>`);
 write(target+'/poster.html',html);
 meta.material_id=derivedMaterialId(meta.material_id,variantName);
 write(target+'/sandbox-print.json',meta);
 write(target+'/WORKING-COPY.md',`# Derived ${variantName} overlay — do not edit\n\nEdit the source \`${run}/c1/poster.html\` instead, then regenerate all overlays with \`npm run v2:overlays -- --run ${run}\`. This folder is replaced on every run.\n\nExport this derived file with \`npm run html:pdf -- --html ${run}/c1-${variantName}/poster.html\`.\n`);
 write(target+'/v2-overlay.json',{kind,variantName,sourceMaterialId:json(base+'/sandbox-print.json').material_id,sourceTreeSha256:sha(canonical(hashes(base))),sourcePosterSha256:sha(basePoster),derivedPosterSha256:sha(html),derivedTreeSha256:sha(canonical(hashes(target))),quietPhotoSha256,derivedMaterialId:meta.material_id});
 return {kind,variantName,html:target+'/poster.html',materialId:meta.material_id};
}
