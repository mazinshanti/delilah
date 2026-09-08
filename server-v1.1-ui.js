import express from 'express';
import path from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const externalPort=Number(process.env.PORT||3000);
const enginePort=Number(process.env.DALELAH_V11_ENGINE_PORT||6100);
process.env.PORT=String(enginePort);
await import('./server-v1.1.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public'),{index:false}));

app.get('/',async(_req,res)=>{
  try{
    let html=await readFile(path.join(__dirname,'public','index.html'),'utf8');
    const uiScripts='\n<script src="/hotfix-v28.js?v=11"></script>\n<script src="/hotfix-v31.js?v=11"></script>\n<script src="/hotfix-v32.js?v=11"></script>\n<script src="/hotfix-v33.js?v=11"></script>\n<script src="/hotfix-v35.js?v=11"></script>\n';
    html=html.replace('</body>',`${uiScripts}</body>`);
    res.setHeader('cache-control','no-store');
    return res.type('html').send(html);
  }catch(e){
    return res.status(500).send('Dalelah 1.1 frontend unavailable');
  }
});

async function proxy(req,res){
  try{
    const headers={};
    for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);
    let body;
    if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}
    const r=await fetch(`http://127.0.0.1:${enginePort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(70000)});
    const buf=Buffer.from(await r.arrayBuffer());
    for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);
    return res.status(r.status).send(buf);
  }catch{
    return res.status(502).json({error:'Dalelah 1.1 engine unavailable'});
  }
}

app.use(proxy);
app.listen(externalPort,()=>console.log(`Dalelah 1.1 UI shell running at http://localhost:${externalPort} -> standalone v36-baseline engine ${enginePort}`));
