import { runtime, week } from "@/lib/server";
import { verify } from "@/lib/billing";
export async function POST(req: Request) {
  const fail = () => new Response("failure", { status: 400 });
  try {
    const data = Object.fromEntries(new URLSearchParams(await req.text()));
    const e = runtime();
    if (
      !(await verify(data)) ||
      data.app_id !== e.ALIPAY_APP_ID ||
      data.seller_id !== e.ALIPAY_SELLER_ID
    )
      return fail();
    const order = await e.DB.prepare("SELECT * FROM orders WHERE id=?")
      .bind(data.out_trade_no)
      .first<any>();
    if (
      !order ||
      !data.trade_no ||
      !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(data.total_amount) ||
      Number(data.total_amount) !== Number(order.amount)
    )
      return fail();
    if (["TRADE_SUCCESS", "TRADE_FINISHED"].includes(data.trade_status)) {
      const now = Date.now();
      await e.DB.batch([
        e.DB.prepare(
          "INSERT OR IGNORE INTO members(owner,started) VALUES(?,?)",
        ).bind(order.owner, now),
        e.DB.prepare(
          "UPDATE members SET paid_until=max(paid_until,started+?,?)+? WHERE owner=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND paid=0)",
        ).bind(week, now, order.days * 86400000, order.owner, order.id),
        e.DB.prepare(
          "UPDATE orders SET paid=1,trade=? WHERE id=? AND paid=0",
        ).bind(data.trade_no, order.id),
      ]);
    }
    return new Response("success");
  } catch {
    return fail();
  }
}
