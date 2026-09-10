import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import type { Transaction } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { radius, spacing, useTheme } from '@/theme';
import { friendlyDate, today } from '@/lib/dates';
import { categoryName, useDateFormat, useMoney, useT } from '@/i18n';
import { confirmDialog } from '@/lib/dialogs';
import { Icon, Text } from './ui';

export function TransactionRow({ tx, onPress, showDate = true }: { tx: Transaction; onPress?: () => void; showDate?: boolean }) {
  const { colors } = useTheme();
  const t = useT();
  const money = useMoney();
  const fmt = useDateFormat();
  const category = useAppStore((s) => s.categories.find((c) => c.id === tx.categoryId));
  const remove = useAppStore((s) => s.deleteTransaction);
  const ref = useRef<SwipeableMethods>(null);
  const catName = category ? categoryName(category, t) : null;

  const confirmDelete = async () => {
    ref.current?.close();
    if (await confirmDialog(t.removeEntryQ, `${money(tx.amount)} · ${tx.note ?? catName ?? ''}`, { confirmText: t.remove, cancelText: t.keep, destructive: true })) remove(tx.id);
  };

  const renderRight = () => (
    <View style={styles.actions}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t.saveChanges} onPress={() => { ref.current?.close(); onPress(); }} style={[styles.action, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="pencil" size={20} color={colors.accent} />
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t.delete} onPress={confirmDelete} style={[styles.action, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
      </Pressable>
    </View>
  );

  const title = tx.note || catName || (tx.type === 'income' ? t.moneyIn : t.moneyOut);
  const subtitleParts = [catName, showDate ? friendlyDate(tx.occurredAt, today(), fmt) : null, tx.isRecurringInstance ? t.repeats : null].filter(Boolean);

  return (
    <ReanimatedSwipeable ref={ref} renderRightActions={renderRight} overshootRight={false} friction={2} rightThreshold={40}>
      <Pressable accessibilityRole="button" onPress={onPress} onLongPress={confirmDelete} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.cardAlt : colors.card, borderColor: colors.border }]}>
        <Icon glyph={category?.icon} size={22} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text variant="body" numberOfLines={1}>{title}</Text>
          <Text variant="small" numberOfLines={1}>{subtitleParts.join(' · ')}</Text>
        </View>
        <Text variant="money" color={tx.type === 'income' ? colors.income : colors.expense}>
          {tx.type === 'income' ? '+' : '−'}{money(tx.amount)}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.sm, marginBottom: spacing.sm },
  action: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
