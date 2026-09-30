import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
const dir=process.argv[2];
const data=fs.existsSync(path.join(dir,'input.json'))?JSON.parse(fs.readFileSync(path.join(dir,'input.json'))):null;
const config=JSON.parse(fs.readFileSync(path.join(dir,'composition.json')));
const decode=file=>{const png=PNG.sync.read(fs.readFileSync(file));return jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data;};
if(data?.qr===null||(!data&&!config.qr)){console.log(JSON.stringify({present:false}));}
else{const source=decode(path.join(dir,data?'assets/qr-current.png':config.qr));if(!source)throw Error('Source QR is unreadable');if(data&&source!==data.qr.destination)throw Error('QR destination mismatch');const geometry=JSON.parse(fs.readFileSync(path.join(dir,'screen-geometry.json'))),box=geometry.nodes.find(n=>n.tag==='IMG'&&n.background==='rgb(255, 255, 255)'&&n.w>0&&Math.abs(n.w-n.h)<.1);if(!box)throw Error('Missing measured QR rectangle');
for(const name of ['no-marks','marks']){const full=PNG.sync.read(fs.readFileSync(path.join(dir,name+'-full.png'))),offset=name==='marks'?150:50,scale=254/96,x=Math.floor(offset+box.x*scale)-2,y=Math.floor(offset+box.y*scale)-2,w=Math.ceil(box.w*scale)+4,h=Math.ceil(box.h*scale)+4;if(x<0||y<0||x+w>full.width||y+h>full.height)throw Error('QR crop outside PDF');const crop=new PNG({width:w,height:h});PNG.bitblt(full,crop,x,y,w,h,0,0);if(jsQR(new Uint8ClampedArray(crop.data),w,h)?.data!==source)throw Error('Final PDF QR unreadable/mismatched');}console.log(JSON.stringify({present:true,destination:source,finalVariantsDecoded:true,productionApproved:false}));}
