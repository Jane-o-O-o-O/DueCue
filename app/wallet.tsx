"use client";
import { useState, useEffect } from "react";
import {
  WalletCards,
  LayoutDashboard,
  CalendarDays,
  Layers3,
  Settings2,
  Plus,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowUpRight,
  Clock3,
  Layers,
  CalendarClock,
  Search,
  X,
  Ellipsis,
  Download,
  Check,
  Eye,
  SquareStack,
  Coins,
  LayoutGrid,
  ArrowRight,
  ArrowDownUp,
  SlidersHorizontal,
  NotebookTabs,
  BellRing,
  ScanLine,
  Menu,
  Trash2,
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
  symbols,
  calendarFile,
  Entry,
  shift,
} from "@/lib/records";
import { atOrAfter, occurrencesBetween } from "@/lib/recurrence";
import Importer, { requestJSON } from "./importer";
type Tab = "overview" | "calendar" | "list" | "settings";
const tabs = [
  { key: "overview", name: "订阅总览", Icon: LayoutDashboard },
  { key: "calendar", name: "到期日历", Icon: CalendarDays },
  { key: "list", name: "全部订阅", Icon: Layers3 },
  { key: "settings", name: "使用设置", Icon: Settings2 },
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
      <span className="wordmark">YOQI</span>
    </div>
  );
}
function CardArt({ slug }: { slug: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 280 240" className={"cardArt " + slug}>
      <defs>
        <linearGradient id="silk" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#fff" stopOpacity=".82" />
          <stop offset=".45" stopColor="#d6f7ff" stopOpacity=".26" />
          <stop offset="1" stopColor="#fff" stopOpacity=".06" />
        </linearGradient>
      </defs>
      {slug === "tencent" ? (
        <g transform="rotate(-16 150 115)">
          {[0, 1, 2].map((k) => (
            <path
              key={k}
              d="M92 30 Q83 25 83 42 L83 189 Q83 209 101 198 L234 122 Q248 112 232 103 Z"
              transform={"translate(" + k * -12 + "," + k * 4 + ")"}
              fill="url(#silk)"
              stroke="white"
              strokeOpacity=".4"
              strokeWidth="2.5"
            />
          ))}
        </g>
      ) : (
        <g transform="rotate(-25 145 100)">
          {[0, 1, 2, 3].map((k) => (
            <rect
              key={k}
              x={55 + k * 12}
              y={28 + k * 9}
              width="155"
              height="134"
              rx="44"
              fill="url(#silk)"
              stroke="white"
              strokeOpacity=".45"
              strokeWidth="2"
            />
          ))}
        </g>
      )}
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
    [day, daySet] = useState("");
  const first = dateFrom(month + "-01"),
    offset = (first.getDay() + 6) % 7;
  const len = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const monthItems = items.map((e) => atOrAfter(e, month + "-01"));
  const matches = monthItems
    .filter((e) => e.date && (day ? e.date === day : e.date.startsWith(month)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const move = (n: number) => {
    const m = dateFrom(month + "-01");
    m.setMonth(m.getMonth() + n);
    setMonth(iso(m).slice(0, 7));
    daySet("");
  };
  return (
    <div className="section calendarScreen">
      <div className="sectionTitle">
        <h2>
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
      <div className="monthGrid">
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
  );
}
export default function Wallet({ initialToday }: { initialToday: string }) {
  const [today, setToday] = useState(initialToday),
    [live, setLive] = useState<Entry[]>([]),
    [member, setMember] = useState<any>({ active: true, started: 0 }),
    [plan, setPlan] = useState<any>(null),
    [ai, setAI] = useState(false),
    [loaded, setLoaded] = useState(false),
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
    [pending, P] = useState(false);
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
    } finally {
      setLoaded(true);
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
  const close = () => {
    if (pending) return;
    D(null);
    E(undefined);
    I(null);
    C(false);
  };
  useEffect(() => {
    if (!detail && !imp) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", handle);
    };
  }, [detail, imp, pending]);
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
    upcount = upcoming.filter((e) => daysLeft(e.date, today) <= 7).length;
  const rows = (
    sortBy
      ? [...items].sort((a, b) => a.name.localeCompare(b.name, "zh"))
      : ordered
  ).filter(
    (e) =>
      (filter === "全部" || e.kind === filter) &&
      e.name.toLowerCase().includes(q.toLowerCase()),
  );
  const currentTab = tabs.find((t) => t.key === tab)!;
  function nav(v: Tab) {
    setTab(v);
    Q("");
    F("全部");
    S(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function start(m = "text") {
    if (!member.active) {
      nav("settings");
      M("试用已结束，请先开通使用权");
      return;
    }
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
      D(null);
      C(false);
      setIndex(0);
      M("订阅已移除");
    } catch (e: any) {
      M(e.message);
    } finally {
      P(false);
    }
  }
  const select = (r: Entry) => {
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
      {heading(
        "全部订阅",
        <div className="btnGroup">
          <button
            className="iconBtn"
            onClick={() => S(!search)}
            aria-label="搜索订阅"
          >
            <Search size={17} />
          </button>
          <button className="sortBtn" onClick={() => sort(!sortBy)}>
            <ArrowDownUp size={14} />
            {sortBy ? "按名称" : "按日期"}
          </button>
        </div>,
      )}
      {search && (
        <input
          className="search"
          autoFocus
          placeholder="搜索订阅名称"
          value={q}
          onChange={(e) => Q(e.target.value)}
        />
      )}
      <div className="filters">
        {["全部", "自动续费", "会员到期", "账单还款", "提醒复查"].map((f) => (
          <button
            className={filter === f ? "on" : ""}
            key={f}
            onClick={() => F(f)}
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
      {rows.length ? (
        rows.map((r) => (
          <button key={r.id} className="tableRow" onClick={() => select(r)}>
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
          {items.length ? "没有匹配的订阅" : "添加第一条订阅后，会在这里显示。"}
        </div>
      )}
    </section>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <nav>
          {tabs.slice(0, 3).map(({ key, name, Icon }) => (
            <button
              key={key}
              onClick={() => nav(key)}
              className={tab === key ? "active" : ""}
            >
              <Icon size={19} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sideBottom">
          <button
            className={tab === "settings" ? "active" : ""}
            onClick={() => nav("settings")}
          >
            <Settings2 size={19} />
            使用设置
          </button>
          <div className="profile">
            <b className="avatar">Y</b>
            <span>
              我的账本<small>{status}</small>
            </span>
          </div>
        </div>
      </aside>
      <main>
        <div className="topline">
          <div className="desktopCrumb">
            <span className="crumbDot" />
            <span>个人工作台</span>
            <ChevronRight size={13} />
            {currentTab.name}
          </div>
          <div className="mobileBrand">
            <Brand />
          </div>
          <button className="trial" onClick={() => nav("settings")}>
            <span />
            {status}
          </button>
        </div>
        <header className="pageHeader">
          <div>
            <p className="dateLine">
              {dateFrom(today).getFullYear()} 年 {Number(today.slice(5, 7))} 月{" "}
              {Number(today.slice(8))} 日<span> / </span>
              {"星期" + "日一二三四五六"[dateFrom(today).getDay()]}
            </p>
            <h1>{tab === "overview" ? "我的订阅" : currentTab.name}</h1>
          </div>
          <button
            className="primary add"
            onClick={() => start(ai ? "text" : "manual")}
          >
            <Plus size={18} />
            添加订阅
          </button>
        </header>
        {dbError && (
          <div className="warning">
            个人账本暂未载入。
            <button className="textBtn" onClick={() => refresh()}>
              重新加载
            </button>
          </div>
        )}
        {tab === "overview" && (
          <>
            <div className="metrics">
              <div>
                <span className="metricIcon purple">
                  <Coins size={19} />
                </span>
                <div>
                  <small>30 天内预计续费</small>
                  <strong>¥{total.toFixed(2)}</strong>
                  <em>
                    {expected.some((e) => e.currency !== "CNY")
                      ? "仅计人民币"
                      : "人民币"}
                  </em>
                </div>
              </div>
              <div>
                <span className="metricIcon coral">
                  <CalendarClock size={19} />
                </span>
                <div>
                  <small>7 天内事项</small>
                  <strong>
                    {upcount}
                    <i>笔</i>
                  </strong>
                </div>
              </div>
              <div>
                <span className="metricIcon azure">
                  <Layers size={19} />
                </span>
                <div>
                  <small>管理中</small>
                  <strong>
                    {items.length}
                    <i>项</i>
                  </strong>
                </div>
              </div>
            </div>
            <div className="dashGrid">
              <section className="section walletPanel">
                {heading(
                  "订阅卡包",
                  <span className="groupCount">
                    {demo ? "示例账本" : items.length + " 张卡片"}
                  </span>,
                )}
                {curr ? (
                  <>
                    <div className="deck">
                      {Array.from(
                        { length: Math.min(3, items.length) },
                        (_, j) => {
                          const n = Math.min(3, items.length) - 1 - j,
                            r = items[(index + n) % items.length],
                            slug = identifyBrand(r.name),
                            b = (brands as any)[slug];
                          return (
                            <button
                              key={r.id}
                              className={
                                "deckCard layer" + n + " brand-" + slug
                              }
                              style={
                                {
                                  "--card": b.dark,
                                  "--tint": b.light,
                                } as React.CSSProperties
                              }
                              onClick={() =>
                                n
                                  ? setIndex((index + n) % items.length)
                                  : select(r)
                              }
                              aria-label={
                                r.name + (n ? "，切换到此卡" : "，打开详情")
                              }
                            >
                              <span className="deckName">
                                <IconMark name={r.name} />
                                <span>{r.name}</span>
                                {n > 0 && <small>{r.cycle}</small>}
                              </span>
                              {n === 0 && (
                                <>
                                  <span className="deckChip">{r.cycle}</span>
                                  <CardArt slug={slug} />
                                  <span className="heroInfo">
                                    <small>
                                      {r.kind === "自动续费"
                                        ? "预计扣款"
                                        : r.kind === "账单还款"
                                          ? "预计还款"
                                          : "记录金额"}
                                    </small>
                                    <strong>{money(r)}</strong>
                                  </span>
                                  <span className="heroFoot">
                                    <span>
                                      <i />
                                      {r.kind}
                                    </span>
                                    <b>
                                      {shortDate(r.date)}{" "}
                                      <ChevronRight size={14} />
                                    </b>
                                  </span>
                                </>
                              )}
                            </button>
                          );
                        },
                      )}
                    </div>
                    <div className="deckNav">
                      <span>
                        <b>
                          {String((index % items.length) + 1).padStart(2, "0")}
                        </b>
                        <i> / </i>
                        {String(items.length).padStart(2, "0")}
                      </span>
                      <div className="dots">
                        {items.slice(0, 8).map((r, i) => (
                          <button
                            key={r.id}
                            aria-label={"显示 " + r.name}
                            className={index % items.length === i ? "on" : ""}
                            onClick={() => setIndex(i)}
                          />
                        ))}
                      </div>
                      <div className="arrows">
                        <button
                          aria-label="上一张卡"
                          onClick={() =>
                            setIndex((index + items.length - 1) % items.length)
                          }
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          aria-label="下一张卡"
                          onClick={() => setIndex((index + 1) % items.length)}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <button className="drop" onClick={() => start("manual")}>
                    <Plus />
                    添加第一张订阅卡
                  </button>
                )}
              </section>
              <section className="section upcoming">
                {heading(
                  "即将到期",
                  <button
                    className="iconBtn"
                    aria-label="查看日历"
                    onClick={() => nav("calendar")}
                  >
                    <ArrowUpRight size={18} />
                  </button>,
                )}
                <div className="agenda">
                  {upcoming.slice(0, 3).map((r) => (
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
                              background: (brands as any)[identifyBrand(r.name)]
                                .color,
                            }}
                          />
                          {r.kind} · {due(r.date, today)}
                        </small>
                      </span>
                      <b>{money(r)}</b>
                    </button>
                  ))}
                  {!upcoming.length && (
                    <div className="empty">暂时没有即将到期的记录</div>
                  )}
                </div>
                <button className="allCal" onClick={() => nav("calendar")}>
                  <CalendarDays size={15} />
                  查看完整日历
                  <ArrowRight size={14} />
                </button>
              </section>
            </div>
            {list()}
          </>
        )}
        {tab === "list" && list()}
        {tab === "calendar" && (
          <Month items={originals} today={today} select={select} />
        )}
        {tab === "settings" && (
          <div className="settings">
            <section className="section">
              {heading("使用权益")}
              <div className="memberHero">
                <SquareStack size={28} />
                <h2>{status}</h2>
                <p>
                  {member.started
                    ? "权益截止 " + new Date(member.end).toLocaleString("zh-CN")
                    : "首次保存记录或成功使用 AI 后开始计时。试用期间截图和文字导入均免费。"}
                </p>
              </div>
              {plan?.ready ? (
                <button
                  className="primary"
                  onClick={async () => {
                    try {
                      const r = await requestJSON("/api/checkout", {
                        method: "POST",
                      });
                      location.assign(r.url);
                    } catch (e: any) {
                      M(e.message);
                    }
                  }}
                >
                  支付宝购买 {plan.days} 天 · ¥{plan.price}
                </button>
              ) : (
                <p className="hint">付费方案待开放，试用结束后由你主动购买。</p>
              )}
            </section>
            <section className="section">
              {heading("账本设置")}
              <div className="settingRow">
                <span>
                  <b>示例账本</b>
                  <small>预览卡包，随时切回个人记录</small>
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
                  {demo ? "查看我的账本" : "查看示例"}
                </button>
              </div>
              <div className="settingRow">
                <span>
                  <b>截图与文字识别</b>
                  <small>gpt-6.2-sol</small>
                </span>
                <small>{ai ? "可用" : "等待服务端密钥"}</small>
              </div>
              <div className="settingRow">
                <span>
                  <b>iPhone 日历提醒</b>
                  <small>在订阅详情点击「加入日历」，按系统提示导入。</small>
                </span>
                <CalendarPlus size={18} />
              </div>
            </section>
          </div>
        )}
      </main>
      <nav className="mobileNav">
        {tabs.map(({ key, Icon, name }) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => nav(key)}
          >
            <Icon size={20} />
            {name}
          </button>
        ))}
      </nav>
      {detail && !imp && (
        <div
          className="modalLayer"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="订阅详情"
          >
            <div className="sheetHead">
              <div>
                <IconMark name={detail.name} />
                <h2>{detail.name}</h2>
              </div>
              <button className="iconBtn" aria-label="关闭" onClick={close}>
                <X size={19} />
              </button>
            </div>
            <div className="detailTop">
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
                ["备注", detail.note || "—"],
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
                    onClick={() =>
                      download(live.find((r) => r.id === detail.id) || detail)
                    }
                  >
                    <Download size={16} />
                    加入日历
                  </button>
                </div>
                <button
                  disabled={pending}
                  className="deleteBtn"
                  onClick={() => (confirm ? remove() : C(true))}
                >
                  {confirm ? "确认删除这条订阅？" : "删除订阅"}
                </button>
              </>
            )}
          </section>
        </div>
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
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </div>
  );
}
