import './server-v1.4.js';
const port=Number(process.env.PORT||3000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function snapshot(label){
  try{
    const [h,s,c]=await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/health`).then(r=>r.json()),
      fetch(`http://127.0.0.1:${port}/api/sources`).then(r=>r.json()),
      fetch(`http://127.0.0.1:${port}/api/catalog/stats`).then(r=>r.json())
    ]);
    console.log('V14_QA',JSON.stringify({label,health:h,indexed:c.indexed,counts:c.counts,sources:(s.sources||[]).map(x=>({name:x.name,status:x.status,indexed:x.indexed,lastBatch:x.lastBatch||0,error:x.lastError||null}))}));
  }catch(e){console.log('V14_QA_ERROR',label,e?.message||String(e));}
}
await sleep(12000); await snapshot('12s');
await sleep(18000); await snapshot('30s');
await sleep(30000); await snapshot('60s');
