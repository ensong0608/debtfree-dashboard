CREATE TABLE IF NOT EXISTS household_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
  invited_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  resolved_at INTEGER,
  outcome TEXT CHECK(outcome IN ('accepted', 'revoked'))
);
CREATE INDEX IF NOT EXISTS household_invitations_recipient ON household_invitations(email, expires_at);
CREATE INDEX IF NOT EXISTS household_invitations_household ON household_invitations(household_id, created_at);
CREATE TABLE IF NOT EXISTS household_requests (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('delete_account', 'delete_household')),
  created_at INTEGER NOT NULL,
  cancelled_at INTEGER
);
