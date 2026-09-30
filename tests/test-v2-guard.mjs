import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from '../scripts/core.mjs';
import {baseVariants,qrProblem,saveCheck,signatureFor} from '../scripts/v2-run-state.mjs';
import {refreshIndex} from '../scripts/v2-index.mjs';

const name=`guard-test-${process.pid}-${Date.now()}`,run=`work/${name}-a6`,folder=path.join(root,run);
const command=(script,args)=>spawnSync(process.execPath,[`scripts/${script}`,...args],{cwd:root,encoding:'utf8'});
const poster=variant=>path.join(folder,variant,'poster.html');
const index=()=>fs.readFileSync(path.join(folder,'index.html'),'utf8');
try{
 const created=command('v2-variants.mjs',['--format','A6','--name',name,'--photo',path.join(root,'assets/photos/hall.png')]);
 assert.equal(created.status,0,created.stderr||created.stdout);
 assert.equal((index().match(/data-v2-state="unfilled"/g)??[]).length,5);
 const before=command('v2-overlays.mjs',['--run',run]);
 assert.notEqual(before.status,0);
 assert.match(before.stderr,/c1: not filled; c2: not filled/);
 assert.match(before.stderr,/npm run v2:check -- --source <material\.md>/);
 assert.equal(fs.existsSync(path.join(folder,'c1-quiet')),false);

 const source=path.join(folder,'test-material.md');
 fs.writeFileSync(source,'A minimal test source without prices or dates.');
 const placeholder=command('direct-html.mjs',['qr','--html',`${run}/c1/poster.html`,'--destination','https://example.com/PLACEHOLDER-book']);
 assert.equal(placeholder.status,0,placeholder.stderr||placeholder.stdout);
 const checked=command('v2-check.mjs',['--source',source,'--html',`${run}/c1/poster.html`]);
 assert.notEqual(checked.status,0);
 assert.match(checked.stdout,/FAIL .*c1\/poster\.html/);
 assert.match(checked.stdout,/QR destination looks like a placeholder .*example\.com, PLACEHOLDER/);
 assert.equal(fs.existsSync(path.join(folder,'previews','c1.png')),true);
 assert.match(index(),/src="previews\/c1\.png"/);
 const record=JSON.parse(fs.readFileSync(path.join(folder,'v2-check.json'),'utf8'));
 assert.equal(record.variants.c1.pass,false);
 assert.match(record.variants.c1.posterSha256,/^[a-f0-9]{64}$/);
 assert.equal(record.variants.c2,undefined);
 const failedCheck=command('v2-overlays.mjs',['--run',run]);
 assert.notEqual(failedCheck.status,0);
 assert.match(failedCheck.stderr,/c1: not filled/);
 assert.equal(fs.existsSync(path.join(folder,'c1-quiet')),false);

 const metaPath=path.join(folder,'c2','sandbox-print.json'),meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
 meta.qr.destination=null;
 fs.writeFileSync(metaPath,JSON.stringify(meta));
 assert.match(qrProblem(poster('c2'),fs.readFileSync(poster('c2'),'utf8')),/destination is missing/);
 meta.qr.destination='https://gym.test/TODO';
 fs.writeFileSync(metaPath,JSON.stringify(meta));
 assert.match(qrProblem(poster('c2'),fs.readFileSync(poster('c2'),'utf8')),/looks like a placeholder/);
 meta.qr.destination='https://kabago.ru/cases/sandbox-print//book';
 fs.writeFileSync(metaPath,JSON.stringify(meta));
 const withoutQr={...meta,qr:null};
 fs.writeFileSync(metaPath,JSON.stringify(withoutQr));
 assert.match(qrProblem(poster('c2'),fs.readFileSync(poster('c2'),'utf8')),/destination is missing/);
 fs.writeFileSync(metaPath,JSON.stringify(meta));

 // Isolate the gate and status renderer from copy/layout validation: the real
 // demo posters are not represented as product-ready material in this test.
 saveCheck(run,source,baseVariants.map(variant=>({variant,pass:true,signature:signatureFor(poster(variant)),problems:[]})));
 refreshIndex(run);
 assert.equal((index().match(/data-v2-state="checked"/g)??[]).length,5);
 const originalSource=fs.readFileSync(source);
 fs.appendFileSync(source,'\nChanged source.');
 const sourceStale=command('v2-overlays.mjs',['--run',run]);
 assert.notEqual(sourceStale.status,0);
 assert.match(sourceStale.stderr,/c1: changed since check/);
 fs.writeFileSync(source,originalSource);
 const ready=command('v2-overlays.mjs',['--run',run]);
 assert.equal(ready.status,0,ready.stderr||ready.stdout);
 assert.equal((index().match(/data-v2-state="derived"/g)??[]).length,4);
 const derivative=fs.readFileSync(path.join(folder,'c1-quiet','poster.html'));
 fs.appendFileSync(poster('c1'),'\n<!-- changed after the synthetic check -->\n');
 const stale=command('v2-overlays.mjs',['--run',run]);
 assert.notEqual(stale.status,0);
 assert.match(stale.stderr,/c1: changed since check/);
 assert.doesNotMatch(stale.stderr,/c2: /);
 assert.deepEqual(fs.readFileSync(path.join(folder,'c1-quiet','poster.html')),derivative);
 assert.match(index(),/data-v2-state="changed"/);
 assert.equal((index().match(/data-v2-state="checked"/g)??[]).length,4);

 const mixed=JSON.parse(fs.readFileSync(path.join(folder,'v2-check.json'),'utf8'));
 delete mixed.variants.c3;
 fs.writeFileSync(path.join(folder,'v2-check.json'),JSON.stringify(mixed,null,2)+'\n');
 refreshIndex(run);
 assert.match(index(),/data-v2-state="derived"/);
 assert.match(index(),/data-v2-state="unfilled"/);
 console.log('test-v2-guard: ok');
 if(process.env.V2_KEEP_STATE_FIXTURE==='1')console.log('Synthetic state fixture: '+path.join(folder,'index.html'));
}finally{
 if(process.env.V2_KEEP_STATE_FIXTURE!=='1'&&fs.existsSync(folder))fs.rmSync(folder,{recursive:true,force:true});
}
