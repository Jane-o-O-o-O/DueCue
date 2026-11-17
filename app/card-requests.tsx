"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { requestJSON } from "./importer";
import "./card-requests.css";

type CardReply = {
  id: string;
  message: string;
  reply: string;
  cards: { slug: string; name: string }[];
  created: number;
};
type InboxItem = { number: number; message: string; created: number };
type Mailbox = {
  recent: CardReply[];
  inbox?: { total: number; items: InboxItem[] };
};
const endpoint = "/api/card-requests";
const shortDate = (timestamp: number) => new Date(timestamp).toLocaleString("zh-CN", {
  month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});

export function CardRequests() {
  const [inbox, setInbox] = useState<Mailbox["inbox"]>();
  const [reply, setReply] = useState<CardReply | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
  const [error, setError] = useState("");
  const attempt = useRef("");
  const version = useRef(0);
  const replyEpoch = useRef(0);

  async function refresh() {
    const current = ++version.current;
    try {
      const result = await requestJSON(endpoint);
      if (current === version.current) setInbox(result.inbox);
    } catch {
      if (current === version.current) setInbox(undefined);
    }
  }
  useEffect(() => {
    function clearRestoredReply(event: PageTransitionEvent) {
      if (!event.persisted) return;
      replyEpoch.current++;
      attempt.current = "";
      setReply(null);
      setMessage("");
      setError("");
      setSending(false);
    }
    void refresh();
    window.addEventListener("pageshow", clearRestoredReply);
    return () => {
      version.current++;
      replyEpoch.current++;
      window.removeEventListener("pageshow", clearRestoredReply);
    };
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    if (!attempt.current) attempt.current = crypto.randomUUID();
    const epoch = replyEpoch.current;
    setSending(true);
    setError("");
    try {
      const result = await requestJSON(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: attempt.current, message: text }),
      });
      if (epoch !== replyEpoch.current) return;
      version.current++;
      setInbox(result.inbox);
      setReply(result.recent[0] ?? null);
      setMessage("");
      attempt.current = "";
    } catch (e) {
      if (epoch === replyEpoch.current) setError(e instanceof Error ? e.message : "留言暂未送达，请再试一次。");
    } finally {
      if (epoch === replyEpoch.current) setSending(false);
    }
  }

  async function markRead(number: number) {
    setMarking(number);
    setError("");
    try {
      const result = await requestJSON(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number }),
      });
      version.current++;
      setInbox(result.inbox);
    } catch (e) {
      setError(e instanceof Error ? e.message : "暂时无法标记，请重试。");
    } finally {
      setMarking(null);
    }
  }

  return (
    <section className="section cardRequests" aria-labelledby="cardRequestQuestion">
      <form onSubmit={send}>
        <label id="cardRequestQuestion" htmlFor="cardRequestText">你想加一张什么卡片？</label>
        <textarea id="cardRequestText" rows={2} maxLength={300} required
          placeholder="比如：想要一张山姆会员卡，用来提醒年费到期。"
          value={message} disabled={sending} onChange={event => {
            setMessage(event.target.value);
            attempt.current = "";
          }} />
        <div className="cardRequestSend">
          <span role="status">{sending ? "正在帮你查卡片图鉴…" : ""}</span>
          <button type="submit" className="primary" disabled={sending || !message.trim()}>
            {sending ? "查询中…" : "发送留言"}
          </button>
        </div>
      </form>
      {error && <p className="cardRequestError" role="alert">{error}</p>}
      {inbox && <details className="cardRequestInbox">
        <summary>作者收件箱 · {inbox.total} 条待查看</summary>
        {inbox.items.length === 0 && <p>新卡片请求会出现在这里。</p>}
        {inbox.items.map(item => <div className="cardRequestItem" key={item.number}>
          <time>{shortDate(item.created)}</time><p>{item.message}</p>
          <button className="soft" disabled={marking !== null || sending}
            onClick={() => markRead(item.number)}>标为已读</button>
        </div>)}
      </details>}
      <div aria-live="polite" aria-relevant="additions">
        {reply && (
          <article className="cardRequestItem">
            <p className="cardRequestQuestion">{reply.message}</p>
            <div className="cardRequestReply">
              <strong>知期回复</strong>
              <p>{reply.reply}</p>
              {reply.cards.map(card => (
                <a key={card.slug} href={"/cards?from=settings&card=" + encodeURIComponent(card.slug)}>
                  查看「{card.name}」卡面
                </a>
              ))}
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
