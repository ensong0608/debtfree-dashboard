-- Apply ONLY to debtfree-mobile-test D1, after explicit approval.
-- Existing production migration directory and database are deliberately unchanged.
CREATE TABLE IF NOT EXISTS mobile_test_enrollments (
  email TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id),
  acceptance_nonce TEXT NOT NULL,
  accepted_at INTEGER NOT NULL
);
