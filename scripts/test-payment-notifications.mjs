import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import { copyFileSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { request } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const fixture = mkdtempSync(join(tmpdir(), "duecue-payment-test-"));
const user = "fixture-owner";
const password = "fixture-password";
const appId = "test-app";
const sellerId = "test-seller";
const day = 86400000;
const merchant = generateKeyPairSync("rsa", { modulusLength: 2048 });
const mockAlipay = generateKeyPairSync("rsa", { modulusLength: 2048 });
const lease = createServer();
let application;
let closed;
let db;
let logs = "";

try {
  for (const file of ["main.mjs", "accounts.mjs", "bindings.mjs", "card-requests.mjs", "redemption.mjs", "package.json", "schema.sql"]) {
    copyFileSync(join(project, "deploy", "vps", file), join(fixture, file));
  }
  symlinkSync(join(project, "dist"), join(fixture, "dist"));
  lease.listen(0, "127.0.0.1");
  await once(lease, "listening");
  const { port } = lease.address();
  await new Promise((resolve, reject) => lease.close(error => error ? reject(error) : resolve()));
  const origin = "http://127.0.0.1:" + port;

  application = spawn(process.execPath, ["main.mjs"], {
    cwd: fixture,
    env: {
      PORT: String(port), BIND_ADDRESS: "127.0.0.1", PUBLIC_ORIGIN: origin,
      DUECUE_DATA: join(fixture, "data"), DUECUE_USERNAME: user, DUECUE_PASSWORD: password,
      DUECUE_AUTH_SECRET: "fixture-auth-secret-only-for-this-process",
      RESEND_API_KEY: "fixture", RESEND_FROM: "fixture@example.invalid",
      ALIPAY_MODE: "production", ALIPAY_APP_ID: appId, ALIPAY_SELLER_ID: sellerId,
      ALIPAY_PRIVATE_KEY: merchant.privateKey.export({ format: "der", type: "pkcs1" }).toString("base64"),
      ALIPAY_PUBLIC_KEY: mockAlipay.publicKey.export({ format: "der", type: "spki" }).toString("base64"),
      ALIPAY_TEST_OWNER: user, PLAN_PRICE_CNY: "0.01", PLAN_DAYS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [application.stdout, application.stderr]) {
    stream.on("data", chunk => { logs = (logs + chunk).slice(-4000); });
  }
  closed = once(application, "close");

  function call(path, { method = "GET", authenticated = true, body = "" } = {}) {
    const headers = body ? { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) } : {};
    if (authenticated) headers.Authorization = "Basic " + Buffer.from(user + ":" + password).toString("base64");
    return new Promise((resolve, reject) => {
      const req = request(origin + path, { method, headers, timeout: 2500 }, res => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", part => { text += part; });
        res.on("end", () => resolve({ status: res.statusCode, text }));
      });
      req.on("timeout", () => req.destroy(new Error("Fixture HTTP request timed out")));
      req.on("error", reject);
      req.end(body);
    });
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const ok = await call("/healthz", { authenticated: false }).catch(() => null);
    if (ok?.status === 200) break;
    if (attempt === 39 || application.exitCode !== null) throw new Error("Test app failed to start. Run the account build first.");
    await delay(100);
  }

  db = new DatabaseSync(join(fixture, "data", "duecue.sqlite"));
  db.exec("PRAGMA busy_timeout=5000;");
  const initialEnd = Date.now() + 20 * day;
  db.prepare("INSERT INTO members(owner,started,paid_until) VALUES (?,?,?)").run(user, Date.now(), initialEnd);
  const checkout = await call("/api/checkout", { method: "POST" });
  assert.equal(checkout.status, 200);
  const { orderId } = JSON.parse(checkout.text);
  assert.match(orderId, /^[0-9a-f]{32}$/);
  // Keep the entire test offline. All provider notifications are signed by the mock.
  db.prepare("UPDATE alipay_orders SET next_query=? WHERE order_id=?").run(Date.now() + day, orderId);
  const membershipEnd = async () => JSON.parse((await call("/api/wallet")).text).member.end;
  const status = async () => JSON.parse((await call("/api/alipay/status?order=" + orderId)).text).status;
  assert.equal(await status(), "pending");
  assert.equal(await membershipEnd(), initialEnd);

  function notify(id, overrides = {}, tamper = false) {
    const fields = {
      app_id: appId, seller_id: sellerId, out_trade_no: orderId, trade_no: "provider-test-order",
      total_amount: "0.01", trade_status: "TRADE_SUCCESS", notify_type: "trade_status_sync", notify_id: id,
      ...overrides,
    };
    const canonical = Object.keys(fields).sort().map(key => key + "=" + fields[key]).join("&");
    const signature = sign("sha256", Buffer.from(canonical), tamper ? merchant.privateKey : mockAlipay.privateKey);
    return call("/api/alipay/notify", {
      method: "POST", authenticated: false,
      body: new URLSearchParams({ ...fields, sign_type: "RSA2", sign: signature.toString("base64") }).toString(),
    });
  }
  for (const invalid of [
    await notify("wrong-amount", { total_amount: "0.02" }),
    await notify("wrong-seller", { seller_id: "other-seller" }),
    await notify("wrong-key", {}, true),
  ]) {
    assert.equal(invalid.status, 400);
  }
  assert.equal(await status(), "pending");
  assert.equal(await membershipEnd(), initialEnd);

  // The customer may leave the site without visiting the payment result page.
  const repeated = await Promise.all([notify("valid-callback"), notify("valid-callback"), notify("valid-callback-again")]);
  for (const result of repeated) assert.deepEqual(result, { status: 200, text: "success" });
  assert.equal(await status(), "paid");
  assert.equal(await membershipEnd(), initialEnd + day);
  console.log("Passed: pending order, wrong amount, wrong seller, invalid signature, callback without browser return, and repeat delivery.");
} catch (error) {
  if (logs) console.error(logs);
  throw error;
} finally {
  db?.close();
  if (application) {
    if (application.exitCode === null) application.kill();
    await closed;
  }
  rmSync(fixture, { recursive: true, force: true });
}
