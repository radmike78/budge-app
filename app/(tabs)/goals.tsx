import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { spacing } from '@/theme';
import { today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { goalDeadlineLabel, goalProgress } from '@/lib/plain';
import { Button, Card, EmptyState, ProgressBar, Row, Screen, SectionTitle, Text } from '@/components/ui';

export default function GoalsScreen() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const goals = useAppStore((s) => s.goals);
  if (!settings) return null;
  const currency = settings.currency;
  const active = goals.filter((g) => !g.completed);
  const done = goals.filter((g) => g.completed);
  const t = today();

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Text variant="muted" style={{ flex: 1 }}>Say "goal: save 500 for a trip by December" on the Today tab, or add one here.</Text>
      </Row>
      <View style={{ marginTop: spacing.md }}>
        <Button title="New goal" onPress={() => router.push('/goal/new')} />
      </View>

      <SectionTitle>Active</SectionTitle>
      {active.length === 0 ? (
        <EmptyState title="No goals yet" body="A goal is just a number and a name. A date is optional." />
      ) : (
        active.map((g) => {
          const p = goalProgress(g, currency, t);
          const deadline = goalDeadlineLabel(g, t);
          return (
            <Pressable key={g.id} accessibilityRole="button" onPress={() => router.push(`/goal/${g.id}`)}>
              <Card style={{ marginBottom: spacing.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="heading">{g.name}</Text>
                  <Text variant="money">{formatMoney(g.currentAmount, currency, { compact: true })} / {formatMoney(g.targetAmount, currency, { compact: true })}</Text>
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
          <SectionTitle>Done</SectionTitle>
          {done.map((g) => (
            <Pressable key={g.id} accessibilityRole="button" onPress={() => router.push(`/goal/${g.id}`)}>
              <Card tone="alt" style={{ marginBottom: spacing.sm }}>
                <Text variant="body" style={{ fontWeight: '600' }}>{g.name}</Text>
                <Text variant="small">Saved {formatMoney(g.targetAmount, currency, { compact: true })}.</Text>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
