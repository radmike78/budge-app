import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { CURRENCIES, parseMoneyInput } from '@/lib/money';
import { Sheet } from '@/components/pickers';
import { Button, Card, Field, ListItem, Row, Text } from '@/components/ui';

const PAGES = ['why', 'setup', 'how'] as const;

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const updateSettings = useAppStore((s) => s.updateSettings);
  const settings = useAppStore((s) => s.settings);
  const [page, setPage] = useState(0);
  const [currency, setCurrency] = useState(settings?.currency ?? 'USD');
  const [balance, setBalance] = useState('');
  const [showCurrency, setShowCurrency] = useState(false);
  const listRef = useRef<FlatList<string>>(null);
  const width = Dimensions.get('window').width;

  const go = (i: number) => {
    setPage(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  const finish = async () => {
    await updateSettings({ currency, startingBalance: parseMoneyInput(balance), onboardingDone: true });
  };

  const renderPage = (key: string) => {
    if (key === 'why') {
      return (
        <View style={{ width, padding: spacing.xl, justifyContent: 'center', flex: 1 }}>
          <Text variant="display">No bank linking.{'\n'}No ads.{'\n'}Just tell us what you spent.</Text>
          <Text variant="muted" style={{ marginTop: spacing.xl, fontSize: 17 }}>
            Plainly is a manual budget you talk to. Speak or type "spent 12 on lunch" and it sorts the rest. Everything stays on your phone.
          </Text>
          <View style={{ marginTop: spacing.xxl }}><Button title="Next" onPress={() => go(1)} /></View>
        </View>
      );
    }
    if (key === 'setup') {
      return (
        <View style={{ width, padding: spacing.xl, justifyContent: 'center', flex: 1 }}>
          <Text variant="title">Quick setup</Text>
          <Text variant="muted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>No account. No email. Two optional choices and you're in.</Text>
          <Text variant="label" style={{ marginBottom: 6 }}>Currency</Text>
          <Row style={{ marginBottom: spacing.lg }}>
            <Button tone="secondary" title={currency} onPress={() => setShowCurrency(true)} />
          </Row>
          <Field label="Starting balance (optional)" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="What you have right now" hint="Shown as an overall balance on the Today screen. Leave it blank to skip." />
          <Row>
            <Button tone="ghost" title="Back" onPress={() => go(0)} />
            <Button title="Next" onPress={() => go(2)} style={{ flex: 1 }} />
          </Row>
        </View>
      );
    }
    return (
      <View style={{ width, padding: spacing.xl, justifyContent: 'center', flex: 1 }}>
        <Text variant="title">Say it plainly</Text>
        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="body">"spent 12 dollars on lunch"</Text>
          <Text variant="body" style={{ marginTop: spacing.sm }}>"got paid 2400"</Text>
          <Text variant="body" style={{ marginTop: spacing.sm }}>"goal: save 500 for a trip by December"</Text>
        </Card>
        <Text variant="muted" style={{ marginTop: spacing.lg }}>You always see what was understood before it saves, and can fix any field with a tap. If you correct a category, Plainly remembers the word next time.</Text>
        <Row style={{ marginTop: spacing.xxl }}>
          <Button tone="ghost" title="Back" onPress={() => go(1)} />
          <Button title="Start" onPress={finish} style={{ flex: 1 }} />
        </Row>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <FlatList
        ref={listRef}
        data={[...PAGES]}
        keyExtractor={(k) => k}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => renderPage(item)}
        getItemLayout={(_d, index) => ({ length: width, offset: width * index, index })}
        keyboardShouldPersistTaps="handled"
      />
      <Row style={{ justifyContent: 'center', paddingBottom: spacing.lg }}>
        {PAGES.map((p, i) => <View key={p} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.accent : colors.border }} />)}
      </Row>
      <Sheet visible={showCurrency} onClose={() => setShowCurrency(false)} title="Currency" tall>
        <ScrollView>
          {CURRENCIES.map((c) => (
            <ListItem key={c.code} title={`${c.symbol.trim()} ${c.name}`} subtitle={c.code} onPress={() => { setCurrency(c.code); setShowCurrency(false); }} />
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}
