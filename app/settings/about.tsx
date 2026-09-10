import React from 'react';
import { spacing } from '@/theme';
import { useT } from '@/i18n';
import { Card, Screen, SectionTitle, Text } from '@/components/ui';

export default function About() {
  const t = useT();
  return (
    <Screen>
      <Text variant="title" style={{ marginTop: spacing.sm }}>{t.appName}</Text>
      <Text variant="muted" style={{ marginTop: spacing.xs }}>{t.tagline}</Text>
      <SectionTitle>{t.whatWePromise}</SectionTitle>
      {t.commitments.map(([title, body]) => (
        <Card key={title} style={{ marginBottom: spacing.sm }}>
          <Text variant="heading">{title}</Text>
          <Text variant="muted" style={{ marginTop: spacing.xs }}>{body}</Text>
        </Card>
      ))}
      <SectionTitle>{t.voiceSection}</SectionTitle>
      <Card><Text variant="muted">{t.voiceBody}</Text></Card>
      <SectionTitle>{t.smartSection}</SectionTitle>
      <Card><Text variant="muted">{t.smartBody}</Text></Card>
    </Screen>
  );
}
