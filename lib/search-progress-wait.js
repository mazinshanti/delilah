// Keep polling responsive while one bounded upstream refresh continues.
export async function waitForSearchProgress(job,refresh,{waitMs=60,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(!job.progressRefreshPromise){
  const work=Promise.resolve().then(()=>refresh(job));job.progressRefreshPromise=work;
  work.finally(()=>{if(job.progressRefreshPromise===work)job.progressRefreshPromise=null;}).catch(()=>{});
 }
 // The refresh owns its network timeout. A response deadline never cancels
 // shared work or marks an unfinished scan complete.
 await Promise.race([job.progressRefreshPromise,sleep(waitMs)]);
}
