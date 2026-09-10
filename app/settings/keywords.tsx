import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { spacing } from '@/theme';
import { Button, EmptyState, ListItem, Screen, Text } from '@/components/ui';

export default function LearnedWords() {
  const keywords = useAppStore((s) => s.keywords);
  const categories = useAppStore((s) => s.categories);
  const forget = useAppStore((s) => s.forgetKeyword);
  const sorted = [...keywords].sort((a, b) => a.word.localeCompare(b.word));
  return (
    <Screen>
      <Text variant="muted" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>When you change the category of a parsed entry, the words in it are remembered so the next one lands right. Remove any that got it wrong.</Text>
      {sorted.length === 0 ? <EmptyState title="Nothing learned yet" body="Correct a category on the confirmation card and it will show up here." /> : null}
      {sorted.map((k) => {
        const cat = categories.find((c) => c.id === k.categoryId);
        return <ListItem key={k.word} title={k.word} subtitle={cat ? `${cat.icon ?? ''} ${cat.name}`.trim() : 'Unknown category'} right={<Button tone="ghost" small title="Forget" onPress={() => forget(k.word)} />} />;
      })}
    </Screen>
  );
}
