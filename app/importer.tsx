"use client";
import { useState, useRef } from "react";
import { badge, identifyBrand } from "../public/brands.js";
import {
  AlignLeft,
  ImagePlus,
  PenLine,
  X,
  Plus,
  ScanLine,
  Check,
  Calendar,
  LoaderCircle,
  ChevronLeft,
  TriangleAlert,
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
} from "@/lib/records";
type Draft = Entry & {
  evidence?: string;
  uncertainty?: string;
  picture?: string;
};
export async function requestJSON(path: string, init?: RequestInit) {
  const r = await fetch(path, { ...init, cache: "no-store" });
  let v: any;
  try {
    v = await r.json();
  } catch {
    throw Error("服务暂未响应，请稍后重试。");
  }
  if (!r.ok) throw Error(v.error || "操作失败，请稍后重试。");
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
  ai,
  save,
  close,
}: {
  edit?: Entry;
  initialMode: string;
  ai: boolean;
  save: (a: Entry[]) => Promise<void>;
  close: () => void;
}) {
  const [mode, setMode] = useState(initialMode),
    [input, setInput] = useState(""),
    [images, setImages] = useState<string[]>([]),
    [base, setBase] = useState(""),
    [drafts, setDrafts] = useState<Draft[]>(() =>
      edit ? [edit] : initialMode === "manual" ? [blank()] : [],
    ),
    [step, setStep] = useState(0),
    [error, err] = useState(""),
    [busy, setBusy] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const d = drafts[step];
  function change(k: keyof Draft, v: any) {
    setDrafts((ds) => ds.map((a, i) => (i === step ? { ...a, [k]: v } : a)));
  }
  function choose(m: string) {
    setMode(m);
    setDrafts(m === "manual" ? [blank()] : []);
    setStep(0);
    err("");
  }
  async function recognize() {
    err("");
    setBusy("正在识别…");
    try {
      const items: Draft[] = [];
      const sources = mode === "image" ? images : [""];
      for (const [i, im] of sources.entries()) {
        setBusy("正在识别 " + (i + 1) + " / " + sources.length);
        const result = await requestJSON("/api/recognize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: mode === "text" ? input : "",
            image: im,
            baseDate: mode === "text" ? iso(new Date()) : base,
          }),
        });
        for (const a of result.items) {
          items.push({
            ...blank(),
            name: a.name,
            amount: a.amount,
            currency: a.currency || "",
            date: a.date,
            cycle: a.cycle,
            kind: a.kind,
            evidence: a.evidence,
            uncertainty: a.uncertainty,
            note: [a.evidence, a.uncertainty]
              .filter(Boolean)
              .join(" · ")
              .slice(0, 600),
            picture: im,
          });
        }
      }
      if (!items.length)
        throw Error(
          "没有读到订阅信息。可以裁剪包含续费说明的区域，或手动填写。",
        );
      setDrafts(items);
      setStep(0);
    } catch (e: any) {
      err(e.message);
    } finally {
      setBusy("");
    }
  }
  async function submit() {
    err("");
    const row = normalize(d);
    if (!row) {
      err("请核对服务名称、币种、金额和日期，金额最多保留两位小数。");
      return;
    }
    if (step + 1 < drafts.length) {
      setStep(step + 1);
      return;
    }
    setBusy("正在保存…");
    try {
      await save(drafts.map((v) => normalize(v)!));
      close();
    } catch (e: any) {
      err(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div
      className="modalLayer"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={edit ? "编辑订阅" : "添加订阅"}
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
                  ? "核对识别结果"
                  : "添加订阅"}
            </h2>
          </div>
          <button
            className="iconBtn"
            onClick={close}
            disabled={!!busy}
            aria-label="关闭"
          >
            <X size={19} />
          </button>
        </div>
        {!edit && (!d || mode === "manual") && (
          <div className="segments">
            {[
              ["text", "文字", AlignLeft],
              ["image", "截图", ImagePlus],
              ["manual", "手动", PenLine],
            ].map(([key, label, I]: any) => (
              <button
                key={key}
                disabled={!!busy}
                className={mode === key ? "sel" : ""}
                onClick={() => choose(key)}
              >
                <I size={16} />
                {label}
              </button>
            ))}
          </div>
        )}
        {!d ? (
          <>
            <div className="formBox">
              {mode === "text" ? (
                <label>
                  订阅描述
                  <textarea
                    autoFocus
                    maxLength={4000}
                    placeholder="例如：腾讯视频每月 25 元，12 月 1 日续费"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                </label>
              ) : (
                <>
                  <input
                    hidden
                    ref={file}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={async (e) => {
                      const fs = Array.from(e.target.files || []);
                      setBusy("正在读取截图…");
                      try {
                        const next = await Promise.all(fs.map(getImage));
                        setImages(next);
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
                    {images.length
                      ? "已选 " + images.length + " 张 · 重选"
                      : "选择截图"}
                  </button>
                  {images.length > 0 && (
                    <div className="thumbs">
                      {images.map((im, i) => (
                        <img key={i} src={im} alt={"截图 " + (i + 1)} />
                      ))}
                    </div>
                  )}
                  <label>
                    截图日期
                    {images.length > 1 && <small>不同日期请分批导入</small>}
                    <input
                      type="date"
                      value={base}
                      onChange={(e) => setBase(e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
            <p className="hint">
              {ai
                ? "所选内容将发送给 OpenAI 识别。"
                : "AI 识别待开通，可手动添加。"}
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary wide"
              disabled={
                !ai ||
                !!busy ||
                (mode === "text" ? !input.trim() : !images.length)
              }
              onClick={recognize}
            >
              {busy || "识别并核对"}
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
              <p className="hint">
                第 {step + 1} 条，共 {drafts.length} 条
              </p>
            )}
            {d.picture && (
              <details className="proof">
                <summary>查看原图</summary>
                <img src={d.picture} alt="待核对的截图原图" />
              </details>
            )}
            {d.evidence && <blockquote>{d.evidence}</blockquote>}
            {d.uncertainty && (
              <p className="warning">
                <TriangleAlert size={15} /> {d.uncertainty}
              </p>
            )}
            <div className="fields">
              <label className="full">
                服务名称
                <span className="nameEntry">
                  <span
                    className="platformIcon"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{
                      __html: badge(identifyBrand(d.name)),
                    }}
                  />
                  <input
                    autoFocus
                    maxLength={80}
                    placeholder="例如：芒果 TV"
                    value={d.name}
                    onChange={(e) => change("name", e.target.value)}
                  />
                </span>
              </label>
              <label>
                类型
                <select
                  value={d.kind}
                  onChange={(e) => change("kind", e.target.value)}
                >
                  {kinds.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                周期
                <select
                  value={d.cycle}
                  onChange={(e) => change("cycle", e.target.value)}
                >
                  {cycles.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                预计金额
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
                {d.kind === "提醒复查" ? "复查日" : "下次日期"}
                <input
                  type="date"
                  value={d.date}
                  onChange={(e) => change("date", e.target.value)}
                />
              </label>
              <label>
                日历提醒
                <select
                  value={d.remind}
                  onChange={(e) => change("remind", Number(e.target.value))}
                >
                  {[0, 1, 3, 7].map((n) => (
                    <option key={n} value={n}>
                      {n ? "提前 " + n + " 天" : "当天"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                备注
                <input
                  maxLength={600}
                  value={d.note}
                  placeholder="可保留「还有十多天」等原话"
                  onChange={(e) => change("note", e.target.value)}
                />
              </label>
            </div>
            {!d.date && (
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
              {step > 0 && (
                <button className="soft" onClick={() => setStep(step - 1)}>
                  <ChevronLeft size={16} />
                  上一条
                </button>
              )}
              <button
                disabled={!!busy}
                className="primary wide"
                onClick={submit}
              >
                <Check size={17} />
                {busy ||
                  (step < drafts.length - 1
                    ? "确认，下一条"
                    : edit
                      ? "保存更改"
                      : "保存订阅")}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
