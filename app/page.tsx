import { headers } from "next/headers";
import Wallet from "./wallet";
export const dynamic = "force-dynamic";
export default async function Page() {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
  }).format(new Date());
  const release = (await headers()).get("x-duecue-release") || "";
  return <Wallet initialToday={today} release={release} />;
}
