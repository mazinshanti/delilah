import React from 'react';

export function Header({logo='دليلة',sellLabel='بيع سيارتي',marketLabel='ابحث في السوق',brandsLabel='ابحث حسب الماركة'}){
 return <header className="site-header frame">
   <a className="brand" href="#home" aria-label="Dalelah">{logo}<span className="brand-dot">.</span></a>
   <nav aria-label="التنقل الرئيسي"><a href="#sell">{sellLabel}</a><a href="#search">{marketLabel}</a><a href="#brands">{brandsLabel}</a></nav>
   <span className="lang-indicator">العربية · English</span>
 </header>;
}
export function Hero({eyebrow='السوق السعودي. بحث واحد.',headline='وش السيارة اللي تدور عليها؟',description='اكتب اللي تبيه بطريقتك، ودليلة تبحث لك في السوق.'}){
 return <section className="hero frame" id="home"><p className="eyebrow">{eyebrow}</p><h1>{headline}</h1><p className="hero-description">{description}</p></section>;
}
export function SearchPanel({searchLabel='ابحث في السوق',placeholder='مثال: أبي جيب عائلي تحت 120 ألف في الرياض',onSearch=()=>{}}){
 const [query,setQuery]=React.useState(''),[condition,setCondition]=React.useState('used');
 return <section className="search-panel frame" id="search" aria-label="بحث السيارات">
   <div className="tab-row"><button type="button" className={condition==='used'?'selected':''} onClick={()=>setCondition('used')}>مستعملة</button><button type="button" className={condition==='new'?'selected':''} onClick={()=>setCondition('new')}>جديدة</button><span>خيارات حقيقية، من مصادر متعددة</span></div>
   <form onSubmit={event=>{event.preventDefault();onSearch({query,condition});}}><label className="sr-only" htmlFor="visual-query">صف السيارة</label><input id="visual-query" value={query} onChange={e=>setQuery(e.target.value)} placeholder={placeholder}/><button type="submit">{searchLabel}</button></form>
   <p className="hint">معاينة تصميم فقط — لا تُجري بحثاً حياً أو اتصالاً بمصادر السيارات</p>
 </section>;
}
export function BenefitStrip({items=[
 {title:'سيارات حقيقية',description:'من مصادر موثوقة',icon:'🚘'},
 {title:'تواريخ رصد الإعلانات',description:'تحقق من السعر والتوفر لدى المصدر',icon:'◷'},
 {title:'كل مدن المملكة',description:'من الشمال إلى الجنوب',icon:'⌖'},
 {title:'بحث ذكي',description:'يوفر عليك الوقت',icon:'✦'}
]}){
 return <section className="benefit-strip frame" aria-label="مزايا دليلة">{items.map((item,i)=><div className="benefit" key={i}><span aria-hidden="true">{item.icon}</span><div><strong>{item.title}</strong><small>{item.description}</small></div></div>)}</section>;
}
export function BrandGrid({title='ابدأ بماركتك المفضلة',makes=[]}){
 return <section className="frame brand-section" id="brands"><h2>{title}</h2><div className="brand-grid">{makes.map(make=><div className="brand-tile" key={make}><span className="brand-symbol">◈</span>{make}</div>)}</div></section>;
}
export function CarCard({make='Toyota',model='Land Cruiser',year=2023,price=180000,city='الرياض',mileage=40000}){
 return <article className="car-card"><div className="car-image"><span>🚙</span><small>صورة توضيحية</small></div><div className="car-content"><h3>{make} {model}</h3><p>{year} · {city} · {Number(mileage).toLocaleString('en-US')} كم</p><strong>{Number(price).toLocaleString('en-US')} ر.س</strong></div></article>;
}
export function Results({title='اكتشف بعض الخيارات',cars=[]}){
 return <section className="frame results-section"><h2>{title}</h2><p className="hint">بيانات تصميم تجريبية، ليست إعلانات سيارات حقيقية.</p><div className="card-grid">{cars.map(car=><CarCard key={car.id} {...car}/>)}</div></section>;
}
export function Footer({logo='دليلة',text='بحث أبسط. خيارات أوضح.'}){
 return <footer className="frame footer"><strong>{logo}</strong><span>{text}</span><a href="#home">العودة للأعلى</a></footer>;
}
