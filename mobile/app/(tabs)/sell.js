import React,{useState}from'react';
import{ActivityIndicator,KeyboardAvoidingView,Platform,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View}from'react-native';
import{useLanguage}from'../../context/LanguageContext';
import{estimateCar}from'../../lib/api';
import{colors,money}from'../../lib/theme';

export default function SellScreen(){
 const{t,isRTL}=useLanguage();
 const[make,setMake]=useState('');const[model,setModel]=useState('');const[year,setYear]=useState('');const[mileage,setMileage]=useState('');const[city,setCity]=useState('');
 const[loading,setLoading]=useState(false);const[result,setResult]=useState(null);const[error,setError]=useState('');
 const textStyle=isRTL?styles.rtl:null;
 async function estimate(){
  if(!make.trim()||!model.trim()||!year.trim()||!mileage.trim()||!city.trim()){setError(t.required);return;}
  setLoading(true);setError('');setResult(null);
  try{setResult(await estimateCar({make:make.trim(),model:model.trim(),year:Number(year),mileageKm:Number(mileage),city:city.trim()}));}
  catch(e){setError(e?.message||'Valuation unavailable');}finally{setLoading(false);}
 }
 return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
  <Text style={[styles.kicker,textStyle]}>{t.valuationEyebrow}</Text>
  <Text style={[styles.hero,textStyle]}>{t.valuationHero}</Text>
  <Text style={[styles.sub,textStyle]}>{t.valuationSub}</Text>
  <View style={styles.form}>
   <Field rtl={isRTL} label={t.make} value={make} onChangeText={setMake} placeholder={isRTL?'تويوتا':'Toyota'}/>
   <Field rtl={isRTL} label={t.model} value={model} onChangeText={setModel} placeholder={isRTL?'كورولا':'Corolla'}/>
   <View style={styles.row}><View style={styles.half}><Field rtl={isRTL} label={t.year} value={year} onChangeText={setYear} placeholder="2019" keyboardType="number-pad"/></View><View style={styles.half}><Field rtl={isRTL} label={t.mileage} value={mileage} onChangeText={setMileage} placeholder="85000" keyboardType="number-pad"/></View></View>
   <Field rtl={isRTL} label={t.city} value={city} onChangeText={setCity} placeholder={isRTL?'الرياض':'Riyadh'}/>
   <Pressable style={styles.cta} onPress={estimate} disabled={loading}>{loading?<ActivityIndicator color={colors.black}/>:<Text style={styles.ctaText}>{t.estimate}</Text>}</Pressable>
  </View>
  {error?<View style={styles.error}><Text style={[styles.errorText,textStyle]}>{error}</Text></View>:null}
  {result?<View style={styles.result}>
   <Text style={[styles.resultLabel,textStyle]}>{t.marketValue}</Text>
   {result.available?<>
    <Text style={[styles.resultPrice,textStyle]}>{money(result.estimatedMarketValue)}</Text>
    <Text style={[styles.range,textStyle]}>{t.range}: {money(result.valuationLow)} — {money(result.valuationHigh)}</Text>
    <View style={styles.miniRow}><Metric rtl={isRTL} label={t.quickSale} value={money(result.quickSaleValue)}/><Metric rtl={isRTL} label={t.listPrice} value={money(result.recommendedListingPrice)}/></View>
    <Text style={[styles.comps,textStyle]}>{t.basedOn(result.comparableCount)}</Text>
   </>:<>
    <Text style={[styles.resultTitle,textStyle]}>{t.notEnough}</Text>
    <Text style={[styles.comps,textStyle]}>{t.notEnoughSub(result.comparableCount)}</Text>
   </>}
  </View>:null}
 </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function Field({label,rtl,...props}){return <View style={styles.field}><Text style={[styles.label,rtl&&styles.rtl]}>{label}</Text><TextInput {...props} textAlign={rtl?'right':'left'} placeholderTextColor="#697079" style={styles.input}/></View>}
function Metric({label,value,rtl}){return <View style={styles.metric}><Text style={[styles.metricLabel,rtl&&styles.rtl]}>{label}</Text><Text style={[styles.metricValue,rtl&&styles.rtl]}>{value}</Text></View>}

const styles=StyleSheet.create({flex:{flex:1},safe:{flex:1,backgroundColor:colors.bg},content:{padding:20,paddingBottom:110},rtl:{textAlign:'right',writingDirection:'rtl'},kicker:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.2,marginTop:16},hero:{color:colors.text,fontSize:38,lineHeight:44,fontWeight:'1000',letterSpacing:-1.3,marginTop:9},sub:{color:colors.muted,fontSize:13,lineHeight:21,marginTop:14},form:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:20,padding:15,marginTop:24},field:{marginBottom:12},label:{color:'#818790',fontSize:10,fontWeight:'900',marginBottom:6,marginLeft:2},input:{height:49,borderWidth:1,borderColor:'#343A42',backgroundColor:'#191D22',borderRadius:12,color:colors.text,paddingHorizontal:13,fontSize:14,fontWeight:'700'},row:{flexDirection:'row',gap:10},half:{flex:1},cta:{backgroundColor:colors.accent,borderRadius:13,minHeight:52,alignItems:'center',justifyContent:'center',marginTop:2},ctaText:{color:colors.black,fontSize:13,fontWeight:'1000'},error:{backgroundColor:'#26191B',borderColor:'#66383E',borderWidth:1,borderRadius:13,padding:12,marginTop:14},errorText:{color:colors.bad,fontSize:12},result:{backgroundColor:'#121812',borderColor:'#35462D',borderWidth:1,borderRadius:20,padding:18,marginTop:16},resultLabel:{color:colors.accent,fontSize:10,fontWeight:'1000',letterSpacing:.5},resultPrice:{color:colors.text,fontSize:36,fontWeight:'1000',letterSpacing:-1.3,marginTop:7},range:{color:colors.text,fontSize:12,fontWeight:'800',marginTop:6},comps:{color:colors.muted,fontSize:11,lineHeight:17,marginTop:10},resultTitle:{color:colors.text,fontSize:21,fontWeight:'900',marginTop:8},miniRow:{flexDirection:'row',gap:9,marginTop:14},metric:{flex:1,backgroundColor:'#191f1a',borderRadius:12,padding:11},metricLabel:{color:colors.muted,fontSize:9,fontWeight:'800'},metricValue:{color:colors.text,fontSize:14,fontWeight:'1000',marginTop:4}});
