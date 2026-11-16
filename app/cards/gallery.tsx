"use client";
import { useEffect, useRef, useState } from "react";
import type { MouseEventHandler } from "react";
import { ChevronLeft, ChevronRight, Grid2X2, Search, X } from "lucide-react";
import { brands, searchKey } from "../../public/brands.js";
import { catalog } from "../../public/catalog-data.js";
import { DialogLayer, type DialogControl } from "../motion";
import { WalletCard } from "../wallet-card";
import "./gallery.css";

const otherCategories: Record<string, string> = {
  icloud: "网盘存储",
  apple: "数码服务",
  spotify: "音乐听书",
  netflix: "影视视频",
  disney: "影视视频",
  youtube: "影视视频",
  chatgpt: "AI工具",
  claude: "AI工具",
  huabei: "账单还款",
  mobile: "通用卡面",
  custom: "通用卡面",
};
const bySlug = new Map(catalog.map((item) => [item.slug, item]));
const leading = [
  "china-unicom",
  "china-mobile",
  "china-telecom",
  "icloud",
  "spotify",
  "netflix",
  "tencent",
  "mango",
  "chatgpt",
  "bilibili",
  "kimi",
  "taobao",
];
const ordered = [
  ...new Set([
    ...leading,
    ...catalog.map((item) => item.slug),
    ...Object.keys(brands),
  ]),
];
const normal = (s: string) => searchKey(s).replace(/\s+/g, "");
const styles = ordered.map((slug) => {
  const brand = (brands as Record<string, { name: string }>)[slug];
  const listing = bySlug.get(slug);
  const category = listing?.category ?? otherCategories[slug] ?? "其他";
  const terms = [
    slug,
    brand.name,
    category,
    ...(listing?.aliases ?? []),
    listing?.plan ?? "",
    category === "通信套餐" ? "运营商" : "",
  ].map(normal);
  return { slug, name: brand.name, category, terms };
});
type CardStyle = (typeof styles)[number];
const byGallerySlug = new Set(styles.map(item => item.slug));
const categories = [...new Set(styles.map((s) => s.category))];
const genericCount = styles.filter((s) => s.category === "通用卡面").length;

function ExampleCard({
  item,
  onClick,
  lazy = false,
}: {
  item: CardStyle;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  lazy?: boolean;
}) {
  const bill = item.category === "账单还款";
  const entry = {
    name: item.name,
    kind: bill ? "账单还款" : "自动续费",
    cycle: "每月",
    amount: "28.00",
    currency: "CNY",
  };
  return (
    <WalletCard
      entry={entry}
      slug={item.slug}
      dateCaption="7 天后"
      dateText="12月9日"
      label={"放大查看" + item.name + "卡面"}
      onClick={onClick}
      lazy={lazy}
    />
  );
}

export default function CardGallery() {
  const [fromSettings, setFromSettings] = useState(false);
  useEffect(() => { setFromSettings(new URLSearchParams(location.search).get("from") === "settings"); }, []);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部"),
    [dense, setDense] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("card");
    if (slug && byGallerySlug.has(slug)) setSelection(slug);
  }, []);
  const opener = useRef<HTMLElement | null>(null),
    dialog = useRef<DialogControl>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const needle = normal(query);
  const matches = styles.filter(
    (s) =>
      (category === "全部" || category === s.category) &&
      (!needle || s.terms.some((t) => t.includes(needle))),
  );
  const index =
      selection === null ? -1 : matches.findIndex((s) => s.slug === selection),
    selected = matches[index];
  const filtered = Boolean(needle) || category !== "全部";
  function step(delta: number) {
    if (matches.length < 2) return;
    setSelection((current) => {
      const pos = matches.findIndex((s) => s.slug === current);
      return matches[(pos + delta + matches.length) % matches.length].slug;
    });
  }
  return (
    <main className="cardGallery">
      <nav className="galleryTop" aria-label="页面导航">
        <a href={fromSettings ? "/#settings" : "/"}>
          <ChevronLeft size={17} />
          {fromSettings ? "设置" : "卡包"}
        </a>
        <a href={fromSettings ? "/brands?from=settings" : "/brands"}>会员目录</a>
      </nav>
      <header className="galleryHeader">
        <h1>全部卡面</h1>
        <p>
          {styles.length - genericCount} 款品牌卡 · {genericCount} 款通用卡{" "}
          <span>金额与日期为示例</span>
        </p>
      </header>
      <div className="galleryTools">
        <label className="gallerySearch">
          <Search size={18} />
          <input
            aria-label="搜索卡面"
            type="search"
            placeholder="搜索品牌或会员名"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="按卡面分类筛选"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="全部">全部分类</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          type="button"
          className="density"
          aria-label="紧凑排列"
          title="紧凑排列"
          aria-pressed={dense}
          onClick={() => setDense((v) => !v)}
        >
          <Grid2X2 size={18} />
        </button>
      </div>
      {filtered && (
        <p className="galleryMatches" role="status">
          {matches.length} 款卡面
        </p>
      )}
      {matches.length > 0 ? (
        <ul className="galleryGrid" data-dense={dense}>
          {matches.map((item, i) => (
            <li className="galleryStage" key={item.slug} data-style={item.slug}>
              <ExampleCard
                item={item}
                lazy={i >= 6}
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setSelection(item.slug);
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="galleryEmpty">
          没有找到匹配的卡面。
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("全部");
            }}
          >
            查看全部
          </button>
        </div>
      )}
      {selected && (
        <DialogLayer
          controller={dialog}
          returnFocus={opener}
          onDismiss={() => setSelection(null)}
        >
          <section
            className="sheet gallerySheet"
            role="dialog"
            aria-modal="true"
            aria-label="卡面预览"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                step(e.key === "ArrowLeft" ? -1 : 1);
              }
            }}
          >
            <div className="gallerySheetHeader">
              <h2>卡面预览</h2>
              <button
                type="button"
                aria-label="关闭预览"
                onClick={() => dialog.current?.dismiss()}
              >
                <X size={20} />
              </button>
            </div>
            <div
              className="galleryStage enlarged"
              key={selected.slug}
              onTouchStart={(e) => {
                touch.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                };
              }}
              onTouchCancel={() => {
                touch.current = null;
              }}
              onTouchEnd={(e) => {
                if (!touch.current) return;
                const dx = e.changedTouches[0].clientX - touch.current.x,
                  dy = e.changedTouches[0].clientY - touch.current.y;
                touch.current = null;
                if (Math.abs(dx) > 45 && Math.abs(dx) > 1.5 * Math.abs(dy))
                  step(dx < 0 ? 1 : -1);
              }}
            >
              <ExampleCard item={selected} />
            </div>
            <div className="galleryPager">
              <button
                type="button"
                disabled={matches.length < 2}
                aria-label="上一款卡面"
                onClick={() => step(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span aria-live="polite" aria-atomic="true">
                <span className="galleryScreenReader">{selected.name}，</span>
                {index + 1} / {matches.length}
              </span>
              <button
                type="button"
                disabled={matches.length < 2}
                aria-label="下一款卡面"
                onClick={() => step(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        </DialogLayer>
      )}
    </main>
  );
}
