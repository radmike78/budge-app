import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Transaction, TxType } from '@/types';
import { getDb } from '@/db/database';
import { getTransaction } from '@/db/repositories';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { friendlyDate } from '@/lib/dates';
import { parseMoneyInput } from '@/lib/money';
import { CategoryPicker, DatePicker } from '@/components/pickers';
import { Button, Field, Row, Screen, Segmented, Text } from '@/components/ui';

export default function EditEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const categories = useAppStore((s) => s.categories);
  const update = useAppStore((s) => s.updateTransaction);
  const remove = useAppStore((s) => s.deleteTransaction);
  const learn = useAppStore((s) => s.learnCategory);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TxType>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [showCat, setShowCat] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const t = await getTransaction(db, id);
      if (!t) { router.back(); return; }
      setTx(t); setAmount(String(t.amount)); setType(t.type); setCategoryId(t.categoryId); setNote(t.note ?? ''); setDate(t.occurredAt);
    })();
  }, [id, router]);

  if (!tx) return <Screen><View /></Screen>;
  const category = categories.find((c) => c.id === categoryId);

  const changeType = (t: TxType) => {
    setType(t);
    if (category && category.kind !== t) setCategoryId(categories.find((c) => !c.archived && c.kind === t)?.id ?? null);
  };

  const save = async () => {
    const a = parseMoneyInput(amount);
    if (a == null || a <= 0) { setError('Enter an amount.'); return; }
    await update({ ...tx, amount: a, type, categoryId, note: note.trim() || null, occurredAt: date });
    if (categoryId && categoryId !== tx.categoryId && tx.rawInput) await learn(tx.rawInput, categoryId);
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Remove this entry?', undefined, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await remove(tx.id); router.back(); } },
    ]);
  };

  return (
    <Screen keyboard>
      {tx.rawInput ? <Text variant="small" style={{ marginBottom: spacing.md }}>Originally: "{tx.rawInput}"</Text> : null}
      {tx.isRecurringInstance ? <Text variant="small" style={{ marginBottom: spacing.md }}>This entry was logged automatically by a repeating entry. Editing it here changes only this one.</Text> : null}
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputStyle={{ fontSize: 28, fontWeight: '700' }} />
      <View style={{ marginBottom: spacing.lg }}>
        <Segmented value={type} onChange={changeType} options={[{ value: 'expense', label: 'Money out' }, { value: 'income', label: 'Money in' }]} />
      </View>
      <Text variant="label" style={{ marginBottom: 6 }}>Category · Date</Text>
      <Row style={{ marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        <Button tone="secondary" small title={`${category?.icon ?? ''} ${category?.name ?? 'Pick a category'}`.trim()} onPress={() => setShowCat(true)} />
        <Button tone="secondary" small title={friendlyDate(date)} onPress={() => setShowDate(true)} />
      </Row>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
      {error ? <Text variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button title="Save changes" onPress={save} />
      <View style={{ marginTop: spacing.md }}><Button tone="danger" title="Remove entry" onPress={confirmDelete} /></View>
      <CategoryPicker visible={showCat} onClose={() => setShowCat(false)} onPick={(c) => setCategoryId(c.id)} kind={type} selectedId={categoryId} categories={categories} />
      <DatePicker visible={showDate} onClose={() => setShowDate(false)} value={date} onPick={setDate} />
    </Screen>
  );
}
