import React, { useState } from 'react';
import { Platform, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import type { ThemeSetting } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { CURRENCIES, currencyInfo } from '@/lib/money';
import { cancelDailyReminder, scheduleDailyReminder } from '@/lib/reminders';
import { triggerOfflineModelDownload } from '@/lib/speech';
import { LANGUAGE_OPTIONS, useLanguageCode, useT } from '@/i18n';
import { notify } from '@/lib/dialogs';
import { Sheet } from '@/components/pickers';
import { Button, Card, ListItem, Row, Screen, SectionTitle, Segmented, Text } from '@/components/ui';

function hourLabel(h: number): string {
  return `${h < 10 ? '0' : ''}${h}:00`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const languageCode = useLanguageCode();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const keywords = useAppStore((s) => s.keywords);
  const [showCurrency, setShowCurrency] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  if (!settings) return null;

  const reminderText = { title: t.reminderTitle, body: t.reminderBody };

  const toggleReminder = async (on: boolean) => {
    if (on) {
      const ok = await scheduleDailyReminder(settings.reminderHour, reminderText);
      if (!ok) {
        notify(t.notificationsOff, t.notificationsOffBody);
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
    if (settings.reminderEnabled) await scheduleDailyReminder(hour, reminderText);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const languageLabel = settings.language === 'system' ? `${t.systemLanguage} (${LANGUAGE_OPTIONS.find((o) => o.code === languageCode)?.name ?? languageCode})` : LANGUAGE_OPTIONS.find((o) => o.code === settings.language)?.name ?? settings.language;

  return (
    <Screen>
      <SectionTitle>{t.yourData}</SectionTitle>
      <ListItem title={t.backupExport} subtitle={t.backupExportSub} onPress={() => router.push('/settings/backup')} />
      <ListItem title={t.repeatingEntries} subtitle={t.repeatingEntriesSub} onPress={() => router.push('/recurring')} />
      <ListItem title={t.categories} subtitle={t.categoriesSub} onPress={() => router.push('/budget')} />
      <ListItem title={t.learnedWords} subtitle={t.learnedWordsSub(keywords.length)} onPress={() => router.push('/settings/keywords')} />

      <SectionTitle>{t.preferences}</SectionTitle>
      <ListItem title={t.language} subtitle={languageLabel} onPress={() => setShowLanguage(true)} />
      <ListItem title={t.currency} subtitle={`${currencyInfo(settings.currency).name} (${settings.currency})`} onPress={() => setShowCurrency(true)} />
      <Card style={{ marginBottom: spacing.sm }}>
        <Text variant="label" style={{ marginBottom: spacing.sm }}>{t.appearance}</Text>
        <Segmented<ThemeSetting> value={settings.theme} onChange={(theme) => updateSettings({ theme })} options={[{ value: 'system', label: t.themeSystem }, { value: 'light', label: t.themeLight }, { value: 'dark', label: t.themeDark }]} />
      </Card>
      {Platform.OS !== 'web' ? <Card style={{ marginBottom: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text variant="body">{t.dailyReminder}</Text>
            <Text variant="small">{t.dailyReminderSub}</Text>
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
      </Card> : null}
      {Platform.OS === 'android' ? (
        <ListItem title={t.offlineVoice} subtitle={t.offlineVoiceSub} onPress={async () => notify(t.voiceModel, await triggerOfflineModelDownload(languageCode))} />
      ) : null}
      <ListItem title={t.smartParse} subtitle={settings.smartParseEnabled ? t.smartParseOn : t.smartParseOff} onPress={() => router.push('/settings/smart')} />

      <SectionTitle>{t.about}</SectionTitle>
      <ListItem title={t.aboutApp} subtitle={t.aboutSub} onPress={() => router.push('/settings/about')} />
      <Text variant="small" style={{ marginTop: spacing.md, textAlign: 'center' }}>{t.appName} {version}</Text>

      <Sheet visible={showCurrency} onClose={() => setShowCurrency(false)} title={t.currency} tall>
        <ScrollView>
          {CURRENCIES.map((c) => (
            <ListItem key={c.code} title={`${c.symbol.trim()} ${c.name}`} subtitle={c.code} right={c.code === settings.currency ? <Text>✓</Text> : null} onPress={() => { updateSettings({ currency: c.code }); setShowCurrency(false); }} />
          ))}
        </ScrollView>
      </Sheet>
      <Sheet visible={showLanguage} onClose={() => setShowLanguage(false)} title={t.language}>
        <ScrollView>
          <ListItem title={t.systemLanguage} right={settings.language === 'system' ? <Text>✓</Text> : null} onPress={() => { updateSettings({ language: 'system' }); setShowLanguage(false); }} />
          {LANGUAGE_OPTIONS.map((o) => (
            <ListItem key={o.code} title={o.name} right={settings.language === o.code ? <Text>✓</Text> : null} onPress={() => { updateSettings({ language: o.code }); setShowLanguage(false); }} />
          ))}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
