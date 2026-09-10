import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { currentMonthKey, monthLabel, shiftMonthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { categoryLineSentence, monthSummarySentence } from '@/lib/plain';
import { monthlyEquivalent } from '@/lib/recurring';
import { Button, Card, Icon, ListItem, ProgressBar, Row, Screen, SectionTitle, Text } from '@/components/ui';

export default function BudgetScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const settings = useAppStore((s) => s.settings);
  const stats = useAppStore((s) => s.stats);
  const month = useAppStore((s) => s.month);
  const setMonth = useAppStore((s) => s.setMonth);
  const categories = useAppStore((s) => s.categories);
  const rules = useAppStore((s) => s.rules);

  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of stats?.byCategory ?? []) if (b.categoryId) m.set(b.categoryId, b.total);
    return m;
  }, [stats]);

  if (!settings || !stats) return null;
  const currency = settings.currency;
  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.archived).sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) || a.sortOrder - b.sortOrder);
  const incomeCats = categories.filter((c) => c.kind === 'income' && !c.archived);
  const archived = categories.filter((c) => c.archived);
  const planned = expenseCats.reduce((s, c) => s + (c.monthlyLimit ?? 0), 0);
  const activeRules = rules.filter((r) => r.active);
  const recurringOut = activeRules.filter((r) => r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const isCurrent = month === currentMonthKey();

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(shiftMonthKey(month, -1))} hitSlop={12}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text variant="heading">{monthLabel(month)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(shiftMonthKey(month, 1))} hitSlop={12} disabled={isCurrent} style={{ opacity: isCurrent ? 0.3 : 1 }}><Ionicons name="chevron-forward" size={24} color={colors.text} /></Pressable>
      </Row>

      <Card style={{ marginTop: spacing.md }}>
        <Text variant="body">{monthSummarySentence(stats, currency, isCurrent)}</Text>
        {planned > 0 ? <Text variant="small" style={{ marginTop: spacing.sm }}>You've planned {formatMoney(planned, currency, { compact: true })} across categories with a limit. Limits are optional.</Text> : null}
      </Card>

      <SectionTitle right={<Button tone="ghost" small title="Add" onPress={() => router.push('/category/new?kind=expense')} />}>Spending</SectionTitle>
      {expenseCats.map((c) => {
        const spent = totals.get(c.id) ?? 0;
        const hasLimit = c.monthlyLimit != null && c.monthlyLimit > 0;
        const fraction = hasLimit ? spent / (c.monthlyLimit as number) : 0;
        return (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/category/${c.id}`)}>
            <Card style={{ marginBottom: spacing.sm, paddingVertical: spacing.md }}>
              <Row>
                <Icon glyph={c.icon} size={22} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text variant="body" style={{ fontWeight: '600' }}>{c.name}</Text>
                    <Text variant="money">{formatMoney(spent, currency, { compact: true })}</Text>
                  </Row>
                  <Text variant="small">{categoryLineSentence(c, spent, currency)}</Text>
                </View>
              </Row>
              {hasLimit ? <View style={{ marginTop: spacing.sm }}><ProgressBar fraction={fraction} tone={fraction > 1 ? 'warn' : 'accent'} /></View> : null}
            </Card>
          </Pressable>
        );
      })}

      <SectionTitle right={<Button tone="ghost" small title="Add" onPress={() => router.push('/category/new?kind=income')} />}>Income</SectionTitle>
      {incomeCats.map((c) => (
        <ListItem key={c.id} title={c.name} left={<Icon glyph={c.icon} size={22} />} onPress={() => router.push(`/category/${c.id}`)} />
      ))}

      <SectionTitle right={<Button tone="ghost" small title="Manage" onPress={() => router.push('/recurring')} />}>Repeating</SectionTitle>
      <Card>
        {activeRules.length === 0 ? (
          <Text variant="muted">Rent, salary, subscriptions: set them up once and they log themselves each period.</Text>
        ) : (
          <Text variant="body">{activeRules.length} repeating {activeRules.length === 1 ? 'entry' : 'entries'}. About {formatMoney(recurringOut, currency, { compact: true })} a month goes out automatically.</Text>
        )}
      </Card>

      {archived.length > 0 ? (
        <>
          <SectionTitle>Archived</SectionTitle>
          {archived.map((c) => (
            <ListItem key={c.id} title={c.name} subtitle="Archived. Tap to restore or delete." left={<Icon glyph={c.icon} size={22} />} onPress={() => router.push(`/category/${c.id}`)} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
