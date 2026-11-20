import { AlipaySdk } from "alipay-sdk";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { runtime } from "./server";

type PaymentSettings = {
  mode: "sandbox" | "production";
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  sellerId: string;
  gateway: string;
  notifyUrl?: string;
};

function isRawKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function paymentSettings(): PaymentSettings | null {
  const env = runtime();
  if (env.ALIPAY_MODE === "sandbox") {
    const file = env.ALIPAY_SANDBOX_PATH;
    if (!file || !isAbsolute(file)) return null;
    try {
      const { appIds, sandboxAccounts } = JSON.parse(readFileSync(file, "utf8"));
      const app = appIds[0];
      const sellerId = sandboxAccounts.partner.userId;
      if (
        typeof app.appId !== "string" || !app.appId ||
        typeof sellerId !== "string" || !sellerId ||
        !isRawKey(app.appPrivatePkcsKey) || !isRawKey(app.alipayPublicKey)
      ) return null;
      return {
        mode: "sandbox",
        appId: app.appId,
        privateKey: app.appPrivatePkcsKey,
        alipayPublicKey: app.alipayPublicKey,
        sellerId,
        gateway: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
      };
    } catch {
      return null;
    }
  }
  if (env.ALIPAY_MODE !== "production") return null;
  const appId = env.ALIPAY_APP_ID;
  const sellerId = env.ALIPAY_SELLER_ID;
  const privateKey = env.ALIPAY_PRIVATE_KEY;
  const alipayPublicKey = env.ALIPAY_PUBLIC_KEY;
  if (!appId || !sellerId || !isRawKey(privateKey) || !isRawKey(alipayPublicKey)) return null;
  let notifyUrl;
  if (env.ALIPAY_NOTIFY_URL) {
    try {
      const url = new URL(env.ALIPAY_NOTIFY_URL);
      if (
        !["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".") ||
        url.username || url.password || url.hash || url.pathname !== "/api/alipay/notify"
      ) return null;
      notifyUrl = url.href;
    } catch {
      return null;
    }
  }
  return {
    mode: "production",
    appId, privateKey, alipayPublicKey, sellerId, notifyUrl,
    gateway: "https://openapi.alipay.com/gateway.do",
  };
}

export function paymentClient(settings: PaymentSettings) {
  return new AlipaySdk({
    appId: settings.appId,
    privateKey: settings.privateKey,
    alipayPublicKey: settings.alipayPublicKey,
    gateway: settings.gateway,
    keyType: "PKCS1",
    signType: "RSA2",
    camelcase: false,
    timeout: 5000,
  });
}

export type { PaymentSettings };
