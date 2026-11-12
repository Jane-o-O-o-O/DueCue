// The swatches are designed for subscription cards. Each mark is self-contained
// so that collapsed cards and offline lists use the same artwork.
export const brands = {
  chatgpt: {
    name: "ChatGPT",
    color: "#3D4449",
    dark: "#20262A",
    light: "#535B61",
    glyph: "G",
  },
  netflix: {
    name: "Netflix",
    color: "#CE1830",
    dark: "#9F0E24",
    light: "#F14154",
    glyph: "N",
  },
  spotify: {
    name: "Spotify",
    color: "#20C76B",
    dark: "#087A44",
    light: "#45D988",
    glyph: "S",
  },
  icloud: {
    name: "iCloud+",
    color: "#278EEF",
    dark: "#0B64CC",
    light: "#69B8FD",
    glyph: "iC",
  },
  tencent: {
    name: "腾讯视频",
    color: "#009EEC",
    dark: "#006DB4",
    light: "#36BCF2",
    glyph: "腾",
  },
  mango: {
    name: "芒果 TV",
    color: "#FA862A",
    dark: "#CB4E12",
    light: "#FFAF43",
    glyph: "M",
  },
  apple: {
    name: "Apple",
    color: "#656B78",
    dark: "#393E4A",
    light: "#828B98",
    glyph: "A",
  },
  claude: {
    name: "Claude",
    color: "#D8805F",
    dark: "#AB573F",
    light: "#E8A48B",
    glyph: "C",
  },
  bilibili: {
    name: "哔哩哔哩",
    color: "#ED739A",
    dark: "#C24B77",
    light: "#F494AF",
    glyph: "B",
  },
  huabei: {
    name: "花呗",
    color: "#187EE7",
    dark: "#125BB6",
    light: "#53A5F4",
    glyph: "花",
  },
  "china-mobile": {
    name: "中国移动",
    color: "#008DB3",
    dark: "#005C80",
    light: "#00798C",
    glyph: "移",
  },
  "china-unicom": {
    name: "中国联通",
    color: "#CE263C",
    dark: "#9B1731",
    light: "#C5343E",
    glyph: "联",
  },
  "china-telecom": {
    name: "中国电信",
    color: "#315BC6",
    dark: "#173983",
    light: "#4B5FBF",
    glyph: "电",
  },
  mobile: {
    name: "手机套餐",
    color: "#51A6C2",
    dark: "#246F92",
    light: "#7ABDD1",
    glyph: "话",
  },
  disney: {
    name: "Disney+",
    color: "#117D99",
    dark: "#143D70",
    light: "#219EB2",
    glyph: "D+",
  },
  youtube: {
    name: "YouTube",
    color: "#E5423C",
    dark: "#AA2A2B",
    light: "#F06455",
    glyph: "▶",
  },
  iqiyi: {
    name: "爱奇艺",
    color: "#61BC0B",
    dark: "#378327",
    light: "#8DD83F",
    glyph: "iQ",
  },
  custom: {
    name: "其他订阅",
    color: "#8175CE",
    dark: "#5F53A2",
    light: "#A297E6",
    glyph: "订",
  },
};

