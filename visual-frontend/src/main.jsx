import React from 'react';
import {createRoot} from 'react-dom/client';
import {Header,Hero,SearchPanel,BenefitStrip,BrandGrid,Results,Footer} from './components.jsx';
import {makes,demoCars} from './demo-data.js';
import './style.css';

// Component structure intentionally exposed directly to Builder Projects.
// Change typography, reorder components or drag layout elements in the visual
// editor. This isolated app cannot publish changes to dalelah.co.
function App(){
 const [notice,setNotice]=React.useState('');
 return <main>
  <div className="preview-banner" role="status">Dalelah Visual Editor · نسخة تجريبية للتصميم فقط</div>
  <Header/>
  <Hero/>
  <SearchPanel onSearch={()=>setNotice('البحث الفعلي معطل في معاينة التصميم.')} />
  {notice&&<p className="notice frame" role="status">{notice}</p>}
  <BenefitStrip/>
  <BrandGrid makes={makes}/>
  <Results cars={demoCars}/>
  <Footer/>
 </main>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
