import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Transaction, TxType } from '@/types';
import { getDb } from '@/db/database';
import { queryTransactions } from '@/db/repositories';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { addDays, currentMonthKey, monthRange, shiftMonthKey, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { CategoryPicker } from '@/components/pickers';
import { TransactionRow } from '@/components/TransactionRow';
import { Chip, EmptyState, Field, Row, Text } from '@/components/ui';

type Range = 'month' | 'last_month' | '90d' | 'all';

const RANGES: { value: Range; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const categories = useAppStore((s) => s.categories);
  const recent = useAppStore((s) => s.recent); // changes whenever data changes; used to re-query
  const currency = useAppStore((s) => s.settings?.currency ?? 'USD');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TxType | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('month');
  const [showCat, setShowCat] = useState(false);
  const [rows, setRows] = useState<Transaction[]>([]);

  const bounds = useMemo(() => {
    const t = today();
    if (range === 'month') return monthRange(currentMonthKey());
    if (range === 'last_month') return monthRange(shiftMonthKey(currentMonthKey(), -1));
    if (range === '90d') return { start: addDays(t, -90), end: t };
    return { start: null, end: null };
  }, [range]);

  const load = useCallback(async () => {
    const db = await getDb();
    const list = await queryTransactions(db, { search, type, categoryId, from: bounds.start, to: bounds.end, limit: 500 });
    setRows(list);
  }, [search, type, categoryId, bounds]);

  useEffect(() => { load(); }, [load, recent]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const category = categories.find((c) => c.id === categoryId);
  const totalIn = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const header = (
    <View style={{ paddingTop: spacing.sm }}>
      <Field placeholder="Search notes, amounts…" value={search} onChangeText={setSearch} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" style={{ marginBottom: spacing.sm }} />
      <Row style={{ flexWrap: 'wrap', marginBottom: spacing.sm }}>
        {RANGES.map((r) => <Chip key={r.value} label={r.label} selected={range === r.value} onPress={() => setRange(r.value)} />)}
      </Row>
      <Row style={{ flexWrap: 'wrap', marginBottom: spacing.md }}>
        <Chip label="All" selected={type === null} onPress={() => setType(null)} />
        <Chip label="Money out" selected={type === 'expense'} onPress={() => setType('expense')} />
        <Chip label="Money in" selected={type === 'income'} onPress={() => setType('income')} />
        <Chip label={category ? `${category.icon ?? ''} ${category.name}`.trim() : 'Any category'} selected={!!categoryId} onPress={() => (categoryId ? setCategoryId(null) : setShowCat(true))} />
      </Row>
      <Text variant="small" style={{ marginBottom: spacing.md }}>
        {rows.length} {rows.length === 1 ? 'entry' : 'entries'} · in {formatMoney(totalIn, currency, { compact: true })} · out {formatMoney(totalOut, currency, { compact: true })}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <TransactionRow tx={item} onPress={() => router.push(`/entry/${item.id}`)} />}
        ListEmptyComponent={<EmptyState title="No entries match" body="Try a wider date range or clear the filters." />}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      <CategoryPicker visible={showCat} onClose={() => setShowCat(false)} onPick={(c) => setCategoryId(c.id)} kind={type ?? 'all'} selectedId={categoryId} categories={categories} />
    </View>
  );
}
