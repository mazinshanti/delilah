import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useSaved } from '../../context/SavedContext';
import { colors, money } from '../../lib/theme';

export default function SavedScreen() {
  const router = useRouter();
  const { saved, toggleSaved } = useSaved();

  function openCar(car) {
    router.push({ pathname:'/car/[id]', params:{
      id: encodeURIComponent(String(car.id || car.url || car.title)), title:String(car.title || ''), price:String(car.price ?? car.priceSar ?? ''), year:String(car.year ?? ''), mileage:String(car.mileage ?? car.mileageKm ?? ''), city:String(car.city || ''), source:String(car.source || car.seller || ''), image:String(car.image || car.displayImage || ''), url:String(car.url || car.originalUrl || '')
    }});
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={saved}
        keyExtractor={(item,index)=>String(item.url || item.id || index)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View><Text style={styles.kicker}>YOUR SHORTLIST</Text><Text style={styles.title}>{saved.length ? `${saved.length} saved car${saved.length===1?'':'s'}` : 'Nothing saved yet'}</Text><Text style={styles.sub}>Keep the cars you like here and compare them later.</Text></View>}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyIcon}>♡</Text><Text style={styles.emptyText}>Tap the heart on any listing to save it.</Text></View>}
        renderItem={({item})=><Pressable onPress={()=>openCar(item)} style={styles.card}>
          {item.image || item.displayImage ? <Image source={{uri:item.image || item.displayImage}} style={styles.thumb}/> : <View style={styles.thumbFallback}><Text>🚙</Text></View>}
          <View style={styles.body}><Text style={styles.carTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.meta}>{[item.year,item.city,item.source].filter(Boolean).join(' · ')}</Text><Text style={styles.price}>{money(item.price ?? item.priceSar)}</Text></View>
          <Pressable onPress={()=>toggleSaved(item)} style={styles.remove}><Text style={styles.removeText}>♥</Text></Pressable>
        </Pressable>}
      />
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},content:{padding:20,paddingBottom:110,gap:12},kicker:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.4,marginTop:16},title:{color:colors.text,fontSize:34,fontWeight:'1000',letterSpacing:-1.4,marginTop:8},sub:{color:colors.muted,fontSize:13,lineHeight:19,marginTop:8,marginBottom:22},card:{flexDirection:'row',alignItems:'center',backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:17,padding:10},thumb:{width:92,height:78,borderRadius:12,backgroundColor:colors.panel2},thumbFallback:{width:92,height:78,borderRadius:12,backgroundColor:colors.panel2,alignItems:'center',justifyContent:'center'},body:{flex:1,paddingHorizontal:11},carTitle:{color:colors.text,fontSize:14,fontWeight:'900'},meta:{color:colors.muted,fontSize:9,marginTop:5},price:{color:colors.text,fontSize:15,fontWeight:'1000',marginTop:6},remove:{width:36,height:36,borderRadius:18,backgroundColor:'#1C2025',alignItems:'center',justifyContent:'center'},removeText:{color:colors.accent,fontSize:18},empty:{alignItems:'center',paddingTop:90},emptyIcon:{color:colors.accent,fontSize:46},emptyText:{color:colors.muted,fontSize:13,marginTop:12}}
);