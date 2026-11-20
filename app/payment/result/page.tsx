"use client";

import { useEffect, useState } from "react";

const messages = {
  empty: "这里会显示你的付款确认结果。",
  checking: "正在确认支付结果…",
  pending: "等待支付宝确认。关闭此页面后，知期仍会继续核对订单。",
  paid: "支付成功，使用时长已到账。",
  closed: "订单已关闭。",
  error: "暂时无法核对该订单，请稍后重试。",
};

export default function PaymentResult() {
  const [status, setStatus] = useState<keyof typeof messages>("empty");
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("out_trade_no") ?? "";
    if (!id) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let remaining = 7;
    setStatus("checking");
    async function check() {
      try {
        const res = await fetch("/api/alipay/status?order=" + encodeURIComponent(id), {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await res.json() as { status?: string };
        if (controller.signal.aborted) return;
        if (!res.ok) return setStatus("error");
        if (data.status === "paid" || data.status === "closed") return setStatus(data.status);
        setStatus("pending");
        if (--remaining > 0) timer = setTimeout(check, 5000);
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return (
    <main className="settings" style={{ maxWidth: 520, margin: "64px auto", padding: 20 }}>
      <h1>知期 · 支付结果</h1>
      <section className="settingsCard" style={{ padding: 20 }}>
        <p role="status">{messages[status]}</p>
        <a href="/">返回知期</a>
      </section>
    </main>
  );
}
