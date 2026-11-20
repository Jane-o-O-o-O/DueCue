import { money, shift, validDate, type Entry } from "./records";
import { atOrAfter, intervalMonths } from "./recurrence";

function escapeText(value: string) {
  return value.replaceAll("\\", "\\\\").replace(/\r\n|\r|\n/g, "\\n")
    .replaceAll(";", "\\;").replaceAll(",", "\\,");
}

const calendarDate = (date: string) => date.replaceAll("-", "");
const encoder = new TextEncoder();

function foldLine(line: string) {
  let result = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += char;
    bytes += size;
  }
  return result;
}

export function calendarFile(entry: Entry, today: string) {
  if (!validDate(entry.date)) return null;
  const start = atOrAfter(entry, today).date;
  const interval = intervalMonths(entry);
  const day = Number(entry.date.slice(8));
  const repeatDay = day === 31 ? "-1" : day > 28 ? `${day},-1;BYSETPOS=1` : String(day);
  const name = escapeText(entry.name + " · " + entry.kind);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DueCue//Wallet//ZH",
    "BEGIN:VEVENT",
    // File imports may retain an earlier series. Give each changed schedule its own UID.
    `UID:${entry.id}-${calendarDate(entry.date)}-${interval}-${entry.remind}@youqi`,
    "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""),
    "DTSTART;VALUE=DATE:" + calendarDate(start),
    "DTEND;VALUE=DATE:" + calendarDate(shift(start, 1)),
    "SUMMARY:" + name,
    "DESCRIPTION:" + escapeText([money(entry), entry.note].filter(Boolean).join(" · ")),
    ...(interval ? [`RRULE:FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${repeatDay}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:" + (entry.remind ? `-P${entry.remind}D` : "PT0S"),
    "ACTION:DISPLAY",
    "DESCRIPTION:" + name,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return {
    start,
    filename: `${entry.name}-${start}.ics`,
    contents: lines.map(foldLine).join("\r\n") + "\r\n",
  };
}
