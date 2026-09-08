(()=>{
  const OLD='Delilah', NEW='Dalelah';
  document.title=(document.title||'').replaceAll(OLD,NEW);
  const meta=document.querySelector('meta[name="description"]');
  if(meta?.content) meta.content=meta.content.replaceAll(OLD,NEW);
  const replaceText=node=>{
    if(node.nodeType===Node.TEXT_NODE){
      if(node.nodeValue?.includes(OLD)) node.nodeValue=node.nodeValue.replaceAll(OLD,NEW);
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE) return;
    for(const attr of ['title','aria-label','placeholder','alt']){
      const v=node.getAttribute?.(attr); if(v?.includes(OLD)) node.setAttribute(attr,v.replaceAll(OLD,NEW));
    }
    node.childNodes?.forEach(replaceText);
  };
  replaceText(document.body);
  const observer=new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==='characterData') replaceText(m.target);
      else m.addedNodes.forEach(replaceText);
    }
    if(document.title.includes(OLD)) document.title=document.title.replaceAll(OLD,NEW);
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  window.DALELAH_BRAND='Dalelah';
})();
