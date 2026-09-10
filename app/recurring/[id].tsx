import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Frequency, TxType } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { friendlyDate, today } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { parseMoneyInput } from '@/lib/money';
import { FREQUENCY_LABELS } from '@/lib/recurring';
import { CategoryPicker, DatePicker } from '@/components/pickers';
import { Button, Chip, Field, Row, Screen, Segmented, Text } from '@/components/ui';

const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'yearly'];

export default function RecurringEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const rules = useAppStore((s) => s.rules);
  const categories = useAppStore((s) => s.categories);
  const save = useAppStore((s) => s.saveRule);
  const remove = useAppStore((s) => s.removeRule);
  const existing = rules.find((r) => r.id === id);
  const isNew = !existing;

  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [type, setType] = useState<TxType>(existing?.type ?? 'expense');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? 'rent');
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [next, setNext] = useState(existing?.nextOccurrence ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  const [showCat, setShowCat] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const category = categories.find((c) => c.id === categoryId);

  const changeType = (t: TxType) => {
    setType(t);
    if (category && category.kind !== t) setCategoryId(categories.find((c) => !c.archived && c.kind === t)?.id ?? null);
  };

  const onSave = async () => {
    const a = parseMoneyInput(amount);
    if (a == null || a <= 0) { setError('Enter an amount.'); return; }
    await save({ id: existing?.id ?? newId(), amount: a, type, categoryId, frequency, nextOccurrence: next, note: note.trim() || null, active: existing?.active ?? true });
    router.back();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Remove this repeating entry?', 'Entries already logged stay in your history.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await remove(existing.id); router.back(); } },
    ]);
  };

  return (
    <Screen keyboard>
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputStyle={{ fontSize: 28, fontWeight: '700' }} autoFocus={isNew} style={{ marginTop: spacing.sm }} />
      <View style={{ marginBottom: spacing.lg }}>
        <Segmented value={type} onChange={changeType} options={[{ value: 'expense', label: 'Money out' }, { value: 'income', label: 'Money in' }]} />
      </View>
      <Text variant="label" style={{ marginBottom: 6 }}>How often</Text>
      <Row style={{ flexWrap: 'wrap', marginBottom: spacing.lg }}>
        {FREQUENCIES.map((f) => <Chip key={f} label={FREQUENCY_LABELS[f]} selected={frequency === f} onPress={() => setFrequency(f)} />)}
      </Row>
      <Text variant="label" style={{ marginBottom: 6 }}>Category · {isNew ? 'First date' : 'Next date'}</Text>
      <Row style={{ marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        <Button tone="secondary" small title={`${category?.icon ?? ''} ${category?.name ?? 'Pick a category'}`.trim()} onPress={() => setShowCat(true)} />
        <Button tone="secondary" small title={friendlyDate(next)} onPress={() => setShowDate(true)} />
      </Row>
      <Text variant="small" style={{ marginBottom: spacing.lg }}>If the first date is today or earlier, the entry is logged right away.</Text>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Rent, Salary, Netflix…" />
      {error ? <Text variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button title={isNew ? 'Start repeating' : 'Save'} onPress={onSave} />
      {existing ? (
        <Row style={{ marginTop: spacing.md }}>
          <Button tone="secondary" title={existing.active ? 'Pause' : 'Resume'} style={{ flex: 1 }} onPress={async () => { await save({ ...existing, active: !existing.active }); router.back(); }} />
          <Button tone="danger" title="Remove" style={{ flex: 1 }} onPress={onDelete} />
        </Row>
      ) : null}
      <CategoryPicker visible={showCat} onClose={() => setShowCat(false)} onPick={(c) => setCategoryId(c.id)} kind={type} selectedId={categoryId} categories={categories} />
      <DatePicker visible={showDate} onClose={() => setShowDate(false)} value={next} onPick={setNext} future={isNew} />
    </Screen>
  );
}
