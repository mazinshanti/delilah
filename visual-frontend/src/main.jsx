import React from 'react';
import {Header,Hero,SearchPanel,BenefitStrip,BrandGrid,Results,Footer} from './components.jsx';
import {makes,demoCars} from './demo-data.js';
import './style.css';

const initial={
  sections:['hero','search','benefits','brands','results'],
  hero:'وش السيارة اللي تدور عليها؟',
  subtitle:'اكتب اللي تبيه بطريقتك، ودليلة تبحث لك في السوق.',
  brandTitle:'ابدأ بماركتك المفضلة',
  resultTitle:'اكتشف بعض الخيارات',
  primary:'#182334',
  background:'#fbfcfd'
};
const storageKey='dalelah.visual-editor.draft.v1';
function restore(){
 try{
  const parsed=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(parsed&&Array.isArray(parsed.sections)&&parsed.sections.length===initial.sections.length&&initial.sections.every(x=>parsed.sections.includes(x)))
    return {...initial,...parsed};
 }catch{}
 return initial;
}
function App(){
 const [draft,setDraft]=React.useState(restore);
 const [designMode,setDesignMode]=React.useState(true);
 const [notice,setNotice]=React.useState('');
 const [dragging,setDragging]=React.useState(null);
 React.useEffect(()=>{localStorage.setItem(storageKey,JSON.stringify(draft));},[draft]);
 const update=(field,value)=>setDraft(old=>({...old,[field]:value}));
 const move=(source,target)=>setDraft(old=>{
  if(source===target||!old.sections.includes(source)||!old.sections.includes(target))return old;
  const next=old.sections.filter(name=>name!==source);
  next.splice(next.indexOf(target),0,source);
  return {...old,sections:next};
 });
 const exportDraft=()=>{
  const blob=new Blob([JSON.stringify(draft,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='dalelah-visual-draft.json';link.click();URL.revokeObjectURL(url);
 };
 const components={
  hero:<Hero headline={draft.hero} description={draft.subtitle}/>,
  search:<SearchPanel onSearch={()=>setNotice('البحث الفعلي معطل في معاينة التصميم.')}/>,
  benefits:<BenefitStrip/>,
  brands:<BrandGrid title={draft.brandTitle} makes={makes}/>,
  results:<Results title={draft.resultTitle} cars={demoCars}/>
 };
 const labels={hero:'العنوان الرئيسي',search:'منطقة البحث',benefits:'المزايا',brands:'الماركات',results:'بطاقات السيارات'};
 return <main style={{'--visual-primary':draft.primary,'--visual-background':draft.background}}>
  <div className="preview-banner" role="status">Dalelah Visual Editor · معاينة تصميم لا تؤثر على الموقع المباشر</div>
  <Header/>
  {designMode&&<aside className="design-toolbar" aria-label="أدوات تصميم دليلة">
   <h2>تعديل دليلة</h2>
   <p>اسحب الأقسام من المقبض لتغيير ترتيبها، أو غيّر النصوص والألوان هنا.</p>
   <label>العنوان الرئيسي<input value={draft.hero} onChange={e=>update('hero',e.target.value)}/></label>
   <label>الوصف<input value={draft.subtitle} onChange={e=>update('subtitle',e.target.value)}/></label>
   <label>عنوان الماركات<input value={draft.brandTitle} onChange={e=>update('brandTitle',e.target.value)}/></label>
   <label>عنوان النتائج<input value={draft.resultTitle} onChange={e=>update('resultTitle',e.target.value)}/></label>
   <label>لون الأزرار<input type="color" value={draft.primary} onChange={e=>update('primary',e.target.value)}/></label>
   <label>لون الخلفية<input type="color" value={draft.background} onChange={e=>update('background',e.target.value)}/></label>
   <button type="button" onClick={exportDraft}>تصدير التعديلات JSON</button>
   <button type="button" onClick={()=>{if(confirm('مسح تعديلات التصميم المحلية؟'))setDraft(initial);}}>استعادة التصميم</button>
  </aside>}
  <div className={designMode?'visual-canvas editing':'visual-canvas'}>
   {draft.sections.map(section=><div key={section} className="editable-section" draggable={designMode} onDragStart={event=>{if(!designMode)return;setDragging(section);event.dataTransfer.setData('text/plain',section);event.dataTransfer.effectAllowed='move';}} onDragOver={event=>{if(designMode)event.preventDefault();}} onDrop={event=>{event.preventDefault();const source=event.dataTransfer.getData('text/plain')||dragging;move(source,section);setDragging(null);}} onDragEnd={()=>setDragging(null)}>
    {designMode&&<div className="section-drag-handle" role="note" aria-label={'اسحب قسم '+labels[section]}>⋮⋮ {labels[section]} <span>اسحب لإعادة الترتيب</span></div>}
    {components[section]}
   </div>)}
  </div>
  {notice&&<p className="notice frame" role="status">{notice}</p>}
  <Footer/>
  <div className="design-actions"><button onClick={()=>setDesignMode(x=>!x)}>{designMode?'معاينة بدون أدوات':'فتح أدوات التصميم'}</button></div>
 </main>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
