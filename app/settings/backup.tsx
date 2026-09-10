import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { getDb } from '@/db/database';
import { allTransactions } from '@/db/repositories';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { nowIso } from '@/lib/dates';
import { buildBackup, isBackupPayload, summaryText, transactionsToCsv } from '@/lib/export';
import { decryptBackup, encryptBackup, isEncryptedBackupFile } from '@/lib/backupCrypto';
import { pickTextFile, shareTextFile, timestampForFilename } from '@/lib/files';
import { Sheet } from '@/components/pickers';
import { Button, Card, Field, Screen, SectionTitle, Text } from '@/components/ui';

export default function Backup() {
  const { colors } = useTheme();
  const settings = useAppStore((s) => s.settings);
  const categories = useAppStore((s) => s.categories);
  const goals = useAppStore((s) => s.goals);
  const rules = useAppStore((s) => s.rules);
  const keywords = useAppStore((s) => s.keywords);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const restoreAll = useAppStore((s) => s.restoreAll);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [askPass, setAskPass] = useState<null | { mode: 'encrypt' } | { mode: 'decrypt'; file: unknown }>(null);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  if (!settings) return null;

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setStatus(null);
    try {
      setStatus(await fn());
    } catch (e) {
      setStatus(`That didn't work: ${(e as Error).message}`);
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
    await shareTextFile(`onlybudget-entries-${timestampForFilename()}.csv`, transactionsToCsv(tx, categories));
    return 'CSV ready to save or share.';
  });

  const exportSummary = () => run('summary', async () => {
    const db = await getDb();
    const tx = await allTransactions(db);
    await shareTextFile(`onlybudget-summary-${timestampForFilename()}.txt`, summaryText(tx, categories, goals, settings.currency, nowIso()));
    return 'Summary ready to save or share.';
  });

  const exportBackup = () => run('backup', async () => {
    const payload = await snapshot();
    await shareTextFile(`onlybudget-backup-${timestampForFilename()}.json`, JSON.stringify(payload, null, 2));
    await updateSettings({ lastBackupAt: nowIso() });
    return 'Backup file ready. Keep it somewhere safe, like your own cloud drive.';
  });

  const exportEncrypted = () => run('encrypted', async () => {
    if (pass.length < 6) throw new Error('Use a passphrase of at least 6 characters.');
    if (pass !== pass2) throw new Error('The passphrases do not match.');
    const payload = await snapshot();
    const file = encryptBackup(JSON.stringify(payload), pass, (n) => Crypto.getRandomBytes(n));
    await shareTextFile(`onlybudget-backup-${timestampForFilename()}.onlybudget.json`, JSON.stringify(file));
    await updateSettings({ lastBackupAt: nowIso() });
    setAskPass(null); setPass(''); setPass2('');
    return 'Encrypted backup ready. Without the passphrase it cannot be opened, so remember it.';
  });

  const applyRestore = async (payload: unknown) => {
    if (!isBackupPayload(payload)) throw new Error('This is not an OnlyBudget backup file.');
    await new Promise<void>((resolve, reject) => {
      Alert.alert('Replace everything on this phone?', `${payload.transactions.length} entries, ${payload.goals.length} goals and your categories will replace what is here now.`, [
        { text: 'Cancel', style: 'cancel', onPress: () => reject(new Error('Cancelled.')) },
        { text: 'Restore', style: 'destructive', onPress: () => resolve() },
      ]);
    });
    await restoreAll({ settings: { ...payload.settings, onboardingDone: true }, categories: payload.categories, transactions: payload.transactions, recurringRules: payload.recurringRules ?? [], goals: payload.goals, keywords: payload.keywords ?? [] });
    return `Restored ${payload.transactions.length} entries.`;
  };

  const restore = () => run('restore', async () => {
    const picked = await pickTextFile();
    if (!picked) return 'No file chosen.';
    const parsed = JSON.parse(picked.text) as unknown;
    if (isEncryptedBackupFile(parsed)) {
      setAskPass({ mode: 'decrypt', file: parsed });
      return 'Enter the passphrase to continue.';
    }
    return applyRestore(parsed);
  });

  const decryptAndRestore = () => run('restore', async () => {
    if (!askPass || askPass.mode !== 'decrypt') return '';
    let json: string;
    try {
      json = decryptBackup(askPass.file as Parameters<typeof decryptBackup>[0], pass);
    } catch {
      throw new Error('Wrong passphrase, or the file is damaged.');
    }
    setAskPass(null); setPass('');
    return applyRestore(JSON.parse(json));
  });

  return (
    <Screen>
      <Text variant="muted" style={{ marginTop: spacing.sm }}>
        Your data lives only on this phone. Export a copy any time, and restore it on a new phone. {settings.lastBackupAt ? `Last backup: ${settings.lastBackupAt.slice(0, 10)}.` : 'No backup yet.'}
      </Text>

      <SectionTitle>Export</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Button title="Entries as CSV" tone="secondary" onPress={exportCsv} loading={busy === 'csv'} />
        <Button title="Readable summary (text)" tone="secondary" onPress={exportSummary} loading={busy === 'summary'} />
      </Card>

      <SectionTitle>Backup</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Button title="Full backup (JSON)" onPress={exportBackup} loading={busy === 'backup'} />
        <Button title="Encrypted backup" onPress={() => { setPass(''); setPass2(''); setAskPass({ mode: 'encrypt' }); }} loading={busy === 'encrypted'} />
        <Text variant="small">The encrypted version is protected by a passphrase you choose, so it's safe to keep in any cloud drive.</Text>
      </Card>

      <SectionTitle>Restore</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Button title="Restore from a backup file" tone="secondary" onPress={restore} loading={busy === 'restore'} />
        <Text variant="small">Replaces everything on this phone with the backup. Works with plain and encrypted backups.</Text>
      </Card>

      {status ? <Text variant="body" color={status.startsWith("That didn't") ? colors.danger : colors.text} style={{ marginTop: spacing.lg }}>{status}</Text> : null}

      <Sheet visible={!!askPass} onClose={() => setAskPass(null)} title={askPass?.mode === 'encrypt' ? 'Choose a passphrase' : 'Enter the passphrase'}>
        <Field label="Passphrase" value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" autoFocus />
        {askPass?.mode === 'encrypt' ? <Field label="Repeat it" value={pass2} onChangeText={setPass2} secureTextEntry autoCapitalize="none" /> : null}
        <View>
          <Button title={askPass?.mode === 'encrypt' ? 'Create encrypted backup' : 'Unlock and restore'} onPress={askPass?.mode === 'encrypt' ? exportEncrypted : decryptAndRestore} loading={busy != null} />
        </View>
        {status && askPass ? <Text variant="small" color={colors.danger} style={{ marginTop: spacing.sm }}>{status}</Text> : null}
      </Sheet>
    </Screen>
  );
}
