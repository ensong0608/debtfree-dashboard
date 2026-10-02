import { NextResponse } from "next/server";
import { requireSupabaseConfiguration } from "../../auth-config";
import { supabaseServer } from "../../supabase-server";
import { supabaseIdentity } from "../../supabase-identity";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const config = requireSupabaseConfiguration();
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const client = await supabaseServer();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data, error: userError } = await client.auth.getUser();
      if (!userError && supabaseIdentity(data.user)) return NextResponse.redirect(new URL("/", config.origin), 303);
      await client.auth.signOut({ scope: "local" });
    }
  }
  return NextResponse.redirect(new URL("/auth/login?error=signin", config.origin), 303);
}
