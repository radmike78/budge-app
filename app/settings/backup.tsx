import React, { useState } from 'react';
import { View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { getDb } from '@/db/database';
import { allTransactions } from '@/db/repositories';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { nowIso } from '@/lib/dates';
import { buildBackup, isBackupPayload, summaryText, transactionsToCsv } from '@/lib/export';
import { decryptBackup, encryptBackup, isEncryptedBackupFile } from '@/lib/backupCrypto';
import { pickTextFile, shareTextFile, timestampForFilename } from '@/lib/files';
import { categoryName, useLocale, useT } from '@/i18n';
import { confirmDialog } from '@/lib/dialogs';
import { Sheet } from '@/components/pickers';
import { Button, Card, Field, Screen, SectionTitle, Text } from '@/components/ui';

export default function Backup() {
  const { colors } = useTheme();
  const t = useT();
  const locale = useLocale();
  const settings = useAppStore((s) => s.settings);
  const categories = useAppStore((s) => s.categories);
  const goals = useAppStore((s) => s.goals);
  const rules = useAppStore((s) => s.rules);
  const keywords = useAppStore((s) => s.keywords);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const restoreAll = useAppStore((s) => s.restoreAll);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [askPass, setAskPass] = useState<null | { mode: 'encrypt' } | { mode: 'decrypt'; file: unknown }>(null);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  if (!settings) return null;

  const nameOf = (c: Parameters<typeof categoryName>[0]) => categoryName(c, t);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setStatus(null);
    try {
      setStatus({ text: await fn(), error: false });
    } catch (e) {
      setStatus({ text: t.didntWork((e as Error).message), error: true });
    } finally {
      setBusy(null);
    }
  };

  const snapshot = async () => {
    const db = await getDb();
    const transactions = await allTransactions(db);
    return buildBackup({ settings, categories, transactions, recurringRules: rules, goals, keywords }, nowIso());
  };

  const exportCsv = () => run('csv', async () => {
    const db = await getDb();
    const tx = await allTransactions(db);
    await shareTextFile(`onlybudget-entries-${timestampForFilename()}.csv`, transactionsToCsv(tx, categories, nameOf));
    return t.csvReady;
  });

  const exportSummary = () => run('summary', async () => {
    const db = await getDb();
    const tx = await allTransactions(db);
    await shareTextFile(`onlybudget-summary-${timestampForFilename()}.txt`, summaryText(tx, categories, goals, settings.currency, nowIso(), locale, nameOf));
    return t.summaryReady;
  });

  const exportBackup = () => run('backup', async () => {
    const payload = await snapshot();
    await shareTextFile(`onlybudget-backup-${timestampForFilename()}.json`, JSON.stringify(payload, null, 2));
    await updateSettings({ lastBackupAt: nowIso() });
    return t.backupReady;
  });

  const exportEncrypted = () => run('encrypted', async () => {
    if (pass.length < 6) throw new Error(t.passphraseShort);
    if (pass !== pass2) throw new Error(t.passphraseMismatch);
    const payload = await snapshot();
    const file = encryptBackup(JSON.stringify(payload), pass, (n) => Crypto.getRandomBytes(n));
    await shareTextFile(`onlybudget-backup-${timestampForFilename()}.onlybudget.json`, JSON.stringify(file));
    await updateSettings({ lastBackupAt: nowIso() });
    setAskPass(null); setPass(''); setPass2('');
    return t.encryptedReady;
  });

  const applyRestore = async (payload: unknown) => {
    if (!isBackupPayload(payload)) throw new Error(t.notBackupFile);
    const ok = await confirmDialog(t.replaceEverythingQ, t.replaceEverythingBody(payload.transactions.length, payload.goals.length), { confirmText: t.restore, cancelText: t.cancel, destructive: true });
    if (!ok) throw new Error(t.cancelled);
    await restoreAll({ settings: { ...payload.settings, onboardingDone: true, language: payload.settings.language ?? 'system' }, categories: payload.categories, transactions: payload.transactions, recurringRules: payload.recurringRules ?? [], goals: payload.goals, keywords: payload.keywords ?? [] });
    return t.restored(payload.transactions.length);
  };

  const restore = () => run('restore', async () => {
    const picked = await pickTextFile();
    if (!picked) return t.noFileChosen;
    const parsed = JSON.parse(picked.text) as unknown;
    if (isEncryptedBackupFile(parsed)) {
      setAskPass({ mode: 'decrypt', file: parsed });
      return t.enterPassphraseToContinue;
    }
    return applyRestore(parsed);
  });

  const decryptAndRestore = () => run('restore', async () => {
    if (!askPass || askPass.mode !== 'decrypt') return '';
    let json: string;
    try {
      json = decryptBackup(askPass.file as Parameters<typeof decryptBackup>[0], pass);
    } catch {
      throw new Error(t.wrongPassphrase);
    }
    setAskPass(null); setPass('');
    return applyRestore(JSON.parse(json));
  });

  return (
    <Screen>
      <Text variant="muted" style={{ marginTop: spacing.sm }}>{t.backupIntro(settings.lastBackupAt ? settings.lastBackupAt.slice(0, 10) : null)}</Text>

      <SectionTitle>{t.exportSection}</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Button title={t.exportCsv} tone="secondary" onPress={exportCsv} loading={busy === 'csv'} />
        <Button title={t.exportSummary} tone="secondary" onPress={exportSummary} loading={busy === 'summary'} />
      </Card>

      <SectionTitle>{t.backupSection}</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Button title={t.fullBackup} onPress={exportBackup} loading={busy === 'backup'} />
        <Button title={t.encryptedBackup} onPress={() => { setPass(''); setPass2(''); setAskPass({ mode: 'encrypt' }); }} loading={busy === 'encrypted'} />
        <Text variant="small">{t.encryptedHint}</Text>
      </Card>

      <SectionTitle>{t.restoreSection}</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Button title={t.restoreButton} tone="secondary" onPress={restore} loading={busy === 'restore'} />
        <Text variant="small">{t.restoreHint}</Text>
      </Card>

      {status ? <Text variant="body" color={status.error ? colors.danger : colors.text} style={{ marginTop: spacing.lg }}>{status.text}</Text> : null}

      <Sheet visible={!!askPass} onClose={() => setAskPass(null)} title={askPass?.mode === 'encrypt' ? t.choosePassphrase : t.enterPassphrase}>
        <Field label={t.passphrase} value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" autoFocus />
        {askPass?.mode === 'encrypt' ? <Field label={t.repeatPassphrase} value={pass2} onChangeText={setPass2} secureTextEntry autoCapitalize="none" /> : null}
        <View>
          <Button title={askPass?.mode === 'encrypt' ? t.createEncrypted : t.unlockRestore} onPress={askPass?.mode === 'encrypt' ? exportEncrypted : decryptAndRestore} loading={busy != null} />
        </View>
        {status && askPass ? <Text variant="small" color={colors.danger} style={{ marginTop: spacing.sm }}>{status.text}</Text> : null}
      </Sheet>
    </Screen>
  );
}
