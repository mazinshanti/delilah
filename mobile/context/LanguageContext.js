import AsyncStorage from '@react-native-async-storage/async-storage';
import React,{createContext,useContext,useEffect,useMemo,useState}from'react';

const KEY='dalelah.language';
const LanguageContext=createContext(null);

const strings={
 ar:{
  search:'بحث',saved:'المحفوظة',sell:'بيع سيارتك',carDetails:'تفاصيل السيارة',
  marketLive:'السوق السعودي مباشر',eyebrow:'محرك بحث السيارات في السعودية',hero:'وش السيارة اللي تدور عليها؟',
  heroSub:'اكتب اللي تبيه بطريقتك، ودليلة تبحث لك في السوق.',used:'مستعملة',new:'جديدة',searchButton:'ابحث',
  searchPlaceholder:'مثال: أبي كامري أقل من 60 ألف في الرياض',scanning:n=>`نبحث في السوق · ${n} نتيجة`,found:n=>`${n} سيارة من السوق`,
  browseSub:'ابحث في المعارض والمنصات من مكان واحد.',bestMatches:'أفضل النتائج',emptyTitle:'قل لدليلة وش تبي.',emptyText:'نبحث لك في سوق السيارات السعودي ونجمع النتائج في مكان واحد.',
  shortlist:'قائمتك',savedCount:n=>n?`${n} سيارة محفوظة`:'ما حفظت سيارات للحين',savedSub:'احفظ السيارات اللي تعجبك وقارن بينها لاحقاً.',saveHint:'اضغط على القلب في أي إعلان لحفظه.',
  valuationEyebrow:'تقييم دليلة',valuationHero:'كم تسوى سيارتك بالسوق؟',valuationSub:'دليلة تقارن سيارتك بإعلانات حقيقية من السوق السعودي وتعرض تقديراً فقط إذا كانت البيانات كافية.',
  make:'الشركة',model:'الموديل',year:'السنة',mileage:'الممشى كم',city:'المدينة',estimate:'قدّر سيارتي',required:'الشركة، الموديل، السنة، الممشى والمدينة مطلوبة.',
  marketValue:'القيمة السوقية التقديرية',range:'النطاق',basedOn:n=>`بناءً على ${n} سيارات مشابهة موثوقة.`,notEnough:'البيانات غير كافية للتقييم.',notEnoughSub:n=>`وجدنا ${n||0} سيارات مشابهة موثوقة. دليلة ما تخمّن السعر بدون بيانات كافية.`,
  quickSale:'بيع سريع',listPrice:'سعر عرض مقترح',saveCar:'احفظ السيارة',savedCar:'محفوظة',original:'شوف الإعلان الأصلي',
  transparency:'شفافية دليلة',transparencyText:s=>`هذا الإعلان من ${s||'مصدر خارجي'}. دليلة تساعدك تكتشف وتقارن، والمصدر الأصلي هو المرجع النهائي لتفاصيل الإعلان.`,
  conditionUsed:'مستعملة',conditionNew:'جديدة',language:'EN'
 },
 en:{
  search:'Search',saved:'Saved',sell:'Sell',carDetails:'Car details',
  marketLive:'Saudi market live',eyebrow:'SAUDI AUTOMOTIVE SEARCH',hero:'What car are you looking for?',heroSub:'Tell Dalelah what you want. Dalelah searches the market for you.',used:'Used',new:'New',searchButton:'Search',
  searchPlaceholder:'e.g. Camry under 60k in Riyadh',scanning:n=>`Scanning the market · ${n} found`,found:n=>`${n} cars found across the market`,browseSub:'Search marketplaces and dealers in one place.',bestMatches:'Best matches',emptyTitle:'Tell Dalelah what you want.',emptyText:'We’ll search the Saudi car market and bring the listings together.',
  shortlist:'YOUR SHORTLIST',savedCount:n=>n?`${n} saved car${n===1?'':'s'}`:'Nothing saved yet',savedSub:'Keep the cars you like here and compare them later.',saveHint:'Tap the heart on any listing to save it.',
  valuationEyebrow:'DALELAH VALUATION',valuationHero:'What is your car worth?',valuationSub:'Dalelah compares your car with real Saudi listings and only shows a value when the evidence is strong enough.',
  make:'Make',model:'Model',year:'Year',mileage:'Mileage km',city:'City',estimate:'Estimate my car',required:'Make, model, year, mileage and city are required.',
  marketValue:'Estimated market value',range:'Range',basedOn:n=>`Based on ${n} reliable comparable cars.`,notEnough:'Not enough evidence yet.',notEnoughSub:n=>`We found ${n||0} reliable comparable cars. Dalelah will not invent a price.`,
  quickSale:'Quick sale',listPrice:'Suggested listing',saveCar:'Save car',savedCar:'Saved',original:'View original listing',transparency:'Dalelah transparency',transparencyText:s=>`This listing comes from ${s||'an external source'}. Dalelah helps you discover and compare it; the original source remains the source of truth.`,conditionUsed:'Used',conditionNew:'New',language:'عربي'
 }
};

export function LanguageProvider({children}){
 const[language,setLanguage]=useState('ar');
 useEffect(()=>{AsyncStorage.getItem(KEY).then(v=>{if(v==='ar'||v==='en')setLanguage(v);}).catch(()=>{});},[]);
 const value=useMemo(()=>({language,isRTL:language==='ar',t:strings[language],setLanguage:async next=>{if(next!=='ar'&&next!=='en')return;setLanguage(next);try{await AsyncStorage.setItem(KEY,next);}catch{}},toggleLanguage:()=>{const next=language==='ar'?'en':'ar';setLanguage(next);AsyncStorage.setItem(KEY,next).catch(()=>{});}}),[language]);
 return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(){const value=useContext(LanguageContext);if(!value)throw new Error('useLanguage must be used inside LanguageProvider');return value;}
