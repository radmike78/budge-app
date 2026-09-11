import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Debt, DebtType } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { nowIso } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { parseMoneyInput } from '@/lib/money';
import { confirmDialog } from '@/lib/dialogs';
import { useLocale, useMoney, useT } from '@/i18n';
import { planPayoff, recommendStrategy, type DebtInput, type Strategy } from '@/statements';
import { Sheet } from '@/components/pickers';
import { Button, Card, EmptyState, Field, Row, Screen, SectionTitle, Segmented, Text } from '@/components/ui';

const TYPES: DebtType[] = ['credit_card', 'personal_loan', 'student_loan', 'line_of_credit', 'other', 'auto_loan', 'mortgage'];
const CONSUMER = new Set<DebtType>(['credit_card', 'personal_loan', 'student_loan', 'line_of_credit', 'other']);

/** Every debt the user owes, and a plain pay-off plan for the consumer ones. */
export default function DebtsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const debts = useAppStore((s) => s.debts);
  const saveDebt = useAppStore((s) => s.saveDebt);
  const removeDebt = useAppStore((s) => s.removeDebt);
  const saveGoal = useAppStore((s) => s.saveGoal);
  const decimalComma = locale.format.decimal === ',';

  const [extraText, setExtraText] = useState('');
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [editing, setEditing] = useState<Partial<Debt> | null>(null);

  const inputs: DebtInput[] = useMemo(() => debts.filter((d) => CONSUMER.has(d.type) && d.balance > 0).map((d) => ({ id: d.id, name: d.creditor, balance: d.balance, apr: d.apr, minPayment: d.monthlyPayment })), [debts]);
  const recommendation = useMemo(() => recommendStrategy(inputs), [inputs]);
  const chosen = strategy ?? recommendation.strategy;
  const extra = parseMoneyInput(extraText, decimalComma) ?? 0;
  const plan = useMemo(() => (inputs.length ? planPayoff(inputs, extra, chosen) : null), [inputs, extra, chosen]);
  const ratesKnown = inputs.length > 0 && inputs.every((d) => d.apr != null);

  const startEdit = (d?: Debt) => setEditing(d ? { ...d } : { creditor: '', type: 'credit_card', balance: 0, monthlyPayment: null, creditLimit: null, apr: null, source: 'manual' });
  const [balanceText, setBalanceText] = useState('');
  const [minText, setMinText] = useState('');
  const [aprText, setAprText] = useState('');
  const openEditor = (d?: Debt) => {
    startEdit(d);
    setBalanceText(d ? String(d.balance) : '');
    setMinText(d?.monthlyPayment != null ? String(d.monthlyPayment) : '');
    setAprText(d?.apr != null ? String(d.apr) : '');
  };
  const commitEdit = async () => {
    if (!editing || !editing.creditor?.trim()) return;
    const balance = parseMoneyInput(balanceText, decimalComma) ?? 0;
    const apr = Number(aprText.replace(',', '.'));
    await saveDebt({
      id: editing.id ?? newId(),
      creditor: editing.creditor.trim().slice(0, 80),
      type: editing.type ?? 'other',
      balance,
      monthlyPayment: parseMoneyInput(minText, decimalComma),
      creditLimit: editing.creditLimit ?? null,
      apr: aprText.trim() && Number.isFinite(apr) && apr >= 0 && apr <= 100 ? apr : null,
      source: editing.source ?? 'manual',
      updatedAt: nowIso(),
    });
    setEditing(null);
  };
  const remove = async (d: Debt) => {
    if (await confirmDialog(t.removeDebtQ, d.creditor, { confirmText: t.remove, cancelText: t.keep, destructive: true })) await removeDebt(d.id);
  };
  const makeGoal = async (d: Debt) => {
    await saveGoal({ id: newId(), name: d.creditor, kind: 'debt', targetAmount: d.balance, currentAmount: 0, targetDate: null, createdAt: nowIso(), completed: false });
    router.push('/goals');
  };

  return (
    <Screen keyboard>
      <Text variant="muted" style={{ marginTop: spacing.sm }}>{t.debtsIntro}</Text>
      <Row style={{ marginTop: spacing.md }}>
        <Button title={t.addDebt} onPress={() => openEditor()} />
        <Button tone="secondary" title={t.importStatement} onPress={() => router.push('/import')} />
      </Row>

      {debts.length === 0 ? (
        <EmptyState title={t.noDebts} body={t.noDebtsBody} />
      ) : (
        debts.map((d) => (
          <Card key={d.id} style={{ marginTop: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="heading" style={{ flex: 1 }}>{d.creditor}</Text>
              <Text variant="money">{money(d.balance, { compact: true })}</Text>
            </Row>
            <Text variant="small" style={{ marginTop: 2 }}>
              {t.debtTypes[d.type]}{d.monthlyPayment != null ? ` · ${t.debtMinPayment}: ${money(d.monthlyPayment, { compact: true })}` : ''}{d.apr != null ? ` · ${d.apr}%` : ''}{!CONSUMER.has(d.type) ? ` · ${t.excludedFromPlan}` : ''}
            </Text>
            <Row style={{ marginTop: spacing.sm }}>
              <Button tone="ghost" small title={t.edit} onPress={() => openEditor(d)} />
              <Button tone="ghost" small title={t.makeGoal} onPress={() => makeGoal(d)} />
              <Button tone="ghost" small title={t.remove} onPress={() => remove(d)} />
            </Row>
          </Card>
        ))
      )}

      <SectionTitle>{t.planTitle}</SectionTitle>
      {inputs.length === 0 ? (
        <Text variant="muted">{t.planNothing}</Text>
      ) : (
        <Card>
          <Field label={t.planExtra} value={extraText} onChangeText={setExtraText} keyboardType="decimal-pad" placeholder="200" />
          <Text variant="label" style={{ marginBottom: 6 }}>{t.planOrder}</Text>
          <Segmented<Strategy> value={chosen} onChange={setStrategy} options={[{ value: 'avalanche', label: t.strategyAvalanche }, { value: 'snowball', label: t.strategySnowball }]} />
          <Text variant="small" style={{ marginTop: spacing.sm }}>{t.planRecommend(recommendation.strategy, recommendation.reason)}</Text>
          {plan ? (
            <View style={{ marginTop: spacing.lg }}>
              {plan.truncated ? <Text variant="body">{t.planTruncated}</Text> : (
                <>
                  <Text variant="body">{ratesKnown ? t.planSummary(plan.totalMonths, money(plan.totalInterest, { compact: true }), money(plan.monthlyTotal, { compact: true })) : t.planSummaryNoRates(plan.totalMonths, money(plan.monthlyTotal, { compact: true }))}</Text>
                  {extra > 0 && plan.rows[0] ? <Text variant="body" style={{ marginTop: spacing.sm, fontWeight: '600' }}>{t.planFocus(plan.rows[0].name, money(extra, { compact: true }))}</Text> : null}
                  {plan.rows.map((r) => <Text key={r.id} variant="muted" style={{ marginTop: spacing.xs }}>{t.planRow(r.order, r.name, r.monthsToPayoff)}</Text>)}
                </>
              )}
            </View>
          ) : null}
        </Card>
      )}
      <View style={{ height: spacing.xl }} />

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t.edit : t.addDebt} tall>
        <Field label={t.debtCreditor} value={editing?.creditor ?? ''} onChangeText={(v) => setEditing((e) => ({ ...e, creditor: v }))} autoFocus={!editing?.id} />
        <Text variant="label" style={{ marginBottom: 6 }}>{t.debtType}</Text>
        <Row style={{ flexWrap: 'wrap', marginBottom: spacing.lg }}>
          {TYPES.map((ty) => (
            <Button key={ty} small tone={editing?.type === ty ? 'primary' : 'secondary'} title={t.debtTypes[ty]} onPress={() => setEditing((e) => ({ ...e, type: ty }))} />
          ))}
        </Row>
        <Field label={t.debtBalance} value={balanceText} onChangeText={setBalanceText} keyboardType="decimal-pad" placeholder="0" />
        <Field label={t.debtMinPayment} value={minText} onChangeText={setMinText} keyboardType="decimal-pad" placeholder={t.optional} />
        <Field label={t.debtApr} value={aprText} onChangeText={setAprText} keyboardType="decimal-pad" placeholder={t.optional} />
        <Button title={t.save} onPress={commitEdit} disabled={!editing?.creditor?.trim()} />
        <View style={{ height: spacing.sm }} />
        <Text variant="small" color={colors.faint}>{t.debtsSub}</Text>
      </Sheet>
    </Screen>
  );
}
