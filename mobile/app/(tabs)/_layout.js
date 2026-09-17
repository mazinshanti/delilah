import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { colors } from '../../lib/theme';

const icon=(emoji,color)=><Text style={{fontSize:19,color}}>{emoji}</Text>;

export default function TabLayout(){
  const {t}=useLanguage();
  return <Tabs screenOptions={{
    headerStyle:{backgroundColor:colors.bg},headerTintColor:colors.text,headerShadowVisible:false,sceneStyle:{backgroundColor:colors.bg},
    tabBarStyle:{backgroundColor:'#0F1114',borderTopColor:colors.line,height:68,paddingBottom:9},
    tabBarActiveTintColor:colors.accent,tabBarInactiveTintColor:colors.muted,tabBarLabelStyle:{fontSize:11,fontWeight:'800'}
  }}>
    <Tabs.Screen name="index" options={{title:t.search,headerShown:false,tabBarIcon:({color})=>icon('⌕',color)}} />
    <Tabs.Screen name="saved" options={{title:t.saved,headerTitle:t.saved,tabBarIcon:({color})=>icon('♡',color)}} />
    <Tabs.Screen name="sell" options={{title:t.sell,headerTitle:t.sell,tabBarIcon:({color})=>icon('＋',color)}} />
  </Tabs>;
}
