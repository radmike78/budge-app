import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useLanguageCode, useT } from '@/i18n';
import { getPack } from '@/parser/packs';

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
  const t = useT();
  const language = useLanguageCode();
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
      'not-allowed': t.voiceErrors.notAllowed,
      'no-speech': t.voiceErrors.noSpeech,
      network: t.voiceErrors.network,
      'language-not-supported': t.voiceErrors.language,
      'service-not-allowed': t.voiceErrors.unavailable,
      'audio-capture': t.voiceErrors.audio,
    };
    if (event.error === 'aborted') {
      setState((s) => ({ ...s, listening: false }));
      return;
    }
    setState((s) => ({ ...s, listening: false, error: friendly[event.error] ?? t.voiceErrors.generic }));
  });

  const start = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setState((s) => ({ ...s, error: t.voiceErrors.notAllowed }));
      return;
    }
    let onDevice = false;
    try {
      onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    } catch {
      onDevice = false;
    }
    const pack = getPack(language);
    ExpoSpeechRecognitionModule.start({
      lang: pack.speechTag,
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: onDevice,
      addsPunctuation: false,
      iosTaskHint: 'dictation',
      contextualStrings: pack.contextualStrings,
    });
  }, [language, t]);

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

export async function triggerOfflineModelDownload(language = 'en'): Promise<string> {
  try {
    const result = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: getPack(language).speechTag });
    return result.status === 'download_success' ? 'Offline voice model is ready.' : `Model download: ${result.status}.`;
  } catch (e) {
    return `Could not start the download: ${(e as Error).message}`;
  }
}
