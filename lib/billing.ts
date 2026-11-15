import { runtime } from "./server";
export function plan() {
  const e = runtime(),
    price = e.PLAN_PRICE_CNY || "",
    days = Number(e.PLAN_DAYS);
  if (
    !/^\d{1,5}(\.\d{1,2})?$/.test(price) ||
    Number(price) <= 0 ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 3660
  )
    return null;
  return {
    price: Number(price).toFixed(2),
    days,
    ready: !!(
      e.ALIPAY_APP_ID &&
      e.ALIPAY_PRIVATE_KEY &&
      e.ALIPAY_PUBLIC_KEY &&
      e.ALIPAY_SELLER_ID &&
      e.ALIPAY_NOTIFY_URL
    ),
  };
}
const enc = new TextEncoder();
const bytes = (key: string) =>
  Uint8Array.from(atob(key.replace(/-----[^-]+-----|\s/g, "")), (c) =>
    c.charCodeAt(0),
  );
function canonical(params: Record<string, string>) {
  return Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "")
    .sort()
    .map((k) => k + "=" + params[k])
    .join("&");
}
const algo = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
export async function checkoutUrl(
  id: string,
  price: string,
  days: number,
  origin: string,
) {
  const v = runtime();
  const key = await crypto.subtle.importKey(
    "pkcs8",
    bytes(v.ALIPAY_PRIVATE_KEY),
    algo,
    false,
    ["sign"],
  );
  const p: Record<string, string> = {
    app_id: v.ALIPAY_APP_ID,
    method: "alipay.trade.wap.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date(Date.now() + 8 * 3600000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " "),
    version: "1.0",
    notify_url: v.ALIPAY_NOTIFY_URL,
    return_url: origin + "/?payment=return",
    biz_content: JSON.stringify({
      out_trade_no: id,
      total_amount: price,
      subject: "知期 DueCue · " + days + " 天使用权",
      product_code: "QUICK_WAP_WAY",
    }),
  };
  const sig = await crypto.subtle.sign(algo, key, enc.encode(canonical(p)));
  p.sign = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return "https://openapi.alipay.com/gateway.do?" + new URLSearchParams(p);
}
export async function verify(params: Record<string, string>) {
  const sig = params.sign;
  if (!sig || params.sign_type !== "RSA2") return false;
  const { sign_type, sign, ...rest } = params;
  const key = await crypto.subtle.importKey(
    "spki",
    bytes(runtime().ALIPAY_PUBLIC_KEY),
    algo,
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    algo,
    key,
    bytes(sig),
    enc.encode(canonical(rest)),
  );
}
