import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="room/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="room/join" options={{ presentation: 'modal' }} />
        <Stack.Screen name="room/index" options={{ headerShown: false }} />
        <Stack.Screen name="room/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="room/progress" options={{ presentation: 'card' }} />
        <Stack.Screen name="room/details" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meeting-points/finder" options={{ presentation: 'card' }} />
        <Stack.Screen name="voting/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="discover" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

