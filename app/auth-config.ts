import { env } from "cloudflare:workers";

type AuthEnvironment = { AUTH_PROVIDER?: string; SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string; APP_ORIGIN?: string; HOUSEHOLD_OWNER_EMAIL?: string };

export function authConfiguration() {
  const settings = env as unknown as AuthEnvironment;
  const enabled = settings.AUTH_PROVIDER === "supabase";
  return { enabled, url: settings.SUPABASE_URL ?? "", key: settings.SUPABASE_PUBLISHABLE_KEY ?? "", origin: settings.APP_ORIGIN ?? "https://debtfree-dashboard.ensong0608.workers.dev", ownerEmail: settings.HOUSEHOLD_OWNER_EMAIL?.trim().toLowerCase() };
}

export function requireSupabaseConfiguration() {
  const config = authConfiguration();
  if (!config.enabled || !config.url || !config.key) throw new Error("Google sign-in is not configured.");
  return config;
}
