import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const port = Number(process.env.DUECUE_SANDBOX_PORT ?? 5190);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid DUECUE_SANDBOX_PORT.");
try {
  await access(new URL("../dist/server/index.js", import.meta.url));
} catch {
  throw new Error("Run npm run build before starting the Alipay sandbox preview.");
}
try {
  await access(new URL("../.alipay-sandbox.json", import.meta.url));
} catch {
  throw new Error("The Alipay sandbox configuration is unavailable.");
}
Object.assign(process.env, {
  ALIPAY_MODE: "sandbox",
  DUECUE_SANDBOX_PREVIEW: "1",
  DUECUE_DATA: fileURLToPath(new URL("../.wrangler/alipay-preview/", import.meta.url)),
  PLAN_PRICE_CNY: "0.01",
  PLAN_DAYS: "1",
  PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
  BIND_ADDRESS: "127.0.0.1",
  PORT: String(port),
  DUECUE_PASSWORD: randomBytes(24).toString("hex"),
  DUECUE_AUTH_SECRET: randomBytes(32).toString("hex"),
  RESEND_API_KEY: "disabled-local-preview",
  RESEND_FROM: "disabled@localhost",
});
await import("../deploy/vps/main.mjs");
