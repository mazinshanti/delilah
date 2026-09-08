(()=>{
  const brands=[
    ['Toyota','toyota'],['Nissan','nissan'],['Jeep','jeep'],['Lexus','lexus'],['BMW','bmw'],['Mercedes','mercedesbenz'],['Hyundai','hyundai'],['Kia','kia'],['Ford','ford'],['Chevrolet','chevrolet'],['GMC','gmc'],['Mazda','mazda'],['Honda','honda'],['Genesis','genesis'],['Geely','geely'],['Changan','changan'],['Haval','haval'],['MG','mg'],['BYD','byd'],['Jetour','jetour']
  ];
  const models={
    Toyota:['All Toyota','Camry','Corolla','Land Cruiser','Prado','Yaris','Fortuner','Hilux','RAV4','Highlander','Crown','Supra'],
    Nissan:['All Nissan','Patrol','Sunny','Altima','X-Trail','Pathfinder','Kicks','X-Terra','Navara','Z'],
    Jeep:['All Jeep','Wrangler','Compass','Grand Cherokee','Cherokee','Gladiator','Renegade'],
    Lexus:['All Lexus','ES','IS','LS','RX','NX','LX','GX','UX'],
    BMW:['All BMW','X1','X2','X3','X4','X5','X6','X7','3 Series','5 Series','7 Series','M3','M4'],
    Mercedes:['All Mercedes','A-Class','C-Class','E-Class','S-Class','CLA','GLA','GLC','GLE','GLS','G-Class','AMG GT'],
    Hyundai:['All Hyundai','Accent','Elantra','Sonata','Tucson','Santa Fe','Palisade','Creta','Kona','Azera','Staria'],
    Kia:['All Kia','Pegas','Cerato','K5','K8','Sportage','Sorento','Seltos','Carnival','Telluride','EV5','EV9'],
    Ford:['All Ford','Territory','Taurus','Explorer','Expedition','Everest','Ranger','F-150','Mustang','Bronco'],
    Chevrolet:['All Chevrolet','Tahoe','Suburban','Captiva','Groove','Traverse','Silverado','Camaro','Corvette'],
    GMC:['All GMC','Yukon','Sierra','Acadia','Terrain'],
    Mazda:['All Mazda','Mazda 3','Mazda 6','CX-3','CX-30','CX-5','CX-60','CX-9','CX-90','MX-5'],
    Honda:['All Honda','Accord','Civic','City','CR-V','HR-V','Pilot','Odyssey','ZR-V'],
    Genesis:['All Genesis','G70','G80','G90','GV60','GV70','GV80'],
    Geely:['All Geely','Coolray','Emgrand','Monjaro','Starray','Preface','Okavango'],
    Changan:['All Changan','CS35 Plus','CS55 Plus','CS75 Plus','UNI-K','UNI-T','UNI-V','Alsvin','Eado Plus'],
    Haval:['All Haval','H6','Jolion','Dargo','H9'],
    MG:['All MG','MG 3','MG 5','MG 6','RX5','HS','ZS','GT','Whale','Cyberster'],
    BYD:['All BYD','Song Plus','Seal','Han','Qin Plus','Atto 3','Tang'],
    Jetour:['All Jetour','Dashing','X70','X70 Plus','X90 Plus','T1','T2']
  };
  const categories=[['','All categories'],['SUV','SUV'],['Sedan','Sedan'],['Pickup','Pickup / Truck'],['Coupe','Coupe'],['Hatchback','Hatchback'],['Van','Van / MPV'],['Electric','Electric / EV'],['Hybrid','Hybrid']];
  const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let selectedBrand='Toyota';

  function init(){
    let searchBox;
    try{searchBox=dom?.searchBox}catch{}
    if(!searchBox||!document.getElementById('smartHint28'))return setTimeout(init,120);
    if(document.getElementById('brandBrowse32'))return;

    const css=document.createElement('style');css.textContent=`
      .browseCompact31{display:none!important}.smartRails{display:none!important}
      .brandBrowse32{margin-top:15px}.brandHead32{display:flex;justify-content:space-between;align-items:center;margin:0 2px 8px;color:#858b94;font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.8px}.brandHead32 span{font-weight:700;text-transform:none;letter-spacing:0;color:#656b73}
      .brandTabs32{display:flex;gap:8px;overflow-x:auto;padding:2px 1px 7px;scrollbar-width:none}.brandTabs32::-webkit-scrollbar{display:none}
      .brandTab32{flex:0 0 84px;height:72px;border:1px solid #2d333a;background:#121519;border-radius:15px;color:#b8bdc4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;cursor:pointer;font-size:9px;font-weight:900;transition:.15s}.brandTab32:hover{border-color:#4a5159;color:#fff}.brandTab32.active{border-color:var(--accent);background:#171c18;color:#fff;box-shadow:0 0 0 1px rgba(216,255,90,.16) inset}.brandTab32 img{width:27px;height:27px;object-fit:contain;filter:grayscale(1) brightness(1.65)}.brandTab32.active img{filter:none}.brandInitial32{width:28px;height:28px;border-radius:8px;background:#20252b;display:grid;place-items:center;font-size:9px;font-weight:1000}
      .modelBar32{margin-top:6px;border:1px solid #2c3239;background:#111418;border-radius:16px;padding:10px;display:grid;grid-template-columns:minmax(185px,1.2fr) minmax(145px,.8fr) minmax(150px,.8fr) auto;gap:8px;align-items:end}.field32 label{display:block;margin:0 0 5px 4px;color:#747b84;font-size:8px;font-weight:950;text-transform:uppercase;letter-spacing:.7px}.field32 select{width:100%;height:42px;border:1px solid #333941;background:#191d22;color:#f5f5f3;border-radius:11px;padding:0 11px;font-size:11px;font-weight:850;outline:0}.go32{height:42px;border:0;background:var(--accent);color:#090a0b;border-radius:11px;padding:0 18px;font-size:10px;font-weight:1000;cursor:pointer;white-space:nowrap}.go32:hover{background:#e5ff7c}.modelName32{color:var(--accent)}
      @media(max-width:800px){.modelBar32{grid-template-columns:1fr 1fr}.go32{grid-column:1/-1}}@media(max-width:520px){.brandTab32{flex-basis:76px;height:66px}.modelBar32{grid-template-columns:1fr}.go32{grid-column:auto}}
    `;document.head.appendChild(css);

    const host=document.createElement('div');host.id='brandBrowse32';host.className='brandBrowse32';host.innerHTML=`
      <div class="brandHead32"><div>Browse by brand</div><span>Choose a brand, then a model</span></div>
      <div class="brandTabs32" id="brandTabs32"></div>
      <div class="modelBar32">
        <div class="field32"><label>Model · <span class="modelName32" id="selectedBrand32">Toyota</span></label><select id="modelSelect32"></select></div>
        <div class="field32"><label>Category</label><select id="categorySelect32">${categories.map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join('')}</select></div>
        <div class="field32"><label>Source</label><select id="sourceSelect32"><option value="">All sources</option><option>Haraj</option><option>Syarah</option><option>OpenSooq</option><option>Saudi Sale</option><option>ArabWheels</option><option>YallaMotor</option></select></div>
        <button class="go32" id="browseGo32">Browse cars →</button>
      </div>`;
    document.getElementById('smartHint28').insertAdjacentElement('afterend',host);

    const tabs=document.getElementById('brandTabs32'),model=document.getElementById('modelSelect32'),cat=document.getElementById('categorySelect32'),source=document.getElementById('sourceSelect32');
    tabs.innerHTML=brands.map(([name,slug])=>`<button class="brandTab32 ${name===selectedBrand?'active':''}" data-brand="${esc(name)}"><img alt="${esc(name)}" src="https://cdn.simpleicons.org/${slug}/ffffff" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'brandInitial32',textContent:'${esc(name.slice(0,2).toUpperCase())}'}))"><span>${esc(name)}</span></button>`).join('');

    function fillModels(){const list=models[selectedBrand]||[`All ${selectedBrand}`];model.innerHTML=list.map((m,i)=>`<option value="${i?' '+esc(m):''}">${esc(m)}</option>`).join('');document.getElementById('selectedBrand32').textContent=selectedBrand}
    fillModels();
    tabs.onclick=e=>{const b=e.target.closest('[data-brand]');if(!b)return;selectedBrand=b.dataset.brand;tabs.querySelectorAll('.brandTab32').forEach(x=>x.classList.toggle('active',x.dataset.brand===selectedBrand));fillModels()};

    function syncSources(){const hidden=document.getElementById('sourceQuickRail28');if(!hidden)return;const existing=new Set([...source.options].map(o=>o.value));hidden.querySelectorAll('[data-source]').forEach(b=>{const s=b.dataset.source||'';if(s&&!existing.has(s)){source.add(new Option(s,s));existing.add(s)}})}
    syncSources();setTimeout(syncSources,1200);
    function run(){const modelName=model.value.trim();dom.q.value=[selectedBrand,modelName,cat.value].filter(Boolean).join(' ').trim();const hidden=document.getElementById('sourceQuickRail28');const target=hidden?[...hidden.querySelectorAll('[data-source]')].find(b=>(b.dataset.source||'')===source.value):null;if(target){target.click();return}go()}
    document.getElementById('browseGo32').onclick=run;[model,cat,source].forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter')run()}));
  }
  init();
})();
