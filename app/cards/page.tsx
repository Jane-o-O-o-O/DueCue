import type { Metadata } from "next";
import CardGallery from "./gallery";

export const metadata: Metadata = { title: "全部卡面 · 有期" };

export default function Page() {
  return <CardGallery />;
}
