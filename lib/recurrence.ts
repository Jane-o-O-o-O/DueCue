import { dateFrom, iso, shift, Entry } from "./records";
const monthsByCycle: Record<string, number> = { 每月: 1, 每季: 3, 每年: 12 };
export function intervalMonths(e: Entry) {
  return monthsByCycle[e.cycle] || 0;
}
export function atOrAfter(e: Entry, from: string): Entry {
  const step = intervalMonths(e);
  if (!step || !e.date || e.date >= from) return e;
  const anchor = dateFrom(e.date),
    lo = dateFrom(from);
  const diff =
    (lo.getFullYear() - anchor.getFullYear()) * 12 +
    lo.getMonth() -
    anchor.getMonth();
  let n = Math.max(0, Math.floor(diff / step));
  function occurrence(j: number) {
    const last = new Date(
      anchor.getFullYear(),
      anchor.getMonth() + j * step + 1,
      0,
      12,
    );
    last.setDate(Math.min(last.getDate(), anchor.getDate()));
    return iso(last);
  }
  let day = occurrence(n);
  if (day < from) day = occurrence(n + 1);
  return { ...e, date: day };
}

export function occurrencesBetween(entry: Entry, from: string, until: string) {
  const events: Entry[] = [];
  let next = atOrAfter(entry, from);
  while (next.date && next.date >= from && next.date <= until) {
    events.push(next);
    if (!intervalMonths(entry)) break;
    next = atOrAfter(entry, shift(next.date, 1));
  }
  return events;
}
