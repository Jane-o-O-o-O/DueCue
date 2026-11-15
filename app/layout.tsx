import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./motion.css";

function prefersEnglish(acceptLanguage: string) {
  let bestQuality = 0;
  let selected = "zh";
  for (const entry of acceptLanguage.toLowerCase().split(",")) {
    const [tag, weight] = entry.trim().split(/\s*;\s*q\s*=\s*/);
    const language = tag.split("-")[0];
    if (language !== "zh" && language !== "en") continue;
    const quality = weight === undefined ? 1 : Number(weight);
    if (quality > bestQuality && quality <= 1) {
      selected = language;
      bestQuality = quality;
    }
  }
  return selected === "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const english = prefersEnglish(requestHeaders.get("accept-language") ?? "");
  const appName = english ? "DueCue" : "知期";
  return {
    title: appName,
    applicationName: appName,
    description: "把订阅、续费和到期日收进同一个卡包",
    manifest: english ? "/manifest-en.webmanifest" : "/manifest.webmanifest",
    icons: {
      icon: { url: "/favicon.ico?v=duecue2", type: "image/x-icon" },
      apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    },
    appleWebApp: { capable: true, title: appName, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f7fb",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
