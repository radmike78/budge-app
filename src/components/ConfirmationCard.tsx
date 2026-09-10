import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { radius, spacing, useTheme } from '@/theme';
import { friendlyDate, longDate, nowIso, today } from '@/lib/dates';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { newId } from '@/lib/ids';
import type { ParseResult } from '@/parser';
import type { TxType } from '@/types';
import { CategoryPicker, DatePicker, Sheet } from './pickers';
import { Button, Field, Row, Segmented, Text } from './ui';

/**
 * Shows what was understood and lets the user fix any field with one tap
 * before saving. Handles transactions, new goals, and goal contributions.
 */
export function ConfirmationCard({ result, onDone, onCancel }: { result: ParseResult | null; onDone: (message: string) => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const settings = useAppStore((s) => s.settings);
  const categories = useAppStore((s) => s.categories);
  const goals = useAppStore((s) => s.goals);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const saveGoal = useAppStore((s) => s.saveGoal);
  const contributeToGoal = useAppStore((s) => s.contributeToGoal);
  const learnCategory = useAppStore((s) => s.learnCategory);
  const currency = settings?.currency ?? 'USD';

  const [amountText, setAmountText] = useState('');
  const [type, setType] = useState<TxType>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());
  const [goalName, setGoalName] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [logTransfer, setLogTransfer] = useState(true);
  const [showCat, setShowCat] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTargetDate, setShowTargetDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!result) return;
    setAmountText(result.amount != null ? String(result.amount) : '');
    setType(result.type);
    setCategoryId(result.categoryId);
    setNote(result.note ?? '');
    setDate(result.occurredAt);
    setGoalName(result.goalName ?? '');
    setTargetDate(result.targetDate);
    setLogTransfer(true);
    setError(null);
  }, [result]);

  const category = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);
  const amount = parseMoneyInput(amountText);
  const goal = result?.goalId ? goals.find((g) => g.id === result.goalId) : null;

  // Keep category consistent with type when the user flips income/expense.
  const changeType = (t: TxType) => {
    setType(t);
    if (category && category.kind !== t) {
      const fallback = categories.find((c) => !c.archived && c.kind === t && (c.id === (t === 'income' ? 'other_income' : 'other_expense')));
      setCategoryId(fallback?.id ?? categories.find((c) => !c.archived && c.kind === t)?.id ?? null);
    }
  };

  const save = async () => {
    if (!result) return;
    if (amount == null || amount <= 0) {
      setError('Enter an amount to save this.');
      return;
    }
    setSaving(true);
    try {
      if (result.kind === 'goal') {
        if (!goalName.trim()) {
          setError('Give the goal a name.');
          return;
        }
        await saveGoal({ id: newId(), name: goalName.trim(), targetAmount: amount, currentAmount: 0, targetDate, createdAt: nowIso(), completed: false });
        onDone(`Goal set: ${formatMoney(amount, currency, { compact: true })} for ${goalName.trim()}${targetDate ? ` by ${longDate(targetDate)}` : ''}.`);
      } else if (result.kind === 'contribution' && goal) {
        await contributeToGoal(goal.id, amount, { logTransfer, occurredAt: date, rawInput: result.raw });
        onDone(`Added ${formatMoney(amount, currency, { compact: true })} to ${goal.name}.`);
      } else {
        await addTransaction({ amount, type, categoryId, note: note.trim() || null, rawInput: result.raw, occurredAt: date });
        if (categoryId && categoryId !== result.categoryId && result.raw) await learnCategory(result.raw, categoryId);
        const catName = category?.name ?? 'Uncategorized';
        onDone(`Logged ${formatMoney(amount, currency, { compact: true })} ${type === 'income' ? 'in' : 'out'} · ${catName}.`);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  if (!result) return null;
  const title = result.kind === 'goal' ? 'New goal' : result.kind === 'contribution' ? `Add to ${goal?.name ?? 'goal'}` : type === 'income' ? 'Money in' : 'Money out';

  return (
    <Sheet visible={!!result} onClose={onCancel} tall>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="heading">{title}</Text>
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel"><Text variant="muted">Cancel</Text></Pressable>
      </Row>
      <Text variant="small" style={{ marginBottom: spacing.md }} numberOfLines={2}>"{result.raw}"</Text>

      {result.hints.length > 0 ? (
        <View style={[styles.hint, { backgroundColor: colors.accentSoft }]}>
          {result.hints.map((h) => <Text key={h} variant="small" color={colors.text}>{h}</Text>)}
        </View>
      ) : null}

      <Field
        label={result.kind === 'goal' ? 'Target amount' : 'Amount'}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="0.00"
        autoFocus={amount == null}
        inputStyle={{ fontSize: 28, fontWeight: '700' }}
      />

      {result.kind === 'goal' ? (
        <>
          <Field label="Goal name" value={goalName} onChangeText={setGoalName} placeholder="Trip, emergency fund, new laptop…" />
          <Text variant="label" style={{ marginBottom: 6 }}>Target date</Text>
          <Row style={{ marginBottom: spacing.lg }}>
            <Button tone="secondary" small title={targetDate ? longDate(targetDate) : 'No date'} onPress={() => setShowTargetDate(true)} />
            {targetDate ? <Button tone="ghost" small title="Clear" onPress={() => setTargetDate(null)} /> : null}
          </Row>
          <DatePicker visible={showTargetDate} onClose={() => setShowTargetDate(false)} value={targetDate ?? today()} onPick={setTargetDate} future />
        </>
      ) : result.kind === 'contribution' && goal ? (
        <>
          <Text variant="muted" style={{ marginBottom: spacing.md }}>
            {goal.name}: {formatMoney(goal.currentAmount, currency, { compact: true })} of {formatMoney(goal.targetAmount, currency, { compact: true })} so far.
          </Text>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.lg }}>
            <Text variant="body" style={{ flex: 1 }}>Also log it as a Savings / Transfer entry</Text>
            <Switch value={logTransfer} onValueChange={setLogTransfer} trackColor={{ true: colors.accent }} />
          </Row>
          <Row style={{ marginBottom: spacing.lg }}>
            <Button tone="secondary" small title={friendlyDate(date)} onPress={() => setShowDate(true)} />
          </Row>
          <DatePicker visible={showDate} onClose={() => setShowDate(false)} value={date} onPick={setDate} />
        </>
      ) : (
        <>
          <View style={{ marginBottom: spacing.lg }}>
            <Segmented value={type} onChange={changeType} options={[{ value: 'expense', label: 'Money out' }, { value: 'income', label: 'Money in' }]} />
          </View>
          <Text variant="label" style={{ marginBottom: 6 }}>Category · Date</Text>
          <Row style={{ marginBottom: spacing.lg, flexWrap: 'wrap' }}>
            <Button tone="secondary" small title={`${category?.icon ?? ''} ${category?.name ?? 'Pick a category'}`.trim()} onPress={() => setShowCat(true)} />
            <Button tone="secondary" small title={friendlyDate(date)} onPress={() => setShowDate(true)} />
          </Row>
          <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
          <CategoryPicker visible={showCat} onClose={() => setShowCat(false)} onPick={(c) => setCategoryId(c.id)} kind={type} selectedId={categoryId} categories={categories} />
          <DatePicker visible={showDate} onClose={() => setShowDate(false)} value={date} onPick={setDate} />
        </>
      )}

      {error ? <Text variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button title={result.kind === 'goal' ? 'Set goal' : 'Save'} onPress={save} loading={saving} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: 2 },
});
