import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Optional app lock (OWASP MASVS-AUTH): the phone's own biometrics or passcode
 * guard the app when it opens or comes back from the background. No secret is
 * stored by the app; the OS answers yes or no.
 */
export async function canUseAppLock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const [hardware, enrolled, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    // A device passcode alone is enough; biometrics are a bonus.
    return level !== LocalAuthentication.SecurityLevel.NONE && (hardware ? enrolled || level > 0 : level > 0);
  } catch {
    return false;
  }
}

export async function authenticate(prompt: string, cancel: string): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: cancel, disableDeviceFallback: false });
    return res.success;
  } catch {
    return false;
  }
}
