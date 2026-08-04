import { householdContext, listMembers } from "./store";

export const dynamic = "force-dynamic";

export async function GET() {
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
    try { payload = JSON.parse(state.payload); } catch { payload = null; }
  }
  return Response.json({ householdName: household?.name ?? "My household", role: member.role, payload, revision: state?.revision ?? 0, members }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const context = await householdContext();
  if (!context) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (context.member.role === "viewer") return Response.json({ error: "Viewer access is read-only" }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 1_000_000) return Response.json({ error: "Dashboard data is too large" }, { status: 413 });
  let body: { payload?: unknown };
  try { body = JSON.parse(raw) as { payload?: unknown }; } catch { return Response.json({ error: "Invalid dashboard data" }, { status: 400 }); }
  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) return Response.json({ error: "Invalid dashboard data" }, { status: 400 });
  const now = Date.now();
  await context.db.prepare("UPDATE household_state SET payload = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE household_id = ?")
    .bind(JSON.stringify(body.payload), context.user.email, now, context.member.household_id).run();
  await context.db.prepare("UPDATE households SET updated_at = ? WHERE id = ?").bind(now, context.member.household_id).run();
  const state = await context.db.prepare("SELECT revision FROM household_state WHERE household_id = ?").bind(context.member.household_id).first<{ revision: number }>();
  return Response.json({ ok: true, revision: state?.revision ?? 0 });
}
