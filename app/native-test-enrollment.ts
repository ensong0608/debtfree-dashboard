import type { NativeIdentity } from './native-auth.ts';
import { readBoundedBody } from './request-safety.ts';
const HOUSEHOLD = 'mobile-connected-test-v1';
const reply = (value: object, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'private, no-store' } });
/** Explicit enrollment for exactly the two approved testers. No production
 * allowlist, imported household or automatic sign-in invitation acceptance. */
export async function enrollTestHousehold(request: Request, db: D1Database, user: NativeIdentity, testerEmails?: string) {
  let emails: unknown;
  try { emails = JSON.parse(testerEmails ?? ''); } catch { return reply({ error: 'Test enrollment is not configured.' }, 503); }
  if (!Array.isArray(emails) || emails.length !== 2 || emails.some(email => typeof email !== 'string' || email !== email.trim().toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || emails[0] === emails[1]) return reply({ error: 'Test enrollment is not configured.' }, 503);
  if (!emails.includes(user.email)) return reply({ error: 'Test enrollment denied.' }, 403);
  const existing = await db.prepare('SELECT household_id, status FROM household_members WHERE email = ?').bind(user.email).first<{ household_id: string; status: string }>();
  if (existing) return existing.household_id === HOUSEHOLD && existing.status === 'active' ? reply({ canJoin: false, joined: true }) : reply({ error: 'Test enrollment denied.' }, 403);
  const prior = await db.prepare('SELECT email FROM mobile_test_enrollments WHERE email = ?').bind(user.email).first();
  if (prior) return reply({ error: 'Test enrollment requires owner review.' }, 403);
  if (request.method === 'GET') return reply({ canJoin: true, householdName: 'Connected test household' });
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'JSON required.' }, 415);
  let body;
  try { body = JSON.parse(await readBoundedBody(request, 128)); } catch { return reply({ error: 'Explicit acceptance required.' }, 400); }
  if (!body || Object.keys(body).length !== 1 || body.accept !== true) return reply({ error: 'Explicit acceptance required.' }, 400);
  const now = Date.now(), nonce = crypto.randomUUID(), owner = emails[0] as string, role = user.email === owner ? 'owner' : 'admin';
  // D1 batch is transactional. A one-time journal prevents a removed tester
  // from recreating membership just by signing in again.
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO households (id, name, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(HOUSEHOLD, 'Connected test household', owner, now, now),
    db.prepare('INSERT OR IGNORE INTO mobile_test_enrollments (email, household_id, acceptance_nonce, accepted_at) SELECT ?, id, ?, ? FROM households WHERE id = ? AND owner_email = ?').bind(user.email, nonce, now, HOUSEHOLD, owner),
    db.prepare('INSERT OR IGNORE INTO household_state (household_id, payload, revision, updated_at) SELECT id, NULL, 0, ? FROM households WHERE id = ? AND owner_email = ?').bind(now, HOUSEHOLD, owner),
    db.prepare('INSERT OR IGNORE INTO household_members (email, household_id, display_name, role, status, invited_by, created_at, updated_at) SELECT email, household_id, ?, ?, ?, ?, ?, ? FROM mobile_test_enrollments WHERE email = ? AND acceptance_nonce = ?').bind(user.displayName, role, 'active', owner, now, now, user.email, nonce),
  ]);
  const member = await db.prepare('SELECT household_id, status FROM household_members WHERE email = ?').bind(user.email).first<{ household_id: string; status: string }>();
  return member?.household_id === HOUSEHOLD && member.status === 'active' ? reply({ joined: true }) : reply({ error: 'Test enrollment denied.' }, 403);
}
