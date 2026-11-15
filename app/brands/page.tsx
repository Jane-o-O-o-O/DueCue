import type { Metadata } from "next";
import Directory from "./directory";

export const metadata: Metadata = { title: "国内会员目录 · 知期 DueCue" };

export default function Page() {
  return <Directory />;
}
