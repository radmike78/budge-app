import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { spacing } from '@/theme';
import { friendlyDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { FREQUENCY_LABELS, monthlyEquivalent } from '@/lib/recurring';
import { Button, EmptyState, Icon, ListItem, Screen, Text } from '@/components/ui';

export default function RecurringList() {
  const router = useRouter();
  const rules = useAppStore((s) => s.rules);
  const categories = useAppStore((s) => s.categories);
  const currency = useAppStore((s) => s.settings?.currency ?? 'USD');
  const active = rules.filter((r) => r.active);
  const paused = rules.filter((r) => !r.active);
  const monthlyOut = active.filter((r) => r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const monthlyIn = active.filter((r) => r.type === 'income').reduce((s, r) => s + monthlyEquivalent(r), 0);

  return (
    <Screen>
      <Text variant="muted" style={{ marginTop: spacing.sm }}>Set up once. Each period Plainly logs the entry for you and moves the next date forward. You can edit or remove any logged entry like normal.</Text>
      <View style={{ marginVertical: spacing.lg }}><Button title="New repeating entry" onPress={() => router.push('/recurring/new')} /></View>
      {active.length > 0 ? <Text variant="small" style={{ marginBottom: spacing.md }}>About {formatMoney(monthlyOut, currency, { compact: true })} out and {formatMoney(monthlyIn, currency, { compact: true })} in per month.</Text> : null}
      {rules.length === 0 ? <EmptyState title="Nothing repeating yet" body="Rent, salary, a streaming plan. Anything that happens on a schedule." /> : null}
      {active.map((r) => {
        const cat = categories.find((c) => c.id === r.categoryId);
        return <ListItem key={r.id} title={`${r.type === 'income' ? '+' : '−'}${formatMoney(r.amount, currency)} · ${r.note || cat?.name || ''}`} subtitle={`${FREQUENCY_LABELS[r.frequency]} · next ${friendlyDate(r.nextOccurrence)}`} left={<Icon glyph={cat?.icon} size={22} />} onPress={() => router.push(`/recurring/${r.id}`)} />;
      })}
      {paused.length > 0 ? <Text variant="label" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Paused</Text> : null}
      {paused.map((r) => {
        const cat = categories.find((c) => c.id === r.categoryId);
        return <ListItem key={r.id} title={`${formatMoney(r.amount, currency)} · ${r.note || cat?.name || ''}`} subtitle={`${FREQUENCY_LABELS[r.frequency]} · paused`} left={<Icon glyph={cat?.icon} size={22} />} onPress={() => router.push(`/recurring/${r.id}`)} />;
      })}
    </Screen>
  );
}
