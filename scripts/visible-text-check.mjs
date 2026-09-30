import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const inside=(file,directory)=>file===directory||file.startsWith(directory+path.sep);

export async function inspectVisibleText(browser,htmlPath,{capture}={}){
 const directory=fs.realpathSync(path.dirname(htmlPath));
 const context=await browser.newContext({viewport:{width:1600,height:1200},deviceScaleFactor:1,javaScriptEnabled:false});
 try{
  await context.route('**/*',route=>{
   try{
    const url=new URL(route.request().url());
    if(url.protocol!=='file:')return route.abort('blockedbyclient');
    const file=fs.realpathSync(fileURLToPath(url));
    return inside(file,directory)?route.continue():route.abort('blockedbyclient');
   }catch{return route.abort('blockedbyclient');}
  });
  const page=await context.newPage(),failed=[];
  page.on('requestfailed',request=>failed.push(request.url()));
  await page.goto(pathToFileURL(htmlPath).href,{waitUntil:'networkidle'});
  if(failed.length)throw Error('Browser could not load local poster resources: '+failed.join(', '));
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));});
  const issues=await page.evaluate(()=>{
   const root=document.querySelector('body > [data-sandbox-composition]');
   if(!root)return [{text:'',where:'body',kind:'missing poster root with data-sandbox-composition'}];
   const issues=[],records=[],rect=e=>e.getBoundingClientRect();
   const clean=value=>value.replace(/\s+/g,' ').trim();
   const label=e=>{const role=e.closest('[data-sandbox-role]');return role?`<${role.tagName.toLowerCase()} data-sandbox-role="${role.dataset.sandboxRole}">`:`<${e.tagName.toLowerCase()}>`;};
   const add=(record,kind,where)=>{const issue={text:record.text,where:where??record.where,kind};if(!issues.some(item=>item.text===issue.text&&item.where===issue.where&&item.kind===issue.kind))issues.push(issue);};
   const close=(a,b,tolerance=1)=>a.left>=b.left-tolerance&&a.right<=b.right+tolerance&&a.top>=b.top-tolerance&&a.bottom<=b.bottom+tolerance;
   const clipBox=e=>{const r=rect(e);return {left:r.left+e.clientLeft,top:r.top+e.clientTop,right:r.left+e.clientLeft+e.clientWidth,bottom:r.top+e.clientTop+e.clientHeight};};
   // C5's approved running line sits just over 2 mm from trim; use the
   // smallest shared inset that preserves that intentional V1 placement.
   const rootRect=rect(root),safeInset=2*96/25.4;
   const safe={left:rootRect.left+safeInset,top:rootRect.top+safeInset,right:rootRect.right-safeInset,bottom:rootRect.bottom-safeInset};
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
   while(node=walker.nextNode()){
    const content=clean(node.textContent??'');if(!content)continue;
    const parent=node.parentElement;
    if(!parent||parent.closest('script,style,noscript,[data-v2-overlay]'))continue;
    const computed=getComputedStyle(parent);
    if(computed.display==='none'||computed.visibility==='hidden'||Number(computed.opacity)===0)continue;
    const range=document.createRange();range.selectNodeContents(node);
    const owner=parent.closest('[data-sandbox-role]')??parent;
    const where=`${root.dataset.sandboxComposition}/${root.dataset.sandboxFormat} ${label(parent)}`;
    for(const box of range.getClientRects()){
     if(box.width<.1||box.height<.1)continue;
     const record={text:content,where,owner,box};records.push(record);
     if(!close(box,safe,1.5))add(record,'outside the 2 mm safe field');
     for(let ancestor=parent;ancestor;ancestor=ancestor.parentElement){
      const style=getComputedStyle(ancestor);
      const clipped=/^(hidden|clip|auto|scroll)$/.test(style.overflowX)||/^(hidden|clip|auto|scroll)$/.test(style.overflowY);
      if(clipped&&!close(box,clipBox(ancestor),1.5)){add(record,`clipped by ${label(ancestor)}`);break;}
      if(ancestor===root)break;
     }
     const ownerBox=rect(owner);
     const middleY=(box.top+box.bottom)/2;
     if((box.left<ownerBox.left-2||box.right>ownerBox.right+2||middleY<ownerBox.top-2||middleY>ownerBox.bottom+2)&&owner.clientWidth>0)add(record,'outside its text block');
    }
   }
   for(let index=0;index<records.length;index++)for(let other=index+1;other<records.length;other++){
    const a=records[index],b=records[other];if(a.owner===b.owner||a.owner.contains(b.owner)||b.owner.contains(a.owner))continue;
    const width=Math.max(0,Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left));
    const height=Math.max(0,Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top));
    if(width>Math.min(a.box.width,b.box.width)*.2&&height>Math.min(a.box.height,b.box.height)*.3)add(a,`overlaps text ${JSON.stringify(b.text.slice(0,72))} at ${b.where}`);
   }
   for(const asset of root.querySelectorAll('[data-sandbox-qr],[data-sandbox-fixed-asset]')){
    const box=rect(asset);
    for(const record of records){const a=record.box;const width=Math.max(0,Math.min(a.right,box.right)-Math.max(a.left,box.left));const height=Math.max(0,Math.min(a.bottom,box.bottom)-Math.max(a.top,box.top));if(width>Math.min(a.width,box.width)*.2&&height>Math.min(a.height,box.height)*.3)add(record,`overlaps ${asset.hasAttribute('data-sandbox-qr')?'QR':'fixed asset'}`);}
   }
   for(const record of records){
    const box=record.box,obstructions=[];
    for(const fraction of [.25,.5,.75]){
     const hit=document.elementFromPoint(box.left+box.width*fraction,box.top+box.height/2);
     if(hit&&hit!==record.owner&&!hit.contains(record.owner)&&!record.owner.contains(hit))obstructions.push(hit);
    }
    if(obstructions.length>=2)add(record,`covered by ${label(obstructions[0])}`);
   }
   return issues;
  });
  if(capture)await capture(page);
  return issues;
 }finally{await context.close();}
}
