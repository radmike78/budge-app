import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const MIME: Record<string, string> = {
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  onlybudget: 'application/json',
};

/** Writes text to the cache directory and opens the system share sheet (a download on the web build). */
export async function shareTextFile(filename: string, contents: string): Promise<void> {
  if (Platform.OS === 'web') {
    const ext = filename.split('.').pop() ?? 'txt';
    const blob = new Blob([contents], { type: MIME[ext] ?? 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
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
  if (Platform.OS === 'web') {
    const webFile = (asset as { file?: Blob }).file;
    const text = webFile ? await webFile.text() : await (await fetch(asset.uri)).text();
    return { name: asset.name, text };
  }
  const file = new File(asset.uri);
  let text: string;
  try {
    text = await file.text();
  } finally {
    // The picker's cached copy is not kept.
    try { if (file.exists) file.delete(); } catch { /* best effort */ }
  }
  return { name: asset.name, text };
}

export function timestampForFilename(d = new Date()): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
