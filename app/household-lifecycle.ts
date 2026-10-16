import { checkHouseholdSession } from './household-session-scope.ts';
import { readBoundedBody } from './request-safety.ts';

type Member = { email: string; household_id: string; role: 'owner' | 'admin' | 'viewer'; status: string };
type User = { email: string; displayName: string };
type Settings = { enabled: boolean; creationEmails: string[] };
const headers = { 'cache-control': 'private, no-store' };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
const error = (message: string, status = 400) => reply({ error: message }, status);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createLifecycleApi(deps: { db: () => D1Database; user: () => Promise<User | null>; settings: () => Settings }) {
  async function handle(request: Request) {
    const settings = deps.settings();
    if (!settings.enabled) return error('Household setup is not available yet.', 404);
    const user = await deps.user();
    if (!user) return error('Sign in required', 401);
    const db = deps.db();
    const member = await db.prepare('SELECT email, household_id, role, status FROM household_members WHERE email = ?').bind(user.email).first<Member>();
    const now = Date.now();
    if (request.method === 'GET') {
      const inbox = await db.prepare(`SELECT i.id, h.name AS household_name, i.role, i.expires_at FROM household_invitations i JOIN households h ON h.id = i.household_id WHERE i.email = ? AND i.resolved_at IS NULL AND i.expires_at > ? ORDER BY i.created_at DESC`).bind(user.email, now).all();
      const invitations = member?.role === 'owner' && member.status === 'active' ? (await db.prepare('SELECT id, email, role, expires_at FROM household_invitations WHERE household_id = ? AND resolved_at IS NULL AND expires_at > ? ORDER BY created_at DESC').bind(member.household_id, now).all()).results : [];
      const requests = (await db.prepare('SELECT id, kind, created_at FROM household_requests WHERE email = ? AND cancelled_at IS NULL').bind(user.email).all()).results;
      return reply({ inbox: inbox.results, invitations, requests, canCreate: !member && settings.creationEmails.includes(user.email), legacyInvitation: member?.status === 'invited', member });
    }
    // Explicit origin + expected identity stop cross-site submissions and stale-account tabs.
    if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('x-debtfree-identity') !== user.email) return error('Account changed. Reopen this page.', 403);
    if (member?.status === 'active') {
      const changed = checkHouseholdSession(request, { user, member }, true);
      if (changed) return changed;
    }
    const body = await readBoundedBody(request, 8192).then(JSON.parse).catch(() => null);
    if (!body || typeof body.action !== 'string') return error('Choose an action.');
    if (body.action === 'create') {
      if (member) return error('You already belong to a household.', 409);
      if (!settings.creationEmails.includes(user.email)) return error('New household registration is closed.', 403);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 80) return error('Enter a household name (up to 80 characters).');
      const id = crypto.randomUUID();
      // Membership email is unique. A competing create/accept rolls back this entire batch.
      await db.batch([
        db.prepare('INSERT INTO households (id, name, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, name, user.email, now, now),
        db.prepare("INSERT INTO household_members (email, household_id, display_name, role, status, invited_by, created_at, updated_at) VALUES (?, ?, ?, 'owner', 'active', NULL, ?, ?)").bind(user.email, id, user.displayName, now, now),
        db.prepare('INSERT INTO household_state (household_id, payload, revision, updated_by, updated_at) VALUES (?, NULL, 0, ?, ?)').bind(id, user.email, now),
      ]);
      return reply({ ok: true });
    }
    if (body.action === 'accept_legacy' && member?.status === 'invited') {
      await db.prepare("UPDATE household_members SET status = 'active', display_name = ?, updated_at = ? WHERE email = ? AND household_id = ? AND status = 'invited'").bind(user.displayName, now, user.email, member.household_id).run();
      return reply({ ok: true });
    }
    if (body.action === 'accept') {
      if (member) return error('Leave your current household before accepting another invitation.', 409);
      if (typeof body.id !== 'string') return error('Choose an invitation.');
      // INSERT is guarded in SQL: revoked/expired invitations cannot race acceptance.
      const results = await db.batch([
        db.prepare(`INSERT INTO household_members (email, household_id, display_name, role, status, invited_by, created_at, updated_at) SELECT email, household_id, ?, role, 'active', invited_by, ?, ? FROM household_invitations WHERE id = ? AND email = ? AND resolved_at IS NULL AND expires_at > ?`).bind(user.displayName, now, now, body.id, user.email, now),
        db.prepare(`UPDATE household_invitations SET resolved_at = ?, outcome = 'accepted' WHERE id = ? AND email = ? AND resolved_at IS NULL AND expires_at > ? AND EXISTS (SELECT 1 FROM household_members m WHERE m.email = household_invitations.email AND m.household_id = household_invitations.household_id AND m.status = 'active')`).bind(now, body.id, user.email, now),
      ]);
      return results[0].meta.changes === 1 ? reply({ ok: true }) : error('Invitation expired or was revoked.', 409);
    }
    if (body.action === 'cancel_deletion') {
      await db.prepare('UPDATE household_requests SET cancelled_at = ? WHERE email = ? AND cancelled_at IS NULL').bind(now, user.email).run();
      return reply({ ok: true });
    }
    if (!member || member.status !== 'active') return error('Household access required.', 403);
    const household = member.household_id;
    const owner = member.role === 'owner';
    if (['invite', 'revoke', 'role', 'remove'].includes(body.action) && !owner) return error('Only the owner can manage household access.', 403);
    if (body.action === 'invite') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!emailPattern.test(email) || email.length > 254) return error('Enter a valid email address.');
      if (!['admin', 'viewer'].includes(body.role)) return error('Choose admin or viewer access.');
      const existing = await db.prepare('SELECT email FROM household_members WHERE email = ?').bind(email).first();
      if (existing) return error('That account already belongs to a household.', 409);
      const count = await db.prepare('SELECT COUNT(*) AS total FROM household_invitations WHERE household_id = ? AND created_at > ?').bind(household, now - 3600000).first<{ total: number }>();
      if ((count?.total ?? 0) >= 20) return error('Invitation limit reached. Try again later.', 429);
      const id = crypto.randomUUID();
      await db.batch([
        db.prepare("UPDATE household_invitations SET resolved_at = ?, outcome = 'revoked' WHERE household_id = ? AND email = ? AND resolved_at IS NULL").bind(now, household, email),
        db.prepare('INSERT INTO household_invitations (id, household_id, email, role, invited_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, household, email, body.role, user.email, now, now + 7 * 86400000),
      ]);
      return reply({ ok: true, id });
    }
    if (body.action === 'revoke') {
      if (typeof body.id !== 'string') return error('Choose an invitation.');
      await db.prepare("UPDATE household_invitations SET resolved_at = ?, outcome = 'revoked' WHERE id = ? AND household_id = ? AND resolved_at IS NULL").bind(now, body.id, household).run();
      return reply({ ok: true });
    }
    if (body.action === 'role' || body.action === 'remove') {
      if (typeof body.email !== 'string' || body.email === user.email) return error('The owner cannot be removed or demoted.');
      if (body.action === 'role') {
        if (!['admin', 'viewer'].includes(body.role)) return error('Choose admin or viewer access.');
        await db.prepare("UPDATE household_members SET role = ?, updated_at = ? WHERE email = ? AND household_id = ? AND role != 'owner'").bind(body.role, now, body.email, household).run();
      } else {
        await db.prepare("DELETE FROM household_members WHERE email = ? AND household_id = ? AND role != 'owner'").bind(body.email, household).run();
      }
      return reply({ ok: true });
    }
    if (body.action === 'leave') {
      if (owner) return error('Owners must request household deletion instead of leaving.', 409);
      if (body.confirmation !== 'LEAVE') return error('Type LEAVE to confirm.');
      await db.prepare("DELETE FROM household_members WHERE email = ? AND household_id = ? AND role != 'owner'").bind(user.email, household).run();
      return reply({ ok: true });
    }
    if (body.action === 'request_deletion') {
      const kind = owner ? 'delete_household' : 'delete_account';
      if (body.confirmation !== 'DELETE') return error('Type DELETE to confirm.');
      const existing = await db.prepare('SELECT id FROM household_requests WHERE household_id = ? AND email = ? AND cancelled_at IS NULL').bind(household, user.email).first<{ id: string }>();
      const id = existing?.id ?? crypto.randomUUID();
      if (!existing) await db.prepare('INSERT INTO household_requests (id, household_id, email, kind, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, household, user.email, kind, now).run();
      return reply({ ok: true, id });
    }
    return error('Choose a supported action.');
  }
  return {
    GET: async (request: Request) => { try { return await handle(request); } catch { return error('Household setup is unavailable. Try again.', 503); } },
    POST: async (request: Request) => { try { return await handle(request); } catch { return error('Could not complete this action. Refresh and try again.', 409); } },
  };
}
