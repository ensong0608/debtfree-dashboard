import { redirect } from "next/navigation";
import { authConfiguration } from "../../auth-config";
import { getAuthenticatedUser } from "../../auth";

export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const config = authConfiguration();
  if (!config.enabled) redirect("/");
  if (await getAuthenticatedUser()) redirect("/");
  const { error } = await searchParams;
  return <main className="access-denied-shell"><section className="access-denied-card"><span>DebtFree Dashboard</span><h1>Your household, together</h1><p>Sign in with your approved Google account to access your household budget. This browser stays signed in until you sign out or the session is revoked.</p>{error && <p role="alert">Sign-in could not be completed. Please try again.</p>}<form action="/auth/google" method="post"><button className="primary" type="submit">Sign in with Google</button></form></section></main>;
}
