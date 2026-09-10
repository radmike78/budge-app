import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Frequency, TxType } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { friendlyDate, today } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { parseMoneyInput } from '@/lib/money';
import { categoryName, useDateFormat, useLocale, useT } from '@/i18n';
import { CategoryPicker, DatePicker } from '@/components/pickers';
import { Button, Chip, Field, Row, Screen, Segmented, Text } from '@/components/ui';

const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'yearly'];

export default function RecurringEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const fmt = useDateFormat();
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

  const changeType = (nextType: TxType) => {
    setType(nextType);
    if (category && category.kind !== nextType) setCategoryId(categories.find((c) => !c.archived && c.kind === nextType)?.id ?? null);
  };

  const onSave = async () => {
    const a = parseMoneyInput(amount, locale.format.decimal === ',');
    if (a == null || a <= 0) { setError(t.enterAmount); return; }
    await save({ id: existing?.id ?? newId(), amount: a, type, categoryId, frequency, nextOccurrence: next, note: note.trim() || null, active: existing?.active ?? true });
    router.back();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert(t.removeRecurringQ, t.removeRecurringBody, [
      { text: t.keep, style: 'cancel' },
      { text: t.remove, style: 'destructive', onPress: async () => { await remove(existing.id); router.back(); } },
    ]);
  };

  return (
    <Screen keyboard>
      <Field label={t.amount} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputStyle={{ fontSize: 28, fontWeight: '700' }} autoFocus={isNew} style={{ marginTop: spacing.sm }} />
      <View style={{ marginBottom: spacing.lg }}>
        <Segmented value={type} onChange={changeType} options={[{ value: 'expense', label: t.moneyOut }, { value: 'income', label: t.moneyIn }]} />
      </View>
      <Text variant="label" style={{ marginBottom: 6 }}>{t.howOften}</Text>
      <Row style={{ flexWrap: 'wrap', marginBottom: spacing.lg }}>
        {FREQUENCIES.map((f) => <Chip key={f} label={t.frequency[f]} selected={frequency === f} onPress={() => setFrequency(f)} />)}
      </Row>
      <Text variant="label" style={{ marginBottom: 6 }}>{t.category} · {isNew ? t.firstDate : t.nextDateLabel}</Text>
      <Row style={{ marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        <Button tone="secondary" small title={category ? `${category.icon ?? ''} ${categoryName(category, t)}`.trim() : t.pickCategory} onPress={() => setShowCat(true)} />
        <Button tone="secondary" small title={friendlyDate(next, today(), fmt)} onPress={() => setShowDate(true)} />
      </Row>
      <Text variant="small" style={{ marginBottom: spacing.lg }}>{t.firstDateHint}</Text>
      <Field label={t.note} value={note} onChangeText={setNote} placeholder={t.recurringNotePlaceholder} />
      {error ? <Text variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button title={isNew ? t.startRepeating : t.save} onPress={onSave} />
      {existing ? (
        <Row style={{ marginTop: spacing.md }}>
          <Button tone="secondary" title={existing.active ? t.pause : t.resume} style={{ flex: 1 }} onPress={async () => { await save({ ...existing, active: !existing.active }); router.back(); }} />
          <Button tone="danger" title={t.remove} style={{ flex: 1 }} onPress={onDelete} />
        </Row>
      ) : null}
      <CategoryPicker visible={showCat} onClose={() => setShowCat(false)} onPick={(c) => setCategoryId(c.id)} kind={type} selectedId={categoryId} categories={categories} />
      <DatePicker visible={showDate} onClose={() => setShowDate(false)} value={next} onPick={setNext} future={isNew} />
    </Screen>
  );
}
