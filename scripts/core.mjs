import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
export const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function safe(rel){
 if(typeof rel!=='string'||path.isAbsolute(rel)||path.win32.isAbsolute(rel)||/^[a-z]:/i.test(rel)||rel.split(/[\\/]/).some(p=>p==='..')||rel.includes('\0')||rel.includes('\\'))throw Error('Unsafe package path');
 const p=path.resolve(root,rel);let cur=root;
 const relative=path.relative(root,p);if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Path escapes package');
 if(fs.lstatSync(root).isSymbolicLink())throw Error('Package root cannot be a symlink');
 for(const bit of relative.split(path.sep).filter(Boolean)){cur=path.join(cur,bit);let stat;try{stat=fs.lstatSync(cur);}catch(e){if(e.code==='ENOENT')continue;throw e;}if(stat.isSymbolicLink())throw Error('Symlink path rejected: '+rel);}
 return p;
}
export const read=rel=>fs.readFileSync(safe(rel));
export const json=rel=>JSON.parse(read(rel));
export function write(rel,value){const p=safe(rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof value==='string'||ArrayBuffer.isView(value)?value:JSON.stringify(value,null,2)+'\n');}
export function immutable(rel,value){if(fs.existsSync(safe(rel)))throw Error('Refusing overwrite: '+rel);write(rel,value);}
export function atomic(rel,value){const tmp=rel+'.'+randomUUID()+'.tmp';write(tmp,value);fs.renameSync(safe(tmp),safe(rel));}
export const id=()=>new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
export const ignoredSystemEntry=name=>name==='.DS_Store'||name==='__MACOSX'||name==='.AppleDouble'||name.startsWith('._');
export function tree(dir){const list=[];for(const n of fs.readdirSync(safe(dir)).sort()){if(ignoredSystemEntry(n))continue;const rel=dir+'/'+n;const p=safe(rel);if(fs.statSync(p).isDirectory())list.push(...tree(rel));else list.push(rel);}return list;}
