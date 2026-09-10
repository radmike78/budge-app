import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '@/theme';

// ---------- Text ----------

type Variant = 'display' | 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label' | 'money';

const variantStyles: Record<Variant, TextStyle> = {
  display: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5, lineHeight: 40 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.3, lineHeight: 32 },
  heading: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 23 },
  muted: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  money: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
};

export function Text({ variant = 'body', color, style, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  const { colors } = useTheme();
  const defaultColor = variant === 'muted' || variant === 'small' || variant === 'label' ? colors.muted : colors.text;
  return <RNText {...rest} style={[variantStyles[variant], { color: color ?? defaultColor }, style]} />;
}

// ---------- Layout ----------

export function Screen({ children, scroll = true, padded = true, style, contentStyle, keyboard }: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const base: ViewStyle = { flex: 1, backgroundColor: colors.bg };
  const pad: ViewStyle = padded ? { paddingHorizontal: spacing.lg } : {};
  if (!scroll) {
    return <View style={[base, pad, { paddingBottom: insets.bottom }, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={[base, style]}
      contentContainerStyle={[pad, { paddingBottom: insets.bottom + spacing.xxl, paddingTop: spacing.sm }, contentStyle]}
      keyboardShouldPersistTaps={keyboard ? 'handled' : 'never'}
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, tone = 'default' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'default' | 'accent' | 'alt' }) {
  const { colors } = useTheme();
  const bg = tone === 'accent' ? colors.accentSoft : tone === 'alt' ? colors.cardAlt : colors.card;
  return <View style={[styles.card, { backgroundColor: bg, borderColor: tone === 'default' ? colors.border : 'transparent' }, style]}>{children}</View>;
}

export function Row({ children, style, gap = spacing.sm, align = 'center' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; align?: ViewStyle['alignItems'] }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function Spacer({ size = spacing.md }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm }} />;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm }}>
      <Text variant="label">{children}</Text>
      {right}
    </Row>
  );
}

// ---------- Buttons ----------

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ title, tone = 'primary', loading, disabled, style, small, icon, ...rest }: PressableProps & {
  title: string;
  tone?: ButtonTone;
  loading?: boolean;
  small?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = tone === 'primary' ? colors.accent : tone === 'secondary' ? colors.accentSoft : tone === 'danger' ? colors.dangerSoft : 'transparent';
  const fg = tone === 'primary' ? colors.onAccent : tone === 'danger' ? colors.danger : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <Row gap={6}>
          {icon}
          <RNText style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</RNText>
        </Row>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, tone = 'default', style }: { label: string; selected?: boolean; onPress?: () => void; tone?: 'default' | 'danger'; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const bg = selected ? (tone === 'danger' ? colors.dangerSoft : colors.accent) : colors.cardAlt;
  const fg = selected ? (tone === 'danger' ? colors.danger : colors.onAccent) : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} style={({ pressed }) => [styles.chip, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 }, style]}>
      <RNText style={{ color: fg, fontSize: 14, fontWeight: selected ? '600' : '500' }}>{label}</RNText>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.cardAlt }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(o.value)} style={[styles.segment, active && { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 }]}>
            <RNText style={{ color: active ? colors.text : colors.muted, fontWeight: active ? '600' : '500', fontSize: 14 }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Inputs ----------

export function Field({ label, hint, style, inputStyle, ...rest }: TextInputProps & { label?: string; hint?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      {label ? <Text variant="label" style={{ marginBottom: 6 }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        {...rest}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }, inputStyle]}
      />
      {hint ? <Text variant="small" style={{ marginTop: 6 }}>{hint}</Text> : null}
    </View>
  );
}

export function ListItem({ title, subtitle, right, onPress, left, style }: { title: string; subtitle?: string | null; right?: React.ReactNode; left?: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, { backgroundColor: pressed ? colors.cardAlt : colors.card, borderColor: colors.border }, style]}>
      {left ? <View style={{ marginRight: spacing.md }}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="small" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={{ marginLeft: spacing.md }}>{right}</View> : null}
    </Pressable>
  );
}

export function ProgressBar({ fraction, tone = 'accent' }: { fraction: number; tone?: 'accent' | 'warn' }) {
  const { colors } = useTheme();
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }} style={[styles.progressTrack, { backgroundColor: colors.cardAlt }]}>
      <View style={[styles.progressFill, { width: `${f * 100}%`, backgroundColor: tone === 'warn' ? colors.warn : colors.accent }]} />
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <Card tone="alt" style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      {body ? <Text variant="muted" style={{ textAlign: 'center', marginTop: spacing.sm }}>{body}</Text> : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </Card>
  );
}

export function Icon({ glyph, size = 28 }: { glyph: string | null | undefined; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size + 12, height: size + 12, borderRadius: (size + 12) / 2, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
      <RNText style={{ fontSize: size * 0.6 }}>{glyph || '•'}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth },
  button: { paddingVertical: 14, paddingHorizontal: spacing.xl, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: spacing.lg, minHeight: 36 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, minHeight: 36, justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, minHeight: 48 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
});
