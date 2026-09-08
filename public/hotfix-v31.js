(()=>{
  const ready=()=>typeof dom!=='undefined'&&dom?.searchBox&&document.getElementById('smartHint28');
  function init(){
    if(!ready())return setTimeout(init,120);
    if(document.getElementById('browseCompact31'))return;

    const categories=[
      ['','All categories'],['SUV','SUV'],['Sedan','Sedan'],['Pickup','Pickup / Truck'],['Coupe','Coupe'],['Hatchback','Hatchback'],['Van','Van / MPV'],['Convertible','Convertible'],['Sports','Sports'],['Luxury','Luxury'],['Electric','Electric / EV'],['Hybrid','Hybrid']
    ];
    const brands=['','Toyota','Nissan','Jeep','Lexus','BMW','Mercedes','Hyundai','Kia','Ford','Chevrolet','GMC','Mazda','Honda','Mitsubishi','Chrysler','Dodge','RAM','Cadillac','Lincoln','Porsche','Audi','Volkswagen','Volvo','Land Rover','Range Rover','Genesis','Geely','Changan','Haval','GAC','MG','BYD','Jetour','Chery','Hongqi','Exeed','Jaecoo','Omoda','Tank','Zeekr','Tesla','Lucid','Polestar','Peugeot','Renault','Suzuki','Isuzu','Subaru','Infiniti','Ferrari','Lamborghini','Bentley','Rolls Royce','Aston Martin','Maserati','McLaren','Mini','Fiat'];
    const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

    const css=document.createElement('style');
    css.textContent=`
      .smartRails{display:none!important}
      .browseCompact31{margin-top:14px;border:1px solid #292f36;background:linear-gradient(180deg,#111418,#0f1215);border-radius:18px;padding:10px;display:grid;grid-template-columns:minmax(150px,.8fr) minmax(170px,1fr) minmax(160px,.9fr) auto;gap:8px;align-items:end;box-shadow:0 14px 42px rgba(0,0,0,.16)}
      .browseField31{min-width:0}.browseField31 label{display:block;margin:0 0 5px 4px;color:#737a83;font-size:8px;font-weight:950;text-transform:uppercase;letter-spacing:.8px}.browseField31 select{width:100%;height:43px;border:1px solid #30363d;background:#171b20;color:#f5f5f2;border-radius:12px;padding:0 34px 0 12px;outline:0;font-size:11px;font-weight:850;cursor:pointer;appearance:auto}.browseField31 select:focus{border-color:#697347;box-shadow:0 0 0 3px rgba(216,255,90,.05)}
      .browseGo31{height:43px;border:0;background:var(--accent);color:#090a0b;border-radius:12px;padding:0 18px;font-size:10px;font-weight:1000;cursor:pointer;white-space:nowrap}.browseGo31:hover{background:#e5ff7c}.browseReset31{height:43px;border:1px solid #30363d;background:#15191d;color:#9ea4ac;border-radius:12px;padding:0 11px;font-size:9px;font-weight:900;cursor:pointer}.browseActions31{display:flex;gap:7px}
      .browseMicro31{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1px 4px 0;color:#666d76;font-size:9px}.browseMicro31 b{color:#aeb4bc}.browseMicro31 span:last-child{white-space:nowrap}
      @media(max-width:820px){.browseCompact31{grid-template-columns:1fr 1fr}.browseActions31{grid-column:1/-1}.browseGo31{flex:1}.browseMicro31{display:none}}
      @media(max-width:520px){.browseCompact31{grid-template-columns:1fr}.browseActions31{grid-column:auto}.browseGo31{flex:1}}
    `;
    document.head.appendChild(css);

    const oldRails=document.querySelector('.smartRails');
    const box=document.createElement('div');
    box.id='browseCompact31';box.className='browseCompact31';
    box.innerHTML=`
      <div class="browseField31"><label>Category</label><select id="browseCategory31">${categories.map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join('')}</select></div>
      <div class="browseField31"><label>Brand</label><select id="browseBrand31">${brands.map((b,i)=>`<option value="${esc(b)}">${i?esc(b):'All brands'}</option>`).join('')}</select></div>
      <div class="browseField31"><label>Source</label><select id="browseSource31"><option value="">All sources</option><option>Haraj</option><option>Syarah</option><option>OpenSooq</option><option>Saudi Sale</option><option>ArabWheels</option><option>YallaMotor</option></select></div>
      <div class="browseActions31"><button class="browseReset31" id="browseReset31">Reset</button><button class="browseGo31" id="browseGo31">Browse cars →</button></div>
      <div class="browseMicro31"><span><b>Or just type naturally.</b> “Black Patrol 2023 in Riyadh from Haraj” still works.</span><span>Category + brand + source can be combined</span></div>`;
    (oldRails||document.getElementById('smartHint28')).insertAdjacentElement('afterend',box);

    const cat=document.getElementById('browseCategory31'),brand=document.getElementById('browseBrand31'),source=document.getElementById('browseSource31');
    function syncSources(){
      const hidden=document.getElementById('sourceQuickRail28');if(!hidden)return;
      const existing=new Set([...source.options].map(o=>o.value));
      hidden.querySelectorAll('[data-source]').forEach(b=>{const s=b.dataset.source||'';if(s&&!existing.has(s)){source.add(new Option(s,s));existing.add(s)}});
    }
    syncSources();setTimeout(syncSources,1400);

    function compose(){return [brand.value,cat.value].filter(Boolean).join(' ').trim()||'cars'}
    function run(){
      dom.q.value=compose();
      const hidden=document.getElementById('sourceQuickRail28');
      const target=hidden?[...hidden.querySelectorAll('[data-source]')].find(b=>(b.dataset.source||'')===source.value):null;
      if(target){target.click();return}
      go();
    }
    document.getElementById('browseGo31').onclick=run;
    document.getElementById('browseReset31').onclick=()=>{cat.value='';brand.value='';source.value='';const hidden=document.getElementById('sourceQuickRail28');const all=hidden?.querySelector('[data-source=""]');if(all)all.click();else{dom.q.value='';if(typeof clearFilters==='function')clearFilters()}};
    [cat,brand,source].forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter')run()}));
  }
  init();
})();
