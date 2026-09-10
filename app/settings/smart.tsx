import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { getApiKey, setApiKey } from '@/lib/secrets';
import { LLM_MODEL } from '@/parser/llmFallback';
import { Button, Card, Field, Row, Screen, SectionTitle, Text } from '@/components/ui';

export default function SmartParsing() {
  const { colors } = useTheme();
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
            <Text variant="body">Use smart parsing assist</Text>
            <Text variant="small">Only when the built-in parser is unsure.</Text>
          </View>
          <Switch value={settings.smartParseEnabled} onValueChange={(v) => updateSettings({ smartParseEnabled: v })} trackColor={{ true: colors.accent }} />
        </Row>
      </Card>

      <SectionTitle>How it works</SectionTitle>
      <Card>
        <Text variant="muted">
          Almost everything is understood on your phone, instantly and offline. Now and then a phrase is too unusual. With this on, that one phrase (plus your category names) is sent to Claude ({LLM_MODEL}) and comes back as amount, type, category and note for you to confirm.
        </Text>
        <Text variant="muted" style={{ marginTop: spacing.sm }}>
          It never runs without a connection, never saves anything on its own, and you can always just fix the fields yourself. This uses your own API key, so the cost is yours and typically a fraction of a cent per phrase.
        </Text>
      </Card>

      <SectionTitle>Your API key</SectionTitle>
      <Card>
        <Text variant="small" style={{ marginBottom: spacing.md }}>{hasKey ? 'A key is saved in your phone\'s secure storage.' : 'No key saved. Get one from console.anthropic.com.'}</Text>
        <Field value={key} onChangeText={setKey} placeholder={hasKey ? 'Paste a new key to replace it' : 'sk-ant-…'} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <Row>
          <Button title="Save key" onPress={saveKey} disabled={!key.trim()} />
          {hasKey ? <Button tone="ghost" title="Remove key" onPress={async () => { await setApiKey(null); setHasKey(false); }} /> : null}
        </Row>
        {saved ? <Text variant="small" style={{ marginTop: spacing.sm }}>Saved.</Text> : null}
      </Card>
    </Screen>
  );
}
