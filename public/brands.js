// Card colors are separate from the publisher-supplied images.
import { catalog } from "./catalog-data.js";

export const brands = {
  ...Object.fromEntries(
    catalog.map(({ slug, name, color }) => [
      slug,
      {
        name,
        color,
        dark: shade(color, 0.58),
        light: shade(color, 0.95),
      },
    ]),
  ),
  chatgpt: {
    name: "ChatGPT",
    color: "#3D4449",
    dark: "#20262A",
    light: "#535B61",
  },
  netflix: {
    name: "Netflix",
    color: "#CE1830",
    dark: "#9F0E24",
    light: "#F14154",
  },
  spotify: {
    name: "Spotify",
    color: "#20C76B",
    dark: "#087A44",
    light: "#45D988",
  },
  icloud: {
    name: "iCloud+",
    color: "#278EEF",
    dark: "#0B64CC",
    light: "#69B8FD",
  },
  tencent: {
    name: "腾讯视频",
    color: "#009EEC",
    dark: "#006DB4",
    light: "#36BCF2",
  },
  mango: {
    name: "芒果 TV",
    color: "#FA862A",
    dark: "#CB4E12",
    light: "#FFAF43",
  },
  apple: {
    name: "Apple",
    color: "#656B78",
    dark: "#393E4A",
    light: "#828B98",
  },
  claude: {
    name: "Claude",
    color: "#D8805F",
    dark: "#AB573F",
    light: "#E8A48B",
  },
  bilibili: {
    name: "哔哩哔哩",
    color: "#ED739A",
    dark: "#C24B77",
    light: "#F494AF",
  },
  huabei: {
    name: "花呗",
    color: "#187EE7",
    dark: "#125BB6",
    light: "#53A5F4",
  },
  "china-mobile": {
    name: "中国移动",
    color: "#008DB3",
    dark: "#005C80",
    light: "#00798C",
  },
  "china-unicom": {
    name: "中国联通",
    color: "#CE263C",
    dark: "#9B1731",
    light: "#C5343E",
  },
  "china-telecom": {
    name: "中国电信",
    color: "#315BC6",
    dark: "#173983",
    light: "#4B5FBF",
  },
  mobile: {
    name: "手机套餐",
    color: "#51A6C2",
    dark: "#246F92",
    light: "#7ABDD1",
  },
  disney: {
    name: "Disney+",
    color: "#117D99",
    dark: "#143D70",
    light: "#219EB2",
  },
  youtube: {
    name: "YouTube",
    color: "#E5423C",
    dark: "#AA2A2B",
    light: "#F06455",
  },
  iqiyi: {
    name: "爱奇艺",
    color: "#61BC0B",
    dark: "#378327",
    light: "#8DD83F",
  },
  custom: {
    name: "其他订阅",
    color: "#8175CE",
    dark: "#5F53A2",
    light: "#A297E6",
  },
};

function shade(color, factor) {
  const channels = color
    .slice(1)
    .match(/../g)
    .map((pair) => parseInt(pair, 16));
  // Limit the brightest end of the gradient behind white renewal dates.
  const brightness =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const scale = factor * Math.min(1, 152 / Math.max(1, brightness));
  return (
    "#" +
    channels
      .map((value) =>
        Math.round(value * scale)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function searchKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+(?=[\u3400-\u9fff])|(?<=[\u3400-\u9fff])\s+(?=[a-z0-9])/g, "")
    .replace(/\s+/g, " ");
}
const cautious = new Set([
  "qq",
  "得到",
  "幕布",
  "豆包",
  "keep",
  "智行",
  "同程",
]);
const terms = catalog
  .flatMap((row) =>
    [row.name, ...row.aliases].map((value) => {
      const term = searchKey(value);
      const source = term
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/ /g, "\\s*");
      const left = /^[a-z0-9]/.test(term) ? "(?<![a-z0-9])" : "";
      const right = /[a-z0-9]$/.test(term) ? "(?![a-z0-9])" : "";
      const qualified = cautious.has(term)
        ? "(?=\\s*(?:会员|听书|笔记|订阅|月付|年付|到期|续费|VIP|SVIP|$))"
        : "";
      return {
        term,
        slug: row.slug,
        pattern: new RegExp(left + source + right + qualified, "i"),
      };
    }),
  )
  .sort((a, b) => b.term.length - a.term.length);

/** @type {Array<[string, RegExp]>} */
const aliases = [
  ["icloud", /icloud|苹果云/],
  ["chatgpt", /chat\s*gpt|open\s*ai|gpt\s*(?:plus|pro)/],
  ["netflix", /netflix|奈飞|网飞/],
  ["spotify", /spotify|声田/],
  ["tencent", /腾讯(?:视频|会员)|^腾讯$|^tencent$|tencent\s*video|wetv/],
  ["mango", /芒果|mang[oO]/i],
  ["claude", /claude|anthropic|克劳德/],
  ["bilibili", /哔哩|哔站|b站|bilibili/],
  ["huabei", /花呗|huabei/],
  [
    "china-mobile",
    /中[国國]\s*移\s*[动動]|中移[动動]|china[\s-]*mobile|\bcmcc\b/,
  ],
  [
    "china-mobile",
    /移\s*[动動](?=$|[\s\d·（(／/-]|手[机機]|[电電][话話]|[话話][费費]|[号號卡]|[主副]卡|套餐|月租|[月年][费費]|[账帳賬][单單]|[宽寬][带帶]|流量|通信|全球通|神州行|[动動]感地[带帶]|[畅暢飞飛]享)/,
  ],
  ["china-unicom", /[联聯]\s*通|china[\s-]*unicom|\bunicom\b/],
  ["china-telecom", /[电電]\s*信|china[\s-]*telecom/],
  [
    "mobile",
    /手[机機](?:[号號]|卡|套餐)|[电電][话話](?:卡|套餐)|[话話][费費]|移[动動]|mobile/,
  ],
  ["disney", /disney|迪士尼/],
  ["youtube", /youtube|油管/],
  ["iqiyi", /爱奇艺|iqiyi/],
  ["apple", /apple|苹果/],
];

export function identifyBrand(name) {
  const text = searchKey(name);
  if (Object.hasOwn(brands, text)) return text;
  const primary = text
    .split(/(?:附赠|赠送|权益包含|包含权益)/, 1)[0]
    .replace(/京东白条|京东金条|京东金融|美团月付|美团借钱/g, " ");
  const match = terms.find(({ pattern }) => pattern.test(primary));
  if (match) return match.slug;
  return (
    aliases.find(([, expression]) => expression.test(primary))?.[0] ?? "custom"
  );
}
