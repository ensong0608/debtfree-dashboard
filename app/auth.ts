import { getAuthenticatedUser as cloudflareUser } from "./cloudflare-auth";
import { authConfiguration } from "./auth-config";
import { supabaseServer } from "./supabase-server";
import { supabaseIdentity } from "./supabase-identity";
export type { DashboardUser } from "./cloudflare-auth";

export async function getAuthenticatedUser() {
  if (!authConfiguration().enabled) return cloudflareUser();
  try {
    const client = await supabaseServer(true);
    const { data, error } = await client.auth.getUser();
    return error ? null : supabaseIdentity(data.user);
  } catch { return null; }
}
