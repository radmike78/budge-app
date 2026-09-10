import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { spacing } from '@/theme';
import { friendlyDate, today } from '@/lib/dates';
import { monthlyEquivalent } from '@/lib/recurring';
import { categoryName, useDateFormat, useMoney, useT } from '@/i18n';
import { Button, EmptyState, Icon, ListItem, Screen, Text } from '@/components/ui';

export default function RecurringList() {
  const router = useRouter();
  const t = useT();
  const money = useMoney();
  const fmt = useDateFormat();
  const rules = useAppStore((s) => s.rules);
  const categories = useAppStore((s) => s.categories);
  const active = rules.filter((r) => r.active);
  const paused = rules.filter((r) => !r.active);
  const monthlyOut = active.filter((r) => r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const monthlyIn = active.filter((r) => r.type === 'income').reduce((s, r) => s + monthlyEquivalent(r), 0);

  return (
    <Screen>
      <Text variant="muted" style={{ marginTop: spacing.sm }}>{t.recurringIntro}</Text>
      <View style={{ marginVertical: spacing.lg }}><Button title={t.newRecurring} onPress={() => router.push('/recurring/new')} /></View>
      {active.length > 0 ? <Text variant="small" style={{ marginBottom: spacing.md }}>{t.recurringTotals(money(monthlyOut, { compact: true }), money(monthlyIn, { compact: true }))}</Text> : null}
      {rules.length === 0 ? <EmptyState title={t.nothingRepeating} body={t.nothingRepeatingBody} /> : null}
      {active.map((r) => {
        const cat = categories.find((c) => c.id === r.categoryId);
        return <ListItem key={r.id} title={`${r.type === 'income' ? '+' : '−'}${money(r.amount)} · ${r.note || (cat ? categoryName(cat, t) : '')}`} subtitle={`${t.frequency[r.frequency]} · ${t.nextDate(friendlyDate(r.nextOccurrence, today(), fmt))}`} left={<Icon glyph={cat?.icon} size={22} />} onPress={() => router.push(`/recurring/${r.id}`)} />;
      })}
      {paused.length > 0 ? <Text variant="label" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t.paused}</Text> : null}
      {paused.map((r) => {
        const cat = categories.find((c) => c.id === r.categoryId);
        return <ListItem key={r.id} title={`${money(r.amount)} · ${r.note || (cat ? categoryName(cat, t) : '')}`} subtitle={`${t.frequency[r.frequency]} · ${t.pausedWord}`} left={<Icon glyph={cat?.icon} size={22} />} onPress={() => router.push(`/recurring/${r.id}`)} />;
      })}
    </Screen>
  );
}
