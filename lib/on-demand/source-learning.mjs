// Bounded aggregate feedback, no queries or listing archives. Every source stays eligible.
export function createSourceLearning({maxSegments=128}={}){
 const segments=new Map();
 const key=i=>`${i.condition||'used'}:${i.make||'any'}:${i.bodyType||'any'}`;
 return {
  order(intent,defaults,all){
   const scores=segments.get(key(intent));
   const base=[...new Set([...defaults,...all])];
   return base.sort((a,b)=>{
    const value=s=>{const v=scores?.get(s);return v&&v.samples>=3?v.score:0;};
    return value(b)-value(a);
   });
  },
  observe(intent,{matches=[],diagnostics=[]}){
   const k=key(intent);if(!segments.has(k)){if(segments.size>=maxSegments)segments.delete(segments.keys().next().value);segments.set(k,new Map());}
   const values=segments.get(k),sources=new Set([...matches.map(r=>r.source),...diagnostics.map(d=>d.source)].filter(Boolean));
   for(const source of sources){const old=values.get(source)||{samples:0,score:0};const hits=matches.filter(r=>r.source===source).length,errors=diagnostics.filter(d=>d.source===source&&d.error).length;values.set(source,{samples:old.samples+1,score:old.score*.7+(Math.min(hits,3)-Math.min(errors,3))*.3});}
  }
 };
}
