import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { CURRENCIES, parseMoneyInput } from '@/lib/money';
import { LANGUAGE_OPTIONS, deviceLanguage, getLocale, useLocale, useT } from '@/i18n';
import { Sheet } from '@/components/pickers';
import { Button, Card, CONTENT_MAX_WIDTH, Field, ListItem, Row, Text } from '@/components/ui';

const PAGES = ['why', 'setup', 'how'] as const;

export default function Onboarding() {
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const updateSettings = useAppStore((s) => s.updateSettings);
  const settings = useAppStore((s) => s.settings);
  const [page, setPage] = useState(0);
  const [currency, setCurrency] = useState(settings?.currency ?? locale.defaultCurrency);
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [balance, setBalance] = useState('');
  const [showCurrency, setShowCurrency] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const listRef = useRef<FlatList<string>>(null);
  const width = Dimensions.get('window').width;

  // Follow the locale's default currency until the user picks one explicitly.
  useEffect(() => {
    if (!currencyTouched) setCurrency(locale.defaultCurrency);
  }, [locale, currencyTouched]);

  const go = (i: number) => {
    setPage(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  const finish = async () => {
    await updateSettings({ currency, startingBalance: parseMoneyInput(balance, locale.format.decimal === ','), onboardingDone: true });
  };

  const languageName = settings?.language && settings.language !== 'system'
    ? LANGUAGE_OPTIONS.find((o) => o.code === settings.language)?.name ?? settings.language
    : `${t.systemLanguage} (${getLocale(deviceLanguage()).name})`;

  // Pages centre their content vertically inside the list's measured height.
  const [pageHeight, setPageHeight] = useState(0);
  const renderPage = (key: string) => {
    if (key === 'why') {
      return (
        <View style={{ width, minHeight: pageHeight, padding: spacing.xl, justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
          <Text variant="display">{t.onboardHeadline}</Text>
          <Text variant="muted" style={{ marginTop: spacing.xl, fontSize: 17 }}>{t.onboardBody}</Text>
          <View style={{ marginTop: spacing.xxl }}><Button title={t.next} onPress={() => go(1)} /></View>
          <View style={{ marginTop: spacing.md, alignItems: 'center' }}><Button tone="ghost" small title={`${t.language}: ${languageName}`} onPress={() => setShowLanguage(true)} /></View>
        </View>
        </View>
      );
    }
    if (key === 'setup') {
      return (
        <View style={{ width, minHeight: pageHeight, padding: spacing.xl, justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
          <Text variant="title">{t.quickSetup}</Text>
          <Text variant="muted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>{t.quickSetupBody}</Text>
          <Text variant="label" style={{ marginBottom: 6 }}>{t.language}</Text>
          <Row style={{ marginBottom: spacing.lg }}>
            <Button tone="secondary" title={languageName} onPress={() => setShowLanguage(true)} />
          </Row>
          <Text variant="label" style={{ marginBottom: 6 }}>{t.currency}</Text>
          <Row style={{ marginBottom: spacing.lg }}>
            <Button tone="secondary" title={currency} onPress={() => setShowCurrency(true)} />
          </Row>
          <Field label={t.startingBalance} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder={t.startingBalancePlaceholder} hint={t.startingBalanceHint} />
          <Row>
            <Button tone="ghost" title={t.back} onPress={() => go(0)} />
            <Button title={t.next} onPress={() => go(2)} style={{ flex: 1 }} />
          </Row>
        </View>
        </View>
      );
    }
    return (
      <View style={{ width, minHeight: pageHeight, padding: spacing.xl, justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <Text variant="title">{t.justSayIt}</Text>
        <Card style={{ marginTop: spacing.lg }}>
          {t.examples.map((e, i) => <Text key={e} variant="body" style={{ marginTop: i === 0 ? 0 : spacing.sm }}>{e}</Text>)}
        </Card>
        <Text variant="muted" style={{ marginTop: spacing.lg }}>{t.onboardLearn}</Text>
        <Row style={{ marginTop: spacing.xxl }}>
          <Button tone="ghost" title={t.back} onPress={() => go(1)} />
          <Button title={t.start} onPress={finish} style={{ flex: 1 }} />
        </Row>
      </View>
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
        style={{ flex: 1 }}
        onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
        renderItem={({ item }) => renderPage(item)}
        getItemLayout={(_d, index) => ({ length: width, offset: width * index, index })}
        keyboardShouldPersistTaps="handled"
      />
      <Row style={{ justifyContent: 'center', paddingBottom: spacing.lg }}>
        {PAGES.map((p, i) => <View key={p} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.accent : colors.border }} />)}
      </Row>
      <Sheet visible={showCurrency} onClose={() => setShowCurrency(false)} title={t.currency} tall>
        <ScrollView>
          {CURRENCIES.map((c) => (
            <ListItem key={c.code} title={`${c.symbol.trim()} ${c.name}`} subtitle={c.code} onPress={() => { setCurrency(c.code); setCurrencyTouched(true); setShowCurrency(false); }} />
          ))}
        </ScrollView>
      </Sheet>
      <Sheet visible={showLanguage} onClose={() => setShowLanguage(false)} title={t.language}>
        <ScrollView>
          <ListItem title={t.systemLanguage} onPress={() => { updateSettings({ language: 'system' }); setShowLanguage(false); }} />
          {LANGUAGE_OPTIONS.map((o) => (
            <ListItem key={o.code} title={o.name} onPress={() => { updateSettings({ language: o.code }); setShowLanguage(false); }} />
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}
