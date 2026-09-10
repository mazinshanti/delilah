import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { colors } from '../../lib/theme';

const icon = (emoji, color) => <Text style={{ fontSize: 19, color }}>{emoji}</Text>;

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.text,
      headerShadowVisible: false,
      sceneStyle: { backgroundColor: colors.bg },
      tabBarStyle: { backgroundColor: '#0F1114', borderTopColor: colors.line, height: 66, paddingBottom: 8 },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '800' }
    }}>
      <Tabs.Screen name="index" options={{ title: 'Search', headerShown: false, tabBarIcon: ({ color }) => icon('⌕', color) }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', headerTitle: 'Saved cars', tabBarIcon: ({ color }) => icon('♡', color) }} />
      <Tabs.Screen name="sell" options={{ title: 'Sell', headerTitle: 'Sell my car', tabBarIcon: ({ color }) => icon('＋', color) }} />
    </Tabs>
  );
}
