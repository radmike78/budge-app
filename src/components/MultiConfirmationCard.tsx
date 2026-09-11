import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { radius, spacing, useTheme } from '@/theme';
import { friendlyDate, nowIso, today } from '@/lib/dates';
import { parseMoneyInput } from '@/lib/money';
import { newId } from '@/lib/ids';
import { categoryName, hintText, useDateFormat, useLocale, useMoney, useT } from '@/i18n';
import { HINT, type ParseResult } from '@/parser';
import type { TxType } from '@/types';
import { CategoryPicker, DatePicker, Sheet } from './pickers';
import { Button, Field, Row, Segmented, Text } from './ui';

interface Draft {
  key: string;
  kind: 'transaction' | 'goal' | 'contribution';
  raw: string;
  amountText: string;
  type: TxType;
  categoryId: string | null;
  originalCategoryId: string | null;
  note: string;
  date: string;
  goalName: string;
  goalId: string | null;
  hints: string[];
}

function toDraft(r: ParseResult, i: number): Draft {
  return {
    key: `${i}-${r.raw}`,
    kind: r.kind === 'unknown' ? 'transaction' : r.kind,
    raw: r.raw,
    amountText: r.amount != null ? String(r.amount) : '',
    type: r.type,
    categoryId: r.categoryId,
    originalCategoryId: r.categoryId,
    note: r.note ?? '',
    date: r.occurredAt,
    goalName: r.goalName ?? '',
    goalId: r.goalId,
    hints: r.hints,
  };
}

/**
 * One sentence (or several) can carry several expenses. This card lists each
 * one as its own editable row so the user can fix a category or amount, drop
 * a row, and save the rest together. Nothing is saved until "Save all".
 */
