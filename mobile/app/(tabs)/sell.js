import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { estimateCar } from '../../lib/api';
import { colors, money } from '../../lib/theme';

export default function SellScreen() {
  const [make,setMake]=useState('');
  const [model,setModel]=useState('');
  const [year,setYear]=useState('');
  const [mileage,setMileage]=useState('');
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState('');

  async function estimate(){
    if(!make.trim() || !model.trim() || !year.trim()) { setError('Make, model and year are required.'); return; }
    setLoading(true); setError(''); setResult(null);
    try { setResult(await estimateCar({make:make.trim(),model:model.trim(),year:Number(year),mileage:Number(mileage)||undefined})); }
    catch(e){ setError(e?.message || 'Valuation unavailable'); }
    finally { setLoading(false); }
  }

  const valuation=result?.valuation;
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.kicker}>DALELAH SELL</Text>
    <Text style={styles.hero}>What is your car <Text style={styles.muted}>really worth?</Text></Text>
    <Text style={styles.sub}>Dalelah compares live Saudi listings for the same car. We only show a valuation when there is enough market evidence.</Text>

    <View style={styles.form}>
      <Field label="Make" value={make} onChangeText={setMake} placeholder="Toyota" />
      <Field label="Model" value={model} onChangeText={setModel} placeholder="Camry" />
      <View style={styles.row}><View style={styles.half}><Field label="Year" value={year} onChangeText={setYear} placeholder="2022" keyboardType="number-pad" /></View><View style={styles.half}><Field label="Mileage km" value={mileage} onChangeText={setMileage} placeholder="54000" keyboardType="number-pad" /></View></View>
      <Pressable style={styles.cta} onPress={estimate} disabled={loading}>{loading?<ActivityIndicator color={colors.black}/>:<Text style={styles.ctaText}>Estimate my car →</Text>}</Pressable>
    </View>

    {error?<View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>:null}

    {valuation?<View style={styles.result}>
      <Text style={styles.resultLabel}>DALELAH MARKET VALUE</Text>
      {valuation.available ? <>
        <Text style={styles.resultPrice}>{money(valuation.marketMedianPriceSar)}</Text>
        <Text style={styles.range}>Suggested range {money(valuation.suggestedLowSar)} — {money(valuation.suggestedHighSar)}</Text>
        <Text style={styles.comps}>Based on {valuation.comparableCount} matching Saudi listings.</Text>
      </> : <>
        <Text style={styles.resultTitle}>Not enough evidence yet.</Text>
        <Text style={styles.comps}>We found {valuation.comparableCount || 0} reliable comparable listings. Dalelah will not invent a price.</Text>
      </>}
    </View>:null}

    <View style={styles.preview}><Text style={styles.previewTitle}>Sell through Dalelah</Text><Text style={styles.previewText}>Listing submission stays locked until our Saudi-hosted customer database is connected. For now you can safely test valuation without entering personal details.</Text><View style={styles.badge}><Text style={styles.badgeText}>🇸🇦 Saudi data residency required</Text></View></View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function Field({label,...props}){return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#697079" style={styles.input}/></View>}

const styles=StyleSheet.create({flex:{flex:1},safe:{flex:1,backgroundColor:colors.bg},content:{padding:20,paddingBottom:110},kicker:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.5,marginTop:16},hero:{color:colors.text,fontSize:40,lineHeight:41,fontWeight:'1000',letterSpacing:-1.8,marginTop:9},muted:{color:'#737981'},sub:{color:colors.muted,fontSize:13,lineHeight:20,marginTop:14},form:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:20,padding:15,marginTop:24},field:{marginBottom:12},label:{color:'#818790',fontSize:9,fontWeight:'900',textTransform:'uppercase',letterSpacing:.8,marginBottom:6,marginLeft:2},input:{height:49,borderWidth:1,borderColor:'#343A42',backgroundColor:'#191D22',borderRadius:12,color:colors.text,paddingHorizontal:13,fontSize:14,fontWeight:'700'},row:{flexDirection:'row',gap:10},half:{flex:1},cta:{backgroundColor:colors.accent,borderRadius:13,minHeight:50,alignItems:'center',justifyContent:'center',marginTop:2},ctaText:{color:colors.black,fontSize:12,fontWeight:'1000'},error:{backgroundColor:'#26191B',borderColor:'#66383E',borderWidth:1,borderRadius:13,padding:12,marginTop:14},errorText:{color:colors.bad,fontSize:12},result:{backgroundColor:'#121812',borderColor:'#35462D',borderWidth:1,borderRadius:20,padding:18,marginTop:16},resultLabel:{color:colors.accent,fontSize:9,fontWeight:'1000',letterSpacing:1.2},resultPrice:{color:colors.text,fontSize:36,fontWeight:'1000',letterSpacing:-1.3,marginTop:7},range:{color:colors.text,fontSize:12,fontWeight:'800',marginTop:6},comps:{color:colors.muted,fontSize:11,lineHeight:17,marginTop:8},resultTitle:{color:colors.text,fontSize:21,fontWeight:'900',marginTop:8},preview:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:20,padding:17,marginTop:16},previewTitle:{color:colors.text,fontSize:18,fontWeight:'900'},previewText:{color:colors.muted,fontSize:11,lineHeight:18,marginTop:7},badge:{alignSelf:'flex-start',backgroundColor:'#1B2118',borderRadius:999,paddingHorizontal:10,paddingVertical:7,marginTop:12},badgeText:{color:colors.ok,fontSize:9,fontWeight:'900'}});
