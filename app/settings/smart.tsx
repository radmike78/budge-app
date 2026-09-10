import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { getApiKey, setApiKey } from '@/lib/secrets';
import { LLM_MODEL } from '@/parser/llmFallback';
import { useT } from '@/i18n';
import { Button, Card, Field, Row, Screen, SectionTitle, Text } from '@/components/ui';

export default function SmartParsing() {
  const { colors } = useTheme();
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getApiKey().then((k) => { setHasKey(!!k); });
  }, []);
  if (!settings) return null;

  const saveKey = async () => {
    await setApiKey(key.trim() || null);
    setHasKey(!!key.trim());
    setKey('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Screen keyboard>
      <Card style={{ marginTop: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text variant="body">{t.useSmart}</Text>
            <Text variant="small">{t.useSmartSub}</Text>
          </View>
          <Switch value={settings.smartParseEnabled} onValueChange={(v) => updateSettings({ smartParseEnabled: v })} trackColor={{ true: colors.accent }} />
        </Row>
      </Card>

      <SectionTitle>{t.howItWorks}</SectionTitle>
      <Card>
        <Text variant="muted">{t.smartHow1(LLM_MODEL)}</Text>
        <Text variant="muted" style={{ marginTop: spacing.sm }}>{t.smartHow2}</Text>
      </Card>

      <SectionTitle>{t.yourApiKey}</SectionTitle>
      <Card>
        <Text variant="small" style={{ marginBottom: spacing.md }}>{hasKey ? t.keySaved : t.noKey}</Text>
        <Field value={key} onChangeText={setKey} placeholder={hasKey ? t.pasteNewKey : 'sk-ant-…'} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <Row>
          <Button title={t.saveKey} onPress={saveKey} disabled={!key.trim()} />
          {hasKey ? <Button tone="ghost" title={t.removeKey} onPress={async () => { await setApiKey(null); setHasKey(false); }} /> : null}
        </Row>
        {saved ? <Text variant="small" style={{ marginTop: spacing.sm }}>{t.saved}</Text> : null}
      </Card>
    </Screen>
  );
}
