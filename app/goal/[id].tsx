import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { longDate, nowIso, today } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { goalProgress } from '@/lib/plain';
import { DatePicker } from '@/components/pickers';
import { Button, Card, Field, ProgressBar, Row, Screen, Text } from '@/components/ui';

export default function GoalEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const goals = useAppStore((s) => s.goals);
  const currency = useAppStore((s) => s.settings?.currency ?? 'USD');
  const save = useAppStore((s) => s.saveGoal);
  const remove = useAppStore((s) => s.removeGoal);
  const contribute = useAppStore((s) => s.contributeToGoal);
  const existing = goals.find((g) => g.id === id);
  const isNew = !existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [target, setTarget] = useState(existing ? String(existing.targetAmount) : '');
  const [current, setCurrent] = useState(existing ? String(existing.currentAmount) : '0');
  const [targetDate, setTargetDate] = useState<string | null>(existing?.targetDate ?? null);
  const [showDate, setShowDate] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [logTransfer, setLogTransfer] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    const t = parseMoneyInput(target);
    const c = parseMoneyInput(current) ?? 0;
    if (!name.trim()) { setError('Give the goal a name.'); return; }
    if (t == null || t <= 0) { setError('Enter a target amount.'); return; }
    await save({ id: existing?.id ?? newId(), name: name.trim(), targetAmount: t, currentAmount: c, targetDate, createdAt: existing?.createdAt ?? nowIso(), completed: existing?.completed ? c >= t : c >= t });
    router.back();
  };

  const onAdd = async () => {
    const a = parseMoneyInput(addAmount);
    if (!existing || a == null || a <= 0) return;
    await contribute(existing.id, a, { logTransfer, occurredAt: today() });
    setAddAmount('');
    setCurrent(String(existing.currentAmount + a));
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert(`Remove ${existing.name}?`, 'Entries you logged as transfers stay in your history.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await remove(existing.id); router.back(); } },
    ]);
  };

  const progress = existing ? goalProgress(existing, currency, today()) : null;

  return (
    <Screen keyboard>
      {existing && progress ? (
        <Card style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          <Text variant="body">{progress.sentence}</Text>
          <View style={{ marginTop: spacing.md }}><ProgressBar fraction={progress.fraction} /></View>
          {!existing.completed ? (
            <>
              <Row style={{ marginTop: spacing.lg }} align="flex-end">
                <Field label="Add money" value={addAmount} onChangeText={setAddAmount} keyboardType="decimal-pad" placeholder="50" style={{ flex: 1, marginBottom: 0 }} />
                <Button title="Add" onPress={onAdd} disabled={!parseMoneyInput(addAmount)} />
              </Row>
              <Row style={{ marginTop: spacing.sm }}>
                <Button tone="ghost" small title={logTransfer ? '✓ Also log as Savings / Transfer' : 'Also log as Savings / Transfer'} onPress={() => setLogTransfer(!logTransfer)} />
              </Row>
            </>
          ) : null}
        </Card>
      ) : null}

      <Field label="Name" value={name} onChangeText={setName} placeholder="Trip, emergency fund, new laptop…" autoFocus={isNew} />
      <Field label="Target amount" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="500" />
      {existing ? <Field label="Saved so far" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" /> : null}
      <Text variant="label" style={{ marginBottom: 6 }}>Target date</Text>
      <Row style={{ marginBottom: spacing.lg }}>
        <Button tone="secondary" small title={targetDate ? longDate(targetDate) : 'No date'} onPress={() => setShowDate(true)} />
        {targetDate ? <Button tone="ghost" small title="Clear" onPress={() => setTargetDate(null)} /> : null}
      </Row>
      {error ? <Text variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button title={isNew ? 'Set goal' : 'Save'} onPress={onSave} />
      {existing ? (
        <Row style={{ marginTop: spacing.md }}>
          <Button tone="secondary" title={existing.completed ? 'Mark active' : 'Mark done'} style={{ flex: 1 }} onPress={async () => { await save({ ...existing, completed: !existing.completed }); router.back(); }} />
          <Button tone="danger" title="Remove" style={{ flex: 1 }} onPress={onDelete} />
        </Row>
      ) : null}
      {existing ? <Text variant="small" style={{ marginTop: spacing.lg }}>Target: {formatMoney(existing.targetAmount, currency)}. Created {existing.createdAt.slice(0, 10)}.</Text> : null}
      <DatePicker visible={showDate} onClose={() => setShowDate(false)} value={targetDate ?? today()} onPick={setTargetDate} future />
    </Screen>
  );
}
