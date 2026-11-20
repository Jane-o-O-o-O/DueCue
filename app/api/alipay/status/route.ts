import { paymentSettings } from "@/lib/alipay";
import { findOrder, matchesPaymentApp, refreshPendingOrder, validOrderId } from "@/lib/billing";
import { json, owner } from "@/lib/server";

export async function GET(req: Request) {
  const uid = owner(req);
  if (!uid) return json({ error: "请先登录知期。" }, 401);
  const id = new URL(req.url).searchParams.get("order");
  if (!validOrderId(id)) return json({ error: "未找到订单。" }, 404);
  let order = await findOrder(id, uid);
  if (!order) return json({ error: "未找到订单。" }, 404);
  const settings = paymentSettings();
  if (settings && order.status === "pending" && matchesPaymentApp(order, settings)) {
    await refreshPendingOrder(settings, order);
    order = await findOrder(id, uid) ?? order;
  }
  return json({ status: order.paid ? "paid" : order.status ?? "pending" });
}
