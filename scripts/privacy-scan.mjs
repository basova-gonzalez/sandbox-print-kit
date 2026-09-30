import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workingOnly=process.argv.length===3&&process.argv[2]==='--working-tree';
if(process.argv.length>(workingOnly?3:2))throw Error('Use privacy-scan.mjs [--working-tree]');
const sha=data=>createHash('sha256').update(data).digest('hex');
const forbiddenHashes=new Set([
  'e64631b092247359a5d342951ac2f5e8d9ee1873e4a75dcbd2273ec85f53aebb',
  '6512e56b9c7a36d32ab06cfa115e67cb8200be2d0515f50f035ebf183ccceedd',
  'e9ab738ec7853a2c976025b3e94225504eb86dc69c721f0cdd4e7bd05b8c9daa',
  'aca70c7d2c1cdda82c424ce549a55a3c62ddee74a9b9595c6b4a941a960f2286',
  'b4514542fa65c4dbbad2cc209def2d25d5442b4a0881c6d5f35584a8b4df78ea',
  'da83ddd032a95be524b926330177ade0a91193c32bad79b5b10eb9e28fd909c0',
  '7c32c20031c599684b545975a6e5b7ebc8caf5844d87495748ec84c9bf62bcaa',
  'fc01f8e94aae351fe15a2414660f469ac54bd6cddcfe8001fb3a8b5abc4d044f',
  '39413b4516e7f4c6f373fba4cac91eabba61691539f76072b1814199472313e7',
  'dfbf45fee977b1e4429542ef658f61a7a1a379ab414223749fb983ae0e9d52a4'
]);
const forbiddenText=[
  ['client domain',/sandboxbouldering\.com\.au/iu],
  ['client location',new RegExp(`\\b${['Silver','water'].join('')}\\b`,'iu')],
  ['private absolute path',/(?:\/Users\/|[A-Z]:\\Users\\)/u],
  ['private workspace name',new RegExp(`(?:${['my','_OS'].join('')}|${['sandbox','_flayers_IN'].join('')})`,'u')],
  ['correspondence name',new RegExp(['Dima','Torzok'].join(''),'iu')],
  ['owner shorthand',new RegExp(`(?:\\b${['Ka','te'].join('')}\\b|\\b${['Ке','йт'].join('')}\\b)`,'u')],
  ['unreplaced client field',/(?:\[\s*street address\s*\]|\[\s*coach name\s*\]|\[\s*price\s*\]|\bTBC\b)/iu],
  ['original logo vector',/M9\.72378 9\.49258/iu],
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ['GitHub token',/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/u],
  ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/u]
];
const forbiddenNames=/(?:^|\/)(?:\.DS_Store|__MACOSX|\.AppleDouble)(?:$|\/)|(?:^|\/)\._/u;
const failures=[];

function inspect(name,data,scope){
  if(forbiddenNames.test(name))failures.push(`${scope}: forbidden filename ${name}`);
  if(forbiddenHashes.has(sha(data)))failures.push(`${scope}: forbidden client asset hash at ${name}`);
  if(data.includes(0))return;
  const text=data.toString('utf8');
  for(const [label,pattern] of forbiddenText)if(pattern.test(text))failures.push(`${scope}: ${label} in ${name}`);
}

function sourceFiles(dir,prefix=''){
  const skip=new Set(['.git','node_modules','.venv','.tools','.browsers','.bootstrap','work','output']);
  const files=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(skip.has(entry.name))continue;
    const rel=prefix?`${prefix}/${entry.name}`:entry.name;
    const full=path.join(dir,entry.name);
    if(entry.isSymbolicLink())failures.push(`working tree: symlink forbidden at ${rel}`);
    else if(entry.isDirectory())files.push(...sourceFiles(full,rel));
    else if(entry.isFile())files.push(rel);
  }
  return files;
}

for(const rel of sourceFiles(root))inspect(rel,fs.readFileSync(path.join(root,rel)),'working tree');

if(!workingOnly){
  const git=(args,options={})=>execFileSync('git',['-C',root,...args],{...options,maxBuffer:50_000_000});
  const top=git(['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  if(path.resolve(top)!==path.resolve(root))throw Error('Privacy scan requires this repository to be the exact Git root');
  const commits=git(['rev-list','--all'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  if(!commits.length)throw Error('Privacy scan requires at least one commit');
  const seen=new Set();
  for(const commit of commits){
    const rows=git(['ls-tree','-r','--format=%(objectname)%x09%(path)',commit],{encoding:'utf8'}).split('\n').filter(Boolean);
    for(const row of rows){
      const tab=row.indexOf('\t'),object=row.slice(0,tab),name=row.slice(tab+1);
      if(seen.has(object))continue;
      seen.add(object);
      inspect(name,git(['cat-file','blob',object]),`history ${commit.slice(0,12)}`);
    }
  }
  const messages=git(['log','--all','--format=%H%x09%B%x00']);
  inspect('commit-messages',messages,'history metadata');
}

if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`PASS: privacy scan (${workingOnly?'working tree':'working tree and full Git history'})`);
