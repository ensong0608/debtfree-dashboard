import assert from "node:assert/strict";
import test from "node:test";
import { supabaseIdentity } from "../app/supabase-identity.ts";

const verified = { email: " OWNER@Example.test ", email_confirmed_at: "2026-10-02T00:00:00Z", identities: [{ provider: "google" }], user_metadata: { full_name: "Household Owner", role: "owner" } };
test("Supabase identity requires a confirmed email and a Google identity", () => {
  assert.deepEqual(supabaseIdentity(verified), { email: "owner@example.test", displayName: "Household Owner", fullName: "Household Owner" });
  for (const user of [null, { ...verified, email: "" }, { ...verified, email_confirmed_at: null }, { ...verified, identities: [] }, { ...verified, identities: [{ provider: "email" }] }]) assert.equal(supabaseIdentity(user), null);
});
test("display metadata never supplies an authorization role or email", () => {
  const identity = supabaseIdentity({ ...verified, user_metadata: { email: "intruder@example.test", role: "owner", full_name: { unsafe: true } } });
  assert.equal(identity.email, "owner@example.test");
  assert.equal(identity.displayName, "owner");
  assert.equal(identity.fullName, null);
  assert.equal(identity.role, undefined);
});
