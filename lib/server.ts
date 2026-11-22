import { env } from "cloudflare:workers";
import { membershipStatus } from "../deploy/vps/membership.mjs";
export const runtime = () =>
  env as unknown as Record<string, string> & { DB: D1Database; SCREENSHOT_MODEL_URL?: string; SCREENSHOT_OPENAI_API_KEY?: string; SCREENSHOT_OPENAI_BASE_URL?: string; callScreenshotModel?: (body: string, signal: AbortSignal) => Promise<Response> };
export function owner(r: Request) {
  return (
    r.headers.get("oai-authenticated-user-id") ||
    (import.meta.env.DEV ? "local-preview" : null)
  );
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function entitlement(uid: string) {
  const { DB } = runtime();
  const membership = DB.prepare(
    "SELECT started,paid_until,permanent FROM members WHERE owner=?",
  ).bind(uid);
  type StoredMembership = Parameters<typeof membershipStatus>[0];
  let stored = await membership.first<StoredMembership>();
  if (!stored) {
    // A trusted upstream identity can exist without a registration in the VPS account service.
    await DB.prepare("INSERT OR IGNORE INTO members(owner,started) VALUES(?,?)")
      .bind(uid, Date.now()).run();
    stored = await membership.first<StoredMembership>();
  }
  return membershipStatus(stored);
}
export function trustedOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}
export async function readBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw Error("too large");
  const reader = request.body?.getReader();
  if (!reader) throw Error("empty");
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw Error("too large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}
