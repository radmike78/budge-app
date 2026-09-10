import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { TxType } from '@/types';
import { getDb } from '@/db/database';
import { countTransactionsInCategory } from '@/db/repositories';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { newId } from '@/lib/ids';
import { parseMoneyInput } from '@/lib/money';
import { EmojiPicker } from '@/components/pickers';
import { Button, Field, Row, Screen, Segmented, Text } from '@/components/ui';

export default function CategoryEditor() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const categories = useAppStore((s) => s.categories);
  const save = useAppStore((s) => s.saveCategory);
  const remove = useAppStore((s) => s.removeCategory);
  const isNew = id === 'new';
  const existing = categories.find((c) => c.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '🧾');
  const [kind, setKind] = useState<TxType>(existing?.kind ?? (kindParam === 'income' ? 'income' : 'expense'));
  const [limit, setLimit] = useState(existing?.monthlyLimit != null ? String(existing.monthlyLimit) : '');
  const [showEmoji, setShowEmoji] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    getDb().then((db) => countTransactionsInCategory(db, existing.id)).then(setUsage);
  }, [existing]);

  const onSave = async () => {
    if (!name.trim()) { setError('Give it a name.'); return; }
    const limitValue = limit.trim() ? parseMoneyInput(limit) : null;
    await save({
      id: existing?.id ?? newId(),
      name: name.trim(),
      icon,
      kind,
      monthlyLimit: kind === 'expense' && limitValue && limitValue > 0 ? limitValue : null,
      isDefault: existing?.isDefault ?? false,
      archived: existing?.archived ?? false,
      sortOrder: existing?.sortOrder ?? 50,
    });
    router.back();
  };

  const toggleArchive = async () => {
    if (!existing) return;
    await save({ ...existing, archived: !existing.archived });
    router.back();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert(
      usage ? `Delete ${existing.name}?` : `Delete ${existing.name}?`,
      usage ? `${usage} ${usage === 1 ? 'entry' : 'entries'} will keep their amounts but lose this category. Archiving keeps everything intact.` : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await remove(existing.id); router.back(); } },
      ],
    );
  };

  return (
    <Screen keyboard>
      <Row style={{ marginTop: spacing.sm, marginBottom: spacing.lg }} align="flex-end">
        <Button tone="secondary" title={icon || '🧾'} onPress={() => setShowEmoji(true)} accessibilityLabel="Pick icon" />
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Pets" style={{ flex: 1, marginBottom: 0 }} autoFocus={isNew} />
      </Row>
      {!existing ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Spending' }, { value: 'income', label: 'Income' }]} />
        </View>
      ) : null}
      {kind === 'expense' ? (
        <Field label="Monthly limit (optional)" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="Leave blank for none" hint="A limit only adds a quiet progress bar. Nothing turns red." />
      ) : null}
      {usage != null ? <Text variant="small" style={{ marginBottom: spacing.md }}>{usage} {usage === 1 ? 'entry uses' : 'entries use'} this category.</Text> : null}
      {error ? <Text variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button title={isNew ? 'Add category' : 'Save'} onPress={onSave} />
      {existing ? (
        <Row style={{ marginTop: spacing.md }}>
          <Button tone="secondary" title={existing.archived ? 'Restore' : 'Archive'} onPress={toggleArchive} style={{ flex: 1 }} />
          <Button tone="danger" title="Delete" onPress={onDelete} style={{ flex: 1 }} />
        </Row>
      ) : null}
      <EmojiPicker visible={showEmoji} onClose={() => setShowEmoji(false)} onPick={setIcon} />
    </Screen>
  );
}
