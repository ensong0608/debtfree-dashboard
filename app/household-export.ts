import { parseDashboardContract, serializeDashboardBackup } from './dashboard-data.ts';
import { reportServerFailure } from './safe-monitoring.ts';
import { checkHouseholdSession } from './household-session-scope.ts';
type ExportContext = { db: D1Database; member: { household_id: string }; user: { email: string } };
export function createHouseholdExport(context: () => Promise<ExportContext | null>) {
  return async function GET(request?: Request) {
    try {
      const access = await context();
      if (!access) return Response.json({ error: 'Sign in required' }, { status: 401 });
      const changed = checkHouseholdSession(request, access);
      if (changed) return changed;
      const state = await access.db.prepare('SELECT payload FROM household_state WHERE household_id = ?').bind(access.member.household_id).first<{payload: string | null}>();
      if (!state?.payload) return Response.json({error:'No saved household data'}, {status:404});
      const contract = parseDashboardContract(JSON.parse(state.payload), 'Saved household');
      return new Response(serializeDashboardBackup(contract, true), { headers: {
        'content-type': 'application/json', 'cache-control': 'private, no-store',
        'content-disposition': 'attachment; filename="debtfree-household-backup.json"',
        'x-content-type-options': 'nosniff',
      } });
    } catch {
      reportServerFailure('household_export_failed');
      return Response.json({error:'Export unavailable. Try again.'},{status:503});
    }
  };
}
