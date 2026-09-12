const role=String(process.env.DALELAH_RUNTIME_ROLE||'front').trim().toLowerCase();

if(role==='legacy-deep'){
  console.log('Dalelah runtime role: legacy-deep');
  await import('./server-v15-marketplace.js');
}else{
  console.log('Dalelah runtime role: front');
  await import('./server-core-candidate.js');
}
