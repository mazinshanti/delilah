export const colors={bg:'#FFFFFF',surface:'#F5F7F5',raised:'#FFFFFF',panel:'#FFFFFF',panel2:'#F5F7F5',line:'#E1E7E3',text:'#17221F',muted:'#69756F',accent:'#0F4D3A',accentInk:'#FFFFFF',soft:'#EAF2ED',danger:'#B53C34',bad:'#B53C34',ok:'#0F4D3A',white:'#FFFFFF',black:'#17221F'};
export const money=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?`${Math.round(n).toLocaleString('ar-SA-u-nu-latn')} ريال`:'السعر غير معلن';};
export const number=value=>{const n=Number(value);return Number.isFinite(n)&&n>=0?n.toLocaleString('ar-SA-u-nu-latn'):null;};
