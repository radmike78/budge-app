import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { spacing } from '@/theme';
import { categoryName, useT } from '@/i18n';
import { Button, EmptyState, ListItem, Screen, Text } from '@/components/ui';

export default function LearnedWords() {
  const t = useT();
  const keywords = useAppStore((s) => s.keywords);
  const categories = useAppStore((s) => s.categories);
  const forget = useAppStore((s) => s.forgetKeyword);
  const sorted = [...keywords].sort((a, b) => a.word.localeCompare(b.word));
  return (
    <Screen>
      <Text variant="muted" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t.learnedIntro}</Text>
      {sorted.length === 0 ? <EmptyState title={t.nothingLearned} body={t.nothingLearnedBody} /> : null}
      {sorted.map((k) => {
        const cat = categories.find((c) => c.id === k.categoryId);
        return <ListItem key={k.word} title={k.word} subtitle={cat ? `${cat.icon ?? ''} ${categoryName(cat, t)}`.trim() : t.unknownCategory} right={<Button tone="ghost" small title={t.forget} onPress={() => forget(k.word)} />} />;
      })}
    </Screen>
  );
}
