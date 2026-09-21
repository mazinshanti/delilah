// No time-based percentages: source discovery has an unknown amount of work.
export function searchProgressState({started=false,busy=false,response={},count=0,language='ar'}={}){
 const ar=language==='ar';
 const complete=response.complete===true||response.marketScanComplete===true;
 const kind=busy?'scanning':complete&&!response.partial&&!response.interpretationUnavailable?'complete':'partial';
 const text=kind==='scanning'
  ?count>0?(ar?`وجدنا ${count} إعلانًا مطابقًا، ونبحث عن المزيد`:`Found ${count} matching listings. Searching for more…`):(ar?'نبحث لك في المصادر المتاحة…':'Searching available sources…')
  :kind==='complete'?(ar?'اكتمل البحث في المصادر المتاحة':'Search completed across available sources')
  :complete&&response.searchMode==='on-demand'?(ar?'انتهى البحث الحالي. النتائج لا تشمل جميع إعلانات السوق.':'This search has finished. Results do not cover every market listing.')
  :(ar?'لم يكتمل البحث في جميع المصادر المتاحة. يمكنك إعادة المحاولة.':'Search could not finish across all available sources. You can retry.');
 return {hidden:!started,kind,text};
}
