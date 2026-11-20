import { paymentClient, paymentSettings } from "@/lib/alipay";
import { cents, confirmPaid, findOrder, isPaidStatus, matchesPaymentApp, validOrderId } from "@/lib/billing";
import { runtime } from "@/lib/server";

function fail() {
  console.warn("Alipay notification rejected");
  return new Response("fail", { status: 400 });
}

export async function POST(req: Request) {
  try {
    if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded")
      return fail();
    const form = new URLSearchParams(await req.text());
    const data = Object.fromEntries(form);
    if (Object.keys(data).length !== form.size) return fail();
    const settings = paymentSettings();
    if (
      !settings || data.app_id !== settings.appId || data.sign_type !== "RSA2" ||
      !data.sign || !data.notify_id || !data.notify_type ||
      !paymentClient(settings).checkNotifySignV2(data)
    ) return fail();

    const order = await findOrder(data.out_trade_no);
    if (
      !order || !matchesPaymentApp(order, settings) || data.seller_id !== settings.sellerId ||
      !validOrderId(data.trade_no) || (order.trade && order.trade !== data.trade_no) ||
      cents(data.total_amount) !== cents(order.amount)
    ) return fail();

    const isPayment = data.notify_type === "trade_status_sync" &&
      isPaidStatus(data.trade_status) && !data.out_biz_no && !data.gmt_refund && !data.refund_fee;
    // The transaction guards the entitlement change even if recording the notification fails and it is retried.
    if (isPayment) await confirmPaid(order, data.trade_no);
    await runtime().DB.prepare(`INSERT OR IGNORE INTO alipay_notifications
      (notify_id,order_id,trade,event_type) VALUES(?,?,?,?)`)
      .bind(data.notify_id, order.id, data.trade_no, isPayment ? "payment" : "other").run();
    return new Response("success");
  } catch {
    return fail();
  }
}
