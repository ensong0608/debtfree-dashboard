import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export type HouseholdRole = "owner" | "admin";
export type HouseholdMemberRecord = {
  email: string;
  household_id: string;
  display_name: string | null;
  role: HouseholdRole;
  status: "active" | "invited";
};

export function database() {
  if (!env.DB) throw new Error("Household storage is unavailable.");
  return env.DB;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function authenticatedUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return { ...user, email: normalizeEmail(user.email) };
}

export async function getOrCreateMember(email: string, displayName: string) {
  const db = database();
  let member = await db.prepare("SELECT email, household_id, display_name, role, status FROM household_members WHERE email = ?")
    .bind(email).first<HouseholdMemberRecord>();
  const now = Date.now();
  if (member) {
    if (member.status === "invited" || member.display_name !== displayName) {
      await db.prepare("UPDATE household_members SET status = 'active', display_name = ?, updated_at = ? WHERE email = ?")
        .bind(displayName, now, email).run();
      member = { ...member, status: "active", display_name: displayName };
    }
    return member;
  }

  const existingHousehold = await db.prepare("SELECT id FROM households LIMIT 1").first<{ id: string }>();
  if (existingHousehold) return null;

  const householdId = crypto.randomUUID();
  const householdName = displayName && displayName !== email ? displayName + "'s household" : "My household";
  await db.batch([
    db.prepare("INSERT INTO households (id, name, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(householdId, householdName, email, now, now),
    db.prepare("INSERT INTO household_members (email, household_id, display_name, role, status, invited_by, created_at, updated_at) VALUES (?, ?, ?, 'owner', 'active', NULL, ?, ?)")
      .bind(email, householdId, displayName, now, now),
    db.prepare("INSERT INTO household_state (household_id, payload, revision, updated_by, updated_at) VALUES (?, NULL, 0, ?, ?)")
      .bind(householdId, email, now),
  ]);
  return { email, household_id: householdId, display_name: displayName, role: "owner", status: "active" } satisfies HouseholdMemberRecord;
}

export async function householdContext() {
  const user = await authenticatedUser();
  if (!user) return null;
  const member = await getOrCreateMember(user.email, user.displayName);
  if (!member) return null;
  return { user, member, db: database() };
}

export async function listMembers(householdId: string) {
  const result = await database().prepare("SELECT email, display_name, role, status FROM household_members WHERE household_id = ? ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, email")
    .bind(householdId).all();
  return result.results;
}
