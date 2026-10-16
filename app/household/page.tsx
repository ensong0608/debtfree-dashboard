import { redirect } from 'next/navigation';
import { authenticatedUser } from '../api/household/store';
import { lifecycleConfiguration } from '../auth-config';
import HouseholdLifecyclePanel from '../household-lifecycle-panel';
export const dynamic = 'force-dynamic';
export default async function HouseholdSetup() {
  if (!lifecycleConfiguration().enabled) redirect('/');
  const user = await authenticatedUser();
  if (!user) redirect('/auth/login');
  return <main className="access-denied-shell"><section className="access-denied-card"><h1>Your household</h1><p>Signed in as {user.email}</p><HouseholdLifecyclePanel identity={user.email} setup/><form action="/auth/logout" method="post"><button type="submit" className="secondary">Use a different account</button></form></section></main>;
}
