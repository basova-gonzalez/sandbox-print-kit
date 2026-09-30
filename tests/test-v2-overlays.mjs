import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,read,sha,json} from '../scripts/core.mjs';
import {browser,openPage,measure} from '../scripts/render.mjs';
import {plateRects} from '../scripts/v2-overlays-lib.mjs';
import {saveCheck,signatureFor,baseVariants} from '../scripts/v2-run-state.mjs';

const sample={width:200,height:140,headline:{boxes:[{x:20,y:10,w:100,h:30},{x:20,y:42,w:130,h:30}],fontSize:40,top:10,bottom:72},subtitle:{boxes:[{x:20,y:90,w:110,h:15},{x:20,y:106,w:70,h:15}],fontSize:16,top:90,bottom:121}};
const outline=plateRects(sample),headlineOutline=outline.filter(rect=>rect.kind==='headline'),subtitleOutline=outline.filter(rect=>rect.kind==='subtitle');
assert.equal(headlineOutline.length,2);
assert.equal(subtitleOutline.length,2);
assert.ok(headlineOutline.every(rect=>rect.x===subtitleOutline[1].x&&rect.x>0));
assert.equal(Math.max(...headlineOutline.map(rect=>rect.x+rect.w)),subtitleOutline[0].x+subtitleOutline[0].w);
assert.ok(subtitleOutline[1].x+subtitleOutline[1].w<subtitleOutline[0].x+subtitleOutline[0].w,'Subtitle keeps its right-hand step');
assert.throws(()=>plateRects({...sample,width:160}),/too close to trim/);

const name=`m5-test-${process.pid}-${Date.now()}`;
const run=`work/${name}-a6`;
const folder=path.join(root,run);
const command=(script,args)=>spawnSync(process.execPath,[`scripts/${script}`,...args],{cwd:root,encoding:'utf8'});
const variants=['quiet','plate-ink','plate-blue','scrim'];
try{
 const created=command('v2-variants.mjs',['--format','A6','--name',name,'--photo',path.join(root,'assets/photos/hall.png')]);
 assert.equal(created.status,0,created.stderr||created.stdout);
 // This test isolates overlay mechanics; the separate guard test exercises real
 // PASS/FAIL behaviour. Seed a checked state without changing the demo posters.
 const source=path.join(folder,'test-material.md');
 fs.writeFileSync(source,'Overlay test fixture.');
 saveCheck(run,source,baseVariants.map(variant=>({variant,pass:true,signature:signatureFor(path.join(folder,variant,'poster.html')),problems:[]})));
 const sourceHash=sha(read(`${run}/c1/poster.html`));
 const sourcePhotoHash=sha(read(`${run}/c1/assets/photos/selected-photo.jpg`));
 const first=command('v2-overlays.mjs',['--run',run]);
 assert.equal(first.status,0,first.stderr||first.stdout);
 const index1=read(`${run}/index.html`).toString();
 assert.equal((index1.match(/data-v2-state="derived"/g)||[]).length,4);
 assert.equal((index1.match(/target="_blank"/g)||[]).length,9);
 assert.equal(sha(read(`${run}/c1/poster.html`)),sourceHash);
 assert.equal(sha(read(`${run}/c1/assets/photos/selected-photo.jpg`)),sourcePhotoHash);
 const ids=new Set([json(`${run}/c1/sandbox-print.json`).material_id]);
 for(const kind of variants){
  const prefix=`${run}/c1-${kind}`;
  const meta=json(prefix+'/sandbox-print.json'),overlay=json(prefix+'/v2-overlay.json');
  assert.equal(overlay.kind,kind);
  assert.equal(overlay.sourcePosterSha256,sourceHash);
  assert.equal(overlay.derivedPosterSha256,sha(read(prefix+'/poster.html')));
  assert.match(read(prefix+'/WORKING-COPY.md').toString(),/do not edit/i);
  assert.equal(ids.has(meta.material_id),false);
  ids.add(meta.material_id);
  assert.match(index1,new RegExp('c1-'+kind+'/poster.html'));
  assert.equal(fs.existsSync(path.join(folder,'previews','c1-'+kind+'.png')),true);
  assert.equal(fs.existsSync(path.join(root,prefix,'assets/photos/climber.png')),false,'Unused demo photo should not be copied into '+kind);
 }
 const quiet=json(`${run}/c1-quiet/sandbox-print.json`);
 assert.equal(quiet.photo.path,'assets/photos/quiet-photo.jpg');
 assert.notEqual(sha(read(`${run}/c1-quiet/${quiet.photo.path}`)),sourcePhotoHash);
 assert.doesNotMatch(read(`${run}/c1-quiet/poster.html`).toString(),/filter\s*:/i);
 assert.match(read(`${run}/c1-plate-ink/poster.html`).toString(),/background:#111/);
 assert.match(read(`${run}/c1-plate-blue/poster.html`).toString(),/background:#0253D6/);
 const scrimHtml=read(`${run}/c1-scrim/poster.html`).toString();
 assert.match(scrimHtml,/data-v2-overlay="scrim"/);
 assert.match(scrimHtml,/rgba\(9,11,14,\.78\) 100%/);
 assert.doesNotMatch(scrimHtml,/data-v2-candidate=/);
 const note=path.join(folder,'c1-plate-ink','WORKING-COPY.md');
 const noteBefore=fs.readFileSync(note);
 fs.appendFileSync(note,'tampered');
 const tampered=command('direct-html.mjs',['pdf','--html',`${run}/c1-plate-ink/poster.html`]);
 assert.notEqual(tampered.status,0);
 assert.match(tampered.stderr,/derived resources changed/i);
 fs.writeFileSync(note,noteBefore);
 const b=await browser();
 try{
  const geometry=async variant=>{
   const opened=await openPage(b,`${run}/${variant}/poster.html`);
   try{return (await opened.page.locator('body>div').evaluate(measure)).ranges;}
   finally{await opened.page.close();}
  };
  const base=await geometry('c1');
  for(const kind of variants)assert.deepEqual(await geometry('c1-'+kind),base,`Text geometry changed in ${kind}`);
 }finally{await b.close();}

 const edited=read(`${run}/c1/poster.html`).toString().replace('Climb<br>','Climb!<br>');
 assert.notEqual(edited,read(`${run}/c1/poster.html`).toString());
 fs.writeFileSync(path.join(folder,'c1','poster.html'),edited);
 const stale=command('direct-html.mjs',['pdf','--html',`${run}/c1-quiet/poster.html`]);
 assert.notEqual(stale.status,0);
 assert.match(stale.stderr,/edit C1 and regenerate derived copies/i);
 saveCheck(run,source,[{variant:'c1',pass:true,signature:signatureFor(path.join(folder,'c1','poster.html')),problems:[]}]);
 const second=command('v2-overlays.mjs',['--run',run]);
 assert.equal(second.status,0,second.stderr||second.stdout);
 assert.equal(read(`${run}/index.html`).toString(),index1,'Rerun must replace, not duplicate index cards');
 assert.equal(read(`${run}/c1/poster.html`).toString(),edited,'Rerun must not modify C1');
 for(const kind of variants)assert.match(read(`${run}/c1-${kind}/poster.html`).toString(),/Climb!<br>/);
 console.log('test-v2-overlays: ok');
}finally{
 if(fs.existsSync(folder))fs.rmSync(folder,{recursive:true,force:true});
}
