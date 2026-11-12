"use client";
import { useState, useEffect, useRef } from "react";
import {
  WalletCards,
  CalendarDays,
  Layers3,
  Settings2,
  Plus,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Download,
  SquareStack,
  ArrowDownUp,
  PenLine,
  CalendarPlus,
} from "lucide-react";
import { brands, identifyBrand, badge } from "../public/brands.js";
import {
  examples,
  iso,
  dateFrom,
  daysLeft,
  money,
  calendarFile,
  Entry,
  shift,
} from "@/lib/records";
import { atOrAfter, occurrencesBetween } from "@/lib/recurrence";
import Importer, { requestJSON } from "./importer";
import {
  DialogLayer,
  type DialogControl,
  useMovingItems,
  releaseCard,
  reducedMotion,
} from "./motion";
type Tab = "overview" | "calendar" | "list" | "settings";
const tabs = [
  { key: "overview", name: "卡包", Icon: WalletCards },
  { key: "calendar", name: "日历", Icon: CalendarDays },
  { key: "list", name: "列表", Icon: Layers3 },
  { key: "settings", name: "设置", Icon: Settings2 },
] as const;
const shortDate = (s: string) =>
  s ? Number(s.slice(5, 7)) + "月" + Number(s.slice(8)) + "日" : "日期待确认";
