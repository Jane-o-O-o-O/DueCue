import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./motion.css";
export const metadata: Metadata = {
  title: "知期 DueCue · 订阅手账",
  applicationName: "知期 DueCue",
  description: "把订阅、续费和到期日收进同一个卡包",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "知期", statusBarStyle: "default" },
};
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
