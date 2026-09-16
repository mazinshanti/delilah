/* Progressive inventory UX. Uses the existing minimal shell and day/night theme. */
(()=>{
 const filterGrid=document.querySelector('.filterGrid');
 for(const [id,label,type]of [['minPrice','Min price','number'],['trim','Trim','text']]){const field=document.createElement('div');field.className='field';field.innerHTML=`<label for="${id}">${label}</label><input id="${id}" type="${type}">`;filterGrid.append(field);}
 document.querySelectorAll('.field').forEach(field=>{const input=field.querySelector('input,select'),label=field.querySelector('label');if(input&&label)label.htmlFor=input.id;});
 let visible=24,activeController=null,lastQuery='',lastResponse={},busy=false;
 const oldRender=render;
 const more=document.createElement('button');more.id='loadMore';more.className='shareBtn';more.textContent='Show more cars';more.hidden=true;$('grid').after(more);
 const sort=document.createElement('select');sort.id='sort';sort.setAttribute('aria-label','Sort results');sort.innerHTML='<option value="relevance">Best matches</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="year-desc">Newest year</option>';$('shareSearch').before(sort);
 $('sub').setAttribute('role','status');$('sub').setAttribute('aria-live','polite');$('q').setAttribute('aria-label','Search make, model or year');
 const safeUrl=v=>{if(typeof v!=='string'||!v.trim())return '';try{const u=new URL(v,location.origin);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
 render=function(){
  const all=listings;let ordered=[...all];
  if(sort.value==='price-asc')ordered.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
  if(sort.value==='price-desc')ordered.sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity));
  if(sort.value==='year-desc')ordered.sort((a,b)=>(b.year||0)-(a.year||0));
  listings=ordered.slice(0,visible).map(c=>({...c,url:safeUrl(c.url),image:safeUrl(c.image),displayImage:safeUrl(c.displayImage)}));
  oldRender();listings=all;
  if(!all.length)$('grid').innerHTML=`<div class="empty"><b>${busy?'Searching for matching cars…':lastResponse.partial?'Some sources could not respond.':'No matching listings found.'}</b>${busy?'Results will appear here as they arrive.':lastResponse.partial?'Try again shortly or broaden your filters.':'Try a different model or clear your filters.'}</div>`;
  more.hidden=visible>=all.length;more.textContent=`Show more cars (${Math.max(0,all.length-visible)} remaining)`;
 };
 more.onclick=()=>{visible+=24;render();};sort.onchange=()=>{visible=24;render();};
 const originalFilters=filters;
 filters=()=>({...originalFilters(),category:$('category').value,minPrice:$('minPrice').value,trim:$('trim').value});
 paintStatus=function(d={},scanning=false){lastResponse=d;const sources=new Set(listings.map(c=>c.source));$('answerText').textContent=d.queryCorrections?.length?`Searching for ${d.understanding?.normalizedQuery||lastQuery}`:'';$('answer').classList.toggle('show',Boolean(d.queryCorrections?.length));$('sub').textContent=`${listings.length} matching ${condition} cars · ${sources.size} sources${scanning?' · checking more…':d.partial?' · some sources unavailable':''}`;render();};
 async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.any([activeController.signal,AbortSignal.timeout(20000)])});const d=await r.json();if(!r.ok)throw new Error(d.error||'Search unavailable');return d;}
 pollSearch=async function(id,seq){const started=Date.now();let latest={};while(Date.now()-started<95000&&seq===runSeq){await sleep(1500);if(seq!==runSeq)return latest;try{const d=await json(`/api/search/progress/${encodeURIComponent(id)}`);if(seq!==runSeq)return latest;latest=d;mergeListings(d.listings||[]);const done=d.complete===true||d.marketScanComplete===true;paintStatus(d,!done);if(done)return d;}catch(e){if(activeController.signal.aborted)return latest;latest={...latest,partial:true};}}return {...latest,partial:true};};
 run=async function(override,options={}){
  const query=String(override??$('q').value).trim()||'__all_cars__';lastQuery=query;activeController?.abort();activeController=new AbortController();
  const seq=++runSeq;busy=true;visible=24;listings=[];lastResponse={};$('search').classList.add('loading');$('ask').textContent='Searching…';$('shareSearch').hidden=false;render();
  const f=filters();const params=new URLSearchParams({q:query,condition});for(const[k,v]of Object.entries(f))if(v)params.set(k,v);
  if(options.updateUrl!==false)history.replaceState(null,'',`/?${params}`);
  try{
   // Indexed results arrive first; live search adds fresh matches without blanking them.
   const cached=await json(`/api/inventory?${params}&pageSize=100`).catch(()=>null);
   if(seq!==runSeq)return;if(cached?.listings?.length){mergeListings(cached.listings);paintStatus(cached,true);}
   const d=await json('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters:f})});if(seq!==runSeq)return;mergeListings(d.listings||[]);paintStatus(d,!d.complete);
   const end=d.searchId&&!d.complete?await pollSearch(d.searchId,seq):d;if(seq!==runSeq)return;busy=false;paintStatus(end||d,false);
  }catch(e){if(seq!==runSeq)return;busy=false;lastResponse={partial:true};$('sub').textContent=listings.length?'Showing collected matches; live sources are temporarily unavailable.':'Search is temporarily unavailable. Please try again.';render();}
  finally{if(seq===runSeq){busy=false;$('search').classList.remove('loading');$('ask').textContent='Search';}}
 };
 $('usedTab').onclick=()=>{setCondition('used');if(lastQuery)run(lastQuery);};$('newTab').onclick=()=>{setCondition('new');if(lastQuery)run(lastQuery);};
 for(const pair of [['Bentley','BE'],['Porsche','PO'],['Audi','AU'],['Land Rover','LR'],['Volvo','VO'],['Mitsubishi','MI']])if(!BRANDS.some(b=>b[0]===pair[0]))BRANDS.push(pair);
 MODELS.Bentley=['Continental','Bentayga','Flying Spur','Mulsanne'];paintBrands();
 const params=new URLSearchParams(location.search);for(const k of ['minYear','maxYear','minPrice','maxPrice','maxMileage','city','category','trim'])if(params.has(k)&&$(k))$(k).value=params.get(k);
 if(params.get('seller')&&![...$('source').options].some(o=>o.value===params.get('seller'))){const o=new Option(params.get('seller'),params.get('seller'),true,true);$('source').add(o);}
 fetch('/api/inventory/stats').then(r=>r.json()).then(d=>{for(const city of Object.keys(d.byCity||{}))if(city!=='Unknown'&&![...$('city').options].some(o=>o.value===city))$('city').add(new Option(city,city));if(params.has('city'))$('city').value=params.get('city');}).catch(()=>{});
 fetch('/api/sources').then(r=>r.json()).then(d=>{const selected=params.get('seller')||$('source').value;const sources=d.sources.filter(s=>s.status==='connected-live'||s.inventoryCount>0);$('source').innerHTML='<option value="">All sources</option>'+sources.map(s=>`<option>${esc(s.name)}</option>`).join('');$('source').value=selected;}).catch(()=>{});
})();
