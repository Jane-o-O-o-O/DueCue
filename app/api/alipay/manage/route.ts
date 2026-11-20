import { timingSafeEqual } from "node:crypto";
import { paymentSettings } from "@/lib/alipay";
import { closeOrder, queryRefund, refundOrder } from "@/lib/alipay-management";
import { cents, findOrder, matchesPaymentApp, queryOrder, validOrderId } from "@/lib/billing";
import { json, readBody, runtime } from "@/lib/server";

export async function POST(req: Request) {
  const key = runtime().ALIPAY_MANAGEMENT_TOKEN;
  const token = req.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
  const claim = Buffer.from(token ?? "");
  const expected = Buffer.from(key ?? "");
  if (!key || key.length < 32 || claim.length !== expected.length || !timingSafeEqual(claim, expected))
    return json({ error: "未经授权。" }, 401);

  const settings = paymentSettings();
  if (!settings) return json({ error: "支付配置不可用。" }, 503);
  try {
    const input = await readBody(req, 4096);
    if (!validOrderId(input?.orderId)) return json({ error: "订单号无效。" }, 400);
    const order = await findOrder(input.orderId);
    if (!order || !matchesPaymentApp(order, settings)) return json({ error: "未找到订单。" }, 404);

    switch (input.action) {
      case "query":
        return json({ status: await queryOrder(settings, order) });
      case "close":
        return json({ status: await closeOrder(settings, order) });
      case "refund":
      case "refundQuery": {
        if (!validOrderId(input.requestId)) return json({ error: "退款请求号无效。" }, 400);
        if (input.action === "refundQuery")
          return json({ status: await queryRefund(settings, order, input.requestId) });
        const amount = cents(input.amount);
        if (!amount) return json({ error: "退款金额无效。" }, 400);
        const status = await refundOrder(settings, order, input.requestId, amount);
        return json({ status }, status === "rejected" ? 409 : 200);
      }
      default:
        return json({ error: "不支持该交易操作。" }, 400);
    }
  } catch {
    return json({ error: "交易操作暂未确认。请用原订单和请求号查询或重试。" }, 503);
  }
}
