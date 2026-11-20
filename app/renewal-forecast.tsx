"use client";

import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { brands, identifyBrand } from "../public/brands.js";
import { money, shift, type Entry } from "@/lib/records";
import { occurrencesBetween } from "@/lib/recurrence";

export type ForecastCurrency = "CNY" | "USD";
export type ForecastOptions = { days: number; currency: ForecastCurrency };
export type ExchangeRates = { date: string; rates: Record<string, number> };
export const defaultForecastDays = 4;
const maximumForecastDays = 365;

export function parseForecastDays(value: string | null) {
  if (!value || !/^\d{1,3}$/.test(value)) return undefined;
  const days = Number(value);
  return days >= 1 && days <= maximumForecastDays ? days : undefined;
}

export function ForecastCurrencyChoice({ currency, onChange, label }: {
  currency: ForecastCurrency;
  onChange: (currency: ForecastCurrency) => void;
  label: string;
}) {
  return (
    <div className="currencyChoice" role="group" aria-label={label}>
      {([["CNY", "人民币"], ["USD", "美元"]] as const).map(([code, name]) => (
        <button key={code} type="button" aria-pressed={currency === code} onClick={() => onChange(code)}>
          {name}
        </button>
      ))}
    </div>
  );
}

export function ForecastSettings({ current, onSave, close }: {
  current: ForecastOptions;
  onSave: (options: ForecastOptions) => void;
  close: () => void;
}) {
  const [value, setValue] = useState(String(current.days));
  const [currency, setCurrency] = useState(current.currency);
  const days = parseForecastDays(value);
  const invalid = value !== "" && days === undefined;
  return (
    <section className="sheet forecastSheet" role="dialog" aria-modal="true" aria-labelledby="forecastSettingsTitle">
      <div className="sheetHead">
        <h2 id="forecastSettingsTitle">续费设置</h2>
        <button type="button" className="iconBtn" aria-label="关闭" onClick={close}><X size={19} /></button>
      </div>
      <form className="forecastForm" onSubmit={(event) => {
        event.preventDefault();
        if (days === undefined) return;
        onSave({ days, currency });
      }}>
        <div>
          <label htmlFor="forecastDays">统计天数</label>
          <div className="forecastPresets" role="group" aria-label="常用天数">
            {[4, 7, 14, 30].map((preset) => (
              <button key={preset} type="button" aria-pressed={days === preset} onClick={() => setValue(String(preset))}>
                {preset} 天
              </button>
            ))}
          </div>
          <input id="forecastDays" type="number" inputMode="numeric" min={1} max={maximumForecastDays}
            step={1} required value={value} onChange={(event) => setValue(event.target.value)}
            placeholder={`1–${maximumForecastDays} 天`} aria-invalid={invalid || undefined}
            aria-describedby={invalid ? "forecastDaysError" : undefined} />
          {invalid && <small id="forecastDaysError">请输入 1–{maximumForecastDays} 天</small>}
        </div>
        <div className="forecastCurrencyRow">
          <span>折算币种</span>
          <ForecastCurrencyChoice currency={currency} onChange={setCurrency} label="折算币种" />
        </div>
        <div className="actions">
          <button type="button" className="soft" onClick={close}>取消</button>
          <button className="primary" type="submit" disabled={days === undefined}>应用</button>
        </div>
      </form>
    </section>
  );
}

export function RenewalForecast({ entries, today, days, currency, onSettings }: ForecastOptions & {
  entries: Entry[];
  today: string;
  onSettings: (button: HTMLButtonElement) => void;
}) {
  const end = shift(today, days - 1);
  const renewals = entries.filter((e) => e.kind === "自动续费" && e.amount && e.currency)
    .flatMap((e) => occurrencesBetween(e, today, end));
  const needsRates = renewals.some((entry) => entry.currency !== currency && Number(entry.amount) > 0);
  const [history, setHistory] = useState<ExchangeRates[]>();

  useEffect(() => {
    if (!needsRates) return;
    const request = new AbortController();
    let loading = false;
    async function load() {
      if (loading || document.visibilityState !== "visible") return;
      loading = true;
      try {
        const response = await fetch("/api/exchange-rates", { cache: "no-store", signal: request.signal });
        if (!response.ok) throw Error("Exchange rates unavailable");
        const values: unknown = await response.json();
        if (!Array.isArray(values)) throw Error("Invalid exchange rates response");
        if (!request.signal.aborted) setHistory(values);
      } catch {
        if (!request.signal.aborted) setHistory((previous) => previous ?? []);
      } finally {
        loading = false;
      }
    }
    void load();
    document.addEventListener("visibilitychange", load);
    window.addEventListener("online", load);
    return () => {
      request.abort();
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("online", load);
    };
  }, [needsRates, today]);

  const oldest = shift(today, -8);
  const snapshot = needsRates ? history?.find(({ date, rates }) =>
    date >= oldest && rates[currency] > 0 && renewals.every((entry) =>
      entry.currency === currency || Number(entry.amount) === 0 || rates[entry.currency] > 0)) : undefined;
  const ready = !needsRates || !!snapshot;
  const shares = ready ? renewals.map((entry) => {
    const amount = Number(entry.amount);
    return {
      entry,
      amount: entry.currency === currency || amount === 0 ? amount :
        amount * snapshot!.rates[currency] / snapshot!.rates[entry.currency],
    };
  }) : [];
  const total = shares.reduce((acc, share) => acc + share.amount, 0);
  const breakdown = new Map<string, number>();
  if (!ready && history) {
    for (const entry of renewals) {
      breakdown.set(entry.currency, (breakdown.get(entry.currency) ?? 0) + Number(entry.amount));
    }
  }

  return (
    <button type="button" className="forecast" aria-haspopup="dialog"
      onClick={(event) => onSettings(event.currentTarget)}>
      <span>
        {days} 天内预计续费
        {snapshot && <small>按 {Number(snapshot.date.slice(5, 7))}月{Number(snapshot.date.slice(8))}日汇率估算</small>}
        {needsRates && !history && <small>正在获取汇率…</small>}
      </span>
      <span className="forecastValue">
        <strong aria-live="polite">{ready ? money({ amount: String(total), currency }) : "—"}</strong>
        <ChevronRight size={17} aria-hidden="true" />
      </span>
      {breakdown.size > 0 && <small className="forecastBreakdown">
        汇率暂不可用 · {Array.from(breakdown, ([currency, amount]) => money({ amount: String(amount), currency })).join(" · ")}
      </small>}
      {total > 0 && <span className="spendBar" aria-hidden="true">
        {shares.filter(({ amount }) => amount > 0).map(({ entry, amount }) => (
          <i key={entry.id + entry.date} style={{ flexGrow: amount, background: (brands as any)[identifyBrand(entry.name)].color }} />
        ))}
      </span>}
    </button>
  );
}