function due(s: string, t: string) {
  if (!s) return "待确认";
  const n = daysLeft(s, t);
  return n === 0
    ? "今天"
    : n === 1
      ? "明天"
      : n < 0
        ? "已过 " + -n + " 天"
        : n + " 天后";
}
function IconMark({ name }: { name: string }) {
  return (
    <span
      className="platformIcon"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: badge(identifyBrand(name)) }}
    />
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brandMark">
        <Layers3 size={25} strokeWidth={2.6} />
      </span>
      <b>有期</b>
    </div>
  );
}
function CardArt({ slug }: { slug: string }) {
  const isVideo = [
    "tencent",
    "mango",
    "netflix",
    "disney",
    "youtube",
    "bilibili",
    "iqiyi",
  ].includes(slug);
  return (
    <svg aria-hidden="true" viewBox="0 0 250 240" className="cardArt">
      <g
        transform="translate(146 119) rotate(-18)"
        fill="none"
        stroke="currentColor"
      >
        {Array.from({ length: 18 }, (_, i) => {
          const scale = 0.44 + i * 0.063;
          const transform = `translate(${i * 0.6} ${-i * 0.65}) rotate(${i * 1.15}) scale(${scale})`;
          return isVideo ? (
            <path
              key={i}
              transform={transform}
              d="M-61 -87 Q-61 -103 -47 -95 L93 -13 Q109 -4 93 6 L-46 89 Q-61 98 -61 81 Z"
            />
          ) : (
            <rect
              key={i}
              transform={transform}
              x="-73"
              y="-73"
              width="146"
              height="146"
              rx={slug === "spotify" || slug === "chatgpt" ? 67 : 35}
            />
          );
        })}
      </g>
    </svg>
  );
}
function download(e: Entry) {
  const url = URL.createObjectURL(
    new Blob([calendarFile(e)], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = e.name + ".ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 45000);
}
function Month({
  items,
  today,
  select,
}: {
  items: Entry[];
  today: string;
  select: (e: Entry) => void;
}) {
  const [month, setMonth] = useState(today.slice(0, 7)),
    [day, daySet] = useState(""),
    [direction, setDirection] = useState(1);
  const first = dateFrom(month + "-01"),
    offset = (first.getDay() + 6) % 7;
  const len = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const monthItems = items.map((e) => atOrAfter(e, month + "-01"));
  const matches = monthItems
    .filter((e) => e.date && (day ? e.date === day : e.date.startsWith(month)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const move = (n: number) => {
    setDirection(n);
    const m = dateFrom(month + "-01");
    m.setMonth(m.getMonth() + n);
    setMonth(iso(m).slice(0, 7));
    daySet("");
  };
  return (
    <div
      className="section calendarScreen"
      style={{ "--direction": direction } as React.CSSProperties}
    >
      <div className="sectionTitle">
        <h2 key={month} className="monthLabel">
          {first.getFullYear()} 年 {first.getMonth() + 1} 月
        </h2>
        <span>
          <button
            aria-label="上个月"
            className="iconBtn"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="下个月"
            className="iconBtn"
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
        </span>
      </div>
      <div key={month} className="monthGrid motionSlide">
        {"一二三四五六日".split("").map((x) => (
          <small key={x}>{x}</small>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <i key={"blank" + i} />
        ))}
        {Array.from({ length: len }, (_, i) => {
          const s = month + "-" + String(i + 1).padStart(2, "0");
          return (
            <button
              className={
                (day === s ? "selectedDay " : "") + (s === today ? "today" : "")
              }
              key={s}
              aria-pressed={day === s}
              onClick={() => daySet(day === s ? "" : s)}
            >
              {i + 1}
              <span>
                {monthItems
                  .filter((e) => e.date === s)
                  .slice(0, 3)
                  .map((e) => (
                    <i
                      key={e.id}
                      style={{
                        background: (brands as any)[identifyBrand(e.name)]
                          .color,
                      }}
                    />
                  ))}
              </span>
            </button>
          );
        })}
      </div>
      <div key={day || month} className="motionReveal">
        <h3>{day ? shortDate(day) : "本月事项"}</h3>
        {matches.length ? (
          matches.map((e) => (
            <button className="dateRow" key={e.id} onClick={() => select(e)}>
              <IconMark name={e.name} />
              <strong>{e.name}</strong>
              <span>
                {shortDate(e.date)} · {money(e)}
              </span>
              <ChevronRight size={16} />
            </button>
          ))
        ) : (
          <div className="empty">这段时间没有到期事项</div>
        )}
      </div>
    </div>
  );
}
export default function Wallet({ initialToday }: { initialToday: string }) {
  const [today, setToday] = useState(initialToday),
    [live, setLive] = useState<Entry[]>([]),
    [member, setMember] = useState<any>({ active: true, started: 0 }),
    [plan, setPlan] = useState<any>(null),
    [ai, setAI] = useState(false),
    [dbError, setDbError] = useState(""),
    [tab, setTab] = useState<Tab>("overview"),
    [demo, setDemo] = useState(true),
    [index, setIndex] = useState(0),
    [filter, F] = useState("全部"),
    [q, Q] = useState(""),
    [search, S] = useState(false),
    [sortBy, sort] = useState(false),
    [imp, I] = useState<string | null>(null),
    [detail, D] = useState<Entry | null>(null),
    [edit, E] = useState<Entry | undefined>(),
    [msg, M] = useState(""),
    [confirm, C] = useState(false),
    [pending, P] = useState(false),
    [purchasing, setPurchasing] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [navDirection, setNavDirection] = useState(1);
  const dialog = useRef<DialogControl>(null);
  const opener = useRef<HTMLElement | null>(null);
  const ghosts = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const cardMotion = useMovingItems(index);
  const listMotion = useMovingItems(JSON.stringify([filter, sortBy, q]));
  const tabIndex = tabs.findIndex((t) => t.key === tab);
  useEffect(() => {
    if (search) searchInput.current?.focus({ preventScroll: true });
  }, [search]);
  function rememberOpener() {
    if (!detail && !imp) opener.current = document.activeElement as HTMLElement;
  }
  async function refresh() {
    try {
      const s = await requestJSON("/api/wallet");
      setLive(s.entries);
      setMember(s.member);
      setPlan(s.plan);
      setAI(s.ai);
      setDemo(
        !s.entries.length && localStorage.getItem("youqi:hide-demo") !== "yes",
      );
      setDbError("");
    } catch (e: any) {
      setDbError(e.message);
    }
  }
  useEffect(() => {
    setToday(iso(new Date()));
    refresh();
    const handle = () => {
      if (document.visibilityState === "visible") {
        setToday(iso(new Date()));
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => M(""), 3500);
    return () => clearTimeout(id);
  }, [msg]);
  function finishDismiss() {
    D(null);
    E(undefined);
    I(null);
    C(false);
  }
  function close() {
    dialog.current?.dismiss();
  }
  const originals = demo ? examples(today) : live,
    items = originals.map((e) => atOrAfter(e, today)),
    ordered = [...items].sort((a, b) =>
      (a.date || "9999").localeCompare(b.date || "9999"),
    ),
    upcoming = ordered.filter((e) => e.date && daysLeft(e.date, today) >= 0),
    curr = items.length ? items[index % items.length] : null,
    expected = originals
      .filter((e) => e.kind === "自动续费" && e.amount)
      .flatMap((e) => occurrencesBetween(e, today, shift(today, 30))),
    total = expected
      .filter((e) => e.currency === "CNY")
      .reduce((n, e) => n + Number(e.amount), 0),
    deckSize = Math.min(4, items.length);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lastSwipe = useRef(0);
  function settleDrag(deck: HTMLDivElement) {
    delete deck.dataset.dragging;
    deck.style.removeProperty("--drag-x");
    deck.style.removeProperty("--drag-tilt");
  }
  function moveCard(by: number) {
    if (items.length < 2) return;
    cardMotion.capture();
    releaseCard(cardMotion.group.current, ghosts.current, by);
    setIndex((previous) => (previous + by + items.length) % items.length);
  }
  const rows = (
    sortBy
      ? [...items].sort((a, b) => a.name.localeCompare(b.name, "zh"))
      : ordered
  ).filter(
    (e) =>
      (filter === "全部" || e.kind === filter) &&
      e.name.toLowerCase().includes(q.toLowerCase()),
  );
  const pageTitles = {
    overview: "订阅卡包",
    calendar: "到期日历",
    list: "全部订阅",
    settings: "设置",
  };
  function nav(v: Tab) {
    if (v === tab) return;
    setNavDirection(tabs.findIndex((t) => t.key === v) > tabIndex ? 1 : -1);
    setTab(v);
    Q("");
    F("全部");
    S(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function start(m = "text") {
    if (!member.active) {
      nav("settings");
      M("试用已结束，请先开通使用权");
      return;
    }
    rememberOpener();
    E(undefined);
    I(m);
  }
  async function save(data: Entry[]) {
    const v = await requestJSON("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: data }),
    });
    setMember(v.member);
    setLive((old) => [
      ...data,
      ...old.filter((e) => !data.some((r) => r.id === e.id)),
    ]);
    localStorage.setItem("youqi:hide-demo", "yes");
    setDemo(false);
    setIndex(0);
    M("已保存到我的订阅");
  }
  async function remove() {
    if (!detail) return;
    P(true);
    try {
      await requestJSON("/api/wallet?id=" + encodeURIComponent(detail.id), {
        method: "DELETE",
      });
      setLive((old) => old.filter((e) => e.id !== detail.id));
      close();
      setIndex(0);
      M("订阅已移除");
    } catch (e: any) {
      M(e.message);
    } finally {
      P(false);
    }
  }
  const select = (r: Entry) => {
      rememberOpener();
      C(false);
      D(r);
    },
    status = member.started
      ? member.active
        ? member.paid
          ? "会员有效"
          : "试用剩余 " +
            Math.max(1, Math.ceil((member.end - Date.now()) / 86400000)) +
            " 天"
        : "试用已结束"
      : "7 天免费试用";
  const heading = (title: string, end?: React.ReactNode) => (
    <div className="sectionTitle">
      <h2>{title}</h2>
      {end}
    </div>
  );
  const list = () => (
    <section className="section listPanel">
      <div className="listTools">
        <button
          className="iconBtn"
          aria-expanded={search}
          onClick={() => {
            S(!search);
            if (search && q) {
              listMotion.capture();
              Q("");
            }
          }}
          aria-label="搜索订阅"
        >
          <Search size={17} />
        </button>
        <button
          className="sortBtn"
          aria-pressed={sortBy}
          onClick={() => {
            listMotion.capture();
            sort(!sortBy);
          }}
        >
          <ArrowDownUp size={14} />
          {sortBy ? "按名称" : "按日期"}
        </button>
      </div>
      <div
        className="fold"
        data-open={search}
        inert={!search}
        aria-hidden={!search}
      >
        <div>
          <input
            className="search"
            ref={searchInput}
            placeholder="搜索订阅名称"
            value={q}
            onChange={(e) => {
              listMotion.capture();
              Q(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="filters">
        {["全部", "自动续费", "会员到期", "账单还款", "提醒复查"].map((f) => (
          <button
            className={filter === f ? "on" : ""}
            key={f}
            aria-pressed={filter === f}
            onClick={() => {
              if (filter !== f) {
                listMotion.capture();
                F(f);
              }
            }}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="tableHead">
        <span>订阅服务</span>
        <span>下次日期</span>
        <span>金额</span>
        <span />
      </div>
      <div ref={listMotion.group}>
        {rows.length ? (
          rows.map((r) => (
            <button
              key={r.id}
              className="tableRow"
              data-motion-id={r.id}
              onClick={() => select(r)}
            >
              <span className="service">
                <IconMark name={r.name} />
                <span>
                  <b>{r.name}</b>
                  <small>
                    {r.cycle} · {r.kind}
                  </small>
                </span>
              </span>
              <span className="rowDate">{shortDate(r.date)}</span>
              <b className="rowAmount">{money(r)}</b>
              <ChevronRight size={15} />
            </button>
          ))
        ) : (
          <div className="empty">
            {items.length ? "没有匹配的订阅" : "暂无订阅"}
          </div>
        )}
      </div>
    </section>
  );
  const navigation = (mode: "desktop" | "mobile") => (
    <nav
      className={mode === "desktop" ? "desktopNav" : "mobileNav"}
      style={{ "--choice": tabIndex } as React.CSSProperties}
      inert={!!(detail || imp)}
      aria-label="主导航"
    >
      {tabs.map(({ key, name, Icon }) => (
        <button
          key={key}
          aria-current={tab === key ? "page" : undefined}
          className={tab === key ? "active" : ""}
          onClick={() => nav(key)}
        >
          <Icon size={19} strokeWidth={tab === key ? 2.4 : 1.8} />
          {name}
        </button>
      ))}
    </nav>
  );
  return (
    <div className="shell">
      <header className="masthead">
        <div className="mastInner">
          <Brand />
          {navigation("desktop")}
        </div>
      </header>
      <main
        inert={!!(detail || imp)}
        style={{ "--direction": navDirection } as React.CSSProperties}
      >
        <header className="pageHeader">
          <div className="pageTitle motionReveal" key={tab}>
            <h1>{pageTitles[tab]}</h1>
            {demo && tab !== "settings" && (
              <span className="demoLabel">示例</span>
            )}
          </div>
          {tab !== "settings" && (
            <button
              className="primary add"
              aria-label="添加订阅"
              onClick={() => start(ai ? "text" : "manual")}
            >
              <Plus size={21} strokeWidth={2.2} />
              <span>添加订阅</span>
            </button>
          )}
        </header>
        {dbError && (
          <div className="warning">
            个人账本暂未载入。
            <button
              className="textBtn"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await refresh();
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              {refreshing ? "加载中…" : "重新加载"}
            </button>
          </div>
        )}
        <div key={tab} className="pageStage motionSlide">
          {tab === "overview" && (
            <>
              <div className="dashGrid">
                <section className="walletPanel" aria-label="订阅卡片">
                  {curr ? (
                    <>
                      <div
                        className="deck"
                        ref={cardMotion.group}
                        style={
                          { "--deck-count": deckSize } as React.CSSProperties
                        }
                        onTouchStart={(e) => {
                          const point = e.touches[0];
                          touchStart.current = {
                            x: point.clientX,
                            y: point.clientY,
                          };
                        }}
                        onTouchMove={(e) => {
                          const start = touchStart.current;
                          if (
                            !start ||
                            items.length < 2 ||
                            e.touches.length !== 1 ||
                            reducedMotion()
                          )
                            return;
                          const dx = e.touches[0].clientX - start.x,
                            dy = e.touches[0].clientY - start.y;
                          if (
                            Math.abs(dy) > Math.abs(dx) &&
                            !e.currentTarget.dataset.dragging
                          )
                            return;
                          const travel = Math.max(-48, Math.min(48, dx * 0.32));
                          e.currentTarget.dataset.dragging = "true";
                          e.currentTarget.style.setProperty(
                            "--drag-x",
                            travel + "px",
                          );
                          e.currentTarget.style.setProperty(
                            "--drag-tilt",
                            travel * 0.055 + "deg",
                          );
                        }}
                        onTouchCancel={(e) => {
                          settleDrag(e.currentTarget);
                          touchStart.current = null;
                        }}
                        onTouchEnd={(e) => {
                          const start = touchStart.current;
                          touchStart.current = null;
                          if (!start || items.length < 2) return;
                          const dx = e.changedTouches[0].clientX - start.x,
                            dy = e.changedTouches[0].clientY - start.y;
                          if (
                            Math.abs(dx) > 40 &&
                            Math.abs(dx) > 1.4 * Math.abs(dy)
                          ) {
                            lastSwipe.current = Date.now();
                            moveCard(dx < 0 ? 1 : -1);
                          }
                          settleDrag(e.currentTarget);
                        }}
                      >
                        {Array.from({ length: deckSize }, (_, j) => {
                          const n = deckSize - 1 - j;
                          const r = items[(index + n) % items.length];
                          const slug = identifyBrand(r.name);
                          const b = (brands as any)[slug];
                          return (
                            <button
                              key={r.id}
                              data-motion-id={r.id}
                              className={
                                "deckCard" + (n ? " behind" : " front")
                              }
                              style={
                                {
                                  "--level": n,
                                  "--slot": j,
                                  "--card": b.dark,
                                  "--tint": b.light,
                                } as React.CSSProperties
                              }
                              onClick={() => {
                                if (Date.now() - lastSwipe.current < 450)
                                  return;
                                if (n) moveCard(n);
                                else select(r);
                              }}
                              aria-label={
                                r.name + (n ? "，切换到此卡" : "，打开详情")
                              }
                            >
                              <span className="deckName">
                                <IconMark name={r.name} />
                                <b>{r.name}</b>
                              </span>
                              {n === 0 && (
                                <>
                                  <span className="deckChip">{r.cycle}</span>
                                  <CardArt slug={slug} />
                                  <span className="heroFoot">
                                    <span className="heroAmount">
                                      <small>{r.kind}</small>
                                      <strong>{money(r)}</strong>
                                    </span>
                                    <span className="heroDate">
                                      <small>{due(r.date, today)}</small>
                                      <b>{shortDate(r.date)}</b>
                                    </span>
                                  </span>
                                </>
                              )}
                            </button>
                          );
                        })}
                        <div
                          ref={ghosts}
                          className="cardGhosts"
                          inert
                          aria-hidden="true"
                        />
                      </div>
                      {items.length > 1 && (
                        <div className="deckNav">
                          <button
                            aria-label="上一张卡"
                            onClick={() => moveCard(-1)}
                          >
                            <ChevronLeft size={17} />
                          </button>
                          <span
                            className="pager motionReveal"
                            key={index}
                            aria-live="polite"
                          >
                            {(index % items.length) + 1}
                            <i>/</i>
                            {items.length}
                          </span>
                          <button
                            aria-label="下一张卡"
                            onClick={() => moveCard(1)}
                          >
                            <ChevronRight size={17} />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <button className="drop" onClick={() => start("manual")}>
                      <Plus />
                      添加第一张订阅卡
                    </button>
                  )}
                </section>
                <div className="overviewSide">
                  <section className="forecast" aria-label="未来三十天续费">
                    <span>
                      30 天内预计续费
                      {expected.some((e) => e.currency !== "CNY") && (
                        <small>仅计人民币</small>
                      )}
                    </span>
                    <strong>¥{total.toFixed(2)}</strong>
                    {total > 0 && (
                      <span className="spendBar" aria-hidden="true">
                        {expected
                          .filter(
                            (e) => e.currency === "CNY" && Number(e.amount) > 0,
                          )
                          .map((e) => (
                            <i
                              key={e.id + e.date}
                              style={{
                                flexGrow: Number(e.amount),
                                background: (brands as any)[
                                  identifyBrand(e.name)
                                ].color,
                              }}
                            />
                          ))}
                      </span>
                    )}
                  </section>
                  <section className="upcoming">
                    {heading(
                      "近期事项",
                      <button
                        className="iconBtn"
                        aria-label="查看日历"
                        onClick={() => nav("calendar")}
                      >
                        <CalendarDays size={18} />
                      </button>,
                    )}
                    <div className="agenda">
                      {upcoming.slice(0, 4).map((r) => (
                        <button key={r.id} onClick={() => select(r)}>
                          <span className="dateStamp">
                            <small>{Number(r.date.slice(5, 7))}月</small>
                            <b>{r.date.slice(8)}</b>
                          </span>
                          <span className="agendaName">
                            <strong>{r.name}</strong>
                            <small>
                              <i
                                style={{
                                  background: (brands as any)[
                                    identifyBrand(r.name)
                                  ].color,
                                }}
                              />
                              {r.kind} · {due(r.date, today)}
                            </small>
                          </span>
                          <b>{money(r)}</b>
                        </button>
                      ))}
                      {!upcoming.length && (
                        <div className="empty">暂无近期事项</div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
          {tab === "list" && list()}
          {tab === "calendar" && (
            <Month items={originals} today={today} select={select} />
          )}
          {tab === "settings" && (
            <div className="settings">
              <section className="section">
                <div className="memberHero">
                  <SquareStack size={28} />
                  <h2>{status}</h2>
                  <p>
                    {member.started
                      ? "有效至 " + new Date(member.end).toLocaleString("zh-CN")
                      : "首次保存或成功识别后起算，含截图和文字导入。"}
                  </p>
                </div>
                {plan?.ready ? (
                  <button
                    className="primary"
                    disabled={purchasing}
                    aria-busy={purchasing}
                    onClick={async () => {
                      setPurchasing(true);
                      try {
                        const r = await requestJSON("/api/checkout", {
                          method: "POST",
                        });
                        location.assign(r.url);
                      } catch (e: any) {
                        setPurchasing(false);
                        M(e.message);
                      }
                    }}
                  >
                    {purchasing
                      ? "正在打开支付宝…"
                      : `支付宝购买 ${plan.days} 天 · ¥${plan.price}`}
                  </button>
                ) : (
                  <p className="hint">付费方案待开放，到期可主动续期。</p>
                )}
              </section>
              <section className="section">
                <div className="settingRow">
                  <span>
                    <b>示例账本</b>
                  </span>
                  <button
                    className="soft"
                    onClick={() => {
                      localStorage.setItem(
                        "youqi:hide-demo",
                        demo ? "yes" : "no",
                      );
                      setDemo(!demo);
                      setIndex(0);
                      nav("overview");
                    }}
                  >
                    {demo ? "返回我的卡包" : "查看示例"}
                  </button>
                </div>
                <div className="settingRow">
                  <span>
                    <b>截图与文字识别</b>
                    <small>gpt-6.2-sol</small>
                  </span>
                  <small>{ai ? "可用" : "待开通"}</small>
                </div>
                <div className="settingRow">
                  <span>
                    <b>iPhone 日历提醒</b>
                    <small>打开订阅，点「加入日历」。</small>
                  </span>
                  <CalendarPlus size={18} />
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
      {navigation("mobile")}
      {(detail || imp) && (
        <DialogLayer
          controller={dialog}
          onDismiss={finishDismiss}
          returnFocus={opener}
        >
          {detail && !imp && (
            <section
              className="sheet"
              aria-busy={pending}
              role="dialog"
              aria-modal="true"
              aria-label="订阅详情"
            >
              <div className="sheetHead">
                <div>
                  <IconMark name={detail.name} />
                  <h2>{detail.name}</h2>
                </div>
                <button
                  className="iconBtn"
                  aria-label="关闭"
                  disabled={pending}
                  onClick={close}
                >
                  <X size={19} />
                </button>
              </div>
              <div
                className="detailTop"
                style={
                  {
                    "--accent": (brands as any)[identifyBrand(detail.name)]
                      .dark,
                  } as React.CSSProperties
                }
              >
                <small>{detail.kind}</small>
                <strong>{money(detail)}</strong>
              </div>
              <dl>
                {[
                  ["下次日期", shortDate(detail.date)],
                  ["周期", detail.cycle],
                  [
                    "日历提醒",
                    detail.remind ? "提前 " + detail.remind + " 天" : "当天",
                  ],
                  ...(detail.note ? [["备注", detail.note]] : []),
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              {demo ? (
                <button
                  className="primary wide"
                  onClick={() => {
                    D(null);
                    start("manual");
                  }}
                >
                  <Plus size={16} />
                  添加我的订阅
                </button>
              ) : (
                <>
                  <div className="actions">
                    <button
                      className="soft"
                      onClick={() => {
                        if (!member.active) {
                          close();
                          nav("settings");
                          return;
                        }
                        E(live.find((r) => r.id === detail.id) || detail);
                        I("manual");
                      }}
                    >
                      <PenLine size={16} />
                      编辑
                    </button>
                    <button
                      className="primary"
                      disabled={!detail.date}
                      onClick={() => {
                        download(
                          live.find((r) => r.id === detail.id) || detail,
                        );
                        M("已生成日历文件");
                      }}
                    >
                      <Download size={16} />
                      加入日历
                    </button>
                  </div>
                  <button
                    disabled={pending}
                    className="deleteBtn"
                    data-confirm={confirm}
                    onClick={() => (confirm ? remove() : C(true))}
                  >
                    <span key={String(confirm)} className="actionLabel">
                      {pending
                        ? "正在删除…"
                        : confirm
                          ? "确认删除这条订阅？"
                          : "删除订阅"}
                    </span>
                  </button>
                </>
              )}
            </section>
          )}
          {imp && (
            <Importer
              edit={edit}
              initialMode={imp}
              ai={ai}
              save={save}
              close={close}
            />
          )}
        </DialogLayer>
      )}
      {msg && (
        <div key={msg} className="toast" role="status">
          {msg}
        </div>
      )}
    </div>
  );
}
