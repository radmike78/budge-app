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
import { categoryName, useLocale, useT } from '@/i18n';
import { EmojiPicker } from '@/components/pickers';
import { Button, Field, Row, Screen, Segmented, Text } from '@/components/ui';

export default function CategoryEditor() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const categories = useAppStore((s) => s.categories);
  const save = useAppStore((s) => s.saveCategory);
  const remove = useAppStore((s) => s.removeCategory);
  const isNew = id === 'new';
  const existing = categories.find((c) => c.id === id);

  const [name, setName] = useState(existing ? categoryName(existing, t) : '');
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
    if (!name.trim()) { setError(t.giveName); return; }
    const limitValue = limit.trim() ? parseMoneyInput(limit, locale.format.decimal === ',') : null;
    // A default category keeps its translated name unless the user actually changed it.
    const renamed = existing?.isDefault && name.trim() === categoryName(existing, t) ? existing.name : name.trim();
    await save({
      id: existing?.id ?? newId(),
      name: renamed,
      icon,
      kind,
      monthlyLimit: kind === 'expense' && limitValue && limitValue > 0 ? limitValue : null,
      isDefault: existing?.isDefault && renamed === existing.name ? true : false,
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
    Alert.alert(t.deleteCategoryQ(categoryName(existing, t)), usage ? t.deleteCategoryUsed(usage) : t.cannotUndo, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: async () => { await remove(existing.id); router.back(); } },
    ]);
  };

  return (
    <Screen keyboard>
      <Row style={{ marginTop: spacing.sm, marginBottom: spacing.lg }} align="flex-end">
        <Button tone="secondary" title={icon || '🧾'} onPress={() => setShowEmoji(true)} accessibilityLabel={t.pickIcon} />
        <Field label={t.nameLabel} value={name} onChangeText={setName} placeholder={t.categoryNamePlaceholder} style={{ flex: 1, marginBottom: 0 }} autoFocus={isNew} />
      </Row>
      {!existing ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'expense', label: t.spendingKind }, { value: 'income', label: t.incomeKind }]} />
        </View>
      ) : null}
      {kind === 'expense' ? (
        <Field label={t.monthlyLimit} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder={t.limitPlaceholder} hint={t.limitHint} />
      ) : null}
      {usage != null ? <Text variant="small" style={{ marginBottom: spacing.md }}>{t.entryUses(usage)}</Text> : null}
      {error ? <Text variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</Text> : null}
      <Button title={isNew ? t.addCategory : t.save} onPress={onSave} />
      {existing ? (
        <Row style={{ marginTop: spacing.md }}>
          <Button tone="secondary" title={existing.archived ? t.restore : t.archive} onPress={toggleArchive} style={{ flex: 1 }} />
          <Button tone="danger" title={t.delete} onPress={onDelete} style={{ flex: 1 }} />
        </Row>
      ) : null}
      <EmojiPicker visible={showEmoji} onClose={() => setShowEmoji(false)} onPick={setIcon} />
    </Screen>
  );
}
