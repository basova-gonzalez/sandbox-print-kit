import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {browser,openPage} from './render.mjs';
import {safe,write} from './core.mjs';

const run='work/demo-previews';
const images=[
  ['C1','c1','c1-full-photo.png'],
  ['C2','c2','c2-white-blue.png'],
  ['C3','c3','c3-announcement.png'],
  ['C4','c4','c4-dark-photo.png'],
  ['C5','c5','c5-yellow-photo.png']
];

fs.rmSync(safe(run),{recursive:true,force:true});
for(const [composition,folder] of images){
  const result=spawnSync(process.execPath,['scripts/direct-html.mjs','new','--composition',composition,'--format','A5','--name',`demo-preview-${folder}`,'--directory',`${run}/${folder}`],{cwd:safe('.'),encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr.trim()||result.stdout.trim()||`Could not create ${composition} preview`);
}

const b=await browser();
try{
  for(const [,folder,file] of images){
    const {page,blocked}=await openPage(b,`${run}/${folder}/poster.html`);
    if(blocked.length)throw Error(`Blocked preview requests: ${blocked.join(', ')}`);
    const root=page.locator('body > div');
    if(await root.count()!==1)throw Error(`Expected one poster root for ${folder}`);
    await root.screenshot({path:safe(`docs/images/${file}`)});
    await page.close();
  }

  const figures=images.map(([composition,,file])=>`<figure><img src="${file}" alt="${composition}"><figcaption>${composition}</figcaption></figure>`).join('');
  const board='docs/images/.demo-preview-board.html';
  write(board,`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;background:#ece9e1;font-family:Arial,sans-serif}main{width:1800px;padding:64px;display:grid;grid-template-columns:repeat(5,1fr);gap:28px}figure{margin:0;background:white;padding:12px;box-shadow:0 12px 30px #0002}img{display:block;width:100%;height:auto}figcaption{padding:12px 4px 2px;font-size:26px;font-weight:700;color:#111}</style><main>${figures}</main>`);
  const {page,blocked}=await openPage(b,board);
  if(blocked.length)throw Error(`Blocked board requests: ${blocked.join(', ')}`);
  await page.locator('main').screenshot({path:safe('docs/images/demo-compositions.png')});
  await page.close();
  fs.rmSync(safe(board),{force:true});
}finally{
  await b.close();
  fs.rmSync(safe(run),{recursive:true,force:true});
}

console.log('Generated five A5 demo previews and docs/images/demo-compositions.png');
