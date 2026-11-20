import { paymentClient, type PaymentSettings } from "./alipay";
import { cents, markClosed, queryOrder, type Order } from "./billing";
import { runtime } from "./server";

type Refund = {
  amount_cents: number;
  status: "pending" | "refunded";
  last_attempt: number | null;
};

function refundRecord(orderId: string, requestId: string) {
  return runtime().DB.prepare(`SELECT amount_cents,status,last_attempt FROM alipay_refunds
    WHERE order_id=? AND request_id=?`).bind(orderId, requestId).first<Refund>();
}

async function settleRefund(order: Order, requestId: string) {
  await runtime().DB.prepare("UPDATE alipay_refunds SET status='refunded' WHERE order_id=? AND request_id=?")
    .bind(order.id, requestId).run();
  return "refunded";
}

export async function queryRefund(settings: PaymentSettings, order: Order, requestId: string) {
  const refund = await refundRecord(order.id, requestId);
  if (!refund) return "not_found";
  if (refund.status === "refunded") return "refunded";
  if (!refund.last_attempt || Date.now() < refund.last_attempt + 10000) return "pending";
  const result = await paymentClient(settings).exec("alipay.trade.fastpay.refund.query", {
    bizContent: { out_trade_no: order.id, out_request_no: requestId },
  }, { validateSign: true });
  if (
    result.code === "10000" && result.refund_status === "REFUND_SUCCESS" &&
    result.out_trade_no === order.id && result.trade_no === order.trade &&
    result.out_request_no === requestId && cents(result.refund_amount) === refund.amount_cents
  ) return settleRefund(order, requestId);
  return "pending";
}

export async function refundOrder(settings: PaymentSettings, order: Order, requestId: string, amount: number) {
  const paid = cents(order.amount);
  if (!order.paid || !order.trade || !paid || amount > paid) return "rejected";
  const db = runtime().DB;
  const now = Date.now();
  // Pending refunds reserve their amounts until the gateway confirms the outcome.
  await db.prepare(`INSERT INTO alipay_refunds(order_id,request_id,amount_cents,created)
    SELECT ?,?,?,? WHERE ?+(SELECT coalesce(sum(amount_cents),0) FROM alipay_refunds WHERE order_id=?)<=?
    ON CONFLICT(order_id,request_id) DO NOTHING`)
    .bind(order.id, requestId, amount, now, amount, order.id, paid).run();
  const refund = await refundRecord(order.id, requestId);
  if (!refund || refund.amount_cents !== amount) return "rejected";
  if (refund.status === "refunded") return "refunded";

  if (refund.last_attempt) {
    const status = await queryRefund(settings, order, requestId);
    if (status === "refunded") return status;
  }
  const claimed = await db.prepare(`UPDATE alipay_refunds SET last_attempt=? WHERE
    order_id=? AND request_id=? AND status='pending'
    AND (last_attempt IS NULL OR last_attempt<=?)
    AND NOT EXISTS(SELECT 1 FROM alipay_refunds AS other WHERE other.order_id=?
      AND other.request_id<>? AND other.last_attempt>?)
    RETURNING request_id`).bind(now, order.id, requestId, now - 15_000, order.id, requestId, now - 15_000).first();
  if (!claimed) return (await refundRecord(order.id, requestId))?.status ?? "pending";
  const result = await paymentClient(settings).exec("alipay.trade.refund", {
    bizContent: {
      out_trade_no: order.id,
      refund_amount: `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`,
      out_request_no: requestId,
    },
  }, { validateSign: true });
  if (
    result.code === "10000" && result.fund_change === "Y" &&
    result.out_trade_no === order.id && result.trade_no === order.trade
  ) return settleRefund(order, requestId);
  return "pending";
}

export async function closeOrder(settings: PaymentSettings, order: Order) {
  const status = await queryOrder(settings, order);
  if (status !== "pending") return status;
  const result = await paymentClient(settings).exec("alipay.trade.close", {
    bizContent: { out_trade_no: order.id },
  }, { validateSign: true });
  if (
    result.code !== "10000" || result.out_trade_no !== order.id ||
    (order.trade && result.trade_no !== order.trade)
  ) return "unknown";
  await markClosed(order);
  return "closed";
}
