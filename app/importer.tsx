"use client";
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { reducedMotion } from "./motion";
import { catalog } from "../public/catalog-data.js";
import { identifyBrand } from "../public/brands.js";
import { BrandIcon } from "./brand-icon";
import {
  ImagePlus,
  PenLine,
  X,
  ScanLine,
  Check,
  Calendar,
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  blank,
  cycles,
  currencies,
  kinds,
  validDate,
  shift,
  Entry,
  iso,
  normalize,
  paymentLabels,
  type PaymentPart,
} from "@/lib/records";
const modes = [
  { key: "image", label: "截图", Icon: ImagePlus },
  { key: "manual", label: "手动", Icon: PenLine },
] as const;
export type ImportMode = (typeof modes)[number]["key"];

type SelectedImage = { id: string; src: string };

export async function requestJSON(path: string, init?: RequestInit) {
  let r: Response;
  try {
    r = await fetch(path, { ...init, cache: "no-store" });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw Error("连接中断，请检查网络后重试。");
  }
  if (r.status === 401 && import.meta.env.VITE_DUECUE_ACCOUNTS === "1") {
    location.replace("/login?next=" + encodeURIComponent(location.pathname + location.search + location.hash));
    throw Error("登录已过期，请重新登录。");
  }
  if (r.status === 413) throw Error("内容太大，请裁剪截图或分批添加。");
  let v: any;
  try {
    v = await r.json();
  } catch {
    throw Error("服务暂未响应，请稍后重试。");
  }
  if (!r.ok || v.error) throw Error(v.error || "操作失败，请稍后重试。");
  return v;
}
function getImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, 4200 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext("2d");
        if (!ctx) throw Error();
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.94));
      } catch {
        reject(Error("图片无法读取，请重新选择。"));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("请使用可读取的 PNG、JPEG 或 WebP 截图。"));
    };
    img.src = url;
  });
}
export default function Importer({
  edit,
  initialMode,
  catalogBrand,
  onRecognized,
  save,
  close,
}: {
  edit?: Entry;
  initialMode: ImportMode;
  catalogBrand?: string;
  onRecognized: (member: {
    active: boolean;
    started: number;
    end: number;
    paid: boolean;
  }) => void;
  save: (a: Entry[]) => Promise<void>;
  close: () => void;
}) {
  const [mode, setMode] = useState(initialMode),
    [images, setImages] = useState<SelectedImage[]>([]),
    [drafts, setDrafts] = useState<Entry[]>(() => {
      if (edit) return [edit];
      if (initialMode !== "manual") return [];
      const chosen = catalog.find((item) => item.slug === catalogBrand);
      if (!chosen) return [blank()];
      return [
        {
          ...blank(),
          name: chosen.name,
          kind: chosen.category === "通信套餐" ? "提醒复查" : "会员到期",
          cycle: "单次",
        },
      ];
    }),
    [step, setStep] = useState(0),
    [reviewHint, setReviewHint] = useState(""),
    [error, err] = useState(""),
    [busy, setBusy] = useState("");
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => job.current?.abort(), []);
  const file = useRef<HTMLInputElement>(null);
  const d = drafts[step];
  const paid = d?.kind === "已扣款";
  const manualDraft = useRef<Entry | undefined>(undefined);
  const nameQuery = mode === "manual" ? d?.name.trim().toLowerCase() : "";
  const suggestions = nameQuery ? catalog.filter(item =>
    item.name.toLowerCase() !== nameQuery &&
    [item.name, ...item.aliases].some(name => name.toLowerCase().includes(nameQuery))
  ).slice(0, 5) : [];
  const sheet = useRef<HTMLElement>(null);
  const oldHeight = useRef(0);
  const resize = useRef<Animation | null>(null);
  const stage = mode + ":" + (d ? step : "input");
  function rememberSheet() {
    oldHeight.current = sheet.current?.getBoundingClientRect().height || 0;
  }
  useLayoutEffect(() => {
    const node = sheet.current,
      from = oldHeight.current;
    oldHeight.current = 0;
    if (!node?.animate || !from || reducedMotion()) return;
    const to = node.getBoundingClientRect().height;
    if (Math.abs(to - from) < 2) return;
    resize.current = node.animate(
      [{ height: from + "px" }, { height: to + "px" }],
      {
        duration: 220,
        easing: "cubic-bezier(.22,1,.36,1)",
      },
    );
    return () => {
      resize.current?.cancel();
    };
  }, [stage]);
  function change(k: keyof Entry, v: any) {
    err("");
    setDrafts((ds) => ds.map((a, i) => (i === step ? { ...a, [k]: v } : a)));
  }
  function choose(m: ImportMode) {
    if (m === mode) return;
    rememberSheet();
    if (mode === "manual") manualDraft.current = d;
    setMode(m);
    setDrafts(m === "manual" ? [manualDraft.current || blank()] : []);
    setStep(0);
    err("");
  }
  async function recognize() {
    err("");
    setReviewHint("");
    setBusy("正在解析…");
    const controller = new AbortController();
    job.current = controller;
    try {
      const result = await requestJSON("/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ images: images.map(image => image.src), keepAlive: true }),
      });
      if (controller.signal.aborted) return;
      onRecognized(result.member);
      const items = result.items.map((item: Entry) => ({
        ...blank(), name: item.name, amount: item.amount, currency: item.currency,
        date: item.date, cycle: item.cycle, kind: item.kind, payment: item.payment,
      }));
      rememberSheet();
      if (!items.length) {
        setReviewHint("未找到可以自动填写的订阅，请补充服务名称。");
        items.push({ ...blank(), kind: "提醒复查", cycle: "待确认", currency: "" });
      }
      setDrafts(items);
      setStep(0);
    } catch (e: any) {
      if (!controller.signal.aborted) err(e instanceof Error && /[\u3400-\u9fff]/.test(e.message) ? e.message : "暂时无法解析，请重试或手动填写。");
    } finally {
      job.current = null;
      setBusy("");
    }
  }
  async function submit() {
    err("");
    const rows: Entry[] = [];
    for (const [i, draft] of drafts.entries()) {
      const row = normalize(draft);
      if (!row) {
        setStep(i);
        if (!draft.name.trim()) err("请填写服务名称。");
        else if (!draft.currency) err("请选择币种。");
        else if (draft.date && !validDate(draft.date)) err("请选择有效日期。");
        else err("请填写有效金额，例如 19.90。");
        return;
      }
      rows.push(row);
    }
    setBusy("正在保存…");
    try {
      await save(rows);
      close();
    } catch (e: any) {
      err(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={edit ? "编辑订阅" : d && mode === "image" ? "核对订阅" : "添加订阅"}
      aria-busy={!!busy}
      ref={sheet}
      className="sheet importSheet"
    >
      <div className="sheetHead">
        <div>
          <span className="miniIcon">
            <ScanLine size={18} />
          </span>
          <h2>
            {edit
              ? "编辑订阅"
              : d && mode !== "manual"
                ? "核对订阅"
                : "添加订阅"}
          </h2>
        </div>
        <button
          className="iconBtn"
          onClick={() => { job.current?.abort(); close(); }}
          disabled={busy === "正在保存…"}
          aria-label="关闭"
        >
          <X size={19} />
        </button>
      </div>
      {!edit && (!d || mode === "manual") && (
        <div
          className="segments"
          style={
            {
              "--choice": modes.findIndex(item => item.key === mode),
              "--slots": modes.length,
            } as React.CSSProperties
          }
        >
          {modes.map(({ key, label, Icon }) => (
            <button
              key={key}
              aria-pressed={mode === key}
              disabled={!!busy}
              className={mode === key ? "sel" : ""}
              onClick={() => choose(key)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="formStage motionReveal" key={stage}>
        {!d ? (
          <>
            <div className="formBox">
              <input
                hidden
                ref={file}
                type="file"
                multiple
                accept="image/*"
                onChange={async (e) => {
                  const fs = Array.from(e.target.files || []);
                  e.target.value = "";
                  if (!fs.length) return;
                  setBusy("正在读取截图…");
                  try {
                    const next: SelectedImage[] = [];
                    for (const f of fs) next.push({ id: crypto.randomUUID(), src: await getImage(f) });
                    setImages(current => [...current, ...next]);
                    err("");
                  } catch (ex: any) {
                    err(ex.message);
                  } finally {
                    setBusy("");
                  }
                }}
              />
              <button
                disabled={!!busy}
                className="drop"
                onClick={() => file.current?.click()}
              >
                <ImagePlus size={28} />
                {images.length ? "继续添加截图" : "选择截图"}
              </button>
              {images.length > 0 && (
                <ul className="thumbs" aria-label="已选截图">
                  {images.map((im, i) => (
                    <li key={im.id}>
                      <img src={im.src} alt={`截图 ${i + 1}`} />
                      <button type="button" disabled={!!busy} aria-label={`移除第 ${i + 1} 张截图`}
                        onClick={() => { setImages(current => current.filter(item => item.id !== im.id)); err(""); }}>
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary wide"
              disabled={!!busy || !images.length}
              onClick={recognize}
            >
              {busy || "AI解析"}
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ScanLine size={17} />
              )}
            </button>
          </>
        ) : (
          <>
            {drafts.length > 1 && (
              <div className="reviewPager">
                <button type="button" className="iconBtn" aria-label="上一条" disabled={step === 0 || !!busy}
                  onClick={() => { setStep(step - 1); err(""); }}><ChevronLeft size={18} /></button>
                <span>第 {step + 1} / {drafts.length} 条 · 一起保存</span>
                <button type="button" className="iconBtn" aria-label="下一条" disabled={step === drafts.length - 1 || !!busy}
                  onClick={() => { setStep(step + 1); err(""); }}><ChevronRight size={18} /></button>
              </div>
            )}
            {reviewHint && <p className="importHint" role="status">{reviewHint}</p>}
            <div className="fields">
              <label className="full">
                服务名称
                <span className="nameEntry">
                  <BrandIcon
                    key={identifyBrand(d.name)}
                    name={d.name}
                    className="motionReveal"
                  />
                  <input
                    maxLength={80}
                    list={suggestions.length ? "subscription-brands" : undefined}
                    autoComplete="off"
                    placeholder="例如：芒果 TV"
                    value={d.name}
                    onChange={(e) => change("name", e.target.value)}
                  />
                </span>
              </label>
              {suggestions.length > 0 && (
                <datalist id="subscription-brands">
                  {suggestions.map((item) => (
                    <option key={item.slug} value={item.name}>{item.plan}</option>
                  ))}
                </datalist>
              )}
              <label>
                类型
                <select
                  aria-label="类型"
                  value={d.kind}
                  onChange={(e) => {
                    const kind = e.target.value;
                    setDrafts(ds => ds.map((row, i) => i !== step ? row : {
                      ...row, kind, date: kind === "已扣款" ? "" : row.date,
                      payment: kind === "已扣款" ? { date: "" } : undefined,
                    }));
                    err("");
                  }}
                >
                  {kinds.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                周期
                <select
                  aria-label="周期"
                  value={d.cycle}
                  onChange={(e) => change("cycle", e.target.value)}
                >
                  {cycles.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                {paid ? "实扣金额" : "预计金额"}
                <input
                  inputMode="decimal"
                  placeholder="待确认"
                  value={d.amount}
                  onChange={(e) => change("amount", e.target.value)}
                />
              </label>
              <label>
                币种
                <select
                  aria-label="币种"
                  value={d.currency}
                  onChange={(e) => change("currency", e.target.value)}
                >
                  <option value="" disabled>
                    请选择币种
                  </option>
                  {currencies.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                {paid ? "交易日期" : d.kind === "提醒复查" ? "复查日" : "下次日期"}
                <input
                  type="date"
                  value={paid ? d.payment?.date || "" : d.date}
                  onChange={(e) => paid ? change("payment", { ...d.payment, date: e.target.value }) : change("date", e.target.value)}
                />
              </label>
              {!paid && <label>
                日历提醒
                <select
                  aria-label="日历提醒"
                  value={d.remind}
                  onChange={(e) => change("remind", Number(e.target.value))}
                >
                  {[0, 1, 3, 7].map((n) => (
                    <option key={n} value={n}>
                      {n ? "提前 " + n + " 天" : "当天"}
                    </option>
                  ))}
                </select>
              </label>}
              {paid && d.payment && Object.keys(paymentLabels).some(key => d.payment?.[key as PaymentPart]) && (
                <details className="full paymentBreakdown" key={d.id}>
                  <summary>扣款明细</summary>
                  <div className="fields">
                    {(Object.keys(paymentLabels) as PaymentPart[]).map(key => {
                      const part = d.payment?.[key];
                      if (!part) return null;
                      const update = (patch: Partial<typeof part>) => {
                        change("payment", { ...d.payment, [key]: { ...part, ...patch } });
                      };
                      return <div className="paymentPart" key={key}>
                        <label>{paymentLabels[key]}<input inputMode="decimal" value={part.amount} onChange={e => update({ amount: e.target.value })} /></label>
                        <label>币种<select aria-label={paymentLabels[key] + "币种"} value={part.currency} onChange={e => update({ currency: e.target.value })}>
                          {currencies.map(x => <option key={x}>{x}</option>)}
                        </select></label>
                      </div>;
                    })}
                  </div>
                </details>
              )}
              <label className="full">
                备注
                <input
                  maxLength={600}
                  value={d.note}
                  placeholder="选填"
                  onChange={(e) => change("note", e.target.value)}
                />
              </label>
            </div>
            {!paid && !d.date && (
              <button
                className="textBtn"
                onClick={() =>
                  setDrafts((ds) =>
                    ds.map((x, i) =>
                      i === step
                        ? {
                            ...x,
                            kind: "提醒复查",
                            cycle: "单次",
                            date: shift(iso(new Date()), 7),
                            remind: 0,
                          }
                        : x,
                    ),
                  )
                }
              >
                <Calendar size={15} /> 7 天后提醒核对
              </button>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <button type="button" className="soft" disabled={!!busy} onClick={close}>取消</button>
              <button
                disabled={!!busy}
                className="primary"
                onClick={submit}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Check size={17} />
                )}
                {busy || (edit ? "保存更改" : "保存订阅")}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
