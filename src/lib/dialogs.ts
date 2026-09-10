import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirm/notify. React Native's Alert is a no-op on web, so
 * the web build uses the browser's own dialogs.
 */
export function confirmDialog(title: string, message: string | undefined, opts: { confirmText: string; cancelText: string; destructive?: boolean }): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(text) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: opts.cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: opts.confirmText, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
