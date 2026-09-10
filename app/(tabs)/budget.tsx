import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { currentMonthKey, monthLabel, shiftMonthKey } from '@/lib/dates';
import { categoryLineSentence, monthSummarySentence } from '@/lib/plain';
import { monthlyEquivalent } from '@/lib/recurring';
import { categoryName, useLocale, useMoney, useT } from '@/i18n';
import { Button, Card, Icon, ListItem, ProgressBar, Row, Screen, SectionTitle, Text } from '@/components/ui';

export default function BudgetScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
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
        <Pressable accessibilityRole="button" accessibilityLabel={t.previousMonth} onPress={() => setMonth(shiftMonthKey(month, -1))} hitSlop={12}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text variant="heading">{monthLabel(month, locale.format)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t.nextMonth} onPress={() => setMonth(shiftMonthKey(month, 1))} hitSlop={12} disabled={isCurrent} style={{ opacity: isCurrent ? 0.3 : 1 }}><Ionicons name="chevron-forward" size={24} color={colors.text} /></Pressable>
      </Row>

      <Card style={{ marginTop: spacing.md }}>
        <Text variant="body">{monthSummarySentence(stats, currency, isCurrent, locale)}</Text>
        {planned > 0 ? <Text variant="small" style={{ marginTop: spacing.sm }}>{t.plannedAcross(money(planned, { compact: true }))}</Text> : null}
      </Card>

      <SectionTitle right={<Button tone="ghost" small title={t.add} onPress={() => router.push('/category/new?kind=expense')} />}>{t.spending}</SectionTitle>
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
                    <Text variant="body" style={{ fontWeight: '600' }}>{categoryName(c, t)}</Text>
                    <Text variant="money">{money(spent, { compact: true })}</Text>
                  </Row>
                  <Text variant="small">{categoryLineSentence(c, spent, currency, locale)}</Text>
                </View>
              </Row>
              {hasLimit ? <View style={{ marginTop: spacing.sm }}><ProgressBar fraction={fraction} tone={fraction > 1 ? 'warn' : 'accent'} /></View> : null}
            </Card>
          </Pressable>
        );
      })}

      <SectionTitle right={<Button tone="ghost" small title={t.add} onPress={() => router.push('/category/new?kind=income')} />}>{t.incomeSection}</SectionTitle>
      {incomeCats.map((c) => (
        <ListItem key={c.id} title={categoryName(c, t)} left={<Icon glyph={c.icon} size={22} />} onPress={() => router.push(`/category/${c.id}`)} />
      ))}

      <SectionTitle right={<Button tone="ghost" small title={t.manage} onPress={() => router.push('/recurring')} />}>{t.repeating}</SectionTitle>
      <Card>
        {activeRules.length === 0 ? (
          <Text variant="muted">{t.repeatingEmpty}</Text>
        ) : (
          <Text variant="body">{t.repeatingSummary(activeRules.length, money(recurringOut, { compact: true }))}</Text>
        )}
      </Card>

      {archived.length > 0 ? (
        <>
          <SectionTitle>{t.archived}</SectionTitle>
          {archived.map((c) => (
            <ListItem key={c.id} title={categoryName(c, t)} subtitle={t.archivedHint} left={<Icon glyph={c.icon} size={22} />} onPress={() => router.push(`/category/${c.id}`)} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
