import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const v32Port=Number(process.env.DELILAH_V32_PORT||5700);
process.env.PORT=String(v32Port);
await import('./server-v32.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));

app.get('/api/health',async(_req,res)=>{
  try{
    const r=await fetch(`http://127.0.0.1:${v32Port}/api/health`,{signal:AbortSignal.timeout(9000)});
    const d=await r.json();
    if(!r.ok)return res.status(r.status).json(d);
    return res.json({...d,edge:'product-v33',brandName:'Dalelah',brandRename:true});
  }catch{return res.status(503).json({ok:false,edge:'product-v33',brandName:'Dalelah'})}
});

app.get('/',async(_req,res)=>{
  try{
    const r=await fetch(`http://127.0.0.1:${v32Port}/`,{signal:AbortSignal.timeout(10000)});
    let html=await r.text();
    html=html.replaceAll('Delilah','Dalelah');
    res.setHeader('cache-control','no-store');
    return res.type('html').send(html.replace('</body>','<script src="/hotfix-v33.js?v=1"></script></body>'));
  }catch{return res.status(502).send('Dalelah frontend unavailable')}
});

async function proxy(req,res){
  try{
    const headers={};
    for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);
    let body;
    if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}
    const r=await fetch(`http://127.0.0.1:${v32Port}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(50000)});
    const buf=Buffer.from(await r.arrayBuffer());
    for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);
    return res.status(r.status).send(buf)}catch{return res.status(502).json({error:'Dalelah upstream unavailable'})}
}

app.use(proxy);
app.listen(externalPort,()=>console.log(`Dalelah brand product-v33 running at http://localhost:${externalPort}`));
