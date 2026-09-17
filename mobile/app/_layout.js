import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SavedProvider } from '../context/SavedContext';
import { colors } from '../lib/theme';
export default function RootLayout(){return <SavedProvider><StatusBar style="dark"/><Stack screenOptions={{headerStyle:{backgroundColor:colors.bg},headerTintColor:colors.text,headerShadowVisible:false,contentStyle:{backgroundColor:colors.bg},headerTitleStyle:{fontWeight:'700'}}}><Stack.Screen name="(tabs)" options={{headerShown:false}}/><Stack.Screen name="car/[id]" options={{title:'تفاصيل السيارة',presentation:'card'}}/></Stack></SavedProvider>}
