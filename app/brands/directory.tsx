"use client";
import { useState } from "react";
import { ChevronLeft, Plus, Search, ExternalLink } from "lucide-react";
import { catalog } from "../../public/catalog-data.js";
import { searchKey } from "../../public/brands.js";
import { BrandIcon } from "../brand-icon";
import "./directory.css";

const interests: Record<string, string[]> = {
  影视视频: ["影音娱乐", "看剧", "电视"],
  音乐听书: ["影音娱乐", "听歌", "听书", "通勤"],
  阅读知识: ["读书", "阅读", "学习"],
  网盘存储: ["数码", "备份", "文件"],
  办公效率: ["职场", "办公", "上班族"],
  创作工具: ["创作者", "摄影", "剪辑", "设计"],
  AI工具: ["开发者", "职场", "学生", "创作者"],
  教育学习: ["学生", "自学", "备考"],
  亲子家庭: ["家长", "儿童", "育儿", "幼儿"],
  健康运动: ["健身", "跑步", "运动"],
  兴趣休闲: ["兴趣", "休闲"],
  社交游戏: ["社交", "玩家", "游戏"],
  购物商超: ["购物", "家庭采购"],
  本地生活: ["餐饮", "外卖", "生活"],
  出行旅行: ["旅行", "通勤", "出差"],
  家庭设备: ["安防", "看护", "摄像机"],
  通信套餐: ["手机号", "话费", "通信"],
};
const seniorServices = new Set([
  "tangdou",
  "meipian",
  "xiqu-duoduo",
  "ximalaya",
  "qingting",
  "lanren-audio",
  "we-sing",
  "ncpa-classical",
]);
const categoryNames = Array.from(new Set(catalog.map((item) => item.category)));
const categories = [
  ...Object.keys(interests).filter((name) => categoryNames.includes(name)),
  ...categoryNames.filter((name) => !(name in interests)),
];
const norm = (v: string) => searchKey(v).replace(/\s+/g, "");
const indexed = catalog.map((item) => ({
  item,
  terms: [
    item.name,
    item.plan,
    item.category,
    ...item.aliases,
    ...(item.television ? [item.television.name, "电视大屏", "电视端"] : []),
    ...(interests[item.category] || []),
    ...(seniorServices.has(item.slug) ? ["长辈", "老人", "银发"] : []),
  ].map(norm),
}));

export default function Directory() {
  const [filter, setFilter] = useState("全部"),
    [query, setQuery] = useState("");
  const needle = norm(query);
  const matches = indexed.filter(
    ({ item, terms }) =>
      (filter === "全部" || filter === item.category) &&
      terms.some((term) => term.includes(needle)),
  );
  return (
    <main className="catalogPage">
      <a className="catalogBack" href="/">
        <ChevronLeft size={18} /> 卡包
      </a>
      <header className="catalogHeader">
        <div>
          <h1>国内会员目录</h1>
          <p>
            {catalog.length} 项会员与套餐 · {categories.length} 个场景
          </p>
        </div>
      </header>
      <div className="catalogControls">
        <label className="catalogSearch">
          <Search size={18} />
          <input
            aria-label="搜索品牌、会员或人群"
            type="search"
            placeholder="搜平台、会员名或人群"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="按场景筛选"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="全部">全部场景</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {(query.trim() || filter !== "全部") && (
        <p className="catalogResult" role="status">
          {matches.length} 个结果
        </p>
      )}
      {categories.map((c) => {
        const rows = matches.filter(({ item }) => item.category === c);
        return (
          rows.length > 0 && (
            <section className="catalogSection" key={c}>
              <h2>
                {c}
                <span>{rows.length}</span>
              </h2>
              <ul>
                {rows.map(({ item }) => (
                  <li key={item.slug}>
                    <BrandIcon name={item.slug} lazy />
                    <div>
                      <b>{item.name}</b>
                      <a
                        className="catalogProof"
                        href={item.evidence}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={item.name + "的官方付费说明"}
                      >
                        {item.plan}
                        <ExternalLink size={12} />
                      </a>
                      {item.television && (
                        <a
                          className="catalogProof"
                          href={item.television.evidence}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={item.television.name + "官方说明"}
                        >
                          {item.television.name}
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <a
                      className="catalogAdd"
                      href={"/?brand=" + encodeURIComponent(item.slug)}
                      aria-label={"添加" + item.name}
                    >
                      <Plus size={17} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )
        );
      })}
      {matches.length === 0 && (
        <p className="catalogEmpty">
          没有找到匹配的服务。
          <button
            onClick={() => {
              setQuery("");
              setFilter("全部");
            }}
          >
            查看全部
          </button>
        </p>
      )}
    </main>
  );
}
