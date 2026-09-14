import { readBoundedBody, requireWriteRevision, RequestError } from "./request-safety.ts";

import { dashboardDataErrorMessage, parseHouseholdWriteJson, serializeDashboardBackup } from "./dashboard-data.ts";

type Context = { db: D1Database; member: { household_id: string; role: "owner" | "admin" | "viewer" }; user: { email: string } };
export function createHouseholdApi(householdContext: () => Promise<Context | null>, listMembers: (id: string) => Promise<unknown>) {

async function GET() {
  const context = await householdContext();
  if (!context) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { db, member } = context;
  const [household, state, members] = await Promise.all([
    db.prepare("SELECT name FROM households WHERE id = ?").bind(member.household_id).first<{ name: string }>(),
    db.prepare("SELECT payload, revision, updated_by, updated_at FROM household_state WHERE household_id = ?").bind(member.household_id).first<{ payload: string | null; revision: number; updated_by: string | null; updated_at: number }>(),
    listMembers(member.household_id),
  ]);
  let payload: unknown = null;
  if (state?.payload) {
    try { payload = JSON.parse(state.payload); } catch { return Response.json({ error: "Stored household data needs recovery. No data was replaced." }, { status: 503 }); }
  }
  return Response.json({ householdName: household?.name ?? "My household", role: member.role, payload, revision: state?.revision ?? 0, members }, { headers: { "cache-control": "no-store" } });
}

async function PUT(request: Request) {
  const context = await householdContext();
  if (!context) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (context.member.role === "viewer") return Response.json({ error: "Viewer access is read-only" }, { status: 403 });
  let contract;
  let revision;
  try {
    const raw = await readBoundedBody(request);
    revision = requireWriteRevision(raw);
    contract = parseHouseholdWriteJson(raw);
  }
  catch (error) {
    return Response.json({ error: dashboardDataErrorMessage(error) }, { status: error instanceof RequestError ? error.status : 400 });
  }
  const now = Date.now();
  const result = await context.db.prepare("UPDATE household_state SET payload = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE household_id = ? AND revision = ?")
    .bind(serializeDashboardBackup(contract), context.user.email, now, context.member.household_id, revision).run();
  if (result.meta.changes !== 1) return Response.json({ error: "Another session changed this household. Review the latest data before saving." }, { status: 409 });
  await context.db.prepare("UPDATE households SET updated_at = ? WHERE id = ?").bind(now, context.member.household_id).run();
  return Response.json({ ok: true, revision: revision + 1 }, { headers: { "cache-control": "no-store" } });
}

return { GET, PUT };
}
