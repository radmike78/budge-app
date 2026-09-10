import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Transaction, TxType } from '@/types';
import { getDb } from '@/db/database';
import { getTransaction } from '@/db/repositories';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { friendlyDate, today } from '@/lib/dates';
import { parseMoneyInput } from '@/lib/money';
import { categoryName, useDateFormat, useLocale, useT } from '@/i18n';
import { confirmDialog } from '@/lib/dialogs';
import { CategoryPicker, DatePicker } from '@/components/pickers';
import { Button, Field, Row, Screen, Segmented, Text } from '@/components/ui';

export default function EditEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const fmt = useDateFormat();
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
      const found = await getTransaction(db, id);
      if (!found) { router.back(); return; }
      setTx(found); setAmount(String(found.amount)); setType(found.type); setCategoryId(found.categoryId); setNote(found.note ?? ''); setDate(found.occurredAt);
    })();
  }, [id, router]);

  if (!tx) return <Screen><View /></Screen>;
  const category = categories.find((c) => c.id === categoryId);

  const changeType = (next: TxType) => {
    setType(next);
    if (category && category.kind !== next) setCategoryId(categories.find((c) => !c.archived && c.kind === next)?.id ?? null);
  };

  const save = async () => {
    const a = parseMoneyInput(amount, locale.format.decimal === ',');
    if (a == null || a <= 0) { setError(t.enterAmount); return; }
    await update({ ...tx, amount: a, type, categoryId, note: note.trim() || null, occurredAt: date });
    if (categoryId && categoryId !== tx.categoryId && tx.rawInput) await learn(tx.rawInput, categoryId);
    router.back();
  };

  const confirmDelete = async () => {
    if (await confirmDialog(t.removeEntryQ, undefined, { confirmText: t.remove, cancelText: t.keep, destructive: true })) { await remove(tx.id); router.back(); }
  };

  return (
    <Screen keyboard>
      {tx.rawInput ? <Text variant="small" style={{ marginBottom: spacing.md }}>{t.originally(tx.rawInput)}</Text> : null}
      {tx.isRecurringInstance ? <Text variant="small" style={{ marginBottom: spacing.md }}>{t.recurringInstanceNote}</Text> : null}
      <Field label={t.amount} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputStyle={{ fontSize: 28, fontWeight: '700' }} />
      <View style={{ marginBottom: spacing.lg }}>
        <Segmented value={type} onChange={changeType} options={[{ value: 'expense', label: t.moneyOut }, { value: 'income', label: t.moneyIn }]} />
      </View>
      <Text variant="label" style={{ marginBottom: 6 }}>{t.categoryDate}</Text>
      <Row style={{ marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        <Button tone="secondary" small title={category ? `${category.icon ?? ''} ${categoryName(category, t)}`.trim() : t.pickCategory} onPress={() => setShowCat(true)} />
        <Button tone="secondary" small title={friendlyDate(date, today(), fmt)} onPress={() => setShowDate(true)} />
      </Row>
      <Field label={t.note} value={note} onChangeText={setNote} placeholder={t.optional} />
      {error ? <Text variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button title={t.saveChanges} onPress={save} />
      <View style={{ marginTop: spacing.md }}><Button tone="danger" title={t.removeEntry} onPress={confirmDelete} /></View>
      <CategoryPicker visible={showCat} onClose={() => setShowCat(false)} onPick={(c) => setCategoryId(c.id)} kind={type} selectedId={categoryId} categories={categories} />
      <DatePicker visible={showDate} onClose={() => setShowDate(false)} value={date} onPick={setDate} />
    </Screen>
  );
}
