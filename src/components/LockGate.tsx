import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { spacing, useTheme } from '@/theme';
import { authenticate } from '@/lib/appLock';
import { useT } from '@/i18n';
import { Button, Text } from './ui';

/** Re-lock when the app has been in the background longer than this. */
const RELOCK_AFTER_MS = 30_000;

/**
 * Covers the app while locked and while it is in the app switcher, so amounts
 * never show in screenshots or the task list when the lock is on.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const t = useT();
  const enabled = useAppStore((s) => s.settings?.appLockEnabled ?? false);
  const ready = useAppStore((s) => s.ready);
  const [locked, setLocked] = useState(enabled);
  const [covered, setCovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await authenticate(t.unlockPrompt, t.cancel);
      if (ok) setLocked(false);
    } finally {
      setBusy(false);
    }
  }, [busy, t]);

  useEffect(() => {
    if (!enabled) { setLocked(false); setCovered(false); return; }
    setLocked(true);
  }, [enabled]);

  useEffect(() => {
    if (ready && enabled && locked) unlock().catch(() => {});
    // Only on first readiness / lock transitions; unlock is stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled, locked]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        setCovered(false);
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS) setLocked(true);
      } else {
        if (state === 'background' && backgroundedAt.current == null) backgroundedAt.current = Date.now();
        setCovered(true);
      }
    });
    return () => sub.remove();
  }, [enabled]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {enabled && (locked || covered) ? (
        <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.bg }]} accessibilityViewIsModal>
          <Text variant="heading">{t.lockedTitle}</Text>
          {locked ? <View style={{ marginTop: spacing.lg }}><Button title={t.unlock} onPress={unlock} loading={busy} /></View> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
