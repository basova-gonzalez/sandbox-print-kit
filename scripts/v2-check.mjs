import fs from 'node:fs';
import path from 'node:path';
import {root,sha} from './core.mjs';
import {browser} from './render.mjs';
import {inspectVisibleText} from './visible-text-check.mjs';
import {demos,visibleHtml,qrProblem,signatureFor,runVariantFor,saveCheck} from './v2-run-state.mjs';
import {refreshIndex} from './v2-index.mjs';
import {posterPreview,savePreviews} from './v2-preview.mjs';

const fail=message=>{throw Error(message);};
const argv=process.argv.slice(2),htmls=[];let source=null;
for(let index=0;index<argv.length;index+=2){const key=argv[index],value=argv[index+1];if(!value||!['--source','--html'].includes(key))fail('Use --source <text.md> --html <poster.html> [--html <poster.html> …]');if(key==='--source'){if(source)fail('--source may appear once');source=value;}else htmls.push(value);}
if(!source||!htmls.length)fail('Use --source <text.md> --html <poster.html> [--html <poster.html> …]');

function regularFile(value,label){
 const resolved=path.resolve(value),stat=fs.existsSync(resolved)&&fs.lstatSync(resolved);
 if(!stat||!stat.isFile()||stat.isSymbolicLink())fail(`${label} must be a local regular file`);
 return resolved;
}
function tableValues(markdown){
 const lines=markdown.replace(/\r/g,'').split('\n');
 for(let index=0;index<lines.length-1;index+=1){
  if(!/^\|\s*(?:Место\s*\|\s*Текст|Slot\s*\|\s*Text)\s*\|\s*$/iu.test(lines[index])||!/^\|\s*:?-{3,}:?\s*\|\s*:?-{3,}:?\s*\|\s*$/u.test(lines[index+1]))continue;
  const values=[];
  for(let row=index+2;row<lines.length&&/^\|/.test(lines[row]);row+=1){const cells=lines[row].split('|');if(cells.length>=4)values.push(cells[2].trim());}
  return values;
 }
 return null;
}
function visibleMarkdown(markdown){return markdown.replace(/```[\s\S]*?```/g,'').replace(/!?(?:\[[^\]]*\]\([^)]*\))/g,'').replace(/[*_`#>]/g,' ').replace(/\s+/g,' ').trim();}
function unique(values){return [...new Set(values.map(value=>value.trim()).filter(Boolean))];}
function facts(text){
 const prices=unique(text.match(/(?:[$£€]\s*\d[\d,]*(?:\.\d{1,2})?(?:\s+(?:a|per)\s+[a-z]+)?|\b\d[\d,]*(?:\.\d{1,2})?\s*(?:AUD|USD|GBP|EUR)\b)/giu)??[]);
 const dates=unique(text.match(/\b(?:\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}|\d{4}-\d{2}-\d{2})\b/giu)??[]);
 const numbers=unique(text.match(/\b\d+(?:[.,]\d+)?\b/g)??[]);
 return {prices,dates,numbers};
}
function containsFact(text,kind,fact){
 if(kind!=='numbers')return text.toLowerCase().includes(fact.toLowerCase());
 return new RegExp(`(?<!\\d)${fact.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?!\\d)`).test(text);
}
try{
 const sourcePath=regularFile(source,'--source'),sourceBytes=fs.readFileSync(sourcePath),markdown=sourceBytes.toString('utf8'),table=tableValues(markdown),sourceText=(table??[visibleMarkdown(markdown)]).join('\n');
 const expected=facts(sourceText),results=[],b=await browser();
 try{for(const value of htmls){
  const htmlPath=regularFile(value,'--html'),rawHtml=fs.readFileSync(htmlPath,'utf8'),text=visibleHtml(rawHtml),before=signatureFor(htmlPath),missing=[];
  for(const [kind,values] of Object.entries(expected))for(const fact of values)if(!containsFact(text,kind,fact))missing.push({kind,value:fact});
  const info=runVariantFor(htmlPath),demo=demos(text,sourceText),qr=qrProblem(htmlPath,rawHtml);
  let preview=null,previewError=null;
  const layout=await inspectVisibleText(b,htmlPath,{capture:info?async page=>{try{preview=await posterPreview(page);}catch(error){previewError=error.message;}}:undefined});
  const changedDuringCheck=JSON.stringify(before)!==JSON.stringify(signatureFor(htmlPath));
  results.push({html:path.relative(root,htmlPath).split(path.sep).join('/')||htmlPath,info,signature:before,preview,previewError,missing,demo,qr,layout,changedDuringCheck,pass:!missing.length&&!demo.length&&!qr&&!layout.length&&!previewError&&!changedDuringCheck});
 }}finally{await b.close();}
 if(sha(fs.readFileSync(sourcePath))!==sha(sourceBytes))fail('Source material changed during v2:check; rerun the command');
 const byRun=new Map();
 for(const result of results)if(result.info){if(!byRun.has(result.info.run))byRun.set(result.info.run,[]);byRun.get(result.info.run).push({variant:result.info.variant,signature:result.signature,pass:result.pass,problems:[...result.missing.map(item=>`missing ${item.kind}: ${item.value}`),...result.demo.map(item=>`demo: ${item}`),...(result.qr?[result.qr]:[]),...result.layout.map(item=>`layout ${item.kind}: ${item.where}`),...(result.previewError?[`preview: ${result.previewError}`]:[]),...(result.changedDuringCheck?['poster or QR changed during check']:[])]});}
 for(const [run,runResults] of byRun){
  saveCheck(run,sourcePath,runResults);
  savePreviews(run,results.filter(result=>result.info?.run===run&&result.preview).map(result=>({variant:result.info.variant,png:result.preview,posterSha256:result.signature.posterSha256})));
  refreshIndex(run);
 }
 const lines=[`Source: ${path.relative(root,sourcePath).split(path.sep).join('/')||sourcePath}`,`Source mode: ${table?'table-right-column':'visible-markdown'}`,`Expected prices: ${expected.prices.join(', ')||'none'}`,`Expected dates: ${expected.dates.join(', ')||'none'}`,`Expected number tokens: ${expected.numbers.join(', ')||'none'}`];
 for(const result of results){lines.push(result.pass?`PASS ${result.html}`:`FAIL ${result.html}`);for(const missing of result.missing)lines.push(`  missing ${missing.kind.slice(0,-1)}: ${missing.value}`);for(const demo of result.demo)lines.push(`  demo text: ${demo}`);if(result.qr)lines.push(`  QR: ${result.qr}`);for(const issue of result.layout)lines.push(`  layout ${issue.kind}: ${JSON.stringify(issue.text.slice(0,120))} at ${issue.where}`);if(result.previewError)lines.push('  preview: '+result.previewError);if(result.changedDuringCheck)lines.push('  poster or QR changed during check; rerun v2:check');}
 lines.push('QR rule: a destination is required for QR variants; example.com, PLACEHOLDER, TBD and TODO are treated as placeholders.');
 lines.push('CTA and meaning are not assessed.');
 console.log(lines.join('\n'));if(results.some(result=>!result.pass))process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
