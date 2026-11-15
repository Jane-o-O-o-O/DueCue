import {
  useCallback,
  useState,
  type CSSProperties,
  type MouseEventHandler,
} from "react";
import { brands } from "../public/brands.js";
import { BrandIcon, emblemArtwork } from "./brand-icon";
import { type Entry, money, symbols } from "@/lib/records";

// These marks share the hue of their card. Lift the ink only on the large watermark.
const lowContrastEmblems = new Set([
  "2bulu",
  "gaoding",
  "hema",
  "iqiyi",
  "jd",
  "kuwo",
  "meitu",
  "netease-cloud-gaming",
  "netflix",
  "qingting",
  "taobao",
  "weibo",
  "weread",
  "xunlei",
  "zhihu",
  "zhipu-qingyan",
]);

function CardArt({ slug, lazy }: { slug: string; lazy: boolean }) {
  const emblem = emblemArtwork(slug);
  const [unavailable, setUnavailable] = useState<string>();
  const checkImage = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth === 0) setUnavailable(emblem);
    },
    [emblem],
  );
  if (emblem && unavailable !== emblem) {
    return (
      <img
        key={emblem}
        ref={checkImage}
        className="cardArt officialArt"
        data-tone={lowContrastEmblems.has(slug) ? "light" : undefined}
        onError={() => setUnavailable(emblem)}
        src={emblem}
        loading={lazy ? "lazy" : undefined}
        alt=""
        aria-hidden="true"
      />
    );
  }
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
type Props = {
  entry: Pick<Entry, "name" | "kind" | "cycle" | "amount" | "currency">;
  slug: string;
  dateCaption: string;
  dateText: string;
  level?: number;
  slot?: number;
  motionId?: string;
  label?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  lazy?: boolean;
};

export function WalletCard({
  entry,
  slug,
  dateCaption,
  dateText,
  level = 0,
  slot = 0,
  motionId,
  label,
  onClick,
  lazy = false,
}: Props) {
  const brand = (brands as Record<string, { dark: string; light: string }>)[
    slug
  ];
  const className = "deckCard " + (level ? "behind" : "front");
  const style = {
    "--level": level,
    "--slot": slot,
    "--card": brand.dark,
    "--tint": brand.light,
  } as CSSProperties;
  const face = (
    <>
      <span className="deckName">
        <BrandIcon name={slug} lazy={lazy} />
        <b>{entry.name}</b>
      </span>
      {level > 0 && <span className="foldCycle">{entry.cycle}</span>}
      {level === 0 && (
        <>
          <span className="deckChip">{entry.cycle}</span>
          <CardArt slug={slug} lazy={lazy} />
          <span className="heroFoot">
            <span className="heroAmount">
              <small>{entry.kind}</small>
              <strong
                className={entry.amount === "" ? "amountUnknown" : undefined}
              >
                {entry.amount === "" ? (
                  money(entry)
                ) : (
                  <>
                    <span className="currencySign">
                      {symbols[entry.currency] || entry.currency}
                    </span>
                    {Number(entry.amount).toFixed(2)}
                  </>
                )}
              </strong>
            </span>
            <span className="heroDate">
              <small>{dateCaption}</small>
              <b>{dateText}</b>
            </span>
          </span>
        </>
      )}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={className}
      style={style}
      data-motion-id={motionId}
      aria-label={label}
      onClick={onClick}
    >
      {face}
    </button>
  ) : (
    <div className={className} style={style}>
      {face}
    </div>
  );
}
