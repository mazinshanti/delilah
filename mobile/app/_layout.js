import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { LanguageProvider,useLanguage } from '../context/LanguageContext';
import { SavedProvider } from '../context/SavedContext';
import { colors } from '../lib/theme';

function AppStack(){
  const {t}=useLanguage();
  return <>
    <StatusBar style="light" />
    <Stack screenOptions={{
      headerStyle:{backgroundColor:colors.bg},
      headerTintColor:colors.text,
      headerShadowVisible:false,
      contentStyle:{backgroundColor:colors.bg}
    }}>
      <Stack.Screen name="(tabs)" options={{headerShown:false}} />
      <Stack.Screen name="car/[id]" options={{title:t.carDetails,presentation:'card'}} />
    </Stack>
  </>;
}

export default function RootLayout(){
  return <LanguageProvider><SavedProvider><AppStack/></SavedProvider></LanguageProvider>;
}
