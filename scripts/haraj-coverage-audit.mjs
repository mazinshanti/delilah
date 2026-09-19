import {collectHarajInventory} from '../lib/haraj-inventory-collector.js';
import {writeFile} from 'node:fs/promises';
const result=await collectHarajInventory({queries:process.env.HARAJ_AUDIT_QUERY?[process.env.HARAJ_AUDIT_QUERY]:undefined,maxQueries:process.env.HARAJ_QUERIES||8,maxDetails:process.env.HARAJ_DETAILS||40,cursor:process.env.HARAJ_CURSOR,onProgress:d=>console.log(JSON.stringify({queries:d.pages,discovered:d.discovered,details:d.detailAttempts,accepted:d.records,errors:d.errors.length}))});
console.log(JSON.stringify(result.diagnostics));
// Explicit output is staging only; never overwrite the production snapshot.
if(process.env.HARAJ_AUDIT_OUTPUT)await writeFile(process.env.HARAJ_AUDIT_OUTPUT,JSON.stringify(result,null,2));
if(!result.listings.length)process.exitCode=1;
