import { createHouseholdApi } from './household-api.ts';
import type { NativeIdentity } from './native-auth.ts';
export type NativeMember = { email: string; household_id: string; role: 'owner' | 'admin' | 'viewer'; status: string };
export async function nativeMember(db: D1Database, user: NativeIdentity): Promise<NativeMember | null> {
  const member = await db.prepare('SELECT email, household_id, role, status FROM household_members WHERE email = ?').bind(user.email).first<NativeMember>();
  return member?.status === 'active' && ['owner','admin','viewer'].includes(member.role) ? member : null;
}
export function nativeHouseholdApi(db: D1Database, user: NativeIdentity, member: NativeMember) {
  return createHouseholdApi(async () => ({ db, user: { email: user.email }, member }), async id => (await db.prepare('SELECT email, display_name, role, status FROM household_members WHERE household_id = ?').bind(id).all()).results);
}
