import * as SecureStore from 'expo-secure-store';

const API_KEY = 'plainly.anthropic_api_key';

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(API_KEY);
  } catch {
    return null;
  }
}

export async function setApiKey(key: string | null): Promise<void> {
  if (!key) {
    await SecureStore.deleteItemAsync(API_KEY);
  } else {
    await SecureStore.setItemAsync(API_KEY, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
}
