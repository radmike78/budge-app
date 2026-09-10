import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_KEY = 'onlybudget.anthropic_api_key';

/**
 * The optional API key lives in the phone's secure storage. On the web build
 * there is no secure enclave, so it falls back to localStorage (same origin,
 * same device, never sent anywhere by us).
 */
export async function getApiKey(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(API_KEY) : null;
    return await SecureStore.getItemAsync(API_KEY);
  } catch {
    return null;
  }
}

export async function setApiKey(key: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return;
    if (key) localStorage.setItem(API_KEY, key);
    else localStorage.removeItem(API_KEY);
    return;
  }
  if (!key) {
    await SecureStore.deleteItemAsync(API_KEY);
  } else {
    await SecureStore.setItemAsync(API_KEY, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
}
