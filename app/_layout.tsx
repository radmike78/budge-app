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
import { useT } from '@/i18n';
import { Text } from '@/components/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const t = useT();
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
        <Text variant="heading">{t.openError}</Text>
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
    body = (
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Protected guard={!onboardingDone}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={onboardingDone}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="entry/[id]" options={{ title: t.saveChanges, presentation: 'modal' }} />
          <Stack.Screen name="category/[id]" options={{ title: t.category, presentation: 'modal' }} />
          <Stack.Screen name="goal/[id]" options={{ title: t.goals, presentation: 'modal' }} />
          <Stack.Screen name="recurring/index" options={{ title: t.repeatingEntries }} />
          <Stack.Screen name="recurring/[id]" options={{ title: t.repeatingEntries, presentation: 'modal' }} />
          <Stack.Screen name="settings/about" options={{ title: t.aboutApp }} />
          <Stack.Screen name="settings/backup" options={{ title: t.backupExport }} />
          <Stack.Screen name="settings/smart" options={{ title: t.smartParse }} />
          <Stack.Screen name="settings/keywords" options={{ title: t.learnedWords }} />
          <Stack.Screen name="settings/reminders" options={{ title: t.reminders }} />
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
