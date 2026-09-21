import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {inventoryRefreshReport} from '../lib/inventory-refresh-report.js';
const read=async path=>JSON.parse(gunzipSync(await readFile(path)));
const snapshot=await read('data/market-inventory.json.gz');
let state={};try{state=await read('data/stock-crawl-state.json.gz');}catch{}
const report=inventoryRefreshReport(snapshot,state);
await mkdir('audit',{recursive:true});await writeFile('audit/inventory-refresh-status.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
