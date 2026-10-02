import DashboardClient from "./dashboard-client";
import { getOrCreateMember, normalizeEmail } from "./api/household/store";
import { getAuthenticatedUser } from "./auth";
import { authConfiguration } from "./auth-config";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthenticatedUser();
  if (!user) {
    if (authConfiguration().enabled) redirect("/auth/login");
    return <DashboardClient user={{ displayName: "Guest", email: "Local device storage only", fullName: null }}/>;
  }
  const member = await getOrCreateMember(normalizeEmail(user.email), user.displayName);
  if (!member) return <main className="access-denied-shell"><section className="access-denied-card"><span>Private household</span><h1>Access not added yet</h1><p>This account is not part of the shared household. Ask the household owner to add this exact personal email from My Account.</p><form action="/auth/logout" method="post"><button className="primary" type="submit">Use a different account</button></form></section></main>;
  return <DashboardClient user={user}/>;
}
