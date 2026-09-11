import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category, TxType } from '@/types';
import { radius, spacing, useTheme } from '@/theme';
import { addDays, friendlyDate, isValidDateString, today } from '@/lib/dates';
import { categoryName, useDateFormat, useT } from '@/i18n';
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
  const t = useT();
  const list = useMemo(() => categories.filter((c) => !c.archived && (kind === 'all' || c.kind === kind)), [categories, kind]);
  return (
    <Sheet visible={visible} onClose={onClose} title={t.category} tall>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <ListItem
            title={categoryName(item, t)}
            left={<Icon glyph={item.icon} size={22} />}
            right={item.id === selectedId ? <Text color={undefined} variant="body">✓</Text> : null}
            onPress={() => { onPick(item); onClose(); }}
          />
        )}
      />
    </Sheet>
  );
}

export function DatePicker({ visible, onClose, value, onPick, future, mode }: { visible: boolean; onClose: () => void; value: string; onPick: (d: string) => void; future?: boolean; mode?: 'reminder' }) {
  const t = today();
  const s = useT();
  const fmt = useDateFormat();
  const [custom, setCustom] = useState(value);
  const quick = mode === 'reminder'
    ? [
        { label: s.today, date: t },
        { label: s.tomorrow, date: addDays(t, 1) },
        { label: s.inAWeek, date: addDays(t, 7) },
        { label: s.inAMonth, date: addDays(t, 30) },
      ]
    : future
    ? [
        { label: s.inAMonth, date: addDays(t, 30) },
        { label: s.in3Months, date: addDays(t, 90) },
        { label: s.in6Months, date: addDays(t, 180) },
        { label: s.inAYear, date: addDays(t, 365) },
      ]
    : [
        { label: s.today, date: t },
        { label: s.yesterday, date: addDays(t, -1) },
        { label: friendlyDate(addDays(t, -2), t, fmt), date: addDays(t, -2) },
        { label: friendlyDate(addDays(t, -3), t, fmt), date: addDays(t, -3) },
      ];
  const valid = isValidDateString(custom);
  return (
    <Sheet visible={visible} onClose={onClose} title={s.date}>
      <Row style={{ flexWrap: 'wrap' }}>
        {quick.map((q) => (
          <Chip key={q.date} label={q.label} selected={value === q.date} onPress={() => { onPick(q.date); onClose(); }} />
        ))}
      </Row>
      <View style={{ height: spacing.lg }} />
      <Row gap={spacing.sm} align="flex-end">
        <Field label={s.orTypeDate} placeholder="YYYY-MM-DD" value={custom} onChangeText={setCustom} autoCapitalize="none" keyboardType="numbers-and-punctuation" style={{ flex: 1, marginBottom: 0 }} hint={custom && !valid ? s.dateFormatHint : undefined} />
        <Button title={s.use} disabled={!valid} onPress={() => { onPick(custom); onClose(); }} />
      </Row>
      {value ? <Text variant="small" style={{ marginTop: spacing.md }}>{s.currently(friendlyDate(value, t, fmt))}</Text> : null}
    </Sheet>
  );
}

const QUICK_TIMES = ['07:00', '08:00', '09:00', '12:00', '15:00', '18:00', '20:00', '21:00'];
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Time of day for reminders: a few common hours plus a typed HH:MM. */
export function TimePicker({ visible, onClose, value, onPick }: { visible: boolean; onClose: () => void; value: string; onPick: (t: string) => void }) {
  const s = useT();
  const [custom, setCustom] = useState(value);
  const valid = TIME_RE.test(custom);
  const normalized = valid ? custom.padStart(5, '0') : custom;
  return (
    <Sheet visible={visible} onClose={onClose} title={s.time}>
      <Row style={{ flexWrap: 'wrap' }}>
        {QUICK_TIMES.map((q) => (
          <Chip key={q} label={q} selected={value === q} onPress={() => { onPick(q); onClose(); }} />
        ))}
      </Row>
      <View style={{ height: spacing.lg }} />
      <Row gap={spacing.sm} align="flex-end">
        <Field label={s.orTypeTime} placeholder="HH:MM" value={custom} onChangeText={setCustom} autoCapitalize="none" keyboardType="numbers-and-punctuation" style={{ flex: 1, marginBottom: 0 }} hint={custom && !valid ? s.timeFormatHint : undefined} />
        <Button title={s.use} disabled={!valid} onPress={() => { onPick(normalized); onClose(); }} />
      </Row>
    </Sheet>
  );
}

const EMOJI = ['🧾', '🥦', '🍽️', '🏠', '💡', '🚌', '🩺', '🎬', '🛍️', '🔁', '🏦', '🐖', '💼', '🛠️', '🎁', '➕', '🐶', '🐱', '👶', '🎓', '✈️', '🏖️', '🎮', '📚', '🚗', '⛽', '🧹', '💇', '🎵', '🏋️', '☕', '🍕', '🍺', '🎂', '💊', '🧸', '📱', '💻', '🌱', '🧳', '🎨', '⚽', '🏠', '🔧', '💐', '🧼', '🚲', '🎟️', '🍔', '🥐'];

export function EmojiPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (e: string) => void }) {
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t.pickIconTitle}>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {EMOJI.map((e, i) => (
          <Pressable key={`${e}-${i}`} accessibilityRole="button" accessibilityLabel={e} onPress={() => { onPick(e); onClose(); }} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
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
