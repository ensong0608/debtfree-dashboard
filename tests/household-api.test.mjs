import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHouseholdApi } from "../app/household-api.ts";
import { parseDashboardContract, serializeDashboardBackup } from "../app/dashboard-data.ts";
import { verifyAccessIdentity } from "../app/verify-access.ts";
import { generateKeyPair, SignJWT } from "jose";

const fixture = () => parseDashboardContract(JSON.parse(readFileSync(new URL("fixtures/legacy-v0.json", import.meta.url), "utf8")));
test("real SQL revision guard permits only one concurrent writer and enforces roles", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE households (id TEXT PRIMARY KEY, name TEXT, updated_at INTEGER); CREATE TABLE household_state (household_id TEXT PRIMARY KEY, payload TEXT, revision INTEGER, updated_by TEXT, updated_at INTEGER); INSERT INTO households VALUES ('h', 'Test', 0); INSERT INTO household_state VALUES ('h', NULL, 0, NULL, 0);");
  const db = { prepare(sql) { return { bind(...params) { const stmt = sqlite.prepare(sql); return { async run() { const result = stmt.run(...params); return { meta: { changes: Number(result.changes) } }; }, async first() { return stmt.get(...params) ?? null; } }; } }; } };
  let role = "owner"; let signedIn = true;
  const api = createHouseholdApi(async () => signedIn ? { db, member: { household_id: "h", role }, user: { email: "test@example.test" } } : null, async () => []);
  const put = (revision, contract = fixture()) => api.PUT(new Request("http://localhost/api/household", { method: "PUT", body: JSON.stringify({ revision, payload: contract }) }));
  const outcomes = await Promise.all([put(0), put(0)]); assert.deepEqual(outcomes.map(r => r.status).sort(), [200,409]);
  role = "viewer"; assert.equal((await put(1)).status, 403);
  signedIn = false; assert.equal((await api.GET()).status, 401); assert.equal((await put(1)).status, 401);
  signedIn = true; role = "admin"; assert.equal((await put(1)).status, 200);
  assert.equal((await (await api.GET()).json()).revision, 2);
  sqlite.close();
});

test("Access JWT validation rejects wrong audience, issuer, signature, email and expiration", async () => {
  const keys = await generateKeyPair("RS256"); const other = await generateKeyPair("RS256");
  const token = (overrides = {}, key = keys.privateKey) => new SignJWT({ email: "owner@example.test", ...overrides }).setProtectedHeader({ alg: "RS256" }).setIssuer(overrides.iss ?? "https://team.example.test").setAudience(overrides.aud ?? "app").setExpirationTime(overrides.exp ?? "5m").sign(key);
  const verify = (jwt, email = null) => verifyAccessIdentity(jwt, async () => keys.publicKey, "https://team.example.test", "app", email);
  assert.equal((await verify(await token())).email, "owner@example.test");
  for (const input of [{ aud: "other" }, { iss: "https://other.test" }, { exp: 1 }, { email: "" }]) assert.equal(await verify(await token(input)), null);
  assert.equal(await verify(await token({}, other.privateKey)), null);
  assert.equal(await verify(await token(), "intruder@example.test"), null);
});

test("backup restore drill preserves versioned household contents", () => {
  const db = new DatabaseSync(":memory:"); db.exec("CREATE TABLE state (payload TEXT)");
  const original = fixture(); db.prepare("INSERT INTO state VALUES (?)").run(serializeDashboardBackup(original));
  const exported = db.prepare("SELECT payload FROM state").get().payload;
  db.prepare("UPDATE state SET payload = ?").run(serializeDashboardBackup({ ...original, payload: { ...original.payload, extra: 999 } }));
  db.prepare("UPDATE state SET payload = ?").run(exported);
  assert.deepEqual(parseDashboardContract(JSON.parse(db.prepare("SELECT payload FROM state").get().payload)).payload, original.payload);
  db.close();
});