export function MultiConfirmationCard({ results, onDone, onCancel }: { results: ParseResult[] | null; onDone: (message: string) => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const fmt = useDateFormat();
  const categories = useAppStore((s) => s.categories);
  const goals = useAppStore((s) => s.goals);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const saveGoal = useAppStore((s) => s.saveGoal);
  const contributeToGoal = useAppStore((s) => s.contributeToGoal);
  const learnCategory = useAppStore((s) => s.learnCategory);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pickingCat, setPickingCat] = useState<number | null>(null);
  const [pickingDate, setPickingDate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!results) return;
    setDrafts(results.map(toDraft));
    setError(null);
  }, [results]);

  const decimalComma = locale.format.decimal === ',';
  const rawText = useMemo(() => {
    if (!results || results.length === 0) return '';
    const first = results[0].raw;
    const same = results.every((r) => r.raw === first);
    return same ? first : results.map((r) => r.raw).join(' · ');
  }, [results]);

  const update = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => {
    const next = drafts.filter((_, j) => j !== i);
    if (next.length === 0) { onCancel(); return; }
    setDrafts(next);
  };
  const changeType = (i: number, next: TxType) => {
    const row = drafts[i];
    const cat = categories.find((c) => c.id === row.categoryId);
    let categoryId = row.categoryId;
    if (cat && cat.kind !== next) {
      const fallback = categories.find((c) => !c.archived && c.kind === next && c.id === (next === 'income' ? 'other_income' : 'other_expense'));
      categoryId = fallback?.id ?? categories.find((c) => !c.archived && c.kind === next)?.id ?? null;
    }
    update(i, { type: next, categoryId });
  };

  const saveAll = async () => {
    const amounts = drafts.map((d) => parseMoneyInput(d.amountText, decimalComma));
    if (amounts.some((a) => a == null || a <= 0)) { setError(t.enterAmount); return; }
    if (drafts.some((d) => d.kind === 'goal' && !d.goalName.trim())) { setError(t.giveGoalName); return; }
    setSaving(true);
    try {
      let out = 0;
      let inc = 0;
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        const amount = amounts[i] as number;
        if (d.kind === 'goal') {
          await saveGoal({ id: newId(), name: d.goalName.trim(), targetAmount: amount, currentAmount: 0, targetDate: null, createdAt: nowIso(), completed: false });
          continue;
        }
        if (d.kind === 'contribution' && d.goalId) {
          await contributeToGoal(d.goalId, amount, { logTransfer: true, occurredAt: d.date, rawInput: d.raw });
          out += amount;
          continue;
        }
        await addTransaction({ amount, type: d.type, categoryId: d.categoryId, note: d.note.trim() || null, rawInput: d.raw, occurredAt: d.date });
        if (d.categoryId && d.categoryId !== d.originalCategoryId && d.raw) await learnCategory(d.raw, d.categoryId);
        if (d.type === 'income') inc += amount; else out += amount;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone(t.toastLoggedMany(drafts.length, out > 0 ? money(out, { compact: true }) : null, inc > 0 ? money(inc, { compact: true }) : null));
    } finally {
      setSaving(false);
    }
  };

  if (!results) return null;
  const catRow = pickingCat != null ? drafts[pickingCat] : null;
  const dateRow = pickingDate != null ? drafts[pickingDate] : null;

  return (
    <Sheet visible={!!results} onClose={onCancel} tall>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="heading">{t.multiTitle(drafts.length)}</Text>
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={t.cancel}><Text variant="muted">{t.cancel}</Text></Pressable>
      </Row>
      <Text variant="small" numberOfLines={2}>"{rawText}"</Text>
      <Text variant="muted" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>{t.multiIntro}</Text>

      <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
        {drafts.map((d, i) => {
          const category = categories.find((c) => c.id === d.categoryId) ?? null;
          const goal = d.goalId ? goals.find((g) => g.id === d.goalId) : null;
          const catLabel = category ? `${category.icon ?? ''} ${categoryName(category, t)}`.trim() : t.pickCategory;
          const unsure = d.hints.includes(HINT.unsureCategory);
          const title = d.kind === 'goal' ? t.newGoal : d.kind === 'contribution' ? t.addTo(goal?.name ?? '') : d.note || (d.type === 'income' ? t.moneyIn : t.moneyOut);
          return (
            <View key={d.key} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <Text variant="body" style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{title}</Text>
                <Pressable onPress={() => remove(i)} accessibilityRole="button" accessibilityLabel={t.remove} hitSlop={8}>
                  <Text variant="muted">{t.remove}</Text>
                </Pressable>
              </Row>
              <Field
                label={d.kind === 'goal' ? t.targetAmount : t.amount}
                value={d.amountText}
                onChangeText={(v) => update(i, { amountText: v })}
                keyboardType="decimal-pad"
                placeholder={decimalComma ? '0,00' : '0.00'}
                inputStyle={{ fontSize: 22, fontWeight: '700' }}
                style={{ marginBottom: spacing.md }}
              />
              {d.kind === 'goal' ? (
                <Field label={t.goalName} value={d.goalName} onChangeText={(v) => update(i, { goalName: v })} placeholder={t.goalNamePlaceholder} style={{ marginBottom: spacing.sm }} />
              ) : d.kind === 'contribution' ? (
                <Row style={{ marginBottom: spacing.sm }}>
                  <Button tone="secondary" small title={friendlyDate(d.date, today(), fmt)} onPress={() => setPickingDate(i)} />
                </Row>
              ) : (
                <>
                  <View style={{ marginBottom: spacing.md }}>
                    <Segmented value={d.type} onChange={(v) => changeType(i, v)} options={[{ value: 'expense', label: t.moneyOut }, { value: 'income', label: t.moneyIn }]} />
                  </View>
                  <Row style={{ marginBottom: spacing.md, flexWrap: 'wrap' }}>
                    <Button tone="secondary" small title={catLabel} onPress={() => setPickingCat(i)} />
                    <Button tone="secondary" small title={friendlyDate(d.date, today(), fmt)} onPress={() => setPickingDate(i)} />
                  </Row>
                  {unsure && d.categoryId === d.originalCategoryId ? (
                    <Text variant="small" style={{ marginBottom: spacing.sm }}>{hintText(HINT.unsureCategory, t)}</Text>
                  ) : null}
                  <Field label={t.note} value={d.note} onChangeText={(v) => update(i, { note: v })} placeholder={t.optional} style={{ marginBottom: spacing.xs }} />
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {error ? <Text variant="small" color={colors.danger} style={{ marginVertical: spacing.sm }}>{error}</Text> : null}
      <Button title={t.saveAll} onPress={saveAll} loading={saving} style={{ marginTop: spacing.md }} />

      <CategoryPicker
        visible={catRow != null}
        onClose={() => setPickingCat(null)}
        onPick={(c) => { if (pickingCat != null) update(pickingCat, { categoryId: c.id }); }}
        kind={catRow?.type ?? 'expense'}
        selectedId={catRow?.categoryId ?? null}
        categories={categories}
      />
      <DatePicker
        visible={dateRow != null}
        onClose={() => setPickingDate(null)}
        value={dateRow?.date ?? today()}
        onPick={(day) => { if (pickingDate != null) update(pickingDate, { date: day }); }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, marginBottom: spacing.md },
});
