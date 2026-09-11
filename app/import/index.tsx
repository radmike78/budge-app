import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { radius, spacing, useTheme } from '@/theme';
import { friendlyDate, longDate, monthLabel, today } from '@/lib/dates';
import { notify } from '@/lib/dialogs';
import { pickPdf, PdfTooLargeError } from '@/lib/pdfBytes';
import { categoryName, useDateFormat, useLanguageCode, useLocale, useMoney, useT } from '@/i18n';
import { parseCreditReport, parseStatement, rowsFromItems, type ParsedStatement, type StatementLine, type Tradeline } from '@/statements';
import { PdfExtractor, type PdfExtractorHandle } from '@/components/PdfExtractor';
import { CategoryPicker } from '@/components/pickers';
import { Button, Card, Row, Screen, SectionTitle, Text } from '@/components/ui';

type Stage = 'idle' | 'reading' | 'review' | 'report';

/**
 * Import a bank or card statement, or a credit report, from a PDF. Everything is
 * read on the device; the user sees and can change every line before saving.
 */
export default function ImportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const fmt = useDateFormat();
  const language = useLanguageCode();
  const categories = useAppStore((s) => s.categories);
  const goals = useAppStore((s) => s.goals);
  const keywordMap = useAppStore((s) => s.keywordMap);
  const fingerprints = useAppStore((s) => s.fingerprints);
  const importStatement = useAppStore((s) => s.importStatement);
  const mergeTradelines = useAppStore((s) => s.mergeTradelines);
  const learnCategory = useAppStore((s) => s.learnCategory);
  const extractor = useRef<PdfExtractorHandle>(null);

  const [stage, setStage] = useState<Stage>('idle');
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [tradelines, setTradelines] = useState<Tradeline[]>([]);
  const [saveCard, setSaveCard] = useState(true);
  const [pickingCat, setPickingCat] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const choose = async () => {
    try {
      const picked = await pickPdf();
      if (!picked) return;
      setStage('reading');
      let items: Awaited<ReturnType<PdfExtractorHandle['extract']>>['items'];
      try {
        items = (await extractor.current!.extract(picked.bytes)).items;
      } finally {
        // The file itself is never kept: wipe the bytes as soon as the text is out.
        picked.bytes.fill(0);
      }
      const rows = rowsFromItems(items);
      const ctx = { categories, goals, keywordMap, today: today(), language };
      const result = parseStatement(rows, ctx, { language, today: today(), knownFingerprints: fingerprints });
      if (result.kind === 'credit_report') {
        const tl = parseCreditReport(rows);
        setTradelines(tl);
        setParsed(result);
        setStage('report');
        return;
      }
      setParsed(result);
      setLines(result.lines);
      setStage('review');
    } catch (e) {
      setStage('idle');
      if (e instanceof PdfTooLargeError) notify(t.importStatement, t.importTooLarge);
      else if (e instanceof Error && e.message === 'Not a PDF') notify(t.importStatement, t.importNotPdf);
      else notify(t.importStatement, t.importFailed);
    }
  };

  const update = (i: number, patch: Partial<StatementLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const selected = useMemo(() => lines.filter((l) => l.include && !l.duplicate), [lines]);
  const byMonth = useMemo(() => {
    const map = new Map<string, number[]>();
    lines.forEach((l, i) => { const list = map.get(l.month) ?? []; list.push(i); map.set(l.month, list); });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [lines]);

  const save = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      for (const l of selected) {
        // A changed category teaches the app the merchant for next time.
        const original = parsed.lines.find((o) => o.fingerprint === l.fingerprint);
        if (original && l.categoryId && l.categoryId !== original.categoryId) await learnCategory(l.description, l.categoryId);
      }
      const n = await importStatement(selected, { kind: parsed.kind === 'card' ? 'card' : 'bank', periodStart: parsed.period?.start ?? null, periodEnd: parsed.period?.end ?? null });
      let message = t.importDone(n);
      if (parsed.kind === 'card' && saveCard && parsed.tradelines.length) {
        await mergeTradelines(parsed.tradelines);
        message += ` ${t.importCardSaved}`;
      }
      setToast(message);
      setStage('idle');
      setParsed(null);
      setLines([]);
    } finally {
      setBusy(false);
    }
  };

  const saveReport = async () => {
    setBusy(true);
    try {
      const n = await mergeTradelines(tradelines);
      setToast(t.reportSaved(n));
      setStage('idle');
      router.push('/debts');
    } finally {
      setBusy(false);
    }
  };

  const catRow = pickingCat != null ? lines[pickingCat] : null;

  return (
    <Screen keyboard>
      <PdfExtractor ref={extractor} />
      {toast ? <Card tone="accent" style={{ marginTop: spacing.md }}><Text variant="body">{toast}</Text></Card> : null}

      {stage === 'idle' ? (
        <>
          <Text variant="muted" style={{ marginTop: spacing.md }}>{t.importIntro}</Text>
          <View style={{ marginTop: spacing.lg }}><Button title={t.pickPdf} onPress={choose} /></View>
        </>
      ) : null}

      {stage === 'reading' ? <Text variant="muted" style={{ marginTop: spacing.lg }}>{t.readingPdf}</Text> : null}

      {stage === 'report' && parsed ? (
        <>
          <SectionTitle>{t.importKind.credit_report}</SectionTitle>
          <Text variant="muted">{t.reportFound(tradelines.length)}</Text>
          {tradelines.map((tl) => (
            <Card key={tl.id} style={{ marginTop: spacing.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="body" style={{ fontWeight: '600', flex: 1 }}>{tl.creditor}</Text>
                <Text variant="money">{tl.balance != null ? money(tl.balance, { compact: true }) : '–'}</Text>
              </Row>
              <Text variant="small" style={{ marginTop: 2 }}>
                {t.debtTypes[tl.type]}{tl.monthlyPayment != null ? ` · ${t.debtMinPayment}: ${money(tl.monthlyPayment, { compact: true })}` : ''}{tl.apr != null ? ` · ${tl.apr}%` : ''}{!tl.consumer ? ` · ${t.excludedFromPlan}` : ''}
              </Text>
            </Card>
          ))}
          <View style={{ marginTop: spacing.lg }}>
            <Button title={t.reportSaveButton} onPress={saveReport} loading={busy} disabled={tradelines.length === 0} />
            <View style={{ height: spacing.sm }} />
            <Button tone="ghost" title={t.cancel} onPress={() => setStage('idle')} />
          </View>
        </>
      ) : null}

      {stage === 'review' && parsed ? (
        <>
          <SectionTitle>{t.importKind[parsed.kind] ?? t.importKind.unknown}</SectionTitle>
          <Text variant="muted">
            {parsed.period ? t.importPeriod(longDate(parsed.period.start, today(), fmt), longDate(parsed.period.end, today(), fmt)) : ''} {t.importLinesFound(lines.length)}
          </Text>
          {parsed.warnings.filter((w) => t.importWarnings[w]).map((w) => (
            <Text key={w} variant="small" style={{ marginTop: spacing.xs }}>{t.importWarnings[w]}</Text>
          ))}
          {lines.length === 0 ? <Text variant="body" style={{ marginTop: spacing.md }}>{t.importNothingFound}</Text> : null}
          {parsed.kind === 'card' && parsed.tradelines.length ? (
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
              <Text variant="body" style={{ flex: 1 }}>{t.importSaveCard}</Text>
              <Switch value={saveCard} onValueChange={setSaveCard} trackColor={{ true: colors.accent }} />
            </Row>
          ) : null}

          {byMonth.map(([month, idxs]) => {
            const inc = idxs.filter((i) => lines[i].include && !lines[i].duplicate && lines[i].direction === 'in').reduce((a, i) => a + lines[i].amount, 0);
            const out = idxs.filter((i) => lines[i].include && !lines[i].duplicate && lines[i].direction === 'out').reduce((a, i) => a + lines[i].amount, 0);
            const partial = parsed.months.find((m) => m.month === month)?.partial;
            return (
              <View key={month}>
                <SectionTitle>{monthLabel(month, fmt)}</SectionTitle>
                <Text variant="small" style={{ marginBottom: spacing.sm }}>{t.importMonthLine(money(inc, { compact: true }), money(out, { compact: true }))}{partial ? ` · ${t.importPartialMonth}` : ''}</Text>
                {idxs.map((i) => {
                  const l = lines[i];
                  const cat = categories.find((c) => c.id === l.categoryId) ?? null;
                  const dim = !l.include || l.duplicate;
                  return (
                    <View key={l.fingerprint + i} style={[styles.line, { backgroundColor: colors.card, borderColor: colors.border, opacity: dim ? 0.55 : 1 }]}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, paddingRight: spacing.sm }}>
                          <Text variant="body" numberOfLines={1}>{l.description}</Text>
                          <Text variant="small">{friendlyDate(l.date, today(), fmt)} · {l.duplicate ? t.importDuplicate : t.lineKind[l.kind]}</Text>
                        </View>
                        <Text variant="money" color={l.direction === 'in' ? colors.income : colors.text}>{l.direction === 'in' ? '+' : '−'}{money(l.amount, { compact: true })}</Text>
                      </Row>
                      <Row style={{ marginTop: spacing.sm, justifyContent: 'space-between' }}>
                        <Pressable onPress={() => setPickingCat(i)} accessibilityRole="button" disabled={l.duplicate}>
                          <Text variant="small" color={colors.accent}>{cat ? `${cat.icon ?? ''} ${categoryName(cat, t)}`.trim() : t.pickCategory}</Text>
                        </Pressable>
                        <Switch value={l.include && !l.duplicate} disabled={l.duplicate} onValueChange={(v) => update(i, { include: v })} trackColor={{ true: colors.accent }} />
                      </Row>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <View style={{ marginTop: spacing.lg }}>
            <Button title={t.importButton(selected.length)} onPress={save} loading={busy} disabled={selected.length === 0} />
            <View style={{ height: spacing.sm }} />
            <Button tone="ghost" title={t.cancel} onPress={() => { setStage('idle'); setParsed(null); setLines([]); }} />
          </View>
          <CategoryPicker
            visible={catRow != null}
            onClose={() => setPickingCat(null)}
            onPick={(c) => { if (pickingCat != null) update(pickingCat, { categoryId: c.id, direction: c.kind === 'income' ? 'in' : 'out' }); }}
            kind="all"
            selectedId={catRow?.categoryId ?? null}
            categories={categories}
          />
        </>
      ) : null}
      <View style={{ height: spacing.xl }} />
      <Text variant="small" style={{ textAlign: 'center' }}>{locale.s.importStatementSub}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, marginBottom: spacing.sm },
});
