import type { User } from "@supabase/supabase-js";

// Only accept the server-confirmed user from auth.getUser(), never cookie claims.
export function supabaseIdentity(user: User | null) {
  if (!user?.email_confirmed_at || !user.email || !user.identities?.some(identity => identity.provider === "google")) return null;
  const email = user.email.trim().toLowerCase();
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return { email, fullName, displayName: fullName || email.split("@")[0] || email };
}
