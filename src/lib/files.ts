import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const MIME: Record<string, string> = {
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  onlybudget: 'application/json',
};

/** Writes text to the cache directory and opens the system share sheet. */
export async function shareTextFile(filename: string, contents: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(contents);
  const ext = filename.split('.').pop() ?? 'txt';
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: MIME[ext] ?? 'text/plain', dialogTitle: filename, UTI: ext === 'json' || ext === 'onlybudget' ? 'public.json' : 'public.plain-text' });
}

/** Lets the user pick a backup file and returns its text, or null if cancelled. */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  const text = await file.text();
  return { name: asset.name, text };
}

export function timestampForFilename(d = new Date()): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
