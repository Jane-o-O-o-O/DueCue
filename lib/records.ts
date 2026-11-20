export const paymentLabels = { original: "原币金额", settlement: "结算金额", fee: "交易费" } as const;
export type PaymentPart = keyof typeof paymentLabels;
export type Payment = {
  date: string;
} & Partial<Record<PaymentPart, { amount: string; currency: string }>>;
export type Entry = {
  id: string;
  name: string;
  kind: string;
  cycle: string;
  amount: string;
  currency: string;
  date: string;
  note: string;
  remind: number;
  payment?: Payment;
};
export const kinds = ["自动续费", "会员到期", "账单还款", "提醒复查", "已扣款"];
export const cycles = ["每月", "每年", "每季", "单次", "待确认"];
export const currencies = ["CNY", "USD", "HKD", "EUR", "GBP", "JPY", "PHP", "TWD", "SGD", "AUD", "CAD", "KRW", "INR", "MYR", "THB"];
export const symbols: Record<string, string> = {
  CNY: "¥",
  USD: "US$",
  HKD: "HK$",
  EUR: "€",
  GBP: "£",
  JPY: "JP¥",
  PHP: "₱",
};
export const iso = (d: Date) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
export function dateFrom(s: string) {
  return new Date(s + "T12:00:00");
}
export function shift(s: string, n: number) {
  const d = dateFrom(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function validDate(s: unknown) {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    iso(dateFrom(s)) === s
  );
}
export function normalize(v: any): Entry | null {
  if (
    !v ||
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.length > 80 ||
    !kinds.includes(v.kind) ||
    !cycles.includes(v.cycle) ||
    !(currencies.includes(v.currency) || (v.currency === "" && v.amount === ""))
  )
    return null;
  if (
    typeof v.amount !== "string" ||
    (v.amount !== "" && !/^\d{1,8}(\.\d{1,2})?$/.test(v.amount)) ||
    typeof v.date !== "string" ||
    (v.date && !validDate(v.date)) ||
    typeof v.note !== "string" ||
    v.note.length > 600 ||
    ![0, 1, 3, 7].includes(v.remind)
  )
    return null;
  if (typeof v.id !== "string" || !/^[-a-zA-Z0-9]{1,64}$/.test(v.id))
    return null;
  let payment: Payment | undefined;
  if (v.kind === "已扣款") {
    if (v.date || (v.payment != null && typeof v.payment !== "object")) return null;
    const paidDate = v.payment?.date ?? "";
    if (paidDate !== "" && !validDate(paidDate)) return null;
    payment = { date: paidDate };
    for (const key of Object.keys(paymentLabels) as PaymentPart[]) {
      const part = v.payment?.[key];
      if (!part || part.amount === "") continue;
      if (typeof part.amount !== "string" || !/^\d{1,8}(?:\.\d{1,2})?$/.test(part.amount) || !currencies.includes(part.currency)) return null;
      payment[key] = { amount: part.amount, currency: part.currency };
    }
  }
  return {
    ...(payment && { payment }),
    id: v.id,
    name: v.name.trim(),
    kind: v.kind,
    cycle: v.cycle,
    currency: v.currency,
    amount: v.amount,
    date: v.date,
    note: v.note,
    remind: v.remind,
  };
}
export function blank(): Entry {
  return {
    id: crypto.randomUUID(),
    name: "",
    kind: "自动续费",
    cycle: "每月",
    amount: "",
    currency: "CNY",
    date: "",
    note: "",
    remind: 1,
  };
}
export function examples(today: string): Entry[] {
  return [
    ["icloud", "iCloud+", "6.00", "CNY", 12, "每月", "自动续费"],
    ["chatgpt", "ChatGPT Plus", "20.00", "USD", 9, "每月", "自动续费"],
    ["mango", "芒果 TV", "19.00", "CNY", 7, "每月", "自动续费"],
    ["netflix", "Netflix", "13.99", "USD", 15, "每月", "自动续费"],
    ["tencent", "腾讯视频", "25.00", "CNY", 3, "每月", "自动续费"],
    ["spotify", "Spotify Premium", "38.00", "HKD", 18, "每月", "自动续费"],
    ["unicom", "中国联通", "39.00", "CNY", 20, "每月", "账单还款"],
    ["disney", "Disney+", "9.99", "USD", 24, "每月", "自动续费"],
  ].map(([id, name, amount, currency, n, cycle, kind]) => ({
    id: String(id),
    name: String(name),
    amount: String(amount),
    currency: String(currency),
    date: shift(today, Number(n)),
    cycle: String(cycle),
    kind: String(kind),
    remind: 1,
    note: "",
  }));
}
export function daysLeft(date: string, today: string) {
  return Math.round(
    (Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) /
      86400000,
  );
}
export function money(e: Pick<Entry, "amount" | "currency">) {
  return e.amount === ""
    ? "金额待确认"
    : (symbols[e.currency] || e.currency) + Number(e.amount).toFixed(2);
}
