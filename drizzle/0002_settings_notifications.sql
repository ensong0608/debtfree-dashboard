-- Additive, device-scoped opt-in delivery settings. Existing financial tables are untouched.
CREATE TABLE IF NOT EXISTS notification_subscriptions (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT NOT NULL,
 household_id TEXT NOT NULL,
 endpoint TEXT UNIQUE NOT NULL,
 subscription TEXT NOT NULL,
 preferences TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 FOREIGN KEY (email) REFERENCES household_members(email) ON DELETE CASCADE,
 FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS notification_member ON notification_subscriptions(email,household_id);
CREATE TABLE IF NOT EXISTS notification_deliveries (
 subscription_id TEXT NOT NULL,
 reminder_key TEXT NOT NULL,
 status TEXT NOT NULL,
 attempted_at INTEGER NOT NULL,
 PRIMARY KEY (subscription_id,reminder_key),
 FOREIGN KEY (subscription_id) REFERENCES notification_subscriptions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS app_feedback (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT NOT NULL,
 household_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 message TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY (email) REFERENCES household_members(email) ON DELETE CASCADE,
 FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS feedback_author ON app_feedback(email,created_at);
