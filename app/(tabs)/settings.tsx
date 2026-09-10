import React, { useState } from 'react';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import type { ThemeSetting } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { CURRENCIES, currencyInfo } from '@/lib/money';
import { cancelDailyReminder, scheduleDailyReminder } from '@/lib/reminders';
import { triggerOfflineModelDownload } from '@/lib/speech';
import { Sheet } from '@/components/pickers';
import { Button, Card, ListItem, Row, Screen, SectionTitle, Segmented, Text } from '@/components/ui';

function hourLabel(h: number): string {
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${suffix}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const keywords = useAppStore((s) => s.keywords);
  const [showCurrency, setShowCurrency] = useState(false);
  if (!settings) return null;

  const toggleReminder = async (on: boolean) => {
    if (on) {
      const ok = await scheduleDailyReminder(settings.reminderHour);
      if (!ok) {
        Alert.alert('Notifications are off', 'Turn them on for Plainly in your phone settings if you want a daily nudge.');
        return;
      }
    } else {
      await cancelDailyReminder();
    }
    await updateSettings({ reminderEnabled: on });
  };

  const changeHour = async (delta: number) => {
    const hour = (settings.reminderHour + delta + 24) % 24;
    await updateSettings({ reminderHour: hour });
    if (settings.reminderEnabled) await scheduleDailyReminder(hour);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <SectionTitle>Your data</SectionTitle>
      <ListItem title="Backup & export" subtitle="CSV, a readable summary, or a full backup you can restore from." onPress={() => router.push('/settings/backup')} />
      <ListItem title="Repeating entries" subtitle="Rent, salary, subscriptions." onPress={() => router.push('/recurring')} />
      <ListItem title="Categories" subtitle="Add, rename, set optional limits, archive." onPress={() => router.push('/budget')} />
      <ListItem title="Learned words" subtitle={keywords.length ? `${keywords.length} word${keywords.length === 1 ? '' : 's'} remembered from your corrections.` : 'Words you correct are remembered here.'} onPress={() => router.push('/settings/keywords')} />

      <SectionTitle>Preferences</SectionTitle>
      <ListItem title="Currency" subtitle={`${currencyInfo(settings.currency).name} (${settings.currency})`} onPress={() => setShowCurrency(true)} />
      <Card style={{ marginBottom: spacing.sm }}>
        <Text variant="label" style={{ marginBottom: spacing.sm }}>Appearance</Text>
        <Segmented<ThemeSetting> value={settings.theme} onChange={(theme) => updateSettings({ theme })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </Card>
      <Card style={{ marginBottom: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text variant="body">Daily reminder</Text>
            <Text variant="small">One quiet nudge a day. No badges, no streaks.</Text>
          </View>
          <Switch value={settings.reminderEnabled} onValueChange={toggleReminder} trackColor={{ true: colors.accent }} />
        </Row>
        {settings.reminderEnabled ? (
          <Row style={{ marginTop: spacing.md, justifyContent: 'space-between' }}>
            <Button tone="secondary" small title="−1h" onPress={() => changeHour(-1)} />
            <Text variant="body">{hourLabel(settings.reminderHour)}</Text>
            <Button tone="secondary" small title="+1h" onPress={() => changeHour(1)} />
          </Row>
        ) : null}
      </Card>
      {Platform.OS === 'android' ? (
        <ListItem title="Offline voice model" subtitle="Download the on-device recognizer so voice works without a connection (Android 13+)." onPress={async () => Alert.alert('Voice model', await triggerOfflineModelDownload())} />
      ) : null}
      <ListItem title="Smart parsing assist" subtitle={settings.smartParseEnabled ? 'On. Used only when the built-in parser is unsure.' : 'Off. Everything is parsed on your phone.'} onPress={() => router.push('/settings/smart')} />

      <SectionTitle>About</SectionTitle>
      <ListItem title="About Plainly" subtitle="No bank linking. No ads. No tracking. Ever." onPress={() => router.push('/settings/about')} />
      <Text variant="small" style={{ marginTop: spacing.md, textAlign: 'center' }}>Plainly {version}</Text>

      <Sheet visible={showCurrency} onClose={() => setShowCurrency(false)} title="Currency" tall>
        <ScrollView>
          {CURRENCIES.map((c) => (
            <ListItem key={c.code} title={`${c.symbol.trim()} ${c.name}`} subtitle={c.code} right={c.code === settings.currency ? <Text>✓</Text> : null} onPress={() => { updateSettings({ currency: c.code }); setShowCurrency(false); }} />
          ))}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
