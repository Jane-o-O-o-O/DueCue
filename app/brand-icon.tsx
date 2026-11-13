import { Smartphone, WalletCards } from "lucide-react";
import { catalog } from "../public/catalog-data.js";
import { identifyBrand } from "../public/brands.js";

type Artwork = { file: string; standalone?: boolean; hero?: boolean };

const artwork: Record<string, Artwork> = {
  ...Object.fromEntries(
    catalog.map(({ slug }) => [slug, { file: slug + ".png" }]),
  ),
  chatgpt: { file: "chatgpt.png" },
  netflix: { file: "netflix.png" },
  spotify: { file: "spotify.png" },
  icloud: { file: "icloud.png", standalone: true, hero: true },
  tencent: { file: "tencent.png" },
  mango: { file: "mango.png" },
  apple: { file: "apple.svg", standalone: true },
  claude: { file: "claude.svg", standalone: true },
  bilibili: { file: "bilibili.png" },
  huabei: { file: "huabei.png", standalone: true },
  "china-mobile": { file: "china-mobile.svg", standalone: true, hero: true },
  "china-unicom": { file: "china-unicom.png", standalone: true, hero: true },
  "china-telecom": { file: "china-telecom.svg", standalone: true, hero: true },
  disney: { file: "disney.png" },
  youtube: { file: "youtube.png" },
  iqiyi: { file: "iqiyi.png" },
};

export function emblemArtwork(slug: string) {
  const mark = artwork[slug];
  return mark?.hero ? "/brand-icons/" + mark.file : undefined;
}

export function BrandIcon({
  name,
  className = "",
  lazy = false,
}: {
  name: string;
  className?: string;
  lazy?: boolean;
}) {
  const slug = identifyBrand(name);
  const mark = artwork[slug];
  const phone = slug === "mobile";
  const style = mark
    ? mark.standalone
      ? "emblem"
      : ""
    : phone
      ? "genericPhone"
      : "generic";
  return (
    <span
      className={["platformIcon", style, className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      {mark ? (
        <img
          src={"/brand-icons/" + mark.file}
          alt=""
          width={36}
          height={36}
          loading={lazy ? "lazy" : undefined}
          decoding="async"
          draggable={false}
        />
      ) : phone ? (
        <Smartphone strokeWidth={1.8} />
      ) : (
        <WalletCards strokeWidth={1.8} />
      )}
    </span>
  );
}
