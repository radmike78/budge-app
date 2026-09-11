import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { spacing } from '@/theme';
import { today } from '@/lib/dates';
import { goalDeadlineLabel, goalProgress } from '@/lib/plain';
import { useLocale, useMoney, useT } from '@/i18n';
import { Button, Card, EmptyState, ProgressBar, Row, Screen, SectionTitle, Text } from '@/components/ui';

export default function GoalsScreen() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const settings = useAppStore((s) => s.settings);
  const goals = useAppStore((s) => s.goals);
  if (!settings) return null;
  const currency = settings.currency;
  const active = goals.filter((g) => !g.completed);
  const done = goals.filter((g) => g.completed);
  const now = today();

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Text variant="muted" style={{ flex: 1 }}>{t.goalsIntro}</Text>
      </Row>
      <View style={{ marginTop: spacing.md }}>
        <Button title={t.newGoalButton} onPress={() => router.push('/goal/new')} />
      </View>

      <SectionTitle>{t.active}</SectionTitle>
      {active.length === 0 ? (
        <EmptyState title={t.noGoals} body={t.noGoalsBody} />
      ) : (
        active.map((g) => {
          const p = goalProgress(g, currency, now, locale);
          const deadline = goalDeadlineLabel(g, now, locale);
          return (
            <Pressable key={g.id} accessibilityRole="button" onPress={() => router.push(`/goal/${g.id}`)}>
              <Card style={{ marginBottom: spacing.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="heading">{g.kind === 'debt' ? `${t.goalKindDebt} · ${g.name}` : g.name}</Text>
                  <Text variant="money">{money(g.currentAmount, { compact: true })} / {money(g.targetAmount, { compact: true })}</Text>
                </Row>
                {deadline ? <Text variant="small" style={{ marginTop: 2 }}>{deadline}</Text> : null}
                <View style={{ marginVertical: spacing.md }}><ProgressBar fraction={p.fraction} /></View>
                <Text variant="muted">{p.sentence}</Text>
              </Card>
            </Pressable>
          );
        })
      )}

      {done.length > 0 ? (
        <>
          <SectionTitle>{t.done}</SectionTitle>
          {done.map((g) => (
            <Pressable key={g.id} accessibilityRole="button" onPress={() => router.push(`/goal/${g.id}`)}>
              <Card tone="alt" style={{ marginBottom: spacing.sm }}>
                <Text variant="body" style={{ fontWeight: '600' }}>{g.name}</Text>
                <Text variant="small">{g.kind === 'debt' ? t.paidDownAmount(money(g.targetAmount, { compact: true })) : t.savedAmount(money(g.targetAmount, { compact: true }))}</Text>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
