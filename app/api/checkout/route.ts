import { json, owner, runtime, trustedOrigin } from "@/lib/server";
import { checkoutUrl, plan } from "@/lib/billing";
export async function POST(req: Request) {
  const uid = owner(req);
  if (!uid || !trustedOrigin(req)) return json({ error: "请先登录。" }, 403);
  const p = plan();
  if (!p?.ready) return json({ error: "商户尚未开通购买。" }, 503);
  const id = crypto.randomUUID().replaceAll("-", "");
  const url = await checkoutUrl(id, p.price, p.days, new URL(req.url).origin);
  await runtime()
    .DB.prepare("INSERT INTO orders(id,owner,amount,days) VALUES(?,?,?,?)")
    .bind(id, uid, p.price, p.days)
    .run();
  return json({ url });
}
