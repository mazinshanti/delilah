import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSaved } from '../../context/SavedContext';
import { colors, money, number } from '../../lib/theme';

export default function CarDetailScreen(){
  const p=useLocalSearchParams();
  const car={id:p.id,title:p.title,price:Number(p.price)||null,year:p.year?Number(p.year):null,mileage:p.mileage?Number(p.mileage):null,city:p.city,source:p.source,image:p.image,url:p.url};
  const {isSaved,toggleSaved}=useSaved();
  const saved=isSaved(car);
  const mileage=number(car.mileage);
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.photo}>{car.image?<Image source={{uri:car.image}} style={styles.image}/>:<Text style={styles.fallback}>🚙</Text>}<View style={styles.source}><Text style={styles.sourceText}>{car.source || 'Market listing'}</Text></View></View>
    <View style={styles.body}>
      <Text style={styles.title}>{car.title || 'Vehicle'}</Text>
      <Text style={styles.price}>{money(car.price)}</Text>
      <View style={styles.facts}>{car.year?<Fact label="Year" value={car.year}/>:null}{mileage?<Fact label="Mileage" value={`${mileage} km`}/>:null}{car.city?<Fact label="City" value={car.city}/>:null}</View>
      <View style={styles.actions}>
        <Pressable style={styles.save} onPress={()=>toggleSaved(car)}><Text style={styles.saveText}>{saved?'♥ Saved':'♡ Save car'}</Text></Pressable>
        {car.url?<Pressable style={styles.open} onPress={()=>Linking.openURL(String(car.url))}><Text style={styles.openText}>View original listing →</Text></Pressable>:null}
      </View>
      <View style={styles.notice}><Text style={styles.noticeTitle}>Dalelah transparency</Text><Text style={styles.noticeText}>This car comes from {car.source || 'an external source'}. Dalelah helps you discover and compare it; the original seller remains the source of truth for the listing.</Text></View>
    </View>
  </ScrollView></SafeAreaView>;
}
function Fact({label,value}){return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},content:{paddingBottom:70},photo:{height:310,backgroundColor:colors.panel2,alignItems:'center',justifyContent:'center'},image:{width:'100%',height:'100%',resizeMode:'cover'},fallback:{fontSize:60},source:{position:'absolute',right:14,bottom:14,backgroundColor:'rgba(9,10,11,.88)',borderRadius:999,paddingHorizontal:10,paddingVertical:7},sourceText:{color:colors.text,fontSize:9,fontWeight:'900'},body:{padding:20},title:{color:colors.text,fontSize:28,lineHeight:33,fontWeight:'1000',letterSpacing:-.9},price:{color:colors.accent,fontSize:31,fontWeight:'1000',marginTop:12},facts:{flexDirection:'row',gap:8,marginTop:18,flexWrap:'wrap'},fact:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:13,paddingHorizontal:12,paddingVertical:9},factLabel:{color:colors.muted,fontSize:8,fontWeight:'900',textTransform:'uppercase'},factValue:{color:colors.text,fontSize:12,fontWeight:'900',marginTop:3},actions:{gap:9,marginTop:22},save:{borderWidth:1,borderColor:colors.line,borderRadius:14,minHeight:51,alignItems:'center',justifyContent:'center'},saveText:{color:colors.accent,fontSize:12,fontWeight:'1000'},open:{backgroundColor:colors.accent,borderRadius:14,minHeight:52,alignItems:'center',justifyContent:'center'},openText:{color:colors.black,fontSize:12,fontWeight:'1000'},notice:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:17,padding:15,marginTop:20},noticeTitle:{color:colors.text,fontSize:13,fontWeight:'900'},noticeText:{color:colors.muted,fontSize:10,lineHeight:16,marginTop:6}});
