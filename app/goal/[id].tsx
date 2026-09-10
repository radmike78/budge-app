import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { longDate, nowIso, today } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { parseMoneyInput } from '@/lib/money';
import { goalProgress } from '@/lib/plain';
import { useDateFormat, useLocale, useMoney, useT } from '@/i18n';
import { confirmDialog } from '@/lib/dialogs';
import { DatePicker } from '@/components/pickers';
import { Button, Card, Field, ProgressBar, Row, Screen, Text } from '@/components/ui';

export default function GoalEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const fmt = useDateFormat();
  const goals = useAppStore((s) => s.goals);
  const currency = useAppStore((s) => s.settings?.currency ?? 'USD');
  const save = useAppStore((s) => s.saveGoal);
  const remove = useAppStore((s) => s.removeGoal);
  const contribute = useAppStore((s) => s.contributeToGoal);
  const existing = goals.find((g) => g.id === id);
  const isNew = !existing;
  const decimalComma = locale.format.decimal === ',';

  const [name, setName] = useState(existing?.name ?? '');
  const [target, setTarget] = useState(existing ? String(existing.targetAmount) : '');
  const [current, setCurrent] = useState(existing ? String(existing.currentAmount) : '0');
  const [targetDate, setTargetDate] = useState<string | null>(existing?.targetDate ?? null);
  const [showDate, setShowDate] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [logTransfer, setLogTransfer] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    const targetValue = parseMoneyInput(target, decimalComma);
    const currentValue = parseMoneyInput(current, decimalComma) ?? 0;
    if (!name.trim()) { setError(t.giveGoalName); return; }
    if (targetValue == null || targetValue <= 0) { setError(t.enterTarget); return; }
    await save({ id: existing?.id ?? newId(), name: name.trim(), targetAmount: targetValue, currentAmount: currentValue, targetDate, createdAt: existing?.createdAt ?? nowIso(), completed: currentValue >= targetValue });
    router.back();
  };

  const onAdd = async () => {
    const a = parseMoneyInput(addAmount, decimalComma);
    if (!existing || a == null || a <= 0) return;
    await contribute(existing.id, a, { logTransfer, occurredAt: today() });
    setAddAmount('');
    setCurrent(String(existing.currentAmount + a));
  };

  const onDelete = async () => {
    if (!existing) return;
    if (await confirmDialog(t.removeGoalQ(existing.name), t.removeGoalBody, { confirmText: t.remove, cancelText: t.keep, destructive: true })) { await remove(existing.id); router.back(); }
  };

  const progress = existing ? goalProgress(existing, currency, today(), locale) : null;

  return (
    <Screen keyboard>
      {existing && progress ? (
        <Card style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          <Text variant="body">{progress.sentence}</Text>
          <View style={{ marginTop: spacing.md }}><ProgressBar fraction={progress.fraction} /></View>
          {!existing.completed ? (
            <>
              <Row style={{ marginTop: spacing.lg }} align="flex-end">
                <Field label={t.addMoney} value={addAmount} onChangeText={setAddAmount} keyboardType="decimal-pad" placeholder="50" style={{ flex: 1, marginBottom: 0 }} />
                <Button title={t.add} onPress={onAdd} disabled={!parseMoneyInput(addAmount, decimalComma)} />
              </Row>
              <Row style={{ marginTop: spacing.sm }}>
                <Button tone="ghost" small title={`${logTransfer ? '✓ ' : ''}${t.alsoLogTransferShort}`} onPress={() => setLogTransfer(!logTransfer)} />
              </Row>
            </>
          ) : null}
        </Card>
      ) : null}

      <Field label={t.nameLabel} value={name} onChangeText={setName} placeholder={t.goalNamePlaceholder} autoFocus={isNew} />
      <Field label={t.targetAmount} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="500" />
      {existing ? <Field label={t.savedSoFar} value={current} onChangeText={setCurrent} keyboardType="decimal-pad" /> : null}
      <Text variant="label" style={{ marginBottom: 6 }}>{t.targetDate}</Text>
      <Row style={{ marginBottom: spacing.lg }}>
        <Button tone="secondary" small title={targetDate ? longDate(targetDate, today(), fmt) : t.noDate} onPress={() => setShowDate(true)} />
        {targetDate ? <Button tone="ghost" small title={t.clear} onPress={() => setTargetDate(null)} /> : null}
      </Row>
      {error ? <Text variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button title={isNew ? t.setGoal : t.save} onPress={onSave} />
      {existing ? (
        <Row style={{ marginTop: spacing.md }}>
          <Button tone="secondary" title={existing.completed ? t.markActive : t.markDone} style={{ flex: 1 }} onPress={async () => { await save({ ...existing, completed: !existing.completed }); router.back(); }} />
          <Button tone="danger" title={t.remove} style={{ flex: 1 }} onPress={onDelete} />
        </Row>
      ) : null}
      {existing ? <Text variant="small" style={{ marginTop: spacing.lg }}>{t.goalMeta(money(existing.targetAmount), existing.createdAt.slice(0, 10))}</Text> : null}
      <DatePicker visible={showDate} onClose={() => setShowDate(false)} value={targetDate ?? today()} onPick={setTargetDate} future />
    </Screen>
  );
}
