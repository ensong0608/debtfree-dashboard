import { pathToFileURL } from "node:url";

export const PREVIEW_ACCOUNT = "005a72abf0c701cfc067867e4f3ba034";
export const PREVIEW_DATABASE = "debtfree-dashboard-foundations-test";
export const PRODUCTION_DATABASE_ID = "3f2dd9d5-77de-4945-8e13-f6c1af454de1";
export const ISOLATION_HOUSEHOLD_ID = "qa-isolation-household-v1";
export class PreviewFixtureError extends Error {}
const previewBranch = "refs/heads/codex/public-app-foundations-20261011";
const email = value => typeof value === "string" ? value.trim().toLowerCase() : "";

/** Private administrative fixture only. No signup route, invitations, or existing-data updates. */
export async function provisionPreviewIsolation({ accountId, ownerEmail, testEmail }, api) {
  const owner = email(ownerEmail), identity = email(testEmail);
  if (accountId !== PREVIEW_ACCOUNT) throw new PreviewFixtureError("Unexpected preview account.");
  if (![owner, identity].every(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new PreviewFixtureError("PREVIEW_OWNER_EMAIL and PREVIEW_ISOLATION_EMAIL secrets are required.");
  if (identity === owner) throw new PreviewFixtureError("Isolation test identity must differ from the preview owner.");
  const databases = await api("/d1/database?per_page=100");
  const matches = databases.filter(db => db.name === PREVIEW_DATABASE);
  if (matches.length !== 1 || matches[0].uuid === PRODUCTION_DATABASE_ID || !/^[a-f0-9-]{36}$/i.test(matches[0].uuid)) throw new PreviewFixtureError("Preview database isolation guard failed.");
  const endpoint = "/d1/database/" + matches[0].uuid + "/query";
  const query = async (sql, params = []) => {
    const result = await api(endpoint, { sql, params });
    if (!Array.isArray(result) || result.some(item => item.success !== true)) throw new PreviewFixtureError("Preview fixture query failed.");
    return result.flatMap(item => item.results ?? []);
  };
  const member = (await query("SELECT household_id, role, status FROM household_members WHERE email = ?", [identity]))[0];
  const primary = (await query("SELECT household_id, role, status FROM household_members WHERE email = ?", [owner]))[0];
  if (!primary || primary.role !== "owner" || primary.status !== "active" || primary.household_id === ISOLATION_HOUSEHOLD_ID) throw new PreviewFixtureError("Existing preview owner household must be established first.");
  if (member && (member.household_id !== ISOLATION_HOUSEHOLD_ID || member.role !== "owner" || member.status !== "active")) throw new PreviewFixtureError("Selected identity already has different preview membership. No changes made.");
  const household = (await query("SELECT id, owner_email FROM households WHERE id = ?", [ISOLATION_HOUSEHOLD_ID]))[0];
  const state = (await query("SELECT household_id FROM household_state WHERE household_id = ?", [ISOLATION_HOUSEHOLD_ID]))[0];
  if (member || household || state) {
    if (member && household?.owner_email === identity && state) return { outcome: "already_configured", householdId: ISOLATION_HOUSEHOLD_ID };
    throw new PreviewFixtureError("Existing fixture is incomplete or belongs to another identity. No changes made.");
  }
  const now = String(Date.now());
  // D1 REST batch uses bound parameters; no email is written into SQL/source/logs.
  const result = await api(endpoint, { batch: [
    { sql: "INSERT INTO households (id, name, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", params: [ISOLATION_HOUSEHOLD_ID, "Isolation test household", identity, now, now] },
    { sql: "INSERT INTO household_members (email, household_id, display_name, role, status, invited_by, created_at, updated_at) VALUES (?, ?, NULL, 'owner', 'active', NULL, ?, ?)", params: [identity, ISOLATION_HOUSEHOLD_ID, now, now] },
    { sql: "INSERT INTO household_state (household_id, payload, revision, updated_by, updated_at) VALUES (?, NULL, 0, ?, ?)", params: [ISOLATION_HOUSEHOLD_ID, identity, now] },
  ] });
  if (!Array.isArray(result) || result.length !== 3 || result.some(item => item.success !== true)) throw new PreviewFixtureError("Preview fixture creation failed.");
  const verified = await query("SELECT 1 AS ready FROM households h JOIN household_members m ON m.household_id = h.id JOIN household_state s ON s.household_id = h.id WHERE h.id = ? AND h.owner_email = ? AND m.email = ? AND m.role = 'owner' AND m.status = 'active'", [ISOLATION_HOUSEHOLD_ID, identity, identity]);
  if (verified.length !== 1) throw new PreviewFixtureError("Preview fixture verification failed.");
  return { outcome: "created", householdId: ISOLATION_HOUSEHOLD_ID };
}

async function main() {
  if (process.env.GITHUB_REF !== previewBranch) throw new PreviewFixtureError("Fixture setup is restricted to the isolated preview branch.");
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new PreviewFixtureError("Cloudflare repository secret is required.");
  const api = async (path, body) => {
    const response = await fetch("https://api.cloudflare.com/client/v4/accounts/" + PREVIEW_ACCOUNT + path, {
      method: body ? "POST" : "GET",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new PreviewFixtureError("Preview resource request failed: HTTP " + response.status + ".");
    return payload.result;
  };
  const result = await provisionPreviewIsolation({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    ownerEmail: process.env.PREVIEW_OWNER_EMAIL,
    testEmail: process.env.PREVIEW_ISOLATION_EMAIL,
  }, api);
  console.log("Private preview isolation household: " + result.outcome + ". Existing household records unchanged; no messages sent.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof PreviewFixtureError ? error.message : "Preview isolation setup failed. Review protected secrets and resource guards.");
    process.exitCode = 1;
  });
}
