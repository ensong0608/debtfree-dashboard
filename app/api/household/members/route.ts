import { householdContext, listMembers, normalizeEmail, type HouseholdRole } from "../store";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inviteRoles = new Set<HouseholdRole>(["admin", "viewer"]);

export async function POST(request: Request) {
  const context = await householdContext();
  if (!context) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (context.member.role !== "owner") return Response.json({ error: "Only the household owner can add members" }, { status: 403 });
  const body = await request.json().catch(() => null) as { email?: string; role?: HouseholdRole } | null;
  const email = normalizeEmail(body?.email ?? "");
  const role = body?.role ?? "admin";
  if (!emailPattern.test(email)) return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  if (!inviteRoles.has(role)) return Response.json({ error: "Choose admin or viewer access" }, { status: 400 });
  if (email === context.user.email) return Response.json({ error: "You are already the household owner" }, { status: 400 });
  const existing = await context.db.prepare("SELECT household_id, role, status FROM household_members WHERE email = ?").bind(email).first<{ household_id: string; role: string; status: string }>();
  if (existing && existing.household_id !== context.member.household_id) return Response.json({ error: "That email already belongs to another household" }, { status: 409 });
  const now = Date.now();
  if (existing) {
    await context.db.prepare("UPDATE household_members SET role = ?, updated_at = ? WHERE email = ?").bind(role, now, email).run();
  } else {
    await context.db.prepare("INSERT INTO household_members (email, household_id, display_name, role, status, invited_by, created_at, updated_at) VALUES (?, ?, NULL, ?, 'invited', ?, ?, ?)")
      .bind(email, context.member.household_id, role, context.user.email, now, now).run();
  }
  return Response.json({ ok: true, members: await listMembers(context.member.household_id) });
}

export async function DELETE(request: Request) {
  const context = await householdContext();
  if (!context) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (context.member.role !== "owner") return Response.json({ error: "Only the household owner can remove members" }, { status: 403 });
  const email = normalizeEmail(new URL(request.url).searchParams.get("email") ?? "");
  if (!email || email === context.user.email) return Response.json({ error: "The household owner cannot be removed" }, { status: 400 });
  await context.db.prepare("DELETE FROM household_members WHERE household_id = ? AND email = ? AND role != 'owner'")
    .bind(context.member.household_id, email).run();
  return Response.json({ ok: true, members: await listMembers(context.member.household_id) });
}
