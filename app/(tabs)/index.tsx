import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { currentMonthKey, today } from '@/lib/dates';
import { balanceSentence, goalProgress, monthSummarySentence, topCategorySentence } from '@/lib/plain';
import { categoryName, useLocale, useMoney, useT } from '@/i18n';
import { EntryBar } from '@/components/EntryBar';
import { ConfirmationCard } from '@/components/ConfirmationCard';
import { MultiConfirmationCard } from '@/components/MultiConfirmationCard';
import { TransactionRow } from '@/components/TransactionRow';
import { useEntryFlow } from '@/components/useEntryFlow';
import { Button, Card, EmptyState, Row, Screen, SectionTitle, Spacer, Text } from '@/components/ui';

export default function HomeScreen() {
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
  const recent = useAppStore((s) => s.recent);
  const goals = useAppStore((s) => s.goals);
  const lifetime = useAppStore((s) => s.lifetime);
  const { pending, pendingMany, busy, submit, dismiss } = useEntryFlow();
  const [toast, setToast] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (month !== currentMonthKey()) setMonth(currentMonthKey());
  }, [month, setMonth]));

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!settings || !stats) return null;
  const currency = settings.currency;
  const isCurrent = stats.month === currentMonthKey();
  const summary = monthSummarySentence(stats, currency, isCurrent, locale);
  const top = topCategorySentence(stats, categories, currency, locale, (c) => categoryName(c, t));
  const balance = balanceSentence(settings.startingBalance, lifetime.income, lifetime.expenses, currency, locale);
  const activeGoals = goals.filter((g) => !g.completed).slice(0, 2);

  return (
    <Screen keyboard>
      <EntryBar onSubmit={submit} busy={busy} />
      {toast ? (
        <Card tone="accent" style={{ marginTop: spacing.md, paddingVertical: spacing.md }}>
          <Text variant="body">{toast}</Text>
        </Card>
      ) : null}

      <SectionTitle>{t.thisMonth}</SectionTitle>
      <Card>
        <Text variant="heading" style={{ lineHeight: 26 }}>{summary}</Text>
        {top ? <Text variant="muted" style={{ marginTop: spacing.sm }}>{top}</Text> : null}
        {balance ? <Text variant="small" style={{ marginTop: spacing.sm }}>{balance}</Text> : null}
        {stats.income > 0 || stats.expenses > 0 ? (
          <Row style={{ marginTop: spacing.lg, justifyContent: 'space-between' }}>
            <Stat label={t.inShort} value={money(stats.income, { compact: true })} color={colors.income} />
            <Stat label={t.outShort} value={money(stats.expenses, { compact: true })} color={colors.text} />
            <Stat label={t.netShort} value={money(stats.income - stats.expenses, { compact: true })} color={stats.income - stats.expenses >= 0 ? colors.income : colors.warn} />
          </Row>
        ) : null}
      </Card>

      {activeGoals.length > 0 ? (
        <>
          <SectionTitle right={<Button tone="ghost" small title={t.allGoals} onPress={() => router.push('/goals')} />}>{t.goals}</SectionTitle>
          {activeGoals.map((g) => {
            const p = goalProgress(g, currency, today(), locale);
            return (
              <Card key={g.id} style={{ marginBottom: spacing.sm }}>
                <Text variant="body" style={{ fontWeight: '600' }}>{g.name}</Text>
                <Text variant="muted" style={{ marginTop: 2 }}>{p.sentence}</Text>
              </Card>
            );
          })}
        </>
      ) : null}

      <SectionTitle right={recent.length > 0 ? <Button tone="ghost" small title={t.seeAll} onPress={() => router.push('/history')} /> : undefined}>{t.recent}</SectionTitle>
      {recent.length === 0 ? (
        <EmptyState title={t.nothingYet} body={t.nothingYetBody} />
      ) : (
        recent.map((tx) => <TransactionRow key={tx.id} tx={tx} onPress={() => router.push(`/entry/${tx.id}`)} />)
      )}
      <Spacer size={spacing.xl} />

      <ConfirmationCard result={pending} onCancel={dismiss} onDone={(msg) => { dismiss(); setToast(msg); }} />
      <MultiConfirmationCard results={pendingMany} onCancel={dismiss} onDone={(msg) => { dismiss(); setToast(msg); }} />
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View>
      <Text variant="label">{label}</Text>
      <Text variant="money" color={color} style={{ fontSize: 20, marginTop: 2 }}>{value}</Text>
    </View>
  );
}
