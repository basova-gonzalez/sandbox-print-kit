import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from '../scripts/core.mjs';
import {baseVariants,saveCheck,signatureFor} from '../scripts/v2-run-state.mjs';
import {refreshIndex} from '../scripts/v2-index.mjs';

const name=`pdf-test-${process.pid}-${Date.now()}`,run=`work/${name}-a6`,folder=path.join(root,run);
const command=(script,args)=>spawnSync(process.execPath,[`scripts/${script}`,...args],{cwd:root,encoding:'utf8'});
const poster=variant=>path.join(folder,variant,'poster.html');
const index=()=>fs.readFileSync(path.join(folder,'index.html'),'utf8');

try{
 const created=command('v2-variants.mjs',['--format','A6','--name',name,'--photo',path.join(root,'assets/photos/hall.png')]);
 assert.equal(created.status,0,created.stderr||created.stdout);

 // 1. Run variant detection regex matches base and overlay paths
 const runPattern=/^(work\/[a-z][a-z0-9-]{1,60})\/(c[1-5]|c1-(?:quiet|plate-ink|plate-blue|scrim))\/poster\.html$/;
 assert.ok(runPattern.test(run+'/c1/poster.html'));
 assert.ok(runPattern.test(run+'/c5/poster.html'));
 assert.ok(runPattern.test(run+'/c1-quiet/poster.html'));
 assert.ok(runPattern.test(run+'/c1-plate-ink/poster.html'));
 assert.ok(runPattern.test(run+'/c1-plate-blue/poster.html'));
 assert.ok(runPattern.test(run+'/c1-scrim/poster.html'));
 assert.ok(!runPattern.test('work/html/my-poster/poster.html'));
 const m=runPattern.exec(run+'/c1-quiet/poster.html');
 assert.equal(m[1],run);
 assert.equal(m[2],'c1-quiet');

 // 2. Index has no PDF link before any export
 assert.ok(!index().includes('Open PDF'));

 // 3. Simulate a PDF export by placing files in pdf/
 const pdfDir=path.join(folder,'pdf');
 fs.mkdirSync(pdfDir,{recursive:true});
 fs.writeFileSync(path.join(pdfDir,'c1-no-marks.pdf'),'fake-pdf-no-marks');
 fs.writeFileSync(path.join(pdfDir,'c1-marks.pdf'),'fake-pdf-marks');
 fs.writeFileSync(path.join(pdfDir,'c1-qa.json'),'{"pass":true}');

 // 4. Refresh the index and check the PDF link appears for c1 only
 refreshIndex(run);
 const html=index();
 assert.ok(html.includes('href="pdf/c1-no-marks.pdf"'),'index should link to c1 PDF');
 assert.ok(html.includes('Open PDF'),'index should show Open PDF text');
 assert.ok(!html.includes('href="pdf/c2-no-marks.pdf"'),'index should not link to c2 PDF (not exported)');

 // 5. pdf/ folder does not affect variant folder hashes
 const c1Files=fs.readdirSync(path.join(folder,'c1'));
 assert.ok(!c1Files.includes('pdf'),'pdf/ must not be inside c1/');
 const pdfDirStat=fs.statSync(pdfDir);
 assert.ok(pdfDirStat.isDirectory(),'pdf/ must be a sibling of variant folders');

 // 6. Second "export" overwrites the files
 fs.writeFileSync(path.join(pdfDir,'c1-no-marks.pdf'),'fake-pdf-v2');
 assert.equal(fs.readFileSync(path.join(pdfDir,'c1-no-marks.pdf'),'utf8'),'fake-pdf-v2');

 // 7. Simulate overlay PDF and check index picks it up
 const source=path.join(folder,'test-material.md');
 fs.writeFileSync(source,'A minimal test source.');
 saveCheck(run,source,baseVariants.map(v=>({variant:v,pass:true,signature:signatureFor(poster(v)),problems:[]})));
 const quietDir=path.join(folder,'c1-quiet');
 fs.mkdirSync(quietDir,{recursive:true});
 fs.copyFileSync(poster('c1'),path.join(quietDir,'poster.html'));
 fs.copyFileSync(path.join(folder,'c1','sandbox-print.json'),path.join(quietDir,'sandbox-print.json'));
 fs.writeFileSync(path.join(pdfDir,'c1-quiet-no-marks.pdf'),'fake-overlay-pdf');
 refreshIndex(run);
 const withOverlay=index();
 assert.ok(withOverlay.includes('href="pdf/c1-quiet-no-marks.pdf"'),'index should link to c1-quiet PDF');

 console.log('test-pdf-output: ok');
}finally{
 if(fs.existsSync(folder))fs.rmSync(folder,{recursive:true,force:true});
}
