import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category, TxType } from '@/types';
import { radius, spacing, useTheme } from '@/theme';
import { addDays, friendlyDate, isValidDateString, today } from '@/lib/dates';
import { Button, Chip, Field, Icon, ListItem, Row, Text } from './ui';

/** Bottom sheet container used by all pickers. */
export function Sheet({ visible, onClose, title, children, tall }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; tall?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.bg, paddingBottom: insets.bottom + spacing.lg, maxHeight: tall ? '92%' : '80%' }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {title ? <Text variant="heading" style={{ marginBottom: spacing.md }}>{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
}

export function CategoryPicker({ visible, onClose, onPick, kind, selectedId, categories }: {
  visible: boolean;
  onClose: () => void;
  onPick: (c: Category) => void;
  kind: TxType | 'all';
  selectedId: string | null;
  categories: Category[];
}) {
  const list = useMemo(() => categories.filter((c) => !c.archived && (kind === 'all' || c.kind === kind)), [categories, kind]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Category" tall>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <ListItem
            title={item.name}
            left={<Icon glyph={item.icon} size={22} />}
            right={item.id === selectedId ? <Text color={undefined} variant="body">✓</Text> : null}
            onPress={() => { onPick(item); onClose(); }}
          />
        )}
      />
    </Sheet>
  );
}

export function DatePicker({ visible, onClose, value, onPick, future }: { visible: boolean; onClose: () => void; value: string; onPick: (d: string) => void; future?: boolean }) {
  const t = today();
  const [custom, setCustom] = useState(value);
  const quick = future
    ? [
        { label: 'In a month', date: addDays(t, 30) },
        { label: 'In 3 months', date: addDays(t, 90) },
        { label: 'In 6 months', date: addDays(t, 180) },
        { label: 'In a year', date: addDays(t, 365) },
      ]
    : [
        { label: 'Today', date: t },
        { label: 'Yesterday', date: addDays(t, -1) },
        { label: friendlyDate(addDays(t, -2)), date: addDays(t, -2) },
        { label: friendlyDate(addDays(t, -3)), date: addDays(t, -3) },
      ];
  const valid = isValidDateString(custom);
  return (
    <Sheet visible={visible} onClose={onClose} title="Date">
      <Row style={{ flexWrap: 'wrap' }}>
        {quick.map((q) => (
          <Chip key={q.date} label={q.label} selected={value === q.date} onPress={() => { onPick(q.date); onClose(); }} />
        ))}
      </Row>
      <View style={{ height: spacing.lg }} />
      <Row gap={spacing.sm} align="flex-end">
        <Field label="Or type a date" placeholder="YYYY-MM-DD" value={custom} onChangeText={setCustom} autoCapitalize="none" keyboardType="numbers-and-punctuation" style={{ flex: 1, marginBottom: 0 }} hint={custom && !valid ? 'Use the format 2026-09-03.' : undefined} />
        <Button title="Use" disabled={!valid} onPress={() => { onPick(custom); onClose(); }} />
      </Row>
      {value ? <Text variant="small" style={{ marginTop: spacing.md }}>Currently: {friendlyDate(value)}</Text> : null}
    </Sheet>
  );
}

const EMOJI = ['🧾', '🥦', '🍽️', '🏠', '💡', '🚌', '🩺', '🎬', '🛍️', '🔁', '🏦', '🐖', '💼', '🛠️', '🎁', '➕', '🐶', '🐱', '👶', '🎓', '✈️', '🏖️', '🎮', '📚', '🚗', '⛽', '🧹', '💇', '🎵', '🏋️', '☕', '🍕', '🍺', '🎂', '💊', '🧸', '📱', '💻', '🌱', '🧳', '🎨', '⚽', '🏠', '🔧', '💐', '🧼', '🚲', '🎟️', '🍔', '🥐'];

export function EmojiPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (e: string) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Pick an icon">
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {EMOJI.map((e, i) => (
          <Pressable key={`${e}-${i}`} accessibilityRole="button" accessibilityLabel={`Icon ${e}`} onPress={() => { onPick(e); onClose(); }} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28 }}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.lg + 6, borderTopRightRadius: radius.lg + 6, padding: spacing.lg, paddingTop: spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
});
