import { entitlement, json, owner, trustedOrigin } from "@/lib/server";
import { checkoutForm, pendingOrder, plan, recordOrder, refreshPendingOrder } from "@/lib/billing";
import { paymentSettings } from "@/lib/alipay";

export async function POST(req: Request) {
  const uid = owner(req);
  if (!uid || !trustedOrigin(req)) return json({ error: "请先登录。" }, 403);
  if ((await entitlement(uid)).permanent) return json({ error: "你的永久使用权益已生效。" }, 409);
  const settings = paymentSettings();
  const offer = plan(uid);
  if (!offer?.ready || !settings) return json({ error: "商户尚未开通购买。" }, 503);
  try {
    const origin = new URL(req.url).origin;
    const pending = await pendingOrder(uid, settings);
    if (pending) {
      const status = await refreshPendingOrder(settings, pending);
      if (pending.paid || status === "paid") return json({ orderId: pending.id, paid: true });
      if (status !== "closed") {
        return json({
          orderId: pending.id,
          paymentHtml: checkoutForm(settings, pending.id, pending.amount, pending.days, origin),
        });
      }
    }
    const id = crypto.randomUUID().replaceAll("-", "");
    const paymentHtml = checkoutForm(settings, id, offer.price, offer.days, origin);
    await recordOrder(id, uid, offer.price, offer.days, settings);
    return json({ orderId: id, paymentHtml });
  } catch {
    console.warn("Alipay checkout could not start");
    return json({ error: "暂时无法打开支付宝，请稍后再试。" }, 503);
  }
}
