import {spawnSync} from 'node:child_process';
import {safe} from './core.mjs';
if(process.version!=='v20.20.0')throw Error('This checkpoint requires Node 20.20.0');
const result=spawnSync(process.execPath,[safe('node_modules/playwright/cli.js'),'install','chromium'],{stdio:'inherit',env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:safe('.browsers')}});
process.exitCode=result.status??1;
