import { paymentClient, paymentSettings, type PaymentSettings } from "./alipay";
import { runtime, week } from "./server";

export function cents(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
}

function amountText(amount: number) {
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
}

export function plan(uid: string) {
  const env = runtime();
  const preview = env.ALIPAY_REVIEW_OWNER === uid;
  if (!preview && env.ALIPAY_TEST_OWNER && env.ALIPAY_TEST_OWNER !== uid) return null;
  const price = cents(env.PLAN_PRICE_CNY);
  const days = Number(env.PLAN_DAYS);
  if (!price || price > 10_000_000_000 || !Number.isInteger(days) || days < 1 || days > 3660)
    return null;
  return { price: amountText(price), days, ready: !preview && !!paymentSettings(), ...(preview && { preview }) };
}

export function checkoutForm(
  settings: PaymentSettings, id: string, price: string, days: number, origin: string,
) {
  const returnUrl = new URL("/payment/result", origin).href;
  return paymentClient(settings).pageExec("alipay.trade.page.pay", "POST", {
    returnUrl,
    ...(settings.notifyUrl ? { notifyUrl: settings.notifyUrl } : {}),
    bizContent: {
      out_trade_no: id,
      total_amount: price,
      subject: `知期订阅卡包 ${days} 天使用权`,
      product_code: "FAST_INSTANT_TRADE_PAY",
      timeout_express: "30m",
    },
  });
}

type OrderStatus = "pending" | "paid" | "closed";
export type Order = {
  id: string;
  owner: string;
  amount: string;
  days: number;
  paid: number;
  trade: string | null;
  status: OrderStatus | null;
  mode: string | null;
  app_id: string | null;
};

export async function findOrder(id: string, uid?: string) {
  const sql = `SELECT orders.*, alipay_orders.status, alipay_orders.mode, alipay_orders.app_id
    FROM orders LEFT JOIN alipay_orders ON orders.id=alipay_orders.order_id WHERE orders.id=?`;
  const db = runtime().DB;
  return (uid ? db.prepare(sql + " AND orders.owner=?").bind(id, uid) : db.prepare(sql).bind(id))
    .first<Order>();
}

export function matchesPaymentApp(order: Order, settings: PaymentSettings) {
  if (!order.mode) return settings.mode === "production";
  return order.mode === settings.mode && order.app_id === settings.appId;
}

export function validOrderId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export async function pendingOrder(uid: string, settings: PaymentSettings) {
  const pending = await runtime().DB.prepare(`SELECT order_id FROM alipay_orders
    WHERE owner=? AND mode=? AND app_id=? AND status='pending'`)
    .bind(uid, settings.mode, settings.appId).first<{ order_id: string }>();
  return pending ? findOrder(pending.order_id, uid) : null;
}

export async function recordOrder(
  id: string, uid: string, price: string, days: number, settings: PaymentSettings,
) {
  const db = runtime().DB;
  await db.batch([
    db.prepare("INSERT INTO orders(id,owner,amount,days) VALUES(?,?,?,?)").bind(id, uid, price, days),
    db.prepare("INSERT INTO alipay_orders(order_id,owner,mode,app_id,next_query) VALUES(?,?,?,?,?)")
      .bind(id, uid, settings.mode, settings.appId, Date.now() + 10_000),
  ]);
}

export async function confirmPaid(order: Order, trade: string) {
  if (order.trade && order.trade !== trade) throw new Error("Alipay trade mismatch");
  const db = runtime().DB;
  const now = Date.now();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO members(owner,started) VALUES(?,?)").bind(order.owner, now),
    db.prepare(`UPDATE members SET paid_until=max(paid_until,started+?,?)+? WHERE owner=?
      AND EXISTS(SELECT 1 FROM orders WHERE id=? AND paid=0)`)
      .bind(week, now, order.days * 86400000, order.owner, order.id),
    db.prepare("UPDATE orders SET paid=1,trade=? WHERE id=? AND paid=0").bind(trade, order.id),
    db.prepare("UPDATE alipay_orders SET status='paid' WHERE order_id=?").bind(order.id),
  ]);
  // A concurrent payment event may have arrived after this order was loaded.
  const stored = await findOrder(order.id);
  if (stored?.trade !== trade) throw new Error("Alipay trade mismatch");
}

export async function markClosed(order: Order) {
  await runtime().DB.prepare(`UPDATE alipay_orders SET status='closed' WHERE order_id=?
    AND status='pending' AND EXISTS(SELECT 1 FROM orders WHERE id=? AND paid=0)`)
    .bind(order.id, order.id).run();
}

export function isPaidStatus(status: unknown) {
  return status === "TRADE_SUCCESS" || status === "TRADE_FINISHED";
}

export async function queryOrder(settings: PaymentSettings, order: Order) {
  if (order.paid) return "paid";
  if (order.status === "closed") return "closed";
  const result = await paymentClient(settings).exec("alipay.trade.query", {
    bizContent: { out_trade_no: order.id },
  }, { validateSign: true });
  if (result.code === "40004" && result.sub_code === "ACQ.TRADE_NOT_EXIST") return "not_found";
  if (result.code !== "10000") return "unknown";
  if (
    result.out_trade_no !== order.id || !validOrderId(result.trade_no) ||
    (order.trade && order.trade !== result.trade_no) ||
    cents(result.total_amount) !== cents(order.amount) ||
    (result.seller_id && result.seller_id !== settings.sellerId)
  ) throw new Error("Alipay order details mismatch");
  if (isPaidStatus(result.trade_status)) {
    await confirmPaid(order, result.trade_no);
    return "paid";
  }
  if (result.trade_status === "TRADE_CLOSED") {
    await markClosed(order);
    return "closed";
  }
  return result.trade_status === "WAIT_BUYER_PAY" ? "pending" : "unknown";
}

export async function refreshPendingOrder(settings: PaymentSettings, order: Order) {
  // Lease via SQLite so repeated page visits and background jobs share the retry window.
  const now = Date.now();
  const db = runtime().DB;
  const claimed = await db.prepare(`UPDATE alipay_orders SET
      next_query=?+min(3600000,15000*(1 << min(query_attempts,8))),
      query_attempts=query_attempts+1
    WHERE order_id=? AND status='pending' AND next_query<=? RETURNING order_id`)
    .bind(now, order.id, now).first();
  if (!claimed) return undefined;
  try {
    return await queryOrder(settings, order);
  } catch {
    console.warn("Alipay order query deferred");
    return "unknown";
  }
}

export async function reconcilePendingPayments() {
  const settings = paymentSettings();
  if (!settings) return;
  const db = runtime().DB;
  const due = await db.prepare(`SELECT order_id FROM alipay_orders WHERE
    mode=? AND app_id=? AND status='pending' AND next_query<=? ORDER BY next_query LIMIT 12`)
    .bind(settings.mode, settings.appId, Date.now()).all<{ order_id: string }>();
  await Promise.all(due.results.map(async ({ order_id }) => {
    const order = await findOrder(order_id);
    if (order && !order.paid) await refreshPendingOrder(settings, order);
  }));
}
