import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { bytesToBase64, MAX_PDF_PAGES, PdfBlockedError, PdfEncryptedError } from '@/lib/pdfBytes';
import { MAX_ITEM_CHARS, MAX_ITEMS } from '@/lib/pdfInspect';
import type { TextItem } from '@/statements';

export interface PdfExtractorHandle {
  extract: (bytes: Uint8Array) => Promise<{ items: TextItem[]; numPages: number }>;
}

/**
 * Runs pdf.js inside a hidden, sandboxed WebView (no network, no file access;
 * its own CSP forbids everything but the inlined script) and returns every text
 * item with its position. The PDF goes in as base64 chunks and never leaves the phone.
 */
export const PdfExtractor = forwardRef<PdfExtractorHandle, object>(function PdfExtractor(_props, ref) {
  const web = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const pending = useRef<{ resolve: (v: { items: TextItem[]; numPages: number }) => void; reject: (e: Error) => void } | null>(null);
  const readyResolvers = useRef<(() => void)[]>([]);
  const ready = useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const asset = Asset.fromModule(require('../../assets/pdf/extractor.html'));
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      const text = await new File(uri).text();
      if (!cancelled) setHtml(text);
    })().catch(() => { if (!cancelled) setHtml(''); });
    return () => { cancelled = true; };
  }, []);

  const waitReady = () => new Promise<void>((resolve) => { if (ready.current) resolve(); else readyResolvers.current.push(resolve); });

  useImperativeHandle(ref, () => ({
    extract: async (bytes) => {
      if (html === '') throw new Error('extractor unavailable');
      await waitReady();
      if (pending.current) throw new Error('busy');
      const b64 = bytesToBase64(bytes);
      const CHUNK = 256 * 1024;
      for (let i = 0; i < b64.length; i += CHUNK) {
        web.current?.injectJavaScript(`window.__ob.addChunk(${JSON.stringify(b64.slice(i, i + CHUNK))}); true;`);
      }
      return new Promise((resolve, reject) => {
        pending.current = { resolve, reject };
        const timer = setTimeout(() => { if (pending.current) { pending.current = null; reject(new Error('timeout')); } }, 120_000);
        const done = pending.current;
        pending.current = {
          resolve: (v) => { clearTimeout(timer); done.resolve(v); },
          reject: (e) => { clearTimeout(timer); done.reject(e); },
        };
        web.current?.injectJavaScript(`window.__ob.run(${MAX_PDF_PAGES}); true;`);
      });
    },
  }), [html]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; items?: TextItem[]; numPages?: number; message?: string; code?: string; reasons?: string[] };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      ready.current = true;
      readyResolvers.current.splice(0).forEach((r) => r());
      return;
    }
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    if (msg.type === 'done' && Array.isArray(msg.items)) {
      const items = msg.items.slice(0, MAX_ITEMS).filter((it) => typeof it.str === 'string' && Number.isFinite(it.x) && Number.isFinite(it.y)).map((it) => ({ ...it, str: it.str.slice(0, MAX_ITEM_CHARS) }));
      p.resolve({ items, numPages: msg.numPages ?? 0 });
    } else if (msg.type === 'blocked') p.reject(new PdfBlockedError(Array.isArray(msg.reasons) ? msg.reasons.map(String) : []));
    else if (msg.code === 'password') p.reject(new PdfEncryptedError());
    else p.reject(new Error('extract failed'));
  };

  if (!html) return null;
  return (
    <View style={{ width: 1, height: 1, opacity: 0, position: 'absolute' }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView
        ref={web}
        source={{ html }}
        originWhitelist={['about:blank']}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith('about:') || req.url.startsWith('data:text/html')}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        allowsInlineMediaPlayback={false}
        cacheEnabled={false}
        incognito
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        mixedContentMode="never"
        androidLayerType="software"
      />
    </View>
  );
});
