import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const innerPort=Number(process.env.DALELAH_UX_INNER_PORT||6900);
process.env.PORT=String(innerPort);
await import('./server-v15-carswitch.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));

async function inner(pathname,opts={}){
  const r=await fetch(`http://127.0.0.1:${innerPort}${pathname}`,{...opts,signal:opts.signal||AbortSignal.timeout(45000)});
  return r;
}

function patchUi(html=''){
  let out=String(html);
  out=out.replace(
    "function paintStatus(d={},scanning=false){",
    "function paintStatus(d={},scanning=false){window.__dalelahScanning=scanning;"
  );
  out=out.replace(
    "if(!listings.length){g.innerHTML='<div class=\"empty\">No matching cars found yet. Dalelah should broaden the search when inventory looks suspiciously low.</div>';return}",
    "if(!listings.length){g.innerHTML=window.__dalelahScanning?'<div class=\"empty\">Searching the Saudi market… verified cars will appear here as sources respond.</div>':'<div class=\"empty\">No matching cars found after the completed scan. Try broadening the year, model, city or price filters.</div>';return}"
  );
  out=out.replace("for(let i=0;i<12;i++)","for(let i=0;i<40;i++)");
  out=out.replace("listings=[];render();try{","listings=[];window.__dalelahScanning=true;render();try{");
  out=out.replace("}catch(e){if(seq!==runSeq)return;$('answerText').textContent=e.message;listings=[];render()}","}catch(e){if(seq!==runSeq)return;window.__dalelahScanning=false;$('answerText').textContent=e.message;listings=[];render()}");
  return out;
}

app.get('/',async(req,res)=>{
  try{
    const r=await inner('/',{signal:AbortSignal.timeout(10000)});
    const html=await r.text();
    if(!r.ok)return res.status(r.status).send(html);
    res.type('html').send(patchUi(html));
  }catch(e){res.status(502).send(`Dalelah UI unavailable: ${e?.message||e}`)}
});

app.get('/api/health',async(req,res)=>{
  try{
    const r=await inner('/api/health',{signal:AbortSignal.timeout(8000)});
    const d=await r.json();
    return res.status(r.status).json({...d,edge:'dalelah-v15-ux',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||d.renderGitCommit||null,progressiveUiGuard:true});
  }catch(e){return res.status(503).json({ok:false,edge:'dalelah-v15-ux',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||null,progressiveUiGuard:true,error:e?.message||'health unavailable'})}
});

async function proxy(req,res){
  try{
    const headers={};
    for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);
    let body;
    if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}
    const r=await inner(req.originalUrl,{method:req.method,headers,body,redirect:'manual'});
    const buf=Buffer.from(await r.arrayBuffer());
    for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);
    return res.status(r.status).send(buf);
  }catch(e){return res.status(502).json({error:e?.message||'Dalelah unavailable'})}
}
app.use(proxy);
app.listen(externalPort,()=>console.log(`Dalelah 1.5 UX edge listening on ${externalPort}; CarSwitch core ${innerPort}`));
