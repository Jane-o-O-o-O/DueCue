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
};
export const kinds = ["自动续费", "会员到期", "账单还款", "提醒复查"];
export const cycles = ["每月", "每年", "每季", "单次"];
export const currencies = ["CNY", "USD", "HKD", "EUR", "GBP", "JPY"];
export const symbols: Record<string, string> = {
  CNY: "¥",
  USD: "US$",
  HKD: "HK$",
  EUR: "€",
  GBP: "£",
  JPY: "JP¥",
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
    !currencies.includes(v.currency)
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
  return {
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
export function money(e: Entry) {
  return e.amount === ""
    ? "金额待确认"
    : (symbols[e.currency] || e.currency) + Number(e.amount).toFixed(2);
}
export function calendarFile(e: Entry) {
  const esc = (s: string) =>
    s
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Youqi//Wallet//ZH",
    "BEGIN:VEVENT",
    "UID:" + e.id + "@youqi",
    "DTSTAMP:" +
      new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, ""),
    "DTSTART;VALUE=DATE:" + e.date.replaceAll("-", ""),
    "DTEND;VALUE=DATE:" + shift(e.date, 1).replaceAll("-", ""),
    "SUMMARY:" + esc(e.name + " · " + e.kind),
    "DESCRIPTION:" + esc([money(e), e.note].filter(Boolean).join(" · ")),
    ...repeatRule(e),
    "BEGIN:VALARM",
    "TRIGGER:-P" + e.remind + "D",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + esc(e.name + " · " + e.kind),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

function repeatRule(e: Entry) {
  const n: Record<string, number> = { 每月: 1, 每季: 3, 每年: 12 };
  if (!n[e.cycle]) return [];
  const day = Number(e.date.slice(8));
  return [
    "RRULE:FREQ=MONTHLY;INTERVAL=" +
      n[e.cycle] +
      ";BYMONTHDAY=" +
      day +
      ",-1;BYSETPOS=1",
  ];
}
