import React, { forwardRef, useImperativeHandle } from 'react';
import { MAX_PDF_PAGES, PdfBlockedError, PdfEncryptedError } from '@/lib/pdfBytes';
import { inspectPdfDocument, MAX_ITEM_CHARS, MAX_ITEMS } from '@/lib/pdfInspect';
import type { TextItem } from '@/statements';

export interface PdfExtractorHandle {
  extract: (bytes: Uint8Array) => Promise<{ items: TextItem[]; numPages: number }>;
}

type PdfJs = typeof import('pdfjs-dist');
let libPromise: Promise<PdfJs> | null = null;
function lib(): Promise<PdfJs> {
  if (!libPromise) {
    libPromise = import('pdfjs-dist').then((m) => {
      // Same-origin worker file, copied next to the app by the build (CSP: worker-src 'self').
      m.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return m;
    });
  }
  return libPromise;
}

/** Web build: pdf.js runs in the page's own worker; nothing is uploaded anywhere. */
export const PdfExtractor = forwardRef<PdfExtractorHandle, object>(function PdfExtractor(_props, ref) {
  useImperativeHandle(ref, () => ({
    extract: async (bytes) => {
      const pdfjs = await lib();
      let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
      try {
        doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false, enableXfa: false }).promise;
      } catch (e) {
        if (e instanceof Error && e.name === 'PasswordException') throw new PdfEncryptedError();
        throw e;
      }
      const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
      const reasons = await inspectPdfDocument(doc, pages);
      if (reasons.length) { await doc.destroy(); throw new PdfBlockedError(reasons); }
      const items: TextItem[] = [];
      outer: for (let p = 1; p <= pages; p += 1) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        for (const it of tc.items) {
          if (!('str' in it) || !it.str) continue;
          items.push({ str: String(it.str).slice(0, MAX_ITEM_CHARS), x: Math.round(it.transform[4] * 10) / 10, y: Math.round(it.transform[5] * 10) / 10, w: Math.round(it.width * 10) / 10, page: p });
          if (items.length >= MAX_ITEMS) break outer;
        }
      }
      await doc.destroy();
      return { items, numPages: doc.numPages };
    },
  }), []);
  return null;
});