/** @type {Array<[string, RegExp]>} */
const aliases = [
  ["icloud", /icloud|云空间|苹果云/],
  ["chatgpt", /chat\s*gpt|open\s*ai|gpt\s*(?:plus|pro)/],
  ["netflix", /netflix|奈飞|网飞/],
  ["spotify", /spotify|声田/],
  ["tencent", /腾讯(?:视频|会员)|腾讯|tencent|wetv/],
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
  const text = String(name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
  if (Object.hasOwn(brands, text)) return text;
  return (
    aliases.find(([, expression]) => expression.test(text))?.[0] ?? "custom"
  );
}

const tile = (fill) =>
  `<rect x=".5" y=".5" width="35" height="35" rx="9" fill="${fill}"/>`;

// Original compact emblems. The same paths are used for the badge and the embossed card face.
/** @type {Record<string, { d: string, color: string, width?: number }[]>} */
const carrierPaths = {
  "china-mobile": [
    {
      color: "#007FB5",
      d: "M4 18.5 14.9 7.6a4.4 4.4 0 0 1 6.2 0l2.6 2.6-3.1 3.1-2.6-2.6L7.1 21.6Z",
    },
    { color: "#0097C4", d: "m8.8 23.1 13.6-13.6 3.2 3.2L12 26.3Z" },
    {
      color: "#0A82B5",
      d: "m12.6 26.9 3.1-3.1 2.4 2.4 10.8-10.8 3.1 3.1-10.8 10.8a4.4 4.4 0 0 1-6.2 0Z",
    },
    { color: "#83BA32", d: "m21.4 18.5 6.8-6.8 3.1 3.1-6.8 6.8Z" },
  ],
  "china-unicom": [
    {
      color: "#D3233B",
      width: 2.4,
      d: "M4.7 18 15.8 6.9q2.2-2.2 4.4 0l3.1 3.1-3.1 3.1L18 10.9 10.9 18l7.1 7.1 2.2-2.2 3.1 3.1-3.1 3.1q-2.2 2.2-4.4 0Z",
    },
    {
      color: "#D3233B",
      width: 2.4,
      d: "M31.3 18 20.2 6.9M31.3 18 20.2 29.1M13.1 13.1 23 23m-9.9 0 9.9-9.9M23.1 14.1l3.9 3.9-3.9 3.9",
    },
  ],
  "china-telecom": [
    {
      color: "#2352B2",
      d: "M5.4 15.1c4.2-6.1 13.1-9.6 24.8-7.9l-3.3 4.2c-7.5-.5-15.5 1-21.5 3.7Z",
    },
    {
      color: "#2352B2",
      d: "m17.9 12.2 6-.9-6.8 9.3c-.9 1.3-.6 2.2 1.1 2.2 2.7 0 6.7-1.2 10-3.2-3.4 4.1-9.5 7.6-15.1 7.2-3.2-.2-3.9-2.3-2.1-4.8Z",
    },
    {
      color: "#3B72CD",
      d: "M6.2 20.8c-2 5.6 1.8 9.9 8.8 9.2 4.6-.4 9.6-2.8 13.8-7.2-5.1 3.2-9.6 4.7-13.5 4.7-5.6.1-8.9-2.2-9.1-6.7Z",
    },
  ],
};
export function carrierArtwork(slug) {
  return Object.hasOwn(carrierPaths, slug) ? carrierPaths[slug] : undefined;
}
function carrierBadge(slug) {
  return (
    tile("#FAFCFF") +
    carrierPaths[slug]
      .map(({ color, d, width }) =>
        width
          ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`
          : `<path d="${d}" fill="${color}"/>`,
      )
      .join("")
  );
}
// All strings below are fixed artwork. Caller-supplied labels never enter SVG.
const marks = {
  chatgpt:
    tile("#F6F6F2") +
    '<g fill="none" stroke="#252A2A" stroke-width="1.55" stroke-linejoin="round">' +
    [0, 60, 120, 180, 240, 300]
      .map(
        (angle) =>
          `<path transform="rotate(${angle} 18 18)" d="M14 17.2v-4.7a4.8 4.8 0 0 1 8.3-3.2l3.4 3.6-7.5 4.4"/>`,
      )
      .join("") +
    "</g>",
  netflix:
    tile("#19151B") +
    '<path fill="#BF0D22" d="M10.7 6.5h4.6v23l-4.6.6zm10.1 0h4.6v23.6l-4.6-.6z"/><path fill="#F22842" d="M10.7 6.5h4.9l9.8 23.6-5.3-.8z"/>',
  spotify:
    tile("#1DD764") +
    '<circle cx="18" cy="18" r="12.2" fill="#15241E"/><g fill="none" stroke="#1DD764" stroke-linecap="round"><path d="M10.5 14c4.4-1.6 10.2-1.5 15 1.1" stroke-width="2.4"/><path d="M11.6 18c4.2-1.2 8.6-1 12.8 1.2" stroke-width="2.05"/><path d="M12.7 21.8c3.9-.9 7.2-.6 10.2 1" stroke-width="1.8"/></g>',
  icloud:
    tile("#FAFBFF") +
    '<path fill="#6DD8FC" d="M8.8 25.6a6 6 0 0 1-.7-12A7.1 7.1 0 0 1 20 10.5c4.3-2.5 9.5.6 9.5 5.2a5.1 5.1 0 0 1-1.8 9.9z"/><path fill="#359CF0" d="M9.5 25.6c-3.7 0-5.8-3.9-4-6.9 2-3.3 6.5-3.4 8.8-.5.7-5 7.1-7.5 11-3.8a6.8 6.8 0 0 1 1.9 5c2.5-.3 4.3 1.4 4.4 3-1 1.9-2.6 3.2-5.1 3.2z"/>',
  tencent:
    tile("#F8FCFF") +
    '<path fill="#00B6F0" d="M8.5 8.5c.1-1.6 1.8-2.5 3.2-1.7l17.9 10.1c1.4.7 1.4 2.9 0 3.6L11.3 30c-1.4.8-3.1-.3-3.1-1.9z"/><path fill="#67D93A" d="m11.4 10.4 12.7 7.7-12.9 8.2z"/><path fill="#FFB81D" d="m15.2 14.1 7.8 4.3-7.7 4.6z"/>',
  mango:
    tile("#FF891E") +
    '<g fill="none" stroke="#FFF9E9" stroke-linejoin="round" stroke-linecap="round"><path d="M7.8 23.2c-2.2-7.5 1.8-15.8 10-15.9 7.3-.2 12.1 5.5 11.7 12.9-.4 7.5-6.2 10.5-13.2 8.9" stroke-width="2"/><path d="m9.9 23.1 2.5-9.4 4.7 7.3 6-8.3-.9 10.7" stroke-width="3.3"/></g>',
  apple:
    tile("#ECEEF1") +
    '<path fill="#454952" d="M19.2 11.3c.1-3.3 2.7-5.4 5.1-5.6.1 2.7-2.1 5.4-5.1 5.6zm5.9 6.9c.1 2.7 1.8 4.4 3.5 5.1-.7 2.2-3.2 6.8-5.8 6.8-1.7.1-2.5-1.1-4.6-1.1s-3 1.2-4.5 1.2c-3.2.1-7.7-6.5-7.7-12.1 0-4.4 2.9-7.1 6.4-7.1 1.9 0 3.6 1.2 5.2 1.2 1.4-.1 3.5-1.4 5.6-1.3 2 .1 3.7 1 4.9 2.4-1.7 1.3-2.9 3-3 4.9z"/>',
  claude:
    tile("#F8E9DB") +
    '<g fill="none" stroke="#B76247" stroke-width="2.1" stroke-linecap="round">' +
    [0, 32, 60, 90, 122, 151, 184, 214, 244, 274, 305, 334]
      .map(
        (angle, index) =>
          `<path d="m18 17.8 -.6 -${index % 3 === 0 ? 10.4 : 8.4}" transform="rotate(${angle} 18 18)"/>`,
      )
      .join("") +
    "</g>",
  bilibili:
    tile("#FFF3F7") +
    '<g fill="none" stroke="#E66C97" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 6 4.2 4.3M24.6 6l-4.8 4.3"/><rect x="6.2" y="11.1" width="23.6" height="17.6" rx="4"/><path d="m11 17.4 3.4-1.2m7.5 0 3.1 1.2m-9 3.6 2 1.2 2.1-1.2m-9 8v1.2m13.8-1.2v1.2"/></g>',
  huabei:
    tile("#EAF5FF") +
    '<g fill="none" stroke="#1E83EB" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.8 18.2c1.2-6.8 6.6-10.5 13.2-8.8l6.5 2.1-4.6.9m4.6-.9-1.2-4.1M28.5 19.7c-2.8 6.1-8.9 8.6-14.4 6.3l-5.8-2.9 4.8-.5m-4.8.5 1.4 4.3"/><path d="m13.3 17.6 3.4 2.7 6.4-5.6"/></g>',
  "china-mobile": carrierBadge("china-mobile"),
  "china-unicom": carrierBadge("china-unicom"),
  "china-telecom": carrierBadge("china-telecom"),
  mobile:
    tile("#ECF7FD") +
    '<g fill="none" stroke="#237DAB" stroke-linecap="round" stroke-linejoin="round"><rect x="10.5" y="5.6" width="15" height="25" rx="3.2" stroke-width="2"/><path d="M15.5 8h5m-3.9 19.6h2.8" stroke-width="1.7"/><path d="M14.4 20.5v-1.8m3.6 1.8v-4.6m3.5 4.6v-7.2" stroke-width="2"/></g>',
  disney:
    tile("#111F47") +
    '<g fill="none" stroke="#E4F5FF" stroke-linecap="round" stroke-linejoin="round"><path d="M10 26c4.5-.4 10.3-3.4 9.7-7.6-.4-2.8-5.1-4.2-9.2-3.4m3.1 0-.6 10" stroke-width="2.1"/><path d="M7 13.3c4-6.7 14.3-8 20 .6" stroke="#81D7F3" stroke-width="1.4"/><path d="M25.1 16v6.8m-3.4-3.4h6.8" stroke-width="1.8"/></g>',
  youtube:
    tile("#FFF7F6") +
    '<rect x="5" y="9.4" width="26" height="17.3" rx="5.3" fill="#E72D2C"/><path d="m15.1 13.6 7.4 4.5-7.4 4.5z" fill="#FFF"/>',
  iqiyi:
    tile("#F3FFEC") +
    '<g fill="none" stroke="#4B9E28" stroke-width="2.1" stroke-linecap="round"><rect x="4.7" y="8.6" width="26.6" height="18.7" rx="4.9"/><path d="M10.2 15.7v6.6m0-9.4v.1"/><ellipse cx="18.7" cy="18" rx="4" ry="5"/><path d="m19.2 20 4 3.6m2.6-7.8v6.7m0-9.5v.1"/></g>',
  custom:
    tile("#F2EEFF") +
    '<g fill="none" stroke="#7462B3" stroke-width="2" stroke-linecap="round"><rect x="7" y="10.2" width="21" height="17.5" rx="3"/><path d="M12 7.4h12.4c2.9 0 4.8 1.2 5 3.7M11.2 16h11.5m-11.5 4.2h7.4"/></g>',
};

export function badge(slug) {
  const brand = Object.hasOwn(marks, slug) ? slug : "custom";
  return `<svg class="brand-icon" width="32" height="32" viewBox="0 0 36 36" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${marks[brand]}</svg>`;
}
