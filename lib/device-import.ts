import { brands, identifyBrand } from "../public/brands.js";
import { shift, validDate } from "./records";

const renewal =
  /下次(?:扣款|扣费|续费)|续费(?:金额|价格|日期)|自动续费|renewal|next (?:charge|payment)/i;
const promotion = /原价|首月|优惠券|立减|折前|参考价|划线价|list price/i;
const dateLabel =
  /到期|有效期至|截止|续费|扣款|扣费|还款|复查|expires?|renewal|due/i;
const chineseDigit = "零一二三四五六七八九";
function dayCount(token: string) {
  if (/^\d+$/.test(token)) return Number(token);
  const s = token.replaceAll("两", "二");
  if (s.includes("十")) {
    const [tens, units] = s.split("十");
    return (
      10 * (tens ? chineseDigit.indexOf(tens) : 1) +
      (units ? chineseDigit.indexOf(units) : 0)
    );
  }
  return chineseDigit.indexOf(s);
}
function readDate(text: string, base: string) {
  const days = new Set<string>();
  const relevant = text
    .split("\n")
    .filter((line) => !/(购买时间|开通时间|下单时间|订单日期)/.test(line));
  for (const line of relevant) {
    for (const m of line.matchAll(
      /\b(20\d{2})\s*[-./年]\s*(\d{1,2})\s*[-./月]\s*(\d{1,2})(?!\d)/g,
    )) {
      const candidate =
        m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
      if (validDate(candidate)) days.add(candidate);
    }
  }
  if (validDate(base)) {
    for (const m of text.matchAll(
      /(?:还(?:有|剩)|剩余|剩下|距(?:离)?到期(?:还)?有?)\s*(\d{1,4}|[零一二两三四五六七八九十]{1,3})\s*天/g,
    )) {
      const count = dayCount(m[1]);
      if (count >= 0 && count <= 3650) days.add(shift(base, count));
    }
  }
  return days.size === 1 ? [...days][0] : "";
}
function prices(line: string) {
  const tokens =
    /(?:((?:US\$|HK\$|JP¥|CNY|RMB|USD|HKD|EUR|GBP|JPY|人民币|港币|美元|日元|欧元|英镑|¥|\$|€|£))\s*([0-9]{1,8}(?:\.[0-9]{1,2})?)(?![.\dA-Za-z])|(?<![.\dA-Za-z])([0-9]{1,8}(?:\.[0-9]{1,2})?)\s*(人民币|美元|港币|港元|日元|欧元|英镑|元|CNY|RMB|USD|HKD|EUR|GBP|JPY))/gi;
  const currencies: Record<string, string> = {
    CNY: "CNY",
    RMB: "CNY",
    人民币: "CNY",
    元: "CNY",
    "¥": "CNY",
    US$: "USD",
    USD: "USD",
    美元: "USD",
    HK$: "HKD",
    HKD: "HKD",
    港元: "HKD",
    港币: "HKD",
    JPY: "JPY",
    "JP¥": "JPY",
    日元: "JPY",
    EUR: "EUR",
    "€": "EUR",
    欧元: "EUR",
    GBP: "GBP",
    "£": "GBP",
    英镑: "GBP",
  };
  return Array.from(line.matchAll(tokens), (m) => {
    const token = (m[1] || m[4]).toUpperCase();
    const currency =
      token === "¥" && /日元|JPY/i.test(line) ? "JPY" : currencies[token] || "";
    return { amount: Number(m[2] || m[3]).toFixed(2), currency };
  });
}
function extract(block: string, base: string, confidence: number) {
  const key = identifyBrand(block);
  const lines = block.split("\n");
  const isKnown = key !== "custom";
  const kind = /还款|花呗/.test(block)
    ? "账单还款"
    : renewal.test(block)
      ? "自动续费"
      : /复查/.test(block)
        ? "提醒复查"
        : "会员到期";
  const cycle = /每月|按月|月付|monthly/i.test(block)
    ? "每月"
    : /每年|按年|年付|annual|yearly/i.test(block)
      ? "每年"
      : /每季|季付|quarterly/i.test(block)
        ? "每季"
        : "单次";
  const candidates = lines.filter((s) => !promotion.test(s));
  const labelled = candidates.filter(
    (s) => renewal.test(s) && prices(s).length,
  );
  const all = (labelled.length ? labelled : candidates).flatMap(prices);
  const distinct = new Map(all.map((p) => [p.currency + p.amount, p]));
  const price = distinct.size === 1 ? [...distinct.values()][0] : undefined;
  let date = readDate(block, base);
  let amount = price?.amount || "";
  const uncertainty: string[] = [];
  if (confidence < 65) {
    date = "";
    amount = "";
    uncertainty.push("画面不够清晰，请对照原图填写数字");
  } else {
    if (!date) uncertainty.push("日期待核对");
    if (!amount || !price?.currency) uncertainty.push("金额和币种待核对");
  }
  let name = isKnown
    ? (brands as Record<string, { name: string }>)[key].name
    : "";
  if (key === "chatgpt") {
    const tier = block.match(/\b(plus|pro|team)\b/i)?.[1];
    if (tier) name += " " + tier[0].toUpperCase() + tier.slice(1).toLowerCase();
  }
  if (
    !name &&
    lines[0].length <= 35 &&
    !/[0-9¥$]/.test(lines[0]) &&
    !dateLabel.test(lines[0])
  )
    name = lines[0];
  if (
    !isKnown &&
    !dateLabel.test(block) &&
    !price &&
    !/(每月|每年|订阅|会员|套餐)/.test(block)
  )
    return null;
  return {
    name,
    kind,
    cycle,
    amount,
    currency: price?.currency || "",
    date,
    evidence: block.slice(0, 480),
    uncertainty: uncertainty.join(" · "),
  };
}
export function parseDeviceText(raw: string, base: string, confidence = 100) {
  const text = raw
    .normalize("NFKC")
    .replace(/\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?(?![\d.,])/g, (n) =>
      n.replaceAll(",", ""),
    )
    .replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, (m) =>
      m.includes("\n") ? "\n" : "",
    )
    .replace(/(?<=\d)[ \t]*\.[ \t]*(?=\d)/g, ".")
    .trim();
  const blocks: string[] = [];
  let activeBrand = "",
    lines: string[] = [];
  for (const part of text
    .split(/\n+|[;；]|[,，](?=[^\d])/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const brand = identifyBrand(part);
    if (brand !== "custom" && activeBrand && activeBrand !== brand) {
      blocks.push(lines.join("\n"));
      lines = [];
    }
    if (brand !== "custom") activeBrand = brand;
    lines.push(part);
  }
  if (lines.length) blocks.push(lines.join("\n"));
  return blocks
    .map((b) => extract(b, base, confidence))
    .filter((x) => x !== null);
}
