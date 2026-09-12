const digits=value=>String(value??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));

function amount(value){
  const n=Number(digits(value).replace(/[,.\s]/g,''));
  return Number.isFinite(n)&&n>=5000&&n<=5_000_000?n:null;
}

function visiblePrices(text=''){
  const raw=digits(String(text||''));
  const out=[];
  const re=/([1-9][0-9٠-٩]*(?:[,.][0-9٠-٩]{3})*)\s*(?:SAR|ر\.?\s*س|ريال)\b/gi;
  for(const m of raw.matchAll(re)){
    const n=amount(m[1]);
    if(n)out.push({price:n,evidence:m[0].trim()});
  }
  return out;
}

function gtmPrice(html=''){
  const raw=digits(String(html||''));
  let from=0;
  while(true){
    const at=raw.indexOf('gtmProps',from);
    if(at<0)break;
    const segment=raw.slice(at,at+1000).replace(/\\+/g,'');
    const value=/(?:^|[,{])\s*["']?value["']?\s*:\s*([1-9][0-9]{3,6})/i.exec(segment);
    const vat=/(?:^|[,{])\s*["']?price["']?\s*:\s*([1-9][0-9]{3,6})/i.exec(segment);
    const primary=amount(value?.[1]);
    const vatPrice=amount(vat?.[1]);
    if(primary){
      return{
        price:primary,
        vatPrice:vatPrice&&vatPrice>=primary?vatPrice:null,
        source:'saleh_gtm_listing_value',
        evidence:`gtmProps.value=${primary}${vatPrice?`; gtmProps.price=${vatPrice}`:''}`
      };
    }
    from=at+8;
  }
  return null;
}

function namedPrice(html=''){
  const raw=digits(String(html||'')).replace(/\\+/g,'').replace(/,/g,'');
  const keys=['cashPrice','salePrice','finalPrice','sellingPrice','discountedPrice'];
  for(const key of keys){
    const re=new RegExp(`["']?${key}["']?\\s*:\\s*["']?([1-9][0-9]{3,6})`,'i');
    const m=re.exec(raw);
    const n=amount(m?.[1]);
    if(n)return{price:n,vatPrice:null,source:`saleh_${key}`,evidence:`${key}=${n}`};
  }
  return null;
}

export function extractSalehPrice(text='',html=''){
  const visible=visiblePrices(text);
  if(visible.length){
    const primary=visible[0];
    const second=visible.slice(1).find(x=>x.price>=primary.price);
    return{
      price:primary.price,
      vatPrice:second?.price??null,
      source:'saleh_visible_price',
      evidence:primary.evidence
    };
  }
  return gtmPrice(html)||namedPrice(html)||null;
}
