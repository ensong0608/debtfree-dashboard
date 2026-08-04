import DashboardClient from "./dashboard-client";
import { getOrCreateMember, normalizeEmail } from "./api/household/store";
import { getAuthenticatedUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return <DashboardClient user={{ displayName: "Guest", email: "Local device storage only", fullName: null }}/>;
  }
  const member = await getOrCreateMember(normalizeEmail(user.email), user.displayName);
  if (!member) return <main className="access-denied-shell"><section className="access-denied-card"><span>Private household</span><h1>Access not added yet</h1><p>This account is not part of the shared household. Ask the household owner to add this exact personal email from My Account.</p><a className="primary" href="/cdn-cgi/access/logout">Use a different account</a></section></main>;
  return <DashboardClient user={user}/>;
}
