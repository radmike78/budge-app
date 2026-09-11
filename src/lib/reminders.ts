import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const REMINDER_ID = 'onlybudget-daily-reminder';

/**
 * One optional, gentle daily reminder. Never a badge, never a streak.
 * Returns false if permission was not granted.
 */
/** Scheduled local notifications are a native-only feature; the web build reports false. */
export async function scheduleDailyReminder(hour: number, text: { title: string; body: string } = { title: 'Anything to log today?', body: 'A quick "spent 12 on lunch" keeps the picture honest.' }): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const perm = await Notifications.getPermissionsAsync();
  let granted = perm.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Daily reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: undefined,
      showBadge: false,
    });
  }

  await cancelDailyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: text.title,
      body: text.body,
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
      channelId: Platform.OS === 'android' ? 'reminders' : undefined,
    },
  });
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    // nothing scheduled
  }
}

export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// ---------- spoken reminders ----------

import type { Reminder } from '@/types';

export type PermissionState = 'granted' | 'denied' | 'unsupported';

/** Asks once if needed. Web has no scheduled local notifications, so it reports unsupported. */
export async function ensureNotificationPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'unsupported';
  const perm = await Notifications.getPermissionsAsync();
  if (perm.granted) return 'granted';
  if (!perm.canAskAgain && perm.status === 'denied') return 'denied';
  const req = await Notifications.requestPermissionsAsync();
  return req.granted ? 'granted' : 'denied';
}

export async function notificationPermissionState(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'unsupported';
  const perm = await Notifications.getPermissionsAsync();
  return perm.granted ? 'granted' : 'denied';
}

export function openNotificationSettings(): void {
  if (Platform.OS === 'web') return;
  Linking.openSettings().catch(() => {});
}

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map((n) => Number(n));
  return { hour: Number.isFinite(h) ? h : 9, minute: Number.isFinite(m) ? m : 0 };
}

/** Local Date for "date at time". */
export function reminderDateTime(date: string, time: string): Date {
  const { hour, minute } = parseTime(time);
  const [y, mo, d] = date.split('-').map((n) => Number(n));
  return new Date(y, mo - 1, d, hour, minute, 0, 0);
}

/** The next time this reminder fires after `now`, or null for a one-off already in the past. */
export function nextOccurrence(rem: Reminder, now: Date = new Date()): Date | null {
  let next = reminderDateTime(rem.date, rem.time);
  if (rem.repeat === 'none') return next > now ? next : null;
  let guard = 0;
  while (next <= now && guard < 1000) {
    if (rem.repeat === 'daily') next = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1, next.getHours(), next.getMinutes());
    else if (rem.repeat === 'weekly') next = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 7, next.getHours(), next.getMinutes());
    else {
      const anchor = reminderDateTime(rem.date, rem.time).getDate();
      const m = next.getMonth() + 1;
      const y = next.getFullYear() + (m > 11 ? 1 : 0);
      const mo = m % 12;
      const last = new Date(y, mo + 1, 0).getDate();
      next = new Date(y, mo, Math.min(anchor, last), next.getHours(), next.getMinutes());
    }
    guard += 1;
  }
  return next;
}

async function ensureChannel(): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: undefined,
    showBadge: false,
  });
  return 'reminders';
}

/**
 * Schedules the notification for a reminder. Returns the notification id, or null
 * when notifications are not allowed (the reminder is still kept and can be armed later).
 */
export async function scheduleReminderNotification(rem: Reminder, title: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const state = await ensureNotificationPermission();
  if (state !== 'granted') return null;
  const channelId = await ensureChannel();
  const { hour, minute } = parseTime(rem.time);
  const content = { title, body: rem.text, sound: false as const };
  const identifier = `onlybudget-reminder-${rem.id}`;
  await cancelReminderNotification(identifier);

  if (rem.repeat === 'daily') {
    await Notifications.scheduleNotificationAsync({ identifier, content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId } });
    return identifier;
  }
  if (rem.repeat === 'weekly') {
    const weekday = reminderDateTime(rem.date, rem.time).getDay() + 1; // expo: 1 = Sunday
    await Notifications.scheduleNotificationAsync({ identifier, content, trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId } });
    return identifier;
  }
  // One-off and monthly both use a concrete date; monthly is re-armed on the next app launch.
  const at = nextOccurrence(rem);
  if (!at) return null;
  await Notifications.scheduleNotificationAsync({ identifier, content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId } });
  return identifier;
}

export async function cancelReminderNotification(notificationId: string | null | undefined): Promise<void> {
  if (Platform.OS === 'web' || !notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // nothing scheduled
  }
}
