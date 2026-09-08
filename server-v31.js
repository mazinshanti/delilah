import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const v30Port=Number(process.env.DELILAH_V30_PORT||5500);
process.env.PORT=String(v30Port);
await import('./server-v30.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));

app.get('/api/health',async(_req,res)=>{
  try{
    const r=await fetch(`http://127.0.0.1:${v30Port}/api/health`,{signal:AbortSignal.timeout(9000)});
    const d=await r.json();
    if(!r.ok)return res.status(r.status).json(d);
    return res.json({...d,edge:'product-v31',compactBrowseDropdowns:true,categoryDropdown:true,brandDropdown:true,sourceDropdown:true});
  }catch{return res.status(503).json({ok:false,edge:'product-v31'})}
});

app.get('/',async(_req,res)=>{
  try{
    const r=await fetch(`http://127.0.0.1:${v30Port}/`,{signal:AbortSignal.timeout(10000)});
    const html=await r.text();
    res.setHeader('cache-control','no-store');
    return res.type('html').send(html.replace('</body>','<script src="/hotfix-v31.js"></script></body>'));
  }catch{return res.status(502).send('Delilah frontend unavailable')}
});

async function proxy(req,res){
  try{
    const headers={};
    for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);
    let body;
    if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}
    const r=await fetch(`http://127.0.0.1:${v30Port}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(50000)});
    const buf=Buffer.from(await r.arrayBuffer());
    for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);
    return res.status(r.status).send(buf);
  }catch{return res.status(502).json({error:'Delilah upstream unavailable'})}
}
app.use(proxy);
app.listen(externalPort,()=>console.log(`Delilah compact browse product-v31 running at http://localhost:${externalPort}`));
