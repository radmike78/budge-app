import type { Row, TextItem } from './types';

/** Items closer than this vertically (in PDF points) are on the same row. */
const ROW_TOLERANCE = 3.5;
/** A horizontal gap wider than this becomes a column break (two spaces). */
const COLUMN_GAP = 12;

/**
 * Groups positioned text items into visual rows: same page, same baseline
 * (within tolerance), sorted left to right. Rows are returned top to bottom.
 */
export function rowsFromItems(items: TextItem[]): Row[] {
  const byPage = new Map<number, TextItem[]>();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const list = byPage.get(it.page) ?? [];
    list.push(it);
    byPage.set(it.page, list);
  }
  const rows: Row[] = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const list = byPage.get(page)!.sort((a, b) => b.y - a.y || a.x - b.x);
    let current: TextItem[] = [];
    let currentY = NaN;
    const flush = () => {
      if (!current.length) return;
      const cells = current.sort((a, b) => a.x - b.x).map((c) => ({ x: c.x, str: c.str.trim() })).filter((c) => c.str);
      rows.push({ page, y: currentY, cells, text: joinCells(cells, current) });
      current = [];
    };
    for (const it of list) {
      if (Number.isNaN(currentY) || Math.abs(it.y - currentY) > ROW_TOLERANCE) {
        flush();
        currentY = it.y;
      }
      current.push(it);
    }
    flush();
  }
  return rows;
}

function joinCells(cells: { x: number; str: string }[], items: TextItem[]): string {
  const widths = new Map(items.map((i) => [i.x, i.w ?? i.str.length * 5]));
  let out = '';
  let lastEnd = -Infinity;
  for (const c of cells) {
    const gap = c.x - lastEnd;
    if (out) out += gap > COLUMN_GAP ? '  ' : ' ';
    out += c.str;
    lastEnd = c.x + (widths.get(c.x) ?? c.str.length * 5);
  }
  return out.replace(/[ \t]+$/g, '');
}

/** Rows from plain text (one visual line per text line), for pasted text or text-only extraction. */
export function rowsFromText(text: string): Row[] {
  const rows: Row[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let page = 1;
  lines.forEach((line, i) => {
    if (line.includes('\f')) page += 1;
    const cleaned = line.replace(/\f/g, '').replace(/\t/g, '  ').replace(/\s+$/g, '');
    if (!cleaned.trim()) return;
    // Two or more spaces mark a column boundary; single spaces are words.
    const cells: { x: number; str: string }[] = [];
    const re = /\S+(?: \S+)*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) cells.push({ x: m.index, str: m[0] });
    rows.push({ page, y: -i, cells, text: cleaned.trim() });
  });
  return rows;
}
