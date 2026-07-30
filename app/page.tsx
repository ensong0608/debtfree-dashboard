import DashboardClient from "./dashboard-client";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <DashboardClient user={user}/>;
}
