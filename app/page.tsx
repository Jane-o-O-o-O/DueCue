import Wallet from "./wallet";
export const dynamic = "force-dynamic";
export default function Page() {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
  }).format(new Date());
  return <Wallet initialToday={today} />;
}
