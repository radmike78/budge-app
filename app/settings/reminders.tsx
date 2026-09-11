import React, { useCallback } from 'react';
import { Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { spacing } from '@/theme';
import { today } from '@/lib/dates';
import { reminderSentence } from '@/lib/plain';
import { nextOccurrence, openNotificationSettings } from '@/lib/reminders';
import { confirmDialog } from '@/lib/dialogs';
import { useLocale, useT } from '@/i18n';
import { Button, Card, EmptyState, ListItem, Screen, Text } from '@/components/ui';

/** Every reminder the user has asked for, with a plain note when notifications are off. */
export default function RemindersScreen() {
  const t = useT();
  const locale = useLocale();
  const reminders = useAppStore((s) => s.reminders);
  const notifications = useAppStore((s) => s.notifications);
  const removeReminder = useAppStore((s) => s.removeReminder);
  const rearm = useAppStore((s) => s.rearmReminders);

  useFocusEffect(useCallback(() => { rearm().catch(() => {}); }, [rearm]));

  const sorted = [...reminders].sort((a, b) => (nextOccurrence(a)?.getTime() ?? 0) - (nextOccurrence(b)?.getTime() ?? 0));
  const remove = async (id: string, text: string) => {
    if (await confirmDialog(t.removeReminderQ, text, { confirmText: t.remove, cancelText: t.keep, destructive: true })) await removeReminder(id);
  };

  return (
    <Screen>
      <Text variant="muted" style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>{t.remindersSub}</Text>
      {Platform.OS === 'web' ? (
        <Card tone="alt" style={{ marginBottom: spacing.md }}><Text variant="body">{t.remindersUnsupported}</Text></Card>
      ) : notifications === 'denied' ? (
        <Card tone="accent" style={{ marginBottom: spacing.md }}>
          <Text variant="body">{t.notificationsBlocked}</Text>
          <View style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
            <Button small tone="primary" title={t.openSettings} onPress={openNotificationSettings} />
          </View>
        </Card>
      ) : null}
      {sorted.length === 0 ? (
        <EmptyState title={t.noReminders} body={t.noRemindersBody} />
      ) : (
        sorted.map((r) => (
          <ListItem
            key={r.id}
            title={r.text}
            subtitle={reminderSentence(r, today(), locale)}
            right={<Button tone="ghost" small title={t.remove} onPress={() => remove(r.id, r.text)} />}
          />
        ))
      )}
    </Screen>
  );
}
