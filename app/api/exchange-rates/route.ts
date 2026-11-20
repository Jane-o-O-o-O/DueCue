import { currencies, shift, validDate } from "@/lib/records";
import { json, owner } from "@/lib/server";
import type { ExchangeRates } from "@/app/renewal-forecast";

export const dynamic = "force-dynamic";

const quotes = currencies.filter((currency) => currency !== "USD");
const calendar = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" });
let cached: { date: string; expires: number; rates: ExchangeRates[] } | undefined;
let pending: Promise<ExchangeRates[]> | undefined;

async function fetchRates(date: string) {
  const from = shift(date, -7);
  const url = new URL("https://api.frankfurter.dev/v2/rates");
  url.search = new URLSearchParams({ base: "USD", quotes: quotes.join(","), from, to: date }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!response.ok) throw Error("Exchange rates unavailable");
  const observations: unknown = await response.json();
  if (!Array.isArray(observations)) throw Error("Invalid exchange rates response");

  const byDate = new Map<string, Record<string, number>>();
  for (const row of observations) {
    if (row?.base !== "USD" || !quotes.includes(row.quote) || typeof row.date !== "string" ||
      !validDate(row.date) || row.date < from || row.date > date ||
      typeof row.rate !== "number" || !Number.isFinite(row.rate) || row.rate <= 0) continue;
    const rates = byDate.get(row.date) ?? { USD: 1 };
    rates[row.quote] = row.rate;
    byDate.set(row.date, rates);
  }
  if (!byDate.size) throw Error("No recent exchange rates");
  return Array.from(byDate, ([date, rates]) => ({ date, rates }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function GET(req: Request) {
  if (!owner(req)) return json({ error: "请先登录。" }, 401);
  const date = shift(calendar.format(new Date()), -1);
  if (cached?.date === date && cached.expires > Date.now()) return json(cached.rates);

  pending ??= fetchRates(date).then((rates) => {
    cached = { date, expires: Date.now() + 30 * 60_000, rates };
    return rates;
  }).catch(() => {
    const rates = (cached?.rates ?? []).filter((row) => row.date <= date && row.date >= shift(date, -7));
    cached = { date, expires: Date.now() + 60_000, rates };
    return rates;
  }).finally(() => { pending = undefined; });
  return json(await pending);
}
