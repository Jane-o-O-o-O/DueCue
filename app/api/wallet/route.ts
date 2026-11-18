import {
  entitlement,
  json,
  owner,
  runtime,
  trustedOrigin,
  readBody,
} from "@/lib/server";
import { normalize } from "@/lib/records";
import { plan } from "@/lib/billing";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const uid = owner(req);
  if (!uid) return json({ error: "请先登录后访问个人账本。" }, 401);
  const { DB } = runtime();
  const result = await DB.prepare(
    "SELECT data FROM entries WHERE owner=? ORDER BY rowid DESC",
  )
    .bind(uid)
    .all<{ data: string }>();
  return json({
    entries: result.results.map((r) => JSON.parse(r.data)),
    member: await entitlement(uid),
    plan: plan(),
    ai: !!runtime().OPENAI_API_KEY,
  });
}
export async function POST(req: Request) {
  const uid = owner(req);
  if (!uid || !trustedOrigin(req))
    return json({ error: "登录后再保存。" }, 403);
  const member = await entitlement(uid);
  if (!member.active)
    return json({ error: "试用已结束，已有订阅仍可查看。" }, 402);
  let body;
  try {
    body = await readBody(req, 120000);
  } catch {
    return json({ error: "记录格式无效。" }, 400);
  }
  const rows = Array.isArray(body?.entries) ? body.entries.map(normalize) : [];
  if (!rows.length || rows.length > 50 || rows.some((r: any) => !r))
    return json({ error: "请核对名称、金额和日期。" }, 400);
  const db = runtime().DB;
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO members(owner,started) VALUES(?,?)")
      .bind(uid, Date.now()),
    ...rows.map((r: any) =>
      db
        .prepare(
          "INSERT INTO entries(owner,id,data) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET data=excluded.data",
        )
        .bind(uid, r.id, JSON.stringify(r)),
    ),
  ]);
  return json({ member: await entitlement(uid) });
}
export async function DELETE(req: Request) {
  const uid = owner(req);
  if (!uid || !trustedOrigin(req))
    return json({ error: "登录后再操作。" }, 403);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "请选择记录。" }, 400);
  await runtime()
    .DB.prepare("DELETE FROM entries WHERE owner=? AND id=?")
    .bind(uid, id)
    .run();
  return json({ ok: true });
}
