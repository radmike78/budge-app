import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export interface VoiceState {
  available: boolean;
  onDevice: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
}

/**
 * Wraps the platform speech recognizer. Prefers on-device recognition when the
 * device supports it (offline, nothing leaves the phone). Calls `onFinal` once
 * with the finished transcript.
 */
export function useVoiceInput(onFinal: (text: string) => void) {
  const [state, setState] = useState<VoiceState>({ available: false, onDevice: false, listening: false, transcript: '', error: null });
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;
  const deliveredRef = useRef(false);
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    let available = false;
    let onDevice = false;
    try {
      available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    } catch {
      available = false;
    }
    setState((s) => ({ ...s, available, onDevice }));
  }, []);

  useSpeechRecognitionEvent('start', () => {
    deliveredRef.current = false;
    lastTranscriptRef.current = '';
    setState((s) => ({ ...s, listening: true, transcript: '', error: null }));
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    lastTranscriptRef.current = text;
    setState((s) => ({ ...s, transcript: text }));
    if (event.isFinal && text.trim() && !deliveredRef.current) {
      deliveredRef.current = true;
      finalRef.current(text.trim());
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setState((s) => ({ ...s, listening: false }));
    // Some recognizers end without an isFinal result; deliver what we have.
    const text = lastTranscriptRef.current.trim();
    if (text && !deliveredRef.current) {
      deliveredRef.current = true;
      finalRef.current(text);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    const friendly: Record<string, string> = {
      'not-allowed': 'Microphone access is off. You can turn it on in Settings, or just type.',
      'no-speech': "I didn't catch anything. Try again, or type it.",
      network: 'Voice needs a connection on this device. You can still type.',
      'language-not-supported': 'Voice is not available for this language. You can still type.',
      'service-not-allowed': 'Voice recognition is not available right now. You can still type.',
      'audio-capture': 'Could not access the microphone. You can still type.',
    };
    if (event.error === 'aborted') {
      setState((s) => ({ ...s, listening: false }));
      return;
    }
    setState((s) => ({ ...s, listening: false, error: friendly[event.error] ?? 'Voice did not work that time. You can still type.' }));
  });

  const start = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setState((s) => ({ ...s, error: 'Microphone access is off. You can turn it on in Settings, or just type.' }));
      return;
    }
    let onDevice = false;
    try {
      onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    } catch {
      onDevice = false;
    }
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: onDevice,
      addsPunctuation: false,
      iosTaskHint: 'dictation',
      contextualStrings: ['dollars', 'bucks', 'groceries', 'rent', 'paycheck', 'goal', 'Netflix', 'Uber'],
    });
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const cancel = useCallback(() => {
    deliveredRef.current = true; // suppress delivery
    ExpoSpeechRecognitionModule.abort();
    setState((s) => ({ ...s, listening: false, transcript: '' }));
  }, []);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  return { ...state, start, stop, cancel, clearError };
}

export async function triggerOfflineModelDownload(): Promise<string> {
  try {
    const result = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: 'en-US' });
    return result.status === 'download_success' ? 'Offline voice model is ready.' : `Model download: ${result.status}.`;
  } catch (e) {
    return `Could not start the download: ${(e as Error).message}`;
  }
}
