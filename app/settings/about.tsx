import React from 'react';
import { spacing } from '@/theme';
import { Card, Screen, SectionTitle, Text } from '@/components/ui';

const COMMITMENTS: [string, string][] = [
  ['No bank linking. Ever.', 'Only Budget never asks for bank credentials and never will, not as a feature and not as an upsell. You tell it what happened.'],
  ['No ads. No tracking.', 'There is no analytics SDK, no advertising ID, no third-party data sharing. Nothing about you leaves this phone unless you export it yourself.'],
  ['No accounts.', 'You never sign up. There is no server holding your data. Backups are files you own.'],
  ['No subscriptions or trials.', 'Whatever Only Budget costs is disclosed up front and never changes after you buy. Nothing you already entered is ever put behind a paywall.'],
  ['Calm by design.', 'No streaks, no red badges, no "you failed". Just plain sentences about where your money went.'],
];

export default function About() {
  return (
    <Screen>
      <Text variant="title" style={{ marginTop: spacing.sm }}>Only Budget</Text>
      <Text variant="muted" style={{ marginTop: spacing.xs }}>Only a budget. Nothing else.</Text>
      <SectionTitle>What we promise</SectionTitle>
      {COMMITMENTS.map(([title, body]) => (
        <Card key={title} style={{ marginBottom: spacing.sm }}>
          <Text variant="heading">{title}</Text>
          <Text variant="muted" style={{ marginTop: spacing.xs }}>{body}</Text>
        </Card>
      ))}
      <SectionTitle>Voice</SectionTitle>
      <Card>
        <Text variant="muted">Speech is turned into text by your phone's own recognizer. On devices that support on-device recognition, audio never leaves the phone. Only Budget only ever sees the final words.</Text>
      </Card>
      <SectionTitle>Smart parsing (optional)</SectionTitle>
      <Card>
        <Text variant="muted">Off by default. If you turn it on and add your own API key, a phrase the built-in parser can't understand is sent to a language model to be structured. Only that phrase and your category names are sent. Turn it off any time.</Text>
      </Card>
    </Screen>
  );
}
