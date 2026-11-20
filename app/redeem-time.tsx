"use client";

import { useState, type FormEvent } from "react";
import { Ticket } from "lucide-react";
import { requestJSON } from "./importer";

type Membership = { started: number; end: number; active: boolean; paid: boolean; permanent?: boolean };

export function RedeemTime({ onRedeemed }: { onRedeemed: (member: Membership) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await requestJSON("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      onRedeemed(result.member);
      setCode("");
      setNotice(result.permanent
        ? "永久使用权益已生效。"
        : result.alreadyRedeemed ? "这枚兑换码的时长已到账。" : `兑换成功，已增加 ${result.days} 天。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法兑换，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section redeemTime">
      <div className="redeemIntro">
        <span className="settingIcon tone-purple"><Ticket size={22} aria-hidden="true" /></span>
        <p>输入兑换码，延长知期使用时长。</p>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="membership-code">兑换码</label>
        <div className="redeemFields">
          <input id="membership-code" value={code} placeholder="输入或粘贴兑换码"
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            required maxLength={80} disabled={busy} onChange={event => {
              setCode(event.target.value);
              setNotice("");
              setError("");
            }} />
          <button type="submit" className="primary" disabled={busy || !code.trim()}>
            {busy ? "兑换中…" : "兑换"}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        <p role="status">{notice}</p>
      </form>
    </section>
  );
}
