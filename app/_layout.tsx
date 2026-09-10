import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/theme';
import { configureNotificationHandler } from '@/lib/reminders';
import { Text } from '@/components/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const ready = useAppStore((s) => s.ready);
  const onboardingDone = useAppStore((s) => s.settings?.onboardingDone ?? false);
  const init = useAppStore((s) => s.init);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init().catch((e: Error) => setError(e.message));
  }, [init]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  let body: React.ReactNode;
  if (error) {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
        <Text variant="heading">Something went wrong opening your data.</Text>
        <Text variant="muted" style={{ marginTop: 8, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  } else if (!ready) {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  } else {
    // Route guards: before onboarding only the onboarding screen exists; after
    // it, onboarding disappears and the router lands on the tabs.
    body = (
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Protected guard={!onboardingDone}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={onboardingDone}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="entry/[id]" options={{ title: 'Edit entry', presentation: 'modal' }} />
          <Stack.Screen name="category/[id]" options={{ title: 'Category', presentation: 'modal' }} />
          <Stack.Screen name="goal/[id]" options={{ title: 'Goal', presentation: 'modal' }} />
          <Stack.Screen name="recurring/index" options={{ title: 'Repeating entries' }} />
          <Stack.Screen name="recurring/[id]" options={{ title: 'Repeating entry', presentation: 'modal' }} />
          <Stack.Screen name="settings/about" options={{ title: 'About Plainly' }} />
          <Stack.Screen name="settings/backup" options={{ title: 'Backup & export' }} />
          <Stack.Screen name="settings/smart" options={{ title: 'Smart parsing' }} />
          <Stack.Screen name="settings/keywords" options={{ title: 'Learned words' }} />
        </Stack.Protected>
      </Stack>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {body}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
