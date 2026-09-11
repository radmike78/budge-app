/**
 * Second layer of the active-content check, run on the document pdf.js has
 * parsed (so compressed object streams and encoded names are already decoded).
 * Shared by the web extractor; the WebView extractor page carries the same
 * logic inlined (scripts/build-pdf-extractor.js keeps them in step).
 */

/** The little of pdf.js we need, so this can be tested with plain objects. */
export interface InspectablePage {
  getJSActions(): Promise<unknown>;
  getAnnotations(): Promise<{ subtype?: string; url?: string; unsafeUrl?: string; file?: unknown; richMedia?: unknown }[]>;
}
export interface InspectableDocument {
  numPages: number;
  getJSActions(): Promise<unknown>;
  getAttachments(): Promise<Record<string, unknown> | null | undefined>;
  getPage(n: number): Promise<InspectablePage>;
}

const MEDIA_SUBTYPES = new Set(['FileAttachment', 'RichMedia', 'Screen', 'Movie', 'Sound', '3D']);
const SAFE_URL = /^(?:https?:|mailto:|tel:)/i;

/** Reasons the document must not be read, empty when it is plain text and links. */
export async function inspectPdfDocument(doc: InspectableDocument, maxPages = 300): Promise<string[]> {
  const reasons = new Set<string>();
  const docJs = await doc.getJSActions().catch(() => null);
  if (docJs && Object.keys(docJs as object).length) reasons.add('script');
  const attachments = await doc.getAttachments().catch(() => null);
  if (attachments && Object.keys(attachments).length) reasons.add('attachment');
  const pages = Math.min(doc.numPages, maxPages);
  for (let p = 1; p <= pages; p += 1) {
    const page = await doc.getPage(p);
    const js = await page.getJSActions().catch(() => null);
    if (js && Object.keys(js as object).length) reasons.add('script');
    const annots = await page.getAnnotations().catch(() => []);
    for (const a of annots) {
      if (a.subtype && MEDIA_SUBTYPES.has(a.subtype)) reasons.add(a.subtype === 'FileAttachment' ? 'attachment' : 'media');
      if (a.file || a.richMedia) reasons.add('attachment');
      // A link that is not a web or mail address is a Launch / GoToR / file action.
      const target = a.unsafeUrl ?? a.url;
      if (typeof target === 'string' && target && !SAFE_URL.test(target)) reasons.add('launch');
    }
    if (reasons.size >= 3) break;
  }
  return [...reasons];
}

/** Longest text a single item may carry; statements never need more. */
export const MAX_ITEM_CHARS = 500;
export const MAX_ITEMS = 200_000;
