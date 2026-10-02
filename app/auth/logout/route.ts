import { NextResponse } from "next/server";
import { authConfiguration } from "../../auth-config";
import { supabaseServer } from "../../supabase-server";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const config = authConfiguration();
  if (request.headers.get("origin") !== new URL(config.origin).origin) return new Response("Invalid origin", { status: 403 });
  if (!config.enabled) return NextResponse.redirect(new URL("/cdn-cgi/access/logout", config.origin), 303);
  const client = await supabaseServer();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) return new Response("Could not sign out. Please try again.", { status: 503 });
  return NextResponse.redirect(new URL("/auth/login", config.origin), 303);
}
