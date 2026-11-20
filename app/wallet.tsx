"use client";
import { useState, useEffect, useRef } from "react";
import {
  WalletCards,
  ScanLine,
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
  CircleUserRound,
  Ticket,
  MessageSquarePlus,
  LibraryBig,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { catalog } from "../public/catalog-data.js";
import { brands, identifyBrand } from "../public/brands.js";
import { applyAppVersion, watchAppVersion } from "../public/app-update.js";
import { CardRequests } from "./card-requests";
import { RedeemTime } from "./redeem-time";
import { BrandIcon } from "./brand-icon";
import { WalletCard } from "./wallet-card";
import {
  examples,
  kinds,
  paymentLabels,
  type PaymentPart,
  iso,
  dateFrom,
  daysLeft,
  money,
  calendarFile,
  Entry,
  shift,
} from "@/lib/records";
import { atOrAfter, occurrencesBetween } from "@/lib/recurrence";
import Importer, { requestJSON, type ImportMode } from "./importer";
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
type SettingsPage = "home" | "feedback" | "redeem";
function SettingsRow({ icon: Icon, title, caption, tone = "purple", href, onClick }: {
  icon: LucideIcon;
  title: string;
  caption?: string;
  tone?: "purple" | "blue" | "teal" | "amber";
  href?: string;
  onClick?: () => void;
}) {
  const content = <>
    <span className={"settingIcon tone-" + tone}><Icon size={18} aria-hidden="true" /></span>
    <span className="settingText"><b>{title}</b>{caption && <small>{caption}</small>}</span>
    {(href || onClick) && <ChevronRight className="settingArrow" size={17} aria-hidden="true" />}
  </>;
  if (href) return <a className="settingRow" href={href}>{content}</a>;
  if (onClick) return <button type="button" className="settingRow" onClick={onClick}>{content}</button>;
  return <div className="settingRow">{content}</div>;
}

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
const calendarLabels: Record<string, string> = {
  自动续费: "续费",
  会员到期: "到期",
  账单还款: "还款",
  提醒复查: "复查",
};
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
  const monthItems = items
    .map((entry) => atOrAfter(entry, month + "-01"))
    .filter((entry) => entry.date.startsWith(month + "-"))
    .sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map<string, Entry[]>();
  for (const entry of monthItems) {
    const group = byDate.get(entry.date);
    if (group) group.push(entry);
    else byDate.set(entry.date, [entry]);
  }
  const matches = day ? byDate.get(day) || [] : monthItems;
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
          const date = month + "-" + String(i + 1).padStart(2, "0");
          const events = byDate.get(date) || [];
          const type =
            events.length === 1
              ? events[0].kind
              : events.length
                ? "多项"
                : undefined;
          const isToday = date === today;
          const label =
            events.length > 1
              ? events.length + "项"
              : type
                ? calendarLabels[type] || "事项"
                : isToday
                  ? "今天"
                  : "";
          return (
            <button
              type="button"
              key={date}
              className="calendarDay"
              data-kind={type}
              data-day={date}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={day === date}
              aria-controls="calendar-agenda"
              aria-label={[
                shortDate(date),
                isToday && "今天",
                events.length ? events.length + "项" : "无事项",
                ...events.map((e) => e.name + " " + e.kind),
              ]
                .filter(Boolean)
                .join("，")}
              onClick={() => daySet(day === date ? "" : date)}
            >
              <span className="dayNumber">{i + 1}</span>
              <span className="dayCaption">{label}</span>
            </button>
          );
        })}
      </div>
      <div
        key={"agenda-" + (day || month)}
        id="calendar-agenda"
        className="calendarAgenda motionReveal"
      >
        <h3>
          {day ? shortDate(day) : "本月事项"}
          {matches.length > 0 && <small>{matches.length} 项</small>}
        </h3>
        {matches.length ? (
          matches.map((e) => (
            <button className="dateRow" key={e.id} onClick={() => select(e)}>
              <BrandIcon name={e.name} />
              <span className="calendarService">
                <strong>{e.name}</strong>
                <small data-kind={e.kind}>
                  {e.kind}
                  {!day && ` · ${shortDate(e.date)}`}
                </small>
              </span>
              <b className="calendarAmount">{money(e)}</b>
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
export default function Wallet({ initialToday, release }: { initialToday: string; release: string }) {
  const [today, setToday] = useState(initialToday),
    [live, setLive] = useState<Entry[]>([]),
    [member, setMember] = useState<any>({ active: true, started: 0 }),
    [plan, setPlan] = useState<any>(null),
    [dbError, setDbError] = useState(""),
    [walletReady, setWalletReady] = useState(false),
    [tab, setTab] = useState<Tab>("overview"),
    [settingsPage, setSettingsPage] = useState<SettingsPage>("home"),
    [demo, setDemo] = useState(false),
    [index, setIndex] = useState(0),
    [filter, F] = useState("全部"),
    [q, Q] = useState(""),
    [search, S] = useState(false),
    [sortBy, sort] = useState(false),
    [imp, I] = useState<ImportMode | null>(null),
    [catalogBrand, setCatalogBrand] = useState(""),
    [detail, D] = useState<Entry | null>(null),
    [edit, E] = useState<Entry | undefined>(),
    [msg, M] = useState(""),
    [confirm, C] = useState(false),
    [pending, P] = useState(false),
    [purchasing, setPurchasing] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [navDirection, setNavDirection] = useState(1);
  const [availableVersion, setAvailableVersion] = useState("");
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
  useEffect(() => watchAppVersion(release, setAvailableVersion), [release]);
  const canUpdate = (walletReady || !!dbError) && !imp && !detail && !pending &&
    !purchasing && !refreshing && !search && settingsPage === "home";
  useEffect(() => {
    if (canUpdate && availableVersion) applyAppVersion(availableVersion);
  }, [canUpdate, availableVersion]);
  function rememberOpener() {
    if (!detail && !imp) opener.current = document.activeElement as HTMLElement;
  }
  async function refresh() {
    try {
      const s = await requestJSON("/api/wallet");
      setLive(s.entries);
      setMember(s.member);
      setPlan(s.plan);
      setWalletReady(true);
      setDemo(localStorage.getItem("youqi:hide-demo") === "no");
      setDbError("");
      const url = new URL(window.location.href);
      if (url.searchParams.has("brand")) {
        const chosen = catalog.find(
          (item) => item.slug === url.searchParams.get("brand"),
        );
        url.searchParams.delete("brand");
        window.history.replaceState(
          window.history.state,
          "",
          url.pathname + url.search + url.hash,
        );
        if (chosen && s.member.active) {
          setCatalogBrand(chosen.slug);
          I("manual");
        } else if (chosen) {
          setTab("settings");
          M("试用已结束，已有订阅仍可查看。");
        }
      }
    } catch (e: any) {
      setDbError(e.message);
    }
  }
  useEffect(() => {
    const restoreTab = () => {
      const match = tabs.find(t => "#" + t.key === location.hash);
      setTab(match?.key || "overview");
    };
    restoreTab();
    window.addEventListener("hashchange", restoreTab);
    setToday(iso(new Date()));
    refresh();
    const handle = () => {
      if (document.visibilityState === "visible") {
        setToday(iso(new Date()));
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      window.removeEventListener("hashchange", restoreTab);
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => M(""), 3500);
    return () => clearTimeout(id);
  }, [msg]);
  function finishDismiss() {
    setCatalogBrand("");
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
    deckSize = Math.min(6, items.length),
    hiddenCount = items.length - deckSize,
    folded = hiddenCount ? items[(index + deckSize) % items.length] : null;
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
    if (v === tab) {
      if (v === "settings") setSettingsPage("home");
      return;
    }
    setSettingsPage("home");
    setNavDirection(tabs.findIndex((t) => t.key === v) > tabIndex ? 1 : -1);
    setTab(v);
    window.history.replaceState(window.history.state, "", v === "overview" ? "/" : "/#" + v);
    Q("");
    F("全部");
    S(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function start(m: ImportMode) {
    if (!member.active) {
      nav("settings");
      M("试用已结束，已有订阅仍可查看。");
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
    status = member.permanent ? "永久使用" : member.started
      ? member.active
        ? member.paid
          ? "会员有效"
          : "试用剩余 " +
            Math.max(1, Math.ceil((member.end - Date.now()) / 86400000)) +
            " 天"
        : "使用时长已到期"
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
        {["全部", ...kinds].map((f) => (
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
                <BrandIcon name={r.name} />
                <span>
                  <b>{r.name}</b>
                  <small>
                    {r.cycle} · {r.kind}
                  </small>
                </span>
              </span>
              <span className="rowDate">{shortDate(r.payment?.date || r.date)}</span>
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
          <a className="homeIcon" href="/" aria-label="卡包首页">
            <img src="/apple-touch-icon.png" width="34" height="34" alt="" />
          </a>
          {navigation("desktop")}
        </div>
      </header>
      <main
        className={tab === "overview" ? "walletApp walletHome" : "walletApp"}
        inert={!!(detail || imp)}
        style={{ "--direction": navDirection } as React.CSSProperties}
      >
        <header className="pageHeader">
          <div className="pageTitle motionReveal" key={tab + settingsPage}>
            <h1>{tab === "settings" && settingsPage !== "home"
              ? settingsPage === "feedback" ? "卡片留言" : "兑换时长"
              : pageTitles[tab]}</h1>
            {demo && tab !== "settings" && (
              <span className="demoLabel">示例</span>
            )}
          </div>
          {tab === "settings" && settingsPage !== "home" && (
            <button type="button" className="soft settingsBack" onClick={() => setSettingsPage("home")}>
              <ChevronLeft size={16} aria-hidden="true" /> 返回设置
            </button>
          )}
          {walletReady && tab !== "settings" && (
            <div className="walletActions">
              {tab === "overview" && (
                <button
                  className="scanShortcut"
                  onClick={() => start("image")}
                  aria-label="识别截图"
                  title="识别截图"
                >
                  <ScanLine size={21} />
                </button>
              )}
              <button
                className="primary add"
                aria-label="添加订阅"
                onClick={() => start("manual")}
              >
                <Plus size={21} strokeWidth={2.2} />
                <span>添加订阅</span>
              </button>
            </div>
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
        {!walletReady && !dbError && <p className="hint" role="status">正在打开账本…</p>}
        {walletReady && <div key={tab} className="pageStage motionSlide">
          {tab === "overview" && (
            <>
              <div className="dashGrid">
                <section className="walletPanel" aria-label="订阅卡片">
                  {curr ? (
                    <>
                      <div className="cardPocket" data-overflow={!!folded}>
                        {folded && (
                          <button
                            className="moreCards"
                            aria-label={`还有 ${hiddenCount} 张，显示${folded.name}`}
                            onClick={() => moveCard(deckSize)}
                            style={
                              {
                                "--fold-color": (brands as any)[
                                  identifyBrand(folded.name)
                                ].dark,
                              } as React.CSSProperties
                            }
                          >
                            <span className="foldEdge" aria-hidden="true" />
                            <span className="foldCount">
                              还有 {hiddenCount} 张<ChevronRight size={13} />
                            </span>
                          </button>
                        )}
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
                            const travel = Math.max(
                              -48,
                              Math.min(48, dx * 0.32),
                            );
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
                            return (
                              <WalletCard
                                key={r.id}
                                motionId={r.id}
                                entry={r}
                                slug={slug}
                                level={n}
                                slot={j}
                                dateCaption={n ? "" : r.kind === "已扣款" ? "交易日期" : due(r.date, today)}
                                dateText={n ? "" : shortDate(r.payment?.date || r.date)}
                                label={
                                  r.name + (n ? "，切换到此卡" : "，打开详情")
                                }
                                onClick={() => {
                                  if (Date.now() - lastSwipe.current < 450)
                                    return;
                                  if (n) moveCard(n);
                                  else select(r);
                                }}
                              />
                            );
                          })}
                          <div
                            ref={ghosts}
                            className="cardGhosts"
                            inert
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                      {items.length > 1 && (
                        <div className="deckNav withGallery">
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
                          <a className="deckGalleryLink" href="/cards">
                            全部卡面
                          </a>
                        </div>
                      )}
                      {items.length === 1 && (
                        <a className="singleGalleryLink" href="/cards">
                          全部卡面
                        </a>
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
            <div className={"settings" + (settingsPage !== "home" ? " settingsSubpage" : "")}>
              {settingsPage === "feedback" ? <CardRequests />
                : settingsPage === "redeem" ? <RedeemTime onRedeemed={setMember} />
                : <>
                  <section className="settingsGroup" aria-labelledby="accountPrefsTitle">
                    <h2 id="accountPrefsTitle">账号与权益</h2>
                    <div className="settingsCard">
                      {import.meta.env.VITE_DUECUE_ACCOUNTS === "1" && (
                        <SettingsRow icon={CircleUserRound} title="我的账号" caption="昵称与登录方式" href="/account" />
                      )}
                      <div className="membership">
                        <div className="memberHero">
                          <span className="settingIcon tone-purple"><SquareStack size={18} aria-hidden="true" /></span>
                          <div className="settingText">
                            <b>{status}</b>
                            <small>{member.permanent ? "使用权益长期有效" : member.started
                              ? "有效至 " + new Date(member.end).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
                              : "首次保存订阅或完成解析时开始计时。"}</small>
                          </div>
                        </div>
                        {!member.permanent && plan?.preview && (
                          <details className="membershipPreview">
                            <summary>查看支付宝购买演示</summary>
                            <p><b>¥{plan.price}</b> · 知期 {plan.days} 天使用权</p>
                            <p>核对时长和金额，再进入支付宝收银台。知期确认到账后，会延长当前账号的使用时长。</p>
                            <small>演示套餐 · 商户收款额度审核中</small>
                          </details>
                        )}
                        {!member.permanent && plan?.ready && (
                          <button className="primary membershipPurchase" disabled={purchasing} aria-busy={purchasing}
                            onClick={async () => {
                              setPurchasing(true);
                              try {
                                const result = await requestJSON("/api/checkout", { method: "POST" });
                                if (result.paid) {
                                  location.assign("/payment/result?out_trade_no=" + encodeURIComponent(result.orderId));
                                  return;
                                }
                                const doc = new DOMParser().parseFromString(result.paymentHtml, "text/html");
                                const paymentForm = doc.querySelector("form");
                                if (!paymentForm) throw new Error("支付宝付款表单无效。");
                                paymentForm.hidden = true;
                                document.body.appendChild(paymentForm);
                                HTMLFormElement.prototype.submit.call(paymentForm);
                              } catch (e) {
                                setPurchasing(false);
                                M(e instanceof Error ? e.message : "暂时无法打开支付宝。");
                              }
                            }}>
                            {purchasing ? "正在打开支付宝…" : `支付宝购买 ${plan.days} 天 · ¥${plan.price}`}
                          </button>
                        )}
                      </div>
                      {import.meta.env.VITE_DUECUE_ACCOUNTS === "1" && (
                        <SettingsRow icon={Ticket} title="使用兑换码" caption="延长知期使用时长" tone="teal"
                          onClick={() => setSettingsPage("redeem")} />
                      )}
                    </div>
                  </section>
                  <section className="settingsGroup" aria-labelledby="toolPrefsTitle">
                    <h2 id="toolPrefsTitle">卡片与工具</h2>
                    <div className="settingsCard">
                      {import.meta.env.VITE_DUECUE_ACCOUNTS === "1" && (
                        <SettingsRow icon={MessageSquarePlus} title="卡片留言" caption="建议添加一张新卡片" tone="purple"
                          onClick={() => setSettingsPage("feedback")} />
                      )}
                      <SettingsRow icon={Layers3} title="全部卡面" href="/cards?from=settings" tone="blue" />
                      <SettingsRow icon={LibraryBig} title="国内会员目录" caption={`${catalog.length} 项会员与套餐`}
                        href="/brands?from=settings" tone="teal" />
                      <SettingsRow icon={ScanLine} title="AI解析" caption="从截图添加订阅" tone="blue" onClick={() => start("image")} />
                      <SettingsRow icon={FlaskConical} title={demo ? "返回我的卡包" : "查看示例账本"} tone="amber"
                        onClick={() => {
                          localStorage.setItem("youqi:hide-demo", demo ? "yes" : "no");
                          setDemo(!demo);
                          setIndex(0);
                          nav("overview");
                        }} />
                    </div>
                    <p className="settingHelp"><CalendarPlus size={16} aria-hidden="true" /> 打开订阅详情可加入 iPhone 日历。</p>
                  </section>
                </>}
            </div>
          )}
        </div>}
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
                  <BrandIcon name={detail.name} />
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
                  detail.kind === "已扣款" ? ["交易日期", detail.payment?.date || "待确认"] : ["下次日期", shortDate(detail.date)],
                  ["周期", detail.cycle],
                  ...(detail.kind === "已扣款"
                    ? (Object.keys(paymentLabels) as PaymentPart[]).flatMap(key => {
                        const part = detail.payment?.[key];
                        return part ? [[paymentLabels[key], Number(part.amount).toFixed(2) + " " + part.currency]] : [];
                      })
                    : [["日历提醒", detail.remind ? "提前 " + detail.remind + " 天" : "当天"]]),
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
                    {detail.kind !== "已扣款" && <button
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
                    </button>}
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
              catalogBrand={catalogBrand}
              onRecognized={setMember}
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
